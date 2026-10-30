'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),{locks}=require('node:worker_threads');
const {createGame}=require('../atlas/game-learning'),{createMap}=require('../strata');
const {createLearningSync}=require('../atlas/learning-sync');
const file=require.resolve('../atlas/game-learning'),source=fs.readFileSync(file,'utf8'),map=createMap(require('../strata/maps/topik-i.json'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const disk=()=>{const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};};
function browser(storage,accountKey,{manager=locks,protocol='https:',storageScope='account',learnerKey='device'}={}){
 const listeners=new Map(),context={module:{exports:{}},require:createRequire(file),document:{},location:{protocol},navigator:{locks:manager},AbortController,console,addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);}};
 vm.runInNewContext(source,context,{filename:file});
 return{game:id=>context.module.exports.createGame({gameId:id,map,storage,storageScope,learnerKey,accountKey:storageScope==='account'?accountKey:null,historyComplete:true,fold:false}),hide:()=>{for(const fn of listeners.get('pagehide')||[])fn();},show:()=>{for(const fn of listeners.get('pageshow')||[])fn();}};
}
for(const paged of [false,true])test((paged?'paged':'small')+' browser histories have one writer and preserve both tabs after handover',async t=>{
 assert.ok(locks,'These integration tests require the repository Node24 test runtime');
 const storage=disk(),accountKey='writer.'+(paged?'paged':'small'),seed=createGame({gameId:'seed',map,storage,storageScope:'account',accountKey,fold:false});for(let i=0;i<(paged?520:1);i++)seed.finishSet({kind:'short'});
 const before=new Set(seed.events().map(e=>e.id)),a=browser(storage,accountKey),b=browser(storage,accountKey),one=a.game('one'),same=a.game('same'),two=b.game('two');
 t.after(async()=>{a.hide();b.hide();await tick();await tick();});
 for(let i=0;i<20&&!one.syncPort.canPersist();i++)await tick();assert.equal(one.syncPort.canPersist(),true);assert.equal(same.syncPort.canPersist(),true);assert.equal(two.syncPort.canPersist(),false);
 one.finishSet({kind:'short'});same.finishSet({kind:'short'});const committed=storage.getItem('synk.atlas.learning.v1.device');two.finishSet({kind:'short'});
 assert.equal(storage.getItem('synk.atlas.learning.v1.device'),committed,'The waiting tab cannot overwrite the committed root');assert.equal(two.summary().storage.available,false);
 const wanted=new Set([...one.events(),...same.events(),...two.events()].map(e=>e.id));a.hide();for(let i=0;i<20&&!two.syncPort.canPersist();i++)await tick();assert.equal(two.syncPort.canPersist(),true);assert.equal(one.syncPort.canPersist(),false);
 const restored=createGame({gameId:'readback',map,storage,storageScope:'account',accountKey,fold:false}),ids=new Set(restored.events().map(e=>e.id));for(const id of [...before,...wanted])assert.ok(ids.has(id),'History disappeared: '+id);
 assert.equal(ids.size,before.size+6,'All three sets remain, without duplicate events');
});
test('a browser without Web Locks cannot claim a durable write',()=>{
 const storage=disk(),page=browser(storage,'writer.unsupported',{manager:null}),game=page.game('unsupported');game.finishSet({kind:'short'});assert.equal(storage.length,0);assert.equal(game.syncPort.canPersist(),false);assert.equal(game.summary().storage.available,false);page.hide();
});
test('a waiting tab cannot claim that a reset succeeded or replace its epoch',async t=>{
 const storage=disk(),options={storageScope:'device',learnerKey:'writer.reset'},a=browser(storage,null,options),b=browser(storage,null,options),one=a.game('one'),two=b.game('two');t.after(async()=>{a.hide();b.hide();await tick();await tick();});
 for(let i=0;i<20&&!one.syncPort.canPersist();i++)await tick();one.finishSet({kind:'short'});const epoch=two.memoryPort.epoch(),events=two.events().map(event=>event.id);
 assert.throws(()=>two.reset(),error=>error.code==='STORAGE_BUSY');assert.equal(two.memoryPort.epoch(),epoch);assert.deepEqual(two.events().map(event=>event.id),events);
 a.hide();for(let i=0;i<30&&!two.syncPort.canPersist();i++)await tick();assert.ok(two.events().length);two.reset();assert.equal(two.events().length,0);assert.notEqual(two.memoryPort.epoch(),epoch);
});
test('flow memories and pending intents follow the history writer across tabs',async t=>{
 const storage=disk(),a=browser(storage,'writer.flow'),b=browser(storage,'writer.flow'),one=a.game('one'),two=b.game('two'),at='2026-10-31T00:00:00.000Z';
 t.after(async()=>{a.hide();b.hide();await tick();await tick();});
 for(let i=0;i<20&&!one.syncPort.canPersist();i++)await tick();
 const first=one.memoryPort.flow,second=two.memoryPort.flow;
 assert.equal(first.decline('content-a',at,first.epoch()),true);
 assert.equal(second.decline('content-b',at,second.epoch()),false);
 assert.equal(two.setPresentation(null),false);second.clear();
 assert.ok(first.memories().declined['content-a']);assert.equal(first.memories().declined['content-b'],undefined);
 a.hide();for(let i=0;i<30&&!two.syncPort.canPersist();i++)await tick();assert.equal(two.syncPort.canPersist(),true);
 assert.equal(second.decline('content-b',at,second.epoch()),true);
 assert.deepEqual(Object.keys(second.memories().declined).sort(),['content-a','content-b']);
 assert.deepEqual(second.pending().map(row=>row.entry.key).sort(),['content-a','content-b']);
});

test('a waiting synchronizer makes no requests and resumes its explicit start after handover',async t=>{
 const storage=disk(),a=browser(storage,'writer.sync'),b=browser(storage,'writer.sync'),first=a.game('first'),second=b.game('second');t.after(async()=>{a.hide();b.hide();await tick();});for(let i=0;i<20&&!first.syncPort.canPersist();i++)await tick();
 let gets=0,posts=0;const sync=createLearningSync({adapter:second,accountKey:'writer.sync',revision:1,storage,auto:false,transport:{get:async()=>{gets++;return{events:[],cursor:0,hasMore:false,revision:1};},post:async body=>{posts++;return{accepted:body.events.map(e=>e.id),revision:1};}}});t.after(()=>sync.stop());
 second.finishSet({kind:'short'});assert.equal((await sync.start()).code,'STORAGE_BUSY');assert.equal(gets,0);assert.equal(posts,0);a.hide();for(let i=0;i<40&&sync.status().phase!=='synced';i++)await tick();assert.equal(sync.status().phase,'synced');assert.ok(gets>0);assert.ok(posts>0);
});

test('a response arriving after lease loss cannot write history or its outbox',async t=>{
 const storage=disk(),a=browser(storage,'writer.stale'),b=browser(storage,'writer.stale'),first=a.game('first'),second=b.game('second');t.after(async()=>{a.hide();b.hide();await tick();});for(let i=0;i<20&&!first.syncPort.canPersist();i++)await tick();
 let resolve;const sync=createLearningSync({adapter:first,accountKey:'writer.stale',revision:1,storage,auto:false,transport:{get:()=>new Promise(done=>{resolve=done;}),post:async()=>{throw Error('Unexpected post');}}});t.after(()=>sync.stop());const pending=sync.start();for(let i=0;i<20&&!resolve;i++)await tick();assert.ok(resolve);a.hide();for(let i=0;i<20&&!second.syncPort.canPersist();i++)await tick();second.finishSet({kind:'short'});
 const before=Array.from({length:storage.length},(_,i)=>storage.key(i)).map(key=>[key,storage.getItem(key)]);resolve({events:[{id:'stale.remote'}],cursor:1,hasMore:false,revision:1});await pending;assert.equal(sync.status().code,'STORAGE_BUSY');assert.deepEqual(Array.from({length:storage.length},(_,i)=>storage.key(i)).map(key=>[key,storage.getItem(key)]),before);
});
