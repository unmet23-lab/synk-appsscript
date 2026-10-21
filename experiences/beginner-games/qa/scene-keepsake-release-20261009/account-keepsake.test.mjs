import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldPlayHost} from '../../../play-common/account-host.mjs';
import {emptyPlayState,validatePlayChanges} from '../../../play-common/play-data.mjs';
import {KeepsakeStore,keepsakeSaveState} from '../../../word-magic/keepsakes.mjs';
import {initialProgress,SAVE_KEY} from '../../../word-magic/core.mjs';
import {LAB_SETS} from '../../../word-magic/content.mjs';

function storage(){const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function server(){const accounts=new Map(),actions=[];return {accounts,actions,client(accountId){const row=()=>{if(!accounts.has(accountId))accounts.set(accountId,{revision:0,state:emptyPlayState(),receipts:new Map()});return accounts.get(accountId);},response=()=>({ok:true,scope:'synk-play',accountId,revision:row().revision,state:structuredClone(row().state)});return {load:async()=>response(),mutate:async body=>{const r=row();if(r.receipts.has(body.id))return {...response(),duplicate:true};assert.equal(body.action,'progress','scene storage never submits a wallet command');const changes=validatePlayChanges(body.changes);for(const c of changes)if((r.state.records[c.key]??null)!==c.previous)throw Object.assign(Error('another device changed progress'),{code:'REVISION_CONFLICT'});for(const c of changes){if(c.value===null)delete r.state.records[c.key];else r.state.records[c.key]=c.value;}actions.push(body.action);r.revision++;r.receipts.set(body.id,true);return response();}};}};}
const host=(remote,accountId='scene-owner')=>createWorldPlayHost({accountId,client:remote.client(accountId),guard(){},storage:storage()});
const store=h=>new KeepsakeStore({storage:h.storage(),key:SAVE_KEY,initial:initialProgress});
const scene=n=>({id:`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`,name:`My scene ${n}`,createdAt:'2026-10-09T13:00:00.000Z',set:'default',objects:LAB_SETS.default.objects.map(o=>({id:o.id,size:n%2?1.55:.62,open:false,level:0})),words:['grow','shrink']});

test('real WORLD host restores named scenes on a separate fresh storage while preserving adventure and wallet',async t=>{
 const remote=server(),a=host(remote),b=host(remote);t.after(()=>{a.stop();b.stop();});await a.ready();
 const progress={...initialProgress(),introduced:['size'],completed:['size-1'],last:1,resume:{screen:'puzzle',sceneIndex:1,partial:true},futureCompatible:{note:'keep this field'}};
 a.storage().setItem(SAVE_KEY,JSON.stringify(progress));await a.flush();const walletBefore=structuredClone(a.snapshot().state.wallet);
 const book=store(a),result=await book.save(scene(1));assert.equal(result.ok,true);assert.notEqual(keepsakeSaveState({...a.status(),mode:'account'}),'synced','queued JSON is not proof of a remote save');await a.flush();await b.ready();
 const restored=store(b).read();assert.equal(restored.scenes.length,1);assert.equal(restored.scenes[0].name,'My scene 1');const {keepsakes,...rest}=restored.progress,{keepsakes:initialKept,...unchanged}=progress;assert.deepEqual(rest,unchanged);assert.deepEqual(b.snapshot().state.wallet,walletBefore);assert.equal(keepsakeSaveState({...b.status(),mode:'account'}),'synced');assert(remote.actions.every(x=>x==='progress'));
});
test('a second device cannot overwrite a scene change until the existing account conflict is resolved',async t=>{
 const remote=server(),a=host(remote),b=host(remote);t.after(()=>{a.stop();b.stop();});await a.ready();a.storage().setItem(SAVE_KEY,JSON.stringify({...initialProgress(),introduced:['size']}));await a.flush();await b.ready();
 assert.equal((await store(a).save(scene(1))).ok,true);await a.flush();assert.equal((await store(b).save(scene(2))).ok,true);await assert.rejects(b.flush(),{code:'REVISION_CONFLICT'});assert.equal(keepsakeSaveState({...b.status(),mode:'account'}),'conflict');
 const saved=JSON.parse(remote.accounts.get('scene-owner').state.records[SAVE_KEY]);assert.equal(saved.keepsakes[0].id,scene(1).id);assert.equal(store(b).read().scenes[0].id,scene(2).id,'unconfirmed local scene remains recoverable');
});
test('logout closes the old keepsake handle and another account restores no previous scene',async t=>{
 const remote=server(),a=host(remote),other=host(remote,'other-scene-owner');t.after(()=>{a.stop();other.stop();});await a.ready();a.storage().setItem(SAVE_KEY,JSON.stringify({...initialProgress(),introduced:['size']}));await a.flush();const old=store(a);await old.save(scene(1));await a.flush();a.stop();
 assert.equal((await old.save(scene(2))).ok,false);assert.equal(old.read().available,false);await other.ready();assert.equal(other.storage().getItem(SAVE_KEY),null);assert.equal(store(other).read().scenes.length,0);assert.equal(JSON.parse(remote.accounts.get('scene-owner').state.records[SAVE_KEY]).keepsakes.length,1);
});
