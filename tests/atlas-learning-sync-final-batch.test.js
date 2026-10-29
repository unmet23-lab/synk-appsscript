'use strict';
// The upload budget (maxPages) counts requests. A queue the last allowed request empties is synced;
// only entries still queued after it (added meanwhile here or by another context) wait for the next try.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../atlas/game-learning');
const { createLearningSync, SYNC_KEY } = require('../atlas/learning-sync');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const copy = value => JSON.parse(JSON.stringify(value));
const disk = (watch = {}) => { const values = new Map(); return { values, getItem: k => values.get(k) ?? null,
  setItem: (k, v) => { if (watch.ended) (watch.late ||= []).push(k); values.set(k, String(v)); }, removeItem: k => values.delete(k) }; };
const outcome = state => [state.phase, state.code, state.queued];
// A server that keeps every acknowledged entry; `hold` keeps the next upload waiting for release().
function server() {
  const cloud = { log: [], posts: [], hold: false, release: null };
  cloud.get = async ({ after }) => { const events = copy(cloud.log.slice(after)); return { revision: 1, events, cursor: after + events.length, hasMore: false }; };
  cloud.post = ({ events }) => {
    cloud.posts.push(copy(events));
    const reply = () => { for (const e of events) if (!cloud.log.some(kept => kept.id === e.id)) cloud.log.push(copy(e)); return { revision: 1, accepted: events.map(e => e.id) }; };
    if (!cloud.hold) return Promise.resolve(reply());
    return new Promise(resolve => { cloud.release = () => { cloud.hold = false; cloud.release = null; resolve(reply()); }; });
  };
  return cloud;
}
const account = (storage, gameId = 'final-batch') => createGame({ gameId, map, storage, storageScope: 'account', accountKey: 'acct', historyComplete: false });
const syncOf = (game, storage, transport, options) => createLearningSync({ adapter: game, accountKey: 'acct', revision: 1, storage, transport,
  auto: false, maxAttempts: 1, backoffMs: [0], sleep: async () => {}, ...options });
let serial = 0;
const present = game => { const id = `final.${++serial}`; return game.present({ id, itemKey: `${id}:v1`, familyKey: id, skillId: 'ko.reading.detail',
  difficulty: 1, modality: 'reading', responseFormat: 'single-choice', audioRequired: false }); };
const practise = game => game.answer(present(game), { correct: true, assessable: true });
const ids = events => events.map(e => e.id).sort();
async function waitFor(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('expected upload did not arrive');
}

test('a local answer arriving before a pull continuation still requests automatic upload', async () => {
  const storage=disk(),local=account(storage),cloud=server(),sync=syncOf(local,storage,cloud,{auto:true,maxPages:1,batchSize:200});
  try {
    await sync.start();
    const remote=account(disk());practise(remote);cloud.log=copy(remote.events());
    cloud.get=async({after})=>{const events=copy(cloud.log.slice(after,after+2));return{revision:1,events,cursor:after+events.length,hasMore:after+events.length<cloud.log.length};};
    await sync.pull();
    practise(local);
    const expected=[...new Set([...ids(remote.events()),...ids(local.events())])].sort();
    await waitFor(()=>cloud.posts.length>0&&sync.status().queued===0);
    assert.deepEqual(ids(cloud.log),expected);assert.equal(sync.status().complete,true);
  } finally { sync.stop(); }
});

test('an empty queue and a queue the only allowed upload empties are both synced', async () => {
  const empty = server(), storage = disk(), idle = account(storage), quiet = syncOf(idle, storage, empty, { maxPages: 1, batchSize: 2 });
  assert.deepEqual(outcome(await quiet.start()), ['synced', null, 0]); assert.equal(empty.posts.length, 0); quiet.stop();
  // The decision and presentation of one item: exactly one batch under a budget of one upload.
  const cloud = server(), store = disk(), game = account(store);
  present(game); assert.equal(game.events().length, 2);
  const sync = syncOf(game, store, cloud, { maxPages: 1, batchSize: 2 });
  assert.deepEqual(outcome(await sync.start()), ['synced', null, 0]);
  assert.equal(cloud.posts.length, 1); assert.deepEqual(ids(cloud.log), ids(game.events())); sync.stop();
});

test('the last allowed of several uploads completes the sync; a queue left past the budget waits for the next try', async () => {
  for (const spare of [0, 1]) {
    const cloud = server(), storage = disk(), game = account(storage);
    for (let i = 0; i < 3; i++) practise(game);
    const total = game.events().length, uploads = Math.ceil(total / 2), maxPages = uploads - spare;
    const sync = syncOf(game, storage, cloud, { maxPages, batchSize: 2 });
    const first = await sync.start();
    assert.equal(cloud.posts.length, maxPages);
    if (!spare) assert.deepEqual(outcome(first), ['synced', null, 0]);
    else {
      assert.deepEqual(outcome(first), ['offline', 'NETWORK_ERROR', total - 2 * maxPages]);
      assert.deepEqual(outcome(await sync.retry()), ['synced', null, 0]); assert.equal(cloud.posts.length, uploads);
    }
    assert.deepEqual(ids(cloud.log), ids(game.events())); sync.stop();
  }
});

test('an entry added during the last acknowledgement, here or by another context, stays queued for the next try', async () => {
  for (const where of ['here', 'other-context']) {
    const cloud = server(), storage = disk(), game = account(storage);
    present(game);
    const sync = syncOf(game, storage, cloud, { maxPages: 1, batchSize: 2 });
    cloud.hold = true; const running = sync.start(); await waitFor(() => cloud.release);
    // Another tab on the same account store writes the log; this synchroniser hears nothing of it.
    let added;
    if (where === 'here') { present(game); added = game.events().length - 2; }
    else { const other = account(storage, 'other-tab'); present(other); added = other.events().length - 2; }
    cloud.release();
    assert.deepEqual(outcome(await running), ['offline', 'NETWORK_ERROR', added], where);
    assert.equal(cloud.posts.length, 1, where); assert.equal(cloud.log.length, 2, where);
    assert.deepEqual(outcome(await sync.retry()), ['synced', null, 0], where);
    assert.equal(cloud.posts.length, 2, where); assert.deepEqual(ids(cloud.log), ids(game.events()), where); sync.stop();
  }
});

test('a status observer that stops or invalidates the sync at an acknowledgement ends the run without another collect or save', async () => {
  // A budget of one ends at the last acknowledgement; a budget of two stops at the next upload's start.
  for (const end of ['stop', 'invalidate']) for (const maxPages of [1, 2]) {
    const watch = {}, cloud = server(), storage = disk(watch), game = account(storage);
    present(game); if (maxPages === 2) practise(game);
    let sync;
    const onStatus = state => {
      if (watch.ended || state.phase !== 'syncing' || cloud.posts.length !== 1) return;
      watch.ended = true; if (end === 'stop') sync.stop(); else sync.invalidate();
    };
    sync = syncOf(game, storage, cloud, { maxPages, batchSize: 2, onStatus });
    const state = await sync.start(), label = `${end}/${maxPages}`;
    assert.ok(watch.ended, label);
    assert.deepEqual([state.phase, state.code], end === 'stop' ? ['stopped', null] : ['blocked', 'STORAGE_ERROR'], label);
    assert.deepEqual(watch.late || [], [], `${label}: nothing written after the observer ended the sync`);
    assert.equal(cloud.posts.length, 1, label);
    assert.equal(JSON.parse(storage.getItem(`${SYNC_KEY}.acct`)).pending.length, game.events().length - 2, label);
    sync.stop();
  }
});
