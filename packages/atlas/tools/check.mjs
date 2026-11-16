// 패키지의 관문 한 줄(설계 §9 · §14-3 — 줄 수 상한 대신): 포맷 · 복잡도 → 빌드와 용량 → 시험.
//   npm --prefix packages/atlas run check   (CI: syntax-check의 「Atlas package」 단계)
//   1. biome ci — 포맷터(한 줄 한 문장, 폭 100)와 린트(인지 복잡도 15 · 한 문장에 선언 하나). 고치지 않고 보기만 한다(고치기는 npm run format)
//   2. 빌드를 임시 폴더에 내고 budget.json의 압축 용량 상한을 잰다
//   3. 시험 — unit(의존 없이) · build · properties(줄인 씨앗 — 접기 300열 · 고르기 150명). 전체 씨앗 · 가상 학습자 · 변형은 npm run gate
//   --format-only: 1만 돌린다 — 바로올리기의 짝 검사(tools/짝검사.js 「Atlas 패키지 형식 · 복잡도」)가 push 전에 부른다
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBudget } from './budget.mjs';
import { build } from './build.mjs';
import { runGroup } from './test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function biome() {
  const bin = path.join(ROOT, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
  const run = spawnSync(process.execPath, [bin, 'ci', '.'], { cwd: ROOT, stdio: 'inherit' });
  if (run.status !== 0) failures.push('포맷 · 복잡도(biome ci)');
}

async function sizes() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-check-'));
  try {
    const { edition, manifest } = await build({ out });
    const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'budget.json'), 'utf8'));
    const { ok, report } = checkBudget(manifest, budget);
    for (const row of report) {
      console.log(
        `atlas size · ${row.part} ${row.file}: gzip ${row.gzipBytes}B / 상한 ${row.limit}B (남은 ${row.headroom}B) · ${edition}`,
      );
    }
    if (!ok) failures.push('묶음 압축 용량 상한(budget.json)');
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

biome();
// 관련 시험은 시험 파일만 돌려 형식 · 복잡도를 못 본다 — 11-16 4-4b 커밋(ecfe3bc4a)의 엔진 시험 두 단정이 형식기 꼴과 달라 master
// syntax-check가 그때부터 깨졌다. 그래서 짝 검사가 push 전에 이 단계만 돌린다.
if (process.argv.includes('--format-only')) {
  console.log(failures.length ? 'atlas check(형식만): 걸림' : 'atlas check(형식만): 통과');
  process.exit(failures.length ? 1 : 0);
}
await sizes();
for (const group of ['unit', 'build'])
  if (runGroup(group).status !== 0) failures.push(`시험 ${group}`);
if (runGroup('record').status !== 0) failures.push('시험 record');
if (runGroup('coach').status !== 0) failures.push('시험 coach');
if (runGroup('properties', { env: { ATLAS_SEED_SCALE: '0.1' } }).status !== 0)
  failures.push('시험 properties(줄인 씨앗)');
console.log(
  failures.length ? `atlas check: 걸린 것 — ${failures.join(' · ')}` : 'atlas check: 모두 통과',
);
if (failures.length) process.exitCode = 1;
