// Atlas × WORLD 2단계 E의 실제 브라우저 확인(2026-11-08). 실제 Edge + 합성 마이크(사람 목소리가 아니다) + 가짜 계정 서버 — 운영 계정 · 서버 · AI · 돈을 쓰지 않는다.
// 계정 모드 WORLD에서 말하기를 실제로 눌러 ① 기록이 코치에 어떻게 남는지 ② 동기화로 나간 사건을 **운영 서버와 같은 검증**(SYNK-talk origin/master의 _shared/synk-atlas.js ·
// validationNeeds → validateIncrement, lib/synk-server.js와 같은 순서)이 받는지 ③ 빈 저장소의 「다른 기기」가 그 기록을 받아 「해 봤어요」 · 계획 판에 보이는지 ④ 페이지 오류가 없는지 본다.
//   node docs/_ops/qa/atlas-world-engine-20261108/E_브라우저확인.mjs [--주소 https://synk.im/world/] [--out <폴더>] [--talk <SYNK-talk 경로>]
// 주소가 없으면 이 작업본을 로컬 서버(계정 모드)로 띄운다. 주소를 주면 그 공개 파일을 읽기만 하고(GET만 통과, 나머지는 막는다) 계정 API는 모두 아래 가짜가 받는다.
// 공개 전에 후보 주소를 synk.im에 부르지 않는다 — 주소는 공개 뒤 확인에만 쓴다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {emptyPlayState} from '../../../../experiences/play-common/play-data.mjs';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const arg=name=>{const at=process.argv.indexOf(name);return at>=0?process.argv[at+1]:null;};
const remote=arg('--주소');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'e-speaking-browser-'));
const out=path.resolve(arg('--out')||path.join(directory,'out'));fs.mkdirSync(out,{recursive:true});
const talk=path.resolve(arg('--talk')||process.env.SYNK_TALK_ROOT||path.join(process.env.USERPROFILE||os.homedir(),'Documents','SYNK-talk'));

// 운영 서버와 같은 검증 — SYNK-talk origin/master의 사본을 그대로 쓴다(공용 작업본의 파일은 옛 판일 수 있다).
const talkHead=execFileSync('git',['-C',talk,'log','origin/master','-1','--format=%h %ad','--date=short'],{encoding:'utf8'}).trim();
fs.writeFileSync(path.join(directory,'synk-atlas.cjs'),execFileSync('git',['-C',talk,'show','origin/master:supabase/functions/_shared/synk-atlas.js'],{maxBuffer:1<<28}));
const ServerAtlas=require(path.join(directory,'synk-atlas.cjs'));
assert.equal(typeof ServerAtlas.validateIncrement,'function','서버 검증 함수를 못 읽었다');
const SCOPE=Object.freeze({domain:'LAB',workspace:'learning',subject:'device'});

const A='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222';
const fixtureConfig={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const VIEW={width:390,height:844};

// 합성 마이크 소리: 16kHz 한 채널 6초. 말소리처럼 켜졌다 꺼지는 배음.
function voicedWav(file){
 const rate=16000,seconds=6,n=rate*seconds,data=Buffer.alloc(44+n*2);
 data.write('RIFF',0);data.writeUInt32LE(36+n*2,4);data.write('WAVE',8);data.write('fmt ',12);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);
 data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++){const t=i/rate,syll=Math.max(0,Math.sin(Math.PI*((t*4)%1))),f=140+20*Math.sin(t*3);let v=0;for(let h=1;h<=6;h++)v+=Math.sin(2*Math.PI*f*h*t)/h;data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v*.32*syll))*32767),44+i*2);}
 fs.writeFileSync(file,data);
}
const FEEDBACK={status:'ok',counted:true,heard:{transcript:'저는 주말에 보통 집에서 쉬어요.',speech:'clear',language:'ko',syllables:12},covered:[0,1],
 elements:{task:{good:'두 가지 질문에 모두 대답했어요.',try:'한 문장 더해 봐요.'},language:{good:'지금 하는 일과 지난 일을 나눠 말했어요.',try:'이어 주는 말을 써 봐요.'},delivery:{good:'속도가 알맞아요.',try:''}},
 modelLine:'다음 주말에는 친구와 공원에 가고 싶어요.',note:''};
const TURNS={order:{heard:'따뜻한 차 두 잔 주세요.',next:{step:'confirm',hint:null}},confirm:{heard:'네, 맞아요.',next:{step:'place',hint:null}},place:{heard:'여기서 마실게요.',next:{step:'done',hint:null}}};

const wav=path.join(directory,'voice.wav');voicedWav(wav);
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(fixtureConfig));
let server=null,serverOutput='';
if(!remote){
 server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talk,SYNK_WORLD_PORT:String(port),SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')}});
 server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 for(let i=0;;i++){try{if((await fetch(`http://127.0.0.1:${port}/world/health`)).ok)break;}catch{}if(i>120)throw Error(`서버가 뜨지 않았다: ${serverOutput.slice(-600)}`);await new Promise(r=>setTimeout(r,500));}
}
const base=remote?new URL(remote).href:`http://127.0.0.1:${port}/world/`,origin=new URL(base).origin;
const jsonOf=async url=>{const response=await fetch(url);if(!response.ok)throw Error(`${url}: ${response.status}`);return response.json();};
// 공개본이면 그 주소의 설정이 가리키는 계정 API를, 로컬이면 시험 설정을 가짜로 받는다.
const identity=remote?new URL((await jsonOf(new URL('world-config.json',base).href)).account.accountApiUrl).origin:new URL(fixtureConfig.accountApiUrl).origin;
const bankHash=(await jsonOf(new URL('world-speaking-items.json',base).href)).contentHash;

// 가짜 계정 서버 — 두 기기가 나눠 쓴다. 사건 수락은 운영 서버와 같은 순서로 검증한다.
const remoteRows=[],posted=[],rejected=[],speakingCalls=[],unexpected=[],blocked=[],errors=[],consoleErrors=[],playState=emptyPlayState();
const fake={feedback:'ok',remaining:4};
let playRevision=0;
const acceptEvents=events=>{
 const stored=new Map(remoteRows.map(e=>[e.id,e])),fresh=events.filter(e=>!stored.has(e.id)).map(e=>JSON.parse(JSON.stringify(e)));
 if(!fresh.length)return;
 const needs=ServerAtlas.validationNeeds(fresh),wanted=new Set(needs.ids),references=remoteRows.filter(e=>wanted.has(e.id)),attempts=[];
 for(const presentationId of needs.presentations){const latest=remoteRows.filter(e=>e.type==='practice.attempted'&&e.presentationId===presentationId).sort((a,b)=>a.attemptNo-b.attemptNo).at(-1);if(latest)attempts.push(latest);}
 ServerAtlas.validateIncrement({events:fresh,scope:SCOPE,references,attempts});
 remoteRows.push(...fresh);posted.push(...fresh);
};
const cors={'Access-Control-Allow-Origin':'*'};
async function fixtureRoute(route){
 const req=route.request(),target=new URL(req.url());let status=200,data={ok:true};
 if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...cors,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, POST, PUT'}});return;}
 const body=req.postDataJSON();
 if(target.pathname.startsWith('/functions/v1/world-speaking')){
  speakingCalls.push({action:body.action,item:body.item_id||`${body.roleplay_id}/${body.step_id}`,version:body.items_version});
  if(body.action==='status')data={ok:true,accountId:A,enabled:true,dailyLimit:5,remaining:5,itemsVersion:bankHash};
  else if(body.action==='feedback')data=fake.feedback==='ok'?{ok:true,accountId:A,status:'ok',feedback:FEEDBACK,remaining:fake.remaining}:{ok:true,accountId:A,status:fake.feedback};
  else{const turn=TURNS[body.step_id];data={ok:true,accountId:A,status:'ok',turn:{status:'ok',counted:true,heard:turn.heard,unclear:false,slots:{},polite:'yes',better:'',tip:'',next:turn.next}};}
 }
 else if(target.pathname==='/functions/v1/classroom')data={contract_ver:'c16',ok:true,classes:[]};
 else if(target.pathname.endsWith('/synk-account'))data=body?{ok:true,refreshRevoked:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:true,revision:1},capabilities:{learningSync:true},sessions:[{id:C,current:true,revoked:false,product:'world'}]};
 else if(target.pathname.endsWith('/synk-play')){if(body?.action==='progress')for(const change of body.changes){if(change.value===null)delete playState.records[change.key];else playState.records[change.key]=change.value;}data={ok:true,scope:'synk-play',accountId:A,revision:body?++playRevision:playRevision,state:structuredClone(playState)};}
 else if(target.pathname.endsWith('/synk-world-v1/bootstrap'))data={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
 else if(target.pathname.endsWith('/synk-learning')){
  const view=target.searchParams.get('view');
  if(req.method()==='GET'&&view==='memory')data={ok:true,revision:1,entries:[]};
  else if(req.method()==='GET'&&view)data={ok:true,revision:1,scope:'synk-atlas-summary'};
  else if(req.method()==='GET'){const after=Number(target.searchParams.get('after')||0);data={ok:true,revision:1,events:remoteRows.slice(after),cursor:remoteRows.length,hasMore:false};}
  else if(body?.memory)data={ok:true,revision:1,entries:body.memory};
  else{try{acceptEvents(body.events);data={ok:true,accepted:body.events.map(e=>e.id),revision:1};}catch(error){rejected.push({message:error.message,events:body.events});status=400;data={ok:false,error:{code:'INVALID_EVENTS'}};}}
 }
 else if(target.pathname.endsWith('/synk-personal')){status=403;data={ok:false,error:{code:'PRODUCT_FORBIDDEN'}};}
 else if(target.pathname.includes('/synk-classroom/'))data={mode:'account-linked',accountId:A,classes:[],emptyReason:'NO_CLASS',serverTime:new Date().toISOString()};
 else if(target.pathname.startsWith('/auth/v1/logout'))data={};
 else{unexpected.push(`${req.method()} ${target.pathname}`);status=404;data={ok:false,error:{code:'NOT_IN_FIXTURE'}};}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:cors});
}

const browser=await playwright.chromium.launch({channel:process.platform==='win32'?'msedge':'chrome',headless:true,timeout:30000,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${wav}`,'--autoplay-policy=no-user-gesture-required']});
async function device(name){
 const context=await browser.newContext({viewport:VIEW,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce',permissions:['microphone']});context.setDefaultTimeout(30000);
 await context.route('**/*',route=>{const req=route.request(),target=new URL(req.url());if(target.origin===origin&&(['GET','HEAD'].includes(req.method())))return route.continue();blocked.push(`${name} ${req.method()} ${target.origin}${target.pathname}`);return route.abort('blockedbyclient');});
 await context.route(identity+'/**',fixtureRoute);
 await context.addInitScript(()=>{if(location.protocol==='about:')return;if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'&&!/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(m.text()))consoleErrors.push(`${name}: ${m.text().slice(0,300)}`);});
 return {context,page};
}
async function start(page){
 await page.goto(base+'?opening=off',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client?.status==='ready',null,{timeout:60000});
 for(let i=0;i<160;i++){
  const state=await page.evaluate(()=>{const vis=s=>[...document.querySelectorAll(s)].some(n=>n.getClientRects().length>0);
   return vis('[data-lang-picker]')?'lang':vis('dialog[open] [data-world="device-records"][data-choice="keep"]')?'records':vis('dialog[open] [data-first-hangul="reads"]')?'hangul':vis('dialog[open] .tutor-option')?'tutor'
    :document.querySelector('.world-shell')?.dataset.entry==='ready'&&!document.querySelector('dialog[open]')?'ready':'wait';});
  if(state==='ready')return;
  if(state==='lang'){await page.locator('[data-lang-choice="ko"]').click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
  else if(state==='hangul'){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}
  else if(state==='records'){await page.locator('dialog[open] [data-world="device-records"][data-choice="keep"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-world="device-records"]'));}
  else if(state==='tutor'){await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] .tutor-option'));}
  await page.waitForTimeout(250);
 }
 throw Error('입장 단계가 끝나지 않았다');
}
const closeSheet=async page=>{if(await page.evaluate(()=>document.querySelector('#world-panel')?.open)){await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);}};
const openPacks=async page=>{await closeSheet(page);await page.locator('nav [data-view="packs"], [data-view="packs"][data-life-library]').last().click();await page.waitForSelector('#panel-content .life-hub');};
const openSpeaking=async page=>{await openPacks(page);await page.locator('#panel-content [data-world="speaking"]').click();await page.waitForSelector('#panel-content .wsp-list');};
const speakFor=(page,ms)=>page.evaluate(ms=>new Promise((resolve,reject)=>{let heard=0,last=performance.now(),frame;const fail=()=>{cancelAnimationFrame(frame);clearTimeout(timeout);reject(Error(`합성 마이크 신호 부족 (${Math.round(heard)}/${ms}ms)`));};const timeout=setTimeout(fail,30000);
 const sample=now=>{const meter=document.querySelector('#panel-content [data-wsp-level]');if(!meter){fail();return;}if(Number(meter.style.getPropertyValue('--level'))>.17)heard+=Math.max(0,Math.min(200,now-last));last=now;if(heard>=ms){clearTimeout(timeout);resolve();}else frame=requestAnimationFrame(sample);};frame=requestAnimationFrame(sample);}),ms);
let consented=false;
const answerOnce=async page=>{
 await page.locator('#panel-content [data-wsp-start]').click();
 if(!consented){await page.waitForSelector('#panel-content .wsp-consent');await page.locator('#panel-content [data-wsp-consent]').click();consented=true;}
 await page.waitForSelector('#panel-content [data-wsp-skip]');await page.locator('#panel-content [data-wsp-skip]').click();
 await page.waitForSelector('#panel-content [data-wsp-stop]');await speakFor(page,1600);await page.locator('#panel-content [data-wsp-stop]').click();await page.waitForSelector('#panel-content [data-wsp-retry]');
};
// 이 기기 코치 장부의 말하기 사건(읽기만). 계정 장부 열쇠 이름에 기대지 않고 world-speaking 사건이 있는 칸을 모은다.
const coachEvents=page=>page.evaluate(()=>{const rows=[];for(const key of Object.keys(localStorage)){if(!key.startsWith('synk.atlas.learning'))continue;let value;try{value=JSON.parse(localStorage.getItem(key));}catch{continue;}for(const e of value?.events||[])if(e?.experienceId==='world-speaking'||e?.gameId==='world-speaking'||e?.context?.experience==='world-speaking')rows.push(e);}return rows;});
const speakingLog=page=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('synk.world.speaking.v1:')).flatMap(k=>JSON.parse(localStorage.getItem(k)).log||[]));
const flushed=async page=>{await page.evaluate(async()=>{await window.SYNKLearningHost?.flush?.();});await page.waitForFunction(()=>{const s=window.SYNKLearningHost?.status?.();return s&&!s.queued&&['synced','idle'].includes(s.phase);},null,{timeout:45000});};
const presentations=rows=>rows.filter(e=>e.type==='practice.presented'&&/^speaking./.test(e.itemKey||''));
const attemptsOf=(rows,item)=>{const ids=new Set(presentations(rows).filter(e=>e.itemKey===`speaking.${item}`).map(e=>e.id));return rows.filter(e=>e.type==='practice.attempted'&&ids.has(e.presentationId));};
const wasSpeaking=rows=>{const ids=new Set(presentations(rows).map(e=>e.id));return rows.filter(e=>ids.has(e.id)||ids.has(e.presentationId));};
const brief=e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['id','at','scope','v','version','schema','ts','context','subject','learnerKey'].includes(k)));

const report={base,identity,talkHead,steps:[],device1:{},device2:{}};
let exitCode=0;
try{
 const one=await device('첫 기기');
 const page=one.page;
 await start(page);report.steps.push('첫 기기 입장');
 await openSpeaking(page);
 await page.waitForFunction(()=>window.SYNKLearningHost,null,{timeout:45000});report.device1.hostPrepared=true;report.steps.push('말하기를 열자 계정 학습 통로가 준비됨');
 report.device1.hostStatus=await page.evaluate(()=>window.SYNKLearningHost.status());
 // ① 열기만 → 남지 않음
 await page.locator('#panel-content [data-wsp-open="s1-weekend"]').click();await page.waitForSelector('#panel-content .wsp-task[data-type="1"]');
 await page.locator('#panel-content [data-wsp-back]').click();await page.waitForSelector('#panel-content .wsp-list');
 await flushed(page);
 report.device1.afterOpenOnly=wasSpeaking(remoteRows).length;assert.equal(report.device1.afterOpenOnly,0,'문항을 열기만 하면 Trail에 남지 않는다');report.steps.push('열기만 → Trail 0');
 // ② 자동 피드백 → 떠나기 전에는 없고 떠날 때 시도 하나
 await page.locator('#panel-content [data-wsp-open="s1-weekend"]').click();await page.waitForSelector('#panel-content .wsp-task[data-type="1"]');
 await answerOnce(page);await page.locator('#panel-content [data-wsp-send]').click();await page.waitForSelector('#panel-content .wsp-els');
 await flushed(page);
 report.device1.afterFeedbackBeforeLeave=wasSpeaking(remoteRows).length;assert.equal(report.device1.afterFeedbackBeforeLeave,0,'자동 피드백을 받은 뒤 떠나기 전에는 Trail에 없다');
 await page.locator('#panel-content [data-wsp-back]').click();await page.waitForSelector('#panel-content .wsp-list');
 await flushed(page);
 report.device1.afterFeedbackLeave=wasSpeaking(remoteRows).map(brief);
 assert.equal(attemptsOf(remoteRows,'s1-weekend').length,1,'떠나면 s1 시도 하나가 서버까지 간다');
 const logged=(await speakingLog(page)).filter(e=>e.source==='ai-reference').at(-1);
 assert.ok(logged?.trail,'이 기기 기록의 그 시도에 Trail 사건 id가 있다');assert.ok(remoteRows.some(e=>e.id===logged.trail),'그 id가 서버의 시도와 같다');
 report.steps.push('자동 피드백 → 떠날 때 시도 하나 · 이 기기 기록과 사건 id로 이어짐');
 // ②-1 게임을 열고 닫으면 계정 통로가 새로 열린다(prepareGame) — 그 뒤의 말하기 시도도 계정에 남아야 한다(아래 ④ · ⑤가 재는 것은 이 뒤의 시도다).
 await closeSheet(page);
 await page.evaluate(()=>{window.__hostBefore=window.SYNKLearningHost;const b=document.createElement('button');b.dataset.worldGame='rhythm';b.hidden=true;document.body.append(b);b.click();b.remove();});
 await page.waitForSelector('.game-frame',{state:'attached',timeout:60000});
 report.device1.hostReplaced=await page.evaluate(()=>!!window.SYNKLearningHost&&window.SYNKLearningHost!==window.__hostBefore);
 assert.equal(report.device1.hostReplaced,true,'게임을 열면 통로가 새로 열린다');
 await closeSheet(page);await openSpeaking(page);report.steps.push('게임을 열고 닫아 계정 통로가 새로 열림');
 // ③ 「제가 한 말과 달라요」만 하고 떠남 → 남지 않음
 const beforeMisheard=remoteRows.length;
 await page.locator('#panel-content [data-wsp-open="s3-birthday"]').click();await page.waitForSelector('#panel-content .wsp-task[data-type="3"]');
 await answerOnce(page);await page.locator('#panel-content [data-wsp-send]').click();await page.waitForSelector('#panel-content .wsp-els');
 await page.locator('#panel-content [data-wsp-misheard]').click();await page.waitForSelector('#panel-content [data-wsp-self-save]');
 await page.locator('#panel-content [data-wsp-back]').click();await page.waitForSelector('#panel-content .wsp-list');
 await flushed(page);
 report.device1.misheardNewRows=remoteRows.slice(beforeMisheard).map(brief);assert.equal(remoteRows.length-beforeMisheard,0,'잘못 들음만 하고 떠나면 Trail에 판도 시도도 남지 않는다');
 report.steps.push('잘못 들음 → Trail 0');
 // ④ 서버 사정 → 스스로 확인 → 시도 하나
 fake.feedback='unavailable';
 await page.locator('#panel-content [data-wsp-open="s4-festival"]').click();await page.waitForSelector('#panel-content .wsp-task[data-type="4"]');
 await answerOnce(page);await page.locator('#panel-content [data-wsp-send]').click();await page.waitForSelector('#panel-content [data-wsp-self-save]');
 await page.locator('#panel-content [data-wsp-self]').first().check();await page.locator('#panel-content [data-wsp-self-save]').click();
 await flushed(page);fake.feedback='ok';
 assert.equal(attemptsOf(remoteRows,'s4-festival').length,1,'스스로 확인한 시도 하나가 서버까지 간다');
 const self=(await speakingLog(page)).filter(e=>e.source==='self').at(-1);assert.ok(self?.trail,'스스로 확인 기록에도 사건 id가 있다');
 report.steps.push('스스로 확인 → 시도 하나 · 사건 id');
 await page.locator('#panel-content [data-wsp-back]').click();await page.waitForSelector('#panel-content .wsp-list');
 // ④-1 자동 피드백을 받은 채 페이지를 떠남(탭 닫기 · 다른 주소) → 앱 셸의 pagehide가 말하기를 정리하며 그 시도가 남고, 다음에 열 때 서버까지 간다.
 await page.locator('#panel-content [data-wsp-open="s5-bike"]').click();await page.waitForSelector('#panel-content .wsp-task[data-type="5"]');
 await answerOnce(page);await page.locator('#panel-content [data-wsp-send]').click();await page.waitForSelector('#panel-content .wsp-els');
 assert.equal(attemptsOf(remoteRows,'s5-bike').length,0,'떠나기 전에는 Trail에 없다');
 await page.goto('about:blank');await start(page);await openSpeaking(page);
 await page.waitForFunction(()=>window.SYNKLearningHost,null,{timeout:45000});await flushed(page);
 assert.equal(attemptsOf(remoteRows,'s5-bike').length,1,'페이지를 떠나도 그 시도가 남아 다음에 열 때 서버까지 간다');
 assert.ok((await speakingLog(page)).find(e=>e.itemId==='s5-bike'&&e.source==='ai-reference')?.trail,'이 기기 기록에도 사건 id가 있다');
 report.steps.push('자동 피드백을 받은 채 페이지를 떠남 → 시도 하나 · 사건 id · 다음에 열 때 서버까지');
 // ⑤ 역할극 끝 → 시도 하나
 await page.locator('#panel-content [data-wsp-roleplay="rp-cafe-tea"]').click();await page.waitForSelector('#panel-content .wsp-roleplay');
 await page.locator('#panel-content [data-wsp-rp-start]').click();
 if(!consented){await page.waitForSelector('#panel-content .wsp-consent');await page.locator('#panel-content [data-wsp-consent]').click();consented=true;}
 for(const [turnNo] of ['order','confirm','place'].entries()){
  await page.waitForSelector('#panel-content [data-wsp-rp-speak]',{timeout:30000});
  await page.locator('#panel-content [data-wsp-rp-speak]').click();await page.waitForSelector('#panel-content [data-wsp-rp-stop]');await speakFor(page,1600);await page.locator('#panel-content [data-wsp-rp-stop]').click();
  for(let w=0;speakingCalls.filter(c=>c.action==='turn').length<turnNo+1&&w<300;w++)await page.waitForTimeout(100);
 }
 await page.waitForSelector('#panel-content .wsp-done');await flushed(page);
 assert.equal(attemptsOf(remoteRows,'rp-cafe-tea').length,1,'역할극 끝 시도 하나가 서버까지 간다');
 report.steps.push('역할극 끝 → 시도 하나');
 report.device1.serverRows=wasSpeaking(remoteRows).map(brief);
 report.device1.allRowTypes=remoteRows.reduce((m,e)=>{m[e.type]=(m[e.type]||0)+1;return m;},{});
 report.device1.rejected=rejected.map(r=>r.message);
 assert.equal(rejected.length,0,`운영 서버 검증이 거절한 묶음: ${JSON.stringify(rejected.map(r=>r.message))}`);
 report.device1.tried=await (async()=>{await page.locator('#panel-content [data-wsp-back]').click();await page.waitForSelector('#panel-content .wsp-list');return page.evaluate(()=>[...document.querySelectorAll('#panel-content .wsp-row')].map(n=>n.textContent.replace(/\s+/g,' ').trim().slice(0,60)));})();
 await page.screenshot({path:path.join(out,'첫기기-말하기목록.png')});
 const attempts=wasSpeaking(remoteRows).filter(e=>e.type==='practice.attempted');
 report.device1.attemptJudgements=attempts.map(e=>[e.result,e.correct,e.assessable,e.attemptNo]);
 // 채점 안 함: 말하기 시도는 정답 · 오답을 만들지 않는다.
 report.device1.samples={presented:presentations(remoteRows)[0],attempted:attempts[0],all:remoteRows.map(e=>e.type)};
 assert.equal(attempts.length,4,'센 시도는 넷(자동 피드백 · 스스로 확인 · 페이지를 떠난 자동 피드백 · 역할극)이다');
 assert.ok(attempts.every(e=>JSON.stringify(e).includes('unassessed')),'말하기 시도는 모두 채점 안 함이다');
 await one.context.close();
 // ⑥ 다른 기기(빈 저장소, 같은 가짜 서버): 받은 기록으로 「해 봤어요」가 붙는다.
 const two=await device('다른 기기');
 await start(two.page);consented=true;report.steps.push('다른 기기 입장');
 await openSpeaking(two.page);
 await two.page.waitForFunction(()=>window.SYNKLearningHost?.status?.()?.cursor>0,null,{timeout:45000}).catch(()=>{});
 report.device2.hostStatus=await two.page.evaluate(()=>window.SYNKLearningHost?.status?.()||null);
 await closeSheet(two.page);await openSpeaking(two.page);
 report.device2.list=await two.page.evaluate(()=>[...document.querySelectorAll('#panel-content .wsp-row')].map(n=>n.textContent.replace(/\s+/g,' ').trim().slice(0,60)));
 await two.page.screenshot({path:path.join(out,'다른기기-말하기목록.png')});
 report.device2.localLog=(await speakingLog(two.page)).length;assert.equal(report.device2.localLog,0,'다른 기기에는 기기 기록이 없다');
 const tried=report.device2.list.filter(row=>/해 봤어요/.test(row)).length;
 report.device2.triedRows=tried;assert.equal(tried,3,`다른 기기 말하기 목록에 계정 기록으로 「해 봤어요」가 1 · 4 · 5번에 붙는다: ${JSON.stringify(report.device2.list)}`);
 report.steps.push('다른 기기에서 「해 봤어요」 — 기기 기록 없이 계정 기록만으로');
 // ⑦ 다른 기기의 이번 주 계획: 시험 정보에서 말하기를 켜면(이 기기 설정) 계정 기록으로 말하기가 한 것으로 보이고 안 해 본 유형이 준다(1 · 4 · 5번을 함, 3번은 잘못 들음, 역할극은 유형이 아니다).
 await closeSheet(two.page);
 await two.page.locator('#settings-open').click();await two.page.locator('#panel-content .panel-actions .plain-button',{hasText:'학습 목표·도움 방식'}).click();await two.page.waitForSelector('#world-study-form');
 await two.page.locator('#world-study-form input[name="reason"][value="exam"]').check({force:true});
 await two.page.locator('#world-study-form input[name="examType"][value="topik1"]').check({force:true});
 await two.page.locator('#world-study-form [data-study-speaking]').waitFor({state:'visible'});
 await two.page.locator('#world-study-form input[name="speakingExam"]').check({force:true});
 if(!await two.page.locator('#world-study-form input[name="consent"]').isChecked())await two.page.locator('#world-study-form input[name="consent"]').check({force:true});
 await two.page.locator('#world-study-form button[type="submit"]').click();await two.page.waitForFunction(()=>!document.querySelector('#world-study-form'),null,{timeout:45000});
 await openPacks(two.page);await two.page.locator('#panel-content [data-view="plan"]').click();await two.page.waitForSelector('#panel-content [data-plan-board]');
 report.device2.planAreas=await two.page.evaluate(()=>[...document.querySelectorAll('#panel-content .wplan-areas li')].map(li=>`${li.dataset.area} ${li.querySelector('.wplan-area-count')?.textContent}`));
 report.device2.planSpeaking=(await two.page.locator('#panel-content [data-plan-speaking-section]').innerText()).replace(/\s+/g,' ');
 report.device2.planNext=await two.page.evaluate(()=>document.querySelector('#panel-content .wplan-next h3')?.textContent||null);
 await two.page.screenshot({path:path.join(out,'다른기기-계획판.png'),fullPage:false});
 assert.ok(report.device2.planAreas.some(row=>/^speaking 1 [/] 1$/.test(row)),`다른 기기 계획 판의 말하기 칸이 한 것으로 보인다: ${report.device2.planAreas}`);
 assert.match(report.device2.planSpeaking,/아직 말해 보지 않은 유형이 3개/,'다른 기기에서도 해 본 유형(1 · 4 · 5번)이 빠진다');
 report.steps.push('다른 기기 계획 판 — 말하기 1/1 · 안 해 본 유형 3개');
 await two.context.close();
 report.errors=errors;report.consoleErrors=consoleErrors;report.unexpected=[...new Set(unexpected)];report.blocked=[...new Set(blocked)].slice(0,30);
 assert.deepEqual(errors,[],'페이지 오류가 없다');
 report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack||String(error);report.errors=errors;report.consoleErrors=consoleErrors;report.unexpected=[...new Set(unexpected)];report.blocked=[...new Set(blocked)].slice(0,30);report.serverRowsAtFailure=wasSpeaking(remoteRows).map(brief);exitCode=1;
 try{for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:path.join(out,'실패.png')});}catch{}
}finally{
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,1)+'\n');
 await browser.close().catch(()=>{});if(server){server.kill();}
}
console.log(JSON.stringify({ok:report.ok,failure:report.failure?.split('\n').slice(0,3),steps:report.steps,out,talkHead,errors:report.errors,consoleErrors:report.consoleErrors,unexpected:report.unexpected,blocked:report.blocked},null,1));
process.exit(exitCode);
