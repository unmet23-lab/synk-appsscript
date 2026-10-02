import test from 'node:test';
import assert from 'node:assert/strict';
import {startAssetLoad,prepareFirstFrame} from '../startup.js';

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('cars, scan and all textures are requested together, with mobile sky variants',async()=>{
  const requests=[];
  const loader={loadAsync(url){const pending=deferred();requests.push({url,...pending});return pending.promise;}};
  const pending=startAssetLoad({textures:loader,models:loader,coarsePointer:true});
  assert.equal(requests.length,14);
  assert(requests.some(r=>r.url.endsWith('car.glb')));
  assert(requests.some(r=>r.url.endsWith('coastal-rocks-v6.glb')));
  assert(requests.some(r=>r.url.endsWith('golden-sky-v3-mobile.jpg')));
  assert(requests.some(r=>r.url.endsWith('azure-sky-v3-mobile.jpg')));
  for(const request of requests)request.resolve(request.url);
  const assets=await pending;
  assert(assets.ok);assert.equal(assets.textures.length,11);
  assert.equal(assets.car,'./assets/car.glb');assert.equal(assets.felt,'./assets/felt/driver-felt.webp');assert.equal(assets.rocks,'./assets/coastal-rocks-v6.glb');
});

test('an early failed asset stays handled while scene/font work is pending',async()=>{
  const failure=new Error('scan unavailable');
  const loader={loadAsync:url=>url.endsWith('.glb')?Promise.reject(failure):Promise.resolve(url)};
  const pending=startAssetLoad({textures:loader,models:loader});
  await tick();
  const result=await pending;
  assert.equal(result.ok,false);assert.equal(result.error,failure);
});

test('ready waits for shader completion, an actual render and the next frame',async()=>{
  const shader=deferred(),paint=deferred(),events=[];
  let ready=false;
  const pending=prepareFirstFrame({getState:()=>['coast','high'],prepare:()=>events.push('prepare'),compile:()=>{events.push('compile');return shader.promise;},render:()=>events.push('render'),nextFrame:()=>paint.promise}).then(()=>{ready=true;});
  assert.deepEqual(events,['prepare','compile']);assert.equal(ready,false);
  shader.resolve();await tick();assert.deepEqual(events,['prepare','compile','render']);assert.equal(ready,false);
  paint.resolve();await pending;assert.equal(ready,true);
});

test('course, quality, driver or viewport changes during compilation cannot publish a stale view',async()=>{
  for(const changedIndex of [0,1,2,3]){
    let state=['coast','high','marin',390],passes=0;
    const first=deferred(),renders=[];
    const pending=prepareFirstFrame({getState:()=>[...state],prepare(){},compile(){return ++passes===1?first.promise:Promise.resolve();},render:()=>renders.push([...state]),nextFrame:()=>Promise.resolve()});
    state[changedIndex]='changed';first.resolve();await pending;
    assert.equal(passes,2);assert.deepEqual(renders,[state]);
  }
});

test('a selection changed after rendering is rendered again before ready; compiler errors propagate',async()=>{
  let state='coast',passes=0;
  const renders=[];
  await prepareFirstFrame({getState:()=>[state],prepare(){},compile:async()=>{passes++;},render:()=>renders.push(state),nextFrame:async()=>{state='sunset';}});
  assert.equal(passes,2);assert.deepEqual(renders,['coast','sunset']);
  let rendered=false;
  await assert.rejects(prepareFirstFrame({getState:()=>[],prepare(){},compile:async()=>{throw Error('compile failed');},render:()=>{rendered=true;},nextFrame:async()=>{}}),/compile failed/);
  assert.equal(rendered,false);
});
