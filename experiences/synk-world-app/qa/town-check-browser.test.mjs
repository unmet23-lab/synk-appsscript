import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createAccountTownHost} from '../town-host.mjs';
import {emptyPlayState} from '../../play-common/play-data.mjs';

// 싱크타운 「마을 준비 확인」을 실제 Chrome·계정 모드 WORLD에서 끝까지 — 학습·개인화 다리 설계 §4-2.
// 서버 판정(SYNK-talk town-entry-r1)은 가짜 서버가 흉내만 낸다(보낸 답의 영역·맞힘을 세어 읽기 6 중 4 ∧ 듣기 4 중 3). 판정 규칙 자체는 talk 시험이 본다.
// 캡처는 SYNK_TOWN_CHECK_SHOTS 폴더(없으면 임시 폴더)에 `<판>/<폭>/<이름>.png`(+ 화면 글 .txt) 꼴로 390·1440 두 폭을 남긴다 — tools/검수묶음.mjs
// `--캡처`가 받는 꼴이다. SYNK_TOWN_CHECK_STAGE=전이면 바뀌기 전 판에서 잠긴 시트만 찍는다(검수의 전후 비교). 실제 Chrome이 필요해 CI에서는 건너뛴다.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);
let playwright=null;try{playwright=require('playwright');}catch{try{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}catch{playwright=null;}}
const skip=process.env.CI?'실제 Chrome·소리 파일이 필요한 화면 확인 — CI에서는 건너뛴다':!playwright&&'Playwright가 없다';
const A='11111111-1111-4111-8111-111111111111';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const bank=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/world-topik-items.json'),'utf8'));
const correctOf=new Map(bank.items.map(row=>[row.id,`topik-items.${row.id}.v${row.rev}.option-${row.answer}`]));
const STAGE=process.env.SYNK_TOWN_CHECK_STAGE==='전'?'전':'후';
const NOTICE=/확인에 쓰는 연습 답만 보내요/;
const HANGUL_NUMBER=/\d+\s*(점|급|개 중|문제 중)|\d\s*\/\s*\d/;

async function scenario(t,{sync=false,gateReason='learning-check',trial=true,rateLimitMs=0,shots,tag}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-town-check-browser-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,env:{...process.env,SYNK_WORLD_PORT:String(port),SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')},stdio:'pipe'});
 let serverOutput='';server.stderr.on('data',chunk=>serverOutput+=chunk);server.stdout.on('data',chunk=>serverOutput+=chunk);
 const url=`http://127.0.0.1:${port}`,calls=[],errors=[];let browserServer,browser;
 t.after(async()=>{await browser?.close().catch(()=>{});await browserServer?.close().catch(()=>{});server.kill('SIGKILL');});
 for(let i=0;i<80;i++){try{const r=await fetch(url+'/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const town=createAccountTownHost({directory:path.join(directory,'fixture-town')}),binding={kind:'personal',classId:null,townId:null,learnerId:null,membershipRevision:null,sharing:{enabled:false,revision:0,since:null,blockedByLearningSharing:!sync}};
 const learning={enabled:sync,revision:1},learningEvents=[],playState=emptyPlayState();let playRevision=0;
 const gate={allowed:false,reason:gateReason,access:gateReason==='access'?null:null};let checks=0,hold=null,lastCheck=null;
 const view=()=>({ok:true,accountId:A,allowed:gate.allowed,access:gate.allowed?'trial':null,reason:gate.allowed?null:gate.reason,scopes:{base:gate.allowed,'first-chapter':gate.allowed,subscription:false},placement:null});
 // 가짜 판정: 보낸 답의 첫 답을 영역별로 세어(가장 최근) 읽기 6 중 4 ∧ 듣기 4 중 3이면 통과.
 function judge(answers=[]){
  const shown=new Map(answers.filter(e=>e.type==='practice.presented').map(e=>[e.id,e])),areas={reading:[],listening:[]};
  for(const e of answers)if(e.type==='practice.attempted'&&e.attemptNo===1){const p=shown.get(e.presentationId);if(p&&areas[p.measure.modality])areas[p.measure.modality].push(e.choice?.selectedId===e.choice?.correctId);}
  const ok=(list,take,need)=>list.length>=take&&list.slice(-take).filter(Boolean).length>=need;
  const missing=['reading','listening'].filter(area=>!(area==='reading'?ok(areas.reading,6,4):ok(areas.listening,4,3)));
  return {missing,passed:!missing.length};
 }
 browserServer=await playwright.chromium.launchServer({channel:'chrome',headless:true,timeout:30000});browser=await playwright.chromium.connect(browserServer.wsEndpoint());
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});context.setDefaultTimeout(30000);
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();return route.abort('blockedbyclient');});
 await context.route('https://synk.im/account/client.html**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>fixture</title>'}));
 await context.addInitScript(()=>{if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));});
 await context.route(config.accountApiUrl+'/**',async route=>{
  const req=route.request(),target=new URL(req.url()),body=req.postDataJSON();calls.push({path:target.pathname,method:req.method(),body});let data={ok:true};
  if(target.pathname.endsWith('/synk-account'))data=body?{ok:true,refreshRevoked:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning,capabilities:{learningSync:true},sessions:[{id:A,current:true,revoked:false,product:'world'}]};
  else if(target.pathname.endsWith('/synk-play'))data=body?{ok:true,scope:'synk-play',accountId:A,revision:++playRevision,state:structuredClone(playState)}:{ok:true,scope:'synk-play',accountId:A,revision:playRevision,state:structuredClone(playState)};
  else if(target.pathname.endsWith('/synk-learning')){
   assert.equal(learning.enabled,true,'an account with learning sync off never uploads learning events');
   if(target.searchParams.get('view')==='memory'||body?.memory)data={ok:true,revision:learning.revision,entries:body?.memory||[]};
   else if(body?.events){learningEvents.push(...body.events);data={ok:true,revision:learning.revision,accepted:body.events.map(e=>e.id)};}
   else data={ok:true,revision:learning.revision,events:learningEvents,cursor:learningEvents.length,hasMore:false};
  }
  else if(target.pathname.endsWith('/synk-world-v1/bootstrap'))data={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[],activeRun:null};
  else if(target.pathname.endsWith('/synk-town/entry'))data=view();
  else if(target.pathname.endsWith('/synk-town/check')){
   checks++;if(hold)await hold.promise;
   assert.deepEqual(Object.keys(body||{}).filter(k=>!['bankHash','sound','answers'].includes(k)),[]);
   // 서버의 30초 규칙(rateLimitMs): 같은 입력이면 지난 결과, 30초 안에 다른 입력이면 지난 결과 + retryAfterMs.
   const key=JSON.stringify(body.answers||[])+'|'+learningEvents.length,since=lastCheck?Date.now()-lastCheck.at:Infinity;
   if(rateLimitMs&&lastCheck&&(lastCheck.key===key||since<rateLimitMs))data={...lastCheck.data,...(lastCheck.key===key?{}:{retryAfterMs:rateLimitMs-since})};
   else{
    // 확인을 이미 마친 계정(access)은 서버처럼 그대로 통과다. trial=false면 통과해도 체험이 생기지 않는다(체험을 이미 쓴 계정).
    const result=gate.reason==='learning-check'?judge([...(body.answers||[]),...(sync?learningEvents:[])]):{missing:[],passed:true};
    if(result.passed&&gate.reason==='learning-check'){if(trial){gate.allowed=true;gate.reason=null;}else gate.reason='access';}
    data={...view(),outcome:result.passed?'passed':'not-yet',missing:result.missing};lastCheck={at:Date.now(),key,data};
   }
  }
  else if(target.pathname.includes('/synk-town/')){const operation=target.pathname.split('/').at(-1),reply=town.handle(A,operation,req.method(),body);data={...reply.body,ok:true,accountId:A,binding};}
  else if(target.pathname.endsWith('/synk-personal')){await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'PRODUCT_FORBIDDEN'}}),headers:{'Access-Control-Allow-Origin':'*'}});return;}
  else if(target.pathname.endsWith('/functions/v1/synk-classroom/api/world/homework'))data={ok:true,mode:'account-linked',accountId:A,classes:[],emptyReason:'NO_CLASS'};
  else if(target.pathname.endsWith('/synk-classroom/api/classes'))data={ok:true,mode:'account-linked',classes:[],learnerId:null,staffId:null};
  else if(target.pathname.endsWith('/functions/v1/classroom')){await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({contract_ver:'c16',ok:false,error:{code:'AUTH_REQUIRED',message:'다시 로그인해 주세요',retryable:false}}),headers:{'Access-Control-Allow-Origin':'*'}});return;}
  else if(!target.pathname.startsWith('/auth/v1/logout'))throw Error('Unexpected fixture endpoint '+target.pathname);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 // 두 폭으로 찍는다(390 기본, 1440은 잠깐 넓혀서).
 async function shot(name){
  for(const [width,height] of [[390,844],[1440,900]]){
   const folder=path.join(shots,STAGE,String(width));fs.mkdirSync(folder,{recursive:true});
   await page.setViewportSize({width,height});await page.waitForTimeout(200);
   await page.screenshot({path:path.join(folder,`${tag}-${name}.png`),fullPage:true});
   fs.writeFileSync(path.join(folder,`${tag}-${name}.txt`),await page.evaluate(()=>document.body.innerText));
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 }
 await page.goto(url+'/world/?opening=off',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
 // 첫 진입: 화면 언어(한국어) → 「한글을 읽을 수 있어요?」(읽어요) → 튜터 고르기(account-browser.test.mjs와 같다).
 const entryReady=()=>document.querySelector('.world-shell')?.dataset.entry==='ready';
 await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('.tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
 if(await page.locator('[data-lang-picker]').count()){await page.locator('[data-lang-choice="ko"]').click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
 await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
 if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}
 await page.waitForFunction(()=>document.querySelector('.tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
 if(await page.locator('.tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();}
 await page.waitForFunction(entryReady);
 return {page,shot,calls,errors,gate,learningEvents,checks:()=>checks,holdNext(){let release;const promise=new Promise(r=>release=r);hold={promise,release:()=>{hold=null;release();}};return hold;}};
}
async function openTown(page){await page.locator('.world-nav [data-view="play"]').click();await page.locator('[data-world="town"]').click();await page.locator('.ws-town').waitFor();}
async function solveCheck(page,{right=true}={}){
 for(let i=0;i<20;i++){
  if(await page.locator('[data-town-done]').count())return;
  const run=page.locator('[data-position-run]');if(!await run.count()){await page.waitForTimeout(200);continue;}
  const id=await run.getAttribute('data-position-run'),listen=page.locator('[data-position-listen]');
  if(await listen.count()){await listen.click();await page.locator('[data-position-choice]:not([disabled])').first().waitFor();}
  const correct=correctOf.get(id),choices=await page.locator('[data-position-choice]').evaluateAll(nodes=>nodes.map(n=>n.dataset.positionChoice));
  const pickId=right?correct:choices.find(c=>c!==correct);
  await page.locator(`[data-position-choice="${pickId}"]`).click();
  await page.waitForFunction(previous=>document.querySelector('[data-position-run]')?.dataset.positionRun!==previous||!!document.querySelector('[data-town-done],[data-town-wait]'),id);
 }
 await page.locator('[data-town-done]').waitFor();
}

test('동기화를 끈 학습자: 잠긴 시트가 이유를 나눠 알리고, 준비 확인을 마치면 마을이 열린다(390·1440 캡처)',{timeout:300000,skip},async t=>{
 const shots=process.env.SYNK_TOWN_CHECK_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'synk-town-check-shots-'));console.log('town check shots: '+shots);
 const s=await scenario(t,{sync:false,shots,tag:'off'});const {page}=s;
 await openTown(page);
 if(STAGE==='전'){await s.shot('locked');return;}
 const lead=await page.locator('#panel-content .ws-lead').textContent();assert.match(lead,/짧은 확인으로 열 수 있어요/);
 const sheet=await page.locator('#panel-content').textContent();
 assert.match(sheet,NOTICE);assert.match(sheet,/이 기기에서 푼 TOPIK 연습 답 가운데 확인에 쓰는 것만/);assert.doesNotMatch(sheet,/TOPIK 1급 이상|이용권이 필요해요/);assert.doesNotMatch(sheet,HANGUL_NUMBER);
 assert.equal(s.checks(),0,'with learning sync off nothing is sent before the learner starts');
 await s.shot('locked');
 const held=s.holdNext();await page.locator('[data-world="town-check"]').click();await page.locator('[data-town-wait]').waitFor();
 assert.doesNotMatch(await page.locator('[data-town-wait]').textContent(),/마을 준비 확인/,'the wait card does not repeat the panel title');await s.shot('wait');held.release();
 await page.locator('[data-position-run]').waitFor();
 assert.match(await page.locator('#panel-content').textContent(),/./);await s.shot('item-reading');
 // 읽기 여섯 뒤 첫 듣기 문항에서 한 장 더.
 for(let i=0;i<6;i++){const id=await page.locator('[data-position-run]').getAttribute('data-position-run');await page.locator(`[data-position-choice="${correctOf.get(id)}"]`).click();await page.waitForFunction(previous=>document.querySelector('[data-position-run]')?.dataset.positionRun!==previous,id);}
 assert.equal(await page.locator('[data-position-listen]').count(),1,'the four listening items follow the six reading items');await s.shot('item-listening');
 await solveCheck(page,{right:true});
 assert.equal(await page.locator('[data-town-done]').getAttribute('data-town-done'),'passed');
 const done=await page.locator('#panel-content').textContent();assert.match(done,/마을이 열렸어요/);assert.doesNotMatch(done.replace(/\s+/g,' '),HANGUL_NUMBER);
 await s.shot('passed');
 const sent=s.calls.filter(c=>c.path.endsWith('/synk-town/check'));assert.equal(sent.length,2);
 assert.ok(sent[1].body.answers.filter(e=>e.type==='practice.attempted').length>=10,'the second check carries the answers of this check');
 assert.ok(sent.every(c=>!JSON.stringify(c.body).includes('decision.made')),'no decision records are sent');
 await page.locator('[data-town-open]').click();await page.getByRole('button',{name:/내 차림으로 동네 열기/}).waitFor();await s.shot('open');
 assert.deepEqual(s.errors,[]);
});

test('준비 확인이 아직이면 숫자 없이 다시 볼 수 있다고 알리고 연습 하나를 권한다 — 「확인 그만하기」는 마을 시트로 돌아간다',{timeout:300000,skip:skip||STAGE==='전'&&'바뀌기 전 판에는 이 화면이 없다'},async t=>{
 const shots=process.env.SYNK_TOWN_CHECK_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'synk-town-check-shots-'));
 const s=await scenario(t,{sync:false,shots,tag:'notyet'});const {page}=s;
 await openTown(page);await page.locator('[data-world="town-check"]').click();await page.locator('[data-position-run]').waitFor();
 assert.equal((await page.locator('[data-position-stop]').textContent()).trim(),'확인 그만하기');
 await page.locator('[data-position-stop]').click();await page.locator('[data-world="town-check"]').waitFor();
 assert.match(await page.locator('#panel-content .ws-lead').textContent(),/짧은 확인으로 열 수 있어요/);
 await page.locator('[data-world="town-check"]').click();await page.locator('[data-position-run]').waitFor();
 await solveCheck(page,{right:false});
 assert.equal(await page.locator('[data-town-done]').getAttribute('data-town-done'),'not-yet');
 const done=await page.locator('#panel-content').textContent();assert.match(done,/조금 더 연습한 뒤에 다시 열어 볼 수 있어요/);assert.doesNotMatch(done.replace(/\s+/g,' '),HANGUL_NUMBER);
 assert.equal(await page.locator('[data-town-recheck]').count(),1);assert.ok(await page.locator('[data-town-recommend] [data-position-practice]').count()<=1);
 await s.shot('not-yet');assert.deepEqual(s.errors,[]);
});

test('확인은 마쳤는데 체험·이용권이 없으면 학습 미통과가 아니라 이용권 범위로 알린다',{timeout:180000,skip},async t=>{
 const shots=process.env.SYNK_TOWN_CHECK_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'synk-town-check-shots-'));
 const s=await scenario(t,{sync:false,gateReason:'access',shots,tag:'access'});const {page}=s;
 await openTown(page);if(STAGE==='전'){await s.shot('locked');return;}const sheet=await page.locator('#panel-content').textContent();
 assert.match(sheet,/체험이나 이용권으로 열리는 곳이에요/);assert.doesNotMatch(sheet,/준비 확인 시작|TOPIK|미통과/);assert.equal(await page.locator('[data-world="town-check"]').count(),0);
 await s.shot('locked');assert.deepEqual(s.errors,[]);
});

test('동기화를 켠 학습자: 시트를 열 때 서버에 모인 답으로 먼저 확인하고(답을 싣지 않고), 고지 줄이 없다',{timeout:180000,skip},async t=>{
 const shots=process.env.SYNK_TOWN_CHECK_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'synk-town-check-shots-'));
 const s=await scenario(t,{sync:true,shots,tag:'sync'});const {page}=s;
 await openTown(page);
 if(STAGE==='전'){await s.shot('locked');return;}
 const first=s.calls.find(c=>c.path.endsWith('/synk-town/check'));assert.ok(first,'opening the sheet checks the server once');assert.deepEqual(first.body.answers,undefined);
 const sheet=await page.locator('#panel-content').textContent();assert.doesNotMatch(sheet,NOTICE);assert.match(sheet,/짧은 확인으로 열 수 있어요/);
 await s.shot('locked');assert.deepEqual(s.errors,[]);
});

test('준비 확인을 통과했는데 체험·이용권이 없으면 미통과가 아니라 「마쳤어요」와 이용권 범위로 알린다(아르곤 A1)',{timeout:300000,skip:skip||STAGE==='전'&&'바뀌기 전 판에는 이 화면이 없다'},async t=>{
 const shots=process.env.SYNK_TOWN_CHECK_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'synk-town-check-shots-'));
 const s=await scenario(t,{sync:false,trial:false,shots,tag:'passaccess'});const {page}=s;
 await openTown(page);await page.locator('[data-world="town-check"]').click();await page.locator('[data-position-run]').waitFor();
 await solveCheck(page,{right:true});
 assert.equal(await page.locator('[data-town-done]').getAttribute('data-town-done'),'access');
 const done=await page.locator('#panel-content').textContent();assert.match(done,/마을 준비 확인은 마쳤어요/);assert.match(done,/체험이나 이용권으로 열리는 곳이에요/);
 assert.doesNotMatch(done,/조금 더 연습|마을이 열렸어요|확인 중/);assert.equal(await page.locator('[data-town-recheck]').count(),0);
 assert.equal(s.checks(),2);await s.shot('done');
 // 끝 화면에서 싱크타운 시트로 돌아가면 이용권 범위 시트다(Fable F3).
 await page.getByRole('button',{name:'싱크타운으로 돌아가기'}).click();await page.locator('.ws-town').waitFor();
 assert.match(await page.locator('#panel-content').textContent(),/체험이나 이용권으로 열리는 곳이에요/);assert.deepEqual(s.errors,[]);
});

test('동기화를 켠 학습자: 준비 확인을 마친 뒤 같은 확인을 조용히 다시 부르지 않는다(아르곤 A3)',{timeout:300000,skip:skip||STAGE==='전'&&'바뀌기 전 판에는 이 화면이 없다'},async t=>{
 const shots=process.env.SYNK_TOWN_CHECK_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'synk-town-check-shots-'));
 const s=await scenario(t,{sync:true,shots,tag:'syncnotyet'});const {page}=s;
 await openTown(page);await page.locator('[data-world="town-check"]').click();await page.locator('[data-position-run]').waitFor();
 await solveCheck(page,{right:false});assert.equal(await page.locator('[data-town-done]').getAttribute('data-town-done'),'not-yet');
 // 시트를 열 때 하나 · 시작할 때 하나 · 문항을 다 푼 뒤 하나. 동기화가 답을 다 올린 뒤에도 더 부르지 않는다.
 await page.waitForFunction(()=>{const state=window.SYNKLearningHost?.status?.();return !!state&&!state.queued&&['synced','idle'].includes(state.phase);},null,{timeout:20000});
 await page.waitForTimeout(2500);assert.equal(s.checks(),3);assert.deepEqual(s.errors,[]);
});

test('동기화를 켠 학습자: 시트를 연 직후 시작해도 30초 규칙에 멈추지 않고 바로 문항을 낸다(Fable F1)',{timeout:240000,skip:skip||STAGE==='전'&&'바뀌기 전 판에는 이 화면이 없다'},async t=>{
 const shots=process.env.SYNK_TOWN_CHECK_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'synk-town-check-shots-'));
 const s=await scenario(t,{sync:true,rateLimitMs:30000,shots,tag:'syncstart'});const {page}=s;
 await openTown(page);assert.equal(s.checks(),1,'opening the sheet checks once');
 // 확인 문항 하나를 풀고 그만둔다 — 이 기기에 첫 답이 생겨, 다시 시작할 때 실을 답이 시트 확인과 달라진다(서버가 30초 안이라
 // 지난 결과와 retryAfterMs를 주는 꼴). 고치기 전에는 여기서 남은 30초를 아무 말 없이 기다렸다.
 await page.locator('[data-world="town-check"]').click();await page.locator('[data-position-run]').waitFor();
 const id=await page.locator('[data-position-run]').getAttribute('data-position-run');
 await page.locator(`[data-position-choice="${correctOf.get(id)}"]`).click();
 await page.waitForFunction(previous=>document.querySelector('[data-position-run]')?.dataset.positionRun!==previous,id);
 await page.locator('[data-position-stop]').click();await page.locator('[data-world="town-check"]').waitFor();
 const started=Date.now();await page.locator('[data-world="town-check"]').click();await page.locator('[data-position-run]').waitFor({timeout:8000});
 assert.ok(Date.now()-started<8000,'the first item shows without waiting out the 30 second rule');
 const restart=s.calls.filter(c=>c.path.endsWith('/synk-town/check')).at(-1);
 assert.ok(restart.body.answers.some(e=>e.type==='practice.attempted'),'the restart carries this device\'s first answer, so the server rate-limits it');
 assert.deepEqual(s.errors,[]);
});
