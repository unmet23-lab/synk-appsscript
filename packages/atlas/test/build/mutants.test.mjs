// 변형 실행기(tools/mutants.mjs): 사본을 만들고 한 곳을 바꿔 시험이 잡는지 보는 길이 지금 돈다(단계 2 · 3은 목록만 더한다).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT } from '../support/subject.mjs';

const run = (...args) =>
  spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'tools', 'mutants.mjs'), ...args], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  });

test('실행기 자체 시험: 빈 코치의 ready를 깨뜨린 변형을 unit 묶음이 잡고, 사본을 치운다', () => {
  const result = run('--self');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /잡음 · 실행기 · 빈 코치의 ready가 거절된다/);
  assert.match(result.stdout, /못 잡은 것: 0/);
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, '.mutants')), false);
});

test('목록이 비어 있으면 그렇다고 말하고 끝낸다(단계 2 · 3이 채운다)', () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /아직 변형이 없다/);
});
