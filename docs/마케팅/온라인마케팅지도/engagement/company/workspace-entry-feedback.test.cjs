'use strict';
// Actual entry modules in an isolated memory fixture. No sockets or production data.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const receiverSource = read('public/pulse-app/entry-handoff.mjs');
const employeeSource = read('public/workspace-entry.js');
const entrySource = read('public/entry/entry.mjs');
const ORIGIN = 'https://workspace.synk.im', HOST = 'https://synk.im';
const DOC = '11111111-1111-4111-8111-111111111111';
const REQUEST = '22222222-2222-4222-8222-222222222222';
const GENERATION = '33333333-3333-4333-8333-333333333333';
const ACCOUNT = '44444444-4444-4444-8444-444444444444';
const OTHER = '55555555-5555-4555-8555-555555555555';
const TOKEN = 'synthetic-memory-only-invitation';
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; }

function fixture(role = 'employee', options = {}) {
  const sent = [], calls = [], notices = [], renders = [], nodes = new Map(), listeners = new Map(), timers = new Map(), attrs = new Map();
  let clock = 0, timerId = 0, context;
  function element() {
    const handlers = new Map();
    return {hidden: false, textContent: '', href: '', target: '', children: [],
      get childElementCount() { return this.children.length; },
      append(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
      addEventListener(type, handler) { handlers.set(type, handler); },
      activate(event = {}) { handlers.get('click')?.({button: 0, defaultPrevented: false, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...event}); }
    };
  }
  const document = {
    documentElement: {setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k)},
    body: {classList: {contains: () => false}},
    querySelectorAll: selector => selector === 'iframe' ? options.frames || [] : options.forms || [],
    getElementById: id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    createElement: () => element()
  };
  const opener = {postMessage: (value, origin) => sent.push({peer: 'web', value, origin})};
  const win = {document, opener: options.opener === false ? null : opener,
    location: {href: ORIGIN + (role === 'employee' ? '/' : '/entry/'), replace: value => calls.push(['navigate', value])},
    crypto: {randomUUID: () => DOC}, performance: {now: () => clock}, AbortController,
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    dispatchEvent(event) { for (const handler of [...listeners.get(event.type) || []]) handler(event); return !event.defaultPrevented; },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, {at: clock + delay, fn}); return id; },
    clearTimeout(id) { timers.delete(id); },
    postMessage: (value, origin) => sent.push({peer: 'native', value, origin})
  };
  win.top = win;
  if (options.native) win.synkCompanyEntryHost = {version: 1};
  for (const key of ['name', 'localStorage', 'sessionStorage']) Object.defineProperty(win, key, {get() {throw Error('Secret persistence forbidden');}, set() {throw Error('Secret persistence forbidden');}});
  const realm = value => vm.runInContext('(' + JSON.stringify(value) + ')', context);
  const me = options.me || {user: {id: 'synthetic-staff'}, synkUserId: ACCOUNT, csrfToken: 'synthetic-csrf'};
  const fetch = async (url, settings) => {
    calls.push(['fetch', url, settings]);
    if (options.pendingMe && url === '/api/me') await options.pendingMe.promise;
    const data = url === '/api/me' ? me : options.assignment || {version: 1, accountMatch: true, workspace: {state: 'assigned', destination: '/'}, pulse: {state: 'assigned', destination: '/pulse-app/'}};
    return {ok: options.status === undefined || options.status === 200, status: options.status ?? 200, json: async () => realm(data)};
  };
  win.fetch = fetch;
  context = vm.createContext({window: win, document, URL, Event, AbortController, fetch,
    location: {pathname: role === 'employee' ? '/' : '/entry/', search: '', hash: ''},
    state: {user: {id: 'synthetic-staff'}, csrf: 'old-csrf', authMode: 'login', authToken: '', modalRequest: 1},
    companyAuthGeneration: 0, pollTimer: 1, hypePollTimer: 2,
    clearInterval: id => calls.push(['clearInterval', id]), isDemoMode: () => false,
    notify: message => notices.push({message, at: clock, preparing: context.entry?.preparing()}),
    renderAuth: () => renders.push(context.state.authMode), api: () => {throw Error('Unexpected generic API');}
  });
  context.companyAuthSnapshot = () => ({generation: context.companyAuthGeneration, userId: context.state.user?.id || null});
  context.companyAuthCurrent = stamp => stamp.generation === context.companyAuthGeneration && stamp.userId === (context.state.user?.id || null);
  // Only the module-loader boundary is adapted. Actual receiver code and object
  // validation run in the same VM realm as the application and message values.
  vm.runInContext(receiverSource.replace('export function createCompanyEntryReceiver', 'function createCompanyEntryReceiver'), context);
  context.loadEntryModule = async () => ({createCompanyEntryReceiver: context.createCompanyEntryReceiver});
  if (role === 'employee') vm.runInContext(employeeSource.replace("await import('/pulse-app/entry-handoff.mjs')", 'await loadEntryModule()') + '\n globalThis.entry={prepare:prepareWorkspaceEntryHandoff,pending:()=>workspaceEntryPending,preparing:()=>workspaceEntryPreparing,release:releaseWorkspaceEntryInvite,begin:beginWorkspaceEntryAcceptance,failed:failWorkspaceEntryAcceptance};', context);
  else vm.runInContext(entrySource.replace(/^import[^\n]+\n/, ''), context);
  const packet = (type, extra = {}) => realm({channel: 'synk.company.entry', version: 1, type, requestId: REQUEST, accountGeneration: GENERATION, documentId: DOC, ...extra});
  const dispatch = (data, {source = opener, origin = HOST} = {}) => {for (const handler of [...listeners.get('message') || []]) handler({data, source, origin});};
  const bind = (extra = {}, peer = 'web') => dispatch(packet('bind', {phase: role === 'employee' ? 'deliver' : 'resolve', expectedAccountId: ACCOUNT, ...extra}), peer === 'native' ? {source: win, origin: ORIGIN} : {});
  const offer = (extra = {}, peer = 'web') => dispatch(packet('offer', {token: TOKEN, ...extra}), peer === 'native' ? {source: win, origin: ORIGIN} : {});
  const advance = ms => {
    const end = clock + ms;
    for (;;) {const due = [...timers].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; clock = due[1].at; timers.delete(due[0]); due[1].fn();}
    clock = end;
  };
  return {win, opener, context, nodes, calls, notices, sent, renders, timers, attrs, listeners, packet, dispatch, bind, offer, advance,
    entry: context.entry, replies: type => sent.filter(x => x.value.type === type),
    pagehide: persisted => win.dispatchEvent({type: 'pagehide', persisted}),
    pageshow: persisted => win.dispatchEvent({type: 'pageshow', persisted})};
}
async function preparing(options = {}) {
  const f = fixture('employee', options); f.done = f.entry.prepare(); await flush(); return f;
}
async function queued(options = {}) {
  const f = await preparing(options); f.bind(); f.offer(); await flush(); assert.equal(await f.done, true); assert.equal(f.replies('received').length, 1); return f;
}
async function assignment(options = {}) {const f = fixture('receiver', options); f.bind(); await flush(); return f;}

for (const kind of ['primary mouse', 'keyboard']) test('F1: manual Workspace ' + kind + ' does not create a fifteen-second employee startup wait', async t => {
  const f = await assignment(); const link = f.nodes.get('entry-links').children.find(x => x.href === '/');
  link.activate({detail: kind === 'keyboard' ? 0 : 1});
  const employee = await preparing({opener: Boolean(f.win.opener)}); let done = false; employee.done.then(() => {done = true;}); await flush();
  const atZero = done; employee.advance(14999); await flush(); const at14999 = done;
  employee.advance(1); await flush(); const at15000 = done;
  t.diagnostic(JSON.stringify({openerCleared:f.win.opener===null,employeePreparationResolved:{atZero,at14999,at15000}}));
  assert.equal(f.win.opener, null); assert.equal(atZero, true); assert.equal(employee.timers.size, 0); assert.equal(employee.replies('ready').length, 1);
});
for (const event of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}, {defaultPrevented: true}]) test('F1: original popup opener survives modified activation ' + JSON.stringify(event), async () => {
  const f = await assignment(); f.nodes.get('entry-links').children.find(x => x.href === '/').activate(event); assert.equal(f.win.opener, f.opener);
});
test('F1: target=_blank does not alter the original popup peer', async () => {
  const f = await assignment(); const link = f.nodes.get('entry-links').children.find(x => x.href === '/'); link.target = '_blank'; link.activate(); assert.equal(f.win.opener, f.opener);
});
test('F1: login-required PULSE link retains the existing rebind opener', async () => {
  const f = await assignment({status: 401}); assert.equal(f.nodes.get('entry-links').children.length, 1); const link = f.nodes.get('entry-links').children[0]; assert.equal(link.href, '/pulse-app/'); link.activate(); assert.equal(f.win.opener, f.opener);
});
test('F1: standalone entry already shows links immediately without wait timers', () => {
  const f = fixture('receiver', {opener: false}); assert.equal(f.nodes.get('entry-links').children.length, 2); assert.equal(f.timers.size, 0);
});
test('F1: unresolved sender hint still waits fifteen seconds and remains a documented limitation', async () => {
  const f = await preparing({opener: false, native: true}); let done = false; f.done.then(() => {done = true;}); f.advance(14999); await flush(); assert.equal(done, false); f.advance(1); await flush(); assert.equal(done, true); assert.equal(f.notices.length, 0);
});
test('F1: automatic classify keeps its opener and original destination', async () => {
  const f = fixture('receiver'); f.win.fetch = async () => ({ok: true, status: 200, json: async () => vm.runInContext('({version:1,kind:"employee",destination:"/"})', f.context)});
  f.bind({phase: 'classify', expectedAccountId: null}); f.offer(); await flush(); assert.equal(f.win.opener, f.opener); assert.deepEqual(f.calls.filter(x => x[0] === 'navigate'), [['navigate', '/']]);
});

for (const scenario of ['account mismatch', 'HTTP error', 'malformed session']) test('F2: preparing bound ' + scenario + ' announces once while retaining session and queue', async () => {
  const options = scenario === 'account mismatch' ? {me: {user: {id: 'synthetic-staff'}, synkUserId: OTHER}} : scenario === 'HTTP error' ? {status: 500} : {me: {user: 'invalid'}};
  const f = await preparing(options); f.bind(); f.offer(); await flush(); assert.equal(await f.done, false);
  assert.equal(f.context.state.user.id, 'synthetic-staff'); assert.equal(f.context.state.csrf, 'old-csrf'); assert.equal(f.context.state.authToken, ''); assert.equal(f.entry.pending(), null); assert.equal(f.replies('received').length, 0);
  assert.equal(f.replies('error').length, 1); assert.equal(f.timers.size, 0); assert.equal(f.notices.length, 1); assert.equal(f.notices[0].preparing, true);
});
test('F2: a bound offer timeout is visible and a no-bind timeout is quiet', async () => {
  const f = await preparing(); f.bind(); f.advance(15000); await flush(); assert.equal(await f.done, false); assert.equal(f.notices.length, 1);
  const g = await preparing(); g.advance(15000); await flush(); assert.equal(await g.done, false); assert.equal(g.notices.length, 0);
});
test('F2: received external cancel announces once and preserves existing login', async () => {
  const f = await queued(); f.dispatch(f.packet('cancel')); await flush(); assert.equal(f.entry.pending(), null); assert.equal(f.context.state.authMode, 'login'); assert.equal(f.context.state.authToken, ''); assert.equal(f.context.state.user.id, 'synthetic-staff'); assert.equal(f.context.state.csrf, 'synthetic-csrf'); assert.deepEqual(f.renders, ['login']); assert.equal(f.notices.length, 1);
  f.dispatch(f.packet('cancel')); await flush(); assert.equal(f.notices.length, 1);
});
test('F2: local normal release and login switch do not announce sender cancellation', async () => {
  const f = await queued(); f.entry.release(); assert.equal(f.entry.pending(), null); assert.equal(f.notices.length, 0); assert.equal(f.context.state.user.id, 'synthetic-staff');
});
test('F2: consuming cancel waits for failed join before announcing queue cleanup', async () => {
  const f = await queued(); assert.equal(f.entry.begin(), true); f.dispatch(f.packet('cancel')); await flush(); assert.equal(f.notices.length, 0); assert.equal(f.entry.pending().cancelRequested, true); assert.equal(f.context.state.authMode, 'join');
  f.entry.failed(); assert.equal(f.entry.pending(), null); assert.equal(f.context.state.authMode, 'login'); assert.equal(f.notices.length, 1); f.entry.failed(); assert.equal(f.notices.length, 1);
});
test('F2: consuming cancel does not claim a successful submitted join was undone', async () => {
  const f = await queued(); f.entry.begin(); f.dispatch(f.packet('cancel')); await flush(); assert.equal(f.notices.length, 0); assert.equal(f.entry.pending().consuming, true);
  f.entry.release(); assert.equal(f.entry.pending(), null); assert.equal(f.notices.length, 0);
});
test('F2: pagehide discards deferred cancellation notice and BFCache restores a clean receiver', async () => {
  const f = await queued(); f.entry.begin(); f.dispatch(f.packet('cancel')); f.pagehide(true); assert.equal(f.entry.pending(), null); assert.equal(f.notices.length, 0); f.pageshow(true); await flush(); assert.equal(f.notices.length, 0); assert.equal(f.context.state.authMode, 'login'); assert.equal(f.replies('ready').length, 4);
});
test('F2: cancelled pending queue cannot ACK or announce again when its read completes late', async () => {
  const hold = deferred(); const f = await preparing({pendingMe: hold}); f.bind(); f.offer(); await flush(); f.dispatch(f.packet('cancel')); await flush(); assert.equal(await f.done, false); assert.equal(f.notices.length, 1); hold.resolve(); await flush(); assert.equal(f.entry.pending(), null); assert.equal(f.replies('received').length, 0); assert.equal(f.notices.length, 1);
});
test('F2: old cancel and foreign generation have no notice or queue effect on a fresh request', async () => {
  const f = await queued(); f.entry.release(); f.bind({requestId: OTHER}); f.offer({requestId: OTHER}); await flush(); assert.equal(f.entry.pending().requestId, OTHER); const notices = f.notices.length;
  f.dispatch(f.packet('cancel')); f.dispatch(f.packet('cancel', {requestId: OTHER, accountGeneration: OTHER})); await flush(); assert.equal(f.entry.pending().requestId, OTHER); assert.equal(f.notices.length, notices);
});
test('F2: a fresh request can report its own error after a previous error', async () => {
  const f = await preparing({status: 500}); f.bind(); f.offer(); await flush(); assert.equal(f.notices.length, 1); f.bind({requestId: OTHER}); f.offer({requestId: OTHER}); await flush(); assert.equal(f.notices.length, 2);
});
test('unchanged message guards reject wrong origin and document before session reads', async () => {
  const f = await preparing(); const packet = f.packet('bind', {phase: 'deliver', expectedAccountId: ACCOUNT}); f.dispatch(packet, {origin: 'https://wrong.invalid'}); f.dispatch(f.packet('bind', {phase: 'deliver', expectedAccountId: ACCOUNT, documentId: OTHER})); f.offer(); await flush(); assert.equal(f.calls.length, 0); assert.equal(f.notices.length, 0); assert.equal(f.entry.pending(), null);
});
test('unchanged iframe guard protects its draft while explaining actual BUSY', async () => {
  const frame = {draft: 'synthetic retained draft'}; const f = await preparing({frames: [frame]}); f.bind(); f.offer(); await flush(); assert.equal(f.replies('error')[0].value.code, 'BUSY'); assert.equal(f.calls.length, 0); assert.equal(frame.draft, 'synthetic retained draft'); assert.equal(f.entry.pending(), null); assert.equal(f.notices.length, 1);
});
