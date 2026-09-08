'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
(async()=>{
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page = await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
  const checks=[];
  for(let i=1;i<=7;i++){
    const name=String(i).padStart(2,'0');
    await page.goto(pathToFileURL(path.join(__dirname,name+'.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    const result=await page.evaluate(()=>{
      const sels=['.content','.바닥','.몽글'];
      const rects=Object.fromEntries(sels.map(s=>{const el=document.querySelector(s);if(!el)return[s,null];const r=el.getBoundingClientRect();return[s,{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}]}));
      const errors=[];
      for(const [s,r] of Object.entries(rects))if(r&&(r.x<0||r.y<0||r.right>1081||r.bottom>1351))errors.push(s+' 밖으로 나감');
      const b=rects['.몽글'];
      for(const el of document.querySelectorAll('.content h1,.content .label,.content .kr,.content .mn,.content .note,.content .hook')){
        const a=el.getBoundingClientRect();
        if(a.left<70||a.right>1010||a.top<150||a.bottom>1170)errors.push('텍스트 안전영역 이탈: '+el.textContent);
        if(b&&a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y)errors.push('텍스트와 마스코트 겹침: '+el.textContent);
      }
      return {rects,errors,fonts:document.fonts.check('500 40px "Inter Tight"')&&document.fonts.check('500 40px "SUIT Variable"'),images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)};
    });
    checks.push({card:i,...result});
    await page.screenshot({path:path.join(__dirname,name+'.png')});
  }
  fs.writeFileSync(path.join(__dirname,'검사.json'),JSON.stringify(checks,null,2));
  const overview='<!doctype html><html lang="ko"><meta charset="utf-8"><title>SYNK LAB — 괜찮아요</title><style>body{margin:0;padding:24px;background:#2B2320}main{display:grid;grid-template-columns:repeat(4,270px);gap:16px}img{display:block;width:270px;height:337.5px}</style><main>'+Array.from({length:7},(_,i)=>`<img src="${String(i+1).padStart(2,'0')}.png" alt="${i+1}장">`).join('')+'</main></html>';
  fs.writeFileSync(path.join(__dirname,'전체보기.html'),overview);
  await page.setViewportSize({width:1176,height:739});
  await page.goto(pathToFileURL(path.join(__dirname,'전체보기.html')).href);
  await page.screenshot({path:path.join(__dirname,'전체보기.png')});
  await browser.close();
  const bad=checks.filter(x=>x.errors.length||!x.fonts||!x.images);
  console.log(JSON.stringify({cards:checks.length,passed:checks.length-bad.length,issues:bad}));
  if(bad.length)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
