import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDocumentSync } from '../synk-account/src/document-sync.mjs';
import { createPathDocument } from './document.mjs';
import { renderAccountNotice, renderAccountPanel, getAccountErrorMessage } from './account-ui.mjs';

// The public packager serves the shared account modules beside account.mjs.
// Resolve only those import URLs for Node; execute the unmodified controller
// body with the real shared document-sync implementation and no network.
const sharedImports = {
  './product-account.mjs': '../synk-account/src/product-account.mjs',
  './document-sync.mjs': '../synk-account/src/document-sync.mjs',
};
const source = (await readFile(new URL('./account.mjs', import.meta.url), 'utf8'))
  .replace(/from (['"])(\.[^'"]+)\1/g, (_match, _quote, name) => `from ${JSON.stringify(new URL(sharedImports[name] || name, import.meta.url).href)}`);
const { createPathSession, GUEST_KEY, LEGACY_KEY, ACCOUNT_CACHE_PREFIX } = await import(
  'data:text/javascript;base64,' + Buffer.from(source + '\n//# sourceURL=path-account-controller-under-test.mjs').toString('base64'));

const clone = value => structuredClone(value);
const stamp = '2026-11-10T00:00:00.000Z';
const error = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settled() { for (let i = 0; i < 12; i++) await tick(); }
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); }
  assert.ok(predicate(), 'asynchronous controller state did not settle');
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function document(label = '', lang = 'ko') {
  const doc = createPathDocument(lang);
  if (label) Object.assign(doc.state, {
    onboarded: true, primaryGoal: 'job', location: 'korea', revision: 1, savedAt: stamp,
    tasks: [{ id: 'job-demo-job-a', goal: 'job', sourceId: 'demo-job-a', body: label, confirmedAt: null, updatedAt: stamp }],
  });
  return doc;
}
function edited(doc, label) {
  const next = clone(doc.state);
  Object.assign(next, document(label).state, { revision: next.revision + 1 });
  return next;
}
const body = doc => doc?.state?.tasks?.[0]?.body ?? '';
function memoryStorage(entries = []) {
  const data = new Map(entries), writes = [], removals = [];
  return {
    data, writes, removals, failRead: false, failWrite: false, failRemove: false,
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { if (this.failRead) throw error('STORAGE_READ'); return data.get(key) ?? null; },
    setItem(key, raw) { if (this.failWrite) throw error('STORAGE_WRITE'); writes.push({ key, raw }); data.set(key, String(raw)); },
    removeItem(key) { if (this.failRemove) throw error('STORAGE_REMOVE'); removals.push(key); data.delete(key); },
  };
}
const pendingFor = (storage, owner) => [...storage.data].filter(([key, raw]) => {
  if (!key.startsWith(ACCOUNT_CACHE_PREFIX)) return false;
  try { const record = JSON.parse(raw); return record.accountId === owner && record.pending === true; } catch { return false; }
});

function fixture(t, { storage = memoryStorage(), owner = null, rows = {}, intercept, syncFactory, config = {} } = {}) {
  const documents = [], statuses = [], calls = [], remotes = new Map(Object.entries(rows).map(([id, row]) => [id, clone(row)]));
  let currentOwner = owner, accountOptions, syncOptions, signIns = 0, signOuts = 0;
  const accountStatus = () => ({ configured: true, signedIn: !!currentOwner, accountId: currentOwner, status: currentOwner ? 'signed-in' : 'signed-out' });
  const emitOwner = id => { currentOwner = id; accountOptions.onStatus(accountStatus()); };
  const reply = id => ({ ok: true, scope: 'synk-path', resource: 'path-app', accountId: id,
    updatedAt: stamp, ...clone(remotes.get(id) || { revision: 0, state: null }) });
  const accountFactory = options => {
    accountOptions = options;
    return {
      start: async () => { options.onStatus(accountStatus()); return accountStatus(); },
      status: accountStatus,
      signIn: async () => { signIns++; },
      signOut: async () => { signOuts++; emitOwner(null); },
      dispose() {},
      request: async (operation, values = {}) => {
        const id = currentOwner;
        if (!id) throw error('AUTH_REQUIRED');
        calls.push({ owner: id, operation, values: clone(values) });
        const proceed = () => {
          if (operation === 'pathLoad') return reply(id);
          assert.equal(operation, 'pathSave', 'controller must never delete account data');
          const prior = remotes.get(id) || { revision: 0, state: null };
          if (values.expected_revision !== prior.revision) throw error('REVISION_CONFLICT', { revision: prior.revision });
          remotes.set(id, { revision: prior.revision + 1, state: clone(values.state) });
          return reply(id);
        };
        return intercept ? intercept({ operation, values, owner: id, proceed, reply: () => reply(id) }) : proceed();
      },
    };
  };
  const session = createPathSession({ storage, lang: 'ko', now: () => new Date(stamp), accountFactory,
    syncFactory: options => { syncOptions = options; return (syncFactory || createDocumentSync)(options); },
    fetcher: async () => ({ ok: true, json: async () => clone(config) }),
    onDocument: value => documents.push(clone(value)), onStatus: value => statuses.push(clone(value)),
  });
  t.after(() => session.dispose());
  return { session, storage, documents, statuses, calls, remotes, emitOwner, reply,
    accountOptions: () => accountOptions, syncOptions: () => syncOptions,
    signIns: () => signIns, signOuts: () => signOuts,
    async start() { await session.init(); await settled(); return session.status(); },
  };
}

test('guest legacy migration retains original bytes and uses the fixed account contract without implicit import', async t => {
  const legacy = JSON.stringify(document('legacy guest', 'en').state), storage = memoryStorage([[LEGACY_KEY, legacy]]);
  const f = fixture(t, { storage });
  assert.deepEqual(f.documents, []); assert.deepEqual(f.statuses, []);
  assert.equal(storage.getItem(LEGACY_KEY), legacy);
  assert.equal(body(JSON.parse(storage.getItem(GUEST_KEY))), 'legacy guest');
  await f.start();
  assert.equal(body(f.session.document()), 'legacy guest'); assert.equal(f.session.document().state.lang, 'en');
  assert.equal(f.session.status().canEdit, true); assert.equal(f.calls.length, 0);
  const options = f.accountOptions();
  for (const [key, value] of Object.entries({ clientKey: 'path-app', endpoint: 'synk-path', scope: 'synk-path', resource: 'path-app', configUrl: './config.json' })) assert.equal(options[key], value);
  assert.deepEqual(options.operations, { load: 'pathLoad', save: 'pathSave', delete: 'pathDelete' });
  f.emitOwner('A'); await until(() => f.session.status().loaded);
  assert.equal(body(f.session.document()), ''); assert.equal(f.calls.filter(row => row.operation === 'pathSave').length, 0);
  assert.equal(f.session.status().canImportGuest, true); assert.equal(storage.getItem(LEGACY_KEY), legacy);
});

test('real product-account fetches the supplied public config URL exactly once without an invented account-config endpoint', async t => {
  const requests = [], location = 'https://synk.im/path/app/';
  const publicConfig = { version: 1, supabaseUrl: 'https://synthetic.supabase.co', accountApiUrl: 'https://synthetic.supabase.co',
    supabasePublishableKey: 'sb_publishable_synthetic_only', portalUrl: 'https://synk.im/id/',
    clients: { 'path-app': { clientId: 'synthetic-path-browser', redirectUri: location } },
    authorizationClients: [{ product: 'platform', clientId: 'synthetic-path-browser', redirectUris: [location] }] };
  const session = createPathSession({ storage: memoryStorage(), lang: 'ko', configUrl: './public-account.json',
    fetcher: async (input, options = {}) => {
      const url = new URL(input, location).href; requests.push({ url, options });
      return { ok: url === location + 'public-account.json', status: url === location + 'public-account.json' ? 200 : 404, json: async () => clone(publicConfig) };
    },
    accountOptions: { getUrl: () => location, replaceUrl() {}, navigate() {} },
  });
  t.after(() => session.dispose()); await session.init();
  assert.equal(session.status().configured, true); assert.equal(session.status().signedIn, false);
  assert.deepEqual(requests.map(row => row.url), [location + 'public-account.json']);
  assert.equal(requests[0].options.credentials, 'omit'); assert.equal(requests[0].options.redirect, 'error');
  assert.ok(requests[0].options.signal instanceof AbortSignal);
});

test('real product-account reauthentication of the same native owner reloads the document across its session generation', async t => {
  let generation = 1, authChanged, stored = document('before reauthentication'), loads = 0;
  const identity = () => ({ configured: true, signedIn: true, status: 'signed-in', account: { synk_user_id: 'A' }, sessionGeneration: generation });
  const bridge = {
    getEnvironment: async () => ({ clientId: 'path-app' }), authStatus: async () => identity(),
    onAuthChanged: callback => { authChanged = callback; return () => {}; },
    request: async operation => {
      assert.equal(operation, 'pathLoad'); loads++;
      return { ok: true, scope: 'synk-path', resource: 'path-app', accountId: 'A', revision: generation, updatedAt: stamp, state: clone(stored) };
    },
  };
  const session = createPathSession({ storage: memoryStorage(), lang: 'ko',
    fetcher: async () => ({ ok: true, json: async () => ({ version: 1 }) }), accountOptions: { bridge },
  });
  t.after(() => session.dispose()); await session.init(); await until(() => session.status().loaded);
  assert.equal(body(session.document()), 'before reauthentication'); const before = loads;
  stored = document('after reauthentication'); generation = 2; authChanged(identity());
  await until(() => session.status().loaded && body(session.document()) === 'after reauthentication');
  assert.ok(loads > before); assert.equal(session.status().accountId, 'A'); assert.equal(session.status().canEdit, true);
});

for (const [name, key, raw] of [
  ['malformed guest JSON', GUEST_KEY, '{"raw": unfinished'],
  ['future guest document', GUEST_KEY, JSON.stringify({ ...document('future'), version: 2, newField: 'preserve' })],
  ['malformed guest schema', GUEST_KEY, JSON.stringify({ ...document('bad'), savedJobs: 'bad' })],
  ['malformed legacy JSON', LEGACY_KEY, '{"schemaVersion":'],
  ['future legacy state', LEGACY_KEY, JSON.stringify({ ...document('future legacy').state, schemaVersion: 2 })],
]) test(`${name} stays byte-identical, blocked and exportable`, async t => {
  const storage = memoryStorage([[key, raw]]), f = fixture(t, { storage }); await f.start();
  assert.equal(f.session.status().guestBlocked, true); assert.equal(f.session.status().canEdit, false);
  assert.equal(f.session.exportGuest().raw, raw); assert.equal(f.session.exportGuest().valid, false);
  assert.throws(() => f.session.updateState(document('replace').state), { code: 'GUEST_WRITE_BLOCKED' });
  assert.equal(await f.session.retry(), false); assert.equal(storage.getItem(key), raw); assert.equal(storage.writes.length, 0);
  f.emitOwner('A'); await until(() => f.session.status().loaded);
  assert.equal(await f.session.importGuest(), false); assert.equal(f.calls.filter(row => row.operation === 'pathSave').length, 0);
});

test('guest storage failure retains the memory draft, blocks sign-in and recovers only after a verified write', async t => {
  const f = fixture(t); await f.start(); f.storage.failWrite = true;
  assert.throws(() => f.session.updateState(document('unsaved guest').state), { code: 'LOCAL_STORAGE_UNAVAILABLE' });
  assert.equal(f.session.status().pending, true); assert.equal(f.session.status().canEdit, false);
  assert.equal(body(f.session.exportCurrent().document), 'unsaved guest');
  assert.equal(await f.session.signIn(), false); assert.equal(f.signIns(), 0);
  f.storage.failWrite = false; assert.equal(await f.session.retry(), true);
  assert.equal(body(JSON.parse(f.storage.getItem(GUEST_KEY))), 'unsaved guest');
  assert.equal(f.session.status().pending, false); assert.equal(f.session.status().canEdit, true);
  assert.equal(await f.session.signIn(), true); assert.equal(f.signIns(), 1);
});

for (const revision of [0, 7]) test(`guest import requires empty remote and saves with observed revision ${revision}`, async t => {
  const guest = document('import me'), raw = JSON.stringify(guest), storage = memoryStorage([[GUEST_KEY, raw]]);
  const f = fixture(t, { storage, owner: 'A', rows: { A: { revision, state: null } } }); await f.start();
  assert.equal(f.session.status().canImportGuest, true); assert.equal(body(f.session.document()), '');
  assert.equal(f.calls.filter(row => row.operation === 'pathSave').length, 0);
  assert.equal(await f.session.importGuest(), true);
  const save = f.calls.find(row => row.operation === 'pathSave');
  assert.equal(save.values.expected_revision, revision); assert.equal(body(save.values.state), 'import me');
  assert.equal(f.remotes.get('A').revision, revision + 1); assert.equal(f.session.status().pending, false);
  assert.equal(f.session.status().canImportGuest, false); assert.equal(storage.getItem(GUEST_KEY), raw);
  assert.equal(await f.session.importGuest(), false);
});

test('nonempty remote, failed load and future remote document never enable import or destructive writes', async t => {
  for (const variant of ['nonempty', 'offline', 'future']) {
    const raw = JSON.stringify(document('guest kept')), storage = memoryStorage([[GUEST_KEY, raw]]);
    const state = variant === 'future' ? { ...document('future remote'), version: 2 } : document('remote kept');
    const f = fixture(t, { storage, owner: 'A', rows: { A: { revision: 3, state } },
      intercept: ({ proceed }) => { if (variant === 'offline') throw error('NETWORK', { retryable: true }); return proceed(); } });
    await f.start();
    assert.equal(f.session.status().canImportGuest, false); assert.equal(await f.session.importGuest(), false);
    assert.equal(f.calls.filter(row => row.operation === 'pathSave').length, 0); assert.equal(storage.getItem(GUEST_KEY), raw);
    if (variant === 'nonempty') assert.equal(body(f.session.document()), 'remote kept');
    else {
      assert.equal(f.session.status().loaded, false); assert.equal(f.session.status().canEdit, false); assert.equal(f.session.document(), null);
      assert.throws(() => f.session.updateState(document('forbidden').state), { code: 'ACCOUNT_NOT_LOADED' });
    }
  }
});

test('import CAS conflict preserves guest, account draft and competing remote with no forced-overwrite API', async t => {
  const raw = JSON.stringify(document('guest draft')), storage = memoryStorage([[GUEST_KEY, raw]]);
  const f = fixture(t, { storage, owner: 'A' }); await f.start();
  f.remotes.set('A', { revision: 1, state: document('other device') });
  assert.equal(await f.session.importGuest(), false);
  assert.equal(f.session.status().syncStatus, 'conflict'); assert.equal(f.session.status().pending, true);
  assert.equal(body(f.session.exportCurrent().document), 'guest draft'); assert.equal(storage.getItem(GUEST_KEY), raw);
  assert.equal(body((await f.session.exportRemote()).state), 'other device');
  assert.equal(f.session.resolveLocal, undefined);
  const recovery = f.session.exportRecovery();
  assert.equal(recovery.accountId, 'A'); assert.ok(recovery.entries.some(row => body(JSON.parse(row.raw).state) === 'guest draft'));
  assert.equal(await f.session.useRemote(), true); assert.equal(body(f.session.document()), 'other device');
  assert.ok(f.session.exportRecovery().entries.some(row => body(JSON.parse(row.raw).state) === 'guest draft'));
  assert.equal(f.calls.filter(row => row.operation === 'pathSave').length, 1);
});

test('account switch and logout hide prior documents and keep recovery records restricted to their owner', async t => {
  const storage = memoryStorage([[GUEST_KEY, JSON.stringify(document('original guest'))]]);
  const f = fixture(t, { storage, owner: 'A', rows: { A: { revision: 2, state: document('A remote') }, B: { revision: 8, state: document('B remote') } },
    intercept: ({ operation, proceed }) => { if (operation === 'pathSave') throw error('NETWORK'); return proceed(); } });
  await f.start(); f.session.updateState(edited(f.session.document(), 'A private draft')); assert.equal(await f.session.retry(), false);
  const originalPending = clone(pendingFor(storage, 'A')); assert.ok(originalPending.length);
  const boundary = f.documents.length; f.emitOwner('B');
  assert.equal(f.session.document(), null); assert.equal(f.session.status().canEdit, false);
  await until(() => f.session.status().loaded);
  assert.equal(body(f.session.document()), 'B remote'); assert.equal(f.session.exportRecovery().accountId, 'B');
  assert.equal(f.session.exportRecovery().entries.length, 0); assert.deepEqual(pendingFor(storage, 'A'), originalPending);
  assert.equal(f.documents.slice(boundary).some(value => body(value).startsWith('A ')), false);
  assert.equal(await f.session.signOut(), true); assert.equal(body(f.session.document()), 'original guest');
  assert.equal(f.session.status().signedIn, false); assert.equal(f.session.status().accountId, null);
  assert.deepEqual(pendingFor(storage, 'A'), originalPending);
  assert.throws(() => f.session.exportRecovery());
});

test('late old-account load cannot replace the new account or enable import against its nonempty state', async t => {
  const gate = deferred(), entered = deferred();
  const f = fixture(t, { owner: 'A', storage: memoryStorage([[GUEST_KEY, JSON.stringify(document('guest'))]]), rows: { B: { revision: 9, state: document('B only') } },
    intercept: async ({ owner, operation, proceed, reply }) => {
      if (owner === 'A' && operation === 'pathLoad') { entered.resolve(); await gate.promise; return reply(); }
      return proceed();
    } });
  t.after(() => gate.resolve()); await f.session.init(); await entered.promise;
  assert.equal(f.session.document(), null); f.emitOwner('B'); await until(() => f.session.status().loaded);
  gate.resolve(); await settled();
  assert.equal(f.session.status().accountId, 'B'); assert.equal(body(f.session.document()), 'B only');
  assert.equal(f.session.status().canImportGuest, false); assert.equal(await f.session.importGuest(), false);
});

test('late old-account save acknowledgement does not clear its pending backup or replace the new account', async t => {
  const gate = deferred(), entered = deferred();
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: document('A remote') }, B: { revision: 6, state: document('B remote') } },
    intercept: async ({ owner, operation, proceed }) => {
      if (owner === 'A' && operation === 'pathSave') { const response = proceed(); entered.resolve(); await gate.promise; return response; }
      return proceed();
    } });
  t.after(() => gate.resolve()); await f.start();
  f.session.updateState(edited(f.session.document(), 'A pending acknowledgement'));
  const flushing = f.session.retry(); await entered.promise; const pending = clone(pendingFor(f.storage, 'A'));
  f.emitOwner('B'); await until(() => f.session.status().loaded); gate.resolve(); await flushing; await settled();
  assert.equal(body(f.session.document()), 'B remote'); assert.deepEqual(pendingFor(f.storage, 'A'), pending);
  assert.equal(f.session.status().pending, false); assert.equal(f.session.exportRecovery().accountId, 'B');
});

test('account persistence failure is visible and its in-memory draft remains exportable', async t => {
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: document('remote') } } }); await f.start();
  f.storage.failWrite = true; f.session.updateState(edited(f.session.document(), 'memory only'));
  assert.equal(f.session.status().syncStatus, 'storage-error'); assert.equal(f.session.status().pending, true);
  assert.equal(f.session.status().canEdit, false); assert.equal(body(f.session.exportCurrent().document), 'memory only');
  assert.equal(pendingFor(f.storage, 'A').length, 0); assert.equal(body(f.remotes.get('A').state), 'remote');
});

test('a failed first account load remains locked until a successful explicit retry', async t => {
  let offline = true;
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 5, state: document('loaded after retry') } },
    intercept: ({ proceed }) => { if (offline) throw error('NETWORK', { retryable: true }); return proceed(); } });
  await f.start(); assert.equal(f.session.document(), null); assert.equal(f.session.status().canEdit, false);
  assert.throws(() => f.session.updateState(document('must not save').state), { code: 'ACCOUNT_NOT_LOADED' });
  offline = false; assert.equal(await f.session.retry(), true);
  assert.equal(f.session.status().loaded, true); assert.equal(f.session.status().canEdit, true);
  assert.equal(body(f.session.document()), 'loaded after retry'); assert.equal(f.calls.filter(row => row.operation === 'pathSave').length, 0);
});

test('lost save acknowledgement stays pending and retries the same CAS until the server confirms it idempotently', async t => {
  let loseAcknowledgement = true;
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 3, state: document('before') } },
    intercept: ({ operation, values, proceed, reply }) => {
      if (operation !== 'pathSave') return proceed();
      if (loseAcknowledgement) { loseAcknowledgement = false; proceed(); throw error('NETWORK'); }
      const current = reply();
      assert.equal(values.expected_revision, 3);
      assert.equal(current.revision, 4); assert.deepEqual(current.state, values.state);
      return current; // real PATH service's same-data lost-ACK contract
    } });
  await f.start(); f.session.updateState(edited(f.session.document(), 'saved but not acknowledged'));
  assert.equal(await f.session.retry(), false); assert.equal(f.session.status().pending, true);
  assert.equal(body(f.session.document()), 'saved but not acknowledged'); assert.ok(pendingFor(f.storage, 'A').length);
  assert.equal(await f.session.retry(), true); assert.equal(f.session.status().pending, false);
  assert.equal(f.remotes.get('A').revision, 4); assert.equal(pendingFor(f.storage, 'A').length, 0);
  assert.deepEqual(f.calls.filter(row => row.operation === 'pathSave').map(row => row.values.expected_revision), [3, 3]);
});

test('logout refuses to discard the only copy of an account draft when local persistence failed', async t => {
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: document('remote') } } }); await f.start();
  f.storage.failWrite = true; f.session.updateState(edited(f.session.document(), 'only unsaved copy'));
  assert.equal(await f.session.signOut(), false);
  assert.equal(f.signOuts(), 0); assert.equal(body(f.session.exportCurrent().document), 'only unsaved copy');
  assert.equal(await f.session.signOut(), false, 'reading an export does not confirm that a backup was kept');
  assert.equal(f.signOuts(), 0); assert.equal(f.session.status().backupConfirmed, false);
  assert.equal(f.session.status().accountId, 'A');
});

test('only explicit backup confirmation permits logout for the exact unchanged issued document', async t => {
  const first = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: document('remote') } } }); await first.start();
  first.storage.failWrite = true; first.session.updateState(edited(first.session.document(), 'explicit backup'));
  const backup = first.session.exportCurrent(); assert.equal(body(backup.document), 'explicit backup');
  assert.equal(first.session.status().canConfirmBackup, true); assert.equal(first.session.status().backupConfirmed, false);
  assert.equal(await first.session.signOut(), false); assert.equal(first.signOuts(), 0);
  assert.equal(first.session.confirmBackup(backup), true);
  assert.equal(first.session.status().backupConfirmed, true); assert.equal(first.session.status().canConfirmBackup, false);
  assert.equal(await first.session.signOut(), true); assert.equal(first.signOuts(), 1);
  assert.equal(first.session.status().backupConfirmed, false);
});

test('missing, altered and wrong-owner backup confirmations leave the sole account draft protected', async t => {
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: document('remote') } } }); await f.start();
  f.storage.failWrite = true; f.session.updateState(edited(f.session.document(), 'protected draft'));
  const backup = f.session.exportCurrent();
  const altered = clone(backup); altered.document.state.tasks[0].body = 'different exported text';
  for (const invalid of [undefined, null, false, {}, { ...backup, backupToken: null },
    { ...backup, kind: 'guest' }, { ...backup, accountId: 'B' }, altered]) {
    assert.equal(f.session.confirmBackup(invalid), false);
    assert.equal(f.session.status().backupConfirmed, false);
  }
  assert.equal(await f.session.signOut(), false); assert.equal(f.signOuts(), 0);
  assert.equal(body(f.session.document()), 'protected draft');
  assert.equal(f.session.confirmBackup(backup), true, 'rejected confirmations must not mutate the issued snapshot');
});

test('editing after export or confirmation invalidates the old backup and requires confirmation of the new document', async t => {
  const second = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: document('remote') } } }); await second.start();
  second.storage.failWrite = true; second.session.updateState(edited(second.session.document(), 'old backup'));
  const old = second.session.exportCurrent(); assert.equal(second.session.confirmBackup(old), true);
  second.session.updateState(edited(second.session.document(), 'new unexported draft'));
  assert.equal(second.session.status().backupConfirmed, false); assert.equal(second.session.status().canConfirmBackup, false);
  assert.equal(second.session.confirmBackup(old), false);
  assert.equal(await second.session.signOut(), false); assert.equal(second.signOuts(), 0);
  assert.equal(body(second.session.document()), 'new unexported draft');
  const fresh = second.session.exportCurrent();
  assert.equal(await second.session.signOut(), false, 'a new export still requires its own explicit acknowledgement');
  assert.equal(second.session.confirmBackup(fresh), true);
  assert.equal(await second.session.signOut(), true); assert.equal(second.signOuts(), 1);
});

test('changing a document and then restoring identical content cannot revive an old export or confirmation', async t => {
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: document('remote') } } }); await f.start();
  f.storage.failWrite = true; f.session.updateState(edited(f.session.document(), 'original backup'));
  const backup = f.session.exportCurrent(); assert.equal(f.session.confirmBackup(backup), true);
  f.session.updateState(edited(f.session.document(), 'temporary edit'));
  f.session.updateState(clone(backup.document.state));
  assert.deepEqual(f.session.document(), backup.document);
  assert.equal(f.session.status().backupConfirmed, false); assert.equal(f.session.confirmBackup(backup), false);
  assert.equal(await f.session.signOut(), false); assert.equal(f.signOuts(), 0);
  const fresh = f.session.exportCurrent(); assert.notEqual(fresh.backupToken, backup.backupToken);
  assert.equal(f.session.confirmBackup(fresh), true); assert.equal(await f.session.signOut(), true);
});

test('a backup from a previous account session cannot be confirmed after switching owners and returning', async t => {
  const sameDoc = document('same content');
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: sameDoc }, B: { revision: 1, state: sameDoc } } });
  await f.start(); const backup = f.session.exportCurrent(); assert.equal(f.session.confirmBackup(backup), true);
  f.emitOwner('B'); await until(() => f.session.status().loaded);
  assert.deepEqual(f.session.document(), backup.document);
  assert.equal(f.session.status().backupConfirmed, false); assert.equal(f.session.confirmBackup(backup), false);
  f.emitOwner('A'); await until(() => f.session.status().loaded);
  assert.deepEqual(f.session.document(), backup.document);
  assert.equal(f.session.status().backupConfirmed, false); assert.equal(f.session.confirmBackup(backup), false);
  const fresh = f.session.exportCurrent(); assert.notEqual(fresh.backupToken, backup.backupToken);
  assert.equal(f.session.confirmBackup(fresh), true);
});

test('a pending account draft safely stored for recovery still permits logout without exporting or confirming', async t => {
  const f = fixture(t, { owner: 'A', rows: { A: { revision: 1, state: document('remote') } },
    intercept: ({ operation, proceed }) => { if (operation === 'pathSave') throw error('NETWORK'); return proceed(); } });
  await f.start(); f.session.updateState(edited(f.session.document(), 'recoverable draft'));
  assert.equal(await f.session.retry(), false); assert.equal(f.session.status().pending, true);
  const pending = clone(pendingFor(f.storage, 'A')); assert.ok(pending.length);
  assert.equal(f.session.status().backupConfirmed, false); assert.equal(f.session.status().canConfirmBackup, false);
  assert.equal(await f.session.signOut(), true); assert.equal(f.signOuts(), 1);
  assert.deepEqual(pendingFor(f.storage, 'A'), pending);
});

test('explicitly choosing a same-owner pending recovery makes the chosen document visible and editable', async t => {
  const saved = document('recovered local');
  const key = ACCOUNT_CACHE_PREFIX + 'A';
  const storage = memoryStorage([[key, JSON.stringify({ version: 1, accountId: 'A', baseRevision: 2, state: saved, pending: true })]]);
  const f = fixture(t, { storage, owner: 'A', rows: { A: { revision: 2, state: document('remote') } } }); await f.start();
  assert.equal(f.session.status().syncStatus, 'local-conflict');
  const draft = f.session.status().localDrafts[0]; assert.ok(draft);
  assert.equal(await f.session.chooseRecovery(draft.id), true);
  assert.equal(f.session.status().loaded, true);
  assert.equal(body(f.session.document()), 'recovered local'); assert.equal(f.session.status().canEdit, true);
  assert.equal(await f.session.retry(), true); assert.equal(body(f.remotes.get('A').state), 'recovered local');
});

test('initial local-conflict can load remote without a current export while preserving recovery bytes and avoiding writes', async t => {
  const key = ACCOUNT_CACHE_PREFIX + 'A';
  const raw = JSON.stringify({ version: 1, accountId: 'A', baseRevision: 2, state: document('original local recovery'), pending: true }, null, 2) + '\n';
  const remote = { revision: 4, state: document('remote selected') };
  const f = fixture(t, { storage: memoryStorage([[key, raw]]), owner: 'A', rows: { A: remote } });
  await f.start();
  assert.equal(f.session.status().syncStatus, 'local-conflict'); assert.equal(f.session.status().loaded, false);
  assert.equal(f.session.document(), null); assert.equal(f.session.exportCurrent().backupToken, null);
  assert.equal(f.session.status().canConfirmBackup, false);
  assert.equal(await f.session.useRemote(), true);
  assert.equal(f.session.status().loaded, true); assert.equal(f.session.status().canEdit, true);
  assert.equal(f.session.status().syncStatus, 'synced'); assert.equal(body(f.session.document()), 'remote selected');
  assert.equal(f.storage.getItem(key), raw);
  assert.deepEqual(f.session.exportRecovery().entries.find(entry => entry.key === key), { key, raw });
  assert.equal(f.storage.removals.includes(key), false);
  assert.deepEqual(f.remotes.get('A'), remote);
  assert.deepEqual(f.calls.map(call => call.operation), ['pathLoad', 'pathLoad']);
});

test('late old-owner remote selection from an initial local-conflict cannot replace the new account or expose its recovery', async t => {
  const key = ACCOUNT_CACHE_PREFIX + 'A';
  const raw = JSON.stringify({ version: 1, accountId: 'A', baseRevision: 2, state: document('A preserved local recovery'), pending: true }, null, 2);
  const gate = deferred(), entered = deferred(); let ownerALoads = 0;
  const f = fixture(t, { storage: memoryStorage([[key, raw]]), owner: 'A',
    rows: { A: { revision: 3, state: document('A remote') }, B: { revision: 8, state: document('B only') } },
    intercept: async ({ owner, operation, proceed }) => {
      if (owner === 'A' && operation === 'pathLoad' && ++ownerALoads === 2) {
        const response = proceed(); entered.resolve(); await gate.promise; return response;
      }
      return proceed();
    } });
  t.after(() => gate.resolve()); await f.start();
  assert.equal(f.session.status().syncStatus, 'local-conflict'); assert.equal(f.session.status().loaded, false);
  const resolving = f.session.useRemote(); await entered.promise;
  const boundary = f.documents.length; f.emitOwner('B'); await until(() => f.session.status().loaded);
  assert.equal(f.session.status().accountId, 'B'); assert.equal(body(f.session.document()), 'B only');
  gate.resolve(); assert.equal(await resolving, false); await settled();
  assert.equal(f.session.status().accountId, 'B'); assert.equal(f.session.status().error, null);
  assert.equal(body(f.session.document()), 'B only'); assert.equal(f.session.status().canEdit, true);
  assert.equal(f.documents.slice(boundary).some(value => body(value).startsWith('A ')), false);
  assert.equal(f.storage.getItem(key), raw);
  assert.equal(f.session.exportRecovery().accountId, 'B'); assert.deepEqual(f.session.exportRecovery().entries, []);
  assert.equal(f.calls.some(call => call.operation !== 'pathLoad'), false);
});

test('clearing migrated guest does not silently resurrect legacy data on the next session', async t => {
  const raw = JSON.stringify(document('old legacy').state), storage = memoryStorage([[LEGACY_KEY, raw]]);
  const first = fixture(t, { storage }); await first.start(); assert.equal(first.session.clearGuest(), true);
  assert.equal(body(first.session.document()), ''); assert.equal(storage.getItem(LEGACY_KEY), raw);
  first.session.dispose(); const next = fixture(t, { storage }); await next.start();
  assert.equal(body(next.session.document()), ''); assert.equal(storage.getItem(LEGACY_KEY), raw);
});

test('failed initial account load and guest persistence expose retry actions instead of indefinite loading', async t => {
  const remote = fixture(t, { owner: 'A', intercept: () => { throw error('NETWORK_UNAVAILABLE', { retryable: true }); } });
  await remote.start();
  assert.equal(remote.session.status().loaded, false);
  assert.match(renderAccountNotice(remote.session.status()), /data-state="failed"/);
  assert.match(renderAccountPanel(remote.session.status()), /data-action="accountRetry"/);
  assert.doesNotMatch(renderAccountPanel(remote.session.status()), /불러오는 중/);
  const guest = fixture(t); await guest.start(); guest.storage.failWrite = true;
  assert.throws(() => guest.session.updateState(edited(guest.session.document(), 'unsaved guest')), { code: 'LOCAL_STORAGE_UNAVAILABLE' });
  assert.match(renderAccountNotice(guest.session.status()), /data-state="failed"/);
  assert.match(renderAccountPanel(guest.session.status()), /data-action="accountRetry"/);
  guest.storage.failWrite = false; assert.equal(await guest.session.retry(), true);
  assert.equal(guest.session.status().error, null);
  assert.equal(body(JSON.parse(guest.storage.getItem(GUEST_KEY))), 'unsaved guest');
});

test('empty guest and cleared tombstone do not advertise nonexistent guest data', async t => {
  const f = fixture(t); await f.start();
  assert.equal(f.session.status().guestAvailable, false);
  assert.doesNotMatch(renderAccountPanel(f.session.status()), /data-action="accountExportGuest"|data-action="clearGuest"/);
  f.session.updateState(edited(f.session.document(), 'guest draft'));
  assert.equal(f.session.status().guestAvailable, true);
  f.remotes.set('A', { revision: 1, state: document('account data') });
  f.emitOwner('A'); await until(() => f.session.status().loaded);
  assert.match(renderAccountPanel(f.session.status()), /계정에 이미 자료가 있어/);
  assert.equal(f.session.clearGuest(), true);
  assert.equal(f.session.status().guestAvailable, false);
  assert.doesNotMatch(renderAccountPanel(f.session.status()), /계정에 이미 자료가 있어|data-action="accountExportGuest"|data-action="clearGuest"/);
  assert.equal(body(f.session.document()), 'account data');
  const restored = fixture(t, { storage: f.storage }); await restored.start();
  assert.equal(restored.session.status().guestAvailable, false);
});

test('real signed-in account status exposes import only for a verified empty remote with guest content', async t => {
  const f = fixture(t, { storage: memoryStorage([[GUEST_KEY, JSON.stringify(document('import this'))]]), owner: 'A' });
  await f.start();
  assert.equal(f.session.status().accountStatus, 'signed-in');
  assert.equal(f.session.status().canImportGuest, true);
  assert.match(renderAccountPanel(f.session.status()), /data-action="accountImport"/);
  assert.equal(await f.session.importGuest(), true);
  assert.equal(body(f.remotes.get('A').state), 'import this');
  assert.doesNotMatch(renderAccountPanel(f.session.status()), /data-action="accountImport"/);
  const empty = fixture(t, { owner: 'B' }); await empty.start();
  assert.match(renderAccountPanel(empty.session.status()), /계정에 저장된 자료가 없습니다/);
  assert.doesNotMatch(renderAccountPanel(empty.session.status()), /data-action="accountImport"|계정에 이미 자료가 있어/);
});

for (const [label, raw] of [['malformed', '{original malformed'], ['future', JSON.stringify({ ...document('future'), version: 2 })]]) {
  test(label + ' guest raw stays exportable and explicitly clearable while writes/import remain blocked', async t => {
    const f = fixture(t, { storage: memoryStorage([[GUEST_KEY, raw]]) }); await f.start();
    assert.equal(f.session.status().guestBlocked, true); assert.equal(f.session.status().canEdit, false);
    assert.equal(f.session.status().canImportGuest, false);
    for (const lang of ['ko', 'en']) {
      const html = renderAccountPanel(f.session.status(), lang);
      assert.match(html, /data-action="accountExportGuest"/); assert.match(html, /data-action="clearGuest"/);
      assert.doesNotMatch(html, /data-action="accountImport"/);
    }
    assert.equal(f.session.exportGuest().raw, raw); assert.equal(f.storage.getItem(GUEST_KEY), raw);
    assert.equal(f.session.clearGuest(), true);
    assert.equal(f.session.status().guestBlocked, false); assert.equal(f.session.status().guestAvailable, false);
    assert.equal(f.session.status().canEdit, true);
  });
}

test('load errors preserve their original code and local recovery is shown as conflict before a draft is selected', async t => {
  const remote = fixture(t, { owner: 'A', intercept: () => { throw error('CARE_CLIENT_UPDATE_REQUIRED', { retryable: false }); } });
  await remote.start();
  assert.equal(remote.session.status().error.code, 'CARE_CLIENT_UPDATE_REQUIRED');
  assert.equal(remote.session.status().error.retryable, false);
  assert.match(renderAccountNotice(remote.session.status()), /data-state="failed"/);
  const storage = memoryStorage([[ACCOUNT_CACHE_PREFIX + 'A', JSON.stringify({ version: 1, accountId: 'A', baseRevision: 2, state: document('recover me'), pending: true })]]);
  const recovery = fixture(t, { storage, owner: 'A', rows: { A: { revision: 2, state: document('remote') } } }); await recovery.start();
  assert.equal(recovery.session.status().loaded, false);
  assert.equal(recovery.session.status().error.code, 'LOCAL_DRAFT_CONFLICT');
  assert.match(renderAccountNotice(recovery.session.status()), /data-state="conflict"/);
  assert.match(renderAccountPanel(recovery.session.status()), /data-action="accountRecover"/);
  assert.doesNotMatch(renderAccountPanel(recovery.session.status()), /불러오는 중/);
});

test('referenced saved-job removal explains the preparation dependency and retains both records', async t => {
  const f = fixture(t); await f.start();
  const job = { id: 'greenhouse-moloco-123', board: 'moloco', jobId: '123', provider: 'greenhouse', company: 'Moloco', title: 'Engineer',
    location: 'Seoul', employmentType: null, url: 'https://job-boards.greenhouse.io/moloco/jobs/123', observedAt: stamp };
  assert.equal(f.session.saveJob(job), true);
  const state = clone(f.session.document().state);
  state.tasks.push({ id: 'job-123', goal: 'job', sourceId: job.id, body: 'application notes', confirmedAt: null, updatedAt: stamp });
  f.session.updateState(state);
  let failure; try { f.session.removeJob(job.id); } catch (value) { failure = value; }
  assert.equal(failure?.code, 'JOB_IN_USE');
  assert.match(getAccountErrorMessage(failure, 'ko'), /공고/); assert.match(getAccountErrorMessage(failure, 'ko'), /준비/);
  assert.match(getAccountErrorMessage(failure, 'en'), /job|posting/i); assert.match(getAccountErrorMessage(failure, 'en'), /prepar/i);
  assert.doesNotMatch(getAccountErrorMessage(failure, 'en'), /shortly|in progress|try again/i);
  assert.equal(f.session.document().savedJobs.length, 1); assert.equal(f.session.document().state.tasks.length, 1);
});

test('account recovery errors use specific explanations and guest storage is described as tab scoped', () => {
  for (const lang of ['ko', 'en']) {
    const generic = getAccountErrorMessage({ code: 'UNKNOWN_TEST_CODE' }, lang);
    for (const code of ['PATH_DOCUMENT_FUTURE_VERSION', 'GUEST_SAVE_REQUIRED', 'GUEST_WRITE_BLOCKED', 'SAVED_JOB_LIMIT', 'ACCOUNT_CHANGED', 'LOCAL_DRAFT_CONFLICT', 'CARE_CLIENT_UPDATE_REQUIRED'])
      assert.notEqual(getAccountErrorMessage({ code }, lang), generic, code + ' in ' + lang);
  }
  const status = { configured: true, signedIn: false, loaded: true, syncStatus: 'local', error: null };
  assert.match(renderAccountNotice(status, 'ko'), /이 탭/);
  assert.match(renderAccountNotice(status, 'en'), /this tab/i);
});
