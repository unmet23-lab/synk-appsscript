const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const base=process.env.SYNK_LIFE_TUTOR_URL||'http://127.0.0.1:4314';
const output=path.join(__dirname,'life-tutor-20261011',process.env.SYNK_LIFE_TUTOR_RUN||'source');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],httpErrors=[],external=[],images=[];let browser,page,lessons;
const check=(name,passed,detail)=>{checks.push({name,passed:!!passed,...(detail?{detail}:{})});console.log((passed?'PASS ':'FAIL ')+name);assert.ok(passed,name);};
const read=()=>page.evaluate(()=>window.__synkWorld?.life?.()||window.__synkLife.metrics());
const core=p=>JSON.stringify({lessons:p.lessons,reviews:p.reviews,activeLessonId:p.activeLessonId,activeReview:p.activeReview});
const lesson=id=>lessons.find(l=>l.id===id);
const close=async()=>{await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel').open);};
async function chooseTutor(id){await page.locator(`[data-tutor-id=${id}]`).click();await page.locator('[data-tutor-action=confirm]').click();await page.locator('[data-tutor-action=finish]').click();}
async function setup(id){
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});ctx.setDefaultTimeout(15000);
 await ctx.addInitScript(()=>{const real=Date.now;window.__lifeClock=0;Date.now=()=>real()+window.__lifeClock;window.__lifeClips=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!window.__lifeClips.includes(this))window.__lifeClips.push(this);return play.call(this);};});
 await ctx.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base+'/')||/^(blob|data):/.test(url))return route.continue();external.push(url);return route.abort();});
 page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))httpErrors.push({url:r.url(),status:r.status()});});
 await page.goto(base+'/mobile.html?opening=off&tutor=choose');await page.waitForFunction(()=>window.__synkWorld&&window.__synkHome);await chooseTutor(id);return ctx;
}
async function shot(name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});const file=path.join(output,name+'.png');await page.screenshot({path:file});images.push(file);}
async function voice(id){await page.locator('[data-life-cafe-speech]').click();await page.waitForFunction(()=>window.__synkWorld.life().speech.phase==='playing');check(id+': chosen tutor stays quiet during staff audio',!(await read()).tutor.reactionAudioPlaying&&(await read()).tutor.kind==='listen');await page.waitForFunction(()=>window.__synkWorld.life().cafe.listen.heard&&window.__synkWorld.life().speech.phase==='ended');}
async function fit(label,selector){const value=await page.locator(selector).evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,small:[...el.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0).filter(b=>b.getBoundingClientRect().height<44||b.getBoundingClientRect().width<44).length}));check(label+': readable without horizontal overflow and all taps >=44px',value.overflow<=1&&value.small===0,value);}
async function guided(id,{cancel=false}={}){
 const before=await read();await page.locator('[data-life-tutor-retry]').click();await page.locator('.life-expression-practice[open]').waitFor();
 const q=lesson(before.lessonId).questions.find(q=>q.id===id||q.review.id===id),exercise=q.review;
 check(id+': guided practice shows its actual new situation',await page.locator('.life-expression-question h4').textContent()===exercise.prompt&&await page.locator('.life-expression-question>p').textContent()===exercise.context);
 await fit(id,'.life-expression-practice');
 if(cancel){await page.locator('.life-expression-cancel').click();check(id+': cancelling retains the same stage and records',JSON.stringify((await read()).progress)===JSON.stringify(before.progress));return;}
 const wrong=exercise.choices.find(c=>c.id!==exercise.answerId);await page.locator(`[data-expression-choice=${wrong.id}]`).click();
 check(id+': wrong guided response keeps choices available and uses tutor expression',(await read()).tutor.practice.correct===false&&await page.locator('.life-expression-return').isDisabled()&&await page.locator('.life-expression-practice').getAttribute('data-face')===(before.tutor.tutor==='marin'?'집중':'민망'));
 await page.locator(`[data-expression-choice=${exercise.answerId}]`).click();check(id+': guided success enables return',(await read()).tutor.practice.correct&&await page.locator('.life-expression-return').isEnabled());
 await shot(before.tutor.tutor+'-'+id+'-guided');await page.locator('.life-expression-return').click();
 const after=await read();check(id+': success returns to the exact same real item without changing first responses or review spacing',core(before.progress)===core(after.progress)&&before.step===after.step&&JSON.stringify(before.cafe)===JSON.stringify(after.cafe)&&after.tutor.kind==='practiceSuccess');
 check(id+': guided success persists in the daily record',Object.values(after.progress.daily.days).some(day=>day.items[q.id]?.guidedAt>0));
}
async function lifeFlow(id){
 await page.locator('[data-life-library],[data-life-packs]').first().click();await page.locator('[data-life-pack=greetings]').click();await page.locator('[data-life-lesson=greetings-expressions]').click();
 check(id+': life intro uses the selected AI tutor',(await read()).tutor.tutor===id&&await page.locator('.life-tutor').count()===1);await page.locator('[data-life-begin]').click();
 while(await page.locator('[data-life-scene-next]').count())await page.locator('[data-life-scene-next]').click();
 const l=lesson('greetings-expressions'),q=l.questions[0],wrong=q.choices.find(c=>c.id!==q.answerId);
 await page.locator(`[data-life-choice=${wrong.id}]`).click();
 check(id+': real wrong answer triggers its own hint and face',(await read()).tutor.kind==='retry'&&(await read()).tutor.face===(id==='marin'?'집중':'민망'));
 await shot(id+'-life-hint');await guided(q.id);
 await page.locator('.life-tutor-help').click();check(id+': difficult expression appears in tutor help',await page.locator(`[data-life-expression=${q.id}]`).count()===2);await page.locator('.life-tutor-resume').click();
 await page.locator('[data-life-question-next]').click();await page.locator('.life-tutor-help').click();await page.locator('.life-tutor-hint').click();await page.locator(`[data-life-choice=${l.questions[1].answerId}]`).click();
 check(id+': tutor hint is retained as assistance rather than independent success',(await read()).progress.lessons[l.id].answers[l.questions[1].id].helped&&(await read()).tutor.kind==='assisted');
 await page.locator('[data-life-question-next]').click();await page.locator(`[data-life-choice=${l.questions[2].answerId}]`).click();check(id+': correct first answer celebrates with the selected tutor',(await read()).tutor.kind==='success'&&(await read()).tutor.face===(id==='marin'?'눈웃음':id==='kkamong'?'으쓱':'기쁨'));
 await page.locator('[data-life-question-next]').click();check(id+': completion keeps the original first error and tutor',(await read()).progress.lessons[l.id].completedAt!==null&&!(await read()).progress.lessons[l.id].answers[q.id].correct&&(await read()).tutor.tutor===id);
 await page.locator('#panel-content [data-life-review]').click();check(id+': guided success did not pull the scheduled review forward',await page.locator('[data-life-review-start]').count()===0);await close();
 await page.evaluate(()=>window.__lifeClock=70000);await page.locator('[data-view=review]').click();await page.locator('[data-life-review-start]').click();
 check(id+': scheduled transfer review keeps its chosen tutor',(await read()).phase==='review'&&(await read()).tutor.tutor===id);
 const state=await read(),record=state.progress.reviews[Object.keys(state.progress.activeReview.answers).length?null:state.progress.activeReview.ids[0]],original=lesson(record.lessonId).questions.find(q=>q.id===record.questionId);
 await page.locator(`[data-life-choice=${original.review.choices.find(c=>c.id!==original.review.answerId).id}]`).click();await guided(original.review.id);
 check(id+': scheduled first error remains an error after tutor rehearsal',!(await read()).progress.activeReview.answers[record.id].correct);await close();
}
async function cafeFlow(id){
 await page.locator('[data-view=cafe]').click();await page.waitForFunction(()=>window.__synkWorld.life().speech.available);const cid=id==='mongle'?'cafe-compose':id==='kkamong'?'cafe-visit-taste':'cafe-apply';await page.locator(`[data-life-lesson=${cid}]`).first().click();
 check(id+': cafe welcome uses the same selected tutor',(await read()).tutor.tutor===id&&(await read()).tutor.scope==='cafe');
 await page.locator('.life-tutor-help').click();await page.locator('.life-tutor-sound').click();await page.locator('.life-tutor-resume').click();
 await page.locator('[data-life-cafe-mode=listen]').click();await page.locator('[data-life-cafe-next]').click();
 check(id+': first cafe choices wait for staff recording',id==='mongle'?await page.locator('[data-life-cafe-submit]').isDisabled():await page.locator('[data-life-cafe-choice]').first().isDisabled());
 await voice(cid);
 const l=lesson(cid),first=l.questions[0];
 if(cid==='cafe-compose'){for(const [field,value]of [['drink','juice'],['temperature','cold'],['count',1]])await page.locator(`[data-life-cafe-word="${field}"][data-cafe-value="${value}"]`).click();await page.locator('[data-life-cafe-submit]').click();}
 else await page.locator(`[data-life-cafe-choice=${first.choices.find(c=>c.id!==first.answerId).id}]`).click();
 check(id+': real order repair triggers a tutor hint without receiving drinks',(await read()).cafe.phase==='repair'&&(await read()).tutor.kind==='retry');await shot(id+'-cafe-repair');await guided(first.id,{cancel:id==='kkamong'});if(id==='kkamong')await guided(first.id);
 if(cid==='cafe-compose'){for(const [field,value]of [['drink','tea'],['temperature','warm'],['count',2]])await page.locator(`[data-life-cafe-word="${field}"][data-cafe-value="${value}"]`).click();await page.locator('[data-life-cafe-submit]').click();}
 else await page.locator(`[data-life-cafe-choice=${first.answerId}]`).click();
 check(id+': corrected real order preserves the original wrong response',(await read()).cafe.phase==='response'&&!(await read()).progress.lessons[cid].answers[first.id].correct);
 await page.locator('[data-life-cafe-next]').click();await page.locator('.life-tutor-help').click();await page.locator('.life-tutor-hint').click();
 await page.locator(`[data-life-cafe-choice=${l.questions[1].answerId}]`).click();check(id+': tutor text help keeps truthful unheard/assisted evidence',(await read()).progress.lessons[cid].answers[l.questions[1].id].helped&&(await read()).progress.lessons[cid].answers[l.questions[1].id].input.textShown&&!(await read()).progress.lessons[cid].answers[l.questions[1].id].input.heard);
 await page.locator('[data-life-cafe-next]').click();if((await read()).cafe.phase==='break')await page.locator('[data-life-cafe-next]').click();await voice(cid+'-last');await page.locator(`[data-life-cafe-choice=${l.questions[2].answerId}]`).click();
 check(id+': cafe completion still waits for pickup',(await read()).progress.lessons[cid].completedAt===null&&(await read()).cafe.phase==='response');await page.locator('[data-life-cafe-next]').click();
 check(id+': cups received completes the real cafe with its tutor',(await read()).progress.lessons[cid].completedAt!==null&&(await read()).tutor.kind==='complete');await close();
 await page.locator('[data-view=cafe]').click();await page.locator('.life-tutor-help').click();
 check(id+': cafe helper lists cafe difficulties without unrelated greetings',await page.locator('.life-tutor-difficulties [data-life-expression]').count()===2&&!await page.locator('.life-tutor-difficulties [data-life-expression^=greetings]').count());
 await page.setViewportSize({width:320,height:568});await fit(id+' 320px helper','.life-tutor-guide');await shot(id+'-cafe-help-320');await page.setViewportSize({width:740,height:320});await fit(id+' landscape helper','.life-tutor-guide');await page.locator('.life-tutor-resume').click();await fit(id+' landscape cafe','#world-panel');
 await close();check(id+': closing releases tutor and all staff playback',!(await read()).tutor&&(await read()).speech.phase==='idle'&&!await page.locator('.life-tutor,.life-tutor-guide,.life-expression-practice').count());
}
(async()=>{let failure;try{
 lessons=(await import(pathToFileURL(path.join(__dirname,'../life-content.mjs')).href)).LESSONS;browser=await chromium.launch({channel:'msedge',headless:true});
 for(const id of ['marin','kkamong','mongle']){const ctx=await setup(id);await lifeFlow(id);await cafeFlow(id);await ctx.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank');await ctx.close();}
 check('no uncaught errors, missing assets or outside services',!errors.length&&!httpErrors.length&&!external.length,{errors,httpErrors,external});
 }catch(e){failure=e;console.error(e.stack);if(page&&!page.isClosed())await shot('failure').catch(()=>{});}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({ok:!failure,at:new Date().toISOString(),base,passed:checks.filter(c=>c.passed).length,checks,errors,httpErrors,external,images,...(failure?{failure:failure.stack}:{})},null,2)+'\n');if(page&&!page.isClosed()){await page.context().unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank').catch(()=>{});}await browser?.close();process.exitCode=failure?1:0;}})();
