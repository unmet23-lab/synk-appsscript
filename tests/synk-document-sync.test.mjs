import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentSync } from '../experiences/synk-account/src/document-sync.mjs';

const PREFIX = 'synthetic-document-sync:path:';
const ACCOUNT = 'synthetic-owner';
const keyFor = account => PREFIX + encodeURIComponent(account);
const pendingEntries = (storage, account = ACCOUNT) => [...storage.data].filter(([key, raw]) => {
  try { const value = JSON.parse(raw); return key.startsWith(keyFor(account)) && value.accountId === account && value.pending; } catch { return false; }
});
const pendingRaw = (storage, account = ACCOUNT) => pendingEntries(storage, account).at(-1)?.[1] ?? null;
const state = text => ({ version: 1, text });
const cache = (account, text, { pending = true, revision = 0 } = {}) => JSON.stringify({
  version: 1, accountId: account, baseRevision: revision, state: state(text), pending,
});
const validateState = value => {
  if (value?.version !== 1 || typeof value.text !== 'string') throw new Error('Invalid fixture state');
  return { version: 1, text: value.text };
};
function memoryStorage(initial = []) {
  const data = new Map(initial), writes = [], removals = [];
  return {
    data, writes, removals, failRemove: false, failRead: false, failWrite: false, failEnumerate: false,
    get length() { if (this.failEnumerate) throw new Error('Blocked storage enumeration'); return data.size; },
    key(index) { if (this.failEnumerate) throw new Error('Blocked storage enumeration'); return [...data.keys()][index] ?? null; },
    getItem(key) { if (this.failRead) throw new Error('Blocked storage read'); return data.get(key) ?? null; },
    setItem(key, raw) { if (this.failWrite) throw new Error('Blocked storage write'); writes.push({ key, raw }); data.set(key, String(raw)); },
    removeItem(key) { if (this.failRemove) throw new Error('Blocked storage removal'); removals.push(key); data.delete(key); },
  };
}
function fixture({ storage = memoryStorage(), transport, remoteText = 'server', onSaved = () => {}, onRemoved = () => {}, preferRemoteOnOpen = false } = {}) {
  const statuses = [], states = [], calls = [];
  let revision = 0, remote = state(remoteText);
  const reply = () => ({ ok: true, scope: 'synk-personal', resource: 'path', accountId: ACCOUNT, revision, state: remote });
  const sync = createDocumentSync({
    storage, onSaved, onRemoved, preferRemoteOnOpen, cachePrefix: PREFIX, scope: 'synk-personal', resource: 'path',
    operations: { load: 'personalLoad', save: 'personalSave', delete: 'personalDelete' },
    validateState, emptyState: () => state(''),
    onState: value => states.push(structuredClone(value)), onStatus: value => statuses.push(structuredClone(value)),
    transport: async (action, body) => {
      calls.push({ action, body: structuredClone(body) });
      if (transport) return transport(action, body, reply);
      if (action === 'personalSave') { assert.equal(body.expected_revision, revision); remote = validateState(body.state); revision++; }
      else if (action === 'personalDelete') { assert.equal(body.expected_revision, revision); remote = null; revision++; }
      else assert.equal(action, 'personalLoad');
      return reply();
    },
  });
  return { sync, storage, statuses, states, calls, status: () => statuses.at(-1) };
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('successful load/save/refresh/delete/close leaves no completed cache and only pending changes are persisted', async t => {
  const f = fixture(); t.after(() => f.sync.close());
  assert.equal(await f.sync.open(ACCOUNT), true);
  assert.equal(f.storage.getItem(keyFor(ACCOUNT)), null);
  assert.equal(f.storage.writes.length, 0);
  assert.equal(f.sync.change(state('unsaved original')), true);
  const draftKey = pendingEntries(f.storage)[0][0];
  assert.notEqual(draftKey, keyFor(ACCOUNT)); assert.equal(JSON.parse(pendingRaw(f.storage)).pending, true);
  assert.equal(await f.sync.flush(), true);
  assert.equal(f.storage.getItem(keyFor(ACCOUNT)), null);
  assert.equal(f.status().pending, false);
  assert.equal(await f.sync.refresh(), true);
  assert.equal(await f.sync.remove(), true);
  f.sync.close();
  assert.equal(f.storage.getItem(keyFor(ACCOUNT)), null);
  assert(f.storage.removals.includes(draftKey));
  assert(f.storage.writes.every(write => JSON.parse(write.raw).pending === true));
});

test('pending offline data survives close and reopens only for its account', async t => {
  const storage = memoryStorage([[keyFor('other-owner'), cache('other-owner', 'other private draft')]]);
  const offline = fixture({ storage, transport: async action => {
    if (action === 'personalLoad') return { ok: true, scope: 'synk-personal', resource: 'path', accountId: ACCOUNT, revision: 0, state: state('server') };
    throw Object.assign(new Error('Offline'), { code: 'NETWORK_FAILED' });
  } });
  t.after(() => offline.sync.close());
  await offline.sync.open(ACCOUNT); offline.sync.change(state('this pending draft'));
  assert.equal(await offline.sync.flush(), false);
  const raw = pendingRaw(storage); offline.sync.close();
  assert.equal(pendingRaw(storage), raw);
  const reopened = fixture({ storage }); t.after(() => reopened.sync.close());
  assert.equal(await reopened.sync.open(ACCOUNT), false);
  assert.equal(reopened.status().status, 'local-conflict');
  assert.equal(await reopened.sync.selectLocalDraft(reopened.status().localDrafts[0].id), true);
  assert.equal(reopened.states.at(-1).text, 'this pending draft');
  assert.equal(reopened.status().pending, true);
  assert(!reopened.states.some(value => value.text === 'other private draft'));
  assert.equal(storage.getItem(keyFor('other-owner')), cache('other-owner', 'other private draft'));
});

test('a legacy completed cache is removed without exposing its contents before the server answers', async t => {
  const gate = deferred(), storage = memoryStorage([[keyFor(ACCOUNT), cache(ACCOUNT, 'stale completed private data', { pending: false })]]);
  const f = fixture({ storage, transport: async (_action, _body, reply) => { await gate.promise; return reply(); } });
  t.after(() => { gate.resolve(); f.sync.close(); });
  const opened = f.sync.open(ACCOUNT);
  await Promise.resolve();
  assert.equal(storage.getItem(keyFor(ACCOUNT)), null);
  assert(!f.states.some(value => value.text === 'stale completed private data'));
  gate.resolve(); assert.equal(await opened, true);
  assert.equal(f.states.at(-1).text, 'server');
  assert(!f.states.some(value => value.text === 'stale completed private data'));
});

for (const [kind, raw, owned] of [
  ['malformed JSON', ' { "unfinished" : \n한글 원문', false],
  ['invalid document', JSON.stringify({ version: 1, accountId: ACCOUNT, baseRevision: 0, pending: true, state: { text: 42 } }), true],
  ['wrong owner', cache('foreign-owner', 'foreign original'), false],
]) test(`corrupt ${kind} stays byte-identical; only proven current-owner raw is recoverable`, async t => {
  const storage = memoryStorage([[keyFor(ACCOUNT), raw]]), f = fixture({ storage }); t.after(() => f.sync.close());
  assert.equal(await f.sync.open(ACCOUNT), true);
  assert.equal(f.status().error?.code, owned ? 'INVALID_LOCAL_CACHE' : undefined);
  assert.equal(f.status().localRecords.unknown, owned ? 0 : 1);
  assert.equal(storage.getItem(keyFor(ACCOUNT)), raw);
  assert(!f.states.some(value => value.text === 'foreign original'));
  f.sync.change(state('new in-memory edit')); assert.equal(await f.sync.flush(), true);
  assert.equal(f.status().error?.code, owned ? 'INVALID_LOCAL_CACHE' : undefined);
  assert.equal(await f.sync.remove(), true);
  assert.equal(storage.getItem(keyFor(ACCOUNT)), raw);
  assert(!storage.writes.some(write => write.key === keyFor(ACCOUNT)));
  const backup=f.sync.exportLocalRecords();
  assert.equal(backup.accountId,ACCOUNT); assert.deepEqual(backup.entries,owned?[{key:keyFor(ACCOUNT),raw}]:[]);
  assert.equal(f.sync.clearLocalRecords(),true);
  assert.equal(storage.getItem(keyFor(ACCOUNT)),owned?null:raw);
  f.sync.close(); assert.throws(()=>f.sync.exportLocalRecords(),{code:'LOCAL_RECOVERY_AUTH_REQUIRED'});
  assert.equal(f.sync.clearLocalRecords(),false);
});

test('recovery requires authentication and strictly isolates current owner from foreign, unknown and unrelated raw', async t => {
  const own=cache(ACCOUNT,'mine'),foreign=cache('other-owner','private other'),unknown='{broken';
  const storage=memoryStorage([[keyFor(ACCOUNT),own],[keyFor('other-owner'),foreign],[keyFor('unknown'),unknown],['another:owner','unrelated']]);
  const f=fixture({storage});t.after(()=>f.sync.close());
  assert.equal(f.sync.localRecords().count,3);assert.equal(f.sync.localRecords().exportable,0);
  assert.throws(()=>f.sync.exportLocalRecords(),{code:'LOCAL_RECOVERY_AUTH_REQUIRED'});assert.equal(f.sync.clearLocalRecords(),false);
  await f.sync.open(ACCOUNT);assert.equal(f.status().localRecords.count,1);
  assert.deepEqual(f.sync.exportLocalRecords().entries,[{key:keyFor(ACCOUNT),raw:own}]);
  assert.equal(f.sync.clearLocalRecords(),true);assert.equal(f.status().status,'synced');
  assert.deepEqual([...storage.data],[[keyFor('other-owner'),foreign],[keyFor('unknown'),unknown],['another:owner','unrelated']]);
});

test('completed-cache removal failure stays visible even when remote load succeeds', async t => {
  const raw = cache(ACCOUNT, 'completed private data', { pending: false });
  const storage = memoryStorage([[keyFor(ACCOUNT), raw]]); storage.failRemove = true;
  const f = fixture({ storage }); t.after(() => f.sync.close());
  assert.equal(await f.sync.open(ACCOUNT), true);
  assert.equal(f.status().error?.code, 'LOCAL_STORAGE_UNAVAILABLE');
  assert.equal(storage.getItem(keyFor(ACCOUNT)), raw);
  assert(!f.states.some(value => value.text === 'completed private data'));
  storage.failRemove = false; assert.equal(await f.sync.refresh(), true);
  assert.equal(storage.getItem(keyFor(ACCOUNT)), null);
  assert.equal(f.status().error, null);
});

test('local deletion failures return false and remain visible without discarding the recoverable raw entry', async t => {
  const raw = JSON.stringify({version:1,accountId:ACCOUNT,state:{text:42}}); const storage = memoryStorage([[keyFor(ACCOUNT), raw]]), f = fixture({ storage });
  t.after(()=>f.sync.close());await f.sync.open(ACCOUNT); storage.failRemove = true;
  assert.equal(f.sync.clearLocalRecords(), false);
  assert.equal(f.status().error?.code, 'LOCAL_STORAGE_UNAVAILABLE');
  assert.equal(storage.getItem(keyFor(ACCOUNT)), raw);
  storage.failRemove = false;
  assert.equal(f.sync.clearLocalRecords(), true);
  assert.equal(f.sync.localRecords().count, 0);
});

test('enumeration failures cannot be reported as an empty local recovery', async t => {
  const storage = memoryStorage([[keyFor(ACCOUNT), cache(ACCOUNT, 'pending')]]), f = fixture({ storage });
  t.after(()=>f.sync.close());await f.sync.open(ACCOUNT);storage.failEnumerate = true;
  assert.equal(f.sync.localRecords().error?.code, 'LOCAL_STORAGE_UNAVAILABLE');
  assert.throws(() => f.sync.exportLocalRecords(), { code: 'LOCAL_STORAGE_UNAVAILABLE' });
  assert.equal(f.status().error?.code, 'LOCAL_STORAGE_UNAVAILABLE');
  assert.equal(f.sync.clearLocalRecords(), false);
  assert.equal(f.status().error?.code, 'LOCAL_STORAGE_UNAVAILABLE');
  assert.equal(storage.data.size, 1);
});

for (const code of ['PAYLOAD_TOO_LARGE', 'INVALID_PERSONAL_STATE', 'PERSONAL_DATA_TOO_LARGE', 'REVISION_CAPACITY', 'ASSET_NOT_FOUND', 'ASSET_NOT_CONFIRMED', 'MEDIA_QUOTA_EXCEEDED']) {
  test(`permanent ${code} rejection is an error and keeps pending original available for recovery`, async t => {
    const f = fixture({ transport: async (action, _body, reply) => {
      if (action === 'personalLoad') return reply();
      throw Object.assign(new Error('Server declined this record'), { code });
    } }); t.after(() => f.sync.close());
    await f.sync.open(ACCOUNT); f.sync.change(state('recoverable original'));
    const raw = pendingRaw(f.storage);
    assert.equal(await f.sync.flush(), false);
    assert.equal(f.status().status, 'error'); assert.equal(f.status().error?.code, code); assert.equal(f.status().pending, true);
    assert.equal(pendingRaw(f.storage), raw);
    assert.equal(JSON.parse(raw).pending, true);
    assert.equal(f.sync.exportLocalRecords().entries[0].raw, raw);
    f.sync.close();assert.throws(()=>f.sync.exportLocalRecords(),{code:'LOCAL_RECOVERY_AUTH_REQUIRED'});
  });
}

function sharedServer({ beforeSave = async () => {} } = {}) {
  let revision = 0, remote = state('server'), saves = 0;
  return {
    get state() { return structuredClone(remote); }, get saves() { return saves; },
    async transport(action, body) {
      if (action === 'personalSave') await beforeSave(++saves, body);
      if (action !== 'personalLoad') {
        if (body.expected_revision !== revision) return { ok: false, revision, error: { code: 'REVISION_CONFLICT' } };
        remote = action === 'personalSave' ? validateState(body.state) : null; revision++;
      }
      return { ok: true, scope: 'synk-personal', resource: 'path', accountId: ACCOUNT, revision, state: remote };
    },
  };
}

test('late ACK from one tab cannot erase another closed tab pending original', async t => {
  const began = deferred(), hold = deferred(), storage = memoryStorage();
  const server = sharedServer({ beforeSave: async () => { began.resolve(); await hold.promise; } });
  const a = fixture({ storage, transport: server.transport }), b = fixture({ storage, transport: server.transport });
  t.after(() => { hold.resolve(); a.sync.close(); b.sync.close(); });
  await a.sync.open(ACCOUNT); await b.sync.open(ACCOUNT);
  a.sync.change(state('A sent')); const saving = a.sync.flush(); await began.promise;
  b.sync.change(state('B only recovery')); const [bKey, bRaw] = pendingEntries(storage).find(([, raw]) => JSON.parse(raw).state.text === 'B only recovery'); b.sync.close();
  hold.resolve(); assert.equal(await saving, true);
  assert.equal(storage.getItem(bKey), bRaw); assert.equal(pendingEntries(storage).length, 1);
  const reopened = fixture({ storage, transport: server.transport }); t.after(() => reopened.sync.close());
  assert.equal(await reopened.sync.open(ACCOUNT), false);
  assert.equal(reopened.status().status,'local-conflict');
  await reopened.sync.selectLocalDraft(reopened.status().localDrafts[0].id);
  assert.equal(reopened.states.at(-1).text, 'B only recovery');
  assert.equal(reopened.status().status, 'conflict'); assert.equal(server.state.text, 'A sent');
});

test('interleaved edits keep one immutable pending per writer; reopen requires explicit selection and preserves unselected drafts', async t => {
  const storage = memoryStorage(), server = sharedServer();
  const a = fixture({ storage, transport: server.transport }), b = fixture({ storage, transport: server.transport });
  t.after(() => { a.sync.close(); b.sync.close(); });
  await a.sync.open(ACCOUNT); await b.sync.open(ACCOUNT);
  a.sync.change(state('A first')); b.sync.change(state('B first'));
  a.sync.change(state('A newest')); b.sync.change(state('B newest'));
  const retained = pendingEntries(storage);
  assert.equal(retained.length, 2); assert.deepEqual(retained.map(([, raw]) => JSON.parse(raw).state.text).sort(), ['A newest', 'B newest']);
  assert.equal(new Set(storage.writes.map(write => write.key)).size, 4, 'Every change gets a fresh immutable key');
  a.sync.close(); b.sync.close();
  const chooser = fixture({ storage, transport: server.transport }); t.after(() => chooser.sync.close());
  assert.equal(await chooser.sync.open(ACCOUNT), false); assert.equal(chooser.status().status, 'local-conflict');
  assert.equal(chooser.status().localDrafts.length, 2); assert.equal(await chooser.sync.flush(), false); assert.equal(server.saves, 0);
  assert.throws(() => chooser.sync.change(state('implicit replacement')), { code: 'LOCAL_DRAFT_CONFLICT' });
  const [aKey, aRaw] = retained.find(([, raw]) => JSON.parse(raw).state.text === 'A newest');
  const [bKey, bRaw] = retained.find(([, raw]) => JSON.parse(raw).state.text === 'B newest');
  assert.equal(await chooser.sync.selectLocalDraft(JSON.parse(aRaw).draftId), true);
  assert.equal(chooser.states.at(-1).text, 'A newest'); assert.equal(await chooser.sync.flush(), true);
  assert.equal(server.state.text, 'A newest'); assert.equal(storage.getItem(aKey), null); assert.equal(storage.getItem(bKey), bRaw);
  assert.equal(chooser.status().localDrafts.length, 1, 'The remaining draft stays selectable after ACK');
  assert.equal(await chooser.sync.selectLocalDraft(JSON.parse(bRaw).draftId), true, 'Selection succeeds even when its server revision is stale');
  assert.equal(chooser.states.at(-1).text, 'B newest'); assert.equal(chooser.status().status, 'conflict'); assert.equal(server.saves, 1);
  const beforeRemote = new Map(storage.data);
  assert.equal(await chooser.sync.resolveRemote(), true); assert.equal(chooser.states.at(-1).text, 'A newest');
  assert.deepEqual(storage.data, beforeRemote, 'Opening server state is not permission to destroy local recovery');
  assert.equal(chooser.status().localDrafts.length, 1);
});

test('an in-flight ACK cannot erase its own newer edit and its next save uses the advanced revision', async t => {
  const first = deferred(), firstRelease = deferred(), second = deferred(), secondRelease = deferred(), storage = memoryStorage();
  const server = sharedServer({ beforeSave: async (n, body) => {
    if (n === 1) { first.resolve(); await firstRelease.promise; }
    if (n === 2) { assert.equal(body.expected_revision, 1); second.resolve(); await secondRelease.promise; }
  } });
  const f = fixture({ storage, transport: server.transport }); t.after(() => { firstRelease.resolve(); secondRelease.resolve(); f.sync.close(); });
  await f.sync.open(ACCOUNT); f.sync.change(state('first')); const saving = f.sync.flush(); await first.promise;
  f.sync.change(state('newer edit')); firstRelease.resolve(); await second.promise;
  assert.equal(pendingEntries(storage).length, 1); assert.equal(JSON.parse(pendingRaw(storage)).state.text, 'newer edit');
  assert.equal(JSON.parse(pendingRaw(storage)).baseRevision, 1);
  secondRelease.resolve(); assert.equal(await saving, true); assert.equal(server.state.text, 'newer edit');
  assert.equal(pendingEntries(storage).length, 0);
});

test('failed replacement write preserves the prior immutable recovery and refuses switching away from unprotected edits', async t => {
  const storage = memoryStorage(), server = sharedServer();
  const a = fixture({ storage, transport: server.transport }), b = fixture({ storage, transport: server.transport });
  t.after(() => { a.sync.close(); b.sync.close(); });
  await a.sync.open(ACCOUNT); await b.sync.open(ACCOUNT);
  a.sync.change(state('A recovery')); b.sync.change(state('B recovery'));
  const before = new Map(storage.data), bId = JSON.parse(pendingEntries(storage).find(([, raw]) => JSON.parse(raw).state.text === 'B recovery')[1]).draftId;
  storage.failWrite = true; a.sync.change(state('A memory-only newest'));
  assert.deepEqual(storage.data, before); assert.equal(a.status().warning.code, 'LOCAL_STORAGE_UNAVAILABLE');
  assert.equal(a.status().pendingStored, false); assert.equal(a.status().localPersistenceError, true);
  assert.equal(await a.sync.selectLocalDraft(bId), false); assert.deepEqual(storage.data, before);
  storage.failWrite = false; assert.equal(await a.sync.flush(), true); assert.equal(server.state.text, 'A memory-only newest');
  assert.equal(pendingEntries(storage).length, 1); assert.equal(JSON.parse(pendingRaw(storage)).state.text, 'B recovery');
});

test('multiple-draft explicit account deletion clears local-choice state while leaving unselected local recovery intact', async t => {
  const storage = memoryStorage(), server = sharedServer();
  const a = fixture({ storage, transport: server.transport }), b = fixture({ storage, transport: server.transport });
  await a.sync.open(ACCOUNT); await b.sync.open(ACCOUNT); a.sync.change(state('A')); b.sync.change(state('B')); a.sync.close(); b.sync.close();
  const f = fixture({ storage, transport: server.transport }); t.after(() => f.sync.close());
  await f.sync.open(ACCOUNT); assert.equal(f.status().status, 'local-conflict');
  const before = new Map(storage.data); assert.equal(await f.sync.remove(), true);
  assert.equal(f.status().status, 'synced'); assert.equal(f.status().pending, false); assert.deepEqual(storage.data, before);
  assert.equal(f.status().localDrafts.length, 2);
  assert.equal(f.sync.clearLocalRecords(), true); assert.equal(storage.data.size, 0); f.sync.close();assert.equal(f.sync.clearLocalRecords(),false);
});

test('corrupt legacy recovery stays byte-identical while new edits use independent keys', async t => {
  const raw = JSON.stringify({version:1,accountId:ACCOUNT,state:{text:42}}); const storage = memoryStorage([[keyFor(ACCOUNT), raw]]), f = fixture({ storage });
  t.after(() => f.sync.close()); await f.sync.open(ACCOUNT); f.sync.change(state('separate valid draft'));
  assert.equal(storage.getItem(keyFor(ACCOUNT)), raw); assert.equal(pendingEntries(storage).length, 1);
  assert.equal(f.status().pendingStored, true); assert.equal(f.status().localPersistenceError, false);
  storage.failWrite = true; f.sync.change(state('quota plus corrupt recovery'));
  assert.equal(f.status().warning.code, 'INVALID_LOCAL_CACHE'); assert.equal(f.status().pendingStored, false); assert.equal(f.status().localPersistenceError, true);
  storage.failWrite = false;
  assert.equal(await f.sync.flush(), true); assert.equal(storage.getItem(keyFor(ACCOUNT)), raw); assert.equal(pendingEntries(storage).length, 0);
});


test('a single existing draft is never sent by a newly opened tab without selection',async t=>{
  const storage=memoryStorage(),server=sharedServer(),a=fixture({storage,transport:server.transport}),b=fixture({storage,transport:server.transport});
  t.after(()=>{a.sync.close();b.sync.close();});await a.sync.open(ACCOUNT);a.sync.change(state('active writer'));
  await b.sync.open(ACCOUNT);assert.equal(b.status().status,'local-conflict');assert.equal(await b.sync.flush(),false);
  assert.equal(server.saves,0);assert.equal(b.states.at(-1).text,'server');
  await a.sync.flush();assert.equal(await b.sync.refresh(),true);assert.equal(b.status().status,'synced');assert.equal(b.states.at(-1).text,'active writer');
});

test('storage event after final draft disappears unlocks wrapped-storage consumers and reads latest server state',async t=>{
  const listeners=new Set(),oldAdd=globalThis.addEventListener,oldRemove=globalThis.removeEventListener;
  globalThis.addEventListener=(type,fn)=>{if(type==='storage')listeners.add(fn);};globalThis.removeEventListener=(type,fn)=>listeners.delete(fn);
  t.after(()=>{globalThis.addEventListener=oldAdd;globalThis.removeEventListener=oldRemove;});
  const storage=memoryStorage(),server=sharedServer(),a=fixture({storage,transport:server.transport}),b=fixture({storage,transport:server.transport});
  await a.sync.open(ACCOUNT);a.sync.change(state('writer latest'));await b.sync.open(ACCOUNT);const key=pendingEntries(storage)[0][0];await a.sync.flush();
  for(const fn of listeners)fn({key,storageArea:{different:'real localStorage'}});
  await b.sync.refresh();assert.equal(b.status().status,'synced');assert.equal(b.states.at(-1).text,'writer latest');
  a.sync.change(state('new server revision'));await a.sync.flush();b.sync.change(state('stale reader edit'));await b.sync.flush();
  for(const fn of listeners)fn({key,storageArea:{different:'real localStorage'}});
  assert.equal(b.status().status,'conflict');assert.equal(b.status().error.code,'REVISION_CONFLICT');
  a.sync.close();b.sync.close();assert.equal(listeners.size,0);
});

test('local clearing refuses an active pending value or in-flight load, even after a valid signed-in export',async t=>{
  const gate=deferred(),f=fixture({transport:async(action,body,reply)=>{if(action==='personalLoad')await gate.promise;return reply();}});t.after(()=>{gate.resolve();f.sync.close();});
  const opening=f.sync.open(ACCOUNT);await Promise.resolve();assert.equal(f.sync.clearLocalRecords(),false);assert.equal(f.status().error.code,'LOCAL_CACHE_IN_USE');
  gate.resolve();await opening;f.sync.change(state('only pending'));assert.equal(f.sync.clearLocalRecords(),false);assert.equal(f.sync.exportLocalRecords().entries.length,1);
});

test('only validated asset IDs are exposed on save rejection',async t=>{
  const assetId='11111111-1111-4111-8111-111111111111';
  for(const candidate of [assetId,'private unsafe text']) {
    const f=fixture({transport:async(action,body,reply)=>action==='personalLoad'?reply():{ok:false,error:{code:'ASSET_NOT_FOUND',assetId:candidate}}});
    await f.sync.open(ACCOUNT);f.sync.change(state('photo'));await f.sync.flush();assert.equal(f.status().error.assetId,candidate===assetId?assetId:undefined);f.sync.close();
  }
});

test('product callbacks receive successful save/delete ACKs, never reads, rejections or late signed-out responses',async t=>{
  const saved=[],removed=[],f=fixture({onSaved:value=>saved.push(value),onRemoved:()=>removed.push(true)});t.after(()=>f.sync.close());
  await f.sync.open(ACCOUNT);await f.sync.refresh();assert.equal(saved.length,0);assert.equal(removed.length,0);
  f.sync.change(state('ack data'));await f.sync.flush();assert.deepEqual(saved,[state('ack data')]);await f.sync.remove();assert.equal(removed.length,1);
  const started=deferred(),hold=deferred(),g=fixture({onSaved:value=>saved.push(value),transport:async(action,body,reply)=>{if(action==='personalSave'){started.resolve();await hold.promise;return {...reply(),revision:1,state:body.state};}return reply();}});
  await g.sync.open(ACCOUNT);g.sync.change(state('late secret'));const result=g.sync.flush();await started.promise;g.sync.close();hold.resolve();assert.equal(await result,false);assert.deepEqual(saved,[state('ack data')]);
});

test('remote-first open and reopen load verified server state without locking or sending old recoveries', async t => {
  const draftId = '11111111-1111-4111-8111-111111111111';
  const oldDraft = JSON.stringify({ ...JSON.parse(cache(ACCOUNT, 'older detached draft')), draftId, createdAt: '2026-10-08T00:00:00.000Z' });
  const storage = memoryStorage([[keyFor(ACCOUNT), cache(ACCOUNT, 'legacy recovery')], [keyFor(ACCOUNT) + ':draft:' + draftId, oldDraft],
    [keyFor('other-owner'), cache('other-owner', 'private other recovery')]]);
  const before = new Map(storage.data), server = sharedServer();
  const f = fixture({ storage, transport: server.transport, preferRemoteOnOpen: true }); t.after(() => f.sync.close());
  for (let i = 0; i < 2; i++) {
    assert.equal(await f.sync.open(ACCOUNT), true);
    assert.equal(f.status().status, 'synced'); assert.equal(f.status().pending, false);
    assert.equal(f.states.at(-1).text, 'server'); assert.equal(f.status().localDrafts.length, 2);
    assert.equal(await f.sync.refresh(), true); assert.equal(await f.sync.flush(), true);
    assert.equal(server.saves, 0); assert.deepEqual(storage.data, before);
    assert.equal(f.sync.exportLocalRecords().entries.length, 2);
    f.sync.close();
  }
  assert(!f.states.some(value => /recovery|draft/.test(value.text)));
  await f.sync.open(ACCOUNT);
  assert.equal(f.sync.change(state('new edit on verified state')), true, 'Recoveries must not lock editing');
  assert.equal(await f.sync.flush(), true); assert.equal(server.saves, 1);
  assert.deepEqual(storage.data, before, 'Saving a new edit cannot acknowledge detached recoveries');
});

test('remote-first recovery remains optional after storage events and refresh', async t => {
  const listeners = new Set(), oldAdd = globalThis.addEventListener, oldRemove = globalThis.removeEventListener;
  globalThis.addEventListener = (type, fn) => { if (type === 'storage') listeners.add(fn); };
  globalThis.removeEventListener = (type, fn) => { if (type === 'storage') listeners.delete(fn); };
  const storage = memoryStorage(), server = sharedServer();
  const f = fixture({ storage, transport: server.transport, preferRemoteOnOpen: true });
  t.after(() => { f.sync.close(); globalThis.addEventListener = oldAdd; globalThis.removeEventListener = oldRemove; });
  await f.sync.open(ACCOUNT);
  const raw = cache(ACCOUNT, 'other tab offline recovery'); storage.setItem(keyFor(ACCOUNT), raw);
  for (const listener of listeners) listener({ key: keyFor(ACCOUNT), storageArea: {} });
  assert.equal(f.status().status, 'synced'); assert.equal(f.status().localDrafts.length, 1);
  assert.equal(await f.sync.refresh(), true); assert.equal(f.status().status, 'synced');
  assert.equal(server.saves, 0); assert.equal(f.sync.change(state('still editable')), true);
  assert.equal(await f.sync.flush(), true); assert.equal(storage.getItem(keyFor(ACCOUNT)), raw);
  assert.equal(f.status().status, 'synced'); assert.equal(f.status().localDrafts.length, 1);
});

test('remote selection retains the current recovery through later saves and remote-first reopen', async t => {
  const storage = memoryStorage([[keyFor(ACCOUNT), cache(ACCOUNT, 'old detached recovery')]]), server = sharedServer();
  const f = fixture({ storage, transport: server.transport, preferRemoteOnOpen: true }); t.after(() => f.sync.close());
  await f.sync.open(ACCOUNT); f.sync.change(state('unsaved work to preserve'));
  const retained = new Map(storage.data);
  assert.equal(await f.sync.resolveRemote(), true); assert.equal(f.states.at(-1).text, 'server');
  assert.deepEqual(storage.data, retained); assert.equal(f.status().localDrafts.length, 2); assert.equal(server.saves, 0);
  f.sync.change(state('later intentional save')); assert.equal(await f.sync.flush(), true);
  assert.equal(server.state.text, 'later intentional save'); assert.deepEqual(storage.data, retained);
  f.sync.close(); assert.equal(await f.sync.open(ACCOUNT), true);
  assert.equal(f.states.at(-1).text, 'later intentional save'); assert.equal(f.status().status, 'synced');
  assert.equal(f.status().localDrafts.length, 2); assert.deepEqual(storage.data, retained); assert.equal(server.saves, 1);
});

test('failed persistence prevents remote selection from discarding a memory-only edit', async t => {
  const f = fixture({ preferRemoteOnOpen: true }); t.after(() => f.sync.close());
  await f.sync.open(ACCOUNT); f.sync.change(state('previous safe recovery'));
  const retained = new Map(f.storage.data);
  f.storage.failWrite = true; f.sync.change(state('newest memory-only edit'));
  const statesBefore = f.states.length, revisionBefore = f.status().revision, callsBefore = f.calls.length;
  assert.equal(await f.sync.resolveRemote(), false);
  assert.equal(f.calls.length, callsBefore, 'An unprotected edit blocks the fetch before any request');
  assert.equal(f.states.length, statesBefore); assert.equal(f.status().status, 'storage-error');
  assert.equal(f.status().error.code, 'LOCAL_STORAGE_UNAVAILABLE'); assert.equal(f.status().pending, true);
  assert.equal(f.status().pendingStored, false); assert.equal(f.status().revision, revisionBefore);
  assert.deepEqual(f.storage.data, retained); assert.equal(f.calls.filter(call => call.action === 'personalSave').length, 0);
  f.storage.failWrite = false;
  assert.equal(await f.sync.resolveRemote(), true); assert.equal(f.states.at(-1).text, 'server');
  assert(pendingEntries(f.storage).some(([, raw]) => JSON.parse(raw).state.text === 'newest memory-only edit'));
  assert.equal(f.status().pending, false); assert.equal(f.status().status, 'synced');
});

test('remote-first local recovery selection still performs a fresh CAS check and requires conflict review', async t => {
  const storage = memoryStorage([[keyFor(ACCOUNT), cache(ACCOUNT, 'stale optional recovery')]]), server = sharedServer();
  const f = fixture({ storage, transport: server.transport, preferRemoteOnOpen: true }); t.after(() => f.sync.close());
  await f.sync.open(ACCOUNT);
  await server.transport('personalSave', { expected_revision: 0, state: state('other device latest') });
  const callsBefore = f.calls.length;
  assert.equal(await f.sync.selectLocalDraft('legacy'), true);
  assert.deepEqual(f.calls.slice(callsBefore).map(call => call.action), ['personalLoad']);
  assert.equal(f.status().status, 'conflict'); assert.equal(f.status().error.code, 'REVISION_CONFLICT');
  assert.equal(f.states.at(-1).text, 'stale optional recovery'); assert.equal(await f.sync.flush(), false);
  assert.equal(server.state.text, 'other device latest'); assert.equal(server.saves, 1);
});

test('remote-first mode still blocks a current-session CAS conflict until an explicit choice', async t => {
  const server = sharedServer(), f = fixture({ transport: server.transport, preferRemoteOnOpen: true });
  t.after(() => f.sync.close()); await f.sync.open(ACCOUNT);
  await server.transport('personalSave', { expected_revision: 0, state: state('other device saved first') });
  f.sync.change(state('this device unsaved work'));
  assert.equal(await f.sync.flush(), false); assert.equal(f.status().status, 'conflict');
  assert.equal(f.status().error.code, 'REVISION_CONFLICT'); assert.equal(f.status().pending, true);
  const retained = new Map(f.storage.data), savesAfterConflict = server.saves;
  assert.equal(await f.sync.refresh(), false); assert.equal(await f.sync.flush(), false);
  assert.equal(server.saves, savesAfterConflict); assert.equal(server.state.text, 'other device saved first');
  assert.equal(await f.sync.resolveRemote(), true); assert.equal(f.states.at(-1).text, 'other device saved first');
  assert.deepEqual(f.storage.data, retained); assert.equal(f.status().localDrafts.length, 1);
  assert.equal(server.saves, savesAfterConflict);
});

test('remote selection cannot replace edits made during the fetch or use failed or foreign responses', async t => {
  const began = deferred(), hold = deferred(); let mode = 'normal';
  const f = fixture({ preferRemoteOnOpen: true, transport: async (_action, _body, reply) => {
    if (mode === 'delayed') { began.resolve(); await hold.promise; }
    if (mode === 'offline') throw Object.assign(new Error('offline'), { code: 'NETWORK_FAILED' });
    if (mode === 'foreign') return { ...reply(), accountId: 'foreign-owner', state: state('private foreign response') };
    return reply();
  } }); t.after(() => { hold.resolve(); f.sync.close(); });
  await f.sync.open(ACCOUNT); f.sync.change(state('first unsaved edit'));
  mode = 'delayed'; const resolving = f.sync.resolveRemote(); await began.promise;
  f.sync.change(state('edit made while fetching')); const retained = new Map(f.storage.data);
  hold.resolve(); assert.equal(await resolving, false);
  assert.equal(f.status().status, 'conflict'); assert.equal(f.status().error.code, 'LOCAL_CHANGED_DURING_REFRESH');
  assert.deepEqual(f.storage.data, retained); assert.equal(f.status().pending, true);
  for (mode of ['offline', 'foreign']) {
    const before = f.states.length;
    assert.equal(await f.sync.resolveRemote(), false); assert.equal(f.states.length, before);
    assert.equal(f.status().pending, true); assert.deepEqual(f.storage.data, retained);
  }
  assert(!f.states.some(value => value.text === 'private foreign response'));
  assert.equal(f.calls.filter(call => call.action === 'personalSave').length, 0);
});

test('account switching during remote selection never exposes or removes the previous account recovery', async t => {
  const began = deferred(), hold = deferred(); let account = ACCOUNT, loads = 0;
  const foreignRaw = cache('next-owner', 'next-owner optional recovery');
  const storage = memoryStorage([[keyFor('next-owner'), foreignRaw]]);
  const f = fixture({ storage, preferRemoteOnOpen: true, transport: async (_action, _body, reply) => {
    const response = { ...reply(), accountId: account, state: state(account + ' server') };
    if (++loads === 2) { began.resolve(); await hold.promise; }
    return response;
  } }); t.after(() => { hold.resolve(); f.sync.close(); });
  await f.sync.open(ACCOUNT); f.sync.change(state('previous owner private edit'));
  const retained = new Map(storage.data), resolving = f.sync.resolveRemote(); await began.promise;
  account = 'next-owner'; assert.equal(await f.sync.open(account), true); const statesAfterSwitch = f.states.length;
  hold.resolve(); assert.equal(await resolving, false);
  assert.equal(f.states.length, statesAfterSwitch); assert.equal(f.states.at(-1).text, 'next-owner server');
  assert.equal(f.status().accountId, 'next-owner'); assert.equal(f.status().status, 'synced');
  assert.deepEqual(storage.data, retained); assert.deepEqual(f.sync.exportLocalRecords().entries, [{ key: keyFor('next-owner'), raw: foreignRaw }]);
  assert.equal(f.status().localDrafts.length, 1); assert.equal(f.calls.filter(call => call.action === 'personalSave').length, 0);
});
