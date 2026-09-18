'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../atlas/engine.js');
const { modesFor } = require('../atlas/experiences.js');
const scope = { domain: 'LAB', workspace: 'game', subject: 'synthetic' };
function fixture(domain = 'LAB') {
  let at = '2026-09-18T00:00:00Z', n = 0;
  const session = A.createSession({ scope: { ...scope, domain }, clock: () => at, id: () => `e${++n}` });
  return { session, advance: value => { at = value; }, plan: () => session.plan('synthetic-experience', modesFor('LAB')) };
}
test('new declarations change actual choice, expired temporary context does not revive old context', () => {
  const f = fixture();
  assert.equal(f.plan().selected.pace, 'standard');
  f.session.set('time', 'unlimited');
  f.session.set('time', 'short', '2026-09-19T00:00:00Z');
  assert.equal(f.plan().selected.pace, 'short');
  f.advance('2026-09-20T00:00:00Z');
  assert.equal(f.session.state().context.time, undefined);
  assert.equal(f.plan().selected.pace, 'standard');
});
test('completion -> explicit feedback -> next decision changes; no skill claim', () => {
  const f = fixture(), first = f.plan(), completed = f.session.complete(first);
  f.session.feedback(completed.id, 'too_much');
  const next = f.plan();
  assert.equal(next.selected.pace, 'short');
  assert.ok(next.evidence.includes(completed.id));
  assert.equal(next.outcomeBasis, 'self_report');
  assert.equal(next.skill, undefined);
  assert.equal(f.session.complete(first).id, completed.id);
});
test('correcting feedback and excluding evidence affects next decisions without deleting original', () => {
  const f = fixture(), completed = f.session.complete(f.plan());
  f.session.feedback(completed.id, 'too_much');
  const corrected = f.session.feedback(completed.id, 'want_more');
  assert.equal(f.plan().selected.pace, 'deep');
  f.session.exclude(corrected.id);
  assert.equal(f.plan().selected.pace, 'standard');
  f.session.exclude(completed.id);
  assert.equal(f.plan().selected.pace, 'standard');
  assert.ok(f.session.events().some(e => e.id === corrected.id));
});
test('explicit time limits take precedence over outcome preference; unavailable is not fake fallback', () => {
  const f = fixture(), completed = f.session.complete(f.plan());
  f.session.feedback(completed.id, 'want_more');
  f.session.set('time', 'short');
  assert.equal(f.plan().selected.pace, 'short');
  f.session.set('audio', 'off');
  const result = f.session.plan('speech', [{ id: 'voice', minutes: 4, pace: 'short', requiresAudio: true }]);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.selected, null);
});
test('as-of and recorded-as-of exclude late and future evidence', () => {
  const event = { schema: 1, id: 'late', scope, type: 'context.set', field: 'time', value: 'short', at: '2026-09-18T00:00:00Z', recordedAt: '2026-09-20T00:00:00Z' };
  assert.deepEqual(A.understand([event], scope, '2026-09-19T00:00:00Z').context, {});
  assert.equal(A.understand([event], scope, '2026-09-19T00:00:00Z', '2026-09-21T00:00:00Z').context.time, 'short');
});
test('subject, workspace and domain isolation; explicit PULSE context but no personal outcome inference', () => {
  const f = fixture(); f.session.set('time', 'short');
  for (const other of [{ ...scope, subject: 'other' }, { ...scope, workspace: 'other' }, { ...scope, domain: 'PATH' }]) {
    assert.deepEqual(A.understand(f.session.events(), other, '2026-09-19T00:00:00Z').context, {});
    assert.throws(() => A.createSession({ scope: other, events: f.session.events() }), /scope/);
  }
  const pulse = fixture('PULSE'), done = pulse.session.complete(pulse.plan());
  pulse.session.feedback(done.id, 'too_much');
  assert.equal(pulse.plan().selected.pace, 'standard');
  pulse.session.set('time', 'short');
  assert.equal(pulse.plan().selected.pace, 'short');
});
test('feedback cannot be fabricated without a completed decision or attached across scopes', () => {
  const f = fixture();
  assert.throws(() => f.session.feedback('missing', 'helpful'), /prior completion/);
  assert.throws(() => f.session.complete({ status: 'ready', id: 'fake', scope, experienceId: 'letter', selected: { id: 'balanced' } }), /delivered decision/);
  assert.throws(() => f.session.set('__proto__', 'x'), /context/);
});
test('history roundtrip reproduces a decision; domain isolation uses synthetic inputs, not product adapters', () => {
  for (const domain of ['LAB', 'SHIFT', 'PULSE', 'PATH']) {
    const f = fixture(domain); f.session.set('goal', 'expression'); f.session.set('time', 'short');
    const before = f.plan();
    const replay = A.createSession({ scope: { ...scope, domain }, events: JSON.parse(JSON.stringify(f.session.events())), clock: () => '2026-09-18T00:00:00Z' });
    const after = replay.plan('synthetic-experience', modesFor('LAB'));
    assert.deepEqual(after.selected, before.selected);
    assert.deepEqual(after.evidence, before.evidence);
    assert.deepEqual(after.reasons, before.reasons);
  }
});
test('the LAB experience adapter cannot be silently reused as a SHIFT, PULSE or PATH product', () => {
  for (const domain of ['SHIFT', 'PULSE', 'PATH']) assert.throws(() => modesFor(domain), /Only the LAB/);
});
test('repeated IDs are idempotent, conflicts and broken input are visible', () => {
  const f = fixture(), event = f.session.set('support', 'step');
  assert.deepEqual(A.append([event], event), [event]);
  assert.throws(() => A.append([event], { ...event, value: 'independent' }), /conflicting/);
  assert.throws(() => A.understand([{ ...event, at: 'yesterday' }], scope, '2026-09-20T00:00:00Z'), /invalid time/);
});
test('feedback becomes unknown after its window, zero feedback is not negative feedback', () => {
  const f = fixture(); const done = f.session.complete(f.plan()); f.session.feedback(done.id, 'too_much');
  f.advance('2026-11-01T00:00:00Z');
  const decision = f.plan();
  assert.equal(decision.selected.pace, 'standard'); assert.equal(decision.outcomeBasis, 'unobserved');
});
test('same-millisecond corrections follow append order, never random ID lexical order', () => {
  let n=0;const ids=['z-last-lexically','a-first-lexically'];
  const s=A.createSession({scope,clock:()=> '2026-09-18T00:00:00Z',id:()=>ids[n++]});
  s.set('time','short');s.set('time','standard');assert.equal(s.state().context.time,'standard');
});
