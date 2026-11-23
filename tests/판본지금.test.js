'use strict';
// 판본 지금(tools/판본지금.js) — 나라 판본 회차를 「직접 시작 회차」로 띄우는 한 번짜리 표시.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 읽기, 파일, 유효시간 } = require('../tools/판본지금.js');

const TOOL = path.join(__dirname, '..', 'tools', '판본지금.js');
const run = (dir, ...args) => spawnSync(process.execPath, [TOOL, ...args, '--자리', dir], { encoding: 'utf8' });

test('요청 → 확인 「있음」 → 끝 → 확인 「없음」(한 번만 쓰인다)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '판본지금-'));
  assert.match(run(dir, '확인').stdout, /^없음/);
  const a = run(dir, '요청', '--까닭', '시험');
  assert.equal(a.status, 0, a.stderr);
  const b = run(dir, '확인');
  assert.match(b.stdout, /^있음 — .* · 시험 · \d+분 남음/);
  assert.equal(JSON.parse(run(dir, '확인', '--json').stdout).있음, true);
  assert.equal(run(dir, '끝').status, 0);
  assert.match(run(dir, '확인').stdout, /^없음/);
  assert.equal(run(dir, '끝').status, 0, '없는 표시를 지워도 멈추지 않는다');
});

test('세 시간이 지난 표시 · 꼴이 틀린 표시는 「없음」이다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '판본지금-'));
  const now = Date.parse('2026-11-23T15:00:00Z');
  fs.writeFileSync(파일(dir), JSON.stringify({ 때: new Date(now - 유효시간 - 1000).toISOString() }));
  assert.deepEqual(읽기(dir, now).있음, false);
  assert.equal(읽기(dir, now).지남, true);
  assert.equal(읽기(dir, now - 2000).있음, true);
  fs.writeFileSync(파일(dir), JSON.stringify({ 때: '어제' }));
  assert.equal(읽기(dir, now).있음, false);
  fs.writeFileSync(파일(dir), '{깨짐');
  assert.equal(읽기(dir, now).있음, false);
  assert.match(run(dir, '확인').stdout, /^없음 — 표시를 못 읽음/);
});

test('모르는 명령은 종료 2', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '판본지금-'));
  assert.equal(run(dir, '시작').status, 2);
});
