// 30일째 문장의 제품 쪽(4-4c — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-7): 하나 고르기(pickMonth)와 이유(monthWhy).
// 이름이 서는 단위만 고르고(21-4), 앞 창 놓친 자리 수와 뒤 창 자리 수의 합이 큰 것, 같으면 (날짜 열쇠 | 단위 id) 해시 차례다(Vellum 고르기와 같은
// 규칙). 이유는 엔진의 monthReason과 같은 꼴이고, 엔진의 Vellum이 승인된 한국어 문장으로 짓는다. 변형 시험은 깬 사본을 SYNK_LOOKBACK_NEXT_MODULE로
// 넘긴다(qa/position-mutants.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';

const { pickMonth, monthWhy } = await import(
  process.env.SYNK_LOOKBACK_NEXT_MODULE ? pathToFileURL(process.env.SYNK_LOOKBACK_NEXT_MODULE).href : '../world-lookback-next.mjs'
);

const routesOf = names => new Map(Object.entries(names).map(([unit, label]) => [unit, { unit, label }]));
const row = (unit, misses, reviews, extra = {}) => ({ unit, misses, reviews, last: 100, evidence: { misses, reviews }, ...extra });

test('이름이 서는 단위만 고른다 — 수가 더 커도 이름 없는 단위는 건너뛴다(21-4 · 카본 설계 검토 A11)', () => {
  const routes = routesOf({ 'ko.grammar.seyo': '-(으)세요', 'ko.word.empty': '  ' });
  const pick = pickMonth({ month: [row('ko.word.nameless', 9, 9), row('ko.word.empty', 8, 8), row('ko.grammar.seyo', 2, 3)], routes, day: 20261116 });
  assert.deepEqual(pick, {
    unit: 'ko.grammar.seyo',
    label: '-(으)세요',
    misses: 2,
    reviews: 3,
    last: 100,
    evidence: { misses: 2, reviews: 3 },
  });
  assert.ok(Object.isFrozen(pick));
  assert.equal(pickMonth({ month: [row('ko.word.nameless', 9, 9)], routes, day: 1 }), null, '이름이 서는 단위가 없으면 null');
  assert.equal(pickMonth({ month: [], routes }), null);
  assert.equal(pickMonth({ month: null, routes }), null);
  assert.equal(pickMonth({ month: [row('ko.grammar.seyo', 2, 3)], routes: null }), null, '이름 길이 없으면 고르지 않는다');
});

test('놓친 자리 수와 뒤 창 자리 수의 합이 큰 것을 고르고, 같으면 날짜 열쇠와 단위 id의 해시로 정한다 — 같은 날에는 같은 말, 받은 차례를 타지 않는다', () => {
  const names = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`ko.word.u${i}`, `낱말${i}`]));
  const routes = routesOf(names);
  // 놓친 자리가 가장 많은 것(u2)이 아니라 합이 가장 큰 것(u1)이다.
  assert.equal(
    pickMonth({ month: [row('ko.word.u1', 2, 9), row('ko.word.u2', 3, 4), row('ko.word.u3', 2, 4)], routes, day: 5 }).unit,
    'ko.word.u1',
    '합이 큰 것',
  );
  // 합이 같은 열둘 — 날마다 고른 것이 받은 차례와 상관없이 같고, 날이 바뀌면 다른 단위도 고른다.
  const tied = Object.keys(names).map(unit => row(unit, 2, 3));
  const chosen = new Set();
  for (let day = 20261101; day < 20261131; day += 1) {
    const one = pickMonth({ month: tied, routes, day }).unit;
    assert.equal(pickMonth({ month: [...tied].reverse(), routes, day }).unit, one, `받은 차례를 타지 않는다(${day})`);
    chosen.add(one);
  }
  assert.ok(chosen.size > 1, '날이 바뀌면 고르는 단위도 바뀐다');
});

test('수가 정수가 아니거나 음수인 줄은 고르지 않는다 · 마지막 때를 모르면 null', () => {
  const routes = routesOf({ a: '가', b: '나', c: '다', d: '라' });
  const month = [row('a', Number.NaN, 9), row('b', -1, 9), row('c', 2, 2.5), row('d', 2, 3, { last: undefined })];
  const pick = pickMonth({ month, routes, day: 1 });
  assert.equal(pick.unit, 'd');
  assert.equal(pick.last, null);
});

test('이유는 엔진의 monthReason과 같은 꼴이고, 엔진의 Vellum이 승인된 한국어 문장으로 짓는다(영어 · 몽골어는 줄이 없어 null)', () => {
  const routes = routesOf({ 'ko.grammar.seyo': '-(으)세요' });
  const pick = pickMonth({ month: [row('ko.grammar.seyo', 3, 7)], routes, day: 1 });
  const why = monthWhy(pick);
  assert.deepEqual(why, atlas.monthReason(pick));
  assert.equal(why.code, atlas.PROGRESS_CODES.month);
  const label = id => routes.get(id)?.label ?? null;
  assert.equal(
    atlas.renderReason(why, { lang: 'ko', label }),
    '한 달 전에 3번 놓친 「-(으)세요」, 그 뒤로 7번 모두 혼자 맞혔어요.',
  );
  assert.equal(atlas.renderReason(why, { lang: 'en', label }), null);
  assert.equal(atlas.renderReason(why, { lang: 'mn', label }), null);
  assert.equal(monthWhy(null), null);
});
