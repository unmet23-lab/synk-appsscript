'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const A = require('../atlas/engine');
const scope = { domain: 'LAB', workspace: 'integrity', subject: 'synthetic' };
const at = '2026-10-29T00:00:00.000Z';
const candidates = [{ id: 'goal', minutes: 5, pace: 'standard', goals: ['study'] }, { id: 'other', minutes: 4, pace: 'short' }];
const levers = [{ id: 'shape', class: 'shape', default: 'a', learn: true, options: [{ id: 'a' }, { id: 'b' }] }];
function session(events = [], prefix = 'a', explore = 0) { let n = 0; return A.createSession({ scope, events, clock: () => at, id: () => `${prefix}.${++n}`, explore }); }
test('a refused way stays refused after helpful feedback on another feasible way', () => {
  const s = session(); s.set('goal', 'study');
  const first = s.plan('entry', candidates); assert.equal(first.selected.id, 'goal');
  s.feedback(s.complete(first).id, 'not_fit');
  const second = s.plan('entry', candidates); assert.equal(second.selected.id, 'other');
  s.feedback(s.complete(second).id, 'helpful');
  const third = s.plan('entry', candidates); assert.equal(third.selected.id, 'other'); assert.ok(third.reasons.includes('feedback.alternative'));
});
test('latest feedback wins across completion aliases and excluding it or its completion never revives an older vote', () => {
  let tick = 0, n = 0; const make = (events, prefix) => A.createSession({ scope, events, clock: () => new Date(Date.parse(at) + tick).toISOString(), id: () => `${prefix}.${++n}` });
  const a = make([], 'a'), p = a.plan('entry', candidates), b = make(a.events(), 'b');
  tick = 1000; const ca = a.complete(p); tick = 2000; a.feedback(ca.id, 'helpful');
  tick = 3000; const cb = b.complete(p); tick = 4000; const fb = b.feedback(cb.id, 'not_fit');
  for (const first of [a, b]) {
    const second = first === a ? b : a, merged = [...first.events(), ...second.events().filter(e => !first.events().some(x => x.id === e.id))];
    assert.equal(make(merged, 'read').state().feedback[0].id, fb.id);
    for (const target of [fb.id, cb.id]) { const s = make(merged, 'excluded'); tick = 5000; s.exclude(target); assert.deepEqual(s.state().feedback, []); assert.equal(s.state().rounds.entry, 1); }
  }
});
test('prototype-shaped lever IDs survive declared, unavailable and baseline branches', () => {
  for (const kind of ['declared', 'unavailable']) {
    const s = session(); s.set(kind === 'declared' ? 'support' : 'audio', kind === 'declared' ? 'step' : 'off');
    const lever = kind === 'declared' ? { id: '__proto__', class: 'shape', follows: 'support', options: [{ id: 'step' }] } : { id: '__proto__', class: 'content', options: [{ id: 'audio', requiresAudio: true }] };
    const p = s.plan('entry', candidates, { levers: [lever] }); assert.equal(p.bundle.__proto__.basis, kind); assert.equal(Object.hasOwn(p.bundle, '__proto__'), true);
  }
  const lever = { id: '__proto__', class: 'content', options: [{ id: 'first' }, { id: 'second' }] };
  const experienceId = Array.from({ length: 100 }, (_, i) => 'baseline.' + i).find(experienceId => A.decide({ scope, at, experienceId, candidates, levers: [lever], explore: 0.5 }).arm === 'baseline');
  assert.ok(experienceId); const p = session([], 'base', 0.5).plan(experienceId, candidates, { levers: [lever] }); assert.equal(p.arm, 'baseline'); assert.equal(p.bundle.__proto__.basis, 'baseline'); assert.equal(Object.hasOwn(p.bundle, '__proto__'), true);
});
test('two devices completing one decision retain both raw records but one round and preference vote', () => {
  const a = session(), plan = a.plan('entry', candidates, { levers });
  const b = session(a.events(), 'b'), doneA = a.complete(plan), doneB = b.complete(plan);
  a.feedback(doneA.id, 'helpful'); b.feedback(doneB.id, 'not_fit');
  const merged = [...a.events(), ...b.events().filter(e => !a.events().some(x => x.id === e.id))];
  const s = session(merged, 'merged');
  assert.equal(s.events().filter(e => e.type === 'experience.completed').length, 2);
  assert.equal(s.state().rounds.entry, 1); assert.equal(s.state().feedback.length, 1);
  assert.equal(s.state().feedback[0].completionId, doneB.id);
  const next = s.plan('entry', candidates, { levers }); assert.equal(next.round, 1);
  assert.deepEqual(next.bundle.shape.evidence, [b.events().at(-1).id, doneB.id]);
});
test('valid prototype-shaped experience and lever IDs are ordinary own JSON fields', () => {
  for (const experienceId of ['constructor', '__proto__', 'toString']) {
    for (const explore of [0, 0.5]) {
      const s = session([], 'key', explore);
      const lever = { id: '__proto__', class: 'content', options: [{ id: 'first' }, { id: 'second' }] };
      const p = s.plan(experienceId, candidates, { levers: [lever] });
      assert.equal(p.round, 0); assert.equal(Object.hasOwn(p.bundle, '__proto__'), true);
      assert.ok(['first', 'second'].includes(p.bundle.__proto__.option));
      assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(p.bundle)), '__proto__'), true);
      s.complete(p); assert.equal(s.state().rounds[experienceId], 1);
      assert.equal(Object.hasOwn(s.state().rounds, experienceId), true);
    }
  }
  assert.equal(Object.prototype.option, undefined);
});
