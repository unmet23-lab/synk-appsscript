#!/usr/bin/env node
// shell-inline-guard — 셸 인용에 코드를 맡기는 것을 막는다 (PreToolUse 훅)
//
// 왜 있나 — 같은 계열이 **4번** 났고, 앞의 셋과 통로가 다르다.
//   F054 Bash 에 PowerShell here-string(@'…'@) → 본문이 문자열로 새어 들어갔다
//   F056 같은 함정으로 커밋 **제목 첫머리에 @** 가 붙었다
//   F060 큰따옴표 안 백틱이 **명령 치환**으로 실행돼 인용한 코드가 통째로 사라졌다
//   F064 인라인 `node -e "…"` 안에서 `\$SP` 이스케이프가 꼬여 **변수명이 리터럴로** 넘어갔다
//        (경로 자리에 `$SP` 문자열이 들어와 ENOENT)
//   앞의 셋은 **커밋 메시지**라 `git-scope-guard` 규칙⑥이 막는다. F064 는 git 명령이 아니라
//   그 훅에 닿지도 않는다 — 「라우팅이 훅보다 좁으면 구멍」의 반대편, **통로 자체가 없던 자리**다.
//
// 무엇을 권하나: 스크립트는 `Write` 도구로 스크래치패드에 **파일로 쓰고** 그 파일을 실행한다.
//   셸을 아예 안 거치므로 인용·이스케이프가 존재하지 않는다. 커밋 메시지의 `-F` 와 같은 처방이다.
//
// ⚠ 오탐이 비싼 자리다 — `node -e` 한 줄 조회는 이 저장소의 일상이고, 과잉 차단은
//   BYPASS 를 습관으로 가르친다(git-scope-guard·screenshot-budget 과 같은 원칙).
//   그래서 **사다리**로 나눈다:
//     이스케이프된 $·백틱  → 차단  (F064·F060 의 정확한 원인. 의도가 리터럴인지 확장인지 모호하다)
//     여러 줄인데 깨끗함    → 경고만(통과). 파일로 옮기면 더 좋다는 안내
//     한 줄                → 조용히 통과
//
// 의도적 예외: 명령에 SHELL_INLINE_BYPASS=1 을 붙인다.
'use strict';
const fs = require('fs');

function out(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}
const deny = (r) => out('deny', r);

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0); // 입력을 못 읽으면 조용히 — 이 훅은 문법 도우미지 안전장치가 아니다
}

const tool = String(input.tool_name || '');
const cmd = String((input.tool_input && input.tool_input.command) || '');
if (!cmd) process.exit(0);
if (/SHELL_INLINE_BYPASS=1/.test(cmd)) process.exit(0);

const 파일로 =
  '\n→ 대신 파일로 준다(셸을 아예 안 거친다):'
  + '\n   1) `Write` 도구로 스크래치패드에 스크립트 파일을 쓴다'
  + '\n   2) `node <그 파일>` 로 실행한다(인자가 필요하면 파일 안에서 상수로 두거나 단순 인자로 넘긴다)'
  + '\n   의도적 예외라면 명령 앞에 SHELL_INLINE_BYPASS=1 을 붙인다.';

/* ① 셸을 잘못 골랐다 — 한쪽 전용 문법을 다른 쪽에 보낸다.
 *   PowerShell here-string(@'…'@)은 Bash 에서 그냥 문자열이고(F054·F056),
 *   heredoc(<<EOF)은 PowerShell 에 없다. 둘 다 조용히 「비슷하게 생긴 무언가」가 되어
 *   결과물에 섞여 들어간다 — 실패가 아니라 **오염**이라 더 늦게 발견된다. */
if (/^Bash$/i.test(tool) && /@['"]\s*\r?\n/.test(cmd)) {
  deny('[shell-inline-guard] Bash 명령에 PowerShell here-string(@\'…\'@) — Bash 는 이걸 모른다.'
    + '\n본문이 실행되지 않고 **문자열로 새어 들어간다**(F054 실사고 · F056 은 이것 때문에 커밋 제목 첫머리에 @ 가 붙었다).'
    + '\n\n→ Bash 라면 heredoc(<< \'EOF\' … EOF), PowerShell 도구라면 here-string 그대로.'
    + 파일로);
}
if (/^PowerShell$/i.test(tool) && /<<-?\s*['"]?[A-Za-z_]\w*\s*\r?\n/.test(cmd)) {
  deny('[shell-inline-guard] PowerShell 명령에 Bash heredoc(<<EOF) — PowerShell 에는 heredoc 이 없다.'
    + '\n\n→ PowerShell 이라면 here-string(@\'…\'@ · 닫는 \'@ 는 반드시 열 0).'
    + 파일로);
}

/* ② 인라인 스크립트 안의 이스케이프 — F064 의 정확한 원인.
 *   `\$` 는 「리터럴 달러」와 「확장하려다 잘못 막은 것」이 **글자로 구별되지 않는다**.
 *   F064 에서는 `"\$SP"` 가 확장 의도였는데 리터럴이 되어 경로 자리에 변수명이 들어갔다.
 *   실행기를 한정하는 이유 = 등록 필터(*node*·*python* …)와 폭을 맞추기 위해서다.
 *   훅이 필터보다 넓으면 안 불리는 입력이 생기고, 그 방향은 언제나 「통과」다(F053). */
const 실행기 = /\b(node|python3?|perl|ruby|deno|bun)\b[^\n]*?\s(?:-e|-c|--eval)\s/.exec(cmd);
if (실행기) {
  const 본문 = cmd.slice(실행기.index + 실행기[0].length);
  const hit = /\\\$/.test(본문) ? '이스케이프된 $ (\\$)'
    : /\\`/.test(본문) ? '이스케이프된 백틱 (\\`)'
    : null;
  if (hit) {
    deny(`[shell-inline-guard] 인라인 스크립트 안의 ${hit} — 리터럴인지 확장 의도인지 글자로 구별되지 않는다.`
      + '\n2026-08-04 F064 실사고: `"\\$SP"` 가 확장 의도였는데 리터럴로 넘어가 경로 자리에 변수명이 들어갔다(ENOENT).'
      + '\n같은 계열 4번째다(F054 here-string · F056 제목 @ · F060 커밋 메시지 백틱 · F064 여기).'
      + 파일로);
    }
  // 여러 줄인데 이스케이프는 깨끗한 경우 — 막지 않는다. 지금 당장 틀린 건 없고,
  // 인용이 한 겹만 더 겹치면 위험해지는 자리라는 것만 알린다.
  if (/\r?\n/.test(본문.trim())) {
    out('allow', '[shell-inline-guard] 여러 줄 인라인 스크립트 — 지금은 깨끗하지만 인용이 한 겹만 더 겹치면 F064 자리다.'
      + ' 정규식·경로·따옴표가 늘어나면 `Write` 로 파일에 쓰고 실행하는 편이 싸다.');
  }
}

/* ③ 코드 파일을 셸로 **고치는** 통로(sed -i · 리다이렉션 · 인라인 쓰기)는 여기 두지 않는다.
 *
 *   2026-08-04 조율: 같은 마찰(F050·F065·F067)을 두 세션이 각자 막았다. 옆 세션이 세운
 *   `code-edit-guard.js` 가 상위집합이다 — in-place 편집기 + 리다이렉션·tee·cp/mv +
 *   PowerShell 쓰기 cmdlet + 인라인 쓰기까지 보고, `lib/shell-text.js` 공용 통로도 함께 냈다.
 *   내가 먼저 커밋했던 규칙 ③(sed -i · 인라인 쓰기)은 그 부분집합이라 물렸다.
 *
 *   🔑 남겨두면 **판정층이 둘**이 된다 — 규칙을 늘릴 때 둘 다 고쳐야 하고, 08-04 스크린샷 예산의
 *      3번째 실패가 정확히 그 형태였다(settings 필터와 훅이 각각 알고 둘 다 배치를 몰랐다).
 *      그래서 이 훅은 셸 **문법·인용**만 본다: 오배송(①)과 이스케이프(②).
 *
 *   ⚠ 그때 배운 것 하나는 남긴다 — 규칙 ③을 설명하는 커밋 메시지가 그 규칙에 막혔었다.
 *     명령 문자열을 검사하는 규칙은 **실행되지 않는 텍스트**(커밋 메시지·heredoc 본문)를
 *     먼저 걷어내야 한다. 단 ①②는 인용 **안**이 검사 대상이라 그러면 자기 눈을 가린다. */

process.exit(0);
