import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatingAdultVerifier, datingAdultStatus } from '../experiences/atlas-lab/dating-adult.mjs';

const AT = '2026-10-08T00:00:00.000Z', LATER = '2026-10-08T00:00:01.000Z', ISSUER = 'synthetic-adult';
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
const gate = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const claim = (subjectId, patch = {}) => ({ version: 1, subjectId, issuer: ISSUER, status: 'verified', sequence: 1,
  issuedAt: AT, validUntil: '2026-10-09T00:00:00.000Z', ...patch });
const verifier = (options = {}) => createDatingAdultVerifier({ required: true, issuer: ISSUER, verify: ({ subjectId }) => claim(subjectId), ...options });
const busy = { status: 429, code: 'account-busy' }, unavailable = { claim: null, unavailable: true };

test('adult admission validates bounded settings and exposes the actual worker capacity', async () => {
  for (const admission of [null, [], { unknown: true }, { maxActive: 0 }, { maxActive: 65 }, { maxQueued: -1 }, { maxQueued: 257 }, { waitMs: 0 }, { waitMs: 5001 }])
    assert.throws(() => verifier({ admission }), TypeError);
  const normal = verifier(), custom = verifier({ admission: { maxActive: 2 } }), implicit = verifier({ admission: { maxActive: undefined } });
  assert.equal(normal.maxActive, 8); assert.equal(custom.maxActive, 2); assert.equal(implicit.maxActive, 8);
  assert.deepEqual(await normal.check('bad id', AT), unavailable); assert.deepEqual(await normal.check('a', 'not-a-time'), unavailable);
  normal.close(); custom.close(); implicit.close();
});

test('one shared pool limits distinct subjects across callers and a full queue rejects without verification', async () => {
  const hold = gate(), started = []; let active = 0, peak = 0;
  const v = verifier({ admission: { maxActive: 2, maxQueued: 2 }, verify: async ({ subjectId }) => {
    started.push(subjectId); peak = Math.max(peak, ++active); await hold.promise; active--; return claim(subjectId);
  } });
  const calls = ['a', 'b', 'c', 'd'].map(subject => v.check(subject, AT));
  await assert.rejects(v.check('overflow', AT), busy); assert.deepEqual(started, ['a', 'b']);
  hold.resolve(); assert.ok((await Promise.all(calls)).every(result => !result.unavailable));
  assert.deepEqual(started, ['a', 'b', 'c', 'd']); assert.equal(peak, 2); v.close();
});

test('queue expiry is a capacity error, not an unavailable assertion that could revoke public consent', async () => {
  const hold = gate(), seen = [];
  const v = verifier({ admission: { maxActive: 1, maxQueued: 1, waitMs: 20 }, verify: async ({ subjectId }) => { seen.push(subjectId); await hold.promise; return claim(subjectId); } });
  const active = v.check('a', AT);
  await assert.rejects(v.check('queued', AT), busy); assert.deepEqual(seen, ['a']);
  hold.resolve(); assert.equal((await active).unavailable, false); v.close();
});

test('equal subject and observation time share only an unfinished call and a later check fetches fresh revocation', async () => {
  const hold = gate(); let calls = 0;
  const v = verifier({ verify: async ({ subjectId }) => { const call = ++calls; await hold.promise;
    return claim(subjectId, call > 1 ? { status: 'revoked', validUntil: null, sequence: 2 } : {});
  } });
  const a = v.check('a', AT), b = v.check('a', AT); await tick(0); assert.equal(calls, 1);
  hold.resolve(); const [first, second] = await Promise.all([a, b]);
  assert.equal(first.claim.status, 'verified'); assert.equal(second.claim.status, 'verified'); assert.notEqual(first.claim, second.claim);
  assert.equal((await v.check('a', AT)).claim.status, 'revoked'); assert.equal(calls, 2); v.close();
});

test('different observation times never share earlier assertions and each result retains issue and expiry checks', async () => {
  const hold = gate(), times = [];
  const v = verifier({ verify: async ({ subjectId, at }) => { times.push(at); await hold.promise;
    return at === AT ? claim(subjectId, { issuedAt: LATER }) : claim(subjectId, { validUntil: LATER });
  } });
  const earlier = v.check('a', AT), later = v.check('a', LATER); await tick(0); assert.deepEqual(times, [AT, LATER]); hold.resolve();
  assert.deepEqual(await earlier, unavailable);
  const result = await later; assert.equal(result.unavailable, false); assert.equal(datingAdultStatus(result.claim, LATER), 'expired'); v.close();
});

test('provider timeout returns unavailable but an abort-ignoring verifier retains its slot until it settles', async () => {
  const hold = gate(), seen = []; let signal;
  const v = verifier({ timeoutMs: 20, admission: { maxActive: 1, maxQueued: 1, waitMs: 20 }, verify: async input => {
    seen.push(input.subjectId); if (input.subjectId === 'held') { signal = input.signal; await hold.promise; } return claim(input.subjectId);
  } });
  assert.deepEqual(await v.check('held', AT), unavailable); assert.equal(signal.aborted, true);
  assert.deepEqual(await v.check('held', AT), unavailable); await assert.rejects(v.check('queued', AT), busy); assert.deepEqual(seen, ['held']);
  hold.resolve(); await tick(0); assert.equal((await v.check('fresh', AT)).unavailable, false); assert.deepEqual(seen, ['held', 'fresh']); v.close();
});

test('one caller can cancel without aborting the shared check needed by another caller', async () => {
  const hold = gate(), controller = new AbortController(); let calls = 0, signal;
  const v = verifier({ verify: async input => { calls++; signal = input.signal; await hold.promise; return claim(input.subjectId); } });
  const cancelled = v.check('a', AT, { signal: controller.signal }), remaining = v.check('a', AT);
  const rejected = assert.rejects(cancelled, { status: 499, code: 'request-cancelled' }); await tick(0); controller.abort(); await rejected;
  assert.equal(signal.aborted, false); hold.resolve(); assert.equal((await remaining).unavailable, false); assert.equal(calls, 1); v.close();
});

test('last caller cancellation frees queued work but cannot release an active abort-ignoring slot', async () => {
  const hold = gate(), activeController = new AbortController(), queuedController = new AbortController(); let calls = 0;
  const v = verifier({ admission: { maxActive: 1, maxQueued: 1, waitMs: 30 }, verify: async ({ subjectId }) => { calls++; await hold.promise; return claim(subjectId); } });
  const active = v.check('a', AT, { signal: activeController.signal });
  const activeRejected = assert.rejects(active, { code: 'request-cancelled' }); await tick(0);
  const queued = v.check('b', AT, { signal: queuedController.signal });
  const queuedRejected = assert.rejects(queued, { code: 'request-cancelled' }); queuedController.abort(); await queuedRejected;
  activeController.abort(); await activeRejected;
  await assert.rejects(v.check('a', AT), busy); await assert.rejects(v.check('c', AT), busy); assert.equal(calls, 1);
  hold.resolve(); await tick(0); assert.equal((await v.check('d', AT)).unavailable, false); v.close();
});

test('close promptly rejects both active and queued callers and late completion cannot reopen verification', async () => {
  const hold = gate(); let calls = 0, signal;
  const v = verifier({ admission: { maxActive: 1 }, verify: async input => { calls++; signal = input.signal; await hold.promise; return claim(input.subjectId); } });
  const a = v.check('a', AT), b = v.check('b', AT);
  const rejectedA = assert.rejects(a, { status: 503, code: 'service-closed' }), rejectedB = assert.rejects(b, { status: 503, code: 'service-closed' });
  await tick(0); v.close(); await Promise.all([rejectedA, rejectedB]); assert.equal(signal.aborted, true);
  await assert.rejects(v.check('c', AT), { status: 503, code: 'service-closed' });
  hold.resolve(); await tick(0); assert.equal(calls, 1); v.close();
});

test('provider exceptions are unavailable even when their message mimics an admission error, then capacity recovers', async () => {
  let calls = 0;
  const v = verifier({ admission: { maxActive: 1, maxQueued: 0 }, verify: ({ subjectId }) => {
    if (!calls++) throw Object.assign(new Error('account-busy'), busy); return claim(subjectId);
  } });
  assert.deepEqual(await v.check('a', AT), unavailable); assert.equal((await v.check('a', AT)).unavailable, false); v.close();
});

test('shared-call subscribers have a finite bound and overflow cannot turn the assertion unavailable', async () => {
  const hold = gate(); let calls = 0;
  const v = verifier({ verify: async ({ subjectId }) => { calls++; await hold.promise; return claim(subjectId); } });
  const subscribers = Array.from({ length: 64 }, () => v.check('a', AT));
  await assert.rejects(v.check('a', AT), busy); hold.resolve();
  assert.ok((await Promise.all(subscribers)).every(result => !result.unavailable)); assert.equal(calls, 1); v.close();
});

test('delayed timeout callbacks cannot turn a verifier success after its deadline into verified', async () => {
  const v = verifier({ timeoutMs: 10, verify: ({ subjectId }) => { const until = performance.now() + 20;
    while (performance.now() < until) { /* local event-loop deadline boundary */ } return claim(subjectId);
  } });
  assert.deepEqual(await v.check('a', AT), unavailable); v.close();
});
