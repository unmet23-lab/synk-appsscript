'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),sharp=require('sharp'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const checks=[];const preview=[];
 for(const scale of [1,2]){
 const context=await browser.newContext({viewport:{width:1080,height:1350},deviceScaleFactor:scale});const page=await context.newPage();
 await page.goto(pathToFileURL(path.join(__dirname,'carousel.html')).href+'?export');
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()))});
 const dir=path.join(__dirname,scale===1?'캐러셀_업로드':'캐러셀_고해상도');fs.mkdirSync(dir,{recursive:true});
 const cards=page.locator('.card');
 for(let i=0;i<await cards.count();i++){
  const p=path.join(dir,`${String(i+1).padStart(2,'0')}.png`);await cards.nth(i).screenshot({path:p});
  if(scale===1)preview.push({input:await sharp(p).resize(324,405).png().toBuffer(),left:i%4*340,top:Math.floor(i/4)*421});
 }
 if(scale===1)checks.push(...await page.evaluate(()=>[...document.querySelectorAll('.card')].map(s=>{const b=s.getBoundingClientRect(),c=s.querySelector('.copy').getBoundingClientRect();return {page:s.dataset.card,copyBottom:c.bottom-b.top,overflow:[...s.querySelectorAll('h1,p,.options,.footer')].filter(e=>{const r=e.getBoundingClientRect();return r.left<b.left||r.right>b.right||r.bottom>b.bottom}).map(e=>e.textContent)}})));
 await context.close();
 }
 await sharp({create:{width:1344,height:826,channels:3,background:'#262320'}}).composite(preview).png().toFile(path.join(__dirname,'미리보기','캐러셀-전체.png'));
 fs.writeFileSync(path.join(__dirname,'캐러셀검사.json'),JSON.stringify(checks,null,2));
 await browser.close();console.log('캐러셀 7/7장 · 업로드용 1080×1350, 고해상도 2160×2700');
})().catch(e=>{console.error(e);process.exitCode=1});
