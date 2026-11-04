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
  browser=await playwright.chromium.launch({channel:process.platform==='win32'?'msedge':'chrome',headless:true,timeout:30000});
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
     const h=await req.allHeaders();calls.push({action:body?.action,contract:h['x-synk-contract'],product:h['x-synk-product'],authorization:Boolean(h.authorization)});
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
  const both=async(name,after=async()=>{})=>{for(const {tag,size} of VIEWPORTS){viewportTag=tag;await page.setViewportSize(size);await page.waitForTimeout(150);await check(name);await shoot(name);await after(tag);}viewportTag='390';await page.setViewportSize(VIEWPORTS[0].size);};
  const finish=async(scores)=>{await fx.tick();await fx.tick();await fx.scoreAll(scores);await fx.tick();};

  // ── 초대 전: 줄이 없다 ──
  await openProfile();await page.waitForTimeout(400);
  assert.equal(await page.locator('.me2-row').count(),0,'초대 전에는 줄이 없다');
  assert.ok(calls.some(c=>c.action==='status'),'status를 물었다');
  assert.ok(calls.every(c=>c.contract==='1'&&c.product==='world'&&c.authorization),'계약 · 제품 · 인증 머리표');

  // ── 초대 뒤: 줄 → 동의 ──
  await fx.db.query('insert into engine.me2_photo_invites(synk_user_id) values($1)',[A]);
  await openProfile();await page.locator('.me2-row').waitFor();
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

  // ── 학생증 · 옷장 · 추억 사진 ──
  await both('09-학생증');
  const menuScene=()=>page.locator('[data-me2="order-scene"]').first();
  const hanger=id=>page.locator(`.me2-hanger[data-item="${id}"]`);
  assert.equal(await hanger('acc-glasses').count(),0,'안경을 쓴다고 하면 안경 룩이 옷장에 없다');
  const allImages=()=>page.waitForFunction(()=>[...document.querySelectorAll('[data-me2-root] img')].every(img=>img.complete&&img.naturalWidth>0));
  await allImages();
  // 봉의 옷을 누르면 그것만 앞으로 나온다 → 닫으면 그 칸으로 돌아온다 → 다시 눌러 입어 본다
  await hanger('outfit-denim').click();await page.locator('.me2-closet-detail').waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.className),'me2-closet-close','열면 닫기로 키보드가 간다');
  assert.equal(await page.locator('.me2-closet-rows').getAttribute('inert'),'','뒤 줄은 누를 수 없다');
  await both('09-옷-앞으로');
  await page.locator('.me2-closet-close').click();await page.locator('.me2-closet-detail').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.item),'outfit-denim','닫으면 그 옷으로 돌아온다');
  await hanger('outfit-denim').click();
  await page.locator('[data-me2="order-look"]').click();
  await page.locator('.me2-hanger[data-state="shipping"]').waitFor();
  await page.locator('.me2-closet-close').click();
  await menuScene().click();await page.locator('.me2-card[data-state="shipping"]').waitFor();
  await both('10-배송중');
  await finish(()=>({score:.93,student:.86,taeo:.95}));
  await openMe2();await page.locator('.me2-card[data-state="arrived"]').first().waitFor();
  assert.ok(await page.locator('.me2-tag[data-tone="new"]').count()>=1,'도착 표시');
  await page.waitForFunction(()=>true);
  await both('11-도착');
  const seen=()=>calls.filter(c=>c.action==='seen').length;
  assert.ok(seen()>=1,'본 것을 알렸다');
  await hanger('outfit-denim').click();await page.locator('[data-me2="wear"]').click();await page.locator('.me2-closet-info .me2-tag[data-tone="on"]').waitFor();
  await page.locator('.me2-closet-close').click();
  assert.ok((await fx.db.query('select equipped_look from engine.me2_photo_profiles where synk_user_id=$1',[A])).rows[0].equipped_look,'입었다');
  await both('12-입는중');

  // ── 다른 사진으로: 고른 모습은 그대로, 줄 하나로 알린다 ──
  await page.locator('.me2-foot [data-me2="again"]').click();
  await page.locator('[data-me2-file]').first().waitFor({state:'attached'});
  await albumInput().setInputFiles(gradient);await page.locator('[data-me2="use"]').click();
  await page.locator('.me2-id').waitFor();
  await page.locator('.me2-note').first().waitFor();
  assert.match(await page.locator('.me2-note').first().textContent(),/현상 중/);
  await both('13-새사진-현상중');
  await finish(()=>({strong:.8,natural:.82,younger:.8}));
  await openMe2();await page.locator('.me2-variants').waitFor();
  await both('14-새사진-이게나');
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
  assert.equal(await page.locator('[data-me2="order-look"],[data-me2="order-scene"],.me2-foot [data-me2="again"]').count(),0,'쉬는 동안에는 새로 맡기지 않는다');
  // (기준을 바꾸며 옛 룩은 지웠다 — 그래서 여기서는 옷장 칸 자체가 없다.)
  assert.equal(await hanger('outfit-bomber').count(),0,'안 맡긴 옷은 쉬는 동안 안 보인다');
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
  tamper=()=>({ok:true,accountId:A,status:'not_invited'});
  await page.goto(url+'/world/?opening=off&me2=1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-me2-root] .me2-note').waitFor();
  assert.equal(await page.locator('[data-me2-file],[data-me2="agree"]').count(),0,'초대받지 않으면 동의 · 올리기가 없다');
  tamper=null;

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
