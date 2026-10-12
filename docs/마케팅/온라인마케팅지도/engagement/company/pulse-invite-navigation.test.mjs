import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseInvite} from './public/pulse-app/api.mjs';

const source=await readFile(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
const navigation=source.slice(source.indexOf('// Reused PWA windows'),source.indexOf('function resetContext('));
assert.ok(navigation.includes('function queueInviteNavigation()'));
const resetContextSource=source.slice(source.indexOf('function resetContext('),source.indexOf('function accept('));
assert.ok(resetContextSource.startsWith('function resetContext('));
const closeListener=source.split('\n').find(line=>line.startsWith("dialog.addEventListener('close',()=>{if(inviteNavigationPrompt"));
assert.ok(closeListener);
const first='test_first_invite_12345',second='test_second_invite_67890';
function setup(){
  const microtasks=[],opened=[],notices=[],closeHandlers=[];
  const location={hash:'',pathname:'/pulse-app/',search:'',assign:url=>opened.push(url)};
  const context=vm.createContext({URLSearchParams,parseInvite,location,queueMicrotask:fn=>microtasks.push(fn),
    history:{replaceState:(_state,_title,url)=>{location.hash='';assert.equal(url,'/pulse-app/');}},
    notice:message=>notices.push(message),dialog:{open:false,addEventListener:(_name,fn)=>closeHandlers.push(fn)},
    openDialog:()=>{context.dialog.open=true;},closeDialog:()=>{context.dialog.open=false;},production:{reset:()=>{}},render:()=>{},start:invite=>opened.push(invite)});
  vm.runInContext(`let pendingInvite='',inviteNavigationPrompt=false,inviteNavigationScheduled=false;
let busy=false,loading=false,composing=false,epoch=0,leaveAction;
let pendingInitialScene='',live=null,liveIdentity='',liveSnapshot=null,deviceState=null,deviceOperation=0,deviceRefresh=0,deviceBusy=false,pendingRemote=null;
const drafts=new Map(),s={mode:'customer',project:{id:'old'},user:null,workspace:null,csrf:'old',live:{deviceBusy:false}},demo=null;
function setBusy(value){busy=value;if(!value)scheduleInviteNavigation();}
${resetContextSource}
${navigation}
${closeListener}
globalThis.state=()=>({pending:!!pendingInvite,prompt:inviteNavigationPrompt,epoch,drafts:drafts.size,project:s.project?.id});
globalThis.flags=values=>{if('busy'in values)busy=values.busy;if('loading'in values)loading=values.loading;if('composing'in values)composing=values.composing;};
globalThis.addDraft=()=>drafts.set('feedback',{text:'keep my draft'});
globalThis.confirm=()=>{drafts.clear();dialog.open=false;const next=leaveAction;leaveAction=null;next?.();};`,context);
  const flush=()=>{let count=0;while(microtasks.length){assert.ok(++count<30);microtasks.shift()();}};
  const receive=invite=>{location.hash='#invite='+encodeURIComponent(invite);context.queueInviteNavigation();flush();};
  const close=()=>{context.dialog.open=false;for(const fn of closeHandlers)fn();flush();};
  return {context,opened,notices,location,flush,receive,close,lateCloseEvent:()=>{for(const fn of closeHandlers)fn();flush();},state:()=>context.state()};
}

test('a new same-document invite switches customer context once and immediately removes the capability from the URL',()=>{
  const h=setup();h.receive(first);
  assert.deepEqual(h.opened,[first]);assert.equal(h.location.hash,'');assert.equal(h.state().epoch,1);assert.equal(h.state().project,undefined);assert.equal(h.state().pending,false);
});

test('an invite waits for each busy/loading/composition boundary without losing the token',()=>{
  for(const flag of ['busy','loading','composing']){
    const h=setup();h.context.flags({[flag]:true});h.receive(first);
    assert.equal(h.opened.length,0);assert.equal(h.state().pending,true);assert.equal(h.location.hash,'');assert.equal(h.state().epoch,0);
    h.context.flags({[flag]:false});h.context.scheduleInviteNavigation();h.flush();
    assert.deepEqual(h.opened,[first]);assert.equal(h.state().epoch,1);
  }
});

test('cancelling the existing leave confirmation preserves the old project and draft',()=>{
  const h=setup();h.context.addDraft();h.receive(first);
  assert.equal(h.state().prompt,true);assert.equal(h.opened.length,0);assert.equal(h.state().epoch,0);
  h.close();h.context.scheduleInviteNavigation();h.flush();
  assert.equal(h.state().drafts,1);assert.equal(h.state().project,'old');assert.equal(h.state().epoch,0);assert.equal(h.state().pending,false);assert.equal(h.opened.length,0);
});

test('confirming the existing leave dialog clears drafts only when switching projects',()=>{
  const h=setup();h.context.addDraft();h.receive(first);h.context.confirm();h.close();
  assert.deepEqual(h.opened,[first]);assert.equal(h.state().drafts,0);assert.equal(h.state().epoch,1);assert.equal(h.state().pending,false);
});

test('a newer invite replaces an older waiting link without duplicate requests',()=>{
  const h=setup();h.context.flags({loading:true});h.receive(first);h.receive(second);
  h.context.flags({loading:false});h.context.scheduleInviteNavigation();h.context.scheduleInviteNavigation();h.flush();
  assert.deepEqual(h.opened,[second]);assert.equal(h.state().epoch,1);assert.equal(h.location.hash,'');assert.ok(h.notices.length>=1);
});

test('an unrelated open dialog defers the invitation until it closes',()=>{
  const h=setup();h.context.dialog.open=true;h.receive(first);assert.equal(h.opened.length,0);
  h.close();assert.deepEqual(h.opened,[first]);
});

test('a late close event from an earlier dialog cannot cancel a newly opened leave confirmation',()=>{
  const h=setup();h.context.addDraft();h.receive(first);h.lateCloseEvent();
  assert.equal(h.state().prompt,true);assert.equal(h.state().pending,true);assert.equal(h.state().drafts,1);
  h.context.confirm();h.close();assert.deepEqual(h.opened,[first]);
});

test('reset/logout/expiry cancel a queued invitation so it cannot reopen after closing the connection',()=>{
  const h=setup();h.context.flags({busy:true});h.receive(first);h.context.resetContext();
  h.context.flags({busy:false});h.context.scheduleInviteNavigation();h.flush();
  assert.equal(h.opened.length,0);assert.equal(h.state().pending,false);
  assert.equal(h.state().epoch,1);assert.equal(h.state().project,undefined);
});

test('an incoming customer cookie refresh does not discard an explicitly queued newer invitation',()=>{
  const h=setup();h.context.flags({loading:true});h.receive(first);h.context.resetContext({preserveInvite:true});
  assert.equal(h.state().pending,true);assert.equal(h.opened.length,0);assert.equal(h.state().epoch,1);
  h.context.flags({loading:false});h.context.scheduleInviteNavigation();h.flush();
  assert.deepEqual(h.opened,[first]);assert.equal(h.state().pending,false);
  assert.match(source,/result\.project\?\.id!==s\.project\.id\)\{resetContext\(\{preserveInvite:true\}\)/);
});

test('an invalid invitation is removed from the address without changing the active project',()=>{
  const h=setup();h.receive('invalid');assert.equal(h.location.hash,'');assert.equal(h.state().project,'old');assert.equal(h.state().epoch,0);assert.equal(h.opened.length,0);assert.ok(h.notices.length);
});

test('all current loading completions and busy completion retry queued navigation',()=>{
  assert.equal((source.match(/finally\{loading=false;scheduleInviteNavigation\(\);\}/g)||[]).length,4);
  assert.match(source,/if\(!value\)\{scheduleApply\(\);scheduleInviteNavigation\(\);\}/);
  assert.match(source,/window\.addEventListener\('hashchange',queueInviteNavigation\)/);
  assert.match(source,/document\.addEventListener\('compositionend',scheduleInviteNavigation\)/);
});
