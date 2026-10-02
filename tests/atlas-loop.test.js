'use strict';
/* Atlas stage 2 — the loop: remember -> decide -> deliver -> check -> remember.
 * tests/atlas.test.js keeps guarding the atlas-1 behaviour that existing consumers rely on. */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../atlas/engine.js');
const { modesFor } = require('../atlas/experiences.js');
const scope = { domain: 'LAB', workspace: 'game', subject: 'synthetic' };
const levers = () => [
  { id: 'core.focus', engine: 'core', class: 'content', options: [
    { id: 'purpose', goals: ['prepare', 'work'], targets: ['need:letter.purpose'] },
    { id: 'tone', goals: ['expression'], targets: ['need:honorific', 'due:honorific'] },
    { id: 'clarity', goals: ['clarity'], targets: ['need:letter.deadline', 'due:letter.deadline'] }] },
  { id: 'vellum.checks', engine: 'vellum', class: 'shape', follows: 'support', default: 'choose', learn: true,
    options: [{ id: 'choose' }, { id: 'step', targets: ['trait:prefers.step'] }, { id: 'independent' }] },
];
function fixture({ explore = 0, experienceId = 'letter', domain = 'LAB' } = {}) {
  let at = Date.parse('2026-09-18T00:00:00Z'), n = 0;
  const session = A.createSession({ scope: { ...scope, domain }, clock: () => new Date(at).toISOString(), id: () => `e${++n}`, explore });
  const tick = (minutes = 1) => { at += minutes * 60000; };
  const plan = () => { tick(); return session.plan(experienceId, modesFor('LAB'), { levers: levers() }); };
  // One finished round: plan, complete, optionally answer.
  const round = answer => { const decision = plan(); tick(); const done = session.complete(decision); if (answer) { tick(); session.feedback(done.id, answer); } return decision; };
  const observe = (kind, key, strength, count, extra = {}) => { tick(); return session.observe({ kind, key, strength, n: count, ...extra }); };
  return { session, tick, plan, round, observe, days: d => tick(d * 1440), now: () => new Date(at).toISOString() };
}
const pick = (decision, lever) => decision.bundle[lever].option;
function practiceProof(f, decision, { firstExposure = true, helpLevel = null, repeat = false, conceptIds = ['honorific'], verdict = 'correct', itemKey = 'honorific.new' } = {}) {
  f.tick();
  const presented = f.session.practice('presented', { decisionId: decision.id, taskId: 'honorific-task', taskVersion: 'v1', itemKey, conceptIds, firstExposure });
  if (helpLevel) { f.tick(); f.session.practice('helped', { presentationId: presented.id, helpId: 'help-1', level: helpLevel, contentRef: 'help-content-1' }); }
  if (repeat) { f.tick(); f.session.practice('attempted', { presentationId: presented.id, attemptNo: 1, verdict: 'incorrect', errorTags: [] }); }
  f.tick();
  const attempt = f.session.practice('attempted', { presentationId: presented.id, attemptNo: repeat ? 2 : 1, verdict, errorTags: [] });
  return { presented, attempt };
}

test('what was observed changes what is practised; one thin observation does not, until the person confirms it', () => {
  const f = fixture();
  assert.equal(pick(f.plan(), 'core.focus'), 'purpose', 'with nothing known the first turn of the rotation is used');
  f.observe('need', 'letter.deadline', 0.9, 1);
  const thin = f.session.lines().find(line => line.key === 'need:letter.deadline');
  assert.equal(thin.sufficiency, 'thin'); assert.equal(thin.usable, false);
  assert.equal(pick(f.plan(), 'core.focus'), 'purpose', 'a single observation is not a trait of the person');
  f.tick(); f.session.respond('need:letter.deadline', 'yes');
  const confirmed = f.plan();
  assert.equal(pick(confirmed, 'core.focus'), 'clarity');
  assert.equal(confirmed.bundle['core.focus'].basis, 'line');
  assert.ok(confirmed.bundle['core.focus'].reasons.includes('line.need:letter.deadline'));
  f.observe('need', 'honorific', 1, 8);
  const solid = f.plan();
  assert.equal(pick(solid, 'core.focus'), 'tone', 'the stronger, well-sampled need wins');
  assert.ok(solid.evidence.includes(f.session.lines().find(line => line.key === 'need:honorific').evidence[0]), 'the decision cites the observation it used');
  assert.equal(solid.skill, undefined, 'a decision never claims a skill level');
});

test('the person can say "no": a guess about them stays denied, a need reopens only on later evidence, nothing is deleted', () => {
  const f = fixture();
  const first = f.observe('need', 'honorific', 0.9, 8);
  f.observe('trait', 'prefers.step', 0.8, 8);
  assert.equal(pick(f.plan(), 'core.focus'), 'tone'); assert.equal(pick(f.plan(), 'vellum.checks'), 'step');
  f.tick(); f.session.respond('need:honorific', 'no'); f.tick(); f.session.respond('trait:prefers.step', 'no');
  const denied = f.plan();
  assert.equal(pick(denied, 'core.focus'), 'purpose'); assert.equal(pick(denied, 'vellum.checks'), 'choose');
  assert.equal(f.session.lines().find(line => line.key === 'need:honorific').status, 'denied');
  assert.ok(f.session.events().some(event => event.id === first.id), 'the original observation is kept');
  f.observe('need', 'honorific', 0.9, 8); f.observe('trait', 'prefers.step', 0.8, 8);
  const later = f.plan();
  assert.equal(pick(later, 'core.focus'), 'tone', 'evidence observed after the answer opens a new, unconfirmed line');
  assert.equal(f.session.lines().find(line => line.key === 'need:honorific').status, 'unconfirmed');
  assert.equal(pick(later, 'vellum.checks'), 'choose', 'a denied guess about the person is not re-opened by more observation');
  f.tick(); f.session.respond('trait:prefers.step', 'yes');
  assert.equal(pick(f.plan(), 'vellum.checks'), 'step', 'only the person reopens it');
});

test('what the person set themselves beats observation, learning and the baseline share', () => {
  const f = fixture();
  f.observe('trait', 'prefers.step', 1, 8);
  f.tick(); f.session.set('support', 'independent');
  const decision = f.plan();
  assert.equal(pick(decision, 'vellum.checks'), 'independent'); assert.equal(decision.bundle['vellum.checks'].basis, 'declared');
  assert.equal(decision.support, 'independent');
  f.tick(); f.session.set('support', null);
  assert.equal(f.plan().support, 'step', 'without a declaration the lever that follows support speaks for it');
});

test('learning within one person: a way that works is kept, two "not for me" answers make room for another way', () => {
  const f = fixture();
  assert.deepEqual([f.round('not_fit'), f.round('not_fit')].map(d => pick(d, 'vellum.checks')), ['choose', 'choose'], 'one answer is not enough to leave the declared starting point');
  const complaint = f.session.events().findLast(event => event.type === 'feedback.given').id;
  const switched = f.round('helpful');
  assert.equal(pick(switched, 'vellum.checks'), 'step', 'after two, the next untried way in the adapter order gets its turn');
  assert.equal(switched.bundle['vellum.checks'].basis, 'learned'); assert.ok(switched.bundle['vellum.checks'].reasons.includes('learned.switch'));
  assert.ok(switched.evidence.includes(complaint), 'the answers that caused the switch are cited');
  const kept = f.plan();
  assert.equal(pick(kept, 'vellum.checks'), 'step', 'and is kept once it works'); assert.ok(kept.bundle['vellum.checks'].reasons.includes('learned.works'));
  assert.ok(kept.evidence.includes(f.session.events().findLast(event => event.type === 'feedback.given').id), 'the answer that taught it is cited');
  const liked = fixture(); liked.round('helpful'); liked.round('not_fit'); liked.round('not_fit');
  assert.equal(pick(liked.plan(), 'vellum.checks'), 'choose', 'a way that has worked before needs more than two complaints');
  const amount = fixture(); amount.round('too_much'); amount.round('too_much'); amount.round('too_much');
  assert.equal(pick(amount.plan(), 'vellum.checks'), 'choose', 'too_much steers the amount, it is not a verdict on the help style');
  const quiet = fixture(); quiet.round(); quiet.round(); quiet.round();
  assert.equal(pick(quiet.plan(), 'vellum.checks'), 'choose', 'finishing without answering is never counted against anything');
  f.days(40);
  assert.equal(pick(f.plan(), 'vellum.checks'), 'choose', 'old results lose their say after the window');
});

test('a checked result feeds the next choice: independent success lowers that aim, assisted success and "not yet measurable" do not', () => {
  const run = result => {
    const f = fixture();
    f.observe('need', 'honorific', 0.9, 8); f.observe('need', 'letter.deadline', 0.8, 8); f.observe('need', 'letter.purpose', 0.5, 8);
    const first = f.round(); assert.equal(pick(first, 'core.focus'), 'tone');
    if (result) {
      const { attempt } = practiceProof(f, first);
      f.tick(); f.session.outcome(first.id, { ...result, attemptId: attempt.id, targetLine: 'need:honorific' });
    }
    assert.equal(pick(f.round(), 'core.focus'), 'clarity', 'the same aim is not served twice in a row unless it is due');
    return { f, third: f.round() };
  };
  assert.equal(pick(run(null).third, 'core.focus'), 'tone', 'with no result the strongest need returns');
  const success = run({ measure: 'independent', window: 'immediate', value: 0.9, assisted: false });
  assert.equal(pick(success.third, 'core.focus'), 'purpose'); assert.equal(success.third.outcomeBasis, 'performance');
  assert.ok(success.third.evidence.includes(success.f.session.events().find(e => e.type === 'practice.attempted').id));
  assert.equal(pick(run({ measure: 'independent', window: 'immediate', value: 0.9, assisted: true }).third, 'core.focus'), 'tone', 'help received is not independent ability');
  assert.equal(pick(run({ measure: 'recurrence', window: 'd7', value: null, reason: 'not_due' }).third, 'core.focus'), 'tone', 'no value is not an effect of zero');
  success.f.observe('need', 'honorific', 0.9, 8);
  assert.equal(pick(success.f.plan(), 'core.focus'), 'tone', 'a newer observation overrides the earlier success');
});

test('outcome numbers do not relax a need without the matching new independent correct attempt', () => {
  const scenarios = [
    { name: 'unknown reported help', outcome: { assisted: null } },
    { name: 'satisfaction is not ability', outcome: { measure: 'satisfaction' } },
    { name: 'legacy outcome without practice proof', proof: false },
    { name: 'unknown first exposure', practice: { firstExposure: null } },
    { name: 'item seen before', practice: { firstExposure: false } },
    { name: 'hint before answer', practice: { helpLevel: 'cue' } },
    { name: 'explanation before answer', practice: { helpLevel: 'explanation' } },
    { name: 'answer already shown', practice: { helpLevel: 'answer' } },
    { name: 'repeat attempt', practice: { repeat: true } },
    { name: 'incorrect attempt', practice: { verdict: 'incorrect' } },
    { name: 'unassessed attempt', practice: { verdict: 'unassessed' } },
    { name: 'different concept', practice: { conceptIds: ['letter.purpose'] } },
    { name: 'different target line', outcome: { targetLine: 'due:honorific' } },
    { name: 'different decision', otherDecision: true },
    { name: 'excluded attempt', excludeAttempt: true },
  ];
  for (const scenario of scenarios) {
    const f = fixture();
    f.observe('need', 'honorific', 0.9, 8); f.observe('need', 'letter.deadline', 0.8, 8); f.observe('need', 'letter.purpose', 0.5, 8);
    const first = f.round();
    let provenance = {};
    if (scenario.proof !== false) {
      const { attempt } = practiceProof(f, scenario.otherDecision ? f.plan() : first, scenario.practice);
      provenance = { attemptId: attempt.id, targetLine: 'need:honorific' };
      if (scenario.excludeAttempt) { f.tick(); f.session.exclude(attempt.id); }
    }
    f.tick(); f.session.outcome(first.id, { measure: 'independent', window: 'immediate', value: 1, assisted: false, ...provenance, ...scenario.outcome });
    f.round(); const third = f.round();
    assert.equal(pick(third, 'core.focus'), 'tone', scenario.name);
    assert.notEqual(third.outcomeBasis, 'performance', scenario.name);
  }
});

test('practice provenance lives in the same session log and rejects raw text, missing parents and outcome proof gaps', () => {
  const f = fixture(), first = f.plan();
  assert.throws(() => f.session.practice('presented', { decisionId: 'missing', taskId: 't', taskVersion: 'v1', itemKey: 'i', conceptIds: ['honorific'], firstExposure: true }), /prior parent/);
  assert.throws(() => f.session.practice('presented', { decisionId: first.id, taskId: 't', taskVersion: 'v1', itemKey: 'i', conceptIds: ['honorific'], firstExposure: true, rawText: 'private' }), /unexpected/);
  const proof = practiceProof(f, first);
  assert.equal(f.session.events().filter(e => e.type.startsWith('practice.')).length, 2);
  const restored = A.createSession({ scope, events: f.session.events(), clock: f.now });
  assert.deepEqual(restored.events(), f.session.events());
  assert.throws(() => f.session.outcome(first.id, { measure: 'independent', window: 'immediate', value: 1, assisted: false, attemptId: proof.attempt.id }), /attempt and target/);
  assert.throws(() => f.session.outcome(first.id, { measure: 'independent', window: 'immediate', value: 1, assisted: false, attemptId: 'missing', targetLine: 'need:honorific' }), /prior attempt/);
  assert.throws(() => f.session.outcome(first.id, { measure: 'independent', window: 'immediate', value: 1, assisted: false, attemptId: proof.attempt.id, targetLine: 'trait:honorific' }), /attempt and target/);
});

test('a delayed outcome cannot reuse an old correct attempt to erase a newer need', () => {
  const f = fixture();
  f.observe('need', 'honorific', 0.9, 8); f.observe('need', 'letter.deadline', 0.8, 8); f.observe('need', 'letter.purpose', 0.5, 8);
  const first = f.round(), { attempt } = practiceProof(f, first);
  f.observe('need', 'honorific', 0.9, 8);
  f.tick();
  f.session.outcome(first.id, { measure: 'independent', window: 'immediate', value: 1, assisted: false, attemptId: attempt.id, targetLine: 'need:honorific' });
  f.round(); const third = f.round();
  assert.equal(pick(third, 'core.focus'), 'tone');
  assert.notEqual(third.outcomeBasis, 'performance');
});

test('a proof survives other reports on the same decision; state hands out copies of the log', () => {
  const setup = () => {
    const f = fixture();
    f.observe('need', 'honorific', 0.9, 8); f.observe('need', 'letter.deadline', 0.8, 8); f.observe('need', 'letter.purpose', 0.5, 8);
    const first = f.round(), { attempt } = practiceProof(f, first);
    f.tick(); f.session.outcome(first.id, { measure: 'independent', window: 'immediate', value: 1, assisted: false, attemptId: attempt.id, targetLine: 'need:honorific' });
    return { f, first, attempt };
  };
  for (const later of [
    ({ first }) => ({ id: first.id, result: { measure: 'independent', window: 'immediate', value: 0.9, assisted: false } }),
    ({ first, attempt }) => ({ id: first.id, result: { measure: 'independent', window: 'immediate', value: 1, assisted: false, attemptId: attempt.id, targetLine: 'due:honorific' } }),
  ]) {
    const s = setup(), next = later(s);
    s.f.tick(); s.f.session.outcome(next.id, next.result);
    s.f.round(); const third = s.f.round();
    assert.equal(third.outcomeBasis, 'performance', 'a later report about something else does not erase the proof');
    assert.equal(pick(third, 'core.focus'), 'purpose');
  }
  const f = fixture(); f.round('helpful');
  f.session.state().feedback[0].scope.subject = 'someone-else';
  assert.equal(f.session.state().feedback[0].scope.subject, 'synthetic');
  assert.equal(f.session.events().find(e => e.type === 'feedback.given').scope.subject, 'synthetic');
});

test('the browser kernel loads Trail only when practice is used, in either script load order', () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../atlas/engine.js'), 'utf8'), context);
  const session = context.SynkAtlas.createSession({ scope, clock: () => '2026-09-18T00:00:00Z' });
  const decision = session.plan('letter', modesFor('LAB'), { levers: levers() });
  const fields = { decisionId: decision.id, taskId: 'task', taskVersion: 'v1', itemKey: 'item', conceptIds: ['honorific'], firstExposure: true };
  assert.throws(() => session.practice('presented', fields), /Trail practice module unavailable/);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../atlas/trail.js'), 'utf8'), context);
  assert.equal(session.practice('presented', fields).type, 'practice.presented');
  context.SynkAtlasTrail = context.SynkTrail; delete context.SynkTrail;
  assert.equal(session.practice('practice.presented', fields).type, 'practice.presented');
});

test('content takes turns when nothing is known, and a due review may repeat', () => {
  const f = fixture();
  assert.deepEqual([f.round(), f.round(), f.round(), f.round()].map(d => pick(d, 'core.focus')), ['purpose', 'tone', 'clarity', 'purpose']);
  const g = fixture(); g.observe('due', 'honorific', 1, 8);
  assert.deepEqual([g.round(), g.round()].map(d => pick(d, 'core.focus')), ['tone', 'tone']);
});

test('the baseline share: a seeded part of the rounds ignores what was learned, never what was set, and says so', () => {
  let baseline = null, adapted = null;
  for (let i = 0; i < 60 && !(baseline && adapted); i += 1) {
    const f = fixture({ explore: 0.5, experienceId: `letter-${i}` });
    f.observe('due', 'letter.deadline', 1, 8); f.tick(); f.session.set('support', 'step');
    f.round('too_much');
    const second = f.plan();
    if (second.arm === 'baseline') baseline = baseline || { f, second }; else adapted = adapted || { f, second };
  }
  assert.ok(baseline && adapted, 'both arms occur');
  assert.equal(adapted.second.selected.pace, 'short'); assert.equal(pick(adapted.second, 'core.focus'), 'clarity');
  assert.equal(baseline.second.selected.pace, 'standard', 'the response is not used');
  assert.equal(pick(baseline.second, 'core.focus'), 'tone', 'the observation is not used: round 1 of the plain rotation is tone');
  assert.equal(baseline.second.bundle['core.focus'].basis, 'baseline');
  assert.equal(pick(baseline.second, 'vellum.checks'), 'step', 'a declared setting holds in both arms');
  assert.ok(baseline.second.reasons.includes('arm.baseline')); assert.equal(baseline.second.outcomeBasis, 'unobserved');
  assert.ok(!baseline.second.evidence.includes(baseline.f.session.lines().find(line => line.key === 'due:letter.deadline').evidence[0]), 'unused evidence is not cited');
  const recorded = baseline.f.session.events().findLast(event => event.type === 'decision.made');
  assert.equal(recorded.arm, 'baseline'); assert.equal(recorded.explore, 0.5); assert.equal(recorded.seed, baseline.second.seed); assert.equal(recorded.round, 1);
  for (let i = 0; i < 40; i += 1) {
    const f = fixture({ explore: 0.5, experienceId: `steady-${i}` }), arm = f.plan().arm;
    f.tick(); f.session.set('time', 'short'); f.tick(); f.session.set('goal', 'clarity');
    assert.equal(f.plan().arm, arm, 'changing settings inside a round does not flip the arm');
  }
  // The amount itself may aim at an observation; the baseline arm must not see it either.
  const aimed = modesFor('LAB').map(mode => (mode.id === 'brief' ? { ...mode, targets: ['trait:prefers.brief'] } : mode));
  const amounts = {};
  for (let i = 0; i < 60 && !(amounts.baseline && amounts.adapted); i += 1) {
    const f = fixture({ explore: 0.5, experienceId: `amount-${i}` });
    f.observe('trait', 'prefers.brief', 1, 8); f.tick(); f.session.set('goal', 'clarity'); f.tick();
    const decision = f.session.plan(`amount-${i}`, aimed);
    amounts[decision.arm] = amounts[decision.arm] || decision;
  }
  assert.equal(amounts.adapted.selected.id, 'brief'); assert.equal(amounts.adapted.bundle.mode.basis, 'line');
  assert.equal(amounts.baseline.selected.id, 'balanced'); assert.equal(amounts.baseline.bundle.mode.basis, 'baseline');
  let count = 0;
  for (let i = 0; i < 400; i += 1) if (fixture({ explore: 0.1, experienceId: `share-${i}` }).plan().arm === 'baseline') count += 1;
  assert.ok(count >= 20 && count <= 60, `about one round in ten is baseline (got ${count}/400)`);
  for (let i = 0; i < 50; i += 1) assert.equal(fixture({ experienceId: `share-${i}` }).plan().arm, 'adapted', 'no share unless an adapter asks for one');
});

test('a decision can be recomputed from its history: same events and time give the same arm, seed and bundle', () => {
  const f = fixture({ explore: 0.5 });
  f.observe('need', 'honorific', 0.9, 8); f.round('helpful');
  const before = f.plan();
  const again = A.decide({ events: JSON.parse(JSON.stringify(f.session.events())), scope, at: f.now(), experienceId: 'letter', candidates: modesFor('LAB'), levers: levers(), explore: 0.5 });
  for (const key of ['arm', 'seed', 'round', 'bundle', 'selected', 'reasons', 'evidence']) assert.deepEqual(again[key], before[key], key);
});

test('observations expire, and an expired latest observation does not revive an older one', () => {
  const f = fixture();
  f.observe('need', 'honorific', 0.9, 8, { until: '2027-01-01T00:00:00Z' });
  f.observe('need', 'honorific', 0.4, 8, { until: '2026-09-19T00:00:00Z' });
  f.days(2);
  assert.equal(f.session.lines().find(line => line.key === 'need:honorific'), undefined);
  assert.ok(f.session.state().expired.includes('need:honorific'));
  const g = fixture(); g.observe('trait', 'prefers.step', 1, 8); g.days(31);
  assert.equal(g.session.lines().some(line => line.source === 'observed'), false, 'an observation without an end date lasts 30 days');
});

test('"what I came to know about you": what the person said and what was observed are listed apart', () => {
  const f = fixture();
  f.tick(); f.session.set('goal', 'expression'); f.observe('need', 'honorific', 0.7, 5, { assisted: false });
  const lines = f.session.lines();
  assert.deepEqual(lines.map(line => [line.key, line.source, line.status]), [['declared:goal', 'declared', 'confirmed'], ['need:honorific', 'observed', 'unconfirmed']]);
  assert.equal(lines[1].sufficiency, 'fair'); assert.equal(lines[1].assisted, false);
});

test('PULSE keeps no personal observations and takes no baseline share', () => {
  const f = fixture({ domain: 'PULSE', explore: 0.5 });
  assert.throws(() => f.session.observe({ kind: 'trait', key: 'likes.night', strength: 1, n: 8 }), /PULSE/);
  const decision = f.plan();
  assert.throws(() => f.session.outcome(decision.id, { measure: 'returned', window: 'd1', value: 1 }), /PULSE/);
  assert.throws(() => f.session.respond('trait:likes.night', 'yes'), /PULSE/);
  assert.throws(() => f.session.practice('presented', { decisionId: decision.id, taskId: 'task', taskVersion: 'v1', itemKey: 'item', conceptIds: ['honorific'], firstExposure: true }), /PULSE/);
  for (let i = 0; i < 30; i += 1) { const d = fixture({ domain: 'PULSE', explore: 0.5, experienceId: `work-${i}` }).plan(); assert.equal(d.arm, 'adapted'); assert.equal(d.explore, 0); }
});

test('what an assessment means cannot be a lever; broken input is visible', () => {
  const f = fixture(), modes = modesFor('LAB'), bad = lever => () => f.session.plan('letter', modes, { levers: [lever] });
  assert.throws(bad({ id: 'grade', class: 'judgment', options: [{ id: 'pass' }] }), /lever/);
  assert.throws(bad({ id: 'core.focus', class: 'content', learn: true, default: 'a', options: [{ id: 'a' }] }), /lever/, 'content is never tried at random');
  assert.throws(bad({ id: 'vellum.checks', class: 'shape', learn: true, options: [{ id: 'a' }] }), /lever/, 'learning needs a declared starting point');
  assert.throws(bad({ id: 'mode', class: 'shape', options: [{ id: 'a' }] }), /lever/);
  assert.throws(bad({ id: 'x', class: 'shape', follows: 'mood', options: [{ id: 'a' }] }), /lever/);
  assert.throws(() => f.session.plan('letter', modes, { levers: [levers()[0], levers()[0]] }), /lever/);
  assert.throws(() => A.decide({ scope, at: f.now(), experienceId: 'letter', candidates: modes, explore: 0.9 }), /decision input/);
  assert.throws(() => f.session.observe({ kind: 'need', key: 'x', strength: 2, n: 1 }), /signal/);
  assert.throws(() => f.session.observe({ kind: 'mood', key: 'x', strength: 1, n: 1 }), /signal/);
  assert.throws(() => f.session.respond('need:x', 'maybe'), /estimate/);
  const decision = f.plan();
  assert.throws(() => f.session.outcome(decision.id, { measure: 'independent', window: 'immediate' }), /value or a reason/);
  assert.throws(() => f.session.outcome(decision.id, { measure: 'independent', window: 'immediate', value: 1, reason: 'no_sample' }), /value or a reason/);
  assert.throws(() => f.session.outcome('missing', { measure: 'independent', window: 'd1', value: 1 }), /prior decision/);
  const unavailable = f.session.plan('letter', modes, { levers: [{ id: 'reed.sound', class: 'shape', default: 'soft', options: [{ id: 'soft', requiresAudio: true }] }] });
  f.tick(); f.session.set('audio', 'off');
  const silent = f.session.plan('letter', modes, { levers: [{ id: 'reed.sound', class: 'shape', default: 'soft', options: [{ id: 'soft', requiresAudio: true }] }] });
  assert.equal(pick(unavailable, 'reed.sound'), 'soft'); assert.equal(pick(silent, 'reed.sound'), null); assert.equal(silent.bundle['reed.sound'].basis, 'unavailable');
  assert.equal(silent.status, 'ready', 'one blocked lever falls back to its adapter default, it does not block the experience');
});

test('the letter adapter: the reason shown is true to the decision, and the person sees sentences, never raw keys', () => {
  const X = require('../atlas/experiences.js');
  let at = Date.parse('2026-09-18T00:00:00Z'), n = 0;
  const open = (explore = 0, id = 'letter') => {
    const session = A.createSession({ scope, clock: () => new Date(at += 60000).toISOString(), id: () => `x${++n}`, explore });
    return { session, plan: () => session.plan(id, X.modesFor('LAB'), { levers: X.leversFor('LAB') }) };
  };
  const a = open();
  assert.equal(X.guidance(a.plan()).reason, '아래에서 연습 분량과 도움 방식을 바꿀 수 있습니다.', 'nothing known, nothing claimed');
  a.session.observe({ kind: 'need', key: 'letter.deadline', strength: 0.9, n: 8 });
  const aimed = X.guidance(a.plan());
  assert.equal(aimed.first, 'clarity'); assert.match(aimed.reason, /요청 기간이 빠진 적이 있었습니다\. 그래서 .*기간이 글에 드러나는지부터/);
  a.session.respond('need:letter.deadline', 'no');
  assert.equal(X.guidance(a.plan()).reasons.some(text => /요청 기간/.test(text)), false, 'a denied line is no longer given as a reason');
  for (let i = 0; i < 2; i += 1) { const d = a.plan(); a.session.feedback(a.session.complete(d).id, 'not_fit'); }
  assert.match(X.guidance(a.plan()).reasons.join(' '), /맞지 않았다는 답변이 있어 다른 방식으로/);
  let baseline = null;
  for (let i = 0; i < 60 && !baseline; i += 1) { const d = open(0.5, `base-${i}`).plan(); if (d.arm === 'baseline') baseline = d; }
  assert.match(X.guidance(baseline).reason, /기본 구성으로 진행합니다/, 'a baseline round says so');
  const b = open();
  b.session.set('goal', 'expression'); b.session.observe({ kind: 'need', key: 'honorific', strength: 0.7, n: 1 });
  b.session.observe({ kind: 'need', key: 'unlisted.raw-key', strength: 1, n: 8 });
  const card = X.aboutYou(b.session.lines());
  assert.deepEqual(card.map(item => [item.source, item.askable]), [['said', false], ['seen', true]], 'a key with no sentence is left out');
  assert.equal(card[0].text, '이번에 집중할 것: 정중한 표현'); assert.match(card[1].note, /확인 전에는 반영하지 않습니다/);
  assert.equal(JSON.stringify(card).includes('unlisted'), false);
  for (let i = 1; i <= 3; i += 1) {
    assert.equal(X.notice(b.session, 'prefers.one_check').n, i, 'a habit is counted from what is on record');
    assert.equal(X.aboutYou(b.session.lines()).find(item => item.key === 'trait:prefers.one_check').text, i < 3 ? '점검 항목을 하나씩 본 적이 있습니다.' : '점검 항목을 하나씩 보는 일이 많았습니다.', 'seen once or twice is not called often');
  }
  assert.equal(b.session.plan('letter', X.modesFor('LAB'), { levers: X.leversFor('LAB') }).support, 'step', 'three times is enough to act on, and it can still be denied');
  b.session.respond('trait:prefers.one_check', 'no');
  assert.equal(b.session.plan('letter', X.modesFor('LAB'), { levers: X.leversFor('LAB') }).support, 'choose');
  assert.throws(() => X.notice(b.session, 'is.lazy'), /Unknown letter habit/, 'only reviewed habits can be reported');
  for (const domain of ['SHIFT', 'PULSE', 'PATH']) assert.throws(() => X.leversFor(domain), /Only the LAB/);
});

test('standalone or connected: without a ready plan an engine keeps its own default; atlas-1 histories still load', () => {
  assert.equal(A.choice(null, 'loom.mood', 'calm'), 'calm');
  assert.equal(A.choice({ status: 'unavailable' }, 'loom.mood', 'calm'), 'calm');
  const f = fixture();
  assert.equal(A.choice(f.plan(), 'vellum.checks', 'x'), 'choose'); assert.equal(A.choice(f.plan(), 'loom.mood', 'calm'), 'calm');
  const at = '2026-09-17T00:00:00Z', base = { schema: 1, scope, at, recordedAt: at };
  const old = [
    { ...base, id: 'd1', type: 'decision.made', experienceId: 'letter', variant: 'balanced', policy: 'atlas-1.0.0', evidence: [], reasons: [], alternatives: ['brief', 'extended'], support: 'choose', focus: 'explore' },
    { ...base, id: 'c1', type: 'experience.completed', decisionId: 'd1', experienceId: 'letter', variant: 'balanced' },
    { ...base, id: 'f1', type: 'feedback.given', completionId: 'c1', value: 'want_more' },
  ];
  const session = A.createSession({ scope, events: old, clock: () => '2026-09-18T00:00:00Z' });
  const next = session.plan('letter', modesFor('LAB'), { levers: levers() });
  assert.equal(next.selected.pace, 'deep'); assert.equal(next.round, 1); assert.equal(next.version, 'atlas-2.3.0');
  assert.equal(A.validate({ ...old[0], policy: 'atlas-2.0.0' }).policy, 'atlas-2.0.0');
  assert.throws(() => A.validate({ ...old[0], policy: 'atlas-9' }), /decision record/);
});
