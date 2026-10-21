const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

(async () => {
  const town = path.resolve(__dirname,'../..');
  const THREE = await import(pathToFileURL(path.resolve(town,'../synk-world-home/scene-assets/three.module.js')));
  const source = fs.readFileSync(path.join(town,'day-environment.mjs'),'utf8');
  const baseline = fs.readFileSync(path.join(__dirname,'source-before/day-environment.mjs'),'utf8');
  const ctx = new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}},{get:(o,k)=>k in o?o[k]:()=>{}});
  global.document = {createElement:()=>({width:0,height:0,getContext:()=>ctx})};
  const keys = ['foliage','stone','paving','plasterWarm','plaster','wood','darkWood','awning','soil','cotton','lapis','coral','butter','glass','water','roofSlate','ceramic','paper','brass','tea','sage','linen','frame'];
  const m = Object.fromEntries(keys.map(k => [k,new THREE.MeshStandardMaterial({color:'#ffffff'})]));
  const {buildTownEnvironment} = await import(pathToFileURL(path.join(town,'day-environment.mjs')));
  const world = new THREE.Group(), environment = buildTownEnvironment(THREE,world,m);
  world.updateMatrixWorld(true);
  let invalid = 0, meshCount = 0, uniqueGeometry = new Set(), uniqueMaterial = new Set(), geometryDisposed = new Set(), materialDisposed = new Set(), instanceDisposed = new Set();
  const roots = world.children.length;
  world.traverse(o => {
    if(!o.isMesh)return;meshCount++;
    for(const value of o.matrixWorld.elements)if(!Number.isFinite(value))invalid++;
    uniqueGeometry.add(o.geometry);uniqueMaterial.add(o.material);
    for(const attribute of Object.values(o.geometry.attributes))for(const value of attribute.array)if(!Number.isFinite(value))invalid++;
    if(o.isInstancedMesh){for(const value of o.instanceMatrix.array)if(!Number.isFinite(value))invalid++;o.addEventListener('dispose',()=>instanceDisposed.add(o));}
  });
  for(const g of uniqueGeometry)g.addEventListener('dispose',()=>geometryDisposed.add(g));
  for(const m of uniqueMaterial)m.addEventListener('dispose',()=>materialDisposed.add(m));
  const protectedExtract = text => ({places:text.match(/const PLACES = .*?;/)[0],terrainHeight:text.match(/  const terrainHeight = \(x, z\) => \{[\s\S]*?\n  \};/)[0]});
  const unchanged = JSON.stringify(protectedExtract(source))===JSON.stringify(protectedExtract(baseline));
  const places = environment.buildings.map(g=>({id:g.userData.placeId,position:g.position.toArray()}));
  const hitTargets=environment.hitTargets.length, occlusionRoots=environment.occlusionRoots.map(g=>g.name);
  let allTransformsFrozen=true,allWorldTransformsPropagate=true,frozenTransformCount=0;
  const beforeWorld=[];
  world.traverse(o=>{if(o===world||o.isSprite)return;allTransformsFrozen&&=o.matrixAutoUpdate===false&&o.matrixWorldAutoUpdate!==false;frozenTransformCount++;beforeWorld.push({o,point:new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)});});
  // Moving the common ancestor must still move every frozen static descendant.
  world.position.set(3.25,-.7,2.1);world.rotation.y=.27;world.updateMatrixWorld(true);
  for(const {o,point}of beforeWorld){const actual=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);allWorldTransformsPropagate&&=actual.distanceTo(point.applyMatrix4(world.matrixWorld))<1e-6;}
  world.position.set(0,0,0);world.rotation.y=0;world.updateMatrixWorld(true);
  let expectedInstances=0;world.traverse(o=>{if(o.isInstancedMesh)expectedInstances++;});
  environment.dispose();environment.dispose();
  const stats=environment.stats;
  const passed = invalid===0 && roots===15 && world.children.length===0 && hitTargets===7 && occlusionRoots.length===14 && unchanged && stats.environmentTriangles <= 520000 && geometryDisposed.size===uniqueGeometry.size && instanceDisposed.size===expectedInstances && allTransformsFrozen && allWorldTransformsPropagate;
  const result={scope:'Pure Three geometry, transform, instancing, ownership, disposal, unchanged places and terrain; frozen local matrices with ancestor movement propagation. No GPU, real materials or visual quality claim.',source:'experiences/synk-town/day-environment.mjs',sha256:crypto.createHash('sha256').update(source).digest('hex'),stats,baselineEnvironmentTriangles:773002,triangleChangePercent:(stats.environmentTriangles/773002-1)*100,meshCount,invalid,places,protectedPlacesAndTerrainUnchanged:unchanged,hitTargetCount:hitTargets,occlusionRoots,rootsBefore:roots,rootsAfter:world.children.length,uniqueGeometries:uniqueGeometry.size,disposedGeometries:geometryDisposed.size,instancedMeshes:expectedInstances,disposedInstancedMeshes:instanceDisposed.size,ownedMaterialsDisposed:materialDisposed.size,frozenTransformCount,allTransformsFrozen,allWorldTransformsPropagate,passed};
  fs.writeFileSync(path.join(__dirname,'architecture-cpu.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  assert(passed,'architecture CPU validation failed');
})().catch(error=>{console.error(error);process.exitCode=1;});
