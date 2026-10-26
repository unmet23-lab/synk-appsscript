'use strict';
// An explicit conflict choice (resolve) replaces this device's progress drafts. A game storage that is
// already open builds its next write on that choice, without a new read or a new storage handle. What
// an open game read from the account, and the base a choice fixed, stay its compare-and-set base: a
// refresh never rebases it.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const modules = Promise.all(['account-host.mjs', 'play-data.mjs'].map(file => import(pathToFileURL(path.join(__dirname, '..', 'experiences', 'play-common', file)).href)));
const key = 'synk.word-magic.progress.v1';
// `fail(key)` makes this device's storage refuse a write, as a full disk does.
function storage() { const map = new Map(), local = { map, fail: null, get length() { return map.size; }, key: i => [...map.keys()][i] ?? null, getItem: k => map.get(k) ?? null,
  setItem: (k, v) => { if (local.fail?.(k)) throw Error('quota'); map.set(k, String(v)); }, removeItem: k => map.delete(k) }; return local; }
const pendingBodies = local => [...local.map].filter(([k]) => k.includes(':pending:')).map(([, v]) => JSON.parse(v).body);
// One account with the progress compare-and-set of account-host.test.mjs; each device has its own storage.
async function account(records = {}) {
  const [{ createWorldPlayHost }, { emptyPlayState }] = await modules;
  const row = { revision: 0, state: emptyPlayState(), receipts: new Set() }, calls = [], hosts = [];
  Object.assign(row.state.records, records);
  const envelope = () => ({ ok: true, scope: 'synk-play', accountId: 'a', revision: row.revision, state: structuredClone(row.state) });
  const client = { load: async () => envelope(), mutate: async body => {
    calls.push(structuredClone(body));
    if (row.receipts.has(body.id)) return { ...envelope(), duplicate: true };
    for (const c of body.changes) if ((row.state.records[c.key] ?? null) !== c.previous) throw Object.assign(Error('conflict'), { code: 'REVISION_CONFLICT' });
    for (const c of body.changes) { if (c.value === null) delete row.state.records[c.key]; else row.state.records[c.key] = c.value; }
    row.revision++; row.receipts.add(body.id); return envelope();
  } };
  const device = (extra = {}, local = storage()) => { const host = createWorldPlayHost({ accountId: 'a', client: { ...client, ...extra }, guard() {}, storage: local }); hosts.push(host); return host; };
  return { row, calls, client, device, stop: () => hosts.forEach(host => host.stop()) };
}

test('after choosing the account progress, a retained game storage sends the same write or removal again', async t => {
  for (const mode of ['set', 'remove']) for (const read of [false, true]) {
    const label = `${mode}${read ? ' after a read' : ''}`, cloud = await account(mode === 'remove' ? { [key]: '{"last":1}' } : {}); t.after(cloud.stop);
    const other = cloud.device(), here = cloud.device(); await other.ready(); await here.ready();
    const ref = here.storage(); ref.getItem(key);
    other.storage().setItem(key, '{"last":3}'); await other.flush();
    if (mode === 'set') ref.setItem(key, '{"last":2}'); else ref.removeItem(key);
    await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' }, label);
    await here.resolve('remote');
    assert.equal(cloud.row.state.records[key], '{"last":3}', label);
    const sent = cloud.calls.length;
    if (read) assert.equal(ref.getItem(key), '{"last":3}', label);
    if (mode === 'set') ref.setItem(key, '{"last":2}'); else ref.removeItem(key);
    assert.equal(here.status().pending, 1, label);
    await here.flush();
    assert.equal(cloud.calls.length, sent + 1, label);
    assert.equal(cloud.row.state.records[key] ?? null, mode === 'set' ? '{"last":2}' : null, label);
    assert.equal(here.status().phase, 'synced', label);
  }
});

test('after choosing this device\'s progress, every retained storage builds on the chosen draft, even when the next save fails', async t => {
  for (const failing of [false, true]) {
    const label = failing ? 'save fails after the choice' : 'save succeeds', cloud = await account(); t.after(cloud.stop);
    let down = false;
    const other = cloud.device(), here = cloud.device({ mutate: async body => { if (down) throw Object.assign(Error('offline'), { code: 'NETWORK' }); return cloud.client.mutate(body); } });
    await other.ready(); await here.ready();
    const first = here.storage(), second = here.storage();
    other.storage().setItem(key, '{"last":3}'); await other.flush();
    first.setItem(key, '{"last":1}'); second.setItem(key, '{"last":2}');
    await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' }, label);
    down = failing;
    if (failing) await assert.rejects(here.resolve('local'), { code: 'NETWORK' }, label); else await here.resolve('local');
    assert.equal(here.status().pending, failing ? 1 : 0, label);
    // The first game writes its own earlier value again: the chosen '{"last":2}' is its base now.
    first.setItem(key, '{"last":1}');
    assert.equal(here.status().pending, failing ? 2 : 1, label);
    down = false; await here.retry();
    assert.equal(cloud.row.state.records[key], '{"last":1}', label);
    assert.deepEqual(cloud.calls.at(-1).changes, [{ key, previous: '{"last":2}', value: '{"last":1}' }], label);
  }
});

test('a refresh, or a choice about another game\'s draft, never rebases what an open game read from the account', async t => {
  const cloud = await account({ [key]: '{"last":1}' }); t.after(cloud.stop);
  const other = cloud.device(), here = cloud.device(); await other.ready(); await here.ready();
  const reader = here.storage(), bystander = here.storage();
  assert.equal(reader.getItem(key), '{"last":1}'); assert.equal(bystander.getItem(key), '{"last":1}');
  other.storage().setItem(key, '{"last":3}'); await other.flush(); await here.retry();
  reader.setItem(key, '{"last":4}'); await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' });
  await here.resolve('remote');
  // The choice discarded the reader's draft only; the bystander still writes over what it read.
  bystander.setItem(key, '{"last":5}'); await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' });
  assert.equal(cloud.row.state.records[key], '{"last":3}');
});

test('a choice that fails before replacing drafts keeps them and what the game saw; logout still closes the storage', async t => {
  const cloud = await account(), local = storage(); t.after(cloud.stop);
  let offline = false;
  const other = cloud.device(), here = cloud.device({ load: async () => { if (offline) throw Object.assign(Error('offline'), { code: 'NETWORK' }); return cloud.client.load(); } }, local);
  await other.ready(); await here.ready(); const ref = here.storage();
  other.storage().setItem(key, '{"last":3}'); await other.flush();
  ref.setItem(key, '{"last":2}'); await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' });
  await assert.rejects(here.resolve('both'), { code: 'INVALID_RESOLUTION' });
  offline = true; await assert.rejects(here.resolve('remote'), { code: 'NETWORK' });
  // Nothing was chosen: the draft is still queued, and the same write adds nothing.
  ref.setItem(key, '{"last":2}'); assert.equal(here.status().pending, 1);
  offline = false; await here.resolve('remote');
  assert.equal(here.status().pending, 0); assert.ok([...local.map.keys()].some(k => k.includes(':recovery:')));
  here.stop(); assert.throws(() => ref.setItem(key, '{"last":2}'), { code: 'PLAY_SESSION_ENDED' });
  assert.equal(cloud.row.state.records[key], '{"last":3}');
});

test('after a choice, progress another device saves later still meets the retained game; reading it first allows the write', async t => {
  for (const choice of ['remote', 'local']) for (const mode of ['set', 'remove']) for (const read of [false, true]) {
    const label = `${choice}/${mode}${read ? ' after a read' : ''}`, cloud = await account(); t.after(cloud.stop);
    const other = cloud.device(), here = cloud.device(); await other.ready(); await here.ready();
    const ref = here.storage(); ref.getItem(key);
    other.storage().setItem(key, '{"last":1}'); await other.flush();
    ref.setItem(key, '{"last":2}'); await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' }, label);
    await here.resolve(choice);
    assert.equal(cloud.row.state.records[key], choice === 'remote' ? '{"last":1}' : '{"last":2}', label);
    // Another device saves newer progress; this device only receives it with an ordinary refresh.
    await other.retry(); other.storage().setItem(key, '{"last":3}'); await other.flush(); await here.retry();
    const sent = cloud.calls.length;
    if (read) assert.equal(ref.getItem(key), '{"last":3}', label);
    if (mode === 'set') ref.setItem(key, '{"last":4}'); else ref.removeItem(key);
    if (read) {
      await here.flush();
      assert.equal(cloud.row.state.records[key] ?? null, mode === 'set' ? '{"last":4}' : null, label);
    } else {
      await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' }, label);
      assert.equal(cloud.row.state.records[key], '{"last":3}', label);
      assert.equal(cloud.calls[sent].changes[0].previous, choice === 'remote' ? '{"last":1}' : '{"last":2}', `${label}: the base fixed by the choice`);
      assert.equal(here.status().phase, 'conflict', label);
    }
  }
});

test('a local choice this device cannot store keeps the draft it would replace; choosing again once storage is back saves it', async t => {
  for (const refused of [':pending:', ':recovery:']) {
    const label = refused === ':pending:' ? 'chosen draft refused' : 'backup refused', cloud = await account(), local = storage(); t.after(cloud.stop);
    const other = cloud.device(), here = cloud.device({}, local); await other.ready(); await here.ready();
    const ref = here.storage(); ref.getItem(key);
    other.storage().setItem(key, '{"last":1}'); await other.flush();
    ref.setItem(key, '{"last":2}'); await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' }, label);
    local.fail = k => k.includes(refused);
    await assert.rejects(here.resolve('local'), /quota/, label);
    local.fail = null;
    assert.deepEqual(pendingBodies(local).map(body => body.changes), [[{ key, previous: null, value: '{"last":2}' }]], `${label}: the old draft is still queued`);
    if (refused === ':pending:') {
      assert.equal(here.status().code, 'PLAY_STORAGE_UNAVAILABLE', label);
      assert.ok([...local.map.keys()].some(k => k.includes(':recovery:')), label);
      // Nothing was chosen: the same write adds nothing, and the next save shows the conflict again.
      ref.setItem(key, '{"last":2}'); assert.equal(here.status().pending, 1, label);
      await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' }, label);
    }
    assert.equal(cloud.row.state.records[key], '{"last":1}', label);
    await here.resolve('local');
    assert.equal(cloud.row.state.records[key], '{"last":2}', label);
    assert.equal(here.status().pending, 0, label); assert.equal(here.status().phase, 'synced', label);
    ref.setItem(key, '{"last":2}'); assert.equal(here.status().pending, 0, `${label}: the stored choice is the base`);
  }
});

test('when only some chosen drafts can be stored, none replaces the old drafts; choosing again saves every record', async t => {
  const otherKey = 'synk.talk-rally.v1', cloud = await account(), local = storage(); t.after(cloud.stop);
  const other = cloud.device(), here = cloud.device({}, local); await other.ready(); await here.ready();
  const ref = here.storage(), theirs = other.storage();
  theirs.setItem(key, '{"last":1}'); theirs.setItem(otherKey, '{"last":1}'); await other.flush();
  ref.setItem(key, '{"last":2}'); ref.setItem(otherKey, '{"last":2}');
  await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' });
  const before = pendingBodies(local);
  let writes = 0; local.fail = k => k.includes(':pending:') && ++writes > 1;
  await assert.rejects(here.resolve('local'), /quota/);
  local.fail = null;
  assert.equal(writes, 2, 'the first chosen draft was stored before the second failed');
  assert.deepEqual(pendingBodies(local), before, 'the stored one was taken back and both old drafts stay');
  assert.equal(here.status().code, 'PLAY_STORAGE_UNAVAILABLE');
  await here.resolve('local');
  assert.deepEqual([cloud.row.state.records[key], cloud.row.state.records[otherKey]], ['{"last":2}', '{"last":2}']);
  assert.equal(here.status().pending, 0);
});

// Local choices whose save failed on the network, then the account progress: one host, a chain of choices.
async function chosenTwice(failures, games = 1) {
  const cloud = await account();
  let down = false;
  const other = cloud.device(), here = cloud.device({ mutate: async body => { if (down) throw Object.assign(Error('offline'), { code: 'NETWORK' }); return cloud.client.mutate(body); } });
  await other.ready(); await here.ready();
  const refs = Array.from({ length: games }, () => here.storage()); refs[0].getItem(key);
  other.storage().setItem(key, '{"last":1}'); await other.flush();
  refs.forEach((ref, i) => ref.setItem(key, JSON.stringify({ last: i + 2 })));
  await assert.rejects(here.flush(), { code: 'REVISION_CONFLICT' });
  down = true;
  for (let i = 0; i < failures; i++) await assert.rejects(here.resolve('local'), { code: 'NETWORK' });
  assert.equal(here.status().pending, 1);
  down = false; await here.resolve('remote');
  assert.equal(here.status().pending, 0); assert.equal(cloud.row.state.records[key], '{"last":1}');
  return { cloud, here, refs };
}

test('a retained game that skipped a chain of choices builds on the last one, not on a replaced local draft', async t => {
  for (const failures of [1, 2]) for (const mode of ['set', 'remove', 'read']) {
    const label = `${failures} failed local choice(s), ${mode}`, { cloud, here, refs: [ref] } = await chosenTwice(failures); t.after(cloud.stop);
    const sent = cloud.calls.length;
    if (mode === 'read') assert.equal(ref.getItem(key), '{"last":1}', label);
    if (mode === 'remove') ref.removeItem(key); else ref.setItem(key, '{"last":2}');
    assert.equal(here.status().pending, 1, label);
    await here.flush();
    assert.deepEqual(cloud.calls.slice(sent).map(body => body.changes), [[{ key, previous: '{"last":1}', value: mode === 'remove' ? null : '{"last":2}' }]], label);
    assert.equal(cloud.row.state.records[key] ?? null, mode === 'remove' ? null : '{"last":2}', label);
  }
});

test('several retained games that skipped the same chain each build on its last choice', async t => {
  for (const writer of [0, 1]) {
    const { cloud, here, refs } = await chosenTwice(1, 2), value = JSON.stringify({ last: writer + 2 }); t.after(cloud.stop);
    const sent = cloud.calls.length;
    refs[writer].setItem(key, value); assert.equal(here.status().pending, 1, `game ${writer}`);
    await here.flush();
    assert.deepEqual(cloud.calls.slice(sent).map(body => body.changes), [[{ key, previous: '{"last":1}', value }]], `game ${writer}`);
    assert.equal(cloud.row.state.records[key], value, `game ${writer}`);
  }
});
