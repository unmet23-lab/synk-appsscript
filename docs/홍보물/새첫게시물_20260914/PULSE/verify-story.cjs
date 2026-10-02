'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'../../../..');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main(){
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
 const changed=Object.values(manifest.sources).filter(s=>hash(path.join(ROOT,s.source))!==s.sha256);
 const mismatched=manifest.files.filter(s=>hash(path.join(__dirname,s.file))!==s.sha256);
 if(changed.length||mismatched.length)throw Error('입력 또는 출력 지문 변화');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results=[];const errors=[],requests=[];
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?1150:1100},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
  const states=[];
  for(let n=0;n<5;n++){
   await page.evaluate(()=>window.scrollTo(0,0));
   states.push(await page.evaluate(()=>({count:document.getElementById('page-count').textContent,title:document.getElementById('page-name').textContent,speech:document.getElementById('dialogue').textContent,overflow:document.documentElement.scrollWidth>window.innerWidth,previousDisabled:document.getElementById('prev').disabled})));
   if(width===390||n===0||n===3)await page.screenshot({path:path.join(__dirname,`render/reader-${width}-${n+1}.png`)});
   if(n===3)await page.locator('.reader').screenshot({path:path.join(__dirname,`render/reader-complete-${width}.png`)});
   await page.locator('#next').click();
  }
  const reset=await page.locator('#page-count').textContent();
  await page.locator('#next').focus();await page.keyboard.press('Enter');const keyboardNext=await page.locator('#page-count').textContent();
  await page.locator('#prev').focus();await page.keyboard.press('Enter');const keyboardPrev=await page.locator('#page-count').textContent();
  await page.locator('summary').click();const details=await page.locator('details').getAttribute('open');
  const loaded=await page.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  const links=await page.locator('a[href]').evaluateAll(es=>es.map(e=>e.getAttribute('href')).filter(h=>h&&!h.startsWith('#')));
  const missingLinks=links.filter(f=>!fs.existsSync(path.join(__dirname,f)));
  const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');
  const fonts={};for(const selector of ['h1','#narrative','#page-count']){const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});fonts[selector]=(await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;}
  await page.locator('#production').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,`render/production-${width}.png`)});
  if(width===390){const shots=page.locator('.shot');for(let n=0;n<await shots.count();n++)await shots.nth(n).screenshot({path:path.join(__dirname,`render/shot-${String(n+1).padStart(2,'0')}-390.png`)});}
  results.push({width,states,reset,keyboardNext,keyboardPrev,detailsOpen:details!==null,loaded,missingLinks,fonts});
  await context.close();
 }
 await browser.close();
 const passed=changed.length===0&&mismatched.length===0&&errors.length===0&&requests.length===0&&results.every(r=>r.states.every((s,n)=>!s.overflow&&s.count===String(n+1).padStart(2,'0')+' / 05')&&r.reset==='01 / 05'&&r.keyboardNext==='02 / 05'&&r.keyboardPrev==='01 / 05'&&r.detailsOpen&&r.loaded&&!r.missingLinks.length);
 const report={passed,sourceFiles:Object.keys(manifest.sources).length,changed,mismatched,errors,externalRequests:requests,results};
 fs.writeFileSync(path.join(__dirname,'render/verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed,sourceFiles:report.sourceFiles,viewports:results.map(r=>r.width),externalRequests:requests.length,errors,missing:results.map(r=>r.missingLinks)}));
 if(!passed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
