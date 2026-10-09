import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryRecovery, libraryDraft } from '../src/platform-library-recovery.mjs';

const blank=()=>({draft:{appId:'world',title:''},editing:null,parkedDraft:null});
const saved=title=>({...blank(),draft:{appId:'world',title}});
const deferred=()=>{let resolve;return {promise:new Promise(done=>{resolve=done;}),resolve:value=>resolve(value)};};
function fixture(t,{enabled=true}={}) {
 let owner='A',usable=true,payload=blank(),stored=saved('복구할 입력'),statusGate=null,loadGate=null,listener;
 const writes=[],host={draftRecoveryStatus:async()=>statusGate?statusGate.promise:{ok:true,available:true,enabled},draftRecoveryLoad:async()=>loadGate?loadGate.promise:{ok:true,draft:stored},draftRecoverySave:async(slot,value)=>{writes.push({owner,slot,value});stored=value;return {ok:true};},draftRecoveryClear:async(slot)=>{writes.push({owner,slot,clear:true});stored=null;return {ok:true};},onDraftRecoveryChanged:fn=>(listener=fn,()=>{listener=null;})};
 const controller=createLibraryRecovery({getHost:()=>host,getOwner:()=>owner,canUse:()=>usable,getPayload:()=>payload});t.after(()=>controller.dispose());
 return {controller,writes,host,setOwner:value=>{owner=value;controller.reset();},setPayload:value=>{payload=value;},setUsable:value=>{usable=value;},setEnabled:value=>{enabled=value;listener?.();},setStored:value=>{stored=value;},holdStatus:()=>statusGate=deferred(),holdLoad:()=>loadGate=deferred()};
}

test('recovery rejects foreign fields and malformed values while retaining valid empty input',()=>{
 assert.deepEqual(libraryDraft(blank()),blank());
 for(const payload of [null,{...blank(),draft:{appId:'admin',title:'x'}},{...blank(),draft:{appId:'world',title:'x'.repeat(241)}},{...blank(),editing:{id:'bad"',appId:'world',title:'x',done:false,createdAt:1}},{...blank(),parkedDraft:{appId:'world'}}])assert.equal(libraryDraft(payload),null);
 assert.deepEqual(libraryDraft({...blank(),secret:'ignored'}),blank());
});

test('disabled recovery does not read or write draft contents',async t=>{
 const f=fixture(t,{enabled:false});f.host.draftRecoveryLoad=async()=>assert.fail('disabled store must not load');await f.controller.refresh();f.setPayload(saved('미동의 입력'));await f.controller.persist();assert.equal(f.controller.state().candidate,null);assert.deepEqual(f.writes,[]);
});

test('every host operation includes the expected owner before the native account event arrives',async t=>{
 const f=fixture(t),calls=[];
 f.host.draftRecoveryStatus=async expected=>{calls.push(['status',expected]);return {ok:true,available:true,enabled:true};};
 f.host.draftRecoveryLoad=async(slot,expected)=>{calls.push(['load',slot,expected]);return {ok:true,draft:null};};
 f.host.draftRecoverySave=async(slot,_payload,expected)=>{calls.push(['save',slot,expected]);return {ok:true};};
 f.host.draftRecoveryClear=async(slot,expected)=>{calls.push(['clear',slot,expected]);return {ok:true};};
 await f.controller.refresh();f.setPayload(saved('계정 A 입력'));await f.controller.persist();await f.controller.clear();
 assert.deepEqual(calls,[['status','A'],['load','platform-library','A'],['save','platform-library','A'],['clear','platform-library','A']]);
});

test('a late recovery load cannot expose an old owner draft after account change',async t=>{
 const f=fixture(t),gate=f.holdLoad(),pending=f.controller.refresh();await Promise.resolve();f.setOwner('B');gate.resolve({ok:true,draft:saved('A 초안')});await pending;assert.equal(f.controller.state().candidate,null);assert.deepEqual(f.writes,[]);
});

test('recovery waits for an explicit choice and never replaces existing typed input',async t=>{
 const f=fixture(t);await f.controller.refresh();assert.equal(f.controller.state().candidate.draft.title,'복구할 입력');f.setPayload(saved('새 입력'));await f.controller.persist();assert.deepEqual(f.writes,[]);
 const taken=f.controller.take();assert.equal(taken.draft.title,'복구할 입력');await f.controller.persist();assert.equal(f.writes.at(-1).value.draft.title,'새 입력');
 f.controller.reset();await f.controller.refresh();assert.equal(f.controller.state().candidate,null);
});

test('queued writes are rejected after account change and a confirmed empty draft clears the slot',async t=>{
 const f=fixture(t);f.setStored(null);await f.controller.refresh();f.setPayload(saved('A 입력'));const pending=f.controller.persist();f.setOwner('B');await pending;assert.deepEqual(f.writes,[]);
 f.setPayload(blank());await f.controller.refresh();await f.controller.persist();assert.deepEqual(f.writes,[{owner:'B',slot:'platform-library',clear:true}]);
});

test('an input snapshot submitted before pagehide may flush while the same verified owner remains',async t=>{
 const f=fixture(t);f.setStored(null);await f.controller.refresh();f.setPayload(saved('마지막 입력'));const pending=f.controller.persist();f.setUsable(false);await pending;assert.equal(f.writes[0].value.draft.title,'마지막 입력');
});

test('deleting the cloud library clears the encrypted input even after consent is turned off',async t=>{
 const f=fixture(t);await f.controller.refresh();f.setUsable(false);await f.controller.clear();assert.deepEqual(f.writes,[{owner:'A',slot:'platform-library',clear:true}]);assert.equal(f.controller.state().candidate,null);
});

test('clear invalidates a pending load so its late candidate cannot return',async t=>{
 const f=fixture(t),gate=f.holdLoad(),loading=f.controller.refresh();await Promise.resolve();
 assert.equal(await f.controller.clear(),true);gate.resolve({ok:true,draft:saved('삭제한 초안')});await loading;
 assert.equal(f.controller.state().candidate,null);assert.deepEqual(f.writes,[{owner:'A',slot:'platform-library',clear:true}]);
});

test('clear invalidates a pending status and still removes the unknown stored slot',async t=>{
 const f=fixture(t),gate=f.holdStatus(),loading=f.controller.refresh();
 assert.equal(await f.controller.clear(),true);gate.resolve({ok:true,available:true,enabled:true});await loading;
 assert.equal(f.controller.state().candidate,null);assert.deepEqual(f.writes,[{owner:'A',slot:'platform-library',clear:true}]);
});

test('clear reports native refusal and thrown failure, and succeeds only after retry',async t=>{
 const f=fixture(t);await f.controller.refresh();f.host.draftRecoveryClear=async()=>({ok:false,code:'DRAFT_STORAGE_FAILED'});
 assert.equal(await f.controller.clear(),false);assert.match(f.controller.state().error,/지우지 못/);
 f.host.draftRecoveryClear=async()=>{throw new Error('storage failure');};assert.equal(await f.controller.clear(),false);
 f.host.draftRecoveryClear=async()=>({ok:true,available:true,enabled:true});assert.equal(await f.controller.clear(),true);assert.equal(f.controller.state().error,'');
});

test('clear without an account or with disabled storage is a successful no-op',async t=>{
 const f=fixture(t,{enabled:false});await f.controller.refresh();assert.equal(await f.controller.clear(),true);f.setOwner(null);assert.equal(await f.controller.clear(),true);assert.deepEqual(f.writes,[]);
});

test('taking a recovery cancels older reads and queued snapshots before saving restored input',async t=>{
 const f=fixture(t);await f.controller.refresh();const gate=f.holdLoad(),loading=f.controller.refresh(true);await Promise.resolve();
 const payload=f.controller.take();assert.equal(payload.draft.title,'복구할 입력');f.setPayload(payload);await f.controller.persist();gate.resolve({ok:true,draft:saved('늦게 온 이전 초안')});await loading;
 assert.equal(f.controller.state().candidate,null);assert.equal(f.writes.at(-1).value.draft.title,'복구할 입력');
 f.setPayload(saved('이전 쓰기'));const queued=f.controller.persist();f.controller.take();f.setPayload(saved('최신 복원'));await f.controller.persist();await queued;
 assert.equal(f.writes.some(row=>row.value?.draft.title==='이전 쓰기'),false);assert.equal(f.writes.at(-1).value.draft.title,'최신 복원');
});
