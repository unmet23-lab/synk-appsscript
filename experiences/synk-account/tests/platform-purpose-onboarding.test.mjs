import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformAccount} from '../src/platform-account.mjs';
const key='synk.oauth.session.platform';
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
function setup({purpose='pending',completion}={}){
 const values=new Map([[key,JSON.stringify({access_token:'synthetic-a',refresh_token:'refresh-a'})]]),calls=[],clients=[];
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const account=createPlatformAccount({config:{configured:true,clients:{platform:{clientId:'synthetic-client',redirectUri:'https://synthetic.invalid/platform'}},accountApiUrl:'https://synthetic.invalid',supabasePublishableKey:'synthetic-key'},storage,
  requestToken:async()=>assert.fail('unexpected token renewal'),fetcher:async()=>assert.fail('unexpected network'),
  accountFactory:options=>{
   clients.push(options);
   return {
    load:async()=>{options.guard?.();const token=await options.getAccessToken();return {ok:true,account:{synk_user_id:token,profile:{display_name:'합성 계정'}},...(purpose?{onboarding:{purpose}}:{})};},
    completePurposeOnboarding:async(outcome,requestOptions)=>{options.guard?.();const token=await options.getAccessToken();calls.push({outcome,token,requestOptions,client:options});if(completion)await completion({outcome,token,requestOptions,client:options});return {ok:true,onboarding:{purpose:'none'}};},
   };
  }});
 return {account,values,calls,clients,replace:id=>values.set(key,JSON.stringify({access_token:id,refresh_token:'refresh-'+id}))};
}
test('purpose question is pending only after verified load and missing server field is none',async()=>{
 for(const purpose of ['pending','none',undefined]){const f=setup({purpose:purpose===undefined?null:purpose});assert.equal(f.account.identity().signedIn,false);await f.account.refresh();assert.equal(f.account.identity().onboarding.purpose,purpose||'none');assert.equal(f.account.identity().accountKey,'synthetic-a');f.account.stop();}
});
test('ordinary refresh preserves verified owner and does not abort completion transport',async()=>{
 const wait=deferred(),f=setup({completion:()=>wait.promise});await f.account.refresh();
 const finish=f.account.completePurposeOnboarding('chosen',{accountId:'synthetic-a'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,1);
 f.account.invalidate();assert.equal(f.account.identity().accountKey,'synthetic-a');await f.account.refresh();
 assert.equal(f.calls[0].requestOptions.signal,undefined);assert.equal(f.calls[0].requestOptions.keepalive,true);
 wait.resolve();assert.equal((await finish).ok,true);assert.equal(f.account.identity().onboarding.purpose,'none');f.account.stop();
});
test('concurrent outcomes share one write and completed owner does not write again',async()=>{
 const wait=deferred(),f=setup({completion:()=>wait.promise});await f.account.refresh();
 const first=f.account.completePurposeOnboarding('chosen',{accountId:'synthetic-a'}),second=f.account.completePurposeOnboarding('skipped',{accountId:'synthetic-a'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,1);assert.equal(f.calls[0].outcome,'chosen');wait.resolve();
 assert.equal((await first).ok,true);assert.equal((await second).ok,true);assert.equal((await f.account.completePurposeOnboarding('skipped',{accountId:'synthetic-a'})).ok,true);assert.equal(f.calls.length,1);f.account.stop();
});
test('late completion for A is rejected after B replaces the tab session and never uses B token',async()=>{
 const wait=deferred(),f=setup({completion:()=>wait.promise});await f.account.refresh();
 const finish=f.account.completePurposeOnboarding('chosen',{accountId:'synthetic-a'});await new Promise(resolve=>setImmediate(resolve));
 f.replace('synthetic-b');await f.account.refresh();wait.resolve();assert.equal((await finish).code,'ACCOUNT_CHANGED');
 assert.deepEqual(f.calls.map(call=>call.token),['synthetic-a']);assert.equal(f.account.identity().accountKey,'synthetic-b');
 assert.equal((await f.account.completePurposeOnboarding('skipped',{accountId:'synthetic-a'})).code,'ACCOUNT_CHANGED');assert.equal(f.calls.length,1);f.account.stop();
});
test('logout before completion sends no request and invalid outcomes are rejected',async()=>{
 const f=setup();await f.account.refresh();f.values.delete(key);
 assert.equal((await f.account.completePurposeOnboarding('chosen',{accountId:'synthetic-a'})).code,'ACCOUNT_CHANGED');assert.equal(f.calls.length,0);
 assert.equal((await f.account.completePurposeOnboarding('invalid',{accountId:'synthetic-a'})).code,'INVALID_OUTCOME');f.account.stop();
});
test('network failure permits entry without claiming persistence or clearing verified identity',async()=>{
 const f=setup({completion:async()=>{throw Object.assign(new Error('synthetic network failure'),{code:'NETWORK_FAILED'});}});await f.account.refresh();
 const result=await f.account.completePurposeOnboarding('skipped',{accountId:'synthetic-a'});assert.equal(result.ok,true);assert.equal(result.persisted,false);assert.equal(f.account.identity().signedIn,true);f.account.stop();
});
test('confirmed auth rejection revokes the question binding',async()=>{
 const f=setup({completion:async()=>{throw Object.assign(new Error('synthetic revoked session'),{code:'SESSION_REVOKED'});}});await f.account.refresh();
 const result=await f.account.completePurposeOnboarding('chosen',{accountId:'synthetic-a'});assert.equal(result.code,'ACCOUNT_CHANGED');assert.equal(f.account.identity().signedIn,false);f.account.stop();
});

function setupRenewal({purpose='pending',initialExpired=false,onTokenRequest,onApiCall,onStatus,fetcher}={}){
 let issuedSeq=0;
 const tokens=new Map([['token-account-a-0',{accountId:'account-a',expired:initialExpired}]]);
 const refreshes=new Map([['refresh-account-a-0','account-a']]);
 const values=new Map([[key,JSON.stringify({access_token:'token-account-a-0',refresh_token:'refresh-account-a-0'})]]);
 const tokenCalls=[],apiCalls=[];
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const issueNext=refreshToken=>{
  const owner=refreshes.get(refreshToken);
  if(!owner)throw Object.assign(new Error('invalid refresh token'),{code:'AUTH_REQUIRED',status:400,retryable:false});
  const seq=++issuedSeq,nextAccess=`token-${owner}-${seq}`,nextRefresh=`refresh-${owner}-${seq}`;
  tokens.set(nextAccess,{accountId:owner,expired:false});
  refreshes.delete(refreshToken);
  refreshes.set(nextRefresh,owner);
  return {access_token:nextAccess,refresh_token:nextRefresh,expires_at:Date.now()+3600_000};
 };
 const setSession=(owner,expired=false)=>{
  const access=`token-${owner}-0`,refresh=`refresh-${owner}-0`,raw=JSON.stringify({access_token:access,refresh_token:refresh});
  tokens.set(access,{accountId:owner,expired});
  refreshes.set(refresh,owner);
  values.set(key,raw);
  return raw;
 };
 async function runWithAuth(options,action,requestOptions){
  options.guard();
  const send=async token=>{
   options.guard();
   if(!token)throw Object.assign(new Error('다시 로그인해 주세요.'),{code:'AUTH_REQUIRED',status:401});
   apiCalls.push({action,token,requestOptions});
   if(onApiCall)await onApiCall({action,token,requestOptions,options});
   const entry=tokens.get(token);
   const reply=!entry||entry.expired?{unauthorized:true}:{unauthorized:false,accountId:entry.accountId};
   options.guard();
   return reply;
  };
  const token=options.getAccessToken();
  let reply=await send(token);
  if(reply.unauthorized&&typeof options.refresh==='function'){
   const renewed=await options.refresh(token);
   options.guard();
   if(renewed)reply=await send(renewed);
  }
  if(reply.unauthorized)throw Object.assign(new Error('다시 로그인해 주세요.'),{code:'AUTH_REQUIRED',status:401});
  return reply;
 }
 const account=createPlatformAccount({
  config:{configured:true,clients:{platform:{clientId:'synthetic-client',redirectUri:'https://synthetic.invalid/platform'}},accountApiUrl:'https://synthetic.invalid',supabasePublishableKey:'synthetic-key'},
  storage,
  ...(onStatus?{onStatus}:{}),
  fetcher:fetcher||(async()=>assert.fail('unexpected network')),
  requestToken:async(_config,fields)=>{
   assert.equal(fields.grant_type,'refresh_token');
   assert.equal(fields.client_id,'synthetic-client');
   tokenCalls.push({...fields});
   return onTokenRequest?onTokenRequest(fields):issueNext(fields.refresh_token);
  },
  accountFactory:options=>({
   load:async()=>{
    const reply=await runWithAuth(options,'load');
    return {ok:true,account:{synk_user_id:reply.accountId,profile:{display_name:'합성 계정'}},...(purpose?{onboarding:{purpose}}:{})};
   },
   platformLoad:async()=>{
    const reply=await runWithAuth(options,'platformLoad');
    return {ok:true,scope:'synk-personal',resource:'platform-library',accountId:reply.accountId,revision:1,state:null};
   },
   memory:{
    get:async({revision})=>{
     const reply=await runWithAuth(options,'memoryGet',{revision});
     return {ok:true,accountId:reply.accountId,revision,entries:[]};
    },
   },
   completePurposeOnboarding:async(outcome,requestOptions)=>{
    await runWithAuth(options,'completePurposeOnboarding',{outcome,...requestOptions});
    return {ok:true,onboarding:{purpose:'none'}};
   },
  }),
 });
 return {
  account,
  values,
  tokenCalls,
  apiCalls,
  issueNext,
  setSession,
  expire:token=>{const entry=tokens.get(token);if(entry)entry.expired=true;},
 };
}

test('first verified load links binding so a later request token renewal preserves signed-in identity',async()=>{
 const f=setupRenewal();
 await f.account.refresh();
 const before=f.account.identity();
 assert.equal(before.signedIn,true);
 assert.equal(before.accountId,'account-a');
 assert.equal(before.accountGeneration,1);
 assert.equal(before.onboarding.purpose,'pending');

 f.expire('token-account-a-0');
 const loaded=await f.account.request('platformLoad');
 assert.equal(loaded.ok,true);
 assert.equal(loaded.accountId,'account-a');

 const after=f.account.identity();
 assert.equal(after.signedIn,true);
 assert.equal(after.status,'signed-in');
 assert.equal(after.accountId,'account-a');
 assert.equal(after.accountKey,'account-a');
 assert.equal(after.accountGeneration,before.accountGeneration);
 assert.equal(after.onboarding.purpose,'pending');
 assert.equal(f.account.isAccountBound('account-a'),true);
 assert.equal(f.tokenCalls.length,1);

 const done=await f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
 assert.deepEqual(done,{ok:true,persisted:true,onboarding:{purpose:'none'}});
 assert.equal(f.tokenCalls.length,1);
 assert.equal(f.account.identity().signedIn,true);
 f.account.stop();
});

test('purpose onboarding token renewal after first load syncs to authenticated account requests',async()=>{
 const f=setupRenewal();
 await f.account.refresh();
 const initialAccountGeneration=f.account.identity().accountGeneration;

 f.expire('token-account-a-0');
 const completion=await f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
 assert.deepEqual(completion,{ok:true,persisted:true,onboarding:{purpose:'none'}});
 assert.equal(f.tokenCalls.length,1);

 const library=await f.account.request('platformLoad');
 const memory=await f.account.request('memoryGet',{revision:0});
 assert.equal(library.ok,true);
 assert.equal(memory.ok,true);
 assert.equal(f.tokenCalls.length,1);
 assert.deepEqual(f.apiCalls.filter(c=>c.action==='platformLoad').map(c=>c.token),['token-account-a-1']);
 assert.equal(f.account.identity().signedIn,true);
 assert.equal(f.account.identity().accountId,'account-a');
 assert.equal(f.account.identity().accountGeneration,initialAccountGeneration);
 f.account.stop();
});

test('concurrent request and onboarding renewals after first load share one token request',async()=>{
 {
  const gate=deferred();
  const f=setupRenewal({onTokenRequest:async fields=>{await gate.promise;return f.issueNext(fields.refresh_token);}});
  await f.account.refresh();
  f.expire('token-account-a-0');

  const pendingRequest=f.account.request('platformLoad');
  const pendingOnboarding=f.account.completePurposeOnboarding('skipped',{accountId:'account-a'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.tokenCalls.length,1);

  gate.resolve();
  const [requestResult,onboardingResult]=await Promise.all([pendingRequest,pendingOnboarding]);
  assert.equal(requestResult.ok,true);
  assert.deepEqual(onboardingResult,{ok:true,persisted:true,onboarding:{purpose:'none'}});
  assert.equal(f.tokenCalls.length,1);
  assert.equal(f.account.identity().signedIn,true);
  assert.equal(f.account.identity().accountGeneration,1);
  f.account.stop();
 }
 {
  const holdOnboarding=deferred();
  const f=setupRenewal({onApiCall:async({action,token})=>{if(action==='completePurposeOnboarding'&&token==='token-account-a-0')await holdOnboarding.promise;}});
  await f.account.refresh();
  f.expire('token-account-a-0');

  const pendingOnboarding=f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
  await new Promise(resolve=>setImmediate(resolve));

  const requestResult=await f.account.request('platformLoad');
  assert.equal(requestResult.ok,true);
  assert.equal(f.tokenCalls.length,1);

  holdOnboarding.resolve();
  const onboardingResult=await pendingOnboarding;
  assert.deepEqual(onboardingResult,{ok:true,persisted:true,onboarding:{purpose:'none'}});
  assert.equal(f.tokenCalls.length,1);
  assert.equal(f.account.identity().signedIn,true);
  f.account.stop();
 }
});

test('external account replacement or logout during token renewal rejects late replies',async()=>{
 {
  const gate=deferred();
  const f=setupRenewal({
   onTokenRequest:async fields=>{
    if(fields.refresh_token==='refresh-account-a-0'){
     await gate.promise;
     return {access_token:'late-token-a',refresh_token:'late-refresh-a',expires_at:Date.now()+3600_000};
    }
    return f.issueNext(fields.refresh_token);
   },
  });
  await f.account.refresh();
  f.expire('token-account-a-0');

  const pendingRequest=f.account.request('platformLoad');
  const pendingOnboarding=f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.tokenCalls.length,1);

  const rawB=f.setSession('account-b');
  await f.account.refresh();
  assert.equal(f.account.identity().accountId,'account-b');

  gate.resolve();
  await assert.rejects(pendingRequest,{code:'ACCOUNT_CHANGED'});
  assert.equal((await pendingOnboarding).code,'ACCOUNT_CHANGED');
  assert.equal(f.values.get(key),rawB);
  assert.equal(f.apiCalls.some(c=>c.token==='late-token-a'),false);
  assert.equal(f.account.identity().signedIn,true);
  assert.equal(f.account.identity().accountId,'account-b');
  f.account.stop();
 }
 {
  const gate=deferred();
  const f=setupRenewal({
   onTokenRequest:async()=>{
    await gate.promise;
    return {access_token:'late-token-a',refresh_token:'late-refresh-a',expires_at:Date.now()+3600_000};
   },
  });
  await f.account.refresh();
  f.expire('token-account-a-0');

  const pendingRequest=f.account.request('platformLoad');
  const pendingOnboarding=f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
  await new Promise(resolve=>setImmediate(resolve));

  const rawB=f.setSession('account-b');
  gate.resolve();
  await assert.rejects(pendingRequest,{code:'ACCOUNT_CHANGED'});
  assert.equal((await pendingOnboarding).code,'ACCOUNT_CHANGED');
  assert.equal(f.values.get(key),rawB);
  assert.equal(f.apiCalls.some(c=>c.token==='late-token-a'),false);
  assert.equal(f.account.identity().signedIn,false);
  f.account.stop();
 }
 {
  const gate=deferred();
  const f=setupRenewal({
   onTokenRequest:async()=>{
    await gate.promise;
    return {access_token:'late-token-a',refresh_token:'late-refresh-a',expires_at:Date.now()+3600_000};
   },
  });
  await f.account.refresh();
  f.expire('token-account-a-0');

  const pendingRequest=f.account.request('platformLoad');
  const pendingOnboarding=f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
  await new Promise(resolve=>setImmediate(resolve));

  f.values.delete(key);
  gate.resolve();
  await assert.rejects(pendingRequest,{code:'ACCOUNT_CHANGED'});
  assert.equal((await pendingOnboarding).code,'ACCOUNT_CHANGED');
  assert.equal(f.values.get(key),undefined);
  assert.equal(f.apiCalls.some(c=>c.token==='late-token-a'),false);
  assert.equal(f.account.identity().signedIn,false);
  assert.equal(f.account.identity().status,'signed-out');
  f.account.stop();
 }
});

test('unverified token renewal during initial load preserves guards and binds the verified session',async()=>{
 {
  const gate=deferred();
  const f=setupRenewal({
   initialExpired:true,
   onTokenRequest:async fields=>{
    if(fields.refresh_token==='refresh-account-a-0')await gate.promise;
    return f.issueNext(fields.refresh_token);
   },
  });
  const firstLoad=f.account.refresh();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.account.identity().signedIn,false);
  assert.equal(f.account.identity().accountKey,null);

  gate.resolve();
  await firstLoad;
  assert.equal(f.account.identity().signedIn,true);
  assert.equal(f.account.identity().accountId,'account-a');
  assert.equal(f.account.identity().accountGeneration,1);

  f.expire('token-account-a-1');
  const loaded=await f.account.request('platformLoad');
  assert.equal(loaded.ok,true);
  assert.equal(f.account.identity().signedIn,true);
  assert.equal(f.account.identity().accountGeneration,1);
  assert.equal(f.tokenCalls.length,2);
  f.account.stop();
 }
 {
  const gate=deferred();
  const f=setupRenewal({
   initialExpired:true,
   onTokenRequest:async()=>{
    await gate.promise;
    return {access_token:'late-initial-a',refresh_token:'late-refresh-a',expires_at:Date.now()+3600_000};
   },
  });
  const firstLoad=f.account.refresh();
  await new Promise(resolve=>setImmediate(resolve));
  f.values.delete(key);
  gate.resolve();
  await firstLoad;
  assert.equal(f.values.get(key),undefined);
  assert.equal(f.account.identity().signedIn,false);
  assert.equal(f.account.identity().status,'signed-out');
  f.account.stop();
 }
});

test('auth revocation during in-flight refresh fences late load without restarting or reviving signed-in state',async()=>{
 for(const revokeViaRenewal of [false,true]){
  const loadGate=deferred();
  const statusEvents=[],identityEvents=[];
  let loadCount=0;
  const f=setupRenewal({
   onStatus:s=>statusEvents.push(s.status),
   onApiCall:async({action})=>{
    if(action==='load'&&++loadCount>1)await loadGate.promise;
    if(action==='completePurposeOnboarding'&&!revokeViaRenewal){
     throw Object.assign(new Error('synthetic revoked session'),{code:'SESSION_REVOKED'});
    }
   },
   onTokenRequest:async()=>{
    throw Object.assign(new Error('synthetic revoked refresh'),{code:'SESSION_REVOKED'});
   },
  });
  f.account.subscribe(snapshot=>identityEvents.push({
   status:snapshot.status,
   signedIn:snapshot.signedIn,
   generation:snapshot.sessionGeneration,
  }));

  await f.account.refresh();
  const pendingRefresh=f.account.refresh();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(loadCount,2);

  if(revokeViaRenewal)f.expire('token-account-a-0');
  const completion=await f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
  assert.deepEqual(completion,{
   ok:false,
   code:'ACCOUNT_CHANGED',
   message:'로그인이 끝났어요. 다시 로그인해 주세요.',
  });
  assert.equal(f.account.status().status,'signed-out');
  assert.equal(f.account.identity().signedIn,false);
  assert.equal(f.account.identity().status,'signed-out');
  assert.equal(f.account.identity().accountKey,null);
  assert.equal(identityEvents.at(-1)?.status,'signed-out');
  assert.equal(identityEvents.at(-1)?.signedIn,false);

  const eventsCountBeforeLateReply=identityEvents.length;
  loadGate.resolve();
  const lateStatus=await pendingRefresh;
  assert.equal(lateStatus.status,'signed-out');
  assert.equal(loadCount,2);
  assert.equal(f.account.status().status,'signed-out');
  assert.equal(f.account.identity().signedIn,false);
  assert.equal(f.account.identity().status,'signed-out');
  assert.equal(identityEvents.length,eventsCountBeforeLateReply);
  assert.equal(statusEvents.at(-1),'signed-out');
  f.account.stop();
 }
 {
  const onboardingGate=deferred();
  const events=[];
  let loadCount=0;
  const f=setupRenewal({
   onApiCall:async({action})=>{
    if(action==='load'&&++loadCount>1){
     throw Object.assign(new Error('synthetic load revoked'),{code:'SESSION_REVOKED'});
    }
    if(action==='completePurposeOnboarding')await onboardingGate.promise;
   },
  });
  f.account.subscribe(snapshot=>events.push({status:snapshot.status,signedIn:snapshot.signedIn}));
  await f.account.refresh();

  const pendingOnboarding=f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
  await new Promise(resolve=>setImmediate(resolve));

  const revokedStatus=await f.account.refresh();
  assert.equal(revokedStatus.status,'signed-out');
  assert.equal(f.account.status().status,'signed-out');
  assert.equal(f.account.identity().signedIn,false);
  assert.equal(events.at(-1)?.status,'signed-out');

  onboardingGate.resolve();
  assert.equal((await pendingOnboarding).code,'ACCOUNT_CHANGED');
  assert.equal(f.account.status().status,'signed-out');
  assert.equal(f.account.identity().signedIn,false);
  f.account.stop();
 }
});

test('auth revocation during ordinary request notifies subscribers, aligns status and identity, and blocks concurrent or subsequent requests',async()=>{
 {
  const requestGate=deferred();
  const events=[];
  let capturedSignal=null;
  const f=setupRenewal({
   fetcher:async(_url,init)=>{capturedSignal=init?.signal||null;return {ok:true};},
   onApiCall:async({action,options})=>{
    if(action==='platformLoad'){
     await options.fetch('https://synthetic.invalid/probe',{});
     await requestGate.promise;
    }
    if(action==='completePurposeOnboarding'){
     throw Object.assign(new Error('synthetic missing session'),{code:'AUTH_SESSION_MISSING'});
    }
   },
  });
  f.account.subscribe(snapshot=>events.push({status:snapshot.status,signedIn:snapshot.signedIn,generation:snapshot.sessionGeneration}));
  await f.account.refresh();

  const pendingRequest=f.account.request('platformLoad');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(capturedSignal?.aborted,false);

  const completion=await f.account.completePurposeOnboarding('skipped',{accountId:'account-a'});
  assert.equal(completion.code,'ACCOUNT_CHANGED');
  assert.equal(capturedSignal?.aborted,true);
  assert.equal(f.account.status().status,'signed-out');
  assert.equal(f.account.identity().signedIn,false);
  assert.equal(f.account.identity().status,'signed-out');
  assert.equal(events.filter(e=>e.status==='signed-out').length,1);

  requestGate.resolve();
  await assert.rejects(pendingRequest,{code:'ACCOUNT_CHANGED'});
  await assert.rejects(f.account.request('platformLoad'),{code:'ACCOUNT_CHANGED'});
  f.account.stop();
 }
 for(const revokeOnRenewal of [true,false]){
  const memoryGate=deferred();
  const events=[];
  const f=setupRenewal({
   onApiCall:async({action})=>{
    if(action==='memoryGet')await memoryGate.promise;
    if(action==='platformLoad'&&!revokeOnRenewal){
     throw Object.assign(new Error('synthetic auth required'),{code:'AUTH_REQUIRED'});
    }
   },
   onTokenRequest:async()=>{
    throw Object.assign(new Error('synthetic revoked refresh'),{code:'SESSION_REVOKED'});
   },
  });
  f.account.subscribe(snapshot=>events.push({status:snapshot.status,signedIn:snapshot.signedIn,generation:snapshot.sessionGeneration}));
  await f.account.refresh();

  const concurrentMemory=f.account.request('memoryGet',{revision:0});
  await new Promise(resolve=>setImmediate(resolve));

  if(revokeOnRenewal)f.expire('token-account-a-0');
  await assert.rejects(
   f.account.request('platformLoad'),
   {code:revokeOnRenewal?'SESSION_REVOKED':'AUTH_REQUIRED'},
  );
  assert.equal(f.account.status().status,'signed-out');
  assert.equal(f.account.identity().signedIn,false);
  assert.equal(f.account.identity().status,'signed-out');
  assert.equal(f.account.identity().accountKey,null);
  assert.equal(events.filter(e=>e.status==='signed-out').length,1);
  assert.equal(events.at(-1)?.signedIn,false);

  memoryGate.resolve();
  await assert.rejects(concurrentMemory,{code:'ACCOUNT_CHANGED'});
  const callsAfterRevoke=f.apiCalls.length;
  await assert.rejects(f.account.request('platformLoad'),{code:'ACCOUNT_CHANGED'});
  assert.equal(f.apiCalls.length,callsAfterRevoke);
  f.account.stop();
 }
});

test('late auth errors from a replaced previous account do not sign out or disturb the newer account',async()=>{
 {
  const requestGate=deferred(),onboardingGate=deferred();
  const events=[];
  const f=setupRenewal({
   onApiCall:async({action,token})=>{
    if(action==='platformLoad'&&token==='token-account-a-0'){
     await requestGate.promise;
     throw Object.assign(new Error('stale account revoked'),{code:'SESSION_REVOKED'});
    }
    if(action==='completePurposeOnboarding'&&token==='token-account-a-0'){
     await onboardingGate.promise;
     throw Object.assign(new Error('stale onboarding revoked'),{code:'SESSION_REVOKED'});
    }
   },
  });
  f.account.subscribe(snapshot=>events.push({status:snapshot.status,signedIn:snapshot.signedIn,accountId:snapshot.accountId}));
  await f.account.refresh();

  const staleRequest=f.account.request('platformLoad');
  const staleOnboarding=f.account.completePurposeOnboarding('chosen',{accountId:'account-a'});
  await new Promise(resolve=>setImmediate(resolve));

  f.setSession('account-b');
  await f.account.refresh();
  assert.equal(f.account.identity().accountId,'account-b');
  const eventsCountAfterSwitch=events.length;

  requestGate.resolve();
  onboardingGate.resolve();
  await assert.rejects(staleRequest,{code:'ACCOUNT_CHANGED'});
  assert.deepEqual(await staleOnboarding,{
   ok:false,
   code:'ACCOUNT_CHANGED',
   message:'계정 연결이 바뀌었어요. 다시 확인해 주세요.',
  });
  assert.equal(f.account.status().status,'signed-in');
  assert.equal(f.account.identity().signedIn,true);
  assert.equal(f.account.identity().accountId,'account-b');
  assert.equal(events.length,eventsCountAfterSwitch);

  const loadedB=await f.account.request('platformLoad');
  assert.equal(loadedB.ok,true);
  assert.equal(loadedB.accountId,'account-b');
  f.account.stop();
 }
 {
  const renewGate=deferred();
  const events=[];
  const f=setupRenewal({
   onTokenRequest:async fields=>{
    if(fields.refresh_token==='refresh-account-a-0'){
     await renewGate.promise;
     throw Object.assign(new Error('stale refresh revoked'),{code:'SESSION_REVOKED'});
    }
    return f.issueNext(fields.refresh_token);
   },
  });
  f.account.subscribe(snapshot=>events.push({status:snapshot.status,signedIn:snapshot.signedIn,accountId:snapshot.accountId}));
  await f.account.refresh();
  f.expire('token-account-a-0');

  const staleRequest=f.account.request('platformLoad');
  const staleOnboarding=f.account.completePurposeOnboarding('skipped',{accountId:'account-a'});
  await new Promise(resolve=>setImmediate(resolve));

  f.setSession('account-b');
  renewGate.resolve();
  await assert.rejects(staleRequest,{code:'ACCOUNT_CHANGED'});
  assert.deepEqual(await staleOnboarding,{
   ok:false,
   code:'ACCOUNT_CHANGED',
   message:'계정 연결이 바뀌었어요. 다시 확인해 주세요.',
  });
  assert.equal(events.some(e=>e.status==='signed-out'),false);

  await f.account.refresh();
  assert.equal(f.account.status().status,'signed-in');
  assert.equal(f.account.identity().signedIn,true);
  assert.equal(f.account.identity().accountId,'account-b');
  f.account.stop();
 }
});
