#!/usr/bin/env node
'use strict';
/* git-internals-guard — `.git` «안»에 실행되는 것을 심는 길을 막는다.
 *
 * ■ 왜 생겼나 (2026-09-09)
 *   코덱스는 `workspace-write` 로 돌아도 `.git`·`.codex`·`.agents` 를 **읽기 전용으로 다시 덮는다.**
 *   까닭이 정확하다 — `.git/hooks` 에 쓸 수 있으면 에이전트가 훅을 심고, 그 훅은 **다음번에 사람이
 *   git 을 칠 때 샌드박스 «밖»에서 돈다.** 샌드박스를 우회하는 가장 싼 길이다.
 *
 *   그런데 유호님이 09-09 에 「GPT 도 커밋·push 를 한다」를 확정하셨고(라우터 자리), 그러려면
 *   `.git` 쓰기가 열려야 한다. 그래서 **문을 열되 그 안의 «실행되는 자리»만 따로 잠근다.**
 *   즉 이 가드는 코덱스가 스스로 걸어 둔 자물쇠를 우리가 풀 때 그 자리에 대신 놓는 자물쇠다.
 *
 * ■ 막는 것 셋 — 전부 «샌드박스 밖에서 도는 코드»로 가는 길이다
 *   ① `.git/hooks/` 아래에 쓰기 · 만들기 · 지우기
 *   ② `core.hooksPath` 를 바꾸는 것(훅 폴더를 통째로 다른 데로 옮긴다 — ①을 안 건드리고 같은 일을 한다)
 *   ③ `.git/config` 를 직접 고치는 것(②를 명령이 아니라 파일로 하는 길)
 *
 * ■ 막지 «않는» 것 — 평범한 git 작업은 그대로다
 *   add · commit · push · worktree · fetch · rebase … 전부 통과한다. 이 가드는 «내용»이 아니라
 *   «그 셋»만 본다. 넓게 막으면 사람이 우회를 배우고, 그게 가드를 죽이는 가장 흔한 길이다.
 *
 * ■ 오탐을 줄이는 자리 하나
 *   커밋 메시지나 문서에 `.git/hooks` 라고 «적기만» 해도 막히면 문서화가 벌받는다.
 *   그래서 실행되지 않는 글은 형제 가드와 같은 통로(`lib/shell-text.js`)로 먼저 걷어낸다.
 */

const fs = require('fs');
const path = require('path');

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

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // 입력을 못 읽으면 검사할 것도 없다
}

const 도구 = String(input.tool_name || '');
const 인자 = input.tool_input || {};

/* 실행되지 않는 글(주석·heredoc 본문·인용 산문)을 먼저 걷어낸다 — 형제 가드와 같은 통로. */
function 실행되는글만(s) {
  try {
    return require(path.join(__dirname, 'lib', 'shell-text.js'))
      .stripNonExecutedText(String(s || ''), { keepQuoted: /$^/, keepAs: ' QUOTED ' });
  } catch {
    return String(s || ''); // 통로가 없으면 원문 그대로 본다(놓치는 것보다 낫다)
  }
}

/* 경로 표기가 갈린다 — 슬래시·역슬래시·따옴표를 한 모양으로 눕힌다. */
function 눕히기(s) {
  return String(s || '').replace(/\\/g, '/').replace(/["']/g, '');
}

const 후보 = [];
if (도구 === 'Bash' || 도구 === 'PowerShell') 후보.push(실행되는글만(인자.command));
else 후보.push(눕히기(인자.file_path), 눕히기(인자.path), String(인자.command || ''), String(인자.new_string || ''));

const 글 = 눕히기(후보.filter(Boolean).join('\n'));

/* ① `.git/hooks` 아래를 건드리는가 — 읽기는 놔두고 «쓰는» 낱말이 같이 있을 때만 막는다. */
if (/\.git\/hooks\//i.test(글)) {
  const 쓰는가 = 도구 !== 'Bash' && 도구 !== 'PowerShell'
    ? true // Edit·Write 계열은 경로가 잡힌 순간 쓰는 것이다
    : /(>|>>|cp\s|copy\s|mv\s|move\s|rm\s|del\s|touch\s|chmod\s|Set-Content|Add-Content|Out-File|New-Item|Remove-Item|tee\s|install\s)/i.test(글);
  if (쓰는가) {
    deny(
      '[git-internals-guard] `.git/hooks/` 안에 쓰기 차단 — 여기 심은 것은 **다음번에 사람이 git 을 칠 때\n' +
      '샌드박스 «밖»에서 돈다**. 코덱스가 이 폴더를 읽기 전용으로 덮는 까닭이 정확히 그것이고,\n' +
      '우리는 커밋을 열기 위해 그 자물쇠를 풀었으므로 이 한 자리만 대신 잠근다.\n' +
      '→ git 훅이 정말 필요하면 `tools/install-githooks.js` 를 쓴다(그 통로는 저장소가 관리한다).\n' +
      '→ 읽기만 할 것이면 `cat`·`Get-Content` 처럼 읽는 명령으로 바꾼다.'
    );
  }
}

/* ② 훅 폴더를 통째로 옮기는 설정 — ①을 안 건드리고 같은 일을 한다. */
if (/core\.hooksPath/i.test(글) && /(git\s+config|Set-Content|>|>>)/i.test(글)) {
  deny(
    '[git-internals-guard] `core.hooksPath` 변경 차단 — 훅 폴더를 통째로 다른 데로 옮기면\n' +
    '`.git/hooks` 를 한 글자도 안 건드리고 같은 일을 할 수 있다(샌드박스 밖 실행).\n' +
    '→ 정말 바꿔야 하면 사람이 직접 친다.'
  );
}

/* ③ `.git/config` 를 파일로 직접 고치는 길 — ②를 명령이 아니라 편집으로 하는 갈래다. */
if (/\.git\/config\b/i.test(글)) {
  const 쓰는가 = 도구 !== 'Bash' && 도구 !== 'PowerShell'
    ? true
    : /(>|>>|Set-Content|Add-Content|Out-File|sed\s+-i|tee\s)/i.test(글);
  if (쓰는가) {
    deny(
      '[git-internals-guard] `.git/config` 직접 쓰기 차단 — 여기서 `core.hooksPath` 를 바꾸면\n' +
      '②와 같은 일이 된다.\n' +
      '→ 설정을 바꿀 것이면 `git config <키> <값>` 을 쓴다(그건 이 가드가 키만 보고 판정한다).'
    );
  }
}

process.exit(0);
