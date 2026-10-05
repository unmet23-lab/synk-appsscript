import test from 'node:test';
import assert from 'node:assert/strict';
import {startTerrainBuild} from '../terrain-startup.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fakeWorker(){
  return {onmessage:null,onerror:null,onmessageerror:null,messages:[],terminated:0,
    postMessage(message){this.messages.push(message);},
    terminate(){this.terminated++;}};
}
function assertReleased(worker){
  assert.equal(worker.terminated,1);
  assert.equal(worker.onmessage,null);
  assert.equal(worker.onerror,null);
  assert.equal(worker.onmessageerror,null);
}

test('an unsupported Worker API returns a handled fallback result',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'Worker');
  Object.defineProperty(globalThis,'Worker',{value:undefined,configurable:true,writable:true});
  try{
    const build=startTerrainBuild();
    await tick();
    assert.deepEqual(await build.result,{ok:false,reason:'worker-unavailable'});
    build.cancel();
  }finally{
    if(original)Object.defineProperty(globalThis,'Worker',original);
    else delete globalThis.Worker;
  }
});

test('a Worker constructor failure does not escape startup',async()=>{
  const build=startTerrainBuild({createWorker:()=>{throw new Error('worker blocked');}});
  assert.deepEqual(await build.result,{ok:false,reason:'worker-unavailable'});
  build.cancel();
});

test('an early worker error is settled while asset/font work delays the await',async()=>{
  const worker=fakeWorker();
  const build=startTerrainBuild({createWorker:()=>worker});
  let prevented=false;
  worker.onerror({preventDefault(){prevented=true;}});
  await tick();
  assert.deepEqual(await build.result,{ok:false,reason:'worker-error'});
  assert.equal(prevented,true);
  assertReleased(worker);
});

test('a successful build preserves the terrain payload and releases its worker once',async()=>{
  const worker=fakeWorker(),terrain={heights:new Float64Array([1,2,3])};
  const build=startTerrainBuild({createWorker:()=>worker});
  assert.deepEqual(worker.messages,[{type:'build'}]);
  const lateMessage=worker.onmessage,lateError=worker.onerror;
  worker.onmessage({data:{ok:true,terrain,computeMs:42}});
  const result=await build.result;
  assert.deepEqual(result,{ok:true,terrain,computeMs:42});
  assert.equal(result.terrain,terrain);
  build.cancel();
  lateMessage({data:{ok:false}});
  lateError({preventDefault(){}});
  assert.equal(await build.result,result);
  assertReleased(worker);
});

test('cancelling twice is idempotent and queued callbacks cannot publish terrain',async()=>{
  const worker=fakeWorker();
  const build=startTerrainBuild({createWorker:()=>worker});
  const lateMessage=worker.onmessage,lateError=worker.onerror,lateMessageError=worker.onmessageerror;
  build.cancel();build.cancel();
  lateMessage({data:{ok:true,terrain:{heights:new Float64Array([9])},computeMs:1}});
  lateError({});lateMessageError();
  assert.deepEqual(await build.result,{ok:false,reason:'cancelled'});
  assertReleased(worker);
});

test('an unresponsive worker times out and ignores a late completion',async()=>{
  const worker=fakeWorker();
  const build=startTerrainBuild({createWorker:()=>worker,timeoutMs:5});
  const lateMessage=worker.onmessage;
  assert.deepEqual(await build.result,{ok:false,reason:'worker-timeout'});
  lateMessage({data:{ok:true,terrain:{}}});
  build.cancel();
  assert.deepEqual(await build.result,{ok:false,reason:'worker-timeout'});
  assertReleased(worker);
});

test('a message deserialization failure settles and releases the worker',async()=>{
  const worker=fakeWorker();
  const build=startTerrainBuild({createWorker:()=>worker});
  worker.onmessageerror();
  assert.deepEqual(await build.result,{ok:false,reason:'worker-message'});
  assertReleased(worker);
});

test('an explicit failure or missing terrain result permits the synchronous fallback',async()=>{
  for(const data of [{ok:false,error:'terrain failed'},{ok:true},null]){
    const worker=fakeWorker();
    const build=startTerrainBuild({createWorker:()=>worker});
    worker.onmessage({data});
    assert.deepEqual(await build.result,{ok:false,reason:'worker-result'});
    assertReleased(worker);
  }
});

test('a postMessage exception settles and releases the already-created worker',async()=>{
  const worker=fakeWorker();
  worker.postMessage=()=>{throw new Error('message blocked');};
  const build=startTerrainBuild({createWorker:()=>worker});
  await tick();
  assert.deepEqual(await build.result,{ok:false,reason:'worker-unavailable'});
  assertReleased(worker);
});
