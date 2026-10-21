import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../synk-world-home/scene-assets/three.module.js';
import {createAvatarWardrobe,wardrobeFabricKinds} from '../../synk-world-home/avatar-wardrobe.mjs';
import {WARDROBE_ITEMS} from '../../synk-world-home/wardrobe-catalog.mjs';

const moduleUrl=new URL('../../synk-world-home/avatar-textiles.mjs',import.meta.url);
let moduleId=0;
const loadModule=()=>import(`${moduleUrl.href}?startup-test=${++moduleId}`);
const dispose=factory=>new Set(factory.textures).forEach(texture=>texture.dispose());
function imageFixture({defer=false,deferDecode=false,fail='',wrongSize='',failDecode=''}={}){
  const requests=[],pending=[],decodes=[];let decodeCount=0;
  globalThis.Image=class{
    constructor(){this.naturalWidth=this.naturalHeight=512;}
    decode(){decodeCount++;return failDecode&&this.url.includes(failDecode)?Promise.reject(Error('bad image')):deferDecode?new Promise(resolve=>decodes.push(resolve)):Promise.resolve();}
    set src(value){
      this.url=value;requests.push(value);this.naturalWidth=this.naturalHeight=Number(value.match(/avatar-textiles-v1\/(512|1024)\//)?.[1]||512);if(wrongSize&&value.includes(wrongSize))this.naturalWidth=256;
      const finish=()=>fail&&value.includes(fail)?this.onerror?.():this.onload?.();
      defer?pending.push(finish):queueMicrotask(finish);
    }
  };
  return {requests,get decodeCount(){return decodeCount;},flush(){for(const finish of pending.splice(0))finish();},finishDecode(){for(const resolve of decodes.splice(0))resolve();}};
}
function forbidCanvas(){globalThis.document={createElement(){throw Error('Unexpected procedural canvas generation');}};}
// A CPU-only cotton fallback surface. The actual generator still computes every
// authored pixel; this fixture replaces browser allocation and readback only.
function cottonCanvasFixture(){
  let count=0;
  globalThis.document={createElement(name){
    assert.equal(name,'canvas');count++;let pixels;
    const context={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},createImageData(width,height){return {data:new Uint8ClampedArray(width*height*4)};},
      putImageData(image){pixels=image;},getImageData(){return pixels;}};
    return {width:1,height:1,getContext(){return context;}};
  }};
  return {get count(){return count;}};
}

test('baked base maps avoid Canvas2D generation and keep avatar-owned textures',async()=>{
  forbidCanvas();const images=imageFixture(),{loadAvatarTextiles}=await loadModule();
  const first=await loadAvatarTextiles({anisotropy:3}),second=await loadAvatarTextiles({anisotropy:5});
  try{
    assert.equal(images.requests.length,9,'reopening reuses decoded images');
    assert.equal(images.decodeCount,9);
    assert.deepEqual(first.baseSources,{wool:'baked',knit:'baked',cotton:'baked'});
    assert.equal(first.textures.length,9);
    for(let i=0;i<9;i++){
      assert.notEqual(first.textures[i],second.textures[i]);
      assert.equal(first.textures[i].image,second.textures[i].image);
      assert.equal(first.textures[i].anisotropy,3);assert.equal(second.textures[i].anisotropy,5);
    }
    const cotton=first.fabric('cotton',[1.2,3]);
    assert.equal(cotton.roughnessMap,cotton.aoMap);
    assert.deepEqual(cotton.map.repeat.toArray(),[1.2,3]);
    assert.equal(cotton.map.colorSpace,'srgb');assert.equal(cotton.normalMap.colorSpace,'');
    let secondDisposals=0;for(const texture of second.textures)texture.addEventListener('dispose',()=>secondDisposals++);
    dispose(first);assert.equal(secondDisposals,0);
  }finally{dispose(first);dispose(second);}
});

for(const size of [512,1024])test(`initial details request only the deduplicated equipped fabrics at ${size}px`,async()=>{
  forbidCanvas();const images=imageFixture(),{loadAvatarTextiles}=await loadModule();
  const textile=await loadAvatarTextiles({detailSize:size,detailKinds:['linen-detail','silk-detail','linen','unknown']});
  try{
    assert.equal(images.requests.length,17);
    const detailRequests=images.requests.filter(url=>url.includes(`/${size}/`));assert.equal(detailRequests.length,8);
    assert.ok(detailRequests.every(url=>/\/(linen|silk)-detail-/.test(url)));
    assert.deepEqual(textile.detailSources,{'linen-detail':'baked','silk-detail':'baked'});
    for(const kind of ['linen-detail','silk-detail']){
      const fabric=textile.fabric(kind,[2,3]);assert.equal(fabric.map.image.naturalWidth,size);assert.ok(fabric.anisotropyMap);
      assert.equal(fabric.roughnessMap,fabric.aoMap);assert.ok(textile.textures.includes(fabric.anisotropyMap));
    }
  }finally{dispose(textile);}
});

test('nondirectional fabric requests no direction image and different detail sizes have independent caches',async()=>{
  forbidCanvas();const images=imageFixture(),{loadAvatarTextiles}=await loadModule();
  const small=await loadAvatarTextiles({detailSize:512,detailKinds:['knit-detail']}),large=await loadAvatarTextiles({detailSize:1024,detailKinds:['knit-detail']});
  try{
    assert.equal(images.requests.length,15);assert.ok(images.requests.every(url=>!url.endsWith('-direction.png')));
    assert.equal(small.fabric('knit-detail',[1,1]).anisotropyMap,undefined);
    assert.notEqual(small.fabric('knit-detail',[1,1]).map.image,large.fabric('knit-detail',[1,1]).map.image);
  }finally{dispose(small);dispose(large);}
});

test('decoded detail images have a bounded recent cache while live avatar textures remain usable',async()=>{
  forbidCanvas();const images=imageFixture(),{loadAvatarTextiles}=await loadModule(),kinds=['cotton-detail','denim-detail','linen-detail','corduroy-detail','silk-detail'];
  let first;
  try{
    for(const kind of kinds){const textile=await loadAvatarTextiles({detailSize:1024,detailKinds:[kind]});if(!first)first=textile;else dispose(textile);}
    assert.equal(images.requests.length,29);assert.ok(first.fabric('cotton-detail',[1,1]).map.image);
    const recent=await loadAvatarTextiles({detailSize:1024,detailKinds:['silk-detail']});dispose(recent);assert.equal(images.requests.length,29);
    const oldest=await loadAvatarTextiles({detailSize:1024,detailKinds:['cotton-detail']});dispose(oldest);assert.equal(images.requests.length,33);
  }finally{if(first)dispose(first);}
});

test('closing while requested details load cancels without preparing unselected garments',async()=>{
  forbidCanvas();const images=imageFixture({defer:true}),{loadAvatarTextiles}=await loadModule(),controller=new AbortController();
  const pending=loadAvatarTextiles({detailKinds:['corduroy-detail'],detailSize:1024,signal:controller.signal});
  controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(images.requests.length,13);images.flush();
  const reopened=await loadAvatarTextiles({detailKinds:['corduroy-detail'],detailSize:1024});
  try{assert.equal(images.requests.length,13);assert.deepEqual(reopened.detailSources,{'corduroy-detail':'baked'});}finally{dispose(reopened);}
});

test('a failed detail image preserves other baked fabrics and lazily falls back only when that fabric is used',async()=>{
  const canvases=cottonCanvasFixture();imageFixture({fail:'/cotton-detail-'});const {loadAvatarTextiles}=await loadModule();
  const textile=await loadAvatarTextiles({detailSize:512,detailKinds:['cotton-detail','linen-detail']});
  try{
    assert.equal(canvases.count,0);assert.deepEqual(textile.detailSources,{'linen-detail':'baked'});
    textile.fabric('linen-detail',[1,1]);assert.equal(canvases.count,0);
    textile.fabric('cotton-detail',[1,1]);assert.equal(canvases.count,5);
    assert.deepEqual(textile.detailSources,{'linen-detail':'baked','cotton-detail':'procedural'});
  }finally{dispose(textile);}
});

test('equipped body and neck form one dependency union and invalid slots prepare nothing',()=>{
  assert.deepEqual(wardrobeFabricKinds({body:'mongle-hanbok-vest',neck:'mongle-silk-neckerchief'}),['silk-detail','cotton-detail']);
  assert.deepEqual(wardrobeFabricKinds({body:'mongle-rain-cape',neck:'mongle-silk-neckerchief'}),['wax-detail','cotton-detail','silk-detail']);
  assert.deepEqual(wardrobeFabricKinds({body:'mongle-silk-neckerchief',neck:'mongle-linen-overshirt'}),[]);
  assert.deepEqual(wardrobeFabricKinds({body:'missing',neck:''}),[]);
});

test('preload dependencies match every actual authored garment builder',()=>{
  const parent=new THREE.Group(),used=new Set(),wardrobe=createAvatarWardrobe({parent,mobile:true,textile:{fabric(kind){used.add(kind);return {};}}});
  try{
    for(const item of WARDROBE_ITEMS){
      used.clear();const slots={body:'',neck:'',[item.slot]:item.id};wardrobe.set(slots);
      assert.deepEqual(wardrobeFabricKinds(slots).sort(),[...used].filter(kind=>kind.endsWith('-detail')).sort(),item.id);
    }
  }finally{
    const geometry=new Set(),materials=new Set();parent.traverse(object=>{if(object.geometry)geometry.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[])materials.add(material);if(object.isInstancedMesh)object.dispose();});
    geometry.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());
  }
});

test('image loading waits for decoding before exposing textures to the first render',async()=>{
  forbidCanvas();const images=imageFixture({deferDecode:true}),{loadAvatarTextiles}=await loadModule();
  let resolved=false;const pending=loadAvatarTextiles().then(value=>{resolved=true;return value;});
  await Promise.resolve();await Promise.resolve();assert.equal(images.decodeCount,9);assert.equal(resolved,false);
  images.finishDecode();const textile=await pending;dispose(textile);
});

test('closing during image decoding rejects promptly and a reopened avatar reuses the eventual images',async()=>{
  forbidCanvas();const images=imageFixture({defer:true}),{loadAvatarTextiles}=await loadModule();
  const controller=new AbortController(),pending=loadAvatarTextiles({signal:controller.signal});
  controller.abort();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(images.requests.length,9);images.flush();
  const reopened=await loadAvatarTextiles();try{assert.equal(images.requests.length,9);assert.equal(reopened.textures.length,9);}finally{dispose(reopened);}
});

test('an already closed avatar starts no image request or procedural generation',async()=>{
  forbidCanvas();const images=imageFixture(),{loadAvatarTextiles}=await loadModule(),controller=new AbortController();
  controller.abort();await assert.rejects(loadAvatarTextiles({signal:controller.signal}),{name:'AbortError'});
  assert.equal(images.requests.length,0);
});

for(const failure of ['request','dimensions','decode'])test(`a ${failure} failure regenerates only that textile and the next open retries it`,async()=>{
  const canvases=cottonCanvasFixture();imageFixture(failure==='request'?{fail:'/cotton-'}:failure==='decode'?{failDecode:'/cotton-'}:{wrongSize:'/cotton-normal.'});
  const {loadAvatarTextiles}=await loadModule(),first=await loadAvatarTextiles();
  try{assert.deepEqual(first.baseSources,{wool:'baked',knit:'baked',cotton:'procedural'});assert.equal(canvases.count,4);}finally{dispose(first);}
  const retryImages=imageFixture();forbidCanvas();const retry=await loadAvatarTextiles();
  try{assert.equal(retryImages.requests.length,3);assert.deepEqual(retry.baseSources,{wool:'baked',knit:'baked',cotton:'baked'});}finally{dispose(retry);}
});

function boundedTextureFixture(){
  const source=fs.readFileSync(new URL('../../synk-world-home/avatar-v3.mjs',import.meta.url),'utf8');
  const functionSource=source.slice(source.indexOf('function boundedTexture('),source.indexOf('\nfunction mesh('));
  const timers=new Map();let id=0;
  const context=vm.createContext({DOMException,Promise,setTimeout(fn){const key=++id;timers.set(key,fn);return key;},clearTimeout(key){timers.delete(key);}});
  vm.runInContext(functionSource+';this.load=boundedTexture;',context);
  return {load:context.load,timers,timeout(){const callbacks=[...timers.values()];timers.clear();for(const callback of callbacks)callback();}};
}

test('aborting the felt image wait clears its timer and disposes a late texture',async()=>{
  const fixture=boundedTextureFixture(),controller=new AbortController();let resolve,disposals=0;
  const pending=fixture.load({loadAsync:()=>new Promise(done=>{resolve=done;})},'synthetic-felt',12000,controller.signal);
  await Promise.resolve();controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(fixture.timers.size,0);
  resolve({dispose(){disposals++;}});await Promise.resolve();await Promise.resolve();assert.equal(disposals,1);
});

test('a felt image timeout also disposes its eventual texture without changing the timed-out result',async()=>{
  const fixture=boundedTextureFixture();let resolve,disposals=0;
  const pending=fixture.load({loadAsync:()=>new Promise(done=>{resolve=done;})},'synthetic-felt');
  await Promise.resolve();fixture.timeout();await assert.rejects(pending,/texture-timeout/);assert.equal(fixture.timers.size,0);
  resolve({dispose(){disposals++;}});await Promise.resolve();await Promise.resolve();assert.equal(disposals,1);
});

test('an already aborted felt request never calls its loader',async()=>{
  const fixture=boundedTextureFixture(),controller=new AbortController();let requests=0;controller.abort();
  await assert.rejects(fixture.load({loadAsync(){requests++;}},'synthetic-felt',12000,controller.signal),{name:'AbortError'});
  assert.equal(requests,0);assert.equal(fixture.timers.size,0);
});
