'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {chromium}=require('playwright'),sharp=require('sharp');
const dir=__dirname,root=path.resolve(dir,'../../..'),out=path.join(dir,'_검토');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));
(async()=>{
 const origin=read('_검토/원본지문.json');
 for(const p of origin.origins){assert.equal(hash(path.join(root,p.source)),p.sha256,p.source);assert.equal(hash(path.join(dir,p.snapshot)),p.sha256,p.snapshot)}
 let unchanged=0,changed=0;
 for(const key of ['lab','shift'])for(let n=1;n<=6;n++){
  const name=`upload-${String(n).padStart(2,'0')}.jpg`,p=path.join(dir,key,name),old=path.join(dir,'baseline',key,name),m=await sharp(p).metadata();
  assert.equal(m.width,1080);assert.equal(m.height,1350);
  if(n===1||n===6){assert.notEqual(hash(p),hash(old));changed++}else{assert.equal(hash(p),hash(old));unchanged++}
 }
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const report={originFiles:origin.origins.length,unchangedImages:unchanged,changedImages:changed,pages:0,localReferences:0,downloads:[],issues:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  page.on('pageerror',e=>report.issues.push(e.message));
  const settle=()=>page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.all([...document.images].map(i=>i.decode()))});
  const files=['index.html',...['lab','shift'].flatMap(k=>['index.html','material.html','직접작성.html'].map(f=>k+'/'+f))];
  for(const f of files){
   await page.goto(pathToFileURL(path.join(dir,f)).href);await settle();report.pages++;
   const refs=await page.locator('[href],[src]').evaluateAll(ns=>ns.flatMap(n=>[n.getAttribute('href'),n.getAttribute('src')]).filter(Boolean));
   for(const ref of refs){if(/^(?:https?:|data:|blob:|#|mailto:)/.test(ref))continue;report.localReferences++;assert(fs.existsSync(fileURLToPath(new URL(ref,pathToFileURL(path.join(dir,f))))),f+': '+ref)}
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),f+' horizontal overflow '+width)}
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto(pathToFileURL(path.join(dir,'index.html')).href);
  for(const key of ['lab','shift']){
   await page.locator('[data-brand="'+key+'"]').click();
   assert.equal(await page.locator('#caption-controls').isVisible(),key==='lab');
   for(let n=1;n<=6;n++){assert.equal(await page.locator('#slide-status').textContent(),n+' / 6');assert((await page.locator('#new-image').getAttribute('src')).startsWith(key+'/'));if(n<6)await page.locator('#next').click()}
   assert(await page.locator('#next').isDisabled());await settle();
   await page.locator('#cards-pair').screenshot({path:path.join(out,key+'-6장-전후.jpg'),type:'jpeg',quality:88});
   await page.locator('#first-change').click();assert.equal(await page.locator('#slide-status').textContent(),'1 / 6');
   if(key==='shift'){await settle();await page.locator('#cards-pair').screenshot({path:path.join(out,'shift-1장-전후.jpg'),type:'jpeg',quality:88})}
  }
  await page.locator('[data-brand="lab"]').click();await page.locator('[data-language="mn"]').click();assert.equal(await page.locator('#new-caption').textContent(),read('lab.json').caption);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-side="new"]').click();assert(!(await page.locator('#old-image').isVisible()));assert(await page.locator('#new-image').isVisible());await settle();await page.screenshot({path:path.join(out,'모바일.jpg'),type:'jpeg',quality:85});
  for(const key of ['lab','shift']){
   await page.goto(pathToFileURL(path.join(dir,key,'직접작성.html')).href);
   const value='검사 문장\nМаргааш оройн зургаан цаг\n금요일 여섯 시까지 보낼게요.';await page.locator('#work').fill(value);
   const pending=page.waitForEvent('download');await page.locator('#save').click();const d=await pending;assert.equal(fs.readFileSync(await d.path(),'utf8'),value);assert((await page.locator('#status').textContent()).includes('TXT'));report.downloads.push(key);
  }
  assert.deepEqual(report.issues,[]);
 }finally{await browser.close()}
 fs.writeFileSync(path.join(out,'QA.json'),JSON.stringify({checkedAt:new Date().toISOString(),...report},null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
