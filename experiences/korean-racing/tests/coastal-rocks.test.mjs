import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createCoastalRocks} from '../coastal-rocks.js';
import {createLandscapeHeight} from '../landscape.js';
const file=fs.readFileSync(new URL('../assets/coastal-rocks-v6.glb',import.meta.url));
const jsonLength=file.readUInt32LE(12),document=JSON.parse(file.subarray(20,20+jsonLength).toString()),binStart=28+jsonLength;
const pathX=s=>Math.sin(s/235)*25+Math.sin(s/580)*31,pathY=s=>23+Math.sin(s/280)*2.8+Math.sin(s/100)*1.2;
const groundHeight=createLandscapeHeight(pathX,pathY);
function attr(id){const a=document.accessors[id],v=document.bufferViews[a.bufferView],offset=binStart+v.byteOffset+(a.byteOffset||0);const bytes=file.buffer.slice(file.byteOffset+offset,file.byteOffset+offset+v.byteLength);return new THREE.BufferAttribute(a.componentType===5125?new Uint32Array(bytes):new Float32Array(bytes),{VEC3:3,VEC2:2,SCALAR:1}[a.type]);}
function scanSource(){const source=new THREE.Group();for(const node of document.nodes){const data=document.meshes[node.mesh].primitives[0],g=new THREE.BufferGeometry();for(const [key,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])g.setAttribute(name,attr(data.attributes[key]));g.setIndex(attr(data.indices));const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial());mesh.name=node.name;source.add(mesh);}return source;}
function rocks(){return createCoastalRocks(THREE,{source:scanSource(),pathX,groundHeight});}
test('prepared coastal scan is bounded and complete with finite attributes, intact UVs and embedded JPEGs',()=>{
 assert.equal(file.readUInt32LE(8),file.length);assert(file.length<2100000);
 for(const mesh of document.meshes){const p=mesh.primitives[0];for(const id of Object.values(p.attributes))assert(attr(id).array.every(Number.isFinite));const pos=attr(p.attributes.POSITION),uv=attr(p.attributes.TEXCOORD_0);assert.equal(pos.count,uv.count);for(const i of attr(p.indices).array)assert(i<pos.count);}
 for(const image of document.images){const view=document.bufferViews[image.bufferView];assert.equal(file[binStart+view.byteOffset],255);assert.equal(file[binStart+view.byteOffset+1],216);}
});
test('all actual scan vertices remain outside the road and its full shoulder at every placement',()=>{
 const c=rocks(),point=new THREE.Vector3();c.group.updateMatrixWorld(true);let clear=Infinity;
 for(const mesh of c.group.children){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);clear=Math.min(clear,point.x-pathX(point.z));}}
 assert(clear>12,`coast scan intrudes on the road: ${clear}`);c.dispose();
});
test('mobile uses shared light geometry and distance culling; high detail only in the near segment',()=>{
 const c=rocks();let maxHigh=0,maxLow=0;
 for(let s=0;s<=2250;s+=10){c.update({playerS:s,quality:'high'});maxHigh=Math.max(maxHigh,c.stats.triangles);c.update({playerS:s,quality:'low'});maxLow=Math.max(maxLow,c.stats.triangles);for(const mesh of c.group.children.filter(m=>m.visible))assert.equal(mesh.geometry.index.count/3,c.stats.farTriangles);}
 assert(maxHigh<31000);assert(maxLow<9200);assert.equal(c.stats.shadowDrawCalls,0);
 c.update({playerS:-5000,quality:'low'});assert.equal(c.stats.visible,0);c.dispose();
});
test('both detail levels submerge the outer scan border at every placement without moving its horizontal footprint',()=>{
 const source=scanSource(),near=source.getObjectByName('coastal-rock-near').geometry;
 near.computeBoundingBox();const centre=near.boundingBox.getCenter(new THREE.Vector3()),size=near.boundingBox.getSize(new THREE.Vector3());
 const c=createCoastalRocks(THREE,{source,pathX,groundHeight}),point=new THREE.Vector3();let checked=0;
 c.group.updateMatrixWorld(true);
 for(const quality of ['high','low'])for(const mesh of c.group.children){
  c.update({playerS:mesh.userData.s,quality});const position=mesh.geometry.attributes.position;
  const original=source.getObjectByName(quality==='high'?'coastal-rock-near':'coastal-rock-far').geometry.attributes.position;
  for(let i=0;i<position.count;i++){
   assert(Math.abs(position.getX(i)-(original.getX(i)-centre.x))<3e-6);
   assert(Math.abs(position.getZ(i)-(original.getZ(i)-centre.z))<3e-6);
   const radius=Math.hypot(position.getX(i)/(size.x/2),position.getZ(i)/(size.z/2));
   if(radius<.95)continue;
   point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
   assert(point.y< -2.35,`${mesh.name}/${quality} has a visible cut border at ${point.y}`);checked++;
  }
 }
 assert(checked>1000);c.dispose();
});
test('shore finish preserves the original scan, UVs, triangle budget and central relief with finite unit normals',()=>{
 const source=scanSource(),before=source.children.map(m=>({p:m.geometry.attributes.position.array.slice(),n:m.geometry.attributes.normal.array.slice()}));
 const c=createCoastalRocks(THREE,{source,pathX,groundHeight}),mesh=c.group.children[1],levels=[];
 for(const [quality,name] of [['high','coastal-rock-near'],['low','coastal-rock-far']]){
  c.update({playerS:mesh.userData.s,quality});const current=mesh.geometry,original=source.getObjectByName(name).geometry;
  levels.push(current);assert.deepEqual(current.attributes.uv.array,original.attributes.uv.array);assert.deepEqual(current.index.array,original.index.array);
  assert.equal(current.attributes.position.count,original.attributes.position.count);
  let preserved=0,lowered=0;const p=current.attributes.position,n=current.attributes.normal;
  for(let i=0;i<p.count;i++){
   assert(Number.isFinite(p.getY(i)));assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);
   if(Math.hypot(p.getX(i)/30,p.getZ(i)/21)<.5){assert.equal(p.getY(i),original.attributes.position.getY(i));preserved++;}
   if(p.getY(i)<original.attributes.position.getY(i)-.05)lowered++;
  }
  assert(preserved>100);assert(lowered>100);
 }
 assert.notEqual(levels[0],levels[1]);assert.equal(c.stats.nearTriangles,10491);assert.equal(c.stats.farTriangles,2298);
 for(let i=0;i<source.children.length;i++){assert.deepEqual(source.children[i].geometry.attributes.position.array,before[i].p);assert.deepEqual(source.children[i].geometry.attributes.normal.array,before[i].n);}
 c.dispose();
});
