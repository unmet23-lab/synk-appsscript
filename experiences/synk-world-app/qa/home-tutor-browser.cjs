const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const base=process.env.SYNK_HOME_TUTOR_URL||'http://127.0.0.1:4314';
const out=path.join(__dirname,'home-tutor-20261011',process.env.SYNK_HOME_TUTOR_RUN||'source');fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],assets=[],external=[];let browser,page,context,failure;
const check=(name,value,detail)=>{checks.push({name,passed:!!value,...(detail?{detail}:{})});console.log((value?'PASS ':'FAIL ')+name);assert.ok(value,name);};
const home=()=>page.evaluate(()=>window.__synkHome.homeTutor());
const progress=()=>page.evaluate(()=>window.__synkWorld.life().progress);
const core=value=>JSON.stringify({owner:value.owner,version:value.version,lessons:value.lessons,reviews:value.reviews,activeLessonId:value.activeLessonId,activeReview:value.activeReview});
const guided=(value,question,tutor)=>Object.entries(value.daily?.days||{}).some(([date,day])=>{const item=day.items[question.id];return item?.lessonId===question.lessonId&&item.tutorId===tutor&&item.guidedAt>0&&new Date(item.guidedAt+9*3600000).toISOString().slice(0,10)===date;});
const close=()=>page.locator('#panel-close').click();
async function shot(name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await page.screenshot({path:path.join(out,name+'.png')});}
async function fit(name,selector){const size=await page.locator(selector).evaluate(el=>({overflow:el.scrollWidth-el.clientWidth,small:[...el.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0).filter(b=>b.getBoundingClientRect().height<44||b.getBoundingClientRect().width<44).length}));check(name,size.overflow<=1&&!size.small,size);}
(async()=>{
 const {lessonById}=await import(pathToFileURL(path.join(__dirname,'../life-content.mjs')).href);
 const greeting=lessonById('greetings-expressions'),cafe=lessonById('cafe-visit-soldout');
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const id of ['marin','kkamong','mongle']){
  context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});context.setDefaultTimeout(15000);
  await context.addInitScript(()=>{const real=Date.now;window.__homeClock=0;Date.now=()=>real()+window.__homeClock;});
  await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith(base+'/')||/^(blob|data):/.test(u))return route.continue();external.push(u);return route.abort();});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/'))assets.push({path:new URL(r.url()).pathname,status:r.status()});});
  await page.goto(base+'/mobile.html?opening=off');await page.waitForFunction(()=>window.__synkWorld?.life()?.owner==='guest');
  check(id+': first home invites a tutor without inventing history',await page.locator('.home-tutor-choose').count()===1);
  await page.locator('.home-tutor-choose').click();await page.locator(`[data-tutor-id=${id}]`).click();await page.locator('[data-tutor-action=confirm]').click();await page.locator('[data-tutor-action=finish]').click();
  await page.waitForFunction(()=>window.__synkHome.homeTutor().recommendation.kind==='start');
  check(id+': chosen tutor greets from real next lesson',(await home()).tutor===id&&await page.locator('#home-tutor .game-tutor-line').textContent().then(s=>s.includes(greeting.title)));
  await shot(id+'-welcome');await page.locator('.home-tutor-action').click();await page.locator('[data-life-begin]').click();
  while(await page.locator('[data-life-scene-next]').count())await page.locator('[data-life-scene-next]').click();
  const q=greeting.questions[0];await page.locator(`[data-life-choice=${q.choices.find(c=>c.id!==q.answerId).id}]`).click();await close();
  let before=await progress();check(id+': first mistake becomes a specific home recommendation',(await home()).recommendation.id===q.id&&(await home()).recommendation.kind==='difficult');
  await page.reload();await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind==='difficult');
  check(id+': reload restores selected tutor and confusion',(await home()).tutor===id&&(await home()).recommendation.id===q.id&&JSON.stringify(await progress())===JSON.stringify(before));
  await page.locator('.home-tutor-action').click();await page.locator('.life-expression-practice[open]').waitFor();
  check(id+': home practice opens actual transfer and keeps world panel closed',await page.locator('.life-expression-question h4').textContent()===q.review.prompt&&!await page.locator('#world-panel').evaluate(el=>el.open));
  await page.locator('.life-expression-cancel').click();check(id+': cancel preserves checkpoint and first response',JSON.stringify(await progress())===JSON.stringify(before));
  await page.locator('.home-tutor-action').click();await page.locator(`[data-expression-choice=${q.review.choices.find(c=>c.id!==q.review.answerId).id}]`).click();
  check(id+': wrong practice uses chosen tutor face',await page.locator('.life-expression-practice').getAttribute('data-face')===(id==='marin'?'집중':'민망'));
  await page.locator(`[data-expression-choice=${q.review.answerId}]`).click();await shot(id+'-practice-success');await page.locator('.life-expression-return').click();
  check(id+': home celebrates and moves past this session practice',(await home()).completed===q.id&&(await home()).companion.kind==='practiceSuccess'&&(await home()).recommendation.kind==='resume');
  const completed=await progress();check(id+': practice records guided success without grading or rescheduling learning',core(completed)===core(before)&&guided(completed,{...q,lessonId:greeting.id},id));await shot(id+'-home-success');
  // A paused scheduled review of the same transfer must remember assistance.
  await page.evaluate(()=>window.__homeClock=120000);await page.locator('[data-view=review]').click();await page.locator('[data-life-review-start]').click();await close();
  const paused=await progress();await page.reload();await page.waitForFunction(()=>window.__synkWorld?.life()?.owner==='guest'&&window.__synkHome?.homeTutor()?.recommendation.kind!=='loading');await page.evaluate(()=>window.__homeClock=120000);
  const assisted=await progress();check(id+': reload retains guided success and suppresses the same home recommendation',(await home()).recommendation.id!==q.id&&guided(assisted,{...q,lessonId:greeting.id},id)&&JSON.stringify(assisted)===JSON.stringify(paused));
  check(id+': pending scheduled review marks help without changing first answer or schedule',assisted.activeReview.pendingHelp[q.review.id]===true&&JSON.stringify(assisted.lessons)===JSON.stringify(before.lessons)&&JSON.stringify(assisted.reviews)===JSON.stringify(before.reviews));
  await page.locator('[data-view=review]').click();await page.locator('[data-life-review-start]').click();await page.locator(`[data-life-choice=${q.review.answerId}]`).click();
  check(id+': returning scheduled answer is assisted',(await progress()).activeReview.answers[q.review.id].helped===true);await close();
  // A distinct cafe mistake is recommended by its exact expression and retains repair state.
  await page.locator('[data-view=cafe]').click();await page.locator('.cafe-visit-list [data-life-lesson=cafe-visit-soldout]').click();await page.locator('[data-life-cafe-mode=read]').click();await page.locator('[data-life-cafe-next]').click();
  const cq=cafe.questions[0];await page.locator(`[data-life-cafe-choice=${cq.choices.find(c=>c.id!==cq.answerId).id}]`).click();await close();before=await progress();
  check(id+': recent cafe difficulty guides today practice',(await home()).recommendation.id===cq.id);
  await shot(id+'-cafe-memory');await page.locator('.home-tutor-action').click();await page.locator(`[data-expression-choice=${cq.review.answerId}]`).click();await page.locator('.life-expression-return').click();
  const cafeGuided=await progress();check(id+': cafe repair, first error and pickup stage retained alongside guided record',core(cafeGuided)===core(before)&&guided(cafeGuided,{...cq,lessonId:cafe.id},id));
  await page.locator('#life-next-button').click();check(id+': resume returns to cafe repair',await page.evaluate(()=>window.__synkWorld.life().cafe.phase==='repair'));await close();
  for(const size of [{width:320,height:568},{width:740,height:320},{width:390,height:844}]){
   await page.setViewportSize(size);await page.waitForFunction(layout=>document.documentElement.dataset.layout===layout,size.width>size.height?'landscape':'portrait');await fit(id+`: home fits ${size.width}x${size.height}`,'#home-tutor');await shot(id+`-home-${size.width}`);
   const boxes=await page.evaluate(()=>{const a=document.querySelector('#home-tutor').getBoundingClientRect(),b=document.querySelector('.world-topbar').getBoundingClientRect(),n=document.querySelector('.world-nav').getBoundingClientRect();return {a:{x:a.x,y:a.y,right:a.right,bottom:a.bottom},topBottom:b.bottom,navTop:n.top,overlap:Math.min(a.right,n.right)>Math.max(a.left,n.left)&&Math.min(a.bottom,n.bottom)>Math.max(a.top,n.top)};});
   check(id+`: tutor avoids top and nav ${size.width}`,boxes.a.y>=boxes.topBottom-1&&!boxes.overlap,boxes);
  }
  await context.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank');await context.close();context=null;
 }
 check('no page errors, missing assets or external calls',!errors.length&&!assets.length&&!external.length,{errors,assets,external});
})().catch(e=>{failure=e;console.error(e);process.exitCode=1;}).finally(async()=>{if(failure&&page&&!page.isClosed())await shot('failure').catch(()=>{});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:!failure,at:new Date().toISOString(),checks,errors,assets,external,...(failure?{failure:failure.stack}:{})},null,2));if(context){await context.unrouteAll({behavior:'ignoreErrors'});await context.close();}await browser?.close();});
