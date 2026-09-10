'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const {loadVisions,sourceDigest}=require(path.resolve(__dirname,'../../../tools/lib/비전정본.js'));
const visions=loadVisions(),out=path.join(__dirname,'_검토');
const normal=s=>s.replace(/\s+/g,' ').trim();
function revalidateCopy(){
 const target=path.join(out,'비전실물검증_20260911.json');
 const report=JSON.parse(fs.readFileSync(target,'utf8'));
 const manifestPath=path.join(__dirname,'비전_반영.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const copy=JSON.parse(fs.readFileSync(path.join(__dirname,'소개서_문안.json'),'utf8'));
 const index=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 assert.deepEqual(manifest.brands,visions,'제작 당시 비전과 현재 비전이 다릅니다.');
 for(const [key,v] of Object.entries(visions)){
  const cover=copy[key].find(p=>p.type==='cover');
  const rendered=report.covers.find(p=>p.brand===key);
  assert.equal(normal(cover.title),v.headline);assert.equal(normal(cover.body),v.subtext);
  assert.equal(normal(rendered.headline),v.headline);assert.equal(normal(rendered.subtext),v.subtext);
  const html=fs.readFileSync(path.join(__dirname,key+'.html'),'utf8');
  assert.ok(html.includes(v.headline)&&html.includes(v.subtext),key+' 소개서 HTML 비전 불일치');
  assert.ok(index.includes(v.headline)&&index.includes(v.subtext),key+' 모아보기 비전 불일치');
  for(const check of report.index)assert.ok(check.headlines.includes(v.headline)&&check.subtexts.includes(v.subtext));
 }
 const current=sourceDigest(),at=new Date().toISOString();
 report.originalRenderingSourceSha256??=report.sourceSha256;
 report.sourceSha256=current;
 report.copyRevalidation={at,canonicalPairsMatched:8,pdfRegenerated:false};
 manifest.originalRenderingSourceSha256??=manifest.sha256;
 manifest.sha256=current;
 manifest.copyRevalidatedAt=at;
 fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({sourceSha256:current,canonicalPairsMatched:8,pdfRegenerated:false}));
}
(async()=>{
 if(process.argv.includes('--copy-only'))return revalidateCopy();
 const {chromium}=require('playwright');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const report={sourceSha256:sourceDigest(),covers:[],index:[]};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  for(const [key,vision] of Object.entries(visions)){
   await page.goto(pathToFileURL(path.join(__dirname,key+'.html')).href);
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
   const copy=await page.locator('.cover').evaluate(el=>({headline:el.querySelector('h1').textContent,subtext:el.querySelector('.bodycopy').textContent,images:[...el.querySelectorAll('img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,width:i.naturalWidth,height:i.naturalHeight})),suit:document.fonts.check('800 60px "SUIT Variable"','한국어'),inter:document.fonts.check('500 26px "Inter Tight"','SYNK LAB')}));
   if(normal(copy.headline)!==vision.headline||normal(copy.subtext)!==vision.subtext)throw Error('Canonical copy mismatch '+key);
   if(copy.images.some(x=>!x.loaded)||!copy.suit||!copy.inter)throw Error('Image or font loading failed '+key);
   report.covers.push({brand:key,headlineMatched:true,subtextMatched:true,...copy});
  }
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
   const check=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headlines:[...document.querySelectorAll('.vision-headline')].map(x=>x.textContent),subtexts:[...document.querySelectorAll('.vision-subtext')].map(x=>x.textContent),brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
   if(check.scrollWidth>width||check.brokenImages.length)throw Error('Index overflow or image failure');
   for(const v of Object.values(visions))if(!check.headlines.includes(v.headline)||!check.subtexts.includes(v.subtext))throw Error('Index omitted a canonical vision');
   await page.screenshot({path:path.join(out,`비전모아보기-${width}.png`),fullPage:true});
   report.index.push(check);
  }
  await page.close();
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'비전실물검증_20260911.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({covers:report.covers.length,canonicalPairsMatched:8,indexWidths:report.index.map(x=>x.width),overflow:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
