import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppointmentsAdapter, createAppointmentAdapter } from '../experiences/atlas-lab/appointments.mjs';

const START = '2026-10-06T10:00:00.000Z';
const NEXT = '2026-10-07T10:00:00.000Z';
const END = '2026-10-07T11:00:00.000Z';
const A = 'demo:adult-a', B = 'demo:adult-b';
const people = [{ id: A, label: '가상 성인 A' }, { id: B, label: '가상 성인 B' }];
const api = createAppointmentsAdapter({ clock: () => START });
const fresh = () => api.create({ pairId: 'pair:1', people, at: START });
const plan = (extra = {}) => ({ startsAt: NEXT, endsAt: END, timeZone: 'Asia/Seoul', place: '가상의 카페', ...extra });
const view = (state, viewer = A, at = state.events.at(-1)?.at || START) => api.inspect(state, { viewer, at });
const latest = (state, viewer = A, at) => view(state, viewer, at).appointments.at(-1);
const action = (state, kind, actor = A, extra = {}) => api.record(state, {
  kind, actor, requestId: `request-${state.revision + 1}`, expectedRevision: state.revision, at: state.events.at(-1)?.at || START, ...extra
});
const proposed = (extra = {}, state = fresh()) => action(state, 'propose', A, { schedule: plan(), ...extra });
const respond = (state, actor, value = 'accept', extra = {}) => action(state, 'respond', actor, {
  appointmentId: latest(state).id, proposalVersion: latest(state).proposal.version, value, ...extra
});
const confirmed = (state = proposed()) => respond(respond(state, A), B);
const complete = (state, actor = A, at = END) => action(state, 'complete', actor, { appointmentId: latest(state).id, at });

test('new pair has no invented responses or inbox, and public views are detached from stored state', () => {
  assert.equal(createAppointmentAdapter, createAppointmentsAdapter);
  const state = fresh(), before = JSON.stringify(state), projection = view(state);
  assert.equal(projection.canPropose, true); assert.equal(projection.currentId, null);
  assert.deepEqual(projection.appointments, []); assert.deepEqual(projection.inbox, []);
  assert.deepEqual(projection.me.reflections, []); assert.equal(projection.me.notificationsEnabled, true);
  projection.people[0].label = 'changed'; projection.me.reflections.push({ note: 'not stored' });
  assert.equal(JSON.stringify(state), before); assert.equal(view(state).people[0].label, people[0].label);
  assert.throws(() => view(state, 'foreign'), /unknown viewer/);
});

test('ISO offsets are normalized to the same instant and IANA zone remains explicit for display', () => {
  const state = proposed({ schedule: plan({ startsAt: '2026-10-07T19:00:00+09:00', endsAt: '2026-10-07T20:00:00+09:00', place: '  카페  ', note: '  입구에서 봐요  ' }) });
  const proposal = latest(state).proposal;
  assert.deepEqual(proposal.schedule, plan({ note: '입구에서 봐요', place: '카페' }));
  assert.equal(proposal.expiresAt, NEXT, 'default deadline cannot exceed the meeting start');
  assert.ok(latest(state).people.every(person => person.response === 'unanswered'));
  assert.equal(latest(state).status, 'pending'); assert.equal(view(state).canPropose, false);
});

test('invalid dates, ambiguous local instants, bad zones, nonfuture starts and inverted intervals fail', () => {
  for (const schedule of [
    plan({ startsAt: '2026-02-30T10:00:00Z' }), plan({ startsAt: '2026-10-07T24:00:00Z' }),
    plan({ startsAt: '2026-10-07T19:00:00' }), plan({ startsAt: '2026-10-07T19:00:00+14:30' }),
    plan({ timeZone: 'Not/AZone' }), plan({ startsAt: START }), plan({ endsAt: NEXT }),
    plan({ place: ' ' }), plan({ note: 'x'.repeat(281) }), { ...plan(), privateScore: 9 }
  ]) assert.throws(() => proposed({ schedule }), /Appointments:/);
});

test('explicit deadlines must be future, within 72 hours and no later than the schedule start', () => {
  for (const expiresAt of [START, '2026-10-07T10:00:00.001Z', '2026-10-06T09:59:59Z']) assert.throws(() => proposed({ expiresAt }), /deadline/);
  const later = plan({ startsAt: '2026-10-12T10:00:00Z', endsAt: '2026-10-12T11:00:00Z' });
  assert.equal(latest(proposed({ schedule: later })).proposal.expiresAt, '2026-10-09T10:00:00.000Z');
  assert.throws(() => proposed({ schedule: later, expiresAt: '2026-10-09T10:00:00.001Z' }), /deadline/);
});

test('a proposal and a single acceptance never fabricate the other acceptance', () => {
  let state = proposed();
  assert.equal(latest(state).canRespond, true); assert.equal(latest(state, B).canRespond, true);
  state = respond(state, B);
  assert.equal(latest(state).status, 'pending'); assert.equal(latest(state).people.find(person => person.id === A).response, 'unanswered');
  assert.equal(latest(state, B).canRespond, false); assert.equal(latest(state).canRespond, true);
  assert.throws(() => respond(state, B), /already answered/);
  state = respond(state, A); assert.equal(latest(state).status, 'confirmed');
  assert.equal(latest(state).canRespond, false); assert.equal(latest(state).canComplete, false);
});

test('either participant may propose a change; it preserves old snapshots and requires two fresh acceptances', () => {
  let state = confirmed(); const before = structuredClone(latest(state));
  state = action(state, 'revise', B, { appointmentId: before.id, schedule: plan({ startsAt: '2026-10-08T10:00:00Z', endsAt: '2026-10-08T11:00:00Z', place: '다른 카페' }) });
  const changed = latest(state);
  assert.equal(changed.proposal.version, 2); assert.equal(changed.status, 'pending');
  assert.ok(changed.people.every(person => person.response === 'unanswered'));
  assert.deepEqual(changed.history[0].schedule, before.proposal.schedule);
  assert.ok(changed.history[0].people.every(person => person.response === 'accept'));
  assert.throws(() => respond(state, A, 'accept', { proposalVersion: 1 }), /stale/);
  state = respond(state, A); assert.equal(latest(state).status, 'pending');
  state = respond(state, B); assert.equal(latest(state).status, 'confirmed');
  assert.deepEqual(latest(state).history, changed.history);
});

test('declining a revised version cannot restore the previously confirmed version', () => {
  let state = confirmed(); const id = latest(state).id;
  state = action(state, 'revise', A, { appointmentId: id, schedule: plan({ place: '변경 장소' }) });
  state = respond(state, B, 'decline');
  assert.equal(latest(state).status, 'declined'); assert.equal(latest(state).proposal.version, 2);
  assert.equal(latest(state).canComplete, false); assert.equal(latest(state).canRevise, false);
  assert.throws(() => respond(state, A), /closed/); assert.throws(() => complete(state), /confirmed/);
  assert.equal(view(state).canPropose, false);
  assert.throws(() => proposed({}, state), /reopen/);
  state = action(state, 'reopen', B, { appointmentId: id, proposalVersion: 2 });
  const next = proposed({}, state); assert.notEqual(latest(next).id, id);
  assert.ok(latest(next).people.every(person => person.response === 'unanswered'));
});

test('deadline exactly expires without manufacturing a decline and reading is pure and repeatable', () => {
  const deadline = '2026-10-06T12:00:00.000Z';
  const state = respond(proposed({ expiresAt: deadline }), A), original = JSON.stringify(state);
  assert.equal(latest(state, B, '2026-10-06T11:59:59.999Z').status, 'pending');
  const expired = view(state, B, deadline);
  assert.equal(expired.appointments[0].status, 'expired');
  assert.equal(expired.appointments[0].people.find(person => person.id === B).response, 'unanswered');
  assert.equal(expired.inbox.filter(item => item.kind === 'expired').length, 1);
  assert.deepEqual(view(state, B, deadline), expired); assert.equal(JSON.stringify(state), original);
  assert.throws(() => respond(state, B, 'accept', { at: deadline }), /closed/);
  assert.equal(latest(state, B, deadline).canComplete, false);
});

test('an expiry inbox item can be marked read after its virtual expiry, without duplication', () => {
  let state = proposed({ expiresAt: '2026-10-06T12:00:00Z' });
  const at = '2026-10-06T12:00:00.000Z', note = view(state, B, at).inbox.find(item => item.kind === 'expired');
  state = action(state, 'read', B, { notificationId: note.id, at });
  const inbox = view(state, B, '2026-10-06T13:00:00.000Z').inbox;
  assert.equal(inbox.filter(item => item.kind === 'expired').length, 1);
  assert.equal(inbox.find(item => item.id === note.id).read, true);
});

test('confirmation before expiry remains valid after the response deadline but cannot be revised after its start', () => {
  const state = confirmed(proposed({ expiresAt: '2026-10-06T12:00:00Z' }));
  const at = '2026-10-06T13:00:00.000Z';
  assert.equal(latest(state, A, at).status, 'confirmed');
  assert.equal(view(state, A, at).inbox.some(item => item.kind === 'expired'), false);
  assert.equal(latest(state, A, NEXT).canRevise, false);
  assert.throws(() => action(state, 'revise', B, { appointmentId: latest(state).id, schedule: plan({ startsAt: '2026-10-08T10:00:00Z', endsAt: '2026-10-08T11:00:00Z' }), at: NEXT }), /cannot be revised/);
});

test('cancellation closes pending or confirmed appointments and cannot be reversed by old responses', () => {
  for (const seed of [proposed(), confirmed()]) {
    const old = latest(seed), state = action(seed, 'cancel', B, { appointmentId: old.id });
    assert.equal(latest(state).status, 'cancelled'); assert.equal(latest(state).cancelledBy, B);
    assert.deepEqual(latest(state).people, old.people, 'the sent response history remains true');
    assert.throws(() => respond(state, A), /closed/); assert.throws(() => complete(state), /confirmed/);
    assert.throws(() => action(state, 'revise', A, { appointmentId: old.id, schedule: plan() }), /cannot be revised/);
    assert.equal(view(state).canPropose, true);
  }
});

test('completion requires a finished mutual agreement and records only the actor confirmation', () => {
  assert.throws(() => complete(proposed()), /confirmed/);
  const state = confirmed();
  assert.throws(() => complete(state, A, '2026-10-07T10:59:59.999Z'), /finished/);
  assert.equal(latest(state, A, END).status, 'awaiting-completion');
  let done = complete(state);
  assert.equal(latest(done).status, 'partially-completed'); assert.equal(latest(done).canComplete, false);
  assert.equal(latest(done, B).canComplete, true); assert.equal(latest(done, B).people.find(person => person.id === B).completedAt, null);
  assert.throws(() => complete(done), /own confirmed/);
  assert.throws(() => action(done, 'cancel', B, { appointmentId: latest(done).id }), /cannot be cancelled/);
  done = complete(done, B); assert.equal(latest(done).status, 'completed');
  assert.equal(latest(done).canComplete, false); assert.equal(latest(done, B).canComplete, false);
});

test('own reflection needs only own completion; no private content enters partner cards, history or inbox', () => {
  let state = complete(confirmed()); const id = latest(state).id, other = view(state, B);
  assert.throws(() => action(state, 'reflect', B, { appointmentId: id, value: 'good', note: '미완료' }), /own completion/);
  state = action(state, 'reflect', A, { appointmentId: id, value: 'too-long', note: 'PRIVATE 시간을 줄이고 싶어요' });
  assert.equal(view(state).me.reflections[0].note, 'PRIVATE 시간을 줄이고 싶어요');
  const after = view(state, B);
  assert.equal(JSON.stringify(after).includes('PRIVATE'), false); assert.deepEqual(after.me.reflections, []);
  assert.deepEqual(after.appointments, other.appointments); assert.deepEqual(after.inbox, other.inbox);
  state = action(state, 'reflect', A, { appointmentId: id, value: 'good', note: '직접 정정한 내 감상' });
  assert.equal(view(state).me.reflections.length, 1); assert.equal(view(state).me.reflections[0].value, 'good');
  assert.equal(JSON.stringify(view(state, B)).includes('직접 정정'), false);
});

test('an ended appointment never waits on the other completion before a new proposal or late own reflection', () => {
  let state = complete(confirmed()); const priorId = latest(state).id;
  assert.equal(view(state).canPropose, true);
  state = proposed({ schedule: plan({ startsAt: '2026-10-08T10:00:00Z', endsAt: '2026-10-08T11:00:00Z' }) }, state);
  const newProposal = structuredClone(latest(state));
  state = action(state, 'reflect', A, { appointmentId: priorId, value: 'good', note: '지난 약속 회고' });
  assert.deepEqual(latest(state), newProposal); assert.equal(view(state).appointments[0].status, 'partially-completed');
  state = action(state, 'complete', B, { appointmentId: priorId });
  assert.equal(view(state).appointments[0].status, 'completed'); assert.deepEqual(latest(state), newProposal);
});

test('inbox read state belongs to its recipient and is never a public read receipt', () => {
  let state = proposed(); const item = view(state, B).inbox[0], a = view(state);
  assert.equal(item.kind, 'proposed'); assert.equal(item.read, false); assert.equal(view(state, B).unreadCount, 1);
  assert.throws(() => action(state, 'read', A, { notificationId: item.id }), /own inbox/);
  state = action(state, 'read', B, { notificationId: item.id });
  assert.equal(view(state, B).unreadCount, 0); assert.equal(view(state, B).inbox[0].read, true);
  assert.deepEqual(view(state).inbox, a.inbox); assert.deepEqual(view(state).appointments, a.appointments);
  assert.equal(JSON.stringify(view(state)).includes(item.id), false);
});

test('notification preferences are personal, retain inbox content and do not replay suppressed alerts', () => {
  let state = action(fresh(), 'notifications', B, { enabled: false });
  state = proposed({}, state); const id = view(state, B).inbox[0].id;
  assert.equal(view(state, B).me.notificationsEnabled, false); assert.equal(view(state).me.notificationsEnabled, true);
  assert.equal(view(state, B).inbox[0].notify, false); assert.equal(view(state, B).unreadCount, 1);
  state = action(state, 'notifications', B, { enabled: true });
  assert.equal(view(state, B).inbox.find(item => item.id === id).notify, false);
  state = respond(state, A);
  assert.equal(view(state, B).inbox[0].kind, 'accepted'); assert.equal(view(state, B).inbox[0].notify, true);
  assert.equal(view(state, B).inbox.length, 2);
});

test('CAS rejects a competing write; one upcoming appointment per pair prevents duplicate proposals', () => {
  const base = fresh(), state = proposed(), competing = { kind: 'propose', actor: B, requestId: 'other', expectedRevision: base.revision, at: START, schedule: plan() };
  assert.throws(() => api.record(state, competing), /revision conflict/);
  assert.throws(() => api.record(state, { ...competing, expectedRevision: state.revision }), /already open/);
  const answered = respond(state, A);
  assert.throws(() => api.record(answered, { kind: 'respond', actor: B, requestId: 'concurrent', expectedRevision: state.revision, at: START, appointmentId: latest(state).id, proposalVersion: 1, value: 'accept' }), /revision conflict/);
});

test('exact retries preserve schedule, deadline, revision and inbox after unrelated writes or time passing', () => {
  const input = { kind: 'propose', actor: A, requestId: 'same-id', expectedRevision: 0, at: START, schedule: plan() };
  let state = api.record(fresh(), input); const id = latest(state).id;
  state = respond(state, B); const before = JSON.stringify(state);
  const retried = api.record(state, { ...input, at: '2026-10-12T10:00:00Z', schedule: { ...plan(), startsAt: '2026-10-07T19:00:00+09:00', endsAt: '2026-10-07T20:00:00+09:00' } });
  assert.equal(JSON.stringify(retried), before); assert.equal(latest(retried).id, id);
  assert.throws(() => api.record(state, { ...input, schedule: plan({ place: '다른 내용' }) }), /reused/);
  assert.throws(() => api.record(state, { ...input, expectedRevision: state.revision }), /reused/);
});

test('the same request identifier is independently scoped to each authenticated actor', () => {
  let state = action(fresh(), 'notifications', A, { enabled: false, requestId: 'shared-request' });
  state = action(state, 'notifications', B, { enabled: false, requestId: 'shared-request' });
  assert.equal(state.revision, 2); assert.equal(view(state).me.notificationsEnabled, false); assert.equal(view(state, B).me.notificationsEnabled, false);
});

test('foreign actors, extra action fields, cross-pair logs and tampered revisions fail closed', () => {
  const state = proposed();
  assert.throws(() => action(state, 'cancel', 'foreign', { appointmentId: latest(state).id }), /unknown actor/);
  assert.throws(() => action(state, 'cancel', A, { appointmentId: latest(state).id, response: 'accept' }), /envelope/);
  for (const mutate of [bad => { bad.pairId = 'pair:2'; }, bad => { bad.people[1].id = 'other'; }, bad => { bad.events[0].expectedRevision = 1; }, bad => { bad.revision = 3; }, bad => { bad.events[0].actor = 'foreign'; }]) {
    const bad = structuredClone(state); mutate(bad); assert.throws(() => view(bad), /Appointments:/);
  }
  const duplicate = structuredClone(respond(state, A)); duplicate.events[1].requestId = duplicate.events[0].requestId;
  assert.throws(() => view(duplicate), /duplicate stored request/);
});

test('stored events use canonical nondecreasing time; projections cannot hide future events', () => {
  const state = respond(proposed(), A), bad = structuredClone(state);
  bad.events[0].at = '2026-10-06T19:00:00+09:00'; assert.throws(() => view(bad), /stale|noncanonical/);
  assert.throws(() => action(state, 'notifications', B, { enabled: false, at: '2026-10-06T09:59:59.999Z' }), /invalid|stale/);
  assert.throws(() => view(state, A, '2026-10-06T09:59:59.999Z'), /invalid/);
  const advanced = action(state, 'notifications', B, { enabled: false, at: '2026-10-06T10:01:00Z' });
  assert.throws(() => view(advanced, A, START), /stale/);
  assert.deepEqual(view(JSON.parse(JSON.stringify(advanced))), view(advanced));
});

test('injected clock is used only when the host does not provide a time', () => {
  let now = START; const local = createAppointmentsAdapter({ clock: () => new Date(now) });
  let state = local.create({ pairId: 'pair:clock', people });
  state = local.record(state, { kind: 'propose', actor: A, requestId: 'clock', expectedRevision: 0, schedule: plan() });
  now = NEXT; assert.equal(local.inspect(state, { viewer: B }).appointments[0].status, 'expired');
  assert.equal(state.events[0].at, START);
});

test('only the person who declined can reopen the exact closed invitation; no old acceptance returns', () => {
  let state = respond(proposed(), B, 'decline'); const oldId = latest(state).id;
  assert.deepEqual(view(state, B).me.receiving, { state: 'declined', appointmentId: oldId, proposalVersion: 1, canReopen: true });
  assert.equal(view(state).me.receiving.canReopen, false);
  assert.equal(view(state).proposalAvailability.reason, 'partner-unavailable');
  assert.equal(view(state, B).proposalAvailability.reason, 'reopen-required');
  assert.throws(() => proposed({}, state), /reopen/);
  assert.throws(() => action(state, 'reopen', A, { appointmentId: oldId, proposalVersion: 1 }), /your current/);
  assert.throws(() => action(state, 'reopen', B, { appointmentId: oldId, proposalVersion: 2 }), /your current/);
  const before = structuredClone(latest(state));
  state = action(state, 'reopen', B, { appointmentId: oldId, proposalVersion: 1 });
  assert.deepEqual(latest(state), before); assert.equal(view(state).canPropose, true);
  state = respond(proposed({}, state), B, 'decline');
  assert.throws(() => action(state, 'reopen', B, { appointmentId: oldId, proposalVersion: 1 }), /your current/);
});

test('busy is a scheduling answer and allows another proposal without inventing relationship rejection', () => {
  const state = respond(proposed(), B, 'busy');
  assert.equal(latest(state).status, 'busy'); assert.equal(latest(state).people[1].response, 'busy');
  assert.equal(view(state).canPropose, true); assert.equal(view(state, B).me.receiving.state, 'open');
  assert.equal(view(state).inbox[0].kind, 'busy');
  const next = proposed({}, state); assert.equal(latest(next).status, 'pending');
  assert.ok(latest(next).people.every(person => person.response === 'unanswered'));
});

test('a silent recipient must reopen an expired invitation, while their explicit acceptance is not silence', () => {
  const deadline = '2026-10-06T12:00:00.000Z';
  let state = respond(proposed({ expiresAt: deadline }), A);
  const id = latest(state).id;
  assert.equal(view(state, B, deadline).me.receiving.state, 'expired');
  assert.equal(view(state, A, deadline).canPropose, false);
  assert.equal(latest(state, B, deadline).people[1].response, 'unanswered');
  assert.throws(() => proposed({ at: deadline }, state), /reopen/);
  state = action(state, 'reopen', B, { appointmentId: id, proposalVersion: 1, at: deadline });
  assert.equal(view(state).canPropose, true);
  const acceptedRecipient = respond(proposed({ expiresAt: deadline }), B);
  assert.equal(view(acceptedRecipient, A, deadline).canPropose, true, 'the sender failing to confirm does not close the recipient consent');
});

test('cancel-and-resend cannot bypass the unanswered recipient gate', () => {
  let state = proposed(); const id = latest(state).id;
  state = action(state, 'cancel', A, { appointmentId: id });
  assert.equal(view(state, B).me.receiving.state, 'cancelled');
  assert.throws(() => proposed({}, state), /reopen/);
  state = action(state, 'reopen', B, { appointmentId: id, proposalVersion: 1 });
  assert.equal(view(state).canPropose, true);
  const mutual = confirmed(), cancelled = action(mutual, 'cancel', A, { appointmentId: latest(mutual).id });
  assert.equal(view(cancelled).canPropose, true, 'cancelling an agreed schedule is not a relationship rejection');
});

test('legacy follow-ups remain readable but newly appended actions enforce the receiving boundary', () => {
  const legacy = structuredClone(respond(proposed(), B, 'decline'));
  for (const event of legacy.events) delete event.policyVersion;
  assert.equal(latest(legacy).status, 'declined'); assert.throws(() => proposed({}, legacy), /reopen/);
  assert.equal(latest(legacy).proposal.declineMeaning, 'legacy-schedule');
  assert.equal(view(legacy, B).me.receiving.state, 'legacy-declined');
  assert.equal(view(legacy).inbox[0].kind, 'legacy-declined');
  assert.ok(!view(legacy).inbox[0].text.includes('만남을 원하지'));
  // Authored historical event: the old implementation allowed this without reopen.
  const prior = legacy.events[0];
  legacy.events.push({ ...prior, id: 'appointment-event-3', expectedRevision: 2, requestId: 'legacy-follow-up' }); legacy.revision++;
  assert.equal(view(legacy).appointments.length, 2); assert.equal(latest(legacy).status, 'pending');
  const modern = respond(legacy, B); assert.equal(modern.events.at(-1).policyVersion, 2);
  const bad = structuredClone(respond(modern, A)); delete bad.events.at(-1).policyVersion;
  assert.throws(() => view(bad), /policy version/);
});

test('too-long creates only an actor-private source-bound suggestion and never changes the existing schedule', () => {
  let state = complete(confirmed()); const original = structuredClone(latest(state)), id = original.id;
  state = action(state, 'reflect', A, { appointmentId: id, value: 'too-long', note: 'PRIVATE-REASON' });
  const mine = view(state).me, suggestion = mine.suggestions[0];
  assert.equal(suggestion.kind, 'shorter-duration'); assert.equal(suggestion.originalMinutes, 60); assert.equal(suggestion.minutes, 40);
  assert.deepEqual(suggestion.source, { appointmentId: id, proposalVersion: 1, reflectionEventId: state.events.at(-1).id });
  assert.equal(suggestion.revision, state.revision); assert.equal(suggestion.canApply, true); assert.equal(mine.nextForm, null);
  assert.deepEqual(latest(state), original); assert.deepEqual(view(state, B).me.suggestions, []);
  assert.ok(!JSON.stringify(view(state, B)).includes('PRIVATE-REASON')); assert.ok(!JSON.stringify(view(state, B)).includes(suggestion.id));
  assert.throws(() => action(state, 'apply-suggestion', B, { suggestionId: suggestion.id, suggestionRevision: suggestion.revision }), /foreign/);
  assert.throws(() => action(state, 'apply-suggestion', A, { suggestionId: suggestion.id, suggestionRevision: suggestion.revision + 1 }), /stale/);
});

const reflected = (minutes = 60, value = 'too-long') => {
  const end = new Date(Date.parse(NEXT) + minutes * 60000).toISOString();
  let state = complete(confirmed(proposed({ schedule: plan({ endsAt: end }) })), A, end);
  return action(state, 'reflect', A, { appointmentId: latest(state).id, value, note: '나만 보는 감상' });
};
const suggestAction = (state, kind, suggestion = view(state).me.suggestions[0], actor = A) => action(state, kind, actor, { suggestionId: suggestion.id, suggestionRevision: suggestion.revision });

test('duration rule rounds two thirds down to five minutes with a floor of fifteen and no needless short suggestion', () => {
  for (const [before, expected] of [[90, 60], [60, 40], [45, 30], [20, 15], [16, 15]])
    assert.equal(view(reflected(before)).me.suggestions[0].minutes, expected);
  for (const before of [15, 10]) assert.deepEqual(view(reflected(before)).me.suggestions, []);
});

test('explicit apply changes only the next own form; undo and dismiss never notify the partner', () => {
  let state = reflected(); const other = view(state, B), scheduleBefore = structuredClone(latest(state)), suggestion = view(state).me.suggestions[0];
  state = suggestAction(state, 'apply-suggestion');
  assert.deepEqual(view(state).me.nextForm, { durationMinutes: 40, suggestionId: suggestion.id, suggestionRevision: suggestion.revision });
  assert.equal(view(state).me.suggestions[0].canUndo, true); assert.equal(view(state, B).me.nextForm, null);
  assert.deepEqual(latest(state), scheduleBefore); assert.deepEqual(view(state, B).inbox, other.inbox);
  state = suggestAction(state, 'undo-suggestion'); assert.equal(view(state).me.nextForm, null);
  assert.equal(view(state).me.suggestions[0].status, 'undone');
  const dismissed = suggestAction(reflected(), 'dismiss-suggestion');
  assert.equal(view(dismissed).me.suggestions[0].status, 'dismissed'); assert.equal(view(dismissed).me.nextForm, null);
  assert.throws(() => suggestAction(dismissed, 'apply-suggestion'), /cannot be applied/);
});

test('correcting the source reflection invalidates an applied suggestion and stale apply/undo cannot restore it', () => {
  let state = suggestAction(reflected(), 'apply-suggestion'); const prior = view(state).me.suggestions[0];
  state = action(state, 'reflect', A, { appointmentId: latest(state).id, value: 'good', note: '직접 정정' });
  assert.equal(view(state).me.nextForm, null); assert.deepEqual(view(state).me.suggestions, []);
  for (const kind of ['apply-suggestion', 'dismiss-suggestion', 'undo-suggestion']) assert.throws(() => suggestAction(state, kind, prior), /stale/);
});

test('an applied hint is consumed once after explicit sending and neither duration nor private reasons are auto-inserted', () => {
  let state = suggestAction(reflected(), 'apply-suggestion'); const suggestion = view(state).me.suggestions[0];
  const chosen = plan({ startsAt: '2026-10-08T10:00:00Z', endsAt: '2026-10-08T10:30:00Z', note: '직접 작성한 안내' });
  state = proposed({ schedule: chosen }, state);
  assert.equal(view(state).me.nextForm, null); assert.equal(view(state).me.suggestions[0].status, 'consumed');
  assert.equal(latest(state).proposal.schedule.endsAt, '2026-10-08T10:30:00.000Z');
  assert.equal(latest(state, B).proposal.schedule.note, '직접 작성한 안내');
  assert.ok(!JSON.stringify(view(state, B)).includes('나만 보는 감상')); assert.ok(!JSON.stringify(view(state, B)).includes(suggestion.id));
  assert.throws(() => suggestAction(state, 'undo-suggestion', suggestion), /stale/);
});

test('change-activity is only private guidance until the person chooses a place themselves', () => {
  let state = reflected(60, 'change-activity'); const suggestion = view(state).me.suggestions[0];
  assert.equal(suggestion.kind, 'change-activity'); assert.equal(suggestion.minutes, null); assert.equal(suggestion.canApply, false);
  assert.equal(view(state).me.nextForm, null); assert.throws(() => suggestAction(state, 'apply-suggestion'), /cannot be applied/);
  state = suggestAction(state, 'dismiss-suggestion'); assert.equal(view(state).me.suggestions[0].status, 'dismissed');
});

test('proposal changes compare the immediately preceding public schedule, never reflection or prior acceptance', () => {
  let state = confirmed(); const first = structuredClone(latest(state)); assert.deepEqual(first.proposal.changes, []);
  state = action(state, 'revise', B, { appointmentId: first.id, schedule: plan({ startsAt: '2026-10-08T10:00:00Z', endsAt: '2026-10-08T11:30:00Z', place: '새 장소', note: '새 안내', timeZone: 'Europe/London' }) });
  assert.deepEqual(latest(state).proposal.changes.map(x => x.field), ['startsAt', 'endsAt', 'timeZone', 'place', 'note']);
  for (const change of latest(state).proposal.changes) assert.equal(change.before, first.proposal.schedule[change.field]);
  state = action(state, 'revise', A, { appointmentId: first.id, schedule: { ...latest(state).proposal.schedule, place: '마지막 장소' } });
  assert.deepEqual(latest(state).proposal.changes, [{ field: 'place', before: '새 장소', after: '마지막 장소' }]);
  assert.ok(latest(state).people.every(person => person.response === 'unanswered'));
});

test('resending an unchanged schedule cannot clear acceptances or renew a response deadline', () => {
  const state = confirmed(), before = JSON.stringify(state);
  assert.throws(() => action(state, 'revise', A, { appointmentId: latest(state).id, schedule: latest(state).proposal.schedule }), /changed schedule/);
  assert.equal(JSON.stringify(state), before); assert.equal(latest(state).status, 'confirmed');
});

test('undo cancels only this application: the same source can be applied again or explicitly dismissed', () => {
  let state = reflected(); const suggestion = view(state).me.suggestions[0], other = view(state, B);
  assert.equal(suggestion.text, '지난 60분이 길게 느껴졌다면, 다음 약속은 40분으로 준비해 볼까요? 적용해도 아직 상대에게 보내지 않아요.');
  state = suggestAction(state, 'apply-suggestion');
  state = suggestAction(state, 'undo-suggestion');
  assert.equal(view(state).me.nextForm, null);
  assert.equal(view(state).me.suggestions[0].canApply, true); assert.equal(view(state).me.suggestions[0].canDismiss, true);
  state = suggestAction(state, 'apply-suggestion');
  assert.equal(view(state).me.nextForm.durationMinutes, 40);
  assert.equal(view(state).me.nextForm.suggestionId, suggestion.id);
  state = suggestAction(state, 'undo-suggestion');
  state = suggestAction(state, 'dismiss-suggestion');
  assert.equal(view(state).me.suggestions[0].status, 'dismissed');
  assert.equal(view(state).me.suggestions[0].canApply, false); assert.equal(view(state).me.suggestions[0].canDismiss, false);
  assert.throws(() => suggestAction(state, 'apply-suggestion'), /cannot be applied/);
  assert.deepEqual(view(state, B).me.suggestions, []); assert.deepEqual(view(state, B).inbox, other.inbox);
});
