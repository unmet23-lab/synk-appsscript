#!/usr/bin/env node
// git-scope-guard — 커밋 범위 게이트 (PreToolUse 훅)
//
// 무엇을 막나: `git add -A` · `git add .` · `git commit -a` 처럼 **내가 지정하지 않은 것까지 담는** 명령.
//
// 왜 기계로 옮겼나 (마찰 장부 F006·F013·F014·F015 — 같은 원인 4건, 프로즈 대책은 5번 실패했다):
//   이 저장소는 세션 5~6개가 **같은 작업 트리와 같은 git 인덱스**를 공유한다. 그래서
//     · 남이 `git add` 해둔 파일이 내 인덱스에 얹혀 있고(F013·F014 — 경합)
//     · 유호님의 **git 밖 정본**(`docs/정본/SYNK STUDIO/`)과 **자격증명 폴더**가 같은 트리 안에 산다(F015 — 범위 과잉).
//   2026-08-03 F015 실사고: `git add -A` 가 유호님 사업문서 2종 + `.lnk` 를 담아 push까지 갔다.
//   같은 폴더에 `로그인.txt` 가 있었고, 안 나간 이유는 오직 `.gitignore` 한 줄이었다.
//   **「git 밖에 두기로 한 것」은 「추가하지 않기」로는 안 지켜진다 — 의도는 명령을 못 이긴다.**
//
// 무엇을 권하나: `git commit -m "..." -- 경로A 경로B`
//   경로를 주면 **인덱스를 통째로 무시**하고 그 파일만 커밋된다. 남이 스테이징해둔 것이 있어도 안 딸려온다.
//   (`git add A B && git commit -m ...` 도 허용 — 다만 두 명령을 **한 호출 안에서** 이어야 한다.
//    도구 호출 경계를 사이에 두면 그 틈에 피어가 커밋해 F014가 재발한다.)
//
// 통과 시 출력 없이 종료(기존 권한 흐름 유지), 위반 시 deny JSON.
// 의도적 예외는 명령에 GIT_SCOPE_BYPASS=1 을 붙여 의식적으로 우회한다.
'use strict';
const fs = require('fs');

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

let cmd = '';
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  cmd = String((input.tool_input && input.tool_input.command) || '');
} catch (_) {
  process.exit(0);
}

/* 실행되지 않는 텍스트를 먼저 걷어낸다 — clasp-guard의 2026-08-01 오탐 교훈 승계:
 * 커밋 메시지나 heredoc 본문에 `git add -A` 라고 **적기만 해도** 막히면,
 * 이 사고를 문서화하는 커밋 자체가 차단된다. 가드는 실행되는 명령을 봐야지 사람이 쓴 문장을 보면 안 된다. */
function stripNonExecutedText(s) {
  return s
    .replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm, ' <<HEREDOC ')
    .replace(/(-m|--message)\s+(['"])[\s\S]*?\2/g, '$1 MSG');
}

const exec = stripNonExecutedText(cmd);
if (/GIT_SCOPE_BYPASS=1/.test(exec)) process.exit(0);

const 대안 = '\n→ 대신: git commit -m "..." -- 경로A 경로B'
  + '\n   (경로를 주면 인덱스를 무시하고 그 파일만 커밋된다 — 남이 스테이징해둔 것이 있어도 안 딸려온다)'
  + '\n   묶어 쓰려면 한 호출 안에서: git add 경로A 경로B && git commit -m "..."'
  + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.';

/* ① git add -A / --all / . — untracked까지 담는다(F015: 유호님 git 밖 정본·자격증명 폴더가 같은 트리에 있다) */
if (/\bgit\s+add\b[^&|;]*?(\s-A\b|\s--all\b|\s\.(\s|$))/.test(exec)) {
  deny('[git-scope-guard] `git add -A` · `git add .` 차단 — 내가 지정하지 않은 파일까지 담는다.'
    + '\n이 저장소는 세션 여럿이 같은 작업 트리를 공유하고, 유호님의 git 밖 정본과 자격증명 폴더가 그 안에 있다.'
    + '\n2026-08-03 실사고(F015): 이 명령이 사업문서 2종을 커밋해 push까지 갔다.' + 대안);
}

/* ② git commit -a / --all — untracked는 안 담지만 **남의 tracked 수정**을 담는다(F013·F014 계열) */
if (/\bgit\s+commit\b[^&|;]*?(\s-a\b|\s--all\b|\s-[a-zA-Z]*a[a-zA-Z]*\b)/.test(exec)
    && !/\bgit\s+commit\b[^&|;]*?\s--\s/.test(exec)) {
  deny('[git-scope-guard] `git commit -a` 차단 — 추적 중인 **남의 미커밋 수정**까지 함께 커밋된다.'
    + '\n같은 작업 트리를 세션 5~6개가 공유한다(F013·F014 실사고).' + 대안);
}

process.exit(0);
