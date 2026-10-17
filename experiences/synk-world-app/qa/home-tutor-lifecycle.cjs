const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const base=process.env.SYNK_HOME_TUTOR_URL||'http://127.0.0.1:4314';
const out=path.join(__dirname,'home-tutor-20261011',process.env.SYNK_HOME_TUTOR_LIFECYCLE_RUN||'lifecycle');
const checks=[],errors=[];let browser,failure;
function check(name,passed,detail){checks.push({name,passed:!!passed,...(detail?{detail}:{})});console.log((passed?'PASS ':'FAIL ')+name);assert.ok(passed,name);}
async function setup(entries=[]){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});context.setDefaultTimeout(15000);
 await context.addInitScript(entries=>{
  for(const [key,value]of entries)if(localStorage.getItem(key)===null)localStorage.setItem(key,value);
  localStorage.setItem('synk.world.tutor.v1:guest',JSON.stringify({version:1,completed:true,tutor:'marin'}));
  // Observe native timers without changing time or making callbacks run early.
  window.__homeTutorTimers=new Map();const schedule=window.setTimeout,clear=window.clearTimeout;
  window.setTimeout=function(callback,delay,...args){const source=new Error().stack;let id;
   id=schedule(()=>{window.__homeTutorTimers.delete(id);callback(...args);},delay);
   if(source.includes('/life-tutor.mjs'))window.__homeTutorTimers.set(id,{delay,source:source.split('\n').slice(1,4)});return id;
  };
  window.clearTimeout=function(id){window.__homeTutorTimers.delete(id);return clear(id);};
 },entries);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/brand-opening/home.html?opening=off');
 await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind!=='loading'&&window.__synkLife);
 return {context,page};
}
const timers=page=>page.evaluate(()=>[...window.__homeTutorTimers.values()]);
const progress=page=>page.evaluate(()=>window.__synkLife.metrics().progress);
const core=value=>JSON.stringify({owner:value.owner,version:value.version,lessons:value.lessons,reviews:value.reviews,activeLessonId:value.activeLessonId,activeReview:value.activeReview});
async function release(context){await context.unrouteAll({behavior:'ignoreErrors'});await context.close();}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const {createLifeProgress}=await import(pathToFileURL(path.join(__dirname,'../life-progress.mjs')).href);
 const {PACKS,LESSONS}=await import(pathToFileURL(path.join(__dirname,'../life-content.mjs')).href);
 browser=await chromium.launch({channel:'msedge',headless:true});
 {
  const {context,page}=await setup();
  try{
   let pending=await timers(page);check('home starts with one tutor timer',pending.length===1,pending);
   await page.waitForTimeout(3000);pending=await timers(page);check('initial reaction settles into one idle timer',pending.length===1,pending);
   await page.locator('#settings-open').click();pending=await timers(page);check('opening settings cancels every home tutor timer',pending.length===0,pending);
   await page.locator('#reduce-motion').check();await page.locator('#panel-close').click();
   await page.waitForTimeout(3000);pending=await timers(page);check('manual reduced motion keeps idle timers stopped',pending.length===0,pending);
   // 움직임이 켜져 있으면 시트가 160ms 페이드로 닫힌 뒤(10-14 B안) 튜터가 다시 깨어난다 — 그만큼 기다린 뒤 센다.
   await page.locator('#settings-open').click();await page.locator('#reduce-motion').uncheck();await page.locator('#panel-close').click();await page.waitForTimeout(400);
   pending=await timers(page);check('turning motion back on starts one idle timer',pending.length===1,pending);
   for(let index=0;index<3;index++){await page.locator('#settings-open').click();await page.locator('#panel-close').click();}
   await page.waitForTimeout(400);pending=await timers(page);check('repeated home activation never accumulates timers',pending.length===1,pending);
  }finally{await release(context);}
 }
 const lesson=LESSONS.find(l=>l.id==='greetings-expressions'),question=lesson.questions[0];
 function seed(){const values=new Map(),p=createLifeProgress({owner:'guest',storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},now:()=>Date.now()-120000,uuid:()=> 'home-lifecycle-attempt'});
  p.summary(PACKS,LESSONS);p.startLesson(lesson);p.recordAnswer({lessonId:lesson.id,questionId:question.id,correct:false,choiceId:question.choices.find(c=>c.id!==question.answerId).id});return [...values];}
 for(const reload of [false,true]){
  const label=reload?'after reload':'same visit',{context,page}=await setup(seed());
  try{
   const before=await progress(page);check(label+': due expression has no review session before guided practice',before.activeReview===null);
   await page.locator('.home-tutor-action').click();await page.locator('.life-expression-practice[open]').waitFor();
   const prepared=await progress(page);
   check(label+': guide reserves its due transfer with persisted assistance',prepared.activeReview.ids[0]===question.review.id&&prepared.activeReview.pendingHelp[question.review.id]===true);
   check(label+': preparing a guide preserves first answers and review appointments',JSON.stringify(prepared.lessons)===JSON.stringify(before.lessons)&&JSON.stringify(prepared.reviews)===JSON.stringify(before.reviews));
   await page.locator(`[data-expression-choice="${question.review.answerId}"]`).click();await page.locator('.life-expression-return').click();
   const guided=await progress(page),entry=Object.values(guided.daily?.days||{}).map(day=>day.items[question.id]).find(item=>item?.guidedAt);
   check(label+': guided completion persists without altering the prepared answers or review session',core(guided)===core(prepared)&&entry?.tutorId==='marin'&&entry.lessonId===lesson.id&&entry.outcome==='retry');
   let pending=await timers(page);check(label+': returning after guided success has at most one home timer',pending.length<=1,pending);
   if(reload){await page.reload();await page.waitForFunction(()=>window.__synkLife&&window.__synkHome?.homeTutor()?.recommendation.kind!=='loading');check(label+': reload preserves guided success and the entire prepared review',JSON.stringify(await progress(page))===JSON.stringify(guided));}
   await page.locator('[data-view="review"]').click();
   await page.locator('[data-life-review-start]').click();await page.locator(`#panel-content [data-life-choice="${question.review.answerId}"]`).click();
   const after=await progress(page),answer=after.activeReview.answers[question.review.id],record=after.reviews[question.review.id];
   check(label+': same transfer stays assisted and cannot extend the review interval',answer.correct&&answer.helped&&record.streak===0&&record.intervalDays===0&&record.dueAt-answer.at===60000,{answer,streak:record.streak,intervalDays:record.intervalDays});
   check(label+': original lesson error remains intact',JSON.stringify(after.lessons)===JSON.stringify(before.lessons));
  }finally{await release(context);}
 }
 check('no browser JavaScript errors',errors.length===0,errors);
})().catch(error=>{failure=error.stack||String(error);console.error(failure);process.exitCode=1;}).finally(async()=>{
 await browser?.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),base,checks,errors,failure:failure||null},null,2));
});
