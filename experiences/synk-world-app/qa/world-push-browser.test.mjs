import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createECDH} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import STRINGS from '../../brand-opening/world-strings.mjs';
import {emptyPlayState} from '../../play-common/play-data.mjs';
import {createLifeProgress,LIFE_PROGRESS_KEY} from '../life-progress.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
// WORLD 학습 알림 2단(앱을 닫아도 받기, 설계 qa/push-reminders-20261022/설계.md) 실제 브라우저 확인 — 계정 모드 WORLD(헤드리스 Edge)의 로그인 학생:
// PC 설정 「앱을 닫아도 받기」 → 동의 상자 → 「동의하고 켜기」 → 실제 서비스 워커(world-push-sw.js)에 푸시를 넣어 알림 → 알림 주소로 들어와 그 자리 ·
// 누름 알림 → 끄기, 휴대폰(안드로이드)의 묻는 카드 → 동의 시트 → 켜기, 아이폰 안내, 세 언어(ko·en·mn)·390·1280.
// 브라우저의 푸시 구독(pushManager.subscribe)만 가짜다 — 헤드리스는 푸시 관문에 붙지 않는다(실제 관문 왕복은 리허설 tools/학습알림_왕복.js).
// 서비스 워커·알림 띄우기는 진짜다(CDP ServiceWorker.deliverPushMessage). 운영 계정·서버를 쓰지 않는다(바깥 주소는 막고 계정 API는 아래 가짜만).
// 캡처와 result.json은 SYNK_PUSH_QA_OUT(기본 qa/push-reminders-20261022/browser/)에 쓴다(그림은 git 밖).
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');if(!playwright.chromium)throw Error('no chromium');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
const out=path.resolve(process.env.SYNK_PUSH_QA_OUT||path.join(root,'experiences/synk-world-app/qa/push-reminders-20261022/browser'));
const A='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',
 clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const KEY=(()=>{const ecdh=createECDH('prime256v1');return ecdh.generateKeys().toString('base64url');})();
const VIEWPORTS={phone:{width:390,height:844},desk:{width:1280,height:800}};
const ANDROID='Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 Edg/141.0.0.0';
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
const s=(key,lang='ko')=>STRINGS[key][lang];
const NEXT=Date.parse('2026-10-23T19:00:00+09:00');
// 계정 학생의 생활 진도(실제 createLifeProgress, 계정 판): 한글을 읽고, 몽글을 골랐고, 이틀 전에 첫 레슨을 마쳤다 — 돌아온 복습이 있어 묻는 카드가 뜬다.
function accountProgress(){
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 let tick=Date.now()-2*86400000,n=0;const life=createLifeProgress({storage,owner:A,mode:'account',now:()=>tick,uuid:()=>`qa-push-${++n}`});
 life.summary(PACKS,LESSONS);life.setHangulReading('reads',{via:'question'});life.selectTutor('mongle');
 const lesson=LESSONS.find(row=>row.id==='greetings-expressions');life.startLesson(lesson);
 for(const q of lesson.questions){tick+=1000;life.recordAnswer({lessonId:lesson.id,questionId:q.id,correct:true,choiceId:q.answerId});}
 life.finishLesson(lesson.id);
 return values.get(LIFE_PROGRESS_KEY);
}

test('WORLD 학습 알림 2단: 동의 → 켜기 → 서비스 워커 알림 → 누름 → 끄기, 휴대폰 묻는 카드, 아이폰 안내, 세 언어 (390·1280)',{timeout:600000,skip:!talkRoot&&'형제 저장소 SYNK-talk이 없다(SYNK_TALK_ROOT로 가리킨다)'},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-push-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 fs.mkdirSync(out,{recursive:true});for(const name of fs.readdirSync(out))if(/\.png$/.test(name))fs.rmSync(path.join(out,name));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talkRoot,SYNK_WORLD_PORT:String(port),
  SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create'),
  SYNK_WORLD_FEATURES:'worldPush'}});
 let serverOutput='';server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 const url=`http://127.0.0.1:${port}`,origin=new URL(config.accountApiUrl).origin,errors=[],external=[],unexpected=[],shots=[],measures={},checks={};
 // 가짜 world-push(서버 계약 그대로의 답 모양). 기기는 주소 → 기기 식별자.
 // hold: 다음 status 답을 그만큼(ms) 붙잡는다(설정을 연 뒤 2단 준비가 끝나는 때를 시험이 정한다) · statusReplies: 보낸 status 답 수.
 const push={devices:new Map(),calls:[],n:0,hold:0,statusReplies:0};
 const view=()=>({frequency:2,hour:null,since:null,planHour:19,hourSource:'default',level:0,reduced:false,paused:false,resting:false,next:NEXT,log:[]});
 const account=()=>({active:push.devices.size>0,devices:push.devices.size});
 function pushReply(body,authed){
  const base={ok:true,scope:'world-push',enabled:true,publicKey:KEY};
  if(body.action==='opened')return {ok:true};
  if(body.action==='unsubscribe'&&!authed){const removed=push.devices.get(body.endpoint)===body.deviceId;if(removed)push.devices.delete(body.endpoint);return {ok:true,scope:'world-push',removed,last:removed&&push.devices.size===0};}
  if(!authed)return null;
  if(body.action==='status')return {...base,accountId:A,device:push.devices.has(body.endpoint)?{subscribed:true,deviceId:push.devices.get(body.endpoint)}:{subscribed:false},account:account(),plan:push.devices.size?view():null};
  if(body.action==='subscribe'){const deviceId=`00000000-0000-4000-8000-${String(++push.n).padStart(12,'0')}`;push.devices.set(body.subscription.endpoint,deviceId);return {...base,accountId:A,device:{subscribed:true,deviceId},account:account(),plan:view()};}
  if(body.action==='sync')return {...base,accountId:A,account:account(),plan:push.devices.size?view():null};
  if(body.action==='unsubscribe'){const removed=push.devices.delete(body.endpoint),last=push.devices.size===0;return {...base,accountId:A,removed,account:account(),...(last?{handover:[],settings:{frequency:2,hour:null,since:null}}:{})};}
  return null;
 }
 let browser;
 t.signal.addEventListener('abort',()=>{server.kill('SIGKILL');},{once:true});
 try{
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(serverOutput);try{const r=await fetch(url+'/world/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await playwright.chromium.launch({channel:'msedge',headless:true,timeout:30000});
  // 새 기기 하나: 로그인한 계정(합성 토큰), 화면 언어, 가짜 푸시 구독(브라우저 저장소에 남는다 — 다시 열어도 같은 구독).
  async function device({lang='ko',viewport=VIEWPORTS.desk,userAgent,notifications=true,features=true}={}){
   const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce',...(userAgent?{userAgent,isMobile:viewport.width<600,hasTouch:viewport.width<600}:{})});
   context.setDefaultTimeout(25000);
   if(notifications)await context.grantPermissions(['notifications'],{origin:url});
   await context.route('**/*',route=>{const target=new URL(route.request().url());if(target.origin===url)return route.continue();if(target.origin===origin)return route.fallback();external.push(route.request().url());return route.abort('blockedbyclient');});
   // features:false — 켜기 전 공개본처럼 진입 페이지 설정(#synk-world-config)에서 features를 뺀다(나중에 등록한 길이 먼저 받는다).
   if(!features)await context.route(url+'/world/**',async route=>{
    if(route.request().resourceType()!=='document')return route.fallback();
    const response=await route.fetch(),tag=/(<script type="application\/json" id="synk-world-config">)([^<]*)(<\/script>)/,html=await response.text();
    assert.match(html,tag);
    await route.fulfill({response,body:html.replace(tag,(_,open,json,close)=>{const {features:_off,...rest}=JSON.parse(json);return open+JSON.stringify(rest).replaceAll('<','\\u003c')+close;})});
   });
   const cors={'Access-Control-Allow-Origin':'*'},playState=emptyPlayState();let playRevision=1;playState.records[LIFE_PROGRESS_KEY]=accountProgress();
   await context.route(origin+'/**',async route=>{
    const req=route.request(),target=new URL(req.url());let status=200,data={ok:true};
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...cors,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, POST, PUT'}});return;}
    const body=req.postDataJSON(),headers=await req.allHeaders();
    if(target.pathname==='/functions/v1/world-push/api'){
     const authed=headers.authorization==='Bearer synthetic-browser-token';
     push.calls.push({action:body.action,authed,authorization:headers.authorization,apikey:headers.apikey,product:headers['x-synk-product'],contract:headers['x-synk-contract'],keepalive:false,body});
     if(body.action==='status'&&push.hold){const ms=push.hold;push.hold=0;await new Promise(r=>setTimeout(r,ms));}
     data=pushReply(body,authed);if(!data){status=401;data={ok:false,error:{code:'AUTH_REQUIRED'}};}
     if(body.action==='status')push.statusReplies++;
    }
    else if(target.pathname==='/functions/v1/classroom')data={contract_ver:'c16',ok:true,classes:[]};
    else if(target.pathname.endsWith('/synk-account'))data=body?{ok:true,refreshRevoked:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[{id:C,current:true,revoked:false,product:'world'}]};
    else if(target.pathname.endsWith('/synk-play')){if(body?.action==='progress')for(const change of body.changes){if(change.value===null)delete playState.records[change.key];else playState.records[change.key]=change.value;}data={ok:true,scope:'synk-play',accountId:A,revision:body?++playRevision:playRevision,state:structuredClone(playState)};}
    else if(target.pathname.endsWith('/synk-world-v1/bootstrap'))data={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
    else if(target.pathname.endsWith('/synk-learning'))data={ok:true,revision:1,events:[],cursor:0,hasMore:false};
    else if(target.pathname.endsWith('/synk-personal')){status=403;data={ok:false,error:{code:'PRODUCT_FORBIDDEN'}};}
    else if(target.pathname.includes('/synk-classroom/'))data={mode:'account-linked',accountId:A,classes:[],emptyReason:'NO_CLASS',serverTime:new Date().toISOString()};
    else if(target.pathname.startsWith('/auth/v1/logout'))data={};
    else{unexpected.push(target.pathname);status=404;data={ok:false,error:{code:'NOT_IN_FIXTURE'}};}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:cors});
   });
   await context.addInitScript(({lang,key})=>{
    if(window.top!==window)return;
    if(!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));
    if(!localStorage.getItem('qa.seeded')){localStorage.setItem('synk.world.lang',lang);localStorage.setItem('synk-world-v1-welcomed','1');localStorage.setItem('qa.seeded','1');}
    // 가짜 브라우저 구독: 부른 때의 사용자 활성(누른 동작 안인지)을 적는다.
    if(typeof PushManager!=='function')return;
    const STORE='qa.push.endpoint',qa=window.__qaPush={subscribes:[],unsubscribed:0};
    const make=endpoint=>({endpoint,expirationTime:null,toJSON(){return {endpoint,expirationTime:null,keys:{p256dh:key,auth:'AAAAAAAAAAAAAAAAAAAAAA'}};},unsubscribe(){if(localStorage.getItem(STORE)===endpoint)localStorage.removeItem(STORE);qa.unsubscribed++;return Promise.resolve(true);}});
    PushManager.prototype.subscribe=function(options){qa.subscribes.push({active:navigator.userActivation?.isActive===true,userVisibleOnly:options?.userVisibleOnly===true,keyBytes:options?.applicationServerKey?.byteLength??null});
     // qa.push.deny: 한 번 거절(권한 창의 「차단」처럼 NotAllowedError) — 실패 뒤 단추가 다시 눌리는지 본다.
     if(localStorage.getItem('qa.push.deny')){localStorage.removeItem('qa.push.deny');return Promise.reject(new DOMException('denied','NotAllowedError'));}
     const endpoint=localStorage.getItem(STORE)||'https://fcm.googleapis.com/fcm/send/qa-'+crypto.randomUUID();localStorage.setItem(STORE,endpoint);return Promise.resolve(make(endpoint));};
    PushManager.prototype.getSubscription=function(){const endpoint=localStorage.getItem(STORE);return Promise.resolve(endpoint?make(endpoint):null);};
   },{lang,key:KEY});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR_BLOCKED_BY_CLIENT/.test(m.text()))errors.push('console: '+m.text());});
   return {context,page};
  }
  async function start(page,lang='ko',query=''){
   try{await startInner(page,lang,query);}catch(error){await page.screenshot({path:path.join(out,'start-failure.png')}).catch(()=>{});
    console.error('[start-timeout]',JSON.stringify(await page.evaluate(()=>({status:window.__synkWorld?.client.status,entry:document.querySelector('.world-shell')?.dataset.entry,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id+':'+d.className+':'+d.innerText.slice(0,120)),reminders:!!window.__synkReminders,picker:!!document.querySelector('[data-lang-picker]')})).catch(e=>String(e))));throw error;}
  }
  async function startInner(page,lang='ko',query=''){
   await page.goto(url+'/world/?opening=off'+(lang!=='ko'?'&lang='+lang:'')+query,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
   await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('[data-lang-picker]').count()){await page.locator(`[data-lang-choice="${lang}"]`).click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
   await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}
   await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(()=>{});}
   await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready'&&!document.querySelector('dialog[open] .tutor-option')&&window.__synkReminders);
  }
  const closePanel=async page=>{if(await page.evaluate(()=>document.querySelector('#world-panel')?.open)){await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);}};
  const openLearn=async page=>{await closePanel(page);await page.locator('nav [data-view="packs"], [data-view="packs"][data-life-library]').last().click();await page.waitForSelector('#panel-content .life-hub');};
  const openSettings=async page=>{await closePanel(page);await page.locator('#settings-open').click();await page.waitForSelector('#panel-content [data-reminder-settings]');};
  const clearToast=page=>page.evaluate(()=>{const n=document.querySelector('#home-toast');if(n){n.textContent='';n.hidden=true;}});
  const toast=page=>page.waitForFunction(()=>{const n=document.querySelector('#home-toast');return n&&!n.hidden&&n.textContent.trim()?n.textContent.trim():null;}).then(h=>h.jsonValue());
  const remote=page=>page.evaluate(()=>window.__synkReminders.metrics().push);
  const qa=page=>page.evaluate(()=>window.__qaPush);
  const measure=(page,selector)=>page.evaluate(selector=>{
   const el=document.querySelector(selector),content=document.querySelector('#panel-content'),box=el.getBoundingClientRect(),shown=n=>n.getClientRects().length>0;
   const small=[],mixed=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){const text=n.textContent.trim();if(!text||!shown(n.parentElement))continue;
    if(/[가-힣]/.test(text)&&parseFloat(getComputedStyle(n.parentElement).fontSize)<13)small.push(text.slice(0,24));
    if(document.documentElement.lang!=='ko'&&/[가-힣]/.test(text)&&!n.parentElement.closest('[lang="ko"]'))mixed.push(text.slice(0,30));}
   const targets=[...el.querySelectorAll('button,a,summary,label:has(input[type=checkbox]),label:has(input[type=radio])')].filter(shown).map(n=>({key:n.dataset.world||n.className||n.tagName,height:Math.round(n.getBoundingClientRect().height)}));
   const overflowing=[...el.querySelectorAll('*')].filter(n=>shown(n)&&(n.getBoundingClientRect().right>box.right+.5||n.getBoundingClientRect().left<box.left-.5)).map(n=>n.className||n.tagName);
   return {lang:document.documentElement.lang,docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,panelOverflow:content?content.scrollWidth-content.clientWidth:0,
    overflowing,small,mixed,shortTargets:targets.filter(x=>x.height<44),whitePills:[...el.querySelectorAll('.felt-button')].filter(shown).length};
  },selector);
  const shoot=async(page,name,selector=null)=>{await page.evaluate(()=>document.fonts.ready);if(selector)await page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),selector);
   const file=path.join(out,`${name}.png`);await page.locator('#world-panel').screenshot({path:file});shots.push(path.basename(file));};
  const record=async(page,name,selector)=>{measures[name]=await measure(page,selector);await shoot(page,name,selector);};
  const until=async(page,fn,arg=null,timeout=15000)=>{const end=Date.now()+timeout;for(;;){const value=await page.evaluate(fn,arg);if(value)return value;if(Date.now()>end)throw Error('until timeout: '+String(fn).slice(0,90));await new Promise(r=>setTimeout(r,100));}};
  const swActive=page=>until(page,()=>navigator.serviceWorker.getRegistration('/world/').then(reg=>!!reg?.active));
  const clean=m=>m.docOverflow<=0&&m.panelOverflow<=0&&!m.overflowing.length&&!m.small.length&&!m.mixed.length&&!m.shortTargets.length;
  // 실제 서비스 워커에 푸시 하나를 넣고 그 등록이 띄운 알림을 읽는다.
  async function deliver(context,page,payload){
   const cdp=await context.newCDPSession(page),registrations=[];
   cdp.on('ServiceWorker.workerRegistrationUpdated',event=>registrations.push(...event.registrations));
   await cdp.send('ServiceWorker.enable');
   for(let i=0;i<50&&!registrations.some(r=>r.scopeURL===url+'/world/'&&!r.isDeleted);i++)await new Promise(r=>setTimeout(r,100));
   const registration=registrations.find(r=>r.scopeURL===url+'/world/'&&!r.isDeleted);assert.ok(registration,'서비스 워커 등록: '+JSON.stringify(registrations));
   await cdp.send('ServiceWorker.deliverPushMessage',{origin:url,registrationId:registration.registrationId,data:JSON.stringify(payload)});
   const list=await until(page,async()=>{const reg=await navigator.serviceWorker.getRegistration('/world/');const shown=await reg.getNotifications();return shown.length?shown.map(n=>({title:n.title,body:n.body,tag:n.tag,icon:n.icon,lang:n.lang,data:n.data})):null;},null,10000);
   await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration('/world/');for(const n of await reg.getNotifications())n.close();});
   await cdp.detach();return list;
  }

  // ── A. PC(1280): 설정 → 「앱을 닫아도 받기」 → 동의 상자 → 켜기 → 알림 → 누름 → 끄기 ──
  {const {context,page}=await device();
   await start(page);
   assert.deepEqual(push.calls.map(call=>call.action),['status'],'열 때는 상태만 읽는다');
   assert.equal(push.calls[0].authed,true);assert.equal(push.calls[0].product,'world');assert.equal(push.calls[0].contract,'1');
   assert.equal(await page.evaluate(()=>navigator.serviceWorker.getRegistration('/world/').then(Boolean)),false,'설정을 열기 전에는 서비스 워커를 등록하지 않는다');
   // 설정을 연 그 묶음을 2단 준비가 끝나기 전에 잡는다(준비의 status 답을 0.7초 붙잡음) — 줄 구성이 같으면 준비가 끝나도 새로 그리지 않아야
   // 그 사이 띄운 권한 창의 끝·펼친 접기·상자 안 안내가 날아가지 않는다(10-23 화면 검수).
   push.hold=700;const repliesBefore=push.statusReplies;
   await openSettings(page);
   await page.evaluate(()=>{window.__qaSettingsBox=document.querySelector('#panel-content [data-reminder-settings]');});
   const row=page.locator('#panel-content [data-push-row]');await row.waitFor();
   for(let i=0;i<100&&push.statusReplies<=repliesBefore;i++)await new Promise(r=>setTimeout(r,50));
   assert.ok(push.statusReplies>repliesBefore,'설정을 열 때 2단 준비가 상태를 읽는다');await page.waitForTimeout(400);
   assert.equal(await page.evaluate(()=>window.__qaSettingsBox===document.querySelector('#panel-content [data-reminder-settings]')),true,'2단 준비가 끝나도 줄 구성이 같으면 묶음을 새로 그리지 않는다');
   checks.pushRowKo=await row.innerText();
   assert.match(checks.pushRowKo,new RegExp(s('reminder.push.row.title')));
   try{await swActive(page);}
   catch(error){console.error('[sw-timeout]',JSON.stringify(await page.evaluate(async()=>({push:window.__synkReminders.metrics().push,regs:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:!!r.active,installing:r.installing?.state,waiting:!!r.waiting}))}))));throw error;}
   await page.locator('#panel-content [data-push-enabled]').click({force:true});
   const box=page.locator('#panel-content [data-push-consent="settings"]');await box.waitFor();
   assert.equal(await page.locator('#panel-content [data-push-enabled]').isChecked(),false,'동의 전에는 켜지 않는다');
   assert.equal((await qa(page)).subscribes.length,0,'동의 전에는 권한도 구독도 없다');
   await page.waitForFunction(()=>!document.querySelector('[data-push-consent] [data-world="reminder-push-yes"]')?.disabled);
   checks.consentKo=await box.innerText();
   assert.match(checks.consentKo,new RegExp(s('reminder.push.consent.title').replace('?','\\?')));
   await page.locator('#panel-content .reminder-push-more summary').click();
   checks.consentMoreKo=await box.innerText();
   for(const key of ['reminder.push.consent.keep','reminder.push.consent.timing','reminder.push.consent.never','reminder.push.consent.delete'])assert.ok(checks.consentMoreKo.includes(s(key)),key);
   assert.equal(await page.locator('#panel-content .reminder-push-more a').getAttribute('href'),'https://synk.im/privacy/');
   await record(page,'1280-ko-consent','#panel-content [data-reminder-settings]');
   await clearToast(page);await page.locator('#panel-content [data-world="reminder-push-yes"]').click();
   checks.onToast=await toast(page);assert.equal(checks.onToast,s('reminder.push.on'));
   const subscribes=(await qa(page)).subscribes;
   assert.equal(subscribes.length,1);assert.equal(subscribes[0].active,true,'누른 동작 안에서 구독했다');assert.equal(subscribes[0].userVisibleOnly,true);assert.equal(subscribes[0].keyBytes,65);
   const sub=push.calls.find(call=>call.action==='subscribe');
   checks.subscribeBody=sub.body;
   assert.equal(sub.body.consent,1);assert.deepEqual(Object.keys(sub.body).sort(),['action','consent','digest','handover','settings','subscription']);
   assert.deepEqual(Object.keys(sub.body.digest).sort(),['examDate','lang','lastStudyDay','planWeek','reviews','studyHour','timeZone']);
   assert.equal(sub.body.digest.timeZone,'Asia/Seoul');
   assert.doesNotMatch(JSON.stringify(sub.body),/mongle|몽글|apron|synthetic-browser-token|@/,'요약에 이름·토큰·글이 없다');
   await page.waitForFunction(()=>document.querySelector('#panel-content [data-push-enabled]')?.checked===true);
   checks.statusOn=await page.locator('#panel-content [data-reminder-status]').innerText();
   assert.ok(checks.statusOn.includes(s('reminder.push.status.device')),checks.statusOn);assert.ok(checks.statusOn.includes('10월 23일 저녁 7시'),checks.statusOn);
   await record(page,'1280-ko-on','#panel-content [data-reminder-settings]');
   const record1=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.push.v1')));
   assert.equal(record1.accountId,A);assert.match(record1.deviceId,/^[0-9a-f-]{36}$/);
   // 실제 서비스 워커에 푸시 하나 → 잠금 화면 글은 세 문장 중 하나, 같은 tag, WORLD 아이콘.
   const token='QAtokenQAtokenQAtoken1';
   checks.notes=await deliver(context,page,{type:'synk-world-reminder',kind:'review',lang:'ko',token});
   assert.deepEqual(checks.notes.map(n=>[n.title,n.body,n.tag,n.lang]),[['SYNK WORLD',s('reminder.push.review'),'synk-world-reminder','ko']]);
   assert.equal(checks.notes[0].icon,url+'/world/world-icon-192.png');assert.deepEqual(checks.notes[0].data,{kind:'review',token});
   checks.mnNote=(await deliver(context,page,{type:'synk-world-reminder',kind:'exam',lang:'mn',token}))[0].body;
   assert.equal(checks.mnNote,s('reminder.push.exam','mn'));
   const icon=await page.evaluate(async u=>{const r=await fetch(u);return {status:r.status,type:r.headers.get('content-type')};},url+'/world/world-icon-192.png');
   assert.deepEqual(icon,{status:200,type:'image/png'});
   // 알림을 눌러 새 창으로 들어온 주소: 주소에서 지우고 누름을 알리고(로그인 없이), 복습을 연다.
   await closePanel(page);
   await page.goto(url+`/world/?reminder=review&opening=off&ack=${token}`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__synkHome?.openPanel?.()==='life-review',null,{timeout:20000});
   checks.ackUrl=await page.evaluate(()=>location.search);
   assert.doesNotMatch(checks.ackUrl,/ack=|reminder=/);
   const opened=push.calls.filter(call=>call.action==='opened');
   assert.equal(opened.length,1);assert.equal(opened[0].authed,false,'누름은 로그인 없이');assert.equal(opened[0].authorization,'Bearer '+config.supabasePublishableKey);assert.deepEqual(opened[0].body,{action:'opened',token});
   await shoot(page,'1280-ko-review-opened');
   // 다시 열어도 켠 상태 그대로(서버 상태 + 이 브라우저 구독).
   await openSettings(page);await page.waitForFunction(()=>document.querySelector('#panel-content [data-push-enabled]')?.checked===true);
   // 끄기: 이 기기 구독을 서버와 브라우저에서 지우고, PC는 1단으로 돌아간다 — 그래서 「껐어요」가 아니라 열려 있는 동안 알린다는 1단 글(10-23 화면 검수).
   await clearToast(page);await page.locator('#panel-content [data-push-enabled]').click({force:true});
   checks.offToast=await toast(page);assert.equal(checks.offToast,s('reminder.settings.open'));
   assert.equal(push.devices.size,0);assert.equal((await qa(page)).unsubscribed,1);
   assert.equal(await page.evaluate(()=>localStorage.getItem('synk.world.push.v1')),null);
   await page.waitForFunction(()=>document.querySelector('#panel-content [data-push-enabled]')?.checked===false);
   assert.equal((await remote(page)).account.active,false);
   // 로그아웃 전 끄기: 다시 켠 뒤 로그아웃하면 이 브라우저 구독을 먼저 지운다.
   await page.locator('#panel-content [data-push-enabled]').click({force:true});
   await page.waitForFunction(()=>!document.querySelector('[data-push-consent] [data-world="reminder-push-yes"]')?.disabled);
   await page.locator('#panel-content [data-world="reminder-push-yes"]').click();
   await page.waitForFunction(()=>document.querySelector('#panel-content [data-push-enabled]')?.checked===true);
   assert.equal(push.devices.size,1);
   const before=push.calls.length;
   await closePanel(page);await page.locator('.profile-control[data-view="me"]').click();
   await page.locator('#panel-content [data-world="logout"]').click();
   for(let i=0;i<80&&push.devices.size;i++)await new Promise(r=>setTimeout(r,100));
   checks.logoutCalls=push.calls.slice(before).map(call=>[call.action,call.authed]);
   assert.equal(push.devices.size,0,'로그아웃 전에 이 브라우저 구독을 서버에서 지웠다');
   assert.deepEqual(checks.logoutCalls[0],['unsubscribe',true],'토큰이 살아 있을 때');
   await page.waitForFunction(()=>localStorage.getItem('synk.world.push.v1')===null&&localStorage.getItem('qa.push.endpoint')===null);
   await context.close();}

  // ── B. 휴대폰(안드로이드, 390): 배우기 판의 묻는 카드 → 동의 시트 → 켜기 ──
  push.devices.clear();
  {const {context,page}=await device({viewport:VIEWPORTS.phone,userAgent:ANDROID,notifications:false});
   await start(page);await openLearn(page);
   const card=page.locator('#panel-content [data-reminder-card="ask"]');await card.waitFor();
   checks.askPhone=await card.innerText();assert.ok(checks.askPhone.includes(s('reminder.ask.bodyPush')),checks.askPhone);
   await record(page,'390-ko-ask-push','#panel-content [data-reminder-card="ask"]');
   await page.locator('#panel-content [data-world="reminder-push-ask"]').click();
   const sheet=page.locator('#panel-content [data-push-consent="sheet"]');await sheet.waitFor();
   await page.waitForFunction(()=>!document.querySelector('[data-push-consent="sheet"] [data-world="reminder-push-yes"]')?.disabled);
   await record(page,'390-ko-consent-sheet','#panel-content [data-push-consent="sheet"]');
   // 한 번 거절되면(설정 묶음이 없는 시트 화면) 단추가 다시 눌리고 시트 안 안내가 까닭을 말한다(10-23 화면 재확인).
   await page.evaluate(()=>localStorage.setItem('qa.push.deny','1'));
   await clearToast(page);await page.locator('#panel-content [data-world="reminder-push-yes"]').click();
   assert.equal(await toast(page),s('reminder.settings.blocked'));
   await page.waitForFunction(()=>!document.querySelector('[data-push-consent="sheet"] [data-world="reminder-push-yes"]')?.disabled);
   checks.sheetDenied=await page.locator('#panel-content [data-push-consent="sheet"] [data-push-message]').innerText();
   assert.equal(checks.sheetDenied,s('reminder.settings.blocked'));assert.equal(push.devices.size,0);
   await clearToast(page);await page.locator('#panel-content [data-world="reminder-push-yes"]').click();
   assert.equal(await toast(page),s('reminder.push.on'));
   await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open||!document.querySelector('[data-push-consent="sheet"]'));
   assert.equal(push.devices.size,1);
   // 설정: 휴대폰에서는 2단 줄 하나가 곧 학습 알림이다.
   await openSettings(page);
   assert.equal(await page.locator('#panel-content [data-reminder-enabled]').count(),0);
   await page.waitForFunction(()=>document.querySelector('#panel-content [data-push-enabled]')?.checked===true);
   await record(page,'390-ko-settings-push','#panel-content [data-reminder-settings]');
   // 휴대폰에서 끄면 이 기기 알림이 정말 꺼진다(1단이 없다) — 「이 기기의 알림을 껐어요」.
   await clearToast(page);await page.locator('#panel-content [data-push-enabled]').click({force:true});
   checks.offPhoneToast=await toast(page);assert.equal(checks.offPhoneToast,s('reminder.push.off'));
   assert.equal(push.devices.size,0);
   await context.close();}

  // ── C. 아이폰(390): 2단 줄 없이 「아직 앱을 닫은 채로 받을 수 없어요」, 다른 기기에서 켰으면 그 기기로 간다는 말 ──
  // 다른 기기(안드로이드)에서 2단을 켜 둔 계정.
  push.devices.set('https://fcm.googleapis.com/fcm/send/qa-other-device','00000000-0000-4000-8000-0000000000aa');
  {const {context,page}=await device({viewport:VIEWPORTS.phone,userAgent:IPHONE,notifications:false});
   await start(page);await openSettings(page);
   await page.waitForFunction(()=>/\S/.test(document.querySelector('#panel-content [data-reminder-status]')?.textContent||''));
   checks.iphone=await page.locator('#panel-content [data-reminder-settings]').innerText();
   assert.equal(await page.locator('#panel-content [data-push-enabled]').count(),0);
   assert.ok(checks.iphone.includes(s('reminder.push.status.away')),checks.iphone);
   await record(page,'390-ko-settings-iphone','#panel-content [data-reminder-settings]');
   await context.close();}

  // ── D. 세 언어: 동의 상자(1280)와 휴대폰 시트(390) ──
  push.devices.clear();
  for(const lang of ['en','mn']){
   const {context,page}=await device({lang});
   await start(page,lang);await openSettings(page);
   await swActive(page);
   await page.locator('#panel-content [data-push-enabled]').click({force:true});
   await page.locator('#panel-content [data-push-consent="settings"]').waitFor();
   await page.locator('#panel-content .reminder-push-more summary').click();
   checks[`consent-${lang}`]=await page.locator('#panel-content [data-push-consent="settings"]').innerText();
   for(const key of ['reminder.push.consent.title','reminder.push.consent.keep','reminder.push.consent.never','reminder.push.consent.yes'])assert.ok(checks[`consent-${lang}`].includes(s(key,lang)),`${lang} ${key}`);
   await record(page,`1280-${lang}-consent`,'#panel-content [data-reminder-settings]');
   await page.setViewportSize(VIEWPORTS.phone);await page.waitForTimeout(200);await record(page,`390-${lang}-consent`,'#panel-content [data-reminder-settings]');
   await context.close();
  }
  // ── E. 설정값 worldPush 꺼짐(켜기 전 공개본과 같은 설정): 서버가 켜져 있어도 2단을 묻지도 그리지도 않는다 ──
  push.devices.clear();
  {const before=push.calls.length;
   const desk=await device({features:false});
   await start(desk.page);
   assert.equal(await desk.page.evaluate(()=>JSON.parse(document.getElementById('synk-world-config').textContent).features??null),null,'진입 설정에 features가 없다');
   await openSettings(desk.page);
   await desk.page.waitForFunction(()=>/\S/.test(document.querySelector('#panel-content [data-reminder-status]')?.textContent||''));
   checks.offDesk=await desk.page.locator('#panel-content [data-reminder-settings]').innerText();
   assert.equal(await desk.page.locator('#panel-content [data-push-row], #panel-content [data-push-enabled]').count(),0,'PC: 2단 줄이 없다');
   assert.equal(await desk.page.evaluate(()=>window.__synkReminders.metrics().push),null);
   assert.equal(await desk.page.evaluate(()=>navigator.serviceWorker.getRegistration('/world/').then(Boolean)),false,'서비스 워커를 등록하지 않는다');
   await desk.context.close();
   const phone=await device({features:false,viewport:VIEWPORTS.phone,userAgent:IPHONE,notifications:false});
   await start(phone.page);await openSettings(phone.page);
   await phone.page.waitForFunction(()=>/\S/.test(document.querySelector('#panel-content [data-reminder-status]')?.textContent||''));
   checks.offIphone=await phone.page.locator('#panel-content [data-reminder-status]').innerText();
   assert.ok(checks.offIphone.includes(s('reminder.settings.unsupported')),checks.offIphone);
   assert.ok(!checks.offIphone.includes(s('reminder.push.unsupported.ios')),checks.offIphone);
   await phone.context.close();
   assert.deepEqual(push.calls.slice(before).map(call=>call.action),[],'설정값이 꺼져 있으면 world-push를 한 번도 부르지 않는다');}

  for(const [name,m] of Object.entries(measures))assert.ok(clean(m),`${name}: ${JSON.stringify(m)}`);
  assert.deepEqual(unexpected,[]);
  assert.deepEqual(errors,[]);
 }finally{
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({at:new Date().toISOString(),shots,measures,checks,pushCalls:push.calls.map(call=>({action:call.action,authed:call.authed,keys:Object.keys(call.body||{}).sort()})),errors,external:[...new Set(external)].slice(0,20),unexpected},null,1));
  await browser?.close();server.kill();
 }
});
