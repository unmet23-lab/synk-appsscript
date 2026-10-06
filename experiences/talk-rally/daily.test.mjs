// 하루 도전: 날짜만으로 정하는 같은 12번, 그날의 카드 순서, 개인 기록(최고·판 수·연속 일수·최근 7일).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SKILL_LABEL, ROUND_SIZE } from './content.mjs';
import { seoulDate as coinDate } from '../korean-racing/garage-core.js';
import { seoulDate, addDays, weekday, dateSeed, dailyRound, dailyOptions, emptyRecords, normalizeRecords, recordDaily, streak, dailyStatus, recentDays, KEEP_DAYS } from './daily.mjs';

const result = (score, correct = 10, more = {}) => ({ score, correct, total: 12, stars: 2, bestRally: 5, ...more });

test('서울 날짜는 공통 코인의 하루와 같고, 날짜 셈·요일이 맞다', () => {
  for (const t of [Date.parse('2026-10-06T14:59:59Z'), Date.parse('2026-10-06T15:00:00Z'), Date.parse('2026-12-31T16:30:00Z'), 0]) assert.equal(seoulDate(t), coinDate(t));
  assert.equal(seoulDate(Date.parse('2026-10-06T15:00:00Z')), '2026-10-07', '서울 자정에 바뀐다');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28'); assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekday('2026-10-07'), '수');
});

test('그날의 12번: 같은 날이면 같고, 날마다 다르며, 보통 판의 규칙(두 학습 항목 4개 이상, 쉬운 것부터)을 지킨다', () => {
  const ids = (d) => dailyRound(d).map((x) => x.id).join();
  assert.equal(ids('2026-10-07'), ids('2026-10-07'));
  const days = Array.from({ length: 30 }, (_, i) => addDays('2026-10-01', i));
  assert.ok(new Set(days.map(ids)).size >= 29, '30일 동안 판이 거의 모두 다르다');
  let hard = 0;
  for (const d of days) {
    const round = dailyRound(d);
    assert.equal(round.length, ROUND_SIZE);
    assert.equal(new Set(round.map((x) => x.id)).size, ROUND_SIZE, '같은 말이 두 번 나오지 않는다');
    for (const skill of Object.keys(SKILL_LABEL)) assert.ok(round.filter((x) => x.skill === skill).length >= 4, `${d} ${skill}`);
    assert.ok(round.every((x, i) => i === 0 || round[i - 1].difficulty <= x.difficulty), `${d} 쉬운 것부터`);
    hard += round.filter((x) => x.difficulty === 2).length;
  }
  assert.ok(hard / days.length >= 2 && hard / days.length <= 7, `조금 어려운 말이 하루 평균 ${(hard / days.length).toFixed(1)}개 섞인다`);
  assert.notEqual(dateSeed('talk-rally:2026-10-07'), dateSeed('talk-rally:2026-10-08'));
});

test('그날 그 말의 대답 카드 순서는 모두에게 같고, 정답 자리가 한쪽으로 쏠리지 않는다', () => {
  const slots = [0, 0, 0];
  for (let i = 0; i < 20; i++) {
    const date = addDays('2026-10-01', i);
    for (const item of dailyRound(date)) {
      const a = dailyOptions(item, date), b = dailyOptions(item, date);
      assert.deepEqual(a, b);
      assert.deepEqual([...a].sort(), [...item.options].sort(), '보기 셋 그대로');
      slots[a.indexOf(item.answer)] += 1;
    }
  }
  for (const n of slots) assert.ok(n / 240 > 0.25 && n / 240 < 0.42, `정답 자리 분포 ${slots.join('/')}`);
});

test('기록: 그날 첫 판은 새 최고가 아니고, 앞선 최고를 넘을 때만 새 최고다. 판 수를 센다', () => {
  let r = recordDaily(emptyRecords(), '2026-10-07', result(900));
  assert.equal(r.first, true); assert.equal(r.newBest, false); assert.equal(r.best.score, 900); assert.equal(r.plays, 1);
  r = recordDaily(r.records, '2026-10-07', result(700));
  assert.equal(r.newBest, false); assert.equal(r.best.score, 900, '낮은 판은 최고를 바꾸지 않는다'); assert.equal(r.plays, 2);
  r = recordDaily(r.records, '2026-10-07', result(900, 12));
  assert.equal(r.newBest, false, '같은 점수는 새 최고가 아니다'); assert.equal(r.best.correct, 10);
  r = recordDaily(r.records, '2026-10-07', result(1240, 11, { stars: 2, bestRally: 8 }));
  assert.equal(r.newBest, true); assert.equal(r.prevBest, 900); assert.equal(r.plays, 4);
  assert.deepEqual(r.best, { score: 1240, correct: 11, total: 12, stars: 2, rally: 8 });
  assert.deepEqual(dailyStatus(r.records, '2026-10-07'), { played: true, best: r.best, plays: 4, streak: 1 });
});

test('연속 일수: 오늘까지 이어진 날 수, 오늘 아직이면 어제까지(이어 갈 수 있음), 하루 빠지면 처음부터', () => {
  let rec = emptyRecords();
  assert.equal(streak(rec, '2026-10-07'), 0);
  for (const d of ['2026-10-03', '2026-10-05', '2026-10-06']) rec = recordDaily(rec, d, result(500)).records;
  assert.equal(streak(rec, '2026-10-07'), 2, '오늘 아직 안 했어도 어제까지 이틀');
  rec = recordDaily(rec, '2026-10-07', result(600)).records;
  assert.equal(streak(rec, '2026-10-07'), 3);
  assert.equal(streak(rec, '2026-10-09'), 0, '어제를 건너뛰면 끊긴다');
  assert.equal(dailyStatus(rec, '2026-10-08').played, false);
});

test('최근 7일: 오래된 날부터 오늘까지, 안 한 날은 비워 둔다', () => {
  let rec = emptyRecords();
  rec = recordDaily(rec, '2026-10-05', result(800)).records;
  rec = recordDaily(rec, '2026-10-07', result(1240)).records;
  const week = recentDays(rec, '2026-10-07');
  assert.equal(week.length, 7);
  assert.deepEqual(week.map((d) => d.date), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
  assert.deepEqual(week.map((d) => d.best), [null, null, null, null, 800, null, 1240]);
  assert.deepEqual(week.map((d) => d.weekday), ['목', '금', '토', '일', '월', '화', '수']);
  assert.ok(week[6].today && !week[5].today);
});

test('저장된 기록이 깨져도 읽히고, 최근 60일만 남는다', () => {
  for (const bad of [null, 'x', 7, [], { days: [] }, { days: { 'not-a-day': { plays: 1, best: { score: 1 } } } }]) assert.deepEqual(normalizeRecords(bad), emptyRecords());
  const mixed = normalizeRecords({ v: 1, days: {
    '2026-10-01': { plays: 2, best: { score: 800, correct: 9, total: 12, stars: 1, rally: 4 } },
    '2026-10-02': { plays: 0, best: { score: 800, correct: 9, total: 12, stars: 1, rally: 4 } },
    '2026-10-03': { plays: 1, best: { score: -5, correct: 9, total: 12, stars: 1, rally: 4 } },
    '2026-10-04': { plays: 1, best: { score: 10, correct: 13, total: 12, stars: 1, rally: 4 } },
    '__proto__': { plays: 1 } } });
  assert.deepEqual(Object.keys(mixed.days), ['2026-10-01']);
  let rec = emptyRecords();
  for (let i = 0; i < KEEP_DAYS + 10; i++) rec = recordDaily(rec, addDays('2026-06-01', i), result(100 + i)).records;
  assert.equal(Object.keys(rec.days).length, KEEP_DAYS);
  assert.ok(!rec.days['2026-06-01'] && rec.days[addDays('2026-06-01', KEEP_DAYS + 9)]);
});
