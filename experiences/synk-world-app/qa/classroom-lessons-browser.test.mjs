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
// 계정 모드 WORLD(실제 Chromium/Edge)의 내 계정 시트에서 「우리 반 수업」을 합성 계정·합성 수업 응답으로 연다.
// 운영 계정·서버·방송을 쓰지 않는다. 바깥 주소는 막고, 계정 API 주소는 아래 고정 응답만 받는다.
// 캡처와 result.json은 SYNK_CLASSROOM_QA_OUT(기본 qa/classroom-lessons-20261019/)에 쓴다. 그림은 .gitignore 대상이다.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
const out=path.resolve(process.env.SYNK_CLASSROOM_QA_OUT||path.join(root,'experiences/synk-world-app/qa/classroom-lessons-20261019'));
const A='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
// 합성 수업: 1기(2027-03 개강) 화·목 19:30 KST. 학생 이름·실제 영상은 없다.
const at=(day,time='19:30')=>new Date(`2027-${day}T${time}:00+09:00`).toISOString();
const watch=id=>`https://www.youtube.com/watch?v=${id}`;
const lesson=(key,title,day,status,video=null,time)=>({session_key:key,title,starts_at:at(day,time),ends_at:null,status,watch_url:video?watch(video):null});
const topik={class_id:C,display_name:'합성 · TOPIK 4급 온라인 1기',video_privacy:'private',playlist_url:null,meeting_url:'https://meet.google.com/abc-defg-hij'};
const T={w1tue:'1주차 화요일 · 오리엔테이션 — 4급 시험 구조와 8주 계획',w1thu:'1주차 목요일 · 읽기 — 빈칸에 알맞은 말 고르기',w2tue:'2주차 화요일 · 어휘 — 사회·환경 주제 낱말',
 w2thu:'2주차 목요일 · 문법 — -는 반면에 / -는 데다가',w3mon:'3주차 월요일 · 질문 시간',w3tue:'3주차 화요일 · 읽기 — 글의 중심 생각 찾기',w3thu:'3주차 목요일 · 쓰기 — 54번 의견 글 짜기',
 w4tue:'4주차 화요일 · 듣기 — 대화 듣고 이어질 행동 고르기',w4thu:'4주차 목요일 · 쓰기 — 53번 그래프 설명하기'};
const SCENARIOS={
 live:{state:'ready',classes:[{...topik,sessions:[lesson('w3-tue',T.w3tue,'03-23','live','w3TueLive01'),lesson('w3-thu',T.w3thu,'03-25','access_pending'),
  lesson('w4-thu',T.w4thu,'04-01','scheduled'),lesson('w4-tue',T.w4tue,'03-30','scheduled'),lesson('w2-tue',T.w2tue,'03-16','ready','w2TueReplay'),
  lesson('w2-thu',T.w2thu,'03-18','ready','w2ThuReplay'),lesson('w3-mon',T.w3mon,'03-22','processing',null,'20:00')]}]},
 before:{state:'ready',classes:[{...topik,sessions:[lesson('w1-thu',T.w1thu,'03-11','scheduled'),lesson('w1-tue',T.w1tue,'03-09','scheduled')]}]},
 replay:{state:'ready',classes:[{...topik,video_privacy:'unlisted',playlist_url:'https://www.youtube.com/playlist?list=PLsynkTopik4Class1',meeting_url:null,sessions:[
  lesson('w1-tue',T.w1tue,'03-09','ready','w1TueReplay'),lesson('w1-thu',T.w1thu,'03-11','ready','w1ThuReplay'),lesson('w2-tue',T.w2tue,'03-16','ready','w2TueReplay'),lesson('w2-thu',T.w2thu,'03-18','processing')]}]},
 attention:{state:'ready',classes:[{...topik,sessions:[lesson('w3-tue',T.w3tue,'03-23','interrupted'),lesson('w3-thu',T.w3thu,'03-25','access_pending'),
  lesson('w2-tue',T.w2tue,'03-16','unavailable'),lesson('w1-thu',T.w1thu,'03-11','failed')]}]},
 'no-sessions':{state:'ready',classes:[{...topik,video_privacy:'unlisted',meeting_url:null,sessions:[]}]},
 'open-error':{state:'ready',classes:[{...topik,video_privacy:'unlisted',meeting_url:null,sessions:[{...lesson('w2-tue',T.w2tue,'03-16','ready'),watch_url:'http://www.youtube.com/watch?v=w2TueReplay'}]}]},
 empty:{state:'empty',classes:[]},
 'not-linked':{state:'empty',status:401,code:'AUTH_REQUIRED'},
 error:{state:'error',status:500,code:'SERVER_ERROR'},
 loading:{state:'loading',hold:true}};
const ORDER=['loading','live','before','attention','replay','no-sessions','open-error','empty','not-linked','error'];
const VIEWPORTS=[{tag:'390',size:{width:390,height:844}},{tag:'1280',size:{width:1280,height:800}}];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function classroomBody(name){
 const s=SCENARIOS[name];
 if(s.status)return {status:s.status,body:{contract_ver:'c16',ok:false,error:{code:s.code,message:'합성 오류',retryable:s.status>=500}}};
 return {status:200,body:{contract_ver:'c16',ok:true,classes:s.classes,empty_reason:s.classes.length?null:'NO_ACTIVE_CLASS_ACCESS',server_time:new Date().toISOString()}};
}

test('계정 모드 WORLD 내 계정 시트의 「우리 반 수업」: 상태별 화면·재조회·탭 복귀·로그인 유지 (390·1280)',{timeout:300000,skip:!talkRoot&&'형제 저장소 SYNK-talk이 없다(SYNK_TALK_ROOT로 가리킨다)'},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-classroom-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 fs.mkdirSync(out,{recursive:true});for(const name of fs.readdirSync(out))if(/\.png$/.test(name))fs.rmSync(path.join(out,name));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talkRoot,SYNK_WORLD_PORT:String(port),
  SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')}});
 let serverOutput='';server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 const url=`http://127.0.0.1:${port}`,origin=new URL(config.accountApiUrl).origin,calls=[],classroomCalls=[],unexpected=[],errors=[],external=[],shots=[],checks={},measures={};
 let browser,page,scenario='loading',hold=null;
 t.signal.addEventListener('abort',()=>{server.kill('SIGKILL');},{once:true});
 const playState=emptyPlayState(),played=new Map();let playRevision=0;
 try{
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(serverOutput);try{const r=await fetch(url+'/world/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await playwright.chromium.launch({channel:'msedge',headless:true,timeout:30000});
  const context=await browser.newContext({viewport:VIEWPORTS[0].size,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});context.setDefaultTimeout(25000);
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
  await context.addInitScript(()=>{if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));});
  const cors={'Access-Control-Allow-Origin':'*'};
  await context.route(origin+'/**',async route=>{
   const req=route.request(),target=new URL(req.url());let status=200,data={ok:true};
   try{
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...cors,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, POST, PUT'}});return;}
    const body=req.postDataJSON();calls.push({path:target.pathname,method:req.method()});
    if(target.pathname==='/functions/v1/classroom'){
     const h=await req.allHeaders();classroomCalls.push({scenario,method:req.method(),search:target.search,contract:h['x-contract-ver'],authorization:h.authorization,apikey:h.apikey,contentType:h['content-type']||null});
     if(SCENARIOS[scenario].hold){const gate=hold;await gate.promise;}
     ({status,body:data}=classroomBody(scenario));
    }
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
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:cors});
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  hold=deferred();
  await page.goto(url+'/world/?opening=off',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
  assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot.accountId),A);
  // 10-19 화면 언어 1판부터 첫 실행은 언어 고르기(first-run.mjs language)부터다. 이 시험은 한국어 화면 글을 읽으므로 account-browser.test.mjs처럼 한국어를 고른다.
  await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('[data-lang-picker]').count()){await page.locator('[data-lang-choice="ko"]').click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
  // 10-19 master(b9eb193e0)부터 「한글을 읽을 수 있어요?」(first-run.mjs)가 튜터 고르기보다 먼저 나온다. account-browser.test.mjs처럼 「읽을 수 있어요」로 넘긴다.
  await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}
  await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');}
  const section=page.locator('#world-classroom-lessons .ws-class');
  const state=()=>section.evaluate(el=>el.hidden?'closed':el.dataset.state);
  async function openProfile(){
   if(await page.evaluate(()=>document.querySelector('#world-panel')?.open))await page.locator('#panel-close').click();
   await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);
   await page.locator('.profile-control[data-view="me"]').click();await section.waitFor();
  }
  async function settle(name,before){
   for(let i=0;i<200&&classroomCalls.length<=before;i++)await new Promise(r=>setTimeout(r,25));
   assert.ok(classroomCalls.length>before,name+': 수업 요청이 나가지 않았다');
   await page.waitForFunction(expected=>document.querySelector('#world-classroom-lessons .ws-class')?.dataset.state===expected,SCENARIOS[name].state);
  }
  const measure=()=>page.evaluate(()=>{
   const el=document.querySelector('#world-classroom-lessons .ws-class'),content=document.querySelector('#panel-content'),box=el.getBoundingClientRect();
   const shown=node=>node.getClientRects().length>0;
   const overflowing=[...el.querySelectorAll('*')].filter(n=>shown(n)&&(n.getBoundingClientRect().right>box.right+.5||n.getBoundingClientRect().left<box.left-.5)).map(n=>n.className||n.tagName);
   const small=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){if(!/[가-힣]/.test(n.textContent)||!shown(n.parentElement))continue;const size=parseFloat(getComputedStyle(n.parentElement).fontSize);if(size<13)small.push({text:n.textContent.trim().slice(0,24),size});}
   const targets=[...el.querySelectorAll('a,button')].filter(shown).map(n=>({key:n.dataset.classroomKey,height:Math.round(n.getBoundingClientRect().height)}));
   const fonts=[...new Set([...el.querySelectorAll('*')].filter(shown).map(n=>getComputedStyle(n).fontSize))].sort();
   return {layout:document.documentElement.dataset.layout,innerWidth,docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,panelOverflow:content.scrollWidth-content.clientWidth,
    sectionWidth:Math.round(box.width),sectionHeight:Math.round(box.height),overflowing,small,shortTargets:targets.filter(x=>x.height<44),targets:targets.length,fonts};
  });
  // 칸 전체를 한 장으로: 시트(가로 판은 높이 720px까지)는 스크롤하므로 창 크기는 그대로 두고, 시트를 내려 가며 보이는 부분을 찍어
  // 칸 안 위치대로 이어 붙인다. 화면 배치·글자는 그 크기 그대로다.
  async function shoot(tag,name){
   await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(()=>{document.querySelector('#world-panel').style.scrollBehavior='auto';document.querySelector('#world-classroom-lessons .ws-class').scrollIntoView({block:'start'});});await page.waitForTimeout(120);
   const total=await section.evaluate(el=>Math.round(el.getBoundingClientRect().height)),parts=[];let covered=0;
   for(let i=0;i<20&&covered<total;i++){
    const g=await page.evaluate(()=>{const panel=document.querySelector('#world-panel'),r=document.querySelector('#world-classroom-lessons .ws-class').getBoundingClientRect(),p=panel.getBoundingClientRect();
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
  for(const {tag,size} of VIEWPORTS){
   await page.setViewportSize(size);await page.waitForTimeout(200);
   if(tag!=='390'){scenario='loading';hold=deferred();}
   const opened=classroomCalls.length;await openProfile();
   for(const name of ORDER){
    const before=classroomCalls.length;
    if(name==='loading'){
     scenario='loading';await settle(name,opened);
     assert.equal(await section.locator('.ws-class-status').isVisible(),true);assert.equal(await section.locator('.ws-class-body a').count(),0);
     measures[`${tag}-${name}`]=await measure();await shoot(tag,name);
     scenario='live';hold.resolve();await page.waitForFunction(()=>document.querySelector('#world-classroom-lessons .ws-class')?.dataset.state==='ready');continue;
    }
    scenario=name;await section.locator('[data-classroom-key="refresh"]').click();await settle(name,before);
    const view=await section.evaluate(el=>({
     live:[...el.querySelectorAll('.ws-class-live a.felt-button')].map(a=>({href:a.href,target:a.target,rel:a.rel,text:a.textContent})),
     groups:[...el.querySelectorAll('.ws-class-group')].map(g=>({group:g.dataset.group,heading:g.querySelector('h5').textContent,titles:[...g.querySelectorAll('.ws-class-title')].map(n=>n.textContent)})),
     replayLinks:[...el.querySelectorAll('[data-classroom-key^="replay:"]')].map(n=>({tag:n.tagName,href:n.getAttribute('href')})),
     text:el.innerText,lead:getComputedStyle(el.querySelector('.ws-class-lead')).display,note:getComputedStyle(el.querySelector('.ws-class-note')).display}));
    if(name==='live'){
     assert.deepEqual(view.live,[{href:watch('w3TueLive01'),target:'_blank',rel:'noopener noreferrer',text:'실시간 수업 보기'}]);
     assert.deepEqual(view.groups.map(g=>g.group),['attention','scheduled','replay']);
     assert.deepEqual(view.groups[1].titles,[T.w4tue,T.w4thu]);assert.deepEqual(view.groups[2].titles,[T.w3mon,T.w2thu,T.w2tue]);
     assert.match(view.text,/지금 수업 중 · 3월 23일 오후 07:30/);assert.match(view.text,/유튜브에서 영상이 안 보이나요\?/);assert.match(view.text,/화상 수업 참여/);
     assert.notEqual(view.lead,'none');assert.notEqual(view.note,'none');
    }
    if(name==='before'){assert.deepEqual(view.groups.map(g=>g.group),['scheduled']);assert.deepEqual(view.groups[0].titles,[T.w1tue,T.w1thu]);assert.equal(view.live.length,0);assert.match(view.text,/보기 버튼이 나타나요/);}
    if(name==='attention'){assert.deepEqual(view.groups.map(g=>g.group),['attention']);assert.equal(await section.locator('[data-classroom-key^="recheck:"]').count(),1);for(const word of ['방송 연결 확인 중','학생 계정 초대 준비 중','영상 연결 확인 중','영상 확인 중'])assert.ok(view.text.includes(word),word);}
    if(name==='replay'){assert.deepEqual(view.groups[0].titles,[T.w2thu,T.w2tue,T.w1thu,T.w1tue]);assert.equal(view.replayLinks.length,3);assert.ok(view.replayLinks.every(l=>l.tag==='A'));assert.equal(await section.locator('[data-classroom-key^="playlist:"]').getAttribute('href'),'https://www.youtube.com/playlist?list=PLsynkTopik4Class1');assert.doesNotMatch(view.text,/유튜브에서 영상이 안 보이나요/);}
    if(name==='no-sessions')assert.match(view.text,/첫 수업 영상이 준비되면 이곳에 보여요\./);
    if(name==='open-error'){
     assert.deepEqual(view.replayLinks,[{tag:'BUTTON',href:null}]);await section.locator('[data-classroom-key^="replay:"]').click();
     await section.locator('.ws-class-open').waitFor();assert.equal(await section.locator('.ws-class-open').textContent(),'링크를 열지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    }
    if(['empty','not-linked'].includes(name)){
     assert.match(view.text,/아직 연결된 수업이 없어요/);assert.equal(view.lead,'none');assert.equal(view.note,'none');
     assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot?.accountId),A,'반이 없는 계정의 401에도 로그인은 그대로다');
     assert.ok(await page.evaluate(()=>!!sessionStorage.getItem('synk.oauth.session.world')));
    }
    if(name==='error'){assert.match(view.text,/수업을 불러오지 못했어요\. 연결을 확인하고 다시 시도해 주세요\./);assert.equal(await section.locator('.ws-class-body').evaluate(el=>el.childElementCount),0);}
    measures[`${tag}-${name}`]=await measure();await shoot(tag,name);
    if(name==='error'){const retry=classroomCalls.length;scenario='live';await section.locator('[data-classroom-key="retry"]').click();await settle('live',retry);checks[`${tag}-retry-after-error`]=true;}
   }
   // 시트 맥락: 실시간 수업 칸을 시트 위쪽에 둔 그 크기 그대로의 화면 한 장
   scenario='live';const before=classroomCalls.length;await section.locator('[data-classroom-key="refresh"]').click();await settle('live',before);
   await section.evaluate(el=>el.scrollIntoView({block:'start'}));await page.waitForTimeout(150);const file=path.join(out,`${tag}-sheet.png`);await page.screenshot({path:file});shots.push(path.relative(out,file));
  }
  // 탭을 떠나면 옛 링크를 지우고, 돌아오면 다시 묻는다(학생 앱의 앱 복귀와 같은 뜻).
  await page.setViewportSize(VIEWPORTS[0].size);await openProfile();await page.waitForFunction(()=>document.querySelector('#world-classroom-lessons .ws-class')?.dataset.state==='ready');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await state(),'loading');assert.equal(await section.locator('.ws-class-body a').count(),0);
  const hidden=classroomCalls.length;
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'));Reflect.deleteProperty(document,'visibilityState');});
  await settle('live',hidden);checks.visibilityReturnRefetch=true;
  // 시트를 닫으면 칸과 주기 확인이 함께 끝난다.
  await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);assert.equal(await page.locator('.ws-class').count(),0);checks.closeDisposes=true;
  // 화면 모듈의 한 바퀴(30초 확인·같은 목록은 다시 그리지 않음·초점 유지·실패 시 링크 비움·겹친 확인 한 번·계정 바뀜·정리)를 가짜 시계로 본다.
  checks.module=await page.evaluate(async()=>{
   const m=await import('/world/classroom-lessons.mjs');const host=document.createElement('div');host.style.cssText='position:fixed;left:-3000px;top:0;width:360px';document.body.append(host);
   const data={classes:[{class_id:'k',display_name:'모듈 반',video_privacy:'unlisted',playlist_url:null,meeting_url:null,sessions:[{session_key:'r',title:'복습',starts_at:'2027-03-16T10:30:00.000Z',ends_at:null,status:'ready',watch_url:'https://www.youtube.com/watch?v=w2TueReplay'}]}],emptyReason:null};
   let tick=null,interval=null,cleared=false,loads=0,mode='ok',owner=true,pending=null;
   const timers={setInterval(fn,ms){tick=fn;interval=ms;return 7;},clearInterval(id){cleared=id===7;}};
   const settle=()=>new Promise(r=>setTimeout(r,0));const twice=async()=>{await settle();await settle();};
   const view=m.mountClassroomLessons({container:host,timers,guard:()=>{if(!owner)throw Object.assign(Error('바뀜'),{code:'ACCOUNT_CHANGED'});},
    load:async()=>{loads++;if(pending)await pending.promise;if(mode==='fail')throw Error('network');return structuredClone(data);}});
   await twice();const first=view.state(),link=host.querySelector('[data-classroom-key="replay:k:r"]');
   tick();await twice();const sameNode=host.contains(link);
   link.focus();data.classes[0].sessions[0].title='복습 · 고침';tick();await twice();
   const focusKept=document.activeElement?.dataset.classroomKey==='replay:k:r'&&document.activeElement!==link&&host.querySelector('.ws-class-title').textContent==='복습 · 고침';
   let resolve;pending={promise:new Promise(r=>resolve=r)};const beforeOverlap=loads;tick();tick();tick();await twice();const overlapping=loads-beforeOverlap;pending=null;resolve();await twice();
   mode='fail';tick();await twice();const failed={...view.state(),links:host.querySelectorAll('a').length,alert:!host.querySelector('.ws-class-alert').hidden};
   mode='ok';host.querySelector('[data-classroom-key="retry"]').click();await twice();const retried=view.state();
   owner=false;tick();await twice();const changed=view.state();const loadsAtChange=loads;tick();await twice();
   view.dispose();const removed=!host.querySelector('.ws-class');host.remove();
   return {interval,first,sameNode,focusKept,overlapping,failed,retried,changed,stoppedAfterChange:loads===loadsAtChange,cleared,removed};
  });
  assert.deepEqual(checks.module,{interval:30000,first:{phase:'ready',classes:1},sameNode:true,focusKept:true,overlapping:1,failed:{phase:'error',classes:0,links:0,alert:true},
   retried:{phase:'ready',classes:1},changed:{phase:'closed',classes:1},stoppedAfterChange:true,cleared:true,removed:true});
  // 요청 모양: 학생 앱 통로와 같은 GET · 계약판 c16 · 이 탭의 SYNK ID 토큰 · 공개 키, 쿼리·본문 머리 없음
  assert.ok(classroomCalls.length>=ORDER.length*2);
  for(const call of classroomCalls)assert.deepEqual({method:call.method,search:call.search,contract:call.contract,authorization:call.authorization,apikey:call.apikey,contentType:call.contentType},
   {method:'GET',search:'',contract:'c16',authorization:'Bearer synthetic-browser-token',apikey:'sb_publishable_browser_fixture',contentType:null});
  for(const [key,m] of Object.entries(measures)){
   assert.ok(m.docOverflow<=0&&m.panelOverflow<=0,`${key} 가로 넘침 ${m.docOverflow}/${m.panelOverflow}`);assert.deepEqual(m.overflowing,[],key+' 칸 밖으로 나간 요소');
   assert.deepEqual(m.small,[],key+' 13px 밑 한글');assert.deepEqual(m.shortTargets,[],key+' 44px 밑 단추');
   assert.equal(m.layout,key.startsWith('1280')?'landscape':'portrait',key);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(external,[]);assert.equal(fs.existsSync(path.join(directory,'must-not-create')),false);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,date:new Date().toISOString(),syntheticAccount:true,syntheticClassroom:true,liveProviderCalls:false,browser:'Edge headless (Playwright '+(()=>{try{return require('playwright/package.json').version;}catch{return '?';}})()+')',
   placement:'내 계정 시트 · 반 연결 카드 위(#world-classroom-lessons)',scenarios:ORDER,viewports:VIEWPORTS,checks,measures,shots,classroomRequests:classroomCalls.length,requestShape:classroomCalls[0],errors,unexpected,external},null,2)+'\n');
 }catch(error){
  if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
  console.error('CLASSROOM_BROWSER_FAILURE',error.stack,JSON.stringify({scenario,errors,unexpected,external,classroomCalls:classroomCalls.slice(-5),server:serverOutput.slice(-800)}));throw error;
 }finally{
  if(browser)await browser.close().catch(()=>{});server.kill('SIGKILL');fs.rmSync(directory,{recursive:true,force:true});
 }
});
