import test from 'node:test';
import assert from 'node:assert/strict';
import { careAccountView, resumeCareLoginNavigation } from '../care-account-view.mjs';
import { createCareSync } from '../care-sync.mjs';
import { emptyState, makePerson } from '../model.mjs';

test('initial and interim signed-out account states remain loading until start completes', () => {
  for (const account of [{ configured: false, status: 'loading' }, { configured: true, status: 'signed-out' }]) {
    const view = careAccountView({ starting: true, account });
    assert.equal(view.loading, true);assert.equal(view.locked, true);assert.equal(view.concealNotebook, true);assert.equal(view.signInDisabled, true);
    assert.doesNotMatch(view.title, /설정이 아직|0명|등록한 사람이 없/);
  }
});
test('account restoration and the gap before notebook loading conceal an empty replacement state', () => {
  for (const input of [{ account: { status: 'restoring' } }, { connected: true, sync: { status: 'idle' } }, { connected: true, sync: { status: 'loading' } }]) {
    const view = careAccountView(input);assert.equal(view.concealNotebook, true);assert.equal(view.locked, true);
  }
});
test('final unconfigured, signed-out and failed states unlock the local notebook with accurate copy', () => {
  const absent = careAccountView({ account: { configured: false, status: 'unconfigured' } });
  assert.equal(absent.loading, false);assert.equal(absent.locked, false);assert.match(absent.title, /설정/);
  const guest = careAccountView({ account: { configured: true, status: 'signed-out' } });
  assert.equal(guest.signInDisabled, false);assert.equal(guest.concealNotebook, false);
  const failed = careAccountView({ account: { configured: true, status: 'error', error: { message: '연결 응답이 없어요.' } } });
  assert.equal(failed.kind, 'error');assert.equal(failed.detail, '연결 응답이 없어요.');assert.equal(failed.locked, false);
});
test('received revision zero and selected local notebooks stay usable while saves wait or fail', () => {
  for (const status of ['idle', 'synced', 'saving', 'offline', 'conflict', 'error', 'storage-error']) {
    for (const receipt of [{ revision: 0 }, { revision: 6 }, { revision: null, pending: true }]) {
      const view = careAccountView({ connected: true, sync: { status, ...receipt } });
      assert.equal(view.locked, false, `${status} ${JSON.stringify(receipt)}`);
      assert.equal(view.concealNotebook, false);assert.equal(view.canImportDevice, true);
    }
  }
  const choice = careAccountView({ connected: true, sync: { status: 'local-conflict' } });
  assert.equal(choice.locked, true);assert.equal(choice.loading, false);assert.match(choice.title, /수첩을 골라/);
  assert.equal(choice.canImportDevice, false);
});

test('first notebook failure keeps inputs and device import locked but offers retry without a spinner', () => {
  for (const status of ['offline', 'error', 'storage-error']) {
    const view = careAccountView({ connected: true, sync: { status, revision: null, pending: false, error: { message: '수첩 응답을 확인하지 못했어요.' } } });
    assert.equal(view.locked, true);assert.equal(view.concealNotebook, true);assert.equal(view.loading, false);
    assert.equal(view.kind, 'error');assert.equal(view.canImportDevice, false);assert.equal(view.canRetryNotebook, true);
    assert.match(view.detail, /수첩 응답/);assert.match(view.detail, /다시 불러오기/);
  }
});
test('a received notebook refresh is visible but does not accept edits until the read finishes', () => {
  const view = careAccountView({ connected: true, sync: { status: 'loading', revision: 0 } });
  assert.equal(view.concealNotebook, false);assert.equal(view.locked, true);assert.equal(view.canImportDevice, false);assert.equal(view.canRetryNotebook, false);
});
test('local notebook selection stays concealed during same-account token restoration', () => {
  const view = careAccountView({ connected: true, currentAccountId: 'owner-a', account: { status: 'restoring', accountId: 'owner-a' }, sync: { status: 'local-conflict', accountId: 'owner-a', revision: 3, pending: true } });
  assert.equal(view.concealNotebook, true);assert.equal(view.locked, true);assert.equal(view.canImportDevice, false);
});

test('token restoration only preserves the visible notebook when all current account identities match', () => {
  const input = { connected: true, currentAccountId: 'owner-a', account: { status: 'restoring', accountId: 'owner-a' }, sync: { status: 'synced', accountId: 'owner-a', revision: 1 } };
  const retained = careAccountView(input);
  assert.equal(retained.concealNotebook, false);assert.equal(retained.locked, true);assert.equal(retained.canImportDevice, false);
  for (const accountId of [null, 'owner-b']) assert.equal(careAccountView({ ...input, account: { ...input.account, accountId } }).concealNotebook, true);
  assert.equal(careAccountView({ ...input, currentAccountId: 'owner-b' }).concealNotebook, true);
});
test('BFCache return only releases the outgoing login presentation, without asserting login or clearing identity', () => {
  const outgoing = { configured: true, signedIn: false, accountId: null, status: 'signing-in', sessionGeneration: 3 };
  const returned = resumeCareLoginNavigation(outgoing, true);
  assert.equal(outgoing.status, 'signing-in');assert.equal(returned.status, 'login-returned');assert.equal(returned.signedIn, false);assert.equal(returned.sessionGeneration, 3);
  const view = careAccountView({ account: returned });
  assert.equal(view.signInDisabled, false);assert.equal(view.concealNotebook, false);assert.match(view.detail, /완료를 확인하지 못/);
  for (const snapshot of [{ ...outgoing, signedIn: true }, { ...outgoing, accountId: 'owner-a' }, { ...outgoing, status: 'restoring' }]) assert.equal(resumeCareLoginNavigation(snapshot, true), snapshot);
  assert.equal(resumeCareLoginNavigation(outgoing, false), outgoing);
});

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const notebook = name => ({ ...emptyState(), people: [makePerson({ id: 'synthetic-person', name })] });
function storage() {
  const records = new Map();
  return { records, get length() { return records.size; }, key: i => [...records.keys()][i] ?? null, getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
}
function fixture(t, transport, local = storage()) {
  let state = emptyState(), status;
  const notifications = [];
  const sync = createCareSync({ transport, storage: local, onState: next => { state = next; }, onStatus: next => { status = next;notifications.push(next); } });
  t.after(() => sync.close());
  return { sync, local, notifications, state: () => state, status: () => status, view: () => careAccountView({ connected: true, sync: status }) };
}
const reply = (revision = 0, state = null) => ({ ok: true, scope: 'synk-care', accountId: 'owner-a', revision, state });

test('real sync: first fetch fails locked, then retry receives an empty revision-zero notebook', async t => {
  let unavailable = true;
  const client = fixture(t, async () => { if (unavailable) throw Error('offline');return reply(); });
  await client.sync.open('owner-a');
  assert.equal(client.status().revision, null);assert.equal(client.view().loading, false);assert.equal(client.view().locked, true);assert.equal(client.view().canImportDevice, false);
  unavailable = false;await client.sync.refresh();
  assert.equal(client.status().revision, 0);assert.equal(client.view().locked, false);assert.equal(client.view().canImportDevice, true);
});
test('real sync: change idle, in-flight re-edit, and save acknowledgement retain a usable notebook', async t => {
  const saveGate = deferred();let revision = 0, saveCount = 0;
  const client = fixture(t, async (action, body) => {
    if (action === 'careLoad') return reply(revision);
    if (++saveCount === 1) await saveGate.promise;
    return reply(++revision, body.state);
  });
  await client.sync.open('owner-a');client.sync.change(notebook('첫 입력'));
  assert.equal(client.status().status, 'idle');assert.equal(client.view().locked, false);
  const saving = client.sync.flush();await tick();
  client.sync.change(notebook('저장 중 새 입력'));
  assert.equal(client.status().status, 'idle');assert.equal(client.view().locked, false);
  saveGate.resolve();await saving;
  assert.equal(saveCount, 2);assert.equal(client.status().pending, false);
  for (const notification of client.notifications.filter(item => item.status === 'idle')) assert.equal(careAccountView({ connected: true, sync: notification }).locked, false);
});
test('real sync: an explicitly selected valid local draft remains visible offline before a remote revision exists', async t => {
  const local = storage();
  local.setItem('synk.care.account.v1.owner-a', JSON.stringify({ version: 1, accountId: 'owner-a', baseRevision: null, state: notebook('직접 고른 미저장 초안'), pending: true }));
  const client = fixture(t, async () => { throw Error('offline'); }, local);
  await client.sync.open('owner-a');assert.equal(client.view().locked, true);
  assert.equal(await client.sync.selectLocalDraft(client.status().localDrafts[0].id), true);
  assert.equal(client.status().revision, null);assert.equal(client.status().pending, true);
  assert.equal(client.state().people[0].name, '직접 고른 미저장 초안');assert.equal(client.view().locked, false);assert.equal(client.view().concealNotebook, false);
});
test('real sync: a corrupt-cache warning cannot expose the empty notebook while its remote read is pending', async t => {
  const gate = deferred(), local = storage(), raw = '{"accountId":"owner-a","damaged":true}';
  local.setItem('synk.care.account.v1.owner-a', raw);
  const client = fixture(t, async () => { await gate.promise;return reply(3, notebook('서버에서 받은 사람')); }, local);
  const opening = client.sync.open('owner-a');await tick();
  assert.equal(client.status().status, 'error');assert.equal(client.status().revision, null);assert.equal(client.view().locked, true);assert.equal(client.view().canImportDevice, false);assert.equal(client.view().loading, false);
  gate.resolve();await opening;
  assert.equal(client.state().people[0].name, '서버에서 받은 사람');assert.equal(client.status().status, 'error');assert.equal(client.view().locked, false);
  assert.equal(local.getItem('synk.care.account.v1.owner-a'), raw);
});
test('real sync: unavailable local storage cannot turn first loading into editable empty account data', async t => {
  const gate = deferred(), local = storage();Object.defineProperty(local, 'length', { get() { throw Error('storage denied'); } });
  const client = fixture(t, async () => { await gate.promise;return reply(); }, local);
  const opening = client.sync.open('owner-a');await tick();
  assert.equal(client.status().status, 'storage-error');assert.equal(client.view().locked, true);assert.equal(client.view().canRetryNotebook, true);
  gate.resolve();await opening;
  assert.equal(client.status().revision, 0);assert.equal(client.view().locked, false);
});
test('real sync: clearing corrupt recovery after a failed read stays locked with retry available', async t => {
  const local = storage();local.setItem('synk.care.account.v1.owner-a', '{"accountId":"owner-a","damaged":true}');
  const client = fixture(t, async () => { throw Error('offline'); }, local);
  await client.sync.open('owner-a');assert.equal(client.sync.clearLocalRecords(), true);
  assert.equal(client.status().status, 'synced');assert.equal(client.status().revision, null);
  assert.equal(client.view().locked, true);assert.equal(client.view().loading, false);assert.equal(client.view().canRetryNotebook, true);
});
