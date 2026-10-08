import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingAdmission } from '../experiences/atlas-lab/dating-admission.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';

const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
const gate = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function until(predicate) { for (let n = 0; n < 200; n++) { if (predicate()) return; await tick(5); } assert.fail('Expected local test state was not reached.'); }
const busy = { status: 429, code: 'account-busy' };

test('admission defaults bound active verification to eight and reject invalid or unbounded settings', async () => {
  for (const options of [null, [], { bad: true }, { maxActive: 0 }, { maxActive: 65 }, { maxQueued: -1 }, { maxQueued: 257 }, { waitMs: 0 }, { waitMs: 5001 }, { maxActive: 1.5 }])
    assert.throws(() => createDatingAdmission(options), TypeError);
  const limiter = createDatingAdmission(), hold = gate(); let active = 0, peak = 0;
  const work = Array.from({ length: 24 }, () => limiter.run(async () => { peak = Math.max(peak, ++active); await hold.promise; active--; }));
  await assert.rejects(limiter.run(() => assert.fail('overflow must not run')), busy);
  assert.equal(peak, 8); hold.resolve(); await Promise.all(work); assert.equal(peak, 8); limiter.close();
});

test('queued verification starts in FIFO order and a verifier failure releases capacity', async () => {
  const limiter = createDatingAdmission({ maxActive: 1 }), first = gate(), order = [];
  const a = limiter.run(async () => { order.push('a'); await first.promise; throw new Error('synthetic verifier failure'); });
  const failed = assert.rejects(a, /synthetic verifier failure/);
  const b = limiter.run(() => order.push('b')), c = limiter.run(() => order.push('c'));
  await tick(0); assert.deepEqual(order, ['a']); first.resolve(); await Promise.all([failed, b, c]);
  assert.deepEqual(order, ['a', 'b', 'c']); assert.equal(await limiter.run(() => 'recovered'), 'recovered'); limiter.close();
});

test('queue deadline never releases an active verifier slot or calls an expired job', async () => {
  const limiter = createDatingAdmission({ maxActive: 1, maxQueued: 1, waitMs: 30 }), first = gate(); let calls = 0;
  const active = limiter.run(async () => { calls++; return first.promise; });
  await assert.rejects(limiter.run(() => { calls++; }), busy);
  await assert.rejects(limiter.run(() => { calls++; }), busy);
  assert.equal(calls, 1); first.resolve('done'); assert.equal(await active, 'done');
  assert.equal(await limiter.run(() => ++calls), 2); limiter.close();
});

test('cancelling queued and active clients removes only queued work until the verifier actually settles', async () => {
  const limiter = createDatingAdmission({ maxActive: 1, maxQueued: 1 }), first = gate(), activeController = new AbortController(), queuedController = new AbortController();
  const active = limiter.run(() => first.promise, { signal: activeController.signal });
  const activeRejected = assert.rejects(active, { code: 'request-cancelled' });
  const queued = limiter.run(() => assert.fail('cancelled queue must not run'), { signal: queuedController.signal });
  const queuedRejected = assert.rejects(queued, { code: 'request-cancelled' }); queuedController.abort(); await queuedRejected;
  activeController.abort();
  const next = limiter.run(() => 'next');
  await assert.rejects(limiter.run(() => assert.fail('active abort cannot bypass capacity')), busy);
  first.resolve('abandoned'); await activeRejected; assert.equal(await next, 'next'); limiter.close();
});

test('closing admission rejects queued and future work without pretending an active verifier has stopped', async () => {
  const limiter = createDatingAdmission({ maxActive: 1 }), first = gate();
  const active = limiter.run(() => first.promise), queued = limiter.run(() => assert.fail('closed queue must not run'));
  await tick(0);
  const rejected = assert.rejects(queued, { status: 503, code: 'service-closed' }); limiter.close(); await rejected;
  await assert.rejects(limiter.run(() => 'no'), { status: 503, code: 'service-closed' });
  first.resolve('complete'); assert.equal(await active, 'complete');
});

test('a delayed timer cannot admit work whose monotonic queue deadline has already passed', async () => {
  const limiter = createDatingAdmission({ maxActive: 1, waitMs: 20 }), first = gate();
  const active = limiter.run(() => first.promise); await tick(0);
  const expired = assert.rejects(limiter.run(() => assert.fail('expired work must not start')), busy);
  first.resolve();
  // Deliberately hold this turn so the promise finishes before the timer callback.
  const deadline = performance.now() + 30; while (performance.now() < deadline) { /* local scheduling boundary */ }
  await Promise.all([active, expired]); limiter.close();
});

test('close or cancellation before the invocation microtask prevents an external verifier from starting', async () => {
  const closed = createDatingAdmission(), closing = closed.run(() => assert.fail('closed operation must not start'));
  const rejected = assert.rejects(closing, { status: 503, code: 'service-closed' }); closed.close(); await rejected;
  const limiter = createDatingAdmission(), controller = new AbortController();
  const cancelled = limiter.run(() => assert.fail('cancelled operation must not start'), { signal: controller.signal });
  const aborted = assert.rejects(cancelled, { code: 'request-cancelled' }); controller.abort(); await aborted; limiter.close();
});

async function fixture(t, { verify, mode = 'account', authAdmission } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-admission-'));
  const filename = path.join(dir, 'admission.sqlite'), rawStore = createDatingStore({ path: filename, mode }); let transactions = 0;
  const store = { ...rawStore, transaction(fn) { transactions++; return rawStore.transaction(fn); } };
  const service = createDatingService({ store, mode, verify, authAdmission });
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); await fs.rm(dir, { recursive: true, force: true }); });
  const call = async (token, { route = '/state', json, signal } = {}) => {
    const response = await fetch(origin + '/api/atlas-dating' + route, { method: json === undefined ? 'GET' : 'POST', signal,
      headers: { Origin: origin, Authorization: `Bearer ${token}`, ...(json === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }) });
    return { status: response.status, retryAfter: response.headers.get('retry-after'), data: await response.json() };
  };
  const mutate = token => call(token, { route: '/action', json: { requestId: randomUUID(), expectedRevision: 0, action: { kind: 'profile', profile: { nickname: 'Synthetic', region: '', intro: '' } } } });
  return { store, service, call, mutate, transactions: () => transactions };
}

test('HTTP queue overflow and deadline return retry guidance before auth or any database transaction', async t => {
  const first = gate(), calls = [];
  const f = await fixture(t, { authAdmission: { maxActive: 1, maxQueued: 1, waitMs: 100 }, verify: async token => { calls.push(token); await first.promise; return { accountId: token }; } });
  const baseline = f.transactions(), active = f.call('first'); await until(() => calls.length === 1);
  const queued = f.mutate('queued'); await tick(15);
  const overflow = await f.mutate('overflow');
  assert.equal(overflow.status, 429); assert.equal(overflow.data.error.code, 'account-busy'); assert.equal(overflow.retryAfter, '1');
  const expired = await queued; assert.equal(expired.status, 429); assert.equal(expired.retryAfter, '1');
  assert.deepEqual(calls, ['first']); assert.equal(f.transactions(), baseline);
  first.resolve(); assert.equal((await active).status, 200);
  assert.deepEqual(f.store.transaction(tx => tx.accounts().map(row => row.id)), ['first']);
  assert.equal((await f.mutate('recovered')).status, 200);
});

test('HTTP client cancellation removes queued verification and an abandoned active request cannot write', async t => {
  const first = gate(), calls = [], activeController = new AbortController(), queuedController = new AbortController();
  const f = await fixture(t, { authAdmission: { maxActive: 1, maxQueued: 1, waitMs: 500 }, verify: async token => { calls.push(token); if (token === 'first') await first.promise; return { accountId: token }; } });
  const baseline = f.transactions(), active = f.call('first', { signal: activeController.signal }).catch(error => error);
  await until(() => calls.length === 1);
  const queued = f.call('cancelled-queue', { signal: queuedController.signal }).catch(error => error); await tick(20);
  queuedController.abort(); await queued; await tick(20);
  const next = f.call('next'); await tick(20); activeController.abort(); await active; await tick(20);
  const rejected = await f.call('overflow'); assert.equal(rejected.status, 429); assert.equal(f.transactions(), baseline);
  first.resolve(); assert.equal((await next).status, 200); assert.deepEqual(calls, ['first', 'next']);
  assert.deepEqual(f.store.transaction(tx => tx.accounts().map(row => row.id)), ['next']);
});

test('service close rejects waiting HTTP work and late verifier completion never reopens or touches storage', async t => {
  const first = gate(), calls = [];
  const f = await fixture(t, { authAdmission: { maxActive: 1, maxQueued: 1, waitMs: 500 }, verify: async token => { calls.push(token); await first.promise; return { accountId: token }; } });
  const baseline = f.transactions(), active = f.call('first'); await until(() => calls.length === 1);
  const queued = f.call('queued'); await tick(20); f.service.close();
  const rejected = await queued; assert.equal(rejected.status, 503); assert.equal(rejected.data.error.code, 'service-closed');
  first.resolve(); const late = await active; assert.equal(late.status, 503); assert.equal(late.data.error.code, 'service-closed');
  assert.equal(f.transactions(), baseline); assert.deepEqual(calls, ['first']);
});

test('HTTP verifier failure frees capacity and demo sessions do not need account admission', async t => {
  let attempts = 0;
  const f = await fixture(t, { authAdmission: { maxActive: 1, maxQueued: 0 }, verify: () => { if (!attempts++) throw Object.assign(new Error('synthetic failure'), { status: 503, code: 'account-auth-unavailable' }); return { accountId: 'recovered' }; } });
  assert.equal((await f.call('token')).status, 503); assert.equal((await f.call('token')).status, 200);
  const demo = await fixture(t, { mode: 'demo' });
  const login = await demo.call('unused', { route: '/demo/session', json: { role: 'adult-a' } });
  assert.equal(login.status, 200); assert.equal((await demo.call(login.data.token)).status, 200);
});
