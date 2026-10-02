import test from 'node:test';
import assert from 'node:assert/strict';
import { VENUES, CAST, SHIFT_SIZE } from './content.mjs';
import { koreanTime, minutes, activeRules, memoActive, choicesFor, judge, composeShift, scoreShift, unlocked, validateContent } from './core.mjs';

test('원고: 모든 손님이 그 시각에 있는 규칙 하나만 어기거나 통과한다', () => {
  assert.deepEqual(validateContent(), []);
  for (const v of VENUES) for (const c of v.cases) {
    assert.ok(choicesFor(v, c.at).includes(c.answer), `${c.id}의 정답이 보기 안에 있다`);
    assert.ok(CAST[c.who], `${c.id} 손님 그림`);
  }
});

test('원고: 근무지마다 통과·거절이 섞이고, 규칙마다 거절 손님이 한 명 이상 있다', () => {
  for (const v of VENUES) {
    const ruleIds = [...v.notice.rules.map((r) => r.id), ...(v.memo ? [v.memo.rule.id] : [])];
    for (const id of ruleIds) assert.ok(v.cases.some((c) => c.answer === id), `${v.id}: ${id} 규칙을 어기는 손님`);
    assert.ok(v.cases.filter((c) => c.answer === 'pass').length >= 3, `${v.id}: 통과 손님 3명 이상`);
  }
});

test('시각: 한국어 시각 표기와 근무 중 알림', () => {
  assert.equal(koreanTime('14:02'), '오후 2시 2분');
  assert.equal(koreanTime('17:30'), '오후 5시 30분');
  assert.equal(koreanTime('09:00'), '오전 9시');
  assert.equal(koreanTime('12:05'), '오후 12시 5분');
  const concert = VENUES.find((v) => v.id === 'concert');
  assert.equal(memoActive(concert, '18:19'), false);
  assert.equal(memoActive(concert, '18:25'), true);
  assert.deepEqual(activeRules(concert, '18:19').map((r) => r.id), ['date', 'chair', 'kid']);
  assert.deepEqual(activeRules(concert, '18:28').map((r) => r.id), ['date', 'chair', 'kid', 'food']);
  // 알림 전에 온 과자 손님은 통과, 알림 뒤의 김밥 손님은 음식 규칙으로 거절
  const before = concert.cases.find((c) => c.id === 'concert-04'), after = concert.cases.find((c) => c.id === 'concert-05');
  assert.equal(before.answer, 'pass'); assert.ok(minutes(before.at) < minutes(concert.memo.at));
  assert.equal(after.answer, 'food'); assert.ok(minutes(after.at) >= minutes(concert.memo.at));
});

test('판정: 통과·거절 이유가 모두 맞아야 정답이다', () => {
  const pool = VENUES[0], gimbap = pool.cases.find((c) => c.id === 'pool-02');
  assert.equal(judge(gimbap, 'food').correct, true);
  assert.equal(judge(gimbap, 'pass').correct, false);
  assert.equal(judge(gimbap, 'cap').correct, false, '거절은 맞아도 이유가 다르면 틀림');
  assert.equal(judge(pool.cases.find((c) => c.id === 'pool-03'), 'pass').correct, true);
});

test('근무 구성: 필요 순서를 따르되 통과·거절을 섞고 도착 시각 순서로 세운다', () => {
  for (const v of VENUES) {
    const ranked = [...v.cases].reverse().map((c) => c.id);
    const shift = composeShift(v, { ranked });
    assert.equal(shift.length, SHIFT_SIZE);
    assert.ok(shift.some((c) => c.answer === 'pass') && shift.filter((c) => c.answer !== 'pass').length >= 2, `${v.id} 섞임`);
    assert.deepEqual(shift.map((c) => minutes(c.at)), [...shift.map((c) => minutes(c.at))].sort((a, b) => a - b), `${v.id} 시각 순서`);
    if (v.memo) {
      const m = minutes(v.memo.at);
      assert.ok(shift.some((c) => minutes(c.at) < m) && shift.filter((c) => minutes(c.at) >= m).length >= 2, '알림 앞뒤 손님');
    }
  }
});

test('근무 구성: 어떤 필요 순서여도 안내문의 모든 규칙(알림 포함)을 어기는 손님을 한 번씩 만난다', () => {
  for (const v of VENUES) {
    const ruleIds = [...v.notice.rules.map((r) => r.id), ...(v.memo ? [v.memo.rule.id] : [])];
    for (const ranked of [null, v.cases.map((c) => c.id), [...v.cases].reverse().map((c) => c.id), v.cases.filter((c) => c.answer === 'pass').map((c) => c.id)]) {
      for (const firstTime of [false, true]) {
        const shift = composeShift(v, { ranked, firstTime });
        for (const id of ruleIds) assert.ok(shift.some((c) => c.answer === id), `${v.id}: ${id} 규칙 손님`);
        assert.ok(shift.some((c) => c.answer === 'pass'), `${v.id}: 통과 손님`);
        assert.equal(shift.length, SHIFT_SIZE);
      }
    }
  }
});

test('근무 구성: 아틀라스 순서가 바뀌면 실제 손님 구성이 바뀐다', () => {
  const lib = VENUES.find((v) => v.id === 'library');
  const negFirst = lib.cases.filter((c) => c.skill === 'ko.reading.condition').map((c) => c.id);
  const detailFirst = lib.cases.filter((c) => c.skill === 'ko.reading.detail').map((c) => c.id);
  const a = composeShift(lib, { ranked: negFirst }).map((c) => c.id);
  const b = composeShift(lib, { ranked: detailFirst }).map((c) => c.id);
  assert.notDeepEqual(a, b);
  for (const id of negFirst) assert.ok(a.includes(id), '필요한 학습 항목의 손님이 먼저 들어온다');
});

test('근무 구성: 처음 하는 사람은 쉬운 통과 손님부터', () => {
  const pool = VENUES[0];
  const shift = composeShift(pool, { ranked: pool.cases.filter((c) => c.answer !== 'pass').map((c) => c.id), firstTime: true });
  assert.ok(shift.some((c) => c.answer === 'pass' && c.difficulty === 1));
});

test('점수와 근무지 열림', () => {
  const r = (correct, skill = 'ko.reading.detail', hinted = false) => ({ correct, skill, hinted });
  assert.equal(scoreShift([r(true), r(true), r(true), r(true), r(true), r(true)]).stars, 3);
  assert.equal(scoreShift([r(true), r(true), r(true), r(true), r(true), r(false)]).stars, 2);
  assert.equal(scoreShift([r(true), r(true), r(true), r(false), r(false), r(false)]).stars, 1);
  assert.equal(scoreShift([r(true), r(false), r(false), r(false), r(false), r(false)]).stars, 0);
  const s = scoreShift([r(true), r(true, 'ko.reading.condition', true), r(false, 'ko.reading.condition'), r(true), r(true), r(true)]);
  assert.equal(s.bestRun, 3); assert.equal(s.helped, 1);
  assert.deepEqual(s.bySkill['ko.reading.condition'], { total: 2, correct: 1 });
  assert.equal(unlocked({ stars: {} }, 'pool'), true);
  assert.equal(unlocked({ stars: {} }, 'library'), false);
  assert.equal(unlocked({ stars: { pool: 1 } }, 'library'), true);
  assert.equal(unlocked({ stars: { pool: 1 } }, 'museum'), false);
});
