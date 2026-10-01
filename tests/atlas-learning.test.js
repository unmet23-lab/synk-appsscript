'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, KEY } = require('../atlas/game-learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
function storage() { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; }
const START = Date.parse('2026-10-02T01:00:00Z');
const R = 'ko.reading.detail', L = 'ko.listening.detail';
function fixture(extra = {}) {
  let now = START, index = 0;
  const disk = extra.storage || storage();
  const coach = createGame({ gameId: extra.gameId || 'test-game', storage: disk, map, clock: () => new Date(now).toISOString(), ...extra });
  const answer = (skillId, correct, options = {}) => {
    now += 1000;
    const modality = skillId.split('.')[1], id = options.id || `item${++index}`;
    const pid = coach.present({ id, itemKey: options.itemKey || id, familyKey: options.familyKey || options.itemKey || id,
      skillId, modality, difficulty: options.difficulty || 1, audioRequired: modality === 'listening', confounded: !!options.confounded });
    if (modality === 'listening' && options.audio !== false) coach.delivery(pid, { audio: 'completed' });
    if (options.help) coach.help(pid, options.help);
    const result = coach.answer(pid, { correct, assessable: options.assessable !== false, ...(options.reason ? { reason: options.reason } : {}) });
    return { pid, result };
  };
  return { coach, disk, answer, advance: days => { now += days * 86400000; }, setNow: value => { now = value; } };
}
const candidates = [
  { id: 'listen', label: '듣기', skillIds: [L], difficulty: 1, modality: 'listening' },
  { id: 'read', label: '읽기', skillIds: [R], difficulty: 1, modality: 'reading' },
];
const skill = (coach, id) => coach.summary().skills.find(s => s.id === id);
test('opposite observed needs select different actual candidate content; unseen is not weak', () => {
  const a = fixture(), b = fixture();
  for (let i = 0; i < 5; i++) { a.answer(L, true); a.answer(R, false); b.answer(R, true); b.answer(L, false); }
  assert.equal(a.coach.recommend(candidates).selected.id, 'read');
  assert.equal(b.coach.recommend(candidates).selected.id, 'listen');
  assert.equal(skill(fixture().coach, R).status, 'unseen');
  assert.match(fixture().coach.recommend([candidates[1]]).reason, /まだ|아직/);
});
test('another game and a reload consume the same local log; another host scope is isolated', () => {
  const f = fixture(); for (let i = 0; i < 4; i++) f.answer(L, true);
  const g = fixture({ storage: f.disk, gameId: 'another-game' });
  assert.equal(skill(g.coach, L).n, 4);
  assert.equal(g.coach.recommend(candidates).selected.id, 'read');
  const other = fixture({ storage: f.disk, learnerKey: 'other-local-scope' });
  assert.equal(skill(other.coach, L).n, 0);
});
test('text, hint, answer and additional replay cannot become independent success', () => {
  for (const help of ['text', 'hint', 'answer', 'replay']) {
    const f = fixture(), result = f.answer(L, true, { help }).result;
    assert.equal(result.independent, false, help); assert.equal(skill(f.coach, L).n, 0, help);
  }
});
test('failed or unfinished audio, action confounds, demo and no response are excluded', () => {
  const f = fixture();
  assert.equal(f.answer(L, false, { audio: false }).result.verdict, 'unassessed');
  assert.equal(f.answer(L, true, { confounded: true }).result.independent, false);
  f.answer(R, false, { assessable: false, reason: 'motor' });
  f.answer(R, true, { assessable: false, reason: 'demo' });
  f.answer(R, null, { reason: 'unanswered' });
  assert.equal(f.coach.summary().independent, 0);
});
test('same item, answer-option variants and analytical exclusion never reset exposure', () => {
  const f = fixture(), first = f.answer(R, false, { id: 'original', familyKey: 'family' });
  f.coach.exclude(first.result.eventId);
  assert.equal(f.answer(R, true, { id: 'variant', familyKey: 'family' }).result.independent, false);
  assert.equal(skill(f.coach, R).n, 0);
});
test('double submits are idempotent and do not overwrite an initial failure', () => {
  const f = fixture(), first = f.answer(R, false);
  const again = f.coach.answer(first.pid, { correct: true, assessable: true });
  assert.equal(again.eventId, first.result.eventId); assert.equal(again.verdict, 'incorrect');
  assert.equal(skill(f.coach, R).n, 1);
});
test('help or audio completion after an answer cannot rewrite earlier provenance', () => {
  const f = fixture(), first = f.answer(L, true, { audio: false });
  f.coach.delivery(first.pid, { audio: 'completed' });
  assert.equal(skill(f.coach, L).n, 0);
  const valid = f.answer(R, true); f.coach.help(valid.pid, 'answer');
  assert.equal(skill(f.coach, R).n, 1);
});
test('explicit retries remain recorded after help without rewriting first-response evidence', () => {
  const f = fixture(), first = f.answer(R, false);
  f.coach.help(first.pid, 'hint');
  const retried = f.coach.answer(first.pid, { correct: true, assessable: true, attemptNo: 2 });
  assert.equal(retried.attemptNo, 2); assert.equal(retried.independent, false);
  assert.equal(skill(f.coach, R).incorrect, 1); assert.equal(skill(f.coach, R).n, 1);
  assert.equal(f.coach.answer(first.pid, { correct: true, assessable: true, attemptNo: 2 }).eventId, retried.eventId);
  assert.equal(f.coach.events().filter(e => e.type === 'practice.attempted').length, 2);
});
test('language difficulty, modality and old evidence remain separate', () => {
  const f = fixture(); for (let i = 0; i < 4; i++) f.answer(R, true);
  assert.equal(skill(f.coach, R).levels[1].status, 'recent-independent');
  assert.equal(skill(f.coach, R).levels[3].status, 'unseen');
  assert.equal(skill(f.coach, L).status, 'unseen');
  f.advance(8); assert.equal(skill(f.coach, R).levels[1].status, 'review');
  f.advance(31); assert.equal(skill(f.coach, R).n, 0);
});
test('audio-unavailable is a current condition; it never creates a listening weakness', () => {
  const f = fixture(); assert.equal(f.coach.recommend(candidates, { audioAvailable: false }).selected.id, 'read');
  assert.equal(f.coach.recommend([candidates[0]], { audioAvailable: false }).status, 'unavailable');
  assert.equal(skill(f.coach, L).status, 'unseen');
});
test('two already-open games merge writes and resets invalidate stale presentations', () => {
  const disk = storage(), a = fixture({ storage: disk }), b = fixture({ storage: disk, gameId: 'second' });
  const old = a.answer(R, false, { id: 'a' }); b.answer(L, true, { id: 'b' });
  assert.equal(a.coach.summary().independent, 2);
  b.coach.reset(); assert.equal(a.coach.summary().independent, 0);
  assert.throws(() => a.coach.answer(old.pid, { correct: false, assessable: true }), /ended/);
  assert.equal(b.coach.summary().independent, 0);
});
test('corrupt, inaccessible, partial or quota-failed storage cannot invent a clean history', () => {
  const disk = storage(); disk.setItem(`${KEY}.device`, 'broken-history');
  const f = fixture({ storage: disk }); f.answer(R, true);
  assert.equal(f.coach.summary().storage.available, false); assert.equal(skill(f.coach, R).n, 0);
  assert.equal(disk.getItem(`${KEY}.device`), 'broken-history');
  const g = fixture({ storage: { getItem() { return null; }, setItem() { throw new Error('quota'); } } });
  assert.equal(g.answer(R, true).result.independent, false);
  const h = fixture({ historyComplete: false }); assert.equal(h.answer(R, true).result.independent, false);
});
test('stored evidence carries no response text and a forged map/field cannot enter', () => {
  const f = fixture(); f.answer(R, false);
  const raw = f.disk.getItem(`${KEY}.device`);
  assert.equal(/"response"\s*:/.test(raw), false); assert.equal(raw.includes('learner_id'), false);
  assert.throws(() => f.coach.present({ id: 'x', itemKey: 'x', skillId: 'invented', difficulty: 1, modality: 'reading' }), /invalid/);
  assert.throws(() => f.coach.recommend([{ ...candidates[0], modality: 'reading' }]), /invalid/);
});
test('later diverse successes reduce a prior need and recorded choice has the same basis', () => {
  const f = fixture(); for (let i = 0; i < 3; i++) f.answer(R, false);
  assert.equal(skill(f.coach, R).status, 'practice');
  for (let i = 0; i < 12; i++) f.answer(R, true);
  assert.equal(skill(f.coach, R).status, 'recent-independent');
  assert.equal(f.coach.recommend(candidates).selected.id, 'listen');
  const decision = f.coach.events().filter(e => e.type === 'decision.made').at(-1);
  assert.equal(decision.candidateSnapshot[0].learning.policy, 'learning-priority-2');
});
test('a few earlier mistakes do not keep recent diverse success in a permanent practice state', () => {
  const f = fixture();
  f.answer(R, false); f.answer(R, false);
  for (let i = 0; i < 10; i++) f.answer(R, true);
  assert.equal(skill(f.coach, R).status, 'recent-independent');
  assert.equal(f.coach.recommend(candidates).selected.id, 'listen');
});
