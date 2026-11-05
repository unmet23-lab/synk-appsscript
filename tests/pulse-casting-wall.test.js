'use strict';
// 캐스팅북 모델 벽 차례표(wall.json) — 명단의 모델이 빠지거나 두 번 서면 벽이 대표 차례로 물러나거나 공개 빌드가 멈춘다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BOOK = path.join(__dirname, '..', 'docs', '마케팅', 'PULSE_AI모델_캐스팅_20260930');
const read = (f) => JSON.parse(fs.readFileSync(path.join(BOOK, f), 'utf8'));
const roster = () => read('roster-v2.json').models;

test('벽 차례는 명단의 모델을 한 번씩만 세운다', () => {
  const wall = read('wall.json');
  assert.deepEqual([...wall.order].sort(), roster().map((m) => m.code).sort());
});

test('첫 화면 모델과 사진으로 서는 모델은 차례 안에 있다', () => {
  const wall = read('wall.json');
  assert.ok(wall.order.includes(wall.first));
  for (const code of Object.keys(wall.photo)) assert.ok(wall.order.includes(code), code);
});

test('모든 모델에 장점 한 줄이 있다', () => {
  const wall = read('wall.json');
  for (const code of wall.order) assert.ok(wall.lines[code], code);
});

test('옆 칸에 같은 성별이 셋 넘게 이어지지 않는다(벽이 한 사람처럼 보이지 않게)', () => {
  const wall = read('wall.json');
  const gender = Object.fromEntries(roster().map((m) => [m.code, m.code[0]]));
  let run = 1;
  for (let i = 1; i < wall.order.length; i++) {
    run = gender[wall.order[i]] === gender[wall.order[i - 1]] ? run + 1 : 1;
    assert.ok(run <= 3, `${wall.order[i]}까지 ${run}명이 이어진다`);
  }
});
