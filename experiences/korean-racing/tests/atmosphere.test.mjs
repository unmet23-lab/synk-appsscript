import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createAtmosphere} from '../atmosphere.js';
import {createLandscapeHeight} from '../landscape.js';

const pathX=s=>Math.sin(s/235)*25+Math.sin(s/580)*31;
const pathY=s=>23+Math.sin(s/280)*2.8+Math.sin(s/100)*1.2;
const landscape=createLandscapeHeight(pathX,pathY);
function setup(){
  const daySky=new THREE.Texture(),sunsetSky=new THREE.Texture();
  const time={value:0},sunDirection=new THREE.Vector3(.58,.72,.38).normalize();
  const a=createAtmosphere(THREE,{daySky,sunsetSky,time,sunDirection,shoreOffset:landscape.shoreOffset,groundHeight:landscape,pathX,ROAD_END:2250});
  return {a,daySky,sunsetSky,time,sunDirection};
}

test('water shoreline samples meet the actual cliff instead of a decorative straight foam stripe',()=>{
  const {a}=setup(),map=a.ocean.material.uniforms.shoreMap.value;
  assert.equal(map.image.width,512);assert.equal(map.image.height,1);
  let maxError=0;
  for(let i=0;i<map.image.width;i++){
    const z=-150+i/(map.image.width-1)*a.ocean.material.uniforms.shoreRange.value;
    const shore=map.image.data[i*4]/255*128;
    maxError=Math.max(maxError,Math.abs(shore-landscape.shoreOffset(z)));
    assert(Math.abs(landscape(pathX(z)+landscape.shoreOffset(z),z)-a.ocean.position.y)<.0004);
  }
  assert(maxError<128/255/2+.00001,'foam sample exceeds the documented half-texel height-strip precision');
  a.dispose();
});

test('packed shallow water depths follow the seabed within byte precision without an additional texture',()=>{
  const {a}=setup(),map=a.ocean.material.uniforms.shoreMap.value;
  assert.equal(a.stats.sampledDepth,true);assert.equal(a.stats.depthSamples,1536);
  assert.equal(map.image.data.byteLength,2048);
  for(let i=0;i<512;i++){
    const z=-150+i/511*(2250+500),edge=landscape.shoreOffset(z);
    [4,12,30].forEach((distance,j)=>{
      const expected=Math.max(0,Math.min(32,-2.2-landscape(pathX(z)+edge+distance,z)));
      const depth=map.image.data[i*4+1+j]/255*32;
      assert(Math.abs(depth-expected)<=32/255/2+1e-8,`Incorrect shelf depth at ${z}/${distance}`);
    });
  }
  a.dispose();
});

test('all themes share live sky, water and sunlight bindings without rotating caller-owned textures',()=>{
  const {a,daySky,sunsetSky,time,sunDirection}=setup();
  const uniforms=a.ocean.material.uniforms;
  for(const theme of ['sunset','bloom','coast','sunset']){
    a.setTheme(theme);
    assert.equal(uniforms.sky,a.sky.material.uniforms.map);
    assert.equal(uniforms.golden,a.sky.material.uniforms.golden);
    assert.equal(uniforms.sun.value,sunDirection);
    assert.equal(a.sky.material.uniforms.sun.value,sunDirection);
    assert.equal(uniforms.sky.value,theme==='sunset'?sunsetSky:daySky);
    assert.equal(uniforms.skyRotation.value,a.sky.rotation.y);
    assert(Math.abs(uniforms.skyBasis.value.length()-1)<1e-12);
    assert(Math.abs(uniforms.skyBasis.value.x-Math.cos(a.sky.rotation.y))<1e-12);
    assert(Math.abs(uniforms.skyBasis.value.y-Math.sin(a.sky.rotation.y))<1e-12);
    assert.equal(uniforms.golden.value,theme==='sunset'?1:0);
  }
  time.value=48;sunDirection.set(.34,.115,.94).normalize();
  assert.equal(uniforms.time,time);assert.equal(uniforms.time.value,48);
  assert.equal(uniforms.sun.value.y,sunDirection.y);
  assert.equal(daySky.rotation,0);assert.equal(sunsetSky.rotation,0);
  assert.deepEqual(daySky.offset.toArray(),[0,0]);assert.deepEqual(sunsetSky.offset.toArray(),[0,0]);
  a.dispose();
});

test('low quality removes near microdetail without changing water coverage or allocating extra passes',()=>{
  const {a}=setup(),geometry=a.ocean.geometry,material=a.ocean.material;
  const positions=geometry.attributes.position.array.slice(),shoreMap=material.uniforms.shoreMap.value;
  a.setTheme('sunset');
  const basis=material.uniforms.skyBasis.value,sky=material.uniforms.sky.value;
  for(const [quality,detail] of [['low',0],['balanced',.62],['high',1],['low',0],['auto',1]]){
    a.setQuality(quality);
    assert.equal(material.uniforms.waterDetail.value,detail);
    assert.equal(a.stats.detail,detail);
    assert.equal(a.ocean.geometry,geometry);assert.equal(a.ocean.material,material);
    assert.deepEqual(geometry.attributes.position.array,positions);
    assert.equal(material.uniforms.shoreMap.value,shoreMap);
    assert.equal(material.uniforms.skyBasis.value,basis);
    assert.equal(material.uniforms.sky.value,sky);
    assert.equal(a.stats.theme,'sunset');
    assert.equal(geometry.index.count/3,2);assert.equal(a.stats.waterPasses,1);
    assert.equal(a.stats.reflectionCameras,0);
  }
  a.dispose();
});

test('disposing the atmosphere releases its own GPU resources and preserves shared sky assets',()=>{
  const {a,daySky,sunsetSky}=setup(),released=[];
  for(const [name,resource] of [['skyGeometry',a.sky.geometry],['skyMaterial',a.sky.material],['waterGeometry',a.ocean.geometry],['waterMaterial',a.ocean.material],['shoreMap',a.ocean.material.uniforms.shoreMap.value],['daySky',daySky],['sunsetSky',sunsetSky]])resource.addEventListener('dispose',()=>released.push(name));
  a.dispose();
  assert.deepEqual(released,['skyGeometry','skyMaterial','waterGeometry','waterMaterial','shoreMap']);
});
