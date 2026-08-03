#!/usr/bin/env node
'use strict';
/* CI 모사 러너 — 「로컬 초록」과 「CI 초록」이 다른 것에서 나온 F036·F039의 원인 제거.
 *
 * 2026-08-04 하루에 두 세션이 각각 같은 함정을 밟았다. 한 번은 회귀가 repo 밖
 * (`~/.claude/.../memory`) 경로를 읽어 CI를 깨뜨렸고, 한 번은 그 빨간 CI 위에서
 * 「643건 fail 0」이라는 로컬 결과를 초록이라 보고하고 라이브 배포까지 나갔다.
 * 개인 부주의가 아니다 — **로컬 머신에는 CI에 없는 것이 두 가지 있고**, 그게 있는 한
 * 로컬 스위트는 CI 결과를 예측하지 못한다:
 *   ① 로컬 시간대(KST)      → CI는 UTC. 날짜·월 계산이 갈린다.
 *   ② 홈 디렉터리           → CI엔 메모리 정본도 자격증명도 없다.
 * 둘을 지우고 스위트를 돌린다. **여기서 초록이면 CI도 초록이다**(역은 성립하지 않는다 —
 * CI엔 shallow 체크아웃 등 여기서 못 지우는 차이가 더 있다).
 *
 * 쓰는 곳: /deploy 2단계, 완료·배포 보고 직전. `node tools/test-ci.js`
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');

if (!fs.existsSync(TESTS)) {
  console.error('[test-ci] tests/ 폴더를 못 찾음: ' + TESTS);
  process.exit(1);
}

/* CI 러너에 없는 홈을 만든다 — 비어 있는 진짜 디렉터리라야 한다.
 * 존재하지 않는 경로를 HOME으로 주면 도구가 「경로 오류」로 죽어 CI와 다른 실패가 난다. */
const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci-home-'));

const env = { ...process.env, TZ: 'UTC', HOME: fakeHome, USERPROFILE: fakeHome };
// 명시 지정이 남아 있으면 홈을 비운 의미가 사라진다(모사가 조용히 무력화된다)
delete env.SYNK_MEMORY_DIR;

const files = fs.readdirSync(TESTS)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

if (!files.length) {
  console.error('[test-ci] tests/*.test.js 가 0건 — 스위트가 비었는지 확인하라');
  process.exit(1);
}

console.log(`[test-ci] CI 모사: TZ=UTC · HOME=${fakeHome}(빈 폴더) · 테스트 ${files.length}파일`);
const r = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, env, stdio: 'inherit' });

fs.rmSync(fakeHome, { recursive: true, force: true });

if (r.error) {
  console.error('[test-ci] 실행 실패: ' + r.error.message);
  process.exit(1);
}
const code = r.status === null ? 1 : r.status;
console.log(code === 0
  ? '[test-ci] ✅ CI 모사 초록 — 이 결과는 CI에서도 초록이다'
  : '[test-ci] ❌ CI 모사 실패 — 로컬에서는 통과해도 CI는 여기서 막힌다');
process.exit(code);
