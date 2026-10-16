'use strict';
const { test, before } = require('node:test'), assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
let createMemberActivity, emptyMemberActivity;
before(async () => {
  ({ createMemberActivity } = await import('../desktop/renderer/member-activity-controller.mjs'));
  ({ emptyMemberActivity } = await import('../experiences/synk-account/src/member-activity-data.mjs'));
});
const NOW = Date.parse('2026-10-14T12:00:00.000Z'), iso = value => new Date(value).toISOString();
const event = (appId = 'world', at = NOW - 1000) => ({ id: randomUUID(), appId, at: iso(at) });
const active = (events = []) => ({ version: 1, consent: true, enabledAt: iso(NOW - 100 * 86400000), events, favorites: [] });
const deferred = () => { let resolve, reject;const promise = new Promise((yes, no) => { resolve = yes;reject = no; });return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ state = null, favorites = [], timeoutMs = 1000, signedIn = true } = {}) {
  const owner = randomUUID(), records = new Map([[owner, { state: structuredClone(state), revision: state ? 1 : 0 }]]), calls = [];
  let current = NOW, identity = { status: signedIn ? 'signed-in' : 'signed-out', signedIn, accountId: owner, sessionGeneration: 1 }, hook, generated = 0;
  const snapshot = id => { const row = records.get(id) || { state: null, revision: 0 };return { ok: true, scope: 'synk-personal', resource: 'member-insight', accountId: id, updatedAt: iso(current), ...structuredClone(row) }; };
  const dispatch = (op, params, id) => {
    if (op === 'insightLoad') return snapshot(id);
    assert.equal(op, 'insightSave');
    const previous = records.get(id) || { state: null, revision: 0 };
    if (previous.revision !== params.expected_revision) throw Object.assign(new Error('CAS conflict'), { code: 'REVISION_CONFLICT' });
    records.set(id, { state: structuredClone(params.state), revision: previous.revision + 1 });return snapshot(id);
  };
  const controller = createMemberActivity({ getIdentity: () => identity, getFavorites: () => favorites, now: () => current,
    uuid: () => { generated++;return randomUUID(); }, timeoutMs,
    request: async (operation, params) => {
      const id = identity.accountId, call = { operation, params: structuredClone(params), owner: id };calls.push(call);
      return hook ? hook(call, () => dispatch(operation, params, id)) : dispatch(operation, params, id);
    },
  });
  return { controller, owner, records, calls, snapshot,
    get generated() { return generated; },
    setHook(value) { hook = value; }, setNow(value) { current = value; },
    setIdentity(value) { identity = { ...identity, ...value }; },
    saved(id = owner) { return structuredClone(records.get(id)); },
  };
}

test('signed-out/default-off never collect, and unrelated launch IDs never reach the account', async () => {
  const signedOut = fixture({ signedIn: false });
  await signedOut.controller.refresh();await signedOut.controller.trackLaunch('world');await signedOut.controller.setConsent(true);
  assert.equal(signedOut.calls.length, 0);assert.equal(signedOut.controller.read().activity, null);
  const f = fixture();await f.controller.refresh();
  assert.equal(f.controller.read().activity.availability, 'disabled');
  await f.controller.trackLaunch('world');assert.equal(f.calls.filter(call => call.operation === 'insightSave').length, 0);
  const before = f.calls.length;await f.controller.trackLaunch('fortune');await f.controller.trackLaunch('https://untrusted.invalid');assert.equal(f.calls.length, before);
});

test('consent activation uses only deduplicated allowed favorites; off immediately hides data and removes all metadata', async () => {
  const f = fixture({ favorites: ['pulse', 'world', 'pulse', 'teacher'] });
  await f.controller.setConsent(true);await f.controller.trackLaunch('path');
  assert.deepEqual(f.saved().state.favorites, ['pulse', 'world']);assert.equal(f.saved().state.events.length, 1);
  const gate = deferred();f.setHook((call, dispatch) => call.operation === 'insightSave' ? gate.promise.then(dispatch) : dispatch());
  const clearing = f.controller.setConsent(false);
  assert.equal(f.controller.read().activity.availability, 'disabled');assert.deepEqual(f.controller.read().activity.interests, []);assert.equal(f.controller.read().pending, true);
  await tick();gate.resolve();await clearing;
  assert.deepEqual(f.saved().state, emptyMemberActivity());assert.equal(f.controller.read().pending, false);
  await f.controller.trackLaunch('pulse');assert.deepEqual(f.saved().state, emptyMemberActivity());
  f.setHook();f.setNow(NOW + 1000);await f.controller.setConsent(true);await f.controller.trackLaunch('world');
  assert.equal(f.saved().state.enabledAt, iso(NOW + 1000));assert.equal(f.saved().state.events.length, 1);
});

test('a delayed prior owner or prior session response cannot populate current RAM or trigger a save', async () => {
  for (const changeOwner of [true, false]) {
    const f = fixture({ state: active([event()]) }), gate = deferred();let intercepted = false;
    f.setHook((call, dispatch) => { if (!intercepted) { intercepted = true;const response = dispatch();return gate.promise.then(() => response); }return dispatch(); });
    const pending = f.controller.trackLaunch('pulse');await tick();
    const nextOwner = changeOwner ? randomUUID() : f.owner;
    f.setIdentity({ accountId: nextOwner, sessionGeneration: 2 });assert.equal(f.controller.read().activity, null);
    gate.resolve();await pending;
    assert.equal(f.calls.filter(call => call.operation === 'insightSave').length, 0);assert.equal(f.controller.read().activity, null);
    f.setHook();await f.controller.refresh();assert.equal(f.controller.read().status, 'ready');
    assert.equal(f.calls.at(-1).owner, nextOwner);
  }
});

test('malformed, wrong-scope, wrong-resource and wrong-account envelopes never permit mutation', async () => {
  for (const change of [
    { scope: 'synk-play' }, { resource: 'platform-library' }, { accountId: randomUUID() }, { revision: -1 },
    { state: { ...active(), notes: ['forbidden'] } }, { state: undefined }, { ok: false },
  ]) {
    const f = fixture({ state: active() });f.setHook((_call, dispatch) => ({ ...dispatch(), ...change }));
    await f.controller.trackLaunch('world');assert.equal(f.controller.read().status, 'error');assert.equal(f.controller.read().activity, null);
    assert.equal(f.calls.filter(call => call.operation === 'insightSave').length, 0);
  }
});

test('CAS retry preserves one launch UUID, concurrent remote events and the original launch time', async () => {
  const original = event('path', NOW - 1000), remote = event('pulse', NOW + 1000), f = fixture({ state: active([original]) });let conflicts = 0;
  f.setHook((call, dispatch) => {
    if (call.operation === 'insightSave' && conflicts++ === 0) {
      f.records.set(f.owner, { state: active([original, remote]), revision: 2 });f.setNow(NOW + 2000);
      throw Object.assign(new Error('concurrent device'), { code: 'REVISION_CONFLICT' });
    }
    return dispatch();
  });
  await f.controller.trackLaunch('world');
  const saves = f.calls.filter(call => call.operation === 'insightSave');assert.equal(saves.length, 2);assert.equal(f.generated, 1);
  const firstId = saves[0].params.state.events.find(row => row.appId === 'world').id;
  assert.equal(saves[1].params.state.events.find(row => row.appId === 'world').id, firstId);
  assert.equal(f.saved().state.events.filter(row => row.id === firstId).length, 1);
  assert.equal(f.saved().state.events.find(row => row.id === firstId).at, iso(NOW));
  assert.equal(f.saved().state.events.some(row => row.id === remote.id), true);
  assert.equal(f.saved().state.events.some(row => row.id === original.id), true);
});

test('a launch waiting on GET preserves an event recorded later by another device', async () => {
  const f = fixture({ state: active() }), gate = deferred(), remote = event('pulse', NOW + 1000);
  f.setHook((call, dispatch) => call.operation === 'insightLoad' ? gate.promise.then(dispatch) : dispatch());
  const launch = f.controller.trackLaunch('world');await tick();
  f.setNow(NOW + 2000);f.records.set(f.owner, { state: active([remote]), revision: 2 });gate.resolve();await launch;
  assert.equal(f.saved().state.events.some(row => row.id === remote.id), true);
  assert.equal(f.saved().state.events.find(row => row.appId === 'world').at, iso(NOW));
});

test('remote off detected initially or after CAS conflict cannot be re-enabled by launch/favorite retries', async () => {
  for (const afterConflict of [false, true]) {
    const f = fixture({ state: afterConflict ? active() : emptyMemberActivity() });let first = true;
    f.setHook((call, dispatch) => {
      if (call.operation === 'insightSave' && first) {
        first = false;f.records.set(f.owner, { state: emptyMemberActivity(), revision: 2 });
        return { ok: false, error: { code: 'REVISION_CONFLICT' } };
      }
      return dispatch();
    });
    await f.controller.trackLaunch('world');await f.controller.syncFavorites();
    assert.deepEqual(f.saved().state, emptyMemberActivity());
    assert.equal(f.calls.filter(call => call.operation === 'insightSave').length, afterConflict ? 1 : 0);
  }
});

test('queued launches from before a fresh consent start are not backfilled', async () => {
  const f = fixture(), gate = deferred();let first = true;
  f.setHook((_call, dispatch) => { if (first) { first = false;return gate.promise.then(dispatch); }return dispatch(); });
  const enable = f.controller.setConsent(true), launch = f.controller.trackLaunch('pulse');await tick();
  f.setNow(NOW + 1000);gate.resolve();await Promise.all([enable, launch]);
  assert.equal(f.saved().state.enabledAt, iso(NOW + 1000));assert.deepEqual(f.saved().state.events, []);
});

test('timeout does not report success and later enable cannot overtake a completed off CAS fence', async () => {
  const f = fixture({ timeoutMs: 15 }), gate = deferred();let first = true, late;
  f.setHook((call, dispatch) => {
    if (call.operation === 'insightSave' && first) { first = false;late = gate.promise.then(dispatch);return late; }
    return dispatch();
  });
  await f.controller.setConsent(true);assert.equal(f.controller.read().status, 'error');assert.equal(f.saved().revision, 0);
  await f.controller.setConsent(false);assert.deepEqual(f.saved(), { state: emptyMemberActivity(), revision: 1 });
  gate.resolve();await assert.rejects(late, { code: 'REVISION_CONFLICT' });await tick();
  assert.deepEqual(f.saved().state, emptyMemberActivity());assert.equal(f.controller.read().activity.availability, 'disabled');
});

test('an enable that committed before timeout is subsequently cleared by an off save', async () => {
  const f = fixture({ timeoutMs: 15 }), gate = deferred();let first = true;
  f.setHook((call, dispatch) => {
    const response = dispatch();if (call.operation === 'insightSave' && first) { first = false;return gate.promise.then(() => response); }return response;
  });
  await f.controller.setConsent(true);assert.equal(f.saved().state.consent, true);
  await f.controller.setConsent(false);gate.resolve();await tick();
  assert.deepEqual(f.saved().state, emptyMemberActivity());assert.equal(f.saved().revision, 2);assert.equal(f.controller.read().activity.availability, 'disabled');
});

test('retention pruning and capacity preserve the latest 2000; retrying an already saved UUID adds nothing', async () => {
  const expired = event('pulse', NOW - 91 * 86400000), rows = [expired, ...Array.from({ length: 1999 }, (_, index) => event('world', NOW - 100000 + index))];
  const f = fixture({ state: active(rows) });await f.controller.trackLaunch('path');
  assert.equal(f.saved().state.events.length, 2000);assert.equal(f.saved().state.events.some(row => row.id === expired.id), false);
  await f.controller.trackLaunch('pulse');assert.equal(f.saved().state.events.length, 2000);
  assert.equal(f.saved().state.events.some(row => row.id === rows[1].id), false);
  const g = fixture({ state: active() });let first = true;
  g.setHook((call, dispatch) => {
    const response = dispatch();if (call.operation === 'insightSave' && first) { first = false;throw Object.assign(new Error('lost response then conflict'), { code: 'REVISION_CONFLICT' }); }return response;
  });
  await g.controller.trackLaunch('world');assert.equal(g.saved().state.events.length, 1);
  assert.equal(g.calls.filter(call => call.operation === 'insightSave').length, 1);assert.equal(g.controller.read().status, 'ready');
});

test('clock rollback cannot crash refresh or prevent consent withdrawal', async () => {
  const f = fixture({ state: { ...active(), enabledAt: iso(NOW + 1000) } });
  await assert.doesNotReject(f.controller.refresh());assert.doesNotThrow(() => f.controller.read());
  await f.controller.setConsent(false);assert.deepEqual(f.saved().state, emptyMemberActivity());
});

test('a verified newer consent enabled on another device becomes visible after this device previously turned it off', async () => {
  const f=fixture({state:active([event()])});await f.controller.setConsent(false);
  assert.equal(f.controller.read().activity.availability,'disabled');
  f.setNow(NOW+1000);f.records.set(f.owner,{revision:f.saved().revision+1,state:{...active(),enabledAt:iso(NOW+1000),favorites:['pulse']}});
  await f.controller.refresh();assert.equal(f.controller.read().activity.availability,'ready');
  assert.equal(f.controller.read().activity.interests[0].id,'pulse');
  await f.controller.trackLaunch('world');assert.equal(f.saved().state.events.length,1);
});

test('invalidating or stopping during a delayed request discards its response and queued mutations', async () => {
  for (const method of ['invalidate', 'stop']) {
    const f = fixture({ state: active() }), gate = deferred();f.setHook((_call, dispatch) => { const response = dispatch();return gate.promise.then(() => response); });
    const job = f.controller.trackLaunch('world');await tick();f.controller[method]();gate.resolve();await job;
    assert.equal(f.calls.filter(call => call.operation === 'insightSave').length, 0);assert.equal(f.controller.read().activity, null);
  }
});
