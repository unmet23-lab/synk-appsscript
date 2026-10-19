// 워크트리 리허설 서버(4637)를 격리 헤드리스 크롬으로 연다. 손님(리허설 모드) 첫 실행 → 한글 질문 → 튜터 → 홈 추천,
// 한 단계씩 도움받기 레슨의 판정 띠·결과 갈래·새 장면 복습, 홈 진도 글(390·1440)을 확인하고 사진을 남긴다.
const path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const BASE=process.env.BASE||'http://127.0.0.1:4637',OUT=process.env.SHOTS||path.join(require('node:os').tmpdir(),'world-review-loop-shots');fs.mkdirSync(OUT,{recursive:true});
const results={},log=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v));};
async function open(browser,{width,height,scale=1}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:scale,reducedMotion:'no-preference'});
 const page=await context.newPage();const errors=[],failed=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
 page.on('response',r=>{requests.push([r.status(),r.url()]);if(r.status()>=400)failed.push([r.status(),r.url()]);});
 await page.goto(BASE+'/mobile.html?opening=off',{waitUntil:'domcontentloaded'});
 return {context,page,errors,failed,requests};
}
const shot=(page,name)=>page.screenshot({path:path.join(OUT,name)});
async function firstRun(page,answer){
 await page.waitForSelector('dialog[open] [data-first-hangul]',{timeout:45000});
 await page.waitForTimeout(1600);
 return answer;
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try{
  // ── A. 390 · 첫 실행: 한글 질문이 튜터 고르기 앞에 온다 ──
  const a=await open(browser,{width:390,height:844,scale:2});
  await firstRun(a.page);
  log('A.firstRunOrder',await a.page.evaluate(()=>window.__synkHome.firstRun()));
  log('A.panel',await a.page.evaluate(()=>({kind:document.querySelector('#world-panel').className,title:document.querySelector('#panel-title').textContent,ask:document.querySelector('.first-hangul-ask')?.textContent,buttons:[...document.querySelectorAll('[data-first-hangul]')].map(b=>b.dataset.firstHangul+':'+b.textContent.trim()),tutorOptions:document.querySelectorAll('.tutor-option').length})));
  log('A.voiceRequests',a.requests.filter(([,u])=>/hangul-stage\/assets\/voice\//.test(u)).map(([s,u])=>[s,u.split('/').pop()]));
  await shot(a.page,'A1-first-hangul-390.png');
  await a.page.click('[data-first-hangul="new"]');
  await a.page.waitForSelector('dialog[open] .tutor-option',{timeout:20000});
  log('A.afterAnswer',await a.page.evaluate(()=>({tutorPanel:!!document.querySelector('#world-panel.tutor-panel .tutor-options'),hangul:window.__synkWorld.life()?.progress?.hangul||null})));
  await a.page.click('.tutor-option[data-tutor-id="mongle"]');await a.page.click('.tutor-primary');await a.page.click('.tutor-primary[data-tutor-action="finish"]');
  await a.page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready',null,{timeout:20000});
  await a.page.waitForFunction(()=>window.__synkEducation?.metrics()?.plan?.selected,null,{timeout:20000});
  await a.page.waitForTimeout(1200);
  log('A.plan',await a.page.evaluate(()=>{const p=window.__synkEducation.metrics().plan;return {selected:p.selected.id,reasons:p.reasons,reason:p.reason,prerequisite:p.prerequisite?.id||null};}));
  log('A.homeTutor',await a.page.evaluate(()=>({recommendation:window.__synkHome.homeTutor()?.recommendation,action:document.querySelector('#home-tutor .game-tutor-help')?.textContent})));
  await shot(a.page,'A2-home-hangul-first-390.png');
  // 홈 튜터의 주 단추 → 한글 만나기가 열린다
  await a.page.click('#home-tutor .game-tutor-help');
  await a.page.waitForSelector('#world-panel iframe.game-frame',{timeout:20000});
  const frame=await (await a.page.$('#world-panel iframe.game-frame')).contentFrame();
  await frame.waitForSelector('#home:not([hidden])',{timeout:30000});
  log('A.gameFrame',{src:await a.page.evaluate(()=>document.querySelector('#world-panel iframe.game-frame').getAttribute('src'))});
  await a.page.waitForTimeout(800);await shot(a.page,'A3-hangul-game-390.png');
  // 처음 여는 게임의 튜터 조작 연습(10-10)은 이번 확인과 무관 — 닫고 이어 간다.
  if(await a.page.locator('dialog.tutor-practice[open] .practice-exit').count()){await a.page.click('dialog.tutor-practice[open] .practice-exit');await a.page.waitForFunction(()=>!document.querySelector('dialog.tutor-practice[open]'));}
  // 한글 만나기의 「건너뛰기」(읽을 수 있어요) → WORLD 답이 reads로 바뀐다. 「다시 배우기」 → new.
  await frame.click('#skip');await frame.click('#sheet-skip');
  await a.page.waitForFunction(()=>window.__synkWorld.life()?.progress?.hangul?.answer==='reads',null,{timeout:10000});
  log('A.afterSkip',await a.page.evaluate(()=>window.__synkWorld.life().progress.hangul));
  await frame.click('#unskip');
  await a.page.waitForFunction(()=>window.__synkWorld.life()?.progress?.hangul?.answer==='new',null,{timeout:10000});
  log('A.afterUnskip',await a.page.evaluate(()=>window.__synkWorld.life().progress.hangul));
  // 졸업 화면의 「생활 한국어 첫 레슨」 단추(졸업 조건은 흉내 내지 않고, 졸업 화면을 띄운 뒤 단추만 누른다)
  await frame.evaluate(()=>{for(const s of ['home','session','finish','graduation','song']){const el=document.getElementById(s);if(el)el.hidden=s!=='graduation';}document.getElementById('grad-life').hidden=false;});
  await a.page.waitForTimeout(300);await shot(a.page,'A4-hangul-graduation-buttons-390.png');
  await frame.click('#grad-life');
  await a.page.waitForFunction(()=>window.__synkWorld.life()?.lessonId==='greetings-expressions',null,{timeout:20000});
  log('A.afterGradLife',await a.page.evaluate(()=>({lesson:window.__synkWorld.life().lessonId,phase:window.__synkWorld.life().phase,panelTitle:document.querySelector('#panel-title').textContent,frame:!!document.querySelector('#world-panel iframe.game-frame')})));
  await shot(a.page,'A5-first-lesson-from-hangul-390.png');
  log('A.errors',{errors:a.errors,failed:a.failed.map(([s,u])=>[s,u.replace(BASE,'')])});
  await a.context.close();

  // ── B. 390 · 「한 단계씩 도움받기」 레슨: 설정 도움 · 틀림 · 직접 연 도움 → 결과 갈래 → 새 장면 복습 ──
  const b=await open(browser,{width:390,height:844,scale:2});
  await firstRun(b.page);await b.page.click('[data-first-hangul="reads"]');
  await b.page.waitForSelector('dialog[open] .tutor-option');await b.page.click('.tutor-option[data-tutor-id="marin"]');await b.page.click('.tutor-primary');await b.page.click('.tutor-primary[data-tutor-action="finish"]');
  await b.page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');
  log('B.hangulAnswer',await b.page.evaluate(()=>window.__synkWorld.life().progress.hangul));
  // 학습 목표 창에서 도움 방식 「한 단계씩」을 저장한다(건너뛴 목표, 동의 켬)
  await b.page.evaluate(()=>window.__synkEducation.open());
  await b.page.waitForSelector('#world-study-form');
  await b.page.evaluate(()=>{document.querySelector('#world-study-form input[name="support"][value="step"]').checked=true;document.querySelector('#world-study-form input[name="consent"]').checked=true;});
  await b.page.click('#world-study-form button[type="submit"]');
  await b.page.waitForFunction(()=>!document.querySelector('#world-study-form'),null,{timeout:15000});
  log('B.support',await b.page.evaluate(()=>window.__synkWorld.life()&&window.__synkEducation.metrics().plan?.settings?.support));
  await b.page.click('.world-nav [data-view="packs"]');
  await b.page.waitForSelector('.life-now [data-life-lesson]');await b.page.click('.life-now [data-life-lesson]');
  await b.page.waitForSelector('[data-life-begin]');await b.page.click('[data-life-begin]');
  for(let i=0;i<12&&!(await b.page.locator('[data-life-choice]').count());i++){if(await b.page.locator('[data-life-scene-next]').count())await b.page.click('[data-life-scene-next]');await b.page.waitForTimeout(400);}
  await b.page.waitForSelector('[data-life-choice]');
  const q=async()=>b.page.evaluate(()=>{const m=window.__synkWorld.life();const p=m.progress.lessons[m.lessonId];return {lesson:m.lessonId,step:m.step,hintVisible:!document.querySelector('.life-hint')?.hidden};});
  log('B.q1',await q());
  const answerIs=async correct=>{const ids=await b.page.evaluate(async()=>{const {LESSONS}=await import('/life-content.mjs');const m=window.__synkWorld.life(),l=LESSONS.find(x=>x.id===m.lessonId),qq=l.questions[m.step];return {right:qq.answerId,wrong:qq.choices.find(c=>c.id!==qq.answerId).id};});await b.page.click(`[data-life-choice="${correct?ids.right:ids.wrong}"]`);await b.page.waitForSelector('.life-feedback');};
  await answerIs(true);await b.page.waitForTimeout(700);
  log('B.band1',await b.page.evaluate(()=>({result:document.querySelector('.life-feedback').dataset.result,title:document.querySelector('.life-feedback>strong').textContent,foot:document.querySelector('.life-feedback-foot>small')?.textContent||null})));
  await shot(b.page,'B1-guided-band-390.png');
  await b.page.click('[data-life-question-next]');await b.page.waitForSelector('[data-life-choice]:not([disabled])');
  log('B.q2',await q());await answerIs(false);
  log('B.band2',await b.page.evaluate(()=>document.querySelector('.life-feedback').dataset.result));
  await b.page.click('[data-life-question-next]');await b.page.waitForSelector('[data-life-choice]:not([disabled])');
  // 셋째 문제: 사람이 「표현 도움 보기」를 눌러 연 도움(설정 도움이 이미 펼쳐져 있어도 누르면 사람이 연 도움이다)
  await b.page.click('[data-life-help]');await answerIs(true);
  log('B.band3',await b.page.evaluate(()=>document.querySelector('.life-feedback').dataset.result));
  await b.page.click('[data-life-question-next]');
  await b.page.waitForSelector('.life-complete',{timeout:15000});await b.page.waitForTimeout(2400);
  log('B.result',await b.page.evaluate(()=>({groups:[...document.querySelectorAll('.life-complete [data-group]')].map(s=>({group:s.dataset.group,count:s.querySelector('.life-result-count')?.textContent,items:[...s.querySelectorAll('li strong')].map(x=>x.textContent)})),quiet:document.querySelector('.life-actions .quiet-button')?.textContent,reviewIds:document.querySelector('[data-life-review-lesson]')?.dataset.lifeReviewIds||null})));
  log('B.schedule',await b.page.evaluate(()=>{const p=window.__synkWorld.life().progress;return Object.values(p.reviews).filter(r=>r.lessonId==='greetings-expressions').map(r=>({id:r.id.replace('greetings-expressions-',''),inMinutes:Math.round((r.dueAt-Date.now())/60000),interval:r.intervalDays,lapses:r.lapses}));}));
  await shot(b.page,'B2-result-390.png');
  await b.page.evaluate(()=>document.querySelector('#panel-content').scrollTo(0,9999));await b.page.waitForTimeout(300);await shot(b.page,'B3-result-bottom-390.png');
  await b.page.click('[data-life-review-lesson]');
  await b.page.waitForSelector('.life-session-meta[data-life-phase="review"]',{timeout:15000});await b.page.waitForTimeout(500);
  log('B.review',await b.page.evaluate(()=>({count:document.querySelector('.life-count')?.textContent,hintVisible:!document.querySelector('.life-hint')?.hidden,help:document.querySelector('[data-life-help]')?.getAttribute('aria-expanded')})));
  await shot(b.page,'B4-new-scene-review-390.png');
  // 홈(390): 진도 글·바로가기는 숨는다
  await b.page.click('#panel-close');await b.page.waitForTimeout(600);
  log('B.home390',await b.page.evaluate(()=>({caption:getComputedStyle(document.querySelector('#life-progress-caption')).display,shortcuts:getComputedStyle(document.querySelector('.life-home-shortcuts')).display,nextPill:getComputedStyle(document.querySelector('.life-next-button')).display,reviewButton:!document.querySelector('.home-tutor-review')?.hidden?document.querySelector('.home-tutor-review')?.textContent:null,recommendation:window.__synkHome.homeTutor()?.recommendation?.kind})));
  await shot(b.page,'B5-home-390.png');
  log('B.errors',{errors:b.errors,failed:b.failed.map(([s,u])=>[s,u.replace(BASE,'')])});
  await b.context.close();

  // ── C. 1440 · 첫 실행 한글 질문 · 홈 진도 글 ──
  const c=await open(browser,{width:1440,height:900});
  await firstRun(c.page);await shot(c.page,'C1-first-hangul-1440.png');
  await c.page.click('[data-first-hangul="reads"]');
  await c.page.waitForSelector('dialog[open] .tutor-option');await c.page.click('.tutor-option[data-tutor-id="kkamong"]');await c.page.click('.tutor-primary');await c.page.click('.tutor-primary[data-tutor-action="finish"]');
  await c.page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');await c.page.waitForTimeout(2500);
  log('C.home1440',await c.page.evaluate(()=>({layout:document.documentElement.dataset.layout,caption:[getComputedStyle(document.querySelector('#life-progress-caption')).display,document.querySelector('#life-progress-caption').textContent],shortcuts:getComputedStyle(document.querySelector('.life-home-shortcuts')).display,nextPill:getComputedStyle(document.querySelector('.life-next-button')).display,plan:window.__synkEducation.metrics().plan?.selected?.id})));
  await shot(c.page,'C2-home-1440.png');
  log('C.errors',{errors:c.errors,failed:c.failed.map(([s,u])=>[s,u.replace(BASE,'')])});
  await c.context.close();
 }catch(error){console.error('CHECK_FAILED',error.stack);results.error=error.message;process.exitCode=1;}
 finally{fs.writeFileSync(path.join(__dirname,'check-local.json'),JSON.stringify(results,null,1));await browser.close();}
})();
