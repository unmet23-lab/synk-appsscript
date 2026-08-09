#!/usr/bin/env node
/* install-githooks — repo의 훅 원본(tools/githooks/)을 이 저장소의 실제 훅 경로에 설치한다.
 *
 * 왜 설치가 필요한가: git 훅은 **버전 관리 밖**에 산다(.git/hooks). 이 저장소는 이미 그 관행으로
 * pre-commit(구문검사)을 쓰고 있어 core.hooksPath를 바꾸지 않는다 — 남의 세션이 커밋 중인데
 * 공유 설정을 갈아끼우는 것이 더 위험하다. 대신 **원본을 repo에 두고 사본을 설치**한다.
 *
 * 그래서 이 스크립트가 없으면 훅은 조용히 안 돈다. 그 상태를 tests/커밋트레일러.test.js가
 * skip으로 드러낸다(통과와 미설치가 같은 모양이면 안 된다 — CLAUDE.md 신뢰성 조항).
 *
 * 형제 저장소는 **보고만 한다 — 쓰지 않는다** (마찰 F300 의 2차 발견 · 2026-08-09):
 *   `tests/커밋트레일러.test.js` 는 형제(SYNK-talk)의 사본이 정본과 **실행부까지** 같기를 요구하되
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

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'tools', 'githooks');
const store = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js'));
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

const dest = hooksDir(ROOT);
const names = fs.existsSync(SRC_DIR) ? fs.readdirSync(SRC_DIR) : [];
if (!names.length) {
  console.error('[install-githooks] tools/githooks/ 가 비었다.');
  process.exit(1);
}

let need = 0;
for (const name of names) {
  const src = path.join(SRC_DIR, name);
  const dst = path.join(dest, name);
  const want = fs.readFileSync(src, 'utf8');
  const have = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : null;
  if (have === want) { console.log(`  = ${name} (최신)`); continue; }
  need++;
  if (check) { console.log(`  ! ${name} ${have === null ? '미설치' : '원본과 다름(드리프트)'}`); continue; }
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(dst, want, 'utf8');
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows는 실행비트가 없다 */ }
  console.log(`  + ${name} ${have === null ? '설치' : '갱신'} → ${dst}`);
}

/* ── 형제 저장소 — 보고만 한다 (F300) ────────────────────────────────
 * 실행부만 비교한다(주석은 각자 다른 게 정상 · `tests/커밋트레일러.test.js` 와 같은 규칙).
 * 없으면 조용히 넘어가지 않고 **분모를 말한다** — 0곳을 훑고 「최신」이라 찍으면
 * 미실행이 통과와 같은 모양이 된다.
 * 🚫 여기서 쓰지 않는다. 이유는 머리말 — 넓은 복사가 talk 의 pre-commit 을 삼킨 자리다. */
const 실행부 = (원문) => {
  const 줄 = String(원문).replace(/\r\n/g, '\n').split('\n');
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
console.log(check ? '[install-githooks] 설치 상태 최신' : '[install-githooks] 완료');
