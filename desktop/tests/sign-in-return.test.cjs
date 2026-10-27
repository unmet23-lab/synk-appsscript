'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSignInReturn,bringToFront}=require('../src/sign-in-return.cjs');
const signedOut={status:'signed-out',signedIn:false};

test('a browser sign-in brings the app back once it ends, except a five-minute timeout',()=>{
  const ended=createSignInReturn();
  // Start-up restore and token refreshes pass 'restoring' without a sign-in and stay quiet.
  for(const state of [{status:'restoring'},{status:'signed-in',signedIn:true},signedOut])assert.equal(ended(state),false);
  assert.equal(ended({status:'signing-in'}),false);assert.equal(ended({status:'restoring'}),false);assert.equal(ended({status:'signed-in',signedIn:true}),true);
  assert.equal(ended({status:'restoring'}),false);assert.equal(ended({status:'signed-in',signedIn:true}),false,'a later token refresh is not a sign-in');
  for(const code of ['AUTH_CANCELLED','AUTH_FAILED','NETWORK']){ended({status:'signing-in'});assert.equal(ended({...signedOut,error:{code}}),true,code);}
  ended({status:'signing-in'});assert.equal(ended({...signedOut,error:{code:'AUTH_TIMEOUT'}}),false);assert.equal(ended(signedOut),false);
});

test('bringing the window back restores it and, on Windows, holds it on top for the one focus only',()=>{
  const calls=[],window={isDestroyed:()=>false,isMinimized:()=>true,restore:()=>calls.push('restore'),show:()=>calls.push('show'),focus:()=>calls.push('focus'),setAlwaysOnTop:value=>calls.push('top:'+value)};
  assert.equal(bringToFront(window,{platform:'win32'}),true);assert.deepEqual(calls,['restore','show','top:true','focus','top:false']);
  calls.length=0;const app={focus:options=>calls.push('app:'+JSON.stringify(options))};
  assert.equal(bringToFront({...window,isMinimized:()=>false},{platform:'darwin',app}),true);assert.deepEqual(calls,['show','app:{"steal":true}','focus']);
  calls.length=0;assert.equal(bringToFront({...window,isMinimized:()=>false},{platform:'linux',app}),true);assert.deepEqual(calls,['show','focus']);
  assert.equal(bringToFront(null),false);assert.equal(bringToFront({isDestroyed:()=>true}),false);
});
