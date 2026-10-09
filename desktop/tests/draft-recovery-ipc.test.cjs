'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createDraftRecoveryRequests}=require('../src/draft-recovery-ipc.cjs');
function fixture(){let state={signedIn:true,status:'signed-in',account:{synk_user_id:'account-b'}},calls=[];const recovery=Object.fromEntries(['status','setEnabled','load','save','clear'].map(name=>[name,(...args)=>{calls.push({name,args});return {ok:true};}]));recovery.available=()=>true;return {requests:createDraftRecoveryRequests({getAccount:()=>state,recovery}),calls,setAccount:value=>{state=value;}};}
test('a previous account still visible in renderer cannot read, write, clear, or enable the new account recovery slot',()=>{
  const f=fixture();for(const request of [()=>f.requests.status('account-a'),()=>f.requests.load('member-home','account-a'),()=>f.requests.save('member-home',{body:'account a text'},'account-a'),()=>f.requests.clear('member-home','account-a'),()=>f.requests.setEnabled(true,'account-a')])assert.equal(request().code,'AUTH_CHANGED');assert.deepEqual(f.calls,[]);
});
test('missing owner is rejected while signed in and the expected owner never selects another file',()=>{
  const f=fixture();assert.equal(f.requests.status().code,'AUTH_CHANGED');assert.equal(f.requests.save('member-home',{}).code,'AUTH_CHANGED');assert.equal(f.requests.load('member-home','account-b').ok,true);assert.deepEqual(f.calls,[{name:'load',args:['member-home']}]);
});
test('guest may read capability only; it cannot consent, read a draft, or mutate encrypted recovery',()=>{
  const f=fixture();f.setAccount({signedIn:false,status:'signed-out'});assert.deepEqual(f.requests.status(null),{ok:true,available:true,enabled:false});assert.equal(f.requests.load('member-home',null).code,'AUTH_CHANGED');assert.equal(f.requests.setEnabled(true,null).code,'AUTH_CHANGED');assert.deepEqual(f.calls,[]);
});
