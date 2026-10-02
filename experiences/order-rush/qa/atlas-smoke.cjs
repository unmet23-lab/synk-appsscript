'use strict';
// Isolated browser context; never reads or edits a user's browser profile.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.SYNK_QA_BASE||'http://127.0.0.1:4280';
 const result={origin:base};
 try{
  await page.goto(`${base}/order-rush/`);await page.locator('#learning-reason').filter({hasText:'기록'}).waitFor();
  await page.screenshot({path:path.join(__dirname,'atlas-cafe-desktop.png'),fullPage:true});
  await page.locator('#start').click();await page.waitForFunction(()=>window.synkCafe.current?.audioCompleted);
  assert.equal(await page.evaluate(()=>window.synkCafe.current.id),'o01');
  await page.locator('[data-ingredient="coffee"]').click();await page.locator('#serve').click();
  await page.waitForFunction(()=>window.synkCafe.current?.id==='o02'&&window.synkCafe.current.audioCompleted);
  result.firstIndependent=await page.evaluate(()=>window.synkCafe.learning.independent);assert.equal(result.firstIndependent,1);
  await page.locator('#show-text').click();await page.locator('[data-ingredient="coffee"]').click();await page.locator('[data-ingredient="ice"]').click();await page.locator('#serve').click();
  await page.waitForFunction(()=>window.synkCafe.current?.id!=='o02');
  result.afterTextHelp=await page.evaluate(()=>window.synkCafe.learning.independent);assert.equal(result.afterTextHelp,1);
  await page.locator('#finish').click();await page.locator('#results').waitFor({state:'visible'});
  await page.screenshot({path:path.join(__dirname,'atlas-cafe-results.png'),fullPage:true});
  await page.reload();result.afterReload=await page.evaluate(()=>window.synkCafe.learning.independent);assert.equal(result.afterReload,1);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'atlas-cafe-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(`${base}/korean-runner/`);await page.locator('#start:not([disabled])').waitFor();
  result.sharedBeforeRunner=await page.evaluate(()=>SynkLearning.createGame({gameId:'korean-runner',storage:localStorage}).summary().independent);
  assert.equal(result.sharedBeforeRunner,1);
  await page.screenshot({path:path.resolve(__dirname,'../../korean-runner/qa/atlas-runner-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.resolve(__dirname,'../../korean-runner/qa/atlas-runner-desktop.png'),fullPage:true});
  await page.locator('#start').click();await page.waitForFunction(()=>window.synkRunner.info.model?.answers.length>0,{},{timeout:20000});
  await page.locator('#pause-button').click();
  result.runner=await page.evaluate(()=>{const s=SynkLearning.createGame({gameId:'korean-runner',storage:localStorage}).summary();return {independent:s.independent,unassessed:s.counts.unassessed};});
  assert.equal(result.runner.independent,1);assert.ok(result.runner.unassessed>0);
  await page.screenshot({path:path.resolve(__dirname,'../../korean-runner/qa/atlas-runner-paused.png'),fullPage:true});
  assert.deepEqual(errors,[]);result.errors=errors;result.status='passed';
 }finally{await browser.close();fs.writeFileSync(path.join(__dirname,'atlas-smoke.json'),JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
