import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntroductionsAdapter } from '../experiences/atlas-lab/introductions.mjs';
const adapter = createIntroductionsAdapter(), START = '2026-10-08T12:00:00.000Z';
const later = hours => new Date(Date.parse(START) + hours * 3600000).toISOString();
const create = () => adapter.create({ people: ['a', 'b'], at: START });
function act(state, actor, kind, fields = {}, at = START) {
  return adapter.record(state, { actor, kind, requestId: `request-${state.revision}`, expectedRevision: state.revision, at, ...fields });
}
const inspect = (state, viewer = 'a', at = START, pairId) => adapter.inspect(state, { viewer, at, pairId });
const send = state => act(state, 'a', 'send', { pairId: 'pair-1' });

test('a delivered request needs the recipient explicit acceptance and never creates date consent', () => {
  let state = send(create()); const before = structuredClone(state);
  assert.equal(inspect(state).accepted, false); assert.equal(inspect(state, 'b').canRespond, true);
  assert.throws(() => act(state, 'a', 'respond', { introductionId: 'request-0', value: 'accept' }), /response-unavailable/);
  state = act(state, 'b', 'respond', { introductionId: 'request-0', value: 'accept' });
  assert.equal(inspect(state).accepted, true); assert.equal(inspect(state).appointment, undefined);
  assert.equal(inspect(before).current.status, 'pending'); assert.equal(inspect(state, 'a', START, 'other-pair').accepted, false);
});

test('decline survives replacement pair IDs and only its author can reopen', () => {
  let state = act(send(create()), 'b', 'respond', { introductionId: 'request-0', value: 'decline' });
  assert.equal(inspect(state).current.status, 'declined'); assert.equal(inspect(state, 'a').canReopen, false);
  assert.equal(inspect(state, 'b').canReopen, true);
  assert.throws(() => act(state, 'a', 'reopen'), /reopen-unavailable/);
  assert.throws(() => act(state, 'a', 'send', { pairId: 'new-pair' }, later(200)), /unavailable/);
  state = act(state, 'b', 'reopen'); assert.equal(inspect(state).accepted, false);
  state = act(state, 'a', 'send', { pairId: 'new-pair' }); assert.equal(inspect(state).current.status, 'pending');
});

test('expiry is exact, is not a decline, and seven-day pressure limit survives a different pair', () => {
  const state = send(create());
  assert.equal(inspect(state, 'b', later(72 - 1 / 3600000)).current.status, 'pending');
  assert.equal(inspect(state, 'b', later(72)).current.status, 'expired');
  assert.throws(() => act(state, 'b', 'respond', { introductionId: 'request-0', value: 'accept' }, later(72)), /response-unavailable/);
  assert.throws(() => act(state, 'a', 'send', { pairId: 'new-pair' }, later(73)), /cooldown/);
  assert.equal(inspect(state, 'a', later(168)).canSend, true);
  const retry = act(state, 'a', 'send', { pairId: 'new-pair' }, later(168)); assert.equal(inspect(retry, 'a', later(168)).current.status, 'pending');
});

test('recipient explicit reopening after expiry permits a fresh request without reviving old acceptance', () => {
  let state = act(send(create()), 'b', 'reopen', {}, later(72));
  assert.equal(inspect(state, 'a', later(72)).canSend, true); assert.equal(inspect(state, 'b', later(72)).current.status, 'expired');
  assert.equal(inspect(state, 'b', later(72)).canReopen, false); assert.throws(() => act(state, 'b', 'reopen', {}, later(73)), /reopen-unavailable/);
  state = act(state, 'a', 'send', { pairId: 'pair-1' }, later(72)); assert.equal(inspect(state, 'b', later(72)).accepted, false);
});

test('withdrawal and relation closure revoke introduction consent and cannot be undone by the other person', () => {
  let state = act(send(create()), 'b', 'respond', { introductionId: 'request-0', value: 'accept' });
  state = act(state, 'a', 'withdraw', { introductionId: 'request-0' });
  assert.equal(inspect(state).accepted, false); assert.equal(inspect(state).current.status, 'withdrawn');
  assert.throws(() => act(state, 'b', 'reopen'), /reopen-unavailable/);
  state = act(state, 'a', 'reopen'); assert.throws(() => act(state, 'a', 'send', { pairId: 'new-pair' }), /cooldown/);
  state = act(state, 'b', 'close'); assert.equal(inspect(state, 'b').canReopen, true);
  assert.equal(inspect(state, 'a').closed, undefined); assert.equal(inspect(state, 'a').blockedBy, undefined);
});

test('revision, idempotency, actor, immutable input and time boundaries are validated', () => {
  const initial = create(), input = { kind: 'send', actor: 'a', requestId: 'same-id', expectedRevision: 0, pairId: 'pair-1', at: START };
  const state = adapter.record(initial, input); assert.equal(initial.revision, 0);
  assert.deepEqual(adapter.record(state, { ...input, at: later(1) }), state);
  assert.throws(() => adapter.record(state, { ...input, pairId: 'changed' }), /idempotency-conflict/);
  assert.throws(() => adapter.record(state, { ...input, requestId: 'new' }), /revision-conflict/);
  assert.throws(() => act(state, 'outsider', 'close'), /invalid/);
  assert.throws(() => act(state, 'a', 'close', { at: '2026-02-30T00:00:00.000Z' }), /invalid/);
  const next = act(state, 'a', 'close', {}, later(2)); assert.throws(() => inspect(next, 'a', later(1)), /invalid/);
  assert.throws(() => act(next, 'a', 'reopen', {}, later(1)), /invalid/);
  assert.throws(() => adapter.inspect(state, { viewer: 'outsider', at: START }), /invalid/);
});

test('restored ledgers cannot claim fake acceptance or leak an unrelated pair request', () => {
  const state = send(create());
  assert.throws(() => inspect({ ...state, accepted: true }), /invalid/);
  const forged = { ...state, revision: 2, events: [...state.events, { actor: 'a', kind: 'respond', requestId: 'fake', expectedRevision: 1, at: START, introductionId: 'request-0', value: 'accept' }] };
  assert.throws(() => inspect(forged), /response-unavailable/);
  assert.equal(inspect(state, 'a', START, 'other-pair').current, null);
});
