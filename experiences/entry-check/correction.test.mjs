import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { VENUES, SHIFT_SIZE, CAST } from './content.mjs';
import { composeShift, choicesFor, minutes, validateContent } from './core.mjs';
import { answerPayload, caseMetadata } from './learning.mjs';
import { choiceId, choiceCorrection, immediateCheck } from './correction.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const pool = VENUES.find(v => v.id === 'pool'), find = id => pool.cases.find(c => c.id === id);
function coach() { const rows = new Map(); return createGame({ gameId: 'entry-check', map, storage: { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v) } }); }
const exposed = (g, item, correct = false, hint = false) => { const pid = g.present(caseMetadata(item)); if (hint) g.help(pid, 'hint'); return g.answer(pid, answerPayload(correct, { selectedId: choiceId(correct ? item.answer : item.answer === 'pass' ? 'food' : 'pass'), correctId: choiceId(item.answer) })); };

test('feedback names the actual selected rule and retains the authored correct explanation separately', () => {
  const item = find('pool-02');
  const pass = choiceCorrection(pool, item, 'pass'), cap = choiceCorrection(pool, item, 'cap'), kid = choiceCorrection(pool, item, 'kid');
  assert.match(pass, /통과.*음식/); assert.match(cap, /수영 모자.*음식/); assert.match(kid, /7살 이하 어린이.*음식/);
  assert.notEqual(cap, kid); assert.equal(choiceCorrection(pool, item, 'food'), '');
  for (const [venueId, caseId, selected, label] of [['pool', 'pool-04', 'food', '수영 모자'], ['library', 'library-02', 'food', '도서관 카드']]) {
    const venue = VENUES.find(v => v.id === venueId), target = venue.cases.find(c => c.id === caseId);
    const line = choiceCorrection(venue, target, selected);
    assert.ok(line.includes(`이 손님은 ‘${label}’ 규칙 때문에 들어갈 수 없어요.`));
    assert.doesNotMatch(line, /’이에요|오개념|약점|숙달/);
  }
  assert.match(choiceCorrection(pool, find('pool-03'), 'food'), /음식.*들어갈 수.*괜찮은/);
  for (const line of [pass, cap, kid]) assert.doesNotMatch(line, /오개념|약점|숙달|급수|헷갈렸/);
  assert.equal(item.why, '김밥은 음식이에요. 음식은 가지고 들어갈 수 없어요.');
});

test('authored choice IDs persist without changing first-attempt correctness or hint protection', () => {
  assert.deepEqual(answerPayload(false), { correct: false, assessable: true });
  const g = coach(), item = find('pool-02'), result = exposed(g, item);
  assert.deepEqual(result.choice, { selectedId: 'pass', correctId: 'reject-food' });
  assert.equal(result.verdict, 'incorrect'); assert.equal(result.independent, true);
  const event = g.events().find(event => event.type === 'practice.attempted'); assert.deepEqual(event.choice, result.choice);
  const helped = exposed(g, find('pool-10'), true, true); assert.equal(helped.independent, false); assert.equal(helped.assisted, true);
});

test('six pool followup-only reading scenes are valid, fixed-key and do not enter the default six-person shift', () => {
  assert.deepEqual(validateContent(), []);
  const added = pool.cases.filter(c => c.followupOnly); assert.equal(added.length, 6);
  for (const item of added) {
    assert.equal(item.textOnly, true); assert.ok(choicesFor(pool, item.at).includes(item.answer));
    assert.match(caseMetadata(item).familyKey, /^entry-check\.pool-\d\d\.v1$/);
    assert.equal(item.difficulty, 1);
  }
  const shift = composeShift(pool, { ranked: added.map(c => c.id) }); assert.equal(shift.length, SHIFT_SIZE);
  assert.ok(shift.every(item => !item.followupOnly));
  assert.deepEqual(composeShift(pool, { firstTime: true }).map(item => item.id), ['pool-01', 'pool-02', 'pool-03', 'pool-04', 'pool-05', 'pool-06']);
});

test('the two authored reserve scenes reverse the rejection condition using observable facts', () => {
  for (const [from, to, evidence, concept] of [['pool-09', 'pool-12', 'cap', 'G403'], ['pool-10', 'pool-13', 'food', 'G402']]) {
    const original = find(from), item = find(to), before = caseMetadata(original), after = caseMetadata(item);
    assert.equal(item.answer, 'pass'); assert.notEqual(item.answer, original.answer);
    assert.ok(item.items.includes('swim-cap')); assert.ok(!item.items.some(id => ['gimbap', 'snack'].includes(id)));
    assert.equal(item.doc.rows.find(([label]) => label === '이름')[1], CAST[item.who].name);
    assert.match(item.doc.rows.find(([label]) => label === '구분')[1], new RegExp(`${CAST[item.who].age}살`));
    for (const key of ['skillId', 'difficulty', 'modality', 'responseFormat']) assert.equal(after[key], before[key]);
    assert.deepEqual(item.evidence, [evidence]); assert.deepEqual(after.conceptIds, [concept]);
    assert.equal(after.itemKey, `entry-check.${to}.v1`); assert.equal(after.familyKey, after.itemKey);
    assert.notEqual(item.line, original.line); assert.notEqual(item.why, original.why);
  }
  assert.match(find('pool-12').line, /모자를 가져왔어요.*쓰고 들어갈게요/);
  assert.match(find('pool-12').why, /짐에 수영 모자가 있고/);
  assert.match(find('pool-12').oops, /짐 속의 모자/);
  for (const key of ['line', 'why', 'oops']) assert.doesNotMatch(find('pool-12')[key], /모자를 썼|머리의 모자|써야 하는 조건에 맞고/);
  assert.match(find('pool-13').line, /과자는 밖에 두고 왔어요/);
});

for (const [from, to] of [['pool-01', 'pool-09'], ['pool-02', 'pool-10'], ['pool-03', 'pool-11']]) test(`${from}: error or help can use ${to} immediately within the same six-person shift`, () => {
  const g = coach(), queue = composeShift(pool), item = find(from), index = queue.indexOf(item);
  for (const previous of queue.slice(0, index)) exposed(g, previous, true);
  exposed(g, item);
  const plan = immediateCheck({ venue: pool, queue, index, item, coach: g });
  assert.equal(plan.status, 'new'); assert.equal(plan.item.id, to); assert.equal(plan.queue[index + 1].id, to);
  assert.equal(plan.queue.length, queue.length); assert.deepEqual(plan.queue.slice(0, index + 1), queue.slice(0, index + 1));
  assert.equal(new Set(plan.queue.map(c => c.id)).size, plan.queue.length);
  assert.ok(plan.queue.every((row, i) => !i || minutes(plan.queue[i - 1].at) < minutes(row.at)));
  for (const answer of new Set(queue.map(c => c.answer))) assert.ok(plan.queue.some(c => c.answer === answer));
  const next = exposed(g, plan.item, true); assert.equal(next.independent, true); assert.equal(next.exposure, 'new');
  assert.match(plan.line, /같은 안내 규칙/);
});

for (const [from, first, second] of [['pool-01', 'pool-09', 'pool-12'], ['pool-02', 'pool-10', 'pool-13']]) test(`${first}: a second wrong answer can check ${second} with a different actual answer`, () => {
  const g = coach(), queue = composeShift(pool, { firstTime: true }), item = find(from), index = queue.indexOf(item);
  for (const previous of queue.slice(0, index)) exposed(g, previous, true);
  exposed(g, item);
  const firstPlan = immediateCheck({ venue: pool, queue, index, item, coach: g });
  assert.equal(firstPlan.item.id, first); exposed(g, firstPlan.item);
  const plan = immediateCheck({ venue: pool, queue: firstPlan.queue, index: index + 1, item: firstPlan.item, coach: g });
  assert.equal(plan.status, 'new'); assert.equal(plan.item.id, second); assert.equal(plan.queue[index + 2].id, second);
  assert.notEqual(plan.item.answer, firstPlan.item.answer);
  assert.equal(plan.queue.length, SHIFT_SIZE); assert.deepEqual(plan.queue.slice(0, index + 2), firstPlan.queue.slice(0, index + 2));
  assert.equal(new Set(plan.queue.map(c => c.id)).size, plan.queue.length);
  assert.ok(plan.queue.every((row, i) => !i || minutes(plan.queue[i - 1].at) < minutes(row.at)));
  for (const answer of new Set(queue.map(c => c.answer))) assert.ok(plan.queue.some(c => c.answer === answer));
  const measure = caseMetadata(firstPlan.item), nextMeasure = caseMetadata(plan.item);
  for (const key of ['skillId', 'difficulty', 'modality', 'responseFormat']) assert.equal(nextMeasure[key], measure[key]);
  assert.deepEqual(plan.item.evidence, firstPlan.item.evidence); assert.deepEqual(nextMeasure.conceptIds, measure.conceptIds);
  const result = exposed(g, plan.item, true); assert.equal(result.independent, true); assert.equal(result.exposure, 'new');
});

test('the water confirmation honestly exhausts the remaining six-person slots after a second error', () => {
  const g = coach(), queue = composeShift(pool, { firstTime: true }), item = find('pool-03'), index = queue.indexOf(item);
  for (const previous of queue.slice(0, index)) exposed(g, previous, true);
  exposed(g, item);
  const first = immediateCheck({ venue: pool, queue, index, item, coach: g });
  assert.equal(first.item.id, 'pool-11'); exposed(g, first.item);
  const second = immediateCheck({ venue: pool, queue: first.queue, index: index + 1, item: first.item, coach: g });
  assert.equal(second.status, 'unavailable'); assert.equal(second.item, null); assert.deepEqual(second.queue, first.queue);
  assert.deepEqual(first.queue.slice(index + 2).map(c => c.id), ['pool-04', 'pool-05']);
  assert.deepEqual(first.queue.slice(index + 2).map(c => c.answer), ['cap', 'kid']);
});

test('closed authored assignment scope cannot be widened to the extra confirmation item', () => {
  const g = coach(), item = find('pool-02'), meta = caseMetadata(item), queue = composeShift(pool), index = queue.indexOf(item);
  exposed(g, item);
  const assignment = { ...meta, familyKeys: [meta.familyKey], itemKeys: [meta.itemKey], requiredAttempts: 1 };
  const plan = immediateCheck({ venue: pool, queue, index, item, coach: g, assignment });
  assert.equal(plan.status, 'unavailable'); assert.equal(plan.item, null); assert.deepEqual(plan.queue, queue);
});

test('a helped correct answer can confirm with a fresh item, without relabelling the helped answer independent', () => {
  const g = coach(), queue = composeShift(pool), item = find('pool-02'), index = queue.indexOf(item);
  const supported = exposed(g, item, true, true);
  const plan = immediateCheck({ venue: pool, queue, index, item, coach: g });
  assert.equal(supported.assisted, true); assert.equal(supported.independent, false);
  assert.equal(plan.status, 'new'); assert.equal(plan.item.id, 'pool-10');
  const confirmation = exposed(g, plan.item, true); assert.equal(confirmation.independent, true);
  const cell = g.summary().skills.find(skill => skill.id === item.skill).levels[1].formats['single-choice'];
  assert.equal(cell.n, 1, 'only the fresh unassisted confirmation adds independent evidence');
});

test('assigned confirmation keeps the item/family subset and does not add a fourth task item', () => {
  const g = coach(), item = find('pool-01'), next = find('pool-09'), queue = [item, next, find('pool-04')];
  const meta = caseMetadata(item), assignment = { ...meta, familyKeys: queue.map(row => caseMetadata(row).familyKey), itemKeys: queue.map(row => caseMetadata(row).itemKey), requiredAttempts: 3 };
  exposed(g, item);
  const plan = immediateCheck({ venue: pool, queue, index: 0, item, coach: g, assignment });
  assert.equal(plan.status, 'new'); assert.equal(plan.item, next); assert.equal(plan.queue.length, 3);
  assert.ok(assignment.itemKeys.includes(caseMetadata(plan.item).itemKey));
});

test('answered, revealed and shown-only items are never claimed to be fresh visible scenes', () => {
  for (const kind of ['answer', 'reveal', 'shown']) {
    const g = coach(), old = find('pool-10');
    if (kind === 'answer') exposed(g, old); else { const pid = g.present(caseMetadata(old)); if (kind === 'reveal') g.help(pid, 'answer'); }
    const queue = composeShift(pool), item = find('pool-02'), index = queue.indexOf(item); exposed(g, item);
    const plan = immediateCheck({ venue: pool, queue, index, item, coach: g });
    assert.notEqual(plan.item?.id, old.id, kind);
    if (plan.status === 'new') assert.equal(plan.item.id, 'pool-13', kind);
  }
});

test('missing exposure, new item in another venue, changed difficulty and end of shift do not invent a new confirmation', () => {
  const queue = composeShift(pool), item = find('pool-02'), index = queue.indexOf(item);
  assert.notEqual(immediateCheck({ venue: pool, queue, index, item, coach: {} }).status, 'new');
  const exhausted = { exposure: () => ({ seen: true }), events: () => [] };
  assert.notEqual(immediateCheck({ venue: pool, queue, index, item, coach: exhausted }).status, 'new');
  const last = immediateCheck({ venue: pool, queue, index: queue.length - 1, item: queue.at(-1), coach: coach() }); assert.equal(last.status, 'round-end');
  const onlyHarder = { ...pool, cases: pool.cases.filter(c => !['pool-10', 'pool-13'].includes(c.id)) };
  assert.notEqual(immediateCheck({ venue: onlyHarder, queue, index, item, coach: coach() }).status, 'new');
});

test('an already-seen next item is explicitly a review and uses the existing authored item', () => {
  const g = coach(), item = find('pool-04'), next = find('pool-01'); exposed(g, next, true);
  // A chronological fixture with no other same-measure authored candidate.
  const current = { ...item, at: '13:00' }, later = { ...next, at: '14:02' }, venue = { ...pool, cases: [current, later] };
  const plan = immediateCheck({ venue, queue: [current, later], index: 0, item: current, coach: g });
  assert.equal(plan.status, 'review'); assert.match(plan.line, /이미 본.*복습/); assert.equal(plan.item, later);
});

test('the same skill with another measured expression never claims the same rule', () => {
  const original = find('pool-02'), candidate = { ...find('pool-10'), evidence: ['cap'] };
  const queue = [original, candidate], venue = { ...pool, cases: queue };
  const plan = immediateCheck({ venue, queue, index: 0, item: original, coach: { exposure: () => ({ seen: false }), events: () => [] } });
  assert.equal(plan.status, 'new'); assert.match(plan.line, /규칙·표현은 달라질 수/); assert.doesNotMatch(plan.line, /같은 안내 규칙/);
});
