'use strict';
// Atlas 새 엔진 패키지(packages/atlas, 재설계 단계 0)의 의존 없는 시험을 루트 시험에서 돌린다. 패키지 의존(esbuild · Biome · ts-fsrs)을
// 깔지 않은 작업본에서도 돈다 — unit 묶음은 패키지 의존을 부르면 훅이 멈추게 해 두었다(packages/atlas/test/support/leaf-only.mjs).
// 포맷 · 복잡도 · 묶음 용량 · 빌드 시험은 의존이 들어 CI syntax-check의 「Atlas package」 단계(npm --prefix packages/atlas run check)가 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('packages/atlas unit tests pass without the package dependencies', () => {
  // 바깥 node --test가 물려주는 NODE_TEST_CONTEXT를 지운다 — 남기면 안쪽 node --test가 실패해도 끝 코드 0으로 끝난다.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['packages/atlas/tools/test.mjs', 'unit'], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 1 << 26 });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`.slice(-6000));
  // 끝 코드만 믿지 않는다 — 실제로 돈 시험이 있고 실패 · 건너뜀이 0인지 본다(현장 노트 「시험 안에서 다시 부른 node --test가 빈 출력」).
  const count = name => Number((run.stdout.match(new RegExp(`(?:#|ℹ) ${name} (\\d+)`)) || [])[1]);
  assert.ok(count('pass') > 0, run.stdout.slice(-2000));
  assert.equal(count('fail'), 0);
  assert.equal(count('skipped'), 0);
});
