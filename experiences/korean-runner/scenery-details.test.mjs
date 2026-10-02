import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from './vendor/three.module.js';
import {createSceneryDetails,DETAIL_CLEARANCE} from './scenery-details.mjs';

function fixture(){const scene=new T.Scene(),materials=new Map();const felt=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.94}));return materials.get(color);};return {scene,details:createSceneryDetails({scene,felt}),materials};}
function graphCount(scene){let count=0;scene.traverse(()=>count++);return count;}
test('each route has its own real three-dimensional scenery with a bounded render budget',()=>{
  const {scene,details}=fixture();
  for(const theme of ['blossom','snow','moonlight']){details.setTheme(theme);details.update(67);assert.equal(details.info.theme,theme);assert.ok(details.info.activeInstances>100);assert.ok(details.info.drawCalls<=16);for(const other of ['blossom','snow','moonlight'])assert.equal(scene.getObjectByName('scenery-detail-'+other).visible,other===theme);const full=details.info.activeInstances;details.update(67,{quality:'balanced'});assert.ok(details.info.activeInstances<full);details.update(67,{quality:'experience',reduced:true});assert.ok(details.info.activeInstances<full);}
  details.setTheme('unknown');assert.equal(details.info.activeInstances,0);assert.equal(details.info.theme,'village');
});
test('new scenery stays outside the running corridor or at least 5.4m overhead',()=>{
  const {scene,details}=fixture(),matrix=new T.Matrix4(),point=new T.Vector3();
  for(const theme of ['blossom','snow','moonlight']){details.setTheme(theme);details.update(0);const group=scene.getObjectByName('scenery-detail-'+theme);for(const mesh of group.children){const positions=mesh.geometry.getAttribute('position');for(let instance=0;instance<mesh.count;instance++){mesh.getMatrixAt(instance,matrix);for(let v=0;v<positions.count;v++){point.fromBufferAttribute(positions,v).applyMatrix4(matrix);assert.ok(Math.abs(point.x)>=DETAIL_CLEARANCE.courseHalfWidth||point.y>=DETAIL_CLEARANCE.overheadHeight,`${theme} ${mesh.name} enters action corridor at ${point.x.toFixed(2)},${point.y.toFixed(2)}`);}}}}
});
test('long replay and repeated preview switches retain their buffers, and final disposal frees owned resources',()=>{
  const {scene,details,materials}=fixture(),objectCount=graphCount(scene),bufferCount=details.info.bufferCount,instanceBuffers=new Set(),geometries=new Set();scene.traverse(m=>{if(m.isInstancedMesh){instanceBuffers.add(m.instanceMatrix.array);geometries.add(m.geometry);}});
  for(let i=0;i<1200;i++){details.setTheme(['blossom','snow','moonlight','village'][i%4]);details.update(i*41,{quality:i%2?'balanced':'experience',reduced:i%3===0});assert.equal(details.info.bufferCount,bufferCount);assert.equal(graphCount(scene),objectCount);}
  const afterwards=new Set();scene.traverse(m=>{if(m.isInstancedMesh)afterwards.add(m.instanceMatrix.array);});assert.deepEqual(afterwards,instanceBuffers);
  let released=0;for(const geometry of geometries)geometry.addEventListener('dispose',()=>released++);let sharedDisposed=0;for(const material of materials.values())material.addEventListener('dispose',()=>sharedDisposed++);
  details.dispose();assert.equal(released,geometries.size);assert.equal(sharedDisposed,0,'shared wool materials stay available to the game');assert.equal(scene.getObjectByName('windrun-scenery-details'),undefined);details.dispose();assert.equal(released,geometries.size,'disposing twice is safe');
});
