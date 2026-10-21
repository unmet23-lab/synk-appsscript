'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const origin=process.env.SYNK_BEGINNER_ORIGIN||'http://127.0.0.1:4340',hub=origin+'/learning-hub/collection.html#beginner-shops-title';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage(),checks=[],errors=[],failed=[],out=path.join(__dirname,'return-play');fs.mkdirSync(out,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 const gotoHub=async()=>{await page.goto(hub,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('[data-beginner-shop] .shop-owned').length===3&&document.querySelector('.shop-owned').textContent.includes('/5'));};
 try{
  await gotoHub();assert.equal(await page.locator('.shop-play-owned:visible').count(),0);assert.equal(await page.locator('.shop-visit').count(),3);
  checks.push('New player sees three shop entries and no falsely owned play links.');
  await page.evaluate(async()=>{const s=await SynkPlayCollection.load();s.coins=100;s.totalEarned=100;await SynkPlayCollection.save(s);for(const id of ['magic-toys-picnic','order-playset-picnic','ship-keepsake-starbook'])await SynkPlayCollection.buy(id);});
  await page.waitForFunction(()=>document.querySelectorAll('.shop-play-owned:not([hidden])').length===3);
  const links=[['magic','/word-magic/?play=lab&item=magic-toys-picnic','#lab-launch'],['order','/order-rush/beginner.html?play=picnic','.b-picnic-entry'],['ship','/spaceship-coop/?collection=starbook','#starbook[open]']];
  for(const [id,route]of links)assert.equal(await page.locator(`[data-beginner-shop=${id}] .shop-use`).getAttribute('href'),route);
  assert.equal(await page.locator('#beginner-shop-cards a a').count(),0);checks.push('Owned goods have specific game-use links; shops remain separate accessible links without nested anchors.');
  for(const width of [1280,390,320]){
   await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const actions=page.locator('#beginner-shop-cards a');assert.equal(await actions.count(),6);
   for(const action of await actions.all()){await action.focus();assert(await action.evaluate(e=>document.activeElement===e&&e.getBoundingClientRect().height>=44));}
   const art=await page.locator('.shop-use img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0));assert(art);
   await page.locator('.beginner-shops').screenshot({path:path.join(out,`owned-hub-${width}.png`)});
  }
  checks.push('All owned/shop actions are keyboard reachable, at least 44px tall and readable at 1280/390/320, with loaded art and no overflow.');
  const balance=await page.evaluate(async()=>(await SynkPlayCollection.load()).coins);assert.equal(balance,35);
  for(const [id,route,target]of links){
   await gotoHub();await page.locator(`[data-beginner-shop=${id}] .shop-use`).click();await page.waitForURL(origin+route);await page.locator(target).waitFor();
   if(id==='magic')await page.locator('#launch-use:enabled').waitFor();if(id==='order')await page.locator('.b-picnic-entry [data-action=picnic]:enabled').waitFor();
   assert.equal(await page.evaluate(async()=>(await SynkPlayCollection.load()).coins),balance);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`direct-${id}-320.png`),fullPage:true});
   await page.goBack({waitUntil:'networkidle'});await page.locator(`[data-beginner-shop=${id}] .shop-use`).waitFor();
   checks.push(`${id}: actual hub click reaches owned activity preparation/collection, keeps coins unchanged and returns to the hub.`);
  }
  await gotoHub();await page.evaluate(async()=>{await SynkPlayCollection.buy('magic-frame-coral');await SynkPlayCollection.setBeginnerGoal('word-magic','magic-frame-coral');});
  await page.waitForFunction(()=>document.querySelector('[data-beginner-shop=magic] .shop-use').getAttribute('href').endsWith('item=magic-frame-coral'));
  await page.locator('[data-beginner-shop=magic] .shop-use').click();await page.locator('#launch-use:enabled').waitFor();assert.equal(await page.evaluate(async()=>(await SynkPlayCollection.load()).equipped['magic-frame']),'cream');
  checks.push('An owned cosmetic goal links to that item; visiting the preparation page does not auto-equip or spend coins.');
  const denied=await browser.newContext();await denied.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}});});const blocked=await denied.newPage();await blocked.goto(hub,{waitUntil:'networkidle'});await blocked.waitForFunction(()=>document.querySelector('.shop-owned')?.textContent.includes('Storage unavailable'));assert.equal(await blocked.locator('.shop-play-owned:visible').count(),0);assert.equal(await blocked.locator('.shop-visit').count(),3);await denied.close();
  checks.push('Blocked storage hides ownership-based shortcuts and retains the normal shop entries.');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);const report={at:new Date().toISOString(),checks,errors,failed,scope:'Isolated Chrome with test purchase funds; real hub links and game entry UIs. Game-level QA verifies audio, replay variation and bookmark retention.'};fs.writeFileSync(path.join(out,'hub-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
