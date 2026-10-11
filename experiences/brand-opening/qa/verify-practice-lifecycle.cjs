const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {finishPractice}=require('./practice-browser-helpers.cjs');
const base=process.env.SYNK_TUTOR_QA_URL||'http://127.0.0.1:4314',output=path.join(__dirname,'tutor-practice-20261010');
const checks=[],errors=[];let browser,page;
function check(name,pass,detail){checks.push({name,pass:!!pass,...(detail?{detail}:{})});console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,name);}
async function choose(id){await page.locator(`[data-tutor-id="${id}"]`).click();await page.locator('[data-tutor-action="confirm"]').click();await page.locator('[data-tutor-action="finish"]').click();}
async function setup({blocked=false}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await ctx.route('**/*',r=>r.request().url().startsWith(base)||/^(data|blob):/.test(r.request().url())?r.continue():r.abort());
 await ctx.addInitScript(({blocked})=>{
  window.__voiceClips=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('/assets/voice/')&&!window.__voiceClips.includes(this))window.__voiceClips.push(this);return play.call(this);};
  if(blocked){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('synk.world.tutor.practice.'))throw Error('Synthetic storage unavailable');return set.call(this,key,value);};}
 },{blocked});
 page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/mobile.html?opening=off&tutor=choose');await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);await choose('marin');return ctx;
}
async function close(){if(await page.locator('#world-panel').evaluate(p=>p.open))await page.locator('#panel-close').click();}
async function open(id){await close();await page.locator('[data-view="play"]').click();await page.locator(`[data-game="${id}"]`).click();await page.locator('.tutor-practice[open]').waitFor();return page.frameLocator('.game-frame');}
(async()=>{try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 if(process.env.SYNK_PRACTICE_QA_SWIPES_ONLY==='1'){
  const ctx=await setup();await open('runner');const cdp=await ctx.newCDPSession(page);
  for(const [action,dx,dy] of [['left',-65,0],['right',65,0],['jump',0,-65],['slide',0,65]]){
   await page.waitForFunction(()=>window.__synkGameTutor.metrics().practice.phase==='try');
   const stage=await page.locator('.practice-stage').boundingBox(),x=stage.x+stage.width/2,y=stage.y+stage.height/2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
   for(let i=1;i<=3;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/3,y:y+dy*i/3,id:0}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   check(`actual phone-style swipe performs ${action}`,await page.evaluate(()=>window.__synkGameTutor.metrics().practice.phase==='success'));
   if(action!=='slide')await page.locator('.practice-primary').click();
  }
  await page.locator('.practice-exit').click();check('swipe rehearsal exits without a false completion',await page.locator('.tutor-practice,.game-frame').count()===0&&await page.evaluate(()=>!localStorage.getItem('synk.world.tutor.practice.v1:guest:marin:runner')));
  check('no swipe browser exceptions',errors.length===0,errors);await ctx.close();
  fs.writeFileSync(path.join(output,'swipe-result.json'),JSON.stringify({at:new Date().toISOString(),base,pass:checks.length,fail:0,checks,errors},null,2));console.log(`DONE ${checks.length} swipe checks`);return;
 }
 {
  const ctx=await setup();const frame=await open('hangul');await finishPractice(page);await frame.locator('#session:not([hidden])').waitFor();await frame.locator('#dock .felt-cta').click();
  await frame.locator('body').evaluate(async()=>{while(!window.__voiceClips.some(c=>!c.paused&&!c.ended&&c.currentTime>0))await new Promise(r=>setTimeout(r,20));});
  const item=await frame.locator('#stage').textContent();await page.locator('.game-tutor-help').click();await page.locator('.game-tutor-practice').click();
  const before=await frame.locator('body').evaluate(()=>window.__voiceClips.map(c=>({url:c.src,time:c.currentTime,paused:c.paused})));
  await page.waitForTimeout(350);const after=await frame.locator('body').evaluate(()=>window.__voiceClips.map(c=>({url:c.src,time:c.currentTime,paused:c.paused})));
  check('Hangul pauses the actual MP3 while the tutor demonstrates',before.length>0&&before.every((c,i)=>c.paused&&c.time===after[i]?.time));
  await finishPractice(page);
  check('Hangul keeps the same item after repeated practice',item===await frame.locator('#stage').textContent());
  await frame.locator('body').evaluate(async()=>{while(document.querySelector('#stage button')?.disabled)await new Promise(r=>setTimeout(r,20));});
  check('Hangul resumes the current clip without leaving its controls locked',await frame.locator('body').evaluate(()=>window.__voiceClips.some(c=>!c.paused||c.ended))&&await frame.locator('#dock button').isEnabled());
  await close();await ctx.close();
 }
 {
  const ctx=await setup();await page.locator('[data-view="me"]').first().click();await page.locator('[data-world="login-a"]').click();await page.waitForFunction(()=>window.__synkWorld.client.snapshot);
  await page.locator('[data-view="play"]').click();await page.locator('[data-world="play"]').click();await choose('kkamong');await page.locator('.tutor-practice[open]').waitFor();
  const prompt=await page.locator('.world-prompt').textContent();await finishPractice(page,{launch:false});
  check('sentence practice uses the selected account tutor',await page.locator('.tutor-practice').getAttribute('data-tutor')==='kkamong');
  check('sentence practice does not submit a real answer',await page.locator('.world-answer.selected').count()===0);
  await page.locator('.practice-primary').click();check('sentence practice leads to the same real question',prompt===await page.locator('.world-prompt').textContent());
  for(const option of ['thanks','water','front']){await page.locator(`[data-world="answer"][data-option="${option}"]`).click();check('picking a real sentence answer does not invent a success',await page.evaluate(()=>window.__synkGameTutor.metrics().kind==='picked')&&await page.locator('.tutor-practice').count()===0);await page.locator('[data-world="next"]').click();}
  await page.locator('.world-review').waitFor();await page.locator('.world-review summary').click();await page.locator('[data-tutor-review="greeting"]').click();await page.waitForFunction(()=>window.__synkGameTutor.metrics().kind==='retry');
  check('sentence feedback still follows the server-verified result',await page.locator('[data-tutor-review="greeting"]').textContent().then(s=>s.includes('어려웠던')));
  await close();await page.locator('[data-view="me"]').first().click();await page.locator('[data-world="logout"]').click();await page.waitForFunction(()=>!window.__synkWorld.client.snapshot);
  check('logout restores the original guest tutor',await page.evaluate(()=>window.__synkHome.tutor().tutor==='marin'));
  await open('runner');check('account practice cannot skip a guest game practice',await page.evaluate(()=>window.__synkGameTutor.metrics().practice.index===0));await page.locator('.practice-exit').click();await ctx.close();
 }
 {
  const ctx=await setup({blocked:true});const frame=await open('runner');await finishPractice(page);await frame.locator('#game:not([hidden])').waitFor();
  check('blocked storage still allows a successfully practised game to start',await page.evaluate(()=>window.__synkGameTutor.metrics().practiced));
  await close();await page.locator('[data-view="play"]').click();await page.locator('[data-game="runner"]').click();await page.locator('.game-tutor').waitFor();await page.waitForTimeout(250);
  check('blocked storage does not repeat practice during the same page visit',await page.locator('.tutor-practice').count()===0);await close();await ctx.close();
 }
 check('no lifecycle browser exceptions',errors.length===0,errors);
 fs.writeFileSync(path.join(output,'lifecycle-result.json'),JSON.stringify({at:new Date().toISOString(),base,pass:checks.length,fail:0,checks,errors},null,2));console.log(`DONE ${checks.length} lifecycle checks`);
 }catch(error){console.error(error);if(page)await page.screenshot({path:path.join(output,'lifecycle-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'lifecycle-failure.json'),JSON.stringify({at:new Date().toISOString(),error:String(error),checks,errors},null,2));throw error;}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
