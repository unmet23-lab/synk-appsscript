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
// WORLD ?exam= 바로가기(10-22, 메일·신청 페이지의 무료 연습 링크) 실제 브라우저 확인 — 계정 모드 WORLD(헤드리스 Edge)의 손님:
// A. 처음 온 기기에서 /world/?exam=topik2&lang=mn(375): 언어 고르기(몽골어가 미리 눌림) → 한글 질문 → 튜터 → TOPIK II를 채운 학습 목표 창
//    (열기만으로는 저장 안 됨) → 스위치 없이 누르면 안내만 → 「이 기기에 저장」을 켜고 저장 → 이번 주 계획.
// B. 같은 기기에서 같은 주소를 다시 열면 목표 창 없이 이번 주 계획. C. 「아직 못 읽어요」를 고른 기기, D. 주소 값이 없는 기기는 목표 창을 열지 않는다.
// E. 한국어 1280 첫 실행도 같은 창. 운영 계정·서버를 쓰지 않는다(손님 = 이 기기 기록, 바깥 주소는 막는다).
// 캡처와 result.json은 SYNK_EXAM_LINK_QA_OUT(기본 qa/world-exam-link-20261022/)에 쓴다(그림은 git 밖).
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');if(!playwright.chromium)throw Error('no chromium');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
const out=path.resolve(process.env.SYNK_EXAM_LINK_QA_OUT||path.join(root,'experiences/synk-world-app/qa/world-exam-link-20261022'));
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',
 clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const VIEWPORTS={phone:{width:375,height:812},desk:{width:1280,height:800}};

// 첫 실행을 마친 손님 기기의 생활 진도(실제 createLifeProgress로 만든 값): 한글 답과 튜터만 골라 두었다.
function seeded({reading='reads'}={}){
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const life=createLifeProgress({storage,owner:'guest',now:()=>Date.parse('2026-10-22T01:00:00Z')});
 life.setHangulReading(reading,{via:'question'});life.selectTutor('mongle');
 return Object.fromEntries(values);
}

test('WORLD ?exam=topik2: 첫 실행 뒤 TOPIK II를 채운 목표 창 → 켜고 저장 → 이번 주 계획, 다시 열면 계획, 한글 단계·주소 없음은 그대로 (375 몽골어 · 1280 한국어)',{timeout:600000,skip:!talkRoot&&'형제 저장소 SYNK-talk이 없다(SYNK_TALK_ROOT로 알려 준다)'},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-exam-link-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 fs.mkdirSync(out,{recursive:true});for(const name of fs.readdirSync(out))if(/\.png$/.test(name))fs.rmSync(path.join(out,name));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talkRoot,SYNK_WORLD_PORT:String(port),
  SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')}});
 let serverOutput='';server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 const url=`http://127.0.0.1:${port}`,errors=[],external=[],shots=[],measures={},checks={};
 let browser;
 t.signal.addEventListener('abort',()=>{server.kill('SIGKILL');},{once:true});
 try{
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(serverOutput);try{const r=await fetch(url+'/world/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await playwright.chromium.launch({channel:'msedge',headless:true,timeout:30000});
  // 기기 하나. seed가 있으면 첫 실행을 마친 생활 진도와 화면 언어를 심는다. 목표 창이 한 번이라도 뜨면 window.__qaGoalSeen에 남는다.
  async function device({seed=null,lang=null,viewport=VIEWPORTS.phone}={}){
   const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});context.setDefaultTimeout(25000);
   await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
   await context.addInitScript(({seed,lang})=>{
    if(window.top!==window)return;
    if(seed&&!localStorage.getItem('qa.seeded')){for(const [k,v]of Object.entries(seed))localStorage.setItem(k,v);if(lang)localStorage.setItem('synk.world.lang',lang);localStorage.setItem('qa.seeded','1');}
    window.__qaGoalSeen=0;
    new MutationObserver(()=>{if(document.querySelector('#world-study-form'))window.__qaGoalSeen++;}).observe(document,{childList:true,subtree:true});
   },{seed,lang});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   return {context,page};
  }
  // 첫 실행(언어 → 한글 질문 → 튜터)이 남아 있으면 지나가 입장까지. pick: 언어 고르기에서 누를 언어(없으면 미리 눌린 그대로).
  async function enter(page,query,{pick=null}={}){
   await page.goto(url+'/world/?opening=off'+query,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>['ready','welcome'].includes(window.__synkWorld?.client.status));
   await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('[data-lang-picker]').count()){
    checks.pickerChecked=checks.pickerChecked||{};checks.pickerChecked[query]=await page.locator('[data-lang-choice][aria-checked="true"]').getAttribute('data-lang-choice').catch(()=>null);
    if(pick)await page.locator(`[data-lang-choice="${pick}"]`).click();await page.locator('[data-lang-confirm]').click();}
   await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] [data-first-hangul="reads"]').count())await page.locator('dialog[open] [data-first-hangul="reads"]').click();
   await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(()=>{});}
   await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready'&&!document.querySelector('dialog[open] .tutor-option'));
  }
  // 이 기기의 학습 목표(손님 생활 진도 안 learningProfile).
  const profile=page=>page.evaluate(()=>{for(const key of Object.keys(localStorage)){try{const v=JSON.parse(localStorage.getItem(key));if(v&&typeof v==='object'&&v.learningProfile!==undefined)return {status:v.learningProfile?.profile?.status||'new',consent:!!v.learningProfile?.profile?.consent,values:v.learningProfile?.profile?.values||{}};}catch{}}return {status:'new',consent:false,values:{}};});
  const form=page=>page.evaluate(()=>{const f=document.querySelector('#world-study-form'),on=sel=>f.querySelector(sel)?.checked===true,shown=n=>!!n&&n.getClientRects().length>0;
   return {lang:document.documentElement.lang,reason:on('input[name="reason"][value="exam"]'),topik2:on('input[name="examType"][value="topik2"]'),topik1:on('input[name="examType"][value="topik1"]'),grade:f.querySelector('input[name="targetGrade"]:checked')?.value??null,
    exam:shown(f.querySelector('[data-study-exam]')),grades:[...f.querySelectorAll('[data-grade-type]')].filter(shown).map(n=>n.querySelector('input').value),consent:on('input[name="consent"]'),
    save:f.querySelector('button[type="submit"]').textContent.replace('→','').trim(),consentName:f.querySelector('.study-consent:has(input[name="consent"]) strong')?.textContent||''};});
  // 첫 화면(스크롤하지 않은 채): 판 제목·닫기 단추와 고른 「시험·자격 준비」 알약이 고정 단추 줄 위에 보이는가. TOPIK II 칸은 휴대폰에서
  // 한 번 내려야 보일 수 있다 — 저장 스위치가 맨 아래라 학생은 어차피 그 칸을 지나 내려간다(10-22 Fable 재검수 P2로 자동 스크롤을 뺐다).
  const firstView=page=>page.evaluate(()=>{const f=document.querySelector('#world-study-form'),bar=f.querySelector('.life-actions')?.getBoundingClientRect(),
   box=(name,value)=>f.querySelector(`input[name="${name}"][value="${value}"]`)?.closest('label')?.getBoundingClientRect(),inView=r=>!!r&&r.top>=0&&r.bottom<=Math.min(innerHeight,bar?.top??innerHeight);
   return {title:inView(document.querySelector('#panel-title')?.getBoundingClientRect()),close:inView(document.querySelector('#panel-close')?.getBoundingClientRect()),exam:inView(box('reason','exam')),topik2:inView(box('examType','topik2'))};});
  const measure=(page,selector)=>page.evaluate(selector=>{
   const el=document.querySelector(selector),content=document.querySelector('#panel-content'),box=el.getBoundingClientRect(),shown=n=>n.getClientRects().length>0;
   const small=[],mixed=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){const text=n.textContent.trim();if(!text||!shown(n.parentElement))continue;
    if(/[가-힣]/.test(text)&&parseFloat(getComputedStyle(n.parentElement).fontSize)<13)small.push(text.slice(0,24));
    if(document.documentElement.lang!=='ko'&&/[가-힣]/.test(text)&&!n.parentElement.closest('[lang="ko"]'))mixed.push(text.slice(0,30));}
   const overflowing=[...el.querySelectorAll('*')].filter(n=>shown(n)&&(n.getBoundingClientRect().right>box.right+.5||n.getBoundingClientRect().left<box.left-.5)).map(n=>n.className||n.tagName);
   return {lang:document.documentElement.lang,docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,panelOverflow:content?content.scrollWidth-content.clientWidth:0,
    zoomed:window.innerWidth>(window.visualViewport?.width??window.innerWidth)+1,overflowing,small,mixed};
  },selector);
  const shoot=async(page,name,selector=null)=>{await page.evaluate(()=>document.fonts.ready);if(selector)await page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),selector);
   const file=path.join(out,`${name}.png`);await page.locator('#world-panel').screenshot({path:file});shots.push(path.basename(file));};
  const settleQuiet=page=>page.waitForTimeout(1500);

  // ── A. 처음 온 기기 · 몽골어 · 375 ──
  const first=await device();
  {const {page}=first;
   await enter(page,'&exam=topik2&lang=mn');
   assert.equal(checks.pickerChecked['&exam=topik2&lang=mn'],'mn','주소의 lang=mn이 언어 고르기에 미리 눌린다');
   await page.waitForSelector('#panel-content #world-study-form');
   checks.firstForm=await form(page);
   assert.deepEqual({...checks.firstForm,consentName:undefined},{lang:'mn',reason:true,topik2:true,topik1:false,grade:'',exam:true,grades:['3','4','5','6'],consent:false,save:'Хадгалаад эхлэх',consentName:undefined});
   assert.equal(checks.firstForm.consentName,'Энэ төхөөрөмжид хадгалах');
   checks.firstProfile=await profile(page);
   assert.equal(checks.firstProfile.status,'new','목표 창을 열기만 해서는 저장하지 않는다');assert.equal(checks.firstProfile.values.examType,undefined);
   checks.firstView=await firstView(page);assert.deepEqual({...checks.firstView,topik2:undefined},{title:true,close:true,exam:true,topik2:undefined},'375 첫 화면에 제목·닫기와 고른 「시험·자격 준비」');
   measures['375-mn-goal']=await measure(page,'#panel-content #world-study-form');
   await shoot(page,'375-mn-goal-top');await shoot(page,'375-mn-goal-exam','#panel-content [data-study-exam]');
   // 스위치 없이 누르면 안내만, 켜고 누르면 이번 주 계획.
   await page.locator('#world-study-form button[type="submit"]').click();
   checks.needConsent=await page.locator('#world-study-form .study-save-status').innerText();
   assert.match(checks.needConsent,/«Энэ төхөөрөмжид хадгалах»/);assert.equal((await profile(page)).status,'new');
   await shoot(page,'375-mn-goal-consent','#world-study-form .study-consent:has(input[name="consent"])');
   await page.locator('#world-study-form .study-consent:has(input[name="consent"])').click();assert.equal(await page.locator('#world-study-form input[name="consent"]').isChecked(),true);
   await page.locator('#world-study-form button[type="submit"]').click();
   await page.waitForSelector('#panel-content [data-plan-board]');
   checks.savedProfile=await profile(page);
   assert.equal(checks.savedProfile.status,'active');assert.equal(checks.savedProfile.values.examType,'topik2');assert.equal(checks.savedProfile.values.primaryReason,'exam');
   checks.planHead=await page.locator('#panel-content [data-plan-board] .life-poster-sub').innerText();assert.match(checks.planHead,/^TOPIK II/);
   checks.planText=await page.locator('#panel-content [data-plan-board]').innerText();
   measures['375-mn-plan']=await measure(page,'#panel-content [data-plan-board]');
   await shoot(page,'375-mn-plan');
   checks.firstGoalSeen=await page.evaluate(()=>window.__qaGoalSeen>0);
  }
  // ── B. 같은 기기에서 같은 주소를 다시 열면 목표 창 없이 이번 주 계획 ──
  {const {page}=first;
   await enter(page,'&exam=topik2&lang=mn');
   await page.waitForSelector('#panel-content [data-plan-board]');
   await settleQuiet(page);
   checks.returnGoalSeen=await page.evaluate(()=>window.__qaGoalSeen);
   assert.equal(checks.returnGoalSeen,0,'이미 TOPIK II인 사람에게 목표 창을 다시 내밀지 않는다');
   assert.match(await page.locator('#panel-content [data-plan-board] .life-poster-sub').innerText(),/^TOPIK II/);
   await first.context.close();
  }
  // ── C. 「아직 못 읽어요」를 고른 기기는 열지 않는다 · D. 주소 값이 없으면 지금과 같다 ──
  for(const [name,seed,query] of [['hangul-new',seeded({reading:'new'}),'&exam=topik2'],['no-param',seeded(),'']]){
   const {context,page}=await device({seed,lang:'ko'});
   await enter(page,query);await settleQuiet(page);
   checks[`${name}GoalSeen`]=await page.evaluate(()=>window.__qaGoalSeen);
   assert.equal(checks[`${name}GoalSeen`],0,`${name}: 목표 창을 열지 않는다`);
   assert.equal(await page.locator('#panel-content [data-plan-board]').count(),0,`${name}: 계획도 열지 않는다`);
   await context.close();
  }
  // ── E. 한국어 · 1280 첫 실행 ──
  {const {context,page}=await device({viewport:VIEWPORTS.desk});
   await enter(page,'&exam=topik2',{pick:'ko'});
   await page.waitForSelector('#panel-content #world-study-form');
   checks.deskForm=await form(page);
   assert.deepEqual({...checks.deskForm,consentName:undefined},{lang:'ko',reason:true,topik2:true,topik1:false,grade:'',exam:true,grades:['3','4','5','6'],consent:false,save:'저장하고 시작하기',consentName:undefined});
   checks.deskView=await firstView(page);assert.deepEqual({...checks.deskView,topik2:undefined},{title:true,close:true,exam:true,topik2:undefined},'1280 첫 화면에도 제목·닫기와 「시험·자격 준비」');
   measures['1280-ko-goal']=await measure(page,'#panel-content #world-study-form');
   await shoot(page,'1280-ko-goal-first');await shoot(page,'1280-ko-goal-exam','#panel-content [data-study-exam]');
   await context.close();
  }
  // ── F. 채운 창에서 「건너뛰기」 — 목표 값은 저장하지 않고(건너뜀만), 첫 실행 창처럼 다음 연습이 열린다 ──
  {const {context,page}=await device();
   await enter(page,'&exam=topik2&lang=mn');
   await page.waitForSelector('#panel-content #world-study-form');
   await page.locator('#world-study-form [data-study-skip]').click();
   await page.waitForFunction(()=>!document.querySelector('#world-study-form')&&document.querySelector('#world-panel')?.open&&window.__synkHome?.openPanel?.());
   checks.skipPanel=await page.evaluate(()=>window.__synkHome.openPanel());checks.skipProfile=await profile(page);
   assert.equal(checks.skipProfile.status,'skipped');assert.equal(checks.skipProfile.values.examType,undefined,'목표 값은 저장하지 않는다');
   assert.notEqual(checks.skipPanel,'world-study','다음 연습 판이 열린다');
   await shoot(page,'375-mn-skip-next');
   await context.close();
  }
  for(const [name,m] of Object.entries(measures)){
   assert.equal(m.docOverflow,0,name);assert.equal(m.panelOverflow,0,name);assert.equal(m.zoomed,false,name);assert.deepEqual(m.overflowing,[],name);assert.deepEqual(m.small,[],name);
   if(m.lang!=='ko')assert.deepEqual(m.mixed,[],`${name} 한 자리 한 언어`);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checkedAt:new Date().toISOString(),shots,measures,checks,external:[...new Set(external)].length},null,1));
 }finally{await browser?.close();server.kill();}
});
