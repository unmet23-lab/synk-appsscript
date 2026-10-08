import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareSync } from '../care-sync.mjs';
import { emptyState, makePerson, importBackup } from '../model.mjs';

function storage() {
  const data = new Map();
  return { data, get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const notebook = (checkinIntervalDays, { library = true } = {}) => ({ ...emptyState(), people: [makePerson({
  id: 'person-a', name: '합성 안부 사람', ...(library ? { messageLibrary: [] } : {}),
  ...(checkinIntervalDays === undefined ? {} : { checkinIntervalDays }),
})] });
function withoutPreference(state) {
  return importBackup({ ...state, people: state.people.map(({ checkinIntervalDays, ...person }) => person) });
}
function pending(state, revision) {
  const local = storage(), key = 'synk.care.account.v1.account-a';
  const raw = JSON.stringify({ version: 1, accountId: 'account-a', baseRevision: revision, state, pending: true });
  local.setItem(key, raw); return { local, key, raw };
}
function server(initial = null, initialRevision = 0) {
  let current = initial === null ? null : importBackup(initial), revision = initialRevision;
  const calls = [];
  return { calls, state: () => current,
    async transport(action, body) {
      calls.push({ action, body });
      if (action !== 'careLoad') {
        if (body.expected_revision !== revision) return { ok: false, error: { code: 'REVISION_CONFLICT' }, revision };
        if (action === 'careSave') {
          assert.equal(body.messageLibraryVersion, 1);
          assert.equal(body.checkinPreferenceVersion, 1);
          current = importBackup(body.state);
        } else current = null;
        revision++;
      }
      return { ok: true, scope: 'synk-care', accountId: 'account-a', revision, state: current === null ? null : importBackup(current) };
    },
  };
}
function client(transport, local = storage()) {
  const states = [], statuses = [];
  const sync = createCareSync({ transport, storage: local, onState: state => states.push(state), onStatus: value => statuses.push(value) });
  return { sync, visible: () => states.at(-1), status: () => statuses.at(-1) };
}
const saves = remote => remote.calls.filter(call => call.action === 'careSave');
const hasRaw = (client, cache) => client.sync.exportLocalRecords().entries.some(entry => entry.key === cache.key && entry.raw === cache.raw);

test('checkin preference saves carry both capabilities while reads and deletion remain unmarked', async t => {
  const remote = server(), first = client(remote.transport), second = client(remote.transport);
  t.after(() => { first.sync.close(); second.sync.close(); });
  await first.sync.open('account-a'); first.sync.change(notebook(0));
  assert.equal(await first.sync.flush(), true);
  await second.sync.open('account-a');
  assert.equal(second.visible().people[0].checkinIntervalDays, 0);
  second.sync.change(notebook(365)); assert.equal(await second.sync.flush(), true);
  await first.sync.refresh(); assert.equal(first.visible().people[0].checkinIntervalDays, 365);
  assert.equal(await second.sync.remove(), true);
  for (const { action, body } of remote.calls) for (const marker of ['messageLibraryVersion', 'checkinPreferenceVersion']) {
    assert.equal(Object.hasOwn(body ?? {}, marker), action === 'careSave');
    if (action === 'careSave') assert.equal(body[marker], 1);
  }
});

test('same-revision old pending state retaining the library cannot silently drop an explicit cadence including disabled zero', async t => {
  for (const interval of [0, 1, 30, 365]) {
    const modern = notebook(interval), legacy = withoutPreference(modern), revision = 6;
    legacy.people[0].notes = '안부 설정을 모르던 앱의 수정';
    const cache = pending(legacy, revision), remote = server(modern, revision), c = client(remote.transport, cache.local);
    t.after(() => c.sync.close());
    await c.sync.open('account-a');
    assert.equal(c.status().status, 'local-conflict');
    await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
    assert.equal(c.status().status, 'conflict', String(interval));
    assert.equal(c.status().error.code, 'CARE_LIBRARY_RECOVERY_REVIEW');
    assert.match(c.status().error.message, /안부 주기 설정.*임시기록/u);
    assert.equal(await c.sync.flush(), false);
    assert.equal(saves(remote).length, 0);
    assert.ok(hasRaw(c, cache));
    assert.equal(await c.sync.resolveRemote(), true);
    assert.deepEqual(c.visible(), modern);
    assert.ok(hasRaw(c, cache), 'choosing the account keeps the original offline note exportable');
    assert.equal(saves(remote).length, 0);
  }
});

test('a failed selection refresh must recheck a disabled account preference before subsequent edit autosave', async t => {
  const modern = notebook(0), legacy = withoutPreference(modern), revision = 4;
  const cache = pending(legacy, revision), remote = server(modern, revision); let failNextLoad = false;
  const c = client(async (action, body) => {
    if (action === 'careLoad' && failNextLoad) { failNextLoad = false; throw new Error('offline once'); }
    return remote.transport(action, body);
  }, cache.local);
  t.after(() => c.sync.close());
  await c.sync.open('account-a'); failNextLoad = true;
  await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
  assert.equal(c.status().status, 'offline');
  const edited = importBackup(c.visible()); edited.people[0].notes = '연결 실패 뒤 다시 수정'; c.sync.change(edited);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(c.status().status, 'conflict');
  assert.equal(await c.sync.flush(), false);
  assert.equal(saves(remote).length, 0);
  assert.deepEqual(remote.state(), modern);
  assert.ok(hasRaw(c, cache));
  assert.equal(await c.sync.resolveRemote(), true);
  assert.deepEqual(c.visible(), modern);
  assert.ok(hasRaw(c, cache));
});

test('missing local owner and a preference-only account without any library both require recovery review', async t => {
  for (const removedPerson of [false, true]) {
    const modern = notebook(90, { library: false });
    const legacy = removedPerson ? emptyState() : withoutPreference(modern);
    const cache = pending(legacy, 2), remote = server(modern, 2), c = client(remote.transport, cache.local);
    t.after(() => c.sync.close());
    await c.sync.open('account-a'); await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
    assert.equal(c.status().error.code, 'CARE_LIBRARY_RECOVERY_REVIEW');
    assert.equal(await c.sync.flush(), false);
    assert.equal(saves(remote).length, 0);
  }
});

test('explicit local zero or default thirty are authoritative while both-absent legacy snapshots remain compatible', async t => {
  for (const interval of [undefined, 0, 30, 365]) {
    const modern = notebook(interval === undefined ? undefined : 7), local = notebook(interval);
    local.people[0].notes = '내가 직접 선택한 설정';
    const cache = pending(local, 3), remote = server(modern, 3), c = client(remote.transport, cache.local);
    t.after(() => c.sync.close());
    await c.sync.open('account-a'); await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
    assert.equal(c.status().status, 'idle');
    assert.equal(await c.sync.flush(), true);
    assert.deepEqual(remote.state(), local);
    assert.equal(Object.hasOwn(remote.state().people[0], 'checkinIntervalDays'), interval !== undefined);
  }
});

test('only explicit local resolution can accept replacing an account preference with a legacy snapshot', async t => {
  const modern = notebook(0), legacy = withoutPreference(modern), cache = pending(legacy, 5), remote = server(modern, 5);
  const c = client(remote.transport, cache.local); t.after(() => c.sync.close());
  await c.sync.open('account-a'); await c.sync.selectLocalDraft(c.status().localDrafts[0].id);
  assert.equal(c.status().status, 'conflict'); assert.equal(await c.sync.flush(), false);
  assert.equal(saves(remote).length, 0); assert.ok(hasRaw(c, cache));
  assert.equal(await c.sync.resolveLocal(), true);
  assert.equal(saves(remote).length, 1);
  assert.deepEqual(remote.state(), legacy);
});

test('a server upgrade rejection keeps pending preferences and explains settings as well as saved messages', async t => {
  const remote = server();
  const c = client((action, body) => action === 'careSave' ? { ok: false, error: { code: 'CARE_CLIENT_UPDATE_REQUIRED' } } : remote.transport(action, body));
  t.after(() => c.sync.close());
  await c.sync.open('account-a'); const state = notebook(0); c.sync.change(state);
  assert.equal(await c.sync.flush(), false);
  assert.equal(c.status().status, 'error');
  assert.match(c.status().error.message, /문구 보관함.*안부 설정.*백업.*새로고침/u);
  assert.equal(c.status().pending, true);
  assert.deepEqual(JSON.parse(c.sync.exportLocalRecords().entries[0].raw).state, importBackup(state));
});
