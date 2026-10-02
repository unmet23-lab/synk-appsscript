'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const out=path.join(__dirname,'검증');fs.mkdirSync(out,{recursive:true});
 const checks=[],errors=[];
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:960}});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
   await page.waitForFunction(()=>[...document.querySelectorAll('audio')].length===10&&[...document.querySelectorAll('audio')].every(a=>a.readyState>=1));
   await page.evaluate(()=>document.fonts.ready);
   const start=await page.evaluate(()=>({audio:[...document.querySelectorAll('audio')].map(a=>({src:a.currentSrc,duration:a.duration,paused:a.paused,error:a.error?.code||null})),identitiesHidden:[...document.querySelectorAll('.identity')].every(e=>e.hidden),scrollWidth:document.documentElement.scrollWidth,width:innerWidth}));
   await page.screenshot({path:path.join(out,'청취-'+width+'.png')});
   await page.locator('.restart').nth(0).click();
   await page.waitForFunction(()=>document.querySelector('audio').currentTime>.05);
   await page.locator('.restart').nth(1).click();
   await page.waitForFunction(()=>document.querySelectorAll('audio')[0].paused&&!document.querySelectorAll('audio')[1].paused);
   await page.evaluate(()=>document.querySelectorAll('audio')[1].pause());
   const restarted=await page.evaluate(()=>document.querySelectorAll('audio')[1].currentTime);
   await page.locator('#reveal').click();
   await page.locator('details').last().locator('summary').click();
   const expanded=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,rows:document.querySelectorAll('#model-details>.table-wrap tbody tr').length,reportVisible:document.querySelector('.report').getBoundingClientRect().height>0,errors:[...document.querySelectorAll('.sample-error')].filter(e=>!e.hidden).map(e=>e.textContent)}));
   await page.locator('#research').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,'조사-'+width+'.png')});
   if(start.audio.some(a=>!a.paused||a.error||!Number.isFinite(a.duration))||!start.identitiesHidden||start.scrollWidth>width+1||expanded.scrollWidth>width+1||expanded.rows!==29||expanded.errors.length)throw Error('Invalid listening page '+JSON.stringify({width,start,expanded}));
   checks.push({width,start,expanded,exclusivePlayback:true,restartPlayedFromBeginning:restarted<2});
   await page.close();
  }
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'청취페이지검사.json'),JSON.stringify({checkedAt:new Date().toISOString(),status:'passed',checks,errors,humanListening:false},null,2));
  console.log(JSON.stringify({status:'passed',widths:checks.map(x=>x.width),audio:10,models:29,humanListening:false}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
