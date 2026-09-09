const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const url='http://127.0.0.1:4439/pulse/scene-assets/qa/world.html';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 const check=(name,detail)=>checks.push({name,result:'passed',detail});
 const state=()=>page.evaluate(()=>world.getNavigationState());
 const distance=(a,b)=>Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2]);
 try {
  await page.goto(url);await page.waitForFunction(()=>window.worldReady,null,{timeout:60000});
  await page.locator('canvas').focus();const start=await state();
  await page.keyboard.down('w');await page.waitForTimeout(650);await page.keyboard.up('w');const walked=await state();
  assert(distance(start,walked)>1.1&&distance(start,walked)<2.2);check('W walks at elapsed-time speed',{distance:distance(start,walked)});
  await page.keyboard.down('s');await page.waitForTimeout(650);await page.keyboard.up('s');assert(distance(start,await state())<.4);check('S reverses direction');
  const beforeStrafe=await state();await page.keyboard.down('d');await page.waitForTimeout(400);await page.keyboard.up('d');assert(distance(beforeStrafe,await state())>.7);check('D strafes');
  await page.keyboard.down('a');await page.waitForTimeout(400);await page.keyboard.up('a');assert(distance(beforeStrafe,await state())<.4);check('A strafes back');
  await page.keyboard.down('w');await page.waitForTimeout(150);await page.locator('#test-input').focus();const inputStart=await state();
  await page.locator('#test-input').fill('wasd e');await page.waitForTimeout(500);await page.keyboard.up('w');assert(distance(inputStart,await state())<.05);assert.deepEqual((await state()).keys,[]);check('Input focus stops held movement; WASD text does not move');
  await page.locator('canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(150);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const blurred=await state();await page.waitForTimeout(450);await page.keyboard.up('w');assert(distance(blurred,await state())<.05);check('Window blur clears held keys');
  const yaw=(await state()).yaw;await page.mouse.move(600,430);await page.mouse.down();await page.mouse.move(810,470,{steps:10});await page.mouse.up();assert(Math.abs((await state()).yaw-yaw)>.45);assert.equal(await page.evaluate(()=>inspections.length),0);check('Pointer drag changes look without accidental inspect');
  for(const id of ['tram','radio','buoy','postbox']){await page.evaluate(id=>world.focus(id),id);assert.equal((await state()).nearest,id);assert.equal((await state()).mode,'walk');}
  check('All four focus alternatives end at safe reachable inspection positions');
  await page.locator('canvas').focus();await page.keyboard.press('e');assert.deepEqual(await page.evaluate(()=>inspections),['postbox']);check('E inspects the nearest physical object once');
  const pure=await page.evaluate(async()=>{
   const {isWalkable,moveWithCollision}=await import('../../world-navigation.js');
   const sea={x:-9,z:2};moveWithCollision(sea,-100,0);
   const building={x:8,z:14};moveWithCollision(building,100,0);
   const tram={x:4,z:-2};moveWithCollision(tram,-4,0);
   const back={x:4,z:20};moveWithCollision(back,0,100);
   return{sea,building,tram,back,valid:[sea,building,tram,back].every(p=>isWalkable(p.x,p.z)),forbidden:[isWalkable(0,-2),isWalkable(-7.2,12.7),isWalkable(9.25,-3.15)]};
  });
  assert(pure.valid);assert(pure.sea.x>=-9.79);assert(pure.building.x<=9.79);assert(pure.tram.x>2);assert(pure.back.z<=23.74);assert.deepEqual(pure.forbidden,[false,false,false]);check('Swept collision blocks water, building edge, tram, postbox, desk and outer boundary',pure);
  await page.evaluate(()=>world.focus('tram'));await page.locator('canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(2200);await page.keyboard.up('w');assert((await state()).collisions>0);check('Real held WASD stops against repair cabinet or tram');
  await page.evaluate(()=>world.setCameraMode('overview'));assert.equal((await state()).mode,'overview');await page.evaluate(()=>world.setWalkMode(true));assert.equal((await state()).mode,'walk');check('Overview / walk return');
  await page.evaluate(()=>world.setPhase('entry'));const disabled=await state();await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');assert(distance(disabled,await state())<.05);assert(await page.locator('#hotspots').evaluate(e=>e.inert));check('Entry prevents walking and hidden hotspot focus');
  await page.evaluate(()=>{world.setPhase('exploring');world.updateRestoration({power:{solved:true,rotations:[1,2,3]},radio:{solved:true,frequency:97.5}});});
  let restored=await page.evaluate(()=>world.getMetrics().restoration);assert.equal(restored.workLight,13);assert.equal(restored.radioLight,2.8);assert.deepEqual(restored.rotations,[1,2,3]);assert.equal(restored.frequency,97.5);check('Shared rotations, frequency and solved lights affect 3D equipment',restored);
  await page.evaluate(()=>{world.focus('tram');world.updateRestoration({power:{solved:true,rotations:[1,2,3]},radio:{solved:true,frequency:97.5}});});await page.waitForTimeout(250);await page.screenshot({path:path.join(__dirname,'world-restored-v2.png')});
  await page.evaluate(()=>world.updateRestoration({power:{solved:false},radio:{solved:false}}));restored=await page.evaluate(()=>world.getMetrics().restoration);assert.equal(restored.workLight,0);assert.equal(restored.radioLight,0);check('Reset switches restored local lights off');
  const perf=[];
  for(const quality of ['high','low']){
   await page.evaluate(q=>{world.setQuality(q);world.setReducedMotion(false);world.focus('street');},quality);await page.waitForTimeout(350);
   const measured=await page.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now(),start=last;function tick(now){times.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(tick);else{times.sort((a,b)=>a-b);resolve({seconds:(now-start)/1000,frames:times.length,fps:times.length/((now-start)/1000),p95FrameMs:times[Math.floor(times.length*.95)],metrics:world.getMetrics()});}}requestAnimationFrame(tick);}));
   perf.push({quality,...measured});
   if(quality==='low'){assert.equal(measured.metrics.contactOcclusion,false);assert.equal(measured.metrics.reflections,false);assert.equal(measured.metrics.silhouetteFibres,false);}
  }
  check('Manual light quality actually disables expensive effects');
  const events=await page.evaluate(()=>sceneEvents);assert(events.some(e=>e.step===true));assert(events.some(e=>e.zone==='radio'));assert(events.some(e=>e.moving===false));check('Bounded sound events contain footsteps, zones and stop');
  assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),environment:'Windows / installed Chrome / headless WebGL2 / 1440x900 DPR 1; local observation only',checks,perf,errors};
  await fs.writeFile(path.join(__dirname,'verification-v2.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){console.error(e.stack);await fs.writeFile(path.join(__dirname,'verification-v2-failed.json'),JSON.stringify({date:new Date().toISOString(),checks,errors,error:e.stack},null,2));process.exitCode=1;}
 finally{await browser.close();}
})();
