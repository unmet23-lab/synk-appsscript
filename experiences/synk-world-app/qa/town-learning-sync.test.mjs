import test from 'node:test';
import assert from 'node:assert/strict';
import {createTownWorldHost} from '../world-town-client.mjs';
const wait=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {resolve,promise};};
function fixture(t,{reply={learning:{recorded:2}},retry=async()=>{}}={}) {
  const previous=globalThis.SYNKLearningHost, calls=[];
  globalThis.SYNKLearningHost={preferences:()=>({today:()=>({condition:'tired'})}),retry:async()=>{calls.push('pull');await retry();}};
  const client={snapshot:{accountId:'synthetic-a'},generation:1,request:async(route)=>{calls.push(route);return structuredClone(reply);}};
  const host=createTownWorldHost(client);t.after(()=>{host.dispose();if(previous===undefined)delete globalThis.SYNKLearningHost;else globalThis.SYNKLearningHost=previous;});
  return {host,client,calls};
}
test('a committed Town fact pulls the existing account synchronizer without replaying practices',async t=>{
  const f=fixture(t);assert.deepEqual(f.host.languageContext().today,{condition:'tired'});
  await f.host.request('command',{type:'TEA_PRESENT'});assert.deepEqual(f.calls,['town/command','pull']);
});
test('lost command response retries pull already committed facts even when duplicate receipt has no count',async t=>{
  const f=fixture(t,{reply:{duplicate:true}});await f.host.request('command',{type:'TEA_SERVE'});
  assert.deepEqual(f.calls,['town/command','pull']);
});
test('learning read failure preserves the successful life reply and marks sync pending',async t=>{
  const f=fixture(t,{retry:async()=>{throw Error('offline');}}),result=await f.host.request('command',{type:'TEA_SERVE'});
  assert.equal(result.learning.recorded,2);assert.equal(result.learning.pending,true);
});
test('account switch during delayed learning pull rejects the old visit result',async t=>{
  const entered=wait(),release=wait(),f=fixture(t,{retry:async()=>{entered.resolve();await release.promise;}});
  const pending=f.host.request('command',{type:'TEA_SERVE'});await entered.promise;
  f.client.generation++;f.client.snapshot={accountId:'synthetic-b'};const rejected=assert.rejects(pending,{code:'ACCOUNT_CHANGED'});
  release.resolve();await rejected;assert.throws(()=>f.host.languageContext(),{code:'ACCOUNT_CHANGED'});
});
