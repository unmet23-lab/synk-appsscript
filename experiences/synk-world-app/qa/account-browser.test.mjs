import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createAccountTownHost} from '../town-host.mjs';
import {emptyPlayState} from '../../play-common/play-data.mjs';
import {awardMiniGame} from '../../korean-racing/garage-core.js';
import {LESSONS} from '../life-content.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const A='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const sanitized=value=>Array.isArray(value)?value.map(sanitized):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/token|authorization|secret|password/i.test(key)?'[redacted test credential]':sanitized(item)])):value;
test('actual Chromium account-mode Maru preserves life progress, guarded games, Town, enrollment and logout',{timeout:180000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-account-browser-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const publicPayload=process.env.SYNK_WORLD_PUBLIC_PAYLOAD?path.resolve(process.env.SYNK_WORLD_PUBLIC_PAYLOAD):null;
 const runtimeConfig=publicPayload?JSON.parse(fs.readFileSync(path.join(publicPayload,'world-config.json'),'utf8')).account:config;
 const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4','.mp3':'audio/mpeg'};
 const server=publicPayload?http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({mode:'account',database:null,rehearsal:false,static:true}));return;}if(!url.pathname.startsWith('/world/')){res.writeHead(404).end();return;}let rel=decodeURIComponent(url.pathname.slice('/world/'.length));if(!rel||rel.endsWith('/'))rel+='index.html';const target=path.resolve(publicPayload,rel),within=path.relative(publicPayload,target);if(within.startsWith('..')||path.isAbsolute(within)||!fs.existsSync(target)){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);}):spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,env:{...process.env,SYNK_WORLD_PORT:String(port),SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')},stdio:'pipe'});
 if(publicPayload)await new Promise(r=>server.listen(port,'127.0.0.1',r));
 let serverOutput='';server.stderr?.on('data',chunk=>serverOutput+=chunk);server.stdout?.on('data',chunk=>serverOutput+=chunk);
 const url=`http://127.0.0.1:${port}`,calls=[],errors=[],external=[],assetErrors=[];let browserServer,browser,page,output;
 t.signal.addEventListener('abort',()=>{browserServer?.process()?.kill('SIGKILL');server.kill?.('SIGKILL');server.closeAllConnections?.();server.close?.();},{once:true});
 async function waitServer(){for(let i=0;i<80;i++){if(server.exitCode!==undefined&&server.exitCode!==null)throw Error(serverOutput);try{const r=await fetch(url+'/health');if(r.ok)return await r.json();}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('server start timeout '+serverOutput);}
 const town=createAccountTownHost({directory:path.join(directory,'fixture-town')}),binding={kind:'academy',classId:C,townId:C,learnerId:A,membershipRevision:1,sharing:{enabled:false,revision:1,blockedByLearningSharing:false}};
 let learning={enabled:false,revision:1},playRevision=0,conflictNext=false,conflictInjected=false,classroomLinked=false;const playState=emptyPlayState(),playCommands=new Map(),learningEvents=[];
 const snapshot={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
 const lifeKey='synk.life-korean.progress.v1',lifeEvidence={};
 try{
  const health=await waitServer();assert.equal(health.mode,'account');assert.equal(health.database,null);assert.equal(health.rehearsal,false);
  assert.equal((await fetch(url+'/api/world/rehearsal/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountKey:'player-a'})})).status,404);
  browserServer=await playwright.chromium.launchServer({channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache'],timeout:30000});browser=await playwright.chromium.connect(browserServer.wsEndpoint());
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});context.setDefaultTimeout(20000);
  // Only the isolated static server and the exact fixtures below may receive traffic.
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
  await context.route('https://synk.im/account/client.html**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>fixture central account</title><p>Fixture central account entrance</p>'}));
  await context.addInitScript(()=>{if(window.top===window){globalThis.__qaWorldBoot=crypto.randomUUID();window.addEventListener('pageshow',event=>{if(event.persisted)sessionStorage.setItem('synk.qa.bfcache-persisted','1');});}if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));});
  await context.route(new URL(runtimeConfig.accountApiUrl).origin+'/**',async route=>{
   const req=route.request(),target=new URL(req.url()),body=req.postDataJSON();calls.push({path:target.pathname,classId:target.searchParams.get('classId'),method:req.method(),body});let data={ok:true};
   if(target.pathname.endsWith('/synk-account')){if(body?.action==='learning-consent')learning={enabled:body.enabled,revision:learning.revision+1};data=body?{ok:true,refreshRevoked:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning,capabilities:{learningSync:true},sessions:[{id:C,current:true,revoked:false,product:'world'}]};}
   else if(target.pathname.endsWith('/synk-play')){
    if(body?.action==='progress'&&conflictNext&&!conflictInjected){conflictInjected=true;playState.records['synk.windrun.best']='777';playRevision++;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'REVISION_CONFLICT',message:'다른 기기에서 진도가 바뀌었어요.'}}),headers:{'Access-Control-Allow-Origin':'*'}});return;}
    if(body){assert.equal(typeof body.id,'string');if(playCommands.has(body.id))data=playCommands.get(body.id);else{
     let result;
     if(body.action==='progress'){for(const change of body.changes){assert.equal(playState.records[change.key]??null,change.previous);if(change.value===null)delete playState.records[change.key];else playState.records[change.key]=change.value;}}
     else{assert.equal(body.action,'wallet');assert.equal(body.method,'awardMiniGame');result=awardMiniGame(playState.wallet,body.args[0]);playState.wallet=result.state;}
     data={ok:true,scope:'synk-play',accountId:A,revision:++playRevision,state:structuredClone(playState),...(result?{result}:{})};playCommands.set(body.id,data);
    }}else data={ok:true,scope:'synk-play',accountId:A,revision:playRevision,state:structuredClone(playState)};
   }
   else if(target.pathname.endsWith('/synk-learning')){
    assert.equal(learning.enabled,true,'disabled learning consent must never send learning or memory');
    if(target.searchParams.get('view')==='memory'||body?.memory)data={ok:true,revision:learning.revision,entries:body?.memory||[]};
    else if(body?.events){learningEvents.push(...body.events);data={ok:true,revision:learning.revision,accepted:body.events.map(event=>event.id)};}
    else data={ok:true,revision:learning.revision,events:learningEvents,cursor:learningEvents.length,hasMore:false};
   }
   else if(target.pathname.endsWith('/synk-world-v1/bootstrap'))data=snapshot;
   else if(target.pathname.endsWith('/synk-town/entry'))data={ok:true,accountId:A,allowed:true,entryVerified:true,access:'trial'};
   else if(target.pathname.includes('/synk-town/')){const operation=target.pathname.split('/').at(-1),reply=town.handle(A,operation,req.method(),body);data={...reply.body,ok:true,accountId:A,binding};}
   else if(target.pathname.endsWith('/town/sharing')){binding.sharing={...binding.sharing,enabled:body.enabled,revision:binding.sharing.revision+1};data={ok:true,sharing:binding.sharing};}
   else if(target.pathname.endsWith('/enrollment/preview'))data={ok:true,invite:{className:'합성 해바라기반',learnerLabel:'합성 학생 1',expiresAt:new Date(Date.now()+3600000).toISOString()}};
   else if(target.pathname.endsWith('/enrollment/claim')){classroomLinked=true;data={ok:true,linked:true,classId:C,learnerId:A,sharing:{enabled:false,revision:1},townSharing:{enabled:false,revision:1}};}
   else if(target.pathname.endsWith('/functions/v1/classroom')){
    // 「우리 반 수업」(내 계정 시트): 반을 잇기 전 계정은 학생 명부에 없어 실제 classroom 함수가 401 AUTH_REQUIRED, 이은 뒤에는 영상 이용권 전이라 빈 목록이다.
    assert.equal(req.method(),'GET');assert.equal(target.search,'');assert.equal((await req.allHeaders())['x-contract-ver'],'c16');
    if(!classroomLinked){await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({contract_ver:'c16',ok:false,error:{code:'AUTH_REQUIRED',message:'다시 로그인해 주세요',retryable:false}}),headers:{'Access-Control-Allow-Origin':'*'}});return;}
    data={contract_ver:'c16',ok:true,classes:[],empty_reason:'NO_ACTIVE_CLASS_ACCESS',server_time:new Date().toISOString()};
   }
   else if(target.pathname.endsWith('/synk-personal')){
    // WORLD reads the 「내 성향」 topic answers read-only. Today's account server keeps synk-personal to the
    // platform and refuses it; that refusal must leave the account signed in and practice going.
    assert.equal(req.method(),'GET');assert.equal(target.searchParams.get('resource'),'member-understanding');assert.equal(body,null);
    await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'PRODUCT_FORBIDDEN'}}),headers:{'Access-Control-Allow-Origin':'*'}});return;
   }
   else if(!target.pathname.startsWith('/auth/v1/logout'))throw Error('Unexpected fixture endpoint '+target.pathname);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().startsWith(new URL(runtimeConfig.accountApiUrl).origin))assetErrors.push({url:r.url(),status:r.status()});});page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith(new URL(runtimeConfig.accountApiUrl).origin)&&!r.url().startsWith('https://synk.im/account/client.html')&&!r.url().startsWith('data:'))external.push(r.url());});
  await page.goto(url+'/world/?opening=off',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
  assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot.accountId),A);assert.equal(await page.evaluate(()=>window.__synkHome.isMaru),true);
  // First visit asks for an AI tutor (10-12 gate). Choose one so the home becomes interactive.
  // 10-19: 「한글을 읽을 수 있어요?」 comes first (first-run.mjs); this account answers that it reads Hangul.
  await passHangulStep();
  await page.waitForFunction(()=>document.querySelector('.tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('.tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');}
  // 「나」 moved from the tab bar to the profile capsule in the 10-14 redesign (same data-view="me").
  await page.locator('.profile-control[data-view="me"]').click();assert.equal(await page.locator('#world-classroom-entry').getByRole('heading',{name:'내 반 연결'}).count(),1);
  // 반이 없는 계정의 수업 조회 401은 빈 칸일 뿐 로그아웃이 아니다(아래 동의·반 연결이 같은 계정으로 이어진다).
  await page.locator('#world-classroom-lessons .ws-class[data-state="empty"]').waitFor();assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot?.accountId),A);
  assert.equal(await page.locator('[data-world-learning]').isChecked(),false);await page.locator('[data-world-learning]').check();await page.waitForFunction(()=>document.querySelector('[data-world-learning]')?.checked&&!document.querySelector('[data-world-learning]')?.disabled);assert.ok(calls.some(c=>c.body?.action==='learning-consent'&&c.body.enabled===true));
  assert.equal(await page.locator('a[href="https://synk.im/account/client.html?product=world"]').count(),1);
  await page.locator('[name="invite"]').fill('synthetic_invite_1234567890123456');await page.getByRole('button',{name:'이름과 반 확인'}).click();await page.getByRole('button',{name:'이 계정으로 내 반 연결'}).waitFor();assert.equal(calls.some(c=>c.path.endsWith('/enrollment/claim')),false);
  await page.getByRole('button',{name:'이 계정으로 내 반 연결'}).click();await page.waitForFunction(()=>window.__synkWorld.screen()==='world-profile'&&document.querySelector('[name="invite"]')?.value==='');assert.equal(calls.filter(c=>c.path.endsWith('/enrollment/claim')).length,1);
  const claimIndex=calls.findIndex(c=>c.path.endsWith('/enrollment/claim')),askedAfterClaim=()=>calls.slice(claimIndex).some(c=>c.path.endsWith('/functions/v1/classroom'));
  for(let i=0;i<100&&!askedAfterClaim();i++)await new Promise(r=>setTimeout(r,50));
  assert.ok(askedAfterClaim(),'반을 이은 뒤 시트를 다시 그리며 우리 반 수업을 다시 묻는다');await page.locator('#world-classroom-lessons .ws-class[data-state="empty"]').waitFor();
  await page.locator('#panel-close').click();
  const beforeBackBoot=await page.evaluate(()=>globalThis.__qaWorldBoot);
  await page.goto('https://synk.im/account/client.html?product=world',{waitUntil:'domcontentloaded'});
  await page.goBack({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
  const actualBfcache=await page.evaluate(()=>sessionStorage.getItem('synk.qa.bfcache-persisted')==='1');
  assert.notEqual(await page.evaluate(()=>globalThis.__qaWorldBoot),beforeBackBoot);
  if(!actualBfcache){const boot=await page.evaluate(()=>globalThis.__qaWorldBoot);await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await page.waitForFunction(previous=>globalThis.__qaWorldBoot!==previous&&window.__synkWorld?.client.status==='ready',boot);}
  await page.locator('.world-nav [data-view="play"]').click();await page.locator('[data-world="town"]').click();await page.locator('[data-town-sharing]').waitFor();assert.equal(await page.locator('[data-town-sharing]').isChecked(),false);await page.locator('[data-town-sharing]').check();await page.waitForFunction(()=>document.querySelector('[data-town-sharing]')?.checked&&!document.querySelector('[data-town-sharing]')?.disabled);
  await page.getByRole('button',{name:/내 차림으로 동네 열기/}).click();await page.waitForFunction(()=>!!document.querySelector('iframe'));
  const frame=()=>page.frames().find(f=>f.url().includes('/town/day.html'));await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.SYNKTownDay?.metrics().connected);
  assert.equal(await frame().evaluate(()=>SYNKTownDay.metrics().worldLinked),true);assert.ok(calls.some(c=>c.path.endsWith('/synk-town/state')));assert.ok(calls.some(c=>c.path.endsWith('/synk-town/presence')&&c.classId===C));
  const exposed=await page.evaluate(()=>Object.keys(window.SYNKWorldTownHost));assert.deepEqual(exposed,['appearance','subscribe','refresh','request','dispose']);
  output=path.join(root,'experiences/synk-world-app/qa/life-content-20261010',publicPayload?'account-static'+(path.basename(path.dirname(publicPayload)).match(/-r\d+$/)?.[0]||'-current'):'account-source');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'town-mobile.png')});
  await page.evaluate(()=>window.__synkWorld.client.logout());assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot),null);assert.equal(await page.evaluate(()=>window.SYNKWorldTownHost),undefined);
  // Restore an actual verified browser account after sign-out, including a historical stale marker.
  await page.evaluate(()=>{sessionStorage.setItem('synk-world-v1-signed-out','1');sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-fresh-login',refresh_token:null,expires_at:Date.now()+3600000}));});
  await page.evaluate(()=>window.__synkWorld.client.restore());assert.equal(await page.evaluate(()=>sessionStorage.getItem('synk-world-v1-signed-out')),null);
  const beforeReopen=calls.length;await page.locator('.world-nav [data-view="play"]').click();await page.locator('[data-world="town"]').click();await page.getByRole('button',{name:/\uB0B4 \uCC28\uB9BC\uC73C\uB85C \uB3D9\uB124 \uC5F4\uAE30/}).click();await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.SYNKTownDay?.metrics().connected);
  await new Promise(r=>setTimeout(r,1200));assert.equal(await page.locator('iframe').count(),1);assert.equal(await frame().evaluate(()=>SYNKTownDay.metrics().connected),true);assert.ok(calls.slice(beforeReopen).filter(c=>c.path.endsWith('/synk-world-v1/bootstrap')).length<=2,'re-login must not cause a Town reload loop');await page.locator('#panel-close').click();
  const manifest=publicPayload?JSON.parse(fs.readFileSync(path.join(publicPayload,'../manifest.json'),'utf8')):null;
  if(manifest){assert.deepEqual(manifest.privateArtifacts,[]);assert.equal(manifest.oldPayloadUnchanged,true);assert.ok(Number.isSafeInteger(manifest.publicVoice.clips)&&manifest.publicVoice.clips>=0);if(manifest.publicVoice.clips>0)assert.equal(manifest.publicVoice.approved,true);assert.equal(manifest.files.some(f=>/voice-check\.html$|\.candidate\.json$|brand-opening\/index\.html$/.test(f.path)),false);}
  // The published WORLD player stays in the shell and writes its own bounded
  // record through the same verified PlayHost transport as the existing games.
  // This compact case uses real choices; it does not inject a completed record.
  // A game opened for the first time on this device shows the tutor's control practice (10-10). Its exit closes only the practice
  // and returns to that game's start screen (10-14), so the panel's own close button then closes the game panel.
  async function closeGamePanel(){if(await page.locator('dialog.tutor-practice[open] .practice-exit').count()){await page.locator('dialog.tutor-practice[open] .practice-exit').click();await page.waitForFunction(()=>!document.querySelector('dialog.tutor-practice[open]'));}if(await page.evaluate(()=>document.querySelector('#world-panel').open))await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel').open);}
  // The 3D room hides the old next-lesson pill (10-12). Its path now is the 배우기 tab's 「지금 할 일」 poster,
  // which opens the same summary.nextLesson (10-14 redesign).
  // Each owner (account or guest) chooses a tutor once; pass that gate when it appears.
  async function passHangulStep(){await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}}
  async function passTutorGate(){await passHangulStep();await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] .tutor-option'));}}
  async function learnFromHome(){await passTutorGate();await page.locator('.world-nav [data-view="packs"]').click();const next=page.locator('.life-now [data-life-lesson]');await next.waitFor();await next.click();}
  await page.waitForFunction(()=>{try{return window.__synkWorld.life()?.owner==='11111111-1111-4111-8111-111111111111';}catch{return false;}});
  const lifeLesson=LESSONS.find(lesson=>lesson.id==='greetings-expressions'),lifeStory=LESSONS.find(lesson=>lesson.id==='greetings-story');
  // The tutor chosen at the gate is stored in the same life record (10-12); no lesson has started yet.
  const lifeBefore=playState.records[lifeKey]===undefined?null:JSON.parse(playState.records[lifeKey]);
  assert.ok(lifeBefore===null||(Object.keys(lifeBefore.lessons).length===0&&lifeBefore.activeLessonId===null&&lifeBefore.tutor?.selected==='mongle'));
  await learnFromHome();await page.locator('.life-intro').waitFor();
  assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>window.__synkWorld.life().owner),A);
  await page.locator('[data-life-begin]').click();
  // 이야기 무대는 세 친구를 그 장소에서 함께 구운 사진 한 장(tutor-photos). 사진이 없는 팩만 예전처럼 세 컷.
  // 누른 직후에는 사진이 아직 받는 중일 수 있다(10-19 구운 마을 파일을 넣은 판에서 3번 중 2번 여기서 멈췄다). 다 받거나 깨질 때까지 기다린 뒤 잰다.
  await page.waitForFunction(()=>document.querySelector('.life-story-photo>img')?.complete===true);
  assert.ok(await page.locator('.life-story-photo>img').evaluate(image=>image.complete&&image.naturalWidth>0&&['몽글','까몽','마린'].every(name=>image.alt.includes(name))));
  for(let i=0;i<12&&!await page.locator('[data-life-choice]').count();i++)await page.locator('[data-life-scene-next]').click();
  await page.locator('[data-life-choice="'+lifeLesson.questions[0].answerId+'"]').click();await page.locator('.life-feedback').waitFor();
  await page.waitForFunction(()=>window.__synkLife.summary().status.phase==='synced');
  const firstSaved=JSON.parse(playState.records[lifeKey]);
  assert.equal(firstSaved.owner,A);assert.equal(firstSaved.activeLessonId,lifeLesson.id);assert.equal(Object.keys(firstSaved.lessons[lifeLesson.id].answers).length,1);
  assert.equal(firstSaved.lessons[lifeLesson.id].answers[lifeLesson.questions[0].id].correct,true);
  assert.ok(calls.some(call=>call.path.endsWith('/synk-play')&&call.body?.changes?.some(change=>change.key===lifeKey)));
  assert.ok(calls.some(call=>call.path.endsWith('/synk-personal')&&call.method==='GET'&&call.body===null),'WORLD asked for the 「내 성향」 answers read-only');
  assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot?.accountId),A,'a refused read leaves the account signed in');
  lifeEvidence.firstAnswerSaved=true;lifeEvidence.storageKey=lifeKey;
  await page.locator('[data-life-pause]').click();await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
  await page.waitForFunction(()=>{try{return window.__synkWorld.life()?.owner==='11111111-1111-4111-8111-111111111111';}catch{return false;}});
  await learnFromHome();await page.locator('[data-life-choice]').first().waitFor();
  assert.equal(await page.evaluate(()=>window.__synkWorld.life().lessonId),lifeLesson.id);assert.equal(await page.evaluate(()=>window.__synkWorld.life().step),1);
  assert.equal(await page.evaluate(id=>window.__synkWorld.life().progress.lessons[id].attemptId,lifeLesson.id),firstSaved.lessons[lifeLesson.id].attemptId);
  lifeEvidence.reloadResumedSameAttempt=true;
  for(const question of lifeLesson.questions.slice(1)){await page.locator('[data-life-choice="'+question.answerId+'"]').click();await page.locator('[data-life-question-next]').click();}
  await page.locator('.life-complete').waitFor();await page.waitForFunction(()=>window.__synkLife.summary().status.phase==='synced');
  const lifeComplete=JSON.parse(playState.records[lifeKey]);assert.notEqual(lifeComplete.lessons[lifeLesson.id].completedAt,null);assert.equal(Object.keys(lifeComplete.lessons[lifeLesson.id].answers).length,3);
  await page.locator('[data-life-home]').click();assert.match(await page.locator('#life-progress-caption').textContent(),new RegExp('^1\\s*/\\s*'+LESSONS.length+'\\b'));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
  await page.waitForFunction(()=>{try{return window.__synkLife.summary().completed===1;}catch{return false;}});
  assert.equal(await page.evaluate(()=>window.__synkLife.summary().nextLesson.id),lifeStory.id);assert.match(await page.locator('#life-progress-caption').textContent(),new RegExp('^1\\s*/\\s*'+LESSONS.length+'\\b'));
  lifeEvidence.completedLessonRestored=true;
  await learnFromHome();await page.locator('[data-life-begin]').click();await page.locator('[data-life-scene-next]').click();
  const storyBefore=await page.evaluate(()=>({timeOrigin:performance.timeOrigin,scene:window.__synkWorld.life().progress.lessons['greetings-story'].stage.sceneIndex,text:document.querySelector('.life-dialogue p').textContent}));
  for(const viewport of [{width:740,height:320},{width:390,height:844}]){
   await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>performance.timeOrigin),storyBefore.timeOrigin);
   assert.equal(await page.evaluate(()=>window.__synkWorld.life().progress.lessons['greetings-story'].stage.sceneIndex),storyBefore.scene);assert.equal(await page.locator('.life-dialogue p').textContent(),storyBefore.text);
  }
  await page.screenshot({path:path.join(output,'life-story-account-mobile.png')});lifeEvidence.storyRotationPreserved=true;
  await page.locator('[data-life-pause]').click();await page.waitForFunction(()=>window.__synkLife.summary().status.phase==='synced');
  const gameEntrances=[];
  for(const game of ['runner','rhythm']){
   await page.bringToFront();await page.locator('.world-nav [data-view="play"]').click();await page.locator('button[data-game="'+game+'"]').click();
   await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.SynkPlayAccount?.status().mode==='account');
   let gameFrame=page.frames().find(f=>f.url().includes('/korean-'+game+'/'));
   assert.ok(gameFrame);assert.equal(page.url(),url+'/world/?opening=off');assert.equal(await gameFrame.evaluate(()=>SynkPlayAccount.status().accountId),A);
   const boot=await gameFrame.evaluate(()=>performance.timeOrigin);
   for(const viewport of [{width:740,height:320},{width:320,height:740},{width:390,height:844}]){await page.setViewportSize(viewport);assert.equal(await gameFrame.evaluate(()=>performance.timeOrigin),boot);}
   const reward=await gameFrame.evaluate(async game=>{const first=await SynkPlayCollection.award({game,total:5,correct:5,completed:true,automatic:false,roundId:'synthetic-world-'+game});const repeat=await SynkPlayCollection.award({game,total:5,correct:5,completed:true,automatic:false,roundId:'synthetic-world-'+game});return {saved:first.saved,coins:first.coins,repeatCoins:repeat.coins,mode:SynkPlayAccount.status().mode};},game);
   assert.equal(reward.saved,true);assert.ok(reward.coins>0);assert.equal(reward.repeatCoins,0);assert.equal(reward.mode,'account');
   if(game==='runner'){
    await gameFrame.evaluate(()=>SynkPlayAccount.storage().setItem('synk.windrun.best','123'));await page.evaluate(()=>SYNKPlayHost.flush());assert.equal(playState.records['synk.windrun.best'],'123');
    const coinsBefore=playState.wallet.coins;conflictNext=true;
    await gameFrame.evaluate(()=>SynkPlayAccount.storage().setItem('synk.windrun.best','234'));
    await page.locator('[data-world="resolve-play"][data-choice="remote"]').waitFor();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>window.__synkWorld.screen()),'world-game-conflict');
    assert.equal(await page.locator('[data-world="resolve-play"][data-choice="local"]').count(),1);await page.screenshot({path:path.join(output,'runner-progress-conflict.png')});
    await page.locator('[data-world="resolve-play"][data-choice="remote"]').click();await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.SynkPlayAccount?.status().mode==='account');
    gameFrame=page.frames().find(f=>f.url().includes('/korean-runner/'));assert.equal(await gameFrame.evaluate(()=>SynkPlayAccount.storage().getItem('synk.windrun.best')),'777');
    assert.equal(playState.wallet.coins,coinsBefore);assert.equal(page.url(),url+'/world/?opening=off');
   }
   await page.screenshot({path:path.join(output,game+'-account-mobile.png')});
   gameEntrances.push({game,href:gameFrame.url(),reward,rotationDocumentPreserved:true});
   await closeGamePanel();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>document.querySelector('#world-panel').open),false);
  }
  assert.ok(calls.some(c=>c.path.endsWith('/synk-learning')),'enabled consent uses official learning transport');
  assert.ok(playCommands.size>=5);assert.equal(conflictInjected,true);assert.equal(playState.wallet.gameStats.runner.rounds,1);assert.equal(playState.wallet.gameStats.rhythm.rounds,1);
  await page.locator('.world-nav [data-view="play"]').click();await page.locator('[data-game="hangul"]').click();
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.document.querySelector('#start'));
  const hangulFrame=page.frames().find(f=>f.url().includes('/hangul-stage/')),hangulHref=hangulFrame.url();assert.equal(new URL(hangulHref).origin,url);assert.equal(await page.evaluate(()=>SYNKLearningHost.status().accountKey),A);
  await closeGamePanel();assert.equal(await page.locator('iframe').count(),0);
  // Logging out closes both installed ports; the next game choice stays in the sign-in surface.
  await page.evaluate(()=>window.__qaLifeBeforeLogout=window.__synkLife);
  await page.evaluate(()=>window.__synkWorld.client.logout());assert.equal(await page.evaluate(()=>!!window.SYNKPlayHost||!!window.SYNKLearningHost),false);
  await page.waitForFunction(()=>{try{return window.__synkWorld.life()?.owner==='guest';}catch{return false;}});
  assert.equal(await page.evaluate(()=>window.__synkLife===window.__qaLifeBeforeLogout),false);assert.equal(await page.evaluate(()=>window.__synkWorld.life().progress.owner),'guest');lifeEvidence.logoutReleasedAccountScope=true;
  const accountLifeAtLogout=playState.records[lifeKey],callsAtLogout=calls.length;
  await learnFromHome();await page.locator('[data-life-begin]').click();
  for(let i=0;i<12&&!await page.locator('[data-life-choice]').count();i++)await page.locator('[data-life-scene-next]').click();
  await page.locator('[data-life-choice="'+lifeLesson.questions[0].answerId+'"]').click();await page.locator('.life-feedback').waitFor();
  assert.equal(await page.evaluate(id=>window.__synkWorld.life().progress.lessons[id].answers['greetings-expressions-hello'].correct,lifeLesson.id),true);
  assert.equal(playState.records[lifeKey],accountLifeAtLogout);assert.equal(calls.slice(callsAtLogout).some(call=>call.body?.changes?.some(change=>change.key===lifeKey)),false);
  lifeEvidence.guestLearningWorksAfterLogout=true;lifeEvidence.guestKeepsAccountRecordUnchanged=true;
  await page.locator('[data-life-pause]').click();
  // 10-19 「WORLD 손님」: a guest gets one 바람길 round on this device. The trial frame earns no coins and nothing reaches the account.
  const callsBeforeTrial=calls.length;
  await page.locator('.world-nav [data-view="play"]').click();await page.locator('[data-game="runner"]').click();
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.SynkPlayAccount?.status().trial===true);
  const trialFrame=page.frames().find(f=>f.url().includes('/korean-runner/'));
  const trial=await trialFrame.evaluate(async()=>{const award=await SynkPlayCollection.award({game:'runner',total:5,correct:5,completed:true,automatic:false,roundId:'synthetic-trial-runner'});return {mode:SynkPlayAccount.status().mode,used:SynkPlayAccount.status().used,coins:award.coins,saved:award.saved,reason:award.reason};});
  assert.deepEqual(trial,{mode:'account',used:true,coins:0,saved:false,reason:'guest-trial'});
  assert.equal(calls.slice(callsBeforeTrial).some(call=>call.path.endsWith('/synk-play')),false,'a guest trial never writes to the account');
  await closeGamePanel();assert.equal(await page.evaluate(()=>!!window.SYNKPlayHost),false);
  // The trial is used: the same game now opens sign-in with the reason.
  await page.locator('.world-nav [data-view="play"]').click();await page.locator('[data-game="runner"]').click();await page.locator('[data-world="account-login"]').waitFor();assert.equal(await page.locator('iframe').count(),0);assert.equal(page.url(),url+'/world/?opening=off');
  assert.match(await page.locator('#panel-content .ws-lead').textContent(),/바람길 체험 판을 마쳤어요/);
  assert.equal(fs.existsSync(path.join(directory,'must-not-create')),false);assert.deepEqual(errors,[]);assert.deepEqual(assetErrors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(sanitized({ok:true,syntheticAccount:true,liveProviderCalls:false,actualBrowser:'Chromium/Edge',mode:'account',publicPayload,health,checks:['verified-account','explicit-learning-consent','enrollment-preview-before-claim','classroom-lessons-401-keeps-session','classroom-lessons-after-claim','bfcache-reverification','verified-town-sharing','town-logout-relogin','embedded-runner-and-rhythm','same-iframe-rotation','account-wallet-save','duplicate-reward-prevention','runner-progress-save','in-app-progress-conflict-recovery','hangul-return','logout-removes-game-hosts','guest-trial-once-then-sign-in','no-real-external-traffic','life-internal-player','life-official-progress-key','life-pause-reload','life-completion-home-next','life-story-rotation','life-logout-release','guest-life-after-logout'],lifeEvidence,actualBfcache,forcedBfcacheBranch:!actualBfcache,hangulHref,privateArtifacts:manifest?.privateArtifacts,conflictInjected,gameEntrances,calls,errors,assetErrors,external}),null,2));
 }catch(error){console.error('ACCOUNT_BROWSER_FAILURE',error.stack,JSON.stringify(sanitized({errors,assetErrors,external,calls})));if(page){const state=await page.evaluate(()=>{let life;try{life={owner:window.__synkWorld?.life()?.owner};}catch(error){life={error:error.code||error.message};}return {screen:window.__synkWorld?.screen(),clientGeneration:window.__synkWorld?.client.generation,life,host:!!window.SYNKWorldTownHost,frame:document.querySelector('iframe')?.getAttribute('src'),body:document.body.innerText.slice(-800)};});console.error('PAGE_STATE',state);if(output){fs.writeFileSync(path.join(output,'failure-report.json'),JSON.stringify(sanitized({ok:false,publicPayload,syntheticAccount:true,liveProviderCalls:false,error:error.stack,state,lifeEvidence,errors,assetErrors,external}),null,2));await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}for(const f of page.frames().slice(1))console.error('FRAME_STATE',await f.evaluate(()=>({config:window.__SYNK_WORLD_TOWN__,metrics:window.SYNKTownDay?.metrics(),body:document.body.innerText.slice(-1800)})));}throw error;}finally{
  // Close the connect() client before the owning launchServer() listener.
  // Otherwise its live WebSocket can keep a successful Node test worker alive.
  if(browser){let timer;try{await Promise.race([browser.close(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('disconnect timeout')),3000))]);}catch{/* The server cleanup below owns its isolated browser process. */}finally{clearTimeout(timer);}}
  if(browserServer){let timer;try{await Promise.race([browserServer.close(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('close timeout')),8000))]);}catch{browserServer.process()?.kill('SIGKILL');}finally{clearTimeout(timer);}}
  server.kill?.('SIGKILL');server.closeAllConnections?.();server.close?.();
 }
});
