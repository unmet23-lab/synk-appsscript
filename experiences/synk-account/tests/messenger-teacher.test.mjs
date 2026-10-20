import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserTeacherBridge} from '../src/messenger-teacher.mjs';
const response=body=>({ok:true,status:200,json:async()=>body});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
function fixture(t,fetcher){const listeners=new Map(),calls=[];const bridge=createBrowserTeacherBridge({fetcher:async(...args)=>{calls.push(args);return fetcher(...args);},pollMs:100000,windowObject:{document:{hidden:false},addEventListener:(key,value)=>listeners.set(key,value),removeEventListener:key=>listeners.delete(key)}});t.after(()=>bridge.dispose());return {bridge,calls};}
test('browser teacher sends CSRF only to fixed classroom routes and exposes no credentials',async t=>{
  const p=fixture(t,url=>response(url.endsWith('status')?{configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},sessionGeneration:10,csrfToken:'csrf-only'}:{ok:true,mode:'account-linked',classes:[]}));
  const auth=await p.bridge.authStatus();assert.equal(Object.hasOwn(auth,'csrfToken'),false);assert.equal(Object.hasOwn(auth,'access_token'),false);
  assert.equal((await p.bridge.accountRequest('classroom',{operation:'classes'})).ok,true);
  assert.equal(p.calls.at(-1)[0],'/api/teaching/request');assert.equal(p.calls.at(-1)[1].headers['X-CSRF-Token'],'csrf-only');
  const count=p.calls.length;assert.equal((await p.bridge.accountRequest('classroom',{operation:'learningGet',classId:'a'})).error.code,'INVALID_REQUEST');assert.equal((await p.bridge.accountRequest('load')).ok,false);assert.equal(p.calls.length,count);
});

test('teacher browser overview and care requests keep the fixed BFF while learner Town commands stay forbidden',async t=>{
  const p=fixture(t,url=>response(url.endsWith('status')?{configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},sessionGeneration:1,csrfToken:'csrf'}:{ok:true}));
  for(const operation of ['teacherOverview','care','careSave','homework','homeworkSave'])assert.equal((await p.bridge.accountRequest('classroom',{operation,...(operation==='teacherOverview'?{}:{classId:'a'})})).ok,true);
  const before=p.calls.length;for(const operation of ['townMembership','townSharing','townActivity','student','memoryGet'])assert.equal((await p.bridge.accountRequest('classroom',{operation,classId:'a'})).error.code,'INVALID_REQUEST');assert.equal(p.calls.length,before);
});
test('a pre-logout status reply cannot restore an old teacher or replace the final status',async t=>{
  const held=deferred();let reads=0;const p=fixture(t,url=>{if(!url.endsWith('status'))return response({ok:true,serverRevoked:true});reads++;if(reads===2)return held.promise;return response(reads===1?{configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},csrfToken:'csrf',sessionGeneration:1}:{configured:true,signedIn:false,status:'signed-out',csrfToken:'new-csrf'});});
  await p.bridge.authStatus();const delivered=[];p.bridge.onAuthChanged(auth=>delivered.push(auth));const old=p.bridge.authStatus();await p.bridge.authSignOut();held.resolve(response({configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},csrfToken:'old-csrf',sessionGeneration:1}));
  assert.equal((await old).signedIn,false);assert.equal(delivered.at(-1).signedIn,false);assert.equal(delivered.some(auth=>auth.signedIn),false);
});
test('disposing the browser host ignores its delayed initial status and removes subscriptions',async t=>{
  const held=deferred(),p=fixture(t,()=>held.promise),delivered=[];p.bridge.onAuthChanged(auth=>delivered.push(auth));const pending=p.bridge.authStatus();p.bridge.dispose();held.resolve(response({configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},csrfToken:'csrf'}));assert.equal((await pending).signedIn,false);assert.equal(delivered.length,0);
});

test('browser teacher may issue an invite only through fixed classroom BFF',async t=>{
 const p=fixture(t,url=>response(url.endsWith('status')?{configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},sessionGeneration:10,csrfToken:'fixture'}:{ok:true,invite:{token:'a'.repeat(32)}}));
 await p.bridge.authStatus();const result=await p.bridge.accountRequest('classroom',{operation:'enrollmentInvite',classId:'class-a',body:{learnerId:'student-a'}});assert.equal(result.ok,true);assert.equal(p.calls.at(-1)[0],'/api/teaching/request');
 const before=p.calls.length;assert.equal((await p.bridge.accountRequest('classroom',{operation:'enrollmentClaim',body:{token:'fixture',confirm:true}})).error.code,'INVALID_REQUEST');assert.equal(p.calls.length,before);
});

test('restoring the same server session retains its owner generation and logout access',async t=>{
 let state={configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},sessionGeneration:10,csrfToken:'csrf'};
 const p=fixture(t,()=>response(state));const initial=await p.bridge.authStatus();
 state={...state,signedIn:false,status:'restoring',canSignOut:true,error:{code:'ACCOUNT_VERIFY_UNAVAILABLE',retryable:true}};
 const restoring=await p.bridge.authStatus();assert.equal(restoring.signedIn,false);assert.equal(restoring.sessionGeneration,initial.sessionGeneration);assert.equal(restoring.account.synk_user_id,'teacher-a');assert.equal(restoring.canSignOut,true);
 state={...state,signedIn:true,status:'signed-in',error:undefined};assert.equal((await p.bridge.authStatus()).sessionGeneration,initial.sessionGeneration);
 state={...state,signedIn:false,status:'signed-out',account:null};assert.notEqual((await p.bridge.authStatus()).sessionGeneration,initial.sessionGeneration);
});

test('a temporary network failure suspends authorization without changing the verified session',async t=>{
 let offline=false;const p=fixture(t,()=>{if(offline)throw new TypeError('offline');return response({configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},sessionGeneration:42,csrfToken:'csrf'});});
 const initial=await p.bridge.authStatus();offline=true;const waiting=await p.bridge.authStatus();assert.equal(waiting.status,'restoring');assert.equal(waiting.signedIn,false);assert.equal(waiting.canSignOut,true);assert.equal(waiting.sessionGeneration,initial.sessionGeneration);
 offline=false;assert.equal((await p.bridge.authStatus()).sessionGeneration,initial.sessionGeneration);
});

test('confirmed local logout does not resurrect cached identity when the following status fails',async t=>{
 let loggedOut=false;const p=fixture(t,url=>{if(url.endsWith('/logout')){loggedOut=true;return response({ok:true,serverRevoked:false});}if(loggedOut)throw new TypeError('offline');return response({configured:true,signedIn:true,account:{synk_user_id:'teacher-a'},sessionGeneration:42,csrfToken:'csrf'});});
 await p.bridge.authStatus();const received=[];p.bridge.onAuthChanged(s=>received.push(s));await assert.rejects(p.bridge.authSignOut(),/offline/);assert.equal(received.at(-1).signedIn,false);assert.equal(received.at(-1).account,null);assert.equal(received.some(s=>s.status==='restoring'),false);
});
