import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatingDelivery } from '../experiences/atlas-lab/dating-delivery.mjs';
const actorId = 'synthetic-actor', demo = true;
const input = () => ({ actorId, demo, expectedRevision: 4, action: { kind: 'profile', profile: { nickname: '합성 입력' } } });
const unknown = () => Object.assign(new Error('synthetic lost response'), { outcomeUnknown: true });
const response = (revision = 5) => ({ ok: true, appliedRevision: revision, result: { saved: true }, view: { accountId: actorId, revision } });
test('a lost response keeps an immutable tab-only envelope, blocks new writes, and retries the same UUID and body only explicitly', async () => {
  const calls = [], requestId = randomUUID(); let sends = 0;
  const d = createDatingDelivery({ idFactory: () => requestId, request: async (path, body, options) => { calls.push({ path, body, options }); if (++sends === 1) throw unknown(); return response(); } });
  const original = input(); await assert.rejects(d.send(original), { outcomeUnknown: true }); original.action.profile.nickname = '변경한 입력';
  assert.equal(calls.length, 1); assert.equal(d.snapshot().action.profile.nickname, '합성 입력');
  const snapshot = d.snapshot(); snapshot.action.profile.nickname = '외부 변경';
  await assert.rejects(d.send(input()), { code: 'delivery-pending' }); assert.equal(calls.length, 1);
  const result = await d.retry({ actorId, demo }); assert.deepEqual(result, response()); assert.deepEqual(calls[1], calls[0]); assert.equal(d.snapshot(), null);
});
test('a missing receipt is inconclusive and an exact applied receipt resolves with the latest view', async () => {
  let receipt = false; const calls = [];
  const d = createDatingDelivery({ request: async (path, body) => { calls.push([path, body]); if (body) throw unknown(); return { ok: true, requestId: d.snapshot().requestId, status: receipt ? 'applied' : 'not-found', view: { accountId: actorId, revision: 9 }, ...(receipt ? { appliedRevision: 5, result: { saved: true } } : {}) }; } });
  await assert.rejects(d.send(input())); const before = d.snapshot();
  assert.equal((await d.check({ actorId, demo })).status, 'not-found'); assert.deepEqual(d.snapshot(), before);
  receipt = true; const applied = await d.check({ actorId, demo }); assert.equal(applied.currentView.revision, 9); assert.equal(applied.appliedRevision, 5); assert.equal(d.snapshot(), null);
  assert.equal(calls.filter(([, body]) => body).length, 1);
});
test('receipt transport or malformed/mismatched replies preserve pending; definitive rejection clears it', async () => {
  let mode = 'network'; const d = createDatingDelivery({ request: async (path, body) => { if (body) throw unknown(); if (mode === 'network') throw new TypeError('offline'); if (mode === 'bad') return { requestId: 'foreign', status: 'applied', view: { accountId: actorId } }; throw Object.assign(new Error('forbidden'), { status: 403 }); } });
  await assert.rejects(d.send(input())); await assert.rejects(d.check({ actorId, demo })); assert.ok(d.snapshot());
  mode = 'bad'; await assert.rejects(d.check({ actorId, demo }), { code: 'delivery-invalid-receipt' }); assert.ok(d.snapshot());
  mode = 'forbidden'; await assert.rejects(d.check({ actorId, demo }), { status: 403 }); assert.equal(d.snapshot(), null);
});
test('repeated uncertain retries retain pending, but revision rejection clears it', async () => {
  let rejected = false, calls = 0; const d = createDatingDelivery({ request: async () => { calls++; throw rejected ? Object.assign(new Error('conflict'), { status: 409 }) : unknown(); } });
  await assert.rejects(d.send(input())); await assert.rejects(d.retry({ actorId, demo })); assert.ok(d.snapshot());
  rejected = true; await assert.rejects(d.retry({ actorId, demo }), { status: 409 }); assert.equal(d.snapshot(), null); assert.equal(calls, 3);
});
test('identity changes and explicit lifecycle clearing discard pending and reject late private responses', async () => {
  let release; const d = createDatingDelivery({ request: () => new Promise(resolve => { release = resolve; }) });
  const late = d.send(input()); const rejected = assert.rejects(late, { code: 'delivery-identity-changed' }); d.clear(); release(response()); await rejected; assert.equal(d.snapshot(), null);
  const lost = createDatingDelivery({ request: async () => { throw unknown(); } }); await assert.rejects(lost.send(input()));
  await assert.rejects(lost.check({ actorId: 'other', demo }), { code: 'delivery-identity-changed' }); assert.equal(lost.snapshot(), null);
  await assert.rejects(lost.send(input())); await assert.rejects(lost.retry({ actorId, demo: false }), { code: 'delivery-identity-changed' }); assert.equal(lost.snapshot(), null);
});
test('concurrent checks/retries cannot launch duplicate traffic and ordinary definite failures do not leave pending', async () => {
  let release, calls = 0; const d = createDatingDelivery({ request: async (path, body) => { calls++; if (body) throw unknown(); return new Promise(resolve => { release = () => resolve({ requestId: d.snapshot().requestId, status: 'not-found', view: { accountId: actorId, revision: 4 } }); }); } });
  await assert.rejects(d.send(input())); const check = d.check({ actorId, demo }); await assert.rejects(d.retry({ actorId, demo }), { code: 'delivery-busy' }); release(); await check; assert.equal(calls, 2);
  const refused = createDatingDelivery({ request: async () => { throw Object.assign(new Error('validation'), { status: 400 }); } }); await assert.rejects(refused.send(input())); assert.equal(refused.snapshot(), null);
});
test('an incomplete or other actor’s action response stays unresolved instead of publishing the wrong view', async () => {
  for (const result of [{ok:true}, {...response(),view:{accountId:'other',revision:5}}, {...response(),appliedRevision:6}]) {
    const d=createDatingDelivery({request:async()=>result}); await assert.rejects(d.send(input()),{code:'delivery-invalid-response',outcomeUnknown:true}); assert.ok(d.snapshot());
  }
});
