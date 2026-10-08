import test from 'node:test';
import assert from 'node:assert/strict';
import { createReconnectAdapter } from '../experiences/atlas-lab/reconnect.mjs';
const api = createReconnectAdapter();
const people = [{ id: 'person-a', label: '나' }, { id: 'person-b', label: '상대' }];
const create = () => api.create({ pairId: 'pair-1', people });
const act = (state, kind, person = 'person-a', extra = {}) => api.record(state, { kind, person, ...extra });
const view = (state, viewer = 'person-a', extra = {}) => api.inspect(state, { viewer, ...extra });
const met = () => act(create(), 'met', 'person-a', { encounterId: 'meeting-1' });
const intent = (state, value) => act(state, 'intent', 'person-a', { encounterId: 'meeting-1', value });
const send = (state = met(), extra = {}) => act(state, 'send', 'person-a', { encounterId: 'meeting-1', to: 'person-b', message: '함께 다음 만남을 준비할까요?', ...extra });
const respond = (state, value) => act(state, 'respond', 'person-b', { invitationId: view(state).invitation.id, value });

test('private intent is independent of other attendance and never creates an invitation', () => {
  const base = met();
  for (const value of ['yes', 'no', 'unsure', 'not-now']) {
    const state = intent(base, value);
    assert.equal(view(state).me.intent.value, value); assert.equal(view(state).invitation, null);
    assert.equal(view(state, 'person-b').me.intent, null); assert.equal(view(state, 'person-b').me.canReflect, false);
    assert.ok(!JSON.stringify(view(state, 'person-b')).includes(`"value":"${value}"`));
    assert.equal(view(state).canSuggest, !['no', 'not-now'].includes(value));
  }
  assert.throws(() => intent(create(), 'yes'), /own attendance/);
  assert.equal(view(intent(intent(base, 'no'), null)).me.intent, null);
});

test('only explicit sent text crosses the boundary; private correction and deletion preserve the invitation', () => {
  const sent = send(intent(met(), 'yes')), original = view(sent).invitation;
  for (const value of ['no', 'not-now', null]) {
    const state = intent(sent, value);
    assert.deepEqual(view(state).invitation, original); assert.deepEqual(view(state, 'person-b').invitation, original);
    assert.equal(view(state, 'person-b').me.intent, null);
  }
  assert.equal(original.status, 'pending'); assert.equal(original.response, null);
  assert.equal(view(sent, 'person-b').canRespond, true); assert.equal(view(sent).canRespond, false);
});

test('invitation acceptance is preparation, not a concrete appointment or private yes', () => {
  const state = respond(send(), 'accept');
  assert.equal(view(state).canPrepare, true); assert.equal(view(state).invitation.status, 'accepted');
  assert.equal(view(state, 'person-b').me.intent, null);
  assert.throws(() => send(state), /one active invitation/);
  const prepared = act(state, 'prepare', 'person-b', { invitationId: view(state).invitation.id });
  assert.equal(view(prepared).canPrepare, false); assert.equal(view(prepared).canWithdraw, false);
  assert.throws(() => act(prepared, 'prepare', 'person-a', { invitationId: view(prepared).invitation.id }), /no new accepted/);
});

test('busy and decline close only this invite, suppress repeats and require recipient reopening', () => {
  for (const answer of ['busy', 'decline']) {
    let state = respond(send(), answer);
    assert.equal(view(state).invitation.status, answer === 'busy' ? 'deferred' : 'declined');
    assert.equal(view(state, 'person-b').me.receiving, false); assert.equal(view(state).canSend, false);
    assert.throws(() => send(state), /unavailable/);
    state = act(state, 'reopen'); assert.equal(view(state).canSend, false, 'sender cannot reopen recipient access');
    state = act(state, 'met', 'person-b', { encounterId: 'meeting-1' });
    state = act(state, 'intent', 'person-b', { encounterId: 'meeting-1', value: 'yes' });
    assert.equal(view(state).canSend, false, 'a private yes is not permission to receive');
    state = act(state, 'reopen', 'person-b');
    assert.equal(view(state).canSend, true); assert.equal(view(send(state)).history.length, 2);
  }
});

test('deadline boundary expires without rejection and cannot be extended by reading or old replies', () => {
  const state = send(), deadline = view(state).invitation.expiresAt;
  assert.equal(view(state, 'person-b', { at: new Date(Date.parse(deadline) - 1).toISOString() }).canRespond, true);
  const expired = view(state, 'person-b', { at: deadline });
  assert.equal(expired.invitation.status, 'expired'); assert.equal(expired.invitation.response, null); assert.equal(expired.canRespond, false);
  assert.throws(() => act(state, 'respond', 'person-b', { invitationId: expired.invitation.id, value: 'accept', at: deadline }), /no longer available/);
  assert.equal(view(state).invitation.status, 'pending', 'read-only evaluation does not rewrite stored history');
  const renewed = send(state, { at: new Date(Date.parse(deadline) + 1).toISOString() });
  assert.equal(view(renewed).history[0].status, 'expired'); assert.equal(view(renewed).history[0].response, null);
});

test('idempotent resend preserves its deadline, while mismatched ids and stale revisions fail', () => {
  const before = met(), input = { kind: 'send', person: 'person-a', encounterId: 'meeting-1', to: 'person-b', message: '다시 만날까요?', requestId: 'request-1', expectedRevision: before.events.length };
  const state = api.record(before, input);
  assert.deepEqual(api.record(state, { ...input, at: '2026-10-08T00:00:00.000Z' }), state);
  assert.throws(() => api.record(state, { ...input, message: '다른 내용' }), /request id reused/);
  assert.throws(() => act(state, 'pause', 'person-a', { expectedRevision: 0 }), /stale revision/);
  assert.throws(() => act(state, 'send', 'person-b', { encounterId: 'meeting-1', to: 'person-a', message: '다른 초대' }), /invalid explicit/);
});

test('pause blocks only new work; existing invitation and response remain usable', () => {
  let state = send(), original = view(state).invitation;
  state = act(state, 'pause', 'person-b');
  assert.deepEqual(view(state).invitation, original); assert.equal(view(state).canStartPlan, false);
  assert.equal(view(state, 'person-b').canRespond, true);
  state = respond(state, 'accept'); assert.equal(view(state).invitation.status, 'accepted');
  const publicSender = view(state); assert.equal(Object.hasOwn(publicSender, 'partner'), false);
  assert.equal(publicSender.me.paused, false, 'recipient pause does not appear as sender state');
  state = act(state, 'resume', 'person-b'); assert.equal(view(state).canStartPlan, true);
});

test('withdrawal is explicit, sender-owned and preserves what was sent', () => {
  const sent = send(), invitation = view(sent).invitation;
  assert.throws(() => act(sent, 'withdraw', 'person-b', { invitationId: invitation.id }), /only sender/);
  const state = act(sent, 'withdraw', 'person-a', { invitationId: invitation.id });
  assert.equal(view(state).invitation.status, 'withdrawn'); assert.equal(view(state).invitation.message, invitation.message);
  assert.throws(() => respond(state, 'accept'), /no longer available/);
});

test('block immediately redacts pair history and stops late acceptance; unblock never resurrects it', () => {
  let state = send(); const id = view(state).invitation.id;
  state = act(state, 'block', 'person-b');
  for (const person of ['person-a', 'person-b']) { const snapshot = view(state, person); assert.equal(snapshot.access, 'unavailable'); assert.equal(snapshot.invitation, null); assert.deepEqual(snapshot.history, []); }
  assert.equal(view(state).me.blocking, false); assert.equal(view(state, 'person-b').me.blocking, true);
  assert.throws(() => act(state, 'respond', 'person-b', { invitationId: id, value: 'accept' }), /no longer available/);
  state = act(state, 'unblock', 'person-b');
  assert.equal(view(state).invitation.status, 'closed'); assert.equal(view(state).canSend, false);
  state = act(state, 'reopen', 'person-b'); assert.equal(view(state).canSend, true);
});

test('cross-pair logs, foreign actors and malformed event clocks fail replay', () => {
  const state = send(); const forged = structuredClone(state); forged.pairId = 'pair-2';
  assert.throws(() => view(forged), /cross-pair/);
  assert.throws(() => act(state, 'pause', 'outsider'), /invalid/);
  assert.throws(() => view(state, 'outsider'), /unknown viewer/);
  assert.throws(() => view(create(), 'person-a', { at: 'bad' }), /invalid time/);
  const late = structuredClone(state); late.events[1].at = late.events[0].at; assert.throws(() => view(late), /stale/);
});
