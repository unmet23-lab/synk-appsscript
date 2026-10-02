'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/i.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(path.join(__dirname,'SYNK_Atlas_엔진지도_20260921.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.engine-node').count(),8);
  assert.equal(await page.locator('#matrix-body tr').count(),8);
  assert.equal(await page.locator('[data-detail]:visible').count(),1);
  assert.equal(await page.locator('.logo').evaluate(e=>e.naturalWidth),2200);
  const fonts=await page.evaluate(()=>['16px SUIT','16px "Inter Tight"','12px "DM Mono"'].map(f=>({f,loaded:document.fonts.check(f)})));
  assert.ok(fonts.every(f=>f.loaded));
  for(const id of ['core','strata','trail','temper','prism','vellum','loom','reed']){
   await page.locator(`#engine-tabs [data-engine="${id}"]`).click();
   assert.ok(await page.locator(`#detail-${id}`).isVisible());
   assert.equal(await page.locator('[data-detail]:visible').count(),1);
  }
  await page.locator('#search').fill('없는검색어9812');
  assert.equal(await page.locator('.engine-node').count(),0);
  assert.ok(await page.locator('#no-results').isVisible());
  await page.locator('#search').fill('Strata');
  assert.ok(await page.locator('.engine-node').count()>=1);
  await page.locator('#search').fill('');
  await page.locator('#all-toggle').click();
  assert.equal(await page.locator('[data-detail]:visible').count(),8);
  await page.locator('#all-toggle').click();
  assert.equal(await page.locator('[data-detail]:visible').count(),1);
  await page.locator('button[data-support="step"]').click();
  assert.equal(await page.locator('.demo-stage').getAttribute('data-support'),'step');
  assert.equal(await page.locator('#demo-title').textContent(),'한 항목부터 글 점검하기');
  await page.locator('button[data-time="short"]').click();
  await page.locator('#demo-restore').click();
  assert.equal(await page.locator('.demo-stage').getAttribute('data-support'),'step');
  assert.equal(await page.locator('button[data-time="standard"]').getAttribute('aria-pressed'),'true');
  await page.locator('button[data-support="independent"]').click();
  assert.equal(await page.locator('#demo-title').textContent(),'먼저 쓰고, 필요할 때 점검하기');
  await page.locator('#demo-restore').click();
  assert.equal(await page.locator('.demo-stage').getAttribute('data-support'),'independent');
  await page.locator('button[data-support="choose"]').click();
  assert.equal(await page.locator('#demo-checks li').count(),3);
  await page.locator('#engine-tabs [data-engine="core"]').click();
  const widths=[];
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:width===1440?1000:844});
   await page.evaluate(()=>window.scrollTo(0,0));
   const dim=await page.evaluate(()=>({view:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(dim.scroll<=dim.view,`Horizontal overflow at ${width}: ${JSON.stringify(dim)}`);
   widths.push(dim);
   await page.screenshot({path:path.join(__dirname,`qa-${width}-overview.png`),fullPage:false});
   if(width!==320){
    await page.locator('#overview').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(__dirname,`qa-${width}-map.png`),fullPage:false});
    await page.locator('#engine-detail').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(__dirname,`qa-${width}-detail.png`),fullPage:false});
   }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#experience').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(__dirname,'qa-demo.png'),fullPage:false});
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('[data-detail]:visible').count(),8);
  assert.equal(await page.locator('details:not([open])').count(),0);
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.locator('[data-detail]:visible').count(),1);
  const sourceCount=await page.locator('.sources a').count();
  const anchors=await page.locator('a[href^="#"]').evaluateAll(links=>links.filter(a=>!document.querySelector(a.getAttribute('href'))).map(a=>a.getAttribute('href')));
  assert.deepEqual(anchors,[]);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const result={date:'2026-09-21',browser:'Microsoft Edge headless',offline:true,widths,engines:8,sourceCount,fonts,errors,network,checks:['8-engine selection','search results and empty state','expand/collapse all','real Atlas guidance changes','support restore and time reset','standalone image and fonts','320/390/1440 responsive overflow','print expansion and restoration','internal anchor targets']};
  fs.writeFileSync(path.join(__dirname,'qa-result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
