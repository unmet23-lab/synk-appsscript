import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import ConditionalPreference from '../atlas/conditional-preference.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';

const api = createDiscoveryAdapter({ Domain, Ask, Personalization, ConditionalPreference });
const set = (state, field, value, extra = {}) => api.record(state, { kind: 'set', field, value, ...extra });
const apply = (state, action) => api.applyPreview(state, api.preview(state, action));
const row = (items, field) => items.find(item => item.field === field);
const instant = '2026-10-08T12:00:00.000Z', iso = ms => new Date(Date.parse(instant) + ms).toISOString();
const currentAt = state => state.events.at(-1).at;

test('context transition explains temporary answers, regions, priorities and exclusions while preserving must-haves and hiding', () => {
  let state = set(api.create('ready'), 'wants.contact', 'daily');
  state = set(state, 'wants.plan', 'planned', { required: true });
  state = set(state, 'self.meetingRegions', ['seoul-center']);
  state = set(state, 'self.meetingRegions', ['busan'], { target: 'context' });
  state = set(state, 'wants.contact', 'few-days', { target: 'context' });
  state = api.record(state, { kind: 'priorities', fields: ['wants.plan'], target: 'baseline' });
  state = api.record(state, { kind: 'priorities', fields: ['wants.contact'], target: 'context' });
  state = api.record(state, { kind: 'feedback', candidateId: 'candidate-1', reason: 'context', decision: 'skip-current' });
  state = api.record(state, { kind: 'hide-candidate', candidateId: 'candidate-2', days: 7 });
  const original = structuredClone(state), preview = api.preview(state, { kind: 'start-context' });
  assert.deepEqual(state, original);
  assert.match(row(preview.contextTransition.ended, 'wants.contact').after, /하루/);
  assert.match(row(preview.contextTransition.ended, 'self.meetingRegions').before, /부산/);
  assert.match(row(preview.contextTransition.ended, 'self.meetingRegions').after, /서울/);
  assert.match(preview.contextTransition.ended.find(item => item.kind === 'priorities').after, /약속/);
  assert.ok(preview.contextTransition.ended.some(item => item.kind === 'current-exclusions'));
  assert.ok(preview.contextTransition.retained.some(item => item.kind === 'candidate-hiding'));
  assert.ok(row(preview.contextTransition.retained, 'wants.plan'));
  const next = api.inspect(api.applyPreview(state, preview));
  assert.deepEqual(next.exclusions, []); assert.equal(next.snoozedCandidates[0].id, 'candidate-2');
  assert.equal(next.fields.find(item => item.id === 'wants.plan').required, true);
  assert.equal(next.fields.find(item => item.id === 'wants.contact').value, 'daily');
});

test('context transition returns explicit unknown to known baseline and missing or expired baseline to unconfirmed', () => {
  let state = api.create('ready', { at: instant });
  state = set(state, 'wants.contact', 'daily', { at: iso(20), until: iso(60) });
  state = set(state, 'wants.contact', 'few-days', { target: 'context', at: iso(30) });
  state = api.record(state, { kind: 'mark-unknown', field: 'wants.plan', at: iso(40) });
  state = set(state, 'wants.rhythm', 'early', { target: 'context', at: iso(50) });
  const preview = api.preview(state, { kind: 'start-context' }, { at: iso(70) });
  assert.match(row(preview.contextTransition.ended, 'wants.contact').after, /미확인/);
  assert.match(row(preview.contextTransition.ended, 'wants.rhythm').after, /미확인/);
  assert.match(row(preview.contextTransition.ended, 'wants.plan').before, /모르/);
  assert.match(row(preview.contextTransition.ended, 'wants.plan').after, /계획/);
});

test('a hidden baseline deadline invalidates the next-context preview even while the temporary effective answer remains live', () => {
  let state = api.create('ready', { at: instant });
  state = set(state, 'wants.contact', 'daily', { at: iso(20), until: iso(80) });
  state = set(state, 'wants.contact', 'few-days', { target: 'context', at: iso(30) });
  const preview = api.preview(state, { kind: 'start-context' }, { at: iso(50) });
  assert.throws(() => api.applyPreview(state, preview, { at: iso(90) }), /stale/);
  const renewed = api.preview(state, { kind: 'start-context' }, { at: iso(90) });
  assert.match(row(renewed.contextTransition.ended, 'wants.contact').after, /미확인/);
  assert.equal(api.inspect(api.applyPreview(state, renewed, { at: iso(100) })).fields.find(item => item.id === 'wants.contact').value, null);
});

test('closed contexts can review the next context but revoked consent and tampered transition cannot apply', () => {
  const closed = api.record(api.create('ready'), { kind: 'close-context' });
  const preview = api.preview(closed, { kind: 'start-context' });
  assert.equal(api.inspect(api.applyPreview(closed, preview)).context.closed, false);
  assert.throws(() => api.applyPreview(closed, { ...preview, contextTransition: { ended: [], retained: [] } }), /match/);
  const revoked = set(closed, 'consent', false);
  assert.throws(() => api.preview(revoked, { kind: 'start-context' }), /consent/);
  assert.throws(() => api.applyPreview(revoked, preview), /stale/);
});

test('next context ends only its conditional allowance and retains the explicitly approved baseline allowance', () => {
  let state = set(api.create('ready'), 'wants.contact', 'daily');
  state = apply(state, { kind: 'conditional-set', ruleId: 'contact-with-notice', target: 'baseline' });
  state = apply(state, { kind: 'conditional-set', ruleId: 'contact-with-notice', target: 'context' });
  const preview = api.preview(state, { kind: 'start-context' });
  const transition = preview.contextTransition.ended.find(item => item.kind === 'conditional-allowance');
  assert.match(transition.before, /며칠/); assert.match(transition.after, /며칠/);
  assert.equal(api.inspect(api.applyPreview(state, preview)).conditionalPreference.target, 'baseline');
  const baseline = api.preview(api.applyPreview(state, preview), { kind: 'start-context' });
  assert.ok(baseline.contextTransition.retained.some(item => item.kind === 'conditional-allowance'));
});

test('retained priority and timed hiding expiry are review changes while ordinary passage of time is not', () => {
  let state = api.create('ready', { at: instant });
  state = api.record(state, { kind: 'priorities', fields: ['wants.plan'], target: 'baseline', at: iso(20), until: iso(90) });
  const preview = api.preview(state, { kind: 'start-context' }, { at: iso(30) });
  assert.doesNotThrow(() => api.applyPreview(state, preview, { at: iso(70) }));
  assert.throws(() => api.applyPreview(state, preview, { at: iso(100) }), /stale/);
  let hidden = api.record(api.create('ready', { at: instant }), { kind: 'hide-candidate', candidateId: 'candidate-1', days: 7, at: iso(20) });
  const hiding = api.preview(hidden, { kind: 'start-context' }, { at: iso(30) });
  assert.throws(() => api.applyPreview(hidden, hiding, { at: iso(7 * 86400000 + 21) }), /stale/);
});

const PREFIX = '/api/atlas-dating';
async function fixture(t, { faultKind } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-context-transition-'));
  const store = createDatingStore({ path: path.join(dir, 'fixture.sqlite'), mode: 'account' });
  let clock = Date.parse(instant), fault = false;
  const wrapped = { ...store, transaction: fn => store.transaction(tx => fn({ ...tx,
    expose(...args) { tx.expose(...args); if (fault && faultKind === 'expose') throw new Error('synthetic post-exposure write failure'); },
    putReceipt(...args) { tx.putReceipt(...args); if (fault && faultKind === 'receipt') throw new Error('synthetic post-receipt write failure'); }
  })) };
  const service = createDatingService({ store: wrapped, verify: async token => ({ accountId: `synk:${token}` }), clock: () => clock });
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); });
  async function call(route, token, json) {
    const response = await fetch(origin + PREFIX + route, { method: json === undefined ? 'GET' : 'POST', headers: { Origin: origin,
      Authorization: `Bearer ${token}`, ...(json === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }) });
    return { status: response.status, data: await response.json() };
  }
  async function get(token = 'owner') { const response = await call('/state', token); assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data.view; }
  async function act(action, { token = 'owner', requestId = randomUUID(), expectedRevision, raw = false } = {}) {
    const payload = { requestId, expectedRevision: expectedRevision ?? (await get(token)).revision, action };
    return raw ? payload : call('/action', token, payload);
  }
  async function ok(action, options) { const response = await act(action, options); assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data; }
  const discover = action => ok({ kind: 'discovery', action });
  for (const token of ['owner', 'b', 'c']) {
    await ok({ kind: 'profile', profile: { nickname: token, region: '공개 소개', intro: '', values: { availability: 'weekend', 'self.pace': 'lead' }, required: [] } }, { token });
    await ok({ kind: 'adult', declared: true }, { token });
    await ok({ kind: 'consents', consents: { profilePublic: true, receiveInvitations: true, storePreferences: true } }, { token });
  }
  for (const [field, value] of [['consent', true], ['availability', 'weekend'], ['self.pace', 'listen'], ['wants.pace', 'any'], ['wants.plan', 'any']])
    await discover({ kind: 'set', field, value });
  async function preview(ids = [], extras = {}) { return call('/preview', 'owner', { expectedRevision: (await get()).revision, action: { kind: 'start-context' }, exposedCandidateIds: ids, ...extras }); }
  const snapshot = () => store.transaction(tx => ({ row: tx.account('synk:owner'), counts: tx.exposureCounts() }));
  return { store, call, get, act, ok, discover, preview, snapshot, advance: ms => { clock += ms; }, fault: value => { fault = value; } };
}

test('HTTP context preview and cancellation never write preferences, exposure or a receipt and reveal only owner transition metadata', async t => {
  const f = await fixture(t);
  await f.discover({ kind: 'set', field: 'wants.contact', value: 'daily' });
  await f.discover({ kind: 'set', field: 'wants.contact', value: 'few-days', target: 'context' });
  await f.ok({ kind: 'discovery', action: { kind: 'set', field: 'wants.notice', value: 'when-free' } }, { token: 'b' });
  const before = f.snapshot(), preview = await f.preview(['synk:b']); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.ok(preview.data.preview.contextTransition); assert.equal(preview.data.preview.contextExposure, undefined); assert.equal(preview.data.preview.proposed, undefined);
  assert.ok(!JSON.stringify(preview.data.preview.contextTransition).includes('when-free'));
  assert.ok(!JSON.stringify(preview.data.preview.contextTransition).includes('synk:b'));
  await f.get(); await f.get(); assert.deepEqual(f.snapshot(), before);
});

test('HTTP apply records reviewed old-context exposure and the new context atomically once and matches preview tie order', async t => {
  const f = await fixture(t), before = await f.get(), oldContext = before.discovery.context.id;
  assert.equal(before.discovery.topCandidateId, 'synk:b');
  const preview = await f.preview(['synk:b']); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.preview.after.topCandidateId, 'synk:c');
  const payload = await f.act({ kind: 'apply-preview', preview: preview.data.preview.token }, { raw: true });
  const applied = await f.call('/action', 'owner', payload); assert.equal(applied.status, 200, JSON.stringify(applied.data));
  assert.equal(applied.data.result.contextStarted, true); assert.equal(applied.data.view.discovery.topCandidateId, preview.data.preview.after.topCandidateId);
  const final = f.snapshot(), events = final.row.document.discovery.events;
  assert.equal(events.at(-2).kind, 'expose'); assert.equal(events.at(-1).kind, 'start-context');
  assert.equal(events.at(-2).shownBasis.contextId, oldContext); assert.deepEqual(final.counts, { 'synk:b': 1 });
  assert.notEqual(applied.data.view.discovery.context.id, oldContext);
  const replayed = await f.call('/action', 'owner', payload); assert.equal(replayed.status, 200); assert.equal(replayed.data.replayed, true);
  assert.deepEqual(f.snapshot(), final);
  const receipt = await f.call(`/receipt?requestId=${payload.requestId}`, 'owner'); assert.equal(receipt.data.status, 'applied');
  assert.equal(receipt.data.result.contextStarted, true);
});

test('HTTP duplicate old-context exposure is not counted twice in the reviewed next-context global tie order', async t => {
  const f = await fixture(t); await f.discover({ kind: 'expose', candidateIds: ['synk:b'] });
  assert.deepEqual(f.snapshot().counts, { 'synk:b': 1 });
  const preview = await f.preview(['synk:b']); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  const applied = await f.ok({ kind: 'apply-preview', preview: preview.data.preview.token });
  assert.equal(applied.view.discovery.topCandidateId, preview.data.preview.after.topCandidateId);
  assert.deepEqual(f.snapshot().counts, { 'synk:b': 1 });
});

test('HTTP rejects foreign, duplicate, hidden and correction-linked exposure input while closed contexts accept only empty exposure', async t => {
  const f = await fixture(t), before = f.snapshot();
  for (const ids of [['synk:foreign'], ['synk:b', 'synk:b'], [null], ['synk:owner']]) assert.equal((await f.preview(ids)).status, 400);
  assert.equal((await f.preview([], { sourceDecisionId: randomUUID() })).status, 400);
  assert.equal((await f.preview([], { criterionReview: { pairId: randomUUID() } })).status, 400);
  assert.deepEqual(f.snapshot(), before);
  await f.discover({ kind: 'hide-candidate', candidateId: 'synk:b', days: 7 }); assert.equal((await f.preview(['synk:b'])).status, 400);
  await f.discover({ kind: 'close-context' }); assert.equal((await f.preview(['synk:c'])).status, 400);
  const preview = await f.preview(); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  const applied = await f.ok({ kind: 'apply-preview', preview: preview.data.preview.token }); assert.equal(applied.view.discovery.context.closed, false);
  assert.ok(applied.view.discovery.snoozedCandidates.some(item => item.id === 'synk:b')); assert.deepEqual(f.snapshot().counts, {});
});

test('HTTP rejects a stale reviewed return when a hidden baseline answer expires without an account revision change', async t => {
  const f = await fixture(t);
  await f.discover({ kind: 'set', field: 'wants.contact', value: 'daily', until: iso(5000) });
  await f.discover({ kind: 'set', field: 'wants.contact', value: 'few-days', target: 'context' });
  const before = f.snapshot(), preview = await f.preview(['synk:b']); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  f.advance(6000); assert.equal((await f.act({ kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  assert.deepEqual(f.snapshot(), before); assert.equal((await f.get()).discovery.fields.find(item => item.id === 'wants.contact').value, 'few-days');
});

test('HTTP apply guards actor, CAS, changed public pool and withdrawn storage consent without partial exposure', async t => {
  const f = await fixture(t);
  let preview = await f.preview(['synk:b']); assert.equal(preview.status, 200);
  assert.equal((await f.act({ kind: 'apply-preview', preview: preview.data.preview.token }, { token: 'b' })).status, 409);
  await f.discover({ kind: 'set', field: 'wants.contact', value: 'daily' });
  assert.equal((await f.act({ kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  preview = await f.preview(['synk:b']); assert.equal(preview.status, 200);
  const publicProfile = (await f.get('b')).profile;
  await f.ok({ kind: 'profile', profile: { ...publicProfile, intro: '변경한 공개 소개' } }, { token: 'b' });
  assert.equal((await f.act({ kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  preview = await f.preview(['synk:b']); assert.equal(preview.status, 200);
  await f.ok({ kind: 'consents', consents: { profilePublic: true, receiveInvitations: true, storePreferences: false } });
  assert.equal((await f.act({ kind: 'apply-preview', preview: preview.data.preview.token })).status, 403);
  assert.deepEqual(f.snapshot().counts, {}); assert.equal(f.snapshot().row.document.discovery, null);
});

for (const faultKind of ['expose', 'receipt']) test(`HTTP ${faultKind} failure rolls back the entire exposure/context/receipt transaction and permits the same request retry`, async t => {
  const f = await fixture(t, { faultKind }), before = f.snapshot(), preview = await f.preview(['synk:b']);
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  const payload = await f.act({ kind: 'apply-preview', preview: preview.data.preview.token }, { raw: true }); f.fault(true);
  const rejected = await f.call('/action', 'owner', payload); assert.equal(rejected.status, faultKind === 'expose' ? 409 : 500);
  assert.deepEqual(f.snapshot(), before);
  assert.equal(f.store.transaction(tx => tx.receipt('synk:owner', payload.requestId)), undefined);
  f.fault(false); const retried = await f.call('/action', 'owner', payload); assert.equal(retried.status, 200, JSON.stringify(retried.data));
  assert.deepEqual(f.snapshot().counts, { 'synk:b': 1 }); assert.equal(f.snapshot().row.document.discovery.events.at(-1).kind, 'start-context');
});
