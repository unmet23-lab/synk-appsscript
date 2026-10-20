import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldAccount} from '../world-account.mjs';
import {WorldClient} from '../world-client.mjs';
import {emptyPlayState} from '../../play-common/play-data.mjs';
import {readTutorChoice,saveTutorChoice} from '../../brand-opening/tutor-choice.mjs';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const LIFE='synk.life-korean.progress.v1';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/portal/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const storage=()=>{const data=new Map();return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const signed=(id=A,generation=1)=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:generation,account:{synk_user_id:id}});
const record=id=>({ok:true,account:{synk_user_id:id,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[]});
const snapshot=id=>({ok:true,accountId:id,revision:1,avatar:{slots:{}},inventory:[]});
function fixture(options={}){
 const cache=storage(),tab=storage(),calls=[],states=new Map(),listeners=new Set();
 let source=options.source||signed(),client,connected=0,unsubscribed=0;
 const playState=()=>{const id=source.account.synk_user_id;if(!states.has(id))states.set(id,{state:emptyPlayState(),revision:0});return states.get(id);};
 const emit=state=>{source=state;for(const fn of listeners)fn(state);};
 const bridge={
  getEnvironment:async()=>({clientId:options.clientId||'world'}),
  authStatus:async()=>options.status?options.status(source):source,
  onAuthChanged:fn=>{listeners.add(fn);return ()=>{listeners.delete(fn);unsubscribed++;};},
  authSignIn:async()=>{calls.push({operation:'signIn'});return {ok:true};},
  authSignOut:async()=>{calls.push({operation:'signOut'});emit({configured:true,status:'signed-out',signedIn:false,sessionGeneration:source.sessionGeneration+1,account:null});return {ok:true,serverRevoked:true};},
  accountRequest:async(operation,params={})=>{
   calls.push({operation,params});
   if(options.request){const value=await options.request(operation,params,source);if(value!==undefined)return value;}
   const id=source.account?.synk_user_id;
   if(operation==='load')return record(id);
   if(operation==='worldRequest')return snapshot(id);
   if(operation==='playLoad'||operation==='playMutate'){
    const saved=playState();
    if(operation==='playMutate'){
     assert.equal(params.action,'progress');
     for(const change of params.changes){assert.equal(saved.state.records[change.key]??null,change.previous);saved.state.records[change.key]=change.value;}
     saved.revision++;
    }
    return {ok:true,scope:'synk-play',accountId:id,revision:saved.revision,state:structuredClone(saved.state)};
   }
   throw Error('Unexpected operation '+operation);
  },
 };
 const account=createWorldAccount({config,bridge,storage:tab,getUrl:()=>config.clients.world.redirectUri,
  fetcher:()=>{throw Error('Native transport must not fetch credentials');},navigate:()=>{throw Error('Native transport must not use browser OAuth');},
  onInvalidate:()=>client?.invalidate(),onConnect:()=>{connected++;options.onConnect?.();}});
 client=new WorldClient({account,storage:cache,tabStorage:tab,broadcastAppearance:false});
 return {account,client,cache,tab,calls,states,bridge,emit,connected:()=>connected,unsubscribed:()=>unsubscribed};
}

test('native WORLD verifies its own app and account through IPC without browser credentials',async t=>{
 const f=fixture();t.after(()=>f.account.stop());
 f.tab.setItem('synk.oauth.session.world','browser session untouched');
 assert.equal(await f.client.restore(),true);assert.equal(f.client.snapshot.accountId,A);
 assert.deepEqual(f.calls.map(call=>call.operation),['load','worldRequest']);
 assert.deepEqual(f.calls[1].params,{route:'bootstrap'});
 assert.equal(f.tab.getItem('synk.oauth.session.world'),'browser session untouched');
 assert.equal(f.client.accessToken,null);
 const wrong=fixture({clientId:'platform'});t.after(()=>wrong.account.stop());
 await assert.rejects(wrong.client.restore(),{code:'INVALID_BRIDGE'});assert.equal(wrong.calls.length,0);
});

test('native WORLD routes preserve mutation bodies, conflict status and reject unknown routes',async t=>{
 const f=fixture({request:(operation,params)=>operation==='worldRequest'&&params.route==='avatar/outfit'?{ok:false,error:{code:'REVISION_CONFLICT',status:409},revision:8}:undefined});t.after(()=>f.account.stop());
 await f.client.restore();
 await assert.rejects(f.client.equip({body:'mongle-apron-starter'}),{code:'REVISION_CONFLICT',status:409,revision:8});
 const command=f.calls.at(-1);assert.equal(command.operation,'worldRequest');assert.equal(command.params.route,'avatar/outfit');assert.equal(command.params.body.slots.body,'mongle-apron-starter');
 assert.equal(f.client.status,'conflict');assert.ok(f.client.pending);
 const count=f.calls.length;
 await assert.rejects(f.account.request('https://other.invalid/'),TypeError);
 await assert.rejects(f.account.request('avatar/outfit',{method:'POST',body:'{}'}),TypeError);
 assert.equal(f.calls.length,count);
});

test('native progress uses the existing account PlayHost; tutor choice remains device-local',async t=>{
 const f=fixture();t.after(()=>f.account.stop());await f.client.restore();
 saveTutorChoice(f.cache,A,'kkamong');
 const port=await f.account.prepareLifeProgress({storage:f.cache,target:{}});
 port.storage.setItem(LIFE,JSON.stringify({version:1,owner:A,revision:1}));
 assert.equal((await port.flush()).phase,'synced');
 assert.equal(f.calls.filter(call=>call.operation==='playMutate').length,1);
 const nextCache=storage(),next=await f.account.prepareLifeProgress({storage:nextCache,target:{}});
 assert.equal(JSON.parse(next.storage.getItem(LIFE)).owner,A);
 assert.equal(readTutorChoice(nextCache,A),null);assert.equal(readTutorChoice(f.cache,A),'kkamong');
 const target={},handle=await f.account.prepareGame({target,storage:f.cache});
 target.SYNKPlayHost.storage().setItem('synk.windrun.best','42');await handle.flush();
 assert.equal(f.states.get(A).state.records['synk.windrun.best'],'42');
 assert.equal(f.calls.some(call=>/learning|memory/i.test(call.operation)),false,'no learning consent means no learning or memory traffic');
});

test('native account switch invalidates old game and life ports before new account restore',async t=>{
 const f=fixture();t.after(()=>f.account.stop());await f.client.restore();
 const target={},handle=await f.account.prepareGame({storage:f.cache,target}),play=target.SYNKPlayHost;
 const life=await f.account.prepareLifeProgress({storage:f.cache,target:{}});
 f.emit(signed(B,2));assert.equal(f.client.snapshot,null);assert.equal(target.SYNKPlayHost,undefined);assert.equal(handle.status().disposed,true);
 assert.throws(()=>play.storage().setItem('synk.windrun.best','99'),{code:'ACCOUNT_CHANGED'});
 assert.throws(()=>life.storage.setItem(LIFE,'{}'),{code:'ACCOUNT_CHANGED'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.connected(),1);
 assert.equal(await f.client.restore(),true);assert.equal(f.client.snapshot.accountId,B);
});

test('native Hangul migration uses IPC progress and cannot follow a different signed-in owner',async t=>{
 const {emptyProgress,meet}=await import('../../hangul-stage/core.mjs'),f=fixture();t.after(()=>f.account.stop());await f.client.restore();
 const port=await f.account.prepareHangulProgress({storage:f.cache,target:{}});
 const raw=JSON.stringify(meet(emptyProgress(),['v-a'],'2026-10-20T00:00:00Z'));
 assert.equal(await port.importSnapshot(raw),'moved');assert.equal(f.states.get(A).state.records['synk.hangul-stage.v1'],raw);
 assert.equal(f.calls.some(call=>/learning|memory/i.test(call.operation)),false);
 f.emit(signed(B,2));assert.throws(()=>port.read(),{code:'ACCOUNT_CHANGED'});
 await new Promise(resolve=>setImmediate(resolve));await f.client.restore();const other=await f.account.prepareHangulProgress({storage:f.cache,target:{}});
 assert.equal(other.read(),null);
});

test('native refresh of the same session retains ports; stale generations cannot replace it',async t=>{
 const f=fixture();t.after(()=>f.account.stop());await f.client.restore();
 const target={},handle=await f.account.prepareGame({storage:f.cache,target}),play=target.SYNKPlayHost;
 f.emit({...signed(),status:'restoring',signedIn:false});
 f.emit(signed());assert.equal(f.client.snapshot.accountId,A);assert.equal(target.SYNKPlayHost,play);assert.equal(handle.status().disposed,false);
 f.emit(signed(B,0));assert.equal(f.client.snapshot.accountId,A);assert.equal(f.connected(),0);
});

test('native logout fences delayed WORLD results and old status snapshots; later sign-in reconnects',async t=>{
 const held=deferred();let hold=false;
 const f=fixture({request:async(operation)=>operation==='worldRequest'&&hold?held.promise:undefined});t.after(()=>f.account.stop());await f.client.restore();
 hold=true;const request=f.client.refresh();await new Promise(resolve=>setImmediate(resolve));
 await f.client.logout();held.resolve(snapshot(A));await assert.rejects(request,{code:'STALE_RESPONSE'});
 assert.equal(f.client.snapshot,null);f.emit(signed(A,1));assert.equal(f.account.identity().accountId,null);
 await f.client.signIn();assert.equal(f.calls.at(-1).operation,'signIn');
 f.emit(signed(A,3));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.connected(),1);
 hold=false;assert.equal(await f.client.restore(),true);assert.equal(f.client.snapshot.accountId,A);
});

test('native account data and WORLD responses cannot substitute another account',async t=>{
 const wrongAccount=fixture({request:operation=>operation==='load'?record(B):undefined});t.after(()=>wrongAccount.account.stop());
 await assert.rejects(wrongAccount.client.restore(),{code:'ACCOUNT_CHANGED'});assert.equal(wrongAccount.client.snapshot,null);
 const wrongWorld=fixture({request:operation=>operation==='worldRequest'?snapshot(B):undefined});t.after(()=>wrongWorld.account.stop());
 await assert.rejects(wrongWorld.client.restore(),{code:'ACCOUNT_MISMATCH'});assert.equal(wrongWorld.client.snapshot,null);
});

test('a delayed authStatus cannot overwrite a newer native auth event',async t=>{
 const held=deferred();let delay=false;
 const f=fixture({status:source=>delay?held.promise:source});t.after(()=>f.account.stop());await f.client.restore();
 delay=true;const restoring=f.client.restore();await new Promise(resolve=>setImmediate(resolve));
 f.emit(signed(B,2));held.resolve(signed(A,1));
 assert.equal(await restoring,true);assert.equal(f.client.snapshot.accountId,B);
});

test('a delayed verified load cannot restore the previous native owner',async t=>{
 const held=deferred();let delay=false;
 const f=fixture({request:operation=>operation==='load'&&delay?held.promise:undefined});t.after(()=>f.account.stop());await f.client.restore();
 delay=true;const restoring=f.client.restore();await new Promise(resolve=>setImmediate(resolve));
 f.emit(signed(B,2));held.resolve(record(A));await assert.rejects(restoring,{code:'ACCOUNT_CHANGED'});
 assert.equal(f.client.snapshot,null);delay=false;await f.client.restore();assert.equal(f.client.snapshot.accountId,B);
});

test('native revoked progress closes ports without reading or clearing browser tokens',async t=>{
 const f=fixture({request:operation=>operation==='playLoad'?{ok:false,error:{code:'SESSION_REVOKED',status:401}}:undefined});t.after(()=>f.account.stop());
 f.tab.setItem('synk.oauth.session.world','unrelated browser session');await f.client.restore();
 await assert.rejects(f.account.prepareLifeProgress({storage:f.cache,target:{}}),{code:'SESSION_REVOKED'});
 assert.equal(f.client.snapshot,null);assert.equal(f.account.identity().accountId,null);
 assert.equal(f.tab.getItem('synk.oauth.session.world'),'unrelated browser session');
});

test('native town requests retain class binding and refuse revision rollback',async t=>{
 let revision=3;
 const f=fixture({request:(operation,params)=>operation==='worldRequest'&&params.route.startsWith('town/')?{...snapshot(A),state:{revision:1},binding:{classId:A,membershipRevision:2,sharing:{enabled:true,revision}}}:undefined});t.after(()=>f.account.stop());
 await f.client.restore();await f.client.request('town/state');
 await f.client.request('town/command',{method:'POST',body:{id:'command-one',type:'DAY_MOVE',payload:{location:'cafe'},expectedRevision:1}});
 assert.equal(f.calls.at(-1).params.classId,A);assert.equal(f.calls.at(-1).params.body.type,'DAY_MOVE');
 revision=2;await assert.rejects(f.client.request('town/state'),{code:'TOWN_SNAPSHOT_CHANGED'});
});

test('native subscription is released on stop and cannot reopen a disposed WORLD',async()=>{
 const f=fixture();await f.client.restore();f.account.stop();assert.equal(f.unsubscribed(),1);
 f.emit(signed(B,2));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.connected(),0);
 await assert.rejects(f.account.restore(),{code:'ACCOUNT_CHANGED'});
});

// 「내 성향」 answers about practised topics: WORLD reads them to choose practice (world-learning-plan.mjs).
test('native WORLD reads 「내 성향」 topic answers read-only, and a refusal neither signs out nor guesses',async t=>{
 const state={version:1,reviews:[],overrides:[{id:'o1',facetId:'learning-topic:sit-travel-order',values:['interested'],note:'적은 메모',at:'2026-10-18T03:00:00.000Z'},
  {id:'o2',facetId:'learning-topic:sit-travel-shopping',values:['not-now'],note:'',at:'2026-10-18T03:00:00.000Z'},{id:'o3',facetId:'topics',values:['ai-tools'],note:'',at:'2026-10-18T03:00:00.000Z'}]};
 const reply=accountId=>({ok:true,scope:'synk-personal',resource:'member-understanding',accountId,revision:3,state});
 const f=fixture({request:operation=>operation==='understandingLoad'?reply(A):undefined});t.after(()=>f.account.stop());
 await f.client.restore();
 assert.deepEqual(await f.account.topicAnswers(),{interested:['sit-travel-order'],notNow:['sit-travel-shopping']});
 assert.deepEqual(f.calls.filter(call=>call.operation==='understandingLoad').map(call=>call.params),[{}],'a read with no parameters');
 assert.equal(f.calls.some(call=>/understanding(Save|Delete)/.test(call.operation)),false);
 const other=fixture({request:operation=>operation==='understandingLoad'?reply(B):undefined});t.after(()=>other.account.stop());
 await other.client.restore();assert.equal(await other.account.topicAnswers(),null,'another account\'s document is never used');
 const refused=fixture({request:operation=>operation==='understandingLoad'?{ok:false,error:{code:'PRODUCT_FORBIDDEN',status:403}}:undefined});t.after(()=>refused.account.stop());
 await refused.client.restore();assert.equal(await refused.account.topicAnswers(),null);
 assert.equal(refused.client.snapshot.accountId,A,'a refused read does not end the session');
 assert.equal(refused.calls.some(call=>call.operation==='signOut'),false);
});
