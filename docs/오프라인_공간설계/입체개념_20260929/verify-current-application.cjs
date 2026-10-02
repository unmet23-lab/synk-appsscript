const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,coords=path.join(dir,'../평면도_20260929/공간과_편의시설_좌표_6안.json'),preview=path.join(dir,'synk-academy-3d-preview.html');
const fragment='C:/Users/q1212/.codex/visualizations/2026/09/27/01a0e247-e6df-7b72-af5d-20238b73ce68/synk-academy-3d-concept.html';
const d=JSON.parse(fs.readFileSync(coords,'utf8')),h=fs.readFileSync(fragment,'utf8'),m=h.match(/<script type="application\/json" id="s3-data">([\s\S]*?)<\/script>/);
assert(m);assert.deepEqual(JSON.parse(m[1]),d);
const tablet=d.consultation.tablet,t=tablet.onTable,table=d.consultation.modes.consult.furniture.find(f=>f.kind==='folding-table');
assert(t.x>=table.x&&t.y>=table.y&&t.x+t.w<=table.x+table.w&&t.y+t.h<=table.y+table.h,'Tablet outside consultation tabletop');
assert(t.z>=(table.height||.76)&&t.z-(table.height||.76)<.01,'Tablet not on tabletop');
const budget=JSON.parse(fs.readFileSync(path.join(dir,'../../유지비_BM/예산_20261001/budget-data.json'),'utf8'));
assert.equal(budget.items.find(f=>f.id===tablet.budgetId).qty,1);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');let browser;
(async()=>{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:780,height:1000},deviceScaleFactor:1});
 const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push(r.url()));
 await page.goto('file:///'+preview.replaceAll('\\','/'));const frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForSelector('#synk-3d-concept[data-ready="true"]',{timeout:45000});
 assert.deepEqual(await frame.evaluate(()=>JSON.parse(document.getElementById('s3-data').textContent)),d,'Standalone preview is stale');
 const report={date:'2026-10-01',sourceRevision:d.revision,sourceAndInlineMatch:true,sourceAndStandaloneMatch:true,files:{coordinates:{path:coords,sha256:sha(coords)},fragment:{path:fragment,sha256:sha(fragment)},preview:{path:preview,sha256:sha(preview)}},fixed:'Consultation iPad model missing; now shown in consultation mode and removed for VR',unmodeled:['windows','general-room supply/return and ductwork','general-room fragrance fixtures'],unresolved:['classroom door redesign and corridor clearance','independent external egress connections','site equipment dimensions, installation and statutory approval'],states:[],errors,failed};
 for(const width of [780,390,320]){
  await page.setViewportSize({width,height:1000});await frame.locator('#s3-room').selectOption('consult');
  for(const mode of ['consult','vr']){
   await frame.locator('#s3-mode').selectOption(mode);await page.waitForTimeout(80);
   const view=await frame.evaluate(()=>{const r=document.getElementById('synk-3d-concept');return{...r.conceptDiagnostic,overflow:document.documentElement.scrollWidth>innerWidth,pendingText:document.getElementById('s3-unmodeled').textContent};});
   assert.equal(view.consultTabletVisible,mode==='consult');assert.equal(view.consultTabletCount,1);assert(!view.overflow);assert(view.pendingText.includes('일반실 급배기'));
   if(mode==='consult')assert(view.visibleLabels.includes('4인 상담 · iPad'));
   const file=`current-${width}-consult-${mode}.png`;await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,file)});report.states.push({width,...view,screenshot:file});
  }
  await frame.locator('#s3-room').selectOption('all');await frame.locator('#s3-mode').selectOption('consult');await frame.locator('#s3-safety').check();
  const all=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic);assert(all.consultTabletVisible);assert.equal(all.extinguisherIds.length,3);assert.equal(all.detectorCandidateIds.length,16);assert.equal(all.legalCompliance,'not-verified');
  const allFile=`current-${width}-all-safety.png`;await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,allFile)});report.states.push({width,...all,screenshot:allFile});await frame.locator('#s3-safety').uncheck();
 }
 assert.equal(errors.length,0);assert.equal(failed.length,0);fs.writeFileSync(path.join(dir,'current-application-verification.json'),JSON.stringify(report,null,2));await browser.close();
 console.log(JSON.stringify({sourceAndInlineMatch:true,sourceAndStandaloneMatch:true,tabletStates:report.states.length,errors,failed,remaining:report.unmodeled}));
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
