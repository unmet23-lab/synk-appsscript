'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const P = require('../atlas/personalization');
const Core = require('../atlas/engine');
const at = '2026-10-02T00:00:00.000Z';
const later = '2026-10-02T00:01:00.000Z';
const scope = { personId: 'person-1', productId: 'world', contextId: 'home', domain: 'LAB' };
const create = (owner = scope) => P.createProfile({ scope: owner, at });
const consent = (values = {}, owner = scope) => P.updateProfile(create(owner), { consent: true, values }, at);
const candidates = [
  { id: 'learn', minutes: 5, pace: 'standard', goals: ['study'] },
  { id: 'prepare', minutes: 5, pace: 'standard', goals: ['prepare'] },
  { id: 'create', minutes: 5, pace: 'standard', goals: ['expression'] },
  { id: 'work', minutes: 5, pace: 'standard', goals: ['work'] },
];
const select = (profile, extra = {}) => P.selectPersonalization({ profile, scope: profile.scope, candidates, experienceId: 'entry', at, ...extra });
const completionFor = (events, decisionId) => events.find(event => event.type === 'experience.completed' && event.decisionId === decisionId);

test('explicit purposes of learner, teacher, worker and client produce different Core choices', () => {
  const examples = [['study', 'learn'], ['prepare', 'prepare'], ['work', 'work'], ['expression', 'create']];
  for (const [goal, expected] of examples) {
    const result = select(consent({ goal }));
    assert.equal(result.plan.selected.id, expected);
    assert.equal(result.plan.version, Core.VERSION);
    assert.equal(result.explanation.basis, 'self-declared');
    assert.equal(result.explanation.abilityClaim, false);
    assert.equal(result.explanation.learningEffectClaim, false);
    assert.equal(result.provenance.goal.source, 'self-declared');
    assert(result.plan.evidence.every(id => result.events.some(event => event.id === id)));
  }
});

test('same exact declarations produce same result regardless of product persona', () => {
  const owners = ['student', 'teacher', 'worker', 'customer'].map(contextId => ({ ...scope, contextId }));
  const choices = owners.map(owner => select(consent({ goal: 'prepare' }, owner)).plan.selected.id);
  assert.deepEqual(choices, ['prepare', 'prepare', 'prepare', 'prepare']);
});

test('cold start and skipping need no personal fields, storage or invented ability', () => {
  const empty = create();
  for (const profile of [empty, P.clearProfile(empty, { mode: 'skip', at })]) {
    const result = select(profile);
    assert.equal(result.plan.status, 'ready');
    assert.deepEqual(result.events, []);
    assert.deepEqual(result.values, {});
    assert.equal(result.persistence, 'none');
    assert.equal(result.explanation.basis, 'cold-start');
    assert.equal(result.explanation.confidence, 'unknown');
  }
});

test('remembering fields requires explicit consent; true is not accepted as a string', () => {
  assert.throws(() => P.updateProfile(create(), { values: { goal: 'study' } }, at), /consent/);
  assert.throws(() => P.updateProfile(create(), { values: {}, consent: 'true' }, at), /invalid update/);
  assert.throws(() => P.updateProfile(create(), { values: {}, consent: true, analytics: true }, at), /invalid update/);
});

test('age, gender, names, diagnoses and hidden behavioral estimates are not accepted', () => {
  for (const key of ['age', 'birthDate', 'gender', 'name', 'diagnosis', 'personality', 'ability', 'inferredGoal']) {
    assert.throws(() => consent({ [key]: 'ignored?' }), /unsupported setting/);
  }
  assert.throws(() => consent(JSON.parse('{"__proto__":{"admin":true}}')), /unsupported setting/);
  assert.throws(() => consent({ minutes: -1 }), /invalid minutes/);
  assert.throws(() => consent({ minutes: 2.5 }), /invalid minutes/);
});

test('precise time and sound requirements exclude infeasible items, even if they match the goal', () => {
  const result = select(consent({ goal: 'study', minutes: 10, audio: 'off' }), { candidates: [
    { id: 'long', minutes: 11, pace: 'standard', goals: ['study'] },
    { id: 'listening', minutes: 5, pace: 'standard', goals: ['study'], requiresAudio: true },
    { id: 'text', minutes: 8, pace: 'standard', goals: ['clarity'], requiresAudio: false },
  ] });
  assert.equal(result.plan.selected.id, 'text');
  assert(result.reasons.includes('time.limit'));
  assert(result.reasons.includes('audio.off'));
});

test('no feasible material produces an unavailable plan, never a broken substitute', () => {
  for (const values of [{ minutes: 1 }, { audio: 'off' }, { experience: 'new' }]) {
    const result = select(consent(values), { candidates: [{ id: 'a', minutes: 10, pace: 'standard', requiresAudio: true, experiences: ['practiced'] }] });
    assert.equal(result.plan.status, 'unavailable');
    assert.equal(result.plan.selected, null);
    assert(result.reasons.includes('no.feasible.experience'));
    assert(!result.events.some(event => event.type === 'decision.made'));
  }
});

test('explicit experience and accessibility change presentation without changing assessment standards', () => {
  const novice = select(consent({ experience: 'new', textSize: 'large', explanation: 'detailed', motion: 'reduced' }));
  assert.deepEqual(novice.presentation, { textSize: 'large', explanation: 'detailed', motion: 'reduced', support: 'step', audio: 'available' });
  assert.equal(novice.provenance.experience.confidence, 'declared');
  assert(!novice.plan.reasons.includes('support.step'));
  assert.equal(novice.provenance.support, undefined);
  assert.equal(select(consent({ experience: 'new', support: 'independent' })).presentation.support, 'independent');
});

test('updates are detached, editable and individually clearable with no older declaration revival', () => {
  const old = consent({ goal: 'study', support: 'step' });
  const before = select(old);
  const patch = { values: { goal: 'work', support: null } };
  const changed = P.updateProfile(old, patch, later);
  patch.values.goal = 'expression';
  assert.equal(old.values.goal, 'study');
  assert.equal(changed.values.goal, 'work');
  assert.notEqual(changed.generation, old.generation);
  assert(!Object.hasOwn(changed.values, 'support'));
  assert(!Object.hasOwn(changed.provenance, 'support'));
  const after = select(changed, { at: later, events: before.events });
  assert.equal(after.plan.selected.id, 'work');
  assert.equal(after.presentation.support, 'choose');
  assert.equal(Core.understand(after.events, P.coreScope(changed), later).context.support, undefined);
  assert(!after.events.some(event => before.events.some(oldEvent => oldEvent.id === event.id)));
});

test('declared independent support takes precedence over an incompatible goal-matched presentation', () => {
  const options = [
    { id: 'guided', minutes: 5, pace: 'standard', goals: ['study'], supports: ['step'] },
    { id: 'try-then-check', minutes: 5, pace: 'standard', goals: ['explore'], supports: ['independent'] },
    { id: 'context-first', minutes: 5, pace: 'standard', goals: ['clarity'], supports: ['choose'] },
  ];
  const result = select(consent({ goal: 'study', support: 'independent' }), { candidates: options });
  assert.equal(result.plan.selected.id, 'try-then-check');
  assert(result.plan.reasons.includes('support.independent'));
  assert.equal(select(consent({ support: 'step' }), { candidates: options.slice(1) }).plan.status, 'unavailable');
  assert.throws(() => select(consent(), { candidates: [{ ...options[0], supports: ['invented'] }] }), /invalid candidate/);
});

test('product/context/person/domain isolation rejects profile or history reuse', () => {
  const profile = consent({ goal: 'study' }), result = select(profile);
  for (const changed of [{ personId: 'person-2' }, { productId: 'messenger' }, { contextId: 'teacher' }, { domain: 'SYNK' }]) {
    const other = { ...scope, ...changed };
    assert.throws(() => select(profile, { scope: other }), /another person/);
    assert.throws(() => select(consent({}, other), { events: result.events }), /foreign event/);
  }
});

test('SYNK shared product domain works and is isolated from all brand domains', () => {
  for (const domain of ['SYNK', 'LAB', 'PATH', 'SHIFT', 'PULSE']) {
    const profile = consent({ goal: 'work' }, { ...scope, domain });
    const result = select(profile);
    assert.equal(result.plan.selected.id, 'work');
    assert.equal(result.plan.scope.domain, domain);
    result.events.forEach(Core.validate);
  }
});

test('completion plus not-fit feedback changes the next real Core recommendation', () => {
  const profile = consent({ goal: 'prepare' });
  const options = [{ id: 'a', minutes: 5, pace: 'standard', goals: ['prepare'] }, { id: 'b', minutes: 5, pace: 'standard', goals: ['prepare'] }];
  const first = select(profile, { candidates: options });
  assert.equal(first.plan.selected.id, 'a');
  assert.throws(() => P.recordFeedback({ profile, scope, events: first.events, completionId: first.plan.id, value: 'not_fit', at }), /completed recommendation/);
  const completed = P.recordCompletion({ profile, scope, events: first.events, decisionId: first.plan.id, at });
  assert.deepEqual(P.recordCompletion({ profile, scope, events: completed, decisionId: first.plan.id, at }), completed);
  const completionId = completionFor(completed, first.plan.id).id;
  const events = P.recordFeedback({ profile, scope, events: completed, completionId, value: 'not_fit', at });
  const next = select(profile, { candidates: options, events });
  assert.equal(next.plan.selected.id, 'b');
  assert.equal(next.explanation.basis, 'self-reported-feedback');
  assert(next.reasons.includes('feedback.not_fit'));
  assert(next.plan.evidence.includes(completionId));
  assert.equal(next.plan.outcomeBasis, 'self_report');
});

test('too-much feedback reduces the next plan amount without a person-ability claim', () => {
  const profile = consent();
  const options = [{ id: 'short', minutes: 3, pace: 'short' }, { id: 'normal', minutes: 12, pace: 'standard' }];
  const first = select(profile, { candidates: options });
  const completed = P.recordCompletion({ profile, scope, events: first.events, decisionId: first.plan.id, at });
  const events = P.recordFeedback({ profile, scope, events: completed, completionId: completionFor(completed, first.plan.id).id, value: 'too_much', at });
  const next = select(profile, { candidates: options, events });
  assert.equal(first.plan.selected.id, 'normal');
  assert.equal(next.plan.selected.id, 'short');
  assert.equal(next.explanation.abilityClaim, false);
});

test('a teacher asking for another way gets an available alternative despite the previous goal match', () => {
  const profile = consent({ goal: 'study', support: 'independent', minutes: 20 });
  const options = [
    { id: 'group-evidence', minutes: 20, pace: 'standard', goals: ['prepare'] },
    { id: 'individual-practice', minutes: 20, pace: 'standard', goals: ['study'] },
    { id: 'explain-together', minutes: 20, pace: 'standard', goals: ['clarity'] },
  ];
  const first = select(profile, { candidates: options });
  assert.equal(first.plan.selected.id, 'individual-practice');
  const done = P.recordCompletion({ profile, scope, at, events: first.events, decisionId: first.plan.id });
  const events = P.recordFeedback({ profile, scope, at, events: done, completionId: completionFor(done, first.plan.id).id, value: 'not_fit' });
  const next = select(profile, { candidates: options, events });
  assert.notEqual(next.plan.selected.id, 'individual-practice');
  assert(next.reasons.includes('feedback.alternative'));
  const only = select(profile, { candidates: options.filter(item => item.id === 'individual-practice'), events });
  assert.equal(only.plan.selected.id, 'individual-practice');
  assert(only.reasons.includes('feedback.no_alternative'));
});

test('disable/delete/skip erase values and make stale history unusable after re-consent', () => {
  const profile = consent({ goal: 'study', minutes: 5 }), first = select(profile);
  for (const mode of ['disable', 'delete', 'skip']) {
    const cleared = P.clearProfile(profile, { mode, at: later });
    assert.deepEqual(cleared.values, {}); assert.deepEqual(cleared.provenance, {});
    assert.equal(cleared.consent, false);
    assert.deepEqual(select(cleared, { at: later, events: first.events }).events, []);
    assert.throws(() => P.recordCompletion({ profile: cleared, scope, at: later, events: first.events, decisionId: first.plan.id }), /consent/);
    const restored = P.updateProfile(cleared, { consent: true, values: { goal: 'work' } }, later);
    const result = select(restored, { at: later, events: first.events });
    assert.equal(result.plan.selected.id, 'work');
    assert(result.events.every(event => event.scope.workspace === P.coreScope(restored).workspace));
    assert(!result.events.some(event => first.events.some(old => old.id === event.id)));
  }
});

test('PULSE accepts customer declarations but preserves its ban on personal behavioral learning', () => {
  const owner = { ...scope, domain: 'PULSE', contextId: 'creative-brief' };
  const profile = consent({ goal: 'expression', explanation: 'brief' }, owner), result = select(profile);
  assert.equal(result.plan.selected.id, 'create');
  assert.throws(() => P.recordCompletion({ profile, scope: owner, events: result.events, decisionId: result.plan.id, at }), /PULSE/);
  assert.throws(() => Core.createSession({ scope: P.coreScope(profile) }).observe({ kind: 'trait', key: 'visual', strength: 1, n: 10 }), /PULSE/);
});

test('malformed, foreign, future and unauthorized observation sources fail closed', () => {
  const profile = consent(), result = select(profile);
  assert.throws(() => select(profile, { events: [{ ...result.events[0], at: later, recordedAt: later }] }), /future event/);
  const forged = { ...profile, provenance: { goal: { source: 'inferred', confidence: 'measured', at, revision: 1 } }, values: { goal: 'study' } };
  assert.throws(() => select(forged), /declared source/);
  const runtime = Core.createSession({ scope: P.coreScope(profile), clock: () => at, id: () => 'observed-one' });
  runtime.observe({ kind: 'trait', key: 'visual', strength: 1, n: 10 });
  assert.throws(() => select(profile, { events: runtime.events() }), /owning practice adapter/);
  assert.throws(() => P.updateProfile(profile, { values: { goal: 'study' } }, '2026-10-01T00:00:00.000Z'), /stale/);
});

test('invalid candidates cannot hide behind a filter', () => {
  assert.throws(() => select(consent({ minutes: 1 }), { candidates: [{ id: 'bad', minutes: -5, pace: 'invented' }] }), /invalid candidate/);
  assert.throws(() => select(consent(), { candidates: [candidates[0], candidates[0]] }), /invalid candidate/);
  assert.throws(() => select(consent(), { candidates: [{ ...candidates[0], rawCustomerBrief: 'private text' }] }), /invalid candidate/);
});

test('browser bundle uses the same existing Core and public adapter as CommonJS', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../atlas/engine.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../atlas/personalization.js'), 'utf8'), context);
  const outcome = vm.runInContext(`(() => {
    const at=${JSON.stringify(at)}, scope=${JSON.stringify({ ...scope, domain: 'SYNK' })};
    const profile=SynkAtlasPersonalization.updateProfile(SynkAtlasPersonalization.createProfile({scope,at}), {consent:true,values:{goal:'work'}},at);
    return SynkAtlasPersonalization.selectPersonalization({profile,scope,at,experienceId:'entry',candidates:${JSON.stringify(candidates)}});
  })()`, context);
  assert.equal(outcome.plan.selected.id, 'work');
  assert.equal(outcome.plan.version, Core.VERSION);
});

// 공개 가입의 「배우는 이유」(계약/배우는이유_선택응답_계약.json r1 · 공개판 설계 #learn-reasons).
test('declared learning reasons reach Core only as one broad goal, never as ability or level', () => {
  const examples = [[['work', 'career'], 'work'], [['exam'], 'prepare'], [['travel', 'people', 'life'], 'create'], [['study'], 'learn']];
  for (const [reasons, expected] of examples) {
    const result = select(consent({ reasons }));
    assert.equal(result.plan.selected.id, expected, reasons.join('+'));
    assert.equal(result.ask, null);
    assert(result.reasons.includes('reasons.declared'));
    assert.equal(result.explanation.basis, 'self-declared');
    assert.equal(result.explanation.abilityClaim, false);
    assert.equal(result.provenance.reasons.source, 'self-declared');
  }
});

test('reasons are stored unordered in contract order; empty, four, repeated or unknown reasons fail', () => {
  assert.deepEqual(consent({ reasons: ['work', 'culture'] }).values.reasons, ['culture', 'work']);
  for (const reasons of [[], ['culture', 'travel', 'people', 'life'], ['work', 'work'], ['religion'], 'work']) {
    assert.throws(() => consent({ reasons }), /invalid reasons/, JSON.stringify(reasons));
  }
  assert.throws(() => consent({ reasons: ['other'], otherText: 'private words' }), /unsupported setting/);
});

test('reasons with different goals stay undecided and ask only when the biggest one changes the plan', () => {
  const mixed = select(consent({ reasons: ['study', 'work'] }));
  assert(mixed.reasons.includes('reasons.mixed'));
  assert.deepEqual(mixed.ask, { id: 'reasons.primary', kind: 'choice', about: 'primaryReason', options: [{ id: 'study' }, { id: 'work' }] });
  assert.equal(mixed.events.filter(event => event.type === 'decision.made').length, 1, 'trial plans leave no decision in the history');
  const shared = [{ id: 'both', minutes: 5, pace: 'standard', goals: ['study', 'work'] }, { id: 'talk', minutes: 5, pace: 'standard', goals: ['expression'] }];
  const same = select(consent({ reasons: ['study', 'work'] }), { candidates: shared });
  assert.equal(same.ask, null, 'an answer that changes nothing is not asked');
  assert.equal(select(consent({ reasons: ['other'] })).ask, null);
  assert.equal(select(consent({ reasons: ['study', 'work'], goal: 'prepare' })).plan.selected.id, 'prepare', 'an explicit goal is not overridden');
});

test('the biggest reason decides the goal and is forgotten when the reasons change', () => {
  const both = consent({ reasons: ['study', 'work'] });
  const primary = P.updateProfile(both, { values: { primaryReason: 'work' } }, later);
  const chosen = select(primary, { at: later });
  assert.equal(chosen.plan.selected.id, 'work');
  assert.equal(chosen.ask, null);
  assert.throws(() => P.updateProfile(both, { values: { primaryReason: 'travel' } }, later), /one of the declared reasons/);
  const changed = P.updateProfile(primary, { values: { reasons: ['study', 'travel'] } }, later);
  assert.equal(changed.values.primaryReason, undefined);
  assert.equal(changed.provenance.primaryReason, undefined);
  assert(changed.generation > primary.generation, 'forgetting a declaration starts a clean decision history');
});

test('the shared contract and Core agree on the reasons and their broad goals', () => {
  const contract = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../계약/배우는이유_선택응답_계약.json'), 'utf8')).배우는이유;
  assert.deepEqual(P.REASONS, contract.보기.map(item => item.값));
  assert.deepEqual({ ...P.REASON_GOAL }, Object.fromEntries(contract.보기.map(item => [item.값, item.atlas_goal])));
  assert.equal(P.MAX_REASONS, contract.최대);
  for (const goal of Object.values(P.REASON_GOAL)) assert(goal === null || P.OPTIONS.goal.includes(goal));
});
