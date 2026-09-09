const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:800,height:600}});
 // Synthetic slow scheduling tests the policy, not this machine's real frame rate.
 await page.addInitScript(()=>{const native=requestAnimationFrame;window.requestAnimationFrame=callback=>native(()=>setTimeout(()=>callback(performance.now()),75));});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4439/pulse/scene-assets/qa/world.html');await page.waitForFunction(()=>window.worldReady,null,{timeout:60000});
  await page.evaluate(()=>world.setQuality('auto'));
  await page.waitForFunction(()=>world.getMetrics().autoReduced,null,{timeout:25000});
  const metrics=await page.evaluate(()=>world.getMetrics());assert.equal(metrics.contactOcclusion,false);assert.equal(metrics.reflections,false);assert.equal(metrics.silhouetteFibres,false);assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),test:'Artificial 75ms requestAnimationFrame scheduling; policy check only, not hardware FPS',result:'passed',metrics,errors};
  await fs.writeFile(path.join(__dirname,'adaptation-v2.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})();
