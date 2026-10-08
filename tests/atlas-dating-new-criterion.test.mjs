import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createProductExperience } from '../experiences/atlas-lab/product-experience.mjs';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';

const adapter = createProductExperience(), at = '2026-10-08T12:00:00.000Z', later = hours => new Date(Date.parse(at) + hours * 3600000).toISOString();
const previous = { field: 'wants.plan', label: '약속 방식', value: 'planned', valueLabel: '미리 계획', declarationId: 'event-old', declarationTarget: 'baseline' };
const discovered = { field: 'wants.relationshipGoal', label: '관계 목적', value: 'committed', valueLabel: '진지한 관계', declarationId: 'event-current', declarationTarget: 'baseline' };
const reflection = { pairId: 'pair-1', appointmentId: 'appointment-1', proposalVersion: 1, completedAt: later(2), field: discovered.field, value: 'more-important',
  source: { contextId: 'context-1', priorityKey: 'a'.repeat(64), criteria: ['wants.plan'], criterion: discovered, selectedId: 'candidate-peer' } };
const correctedSnapshot = { id: 'correction-1', sourceCriterion: { pairId: 'pair-1', appointmentId: 'appointment-1', field: discovered.field }, contextId: 'context-1', basisKey: 'b'.repeat(64),
  changes: [{ field: 'priorities', before: '약속 방식', after: '약속 방식, 관계 목적' }], restore: { kind: 'undo-priorities', changeId: 'event-new', currentKey: 'c'.repeat(64) } };
function reflected({ evaluation = false, until } = {}) {
  let state = adapter.create();
  if (evaluation) state = adapter.setting(state, { kind: 'evaluation-consent', enabled: true }, at);
  state = adapter.captureCriteria(state, { pairId: 'pair-1', contextId: 'context-1', priorityKey: 'a'.repeat(64), criteria: [previous] }, at);
  return adapter.criterion(state, { ...reflection, source: { ...reflection.source, criterion: { ...discovered, ...(until ? { until } : {}) } } }, later(3));
}
const inspect = (state, when = later(6), allowedSelectedIds = ['candidate-peer']) => adapter.inspect(state, { workspace: 'own', at: when, allowedSelectedIds });
function nextResult(state, { basisKey = correctedSnapshot.basisKey, contextId = 'context-1', at: when = later(4), allowedSelectedIds = ['candidate-peer'] } = {}) {
  return adapter.decide(state, { id: 'decision-next', contextId, candidateIds: ['candidate-peer'], selectedId: 'candidate-peer' }, when, { basisKey, allowedSelectedIds });
}

test('new criterion keeps connection importance unchanged and records only the current confirmed own answer', () => {
  const state = reflected(); assert.deepEqual(state.meetingCriteria[0].criteria, [previous]); assert.equal(state.records.length, 0);
  const src = adapter.criterionSource(state, reflection, later(3)); assert.equal(src.criterion.field, 'wants.relationshipGoal');
  assert.equal(src.review.response.value, 'more-important'); assert.equal(src.criterion.declarationId, 'event-current');
  assert.equal(inspect(state).metrics, null);
  const resaved = adapter.criterion(state, reflection, later(4)); assert.equal(resaved.meetingCriteria[0].reviews[0].response.at, later(3));
  assert.throws(() => adapter.captureCriteria(adapter.create(), { pairId: 'pair-old', contextId: 'context-1', priorityKey: 'a'.repeat(64), criteria: [previous] }, later(3), { startedAt: at }), /only an empty historical/);
  const empty = adapter.captureCriteria(adapter.create(), { pairId: 'pair-old', contextId: 'context-1', priorityKey: 'a'.repeat(64), criteria: [] }, later(3), { startedAt: at });
  assert.deepEqual(empty.meetingCriteria[0].criteria, []); assert.equal(empty.meetingCriteria[0].at, at);
});
test('new criterion requires a valid explicit answer snapshot and a fixed completed proposal', () => {
  const state = reflected();
  for (const patch of [{ source: undefined }, { source: { ...reflection.source, criteria: [discovered.field] } }, { source: { ...reflection.source, inferredPeerTrait: true } },
    { source: { ...reflection.source, criterion: { ...discovered, until: later(3) } } }, { proposalVersion: 2 }, { completedAt: later(5) }])
    assert.throws(() => adapter.criterion(state, { ...reflection, ...patch }, later(4)), /known meeting|changed completed|invalid private/);
});
test('new criterion apply source links only the next matching delivered recommendation, with a private meeting source', () => {
  let state = adapter.criterionCorrection(reflected({ evaluation: true }), correctedSnapshot, later(3));
  state = nextResult(state); assert.equal(state.records[0].correctionId, correctedSnapshot.id);
  assert.throws(() => adapter.followup(state, { decisionId: 'decision-next', value: 'better' }, later(5)), /delivered/);
  state = adapter.deliver(state, 'decision-next', later(5)); state = adapter.followup(state, { decisionId: 'decision-next', value: 'better' }, later(6));
  const row = inspect(state, later(173)).records[0]; assert.equal(row.followup.valid, true); assert.equal(row.followup.sourceDecisionId, null);
  assert.deepEqual(row.followup.sourceMeeting, { appointmentId: 'appointment-1', completedAt: later(2), label: discovered.label, valueLabel: discovered.valueLabel });
  const metrics = inspect(state, later(173)).metrics.followup; assert.equal(metrics.byPolicy[0].mean, 1); assert.equal(metrics.causalClaim, false);
  assert.equal(metrics.comparison.status, 'insufficient_evidence');
});
test('new criterion context, basis and source peer availability remain independent link gates', () => {
  const state = adapter.criterionCorrection(reflected(), correctedSnapshot, later(3));
  for (const options of [{ basisKey: 'd'.repeat(64) }, { contextId: 'context-other' }, { allowedSelectedIds: [] }])
    assert.equal(nextResult(state, options).records[0].correctionId, undefined);
});
test('withdrawing or replacing new reflection irreversibly invalidates followup, including same-timestamp re-entry', () => {
  let state = adapter.deliver(nextResult(adapter.criterionCorrection(reflected(), correctedSnapshot, later(3))), 'decision-next', later(5));
  state = adapter.followup(state, { decisionId: 'decision-next', value: 'same' }, later(6));
  state = adapter.criterion(state, { pairId: 'pair-1', appointmentId: 'appointment-1', field: discovered.field, value: null }, later(6));
  state = adapter.criterion(state, reflection, later(6)); assert.equal(inspect(state).records[0].followup.valid, false);
  assert.throws(() => adapter.followup(state, { decisionId: 'decision-next', value: 'better' }, later(7)), /no longer/);
  assert.equal(adapter.followup(state, { decisionId: 'decision-next', value: null }, later(7)).records[0].responses.followup, undefined);
});
test('new criterion comparison expires at the bound declaration deadline and cannot outlive it', () => {
  const until = later(8), state = reflected({ until });
  assert.throws(() => adapter.criterionCorrection(state, correctedSnapshot, later(3)), /invalid correction/);
  assert.throws(() => adapter.criterionCorrection(state, { ...correctedSnapshot, until: later(9) }, later(3)), /invalid correction/);
  const linked = adapter.deliver(nextResult(adapter.criterionCorrection(state, { ...correctedSnapshot, until }, later(3))), 'decision-next', later(5));
  assert.equal(inspect(linked, later(7)).records[0].followup.valid, true); assert.equal(inspect(linked, until).records[0].followup.valid, false);
  assert.throws(() => adapter.followup(linked, { decisionId: 'decision-next', value: 'better' }, until), /no longer/);
});
test('new criterion evaluation stays prospective and unknown remains separate from failure', () => {
  let state = reflected(); state = adapter.setting(state, { kind: 'evaluation-consent', enabled: true }, later(3));
  state = adapter.deliver(nextResult(adapter.criterionCorrection(state, correctedSnapshot, later(3))), 'decision-next', later(5));
  state = adapter.followup(state, { decisionId: 'decision-next', value: 'better' }, later(6));
  assert.equal(inspect(state, later(173)).metrics.followup.byPolicy[0].counts.decisions, 0);
  let eligible = adapter.deliver(nextResult(adapter.criterionCorrection(reflected({ evaluation: true }), correctedSnapshot, later(3))), 'decision-next', later(5));
  eligible = adapter.followup(eligible, { decisionId: 'decision-next', value: 'unknown' }, later(6));
  assert.equal(inspect(eligible, later(173)).metrics.followup.explicitUnknown, 1); assert.equal(inspect(eligible, later(173)).metrics.followup.byPolicy[0].mean, null);
  eligible = adapter.setting(eligible, { kind: 'evaluation-consent', enabled: false }, later(7));
  eligible = adapter.setting(eligible, { kind: 'evaluation-consent', enabled: true }, later(8));
  assert.equal(inspect(eligible, later(173)).metrics.followup.byPolicy[0].counts.decisions, 0);
  let afterConnection = adapter.captureCriteria(adapter.create(), { pairId: 'pair-1', contextId: 'context-1', priorityKey: 'a'.repeat(64), criteria: [previous] }, at);
  afterConnection = adapter.setting(afterConnection, { kind: 'evaluation-consent', enabled: true }, later(1));
  afterConnection = adapter.criterion(afterConnection, reflection, later(3));
  assert.equal(afterConnection.meetingCriteria[0].reviews[0].evaluationEligible, false);
});

const PREFIX = '/api/atlas-dating', exp = action => ({ kind: 'experience', action });
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-new-criterion-')); let clock = Date.parse(at), closed = false;
  const store = createDatingStore({ path: path.join(dir, 'dating.sqlite'), mode: 'demo' }), service = createDatingService({ store, mode: 'demo', clock: () => clock });
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  async function close() { if (closed) return; closed = true; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); }
  t.after(close);
  async function call(route, token, json) {
    const response = await fetch(origin + PREFIX + route, { method: json ? 'POST' : 'GET', headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json ? { 'Content-Type': 'application/json' } : {}) }, ...(json ? { body: JSON.stringify(json) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  async function login(role) { const result = await call('/demo/session', null, { role }); assert.equal(result.status, 200); return result.data; }
  async function get(token) { const result = await call('/state', token); assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data.view; }
  async function act(token, action, extras = {}) { const view = await get(token); return call('/action', token, { requestId: randomUUID(), expectedRevision: view.revision, action, ...extras }); }
  async function ok(token, action) { const result = await act(token, action); assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data; }
  async function pairAct(token, pairId, kind, action) { const p = (await get(token)).pairs.find(p => p.pairId === pairId);
    return ok(token, { kind, pairId, ...(kind === 'appointment' ? { expectedPairRevision: p.revision } : { expectedIntroductionRevision: p.introduction.revision }), action }); }
  async function preview(token, criterionReview) { const view = await get(token); return call('/preview', token, { expectedRevision: view.revision, criterionReview }); }
  return { store, call, login, get, act, ok, pairAct, preview, advance: ms => { clock += ms; }, close };
}
async function completed(t, { cap = 1, sourceUntil, sourceTarget = 'baseline' } = {}) {
  const f = await fixture(t), a = await f.login('adult-a'), b = await f.login('adult-b');
  for (const [p, pace] of [[a, 'listen'], [b, 'lead']]) {
    await f.ok(p.token, { kind: 'profile', profile: { nickname: p === a ? '가상 A' : '가상 B', region: '가상 지역', intro: '', required: [],
      values: { availability: 'weekend', 'self.pace': pace, 'self.plan': 'planned', 'self.contact': 'daily', 'self.rhythm': 'early',
        'self.relationshipGoal': 'committed', 'self.relationshipSpeed': 'gradual', 'self.meetingRegions': ['seoul-center'] } } });
    await f.ok(p.token, { kind: 'adult', declared: true });
    await f.ok(p.token, { kind: 'consents', consents: { profilePublic: true, receiveInvitations: true, storePreferences: true } });
  }
  for (const [field, value] of Object.entries({ consent: true, availability: 'weekend', 'self.pace': 'listen', 'wants.pace': 'lead', 'self.meetingRegions': ['seoul-center'] }))
    await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field, value } });
  // Publication is independent from each person's actual current meeting area.
  for (const [field, value] of Object.entries({ consent: true, 'self.meetingRegions': ['seoul-center'] }))
    await f.ok(b.token, { kind: 'discovery', action: { kind: 'set', field, value } });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.plan', value: 'planned', target: 'baseline', required: true } });
  if (cap === 2) await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.rhythm', value: 'early', target: 'baseline' } });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: 'wants.contact', value: 'daily', target: sourceTarget, ...(sourceUntil ? { until: sourceUntil } : {}) } });
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'priorities', fields: ['wants.plan', ...(cap === 2 ? ['wants.rhythm'] : [])], target: 'baseline' } });
  const connected = await f.ok(a.token, { kind: 'connect', targetAccountId: b.accountId }), pairId = connected.result.pairId;
  await f.pairAct(b.token, pairId, 'introduction', { kind: 'respond', introductionId: connected.result.introductionId, value: 'accept' });
  await f.pairAct(a.token, pairId, 'appointment', { kind: 'propose', schedule: { startsAt: later(24), endsAt: later(25), timeZone: 'Asia/Seoul', place: '가상 카페', note: '' } });
  const appointmentId = (await f.get(a.token)).pairs.find(p => p.pairId === pairId).view.currentId;
  for (const p of [a, b]) await f.pairAct(p.token, pairId, 'appointment', { kind: 'respond', appointmentId, proposalVersion: 1, value: 'accept' });
  const event = { kind: 'criterion', pairId, appointmentId, field: 'wants.contact', value: 'more-important', confirmedValue: 'daily' };
  assert.equal((await f.act(a.token, exp(event))).status, 403);
  f.advance(26 * 3600000); a.token = (await f.login('adult-a')).token; b.token = (await f.login('adult-b')).token;
  await f.pairAct(a.token, pairId, 'appointment', { kind: 'complete', appointmentId });
  const input = { pairId, appointmentId, field: event.field, target: 'context' };
  return { f, a, b, pairId, appointmentId, event, input };
}
test('HTTP new criterion uses own completed appointment and confirmed answer without changing criteria or peer records', async t => {
  const { f, a, b, pairId, event } = await completed(t), before = await f.get(a.token);
  assert.equal((await f.act(b.token, exp(event))).status, 403);
  assert.equal((await f.act(a.token, exp({ ...event, confirmedValue: 'few-days' }))).status, 400);
  const saved = await f.ok(a.token, exp(event)); assert.deepEqual(saved.view.discovery.priorities, before.discovery.priorities);
  assert.deepEqual(saved.view.discovery.fields, before.discovery.fields); assert.equal(saved.view.experience.criterionReviews[0].response.value, 'more-important');
  assert.deepEqual((await f.get(b.token)).experience.criterionReviews, []);
  const original = f.store.transaction(tx => tx.account(a.accountId).document.experience.meetingCriteria.find(m => m.pairId === pairId));
  assert.deepEqual(original.criteria.map(c => c.field), ['wants.plan']); assert.equal(original.reviews[0].source.criterion.value, 'daily');
});
test('HTTP new criterion preview reveals source and scope, needs explicit apply, and follows the next delivered result', async t => {
  const { f, a, event, input } = await completed(t); await f.ok(a.token, exp(event)); const before = await f.get(a.token);
  const preview = await f.preview(a.token, input); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.preview.criterionChange.valueLabel, before.discovery.fields.find(f => f.id === event.field).valueLabel);
  assert.equal(preview.data.preview.criterionChange.target, 'context'); assert.equal(preview.data.preview.criterionChange.replaceLabel, null);
  assert.deepEqual((await f.get(a.token)).discovery.priorities, before.discovery.priorities);
  const applied = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.ok(applied.result.correctionId); assert.deepEqual(applied.view.discovery.priorities.effective, ['wants.plan', 'wants.contact']);
  assert.equal(applied.view.discovery.fields.find(f => f.id === 'wants.plan').required, true);
  const issued = await f.ok(a.token, exp({ kind: 'view-result', token: applied.view.experience.recommendationToken }));
  const decisionId = issued.result.decisionId; assert.equal(issued.view.experience.records.find(r => r.id === decisionId).followup.sourceMeeting.appointmentId, input.appointmentId);
  assert.equal((await f.act(a.token, exp({ kind: 'followup', decisionId, value: 'better' }))).status, 400);
  await f.ok(a.token, exp({ kind: 'deliver', decisionId })); const responded = await f.ok(a.token, exp({ kind: 'followup', decisionId, value: 'better' }));
  assert.equal(responded.view.experience.records.find(r => r.id === decisionId).responses.followup.value, 'better');
});
test('HTTP two importance slots require the owner to choose replacement and never relax a required answer', async t => {
  const { f, a, event, input } = await completed(t, { cap: 2 }); await f.ok(a.token, exp(event));
  assert.equal((await f.preview(a.token, input)).status, 400); assert.equal((await f.preview(a.token, { ...input, replaceField: 'wants.pace' })).status, 400);
  const preview = await f.preview(a.token, { ...input, replaceField: 'wants.plan' }); assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.preview.criterionChange.replaceLabel, '상대에게 바라는 약속 방식');
  const result = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.deepEqual(result.view.discovery.priorities.effective, ['wants.rhythm', 'wants.contact']);
  const plan = result.view.discovery.fields.find(f => f.id === 'wants.plan'); assert.equal(plan.required, true); assert.equal(plan.value, 'planned');
});
test('HTTP current declaration changes, unknown answers and stale review source cannot authorize the old preview', async t => {
  const { f, a, event, input } = await completed(t); await f.ok(a.token, exp(event)); const preview = await f.preview(a.token, input);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'set', field: event.field, value: 'daily', target: 'baseline' } });
  assert.equal((await f.act(a.token, { kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  assert.equal((await f.preview(a.token, input)).status, 409);
  await f.ok(a.token, exp(event)); assert.equal((await f.preview(a.token, input)).status, 200);
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'mark-unknown', field: event.field } });
  assert.equal((await f.act(a.token, exp(event))).status, 409);
  const current = await f.get(a.token); assert.ok(!current.pairs[0].criterionReviews[0].addedCriteria.some(c => c.field === event.field));
});
test('HTTP bounded new importance expires and a once-only own answer cannot be promoted to baseline', async t => {
  const until = later(28), { f, a, event, input } = await completed(t, { sourceUntil: until, sourceTarget: 'context' });
  await f.ok(a.token, exp(event)); assert.equal((await f.preview(a.token, { ...input, target: 'baseline' })).status, 409);
  assert.equal((await f.preview(a.token, { ...input, until: later(29) })).status, 400);
  const preview = await f.preview(a.token, input); assert.equal(preview.status, 200, JSON.stringify(preview.data)); assert.equal(preview.data.preview.criterionChange.until, until);
  const applied = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token }); assert.ok(applied.view.discovery.priorities.effective.includes(event.field));
  f.advance(2 * 3600000); const expired = await f.get(a.token); assert.ok(!expired.discovery.priorities.effective.includes(event.field));
  assert.equal((await f.preview(a.token, input)).status, 409);
});
test('HTTP withdrawal and peer deletion stop new criterion changes while own saved reflection can still be erased', async t => {
  const { f, a, b, event, input } = await completed(t); await f.ok(a.token, exp(event)); const preview = await f.preview(a.token, input);
  await f.ok(a.token, exp({ kind: 'criterion', pairId: input.pairId, appointmentId: input.appointmentId, field: input.field, value: null }));
  assert.equal((await f.act(a.token, { kind: 'apply-preview', preview: preview.data.preview.token })).status, 409);
  await f.ok(a.token, exp(event)); await f.ok(b.token, { kind: 'delete' }); assert.equal((await f.preview(a.token, input)).status, 409);
  assert.equal((await f.get(a.token)).experience.criterionReviews[0].response.value, 'more-important');
  const erased = await f.ok(a.token, exp({ kind: 'criterion', pairId: input.pairId, appointmentId: input.appointmentId, field: input.field, value: null }));
  assert.deepEqual(erased.view.experience.criterionReviews, []);
});
test('HTTP retry of applied new importance is idempotent and returns current withdrawn source without reviving it', async t => {
  const { f, a, event, input } = await completed(t); await f.ok(a.token, exp(event));
  const preview = await f.preview(a.token, input), before = await f.get(a.token);
  const request = { requestId: randomUUID(), expectedRevision: before.revision, action: { kind: 'apply-preview', preview: preview.data.preview.token } };
  const applied = await f.call('/action', a.token, request); assert.equal(applied.status, 200, JSON.stringify(applied.data));
  const count = () => f.store.transaction(tx => tx.account(a.accountId).document.experience.corrections.length);
  assert.equal(count(), 1);
  await f.ok(a.token, exp({ kind: 'criterion', pairId: input.pairId, appointmentId: input.appointmentId, field: input.field, value: null }));
  const replay = await f.call('/action', a.token, request); assert.equal(replay.status, 200); assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.result.correctionId, applied.data.result.correctionId); assert.equal(count(), 1);
  assert.deepEqual(replay.data.view.experience.criterionReviews, []);
  const issued = await f.ok(a.token, exp({ kind: 'view-result', token: replay.data.view.experience.recommendationToken }));
  assert.equal(issued.view.experience.records.find(row => row.id === issued.result.decisionId).followup, undefined);
});
test('HTTP pause preserves private completed reflection without opening recommendation discovery and allows owner withdrawal', async t => {
  const { f, a, b, event, input } = await completed(t); await f.ok(a.token, exp(event));
  const paused = await f.ok(a.token, { kind: 'pause', paused: true }); assert.equal(paused.view.paused, true); assert.equal(paused.view.discovery, null);
  const review = paused.view.pairs[0].criterionReviews[0]; assert.equal(review.canAdd, false); assert.equal(review.canPreview, false); assert.deepEqual(review.addedCriteria, []);
  assert.equal(paused.view.experience.criterionReviews[0].response.value, 'more-important');
  assert.equal((await f.get(b.token)).pairs[0].paused, true);
  await f.ok(a.token, exp({ kind: 'criterion', pairId: input.pairId, appointmentId: input.appointmentId, field: input.field, value: null }));
  assert.deepEqual((await f.get(a.token)).experience.criterionReviews, []);
  const resumed = await f.ok(a.token, { kind: 'pause', paused: false }); assert.equal(resumed.view.paused, false);
});
test('HTTP expired temporary importance uses the live baseline scope and never reuses the expired deadline', async t => {
  const { f, a, event, input } = await completed(t);
  const until = new Date(Date.parse((await f.get(a.token)).asOf) + 5000).toISOString();
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'priorities', fields: ['wants.plan'], target: 'context', until } });
  f.advance(6000);
  const expired = await f.get(a.token); assert.equal(expired.discovery.priorities.expired.context, true);
  assert.deepEqual(expired.discovery.priorities.effective, ['wants.plan']);
  const saved = await f.ok(a.token, exp(event)); assert.equal(saved.view.pairs[0].criterionReviews[0].canApplyBaseline, true);
  for (const target of ['context', 'baseline']) {
    const preview = await f.preview(a.token, { ...input, target }); assert.equal(preview.status, 200, JSON.stringify(preview.data));
    assert.equal(preview.data.preview.criterionChange.until, null);
  }
  const preview = await f.preview(a.token, input);
  const applied = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.deepEqual(applied.view.discovery.priorities.effective, ['wants.plan', 'wants.contact']);
});
test('HTTP expired baseline importance can be replaced with a newly confirmed baseline criterion', async t => {
  const { f, a, event, input } = await completed(t);
  const until = new Date(Date.parse((await f.get(a.token)).asOf) + 5000).toISOString();
  await f.ok(a.token, { kind: 'discovery', action: { kind: 'priorities', fields: ['wants.plan'], target: 'baseline', until } });
  f.advance(6000); const expired = await f.get(a.token); assert.deepEqual(expired.discovery.priorities.effective, []);
  assert.equal(expired.discovery.priorities.expired.baseline, true);
  await f.ok(a.token, exp(event)); const preview = await f.preview(a.token, { ...input, target: 'baseline' });
  assert.equal(preview.status, 200, JSON.stringify(preview.data)); assert.equal(preview.data.preview.criterionChange.until, null);
  const applied = await f.ok(a.token, { kind: 'apply-preview', preview: preview.data.preview.token });
  assert.deepEqual(applied.view.discovery.priorities.effective, ['wants.contact']);
});
