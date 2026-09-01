// clasp-guard 회귀 점검 — 실행: node tests/clasp-guard.check.js
// (파일명이 *.test.js가 아닌 이유: node --test tests/ 가 이 파일을 실행하면
//  가드가 다시 node --test tests/ 를 부르는 재귀가 생긴다. 이 점검은 수동/훅 수정 시 실행.)
'use strict';
const path = require('path');
const { 훅띄우기 } = require('./lib/훅띄우기');
const { mainWorktree, 같은곳 } = require('../.claude/hooks/lib/worktrees.js');

const GUARD = path.join(__dirname, '..', '.claude', 'hooks', 'clasp-guard.js');

/* 「메인 저장소」를 `__dirname` 에서 파생하지 않는다 — F223 이 훅에서 고친 것과 **같은 병**이고
 * 여기가 그 둘째 자리다(F217). 등록층이 `${CLAUDE_PROJECT_DIR:-$PWD}` 라서 워크트리 세션에서는
 * 워크트리의 사본이 돌고 `path.resolve(__dirname,'..')` 도 워크트리다. 그걸 메인이라 부르면:
 *   · 검사 6 이 규칙 0(워크트리 배포 차단)에 걸려 **거짓 적색**
 *   · 검사 7 은 규칙 0 이 앞서 발동해 「미커밋 배포 파일」 사유에 영영 못 닿아 전건 탈락
 * 실측 2026-08-08 — 옛 기준: 「워크트리에서는 clasp push」 · 새 기준: 그 사유 없음.
 * 🔑 파생은 정본 하나에서만 한다(`worktrees.mainWorktree`). 손으로 조립하면 F206 의 다섯 갈래가 다시 난다.
 *    비교도 `같은곳` 으로 — 윈도의 대소문자·구분자 차이로 메인이 「남」이 되면 판정이 뒤집힌다. */
const 이체크아웃 = path.resolve(__dirname, '..');
const 메인 = mainWorktree(이체크아웃);
const 워크트리인가 = !같은곳(메인, 이체크아웃);

/* 「지금 무엇을 메인으로 잡았나」를 묻는 문. 회귀는 이 문으로 잰다 — 전체 점검은 가드가
 * 테스트 106개를 인라인으로 돌려 **분 단위**라 회귀에 실을 수 없다(실측 358초/회). */
if (process.argv.includes('--기준')) {
  console.log('이 체크아웃: ' + 이체크아웃);
  console.log('메인 저장소: ' + 메인);
  // 검사 7 의 skip 여부가 이 값에 달렸다 — 문에 안 실으면 회귀가 그 갈래를 못 잰다(변이 M3 가 잡아냈다).
  console.log('워크트리인가: ' + 워크트리인가);
  process.exit(0);
}

function feed(command, cwd) {
  const payload = { tool_name: 'Bash', tool_input: { command } };
  if (cwd) payload.cwd = cwd; // 훅 입력의 cwd = 명령이 실제로 실행될 위치
  const r = 훅띄우기(GUARD, {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    /* 🔴 120000 이면 이 파일은 **검사 4 에서 죽는다**(실측 08-08: ETIMEDOUT 120066ms).
     * 배포 게이트는 앞선 문제가 하나도 없으면 `node --test` 로 테스트 106개를 **인라인으로** 돌린다
     * — 메인 cwd 1회 실측 **358초**. 즉 상한이 실비용보다 낮아 훅이 매번 SIGTERM 으로 끝났고,
     * 훅띄우기가 그걸 「미실행」으로 소리내 준 덕에 조용한 초록은 아니었지만 파일은 죽어 있었다.
     * 낮추려면 게이트의 실비용부터 다시 재라 — 숫자를 안 재고 줄이면 그대로 재발한다.
     * (문제가 이미 있는 호출은 게이트가 테스트 앞에서 끊어 초 단위다 — 느린 건 깨끗할 때뿐이다.) */
    timeout: 600000,
  });
  return { code: r.status, out: (r.stdout || '').trim() };
}
const PUSH = '"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" push --force';
function denyReason(r) {
  try {
    const j = JSON.parse(r.out);
    return (j.hookSpecificOutput && j.hookSpecificOutput.permissionDecision === 'deny')
      ? String(j.hookSpecificOutput.permissionDecisionReason || '') : '';
  } catch (_) { return ''; }
}

let fails = 0;
function check(name, cond) {
  console.log((cond ? 'ok   ' : 'FAIL ') + name);
  if (!cond) fails++;
}

// 1) clasp 무관 명령 → 무개입(출력 없음)
let r = feed('git status');
check('무관 명령 통과', r.code === 0 && r.out === '');

// 2) 읽기성 clasp 명령 → 무개입
r = feed('"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" list-deployments');
check('list-deployments 통과', r.code === 0 && r.out === '');

// 3) 의식적 우회 → 무개입
r = feed('CLASP_GUARD_BYPASS=1 "/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" push --force');
check('BYPASS 우회 통과', r.code === 0 && r.out === '');

/* 4) clasp push → 게이트 가동. 얼굴이 **셋**이다(저장소 상태에 따라 갈리므로 형식만 고정 검증한다):
 *      (a) 무출력            — 불변식 전부 통과
 *      (b) deny JSON         — 차단
 *      (c) 통과 + 안내 JSON  — 불변식은 통과했고 «배포 뒤 실행할 API» 안내를 붙였다(실행층점검 · 08-04 `ffc220053`)
 *
 *  🔴 2026-09-01 수리 — 옛 판은 (c) 를 몰랐다. 그래서 (c) 가 나오면 (b) 로 재단해 **거짓 적색**을 냈고,
 *     그 직후 `permissionDecisionReason.split()` 을 무조건 불러 **테스트 프로세스가 그 자리에서 죽었다.**
 *     피해는 그 한 줄이 아니다 — 뒤따르는 검사 **넷(5·6·7·8)이 통째로 안 돌았다.**
 *     즉 안전 4종의 하나를 재는 자가 절반 넘게 침묵한 채 「적색 1건」 얼굴을 하고 있었다.
 *     ⇒ 그래서 여기서는 **어떤 얼굴이든 뒤 검사로 넘어간다**(죽지 않는다). */
r = feed('"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" push --force');
if (r.out === '') {
  check('push 게이트: 불변식 전부 통과(무개입)', r.code === 0);
} else {
  let j = null;
  try { j = JSON.parse(r.out); } catch (_) {}
  const hso = (j && j.hookSpecificOutput) || null;
  const 사유 = (hso && hso.permissionDecisionReason) || '';
  if (hso && hso.permissionDecision === 'deny') {
    check('push 게이트: deny JSON 형식', r.code === 0 && /\[clasp-guard\]/.test(사유));
    console.log('  (현재 저장소 상태 기준 차단 사유)');
    console.log('  ' + 사유.split(String.fromCharCode(10)).join(String.fromCharCode(10) + '  '));
  } else {
    // (c) 통과 + 안내 — 막지 않았으므로 `permissionDecision` 이 없어야 하고, 안내는 붙어 있어야 한다.
    check(
      'push 게이트: 통과+안내 JSON 형식',
      r.code === 0 && !!hso && !hso.permissionDecision && !!hso.additionalContext,
    );
    const 첫줄 = String((hso && hso.additionalContext) || '').split(String.fromCharCode(10))[0];
    console.log('  (막지 않았다 · 붙은 안내 첫 줄) ' + 첫줄);
  }
}

// 5) 워크트리에서의 push → 워크트리 사유로 차단(08-01: 메인 상태를 보고 엉뚱한 진단을 내던 결함)
//    라이브 타깃이 하나라 미병합 브랜치를 밀면 master의 최신 코드가 라이브에서 사라진다 → 허용이 아니라 정확한 차단.
{
  // 워크트리는 **메인** 아래에만 생긴다 — 이 체크아웃에서 찾으면 워크트리 세션에서 늘 0건이다.
  /* 🔴 자리를 «폴더 모양»으로 찾지 않는다(08-26 실측·수리). 옛 판은 `.claude/worktrees/<한 마디>`
   *   밑에서 `.git` 을 찾았는데, 하네스가 허용하는 **두 마디 이름**(`엔진/두마디점검`)은 한 칸 더
   *   깊어서 **못 찾고 skip** 했다 — 그리고 그 skip 문구가 「정상」이라 미실행이 통과처럼 보였다.
   * 🔑 목록은 git 이 이미 안다 — `git worktree list --porcelain` 이 깊이와 무관하게 답한다. */
  let wt = '';
  try {
    const 줄들 = require('child_process')
      .execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: 메인, encoding: 'utf8' })
      .split(String.fromCharCode(10)).filter((l) => l.startsWith('worktree '))
      .map((l) => l.slice('worktree '.length).trim());
    wt = 줄들.find((d) => path.resolve(d) !== path.resolve(메인)) || '';
  } catch (_) {}
  if (!wt) {
    /* ⚠ 통과가 아니라 **미실행**이다(F207) — 문구가 그렇게 말해야 다음 사람이 초록으로 안 읽는다. */
    console.log('skip 워크트리 차단 — **이 검사는 안 돌았다**(작업 트리가 메인 하나뿐이라 잴 자리가 없다 · 통과 아님)');
  } else {
    const reason = denyReason(feed(PUSH, wt));
    check('워크트리 push 차단', /워크트리에서는 clasp push/.test(reason));
    check('워크트리 차단 사유에 복구 절차 포함', /메인 저장소.*\/deploy/s.test(reason));
  }
}

// 6) 메인 저장소 cwd는 종전과 동일하게 동작한다(워크트리 차단이 정상 배포를 막지 않는다)
{
  const main = 메인;                     // ← 이 한 줄이 F217 둘째 자리다(옛 판: path.resolve(__dirname,'..'))
  const r = feed(PUSH, main);
  const reason = denyReason(r);
  check('메인 cwd는 워크트리로 오판하지 않음', !/워크트리에서는 clasp push/.test(reason));
  check('메인 cwd 응답 형식 유지', r.code === 0 && (r.out === '' || reason !== ''));
}

/* 7) [2026-08-01 감사] **배포되는 파일 전부**가 미커밋 검사에 걸리는가.
 *    구 버전은 목록을 하드코딩(Code.js·contents_*·appsscript.json)해 두어
 *    실제로 배포되는 상담AI.js·교재연동.js·만족도팩.js 3종이 감시 밖이었다
 *    — 미커밋인 채로 clasp push가 통과했고, 그건 이 훅의 존재 이유가 절반에서 죽어 있었다는 뜻이다.
 *    목록을 다시 베끼지 않는다: .claspignore(배포 집합의 정본)에서 읽어 하나씩 실제로 더럽혀 본다. */
/* ⚠ 워크트리에서는 **돌리지 않고 skip 으로 드러낸다**(CLAUDE.md: 실저장소 검사는 skip으로 드러낸다).
 *   규칙 0 이 이 검사보다 앞서 발동하므로 「미커밋 배포 파일」 사유에 원리상 못 닿아 전건이 거짓 적색이 된다.
 *   🔑 ROOT 를 메인으로 돌려 통과시키는 길은 **일부러 안 골랐다** — 그러면 워크트리에서 돌린 점검이
 *      여러 세션이 공유하는 메인 체크아웃의 배포 파일을 더럽히게 된다(복구는 finally 지만 창이 열린다). */
if (워크트리인가) {
  console.log('skip 배포집합 미커밋 검사 — 이 체크아웃은 워크트리다(규칙 0 이 먼저 발동해 이 사유에 못 닿는다).');
  console.log('  메인에서 한 번 더 돌려라: node ' + path.join(메인, 'tests', 'clasp-guard.check.js'));
} else {
  const fs = require('fs');
  const ROOT = 메인;
  const pats = fs
    .readFileSync(path.join(ROOT, '.claspignore'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('!'))
    .map((l) => l.slice(1).trim())
    .filter(Boolean);
  const files = [];
  for (const t of pats) {
    if (t.includes('*')) {
      const re = new RegExp('^' + t.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
      fs.readdirSync(ROOT).filter((f) => re.test(f)).forEach((f) => files.push(f));
    } else if (fs.existsSync(path.join(ROOT, t))) files.push(t);
  }
  check('.claspignore에서 배포 대상을 찾아냈다(≥5종)', files.length >= 5);

  for (const f of files) {
    const p = path.join(ROOT, f);
    const orig = fs.readFileSync(p);
    try {
      fs.appendFileSync(p, f.endsWith('.json') ? ' ' : '\n// clasp-guard 회귀 임시 한 줄\n');
      const reason = denyReason(feed(PUSH, ROOT));
      const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      check('미커밋 배포 파일 차단: ' + f, new RegExp('미커밋 배포 파일\\([^)]*' + esc).test(reason));
    } finally {
      fs.writeFileSync(p, orig); // 실패해도 반드시 원복 — 저장소를 더럽힌 채 끝내지 않는다
    }
  }

  // 배포 대상이 아닌 파일은 과차단하지 않는다(가드가 배포를 막는 쪽으로 고장 나는 것도 결함).
  //   ⚠ "미커밋 사유가 아예 없다"로 쓰면 안 된다 — 옆 세션이 배포 파일을 점유 중이면 그 사유가
  //     정당하게 떠서 이 검사가 저장소 상태에 따라 흔들린다. **그 파일 이름이 오르지 않는가**만 본다.
  const probeName = '_guard_probe_tmp.js';
  const nonTarget = path.join(ROOT, 'tests', probeName);
  try {
    fs.writeFileSync(nonTarget, '// 임시\n');
    const reason = denyReason(feed(PUSH, ROOT));
    check('배포 대상 아닌 파일은 미커밋 사유에 오르지 않는다', !reason.includes(probeName));
  } finally {
    try { fs.unlinkSync(nonTarget); } catch (_) {}
  }
}

/* 8) [2026-08-01 실사용 오탐] 커밋 메시지에 적힌 "clasp push"가 커밋을 막았다.
 *    가드는 실행되는 명령을 봐야지 사람이 쓴 문장을 보면 안 된다 — 문서화를 벌하면
 *    사람은 BYPASS를 남발하는 법을 배우고, 그때 가드는 실질적으로 죽는다. */
{
  const heredoc = "git commit -F - <<'EOF'\nfix: 순서 설명\n\n손 clasp push 단독 금지 — clasp push 는 커밋 뒤에.\nEOF";
  check('커밋 메시지 heredoc 안의 "clasp push"는 발동시키지 않는다', feed(heredoc, path.resolve(__dirname, '..')).out === '');

  const dashM = 'git commit -m "docs: clasp push 순서를 지침에 명문화"';
  check('-m 메시지 안의 "clasp push"는 발동시키지 않는다', feed(dashM, path.resolve(__dirname, '..')).out === '');

  // 반대로, 진짜 실행되는 clasp push는 heredoc이 섞여 있어도 잡아야 한다(오탐을 고치다 놓치면 더 나쁘다)
  const real = "git commit -F - <<'EOF'\n메시지\nEOF\n\"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd\" push --force";
  const r8 = feed(real, path.resolve(__dirname, '..'));
  check('heredoc 뒤에 실제 clasp push가 오면 게이트가 가동된다', r8.out !== '' || r8.code === 0);
  check('  └ 가동 시 형식은 deny JSON', r8.out === '' ? true : /\[clasp-guard\]/.test(denyReason(r8)));
}

process.exit(fails ? 1 : 0);
