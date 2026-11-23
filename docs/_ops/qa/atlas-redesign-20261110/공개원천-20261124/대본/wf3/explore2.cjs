const path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:['C:/Users/q1212/Documents/SYNK-appsscript/node_modules']}));
const OUT=path.resolve(process.argv[2]);fs.mkdirSync(OUT,{recursive:true});const steps=process.argv.slice(3);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Users/q1212/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe'});
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR',serviceWorkers:'block'});
 const page=await ctx.newPage();
 await page.goto('https://synk.im/world/',{waitUntil:'domcontentloaded',timeout:90000});await sleep(6000);
 await page.getByText('CLICK TO START').first().click({timeout:10000});await sleep(5000);
 console.log('frames',page.frames().map(f=>f.url().slice(0,80)));
 const dump=async tag=>{await page.screenshot({path:path.join(OUT,tag+'.png')});const t=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.innerText&&e.getBoundingClientRect().width>0).map(e=>e.tagName+':'+e.innerText.trim().slice(0,30)).slice(0,40));console.log('--',tag,JSON.stringify(t).slice(0,1500));};
 await dump('a-after-start');
 for(const [i,s] of steps.entries()){
  let ok=false;for(const f of page.frames()){try{await f.getByText(s,{exact:false}).first().click({timeout:4000});ok=true;break;}catch{}}
  await sleep(4500);await dump(`b${i}-${s}${ok?'':'(없음)'}`);
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
