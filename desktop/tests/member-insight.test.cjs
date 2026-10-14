'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const controllerModule = import('../renderer/member-insight.mjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 4; i++) await tick(); };
const signedIn = (accountId = 'synthetic-account-a', sessionGeneration = 1) => ({ signedIn: true, status: 'signed-in', accountId, sessionGeneration });
function reply(reason = 'travel') {
  return { ok: true, scope: 'synk-atlas-summary', learning: { enabled: true, revision: 2 }, shared: 'practice-and-settings', summary: {
    version: 'atlas-account-summary-1', asOf: '2026-10-14T03:00:00.000Z', presentation: null, reasons: [reason], forReasons: [],
    practice: { answered: 0, independent: 0, assisted: 0, lastAt: null, skills: [], content: [] },
    abilityClaim: false, learningEffectClaim: false, grade: null,
  } };
}
async function fixture(t, { identity = signedIn(), timeoutMs = 1000, onChange } = {}) {
  const { createMemberInsight } = await controllerModule;
  let current = identity;
  const requests = [], updates = [];
  const controller = createMemberInsight({ getIdentity: () => current, timeoutMs,
    request(operation, params) {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      requests.push({ operation, params, resolve, reject });return promise;
    },
    onChange(value) { updates.push(value);onChange?.(value, controller); },
  });
  t.after(async () => { controller.stop();for (const request of requests) request.resolve(reply());await settle(); });
  return { controller, requests, updates, identify(value) { current = value; } };
}
async function ready(f, response = reply()) {
  f.controller.setVisible(true);await settle();f.requests.at(-1).resolve(response);await settle();
  assert.equal(f.controller.read().status, 'ready');
}

test('public, unconfigured and unverified identities never request a private summary', async t => {
  const f = await fixture(t);
  for (const identity of [
    {}, { status: 'signed-out', signedIn: false }, { status: 'unconfigured', signedIn: false },
    { status: 'restoring', signedIn: true, accountId: 'synthetic-account-a' },
    { status: 'signed-in', signedIn: true }, { status: 'signed-in', signedIn: false, accountId: 'synthetic-account-a' },
    { status: 'error', signedIn: true, accountId: 'synthetic-account-a' },
  ]) {
    f.identify(identity);f.controller.setVisible(true);await f.controller.refresh();
    assert.equal(f.controller.read().report, null);
  }
  assert.deepEqual(f.requests, []);
});

for (const status of ['signed-out', 'unconfigured', 'error']) {
  test(`${status} restores its public state after leaving and returning without any request`, async t => {
    const f = await fixture(t, { identity: { status, signedIn: false, sessionGeneration: 1 } });
    f.controller.setVisible(true);await settle();
    assert.deepEqual(f.controller.read(), { status, report: null });
    // Identity does not change while navigating away and back. Hiding must invalidate
    // the view binding as well as the result; otherwise the public state stays loading.
    for (let visit = 0; visit < 2; visit++) {
      f.controller.setVisible(false);await f.controller.refresh();
      assert.equal(f.controller.read().report, null);
      f.controller.setVisible(true);await f.controller.refresh();await settle();
      assert.deepEqual(f.controller.read(), { status, report: null });
    }
    assert.deepEqual(f.requests, []);
    assert.equal(f.updates.some(value => value.report !== null), false);
  });
}

test('a signed-in account is read only while visible, through the single fixed operation', async t => {
  const f = await fixture(t);
  await f.controller.refresh();assert.deepEqual(f.requests, []);
  await ready(f);
  assert.equal(f.requests.length, 1);assert.equal(f.requests[0].operation, 'atlasSummary');assert.deepEqual(f.requests[0].params, {});
  assert.equal(f.controller.read().report.personal[0].value, '한국 여행');
});

test('simultaneous refresh and re-entrant renders share a single pending request', async t => {
  const f = await fixture(t, { onChange: (_state, controller) => { controller.read();controller.setVisible(true); } });
  f.controller.setVisible(true);
  const a = f.controller.refresh(), b = f.controller.refresh();
  await settle();assert.equal(f.requests.length, 1);
  f.requests[0].resolve(reply());await Promise.all([a, b]);await settle();
  assert.equal(f.requests.length, 1);assert.equal(f.controller.read().status, 'ready');
  assert.equal(f.updates.filter(value => value.status === 'ready').length, 1);
});

test('account replacement clears the old result and ignores its delayed response', async t => {
  const f = await fixture(t);
  await ready(f);
  const oldRead = f.controller.refresh();await settle();assert.equal(f.requests.length, 2);
  f.identify(signedIn('synthetic-account-b', 2));
  assert.equal(f.controller.read().report, null);f.controller.setVisible(true);await settle();
  assert.equal(f.requests.length, 3);
  f.requests[2].resolve(reply('hobby'));await settle();
  assert.equal(f.controller.read().report.personal[0].value, '배우는 즐거움');
  f.requests[1].resolve(reply('work'));await oldRead;await settle();
  assert.equal(f.controller.read().report.personal[0].value, '배우는 즐거움');
  assert.equal(f.updates.some(value => value.report?.personal[0]?.value === '한국에서 일'), false);
});

test('a new session for the same account cannot consume the earlier session response', async t => {
  const f = await fixture(t);
  f.controller.setVisible(true);await settle();
  f.identify(signedIn('synthetic-account-a', 2));f.controller.setVisible(true);await settle();
  assert.equal(f.requests.length, 2);
  f.requests[0].resolve(reply('work'));await settle();assert.equal(f.controller.read().report, null);
  f.requests[1].resolve(reply('hobby'));await settle();assert.equal(f.controller.read().report.personal[0].value, '배우는 즐거움');
  assert.equal(f.updates.some(value => value.report?.personal[0]?.value === '한국에서 일'), false);
});

test('sign-out immediately clears a shown report and a pending response cannot revive it', async t => {
  const f = await fixture(t);await ready(f);
  f.identify({ signedIn: false, status: 'signed-out', sessionGeneration: 2 });
  assert.deepEqual(f.controller.read(), { status: 'signed-out', report: null });
  await f.controller.refresh();assert.equal(f.requests.length, 1);
  f.identify(signedIn('synthetic-account-a', 3));f.controller.setVisible(true);await settle();
  const previousUpdates = f.updates.length;
  f.identify({ signedIn: false, status: 'signed-out', sessionGeneration: 4 });
  f.requests[1].resolve(reply('work'));await settle();
  assert.deepEqual(f.controller.read(), { status: 'signed-out', report: null });
  assert.equal(f.updates.length, previousUpdates);
});

test('hiding clears private data and returning always rereads, excluding hidden late replies', async t => {
  const f = await fixture(t);await ready(f);
  f.controller.setVisible(false);assert.equal(f.controller.read().report, null);
  await f.controller.refresh();assert.equal(f.requests.length, 1);
  f.controller.setVisible(true);await settle();assert.equal(f.requests.length, 2);
  f.controller.setVisible(false);f.requests[1].resolve(reply('work'));await settle();
  assert.equal(f.controller.read().report, null);
  f.controller.setVisible(true);await settle();assert.equal(f.requests.length, 3);
  f.requests[2].resolve(reply('hobby'));await settle();
  assert.equal(f.controller.read().report.personal[0].value, '배우는 즐거움');
  assert.equal(f.updates.some(value => value.report?.personal[0]?.value === '한국에서 일'), false);
});

test('failed and malformed responses expose a neutral error without stale data or raw errors', async t => {
  const f = await fixture(t);await ready(f);
  const first = f.controller.refresh();await settle();
  f.requests[1].reject(new Error('synthetic-secret-must-not-display'));await first;
  assert.equal(f.controller.read().status, 'error');assert.equal(f.controller.read().report, null);
  assert.doesNotMatch(JSON.stringify(f.updates), /synthetic-secret/);
  const second = f.controller.refresh();await settle();f.requests[2].resolve({ ok: true, secret: 'private-malformed' });await second;
  assert.equal(f.controller.read().status, 'error');assert.equal(f.controller.read().report, null);
  assert.doesNotMatch(JSON.stringify(f.updates), /private-malformed/);
  const third = f.controller.refresh();await settle();f.requests[3].resolve(reply());await third;
  assert.equal(f.controller.read().status, 'ready');
});

test('timeout allows retry and a late timed-out response never replaces the fresh result', async t => {
  const f = await fixture(t, { timeoutMs: 15 });
  f.controller.setVisible(true);await f.controller.refresh();
  assert.equal(f.controller.read().status, 'error');assert.equal(f.controller.read().report, null);
  const retry = f.controller.refresh();await settle();assert.equal(f.requests.length, 2);
  f.requests[1].resolve(reply('hobby'));await retry;
  f.requests[0].resolve(reply('work'));await settle();
  assert.equal(f.controller.read().report.personal[0].value, '배우는 즐거움');
  assert.equal(f.updates.some(value => value.report?.personal[0]?.value === '한국에서 일'), false);
});

test('invalidate and stop erase the result, and stopped controllers never notify or request again', async t => {
  const f = await fixture(t);await ready(f);
  f.controller.invalidate();assert.equal(f.controller.read().report, null);
  f.controller.setVisible(true);await settle();assert.equal(f.requests.length, 2);
  f.controller.stop();const updateCount = f.updates.length;
  f.requests[1].resolve(reply('work'));await settle();f.controller.setVisible(true);await f.controller.refresh();
  assert.equal(f.controller.read().report, null);assert.equal(f.requests.length, 2);assert.equal(f.updates.length, updateCount);
});

test('private projections are in memory only and snapshots cannot mutate controller state', async t => {
  const descriptors = ['localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key] of descriptors) Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error('No private persistence allowed'); } });
  t.after(() => { for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; } });
  const f = await fixture(t);await ready(f);
  const read = f.controller.read();read.report.personal[0].value = 'synthetic-mutated-value';
  f.updates.at(-1).report.personal[0].value = 'synthetic-mutated-notification';
  assert.equal(f.controller.read().report.personal[0].value, '한국 여행');
  f.controller.setVisible(false);assert.equal(f.controller.read().report, null);
});

test('native identity shape requires the same verified account and session boundary', async t => {
  const f = await fixture(t, { identity: { signedIn: true, status: 'signed-in', account: { synk_user_id: 'synthetic-native-a' }, sessionGeneration: 5 } });
  await ready(f);assert.equal(f.requests.length, 1);
  f.identify({ signedIn: true, status: 'signed-in', account: { synk_user_id: 'synthetic-native-b' }, sessionGeneration: 6 });
  assert.equal(f.controller.read().report, null);f.controller.setVisible(true);await settle();assert.equal(f.requests.length, 2);
  f.requests[1].resolve(reply('hobby'));await settle();assert.equal(f.controller.read().report.personal[0].value, '배우는 즐거움');
});
