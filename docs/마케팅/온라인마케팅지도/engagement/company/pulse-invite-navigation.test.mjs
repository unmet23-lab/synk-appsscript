import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseInvite} from './public/pulse-app/api.mjs';
// 초대 이동 원문만 vm에 넣으므로 번역 틀의 진짜 함수를 맥락에 넣는다(다국어 판 2).
import {t,k,locale} from './public/pulse-app/i18n.mjs';

const source=await readFile(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
const navigation=source.slice(source.indexOf('// Reused PWA windows'),source.indexOf('function resetContext('));
assert.ok(navigation.includes('function queueInviteNavigation()'));
const resetContextSource=source.slice(source.indexOf('function resetContext('),source.indexOf('function accept('));
assert.ok(resetContextSource.startsWith('function resetContext('));
const closeListener=source.split('\n').find(line=>line.startsWith("dialog.addEventListener('close',()=>{if(inviteNavigationPrompt"));
assert.ok(closeListener);
const leaveConfirm=source.split('\n').find(line=>line.trimStart().startsWith("if(action==='leave-confirm')"));
assert.ok(leaveConfirm);
const entryLifecycle=source.slice(source.indexOf('\nconnectPulseEntryReceiver();'),source.indexOf('\nif(filmDemo)void openFilmDemo();'));
assert.ok(entryLifecycle.includes("window.addEventListener('pageshow'"));
const first='test_first_invite_12345',second='test_second_invite_67890';
function setup(){
  const microtasks=[],opened=[],notices=[],closeHandlers=[],receivers=[],window=new EventTarget();
  const location={hash:'',pathname:'/pulse-app/',search:'',assign:url=>opened.push(url)};
  const context=vm.createContext({t,k,locale,URLSearchParams,parseInvite,location,window,queueMicrotask:fn=>microtasks.push(fn),
    createCompanyEntryReceiver:hooks=>{const receiver={hooks,disposed:false,dispose(){this.disposed=true;}};receivers.push(receiver);return receiver;},
    history:{replaceState:(_state,_title,url)=>{location.hash='';assert.equal(url,'/pulse-app/');}},
    notice:message=>notices.push(message),dialog:{open:false,addEventListener:(_name,fn)=>closeHandlers.push(fn)},
    openDialog:()=>{context.dialog.open=true;},closeDialog:()=>{context.dialog.open=false;},production:{reset:()=>{}},render:()=>{},start:invite=>opened.push(invite)});
  vm.runInContext(`let pendingInvite='',inviteNavigationPrompt=false,inviteNavigationScheduled=false;
${source.match(/^let pendingInviteRequest=.*$/m)[0]}
let busy=false,loading=false,composing=false,epoch=0,leaveAction;
let pendingInitialScene='',live=null,liveIdentity='',liveSnapshot=null,deviceState=null,deviceOperation=0,deviceRefresh=0,deviceBusy=false,pendingRemote=null;
const drafts=new Map(),s={mode:'customer',project:{id:'old'},user:null,workspace:null,csrf:'old',live:{deviceBusy:false}},demo=null;
function setBusy(value){busy=value;if(!value)scheduleInviteNavigation();}
${resetContextSource}
${navigation}
${closeListener}
${entryLifecycle}
globalThis.state=()=>({pending:!!pendingInvite,prompt:inviteNavigationPrompt,epoch,drafts:drafts.size,project:s.project?.id});
globalThis.flags=values=>{if('busy'in values)busy=values.busy;if('loading'in values)loading=values.loading;if('composing'in values)composing=values.composing;};
globalThis.addDraft=()=>drafts.set('feedback',{text:'keep my draft'});
globalThis.confirm=()=>{const action='leave-confirm';${leaveConfirm}};`,context);
  const flush=()=>{let count=0;while(microtasks.length){assert.ok(++count<30);microtasks.shift()();}};
  const receive=invite=>{location.hash='#invite='+encodeURIComponent(invite);context.queueInviteNavigation();flush();};
  const close=()=>{context.dialog.open=false;for(const fn of closeHandlers)fn();flush();};
  return {context,opened,notices,location,window,receivers,flush,receive,close,lateCloseEvent:()=>{for(const fn of closeHandlers)fn();flush();},state:()=>context.state()};
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
  assert.equal((source.match(/finally\{(?:if\(moveEpoch===epoch\)\{)?loading=false;scheduleInviteNavigation\(\);/g)||[]).length,4);
  assert.match(source,/if\(!value\)\{scheduleApply\(\);scheduleInviteNavigation\(\);\}/);
  assert.match(source,/window\.addEventListener\('hashchange',queueInviteNavigation\)/);
  assert.match(source,/document\.addEventListener\('compositionend',scheduleInviteNavigation\)/);
});

const entryRequest=token=>({token,requestId:'17734551-0d78-497e-b922-897aceec8ed7',accountGeneration:'07ce94b4-afca-4f93-9ed7-f1d92e30a749',signal:new AbortController().signal,isCurrent:()=>true});

test('memory handoff ACK follows the real pending queue and never places the token in a URL',()=>{
 const h=setup(),incoming=entryRequest(first);
 assert.equal(h.context.queuePulseEntryInvite(incoming).queued,true);
 assert.equal(h.state().pending,true);assert.equal(h.opened.length,0);assert.equal(h.location.hash,'');
 h.flush();assert.deepEqual(h.opened,[first]);assert.equal(h.state().epoch,1);assert.equal(h.location.hash,'');
});

test('memory handoff retains all busy/loading/composition/dialog boundaries',()=>{
 for(const flag of ['busy','loading','composing','dialog']){
  const h=setup();if(flag==='dialog')h.context.dialog.open=true;else h.context.flags({[flag]:true});
  assert.equal(h.context.queuePulseEntryInvite(entryRequest(first)).queued,true);h.flush();
  assert.equal(h.opened.length,0);assert.equal(h.state().pending,true);assert.equal(h.state().project,'old');
  if(flag==='dialog')h.close();else{h.context.flags({[flag]:false});h.context.scheduleInviteNavigation();h.flush();}
  assert.deepEqual(h.opened,[first]);assert.equal(h.location.hash,'');
 }
});

test('memory handoff uses the existing dirty draft confirmation and preserves a cancelled draft',()=>{
 const h=setup();h.context.addDraft();h.context.queuePulseEntryInvite(entryRequest(first));h.flush();
 assert.equal(h.state().prompt,true);assert.equal(h.state().drafts,1);assert.equal(h.opened.length,0);
 h.close();assert.equal(h.state().drafts,1);assert.equal(h.state().project,'old');assert.equal(h.state().pending,false);
});

test('a legacy hash cannot overwrite an in-flight memory handoff',()=>{
 const h=setup();h.context.flags({loading:true});h.context.queuePulseEntryInvite(entryRequest(first));h.receive(second);
 h.context.flags({loading:false});h.context.scheduleInviteNavigation();h.flush();
 assert.deepEqual(h.opened,[first]);assert.equal(h.location.hash,'');
});

test('a second memory offer cannot replace an existing legacy or memory queue',()=>{
 for(const kind of ['legacy','memory']){
  const h=setup();h.context.flags({busy:true});if(kind==='legacy')h.receive(first);else h.context.queuePulseEntryInvite(entryRequest(first));
  assert.throws(()=>h.context.queuePulseEntryInvite(entryRequest(second)),{code:'BUSY'});
  h.context.flags({busy:false});h.context.scheduleInviteNavigation();h.flush();assert.deepEqual(h.opened,[first]);
 }
});

test('cancel only clears the matching memory request and never the active project',()=>{
 const h=setup(),incoming=entryRequest(first);h.context.flags({busy:true});h.context.queuePulseEntryInvite(incoming);
 h.context.cancelPulseEntryInvite({...incoming,accountGeneration:'other'});assert.equal(h.state().pending,true);
 h.context.cancelPulseEntryInvite(incoming);h.context.flags({busy:false});h.context.scheduleInviteNavigation();h.flush();
 assert.equal(h.state().pending,false);assert.equal(h.state().project,'old');assert.equal(h.opened.length,0);
});

test('remote cancellation closes its leave dialog and a stale confirm cannot discard the draft',()=>{
 const h=setup(),incoming=entryRequest(first);h.context.addDraft();
 h.context.queuePulseEntryInvite(incoming);h.flush();assert.equal(h.context.dialog.open,true);
 h.context.cancelPulseEntryInvite(incoming);
 assert.equal(h.context.dialog.open,false);assert.equal(h.state().prompt,false);assert.equal(h.state().pending,false);
 h.context.confirm();h.lateCloseEvent();
 assert.equal(h.state().drafts,1);assert.equal(h.state().project,'old');assert.equal(h.state().epoch,0);assert.deepEqual(h.opened,[]);
});

test('remote cancellation does not close an unrelated existing dialog',()=>{
 const h=setup(),incoming=entryRequest(first);h.context.dialog.open=true;h.context.addDraft();
 h.context.queuePulseEntryInvite(incoming);h.flush();h.context.cancelPulseEntryInvite(incoming);
 assert.equal(h.context.dialog.open,true);assert.equal(h.state().drafts,1);assert.equal(h.state().project,'old');
 h.close();assert.deepEqual(h.opened,[]);
});

test('a different request cannot cancel the current leave confirmation',()=>{
 const h=setup(),incoming=entryRequest(first);h.context.addDraft();h.context.queuePulseEntryInvite(incoming);h.flush();
 h.context.cancelPulseEntryInvite({...incoming,requestId:'another-request'});
 assert.equal(h.context.dialog.open,true);assert.equal(h.state().pending,true);
 h.context.confirm();h.close();assert.deepEqual(h.opened,[first]);assert.equal(h.state().drafts,0);
});

test('aborted, stale and malformed memory offers never enter the pending queue',()=>{
 const controller=new AbortController();controller.abort();
 for(const incoming of [{...entryRequest(first),signal:controller.signal},{...entryRequest(first),isCurrent:()=>false},entryRequest('invalid'),entryRequest('https://workspace.synk.im/pulse-app/#invite='+first)]){
  const h=setup();assert.throws(()=>h.context.queuePulseEntryInvite(incoming));h.flush();assert.equal(h.state().pending,false);assert.equal(h.opened.length,0);
 }
});

test('a memory offer cannot turn a staff document into a token URL',()=>{
 const h=setup();vm.runInContext("s.mode='staff'",h.context);
 assert.throws(()=>h.context.queuePulseEntryInvite(entryRequest(first)),{code:'HANDOFF_UNAVAILABLE'});
 h.flush();assert.deepEqual(h.opened,[]);assert.equal(h.location.hash,'');
});


function pulseLifecycleEvent(type,persisted){const event=new Event(type);Object.defineProperty(event,'persisted',{value:persisted});return event;}
test('BFCache restores a fresh PULSE receiver while keeping the existing draft and project',()=>{
  const h=setup(),old=h.receivers[0],firstRequest=entryRequest(first);h.context.addDraft();h.context.queuePulseEntryInvite(firstRequest);h.flush();assert.equal(h.state().prompt,true);
  h.window.dispatchEvent(pulseLifecycleEvent('pagehide',true));assert.equal(old.disposed,true);assert.equal(h.state().pending,false);assert.equal(h.state().drafts,1);assert.equal(h.state().project,'old');
  h.window.dispatchEvent(pulseLifecycleEvent('pageshow',true));assert.equal(h.receivers.length,2);assert.equal(h.receivers[1].disposed,false);assert.deepEqual(h.opened,[]);
  const next={...entryRequest(second),requestId:'b8c27842-1c43-45ce-aa20-82df165bf4d1'};
  assert.equal(h.receivers[1].hooks.queueInvite(next).queued,true);h.flush();assert.equal(h.state().prompt,true);assert.equal(h.state().drafts,1);
  old.hooks.cancelInvite(firstRequest);assert.equal(h.state().pending,true);assert.equal(h.state().prompt,true);assert.equal(h.state().drafts,1);
  h.close();assert.equal(h.state().pending,false);assert.equal(h.state().drafts,1);assert.equal(h.state().project,'old');assert.deepEqual(h.opened,[]);
});

test('duplicate PULSE pageshow cannot replace a fresh receiver or its pending queue',()=>{
  const h=setup();h.window.dispatchEvent(pulseLifecycleEvent('pagehide',true));h.window.dispatchEvent(pulseLifecycleEvent('pageshow',true));
  h.context.flags({busy:true});h.receivers[1].hooks.queueInvite(entryRequest(first));h.window.dispatchEvent(pulseLifecycleEvent('pageshow',true));
  assert.equal(h.receivers.length,2);assert.equal(h.state().pending,true);assert.equal(h.receivers[1].disposed,false);
  h.context.flags({busy:false});h.context.scheduleInviteNavigation();h.flush();assert.deepEqual(h.opened,[first]);
});

test('normal PULSE unload stays disposed and does not reopen its invitation',()=>{
  const h=setup();h.context.flags({busy:true});h.context.queuePulseEntryInvite(entryRequest(first));h.window.dispatchEvent(pulseLifecycleEvent('pagehide',false));
  h.window.dispatchEvent(pulseLifecycleEvent('pageshow',true));h.context.flags({busy:false});h.context.scheduleInviteNavigation();h.flush();
  assert.equal(h.receivers.length,1);assert.equal(h.receivers[0].disposed,true);assert.equal(h.state().pending,false);assert.deepEqual(h.opened,[]);
});
