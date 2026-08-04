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
const deny = (reason) => out('deny', reason);

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

/* git 전역 옵션을 흡수하는 공용 접두사 — 아래 규칙은 **전부** 이것으로 시작해야 한다.
 * 왜: 규칙들이 `\bgit\s+add\b` 처럼 서브커맨드가 `git` 바로 뒤에 온다고 가정했는데,
 * 실제로는 `git -C <경로> add -A` 를 상시로 쓴다(settings.json 권한 목록에도 그 형태가 잔뜩 있다).
 * 2026-08-04 실측: 규칙 5개가 **하나도** 그 형태를 잡지 못했고, 못 잡는 방향은 「통과」였다.
 * 호출부마다 고치면 다음 규칙에서 또 틀리므로 상수 하나를 공유하고,
 * 회귀(tests/git범위가드)가 **모든 규칙이 -C 형태를 잡는지**를 검사한다.
 *   값을 따로 받는 옵션(-C <경로> · -c k=v · --git-dir <경로> …)과 값 없는 플래그(--no-pager)를 함께 흡수한다. */
const G = '\\bgit\\s+(?:(?:-[Cc]|--git-dir|--work-tree|--exec-path|--namespace)(?:=\\S+|\\s+\\S+)\\s+|--?[\\w-]+\\s+)*';
const re = (body, flags) => new RegExp(G + body, flags);

/* `-C <경로>`가 붙으면 그 저장소가 대상이다 — 아래 ④⑤는 git 상태를 실제로 읽으므로
 * cwd 대신 그 경로에서 물어야 한다(안 그러면 남의 저장소 상태로 판정한다). */
const cdir = /\bgit\s+(?:[^&|;]*?\s)?-C\s+(['"]?)([^'"\s]+)\1/.exec(exec);
const gitCwd = cdir ? cdir[2] : process.cwd();

const 대안 = '\n→ 대신: git commit -m "..." -- 경로A 경로B'
  + '\n   (경로를 주면 인덱스를 무시하고 그 파일만 커밋된다 — 남이 스테이징해둔 것이 있어도 안 딸려온다)'
  + '\n   묶어 쓰려면 한 호출 안에서: git add 경로A 경로B && git commit -m "..."'
  + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.';

/* ① git add -A / --all / . — untracked까지 담는다(F015: 유호님 git 밖 정본·자격증명 폴더가 같은 트리에 있다) */
if (re('add\\b[^&|;]*?(\\s-A\\b|\\s--all\\b|\\s\\.(\\s|$))').test(exec)) {
  deny('[git-scope-guard] `git add -A` · `git add .` 차단 — 내가 지정하지 않은 파일까지 담는다.'
    + '\n이 저장소는 세션 여럿이 같은 작업 트리를 공유하고, 유호님의 git 밖 정본과 자격증명 폴더가 그 안에 있다.'
    + '\n2026-08-03 실사고(F015): 이 명령이 사업문서 2종을 커밋해 push까지 갔다.' + 대안);
}

/* ② git commit -a / --all — untracked는 안 담지만 **남의 tracked 수정**을 담는다(F013·F014 계열) */
if (re('commit\\b[^&|;]*?(\\s-a\\b|\\s--all\\b|\\s-[a-zA-Z]*a[a-zA-Z]*\\b)').test(exec)
    && !re('commit\\b[^&|;]*?\\s--\\s').test(exec)) {
  deny('[git-scope-guard] `git commit -a` 차단 — 추적 중인 **남의 미커밋 수정**까지 함께 커밋된다.'
    + '\n같은 작업 트리를 세션 5~6개가 공유한다(F013·F014 실사고).' + 대안);
}

/* ③ git clean — 미추적 파일을 지운다. 미추적은 이력·stash·reflog 어디에도 없어 **복구 경로가 0**이고,
 * 이 트리의 미추적 파일은 대개 **다른 세션이 방금 만든 작업물**이다(F025 실사고: 옆 세션의
 * 미커밋 테스트 파일과 codex/ 디렉터리가 정리 한 번에 소멸). dry-run(-n)만 통과 —
 * 커밋과 달리 범위를 좁혀도(경로 지정) 남의 신작을 지우는 성질이 그대로라 경로 예외를 두지 않는다. */
if (re('clean\\b').test(exec)
    && !re('clean\\b[^&|;]*?(\\s-n\\b|\\s--dry-run\\b)').test(exec)) {
  deny('[git-scope-guard] `git clean` 차단 — 미추적 파일은 git의 어떤 안전망에도 없어 복구가 불가능하고,'
    + '\n이 공유 트리의 미추적 파일은 대개 다른 세션이 방금 만든 작업물이다(F025 실사고).'
    + '\n→ 확인만 하려면: git clean -n (dry-run — 지우지 않고 목록만)'
    + '\n   특정 파일을 지우려면 rm 으로 그 파일만 명시 삭제한다.'
    + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.');
}

/* ④ rebase·merge 진행 중의 commit — 2026-08-04 실사고(F038).
 * 옆 세션이 리베이스를 도는 동안 다른 세션이 `git commit -- 경로`를 했고, 그 커밋이
 * **detached HEAD 위에 얹혀** 리베이스 순서 안으로 들어갔다(HEAD가 리베이스 도중 전진해 인덱스가 꼬임).
 * 🔑범인은 부주의가 아니라 **도구가 상태를 안 보여준 것**이다 — `git status --short`는
 * 「rebase in progress」를 **한 글자도 표시하지 않는다**. 범위를 확인하는 습관(`--short`)이
 * 오히려 이 상태를 가린다. 그래서 사람의 주의가 아니라 훅이 본다.
 * 인덱스는 저장소당 하나인데 리베이스는 그 인덱스를 독점한다고 가정한다 — 이 트리에선 거짓이다. */
/* 🔑 2026-08-05 F103: 이 규칙이 **자기 처방을 막았다**. 안내문은 「마치거나(--continue) 되돌린 뒤(--abort)」
 *   라고 적어두고, 그 두 명령이 다시 동사 목록의 `merge` 에 걸려 deny 됐다(실측 재현: 둘 다 deny).
 *   남는 탈출구가 GIT_SCOPE_BYPASS 하나뿐이면 **우회가 정상 통로가 된다** — memory `guard-detection-layers`.
 *   ⚠ 장부가 적어둔 원인 후보 「env 접두어(GIT_EDITOR=)를 매처가 못 읽는다」는 **실측으로 반증됐다**:
 *      접두어를 떼도 똑같이 deny 다. `git rebase --continue` 가 통과하던 것도 처방이 맞아서가 아니라
 *      `rebase` 가 이 목록에 없어서 생긴 **우연**이었다(같은 축인데 한쪽만 막히는 비대칭이 증거다).
 *   그래서 둘을 가른다:
 *     · 진행 중인 작업을 **마치거나 되돌리는** 형태(--continue/--abort/--skip/--quit)
 *       → 새 커밋을 그 위에 얹는 게 아니라 그 작업 자체를 끝낸다. ④는 비켜선다.
 *       여기서 allow 로 조기 종료하지 않는다 — 그러면 ⑤(--abort 의 「더러운 트리」 검사)가 죽는다.
 *       ④가 비켜서도 --abort 는 ⑤가 계속 본다(보호는 그대로, 통로만 열린다).
 *     · 그 밖의 커밋 생성(F038 원형: 남의 rebase 중 `git commit -- 경로`) → 그대로 차단.
 *   그리고 **체인을 분해해서 본다** — `git add <해소한 파일> && git merge --continue` 가
 *   commit 계열 단어 하나 때문에 통째로 막히던 것이 F103 의 나머지 절반이다.
 *   (①②③은 이미 `[^&|;]` 로 구분자를 안 넘는데 ④만 명령 전체를 한 덩어리로 봤다.) */
const 마침꼴 = '(merge|rebase|cherry-pick|revert)\\b[^&|;]*?\\s--(continue|abort|skip|quit)\\b';
const 커밋생성 = exec
  .split(/&&|\|\||[;|\n]/)
  .some((seg) => re('(commit|cherry-pick|revert|merge)\\b').test(seg) && !re(마침꼴).test(seg));
if (커밋생성) {
  const { execFileSync } = require('child_process');
  let gitDir = null;
  try {
    gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8', cwd: gitCwd }).trim();
  } catch { /* git이 없거나 저장소 밖 — 가드가 판단할 자리가 아니다 */ }
  if (gitDir) {
    const fs = require('fs');
    const p = require('path');
    const 진행 = [
      ['rebase-merge', 'rebase'], ['rebase-apply', 'rebase'],
      ['MERGE_HEAD', 'merge'], ['CHERRY_PICK_HEAD', 'cherry-pick'], ['REVERT_HEAD', 'revert'],
    ].find(([name]) => fs.existsSync(p.join(gitDir, name)));
    if (진행) {
      deny(`[git-scope-guard] ${진행[1]} 진행 중 — 새 커밋을 만들지 않는다.`
        + '\n지금 커밋하면 detached HEAD 위에 얹혀 그 작업의 순서 안으로 들어간다(2026-08-04 F038 실사고).'
        + '\n⚠ `git status --short`는 이 상태를 표시하지 않는다 — 범위만 확인하면 못 본다.'
        + '\n→ 먼저: git status (짧은 형식 말고 전체 — 진행 상태가 첫 줄에 나온다)'
        + `\n   **그 ${진행[1]} 가 내 것이면** 커밋으로 끝내지 말고 그 작업의 통로로 끝낸다:`
        + `\n     충돌 파일을 고친 뒤  git add <고친 파일> && git ${진행[1]} --continue`
        + `\n     되돌리려면        git ${진행[1]} --abort`
        + '\n     (이 두 형태는 이 규칙이 비켜선다 — BYPASS 를 붙일 필요가 없다. F103)'
        + '\n   다른 세션의 작업이면 **끝날 때까지 기다린다**(남의 병합을 대신 마치지 않는다).'
        + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.');
    }
  }
}

/* ⑤ 작업 트리를 통째로 되감는 명령 — 2026-08-04 실사고(F037).
 * `git rebase --abort`가 작업 트리를 HEAD로 되돌리며 **옆 세션의 미커밋 편집 2파일을 쓸어냈다**
 * (abort를 한 것은 나고, 피해는 남이 봤다). ③ `git clean`이 미추적을 지우는 것과 같은 자리 —
 * 이쪽은 **추적 중인 남의 수정**을 지운다. 역시 reflog에도 stash에도 남지 않는다.
 * 🔑되감기 자체는 금지하지 않는다(정당한 필요가 있다 — 오늘 나도 abort가 필요했다).
 * 막는 것은 **트리에 미커밋 수정이 있는데 확인 없이 되감는 것**이고,
 * 깨끗한 트리에서는 조용히 통과한다(과잉 차단은 BYPASS 습관을 만든다 — ①~③과 같은 원칙). */
if (re('(rebase|merge|cherry-pick|revert)\\s+--abort\\b').test(exec)
    || re('reset\\b[^&|;]*?\\s--hard\\b').test(exec)
    || re('(checkout|restore)\\b[^&|;]*?\\s--\\s+\\.').test(exec)) {
  const { execFileSync } = require('child_process');
  let 더러운 = [];
  try {
    /* ⚠ core.quotepath=false 없으면 한글 경로가 8진 이스케이프로 나온다 — 이 저장소는 경로가 전부
     * 한글이라, 「무엇이 위험한지 보여주는」 바로 그 목록이 **읽을 수 없는 채로** 뜬다(⑦은 이미 이걸 붙였다). */
    더러운 = execFileSync('git', ['-c', 'core.quotepath=false', 'status', '--porcelain', '--untracked-files=no'],
      { encoding: 'utf8', cwd: gitCwd }).split('\n').filter((l) => l.trim());
  } catch { /* 저장소 밖 — 가드가 판단할 자리가 아니다 */ }

  /* 🔑 2026-08-05 F103 잔여 절반: `--abort` 는 ④를 비켜서게 해도 여기서 **영원히** 막혔다.
   *   충돌 난 merge·rebase 는 정의상 트리가 더럽다(충돌 파일이 unmerged 로 뜬다). 그래서
   *   「트리가 더러우면 되감기 금지」가 **그 작업의 유일한 탈출구**를 상시 차단한다 → 또 BYPASS.
   *   가르는 기준: unmerged 항목은 **그 작업 자신의 상태**지 남이 편집하던 것이 아니다.
   *   abort 가 그걸 버리는 건 사고가 아니라 abort 의 정의다. 그러니 위험 계산에서 뺀다.
   *   ⚠ 빼는 것은 **그 작업의 정식 탈출구(--abort)일 때만**이다 — reset --hard·checkout -- . 는
   *      그 작업과 무관한 뭉툭한 도구라 전부 그대로 센다(F037 보호는 거기서 온전하다).
   *   남의 tracked 수정(M·A·D…)은 여전히 센다 — 그게 F037 이 지키려던 바로 그것이다. */
  const 탈출구 = re('(rebase|merge|cherry-pick|revert)\\s+--abort\\b').test(exec);
  const unmerged = (l) => /^(DD|AU|UD|UA|DU|AA|UU)\s/.test(l);
  const 충돌수 = 더러운.filter(unmerged).length;
  if (탈출구) 더러운 = 더러운.filter((l) => !unmerged(l));
  더러운 = 더러운.slice(0, 12);

  if (더러운.length) {
    deny('[git-scope-guard] 되감기 차단 — 작업 트리에 **미커밋 수정**이 있다.'
      + '\n이 트리는 세션 여럿이 공유하고, 그 수정은 대개 다른 세션이 지금 작업 중인 것이다.'
      + '\n되감으면 그 편집은 reflog·stash 어디에도 남지 않는다(2026-08-04 F037 실사고: 옆 세션 2파일 소멸).'
      + '\n\n지금 트리의 미커밋 수정:\n  ' + 더러운.join('\n  ')
      + (탈출구 && 충돌수
        ? `\n(충돌 중인 ${충돌수}개는 뺐다 — 그건 이 작업 자신의 상태라 abort 가 버리는 게 정상이다. 위는 그와 무관한 수정이다.)`
        : '')
      + '\n\n→ 남의 것이면: 그 세션에 알리고 커밋될 때까지 기다린다.'
      + '\n   내 것이면: 먼저 커밋하거나 `git stash push -- 경로`로 대피시킨 뒤 되감는다.'
      + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.');
  }
}

/* ⑦ git stash — 규칙⑤(되감기)와 **같은 자리, 방향만 다르다**. 되감기는 남의 수정을 지우고,
 *   stash 는 남의 수정을 **어딘가로 옮긴다**. 둘 다 「내 트리인 줄 알았는데 공유 트리였다」가 원인.
 *
 *   2026-08-04 F066 실사고: 한 세션이 CI 실패 원인을 가리려고 `git stash` 를 걸었는데,
 *   그 안에 **다른 세션이 121줄 수정 중이던 clasp-guard.js** 가 들어갔다. 그 명령이 2분 타임아웃에
 *   걸려 pop 이 실행되지 않을 뻔했고, 실제로 그 사이 **원 세션이 「내 편집이 사라졌다」고 오판해
 *   복구를 시작하기 직전까지 갔다**(F068). 피해가 작았던 건 설계가 아니라 pop 이 제때 돈 덕이다.
 *
 *   🔑 stash 를 금지하지는 않는다 — 규칙⑤의 안내문이 「내 것이면 stash 로 대피시켜라」라고
 *      권하고 있고, 그건 여전히 옳다. 가르는 기준은 **범위**다:
 *        경로 미지정 → 트리 전체를 쓸어 담는다. 남의 것이 반드시 함께 간다 → 차단
 *        경로 지정   → 의도가 좁다. 통과시키되 그 경로의 미커밋을 보여준다(내 것이 맞는지 확인용)
 *      깨끗한 트리에서는 조용히 통과한다(과잉 차단은 BYPASS 습관을 만든다). */
{
  const st = re('stash\\b\\s*(\\S*)').exec(exec);
  const sub = st ? String(st[1] || '') : null;
  if (st && !/^(list|show|pop|apply|drop|clear|branch|create|store)$/.test(sub)) {
    const { execFileSync } = require('child_process');
    let 더러운 = [];
    try {
      더러운 = execFileSync('git', ['-c', 'core.quotepath=false', 'status', '--porcelain', '--untracked-files=no'],
        { encoding: 'utf8', cwd: gitCwd }).split('\n').filter((l) => l.trim()).slice(0, 12);
    } catch { /* 저장소 밖 — 가드가 판단할 자리가 아니다 */ }
    const 경로지정 = /stash\b[^&|;]*?\s--\s+\S/.test(exec);
    if (더러운.length && !경로지정) {
      deny('[git-scope-guard] 경로 없는 `git stash` 차단 — 작업 트리를 **통째로** 쓸어 담는다.'
        + '\n이 트리는 세션 여럿이 공유하고, 지금 있는 미커밋은 대개 다른 세션이 작업 중인 것이다.'
        + '\n2026-08-04 F066 실사고: 진단하려고 건 stash 에 옆 세션의 121줄 편집이 딸려 들어갔고,'
        + '\npop 이 늦어 그 세션이 「내 편집이 사라졌다」고 오판해 복구를 시작하기 직전까지 갔다(F068).'
        + '\n\n지금 트리의 미커밋 수정:\n  ' + 더러운.join('\n  ')
        + '\n\n→ 내 것만 대피시키려면 경로를 준다: git stash push -- 경로A 경로B'
        + '\n   진단하려고 잠시 치우는 거라면 **치우지 말고 읽는다**: git show HEAD:경로'
        + '\n   (남의 미커밋 파일은 진단 목적이라도 stash·checkout 하지 않는다)'
        + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.');
    }
    if (더러운.length && 경로지정) {
      out('allow', '[git-scope-guard] 경로를 준 stash — 그 파일이 **내 편집이 맞는지** 확인했나.'
        + ' 남의 것이면 진단 목적이라도 치우지 말고 `git show HEAD:경로` 로 읽는다(F066).'
        + '\n지금 트리의 미커밋:\n  ' + 더러운.join('\n  '));
    }
  }
}

/* ⑥ 커밋 메시지를 **셸 인용에 맡기는 것** — 같은 자리 3번째다(F054·F056·F060).
 *   ① F054: Bash 에 PowerShell here-string(@'…'@)을 보내 본문이 문자열로 새어 들어갔다.
 *   ② F056: 같은 함정으로 커밋 **제목 첫머리에 @** 가 붙었다(제목 표식을 쓰는 규약이라 더 나쁘다).
 *   ③ F060: 큰따옴표 안 백틱이 **명령 치환**으로 해석돼 인용한 코드가 통째로 사라졌다
 *           (bash: mono: command not found). 타 세션이 이미 push 한 뒤라 amend 도 못 했다.
 * 프로즈는 두 번 실패했다 — v7.11 「셸이 둘이다」 조항이 있는 상태에서 ③이 났고,
 * F056 이 「스크래치패드 파일 + -F 로 통일한다」고 처방까지 적어둔 뒤였다.
 * 지침 자체가 「3번째 = 원인을 쓸 수 없게 만든다」를 요구하므로 여기서 기계로 막는다.
 *
 * 🔑 원본 `cmd` 를 본다 — 위쪽 `exec` 는 stripNonExecutedText 가 `-m "…"` 을 `MSG` 로 지워버려
 *    **정확히 이 결함이 안 보인다**. 가드가 자기 전처리에 눈이 머는 자리다.
 *
 * 작은따옴표는 검사하지 않는다 — Bash·PowerShell 둘 다 리터럴이라 안전하다.
 * 이스케이프한 것(\` \$)도 통과시킨다: 위험한 건 「셸이 해석하는」 문자지 「글자로 쓴」 문자가 아니다. */
const 메시지인용 = /(?:-m|--message)[= ]\s*"((?:[^"\\]|\\.)*)"/g;
for (let m; (m = 메시지인용.exec(cmd)) !== null;) {
  const 본문 = m[1].replace(/\\./g, ''); // 이스케이프된 문자는 셸이 안 건드린다
  const hit = /`/.test(본문) ? '백틱(`)'
    : /\$\(/.test(본문) ? '$( )'
    : /\$\{|\$[A-Za-z_]/.test(본문) ? '$변수'
    : null;
  if (!hit) continue;
  deny(`[git-scope-guard] 커밋 메시지 안의 ${hit} — 셸이 해석해서 그 부분이 **사라지거나 딴것으로 바뀐다**.`
    + '\n2026-08-04 F060 실사고: 백틱으로 인용한 코드가 명령 치환으로 실행돼 메시지에서 통째로 없어졌고,'
    + '\n그때는 타 세션이 이미 push 한 뒤라 amend 도 불가능했다(공유 브랜치 force-push 는 문구보다 비싸다).'
    + '\n같은 자리 3번째다(F054 here-string 누출 · F056 제목 첫머리 @ · F060 백틱).'
    + '\n\n→ 대신 파일로 준다(셸을 아예 안 거친다):'
    + '\n   1) Write 도구로 스크래치패드에 메시지 파일을 쓴다'
    + '\n   2) git commit -F <그 파일> -- 경로A 경로B'
    + '\n   짧은 한 줄이면 작은따옴표도 안전하다: git commit -m \'제목\' -- 경로'
    + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.');
}

process.exit(0);
