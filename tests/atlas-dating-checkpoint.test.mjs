import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createDatingCheckpoint,DATING_CHECKPOINT_KEY} from '../experiences/atlas-lab/dating-checkpoint.mjs';
import {createDatingDelivery} from '../experiences/atlas-lab/dating-delivery.mjs';
const START=Date.parse('2026-10-07T05:00:00.000Z'),actorId='demo:synthetic-a',demo=true,binding='v1|demo|http://127.0.0.1/atlas-lab/dating.html';
const store=()=>{const values=new Map();return{values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const marker=(patch={})=>({version:1,requestId:randomUUID(),actorId,demo,binding:createHash('sha256').update(binding).digest('hex'),createdAt:new Date(START).toISOString(),...patch});
const action={kind:'profile',profile:{nickname:'보관 금지 이름',intro:'보관 금지 원문'}};
const send={actorId,demo,expectedRevision:4,action};
const unknown=()=>Object.assign(new TypeError('synthetic lost acknowledgement'),{outcomeUnknown:true});
const ack=(id,status='applied')=>({ok:true,requestId:id,status,view:{accountId:actorId,revision:8},...(status==='applied'?{appliedRevision:5,result:{saved:true}}:{})});
test('checkpoint stores only a versioned actor/client-bound receipt marker, never the binding source, action, revision or credentials',async()=>{
  const storage=store(),cp=createDatingCheckpoint({storage,binding,clock:()=>START}),id=randomUUID();await cp.write({actorId,demo,requestId:id});
  const raw=storage.getItem(DATING_CHECKPOINT_KEY),value=JSON.parse(raw);assert.deepEqual(Object.keys(value).sort(),['actorId','binding','createdAt','demo','requestId','version']);assert.equal(value.binding,createHash('sha256').update(binding).digest('hex'));assert.ok(!raw.includes(binding));assert.doesNotMatch(raw,/action|expectedRevision|nickname|token|schedule/);assert.equal((await cp.read({actorId,demo})).requestId,id);
});
test('matching demo actor can restore after a new fictional session; other actor, mode or client registration discards the marker',async()=>{
  for(const changed of ['actor','mode','binding']){const storage=store(),cp=createDatingCheckpoint({storage,binding,clock:()=>START});await cp.write({actorId,demo,requestId:randomUUID()});
    const next=createDatingCheckpoint({storage,binding:changed==='binding'?binding+'-other':binding,clock:()=>START});assert.equal(await next.read({actorId:changed==='actor'?'demo:synthetic-b':actorId,demo:changed==='mode'?false:demo}),null);assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);
  }
});
test('expiry is exact and future or malformed cache entries cannot authorize a receipt lookup',async()=>{
  for(const value of [marker({createdAt:new Date(START-86400000).toISOString()}),marker({createdAt:new Date(START+300001).toISOString()}),marker({requestId:'missing-uuid'}),marker({version:2}),marker({action}),marker({token:'synthetic forbidden'}),null,[],marker({binding:'raw-binding'}),marker({createdAt:'2026-10-07T05:00:00+00:00'})]){
    const storage=store();storage.setItem(DATING_CHECKPOINT_KEY,JSON.stringify(value));const cp=createDatingCheckpoint({storage,binding,clock:()=>START});assert.equal(await cp.read({actorId,demo}),null);assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);
  }
  const storage=store();for(const raw of ['{','x'.repeat(1025),'{}','{"__proto__":{"polluted":true}}']){storage.setItem(DATING_CHECKPOINT_KEY,raw);assert.equal(await createDatingCheckpoint({storage,binding,clock:()=>START}).read({actorId,demo}),null);assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);}assert.equal({}.polluted,undefined);
});
test('a reload restores GET-only pending with no action/revision, never sends automatically, and applied receipt removes the marker',async()=>{
  const storage=store(),cp=()=>createDatingCheckpoint({storage,binding,clock:()=>START}),calls=[];
  const first=createDatingDelivery({checkpoint:cp(),request:async(path,body)=>{calls.push({path,body});assert.ok(storage.getItem(DATING_CHECKPOINT_KEY));throw unknown();}});await assert.rejects(first.send(send),{outcomeUnknown:true});const id=first.snapshot().requestId;
  const second=createDatingDelivery({checkpoint:cp(),request:async(path,body)=>{calls.push({path,body});return ack(id);}});const restored=await second.restore({actorId,demo});assert.equal(restored.checkOnly,true);assert.equal(restored.requestId,id);assert.equal(Object.hasOwn(restored,'action'),false);assert.equal(Object.hasOwn(restored,'expectedRevision'),false);assert.equal(calls.length,1);
  await assert.rejects(second.retry({actorId,demo}),{code:'delivery-check-only'});await assert.rejects(second.send(send),{code:'delivery-pending'});assert.equal(calls.length,1);
  assert.equal((await second.check({actorId,demo})).status,'applied');assert.equal(second.snapshot(),null);assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);assert.equal(calls[1].body,undefined);
});
test('missing receipts and failed checks preserve reload lookup; definitive authentication rejection clears it',async()=>{
  const storage=store(),cp=createDatingCheckpoint({storage,binding,clock:()=>START}),id=randomUUID();await cp.write({actorId,demo,requestId:id});let mode='missing';
  const d=createDatingDelivery({checkpoint:cp,request:async()=>{if(mode==='missing')return ack(id,'not-found');if(mode==='offline')throw new TypeError('offline');throw Object.assign(new Error('synthetic auth rejection'),{status:401});}});await d.restore({actorId,demo});assert.equal((await d.check({actorId,demo})).status,'not-found');assert.ok(d.snapshot());assert.ok(storage.getItem(DATING_CHECKPOINT_KEY));mode='offline';await assert.rejects(d.check({actorId,demo}));assert.ok(d.snapshot());mode='unauthorized';await assert.rejects(d.check({actorId,demo}),{status:401});assert.equal(d.snapshot(),null);assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);
});
test('write/readback failures stop before POST, including a storage adapter that silently drops writes',async()=>{
  for(const broken of ['read','write','drop','readback']){const storage=store();let reads=0,writes=0;
    const plainGet=storage.getItem;storage.getItem=key=>{reads++;if(broken==='read'||broken==='readback'&&reads===3)throw new Error('synthetic storage');return plainGet(key);};
    if(broken==='write')storage.setItem=()=>{throw new Error('synthetic quota');};if(broken==='drop')storage.setItem=()=>{};
    const d=createDatingDelivery({checkpoint:createDatingCheckpoint({storage,binding,clock:()=>START}),request:async()=>{writes++;}});await assert.rejects(d.send(send),{code:'checkpoint-storage-unavailable'});assert.equal(writes,0,broken);assert.equal(d.snapshot(),null);
  }
});
test('successful send, definite action rejection, logout and identity change erase markers; uncertain retry preserves original creation time',async()=>{
  for(const finish of ['success','reject','clear','identity']){const storage=store(),cp=createDatingCheckpoint({storage,binding,clock:()=>START});let attempts=0;const d=createDatingDelivery({checkpoint:cp,request:async()=>{attempts++;if(finish==='success')return{ok:true,appliedRevision:5,result:{saved:true},view:{accountId:actorId,revision:5}};if(finish==='reject')throw Object.assign(new Error('invalid'),{status:400});throw unknown();}});
    if(finish==='success')await d.send(send);else await assert.rejects(d.send(send));if(finish==='clear')d.clear();if(finish==='identity')await assert.rejects(d.check({actorId:'demo:other',demo}),{code:'delivery-identity-changed'});assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);assert.equal(d.snapshot(),null);
  }
  let time=START;const storage=store(),cp=createDatingCheckpoint({storage,binding,clock:()=>time}),d=createDatingDelivery({checkpoint:cp,request:async()=>{throw unknown();}});await assert.rejects(d.send(send));const original=storage.getItem(DATING_CHECKPOINT_KEY);time+=5000;await assert.rejects(d.retry({actorId,demo}));assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),original);
});
test('clear during asynchronous checkpoint hashing cannot publish a late marker or dispatch a POST',async()=>{
  const storage=store();let calls=0;const d=createDatingDelivery({checkpoint:createDatingCheckpoint({storage,binding,clock:()=>START}),request:async()=>{calls++;}});const promise=d.send(send);const rejected=assert.rejects(promise);d.clear();await rejected;assert.equal(calls,0);assert.equal(d.snapshot(),null);assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);
});
test('binding changes and expiry stop retrying an in-memory body, and send without restore cannot overwrite another unresolved marker',async()=>{
  let current=binding,time=START;const storage=store(),cp=createDatingCheckpoint({storage,binding:()=>current,clock:()=>time,maxAgeMs:1000});const d=createDatingDelivery({checkpoint:cp,request:async()=>{throw unknown();}});await assert.rejects(d.send(send));current=binding+'other';await assert.rejects(d.retry({actorId,demo}),{code:'delivery-checkpoint-expired'});assert.equal(d.snapshot(),null);assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);
  current=binding;await assert.rejects(d.send(send));time+=1000;await assert.rejects(d.check({actorId,demo}),{code:'delivery-checkpoint-expired'});assert.equal(d.snapshot(),null);assert.equal(storage.getItem(DATING_CHECKPOINT_KEY),null);
  const id=randomUUID();await cp.write({actorId,demo,requestId:id});let writes=0;const other=createDatingDelivery({checkpoint:cp,request:async()=>{writes++;}});await assert.rejects(other.send(send),{code:'delivery-pending'});assert.equal(other.snapshot().requestId,id);assert.equal(other.snapshot().checkOnly,true);assert.equal(writes,0);
});
test('failed marker cleanup reports the limitation without claiming a proven successful mutation failed',async()=>{
  const storage=store();storage.removeItem=()=>{throw new Error('synthetic cleanup');};const d=createDatingDelivery({checkpoint:createDatingCheckpoint({storage,binding,clock:()=>START}),request:async()=>({ok:true,appliedRevision:5,result:{saved:true},view:{accountId:actorId,revision:5}})});const result=await d.send(send);assert.equal(result.ok,true);assert.equal(result.checkpointCleanupFailed,true);assert.equal(d.snapshot(),null);assert.ok(storage.getItem(DATING_CHECKPOINT_KEY));assert.equal(d.clear(),false);
});
