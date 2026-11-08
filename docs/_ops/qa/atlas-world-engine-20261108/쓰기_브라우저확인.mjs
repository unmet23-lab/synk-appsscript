// 쓰기 연습을 말하기(E)와 같은 길로(2026-11-09) — 실제 브라우저 확인. 실제 Edge + 가짜 계정 서버 — 운영 계정 · 서버 · AI · 돈을 쓰지 않는다.
// 계정 모드 WORLD에서 쓰기 연습을 실제로 눌러 ① 규칙 점검 시도가 Trail에 「채점 안 함」으로 남아 동기화로 나가는지 ② **게임을 한 번 연 뒤에도**(계정 학습 통로가
// 새로 열린다 — prepareGame) 같은 페이지의 쓰기 점검이 계정에 남는지(다른 문항 · 앞에서 한 문항 둘 다) ③ 나간 사건을 **운영 서버와 같은 검증**(SYNK-talk origin/master의
// _shared/synk-atlas.js · validationNeeds → validateIncrement, E_브라우저확인.mjs와 같은 순서)이 받는지 ④ 페이지 오류가 없는지 본다.
//   node docs/_ops/qa/atlas-world-engine-20261108/쓰기_브라우저확인.mjs [--주소 https://synk.im/world/ [--덧씌움 <공개 후보 폴더>]] [--out <폴더>] [--talk <SYNK-talk 경로>]
// 주소가 없으면 이 작업본을 로컬 서버(계정 모드)로 띄운다. 주소를 주면 그 공개 파일을 읽기만 하고(GET만 통과, 나머지는 막는다) 계정 API는 모두 아래 가짜가 받는다.
// --덧씌움: 공개.js 미리 보기가 쓴 후보 폴더(candidate/ — 그 안의 world/…)의 파일 경로는 이 브라우저가 가로채 후보 바이트로 준다 — 공개 전 확인. 후보의 새 ?v= 주소는
// 쿼리와 상관없이 경로로 가로채 synk.im에 한 번도 닿지 않는다(현장 노트 배포_공개 「공개 전에 후보의 새 ?v= 주소를 synk.im에 부르면」).
// 결과는 사실(서버가 받은 쓰기 사건 수)을 먼저 적고 그다음 고친 동작을 단언한다 — 고치기 전 판에서는 ② 단언에서 멈추는 것이 결함 재현이다.
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
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'writing-trail-browser-'));
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

const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(fixtureConfig));
let server=null,serverOutput='';
if(!remote){
 server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talk,SYNK_WORLD_PORT:String(port),SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')}});
 server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 for(let i=0;;i++){try{if((await fetch(`http://127.0.0.1:${port}/world/health`)).ok)break;}catch{}if(i>120)throw Error(`서버가 뜨지 않았다: ${serverOutput.slice(-600)}`);await new Promise(r=>setTimeout(r,500));}
}
const base=remote?new URL(remote).href:`http://127.0.0.1:${port}/world/`,origin=new URL(base).origin;
// 덧씌울 후보 파일: 공개 경로(/world/…) → 바이트. 폴더 경로 /world/는 그 index.html이다.
const overlayDir=arg('--덧씌움'),overlay=new Map(),overlayServed=new Set();
if(overlayDir){
 if(!remote)throw Error('--덧씌움은 --주소와 함께 쓴다');
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
 for(const file of walk(path.resolve(overlayDir))){const relative=path.relative(path.resolve(overlayDir),file).split(path.sep).join('/');if(relative==='후보.json')continue;overlay.set(`/${relative}`,fs.readFileSync(file));if(relative.endsWith('/index.html'))overlay.set(`/${relative.slice(0,-'index.html'.length)}`,fs.readFileSync(file));}
 if(!overlay.size)throw Error(`덧씌울 파일이 없다: ${overlayDir}`);
}
const TYPES={'.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'};
const jsonOf=async url=>{const response=await fetch(url);if(!response.ok)throw Error(`${url}: ${response.status}`);return response.json();};
const identity=remote?new URL((await jsonOf(new URL('world-config.json',base).href)).account.accountApiUrl).origin:new URL(fixtureConfig.accountApiUrl).origin;
const bank=await jsonOf(new URL('world-writing-items.json',base).href);
const openItems=bank.items.filter(i=>i?.review?.status==='passed');
const firstOf=type=>openItems.find(i=>i.type===type);
const W51=firstOf(51),W52=firstOf(52),W53=firstOf(53);
assert.ok(W51&&W52&&W53,'열린 51 · 52 · 53번 문항이 있다');

// 가짜 계정 서버. 사건 수락은 운영 서버와 같은 순서로 검증한다.
const remoteRows=[],posted=[],rejected=[],writingCalls=[],unexpected=[],blocked=[],errors=[],consoleErrors=[],playState=emptyPlayState();
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
 // 쓰기 자동 피드백은 이 확인의 대상이 아니다 — 꺼진 상태(규칙 점검만)로 둔다.
 if(target.pathname.startsWith('/functions/v1/world-writing')){writingCalls.push(body?.action);data={ok:true,accountId:A,enabled:false,dailyLimit:0,bankHash:bank.contentHash};}
 else if(target.pathname.startsWith('/functions/v1/world-speaking'))data={ok:true,accountId:A,enabled:false,dailyLimit:0,remaining:0};
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

const browser=await playwright.chromium.launch({channel:process.platform==='win32'?'msedge':'chrome',headless:true,timeout:30000});
async function device(name){
 const context=await browser.newContext({viewport:VIEW,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});context.setDefaultTimeout(30000);
 await context.route('**/*',route=>{const req=route.request(),target=new URL(req.url());
  if(target.origin===origin&&overlay.has(target.pathname)&&['GET','HEAD'].includes(req.method())){overlayServed.add(target.pathname);const file=target.pathname.endsWith('/')?'index.html':target.pathname;
   return route.fulfill({status:200,headers:{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'},body:overlay.get(target.pathname)});}
  if(target.origin===origin&&(['GET','HEAD'].includes(req.method())))return route.continue();blocked.push(`${name} ${req.method()} ${target.origin}${target.pathname}`);return route.abort('blockedbyclient');});
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
const openWriting=async page=>{await openPacks(page);await page.locator('#panel-content [data-world="writing"]').waitFor({state:'visible',timeout:30000});await page.locator('#panel-content [data-world="writing"]').click();await page.waitForSelector('#panel-content .ww-list-view');};
// 문항 하나를 열어 칸을 채우고 규칙 점검을 누른다(51 · 52는 빈칸 둘, 53 · 54는 글 칸). 점검 결과 제목이 그려질 때까지 기다린다.
const SENTENCE='저는 주말마다 도서관에서 책을 읽습니다.';
async function checkItem(page,item,text=SENTENCE){
 await page.locator(`#panel-content [data-ww-open="${item.id}"]`).first().click();await page.waitForSelector(`#panel-content .ww-task[data-type="${item.type}"]`);
 if(item.type<=52)for(const blank of await page.locator('#panel-content [data-ww-blank]').all())await blank.fill(text);
 else await page.locator('#panel-content [data-ww-text]').fill(Array.from({length:Math.ceil(item.min/text.length)+1},()=>text).join(' '));
 await page.locator('#panel-content [data-ww-check]').click();await page.waitForSelector('#panel-content [data-ww-results] h3');
 await page.locator('#panel-content [data-ww-back]').click();await page.waitForSelector('#panel-content .ww-list-view');
}
const flushed=async page=>{await page.evaluate(async()=>{await window.SYNKLearningHost?.flush?.();});await page.waitForFunction(()=>{const s=window.SYNKLearningHost?.status?.();return s&&!s.queued&&['synced','idle'].includes(s.phase);},null,{timeout:45000});};
const presentations=rows=>rows.filter(e=>e.type==='practice.presented'&&/^writing\./.test(e.itemKey||''));
const attemptsOf=(rows,item)=>{const ids=new Set(presentations(rows).filter(e=>e.itemKey===`writing.${item.id}`).map(e=>e.id));return rows.filter(e=>e.type==='practice.attempted'&&ids.has(e.presentationId));};
const writingRows=rows=>{const ids=new Set(presentations(rows).map(e=>e.id));return rows.filter(e=>ids.has(e.id)||ids.has(e.presentationId));};
const brief=e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['id','at','scope','v','version','schema','ts','context','subject','learnerKey'].includes(k)));
const ruleChecks=page=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('synk.world.writing.v1:')).flatMap(k=>(JSON.parse(localStorage.getItem(k)).log||[]).filter(e=>e.source==='rule-check')).length);

const report={base,identity,talkHead,items:{w51:W51.id,w52:W52.id,w53:W53.id},steps:[],facts:{}};
let exitCode=0;
try{
 const one=await device('첫 기기');
 const page=one.page;
 await start(page);report.steps.push('입장');
 await page.waitForFunction(()=>window.SYNKLearningHost,null,{timeout:45000}).catch(()=>{});
 report.facts.hostAtStart=await page.evaluate(()=>!!window.SYNKLearningHost);
 await openWriting(page);report.steps.push('쓰기 목록');
 // ① 게임 전: 51번 점검 → 시도 하나가 서버까지
 await checkItem(page,W51);await flushed(page);
 report.facts.beforeGame={w51:attemptsOf(remoteRows,W51).length,ruleChecks:await ruleChecks(page)};
 assert.equal(report.facts.beforeGame.w51,1,'게임 전 51번 점검 시도 하나가 서버까지 간다');
 report.steps.push(`게임 전 ${W51.id} 점검 → 서버 시도 1`);
 // ② 게임을 열고 닫는다 — 계정 학습 통로가 새로 열린다(prepareGame, E_브라우저확인 ②-1과 같은 길).
 await closeSheet(page);
 await page.evaluate(()=>{window.__hostBefore=window.SYNKLearningHost;const b=document.createElement('button');b.dataset.worldGame='rhythm';b.hidden=true;document.body.append(b);b.click();b.remove();});
 await page.waitForSelector('.game-frame',{state:'attached',timeout:60000});
 report.facts.hostReplaced=await page.evaluate(()=>!!window.SYNKLearningHost&&window.SYNKLearningHost!==window.__hostBefore);
 assert.equal(report.facts.hostReplaced,true,'게임을 열면 통로가 새로 열린다');
 await closeSheet(page);await openWriting(page);report.steps.push('게임을 열고 닫아 계정 통로가 새로 열림');
 // ③ 게임 뒤: 다른 문항(52번) · 앞에서 한 문항(51번 다시) 점검
 await checkItem(page,W52);await checkItem(page,W51,'다시 써 보면 문장이 더 자연스럽습니다.');
 await page.waitForFunction(()=>window.SYNKLearningHost,null,{timeout:45000});await flushed(page);
 report.facts.afterGame={w52:attemptsOf(remoteRows,W52).length,w51:attemptsOf(remoteRows,W51).length,w51Presentations:presentations(remoteRows).filter(e=>e.itemKey===`writing.${W51.id}`).length,ruleChecks:await ruleChecks(page)};
 report.facts.serverRows=writingRows(remoteRows).map(brief);
 report.facts.rejected=rejected.map(r=>r.message);
 assert.equal(rejected.length,0,`운영 서버 검증이 거절한 묶음: ${JSON.stringify(report.facts.rejected)}`);
 assert.equal(report.facts.afterGame.ruleChecks,3,'이 기기 기록에는 점검 셋이 다 있다(화면은 그대로 돈다)');
 assert.equal(report.facts.afterGame.w52,1,'게임을 연 뒤의 52번 점검도 서버까지 간다');
 assert.equal(report.facts.afterGame.w51,2,'게임을 연 뒤 51번을 다시 점검한 시도도 서버까지 간다');
 report.steps.push('게임 뒤 52번 · 51번 다시 점검 → 서버 시도 둘');
 const attempts=writingRows(remoteRows).filter(e=>e.type==='practice.attempted');
 assert.ok(attempts.every(e=>JSON.stringify(e).includes('unassessed')),'쓰기 시도는 모두 채점 안 함이다');
 await page.screenshot({path:path.join(out,'쓰기목록.png')});
 await one.context.close();
 report.errors=errors;report.consoleErrors=consoleErrors;report.unexpected=[...new Set(unexpected)];report.blocked=[...new Set(blocked)].slice(0,30);report.writingCalls=writingCalls;
 assert.deepEqual(errors,[],'페이지 오류가 없다');
 if(overlay.size){report.overlayServed=[...overlayServed].sort();for(const must of ['/world/app-shell.mjs','/world/world-writing-practice.mjs'])assert.ok(overlayServed.has(must),`후보 파일을 덧씌워 읽었다: ${must}`);}
 report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack||String(error);report.errors=errors;report.consoleErrors=consoleErrors;report.unexpected=[...new Set(unexpected)];report.blocked=[...new Set(blocked)].slice(0,30);report.facts.serverRowsAtFailure=writingRows(remoteRows).map(brief);report.facts.rejectedAtFailure=rejected.map(r=>r.message);exitCode=1;
 try{for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:path.join(out,'실패.png')});}catch{}
}finally{
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,1)+'\n');
 await browser.close().catch(()=>{});if(server){server.kill();}
}
console.log(JSON.stringify({ok:report.ok,failure:report.failure?.split('\n').slice(0,3),steps:report.steps,facts:{hostAtStart:report.facts.hostAtStart,beforeGame:report.facts.beforeGame,hostReplaced:report.facts.hostReplaced,afterGame:report.facts.afterGame},overlayServed:report.overlayServed,out,talkHead,errors:report.errors,consoleErrors:report.consoleErrors,unexpected:report.unexpected,blocked:report.blocked},null,1));
process.exit(exitCode);
