import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeetingAlignment } from '../experiences/atlas-lab/meeting-alignment.mjs';
const at = '2026-10-07T03:00:00.000Z';
const adapter = createMeetingAlignment();
const context = patch => ({ pairId: 'pair-1', available: true, firstMeetingStarted: false,
  introduction: { id: 'intro-1', sentAt: at, accepted: true }, people: [
    { id: 'a', label: '가상 A', generation: 0, values: { 'self.plan': 'planned', 'self.pace': 'lead', 'self.notice': 'advance' } },
    { id: 'b', label: '가상 B', generation: 0, values: { 'self.plan': 'spontaneous', 'self.pace': 'listen', 'self.notice': 'when-free' } },
  ], ...patch });
const inspect = (state, c = context(), viewer = 'a') => adapter.inspect(state, c, { viewer, at });
const respond = (state, value, actor = 'a', c = context()) => adapter.record(state, c, { actor, value, key: inspect(state, c, actor).key, expectedRevision: state.revision, at });
const choose = (state, optionId, actor = 'a', c = context()) => adapter.record(state, c, { actor, kind: 'propose-option', optionId,
  key: inspect(state, c, actor).key, expectedRevision: state.revision, at });
test('offers only the first authored public difference and viewing writes nothing', () => {
  const state = adapter.create(), before = structuredClone(state), v = inspect(state);
  assert.equal(v.field, 'self.plan'); assert.equal(v.status, 'optional'); assert.equal(v.basis.length, 2);
  assert.deepEqual(state, before); assert.equal(v.me.value, null); assert.equal(v.partner.value, null);
});
test('unanswered, different, agreement and own withdrawal remain separate', () => {
  let state = respond(adapter.create(), 'yes'); assert.equal(inspect(state).status, 'waiting');
  state = respond(state, 'different', 'b'); assert.equal(inspect(state).status, 'different');
  state = respond(state, 'yes', 'b'); assert.equal(inspect(state).status, 'agreed');
  state = respond(state, null); assert.equal(inspect(state).status, 'waiting'); assert.equal(inspect(state).partner.value, 'yes');
});
test('missing, same and flexible public answers are not guessed into a question', () => {
  for (const values of [{}, { 'self.plan': 'planned' }, { 'self.notice': 'flexible' }]) {
    const c = context(); c.people[1].values = values;
    assert.equal(inspect(adapter.create(), c).status, 'unavailable');
  }
});
test('pause, unaccepted introduction and first started meeting prohibit new answers', () => {
  for (const patch of [{ available: false }, { firstMeetingStarted: true }, { introduction: { id: 'intro-1', sentAt: at, accepted: false } }]) {
    const state = adapter.create(), c = context(patch);
    assert.equal(inspect(state, c).canRespond, false);
    assert.throws(() => adapter.record(state, c, { actor: 'a', value: 'yes', key: inspect(state).key, expectedRevision: 0, at }), { code: 'alignment-stale' });
  }
});
test('source generation and new introduction clear both apparent responses and stale writes', () => {
  let state = respond(adapter.create(), 'yes'); state = respond(state, 'yes', 'b');
  for (const c of [context({ introduction: { id: 'intro-2', sentAt: at, accepted: true } }), (() => { const c = context(); c.people[1].generation++; return c; })()]) {
    assert.equal(inspect(state, c).status, 'optional'); assert.equal(inspect(state, c).partner.value, null);
    assert.throws(() => adapter.record(state, c, { actor: 'a', value: 'yes', key: inspect(state).key, expectedRevision: state.revision, at }), { code: 'alignment-stale' });
  }
});
test('cross-pair keys, forged actor, stale revision and injected fields are rejected', () => {
  const state = adapter.create(), input = { actor: 'a', value: 'yes', key: inspect(state).key, expectedRevision: 0, at };
  assert.throws(() => adapter.record(state, context({ pairId: 'pair-2' }), input), { code: 'alignment-stale' });
  assert.throws(() => adapter.record(state, context(), { ...input, actor: 'c' }), { code: 'invalid-alignment' });
  assert.throws(() => adapter.record(state, context(), { ...input, expectedRevision: 1 }), { code: 'alignment-revision-conflict' });
  assert.throws(() => adapter.record(state, context(), { ...input, preference: 'planned' }), { code: 'invalid-alignment' });
});

test('legacy version-one responses remain readable until an explicit alternative replaces them', () => {
  let state = respond(adapter.create(), 'yes'); state = respond(state, 'yes', 'b');
  assert.equal(state.version, 'meeting-alignment-1'); assert.equal(Object.hasOwn(state, 'proposal'), false);
  const before = inspect(state); state = choose(state, 'full-plan'); const current = inspect(state);
  assert.equal(current.contextKey, before.key); assert.notEqual(current.key, before.key);
  assert.equal(current.selectedOptionId, 'full-plan'); assert.equal(current.proposalVersion, 1);
  assert.equal(current.status, 'optional'); assert.equal(current.me.value, null); assert.equal(current.partner.value, null);
  assert.equal(current.proposal.byMe, true); assert.equal(inspect(state, context(), 'b').proposal.byMe, false);
});

test('a proposal itself is not consent and only two explicit answers to the current option agree', () => {
  let state = respond(adapter.create(), 'different', 'b'); state = choose(state, 'full-plan', 'b');
  assert.equal(inspect(state).status, 'optional');
  assert.equal(inspect(state).suggestion.includes('순서'), true);
  state = respond(state, 'yes'); assert.equal(inspect(state).status, 'waiting');
  state = respond(state, 'yes', 'b'); assert.equal(inspect(state).status, 'agreed');
  state = respond(state, null, 'b'); assert.equal(inspect(state).status, 'waiting'); assert.equal(inspect(state).partner.value, null);
});

test('replacing an alternative and returning to baseline never revive previous yes responses', () => {
  let state = respond(adapter.create(), 'yes'); state = respond(state, 'yes', 'b'); const legacy = inspect(state);
  state = choose(state, 'full-plan'); state = respond(state, 'yes'); state = respond(state, 'yes', 'b'); const alternative = inspect(state);
  state = choose(state, 'on-day', 'b'); assert.equal(inspect(state).proposalVersion, 2); assert.equal(inspect(state).status, 'optional');
  state = adapter.record(state, context(), { actor: 'b', kind: 'cancel-option', key: inspect(state).key, expectedRevision: state.revision, at });
  assert.equal(inspect(state).selectedOptionId, 'baseline'); assert.equal(inspect(state).proposalVersion, 3); assert.equal(inspect(state).status, 'optional');
  assert.notEqual(inspect(state).key, legacy.key); assert.notEqual(inspect(state).key, alternative.key);
  state = choose(state, 'full-plan'); assert.notEqual(inspect(state).key, alternative.key); assert.equal(inspect(state).status, 'optional');
});

test('old proposal key, concurrent revision, injected values and cancellation by the peer are rejected', () => {
  const initial = adapter.create(), old = inspect(initial); let state = choose(initial, 'full-plan');
  assert.throws(() => adapter.record(state, context(), { actor: 'b', value: 'yes', key: old.key, expectedRevision: state.revision, at }), { code: 'alignment-stale' });
  assert.throws(() => adapter.record(state, context(), { actor: 'b', kind: 'propose-option', optionId: 'on-day', key: old.key, expectedRevision: initial.revision, at }), { code: 'alignment-revision-conflict' });
  assert.throws(() => adapter.record(state, context(), { actor: 'b', kind: 'cancel-option', key: inspect(state).key, expectedRevision: state.revision, at }), { code: 'alignment-cancel-forbidden' });
  for (const input of [{ optionId: 'when-free' }, { optionId: 'full-plan' }, { optionId: 'on-day', value: 'yes' }, { optionId: 'on-day', kind: 'free-text' }]) {
    assert.throws(() => adapter.record(state, context(), { actor: 'a', kind: 'propose-option', optionId: 'on-day', key: inspect(state).key, expectedRevision: state.revision, at, ...input }), { code: 'invalid-alignment' });
  }
});

test('only authored choices for the currently public difference are accepted', () => {
  const pace = context(); pace.people[1].values['self.plan'] = 'planned';
  let state = choose(adapter.create(), 'lead-first', 'a', pace); assert.equal(inspect(state, pace).field, 'self.pace');
  const notice = context(); notice.people[1].values['self.plan'] = 'planned'; notice.people[1].values['self.pace'] = 'lead';
  state = choose(adapter.create(), 'agree-window', 'b', notice); assert.equal(inspect(state, notice).field, 'self.notice');
  assert.throws(() => choose(adapter.create(), 'full-plan', 'a', notice), { code: 'invalid-alignment' });
});

test('public generation, introduction and first-meeting cutoff invalidate the alternative itself', () => {
  let state = choose(adapter.create(), 'full-plan'); state = respond(state, 'yes'); state = respond(state, 'yes', 'b'); const old = inspect(state);
  const changed = context(); changed.people[1].generation++;
  for (const c of [changed, context({ introduction: { id: 'intro-2', sentAt: at, accepted: true } })]) {
    const view = inspect(state, c); assert.equal(view.status, 'optional'); assert.equal(view.selectedOptionId, 'baseline');
    assert.equal(view.proposal, null); assert.equal(view.me.value, null); assert.notEqual(view.key, old.key);
    assert.throws(() => adapter.record(state, c, { actor: 'a', kind: 'propose-option', optionId: 'on-day', key: old.key, expectedRevision: state.revision, at }), { code: 'alignment-stale' });
  }
  for (const c of [context({ firstMeetingStarted: true }), context({ available: false })]) {
    assert.equal(inspect(state, c).canProposeOption, false);
    assert.throws(() => adapter.record(state, c, { actor: 'a', kind: 'cancel-option', key: old.key, expectedRevision: state.revision, at }), { code: 'alignment-stale' });
  }
});
