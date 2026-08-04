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

/* ③ 코드 파일을 **셸로 제자리 수정**하는 것 — 같은 자리 3번째다(F050·F065·F067).
 *   F050 지침이 「코드 파일 편집은 스크립트가 아니라 Edit 도구로」를 못박은 뒤에도 두 번 났고,
 *   두 번 다 **변이 테스트를 빨리 돌리려다** 났으며, 두 번 다 원복이 실패해
 *   **파일이 변이 상태로 남았다**:
 *     F065 python subprocess 가 CP949 로 자식 stdout 을 디코드하다 예외 → 원복 라인 미실행
 *     F067 sed -i 백업 cp 가 /tmp 로 가서 원복 실패
 *   🔑 왜 특히 위험한가: 실패가 **조용하다**. 스크립트가 죽어도 셸은 다음 명령으로 넘어가고,
 *      남는 것은 「멀쩡해 보이는 저장소 안의 변이된 코드」다 — 그대로 커밋되면 아무도 모른다.
 *      Edit 도구는 실패하면 실패했다고 말하고, 되돌릴 이력이 대화에 남는다.
 *
 *   임시 경로(스크래치패드·/tmp)는 통과시킨다 — 변이본을 **사본으로** 만드는 것이 권장 경로고,
 *   그걸 막으면 변이 검증 자체가 불가능해진다(막기만 하는 가드는 BYPASS 를 가르친다). */
const 임시경로 = /\/tmp\/|\/var\/folders\/|[A-Za-z]:[\\/](?:[^\s'"]*[\\/])?Temp[\\/]|scratchpad/i;
/* perl 은 -i 를 다른 플래그와 **결합**한다(-pi · -ni · -pie) — `\s-i` 만 보면 정확히 실사고
 * 형태(F067 계열)를 놓친다. 그래서 플래그 뭉치 안의 i 를 본다.
 * 파이프 뒤는 안 본다(`[^\n|;&]`) — `sed '…' x.js | grep -i foo` 의 -i 는 남의 것이다. */
const INPLACE = /\b(sed|perl|awk|ruby)\b[^\n|;&]*?\s(?:-[a-zA-Z]*i[a-zA-Z]*(?:\.\w*)?|--in-place\S*)(?=\s|$)/i;
const 쓰기호출 = /\b(?:writeFileSync|appendFileSync|createWriteStream|write_text)\b|\bopen\s*\([^)]*['"][wax]\+?['"]/;

/* ⚠ 규칙 ③은 **실행되지 않는 텍스트를 걷어낸 뒤** 본다.
 *   신설 당일 실측: 이 규칙을 설명하는 커밋 메시지에 `sed -i`·`-pi` 를 적었더니
 *   **그 커밋 자체가 막혔다**. clasp-guard 가 08-01 에 똑같이 겪은 오탐인데(커밋 메시지의
 *   "clasp push" 가 매칭돼 커밋이 막혔다) 그 처방을 새 훅에 안 넣은 것이다.
 *   문서화를 벌하는 가드는 사람이 우회하는 법(BYPASS 남발)을 배우게 만든다.
 *
 *   🔑 ①②는 원본을 봐야 한다 — 인용 **안**의 이스케이프가 바로 그 검사 대상이라
 *      여기서 지우면 자기 눈을 가린다(가드가 자기 전처리에 눈이 머는 자리 · 규칙⑥과 같은 함정). */
function 실행되는것만(s) {
  return s
    .replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1[\s\S]*?^\s*\2\s*$/gm, ' <<HEREDOC ')
    .replace(/(-m|--message)[= ]\s*(['"])[\s\S]*?\2/g, '$1 MSG');
}
const 실행부 = 실행되는것만(cmd);

const inplace = INPLACE.exec(실행부);
if (inplace && !임시경로.test(실행부)) {
  deny(`[shell-inline-guard] ${inplace[1]} 로 파일을 **제자리 수정** — 코드 파일 편집은 셸이 아니라 Edit 도구로 한다.`
    + '\n같은 자리 3번째다(F050 조항 → F065 python 원복 실패 → F067 sed -i 백업 유실).'
    + '\n두 번 다 변이 테스트를 빨리 돌리려다 났고, 두 번 다 **파일이 변이 상태로 남았다**.'
    + '\n🔑 실패가 조용해서 위험하다 — 스크립트가 죽어도 셸은 넘어가고, 남는 건 멀쩡해 보이는 변이된 코드다.'
    + '\n\n→ 저장소 파일을 고칠 거면 `Edit` 도구로(되돌릴 이력이 대화에 남는다).'
    + '\n→ 변이 검증이면 **사본으로** 만든다: 스크래치패드에 변이본을 쓰고 테스트에 이음매로 주입한다.'
    + '\n   (tests/ 의 SYNK_TEST_* 환경변수가 그 통로다 — 실파일을 흔들지 않고 탐지력만 잰다)'
    + '\n   의도적 예외라면 명령 앞에 SHELL_INLINE_BYPASS=1 을 붙인다.');
}

const 실행기2 = /\b(node|python3?|perl|ruby|deno|bun)\b[^\n]*?\s(?:-e|-c|--eval)\s/.exec(실행부);
if (실행기2 && 쓰기호출.test(실행부.slice(실행기2.index)) && !임시경로.test(실행부)) {
  deny('[shell-inline-guard] 인라인 스크립트가 파일을 **쓴다** — 대상이 임시 경로가 아니다.'
    + '\n2026-08-04 F065: python subprocess 가 CP949 디코드 예외로 죽어 원복이 실행되지 않았고,'
    + '\n저장소 코드 파일이 변이된 채 남았다(실패가 조용해서 발각이 늦다).'
    + '\n\n→ 저장소 파일을 고칠 거면 `Edit` 도구로. 산출물·변이본은 스크래치패드에 쓴다.'
    + '\n   의도적 예외라면 명령 앞에 SHELL_INLINE_BYPASS=1 을 붙인다.');
}

process.exit(0);
