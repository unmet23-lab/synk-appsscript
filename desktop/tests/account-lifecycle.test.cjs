'use strict';
// Account lifecycle registry (desktop/renderer/account-lifecycle.mjs): the launcher's account switch,
// startup render and unsaved-draft guards walk this registry instead of a hand-kept list of screens.
// These cases use the module directly; desktop/tests/renderer-auth.test.cjs runs it inside the real launcher.
const test=require('node:test'),assert=require('node:assert/strict');
const loaded=import('../renderer/account-lifecycle.mjs');

async function recorder(){
  const {createAccountLifecycle}=await loaded,log=[];let mirrored=0;
  const lifecycle=createAccountLifecycle({onEpoch:epoch=>{mirrored=epoch;log.push('epoch:'+epoch);}});
  const hooks=(name,list)=>Object.fromEntries(list.map(hook=>[hook,change=>{log.push(name+'.'+hook+(change&&typeof change==='object'?'('+[change.changed,change.ownerChanged,change.epoch].join(',')+')':''));}]));
  return {lifecycle,log,hooks,mirrored:()=>mirrored};
}

test('a changed owner runs every phase in registration order around the commit and advances the epoch once',async()=>{
  const {lifecycle,log,hooks,mirrored}=await recorder();
  lifecycle.register('first',hooks('first',['beforeOwnerChange','onIdentity','onAccountChange','render']));
  lifecycle.register('second',hooks('second',['onAccountChange','render','afterRender']));
  lifecycle.register('third',hooks('third',['beforeOwnerChange','onIdentity','render','afterRender']));
  const change=lifecycle.transition({changed:true,ownerChanged:true,commit:()=>log.push('commit')});
  assert.deepEqual(log,[
    'first.beforeOwnerChange(true,true,0)','third.beforeOwnerChange(true,true,0)','commit',
    'first.onIdentity(true,true,0)','third.onIdentity(true,true,0)','epoch:1',
    'first.onAccountChange(true,true,1)','second.onAccountChange(true,true,1)',
    'first.render','second.render','third.render','second.afterRender','third.afterRender',
  ]);
  assert.deepEqual({...change},{changed:true,ownerChanged:true,epoch:1});assert.equal(Object.isFrozen(change),true);
  assert.equal(lifecycle.epoch(),1);assert.equal(mirrored(),1);
});

test('the same account refreshes identity and renders without resets, owner capture or a new epoch',async()=>{
  const {lifecycle,log,hooks}=await recorder();
  lifecycle.register('screen',hooks('screen',['beforeOwnerChange','onIdentity','onAccountChange','render','afterRender']));
  lifecycle.transition({commit:()=>log.push('commit')});
  assert.deepEqual(log,['commit','screen.onIdentity(false,false,0)','screen.render','screen.afterRender']);assert.equal(lifecycle.epoch(),0);
});

test('a library or session change for the same person resets screens without capturing the previous owner',async()=>{
  const {lifecycle,log,hooks}=await recorder();
  lifecycle.register('screen',hooks('screen',['beforeOwnerChange','onAccountChange']));
  lifecycle.transition({changed:true,ownerChanged:false});
  assert.deepEqual(log,['epoch:1','screen.onAccountChange(true,false,1)']);
});

test('reset hooks already see the advanced epoch, so work captured before the switch is ignored',async()=>{
  const {lifecycle,mirrored}=await recorder();const seen=[],applied=[];
  lifecycle.register('guard-reader',{onAccountChange:()=>seen.push([lifecycle.epoch(),mirrored()])});
  const owned=lifecycle.epoch(),late=value=>{if(lifecycle.isCurrent(owned))applied.push(value);};
  late('before-switch');lifecycle.transition({changed:true,ownerChanged:true});late('old-account-reply');
  assert.deepEqual(seen,[[1,1]]);assert.deepEqual(applied,['before-switch']);
  assert.equal(lifecycle.isCurrent(owned),false);assert.equal(lifecycle.isCurrent(lifecycle.epoch()),true);
  lifecycle.transition({changed:false});assert.equal(lifecycle.epoch(),1,'an unchanged account keeps the current epoch');
});

test('startup render and after-render can run apart, each in registration order',async()=>{
  const {lifecycle,log,hooks}=await recorder();
  lifecycle.register('a',hooks('a',['render','afterRender','onIdentity']));lifecycle.register('b',hooks('b',['render']));lifecycle.register('c',hooks('c',['afterRender']));
  lifecycle.render();log.push('default view');lifecycle.afterRender();
  assert.deepEqual(log,['a.render','b.render','default view','a.afterRender','c.afterRender']);
});

test('one unsaved screen is enough, and checks stop at the first screen with a draft',async()=>{
  const {createAccountLifecycle}=await loaded,lifecycle=createAccountLifecycle(),asked=[];let pulse=false,home=false;
  assert.equal(lifecycle.hasUnsavedDrafts(),false,'no screens means nothing to protect');
  lifecycle.register('pulse',{hasUnsavedDrafts:()=>{asked.push('pulse');return pulse;}});
  lifecycle.register('render-only',{render(){}});
  lifecycle.register('home',{hasUnsavedDrafts:()=>{asked.push('home');return home;}});
  lifecycle.register('library',{hasUnsavedDrafts:()=>{asked.push('library');return 'kept note';}});
  assert.equal(lifecycle.hasUnsavedDrafts(),true);assert.deepEqual(asked,['pulse','home','library']);
  asked.length=0;pulse=true;assert.equal(lifecycle.hasUnsavedDrafts(),true);assert.deepEqual(asked,['pulse'],'a check may copy form fields into a draft, so later screens are not asked');
  asked.length=0;pulse=false;home=1;assert.equal(lifecycle.hasUnsavedDrafts(),true);assert.deepEqual(asked,['pulse','home']);
  const clean=createAccountLifecycle();clean.register('a',{hasUnsavedDrafts:()=>false});clean.register('b',{hasUnsavedDrafts:()=>undefined});assert.equal(clean.hasUnsavedDrafts(),false);
});

test('discarding starts every draft discard in order and reports each settled outcome',async()=>{
  const {createAccountLifecycle}=await loaded,lifecycle=createAccountLifecycle(),started=[];let release;
  lifecycle.register('pulse',{discardDraft:()=>{started.push('pulse');}});
  lifecycle.register('home',{discardDraft:()=>{started.push('home');return new Promise(resolve=>{release=resolve;});}});
  lifecycle.register('library',{discardDraft:()=>{started.push('library');return Promise.reject(Error('storage locked'));},flushDraft(){}});
  const pending=lifecycle.discardDrafts();assert.deepEqual(started,['pulse','home','library'],'all discards start before any of them settles');
  release(false);const results=await pending;
  assert.deepEqual(results.map(result=>result.status),['fulfilled','fulfilled','rejected']);
  assert.deepEqual(results.slice(0,2).map(result=>result.value),[undefined,false]);assert.equal(results[2].reason.message,'storage locked');
  const throwing=createAccountLifecycle();throwing.register('broken',{discardDraft:()=>{throw Error('sync failure');}});
  assert.throws(()=>throwing.discardDrafts(),/sync failure/,'a synchronous failure still surfaces to the leave dialog');
});

test('flushing drafts calls every flush in order and ignores their results',async()=>{
  const {createAccountLifecycle}=await loaded,lifecycle=createAccountLifecycle(),flushed=[];
  lifecycle.register('home',{flushDraft:()=>{flushed.push('home');return Promise.resolve(true);}});
  lifecycle.register('pulse',{hasUnsavedDrafts:()=>true});
  lifecycle.register('library',{flushDraft:()=>{flushed.push('library');}});
  assert.equal(lifecycle.flushDrafts(),undefined);assert.deepEqual(flushed,['home','library']);
});

test('registration rejects unnamed, duplicate or misspelled participants and can be undone',async()=>{
  const {createAccountLifecycle}=await loaded,lifecycle=createAccountLifecycle(),log=[];
  assert.throws(()=>lifecycle.register('',{render(){}}),/need a name/);
  const remove=lifecycle.register('screen',{render:()=>log.push('screen')});
  assert.throws(()=>lifecycle.register('screen',{render(){}}),/already registered/);
  assert.throws(()=>lifecycle.register('typo',{onAcountChange(){}}),/Unknown account lifecycle hook typo\.onAcountChange/);
  assert.throws(()=>lifecycle.register('value',{render:'renderLibrary'}),/Unknown account lifecycle hook value\.render/);
  lifecycle.render();remove();remove();lifecycle.render();assert.deepEqual(log,['screen']);
  lifecycle.register('screen',{render:()=>log.push('again')});lifecycle.render();assert.deepEqual(log,['screen','again']);
});

test('a participant registered during a phase joins from the next phase, not the one already running',async()=>{
  const {createAccountLifecycle}=await loaded,lifecycle=createAccountLifecycle(),log=[];
  lifecycle.register('host',{render:()=>{log.push('host');lifecycle.register('late',{render:()=>log.push('late.render'),afterRender:()=>log.push('late.afterRender')});}});
  lifecycle.transition({});assert.deepEqual(log,['host','late.afterRender']);
});
