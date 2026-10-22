'use strict';
// 싱크타운 결정적 난수(세로 조각 설계 §2-4) — 같은 입력이면 브라우저·Node·talk에서 같은 수가 나와야 한다.
// 아래 고정값이 바뀌면 이미 저장된 마을의 계획이 달라진다. 알고리즘을 바꿀 때는 저장 판(schema)을 함께 올린다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule } = require('./lib/town.js');

test('문자열 해시와 생성기는 고정값을 낸다', async () => {
  const { hashString, createRng, seedKey } = await townModule('rng');
  assert.deepEqual([hashString(''), hashString('찻집 골목'), hashString('9f3a'), hashString(seedKey('plan', 20748, 'cafe-owner'))],
    [167010153, 4080583940, 1387746142, 3371893540]);
  const r = createRng('9f3a', 'plan', 20748, 'evening', 'cafe-owner', 211);
  assert.deepEqual([r.next(), r.next(), r.next(), r.below(1000), r.between(5, 8)], [305080663, 2339248941, 4169458812, 221, 6]);
});

test('같은 조각이면 같은 수열, 조각이 하나라도 다르면 다른 수열', async () => {
  const { createRng } = await townModule('rng');
  const draw = (...parts) => { const r = createRng(...parts); return Array.from({ length: 8 }, () => r.next()); };
  assert.deepEqual(draw('v', 1, 'day'), draw('v', 1, 'day'));
  assert.notDeepEqual(draw('v', 1, 'day'), draw('v', 2, 'day'));
  assert.notDeepEqual(draw('v', 12, 'x'), draw('v', 1, '2x'), '조각 경계가 섞이지 않는다');
  assert.throws(() => createRng('v', 1.5), /safe integers/);
  assert.throws(() => createRng('v', { day: 1 }), /safe integers/);
});

test('가중치 고르기는 정수 누적합의 ⌊u × 총합 / 2³²⌋ 자리다', async () => {
  const { pickByWeight, createRng } = await townModule('rng');
  assert.equal(pickByWeight(0, [0, 5, 5]), 1, '가중치 0인 칸은 고르지 않는다');
  assert.equal(pickByWeight(0xffffffff, [5, 5, 0]), 1);
  assert.equal(pickByWeight(2147483647, [1, 1]), 0);
  assert.equal(pickByWeight(2147483648, [1, 1]), 1);
  assert.equal(pickByWeight(5, [0, 0]), -1);
  assert.throws(() => pickByWeight(1.5, [1]), RangeError);
  assert.throws(() => pickByWeight(1, [0.5]), RangeError);
  assert.throws(() => pickByWeight(2 ** 32, [1]), RangeError);
  const counts = [0, 0, 0], r = createRng('dist');
  for (let i = 0; i < 30000; i++) counts[pickByWeight(r.next(), [300, 600, 100])]++;
  assert.deepEqual(counts, [9058, 18022, 2920]);
});

test('범위·확률 도우미는 정수만 내고 끝값을 지킨다', async () => {
  const { createRng } = await townModule('rng');
  const r = createRng('ranges');
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const n = r.between(6, 10);
    assert.ok(Number.isInteger(n) && n >= 6 && n <= 10);
    seen.add(n);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [6, 7, 8, 9, 10]);
  let yes = 0;
  for (let i = 0; i < 10000; i++) if (r.chance(250)) yes++;
  assert.ok(yes > 2300 && yes < 2700, `chance(250) ≈ 25% (${yes})`);
  assert.equal(r.chance(0), false);
  assert.equal(r.chance(1000), true);
  assert.throws(() => r.below(0), RangeError);
  assert.throws(() => r.pick([]), RangeError);
});
