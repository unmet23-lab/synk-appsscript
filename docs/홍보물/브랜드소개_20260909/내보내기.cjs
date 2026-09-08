'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require('playwright'),sharp=require('sharp');
const root=__dirname;
(async()=>{
 const full=process.argv.includes('--4k');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:full?8/3:1});
 const page=await context.newPage();const audit=[];const covers=[];
 fs.mkdirSync(path.join(root,'미리보기'),{recursive:true});
 fs.mkdirSync(path.join(root,'소개서_4K'),{recursive:true});
 for(const brand of ['synk','lab','shift','pulse']){
  await page.goto(pathToFileURL(path.join(root,brand+'.html')).href+'?export');
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()));});
  const sheets=page.locator('.sheet');const tiles=[];
  for(let i=0;i<await sheets.count();i++){
   const p=path.join(root,full?'소개서_4K':'미리보기',`${brand}-${i+1}.png`);
   await sheets.nth(i).screenshot({path:p});
   if(full)await sharp(p).resize(1440,900).png().toFile(path.join(root,'미리보기',`${brand}-${i+1}.png`));
   const buf=await sharp(p).resize(720,450).png().toBuffer();tiles.push({input:buf,left:(i%2)*744,top:Math.floor(i/2)*474});
   if(i===0)covers.push({input:buf,left:(covers.length%2)*744,top:Math.floor(covers.length/2)*474});
  }
  audit.push({brand,checks:await page.evaluate(()=>[...document.querySelectorAll('.sheet')].map(s=>{const b=s.getBoundingClientRect();return {page:s.dataset.page,overflow:[...s.querySelectorAll('h1,h3,p,figcaption,.cover-caption,.state,.line-pair,.lesson-talk,.folio')].filter(e=>{const r=e.getBoundingClientRect();return r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1}).map(e=>e.textContent),assets:[...s.querySelectorAll('img')].map(e=>({key:e.dataset.asset,natural:[e.naturalWidth,e.naturalHeight],display:[e.width,e.height]}))}}))});
  await sharp({create:{width:1464,height:1422,channels:3,background:'#262320'}}).composite(tiles).png().toFile(path.join(root,'미리보기',brand+'-전체.png'));
 }
 await sharp({create:{width:1464,height:924,channels:3,background:'#262320'}}).composite(covers).png().toFile(path.join(root,'미리보기','소개서-표지.png'));
 fs.writeFileSync(path.join(root,'지면검사.json'),JSON.stringify(audit,null,2));
 await browser.close();console.log(`${full?'3840×2400':'1440×900'} 소개서 20쪽 렌더 완료`);
})().catch(e=>{console.error(e);process.exitCode=1});
