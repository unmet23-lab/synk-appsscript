/* git 잠금 — 주인 없는 잠금만 지운다. 판정은 순수 함수라 시각·프로세스를 픽스처로 준다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { 판정, 기다림초 } = require(path.join(__dirname, '..', 'tools', 'git잠금.js'));

const 지금 = Date.UTC(2026, 9, 3, 0, 0, 0);
const 잠금 = (초전, 덧) => ({ 있음: true, 크기: 0, 수정ms: 지금 - 초전 * 1000, 지금ms: 지금, 먼저시작한git수: 0, ...덧 });

test('잠금이 없으면 지우지 않는다', () => {
  assert.equal(판정({ 있음: false }).지움, false);
});

test('막 생긴 잠금은 쓰는 중으로 보고 기다린다', () => {
  const r = 판정(잠금(기다림초 - 1));
  assert.equal(r.지움, false);
  assert.equal(r.상태, '잠깐 쓰는 중');
});

test('내용이 있는 잠금은 쓰는 중일 수 있어 지우지 않는다', () => {
  assert.equal(판정(잠금(600, { 크기: 4096 })).지움, false);
});

test('잠금보다 먼저 시작한 git이 있으면 주인이 있다', () => {
  const r = 판정(잠금(60, { 먼저시작한git수: 1 }));
  assert.equal(r.지움, false);
  assert.equal(r.상태, '주인 있음');
});

test('프로세스 목록을 못 읽으면 지우지 않는다 — 모름을 주인 없음으로 바꾸지 않는다', () => {
  const r = 판정(잠금(60, { 먼저시작한git수: null }));
  assert.equal(r.지움, false);
  assert.equal(r.상태, '모름');
});

test('0바이트·오래됨·먼저 시작한 git 없음이면 주인 없는 잠금이다', () => {
  const r = 판정(잠금(기다림초 + 5));
  assert.equal(r.지움, true);
  assert.equal(r.상태, '주인 없음');
});
