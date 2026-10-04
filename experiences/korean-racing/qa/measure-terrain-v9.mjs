import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {createLandscapeHeight} from '../landscape.js';
import {buildCourseTerrain} from '../render-world.js';

const pathX=s=>Math.sin(s/235)*25+Math.sin(s/580)*31;
const material=new THREE.MeshStandardMaterial();
function measure(reuse){
  let heightCalls=0;
  const groundHeight=createLandscapeHeight(pathX,s=>{heightCalls++;return 23+Math.sin(s/280)*2.8+Math.sin(s/100)*1.2;});
  if(!reuse){const surfaceAt=groundHeight.surfaceAt;groundHeight.surfaceAt=(x,z,y)=>surfaceAt(x,z,y);}
  const begin=performance.now(),world=buildCourseTerrain(THREE,{pathX,groundHeight,ROAD_END:2250,material}),ms=performance.now()-begin;
  const hash=createHash('sha256');
  world.group.traverse(mesh=>{if(!mesh.isMesh)return;for(const name of Object.keys(mesh.geometry.attributes).sort())hash.update(Buffer.from(mesh.geometry.attributes[name].array.buffer));hash.update(Buffer.from(mesh.geometry.index.array.buffer));});
  const result={reuse,ms:+ms.toFixed(3),heightCalls,triangles:world.stats.storedTriangles,vertices:world.stats.storedVertices,geometrySha256:hash.digest('hex')};
  world.dispose();return result;
}
// Alternating same-process samples: CPU microbenchmark, never a phone FPS claim.
const samples=[measure(false),measure(true),measure(false),measure(true)];
material.dispose();
if(new Set(samples.map(s=>s.geometrySha256)).size!==1)throw new Error('Terrain geometry changed during slope reuse');
const result={method:'Same-process alternating builds; legacy recomputes slope, v9 reuses the identical normal derivative. Hardware/JIT variance affects duration.',samples,heightCallsSaved:samples[0].heightCalls-samples[1].heightCalls};
await writeFile(new URL('terrain-v9-measurements.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
