import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareSync } from '../care-sync.mjs';
import { emptyState, makePerson, importBackup } from '../model.mjs';

const state = name => ({ ...emptyState(), people: [makePerson({ id: 'p_synthetic', name })] });
const copy = value => value === null ? null : importBackup(value);
const deferred = () => { let resolve, reject; const promise = new Promise((ok, no) => { resolve = ok; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function memoryStorage() {
  const data = new Map();
  return { data, get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const pendingCache = (storage, account = 'account-a') => [...storage.data.values()].map(raw => JSON.parse(raw)).find(value => value.accountId === account && value.pending);
function server() {
  const accounts = new Map(), calls = [];
  function transport(owner) {
    return async (action, body) => {
      const id = owner(); calls.push({ id, action, body });
      const current = accounts.get(id) ?? { revision: 0, state: null };
      if (action !== 'careLoad') {
        if (body.expected_revision !== current.revision) return { ok: false, error: { code: 'REVISION_CONFLICT' }, revision: current.revision };
        current.revision += 1; current.state = action === 'careDelete' ? null : copy(body.state); accounts.set(id, current);
      }
      return { ok: true, scope: 'synk-care', accountId: id, revision: current.revision, updatedAt: null, state: copy(current.state) };
    };
  }
  return { accounts, calls, transport };
}
function client(transport, storage = memoryStorage()) {
  const states = [], statuses = [];
  const sync = createCareSync({ transport, storage, onState: value => states.push(value), onStatus: value => statuses.push(value) });
  return { sync, storage, states, statuses, last: () => statuses.at(-1), visible: () => states.at(-1) };
}

test('account open reads remote before writes and never imports guest state', async t => {
  const remote = server(), gate = deferred();
  const c = client(async (...args) => { if (args[0] === 'careLoad') await gate.promise; return remote.transport(() => 'account-a')(...args); });
  t.after(() => c.sync.close());
  const opening = c.sync.open('account-a'); await tick();
  c.sync.change(state('로그인 뒤 새로 등록'));
  const saving = c.sync.flush();
  assert.equal(remote.calls.length, 0);
  gate.resolve(); await opening; assert.equal(await saving, true);
  assert.deepEqual(remote.calls.map(item => item.action), ['careLoad', 'careSave']);
  assert.equal(remote.accounts.get('account-a').state.people[0].name, '로그인 뒤 새로 등록');
  assert.equal(c.last().status, 'synced'); assert.equal(c.last().pending, false);
});

test('offline outbox survives reopen in its own account and resumes only against its original revision', async t => {
  const remote = server(), storage = memoryStorage(); let offline = false;
  const transport = async (...args) => { if (offline) throw new Error('offline'); return remote.transport(() => 'account-a')(...args); };
  const first = client(transport, storage); await first.sync.open('account-a');
  first.sync.change(state('오프라인 편집')); offline = true;
  assert.equal(await first.sync.flush(), false); assert.equal(first.last().status, 'offline');
  const cached = pendingCache(storage);
  assert.equal(cached.pending, true); assert.equal(cached.baseRevision, 0);
  first.sync.close(); offline = false;
  const second = client(transport, storage); t.after(() => second.sync.close());
  await second.sync.open('account-a'); assert.equal(second.last().status, 'local-conflict');
  await second.sync.selectLocalDraft(second.last().localDrafts[0].id); assert.equal(second.visible().people[0].name, '오프라인 편집');
  assert.equal(await second.sync.flush(), true);
  assert.equal(remote.accounts.get('account-a').state.people[0].name, '오프라인 편집');
});

test('two devices keep conflicting local edits until an explicit newest-read then local overwrite', async t => {
  const remote = server(), a = client(remote.transport(() => 'account-a')), b = client(remote.transport(() => 'account-a'));
  t.after(() => { a.sync.close(); b.sync.close(); });
  await a.sync.open('account-a'); await b.sync.open('account-a');
  a.sync.change(state('A의 편집')); await a.sync.flush();
  b.sync.change(state('B의 편집')); assert.equal(await b.sync.flush(), false);
  assert.equal(b.last().status, 'conflict'); assert.equal(b.last().revision, 1); assert.equal(b.last().pending, true);
  assert.equal(pendingCache(b.storage).state.people[0].name, 'B의 편집');
  const at = remote.calls.length; assert.equal(await b.sync.resolveLocal(), true);
  assert.deepEqual(remote.calls.slice(at).map(item => item.action), ['careLoad', 'careSave']);
  assert.equal(remote.accounts.get('account-a').state.people[0].name, 'B의 편집');
  assert.equal(remote.accounts.get('account-a').revision, 2);
});

test('explicit remote resolution displays server state while retaining local recovery and guards edits during its fetch', async t => {
  const remote = server(), gate = deferred(); let pause = false;
  const c = client(async (...args) => { if (pause && args[0] === 'careLoad') await gate.promise; return remote.transport(() => 'account-a')(...args); });
  t.after(() => c.sync.close()); await c.sync.open('account-a');
  c.sync.change(state('기기에서 수정')); remote.accounts.set('account-a', { revision: 1, state: state('다른 기기 최신') });
  await c.sync.flush();
  pause = true; const resolving = c.sync.resolveRemote(); await tick(); c.sync.change(state('가져오는 동안 새 편집'));
  gate.resolve(); assert.equal(await resolving, false); assert.equal(c.last().status, 'conflict');
  pause = false; assert.equal(await c.sync.resolveRemote(), true);
  assert.equal(c.visible().people[0].name, '다른 기기 최신'); assert.equal(c.last().pending, false);
  assert.equal(pendingCache(c.storage).state.people[0].name, '가져오는 동안 새 편집');
});

test('edits during an in-flight save are serialized onto the next revision without dropping either result', async t => {
  const remote = server(), gate = deferred(); let firstSave = true, concurrent = 0, maximum = 0;
  const c = client(async (...args) => {
    concurrent++; maximum = Math.max(maximum, concurrent);
    try { if (args[0] === 'careSave' && firstSave) { firstSave = false; await gate.promise; } return await remote.transport(() => 'account-a')(...args); }
    finally { concurrent--; }
  });
  t.after(() => c.sync.close()); await c.sync.open('account-a');
  c.sync.change(state('첫 편집')); const saving = c.sync.flush(); await tick(); c.sync.change(state('저장 중 다시 편집'));
  gate.resolve(); assert.equal(await saving, true);
  assert.equal(maximum, 1); assert.equal(remote.accounts.get('account-a').revision, 2);
  assert.equal(remote.accounts.get('account-a').state.people[0].name, '저장 중 다시 편집');
});

test('save acknowledgements and unchanged selections do not reset the editor or create extra revisions', async t => {
  const remote = server(), c = client(remote.transport(() => 'account-a'));
  t.after(() => c.sync.close()); await c.sync.open('account-a');
  const before = c.states.length, data = state('편집 중인 사람');
  c.sync.change(data); await c.sync.flush();
  assert.equal(c.states.length, before, 'ACK must not invoke onState');
  assert.equal(c.sync.change(data), false); await c.sync.flush();
  assert.equal(remote.accounts.get('account-a').revision, 1);
  await c.sync.refresh(); assert.equal(c.states.length, before, 'unchanged refresh must not reset the editor');
});

test('logout and account switch reject late responses and show no previous account data', async t => {
  const remote = server(), gate = deferred(); let owner = 'account-a', wait = true;
  remote.accounts.set('account-a', { revision: 1, state: state('A의 비공개 기록') });
  remote.accounts.set('account-b', { revision: 3, state: state('B의 기록') });
  const c = client(async (...args) => { const captured = owner; if (captured === 'account-a' && wait) await gate.promise; return remote.transport(() => captured)(...args); });
  t.after(() => c.sync.close());
  const old = c.sync.open('account-a'); await tick(); c.sync.close();
  assert.equal(c.visible().people.length, 0);
  owner = 'account-b'; await c.sync.open('account-b'); const count = c.states.length;
  wait = false; gate.resolve(); assert.equal(await old, false);
  assert.equal(c.states.length, count); assert.equal(c.visible().people[0].name, 'B의 기록');
  assert.equal(c.last().accountId, 'account-b');
  assert.equal(c.storage.getItem('synk.care.account.v1.account-a'), null);
});

test('an account-mismatched response never enters callbacks or another account cache', async t => {
  const c = client(async () => ({ ok: true, scope: 'synk-care', accountId: 'account-b', revision: 1, state: state('다른 계정 자료') }));
  t.after(() => c.sync.close()); assert.equal(await c.sync.open('account-a'), false);
  assert.equal(c.last().status, 'error'); assert.equal(c.last().error.code, 'CARE_ACCOUNT_MISMATCH');
  assert.equal(c.visible().people.length, 0); assert.equal(c.storage.data.size, 0);
});

test('delete uses CAS and clears local state only on success; stale device cannot restore the deleted snapshot', async t => {
  const remote = server(), a = client(remote.transport(() => 'account-a')), b = client(remote.transport(() => 'account-a'));
  t.after(() => { a.sync.close(); b.sync.close(); });
  await a.sync.open('account-a'); a.sync.change(state('나중에 지울 기록')); await a.sync.flush();
  await b.sync.open('account-a'); assert.equal(await a.sync.remove(), true);
  assert.equal(a.visible().people.length, 0); assert.equal(a.last().revision, 2);
  b.sync.change(state('낡은 기기의 수정')); assert.equal(await b.sync.flush(), false); assert.equal(b.last().status, 'conflict');
  assert.equal(remote.accounts.get('account-a').state, null);
  await b.sync.resolveRemote(); assert.equal(b.visible().people.length, 0);
});

test('storage quota failures remain visible while an in-memory edit can still reach the account', async t => {
  const remote = server(), c = client(remote.transport(() => 'account-a'), { getItem: () => null, setItem: () => { throw new Error('quota'); } });
  t.after(() => c.sync.close()); await c.sync.open('account-a');
  c.sync.change(state('메모리에 보존')); assert.equal(c.last().status, 'storage-error'); assert.equal(c.last().pending, true);
  assert.equal(c.last().pendingStored, false);
  assert.equal(await c.sync.flush(), true); assert.equal(c.last().pending, false);
  assert.equal(c.last().error.code, 'LOCAL_STORAGE_UNAVAILABLE'); assert.equal(remote.accounts.get('account-a').state.people[0].name, '메모리에 보존');
});

test('400ms debounce coalesces quick edits; completed user A cache is cleared before user B opens', async t => {
  const remote = server(), storage = memoryStorage(); let owner = 'account-a';
  const c = client(remote.transport(() => owner), storage); t.after(() => c.sync.close());
  await c.sync.open(owner); c.sync.change(state('첫 입력')); c.sync.change(state('두 번째 입력'));
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(remote.calls.filter(item => item.action === 'careSave').length, 1);
  assert.equal(remote.accounts.get(owner).state.people[0].name, '두 번째 입력');
  owner = 'account-b'; await c.sync.open(owner); assert.equal(c.visible().people.length, 0);
  assert.equal(storage.getItem('synk.care.account.v1.account-a'), null);
  assert.equal(storage.getItem('synk.care.account.v1.account-b'), null);
});
