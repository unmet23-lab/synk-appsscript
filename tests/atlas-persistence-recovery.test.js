'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame}=require('../atlas/game-learning');
const {createPages,PAGE_ITEMS}=require('../atlas/learning-pages');
const {createMap}=require('../strata');
const map=createMap(require('../strata/maps/topik-i.json'));
const disk=()=>{const data=new Map();return{data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const game=storage=>createGame({gameId:'storage-recovery',map,storage,clock:()=> '2026-10-29T00:00:00.000Z'});

for(const afterWrite of [false,true])test(`flush recovers an unwritten answer after a transient ${afterWrite?'acknowledgement':'write'} failure`,()=>{
 const storage=disk(),set=storage.setItem;let failing=false;
 storage.setItem=(key,value)=>{if(afterWrite)set(key,value);if(failing)throw Error('synthetic storage failure');if(!afterWrite)set(key,value);};
 const current=game(storage),p=current.present({id:'fixture',itemKey:'fixture.v1',familyKey:'fixture',skillId:'ko.reading.detail',difficulty:1,modality:'reading',responseFormat:'single-choice',audioRequired:false});
 failing=true;current.answer(p,{correct:true,assessable:true});
 assert.equal(current.summary().storage.available,false);
 const events=current.events();failing=false;
 assert.equal(current.flush(),true);assert.equal(current.summary().storage.available,true);
 assert.deepEqual(game(storage).events(),events);
});

test('a concurrent page cleanup cannot remove another successful root\'s unchanged rows',()=>{
 const storage=disk(),key='synthetic-pages',initial=Array.from({length:PAGE_ITEMS*2},(_,id)=>({id,value:'old'}));
 const seed=createPages(storage,key,['events']);const raw=seed.write({events:initial},null);
 const b=createPages(storage,key,['events']);b.decode(raw);
 let interrupt=null;
 const writerStorage={...storage,get length(){return storage.length;},getItem(name){const result=storage.getItem(name);if(name===key&&interrupt){const run=interrupt;interrupt=null;run();}return result;}};
 const a=createPages(writerStorage,key,['events']);a.decode(raw);
 const first=initial.map((r,i)=>i===0?{...r,value:'a'}:r),second=initial.map((r,i)=>i===PAGE_ITEMS?{...r,value:'b'}:r);
 interrupt=()=>b.write({events:second},raw);
 a.write({events:first},raw);
 const restored=createPages(storage,key,['events']).decode(storage.getItem(key));
 assert.deepEqual(restored.events,first);
 // write() replaces a snapshot. This proof is about immutable page ownership;
 // the higher-level adapter remains responsible for merging concurrent events.
});

test('a publication whose acknowledgement fails never deletes pages a newer root reused',()=>{
 const storage=disk(),key='synthetic-ack',seed=createPages(storage,key,['events']);
 const initial=Array.from({length:PAGE_ITEMS+1},(_,id)=>({id,value:'old'})),updated=initial.map((r,i)=>i===0?{...r,value:'new'}:r),later=updated.map((r,i)=>i===PAGE_ITEMS?{...r,value:'later'}:r);
 const raw=seed.write({events:initial},null);let interrupt=false;
 const wrapper={...storage,get length(){return storage.length;},setItem(name,value){storage.setItem(name,value);if(name===key&&interrupt){interrupt=false;const newer=createPages(storage,key,['events']);newer.decode(value);newer.write({events:later},value);throw Error('synthetic acknowledgement failure');}}};
 const writer=createPages(wrapper,key,['events']);writer.decode(raw);interrupt=true;
 assert.throws(()=>writer.write({events:updated},raw),/acknowledgement/);
 assert.deepEqual(createPages(storage,key,['events']).decode(storage.getItem(key)).events,later);
});

test('unverifiable writer lifetime and limited Storage adapters retain pages conservatively',()=>{
 for(const limited of [false,true]){
  const storage=disk(),key=`synthetic-conservative-${limited}`;
  const adapter=limited?{getItem:storage.getItem,setItem:storage.setItem,removeItem:storage.removeItem}:storage;
  const pages=createPages(adapter,key,['events']),raw=pages.write({events:[{id:1}]},null),old=JSON.parse(raw).arrays.events[0].key;
  if(!limited)storage.setItem(key+'.writer.abandoned','1');
  pages.write({events:[{id:2}]},raw);
  assert.ok(storage.getItem(old),'uncertain references are retained, never guessed expired');
  assert.deepEqual(createPages(adapter,key,['events']).decode(storage.getItem(key)).events,[{id:2}]);
 }
});
