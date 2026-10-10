const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.join(__dirname,'cafe-complete-20261010'),entry='http://127.0.0.1:4313/mobile.html?opening=off&cafe=1';
const checks=[],errors=[],http=[],audioRequests=[];let browser,context,page,failure;
(async()=>{
 try{
  const {lessonById}=await import('../life-content.mjs');const bank=JSON.parse(fs.readFileSync(path.join(__dirname,'../../brand-opening/assets/cafe-voice/manifest.json')));
  browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});page=await context.newPage();page.setDefaultTimeout(15000);
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4313'?route.continue():route.abort());
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.status()!==401)http.push({url:r.url(),status:r.status()});if(r.url().includes('/cafe-voice/')&&r.url().endsWith('.mp3'))audioRequests.push({url:r.url(),status:r.status()});});
  const read=()=>page.evaluate(()=>window.__synkWorld.life()),next=()=>page.locator('[data-life-cafe-next]').click();
  for(const id of ['cafe-apply','cafe-visit-taste','cafe-visit-soldout','cafe-visit-change','cafe-compose']){
   await page.goto(entry);await page.waitForFunction(()=>window.__synkWorld?.life()?.speech.available);await page.locator(`.cafe-visit-list [data-life-lesson="${id}"]`).click();assert.equal(await page.locator('[data-life-cafe-mode=listen]').getAttribute('aria-pressed'),'true');await next();
   for(const [index,q]of lessonById(id).questions.entries()){
    if((await read()).cafe.phase==='break')await next();
    await page.locator('[data-life-cafe-speech]').click();await page.waitForFunction(()=>{const m=window.__synkWorld.life();return m.cafe.listen.heard&&m.speech.phase==='ended';});
    const heard=await read(),lineId=id+'-'+(index+1);assert.equal(heard.speech.lineId,lineId);assert.ok(heard.speech.currentTime>=bank.clips[lineId].durationSeconds-.1);
    checks.push({id:lineId,passed:true,actualPlaybackSeconds:heard.speech.currentTime,transcriptShown:heard.cafe.listen.textShown});console.log('PASS real complete playback '+lineId);
    if(q.kind==='compose'){for(const [field,value]of Object.entries(q.orderGoal))await page.locator(`[data-life-cafe-word="${field}"][data-cafe-value="${value}"]`).click();await page.locator('[data-life-cafe-submit]').click();}
    else await page.locator(`[data-life-cafe-choice=${q.answerId}]`).click();await next();
   }
   const complete=await read();assert.equal(complete.cafe.phase,'complete');for(const q of lessonById(id).questions){const answer=complete.progress.lessons[id].answers[q.id];assert.equal(answer.input.mode,'listen');assert.equal(answer.input.heard,true);assert.equal(answer.input.textShown,false);assert.equal(answer.helped,false);}
  }
  assert.equal(checks.length,15);assert.equal(new Set(audioRequests.map(r=>r.url)).size,15);assert.equal(Object.values((await read()).progress.lessons).filter(l=>l.completedAt!==null).length,5);assert.deepEqual(errors,[]);assert.deepEqual(http,[]);
 }catch(e){failure=e;console.error(e.stack);}
 finally{fs.writeFileSync(path.join(out,'all-questions-playback.json'),JSON.stringify({ok:!failure,checkedAt:new Date().toISOString(),checks,audioRequests,errors,http,...(failure?{failure:failure.stack}:{}),scope:{realAudioPlayback:true,allQuestions:true,realPhones:false,humanListening:false,published:false}},null,2)+'\n');if(context)await context.unrouteAll({behavior:'ignoreErrors'});if(page&&!page.isClosed())await page.goto('about:blank');await browser?.close();process.exitCode=failure?1:0;}
})();
