'use strict';
// Fixes from the 2026-10-02 engine review. Each case failed before its fix.
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../atlas/engine');
const P = require('../atlas/personalization');
const Life = require('../atlas/trail-life');
const Work = require('../atlas/work');
const { learningReason } = require('../atlas/vellum');

test('learner-facing reasons pick 은/을 after a final consonant and 는/를 after a vowel', () => {
  assert.equal(learningReason({ status: 'checking', label: '어휘 — 반대말' }), '어휘 — 반대말을 조금 더 확인해 봐요.');
  assert.equal(learningReason({ status: 'unseen', label: '어휘 — 반대말' }), '어휘 — 반대말은 아직 기록이 적어요. 짧게 확인해 봐요.');
  assert.equal(learningReason({ status: 'unseen', label: '낱말 듣기' }), '낱말 듣기는 아직 기록이 적어요. 짧게 확인해 봐요.');
  assert.equal(learningReason({ status: 'review', label: '어휘 — 동사 짝(입다·신다)' }), '어휘 — 동사 짝(입다·신다)를 다시 살펴볼 때예요.');
  assert.equal(learningReason({ status: 'practice', label: '조사 — 은/는·이/가' }), '최근 놓친 조사 — 은/는·이/가를 조금 더 연습해 봐요.');
});

test('"not for me" keeps every refused way out while an unrefused one remains', () => {
  const scope = { personId: 'person-1', productId: 'world', contextId: 'home', domain: 'LAB' };
  const at = '2026-10-02T00:00:00.000Z';
  const profile = P.updateProfile(P.createProfile({ scope, at }), { consent: true, values: { goal: 'study' } }, at);
  const options = [
    { id: 'group-evidence', minutes: 20, pace: 'standard', goals: ['prepare'] },
    { id: 'individual-practice', minutes: 20, pace: 'standard', goals: ['study'] },
    { id: 'explain-together', minutes: 20, pace: 'standard', goals: ['clarity'] },
  ];
  let events = [];
  const seen = [];
  for (let round = 0; round < 3; round += 1) {
    const r = P.selectPersonalization({ profile, scope, candidates: options, experienceId: 'entry', events, at });
    seen.push(r.plan.selected.id);
    events = P.recordCompletion({ profile, scope, events: r.events, decisionId: r.plan.id, at });
    const done = events.find(e => e.type === 'experience.completed' && e.decisionId === r.plan.id);
    events = P.recordFeedback({ profile, scope, events, completionId: done.id, value: 'not_fit', at });
  }
  assert.equal(new Set(seen).size, 3, `each refusal moved to a way not refused yet: ${seen.join(' -> ')}`);
});

test('the most recent response decides, even when it changes an older round', () => {
  const scope = { domain: 'LAB', workspace: 'w', subject: 's' };
  let t = Date.parse('2026-10-02T00:00:00.000Z');
  const s = Core.createSession({ scope, clock: () => new Date(t += 1000).toISOString() });
  s.set('goal', 'study');
  const c = [{ id: 'a', minutes: 5, pace: 'standard', goals: ['study'] }, { id: 'b', minutes: 5, pace: 'standard' }];
  const first = s.complete(s.plan('x', c)); s.feedback(first.id, 'helpful');
  const second = s.complete(s.plan('x', c)); s.feedback(second.id, 'helpful');
  s.feedback(first.id, 'not_fit');
  const next = s.plan('x', c);
  assert.equal(next.selected.id, 'b');
  assert.ok(next.reasons.includes('feedback.not_fit'));
  assert.equal(s.state().feedback.at(-1).value, 'not_fit', 'state lists responses in the order they were last given');
});

test('a long chain of shared causes is checked in linear time', () => {
  const scope = { domain: 'LAB', workspace: 'synk-town', subject: 'p1' };
  const log = [{ schema: 1, id: 'other', scope, seq: 1, type: 'life.fact', factType: 'x', causes: [], revisions: {}, knownBy: ['npc.a'] }];
  for (let i = 0; i < 200; i += 1) log.push({ schema: 1, id: `f${i}`, scope, seq: i + 2, type: 'life.fact', factType: 'x',
    causes: i === 0 ? [] : i === 1 ? ['f0'] : [`f${i - 1}`, `f${i - 2}`], revisions: {}, knownBy: ['npc.a'] });
  const start = Date.now();
  assert.throws(() => Life.append(log, { schema: 1, id: 'k', scope, seq: 202, type: 'life.knowledge', factId: 'other', npcId: 'npc.a', allowed: true, viaId: 'f199' }),
    /witnessed source/);
  assert.ok(Date.now() - start < 1000, 'a 200-fact chain no longer takes exponential time');
});

test('what an NPC saw for itself survives a correction of a relayed message', () => {
  const scope = { domain: 'LAB', workspace: 'synk-town', subject: 'p1' };
  let log = [], n = 0;
  const add = (type, fields) => { n += 1; log = Life.append(log, { schema: 1, id: `e${n}`, scope, seq: n, type, ...fields }); };
  add('life.fact', { factType: 'object.placed', causes: [], revisions: {}, knownBy: ['npc.a'] });
  add('life.fact', { factType: 'message.delivered', causes: ['e1'], revisions: {}, knownBy: ['npc.a'] });
  add('life.knowledge', { factId: 'e1', npcId: 'npc.a', allowed: true, viaId: 'e2' });
  add('life.corrected', { targetId: 'e2' });
  assert.deepEqual(Life.summarize(log, { scope }).knowledge['npc.a'], ['e1']);
  add('life.knowledge', { factId: 'e1', npcId: 'npc.a', allowed: false, viaId: null });
  assert.deepEqual(Life.summarize(log, { scope }).knowledge['npc.a'] || [], [], 'an explicit retraction still wins');
});

test('stored work cards are checked like new ones and only reviewed fields are returned', () => {
  const catalog = [{ id: 'planning', label: '기획' }];
  const base = { schemaVersion: 1, skills: ['planning'], preferredTasks: ['planning'], communication: 'async', workMode: 'solo', participates: true, confirmedAt: '2026-09-30T00:00:00.000Z' };
  const review = profile => Work.evaluate({ requiredSkills: ['planning'], memberIds: ['a'], minAvailableHours: 4 }, [{ id: 'a', shared: true, name: '홍길동', email: 'x@example.invalid', profile }], catalog);
  for (const availableHours of [undefined, '10', 200]) assert.throws(() => review({ ...base, availableHours }), TypeError);
  assert.throws(() => review({ ...base, availableHours: 4, communication: 'shouting' }), TypeError);
  const input = { ...base, availableHours: 4 };
  const result = review(input);
  assert.deepEqual(Object.keys(result.selected[0]).sort(), ['id', 'profile', 'shared']);
  result.selected[0].profile.skills.push('mutated');
  assert.deepEqual(input.skills, ['planning'], 'the caller\'s card is not reachable through the result');
});

test('a help style derived from "new to this" prefers fitting ways and matches what is shown', () => {
  const scope = { personId: 'person-1', productId: 'world', contextId: 'home', domain: 'LAB' };
  const at = '2026-10-02T00:00:00.000Z';
  const profile = P.updateProfile(P.createProfile({ scope, at }), { consent: true, values: { experience: 'new' } }, at);
  const r = P.selectPersonalization({ profile, scope, at, experienceId: 'entry', candidates: [
    { id: 'solo-only', minutes: 5, pace: 'standard', supports: ['independent'] },
    { id: 'stepwise', minutes: 5, pace: 'standard', supports: ['step'] },
  ] });
  assert.equal(r.plan.selected.id, 'stepwise');
  assert.equal(r.presentation.support, 'step');
  const only = P.selectPersonalization({ profile, scope, at, experienceId: 'entry', candidates: [{ id: 'solo-only', minutes: 5, pace: 'standard', supports: ['independent'] }] });
  assert.equal(only.plan.selected.id, 'solo-only', 'a derived preference never empties the list');
  assert.equal(only.presentation.support, 'independent', 'the screen follows the way actually chosen');
});
