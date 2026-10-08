import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import { createMeetingAdapter, MEETING_FIELDS, MEETING_PLANS, MEETING_SCENARIOS } from '../experiences/atlas-lab/meeting.mjs';
const api = createMeetingAdapter({ Domain, Ask, Personalization });
const view = (state, viewer = 'person-a') => api.inspect(state, { viewer });
const action = (state, kind, person, extras = {}) => api.record(state, { kind, ...(person ? { person } : {}), ...extras });
const set = (state, person, field, value, extras = {}) => action(state, 'set', person, { field, value, duration: 'ongoing', share: true, required: false, ...extras });
const respond = (state, person, value) => action(state, 'respond', person, { value });
const propose = (state = api.create('ready'), person = 'person-a') => action(state, 'propose', person);
const seen = state => action(action(state, 'view', 'person-a'), 'view', 'person-b');
const accepted = state => respond(respond(seen(state), 'person-a', 'accept'), 'person-b', 'accept');
const met = state => action(action(accepted(state), 'met', 'person-a'), 'met', 'person-b');
const feedback = (state, person = 'person-a', value = 'too-long') => action(state, 'feedback', person, { value });
const apply = (state, duration = 'once', person = 'person-a') => action(state, 'apply', person, { proposalId: view(state, person).me.pendingProposals[0].id, duration });
const next = state => action(state, 'next');
const reconnect = (state, person, extra) => action(state, 'reconnect', person, { action: extra });

test('private intent and a sent invitation do not rewrite concrete acceptances or the other private view', () => {
  let state = action(accepted(propose()), 'met', 'person-a');
  const before = view(state), otherBefore = view(state, 'person-b');
  state = reconnect(state, 'person-a', { kind: 'intent', encounterId: 'meeting-1', value: 'yes' });
  assert.equal(view(state).reconnect.me.intent.value, 'yes'); assert.equal(view(state).reconnect.invitation, null);
  assert.equal(view(state, 'person-b').reconnect.me.intent, null);
  assert.deepEqual(view(state).proposal, before.proposal); assert.deepEqual(view(state, 'person-b').me, otherBefore.me);
  state = reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다음 만남을 준비할까요?' });
  const sent = view(state).reconnect.invitation;
  state = reconnect(state, 'person-a', { kind: 'intent', encounterId: 'meeting-1', value: null });
  assert.deepEqual(view(state).reconnect.invitation, sent);
  state = reconnect(state, 'person-b', { kind: 'respond', invitationId: sent.id, value: 'accept' });
  assert.deepEqual(view(state).proposal, before.proposal, 'invitation acceptance cannot modify appointment consent or past attendance');
  assert.equal(view(state).encounter.completed, false); assert.equal(view(state).canNext, true);
  state = next(state);
  assert.equal(view(state).encounter.id, 'meeting-2'); assert.equal(view(state).proposal, null);
  assert.equal(view(state).reconnect.canPrepare, false); assert.equal(view(state).canNext, false);
  assert.throws(() => next(state), /not automatically ended/);
});

test('nested reconnect actors, attendance and cross-pair event transplantation are rejected', () => {
  const state = met(propose());
  assert.throws(() => reconnect(state, 'person-a', { kind: 'intent', person: 'person-b', encounterId: 'meeting-1', value: 'yes' }), /nested reconnect actor/);
  assert.throws(() => reconnect(state, 'person-a', { kind: 'met', encounterId: 'meeting-2' }), /nested reconnect actor/);
  assert.throws(() => reconnect(state, 'person-a', { kind: 'prepare', invitationId: 'fake' }), /nested reconnect actor/);
});

test('blocking redacts the whole partner projection while own reflection remains possible', () => {
  let state = action(accepted(propose()), 'met', 'person-a');
  state = reconnect(state, 'person-b', { kind: 'block' });
  const blocked = view(state);
  assert.equal(blocked.access.allowed, false); assert.equal(blocked.partner.label, '상대');
  assert.deepEqual(blocked.partner.sharedFields, []); assert.equal(blocked.proposal, null);
  assert.equal(blocked.recommendation.plan, null); assert.deepEqual(blocked.recommendation.facts, []);
  assert.equal(blocked.me.nextPreview.recommendation.plan, null); assert.equal(blocked.reconnect.me.blocking, false);
  assert.throws(() => action(state, 'met', 'person-b'), /access unavailable/);
  state = feedback(state); assert.equal(view(state).me.feedback.length, 1);
});

test('pause prevents new plans but preserves an already agreed concrete plan', () => {
  let state = accepted(propose()); const original = view(state).proposal;
  state = reconnect(state, 'person-b', { kind: 'pause' });
  assert.deepEqual(view(state).proposal, { ...original, canEdit: false }); assert.equal(view(state).canPropose, false);
  assert.throws(() => propose(state), /paused/);
  state = action(state, 'met', 'person-a'); assert.equal(view(state).encounter.selfCompleted, true);
  state = reconnect(state, 'person-b', { kind: 'resume' }); assert.equal(view(state).access.allowed, true);
});

test('pause cannot be bypassed by editing an existing plan or starting the next encounter', () => {
  let state = reconnect(accepted(propose()), 'person-b', { kind: 'pause' });
  assert.equal(view(state).proposal.canEdit, false);
  assert.throws(() => action(state, 'edit', 'person-a', { planId: 'weekend.cafe.quiet.40' }), /paused/);
  state = action(action(state, 'met', 'person-a'), 'met', 'person-b');
  assert.equal(view(state).canNext, false); assert.throws(() => next(state), /paused/);
  state = reconnect(state, 'person-b', { kind: 'resume' });
  assert.equal(view(state).canNext, true); assert.equal(view(next(state)).encounter.id, 'meeting-2');
});

test('future consent withdrawal closes invitations without rewriting a partly confirmed past meeting', () => {
  for (const withdraw of [false, true]) {
    let state = action(accepted(propose()), 'met', 'person-a');
    state = reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다음 만남을 준비할까요?' });
    const sent = view(state).reconnect.invitation, prior = view(state).proposal;
    state = withdraw ? action(state, 'withdraw-setting', 'person-b', { field: 'consent', duration: 'ongoing' }) : set(state, 'person-b', 'consent', false);
    assert.equal(view(state).reconnect.invitation.status, 'closed');
    assert.equal(view(state).reconnect.invitation.message, sent.message);
    assert.equal(view(state).reconnect.canSend, false); assert.equal(view(state, 'person-b').reconnect.canRespond, false);
    assert.deepEqual(view(state).proposal, prior, 'future consent does not rewrite the meeting already recorded');
    assert.throws(() => reconnect(state, 'person-b', { kind: 'respond', invitationId: sent.id, value: 'accept' }), /unavailable|no longer available/);
    assert.throws(() => reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '재전송' }), /consent/);
    state = action(state, 'met', 'person-b');
    state = set(state, 'person-b', 'consent', true);
    assert.equal(view(state).reconnect.invitation.status, 'closed', 'restored consent does not revive the old invitation');
    assert.equal(view(state).reconnect.canSend, true);
  }
});

test('moving to a new encounter closes its predecessor pending invitation and rejects delayed acceptance', () => {
  let state = met(propose());
  state = reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다음 만남을 준비할까요?' });
  const invitation = view(state).reconnect.invitation;
  state = accepted(propose(next(state))); const current = view(state).proposal;
  assert.equal(view(state).reconnect.invitation.status, 'closed');
  assert.throws(() => reconnect(state, 'person-b', { kind: 'respond', invitationId: invitation.id, value: 'accept' }), /no longer available/);
  assert.equal(view(state).canNext, false); assert.deepEqual(view(state).proposal, current);
});

test('an accepted invitation is consumed once and cannot remain active after its prepared attempt ends', () => {
  let state = met(propose());
  state = reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다음 만남을 준비할까요?' });
  const id = view(state).reconnect.invitation.id;
  state = reconnect(state, 'person-b', { kind: 'respond', invitationId: id, value: 'accept' });
  state = respond(seen(propose(next(state))), 'person-b', 'decline');
  state = next(state);
  assert.equal(view(state).reconnect.invitation.status, 'closed'); assert.equal(view(state).reconnect.canPrepare, false);
  assert.equal(view(state).reconnect.canSend, true); assert.equal(view(state).canNext, false);
  assert.throws(() => reconnect(state, 'person-b', { kind: 'respond', invitationId: id, value: 'accept' }), /no longer available/);
});

test('an invitation about a previous reflection cannot skip an existing newer concrete agreement', () => {
  let state = accepted(propose(next(met(propose()))));
  const prior = view(state).proposal;
  state = reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '함께 만남을 준비할까요?' });
  state = reconnect(state, 'person-b', { kind: 'respond', invitationId: view(state).reconnect.invitation.id, value: 'accept' });
  assert.equal(view(state).canNext, false); assert.equal(view(state).reconnect.canPrepare, false);
  assert.throws(() => next(state), /not automatically ended/);
  assert.deepEqual(view(state).proposal, prior);
  state = action(state, 'met', 'person-a');
  assert.equal(view(state).reconnect.invitation.status, 'completed');
  assert.throws(() => reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '옛 만남으로 전송' }), /invalid explicit invitation/);
});

test('internal invitation cleanup preserves IDs referenced by previously saved valid journeys', () => {
  for (const invited of [false, true]) {
    let state = met(propose());
    if (invited) {
      state = reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-1', to: 'person-b', message: '다음 만남을 준비할까요?' });
      state = reconnect(state, 'person-b', { kind: 'respond', invitationId: 'reconnect-3', value: 'accept' });
    }
    state = met(propose(next(state)));
    state = reconnect(state, 'person-a', { kind: 'send', encounterId: 'meeting-2', to: 'person-b', message: '한 번 더 만날까요?' });
    // These are the public IDs written by the original reducer before internal
    // cleanup events existed; saved response references must keep resolving.
    const legacyId = invited ? 'reconnect-8' : 'reconnect-5';
    assert.equal(view(state).reconnect.invitation.id, legacyId);
    state = reconnect(state, 'person-b', { kind: 'respond', invitationId: legacyId, value: 'accept' });
    assert.equal(view(JSON.parse(JSON.stringify(state))).reconnect.invitation.response, 'accept');
  }
});

test('unblocking never revives old concrete acceptance or erases prior attendance', () => {
  for (const partial of [false, true]) {
    let state = accepted(propose());
    if (partial) state = action(state, 'met', 'person-a');
    const prior = view(state).proposal;
    state = reconnect(state, 'person-b', { kind: 'block' });
    state = reconnect(state, 'person-b', { kind: 'unblock' });
    assert.equal(view(state).proposal.valid, false); assert.equal(view(state).proposal.canMeet, false);
    assert.deepEqual(view(state).proposal.people, prior.people, 'sent response and attendance history is retained');
    assert.throws(() => action(state, 'met', 'person-b'), /changed or was withdrawn/);
    if (partial) { state = feedback(state); assert.equal(view(state).me.feedback.length, 1); }
    state = next(state); assert.equal(view(state).encounter.id, 'meeting-2'); assert.equal(view(state).proposal, null);
  }
  const completed = met(propose());
  const reopened = reconnect(reconnect(completed, 'person-a', { kind: 'block' }), 'person-a', { kind: 'unblock' });
  assert.deepEqual(view(reopened).proposal, view(completed).proposal, 'completed meeting history does not change');
});

test('finite fictional catalog and initial unknowns do not invent A preferences or consent', () => {
  assert.equal(MEETING_PLANS.length, 16); assert.equal(MEETING_SCENARIOS.length, 3); assert.equal(MEETING_FIELDS.length, 5);
  const state = api.create(), snapshot = view(state);
  assert.ok(snapshot.me.fields.every(f => f.state === 'unknown' && f.value === null));
  assert.equal(snapshot.recommendation.status, 'needs-confirmation'); assert.equal(snapshot.canPropose, false);
  assert.ok(['consent', 'availability'].includes(snapshot.nextQuestion.field));
  assert.equal(snapshot.nextQuestion.person, 'person-a'); assert.throws(() => propose(state), /visible required/);
  assert.equal(snapshot.partner.sharedFields.length, 5);
});

test('wanted experience chooses a concrete plan through Core, Ask and scoped preferences', () => {
  const calls = { domain: 0, ask: 0, project: 0, record: 0 };
  const adapter = createMeetingAdapter({ Domain: { ...Domain, decide: (...args) => { calls.domain++; return Domain.decide(...args); } },
    Ask: { ...Ask, choose: (...args) => { calls.ask++; return Ask.choose(...args); } },
    Personalization: { preferences: { project: (...args) => { calls.project++; return Personalization.preferences.project(...args); }, record: (...args) => { calls.record++; return Personalization.preferences.record(...args); } } } });
  const state = adapter.create('ready'), snapshot = adapter.inspect(state);
  assert.equal(snapshot.recommendation.plan.id, 'weekend.cafe.quiet.90');
  assert.equal(snapshot.recommendation.plan.minutes, 90); assert.equal(snapshot.recommendation.plan.steps.length, 3);
  assert.ok(Object.values(calls).every(n => n > 0));
  assert.ok(snapshot.recommendation.facts.every(f => f.status === 'fit'));
});

test('both availability and consent are hard requirements, with explicit any distinct from unknown', () => {
  const boundary = api.create('boundary'); assert.equal(view(boundary).recommendation.status, 'blocked');
  assert.throws(() => propose(boundary), /visible required/);
  const flexible = set(boundary, 'person-a', 'availability', 'any'); assert.equal(view(flexible).canPropose, true);
  const declined = set(flexible, 'person-b', 'consent', false, { share: false, required: false });
  assert.equal(view(declined).canPropose, false); assert.equal(view(declined, 'person-b').me.fields.find(f => f.id === 'consent').required, true);
  assert.throws(() => propose(declined), /visible required/);
});

test('soft differences are visible and optional must-have conditions are never silently removed', () => {
  let state = set(api.create('ready'), 'person-b', 'activity', 'walk');
  assert.equal(view(state).recommendation.plan.activity, 'cafe');
  assert.equal(view(state).recommendation.facts.find(f => f.person === 'person-b' && f.field === 'activity').status, 'difference');
  state = set(state, 'person-a', 'activity', 'cafe', { required: true });
  state = set(state, 'person-b', 'activity', 'walk', { required: true });
  assert.equal(view(state).recommendation.status, 'blocked'); assert.throws(() => propose(state), /visible required/);
});

test('editing a concrete plan invalidates both old views and acceptances, and raw stale bindings fail replay', () => {
  let state = accepted(propose()); const old = view(state).proposal;
  state = action(state, 'edit', 'person-a', { planId: 'weekend.cafe.quiet.40' });
  const edited = view(state).proposal; assert.ok(edited.revision > old.revision); assert.notEqual(edited.id, old.id);
  assert.ok(edited.people.every(p => !p.seen && p.response === 'unanswered'));
  assert.throws(() => respond(state, 'person-b', 'accept'), /after viewing/);
  assert.throws(() => action(state, 'met', 'person-a'), /mutual acceptance/);
  const raw = structuredClone(action(state, 'view', 'person-a')); raw.events.at(-1).binding = `${old.id}:${old.revision}`;
  assert.throws(() => view(raw), /old proposal/);
});

test('busy is not dislike, and busy/decline/withdraw allow a new encounter without a false meeting', () => {
  for (const value of ['busy', 'decline', 'withdraw']) {
    let state = seen(propose()); if (value === 'withdraw') state = respond(state, 'person-a', 'accept');
    state = respond(state, 'person-a', value);
    assert.equal(view(state).proposal.people[0].response, value); assert.equal(view(state).canNext, true);
    assert.throws(() => feedback(state), /your own meeting confirmation/);
    state = next(state); assert.equal(view(state).encounter.id, 'meeting-2'); assert.equal(view(state).proposal, null);
    assert.deepEqual(view(state).me.feedback, []); assert.equal(view(state).recommendation.plan.duration, '90');
  }
  assert.match(view(respond(seen(propose()), 'person-a', 'busy')).proposal.label, /싫어한다는 뜻으로 바꾸지/);
});

test('unanswered is not a negative outcome and cannot auto-complete an encounter', () => {
  const state = seen(propose()); assert.equal(view(state).proposal.people[1].response, 'unanswered');
  assert.equal(view(state).canNext, false); assert.throws(() => next(state), /not automatically ended/);
  assert.throws(() => feedback(state), /your own meeting confirmation/);
});

test('own feedback opens after own attendance without waiting for the other confirmation', () => {
  let state = accepted(propose()); assert.throws(() => feedback(state), /your own meeting confirmation/);
  state = action(state, 'met', 'person-a');
  assert.equal(view(state).encounter.selfCompleted, true); assert.equal(view(state).encounter.completed, false);
  assert.throws(() => feedback(state, 'person-b'), /your own meeting confirmation/);
  const other = view(state, 'person-b'); state = feedback(state);
  assert.equal(view(state).me.feedback.length, 1); assert.deepEqual(view(state, 'person-b'), other);
  assert.throws(() => respond(state, 'person-b', 'busy'), /already recorded/);
  state = action(state, 'met', 'person-b'); assert.equal(view(state).encounter.completed, true);
  assert.throws(() => feedback(state), /already recorded/); assert.throws(() => action(state, 'edit', 'person-a', { planId: 'weekend.walk.quiet.40' }), /already happened/);
});

test('advancing preserves the latest own reflection and private intent without changing past acceptance', () => {
  let state = met(propose());
  state = reconnect(state, 'person-a', { kind: 'intent', encounterId: 'meeting-1', value: 'unsure' });
  const priorEvents = structuredClone(state.events); state = next(state);
  assert.equal(view(state).encounter.selfCompleted, false);
  assert.deepEqual(view(state).me.reflection, { encounterId: 'meeting-1', canReflect: true, answered: false });
  assert.equal(view(state).reconnect.me.encounterId, 'meeting-1');
  assert.equal(view(state).reconnect.me.intent.value, 'unsure');
  const other = view(state, 'person-b');
  state = action(state, 'feedback', 'person-a', { encounterId: 'meeting-1', value: 'too-long' });
  assert.equal(view(state).me.reflection.answered, true);
  assert.equal(view(state).me.feedback[0].encounterId, 'meeting-1');
  assert.equal(view(state).me.pendingProposals[0].targetEncounterId, 'meeting-2');
  assert.deepEqual(state.events.slice(0, priorEvents.length), priorEvents);
  assert.deepEqual(view(state, 'person-b'), other, 'late private feedback stays private');
  assert.throws(() => action(state, 'feedback', 'person-a', { encounterId: 'meeting-1', value: 'felt-good' }), /already recorded/);
  assert.throws(() => action(state, 'feedback', 'person-a', { encounterId: 'meeting-2', value: 'felt-good' }), /old proposal/);
});

test('late reflection proposes only a future change once the new meeting has started', () => {
  let state = next(met(propose()));
  state = action(accepted(propose(state)), 'met', 'person-b');
  const current = view(state).proposal;
  assert.equal(view(state).me.reflection.encounterId, 'meeting-1');
  assert.equal(view(state, 'person-b').me.reflection.encounterId, 'meeting-2');
  state = action(state, 'feedback', 'person-a', { encounterId: 'meeting-1', value: 'too-long' });
  assert.equal(view(state).me.pendingProposals[0].targetEncounterId, 'meeting-3');
  state = apply(state, 'ongoing');
  assert.deepEqual(view(state).proposal, current, 'late feedback cannot change the meeting already underway');
  const noAttendance = next(respond(seen(propose()), 'person-b', 'decline'));
  assert.throws(() => action(noAttendance, 'feedback', 'person-a', { encounterId: 'meeting-1', value: 'felt-good' }), /your own meeting confirmation/);
});

test('too-long feedback creates a private pending change, not an approved preference or inferred trait', () => {
  const completed = met(propose()), before = view(completed), state = feedback(completed), after = view(state);
  assert.deepEqual(after.me.fields, before.me.fields); assert.deepEqual(after.recommendation, before.recommendation);
  assert.equal(after.proposal.plan.duration, '90'); assert.equal(after.me.nextPreview.recommendation.plan.duration, '90');
  assert.equal(after.me.pendingProposals[0].field, 'duration'); assert.equal(after.me.pendingProposals[0].value, '40');
  assert.equal(after.me.pendingProposals[0].targetEncounterId, 'meeting-2'); assert.equal(after.me.feedback.length, 1);
  assert.deepEqual(view(state, 'person-b'), view(completed, 'person-b'), 'B receives no private feedback or pending proposal change');
});

test('explicit next-only approval changes the next draft to 40, and disappears after that encounter closes', () => {
  let state = apply(feedback(met(propose())), 'once');
  assert.equal(view(state).me.nextPreview.recommendation.plan.duration, '40'); assert.equal(view(state).proposal.plan.duration, '90');
  state = next(state); let snapshot = view(state);
  assert.equal(snapshot.recommendation.plan.duration, '40'); assert.equal(snapshot.me.fields.find(f => f.id === 'duration').source, 'feedback-confirmed');
  assert.match(snapshot.recommendation.reasons.join(' '), /직접 승인한 지난 만남 피드백/);
  state = met(propose(state)); state = next(state); snapshot = view(state);
  assert.equal(snapshot.encounter.id, 'meeting-3'); assert.equal(snapshot.recommendation.plan.duration, '90');
  assert.equal(snapshot.me.fields.find(f => f.id === 'duration').source, 'explicit');
});

test('ongoing approval persists but stays private until a concrete new proposal is explicitly shared', () => {
  let state = next(apply(feedback(met(propose())), 'ongoing'));
  assert.equal(view(state).recommendation.plan.duration, '40');
  const b = view(state, 'person-b');
  assert.equal(b.partner.sharedFields.some(f => f.id === 'duration'), false);
  assert.equal(b.me.feedback.length, 0); assert.equal(b.me.pendingProposals.length, 0);
  assert.ok(!JSON.stringify(b).includes('too-long')); assert.ok(!JSON.stringify(b).includes('feedback-confirmed'));
  assert.equal(b.recommendation.plan.duration, '90', 'a private preference does not become B-owned advice');
  state = propose(state); assert.equal(view(state, 'person-b').proposal.plan.duration, '40');
  state = next(met(state)); assert.equal(view(state).recommendation.plan.duration, '40');
});

test('activity feedback changes only the proposed activity, while felt-good creates no manufactured preference', () => {
  let state = feedback(met(propose()), 'person-a', 'activity-change');
  const proposal = view(state).me.pendingProposals[0]; assert.equal(proposal.field, 'activity'); assert.equal(proposal.value, 'walk');
  state = apply(state); assert.equal(view(state).me.nextPreview.recommendation.plan.activity, 'walk');
  assert.equal(view(state).me.nextPreview.recommendation.plan.duration, '90');
  assert.deepEqual(view(feedback(met(propose()), 'person-a', 'felt-good')).me.pendingProposals, []);
});

test('another actor cannot apply or dismiss private feedback; old applied proposals cannot be replayed', () => {
  let state = feedback(met(propose())), id = view(state).me.pendingProposals[0].id;
  assert.throws(() => action(state, 'apply', 'person-b', { proposalId: id, duration: 'ongoing' }), /no own pending/);
  assert.throws(() => action(state, 'dismiss', 'person-b', { proposalId: id }), /no own pending/);
  state = apply(state); assert.throws(() => action(state, 'apply', 'person-a', { proposalId: id, duration: 'ongoing' }), /no own pending/);
});

test('declining a feedback change leaves the recommendation unchanged; a still-pending next proposal remains usable after advancing', () => {
  const original = feedback(met(propose())), id = view(original).me.pendingProposals[0].id;
  const dismissed = action(original, 'dismiss', 'person-a', { proposalId: id });
  assert.deepEqual(view(dismissed).me.pendingProposals, []); assert.equal(view(dismissed).me.nextPreview.recommendation.plan.duration, '90');
  let state = next(original); assert.equal(view(state).me.pendingProposals[0].targetEncounterId, 'meeting-2');
  state = apply(state); assert.equal(view(state).recommendation.plan.duration, '40');
});

test('withdrawing a once setting returns to ongoing; withdrawing ongoing does not resurrect its overwritten predecessor', () => {
  let once = next(apply(feedback(met(propose())), 'once'));
  once = action(once, 'withdraw-setting', 'person-a', { field: 'duration', duration: 'once' });
  assert.equal(view(once).me.fields.find(f => f.id === 'duration').value, '90');
  let ongoing = next(apply(feedback(met(propose())), 'ongoing'));
  ongoing = action(ongoing, 'withdraw-setting', 'person-a', { field: 'duration', duration: 'ongoing' });
  const field = view(ongoing).me.fields.find(f => f.id === 'duration'); assert.equal(field.value, null); assert.equal(field.state, 'unknown');
});

test('private hard constraints are checked before acceptance without exposing their value to the other person', () => {
  let state = set(api.create('ready'), 'person-b', 'activity', 'walk', { share: false, required: true });
  assert.equal(view(state).partner.sharedFields.some(f => f.id === 'activity'), false);
  state = seen(propose(state)); assert.equal(view(state).proposal.plan.activity, 'cafe');
  assert.equal(view(state, 'person-b').proposal.selfCanAccept, false);
  assert.throws(() => respond(state, 'person-b', 'accept'), /mandatory conditions/);
  state = action(state, 'edit', 'person-b', { planId: 'weekend.walk.quiet.90' });
  assert.equal(view(state).proposal.plan.activity, 'walk'); assert.ok(view(state).proposal.people.every(p => !p.seen));
});

test('consent withdrawal invalidates old acceptance; restoring consent does not revive it', () => {
  let state = accepted(propose());
  state = set(state, 'person-b', 'consent', false); assert.equal(view(state).proposal.valid, false);
  state = set(state, 'person-b', 'consent', true); assert.equal(view(state).proposal.valid, false);
  assert.throws(() => action(state, 'met', 'person-a'), /changed or was withdrawn/);
  state = propose(state); assert.ok(view(state).proposal.people.every(p => !p.seen && p.response === 'unanswered'));
});

test('pure replay rejects foreign actors, unsupported fields, forged feedback links and timestamp aliases', () => {
  const state = api.create('ready'), before = JSON.stringify(state);
  assert.throws(() => set(state, 'foreign', 'activity', 'walk'), /actor/);
  assert.throws(() => set(state, 'person-a', 'diagnosis', 'anything'), /setting/);
  assert.throws(() => api.record(state, { kind: 'feedback', person: 'person-a', value: 'too-long', feedbackId: 'forged' }), /invalid action/);
  assert.throws(() => set(state, 'person-a', 'activity', 'walk', { at: state.events.at(-1).at.replace('Z', '+00:00') }), /unordered/);
  assert.deepEqual(view(state), view(state)); assert.equal(JSON.stringify(state), before);
});

test('joint proposal explanations describe the displayed edited plan, including approved feedback differences', () => {
  let state = action(propose(), 'edit', 'person-a', { planId: 'weekend.cafe.quiet.40' });
  let snapshot = view(state);
  assert.equal(snapshot.recommendation.plan.duration, '90'); assert.equal(snapshot.proposal.plan.duration, '40');
  assert.ok(snapshot.proposal.evaluation.facts.filter(f => f.field === 'duration').every(f => f.status === 'difference' && f.text.includes('차이가 있어요')));
  assert.ok(snapshot.recommendation.facts.filter(f => f.field === 'duration').every(f => f.status === 'fit'));
  assert.doesNotMatch(snapshot.proposal.evaluation.reasons.join(' '), /가중치|선호 2/);
  state = next(apply(feedback(met(propose())), 'ongoing'));
  state = action(propose(state), 'edit', 'person-a', { planId: 'weekend.cafe.quiet.90' }); snapshot = view(state);
  assert.match(snapshot.proposal.evaluation.reasons.join(' '), /지난 만남 피드백.*차이가 있어요/);
  assert.doesNotMatch(snapshot.proposal.evaluation.reasons.join(' '), /40분.*으로 제안했어요/);
});

test('required confirmations precede optional Ask questions; skipping leaves unknown and never blocks proposing', () => {
  let state = api.create('first');
  while (!view(state).canPropose) {
    const question = view(state).nextQuestion; assert.notEqual(question.optional, true);
    assert.ok(['availability', 'consent'].includes(question.field));
    state = set(state, 'person-a', question.field, question.field === 'consent' ? true : 'weekend');
  }
  assert.throws(() => action(state, 'skip-question', 'person-a', { field: 'availability' }), /optional/);
  const skipped = [];
  while (view(state).nextQuestion) {
    const question = view(state).nextQuestion; assert.equal(question.optional, true); assert.equal(question.basis, 'declared-decision-value');
    assert.ok(question.value > 0); assert.equal(view(state).canPropose, true); assert.ok(!skipped.includes(question.field));
    skipped.push(question.field); state = action(state, 'skip-question', 'person-a', { field: question.field });
    assert.equal(view(state).me.fields.find(f => f.id === question.field).state, 'unknown');
  }
  assert.deepEqual(skipped.sort(), ['activity', 'atmosphere', 'duration']);
  assert.doesNotThrow(() => propose(state));
  state = next(respond(seen(propose(state)), 'person-a', 'busy'));
  assert.equal(view(state).nextQuestion.optional, true, 'a skip is limited to its encounter');
  const question = view(state).nextQuestion;
  state = set(state, 'person-a', question.field, question.options[0].value);
  assert.notEqual(view(state).nextQuestion?.field, question.field);
});

test('settings after the first meeting confirmation affect only the next encounter and cannot trap the other confirmation', () => {
  for (const edit of [
    state => set(state, 'person-a', 'duration', '40', { duration: 'once' }),
    state => set(state, 'person-a', 'duration', '40', { duration: 'ongoing' }),
    state => action(state, 'withdraw-setting', 'person-a', { field: 'duration', duration: 'ongoing' }),
    state => set(state, 'person-b', 'consent', false),
  ]) {
    const partial = action(accepted(propose()), 'met', 'person-a');
    let state = edit(partial), snapshot = view(state);
    assert.equal(snapshot.encounter.started, true); assert.equal(snapshot.encounter.completed, false);
    assert.equal(snapshot.settingsTargetEncounterId, 'meeting-2'); assert.equal(snapshot.proposal.valid, true);
    assert.deepEqual(snapshot.proposal.evaluation, view(partial).proposal.evaluation);
    assert.deepEqual(snapshot.me.fields, view(partial).me.fields, 'recorded encounter preferences remain unchanged');
    assert.equal(snapshot.proposal.plan.duration, '90'); assert.equal(snapshot.proposal.canMeet, true);
    state = action(state, 'met', 'person-b'); snapshot = view(state);
    assert.equal(snapshot.canNext, true); assert.equal(snapshot.encounter.completed, true);
    assert.match(snapshot.proposal.label, /가상 만남/);
    assert.doesNotThrow(() => next(state));
  }
});

test('an unapplied change from the prior encounter cannot invalidate a partially confirmed new meeting', () => {
  let state = next(feedback(met(propose()))); const id = view(state).me.pendingProposals[0].id;
  state = action(accepted(propose(state)), 'met', 'person-a');
  assert.equal(view(state).me.pendingProposals.length, 0);
  assert.throws(() => action(state, 'apply', 'person-a', { proposalId: id, duration: 'once' }), /no own pending/);
  state = action(state, 'met', 'person-b'); assert.equal(view(state).canNext, true);
});

const selectionSeed = (number = 1, revision = 6) => ({ version: 'discovery-meeting-seed-1', key: `discovery-candidate${number}-revision${revision}`,
  candidateId: `candidate-${number}`, sourceRevision: revision, people: [
    { id: 'person-a', label: '나 · 가상 역할', availability: 'weekend' },
    { id: 'person-b', label: `가상 성인 ${number}`, availability: 'weekend' },
  ] });
const connectedReady = (seed = selectionSeed()) => {
  let state = api.createFromSelection(seed);
  for (const person of ['person-a', 'person-b']) for (const [field, value] of Object.entries({ consent: true, atmosphere: 'quiet', duration: '90', activity: 'cafe' })) state = set(state, person, field, value);
  return state;
};

test('a selected discovery candidate transfers only schedule and identity, never consent or meeting preferences', () => {
  const seed = selectionSeed(3), before = structuredClone(seed), state = api.createFromSelection(seed), snapshot = view(state);
  assert.deepEqual(seed, before); assert.equal(state.events.length, 2);
  assert.deepEqual(snapshot.connection, { key: seed.key, candidateId: 'candidate-3', sourceRevision: 6, label: '가상 성인 3' });
  assert.deepEqual(snapshot.people, [{ id: 'person-a', label: '나 · 가상 역할' }, { id: 'person-b', label: '가상 성인 3' }]);
  assert.equal(snapshot.partner.label, '가상 성인 3'); assert.equal(view(state, 'person-b').partner.label, '나 · 가상 역할');
  for (const person of ['person-a', 'person-b']) {
    const self = view(state, person).me;
    assert.equal(self.fields.find(f => f.id === 'availability').value, 'weekend');
    assert.ok(self.fields.filter(f => f.id !== 'availability').every(f => f.state === 'unknown' && f.value === null));
    assert.deepEqual(self.feedback, []); assert.deepEqual(self.pendingProposals, []);
  }
  assert.equal(snapshot.proposal, null); assert.equal(snapshot.canPropose, false); assert.equal(snapshot.canNext, false);
  assert.throws(() => propose(state), /visible required/);
  assert.doesNotMatch(snapshot.scenario.description, /90분/);
});

test('connected initial questions request both meeting consents and guide a role switch without accepting on their behalf', () => {
  let state = api.createFromSelection(selectionSeed()), snapshot = view(state);
  assert.equal(snapshot.nextQuestion.field, 'consent'); assert.equal(snapshot.nextQuestion.person, 'person-a');
  state = set(state, 'person-a', 'consent', true); snapshot = view(state);
  assert.equal(snapshot.canPropose, false); assert.equal(snapshot.nextQuestion.field, 'consent'); assert.equal(snapshot.nextQuestion.person, 'person-b');
  assert.equal(view(state, 'person-b').me.fields.find(f => f.id === 'consent').state, 'unknown');
  state = set(state, 'person-b', 'consent', true); snapshot = view(state);
  assert.equal(snapshot.canPropose, true); assert.equal(snapshot.nextQuestion.optional, true);
  const proposed = view(propose(state));
  assert.deepEqual(proposed.proposal.people.map(p => p.label), ['나 · 가상 역할', '가상 성인 1']);
  assert.ok(proposed.proposal.people.every(p => !p.seen && p.response === 'unanswered' && !p.met));
});

test('each selected connection receives a separate Core preference scope and Domain workspace', () => {
  const scopes = [], workspaces = [];
  const adapter = createMeetingAdapter({ Domain: { ...Domain, decide: input => { workspaces.push(input.scope.workspace); return Domain.decide(input); } }, Ask,
    Personalization: { preferences: { ...Personalization.preferences, record: input => { scopes.push(input.scope); return Personalization.preferences.record(input); } } } });
  for (const number of [1, 2]) adapter.inspect(adapter.createFromSelection(selectionSeed(number)));
  const contexts = [...new Set(scopes.map(s => s.contextId))];
  assert.deepEqual(contexts, [selectionSeed(1).key, selectionSeed(2).key]);
  assert.ok(scopes.every(s => s.productId === 'meeting-demo' && s.domain === 'SYNK'));
  assert.deepEqual([...new Set(workspaces)], contexts.map(key => `meeting.${key}`));
});

test('a different candidate starts fresh while the prior connection keeps its once, ongoing, acceptance and private feedback', () => {
  let first = connectedReady(selectionSeed(1));
  first = set(first, 'person-a', 'atmosphere', 'lively', { duration: 'once', share: false });
  first = apply(feedback(met(propose(first))), 'ongoing');
  const before = view(first), second = api.createFromSelection(selectionSeed(2)), after = view(second);
  assert.equal(before.encounter.completed, true); assert.equal(before.me.feedback.length, 1);
  assert.equal(before.me.nextPreview.recommendation.plan.duration, '40');
  assert.equal(after.connection.candidateId, 'candidate-2'); assert.equal(after.proposal, null);
  assert.ok(after.me.fields.filter(f => f.id !== 'availability').every(f => f.state === 'unknown'));
  assert.deepEqual(after.me.feedback, []); assert.deepEqual(after.me.pendingProposals, []);
  assert.deepEqual(view(first), before, 'a fresh pair does not mutate the existing pair');
  assert.deepEqual(view(api.createFromSelection(selectionSeed(1))).me.feedback, [], 'preserving a session is the UI responsibility, never an implicit cache');
});

test('changing a seed cannot relabel old choices, acceptance or feedback as a different candidate or revision', () => {
  const state = feedback(met(propose(connectedReady())));
  for (const seed of [selectionSeed(2), selectionSeed(1, 7), { ...selectionSeed(2), key: selectionSeed().key },
    { ...selectionSeed(), people: [{ ...selectionSeed().people[0], availability: 'any' }, selectionSeed().people[1]] }]) {
    assert.throws(() => view({ ...structuredClone(state), seed }), /another discovery connection/);
  }
  assert.throws(() => view({ ...api.createFromSelection(selectionSeed()), events: api.create('ready').events }), /another discovery connection/);
  const withoutSeed = structuredClone(state); delete withoutSeed.seed;
  assert.throws(() => view(withoutSeed), /another discovery connection/);
});

test('the discovery seed is strict, detached, finite and cannot insert approval or private data', () => {
  const seed = selectionSeed(), invalid = [
    { ...seed, version: 'other' }, { ...seed, key: '__proto__' }, { ...seed, key: 'x'.repeat(49) }, { ...seed, key: 'fictional-pair' },
    { ...seed, candidateId: 'hidden-no-consent' }, { ...seed, candidateId: ['candidate-1'] }, { ...seed, sourceRevision: -1 },
    { ...seed, sourceRevision: 1.1 }, { ...seed, sourceRevision: Number.MAX_SAFE_INTEGER + 1 }, { ...seed, consent: true },
    { ...seed, people: seed.people.slice().reverse() }, { ...seed, people: [seed.people[0], { ...seed.people[1], label: '다른 사람' }] },
    { ...seed, people: [seed.people[0], { ...seed.people[1], availability: undefined }] },
    { ...seed, people: [seed.people[0], { ...seed.people[1], consent: true }] },
  ];
  for (const item of invalid) assert.throws(() => api.createFromSelection(item), /discovery meeting/);
  const state = api.createFromSelection(seed); seed.people[1].label = '변경';
  assert.equal(view(state).partner.label, '가상 성인 1');
  const badTime = structuredClone(state); badTime.events[1].at = badTime.events[0].at;
  assert.throws(() => view(badTime), /unordered/);
  const flexible = selectionSeed(); flexible.people[0].availability = 'any';
  assert.equal(view(api.createFromSelection(flexible)).me.fields.find(f => f.id === 'availability').value, 'any');
  assert.equal(view(api.create('ready')).connection, null);
});
