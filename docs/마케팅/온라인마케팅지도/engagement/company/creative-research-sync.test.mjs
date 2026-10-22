import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreativeResearchSyncService} from './creative-research-sync.mjs';

const documentId='cadence_doc_1234567890abcdef',admin={id:'admin-1',active:true,role:'admin'};
function memoryStore(){
  const tables=new Map(),table=name=>{if(!tables.has(name))tables.set(name,new Map());return tables.get(name);};
  table('users').set(admin.id,admin);
  return {get:(name,key)=>structuredClone(table(name).get(key)),put:(name,key,value)=>{table(name).set(key,structuredClone(value));},remove:(name,key)=>{table(name).delete(key);},all:name=>[...table(name).values()].map(value=>structuredClone(value)),transaction:fn=>fn()};
}
function service(reader){
  let now='2026-10-22T00:00:00.000Z';
  const sync=createCreativeResearchSyncService({store:memoryStore(),research:{importReport(){throw new Error('no report expected');}},reader,clock:()=>now});
  sync.configure(admin,{enabled:true,documentId});
  return {sync,at:value=>{now=value;}};
}
const minutes=(from,to)=>(Date.parse(to)-Date.parse(from))/60000;

test('an unchanged research document is read once per ten minutes, not every 30-second server tick',async()=>{
  let reads=0;const {sync,at}=service(async()=>{reads++;return {text:'아직 쓰는 중',modifiedTime:'2026-10-21T23:00:00.000Z'};});
  await sync.tick('2026-10-22T00:00:00.000Z');assert.equal(reads,1);
  for(const tick of ['00:00:30','00:05:00','00:09:59']){at('2026-10-22T'+tick+'.000Z');await sync.tick('2026-10-22T'+tick+'.000Z');}
  assert.equal(reads,1);
  const state=sync.state(admin);assert.equal(state.status,'waiting');assert.equal(minutes('2026-10-22T00:00:00.000Z',state.nextCheckAt),10);
  at('2026-10-22T00:10:00.000Z');await sync.tick('2026-10-22T00:10:00.000Z');assert.equal(reads,2);
  await sync.tick('2026-10-22T00:10:30.000Z',{force:true});assert.equal(reads,3,'the administrator check still reads at once');
});

test('read failures retry after 1, 2, 4 and 8 minutes and then no faster than the normal interval',async()=>{
  let reads=0;const {sync,at}=service(async()=>{reads++;throw new Error('drive unavailable');});
  let now='2026-10-22T00:00:00.000Z';const gaps=[];
  for(let i=0;i<6;i++){at(now);await sync.tick(now);const state=sync.state(admin);assert.equal(state.status,'error');assert.equal(state.lastErrorCode,'SYNC_READ_FAILED');gaps.push(minutes(now,state.nextCheckAt));now=state.nextCheckAt;}
  assert.deepEqual(gaps,[1,2,4,8,10,10]);assert.equal(reads,6);
});
