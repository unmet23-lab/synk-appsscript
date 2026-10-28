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

// Windows: on top for a moment, then back to normal — never focus(), which only flashes the taskbar from behind the browser
// and leaves the page believing it has focus (the sign-in notice would then run out before the member is back).
// The level is a plain topmost ('screen-saver'): Electron's default only tucks the window behind the taskbar, which may sit low.
test('bringing the window back restores it and, on Windows, holds it on top for a moment without taking focus',()=>{
  const calls=[],pending=[],schedule=(run,ms)=>{calls.push('wait:'+ms);pending.push(run);};let destroyed=false;
  const window={isDestroyed:()=>destroyed,isMinimized:()=>true,isVisible:()=>true,restore:()=>calls.push('restore'),show:()=>calls.push('show'),showInactive:()=>calls.push('showInactive'),focus:()=>calls.push('focus'),setAlwaysOnTop:(value,level)=>calls.push('top:'+value+(level?':'+level:''))};
  assert.equal(bringToFront(window,{platform:'win32',schedule}),true);assert.deepEqual(calls,['restore','top:true:screen-saver','wait:400']);
  pending.shift()();assert.deepEqual(calls,['restore','top:true:screen-saver','wait:400','top:false']);
  // A window closed while it was held on top is left alone; a hidden one (closed to the tray) is shown first, without activation.
  calls.length=0;assert.equal(bringToFront({...window,isMinimized:()=>false,isVisible:()=>false},{platform:'win32',schedule}),true);destroyed=true;pending.shift()();assert.deepEqual(calls,['showInactive','top:true:screen-saver','wait:400']);
  destroyed=false;calls.length=0;const app={focus:options=>calls.push('app:'+JSON.stringify(options))};
  assert.equal(bringToFront({...window,isMinimized:()=>false},{platform:'darwin',app}),true);assert.deepEqual(calls,['app:{"steal":true}','focus']);
  calls.length=0;assert.equal(bringToFront({...window,isMinimized:()=>false},{platform:'linux',app}),true);assert.deepEqual(calls,['focus']);
  assert.equal(bringToFront(null),false);assert.equal(bringToFront({isDestroyed:()=>true}),false);
});
