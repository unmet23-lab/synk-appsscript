'use strict';
// 로컬 미리 보기 서버의 관찰용 스위치(세로 조각 설계 §15-6) — 시각 앞당기기·카드 바로 세우기.
// 운영(talk)에는 없는 입력이고, 관찰 실행은 평소 개발 저장과 다른 파일에 저장한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const server = () => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/server.mjs')).href);

test('시각 스위치: 앞뒤로 옮기기와 정한 시각에서 시작하기', async () => {
  const { parseObservation, observationClock } = await server();
  const shifted = parseObservation(['--preview', '--clock', '+1d3h30m']);
  assert.equal(shifted.clock.offsetMs, (27 * 60 + 30) * 60000);
  assert.equal(observationClock(shifted, () => 1000)(), 1000 + shifted.clock.offsetMs);
  assert.equal(parseObservation(['--clock=-2h']).clock.offsetMs, -7200000);
  const fixed = parseObservation(['--clock', '2026-10-23T19:00+09:00'], { realNow: 5000 });
  assert.equal(fixed.clock.atMs, Date.UTC(2026, 9, 23, 10, 0));
  assert.equal(observationClock(fixed, () => 65000)(), fixed.clock.atMs + 60000, '정한 시각부터 실제 시간만큼 흐른다');
  for (const bad of ['tomorrow', '+1w', '2026-10-23T19:00', '+']) assert.throws(() => parseObservation(['--clock', bad]), RangeError, bad);
  assert.throws(() => parseObservation(['--clock']), /값을 적어/);
});

test('카드 스위치는 열여덟 장의 ID만 받는다', async () => {
  const { parseObservation } = await server();
  assert.deepEqual(parseObservation(['--card', 'C4,R2,C4']).cards, ['C4', 'R2']);
  for (const bad of ['C7', 'X1', 'c4', 'C4,']) assert.throws(() => parseObservation(['--card', bad]), RangeError, bad);
  const none = parseObservation(['--preview']);
  assert.equal(none.active, false);
  assert.equal(none.clock, null);
});

test('관찰 실행은 따로 저장하고, 평소 서버는 그대로다', async () => {
  const { parseObservation, defaultSavePath, defaultSaveDir, createStore } = await server();
  const observe = parseObservation(['--card', 'C4']);
  assert.notEqual(defaultSavePath(observe), defaultSavePath());
  assert.match(defaultSavePath(observe), /ft10-observe\.json$/);
  assert.match(defaultSavePath(), /ft10-v1\.json$/);
  // 갈래 폴더(W2 D9)는 옛 저장 옆에 따로 — 옛 파일은 그 폴더의 읽기 전용 원본이다.
  assert.match(defaultSaveDir(observe), /ft10-observe$/);
  assert.match(defaultSaveDir(), /ft10-v1$/);
  assert.notEqual(defaultSaveDir(observe), defaultSaveDir());
  assert.equal(createStore({ observe }).observation.cards[0], 'C4');
  assert.equal(createStore().observation, null);
});

test('관찰 스위치는 --preview 없이 쓰면 서버를 띄우지 않는다', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'experiences/synk-town/server.mjs'), '--clock', '+1d'],
    { cwd: ROOT, encoding: 'utf8', timeout: 20000, env: { ...process.env, SYNK_TOWN_PORT: '0' } });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /--preview와 함께만/);
});

test('운영 쪽 코드에는 관찰 스위치가 없다', () => {
  // talk 타운 함수는 core·presence 리듀서만 묶는다. 서버의 관찰 스위치가 그 길로 새지 않는다.
  const shared = ['core.mjs', 'presence.mjs', 'day.mjs', 'life.mjs'].map(name => fs.readFileSync(path.join(ROOT, 'experiences/synk-town', name), 'utf8')).join('\n');
  assert.doesNotMatch(shared, /parseObservation|observationClock|--clock|--card/);
});
