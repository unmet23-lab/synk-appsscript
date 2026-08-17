/* 인계문 생성기가 **미머지 가지의 보드 선언**을 보는가 (F529 · F521 의 세 번째 소비자).
 *
 * 이 검사가 지키는 것: **「트랙 없이 끝난 세션이다 — 다시 열 필요 없다」가 거짓으로 안 나가게.**
 * 2026-08-17 실측 — 세션 `24ba4d6b` 는 10:04 에 워크트리 가지 안에서 선언하고, 10:26 에 수리를
 * 착지시키고, PR #24 를 **열어 둔 채** 마감했다. 4분 뒤 쓰인 그 인계문은 「▶ 트랙 없이 끝난
 * 세션이다 — 추정이 아니라 실측이다 … 보드를 다시 열 필요 없다」로 나갔다.
 *
 * 🔑 이 얼굴이 F521(대기열)·F528(board-guard) 보다 위험한 이유: 인계문은 **다음 세션의 첫 입력**
 *   이라, 「다시 열 필요 없다」가 확인 자체를 금지한다 — 못 보는 것을 넘어 **안 보게** 만든다.
 *   F403(워크트리 갇힘) 실사고의 재현 조건이 그대로 갖춰진 자리다.
 *
 * 탐지력은 **픽스처가 진다** — 가지 훑기는 주입구(`{가지:{출력}}`)로 넣고 git 을 안 부른다
 * (F296: repo 밖 환경에 기대는 검사는 CI 에서 깨진다). 실저장소는 여기서 안 본다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const 보드 = require(path.join(ROOT, 'tools', 'lib', '보드.js'));
const report = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'session-report.js'));

/** `git log --source -p -U0` 출력을 **진짜 모양으로** 짓는다 — 손으로 베낀 모양을 재면
 *  파서가 실제로 만나는 글자는 한 번도 검사되지 않는다(`tests/보드가지.test.js` 와 같은 통로). */
const 커밋 = (가지, 파일, ...줄들) => [
  `${보드.커밋표식}${가지}`,
  `diff --git a/docs/_ops/보드/${파일} b/docs/_ops/보드/${파일}`,
  'new file mode 100644',
  'index 0000000..1111111',
  '--- /dev/null',
  `+++ b/docs/_ops/보드/${파일}`,
  '@@ -0,0 +1,3 @@',
  ...줄들.map((l) => `+${l}`),
].join('\n');

const 표줄 = (트랙, 파일칸 = '`tools/x.js`', 상태 = '▶착수') =>
  `| 2026-08-17 | **${트랙}** | ${파일칸} | ${상태} |`;

const 지문 = '24ba4d6b';
const SID = `local_${지문}-1111-2222-3333-444444444444`;

/* 🔴 **환경을 못박는다** — `hostSessionId` 는 `CLAUDE_CODE_HOST_SESSION_ID` 를 fallback 보다
 *   먼저 본다. 안 박으면 이 검사는 **돌리는 세션의 지문**으로 돌아서, 로컬에선 빨갛고 CI(변수 없음)
 *   에선 초록인 «환경 의존» 검사가 된다(F296). 첫 판이 정확히 그 모양으로 실패해서 잡았다. */
process.env.CLAUDE_CODE_HOST_SESSION_ID = SID;

/** 보드 폴더가 **읽히되 비어 있는** 뿌리 — 「못 읽음(null)」과 「없음([])」을 가르는 재료.
 *  ⚠ git 저장소가 **아니다** — 그래서 「훑을 가지가 원리상 0개」인 쪽이다. */
function 빈뿌리() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'f529-'));
  fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
  return d;
}

/** 같은 뿌리인데 **저장소이기는 하다**(`.git` 이 있다) — 여기서 훑기가 실패하면 그건 「모름」이다. */
function 빈저장소() {
  const d = 빈뿌리();
  fs.mkdirSync(path.join(d, '.git'));
  return d;
}

/* ── 탐지력 — 픽스처가 진다 ───────────────────────────────────────────────── */

test('🔴 탐지력 — 가지 안에만 있는 내 선언을 찾는다 (옛 판은 메인만 읽어 못 찾았다)', () => {
  const 뿌리 = 빈뿌리();
  const 출력 = 커밋('worktree-board-rows-denominator', `${지문}.md`, 표줄('상한 분모 수리'));
  const t = report.boardTrack(뿌리, [], SID, { 가지: { 출력 } });
  assert.ok(t, '가지 안 선언을 못 찾았다 — F529 가 신고한 그 자리다');
  assert.match(t.track, /상한 분모 수리/);
});

test('🔴 거짓 단정 금지 — 가지를 **못 훑으면** 「트랙 없이 끝난 세션이다」를 안 쓴다', () => {
  const 뿌리 = 빈저장소();
  // 실행이 null 을 돌려주면 `가지줄들` 은 `{줄들:[], 모름:true}` — 「없다」가 아니라 「못 봤다」다.
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 실행: () => null } });
  assert.ok(!글.includes('트랙 없이 끝난 세션이다'),
    '못 훑은 것을 「없다는 것이 실측이다」로 번역했다 (F529)');
  assert.ok(!글.includes('보드를 다시 열 필요 없다'),
    '확인을 금지하는 문장이 모름 위에 나갔다 — 못 보는 것을 넘어 안 보게 만든다');
  assert.match(글, /미머지 가지를 못 훑었다/);
  assert.match(글, /git worktree list/, '모름만 적으면 읽는 세션이 「없다」로 반올림한다 — 처방을 함께 준다');
});

test('음성(과교정 금지) — 가지까지 훑었고 정말 없으면 그 단정은 그대로 나간다', () => {
  const 뿌리 = 빈뿌리();
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 출력: '' } });
  assert.ok(글.includes('트랙 없이 끝난 세션이다'),
    '고치면서 참인 단정까지 죽였다 — 그러면 다음 세션이 없는 줄을 매번 뒤진다(F170)');
  assert.match(글, /미머지 가지의 선언까지 훑었다/, '분모를 밝혀야 「쟀다」와 「안 쟀다」가 갈린다(F207)');
});

/* 🔴 과교정을 막는 두 번째 축 — 「훑기 실패」와 「훑을 가지가 없다」는 다르다.
 *   첫 판이 이 구분 없이 갔더니 `tests/트랙경계.test.js` 의 F170·F332 가 빨개졌다: 그 픽스처들은
 *   임시 폴더(저장소 아님)에서 buildHandoff 를 부르는데, git 이 안 도는 것을 「모름」으로 읽어
 *   **참인 단정까지 죽였다.** 저장소가 아니면 가지는 원리상 0개다 — 못 잰 게 아니라 잴 것이 없다. */
test('🔴 저장소가 아닌 뿌리에선 「모름」이 아니다 — 참인 단정을 죽이지 않는다', () => {
  const 뿌리 = 빈뿌리();   // `.git` 없음
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 실행: () => null } });
  assert.ok(글.includes('트랙 없이 끝난 세션이다'),
    '저장소가 아닌 곳에서 「못 훑었다」로 내렸다 — 잴 것이 없는 것과 못 잰 것을 뭉갰다');
});

test('가지 선언이 있으면 그 트랙이 인계문 본문에 실린다 (찾고도 안 싣는 자리가 없게)', () => {
  const 뿌리 = 빈뿌리();
  const 출력 = 커밋('worktree-q100', `${지문}.md`, 표줄('#Q100 수집 표식 범위 판정'));
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 출력 } });
  assert.match(글, /#Q100 수집 표식 범위 판정/);
  assert.ok(!글.includes('트랙 없이 끝난 세션이다'));
});

/* ── 계약 — 「못 읽음」과 「없음」을 안 접는다 ─────────────────────────────── */

test('메인을 못 읽어도 가지 줄이 손에 있으면 「못 읽음」이 아니다', () => {
  const 없는뿌리 = path.join(os.tmpdir(), 'f529-없는뿌리-' + process.pid);
  const 출력 = 커밋('worktree-x', `${지문}.md`, 표줄('가지에만 있는 트랙'));
  const rows = report.보드줄전량(없는뿌리, { 가지: { 출력 } });
  assert.ok(Array.isArray(rows) && rows.length === 1, '재료가 손에 있는데 null 로 접었다');
});

test('메인도 가지도 못 읽으면 null — 「줄이 없다」와 안 접는다', () => {
  const 없는뿌리 = path.join(os.tmpdir(), 'f529-없는뿌리2-' + process.pid);
  assert.strictEqual(report.보드줄전량(없는뿌리, { 가지: { 실행: () => null } }), null);
});
