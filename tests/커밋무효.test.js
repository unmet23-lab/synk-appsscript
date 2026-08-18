/* commit-noop-guard 회귀 — 「커밋했다고 믿었는데 아무것도 안 들어간」 경우를 잡는가.
 *
 * 왜 있나 (F071 · 2026-08-04): 직전 세션이 남긴 미커밋 8건을 **두 세션이 동시에 이어받았고**,
 *   상대가 1분 먼저 같은 파일을 커밋한 탓에 내 `git commit -F msg -- 경로들` 이
 *   「nothing to commit」 상태 목록만 뱉고 **성공처럼 조용히 지나갔다.**
 *   git 은 이걸 오류로 부르지 않는다 — 그래서 결과를 검사하는 층이 필요했다.
 *
 * 검사 방식 — 이 훅은 git 을 부르지 않는다(입력 JSON → 출력 JSON 이 전부).
 *   그래서 픽스처는 **훅이 받는 payload 그 자체**이고, 실저장소도 CI 도 필요 없다.
 *   payload 모양은 실측으로 확정했다(PostToolUse 탐침: tool_input.command + tool_response.stdout).
 *
 * 🔴 이 훅의 최우선 불변식은 「막지 않는다」다 — 도구는 이미 실행됐고, no-op 자체는 손상이 아니다.
 *   위험한 건 그걸 「커밋했다」고 보고하는 것이다. **모든 경로에서** permissionDecision 부재를 검사한다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { 훅띄우기 } = require('./lib/훅띄우기');

const HOOK = process.env.SYNK_TEST_NOOP_HOOK
  || path.resolve(__dirname, '..', '.claude', 'hooks', 'commit-noop-guard.js');

/** 훅을 돌리고 {경고냐, 본문} 을 준다. */
function run({ tool = 'Bash', command, stdout = '', stderr = '', response }) {
  const payload = {
    hook_event_name: 'PostToolUse',
    tool_name: tool,
    tool_input: { command },
    tool_response: response !== undefined ? response : { stdout, stderr },
  };
  // 결과 검사 훅이 작업을 세우면 안 된다 — 0 아닌 종료도, 안 뜬 것도 통로가 드러낸다.
  const r = 훅띄우기(HOOK, { input: JSON.stringify(payload), encoding: 'utf8' });
  const out = String(r.stdout || '').trim();
  if (!out) return { 경고: false, 본문: '', raw: '' };
  const j = JSON.parse(out);
  // 불변식: 절대 차단하지 않는다.
  assert.ok(!j.hookSpecificOutput || !('permissionDecision' in j.hookSpecificOutput),
    'PostToolUse 훅이 permissionDecision 을 냈다 — 이 훅은 알리기만 해야 한다');
  return { 경고: true, 본문: String(j.hookSpecificOutput?.additionalContext || ''), raw: out };
}

// ───────────────────────── 탐지 ─────────────────────────

test('같은 내용을 남이 먼저 커밋해 비어버린 커밋을 잡는다 (F071 실사고 재현)', () => {
  const v = run({
    command: 'git commit -F msg.txt -- "docs/발표물/01_설명회_덱_16x9.html" tools/발표물린트.js',
    stdout: 'Changes not staged for commit:\n\tmodified:   .claude/settings.json\n\nno changes added to commit (use "git add" and/or "git commit -a")',
  });
  assert.ok(v.경고, '실사고 그대로의 출력을 통과시켰다 — 이걸 놓치면 「커밋했다」가 거짓 보고가 된다');
  assert.match(v.본문, /F071/);
  assert.match(v.본문, /Session-Id/, '주인 확인 절차를 안내하지 않았다');
  // 🔑 「주인이 나인지 봐라」만으로는 부족하다 — **내 id 가 무엇인지**를 같이 줘야 한다.
  //   스크래치패드·트랜스크립트 경로의 UUID 는 다른 식별자다. 실측 1회: 둘을 대조해
  //   **내 커밋을 남의 것으로 뒤집을 뻔했다.**
  //   ⚠ 환경변수 «이름»을 검사하지 않는다(F633) — 트레일러의 출처가 HOST 하나가 아니게 됐고
  //     (클라우드는 REMOTE), 이름을 박아 두면 안내가 옳게 바뀌어도 여기가 빨개진다.
  //     계약은 「**그 값 자체**를 화면에 준다」이므로 그것을 잰다.
  assert.match(v.본문, /지금 이 세션 = \S/,
    '내 세션 id 가 무엇인지 안 알려줬다 — 다른 식별자로 대조하면 판정이 뒤집힌다');
});

test('🔑 안내에 지금 세션의 실제 id 를 박아 준다 (사람이 다시 찾게 만들지 않는다)', () => {
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_TESTID-1234';
  try {
    const v = run({ command: 'git commit -m "x" -- a.js', stdout: 'nothing to commit, working tree clean' });
    assert.match(v.본문, /local_TESTID-1234/, '환경의 세션 id 를 안내에 안 실었다');
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

test('작업 트리가 깨끗해 아무것도 안 들어간 경우를 잡는다', () => {
  const v = run({
    command: 'git commit -m "docs: 보드 갱신" -- docs/세션보드.md',
    stdout: 'On branch master\nnothing to commit, working tree clean',
  });
  assert.ok(v.경고, '「nothing to commit」 을 통과시켰다');
});

test('경로가 git 이 아는 파일과 안 맞은 경우를 잡는다 — 미추적 새 파일의 전형', () => {
  const v = run({
    command: 'git commit -m "feat: 새 훅" -- .claude/hooks/새훅.js',
    stderr: "error: pathspec '.claude/hooks/새훅.js' did not match any file(s) known to git",
  });
  assert.ok(v.경고, 'pathspec 오류를 통과시켰다 — 미추적은 이력 어디에도 없는 무보호 상태다(F025)');
  assert.match(v.본문, /git add/, '새 파일 처방(add 가 먼저)을 안 줬다');
});

test('🔑 git 전역 옵션이 껴 있어도 잡는다 — 앵커를 `git commit` 붙어 있기에 걸면 샌다', () => {
  const v = run({
    command: 'git -c user.name=t -c commit.gpgsign=false commit -m "x" -- a.js',
    stdout: 'nothing to commit, working tree clean',
  });
  assert.ok(v.경고, '`git -c … commit` 형태를 놓쳤다 — 테스트·CI 가 흔히 쓰는 형태다');
});

test('tool_response 가 객체가 아니라 문자열로 와도 잡는다', () => {
  const v = run({ command: 'git commit -m "x" -- a.js', response: 'nothing to commit, working tree clean' });
  assert.ok(v.경고, 'payload 모양 하나에만 맞춰 두면 하네스가 바뀌는 날 조용히 눈이 먼다');
});

/* 🔑 F113 의 반대 방향 — 거짓양성을 없애다 탐지력까지 없애면 안 된다.
 * 커밋이 둘인데 하나만 착지한 경우는 여전히 잡아야 한다(그게 원래 F071 이 노린 자리다). */
test('🔑 커밋이 둘인데 하나만 착지하면 잡는다 (체인 판정이 탐지력을 안 깎았는지)', () => {
  const v = run({
    command: 'git commit -m "a" -- a.js && git commit -m "b" -- b.js',
    stdout: '[master abc1234] a\n 1 file changed, 2 insertions(+)\nOn branch master\nnothing to commit, working tree clean',
  });
  assert.ok(v.경고, '둘 중 하나만 들어갔는데 조용했다 — 착지 수로 판정하면서 이 자리를 잃으면 F071 이 되살아난다');
  assert.match(v.본문, /2개 중 \*\*1개만 착지\*\*/, '몇 개가 들어갔는지 안 알려주면 사람이 다시 세야 한다');
});

// ─────────────────── 거짓양성 (벌주면 안 된다) ───────────────────

/* 🔑 F113 (2026-08-05 실사고) — 한 명령줄 안의 `git status` 출력을 커밋 결과로 읽었다.
 *   `git status; git add -- x; git commit -F msg -- x` 에서 status 가 「no changes added to commit」 을
 *   찍고, 커밋은 **실제로 착지했다**(SYNK-talk b74be75 · 1 file changed). 그런데 가드가 짖었다.
 *   가드가 실작업을 벌주면 사람은 가드를 끈다 — 그게 F049·F103 이 남긴 교훈이다. */
test('🔑 체인 앞의 `git status` 가 낸 문구를 커밋 결과로 읽지 않는다 (F113 실사고 재현)', () => {
  const v = run({
    command: 'git status; git add -- docs/L0_데이터계약.md; git commit -F msg.txt -- docs/L0_데이터계약.md',
    stdout: [
      'On branch master',
      'Changes not staged for commit:',
      '\tmodified:   docs/L0_데이터계약.md',
      'no changes added to commit (use "git add" and/or "git commit -a")',
      '[master b74be75] docs: L0 확장',
      ' 1 file changed, 12 insertions(+)',
    ].join('\n'),
  });
  assert.ok(!v.경고,
    `커밋이 착지했는데 no-op 이라고 짖었다 — 앞단 status 의 출력을 커밋 것으로 읽은 F113 그대로다:\n${v.본문}`);
});

test('🔑 커밋 제목에 그 문구가 들어간 **성공한** 커밋을 벌주지 않는다', () => {
  // git 은 성공하면 제목을 되뱉는다. 이 저장소는 커밋 제목에 가드 이야기를 자주 쓴다 —
  // 원문에서 문구를 찾으면 자기 언급에 걸려 성공한 커밋이 빨개진다.
  const v = run({
    command: 'git commit -F msg.txt -- .claude/hooks/commit-noop-guard.js',
    stdout: '[master 6c76663] feat: nothing to commit 을 잡는 훅\n 2 files changed, 120 insertions(+)',
  });
  assert.ok(!v.경고, `성공한 커밋을 경고했다 — 가드가 실작업을 벌주면 사람이 가드를 끈다:\n${v.본문}`);
});

test('--dry-run 은 안 들어가는 게 정상이다 — 벌주지 않는다', () => {
  const v = run({ command: 'git commit --dry-run -- docs/x.md', stdout: 'nothing to commit, working tree clean' });
  assert.ok(!v.경고, 'dry-run 을 경고했다 — 확인 용법을 막으면 BYPASS 를 습관으로 가르친다');
});

test('🔑 문서를 검색하다 그 문구를 본 것을 커밋으로 오인하지 않는다', () => {
  // F049 실측 계열: clasp-guard 가 `grep "clasp pull"` 을 막아 검색 자체가 차단됐다.
  const v = run({
    command: 'grep -n "git commit 이 nothing to commit 을 뱉으면" CLAUDE.md',
    stdout: '65:  · git commit 이 nothing to commit 을 뱉으면 …',
  });
  assert.ok(!v.경고, '인용된 산문을 실행으로 읽었다 — 문서화·검색을 벌하는 가드가 된다');
});

/* F230 (08-08 실측) — 경로 인자 속 `commit` 이 커밋으로 읽혔다. `\b` 는 하이픈·마침표를
 * 단어 경계로 보므로 `auto-commit.js` 가 통째로 걸린다. 이 저장소는 그 이름을 실제로 쓰고,
 * 같은 호출에 `git status` 가 끼면 증상 문구까지 채워져 **커밋을 안 한 턴이 벌을 받았다.**
 * 짝으로 잰다 — 거짓양성만 고치고 탐지력은 그대로여야 한다(고친 김에 무디게 만들면 못 알아챈다). */
test('🔑 경로 속 commit 을 커밋으로 읽지 않는다 (F230 실사고 재현)', () => {
  const v = run({
    command: 'git status && git diff --stat -- .claude/hooks/auto-commit.js',
    stdout: 'Changes not staged for commit:\n\tmodified:   .claude/hooks/auto-commit.js\n\n'
      + 'no changes added to commit (use "git add" and/or "git commit -a")',
  });
  assert.ok(!v.경고, `커밋을 안 한 명령을 벌줬다 — 실작업을 벌주면 사람이 가드를 끈다: ${v.본문}`);

  // 앞뒤 두 방향을 다 잰다 — 훅 디렉터리에서 부르면 경로가 맨 이름으로 온다(앞이 공백).
  const 맨이름 = run({
    command: 'git status && git add -- commit-noop-guard.js',
    stdout: 'no changes added to commit (use "git add" and/or "git commit -a")',
  });
  assert.ok(!맨이름.경고, `앞이 공백인 경로도 커밋으로 읽었다: ${맨이름.본문}`);

  // 토큰 **끝**이 commit 인 경로 — 뒤쪽 lookahead 는 통과하고 앞쪽만 걸러낸다(git 자체 훅 이름).
  const 끝이commit = run({
    command: 'git add -- .git/hooks/pre-commit',
    stdout: 'no changes added to commit (use "git add" and/or "git commit -a")',
  });
  assert.ok(!끝이commit.경고, `토큰 끝이 commit 인 경로를 커밋으로 읽었다: ${끝이commit.본문}`);
});

test('🔑 착지한 커밋 뒤에 경로로 commit 을 든 조회가 붙어도 벌주지 않는다 (커밋 수를 부풀리던 자리)', () => {
  const v = run({
    // F113 의 그 형태(앞단 status)에 경로 인자가 붙은 것 — 08-08 에 실제로 돌린 명령의 모양이다.
    command: 'git status && git commit -m "고침" -- a.js && git diff --stat -- .claude/hooks/auto-commit.js',
    stdout: 'Changes not staged for commit:\n\tmodified:   b.js\n\n'
      + 'no changes added to commit (use "git add" and/or "git commit -a")\n'
      + '[master abc1234] 고침\n 1 file changed, 2 insertions(+)',
  });
  assert.ok(!v.경고, `착지 1건에 커밋 1건인데 벌줬다 — 뒤따르는 조회가 커밋 수로 세어졌다: ${v.본문}`);
});

test('🔴 그 경로를 **진짜 커밋**할 때는 그대로 잡는다 (위 수리가 탐지력을 깎지 않았나)', () => {
  const v = run({
    command: 'git commit -m "고침" -- .claude/hooks/auto-commit.js',
    stdout: 'On branch master\nnothing to commit, working tree clean',
  });
  assert.ok(v.경고, '같은 경로를 든 진짜 커밋의 no-op 을 놓쳤다 — 거짓양성을 고치며 탐지력을 깎았다');
});

test('커밋이 아예 없는 명령은 건드리지 않는다', () => {
  const v = run({ command: 'git status --short', stdout: ' M docs/세션보드.md' });
  assert.ok(!v.경고, 'commit 이 없는데 발화했다');
});

test('성공한 평범한 커밋은 조용하다 (거짓양성 0)', () => {
  const v = run({
    command: 'git commit -m "docs: 보드" -- docs/세션보드.md',
    stdout: '[master abc1234] docs: 보드\n 1 file changed, 1 insertion(+)',
  });
  assert.ok(!v.경고, '정상 커밋에 발화했다');
});

test('Bash·PowerShell 밖의 도구는 무시한다', () => {
  const v = run({ tool: 'Edit', command: 'git commit -m "x"', stdout: 'nothing to commit' });
  assert.ok(!v.경고, '매처 밖 도구에 발화했다');
});

// ─────────────────── 등록층 (훅이 정확해도 안 불리면 통과다) ───────────────────

test('🔴 settings.json 에 PostToolUse 로 등록돼 있고, 라우팅이 훅보다 넓다', () => {
  const fs = require('node:fs');
  const p = path.resolve(__dirname, '..', '.claude', 'settings.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const groups = j.hooks?.PostToolUse || [];
  assert.ok(groups.length, 'PostToolUse 등록이 아예 없다 — 훅 파일만 있고 안 불린다(F044·F053 계열)');

  const mine = groups.filter((g) => (g.hooks || []).some((h) => String(h.command || '').includes('commit-noop-guard.js')));
  assert.ok(mine.length, 'commit-noop-guard 가 등록돼 있지 않다');

  for (const g of mine) {
    // 훅은 Bash·PowerShell 을 본다. 매처가 그보다 좁으면 그 자체가 구멍이다.
    assert.match(g.matcher || '', /Bash/, '매처가 Bash 를 안 넘긴다');
    assert.match(g.matcher || '', /PowerShell/, '매처가 PowerShell 을 안 넘긴다 — 훅은 보는데 라우팅이 좁다');
    // 앞단 case 필터도 훅보다 좁으면 안 된다. 훅의 앵커는 `git`.
    const cmd = (g.hooks || []).map((h) => h.command || '').join('\n');
    const 필터 = cmd.match(/case\s+"\$IN"\s+in\s+([^)]+)\)/);
    if (필터) {
      assert.match(필터[1], /\*git\*/,
        `앞단 필터가 훅보다 좁다 — 훅은 \`git … commit\` 을 보는데 필터는 ${필터[1]} 만 넘긴다(F063 형태)`);
    }
  }
});

test('실행 불가를 조용한 통과로 만들지 않는다 — 등록 명령이 실패를 드러낸다', () => {
  const fs = require('node:fs');
  const p = path.resolve(__dirname, '..', '.claude', 'settings.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cmd = (j.hooks?.PostToolUse || [])
    .flatMap((g) => g.hooks || []).map((h) => h.command || '')
    .filter((c) => c.includes('commit-noop-guard.js')).join('\n');
  assert.match(cmd, /CLAUDE_PROJECT_DIR/, '경로가 로컬 절대경로면 다른 기계에서 통째로 죽는다(F044)');
  assert.match(cmd, /미실행/, 'node·훅 파일이 없을 때 조용히 지나간다 — 실행 불가는 드러나야 한다');
});
