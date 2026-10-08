// Bounded functional HTTP tests, not a provider benchmark or paid integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';

const START = '2026-10-08T03:00:00.000Z', ISSUER = 'synthetic-adult-capacity';
const claim = subjectId => ({ version: 1, subjectId, issuer: ISSUER, status: 'verified', sequence: 1, issuedAt: START, validUntil: '2026-10-09T03:00:00.000Z' });
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function until(predicate) { for (let i = 0; i < 400; i++) { if (predicate()) return; await tick(5); } assert.fail('Expected local adult-capacity state was not reached.'); }
const consents = { profilePublic: true, receiveInvitations: true, storePreferences: true };
const tables = ['dating_accounts', 'dating_pairs', 'dating_introductions', 'dating_archived_introductions', 'dating_receipts'];
function rows(filename) { const db = new DatabaseSync(filename, { readOnly: true }); try { return Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])); } finally { db.close(); } }
async function fixture(t, { count = 32, timeoutMs = 5000, admission } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-adult-capacity-')), filename = path.join(dir, 'account.sqlite');
  const ids = Array.from({ length: count }, () => randomUUID()), raw = createDatingStore({ path: filename, mode: 'account' });
  let transactions = 0, afterClose = 0, closed = false, authCalls = 0, provider = async input => claim(input.subjectId), active = 0, peak = 0;
  const calls = [], releases = [];
  const store = { ...raw, transaction(callback) { transactions++; if (closed) afterClose++; return raw.transaction(callback); }, close() { closed = true; raw.close(); } };
  const service = createDatingService({ store, mode: 'account', clock: () => new Date(START), verify: async token => { authCalls++; assert.ok(ids.includes(token)); return { accountId: token }; },
    adultVerification: { required: true, issuer: ISSUER, timeoutMs, ...(admission ? { admission } : {}), verify: async input => { calls.push(input); peak = Math.max(peak, ++active); try { return await provider(input); } finally { active--; } } } });
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { for (const release of releases) release(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); await until(() => active === 0); assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-dating-adult-capacity-')); await fs.rm(dir, { recursive: true, force: true }); });
  const call = async (index = 0, { route = '/state', body, signal } = {}) => {
    const response = await fetch(origin + '/api/atlas-dating' + route, { method: body === undefined ? 'GET' : 'POST', signal,
      headers: { Origin: origin, Authorization: 'Bearer ' + ids[index], ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, retryAfter: response.headers.get('retry-after'), data: await response.json() };
  };
  const get = async index => { const result = await call(index); assert.equal(result.status, 200, JSON.stringify(result)); return result.data.view; };
  const action = async (index, value) => { const before = await get(index), result = await call(index, { route: '/action', body: { requestId: randomUUID(), expectedRevision: before.revision, action: value } }); assert.equal(result.status, 200, JSON.stringify(result)); return result.data; };
  for (const index of [0, 1]) {
    const profile = { nickname: `합성 성인 ${index}`, region: '합성 지역', intro: '합성 성인 확인 시험' };
    await action(index, { kind: 'onboard', profile, declared: true, consents });
    await action(index, { kind: 'profile', profile: { ...profile, values: { availability: 'weekend' }, required: [] } });
  }
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' })) await action(0, { kind: 'discovery', action: { kind: 'set', field, value } });
  const connected = await action(0, { kind: 'connect', targetAccountId: ids[1] }), pairId = connected.result.pairId;
  const second = await get(1), introduction = second.pairs.find(pair => pair.pairId === pairId).introduction;
  await action(1, { kind: 'introduction', pairId, expectedIntroductionRevision: introduction.revision, action: { kind: 'respond', introductionId: introduction.current.id, value: 'accept' } });
  raw.transaction(tx => { const original = tx.account(ids[0]).document; for (let index = 2; index < count; index++) { const document = structuredClone(original); document.profile.nickname = `합성 성인 ${index}`; document.adultVerification.claim.subjectId = ids[index]; document.discovery = null; document.discoveryEpoch = null; tx.ensureAccount(ids[index], document); } });
  await get(0); calls.length = 0; peak = 0; authCalls = 0;
  return { ids, filename, service, pairId, call, get, snapshot: () => rows(filename), transactions: () => transactions, afterClose: () => afterClose,
    calls, stats: () => ({ active, peak, authCalls }), hold() { const value = gate(); releases.push(value.resolve); return value; }, setProvider(value) { assert.equal(active, 0); provider = value; calls.length = 0; peak = 0; authCalls = 0; } };
}

test('one HTTP state request checks more than 24 accounts with at most four workers and preserves verified relationships', { timeout: 15000 }, async t => {
  const f = await fixture(t), before = f.snapshot(); f.setProvider(async input => { await tick(5); return claim(input.subjectId); });
  const response = await f.call(); assert.equal(response.status, 200); assert.equal(f.calls.length, 32); assert.equal(new Set(f.calls.map(input => input.subjectId)).size, 32); assert.equal(f.stats().peak, 4);
  assert.equal(response.data.view.adult.verification.status, 'verified'); assert.equal(response.data.view.pairs.find(pair => pair.pairId === f.pairId).introduction.accepted, true); assert.deepEqual(response.data.view.consents, consents);
  const after = f.snapshot(); assert.deepEqual(after.dating_pairs, before.dating_pairs); assert.deepEqual(after.dating_accounts.map(row => [row.id, row.revision]), before.dating_accounts.map(row => [row.id, row.revision]));
});

test('overlapping HTTP reads share in-flight subject checks and cancelling a queued batch never launches another sweep', { timeout: 15000 }, async t => {
  const f = await fixture(t), hold = f.hold(), cancelled = new AbortController(); f.setProvider(async input => { await hold.promise; return claim(input.subjectId); });
  const first = f.call(); await until(() => f.calls.length === 4); const second = f.call(); await until(() => f.stats().authCalls === 2); await tick(25);
  assert.equal(f.calls.length, 4, 'Same subject/time work must be shared while still running');
  const queued = f.call(0, { signal: cancelled.signal }).catch(error => error); await until(() => f.stats().authCalls === 3); cancelled.abort(); assert.ok(await queued instanceof Error); await tick(25); hold.resolve();
  const results = await Promise.all([first, second]); assert.ok(results.every(result => result.status === 200)); await tick(25); assert.equal(f.calls.length, 32); assert.equal(f.stats().peak, 4); assert.equal(f.stats().active, 0);
});

test('adult-stage HTTP overload returns retry guidance without clearing consent, closing pairs or changing account revisions', { timeout: 15000 }, async t => {
  const f = await fixture(t), hold = f.hold(), before = f.snapshot(), revision = before.dating_accounts.find(row => row.id === f.ids[0]).revision;
  f.setProvider(async input => { await hold.promise; return claim(input.subjectId); }); const first = f.call(); await until(() => f.calls.length === 4); const second = f.call(1); await until(() => f.stats().authCalls === 2); await tick(20);
  const attempts = Array.from({ length: 10 }, () => f.call(0, { route: '/action', body: { requestId: randomUUID(), expectedRevision: revision, action: { kind: 'consents', consents: { ...consents, profilePublic: false, receiveInvitations: false } } } }));
  const rejected = await Promise.all(attempts); assert.equal(f.stats().authCalls, 12); assert.ok(f.stats().peak <= 8); assert.ok(rejected.every(result => result.status === 429 && result.data.error.code === 'account-busy' && result.retryAfter === '1')); assert.deepEqual(f.snapshot(), before);
  hold.resolve(); assert.ok((await Promise.all([first, second])).every(result => result.status === 200)); const recovered = await f.get(); assert.deepEqual(recovered.consents, consents); assert.equal(recovered.pairs.find(pair => pair.pairId === f.pairId).introduction.accepted, true);
});

test('cancelling an active HTTP sweep prevents later subject checks and cannot apply a partial verified set', { timeout: 15000 }, async t => {
  const f = await fixture(t), hold = f.hold(), controller = new AbortController(), before = f.snapshot();
  f.setProvider(async input => { await hold.promise; return claim(input.subjectId); }); const pending = f.call(0, { signal: controller.signal }).catch(error => error); await until(() => f.calls.length === 4); controller.abort(); assert.ok(await pending instanceof Error); await tick(30);
  assert.ok(f.calls.every(input => input.signal.aborted)); hold.resolve(); await until(() => f.stats().active === 0); await tick(25); assert.equal(f.calls.length, 4); assert.deepEqual(f.snapshot(), before);
});

test('closing the service during adult verification rejects pending HTTP work and late completions never touch closed SQLite', { timeout: 15000 }, async t => {
  const f = await fixture(t), hold = f.hold(), before = f.snapshot(); f.setProvider(async input => { await hold.promise; return claim(input.subjectId); });
  const pending = f.call(); await until(() => f.calls.length === 4); f.service.close(); const response = await pending; assert.equal(response.status, 503); assert.equal(response.data.error.code, 'service-closed'); assert.ok(f.calls.every(input => input.signal.aborted));
  const stoppedTransactions = f.transactions(); hold.resolve(); await until(() => f.stats().active === 0); await tick(25); assert.equal(f.transactions(), stoppedTransactions); assert.equal(f.afterClose(), 0); assert.equal(f.calls.length, 4); assert.deepEqual(f.snapshot(), before);
});

test('a real provider failure still applies unavailable protection instead of being mistaken for local capacity', { timeout: 15000 }, async t => {
  const f = await fixture(t, { count: 2 }); f.setProvider(async input => { if (input.subjectId === f.ids[0]) throw new Error('synthetic-provider-failure'); return claim(input.subjectId); });
  const response = await f.call(); assert.equal(response.status, 200); const view = response.data.view; assert.equal(view.adult.verification.status, 'unavailable'); assert.equal(view.consents.profilePublic, false); assert.equal(view.consents.receiveInvitations, false); assert.equal(view.consents.storePreferences, true); assert.equal(view.profile.nickname, '합성 성인 0');
  assert.equal(f.snapshot().dating_pairs.find(row => row.id === f.pairId).status, 'closed'); assert.equal(view.pairs.find(pair => pair.pairId === f.pairId).view, null);
});

test('an eight-second HTTP sweep budget rejects before applying any partial evidence or consent change', { timeout: 20000 }, async t => {
  const f = await fixture(t, { timeoutMs: 2000 }), before = f.snapshot();
  f.setProvider(async input => { await new Promise((resolve, reject) => { const done = () => { input.signal.removeEventListener('abort', cancelled); resolve(); }, timer = setTimeout(done, 1100), cancelled = () => { clearTimeout(timer); input.signal.removeEventListener('abort', cancelled); reject(new Error('synthetic-cancelled')); }; input.signal.addEventListener('abort', cancelled, { once: true }); }); return claim(input.subjectId); });
  const started = performance.now(), response = await f.call(); assert.equal(response.status, 429); assert.equal(response.data.error.code, 'account-busy'); assert.equal(response.retryAfter, '1'); assert.ok(performance.now() - started < 12000, 'The bounded local check must not finish all slow evidence'); assert.ok(f.calls.length >= 24); assert.ok(f.stats().peak <= 4); await until(() => f.stats().active === 0); assert.deepEqual(f.snapshot(), before);
});
