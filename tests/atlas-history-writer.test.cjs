'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),{locks}=require('node:worker_threads');
const {createGame}=require('../atlas/game-learning'),{createMap}=require('../strata');
const {createLearningSync}=require('../atlas/learning-sync');
const file=require.resolve('../atlas/game-learning'),moduleSource=fs.readFileSync(file,'utf8'),map=createMap(require('../strata/maps/topik-i.json'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const disk=()=>{const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};};
test('a failed reset keeps the original history through the next successful write',()=>{
 const storage=disk(),write=storage.setItem;let full=false;storage.setItem=(key,value)=>{if(full)throw Error('synthetic quota');write(key,value);};
 const game=createGame({gameId:'reset.quota',map,storage,fold:false});game.finishSet({kind:'short'});const ids=game.events().map(e=>e.id),epoch=game.memoryPort.epoch(),raw=storage.getItem('synk.atlas.learning.v1.device');
 full=true;assert.throws(()=>game.reset(),error=>error.code==='STORAGE_ERROR');assert.equal(storage.getItem('synk.atlas.learning.v1.device'),raw);assert.equal(game.memoryPort.epoch(),epoch);assert.deepEqual(game.events().map(e=>e.id),ids);
 full=false;game.finishSet({kind:'short'});const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.device'));assert.ok(saved.events.length>ids.length);assert.equal(saved.epoch,epoch);for(const id of ids){assert.ok(game.events().some(event=>event.id===id));assert.ok(saved.events.some(event=>event.id===id));}game.reset();assert.equal(game.events().length,0);assert.notEqual(game.memoryPort.epoch(),epoch);
});
test('disposing retries a failed local write once and reports its actual final durability',()=>{
 const storage=disk(),write=storage.setItem;let full=false;storage.setItem=(key,value)=>{if(full)throw Error('synthetic quota');write(key,value);};
 const game=createGame({gameId:'dispose.retry',map,storage,fold:false});full=true;game.finishSet({kind:'short'});const ids=game.events().map(e=>e.id);full=false;game.dispose();assert.equal(game.flush(),true);const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.device'));for(const id of ids)assert.ok(saved.events.some(e=>e.id===id));
 const failed=createGame({gameId:'dispose.full',map,storage,fold:false});full=true;failed.finishSet({kind:'short'});failed.dispose();assert.equal(failed.flush(),false,'closing must not invent successful persistence');
});
function browser(storage,accountKey,{manager=locks,protocol='https:',storageScope='account',learnerKey='device',origin='https://synk.im',parent=null,atlas=true}={}){
 const source=atlas?moduleSource:null;
 const listeners=new Map(),context={module:{exports:{}},require:createRequire(file),document:{},location:{protocol,origin},navigator:{locks:manager},AbortController,console,addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);}};
 vm.createContext(context);context.window=vm.runInContext('globalThis',context);
 // As in a browser, before the module runs: a top window is its own parent. A frame is its own copy of the module (its own
 // realm) whose parent is the page's window; a cross-origin parent throws SecurityError on any read beyond its identity.
 const crossOrigin=parent&&parent.window.location.origin!==origin;
 context.parent=!parent?context.window:crossOrigin?new Proxy({},{get(){throw Object.assign(new Error('Blocked a frame from accessing a cross-origin frame.'),{name:'SecurityError'});}}):parent.window;
 if(source!==null)vm.runInContext(source,context,{filename:file});
 context.removeEventListener=(name,fn)=>{listeners.set(name,(listeners.get(name)||[]).filter(other=>other!==fn));};
 return{window:context.window,game:(id,extra={})=>context.module.exports.createGame({gameId:id,map,storage,storageScope,learnerKey,accountKey:storageScope==='account'?accountKey:null,historyComplete:true,fold:false,...extra}),capture:name=>[...(listeners.get(name)||[])],hide:()=>{for(const fn of listeners.get('pagehide')||[])fn();},show:()=>{for(const fn of listeners.get('pageshow')||[])fn();},listeners:()=>[...listeners.values()].reduce((count,rows)=>count+rows.length,0)};
}

test('disposing every game releases the browser writer and prevents old callbacks from writing',async t=>{
 const storage=disk(),a=browser(storage,'writer.dispose'),b=browser(storage,'writer.dispose'),one=a.game('one'),shared=a.game('shared'),next=b.game('next'),staleCallbacks=[...a.capture('pagehide'),...a.capture('pageshow')];t.after(async()=>{one.dispose();shared.dispose();next.dispose();await tick();});
 for(let i=0;i<20&&!one.syncPort.canPersist();i++)await tick();assert.equal(one.syncPort.canPersist(),true);assert.equal(next.syncPort.canPersist(),false);one.finishSet({kind:'short'});one.dispose();assert.equal(shared.syncPort.canPersist(),true);assert.equal(next.syncPort.canPersist(),false);
 shared.dispose();for(let i=0;i<20&&!next.syncPort.canPersist();i++)await tick();assert.equal(next.syncPort.canPersist(),true);assert.equal(a.listeners(),0);const before=storage.getItem('synk.atlas.learning.v1.device');
 assert.throws(()=>one.finishSet({kind:'short'}),e=>e.code==='GAME_CLOSED');assert.throws(()=>one.setToday('tired'),e=>e.code==='GAME_CLOSED');assert.equal(staleCallbacks.length,2);for(const fn of staleCallbacks)fn();await tick();await tick();assert.equal(storage.getItem('synk.atlas.learning.v1.device'),before);assert.equal((await locks.query()).pending.filter(row=>row.name.includes('writer.dispose')).length,0);assert.equal(one.flush(),true);assert.equal(one.syncPort.canPersist(),false);
});
for(const storageScope of ['device','account'])test(storageScope+' disposed waiting game drains its final practice after ownership arrives',async t=>{
 const storage=disk(),options={storageScope,learnerKey:storageScope==='device'?'writer.closed-pending':'device'},accountKey='writer.closed-pending',a=browser(storage,accountKey,options),b=browser(storage,accountKey,options),one=a.game('owner'),two=b.game('closing');
 t.after(async()=>{one.dispose();two.dispose();a.hide();b.hide();await tick();await tick();});
 for(let i=0;i<30&&!one.syncPort.canPersist();i++)await tick();assert.equal(one.syncPort.canPersist(),true);one.finishSet({kind:'short'});two.finishSet({kind:'short'});
 const wanted=[...one.events(),...two.events()].map(e=>e.id),port=two.syncPort;two.dispose();assert.equal(two.flush(),false);assert.equal(port.canPersist(),false);assert.throws(()=>port.importEvents([]),e=>e.code==='GAME_CLOSED');assert.throws(()=>two.finishSet({kind:'short'}),e=>e.code==='GAME_CLOSED');
 one.dispose();for(let i=0;i<40&&!two.flush();i++)await tick();assert.equal(two.flush(),true,'The queued final history must drain without reviving its disposed game');assert.equal(b.listeners(),0);
 const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.'+options.learnerKey));for(const id of wanted)assert.ok(saved.events.some(e=>e.id===id),'Disposed waiting history lost '+id);assert.equal(new Set(saved.events.map(e=>e.id)).size,saved.events.length);
});
test('a replacement game adopts the browser writer while an older disposed game drains',async t=>{
 const storage=disk(),a=browser(storage,'writer.closed-replacement'),b=browser(storage,'writer.closed-replacement'),one=a.game('owner'),old=b.game('old');let replacement;
 t.after(async()=>{one.dispose();old.dispose();replacement?.dispose();a.hide();b.hide();await tick();await tick();});
 for(let i=0;i<30&&!one.syncPort.canPersist();i++)await tick();one.finishSet({kind:'short'});old.finishSet({kind:'short'});const wanted=old.events().map(e=>e.id);old.dispose();replacement=b.game('replacement');replacement.finishSet({kind:'short'});wanted.push(...one.events().map(e=>e.id),...replacement.events().map(e=>e.id));
 one.dispose();for(let i=0;i<40&&!replacement.syncPort.canPersist();i++)await tick();assert.equal(replacement.syncPort.canPersist(),true);assert.equal(old.flush(),true);assert.equal(old.syncPort.canPersist(),false);
 const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.device'));for(const id of wanted)assert.ok(saved.events.some(e=>e.id===id),'Replacement lost queued history '+id);replacement.dispose();assert.equal(b.listeners(),0);
});
test('an explicit reset wins over the pending final write of a disposed game',async t=>{
 const storage=disk(),options={storageScope:'device',learnerKey:'writer.closed-reset'},a=browser(storage,null,options),b=browser(storage,null,options),one=a.game('owner'),two=b.game('closing');t.after(async()=>{one.dispose();two.dispose();a.hide();b.hide();await tick();await tick();});
 for(let i=0;i<30&&!one.syncPort.canPersist();i++)await tick();one.finishSet({kind:'short'});two.finishSet({kind:'short'});const removed=two.events().map(e=>e.id);two.dispose();one.reset();const epoch=one.memoryPort.epoch();one.dispose();for(let i=0;i<40&&!two.flush();i++)await tick();assert.equal(two.flush(),true);
 const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.'+options.learnerKey));assert.equal(saved.epoch,epoch);assert.ok(!saved.events.some(e=>removed.includes(e.id)),'Final draining must not resurrect records removed by an explicit reset');assert.equal(b.listeners(),0);
});
test('a conflicting stored event cannot strand the writer when disposal flush throws',async t=>{
 const storage=disk(),a=browser(storage,'writer.closed-conflict'),b=browser(storage,'writer.closed-conflict'),one=a.game('owner'),two=b.game('waiting');t.after(async()=>{one.dispose();two.dispose();a.hide();b.hide();await tick();await tick();});
 for(let i=0;i<30&&!one.syncPort.canPersist();i++)await tick();one.finishSet({kind:'short'});const raw=JSON.parse(storage.getItem('synk.atlas.learning.v1.device'));raw.events[0].at=new Date(Date.parse(raw.events[0].at)+1).toISOString();storage.setItem('synk.atlas.learning.v1.device',JSON.stringify(raw));
 assert.doesNotThrow(()=>one.dispose());assert.equal(one.flush(),false);assert.equal(a.listeners(),0);for(let i=0;i<40&&!two.syncPort.canPersist();i++)await tick();assert.equal(two.syncPort.canPersist(),true);two.dispose();assert.equal(b.listeners(),0);
});
test('reset reports a partial preference clear failure and a later retry actually clears it',()=>{
 const storage=disk(),remove=storage.removeItem,game=createGame({gameId:'reset.preferences',map,storage,fold:false});game.finishSet({kind:'short'});game.setToday('tired');game.setPresentation({motion:'reduced'});const epoch=game.memoryPort.epoch();storage.removeItem=()=>{throw Error('synthetic remove denied');};
 assert.throws(()=>game.reset(),error=>error.code==='STORAGE_ERROR');assert.notEqual(game.memoryPort.epoch(),epoch);assert.equal(game.events().length,0,'The history write succeeded; never claim it was rolled back');assert.equal(game.today(),'tired');assert.deepEqual(game.presentation(),{motion:'reduced'});
 storage.removeItem=remove;assert.doesNotThrow(()=>game.reset());assert.equal(game.today(),null);assert.equal(game.presentation(),null);assert.equal(game.events().length,0);
});
test('an in-memory game without stored preferences can still reset',()=>{const game=createGame({gameId:'reset.volatile',map,fold:false});assert.doesNotThrow(()=>game.reset());assert.equal(game.events().length,0);});
for(const storageScope of ['device','account'])test(storageScope+' initial writer preserves waiting practice before the first root exists',async t=>{
 const storage=disk(),options={storageScope,learnerKey:storageScope==='device'?'writer.initial':'device'},accountKey='writer.initial',a=browser(storage,accountKey,options),b=browser(storage,accountKey,options),one=a.game('owner'),two=b.game('waiting');t.after(async()=>{a.hide();b.hide();await tick();await tick();});
 two.finishSet({kind:'short'});const pending=two.events().map(e=>e.id);assert.equal(pending.length,2);for(let i=0;i<20&&!one.syncPort.canPersist();i++)await tick();one.finishSet({kind:'short'});const expected=new Set([...one.events().map(e=>e.id),...pending]);a.hide();for(let i=0;i<20&&!two.syncPort.canPersist();i++)await tick();assert.equal(two.syncPort.canPersist(),true);const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.'+options.learnerKey));for(const id of expected)assert.ok(saved.events.some(e=>e.id===id),'Initial handover lost '+id);
});
test('an explicit reset is not mistaken for initial owner adoption',async t=>{
 const storage=disk(),options={storageScope:'device',learnerKey:'writer.initial-reset'},a=browser(storage,null,options),b=browser(storage,null,options),one=a.game('owner'),two=b.game('waiting');t.after(async()=>{a.hide();b.hide();await tick();await tick();});two.finishSet({kind:'short'});const ids=two.events().map(e=>e.id);for(let i=0;i<20&&!one.syncPort.canPersist();i++)await tick();one.reset();assert.deepEqual(two.events().map(e=>e.id),[]);a.hide();for(let i=0;i<20&&!two.syncPort.canPersist();i++)await tick();const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.'+options.learnerKey));for(const id of ids)assert.ok(!saved.events.some(e=>e.id===id));
});
for(const storageScope of ['device','account'])test(storageScope+' initial handover keeps an open question answerable and durable',async t=>{
 const storage=disk(),options={storageScope,learnerKey:storageScope==='account'?'device':'writer.open'},accountKey='writer.open',a=browser(storage,accountKey,options),b=browser(storage,accountKey,options),one=a.game('owner'),two=b.game('waiting');t.after(async()=>{a.hide();b.hide();await tick();await tick();});
 const pid=two.present({id:'initial.open',itemKey:'initial.open',skillId:'ko.reading.detail',modality:'reading',difficulty:1}),ids=two.events().map(e=>e.id);assert.ok(ids.length>0);
 for(let i=0;i<20&&!one.syncPort.canPersist();i++)await tick();one.finishSet({kind:'short'});a.hide();for(let i=0;i<20&&!two.syncPort.canPersist();i++)await tick();assert.equal(two.syncPort.canPersist(),true);
 const before=two.events().length;assert.doesNotThrow(()=>two.answer(pid,{correct:true,assessable:true}));assert.ok(two.events().length>before);const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.'+options.learnerKey));for(const id of [...ids,...two.events().map(e=>e.id)])assert.ok(saved.events.some(e=>e.id===id));
});
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
// 2026-11-10 (GPT GA1, talk-atlas-vellum-sync): a waiting tab's synchroniser read the outbox when it opened. By the time it takes
// the history over, the tab that wrote has sent, folded and let the log forget entries that copy still expects. The stored outbox
// is the one outbox: the new writer reads it again before it collects.
function account(name){
 let now=Date.parse('2026-11-10T00:00:00Z');const log=[],copy=value=>JSON.parse(JSON.stringify(value)),storage=disk(),clock=()=>new Date(now).toISOString();
 const transport={get:async({after})=>({events:copy(log.slice(after)),cursor:log.length,hasMore:false,revision:1}),post:async({events})=>{for(const e of events)if(!log.some(x=>x.id===e.id))log.push(copy(e));return{accepted:events.map(e=>e.id),revision:1};}};
 // A synchronised store folds what the server sent back; a tiny limit folds each answered item at its next complete pull.
 const tab=()=>{const page=browser(storage,name),game=page.game('world-account',{historyComplete:false,fold:{remote:true,max:2,keep:0,ageMs:0},clock});
  return{page,game,sync:createLearningSync({adapter:game,accountKey:name,revision:1,storage,transport,auto:false,maxAttempts:1,backoffMs:[0],sleep:async()=>{}})};};
 const answer=(game,id)=>{now+=1000;const pid=game.present({id,itemKey:id,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice'});now+=1000;return game.answer(pid,{correct:true,assessable:true});};
 // Sent, then sent back: the second pull settles the entries and the log folds them and forgets it did.
 const sendAndFold=async sync=>{now+=1000;assert.equal((await sync.flush()).phase,'synced');now+=1000;assert.equal((await sync.flush()).phase,'synced');};
 return{log,storage,tab,answer,sendAndFold,step:ms=>{now+=ms;},outbox:()=>JSON.parse(storage.getItem('synk.atlas.learning-sync.v1.'+name)),history:()=>JSON.parse(storage.getItem('synk.atlas.learning.v1.device'))};
}
const owns=async game=>{for(let i=0;i<40&&!game.syncPort.canPersist();i++)await tick();assert.equal(game.syncPort.canPersist(),true);};
test('a tab taking the history over adopts the stored outbox: entries the other tab sent, folded and forgot are not queued here',async t=>{
 const acct=account('handover.pending'),a=acct.tab();let b;t.after(async()=>{a.sync.stop();b?.sync.stop();a.game.dispose();b?.game.dispose();a.page.hide();b?.page.hide();await tick();await tick();});
 await owns(a.game);assert.equal((await a.sync.start()).phase,'synced');
 acct.answer(a.game,'first');
 b=acct.tab();
 assert.deepEqual([b.game.syncPort.canPersist(),b.sync.status().queued,b.sync.status().cursor],[false,4,0],'the waiting tab read four queued entries');
 await acct.sendAndFold(a.sync);
 assert.deepEqual([acct.history().ledger.folded,acct.history().events.length,acct.history().dropped],[4,0,undefined],'the writer folded them and its log forgot it did');
 b.game.summary(); // joins the fold: the four entries leave this copy of the log
 acct.answer(a.game,'second');assert.equal((await a.sync.flush()).queued,0);
 b.game.summary(); // follows the stored list of folded ids, now empty
 assert.deepEqual([acct.outbox().pending,acct.outbox().cursor],[[],4]);
 a.page.hide();await owns(b.game);
 const taken=b.sync.status();
 assert.deepEqual([taken.phase,taken.code,taken.queued,taken.cursor],['idle',null,0,4],'the new writer starts from the stored outbox');
 acct.step(1000);const done=await b.sync.flush();
 assert.deepEqual([done.phase,done.queued,done.complete,done.cursor],['synced',0,true,8]);
 acct.answer(b.game,'third');assert.equal((await b.sync.flush()).queued,0);assert.equal(acct.log.length,12,'the server holds every entry once');
});
test('a tab taking the history over does not take entries the other tab folded for lost: nothing is fetched or counted twice',async t=>{
 const acct=account('handover.acknowledged'),a=acct.tab();let b;t.after(async()=>{a.sync.stop();b?.sync.stop();a.game.dispose();b?.game.dispose();a.page.hide();b?.page.hide();await tick();await tick();});
 await owns(a.game);assert.equal((await a.sync.start()).phase,'synced');
 acct.answer(a.game,'first');acct.step(1000);assert.equal((await a.sync.flush()).queued,0);
 b=acct.tab();
 assert.deepEqual([b.game.syncPort.canPersist(),acct.outbox().acknowledged.length,b.sync.status().queued],[false,4,0],'the waiting tab read four acknowledged entries');
 acct.step(1000);assert.equal((await a.sync.flush()).phase,'synced');
 assert.deepEqual([acct.history().ledger.folded,acct.outbox().acknowledged],[4,[]]);
 b.game.summary();acct.answer(a.game,'second');assert.equal((await a.sync.flush()).queued,0);b.game.summary();
 a.page.hide();await owns(b.game);
 assert.deepEqual([b.sync.status().phase,acct.outbox().missing],['idle',[]],'folded entries are on the server, not lost');
 acct.step(1000);const done=await b.sync.flush();assert.deepEqual([done.phase,done.complete,done.queued],['synced',true,0]);
 const ledger=acct.history().ledger,counts=b.game.summary().counts;
 assert.deepEqual([ledger.adjusted||0,counts.attempts,counts.presented],[0,2,2],'the two answers are read once each');
 assert.equal(acct.log.length,8);
});
test('a tab taking the history over is as complete as the outbox it adopts',async t=>{
 const acct=account('handover.complete'),a=acct.tab();let b;t.after(async()=>{a.sync.stop();b?.sync.stop();a.game.dispose();b?.game.dispose();a.page.hide();b?.page.hide();await tick();await tick();});
 await owns(a.game);b=acct.tab();
 assert.deepEqual([acct.outbox().complete,b.sync.status().complete],[false,false],'the waiting tab opened before the first pull ended');
 assert.equal((await a.sync.start()).complete,true);acct.answer(a.game,'first');assert.equal((await a.sync.flush()).queued,0);
 a.page.hide();await owns(b.game);
 assert.equal(b.sync.status().complete,true);
 assert.equal(acct.answer(b.game,'second').independent,true,'a first answer here counts: the log is whole, as the stored outbox says');
});
test('an entry the stored outbox itself queues but no log holds still stops the sync, at opening and at a takeover',async t=>{
 // What another tab sent and folded is not this copy's to expect; an entry the one stored outbox queues and no fold accounts for is a loss.
 const name='handover.real-gap',acct=account(name),a=acct.tab();let b;t.after(async()=>{a.sync.stop();b?.sync.stop();a.game.dispose();b?.game.dispose();a.page.hide();b?.page.hide();await tick();await tick();});
 await owns(a.game);assert.equal((await a.sync.start()).phase,'synced');
 acct.answer(a.game,'first');b=acct.tab();
 const broken={...acct.outbox(),pending:[...acct.outbox().pending,'never.written']};
 acct.storage.setItem('synk.atlas.learning-sync.v1.'+name,JSON.stringify(broken));
 a.page.hide();await owns(b.game);
 assert.deepEqual([b.sync.status().phase,b.sync.status().code],['blocked','STORAGE_ERROR'],'a takeover reads the stored outbox and finds the gap');
 const port={scope:'account',accountKey:name,events:()=>acct.history().events,partial:()=>false,dropped:()=>[],subscribe:()=>()=>{},markComplete(){},importEvents:()=>({added:0})};
 const refused=()=>assert.fail('a blocked sync makes no request');
 const opened=createLearningSync({adapter:{syncPort:port},accountKey:name,revision:1,storage:acct.storage,auto:false,transport:{get:refused,post:refused}});
 assert.deepEqual([opened.status().phase,opened.status().code],['blocked','STORAGE_ERROR'],'so does a copy opened over it');
 assert.equal((await opened.retry()).phase,'blocked');opened.stop();
});
for(const [label,write,code] of [['unreadable',()=>'broken','STORAGE_ERROR'],['of another consent revision',outbox=>JSON.stringify({...outbox,revision:2}),'REVISION_CONFLICT']])
 test('a stored outbox that is '+label+' stops the tab that takes over and is kept as it is',async t=>{
 const name='handover.'+code.toLowerCase(),key='synk.atlas.learning-sync.v1.'+name,acct=account(name),a=acct.tab();let b;t.after(async()=>{a.sync.stop();b?.sync.stop();a.game.dispose();b?.game.dispose();a.page.hide();b?.page.hide();await tick();await tick();});
 await owns(a.game);assert.equal((await a.sync.start()).phase,'synced');
 acct.answer(a.game,'first');b=acct.tab();
 const raw=write(acct.outbox());acct.storage.setItem(key,raw);
 a.page.hide();await owns(b.game);
 assert.deepEqual([b.sync.status().phase,b.sync.status().code,b.sync.status().complete],['blocked',code,false]);
 assert.equal(acct.storage.getItem(key),raw,'nothing replaces an outbox this copy could not read');
});
// 2026-11-02 (drama in WORLD): the page (WORLD's account bundle) and a same-origin game frame (its own bundle) are two copies
// of this module in one tab. They share one writer; a separate tab still waits, and a cross-origin frame keeps its own table.
test('a same-origin frame shares its page writer while another tab and a cross-origin frame wait',async t=>{
 const storage=disk(),page=browser(storage,'writer.frame'),frame=browser(storage,'writer.frame',{parent:page}),tab=browser(storage,'writer.frame'),foreign=browser(storage,'writer.frame',{parent:page,origin:'https://elsewhere.example'});
 const host=page.game('page'),game=frame.game('frame'),other=tab.game('tab'),stranger=foreign.game('foreign');
 t.after(async()=>{host.dispose();game.dispose();other.dispose();stranger.dispose();page.hide();tab.hide();await tick();await tick();});
 for(let i=0;i<30&&!host.syncPort.canPersist();i++)await tick();
 assert.equal(host.syncPort.canPersist(),true);assert.equal(game.syncPort.canPersist(),true,'the frame shares the page lease');
 assert.equal(other.syncPort.canPersist(),false,'another tab waits');assert.equal(stranger.syncPort.canPersist(),false,'a cross-origin frame does not join');
 assert.equal(frame.listeners(),0,'the frame registers no pagehide of its own');
 game.finishSet({kind:'short'});host.finishSet({kind:'short'});
 const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.device'));for(const id of [...game.events(),...host.events()].map(e=>e.id))assert.ok(saved.events.some(e=>e.id===id),'lost '+id);
 game.dispose();assert.equal(host.syncPort.canPersist(),true,'closing the frame keeps the page writer');
});
test('a frame that opened the shared writer first can go away without stranding its page',async t=>{
 const storage=disk(),page=browser(storage,'writer.frame-first'),frame=browser(storage,'writer.frame-first',{parent:page});
 const early=frame.game('frame');let host;t.after(async()=>{early.dispose();host?.dispose();page.hide();await tick();await tick();});
 for(let i=0;i<30&&!early.syncPort.canPersist();i++)await tick();assert.equal(early.syncPort.canPersist(),true);
 assert.equal(frame.listeners(),0,'the lease and its pagehide belong to the page copy');
 host=page.game('page');assert.equal(host.syncPort.canPersist(),true,'the page joins the frame-opened writer');
 early.dispose();assert.equal(host.syncPort.canPersist(),true,'the frame leaving keeps the page writer');
 host.finishSet({kind:'short'});const saved=JSON.parse(storage.getItem('synk.atlas.learning.v1.device'));for(const e of host.events())assert.ok(saved.events.some(x=>x.id===e.id));
});
test('a frame whose top window has no Atlas keeps its own lease',async t=>{
 const storage=disk(),page=browser(storage,'writer.bare-top',{atlas:false}),frame=browser(storage,'writer.bare-top',{parent:page}),tab=browser(storage,'writer.bare-top');
 const game=frame.game('frame'),other=tab.game('tab');t.after(async()=>{game.dispose();other.dispose();frame.hide();tab.hide();await tick();await tick();});
 for(let i=0;i<30&&!game.syncPort.canPersist()&&!other.syncPort.canPersist();i++)await tick();
 assert.equal(game.syncPort.canPersist()!==other.syncPort.canPersist(),true,'exactly one of the frame and the other tab writes');
});
