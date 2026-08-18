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
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');

function 테스트파일들() {
  if (!fs.existsSync(TESTS)) {
    console.error('[test-ci] tests/ 폴더를 못 찾음: ' + TESTS);
    process.exit(1);
  }
  const files = fs.readdirSync(TESTS)
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => path.join('tests', f));

  if (!files.length) {
    console.error('[test-ci] tests/*.test.js 가 0건 — 스위트가 비었는지 확인하라');
    process.exit(1);
  }
  return files;
}

/* 테스트가 읽는 파일들의 (경로·수정시각·크기·**내용 해시**) 스냅샷.
 *
 * 왜 있나 (2026-08-04 실측, 거짓 적색 2회):
 *   이 저장소는 세션이 동시에 여럿 돈다. 스위트가 20초 넘게 도는 동안 **옆 세션이
 *   Code.js·HTML 을 편집하면** 테스트가 중간 상태를 읽고 빨간불이 된다. 그런데 그
 *   적색은 진짜 적색과 **모양이 완전히 같다** — 실제로 그걸 보고 남의 살아있는
 *   작업본(Code.js)을 고치러 갈 뻔했다. 통과/미실행을 가르는 것과 같은 규율이다:
 *   **거짓 적색과 진짜 적색이 같은 모양이면 안 된다.**
 *
 * 🔴 왜 해시가 붙었나 (F616 · 2026-08-18 실측 2회 · 격리 컨테이너라 **다른 세션이 0**이었다):
 *   옛 스냅샷 키는 `mtime:size` 뿐이라 **「손댔다」와 「바뀌었다」를 못 갈랐다.** 그런데 이 스위트에는
 *   산출물을 «제자리에서 다시 굽고 바이트로 되돌리는» 검사가 있다(`tests/이해대장.test.js:495` 가
 *   `docs/이해대장.html` 을, `tools/교재읽기본.js` 를 부르는 검사 셋이 `docs/교재_읽기본/권1.html` 을).
 *   그래서 mtime 만 움직인 자기 부작용이 「옆 세션이 편집 중」으로 나갔고, 그 두 검사는 거의 모든
 *   전체 런에 끼므로 **적색이면 사실상 항상** 「이 적색은 못 믿는다 · 재실행하라」가 함께 떴다.
 *   새는 방향이 통과가 아니라 **「빨간 것을 안 믿게 만든다」**다 — 초록은 다시 재면 되지만 이건
 *   재라는 처방이 매번 참이라 무한히 미룰 수 있다. 게다가 처방이 따를 수 없었다(F103):
 *   「누구 파일인지는 `작업본소유자.js`」인데 그 목록엔 아무도 없다(실측: 그 런들에서 `git status` 는
 *   실행 **전후 모두** 빈 출력이었다 — 두 파일 다 무변경으로 돌아와 있었다).
 *
 * 🔑 대가를 값으로 적는다 — `before` 만 전량 해시하고 `after` 는 도장이 같으면 **재사용**한다.
 *   실측 2026-08-18(이 컨테이너): 1355파일·44.2MB·해시 **2.8초** / 스위트 155초 = **+1.8%**.
 *   양쪽 다 해시하면 두 배인데, 도장(mtime:size)이 같은 파일은 내용도 같다고 보는 것이 옛 판의
 *   전제 그대로라 여기서 새로 무는 것이 없다.
 * @param {Map|null} 앞판 주면 도장이 같은 항목의 해시를 그대로 물려받는다(= 안 읽는다).
 */
function snapshot(앞판 = null) {
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
      const 상대 = path.relative(ROOT, p);
      let 도장;
      try { const s = fs.statSync(p); 도장 = `${s.mtimeMs}:${s.size}`; } catch (_) { continue; /* 사라진 파일 */ }
      const 앞 = 앞판 && 앞판.get(상대);
      if (앞 && 앞.도장 === 도장) { out.set(상대, 앞); continue; }
      let 해시 = null;   // null = 못 읽었다(≠ 같다) — 아래 판정이 「모름」으로 따로 센다(F207)
      try { 해시 = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); } catch (_) { /* 읽기 실패 */ }
      out.set(상대, { 도장, 해시 });
    }
  };
  walk(ROOT, 0);
  for (const d of ['tests', 'tools', 'docs', '.claude']) walk(path.join(ROOT, d), 2);
  return out;
}

/**
 * 관측 두 벌 → 판정. **순수 함수다**(F543 계보 — 판정을 떼 놔야 픽스처가 탐지력을 진다).
 * 갈래를 셋으로 낸다. 뭉치면 그 순간 이 도구가 F616 로 되돌아간다:
 *   · `밖에서바뀜` — 바이트가 실제로 달라졌다. **이것만이** 적색을 의심할 근거다.
 *   · `되돌아옴`  — 다시 쓰였는데 바이트는 그대로. 이 런이 스스로 구운 산출물이다(경고 아님 · 분모).
 *   · `모름`      — 어느 한쪽을 못 읽었다. 「같다」로 접지 않는다(F207).
 * @returns {{밖에서바뀜:string[], 되돌아옴:string[], 사라짐:string[], 모름:string[], 분모:number}}
 */
function 판정(before, after) {
  const 밖에서바뀜 = []; const 되돌아옴 = []; const 사라짐 = []; const 모름 = [];
  for (const [p, 앞] of before) {
    const 뒤 = after.get(p);
    if (뒤 === undefined) { 사라짐.push(p); continue; }
    if (앞.도장 === 뒤.도장) continue;                       // 손도 안 댔다
    if (앞.해시 === null || 뒤.해시 === null) { 모름.push(p); continue; }
    if (앞.해시 === 뒤.해시) { 되돌아옴.push(p); continue; }   // 다시 쓰였을 뿐 — 바이트 무변경
    밖에서바뀜.push(p);
  }
  /* 새로 **생긴** 파일은 안 센다 — 테스트가 읽던 대상이 아니었다(스위트 자신의 산출물이 섞인다). */
  return { 밖에서바뀜, 되돌아옴, 사라짐, 모름, 분모: before.size };
}

/** 판정 → 사람이 읽을 줄들. 순수 함수라 픽스처가 «무엇을 말하는가»까지 잰다. */
function 알림줄들(판, code) {
  const 줄 = [];
  /* 🔑 적색을 의심할 근거는 **`밖에서바뀜`·`사라짐`뿐**이다(F616).
   *   「다시 쓰였지만 바이트는 그대로」는 이 런 자신의 부작용이라 남의 탓이 아니고, 적색과도 무관하다. */
  const 진짜 = [...판.밖에서바뀜, ...판.사라짐.map((p) => `${p} (삭제됨)`)];
  if (code !== 0 && (진짜.length || 판.모름.length)) {
    줄.push('');
    줄.push(`[test-ci] ⚠ **이 적색은 못 믿을 수 있다** — 도는 동안 ${진짜.length}개 파일의 **내용이** 달라졌다(밖에서 편집 중).`);
    for (const p of 진짜.slice(0, 8)) 줄.push(`   · ${p}`);
    if (진짜.length > 8) 줄.push(`   · … 외 ${진짜.length - 8}건`);
    if (판.모름.length) 줄.push(`   · (읽지 못해 판정 못 한 것 ${판.모름.length}건 — 「같다」로 접지 않았다)`);
    줄.push('   → **고치러 가기 전에 재실행하라.** 08-04 실측: 이 거짓 적색 2회, 하마터면 남의 작업본을 고칠 뻔했다.');
    줄.push('   → 여전히 빨갛고 이 경고가 없으면 그건 진짜다. 누구 파일인지는 `node tools/작업본소유자.js`.');
  }
  /* 분모를 한 줄로 낸다 — F616 이 「몇 벌인지 안 셌다」로 남긴 자리다. 경고가 아니라 관측이다. */
  if (판.되돌아옴.length) {
    줄.push(`[test-ci] ℹ 이 런이 스스로 다시 구운 산출물 ${판.되돌아옴.length}벌 — **바이트 무변경**이라 적색과 무관하다`
      + `: ${판.되돌아옴.slice(0, 4).join(' · ')}${판.되돌아옴.length > 4 ? ` … 외 ${판.되돌아옴.length - 4}건` : ''}`);
  }
  return 줄;
}

function 주() {
  const files = 테스트파일들();
  /* CI 모사 환경은 lib/ci모사환경.js **한 벌**에서 온다 (F389) — clasp-guard 안전테스트와 여기가
   * 각자 조립하다 갈라져, 「여기 초록」이 배포 게이트 통과를 예측하지 못했다. 조리법은 그 파일에. */
  const 모사 = require('./lib/ci모사환경.js').만들기();

  console.log(`[test-ci] CI 모사: TZ=UTC · HOME=${모사.fakeHome}(빈 폴더) · 테스트 ${files.length}파일`);
  const before = snapshot();
  const r = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, env: 모사.env, stdio: 'inherit' });
  const after = snapshot(before);

  모사.치우기();

  if (r.error) {
    console.error('[test-ci] 실행 실패: ' + r.error.message);
    process.exit(1);
  }
  const code = r.status === null ? 1 : r.status;

  // 도는 동안 바뀐 파일 — 스위트가 스스로 만드는 임시물은 위 스냅샷 대상에 없다(tmp 로 나간다).
  for (const 줄 of 알림줄들(판정(before, after), code)) console.error(줄);

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
}

/* 판정을 **내보낸다** — 회귀가 소스에서 정규식으로 블록을 긁어 `new Function` 으로 돌리던 자리다.
 * 긁어 쓰면 구조를 바꿀 때마다 회귀가 조용히 「못 찾음」이 되고, 그때 새는 방향은 통과다. */
module.exports = { snapshot, 판정, 알림줄들 };

if (require.main === module) 주();
