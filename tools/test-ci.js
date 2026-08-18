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
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');

if (!fs.existsSync(TESTS)) {
  console.error('[test-ci] tests/ 폴더를 못 찾음: ' + TESTS);
  process.exit(1);
}

/* CI 모사 환경은 lib/ci모사환경.js **한 벌**에서 온다 (F389) — clasp-guard 안전테스트와 여기가
 * 각자 조립하다 갈라져, 「여기 초록」이 배포 게이트 통과를 예측하지 못했다. 조리법은 그 파일에. */
const 모사 = require('./lib/ci모사환경.js').만들기();
const fakeHome = 모사.fakeHome;
const env = 모사.env;

const files = fs.readdirSync(TESTS)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

if (!files.length) {
  console.error('[test-ci] tests/*.test.js 가 0건 — 스위트가 비었는지 확인하라');
  process.exit(1);
}

/* 테스트가 읽는 파일들의 스냅샷 + 「도는 동안 바뀐 파일」 가르기는 lib/런중변경.js 한 벌이다.
 *
 * 왜 있나 (2026-08-04 실측, 거짓 적색 2회):
 *   이 저장소는 세션이 동시에 여럿 돈다. 스위트가 20초 넘게 도는 동안 **옆 세션이
 *   Code.js·HTML 을 편집하면** 테스트가 중간 상태를 읽고 빨간불이 된다. 그런데 그
 *   적색은 진짜 적색과 **모양이 완전히 같다** — 실제로 그걸 보고 남의 살아있는
 *   작업본(Code.js)을 고치러 갈 뻔했다. 통과/미실행을 가르는 것과 같은 규율이다:
 *   **거짓 적색과 진짜 적색이 같은 모양이면 안 된다.**
 *
 * 왜 두 갈래인가 (F616 · 2026-08-18 실측 2회): 옛 판은 `mtimeMs:size` 만 봐서 **이 스위트가
 *   제자리에서 다시 굽고 바이트를 되돌리는 산출물**까지 「옆 세션이 편집 중」으로 단정했다.
 *   격리 컨테이너(다른 세션 0)에서도 떴고, 처방문이 가리키는 `작업본소유자` 목록은 비어 있었다 —
 *   따를 수 없는 처방(F103)이라 **진짜 적색까지 상시 「못 믿는다」로** 내려앉았다. 조리법은 lib 에. */
const { 스냅샷, 가르기 } = require('./lib/런중변경.js');

console.log(`[test-ci] CI 모사: TZ=UTC · HOME=${fakeHome}(빈 폴더) · 테스트 ${files.length}파일`);
const before = 스냅샷(ROOT);
const r = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, env, stdio: 'inherit' });
const after = 스냅샷(ROOT);

모사.치우기();

if (r.error) {
  console.error('[test-ci] 실행 실패: ' + r.error.message);
  process.exit(1);
}
const code = r.status === null ? 1 : r.status;

// 도는 동안 바뀐 파일 — 스위트가 스스로 만드는 임시물은 위 스냅샷 대상에 없다(tmp 로 나간다).
const { 밖에서, 제자리 } = 가르기(before, after);
const 몇벌 = (a, n) => a.slice(0, n).map((p) => `   · ${p}`).concat(a.length > n ? [`   · … 외 ${a.length - n}건`] : []);

/* 분모를 «색과 무관하게» 낸다 (F207 의 거울상 · F616 ③).
 * 이 칸이 없으면 「밖에서 0」이 「아무 창도 없었다」로 읽힌다 — 밖에서 바뀌었다가 같은 바이트로
 * 돌아온 판은 여기 앉으므로, 그 칸을 지우면 창이 있었다는 사실 자체가 사라진다. */
if (제자리.length) {
  console.log('');
  console.log(`[test-ci] ℹ 제자리 굽기 ${제자리.length}벌 — 이 런이 다시 굽고 **바이트가 되돌아온** 파일(밖에서 바뀐 것 아님).`);
  for (const l of 몇벌(제자리, 4)) console.log(l);
}

if (code !== 0 && 밖에서.length) {
  console.error('');
  console.error(`[test-ci] ⚠ **이 적색은 못 믿는다** — 도는 동안 ${밖에서.length}개 파일의 «내용»이 달라졌다(옆 세션이 편집 중일 수 있다).`);
  for (const l of 몇벌(밖에서, 8)) console.error(l);
  console.error('   → **고치러 가기 전에 재실행하라.** 08-04 실측: 이 거짓 적색 2회, 하마터면 남의 작업본을 고칠 뻔했다.');
  console.error('   → 누구 파일인지는 `node tools/작업본소유자.js`.');
} else if (code !== 0) {
  console.error('');
  console.error('[test-ci] ✔ 밖에서 바뀐 파일 **0** — 이 적색을 「옆 세션 탓」으로 돌릴 근거는 없다(재실행은 답이 아니다).');
  console.error('   → 위 제자리 굽기는 창이 **닫힌** 것이다. 실패한 검사를 그대로 읽어라.');
  console.error('   ⚠ 단 한 자리만 남는다: 밖에서 바뀌었다가 **정확히 같은 바이트로** 돌아온 파일은 제자리 칸에 앉는다.');
}

/* ⚠ 초록을 「CI 초록」이라 단언하지 않는다 — 이건 **모사**라 환경 의존 실패(git 이력·얕은 클론
 * 같은 것)를 구조적으로 못 본다. 2026-08-04 F095: 여기서 1178/0 초록이던 그 순간 실제 CI 는
 * 적색이었고, 그 적색이 주인 없이 남아 모두의 배포 게이트를 막았다. 아는 만큼만 말한다. */
console.log(code === 0
  // ⚠ 옛 안내는 `gh run list --limit 1` 이었는데, 그건 **남의 push 로 생긴 최신 run** 을 보여줄
  //   뿐이라 「내 커밋이 검증됐나」에 답하지 못한다(F175 · 웹훅이 끊겨 run 0건이던 날 실측).
  ? '[test-ci] ✅ CI 모사 초록 — 단 이건 모사다(환경 의존 실패는 못 본다). 진실 층은 원격 run: `node tools/원격ci.js`'
  : '[test-ci] ❌ CI 모사 실패 — 로컬에서는 통과해도 CI는 여기서 막힌다\n'
    + '   → **배포하려던 것이면 여기서 멈추기 전에 층을 가른다**: 나갈 바이트는 작업본이 아니라 HEAD 다.\n'
    + '     `node tools/원격ci.js` 가 초록이면 이 적색은 **커밋 안 된 작업** 탓이라 라이브와 무관하고,\n'
    + '     clasp-guard 도 같은 판정으로 통과시킨다(F240 축 B — 우회가 아니라 재는 대상을 바로잡은 것).');
process.exit(code);
