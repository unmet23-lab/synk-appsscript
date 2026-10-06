import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { READING_CHECKS, readingMetadata, readingAnswer, selectReadingChecks, readingFeedback, readingFollowUp } from './understanding.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
function fixture() { const rows = new Map(); return createGame({ gameId: 'synk-town', map, storage: { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) } }); }
function target(items) { const m = readingMetadata(items[0]); return { skillId: m.skillId, difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat,
  familyKeys: items.map(x => readingMetadata(x).familyKey), itemKeys: items.map(x => readingMetadata(x).itemKey), requiredAttempts: 3 }; }
test('Town has 18 distinct authored passages and six families per reading skill', () => {
  assert.equal(READING_CHECKS.length, 18); assert.equal(new Set(READING_CHECKS.map(x => x.id)).size, 18);
  assert.equal(new Set(READING_CHECKS.map(x => x.passage)).size, 18);
  for (const skill of ['detail', 'negation', 'sequence']) assert.equal(READING_CHECKS.filter(x => x.skill === skill).length, 6);
  for (const item of READING_CHECKS) { assert.equal(new Set(item.choices).size, 3); assert.ok(item.choices[item.correct]); assert.ok(item.hint && item.explanation); }
  assert.equal(readingMetadata(READING_CHECKS[0]).familyKey, 'synk-town.reading-check.town-reading-place.v1');
});
for (const skill of ['detail', 'negation', 'sequence']) test(`${skill}: first 3 and following 3 use different original passages`, () => {
  const coach = fixture(), pool = READING_CHECKS.filter(x => x.skill === skill);
  const first = selectReadingChecks(coach, { assignment: target(pool) }); assert.equal(first.length, 3);
  for (const item of first) { const pid = coach.present(readingMetadata(item)); assert.equal(coach.answer(pid, readingAnswer(item, item.correct)).independent, true); }
  const following = selectReadingChecks(coach, { assignment: target(pool) }); assert.equal(following.length, 3);
  assert.ok(following.every(item => !first.some(old => old.id === item.id)));
  for (const item of following) { const pid = coach.present(readingMetadata(item)); assert.equal(coach.answer(pid, readingAnswer(item, item.correct)).independent, true); }
  assert.equal(coach.summary().independent, 6);
});
test('Town honors the server exact item/family scope and rejects incompatible targets', () => {
  const coach = fixture(), items = READING_CHECKS.filter(x => x.skill === 'negation').slice(-3), assignment = target(items);
  assert.deepEqual(new Set(selectReadingChecks(coach, { assignment }).map(x => x.id)), new Set(items.map(x => x.id)));
  for (const change of [{ skillId: 'ko.listening.negation' }, { difficulty: 2 }, { modality: 'listening' }, { responseFormat: 'action' }, { familyKeys: [] }, { itemKeys: [] }])
    assert.deepEqual(selectReadingChecks(coach, { assignment: { ...assignment, ...change } }), []);
});
test('Town free rounds select Core suggestions, not a fixed first three rows', () => {
  const coach = fixture(), first = selectReadingChecks(coach); assert.equal(first.length, 3);
  for (const item of first) { const pid = coach.present(readingMetadata(item)); coach.answer(pid, readingAnswer(item, item.correct)); }
  const following = selectReadingChecks(coach); assert.equal(following.length, 3);
  assert.ok(following.every(item => !first.some(old => old.id === item.id)));
});

test('Town preserves the chosen option and distinguishes each wrong option without diagnosing a learner', () => {
  for (const item of READING_CHECKS) {
    const wrong = item.choices.map((_, i) => i).filter(i => i !== item.correct);
    assert.notEqual(readingFeedback(item, wrong[0]), readingFeedback(item, wrong[1]));
    for (const selected of wrong) {
      assert.deepEqual(readingAnswer(item, selected).choice, { selectedId: `option-${selected}`, correctId: `option-${item.correct}` });
      assert.ok(readingFeedback(item, selected).includes(item.choices[selected]));
      assert.ok(readingFeedback(item, selected).includes(item.choices[item.correct]));
    }
  }
});

test('Town follows a miss with a different eligible unanswered passage while preserving round length', () => {
  const coach = fixture(), round = selectReadingChecks(coach), first = round[0];
  const pid = coach.present(readingMetadata(first));
  coach.answer(pid, readingAnswer(first, (first.correct + 1) % 3));
  const next = readingFollowUp(coach, first, round, 0);
  assert.equal(next.status, 'new'); assert.equal(next.round.length, round.length);
  assert.equal(next.round[1].skill, first.skill); assert.notEqual(next.round[1].id, first.id);
  assert.equal(new Set(next.round.map(x => x.id)).size, round.length);
  const nextPid = coach.present(readingMetadata(next.round[1]));
  assert.equal(coach.answer(nextPid, readingAnswer(next.round[1], next.round[1].correct)).independent, true);
  assert.equal(readingFollowUp(coach, next.round[1], next.round, round.length - 1).status, 'complete');
});

test('Town never invents a new item when exact assignment is exhausted or history is unknown', () => {
  const coach = fixture(), first = READING_CHECKS[0];
  coach.assignment = () => target([first]);
  const round = [first, first];
  assert.equal(readingFollowUp(coach, first, round, 0).status, 'unavailable');
  delete coach.assignment; coach.exposure = () => ({ seen: null });
  assert.equal(readingFollowUp(coach, first, round, 0).status, 'unavailable');
});
