'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {createHash} = require('node:crypto');
const runFile = promisify(execFile);
const {readPublicPage,readXTimeline,publicEnvelope} = require('./public-metrics.cjs');
const {parseXhs} = require('../lib/외부통계파싱.cjs');
const {officialScreen} = require('./official-screen.cjs');
const {ownerCapture} = require('./owner-metrics.cjs');
const PUBLIC = new Set(['tiktok','brunch','x','instagram','behance','naver-clip','tistory','threads','facebook','linkedin','youtube','vk','rutube','kakao-channel','pinterest']);
const json = (value) => JSON.stringify(value);
const privateWrite = (file,content) => fs.writeFileSync(file,content,{flag:'wx'});
const hash = data => createHash('sha256').update(data).digest('hex');

async function external(bin,args,signal,timeout=180_000) {
  return runFile(bin,args,{windowsHide:true,shell:false,timeout,maxBuffer:2*1024*1024,encoding:'utf8',signal});
}
function script(dir,name,source) {const out=path.join(dir,name);privateWrite(out,source);return out;}
async function egoRound(dir,name,source,signal) {
  const file=script(dir,name+'.mjs',source);
  return external('ego-browser',['nodejs','-e','await import('+json(pathToFileURL(file).href)+')'],signal);
}
function handleFailure(error) {
  const detail=String(error.stderr||'')+' '+String(error.stdout||'')+' '+error.message;
  if (/user control|handed.off|delegated.to.user|permission prompt|user has control|requires human/i.test(detail)) return 'user_control';
  if (/SYNK_OWNER/.test(detail)) return 'need_owner';
  if (/SYNK_FORMAT/.test(detail)) return 'format';
  return 'retry';
}
async function finishOwned(ctx,id,name,tag){
  const code='const s=(await listTaskSpaces()).find(x=>x.id==='+json(id)+'&&x.name==='+json(name)+');if(s?.ownership==="agent")await (await taskSpace(s.id)).finish({keep:[]});';
  await egoRound(ctx.dir,tag,code,AbortSignal.timeout(35_000));
}
function marker(text) {
  if(typeof text==='string'){
    const line=text.split(/\r?\n/).find(l=>l.includes('SYNK_METRICS '));
    if(line)return JSON.parse(line.slice(line.indexOf('SYNK_METRICS ')+13));
  }else if(text&&typeof text==='object'){
    for(const value of Object.values(text)){const found=marker(value);if(found)return found;}
  }
}
async function aside(ctx,name,source){
  if(!ctx.profile.account)throw Error('SYNK_OWNER');
  const file=script(ctx.dir,name+'.js',source);
  let output;
  try{output=(await external('aside',['repl','--account',ctx.profile.account,'--file',file,'--json'],ctx.signal)).stdout;}
  catch(error){if(!error.stdout||ctx.signal?.aborted)throw error;output=error.stdout;}
  let decoded;
  try{decoded=JSON.parse(output);}catch{throw Object.assign(Error('Aside returned no readable response'),{code:'ASIDE_TRANSPORT'});}
  if(decoded.run?.error){
    const message=String(decoded.run.error);
    if(/SYNK_OWNER|SYNK_FORMAT/.test(message))throw Error(message.includes('SYNK_OWNER')?'SYNK_OWNER':'SYNK_FORMAT');
    if(/user control|handed.off|requires human/i.test(message))throw Error('user control');
    const lines=(decoded.run.content||[]).flatMap(block=>(block.text||'').split(/\r?\n/));
    const events=lines.flatMap(line=>{
      const m=line.match(/SYNK_STEP (open|owner|controls|click|download) (\d{1,7})(?:\s|$)/);
      return m?[{step:m[1],elapsedMs:Number(m[2])}]:[];
    });
    const known=message.match(/Page\.enable|Target\.attachToTarget|Runtime\.evaluate|DOM\.getDocument|Target closed|Browser has been closed|Timeout[^\n]*while waiting|DOWNLOAD_TIMEOUT|ECONNRESET|ECONNREFUSED|ETIMEDOUT/i);
    const phase=known?known[0].replace(/[^a-z0-9_. -]/gi,'').slice(0,48):'';
    throw Object.assign(Error('Aside did not finish the read'),{code:/timed? ?out|timeout|시간 ?초과/i.test(message)?'ASIDE_TIMEOUT':'ASIDE_TRANSPORT',phase,events});
  }
  return marker(decoded.run?.content);
}
async function read(ctx,url,fn,name,waitForText){
  if(ctx.profile.browser==='aside'){
    const js='const page=await openTab('+json(url)+');try{await page.waitForLoadState("domcontentloaded");await page.waitForFunction(t=>document.body.innerText.includes(t),'+json(waitForText)+',{timeout:12000}).catch(()=>{});console.log("SYNK_METRICS "+JSON.stringify(await page.evaluate('+fn.toString()+')));}finally{await page.close();}';
    return aside(ctx,name,js);
  }
  if(!ctx.profile.profileId)throw Error('SYNK_OWNER');
  const spaceName='synk-analytics-'+ctx.account.id+'-'+path.basename(ctx.dir)+'-'+name;
  const file=path.join(ctx.dir,name+'.json'),spFile=path.join(ctx.dir,name+'-space.json');
  const js='const task=await taskSpace('+json(spaceName)+','+json({profileId:ctx.profile.profileId})+');const p=task.page("p1"),fs=await import("node:fs/promises");await fs.writeFile('+json(spFile)+',JSON.stringify(task.spaceId),{flag:"wx"});await p.goto('+json(url)+',{waitUntil:"domcontentloaded",timeout:25000});await p.snapshot();await p.waitForFunction(t=>document.body.innerText.includes(t),'+json(waitForText)+',{timeout:12000}).catch(()=>{});await fs.writeFile('+json(file)+',JSON.stringify(await p.evaluate('+fn.toString()+')),{flag:"wx"});';
  let handed=false;
  try{
    await egoRound(ctx.dir,name+'-read',js,ctx.signal);
    return JSON.parse(fs.readFileSync(file,'utf8'));
  }catch(e){handed=handleFailure(e)==='user_control';throw e;}
  finally{
    if(!handed&&fs.existsSync(spFile))await finishOwned(ctx,JSON.parse(fs.readFileSync(spFile,'utf8')),spaceName,name+'-finish').catch(()=>{});
  }
}
async function pageJob(ctx,name,fn,params){
  const {profile,dir}=ctx;
  if(profile.browser==='aside'){
    // Aside owns the lifetime and file destination of its Download object.
    if(!profile.account)throw Error('SYNK_OWNER');
    const js='const p=await openTab('+json(params.entry)+');try{const value=await ('+fn.toString()+')(p,'+json(params)+',"aside");console.log("SYNK_METRICS "+JSON.stringify(value));}finally{await p.close();}';
    return aside(ctx,name,js);
  }
  if(!profile.profileId)throw Error('SYNK_OWNER');
  const space='synk-analytics-'+ctx.account.id+'-'+path.basename(dir)+'-'+name;
  const identity=path.join(dir,name+'-space.json'),out=path.join(dir,name+'-observed.json');
  const js='const fs=await import("node:fs/promises"),t=await taskSpace('+json(space)+','+json({profileId:profile.profileId})+'),p=t.page("p1");await fs.writeFile('+json(identity)+',JSON.stringify(t.spaceId),{flag:"wx"});await p.goto('+json(params.entry)+',{waitUntil:"domcontentloaded",timeout:25000});await p.snapshot();const value=await ('+fn.toString()+')(p,'+json(params)+',"ego");await fs.writeFile('+json(out)+',JSON.stringify(value),{flag:"wx"});';
  let handed=false;
  try{await egoRound(dir,name+'-read',js,ctx.signal);return JSON.parse(fs.readFileSync(out,'utf8'));}
  catch(e){handed=handleFailure(e)==='user_control';throw e;}
  finally{if(!handed&&fs.existsSync(identity))await finishOwned(ctx,JSON.parse(fs.readFileSync(identity,'utf8')),space,name+'-finish').catch(()=>{});}
}
async function storeBatch(ctx, name, evidence, envelope) {
  const raw=Buffer.from(JSON.stringify(evidence,null,2));
  privateWrite(path.join(ctx.dir,name+'.json'),raw);
  const batch={accountId:ctx.account.id,evidenceFile:name+'.json',envelope:{...envelope,evidenceSha256:hash(raw)}};
  const file=path.join(ctx.dir,name+'.manifest.json');
  privateWrite(file,json({version:1,batches:[batch]}));
  await ctx.submit(file);
}

// Only fixed executable code runs in the browser. Profile IDs and known canonical URLs are serialized as data.
async function nativeBrowser(ctx) {
  const {account,profile,dir,signal}=ctx;
  const urls=[profile.canonicalUrl,account.publicUrl,profile.profileUrl].filter(Boolean);
  if(account.platform==='behance'&&account.publicUrl)urls.unshift(account.publicUrl.replace(/\/$/,'')+'/info');
  const publicRoute=PUBLIC.has(account.platform) && urls.length;
  const nativeOwner=profile.browser==='ego' && profile.profileId && ['xiaohongshu','douyin','substack'].includes(account.platform);
  if (!publicRoute && !nativeOwner) return {more:true};
  const argument={platform:account.platform,handle:account.handle,urls};
  const reader=(page)=>account.platform==='x'?'await ('+readXTimeline.toString()+')('+page+','+json(argument)+','+readPublicPage.toString()+')':'await '+page+'.evaluate('+readPublicPage.toString()+','+json(argument)+')';
  const output=path.join(dir,'public-snapshot.json');
  if (profile.browser==='aside' || account.id.startsWith('yuhokorean-')) {
    if (!publicRoute || !profile.account) return {more:true};
    const source = [
      'const page=await openTab('+json(urls[0])+');',
      'try {await page.waitForLoadState("domcontentloaded"); await page.waitForFunction(()=>document.body?.innerText.trim().length>30,null,{timeout:9000}).catch(()=>{});',
      'const r='+reader('page')+';console.log("SYNK_METRICS "+JSON.stringify(r));} finally {await page.close();}'
    ].join('\n');
    const snapshot=await aside(ctx,'public-aside',source);
    if (!snapshot) return {more:true};
    privateWrite(output,json(snapshot));
    return savePublic(ctx,snapshot);
  }
  const name = 'synk-analytics-'+account.id+'-'+path.basename(dir);
  const open = [
    'const list=await listTaskSpaces();const previous=list.find(x=>x.name==='+json(name)+');',
    'if(previous && previous.ownership!=="agent")throw Error("user control");',
    'const task=previous?await taskSpace(previous.id):await taskSpace('+json(name)+','+json(profile.profileId?{profileId:profile.profileId}:{})+');',
    'const p=task.page("p1"), fs=await import("node:fs/promises");',
    'await fs.writeFile('+json(path.join(dir,'space.json'))+',JSON.stringify({id:task.spaceId}),{flag:"wx"});'
  ].join('\n');
  let outcome,handed=false;
  try {
    const body=publicRoute ? [
      'await p.goto('+json(urls[0])+',{waitUntil:"domcontentloaded",timeout:28000});',
      'await p.snapshot();await p.waitForFunction(()=>document.body?.innerText.trim().length>30,undefined,{timeout:10000}).catch(()=>{});',
      account.platform==='tiktok'?'await p.waitForFunction(()=>Boolean(document.querySelector("[data-e2e=likes-count]")),undefined,{timeout:10000}).catch(()=>{});':'',
      'const result='+reader('p')+';',
      'await fs.writeFile('+json(output)+',JSON.stringify(result),{flag:"wx"});'
    ].join('\n'):'';
    await egoRound(dir,'open-and-read',open+'\n'+body,signal);
    if(publicRoute) outcome=await savePublic(ctx,JSON.parse(fs.readFileSync(output,'utf8')));
    if(nativeOwner && !ctx.covered()) {
      const space=JSON.parse(fs.readFileSync(path.join(dir,'space.json'),'utf8'));
      outcome=await officialScreen(ctx,space.id,{egoRound,storeBatch,parseXhs});
    }
    return outcome || {more:true};
  } catch(error) {
    const reason=handleFailure(error);
    handed=reason==='user_control';
    return {more:false,reason};
  } finally {
    const file=path.join(dir,'space.json');
    if(!handed&&fs.existsSync(file))await finishOwned(ctx,JSON.parse(fs.readFileSync(file,'utf8')).id,name,'finish-native').catch(()=>{});
  }
}

async function savePublic(ctx,snapshot) {
  if(snapshot.unavailable && ['need_owner','retry'].includes(snapshot.unavailable))return {more:false,reason:snapshot.unavailable};
  const envelope=publicEnvelope({account:ctx.account,sourceUrl:snapshot.url,snapshot,digest:null});
  if(envelope)await storeBatch(ctx,'public-verified',snapshot,envelope);
  if(ctx.covered())return {more:false,reason:'done'};
  if(snapshot.matched && snapshot.empty && ctx.policy.blockedActions?.includes('studio-reauthentication'))
    return {more:false,reason:'no_posts'};
  return {more:true,reason:envelope?'limited':undefined};
}

async function capture(ctx,{ownerSource=ownerCapture,publicSource=nativeBrowser}={}) {
  let owner;
  try {
    owner=await ownerSource(ctx,{external,aside,read,pageJob,storeBatch,egoRound});
  }catch(error){owner=handleFailure(error);}
  if(ctx.covered())return 'done';
  if(owner==='user_control'||ctx.signal.aborted)return owner||'retry';
  const nativeOwner=['douyin','xiaohongshu','substack'].includes(ctx.account.platform);
  if(!nativeOwner&&!PUBLIC.has(ctx.account.platform))return owner||'no_metrics';
  try {
    const native=await publicSource(ctx);
    if(ctx.covered())return 'done';
    if(native.reason==='user_control')return native.reason;
    return owner==='limited'?'limited':native.reason||owner||'no_metrics';
  }catch(error){return handleFailure(error);}
}
module.exports={capture,nativeBrowser,savePublic,storeBatch,egoRound,marker};

