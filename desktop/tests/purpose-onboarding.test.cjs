'use strict';
// The platform entry portal's visit-purpose question (SYNK-talk lib/synk-account-purpose-onboarding.js, not yet in
// operation). The PC reads the server's pending/none state with its verified sign-in and records how the question
// ended, only for the SYNK ID it was shown to. The real auth service runs over a synthetic transport.
const test=require('node:test'),assert=require('node:assert/strict');
const {requestSpec,PURPOSE_ONBOARDING_OUTCOMES}=require('../src/account-requests.cjs');
const {createPlatformAuth,loadPlatformMain,PEOPLE,HOUR,reply}=require('./synthetic-platform-auth.cjs');
const A=PEOPLE.a,B=PEOPLE.b,OPERATION='completePurposeOnboarding';
const complete=(f,outcome,expectedAccountId=A.id)=>f.service.accountRequest(OPERATION,{outcome,expectedAccountId});
async function signedIn(t,options={}){const f=await createPlatformAuth(t,options);assert.equal((await f.service.initialize()).signedIn,true);return f;}

test('a verified platform sign-in shows exactly the server\'s pending or none, and an older server without the field is none',async t=>{
  for(const [state,expected] of [['pending','pending'],['none','none'],['missing','none']]){
    const f=await signedIn(t,{onboarding:{a:state}}),status=f.service.status();
    assert.deepEqual(status.onboarding,{purpose:expected},state);assert.equal(status.signedIn,true,state);assert.deepEqual(status.library,{status:'ready',appIds:['pulse']},state);
    assert.doesNotMatch(JSON.stringify(status),/synthetic-(access|refresh)/,state);
  }
  // Only the purpose word reaches the snapshot; other fields and other values are not a pending question.
  for(const [onboarding,expected] of [[{purpose:'pending',created_at:'2026-11-14T00:00:00Z',completed_at:null,synk_user_id:A.id},'pending'],[{purpose:'PENDING'},'none'],[{purpose:true},'none'],['pending','none'],[['pending'],'none'],[null,'none']]){
    const f=await createPlatformAuth(t);
    f.next('/functions/v1/synk-account',{},async call=>{const base=await call.respond().json();return reply({...base,onboarding});});
    assert.equal((await f.service.initialize()).signedIn,true);assert.deepEqual(f.service.status().onboarding,{purpose:expected},JSON.stringify(onboarding));
  }
});

test('restoring, failed and signed-out states and the other clients never show the question pending',async t=>{
  const f=await createPlatformAuth(t),starting=f.hold('/auth/v1/user'),initializing=f.service.initialize();await starting.arrived;
  assert.equal(f.service.status().status,'restoring');assert.equal(f.service.status().onboarding,null);
  starting.release();await initializing;assert.deepEqual(f.service.status().onboarding,{purpose:'pending'});
  const verifying=f.hold('/auth/v1/user');f.advance(HOUR);const renewal=f.service.getAccessToken();await verifying.arrived;
  assert.equal(f.service.status().onboarding,null);verifying.release();await renewal;assert.deepEqual(f.service.status().onboarding,{purpose:'pending'});
  f.advance(HOUR);f.next('/auth/v1/user',{},()=>reply({msg:'unavailable'},503));await assert.rejects(f.service.getAccessToken(),error=>error.retryable===true);
  assert.equal(f.service.status().status,'error');assert.equal(f.service.status().onboarding,null);
  await f.service.getAccessToken();assert.deepEqual(f.service.status().onboarding,{purpose:'pending'});
  await f.service.signOut();assert.equal(f.service.status().onboarding,null);
  // Care, Fortune and Path share the platform API product, so the server's answer carries the state; it stays out of
  // their snapshot and their own account read. WORLD and Workspace read their own product without it.
  for(const client of ['care','fortune','path','world','messenger']){
    const other=await signedIn(t,{client}),loaded=await other.service.accountRequest('load');
    assert.equal(Object.hasOwn(other.service.status(),'onboarding'),false,client);assert.equal(loaded.ok,true,client);assert.equal(Object.hasOwn(loaded,'onboarding'),false,client);
  }
});

test('the completion sends only the action and outcome to the platform account API and closes that account\'s question',async t=>{
  assert.deepEqual(PURPOSE_ONBOARDING_OUTCOMES,['chosen','skipped','not-asked']);
  for(const outcome of PURPOSE_ONBOARDING_OUTCOMES){
    const f=await signedIn(t),before=f.service.status();
    assert.deepEqual(await complete(f,outcome),{ok:true,onboarding:{purpose:'none'}},outcome);
    const calls=f.completionCalls();assert.equal(calls.length,1,outcome);const [call]=calls;
    assert.equal(call.query,'',outcome);assert.deepEqual(JSON.parse(call.body),{action:'purpose-onboarding-complete',outcome},outcome);assert.doesNotMatch(call.body,new RegExp(A.id),outcome);
    assert.equal(call.headers['X-SYNK-Product'],'platform');assert.equal(call.headers['X-SYNK-Contract'],'1');assert.equal(call.headers['Content-Type'],'application/json');assert.equal(call.owner,'a');
    assert.deepEqual(f.server.completions,[{who:'a',outcome}],outcome);
    const status=f.service.status();assert.deepEqual(status.onboarding,{purpose:'none'},outcome);assert.equal(status.signedIn,true,outcome);
    assert.deepEqual(status.account,before.account,outcome);assert.deepEqual(status.library,before.library,outcome);assert.equal(status.sessionGeneration,before.sessionGeneration,outcome);
  }
  // The request shape: the expected account is checked on the PC and stays out of the body.
  assert.deepEqual(requestSpec(OPERATION,{outcome:'skipped',expectedAccountId:A.id},'0.4.0','platform','platform'),{path:'synk-account',body:{action:'purpose-onboarding-complete',outcome:'skipped'},method:'POST',expectedAccountId:A.id});
});

test('malformed answers and the other clients are refused before any request',async t=>{
  const f=await signedIn(t),before=f.calls.length;
  for(const params of [undefined,null,'chosen',['chosen',A.id],{},{outcome:'chosen'},{expectedAccountId:A.id},
    {outcome:'chosen',expectedAccountId:A.id,purpose:'shift'},{outcome:'chosen',expectedAccountId:A.id,text:'자유 글'},{outcome:'chosen',expectedAccountId:A.id,action:'revoke-all-sessions'},
    {outcome:'done',expectedAccountId:A.id},{outcome:'CHOSEN',expectedAccountId:A.id},{outcome:'shift',expectedAccountId:A.id},{outcome:null,expectedAccountId:A.id},
    {outcome:'chosen',expectedAccountId:''},{outcome:'chosen',expectedAccountId:7},{outcome:'chosen',expectedAccountId:null},{outcome:'chosen',expectedAccountId:'x'.repeat(129)}])
    assert.equal((await f.service.accountRequest(OPERATION,params)).error.code,'INVALID_REQUEST',JSON.stringify(params));
  assert.equal(f.calls.length,before);assert.deepEqual(f.service.status().onboarding,{purpose:'pending'});
  for(const client of ['care','fortune','path','world','messenger']){
    const other=await signedIn(t,{client}),count=other.calls.length;
    assert.equal((await complete(other,'skipped')).error.code,'INVALID_REQUEST',client);assert.equal(other.calls.length,count,client);assert.equal(other.service.status().signedIn,true,client);
  }
});

test('a question shown to A records nothing once B has signed in, also when B arrives during A\'s token wait',async t=>{
  // B signed in after the question: the answer for A is refused before any request, and B's own question stays open.
  const f=await signedIn(t);await f.signInAs('b');
  assert.equal((await complete(f,'chosen',A.id)).error.code,'AUTH_CHANGED');
  assert.equal(f.completionCalls().length,0);assert.deepEqual(f.server.completions,[]);assert.deepEqual(f.service.status().onboarding,{purpose:'pending'});
  // A's renewed token is still being verified when the answer comes, and B signs in meanwhile.
  const g=await signedIn(t),verifying=g.hold('/auth/v1/user',{when:call=>call.owner==='a'});g.advance(HOUR);
  const answer=complete(g,'skipped',A.id);await verifying.arrived;
  await g.signInAs('b');verifying.release();
  assert.equal((await answer).error.code,'AUTH_CHANGED');
  assert.equal(g.completionCalls().length,0);assert.deepEqual(g.server.completions,[]);
  const status=g.service.status();assert.equal(status.account.synk_user_id,B.id);assert.deepEqual(status.onboarding,{purpose:'pending'});
  // Without any switch, the named account must still be the verified one.
  const h=await signedIn(t);assert.equal((await complete(h,'chosen',B.id)).error.code,'AUTH_CHANGED');assert.equal(h.completionCalls().length,0);
  // B's token has expired and B's renewal would fail. The answer for A is still the account change, decided before any
  // token is read or renewed; B's renewal is left to B.
  const k=await signedIn(t);await k.signInAs('b');k.advance(HOUR);
  k.next('/auth/v1/oauth/token',{method:'POST'},()=>{throw Error('synthetic transport loss');});
  const renewals=()=>k.calls.filter(call=>call.path==='/auth/v1/oauth/token').length,before=renewals();
  assert.equal((await complete(k,'chosen',A.id)).error.code,'AUTH_CHANGED');
  assert.equal(renewals(),before);assert.equal(k.completionCalls().length,0);assert.deepEqual(k.server.completions,[]);
  assert.equal(k.service.status().account.synk_user_id,B.id);
  // The failure prepared for a renewal is still waiting: the answer touched no token.
  await assert.rejects(k.service.getAccessToken(),error=>error.retryable===true);assert.equal(renewals(),before+1);
});

test('a token renewal of the same account carries the completion on',async t=>{
  // The token expired before the answer: the completion waits for the renewal and uses the new verified token.
  const f=await signedIn(t),first=f.calls.find(call=>call.path==='/functions/v1/synk-account').token,verifying=f.hold('/auth/v1/user');f.advance(HOUR);
  const answer=complete(f,'chosen');await verifying.arrived;assert.equal(f.completionCalls().length,0);
  verifying.release();assert.deepEqual(await answer,{ok:true,onboarding:{purpose:'none'}});
  const sent=f.completionCalls();assert.equal(sent.length,1);assert.equal(sent[0].owner,'a');assert.notEqual(sent[0].token,first);assert.equal(sent[0].token,await f.service.getAccessToken());
  assert.deepEqual(f.service.status().onboarding,{purpose:'none'});
  // The token rotates while the completion is on its way: its success still closes the question.
  const g=await signedIn(t),sending=g.hold('/functions/v1/synk-account',{method:'POST'}),answering=complete(g,'skipped'),inFlight=await sending.arrived;
  g.advance(HOUR);assert.notEqual(await g.service.getAccessToken(),inFlight.token);
  sending.release();assert.deepEqual(await answering,{ok:true,onboarding:{purpose:'none'}});assert.deepEqual(g.service.status().onboarding,{purpose:'none'});
  // A server failure during that rotation keeps its own code; it is not an account change.
  const h=await signedIn(t),failing=h.hold('/functions/v1/synk-account',{method:'POST',respondAtCall:false}),failed=complete(h,'not-asked');await failing.arrived;
  h.advance(HOUR);await h.service.getAccessToken();
  failing.release(reply({ok:false,error:{code:'SERVER_UNAVAILABLE',message:'잠시 뒤 다시 시도해 주세요.'}},503));
  const result=await failed;assert.equal(result.ok,false);assert.equal(result.error.code,'SERVER_UNAVAILABLE');assert.equal(result.error.retryable,true);
  assert.deepEqual(h.service.status().onboarding,{purpose:'pending'});assert.equal(h.service.status().signedIn,true);assert.deepEqual(h.server.completions,[]);
  // An expired token answered 401 is renewed once and the completion is sent again with the new token.
  const r=await signedIn(t);r.next('/functions/v1/synk-account',{method:'POST'},()=>reply({ok:false,error:{code:'AUTH_REQUIRED',message:'AUTH_REQUIRED'}},401));
  assert.deepEqual(await complete(r,'chosen'),{ok:true,onboarding:{purpose:'none'}});
  const twice=r.completionCalls();assert.equal(twice.length,2);assert.notEqual(twice[0].token,twice[1].token);assert.deepEqual(r.server.completions,[{who:'a',outcome:'chosen'}]);assert.equal(r.service.status().signedIn,true);
});

test('the completion repeats safely, and a read that started before it cannot reopen the question',async t=>{
  const f=await signedIn(t);
  for(const outcome of ['chosen','skipped'])assert.deepEqual(await complete(f,outcome),{ok:true,onboarding:{purpose:'none'}},outcome);
  // Both answers reached the server, which stored one completion: the first outcome.
  assert.equal(f.completionCalls().length,2);assert.deepEqual(f.server.completions,[{who:'a',outcome:'chosen'}]);assert.equal(f.server.onboarding.a,'none');
  assert.deepEqual(f.service.status().onboarding,{purpose:'none'});
  // A question that was never open stores nothing and still ends as none.
  const n=await signedIn(t,{onboarding:{a:'none'}});assert.deepEqual(await complete(n,'not-asked'),{ok:true,onboarding:{purpose:'none'}});
  assert.equal(n.completionCalls().length,1);assert.deepEqual(n.server.completions,[]);
  // The server answered a load 'pending' just before the completion; that answer arrives after it.
  const g=await signedIn(t),reading=g.hold('/functions/v1/synk-account'),loading=g.service.accountRequest('load');await reading.arrived;
  assert.deepEqual(await complete(g,'chosen'),{ok:true,onboarding:{purpose:'none'}});
  reading.release();const loaded=await loading;assert.equal(loaded.ok,true);assert.deepEqual(loaded.onboarding,{purpose:'pending'});
  assert.deepEqual(g.service.status().onboarding,{purpose:'none'});assert.deepEqual(g.service.status().library,{status:'ready',appIds:['pulse']});
  assert.equal((await g.service.accountRequest('load')).ok,true);assert.deepEqual(g.service.status().onboarding,{purpose:'none'});
});

test('connection, server and malformed answers fail with their own code and keep the sign-in, the library and the open question',async t=>{
  for(const [name,answer,expected] of [
    ['connection lost',()=>{throw Error('synthetic transport loss');},{code:'NETWORK',retryable:true}],
    ['server unavailable',()=>reply({ok:false,error:{code:'SERVER_UNAVAILABLE',message:'잠시 뒤 다시 시도해 주세요.'}},503),{code:'SERVER_UNAVAILABLE',retryable:true,status:503}],
    ['gateway page',()=>new Response('<html>busy</html>',{status:502}),{code:'SERVICE_UNAVAILABLE',retryable:true,status:502}],
    ['product refused',()=>reply({ok:false,error:{code:'PRODUCT_FORBIDDEN',message:'PRODUCT_FORBIDDEN'}},403),{code:'PRODUCT_FORBIDDEN',retryable:false,status:403}],
    ['success without the state',()=>reply({ok:true}),{code:'SERVICE_UNAVAILABLE',retryable:true,status:200}],
    ['success still pending',()=>reply({ok:true,onboarding:{purpose:'pending'}}),{code:'SERVICE_UNAVAILABLE',retryable:true,status:200}],
  ]){
    const f=await signedIn(t),before=f.service.status();f.next('/functions/v1/synk-account',{method:'POST'},answer);
    const result=await complete(f,'chosen');assert.equal(result.ok,false,name);
    for(const [key,value] of Object.entries(expected))assert.equal(result.error[key],value,name+': '+key);
    const status=f.service.status();assert.equal(status.signedIn,true,name);assert.deepEqual(status.account,before.account,name);assert.deepEqual(status.library,before.library,name);
    assert.deepEqual(status.onboarding,{purpose:'pending'},name);assert.equal(status.sessionGeneration,before.sessionGeneration,name);assert.notEqual(f.vault,null,name);assert.deepEqual(f.server.completions,[],name);
  }
});

test('the server\'s rejection of the session is handled as for every request: the sign-in closes',async t=>{
  const f=await signedIn(t);f.next('/functions/v1/synk-account',{method:'POST'},()=>reply({ok:false,error:{code:'SESSION_REVOKED',message:'SESSION_REVOKED'}},403));
  const result=await complete(f,'chosen');assert.equal(result.ok,false);assert.equal(result.error.code,'SESSION_REVOKED');
  const status=f.service.status();assert.equal(status.status,'signed-out');assert.equal(status.signedIn,false);assert.equal(status.onboarding,null);assert.deepEqual(status.library,{status:'unavailable',appIds:[]});assert.equal(f.vault,null);
});

test('a sign-out while the completion is on its way answers AUTH_CHANGED and restores nothing',async t=>{
  const f=await signedIn(t),sending=f.hold('/functions/v1/synk-account',{method:'POST',respondAtCall:false}),answer=complete(f,'chosen');await sending.arrived;
  await f.service.signOut();sending.release();
  assert.equal((await answer).error.code,'AUTH_CHANGED');
  const status=f.service.status();assert.equal(status.status,'signed-out');assert.equal(status.account,null);assert.equal(status.onboarding,null);
});

test('main shows the question state only with a verified sign-in, never while the sign-in suite masks it',async()=>{
  const pending={configured:true,status:'signed-in',signedIn:true,sessionGeneration:3,secureStorage:true,account:{synk_user_id:A.id,display_name:A.name},learningSync:false,library:{status:'ready',appIds:['pulse']},onboarding:{purpose:'pending'},error:null};
  const f=await loadPlatformMain({status:pending}),read=()=>f.handlers.get('synk:auth-status')(f.event),changed=()=>f.sent.filter(([channel])=>channel==='synk:auth-changed').at(-1)[1];
  assert.deepEqual((await read()).onboarding,{purpose:'pending'});f.authOptions.onChange(pending);assert.deepEqual(changed().onboarding,{purpose:'pending'});
  f.control.suiteAvailable=false;
  const masked=await read();assert.equal(masked.signedIn,false);assert.equal(masked.onboarding,null);
  f.authOptions.onChange(pending);assert.equal(changed().signedIn,false);assert.equal(changed().onboarding,null);
  assert.deepEqual(pending.onboarding,{purpose:'pending'},'the auth snapshot itself is left as it was');
});
