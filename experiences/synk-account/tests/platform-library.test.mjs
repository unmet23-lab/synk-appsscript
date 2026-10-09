import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {emptyPlatformLibrary,validatePlatformLibrary,updatePlatformLibrary,projectPlatformLibrary,PLATFORM_APP_IDS,ACTIVE_PLATFORM_APP_IDS} from '../src/platform-library-data.mjs';
import {platformLibraryAccount} from '../src/platform-library-account.mjs';
import {validatePersonalState} from '../src/personal-data.mjs';
import {createDocumentSync} from '../src/document-sync.mjs';
const require=createRequire(import.meta.url),{requestSpec}=require('../../../desktop/src/account-requests.cjs');
const make=()=>({...emptyPlatformLibrary(),consent:true});

test('favorite ordering preserves grouped legacy selections and passes the existing server state contract',()=>{
 const doc={...make(),favorites:['partners','world','pulse','teacher','messenger','care']},before=structuredClone(doc);
 const moved=updatePlatformLibrary(doc,{type:'move-favorite',id:'messenger',direction:-1});
 assert.deepEqual(projectPlatformLibrary(moved).favorites,['pulse','messenger','world','care']);
 assert.deepEqual(moved.favorites,['partners','pulse','teacher','messenger','world','care']);
 assert.deepEqual(validatePersonalState('platform-library',moved),moved);assert.deepEqual(doc,before);
 const hidden=updatePlatformLibrary({...make(),favorites:['world','pulse','care']},{type:'move-favorite',id:'world',direction:1},1,['world','care']);
 assert.deepEqual(hidden.favorites,['care','pulse','world']);
 for(const action of [{type:'move-favorite',id:'world',direction:2},{type:'move-favorite',id:'fortune',direction:1},{type:'move-favorite',id:'partners',direction:1}])assert.throws(()=>updatePlatformLibrary(doc,action));
});

test('Messenger teaching projection folds cards without rewriting teacher records or granting Messenger to teacher-only users',()=>{
 const doc={...make(),favorites:['teacher','messenger'],recent:[{id:'teacher',at:20,mode:'client'},{id:'messenger',at:10,mode:'web'}]},before=structuredClone(doc);
 const grouped=projectPlatformLibrary(doc,{appIds:['messenger','teacher']});assert.deepEqual(grouped.favorites,['messenger']);assert.deepEqual(grouped.recent,[{id:'messenger',at:20,mode:'client',entryId:'teacher'}]);assert.deepEqual(doc,before);
 const teacher=projectPlatformLibrary({...make(),favorites:['teacher'],recent:[doc.recent[0]]},{appIds:['teacher']});assert.deepEqual(teacher.favorites,['teacher']);assert.deepEqual(teacher.recent,[doc.recent[0]]);
 assert.deepEqual(updatePlatformLibrary(doc,{type:'favorite',id:'messenger'},30,['messenger','teacher']).favorites,[]);
 assert.deepEqual(updatePlatformLibrary(doc,{type:'launch',id:'teacher',mode:'client'},30,['messenger','teacher']).recent,[{id:'teacher',at:30,mode:'client'}]);
});
test('only explicit consent may carry account selections, recents and notes',()=>{
 assert.throws(()=>updatePlatformLibrary(emptyPlatformLibrary(),{type:'favorite',id:'world'}));
 const saved=updatePlatformLibrary(make(),{type:'favorite',id:'world'});assert.deepEqual(saved.favorites,['world']);
 assert.deepEqual(updatePlatformLibrary(saved,{type:'consent',value:false}),emptyPlatformLibrary());
 assert.throws(()=>validatePersonalState('platform-library',{...saved,consent:false}));
 assert.throws(()=>validatePlatformLibrary({...saved,privateMessages:[]}));
});
test('unknown app IDs, arbitrary links, duplicate records and unsafe dates are rejected',()=>{
 for(const patch of [{favorites:['admin']},{favorites:['world','world']},{recent:[{id:'world',at:Infinity,mode:'web'}]},{recent:[{id:'world',at:1,mode:'web',url:'https://other.test'}]},{notes:[{id:'x',appId:'world',title:'a',createdAt:1,done:false,body:'private'}]}])assert.throws(()=>validatePlatformLibrary({...make(),...patch}));
});

test('merged catalogue keeps historical Partners records valid and projects duplicate shortcuts without changing storage',()=>{
 const doc={...make(),favorites:['pulse','partners','world'],recent:[{id:'pulse',at:10,mode:'web'},{id:'partners',at:20,mode:'client'}],notes:[{id:'legacy',appId:'partners',title:'이전 검토',createdAt:1,done:true}]},before=structuredClone(doc);
 assert.equal(PLATFORM_APP_IDS.length,10);assert.equal(ACTIVE_PLATFORM_APP_IDS.length,9);assert.equal(ACTIVE_PLATFORM_APP_IDS.includes('partners'),false);
 assert.deepEqual(validatePersonalState('platform-library',doc),doc);
 const visible=projectPlatformLibrary(doc);assert.deepEqual(visible.favorites,['pulse','world']);assert.deepEqual(visible.recent,[{id:'pulse',at:20,mode:'client'}]);assert.deepEqual(visible.notes,doc.notes);assert.deepEqual(doc,before);
});

test('only an existing Partners note may retain the retired identifier during an explicit edit',()=>{
 const note={id:'legacy',appId:'partners',title:'이전 검토',createdAt:1,done:true},doc={...make(),notes:[note]};
 const edited=updatePlatformLibrary(doc,{type:'edit-note',noteId:'legacy',id:'partners',title:'수정한 검토'});
 assert.deepEqual(edited.notes,[{...note,title:'수정한 검토'}]);assert.deepEqual(doc.notes,[note]);
 for(const type of ['note','favorite','launch'])assert.throws(()=>updatePlatformLibrary(doc,{type,id:'partners',title:'새 기록',mode:'web'}));
 assert.throws(()=>updatePlatformLibrary({...make(),notes:[{...note,appId:'world'}]},{type:'edit-note',noteId:'legacy',id:'partners',title:'수정'}));
 assert.equal(updatePlatformLibrary(doc,{type:'edit-note',noteId:'legacy',id:'pulse',title:'옮긴 검토'}).notes[0].appId,'pulse');
});

test('explicit PULSE shortcut actions fold historical duplicate selections while retaining notes',()=>{
 const note={id:'legacy',appId:'partners',title:'이전 검토',createdAt:1,done:false},doc={...make(),favorites:['partners','pulse','world'],recent:[{id:'partners',at:1,mode:'web'},{id:'pulse',at:2,mode:'client'}],notes:[note]};
 assert.deepEqual(updatePlatformLibrary(doc,{type:'favorite',id:'pulse'}).favorites,['world']);
 const launched=updatePlatformLibrary(doc,{type:'launch',id:'pulse',mode:'web'},3);assert.deepEqual(launched.recent,[{id:'pulse',at:3,mode:'web'}]);assert.deepEqual(launched.notes,[note]);
});
test('disabled recent capture clears history and later launches cannot restore it',()=>{
 let doc=updatePlatformLibrary(make(),{type:'launch',id:'world',mode:'client'},100);
 doc=updatePlatformLibrary(doc,{type:'remember',value:false});doc=updatePlatformLibrary(doc,{type:'launch',id:'world',mode:'web'},101);assert.deepEqual(doc.recent,[]);
});
test('web and PC fixed requests target only platform-library with platform credentials',()=>{
 const doc=make();assert.equal(requestSpec('platformLoad',{},'0.4.0','platform','platform').path,'synk-personal?resource=platform-library');
 assert.equal(requestSpec('platformSave',{state:doc,expected_revision:2},'0.4.0','platform','platform').body.resource,'platform-library');
 for(const [product,key] of [['world','world'],['platform','care'],['platform','rehearsal']])assert.throws(()=>requestSpec('platformLoad',{},'0.4.0',product,key));
 assert.throws(()=>requestSpec('platformDelete',{expected_revision:1,resource:'family-album'},'0.4.0','platform','platform'));
});
const identity=id=>({configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:id},sessionGeneration:1});
const webIdentity=(status,sessionGeneration=1)=>({configured:true,signedIn:status==='signed-in',status,accountId:status==='signed-in'?'A':null,sessionGeneration,...(status==='error'?{error:{retryable:true}}:{})});
function webAccountFixture(initial){
 let current=initial,notify,refreshes=0,logins=0,nextRefresh=async()=>{};
 const host={subscribe:fn=>(notify=fn,()=>{notify=null;}),identity:()=>({...current}),refresh:async()=>{refreshes++;await nextRefresh();return {...current};}};
 const emit=value=>{current=value;notify?.({...current});};
 const account=platformLibraryAccount({host,onLogin:()=>logins++});
 return {account,emit,retry:fn=>{nextRefresh=fn;},refreshes:()=>refreshes,logins:()=>logins};
}

test('web account retry refreshes a temporary auth failure and recovers without opening login',async()=>{
 const f=webAccountFixture(webIdentity('error'));await f.account.start();
 f.retry(async()=>{f.emit(webIdentity('restoring',2));f.emit(webIdentity('signed-in',2));});
 const result=await f.account.signIn();
 assert.equal(f.refreshes(),2);assert.equal(f.logins(),0);assert.equal(result.accountId,'A');assert.equal(result.status,'signed-in');assert.equal(f.account.status().signedIn,true);f.account.dispose();
});

test('web account retry leaves a continuing auth failure available without opening login',async()=>{
 const f=webAccountFixture(webIdentity('error'));await f.account.start();
 f.retry(async()=>{f.emit(webIdentity('restoring',2));f.emit(webIdentity('error',2));});
 const result=await f.account.signIn();
 assert.equal(f.refreshes(),2);assert.equal(f.logins(),0);assert.equal(result.status,'error');assert.equal(result.error.retryable,true);assert.equal(result.accountId,null);f.account.dispose();
});

test('web retry confirms signed-out first and only the next explicit login action navigates',async()=>{
 const f=webAccountFixture(webIdentity('error'));await f.account.start();
 f.retry(async()=>f.emit(webIdentity('signed-out',2)));
 assert.equal((await f.account.signIn()).status,'signed-out');assert.equal(f.refreshes(),2);assert.equal(f.logins(),0);
 await f.account.signIn();assert.equal(f.logins(),1);assert.equal(f.refreshes(),2);f.account.dispose();
});

test('web signed-out login keeps its explicit navigation while uncertain sessions refresh',async()=>{
 const signedOut=webAccountFixture(webIdentity('signed-out'));await signedOut.account.start();await signedOut.account.signIn();
 assert.equal(signedOut.logins(),1);assert.equal(signedOut.refreshes(),1);signedOut.account.dispose();
 for(const status of ['restoring','unconfigured']){
  const f=webAccountFixture(webIdentity(status));await f.account.start();await f.account.signIn();
  assert.equal(f.logins(),0,status);assert.equal(f.refreshes(),2,status);f.account.dispose();
 }
});

test('late native login completion cannot replace a newer account and sign-out preserves revocation failure',async()=>{
 let notify,finish;let current=identity('A');const host={onAuthChanged:fn=>(notify=fn,()=>{}),authStatus:async()=>current,authSignIn:()=>new Promise(resolve=>finish=resolve),authSignOut:async()=>{current={...identity('A'),signedIn:false,status:'signed-out',account:null,sessionGeneration:3};notify(current);return {ok:false,serverRevoked:false};}};
 const account=platformLibraryAccount({native:true,host});await account.start();const pending=account.signIn();current={...identity('B'),sessionGeneration:2};notify(current);finish(identity('A'));await pending;assert.equal(account.status().accountId,'B');
 const result=await account.signOut();assert.equal(result.accountId,null);assert.equal(result.ok,false);assert.equal(result.serverRevoked,false);account.dispose();
});
test('native initial auth reply cannot replace a newer account notification',async()=>{
 let notify,finish;const states=[];
 const account=platformLibraryAccount({native:true,onStatus:s=>states.push(s),host:{onAuthChanged:fn=>(notify=fn,()=>{}),authStatus:()=>new Promise(resolve=>finish=resolve)}});
 const pending=account.start();notify(identity('B'));finish(identity('A'));await pending;assert.equal(account.status().accountId,'B');account.dispose();
});
test('a save response from a previous account is rejected and conflict revision survives native errors',async()=>{
 let notify,finish;const host={onAuthChanged:fn=>(notify=fn,()=>{}),authStatus:async()=>identity('A'),accountRequest:()=>new Promise(resolve=>finish=resolve)};
 const account=platformLibraryAccount({native:true,host});await account.start();const pending=account.request('personalSave',{state:make(),expected_revision:0});notify(identity('B'));finish({ok:true});await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});
 host.accountRequest=async()=>({ok:false,error:{code:'REVISION_CONFLICT'},revision:4});await assert.rejects(account.request('personalSave',{}),{code:'REVISION_CONFLICT',revision:4});account.dispose();
});
test('two verified sessions use CAS and preserve an unsent document until explicit conflict choice',async()=>{
 const records=new Map();const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i],get length(){return data.size;}};};
 function session(){let status,state;const sync=createDocumentSync({storage:storage(),scope:'synk-personal',resource:'platform-library',cachePrefix:'qa.platform.',operations:{load:'load',save:'save',delete:'delete'},emptyState:emptyPlatformLibrary,validateState:validatePlatformLibrary,onStatus:s=>status=s,onState:s=>state=s,transport:async(op,p)=>{let row=records.get('A')||{revision:0,state:null};if(op==='save'){if(row.revision!==p.expected_revision)throw Object.assign(new Error('conflict'),{code:'REVISION_CONFLICT',revision:row.revision});row={revision:row.revision+1,state:structuredClone(p.state)};records.set('A',row);}return {ok:true,scope:'synk-personal',resource:'platform-library',accountId:'A',updatedAt:null,...row};}});return {sync,status:()=>status,state:()=>state};}
 const a=session(),b=session();await a.sync.open('A');await b.sync.open('A');a.sync.change(updatePlatformLibrary(make(),{type:'favorite',id:'world'}));await a.sync.flush();b.sync.change(updatePlatformLibrary(make(),{type:'favorite',id:'care'}));await b.sync.flush();assert.equal(b.status().status,'conflict');assert.deepEqual(records.get('A').state.favorites,['world']);await b.sync.resolveLocal();assert.deepEqual(records.get('A').state.favorites,['care']);a.sync.close();b.sync.close();
});

function nativeRetryAccountFixture(initial={configured:true,status:'error',signedIn:false,sessionGeneration:2,error:{code:'AUTH_SERVER_UNAVAILABLE',retryable:true}}){
 let current=initial,notify,loads=0,oauth=0,statusReads=0,onLoad=async()=>({ok:true}),onStatus=async()=>current;
 const host={onAuthChanged:fn=>(notify=fn,()=>{notify=null;}),authStatus:async()=>{statusReads++;return onStatus();},authSignIn:async()=>{oauth++;return {ok:true};},
  authSignOut:async()=>{current={configured:true,status:'signed-out',signedIn:false,sessionGeneration:4};notify?.(current);return {ok:true,serverRevoked:true};},
  accountRequest:async(operation,params)=>{assert.equal(operation,'load');assert.deepEqual(params,{});loads++;return onLoad();}};
 const account=platformLibraryAccount({native:true,host});
 return {account,host,emit:value=>{current=value;notify?.(value);},set:value=>{current=value;},load:fn=>{onLoad=fn;},status:fn=>{onStatus=fn;},counts:()=>({loads,oauth,statusReads})};
}
test('native library retry verifies saved identity through load then authStatus without fresh OAuth',async()=>{
 const f=nativeRetryAccountFixture();await f.account.start();f.load(async()=>{f.set({...identity('A'),sessionGeneration:3});return {ok:true};});
 const result=await f.account.signIn();assert.equal(result.accountId,'A');assert.deepEqual(f.counts(),{loads:1,oauth:0,statusReads:2});f.account.dispose();
});
test('native library continuing retryable error never escalates to OAuth',async()=>{
 const f=nativeRetryAccountFixture();await f.account.start();f.load(async()=>({ok:false,error:{code:'AUTH_SERVER_UNAVAILABLE',retryable:true}}));
 const result=await f.account.signIn();assert.equal(result.ok,false);assert.equal(result.signedIn,false);assert.equal(result.error.retryable,true);assert.deepEqual(f.counts(),{loads:1,oauth:0,statusReads:2});f.account.dispose();
});
test('native library repeated pending verification makes only one preserving request',async()=>{
 let finish;const f=nativeRetryAccountFixture();await f.account.start();f.load(()=>new Promise(resolve=>finish=resolve));
 const first=f.account.signIn(),second=f.account.signIn();assert.equal(f.counts().loads,1);assert.equal(f.counts().oauth,0);finish({ok:false});await Promise.all([first,second]);assert.equal(f.counts().statusReads,2);f.account.dispose();
});
test('native library late authStatus after a preserving retry cannot replace a newer owner',async()=>{
 let finishStatus,began;const begun=new Promise(resolve=>began=resolve),f=nativeRetryAccountFixture();await f.account.start();f.status(()=>{began();return new Promise(resolve=>finishStatus=resolve);});
 const retry=f.account.signIn();await begun;f.emit({...identity('B'),sessionGeneration:4});finishStatus({...identity('A'),sessionGeneration:3});await retry;
 assert.equal(f.account.status().accountId,'B');assert.equal(f.counts().loads,1);assert.equal(f.counts().oauth,0);f.account.dispose();
});
test('native library logout and disposal fence a pending saved-login verification',async()=>{
 for(const action of ['signOut','dispose']){let finish;const f=nativeRetryAccountFixture();await f.account.start();f.load(()=>new Promise(resolve=>finish=resolve));const retry=f.account.signIn();assert.equal(f.counts().loads,1);
  await f.account[action]();finish({ok:true});await retry;assert.equal(f.account.status().accountId,null);assert.equal(f.counts().statusReads,1);assert.equal(f.counts().oauth,0);f.account.dispose();}
});
test('native library ordinary explicit signed-out login still invokes fresh OAuth',async()=>{
 const f=nativeRetryAccountFixture({configured:true,status:'signed-out',signedIn:false,sessionGeneration:2});await f.account.start();await f.account.signIn();assert.deepEqual(f.counts(),{loads:0,oauth:1,statusReads:2});f.account.dispose();
});
