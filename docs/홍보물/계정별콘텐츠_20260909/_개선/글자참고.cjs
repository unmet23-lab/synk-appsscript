'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../../../..');
const colors=require(path.join(root,'tools/lib/loom.js')).정본().색;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:800},deviceScaleFactor:1});
 const font=fs.readFileSync(path.join(root,'docs/브랜드_폰트/InterTight/InterTight-SemiBold.ttf')).toString('base64');
 for(const [name,key] of Object.entries({LAB:'Coral 3',SHIFT:'Lapis Deep',PULSE:'Pop Deep'})){
  await page.setContent(`<style>@font-face{font-family:Exact;src:url(data:font/ttf;base64,${font});font-weight:600}body{margin:0;background:${colors.Paper};display:flex;align-items:center;justify-content:center;height:800px}span{font:600 300px Exact;letter-spacing:.02em;color:${colors[key]};font-synthesis:none}</style><span>${name}</span>`);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(__dirname,name+'-글자참고.png')});
 }
 await browser.close();
})();
