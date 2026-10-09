const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.route('**/__avatar-loading-check',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Avatar resource checks</title>'}));await page.goto('http://127.0.0.1:4296/__avatar-loading-check');
 const result=await page.evaluate(async()=>{
  const {createMongleAvatar}=await import('/avatar-v3.mjs'),THREE=await import('/scene-assets/three.module.js'),checks=[];
  const check=(name,value)=>{if(!value)throw Error(name);checks.push(name);};
  const failed=await createMongleAvatar({textureLoader:{loadAsync:async()=>{throw Error('synthetic unavailable');}},mobile:true});
  check('missing albedo returns renderable procedural wool and explicit metrics',failed.metrics().assetFailures[0]?.reason==='load-failed'&&!!failed.group.getObjectByName('mongle-bell-scalloped-body'));
  const body=failed.group.getObjectByName('mongle-bell-scalloped-body');
  check('body colour does not drive normal or bump displacement',body.material.normalMap!==body.material.map&&!body.material.bumpMap);
  let packed=true,colours=true;
  failed.group.traverse(node=>{if(node.material?.aoMap)packed&&=node.material.aoMap===node.material.roughnessMap;if(node.material?.vertexColors&&node.geometry)colours&&=!!node.geometry.getAttribute('color');});
  check('AO red and roughness green share the same texture reference',packed);
  check('vertex-colour materials never sample absent zero-valued colour attributes',colours);
  failed.dispose();
  const actualSetTimeout=window.setTimeout;let requestedTimeout=null,release;
  window.setTimeout=(fn,ms,...args)=>{if(ms===12000)requestedTimeout=ms;return actualSetTimeout(fn,ms===12000?5:ms,...args);};
  let delayed;
  try{delayed=await createMongleAvatar({textureLoader:{loadAsync:()=>new Promise(resolve=>release=resolve)},mobile:true});}
  finally{window.setTimeout=actualSetTimeout;}
  check('unresolved albedo reaches its configured 12 second deadline',requestedTimeout===12000&&delayed.metrics().assetFailures[0]?.reason==='timeout');
  const late=new THREE.Texture();let disposed=0;late.addEventListener('dispose',()=>disposed++);release(late);await Promise.resolve();await Promise.resolve();
  check('a texture arriving after timeout is disposed instead of leaking',disposed===1);delayed.dispose();
  return {passed:checks.length,checks,deadlineTimerAcceleratedForTest:true,realDevicePerformance:false};
 });
 fs.writeFileSync(path.join(__dirname,'loading-checks.json'),JSON.stringify({...result,checkedAtUtc:new Date().toISOString()},null,2));console.log(result);
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
