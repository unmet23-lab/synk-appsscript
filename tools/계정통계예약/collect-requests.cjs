#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
const { readManifest, checkBatch, ORIGIN, HOME_DIR } = require('../계정통계수집.cjs');
const { connect } = require('../작업실예약.js');
const { scanTelegram, buildManifest } = require('../계정통계루틴.cjs');
const catalog = require('../../docs/마케팅/온라인마케팅지도/engagement/company/account-catalog.json');
const ROUTE = '/api/collection-progress';
const MANAGED = new Set(['operating','confirmed-expansion','operating-contact']);
const REQUEST_DIR = path.join(HOME_DIR, 'requests');
const timestamp = () => new Date().toISOString();

function settings(name, dir = HOME_DIR) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf8')).accounts || {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function freshDir(root) {
  fs.mkdirSync(root, {recursive:true});
  return fs.mkdtempSync(path.join(root,'run-'));
}

function saveEvidence(dir, name, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2));
  fs.writeFileSync(path.join(dir, name), bytes, {flag:'wx'});
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function telegram(account, dir) {
  const handle = account.handle.replace(/^@/,'');
  const found = await scanTelegram(handle, {deadline:Date.now()+90_000});
  if (!found.complete) throw Error('Incomplete Telegram pagination');
  const observedAt = timestamp();
  const name = 'telegram-public.json';
  const evidenceSha256 = saveEvidence(dir, name, {observedAt, handle, ...found});
  return buildManifest({accountId:account.id, handle, observedAt, evidenceFile:name, evidenceSha256, rows:found.rows});
}

function lease(job) {
  return {channelId:job.channelId, requestId:job.requestId, token:job.token,workerId:job.workerId};
}
function profileKey(profile) {
  return profile?.browser==='aside'?'aside':'ego:'+(profile?.profileId||'default');
}
function readWorkerConfig(stateDir=HOME_DIR){
  try{return JSON.parse(fs.readFileSync(path.join(stateDir,'worker-config.json'),'utf8').replace(/^\uFEFF/,''));}
  catch(error){if(error.code==='ENOENT')return {};throw error;}
}
function configured(config){
  if(!config||config.configured===false)return false;
  if(config.accountIds!==undefined)return Array.isArray(config.accountIds)&&config.accountIds.length>0&&config.accountIds.every(id=>typeof id==='string'&&id.trim());
  return config.allManaged===true;
}
function workerIdentity(options){
  const workerId=options.workerId||'pc_'+crypto.createHash('sha256').update(os.hostname()+'\0'+os.homedir()).digest('hex').slice(0,28);
  const config=options.workerConfig||readWorkerConfig(options.stateDir);
  const allow=config.accountIds?new Set(config.accountIds):null,excluded=new Set(config.excludedAccountIds||[]);
  const accountIds=(options.catalog||catalog).accounts.filter(a=>MANAGED.has(a.accountStatus)&&(!allow||allow.has(a.id))&&!excluded.has(a.id)).map(a=>a.id);
  return {workerId,accountIds};
}
function downloadCapture(batch,manifest,job,envelope){
  if(envelope.sourceType!=='official-export')return undefined;
  const file=path.resolve(manifest.dir,batch.evidenceFile);
  const stat=fs.lstatSync(file),root=fs.realpathSync(manifest.dir),requested=Date.parse(job.requestedAt);
  if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(path.dirname(file))!==root||
     !Number.isFinite(stat.birthtimeMs)||Math.ceil(stat.birthtimeMs)<requested||Date.parse(envelope.observedAt)<requested)
    throw Error('The official download was not created for this request');
  return {requestId:job.requestId,token:job.token,evidenceSha256:envelope.evidenceSha256,downloadedAt:envelope.observedAt};
}

// A manifest can only contribute to the account claimed in this request. The ingester rechecks the original bytes and account binding.
async function submit(file, dir, job, api) {
  if (fs.lstatSync(file).isSymbolicLink() || fs.realpathSync(path.dirname(file)) !== fs.realpathSync(dir)) throw Error('Unexpected manifest path');
  const manifest = readManifest(file);
  let metrics = [];
  for (const [i,batch] of manifest.batches.entries()) {
    if (batch.accountId !== job.accountId || !(Date.parse(batch.envelope?.observedAt) >= Date.parse(job.requestedAt))) throw Error('Account or capture time mismatch');
    const check = await checkBatch(batch, i, manifest, timestamp());
    if (check.status !== 'ready') throw Error('Invalid source: '+check.code);
    const capture=downloadCapture(batch,manifest,job,check.envelope);
    const result = await api.post(ROUTE+'/observations', {...lease(job),envelope:check.envelope,...(capture?{capture}:{})});
    if (!Array.isArray(result.metrics) || result.created+result.existing !== check.rows) throw Error('Unexpected collection receipt');
    metrics = result.metrics;
  }
  return metrics;
}

async function processJob(api, job, options = {}) {
  const account = (options.catalog || catalog).accounts.find(a=>a.id===job.accountId && MANAGED.has(a.accountStatus));
  const stateDir = options.stateDir || HOME_DIR;
  const root = options.requestDir || REQUEST_DIR;
  let dir = freshDir(root);
  const capture = options.capture || require('./capture-routes.cjs').capture;
  const control = new AbortController();
  let stage = 'public-page', touched = [], pending = Promise.resolve(), reason = 'retry';
  const update = detail => api.post(ROUTE+'/update', {...lease(job),...detail});
  // Serialize status writes so a late heartbeat cannot revert the stage or revive a completed job.
  const sendStage = next => {
    stage = next;
    pending = pending.then(()=>update({stage:next}));
    pending.catch(()=>control.abort());
    return pending;
  };
  const timer = setInterval(()=>{ if (!control.signal.aborted) sendStage(stage).catch(()=>{}); },40_000);
  let submitted = false;
  const take = async file => {
    await pending;
    if (control.signal.aborted) throw Error('Collection lease ended');
    touched = await submit(file,dir,job,api);
    submitted = true;
  };
  try {
    if (!account) throw Error('Account is absent from the local operating catalog');
    const profile = (options.profiles || settings('browser-profiles',stateDir))[account.id] || {};
    const policy = (options.policies || settings('collection-policy',stateDir))[account.id] || {};
    if (policy.blockedActions?.includes('browser-interaction')) reason = 'user_control';
    else if (account.platform === 'telegram') {
      if (account.accountStatus === 'operating-contact' || policy.blockedActions?.includes('broadcast-analytics')) reason='contact';
      else {
        const manifest=await (options.telegram || telegram)(account,dir);
        if (manifest.batches.length) {
          const file=path.join(dir,'telegram.manifest.json');saveEvidence(dir,path.basename(file),manifest);await take(file);
        }
        reason='limited';
      }
    } else {
      // Aside exposes one local browser-control service across its accounts. Overlapping downloads time out there.
      const key=profileKey(profile);
      const read=()=>capture({account, profile, policy, dir, stateDir, requestedAt:job.requestedAt, missing:job.missing,
        liveChannel:async()=>{const {channels}=await api.get('/api/state');return channels.find(channel=>channel.id===job.channelId);},
        setStage:sendStage, submit:take, covered:()=>job.missing.every(k=>touched.includes(k)), signal:control.signal});
      // Retry a temporary read once within the same leased account. Preserve the first capture and start with fresh files.
      const perform=async()=>{
        const first=await read();
        if(first!=='retry'||submitted||control.signal.aborted)return first;
        const next=freshDir(root);
        saveEvidence(dir,'retry.json',{at:timestamp(),next:path.basename(next)});
        dir=next;
        await sendStage('public-page');
        return read();
      };
      reason = options.onProfile ? await options.onProfile(key,perform) : await perform();
    }
    if (job.missing.every(k=>touched.includes(k))) reason='done';
  } catch (error) {
    // Log codes only. Browser output or URLs may include personal information.
    reason='retry';
    fs.writeFileSync(path.join(dir,'failure.json'),JSON.stringify({at:timestamp(),code:String(error.code || 'CAPTURE_FAILED').slice(0,50)}),{flag:'wx'});
  } finally {
    clearInterval(timer);
    await pending;
  }
  return update({reason});
}

async function drain(api,{wait=sleep, idleMs=15_000, until=()=>false, ...options}={}) {
  let processed=0;
  const claim=workerIdentity(options);
  const profiles=new Map(),running=new Set();
  const telegramIds=new Set((options.catalog||catalog).accounts.filter(account=>account.platform==='telegram').map(account=>account.id));
  function onProfile(key,run){
    const prior=profiles.get(key)||Promise.resolve();
    const next=prior.catch(()=>{}).then(run);
    profiles.set(key,next);
    return next.finally(()=>{if(profiles.get(key)===next)profiles.delete(key);});
  }
  let failure;
  async function run(job,assignments){
    try{await processJob(api,job,{...options,profiles:assignments,onProfile});processed++;}
    catch(error){if(Number(error.status||error.statusCode)!==409)failure=error;}
  }
  try{
  while (!until()) {
    if(failure)throw failure;
    if(running.size>=3){await Promise.race(running);continue;}
    const assignments=options.profiles||settings('browser-profiles',options.stateDir);
    // Keep busy browser accounts in the server queue. Telegram reads need no browser profile.
    const accountIds=claim.accountIds.filter(id=>telegramIds.has(id)||!profiles.has(profileKey(assignments[id])));
    const {job}=await api.post(ROUTE+'/claim',{workerId:claim.workerId,accountIds});
    if (job) {
      const next=run(job,assignments).finally(()=>running.delete(next));
      running.add(next);
    } else {
      if(running.size){await Promise.race(running);continue;}
      if (!idleMs) break;
      await wait(idleMs);
    }
  }
  }finally{await Promise.allSettled(running);}
  if(failure)throw failure;
  return processed;
}

// 09:40·21:40 KST 정기 회차(2026-11-16부터). GPT 대화에 붙어 있던 Codex 예약 `synk-2`가 그 대화를 보관하면서 사라져 PC 예약으로 옮겼다.
// 현황판의 ‘모두 수집’ 버튼과 같은 요청 하나만 넣는다. 실제 읽기는 1분마다 도는 요청 수집기(`--requests`)가 맡는다. AI를 부르지 않는다.
// 아직 끝나지 않은 요청이 있거나 최근 RECENT_MS 안에 누군가 요청을 넣었으면 넣지 않는다(같은 회차를 두 번 돌리지 않는다).
const RECENT_MS=3*60*60_000;
const ACTIVE=new Set(['queued','running']);
function countBy(items,key){
  const out={};
  for(const item of items)out[item[key]]=(out[item[key]]||0)+1;
  return out;
}
async function startScheduled(api,{now=Date.now(),recentMs=RECENT_MS}={}){
  const before=await api.get(ROUTE+'?scope=all');
  const items=Array.isArray(before?.items)?before.items:[];
  const active=items.filter(item=>ACTIVE.has(item.status)).length;
  if(active)return {started:false,reason:'active',active};
  const times=items.map(item=>Date.parse(item.requestedAt)).filter(Number.isFinite);
  const latest=times.length?Math.max(...times):0;
  if(latest&&now-latest<recentMs)return {started:false,reason:'recent',minutesAgo:Math.round((now-latest)/60_000)};
  const result=await api.post('/api/collect',{scope:'all'});
  const after=Array.isArray(result?.progress?.items)?result.progress.items:[];
  return {started:true,channels:after.length,apiRuns:Array.isArray(result?.runs)?result.runs.length:0,
    byStatus:countBy(after,'status'),workerOnline:result?.progress?.worker?.online===true};
}

async function main(argv=process.argv.slice(2)) {
  const workerConfig=readWorkerConfig();
  if(!configured(workerConfig)){
    console.log('이 PC에는 수집을 맡길 계정이 지정되지 않았습니다.');
    return;
  }
  const api=await connect({origin:ORIGIN,session:null});
  if(argv.includes('--start')){
    // 숫자와 이유만 남긴다. 계정 이름이나 주소는 기록에 넣지 않는다.
    try { console.log(JSON.stringify(await startScheduled(api))); }
    finally { await api.post('/api/logout',{}); }
    return;
  }
  const deadline=Date.now()+20*60_000;
  try { await drain(api,{workerConfig,until:()=>Date.now()>=deadline}); }
  finally { await api.post('/api/logout',{}); }
}
if(require.main===module) main().catch(error=>{console.error('통계 요청 수집기가 중단됐습니다.',String(error.status || error.code || 'WORKER_ERROR'));process.exitCode=1;});
module.exports={processJob,drain,submit,settings,telegram,saveEvidence,downloadCapture,workerIdentity,readWorkerConfig,configured,startScheduled,RECENT_MS};

