import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { createDatingAccountVerifier } from '../experiences/atlas-lab/dating-auth.mjs';
import { createAppointmentsAdapter } from '../experiences/atlas-lab/appointments.mjs';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
const PREFIX = '/api/atlas-dating';
const consents = (patch = {}) => ({ profilePublic: true, receiveInvitations: true, storePreferences: true, ...patch });
const profile = (nickname, values = {}) => ({ nickname, region: '가상 지역', intro: '직접 공개한 소개', values, required: [] });
const initialTime = Date.parse('2026-10-08T12:00:00.000Z');

async function fixture(t, options = {}) {
  const dir = options.dir || await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-test-'));
  const filename = options.path || path.join(dir, 'dating.sqlite'), mode = options.mode || 'demo'; let time = initialTime;
  const store = createDatingStore({ path: filename, mode });
  const service = createDatingService({ store, mode, clock: () => time, ...options });
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let closed = false;
  async function close() { if (closed) return; closed = true; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); }
  t.after(close);
  // Directories are isolated test-owned temporary paths. Preserve them for failed-run inspection.
  async function call(route, { token, json, origin: requestOrigin = origin, headers = {}, method = json === undefined ? 'GET' : 'POST' } = {}) {
    const response = await fetch(origin + PREFIX + route, { method, headers: { ...(requestOrigin ? { Origin: requestOrigin } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(json === undefined ? {} : { body: JSON.stringify(json) }) });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function login(role) { const result = await call('/demo/session', { json: { role } }); assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data; }
  const get = token => call('/state', { token });
  async function act(token, action, overrides = {}) {
    const prior = await get(token); assert.equal(prior.status, 200);
    return call('/action', { token, json: { requestId: randomUUID(), expectedRevision: prior.data.view.revision, action, ...overrides } });
  }
  async function ok(token, action, overrides) { const result = await act(token, action, overrides); assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data; }
  async function onboard(token, label) {
    await ok(token, { kind: 'profile', profile: profile(label) }); await ok(token, { kind: 'adult', declared: true });
    return ok(token, { kind: 'consents', consents: consents() });
  }
  async function connected() {
    const a = await login('adult-a'), b = await login('adult-b'); await onboard(a.token, '가상 A'); await onboard(b.token, '가상 B');
    await prepareConnection(a.token, b.token);
    const result = await ok(a.token, { kind: 'connect', targetAccountId: b.accountId });
    await introduction(b.token, result.result.pairId, { kind: 'respond', introductionId: result.result.introductionId, value: 'accept' });
    return { a, b, pairId: result.result.pairId };
  }
  async function prepareConnection(aToken, bToken) {
    for (const [token, pace] of [[aToken, 'listen'], [bToken, 'lead']]) {
      const current = (await get(token)).data.view.profile;
      await ok(token, { kind: 'profile', profile: { ...current, values: { ...current.values, availability: 'weekend', 'self.pace': pace } } });
    }
    await readyRecommendation({ ok, get }, aToken);
  }
  async function introduction(token, pairId, action) {
    const state = await get(token), pair = state.data.view.pairs.find(p => p.pairId === pairId);
    return ok(token, { kind: 'introduction', pairId, expectedIntroductionRevision: pair.introduction.revision, action });
  }
  async function appointment(token, pairId, action) {
    const state = await get(token), pair = state.data.view.pairs.find(p => p.pairId === pairId);
    return ok(token, { kind: 'appointment', pairId, expectedPairRevision: pair.revision, action });
  }
  return { store, dir, path: filename, origin, call, login, get, act, ok, onboard, connected, prepareConnection, appointment, introduction, close, advance: ms => { time += ms; } };
}
const schedule = () => ({ startsAt: '2026-10-09T12:00:00.000Z', endsAt: '2026-10-09T13:00:00.000Z', timeZone: 'Asia/Seoul', place: '가상 카페', note: '공개 일정 메모' });

async function criterionMeeting(f, { target = 'baseline', until } = {}) {
  const a = await f.login('adult-a'), b = await f.login('adult-b'); await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B'); await f.prepareConnection(a.token, b.token);
  const peerProfile = (await f.get(b.token)).data.view.profile;
  await f.ok(b.token, { kind: 'profile', profile: { ...peerProfile, values: { ...peerProfile.values, 'self.plan': 'planned' } } });
  if (target === 'context') await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.plan', value: 'planned', target: 'baseline', required: true } });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.plan', value: 'planned', target, ...(target === 'baseline' ? { required: true } : {}), ...(until ? { until } : {}) } });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'priorities', fields: ['wants.plan'], target } });
  const connected = await f.ok(a.token, { kind: 'connect', targetAccountId: b.accountId }), pairId = connected.result.pairId;
  await f.introduction(b.token, pairId, { kind: 'respond', introductionId: connected.result.introductionId, value: 'accept' });
  await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() });
  let pair = (await f.get(a.token)).data.view.pairs.find(item => item.pairId === pairId), appointmentId = pair.view.currentId;
  for (const person of [a, b]) await f.appointment(person.token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
  const event = { kind: 'criterion', pairId, appointmentId, field: 'wants.plan', value: 'less-important' };
  assert.equal((await f.act(a.token, exp(event))).status, 403);
  f.advance(26 * 3600000); a.token = (await f.login('adult-a')).token; b.token = (await f.login('adult-b')).token;
  await f.appointment(a.token, pairId, { kind: 'complete', appointmentId });
  return { a, b, pairId, appointmentId, event };
}
async function specialPreview(f, token, input) {
  const current = (await f.get(token)).data.view; return f.call('/preview', { token, json: { expectedRevision: current.revision, ...input } });
}

test('criterion reflection uses the connection snapshot, only own completion, and an explicit priority preview without relaxing required values', async t => {
  const f = await fixture(t), { a, b, pairId, appointmentId, event } = await criterionMeeting(f);
  assert.equal((await f.act(b.token, exp(event))).status, 403);
  const before = (await f.get(a.token)).data.view.discovery;
  let result = await f.ok(a.token, exp(event));
  assert.deepEqual(result.view.discovery.priorities, before.priorities);
  const review = result.view.pairs.find(item => item.pairId === pairId).criterionReviews[0];
  assert.equal(review.canPreview, true); assert.equal(review.criteria[0].valueLabel, before.fields.find(item => item.id === 'wants.plan').valueLabel);
  assert.deepEqual((await f.get(b.token)).data.view.experience.criterionReviews, []);
  const input = { criterionReview: { pairId, appointmentId, field: 'wants.plan' } };
  const preview = await specialPreview(f, a.token, input); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.preview.changes[0].field, 'priorities');
  assert.deepEqual((await f.get(a.token)).data.view.discovery.priorities, before.priorities);
  result = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.deepEqual(result.view.discovery.priorities.effective, []);
  const field = result.view.discovery.fields.find(item => item.id === 'wants.plan'); assert.equal(field.required, true); assert.equal(field.value, 'planned');
  assert.equal(result.view.pairs[0].criterionReviews[0].canPreview, false);
  assert.equal(result.view.experience.metrics, null);
});

test('criterion preview survives a new context only for unchanged baseline sources and never revives after redeclaration, withdrawal or deletion', async t => {
  const f = await fixture(t), { a, b, pairId, appointmentId, event } = await criterionMeeting(f);
  await f.ok(a.token, exp(event));
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'start-context' } });
  const input = { criterionReview: { pairId, appointmentId, field: 'wants.plan' } };
  let preview = await specialPreview(f, a.token, input); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  await f.ok(a.token, exp({ ...event, value: null }));
  assert.equal((await f.act(a.token, { kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  await f.ok(a.token, exp(event));
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.plan', value: 'planned', target: 'baseline', required: true } });
  assert.equal((await specialPreview(f, a.token, input)).status, 409);
  const changed = (await f.get(a.token)).data.view.discovery.changes.at(-1);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'undo-field', field: 'wants.plan', changeId: changed.id } });
  assert.equal((await specialPreview(f, a.token, input)).status, 409);
  await f.ok(b.token, { kind: 'delete' });
  const closed = (await f.get(a.token)).data.view;
  assert.equal(closed.pairs[0].status, 'closed'); assert.equal(closed.experience.criterionReviews[0].field, 'wants.plan');
  const erased = await f.ok(a.token, exp({ ...event, value: null })); assert.deepEqual(erased.view.experience.criterionReviews, []);
});

test('once-only and expired criterion sources cannot be promoted to a new recommendation context', async t => {
  const f = await fixture(t), { a, pairId, appointmentId, event } = await criterionMeeting(f, { target: 'context' });
  await f.ok(a.token, exp(event));
  const input = { criterionReview: { pairId, appointmentId, field: 'wants.plan' } };
  assert.equal((await specialPreview(f, a.token, input)).status, 200);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'start-context' } });
  assert.equal((await specialPreview(f, a.token, input)).status, 409);
  const expired = await fixture(t), m = await criterionMeeting(expired, { until: '2026-10-09T12:30:00.000Z' });
  await expired.ok(m.a.token, exp(m.event));
  assert.equal((await specialPreview(expired, m.a.token, { criterionReview: { pairId: m.pairId, appointmentId: m.appointmentId, field: 'wants.plan' } })).status, 409);
});

async function worseCorrection(f, token, action) {
  await readyRecommendation(f, token); const source = await issuedResult(f, token); await applyCorrection(f, token, source, action);
  const decisionId = await issuedResult(f, token); await f.ok(token, exp({ kind: 'followup', decisionId, value: 'worse' })); return { source, decisionId };
}
test('worse restoration previews only the original correction, preserves later unrelated edits, and never restores selection or acceptances', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A');
  const { decisionId } = await worseCorrection(f, a.token);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.plan', value: 'planned' } });
  const before = (await f.get(a.token)).data.view;
  assert.equal(before.experience.records.find(item => item.id === decisionId).followup.canRestore, true);
  const preview = await specialPreview(f, a.token, { restoreDecisionId: decisionId }); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.preview.changes[0].field, 'wants.pace');
  const after = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.equal(after.view.discovery.fields.find(item => item.id === 'wants.pace').value, 'lead');
  assert.equal(after.view.discovery.fields.find(item => item.id === 'wants.plan').value, 'planned');
  assert.equal(after.view.discovery.selection, null); assert.deepEqual(after.view.pairs, []);
  assert.equal(after.view.experience.records.find(item => item.id === decisionId).followup.canRestore, false);
  assert.equal((await specialPreview(f, a.token, { restoreDecisionId: decisionId })).status, 409);
});

test('worse restoration rejects same-field redeclaration, source withdrawal, current expiry and forged preview sources', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b'); await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B');
  const { decisionId, source } = await worseCorrection(f, a.token);
  assert.equal((await specialPreview(f, b.token, { restoreDecisionId: decisionId })).status, 409);
  const preview = await specialPreview(f, a.token, { restoreDecisionId: decisionId }); assert.equal(preview.status, 200);
  await f.ok(a.token, exp({ kind: 'respond', decisionId: source, metric: 'intent', value: null }));
  assert.equal((await f.act(a.token, { kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  assert.equal((await specialPreview(f, a.token, { restoreDecisionId: decisionId })).status, 409);
  const second = await worseCorrection(f, a.token);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.pace', value: 'listen' } });
  assert.equal((await specialPreview(f, a.token, { restoreDecisionId: second.decisionId })).status, 409);
  const timed = await worseCorrection(f, a.token, { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context', until: '2026-10-08T12:01:00.000Z' });
  f.advance(61000);
  assert.equal((await specialPreview(f, a.token, { restoreDecisionId: timed.decisionId })).status, 409);
});

test('priority restoration preserves field edits and is invalidated by a later priority declaration or a new context', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A');
  const { decisionId } = await worseCorrection(f, a.token, { kind: 'priorities', fields: ['wants.pace'], target: 'context' });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.plan', value: 'planned' } });
  let preview = await specialPreview(f, a.token, { restoreDecisionId: decisionId }); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  const applied = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.deepEqual(applied.view.discovery.priorities.effective, []); assert.equal(applied.view.discovery.fields.find(item => item.id === 'wants.plan').value, 'planned');
  const next = await worseCorrection(f, a.token, { kind: 'priorities', fields: ['wants.pace'], target: 'context' });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'priorities', fields: ['wants.pace'], target: 'context' } });
  assert.equal((await specialPreview(f, a.token, { restoreDecisionId: next.decisionId })).status, 409);
  const newer = await worseCorrection(f, a.token, { kind: 'priorities', fields: [], target: 'context' });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'start-context' } });
  assert.equal((await specialPreview(f, a.token, { restoreDecisionId: newer.decisionId })).status, 409);
});

test('separate explicit SQLite stores refuse public paths and demo/account mode reuse', async t => {
  assert.throws(() => createDatingStore({ path: path.resolve('experiences/atlas-lab/test-private.sqlite'), mode: 'demo' }), /non-public/);
  const f = await fixture(t); assert.throws(() => createDatingStore({ path: f.path, mode: 'account' }), /separate/);
  assert.equal((await f.call('/config')).data.synthetic, true);
});

test('fictional role login is explicit; account service never accepts demo login or decode-only identities', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); assert.equal(a.accountId, 'demo:adult-a');
  assert.equal((await f.call('/state')).status, 401); assert.equal((await f.get('made-up-token')).status, 401);
  assert.equal((await f.call('/demo/session', { json: { role: 'adult-a', accountId: 'other' } })).status, 400);
  assert.equal((await f.call('/demo/session', { json: { role: 'adult-a' }, origin: 'https://evil.test' })).status, 403);
  const account = await fixture(t, { mode: 'account' });
  assert.equal((await account.call('/demo/session', { json: { role: 'adult-a' } })).status, 404);
  assert.equal((await account.get(a.token)).status, 503); assert.equal((await account.call('/config')).data.configured, false);
});

test('central account verification forwards the exact bearer and uses only active synk_user_id', async () => {
  let called = 0;
  const verify = createDatingAccountVerifier({ accountApiUrl: 'https://account.example', supabasePublishableKey: 'public-key', fetchImpl: async (url, request) => {
    called++; assert.equal(url.href, 'https://account.example/functions/v1/synk-account'); assert.equal(request.headers.Authorization, 'Bearer opaque-test-token');
    assert.equal(request.headers['X-SYNK-Product'], 'platform'); assert.equal(request.redirect, 'error');
    return { ok: true, status: 200, json: async () => ({ ok: true, account: { synk_user_id: 'synk:verified-user', status: 'active' }, roles: ['admin'] }) };
  } });
  assert.deepEqual(await verify('opaque-test-token'), { accountId: 'synk:verified-user' }); assert.equal(called, 1);
  const revoked = createDatingAccountVerifier({ accountApiUrl: 'https://account.example', supabasePublishableKey: 'public-key', fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, account: { synk_user_id: 'synk:user', status: 'deletion-requested' } }) }) });
  await assert.rejects(() => revoked('test'), error => error.status === 403);
});

test('onboarding and disclosure remain separate from private preferences and self-declaration is never verified', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b');
  assert.equal((await f.act(a.token, { kind: 'consents', consents: consents() })).status, 403);
  await f.onboard(a.token, '가상 A'); await f.onboard(b.token, '가상 B');
  await f.ok(a.token, { kind: 'preferences', preferences: { 'wants.pace': 'lead' } });
  const self = (await f.get(a.token)).data.view, other = (await f.get(b.token)).data.view;
  assert.equal(self.adult.verified, false); assert.equal(self.preferences['wants.pace'], 'lead');
  const publicA = other.candidates.find(row => row.accountId === a.accountId);
  assert.deepEqual(publicA.values, {}); assert.equal(publicA.preferences, undefined); assert.equal(publicA.adult.verified, false);
  await f.ok(a.token, { kind: 'consents', consents: consents({ storePreferences: false }) });
  assert.deepEqual((await f.get(a.token)).data.view.preferences, {});
  assert.equal((await f.act(a.token, { kind: 'preferences', preferences: { 'wants.pace': 'lead' } })).status, 403);
  assert.equal((await f.act(a.token, { kind: 'adult', declared: true, verified: true })).status, 400);
});

test('atomic revision CAS, idempotency and actor isolation work across two SQLite connections', async t => {
  const first = await fixture(t), second = await fixture(t, { dir: first.dir, path: first.path });
  const a1 = await first.login('adult-a'), a2 = await second.login('adult-a');
  const make = (host, token, nickname) => host.call('/action', { token, json: { requestId: randomUUID(), expectedRevision: 0, action: { kind: 'profile', profile: profile(nickname) } } });
  const results = await Promise.all([make(first, a1.token, '첫 수정'), make(second, a2.token, '둘째 수정')]);
  assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
  const request = { requestId: randomUUID(), expectedRevision: 1, action: { kind: 'adult', declared: true } };
  const original = await first.call('/action', { token: a1.token, json: request }), replay = await second.call('/action', { token: a2.token, json: request });
  assert.equal(original.status, 200); assert.equal(replay.data.replayed, true); assert.equal(replay.data.view.revision, 2);
  assert.equal((await second.call('/action', { token: a2.token, json: { ...request, action: { kind: 'adult', declared: false } } })).status, 409);
  const b = await second.login('adult-b'); const separate = await second.call('/action', { token: b.token, json: { ...request, expectedRevision: 0 } });
  assert.equal(separate.status, 200); assert.equal(separate.data.replayed, false);
});

test('appointment revisions and participant-private reflection are persisted and inbox is viewer-specific', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  const proposed = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() }), p = proposed.view.pairs.find(p => p.pairId === pairId);
  const appointmentId = p.view.appointments[0].id;
  assert.equal((await f.get(b.token)).data.view.inbox.length, 1); assert.equal(proposed.view.inbox.length, 0);
  const stalePair = await f.act(b.token, { kind: 'appointment', pairId, expectedPairRevision: 0, action: { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' } });
  assert.equal(stalePair.status, 409);
  for (const token of [a.token, b.token]) await f.appointment(token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
  f.advance(26 * 3600000); await f.appointment((await f.login('adult-a')).token, pairId, { kind: 'complete', appointmentId });
  const freshA = await f.login('adult-a'), freshB = await f.login('adult-b');
  await f.appointment(freshA.token, pairId, { kind: 'reflect', appointmentId, value: 'good', note: '나만 보는 회고 비밀문장' });
  const mine = (await f.get(freshA.token)).data.view, peer = (await f.get(freshB.token)).data.view;
  assert.equal(mine.pairs[0].view.me.reflections[0].note, '나만 보는 회고 비밀문장');
  assert.ok(!JSON.stringify(peer).includes('비밀문장')); assert.deepEqual(peer.pairs[0].view.me.reflections, []);
});

test('blocks, disclosure and adult withdrawal close every pair without restoring old acceptances', async t => {
  for (const change of [{ kind: 'block', targetAccountId: 'demo:adult-b' },
    { kind: 'consents', consents: consents({ receiveInvitations: false }) }, { kind: 'consents', consents: consents({ profilePublic: false }) }, { kind: 'adult', declared: false }]) {
    const f = await fixture(t), { a, b, pairId } = await f.connected();
    const p = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() });
    const appointmentId = p.view.pairs[0].view.appointments[0].id;
    await f.appointment(a.token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
    await f.appointment(b.token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
    await f.ok(a.token, change);
    const peer = (await f.get(b.token)).data.view; assert.equal(peer.pairs[0].status, 'closed'); assert.equal(peer.pairs[0].view, null); assert.deepEqual(peer.inbox, []);
    assert.equal((await f.act(b.token, { kind: 'appointment', pairId, expectedPairRevision: 2, action: { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' } })).status, 410);
    await f.ok(a.token, { kind: 'pause', paused: false }); await f.ok(a.token, { kind: 'unblock', targetAccountId: b.accountId });
    await f.ok(a.token, { kind: 'adult', declared: true }); await f.ok(a.token, { kind: 'consents', consents: consents() });
    await f.introduction(a.token, pairId, { kind: 'reopen' });
    f.advance(7 * 86400000 + 1000); const freshA = await f.login('adult-a');
    const fresh = await f.ok(freshA.token, { kind: 'connect', targetAccountId: b.accountId });
    assert.notEqual(fresh.result.pairId, pairId); assert.deepEqual(fresh.view.pairs.find(pair => pair.status === 'active').view.appointments, []);
  }
});

test('account pause preserves agreed appointments and private reflection while blocking new commitments', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  const proposed = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() });
  const appointmentId = proposed.view.pairs[0].view.appointments[0].id;
  await f.ok(a.token, { kind: 'pause', paused: true });
  let paused = (await f.get(b.token)).data.view.pairs[0];
  assert.equal(paused.status, 'active'); assert.equal(paused.paused, true); assert.equal(paused.view.canPropose, false);
  assert.equal(paused.view.appointments[0].canRespond, false); assert.equal(paused.view.appointments[0].canRevise, false);
  assert.equal((await f.act(b.token, { kind: 'appointment', pairId, expectedPairRevision: paused.revision, action: { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' } })).status, 403);
  await f.ok(a.token, { kind: 'pause', paused: false });
  for (const token of [a.token, b.token]) await f.appointment(token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
  await f.ok(a.token, { kind: 'pause', paused: true });
  assert.equal((await f.get(b.token)).data.view.pairs[0].view.appointments[0].status, 'confirmed');
  f.advance(26 * 3600000); const aa = await f.login('adult-a');
  await f.appointment(aa.token, pairId, { kind: 'complete', appointmentId });
  await f.appointment(aa.token, pairId, { kind: 'reflect', appointmentId, value: 'good', note: '쉬는 중 남긴 내 회고' });
  assert.equal((await f.get(aa.token)).data.view.pairs[0].view.me.reflections[0].note, '쉬는 중 남긴 내 회고');
});

test('reports remain private, operators are server-granted and suspending a target closes its pairs', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected(), op = await f.login('operator');
  const report = await f.ok(a.token, { kind: 'report', targetAccountId: b.accountId, reason: 'safety', details: '신고자만 보는 상세' });
  assert.deepEqual((await f.get(b.token)).data.view.reports, []);
  const action = { kind: 'admin-report', reportId: report.result.reportId, status: 'resolved', decision: 'suspend-target', note: '운영자만 보는 처리 메모' };
  assert.equal((await f.act(a.token, action)).status, 403); await f.ok(op.token, action);
  assert.equal((await f.get(b.token)).data.view.status, 'suspended'); assert.equal((await f.get(a.token)).data.view.pairs[0].view, null);
  assert.ok(!JSON.stringify((await f.get(a.token)).data).includes('운영자만')); assert.ok(JSON.stringify((await f.get(op.token)).data).includes('운영자만'));
  await f.ok(op.token, { ...action, decision: 'restore-target' });
  assert.equal((await f.get(b.token)).data.view.status, 'active'); assert.equal((await f.get(a.token)).data.view.pairs.find(p => p.pairId === pairId).status, 'closed');
});

test('suspension revokes operator report reads as well as processing and replay never returns stale private reports', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }), operatorIds: ['synk:op1', 'synk:op2'] });
  await f.onboard('alice', 'A'); await f.onboard('bob', 'B');
  await f.get('op1'); await f.get('op2');
  const report = await f.ok('alice', { kind: 'report', targetAccountId: 'synk:bob', reason: 'safety', details: '비공개 회원 신고 내용' });
  const opRevision = (await f.get('op1')).data.view.revision;
  const request = { requestId: randomUUID(), expectedRevision: opRevision, action: { kind: 'admin-report', reportId: report.result.reportId, status: 'reviewing', decision: 'none', note: '운영자 처리 비밀' } };
  assert.equal((await f.call('/action', { token: 'op1', json: request })).status, 200);
  const againstOperator = await f.ok('alice', { kind: 'report', targetAccountId: 'synk:op1', reason: 'other', details: '권한 중지 요청' });
  await f.ok('op2', { kind: 'admin-report', reportId: againstOperator.result.reportId, status: 'resolved', decision: 'suspend-target', note: '운영 처리' });
  for (const response of [await f.get('op1'), await f.call('/action', { token: 'op1', json: request })]) {
    assert.equal(response.status, 200); assert.equal(response.data.view.status, 'suspended'); assert.equal(response.data.view.operator, false);
    assert.deepEqual(response.data.view.reports, []); assert.ok(!JSON.stringify(response.data).includes('비공개 회원 신고 내용')); assert.ok(!JSON.stringify(response.data).includes('운영자 처리 비밀'));
  }
  assert.equal((await f.act('op1', request.action)).status, 403);
});

test('deletion scrubs private rows, leaves a tombstone, and stale writes stay rejected after restart', async t => {
  const f = await fixture(t), { a, b } = await f.connected(); await f.ok(a.token, { kind: 'preferences', preferences: { 'wants.pace': 'lead' } });
  await f.ok(a.token, { kind: 'report', targetAccountId: b.accountId, reason: 'other', details: '지워질 원문' });
  const old = (await f.get(a.token)).data.view;
  const deleted = await f.ok(a.token, { kind: 'delete' }); assert.equal(deleted.view.deleted, true);
  const stored = f.store.transaction(tx => ({ account: tx.account(a.accountId), pairs: tx.pairs(a.accountId), reports: tx.reports(null, true) }));
  assert.equal(stored.account.document, null); assert.ok(stored.pairs.every(pair => pair.document === null)); assert.ok(!JSON.stringify(stored).includes('지워질 원문'));
  assert.equal((await f.call('/action', { token: a.token, json: { requestId: randomUUID(), expectedRevision: old.revision, action: { kind: 'adult', declared: true } } })).status, 410);
  assert.equal((await f.get(b.token)).data.view.pairs[0].view, null); await f.close();
  const restarted = await fixture(t, { dir: f.dir, path: f.path });
  assert.equal((await restarted.call('/demo/session', { json: { role: 'adult-a' } })).status, 410);
  const b2 = await restarted.login('adult-b'); assert.equal((await restarted.get(b2.token)).data.view.profile.nickname, '가상 B');
  assert.equal((await restarted.get(a.token)).status, 401);
});

test('account verifier runs on every request and cannot grant operator powers through client claims', async t => {
  let active = true, calls = 0;
  const f = await fixture(t, { mode: 'account', verify: async token => { calls++; if (!active || token !== 'verified-test-token') throw Object.assign(new Error('revoked'), { status: 401 }); return { accountId: 'synk:alice', role: 'admin' }; } });
  const loaded = await f.get('verified-test-token'); assert.equal(loaded.data.view.operator, false);
  assert.equal(loaded.data.view.accountId, 'synk:alice'); active = false;
  assert.equal((await f.get('verified-test-token')).status, 401); assert.equal(calls, 2);
});

test('invalid product action rolls back the account, pair and receipt together', async t => {
  const f = await fixture(t), { a, pairId } = await f.connected(), before = (await f.get(a.token)).data.view;
  const requestId = randomUUID();
  const result = await f.act(a.token, { kind: 'appointment', pairId, expectedPairRevision: 0, action: { kind: 'propose', schedule: { ...schedule(), endsAt: '2020-01-01T00:00:00Z' } } }, { requestId });
  assert.equal(result.status, 400); assert.equal((await f.get(a.token)).data.view.revision, before.revision);
  assert.equal(f.store.transaction(tx => tx.receipt(a.accountId, requestId)), undefined);
  assert.equal((await f.get(a.token)).data.view.pairs[0].revision, 0);
});

test('a failure while producing the response rolls back already-written account, pair and receipt', async t => {
  const adapter = createAppointmentsAdapter();
  const f = await fixture(t, { appointmentsAdapter: { ...adapter, inspect(state, options) {
    if (state.events.length) throw new TypeError('injected projection failure after the pair write'); return adapter.inspect(state, options);
  } } }), { a, pairId } = await f.connected(), prior = (await f.get(a.token)).data.view, requestId = randomUUID();
  const failed = await f.act(a.token, { kind: 'appointment', pairId, expectedPairRevision: 0, action: { kind: 'propose', schedule: schedule() } }, { requestId });
  assert.equal(failed.status, 400);
  const stored = f.store.transaction(tx => ({ account: tx.account(a.accountId), pair: tx.pair(pairId), receipt: tx.receipt(a.accountId, requestId) }));
  assert.equal(stored.account.revision, prior.revision); assert.equal(stored.pair.revision, 0); assert.deepEqual(stored.pair.document.events, []); assert.equal(stored.receipt, undefined);
});

test('first discovery opens without invented answers and server-stamped actions remain immediately readable', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); const onboarded = await f.onboard(a.token, '가상 A');
  assert.equal(onboarded.view.discovery.question.field, 'consent');
  assert.equal(onboarded.view.discovery.fields.find(field => field.id === 'availability').value, null);
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned' })) {
    const changed = await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field, value } });
    assert.equal(changed.view.discovery.fields.find(item => item.id === field).value, value);
  }
  assert.equal((await f.get(a.token)).status, 200);
  const stored = f.store.transaction(tx => tx.account(a.accountId).document.discovery);
  assert.ok(stored.events.every((event, index) => index === 0 || event.at > stored.events[index - 1].at));
  assert.equal((await f.act(a.token, { kind: 'discovery', action: { kind: 'set', field: 'consent', value: true, at: '2099-01-01T00:00:00Z' } })).status, 400);
});

test('account recommendations consume only disclosed eligible profiles and survive candidate privacy withdrawal', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }) });
  await f.onboard('alice', '공개 A'); await f.onboard('bob', '공개 B'); await f.onboard('carol', '비공개 C');
  await f.ok('bob', { kind: 'profile', profile: profile('공개 B', { availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned' }) });
  await f.ok('bob', { kind: 'preferences', preferences: { 'wants.pace': 'listen' } });
  await f.ok('carol', { kind: 'consents', consents: consents({ profilePublic: false }) });
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned', 'wants.pace': 'lead' }))
    await f.ok('alice', { kind: 'discovery', action: { kind: 'set', field, value } });
  let state = (await f.get('alice')).data.view;
  assert.equal(state.discovery.synthetic, false); assert.deepEqual(state.discovery.candidates.map(row => row.id), ['synk:bob']);
  assert.equal(state.discovery.candidates[0].status, 'eligible'); assert.ok(!JSON.stringify(state).includes('가상 성인'));
  assert.equal(state.candidates[0].values['wants.pace'], undefined, 'the partner private answer is not a public matching input');
  const readyConnection = await f.ok('alice', { kind: 'connect', targetAccountId: 'synk:bob' }); assert.ok(readyConnection.result.pairId);
  await f.ok('alice', { kind: 'discovery', action: { kind: 'select', candidateId: 'synk:bob' } });
  await f.ok('alice', { kind: 'discovery', action: { kind: 'expose', candidateIds: ['synk:bob'] } });
  await f.ok('bob', { kind: 'consents', consents: consents({ profilePublic: false }) });
  state = (await f.get('alice')).data.view;
  assert.deepEqual(state.candidates, []); assert.deepEqual(state.discovery.candidates, []); assert.equal(state.discovery.selection, null);
  assert.ok(!JSON.stringify(state.discovery).includes('공개 B')); assert.equal((await f.act('alice', { kind: 'connect', targetAccountId: 'synk:bob' })).status, 403);
});

test('guessing a disclosed account ID cannot bypass fresh mutual matching prerequisites', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }) });
  await f.onboard('alice', 'A'); await f.onboard('bob', 'B');
  await f.ok('bob', { kind: 'profile', profile: { ...profile('B', { availability: 'weekend', 'self.pace': 'lead', 'wants.pace': 'lead' }), required: ['wants.pace'] } });
  assert.equal((await f.act('alice', { kind: 'connect', targetAccountId: 'synk:bob' })).status, 403);
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen' })) await f.ok('alice', { kind: 'discovery', action: { kind: 'set', field, value } });
  assert.equal((await f.get('alice')).data.view.discovery.candidates[0].status, 'excluded');
  assert.equal((await f.act('alice', { kind: 'connect', targetAccountId: 'synk:bob' })).status, 403);
  await f.ok('alice', { kind: 'discovery', action: { kind: 'set', field: 'self.pace', value: 'lead' } });
  assert.equal((await f.act('alice', { kind: 'connect', targetAccountId: 'synk:bob' })).status, 200);
});

test('closing preserves only my readable reflection and counterpart deletion keeps my words without its profile', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  const proposed = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() }), appointmentId = proposed.view.pairs[0].view.appointments[0].id;
  for (const token of [a.token, b.token]) await f.appointment(token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
  f.advance(26 * 3600000); const aa = await f.login('adult-a'), bb = await f.login('adult-b');
  for (const [token, note] of [[aa.token, 'A가 남긴 개인 문장'], [bb.token, 'B가 남긴 개인 문장']]) {
    await f.appointment(token, pairId, { kind: 'complete', appointmentId }); await f.appointment(token, pairId, { kind: 'reflect', appointmentId, value: 'good', note });
  }
  await f.ok(aa.token, { kind: 'block', targetAccountId: b.accountId });
  let current = (await f.get(aa.token)).data.view;
  assert.equal(current.pairs[0].view, null); assert.equal(current.archivedReflections[0].note, 'A가 남긴 개인 문장');
  assert.ok(!JSON.stringify(current).includes('B가 남긴 개인 문장'));
  assert.notEqual(f.store.transaction(tx => tx.pair(pairId).document), null, 'a block does not erase completed histories');
  await f.ok(bb.token, { kind: 'delete' }); current = (await f.get(aa.token)).data.view;
  assert.equal(f.store.transaction(tx => tx.pair(pairId).document), null);
  assert.equal(current.archivedReflections.length, 1); assert.equal(current.archivedReflections[0].note, 'A가 남긴 개인 문장');
  assert.ok(!JSON.stringify(current.archivedReflections).includes('가상 B')); assert.ok(!JSON.stringify(current).includes('B가 남긴 개인 문장'));
});

test('account-wide exposure balancing changes only tied priorities and records each viewer/context/candidate once', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }) });
  for (const who of ['alice', 'dave', 'bob', 'carol']) await f.onboard(who, who.toUpperCase());
  for (const who of ['bob', 'carol']) await f.ok(who, { kind: 'profile', profile: profile(who.toUpperCase(), { availability: 'weekend', 'self.pace': 'lead' }) });
  for (const viewer of ['alice', 'dave']) for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen', 'wants.pace': 'lead' }))
    await f.ok(viewer, { kind: 'discovery', action: { kind: 'set', field, value } });
  const before = (await f.get('dave')).data.view.discovery; assert.deepEqual(new Set(before.topTierIds), new Set(['synk:bob', 'synk:carol']));
  for (let i = 0; i < 2; i++) await f.ok('alice', { kind: 'discovery', action: { kind: 'expose', candidateIds: ['synk:bob'] } });
  assert.deepEqual(f.store.transaction(tx => tx.exposureCounts()), { 'synk:bob': 1 });
  const after = (await f.get('dave')).data.view.discovery; assert.equal(after.topCandidateId, 'synk:carol');
  assert.deepEqual(new Set(after.topTierIds), new Set(before.topTierIds)); assert.ok(after.candidates.every(candidate => !Object.hasOwn(candidate, 'globalCount')));
  await f.ok('dave', { kind: 'discovery', action: { kind: 'expose', candidateIds: ['synk:bob'] } });
  assert.deepEqual(f.store.transaction(tx => tx.exposureCounts()), { 'synk:bob': 2 });
  await f.ok('carol', { kind: 'profile', profile: profile('CAROL', { availability: 'weekend', 'self.pace': 'listen' }) });
  const strict = (await f.get('dave')).data.view.discovery; assert.equal(strict.topCandidateId, 'synk:bob', 'lower exposure cannot promote a lower fit score');
});

test('account deletion removes its exposure references and ordinary responses never include other viewers logs', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }) });
  await f.onboard('alice', 'A'); await f.onboard('bob', 'B');
  await f.ok('bob', { kind: 'profile', profile: profile('B', { availability: 'weekend' }) });
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend' })) await f.ok('alice', { kind: 'discovery', action: { kind: 'set', field, value } });
  await f.ok('alice', { kind: 'discovery', action: { kind: 'expose', candidateIds: ['synk:bob'] } });
  const peer = (await f.get('bob')).data.view; assert.deepEqual(peer.discovery.exposure, []); assert.equal(peer.globalExposure, undefined);
  await f.ok('bob', { kind: 'delete' }); assert.deepEqual(f.store.transaction(tx => tx.exposureCounts()), {});
});

test('the persisted clock prevents expired discovery and appointment revivals after a backward-clock restart', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'consent', value: true } });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'start-context', expiresAt: '2026-10-08T13:00:00.000Z' } });
  await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule(), expiresAt: '2026-10-08T13:00:00.000Z' });
  f.advance(2 * 3600000);
  const expired = (await f.get(a.token)).data.view;
  assert.equal(expired.discovery.context.closed, true); assert.equal(expired.pairs[0].view.appointments[0].status, 'expired');
  await f.close();
  const restored = await fixture(t, { dir: f.dir, path: f.path }); // The new clock starts two hours earlier.
  const fresh = await restored.login('adult-a'), peer = await restored.login('adult-b'), current = (await restored.get(fresh.token)).data.view;
  assert.equal(current.discovery.context.closed, true); assert.equal(current.pairs[0].view.appointments[0].status, 'expired');
  const oldId = current.pairs[0].view.appointments[0].id;
  const rejected = await restored.act(peer.token, { kind: 'appointment', pairId, expectedPairRevision: current.pairs[0].revision,
    action: { kind: 'respond', appointmentId: oldId, proposalVersion: 1, value: 'accept' } });
  assert.equal(rejected.status, 403); assert.equal(rejected.data.error.code, 'introduction-required');
});

test('introduction delivery, mutual intent and date acceptance are separate persisted stages', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b');
  await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B');
  await f.prepareConnection(a.token, b.token);
  const sent = await f.ok(a.token, { kind: 'connect', targetAccountId: b.accountId }), pairId = sent.result.pairId;
  let pair = sent.view.pairs[0]; assert.equal(pair.introduction.current.status, 'pending'); assert.equal(pair.view.canPropose, false); assert.deepEqual(pair.view.appointments, []);
  assert.equal((await f.act(a.token, { kind: 'appointment', pairId, expectedPairRevision: 0, action: { kind: 'propose', schedule: schedule() } })).status, 403);
  assert.equal((await f.act(a.token, { kind: 'introduction', pairId, expectedIntroductionRevision: 1, action: { kind: 'respond', introductionId: sent.result.introductionId, value: 'accept' } })).status, 403);
  const peer = (await f.get(b.token)).data.view; assert.equal(peer.introductions[0].canRespond, true);
  await f.introduction(b.token, pairId, { kind: 'respond', introductionId: sent.result.introductionId, value: 'accept' });
  pair = (await f.get(a.token)).data.view.pairs[0]; assert.equal(pair.introduction.accepted, true); assert.equal(pair.view.canPropose, true);
  const proposed = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() });
  assert.equal(proposed.view.pairs[0].view.appointments[0].status, 'pending');
  assert.ok(proposed.view.pairs[0].view.appointments[0].people.every(person => person.response !== 'accept'));
  await f.close(); const restored = await fixture(t, { path: f.path, dir: f.dir }), aa = await restored.login('adult-a');
  pair = (await restored.get(aa.token)).data.view.pairs[0]; assert.equal(pair.introduction.accepted, true); assert.equal(pair.view.appointments[0].status, 'pending');
});

test('declined introduction cannot be resent through block/unblock, a new pair, or an old success replay', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b'); await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B');
  await f.prepareConnection(a.token, b.token);
  const request = { requestId: randomUUID(), expectedRevision: (await f.get(a.token)).data.view.revision, action: { kind: 'connect', targetAccountId: b.accountId } };
  const sent = await f.call('/action', { token: a.token, json: request }), pairId = sent.data.result.pairId;
  await f.introduction(b.token, pairId, { kind: 'respond', introductionId: sent.data.result.introductionId, value: 'decline' });
  assert.equal((await f.act(a.token, { kind: 'connect', targetAccountId: b.accountId })).status, 403);
  await f.ok(a.token, { kind: 'block', targetAccountId: b.accountId }); await f.ok(a.token, { kind: 'unblock', targetAccountId: b.accountId });
  await f.introduction(a.token, pairId, { kind: 'reopen' });
  assert.equal((await f.act(a.token, { kind: 'connect', targetAccountId: b.accountId })).status, 403);
  const replay = await f.call('/action', { token: a.token, json: request }); assert.equal(replay.data.replayed, true); assert.equal(replay.data.view.pairs[0].status, 'closed');
  assert.equal(replay.data.view.pairs[0].introduction.accepted, false);
  await f.introduction(b.token, pairId, { kind: 'reopen' });
  const fresh = await f.ok(a.token, { kind: 'connect', targetAccountId: b.accountId }); assert.notEqual(fresh.result.pairId, pairId);
  assert.equal(fresh.view.pairs.find(p => p.pairId === fresh.result.pairId).introduction.current.status, 'pending');
});

test('introduction revision conflicts are atomic and pause blocks new intent while allowing withdrawal', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b'); await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B');
  await f.prepareConnection(a.token, b.token);
  const sent = await f.ok(a.token, { kind: 'connect', targetAccountId: b.accountId }), pairId = sent.result.pairId;
  const stale = { requestId: randomUUID(), expectedRevision: (await f.get(b.token)).data.view.revision,
    action: { kind: 'introduction', pairId, expectedIntroductionRevision: 1, action: { kind: 'respond', introductionId: sent.result.introductionId, value: 'accept' } } };
  await f.ok(a.token, { kind: 'pause', paused: true }); assert.equal((await f.call('/action', { token: b.token, json: stale })).status, 403);
  await f.introduction(a.token, pairId, { kind: 'withdraw', introductionId: sent.result.introductionId });
  await f.ok(a.token, { kind: 'pause', paused: false });
  assert.equal((await f.call('/action', { token: b.token, json: stale })).status, 409);
  assert.equal(f.store.transaction(tx => tx.receipt(b.accountId, stale.requestId)), undefined);
  assert.equal((await f.get(b.token)).data.view.revision, stale.expectedRevision);
  await f.ok(a.token, { kind: 'delete' }); assert.deepEqual(f.store.transaction(tx => tx.introductions(b.accountId)), []);
  assert.equal((await f.call('/action', { token: b.token, json: stale })).status, 410);
});

test('legacy confirmed appointments retain completion and reflection but cannot imply an introduction agreement', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  const proposed = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() }), appointmentId = proposed.view.pairs[0].view.appointments[0].id;
  for (const token of [a.token, b.token]) await f.appointment(token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
  f.store.transaction(tx => tx.eraseIntroductions(a.accountId));
  let pair = (await f.get(a.token)).data.view.pairs[0]; assert.equal(pair.introduction.current, null); assert.equal(pair.introduction.accepted, false);
  assert.equal(pair.view.appointments[0].status, 'confirmed'); assert.equal(pair.view.appointments[0].canRevise, false);
  assert.equal((await f.act(a.token, { kind: 'appointment', pairId, expectedPairRevision: pair.revision, action: { kind: 'revise', appointmentId, schedule: schedule() } })).status, 403);
  f.advance(26 * 3600000); const aa = await f.login('adult-a');
  await f.appointment(aa.token, pairId, { kind: 'complete', appointmentId }); await f.appointment(aa.token, pairId, { kind: 'reflect', appointmentId, value: 'good', note: '기존 내 기록' });
  pair = (await f.get(aa.token)).data.view.pairs[0]; assert.equal(pair.view.me.reflections[0].note, '기존 내 기록');
});

test('date decline binds the account pair and one explicit own reopening clears both gates without restoring acceptances', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  const proposed = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() }), appointmentId = proposed.view.pairs[0].view.appointments[0].id;
  await f.appointment(b.token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'decline' });
  let peer = (await f.get(b.token)).data.view.pairs[0]; assert.equal(peer.introduction.accepted, false); assert.equal(peer.introduction.canReopen, true);
  await f.ok(a.token, { kind: 'block', targetAccountId: b.accountId }); await f.ok(a.token, { kind: 'unblock', targetAccountId: b.accountId });
  await f.introduction(a.token, pairId, { kind: 'reopen' });
  assert.equal((await f.act(a.token, { kind: 'connect', targetAccountId: b.accountId })).status, 403);
  await f.introduction(b.token, pairId, { kind: 'reopen' });
  const stored = f.store.transaction(tx => tx.pair(pairId));
  assert.equal(createAppointmentsAdapter().inspect(stored.document, { viewer: b.accountId, at: '2026-10-08T12:01:00.000Z' }).me.receiving.state, 'open');
  const fresh = await f.ok(a.token, { kind: 'connect', targetAccountId: b.accountId }); assert.notEqual(fresh.result.pairId, pairId);
  peer = fresh.view.pairs.find(pair => pair.pairId === fresh.result.pairId); assert.equal(peer.introduction.accepted, false); assert.deepEqual(peer.view.appointments, []);
});

test('date expiry closes its recipient gate across restart and does not count as a decline', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule(), expiresAt: '2026-10-08T13:00:00.000Z' });
  f.advance(2 * 3600000); const before = (await f.get(b.token)).data.view.pairs[0];
  assert.equal(before.view.me.receiving.state, 'expired'); assert.equal(before.introduction.accepted, false); assert.equal(before.introduction.canReopen, true);
  assert.equal(before.view.appointments[0].status, 'expired'); await f.close();
  const restored = await fixture(t, { path: f.path, dir: f.dir }), aa = await restored.login('adult-a'), bb = await restored.login('adult-b');
  assert.equal((await restored.act(aa.token, { kind: 'connect', targetAccountId: b.accountId })).status, 403);
  await restored.introduction(bb.token, pairId, { kind: 'reopen' });
  const fresh = await restored.ok(aa.token, { kind: 'connect', targetAccountId: b.accountId });
  assert.equal(fresh.view.pairs[0].introduction.current.status, 'pending'); assert.equal(fresh.view.pairs[0].view.appointments[0].status, 'expired');
});

test('a busy date response preserves introduction consent while cancelling unanswered requests cannot pressure-retry', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  let result = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() });
  let appointmentId = result.view.pairs[0].view.appointments[0].id;
  result = await f.appointment(b.token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'busy' });
  assert.equal(result.view.pairs[0].introduction.accepted, true); assert.equal(result.view.pairs[0].view.me.receiving.state, 'open');
  result = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() });
  appointmentId = result.view.pairs[0].view.currentId;
  await f.appointment(a.token, pairId, { kind: 'cancel', appointmentId });
  const peer = (await f.get(b.token)).data.view.pairs[0]; assert.equal(peer.view.me.receiving.state, 'cancelled'); assert.equal(peer.introduction.accepted, false);
  assert.equal((await f.act(a.token, { kind: 'connect', targetAccountId: b.accountId })).status, 403);
  await f.introduction(b.token, pairId, { kind: 'reopen' });
  const fresh = await f.ok(a.token, { kind: 'connect', targetAccountId: b.accountId }); assert.equal(fresh.view.pairs[0].introduction.current.status, 'pending');
});

test('unanswered introduction expiry is not rejection and cooldown is durable across restart', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b'); await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B');
  await f.prepareConnection(a.token, b.token);
  const sent = await f.ok(a.token, { kind: 'connect', targetAccountId: b.accountId });
  f.advance(73 * 3600000); const aa = await f.login('adult-a'), expired = (await f.get(aa.token)).data.view.pairs[0];
  assert.equal(expired.introduction.current.status, 'expired'); assert.equal(expired.introduction.canSend, false);
  assert.equal((await f.act(aa.token, { kind: 'connect', targetAccountId: b.accountId })).status, 429);
  await f.close(); const restored = await fixture(t, { path: f.path, dir: f.dir }), a2 = await restored.login('adult-a');
  assert.equal((await restored.get(a2.token)).data.view.pairs[0].introduction.current.status, 'expired');
  assert.equal((await restored.act(a2.token, { kind: 'connect', targetAccountId: b.accountId })).status, 429);
  restored.advance(7 * 86400000 + 1000); const a3 = await restored.login('adult-a');
  const retry = await restored.ok(a3.token, { kind: 'connect', targetAccountId: b.accountId });
  assert.equal(retry.result.pairId, sent.result.pairId); assert.notEqual(retry.result.introductionId, sent.result.introductionId);
  assert.equal(retry.view.pairs[0].introduction.current.status, 'pending');
});

async function readyRecommendation(f, token) {
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned', 'wants.pace': 'lead' }))
    await f.ok(token, { kind: 'discovery', action: { kind: 'set', field, value } });
  return (await f.get(token)).data.view;
}
const exp = action => ({ kind: 'experience', action });

test('preview is private and does not save an answer; explicit apply checks revision, expiry and owner', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b'); await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B');
  const before = await readyRecommendation(f, a.token);
  const preview = await f.call('/preview', { token: a.token, json: { expectedRevision: before.revision, action: { kind: 'set', field: 'wants.pace', value: 'listen' } } });
  assert.equal(preview.status, 200, JSON.stringify(preview.data)); assert.equal(preview.data.preview.proposed, undefined);
  const unchanged = (await f.get(a.token)).data.view; assert.equal(unchanged.revision, before.revision); assert.deepEqual(unchanged.discovery.fields, before.discovery.fields); assert.deepEqual(unchanged.experience.records, []);
  assert.equal((await f.act(b.token, { kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.equal((await f.get(a.token)).data.view.discovery.fields.find(field => field.id === 'wants.pace').value, 'listen');
  assert.equal((await f.act(a.token, { kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  const current = (await f.get(a.token)).data.view;
  const expiring = await f.call('/preview', { token: a.token, json: { expectedRevision: current.revision, action: { kind: 'clear', field: 'wants.pace' } } });
  assert.equal(expiring.status, 200); f.advance(5 * 60000 + 1000);
  assert.equal((await f.act(a.token, { kind: 'apply-preview', preview: expiring.data.preview.token })).status, 409);
});

test('preview applies the current exposure tie order and rejects changed pool or global exposure', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }) });
  for (const who of ['alice', 'dave', 'bob', 'carol']) await f.onboard(who, who);
  for (const who of ['bob', 'carol']) await f.ok(who, { kind: 'profile', profile: profile(who, { availability: 'weekend', 'self.pace': 'lead' }) });
  await readyRecommendation(f, 'alice'); await readyRecommendation(f, 'dave');
  async function preview() { const before = (await f.get('alice')).data.view; const result = await f.call('/preview', { token: 'alice', json: { expectedRevision: before.revision, action: { kind: 'set', field: 'wants.plan', value: 'any' } } }); assert.equal(result.status, 200); return result.data.preview; }
  const first = await preview();
  await f.ok('dave', { kind: 'discovery', action: { kind: 'expose', candidateIds: ['synk:bob'] } });
  assert.equal((await f.act('alice', { kind: 'apply-preview', preview: first.token })).status, 409);
  const second = await preview(); assert.equal(second.before.topCandidateId, 'synk:carol'); assert.equal(second.after.topCandidateId, 'synk:carol');
  await f.ok('bob', { kind: 'consents', consents: consents({ profilePublic: false }) });
  assert.equal((await f.act('alice', { kind: 'apply-preview', preview: second.token })).status, 409);
});

test('own recommendation experience requires an issued current decision and explicit delivery, never GET exposure', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b'); await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B');
  await readyRecommendation(f, a.token);
  await f.ok(a.token, exp({ kind: 'goal', value: 'intent' })); await f.ok(a.token, exp({ kind: 'evaluation-consent', enabled: true }));
  const first = (await f.get(a.token)).data.view; assert.equal(first.experience.records.length, 0);
  assert.equal((await f.act(b.token, exp({ kind: 'view-result', token: first.experience.recommendationToken }))).status, 409);
  const issued = await f.ok(a.token, exp({ kind: 'view-result', token: first.experience.recommendationToken })), decisionId = issued.result.decisionId;
  assert.equal(issued.view.experience.records[0].deliveredAt, null); assert.equal(issued.view.experience.metrics.intent.byPolicy[0].counts.undelivered, 1);
  assert.equal((await f.act(a.token, exp({ kind: 'respond', decisionId, metric: 'intent', value: 'yes' }))).status, 400);
  await f.ok(a.token, exp({ kind: 'deliver', decisionId })); await f.ok(a.token, exp({ kind: 'respond', decisionId, metric: 'intent', value: 'yes' }));
  await f.ok(a.token, exp({ kind: 'respond', decisionId, metric: 'burden', value: 'unknown' }));
  const stored = f.store.transaction(tx => tx.account(a.accountId).document.experience.records[0]);
  assert.equal(stored.goal, 'intent'); assert.equal(stored.selectedLabel, undefined); assert.ok(!JSON.stringify(stored).includes('가상 성인'));
  await f.ok(a.token, exp({ kind: 'goal', value: 'pace' }));
  let current = (await f.get(a.token)).data.view; assert.equal(current.experience.records[0].goal, 'intent'); assert.deepEqual((await f.get(b.token)).data.view.experience.records, []);
  f.advance(25 * 3600000); const aa = await f.login('adult-a'); current = (await f.get(aa.token)).data.view;
  assert.equal(current.experience.metrics.intent.byPolicy[0].mean, 1); assert.equal(current.experience.metrics.burden.byPolicy[0].mean, null);
  assert.equal(current.experience.metrics.intent.comparison.status, 'insufficient_evidence');
  await f.ok(aa.token, exp({ kind: 'respond', decisionId, metric: 'intent', value: null }));
  assert.equal((await f.get(aa.token)).data.view.experience.metrics.intent.byPolicy[0].mean, null);
});

test('explicit result review and introduction request retain the comparison basis without recording GETs or replay duplicates', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }) });
  await f.onboard('alice', 'Alice'); await f.onboard('bob', 'Private former label');
  await f.ok('bob', { kind: 'profile', profile: profile('Private former label', { availability: 'weekend', 'self.pace': 'lead' }) });
  await readyRecommendation(f, 'alice');
  const before = (await f.get('alice')).data.view;
  await f.get('alice'); await f.get('alice');
  const exposures = () => f.store.transaction(tx => tx.account('synk:alice').document.discovery.events.filter(event => event.kind === 'expose'));
  assert.equal(exposures().length, 0); assert.equal(before.discovery.repetition.status, 'not-shown');
  const request = { requestId: randomUUID(), expectedRevision: before.revision,
    action: exp({ kind: 'view-result', token: before.experience.recommendationToken }) };
  const issued = await f.call('/action', { token: 'alice', json: request }); assert.equal(issued.status, 200, JSON.stringify(issued.data));
  assert.equal(issued.data.view.experience.records[0].deliveredAt, null, 'a result-review request does not fabricate a measured delivery outcome');
  assert.equal(exposures().length, 1); assert.equal(exposures()[0].shownBasis.version, 1);
  assert.deepEqual(exposures()[0].candidateIds, ['synk:bob']);
  assert.deepEqual(f.store.transaction(tx => tx.exposureCounts()), { 'synk:bob': 1 });
  assert.equal((await f.call('/action', { token: 'alice', json: request })).data.replayed, true); assert.equal(exposures().length, 1);
  await f.ok('alice', { kind: 'discovery', action: { kind: 'set', field: 'wants.contact', value: 'daily' } });
  assert.ok((await f.get('alice')).data.view.discovery.repetition.reasons.some(item => item.kind === 'answers-changed' && item.field === 'wants.contact'));
  const connected = await f.ok('alice', { kind: 'connect', targetAccountId: 'synk:bob' });
  assert.equal(exposures().length, 2); assert.deepEqual(connected.view.discovery.repetition.reasons, []);
  assert.equal(connected.view.pairs[0].introduction.current.status, 'pending');
  assert.deepEqual(f.store.transaction(tx => tx.exposureCounts()), { 'synk:bob': 1 }, 'same viewer/context is not counted twice');
  await f.ok('bob', { kind: 'consents', consents: consents({ profilePublic: false }) });
  const hidden = (await f.get('alice')).data.view.discovery.repetition;
  assert.deepEqual(hidden.reasons.map(item => item.kind), ['public-candidates-changed']);
  assert.doesNotMatch(JSON.stringify(hidden), /Private former label|synk:bob|shownBasis|poolKey/);
});

test('experience evaluation withdrawal is prospective on reenable and storage withdrawal removes all personal outcome data', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  await f.ok(a.token, exp({ kind: 'evaluation-consent', enabled: true }));
  const before = (await f.get(a.token)).data.view;
  const issued = await f.ok(a.token, exp({ kind: 'view-result', token: before.experience.recommendationToken }));
  await f.ok(a.token, exp({ kind: 'evaluation-consent', enabled: false }));
  await f.ok(a.token, exp({ kind: 'evaluation-consent', enabled: true }));
  let current = (await f.get(a.token)).data.view; assert.equal(current.experience.records[0].evaluationEligible, false); assert.equal(current.experience.metrics.intent.byPolicy[0].counts.decisions, 0);
  await f.ok(a.token, { kind: 'consents', consents: consents({ storePreferences: false }) });
  current = (await f.get(a.token)).data.view; assert.deepEqual(current.experience.records, []); assert.equal(current.experience.goal, null); assert.equal(current.experience.evaluationConsent, false);
  await f.ok(a.token, { kind: 'consents', consents: consents() });
  assert.equal((await f.act(a.token, exp({ kind: 'deliver', decisionId: issued.result.decisionId }))).status, 400);
});

test('comfort requires own completion, is separate from reflection, and remains withdrawable after counterpart deletion', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  await f.ok(a.token, exp({ kind: 'evaluation-consent', enabled: true }));
  const proposed = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() }), appointmentId = proposed.view.pairs[0].view.appointments[0].id;
  for (const token of [a.token, b.token]) await f.appointment(token, pairId, { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
  assert.equal((await f.act(a.token, exp({ kind: 'comfort', pairId, appointmentId, value: 'comfortable' }))).status, 403);
  f.advance(26 * 3600000); const aa = await f.login('adult-a'), bb = await f.login('adult-b');
  await f.appointment(aa.token, pairId, { kind: 'complete', appointmentId });
  const result = await f.ok(aa.token, exp({ kind: 'comfort', pairId, appointmentId, value: 'mixed' }));
  assert.equal(result.view.experience.records[0].responses.comfort.value, 'mixed'); assert.deepEqual(result.view.pairs[0].view.me.reflections, []);
  assert.deepEqual((await f.get(bb.token)).data.view.experience.records, []);
  assert.equal((await f.act(bb.token, exp({ kind: 'comfort', pairId, appointmentId, value: 'comfortable' }))).status, 403);
  await f.ok(bb.token, { kind: 'delete' }); await f.ok(aa.token, exp({ kind: 'comfort', pairId, appointmentId, value: null }));
  assert.equal((await f.get(aa.token)).data.view.experience.records[0].responses.comfort, undefined);
  await f.ok(aa.token, { kind: 'delete' }); assert.equal(f.store.transaction(tx => tx.account(a.accountId).document), null);
});

test('an answer expiring inside the five-minute preview period invalidates the reviewed result', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context', until: '2026-10-08T12:00:30.000Z' } });
  const before = (await f.get(a.token)).data.view;
  const preview = await f.call('/preview', { token: a.token, json: { expectedRevision: before.revision, action: { kind: 'set', field: 'wants.plan', value: 'any' } } });
  assert.equal(preview.status, 200, JSON.stringify(preview.data)); f.advance(31000);
  const changed = await f.act(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.equal(changed.status, 409); assert.equal((await f.get(a.token)).data.view.revision, before.revision);
});

test('old decision reports keep their basis while withdrawn peer labels vanish; suspended users can retract consent and answers', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }), operatorIds: ['synk:operator'] });
  for (const who of ['alice', 'bob']) await f.onboard(who, who);
  await f.ok('bob', { kind: 'profile', profile: profile('비공개될이름', { availability: 'weekend', 'self.pace': 'lead' }) });
  await readyRecommendation(f, 'alice'); await f.ok('alice', exp({ kind: 'evaluation-consent', enabled: true }));
  const before = (await f.get('alice')).data.view, issued = await f.ok('alice', exp({ kind: 'view-result', token: before.experience.recommendationToken })), decisionId = issued.result.decisionId;
  assert.equal(issued.view.experience.records[0].selectedLabel, '비공개될이름');
  await f.ok('alice', exp({ kind: 'deliver', decisionId })); await f.ok('alice', exp({ kind: 'respond', decisionId, metric: 'intent', value: 'yes' }));
  await f.ok('bob', { kind: 'consents', consents: consents({ profilePublic: false }) });
  const hidden = (await f.get('alice')).data.view.experience.records[0]; assert.equal(hidden.selectedId, null); assert.equal(hidden.selectedLabel, null); assert.equal(hidden.responses.intent.value, 'yes');
  assert.equal((await f.act('alice', exp({ kind: 'view-result', token: before.experience.recommendationToken }))).status, 409);
  const report = await f.ok('bob', { kind: 'report', targetAccountId: 'synk:alice', reason: 'other', details: '합성검사' });
  await f.ok('operator', { kind: 'admin-report', reportId: report.result.reportId, status: 'resolved', decision: 'suspend-target', note: '합성검사' });
  assert.equal((await f.act('alice', exp({ kind: 'respond', decisionId, metric: 'intent', value: 'no' }))).status, 403);
  await f.ok('alice', exp({ kind: 'respond', decisionId, metric: 'intent', value: null })); await f.ok('alice', exp({ kind: 'evaluation-consent', enabled: false }));
  const current = (await f.get('alice')).data.view; assert.equal(current.experience.metrics, null); assert.equal(current.experience.records[0].responses.intent, undefined);
});

async function issuedResult(f, token, value = 'partly') {
  const current = (await f.get(token)).data.view;
  const result = await f.ok(token, exp({ kind: 'view-result', token: current.experience.recommendationToken }));
  await f.ok(token, exp({ kind: 'deliver', decisionId: result.result.decisionId }));
  if (value !== undefined) await f.ok(token, exp({ kind: 'respond', decisionId: result.result.decisionId, metric: 'intent', value }));
  return result.result.decisionId;
}
async function correctionPreview(f, token, sourceDecisionId, action = { kind: 'set', field: 'wants.pace', value: 'listen' }) {
  const current = (await f.get(token)).data.view;
  return f.call('/preview', { token, json: { expectedRevision: current.revision, action, ...(sourceDecisionId ? { sourceDecisionId } : {}) } });
}
async function applyCorrection(f, token, sourceDecisionId, action) {
  const preview = await correctionPreview(f, token, sourceDecisionId, action); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  return f.ok(token, { kind: 'apply-preview', preview: preview.data.preview.token });
}

test('an explicitly reviewed correction links the next delivered recommendation privately and persists across restart', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b'); await f.onboard(a.token, 'A'); await f.onboard(b.token, 'B'); await readyRecommendation(f, a.token); await readyRecommendation(f, b.token);
  const source = await issuedResult(f, a.token), before = (await f.get(a.token)).data.view;
  assert.equal(before.experience.records[0].canCorrect, true);
  assert.equal((await correctionPreview(f, b.token, source)).status, 400);
  const preview = await correctionPreview(f, a.token, source); assert.equal(preview.status, 200); assert.equal(preview.data.preview.sourceDecisionId, source);
  assert.equal(f.store.transaction(tx => tx.account(a.accountId).document.experience.corrections), undefined);
  const applied = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token }); assert.ok(applied.result.correctionId);
  const sourceStored = f.store.transaction(tx => tx.account(a.accountId).document.experience.corrections[0]);
  assert.equal(sourceStored.sourceDecisionId, source); assert.equal(sourceStored.changes[0].field, 'wants.pace');
  assert.ok(!JSON.stringify(sourceStored).includes('가상 성인')); assert.equal(sourceStored.candidateIds, undefined);
  await f.close(); const restarted = await fixture(t, { path: f.path, dir: f.dir }), aa = await restarted.login('adult-a'), bb = await restarted.login('adult-b');
  const current = (await restarted.get(aa.token)).data.view;
  const issued = await restarted.ok(aa.token, exp({ kind: 'view-result', token: current.experience.recommendationToken })), decisionId = issued.result.decisionId;
  const record = issued.view.experience.records.find(row => row.id === decisionId);
  assert.equal(record.followup.sourceDecisionId, source); assert.equal(record.followup.valid, true); assert.equal(record.followup.canRespond, false);
  assert.equal((await restarted.act(aa.token, exp({ kind: 'followup', decisionId, value: 'better' }))).status, 400);
  await restarted.ok(aa.token, exp({ kind: 'deliver', decisionId })); await restarted.ok(aa.token, exp({ kind: 'followup', decisionId, value: 'better' }));
  assert.deepEqual((await restarted.get(bb.token)).data.view.experience.records, []);
  const again = await issuedResult(restarted, aa.token); assert.equal((await restarted.get(aa.token)).data.view.experience.records.find(row => row.id === again).followup, undefined);
});

test('changing or withdrawing the source invalidates a preview and followup without reverting the chosen preferences', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  const source = await issuedResult(f, a.token), preview = await correctionPreview(f, a.token, source);
  await f.ok(a.token, exp({ kind: 'respond', decisionId: source, metric: 'intent', value: null }));
  assert.equal((await f.act(a.token, { kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  assert.equal((await correctionPreview(f, a.token, source)).status, 400);
  await f.ok(a.token, exp({ kind: 'respond', decisionId: source, metric: 'intent', value: 'no' })); await applyCorrection(f, a.token, source);
  const target = await issuedResult(f, a.token); await f.ok(a.token, exp({ kind: 'followup', decisionId: target, value: 'same' }));
  await f.ok(a.token, exp({ kind: 'respond', decisionId: source, metric: 'intent', value: 'yes' }));
  let current = (await f.get(a.token)).data.view;
  assert.equal(current.experience.records.find(row => row.id === target).followup.valid, false);
  assert.equal(current.discovery.fields.find(field => field.id === 'wants.pace').value, 'listen');
  assert.equal((await f.act(a.token, exp({ kind: 'followup', decisionId: target, value: 'better' }))).status, 400);
  await f.ok(a.token, exp({ kind: 'followup', decisionId: target, value: null }));
  current = (await f.get(a.token)).data.view; assert.equal(current.experience.records.find(row => row.id === target).responses.followup, undefined);
});

test('no-op or unlinked changes never invent a correction; undo followed by re-entry cannot revive an old correction', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  const source = await issuedResult(f, a.token);
  const noop = await applyCorrection(f, a.token, source, { kind: 'set', field: 'wants.pace', value: 'lead' }); assert.equal(noop.result.correctionId, undefined);
  assert.equal(f.store.transaction(tx => tx.account(a.accountId).document.experience.corrections), undefined);
  await applyCorrection(f, a.token, source);
  const current = (await f.get(a.token)).data.view, change = current.discovery.changes.filter(change => change.field === 'wants.pace').at(-1);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'undo-field', field: 'wants.pace', changeId: change.id } });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.pace', value: 'listen' } });
  const decisionId = await issuedResult(f, a.token);
  assert.equal((await f.get(a.token)).data.view.experience.records.find(row => row.id === decisionId).followup, undefined);
});

test('expired correction and a newly started situation do not link the next result, while a fresh post-expiry preview remains applicable', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  const source = await issuedResult(f, a.token);
  await applyCorrection(f, a.token, source, { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context', until: '2026-10-08T12:00:30.000Z' });
  f.advance(31000); const afterExpiry = await issuedResult(f, a.token);
  assert.equal((await f.get(a.token)).data.view.experience.records.find(row => row.id === afterExpiry).followup, undefined);
  await applyCorrection(f, a.token, source, { kind: 'set', field: 'wants.plan', value: 'any' });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'close-context' } }); await f.ok(a.token, { kind: 'discovery', action: { kind: 'start-context' } });
  const next = await issuedResult(f, a.token); assert.equal((await f.get(a.token)).data.view.experience.records.find(row => row.id === next).followup, undefined);
});

test('priority corrections use the same explicit source link and storage withdrawal removes the full comparison trail', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  const source = await issuedResult(f, a.token);
  const applied = await applyCorrection(f, a.token, source, { kind: 'priorities', fields: ['wants.pace'], target: 'context' }); assert.ok(applied.result.correctionId);
  const decisionId = await issuedResult(f, a.token), record = (await f.get(a.token)).data.view.experience.records.find(row => row.id === decisionId);
  assert.equal(record.followup.changes[0].field, 'priorities');
  await f.ok(a.token, exp({ kind: 'followup', decisionId, value: 'unknown' }));
  await f.ok(a.token, { kind: 'consents', consents: consents({ storePreferences: false }) });
  const stored = f.store.transaction(tx => tx.account(a.accountId).document.experience); assert.deepEqual(stored.records, []); assert.equal(stored.corrections, undefined);
});

test('baseline publication patches only explicitly selected valid self fields and never enables disclosure or copies a context answer', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  await f.ok(a.token, { kind: 'profile', profile: { ...profile('A', { 'self.pace': 'lead', 'self.plan': 'spontaneous', 'wants.pace': 'lead' }), required: ['wants.pace'] } });
  assert.equal((await f.act(a.token, { kind: 'discovery', action: { kind: 'set', field: 'self.pace', value: 'lead', target: 'context' } })).status, 400);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context' } });
  await f.ok(a.token, { kind: 'consents', consents: consents({ profilePublic: false }) });
  const current = (await f.get(a.token)).data.view;
  assert.equal(current.discovery.fields.find(field => field.id === 'wants.pace').value, 'listen');
  const published = await f.ok(a.token, { kind: 'publish-baseline', fields: ['self.pace'] });
  assert.equal(published.view.profile.values['self.pace'], 'listen'); assert.equal(published.view.profile.values['self.plan'], 'spontaneous');
  assert.equal(published.view.profile.values['wants.pace'], 'lead'); assert.deepEqual(published.view.profile.required, ['wants.pace']); assert.equal(published.view.consents.profilePublic, false);
  assert.equal((await f.act(a.token, { kind: 'publish-baseline', fields: ['self.plan'] }, { expectedRevision: current.revision })).status, 409);
  for (const fields of [['wants.pace'], ['consent'], ['availability'], ['self.pace', 'self.pace'], ['self.unknown'], []])
    assert.equal((await f.act(a.token, { kind: 'publish-baseline', fields })).status, 400);
});

test('expired, cleared and missing baseline values cannot be published; deletion removes correction records', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  assert.equal((await f.act(a.token, { kind: 'discovery', action: { kind: 'set', field: 'self.notice', value: 'advance', target: 'context' } })).status, 400);
  assert.equal((await f.act(a.token, { kind: 'publish-baseline', fields: ['self.notice'] })).status, 409);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'self.notice', value: 'advance', target: 'baseline', until: '2026-10-08T12:00:30.000Z' } });
  f.advance(31000); assert.equal((await f.act(a.token, { kind: 'publish-baseline', fields: ['self.notice'] })).status, 409);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'clear', field: 'self.plan', target: 'baseline' } });
  assert.equal((await f.act(a.token, { kind: 'publish-baseline', fields: ['self.plan'] })).status, 409);
  const source = await issuedResult(f, a.token); await applyCorrection(f, a.token, source); await f.ok(a.token, { kind: 'delete' });
  assert.equal(f.store.transaction(tx => tx.account(a.accountId).document), null);
});

test('counterpart disclosure withdrawal hides correction references and suspending the owner still permits comparison withdrawal', async t => {
  const f = await fixture(t, { mode: 'account', verify: async token => ({ accountId: `synk:${token}` }), operatorIds: ['synk:operator'] });
  for (const who of ['alice', 'bob', 'carol']) await f.onboard(who, who);
  await f.ok('bob', { kind: 'profile', profile: profile('원래 공개 이름', { availability: 'weekend', 'self.pace': 'lead' }) });
  await f.ok('carol', { kind: 'profile', profile: profile('다음 공개 이름', { availability: 'weekend', 'self.pace': 'listen' }) });
  await readyRecommendation(f, 'alice'); await f.ok('alice', exp({ kind: 'evaluation-consent', enabled: true }));
  const source = await issuedResult(f, 'alice'); await applyCorrection(f, 'alice', source); const next = await issuedResult(f, 'alice');
  await f.ok('alice', exp({ kind: 'followup', decisionId: next, value: 'better' }));
  await f.ok('bob', { kind: 'consents', consents: consents({ profilePublic: false }) });
  let current = (await f.get('alice')).data.view;
  assert.equal(current.experience.records.find(row => row.id === source).selectedLabel, null);
  assert.equal(current.experience.records.find(row => row.id === next).followup.valid, false); assert.equal(current.experience.metrics.followup.byPolicy[0].counts.decisions, 0);
  assert.ok(!JSON.stringify(current).includes('원래 공개 이름'));
  assert.equal((await f.act('alice', exp({ kind: 'followup', decisionId: next, value: 'same' }))).status, 400);
  const report = await f.ok('bob', { kind: 'report', targetAccountId: 'synk:alice', reason: 'other', details: '합성 시험' });
  await f.ok('operator', { kind: 'admin-report', reportId: report.result.reportId, status: 'resolved', decision: 'suspend-target', note: '합성 시험' });
  await f.ok('alice', exp({ kind: 'followup', decisionId: next, value: null }));
  current = (await f.get('alice')).data.view; assert.equal(current.experience.records.find(row => row.id === next).responses.followup, undefined);
  assert.deepEqual((await f.get('carol')).data.view.experience.records, []);
});

test('explicit demo start creates absent sample accounts only, while account mode never bootstraps fictional identities', async t => {
  const f = await fixture(t); assert.deepEqual(f.store.transaction(tx => tx.accounts()), []);
  const config = await f.call('/config'); assert.ok(config.data.demoRoles.some(role => role.role === 'sample-1'));
  assert.deepEqual(f.store.transaction(tx => tx.accounts()), []);
  const a = await f.login('adult-a'), sample = await f.login('sample-1');
  let sampleView = (await f.get(sample.token)).data.view;
  assert.equal(sample.accountId, 'demo:sample-1'); assert.equal(sampleView.profile.nickname, '가상 예시 민서'); assert.equal(sampleView.adult.verified, false);
  assert.deepEqual(sampleView.pairs, []); assert.deepEqual(sampleView.introductions, []); assert.deepEqual(sampleView.experience.records, []);
  await f.ok(sample.token, { kind: 'profile', profile: { ...sampleView.profile, nickname: '내가 고친 가상 예시' } });
  await f.ok(sample.token, { kind: 'consents', consents: consents({ profilePublic: false }) });
  const before = f.store.transaction(tx => tx.account(sample.accountId)); await f.login('adult-b'); await f.login('sample-1');
  assert.deepEqual(f.store.transaction(tx => tx.account(sample.accountId)), before);
  await f.ok(sample.token, { kind: 'delete' }); await f.login('adult-a'); assert.equal((await f.call('/demo/session', { json: { role: 'sample-1' } })).status, 410);
  assert.equal(f.store.transaction(tx => tx.account(sample.accountId).document), null);
  assert.equal((await f.get(a.token)).data.view.profile.nickname, '');
  const account = await fixture(t, { mode: 'account', verify: async () => ({ accountId: 'synk:real-fixture' }) });
  await account.get('fixture'); assert.deepEqual(account.store.transaction(tx => tx.accounts().map(row => row.id)), ['synk:real-fixture']);
  assert.equal((await account.call('/config')).data.demoRoles, undefined); assert.equal((await account.call('/demo/session', { json: { role: 'sample-1' } })).status, 404);
});

test('the recommended demo identity is the invited identity and only its own role can accept before separate date acceptance', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A'); const current = await readyRecommendation(f, a.token);
  const card = current.discovery.candidates.find(candidate => candidate.id === current.discovery.topCandidateId);
  assert.equal(card.id, 'demo:sample-1'); assert.equal(card.accountId, card.id); assert.equal(card.demoRole, 'sample-1'); assert.equal(card.canConnect, true); assert.equal(card.pairId, null);
  assert.equal(card.publicAvailability, 'weekend'); assert.ok(current.discovery.candidates.every(candidate => !candidate.id.startsWith('candidate-')));
  const sent = await f.ok(a.token, { kind: 'connect', targetAccountId: card.accountId }), sample = await f.login(card.demoRole), pairId = sent.result.pairId;
  const invitation = (await f.get(sample.token)).data.view.pairs.find(pair => pair.pairId === pairId);
  assert.equal(invitation.introduction.current.status, 'pending'); assert.equal(invitation.introduction.canRespond, true);
  assert.ok(invitation.view.people.some(person => person.id === card.id)); assert.deepEqual(invitation.view.appointments, []);
  const other = await f.login('sample-2');
  assert.equal((await f.act(other.token, { kind: 'introduction', pairId, expectedIntroductionRevision: 1, action: { kind: 'respond', introductionId: sent.result.introductionId, value: 'accept' } })).status, 404);
  await f.introduction(sample.token, pairId, { kind: 'respond', introductionId: sent.result.introductionId, value: 'accept' });
  const own = (await f.get(a.token)).data.view, connectedCard = own.discovery.candidates.find(candidate => candidate.id === card.id);
  assert.equal(connectedCard.pairId, pairId); assert.equal(connectedCard.introductionStatus, 'accepted'); assert.equal(connectedCard.canConnect, false);
  const proposed = await f.appointment(a.token, pairId, { kind: 'propose', schedule: schedule() });
  assert.equal(proposed.view.pairs[0].view.appointments[0].status, 'pending'); assert.ok(proposed.view.pairs[0].view.appointments[0].people.every(person => person.response !== 'accept'));
});

test('demo visibility and reciprocal requirements use the same saved public profile; hidden IDs cannot bypass connect', async t => {
  const f = await fixture(t), a = await f.login('adult-a'), sample = await f.login('sample-1'); await f.onboard(a.token, 'A'); await readyRecommendation(f, a.token);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'hide-candidate', candidateId: sample.accountId, days: 7 } });
  let current = (await f.get(a.token)).data.view;
  assert.equal(current.discovery.candidates.find(candidate => candidate.id === sample.accountId).status, 'excluded');
  assert.equal(current.discovery.candidates.find(candidate => candidate.id === sample.accountId).canConnect, false);
  assert.equal((await f.act(a.token, { kind: 'connect', targetAccountId: sample.accountId })).status, 403);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'start-context' } });
  assert.equal((await f.act(a.token, { kind: 'connect', targetAccountId: sample.accountId })).status, 403);
  assert.deepEqual((await f.get(sample.token)).data.view.discovery.snoozedCandidates, []);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'unhide-candidate', candidateId: sample.accountId } });
  const profile = (await f.get(sample.token)).data.view.profile;
  await f.ok(sample.token, { kind: 'profile', profile: { ...profile, values: { ...profile.values, 'wants.pace': 'lead' }, required: ['wants.pace'] } });
  assert.equal((await f.act(a.token, { kind: 'connect', targetAccountId: sample.accountId })).status, 403);
  await f.ok(sample.token, { kind: 'consents', consents: consents({ profilePublic: false }) });
  current = (await f.get(a.token)).data.view; assert.ok(!current.discovery.candidates.some(candidate => candidate.id === sample.accountId));
  assert.equal((await f.act(a.token, { kind: 'connect', targetAccountId: sample.accountId })).status, 403);
});

test('legacy fixed-candidate discovery migrates once, preserves personal declarations and existing pairs, and never rebinds old candidate evidence', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  const legacy = createDiscoveryAdapter({ Domain, Ask, Personalization }), start = new Date(initialTime - 10000).toISOString();
  let state = legacy.create('ready', { at: start });
  state = legacy.record(state, { kind: 'set', field: 'wants.pace', value: 'listen', target: 'context', at: new Date(initialTime - 9000).toISOString() });
  state = legacy.record(state, { kind: 'select', candidateId: 'candidate-2', at: new Date(initialTime - 8000).toISOString() });
  state = legacy.record(state, { kind: 'expose', candidateIds: ['candidate-2'], at: new Date(initialTime - 7000).toISOString() });
  const oldPair = f.store.transaction(tx => tx.pair(pairId));
  f.store.transaction(tx => { const row = tx.account(a.accountId); tx.updateAccount(row, { ...row.document, discovery: state }); });
  const migrated = await f.get(a.token); assert.equal(migrated.status, 200, JSON.stringify(migrated.data)); const view = migrated.data.view;
  assert.equal(view.discovery.fields.find(field => field.id === 'wants.pace').baseline.value, 'lead');
  assert.equal(view.discovery.fields.find(field => field.id === 'wants.pace').value, 'lead'); assert.equal(view.discovery.selection, null);
  assert.deepEqual(view.discovery.exposure, []); assert.equal(view.legacyDiscovery, undefined); assert.equal(view.discoveryMigration.from, 'fixed-fictional-pool');
  assert.ok(!JSON.stringify(view.discovery).includes('candidate-2')); assert.equal(view.pairs.find(pair => pair.pairId === pairId).introduction.accepted, true);
  assert.deepEqual(f.store.transaction(tx => tx.pair(pairId)), oldPair);
  const stored = f.store.transaction(tx => tx.account(a.accountId)); assert.deepEqual(stored.document.legacyDiscovery, state); assert.equal(stored.document.discovery.ownerId, a.accountId);
  assert.equal((await f.get(a.token)).data.view.revision, view.revision); await f.login('adult-b'); assert.equal((await f.get(a.token)).data.view.revision, view.revision);
  await f.ok(a.token, { kind: 'consents', consents: consents({ storePreferences: false }) });
  assert.equal(f.store.transaction(tx => tx.account(a.accountId).document.legacyDiscovery), undefined); assert.ok((await f.get(b.token)).data.view.pairs.some(pair => pair.pairId === pairId));
});

test('a full legacy log migrates without reviving cleared mandatory values or expiring baselines, and preserves its original archive', async t => {
  const f = await fixture(t), a = await f.login('adult-a'); await f.onboard(a.token, 'A');
  const legacy = createDiscoveryAdapter({ Domain, Ask, Personalization }); let state = legacy.create('first');
  const actions = [
    { kind: 'set', field: 'consent', value: true }, { kind: 'set', field: 'availability', value: 'weekend' },
    { kind: 'set', field: 'wants.pace', value: 'lead', required: true }, { kind: 'clear', field: 'wants.pace' },
    { kind: 'set', field: 'self.notice', value: 'advance', until: new Date(initialTime - 1000).toISOString() }
  ];
  for (let index = 0; index < actions.length; index++) state = legacy.record(state, { ...actions[index], at: new Date(initialTime - 10000 + index).toISOString() });
  // Persisted fixture events exercise the actual replay/migration once, without
  // repeatedly rebuilding an ever-longer log during test setup.
  for (let index = actions.length; index < 500; index++) state.events.push({ kind: 'set', field: 'self.plan', value: index % 2 ? 'planned' : 'spontaneous', required: false,
    id: `event-${index + 1}`, at: new Date(initialTime - 10000 + index).toISOString() });
  f.store.transaction(tx => { const row = tx.account(a.accountId); tx.updateAccount(row, { ...row.document, discovery: state }); });
  const result = await f.get(a.token); assert.equal(result.status, 200, JSON.stringify(result.data));
  const field = id => result.data.view.discovery.fields.find(field => field.id === id);
  assert.equal(field('wants.pace').required, true); assert.equal(field('wants.pace').value, null); assert.equal(field('self.notice').value, null); assert.equal(field('self.plan').value, 'planned');
  assert.deepEqual(f.store.transaction(tx => tx.account(a.accountId).document.legacyDiscovery), state);
});

test('schedule context reads only currently public availability and disappears when pair access is withdrawn', async t => {
  const f = await fixture(t), { a, b, pairId } = await f.connected();
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'availability', value: 'weekday', target: 'context' } });
  let state = (await f.get(a.token)).data.view, pair = state.pairs.find(pair => pair.pairId === pairId);
  assert.deepEqual(pair.scheduleContext, { myAvailability: 'weekend', partnerAvailability: 'weekend', source: 'public-profile', asOf: state.asOf });
  const profile = (await f.get(b.token)).data.view.profile;
  await f.ok(b.token, { kind: 'profile', profile: { ...profile, values: { ...profile.values, availability: 'weekday' } } });
  state = (await f.get(a.token)).data.view; assert.equal(state.pairs[0].scheduleContext.partnerAvailability, 'weekday');
  const { availability, ...otherValues } = profile.values;
  await f.ok(b.token, { kind: 'profile', profile: { ...profile, values: otherValues } });
  assert.equal((await f.get(a.token)).data.view.pairs[0].scheduleContext.partnerAvailability, null);
  await f.ok(b.token, { kind: 'consents', consents: consents({ profilePublic: false }) });
  pair = (await f.get(a.token)).data.view.pairs.find(pair => pair.pairId === pairId); assert.equal(pair.status, 'closed'); assert.equal(pair.scheduleContext, undefined);
});
