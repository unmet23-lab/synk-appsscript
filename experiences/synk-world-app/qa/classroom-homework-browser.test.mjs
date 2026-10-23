import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {emptyPlayState} from '../../play-common/play-data.mjs';
import {homeworkWindow,homeworkDate} from '../classroom-homework.mjs';
// 계정 모드 WORLD(실제 Edge)의 내 계정 시트에서 「이번 주 과제」를 합성 계정·합성 반·합성 학생 글로 연다.
// 운영 계정·서버를 쓰지 않는다. 바깥 주소는 막고, 계정 API 주소는 아래 가짜 과제 서버(SYNK-talk lib/synk-classroom-homework.js와 같은 규칙)만 받는다.
// 시계는 Playwright로 고정한다(1기 가상 일정: 2027-03-06 토요일 시작). 캡처와 result.json은 SYNK_HOMEWORK_QA_OUT(기본 qa/classroom-homework-20261020/)에 쓴다.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
const out=path.resolve(process.env.SYNK_HOMEWORK_QA_OUT||path.join(root,'experiences/synk-world-app/qa/classroom-homework-20261020'));
const content=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/topik4-homework.json'),'utf8'));
const answerKey=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/topik4-homework-key.json'),'utf8'));
const A='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const START='2027-03-06',KST=t=>new Date(t+'+09:00');
const CLOCK={before:KST('2027-03-01T10:00:00'),week:KST('2027-03-29T10:00:00'),overdue:KST('2027-04-01T10:00:00'),done:KST('2027-05-03T10:00:00')};
const VIEWPORTS=[{tag:'390',size:{width:390,height:844}},{tag:'1280',size:{width:1280,height:800}}];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const iso=date=>date.toISOString();
// 1주 읽기는 지금 자료보다 앞선 판으로 냈다(1기 중 자료를 고친 경우): 정답은 지금 판으로 받고 「자료가 고쳐졌어요」를 함께 보인다.
const OLD_VERSION='v1-000000000000';

// ── 합성 학생이 1~3주에 낸 것과 돌아온 첨삭(첨삭기준.md의 기호·한마디 세 줄). 실제 학생 글이 아니다. ──
const W3_ESSAY='한빛대학교 언어교육원에서 2022년과 2026년에 외국인 유학생 400명을 대상으로 아르바이트에 대해 조사했습니다. 조사 결과 아르바이트를 하는 유학생은 2022년 48%에서 2026년 63%로 15% 증가했다. 아르바이트를 하는 이유는 생활비 마련이 52%로 가장 많았고 한국어 연습이 27%, 경력 쌓기가 15%였다. 요즘 물가가 많이 올랐기 때문이다. 이처럼 아르바이트를 하는 유학생이 늘고 있다.';
function pastSubmissions(){
 const at=t=>iso(KST(t));
 return [
  {week:1,kind:'reading',answers:{'R1-1':3,'R1-2':1,'R1-3':4,'R1-4':2,'R1-5':2},retry:{},revision:1,submittedAt:at('2027-03-08T21:10:00'),late:false,contentVersion:OLD_VERSION,feedback:null},
  {week:1,kind:'writing',answers:{'W1-1.1':'학생증을 가지고 사무실에 와서 택배를 찾아가세요.','W1-1.2':'일주일 안에 꼭 찾아가시기 바랍니다.','W1-2.1':'가족에게 급한 일이 생겨서 내일은 학교에 갈 수 없게 되었습니다.','W1-2.2':'편한 시간을 알려 주시면 그때 찾아가겠습니다.'},
   retry:{},revision:1,submittedAt:at('2027-03-09T22:40:00'),late:false,contentVersion:content.version,feedback:{returnedAt:at('2027-03-12T18:00:00'),parts:{
    'W1-1':{fields:{'W1-1.1':{verdict:'부분',reason:'뜻은 맞아요. 안내문이라 「-십시오」로 끝내요.'},'W1-1.2':{verdict:'인정',reason:'뒤 문장과 잘 이어져요.'}}},
    'W1-2':{fields:{'W1-2.1':{verdict:'인정',reason:'면담에 갈 수 없는 이유가 분명해요.'},'W1-2.2':{verdict:'부분',reason:'교수님께는 「찾아뵙겠습니다」가 알맞아요.'}},
     comment:{good:'두 글 모두 빈칸 앞뒤 흐름을 정확히 이었어요.',fix:'글의 문체를 끝까지 맞춰요. 안내문은 「-십시오」, 교수님께는 높임말이에요.〔체〕',retry:'「편한 시간을 알려 주시면 그때 찾아가겠습니다」를 높임말로 다시 써 보세요.'}}}}},
  {week:2,kind:'reading',answers:{'R2-1':1,'R2-2':2,'R2-3':3,'R2-4':1,'R2-5':4},retry:{},revision:1,submittedAt:at('2027-03-15T20:00:00'),late:false,contentVersion:content.version,feedback:null},
  {week:2,kind:'writing',answers:{'W2-1.1':'공부한 만큼 기억하지 못할 수 있다.','W2-1.2':'시험 전날에도 잠을 충분히 자야 한다.','W2-2.1':'중간에 생길 문제는 생각하지 않기 때문이다.','W2-2.2':'시간을 넉넉하게 잡는 것이 좋다.',
   'W2-3.1':'요즘 혼자 사는 사람이 많다.','W2-3.2':'이 방법은 시간이 오래 걸리지 않다.','W2-3.3':'학생들은 시험 기간에 도서관을 자주 이용한다.','W2-3.4':'이것은 우리가 해결해야 할 문제이다.','W2-3.5':'그런데 운동을 하면 스트레스가 진짜 줄어든다.'},
   retry:{'W1-2':'편하신 시간을 알려 주시면 그 시간에 찾아뵙겠습니다.'},revision:1,submittedAt:at('2027-03-17T22:55:00'),late:false,contentVersion:content.version,feedback:{returnedAt:at('2027-03-19T17:30:00'),parts:{
    'W2-1':{fields:{'W2-1.1':{verdict:'인정',reason:'뒤의 「-기 때문이다」와 이어지는 결과예요.'},'W2-1.2':{verdict:'인정'}}},
    'W2-2':{fields:{'W2-2.1':{verdict:'인정'},'W2-2.2':{verdict:'인정'}}},
    'W2-3':{fields:{'W2-3.2':{verdict:'다시',reason:'동사는 「-는다」예요: 걸리지 않는다.'},'W2-3.5':{verdict:'부분',reason:'「진짜」는 말하는 낱말이에요. 「크게」로 바꿔요.'}},
     comment:{good:'명사 문장 「문제이다」를 정확히 바꿨어요.',fix:'동사 「-지 않다」는 글에서 「-지 않는다」예요.〔어〕',retry:'「그런데 운동을 하면 스트레스가 진짜 줄어든다」를 글의 낱말로 다시 써 보세요.'}}}}},
  {week:3,kind:'reading',answers:{'R3-1':2,'R3-2':4,'R3-3':2,'R3-4':3,'R3-5':1},retry:{},revision:1,submittedAt:at('2027-03-22T21:00:00'),late:false,contentVersion:content.version,feedback:null},
  {week:3,kind:'writing',answers:{'W3-1.1':W3_ESSAY},retry:{'W2-3':'그런데 운동을 하면 스트레스가 크게 줄어든다.'},revision:2,submittedAt:at('2027-03-24T23:20:00'),late:true,contentVersion:content.version,feedback:{returnedAt:at('2027-03-26T19:00:00'),parts:{
    'W3-1':{marks:[{field:'W3-1.1',quote:'조사했습니다',code:'체'},{field:'W3-1.1',quote:'15% 증가했다',code:'낱',note:'→ 15%포인트'},{field:'W3-1.1',quote:'요즘 물가가 많이 올랐기 때문이다',code:'자'},{field:'W3-1.1',quote:'2022년 48%에서 2026년 63%로',code:'+'}],
     comment:{good:'두 해의 비율을 정확히 옮겼어요.',fix:'「요즘 물가가 많이 올랐기 때문이다」는 자료에 없는 내용이에요. 53번은 자료에 있는 것만 써요.〔자〕',retry:'「15% 증가했다」를 「15%포인트 증가했다」로 고쳐 한 문장으로 다시 써 보세요.'}}}}},
 ];
}
// SYNK-talk lib/synk-classroom-homework.js와 같은 규칙의 가짜 서버(주 열림·읽기 한 번·쓰기 판·늦음·같은 요청 번호는 같은 내용일 때만 중복)
// dropNextReply(): 다음 내기를 저장한 뒤 응답을 끊는다(학생 화면에는 연결 오류, 서버에는 저장됨).
function createHomeworkServer(){
 let submissions=pastSubmissions(),mode='ok',hold=null,dropReply=false,now=()=>Date.now(),keyMode='ok',keyGate=null;
 const print=body=>JSON.stringify([body.kind,body.answers,body.retry||{},body.contentVersion]);
 // read-only: 교사가 새 수정 과제를 시작해 이 반이 지난 과제 기록(서버 workflow 'course')으로 바뀐 때.
 const view=()=>({ok:true,mode:'account-linked',accountId:A,classes:[{classId:C,name:'합성 · TOPIK 4급 온라인 1기',course:'topik4-online',startsOn:START,weeks:8,planRevision:1,...(mode==='read-only'?{workflow:'course'}:{}),submissions:structuredClone(submissions)}],emptyReason:null,serverTime:new Date(now()).toISOString()});
 return {reset(){submissions=pastSubmissions();dropReply=false;keyMode='ok';keyGate=null;},setMode(value){mode=value;},setClock(fn){now=fn;},hold(gate){hold=gate;},dropNextReply(){dropReply=true;},
  // 정답 경로: holdKeys(gate)는 풀릴 때까지 모든 정답 요청을 잡아 둔다. keyMode: ok | error(500) | other-version(자료를 막 고쳐 판이 다른 정답)
  setKeyMode(value){keyMode=value;},holdKeys(gate){keyGate=gate;},
  // 교사가 첨삭을 돌려준다(학생이 그 주 쓰기를 고쳐 쓰는 사이).
  returnFeedback(week,parts){const s=submissions.find(x=>x.week===week&&x.kind==='writing');s.feedback={returnedAt:new Date(now()).toISOString(),parts};},
  get submissions(){return submissions;},
  // SYNK-talk lib/synk-classroom-homework.js studentKey와 같은 규칙(bb8000c): 그 학생이 낸 주만, 쓰기는 첨삭이 돌아온 뒤에만, 낸 판이 달라도 지금 판의 정답.
  async key(query,body){
   if(keyGate)await keyGate.promise;
   if(keyMode==='error')return {status:500,data:{ok:false,code:'SERVER_UNAVAILABLE',error:{code:'SERVER_UNAVAILABLE'}}};
   if(query.classId!==C||body?.classId!==C)return {status:403,data:{ok:false,error:{code:'FORBIDDEN'}}};
   const saved=submissions.find(s=>s.week===body.week&&s.kind===body.kind);
   if(!saved||body.kind==='writing'&&!saved.feedback)return {status:403,data:{ok:false,error:{code:'HOMEWORK_KEY_LOCKED'}}};
   const prefix=(body.kind==='reading'?'R':'W')+body.week+'-',key={version:keyMode==='other-version'?'v1-ffffffffffff':answerKey.version,reading:{},writing:{}};
   key[body.kind]=Object.fromEntries(Object.entries(answerKey[body.kind]).filter(([id])=>id.startsWith(prefix)));
   return {status:200,data:{ok:true,mode:'account-linked',accountId:A,key}};
  },
  async handle(method,query,body){
   if(hold&&method==='GET'){const gate=hold;hold=null;await gate.promise;}
   if(mode==='error')return {status:500,data:{ok:false,code:'SERVER_UNAVAILABLE',message:'잠시 뒤 다시 시도해 주세요.',error:{code:'SERVER_UNAVAILABLE',message:'잠시 뒤 다시 시도해 주세요.'}}};
   if(mode==='old-server')return {status:400,data:{ok:false,code:'CLASS_REQUIRED',message:'CLASS_REQUIRED',error:{code:'CLASS_REQUIRED',message:'CLASS_REQUIRED'}}};
   if(mode==='no-class')return {status:200,data:{ok:true,mode:'account-linked',accountId:A,classes:[],emptyReason:'NO_CLASS',serverTime:new Date(now()).toISOString()}};
   if(method==='GET'){if(Object.keys(query).length)return {status:400,data:{ok:false,error:{code:'INVALID_QUERY'}}};return {status:200,data:view()};}
   // 교사가 새 수정 과제를 시작해 이 반이 이력 보기로 바뀐 순간의 내기(서버 409 HOMEWORK_READ_ONLY).
   if(mode==='read-only')return {status:409,data:{ok:false,error:{code:'HOMEWORK_READ_ONLY'}}};
   if(query.classId!==C||body.classId!==C)return {status:403,data:{ok:false,error:{code:'FORBIDDEN'}}};
   const window=homeworkWindow(START,body.week);if(now()<window.start)return {status:409,data:{ok:false,error:{code:'WEEK_NOT_OPEN'}}};
   const old=submissions.find(s=>s.week===body.week&&s.kind===body.kind),late=now()>window.due;
   if(old?.requestId===body.requestId)return old.print===print(body)?{status:200,data:{...view(),duplicate:true}}:{status:409,data:{ok:false,error:{code:'IDEMPOTENCY_CONFLICT'}}};
   if(old&&body.kind==='reading')return {status:409,data:{ok:false,error:{code:'ALREADY_SUBMITTED'}}};
   if(old?.feedback)return {status:409,data:{ok:false,error:{code:'HOMEWORK_LOCKED'}}};
   if((old?.revision||0)!==body.expectedRevision)return {status:409,data:{ok:false,error:{code:'REVISION_CONFLICT'},revision:old?.revision||0}};
   const row={week:body.week,kind:body.kind,answers:body.answers,retry:body.retry||{},revision:(old?.revision||0)+1,submittedAt:new Date(now()).toISOString(),late,contentVersion:body.contentVersion,feedback:null,requestId:body.requestId,print:print(body)};
   submissions=[...submissions.filter(s=>s!==old),row];
   const data=view();for(const c of data.classes)for(const s of c.submissions){delete s.requestId;delete s.print;}
   const drop=dropReply;dropReply=false;
   return {status:200,data:{...data,duplicate:false,submission:{week:row.week,kind:row.kind,revision:row.revision,late}},drop};
  }};
}

test('계정 모드 WORLD 내 계정 시트의 「이번 주 과제」: 주차·읽기 내기·쓰기 내기·첨삭 보기·상태별 화면 (390·1280)',{timeout:600000,skip:!talkRoot&&'형제 저장소 SYNK-talk이 없다(SYNK_TALK_ROOT로 가리킨다)'},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-homework-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 fs.mkdirSync(out,{recursive:true});for(const name of fs.readdirSync(out))if(/\.png$/.test(name))fs.rmSync(path.join(out,name));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talkRoot,SYNK_WORLD_PORT:String(port),
  SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')}});
 let serverOutput='';server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 const url=`http://127.0.0.1:${port}`,origin=new URL(config.accountApiUrl).origin,homeworkCalls=[],keyCalls=[],contentLoads=[],unexpected=[],errors=[],external=[],shots=[],checks={},measures={};
 const fake=createHomeworkServer();let browser,page,context,clock=CLOCK.week;fake.setClock(()=>clock.getTime());
 t.signal.addEventListener('abort',()=>{server.kill('SIGKILL');},{once:true});
 const playState=emptyPlayState(),played=new Map();let playRevision=0;
 try{
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(serverOutput);try{const r=await fetch(url+'/world/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await playwright.chromium.launch({channel:'msedge',headless:true,timeout:30000});
  context=await browser.newContext({viewport:VIEWPORTS[0].size,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});context.setDefaultTimeout(25000);
  await context.clock.setFixedTime(clock);
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
  await context.addInitScript(()=>{if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));});
  const cors={'Access-Control-Allow-Origin':'*'};
  await context.route(origin+'/**',async route=>{
   const req=route.request(),target=new URL(req.url());let status=200,data={ok:true},drop=false;
   try{
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...cors,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, POST, PUT'}});return;}
    const body=req.postDataJSON();
    if(target.pathname==='/functions/v1/synk-classroom/api/world/homework'){
     const h=await req.allHeaders(),query=Object.fromEntries(target.searchParams);
     homeworkCalls.push({method:req.method(),query,body,product:h['x-synk-product'],contract:h['x-synk-contract'],authorization:h.authorization,apikey:h.apikey,contentType:h['content-type']||null});
     ({status,data,drop=false}=await fake.handle(req.method(),query,body));
    }
    else if(target.pathname==='/functions/v1/synk-classroom/api/world/homework/key'){
     const h=await req.allHeaders(),query=Object.fromEntries(target.searchParams);
     keyCalls.push({method:req.method(),query,body,product:h['x-synk-product'],contract:h['x-synk-contract'],authorization:h.authorization,apikey:h.apikey});
     ({status,data}=await fake.key(query,body));
    }
    // 「우리 반 수업」 아래 과정 쓰기 입구(course-writing-entry.mjs): 이 합성 계정에는 과정 과제가 없어 입구가 숨는다(account-browser.test.mjs와 같은 빈 답).
    else if(target.pathname==='/functions/v1/synk-classroom/api/classes')data={ok:true,mode:'account-linked',classes:[],learnerId:null,staffId:null};
    else if(target.pathname==='/functions/v1/classroom')data={contract_ver:'c16',ok:true,classes:[{class_id:C,display_name:'합성 · TOPIK 4급 온라인 1기',video_privacy:'unlisted',playlist_url:null,meeting_url:null,sessions:[{session_key:'w3-sat',title:'3주차 토요일 · 쓰기 — 53번 조사 결과 비교',starts_at:iso(KST('2027-03-20T19:30:00')),ends_at:null,status:'ready',watch_url:'https://www.youtube.com/watch?v=w3SatReplay'}]}],empty_reason:null,server_time:new Date().toISOString()};
    else if(target.pathname.endsWith('/synk-account'))data=body?{ok:true,refreshRevoked:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[{id:C,current:true,revoked:false,product:'world'}]};
    else if(target.pathname.endsWith('/synk-play')){
     if(body?.id&&played.has(body.id))data=played.get(body.id);
     else{if(body?.action==='progress')for(const change of body.changes){if(change.value===null)delete playState.records[change.key];else playState.records[change.key]=change.value;}
      data={ok:true,scope:'synk-play',accountId:A,revision:body?++playRevision:playRevision,state:structuredClone(playState)};if(body?.id)played.set(body.id,data);}
    }
    else if(target.pathname.endsWith('/synk-world-v1/bootstrap'))data={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
    else if(target.pathname.endsWith('/synk-learning'))data={ok:true,revision:1,events:[],cursor:0,hasMore:false};
    else if(target.pathname.endsWith('/synk-personal')){status=403;data={ok:false,error:{code:'PRODUCT_FORBIDDEN'}};}
    else if(target.pathname.startsWith('/auth/v1/logout'))data={};
    else{unexpected.push(target.pathname);status=404;data={ok:false,error:{code:'NOT_IN_FIXTURE'}};}
   }catch(error){unexpected.push('fixture-error '+target.pathname+' '+error.message);status=500;data={ok:false,error:{code:'FIXTURE_ERROR'}};}
   if(drop){await route.abort('failed');return;}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:cors});
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/topik4-homework.json'))contentLoads.push(r.url());});
  await page.goto(url+'/world/?opening=off',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
  assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot.accountId),A);
  // 첫 실행: 언어 고르기 → 「한글을 읽을 수 있어요?」 → 튜터 고르기(classroom-lessons-browser.test.mjs와 같다)
  await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('[data-lang-picker]').count()){await page.locator('[data-lang-choice="ko"]').click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
  await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}
  await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');}

  const card=page.locator('#world-classroom-homework .ws-hw');
  const cardState=()=>page.evaluate(()=>{const el=document.querySelector('#world-classroom-homework .ws-hw');return el?(el.hidden?'hidden':el.dataset.state):'none';});
  async function openProfile(){
   if(await page.evaluate(()=>document.querySelector('#world-panel')?.open))await page.locator('#panel-close').click();
   await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);
   await page.locator('.profile-control[data-view="me"]').click();
   // 첫 읽기 동안 칸은 숨어 있다(반이 없는 계정에 깜빡이지 않게). 읽기가 끝나 상태가 정해질 때까지 기다린다.
   await page.waitForFunction(()=>{const el=document.querySelector('#world-classroom-homework .ws-hw');return el&&el.dataset.state!=='loading';});
  }
  const settle=expected=>page.waitForFunction(expected=>{const el=document.querySelector('#world-classroom-homework .ws-hw');const state=el?(el.hidden?'hidden':el.dataset.state):'none';return state===expected;},expected);
  const measure=()=>page.evaluate(()=>{
   const el=document.querySelector('#world-classroom-homework .ws-hw'),content=document.querySelector('#panel-content'),box=el.getBoundingClientRect();
   const shown=node=>node.getClientRects().length>0;
   const overflowing=[...el.querySelectorAll('*')].filter(n=>shown(n)&&!n.closest('.ws-hw-table')&&(n.getBoundingClientRect().right>box.right+.5||n.getBoundingClientRect().left<box.left-.5)).map(n=>n.className||n.tagName);
   const tables=[...el.querySelectorAll('.ws-hw-table')].filter(shown).map(n=>n.scrollWidth-n.clientWidth);
   const small=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){if(!/[가-힣]/.test(n.textContent)||!shown(n.parentElement))continue;const size=parseFloat(getComputedStyle(n.parentElement).fontSize);if(size<13)small.push({text:n.textContent.trim().slice(0,24),size});}
   const targets=[...el.querySelectorAll('a,button,summary,textarea')].filter(shown).map(n=>({key:n.dataset.homeworkKey||n.tagName,height:Math.round(n.getBoundingClientRect().height)}));
   const pills=[...el.querySelectorAll('.felt-button')].filter(shown).length;
   const fonts=[...new Set([...el.querySelectorAll('*')].filter(shown).map(n=>getComputedStyle(n).fontSize))].sort();
   return {layout:document.documentElement.dataset.layout,innerWidth,docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,panelOverflow:content.scrollWidth-content.clientWidth,
    cardWidth:Math.round(box.width),cardHeight:Math.round(box.height),overflowing,tableOverflow:Math.max(0,...tables),small,shortTargets:targets.filter(x=>x.height<44),targets:targets.length,whitePills:pills,fonts};
  });
  // 칸 전체를 한 장으로: 시트를 내려 가며 보이는 부분을 찍어 칸 안 위치대로 이어 붙인다(창 크기·글자는 그대로).
  async function shoot(tag,name){
   await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(()=>{document.querySelector('#world-panel').style.scrollBehavior='auto';document.querySelector('#world-classroom-homework .ws-hw').scrollIntoView({block:'start'});});await page.waitForTimeout(150);
   const total=await card.evaluate(el=>Math.round(el.getBoundingClientRect().height)),parts=[];let covered=0;
   for(let i=0;i<40&&covered<total;i++){
    const g=await page.evaluate(()=>{const panel=document.querySelector('#world-panel'),r=document.querySelector('#world-classroom-homework .ws-hw').getBoundingClientRect(),p=panel.getBoundingClientRect();
     const top=Math.max(r.top,p.top+panel.clientTop),bottom=Math.min(r.bottom,p.top+panel.clientTop+panel.clientHeight);return {x:Math.round(r.left),width:Math.round(r.width),top:Math.ceil(top),bottom:Math.floor(bottom),offset:Math.ceil(top-r.top)};});
    const height=g.bottom-g.top;if(height<=0)break;
    parts.push({offset:g.offset,width:g.width,buffer:await page.screenshot({clip:{x:g.x,y:g.top,width:g.width,height}})});covered=g.offset+height;
    if(covered>=total)break;await page.evaluate(step=>{document.querySelector('#world-panel').scrollTop+=step;},height-4);await page.waitForTimeout(80);
   }
   assert.ok(covered>=total-1,`${tag}-${name}: 칸 전체를 담지 못했다 ${covered}/${total}`);
   const width=parts[0].width,sheet=await browser.newPage({viewport:{width,height:Math.min(total,4000)}});
   await sheet.setContent(`<body style="margin:0;background:#0C0D10"><div id="s" style="position:relative;width:${width}px;height:${total}px">${parts.map(p=>`<img style="position:absolute;left:0;top:${p.offset}px;display:block" src="data:image/png;base64,${p.buffer.toString('base64')}">`).join('')}</div></body>`);
   await sheet.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
   const file=path.join(out,`${tag}-${name}.png`);await sheet.locator('#s').screenshot({path:file});await sheet.close();shots.push(path.relative(out,file));
  }
  const record=async(tag,name)=>{measures[`${tag}-${name}`]=await measure();await shoot(tag,name);};
  const setClock=async date=>{clock=date;await context.clock.setFixedTime(date);};
  const press=async key=>{await card.locator(`[data-homework-key="${key}"]`).click();};
  const task=(week,kind)=>card.locator(`.ws-hw-week[data-week="${week}"] .ws-hw-task[data-kind="${kind}"]`).first();
  const open=async(week,kind)=>press(`open:${C}:${week}:${kind}`);
  const posts=()=>homeworkCalls.filter(c=>c.method==='POST');

  for(const {tag,size} of VIEWPORTS){
   await page.setViewportSize(size);await page.waitForTimeout(200);
   fake.reset();fake.setMode('ok');await setClock(CLOCK.week);
   await page.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('synk.world.homework.'))localStorage.removeItem(k);});
   // 지난 주 정답 받기를 3)에서 읽기를 낼 때까지 잡아 둔다 — 받는 사이 새로 낸 주도 이어서 받는지 본다.
   const keyGate=deferred();fake.holdKeys(keyGate);
   await openProfile();await settle('ready');
   // 1) 이번 주(4주차): 주차·마감, 이번 주 수업, 읽기·쓰기 줄(안 냄), 지난 과제 세 줄
   const due=homeworkDate(homeworkWindow(START,4).due);
   const head=await card.evaluate(el=>({when:el.querySelector('.ws-hw-week[data-week="4"] .ws-hw-when')?.textContent,lesson:el.querySelector('.ws-hw-lesson')?.innerText,
    tasks:[...el.querySelectorAll('.ws-hw-room>.ws-hw-week>.ws-hw-task')].map(n=>({kind:n.dataset.kind,status:n.dataset.status,title:n.querySelector('.ws-hw-task-title').textContent,meta:n.querySelector('.ws-hw-meta').textContent})),
    past:[...el.querySelectorAll('.ws-hw-past-week summary')].map(s=>s.textContent)}));
   assert.equal(head.when,`4주차 · 마감 ${due}`);assert.match(head.when,/3월 31일 \(수\) 오후 11:00/);
   assert.match(head.lesson,/53번 ② 변화·원인·전망/);assert.match(head.lesson,/공개 기출 21~30번/);
   assert.deepEqual(head.tasks.map(x=>[x.kind,x.status,x.meta]),[['reading','none','아직 안 냈어요'],['writing','none','아직 안 냈어요']]);
   assert.equal(head.tasks[1].title,'쓰기 W4 · 자료 설명 ② 변화·원인·전망(53번 유형)');
   assert.deepEqual(head.past,['3주차읽기 냈어요 · 쓰기 첨삭이 왔어요','2주차읽기 냈어요 · 쓰기 첨삭이 왔어요','1주차읽기 냈어요 · 쓰기 첨삭이 왔어요']);
   await record(tag,'week');
   // 2) 읽기 R4: 세 문항을 고른 채(쓰던 답은 이 기기에만)
   await open(4,'reading');await card.locator('.ws-hw-item').first().waitFor();
   assert.equal(await card.locator('.ws-hw-item').count(),5);
   const choose=[['R4-1',2],['R4-2',1],['R4-3',3]];
   for(const [item,n] of choose)await press(`option:${C}:${item}:${n}`);
   assert.equal(await card.locator('.ws-hw-count').textContent(),'5문항 중 3문항을 골랐어요. 다섯 문항을 모두 고르면 낼 수 있어요.');
   assert.equal(await card.locator('.ws-hw-reading .ws-hw-send').isDisabled(),true);
   const draft=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),`synk.world.homework.v1:${A}:${C}:R4`);assert.deepEqual(draft.answers,{'R4-1':2,'R4-2':1,'R4-3':3});
   const dots=()=>card.locator('.ws-hw-reading').evaluate(el=>[...el.querySelectorAll('.ws-hw-option')].filter(o=>getComputedStyle(o,'::after').content!=='none').length);
   assert.equal(await dots(),0,'내기 전에는 고른 보기에 정답·오답 점이 없다(흰 바탕만)');
   await record(tag,'reading');
   // 3) 다섯 문항을 고르고 낸다 → 정답·근거(정답 자료는 낸 뒤에 읽는다)
   for(const [item,n] of [['R4-4',4],['R4-5',2]])await press(`option:${C}:${item}:${n}`);
   const beforePosts=posts().length;await press(`send:${C}:4:reading`);
   await page.waitForFunction(()=>document.querySelector('#world-classroom-homework .ws-hw-task[data-kind="reading"] .ws-hw-notice')?.textContent==='답을 냈어요. 정답과 근거를 확인해 보세요.');
   assert.equal(await card.locator('.ws-hw-reading .ws-hw-summary').textContent(),'정답을 불러오는 중이에요.','지난 주 정답을 받는 중에 낸 주');
   keyGate.resolve();fake.holdKeys(null);
   await card.locator('.ws-hw-reading .ws-hw-judge').first().waitFor();
   assert.ok(keyCalls.some(c=>c.body?.week===4&&c.body?.kind==='reading'),'받던 묶음이 끝나면 새로 낸 주의 정답을 이어서 받는다');
   checks[`${tag}-key-after-batch`]=true;
   const sent=posts().at(-1);assert.equal(posts().length,beforePosts+1);
   assert.deepEqual({...sent.body,requestId:undefined},{classId:C,week:4,kind:'reading',requestId:undefined,expectedRevision:0,contentVersion:content.version,answers:{'R4-1':2,'R4-2':1,'R4-3':3,'R4-4':4,'R4-5':2}});
   assert.match(sent.body.requestId,/^[0-9a-f-]{36}$/);assert.deepEqual(sent.query,{classId:C});assert.equal(sent.contentType,'application/json');
   const result=await card.evaluate(el=>({summary:el.querySelector('.ws-hw-reading .ws-hw-summary')?.textContent,judges:[...el.querySelectorAll('.ws-hw-reading .ws-hw-judge')].map(n=>n.textContent),why:el.querySelectorAll('.ws-hw-reading .ws-hw-why').length,
    wrongWhy:[...el.querySelectorAll('.ws-hw-reading .ws-hw-why')].map(n=>n.children.length),
    notice:el.querySelector('.ws-hw-task[data-kind="reading"] .ws-hw-notice')?.textContent,draft:localStorage.getItem(`synk.world.homework.v1:${'11111111-1111-4111-8111-111111111111'}:${'22222222-2222-4222-8222-222222222222'}:R4`)}));
   // 정답 자료(문서에서 변환)로 기대값을 셈한다: 고른 것 ②①③④② · 정답 ②①②④③
   const picked={'R4-1':2,'R4-2':1,'R4-3':3,'R4-4':4,'R4-5':2},expected=Object.entries(picked).map(([id,n])=>n===answerKey.reading[id].answer?'맞았어요':`정답은 ${'①②③④'[answerKey.reading[id].answer-1]}예요`);
   assert.deepEqual(result.judges,expected);assert.equal(result.summary,`5문항 중 ${expected.filter(x=>x==='맞았어요').length}문항을 맞혔어요.`);assert.equal(result.why,5);
   assert.deepEqual(result.wrongWhy,expected.map(x=>x==='맞았어요'?1:2),'틀린 문항에는 근거와 고른 보기의 오답 이유');
   assert.equal(await dots(),5+expected.filter(x=>x!=='맞았어요').length,'낸 뒤에는 정답마다 메도우 점, 고른 오답마다 코랄 점');
   assert.equal(result.notice,'답을 냈어요. 정답과 근거를 확인해 보세요.');assert.equal(result.draft,null,'낸 뒤에는 쓰던 답을 지운다');
   await record(tag,'reading-result');
   checks[`${tag}-reading-submit`]=true;
   // 4) 쓰기 W4: 빈 칸이면 알려 주고, 글자 수를 세며, 지난주(W3) 「다시 써 볼 곳」을 함께 낸다
   await open(4,'reading');await open(4,'writing');await card.locator('.ws-hw-write textarea[data-kind="text"]').waitFor();
   const retryBox=await card.locator('.ws-hw-write .ws-hw-retry').evaluate(n=>n.innerText);assert.match(retryBox,/지난주 다시 써 볼 곳 · 53번 문제/);assert.match(retryBox,/15%포인트 증가했다/);
   assert.doesNotMatch(await card.innerText(),/\b[RW]\d-\d\b/,'학생 화면에 내부 번호(W3-1)를 보이지 않는다');
   await press(`send:${C}:4:writing`);
   assert.equal(await card.locator('.ws-hw-task[data-kind="writing"] .ws-hw-notice').textContent(),'아직 비어 있는 칸이 있어요: 글');
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset.homeworkKey),`field:${C}:4:writing:W4-1.1`);
   const essay='한빛시 교통과의 자료에 따르면 공공 자전거의 하루 평균 이용 건수는 2018년 1,200건에서 2024년 6,800건으로 늘었다. 6년 사이에 다섯 배 넘게 증가한 셈이다. 이용이 늘어난 원인으로는 자전거 전용 도로가 확대된 것을 들 수 있다. 또한 휴대 전화로 빌리고 반납하는 방식이 도입된 것도 원인이다. 이러한 추세가 이어진다면 2028년에는 하루 1만 건을 넘을 것으로 예상된다.';
   await card.locator('.ws-hw-write textarea[data-kind="text"]').fill(essay);
   assert.equal(await task(4,'writing').locator('.ws-hw-notice').count(),0,'채우기 시작하면 빈 칸 안내가 사라진다');
   assert.equal(await card.locator('.ws-hw-counter').textContent(),`${[...essay].length}자 · 200~300자`);assert.equal(await card.locator('.ws-hw-counter').getAttribute('data-tone'),'ok');
   await card.locator(`[data-homework-key="retry:${C}:4:writing:W3-1"]`).fill('조사 결과 아르바이트를 하는 유학생은 2022년 48%에서 2026년 63%로 15%포인트 증가했다.');
   await record(tag,'writing');
   await press(`send:${C}:4:writing`);await card.locator('.ws-hw-write .ws-hw-again').waitFor();
   const wrote=posts().at(-1).body;
   assert.deepEqual({...wrote,requestId:undefined},{classId:C,week:4,kind:'writing',requestId:undefined,expectedRevision:0,contentVersion:content.version,answers:{'W4-1.1':essay},retry:{'W3-1':'조사 결과 아르바이트를 하는 유학생은 2022년 48%에서 2026년 63%로 15%포인트 증가했다.'}});
   assert.equal(await task(4,'writing').getAttribute('data-status'),'submitted');assert.equal(await task(4,'writing').locator('.ws-hw-meta').textContent(),'냈어요 · 첨삭은 금요일까지 와요');
   await record(tag,'writing-sent');
   // 고쳐서 다시 내면 같은 판에서(expectedRevision 1)
   await press(`edit:${C}:4:writing`);await card.locator('.ws-hw-write textarea[data-kind="text"]').fill(essay.replace('늘었다','꾸준히 늘었다'));
   await press(`send:${C}:4:writing`);await card.locator('.ws-hw-write .ws-hw-again').waitFor();
   assert.equal(posts().at(-1).body.expectedRevision,1);assert.equal(fake.submissions.find(s=>s.week===4&&s.kind==='writing').revision,2);
   checks[`${tag}-writing-resubmit`]=true;
   // 응답이 끊긴 내기(서버에는 저장됨): 같은 글을 다시 내면 같은 요청 번호라 한 번만 저장된다. 고친 글은 새 번호로 내고,
   // 서버가 한 판 앞서 있으면 판 겹침을 알린 뒤 다시 불러와, 이 기기에서 고친 글로 이어 낸다.
   // 시계를 단계마다 몇 초씩 앞당겨 실제 차례(쓰던 글 저장 → 서버 낸 시각 → 그 뒤에 고친 글)를 만든다.
   const writing4=()=>fake.submissions.find(s=>s.week===4&&s.kind==='writing'),area=card.locator('.ws-hw-write textarea[data-kind="text"]');
   const noticeIs=prefix=>page.waitForFunction(prefix=>(document.querySelector('#world-classroom-homework .ws-hw-task[data-kind="writing"] .ws-hw-notice')?.textContent||'').startsWith(prefix),prefix);
   const later=()=>setClock(new Date(clock.getTime()+5000));
   await press(`edit:${C}:4:writing`);await area.fill(essay.replace('늘었다','많이 늘었다'));await later();fake.dropNextReply();await press(`send:${C}:4:writing`);await noticeIs('내지 못했어요. 쓴 글은');
   const lostId=posts().at(-1).body.requestId;assert.equal(writing4().revision,3,'응답은 끊겼지만 서버에는 저장됐다');
   await press(`send:${C}:4:writing`);await card.locator('.ws-hw-write .ws-hw-again').waitFor();
   assert.equal(posts().at(-1).body.requestId,lostId,'같은 글은 같은 요청 번호');assert.equal(writing4().revision,3,'중복으로 받아 판이 그대로');
   await later();await press(`edit:${C}:4:writing`);await area.fill(essay.replace('늘었다','아주 많이 늘었다'));await later();fake.dropNextReply();await press(`send:${C}:4:writing`);await noticeIs('내지 못했어요. 쓴 글은');
   const secondId=posts().at(-1).body.requestId;assert.equal(writing4().revision,4);
   const fixed=essay.replace('늘었다','아주 많이 늘었다고 한다');
   await later();await area.fill(fixed);await press(`send:${C}:4:writing`);await noticeIs('먼저 낸 답이 이미 저장돼 있어요');
   assert.notEqual(posts().at(-1).body.requestId,secondId,'고친 글은 새 요청 번호');assert.equal(posts().at(-1).body.expectedRevision,3);
   await card.locator('.ws-hw-write .ws-hw-again').waitFor();await press(`edit:${C}:4:writing`);
   assert.equal(await area.inputValue(),fixed,'낸 시각 뒤에 이 기기에서 고친 글은 남아 있다');
   await press(`send:${C}:4:writing`);await card.locator('.ws-hw-write .ws-hw-again').waitFor();
   assert.equal(posts().at(-1).body.expectedRevision,4);assert.equal(writing4().revision,5);assert.equal(writing4().answers['W4-1.1'],fixed);
   // 고치지 않은 채 응답이 끊긴 글은 새로고침하면 쓰던 글을 지운다(서버에 같은 글이 있다).
   await later();await press(`edit:${C}:4:writing`);await area.fill(fixed+' 끝');await later();fake.dropNextReply();await press(`send:${C}:4:writing`);await noticeIs('내지 못했어요. 쓴 글은');
   await later();await press('refresh');await settle('ready');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),`synk.world.homework.v1:${A}:${C}:W4`),null,'서버 낸 시각보다 오래된 쓰던 글은 지운다');
   assert.equal(writing4().answers['W4-1.1'],fixed+' 끝');
   checks[`${tag}-lost-reply`]=true;
   // 고쳐 쓰는 사이 첨삭이 먼저 돌아오면(HOMEWORK_LOCKED) 고친 글이 사라지지 않고 첨삭 아래 「내지 못한 고친 글」로 남는다.
   await open(4,'writing');await later();await press(`edit:${C}:4:writing`);
   const rewrite=fixed+' 끝까지 다시 고쳤다.';await area.fill(rewrite);await later();
   fake.returnFeedback(4,{'W4-1':{comment:{good:'자료의 변화를 차례대로 썼어요.'}}});
   await press(`send:${C}:4:writing`);await noticeIs('첨삭이 먼저 돌아와서 고친 글은 낼 수 없어요.');
   await task(4,'writing').locator('.ws-hw-feedback .ws-hw-kept').waitFor();
   const kept=await task(4,'writing').evaluate(el=>({meta:el.querySelector('.ws-hw-meta')?.textContent,title:el.querySelector('.ws-hw-kept h5')?.textContent,text:el.querySelector('.ws-hw-kept .ws-hw-mine')?.textContent,lines:el.querySelectorAll('.ws-hw-kept .ws-hw-mine').length}));
   assert.deepEqual(kept,{meta:'첨삭이 왔어요 · 내지 못한 고친 글이 있어요',title:'내지 못한 고친 글',text:rewrite,lines:1},'고친 글만 — 이미 낸 다시 쓴 문장은 되풀이하지 않는다');
   assert.equal(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),`synk.world.homework.v1:${A}:${C}:W4`)).answers['W4-1.1'],rewrite,'고쳐 쓰던 글은 이 기기에 남는다');
   await record(tag,'kept');
   await press(`draft-drop:${C}:4:writing`);await task(4,'writing').locator('.ws-hw-kept').waitFor({state:'detached'});
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),`synk.world.homework.v1:${A}:${C}:W4`),null,'「이 글 지우기」로만 지운다');
   assert.equal(await task(4,'writing').locator('.ws-hw-meta').textContent(),'첨삭이 왔어요');
   await open(4,'writing');checks[`${tag}-kept-rewrite`]=true;
   // (새로고침으로 펼친 칸은 이미 닫혔다)
   // 5) 지난 과제: 3주차 쓰기 첨삭(학생 글 위 기호 표시 · 기호 목록 · 한마디 세 줄 · 예시답)
   await card.locator(`[data-homework-key="past:${C}:3"]`).click();await open(3,'writing');await card.locator('.ws-hw-feedback').waitFor();
   await card.locator('.ws-hw-feedback .ws-hw-model summary').click();
   const fb=await card.locator('.ws-hw-feedback').evaluate(el=>({marks:[...el.querySelectorAll('.ws-hw-mine mark')].map(m=>[m.textContent,m.dataset.code]),
    list:[...el.querySelectorAll('.ws-hw-marks li')].map(li=>li.textContent),comment:[...el.querySelectorAll('.ws-hw-comment dt')].map(dt=>dt.textContent),
    retry:el.querySelector('.ws-hw-comment dd:last-child')?.textContent,model:el.querySelector('.ws-hw-model')?.open,modelText:el.querySelector('.ws-hw-model p')?.textContent,summary:el.querySelector('.ws-hw-summary')?.textContent}));
   assert.deepEqual(fb.marks,[['조사했습니다','체'],['2022년 48%에서 2026년 63%로','+'],['15% 증가했다','낱'],['요즘 물가가 많이 올랐기 때문이다','자']]);
   assert.deepEqual(fb.list,['〔체〕 문체가 섞임 · 「조사했습니다」','〔낱〕 낱말 선택 · 「15% 증가했다」 → 15%포인트','〔자〕 자료와 다름(53) · 「요즘 물가가 많이 올랐기 때문이다」','〔+〕 잘 쓴 곳 · 「2022년 48%에서 2026년 63%로」']);
   assert.deepEqual(fb.comment,['잘된 점','고칠 핵심','다시 써 볼 곳']);assert.match(fb.retry,/15%포인트 증가했다/);
   assert.equal(fb.model,true);assert.match(fb.modelText,/^한빛대학교 언어교육원에서 2022년과 2026년에 외국인 유학생 각 400명을/);
   assert.match(fb.summary,/첨삭이 왔어요 · 3월 26일 \(금\)/);
   await record(tag,'feedback');
   // 펼친 예시답은 칸을 다시 그려도(탭 복귀의 조용한 다시 묻기·새로고침) 그 문항만 펼친 채로 남고, 접으면 접힌 채로 남는다(10-23 실제 계정 한 바퀴).
   const model=()=>card.locator('.ws-hw-feedback .ws-hw-model').first();
   const repaint=async()=>{
    await model().evaluate(el=>{el.dataset.painted='before';});
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(()=>{const el=document.querySelector('#world-classroom-homework .ws-hw-feedback .ws-hw-model');return el&&el.dataset.painted!=='before';});
   };
   await repaint();assert.equal(await model().evaluate(el=>el.open),true,'다시 그린 뒤에도 펼친 예시답');
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset.homeworkKey),`model:${C}:3:W3-1`,'초점도 예시답 줄로 돌아온다');
   await press('refresh');await settle('ready');await open(3,'writing');await model().waitFor();
   assert.equal(await model().evaluate(el=>el.open),true,'새로고침 뒤 첨삭을 다시 열어도 펼친 예시답');
   await model().locator('summary').click();await repaint();assert.equal(await model().evaluate(el=>el.open),false,'접은 예시답은 다시 그려도 접힌 채');
   checks[`${tag}-model-open-kept`]=true;
   // 6) 2주차 쓰기 첨삭: 빈칸·바꿔 쓰기 판정(인정·부분·다시)
   await open(3,'writing');await card.locator(`[data-homework-key="past:${C}:3"]`).click();
   await card.locator(`[data-homework-key="past:${C}:2"]`).click();await open(2,'writing');await card.locator('.ws-hw-feedback').waitFor();
   const verdicts=await card.locator('.ws-hw-feedback').evaluate(el=>[...el.querySelectorAll('.ws-hw-verdict')].map(n=>n.dataset.verdict));
   assert.deepEqual(verdicts,['인정','인정','인정','인정','다시','부분']);
   assert.match(await card.locator('.ws-hw-feedback').innerText(),/다시 쓴 문장\n+51번 문제 2 · 편하신 시간을 알려 주시면 그 시간에 찾아뵙겠습니다\./);
   await record(tag,'feedback-blanks');
   await open(2,'writing');await card.locator(`[data-homework-key="past:${C}:2"]`).click();
   // 1주 읽기는 지금 자료보다 앞선 판으로 냈다: 정답은 지금 판으로 받고(서버가 막지 않는다) 「자료가 고쳐졌어요」를 함께 보인다.
   await card.locator(`[data-homework-key="past:${C}:1"]`).click();await open(1,'reading');await card.locator('.ws-hw-reading .ws-hw-judge').first().waitFor();
   const changed=await card.locator('.ws-hw-reading').evaluate(el=>({judges:el.querySelectorAll('.ws-hw-judge').length,notes:[...el.querySelectorAll('.ws-hw-help')].map(n=>n.textContent)}));
   assert.equal(changed.judges,5,'앞선 판으로 낸 읽기도 정답·근거를 본다');assert.ok(changed.notes.includes('이 과제를 낸 뒤 수업 자료가 고쳐졌어요. 지금 자료로 보여 줘요.'),JSON.stringify(changed.notes));
   await open(1,'reading');await card.locator(`[data-homework-key="past:${C}:1"]`).click();
   checks[`${tag}-old-version-key`]=true;
   // 7) 마감이 지난 뒤(목요일): 안 낸 과제는 「늦게 내도 괜찮아요」 — 4주 읽기·쓰기를 낸 상태라 5주차 전 날로 다시 연다
   fake.reset();await setClock(CLOCK.overdue);await openProfile();await settle('ready');
   assert.deepEqual(await card.evaluate(el=>[...el.querySelectorAll('.ws-hw-room>.ws-hw-week>.ws-hw-task .ws-hw-meta')].map(n=>[n.textContent,n.querySelector('.ws-led').dataset.tone])),
    [['마감이 지났어요 · 늦게 내도 괜찮아요','check'],['마감이 지났어요 · 늦게 내도 괜찮아요','check']]);
   await record(tag,'overdue');
   // 교사가 새 수정 과제를 시작해 반이 이력 보기로 바뀐 순간에 내면(409 HOMEWORK_READ_ONLY) 사실대로 알리고 다시 불러온다.
   fake.setMode('read-only');await open(4,'reading');
   for(const [item,n] of [['R4-1',2],['R4-2',1],['R4-3',3],['R4-4',4],['R4-5',2]])await press(`option:${C}:${item}:${n}`);
   const getsBeforeReadOnly=homeworkCalls.filter(c=>c.method==='GET').length;await press(`send:${C}:4:reading`);
   await page.waitForFunction(()=>(document.querySelector('#world-classroom-homework .ws-hw-task[data-kind="reading"] .ws-hw-notice')?.textContent||'').startsWith('이 반에서는 지난 과제 기록만 볼 수 있어요.'));
   for(let i=0;i<50&&homeworkCalls.filter(c=>c.method==='GET').length===getsBeforeReadOnly;i++)await page.waitForTimeout(100);
   assert.ok(homeworkCalls.filter(c=>c.method==='GET').length>getsBeforeReadOnly,'지난 과제 기록으로 바뀐 반은 다시 불러온다');
   // 다시 불러오면 칸이 「지난 과제 기록」이 되고, 내지 못한 읽기 답은 「이 기기에 남은 초안」으로 문항 차례·고른 번호를 보인다.
   await page.waitForFunction(()=>document.querySelector('#world-classroom-homework .ws-hw h3')?.textContent==='지난 과제 기록');
   const local=await card.locator('.ws-hw-task[data-kind="reading"][data-week="4"]').evaluate(el=>({title:el.querySelector('.ws-hw-kept h5')?.textContent,lines:[...el.querySelectorAll('.ws-hw-kept .ws-hw-mine')].map(n=>n.textContent)}));
   assert.deepEqual(local,{title:'이 기기에 남은 초안',lines:['01 · ②','02 · ①','03 · ③','04 · ④','05 · ②']});
   assert.doesNotMatch(await card.innerText(),/이력|수정 과제/,'어려운 말(이력)·내부 이름(수정 과제)을 쓰지 않는다');
   await record(tag,'read-only');
   fake.setMode('ok');await press('refresh');await settle('ready');checks[`${tag}-read-only-refused`]=true;
   await open(4,'writing');await card.locator('.ws-hw-write textarea[data-kind="text"]').fill(essay);await press(`send:${C}:4:writing`);await card.locator('.ws-hw-write .ws-hw-again').waitFor();
   assert.equal(fake.submissions.find(s=>s.week===4&&s.kind==='writing').late,true);assert.match(await task(4,'writing').locator('.ws-hw-meta').textContent(),/늦게 냈어요/);
   checks[`${tag}-late`]=true;
   // 고치지 않은 채 다시 내다가 첨삭이 먼저 오면 남길 글이 없다 — 「남겨 두었어요」라고 하지 않는다.
   const w4Key=`synk.world.homework.v1:${A}:${C}:W4`;
   await press(`edit:${C}:4:writing`);fake.returnFeedback(4,{'W4-1':{comment:{good:'늦었지만 자료를 빠짐없이 옮겼어요.'}}});
   await press(`send:${C}:4:writing`);await noticeIs('첨삭이 먼저 돌아와서 다시 낼 수 없어요.');
   await task(4,'writing').locator('.ws-hw-feedback').waitFor();
   assert.equal(await task(4,'writing').locator('.ws-hw-kept').count(),0);assert.equal(await page.evaluate(key=>localStorage.getItem(key),w4Key),null);
   // 썼다가 다 지운 빈 초안(빈 칸·빈 다시 써 볼 곳)은 「내지 못한 고친 글」로 남기지 않고 지운다.
   await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({v:1,answers:{'W4-1.1':'  '},retry:{'W3-1':''},savedAt:Date.now()+600000})),w4Key);
   await press('refresh');await settle('ready');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),w4Key),null,'빈 초안은 지운다');
   assert.equal(await task(4,'writing').locator('.ws-hw-meta').textContent(),'첨삭이 왔어요');
   checks[`${tag}-locked-unchanged`]=true;
   // 8) 시작 전 · 9) 8주를 마친 뒤
   fake.reset();await setClock(CLOCK.before);await openProfile();await settle('ready');
   assert.equal(await card.locator('.ws-hw-when').textContent(),'첫 과제는 3월 6일 (토) 수업 뒤에 열려요.');assert.equal(await card.locator('.ws-hw-task').count(),0);
   await record(tag,'before');
   await setClock(CLOCK.done);await openProfile();await settle('ready');
   assert.match(await card.locator('.ws-hw-room>.ws-hw-when').textContent(),/8주 과정을 마쳤어요/);assert.equal(await card.locator('.ws-hw-past-week').count(),8);
   await record(tag,'done');
   // 10) 서버 오류 → 다시 불러오기 · 11) 새로고침 중
   await setClock(CLOCK.week);fake.setMode('error');await openProfile();await settle('error');
   assert.equal(await card.locator('.ws-hw-alert p').textContent(),'과제를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
   await record(tag,'error');
   fake.setMode('ok');await press('retry');await settle('ready');checks[`${tag}-retry-after-error`]=true;
   const gate=deferred();fake.hold(gate);await press('refresh');await settle('loading');
   assert.equal(await card.locator('.ws-hw-status').textContent(),'과제를 불러오는 중이에요.');
   await record(tag,'loading');
   gate.resolve();await settle('ready');
   // 정답 서버가 실패하면 쓰기 예시답 자리에도 사실대로 알리고, 새로고침으로 다시 받는다.
   fake.setKeyMode('error');await openProfile();await settle('ready');
   await card.locator(`[data-homework-key="past:${C}:3"]`).click();await open(3,'writing');
   await page.waitForFunction(()=>[...document.querySelectorAll('#world-classroom-homework .ws-hw-feedback .ws-hw-help')].some(n=>n.textContent==='예시답을 불러오지 못했어요. 새로고침을 눌러 주세요.'));
   assert.equal(await card.locator('.ws-hw-feedback .ws-hw-model').count(),0);
   // 새로고침은 펼친 지난 주를 그대로 두고 연 칸만 닫는다.
   fake.setKeyMode('ok');await press('refresh');await settle('ready');
   await open(3,'writing');await card.locator('.ws-hw-feedback .ws-hw-model').waitFor();
   await open(3,'writing');checks[`${tag}-key-error`]=true;
   // 정답 판이 화면 자료 판과 다르면(자료를 막 고친 때) 자료를 한 번 새로 읽어 맞춰 보고, 그래도 다르면 「자료를 고치는 중」으로 알린다.
   fake.setKeyMode('other-version');const loadsBefore=contentLoads.length;await openProfile();await settle('ready');
   await card.locator(`[data-homework-key="past:${C}:3"]`).click();await open(3,'reading');
   await page.waitForFunction(()=>(document.querySelector('#world-classroom-homework .ws-hw-reading .ws-hw-summary')?.textContent||'').startsWith('수업 자료를 고치는 중이라'));
   assert.equal(contentLoads.length-loadsBefore,2,'열 때 한 번과 정답 판을 맞추려고 한 번');
   await record(tag,'key-stale');
   fake.setKeyMode('ok');await press('refresh');await settle('ready');
   await open(3,'reading');await card.locator('.ws-hw-reading .ws-hw-judge').first().waitFor();
   checks[`${tag}-key-stale`]=true;
   // 다른 탭에서 돌아와 조용히 다시 묻다가 서버가 잠깐 실패해도 보던 화면을 그대로 둔다.
   fake.setMode('error');const getsBefore=homeworkCalls.filter(c=>c.method==='GET').length;
   await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   for(let i=0;i<50&&homeworkCalls.filter(c=>c.method==='GET').length===getsBefore;i++)await page.waitForTimeout(100);
   assert.ok(homeworkCalls.filter(c=>c.method==='GET').length>getsBefore,'돌아오면 조용히 다시 묻는다');await page.waitForTimeout(300);
   assert.equal(await cardState(),'ready');assert.equal(await card.locator('.ws-hw-reading .ws-hw-judge').count(),5,'보던 정답 화면이 그대로');
   fake.setMode('ok');await open(3,'reading');await card.locator(`[data-homework-key="past:${C}:3"]`).click();
   checks[`${tag}-quiet-error-keeps`]=true;
   // 시트 맥락: 우리 반 수업 바로 아래의 이번 주 과제(그 크기 그대로의 화면 한 장)
   await card.evaluate(el=>el.scrollIntoView({block:'start'}));await page.waitForTimeout(150);const sheetFile=path.join(out,`${tag}-sheet.png`);await page.screenshot({path:sheetFile});shots.push(path.relative(out,sheetFile));
   // 12) 반이 없는 계정·과제 경로가 없는 옛 서버: 칸 자체가 없고 로그인은 그대로
   for(const mode of ['no-class','old-server']){fake.setMode(mode);const loads=contentLoads.length;await openProfile();assert.equal(await cardState(),'hidden',mode);assert.equal(contentLoads.length,loads,mode+': 반이 없으면 문제 자료를 읽지 않는다');assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot?.accountId),'11111111-1111-4111-8111-111111111111',mode);}
   checks[`${tag}-hidden-without-class`]=true;fake.setMode('ok');
  }
  // 시트를 닫으면 칸이 사라진다.
  await openProfile();await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);assert.equal(await page.locator('.ws-hw').count(),0);checks.closeDisposes=true;
  // 요청 모양: 반 연결과 같은 synk-classroom 머리(제품 world · 계약 1 · 이 탭의 SYNK ID 토큰 · 공개 키), 읽기는 쿼리 없음, 내기는 classId 쿼리
  for(const call of homeworkCalls){
   assert.deepEqual({product:call.product,contract:call.contract,authorization:call.authorization,apikey:call.apikey},{product:'world',contract:'1',authorization:'Bearer synthetic-browser-token',apikey:'sb_publishable_browser_fixture'});
   if(call.method==='GET')assert.deepEqual(call.query,{});else assert.deepEqual(call.query,{classId:C});
  }
  // 정답 요청: 같은 머리, POST · classId 쿼리 · 본문은 반·주·갈래만(계정 번호를 보내지 않는다)
  assert.ok(keyCalls.length>0);
  for(const call of keyCalls){
   assert.deepEqual({method:call.method,product:call.product,contract:call.contract,authorization:call.authorization,apikey:call.apikey},{method:'POST',product:'world',contract:'1',authorization:'Bearer synthetic-browser-token',apikey:'sb_publishable_browser_fixture'});
   assert.deepEqual(call.query,{classId:C});assert.deepEqual(Object.keys(call.body).sort(),['classId','kind','week']);
  }
  for(const [key,m] of Object.entries(measures)){
   assert.ok(m.docOverflow<=0&&m.panelOverflow<=0,`${key} 가로 넘침 ${m.docOverflow}/${m.panelOverflow}`);assert.deepEqual(m.overflowing,[],key+' 칸 밖으로 나간 요소');assert.equal(m.tableOverflow,0,key+' 표 가로 넘침');
   assert.deepEqual(m.small,[],key+' 13px 밑 한글');assert.deepEqual(m.shortTargets,[],key+' 44px 밑 단추');assert.ok(m.whitePills<=1,`${key} 흰 알약 ${m.whitePills}개`);
   assert.equal(m.layout,key.startsWith('1280')?'landscape':'portrait',key);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(external,[]);assert.equal(fs.existsSync(path.join(directory,'must-not-create')),false);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,date:new Date().toISOString(),syntheticAccount:true,syntheticClass:true,syntheticStudentText:true,liveProviderCalls:false,
   browser:'Edge headless (Playwright '+(()=>{try{return require('playwright/package.json').version;}catch{return '?';}})()+')',placement:'내 계정 시트 · 우리 반 수업 아래, 반 연결 위(#world-classroom-homework)',
   clock:Object.fromEntries(Object.entries(CLOCK).map(([k,v])=>[k,v.toISOString()])),contentVersion:content.version,viewports:VIEWPORTS,checks,measures,shots,homeworkRequests:homeworkCalls.length,keyRequests:keyCalls.length,contentLoads:contentLoads.length,
   requestShape:{get:homeworkCalls.find(c=>c.method==='GET'),post:{...posts()[0],body:{...posts()[0].body,answers:'(합성)'}}},errors,unexpected,external},null,2)+'\n');
 }catch(error){
  if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
  console.error('HOMEWORK_BROWSER_FAILURE',error.stack,JSON.stringify({errors,unexpected,external,homeworkCalls:homeworkCalls.slice(-4),server:serverOutput.slice(-800)}));throw error;
 }finally{
  if(browser)await browser.close().catch(()=>{});server.kill('SIGKILL');fs.rmSync(directory,{recursive:true,force:true});
 }
});
