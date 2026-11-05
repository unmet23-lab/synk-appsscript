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
import {serverReady} from './server-ready.mjs';
// 「제2의 나」 내 사진으로 만들기 — 계정 모드 WORLD(실제 Chromium/Edge) 화면을 talk의 실제 서버 코드(me2-photo-runtime · 원장 SQL PGlite)에 붙여 끝까지 눌러 본다.
// 공급사 · 저장소 · 얼굴 일꾼만 가짜다(talk tests/lib/me2-photo-fixture.js). 운영 계정 · 서버 · 돈 · 실제 사람 사진을 쓰지 않는다. 그림은 지어낸 대역뿐이고 바깥 주소는 막는다.
// 얼굴 찾기 시험에는 SYNK_ME2_QA_FACES(git 밖 지어낸 대역 폴더, up-*.png · base-*.png)가 든다. 없으면 「누가 나예요?」 단계만 건너뛴다.
// 캡처와 result.json은 SYNK_ME2_QA_OUT(기본 qa/me2-photo-20261104/)에 쓴다. 그림은 .gitignore 대상이다.
// SYNK_ME2_QA_LIVE=<후보 폴더>: 이 PC 서버 대신 실제 synk.im/world 위에 공개 후보를 끼워 돌린다(후보의 3방향 합침 · 바꿔 넣은 묶음이 지금 공개본과 맞물리는지). =live면 공개본 그대로. 계정 · 함수 응답은 똑같이 시험대다 — 운영 데이터를 건드리지 않는다.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'tests/lib/me2-photo-fixture.js')));
const out=path.resolve(process.env.SYNK_ME2_QA_OUT||path.join(root,'experiences/synk-world-app/qa/me2-photo-20261104'));
const facesDir=[process.env.SYNK_ME2_QA_FACES,path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'.tmp/me2-20261102/photo-low/판')].filter(Boolean).find(p=>fs.existsSync(p));
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const liveMode=process.env.SYNK_ME2_QA_LIVE||null,candidate=liveMode&&liveMode!=='live'?path.resolve(liveMode):null;
const LIVE_API='https://qiwxeddwwnzkwalpsuty.supabase.co';
const typeOf=file=>({'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.bin':'application/octet-stream'})[path.extname(file)]||'application/octet-stream';
const VIEWPORTS=[{tag:'390',size:{width:390,height:844}},{tag:'1440',size:{width:1440,height:900}}];
const pickFile=(prefix)=>{if(!facesDir)return null;const name=fs.readdirSync(facesDir).filter(n=>n.startsWith(prefix)).sort()[0];return name?path.join(facesDir,name):null;};

test('「제2의 나」 사진 화면: 초대 → 동의 → 고르기 → 누가 나예요? → 현상 → 이게 나? → 학생증 · 옷장 · 추억 사진 → 다른 사진 → 지우기 (390 · 1440)',{timeout:600000,skip:!talkRoot&&'me2-photo 시험대가 있는 talk 작업본이 없다(SYNK_TALK_ROOT로 지정)'},async t=>{
 const {setup,uuid}=require(path.join(talkRoot,'tests/lib/me2-photo-fixture.js'));
 const fx=await setup(t);
 const A=uuid(1),C='22222222-2222-4222-8222-222222222222';
 await fx.newStudent(1,{invite:false});
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-me2-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 fs.mkdirSync(out,{recursive:true});for(const name of fs.readdirSync(out))if(/\.png$/.test(name))fs.rmSync(path.join(out,name));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=liveMode?{kill(){},exitCode:null,stderr:{on(){}},stdout:{on(){}}}:spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talkRoot,SYNK_WORLD_PORT:String(port),
  SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')}});
 let serverOutput='';server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 const url=liveMode?'https://synk.im':`http://127.0.0.1:${port}`,origin=liveMode?LIVE_API:new URL(config.accountApiUrl).origin,calls=[],uploads=[],unexpected=[],errors=[],external=[],shots=[],measures={},consoleErrors=[];
 let browser,page,tamper=null,failNextUpload=false,viewportTag='390';
 t.after(()=>{server.kill('SIGKILL');});
 const playState=emptyPlayState(),played=new Map();let playRevision=0;
 // 그림 — 지어낸 대역이 있으면 그것, 없으면 작은 단색 PNG. 경로에 있는 낱말로 고른다.
 const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
 const artOf=target=>{
  const file=target.includes('strong')?pickFile('base-hijab-강_'):target.includes('natural')?pickFile('base-hijab-약_'):target.includes('younger')?pickFile('base-hijab-강플_'):pickFile('base-glasses-강_');
  return file?{body:fs.readFileSync(file),contentType:'image/png'}:{body:blank,contentType:'image/png'};
 };
 const cors={'Access-Control-Allow-Origin':'*'};
 try{
  if(!liveMode)await serverReady(url+'/world/health',{signal:t.signal,exited:()=>server.exitCode!==null,output:()=>serverOutput});
  // Linux CI의 가상 X 화면에는 실제 포인터가 있다. 터치 모드를 끄면 그 포인터로 돌아간다.
  const virtualDisplay=process.platform==='linux'&&process.env.SYNK_ME2_QA_X11==='1';
  if(virtualDisplay)assert.ok(process.env.DISPLAY,'사진 기기 전환 시험에는 Xvfb 화면이 필요하다');
  browser=await playwright.chromium.launch({channel:process.platform==='win32'?'msedge':'chrome',headless:!virtualDisplay,timeout:30000,
   ...(process.platform==='win32'?{}:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})});
  const context=await browser.newContext({viewport:VIEWPORTS[0].size,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});context.setDefaultTimeout(25000);
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
  if(candidate)await context.route(url+'/world/**',route=>{const rel=new URL(route.request().url()).pathname.replace(/^\//,''),file=path.join(candidate,rel.endsWith('/')?rel+'index.html':rel);if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,contentType:typeOf(file),body:fs.readFileSync(file),headers:{'Cache-Control':'no-store'}});return route.fallback();});
  await context.addInitScript(()=>{if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));});
  // 저장소(가짜) — 서명 주소의 올리기 · 읽기. 실제 저장소와 같게 교차 출처 사전 요청을 거친다.
  await context.route('https://storage.invalid/**',async route=>{
   const req=route.request(),target=new URL(req.url());
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...cors,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, PUT'}});return;}
   if(req.method()==='PUT'){
    if(failNextUpload){failNextUpload=false;await route.fulfill({status:500,headers:cors,body:'{}'});return;}
    const parts=target.pathname.split('/').filter(Boolean),bucket=parts[1],key=parts.slice(2).join('/'),bytes=req.postDataBuffer();
    fx.storage.put(bucket,decodeURIComponent(key),new Uint8Array(bytes));uploads.push({bucket,bytes:bytes.length,type:req.headers()['content-type'],upsert:req.headers()['x-upsert'],credentials:Boolean(req.headers().cookie)});
    await route.fulfill({status:200,contentType:'application/json',headers:cors,body:'{}'});return;
   }
   const art=artOf(target.pathname);await route.fulfill({status:200,contentType:art.contentType,headers:cors,body:art.body});
  });
  await context.route(origin+'/**',async route=>{
   const req=route.request(),target=new URL(req.url());let status=200,data={ok:true};
   try{
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...cors,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, POST, PUT'}});return;}
    const body=req.postDataJSON();
    if(target.pathname==='/functions/v1/me2-photo/api'){
     const h=await req.allHeaders();calls.push({action:body?.action,item:body?.item,contract:h['x-synk-contract'],product:h['x-synk-product'],authorization:Boolean(h.authorization)});
     const response=await fx.service(new Request('https://x.invalid/me2-photo/api',{method:'POST',headers:{'x-synk-contract':h['x-synk-contract']||'','x-synk-product':h['x-synk-product']||'','x-test-auth':A},body:JSON.stringify(body)}));
     status=response.status;data=await response.json();
     if(tamper&&body?.action==='status')data=tamper(data);
    }
    else if(target.pathname.endsWith('/synk-account'))data=body?{ok:true,refreshRevoked:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[{id:C,client:'world',current:true}],sessionId:C};
    else if(target.pathname.endsWith('/synk-play')){
     if(body?.id&&played.has(body.id))data=played.get(body.id);
     else{if(body?.action==='progress')for(const change of body.changes){if(change.value===null)delete playState.records[change.key];else playState.records[change.key]=change.value;}
      data={ok:true,scope:'synk-play',accountId:A,revision:body?++playRevision:playRevision,state:structuredClone(playState)};if(body?.id)played.set(body.id,data);}
    }
    else if(target.pathname.endsWith('/synk-world-v1/bootstrap'))data={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
    else if(target.pathname.endsWith('/synk-learning'))data={ok:true,revision:1,events:[],cursor:0,hasMore:false};
    else if(target.pathname.endsWith('/synk-personal')){status=403;data={ok:false,error:{code:'PRODUCT_FORBIDDEN'}};}
    else if(target.pathname==='/functions/v1/classroom')data={contract_ver:'c16',ok:true,classes:[],empty_reason:'NO_ACTIVE_CLASS_ACCESS',server_time:new Date().toISOString()};
    else if(target.pathname==='/functions/v1/synk-classroom/api/world/homework')data={ok:true,mode:'account-linked',accountId:A,classes:[],emptyReason:'NO_HOMEWORK_PLAN'};
    else if(target.pathname==='/functions/v1/synk-classroom/api/classes')data={ok:true,mode:'account-linked',classes:[],learnerId:null,staffId:null};
    else if(target.pathname.startsWith('/auth/v1/logout'))data={};
    else if(liveMode&&target.pathname.startsWith('/functions/v1/')&&!/me2/.test(target.pathname)){status=404;data={ok:false,error:{code:'NOT_IN_FIXTURE'}};}
    else{unexpected.push(target.pathname);status=404;data={ok:false,error:{code:'NOT_IN_FIXTURE'}};}
   }catch(error){unexpected.push('fixture-error '+target.pathname+' '+error.message);status=500;data={ok:false,error:{code:'FIXTURE_ERROR'}};}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:cors});
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.goto(url+'/world/?opening=off',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
  assert.equal(await page.evaluate(()=>window.__synkWorld.client.snapshot.accountId),A);
  await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('[data-lang-picker]').count()){await page.locator('[data-lang-choice="ko"]').click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
  await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}
  await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();}
  await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready'&&!document.querySelector('dialog[open] .tutor-option'));

  const closeSheet=async()=>{if(await page.evaluate(()=>document.querySelector('#world-panel')?.open))await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);};
  const openProfile=async()=>{await closeSheet();await page.locator('.profile-control[data-view="me"]').click();await page.locator('#panel-content .ws-me').waitFor();};
  const openMe2=async()=>{await openProfile();await page.locator('.me2-row').click();await page.locator('[data-me2-root]').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-me2-root] .me2-status'));};
  const measure=()=>page.evaluate(()=>{
   const el=document.querySelector('[data-me2-root]'),content=document.querySelector('#panel-content');
   const shown=node=>node.getClientRects().length>0;
   const small=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){if(!/[가-힣]/.test(n.textContent)||!shown(n.parentElement))continue;const size=parseFloat(getComputedStyle(n.parentElement).fontSize);if(size<13)small.push({text:n.textContent.trim().slice(0,20),size});}
   const box=el.getBoundingClientRect(),overflowing=[...el.querySelectorAll('*')].filter(n=>shown(n)&&!n.closest('.me2-rail')&&(n.getBoundingClientRect().right>box.right+4||n.getBoundingClientRect().left<box.left-4)).map(n=>String(n.className||n.tagName));
   const short=[...el.querySelectorAll('button,label.felt-button,label.plain-button,summary')].filter(shown).filter(n=>n.getBoundingClientRect().height<44).map(n=>({text:n.textContent.trim().slice(0,20),h:Math.round(n.getBoundingClientRect().height)}));
   return {docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,panelOverflow:content.scrollWidth-content.clientWidth,felt:[...el.querySelectorAll('.felt-button')].filter(shown).length,small,overflowing,short};
  });
  const check=async name=>{const value=await measure();measures[`${name}-${viewportTag}`]=value;
   assert.ok(value.docOverflow<=0,`${name}: 문서 가로 넘침 ${value.docOverflow}`);assert.ok(value.panelOverflow<=0,`${name}: 시트 가로 넘침 ${value.panelOverflow}`);
   assert.equal(value.small.length,0,`${name}: 13px 아래 한글 ${JSON.stringify(value.small)}`);assert.equal(value.overflowing.length,0,`${name}: 칸 밖으로 나감 ${JSON.stringify(value.overflowing)}`);
   assert.equal(value.short.length,0,`${name}: 44px 아래 단추 ${JSON.stringify(value.short)}`);assert.ok(value.felt<=1,`${name}: 흰 알약이 ${value.felt}개`);};
  // 시트 첫 화면 · 내린 화면을 같은 크기로 찍는다.
  const shoot=async name=>{
   await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('[data-me2-root] img')].every(img=>img.complete));
   const panel=page.locator('#world-panel');await panel.evaluate(el=>{el.style.scrollBehavior='auto';el.scrollTop=0;});await page.waitForTimeout(120);
   const file=`${name}-${viewportTag}.png`;await page.screenshot({path:path.join(out,file)});shots.push(file);
   const more=await panel.evaluate(el=>el.scrollHeight-el.clientHeight);
   if(more>40){await panel.evaluate(el=>{el.scrollTop=el.scrollHeight;});await page.waitForTimeout(120);const second=`${name}-${viewportTag}-아래.png`;await page.screenshot({path:path.join(out,second)});shots.push(second);await panel.evaluate(el=>{el.scrollTop=0;});}
  };
  // 휴대폰 폭 캡처는 터치 기기로 본다 — 고르기 화면의 단추가 기기에 따라 다르다((pointer:coarse)).
  const cdp=await context.newCDPSession(page);
  const touch=async on=>{
   await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:on,maxTouchPoints:on?5:1});
   await page.waitForFunction(enabled=>matchMedia(enabled?'(pointer:coarse)':'(hover:hover) and (pointer:fine)').matches,on);
  };
  const both=async(name,after=async()=>{})=>{for(const {tag,size} of VIEWPORTS){viewportTag=tag;await touch(tag==='390');await page.setViewportSize(size);await page.waitForTimeout(150);await check(name);await shoot(name);await after(tag);}viewportTag='390';await touch(false);await page.setViewportSize(VIEWPORTS[0].size);};
  const finish=async(scores)=>{await fx.tick();await fx.tick();await fx.scoreAll(scores);await fx.tick();};

  // ── 초대 전: 줄이 없다 ──
  await openProfile();await page.waitForTimeout(400);
  assert.equal(await page.locator('.me2-row').count(),0,'초대 전에는 줄이 없다');
  assert.ok(calls.some(c=>c.action==='status'),'status를 물었다');
  assert.ok(calls.every(c=>c.contract==='1'&&c.product==='world'&&c.authorization),'계약 · 제품 · 인증 머리표');

  // ── 초대 뒤: 줄 → 동의 ──
  await fx.db.query('insert into engine.me2_photo_invites(synk_user_id) values($1)',[A]);
  await openProfile();await page.locator('.me2-row').waitFor();
  assert.equal(await page.locator('.me2-row img').count(),0,'모습을 만들기 전에는 줄에 남의 얼굴을 넣지 않는다');
  assert.equal(await page.locator('.me2-row-blank').count(),1);
  for(const {tag,size} of VIEWPORTS){await page.setViewportSize(size);await page.waitForTimeout(150);await page.locator('.me2-row').scrollIntoViewIfNeeded();const file=`00-내정보-${tag}.png`;await page.screenshot({path:path.join(out,file)});shots.push(file);}
  await page.setViewportSize(VIEWPORTS[0].size);
  await openMe2();
  const agree=page.locator('[data-me2="agree"]');
  assert.equal(await agree.isDisabled(),true,'동의 전에는 못 넘어간다');
  await page.locator('.me2-more summary').click();
  await page.locator('[data-me2-check="agree"]').check();
  assert.equal(await page.locator('.me2-more').evaluate(el=>el.open),true,'칸을 눌러도 「자세히 보기」가 닫히지 않는다');
  assert.equal(await agree.isDisabled(),true);
  await page.locator('[data-me2-check="adult"]').check();
  assert.equal(await agree.isDisabled(),false);
  await page.locator('[data-me2="note"][data-key="glasses"]').click();
  assert.equal(await page.locator('[data-me2="note"][data-key="glasses"]').getAttribute('aria-pressed'),'true');
  await both('01-동의');
  await agree.click();
  await page.locator('[data-me2-file]').first().waitFor({state:'attached'});
  const consented=await fx.db.query('select consent_ver,adult_declared from engine.me2_photo_consents where synk_user_id=$1',[A]);
  assert.equal(consented.rows[0].adult_declared,true,'동의가 저장됐다');
  const noted=await fx.db.query('select notes from engine.me2_photo_profiles where synk_user_id=$1',[A]);
  assert.deepEqual(noted.rows[0].notes,{glasses:true},'알려 준 것이 저장됐다');
  await both('02-고르기');
  await touch(true);
  assert.ok(await page.locator('label.me2-on-touch').first().isVisible(),'휴대폰에는 「지금 찍기」가 있다');
  assert.equal(await page.locator('label.me2-on-pointer').isVisible(),false);
  await touch(false);
  assert.equal(await page.locator('label.me2-on-touch').first().isVisible(),false,'PC에는 같은 파일 창을 여는 단추를 둘 두지 않는다');
  assert.ok(await page.locator('label.me2-on-pointer').isVisible());

  // ── 얼굴이 안 보이는 사진: 막지 않는다 ──
  const albumInput=()=>page.locator('label.plain-button [data-me2-file]');
  const gradient=path.join(directory,'no-face.png');
  const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=900;c.height=1200;const g=c.getContext('2d');const f=g.createLinearGradient(0,0,0,1200);f.addColorStop(0,'#7a8fa6');f.addColorStop(1,'#d7c8b2');g.fillStyle=f;g.fillRect(0,0,900,1200);return c.toDataURL('image/png').split(',')[1];});
  fs.writeFileSync(gradient,Buffer.from(png,'base64'));
  await albumInput().setInputFiles(gradient);
  await page.locator('[data-me2="use"]').waitFor();
  assert.equal(await page.locator('[data-me2="use"]').textContent(),'그래도 이 사진으로');
  await both('03-얼굴못찾음');
  await page.locator('[data-me2="repick"]').click();
  await page.locator('[data-me2-file]').first().waitFor({state:'attached'});

  // ── 둘이 나온 사진: 누가 나예요? → 그 얼굴 둘레로 잘라 올린다 ──
  const faceA=pickFile('up-glasses'),faceB=pickFile('up-beard');
  if(faceA&&faceB){
   const two=path.join(directory,'two-faces.jpg');
   const b64=await page.evaluate(async([a,b])=>{const load=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src;});const [l,r]=await Promise.all([load(a),load(b)]);const c=document.createElement('canvas');c.width=1600;c.height=1000;const g=c.getContext('2d');g.fillStyle='#ccc';g.fillRect(0,0,1600,1000);g.drawImage(l,40,100,700,700*l.height/l.width);g.drawImage(r,860,100,700,700*r.height/r.width);return c.toDataURL('image/jpeg',.9).split(',')[1];},['data:image/png;base64,'+fs.readFileSync(faceA).toString('base64'),'data:image/png;base64,'+fs.readFileSync(faceB).toString('base64')]);
   fs.writeFileSync(two,Buffer.from(b64,'base64'));
   await albumInput().setInputFiles(two);
   await page.waitForFunction(()=>document.querySelector('[data-me2="who"]')||document.querySelector('[data-me2="use"]'),null,{timeout:60000});
   assert.ok(await page.locator('[data-me2="who"]').count()>=2,'얼굴이 둘 이상 잡혔다');
   await both('04-누가나예요');
   failNextUpload=true;
   await page.locator('[data-me2="who"]').first().click();
   await page.locator('[data-me2="send"]').waitFor();
   await both('05-보내기실패');
   await page.locator('[data-me2="send"]').click();
  }else{
   await albumInput().setInputFiles(gradient);await page.locator('[data-me2="use"]').click();
  }
  await page.locator('.me2-print.is-developing').waitFor();
  assert.ok(await page.locator('[data-me2="erase"]').count(),'현상 중에도 지울 수 있다');
  assert.equal(uploads.length,1,'한 번 올렸다');
  assert.equal(uploads[0].bucket,'me2-intake');assert.equal(uploads[0].type,'image/jpeg');assert.equal(uploads[0].upsert,'false');assert.equal(uploads[0].credentials,false,'저장소로 쿠키를 보내지 않는다');
  assert.ok(uploads[0].bytes<=3*1024*1024,'3MB 아래');
  const [{source_path:sourcePath,face_box:faceBox}]=(await fx.db.query("select source_path,face_box from engine.me2_photo_jobs where synk_user_id=$1 and kind='base'",[A])).rows;
  const sent=fx.storage.objects.get(`me2-intake/${sourcePath}`);
  assert.ok(sent&&sent[0]===0xff&&sent[1]===0xd8,'JPEG로 올렸다');
  const size=await page.evaluate(async b64=>{const b=await createImageBitmap(await (await fetch('data:image/jpeg;base64,'+b64)).blob());return [b.width,b.height];},Buffer.from(sent).toString('base64'));
  assert.ok(Math.max(...size)<=1200,`긴 변 1200 아래: ${size}`);
  assert.ok(!Buffer.from(sent).includes(Buffer.from('Exif')),'EXIF가 없다');
  if(faceA&&faceB)assert.ok(Array.isArray(faceBox)&&faceBox.length===4,`고른 얼굴 칸이 갔다: ${JSON.stringify(faceBox)}`);
  await both('06-현상중');
  assert.equal(await page.locator('.me2-print.is-developing .me2-print-face').evaluate(el=>getComputedStyle(el).animationName),'none','움직임 줄이기에서 인화지가 멈춘다');

  // ── 이게 나? — 살핌 등급은 강 · 약 나란히 ──
  await finish(()=>({strong:.55,natural:.62,younger:.5,agree:.5}));
  await openMe2();await page.locator('.me2-pair').waitFor();
  assert.ok(await page.locator('[data-me2="erase"]').count(),'고르기 전에도 지울 수 있다');
  assert.equal(await page.locator('.me2-pair .me2-print').count(),2);
  assert.equal(await page.locator('[data-me2="variant"][data-variant="younger"]').count(),1,'세 판 모두 고를 수 있다');
  assert.equal(await page.locator('[data-me2-root]').evaluate(el=>/\b0\.\d+|점수|탈락|등급/.test(el.textContent)),false,'점수 · 탈락이 보이지 않는다');
  await both('07-이게나-나란히');
  await page.locator('.me2-pair [data-variant="natural"]').click();
  assert.equal(await page.locator('.me2-variant[data-variant="natural"]').getAttribute('aria-pressed'),'true');
  await page.locator('.me2-print.me2-big').waitFor();
  await both('08-이게나-크게');
  await page.locator('[data-me2="choose"]').click();
  await page.locator('.me2-id').waitFor();
  const chosen=await fx.db.query('select chosen_variant from engine.me2_photo_profiles where synk_user_id=$1',[A]);
  assert.equal(chosen.rows[0].chosen_variant,'natural');

  // ── 학생증 · 옷장(옷 가게 입구 · 미용실 · 소품) · 추억 사진 ──
  await both('09-학생증');
  const menuScene=()=>page.locator('[data-me2="order-scene"]').first();
  const hanger=id=>page.locator(`.me2-hanger[data-item="${id}"]`);
  assert.equal(await hanger('acc-glasses').count(),0,'안경을 쓴다고 하면 안경 룩이 옷장에 없다');
  const allImages=()=>page.waitForFunction(()=>[...document.querySelectorAll('[data-me2-root] img')].every(img=>img.complete&&img.naturalWidth>0));
  await allImages();
  assert.equal(await page.locator('[data-me2-root] [data-me2="shop"]').count(),1,'옷장 맨 위에 옷 가게 입구');
  assert.equal(await hanger('outfit-denim').count(),0,'옷은 가게로 갔다 — 옛 옷 줄이 없다');
  // 머리 줄은 그대로 — 누르면 그것만 앞으로 나온다 → 닫으면 그 칸으로 돌아온다
  await hanger('hair-comma').click();await page.locator('.me2-closet-detail').waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.className),'me2-closet-close','열면 닫기로 키보드가 간다');
  assert.equal(await page.locator('.me2-closet-rows').getAttribute('inert'),'','뒤 줄은 누를 수 없다');
  await page.locator('.me2-closet-close').click();await page.locator('.me2-closet-detail').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.item),'hair-comma','닫으면 그 칸으로 돌아온다');

  // ── 옷 가게(11-05) — 시트 위에 뜨는 두 번째 대화 상자. 봉 · 자세히 · 앞뒤 · 팁 · 입어 보기 · 배송 조회 ──
  const SHOP='dialog.m2s-dialog[open]',SHOP_ORDER=['outfit-trench','outfit-cardigan','outfit-varsity','outfit-bomber','outfit-rugby','outfit-leather','outfit-denim','outfit-vest'];
  const shopHanger=id=>page.locator(`${SHOP} .m2s-hanger[data-i="${SHOP_ORDER.indexOf(id)}"]`);
  const openShop=async()=>{await page.locator('[data-me2-root] [data-me2="shop"]').click();await page.locator(`${SHOP} .m2s[data-ready="yes"]`).waitFor();await page.waitForFunction(sel=>[...document.querySelectorAll(sel+' img')].filter(img=>img.getAttribute('src')).every(img=>img.complete&&img.naturalWidth>0),SHOP);};
  const closeShop=async()=>{if(await page.locator(`${SHOP} .m2s-stage:not([hidden])`).count()){await page.keyboard.press('Escape');await page.locator(`${SHOP} .m2s-stage[hidden]`).waitFor({state:'attached'});}await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog.m2s-dialog'));};
  const shopMeasure=()=>page.evaluate(sel=>{
   const d=document.querySelector(sel);
   const seen=n=>{if(!n||!n.getClientRects().length||n.closest('[aria-hidden="true"],[hidden]'))return false;for(let x=n;x&&x!==d;x=x.parentElement){const cs=getComputedStyle(x);if(cs.visibility==='hidden'||Number(cs.opacity)===0||cs.display==='none')return false;}return true;};
   const small=[],walker=document.createTreeWalker(d,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){if(!/[가-힣]/.test(n.textContent)||!seen(n.parentElement))continue;const size=parseFloat(getComputedStyle(n.parentElement).fontSize);if(size<13)small.push({text:n.textContent.trim().slice(0,20),size});}
   const short=[...d.querySelectorAll('button')].filter(seen).filter(n=>!n.matches('.m2s-word,.m2s-pair,.m2s-hanger')).filter(n=>n.getBoundingClientRect().height<44).map(n=>({text:(n.textContent||n.getAttribute('aria-label')||'').trim().slice(0,20),h:Math.round(n.getBoundingClientRect().height)}));
   const vw=innerWidth,out=[...d.querySelectorAll('.m2s-info *,.m2s-top *,.m2s-caption *,.m2s-title *,.m2s-toast,.m2s-pack *')].filter(seen).filter(n=>{const r=n.getBoundingClientRect();return r.right>vw+2||r.left<-2;}).map(n=>String(n.className||n.tagName));
   // 단추가 화면 밖에 있으면 그 단추를 내려 볼 수 있는 칸이 있어야 한다(PC 자세히 글이 길어지면 단추가 갇혔다)
   const scroller=n=>{for(let x=n.parentElement;x&&x!==d.parentElement;x=x.parentElement){const cs=getComputedStyle(x);if(/(auto|scroll)/.test(cs.overflowY)&&x.scrollHeight>x.clientHeight+1)return x;}return null;};
   const stuck=[...d.querySelectorAll('.m2s-go,.m2s-quiet,.m2s-side button,.m2s-readko')].filter(seen).filter(n=>{const r=n.getBoundingClientRect();return (r.bottom>innerHeight+1||r.top<-1)&&!scroller(n);}).map(n=>n.textContent.trim().slice(0,20));
   return {docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,dialogOverflow:d.scrollWidth-d.clientWidth,small,short,out,stuck,modal:d.matches(':modal')&&document.querySelector('#world-panel').matches(':modal')};
  },SHOP);
  const shopBoth=async name=>{
   for(const {tag,size} of VIEWPORTS){
    viewportTag=tag;await touch(tag==='390');await page.setViewportSize(size);await page.waitForTimeout(260);
    const value=await shopMeasure();measures[`${name}-${tag}`]=value;
    assert.ok(value.modal,`${name}: 가게는 시트 위 겹 모달`);
    assert.ok(value.docOverflow<=0,`${name}: 문서 가로 넘침 ${value.docOverflow}`);assert.ok(value.dialogOverflow<=0,`${name}: 가게 가로 넘침 ${value.dialogOverflow}`);
    assert.equal(value.small.length,0,`${name}: 13px 아래 한글 ${JSON.stringify(value.small)}`);assert.equal(value.short.length,0,`${name}: 44px 아래 단추 ${JSON.stringify(value.short)}`);
    assert.equal(value.out.length,0,`${name}: 화면 밖으로 나감 ${JSON.stringify(value.out)}`);
    assert.equal(value.stuck.length,0,`${name}: 닿을 수 없는 단추 ${JSON.stringify(value.stuck)}`);
    await page.evaluate(()=>document.fonts.ready);const file=`${name}-${tag}.png`;await page.screenshot({path:path.join(out,file)});shots.push(file);
    const stage=page.locator(`${SHOP} .m2s-stage:not([hidden])`);
    if(await stage.count()){const more=await stage.evaluate(el=>el.scrollHeight-el.clientHeight);if(more>40){await stage.evaluate(el=>{el.scrollTop=el.scrollHeight;});await page.waitForTimeout(150);const second=`${name}-${tag}-아래.png`;await page.screenshot({path:path.join(out,second)});shots.push(second);await stage.evaluate(el=>{el.scrollTop=0;});}}
   }
   viewportTag='390';await touch(false);await page.setViewportSize(VIEWPORTS[0].size);await page.waitForTimeout(200);
  };
  await openShop();
  assert.equal(await page.locator(`${SHOP} .m2s-hanger`).count(),8,'옷 여덟 벌');
  // 가게는 시트 위 겹 모달 — 화면 가운데를 누르면 가게가 받고, 시트 단추는 눌리지 않는다(앞 단언은 늘 참이었다, 검수 D2)
  assert.equal(await page.evaluate(sel=>{const d=document.querySelector(sel),hit=document.elementFromPoint(innerWidth/2,innerHeight/2);return d.contains(hit)&&!document.querySelector('#world-panel').contains(hit);},SHOP),true,'가게가 시트를 덮는다');
  assert.equal(await page.locator(`${SHOP} :text("원")`).count(),0,'값은 없다');
  await shopBoth('09-가게');
  await shopHanger('outfit-denim').click();await page.locator(`${SHOP} .m2s-stage:not([hidden])`).waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.className),'m2s-close','열면 닫기로 키보드가 간다');
  await page.waitForFunction(sel=>getComputedStyle(document.querySelector(sel+' .m2s-box')).visibility==='hidden',SHOP); // 자세히에서 안 보이는 「내 옷장」이 Tab에 잡히지 않는다
  assert.equal(await page.locator(`${SHOP} .m2s-floor`).getAttribute('inert'),'','자세히 · 포장 동안 뒤의 봉은 Tab에 잡히지 않는다');
  assert.match(await page.locator(`${SHOP} .m2s-name`).textContent(),/연청 데님 재킷/);
  await page.locator(`${SHOP} .m2s-side [data-side="back"]`).click();
  assert.equal(await page.locator(`${SHOP} .m2s-side [data-side="back"]`).getAttribute('aria-checked'),'true','뒤로 돌린다');
  await page.locator(`${SHOP} .m2s-word`).first().click();
  await page.locator(`${SHOP} .m2s-word-gloss.is-open`).waitFor();
  assert.match(await page.locator(`${SHOP} .m2s-word-gloss`).textContent(),/청재킷과 청바지/);
  await page.keyboard.press('ArrowRight');await page.waitForFunction(sel=>/니트 조끼와 셔츠/.test(document.querySelector(sel+' .m2s-name')?.textContent||''),SHOP);
  await page.keyboard.press('ArrowLeft');await page.waitForFunction(sel=>/연청 데님 재킷/.test(document.querySelector(sel+' .m2s-name')?.textContent||''),SHOP);
  await shopBoth('09-가게-자세히');
  // 입어 보기 — 움직임 줄이기에서는 포장 없이 바로 주문 → 봉으로, 「배송 중」 택
  await page.locator(`${SHOP} [data-act="order"]`).click();
  await page.locator(`${SHOP} .m2s-stage[hidden]`).waitFor({state:'attached'});
  await shopHanger('outfit-denim').locator('.m2s-tag[data-state="shipping"]').waitFor();
  assert.match(await page.locator(`${SHOP} .m2s-toast`).textContent(),/출발했어요/);
  assert.ok(calls.some(c=>c.action==='order-look'&&c.item==='outfit-denim'),'주문을 보냈다');
  // 움직임을 켜면 포장 여섯 단계 — 처음 한 번은 「옷걸이에서 내리는 중」부터, 누르면 건너뛴다
  await page.emulateMedia({reducedMotion:'no-preference'});
  await shopHanger('outfit-cardigan').click();await page.locator(`${SHOP} .m2s-stage:not([hidden])`).waitFor();
  await page.locator(`${SHOP} [data-act="order"]`).click();
  await page.locator(`${SHOP} .m2s-pack:not([hidden])`).waitFor();
  assert.match(await page.locator(`${SHOP} .m2s-pack-text`).textContent(),/옷걸이에서 조심히 내리는 중/);
  await page.waitForTimeout(900);
  await page.locator(`${SHOP} .m2s-stage`).click({position:{x:20,y:200}});
  await shopHanger('outfit-cardigan').locator('.m2s-tag[data-state="shipping"]').waitFor({timeout:15000});
  assert.equal(await page.locator(`${SHOP} .m2s-pack`).isHidden(),true,'포장이 끝나면 문구를 치운다');
  await page.emulateMedia({reducedMotion:'reduce'});
  // 배송 조회 — 서버가 아는 때만
  await shopHanger('outfit-denim').click();await page.locator(`${SHOP} .m2s-track:not([hidden])`).waitFor();
  assert.match(await page.locator(`${SHOP} .m2s-track`).textContent(),/주문 받음/);
  assert.match(await page.locator(`${SHOP} .m2s-track`).textContent(),/곧 사진관에 보내요|사진관에 보냄/);
  assert.equal(await page.locator(`${SHOP} [data-act="order"]`).count(),0,'배송 중에는 다시 주문하지 않는다');
  await shopBoth('10-가게-배송조회');
  await closeShop();
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.me2),'shop','닫으면 가게 입구로 돌아온다');
  assert.match(await page.locator('[data-me2-root] .me2-door-mine').textContent(),/배송 중 2/);
  await menuScene().click();await page.locator('.me2-card[data-state="shipping"]').waitFor();
  await both('10-배송중');
  await finish(()=>({score:.93,student:.86,taeo:.95}));
  await openMe2();await page.locator('.me2-card[data-state="arrived"]').first().waitFor();
  assert.ok(await page.locator('.me2-tag[data-tone="new"]').count()>=1,'도착 표시');
  await both('11-도착');
  const seen=()=>calls.filter(c=>c.action==='seen').length;
  assert.ok(seen()>=1,'본 것을 알렸다');
  // 도착한 옷 — 봉 고리의 폴라로이드(「도착」) → 입은 나(인화지 · 손글씨) → 갈아입기
  await openShop();
  await shopHanger('outfit-denim').locator('.m2s-print-tag').waitFor();
  assert.ok(await shopHanger('outfit-denim').locator('.m2s-new').count(),'시트가 먼저 본 표시를 보내도 가게에서는 「도착」');
  await shopHanger('outfit-denim').click();await page.locator(`${SHOP} .m2s-stage:not([hidden])`).waitFor();
  await page.locator(`${SHOP} .m2s-side [data-side="worn"]`).click();
  assert.equal(await page.locator(`${SHOP} .m2s-turn-wrap`).getAttribute('data-view'),'worn');
  assert.match(await page.locator(`${SHOP} .m2s-print figcaption`).textContent(),/\d+월 \d+일, 학생 식당에서/);
  assert.ok((await page.locator(`${SHOP} .m2s-print img`).getAttribute('alt')).startsWith('이 옷을 입은 내 사진'));
  // 입은 나는 베일이 따뜻해진다 — 휴대폰 머리 줄 · 붙은 단추 줄도 같은 색(따로 두면 단추 줄만 회백으로 떴다)
  assert.deepEqual(await page.evaluate(sel=>{const d=document.querySelector(sel),c=el=>getComputedStyle(el);return {top:c(d.querySelector('.m2s-top')).backgroundColor,bar:/rgb\(247, 243, 234\)\s*(18|46)px/.test(c(d.querySelector('.m2s-actions')).backgroundImage),sheet:c(d.querySelector('.m2s')).getPropertyValue('--sheet').trim()};},SHOP),{top:'rgb(247, 243, 234)',bar:true,sheet:'#F7F3EA'},'입은 나의 머리 줄 · 단추 줄 바탕이 베일과 같다');
  await shopBoth('11-가게-입은나');
  const langLib=liveMode?'/world/brand-opening/world-lang.mjs':'/brand-opening/world-lang.mjs'; // 공개본은 /world/ 아래
  // 말 바꾸기 — 가게가 열린 채로 글을 다시 쓴다(몽골어 · 영어: 학생 언어 이름 줄 · 「한국어로 읽기」 · 긴 낱말이 넘치지 않는지)
  for(const code of ['mn','en']){
   await page.evaluate(async ([code,lib])=>{const m=await import(lib);m.setLang(code,{save:false});},[code,langLib]);
   await page.waitForFunction(([sel,code])=>document.querySelector(sel+' .m2s')?.getAttribute('lang')===code,[SHOP,code]);
   await page.locator(`${SHOP} .m2s-stage:not([hidden])`).waitFor();
   assert.ok((await page.locator(`${SHOP} .m2s-name-tr`).textContent()).trim(),`${code}: 학생 언어 이름 줄`);
   assert.match(await page.locator(`${SHOP} .m2s-name`).textContent(),/연청 데님 재킷/,`${code}: 큰 이름은 한국어`);
   await page.locator(`${SHOP} .m2s-readko`).click();await page.locator(`${SHOP} .m2s-story-ko:not([hidden])`).waitFor();
   assert.ok(await page.locator(`${SHOP} .m2s-tip-tr`).count(),`${code}: 팁 문장 뜻 줄`);
   await shopBoth(`11-가게-${code}`);
  }
  await page.evaluate(async lib=>{const m=await import(lib);m.setLang('ko',{save:false});},langLib);
  await page.waitForFunction(sel=>document.querySelector(sel+' .m2s')?.getAttribute('lang')==='ko',SHOP);
  await page.locator(`${SHOP} .m2s-stage:not([hidden])`).waitFor();
  await page.locator(`${SHOP} [data-act="wear"]`).click();await page.locator(`${SHOP} [data-act="unwear"]`).waitFor();
  assert.match(await page.locator(`${SHOP} .m2s-toast`).textContent(),/갈아입었어요/);
  await closeShop();
  assert.ok((await fx.db.query('select equipped_look from engine.me2_photo_profiles where synk_user_id=$1',[A])).rows[0].equipped_look,'입었다');
  await both('12-입는중');

  // ── 다른 사진으로: 고른 모습은 그대로, 줄 하나로 알린다 ──
  await page.locator('.me2-foot [data-me2="again"]').click();
  await page.locator('[data-me2-file]').first().waitFor({state:'attached'});
  assert.equal(await page.locator('[data-me2="prepared"]').count(),0,'모습이 있으면 「사진 없이」를 권하지 않는다');
  await page.locator('[data-me2="back"]').click();await page.locator('.me2-id').waitFor();
  await page.locator('.me2-foot [data-me2="again"]').click();
  await page.locator('[data-me2-file]').first().waitFor({state:'attached'});
  await albumInput().setInputFiles(gradient);await page.locator('[data-me2="use"]').click();
  await page.locator('.me2-id').waitFor();
  await page.locator('.me2-note').first().waitFor();
  assert.match(await page.locator('.me2-note').first().textContent(),/현상 중/);
  assert.ok(await page.locator('[data-me2="erase"]').count(),'현상 중에도 지울 수 있다');
  await both('13-새사진-현상중');
  await finish(()=>({strong:.8,natural:.82,younger:.8}));
  await openMe2();await page.locator('.me2-variants').waitFor();
  await both('14-새사진-이게나');
  // 새 판이 마음에 안 들면 지금 모습을 그대로 둔다 — 옷장은 그대로이고 새 판만 지운다.
  await page.locator('[data-me2="keep"]').click();await page.locator('.me2-id').waitFor();
  assert.ok((await fx.db.query("select count(*)::int as n from engine.me2_photo_jobs where synk_user_id=$1 and kind='look' and status='done'",[A])).rows[0].n>=1,'옷장은 그대로다');
  assert.equal((await fx.db.query("select count(*)::int as n from engine.me2_photo_jobs where synk_user_id=$1 and kind='base'",[A])).rows[0].n,1,'고르지 않은 새 판을 지운다');
  // 한 번 더 — 이번에는 새 모습으로 간다.
  await page.locator('.me2-foot [data-me2="again"]').click();
  await page.locator('[data-me2-file]').first().waitFor({state:'attached'});
  await albumInput().setInputFiles(gradient);await page.locator('[data-me2="use"]').click();
  await page.locator('.me2-id').waitFor();
  await finish(()=>({strong:.8,natural:.82,younger:.8}));
  await openMe2();await page.locator('.me2-variants').waitFor();
  await page.locator('[data-me2="choose"]').click();await page.locator('.me2-id').waitFor();

  // ── 세 판 다시 보기 → 돌아가기 ──
  await page.locator('[data-me2="review"]').click();await page.locator('.me2-variants').waitFor();
  await page.locator('[data-me2="back"]').click();await page.locator('.me2-id').waitFor();

  // ── 사진관이 붐빌 때 · 쉴 때(주기 몫이 찼을 때 · 끈 때) ──
  tamper=data=>({...data,me:{...data.me,state:'none',newer:null},capacity:{open:false,reopens_at:'2026-12-08T00:00:00+09:00'}});
  await openMe2();await page.locator('.me2-note').waitFor();
  assert.match(await page.locator('.me2-note').textContent(),/붐벼요/);
  assert.equal(await page.locator('[data-me2-file]').count(),0,'붐비면 올리는 칸이 없다');
  await both('15-붐빔');
  tamper=data=>({...data,status:'off'});
  await openMe2();await page.locator('.me2-note').waitFor();
  assert.match(await page.locator('.me2-note').first().textContent(),/쉬고/);
  assert.equal(await page.locator('[data-me2="order-look"],[data-me2="order-scene"],[data-me2="redo"],.me2-foot [data-me2="again"]').count(),0,'쉬는 동안에는 새로 맡기지 않는다');
  // (기준을 바꾸며 옛 룩은 지웠다.) 가게 입구는 쉬는 동안에도 열린다 — 설명은 읽히고 입어 보기 자리에 쉬는 안내.
  assert.equal(await hanger('outfit-bomber').count(),0,'안 맡긴 옷은 쉬는 동안 옷장 줄에 없다');
  await openShop();await shopHanger('outfit-bomber').click();await page.locator(`${SHOP} .m2s-stage:not([hidden])`).waitFor();
  assert.equal(await page.locator(`${SHOP} [data-act="order"]`).count(),0,'쉬는 동안에는 입어 보기가 없다');
  assert.match(await page.locator(`${SHOP} .m2s-actions`).textContent(),/쉬고/);
  await shopBoth('16-가게-쉼');
  await closeShop();
  assert.ok(await page.locator('[data-me2="erase"]').count(),'쉬는 동안에도 지울 수 있다');
  await both('16-쉼');
  tamper=null;

  // ── 지우기 ──
  await openMe2();await page.locator('.me2-id').waitFor();
  await page.locator('[data-me2="erase"]').click();await page.locator('.me2-erase').waitFor();
  await both('17-지우기');
  await page.locator('[data-me2="erase-no"]').click();await page.locator('[data-me2="erase"]').waitFor();
  await page.locator('[data-me2="erase"]').click();await page.locator('[data-me2="erase-yes"]').click();
  await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);
  const after=await fx.call(A,{action:'status'});
  assert.equal(after.me.state,'none','지운 뒤에는 모습이 없다');assert.equal(after.consent.given,false,'동의도 거둔다');

  // ── 바로 가는 주소 ──
  await page.goto(url+'/world/?opening=off&me2=1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-me2-root]').waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-me2-root] .me2-status'));
  assert.ok(await page.locator('[data-me2="agree"]').count(),'지운 뒤에는 동의부터 다시');
  tamper=data=>({...data,status:'off'});
  await page.goto(url+'/world/?opening=off&me2=1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-me2-root] .me2-note').waitFor();
  assert.equal(await page.locator('[data-me2="agree"]').count(),0,'꺼져 있으면 동의 안 한 사람에게 동의 화면을 열지 않는다');
  tamper=()=>({ok:true,accountId:A,status:'not_invited'});
  await page.goto(url+'/world/?opening=off&me2=1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-me2-root] .me2-note').waitFor();
  assert.equal(await page.locator('[data-me2-file],[data-me2="agree"]').count(),0,'초대받지 않으면 동의 · 올리기가 없다');
  tamper=null;

  // ── 초대 링크가 로그인을 거쳐 돌아오면 쿼리가 없다 — 남겨 둔 표시로 한 번 연다. 오래된 표시로는 열지 않는다. ──
  await page.evaluate(()=>sessionStorage.setItem('synk.world.me2.pending',String(Date.now())));
  await page.goto(url+'/world/?opening=off',{waitUntil:'domcontentloaded'});
  await page.locator('[data-me2-root]').waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('synk.world.me2.pending')),null,'한 번 열면 표시를 지운다');
  // 로그인이 풀리면 내 모습 시트도 닫는다(사진이 보이는 채 남지 않는다).
  assert.equal(await page.evaluate(()=>window.__synkWorld.screen()),'world-me2');
  await page.evaluate(()=>window.__synkWorld.client.invalidate());
  await page.waitForFunction(()=>window.__synkWorld.screen()!=='world-me2');
  await page.evaluate(()=>sessionStorage.setItem('synk.world.me2.pending',String(Date.now()-31*60000)));
  await page.goto(url+'/world/?opening=off',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready'&&document.querySelector('.world-shell')?.dataset.entry==='ready');
  assert.equal(await page.locator('[data-me2-root]').count(),0,'오래된 표시로는 열지 않는다');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('synk.world.me2.pending')),null);

  // ── 영어 · 몽골어: 화면과 동의 글에 한글이 없다(학습 내용이 아니라 기능 글이다) ──
  const switchLang=value=>page.evaluate(async language=>{const u=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('world-lang.mjs'));const m=await import(u);m.setLang(language,{save:false});},value);
  for(const language of ['en','mn']){
   await page.goto(url+'/world/?opening=off&me2=1',{waitUntil:'domcontentloaded'});
   await page.locator('[data-me2-root]').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-me2-root] .me2-status'));
   await page.locator('[data-me2="agree"]').waitFor();
   await switchLang(language);
   await page.locator('.me2-more summary').click();
   const shown=await page.locator('[data-me2-root]').evaluate(el=>el.innerText);
   assert.equal(/[가-힣]/.test(shown),false,`${language} 동의 화면에 한글: ${shown.match(/.{0,20}[가-힣].{0,20}/)?.[0]}`);
   await both(`18-${language}-동의`);
   tamper=data=>({...data,consent:{...data.consent,given:true},me:{...data.me,state:'none',newer:null}});
   await page.goto(url+'/world/?opening=off&me2=1',{waitUntil:'domcontentloaded'});
   await page.locator('[data-me2-root] [data-me2-file]').first().waitFor({state:'attached'});
   await switchLang(language);
   await page.waitForFunction(()=>!/[가-힣]/.test(document.querySelector('[data-me2-root]')?.innerText||'가'));
   await both(`19-${language}-고르기`);
   tamper=null;
   await switchLang('ko');
  }

  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,shots,measures,actions:calls.map(c=>c.action),uploads,faceBox},null,1));
  assert.deepEqual(unexpected,[],'시험대 밖 요청');
  assert.deepEqual(errors,[],'페이지 오류');
  assert.deepEqual(external.filter(u=>!/fonts\.|gstatic|example\.test/.test(u)),[],'바깥 주소');
 }catch(error){
  console.error('사진 시험 브라우저 오류',JSON.stringify(consoleErrors.slice(-10)));
  // 실패 때 무엇이 오갔는지 남긴다(qa/*-failure.json은 .gitignore 대상).
  fs.writeFileSync(path.join(root,'experiences/synk-world-app/qa/me2-photo-failure.json'),JSON.stringify({error:String(error?.stack||error).slice(0,1500),calls,uploads,unexpected,errors,consoleErrors,external,shots,measures,panel:await page?.evaluate(()=>document.querySelector('#panel-content')?.textContent?.slice(0,800)).catch(()=>null)},null,1));
  await page?.screenshot({path:path.join(out,'실패.png')}).catch(()=>{});
  throw error;
 }finally{
  await browser?.close().catch(()=>{});
  server.kill('SIGKILL');
  fs.rmSync(directory,{recursive:true,force:true});
 }
});
