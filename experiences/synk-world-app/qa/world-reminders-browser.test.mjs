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
import {PACKS,LESSONS} from '../life-content.mjs';
// WORLD 학습 알림(10-19 결정 「WORLD 알림 · 주 1~2회 · 학습 일만」) 실제 브라우저 확인 — 계정 모드 WORLD(헤드리스 Edge)의 손님 학생:
// 앱 안에서 먼저 묻기 → 「알려 주세요」를 누른 뒤에만 OS 권한 → 다음 날 저녁 7시 예약 → 시계를 넘겨 그 시각에 알림 → 누르면 복습,
// 거절(다시 묻지 않음)·설정에서 켜기·OS에서 막힘·끄기, 시험일 2주 전 점검 → 시험 형식 카드 → 이번 주 계획, 세 언어(ko·en·mn)·390·1280.
// OS 알림은 가짜 Notification으로 받는다(헤드리스는 띄우지 않는다). 운영 계정·서버를 쓰지 않는다(손님 = 이 기기 기록, 바깥 주소는 막는다).
// 캡처와 result.json은 SYNK_REMINDERS_QA_OUT(기본 qa/world-reminders-20261021/)에 쓴다(그림은 git 밖).
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');if(!playwright.chromium)throw Error('no chromium');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
const out=path.resolve(process.env.SYNK_REMINDERS_QA_OUT||path.join(root,'experiences/synk-world-app/qa/world-reminders-20261021'));
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',
 clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const KST=t=>Date.parse(t+'+09:00');
// 레슨을 마친 때(오늘 오전 10시)와 화면을 여는 때(오전 11시). 맞힌 답의 복습은 하루 뒤 오전 10시에 돌아온다 → 알림은 그날 저녁 7시(기본값).
const ANSWERED=KST('2026-10-21T10:00:00'),OPEN=KST('2026-10-21T11:00:00'),REVIEW_AT=KST('2026-10-22T19:00:00');
const VIEWPORTS={phone:{width:390,height:844},desk:{width:1280,height:800}};

// 손님 기기의 생활 진도(실제 createLifeProgress로 만든 값): 한글을 읽는다고 답했고, 몽글을 골랐고, 첫 레슨을 마쳤다. exam이면 시험·자격 준비 + 날까지 정한 시험일.
function seededProgress({exam=null}={}){
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 let tick=ANSWERED,n=0;const life=createLifeProgress({storage,owner:'guest',now:()=>tick,uuid:()=>`qa-reminder-${++n}`});
 life.summary(PACKS,LESSONS);life.setHangulReading('reads',{via:'question'});life.selectTutor('mongle');
 const lesson=LESSONS.find(row=>row.id==='greetings-expressions');life.startLesson(lesson);
 for(const q of lesson.questions){tick+=1000;life.recordAnswer({lessonId:lesson.id,questionId:q.id,correct:true,choiceId:q.answerId});}
 life.finishLesson(lesson.id);
 if(exam)life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['exam'],primaryReason:'exam',examType:'topik1',targetGrade:2,examDate:exam}});
 return Object.fromEntries(values);
}

test('WORLD 학습 알림: 앱 안 묻기 → OS 권한 → 예약 → 알림 → 누르면 그 자리, 거절·끄기·막힘, 시험일 점검, 세 언어 (390·1280)',{timeout:600000,skip:!talkRoot&&'형제 저장소 SYNK-talk이 없다(SYNK_TALK_ROOT로 가리킨다)'},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-reminders-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
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
  // 새 기기 하나: 심은 생활 진도·화면 언어와 가짜 OS 알림(권한은 이 기기의 localStorage에 남는다 — 다시 열어도 같다).
  async function device({lang='ko',exam=null,answer='granted',viewport=VIEWPORTS.phone}={}){
   const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});context.setDefaultTimeout(25000);
   await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
   await context.addInitScript(({seed,lang,answer})=>{
    if(window.top!==window)return;
    if(!localStorage.getItem('qa.seeded')){for(const [k,v]of Object.entries(seed))localStorage.setItem(k,v);localStorage.setItem('synk.world.lang',lang);localStorage.setItem('synk-world-v1-welcomed','1');localStorage.setItem('qa.notification.answer',answer);localStorage.setItem('qa.seeded','1');}
    const asks=window.__qaAsks=[],notes=window.__qaNotes=[];
    class QANotification{constructor(title,options={}){this.title=title;this.body=options.body;this.tag=options.tag;this.lang=options.lang;this.at=Date.now();notes.push(this);}close(){this.closed=true;}}
    Object.defineProperty(QANotification,'permission',{get:()=>localStorage.getItem('qa.notification.permission')||'default'});
    QANotification.requestPermission=()=>{asks.push(Date.now());const value=localStorage.getItem('qa.notification.answer')||'granted';localStorage.setItem('qa.notification.permission',value);return Promise.resolve(value);};
    Object.defineProperty(window,'Notification',{value:QANotification,configurable:true,writable:true});
   },{seed:seededProgress({exam}),lang,answer});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:OPEN});
   return {context,page};
  }
  // 첫 실행 단계가 남아 있으면 지나간다(언어·한글 답·튜터는 심어 두었다).
  async function start(page,lang='ko'){
   await page.goto(url+'/world/?opening=off'+(lang!=='ko'?'&lang='+lang:''),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>['ready','welcome'].includes(window.__synkWorld?.client.status));
   await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('[data-lang-picker]').count()){await page.locator(`[data-lang-choice="${lang}"]`).click();await page.locator('[data-lang-confirm]').click();}
   if(await page.locator('dialog[open] [data-first-hangul="reads"]').count())await page.locator('dialog[open] [data-first-hangul="reads"]').click();
   await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click().catch(()=>{});}
   await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready'&&!document.querySelector('dialog[open] .tutor-option')&&window.__synkReminders);
  }
  const closePanel=async page=>{if(await page.evaluate(()=>document.querySelector('#world-panel')?.open)){await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);}};
  const openLearn=async page=>{await closePanel(page);await page.locator('nav [data-view="packs"], [data-view="packs"][data-life-library]').last().click();await page.waitForSelector('#panel-content .life-hub');};
  const openSettings=async page=>{await closePanel(page);await page.locator('#settings-open').click();await page.waitForSelector('#panel-content [data-reminder-settings]');};
  const clearToast=page=>page.evaluate(()=>{const n=document.querySelector('#home-toast');if(n){n.textContent='';n.hidden=true;}});
  const toast=page=>page.waitForFunction(()=>{const n=document.querySelector('#home-toast');return n&&!n.hidden&&n.textContent.trim()?n.textContent.trim():null;}).then(h=>h.jsonValue());
  const reminders=page=>page.evaluate(()=>{const m=window.__synkReminders.metrics();return {state:m.state,items:m.plan?.items||[],notes:m.plan?.notes||[],hour:m.hour,support:m.support};});
  // 화면 재기: 넘침·13px 밑 한글·한 자리 한 언어·44px 밑 단추·흰 알약 수, 고른 영역(box) 안에서. 스위치·알약은 감싼 label 전체가 누르는 자리다.
  const measure=(page,selector)=>page.evaluate(selector=>{
   const el=document.querySelector(selector),content=document.querySelector('#panel-content'),box=el.getBoundingClientRect(),shown=n=>n.getClientRects().length>0;
   const small=[],mixed=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){const text=n.textContent.trim();if(!text||!shown(n.parentElement))continue;
    if(/[가-힣]/.test(text)&&parseFloat(getComputedStyle(n.parentElement).fontSize)<13)small.push(text.slice(0,24));
    if(document.documentElement.lang!=='ko'&&/[가-힣]/.test(text)&&!n.parentElement.closest('[lang="ko"]'))mixed.push(text.slice(0,30));}
   const targets=[...el.querySelectorAll('button,label:has(input[type=checkbox]),label:has(input[type=radio])')].filter(shown).map(n=>({key:n.dataset.world||n.className||n.tagName,height:Math.round(n.getBoundingClientRect().height)}));
   const overflowing=[...el.querySelectorAll('*')].filter(n=>shown(n)&&(n.getBoundingClientRect().right>box.right+.5||n.getBoundingClientRect().left<box.left-.5)).map(n=>n.className||n.tagName);
   return {lang:document.documentElement.lang,docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,panelOverflow:content?content.scrollWidth-content.clientWidth:0,
    overflowing,small,mixed,shortTargets:targets.filter(x=>x.height<44),whitePills:[...el.querySelectorAll('.felt-button')].filter(shown).length};
  },selector);
  const shoot=async(page,name,selector=null)=>{await page.evaluate(()=>document.fonts.ready);if(selector)await page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),selector);
   const file=path.join(out,`${name}.png`);await page.locator('#world-panel').screenshot({path:file});shots.push(path.basename(file));};
  const record=async(page,name,selector)=>{measures[name]=await measure(page,selector);await shoot(page,name,selector);};
  const asks=page=>page.evaluate(()=>window.__qaAsks.length);
  // 알림이 n개가 될 때까지. 안 오면 그때의 제어기 상태를 함께 남긴다.
  const waitNotes=async(page,n)=>{try{await page.waitForFunction(n=>window.__qaNotes.length>=n,n,{timeout:15000});}catch(error){console.error('[notes-timeout]',JSON.stringify(await page.evaluate(()=>({now:new Date().toISOString(),notes:window.__qaNotes.map(x=>x.body),m:window.__synkReminders.metrics()}))));throw error;}};
  const notes=page=>page.evaluate(()=>window.__qaNotes.map(n=>({title:n.title,body:n.body,tag:n.tag,lang:n.lang,at:n.at})));
  const jumpTo=async(page,at)=>{const now=await page.evaluate(()=>Date.now());assert.ok(at>now,'시계는 앞으로만');await page.clock.fastForward(at-now);};

  // ── A. 받아들이기 → 예약 → 그 시각의 알림 → 누르면 복습 ──
  {const {context,page}=await device();
   await start(page);
   assert.equal(await asks(page),0,'앱을 열었다고 OS 권한을 청하지 않는다');
   await openLearn(page);
   const card=page.locator('#panel-content [data-reminder-card="ask"]');await card.waitFor();
   checks.askKo=await card.innerText();
   assert.match(checks.askKo,/다시 만날 표현이 돌아오면 일주일에 한두 번 알려 드릴까요\?/);assert.match(checks.askKo,/잠금 화면에는 배운 내용이나 점수가 나오지 않고/);
   assert.equal(await asks(page),0,'묻는 카드만 보고는 OS 권한을 청하지 않는다');
   await record(page,'390-ko-ask','#panel-content [data-reminder-card="ask"]');
   await clearToast(page);await page.locator('#panel-content [data-world="reminder-yes"]').click();
   checks.onToast=await toast(page);
   assert.equal(checks.onToast,'알림을 켰어요. 다음 알림은 10월 22일 저녁 7시예요.');
   assert.equal(await asks(page),1,'「알려 주세요」를 누른 뒤 한 번 청한다');
   await page.waitForFunction(()=>!document.querySelector('#panel-content [data-reminder-card]'));
   const planned=await reminders(page);checks.planned=planned;
   assert.equal(planned.state.enabled,true);assert.equal(planned.state.consent.answer,'yes');
   assert.deepEqual(planned.items.map(row=>[row.kind,row.at]),[['review',REVIEW_AT]]);
   // 설정: 켜짐 · 횟수 · 시간 · 다음 알림. 시간을 바꾸면 다음 알림이 따라 바뀌고 「알아서」로 되돌린다.
   await openSettings(page);
   checks.settingsKo=await page.locator('#panel-content [data-reminder-settings]').innerText();
   assert.equal(await page.locator('#panel-content [data-reminder-enabled]').isChecked(),true);
   assert.match(checks.settingsKo,/다음 알림 · 10월 22일 저녁 7시/);assert.match(checks.settingsKo,/WORLD가 열려 있는 동안 이 기기에 알려요/);
   await record(page,'390-ko-settings','#panel-content [data-reminder-settings]');
   await page.locator('#panel-content [data-reminder-settings] input[name="reminder-hour"][value="18"]').check({force:true});
   await page.waitForFunction(()=>/저녁 6시/.test(document.querySelector('[data-reminder-status]')?.textContent||''));
   assert.equal((await reminders(page)).items[0].at,KST('2026-10-22T18:00:00'));
   await page.locator('#panel-content [data-reminder-settings] input[name="reminder-hour"][value="auto"]').check({force:true});
   await page.waitForFunction(()=>/저녁 7시/.test(document.querySelector('[data-reminder-status]')?.textContent||''));
   await page.setViewportSize(VIEWPORTS.desk);await page.waitForTimeout(200);await record(page,'1280-ko-settings','#panel-content [data-reminder-settings]');await page.setViewportSize(VIEWPORTS.phone);
   await closePanel(page);
   // 시계를 그날 저녁 7시 30초로 넘기면 1분마다 보는 확인이 알림을 띄운다. 잠금 화면 글은 학습 일만.
   await jumpTo(page,REVIEW_AT+30000);
   await waitNotes(page,1);
   checks.reviewNote=await notes(page);
   assert.deepEqual(checks.reviewNote.map(n=>[n.title,n.body,n.tag,n.lang]),[['SYNK WORLD','다시 만날 표현이 돌아왔어요.','synk-world-reminder','ko']]);
   assert.ok((await reminders(page)).state.entries.some(row=>row.kind==='review'&&row.deliveredAt>=REVIEW_AT&&!row.openedAt));
   // 누르면 그 자리(나의 복습)로 가고, 누른 것이 기록에 남는다.
   await page.evaluate(()=>window.__qaNotes.at(-1).onclick());
   await page.waitForFunction(()=>window.__synkHome.openPanel()==='life-review');
   checks.openedPanel=await page.evaluate(()=>window.__synkHome.openPanel());
   const opened=(await reminders(page)).state.entries.find(row=>row.kind==='review');assert.ok(opened.openedAt>=opened.deliveredAt);
   await shoot(page,'390-ko-review-opened');
   // 다시 열어도 같은 알림을 또 띄우지 않는다(보낸 기록이 이 기기에 남는다).
   await closePanel(page);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkReminders);
   await page.clock.fastForward(3*60000);assert.deepEqual(await notes(page),[]);
   // 끄면 잡아 둔 알림이 지워진다.
   await openSettings(page);await clearToast(page);await page.locator('#panel-content [data-reminder-enabled]').uncheck({force:true});
   checks.offToast=await toast(page);assert.equal(checks.offToast,'알림을 껐어요. 잡아 둔 알림도 지웠어요.');
   const off=await reminders(page);assert.equal(off.state.enabled,false);assert.equal(off.state.entries.filter(row=>!row.deliveredAt).length,0);
   await context.close();}

  // ── B. 거절 → 다시 묻지 않음 → 설정에서 켜기 · OS에서 막힘 ──
  {const {context,page}=await device({answer:'denied'});
   await start(page);await openLearn(page);
   await clearToast(page);await page.locator('#panel-content [data-world="reminder-no"]').click();
   checks.declineToast=await toast(page);assert.equal(checks.declineToast,'알겠어요. 설정의 「학습 알림」에서 언제든 켤 수 있어요.');
   assert.equal(await asks(page),0,'거절하면 OS 권한을 청하지 않는다');
   await page.waitForFunction(()=>!document.querySelector('#panel-content [data-reminder-card]'));
   await closePanel(page);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkReminders);
   await openLearn(page);assert.equal(await page.locator('#panel-content [data-reminder-card]').count(),0,'거절한 뒤에는 다시 묻지 않는다');
   // 설정에서 켜면 그 자리에서 청한다 — 이 기기는 OS에서 막혀 있다.
   await openSettings(page);await clearToast(page);await page.locator('#panel-content [data-reminder-enabled]').click({force:true});
   checks.blockedToast=await toast(page);assert.match(checks.blockedToast,/이 기기에서 알림이 막혀 있어요/);
   assert.equal(await asks(page),1);
   await page.waitForFunction(()=>document.querySelector('[data-reminder-enabled]')?.disabled&&!document.querySelector('[data-reminder-enabled]').checked);
   checks.blockedStatus=await page.locator('#panel-content [data-reminder-status]').innerText();assert.match(checks.blockedStatus,/막혀 있어요/);
   await record(page,'390-ko-settings-blocked','#panel-content [data-reminder-settings]');
   assert.equal((await reminders(page)).state.enabled,false);
   // 막힌 기기에서는 배우기 판에서도 묻지 않는다.
   await openLearn(page);assert.equal(await page.locator('#panel-content [data-reminder-card]').count(),0);
   await context.close();}

  // ── C. 시험일 2주 전 점검: 잠금 화면에는 일의 종류 없이, 누르면 시험 형식 카드 → 이번 주 계획 ──
  {const {context,page}=await device({exam:'2026-11-05'});
   await start(page);await openLearn(page);
   const card=page.locator('#panel-content [data-reminder-card="ask"]');await card.waitFor();
   assert.match(await card.innerText(),/시험일이 다가오면/);
   await clearToast(page);await page.locator('#panel-content [data-world="reminder-yes"]').click();await toast(page);
   const planned=await reminders(page);checks.examPlanned=planned.items.map(row=>[row.kind,row.ref,row.at]);
   // 시험 14일 전(10-22)이 먼저, 같은 날의 복습은 하루 뒤로(하루에 하나).
   assert.deepEqual(planned.items.map(row=>[row.kind,row.at]),[['exam',REVIEW_AT],['review',KST('2026-10-23T19:00:00')]]);
   await closePanel(page);await jumpTo(page,REVIEW_AT+30000);await waitNotes(page,1);
   checks.examNote=await notes(page);
   assert.deepEqual(checks.examNote.map(n=>n.body),['알려 준 날이 다가와요. 준비한 연습이 있어요.']);
   assert.doesNotMatch(checks.examNote[0].body,/시험|TOPIK|급|점수/);
   await page.evaluate(()=>window.__qaNotes.at(-1).onclick());
   await page.waitForFunction(()=>window.__synkHome.openPanel()==='world-reminder');
   checks.examCard=await page.locator('#panel-content .reminder-exam').innerText();
   assert.match(checks.examCard,/시험 형식 연습으로 확인해 볼까요\?/);
   await record(page,'390-ko-exam-card','#panel-content .reminder-exam');
   await page.locator('#panel-content [data-world="reminder-exam-plan"]').click();
   await page.waitForSelector('#panel-content [data-plan-board]');
   await shoot(page,'390-ko-exam-plan');
   // 다음 날 저녁 7시에는 복습 알림이 하나 더(같은 7일 창의 두 번째 — 시험 점검이 있는 주라서).
   await closePanel(page);await jumpTo(page,KST('2026-10-23T19:00:30'));await waitNotes(page,2);
   assert.deepEqual((await notes(page)).map(n=>n.body),['알려 준 날이 다가와요. 준비한 연습이 있어요.','다시 만날 표현이 돌아왔어요.']);
   await context.close();}

  // ── D. 영어·몽골어: 묻는 카드와 설정이 그 언어로, 잠금 화면 글은 한국어(한글을 읽는 학생) ──
  for(const lang of ['en','mn']){
   const {context,page}=await device({lang});
   await start(page,lang);assert.equal(await page.evaluate(()=>document.documentElement.lang),lang);
   await openLearn(page);await page.locator('#panel-content [data-reminder-card="ask"]').waitFor();
   checks[`ask-${lang}`]=await page.locator('#panel-content [data-reminder-card="ask"]').innerText();
   await record(page,`390-${lang}-ask`,'#panel-content [data-reminder-card="ask"]');
   await clearToast(page);await page.locator('#panel-content [data-world="reminder-yes"]').click();checks[`on-${lang}`]=await toast(page);
   await openSettings(page);checks[`settings-${lang}`]=await page.locator('#panel-content [data-reminder-settings]').innerText();
   await record(page,`390-${lang}-settings`,'#panel-content [data-reminder-settings]');
   await closePanel(page);await jumpTo(page,REVIEW_AT+30000);await waitNotes(page,1);
   checks[`note-${lang}`]=await notes(page);
   assert.equal(checks[`note-${lang}`][0].body,'다시 만날 표현이 돌아왔어요.','한글을 읽는 학생의 잠금 화면 글은 한국어 틀이다');
   checks[`missing-${lang}`]=await page.evaluate(()=>window.__synkWorldLang.missing().filter(row=>row.key.startsWith('reminder.')));
   assert.deepEqual(checks[`missing-${lang}`],[]);
   await context.close();
  }
  assert.match(checks['on-en'],/^Reminders are on\. Next one: Oct 22 at 7 PM\.$/);
  assert.match(checks['on-mn'],/^Сануулгыг асаалаа\. Дараагийнх нь: 10-р сарын 22, 19:00\.$/);
  assert.match(checks['settings-en'],/Next reminder · Oct 22 at 7 PM/);assert.match(checks['settings-mn'],/Дараагийн сануулга · 10-р сарын 22, 19:00/);

  for(const [name,m] of Object.entries(measures)){
   assert.equal(m.docOverflow,0,name);assert.equal(m.panelOverflow,0,name);assert.deepEqual(m.overflowing,[],name);
   assert.deepEqual(m.small,[],name);assert.deepEqual(m.shortTargets,[],name);assert.ok(m.whitePills<=1,`${name} 흰 알약 ${m.whitePills}`);
   if(m.lang!=='ko')assert.deepEqual(m.mixed,[],`${name} 한 자리 한 언어`);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checkedAt:new Date().toISOString(),shots,measures,checks,external:[...new Set(external)].length},null,1));
 }finally{await browser?.close();server.kill();}
});
