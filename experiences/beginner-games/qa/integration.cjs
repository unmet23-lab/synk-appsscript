'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const origin = process.env.SYNK_BEGINNER_ORIGIN || 'http://127.0.0.1:4340';
(async()=>{
 const browser = await chromium.launch({headless:true,channel:'chrome'}); const results=[];
 try {
  for (const width of [1280,390,320]) {
   const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1}); const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/learning-hub/',{waitUntil:'networkidle'});
   const links=await page.locator('.beginner-games>a').evaluateAll(rows=>rows.map(a=>a.getAttribute('href')));
   assert.deepEqual(links,['/word-magic/','/order-rush/beginner.html','/spaceship-coop/']);
   const failures=await page.locator('.beginner img').evaluateAll(rows=>rows.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));assert.deepEqual(failures,[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'hub overflow '+width);
   await page.screenshot({path:path.join(__dirname,`hub-${width}.png`),fullPage:true});
   await page.locator('.beginner').screenshot({path:path.join(__dirname,`hub-beginner-${width}.png`)});
   const crowded=await page.locator('.beginner-games>a').evaluateAll(cards=>cards.flatMap(card=>{
    const image=card.querySelector('img').getBoundingClientRect();
    const outer=card.getBoundingClientRect();
    return [...card.querySelectorAll('h3,p,strong,.beginner-meta')].flatMap(text=>{
     const box=text.getBoundingClientRect();
     const overlap=Math.min(box.right,image.right)>Math.max(box.left,image.left)+1&&Math.min(box.bottom,image.bottom)>Math.max(box.top,image.top)+1;
     return overlap||box.right>outer.right+1||box.bottom>outer.bottom+1?[text.textContent]:[];
    });
   }));
   assert.deepEqual(crowded,[],'card artwork and copy at '+width);
   await page.locator('.beginner-jump').focus(); await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'beginner-title','keyboard jump focus');
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),'/word-magic/','first playable choice after jump');
   await page.keyboard.press('Enter');await page.waitForURL('**/word-magic/');
   await page.goBack({waitUntil:'networkidle'});
   assert.equal(new URL(page.url()).hash,'#beginner-title');
   assert.equal(await page.locator('#beginner-title').isVisible(),true);
   assert.deepEqual(errors,[]);results.push({width,links,errors,images:'loaded',overflow:false,cardOverlap:false,keyboardJump:'passed',playAndReturn:'passed'});await page.close();
  }
  for (const [id,route] of [['magic','/word-magic/'],['order','/order-rush/beginner.html'],['spaceship','/spaceship-coop/']]) {
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],failed=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
   await page.goto(origin+route,{waitUntil:'networkidle'});await page.screenshot({path:path.join(__dirname,id+'-390.png'),fullPage:true});
   assert.deepEqual(errors,[],id);assert.deepEqual(failed,[],id+' resource errors');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,id+' overflow');
   results.push({id,errors,failed,overflow:false});await page.close();
  }
  fs.writeFileSync(path.join(__dirname,'integration.json'),JSON.stringify({at:new Date().toISOString(),origin,results},null,2)+'\n');
  console.log(JSON.stringify({ok:true,checks:results.length}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
