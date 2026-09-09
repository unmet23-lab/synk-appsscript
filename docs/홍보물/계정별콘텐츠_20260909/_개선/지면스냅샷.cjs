'use strict';
// Re-render existing document DOM with a stitched lockup only. Official originals stay untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../../..'),intro=path.join(root,'docs/홍보물/브랜드소개_20260909');
const loom=require(path.join(root,'tools/lib/loom.js'));
const out=path.join(__dirname,'지면스냅샷');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const url=n=>pathToFileURL(path.join(__dirname,'배치용','brand-'+n+'.webp')).href;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:8/3});
 const report=[];
 for(const [brand,pages] of [['lab',[1,2]],['shift',[1]],['pulse',[1]],['synk',[1]]]){
  const input=path.join(intro,brand+'.html'),beforeFile=hash(fs.readFileSync(input));
  await page.goto(pathToFileURL(input).href+'?export');
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()));});
  const before=await page.locator('.sheet').evaluateAll(es=>es.map(e=>{const copy=e.cloneNode(true);copy.querySelector('.brand')?.remove();return copy.textContent}));
  const markup=`<div class="account-collection reference-brand"><div class="brand-lock" role="img" aria-label="SYNK${brand==='synk'?'':' '+brand.toUpperCase()}"><img class="brand-synk" src="${url('synk')}" alt="">${brand==='synk'?'':`<img class="division-stitch-logo" data-division="${brand.toUpperCase()}" src="${url(brand)}" alt="">`}</div></div>`;
  await page.locator('.sheet .brand').evaluateAll((es,html)=>es.forEach(e=>e.outerHTML=html),markup);
  await page.addStyleTag({content:loom.계정컬렉션()});
  await page.evaluate(async()=>{await Promise.all([...document.images].map(x=>x.decode()));});
  const after=await page.locator('.sheet').evaluateAll(es=>es.map(e=>{const copy=e.cloneNode(true);copy.querySelector('.reference-brand')?.remove();return copy.textContent}));
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Document text changed: '+brand);
  for(const num of pages){
   const sheet=page.locator('.sheet').nth(num-1),target=path.join(out,`${brand}-${num}.png`);
   await sheet.screenshot({path:target,animations:'disabled'});
   const stats=await sheet.evaluate(e=>{const s=e.getBoundingClientRect(),b=e.querySelector('.brand-lock').getBoundingClientRect();return{logo:{left:b.left-s.left,top:b.top-s.top,right:b.right-s.left,bottom:b.bottom-s.top},flatLogoCount:e.querySelectorAll('.brand svg,.division-name,.division-stitch').length}});
   report.push({file:path.basename(target),source:path.relative(root,input).replaceAll('\\','/'),sourceSha256:beforeFile,sourceFileUnchanged:beforeFile===hash(fs.readFileSync(input)),textUnchanged:true,bodyTextSha256:hash(before[num-1]),outputSha256:hash(fs.readFileSync(target)),...stats});
  }
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'검증.json'),JSON.stringify({createdAt:new Date().toISOString(),change:'Only header lockup replaced in derived DOM. Original HTML and all non-logo text retained.',items:report},null,2));
 console.log(JSON.stringify(report,null,2));
})();
