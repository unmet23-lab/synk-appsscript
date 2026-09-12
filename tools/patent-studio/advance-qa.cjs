'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./server.cjs'),{verifyExport}=require('./projection-replay.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
(async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-advance-qa-'));
const out=path.join(__dirname,'advance-20260912','qa');fs.mkdirSync(out,{recursive:true});
const app=await createServer({directory:dir,transcriber:{status:async()=>({provider:'manual',available:false}),transcribe:async()=>{throw Error('Unexpected external call');}}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+app.server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1512,height:1080}}),errors=[],external=[],scenarios=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
const read=async()=> (await fetch(base+'/api/sessions/'+new URL(page.url()).searchParams.get('session'))).json();
const ready=()=>page.waitForFunction(()=>!document.querySelector('#advance-content').hidden&&!document.querySelector('#create-time-example').disabled);
const status=s=>Object.fromEntries(s.analysis.cells.map(c=>[c.skill,c.status]));
try {
  await page.goto(base); await page.waitForFunction(()=>!document.querySelector('#create-time-example').disabled);
  for(const direction of ['after','before']) {
    await page.click('#create-time-example');await ready();const before=await read();assert.deepEqual(status(before),{asr:'accepted',object:'held',past:'accepted'});
    await page.click('#refine-'+direction);await page.waitForFunction(()=>document.querySelector('#refine-after').dataset.done==='true');
    const after=await read();assert.equal(status(after).object,direction==='after'?'accepted':'excluded');assert.deepEqual(after.original,before.original);
    const bundle=await(await fetch(base+'/api/sessions/'+after.id+'/export')).json();assert.equal(verifyExport(bundle).valid,true);
    scenarios.push({name:direction,before:status(before),after:status(after),replay:verifyExport(bundle)});
    fs.writeFileSync(path.join(out,'time-'+direction+'-export.json'),JSON.stringify(bundle,null,2));
  }
  await page.click('#create-plan-example');await ready();let multiple=await read();assert.ok(multiple.analysis.cells.find(c=>c.skill==='object').blockers.length>=4);
  assert.equal(multiple.analysis.evidencePlan.actualEvidenceChanged,false);
  await page.locator('.advance-panel').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'desktop.png')});
  await page.click('#demo-confirm-record');await page.waitForFunction(()=>document.querySelector('#demo-confirm-record').dataset.done==='true');
  multiple=await read();assert.equal(status(multiple).object,'held');assert.equal(status(multiple).past,'accepted');
  await page.click('#refine-after');await page.waitForFunction(()=>document.querySelector('.advance-status').textContent.includes('반영'));
  multiple=await read();assert.deepEqual(status(multiple),{asr:'accepted',object:'accepted',past:'accepted'});
  const multipleBundle=await(await fetch(base+'/api/sessions/'+multiple.id+'/export')).json();assert.equal(verifyExport(multipleBundle).valid,true);
  fs.writeFileSync(path.join(out,'multi-export.json'),JSON.stringify(multipleBundle,null,2));
  scenarios.push({name:'multiple',after:status(multiple),replay:verifyExport(multipleBundle)});
  await page.reload();await ready();assert.equal((await read()).revision,multiple.revision);
  await page.setViewportSize({width:390,height:844});await page.locator('.advance-panel').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'mobile.png')});
  const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,fonts:document.fonts.check('500 16px "SUIT Variable"'),images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)}));
  assert.equal(dimensions.width,dimensions.scrollWidth);assert.ok(dimensions.fonts&&dimensions.images);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const proof={passed:true,at:new Date().toISOString(),engine:multiple.analysis.version,scenarios,dimensions,errors,externalRequests:external.length,scope:'실제 로컬 HTTP/SQLite/Core 작동. 모든 사건은 합성 예제. 학생·마이크·전사 API 없음.'};
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
} finally {await browser.close();await new Promise(r=>app.server.close(r));app.store.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
