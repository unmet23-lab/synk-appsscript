// A/B: is the slowdown from the ground discard patch or from the baked GLB?
const fs=require('node:fs'),path=require('node:path');const L=require(path.resolve('experiences/synk-town/qa/blender-district-20261017/lib.cjs'));
const poses=require(path.resolve('.tmp/town-blender-20261017/captures/poses.json'));
const src=fs.readFileSync('experiences/synk-town/day-district.mjs','utf8');
const variants={v20:{query:''},claude:{query:'&district=cafe-claude'},argon:{query:'&district=cafe-argon'}};
(async()=>{let b;const out=[];try{const {base}=await L.fixture();b=await L.launch();
for(let r=0;r<2;r++)for(const [name,v] of Object.entries(variants)){
  const page=await b.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2,bypassCSP:true});
  await page.route('**/day-district.mjs',async route=>{let body=src;if(v.patch){const n=v.patch(body);if(n===body)throw Error('patch miss '+name);body=n;}await route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body});});
  await page.route('**/day-scene.mjs',async route=>{let body=fs.readFileSync('experiences/synk-town/day-scene.mjs','utf8').replace(/\r\n/g,'\n').replace('cameraTarget.lerp(target, cameraBlend); camera.lookAt(cameraTarget);','cameraTarget.lerp(target, cameraBlend); camera.lookAt(cameraTarget); if (globalThis.__townCam) { const o = globalThis.__townCam; camera.position.fromArray(o.p); if (camera.fov !== o.fov) { camera.fov = o.fov; camera.updateProjectionMatrix(); } camera.lookAt(o.t[0], o.t[1], o.t[2]); }');await route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body});});
  await page.goto(base+'/day.html?play=walk'+v.query);await page.waitForFunction(()=>globalThis.SYNKTownDay?.metrics()?.assetsReady,{}, {timeout:90000});await L.delay(1500);
  const row={r,name};for(const view of ['wide','follow']){await page.evaluate(p=>{globalThis.__townCam=p},poses['1280x900-'+view]);await L.delay(1500);row[view]=(await L.stationaryFps(page,6)).fps;}
  row.district=await page.evaluate(()=>SYNKTownDay.metrics().bakedDistrict);if(r===0&&name!=='v20'){await page.evaluate(p=>{globalThis.__townCam=p},poses['1280x900-follow']);await L.delay(800);await page.screenshot({path:'.tmp/town-blender-20261017/captures/cut-'+name+'.png'});}console.log(JSON.stringify({...row,district:row.district&&{cut:row.district.cutGroundMeshes,dropped:row.district.droppedGroundPieces,parked:row.district.parkedGroundInstances,prep:row.district.prepareMs}}));out.push(row);await page.close();}
}catch(e){console.error(e)}finally{await L.closeAll(b);fs.writeFileSync('.tmp/town-blender-20261017/captures/ab-cut.json',JSON.stringify(out,null,1));}})();
