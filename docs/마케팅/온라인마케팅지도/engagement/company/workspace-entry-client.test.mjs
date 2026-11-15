import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('./public/workspace-entry.js', import.meta.url), 'utf8');
const account = 'b425d978-e7c3-4f3e-a276-e73cf011bce3';
const requestId = '7957b996-37a0-4dc4-8eaa-52ab920c62ce';
const generation = 'a78ff7d8-29ec-4e60-8eea-c5a8ba56cbaf';
function fixture(options = {}) {
  const calls = [], renders = [], cancelled = [], receivers = [], window = new EventTarget();
  const forms = options.forms || [];
  if (options.dirty) window.addEventListener('beforeunload', event => event.preventDefault());
  const context = vm.createContext({
    window, Event, AbortController, Promise,
    document: {body: {classList: {contains: () => Boolean(options.modal)}}, querySelectorAll: selector => selector === 'iframe' ? options.frames || [] : forms},
    location: {pathname: '/', search: '', hash: ''},
    state: {user: options.user || null, csrf: 'old-csrf', authMode: 'login', authToken: '', modalRequest: 1},
    companyAuthGeneration: 0, pollTimer: 1, hypePollTimer: 2,
    clearInterval: id => calls.push(['clearInterval', id]),
    isDemoMode: () => Boolean(options.demo),
    fetch: async (url, settings) => {
      calls.push(['fetch', url, settings]);
      return options.response ? options.response() : {ok: true, json: async () => options.me || {user: null, csrfToken: 'read-csrf'}};
    },
    api: () => {throw Error('Native recovery / generic api must not be used');},
    renderAuth: () => renders.push(context.state.authMode), notify: text => calls.push(['notify', text]),
    loadEntryModule: options.loadModule || (async () => ({createCompanyEntryReceiver: hooks => {
      const receiver = {hooks, disposed: false, dispose() { this.disposed = true; }, waitForFirstHandoff: async () => { calls.push(['wait']); return false; }};
      receivers.push(receiver);return receiver;
    }}))
  });
  context.companyAuthSnapshot = () => ({generation: context.companyAuthGeneration, userId: context.state.user?.id || null});
  context.companyAuthCurrent = stamp => stamp.generation === context.companyAuthGeneration && stamp.userId === (context.state.user?.id || null);
  // Only the browser's module loader is synthetic; run the real lifecycle and queue code.
  const runnableSource = source.replace("await import('/pulse-app/entry-handoff.mjs')", 'await loadEntryModule()');
  vm.runInContext(runnableSource + '\n globalThis.entryTest = {queue:queueWorkspaceEntryInvite,cancel:cancelWorkspaceEntryInvite,identityChanged:workspaceEntryIdentityChanged,release:releaseWorkspaceEntryInvite,begin:beginWorkspaceEntryAcceptance,failed:failWorkspaceEntryAcceptance,pending:()=>workspaceEntryPending,prepare:prepareWorkspaceEntryHandoff,receiver:()=>workspaceEntryReceiver,preparing:()=>workspaceEntryPreparing};', context);
  context.cancelRecorder = code => cancelled.push(code);
  if (!options.startWithoutReceiver) vm.runInContext('workspaceEntryReceiver={cancel:cancelRecorder,dispose:()=>cancelRecorder("disposed")};', context);
  const controller = new AbortController();
  const request = {token: 'fixture-invite-not-operating', requestId, accountGeneration: generation, expectedAccountId: account, signal: controller.signal, isCurrent: () => true};
  return {context, entry: context.entryTest, request, controller, calls, renders, cancelled, receivers};
}

test('employee ACK follows the existing join queue and reads only the current company session', async () => {
  const f = fixture({me: {user: {id: 'fixture-employee'}, synkUserId: account, csrfToken: 'new-csrf'}});
  assert.equal((await f.entry.queue(f.request)).queued, true);
  assert.equal(f.context.state.authMode, 'join');
  assert.equal(f.context.state.authToken, f.request.token);
  assert.equal(f.entry.pending().requestId, requestId);
  assert.equal(f.context.state.user.id, 'fixture-employee');
  assert.equal(f.context.state.csrf, 'new-csrf');
  assert.equal(f.renders.length, 1);
  const reads = f.calls.filter(call => call[0] === 'fetch');
  assert.equal(reads.length, 1);
  assert.equal(reads[0][1], '/api/me');
  assert.equal(reads[0][2].body, undefined);
  assert.equal(reads[0][2].method, undefined);
  assert.equal(reads[0][2].credentials, 'same-origin');
  assert.equal(reads[0][2].cache, 'no-store');
});

for (const [name, settings] of Object.entries({
  'an existing draft guard': {dirty: true},
  'an existing modal': {modal: true},
  'an existing child editor iframe': {frames: [{draft: 'keep the child draft'}]},
  'a typed form': {forms: [{elements: [{tagName: 'INPUT', type: 'text', defaultValue: '', value: 'unfinished'}]}]},
  'a selected file': {forms: [{elements: [{tagName: 'INPUT', type: 'file', files: [{}]}]}]}
})) test(name + ' prevents replacing the current workspace', async () => {
  const f = fixture(settings);
  await assert.rejects(f.entry.queue(f.request), {code: 'BUSY'});
  assert.equal(f.calls.length, 0);
  assert.equal(f.entry.pending(), null);
  assert.equal(f.renders.length, 0);
});

test('a different existing SYNK ID does not log out, exchange or replace the company session', async () => {
  const user = {id: 'fixture-existing'};
  const f = fixture({user, me: {user, synkUserId: 'cbe8fd68-e360-49ee-a3a8-a120f7a48805', csrfToken: 'other-csrf'}});
  await assert.rejects(f.entry.queue(f.request), {code: 'ACCOUNT_MISMATCH'});
  assert.equal(f.context.state.user, user);
  assert.equal(f.context.state.csrf, 'old-csrf');
  assert.equal(f.context.state.authToken, '');
  assert.equal(f.entry.pending(), null);
});

test('a login change while /api/me is pending cannot install an old invitation', async () => {
  let resolveRead;
  const f = fixture({response: () => new Promise(resolve => {resolveRead = resolve;})});
  const pending = f.entry.queue(f.request);
  f.context.companyAuthGeneration++;
  f.context.state.user = {id: 'new-account'};
  resolveRead({ok: true, json: async () => ({user: null})});
  await assert.rejects(pending, {code: 'ACCOUNT_CHANGED'});
  assert.equal(f.context.state.user.id, 'new-account');
  assert.equal(f.entry.pending(), null);
  assert.equal(f.renders.length, 0);
});

test('an aborted handoff is checked again after the response body finishes', async () => {
  let finishBody, bodyStarted;
  const started = new Promise(resolve => {bodyStarted = resolve;});
  const f = fixture({response: async () => ({ok: true, json: () => new Promise(resolve => {finishBody = resolve;bodyStarted();})})});
  const pending = f.entry.queue(f.request);
  await started;
  f.controller.abort();
  finishBody({user: null});
  await assert.rejects(pending, {code: 'CANCELLED'});
  assert.equal(f.entry.pending(), null);
});

test('an existing queue cannot be overwritten by another handoff', async () => {
  const f = fixture();
  await f.entry.queue(f.request);
  await assert.rejects(f.entry.queue({...f.request, token: 'other-fixture'}), {code: 'BUSY'});
  assert.equal(f.entry.pending().token, f.request.token);
  assert.equal(f.calls.filter(call => call[0] === 'fetch').length, 1);
});

test('cancellation is bound to the request and retains the company login', async () => {
  const user = {id: 'fixture-current'};
  const f = fixture({user, me: {user, synkUserId: account, csrfToken: 'same-session'}});
  await f.entry.queue(f.request);
  f.entry.cancel({requestId: 'other', accountGeneration: generation});
  assert.ok(f.entry.pending());
  f.entry.cancel({requestId, accountGeneration: generation});
  assert.equal(f.entry.pending(), null);
  assert.equal(f.context.state.authToken, '');
  assert.equal(f.context.state.user.id, user.id);
  assert.equal(f.context.state.csrf, 'same-session');
  assert.deepEqual(f.renders, ['join', 'login']);
});

test('cancellation during an already submitted join does not pretend to undo the request', async () => {
  const f = fixture();
  await f.entry.queue(f.request);
  assert.equal(f.entry.begin(), true);
  f.entry.cancel({requestId, accountGeneration: generation});
  assert.equal(f.context.state.authMode, 'join');
  assert.equal(f.entry.pending().cancelRequested, true);
  assert.deepEqual(f.renders, ['join']);
  f.entry.failed();
  assert.equal(f.entry.pending(), null);
  assert.equal(f.context.state.authMode, 'login');
  assert.deepEqual(f.renders, ['join', 'login']);
});

test('pagehide clears the queued secret even while a join is in flight', async () => {
  const f = fixture();
  await f.entry.queue(f.request);
  f.entry.begin();
  f.context.window.dispatchEvent(new Event('pagehide'));
  assert.equal(f.entry.pending(), null);
  assert.equal(f.context.state.authToken, '');
  assert.deepEqual(f.renders, ['join']);
});

test('identity invalidation clears a queued secret and cancels the matching protocol', async () => {
  const f = fixture();
  await f.entry.queue(f.request);
  f.entry.identityChanged();
  assert.equal(f.entry.pending(), null);
  assert.equal(f.context.state.authToken, '');
  assert.deepEqual(f.cancelled, ['ACCOUNT_CHANGED']);
});

test('successful join releases the handoff reference without rewriting the submitted form', async () => {
  const f = fixture();
  await f.entry.queue(f.request);
  const retained = f.entry.pending();
  f.entry.release();
  assert.equal(f.entry.pending(), null);
  assert.equal(retained.token, '');
  assert.equal(f.context.state.authToken, f.request.token);
  assert.deepEqual(f.cancelled, ['CANCELLED']);
});

for (const body of [null, {}, {user: 'bad'}, {user: []}, {user: {}}]) test('malformed session response cannot acknowledge an invitation: ' + JSON.stringify(body), async () => {
  const f = fixture({response: async () => ({ok: true, json: async () => body})});
  await assert.rejects(f.entry.queue(f.request), {code: 'TEMPORARY_UNAVAILABLE'});
  assert.equal(f.entry.pending(), null);
  assert.equal(f.context.state.authToken, '');
});


function lifecycleEvent(type,persisted){const event=new Event(type);Object.defineProperty(event,'persisted',{value:persisted});return event;}
const flushEntryLifecycle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
for(const consuming of [false,true])test('BFCache restore creates a fresh employee receiver and synchronizes auth after consuming='+consuming,async()=>{
  const user={id:'fixture-retained-user'};const f=fixture({user,me:{user,synkUserId:account,csrfToken:'same-session'}});
  await f.entry.queue(f.request);if(consuming)assert.equal(f.entry.begin(),true);
  f.context.window.synkCompanyEntryHost={version:1};
  f.context.window.dispatchEvent(lifecycleEvent('pagehide',true));
  assert.equal(f.entry.pending(),null);assert.equal(f.context.state.authToken,'');assert.equal(f.context.state.user.id,user.id);assert.equal(f.context.state.csrf,'same-session');assert.equal(f.entry.receiver(),null);
  f.context.window.dispatchEvent(lifecycleEvent('pageshow',true));await flushEntryLifecycle();
  assert.equal(f.receivers.length,1);assert.equal(f.renders.at(-1),'login');assert.equal(f.calls.some(call=>call[0]==='wait'),false,'restored auth must not wait for another handoff');
  assert.equal(f.calls.filter(call=>call[0]==='fetch').length,1,'restoration does not exchange login or read a new session');
  const next={...f.request,requestId:'b8c27842-1c43-45ce-aa20-82df165bf4d1',token:'fixture-second-invite'};
  assert.equal((await f.receivers[0].hooks.queueInvite(next)).queued,true);assert.equal(f.entry.pending().requestId,next.requestId);assert.equal(f.renders.at(-1),'join');
  f.entry.cancel(f.request);assert.equal(f.entry.pending().requestId,next.requestId,'old cancellation cannot erase the fresh queue');
});

test('BFCache restoration preserves unrelated employee form state and does not recreate on duplicate pageshow',async()=>{
  const field={tagName:'INPUT',type:'text',defaultValue:'',value:'keep this draft'};const f=fixture({forms:[{elements:[field]}]});
  f.context.window.dispatchEvent(lifecycleEvent('pagehide',true));f.context.window.dispatchEvent(lifecycleEvent('pageshow',true));await flushEntryLifecycle();
  f.context.window.dispatchEvent(lifecycleEvent('pageshow',true));await flushEntryLifecycle();
  assert.equal(f.receivers.length,1);assert.equal(field.value,'keep this draft');assert.deepEqual(f.renders,[]);assert.equal(f.calls.filter(call=>call[0]==='fetch').length,0);
  await assert.rejects(f.receivers[0].hooks.queueInvite(f.request),{code:'BUSY'});
});

test('a normal page unload does not recreate an employee receiver on an unrelated pageshow',async()=>{
  const f=fixture();f.context.window.dispatchEvent(lifecycleEvent('pagehide',false));f.context.window.dispatchEvent(lifecycleEvent('pageshow',true));await flushEntryLifecycle();
  assert.equal(f.receivers.length,0);assert.equal(f.entry.receiver(),null);
});

test('an old module import cannot replace or change preparation state of a restored receiver',async()=>{
  let firstResolve,secondResolve,loads=0,created=0;
  const first=new Promise(resolve=>firstResolve=resolve),second=new Promise(resolve=>secondResolve=resolve);
  const f=fixture({startWithoutReceiver:true,loadModule:()=>++loads===1?first:second});
  const initial=f.entry.prepare();f.context.window.dispatchEvent(lifecycleEvent('pagehide',true));f.context.window.dispatchEvent(lifecycleEvent('pageshow',true));
  const receiver={dispose(){},waitForFirstHandoff:async()=>false};const module={createCompanyEntryReceiver:()=>{created++;return receiver;}};
  secondResolve(module);await flushEntryLifecycle();assert.equal(f.entry.receiver(),receiver);assert.equal(f.entry.preparing(),false);
  firstResolve(module);assert.equal(await initial,false);assert.equal(created,1);assert.equal(f.entry.receiver(),receiver);assert.equal(f.entry.preparing(),false);
});
