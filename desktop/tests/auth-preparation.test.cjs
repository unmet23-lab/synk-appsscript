'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createAuthService}=require('../src/auth-service.cjs');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const settle=()=>new Promise(setImmediate);
function fixture(t){
  const firstClear=deferred(),opened=[];let clearCount=0,queue=Promise.resolve();
  // Match the real encrypted store's ordered load/save/clear contract, delaying
  // only the first clear. No real credentials, disk writes or remote requests.
  const ordered=fn=>{const operation=queue.then(fn);queue=operation.catch(()=>{});return operation;};
  const store={available:()=>true,load:()=>ordered(()=>null),save:()=>ordered(()=>{}),clear:()=>{const call=++clearCount;return ordered(()=>call===1?firstClear.promise:undefined);}};
  const service=createAuthService({config:{supabaseUrl:'https://synthetic.invalid',accountApiUrl:'https://synthetic.invalid',publishableKey:'synthetic-public',clientId:'synthetic-client',product:'platform',redirectUri:'http://127.0.0.1:0/callback'},
    store,openExternal:async url=>{opened.push(url);},fetcher:async()=>{assert.fail('preparation must not contact a remote service');}});
  t.after(()=>{firstClear.resolve();service.dispose();});
  return {service,opened,release:()=>firstClear.resolve(),clears:()=>clearCount};
}

for(const action of ['signOut','cancel'])test(`native ${action} during encrypted-store preparation prevents the older OAuth window`,async t=>{
  const f=fixture(t),login=f.service.signIn(),rejected=assert.rejects(login,{code:'AUTH_CHANGED'});await settle();
  const ending=f.service[action]();assert.equal(f.clears(),2);f.release();await Promise.all([rejected,ending]);
  assert.equal(f.opened.length,0);assert.equal(f.service.status().status,'signed-out');assert.equal(f.service.status().sessionGeneration,2);
  assert.equal(f.service.status().error?.code,action==='cancel'?'AUTH_CANCELLED':undefined);
});

test('concurrent native sign-in requests share one storage clear and one OAuth window',async t=>{
  const f=fixture(t),first=f.service.signIn();await settle();const second=f.service.signIn();
  assert.equal(f.clears(),1);f.release();const results=await Promise.all([first,second]);
  assert.ok(results.every(result=>result.status==='signing-in'));assert.equal(f.opened.length,1);assert.equal(f.service.status().sessionGeneration,1);
  await f.service.cancel();assert.equal(f.service.status().status,'signed-out');
});

test('a later explicit native login survives cleanup of the cancelled preparation',async t=>{
  const f=fixture(t),first=f.service.signIn(),rejected=assert.rejects(first,{code:'AUTH_CHANGED'});await settle();
  const ending=f.service.signOut(),next=f.service.signIn();assert.equal(f.clears(),3);f.release();await Promise.all([rejected,ending,next]);
  assert.equal(f.opened.length,1);assert.equal(f.service.status().status,'signing-in');assert.equal(f.service.status().sessionGeneration,3);
  await f.service.cancel();assert.equal(f.service.status().status,'signed-out');
});

test('disposing native auth during encrypted-store preparation cannot open OAuth later',async t=>{
  const f=fixture(t),login=f.service.signIn(),rejected=assert.rejects(login,{code:'AUTH_CHANGED'});await settle();
  f.service.dispose();f.release();await rejected;assert.equal(f.opened.length,0);assert.equal(f.service.status().signedIn,false);
});
