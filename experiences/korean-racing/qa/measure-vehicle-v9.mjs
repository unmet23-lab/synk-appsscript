// Source-asset geometry check, not an FPS benchmark. Uses only bundled files.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import {refineOriginalCar,setVehicleQuality,customizeCar} from '../vehicles.js';
import {loadVehicleModel} from './load-vehicle-model.mjs';

const template=await loadVehicleModel(),model=template.clone(true),car=new THREE.Group();
car.add(model);car.userData.model=model;car.userData.wheels=['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].map(n=>model.getObjectByName(n));
let barrels=0;const parts=[];
model.traverse(part=>{if(part.isMesh){const name=part.userData.name||part.name;part.castShadow=name!=='glass';part.receiveShadow=true;if(name==='wheel')barrels+=part.geometry.index.count/3;parts.push(part);}});
refineOriginalCar(car);
const high={...car.userData.modelStats},originals=new Map();
car.traverse(p=>{if(p.isMesh)originals.set(p,p.geometry);});
const before=new THREE.Box3().setFromObject(car);
setVehicleQuality(car,'low');
const low={...car.userData.modelStats},after=new THREE.Box3().setFromObject(car),reductions=[];
// Removed siblings retain the source-level reduction metadata for inspecting
// max displacement even when their rendered counterpart is a material batch.
for(const part of parts){const geometry=part.userData.vehicleGeometryLevels?.low;if(geometry?.userData.mobileReduction)reductions.push({name:part.name,...geometry.userData.mobileReduction});}
setVehicleQuality(car,'high');
const restored=[...originals].every(([p,g])=>p.geometry===g);
// Also execute the app's actual prepareCar/material assignment. Reproduce the
// old exact-name condition only in a separate in-memory module, never on disk.
const appSource=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
const vehicleSource=await fs.readFile(new URL('../vehicles.js',import.meta.url),'utf8');
const previousVehicleSource=vehicleSource.replace("from './vendor/three.module.js'",`from '${new URL('../vendor/three.module.js',import.meta.url).href}'`).replace('const name=part.userData.name||part.name;','const name=part.name;');
const previousVehicles=await import(`data:text/javascript;base64,${Buffer.from(previousVehicleSource).toString('base64')}`);
const prepareSource=appSource.slice(appSource.indexOf('function prepareCar('),appSource.indexOf('function seatMascot('));
const runtimeMeasurements=(previous=false)=>{
  const refine=previous?previousVehicles.refineOriginalCar:refineOriginalCar,setQuality=previous?previousVehicles.setVehicleQuality:setVehicleQuality;
  const context={THREE,refineOriginalCar:refine,scene:new THREE.Scene(),shadowPlane:()=>new THREE.Mesh(new THREE.PlaneGeometry(2.7,5.1),new THREE.MeshBasicMaterial())};
  const source=previous?prepareSource.replace('const name=o.userData.name||o.name;','const name=o.name;'):prepareSource;
  runInNewContext(`${source}\nglobalThis.makeCar=prepareCar;`,context);
  const runtimeCar=context.makeCar(template,0x99c8bc);customizeCar(runtimeCar,{badge:false});setQuality(runtimeCar,'high');
  const high={...runtimeCar.userData.modelStats};setQuality(runtimeCar,'low');const low={...runtimeCar.userData.modelStats};
  setQuality(runtimeCar,'high');return{high,low,restored:{...runtimeCar.userData.modelStats}};
};
const runtimeBeforeNameFix=runtimeMeasurements(true),runtimeAfterNameFix=runtimeMeasurements();
const hashes={};for(const name of ['vehicles.js','app.js','assets/car.glb','qa/load-vehicle-model.mjs'])hashes[name]=createHash('sha256').update(await fs.readFile(new URL(`../${name}`,import.meta.url))).digest('hex');
const report={
  scope:'Shipped GT GLB only; excludes runtime mascot, lamps, jets and contact shadow. Original GLB material partitions, not runtime paint groups. CPU geometry counts, not measured GPU FPS.',
  hashes,high,low,
  savedTriangles:high.triangles-low.triangles,savedPercent:100*(1-low.triangles/high.triangles),
  removedWheelBarrelShadowTriangles:barrels,
  runtimeScope:'Actual prepareCar plus hidden collection badge; no mascot or dynamically added shield. The exact-name baseline reproduces the browser omission without changing saved source.',
  runtimeBeforeNameFix,runtimeAfterNameFix,
  unchangedBounds:before.equals(after),restoredOriginalGeometry:restored,
  maxDisplacementMetres:Math.max(...reductions.map(r=>r.maxDeviation)),reductions
};
await fs.writeFile(new URL('./vehicle-v9-measurements.json',import.meta.url),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
