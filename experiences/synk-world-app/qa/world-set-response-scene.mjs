// 검수 묶음 장면(2026-10-22, tools/검수묶음.mjs 준비 --장면): WORLD 학습자 응답(docs/디자인/WORLD_학습자응답과_내기록_설계_20261022.md §3·§7 화면)을
// 실제 앱 흐름으로 찍는다. 도구가 판(전·후)·기기(1440·390)마다 새 브라우저 맥락으로 한 번씩 부르고, 그때마다 처음부터 돈다.
//   ① 짧은 연습(읽기 항목) 끝 화면 → ② 「많았어요」를 고른 뒤 → (학습 목표에서 소리 끔) ③ 짧은 진단(읽기만) 끝 화면 → ④ 시험 형식 연습(시작하고 바로 그만두기) 끝 화면
//   → ⑤ 「내 계정」의 「내가 남긴 응답」(과 첫 줄 [빼기] 뒤) → ⑥ 영어·몽골어 화면 언어로 ①(고르기 전·고른 뒤)·⑤. 진단·시험 형식 끝 화면에서도 응답을 하나씩 골라 목록을 채운다.
//   찍는 이름: short-done · short-too-much · diagnostic-done · mock-done · me-responses · me-removed · {en,mn}-short-done · {en,mn}-short-chosen · {en,mn}-me-responses
// 계정 모드로 돈다 — 리허설 모드는 「내 계정」에 응답 목록을 그리지 않는다(app-shell responsesSection이 operating일 때만, 10-22 확인).
// server.mjs를 SYNK_WORLD_MODE=account로 띄우고(형제 SYNK-talk이 있어야 뜬다), 계정 서버 몫은 합성 SYNK ID 고정물이 받는다(qa/account-browser.test.mjs와
// 같은 꼴 — 반이 없는 새 계정이라 classroom 401·synk-personal 403도 실제 서버처럼 준다, 학습 기록 연결은 새 계정 기본값인 꺼짐). 밖 주소는 막는다.
// 설정값 features.worldFeedback은 서버를 고치지 않고 진입 HTML의 #synk-world-config JSON에 넣는다(전·후 같게 — 바탕 판은 그 칸을 모르고 버린다).
// 「전」은 같은 끝 화면을 응답 줄 없이 찍는다. 「전」에 응답 줄이 보이면(--주소뿌리를 안 줘 바뀐 파일이 바탕 판으로 안 끼워짐) 멈추고, 「후」에 없으면(설정값이 안 켜짐) 멈춘다.
// 시트는 내용 칸이 스크롤되므로 찍기 전에 응답 줄(전은 그 자리 바로 아래 단추)을 가운데로 옮기고, 마우스를 구석으로 치운다(누른 자리의 hover가 찍히지 않게).
// 그림마다 곁에 <이름>.측정.json — 문서·시트 가로 넘침, 응답 칸 밖으로 나간 요소, 13px 밑 한글, 44px 밑 누름 자리, 영어·몽골어 화면의 lang="ko" 밖 한글.
//
// 쓰는 법(서버는 장면이 그 포트에 띄우고 끝나면 끈다 — 이미 계정 모드 WORLD가 떠 있으면 그대로 쓴다. 포트는 --화면 주소에서 읽고, 없으면 4417):
//   node tools/검수묶음.mjs 준비 <이름> experiences/synk-world-app experiences/brand-opening --종류 화면 --바탕 <기능 커밋의 부모>
//     --장면 experiences/synk-world-app/qa/world-set-response-scene.mjs --화면 world=http://127.0.0.1:4417/world/
//     --주소뿌리 http://127.0.0.1:4417/brand-opening/=experiences/brand-opening/ http://127.0.0.1:4417/world/brand-opening/=experiences/brand-opening/ http://127.0.0.1:4417/world/=experiences/synk-world-app/
// --주소뿌리는 꼭 준다(그 순서 그대로) — 앱 파일은 /world/<이름>으로 나가 저장소 경로로 끝나지 않아, 없으면 「전」이 바탕 판으로 안 바뀐다.
// (로컬 계정 모드는 app-shell의 ../brand-opening/ 가져오기가 /brand-opening/으로, 홈이 /world/brand-opening/으로 나가 world-strings.mjs가 두 주소로 온다 — 둘 다 끼운다.)
// --시각은 주지 않는다(고정 시계면 응답 시각이 모두 같아 「새것부터」 순서를 못 본다). 진행 기록은 SYNK_QA_VERBOSE=1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {emptyPlayState,validatePlayChanges} from '../../play-common/play-data.mjs';
import {awardMiniGame} from '../../korean-racing/garage-core.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const 기본주소='http://127.0.0.1:4417/world/';
const A='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222';
const 계정곳='https://identity.example.test';
const 계정설정={version:1,supabaseUrl:계정곳,supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:계정곳,portalUrl:`${계정곳}/`,clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const 이PC=new Set(['127.0.0.1','localhost','[::1]']);
const talk=()=>[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));

async function 건강(주소){
 try{const r=await fetch(new URL('/health',주소),{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():{ok:false,status:r.status};}catch{return null;}
}
// 계정 모드 WORLD 서버: 이미 떠 있으면 그대로, 없으면 띄워서 끝날 때 끈다. 데이터 폴더는 쓰지 않는다(계정 모드 — 이름만 넘김).
async function 서버준비(주소){
 const 지금=await 건강(주소);
 if(지금?.mode==='account')return {닫기:async()=>{}};
 if(지금)throw Error(`${new URL(주소).host}에 계정 모드가 아닌 서버가 떠 있다(${JSON.stringify(지금).slice(0,120)}) — 다른 포트를 --화면·--주소뿌리에 준다`);
 const 형제=talk();if(!형제)throw Error('형제 저장소 SYNK-talk(lib/world-v1-server.js)을 못 찾았다 — SYNK_TALK_ROOT로 가리킨다');
 const u=new URL(주소),폴더=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-set-response-'));
 fs.writeFileSync(path.join(폴더,'account.json'),JSON.stringify(계정설정));
 const 기록=[];
 const 서버=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',windowsHide:true,
  env:{...process.env,SYNK_TALK_ROOT:형제,SYNK_WORLD_PORT:u.port,SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:u.pathname,SYNK_WORLD_ACCOUNT_CONFIG:path.join(폴더,'account.json'),SYNK_WORLD_DATA_DIR:path.join(폴더,'must-not-create')}});
 서버.stdout.on('data',c=>기록.push(String(c)));서버.stderr.on('data',c=>기록.push(String(c)));
 const 닫기=async()=>{
  if(서버.exitCode===null){const 끝=new Promise(r=>서버.once('exit',r));서버.kill();await Promise.race([끝,new Promise(r=>setTimeout(r,5000))]);}
  fs.rmSync(폴더,{recursive:true,force:true,maxRetries:3});
 };
 for(let i=0;i<300;i++){
  if(서버.exitCode!==null){await 닫기();throw Error(`WORLD 서버가 뜨지 않았다: ${기록.join('').slice(-600)}`);}
  if((await 건강(주소))?.mode==='account')return {닫기};
  await new Promise(r=>setTimeout(r,100));
 }
 await 닫기();throw Error(`WORLD 서버가 30초 안에 뜨지 않았다: ${기록.join('').slice(-600)}`);
}

// 합성 SYNK ID 계정 서버(qa/account-browser.test.mjs의 고정물과 같은 답). 상태는 장면 한 번 안에만 있다.
function 계정고정물(){
 let learning={enabled:false,revision:1},playRevision=0;
 const playState=emptyPlayState(),playCommands=new Map(),learningEvents=[],모르는=[];
 const snapshot={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
 async function 받기(route){
  const req=route.request(),target=new URL(req.url()),p=target.pathname;
  let body=null;try{body=req.postDataJSON();}catch{body=null;}
  const 답=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'}});
  let data={ok:true};
  if(p.endsWith('/synk-account')){if(body?.action==='learning-consent')learning={enabled:body.enabled,revision:learning.revision+1};data=body?{ok:true,refreshRevoked:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning,capabilities:{learningSync:true},sessions:[{id:C,current:true,revoked:false,product:'world'}]};}
  else if(p.endsWith('/synk-play')){
   if(body){if(playCommands.has(body.id))data=playCommands.get(body.id);else{let result;
    if(body.action==='progress'){for(const change of validatePlayChanges(body.changes)){if(change.value===null)delete playState.records[change.key];else playState.records[change.key]=change.value;}}
    else if(body.action==='wallet'){result=awardMiniGame(playState.wallet,body.args[0]);playState.wallet=result.state;}
    data={ok:true,scope:'synk-play',accountId:A,revision:++playRevision,state:structuredClone(playState),...(result?{result}:{})};playCommands.set(body.id,data);}}
   else data={ok:true,scope:'synk-play',accountId:A,revision:playRevision,state:structuredClone(playState)};
  }
  else if(p.endsWith('/synk-learning')){
   if(target.searchParams.get('view')==='memory'||body?.memory)data={ok:true,revision:learning.revision,entries:body?.memory||[]};
   else if(body?.events){learningEvents.push(...body.events);data={ok:true,revision:learning.revision,accepted:body.events.map(event=>event.id)};}
   else data={ok:true,revision:learning.revision,events:learningEvents,cursor:learningEvents.length,hasMore:false};
  }
  else if(p.endsWith('/synk-world-v1/bootstrap'))data=snapshot;
  else if(p.endsWith('/synk-town/entry'))data={ok:true,accountId:A,allowed:true,entryVerified:true,access:'trial'};
  else if(p.endsWith('/functions/v1/synk-classroom/api/world/homework'))data={ok:true,mode:'account-linked',accountId:A,classes:[],emptyReason:'NO_CLASS'};
  else if(p.endsWith('/functions/v1/classroom'))return 답(401,{contract_ver:'c16',ok:false,error:{code:'AUTH_REQUIRED',message:'다시 로그인해 주세요',retryable:false}});
  else if(p.endsWith('/synk-personal'))return 답(403,{ok:false,error:{code:'PRODUCT_FORBIDDEN'}});
  else if(p.endsWith('/synk-classroom/api/classes'))data={ok:true,mode:'account-linked',classes:[],learnerId:null,staffId:null};
  else if(p.startsWith('/auth/v1/logout'))data={};
  else{모르는.push(`${req.method()} ${p}`);return 답(404,{ok:false,error:{code:'NOT_FOUND'}});}
  return 답(200,data);
 }
 return {받기,모르는};
}

// 진입 HTML의 설정 JSON에 worldFeedback을 켠다(꺾쇠는 document.mjs처럼 유니코드 이스케이프로 — 스크립트 칸이 닫히지 않게).
function 설정켜기(html){
 const 꼴=/(<script type="application\/json" id="synk-world-config">)([\s\S]*?)(<\/script>)/;
 if(!꼴.test(html))throw Error('진입 HTML에 #synk-world-config가 없다');
 return html.replace(꼴,(_,앞,json,뒤)=>{const 설정=JSON.parse(json);설정.features={...(설정.features||{}),worldFeedback:true};return 앞+JSON.stringify(설정).replaceAll('<','\\u003c')+뒤;});
}

export default async function 장면({page,찍기,판,기기,주소들={}}){
 const 주소=new URL(Object.values(주소들).find(Boolean)||process.env.SYNK_WORLD_SCENE_URL||기본주소);
 if(!이PC.has(주소.hostname))throw Error(`이 PC 주소만 쓴다: ${주소.href}`);
 if(!주소.port)throw Error(`포트가 있는 주소를 준다: ${주소.href}`);
 const 뿌리=new URL(주소.pathname.endsWith('/')?주소.pathname:주소.pathname.replace(/[^/]*$/,''),주소.origin).href;
 const 말=(...a)=>{if(process.env.SYNK_QA_VERBOSE)console.log(`[장면 ${판} ${기기}]`,...a);};
 const 서버=await 서버준비(뿌리);
 const 고정물=계정고정물(),밖=[];
 try{
  page.setDefaultTimeout(30000);
  // 경로는 page.route로 — 도구의 「전」 끼우기(context.route)보다 먼저 보고, 맞지 않는 요청은 그쪽으로 간다.
  await page.route(u=>u.origin===계정곳,고정물.받기);
  await page.route(u=>/^https?:$/.test(u.protocol)&&!이PC.has(u.hostname)&&u.origin!==계정곳,route=>{밖.push(route.request().url());return route.abort('blockedbyclient');});
  await page.route(u=>u.origin===주소.origin&&(u.pathname===new URL(뿌리).pathname||u.pathname===`${new URL(뿌리).pathname}index.html`),async route=>{
   const 응답=await route.fetch();return route.fulfill({response:응답,body:설정켜기(await 응답.text())});
  });
  // 합성 계정 세션(account-browser.test.mjs와 같다): 첫 문서가 SYNK ID 로그인을 이 세션으로 되살린다.
  await page.addInitScript(()=>{if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));});

  // ── 도우미 ──
  const 시트열림=()=>page.evaluate(()=>Boolean(document.querySelector('#world-panel')?.open));
  const 시트닫기=async()=>{if(await 시트열림()){await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);}};
  const 입장=async()=>{
   await page.goto(`${뿌리}?opening=off`,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__synkWorld?.client);
   for(let i=0;i<240;i++){
    const 상태=await page.evaluate(()=>{const 보임=s=>[...document.querySelectorAll(s)].some(n=>n.getClientRects().length>0),shell=document.querySelector('.world-shell');
     return 보임('[data-lang-picker]')?'lang':보임('dialog[open] [data-world="device-records"][data-choice="keep"]')?'records':보임('dialog[open] [data-first-hangul="reads"]')?'hangul':보임('dialog[open] .tutor-option')?'tutor'
      :보임('[data-world="guest"]')?'guest':window.__synkWorld.client.snapshot&&shell?.dataset.entry==='ready'&&!document.querySelector('dialog[open]')?'ready':'wait';});
    if(상태==='ready')return;
    if(상태==='lang'){await page.locator('[data-lang-choice="ko"]').click();await page.locator('[data-lang-confirm]').click();}
    else if(상태==='hangul')await page.locator('dialog[open] [data-first-hangul="reads"]').click();
    else if(상태==='records')await page.locator('dialog[open] [data-world="device-records"][data-choice="keep"]').click();
    else if(상태==='tutor'){await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();}
    else if(상태==='guest')throw Error('합성 SYNK ID 세션으로 로그인되지 않았다(손님 화면) — 고정물·설정을 확인한다');
    await page.waitForTimeout(250);
   }
   throw Error('입장 단계가 끝나지 않았다');
  };
  const 배우기=async()=>{await 시트닫기();await page.locator('nav [data-view="packs"], [data-view="packs"][data-life-library]').last().click();await page.waitForSelector('#panel-content .life-hub');};
  const 내위치=async()=>{await 배우기();await page.locator('#panel-content [data-view="position"]').click();await page.waitForSelector('#panel-content [data-position-board]');};
  // 짧은 연습: 이 항목 연습을 열 수 있는 읽기 항목 하나(판의 항목 줄을 펼쳐 「이 항목 연습하기」) → 문항마다 첫 보기 → 다음 → 끝 화면.
  const 짧은연습=async()=>{
   await 내위치();
   const 항목=await page.evaluate(()=>[...document.querySelectorAll('#panel-content [data-position-practice]')].map(n=>n.dataset.positionPractice).find(id=>/^ko\.reading\./.test(id)));
   if(!항목)throw Error('연습할 읽기 항목이 없다(내 위치 판에 「이 항목 연습하기」가 없음)');
   await page.locator(`#panel-content details.wpos-skill[data-skill="${항목}"] > summary`).click();
   // 같은 항목 단추가 「먼저 볼 항목」에도 있을 수 있어 펼친 줄 안의 것을 누른다.
   await page.locator(`#panel-content details.wpos-skill[data-skill="${항목}"] [data-position-practice="${항목}"]`).click();
   await page.waitForSelector('#panel-content [data-practice-stage]');
   for(let i=0;i<80;i++){
    const 상태=await page.evaluate(()=>{const c=document.querySelector('#panel-content');return c?.querySelector('[data-practice-done]')?'done':c?.querySelector('[data-practice-next]')?'next':c?.querySelector('[data-practice-choice]:not([disabled])')?'choice':c?.querySelector('[data-practice-skip]')?'skip':'wait';});
    if(상태==='done'){말('짧은 연습',항목);return 항목;}
    if(상태==='next')await page.locator('#panel-content [data-practice-next]').click();
    else if(상태==='choice')await page.locator('#panel-content [data-practice-choice]:not([disabled])').first().click();
    else if(상태==='skip')await page.locator('#panel-content [data-practice-skip]').click();
    else await page.waitForTimeout(100);
   }
   throw Error('짧은 연습이 끝나지 않았다');
  };
  const 진단=async()=>{
   await 내위치();
   await page.locator('#panel-content [data-position-diagnostic]').click();
   await page.waitForSelector('#panel-content [data-position-stage]');
   for(let i=0;i<120;i++){
    const 상태=await page.evaluate(()=>{const c=document.querySelector('#panel-content');return c?.querySelector('[data-position-done]')?'done':c?.querySelector('[data-position-choice]:not([disabled])')?'choice':c?.querySelector('[data-position-skip]')?'skip':'wait';});
    if(상태==='done')return;
    if(상태==='choice')await page.locator('#panel-content [data-position-choice]:not([disabled])').first().click();
    else if(상태==='skip')await page.locator('#panel-content [data-position-skip]').click();
    else await page.waitForTimeout(100);
   }
   throw Error('짧은 진단이 끝나지 않았다');
  };
  const 시험형식=async()=>{
   await 내위치();
   await page.locator('#panel-content [data-position-mock]').click();
   await page.locator('#panel-content [data-mock-start]').click();
   await page.locator('#panel-content [data-mock-stop]').first().click();
   await page.waitForSelector('#panel-content [data-mock-done]');
  };
  // 학습 목표 창에서 「소리 끔」(오늘)으로 저장 — 짧은 진단이 듣기 문항을 빼고 읽기만 낸다.
  const 소리끄기=async()=>{
   await 시트닫기();await page.locator('#settings-open').click();
   await page.locator('#panel-content .panel-actions .plain-button').first().click();await page.waitForSelector('#world-study-form');
   await page.locator('#world-study-form input[name="audio"][value="off"]').check({force:true});
   if(!await page.locator('#world-study-form input[name="consent"]').isChecked())await page.locator('#world-study-form input[name="consent"]').check({force:true});
   await page.locator('#world-study-form button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#world-study-form'));
  };
  const 내계정=async()=>{
   await 시트닫기();await page.locator('[data-view="me"]').filter({visible:true}).first().click();
   await page.waitForFunction(()=>window.__synkWorld.screen()==='world-profile');
   // 「우리 반 수업」·「이번 주 과제」를 묻고 나서 찍는다(늦게 채워지는 칸이 그림을 흔들지 않게).
   await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
  };
  // 화면 언어: 설정에서 바꾸듯 world-lang.mjs의 setLang. 로컬 계정 모드 서버는 소스를 그대로 내줘서(공개 빌드처럼 ../brand-opening/을 ./로 바꾸지 않는다)
  // app-shell·학습 화면은 /brand-opening/world-lang.mjs를, 홈은 /world/brand-opening/world-lang.mjs를 따로 불러 언어 상태가 둘이다 — 불러온 것 모두에 건다.
  const 화면말=async lang=>{
   await page.evaluate(async lang=>{
    const 주소들=[...new Set(performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/\/brand-opening\/world-lang\.mjs$/.test(new URL(n).pathname)))];
    if(!주소들.length)throw Error('불러온 world-lang.mjs가 없다');
    for(const href of 주소들)(await import(href)).setLang(lang);
   },lang);
   await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);
  };
  // 응답 줄(후)이 있어야 할 판인지 확인하고 돌려준다. 전에 있으면(바뀐 파일이 안 끼워짐) · 후에 없으면(설정값이 안 켜짐) 멈춘다.
  const 응답칸=async 끝=>{
   const 있음=await page.locator('#panel-content [data-set-response-box]').count()>0;
   if(판==='전'&&있음)throw Error(`「전」 ${끝} 끝 화면에 응답 줄이 있다 — --주소뿌리로 /world/ 파일이 바탕 판으로 끼워졌는지 본다`);
   if(판!=='전'&&!있음)throw Error(`「후」 ${끝} 끝 화면에 응답 줄이 없다 — 진입 HTML의 features.worldFeedback이 켜졌는지 본다`);
   return 있음;
  };
  const 고르기=async 값=>{if(판==='전')return;await page.locator(`#panel-content [data-set-response="${값}"]`).click();await page.waitForSelector(`#panel-content [data-set-response="${값}"][aria-pressed="true"]`);};
  // 잰 값. 영역(이번 기능 칸 — 응답 줄·응답 목록): 시트 내용 칸 밖으로 나간 요소·글이 잘린 요소·누름 자리 크기(44px 밑은 따로)·13px 밑 한글·lang="ko" 밖 한글.
  // 시트 전체(참고 — 이번에 안 바뀐 칸도 든다): 문서·시트·화면 가로 넘침, 13px 밑 한글, 영어·몽골어 화면의 lang="ko" 밖 한글.
  const 재기=영역=>page.evaluate(영역=>{
   const c=document.querySelector('#panel-content');if(!c)return null;
   const 보임=n=>n.getClientRects().length>0,상자=c.getBoundingClientRect(),칸=영역?c.querySelector(영역):null;
   const 이름=n=>(Object.keys(n.dataset||{})[0]?`[data-${Object.keys(n.dataset)[0].replace(/[A-Z]/g,x=>`-${x.toLowerCase()}`)}]`:'')||(typeof n.className==='string'&&n.className?`.${n.className.split(/\s+/)[0]}`:n.tagName.toLowerCase());
   const 글들=뿌리=>{const 작은=[],섞인=[],길=document.createTreeWalker(뿌리,NodeFilter.SHOW_TEXT);
    for(let n=길.nextNode();n;n=길.nextNode()){const 글=n.textContent.trim();if(!글||!/[가-힣]/.test(글)||!보임(n.parentElement))continue;
     if(parseFloat(getComputedStyle(n.parentElement).fontSize)<13)작은.push(글.slice(0,30));
     if(document.documentElement.lang!=='ko'&&!n.parentElement.closest('[lang="ko"]'))섞인.push(글.slice(0,40));}
    return {작은,섞인};};
   const 안=칸?[...칸.querySelectorAll('*')].filter(보임):[];
   const 넘친=안.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.right>상자.right+.5||r.left<상자.left-.5);}).map(이름);
   const 잘린=안.filter(n=>{const s=getComputedStyle(n);return /hidden|clip/.test(s.overflowX+s.overflow)&&n.scrollWidth>n.clientWidth+1;}).map(이름);
   const 누름=칸?[...칸.querySelectorAll('button,a,input,select,label:has(input)')].filter(보임).map(n=>{const r=n.getBoundingClientRect();return {이름:이름(n),글:(n.innerText||'').trim().slice(0,30),높이:Math.round(r.height),너비:Math.round(r.width)};}):[];
   const 영역글=칸?글들(칸):{작은:[],섞인:[]},시트글=글들(c),줄=칸?.getBoundingClientRect();
   return {lang:document.documentElement.lang,영역,영역있음:Boolean(칸),영역위치:줄?{위:Math.round(줄.top),아래:Math.round(줄.bottom),화면높이:innerHeight}:null,
    영역검사:{넘친,잘린,작은누름:누름.filter(x=>x.높이<44),좁은누름:누름.filter(x=>x.너비<44),작은한글:영역글.작은,lang밖한글:영역글.섞인,누름},
    시트참고:{문서넘침:document.documentElement.scrollWidth-document.documentElement.clientWidth,시트넘침:c.scrollWidth-c.clientWidth,화면넘침:Math.round(innerWidth-(visualViewport?.width||innerWidth)),작은한글:시트글.작은,lang밖한글:시트글.섞인}};
  },영역);
  // 홈 알림(#home-toast, 3.8초)이 사라질 때까지 — 시트를 열기 전에 뜬 알림은 1440에서 오른쪽 시트 밑에 반쯤 가려 찍힌다(이 기능과 무관한 흐름 속도 탓).
  const 알림끝=()=>page.waitForFunction(()=>{const n=document.querySelector('#home-toast');return !n||n.hidden;},null,{timeout:6000}).catch(()=>{});
  // 찍기: 영역(없으면 그 자리 바로 아래 단추)을 시트 가운데로 옮기고 마우스를 치운 뒤 찍는다. 잰 값은 그림 곁에 둔다.
  const 찍음=async(이름,영역,대신)=>{
   await 알림끝();
   await page.evaluate(([영역,대신])=>{const c=document.querySelector('#panel-content');(c?.querySelector(영역)||c?.querySelector(대신))?.scrollIntoView({block:'center'});},[영역,대신]);
   await page.mouse.move(1,1);await page.waitForTimeout(150);
   const 잼=await 재기(영역).catch(e=>({오류:String(e).split('\n')[0]}));
   const r=await 찍기(이름);
   try{fs.writeFileSync(r.그림.replace(/\.png$/,'.측정.json'),JSON.stringify({판,기기,이름,...잼},null,1)+'\n');}catch{/* 잰 값은 덤 */}
   const 칸=잼?.영역검사||{},시=잼?.시트참고||{};
   const 걸림=[시.문서넘침>0&&'문서 가로 넘침',시.시트넘침>0&&'시트 가로 넘침',시.화면넘침>0&&'화면 가로 넘침',칸.넘친?.length&&`응답 칸 밖 ${칸.넘친.join('·')}`,칸.잘린?.length&&`잘린 글 ${칸.잘린.join('·')}`,
    칸.작은누름?.length&&`44px 밑 ${칸.작은누름.map(x=>`${x.글||x.이름} ${x.높이}px`).join('·')}`,칸.작은한글?.length&&`13px 밑 한글 ${칸.작은한글.join('·')}`,칸.lang밖한글?.length&&`lang="ko" 밖 한글 ${칸.lang밖한글.slice(0,3).join('·')}`,
    시.lang밖한글?.length&&`(시트 참고) lang="ko" 밖 한글 ${시.lang밖한글.length}곳: ${시.lang밖한글.slice(0,3).join('·')}`].filter(Boolean);
   if(잼?.오류)걸림.push(`잼 실패 ${잼.오류}`);
   if(걸림.length)console.log(`[장면 ${판} ${기기}] ${이름}: ${걸림.join(' · ')}`);
   return r;
  };
  const 응답='[data-set-response-box]',목록='[data-world-responses]';

  // ── 흐름 ──
  await 입장();말('입장');
  // ① 짧은 연습 끝 화면(응답 고르기 전) ② 「많았어요」를 고른 뒤
  await 짧은연습();await 응답칸('짧은 연습');
  await 찍음('short-done',응답,'[data-practice-again],[data-practice-shortage]');
  await 고르기('too_much');
  await 찍음('short-too-much',응답,'[data-practice-again],[data-practice-shortage]');
  // ③ 짧은 진단(소리 끔 — 읽기만) 끝 화면 → 「좋았어요」
  await 소리끄기();await 진단();await 응답칸('짧은 진단');
  await 찍음('diagnostic-done',응답,'[data-position-back]');
  await 고르기('helpful');
  // ④ 시험 형식 연습(시작하고 바로 그만두기) 끝 화면 → 「안 맞았어요」
  await 시험형식();await 응답칸('시험 형식 연습');
  await 찍음('mock-done',응답,'[data-mock-done] .wpos-run-actions');
  await 고르기('not_fit');
  // ⑤ 「내 계정」 — 내가 남긴 응답(전은 그 자리: 학습 기록 연결 아래)
  await 내계정();
  if(판!=='전'&&!await page.locator(`#panel-content ${목록}`).count())throw Error('「후」 내 계정에 「내가 남긴 응답」이 없다');
  await 찍음('me-responses',목록,'#world-classroom-lessons');
  // ⑤′ 첫 줄 [빼기] 뒤(알림 「응답을 뺐어요.」가 사라진 뒤의 목록 — 줄이 하나 줄고 초점이 같은 자리 단추로). 전은 같은 시트.
  if(판!=='전'){
   const 앞=await page.locator(`#panel-content ${목록} [data-response-remove]`).count();
   await page.locator(`#panel-content ${목록} [data-response-remove]`).first().click();
   await page.waitForFunction(앞=>document.querySelectorAll('#panel-content [data-world-responses] [data-response-remove]').length===앞-1,앞);
  }
  await 찍음('me-removed',목록,'#world-classroom-lessons');
  // ⑥ 영어·몽골어: 계정의 화면 언어를 설정에서 바꾸듯 바꾸고 ①(고르기 전·고른 뒤)·⑤
  for(const [lang,값] of [['en','want_more'],['mn','too_much']]){
   await 시트닫기();await 화면말(lang);말('화면 언어',lang);
   await 짧은연습();await 응답칸(`${lang} 짧은 연습`);
   await 찍음(`${lang}-short-done`,응답,'[data-practice-again],[data-practice-shortage]');
   await 고르기(값);
   await 찍음(`${lang}-short-chosen`,응답,'[data-practice-again],[data-practice-shortage]');
   await 내계정();
   await 찍음(`${lang}-me-responses`,목록,'#world-classroom-lessons');
  }
  if(고정물.모르는.length)console.log(`[장면 ${판} ${기기}] 고정물이 모르는 계정 요청(404로 답함): ${[...new Set(고정물.모르는)].join(', ')}`);
  if(밖.length)console.log(`[장면 ${판} ${기기}] 막은 바깥 요청: ${[...new Set(밖)].slice(0,5).join(', ')}`);
 }finally{
  await page.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});
  await 서버.닫기();
 }
}
