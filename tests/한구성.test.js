'use strict';
// 한 구성 구간(tools/한구성.js) — 네트워크 · ffmpeg 없이 장면 나누기와 판정만 본다. 장면은 합성이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { segment, judge, norm, same, STEP } = require('../tools/한구성.js');

const 무늬 = (seed, n = 600) => Float64Array.from({ length: n }, (_, i) => 128 + 90 * Math.sin(i * 0.37 * seed + seed));
const 반복 = (v, n) => Array.from({ length: n }, () => v);

test('밝기 · 대비만 바뀐 장면은 같은 구성이고, 다른 그림은 새 구성이다', () => {
  const a = 무늬(1);
  const 어둡게 = a.map((x) => x * 0.4 + 10); // 카드를 어둡게 덮은 것(10-28 Y19 · E8 흑백 칸)
  const b = 무늬(2.3);
  assert.equal(same(norm(a), norm(어둡게)), true);
  assert.equal(same(norm(a), norm(b)), false);
  // 거의 한 색인 화면끼리는 밝기가 달라도 같은 구성(12초 어두운 빈 화면 — E4), 한 색 화면과 그림은 다른 구성
  assert.equal(same(norm(new Float64Array(600).fill(20)), norm(new Float64Array(600).fill(60))), true);
  assert.equal(same(norm(new Float64Array(600).fill(20)), norm(a)), false);
});

test('구간 나누기 — 같은 구성이 이어진 초를 0.25초 칸으로 잰다', () => {
  const a = norm(무늬(1)), b = norm(무늬(2.3)), c = norm(무늬(3.7));
  const 장면 = [...반복(a, 8), ...반복(norm(무늬(1).map((x) => x * 0.5)), 20), ...반복(b, 12), ...반복(c, 16)];
  const 구간 = segment(장면);
  assert.deepEqual(구간.map((s) => [s.start, s.end]), [[0, 7], [7, 10], [10, 14]]);
  assert.equal(STEP, 0.25);
});

test('판정 — 끝 화면 말고 4초(+한 칸) 넘는 구성은 고칠 것, 끝 화면은 6초까지', () => {
  const r = judge([{ start: 0, end: 7, length: 7 }, { start: 7, end: 11.25, length: 4.25 }, { start: 11.25, end: 17, length: 5.75 }]);
  assert.deepEqual(r.long.map((s) => [s.start, s.endCard]), [[0, false]], '4.25초는 한 칸 봐준다(퀴즈 #5 예문 칸) · 끝 화면 5.75초는 통과');
  assert.equal(r.pass, false);
  assert.equal(r.longest, 7);
  const 끝 = judge([{ start: 0, end: 3, length: 3 }, { start: 3, end: 9.5, length: 6.5 }]);
  assert.deepEqual(끝.long.map((s) => s.endCard), [true], '끝 화면도 6초를 넘으면 걸린다');
  assert.equal(judge([{ start: 0, end: 4, length: 4 }]).pass, true);
});
