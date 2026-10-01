'use strict';
// Acceptance cases for the educational loop (Core diagnosis, Vellum help policy,
// Trail provenance, Temper counts). Synthetic only: no real learner effect is measured.
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../atlas/engine');
const Core = require('../atlas/education');
const Vellum = require('../atlas/vellum');
const Trail = require('../atlas/trail');
const Temper = require('../atlas/temper');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/ko.json'));
const TAG = '조사:처소(에·에서)';
const CONCEPT = 'skill-ko-grammar-particle-place';
const ORIGIN = Date.parse('2026-09-30T00:00:00Z');
const candidates = [{ id: 'standard', pace: 'standard', minutes: 5 }];
const baseTask = Object.freeze({ id: 'synthetic-place', version: 'reviewed.v1', itemKey: 'place.item.one',
  tags: [TAG], concepts: ['G207'], answers: ['에서'], explanation: '동작이 일어나는 장소에 쓰는 표현을 살펴보세요.' });
const assessment = verdict => ({ verdict, errorTags: verdict === 'incorrect' ? [TAG] : [] });
const assess = text => assessment(text === '에서' ? 'correct' : text === '에' ? 'incorrect' : 'unassessed');
const taskFor = fields => ({ ...baseTask, ...fields });
const diagnose = (verdict, fields = {}) => Core.diagnose({ map, task: taskFor(fields), assessment: assessment(verdict) });
const answerHelp = { id: 'review', level: 'answer', contentRef: 'answer:synthetic-place' };
const cueHelp = { id: 'stuck', level: 'cue', contentRef: 'cue:synthetic-place' };
function fixture({ scope: scopeExtra = {}, levers = [] } = {}) {
  let sequence = 0, now = ORIGIN;
  const scope = { domain: 'LAB', workspace: 'education-audit', subject: 'synthetic', ...scopeExtra };
  const session = A.createSession({ scope, clock: () => new Date(now += 1000).toISOString(), id: () => `audit.${++sequence}` });
  const plan = () => session.plan('documents', candidates, { levers });
  const practice = (fields = {}, firstExposure = true, decision = plan()) => Core.createPractice({ session, decision, map, task: taskFor(fields), assess, firstExposure });
  const summary = (extra = {}) => Trail.summarize(session.events(), { scope, asOf: new Date(now + 1000).toISOString(), ...extra });
  return { scope, session, plan, practice, summary, tick: milliseconds => { now += milliseconds; } };
}
const contentLevers = [{ id: 'core.focus', class: 'content', options: [
  { id: 'place', targets: [`need:skill.${CONCEPT}`] },
  { id: 'other', targets: ['need:skill.other'] },
] }];
function learningFixture() {
  const f = fixture({ levers: contentLevers });
  f.session.observe({ kind: 'need', key: `skill.${CONCEPT}`, strength: 0.9, n: 8, assisted: false });
  f.session.observe({ kind: 'need', key: 'skill.other', strength: 0.3, n: 8, assisted: false });
  const decision = f.plan();
  f.session.complete(decision);
  const practice = f.practice({}, true, decision);
  return { ...f, decision, practice };
}
function outcome(f, attemptId, overrides = {}) {
  return f.session.outcome(f.decision.id, { measure: 'independent', window: 'immediate', value: 1, assisted: false,
    attemptId, targetLine: `need:skill.${CONCEPT}`, ...overrides });
}

test('Core: only assessed errors on the measured axis are diagnosed; unknowns stay unassessed', () => {
  const known = diagnose('incorrect');
  assert.equal(known.diagnosis, 'observed-error');
  assert.deepEqual(known.errorTags, [TAG]);
  assert.deepEqual(known.conceptIds, ['G207', CONCEPT], 'the item node comes first, then the exact tag skill');
  assert.deepEqual(known.curriculum.map(c => c.label), ['에서', '조사 — 에·에서']);
  assert.equal(known.scope, 'this-item-only'); assert.equal(known.mastery, null);
  for (const verdict of ['unassessed', 'skipped']) {
    const unknown = Core.diagnose({ map, task: baseTask, assessment: { verdict, errorTags: [TAG] } });
    assert.equal(unknown.diagnosis, 'not-diagnosed'); assert.deepEqual(unknown.errorTags, []);
  }
  assert.equal(diagnose('correct').diagnosis, 'correct-on-this-item');
  const other = Core.diagnose({ map, task: baseTask, assessment: { verdict: 'incorrect', errorTags: ['높임:주체'] } });
  assert.equal(other.diagnosis, 'not-diagnosed'); assert.deepEqual(other.errorTags, []);
});

test('Core: missing links stay missing; an unknown curriculum node is an error, not a guess', () => {
  const result = Core.diagnose({ map, task: taskFor({ tags: ['어미:시제'], concepts: [] }), assessment: { verdict: 'incorrect', errorTags: ['어미:시제'] } });
  assert.equal(result.diagnosis, 'observed-error', 'observed error remains distinct from the missing map');
  assert.deepEqual(result.conceptIds, []); assert.deepEqual(result.curriculum, []);
  assert.deepEqual(result.missingTags, ['어미:시제']);
  assert.throws(() => diagnose('correct', { concepts: ['G999'] }), /unknown curriculum node/);
});

test('Vellum: the default review opens the answer; a chosen step starts with the cue; a correct item opens nothing', () => {
  for (const verdict of ['incorrect', 'skipped', 'unassessed']) assert.equal(Vellum.reviewOpen({ verdict, hasCue: true }), 'answer');
  for (const support of ['step', 'independent']) {
    assert.equal(Vellum.reviewOpen({ verdict: 'incorrect', support, hasCue: true }), 'cue');
    assert.equal(Vellum.reviewOpen({ verdict: 'skipped', support, hasCue: true }), 'cue');
    assert.equal(Vellum.reviewOpen({ verdict: 'unassessed', support, hasCue: true }), 'answer', 'an unassessed answer is shown the model form, not a hint');
    assert.equal(Vellum.reviewOpen({ verdict: 'incorrect', support, hasCue: false }), 'answer', 'no approved cue means the answer');
    assert.equal(Vellum.reviewOpen({ verdict: 'incorrect', support, hasCue: true, retried: true }), 'answer', 'a retry always ends with the answer');
  }
  for (const support of Vellum.SUPPORTS) assert.equal(Vellum.reviewOpen({ verdict: 'correct', support, hasCue: true }), null);
  assert.equal(Vellum.reviewOpen({ verdict: 'correct', unsure: true }), 'answer', 'a right guess the learner marked unsure shows the explanation');
  assert.throws(() => Vellum.reviewOpen({ verdict: 'maybe' }), /invalid/);
});

test('Vellum §8-5: a stuck learner is offered the cue once; declining or working alone suppresses it', () => {
  const stuck = { elapsedMs: Vellum.STUCK.afterMs, hasCue: true };
  assert.equal(Vellum.offerCue(stuck), true);
  assert.equal(Vellum.offerCue({ elapsedMs: 0, misses: Vellum.STUCK.misses, hasCue: true }), true);
  assert.equal(Vellum.offerCue({ elapsedMs: Vellum.STUCK.afterMs - 1, misses: Vellum.STUCK.misses - 1, hasCue: true }), false);
  assert.equal(Vellum.offerCue({ ...stuck, declined: true }), false, 'after one decline, no more offers this round');
  assert.equal(Vellum.offerCue({ ...stuck, offered: true }), false, 'at most one offer per item');
  assert.equal(Vellum.offerCue({ ...stuck, support: 'independent' }), false);
  assert.equal(Vellum.offerCue({ ...stuck, hasCue: false }), false);
  assert.equal(Vellum.offerCue({ elapsedMs: 5000, hasCue: true, stuck: { afterMs: 3000, misses: 1 } }), true, 'each game defines its own stuck');
});

test('help on screen is recorded once and survives preference changes and analytical exclusion', () => {
  const f = fixture(), p = f.practice();
  assert.equal(f.summary().help.length, 0, 'building help is not delivering it');
  const seen = p.delivered(answerHelp);
  assert.equal(p.delivered(answerHelp), null, 'the same help rendered again is one exposure');
  f.session.set('support', 'independent'); f.session.exclude(seen.id);
  p.submit('에서');
  const result = f.summary();
  assert.equal(result.help.length, 0, 'analytical exclusion hides the help count');
  assert.deepEqual(['assisted', 'exposure', 'independent'].map(k => result.attempts[0][k]), [true, 'repeat', false]);
});

test('a cue taken while stuck makes that first attempt assisted, not independent', () => {
  const f = fixture(), p = f.practice();
  p.delivered(cueHelp); p.submit('에서');
  const a = f.summary().attempts[0];
  assert.deepEqual([a.assisted, a.exposure, a.independent], [true, 'new', false]);
  assert.deepEqual(f.summary().help.map(h => [h.helpId, h.level, h.contentRef]), [['stuck', 'cue', 'cue:synthetic-place']]);
});

test('skip and repeated success are separated from new independent opportunities', () => {
  const f = fixture(), p = f.practice();
  p.submit('', { skipped: true });
  p.delivered(answerHelp);
  p.submit('에서');
  const q = f.practice({ itemKey: 'place.item.two' }); q.submit('에서');
  const result = f.summary(), measured = Temper.measure(result);
  assert.deepEqual(result.attempts.map(a => [a.verdict, a.independent]), [['skipped', false], ['correct', false], ['correct', true]]);
  assert.equal(measured.independent.evaluated, 1); assert.equal(measured.independent.correct, 1);
  assert.equal(measured.skipped, 1); assert.equal(measured.repeat, 1); assert.equal(measured.assisted, 1);
  assert.deepEqual(measured.byConcept.G207, { evaluated: 1, correct: 1, incorrect: 0, accuracy: 1 });
});

test('seen-before or unknown history never expands the independent denominator', () => {
  for (const firstExposure of [false, null]) {
    const f = fixture(), p = f.practice({}, firstExposure); p.submit('에서');
    const s = f.summary(), result = Temper.measure(s);
    assert.equal(s.attempts[0].independent, false);
    assert.equal(result.independent.evaluated, 0); assert.equal(result.independent.accuracy, null);
    assert.equal(result.status, 'no_sample');
  }
});

test('response text is consumed by the grader and absent from the shared session log', () => {
  const f = fixture(), p = f.practice();
  const raw = 'SYNTHETIC_PRIVATE_RESPONSE_6fc036';
  p.submit(raw);
  assert.equal(JSON.stringify(f.session.events()).includes(raw), false);
  assert.equal(f.summary().attempts[0].verdict, 'unassessed');
  const event = f.session.events().find(e => e.type === 'practice.attempted');
  assert.throws(() => A.append(f.session.events(), { ...event, id: 'new.raw', answerText: raw }), /field/);
});

test('a failed attempt or help write leaves the record incomplete; later answers are not relabelled', () => {
  for (const failing of ['attempted', 'helped']) {
    const f = fixture(), decision = f.plan();
    let calls = 0;
    const recovering = { ...f.session, practice(kind, fields) {
      if (kind === failing && ++calls === 1) throw new Error('synthetic write failure');
      return f.session.practice(kind, fields);
    } };
    const p = Core.createPractice({ session: recovering, decision, map, task: baseTask, assess, firstExposure: true });
    if (failing === 'attempted') assert.throws(() => p.submit('에'), /write failure/);
    else { assert.throws(() => p.delivered(answerHelp), /write failure/); p.delivered(answerHelp); }
    assert.throws(() => p.submit('에서'), /record incomplete/);
    assert.equal(f.summary().attempts.length, 0);
  }
});

test('an exact replay counts once; a conflicting replay cannot rewrite a first answer', () => {
  const f = fixture(), p = f.practice(); p.submit('에');
  const original = f.session.events(), attempt = original.find(e => e.type === 'practice.attempted');
  assert.equal(A.append(original, attempt).length, original.length);
  assert.equal(Trail.summarize([...original, attempt], { scope: f.scope, asOf: '2026-10-01T00:00:00Z' }).attempts.length, 1);
  assert.throws(() => A.append(original, { ...attempt, verdict: 'correct' }), /conflicting/);
});

test('unknown assistance, satisfaction and a proofless claimed success cannot reduce content need', () => {
  for (const result of [
    { measure: 'independent', window: 'immediate', value: 1, assisted: null },
    { measure: 'independent', window: 'immediate', value: 1 },
    { measure: 'satisfaction', window: 'immediate', value: 1, assisted: false },
    { measure: 'independent', window: 'immediate', value: 1, assisted: false },
  ]) {
    const f = learningFixture();
    f.session.outcome(f.decision.id, result);
    const next = f.plan();
    assert.equal(next.bundle['core.focus'].option, 'place'); assert.equal(next.outcomeBasis, 'unobserved');
  }
});

test('a linked first-exposure unassisted success really reduces the matching need', () => {
  const f = learningFixture(), result = f.practice.submit('에서');
  const proof = outcome(f, result.eventId), next = f.plan();
  assert.equal(next.bundle['core.focus'].option, 'other');
  assert.equal(next.outcomeBasis, 'performance');
  for (const id of [result.eventId, proof.id, f.practice.presentation.id]) assert.ok(next.evidence.includes(id));
});

test('evidence from another concept, decision, retry or a seen item cannot improve this target', () => {
  const f = learningFixture();
  const p = Core.createPractice({ session: f.session, decision: f.decision, map,
    task: taskFor({ itemKey: 'honorific.item', tags: ['높임:주체'], concepts: [] }), assess, firstExposure: true });
  outcome(f, p.submit('에서').eventId);
  assert.equal(f.plan().outcomeBasis, 'unobserved');
  const g = learningFixture(), otherDecision = g.plan();
  const q = Core.createPractice({ session: g.session, decision: otherDecision, map, task: baseTask, assess, firstExposure: true });
  outcome(g, q.submit('에서').eventId);
  assert.equal(g.plan().outcomeBasis, 'unobserved');
  const h = learningFixture(); h.practice.submit('에'); outcome(h, h.practice.submit('에서').eventId);
  assert.equal(h.plan().outcomeBasis, 'unobserved');
  assert.equal(h.summary().attempts[1].exposure, 'repeat');
  const k = learningFixture();
  const seen = Core.createPractice({ session: k.session, decision: k.decision, map, task: taskFor({ itemKey: 'seen.item' }), assess, firstExposure: false });
  outcome(k, seen.submit('에서').eventId);
  assert.equal(k.plan().outcomeBasis, 'unobserved');
});

test('a late report of an old successful attempt cannot cancel a newer error observation', () => {
  const f = learningFixture(), earlier = f.practice.submit('에서');
  f.tick(60000);
  f.session.observe({ kind: 'need', key: `skill.${CONCEPT}`, strength: 1, n: 9, assisted: false });
  outcome(f, earlier.eventId);
  assert.equal(f.plan().outcomeBasis, 'unobserved', 'performance predates the new need; arrival time cannot make it new evidence');
});

test('denied or expired observations stop steering the current recommendation', () => {
  const f = learningFixture();
  f.session.respond(`need:skill.${CONCEPT}`, 'no');
  assert.equal(f.plan().bundle['core.focus'].option, 'other');
  f.tick(31 * 86400000);
  assert.equal(f.session.lines().some(line => line.key === `need:skill.${CONCEPT}`), false);
});

test('cross-account practice linkage and personal practice in PULSE are rejected', () => {
  const f = fixture(), p = f.practice(); p.submit('에서');
  const log = f.session.events(), attempt = log.find(e => e.type === 'practice.attempted');
  assert.throws(() => A.append(log, { ...attempt, id: 'foreign.attempt', attemptNo: 2,
    scope: { ...f.scope, subject: 'another-synthetic' } }), /scope/);
  const pulse = fixture({ scope: { domain: 'PULSE' } });
  assert.throws(() => pulse.practice(), /PULSE/);
});

test('future and late-recorded attempts do not contaminate historical summaries', () => {
  const f = fixture(), p = f.practice(); const attempt = p.submit('에서');
  assert.equal(f.summary({ asOf: p.presentation.at }).attempts.length, 0);
  const log = f.session.events().map(e => e.id === attempt.eventId ? { ...e, recordedAt: '2026-10-02T00:00:00Z' } : e);
  const s = Trail.summarize(log, { scope: f.scope, asOf: '2026-10-03T00:00:00Z', recordedAsOf: '2026-10-01T00:00:00Z' });
  assert.equal(s.attempts.length, 0);
});

test('growth reads an earlier wrong first attempt against today\'s first-exposure success on the same node', () => {
  const f = fixture(), p = f.practice({ itemKey: 'place.item.two' }); p.submit('에서');
  const history = Trail.openHistory({ records: [{ itemKey: 'place.item.one', conceptIds: ['G207', CONCEPT], at: '2026-09-20T00:00:00Z', verdict: 'incorrect' }], partial: false });
  const facts = Trail.growth(f.summary(), history);
  assert.equal(facts.length, 1); assert.equal(facts[0].conceptId, 'G207');
  assert.equal(map.getNode(facts[0].conceptId).label_ko, '에서');
});

test('help that is on screen but cannot be recorded leaves the record incomplete', () => {
  for (const bad of [null, { ...answerHelp, level: 'hint' }, { ...answerHelp, contentRef: undefined }, { ...answerHelp, id: 'stuck cue' }]) {
    const f = fixture(), p = f.practice();
    assert.throws(() => p.delivered(bad));
    assert.throws(() => p.submit('에서'), /record incomplete/, 'a helped answer is never counted as independent');
    assert.equal(f.summary().attempts.length, 0);
  }
});

test('a grader that repeats an error tag still records the attempt once, with one tag', () => {
  const f = fixture(), p = Core.createPractice({ session: f.session, decision: f.plan(), map, task: baseTask, firstExposure: true,
    assess: () => ({ verdict: 'incorrect', errorTags: [TAG, TAG] }) });
  assert.deepEqual(p.submit('에').errorTags, [TAG]);
  assert.deepEqual(f.summary().attempts[0].errorTags, [TAG]);
});

test('met() gives the record to keep as soon as the item was answered or its answer shown', () => {
  const f = fixture(), p = f.practice();
  assert.equal(p.met(), null, 'showing a question is not meeting it');
  p.delivered(cueHelp); assert.equal(p.met(), null, 'a cue does not reveal the answer');
  const first = p.submit('에'); p.submit('에서');
  assert.deepEqual(p.met(), { itemKey: 'place.item.one', conceptIds: ['G207', CONCEPT], at: f.session.events().find(e => e.id === first.eventId).at, verdict: 'incorrect' });
  const q = f.practice({ itemKey: 'place.item.two' }); q.delivered(answerHelp);
  assert.equal(q.met().verdict, null, 'met at the reveal, before any attempt');
  const stored = Trail.remember(Trail.openHistory({ records: [], partial: false }, [p.met(), q.met()]), f.summary());
  assert.deepEqual(stored.records.map(r => [r.itemKey, r.verdict]), [['place.item.one', 'incorrect'], ['place.item.two', null]]);
});
