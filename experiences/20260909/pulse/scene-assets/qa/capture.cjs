const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto('http://127.0.0.1:4439/pulse/scene-assets/qa/world.html');
 try{await page.waitForFunction(()=>window.worldReady,{timeout:60000});}catch(e){console.log(JSON.stringify({errors,error:e.message}));await browser.close();return;}
 await page.waitForTimeout(1700);
 await page.screenshot({path:path.join(__dirname,'world-street-v2.png')});
 await page.evaluate(()=>window.world.focus('tram'));await page.waitForTimeout(500);
 await page.screenshot({path:path.join(__dirname,'world-tram-v2.png')});
 await page.evaluate(()=>window.world.focus('radio'));await page.waitForTimeout(500);
 await page.screenshot({path:path.join(__dirname,'world-radio-v2.png')});
 const metrics=await page.evaluate(()=>window.world.getMetrics());
 await fs.writeFile(path.join(__dirname,'render-v2.json'),JSON.stringify({date:new Date().toISOString(),errors,metrics},null,2));
 console.log(JSON.stringify({errors,metrics}));await browser.close();
})();
