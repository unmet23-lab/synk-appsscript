// Offline authored-content checks; these do not substitute for teacher review.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { VENUES, CAST, SHIFT_SIZE } from './content.mjs';
import { activeRules, composeShift, minutes, validateContent } from './core.mjs';
import { answerPayload, caseMetadata } from './learning.mjs';
import { choiceId, immediateCheck } from './correction.mjs';
const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
const pairs = [
  ['pool', 'pool-04', 'pool-14', 'cap', ['G403'], '수영 모자 보유와 입장 전 착용'],
  ['library', 'library-02', 'library-10', 'card', ['G402'], '본인의 도서관 카드 보유'],
  ['library', 'library-04', 'library-11', 'food', ['G402', 'G401'], '음료의 뚜껑 조건'],
  ['museum', 'museum-01', 'museum-09', 'camera', ['G402'], '휴대폰 허용'],
  ['museum', 'museum-02', 'museum-10', 'camera', ['G402'], '카메라 반입 금지'],
  ['museum', 'museum-03', 'museum-11', 'fee', ['G212', 'S107', 'G402'], '13살 이하 어린이 표와 어른 표 구분'],
  ['concert', 'concert-01', 'concert-10', 'date', ['G212', 'G402'], '일정 변경 뒤에도 9일 표 허용'],
  ['concert', 'concert-02', 'concert-11', 'chair', ['G505', 'G402'], '의자 반입 금지'],
  ['concert', 'concert-03', 'concert-12', 'date', ['G212', 'G402'], '표 날짜와 안내문의 허용 날짜 대조'],
  ['concert', 'concert-05', 'concert-13', 'food', ['S104', 'G402'], '6시 25분 알림 뒤 음식 반입 금지'],
  ['concert', 'concert-07', 'concert-14', 'kid', ['G212', 'G403'], '7살 이하 어린이의 보호자 동행'],
];
const byVenue = id => VENUES.find(venue => venue.id === id);
const find = (venue, id) => venue.cases.find(item => item.id === id);
const row = (item, label) => item.doc?.rows.find(([key]) => key === label)?.[1];
const sameSet = (a, b) => [...a].sort().join('|') === [...b].sort().join('|');
function coach() {
  const data = new Map();
  return createGame({ gameId: 'entry-check', map, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } });
}
function answer(g, item, correct) {
  return g.answer(g.present(caseMetadata(item)), answerPayload(correct, {
    selectedId: choiceId(correct ? item.answer : item.answer === 'pass' ? item.evidence[0] : 'pass'), correctId: choiceId(item.answer),
  }));
}

// Independently check the new scenes against the authored notice's concrete facts.
// The limits below are asserted against the notice before checking the case;
// these rules describe this fictional game, not general venue policies.
function factualViolations(venue, item) {
  const items = item.items.map(entry => Array.isArray(entry) ? entry[0] : entry), violations = [];
  const food = items.some(id => ['gimbap', 'snack'].includes(id));
  if (venue.id === 'pool') {
    assert.match(venue.notice.rules.find(rule => rule.id === 'cap').text, /모자를 꼭 써야/);
    if (!items.includes('swim-cap')) violations.push('cap');
    if (food) violations.push('food');
    assert.match(row(item, '구분'), /어른/);
  } else if (venue.id === 'library') {
    assert.match(venue.notice.rules.find(rule => rule.id === 'card').text, /도서관 카드.*다른 사람/);
    if (item.doc.title !== '별빛 도서관 카드' || row(item, '이름') !== CAST[item.who].name) violations.push('card');
    if (food || items.includes('coffee-open')) violations.push('food');
    assert.match(venue.notice.rules.find(rule => rule.id === 'food').text, /음료는 뚜껑이 있으면/);
    assert.match(venue.notice.rules.find(rule => rule.id === 'time').text, /5시 30분부터/);
    if (minutes(item.at) >= minutes('17:30')) violations.push('time');
  } else if (venue.id === 'museum') {
    assert.match(venue.notice.rules.find(rule => rule.id === 'camera').text, /카메라는 가지고 들어갈 수 없.*휴대폰은 괜찮/);
    if (items.includes('camera')) violations.push('camera');
    const age = Number(row(item, '나이').match(/\d+/)[0]), ticket = row(item, '표');
    assert.match(venue.notice.rules.find(rule => rule.id === 'fee').text, /13살 이하.*65살 이상/);
    if ((ticket === '어린이' && age > 13) || (ticket === '무료' && age < 65)) violations.push('fee');
    assert.match(venue.notice.rules.find(rule => rule.id === 'time').text, /5시까지만/);
    if (minutes(item.at) > minutes('17:00')) violations.push('time');
  } else if (venue.id === 'concert') {
    const ticketDate = row(item, '날짜');
    assert.match(venue.notice.rules.find(rule => rule.id === 'date').text, /10일.*9일 표로 들어올 수/);
    if (ticketDate !== '8월 9일 토요일') violations.push('date');
    assert.match(venue.notice.rules.find(rule => rule.id === 'chair').text, /돗자리는 가지고 와도.*의자는 가지고 올 수 없/);
    if (items.includes('chair')) violations.push('chair');
    if (activeRules(venue, item.at).some(rule => rule.id === 'food') && food) violations.push('food');
    if (item.id === 'concert-14') {
      assert.match(venue.notice.rules.find(rule => rule.id === 'kid').text, /7살 이하.*보호자와 함께/);
      assert.match(row(item, '구분'), /어른 1명.*어린이 1명\(7살\)/);
      assert.match(item.line, /일곱 살.*엄마.*함께/);
    } else assert.match(row(item, '구분'), /어른/);
  }
  return violations;
}

test('eleven added confirmations keep authored facts, correct rule, explanation and fixed identity aligned', () => {
  assert.deepEqual(validateContent(), []);
  for (const [venueId, from, to, rule, concepts] of pairs) {
    const venue = byVenue(venueId), original = find(venue, from), item = find(venue, to);
    assert.equal(item.followupOnly, true); assert.equal(item.textOnly, true);
    assert.ok(fs.existsSync(new URL(CAST[item.who].img, import.meta.url)), item.id);
    assert.ok(row(item, '이름').startsWith(CAST[item.who].name), item.id);
    if (venueId === 'museum') assert.equal(row(item, '나이'), `${CAST[item.who].age}살`);
    const violations = factualViolations(venue, item);
    assert.deepEqual(violations, item.answer === 'pass' ? [] : [item.answer], item.id);
    assert.deepEqual(item.evidence, [rule]); assert.deepEqual(caseMetadata(item).conceptIds, concepts);
    assert.equal(caseMetadata(item).itemKey, `entry-check.${to}.v1`);
    assert.equal(caseMetadata(item).familyKey, caseMetadata(item).itemKey);
    assert.notEqual(item.id, original.id); assert.notEqual(item.line, original.line); assert.notEqual(item.why, original.why);
    assert.doesNotMatch(item.why, /오개념|숙달|급수|약점/);
  }
  const library = byVenue('library'), museum = byVenue('museum'), concert = byVenue('concert');
  assert.match(find(library, 'library-10').why, /나래 씨 이름이 적힌 도서관 카드/);
  assert.match(find(library, 'library-11').why, /음료는 뚜껑이 있으면/);
  assert.match(find(museum, 'museum-09').why, /휴대폰은 괜찮.*카메라가 없/);
  assert.match(find(museum, 'museum-10').why, /카메라는 가지고 들어갈 수 없.*카메라가 있어/);
  assert.match(find(museum, 'museum-11').why, /13살 이하.*21살.*어른 표/);
  assert.match(find(concert, 'concert-10').why, /10일로 바뀌었지만.*9일 표/);
  assert.match(find(concert, 'concert-12').why, /9일 표.*10일로 바뀌었지만.*9일 표도 된다/);
  assert.match(find(concert, 'concert-13').why, /6시 25분.*6시 30분.*과자도 음식/);
  assert.match(find(concert, 'concert-14').why, /7살 이하.*7살.*엄마와 함께/);
  const added = pairs.map(([venueId, , to]) => find(byVenue(venueId), to));
  assert.equal(added.filter(item => item.answer === 'pass').length, 8);
  assert.equal(added.filter(item => item.answer !== 'pass').length, 3);
});

test('the original 34 guests and all four default six-person shifts remain unchanged', () => {
  assert.equal(VENUES.flatMap(venue => venue.cases).filter(item => !item.followupOnly).length, 34);
  assert.equal(VENUES.flatMap(venue => venue.cases).length, 50);
  const expected = {
    pool: ['pool-01', 'pool-02', 'pool-03', 'pool-04', 'pool-05', 'pool-06'],
    library: ['library-01', 'library-02', 'library-03', 'library-04', 'library-05', 'library-09'],
    museum: ['museum-01', 'museum-02', 'museum-03', 'museum-04', 'museum-05', 'museum-08'],
    concert: ['concert-01', 'concert-02', 'concert-03', 'concert-05', 'concert-07', 'concert-08'],
  };
  for (const venue of VENUES) {
    assert.deepEqual(composeShift(venue, { firstTime: true }).map(item => item.id), expected[venue.id]);
    const ranked = venue.cases.filter(item => item.followupOnly).map(item => item.id);
    assert.equal(composeShift(venue, { ranked }).length, SHIFT_SIZE);
    assert.ok(composeShift(venue, { ranked }).every(item => !item.followupOnly));
  }
});

for (const [venueId, from, to, rule, concepts, learningTarget] of pairs) test(`${from} → ${to}: fresh same-target check (${learningTarget})`, () => {
  const venue = byVenue(venueId), queue = composeShift(venue, { firstTime: true }), item = find(venue, from), index = queue.indexOf(item), g = coach();
  for (const previous of queue.slice(0, index)) answer(g, previous, true);
  const source = answer(g, item, false);
  const plan = immediateCheck({ venue, queue, index, item, coach: g });
  assert.equal(plan.status, 'new'); assert.equal(plan.item.id, to); assert.match(plan.line, /같은 안내 규칙/);
  assert.equal(plan.queue.length, SHIFT_SIZE); assert.equal(new Set(plan.queue.map(c => c.id)).size, SHIFT_SIZE);
  assert.deepEqual(plan.queue.slice(0, index + 1), queue.slice(0, index + 1));
  assert.ok(plan.queue.every((c, i) => !i || minutes(plan.queue[i - 1].at) < minutes(c.at)));
  for (const expectedAnswer of new Set(queue.map(c => c.answer))) assert.ok(plan.queue.some(c => c.answer === expectedAnswer));
  if (venue.memo) {
    assert.ok(plan.queue.some(c => minutes(c.at) < minutes(venue.memo.at)));
    assert.ok(plan.queue.filter(c => minutes(c.at) >= minutes(venue.memo.at)).length >= 2);
  }
  const before = caseMetadata(item), after = caseMetadata(plan.item);
  for (const key of ['skillId', 'difficulty', 'modality', 'responseFormat']) assert.equal(after[key], before[key]);
  assert.deepEqual(plan.item.evidence, [rule]); assert.ok(sameSet(before.conceptIds, concepts)); assert.ok(sameSet(after.conceptIds, concepts));
  const result = answer(g, plan.item, true); assert.equal(result.independent, true); assert.equal(result.exposure, 'new');
  assert.equal(g.recheck(source.eventId, result.eventId).status, 'independent-correct');
});

test('new confirmations cannot cross WORLD item/family scope, a prior screen exposure or missing history', () => {
  for (const [venueId, from, to] of pairs) {
    const venue = byVenue(venueId), queue = composeShift(venue, { firstTime: true }), item = find(venue, from), target = find(venue, to), index = queue.indexOf(item), meta = caseMetadata(item);
    const assignment = { ...meta, familyKeys: [meta.familyKey], itemKeys: [meta.itemKey], requiredAttempts: 1 };
    assert.notEqual(immediateCheck({ venue, queue, index, item, coach: coach(), assignment }).status, 'new');
    const g = coach(); g.present(caseMetadata(target)); answer(g, item, false);
    assert.notEqual(immediateCheck({ venue, queue, index, item, coach: g }).item?.id, to);
    assert.notEqual(immediateCheck({ venue, queue, index, item, coach: {} }).status, 'new');
  }
});

test('fixed first-shift coverage excludes four final slots and preserves the three unresolved learning-target limits', () => {
  let fresh = 0, exact = 0, nonFinal = 0;
  const results = new Map();
  for (const venue of VENUES) {
    const queue = composeShift(venue, { firstTime: true });
    for (const [index, item] of queue.entries()) {
      const plan = immediateCheck({ venue, queue, index, item, coach: { exposure: () => ({ seen: false }), events: () => [] } });
      results.set(item.id, plan);
      if (plan.status !== 'round-end') nonFinal++;
      if (plan.status === 'new') {
        fresh++;
        if (sameSet(item.evidence, plan.item.evidence) && sameSet(caseMetadata(item).conceptIds, caseMetadata(plan.item).conceptIds)) exact++;
      }
    }
  }
  assert.equal(nonFinal, 20); assert.equal(fresh, 18); assert.equal(exact, 17);
  assert.equal(results.get('museum-04').status, 'unavailable');
  assert.equal(results.get('museum-05').status, 'unavailable');
  assert.equal(results.get('library-05').item.id, 'library-09');
  assert.match(results.get('library-05').line, /규칙·표현은 달라질 수/);
});
