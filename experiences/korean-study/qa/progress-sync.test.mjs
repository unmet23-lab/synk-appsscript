import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProgressSync,progressSnapshot} from '../src/progress-sync.mjs';
const fresh=()=>({v:2,seq:0,obs:[],trail:[],seen:{},recentCards:[],drafts:{a:{text:'private'}},scene:{id:'write'}});
const learned=n=>({...fresh(),seq:n,obs:[{n,kind:'cycle',at:'2026-10-28T00:00:00Z'}],seen:{a:'2026-10-28T00:00:00Z'}});
const disk=()=>{const map=new Map();return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
function setup({local=fresh(),saved=null,version=0,storage=disk(),get=null,post=null}={}){
 let state=local,server=saved,v=version,calls=0;const transport={get:get||(async()=>({version:v,study:server})),post:post||(async body=>{calls++;if(body.baseVersion!==v)throw Object.assign(Error('conflict'),{code:'STUDY_PROGRESS_CONFLICT'});server=body.study;v++;return {version:v,study:server};})};
 const sync=createProgressSync({transport,storage,key:'account.r2',read:()=>state,apply:s=>{state=s;}});
 return {sync,storage,state:()=>state,set:s=>{state=s;sync.changed();},server:()=>server,calls:()=>calls};
}
test('new device restores progress, preserving local private draft and restarting its scene',async()=>{
 const a=setup({saved:progressSnapshot(learned(3)),version:4});assert.equal((await a.sync.init()).phase,'synced');assert.equal(a.state().seq,3);assert.equal(a.state().drafts.a.text,'private');assert.equal(a.state().scene,null);assert.equal(a.calls(),0);
});
test('initial empty server is distinct from failed read; only known base can be uploaded',async()=>{
 const a=setup({local:learned(3)});assert.equal((await a.sync.init()).phase,'pending');await a.sync.flush();assert.equal(a.calls(),1);assert.equal(a.server().drafts,undefined);assert.equal(a.server().scene,undefined);
 const b=setup({local:learned(3),get:async()=>{throw Error('offline');}});assert.equal((await b.sync.init()).phase,'blocked');await b.sync.flush();assert.equal(b.calls(),0);
});
test('divergent histories remain local until explicit server choice saves a full backup',async()=>{
 const a=setup({local:learned(4),saved:progressSnapshot(learned(3)),version:1});assert.equal((await a.sync.init()).phase,'conflict');await a.sync.flush();assert.equal(a.calls(),0);assert.equal(a.state().seq,4);
 const result=await a.sync.useServer();assert.equal(result.phase,'synced');assert.equal(JSON.parse(a.storage.getItem(result.backupKey)).seq,4);assert.equal(a.state().seq,3);
});
test('stale response after account stop cannot replace state or write metadata',async()=>{
 let done;const a=setup({get:()=>new Promise(resolve=>{done=resolve;})});const p=a.sync.init();a.sync.stop();done({version:4,study:progressSnapshot(learned(3))});await p;assert.equal(a.state().seq,0);assert.equal(a.storage.map.size,0);
});
test('edits during acknowledgement remain pending and conflict never retries in a loop',async()=>{
 let ack;const a=setup({local:learned(3),post:body=>new Promise(resolve=>{ack=()=>resolve({version:1,study:body.study});})});await a.sync.init();const p=a.sync.flush();a.set(learned(4));ack();assert.equal((await p).phase,'pending');assert.equal(a.state().seq,4);
 const b=setup({local:learned(3),post:async()=>{throw Object.assign(Error('stale'),{code:'STUDY_PROGRESS_CONFLICT'});}});await b.sync.init();assert.equal((await b.sync.flush()).phase,'conflict');assert.equal((await b.sync.flush()).phase,'conflict');
});
test('backup quota failure never replaces local progress',async()=>{
 const a=setup({local:learned(4),saved:progressSnapshot(learned(3)),version:1});await a.sync.init();a.storage.setItem=()=>{throw Error('quota');};assert.equal((await a.sync.useServer()).phase,'blocked');assert.equal(a.state().seq,4);
});
