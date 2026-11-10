// 두뇌의 관문(설계 §11 가상 학습자 관문 1~7) — 두뇌의 규칙이나 매개변수 판을 바꿀 때 돈다. 몇 분에서 십여 분 걸린다.
//   1 · 6  properties 전체 씨앗(장면 단정 · 접기 3,000열 · 고르기 1,500명)
//   2~5    learners(가정 36가지 × 가상 학습자 40명 · 쉬다 돌아옴 · 하루 두 판 · 잇달아 다섯 판, 앞 판 값 baseline.json)
//   7      변형 시험(tools/mutants.mjs — 규칙을 깬 사본을 시험이 모두 잡는가)
// check(CI)는 줄인 씨앗의 properties까지만 돈다. 이 관문을 넘긴 결과는 단계 기록(docs/_ops/qa/atlas-redesign-20261110/)에 남긴다.
//   node packages/atlas/tools/gate.mjs [--no-mutants]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGroup, testEnv } from './test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const started = Date.now();
for (const group of ['properties', 'learners'])
  if (runGroup(group).status !== 0) failures.push(`시험 ${group}`);
if (!process.argv.includes('--no-mutants')) {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'mutants.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: testEnv(),
  });
  if (run.status !== 0) failures.push('변형 시험');
}
const minutes = ((Date.now() - started) / 60000).toFixed(1);
console.log(
  failures.length
    ? `atlas gate: 걸린 것 — ${failures.join(' · ')} (${minutes}분)`
    : `atlas gate: 관문 1~7 통과 (${minutes}분)`,
);
if (failures.length) process.exitCode = 1;
