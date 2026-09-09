const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const own=path.resolve(__dirname,'../..');
 await page.route('**/pulse/**',async route=>{
  const pathname=new URL(route.request().url()).pathname,relative=pathname.split('/pulse/')[1];
  if(['scene.js','world-navigation.js','world-materials.js','world-atmosphere.js'].includes(relative)||relative.startsWith('scene-assets/ssao/')){
   await route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body:await fs.readFile(path.join(own,relative))});
  }else await route.continue();
 });
 try{
  await page.goto('http://127.0.0.1:4399/pulse/');await page.waitForFunction(()=>window.pulseScene,null,{timeout:60000});await page.waitForTimeout(500);
  await page.screenshot({path:path.join(__dirname,'app-entry-v2.png')});
  await page.locator('#dual-start').click();await page.waitForFunction(()=>document.querySelector('.experience').dataset.phase==='explore');
  await page.evaluate(()=>pulseScene.focus('tram'));await page.waitForTimeout(500);await page.screenshot({path:path.join(__dirname,'app-tram-overlay-v2.png')});
  const metrics=await page.evaluate(()=>pulseScene.getMetrics());
  // Comparison only: no product file is altered by this temporary test stylesheet.
  await page.addStyleTag({content:'.vignette{opacity:.22!important}.film-grain{opacity:.015!important}'});
  await page.screenshot({path:path.join(__dirname,'app-tram-overlay-comparison-v2.png')});
  await fs.writeFile(path.join(__dirname,'app-overlay-v2.json'),JSON.stringify({date:new Date().toISOString(),scope:'Root 4399 app/style/backend + locally routed owned scene modules; comparison stylesheet only in test page',errors,metrics},null,2));console.log(JSON.stringify({errors,metrics}));
 }finally{await browser.close();}
})();
