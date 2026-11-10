// 변형 실행기(tools/mutants.mjs): 사본을 만들고 한 곳을 바꿔 시험이 잡는지 보는 길이 지금 돈다(단계 2 · 3은 목록만 더한다).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { PACKAGE_ROOT } from '../support/subject.mjs';

const run = (...args) =>
  spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'tools', 'mutants.mjs'), ...args], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  });

test('실행기 자체 시험: Vellum의 언어 물러서기를 깨뜨린 변형을 unit 묶음이 잡고, 사본을 치운다', () => {
  const result = run('--self');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /잡음 · 실행기 · Vellum이 다른 언어로 물러선다/);
  assert.match(result.stdout, /못 잡은 것: 0/);
  // 제 사본 폴더(.mutants/<pid>)만 치운다 — 함께 도는 다른 변형 실행의 사본은 건드리지 않는다
  const own = result.stdout.match(/사본 폴더 (\S+)/)?.[1];
  assert.match(own ?? '', /^\.mutants\/\d+$/);
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, own)), false);
});

// 변형을 다 돌리는 것은 몇십 분이라 npm run gate가 한다. 여기서는 목록이 낡지 않았는지만 본다 — 포맷이나 고침으로 바꿀 글이 사라지거나
// 두 번 나오면 그 변형은 「바꿀 자리를 못 찾음」이 되어 관문이 무뎌진다.
test('변형 목록: 바꿀 글이 그 파일에 꼭 한 번 있고, 이름이 겹치지 않는다', async () => {
  const { MUTANTS } = await import(
    pathToFileURL(path.join(PACKAGE_ROOT, 'tools', 'mutants.mjs')).href
  );
  assert.ok(MUTANTS.length >= 64, `시제품의 변형 64개 이상 — 지금 ${MUTANTS.length}`);
  const names = new Set();
  for (const [group, , name, file, from, to] of MUTANTS) {
    assert.ok(['unit', 'build', 'properties', 'learners', 'record', 'coach'].includes(group), name);
    assert.equal(names.has(name), false, `이름 겹침: ${name}`);
    names.add(name);
    const text = fs.readFileSync(path.join(PACKAGE_ROOT, file), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(
      text.split(from).length,
      2,
      `${name}: 「${from.slice(0, 60)}」가 ${file}에 꼭 한 번 있어야 한다`,
    );
    assert.notEqual(from, to, name);
  }
});
