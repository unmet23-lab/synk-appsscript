import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LISTENING_CHECKS, checkMetadata, listeningCheckFeedback, createListeningCheck, createListeningCheckRound } from './listening-check.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
function fixture() {
  const values = new Map(), coach = createGame({ gameId: 'korean-runner', map, fold: false,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  return { coach, check: createListeningCheck(coach) };
}
const goal = item => { const m = checkMetadata(item); return [m.skillId, m.difficulty, m.responseFormat, m.modality].join('|'); };
const answer = (check, item, choice = item.correct, replay = false) => { const token = check.begin(item); check.delivery(token, 'completed'); if (replay) check.replay(); return check.answer(choice); };
const assigned = items => ({ ...checkMetadata(items[0]), familyKeys: items.map(item => checkMetadata(item).familyKey), itemKeys: items.map(item => checkMetadata(item).itemKey), requiredAttempts: items.length });

test('every authored wrong choice has a distinct short correction, explanation and stable machine ID', () => {
  const ids = [];
  for (const item of LISTENING_CHECKS) {
    const wrong = [];
    for (let selected = 0; selected < item.choices.length; selected++) {
      const feedback = listeningCheckFeedback(item, selected);
      assert.equal(feedback.explanation, item.explanation); assert.equal(feedback.selectedLabel, item.choices[selected]);
      assert.equal(feedback.correctLabel, item.choices[item.correct]); assert.equal(feedback.correct, selected === item.correct);
      if (feedback.correct) assert.equal(feedback.correction, null); else { assert.ok(feedback.correction?.length); wrong.push(feedback.correction); }
      assert.match(item.choiceIds[selected], /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/); ids.push(item.choiceIds[selected]);
    }
    assert.equal(new Set(wrong).size, 2);
  }
  assert.equal(new Set(ids).size, 36);
  assert.throws(() => listeningCheckFeedback(LISTENING_CHECKS[0], -1), /Invalid choice/);
});

test('post-answer replay changes no original result, provenance, independent count or grade and cannot rescore', () => {
  const { coach, check } = fixture(), item = LISTENING_CHECKS[0], selected = (item.correct + 1) % 3;
  const result = answer(check, item, selected), before = coach.events(), summary = coach.summary();
  assert.equal(result.independent, true); assert.equal(result.verdict, 'incorrect');
  assert.deepEqual(before.find(event => event.type === 'practice.attempted').choice, { selectedId: item.choiceIds[selected], correctId: item.choiceIds[item.correct] });
  assert.equal(check.replay(), true); assert.equal(check.delivery(check.current.token, 'completed'), false);
  assert.equal(check.delivery(check.current.token, 'failed'), false); assert.equal(check.answer(item.correct), null);
  assert.deepEqual(check.current.result, result); assert.deepEqual(coach.events(), before);
  assert.equal(coach.summary().independent, summary.independent); assert.equal(coach.summary().grade, null);
});

test('an incorrect response selects a different unseen family of the same actual goal next', () => {
  const { coach, check } = fixture(), round = createListeningCheckRound(coach), first = round.next();
  const result = answer(check, first.item, (first.item.correct + 1) % 3);
  const next = round.next(check.current);
  assert.deepEqual(next.followup, { status: 'new', sourceAttemptId: result.eventId });
  assert.equal(next.status, 'ready'); assert.equal(next.exposure, 'new'); assert.match(next.note, /같은 듣기 목표/);
  assert.equal(goal(next.item), goal(first.item)); assert.notEqual(next.item.id, first.item.id);
  assert.notEqual(checkMetadata(next.item).familyKey, checkMetadata(first.item).familyKey);
});

test('a help-assisted correct response also gets an unseen same-goal follow-up without counting as independent', () => {
  const { coach, check } = fixture(), round = createListeningCheckRound(coach), first = round.next();
  const result = answer(check, first.item, first.item.correct, true);
  assert.equal(result.assisted, true); assert.equal(result.independent, false);
  const next = round.next(check.current); assert.equal(next.exposure, 'new'); assert.equal(goal(next.item), goal(first.item));
  assert.deepEqual(next.followup, { status: 'new', sourceAttemptId: result.eventId });
  assert.notEqual(next.item.id, first.item.id);
});

test('an assignment never expands its exact list or total to supply a follow-up', () => {
  const { coach, check } = fixture(), items = LISTENING_CHECKS.filter(item => checkMetadata(item).skillId === 'ko.listening.sequence').slice(0, 3);
  const round = createListeningCheckRound(coach, { assignment: assigned(items) }), chosen = [];
  let previous = null;
  for (let i = 0; i < 3; i++) {
    const plan = round.next(previous); assert.equal(plan.status, 'ready'); chosen.push(plan.item.id);
    answer(check, plan.item, (plan.item.correct + 1) % 3); previous = check.current;
  }
  assert.deepEqual(new Set(chosen), new Set(items.map(item => item.id))); assert.equal(round.total, 3);
  assert.deepEqual(round.next(previous), { status: 'finished', item: null });
});

test('spent assigned families remain honest review and are never labelled new', () => {
  const { coach, check } = fixture(), items = LISTENING_CHECKS.filter(item => checkMetadata(item).skillId === 'ko.listening.detail').slice(0, 3);
  for (const item of items) answer(check, item);
  const round = createListeningCheckRound(coach, { assignment: assigned(items) });
  const first = round.next(); assert.equal(first.exposure, 'review'); assert.match(first.note, /새 문항으로 표시하지 않아요/);
  const result = answer(check, first.item, (first.item.correct + 1) % 3);
  assert.equal(result.independent, false); assert.equal(result.exposure, 'repeat');
  const next = round.next(check.current); assert.equal(next.exposure, 'review'); assert.match(next.note, /새 문항/); assert.notEqual(next.item.id, first.item.id);
  assert.equal(next.followup, null);
});

test('unknown history is not relabelled fresh, and mismatched assignment has no fallback', () => {
  const { coach } = fixture(), unknown = { recommend: coach.recommend, exposure: () => ({ seen: null }) };
  const first = createListeningCheckRound(unknown, { assignment: null }).next();
  assert.equal(first.exposure, 'unknown'); assert.match(first.note, /새 문항이라고 표시하지 않아요/);
  const items = LISTENING_CHECKS.slice(0, 3), target = { ...assigned(items), skillId: 'ko.reading.detail' };
  const round = createListeningCheckRound(coach, { assignment: target }); assert.equal(round.total, 0); assert.equal(round.next().status, 'finished');
});

test('failed first audio cannot create a choice response; answer after successful first retry remains unassisted', () => {
  const { coach, check } = fixture(), item = LISTENING_CHECKS[0], token = check.begin(item);
  check.delivery(token, 'failed'); assert.equal(check.answer(item.correct), null);
  assert.equal(coach.events().filter(event => event.type === 'practice.attempted').length, 0);
  check.replay(); check.delivery(token, 'completed'); const result = check.answer(item.correct);
  assert.equal(result.independent, true); assert.equal(result.assisted, false);
});

test('a prior presentation without an answer is never labelled an unseen question; first-response qualification stays Core-owned', () => {
  const { coach, check } = fixture(), item = LISTENING_CHECKS[0];
  coach.present(checkMetadata(item));
  const round = createListeningCheckRound(coach, { assignment: assigned([item]) }), plan = round.next();
  assert.equal(plan.exposure, 'review'); assert.match(plan.note, /화면에 나온 적/);
  assert.equal(answer(check, item).independent, true, 'a displayed but unattempted item still follows the existing first-answer evidence policy');
});

test('listening with help and closing without an answer cannot return as an unseen or independent question', () => {
  const { coach, check } = fixture(), item = LISTENING_CHECKS[0], token = check.begin(item);
  check.delivery(token, 'completed'); check.replay(); check.cancel();
  const plan = createListeningCheckRound(coach, { assignment: assigned([item]) }).next();
  assert.equal(plan.exposure, 'review');
  const result = answer(check, item); assert.equal(result.independent, false); assert.equal(result.exposure, 'repeat');
});
