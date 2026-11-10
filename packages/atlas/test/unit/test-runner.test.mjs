// 시험 묶음 실행기(tools/test.mjs): 꼭 도는 묶음(unit · build)에 시험이 없으면 실패다 — check가 시험 없이 「통과」하지 않게.
// 아직 채우지 않은 묶음(properties · learners)은 「단계 N이 채운다」로 끝난다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { runGroup, testEnv } from '../../tools/test.mjs';
import { tempDir } from '../support/temp.mjs';

const empty = () => tempDir('atlas-runner-');

test('꼭 도는 묶음(unit · build)에 시험이 하나도 없으면 실패다', () => {
  for (const name of ['unit', 'build']) {
    const result = runGroup(name, { root: empty() });
    assert.deepEqual(result, { name, status: 1, files: 0 }, name);
  }
});

test('아직 채우지 않은 묶음은 시험이 없으면 그렇다고 말하고 끝낸다', () => {
  for (const name of ['properties', 'learners']) {
    assert.deepEqual(runGroup(name, { root: empty() }), { name, status: 0, files: 0 }, name);
  }
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
