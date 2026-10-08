import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const context=vm.createContext({crypto:webcrypto,TextEncoder,setTimeout,clearTimeout});
vm.runInContext(readFileSync(new URL('./public/workroom-practice-sync.js',import.meta.url),'utf8'),context);
const {create,digest}=context.SynkShiftPracticeSync;
const clone=value=>JSON.parse(JSON.stringify(value));
const work=text=>({version:1,save:false,profile:{scope:{personId:'a'}},run:{prompt:text,draft:text},history:[]});
const empty=()=>({version:1,save:false,profile:null,run:null,history:[]});
function server(){
  let record={revision:0,status:'empty',updatedAt:null,state:null};const calls=[];
  return {calls,get record(){return record;},set record(value){record=clone(value);},async request(body){
    calls.push(body?clone(body):null);if(!body)return clone(record);
    if(body.expectedRevision!==record.revision)throw Object.assign(new Error('Conflict'),{status:409,current:clone(record)});
    if(body.action==='save'){
      if(record.status!=='active'&&!body.activate)throw Object.assign(new Error('Deleted'),{status:409,current:clone(record)});
      record={revision:record.revision+1,status:'active',updatedAt:new Date().toISOString(),state:clone(body.state)};
    }else record={revision:record.revision+1,status:'deleted',updatedAt:new Date().toISOString(),state:null};return clone(record);
  }};
}
function client(remote,value=empty(),meta={}){
  let local=clone(value),saved=meta,active=true,allow=true;const notices=[],applied=[];
  const sync=create({read:()=>local,apply:next=>{applied.push(clone(next));local={...clone(next),save:local.save};},request:body=>remote.request(body),loadMeta:()=>saved,saveMeta:next=>saved=clone(next),current:()=>active,canApply:()=>allow,onChange:next=>notices.push(next)});
  return {sync,notices,applied,get value(){return local;},set value(next){local=clone(next);},get meta(){return saved;},set active(next){active=next;},set allow(next){allow=next;}};
}
test('sync starts off and does not read or upload remote practice without explicit opt-in',async()=>{
  const s=server(),c=client(s,work('private'));await c.sync.resume();await c.sync.refresh();c.sync.changed();
  assert.equal(s.calls.length,0);assert.equal(c.sync.view().enabled,false);assert.deepEqual(c.meta,{});c.sync.dispose();
});
test('opt-in before the first profile waits and only the first actual practice activates a record',async()=>{
  const s=server(),c=client(s);await c.sync.enable();assert.equal(s.calls.length,1);assert.equal(c.sync.view().phase,'waiting');
  const reload=client(s,empty(),c.meta);await reload.sync.resume();assert.equal(reload.sync.view().enabled,true);assert.equal(reload.sync.view().phase,'waiting');reload.value=work('first');await reload.sync.refresh();assert.equal(s.record.status,'active');assert.equal(s.record.state.run.prompt,'first');assert.equal(s.calls.at(-1).activate,true);c.sync.dispose();reload.sync.dispose();
});
test('a second device pulls the same account practice and keeps its independent local-storage choice off',async()=>{
  const s=server(),a=client(s,work('A to B'));await a.sync.enable();const b=client(s);await b.sync.enable();
  assert.equal(b.value.run.prompt,'A to B');assert.equal(b.value.save,false);assert.equal(b.applied.length,1);assert.equal(s.record.revision,1);a.sync.dispose();b.sync.dispose();
});
test('offline edits remain intact and reconnect through the last acknowledged revision',async()=>{
  const s=server(),c=client(s,work('base'));await c.sync.enable();const original=s.request;s.request=async()=>{throw new Error('Offline');};
  c.value=work('offline writing');await c.sync.refresh();assert.equal(c.value.run.prompt,'offline writing');assert.equal(c.sync.view().phase,'offline');assert.equal(c.meta.revision,1);
  s.request=original;await c.sync.refresh();assert.equal(s.record.state.run.prompt,'offline writing');assert.equal(s.record.revision,2);c.sync.dispose();
});
test('divergent drafts require a visible choice and selecting remote re-checks that offered revision',async()=>{
  const s=server(),a=client(s,work('base'));await a.sync.enable();const b=client(s);await b.sync.enable();
  a.value=work('device A changed');await a.sync.refresh();b.value=work('device B changed');await b.sync.refresh();
  assert.equal(b.sync.view().phase,'conflict');assert.equal(b.value.run.prompt,'device B changed');assert.equal(s.record.state.run.prompt,'device A changed');
  await b.sync.choose('remote');assert.equal(b.value.run.prompt,'device A changed');assert.equal(s.record.revision,2);a.sync.dispose();b.sync.dispose();
});
test('selecting local replaces only the revision offered in conflict and handles a new 409 without overwrite',async()=>{
  const s=server(),a=client(s,work('base'));await a.sync.enable();const b=client(s);await b.sync.enable();
  a.value=work('A1');await a.sync.refresh();b.value=work('B1');await b.sync.refresh();
  a.value=work('A2');await a.sync.refresh();await b.sync.choose('local');assert.equal(b.sync.view().phase,'conflict');assert.equal(s.record.state.run.prompt,'A2');assert.equal(b.value.run.prompt,'B1');
  await b.sync.choose('local');assert.equal(s.record.state.run.prompt,'B1');a.sync.dispose();b.sync.dispose();
});
test('remote deletion blocks automatic re-upload from an old device and a reloaded stale opt-in',async()=>{
  const s=server(),a=client(s,work('base'));await a.sync.enable();const b=client(s);await b.sync.enable();const staleMeta=b.meta;
  assert.equal(await a.sync.remove(),true);b.value=work('old device draft');await b.sync.refresh();
  assert.equal(b.sync.view().enabled,false);assert.equal(b.sync.view().phase,'deleted');assert.equal(b.value.run.prompt,'old device draft');assert.equal(s.record.state,null);
  b.sync.changed();await b.sync.refresh();assert.equal(s.record.status,'deleted');const reload=client(s,work('saved old draft'),staleMeta);await reload.sync.resume();assert.equal(reload.sync.view().phase,'deleted');assert.equal(s.record.status,'deleted');
  await b.sync.choose('local');assert.equal(s.record.status,'active');assert.equal(s.record.state.run.prompt,'old device draft');assert.equal(s.calls.at(-1).activate,true);a.sync.dispose();b.sync.dispose();reload.sync.dispose();
});
test('deletion cannot silently remove a newer unseen draft',async()=>{
  const s=server(),a=client(s,work('base'));await a.sync.enable();const b=client(s);await b.sync.enable();a.value=work('new revision');await a.sync.refresh();
  assert.equal(await b.sync.remove(),false);assert.equal(s.record.state.run.prompt,'new revision');assert.equal(b.sync.view().phase,'conflict');a.sync.dispose();b.sync.dispose();
});
test('late GET responses after logout or account switching never apply or write metadata',async()=>{
  const s=server();s.record={revision:1,status:'active',updatedAt:new Date().toISOString(),state:work('old account')};let finish;s.request=()=>new Promise(resolve=>finish=resolve);
  const c=client(s);const pending=c.sync.enable(),before=c.meta;c.active=false;c.sync.dispose();finish(s.record);await pending;
  assert.equal(c.value.profile,null);assert.equal(c.applied.length,0);assert.deepEqual(c.meta,before);
});
test('turning sync off during a pending response discards the response and preserves the draft',async()=>{
  const s=server();let finish;s.request=()=>new Promise(resolve=>finish=resolve);const c=client(s,work('local'));const pending=c.sync.enable();c.sync.disable();finish({revision:1,status:'active',state:work('remote')});await pending;
  assert.equal(c.sync.view().phase,'off');assert.equal(c.sync.view().busy,false);assert.equal(c.value.run.prompt,'local');assert.equal(c.sync.view().revision,0);c.sync.dispose();
});
test('incoming remote updates during active editing are offered without replacing the editor',async()=>{
  const s=server(),a=client(s,work('base'));await a.sync.enable();const b=client(s);await b.sync.enable();a.value=work('updated remotely');await a.sync.refresh();b.allow=false;await b.sync.refresh();
  assert.equal(b.value.run.prompt,'base');assert.equal(b.sync.view().conflict.type,'incoming');assert.equal(b.applied.length,1);a.sync.dispose();b.sync.dispose();
});
test('remote choice detects a later deletion and preserves the local draft',async()=>{
  const s=server(),a=client(s,work('base'));await a.sync.enable();const b=client(s);await b.sync.enable();a.value=work('A changed');await a.sync.refresh();b.value=work('B changed');await b.sync.refresh();
  assert.equal(await a.sync.remove(),true);await b.sync.choose('remote');assert.equal(b.value.run.prompt,'B changed');assert.equal(b.sync.view().phase,'deleted');a.sync.dispose();b.sync.dispose();
});
test('baseline fingerprints ignore local storage opt-in and use all draft content',async()=>{
  const value=work('한글 작성물');assert.equal(await digest(value),await digest({...value,save:true}));assert.notEqual(await digest(value),await digest(work('다른 작성물')));assert.match(await digest(value),/^[a-f0-9]{64}$/);
  assert.equal(await digest(value),await digest({history:[],run:{draft:'한글 작성물',prompt:'한글 작성물'},profile:{scope:{personId:'a'}},save:true,version:1}));
});
function delayedDigestFactory(pauseAt){
  let calls=0,release,paused;const ready=new Promise(resolve=>paused=resolve),timers=new Map();let nextTimer=0;
  const isolated=vm.createContext({TextEncoder,crypto:{subtle:{async digest(...args){const hashed=await webcrypto.subtle.digest(...args);if(++calls===pauseAt){paused();await new Promise(resolve=>release=resolve);}return hashed;}}},setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(readFileSync(new URL('./public/workroom-practice-sync.js',import.meta.url),'utf8'),isolated);return {create:isolated.SynkShiftPracticeSync.create,ready,timers,release:()=>release()};
}
test('an edit during the adopted baseline hash schedules a follow-up upload instead of losing dirty status',async()=>{
  const s=server();s.record={revision:1,status:'active',updatedAt:new Date().toISOString(),state:work('remote')};const gate=delayedDigestFactory(3);let value=empty(),meta={};
  const sync=gate.create({read:()=>value,apply:next=>value={...clone(next),save:false},request:body=>s.request(body),loadMeta:()=>meta,saveMeta:next=>meta=next,current:()=>true});
  const initial=sync.enable();await gate.ready;value.run.prompt='typed during adoption';sync.changed();gate.release();await initial;
  assert.equal(value.run.prompt,'typed during adoption');assert.equal(gate.timers.size,1);await sync.refresh();assert.equal(s.record.state.run.prompt,'typed during adoption');sync.dispose();
});
test('an edit during the incoming hash is preserved and requires a choice before the remote state is applied',async()=>{
  const s=server();s.record={revision:1,status:'active',updatedAt:new Date().toISOString(),state:work('remote')};const gate=delayedDigestFactory(2);let value=empty(),meta={},applies=0;
  const sync=gate.create({read:()=>value,apply:next=>{applies++;value=clone(next);},request:body=>s.request(body),loadMeta:()=>meta,saveMeta:next=>meta=next,current:()=>true});
  const initial=sync.enable();await gate.ready;value=work('typed while checking');sync.changed();gate.release();await initial;
  assert.equal(applies,0);assert.equal(value.run.prompt,'typed while checking');assert.equal(sync.view().phase,'conflict');sync.dispose();
});
test('new typing while re-checking an explicit remote choice prevents replacing the new local text',async()=>{
  const s=server(),a=client(s,work('base'));await a.sync.enable();const b=client(s);await b.sync.enable();a.value=work('remote changed');await a.sync.refresh();b.value=work('local changed');await b.sync.refresh();
  let finish;const selected=clone(s.record);s.request=()=>new Promise(resolve=>finish=resolve);const pending=b.sync.choose('remote');b.value=work('typed after choosing remote');b.sync.changed();finish(selected);await pending;
  assert.equal(b.value.run.prompt,'typed after choosing remote');assert.equal(b.sync.view().phase,'conflict');assert.equal(b.sync.view().conflict.type,'incoming');a.sync.dispose();b.sync.dispose();
});
test('new typing while checking deletion prevents sending the deletion request',async()=>{
  const s=server(),c=client(s,work('base'));await c.sync.enable();let finish;const selected=clone(s.record);s.request=()=>new Promise(resolve=>finish=resolve);
  const pending=c.sync.remove();c.value=work('typed while checking deletion');c.sync.changed();finish(selected);assert.equal(await pending,false);assert.equal(s.record.status,'active');assert.equal(c.value.run.prompt,'typed while checking deletion');assert.equal(c.sync.view().phase,'conflict');c.sync.dispose();
});
test('new typing during an accepted deletion remains local and is never automatically uploaded',async()=>{
  const s=server(),c=client(s,work('base'));await c.sync.enable();let finish,hit;const sent=new Promise(resolve=>hit=resolve),gate=new Promise(resolve=>finish=resolve),request=s.request;
  s.request=async body=>{const result=await request(body);if(body?.action==='delete'){hit();await gate;}return result;};
  const pending=c.sync.remove();await sent;c.value=work('typed during server deletion');c.sync.changed();finish();assert.equal(await pending,false);
  assert.equal(s.record.status,'deleted');assert.equal(s.record.state,null);assert.equal(c.value.run.prompt,'typed during server deletion');assert.equal(c.sync.view().enabled,false);assert.match(c.sync.view().message,/새로 작성한 내용은 이 창에 유지/);await c.sync.refresh();assert.equal(s.record.status,'deleted');c.sync.dispose();
});
test('invalid or oversized server responses explain the repair and preserve the current draft',async()=>{
  for(const [status,message] of [[400,'저장된 실습 조건을 확인해 주세요.'],[413,'실습 기록이 너무 큽니다. 작성물을 내려받아 주세요.']]){
    const s=server(),c=client(s,work('preserved writing'));await c.sync.enable();const request=s.request;s.request=async body=>{if(body)throw Object.assign(new Error(message),{status});return request(body);};
    c.value=work('a new preserved writing');await c.sync.refresh();assert.match(c.sync.view().message,new RegExp(message));assert.match(c.sync.view().message,/작성 중인 내용은 이 창에 유지/);assert.equal(c.value.run.prompt,'a new preserved writing');c.sync.dispose();
  }
});
