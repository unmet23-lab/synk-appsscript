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
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require('./lib/board-id.js');

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

/* 서브커맨드 **이름이 끝나는 자리** — `\b` 로 적으면 `-` 가 낱말 경계라 이름을 반토막 낸다.
 * 2026-08-17 실측(F573): ④의 `merge\b` 가 **`git merge-base --is-ancestor` 를 deny** 했다.
 *   그건 커밋을 만들 수 없는 **읽기 전용 조회**이고, 하필 인계문·F566 계열이 「착지 확인에 쓰라」고
 *   지목하는 명령이다 — 즉 가드가 자기 처방의 확인 통로를 막았다(F103 형태).
 * 🔑 `G` 상수와 **같은 뿌리의 두 번째다**: 그때는 `git` 과 서브커맨드 «사이»(전역 옵션)를 놓쳤고,
 *   이번엔 서브커맨드 이름의 «끝»을 놓쳤다. 그래서 또 호출부마다 고치지 않고 상수를 하나 둔다.
 * 실물 분모(`git help -a` 실측 8종): merge-base·merge-file·merge-index·merge-tree·merge-one-file ·
 *   commit-tree·commit-graph·checkout-index — 전부 이 문으로 샜다.
 * ⚠ 새는 방향이 **차단**이라 조용하지 않았다(막히면 사람이 본다). 그래도 값이 비싼 이유는
 *   막힌 것이 «확인» 통로라서다 — 확인을 못 하면 판정이 추정으로 내려간다.
 * ⚠ `mergetool` 은 원래 안 걸렸다(`merge` 뒤 `t` 는 낱말 경계가 아니다) — 대시 있는 이름만 샜다.
 *
 * ⚠ **회귀가 «안» 보는 자리 셋** — 「옛 통로를 소스에서 금지한다」 검사는 `re('<동사>…')` 꼴만 훑는다.
 *   아래 셋은 그 밖이라 검사에 안 걸리는데, **열어 보고 안전을 확인했다**(고칠 자리가 아니라 아는 자리다):
 *     · `마침꼴`(예외 문자열) · `되감기꼴`/`탈출구꼴` 의 `--abort` 두 곳 — `G` 가 동사를 `git ` **바로 뒤**로
 *       못 박으므로 여기 닿는 문자열은 `git merge-base --continue` 꼴뿐이고, `--continue|abort|skip|quit`
 *       를 받는 대시 서브커맨드는 실존하지 않는다(`git help -a` 실측).
 *     · ⑦-a 의 맨 정규식 `/stash\b…/` — 대시 붙은 `stash-*` 서브커맨드가 없다.
 *   즉 지금은 구멍이 아니지만, **새 동사를 이 셋에 추가하는 사람은 회귀의 보호를 못 받는다.**
 *   그때는 `re()` 를 통하게 옮기는 것이 통로다(그러면 소스 축이 자동으로 그 자리를 본다). */
const 끝 = '(?![-\\w])';

/* `-C <경로>`가 붙으면 그 저장소가 대상이다 — 아래 ④⑤는 git 상태를 실제로 읽으므로
 * cwd 대신 그 경로에서 물어야 한다(안 그러면 남의 저장소 상태로 판정한다). */
const cdir = /\bgit\s+(?:[^&|;]*?\s)?-C\s+(['"]?)([^'"\s]+)\1/.exec(exec);

/* …그리고 `-C` 없이 **셸이 옮겨간** 경우가 남아 있었다 (F134 · F137 과 같은 뿌리).
 *   이 훅의 `process.cwd()` 는 셸의 현재 위치가 아니라 **세션 프로젝트 폴더**다. 그래서
 *   `cd ../SYNK-talk && git merge …` 는 talk 를 향하는데 판정 재료는 appsscript 것이 된다.
 *   실측 F134: talk 워크트리(깨끗)를 향한 merge 가 **appsscript 의 인계문 2건**을 근거로 막혔다.
 *   그때는 거짓양성이라 안전했지만 **방향을 뒤집으면 통과다** — appsscript 가 깨끗하고 talk 에
 *   남의 미커밋이 있으면 ⑤ 되감기가 조용히 지나간다(가드가 지키려던 바로 그 경우).
 *   그래서 세그먼트를 왼쪽부터 훑어 git 을 만나기 직전의 위치를 쓴다. 못 읽는 경로면 안 옮긴다
 *   (파싱 실패가 판정을 엉뚱한 저장소로 보내면, 새는 방향은 또 「통과」다). */
function 셸이간곳() {
  const path = require('path');
  const 폴더인가 = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  let 곳 = process.cwd();
  for (const seg of exec.split(/&&|\|\||[;\n]/)) {
    const m = /^\s*(?:cd|Set-Location|sl)\s+(?:-Path\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/.exec(seg);
    if (m) {
      const 다음 = path.resolve(곳, m[1] || m[2] || m[3]);
      if (폴더인가(다음)) 곳 = 다음;
      continue;
    }
    if (/\bgit\b/.test(seg)) break;   // git 이 실제로 도는 자리 = 지금까지 따라온 위치
  }
  return 곳;
}
const gitCwd = cdir ? cdir[2] : 셸이간곳();

const 대안 = '\n→ 대신: git commit -m "..." -- 경로A 경로B'
  + '\n   (경로를 주면 인덱스를 무시하고 그 파일만 커밋된다 — 남이 스테이징해둔 것이 있어도 안 딸려온다)'
  + '\n   묶어 쓰려면 한 호출 안에서: git add 경로A 경로B && git commit -m "..."'
  + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.';

/* 🔑 발동한 **조각**을 돌려준다 — 발동 조건과 예외 조건을 **같은 조각**에서 본다 (F216·F218).
 *   둘을 각각 명령 **전체**에서 찾으면, 다른 조각의 예외가 통과권이 된다. 실측 3형이 전부
 *   「통과」로 샜다(가드가 존재하는 이유 그 자체를 뚫는 방향이다):
 *     · `git clean -n && git clean -fd`                  → ③ 미추적 삭제(복구 경로 0 · F025)
 *     · `git commit -- a.md && git commit -a -m x`       → ② 남의 스테이징 동승(F013·F014)
 *     · `git rebase --abort && git reset --hard origin/master` → ⑤ 남의 미커밋 소멸(F037)
 *   4번째라 호출부마다 고치지 않고 통로를 하나 둔다 — 새 규칙도 이걸 통해야 같은 구멍이 안 생긴다. */
const 걸린조각 = (발동, 예외) => exec.split(/&&|\|\||[;|\n]/).find((s) => 발동(s) && !(예외 && 예외(s)));

/* ① git add -A / --all / . — untracked까지 담는다(F015: 유호님 git 밖 정본·자격증명 폴더가 같은 트리에 있다) */
if (걸린조각((s) => re('add' + 끝 + '[^&|;]*?(\\s-A\\b|\\s--all\\b|\\s\\.(\\s|$))').test(s))) {
  deny('[git-scope-guard] `git add -A` · `git add .` 차단 — 내가 지정하지 않은 파일까지 담는다.'
    + '\n이 저장소는 세션 여럿이 같은 작업 트리를 공유하고, 유호님의 git 밖 정본과 자격증명 폴더가 그 안에 있다.'
    + '\n2026-08-03 실사고(F015): 이 명령이 사업문서 2종을 커밋해 push까지 갔다.' + 대안);
}

/* ② git commit -a / --all — untracked는 안 담지만 **남의 tracked 수정**을 담는다(F013·F014 계열) */
if (걸린조각(
  (s) => re('commit' + 끝 + '[^&|;]*?(\\s-a\\b|\\s--all\\b|\\s-[a-zA-Z]*a[a-zA-Z]*\\b)').test(s),
  (s) => re('commit' + 끝 + '[^&|;]*?\\s--\\s').test(s))) {
  deny('[git-scope-guard] `git commit -a` 차단 — 추적 중인 **남의 미커밋 수정**까지 함께 커밋된다.'
    + '\n같은 작업 트리를 세션 5~6개가 공유한다(F013·F014 실사고).' + 대안);
}

/* ⑩ 훅 건너뛰기(`--no-verify`) — 프로즈로만 있던 금지를 기계로 옮긴다 (F473 · 2026-08-15).
 *
 * 실사고: 커밋 메시지의 회귀 숫자를 고치려고 `git commit --amend --no-verify` 를 썼다.
 *   CLAUDE.md 도 harness 도 「훅 건너뛰기는 유호님 명시 요청 때만」인데 **내 편의로** 썼다.
 *   `prepare-commit-msg` 는 `--no-verify` 가 안 막아 Session-Id 는 살았지만 그건 운이지 판단이 아니다.
 *
 * 🔴 이 저장소에서 특히 비싼 이유 — 이 한 플래그가 끄는 게이트가 **아홉**이다(실측 2026-08-15:
 *   pre-commit 여덟 = 계약동기화·계약동봉·이해대장·옛글자·인용·자리표·제어문자·대기열채번 + commit-msg 하나).
 *   그중 제어문자·옛글자는 **커밋되는 순간 이력에 영원히 남는** 축이라 다음 커밋으로 못 고친다.
 *
 * 🔑 급소는 `--no-verify` 가 아니라 **「안 재본 수를 메시지에 쓴 것」**이다 — F473 자신이 그렇게 판정했다.
 *   그 원인은 여기서 못 막는다. 다만 이 문을 닫으면 정정 경로가 「훅을 다시 지나는 amend」로 돌아오고,
 *   그건 몇 초짜리라 우회할 이유 자체가 사라진다.
 *
 * ⚠ `-n` 은 **commit 에서만** 잡는다 — `git push -n` 은 `--dry-run` 이라 오히려 안전한 쪽이고,
 *   그것까지 막으면 확인용 통로가 사라져 따를 수 없는 처방이 된다(F103). */
if (걸린조각((s) => re('commit' + 끝 + '[^&|;]*?(\\s--no-verify\\b|\\s-[a-zA-Z]*n[a-zA-Z]*\\b)').test(s))
  || 걸린조각((s) => re('push' + 끝 + '[^&|;]*?\\s--no-verify\\b').test(s))) {
  deny('[git-scope-guard] `--no-verify` 차단 — 훅 건너뛰기는 **유호님이 명시로 요청할 때만**이다 (F473).'
    + '\n이 한 플래그가 끄는 게이트가 아홉이다(pre-commit 여덟 + commit-msg 하나).'
    + '\n그중 제어문자·옛글자는 커밋되는 순간 **이력에 영원히 남아** 다음 커밋으로 못 고친다.'
    + '\n\n🔑 F473 이 난 자리: 메시지의 회귀 숫자가 틀려서 고치려고 붙였다. 급소는 이 플래그가 아니라'
    + '\n   **안 재본 수를 메시지에 쓴 것**이었다 — 숫자는 재고 나서 쓴다.'
    + '\n\n→ 메시지만 고칠 때:  git commit --amend -F <메시지파일>   (훅을 다시 지난다 · 몇 초다)'
    + '\n   훅이 실제로 틀렸으면 **그 훅을 고친다** — 끄는 것은 그 결함을 다음 세션에 넘기는 것이다.'
    + '\n   유호님이 명시로 요청한 자리라면: 명령 앞에 GIT_SCOPE_BYPASS=1');
}

/* ③ git clean — 미추적 파일을 지운다. 미추적은 이력·stash·reflog 어디에도 없어 **복구 경로가 0**이고,
 * 이 트리의 미추적 파일은 대개 **다른 세션이 방금 만든 작업물**이다(F025 실사고: 옆 세션의
 * 미커밋 테스트 파일과 codex/ 디렉터리가 정리 한 번에 소멸). dry-run(-n)만 통과 —
 * 커밋과 달리 범위를 좁혀도(경로 지정) 남의 신작을 지우는 성질이 그대로라 경로 예외를 두지 않는다. */
if (걸린조각(
  (s) => re('clean' + 끝).test(s),
  (s) => re('clean' + 끝 + '[^&|;]*?(\\s-n\\b|\\s--dry-run\\b)').test(s))) {
  deny('[git-scope-guard] `git clean` 차단 — 미추적 파일은 git의 어떤 안전망에도 없어 복구가 불가능하고,'
    + '\n이 공유 트리의 미추적 파일은 대개 다른 세션이 방금 만든 작업물이다(F025 실사고).'
    + '\n→ 확인만 하려면: git clean -n (dry-run — 지우지 않고 목록만)'
    + '\n   특정 파일을 지우려면 rm 으로 그 파일만 명시 삭제한다.'
    + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.');
}

/* ⑨ synk-memory 원격으로의 push — **세션은 커밋까지, push 는 스케줄러·Actions 몫** (F392).
 *   (번호는 추가순 — 자리는 성질순이라 exec 층 규칙들 옆에 둔다.)
 *   2026-08-13 실사고: 세션이 메모리 백업 저장소에서 push 를 직접 날렸다(e8909eb). fast-forward 라
 *   피해 0이었지만, 자동화(`auto: memory sync`)가 같은 원격에 동시에 쓰면 non-ff 거절이 나고 —
 *   그때 사람이 배우는 다음 수가 `--force` 다. 그 문이 열리기 전에 통로를 하나로 좁힌다.
 *   🔑 판정 재료는 **그 저장소의 원격 목록**이다(경로 무늬가 아니라) — 클론 위치가 바뀌어도 따라간다.
 *   원격 조회 실패는 「대상 아님」으로 접는다: 이 규칙의 새는 방향은 「통과」지만, 대상 아닌 저장소를
 *   막는 쪽으로 새면 BYPASS 습관을 가르친다(v6.11) — ③의 「경로 예외 없음」과 반대 성질의 자리다. */
{
  const 푸시조각 = 걸린조각((s) => re('push' + 끝).test(s));
  if (푸시조각) {
    let 원격들 = '';
    try {
      원격들 = require('child_process').execFileSync('git', ['-C', gitCwd, 'remote', '-v'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (_) { /* 저장소 아님·git 없음 — 이 규칙의 대상이 아니다 */ }
    if (/synk-memory/i.test(원격들) || /synk-memory/i.test(푸시조각)) {
      deny('[git-scope-guard] synk-memory 로의 `git push` 차단 — 그 원격은 스케줄러·Actions 가 쓴다(세션은 읽기·커밋까지 · F392).'
        + '\n커밋까지는 세션 몫이 맞다 — 남긴 커밋은 다음 `auto: memory sync` 가 실어 나른다.'
        + '\n같은 원격에 둘이 쓰면 non-ff 거절이 나고, 그 다음에 사람이 배우는 수가 --force 다.'
        + '\n→ 커밋에서 멈춘다. 자동화가 죽은 것을 **확인한** 경우에만 GIT_SCOPE_BYPASS=1 을 붙인다.');
    }
  }
  /* ⑨-b 처방문 되먹임 구멍(가드 맹점 ③): 위 사유의 「push 는 자동화 몫」을 읽은 세션이 그
   * 자동화 스크립트(tools/memory-push.cmd — Task Scheduler 가 매시 돌린다)를 **손으로 당기면**
   * 같은 push 가 이 가드 시야 밖에서 재현된다(.cmd 안의 git 은 훅을 안 지난다). 호출만 막고
   * 읽기는 자유다 — 조각의 **첫 낱말**이 그 스크립트일 때만 호출이다(cat·type 등 읽개가 첫
   * 낱말이면 언급일 뿐이다). 스케줄러 자신은 세션 훅 밖에서 돌므로 이 규칙에 안 닿는다. */
  const 메모리푸시호출 = 걸린조각((s) =>
    /^\s*(?:(?:call|start|cmd(?:\.exe)?\s+\/[ck]|&|\.)\s+)?["']?(?:[A-Za-z]:)?[\w.\/\\~-]*memory-push(?:\.cmd)?["']?(?:\s|$)/i.test(s));
  if (메모리푸시호출) {
    deny('[git-scope-guard] 스케줄러의 push 스크립트(tools/memory-push.cmd)를 세션이 직접 호출 — synk-memory push 와 같은 통로 위반이다(F392).'
      + '\n그 스크립트는 Task Scheduler(SYNK_MemoryPush)가 매시 돌린다 — 남긴 커밋은 다음 정시가 싣는다.'
      + '\n→ 커밋에서 멈춘다. 자동화가 죽은 것을 **확인한** 경우에만 GIT_SCOPE_BYPASS=1 을 붙인다.');
  }
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
 *   ⚠ 이 자리에 「①②③은 `[^&|;]` 라 안전하고 ④만 그랬다」고 적혀 있었는데 **틀렸다**(F216·F218):
 *     발동 정규식이 구분자를 안 넘어도, **예외** 정규식을 명령 전체에서 찾으면 다른 조각의 예외가
 *     통과권이 된다. ②③⑤⑦이 전부 그 형태였다 — 지금은 넷 다 `걸린조각` 을 통한다. */
const 마침꼴 = '(merge|rebase|cherry-pick|revert)\\b[^&|;]*?\\s--(continue|abort|skip|quit)\\b';
const 커밋생성 = !!걸린조각(
  (s) => re('(commit|cherry-pick|revert|merge)' + 끝).test(s),
  (s) => re(마침꼴).test(s));
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
/* ⚠ ⑤의 `--abort` 는 **예외가 아니라 완화**다(아래 F103 주석). 그래서 조각을 고르는 순서가
 *   판정을 바꾼다 — 위험한 조각(abort 아닌 되감기)을 **먼저** 집고, 없을 때만 abort 조각을 쓴다.
 *   그냥 첫 조각을 쓰면 `git rebase --abort && git reset --hard` 가 abort 의 완화를 물려받는다. */
/* ⑤-a 「작업본을 통째로 덮어쓰는 형태」 — 축이 **표기가 아니라 행위**다 (F590 · 2026-08-18).
 *
 * 왜 바꿨나: 옛 판정은 `(checkout|restore)…\s--\s+\.` 하나였다. 즉 「`-- .` 라고 쓴 것」만 봤다.
 *   실측 2026-08-18(격리 픽스처 `M a.txt` · 실훅 24칸): **소멸형 16건 중 막힌 것 5 · 구멍 11**.
 *   구멍에는 `git checkout .` 과 `git restore .` 이 들어 있었다 — `--` 를 뺀, git 이 스스로 권하는
 *   가장 흔한 표기다. 그리고 그 둘은 `.claude/settings.local.json` 허용목록의
 *   `Bash(git checkout *)`·`Bash(git restore *)` 에 걸려 **권한 프롬프트조차 없이** 돈다.
 *   F037(옆 세션 미커밋 2파일 소멸)이 지키려던 자리가 정확히 그 형태로 열려 있었다.
 * 🔑 F590 신고분(`checkout-index -a -f`)은 그 11 중 하나였다. 신고문은 「그 한 명령의 실사용이
 *   0이면 안 닫는다」를 판정 기준으로 뒀는데, 실사용 0은 참이었지만(`git log -S` 전량 = 장부·주석·
 *   픽스처뿐) **분모가 그 명령이 아니라 행위 부류**였다. 부류로 세니 답이 뒤집힌다.
 * ⚠ 대가(틀릴 때의 모습): pathspec 을 `.`·`./`·`:/` 로만 센다 — `git checkout -- '*'` 이나
 *   최상위 폴더를 손으로 나열한 형태는 여전히 통과한다(새는 방향은 「통과」다). 여기까지 넓힌 이유는
 *   나열형은 **범위를 사람이 골랐다**는 뜻이라 ①③⑤가 공유하는 「범위」 원칙 안이기 때문이다.
 * ⚠ 경로 지정형은 통과여야 한다 — `git checkout -- a.txt`·`git checkout-index a.txt` 는 한 파일만
 *   꺼내는 정당한 통로다. 과잉 차단은 BYPASS 를 습관으로 만든다(F590 신고문이 못박은 조건). */
const 전량pathspec = '\\s(?:--\\s+)?(?:\\.\\/?|:\\/)(?=\\s|$)';
/* `--force-with-lease` 류가 `\b` 로 새는 것이 F573 이었다 — 긴 플래그 끝은 전부 `끝` 으로 닫는다. */
const 강제꼴 = '\\s(?:--force|--discard-changes|-[a-zA-Z]*f[a-zA-Z]*)' + 끝;
/* `--staged`(=`--cached`)만 있고 `--worktree` 가 없으면 인덱스만 되돌린다 — 작업본 내용은 남으므로
 * 잃는 것이 없다. 이걸 안 빼면 정당한 언스테이징이 막혀 또 BYPASS 를 가르친다. */
const 인덱스만 = (s) => /--(staged|cached)\b/.test(s) && !/--worktree\b/.test(s);
const 덮어쓰기꼴 = (s) =>
  (re('(checkout|restore)' + 끝 + '[^&|;]*?' + 전량pathspec).test(s) && !인덱스만(s))
  || re('(checkout|switch)' + 끝 + '[^&|;]*?' + 강제꼴).test(s)
  || re('checkout-index' + 끝 + '[^&|;]*?\\s(?:--all|-[a-zA-Z]*a[a-zA-Z]*)' + 끝).test(s)
  || re('read-tree' + 끝 + '[^&|;]*?\\s-[a-zA-Z]*u[a-zA-Z]*' + 끝).test(s);

const 되감기꼴 = (s) => re('(rebase|merge|cherry-pick|revert)\\s+--abort\\b').test(s)
  || re('reset' + 끝 + '[^&|;]*?\\s--hard\\b').test(s)
  || 덮어쓰기꼴(s);
const 탈출구꼴 = (s) => re('(rebase|merge|cherry-pick|revert)\\s+--abort\\b').test(s);
const 되감기조각 = 걸린조각(되감기꼴, 탈출구꼴) || 걸린조각(되감기꼴);
if (되감기조각) {
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
  const 탈출구 = 탈출구꼴(되감기조각);   // 명령 전체가 아니라 **걸린 그 조각**을 본다(F218)
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
/*   ⚠ **체인을 분해해서 본다**(F216 · ④가 F103 에서 받은 처방을 여기만 안 받고 있었다).
 *      명령 전체를 한 덩어리로 보면 **양방향으로** 틀린다 — 실측 둘 다:
 *        · `git stash list; git stash show` → `(\S*)` 가 구분자까지 삼켜 서브커맨드를 「list;」로
 *          잡고 **읽기 전용 조회를 차단**한다. 하필 그게 repo-staleness 훅이 시키는 진단이라
 *          통로가 BYPASS 밖에 없어진다(따를 수 없는 처방은 우회를 정상 통로로 만든다).
 *        · `git stash list && git stash` → **첫 번째 하나만** 보므로 뒤엣 맨 stash 가 통과한다.
 *          그게 트리를 통째로 쓸어담는 F066 사고 그 형태다. 새는 방향은 언제나 통과다. */
/*   🔴 2026-08-07 F212 잔여 — 「읽기전용」이라 이름 붙은 칸에 **파괴 하위명령이 5개** 있었다.
 *      list·show 옆에 pop·apply·drop·clear·branch 가 같이 앉아 전부 무사통과였고, 새는 방향은 통과다.
 *        · pop·apply  = 이 규칙이 막는 것의 **역방향**이다. 담는 대신 **쏟는다** — 공유 트리의
 *          남의 미커밋 위로 merge 가 돌고, 충돌하면 **남의 파일에 충돌 표시가 박힌다**.
 *          repo-staleness(F208)가 autostash 잔재를 알리며 「pop 은 대조 전 금지」라고 말하는데
 *          그 금지를 세는 층이 없었다 — 같은 판정이 두 곳에 적혀 갈라진 자리(CLAUDE.md 훅 맹점④).
 *        · drop·clear = ③ `git clean` 과 같은 자리다. autostash 잔재는 **어느 브랜치에도 없는
 *          유일본**이라(F208 실물: 남의 7파일) 지우면 복구 경로가 0이다. clear 는 그걸 전부 한다.
 *        · branch    = 조회처럼 생겼지만 성공하면 stash 를 **drop 한다**. 없애기 쪽에 둔다.
 *      가르는 기준은 ⑦의 원칙 그대로 **범위**다 — 잃을 것이 없으면(깨끗한 트리·빈 stash) 조용하다. */
{
  const { execFileSync } = require('child_process');
  const 하위 = (s) => { const m = re('stash' + 끝 + '\\s*(\\S*)').exec(s); return m ? String(m[1] || '') : null; };
  const 조회 = /^(list|show|create|store)$/;   // 트리도 stash 목록도 안 줄인다
  const 쏟기 = /^(pop|apply)$/;
  const 없애기 = /^(drop|clear|branch)$/;
  const 조각 = (판정) => 걸린조각((s) => { const v = 하위(s); return v !== null && 판정(v); });
  const 미커밋 = () => {
    try {
      return execFileSync('git', ['-c', 'core.quotepath=false', 'status', '--porcelain', '--untracked-files=no'],
        { encoding: 'utf8', cwd: gitCwd }).split('\n').filter((l) => l.trim());
    } catch { return []; /* 저장소 밖 — 가드가 판단할 자리가 아니다 */ }
  };

  /* ⑦-c 없애기 — 트리 상태와 무관하다. 잴 것은 **지우면 되돌릴 데가 남는가** 하나다.
   *   🔑 통과 조건을 **보존**으로 뒀다(⑨와 같은 통로 · F103). 태그·브랜치가 그 stash 커밋을
   *   가리키면 조각을 지워도 내용은 이력에 남으니 조용히 통과한다 — 그래서 차단문이 시키는
   *   두 걸음(못 박고 → 지운다)이 **실제로 통한다**. 「어차피 못 지운다」로 두면 남은 출구가
   *   BYPASS(전 규칙 off) 뿐이고, 그게 F212 가 났던 자리다. 잔재를 영영 못 치우게 하지도 않는다.
   *   ⚠ repo-staleness 는 지금 잔재 정리를 `stash drop` 한 줄로 처방한다 — 그 줄은 여기서 막히므로
   *     그쪽 문구에 「못 박고 나서」가 붙어야 두 층이 다시 한 말을 한다(그 파일은 남이 편집 중이라
   *     안 건드렸다 · 조율은 커밋 메시지로 · `local_2909a862` 의 교차 회귀가 이 자리를 감시한다). */
  const 없애는조각 = 조각((v) => 없애기.test(v));
  if (없애는조각) {
    let 잔 = [];
    try {
      잔 = execFileSync('git', ['stash', 'list', '--format=%H %gd %gs'], { encoding: 'utf8', cwd: gitCwd })
        .split('\n').map((l) => /^([0-9a-f]{40}) (stash@\{\d+\}) (.*)$/.exec(l)).filter(Boolean)
        .map((m) => ({ sha: m[1], ref: m[2], 제목: m[3] }));
    } catch { /* 저장소 밖 — 가드가 판단할 자리가 아니다 */ }
    /* clear 는 전부, drop·branch 는 지목한 하나(생략하면 stash@{0}) */
    const 겨눈 = re('stash' + 끝 + '[^&|;]*?(stash@\\{\\d+\\})').exec(없애는조각);
    const 겨냥 = /\bclear\b/.test(없애는조각) ? 잔 : 잔.filter((s) => s.ref === (겨눈 ? 겨눈[1] : 'stash@{0}'));
    /* 🔴 stash **바깥** ref 만 센다 — `refs/stash` 는 정의상 stash@{0} 을 가리키므로 그걸 세면
     *   맨 위 조각이 **언제나 못 박힌 것**으로 읽혀 규칙이 통째로 안 돈다(실 저장소 탐침이 잡았다:
     *   픽스처는 초록인데 라이브는 무음 통과 — 새는 방향은 여기서도 통과였다).
     *   못 재면 「못 박혔다」가 아니라 「모른다」다 — 모름은 차단 쪽에 둔다. */
    const 못박힘 = (sha) => {
      try {
        return execFileSync('git', ['for-each-ref', '--points-at', sha, '--format=%(refname)',
          'refs/tags', 'refs/heads', 'refs/remotes'], { encoding: 'utf8', cwd: gitCwd }).trim().length > 0;
      } catch { return false; }
    };
    const 잃을것 = 겨냥.filter((s) => !못박힘(s.sha)).slice(0, 12);
    if (잃을것.length) {
      const 첫 = 잃을것[0].ref;
      deny('[git-scope-guard] stash 를 **지우는** 명령 차단 — 이 조각을 가리키는 ref 가 하나도 없다(지우면 복구 경로 0).'
        + '\n이 트리는 세션 여럿이 공유하고, 여기 쌓인 것은 대개 **남의 rebase 가 걷어간 autostash 잔재**다'
        + '\n(F208 실물: 7파일이 갇힌 채 주인은 그게 어디 있는지도 모른다). ③ `git clean` 과 같은 자리다.'
        + '\n\n지울 뻔한 것:\n  ' + 잃을것.map((s) => `${s.ref}  ${s.제목}`).join('\n  ')
        + `\n\n→ 무엇이 들었나:  git stash show --stat ${첫}`
        + `\n   내 것만 꺼낸다: git checkout ${첫} -- 경로A 경로B   (지우지 않고 그 파일만 가져온다)`
        + `\n→ **정리가 맞다면 못 박고 나서 지운다** — 그러면 같은 명령이 그대로 통과한다:`
        + `\n     git tag 보관/autostash-0 ${첫}   그 뒤 원래 명령을 다시`
        + '\n   (태그가 그 커밋을 가리키면 stash 를 비워도 내용은 이력에 남는다)'
        + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.');
    }
  }

  /* ⑦-b 쏟기 — pop·apply 는 공유 트리에 **쓴다**. 깨끗하면 정당한 복구라 조용히 지나간다. */
  if (조각((v) => 쏟기.test(v))) {
    const 더러운 = 미커밋().slice(0, 12);
    if (더러운.length) {
      deny('[git-scope-guard] `git stash pop`·`apply` 차단 — 지금 트리에 **미커밋 수정**이 있다.'
        + '\n이건 ⑦이 막는 것의 역방향이다: 담는 대신 쏟는다. 겹치면 merge 가 돌고, 충돌하면'
        + '\n**남의 파일에 충돌 표시가 박힌다**(pop 은 그 상태로 stash 를 남기고 멈춘다).'
        + '\nrepo-staleness 훅도 같은 말을 한다 — 「pop 은 대조 전 금지」. 이 층이 그걸 센다.'
        + '\n\n지금 트리의 미커밋 수정:\n  ' + 더러운.join('\n  ')
        + '\n\n→ 먼저 대조한다:    git stash show -p stash@{0}'
        + '\n   내 조각만 살린다: git checkout stash@{0} -- 경로A 경로B  (트리 전체에 쏟지 않는다)'
        + '\n   의도적 예외라면 명령 앞에 GIT_SCOPE_BYPASS=1 을 붙인다.');
    }
  }

  /* ⑦-a 쓸어담기 (원래 규칙) — bare `git stash` · `-u` · `push` · `save` */
  const 문제세그 = 조각((v) => !조회.test(v) && !쏟기.test(v) && !없애기.test(v));
  if (문제세그) {
    const 더러운 = 미커밋().slice(0, 12);
    const 경로지정 = /stash\b[^&|;]*?\s--\s+\S/.test(문제세그);
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

/* ⚰ 죽은 규칙 둘을 여기서 걷었다 — 2026-08-26 유호님 확정(판정 재료 = 트랙 §2 ④).
 *
 * 무엇이었나: **⑧「범위 안의 내용」**과 **「되돌림」**(파일이 ⑨/⑦ 두 번호로 부르던 그것).
 * 둘 다 "이 파일을 다른 세션도 만졌는가"를 `tools/작업본소유자.js` 에 물었다. 2026-08-19
 * 유호님 지시로 발화를 껐고(그 아래 487줄은 그날부터 `process.exit(0)` 뒤의 시체였다),
 * 하루 뒤 08-20 보드 층 철거(`39019553`)가 그 정본 파일 자체를 지웠다 —
 * 즉 되살려도 `require` 가 늘 실패해 **모든 커밋에서** 「전부 모름」으로 발화한다(F103).
 *
 * 🔴 **그 규칙이 막던 위험은 아직 산다** — `git commit -- 경로` 는 «인덱스»로부터는 지켜 주지만
 *   «파일 안»으로부터는 안 지켜 준다. 경로를 못 박아도 커밋되는 건 그 파일의 작업본 현재
 *   상태라, 같은 파일에 남이 편집해 둔 줄이 있으면 통째로 실린다(실사고 4: F073·F104·
 *   `d64ad85`·`b489f2e`·`6711ff2`). `git diff --stat` 은 이름만 세서 원리상 못 본다.
 * 🔑 그래서 처방은 «가드 재건»이 아니다 — **워크트리**(세션마다 제 작업 트리)가 이 위험을
 *   탐지가 아니라 소멸시킨다. 이 저장소엔 그 지원이 이미 있다(`lib/worktrees.js`) —
 *   지금은 쓰는 세션이 소수일 뿐이다. 판정·실측은 트랙 §2 ④ 가 진다.
 * ⚠ 그때까지의 손 규율: 커밋 전 `git diff -- <경로>` 를 **펼쳐** 본다(`--stat` 은 안 된다).
 *
 * 원문 487줄은 지우되 잃지 않는다 — `git show f0d289c3:.claude/hooks/git-scope-guard.js`.
 *
 * 남은 규칙: ①add -A ②commit -a ③clean ④진행중 커밋 ⑤되감기 ⑥메시지 셸 인용 ⑦stash ⑩--no-verify.
 * 전부 로컬 git 상태만 보고, 네트워크를 안 거치고, F015·F013·F014·F025 실사고를 실제로 막았다. */
process.exit(0);
