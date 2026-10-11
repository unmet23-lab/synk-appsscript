import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createLifeProgress,LIFE_PROGRESS_KEY} from '../life-progress.mjs';
import {createLifeProgressPort} from '../life-progress-port.mjs';
import {emptyPlayState} from '../../play-common/play-data.mjs';
import {choiceKey,readTutorChoice,saveTutorChoice} from '../../brand-opening/tutor-choice.mjs';
import {restoreTutorSelection,commitTutorSelection,tutorSelectionStatus} from '../tutor-selection-sync.mjs';

const OWNER='11111111-1111-4111-8111-111111111111';
const failure=code=>Object.assign(Error(code),{code});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function storage(){
 const data=new Map();
 return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
}
function record(tutor){return {version:1,owner:OWNER,revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{},...(tutor?{tutor:{version:1,selected:tutor}}:{})};}
async function fixture({tutor=null,raw,mutate}={}){
 const cache=storage(),state=emptyPlayState(),calls=[];let revision=0,active=true;
 if(raw!==undefined||tutor)state.records[LIFE_PROGRESS_KEY]=raw??JSON.stringify(record(tutor));
 const envelope=()=>({ok:true,scope:'synk-play',accountId:OWNER,revision,state:structuredClone(state)});
 const guard=()=>{if(!active)throw failure('ACCOUNT_CHANGED');};
 const client={load:async()=>envelope(),mutate:async body=>{
  calls.push(structuredClone(body));if(mutate)await mutate(body);
  for(const change of body.changes){if((state.records[change.key]??null)!==change.previous)throw failure('REVISION_CONFLICT');state.records[change.key]=change.value;}
  revision++;return envelope();
 }};
 const port=await createLifeProgressPort({accountId:OWNER,client,guard,storage:cache,target:{}});
 const progress=createLifeProgress({owner:OWNER,storage:port.storage,mode:'account',guard:port.guard,save:port.flush,getSaveStatus:port.status});
 return {cache,progress,port,calls,state,guard,invalidate(){active=false;},args(tutor){return {progress,owner:OWNER,tutor,storage:cache,guard};}};
}

test('server selection wins over an older device choice and restore makes no server mutation',async t=>{
 const f=await fixture({tutor:'mongle'});t.after(()=>f.port.dispose());
 saveTutorChoice(f.cache,OWNER,'kkamong');const applied=[];
 restoreTutorSelection({progress:f.progress,owner:OWNER,storage:f.cache,apply:(...args)=>applied.push(args)});
 assert.deepEqual(applied,[['mongle',OWNER]]);assert.equal(f.port.status().pending,0);assert.equal(f.calls.length,0);
});

test('empty account is seeded once from the same owner while guest and another owner are never imported',async t=>{
 const f=await fixture();t.after(()=>f.port.dispose());
 saveTutorChoice(f.cache,'guest','mongle');saveTutorChoice(f.cache,'another-account','marin');
 const applied=[];const restore=()=>restoreTutorSelection({progress:f.progress,owner:OWNER,storage:f.cache,apply:(...args)=>applied.push(args)});
 restore();assert.deepEqual(applied,[[null,OWNER]]);assert.equal(f.port.status().pending,0);
 saveTutorChoice(f.cache,OWNER,'kkamong');restore();assert.equal(f.progress.selectedTutor(),'kkamong');
 await f.progress.flush();restore();await f.progress.flush();
 assert.equal(f.calls.length,1);assert.equal(JSON.parse(f.state.records[LIFE_PROGRESS_KEY]).tutor.selected,'kkamong');
});

test('unready, unscoped and conflict records are not migrated or applied',()=>{
 const cache=storage();saveTutorChoice(cache,OWNER,'marin');
 for(const status of [{scoped:false,phase:'device'},{scoped:true,phase:'loading'},{scoped:true,phase:'conflict'},{scoped:true,phase:'unreadable'},{scoped:true,phase:'stopped'},{scoped:true,phase:'offline',rejected:1}]){
  restoreTutorSelection({owner:OWNER,storage:cache,progress:{status:()=>status,selectedTutor:()=>assert.fail('must not read unready selection'),selectTutor:()=>assert.fail('must not migrate')},apply:()=>assert.fail('must not apply')});
 }
});

test('connected commit updates the cache only after account persistence and invalid selections preserve all data',async t=>{
 const gate=deferred(),f=await fixture({tutor:'marin',mutate:()=>gate.promise});t.after(()=>f.port.dispose());
 saveTutorChoice(f.cache,OWNER,'marin');
 const pending=commitTutorSelection(f.args('kkamong'));
 await Promise.resolve();assert.equal(readTutorChoice(f.cache,OWNER),'marin');
 gate.resolve();assert.deepEqual(await pending,{saved:true,mode:'account',message:'고른 튜터를 SYNK 계정에 저장했어요.'});
 assert.equal(readTutorChoice(f.cache,OWNER),'kkamong');
 const before=JSON.stringify(f.state),original=f.cache.getItem(choiceKey(OWNER));
 await assert.rejects(commitTutorSelection(f.args('unknown')),TypeError);
 assert.equal(JSON.stringify(f.state),before);assert.equal(f.cache.getItem(choiceKey(OWNER)),original);
});

test('a durable offline queue permits continuing but is not labelled account-saved',async t=>{
 const f=await fixture({tutor:'marin',mutate:()=>{throw failure('NETWORK');}});t.after(()=>f.port.dispose());
 saveTutorChoice(f.cache,OWNER,'marin');const result=await commitTutorSelection(f.args('mongle'));
 assert.equal(result.saved,true);assert.equal(result.mode,'account');assert.match(result.message,/이 기기에 보관/);
 assert.equal(f.progress.status().saved,false);assert.equal(f.progress.status().pending,1);
 assert.equal(JSON.parse(f.state.records[LIFE_PROGRESS_KEY]).tutor.selected,'marin');assert.equal(readTutorChoice(f.cache,OWNER),'mongle');
});

test('quota failure retains the old cache and an unsaved draft even when an older command is pending',async t=>{
 const f=await fixture({tutor:'marin',mutate:()=>{throw failure('NETWORK');}});t.after(()=>f.port.dispose());
 saveTutorChoice(f.cache,OWNER,'marin');f.progress.selectTutor('kkamong');await assert.rejects(f.progress.flush(),{code:'NETWORK'});
 const write=f.cache.setItem;f.cache.setItem=()=>{throw failure('QUOTA');};
 await assert.rejects(commitTutorSelection(f.args('mongle')),{code:'QUOTA'});
 assert.equal(f.progress.status().phase,'unsaved');assert.equal(f.progress.status().pending,1);
 assert.equal(readTutorChoice(f.cache,OWNER),'marin');assert.equal(f.progress.selectedTutor(),'mongle');
 f.cache.setItem=write;
});

test('an account change during a save cannot apply or cache the old account result',async t=>{
 const gate=deferred(),f=await fixture({tutor:'marin',mutate:()=>gate.promise});t.after(()=>f.port.dispose());
 saveTutorChoice(f.cache,OWNER,'marin');const saving=commitTutorSelection(f.args('kkamong'));
 await Promise.resolve();f.invalidate();gate.resolve();
 await assert.rejects(saving,{code:'ACCOUNT_CHANGED'});
 assert.equal(readTutorChoice(f.cache,OWNER),'marin');
});

test('conflict and rejected saves preserve the previous active cache for explicit recovery',async t=>{
 for(const code of ['REVISION_CONFLICT','INVALID_PLAY_REQUEST']){
  const f=await fixture({tutor:'marin',mutate:()=>{throw failure(code);}});t.after(()=>f.port.dispose());saveTutorChoice(f.cache,OWNER,'marin');
  await assert.rejects(commitTutorSelection(f.args('mongle')),{code:'REVISION_CONFLICT'});
  assert.equal(readTutorChoice(f.cache,OWNER),'marin');
  assert.equal(tutorSelectionStatus({owner:OWNER,progress:f.progress,ready:true}).blocked,true);
 }
});

test('unreadable source and unconnected account cannot replace an existing selection',async t=>{
 const raw=JSON.stringify({...record('marin'),tutor:{version:999,selected:'marin'}}),f=await fixture({raw});t.after(()=>f.port.dispose());
 saveTutorChoice(f.cache,OWNER,'kkamong');
 await assert.rejects(commitTutorSelection(f.args('mongle')),{code:'LIFE_PROGRESS_UNREADABLE'});
 assert.equal(f.state.records[LIFE_PROGRESS_KEY],raw);assert.equal(readTutorChoice(f.cache,OWNER),'kkamong');
 const unconnected=createLifeProgress({owner:OWNER,storage:f.cache});
 await assert.rejects(commitTutorSelection({...f.args('mongle'),progress:unconnected}),{code:'TUTOR_ACCOUNT_UNAVAILABLE'});
 assert.equal(readTutorChoice(f.cache,OWNER),'kkamong');
});

test('guest choices stay local and status distinguishes loading, syncing and recoverable failure',async()=>{
 const cache=storage(),guard=()=>{};
 assert.deepEqual(await commitTutorSelection({owner:'guest',tutor:'mongle',storage:cache,guard}),{saved:true,mode:'device'});
 assert.equal(readTutorChoice(cache,'guest'),'mongle');
 assert.equal(tutorSelectionStatus({owner:'guest'}).phase,'device');
 assert.equal(tutorSelectionStatus({owner:OWNER,ready:false}).phase,'loading');
 assert.equal(tutorSelectionStatus({owner:OWNER,ready:true,progress:{status:()=>({phase:'synced',scoped:true})}}).blocked,false);
 for(const phase of ['conflict','unreadable','stopped'])assert.equal(tutorSelectionStatus({owner:OWNER,ready:true,progress:{status:()=>({phase,scoped:true})}}).blocked,true);
});

// Exercise the shipped shell callback without loading a DOM or starting account
// traffic. The dependencies below represent the page at the reconnection event.
function reconnectContext({panel='',port={},flush=async()=>{},blocked=false}={}){
 const source=readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const callback=source.match(/async function refreshTutorAccount\(\)\{[\s\S]*?\n\}\n(?=function initializeLife)/)?.[0];
 assert.ok(callback,'shell reconnect callback is present');
 const listeners=new Map(),focusListener=source.split('\n').find(line=>line.startsWith("window.addEventListener('focus',"));
 assert.ok(focusListener,'shell listens to refocus even when the document remains visible');
 const context={tutorRefresh:null,client:{snapshot:{accountId:OWNER},busy:false},home:{openPanel:()=>panel},lifePort:port,tutorReady:true,tutorStatus:()=>({blocked}),lifeEpoch:1,flushes:0,reinitializations:0,
  document:{hidden:false},window:{addEventListener:(event,fn)=>listeners.set(event,fn)}};
 context.lifeProgress={flush:async()=>{context.flushes++;await flush();}};
 context.initializeLife=async()=>{context.reinitializations++;};
 vm.createContext(context);vm.runInContext(callback,context);vm.runInContext(focusListener,context);
 return {context,run:()=>vm.runInContext('refreshTutorAccount()',context),focus:()=>listeners.get('focus')()};
}

test('reconnection flushes a durable tutor choice even while a cafe panel stays open',async()=>{
 const f=reconnectContext({panel:'life-cafe'});await f.run();
 assert.equal(f.context.flushes,1);assert.equal(f.context.reinitializations,0,'an active lesson is not replaced');
});

test('background refresh is serialized and an account change during flush prevents rebuilding stale progress',async()=>{
 const gate=deferred(),f=reconnectContext({flush:()=>gate.promise});
 const first=f.run();await f.run();assert.equal(f.context.flushes,1);
 f.context.lifeEpoch++;gate.resolve();await first;
 assert.equal(f.context.reinitializations,0);assert.equal(f.context.tutorRefresh,null);
 const current=reconnectContext();await current.run();
 assert.equal(current.context.flushes,1);assert.equal(current.context.reinitializations,1);
});

test('reconnection retries account progress from a local fallback at home and preserves an open fallback lesson',async()=>{
 const home=reconnectContext({port:null});await home.run();
 assert.equal(home.context.reinitializations,1,'a failed initial life load can recover without choosing a tutor again');
 const lesson=reconnectContext({port:null,panel:'life-lesson'});await lesson.run();
 assert.equal(lesson.context.reinitializations,0,'unscoped in-progress learning is preserved until leaving the lesson');
});

test('visible desktop refocus fetches the latest tutor without requiring a visibility change',async()=>{
 const f=reconnectContext();
 f.focus();await f.context.tutorRefresh;
 assert.equal(f.context.document.hidden,false);assert.equal(f.context.flushes,1);assert.equal(f.context.reinitializations,1);
});

test('duplicate focus events share one refresh and preserve an open cafe while flushing queued selection',async()=>{
 const gate=deferred(),f=reconnectContext({panel:'life-cafe',flush:()=>gate.promise});
 f.focus();f.focus();f.focus();assert.equal(f.context.flushes,1);
 gate.resolve();await f.context.tutorRefresh;
 assert.equal(f.context.reinitializations,0);assert.equal(f.context.tutorRefresh,null);
});

test('refocus does not access account progress for a guest, hidden document or active account command',async()=>{
 for(const blocked of ['guest','hidden','busy']){
  const f=reconnectContext();
  if(blocked==='guest')f.context.client.snapshot=null;
  if(blocked==='hidden')f.context.document.hidden=true;
  if(blocked==='busy')f.context.client.busy=true;
  f.focus();await Promise.resolve();
  assert.equal(f.context.flushes,0,blocked);assert.equal(f.context.reinitializations,0,blocked);
 }
});
