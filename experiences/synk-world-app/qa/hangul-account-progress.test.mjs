import test from 'node:test';
import assert from 'node:assert/strict';
import {createHangulProgressPort,HANGUL_PROGRESS_KEY as KEY} from '../hangul-progress-port.mjs';
import {createWorldPlayHost} from '../../play-common/account-host.mjs';
import {emptyPlayState,validatePlayChanges,validatePlayValue} from '../../play-common/play-data.mjs';
import {openProgressStorage} from '../../hangul-stage/learning.mjs';
import {emptyProgress,meet,answer,finishSession,graduate} from '../../hangul-stage/core.mjs';
import {validateHangulProgress} from '../../hangul-stage/progress-data.mjs';
import {planDeviceRecords,applyDeviceRecords,saveDeviceRecordsDecision,deviceRecordsDecision} from '../device-records.mjs';
const memory=()=>{const values=new Map();return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
function remote(){
 const rows=new Map();let fail=false,lose=false;
 return {rows,offline:value=>{fail=value;},loseNextAck:()=>{lose=true;},client(owner){
  const row=()=>{if(!rows.has(owner))rows.set(owner,{state:emptyPlayState(),revision:0,receipts:new Set()});return rows.get(owner);};
  const reply=()=>({ok:true,scope:'synk-play',accountId:owner,...structuredClone({state:row().state,revision:row().revision})});
  return {async load(){if(fail)throw Error('offline');return reply();},async mutate(body){
   if(fail)throw Error('offline');const current=row();if(current.receipts.has(body.id))return reply();
   assert.equal(body.action,'progress');const changes=validatePlayChanges(body.changes);
   for(const change of changes)if((current.state.records[change.key]??null)!==change.previous)throw Object.assign(Error('conflict'),{code:'REVISION_CONFLICT'});
   for(const change of changes)change.value===null?delete current.state.records[change.key]:current.state.records[change.key]=change.value;
   current.receipts.add(body.id);current.revision++;
   if(lose){lose=false;throw Error('ack lost');}return reply();
  }};
 }};
}
const raw=()=>JSON.stringify(meet(emptyProgress(),['v-a','v-o'],'2026-10-20T00:00:00Z'));
const port=(server,owner,storage=memory(),guard=()=>{})=>createHangulProgressPort({accountId:owner,client:server.client(owner),storage,guard,target:{}});
const host=(server,owner,storage=memory(),guard=()=>{})=>createWorldPlayHost({accountId:owner,client:server.client(owner),storage,guard});

test('explicit snapshot migration saves to account and a fresh device restores exactly those letters',async()=>{
 const server=remote(),local=memory();local.setItem(KEY,raw());
 const migration=await port(server,'alpha',local);
 try{
  const plan=planDeviceRecords({storage:local,hangulPort:migration});
  assert.equal(migration.read(),null);assert.equal(server.rows.get('alpha').revision,0,'opening does not import a guest record');
  const result=await applyDeviceRecords(plan,{storage:local,hangulPort:migration});
  assert.equal(result.hangul,'moved');assert.deepEqual(result.errors,[]);assert.equal(local.getItem(KEY),raw());
  const other=host(server,'alpha');
  try{
   const win={SYNKPlayHost:other,localStorage:memory()};win.parent=win;
   const game=await openProgressStorage(win,{assignment(){}});
   assert.equal(game.account,true);assert.equal(game.storage.getItem(game.key),raw());
   assert.throws(()=>game.storage.getItem('synk.oauth.session.world'),/Only Hangul/);
   game.storage.setItem(game.key,JSON.stringify({...JSON.parse(raw()),skipped:true}));await game.flush();
   assert.equal(JSON.parse(server.rows.get('alpha').state.records[KEY]).skipped,true);
  }finally{other.stop();}
 }finally{migration.dispose();}
});

test('offline import remains pending, retry confirms remote and lost acknowledgements do not duplicate writes',async()=>{
 const server=remote(),migration=await port(server,'alpha');
 try{
  server.offline(true);await assert.rejects(migration.importSnapshot(raw()),/offline/);assert.equal(migration.status().pending,1);
  assert.equal(server.rows.get('alpha').state.records[KEY],undefined);
  server.offline(false);assert.equal(await migration.importSnapshot(raw()),'moved');assert.equal(migration.status().pending,0);
  assert.equal(server.rows.get('alpha').revision,1);
 }finally{migration.dispose();}
 const second=await port(server,'beta');
 try{
  server.loseNextAck();await assert.rejects(second.importSnapshot(raw()),/ack lost/);
  assert.equal(second.status().pending,1);assert.equal(await second.importSnapshot(raw()),'moved');
  assert.equal(server.rows.get('beta').revision,1,'same command ID has one receipt');
 }finally{second.dispose();}
});

test('existing account and account-scoped legacy records never get merged with a guest',async()=>{
 const server=remote(),local=memory(),learning={accountKey:'alpha',revision:2};
 const legacy='synk.account.alpha.r2.hangul-stage.v1';
 local.setItem(KEY,raw());local.setItem(legacy,JSON.stringify({...JSON.parse(raw()),amount:5}));
 const migration=await port(server,'alpha',local);
 try{
  const plan=planDeviceRecords({storage:local,learning,hangulPort:migration});assert.equal(plan.hangul.from,legacy);
  await applyDeviceRecords(plan,{storage:local,hangulPort:migration});
  assert.equal(JSON.parse(server.rows.get('alpha').state.records[KEY]).amount,5);
  assert.equal(planDeviceRecords({storage:local,learning,hangulPort:migration}),null);
  assert.equal(await migration.importSnapshot(raw()),'exists');
  saveDeviceRecordsDecision(local,'alpha','moved',1);
  assert.equal(deviceRecordsDecision(local,'alpha',{cloud:true}),null,'old local-only success does not mean cloud migration');
 }finally{migration.dispose();}
});

test('concurrent devices retain both drafts until explicit conflict choice; logout blocks stale writes',async()=>{
 const server=remote(),a=host(server,'alpha'),b=host(server,'alpha'),local=memory();let alive=true;
 const fenced=host(server,'beta',local,()=>{if(!alive)throw Object.assign(Error('changed'),{code:'ACCOUNT_CHANGED'});});
 try{
  await Promise.all([a.ready(),b.ready(),fenced.ready()]);const aa=a.storage(),bb=b.storage();aa.getItem(KEY);bb.getItem(KEY);
  aa.setItem(KEY,raw());await a.flush();const desired=JSON.stringify({...JSON.parse(raw()),skipped:true});bb.setItem(KEY,desired);
  await assert.rejects(b.flush(),{code:'REVISION_CONFLICT'});assert.equal(server.rows.get('alpha').state.records[KEY],raw());assert.equal(bb.getItem(KEY),desired);
  await b.resolve('local');assert.equal(server.rows.get('alpha').state.records[KEY],desired);
  const stale=fenced.storage();alive=false;assert.throws(()=>stale.setItem(KEY,raw()),{code:'ACCOUNT_CHANGED'});
  const stranger=host(server,'gamma',local);try{await stranger.ready();assert.equal(stranger.storage().getItem(KEY),null);assert.equal(stranger.status().pending,0);}finally{stranger.stop();}
 }finally{a.stop();b.stop();fenced.stop();}
});

test('cloud migration checks account fencing again before changing the first-run answer',async()=>{
 const local=memory();local.setItem(KEY,raw());let alive=true,answerWrites=0;
 const cloud={read:()=>null,async importSnapshot(){alive=false;return 'moved';}};
 const plan=planDeviceRecords({storage:local,hangulPort:cloud});plan.answer={answer:'new',via:'question'};
 const result=await applyDeviceRecords(plan,{storage:local,hangulPort:cloud,guard:()=>{if(!alive)throw Error('account changed');},setAccountAnswer:async()=>{answerWrites++;}});
 assert.ok(result.errors.length);assert.equal(answerWrites,0);
});

test('the account boundary accepts actual Core progression and rejects newer or unreadable snapshots',async()=>{
 let progress=JSON.parse(raw());
 progress=answer(progress,{focus:['v-a'],confused:[['v-a','v-o']],correct:false,at:'2026-10-20T00:01:00Z',sessionId:'one'});
 progress=finishSession(progress,{day:'2026-10-20',sessionNo:1,total:10,independent:3});
 progress=graduate(progress,'2026-10-20T00:02:00Z');
 assert.doesNotThrow(()=>validateHangulProgress(progress));assert.doesNotThrow(()=>validatePlayValue(KEY,JSON.stringify(progress)));
 for(const bad of [{...progress,v:2},{...progress,core:'hangul-core-9'},{...progress,letters:{'v-a':{state:'mastered'}}},{...progress,sessions:[{day:'bad'}]},{...progress,token:'synthetic'}])
  assert.throws(()=>validatePlayValue(KEY,JSON.stringify(bad)),{code:'INVALID_PLAY_STATE'});
 const unknown=JSON.stringify({...progress,v:2}),win={SYNKPlayHost:{ready:async()=>{},storage:()=>({getItem:()=>unknown})},localStorage:memory()};
 win.parent=win;await assert.rejects(openProgressStorage(win),{code:'HANGUL_PROGRESS_UNREADABLE'});
});
