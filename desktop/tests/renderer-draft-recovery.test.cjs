'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const loaded=import('../renderer/draft-recovery.mjs'),wait=()=>new Promise(resolve=>setTimeout(resolve,15));
const draft={kind:'note',appId:'world',title:'이어 쓰기',body:'내 초안'};
async function fixture(overrides={},callbacks={}){
  const {createDraftRecovery}=await loaded;let context={owner:'alice',status:'ready',appIds:['world']},value=null,candidate=null,changed;
  const saves=[],clears=[],errors=[],calls=[],states=[];
  const bridge={draftRecoveryStatus:async owner=>{calls.push(owner);return {ok:true,available:true,enabled:true};},draftRecoveryLoad:async(_slot,owner)=>{calls.push(owner);return {ok:true,enabled:true,draft:null};},draftRecoverySave:async(slot,value,owner)=>{saves.push({slot,value,owner});return {ok:true};},draftRecoveryClear:async(slot,owner)=>{clears.push({slot,owner});return {ok:true,available:true,enabled:true};},onDraftRecoveryChanged:callback=>{changed=callback;return ()=>{};},...overrides};
  const controller=createDraftRecovery({bridge,slot:'member-home',getContext:()=>context,getDraft:()=>value,onCandidate:item=>{candidate=item;callbacks.onCandidate?.(item);},onError:item=>{errors.push(item);callbacks.onError?.(item);},onStateChange:item=>{states.push(item);callbacks.onStateChange?.(item);},delay:1});
  return {controller,saves,clears,errors,calls,states,setContext:item=>context=item,setDraft:item=>value=item,get candidate(){return candidate;},changed:()=>changed()};
}
test('opt-out never loads or saves draft contents',async()=>{let reads=0;const f=await fixture({draftRecoveryStatus:async()=>({ok:true,available:true,enabled:false}),draftRecoveryLoad:async()=>reads++});await f.controller.refresh();f.setDraft(draft);f.controller.changed();await wait();assert.equal(reads,0);assert.equal(f.saves.length,0);f.controller.dispose();});
test('recovery requires confirmation and current app access',async()=>{const f=await fixture({draftRecoveryLoad:async()=>({ok:true,enabled:true,draft,updatedAt:100})});await f.controller.refresh();assert.deepEqual(f.candidate,{draft,updatedAt:100});assert.deepEqual(f.controller.take(),draft);assert.equal(f.candidate,null);f.setContext({owner:'alice',status:'ready',appIds:['care']});await f.controller.refresh();assert.equal(f.candidate,null);f.controller.dispose();});
test('a delayed response from another account cannot appear',async()=>{let release;const f=await fixture({draftRecoveryLoad:()=>new Promise(resolve=>release=resolve)}),pending=f.controller.refresh();await wait();f.setContext({owner:'bob',status:'loading',appIds:[]});await f.controller.refresh();release({ok:true,enabled:true,draft});await pending;assert.equal(f.candidate,null);f.controller.dispose();});
test('pending writes are cancelled if identity changes before its renderer event',async()=>{const f=await fixture();await f.controller.refresh();f.setDraft(draft);f.controller.changed();f.setContext({owner:'bob',status:'ready',appIds:['world']});await wait();assert.equal(f.saves.length,0);f.controller.dispose();});
test('typing during consent load saves once and explicitly sends the renderer owner',async()=>{let release;const f=await fixture({draftRecoveryStatus:()=>new Promise(resolve=>release=resolve)}),pending=f.controller.refresh();f.setDraft(draft);release({ok:true,available:true,enabled:true});await pending;await wait();assert.deepEqual(f.saves,[{slot:'member-home',value:draft,owner:'alice'}]);f.setDraft({...draft,title:'discard'});f.controller.changed();await f.controller.clear();await wait();assert.equal(f.saves.length,1);assert.deepEqual(f.clears,[{slot:'member-home',owner:'alice'}]);f.controller.dispose();});
test('flush cancels debounce and reports an unsuccessful backup',async()=>{const f=await fixture({draftRecoverySave:async()=>({ok:false})});await f.controller.refresh();f.setDraft(draft);f.controller.changed();assert.equal(await f.controller.flush(),false);await wait();assert.equal(f.errors.length,1);f.controller.dispose();});
test('turning consent off hides candidates and cancels pending writes',async()=>{let enabled=true;const f=await fixture({draftRecoveryStatus:async()=>({ok:true,available:true,enabled}),draftRecoveryLoad:async()=>({ok:true,enabled,draft})});await f.controller.refresh();f.setDraft(draft);f.controller.changed();enabled=false;f.changed();await wait();assert.equal(f.candidate,null);assert.equal(f.saves.length,0);f.controller.dispose();});
test('clear during a pending read cannot discard an unread recovery draft',async()=>{let release;const f=await fixture({draftRecoveryLoad:()=>new Promise(resolve=>release=resolve)}),pending=f.controller.refresh();await wait();assert.equal(await f.controller.clear(),false);assert.equal(await f.controller.clear({discardCandidate:true}),false);assert.equal(f.clears.length,0);release({ok:true,enabled:true,draft});await pending;assert.deepEqual(f.candidate,{draft,updatedAt:undefined});f.controller.dispose();});
test('restoring cancels the previous input debounce and flushes the chosen draft',async()=>{const f=await fixture({draftRecoveryLoad:async()=>({ok:true,enabled:true,draft})});f.setDraft({...draft,title:'old current input'});await f.controller.refresh();f.setDraft(f.controller.take());await f.controller.flush();await wait();assert.deepEqual(f.saves,[{slot:'member-home',value:draft,owner:'alice'}]);f.controller.dispose();});

for(const phase of ['status','load'])for(const thrown of [false,true])test(`${phase} ${thrown?'thrown':'structured'} failure stays protected until an explicit same-account retry`,async()=>{
  let fail=true,statusCalls=0,loadCalls=0;
  const failed=()=>{if(thrown)throw Error('private path must not leak');return {ok:false,code:'DRAFT_STORAGE_FAILED'};};
  const f=await fixture({
    draftRecoveryStatus:async()=>{statusCalls++;return phase==='status'&&fail?failed():{ok:true,available:true,enabled:true};},
    draftRecoveryLoad:async()=>{loadCalls++;return phase==='load'&&fail?failed():{ok:true,enabled:true,draft,updatedAt:100};},
  });
  f.setDraft({...draft,title:'new current input'});await f.controller.refresh();
  assert.equal(f.controller.state.error.code,'DRAFT_STORAGE_FAILED');assert.equal(f.controller.state.retryable,true);assert.equal(f.controller.state.pending,false);assert.equal(f.errors.length,1);assert.doesNotMatch(f.errors[0],/private path/);
  for(let index=0;index<5;index++){await f.controller.refresh();f.controller.changed();}
  assert.equal(await f.controller.flush(),false);assert.equal(await f.controller.clear(),false);assert.equal(await f.controller.clear({discardCandidate:true}),false);await wait();
  assert.equal(statusCalls,1);assert.equal(loadCalls,phase==='load'?1:0);assert.equal(f.saves.length,0);assert.equal(f.clears.length,0);
  fail=false;await f.controller.retry();await wait();
  assert.equal(statusCalls,2);assert.equal(f.controller.state.error,null);assert.equal(f.controller.state.retryable,false);assert.deepEqual(f.candidate,{draft,updatedAt:100});assert.equal(f.saves.length,0);
  // Emptying or saving a new note is not permission to remove this candidate.
  assert.equal(await f.controller.clear(),false);assert.equal(await f.controller.flush(),false);assert.equal(f.clears.length,0);
  f.setDraft(f.controller.take());assert.equal(await f.controller.flush(),true);assert.deepEqual(f.saves[0].value,draft);f.controller.dispose();
});

test('only an explicit candidate discard clears a successfully read recovery draft',async()=>{
  const f=await fixture({draftRecoveryLoad:async()=>({ok:true,enabled:true,draft})});await f.controller.refresh();
  assert.equal(await f.controller.clear(),false);assert.ok(f.candidate);assert.equal(f.clears.length,0);assert.equal(f.controller.hasUnselectedDraft,true);
  assert.equal(await f.controller.clear({discardCandidate:true}),true);assert.equal(f.candidate,null);assert.equal(f.clears.length,1);assert.equal(f.controller.hasUnselectedDraft,false);f.controller.dispose();
});

test('an explicit discard failure retains the candidate and requires a fresh read before writes',async()=>{
  const f=await fixture({draftRecoveryLoad:async()=>({ok:true,enabled:true,draft}),draftRecoveryClear:async()=>({ok:false,code:'DRAFT_STORAGE_FAILED'})});await f.controller.refresh();
  assert.equal(await f.controller.clear({discardCandidate:true}),false);assert.ok(f.candidate);assert.equal(f.controller.hasUnselectedDraft,false);assert.equal(f.controller.take(),null);f.setDraft(draft);assert.equal(await f.controller.flush(),false);assert.equal(f.controller.state.retryable,true);
  await f.controller.retry();assert.deepEqual(f.controller.take(),draft);f.controller.dispose();
});

test('retry preserves its error while pending and ignores repeated refreshes from render callbacks',async()=>{
  let fail=true,release,calls=0,f;
  const rerender=()=>{void f.controller.refresh();};
  f=await fixture({draftRecoveryStatus:()=>{calls++;return fail?Promise.resolve({ok:false,code:'DRAFT_STORAGE_FAILED'}):new Promise(resolve=>release=resolve);}}, {onCandidate:rerender,onError:rerender,onStateChange:rerender});
  await f.controller.refresh();assert.equal(calls,1);fail=false;const pending=f.controller.retry();
  assert.equal(f.controller.state.pending,true);assert.equal(f.controller.state.retryable,false);assert.equal(f.controller.state.error.code,'DRAFT_STORAGE_FAILED');
  await f.controller.retry();await f.controller.refresh({force:true});assert.equal(calls,2);
  release({ok:true,available:true,enabled:true});await pending;assert.deepEqual(f.controller.state,{error:null,retryable:false,pending:false});assert.equal(calls,2);assert.ok(f.states.length<10);f.controller.dispose();
});

test('opt-out, unavailable storage and an empty successful load are not read errors',async()=>{
  for(const status of [{ok:true,available:true,enabled:false},{ok:true,available:false,enabled:false},{ok:true,available:true,enabled:true}]){
    const f=await fixture({draftRecoveryStatus:async()=>status});await f.controller.refresh();assert.deepEqual(f.controller.state,{error:null,retryable:false,pending:false});assert.equal(f.errors.length,0);assert.equal(f.candidate,null);f.controller.dispose();
  }
});

test('saving and clearing before the first read finishes never touch the bridge',async()=>{
  let release;const f=await fixture({draftRecoveryStatus:()=>new Promise(resolve=>release=resolve)});f.setDraft(draft);
  assert.equal(await f.controller.clear(),false);assert.equal(await f.controller.flush(),false);
  const pending=f.controller.refresh();f.controller.changed();assert.equal(await f.controller.clear(),false);assert.equal(await f.controller.flush(),false);await wait();assert.equal(f.saves.length,0);assert.equal(f.clears.length,0);
  release({ok:true,available:true,enabled:false});await pending;assert.equal(await f.controller.clear(),true);assert.equal(f.clears.length,0);f.controller.dispose();
});

test('a stale retry failure cannot replace the new account recovery state',async()=>{
  let release;
  const f=await fixture({draftRecoveryStatus:owner=>owner==='alice'?new Promise(resolve=>release=resolve):Promise.resolve({ok:true,available:true,enabled:false})});
  const pending=f.controller.refresh();f.setContext({owner:'bob',status:'ready',appIds:['world']});await f.controller.refresh();release({ok:false,code:'DRAFT_STORAGE_FAILED'});await pending;
  assert.deepEqual(f.controller.state,{error:null,retryable:false,pending:false});assert.equal(f.errors.length,0);assert.equal(f.candidate,null);f.controller.dispose();
});

test('revoking app access during retry prevents the old candidate from reappearing',async()=>{
  let release;const f=await fixture({draftRecoveryLoad:()=>new Promise(resolve=>release=resolve)});const pending=f.controller.refresh();await wait();
  f.setContext({owner:'alice',status:'ready',appIds:['care']});release({ok:true,enabled:true,draft});await pending;assert.equal(f.candidate,null);assert.equal(await f.controller.flush(),false);f.controller.dispose();
});

test('a native consent change invalidates an in-flight read even while user retries are coalesced',async()=>{
  let enabled=true,release;
  const f=await fixture({draftRecoveryStatus:async()=>({ok:true,available:true,enabled}),draftRecoveryLoad:()=>new Promise(resolve=>release=resolve)});
  const pending=f.controller.refresh();await wait();f.setDraft(draft);enabled=false;f.changed();await wait();
  release({ok:true,enabled:true,draft});await pending;f.controller.changed();await wait();
  assert.equal(f.candidate,null);assert.equal(f.controller.take(),null);assert.equal(await f.controller.flush(),false);assert.equal(f.saves.length,0);assert.deepEqual(f.controller.state,{error:null,retryable:false,pending:false});f.controller.dispose();
});

test('an unreadable app candidate stays byte-for-byte protected without exposing its content',async()=>{
  const original=JSON.stringify(draft);let stored=original,saves=0,clears=0;
  const f=await fixture({
    draftRecoveryLoad:async()=>({ok:true,enabled:true,draft:JSON.parse(stored),updatedAt:100}),
    draftRecoverySave:async(_slot,value)=>{saves++;stored=JSON.stringify(value);return {ok:true};},
    draftRecoveryClear:async()=>{clears++;stored='null';return {ok:true,available:true,enabled:true};},
  });
  f.setContext({owner:'alice',status:'ready',appIds:['care']});f.setDraft({...draft,appId:'care',title:'allowed new input'});
  await f.controller.refresh();await wait();assert.equal(f.candidate,null);assert.equal(f.controller.take(),null);assert.equal(f.controller.hasUnselectedDraft,true);
  f.controller.changed();assert.equal(await f.controller.flush(),false);assert.equal(await f.controller.clear(),false);assert.equal(await f.controller.clear({discardCandidate:true}),false);await wait();
  assert.equal(saves,0);assert.equal(clears,0);assert.equal(stored,original);assert.doesNotMatch(JSON.stringify(f.states),/이어 쓰기|내 초안/);
  f.setContext({owner:'alice',status:'ready',appIds:['world','care']});await f.controller.refresh();assert.deepEqual(f.candidate,{draft,updatedAt:100});assert.equal(stored,original);
  f.setDraft(f.controller.take());assert.equal(f.controller.hasUnselectedDraft,false);assert.equal(await f.controller.flush(),true);assert.equal(saves,1);assert.equal(stored,original);f.controller.dispose();
});
