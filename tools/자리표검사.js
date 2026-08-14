#!/usr/bin/env node
'use strict';
/**
 * 자리표검사 — 확정 안 된 `[vNEXT]` 자리표가 **커밋되는 것**을 막는 호출부. (F450 처방 · 2026-08-15)
 *
 * 왜 있나 — 자리표는 미커밋인 동안 안전하다(`safety [v9.55]` 의 `[v9.N]` 패턴에 안 걸린다).
 * 그래서 `tools/bump-version.js` 도 `.claude/hooks/auto-commit.js` 도 「커밋해도 안전」이라고
 * **적어 두었다.** 그 문장을 믿은 세션이 자리표를 커밋했고(실측 `694497ad`), 커밋되는 순간
 * `tests/버전채번.test.js` 「실저장소에 [vNEXT] 자리표가 남아 있지 않다」가 빨개졌다.
 * 그 적색은 낸 사람이 아니라 **그 뒤 커밋하는 모든 세션의 배포**를 막는다 — 자리표 설계가
 * 없애려던 바로 그 상태다(F078). 커밋 본문은 「먼저 박으면 남의 배포를 막는다」고 인용하면서
 * 정확히 그 결과를 냈다. 사후 검사는 탐지지 예방이 아니라, 신뢰성 조항대로 여기서 앞당긴다.
 *
 * 🔑 판정은 여기서 안 한다 — `tools/bump-version.js` 의 `자리표자리` 하나가 진다. 디스크를 읽는
 *   `pendingPlaceholders` 도 **같은 함수**를 쓴다(둘로 적으면 갈라지고, 갈라지는 방향은 언제나
 *   「통과」다 — F339 가 그 형태였다). 이 파일은 **수집**만 맡는다.
 *
 * 🔑 범위는 `배포파일들()` 그대로다 — 넓히면 안 된다. `CLAUDE.md`·`deploy/SKILL.md`·이 파일·
 *   `tests/버전채번.test.js` 는 자리표를 **설명하려고** 그 문자열을 적는다. 경로 필터를 여기 손으로
 *   적지 않고 판정자의 범위를 그대로 받는 이유가 그것이다(같은 목록을 두 곳에 적으면 갈라진다).
 *
 * 🔑 **커밋될 blob 을 읽는다 — 작업본이 아니다**(F302). `git add` 뒤에 채번하면 작업본은 깨끗한데
 *   인덱스엔 자리표가 남는다. 작업본을 보면 그 커밋을 통과시키고, 통과한 자리표가 라이브로 간다.
 *
 * 사용:
 *   node tools/자리표검사.js --cached     스테이징된 것만 (pre-commit 용)
 *   node tools/자리표검사.js              배포 집합 전량 (손으로 훑을 때 · `--check` 와 같은 범위)
 *
 * 종료코드: 0 깨끗함 · 1 걸림 · 2 검사가 아무것도 못 봤다(전량 모드에서만)
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function git(인자, 옵션 = {}) {
  return execFileSync('git', 인자, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...옵션 });
}

/* ☠️ `-z` 인 이유: git 기본 출력은 비ASCII 경로를 `"\354\227\224..."` 로 이스케이프한다. 이 저장소는
 *   배포 집합 대부분이 한글 이름(`엔진_*.js`)이라, 이스케이프된 이름으로 대조하면 **영원히 안 맞고**
 *   검사는 「0건」으로 조용히 초록이 된다. repo 의 quotepath 설정은 건드리지 않는다(남의 것). */
function 스테이징목록(뿌리경로) {
  return git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], { cwd: 뿌리경로 })
    .split('\0').filter(Boolean);
}

/**
 * 인덱스에 담긴 내용을 읽는다.
 *
 * ⚠ 파일마다 `git show` 를 띄운다 — 옆 `옛글자검사.js` 는 `cat-file --batch` 로 한 번에 긁는데,
 *   그건 대상이 **커밋 전체**라 파일 수가 수백이 될 수 있어서다. 여기 대상은 배포 집합과의
 *   교집합이라 상한이 16이고, 보통 커밋은 0~2다. 바이트 경계를 손으로 자르는 코드를 한 벌 더
 *   두는 값보다 spawn 몇 번이 싸다 — 그 자르기가 어긋나면 조용히 초록이 되는 종류의 코드다.
 */
function 인덱스본문(파일, 뿌리경로) {
  try { return git(['show', ':' + 파일], { cwd: 뿌리경로 }); } catch (_) { return null; }
}

function 작업본문(파일, 뿌리경로) {
  try { return fs.readFileSync(path.join(뿌리경로, 파일), 'utf8'); } catch (_) { return null; }
}

function main(argv) {
  const 스테이징만 = argv.includes('--cached');
  let 뿌리경로;
  try { 뿌리경로 = git(['rev-parse', '--show-toplevel']).trim(); }
  catch (_) { console.error('[자리표] git 저장소가 아니다 — 검사할 자리가 없다.'); return 2; }

  /* 판정자와 **같은 저장소**를 보게 못박는다. 이 이음매가 없으면 워크트리·픽스처에서 뿌리가
   * 갈리고, 갈린 쪽은 파일을 못 읽어 「자리표 0건」이 된다 — 미실행과 통과가 같은 모양이다. */
  if (!process.env.SYNK_BUMP_ROOT) process.env.SYNK_BUMP_ROOT = 뿌리경로;
  const bump = require('./bump-version.js');

  const 배포집합 = bump.배포파일들();
  /* 🔴 빈 배포 집합은 「자리표 0건」과 **같은 모양**이다(clasp 정본을 못 읽은 날이 그렇다 —
   *   bump-version 이 그 자리에 같은 경고를 적어 두었다). 0 을 통과로 읽지 않는다. */
  if (!배포집합.length) {
    console.error('[자리표] 배포 집합이 비었다 — 검사가 아무것도 안 본 채 통과할 뻔했다(clasp 정본 확인).');
    return 2;
  }

  const 대상 = 스테이징만
    ? 스테이징목록(뿌리경로).filter((f) => 배포집합.includes(f))
    : 배포집합;

  if (!대상.length) {
    if (스테이징만) return 0;            // 그 커밋에 배포 파일이 없을 뿐 — 조용히 통과해도 되는 유일한 0
    console.error('[자리표] 배포 파일을 하나도 못 열었다 — 검사가 아무것도 안 봤다.');
    return 2;
  }

  const 걸린곳 = [];
  let 연것 = 0;
  for (const f of 대상) {
    const 내용 = 스테이징만 ? 인덱스본문(f, 뿌리경로) : 작업본문(f, 뿌리경로);
    if (내용 === null) continue;
    연것 += 1;
    for (const { 줄, 문구 } of bump.자리표자리(내용)) 걸린곳.push({ 파일: f, 줄, 문구 });
  }

  if (!걸린곳.length) {
    console.error(`[자리표] 깨끗하다 — 배포 집합 ${배포집합.length}개 중 ${연것}개를 열었다`
      + `${스테이징만 ? ' (스테이징분)' : ''}.`);
    return 0;
  }

  console.error(`\n[자리표] 커밋을 막았다 — 확정 안 된 [vNEXT] 가 ${걸린곳.length}자리에 있다`
    + ` (${연것}개 파일을 열었다):\n`);
  for (const { 파일, 줄, 문구 } of 걸린곳) console.error(`  ✗ ${파일}:${줄}  ${문구}`);
  console.error('\n왜 막나 — 자리표는 **미커밋인 동안만** 안전하다. 커밋되면 tests/버전채번.test.js 가');
  console.error('  빨개지고, 그 적색은 낸 사람이 아니라 **그 뒤 커밋하는 모든 세션의 배포**를 막는다.');
  console.error('\n→ 채번하면 라벨(`·검수 …`)은 그대로 두고 번호만 확정된다:');
  console.error('     node tools/bump-version.js --desc "이번 변경 한 줄 요약" --종류 수리');
  console.error('     git add -- ' + [...new Set(걸린곳.map((c) => c.파일))].join(' '));
  console.error('       ↑ 채번은 **작업본**을 고친다 — 다시 담지 않으면 인덱스엔 자리표가 그대로다');
  console.error('     docs/버전_이력.md 맨 아래에 같은 번호로 한 줄 (없으면 CI 가 또 빨개진다)');
  console.error('   (--종류: 수리=버그 · 보강=기존에 살 붙임 `--시스템 "이름"` · 신설=`--시스템/--한줄/--구역`)');
  /* ⚠ 끄는 손잡이를 **말해 준다**(F103 · 가드 맹점 ③). 채번이 원리상 안 되는 자리가 실재한다:
   *   클라우드·폰 세션은 `claude/*` 밖 태그 push 가 거부돼 bump-version 이 「여기서 번호를 확정하지
   *   않는다 — 헤더를 [vNEXT] 로 둔 채 커밋하면 PC 세션이 반입 때 채번한다」고 **시킨다**(F196).
   *   그 처방과 이 가드는 정면으로 부딪히므로, 부딪히는 자리를 이름으로 적고 통로를 열어 둔다 —
   *   따를 수 없는 처방은 우회를 정상 통로로 만든다. 대신 껐다는 사실이 커밋에 남게 한다. */
  console.error('\n   ⚠ 태그 push 가 막힌 환경(클라우드·폰 · F196)이라 채번이 거부되면 그때는 자리표를');
  console.error('     둔 채 커밋하는 것이 맞다 — SYNK_SKIP_GUARD=1 로 넘기고 **그 사유를 커밋 메시지에**');
  console.error('     쓴다. 반입하는 PC 세션이 채번한다(그 커밋이 master 에 있는 동안 CI 는 빨갛다).\n');
  return 1;
}

if (require.main === module) {
  if (process.env.SYNK_SKIP_GUARD === '1') {
    console.error('[자리표] SYNK_SKIP_GUARD=1 — 검사를 건너뛴다. 끈 이유를 커밋 메시지에 남겨라.');
    process.exit(0);
  }
  process.exit(main(process.argv.slice(2)));
}
module.exports = { main };
