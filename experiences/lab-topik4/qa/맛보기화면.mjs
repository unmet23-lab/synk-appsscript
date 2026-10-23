// 맛보기 수업 영상(docs/마케팅/LAB_TOPIK4맛보기수업_20261023) 장면 10의 실제 WORLD 화면 — 3주차 53번 글을 내고 교사가 기호·한마디 세 줄로 돌려준 학생 화면.
//   node experiences/lab-topik4/qa/맛보기화면.mjs [--out <폴더>]
// · 반리허설.mjs(10-22)의 판을 그대로 쓴다: 공개된 synk.im/world와 교사 화면 파일 + 로컬 리허설 서버(운영과 같은 판의 SYNK-talk 코드 + PGlite).
//   운영 API 요청은 막는다. 학생 글은 수업 자료 W3의 가상 학생 초안, 기호·한마디는 신청 페이지 SAMPLE과 같다.
// · 학생 화면 언어는 몽골어(앱 메뉴). 「이번 주 과제」 칸 글은 지금 앱이 한국어로만 보인다(classroom-homework.mjs HOMEWORK_TEXT).
// 결과(캡처·result.json)는 --out(기본 공용 작업본 .tmp/topik4-sample-class-20261023/world-shot/)에 쓴다. git 밖이다.
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
const out=path.resolve(flag('--out')||path.join(mainRoot,'.tmp/topik4-sample-class-20261023/world-shot'));
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

// 화면에 보이는 날짜가 지금 열린 반처럼 읽히지 않게 첫 기수 목표 달(2027-03)의 예시 일정으로 둔다.
let clock=KST('2027-03-05T20:00:00');
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
 const context=await browser.newContext({viewport,deviceScaleFactor:kind==='world'?3:1,locale:kind==='world'?'mn-MN':'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce',serviceWorkers:'block'});context.setDefaultTimeout(30000);
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
 if(await world.locator('[data-lang-picker]').count()){await world.locator('[data-lang-choice="mn"]').click();await world.locator('[data-lang-confirm]').click();await world.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
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

const DRAFT='한빛대학교 언어교육원에서 유학생 400명을 조사했습니다. 아르바이트를 하는 유학생은 2022년 48%였는데 2026년 63%이 되었다. 15% 증가했다. 왜냐하면 요즘 한국 물가가 많이 올랐기 때문이다. 이유는 생활비 52%, 한국어 연습 27%, 경력 15%이다. 그래서 유학생들은 돈이 필요해서 아르바이트를 많이 한다.';
// 앱은 겹치는 기호를 받지 않는다(〔조〕 「63%이」와 겹치지 않게 〔+〕는 「2022년 48%였는데」).
const MARKS=[['+','2022년 48%였는데'],['체','조사했습니다'],['조','63%이'],['낱','15% 증가했다'],['자','왜냐하면 요즘 한국 물가가 많이 올랐기 때문이다']];
const COMMENT={good:'조사 기관과 두 해의 비율을 정확히 옮겼어요.',fix:'「물가가 많이 올랐기 때문이다」는 자료에 없는 내용이에요. 53번은 자료에 있는 것만 써요.〔자〕',retry:'「2026년 63%이 되었다. 15% 증가했다.」를 「2022년 48%에서 2026년 63%로 15%포인트 증가했다」처럼 한 문장으로 다시 써 보세요.'};
async function run(){
 // ── 0. 반 연결 · 반 계획(반리허설과 같다) ──
 let s=step('0','반 연결과 반 계획');current=s.id;
 await backend.sql`update engine.classes set display_name='TOPIK 4급 온라인 1기 (예시)' where class_id=${C}::uuid`;
 await firstRun();await profile();await settle();
 let frame=await teacherFrame();await frame.waitForSelector('text=시험 학생 하늘 (시험)');
 await frame.locator('button:has-text("시험 학생 하늘 (시험)")').first().click();await teacherPage.waitForTimeout(800);
 if(!await frame.locator('#student-invite').count()){
  const master=fs.readFileSync(path.join(appRoot,'experiences/teacher-world/app.mjs'),'utf8'),line="$('course-writing-nav').hidden=!accountRequested;";if(!master.includes(line))throw Error('교사 app.mjs의 과정 쓰기 메뉴 줄이 바뀌었다');
  const patched=path.join(fixDir,'teacher-app.mjs');fs.writeFileSync(patched,master.replace(line,"$('course-writing-nav').hidden=true;"));overrides.set('/teacher-world/app.mjs',patched);note(s,'교사 app.mjs는 master 판으로 열었다');
  await teacherPage.reload({waitUntil:'domcontentloaded'});frame=await teacherFrame();await frame.waitForSelector('text=시험 학생 하늘 (시험)');
  await frame.locator('button:has-text("시험 학생 하늘 (시험)")').first().click();await teacherPage.waitForTimeout(800);
 }
 await frame.locator('#student-invite').click();
 await frame.waitForFunction(()=>/^[A-Za-z0-9_-]{22,128}$/.test(document.querySelector('#student-invite-code')?.value||''));
 const code=await frame.locator('#student-invite-code').inputValue();
 const input=world.locator('#world-classroom-entry input[name="invite"]');
 await input.fill(code);
 // 몽골어 화면이라 단추 글이 다르다 — 「내 반 연결」 칸의 첫 단추(확인) → 다음 단추(연결)를 차례로 누른다.
 await world.locator('#world-classroom-entry button[type="submit"], #world-classroom-entry form button').first().click();
 await world.waitForTimeout(1500);
 console.log('연결 칸:',(await sectionText('#world-classroom-entry')).slice(0,400));
 const buttons=world.locator('#world-classroom-entry button');
 const n=await buttons.count();
 for(let i=n-1;i>=0;i--){const b=buttons.nth(i);if(await b.isVisible()){await b.click();break;}}
 await world.waitForFunction(()=>!document.querySelector('#world-classroom-entry input[name="invite"]'),null,{timeout:30000}).catch(()=>{});
 await world.waitForTimeout(1500);await profile();await settle();
 const [linked]=await backend.sql`select auth_user_id from engine.learners where learner_id=${backend.learner.learner_id}::uuid`;
 check(s,'명부 줄에 학생 SYNK ID가 이어졌다',!!linked?.auth_user_id);
 await frame.locator('#homework-nav').click();await frame.locator('[data-hr-key="plan:start"]').waitFor();
 await frame.locator('[data-hr-key="plan:start"]').fill('2027-03-06');await teacherPage.waitForTimeout(400);
 await frame.locator('[data-hr-key="plan:submit"]').click();
 await frame.waitForSelector('[data-hr-key="week:1"]',{timeout:20000});
 const [plan]=await backend.sql`select starts_on,weeks from engine.synk_class_homework_plans where class_id=${C}::uuid`;
 check(s,'반 계획(2027-03-06 · 8주)',plan&&plan.weeks===8,plan);

 // ── 1. 3주차 쓰기 내기(월요일 밤) ──
 s=step('1','3주차 쓰기 53번 내기');current=s.id;
 await setTime([world,teacherPage],'2027-03-22T21:00:00');await reloadWorld();
 const wk=await homeworkText();
 check(s,'「이번 주 과제」에 3주차가 열렸다',/3주차/.test(wk),wk.split('\n').slice(0,5).join(' / '));
 const task=`${C}:3:writing`;
 await hw('open:'+task).click();await world.locator('#world-classroom-homework .ws-hw-write textarea').first().waitFor();
 await hw(`field:${task}:W3-1.1`).fill(DRAFT);
 await shot(s,world,'학생-3주차쓰기',{focus:'#world-classroom-homework'});
 await hw(`send:${C}:3:writing`).click();
 await world.waitForFunction(()=>/냈어요/.test(document.querySelector('#world-classroom-homework')?.innerText||''),null,{timeout:20000});
 check(s,'냈어요',true);

 // ── 2. 교사 첨삭(목요일 밤) ──
 s=step('2','교사 첨삭 — 기호 다섯 · 한마디 세 줄');current=s.id;
 await setTime([world,teacherPage],'2027-03-25T20:00:00');
 await teacherPage.reload({waitUntil:'domcontentloaded'});frame=await teacherFrame();await frame.locator('#homework-nav').waitFor();
 await frame.locator('#homework-nav').click();await frame.locator('[data-hr-key="week:3"]').waitFor({timeout:20000});
 await frame.locator('[data-hr-key="week:3"]').click();await teacherPage.waitForTimeout(800);
 await frame.locator('button:has-text("시험 학생 하늘 (시험)"), [role=button]:has-text("시험 학생 하늘 (시험)")').last().click();
 await frame.locator('[data-hr-key="typed:W3-1.1"]').waitFor({timeout:20000});
 for(const [code,quote] of MARKS){
  if(!await frame.locator('[data-hr-key="typed:quote:W3-1.1"]').isVisible().catch(()=>false))await frame.locator('[data-hr-key="typed:W3-1.1"]').click();
  await frame.locator('[data-hr-key="typed:quote:W3-1.1"]').fill(quote);
  await frame.locator('[data-hr-key="typed:code:W3-1.1"]').selectOption(code);
  await frame.locator('[data-hr-key="typed:add:W3-1.1"]').click();await teacherPage.waitForTimeout(300);
  const err=await frame.evaluate(()=>[...document.querySelectorAll('.hr-typed-form [role=alert]')].map(n=>n.textContent).filter(Boolean).join(' / '));
  check(s,`기호 〔${code}〕 「${quote}」`,!err,err||'붙음');
 }
 const fold=frame.locator('[data-hr-key="comment-fold:W3-1"]');
 if(await fold.count()&&!await frame.locator('[data-hr-key="comment:W3-1:good"]').isVisible().catch(()=>false))await fold.click();
 for(const [k,v] of Object.entries(COMMENT))await frame.locator(`[data-hr-key="comment:W3-1:${k}"]`).fill(v);
 await shot(s,teacherPage,'교사-3주차첨삭',{full:true});
 await frame.locator('button:has-text("학생에게 돌려주기")').first().click();
 const confirmAnyway=frame.locator('button:has-text("그대로 돌려주기")');
 if(await confirmAnyway.isVisible({timeout:2500}).catch(()=>false)){const checklist=await frame.evaluate(()=>document.querySelector('[data-hr-key="checklist"]')?.innerText||'');note(s,'돌려주기 전 볼 것: '+checklist.replace(/\s+/g,' ').slice(0,240));await confirmAnyway.click();}
 await teacherPage.waitForTimeout(1500);
 const [fb]=await backend.sql`select returned_at from engine.synk_class_homework_feedback f join engine.synk_class_homework_submissions s using(submission_id) where s.class_id=${C}::uuid and s.week=3`;
 check(s,'첨삭을 돌려줬다',!!fb?.returned_at);

 // ── 3. 학생이 돌려받기(금요일) — 영상에 넣을 화면 ──
 s=step('3','학생이 첨삭을 돌려받기');current=s.id;
 await setTime([world,teacherPage],'2027-03-26T18:00:00');await reloadWorld();
 await shot(s,world,'학생-첨삭이왔어요',{focus:'#world-classroom-homework'});
 await hw('open:'+task).click();await world.locator('#world-classroom-homework .ws-hw-feedback').waitFor({timeout:20000});
 const fbText=await world.locator('#world-classroom-homework .ws-hw-feedback').innerText();
 check(s,'기호 표시와 한마디 세 줄이 보인다',fbText.includes('〔체〕')&&fbText.includes(COMMENT.good),fbText.replace(/\s+/g,' ').slice(0,240));
 await shot(s,world,'학생-첨삭보기',{full:true});
 await shot(s,world,'학생-첨삭보기-첫화면',{focus:'#world-classroom-homework .ws-hw-feedback'});
 await world.locator('#world-classroom-homework .ws-hw-feedback').screenshot({path:path.join(out,'feedback-element.png')});
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
 console.log('\n결과(맛보기 화면):',result.summary.passed+'/'+result.summary.checks,'통과 · 운영 API 요청 막음',result.requests.blockedProduction.length,'· 바깥 요청',result.requests.external.length,'· 리허설 밖 요청',result.requests.unexpected.length,'· 화면 오류',result.errors.length,'→',out);
 await browser.close();await api.close();await backend.close();fs.rmSync(workerDir,{recursive:true,force:true});fs.rmSync(fixDir,{recursive:true,force:true});
}

