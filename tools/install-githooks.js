#!/usr/bin/env node
/* install-githooks — repo의 훅 원본(tools/githooks/)을 이 저장소의 실제 훅 경로에 설치한다.
 *
 * 왜 설치가 필요한가: git 훅은 **버전 관리 밖**에 산다(.git/hooks). 이 저장소는 이미 그 관행으로
 * pre-commit(구문검사)을 쓰고 있어 core.hooksPath를 바꾸지 않는다 — 남의 세션이 커밋 중인데
 * 공유 설정을 갈아끼우는 것이 더 위험하다. 대신 **원본을 repo에 두고 사본을 설치**한다.
 *
 * 그래서 이 스크립트가 없으면 훅은 조용히 안 돈다. 그 상태를 tests/커밋트레일러.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)가
 * skip으로 드러낸다(통과와 미설치가 같은 모양이면 안 된다 — CLAUDE.md 신뢰성 조항).
 *
 * 형제 저장소는 **보고만 한다 — 쓰지 않는다** (마찰 F300 의 2차 발견 · 2026-08-09):
 *   `tests/커밋트레일러.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 는 형제(SYNK-talk)의 사본이 정본과 **실행부까지** 같기를 요구하되
 *   머리말(사연)은 각자 다른 것이 정상이라고 못박는다. 그런데 이 설치기는 형제를 몰라서 정본을
 *   고칠 때마다 손으로 옮겨야 했다 — 회귀는 있는데 배선이 없는 상태였다.
 *   🔴 그래서 「형제도 같이 설치」를 넣었다가 **그 자리에서 사고를 냈다**: 이름이 같다는 이유로
 *   talk 의 `pre-commit`(계약 동기화 게이트)을 이 저장소의 Apps Script 구문검사로 통째 덮었다.
 *   같은 이름이 같은 훅이 아니고, `prepare-commit-msg` 조차 **실행부만** 같아야 한다.
 *   👉 통째 복사는 회귀가 요구하는 것보다 **넓다.** 넓은 자동화는 조용히 남의 것을 삼킨다 —
 *   그래서 여기서는 드리프트를 **말하기만** 하고, 실행부 이식은 사람이 한다(좁은 손 > 넓은 자동).
 *
 * 사용: node tools/install-githooks.js  [--check]
 *   --check = 설치 여부·드리프트만 보고하고 쓰지 않는다(종료코드 1 = 설치 필요)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* SYNK_GITHOOKS_ROOT — 회귀 픽스처 전용 이음매(tests/훅설치.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)). 기본은 이 저장소다.
 * 라이브러리(handoff-store)는 ROOT 가 아니라 **스크립트 곁**에서 읽는다 — 대상 저장소를 바꿔도
 * 도구의 부품이 바뀌는 것은 아니다. */
const ROOT = path.resolve(process.env.SYNK_GITHOOKS_ROOT || path.resolve(__dirname, '..'));
const SRC_DIR = path.join(ROOT, 'tools', 'githooks');
const store = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));
/* 표기 접기 정의도 **스크립트 곁**에서 읽는다(바로 위 주의와 같은 이유 — 대상 저장소를 바꿔도
 * 도구의 부품은 안 바뀐다). 정의는 저장소에 하나뿐이다: 손으로 접으면 CRLF 축만 막히고 줄끝
 * 공백은 샌다(도구층 실측 08-17: 손 접기 12벌 전부 그 반쪽 · #Q101). */
const { 표기접기 } = require(path.join(__dirname, '..', 'tests', 'lib', '소스검사.js'));
const check = process.argv.includes('--check');

/** 그 저장소에서 **실제로 도는** 훅 폴더. 설정을 읽는다 — 자리를 추측하지 않는다
 *  (형제 좌표를 손으로 적으면 그 저장소가 hooksPath 를 바꾸는 날 조용히 빗나간다). */
function hooksDir(뿌리) {
  const run = (args) => execFileSync('git', args, { cwd: 뿌리, encoding: 'utf8' }).trim();
  let dir;
  try { dir = run(['config', '--get', 'core.hooksPath']); } catch (_) { dir = ''; }
  if (!dir) dir = path.join(run(['rev-parse', '--git-common-dir']), 'hooks');
  return path.resolve(뿌리, dir);
}

/* 🔴 **워크트리에서는 «설치»를 안 한다**(08-26 실측·신설).
 *   `hooksDir()` 이 `--git-common-dir` 로 풀기 때문에 dest 는 **어느 트리에서 불러도 메인의
 *   공용 `.git/hooks`** 다(실측: 메인·한 마디·두 마디 셋의 dest 가 바이트로 같았다).
 *   그런데 SRC 는 그 트리의 `tools/githooks` 라 갈린다 — 즉 가지의 훅 판이 **모든 세션의 훅**을
 *   조용히 덮는다. `.git/hooks` 는 git 밖이라 되돌릴 이력도 없다.
 * 🔑 `--check` 는 막지 않는다 — 「지금 무엇이 설치돼 있나」는 어느 트리에서 물어도 같은 사실이다. */
const 쓰기모드 = !process.argv.includes('--check');
if (쓰기모드) {
  try {
    const 절대 = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const 공용 = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (path.resolve(ROOT, 절대) !== path.resolve(ROOT, 공용)) {
      console.error('[install-githooks] 워크트리에서는 설치하지 않는다 — `.git/hooks` 는 모든 트리가 함께 쓴다.');
      console.error(`  여기: ${ROOT}`);
      console.error(`  훅 자리(공용): ${path.join(path.resolve(ROOT, 공용), 'hooks')}`);
      console.error('  → 메인 트리에서 `node tools/install-githooks.js` 를 돌린다. (`--check` 는 여기서도 된다)');
      process.exit(1);
    }
  } catch (_) { /* git 밖·판정 불가 — 가드가 판단할 자리가 아니다(폴백은 기존 동작) */ }
}

const dest = hooksDir(ROOT);
const names = fs.existsSync(SRC_DIR) ? fs.readdirSync(SRC_DIR) : [];
if (!names.length) {
  console.error('[install-githooks] tools/githooks/ 가 비었다.');
  process.exit(1);
}

/* ── F391 — 설치본에만 있는 줄 ─────────────────────────────────────
 * 지금까지는 원본→설치본 **한 방향**만 봤다. 그래서 게이트를 설치본에 먼저 놓은 세션의 줄을
 * 다음 설치 실행이 **조용히** 덮었고, 증상은 「가드가 없다」가 아니라 「있었는데 사라졌다」라
 * 어디에도 안 남는다(실측 08-12 local_91cd3a7c). `.git/hooks` 는 git 밖이라 덮인 내용은
 * 복구 경로가 0이다 — 그래서 write 모드는 보고가 아니라 **거부**다(덮고 나서 말하면 늦다). */
function 설치본단독줄(원본, 설치본) {
  const 줄들 = (s) => 표기접기(s).split('\n').map((l) => l.trim()).filter(Boolean);
  const 원본집합 = new Set(줄들(원본));
  return [...new Set(줄들(설치본))].filter((l) => !원본집합.has(l));
}

let need = 0;
let 보류 = 0;
for (const name of names) {
  const src = path.join(SRC_DIR, name);
  const dst = path.join(dest, name);
  const want = fs.readFileSync(src, 'utf8');
  const have = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : null;
  if (have === want) { console.log(`  = ${name} (최신)`); continue; }
  need++;
  const 단독 = have === null ? [] : 설치본단독줄(want, have);
  if (check) {
    console.log(`  ! ${name} ${have === null ? '미설치' : '원본과 다름(드리프트)'}`);
    for (const l of 단독.slice(0, 6)) console.log(`      ↳ 설치본에만 있는 줄: ${l.slice(0, 120)}`);
    if (단독.length > 6) console.log(`      ↳ … ${단독.length - 6}줄 더`);
    continue;
  }
  if (단독.length) {
    보류++;
    console.log(`  🔴 ${name} — 설치본에만 있는 줄 ${단독.length}개를 덮게 된다 · **안 덮고 보류한다** (F391)`);
    for (const l of 단독.slice(0, 6)) console.log(`      ↳ ${l.slice(0, 120)}`);
    if (단독.length > 6) console.log(`      ↳ … ${단독.length - 6}줄 더`);
    console.log('      → 필요한 줄이면 원본(tools/githooks/)에 먼저 옮기고, 일부러 빼는 것이면 설치본에서 그 줄을 지운 뒤 재실행한다.');
    continue;
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(dst, want, 'utf8');
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows는 실행비트가 없다 */ }
  console.log(`  + ${name} ${have === null ? '설치' : '갱신'} → ${dst}`);
}

/* ── 형제 저장소 — 보고만 한다 (F300) ────────────────────────────────
 * 실행부만 비교한다(주석은 각자 다른 게 정상 · `tests/커밋트레일러.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 와 같은 규칙).
 * 없으면 조용히 넘어가지 않고 **분모를 말한다** — 0곳을 훑고 「최신」이라 찍으면
 * 미실행이 통과와 같은 모양이 된다.
 * 🚫 여기서 쓰지 않는다. 이유는 머리말 — 넓은 복사가 talk 의 pre-commit 을 삼킨 자리다. */
const 실행부 = (원문) => {
  const 줄 = 표기접기(원문).split('\n');
  const 셔뱅 = 줄[0] && 줄[0].startsWith('#!') ? [줄[0].trim()] : [];
  return [...셔뱅, ...줄.slice(셔뱅.length).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))].join('\n');
};
/* 🔑 **두 저장소가 같아야 하는 훅만** 본다. `pre-commit` 은 이름만 같고 하는 일이 다르다
 *   (여기 = Apps Script 구문검사 / talk = 계약 동기화 게이트) — 그걸 「갈라졌다」고 부르면
 *   영영 안 꺼지는 빨간불이 되고, 상시 경보는 곧 우회로가 된다(F103).
 *   같아야 하는 이유가 있는 것은 트레일러 하나뿐이다: 주인 판정이 두 저장소에서 갈리면 안 된다. */
const 형제공유 = ['prepare-commit-msg'];
const 형제 = store.siblings(ROOT);
if (!형제.length) console.log('  · 형제 저장소 0곳 (이 기계엔 없다 — 비교 안 함)');
let 갈라짐 = 0;
for (const { 뿌리, 저장소 } of 형제) {
  let 그쪽;
  try { 그쪽 = hooksDir(뿌리); } catch (_) { console.log(`  · ${저장소}: 훅 폴더를 못 읽었다`); continue; }
  for (const name of names) {
    if (!형제공유.includes(name)) continue;
    const dst = path.join(그쪽, name);
    if (!fs.existsSync(dst)) { console.log(`  · ${저장소}: ${name} 없음 — 그 저장소 커밋엔 주인이 안 박힌다`); continue; }
    if (실행부(fs.readFileSync(dst, 'utf8')) === 실행부(fs.readFileSync(path.join(SRC_DIR, name), 'utf8'))) {
      console.log(`  = ${저장소}/${name} (실행부 같음)`);
      continue;
    }
    갈라짐++;
    console.log(`  🔴 ${저장소}/${name} 실행부가 갈라졌다 → ${dst}`);
  }
}
if (갈라짐) {
  console.log(`\n  ⚠ 형제 ${갈라짐}건은 **손으로** 실행부만 옮긴다 — 같은 이름이 같은 훅이 아니다`);
  console.log('    (통째 복사는 talk 의 pre-commit 을 삼켰다 · F300)');
}

if (check && need) {
  console.error(`[install-githooks] ${need}건 설치 필요 — node tools/install-githooks.js`);
  process.exit(1);
}
if (보류) {
  console.error(`[install-githooks] ${보류}건 보류 — 설치본에만 있는 줄이 있어 덮지 않았다(F391 · 위 처방대로 정리 후 재실행)`);
  process.exit(1);
}
console.log(check ? '[install-githooks] 설치 상태 최신' : '[install-githooks] 완료');
