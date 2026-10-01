'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../atlas/preferences.js');
const A = require('../atlas/engine.js');
const X = require('../atlas/experiences.js');
const id = '01234567-89ab-4cde-8f01-23456789abcd';
const correlationId = 'fedcba98-7654-4321-8abc-def012345678';
const at = '2026-09-21T09:00:00.000Z';
const later = '2026-09-21T10:00:00.000Z';
const scope = { domain: 'LAB', workspace: 'game', subject: 'synthetic' };
const event = support => M.preferenceEvent(support, { id, at, correlationId });
const row = support => ({ ...event(support), event_id: id, ingested_at: later, learner_id: 'never-export', raw_text: 'never-export' });

test('the shared module works in CommonJS and as a browser global without network dependencies', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../atlas/preferences.js'), 'utf8'), context);
  assert.equal(context.SynkAtlasPreferences.MEMORY_VERSION, 'atlas-memory-1');
  assert.equal(M.EXPERIENCE_ID, 'letter');
  assert.equal(M.DIMENSION, 'atlas.letter.support');
  assert.equal(M.SURFACE, 'atlas_settings');
  assert.equal(M.RESET, 'default');
});

test('reserved Atlas dimensions are detected even when their type or dimension is malformed', () => {
  assert.equal(M.isAtlasPreference(event('step')), true);
  assert.equal(M.isAtlasPreference({ event_type: 'quiz.answered', payload: { preference_dimension: 'atlas.unknown' } }), true);
  for (const input of [null, [], {}, { payload: null }, { payload: { preference_dimension: 'study_environment' } }, { payload: { preference_dimension: 1 } }]) {
    assert.equal(M.isAtlasPreference(input), false);
  }
});

test('preference semantic validation rejects unsupported Atlas claims and extra raw payload fields', () => {
  for (const mode of ['choose', 'step', 'independent', null]) assert.deepEqual(M.validatePreference(event(mode)), { ok: true });
  const base = event('step');
  for (const payload of [null, [], { ...base.payload, ver: 2 }, { ...base.payload, preference_dimension: 'atlas.letter.time' },
    { ...base.payload, stated_via: 'inferred' }, { ...base.payload, stated_option: 'expert' }, { ...base.payload, stated_option: null },
    { ...base.payload, evidence_text: 'a raw sentence' }, { ...base.payload, learner_id: id }]) {
    assert.equal(M.validatePreference({ ...base, payload }).ok, false);
  }
  assert.equal(M.validatePreference({ ...base, event_type: 'signal.observed' }).ok, false);
  assert.equal(M.validatePreference(null).ok, false);
});

test('producer returns a complete c16 envelope with deterministic canonical JSON and no extra fields', () => {
  const first = event('step');
  assert.deepEqual(first, {
    idempotency_key: id, event_type: 'preference.stated', occurred_at: at, level_snapshot: null, correlation_id: correlationId,
    payload: { ver: 1, preference_dimension: 'atlas.letter.support', stated_option: 'step', stated_via: 'atlas_settings' },
  });
  const again = M.preferenceEvent('step', { raw_text: 'private', learner_id: 'private', correlationId: correlationId.toUpperCase(), at: '2026-09-21T18:00:00+09:00', id: id.toUpperCase() });
  assert.equal(JSON.stringify(first), JSON.stringify(again));
  assert.equal(event(null).payload.stated_option, 'default');
  for (const invalid of ['default', undefined, false, 0, {}]) assert.throws(() => event(invalid), /invalid support/);
  assert.throws(() => M.preferenceEvent('step', { id: 'not-a-uuid', at, correlationId }), /invalid id/);
  assert.throws(() => M.preferenceEvent('step', { id, at, correlationId: null }), /invalid correlationId/);
});

test('row projection exports only the latest declared preference and its server revision', () => {
  const input = row('independent');
  const before = JSON.stringify(input);
  const snapshot = M.snapshotFromRow(input);
  assert.deepEqual(snapshot, { memory_ver: 'atlas-memory-1', experience_id: 'letter', revision: id, support: 'independent', updated_at: later });
  assert.equal(JSON.stringify(input), before);
  assert.equal(JSON.stringify(snapshot).includes('never-export'), false);
  assert.deepEqual(M.snapshotFromRow(null), { memory_ver: 'atlas-memory-1', experience_id: 'letter', revision: null, support: null, updated_at: null });
  assert.equal(M.snapshotFromRow(row(null)).revision, id);
  assert.equal(M.snapshotFromRow(row(null)).support, null);
  for (const invalid of [undefined, {}, { ...input, event_id: null }, { ...input, ingested_at: null }, { ...input, event_type: 'quiz.answered' }]) {
    assert.throws(() => M.snapshotFromRow(invalid), /Atlas memory: invalid/);
  }
});

test('server rows accept valid PostgreSQL Date values without widening the public snapshot contract', () => {
  const expected = M.snapshotFromRow(row('step'));
  const date = new Date(later);
  assert.deepEqual(M.snapshotFromRow({ ...row('step'), ingested_at: date }), expected);
  assert.equal(date.toISOString(), later);
  const crossRealmDate = vm.runInNewContext(`new Date('${later}')`);
  assert.deepEqual(M.snapshotFromRow({ ...row('step'), ingested_at: crossRealmDate }), expected);
  for (const invalid of [new Date(NaN), Date.parse(later), { toISOString: () => later }]) {
    assert.throws(() => M.snapshotFromRow({ ...row('step'), ingested_at: invalid }), /invalid ingested_at/);
  }
  assert.throws(() => M.validateSnapshot({ ...expected, updated_at: date }), /invalid updated_at/);
});

test('snapshot validation normalizes, is JSON-idempotent and never mutates or exports extra fields', () => {
  const input = { ...M.snapshotFromRow(row('choose')), revision: id.toUpperCase(), updated_at: '2026-09-21T19:00:00+09:00', raw_text: 'private', subject: 'private' };
  const normalized = M.validateSnapshot(input);
  assert.equal(normalized.updated_at, later);
  assert.equal(normalized.revision, id);
  assert.equal(JSON.stringify(M.validateSnapshot(JSON.parse(JSON.stringify(normalized)))), JSON.stringify(normalized));
  assert.equal(JSON.stringify(normalized).includes('private'), false);
  assert.equal(input.raw_text, 'private');
});

test('snapshot rejects unsupported versions, inconsistent empty values, invalid IDs and invalid calendar times', () => {
  const good = M.snapshotFromRow(row('step'));
  const invalid = [null, [], {}, { ...good, memory_ver: 'atlas-memory-2' }, { ...good, experience_id: 'speech' },
    { ...good, revision: null }, { ...good, revision: 'not-uuid' }, { ...good, support: 'default' }, { ...good, support: undefined },
    { ...good, updated_at: null }, { ...good, updated_at: '2026-09-21' }, { ...good, updated_at: '2026-02-30T10:00:00Z' },
    { ...good, updated_at: '2026-09-21T24:00:00Z' }, { ...good, updated_at: '2026-09-21T10:00:00+99:00' },
    { memory_ver: M.MEMORY_VERSION, experience_id: M.EXPERIENCE_ID, revision: null, support: null, updated_at: later }];
  for (const candidate of invalid) assert.throws(() => M.validateSnapshot(candidate), /Atlas memory: invalid/);
});

test('server preference survives a fresh session and changes the actual letter guidance', () => {
  const snapshot = M.snapshotFromRow(row('independent'));
  const events = M.kernelEvents(snapshot, scope);
  const restored = A.createSession({ scope, events, clock: () => later });
  const plan = restored.plan('letter', X.modesFor('LAB'), { levers: X.leversFor('LAB') });
  assert.equal(plan.support, 'independent');
  assert.equal(plan.bundle['vellum.checks'].basis, 'declared');
  assert.equal(X.guidance(plan).title, '먼저 쓰고, 필요할 때 점검하기');
  assert.equal(A.VERSION, 'atlas-2.2.0');
  assert.equal(restored.state().evidence.support, `memory.${id}`);
});

test('replaying one revision is idempotent even if JSON input fields arrive in a different order', () => {
  const snapshot = M.snapshotFromRow(row('step'));
  const reordered = { updated_at: snapshot.updated_at, support: snapshot.support, revision: snapshot.revision,
    experience_id: snapshot.experience_id, memory_ver: snapshot.memory_ver };
  const first = M.kernelEvents(snapshot, scope);
  const second = M.kernelEvents(reordered, { subject: scope.subject, workspace: scope.workspace, domain: scope.domain });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(A.createSession({ scope, events: [...first, ...second], clock: () => later }).events().length, 1);
  assert.throws(() => A.createSession({ scope, events: [...first, ...M.kernelEvents({ ...snapshot, support: 'choose' }, scope)] }), /conflicting event id/);
});

test('a reset retains a null declaration and prevents an older declared help setting from reviving', () => {
  const previous = A.createSession({ scope, clock: () => at, id: () => 'previous' });
  previous.set('support', 'step');
  const reset = M.kernelEvents(M.snapshotFromRow(row(null)), scope);
  assert.equal(reset.length, 1);
  assert.equal(reset[0].value, null);
  const restored = A.createSession({ scope, events: [...previous.events(), ...reset], clock: () => later });
  assert.equal(restored.state().context.support, undefined);
  assert.equal(restored.plan('letter', X.modesFor('LAB'), { levers: X.leversFor('LAB') }).support, 'choose');
  assert.deepEqual(M.kernelEvents(M.snapshotFromRow(null), scope), []);
});

test('kernel projection takes only explicit LAB scope identifiers and ignores untrusted extra fields', () => {
  const snapshot = M.snapshotFromRow(row('step'));
  const projected = M.kernelEvents(snapshot, { ...scope, raw_text: 'private', learner_id: 'private' });
  assert.deepEqual(projected[0].scope, scope);
  assert.equal(JSON.stringify(projected).includes('private'), false);
  for (const wrong of [null, {}, { ...scope, domain: 'SHIFT' }, { ...scope, subject: 'email@example.com' }, { ...scope, workspace: '' }]) {
    assert.throws(() => M.kernelEvents(snapshot, wrong), /invalid scope/);
  }
  assert.throws(() => A.createSession({ scope: { ...scope, subject: 'another-person' }, events: projected }), /scope mismatch/);
});

test('a second reviewed experience has its own declaration and cannot accept a letter snapshot', () => {
  const documents = M.preferenceEvent('step', { experienceId: 'documents', id, at, correlationId });
  assert.equal(documents.payload.preference_dimension, 'atlas.documents.support');
  assert.equal(M.validatePreference(documents).ok, true);
  const saved = M.snapshotFromRow({ ...documents, event_id: id, ingested_at: later }, 'documents');
  assert.equal(saved.experience_id, 'documents');
  assert.throws(() => M.validateSnapshot(saved, 'letter'), /invalid experience/);
  assert.throws(() => M.snapshotFromRow(row('step'), 'documents'), /invalid experience/);
  assert.throws(() => M.dimensionFor('constructor'), /invalid experience/);
  assert.equal(M.experienceForWorkspace('professor-letter'), 'letter');
  assert.equal(M.experienceForWorkspace('document-gate'), 'documents');
  assert.throws(() => M.experienceForWorkspace('new-content'), /invalid workspace/);
  assert.throws(() => M.preferenceEvent('step', { experienceId: 'all', id, at, correlationId }), /invalid experience/);
  const restored = A.createSession({ scope, events: M.kernelEvents(saved, scope), clock: () => later });
  const plan = restored.plan('document-gate', X.modesFor('LAB'));
  assert.deepEqual(X.documentReview(plan, 4), { visible: 1, remaining: 3 });
  assert.deepEqual(X.documentReview(plan, 4, 2), { visible: 2, remaining: 2 });
  assert.deepEqual(X.documentReview(plan, 4, 9), { visible: 4, remaining: 0 });
  assert.deepEqual(X.documentReview({ support: 'independent' }, 4), { visible: 0, remaining: 4 });
  assert.deepEqual(X.documentReview({ support: 'independent' }, 4, 1, true), { visible: 4, remaining: 0 });
  assert.deepEqual(X.documentReview({ support: 'choose' }, 4), { visible: 4, remaining: 0 });
});
