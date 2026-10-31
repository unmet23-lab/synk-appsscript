'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {writeJSON}=require('./monitor.cjs');
const NAME='synk-three-flows';
// 작업 폴더는 경로 꼴(빗금·대소문자)이 달라도 같은 곳이면 같다 — 다르게 보면 운영 사본 갱신이 5분마다 cron을 고친다
const folderKey=x=>path.resolve(String(x||'')).toLowerCase();
function needsScheduleEdit(item,root) {
  return item.schedule?.kind!=='interval'||item.schedule?.minutes!==5||item.script!=='synk_automation.py'
    ||item.no_agent!==true||item.deliver!=='local'||item.failure_deliver!=='local'||!item.workdir||folderKey(item.workdir)!==folderKey(root);
}
function jobs(home) {
  const file=path.join(home,'cron/jobs.json');
  if(!fs.existsSync(file)) return [];
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));
  const rows=Array.isArray(raw)?raw:raw.jobs;
  if(!Array.isArray(rows)) throw new Error('Unknown official cron storage shape.');
  return rows;
}
// 감시는 운영 사본(tools/운영사본.js — origin/master만 따라가는 실행 사본)의 파일을 고정한다(2026-10-22). 공용 작업본·세션 워크트리에서
// 불려도 운영 사본 판으로 넘겨 잡는다 — 세션이 고치는 작업본을 고정하면 거기서 저장만 해도 감시가 멈춘다. --여기서는 이 작업본 그대로.
function opsCopy(root) {
  try { const found=require('../운영사본.js').찾기(root); return found.운영사본&&fs.existsSync(found.운영사본)?found.운영사본:null; } catch { return null; }
}
function sameFolder(a,b) {
  const key=x=>{ try { return fs.realpathSync.native(x).toLowerCase(); } catch { return path.resolve(x).toLowerCase(); } };
  return key(a)===key(b);
}
// 지금 설치본(config.json)이 이 작업본으로 다시 잡을 계획과 같은가. 저장소 파일은 고정한 작업본 안의 상대 경로끼리 내용(SHA)을 견준다 —
// 공용 작업본 → 운영 사본처럼 자리만 옮긴 것(moved)과 내용이 바뀐 것(differs)을 가른다. nativeChanged: 고정한 뒤 헤르메스 쪽 파일이
// 바뀌었다(판 올림) — 그때는 운영 사본 갱신이 저절로 다시 잡지 않고 사람이 호환을 본다.
function contractCheck({home,root,plan,native,destination,job,hash}) {
  let current=null;
  try { current=JSON.parse(fs.readFileSync(path.join(home,'runtime/synk-automation/config.json'),'utf8')); } catch {}
  const pinnedRoot=typeof current?.monitor==='string'?path.resolve(path.dirname(current.monitor),'../..'):null;
  const inside=(base,x)=>{ const r=path.relative(base,x); return !!r&&!r.startsWith('..')&&!path.isAbsolute(r); };
  const keyIn=base=>x=>base&&inside(base,x)?'repo:'+path.relative(base,x).split(path.sep).join('/'):'abs:'+path.resolve(x).toLowerCase();
  const pinned=new Map((current?.files||[]).map(x=>[keyIn(pinnedRoot)(x.path),x.sha256]));
  const wantKey=keyIn(root);
  const want=[...plan.files,{path:destination,sha256:hash(path.join(root,'tools/hermes-synk/automation.py'))}].map(x=>({...x,key:wantKey(x.path)}));
  const label=k=>k.startsWith('repo:')?k.slice(5):path.basename(k.slice(4));
  const differs=want.filter(x=>pinned.get(x.key)!==x.sha256).map(x=>label(x.key));
  const wanted=new Set(want.map(x=>x.key));
  for(const k of pinned.keys()) if(!wanted.has(k)) differs.push('없앨 고정: '+label(k));
  let installed=null; try { installed=hash(destination); } catch {}
  if(installed!==pinned.get(wantKey(destination))) differs.push('설치된 감시 스크립트');
  const nativeChanged=native.some(file=>pinned.has(wantKey(file))&&pinned.get(wantKey(file))!==hash(file));
  const scheduleOk=!!job&&!needsScheduleEdit(job,root);
  const moved=!pinnedRoot||folderKey(pinnedRoot)!==folderKey(root)||current.monitor!==plan.monitor;
  const same=!!current&&current.node===plan.node&&current.recipient===plan.recipient&&current.notification_policy===plan.notification_policy;
  return {inSync:same&&scheduleOk&&!moved&&!differs.length,nativeChanged,differs:[...new Set(differs)],moved,schedule:scheduleOk?'같음':'다시 잡을 것',root};
}
function main() {
  const home=path.join(process.env.LOCALAPPDATA,'hermes'),root=path.resolve(__dirname,'../..');
  const ops=process.argv.includes('--여기서')?null:opsCopy(root);
  if(ops&&!sameFolder(ops,root)) {
    const out=spawnSync(process.execPath,[path.join(ops,'tools/hermes-synk/install-automation.cjs'),...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
    process.exitCode=out.status??1;
    return;
  }
  const apply=process.argv.includes('--apply'),enable=process.argv.includes('--enable'),check=process.argv.includes('--확인');
  let installLock;
  if(apply) {
    const folder=path.join(home,'runtime/synk-automation');fs.mkdirSync(folder,{recursive:true});
    installLock=path.join(folder,'install.lock');
    const fd=fs.openSync(installLock,'wx',0o600);fs.writeFileSync(fd,String(process.pid));fs.closeSync(fd);
  }
  try {
  const YAML=require(path.join(home,'hermes-agent/node_modules/yaml'));
  const config=YAML.parse(fs.readFileSync(path.join(home,'config.yaml'),'utf8'));
  const routes=Object.keys(config.platforms?.telegram?.channel_overrides||{});
  if(routes.length!==1 || !/^\d+$/.test(routes[0])) throw new Error('Existing private Telegram route unavailable.');
  const before=jobs(home).filter(j=>j.name===NAME);
  if(before.length>1) throw new Error('Duplicate named schedules; refusing another schedule.');
  const destination=path.join(home,'scripts/synk_automation.py');
  const originals=['monitor.cjs','awake-time.cjs','overview.cjs','tip-worker-status.cjs','tip-intake-status.cjs','sns-health.cjs','status.cjs','workspace.cjs','validation.cjs','validation-preview.cjs','validation-data.cjs','validation-python.cjs','validation-python.py','validation-web.cjs','integration.cjs','integration-windows.ps1','plugin/__init__.py','plugin/tip_intake.py','plugin/plugin.yaml','automation.py'].map(x=>path.join(__dirname,x));
  const shared=['tools/운영홈.js','tools/operations-home/source-state.cjs','tools/operations-home/resume.js','tools/operations-home/native-status.js','tools/operations-home/operations-status.cjs','tools/operations-home/performance-summary.cjs','tools/참고카드_목록.js','tools/server-backup/read-status.cjs','tools/모델정책.js','tools/lib/공용작업본.js'].map(x=>path.join(root,x));
  const native=['pyproject.toml','gateway/session_context.py'].map(x=>path.join(home,'hermes-agent',x));
  const files=[...originals,...shared,...native];
  for(const file of files) if(!fs.statSync(file).isFile()) throw new Error('Source contract file missing: '+path.basename(file));
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const plan={version:1,notification_policy:'attention_only_v1',node:process.execPath,monitor:path.join(__dirname,'monitor.cjs'),recipient:routes[0],files:files.map(file=>({path:file,sha256:hash(file)}))};
  const receipt={applied:apply,enabled:enable,name:NAME,noAgent:true,pollMinutes:5,notificationPolicy:'attention_only_v1',dailyDigest:false,existingSchedules:before.length,contractFiles:files.length};
  if(check) { console.log(JSON.stringify(contractCheck({home,root,plan,native,destination,job:before[0],hash}),null,2)); return; }
  if(apply) {
    const folder=path.join(home,'runtime/synk-automation');fs.mkdirSync(folder,{recursive:true});
    const backup=path.join(home,'backups','synk-automation-'+Date.now());fs.mkdirSync(backup,{recursive:true});
    for(const [source,label] of [[destination,'script.py'],[path.join(folder,'config.json'),'config.json']]) if(fs.existsSync(source)) fs.copyFileSync(source,path.join(backup,label));
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(path.join(__dirname,'automation.py'),destination);
    plan.files.push({path:destination,sha256:hash(destination)});
    writeJSON(path.join(folder,'config.json'),plan);
    const cli=path.join(home,'bin/hermes.exe');
    const run=args=>{const out=spawnSync(cli,args,{encoding:'utf8',windowsHide:true,timeout:60000,env:{...process.env,HERMES_HOME:home}});if(out.error||out.status) throw new Error('Official cron command failed: '+args.slice(0,2).join(' '));};
    if(!before.length) run(['cron','create','every 5m','--name',NAME,'--script','synk_automation.py','--no-agent','--deliver','local','--failure-deliver','local','--workdir',root,'--paused','--paused-reason','Verify sources and delivery before activation']);
    const found=jobs(home).filter(j=>j.name===NAME);if(found.length!==1) throw new Error('Official schedule creation could not be confirmed.');
    const item=found[0];
    if(item.no_agent!==true || !['synk_automation.py',destination].includes(item.script) || item.deliver!=='local') throw new Error('Existing schedule ownership contract differs; left unchanged.');
    if(before.length && needsScheduleEdit(item,root)) run(['cron','edit',item.id,'--schedule','every 5m','--no-agent','--script','synk_automation.py','--deliver','local','--failure-deliver','local','--workdir',root]);
    receipt.jobId=item.id;
    if(enable && item.enabled!==true) run(['cron','resume',item.id]);
    receipt.backup=path.relative(home,backup);
    writeJSON(path.join(backup,'receipt.json'),receipt);
  }
  console.log(JSON.stringify(receipt,null,2));
  } finally {if(installLock)fs.unlinkSync(installLock);}
}
module.exports={jobs,NAME,needsScheduleEdit,contractCheck,opsCopy};
if(require.main===module)main();
