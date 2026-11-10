// 시험 묶음 실행기. node packages/atlas/tools/test.mjs <묶음…>
//   unit        의존 없이 도는 시험 — 패키지 의존(ts-fsrs · esbuild …)을 import하면 훅이 멈춘다. 루트 CI 시험(tests/atlas-package.test.js)이 부른다.
//   build       빌드 · ts-fsrs · 변형 실행기가 드는 시험(패키지에서 npm ci 뒤)
//   properties  장면 단정 · 임의 시험(접기 · 고르기) — 씨앗은 ATLAS_SEEDS · ATLAS_SEED_SCALE · ATLAS_FIRST_SEED. check는 줄인 씨앗으로 돈다
//   learners    가상 학습자 관문 2~5(몇 분 — check에 들지 않고 npm run gate로)
//   record      기록 · 저장(단계 3) — 사건 2판 · 측정 계약 · 서버 접기 · 기기 얹기 임의 시험 · 저장 관문 장면(몇 초, check에 든다)
//   coach       코치 3판(단계 4) — 제시 칸 · 두뇌와 같은 결정 · 저장 실패 다시 세우기 · 호스트 나누기 · 제품 순서 문항(몇 초, check에 든다)
// unit · build는 꼭 도는 묶음이라 시험 파일이 하나도 없으면 실패다(check가 시험 없이 「통과」하지 않게). properties · learners는
// 아직 채우지 않은 묶음이라 시험이 없으면 「이 묶음은 단계 N이 채운다」를 찍고 끝낸다(CI의 check에는 들지 않는다).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS = {
  unit: { stage: 0, leafOnly: true, required: true },
  build: { stage: 0, leafOnly: false, required: true },
  properties: { stage: 2, leafOnly: false, required: false },
  learners: { stage: 2, leafOnly: false, required: false },
  record: { stage: 3, leafOnly: false, required: false },
  coach: { stage: 4, leafOnly: false, required: false },
};

function testFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return testFiles(full);
      return /\.test\.mjs$/.test(entry.name) ? [full] : [];
    })
    .sort();
}

// node --test 안에서 다시 node --test를 띄우면 물려받은 NODE_TEST_CONTEXT 때문에 안쪽이 자식 모드로 돌아, 시험이 실패해도
// 끝 코드가 0이 된다(변형 실행기 · 루트 CI 시험이 이 실행기를 띄운다). 띄우는 쪽에서 그 값을 지운다.
export function testEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

// root는 시험이 패키지 밖의 빈 자리를 줄 때만 바꾼다. env는 그 묶음에만 더할 환경 변수(줄인 씨앗 등).
export function runGroup(name, { root = ROOT, env = {} } = {}) {
  const group = GROUPS[name];
  if (!group)
    throw new Error(`Atlas test: 모르는 묶음 ${name} — ${Object.keys(GROUPS).join(' · ')}`);
  const files = testFiles(path.join(root, 'test', name));
  if (!files.length && group.required) {
    console.error(`atlas ${name}: 시험이 하나도 없다 — 꼭 도는 묶음이다`);
    return { name, status: 1, files: 0 };
  }
  if (!files.length) {
    console.log(`atlas ${name}: 아직 시험이 없다 — 이 묶음은 단계 ${group.stage}이 채운다`);
    return { name, status: 0, files: 0 };
  }
  const hook = group.leafOnly ? ['--import', './test/support/leaf-only.mjs'] : [];
  const run = spawnSync(
    process.execPath,
    [...hook, '--test', ...files.map(f => path.relative(root, f))],
    {
      cwd: root,
      stdio: 'inherit',
      env: testEnv(env),
    },
  );
  return { name, status: run.status ?? 1, files: files.length };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const names = process.argv.slice(2);
  if (!names.length)
    throw new Error('사용법: node packages/atlas/tools/test.mjs <unit|build|properties|learners>…');
  const results = names.map(runGroup);
  if (results.some(result => result.status !== 0)) process.exitCode = 1;
}
