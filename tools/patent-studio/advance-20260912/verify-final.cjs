'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const {verifyExport}=require('../projection-replay.cjs');
const VROOT='C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async()=>{
const manifests=[];
for(const name of ['현재_미팅본_20260912','발전구현_0.5_20260912']) {
 const dir=path.join(VROOT,name),manifest=JSON.parse(fs.readFileSync(path.join(dir,'파일지문.json'),'utf8'));
 for(const f of manifest.files){assert.equal(fs.statSync(path.join(dir,f.path)).size,f.bytes);assert.equal(hash(path.join(dir,f.path)),f.sha256);}
 manifests.push({directory:name,files:manifest.files.length});
}
const legacyProof=JSON.parse(fs.readFileSync(path.join(__dirname,'../registration-20260912/evidence.json'),'utf8'));
const old=legacyProof.scenarios.map(s=>verifyExport(s.replayBundle));assert.ok(old.every(r=>r.valid));
const current=fs.readdirSync(path.join(__dirname,'qa')).filter(n=>n.endsWith('-export.json')).map(n=>verifyExport(JSON.parse(fs.readFileSync(path.join(__dirname,'qa',n),'utf8'))));assert.equal(current.length,3);assert.ok(current.every(r=>r.valid));
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let sessionURL;
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const entry=path.join(VROOT,'현재_미팅본_20260912/00_여기서시작.html');await page.goto(pathToFileURL(entry).href);await page.evaluate(()=>document.fonts.ready);
 const hrefs=await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.getAttribute('href')).filter(h=>!h.startsWith('http')&&!h.startsWith('#')));
 for(const href of hrefs)assert.ok(fs.existsSync(path.resolve(path.dirname(entry),decodeURIComponent(href))));
 assert.equal(await page.locator('[data-advance-implementation]').count(),1);
 await page.screenshot({path:path.join(__dirname,'qa/entry-desktop.png')});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await page.screenshot({path:path.join(__dirname,'qa/entry-mobile.png')});
 const health=await(await fetch('http://127.0.0.1:4318/api/health')).json();assert.equal(health.engineVersion,'0.5.0');
 await page.goto('http://127.0.0.1:4318');await page.waitForFunction(()=>!document.querySelector('#create-time-example').disabled);await page.click('#create-time-example');await page.waitForFunction(()=>!document.querySelector('#advance-content').hidden&&!document.querySelector('#create-time-example').disabled);sessionURL=page.url();
 const id=new URL(sessionURL).searchParams.get('session'),s=await(await fetch('http://127.0.0.1:4318/api/sessions/'+id)).json();assert.equal(s.analysis.version,'0.5.0');assert.equal(s.analysis.cells.find(c=>c.skill==='object').status,'held');const verified=await(await fetch('http://127.0.0.1:4318/api/sessions/'+id+'/verification')).json();assert.ok(verified.valid);
 assert.deepEqual(errors,[]);
 const result={passed:true,at:new Date().toISOString(),manifests,entryLinks:hrefs.length,oldReplay:old.map(r=>({valid:r.valid,revisions:r.checkedRevisions,version:r.engineVersion})),newReplay:current.map(r=>({valid:r.valid,revisions:r.checkedRevisions})),liveEngine:health.engineVersion,sessionURL,errors};
 fs.writeFileSync(path.join(__dirname,'qa/final-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
