const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=__dirname,d=JSON.parse(fs.readFileSync(path.join(dir,'../평면도_20260929/공간과_편의시설_좌표_6안.json'),'utf8'));
const budget=JSON.parse(fs.readFileSync(path.join(dir,'../../유지비_BM/예산_20261001/budget-data.json'),'utf8'));
const itemIds=new Set(budget.items.map(f=>f.id));
assert.equal(d.fireSafety.legalCompliance,'not-verified');assert.equal(d.fireSafety.egressPathsVerified,false);
assert.equal(d.fireSafety.extinguishers.length,3);assert.equal(d.fireSafety.detectorCandidates.length,16);
assert.equal(d.fireSafety.exitCandidates.length,2);assert(d.fireSafety.exitCandidates.every(f=>f.externalConnectionVerified===false));
assert.equal(d.fireSafety.doorReviews.length,4);assert(d.fireSafety.doorReviews.every(f=>f.persons===17&&f.status==='redesign-required'));
assert.equal(d.essentialFixtures.filter(f=>f.kind==='diffuser').length,2);
const overlap=(a,b)=>a.x<b.x+b.w-.001&&a.x+a.w>b.x+.001&&a.y<b.y+b.h-.001&&a.y+a.h>b.y+.001;
for(const f of d.essentialFixtures){
 const r=d.rooms.find(r=>r.id===f.room);assert(r,'No room '+f.id);
 assert(f.x>=r.x-.001&&f.y>=r.y-.001&&f.x+f.w<=r.x+r.w+.001&&f.y+f.h<=r.y+r.h+.001,'Fixture out of room '+f.id);
 for(const id of f.budgetIds)assert(itemIds.has(id),'Missing budget reference '+f.id+' '+id);
 if(f.kind==='wall-bin')for(const z of d.restrooms.turningZones.filter(z=>z.room===f.room)){
  const cx=z.cx??z.x+z.w/2,cy=z.cy??z.y+z.h/2,rad=z.r??z.diameter/2;
  const dx=Math.max(f.x-cx,0,cx-f.x-f.w),dy=Math.max(f.y-cy,0,cy-f.y-f.h);
  assert(Math.hypot(dx,dy)>rad,'Waste bin intrudes into turning review zone '+f.id);
 }
 if(f.id.startsWith('TOWEL-'))for(const mirror of d.restrooms.wallMountedAccessories.filter(m=>m.room===f.room&&m.kind==='mirror'))assert(!overlap(f,mirror),'Paper dispenser overlaps mirror '+f.id);
}
assert.equal(budget.items.find(f=>f.id==='S-fire_co2').base,null);assert.equal(budget.capitalItems.find(f=>f.id==='K08').apply,1);
let openedBrowser;
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 openedBrowser=browser;
 const page=await browser.newPage({viewport:{width:780,height:1000},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('file:///'+path.join(dir,'synk-academy-3d-preview.html').replaceAll('\\','/'));
 const frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForSelector('#synk-3d-concept[data-ready="true"]',{timeout:45000});
 const report={reviewDate:'2026-10-01',scope:'Concept model display and coordinates; no site/legal compliance certification',coordinateChecks:'room containment / WC bin turning circles / paper-holder mirror separation / existing budget references passed',states:[],errors};
 for(const width of [780,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const room of ['all','corridor','A','office','WC-M','WC-F']){
   await frame.locator('#s3-room').selectOption(room);await frame.locator('#s3-safety').check();await page.waitForTimeout(75);
   const result=await frame.evaluate(()=>{const r=document.getElementById('synk-3d-concept');return{...r.conceptDiagnostic,detail:r.querySelector('.s3-detail').textContent,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.equal(result.safetyReview,true);assert.equal(result.legalCompliance,'not-verified');assert.equal(result.egressPathsVerified,false);assert.equal(result.overflow,false);
   assert(result.detail.includes('소방 적합 판정 전'));assert(result.webgl&&result.triangles>0);
   assert.deepEqual([...result.essentialFixtureIds].sort(),d.essentialFixtures.filter(f=>room==='all'||f.room===room).map(f=>f.id).sort());
   if(room==='all'){assert.equal(result.extinguisherIds.length,3);assert.equal(result.detectorCandidateIds.length,16);assert.equal(result.exitCandidates.length,2);assert.equal(result.doorReviewRooms.length,4);}
   if(room==='corridor'){assert.equal(result.extinguisherIds.length,2);assert(result.visibleLabels.includes('서쪽 연결 미확인'));assert(result.visibleLabels.includes('동쪽 연결 미확인'));}
   if(room==='A'){assert.deepEqual(result.doorReviewRooms,['A']);assert(result.detail.includes('문 방향'));}
   if(room.startsWith('WC-'))assert(result.essentialFixtureIds.includes(room==='WC-M'?'DIFFUSER-M':'DIFFUSER-F'));
   const file=`safety-${width}-${room}.png`;await frame.locator('#synk-3d-concept').screenshot({path:path.join(dir,file)});report.states.push({width,...result,screenshot:file});
  }
  await frame.locator('#s3-safety').uncheck();const off=await frame.evaluate(()=>document.getElementById('synk-3d-concept').conceptDiagnostic);assert.equal(off.safetyReview,false);assert.equal(off.detectorCandidateIds.length,0);
 }
 assert.equal(errors.length,0);fs.writeFileSync(path.join(dir,'safety-verification.json'),JSON.stringify(report,null,2));await browser.close();
 console.log(JSON.stringify({states:report.states.length,coordinateChecks:report.coordinateChecks,errors,legalCompliance:'not-verified'}));
})().catch(async e=>{console.error(e);await openedBrowser?.close();process.exitCode=1;});
