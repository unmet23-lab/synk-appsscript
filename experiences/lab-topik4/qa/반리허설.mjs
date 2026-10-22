// TOPIK 4급 온라인 반 한 주 리허설 — 시험 학생·시험 교사로 반 연결 → 실시간 수업 → 복습 영상 → 「이번 주 과제」 → 교사 「과제 첨삭」 → 학생이 돌려받기.
//   node experiences/lab-topik4/qa/반리허설.mjs [--out <폴더>] [--local <공개 경로>=<저장소 파일> ...]
// · 화면은 운영 그대로다: 공개된 synk.im/world와 회사 워크스페이스(workspace.synk.im)의 교사 화면 파일을 브라우저로 연다.
//   계정·수업·과제 요청은 모두 로컬 리허설 서버(반리허설-서버.mjs — 운영과 같은 판의 SYNK-talk 코드 + PGlite)로 돌리고, 운영 API 주소는 막는다.
//   --local은 고친 파일을 공개 전 확인할 때 그 공개 경로만 저장소 파일로 바꿔 낸다(예: --local world/classroom-lessons.mjs=experiences/synk-world-app/classroom-lessons.mjs).
// · 교사 화면의 부모는 계정 포털 teacher-workspace.mjs와 같은 꼴의 수업 호스트다(회사 중계 /api/teaching/*는 거치지 않는다).
// · 교실 PC 쪽은 실제 송출 도구(tools/classroom-media/worker.js)에 가짜 YouTube만 끼워 실제 classroom-sync로 동기화한다.
// · 시계: 과제·연결 서버와 두 화면은 1기 가상 일정(2026-10-24 토요일 개강)을 따라 움직이고, 수업의 「지금 수업 중」 신호는 실제 시각으로 잰다(서버가 DB 시각으로 잰다).
// 결과(캡처·result.json)는 --out(기본 공용 작업본 .tmp/topik4-rehearsal-20261022/)에 쓴다. git 밖이다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createRehearsalServer,listen,CHANNEL,PLAYLIST,SYNC_KEY} from './반리허설-서버.mjs';

const appRoot=fileURLToPath(new URL('../../../',import.meta.url)),mainRoot=appRoot.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0];
const require=createRequire(import.meta.url),playwright=require('playwright');
const {Worker}=require(path.join(appRoot,'tools/classroom-media/worker.js'));
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const out=path.resolve(flag('--out')||path.join(mainRoot,'.tmp/topik4-rehearsal-20261022'));
const overrides=new Map();for(let i=0;i<args.length;i++)if(args[i]==='--local'){const at=args[i+1].indexOf('='),pub=args[i+1].slice(0,at),file=args[i+1].slice(at+1);overrides.set('/'+pub.replace(/^\//,''),path.isAbsolute(file)?file:path.join(appRoot,file));}
for(const [pub,file] of overrides)if(!fs.existsSync(file))throw Error(`--local ${pub}의 파일이 없다: ${file}`);
const talkRoot=path.resolve(process.env.SYNK_TALK_ROOT||path.join(mainRoot,'../SYNK-worktrees/talk-classroom-release-20261020'));
const KST=text=>Date.parse(text+'+09:00');
const IDENTITY='https://identity.example.test',WORLD='https://synk.im',WORKSPACE='https://workspace.synk.im',PRODUCTION_API='qiwxeddwwnzkwalpsuty.supabase.co';
const VIEW={phone:{width:390,height:844},desktop:{width:1280,height:800}};
fs.mkdirSync(out,{recursive:true});

const result={startedAt:new Date().toISOString(),frontend:{world:WORLD+'/world/',teacher:WORKSPACE+'/teacher-world/?account=1',overrides:[...overrides].map(([p,f])=>p+' ← '+path.relative(appRoot,f))},
 backend:{talkRoot,lessonRef:'origin/codex/classroom-distribution-20261009'},steps:[],requests:{blockedProduction:[],external:[],unexpected:[]},errors:[],http:[]};
let current='';
const step=(id,title)=>{const s={id,title,checks:[],shots:[],notes:[]};result.steps.push(s);console.log('\n== '+id+' '+title);return s;};
const check=(s,label,ok,detail)=>{s.checks.push({label,ok:!!ok,...(detail!==undefined?{detail}:{})});console.log((ok?'  ✓ ':'  ✗ ')+label+(detail!==undefined?' — '+(typeof detail==='string'?detail:JSON.stringify(detail)).slice(0,300):''));return !!ok;};
const note=(s,text)=>{s.notes.push(text);console.log('  · '+text);};

let clock=KST('2026-10-23T20:00:00');
const backend=await createRehearsalServer({talkRoot,appRoot,now:()=>clock});
const api=await listen({backend,appRoot});
const C=backend.cls.class_id;

// ── 브라우저: 운영 화면 + 로컬 리허설 서버 ──
const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
const worldConfig={mode:'account',basePath:'/world/',account:{version:1,supabaseUrl:IDENTITY,supabasePublishableKey:'sb_publishable_rehearsal',accountApiUrl:IDENTITY,portalUrl:IDENTITY+'/',clients:{world:{clientId:'world-rehearsal',redirectUri:WORLD+'/world/'}}}};
const {emptyPlayState}=await import('file:///'+path.join(appRoot,'experiences/play-common/play-data.mjs').replace(/\\/g,'/'));
const playState=emptyPlayState();let playRevision=0;const played=new Map();
const cors={'Access-Control-Allow-Origin':'*'};
async function forward(route){
 const req=route.request(),target=new URL(req.url());
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{...cors,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, POST, PUT'}});
 const headers=await req.allHeaders(),body=req.postDataBuffer();
 const response=await backend.handle(new Request(IDENTITY+target.pathname+target.search,{method:req.method(),headers:Object.fromEntries(Object.entries(headers).filter(([k])=>!k.startsWith(':'))),...(body&&['POST','PUT'].includes(req.method())?{body}:{})}));
 if(response)return route.fulfill({status:response.status,headers:{...cors,'Content-Type':response.headers.get('content-type')||'application/json'},body:Buffer.from(await response.arrayBuffer())});
 // 수업 흐름 밖의 WORLD 요청(놀이 기록·옷장·개인 기록)은 시험 계정의 빈 답으로 둔다(classroom-homework-browser.test.mjs와 같다).
 const json=req.postDataJSON?.()??null,p=target.pathname,accountId=backend.student.account;let status=200,data;
 if(p.endsWith('/synk-play')){if(json?.id&&played.has(json.id))data=played.get(json.id);else{if(json?.action==='progress')for(const c of json.changes){if(c.value===null)delete playState.records[c.key];else playState.records[c.key]=c.value;}data={ok:true,scope:'synk-play',accountId,revision:json?++playRevision:playRevision,state:structuredClone(playState)};if(json?.id)played.set(json.id,data);}}
 else if(p.endsWith('/synk-world-v1/bootstrap'))data={ok:true,accountId,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
 else if(p.endsWith('/synk-personal')){status=403;data={ok:false,error:{code:'PRODUCT_FORBIDDEN'}};}
 else if(p.startsWith('/auth/v1/logout'))data={};
 else{result.requests.unexpected.push(req.method()+' '+p);status=404;data={ok:false,error:{code:'NOT_IN_REHEARSAL'}};}
 return route.fulfill({status,headers:{...cors,'Content-Type':'application/json'},body:JSON.stringify(data)});
}
async function guard(context){
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname===PRODUCTION_API){result.requests.blockedProduction.push(route.request().method()+' '+url.pathname);return route.abort('blockedbyclient');}
  if(url.origin===IDENTITY)return forward(route);
  if(url.origin===WORLD&&url.pathname==='/world/world-config.json')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(worldConfig)});
  // 공개 WORLD는 계정 설정을 HTML의 <script id="synk-world-config">에 싣는다. 그 JSON만 리허설 주소로 바꾼다.
  if(url.origin===WORLD&&url.pathname==='/world/'){
   const live=await route.fetch(),html=await live.text(),pattern=/(<script[^>]*id="synk-world-config"[^>]*>)([\s\S]*?)(<\/script>)/;
   if(!pattern.test(html))throw Error('공개 WORLD HTML에 계정 설정 칸이 없다');
   return route.fulfill({response:live,body:html.replace(pattern,(_,open,__,close)=>open+JSON.stringify(worldConfig)+close)});
  }
  if((url.origin===WORLD||url.origin===WORKSPACE)&&overrides.has(url.pathname))return route.fulfill({status:200,contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript; charset=utf-8',body:fs.readFileSync(overrides.get(url.pathname))});
  // 교사 화면의 부모 호스트와 그 통로는 로컬에서 낸다(같은 출처 iframe이어야 하므로 workspace.synk.im 주소로 덮는다).
  if(url.origin===WORKSPACE&&(url.pathname.startsWith('/qa/')||url.pathname.startsWith('/synk-account/src/')||url.pathname.startsWith('/functions/v1/'))){
   const req=route.request(),body=req.postDataBuffer(),headers=Object.fromEntries(Object.entries(await req.allHeaders()).filter(([k])=>!k.startsWith(':')));
   const r=await fetch(api.origin+url.pathname+url.search,{method:req.method(),headers,...(body&&req.method()!=='GET'?{body}:{})});
   return route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});
  }
  if(url.origin===WORLD||url.origin===WORKSPACE||url.protocol==='data:'||url.protocol==='blob:')return route.continue();
  result.requests.external.push(url.origin+url.pathname);return route.abort('blockedbyclient');
 });
}
async function open(kind,viewport){
 const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce',serviceWorkers:'block'});context.setDefaultTimeout(30000);
 await guard(context);await context.clock.setFixedTime(clock);
 if(kind==='world')await context.addInitScript(token=>{if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:token,refresh_token:null,expires_at:Date.now()+8*3600000}));},backend.student.token);
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(kind+': '+e.message));
 page.on('response',r=>{if(r.status()>=400){const u=new URL(r.url());result.http.push({at:current,kind,status:r.status(),path:u.pathname});}});
 return {context,page};
}
const setTime=async(pages,text)=>{clock=KST(text);for(const p of pages)await p.context().clock.setFixedTime(clock);};
let shotNo=0;
async function shot(s,page,name,{full=false,focus=null}={}){const file=String(++shotNo).padStart(2,'0')+'-'+name+'.png';await page.evaluate(()=>document.fonts?.ready);
 if(focus)await page.evaluate(sel=>{const p=document.querySelector('#world-panel');if(p)p.style.scrollBehavior='auto';document.querySelector(sel)?.scrollIntoView({block:'start'});},focus).then(()=>page.waitForTimeout(200));await page.screenshot({path:path.join(out,file),fullPage:full});s.shots.push(file);return file;}

// ── WORLD 학생 화면 ──
const worldView=await open('world',VIEW.phone),world=worldView.page;
await world.goto(WORLD+'/world/?opening=off',{waitUntil:'domcontentloaded'});
try{await world.waitForFunction(()=>window.__synkWorld?.client?.status==='ready',null,{timeout:60000});}
catch(error){console.log('WORLD 준비 실패',await world.evaluate(()=>({status:window.__synkWorld?.client?.status,has:!!window.__synkWorld,text:document.body.innerText.slice(0,500)})),JSON.stringify(result.requests),result.errors.slice(0,8),backend.calls.slice(-10));throw error;}
async function firstRun(){
 await world.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
 if(await world.locator('[data-lang-picker]').count()){await world.locator('[data-lang-choice="ko"]').click();await world.locator('[data-lang-confirm]').click();await world.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
 await world.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
 if(await world.locator('dialog[open] [data-first-hangul="reads"]').count()){await world.locator('dialog[open] [data-first-hangul="reads"]').click();await world.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}
 await world.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
 if(await world.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await world.locator('.tutor-option[data-tutor-id="mongle"]').click();await world.locator('.tutor-primary').click();await world.locator('.tutor-primary[data-tutor-action="finish"]').click();}
 await world.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');
}
async function profile(){
 if(await world.evaluate(()=>document.querySelector('#world-panel')?.open)){await world.locator('#panel-close').click();await world.waitForFunction(()=>!document.querySelector('#world-panel')?.open);}
 await world.locator('.profile-control[data-view="me"]').click();
 await world.waitForFunction(()=>document.querySelector('#world-panel')?.open);
}
const sectionText=selector=>world.evaluate(sel=>{const el=document.querySelector(sel);return el?(el.hidden||!el.getClientRects().length?'(숨김)':el.innerText.replace(/\n{2,}/g,'\n').trim()):'(없음)';},selector);

// ── 교사 화면(회사 워크스페이스 교사 화면 파일 + 리허설 수업 호스트) ──
const teacherView=await open('teacher',VIEW.desktop),teacherPage=teacherView.page;
await teacherPage.goto(WORKSPACE+'/qa/teacher.html?class='+C,{waitUntil:'domcontentloaded'});
const teacherFrame=async()=>{const handle=await teacherPage.waitForSelector('#frame');return handle.contentFrame();};

// ── 교실 PC: 실제 송출 도구 + 가짜 YouTube(온라인 반 예시 설정 config.online.example.json의 꼴) ──
const VIDEO='rhrsLive001',STREAM='onlineStream01';
const SESSION={classId:C,roomId:'online',sessionKey:'2026-10-24T19:30:00+09:00',title:'1주차 토요일 수업 · 시험 구조와 51번',startsAt:'2026-10-24T19:30:00+09:00',endsAt:'2026-10-24T21:00:00+09:00'};
const yt={privacy:'unlisted',playlistPrivacy:'unlisted',lifecycle:'ready',processed:false,bound:STREAM,playlistItems:false,streamStatus:'inactive',streamHealth:'noData'};
const youtube={
 async verifyIdentity(){},
 async request(resource,options={}){
  if(resource==='playlists')return {items:[{snippet:{channelId:CHANNEL},status:{privacyStatus:yt.playlistPrivacy}}]};
  if(resource==='liveStreams')return {items:options.query.id.split(',').map(id=>({id,snippet:{channelId:CHANNEL},status:{streamStatus:yt.streamStatus,healthStatus:{status:yt.streamHealth,configurationIssues:[]}},contentDetails:{isReusable:true}}))};
  if(resource==='liveBroadcasts'&&options.method==='POST')return {id:VIDEO};
  if(resource==='liveBroadcasts')return {items:[{id:VIDEO,snippet:{channelId:CHANNEL,...(yt.lifecycle==='complete'?{actualStartTime:SESSION.startsAt,actualEndTime:SESSION.endsAt}:yt.lifecycle==='live'?{actualStartTime:SESSION.startsAt}:{})},status:{privacyStatus:yt.privacy,lifeCycleStatus:yt.lifecycle},contentDetails:{boundStreamId:yt.bound}}]};
  if(resource==='liveBroadcasts/bind'){yt.bound=options.query.streamId;return {id:VIDEO};}
  if(resource==='videos')return {items:[{id:VIDEO,snippet:{channelId:CHANNEL},status:{privacyStatus:yt.privacy,uploadStatus:yt.processed?'processed':'uploaded'},processingDetails:{processingStatus:yt.processed?'succeeded':'processing'},liveStreamingDetails:yt.lifecycle==='complete'?{actualStartTime:SESSION.startsAt,actualEndTime:SESSION.endsAt}:yt.lifecycle==='live'?{actualStartTime:SESSION.startsAt}:{}}]};
  if(resource==='playlistItems'&&options.method==='POST'){yt.playlistItems=true;return {id:'item1'};}
  if(resource==='playlistItems')return {items:yt.playlistItems?[{id:'item1'}]:[]};
  throw Error('가짜 YouTube에 없는 요청 '+resource);
 },
 async raw(){throw Error('리허설은 녹화 파일을 올리지 않는다');},
};
const workerDir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-rehearsal-worker-'));for(const d of ['state','inbox','recordings'])fs.mkdirSync(path.join(workerDir,d));
const workerConfig={...JSON.parse(fs.readFileSync(path.join(appRoot,'tools/classroom-media/config.online.example.json'),'utf8')),expectedChannelId:CHANNEL,stateDir:path.join(workerDir,'state'),inboxDir:path.join(workerDir,'inbox'),recordingsRoot:path.join(workerDir,'recordings'),syncUrl:IDENTITY+'/functions/v1/classroom-sync'};
workerConfig.rooms=[{...workerConfig.rooms[0],streamId:STREAM}];workerConfig.classes=[{...workerConfig.classes[0],classId:C,displayName:'TOPIK 4급 온라인 리허설반 (시험)',playlistId:PLAYLIST}];
const fixDir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-rehearsal-fix-'));let workerTime=Date.now();const syncs=[];
const worker=new Worker(workerConfig,{youtube,env:{SYNK_SUPABASE_ANON_KEY:'sb_publishable_rehearsal',SYNK_CLASSROOM_ONLINE_1_KEY:SYNC_KEY},now:()=>workerTime,
 fetchImpl:async(url,options)=>{const r=await backend.handle(new Request(url,{method:options.method,headers:options.headers,body:options.body}));const text=await r.text();syncs.push({body:JSON.parse(options.body),status:r.status,reply:text.slice(0,200)});return new Response(text,{status:r.status,headers:{'content-type':'application/json'}});}});
const tick=async()=>{workerTime+=61000;const r=await worker.once();return r;};

const controls=frame=>frame.evaluate(()=>[...document.querySelectorAll('button,a,[role=button],input,select,textarea,summary')].filter(n=>n.getClientRects().length).map(n=>[n.tagName.toLowerCase(),n.id||'',n.dataset.hrKey||n.dataset.homeworkKey||n.dataset.classroomKey||'',(n.innerText||n.value||n.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,40)].filter(Boolean).join('|')));
const hw=sel=>world.locator(`#world-classroom-homework [data-homework-key="${sel}"]`);
const lessonsText=()=>sectionText('#world-classroom-lessons'),homeworkText=()=>sectionText('#world-classroom-homework');
const settle=async()=>{await world.waitForFunction(()=>{const l=document.querySelector('#world-classroom-lessons [data-state]')||document.querySelector('#world-classroom-lessons');const h=document.querySelector('#world-classroom-homework .ws-hw');return (!l||l.dataset.state!=='loading')&&(!h||h.dataset.state!=='loading');});await world.waitForTimeout(300);};
async function reloadWorld(){await world.reload({waitUntil:'domcontentloaded'});await world.waitForFunction(()=>window.__synkWorld?.client?.status==='ready',null,{timeout:60000});await world.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');await profile();await settle();}
const KEY=JSON.parse(fs.readFileSync(path.join(appRoot,'experiences/synk-world-app/topik4-homework-key.json'),'utf8'));
async function run(){
 // ── 0. 반 세우기와 학생 연결 ──
 let s=step('0','반 세우기와 학생 연결(개강 전 금요일)');current=s.id;
 note(s,'관리자 몫 — 운영에는 반·교사 배정·명부를 만드는 화면이나 API가 없어 SQL로만 넣는다. 리허설 서버가 반 1·교사 배정 1·명부 줄 1(계정 없음, is_test)을 만들었다.');
 await firstRun();await profile();await settle();
 check(s,'학생 WORLD 내 계정 시트에 「내 반 연결」 칸이 있다',await world.locator('#world-classroom-entry input[name="invite"]').count()===1);
 check(s,'연결 전 「이번 주 과제」 칸은 숨는다(반 없는 계정)',['(숨김)','(없음)',''].includes(await homeworkText()),await homeworkText());
 await shot(s,world,'학생-연결전',{focus:'#world-classroom-entry'});
 let frame=await teacherFrame();await frame.waitForSelector('text=시험 학생 하늘 (시험)');
 await frame.locator('button:has-text("시험 학생 하늘 (시험)")').first().click();await teacherPage.waitForTimeout(800);
 const prodInvite=await frame.locator('#student-invite').count();
 check(s,'[운영 교사 화면] 계정 없는 학생에게 「학생 연결 코드 만들기」가 보인다',prodInvite===1,prodInvite?'보임':'안 보임 — 운영 app.mjs가 서버의 revoked:true(계정 없는 명부 학생)로 단추를 숨긴다');
 await shot(s,teacherPage,'교사-운영판-연결코드-단추없음');
 if(!prodInvite){
  note(s,'고친 판: master의 교사 app.mjs(a1cc2e8a2 — 회사 이력 22(사슬 23) 대기)로 같은 화면을 다시 연다.');
  const master=fs.readFileSync(path.join(appRoot,'experiences/teacher-world/app.mjs'),'utf8'),line="$('course-writing-nav').hidden=!accountRequested;";if(!master.includes(line))throw Error('교사 app.mjs의 과정 쓰기 메뉴 줄이 바뀌었다');
  const patched=path.join(fixDir,'teacher-app-release23.mjs');fs.writeFileSync(patched,master.replace(line,"$('course-writing-nav').hidden=true;"));overrides.set('/teacher-world/app.mjs',patched);
  await teacherPage.reload({waitUntil:'domcontentloaded'});frame=await teacherFrame();await frame.waitForSelector('text=시험 학생 하늘 (시험)');
  await frame.locator('button:has-text("시험 학생 하늘 (시험)")').first().click();await teacherPage.waitForTimeout(800);
 }
 check(s,'「학생 연결 코드 만들기」 단추',await frame.locator('#student-invite').count()===1);
 await frame.locator('#student-invite').click();
 await frame.waitForFunction(()=>/^[A-Za-z0-9_-]{22,128}$/.test(document.querySelector('#student-invite-code')?.value||''));
 const code=await frame.locator('#student-invite-code').inputValue(),expiry=await frame.locator('#student-invite-expiry').innerText();
 check(s,'교사가 연결 코드를 받았다',/^[a-f0-9]{32}$/.test(code),code.slice(0,4)+'… · '+expiry);
 await shot(s,teacherPage,'교사-연결코드');
 // 학생이 휴대폰으로 코드를 옮겨 적는다: 먼저 대문자로(자판 자동 대문자·발표 화면의 대문자) 넣어 본다.
 const upper=code.toUpperCase(),input=world.locator('#world-classroom-entry input[name="invite"]');
 await input.fill(upper);await world.locator('#world-classroom-entry button:has-text("이름과 반 확인")').click();await world.waitForTimeout(1500);
 const upperStatus=await world.locator('#world-classroom-entry [role="status"]').innerText();
 check(s,'코드를 대문자로 옮겨 적어도 연결된다',!/맞지 않|다시|INVALID|오류/.test(upperStatus)&&await world.locator('#world-classroom-entry button:has-text("이 계정으로 내 반 연결")').isVisible(),upperStatus||'(안내 없음)');
 await shot(s,world,'학생-대문자코드',{focus:'#world-classroom-entry'});
 const attrs=await input.evaluate(el=>({autocapitalize:el.getAttribute('autocapitalize'),inputmode:el.getAttribute('inputmode'),autocomplete:el.getAttribute('autocomplete')}));
 check(s,'휴대폰 자판이 첫 글자를 대문자로 바꾸지 않게 막아 두었다(autocapitalize)',attrs.autocapitalize==='none'||attrs.autocapitalize==='off',attrs);
 await input.fill(code);await world.locator('#world-classroom-entry button:has-text("이름과 반 확인")').click();
 await world.locator('#world-classroom-entry button:has-text("이 계정으로 내 반 연결")').waitFor();
 const preview=await sectionText('#world-classroom-entry');
 check(s,'코드 확인에 반 이름·학생 이름이 보인다',preview.includes('TOPIK 4급 온라인 리허설반 (시험)')&&preview.includes('시험 학생 하늘 (시험)'),preview.split('\n').slice(0,6).join(' / '));
 await shot(s,world,'학생-코드확인',{focus:'#world-classroom-entry'});
 await world.locator('#world-classroom-entry button:has-text("이 계정으로 내 반 연결")').click();
 await world.waitForFunction(()=>!document.querySelector('#world-classroom-entry input[name="invite"]')||/연결했|연결됐|연결되었/.test(document.querySelector('#world-classroom-entry')?.innerText||''),null,{timeout:30000}).catch(()=>{});
 await world.waitForTimeout(1500);await profile();await settle();
 const [linked]=await backend.sql`select auth_user_id from engine.learners where learner_id=${backend.learner.learner_id}::uuid`;
 check(s,'명부 줄에 학생 SYNK ID가 이어졌다',!!linked?.auth_user_id,linked?.auth_user_id?'연결됨':'비어 있음');
 const lessonsLinked=await lessonsText();
 check(s,'연결 직후 「우리 반 수업」 안내가 이미 연결한 학생에게 맞다',!/반 연결을 확인해/.test(lessonsLinked),lessonsLinked.split('\n').slice(0,4).join(' / '));
 await shot(s,world,'학생-연결뒤',{focus:'#world-classroom-lessons'});
 const teacherAfter=await (async()=>{await frame.locator('#refresh').click().catch(()=>{});await teacherPage.waitForTimeout(1200);return frame.evaluate(()=>document.body.innerText.includes('계정 연결 대기'));})();
 check(s,'교사 목록에서 「계정 연결 대기」가 풀렸다',!teacherAfter);
 // 수업 영상 문(반 영상 설정·이용권) — 운영은 관리자가 SQL로 넣는다.
 await backend.openLessons({privacy:'unlisted'});note(s,'관리자 몫 — classroom_channels(일부공개)와 classroom_access(이용권)를 넣었다(「내 반 연결」로는 생기지 않는다).');
 await world.locator('#world-classroom-lessons [data-classroom-key="refresh"], #world-classroom-lessons button:has-text("새로고침")').first().click();await settle();
 const lessonsOpen=await lessonsText();
 check(s,'이용권을 넣으면 「우리 반 수업」에 반이 보인다',lessonsOpen.includes('TOPIK 4급 온라인 리허설반 (시험)'),lessonsOpen.split('\n').slice(0,6).join(' / '));
 // 반 계획(교사 「04 주차 과제 첨삭」)
 await frame.locator('#homework-nav').click();await frame.locator('[data-hr-key="plan:start"]').waitFor();
 await frame.locator('[data-hr-key="plan:start"]').fill('2026-10-24');await teacherPage.waitForTimeout(400);
 const planPreview=await frame.evaluate(()=>document.querySelector('[data-hr-key="plan:start"]')?.closest('form,section,div')?.innerText||'');
 note(s,'계획 미리 보기: '+planPreview.replace(/\s+/g,' ').slice(0,220));
 await shot(s,teacherPage,'교사-반계획');
 await frame.locator('[data-hr-key="plan:submit"]').click();
 await frame.waitForSelector('[data-hr-key="week:1"]',{timeout:20000});
 const [plan]=await backend.sql`select starts_on,weeks,revision from engine.synk_class_homework_plans where class_id=${C}::uuid`;
 check(s,'반 계획이 서버에 저장됐다(2026-10-24 · 8주)',plan&&plan.weeks===8,plan);
 await shot(s,teacherPage,'교사-계획뒤');

 // ── 1. 실시간 수업 송출 ──
 s=step('1','실시간 수업 송출(토요일 19:30)');current=s.id;
 await setTime([world,teacherPage],'2026-10-24T19:20:00');
 await worker.prepare(SESSION);
 check(s,'교실 PC 송출 도구가 방송을 준비하고 앱에 「예정」으로 알렸다',syncs.at(-1)?.status===200&&syncs.at(-1)?.body.status==='scheduled',{sync:syncs.at(-1)?.body.status,http:syncs.at(-1)?.status,reply:syncs.at(-1)?.reply});
 await reloadWorld();
 const scheduled=await lessonsText();
 check(s,'학생 화면에 예정 수업이 보인다',scheduled.includes(SESSION.title),scheduled.split('\n').slice(0,8).join(' / '));
 await shot(s,world,'학생-예정수업',{focus:'#world-classroom-lessons'});
 await setTime([world,teacherPage],'2026-10-24T19:31:00');
 yt.lifecycle='live';yt.streamStatus='active';yt.streamHealth='good';
 const liveRun=await tick();
 check(s,'방송이 켜지자 송출 도구가 「live」를 보냈다',syncs.at(-1)?.body.status==='live'&&syncs.at(-1)?.status===200,{failures:liveRun.failures,sync:syncs.at(-1)?.body.status,http:syncs.at(-1)?.status,reply:syncs.at(-1)?.reply});
 await world.locator('#world-classroom-lessons button:has-text("새로고침")').first().click();await settle();
 const live=await lessonsText(),liveHref=await world.locator('#world-classroom-lessons a:has-text("실시간 수업 보기")').getAttribute('href').catch(()=>null);
 check(s,'학생 화면에 「지금 수업 중」과 「실시간 수업 보기」가 뜬다',live.includes('지금 수업 중')&&!!liveHref,live.split('\n').slice(0,6).join(' / '));
 check(s,'「실시간 수업 보기」가 이 방송의 YouTube 주소로 열린다',liveHref==='https://www.youtube.com/watch?v='+VIDEO,liveHref);
 await shot(s,world,'학생-지금수업중',{focus:'#world-classroom-lessons'});

 // ── 2. 복습 영상 ──
 s=step('2','복습 영상(방송이 끝난 뒤)');current=s.id;
 await setTime([world,teacherPage],'2026-10-24T21:02:00');
 yt.lifecycle='complete';yt.streamStatus='inactive';yt.processed=false;
 const endRun=await tick();
 check(s,'방송이 끝나자 「processing」(복습 영상 준비 중)을 보냈다',syncs.at(-1)?.body.status==='processing'&&syncs.at(-1)?.status===200,{failures:endRun.failures,sync:syncs.at(-1)?.body.status,http:syncs.at(-1)?.status,reply:syncs.at(-1)?.reply});
 await world.locator('#world-classroom-lessons button:has-text("새로고침")').first().click();await settle();
 const processing=await lessonsText();
 check(s,'학생 화면이 「복습 영상 준비 중」으로 바뀐다',/복습 영상 준비 중|준비 중/.test(processing)&&!processing.includes('지금 수업 중'),processing.split('\n').slice(0,6).join(' / '));
 await shot(s,world,'학생-복습준비중',{focus:'#world-classroom-lessons'});
 await setTime([world,teacherPage],'2026-10-24T21:40:00');
 yt.processed=true;const readyRun=await tick();
 check(s,'처리가 끝나자 「ready」(복습)를 보냈다',syncs.at(-1)?.body.status==='ready'&&syncs.at(-1)?.status===200,{failures:readyRun.failures,sync:syncs.at(-1)?.body.status,http:syncs.at(-1)?.status});
 await world.locator('#world-classroom-lessons button:has-text("새로고침")').first().click();await settle();
 const ready=await lessonsText(),replayHref=await world.locator('#world-classroom-lessons a:has-text("복습하기")').first().getAttribute('href').catch(()=>null);
 check(s,'학생 화면에 「복습하기」가 뜨고 같은 영상으로 열린다',replayHref==='https://www.youtube.com/watch?v='+VIDEO,{href:replayHref,text:ready.split('\n').slice(0,6).join(' / ')});
 await shot(s,world,'학생-복습하기',{focus:'#world-classroom-lessons'});
 const [row]=await backend.sql`select status,source,youtube_video_id,starts_at,ends_at,last_sync_sequence from engine.classroom_sessions where class_id=${C}::uuid`;
 note(s,'서버 기록: '+JSON.stringify(row));

 // ── 3. 「이번 주 과제」 내기 ──
 s=step('3','「이번 주 과제」 내기(월요일 밤)');current=s.id;
 await setTime([world,teacherPage],'2026-10-26T21:00:00');await reloadWorld();
 const week1=await homeworkText();
 check(s,'「이번 주 과제」에 1주차와 마감(수요일 23:00)이 보인다',/1주차/.test(week1)&&/10월 28일/.test(week1),week1.split('\n').slice(0,6).join(' / '));
 await shot(s,world,'학생-이번주과제',{focus:'#world-classroom-homework'});
 const taskKey=kind=>`${C}:1:${kind}`;
 await hw('open:'+taskKey('reading')).click();await world.locator('#world-classroom-homework .ws-hw-option').first().waitFor();
 const picks={'R1-1':3,'R1-2':1,'R1-3':4,'R1-4':2,'R1-5':2};
 for(const [item,n] of Object.entries(picks))await hw(`option:${C}:${item}:${n}`).click();
 await shot(s,world,'학생-읽기고름');
 await hw(`send:${C}:1:reading`).click();
 await world.locator('#world-classroom-homework .ws-hw-reading .ws-hw-judge').first().waitFor({timeout:20000});
 const readingResult=await world.locator('#world-classroom-homework .ws-hw-reading .ws-hw-summary').innerText().catch(()=>'');
 const expected=Object.entries(picks).filter(([i,n])=>KEY.reading[i].answer===n).length;
 check(s,'읽기를 내자 맞힌 수와 정답·근거가 보인다',readingResult.includes(String(expected)),readingResult+' (기대 '+expected+'/5)');
 await shot(s,world,'학생-읽기결과');
 await hw('open:'+taskKey('writing')).click().catch(async()=>{await hw('open:'+taskKey('reading')).click();await hw('open:'+taskKey('writing')).click();});
 await world.locator('#world-classroom-homework .ws-hw-write textarea').first().waitFor();
 const W1={'W1-1.1':'학생증을 가지고 사무실에 와서 택배를 찾아가세요.','W1-1.2':'일주일 안에 꼭 찾아가시기 바랍니다.','W1-2.1':'가족에게 급한 일이 생겨서 내일은 학교에 갈 수 없게 되었습니다.','W1-2.2':'편한 시간을 알려 주시면 그때 찾아가겠습니다.'};
 for(const [field,text] of Object.entries(W1))await hw(`field:${taskKey('writing')}:${field}`).fill(text);
 await shot(s,world,'학생-쓰기');
 await hw(`send:${C}:1:writing`).click();
 await world.waitForFunction(()=>/냈어요/.test(document.querySelector('#world-classroom-homework')?.innerText||''),null,{timeout:20000});
 const [sub]=await backend.sql`select kind,week,revision,late,answers from engine.synk_class_homework_submissions where class_id=${C}::uuid and kind='writing'`;
 check(s,'쓰기 글이 서버에 저장됐다(1판, 마감 전)',sub&&sub.revision===1&&sub.late===false&&Object.keys(sub.answers).length===4,sub&&{revision:sub.revision,late:sub.late,fields:Object.keys(sub.answers).length});
 const afterSend=await homeworkText();
 check(s,'학생 화면에 「냈어요 · 첨삭은 금요일까지 와요」',afterSend.includes('첨삭은 금요일까지'),afterSend.split('\n').slice(0,8).join(' / '));
 await shot(s,world,'학생-쓰기낸뒤',{focus:'#world-classroom-homework'});

 // ── 4. 교사 「과제 첨삭」 ──
 s=step('4','교사 「과제 첨삭」(목요일 밤)');current=s.id;
 await setTime([world,teacherPage],'2026-10-29T20:00:00');
 await teacherPage.reload({waitUntil:'domcontentloaded'});frame=await teacherFrame();await frame.locator('#homework-nav').waitFor();
 await frame.waitForFunction(()=>/\b1\b/.test((document.querySelector('#homework-nav')?.innerText||'').replace(/^\s*04/,'')),null,{timeout:10000}).catch(()=>{});
 const navText=await frame.locator('#homework-nav').innerText();
 check(s,'메뉴 숫자에 첨삭할 글 1이 보인다',/\b1\b/.test(navText.replace(/^\s*04/,'')),navText.replace(/\s+/g,' '));
 await frame.locator('#homework-nav').click();await frame.locator('[data-hr-key="week:1"]').waitFor();
 await frame.locator('[data-hr-key="week:1"]').click();await teacherPage.waitForTimeout(800);
 const listText=await frame.evaluate(()=>document.querySelector('#homework-review, .hr, main')?.innerText||document.body.innerText);
 check(s,'1주차 목록에 시험 학생이 「새로 냄」과 읽기 맞힌 수로 보인다',listText.includes('시험 학생 하늘 (시험)')&&/새로 냄/.test(listText),listText.replace(/\s+/g,' ').match(/시험 학생 하늘 \(시험\).{0,80}/)?.[0]);
 await shot(s,teacherPage,'교사-1주차목록');
 await frame.locator('button:has-text("시험 학생 하늘 (시험)"), [role=button]:has-text("시험 학생 하늘 (시험)")').last().click();
 await frame.locator('[data-hr-key="verdict:W1-1.1:부분"]').waitFor({timeout:20000});
 const editorText=await frame.evaluate(()=>document.body.innerText);
 check(s,'첨삭 칸에 학생이 낸 글이 그대로 보인다',Object.values(W1).every(t=>editorText.includes(t)));
 check(s,'첨삭 칸에 예시답(정답 자료)이 보인다',editorText.includes(KEY.writing['W1-1'].model['W1-1.1'])||/예시답/.test(editorText));
 const verdicts={'W1-1.1':['부분','뜻은 맞아요. 안내문이라 「-십시오」로 끝내요.'],'W1-1.2':['인정',''],'W1-2.1':['인정',''],'W1-2.2':['부분','교수님께는 「찾아뵙겠습니다」가 알맞아요.']};
 for(const [field,[verdict,reason]] of Object.entries(verdicts)){await frame.locator(`[data-hr-key="verdict:${field}:${verdict}"]`).click();if(reason)await frame.locator(`[data-hr-key="reason:${field}"]`).fill(reason);}
 const fold=frame.locator('[data-hr-key="comment-fold:W1-2"]');if(await fold.count())await fold.click();
 const comment={good:'두 글 모두 빈칸 앞뒤 흐름을 정확히 이었어요.',fix:'글의 문체를 끝까지 맞춰요. 안내문은 「-십시오」, 교수님께는 높임말이에요.',retry:'「편한 시간을 알려 주시면 그때 찾아가겠습니다」를 높임말로 다시 써 보세요.'};
 for(const [k,v] of Object.entries(comment))await frame.locator(`[data-hr-key="comment:W1-2:${k}"]`).fill(v);
 await shot(s,teacherPage,'교사-첨삭쓰기',{full:true});
 await frame.locator('button:has-text("학생에게 돌려주기")').first().click();
 const confirmAnyway=frame.locator('button:has-text("그대로 돌려주기")');
 if(await confirmAnyway.isVisible({timeout:2500}).catch(()=>false)){const checklist=await frame.evaluate(()=>document.querySelector('[data-hr-key="checklist"]')?.innerText||'');note(s,'돌려주기 전 볼 것: '+checklist.replace(/\s+/g,' ').slice(0,240));await shot(s,teacherPage,'교사-돌려주기전확인');await confirmAnyway.click();}
 await teacherPage.waitForTimeout(1500);
 const [fb]=await backend.sql`select returned_at,parts from engine.synk_class_homework_feedback f join engine.synk_class_homework_submissions s using(submission_id) where s.class_id=${C}::uuid`;
 check(s,'첨삭이 학생에게 돌려준 상태로 저장됐다',!!fb?.returned_at,fb&&{returned:!!fb.returned_at,parts:Object.keys(fb.parts||{})});
 await shot(s,teacherPage,'교사-돌려준뒤');

 // ── 5. 학생이 첨삭을 돌려받기 ──
 s=step('5','학생이 첨삭을 돌려받기(금요일)');current=s.id;
 await setTime([world,teacherPage],'2026-10-30T18:00:00');await reloadWorld();
 const back=await homeworkText();
 check(s,'「이번 주 과제」 쓰기 줄이 「첨삭이 왔어요」로 바뀐다',back.includes('첨삭이 왔어요'),back.split('\n').slice(0,8).join(' / '));
 await shot(s,world,'학생-첨삭이왔어요',{focus:'#world-classroom-homework'});
 await hw('open:'+taskKey('writing')).click();await world.locator('#world-classroom-homework .ws-hw-feedback').waitFor({timeout:20000});
 const fbText=await world.locator('#world-classroom-homework .ws-hw-feedback').innerText();
 check(s,'칸마다 판정과 이유가 보인다',fbText.includes('부분')&&fbText.includes('「-십시오」로 끝내요')&&fbText.includes('찾아뵙겠습니다'),fbText.replace(/\s+/g,' ').slice(0,200));
 check(s,'한마디 세 줄(잘된 점·고칠 핵심·다시 써 볼 곳)이 보인다',Object.values(comment).every(t=>fbText.includes(t)));
 const modelBox=world.locator('#world-classroom-homework .ws-hw-feedback .ws-hw-model');
 if(await modelBox.count()){await modelBox.first().locator('summary').click().catch(()=>{});await world.waitForTimeout(800);}
 const modelText=await world.locator('#world-classroom-homework .ws-hw-feedback').innerText();
 check(s,'예시답이 열린다',modelText.includes(KEY.writing['W1-1'].model['W1-1.1']),modelText.includes('불러오') ?'불러오는 중/실패 안내':undefined);
 await shot(s,world,'학생-첨삭보기',{full:true});

 // ── 6. 다음 주로 이어지기 ──
 s=step('6','다음 주로 이어지기(2주차 월요일)');current=s.id;
 await setTime([world,teacherPage],'2026-11-02T21:00:00');await reloadWorld();
 const week2=await homeworkText();
 check(s,'2주차가 열리고 1주차는 「지난 과제」로 내려간다',/2주차/.test(week2),week2.split('\n').slice(0,6).join(' / '));
 await hw(`open:${C}:2:writing`).click();await world.locator('#world-classroom-homework .ws-hw-write').waitFor();
 const retry=await world.locator('#world-classroom-homework .ws-hw-write').innerText();
 check(s,'2주차 쓰기에 「지난주 다시 써 볼 곳」과 다시 쓸 칸이 있다',retry.includes(comment.retry)||/다시 써 볼 곳/.test(retry),retry.replace(/\s+/g,' ').slice(0,200));
 await shot(s,world,'학생-2주차다시써볼곳');
}
try{await run();}
catch(error){
 result.errors.push('멈춤('+current+'): '+(error.stack||error.message).split('\n').slice(0,3).join(' | '));console.log('\n멈춤:',error.message);
 try{await shot(result.steps.at(-1),world,'멈춤-학생');await shot(result.steps.at(-1),teacherPage,'멈춤-교사');console.log('교사 화면 단추:',(await controls(await teacherFrame())).slice(0,60).join('\n'));console.log('학생 시트:',(await sectionText('#panel-content')).slice(0,1500));}catch{}
}
finally{
 result.finishedAt=new Date().toISOString();result.syncs=syncs;result.apiCalls=backend.calls.length;
 const all=result.steps.flatMap(s=>s.checks);result.summary={checks:all.length,passed:all.filter(c=>c.ok).length,failed:all.filter(c=>!c.ok).map(c=>c.label)};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,1));
 console.log('\n결과:',result.summary.passed+'/'+result.summary.checks,'통과 · 운영 API 요청 막음',result.requests.blockedProduction.length,'· 바깥 요청',result.requests.external.length,'· 리허설 밖 요청',result.requests.unexpected.length,'· 화면 오류',result.errors.length,'→',out);
 await browser.close();await api.close();await backend.close();fs.rmSync(workerDir,{recursive:true,force:true});fs.rmSync(fixDir,{recursive:true,force:true});
}
