import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareSync } from '../care-sync.mjs';
import { createDocumentSync } from '../../synk-account/src/document-sync.mjs';
import { emptyState, makePerson, importBackup, rememberDraft, listSavedMessages, toggleMessageFavorite, removeSavedMessage } from '../model.mjs';

function memoryStorage() {
  const data = new Map();
  return { data, get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

function libraryState() {
  let state = { ...emptyState(), people: [makePerson({ id: 'person-a', name: '합성 문구 수첩' })] };
  for (const [checkinIntent, text, savedAt] of [
    ['everyday', '예전에 다듬은 평소 안부', '2026-10-01T00:00:00.000Z'],
    ['everyday', '최근에 다듬은 평소 안부', '2026-10-08T00:00:00.000Z'],
    ['thanks', '지난번 도움에 감사해요.', '2026-10-07T00:00:00.000Z'],
  ]) state = rememberDraft(state, { personId: 'person-a', eventId: '', eventType: 'checkin', checkinIntent, text }, new Date(savedAt));
  const old = listSavedMessages(state.people[0]).find(item => item.text === '예전에 다듬은 평소 안부');
  return toggleMessageFavorite(state, { personId: 'person-a', messageId: old.id });
}

function server(initialState = null, initialRevision = 0) {
  let state = initialState === null ? null : importBackup(initialState), revision = initialRevision;
  const calls = [];
  return {
    calls, get state() { return state; },
    async transport(action, body) {
      calls.push({ action, body });
      if (action !== 'careLoad') {
        if (body.expected_revision !== revision) return { ok: false, error: { code: 'REVISION_CONFLICT' }, revision };
        if (action === 'careSave') assert.equal(body.messageLibraryVersion, 1, 'library saves must opt into the server capability');
        state = action === 'careDelete' ? null : importBackup(body.state); revision++;
      }
      return { ok: true, scope: 'synk-care', accountId: 'account-a', revision, updatedAt: null, state: state === null ? null : importBackup(state) };
    },
  };
}

function client(transport, storage = memoryStorage()) {
  const states = [], statuses = [], saved = [];
  const sync = createCareSync({ transport, storage, onState: state => states.push(state), onStatus: status => statuses.push(status), onSaved: state => saved.push(state) });
  return { sync, storage, states, statuses, saved, visible: () => states.at(-1), status: () => statuses.at(-1) };
}

test('careSave alone sends the library capability; load and delete keep their existing contract', async t => {
  const remote = server(), c = client(remote.transport);
  t.after(() => c.sync.close());
  await c.sync.open('account-a');
  c.sync.change(libraryState()); assert.equal(await c.sync.flush(), true);
  await c.sync.refresh(); assert.equal(await c.sync.remove(), true);

  assert.deepEqual(remote.calls.map(item => item.action), ['careLoad', 'careSave', 'careLoad', 'careDelete']);
  for (const { action, body } of remote.calls) {
    assert.equal(Object.hasOwn(body ?? {}, 'messageLibraryVersion'), action === 'careSave');
    if (action === 'careSave') assert.equal(body.messageLibraryVersion, 1);
  }
});

test('independent sync clients preserve purpose, earlier versions, favorite and an explicitly deleted row', async t => {
  const remote = server(), first = client(remote.transport), second = client(remote.transport);
  t.after(() => { first.sync.close(); second.sync.close(); });
  const initial = libraryState();
  await first.sync.open('account-a'); first.sync.change(initial); assert.equal(await first.sync.flush(), true);
  await second.sync.open('account-a');
  assert.deepEqual(second.visible(), initial);
  assert.equal(listSavedMessages(second.visible().people[0])[0].favorite, true);
  assert.equal(listSavedMessages(second.visible().people[0], { type: 'checkin', checkinIntent: 'thanks' }).length, 1);

  const old = listSavedMessages(initial.people[0])[0];
  const changed = removeSavedMessage(second.visible(), { personId: 'person-a', messageId: old.id });
  second.sync.change(changed); assert.equal(await second.sync.flush(), true);
  await first.sync.refresh();

  assert.deepEqual(first.visible(), changed);
  assert.equal(listSavedMessages(first.visible().people[0]).length, 2);
  assert.equal(listSavedMessages(first.visible().people[0]).some(item => item.id === old.id), false);
  assert.equal(first.visible().drafts.length, 0);
  assert.equal(first.visible().activities.length, 0);
});

test('offline library edits remain exportable and survive explicit local recovery before sync', async t => {
  const remote = server(), storage = memoryStorage(); let offline = false;
  const transport = (...args) => offline ? Promise.reject(new Error('offline')) : remote.transport(...args);
  const first = client(transport, storage);
  await first.sync.open('account-a');
  const initial = libraryState(); first.sync.change(initial); offline = true;
  assert.equal(await first.sync.flush(), false);
  assert.equal(first.status().status, 'offline');
  const recovery = first.sync.exportLocalRecords();
  assert.equal(recovery.accountId, 'account-a');
  assert.equal(recovery.entries.length, 1);
  assert.deepEqual(JSON.parse(recovery.entries[0].raw).state, initial);
  first.sync.close(); offline = false;

  const second = client(transport, storage); t.after(() => second.sync.close());
  await second.sync.open('account-a');
  assert.equal(second.status().status, 'local-conflict');
  assert.equal(remote.state, null, 'reopening must not overwrite the server before the user chooses a pending copy');
  await second.sync.selectLocalDraft(second.status().localDrafts[0].id);
  assert.deepEqual(second.visible(), initial);
  assert.equal(await second.sync.flush(), true);
  assert.deepEqual(remote.state, initial);
  assert.equal(second.status().pending, false);
  assert.equal(second.sync.exportLocalRecords().entries.length, 0);
});

test('a client-upgrade rejection is actionable error rather than offline and preserves recoverable library edits', async t => {
  const remote = server();
  const c = client((action, body) => action === 'careSave'
    ? Promise.resolve({ ok: false, error: { code: 'CARE_CLIENT_UPDATE_REQUIRED' } })
    : remote.transport(action, body));
  t.after(() => c.sync.close());
  await c.sync.open('account-a');
  const initial = libraryState(); c.sync.change(initial);

  assert.equal(await c.sync.flush(), false);

  assert.equal(c.status().status, 'error');
  assert.equal(c.status().error.code, 'CARE_CLIENT_UPDATE_REQUIRED');
  assert.match(c.status().error.message, /백업.*새로고침/u);
  assert.equal(c.status().pending, true);
  assert.equal(c.saved.length, 0, 'a rejected save must never acknowledge success');
  assert.equal(remote.state, null);
  assert.deepEqual(JSON.parse(c.sync.exportLocalRecords().entries[0].raw).state, initial);
});

function legacySnapshot(state) {
  return importBackup({ ...state, people: state.people.map(({ messageLibrary, ...person }) => person) });
}

function pendingStorage(state, baseRevision, prefix = 'synk.care.account.v1.') {
  const storage = memoryStorage(), key = `${prefix}account-a`;
  const raw = JSON.stringify({ version: 1, accountId: 'account-a', baseRevision, state, pending: true });
  storage.setItem(key, raw);
  return { storage, key, raw };
}

test('same-revision legacy recovery cannot auto-save over a modern library and choosing remote preserves the raw pending backup', async t => {
  const modern = libraryState(), legacy = legacySnapshot(modern), revision = 7;
  legacy.people[0].notes = '구형 앱에서 남긴 오프라인 메모';
  const cache = pendingStorage(legacy, revision), remote = server(modern, revision);
  const c = client(remote.transport, cache.storage); t.after(() => c.sync.close());
  await c.sync.open('account-a');
  assert.equal(c.status().status, 'local-conflict');
  assert.deepEqual(c.visible(), modern);
  assert.equal(await c.sync.selectLocalDraft(c.status().localDrafts[0].id), true);
  assert.equal(c.status().status, 'conflict');
  assert.equal(c.status().error.code, 'CARE_LIBRARY_RECOVERY_REVIEW');
  assert.match(c.status().error.message, /이전 문구·즐겨찾기.*임시기록/u);
  assert.match(c.status().error.message, /복구 파일.*백업.*계정 수첩/u);
  assert.deepEqual(c.visible(), legacy);
  assert.equal(c.status().pending, true);
  const exported = c.sync.exportLocalRecords();
  assert.ok(exported.entries.some(entry => entry.key === cache.key && entry.raw === cache.raw));

  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(await c.sync.flush(), false);
  assert.equal(remote.calls.filter(call => call.action === 'careSave').length, 0);
  assert.deepEqual(remote.state, modern);

  assert.equal(await c.sync.resolveRemote(), true);
  assert.deepEqual(c.visible(), modern);
  assert.equal(listSavedMessages(c.visible().people[0]).length, 3);
  assert.equal(listSavedMessages(c.visible().people[0])[0].favorite, true);
  assert.equal(c.status().pending, false);
  assert.ok(c.sync.exportLocalRecords().entries.some(entry => entry.key === cache.key && entry.raw === cache.raw));
  assert.equal(remote.calls.filter(call => call.action === 'careSave').length, 0);
});

test('a failed remote check after choosing legacy recovery must be retried before any online flush can save', async t => {
  const modern = libraryState(), legacy = legacySnapshot(modern), revision = 8;
  legacy.people[0].notes = '조회 실패 전에 선택한 구형 임시기록';
  const cache = pendingStorage(legacy, revision), remote = server(modern, revision);
  let failNextLoad = false;
  const c = client(async (action, body) => {
    if (action === 'careLoad' && failNextLoad) { failNextLoad = false; throw new Error('one-time network failure'); }
    return remote.transport(action, body);
  }, cache.storage);
  t.after(() => c.sync.close());
  await c.sync.open('account-a');
  assert.equal(c.status().status, 'local-conflict');
  assert.deepEqual(c.visible(), modern);
  failNextLoad = true;
  await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
  assert.equal(c.status().status, 'offline');
  assert.deepEqual(c.visible(), legacy);

  assert.equal(await c.sync.flush(), false);

  assert.equal(c.status().status, 'conflict');
  assert.equal(c.status().error.code, 'CARE_LIBRARY_RECOVERY_REVIEW');
  assert.equal(remote.calls.filter(call => call.action === 'careSave').length, 0);
  assert.deepEqual(remote.state, modern);
  assert.ok(c.sync.exportLocalRecords().entries.some(entry => entry.key === cache.key && entry.raw === cache.raw));
  assert.equal(await c.sync.resolveRemote(), true);
  assert.deepEqual(c.visible(), modern);
  assert.ok(c.sync.exportLocalRecords().entries.some(entry => entry.key === cache.key && entry.raw === cache.raw));
});

test('legacy recovery can replace the account library only through explicit local resolution', async t => {
  const modern = libraryState(), legacy = legacySnapshot(modern), revision = 9;
  legacy.people[0].notes = '백업 후 사용자가 고른 구형 임시기록';
  const remote = server(modern, revision), cache = pendingStorage(legacy, revision);
  const c = client(remote.transport, cache.storage); t.after(() => c.sync.close());
  await c.sync.open('account-a'); await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
  assert.equal(c.status().error.code, 'CARE_LIBRARY_RECOVERY_REVIEW');
  assert.equal(await c.sync.flush(), false);
  assert.equal(remote.calls.filter(call => call.action === 'careSave').length, 0);

  assert.equal(await c.sync.resolveLocal(), true);

  assert.equal(c.status().status, 'synced');
  assert.deepEqual(remote.state, legacy);
  const saves = remote.calls.filter(call => call.action === 'careSave');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].body.messageLibraryVersion, 1);
  assert.equal(saves[0].body.expected_revision, revision);
});

test('recovery requires review when a modern owner is absent locally or even its empty library field was lost', async t => {
  for (const variant of ['missing-person', 'empty-remote-library']) {
    let modern = libraryState();
    if (variant === 'empty-remote-library') modern = importBackup({ ...modern, people: modern.people.map(person => ({ ...person, messageLibrary: [], savedMessages: {} })) });
    const local = variant === 'missing-person' ? emptyState() : legacySnapshot(modern);
    const remote = server(modern, 3), cache = pendingStorage(local, 3);
    const c = client(remote.transport, cache.storage); t.after(() => c.sync.close());
    await c.sync.open('account-a'); await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
    assert.equal(c.status().error.code, 'CARE_LIBRARY_RECOVERY_REVIEW', variant);
    assert.equal(await c.sync.flush(), false, variant);
    assert.equal(remote.calls.filter(call => call.action === 'careSave').length, 0, variant);
    assert.deepEqual(remote.state, modern, variant);
  }
});

test('explicit empty libraries remain authoritative and two legacy snapshots retain existing recovery behavior', async t => {
  for (const variant of ['explicit-empty', 'both-legacy']) {
    const modern = libraryState();
    const remoteState = variant === 'both-legacy' ? legacySnapshot(modern) : modern;
    const local = variant === 'both-legacy' ? legacySnapshot(modern) : importBackup({ ...modern, people: modern.people.map(person => ({ ...person, messageLibrary: [], savedMessages: {} })) });
    local.people[0].notes = '기기에서 확인한 변경';
    const remote = server(remoteState, 4), cache = pendingStorage(local, 4);
    const c = client(remote.transport, cache.storage); t.after(() => c.sync.close());
    await c.sync.open('account-a'); await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
    assert.equal(c.status().status, 'idle', variant);
    assert.equal(await c.sync.flush(), true, variant);
    assert.deepEqual(remote.state, local, variant);
  }
});

test('the optional review hook leaves another product same-revision recovery unchanged by default', async t => {
  const local = { items: ['로컬 편집'] }, remoteState = { items: ['계정 기록'] }, prefix = 'fixture.other.';
  const cache = pendingStorage(local, 2, prefix), calls = [], statuses = [];
  let stored = remoteState, revision = 2;
  const sync = createDocumentSync({
    storage: cache.storage, emptyState: () => ({ items: [] }), validateState: structuredClone,
    scope: 'other-product', cachePrefix: prefix, onStatus: value => statuses.push(value),
    transport: async (action, body) => {
      calls.push({ action, body });
      if (action === 'careSave') { assert.equal(body.expected_revision, revision); stored = structuredClone(body.state); revision++; }
      return { ok: true, scope: 'other-product', accountId: 'account-a', revision, state: stored };
    },
  });
  t.after(() => sync.close());
  await sync.open('account-a'); await sync.selectLocalDraft(statuses.at(-1).localDrafts[0].id);
  assert.equal(statuses.at(-1).status, 'idle');
  assert.equal(await sync.flush(), true);
  assert.deepEqual(stored, local);
  assert.equal(calls.filter(call => call.action === 'careSave').length, 1);
});
