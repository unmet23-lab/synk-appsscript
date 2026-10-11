const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const base=process.env.SYNK_DAILY_TUTOR_URL||'http://127.0.0.1:4314',out=path.join(__dirname,'daily-tutor-20261011',process.env.SYNK_DAILY_TUTOR_RUN||'source');fs.mkdirSync(out,{recursive:true});
let browser,page,context,failure;const checks=[],errors=[],assets=[],external=[];
const check=(name,value,detail)=>{checks.push({name,passed:!!value,...(detail?{detail}:{})});console.log((value?'PASS ':'FAIL ')+name);assert.ok(value,name);};
const read=()=>page.evaluate(()=>({home:window.__synkHome.homeTutor(),life:window.__synkWorld.life()}));
const core=p=>JSON.stringify({lessons:p.lessons,reviews:p.reviews,activeLessonId:p.activeLessonId,activeReview:p.activeReview});
const close=()=>page.locator('#panel-close').click();
async function shot(name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await page.screenshot({path:path.join(out,name+'.png')});}
async function fit(label,selector){const v=await page.locator(selector).evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,small:[...el.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0).filter(b=>b.getBoundingClientRect().width<44||b.getBoundingClientRect().height<44).length}));check(label,v.overflow<=1&&!v.small,v);}
async function offset(days){await page.evaluate(n=>localStorage.setItem('__daily_test_clock',String(n*86400000)),days);await page.reload();await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.tutor&&window.__synkWorld?.life()?.owner==='guest');}
(async()=>{
 const {lessonById}=await import(pathToFileURL(path.join(__dirname,'../life-content.mjs')).href),l=lessonById('greetings-expressions'),cafe=lessonById('cafe-visit-soldout');
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const id of ['marin','kkamong','mongle']){
  context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});context.setDefaultTimeout(12000);
  await context.addInitScript(()=>{if(!location.pathname.endsWith('.html'))return;const real=Date.now;Date.now=()=>real()+Number(localStorage.getItem('__daily_test_clock')||0);});
  await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith(base+'/')||/^(blob|data):/.test(u))return route.continue();external.push(u);return route.abort();});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/'))assets.push(new URL(r.url()).pathname);});
  await page.goto(base+'/mobile.html?opening=off&tutor=choose');await page.locator(`[data-tutor-id=${id}]`).click();await page.locator('[data-tutor-action=confirm]').click();await page.locator('[data-tutor-action=finish]').click();await page.evaluate(()=>history.replaceState(null,'','?opening=off'));
  check(id+': no invented daily recap on first visit',!(await read()).home.days.today.count&&await page.locator('.home-tutor-day').isHidden());
  await page.locator('#life-next-button').click();await page.locator('[data-life-begin]').click();while(await page.locator('[data-life-scene-next]').count())await page.locator('[data-life-scene-next]').click();
  await page.locator(`[data-life-choice=${l.questions[0].choices.find(c=>c.id!==l.questions[0].answerId).id}]`).click();await page.locator('[data-life-question-next]').click();
  await page.locator(`[data-life-choice=${l.questions[1].answerId}]`).click();await page.locator('[data-life-question-next]').click();await page.locator('[data-life-help]').click();await page.locator(`[data-life-choice=${l.questions[2].answerId}]`).click();await close();
  let v=await read();check(id+': actual day distinguishes independent, assisted and retry',v.home.days.today.independent.length===1&&v.home.days.today.together.length===1&&v.home.days.today.retry.length===1&&v.home.days.today.count===3);
  const target=v.home.recommendation.id,q=l.questions.find(q=>q.id===target),before=core(v.life.progress);
  await page.locator('.home-tutor-action').click();await page.locator(`[data-expression-choice=${q.review.choices.find(c=>c.id!==q.review.answerId).id}]`).click();
  check(id+': unsuccessful guided choice does not save completion',!(await read()).life.progress.daily.days[v.home.days.date].items[q.id].guidedAt);
  await page.locator(`[data-expression-choice=${q.review.answerId}]`).click();v=await read();
  check(id+': successful choice saves before return and preserves first answers/checkpoint',v.life.progress.daily.days[v.home.days.date].items[q.id].guidedAt>0&&core(v.life.progress)===before);
  await page.reload();await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.days.today.count===3);v=await read();
  check(id+': reload remembers guided success and skips its repeat recommendation',v.life.progress.daily.days[v.home.days.date].items[q.id].guidedAt>0&&v.home.recommendation.id!==q.id&&await page.locator('.life-expression-practice').count()===0);
  await page.locator('.home-tutor-day').click();check(id+': recap contains chosen tutor and factual categories',await page.locator('.home-day-tutor [data-tutor]').getAttribute('data-tutor')===id&&await page.locator('.home-day-group').count()===3);await fit(id+': recap taps and width','.home-day-recap');await shot(id+'-recap');
  await page.locator('.home-day-close').click();check(id+': recap cancellation does not finish day',!(await read()).home.days.today.closed);
  await page.locator('.home-tutor-day').click();await page.locator('.home-day-finish').click();v=await read();
  check(id+': finishing persists once and leaves learning intact',v.home.days.today.closed&&core(v.life.progress)===before&&await page.locator('.home-day-finish').isDisabled());await shot(id+'-finished');await page.locator('.home-day-close').click();
  await page.reload();await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.days.today.closed);check(id+': same-day return retains completion and offers reread',await page.locator('.home-tutor-day').textContent()==='오늘 기록 다시 보기');
  for(const size of [{width:320,height:568},{width:740,height:320}]){
   await page.setViewportSize(size);await page.waitForFunction(layout=>document.documentElement.dataset.layout===layout,size.width>size.height?'landscape':'portrait');await fit(id+`: home ${size.width}`,'#home-tutor');await page.locator('.home-tutor-day').click();
   const initialRecap=await page.locator('.home-day-recap').evaluate(el=>{const title=el.querySelector('#home-day-title'),r=title.getBoundingClientRect(),d=el.getBoundingClientRect();return {scrollTop:el.scrollTop,titleVisible:r.top>=Math.max(0,d.top)&&r.bottom<=Math.min(innerHeight,d.bottom),titleFocused:document.activeElement===title};});
   check(id+`: recap ${size.width} opens at the title instead of scrolling to the footer`,initialRecap.scrollTop===0&&initialRecap.titleVisible&&initialRecap.titleFocused,initialRecap);
   await fit(id+`: recap ${size.width}`,'.home-day-recap');await shot(id+'-recap-'+size.width);await page.locator('.home-day-close').click();
  }
  await page.setViewportSize({width:390,height:844});await offset(3);check(id+': several days later says last time, never yesterday',(await read()).home.recommendation.memory?.when==='지난번'&&!(await page.locator('#home-tutor .game-tutor-line').textContent()).includes('어제'));
  await offset(1);v=await read();check(id+': next day greets using the real prior guided expression',v.home.recommendation.kind==='recall'&&v.home.recommendation.memory.when==='어제'&&v.home.recommendation.title===l.expressions.find(e=>e.id===q.expressionId).korean&&v.home.days.today.count===0);await shot(id+'-next-day');
  await page.locator('.home-tutor-action').click();await page.locator('[data-life-review-start]').click();
  while(await page.locator('[data-life-choice]').count()){
   v=await read();const run=v.life.progress.activeReview,reviewId=run.ids[v.life.step],question=l.questions.find(q=>q.review.id===reviewId);
   assert.ok(question,'actual review maps to canonical question');await page.locator(`[data-life-choice=${question.review.answerId}]`).click();
   v=await read();check(id+': next-day review is independently graded '+question.id,v.life.progress.activeReview.answers[reviewId].helped===false&&v.life.tutor.kind==='success');
   await page.locator('[data-life-question-next]').click();
  }
  await close();v=await read();check(id+': next-day recap records actual independent success',v.home.days.today.independent.length===3&&!v.home.days.today.closed&&v.home.days.previous.closed);
  await page.locator('.home-tutor-day').click();await page.locator('.home-day-finish').click();await page.locator('.home-day-close').click();
  check(id+': the next-day review can be explicitly finished before another visit',(await read()).home.days.today.closed);
  await page.locator('[data-view=cafe]').click();await page.locator(`.cafe-visit-list [data-life-lesson=${cafe.id}]`).click();
  await page.locator('[data-life-cafe-mode=read]').click();await page.locator('[data-life-cafe-next]').click();
  const cafeQuestion=cafe.questions[0];await page.locator(`[data-life-cafe-choice=${cafeQuestion.choices.find(c=>c.id!==cafeQuestion.answerId).id}]`).click();
  v=await read();check(id+': new real cafe response reopens the finished day',!v.home.days.today.closed&&v.home.days.today.retry.some(item=>item.id===cafeQuestion.id)&&v.life.cafe.phase==='repair'&&v.life.tutor.tutor===id&&v.life.tutor.kind==='retry');
  const cafeCore=core(v.life.progress),cafeCheckpoint=JSON.stringify(v.life.cafe),cafeDay=v.home.days.date;
  await page.locator('[data-life-tutor-retry]').click();await page.locator('.life-expression-practice[open]').waitFor();
  check(id+': cafe practice uses its canonical changed situation',await page.locator('.life-expression-question h4').textContent()===cafeQuestion.review.prompt&&await page.locator('.life-expression-question>p').textContent()===cafeQuestion.review.context);
  await page.locator(`[data-expression-choice=${cafeQuestion.review.answerId}]`).click();v=await read();
  const savedCafe=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.life-korean.progress.v1:guest')));
  check(id+': cafe guided success is stored immediately before returning',savedCafe.daily.days[cafeDay].items[cafeQuestion.id].guidedAt>0&&savedCafe.daily.days[cafeDay].items[cafeQuestion.id].tutorId===id&&v.life.tutor.practice.correct&&await page.locator('.life-expression-return').isEnabled());
  check(id+': cafe guided saving preserves assessment and the physical checkpoint',core(v.life.progress)===cafeCore&&core(savedCafe)===cafeCore&&JSON.stringify(v.life.cafe)===cafeCheckpoint&&v.life.progress.lessons[cafe.id].answers[cafeQuestion.id].correct===false&&v.life.progress.lessons[cafe.id].completedAt===null);
  await shot(id+'-cafe-guided-saved');await page.locator('.life-expression-return').click();v=await read();
  check(id+': guided return resumes the same cafe repair with the chosen tutor',core(v.life.progress)===cafeCore&&JSON.stringify(v.life.cafe)===cafeCheckpoint&&v.life.tutor.kind==='practiceSuccess'&&v.life.tutor.tutor===id);
  await close();await page.reload();await page.waitForFunction(qid=>window.__synkHome?.homeTutor()?.days.today.together.some(item=>item.id===qid),cafeQuestion.id);v=await read();
  check(id+': cafe guided memory survives reload with the new day activity still open',!v.home.days.today.closed&&v.home.days.today.together.some(item=>item.id===cafeQuestion.id&&item.kind==='guided')&&core(v.life.progress)===cafeCore);
  await context.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank');await context.close();context=null;
 }
 check('no uncaught errors, missing assets or outside services',!errors.length&&!assets.length&&!external.length,{errors,assets,external});
})().catch(e=>{failure=e;console.error(e);process.exitCode=1;}).finally(async()=>{if(failure&&page&&!page.isClosed())await shot('failure').catch(()=>{});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:!failure,at:new Date().toISOString(),checks,errors,assets,external,...(failure?{failure:failure.stack}:{})},null,2));if(context){await context.unrouteAll({behavior:'ignoreErrors'});await context.close();}await browser?.close();});
