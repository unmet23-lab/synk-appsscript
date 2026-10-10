const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.SYNK_CAFE_VISITS_URL||'http://127.0.0.1:4313',entry=process.env.SYNK_CAFE_VISITS_ENTRY||base+'/mobile.html?opening=off&cafe=1';
const out=path.join(__dirname,'cafe-visits-20261010',process.env.SYNK_CAFE_VISITS_RUN||'source-r1');
const origin=new URL(base).origin,checks=[],errors=[],httpErrors=[],external=[],images=[];fs.mkdirSync(out,{recursive:true});
let browser,ctx,page,LESSONS;
const check=(name,condition,detail)=>{checks.push({name,passed:!!condition,...(detail?{detail}: {})});console.log(`${condition?'PASS':'FAIL'} ${name}`);assert.ok(condition,name);};
const read=()=>page.evaluate(()=>window.__synkWorld?.life?.()||window.__synkLife?.metrics());
const next=async()=>{if(await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count())await page.locator('[data-life-cafe-mode=read]').click();await page.locator('[data-life-cafe-next]').click();},choose=id=>page.locator(`[data-life-cafe-choice=${id}]`).click();
async function tutor(){await page.waitForFunction(()=>document.querySelector('[data-tutor-id=mongle]')||document.querySelector('.cafe-welcome'));if(await page.locator('[data-tutor-id=mongle]').count()){await page.locator('[data-tutor-id=mongle]').click();await page.locator('[data-tutor-action=confirm]').click();await page.locator('[data-tutor-action=finish]').click();}}
async function settle(){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await Promise.all(document.querySelector('#world-panel').getAnimations().map(a=>a.finished.catch(()=>{})));const bg=document.querySelector('.cafe-drink');if(bg){const url=getComputedStyle(bg).backgroundImage.match(/url\("?([^"\)]+)/)?.[1];if(url){const img=new Image();img.src=url;await img.decode().catch(()=>{});}}});}
async function snap(name){await settle();const file=path.join(out,name+'.png');await page.screenshot({path:file});images.push(file);}
async function fit(name){
 await settle();const result=await page.evaluate(()=>{
  const p=document.querySelector('#world-panel'),r=p.getBoundingClientRect(),button=p.querySelector('[data-life-cafe-next]');
  return {viewport:[innerWidth,innerHeight],panel:[r.x,r.y,r.width,r.height],overflow:p.scrollWidth>p.clientWidth+2,
   short:[...p.querySelectorAll('button')].filter(b=>b.offsetWidth>0).filter(b=>b.offsetHeight<44||b.offsetWidth<44).map(b=>b.textContent.trim()),
   clippedCups:[...p.querySelectorAll('.cafe-tray .cafe-drink')].filter(cup=>{const c=cup.getBoundingClientRect(),s=cup.closest('.cafe-scene').getBoundingClientRect();return c.x<s.x-1||c.right>s.right+1||c.y<s.y-1||c.bottom>s.bottom+1;}).length,
   actionHit:button?(()=>{const r=button.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===button;})():true};
 });check(name+' fits with full cups, 44px controls and reachable main action',result.panel[0]>=-1&&result.panel[1]>=-1&&result.panel[0]+result.panel[2]<=result.viewport[0]+1&&result.panel[1]+result.panel[3]<=result.viewport[1]+1&&!result.overflow&&!result.short.length&&!result.clippedCups&&result.actionHit,result);
}
async function rotate(w,h){const before=await read(),id=before.lessonId;await page.setViewportSize({width:w,height:h});await page.waitForFunction(mode=>document.documentElement.dataset.layout===mode,w>h?'landscape':'portrait');const after=await read();check(`${id} ${w}x${h} keeps visit and attempt`,JSON.stringify(before.cafe)===JSON.stringify(after.cafe)&&before.progress.lessons[id].attemptId===after.progress.lessons[id].attemptId);await fit(`${id} ${w}x${h}`);}
async function resume(id){const before=await read();await page.reload();await page.waitForSelector('.cafe-pack-preview');await page.locator(`.cafe-pack-preview [data-life-lesson="${id}"]`).click();const after=await read();check(id+' reload restores the exact checkpoint',JSON.stringify(before.cafe)===JSON.stringify(after.cafe)&&before.progress.lessons[id].attemptId===after.progress.lessons[id].attemptId);}
async function run(){
 ({LESSONS}=await import('../life-content.mjs'));browser=await chromium.launch({channel:'msedge',headless:true});ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});page=await ctx.newPage();page.setDefaultTimeout(20000);
 await ctx.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}return route.continue();});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!(r.status()===401&&new URL(r.url()).pathname==='/api/world/bootstrap'))httpErrors.push({url:r.url(),status:r.status()});});
 await page.goto(entry);await page.waitForSelector('.cafe-pack-preview');check('cafe library exposes all four visits',await page.locator('.cafe-visit-card').count()===5);await snap('library-390');
 await page.locator('.cafe-pack-preview [data-life-lesson=cafe-apply]').click();await page.locator('#panel-close').click();await page.reload();await page.waitForSelector('.cafe-pack-preview');
 await page.locator('.cafe-visit-list [data-life-lesson=cafe-visit-taste]').click();await page.reload();await page.waitForSelector('.cafe-pack-preview');
 check('two unfinished visits resume the most recently opened one',await page.locator('.cafe-pack-preview [data-life-lesson=cafe-visit-taste]').count()===1);
 await page.locator('.cafe-visit-list [data-life-lesson=cafe-apply]').click();await next();await choose('b');await next();await choose('c');await next();await next();await choose('a');await next();
 check('the original visit still completes',((await read()).progress.lessons['cafe-apply'].completedAt!==null));await page.locator('[data-life-home]').click();
 check('home proposes taste story before the untouched greeting pack',await page.locator('#life-next-title').textContent()==='까몽의 따뜻한 한 잔');await snap('home-next-390');
 await page.locator('#life-next-button').click();await tutor();
 for(const id of ['cafe-visit-taste','cafe-visit-soldout','cafe-visit-change']){
  const l=LESSONS.find(l=>l.id===id);check(id+' opens the next playable story',(await read()).lessonId===id);await fit(id+' welcome portrait');await snap(id+'-welcome');await next();
  const wrong=l.questions[0].choices.find(c=>c.id!==l.questions[0].answerId).id;await choose(wrong);check(id+' allows repair without advancing',(await read()).cafe.phase==='repair'&&await page.locator('[data-life-cafe-next]').isDisabled());
  if(id==='cafe-visit-soldout')check('sold out juice creates zero cups',await page.locator('[data-cafe-drink=empty][data-cafe-count="0"]').count()===1);
  if(id==='cafe-visit-change')check('unchanged juice order is still two warm juice cups',await page.locator('[data-cafe-drink=warm][data-cafe-count="2"]').count()===1);
  await rotate(844,390);await snap(id+'-repair-landscape');await resume(id);await choose(l.questions[0].answerId);await next();
  if(id==='cafe-visit-taste'){await page.locator('[data-life-cafe-help]').click();await resume(id);check('new visit help persists before a response',await page.locator('[data-life-cafe-help]').getAttribute('aria-expanded')==='true');}
  await choose(l.questions[1].answerId);
  if(id==='cafe-visit-change')check('adding one cup changes two to three',await page.locator('[data-cafe-drink=tea][data-cafe-count="3"]').count()===1);
  await next();await choose(l.questions[2].answerId);if(id==='cafe-visit-taste')await page.locator('[data-life-cafe-seat=garden]').click();
  await rotate(320,740);await snap(id+'-ready-320');await rotate(740,320);await snap(id+'-ready-landscape');
  let value=await read();check(id+' waits for pickup after all three responses',Object.keys(value.progress.lessons[id].answers).length===3&&value.progress.lessons[id].completedAt===null&&await page.locator('[data-cafe-received=false]').count()===1);await resume(id);await next();value=await read();
  check(id+' finishes on pickup and retains its first error',value.cafe.phase==='complete'&&value.progress.lessons[id].completedAt!==null&&!value.progress.lessons[id].answers[l.questions[0].id].correct);await rotate(390,844);await snap(id+'-complete-390');
  if(id!=='cafe-visit-change'){const expected=id==='cafe-visit-taste'?'주스가 없는 날':'까몽의 마음이 바뀌었어요';await page.locator('[data-life-home]').click();check('home naturally advances to '+expected,await page.locator('#life-next-title').textContent()===expected);await page.locator('#life-next-button').click();}
 }
 check('four independent visits are completed exactly once',Object.values((await read()).progress.lessons).filter(l=>l.completedAt!==null).length===4);
 await page.locator('[data-life-home]').click();await page.clock.setFixedTime(Date.now()+65000);await page.locator('[data-view=review]').click();await page.locator('[data-life-review-start]').click();let count=0;
 const questions=Object.fromEntries(LESSONS.flatMap(l=>l.questions).map(q=>[q.review.id,q.review]));while(await page.locator('[data-life-choice]').count()){const id=await page.locator('[data-life-review-id]').getAttribute('data-life-review-id');check('new cafe expression returns in a transfer scene: '+id,id.startsWith('cafe-visit-')&&!!questions[id]);await page.locator(`[data-life-choice=${questions[id].answerId}]`).click();await page.locator('[data-life-question-next]').click();if(++count>6)throw Error('Review did not finish');}
 check('all four difficult or helped expressions are reviewed',count===4);await page.locator('[data-life-home]').click();await page.locator('[data-view=stories]').click();check('three new cafe stories are discoverable in the story library',await page.locator('[data-life-lesson^=cafe-visit-]').count()===3);
 check('no JavaScript, HTTP or external request errors',!errors.length&&!httpErrors.length&&!external.length,{errors,httpErrors,external});
}
(async()=>{let failure;try{await run();}catch(e){failure=e;console.error(e.stack);if(page)await snap('failure').catch(()=>{});}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:!failure,checkedAt:new Date().toISOString(),base,entry,checks,passed:checks.filter(c=>c.passed).length,errors,httpErrors,external,images,...(failure?{failure:failure.stack}:{}),scope:{local:true,guest:true,reviewClockAdvanced:true,realPhones:false,published:false}},null,2)+'\n');await ctx?.close();await browser?.close();process.exitCode=failure?1:0;}})();
