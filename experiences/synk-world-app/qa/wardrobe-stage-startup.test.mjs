import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import * as THREE from '../../synk-world-home/scene-assets/three.module.js';
import {slotsForOutfit} from '../../synk-world-home/wardrobe-catalog.mjs';
import * as stageState from '../../synk-world-home/wardrobe-stage-state.mjs';

const source=fs.readFileSync(new URL('../../synk-world-home/wardrobe-stage.mjs',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export async function mountWardrobeStage','async function mountWardrobeStage');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function eventTarget(){
  const listeners=new Map();
  return {listeners,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    emit(type,extra={}){const event={preventDefault(){this.defaultPrevented=true;},...extra};for(const fn of [...(listeners.get(type)||[])])fn(event);return event;},
    listenerCount(){return [...listeners.values()].reduce((total,set)=>total+set.size,0);}};
}
function awaitOwned(promise,signal){
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);if(signal.aborted){abort();return;}
    signal.addEventListener('abort',abort,{once:true});
    promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}
// Run the complete production stage with real Three geometry/math, replacing
// only the GPU, network and browser scheduling boundaries. No window is opened.
function fixture({holdEnvironment=false,holdAvatar=false}={}){
  const controller=new AbortController(),environmentReady=deferred(),avatarReady=deferred(),prepareReady=deferred(),enteredPrepare=deferred(),enteredAvatar=deferred(),frames=new Map(),observers=[];
  const counts={rendererDispose:0,environmentDispose:0,avatarDispose:0,contactDispose:0,renders:0,forceContextLoss:0},errors=[];
  const state={width:600,height:480,mobile:false,hidden:false,contextLost:false};let renderer,nextFrame=0;
  const makeCanvas=()=>({...eventTarget(),style:{},classList:{add(){},remove(){}},setAttribute(){},setPointerCapture(){},remove(){this.removed=true;},
    getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},createRadialGradient:()=>({addColorStop(){}}),fillRect(){}}),toDataURL:()=> 'data:image/png;base64,fixture'});
  const document={...eventTarget(),createElement:()=>makeCanvas(),get hidden(){return state.hidden;}};
  const host={replaceChildren(canvas){this.canvas=canvas;},getBoundingClientRect:()=>({width:state.width,height:state.height})};
  class Renderer{
    constructor({canvas}){renderer=this;this.domElement=canvas;this.shadowMap={};this.debug={};this.capabilities={getMaxAnisotropy:()=>8};this.info={render:{calls:1,triangles:1},memory:{textures:0,geometries:0}};this.ratio=1;this.sizes=[];}
    setPixelRatio(value){this.ratio=value;}getPixelRatio(){return this.ratio;}
    setSize(width,height){assert.equal(counts.rendererDispose,0,'disposed renderer must never resize');this.sizes.push([width,height]);this.domElement.width=Math.floor(width*this.ratio);this.domElement.height=Math.floor(height*this.ratio);}
    getContext(){return {isContextLost:()=>state.contextLost};}dispose(){counts.rendererDispose++;}forceContextLoss(){counts.forceContextLoss++;}
  }
  class Observer{constructor(callback){this.callback=callback;observers.push(this);}observe(){this.connected=true;}disconnect(){this.connected=false;}}
  const environment={texture:new THREE.Texture(),source:'fixture-baked',dispose(){counts.environmentDispose++;this.texture.dispose();}};
  const avatar={group:new THREE.Group(),setEquipment(){},setDyes:()=>({}),getDyes:()=>({}),setPose(){},metrics:()=>({}),dispose(){counts.avatarDispose++;this.group.removeFromParent();}};
  const contact={setQuality(){},render(){assert.equal(counts.rendererDispose,0,'disposed renderer must never draw');counts.renders++;},metrics:()=>({}),dispose(){counts.contactDispose++;},
    async prepare({signal}){enteredPrepare.resolve();return await awaitOwned(prepareReady.promise,signal);}};
  const context={...stageState,THREE:{...THREE,WebGLRenderer:Renderer},slotsForOutfit,wardrobeDyeDefaults:()=>({}),document,
    performance,AbortController,DOMException,devicePixelRatio:2,
    matchMedia:query=>({matches:query.includes('max-width')?state.mobile:false}),ResizeObserver:Observer,IntersectionObserver:Observer,
    requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    createContactLight:()=>contact,
    loadWardrobeEnvironment:async(_renderer,{signal})=>holdEnvironment?awaitOwned(environmentReady.promise,signal):environment,
    createMongleAvatar:async({signal})=>{enteredAvatar.resolve();return holdAvatar?awaitOwned(avatarReady.promise,signal):avatar;},
  };
  const mount=vm.runInNewContext(source+'\nmountWardrobeStage;',context);
  const result=mount(host,{signal:controller.signal,onError:message=>errors.push(message)}).then(value=>({ok:true,value}),error=>({ok:false,error}));
  return {controller,environmentReady,avatarReady,prepareReady,enteredPrepare,enteredAvatar,frames,observers,counts,state,errors,host,document,result,environment,avatar,get renderer(){return renderer;},
    tick(){const pending=[...frames];frames.clear();for(const [,fn]of pending)fn(performance.now());}};
}
function released(h,{environment=true,avatar=true}={}){
  assert.equal(h.counts.rendererDispose,1);assert.equal(h.counts.contactDispose,1);assert.equal(h.counts.forceContextLoss,1);
  assert.equal(h.counts.environmentDispose,environment?1:0);assert.equal(h.counts.avatarDispose,avatar?1:0);
  assert.equal(h.host.canvas.removed,true);assert.equal(h.host.canvas.listenerCount(),0);assert.equal(h.document.listenerCount(),0);
  assert.equal(h.observers.filter(o=>o.connected).length,0);assert.equal(h.frames.size,0);
}

test('first-open waits for shaders without drawing, then renders with the latest host size',async()=>{
  const h=fixture();await h.enteredPrepare.promise;
  assert.equal(h.counts.renders,0);assert.equal(h.frames.size,0);
  h.state.width=840;h.state.height=620;h.observers[0].callback();
  assert.equal(h.renderer.sizes.length,1,'do not change shader target allocation while preparation is pending');
  h.prepareReady.resolve();const result=await h.result;assert.equal(result.ok,true);
  assert.deepEqual(h.renderer.sizes.at(-1),[840,620]);assert.equal(h.counts.renders,1);
  result.value.dispose();result.value.dispose();released(h);
});

test('closing during environment loading rejects and releases only acquired resources',async()=>{
  const h=fixture({holdEnvironment:true});h.controller.abort();const result=await h.result;
  assert.equal(result.ok,false);assert.equal(result.error.name,'AbortError');assert.equal(h.counts.renders,0);
  released(h,{environment:false,avatar:false});
});

test('closing during avatar loading also releases the already acquired environment',async()=>{
  const h=fixture({holdAvatar:true});await h.enteredAvatar.promise;h.controller.abort();const result=await h.result;
  assert.equal(result.ok,false);assert.equal(result.error.name,'AbortError');released(h,{avatar:false});
});

test('closing during shader preparation disconnects observers and never schedules a late frame',async()=>{
  const h=fixture();await h.enteredPrepare.promise;h.controller.abort();const result=await h.result;
  assert.equal(result.ok,false);assert.equal(result.error.name,'AbortError');released(h);
  h.prepareReady.resolve();await Promise.resolve();h.tick();assert.equal(h.counts.renders,0);released(h);
});

test('context loss while first-open is pending rejects and cleans up both context handlers',async()=>{
  const h=fixture();await h.enteredPrepare.promise;h.state.contextLost=true;
  assert.equal(h.host.canvas.emit('webglcontextlost').defaultPrevented,true);
  const result=await h.result;assert.equal(result.ok,false);assert.match(result.error.message,/CONTEXT_LOST/);
  assert.equal(h.counts.renders,0);assert.equal(h.errors.length,1);released(h);
});

test('a shader failure cannot produce a successful stage even if compilation settles',async()=>{
  const h=fixture();await h.enteredPrepare.promise;h.renderer.debug.onShaderError();h.prepareReady.resolve();const result=await h.result;
  assert.equal(result.ok,false);assert.match(result.error.message,/SHADER_FAILED/);assert.equal(h.counts.renders,0);released(h);
});

test('hidden first-open remains undrawn until visibility resumes; closing cancels that frame',async()=>{
  const h=fixture();await h.enteredPrepare.promise;h.state.hidden=true;h.prepareReady.resolve();const result=await h.result;
  assert.equal(result.ok,true);assert.equal(h.counts.renders,0);assert.equal(h.frames.size,0);
  h.state.hidden=false;h.document.emit('visibilitychange');assert.equal(h.frames.size,1);
  result.value.dispose();h.tick();assert.equal(h.counts.renders,0);released(h);
});

test('context loss after successful first-open uses recovery instead of keeping startup listeners',async()=>{
  const h=fixture();await h.enteredPrepare.promise;h.prepareReady.resolve();const result=await h.result;
  assert.equal(result.ok,true);assert.equal(h.host.canvas.listeners.get('webglcontextlost').size,1);
  h.state.contextLost=true;h.host.canvas.emit('webglcontextlost');h.tick();
  assert.equal(result.value.metrics().lost,true);assert.equal(h.counts.renders,1);assert.equal(h.errors.length,1);
  result.value.dispose();released(h);
});

const environmentSource=fs.readFileSync(new URL('../../synk-world-home/wardrobe-environment.mjs',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export async function loadWardrobeEnvironment','async function loadWardrobeEnvironment')
  .replaceAll('import.meta.url',JSON.stringify(new URL('../../synk-world-home/wardrobe-environment.mjs',import.meta.url).href));
function environmentFixture(fetchResponse,{lost=false}={}){
  const counts={generated:0,generatorDisposed:0,targetDisposed:0,geometryDisposed:0,materialDisposed:0};
  class Generator{
    fromScene(scene,blur){
      counts.generated++;assert.equal(blur,.08);assert.equal(scene.children.length,2);
      const materials=new Set();for(const object of scene.children){object.geometry.addEventListener('dispose',()=>counts.geometryDisposed++);materials.add(object.material);}
      for(const material of materials)material.addEventListener('dispose',()=>counts.materialDisposed++);
      return {texture:new THREE.Texture(),dispose(){counts.targetDisposed++;}};
    }
    dispose(){counts.generatorDisposed++;}
  }
  const load=vm.runInNewContext(environmentSource+'\nloadWardrobeEnvironment;',{THREE:{...THREE,PMREMGenerator:Generator},fetch:fetchResponse,Response,DecompressionStream,URL,AbortController,setTimeout,clearTimeout});
  return {counts,load:options=>load({getContext:()=>({isContextLost:()=>lost})},options)};
}

test('baked environment decompresses to the original half-float CubeUV texture without PMREM work',async()=>{
  const raw=Buffer.alloc(768*1024*8);raw.writeUInt16LE(15360,0);
  const h=environmentFixture(async()=>new Response(gzipSync(raw))),environment=await h.load();
  assert.equal(environment.source,'baked');assert.equal(h.counts.generated,0);
  assert.equal(environment.texture.image.width,768);assert.equal(environment.texture.image.height,1024);
  assert.equal(environment.texture.image.data[0],15360);assert.equal(environment.texture.image.data.byteLength,raw.length);
  assert.equal(environment.texture.type,THREE.HalfFloatType);assert.equal(environment.texture.mapping,THREE.CubeUVReflectionMapping);
  assert.equal(environment.texture.colorSpace,THREE.LinearSRGBColorSpace);assert.equal(environment.texture.generateMipmaps,false);
  let disposed=0;environment.texture.addEventListener('dispose',()=>disposed++);environment.dispose();assert.equal(disposed,1);
});

test('missing or invalid baked assets use the original room and release temporary PMREM resources',async()=>{
  for(const response of [()=>new Response(null,{status:404}),()=>new Response(gzipSync(Buffer.alloc(16))),()=>new Response('not gzip')]){
    const h=environmentFixture(async()=>response()),environment=await h.load();
    assert.equal(environment.source,'procedural-fallback');assert.equal(h.counts.generated,1);
    assert.equal(h.counts.generatorDisposed,1);assert.equal(h.counts.geometryDisposed,2);assert.equal(h.counts.materialDisposed,1);
    assert.equal(h.counts.targetDisposed,0);environment.dispose();assert.equal(h.counts.targetDisposed,1);
  }
});

test('an aborted environment request never falls back to synchronous GPU preparation',async()=>{
  const controller=new AbortController();controller.abort();
  const h=environmentFixture(async(_url,{signal})=>{signal.throwIfAborted();});
  await assert.rejects(h.load({signal:controller.signal}),{name:'AbortError'});assert.equal(h.counts.generated,0);
});

test('a lost context cannot enter the procedural environment fallback',async()=>{
  const h=environmentFixture(async()=>new Response(null,{status:404}),{lost:true});
  await assert.rejects(h.load(),/WARDROBE_CONTEXT_LOST/);assert.equal(h.counts.generated,0);
});

test('a stalled environment fetch reaches the original PMREM fallback at its deadline',async()=>{
  let requestSignal;
  const h=environmentFixture((_url,{signal})=>{requestSignal=signal;return new Promise(()=>{});});
  const environment=await h.load({timeoutMs:10});
  assert.equal(requestSignal.aborted,true);assert.match(requestSignal.reason.message,/ENVIRONMENT_TIMEOUT/);
  assert.equal(environment.source,'procedural-fallback');assert.equal(h.counts.generated,1);environment.dispose();
});

test('the same deadline aborts a stalled gzip body and cancels its upstream stream',async()=>{
  const cancelled=deferred();let requestSignal;
  const stream=new ReadableStream({start(controller){controller.enqueue(gzipSync(Buffer.alloc(16)));},cancel(reason){cancelled.resolve(reason);}});
  const h=environmentFixture(async(_url,{signal})=>{requestSignal=signal;return new Response(stream);});
  const environment=await h.load({timeoutMs:10}),reason=await cancelled.promise;
  assert.equal(requestSignal.aborted,true);assert.match(reason.message,/ENVIRONMENT_TIMEOUT/);
  assert.equal(environment.source,'procedural-fallback');assert.equal(h.counts.generated,1);environment.dispose();
});

test('external close still rejects a stalled request immediately without deadline fallback',async()=>{
  const controller=new AbortController(),started=deferred();let requestSignal;
  const h=environmentFixture((_url,{signal})=>{requestSignal=signal;started.resolve();return new Promise(()=>{});});
  const loading=h.load({signal:controller.signal,timeoutMs:5000});await started.promise;controller.abort();
  await assert.rejects(loading,{name:'AbortError'});assert.equal(requestSignal.aborted,true);assert.equal(h.counts.generated,0);
});

test('a stalled request with a lost context cannot start PMREM when its deadline expires',async()=>{
  const h=environmentFixture(()=>new Promise(()=>{}),{lost:true});
  await assert.rejects(h.load({timeoutMs:10}),/WARDROBE_CONTEXT_LOST/);assert.equal(h.counts.generated,0);
});
