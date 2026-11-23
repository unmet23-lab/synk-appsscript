import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createLifeProgress} from '../life-progress.mjs';
import {SOON_TEXT,reserveHref} from '../world-learn-soon.mjs';
import {serverReady} from './server-ready.mjs';
// 배우기 · 놀이 「준비 중」 안내(유호님 11-24) 실제 브라우저 확인 — 계정 모드 WORLD(헤드리스 Edge)의 손님, 첫 실행을 마친 기기.
// 배우기 판의 팩 카드 · 지금 할 일 · 「더 보기」 줄(이야기 · 내 위치)과 놀이 판의 게임 카드 · 「더 둘러보기」를 누르면
// 레슨 · 게임 대신 안내 판(제목 · 2027년 2월 · 사전예약 단추 · 닫기)이 뜨고, 닫으면 같은 판과 누른 단추로 돌아온다. Esc · 바깥 누름도 닫는다.
// 390 · 1280 · 1440 × 한국어 · 영어 · 몽골어. 로컬 서버는 기본으로 안내를 꺼서 SYNK_WORLD_LEARN_SOON=1로 띄운다. 캡처와 result.json은 SYNK_LEARN_SOON_QA_OUT(기본 qa/world-learn-soon-20261124/)에 쓴다(그림은 git 밖).
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');if(!playwright.chromium)throw Error('no chromium');}catch{playwright=null;}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
const out=path.resolve(process.env.SYNK_LEARN_SOON_QA_OUT||path.join(root,'experiences/synk-world-app/qa/world-learn-soon-20261124'));
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',
 clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const CASES=[{lang:'mn',viewport:{width:390,height:844}},{lang:'ko',viewport:{width:390,height:844}},{lang:'en',viewport:{width:390,height:844}},{lang:'mn',viewport:{width:1280,height:800}},{lang:'ko',viewport:{width:1440,height:900}}];

// 첫 실행을 마친 손님 기기의 생활 진도: 한글 답과 튜터만 골라 두었다.
function seeded(){
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const life=createLifeProgress({storage,owner:'guest',now:()=>Date.parse('2026-11-24T01:00:00Z')});
 life.setHangulReading('reads',{via:'question'});life.selectTutor('mongle');
 return Object.fromEntries(values);
}

test('WORLD 배우기 · 놀이: 들어가는 단추는 「준비 중 · 2027년 2월」 안내를 띄우고, 닫으면 같은 판으로 (390 · 1280 · 1440 × 한국어 · 영어 · 몽골어)',{timeout:600000,skip:(!talkRoot&&'형제 저장소 SYNK-talk이 없다(SYNK_TALK_ROOT로 알려 준다)')||(!playwright&&'playwright가 없다')},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-learn-soon-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 fs.mkdirSync(out,{recursive:true});for(const name of fs.readdirSync(out))if(/\.png$/.test(name))fs.rmSync(path.join(out,name));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talkRoot,SYNK_WORLD_PORT:String(port),
  SYNK_WORLD_LEARN_SOON:'1',SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')}});
 let serverOutput='';server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 const url=`http://127.0.0.1:${port}`,errors=[],shots=[],checks={};
 let browser;
 t.signal.addEventListener('abort',()=>{server.kill('SIGKILL');},{once:true});
 try{
  await serverReady(url+'/world/health',{signal:t.signal,exited:()=>server.exitCode!==null,output:()=>serverOutput});
  browser=await playwright.chromium.launch({channel:process.platform==='win32'?'msedge':'chrome',headless:true,timeout:30000});
  for(const {lang,viewport} of CASES){
   const tag=`${viewport.width}-${lang}`,text=SOON_TEXT[lang],seen=checks[tag]={blocked:[]};
   const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});context.setDefaultTimeout(25000);
   await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort('blockedbyclient'));
   await context.addInitScript(({seed,lang})=>{if(window.top!==window||localStorage.getItem('qa.seeded'))return;for(const [k,v]of Object.entries(seed))localStorage.setItem(k,v);localStorage.setItem('synk.world.lang',lang);localStorage.setItem('qa.seeded','1');},{seed:seeded(),lang});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(`${tag}: ${e.message}`));
   // 첫 실행(언어 → 한글 질문 → 튜터)이 남아 있으면 지나가 입장까지(world-exam-link-browser.test.mjs와 같은 길).
   await page.goto(url+'/world/?opening=off',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>['ready','welcome'].includes(window.__synkWorld?.client.status));
   await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('[data-lang-picker]').count()){await page.locator(`[data-lang-choice="${lang}"]`).click();await page.locator('[data-lang-confirm]').click();}
   await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] [data-first-hangul="reads"]').count())await page.locator('dialog[open] [data-first-hangul="reads"]').click();
   await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(()=>{});}
   await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready'&&!document.querySelector('dialog[open] .tutor-option'));
   seen.lang=await page.evaluate(()=>document.documentElement.lang);assert.equal(seen.lang,lang,`${tag}: 화면 언어`);
   const soonOpen=()=>page.evaluate(()=>!!document.querySelector('dialog.learn-soon[open]'));
   const shoot=async name=>{await page.evaluate(()=>document.fonts.ready);const file=path.join(out,`${tag}-${name}.png`);await page.screenshot({path:file});shots.push(path.basename(file));};
   // 누르면 안내가 뜨고 판은 그대로다(레슨 · 게임 화면으로 바뀌지 않는다). 그다음 how(닫기 · Esc · 바깥)로 닫고 누른 단추로 초점이 돌아오는지 본다.
   async function pressAndClose(selector,name,{screen,how='button',shot=false}){
    const target=page.locator(selector).first();await target.scrollIntoViewIfNeeded();await target.evaluate(el=>el.setAttribute('data-qa-pressed',''));
    const before=await page.evaluate(()=>document.querySelector('#panel-title')?.textContent);
    await target.click({force:/data-locked/.test(selector)});await page.waitForSelector('dialog.learn-soon[open]');
    const state=await page.evaluate(({screen})=>{const box=document.querySelector('dialog.learn-soon[open]'),r=box.getBoundingClientRect(),reserve=box.querySelector('.learn-soon-reserve'),close=box.querySelector('.learn-soon-close'),focus=document.activeElement;
     return {title:box.querySelector('.learn-soon-title')?.textContent,lead:box.querySelector('.learn-soon-lead')?.textContent,reserve:reserve?.getAttribute('href')||null,reserveText:reserve?.textContent.replace('→','').trim()||null,close:close?.textContent,
      lang:box.querySelector('.learn-soon-sheet')?.lang,panelTitle:document.querySelector('#panel-title')?.textContent,screen:!!document.querySelector(`#panel-content ${screen}`),gameFrame:document.querySelectorAll('.game-frame').length,
      inView:r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,width:Math.round(r.width),buttons:[reserve,close].filter(Boolean).map(b=>Math.round(b.getBoundingClientRect().height)),
      overflow:box.scrollWidth-box.clientWidth,focus:focus?.className||focus?.tagName,art:box.querySelector('.learn-soon-art')?.complete&&box.querySelector('.learn-soon-art')?.naturalWidth>0};},{screen});
    if(shot)await shoot(name);
    if(how==='escape')await page.keyboard.press('Escape');
    else if(how==='outside')await page.mouse.click(4,4);
    else await page.locator('dialog.learn-soon [data-learn-soon-close]').click();
    await page.waitForFunction(()=>!document.querySelector('dialog.learn-soon[open]'));
    const after=await page.evaluate(()=>{const pressed=document.querySelector('[data-qa-pressed]'),value={panelTitle:document.querySelector('#panel-title')?.textContent,panelOpen:!!document.querySelector('#world-panel[open]'),refocused:!!pressed&&document.activeElement===pressed};pressed?.removeAttribute('data-qa-pressed');return value;});
    seen.blocked.push({name,how,...state,after});
    assert.equal(state.title,text.title,`${tag} ${name}: 제목`);assert.equal(state.lead,text.lead,`${tag} ${name}: 2027년 2월`);assert.equal(state.lang,lang,`${tag} ${name}: 글 언어`);
    assert.equal(state.reserve,reserveHref(lang),`${tag} ${name}: 사전예약 주소`);assert.equal(state.reserveText,text.reserve,`${tag} ${name}: 사전예약 단추`);assert.equal(state.close,text.close,`${tag} ${name}: 닫기`);
    assert.equal(state.panelTitle,before,`${tag} ${name}: 판은 그대로(레슨 · 게임으로 넘어가지 않음)`);assert.equal(state.screen,true,`${tag} ${name}: 배우기 · 놀이 판이 남아 있다`);assert.equal(state.gameFrame,0,`${tag} ${name}: 게임 틀 없음`);
    assert.equal(state.inView,true,`${tag} ${name}: 안내 판이 화면 안`);assert.equal(state.overflow,0,`${tag} ${name}: 가로 넘침 없음`);assert.ok(state.buttons.every(h=>h>=44),`${tag} ${name}: 단추 높이 ${state.buttons}`);
    assert.match(String(state.focus),/learn-soon-reserve/,`${tag} ${name}: 열면 초점이 사전예약 단추로`);assert.equal(state.art,true,`${tag} ${name}: 펠트 그림`);
    assert.equal(after.panelOpen,true,`${tag} ${name}: 닫아도 판은 열려 있다`);assert.equal(after.panelTitle,before,`${tag} ${name}: 닫은 뒤 같은 판`);assert.equal(after.refocused,true,`${tag} ${name}: 초점이 누른 단추로`);
   }
   // 배우기 판(아래 메뉴 「배우기」).
   await page.locator('nav [data-view="packs"]').click();
   await page.waitForSelector('#panel-content .life-hub .life-pack-card');
   seen.packs=await page.locator('#panel-content .life-pack-card').count();assert.equal(seen.packs,6,`${tag}: 팩 카드 여섯`);
   await shoot('learn');
   await pressAndClose('#panel-content .life-pack-card >> nth=2','pack-card',{screen:'.life-hub',shot:true});
   await pressAndClose('#panel-content .life-pack-card[data-current]','current-pack',{screen:'.life-hub',how:'escape'});
   await pressAndClose('#panel-content .life-now button','up-next',{screen:'.life-hub',how:'outside'});
   await pressAndClose('#panel-content .life-hub [data-life-stories]','stories-row',{screen:'.life-hub'});
   await pressAndClose('#panel-content .life-hub [data-view="position"]','position-row',{screen:'.life-hub'});
   // 놀이 판(아래 메뉴 「놀이」).
   await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel[open]'));
   await page.locator('nav [data-view="play"]').click();
   await page.waitForSelector('#panel-content .play-list [data-game]');
   seen.games=await page.locator('#panel-content .play-list [data-game]').count();assert.ok(seen.games>=3,`${tag}: 놀이 카드 ${seen.games}`);
   await shoot('play');
   await pressAndClose('#panel-content .play-list [data-game]:not([data-locked]) >> nth=0','game-open',{screen:'.play-list',shot:true});
   if(await page.locator('#panel-content .play-list [data-game][data-locked]').count())await pressAndClose('#panel-content .play-list [data-game][data-locked] >> nth=0','game-locked',{screen:'.play-list'});
   if(await page.locator('#panel-content .play-more [data-world]').count())await pressAndClose('#panel-content .play-more [data-world] >> nth=0','play-more',{screen:'.play-more'});
   // 판의 닫기와 아래 메뉴는 막지 않는다: 닫으면 우리 동네, 아래 메뉴 「배우기」는 안내 없이 배우기 판을 연다.
   await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel[open]'));
   await page.locator('nav [data-view="packs"]').click();await page.waitForSelector('#panel-content .life-hub');
   seen.navLearn={soon:await soonOpen(),hub:await page.evaluate(()=>!!document.querySelector('#world-panel[open] #panel-content .life-hub'))};
   assert.deepEqual(seen.navLearn,{soon:false,hub:true},`${tag}: 아래 메뉴는 그대로`);
   seen.docOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(seen.docOverflow<=0,`${tag}: 문서 가로 넘침 ${seen.docOverflow}`);
   await context.close();
  }
  assert.deepEqual(errors,[],'화면 오류 없음');
 }finally{
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,errors,shots},null,1));
  await browser?.close();server.kill();
 }
});
