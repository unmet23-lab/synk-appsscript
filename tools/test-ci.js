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

/* 테스트가 읽는 파일들의 (경로·수정시각·크기) 스냅샷.
 *
 * 왜 있나 (2026-08-04 실측, 거짓 적색 2회):
 *   이 저장소는 세션이 동시에 여럿 돈다. 스위트가 20초 넘게 도는 동안 **옆 세션이
 *   Code.js·HTML 을 편집하면** 테스트가 중간 상태를 읽고 빨간불이 된다. 그런데 그
 *   적색은 진짜 적색과 **모양이 완전히 같다** — 실제로 그걸 보고 남의 살아있는
 *   작업본(Code.js)을 고치러 갈 뻔했다. 통과/미실행을 가르는 것과 같은 규율이다:
 *   **거짓 적색과 진짜 적색이 같은 모양이면 안 된다.** */
function snapshot() {
  const out = new Map();
  const walk = (dir, depth) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      // `.claude/state` 는 훅이 매 턴 갱신하는 런타임 상태라 늘 바뀐다 — 세면 경고에 노이즈만 는다.
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'state') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth > 0) walk(p, depth - 1); continue; }
      if (!/\.(js|json|md|html|txt)$/i.test(e.name)) continue;
      try { const s = fs.statSync(p); out.set(path.relative(ROOT, p), `${s.mtimeMs}:${s.size}`); } catch (_) { /* 사라진 파일 */ }
    }
  };
  walk(ROOT, 0);
  for (const d of ['tests', 'tools', 'docs', '.claude']) walk(path.join(ROOT, d), 2);
  return out;
}

console.log(`[test-ci] CI 모사: TZ=UTC · HOME=${fakeHome}(빈 폴더) · 테스트 ${files.length}파일`);
const before = snapshot();
const r = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, env, stdio: 'inherit' });
const after = snapshot();

fs.rmSync(fakeHome, { recursive: true, force: true });

if (r.error) {
  console.error('[test-ci] 실행 실패: ' + r.error.message);
  process.exit(1);
}
const code = r.status === null ? 1 : r.status;

// 도는 동안 바뀐 파일 — 스위트가 스스로 만드는 임시물은 위 스냅샷 대상에 없다(tmp 로 나간다).
const moved = [];
for (const [p, v] of after) if (before.has(p) && before.get(p) !== v) moved.push(p);
for (const p of before.keys()) if (!after.has(p)) moved.push(`${p} (삭제됨)`);

if (code !== 0 && moved.length) {
  console.error('');
  console.error(`[test-ci] ⚠ **이 적색은 못 믿는다** — 테스트가 도는 동안 ${moved.length}개 파일이 바뀌었다(옆 세션이 편집 중).`);
  for (const p of moved.slice(0, 8)) console.error(`   · ${p}`);
  if (moved.length > 8) console.error(`   · … 외 ${moved.length - 8}건`);
  console.error('   → **고치러 가기 전에 재실행하라.** 08-04 실측: 이 거짓 적색 2회, 하마터면 남의 작업본을 고칠 뻔했다.');
  console.error('   → 여전히 빨갛고 이 경고가 없으면 그건 진짜다. 누구 파일인지는 `node tools/작업본소유자.js`.');
}

/* ⚠ 초록을 「CI 초록」이라 단언하지 않는다 — 이건 **모사**라 환경 의존 실패(git 이력·얕은 클론
 * 같은 것)를 구조적으로 못 본다. 2026-08-04 F095: 여기서 1178/0 초록이던 그 순간 실제 CI 는
 * 적색이었고, 그 적색이 주인 없이 남아 모두의 배포 게이트를 막았다. 아는 만큼만 말한다. */
console.log(code === 0
  ? '[test-ci] ✅ CI 모사 초록 — 단 이건 모사다(환경 의존 실패는 못 본다). 진실 층은 원격 run: `gh run list --limit 1`'
  : '[test-ci] ❌ CI 모사 실패 — 로컬에서는 통과해도 CI는 여기서 막힌다');
process.exit(code);
