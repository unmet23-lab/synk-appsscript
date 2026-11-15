'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const state = import('../renderer/portal-entry-state.mjs');

test('verified saved session enters once without an orb click', async () => {
  const {createPortalStateMachine} = await state;
  const portal = createPortalStateMachine({status:'restoring',generation:1});
  const verified = portal.receiveAuth({status:'signed-in',generation:1});
  assert.equal(verified.shouldStartZoom,true);
  assert.equal(verified.shouldTriggerEnter,false);
  assert.equal(portal.receiveAuth({status:'signed-in',generation:1}).shouldStartZoom,false);
  assert.equal(portal.completeZoom().shouldTriggerEnter,true);
  assert.equal(portal.completeZoom().shouldTriggerEnter,false);
  portal.completeEnter();
  assert.equal(portal.read().active,false);
});

test('click during session restoration joins the same transition', async () => {
  const {createPortalStateMachine} = await state;
  const portal = createPortalStateMachine({status:'restoring',generation:3});
  assert.equal(portal.activateOrb().shouldStartZoom,true);
  const auth = portal.receiveAuth({status:'signed-in',generation:3});
  assert.equal(auth.shouldStartZoom,false);
  assert.equal(auth.shouldTriggerEnter,false);
  assert.equal(portal.completeZoom().shouldTriggerEnter,true);
  assert.equal(portal.activateOrb().changed,false);
});

test('reduced motion can enter immediately and never opens purpose automatically', async () => {
  const {createPortalStateMachine} = await state;
  for(const extras of [{history:[]},{storageConsent:false},{library:{status:'error'}},{library:{status:'loading'}},{developmentCatalog:true,appIds:['messenger']}]){
    const portal=createPortalStateMachine({status:'restoring',generation:1});
    const next=portal.receiveAuth({status:'signed-in',generation:1,immediate:true,...extras});
    assert.equal(next.shouldStartZoom,false);
    assert.equal(next.shouldTriggerEnter,true);
    assert.notEqual(portal.read().phase,'purpose');
  }
});

test('old account status cannot replace a newer signed-out state', async () => {
  const {createPortalStateMachine} = await state;
  const portal=createPortalStateMachine({status:'signed-out',generation:8});
  portal.activateOrb({immediate:true});
  const stale=portal.receiveAuth({status:'signed-in',generation:7,immediate:true});
  assert.equal(stale.accepted,false);
  assert.equal(stale.shouldTriggerEnter,false);
  assert.equal(portal.read().authStatus,'signed-out');
  assert.equal(portal.read().generation,8);
});

test('restoration and explicit purpose close preserve an entered workspace', async () => {
  const {createPortalStateMachine} = await state;
  const portal=createPortalStateMachine({status:'signed-in',generation:1});
  portal.receiveAuth({status:'signed-in',generation:1,immediate:true});
  portal.completeEnter();
  for(const status of ['restoring','loading','signed-in','error']){
    const next=portal.receiveAuth({status,generation:2});
    assert.equal(next.state.active,false);
    assert.equal(next.shouldTriggerEnter,false);
  }
  portal.openPurpose();assert.equal(portal.read().active,true);
  portal.closePurpose();assert.equal(portal.read().phase,'entered');
});

test('bare invite tokens remain unclassified for the server to resolve', async () => {
  const {validatePortalInviteInput} = await state;
  const token='aB9-_synthetic_token_123456';
  assert.deepEqual(validatePortalInviteInput(' '+token+' '),{ok:true,kind:'code',value:token,pathname:null});
  assert.equal(validatePortalInviteInput('x'.repeat(15)).ok,false);
  assert.equal(validatePortalInviteInput('x'.repeat(201)).ok,false);
});

test('invite links require a fixed origin, path and a single fragment token', async () => {
  const {validatePortalInviteInput} = await state;
  const token='synthetic_invite_token_123456';
  for(const pathname of ['/','/pulse-app/']){
    const href='https://workspace.synk.im'+pathname+'#invite='+token;
    assert.equal(validatePortalInviteInput(href).value,href);
  }
  const rejected=[
    'http://workspace.synk.im/#invite='+token,
    'https://workspace.synk.im.evil.example/#invite='+token,
    'https://workspace.synk.im:444/#invite='+token,
    'https://user@workspace.synk.im/#invite='+token,
    'https://workspace.synk.im/elsewhere/#invite='+token,
    'https://workspace.synk.im/?invite='+token,
    'https://workspace.synk.im/?next=x#invite='+token,
    'https://workspace.synk.im/#invite='+token+'&invite='+token,
    'https://workspace.synk.im/#invite='+token+'&role=admin',
    'https://synk.im/account/platform.html#invite='+token,
    'https://workspace.synk.im/#invite='+token+'%2Fextra',
    'javascript:alert(1)',
  ];
  for(const value of rejected){
    const result=validatePortalInviteInput(value);
    assert.equal(result.ok,false,value.split('#')[0]);
    assert.equal(JSON.stringify(result).includes(token),false);
  }
});

test('entry failure retains the portal until an explicit successful retry', async () => {
  const {createPortalStateMachine} = await state;
  const portal=createPortalStateMachine({status:'signed-in',generation:2});
  portal.receiveAuth({status:'signed-in',generation:2,immediate:true});
  portal.failEnter('작업을 확인하지 못했어요.');
  assert.equal(portal.read().active,true);
  assert.equal(portal.read().enteredOnce,false);
  assert.equal(portal.retryEnter().shouldTriggerEnter,true);
  portal.completeEnter();
  assert.equal(portal.read().active,false);
});

async function pendingPurpose(){
  const {createPortalStateMachine}=await state;
  const portal=createPortalStateMachine({status:'restoring',generation:1,accountKey:'synthetic-account-a'});
  portal.receiveAuth({status:'signed-in',generation:1,accountKey:'synthetic-account-a',immediate:true});
  portal.enterToPurpose();
  assert.equal(portal.read().phase,'purpose');
  return portal;
}

test('a new member keeps the purpose question through same-account session refresh',async()=>{
  const portal=await pendingPurpose();
  for(const [index,status] of ['loading','restoring','signed-in'].entries()){
    const result=portal.receiveAuth({status,generation:index+2,accountKey:'synthetic-account-a'});
    assert.equal(result.shouldTriggerEnter,false,status);
    assert.equal(result.shouldStartZoom,false,status);
    assert.equal(portal.read().phase,'purpose',status);
  }
});

test('an account change replaces the question with entry for the new verified account',async()=>{
  const portal=await pendingPurpose();
  const change=portal.receiveAuth({status:'signed-in',generation:2,accountKey:'synthetic-account-b'});
  assert.equal(change.shouldTriggerEnter,true);
  assert.equal(change.shouldStartZoom,false);
  assert.equal(portal.read().phase,'entering');
  const stale=portal.receiveAuth({status:'signed-in',generation:1,accountKey:'synthetic-account-a'});
  assert.equal(stale.accepted,false);
  assert.equal(portal.read().phase,'entering');
});

test('confirmed logout closes an account-bound purpose question',async()=>{
  for(const status of ['signed-out','unconfigured']){
    const portal=await pendingPurpose();
    const result=portal.receiveAuth({status,generation:2,accountKey:null});
    assert.equal(result.shouldTriggerEnter,false);
    assert.equal(portal.read().phase,'auth',status);
  }
});

test('temporary authentication errors retain the current purpose question',async()=>{
  const portal=await pendingPurpose();
  const result=portal.receiveAuth({status:'error',generation:2,accountKey:'synthetic-account-a',retryable:true});
  assert.equal(result.shouldTriggerEnter,false);
  assert.equal(portal.read().phase,'purpose');
});

test('automatic purpose entry requires a verified account key and generation',async()=>{
  const {createPortalStateMachine}=await state;
  for(const missing of [{generation:1},{accountKey:'synthetic-account-a'}]){
    const portal=createPortalStateMachine({status:'signed-in',...missing});
    portal.receiveAuth({status:'signed-in',...missing,immediate:true});
    portal.enterToPurpose();
    assert.notEqual(portal.read().phase,'purpose');
  }
});
