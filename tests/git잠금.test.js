/* git 잠금 — 주인 없는 잠금만 지운다. 판정은 순수 함수라 시각·프로세스를 픽스처로 준다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { 판정, 살피기, 정리, 잠금경로, 기다림초 } = require(path.join(__dirname, '..', 'tools', 'git잠금.js'));

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

test('연결 워크트리의 잠금은 그 워크트리의 git 폴더에서 찾는다(.git이 파일이라 <워크트리>/.git/index.lock은 생길 수 없다)', (t) => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-git-lock-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/.test(k))),
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(뿌리, 'no-global'), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid',
    GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' };
  const 본 = path.join(뿌리, '본'), 곁 = path.join(뿌리, '곁');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, stdio: 'pipe' });
  fs.mkdirSync(본);
  git(본, 'init', '-q', '-b', 'master');
  git(본, 'commit', '-q', '--allow-empty', '-m', '바탕');
  git(본, 'worktree', 'add', '-q', '-b', '곁가지', 곁);
  assert.equal(잠금경로(본), path.join(본, '.git', 'index.lock'));
  const 곁잠금 = 잠금경로(곁);
  assert.equal(path.relative(path.join(본, '.git', 'worktrees'), 곁잠금).split(path.sep).length, 2, 곁잠금);
  assert.ok(곁잠금.endsWith(`${path.sep}index.lock`));
  fs.writeFileSync(곁잠금, '');
  assert.notEqual(살피기(곁).상태, '없음', '워크트리 잠금을 본다');
  fs.rmSync(곁잠금);
});

test('정리는 살핀 뒤 바뀌지 않은 주인 없는 잠금만 지운다', (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-git-lock-test-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const 잠금파일 = path.join(폴더, 'index.lock');
  const 옛날 = new Date(Date.now() - 60000);
  fs.writeFileSync(잠금파일, '');
  fs.utimesSync(잠금파일, 옛날, 옛날);
  const 주인있음 = 살피기(폴더, { 잠금: 잠금파일, 먼저시작한git: () => 1 });
  assert.equal(주인있음.상태, '주인 있음');
  assert.equal(정리(주인있음), false);
  const r = 살피기(폴더, { 잠금: 잠금파일, 먼저시작한git: () => 0 });
  assert.equal(r.상태, '주인 없음');
  fs.writeFileSync(잠금파일, '');
  assert.equal(정리(r), false, '살핀 뒤 다시 쓰인 잠금은 지우지 않는다');
  assert.ok(fs.existsSync(잠금파일));
  fs.utimesSync(잠금파일, 옛날, 옛날);
  const 다시 = 살피기(폴더, { 잠금: 잠금파일, 먼저시작한git: () => 0 });
  assert.equal(정리(다시), true);
  assert.ok(!fs.existsSync(잠금파일));
});
