'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(path.join(__dirname,'SYNK_WORLD_앱로드맵_20260921.html')).href);
 await page.evaluate(async()=>{await document.fonts.ready;for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'data.json'),'utf8'));
 const count=data.chapters.reduce((s,c)=>s+c.features.length,0);
 assert.equal(await page.locator('[data-chapter]').count(),14);assert.equal(await page.locator('.feature').count(),count);assert.equal(await page.locator('#catalogue a').count(),count);
 const images=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>({alt:i.alt,ok:i.complete&&i.naturalWidth>0})));assert.ok(images.every(i=>i.ok));
 const fonts=await page.evaluate(()=>['16px SUIT','16px "Inter Tight"','12px "DM Mono"'].map(f=>({font:f,loaded:document.fonts.check(f)})));assert.ok(fonts.every(f=>f.loaded));
 await page.locator('#expand').click();assert.equal(await page.locator('.feature[open]').count(),count);
 await page.locator('#expand').click();assert.equal(await page.locator('.feature[open]').count(),0);
 await page.locator('#search').fill('존재하지않는기능98451');assert.equal(await page.locator('#catalogue a').count(),0);assert.ok(await page.locator('#empty').isVisible());
 await page.locator('#search').fill('농사');assert.ok(await page.locator('#catalogue a').count()>0);
 const first=await page.locator('#catalogue a').first().getAttribute('data-feature');await page.locator('#catalogue a').first().click();assert.ok(await page.locator('#f-'+first).getAttribute('open')!==null);
 await page.locator('#search').fill('');await page.locator('#status-filter').selectOption('connected');assert.equal(await page.locator('#catalogue a').count(),data.chapters.flatMap(c=>c.features).filter(f=>f.status==='connected').length);await page.locator('#status-filter').selectOption('all');
 await page.locator('[data-help="independent"]').click();assert.match(await page.locator('#help-now').textContent(),/혼자|먼저/);assert.equal(await page.locator('[data-help="independent"]').getAttribute('aria-pressed'),'true');await page.locator('[data-help="step"]').click();
 for(let i=0;i<data.activities.length;i++){await page.locator(`[data-activity="${i}"]`).click();assert.match(await page.locator('#activity-panel').textContent(),new RegExp(data.activities[i].name));}await page.locator('[data-activity="0"]').click();
 for(let i=0;i<data.actions.length;i++){await page.locator(`[data-action="${i}"]`).click();assert.equal(await page.locator('#action-message').textContent(),data.actions[i].message);}
 const widths=[];
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.evaluate(()=>window.scrollTo(0,0));
  const d=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(d.document<=d.viewport,`Overflow ${JSON.stringify(d)}`);widths.push(d);
  await page.screenshot({path:path.join(__dirname,`qa-${width}-cover.png`)});
  if(width===320)continue;
  if(width===390){await page.locator('#mobile-jump').selectOption('controls');assert.equal(await page.locator('#mobile-jump').inputValue(),'controls');}
  for(const id of ['start','daily','personal','life','controls','roadmap']){
   await page.locator('#'+id).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
   await page.screenshot({path:path.join(__dirname,`qa-${width}-${id}.png`)});
  }
  await page.locator('#daily .feature').first().evaluate(e=>e.open=true);await page.locator('#daily .feature').first().evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:path.join(__dirname,`qa-${width}-feature.png`)});
 }
 const before=await page.locator('details[open]').count();await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('details:not([open])').count(),0);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('details[open]').count(),before);
 const badAnchors=await page.locator('a[href^="#"]').evaluateAll(as=>as.filter(a=>!document.querySelector(a.getAttribute('href'))).map(a=>a.getAttribute('href')));assert.deepEqual(badAnchors,[]);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 const result={date:'2026-09-21',browser:'Microsoft Edge headless',offline:true,chapters:14,featureChapters:12,features:count,images:images.length,fonts,widths,errors,network,checks:['all chapter and source targets','feature expansion/collapse','search empty/results','status filter','search result opens feature','help explanation selection','five activity scenes','four nearby action explanations','mobile section selector','offline fonts and images','print expansion/restoration','responsive 320/390/1440']};
 fs.writeFileSync(path.join(__dirname,'qa-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
