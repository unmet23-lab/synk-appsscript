#!/usr/bin/env node
'use strict';
/**
 * 제어문자검사 — 원시 제어문자(C0·DEL)가 **커밋되는 것**을 막는다. (F454 처방 · 2026-08-15)
 *
 * 왜 있나 — 제어문자를 쓰는 코드를 «사람 말로 설명하는» 순간 원시 바이트가 파일에 박힌다.
 *   2026-08-15 한 세션에서 **세 번** 났다(`docs/버전_이력.md` · 커밋 메시지 · 판단 층 검토문).
 *   셋 다 같은 동작이다 — 구분자·센티넬을 주석·이력·커밋문에 설명하기. 이 저장소에서 그건
 *   드문 동작이 아니라 **규약**이라(`원인지문_` 주석 자신이 그 예다) 재발 조건이 상시다.
 *   CLAUDE.md 신뢰성 조항의 「3번째 = 원인을 쓸 수 없게 만든다」 자리다.
 *
 * ⚠ 새는 방향이 **조용하다** — 원시 0x01 은 폭이 0이라 에디터·diff·터미널이 대개 안 그린다.
 *   `cat -v` 로 «찾으러 가야» 보인다. 실피해가 0이었던 이유는 매번 찾으러 갔기 때문이고,
 *   그건 사람 손이라 철학 ㉡ 에 어긋난다.
 *
 * ⚠ **이 파일에도 그 바이트를 적지 않는다** — 적으면 이 검사가 자기 소스에 걸린다.
 *   필요한 자리는 전부 숫자(0x01)나 이스케이프 표기로 쓴다(회귀 픽스처 포함).
 *
 * 🔑 **면제 목록이 없다.** 옆 `tools/lib/옛글자.js` 는 장부·인계문·evals 를 뺀다 — 그 규칙은
 *   「옛 사고를 인용하려면 그 글자를 적어야」 해서다. 그 사유는 여기로 **안 넘어온다**:
 *   제어문자를 신고하는 글은 언제나 `\u0001` 표기로 쓰지 원시 바이트를 적지 않는다.
 *   실제로 F454 의 세 번째 재발이 **신고문 자신** 안이었다 — 면제를 물려받았으면 그 자리가
 *   영원히 안 잡힌다. 규칙보다 좁은 필터는 그 자체가 구멍이고, 새는 방향은 언제나 「통과」다.
 *
 * 🔑 **장부 권고(ㄴ)를 그대로 안 따랐다.** F454 는 「`tools/자리표검사.js` 에 얹어라」라고
 *   적었는데, 그 도구의 범위는 `배포파일들()` = Apps Script **16개**이고 자기 머리말이
 *   「넓히면 안 된다」고 못박는다. 실측하면 사고 3건이 **전부 그 16개 밖**이다 — 얹었으면
 *   사고가 난 자리에서 영원히 초록인 가드가 된다(CLAUDE.md 맹점 ④ · 맞는 얼굴로 틀린 값).
 *
 * 💸 **새 장치의 대가**(경량 원칙 — 새 장치엔 대가를 함께 적는다):
 *   · 틀릴 때의 모습 = 확장자 목록이 낡으면 **조용히 초록**이다(새 텍스트 확장자가 대상 밖으로
 *     샌다). 그래서 `tests/제어문자.test.js` 가 분모(연 파일 수)를 함께 못박는다.
 *   · 닫을 것 = **없다.** 이건 안전 가드라 억지로 짝을 지우지 않는다. 대신 통로를 안 늘렸다 —
 *     판정과 수집을 이 파일 **하나**가 지고(소비자가 둘뿐이라 lib 를 따로 안 판다),
 *     발동 조건만 `pre-commit`·`commit-msg` 가 맡는다.
 *
 * 사용:
 *   node tools/제어문자검사.js --cached          스테이징된 것만 (pre-commit 용)
 *   node tools/제어문자검사.js                    추적 텍스트 전량 (손으로 훑을 때)
 *   node tools/제어문자검사.js --메시지 <파일>    커밋 메시지 파일 (commit-msg 용)
 *
 * 종료코드: 0 깨끗함 · 1 걸림 · 2 검사가 아무것도 못 봤다(전량 모드에서만)
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/* 허용하는 셋 — 탭(0x09) · 개행(0x0A) · 복귀(0x0D). 나머지 C0 전부와 DEL(0x7F) 이 과녁이다.
 * DEL 은 엄밀히 C0 가 아니지만 **같은 병**이다(폭 0 · 에디터가 안 그린다) — 이름이 아니라
 * 증상으로 묶는다. */
const 허용바이트 = new Set([0x09, 0x0a, 0x0d]);
function 금지바이트인가(b) {
  return (b <= 0x1f && !허용바이트.has(b)) || b === 0x7f;
}

/* 사람이 읽는 텍스트만 — 폰트·이미지·영상·PDF 는 제어문자가 **내용 그 자체**라 볼 것이 없다.
 * 🔴 **이 목록이 곧 스캔 범위다** — 여기 없는 확장자는 걸리지 않는 게 아니라 애초에 안 열린다.
 *   옆 `tools/lib/옛글자.js` 가 `.ts` 를 빠뜨려 형제 저장소 Edge Function 전량이 대상 밖이던
 *   자리가 있다(신뢰성 ③). 늘릴 때는 **회귀의 분모가 함께 움직이는지** 보고 늘린다. */
const 대상확장자 = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.md', '.html', '.json', '.txt', '.py', '.css', '.sql', '.yml', '.yaml',
  '.sh', '.csv', '.svg', '.xml']);

/**
 * 이 경로를 열어 볼 것인가. 경로는 **저장소 뿌리 기준 슬래시 표기**여야 한다(git 이 주는 그대로).
 *
 * 🔴 **확장자가 없는 파일도 본다 — 이 가드가 자기 배선에 눈이 멀던 자리다.** 첫 커밋에서 실측:
 *   5개를 담았는데 게이트가 「3개를 열었다」고 말했다. 빠진 둘이 `tools/githooks/pre-commit` 과
 *   `commit-msg`, 즉 **이 검사를 등록하는 훅 자신**이었다(셸 스크립트라 확장자가 없다).
 *   가드는 자기 전처리에도 눈이 먼다(CLAUDE.md 신뢰성 ④).
 * ⚠ 셔뱅(`#!`)만으로 좁히지 않는다 — 그러면 `.gitignore`·`LICENSE` 가 다시 빠지고, 규칙보다
 *   좁은 필터는 그 자체가 구멍이다(신뢰성 ③). 실측 08-15: 확장자 없는 추적 파일 **10개 = 셔뱅 3
 *   + 그 밖 7(dotfile·LICENSE)** 이고 **전부 텍스트다** — 즉 지금 거짓양성의 재료가 0이다.
 *   확장자 없는 바이너리가 생기는 날에는 그 파일 이름이 차단문에 찍히니, 그때 실측을 손에 쥐고
 *   좁힌다(지금 미리 좁히면 무엇을 잃는지 모르는 채로 잃는다).
 */
function 대상인가(파일) {
  const 확 = path.extname(파일).toLowerCase();
  return 확 === '' || 대상확장자.has(확);
}

/**
 * 한 파일의 **바이트**에서 걸린 자리를 낸다 — 빈 배열이면 깨끗하다.
 *
 * 🔑 문자열이 아니라 `Buffer` 를 받는다. utf8 로 바꿔 세면 잘못된 바이트열이 U+FFFD 로 뭉개져
 *   **원본이 더러운데 초록**이 나온다 — 「재는 층이 값을 깨뜨리지 않는지 확인한다」(CLAUDE.md
 *   원인 판정 ②).
 */
function 걸린줄(파일, buf) {
  const 결과 = [];
  let 줄 = 1;
  let 줄머리 = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x0a) { 줄 += 1; 줄머리 = i + 1; continue; }
    if (!금지바이트인가(b)) continue;
    결과.push(`${파일}:${줄}:${i - 줄머리 + 1}  U+${b.toString(16).padStart(4, '0').toUpperCase()}`);
  }
  return 결과;
}

const 처방 = '원시 제어문자를 지우고 **이스케이프 표기**로 쓴다 — 예: 0x01 은 소스에서 `\\u0001`,\n'
  + '     산문에서는 「U+0001」. 화면에서 폭이 0이라 눈으로는 못 찾는다: `git diff --cached | cat -v`\n'
  + '     로 `^A` 를 보거나, 이 검사를 다시 돌려 자리(줄:칸)를 받는다.';

/* ☠️ `-z` 인 이유: git 기본 출력은 비ASCII 경로를 `"\352\263\204..."` 로 이스케이프한다.
 *   이 저장소는 경로 대부분이 한글이라, 이스케이프된 이름으로 파일을 열면 **전부 실패**하고
 *   검사는 「0건」으로 조용히 초록이 된다. repo 의 quotepath 설정은 건드리지 않는다(남의 것). */
function git(인자, 옵션 = {}) {
  return execFileSync('git', 인자, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...옵션 });
}

function 목록(스테이징만, 뿌리경로) {
  const 인자 = 스테이징만
    ? ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']
    : ['ls-files', '-z'];
  return git(인자, { cwd: 뿌리경로 }).split('\0').filter(Boolean).filter(대상인가);
}

/**
 * 커밋될 **실물**을 읽는다 — 스테이징 모드는 작업 트리가 아니라 인덱스다.
 * (작업 트리를 보면 `git add` 뒤에 고친 내용을 검사하게 되어, 커밋되는 바이트와 다른 것을 잰다 · F302)
 *
 * ⚠ 파일마다 `git show` 를 띄우지 않는다 — 이 훅은 모든 커밋을 지나므로 그 비용이 곧 커밋
 *   비용이다(옆 `옛글자검사.js` 실측: 파일당 30ms · 200파일이면 6.7초). 인덱스 지문을 한 번
 *   받아 `cat-file --batch` **한 프로세스**로 긁는다.
 */
function 스테이징본문(파일들, 뿌리경로) {
  const 본문들 = new Map();
  if (!파일들.length) return 본문들;

  /* 경로를 인자로 넘기지 않는다 — 한글 경로 수백 개면 명령줄 길이 상한(Windows ~32KB)에
   * 걸려 검사가 통째로 죽는다. 인덱스 전량을 한 번 받아 JS 에서 고른다. */
  const 지문 = new Map();
  for (const 항 of git(['ls-files', '--stage', '-z'], { cwd: 뿌리경로 }).split('\0')) {
    const 탭 = 항.indexOf('\t');
    if (탭 < 0) continue;
    지문.set(항.slice(탭 + 1), 항.slice(0, 탭).split(/\s+/)[1]);
  }

  const 짝 = 파일들.map((f) => [f, 지문.get(f)]).filter(([, sha]) => sha);
  if (!짝.length) return 본문들;

  /* ⚠ `encoding` 을 주지 않는다 — 그 옵션은 **입력에도** 걸린다. 무인코딩이 곧 Buffer 반환이고,
   *   여기서는 Buffer 가 **필요하다**(바이트를 세는 검사다). */
  const raw = execFileSync('git', ['cat-file', '--batch'], {
    cwd: 뿌리경로, input: Buffer.from(짝.map(([, sha]) => sha).join('\n') + '\n', 'utf8'),
    maxBuffer: 512 * 1024 * 1024,
  });

  /* `cat-file --batch` 출력: `<sha> <type> <size>\n<내용>\n` 의 반복.
   * 길이를 **바이트로** 잘라야 한다 — 문자로 세면 한글이 든 파일에서 경계가 밀려 그 뒤 전부가
   * 어긋나고, 어긋난 검사는 조용히 초록이 된다. */
  let 자리 = 0;
  for (const [파일] of 짝) {
    const 줄끝 = raw.indexOf(0x0a, 자리);
    if (줄끝 < 0) break;
    const 크기 = Number(raw.slice(자리, 줄끝).toString('utf8').split(' ')[2]);
    if (!Number.isFinite(크기)) break;                     // `<sha> missing` — 다음으로 못 간다
    const 시작 = 줄끝 + 1;
    본문들.set(파일, raw.slice(시작, 시작 + 크기));
    자리 = 시작 + 크기 + 1;                                 // 내용 뒤 개행
  }
  return 본문들;
}

function 작업트리본문(파일들, 뿌리경로) {
  const 본문들 = new Map();
  for (const f of 파일들) {
    try { 본문들.set(f, fs.readFileSync(path.join(뿌리경로, f))); } catch (_) { /* 지워진 것 */ }
  }
  return 본문들;
}

/** 커밋 메시지 파일 하나. **git 이 붙이는 주석줄(`#`)은 뺀다** — 그건 커밋에 안 들어간다. */
function 메시지검사(메시지파일) {
  let buf;
  try { buf = fs.readFileSync(메시지파일); } catch (_) {
    console.error(`[제어문자] 커밋 메시지 파일을 못 열었다 — ${메시지파일}`);
    return 0;                                   // 막지 않는다: 메시지 귀속은 편의지 안전장치가 아니다
  }
  const 본문 = buf.toString('utf8').split('\n').filter((l) => !l.startsWith('#')).join('\n');
  const 걸린곳 = 걸린줄('(커밋 메시지)', Buffer.from(본문, 'utf8'));
  if (!걸린곳.length) return 0;
  console.error(`\n[제어문자] 커밋을 막았다 — 원시 제어문자가 커밋 «메시지» ${걸린곳.length}자리에 있다:\n`);
  for (const 줄 of 걸린곳) console.error(`  ✗ ${줄}`);
  console.error('\n🔴 메시지는 되돌릴 수 없다 — 커밋되면 그 바이트가 git 이력에 영원히 남는다.');
  console.error(`\n→ ${처방}\n`);
  return 1;
}

function main(argv) {
  const 메시지자리 = argv.indexOf('--메시지');
  if (메시지자리 >= 0) return 메시지검사(argv[메시지자리 + 1]);

  const 스테이징만 = argv.includes('--cached');
  let 뿌리경로;
  try { 뿌리경로 = git(['rev-parse', '--show-toplevel']).trim(); }
  catch (_) { console.error('[제어문자] git 저장소가 아니다 — 검사할 자리가 없다.'); return 2; }

  const 파일들 = 목록(스테이징만, 뿌리경로);

  /* 🔴 **0건과 「아무것도 안 봤다」가 같은 모양이다.** 전량 모드에서 목록이 비면 그건 깨끗한 게
   *   아니라 검사가 죽은 것이다(cwd 어긋남·이스케이프·필터 오작동). 스테이징 모드의 0 은
   *   정상이다 — 그 커밋에 텍스트 파일이 없을 뿐이다. 그래서 **분모를 항상 말한다**(F207). */
  if (!파일들.length) {
    if (스테이징만) return 0;                       // 조용히 통과시켜도 되는 유일한 0
    console.error('[제어문자] 대상 파일을 하나도 못 찾았다 — 검사가 아무것도 안 본 채 통과할 뻔했다.');
    return 2;
  }

  const 본문들 = 스테이징만 ? 스테이징본문(파일들, 뿌리경로) : 작업트리본문(파일들, 뿌리경로);
  const 걸린곳 = [];
  for (const [f, buf] of 본문들) 걸린곳.push(...걸린줄(f, buf));

  if (!걸린곳.length) {
    console.error(`[제어문자] 깨끗하다 — ${본문들.size}개 파일을 열었다`
      + `${스테이징만 ? ' (스테이징분)' : ` (대상 ${파일들.length})`}.`);
    return 0;
  }

  console.error(`\n[제어문자] 커밋을 막았다 — 원시 제어문자가 ${걸린곳.length}자리에 있다`
    + ` (${본문들.size}개 파일을 열었다):\n`);
  for (const 줄 of 걸린곳.slice(0, 40)) console.error(`  ✗ ${줄}`);
  if (걸린곳.length > 40) console.error(`  … 그리고 ${걸린곳.length - 40}자리 더`);
  console.error(`\n→ ${처방}`);
  /* ⚠ 끄는 손잡이를 **말해 준다**(F103 · 가드 맹점 ③). 원시 바이트가 정말 필요한 자리가
   *   생길 수 있다(픽스처를 추적 파일로 두는 날). 따를 수 없는 처방은 우회를 정상 통로로
   *   만든다 — 대신 껐다는 사실이 커밋에 남게 한다. */
  console.error('\n   (정말 그 바이트여야 하면 SYNK_SKIP_GUARD=1 — 대신 왜 껐는지 커밋 메시지에 쓴다)\n');
  return 1;
}

if (require.main === module) {
  if (process.env.SYNK_SKIP_GUARD === '1') {
    console.error('[제어문자] SYNK_SKIP_GUARD=1 — 검사를 건너뛴다. 끈 이유를 커밋 메시지에 남겨라.');
    process.exit(0);
  }
  process.exit(main(process.argv.slice(2)));
}
module.exports = { main, 걸린줄, 대상인가, 대상확장자, 금지바이트인가, 처방 };
