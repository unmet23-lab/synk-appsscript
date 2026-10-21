'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const url=process.env.MAGIC_URL||'http://127.0.0.1:4340/word-magic/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:320,height:720},reducedMotion:'reduce'}),checks=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__pageRestores=[];addEventListener('pageshow',e=>window.__pageRestores.push(e.persisted));});
 const S=()=>page.evaluate(()=>__wordMagic.state());
 const ready=()=>page.waitForFunction(()=>window.__wordMagic&&!__wordMagic.state().busy);
 const pick=async id=>{await page.locator(`[data-spell="${id}"]`).click();await ready();};
 const fit=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 try{
  await page.goto(url+'?qa');await ready();assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await page.locator('#start').click();await ready();
  await page.keyboard.press('KeyA');await ready();
  assert.equal((await S()).tutorSeen.length,1);assert.equal(await page.evaluate(()=>document.activeElement.dataset.spell),'grow');
  await page.keyboard.press('Space');await ready();assert.equal(await page.evaluate(()=>document.activeElement.dataset.spell),'grow');
  await page.keyboard.press('KeyS');await ready();assert.equal((await S()).tutorSeen.length,2);
  checks.push('Default Chrome real MP3 completes from first click; keyboard focus survives repeated playback');
  await page.locator('#next').click();await pick('grow');await page.locator('[data-object=chair]').click();
  const changed=(await S()).objects;
  await page.locator('#language').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'language');await page.locator('#language').click();
  await page.keyboard.press('Escape');await page.locator('#pause-dialog[open]').waitFor();await fit();
  await page.screenshot({path:path.join(__dirname,'shots/polish-pause-320.png'),fullPage:true});
  await page.locator('#pause-home').click();await page.locator('#start').click();await ready();assert.deepEqual((await S()).objects,changed);
  await page.reload();await ready();await page.locator('#start').click();await ready();assert.deepEqual((await S()).objects,changed);
  checks.push('Partial scene survives Pause → Home → Continue and reload; language toggle keeps its own focus');
  await page.keyboard.press('KeyA');await page.locator('#help').click();assert.equal((await S()).busy,false);
  await page.locator('#close-help').click();await ready();assert.equal((await S()).screen,'puzzle');
  checks.push('Help interrupts real playback, then resumes with a fresh complete word without losing the scene');
  // Complete the first chapter through real controls, then preserve the unanswered check.
  while((await S()).screen==='puzzle'){
   for(const move of await page.evaluate(()=>__wordMagic.solution())){await pick(move.spell);await page.locator(`[data-object="${move.objectId}"]`).click();}
   await page.locator('#next').click();await ready();
  }
  assert.equal((await S()).screen,'checkpoint');assert.equal((await S()).heard,true);
  const originalCheck=(await S()).check;
  await page.locator('#home').click();await page.locator('#pause-games').click();await page.waitForURL('**/learning-hub/#beginner-title');
  await page.goBack();await ready();
  const nativeRestore=await page.evaluate(()=>window.__pageRestores);
  if((await S()).screen==='lobby'){await page.locator('#start').click();await ready();}
  if(await page.locator('#pause-dialog[open]').count())await page.locator('#resume-game').click();
  assert.equal((await S()).check.spell,originalCheck.spell);assert.equal((await S()).heard,false);
  // Explicitly exercise the persisted lifecycle branch even when Chrome chooses a reload.
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await page.locator('#resume-game').click();assert.equal((await S()).heard,false);await page.locator('#replay').click();await ready();
  const wrong=originalCheck.choices.find(id=>id!==originalCheck.spell);await pick(wrong);
  assert.equal((await S()).progress.checks.length,1);assert.equal((await S()).progress.checks[0].correct,false);
  assert.equal((await S()).progress.checks[0].assessable,false);
  const firstAttemptCount=await page.evaluate(()=>SynkLearning.createGame({gameId:'word-magic',storage:localStorage}).events().filter(e=>e.type==='practice.attempted').length);
  await page.reload();await ready();await page.locator('#start').click();await ready();await page.locator('#replay').click();await ready();await pick(originalCheck.spell);
  assert.equal((await S()).progress.checks.length,1);assert.equal(await page.evaluate(()=>document.activeElement.id),'next');
  const attempts=await page.evaluate(()=>SynkLearning.createGame({gameId:'word-magic',storage:localStorage}).events().filter(e=>e.type==='practice.attempted'));
  assert.equal(attempts.length,firstAttemptCount);assert.ok(attempts.some(e=>e.verdict==='incorrect'));assert.ok(attempts.every(e=>e.verdict!=='correct'));
  checks.push('Native history return and synthetic BFCache branch preserve the prompt, require replay and retain the first wrong answer without recording correction as a new success');
  await page.locator('#next').click();await ready();await pick((await S()).check.spell);await page.locator('#next').click();
  assert.equal((await S()).screen,'ending');await fit();await page.screenshot({path:path.join(__dirname,'shots/polish-ending-320.png'),fullPage:true});
  await page.locator('#ending-lab').click();assert.equal((await S()).screen,'lab');
  await page.locator('#other-games').click();await page.waitForURL('**/learning-hub/#beginner-title');
  checks.push('Chapter reward offers free play; the playground returns to the correct beginner hub');
  assert.deepEqual(errors,[]);
  const result={at:new Date().toISOString(),url,viewport:320,browser:'Chrome default autoplay policy',nativePageshowPersisted:nativeRestore,syntheticPersistedBranch:true,checks,errors};
  fs.writeFileSync(path.join(__dirname,'polish.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }catch(e){await page.screenshot({path:path.join(__dirname,'shots/polish-failure.png'),fullPage:true});throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
