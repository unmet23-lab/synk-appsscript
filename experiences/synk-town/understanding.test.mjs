import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { READING_CHECKS, readingMetadata, readingAnswer, selectReadingChecks, readingFeedback, readingFollowUp } from './understanding.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
function fixture() { const rows = new Map(); return createGame({ gameId: 'synk-town', map, storage: { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) } }); }
function target(items) { const m = readingMetadata(items[0]); return { skillId: m.skillId, difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat,
  familyKeys: items.map(x => readingMetadata(x).familyKey), itemKeys: items.map(x => readingMetadata(x).itemKey), requiredAttempts: 3 }; }
test('Town has 30 distinct authored passages and six families per reading skill', () => {
  assert.equal(READING_CHECKS.length, 30); assert.equal(new Set(READING_CHECKS.map(x => x.id)).size, 30);
  assert.equal(new Set(READING_CHECKS.map(x => x.passage)).size, 30);
  for (const skill of ['detail', 'negation', 'sequence', 'reason', 'main']) assert.equal(READING_CHECKS.filter(x => x.skill === skill).length, 6);
  // readingFeedback adds its own full stop after a choice, so a choice never ends with one ("…올랐어요..").
  assert.ok(READING_CHECKS.every(x => x.choices.every(choice => !/\.$/.test(choice))));
  // The reason and main items (2026-10-20) spread their answers over all three places.
  for (const skill of ['reason', 'main']) assert.deepEqual([...new Set(READING_CHECKS.filter(x => x.skill === skill).map(x => x.correct))].sort(), [0, 1, 2], skill);
  for (const item of READING_CHECKS) { assert.equal(new Set(item.choices).size, 3); assert.ok(item.choices[item.correct]); assert.ok(item.hint && item.explanation); }
  assert.equal(readingMetadata(READING_CHECKS[0]).familyKey, 'synk-town.reading-check.town-reading-place.v1');
});
// A server task aims at one cell (skill × difficulty). Since 10-21 the reason and main checks have two difficulties
// (understanding.mjs), so each cell is checked on its own: unseen passages come before any repeat.
const cells = Object.values(Object.groupBy(READING_CHECKS, x => `${x.skill}:${readingMetadata(x).difficulty}`));
for (const pool of cells) test(`${pool[0].skill} · difficulty ${readingMetadata(pool[0]).difficulty}: the first 3 and the next ones use different original passages`, () => {
  const coach = fixture(), size = pool.length;
  const first = selectReadingChecks(coach, { assignment: target(pool) }); assert.equal(first.length, Math.min(3, size));
  for (const item of first) { const pid = coach.present(readingMetadata(item)); assert.equal(coach.answer(pid, readingAnswer(item, item.correct)).independent, true); }
  const following = selectReadingChecks(coach, { assignment: target(pool) }), fresh = following.filter(item => !first.some(old => old.id === item.id));
  assert.equal(fresh.length, Math.min(3, size - first.length)); assert.deepEqual(following.slice(0, fresh.length), fresh, 'unseen passages first');
  for (const item of fresh) { const pid = coach.present(readingMetadata(item)); assert.equal(coach.answer(pid, readingAnswer(item, item.correct)).independent, true); }
  assert.equal(coach.summary().independent, first.length + fresh.length);
});
test('every skill still has six passages, and the two-difficulty skills keep both cells', () => {
  for (const skill of ['detail', 'negation', 'sequence', 'reason', 'main']) assert.equal(cells.filter(pool => pool[0].skill === skill).reduce((n, pool) => n + pool.length, 0), 6);
  assert.deepEqual(cells.map(pool => `${pool[0].skill}:${readingMetadata(pool[0]).difficulty}:${pool.length}`).sort(),
    ['detail:1:6', 'main:1:6', 'negation:1:6', 'reason:1:3', 'reason:2:3', 'sequence:1:6']);
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

// A check's passage, question, choices or answer changing must raise its version (understanding.mjs ITEM_VERSION, learning standard §7-2).
// After raising it, update this table's version and digest (first 12 hex of the hash) together. A new check starts at version 1.
// Explanations, hints, corrections and difficulty alone keep the version (added 10-21).
const CONTENT = {
  'town-reading-place': [2, '499519853756'],
  'town-reading-negation': [2, 'e12780b128cb'],
  'town-reading-sequence': [1, '32c3bdf0ca39'],
  'town-detail-market': [1, 'e86d17d5585e'],
  'town-detail-library': [1, '470da0a294e2'],
  'town-detail-lost': [2, 'b86467f402db'],
  'town-detail-festival': [1, '1cb9063c76b3'],
  'town-detail-workshop': [1, '194b290c50fd'],
  'town-negation-flowers': [1, '2d2fa0ed7201'],
  'town-negation-books': [2, 'e04d7e8c5900'],
  'town-negation-bike': [1, '983ff85c8248'],
  'town-negation-desk': [1, '85a5ad465e67'],
  'town-negation-bus': [2, '0b69fa74eb46'],
  'town-sequence-borrow': [2, 'd8075f2d7815'],
  'town-sequence-class': [2, 'c939b2210d51'],
  'town-sequence-parcel': [1, 'f8945870db81'],
  'town-sequence-garden': [2, '24c60407a9b5'],
  'town-sequence-ticket': [2, '37211acc095c'],
  'town-reason-library': [2, 'e0d38f35c648'],
  'town-reason-bakery': [1, '8b0ceb2398d2'],
  'town-reason-walk': [2, '35c110cce0b0'],
  'town-reason-bus': [2, 'a72f9fcc8614'],
  'town-reason-florist': [1, 'c332bdcb29db'],
  'town-reason-quiet': [1, '187bad8a134f'],
  'town-main-swim': [1, '9819d35a56d7'],
  'town-main-cup': [2, 'b14a779648dd'],
  'town-main-post': [1, 'ef89322f8247'],
  'town-main-cat': [1, '58682232efe9'],
  'town-main-swap': [2, '0d3341941ebc'],
  'town-main-thanks': [2, '0a2ce2fe565a'],
};
test('content version: changing a passage, question, choice or answer raises the version and keeps the family', async () => {
  const crypto = await import('node:crypto');
  const digest = (x) => crypto.createHash('sha256').update(JSON.stringify([x.passage, x.question, x.choices, x.correct])).digest('hex').slice(0, 12);
  assert.deepEqual(Object.keys(CONTENT).sort(), READING_CHECKS.map((x) => x.id).sort(), 'add a new check here at version 1');
  for (const x of READING_CHECKS) {
    const [version, hash] = CONTENT[x.id];
    assert.equal(digest(x), hash, `${x.id}: the content changed — raise ITEM_VERSION and update this table`);
    assert.equal(readingMetadata(x).itemKey, `synk-town.reading-check.${x.id}.v${version}`, x.id);
    assert.equal(readingMetadata(x).familyKey, `synk-town.reading-check.${x.id}.v1`, x.id);
  }
});
