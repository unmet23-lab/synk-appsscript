'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame}=require('../atlas/game-learning');
const {createPages,PAGE_ITEMS}=require('../atlas/learning-pages');
const {createMap}=require('../strata');
const map=createMap(require('../strata/maps/topik-i.json'));
const disk=()=>{const data=new Map();return{data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const game=storage=>createGame({gameId:'storage-recovery',map,storage,clock:()=> '2026-10-29T00:00:00.000Z'});

test('a writer left behind after publication protects its own pages without stopping future collection',()=>{
 const storage=disk(),key='crashed-writer',pages=createPages(storage,key,['events']),remove=storage.removeItem;
 const data={events:Array.from({length:PAGE_ITEMS*10},(_,id)=>({id,value:0}))};
 storage.removeItem=name=>{if(!name.startsWith(key+'.writer.'))remove(name);};
 let raw=pages.write(data,null);const held=[...storage.data.keys()].filter(name=>name.startsWith(key+'.page.'));
 storage.removeItem=remove;assert.equal([...storage.data.keys()].filter(name=>name.startsWith(key+'.writer.')).length,1);
 for(let turn=1;turn<=40;turn++){data.events.at(-1).value=turn;raw=pages.write(data,raw);assert.deepEqual(createPages(storage,key,['events']).decode(raw),data);assert.ok([...storage.data.keys()].filter(name=>name.startsWith(key+'.page.')).length<=held.length+1,'a leftover writer must not disable all future collection');}
 for(const name of held)assert.equal(typeof storage.getItem(name),'string','never expire a potentially paused writer');
});
test('another writer cannot collect a paused writer\'s staged pages before its root publication',()=>{
 const storage=disk(),key='staged-writer',data={events:Array.from({length:PAGE_ITEMS*2},(_,id)=>({id,value:0}))};
 const seed=createPages(storage,key,['events']),raw=seed.write(data,null),b=createPages(storage,key,['events']);b.decode(raw);
 let intervene=true,protectedStage=false,newer;
 const a=createPages({...storage,get length(){return storage.length;},setItem(name,value){
  storage.setItem(name,value);if(intervene&&name.startsWith(key+'.page.')){intervene=false;
   const changed=structuredClone(data);changed.events.at(-1).value=2;newer=b.write(changed,raw);
   assert.equal(storage.getItem(name),value,'in-progress page ownership must survive another writer\'s cleanup');protectedStage=true;
  }
 }},key,['events']);a.decode(raw);const changed=structuredClone(data);changed.events[0].value=1;
 assert.throws(()=>a.write(changed,raw),/changed/);assert.equal(protectedStage,true);
 const expected=structuredClone(data);expected.events.at(-1).value=2;assert.deepEqual(createPages(storage,key,['events']).decode(newer),expected);
});
test('an unchanged paged write still succeeds when only a small writer fence fits the origin quota',()=>{
 const storage=disk(),key='near-quota',pages=createPages(storage,key,['events']),data={events:Array.from({length:PAGE_ITEMS*10},(_,id)=>({id}))};
 const raw=pages.write(data,null),limit=5*1024**2,padding='unrelated-padding';
 const used=()=>[...storage.data].reduce((sum,[k,v])=>sum+k.length+v.length,0);
 storage.setItem(padding,'x'.repeat(limit-used()-padding.length-128));const set=storage.setItem;
 storage.setItem=(name,value)=>{const next=used()-(storage.data.has(name)?name.length+storage.getItem(name).length:0)+name.length+value.length;
  if(next>limit)throw Object.assign(Error('synthetic origin quota'),{name:'QuotaExceededError'});set(name,value);
 };
 assert.equal(pages.write(data,raw),raw);assert.deepEqual(createPages(storage,key,['events']).decode(raw),data);
 assert.ok(used()<=limit);assert.equal([...storage.data.keys()].filter(name=>name.startsWith(key+'.writer.')).length,0);
});

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
