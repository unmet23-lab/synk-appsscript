import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LISTENING_CHECKS, checkMetadata, createListeningCheck } from './listening-check.mjs';
import { instructionMetadata } from './learning.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
function fixture() { const rows = new Map(), coach = createGame({ gameId: 'korean-runner', map, storage: { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v) } }); return { coach, check: createListeningCheck(coach) }; }
test('all three completed MP3 checks can produce independent correct/incorrect listening evidence', () => {
  const { coach, check } = fixture();
  for (const [i, item] of LISTENING_CHECKS.entries()) {
    const token = check.begin(item); assert.equal(check.answer(item.correct), null);
    check.delivery(token, 'completed'); const result = check.answer(i === 1 ? 1 : item.correct);
    assert.equal(result.independent, true); assert.equal(result.verdict, i === 1 ? 'incorrect' : 'correct');
    assert.equal(check.answer(item.correct), null);
  }
  assert.equal(coach.summary().independent, 3);
});
test('replaying is assisted and requires a newly completed audio delivery', () => {
  const { check } = fixture(), item = LISTENING_CHECKS[0], token = check.begin(item);
  check.delivery(token, 'completed'); check.replay(); assert.equal(check.answer(item.correct), null);
  check.delivery(token, 'completed'); const result = check.answer(item.correct); assert.equal(result.assisted, true); assert.equal(result.independent, false);
});
test('missing/interrupted audio and cancelled questions create no incorrect language evidence', () => {
  const { coach, check } = fixture(); const token = check.begin(LISTENING_CHECKS[0]); check.delivery(token, 'failed');
  assert.equal(check.answer(0), null); check.cancel(); assert.equal(coach.summary().independent, 0);
  assert.equal(coach.events().filter(event => event.type === 'practice.attempted').at(-1).verdict, 'unassessed');
});
test('stale audio completion cannot unlock the following question', () => {
  const { check } = fixture(); const token = check.begin(LISTENING_CHECKS[0]); check.begin(LISTENING_CHECKS[1]);
  assert.equal(check.delivery(token, 'completed'), false); assert.equal(check.answer(0), null);
});
test('a phrase already shown during running/practice cannot become a new independent listening fact', () => {
  const { coach, check } = fixture(), item = LISTENING_CHECKS[0]; const pid = coach.present(instructionMetadata(item)); coach.help(pid, 'answer');
  const token = check.begin(item); check.delivery(token, 'completed'); assert.equal(check.answer(item.correct).independent, false);
  assert.equal(checkMetadata(item).familyKey, instructionMetadata(item).familyKey);
});
