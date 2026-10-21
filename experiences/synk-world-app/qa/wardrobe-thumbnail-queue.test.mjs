import test from 'node:test';
import assert from 'node:assert/strict';
import {createWardrobeThumbnailQueue} from '../../synk-world-home/wardrobe-thumbnail-queue.mjs';

function fixture({idle=true}={}){
  let clock=0,nextId=1,visible=true;const timers=new Map(),idles=new Map(),seen=[];
  const queue=createWardrobeThumbnailQueue({now:()=>clock,canRun:()=>visible,
    setTimer(fn,delay){const id=nextId++;timers.set(id,{fn,at:clock+delay});return id;},clearTimer:id=>timers.delete(id),
    requestIdle:idle?fn=>{const id=nextId++;idles.set(id,fn);return id;}:undefined,cancelIdle:id=>idles.delete(id),
  });
  return {queue,seen,timers,idles,setVisible(value){visible=value;},
    add(key){queue.set(key,()=>seen.push(key));},
    idle(deadline={didTimeout:false,timeRemaining:()=>20}){const entry=idles.entries().next().value;if(entry){idles.delete(entry[0]);entry[1](deadline);}},
    advance(ms){clock+=ms;for(const [id,{fn,at}]of [...timers])if(at<=clock){timers.delete(id);fn();}},
  };
}
test('only one garment capture runs in one idle turn, with duplicate views coalesced',()=>{
  const f=fixture();f.add('apron');f.add('knit');f.queue.set('apron',()=>f.seen.push('new apron'));
  assert.equal(f.idles.size,1);f.idle();assert.deepEqual(f.seen,['new apron']);assert.equal(f.queue.metrics().pending,1);
  f.idle();assert.deepEqual(f.seen,['new apron','knit']);assert.equal(f.idles.size,0);
});
test('interaction cancels scheduled GPU work and keeps controls quiet for 250ms',()=>{
  const f=fixture();f.add('apron');f.queue.postpone();assert.equal(f.idles.size,0);
  f.advance(249);assert.deepEqual(f.seen,[]);assert.equal(f.idles.size,0);
  f.advance(1);f.idle();assert.deepEqual(f.seen,['apron']);
});
test('short idle slices leave a render turn free instead of forcing readback',()=>{
  const f=fixture();f.add('apron');f.idle({didTimeout:false,timeRemaining:()=>2});assert.deepEqual(f.seen,[]);
  f.idle();assert.deepEqual(f.seen,['apron']);
});
test('offscreen cards are cancelled before their geometry is generated',()=>{
  const f=fixture();f.add('apron');f.add('knit');f.queue.delete('apron');f.idle();assert.deepEqual(f.seen,['knit']);
  f.add('denim');f.queue.delete('denim');assert.equal(f.idles.size,0);assert.equal(f.queue.metrics().pending,0);
});
test('hidden document stops capture and resumes only when visible again',()=>{
  const f=fixture();f.add('apron');f.setVisible(false);f.idle();assert.deepEqual(f.seen,[]);assert.equal(f.idles.size,0);
  f.setVisible(true);f.queue.resume();f.idle();assert.deepEqual(f.seen,['apron']);
});
test('closing or remounting a fitting room clears every pending capture',()=>{
  const f=fixture();f.add('apron');f.queue.clear();assert.equal(f.idles.size,0);
  f.add('knit');f.queue.postpone();f.queue.dispose();f.advance(500);f.queue.resume();f.add('denim');
  assert.deepEqual(f.seen,[]);assert.equal(f.timers.size,0);assert.equal(f.queue.metrics().pending,0);
});
test('browsers without idle callbacks still yield between captures',()=>{
  const f=fixture({idle:false});f.add('apron');f.add('knit');f.advance(31);assert.deepEqual(f.seen,[]);
  f.advance(1);assert.deepEqual(f.seen,['apron']);f.advance(32);assert.deepEqual(f.seen,['apron','knit']);
});
