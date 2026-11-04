// 끌어넘기기 부품의 계산 함수 시험(화면 동작은 브라우저에서 잰다)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const R = require(path.join(__dirname, '..', 'experiences', 'play-common', 'drag-rail.js'));

test('스크롤 위치를 칸 단위 위치로 바꾸고 칸 너비가 0이면 0이다', () => {
  assert.equal(R.positionOf(600, 200), 3);
  assert.equal(R.positionOf(100, 200), 0.5);
  assert.equal(R.positionOf(100, 0), 0);
});

test('가운데 번호는 줄 범위를 벗어나지 않는다', () => {
  assert.equal(R.nearestIndex(2.4, 5), 2);
  assert.equal(R.nearestIndex(2.6, 5), 3);
  assert.equal(R.nearestIndex(-3, 5), 0);
  assert.equal(R.nearestIndex(99, 5), 4);
  assert.equal(R.nearestIndex(1, 0), 0, '빈 줄');
});

test('놓을 때 속도만큼 내다보되 네 칸 넘게 튀지 않고 끝을 넘지 않는다', () => {
  assert.equal(R.flickTarget(3, 0, 21), 3, '멈췄다 놓으면 가까운 칸');
  assert.equal(R.flickTarget(3.2, 0, 21), 3);
  assert.equal(R.flickTarget(3, 5, 21), 4, '보통 빠르기는 한 칸');
  assert.equal(R.flickTarget(3, -5, 21), 2);
  assert.equal(R.flickTarget(3, 500, 21), 7, '아주 빨라도 네 칸까지');
  assert.equal(R.flickTarget(19, 500, 21), 20, '끝을 넘지 않는다');
  assert.equal(R.flickTarget(1, -500, 21), 0);
});

test('가운데가 가장 크고 선명하며 멀수록 작아지고 양옆이 대칭이다', () => {
  const c = R.itemLook(0), n = R.itemLook(1), f = R.itemLook(2), ff = R.itemLook(3);
  assert.deepEqual([c.scale, c.sharp, c.opacity], [1, 1, 1]);
  assert.ok(c.scale > n.scale && n.scale > f.scale && f.scale > ff.scale);
  assert.equal(n.sharp, 0, '옆 사람은 흐린 판만 보인다');
  assert.equal(c.z > n.z, true);
  assert.deepEqual(R.itemLook(-1.5), R.itemLook(1.5));
  assert.equal(R.itemLook(4).opacity, 0, '멀리 있으면 그리지 않는다');
  assert.equal(R.itemLook(4).near, false);
});

test('크기는 칸 사이에서 끊기지 않고 이어진다', () => {
  for (const at of [1, 2, 3]) {
    const gap = Math.abs(R.itemLook(at - 0.001).scale - R.itemLook(at + 0.001).scale);
    assert.ok(gap < 0.002, `${at}칸에서 ${gap}`);
  }
});

test('끌기 방향은 문턱을 넘어야 정해지고 더 많이 움직인 쪽을 따른다', () => {
  assert.equal(R.dragIntent(3, 2), null);
  assert.equal(R.dragIntent(10, 3), 'x');
  assert.equal(R.dragIntent(-10, 3), 'x');
  assert.equal(R.dragIntent(3, 10), 'y');
  assert.equal(R.dragIntent(4, 1, 4), 'x', '문턱을 바꿀 수 있다');
});
