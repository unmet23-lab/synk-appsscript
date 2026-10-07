'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../atlas/engine');
const Trail = require('../atlas/trail');
const WINDOW = 30 * 24 * 60 * 60 * 1000;
const scope = { domain: 'LAB', workspace: 'boundary-proof', subject: 'synthetic' };

function fixture({ assisted = false, firstExposure = true, verdict = 'correct', concept = 'ko.reading.detail', value = 1 } = {}) {
  let clock = Date.parse('2026-10-06T00:00:00.000Z'), serial = 0;
  const tick = () => new Date(clock += 1000).toISOString();
  const session = Core.createSession({ scope, clock: tick, id: () => `boundary.${++serial}` });
  const need = session.observe({ kind: 'need', key: 'skill.ko.reading.detail', strength: 0.9, n: 8 });
  const candidates = [{ id: 'standard', minutes: 3, pace: 'standard' }];
  const levers = [{ id: 'focus', class: 'content', options: [{ id: 'detail', targets: ['need:skill.ko.reading.detail'] }] }];
  const decision = session.plan('reading', candidates, { levers });
  const presented = session.practice('presented', { decisionId: decision.id, taskId: 'read', taskVersion: 'v1',
    itemKey: 'read.new', conceptIds: [concept], firstExposure });
  if (assisted) session.practice('helped', { presentationId: presented.id, helpId: 'hint', level: 'cue', contentRef: 'hint.v1' });
  const attempt = session.practice('attempted', { presentationId: presented.id, attemptNo: 1, verdict, errorTags: [] });
  session.complete(decision);
  const outcome = session.outcome(decision.id, { measure: 'independent', window: 'immediate', value,
    assisted, attemptId: attempt.id, targetLine: 'need:skill.ko.reading.detail' });
  const query = { targetLine: outcome.targetLine, since: need.at, maxAgeMs: WINDOW };
  const summary = () => Trail.summarize(session.events(), { scope, asOf: tick() });
  return { session, outcome, query, presented, attempt, summary, plan: () => session.plan('reading', candidates, { levers }) };
}

test('Trail qualifies educational evidence; Core retains the score threshold and decision policy', () => {
  const f = fixture();
  const proof = Trail.createPracticeOutcomeIndex(f.summary()).find(f.outcome, f.query);
  assert.deepEqual(proof, { evidence: [f.outcome.id, f.attempt.id, f.presented.id] });
  const plan = f.plan();
  assert.equal(plan.outcomeBasis, 'performance');
  assert.ok(proof.evidence.every(id => plan.evidence.includes(id)));
  const low = fixture({ value: 0.2 });
  assert.ok(Trail.createPracticeOutcomeIndex(low.summary()).find(low.outcome, low.query), 'qualification does not own a policy score threshold');
  assert.notEqual(low.plan().outcomeBasis, 'performance', 'Core owns its legacy threshold');
});

test('help, seen items, incorrect answers and another concept cannot prove independent success', () => {
  for (const options of [{ assisted: true }, { firstExposure: false }, { verdict: 'incorrect' }, { concept: 'ko.listening.detail' }]) {
    const f = fixture(options);
    assert.equal(Trail.createPracticeOutcomeIndex(f.summary()).find(f.outcome, f.query), null, JSON.stringify(options));
    assert.notEqual(f.plan().outcomeBasis, 'performance', JSON.stringify(options));
  }
});

test('exclusion removes analytical proof while retaining the item exposure and original records', () => {
  const f = fixture();
  const before = f.summary();
  f.session.exclude(f.attempt.id);
  const after = f.summary();
  assert.ok(Trail.createPracticeOutcomeIndex(before).find(f.outcome, f.query));
  assert.equal(Trail.createPracticeOutcomeIndex(after).find(f.outcome, f.query), null);
  assert.equal(after.met.length, before.met.length);
  assert.ok(f.session.events().some(event => event.id === f.attempt.id));
  assert.notEqual(f.plan().outcomeBasis, 'performance');
});

test('a qualified snapshot rejects another owner and cannot borrow a mismatched decision or target', () => {
  const f = fixture(), index = Trail.createPracticeOutcomeIndex(f.summary());
  for (const foreign of [{ subject: 'other' }, { workspace: 'another-company' }, { domain: 'SHIFT' }]) {
    assert.throws(() => index.find({ ...f.outcome, scope: { ...scope, ...foreign } }, f.query), /outcome query/);
  }
  assert.equal(index.find({ ...f.outcome, decisionId: 'other-decision' }, f.query), null);
  assert.equal(index.find(f.outcome, { ...f.query, targetLine: 'need:skill.ko.listening.detail' }), null);
  assert.equal(index.find(f.outcome, { ...f.query, targetLine: `need:${'a'.repeat(120)}` }), null, 'long legal observation keys do not break unrelated plans');
});

test('evidence obeys both occurrence and recording cutoffs and the current observation window', () => {
  const f = fixture(), summary = f.summary(), index = Trail.createPracticeOutcomeIndex(summary);
  const future = new Date(Date.parse(summary.asOf) + 1000).toISOString();
  assert.equal(index.find({ ...f.outcome, at: future, recordedAt: future }, f.query), null);
  assert.equal(index.find({ ...f.outcome, recordedAt: future }, f.query), null);
  assert.equal(index.find(f.outcome, { ...f.query, since: future }), null);
  assert.equal(index.find(f.outcome, { ...f.query, maxAgeMs: 0 }), null);
  assert.equal(index.find({ ...f.outcome, recordedAt: f.presented.recordedAt }, f.query), null);
  assert.throws(() => index.find(f.outcome, { ...f.query, maxAgeMs: -1 }), /outcome query/);
});

test('later mutation of a summary or returned proof cannot change the captured evidence', () => {
  const f = fixture(), summary = f.summary(), index = Trail.createPracticeOutcomeIndex(summary);
  const expected = index.find(f.outcome, f.query);
  summary.attempts[0].conceptIds.length = 0;
  summary.attempts[0].eventId = 'different';
  summary.scope.subject = 'other';
  index.find(f.outcome, f.query).evidence.length = 0;
  assert.deepEqual(index.find(f.outcome, f.query), expected);
});

test('duplicate or out-of-window summary evidence is rejected before it can affect a decision', () => {
  const f = fixture(), summary = f.summary();
  assert.throws(() => Trail.createPracticeOutcomeIndex({ ...summary, attempts: [...summary.attempts, summary.attempts[0]] }), /evidence/);
  assert.throws(() => Trail.createPracticeOutcomeIndex({ ...summary, asOf: f.presented.at }), /outside summary/);
});
