#!/usr/bin/env node
'use strict';
/**
 * 옛글자검사 — 「쓰는 문자는 한글·몽골어·영어 셋뿐」을 **커밋 때** 발동시키는 호출부.
 *
 * 왜 있나 (F351 · F379): 이 규칙을 지키던 장치는 `tests/문서문자.test.js` 하나였고 그건
 * **스위트를 돌릴 때만** 발화한다. 그래서 위반은 늘 「남이 커밋한 뒤 남이 발견」이 됐고,
 * 발견자는 그 파일이 남의 작업중 선언이라 손을 못 댔다. 그동안 모든 세션의 `test-ci` 가 빨갛고,
 * 그 적색은 「남의 미커밋 탓」으로 오독되기까지 했다(대기열 P2 줄이 그 오독을 실측으로 적었다).
 *
 * 🔑 판정은 여기서 안 한다 — `tools/lib/옛글자.js` 하나가 진다. 이 파일은 **수집**만 맡는다.
 *
 * 🔑 **어느 저장소에서 돌려도 된다** — 뿌리를 `git rev-parse` 로 실측한다. 그래서 형제
 *   저장소(SYNK-talk)의 pre-commit 이 이 파일을 그대로 부를 수 있다. F379 의 새 사실 ②가
 *   「talk 세션은 as 의 test-ci 를 안 돌리므로 그 층에서는 원리상 안 잡힌다」였고, 그 구멍은
 *   여기서만 막힌다(형제에 판정을 복사하면 두 벌이 되어 갈라진다).
 *
 * 사용:
 *   node tools/옛글자검사.js --cached     스테이징된 것만 (pre-commit 용 · 싸다)
 *   node tools/옛글자검사.js              추적 파일 전량 (손으로 훑을 때)
 *
 * 종료코드: 0 깨끗함 · 1 걸림 · 2 검사가 아무것도 못 봤다(전량 모드에서만)
 *
 * ⚠ 이 파일에도 그 글자를 적지 않는다 — 적으면 검사가 자기 소스에 걸린다.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { 대상인가, 걸린줄, 처방 } = require('./lib/옛글자.js');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

/* ☠️ `-z` 인 이유: git 기본 출력은 비ASCII 경로를 `"\352\263\204..."` 로 이스케이프한다.
 *   이 저장소는 경로 대부분이 한글이라, 이스케이프된 이름으로 파일을 열면 **전부 실패**하고
 *   검사는 「0건」으로 조용히 초록이 된다. repo 의 quotepath 설정은 건드리지 않는다(남의 것). */
function git(인자, 옵션 = {}) {
  return execFileSync('git', 인자, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...옵션 });
}

function 뿌리() {
  return git(['rev-parse', '--show-toplevel']).trim();
}

function 목록(스테이징만, 뿌리경로) {
  const 인자 = 스테이징만
    ? ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']
    : ['ls-files', '-z'];
  return git(인자, { cwd: 뿌리경로 }).split('\0').filter(Boolean).filter(대상인가);
}

/**
 * 커밋될 **실물**을 읽는다 — 스테이징 모드는 작업 트리가 아니라 인덱스다.
 * (작업 트리를 읽으면 `git add` 뒤에 고친 내용을 보게 되어, 커밋되는 바이트와 다른 것을 검사한다)
 *
 * ⚠ **파일마다 `git show` 를 띄우지 않는다.** 이 훅은 모든 커밋을 지나므로 그 비용이 곧
 *   커밋 비용이다 — 실측(Windows): 파일당 약 30ms 라 200파일 커밋에서 **6.7초**였다.
 *   느린 가드는 결국 꺼지고, 꺼진 가드는 없는 가드다. 그래서 인덱스 지문을 한 번에 받아
 *   `cat-file --batch` **한 프로세스**로 내용을 긁는다(파일 수와 무관하게 3회 spawn).
 */
function 스테이징본문(파일들, 뿌리경로) {
  const 본문들 = new Map();
  if (!파일들.length) return 본문들;

  /* 경로를 인자로 넘기지 않는다 — 한글 경로 수백 개면 명령줄 길이 상한(Windows ~32KB)에
   * 걸려 검사가 통째로 죽는다. 인덱스 전량을 한 번 받아 JS 에서 고른다(그게 더 싸다). */
  const 지문 = new Map();
  for (const 항 of git(['ls-files', '--stage', '-z'], { cwd: 뿌리경로 }).split('\0')) {
    const 탭 = 항.indexOf('\t');
    if (탭 < 0) continue;
    지문.set(항.slice(탭 + 1), 항.slice(0, 탭).split(/\s+/)[1]);
  }

  const 짝 = 파일들.map((f) => [f, 지문.get(f)]).filter(([, sha]) => sha);
  if (!짝.length) return 본문들;

  /* ⚠ `encoding` 을 주지 않는다 — 그 옵션은 **입력에도** 걸려서 `'buffer'` 를 주면
   *   입력 문자열 변환에서 죽는다. 무인코딩이 곧 Buffer 반환이다. */
  const raw = execFileSync('git', ['cat-file', '--batch'], {
    cwd: 뿌리경로, input: Buffer.from(짝.map(([, sha]) => sha).join('\n') + '\n', 'utf8'),
    maxBuffer: 512 * 1024 * 1024,
  });

  /* `cat-file --batch` 출력: `<sha> <type> <size>\n<내용>\n` 의 반복.
   * 길이를 **바이트로** 잘라야 한다 — 문자로 세면 한글이 든 파일에서 경계가 밀려
   * 그 뒤 전부가 어긋나고, 어긋난 검사는 조용히 초록이 된다. */
  let 자리 = 0;
  for (const [파일] of 짝) {
    const 줄끝 = raw.indexOf(0x0a, 자리);
    if (줄끝 < 0) break;
    const 크기 = Number(raw.slice(자리, 줄끝).toString('utf8').split(' ')[2]);
    if (!Number.isFinite(크기)) break;                     // `<sha> missing` — 다음으로 못 간다
    const 시작 = 줄끝 + 1;
    const 덩이 = raw.slice(시작, 시작 + 크기);
    자리 = 시작 + 크기 + 1;                                 // 내용 뒤 개행
    if (!덩이.includes(0)) 본문들.set(파일, 덩이.toString('utf8'));  // 이진은 안 본다(오탐만 는다)
  }
  return 본문들;
}

function 작업트리본문(파일들, 뿌리경로) {
  const 본문들 = new Map();
  for (const f of 파일들) {
    let raw;
    try { raw = fs.readFileSync(path.join(뿌리경로, f), 'utf8'); } catch (_) { continue; }
    if (!raw.includes('\0')) 본문들.set(f, raw);
  }
  return 본문들;
}

function main(argv) {
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다.
   * ⚠ 종료 코드를 **돌려주는** 꼴이라 `process.exit` 를 여기서 부르지 않는다. */
  const 아는플래그 = ['--cached'];
  const 플래그오류 = 인자게이트('옛글자검사', argv, 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); return 2; }
  const 스테이징만 = argv.includes('--cached');
  let 뿌리경로;
  try {
    뿌리경로 = 뿌리();
  } catch (_) {
    console.error('[옛글자] git 저장소가 아니다 — 검사할 자리가 없다.');
    return 2;
  }

  const 파일들 = 목록(스테이징만, 뿌리경로);

  /* 🔴 **0건과 「아무것도 안 봤다」가 같은 모양이다.** 전량 모드에서 목록이 비면 그건 깨끗한 게
   *   아니라 검사가 죽은 것이다(cwd 어긋남·이스케이프·필터 오작동). 스테이징 모드의 0 은
   *   정상이다 — 그 커밋에 텍스트 파일이 없을 뿐이다. 그래서 **분모를 항상 말한다**. */
  if (!파일들.length) {
    if (스테이징만) return 0;                       // 조용히 통과시켜도 되는 유일한 0
    console.error('[옛글자] 대상 파일을 하나도 못 찾았다 — 검사가 아무것도 안 본 채 통과할 뻔했다.');
    return 2;
  }

  const 본문들 = 스테이징만 ? 스테이징본문(파일들, 뿌리경로) : 작업트리본문(파일들, 뿌리경로);
  const 걸린곳 = [];
  for (const [f, t] of 본문들) 걸린곳.push(...걸린줄(f, t));

  if (!걸린곳.length) {
    console.error(`[옛글자] 깨끗하다 — ${파일들.length}개 파일을 열었다${스테이징만 ? ' (스테이징분)' : ''}.`);
    return 0;
  }

  console.error(`\n[옛글자] 커밋을 막았다 — 옛 글자(한자·가나)가 ${걸린곳.length}자리에 있다:\n`);
  for (const 줄 of 걸린곳) console.error(`  ✗ ${줄}`);
  console.error(`\n→ ${처방}`);
  /* ⚠ 끄는 손잡이를 **말해 준다**(F103). 규칙 문서·신고문처럼 그 글자를 설명해야 하는 자리가
   *   실재하고, 따를 수 없는 처방은 우회를 정상 통로로 만든다. 대신 껐다는 사실이 남게 한다. */
  console.error('   (정말 그 글자여야 하면 SYNK_SKIP_GUARD=1 — 대신 왜 껐는지 커밋 메시지에 쓴다)\n');
  return 1;
}

if (require.main === module) {
  if (process.env.SYNK_SKIP_GUARD === '1') {
    console.error('[옛글자] SYNK_SKIP_GUARD=1 — 검사를 건너뛴다. 끈 이유를 커밋 메시지에 남겨라.');
    process.exit(0);
  }
  process.exit(main(process.argv.slice(2)));
}
module.exports = { main };
