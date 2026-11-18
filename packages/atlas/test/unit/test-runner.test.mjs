import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runGroup, testEnv } from '../../tools/test.mjs';
import { tempDir } from '../support/temp.mjs';

test('등록한 여섯 묶음은 시험이 하나도 없으면 실패한다', () => {
  const root = tempDir('atlas-runner-');
  for (const name of ['unit', 'build', 'properties', 'learners', 'record', 'coach']) {
    const result = runGroup(name, { root });
    assert.deepEqual(result, { name, status: 1, files: 0 }, name);
  }
});

test('관문은 변형 시험의 실행 여부에 맞게 통과 범위를 알린다', () => {
  const root = tempDir('atlas-gate-');
  const tools = path.join(root, 'tools');
  fs.mkdirSync(tools);
  for (const name of ['gate.mjs', 'test.mjs']) {
    fs.copyFileSync(new URL(`../../tools/${name}`, import.meta.url), path.join(tools, name));
  }
  fs.writeFileSync(path.join(tools, 'mutants.mjs'), 'console.log("mutants fixture ran");');
  for (const name of ['properties', 'learners']) {
    const dir = path.join(root, 'test', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'sample.test.mjs'),
      `import test from 'node:test'; test('${name}', () => {});`,
    );
  }
  const run = args =>
    spawnSync(process.execPath, ['tools/gate.mjs', ...args], {
      cwd: root,
      env: testEnv(),
      encoding: 'utf8',
    });
  const full = run([]);
  assert.equal(full.status, 0, full.stderr);
  assert.match(full.stdout, /mutants fixture ran/);
  assert.match(full.stdout, /관문 1~7 통과/);
  const partial = run(['--no-mutants']);
  assert.equal(partial.status, 0, partial.stderr);
  assert.match(partial.stdout, /관문 1~6 통과.*7번 변형 시험 생략/);
  assert.doesNotMatch(partial.stdout, /mutants fixture ran|관문 1~7 통과/);
});

test('모르는 묶음은 멈춘다', () => {
  assert.throws(() => runGroup('smoke'), /모르는 묶음/);
});

test('안쪽 node --test에는 NODE_TEST_CONTEXT를 넘기지 않는다', () => {
  const saved = process.env.NODE_TEST_CONTEXT;
  process.env.NODE_TEST_CONTEXT = 'child-v8';
  try {
    const env = testEnv({ ATLAS_SUBJECT_ROOT: '/x' });
    assert.equal('NODE_TEST_CONTEXT' in env, false);
    assert.equal(env.ATLAS_SUBJECT_ROOT, '/x');
  } finally {
    if (saved === undefined) delete process.env.NODE_TEST_CONTEXT;
    else process.env.NODE_TEST_CONTEXT = saved;
  }
});
