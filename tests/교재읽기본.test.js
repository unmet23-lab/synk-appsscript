'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 빌드, 합치기 } = require('../tools/교재읽기본.js');

test('삭제된 원고를 복원하지 않고 Git 보존판의 8과와 별도 2과 본문을 함께 굽는다', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-textbook-'));
  const result = 빌드({ outDir });
  const html = fs.readFileSync(result.낸것[0], 'utf8');
  assert.equal(result.과수, 8); // 표제·부록·완주 검산을 과 수로 세지 않는다.
  for (let lesson = 1; lesson <= 8; lesson++) assert.match(html, new RegExp(`<h1[^>]*>${lesson}과 `));
  assert.match(html, /소리에 받침이 생겼다/); // 초안 v1의 2과 본문. v2의 안내만 합치면 빠진다.
  assert.ok(result.합친줄수 > 300);
  assert.match(html, /원본 고정판 adc049af2/);
  assert.match(html, /현행 계약 아님/);
  assert.ok(!fs.existsSync(path.join(__dirname, '../docs/_archive/교재_시냅스코어_권1_원고_v2.md')));
  assert.ok(!fs.existsSync(path.join(__dirname, '../docs/_archive/교재_시냅스코어_권1_초안_v1.md')));
});

test('Git을 읽지 못하면 기존 출력에 손대지 않고 명확히 실패한다', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-textbook-failure-'));
  const output = path.join(outDir, '권1.html');
  fs.writeFileSync(output, 'keep-existing-output');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
  env.PATH = '';
  const run = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.resolve(__dirname, '../tools/교재읽기본.js'))}).빌드({outDir:${JSON.stringify(outDir)}})`], { env, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Git 보존 원문을 읽지 못했다/);
  assert.equal(fs.readFileSync(output, 'utf8'), 'keep-existing-output');
});

test('2과가 없는 원고를 조용히 완주본으로 만들지 않는다', () => {
  assert.throws(() => 합치기('# 1과\n본문', '## ③ 2과 완전 원고\n본문'), /본편에서/);
  assert.throws(() => 합치기('# 2과\n안내', '## 다른 절\n본문'), /초안 v1/);
});
