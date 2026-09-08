'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),sharp=require('sharp'),{chromium}=require('playwright');
const dir=path.join(__dirname,'로고디테일'),exportDir=path.join(dir,'로고_투명');
(async()=>{
 fs.mkdirSync(exportDir,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});const page=await context.newPage();const strips=[];const report=[];
 for(const [i,key] of ['lab','shift','pulse'].entries()){
  const url=pathToFileURL(path.join(__dirname,key+'.html')).href+'?export';
  await page.goto(url);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()))});
  const strip=path.join(dir,`${key}-완성.png`);await page.screenshot({path:strip,clip:{x:55,y:18,width:375,height:110}});strips.push({input:strip,left:0,top:i*236});
  report.push(await page.locator('.sheet .brand').first().evaluate(b=>({brand:b.dataset.lockup,smallFont:getComputedStyle(document.querySelectorAll('.brand>.division')[1]).fontSize,coverFont:getComputedStyle(b.querySelector('.division')).fontSize,stitchHeight:getComputedStyle(b.querySelector('.division-stitch')).height,stitchImageHeight:getComputedStyle(b.querySelector('.division-stitch img')).height,color:getComputedStyle(b.querySelector('.division')).color,synkPaths:[...b.querySelectorAll('svg path')].map(p=>({d:p.getAttribute('d'),fill:p.getAttribute('fill')}))})));
  for(const variant of ['표지형','기본형']){
   if(variant==='기본형')await page.locator('.brand').first().evaluate(b=>b.classList.remove('brand--cover'));
   const box=await page.locator('.brand').first().boundingBox();
   const outputContext=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:3840/box.width});const outputPage=await outputContext.newPage();
   await outputPage.goto(url);await outputPage.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()))});
   if(variant==='기본형')await outputPage.locator('.brand').first().evaluate(b=>b.classList.remove('brand--cover'));
   await outputPage.addStyleTag({content:'html,body,.sheet{background:transparent!important}.sheet>*:not(.brand){visibility:hidden!important}'});
   const file=path.join(exportDir,`SYNK-${key.toUpperCase()}-${variant}-4K.png`);const raster=await outputPage.locator('.brand').first().screenshot({omitBackground:true});await sharp(raster).resize({width:3840}).png().toFile(file);
   await outputContext.close();
  }
 }
 await sharp({create:{width:750,height:692,channels:3,background:'#FBF7F0'}}).composite(strips).png().toFile(path.join(dir,'완성로고.png'));
 const original=require(path.resolve(__dirname,'../../..','tools/lib/로고정본.js')).워드마크({판:'라이트',표현:'민',신호:'k',색갈래:'단색'});
 const expected=[...original.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)].map(m=>({d:m[1],fill:m[2]}));
 for(const r of report){if(JSON.stringify(r.synkPaths)!==JSON.stringify(expected))throw new Error('SYNK 원본 경로 또는 색이 다름');delete r.synkPaths;r.synkOriginalUnchanged=true;}
 fs.writeFileSync(path.join(dir,'로고검사.json'),JSON.stringify(report,null,2));
 await browser.close();console.log('완성 로고 보기와 투명 배경 4K 로고 6종 생성. SYNK 원본 경로·색 3/3 동일.');
})().catch(e=>{console.error(e);process.exitCode=1});
