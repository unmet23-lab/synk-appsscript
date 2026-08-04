/**
 * 트랙 경계 인계 회귀 — track-boundary(PostToolUse) · 인계문 파일 · 보드 줄 승계 · 워크트리 키 합류
 *
 * 왜 있나 (2026-08-04 · 유호님 "전에 설정했는데 잘 안 됐다 · 새 세션에서 바로 이어갈 수 있게"):
 *   실측이 두 결함을 짚었다.
 *     🔴 ① **인계 바통이 워크트리에서 유실된다.** `.claude/worktrees/…` 세션의 바통이 다른 키로
 *        떨어져 메인 세션의 `take()` prefix 와 안 맞았다. 그때 살아있던 바통 3개 중 메인이 집을
 *        수 있는 것이 **0개**였고, 증상은 「조용히 아무 일도 안 일어남」이었다.
 *     🔴 ② **깨워도 안 끊겼다.** 300k 도달로 AI 를 깨운 뒤에도 `f6aa60e5` 는 760k 까지 갔다.
 *        도달을 아는 것과 **끊을 자리**를 아는 것은 다른 일이라, 커밋 착지 순간을 따로 짚는다.
 *   그리고 옛 인계문은 커밋 목록만 주고 「보드를 열어 네 줄을 찾아라」로 끝나, 인계에
 *   **주소만 있고 내용이 없었다** — 새 세션이 매번 보드를 되짚어야 했다.
 *
 * 탐지 능력은 **픽스처가 진다.** 실저장소에는 거짓양성만 묻는다(CLAUDE.md 가드 맹점 ②).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOKS = path.join(ROOT, '.claude', 'hooks');
const HOOK = path.join(HOOKS, 'track-boundary.js');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');

const report = require(path.join(HOOKS, 'lib', 'session-report.js'));

/** usage 한 줄 — 세 항목의 **합**이 컨텍스트다. */
function usageLine(total) {
  return JSON.stringify({ message: { model: 'claude-opus-5', usage: { input_tokens: 0, cache_read_input_tokens: total, cache_creation_input_tokens: 0 } } });
}

function 임시(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** 훅을 실제로 돌린다. 상태 폴더를 갈아 끼워 세션당 1회 억제를 격리한다. */
function 돌려(입력, stateDir) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(입력),
    encoding: 'utf8',
    env: { ...process.env, SYNK_CTXBUDGET_DIR: stateDir },
    cwd: 입력.cwd || ROOT,
  });
  const out = String(r.stdout || '').trim();
  if (!out) return { 발화: false, 본문: '' };
  let j;
  try { j = JSON.parse(out); } catch (_) { return { 발화: true, 본문: out }; }
  return { 발화: true, 본문: (j.hookSpecificOutput && j.hookSpecificOutput.additionalContext) || '', sys: j.systemMessage || '' };
}

const 성공 = { stdout: '[master 5e5b03f] docs: 지침 v8.0\n 4 files changed', stderr: '' };
const 노옵 = { stdout: 'On branch master\nnothing to commit, working tree clean', stderr: '' };

function 트랜스크립트(총량) {
  const d = 임시('synk-tb-tp-');
  const f = path.join(d, 't.jsonl');
  fs.writeFileSync(f, usageLine(총량) + '\n');
  return f;
}

test('track-boundary — 발동 조건: 성공 커밋 + 300k 이상일 때만 운다', () => {
  const 큰 = 트랜스크립트(400_000);
  const 작은 = 트랜스크립트(120_000);
  const 기본 = { tool_name: 'Bash', cwd: ROOT, tool_input: { command: 'git commit -m "x" -- a.md' } };

  assert.equal(돌려({ ...기본, session_id: 's1', tool_response: 성공, transcript_path: 큰 }, 임시('synk-tb-a-')).발화,
    true, '성공 커밋 + 400k 인데 침묵했다 — 이러면 장치가 없는 것과 같다');

  assert.equal(돌려({ ...기본, session_id: 's2', tool_response: 노옵, transcript_path: 큰 }, 임시('synk-tb-b-')).발화,
    false, '🔴 no-op 커밋을 「트랙이 닫혔다」로 셌다 — 아무것도 안 들어갔는데 끊으라고 한다(F071)');

  assert.equal(돌려({ ...기본, session_id: 's3', tool_response: 성공, transcript_path: 작은 }, 임시('synk-tb-c-')).발화,
    false, '120k 에서 울었다 — 비용과 무관한 자리다(150k 아래 세션 32개 합이 전체의 1.1%)');

  assert.equal(돌려({ ...기본, session_id: 's4', tool_input: { command: 'git status' }, tool_response: 성공, transcript_path: 큰 }, 임시('synk-tb-d-')).발화,
    false, '커밋이 아닌 명령에 울었다');

  // 인용 안의 산문은 실행이 아니다 — 가드가 실작업을 벌주면 사람이 가드를 끈다(F049)
  assert.equal(돌려({ ...기본, session_id: 's5', tool_input: { command: 'echo "git commit 을 조심하라"' }, tool_response: 성공, transcript_path: 큰 }, 임시('synk-tb-e-')).발화,
    false, '인용 안에 적힌 git commit 을 실행으로 셌다');

  assert.equal(돌려({ ...기본, session_id: 's6', tool_name: 'Read', tool_response: 성공, transcript_path: 큰 }, 임시('synk-tb-f-')).발화,
    false, 'Bash·PowerShell 이 아닌 도구에 반응했다');
});

test('track-boundary — 세션당 1회. 두 번째 커밋에는 침묵한다(소음이면 사람이 끈다)', () => {
  const tp = 트랜스크립트(400_000);
  const dir = 임시('synk-tb-once-');
  // 🔑 **사람이 실제로 쓰는 표기로 검사한다** — 진짜 session_id 는 UUID 다(CLAUDE.md 가드 맹점 ①).
  const A = '17027542-8024-46b6-932b-559733264a1e';
  const B = '7dd54149-844f-4dc1-893a-e2f470207d85';
  const inp = { tool_name: 'Bash', cwd: ROOT, session_id: A, tool_input: { command: 'git commit -m "x" -- a.md' }, tool_response: 성공, transcript_path: tp };
  assert.equal(돌려(inp, dir).발화, true, '첫 번째가 안 울었다');
  assert.equal(돌려(inp, dir).발화, false, '🔴 같은 세션에서 두 번 울었다 — 커밋할 때마다 뜨면 무시된다');
  // 다른 세션은 각자 한 번씩 운다(억제가 전역이면 옆 세션이 통째로 침묵한다)
  assert.equal(돌려({ ...inp, session_id: B }, dir).발화, true, '🔴 억제가 세션을 안 가른다 — 옆 세션이 통째로 침묵한다');
});

test('safeId — 뭉개진 id 끼리 같은 파일이 되지 않는다 (억제가 옆 세션을 삼키던 자리)', () => {
  const store = require(path.join(HOOKS, 'lib', 'handoff-store.js'));
  // 🔑 ASCII id 는 **값이 지금과 완전히 같아야** 한다 — 굴러가는 세션들의 상태가 고아가 되면 안 된다
  const uuid = '17027542-8024-46b6-932b-559733264a1e';
  assert.equal(store.safeId(uuid), uuid, '🔴 UUID 값이 바뀌었다 — 살아있는 세션들의 상태 파일이 통째로 고아가 된다');
  assert.equal(store.safeId('abc_DEF-123'), 'abc_DEF-123', 'ASCII 안전 문자가 바뀌었다');
  // 비ASCII 는 뭉개지되 **서로 달라야** 한다
  assert.notEqual(store.safeId('같은세션'), store.safeId('다른세션'),
    '🔴 서로 다른 id 가 같은 파일명이 됐다 — 한 세션의 억제 표식이 옆 세션을 통째로 침묵시킨다');
  assert.ok(!/[^A-Za-z0-9_-]/.test(store.safeId('같은세션')), '파일명에 못 쓰는 글자가 남았다');
});

test('track-boundary — 차단하지 않는다 (커밋은 이미 끝났고 끊는 건 유호님 손이다)', () => {
  const r = 돌려({ tool_name: 'Bash', cwd: ROOT, session_id: 'block', tool_input: { command: 'git commit -m "x" -- a.md' }, tool_response: 성공, transcript_path: 트랜스크립트(400_000) }, 임시('synk-tb-blk-'));
  assert.equal(r.발화, true);
  assert.ok(!/"permissionDecision"\s*:\s*"deny"|"decision"\s*:\s*"block"/.test(JSON.stringify(r)),
    '🔴 계기판이어야 할 훅이 차단을 냈다');
});

test('boardTrack — 내 커밋 해시로 내 줄을 찾고, 못 찾으면 남의 줄로 폴백하지 않는다', () => {
  const d = 임시('synk-tb-board-');
  fs.mkdirSync(path.join(d, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(d, 'docs', '세션보드.md'),
    '| 날짜 | 트랙 | 파일 | 상태 |\n|---|---|---|---|\n'
    + '| 2026-08-04 | 남의 트랙 | a.js | **작업중** — 남이 하는 일 |\n'
    + '| 2026-08-04 | 내 트랙 | b.js | ✅종결(5e5b03f) — 다음=후속 |\n');

  const 찾음 = report.boardTrack(d, ['5e5b03f docs: 뭔가']);
  assert.ok(찾음 && /내 트랙/.test(찾음.track), '커밋 해시로 내 줄을 못 찾았다');
  assert.ok(/다음=후속/.test(찾음.state), '상태 칸(=다음 할 일)을 안 가져왔다 — 주소만 있고 내용이 없으면 인계가 아니다');

  // 🔑 남의 「작업중」 줄로 폴백하면 새 세션이 **남의 트랙을 이어받는다**(F073 형태의 사고)
  assert.equal(report.boardTrack(d, ['0000000 없는 커밋']), null,
    '🔴 내 줄을 못 찾자 남의 줄을 집었다 — 모름을 통과로 번역했다');
  assert.equal(report.boardTrack(d, []), null, '커밋이 없는데 줄을 집었다');
  assert.equal(report.boardTrack(임시('synk-tb-noboard-'), ['5e5b03f x']), null, '보드가 없는데 죽거나 뭘 집었다');
});

test('writeHandoffFile — 파일로 남고, 덮어쓰지 않고 쌓이며, 3개를 넘기지 않는다', () => {
  const d = 임시('synk-tb-file-');
  const f1 = report.writeHandoffFile(d, '첫째 인계문', { sessionId: 'aaaaaaaa' });
  assert.ok(f1 && fs.existsSync(f1), '인계문 파일이 안 만들어졌다 — 유호님이 열어서 복사할 통로가 없다');

  report.writeHandoffFile(d, '둘째 인계문', { sessionId: 'bbbbbbbb' });
  let 본문 = fs.readFileSync(f1, 'utf8');
  assert.ok(본문.indexOf('둘째 인계문') < 본문.indexOf('첫째 인계문'), '최신이 맨 위가 아니다');
  assert.ok(/첫째 인계문/.test(본문),
    '🔴 앞 블록을 덮어썼다 — 창을 여러 개 쓰면 남의 트랙 인계문이 사라진다(handoff take() 와 같은 판정)');

  report.writeHandoffFile(d, '셋째 인계문', { sessionId: 'cccccccc' });
  report.writeHandoffFile(d, '넷째 인계문', { sessionId: 'dddddddd' });
  본문 = fs.readFileSync(f1, 'utf8');
  assert.equal((본문.match(/^## /gm) || []).length, 3, '3개 상한을 안 지켰다 — 파일이 무한히 자란다');
  assert.ok(!/첫째 인계문/.test(본문), '가장 오래된 것이 안 밀려났다');

  // 빈 인계문은 파일을 건드리지 않는다(빈 블록이 맨 위를 차지하면 다음 세션이 그걸 문다)
  assert.equal(report.writeHandoffFile(d, '   ', { sessionId: 'e' }), null, '빈 인계문을 파일에 썼다');

  // 시각은 **로컬**이어야 한다 — UTC 면 한국에서 9시간 어긋나 유호님이 「방금 것」을 못 가린다
  const 올해 = new Date().getFullYear();
  const 시 = (본문.match(new RegExp('^## ' + 올해 + '-\\d\\d-\\d\\d (\\d\\d):', 'm')) || [])[1];
  assert.equal(시, String(new Date().getHours()).padStart(2, '0'), '🔴 인계문 시각이 로컬 시각이 아니다(UTC 로 찍혔다)');
});

test('handoff-store — 워크트리와 메인이 **같은 키**를 받는다 (바통이 유실되던 자리)', () => {
  // require 캐시를 피해 새로 읽는다 — 다른 테스트가 이미 물고 있을 수 있다
  const store = require(path.join(HOOKS, 'lib', 'handoff-store.js'));
  const 메인키 = store.projectKey(ROOT);

  // 🔑 메인에서 부르면 값이 **지금까지와 완전히 같아야** 한다(worktrees.mainWorktree 계약).
  //   안 그러면 이미 굴러가는 세션들의 상태가 통째로 고아가 된다.
  assert.equal(메인키.length, 10, '키 형식이 바뀌었다');
  assert.equal(store.projectKey(ROOT.replace(/\\/g, '/')), 메인키, '구분자만 달라도 키가 갈린다(옛 결함)');
  assert.equal(store.projectKey(ROOT + path.sep), 메인키, '끝 구분자로 키가 갈린다');
  assert.equal(store.projectKey(ROOT.toUpperCase()), 메인키, '대소문자로 키가 갈린다');

  // 워크트리 경로 — git 이 있는 실저장소에서만 의미가 있다. 거짓양성만 묻는다.
  const wt = require(path.join(HOOKS, 'lib', 'worktrees.js'));
  const 메인트리 = wt.mainWorktree(ROOT);
  if (!메인트리 || path.resolve(메인트리) !== path.resolve(ROOT)) {
    // 여기서 통과시키면 「검사했다」와 「못 했다」가 같은 모양이 된다
    test.skip('git 을 못 부르거나 메인 트리를 못 찾음 — 워크트리 합류는 이 환경에서 검사 불가');
    return;
  }
  const 가짜워크트리 = path.join(ROOT, '.claude', 'worktrees', 'nonexistent-xyz');
  assert.equal(typeof store.projectKey(가짜워크트리), 'string', '워크트리 경로에서 키를 못 만든다');
});

test('🔴 등록층 — settings.json 이 track-boundary 를 실제로 부르고, 라우팅이 훅보다 넓다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const post = (s.hooks && s.hooks.PostToolUse) || [];
  const 줄들 = post.flatMap((g) => (g.hooks || []).map((h) => ({ matcher: g.matcher || '', cmd: String(h.command || '') })));
  const 내것 = 줄들.filter((x) => x.cmd.indexOf('track-boundary.js') !== -1);

  assert.equal(내것.length, 1, '🔴 track-boundary 가 등록되지 않았다 — 훅이 아무리 정확해도 안 불리면 통과다(F053)');

  const m = 내것[0].matcher;
  assert.ok(/Bash/.test(m) && /PowerShell/.test(m),
    `🔴 매처가 셸 도구 둘을 다 안 잡는다(${m}) — 훅은 둘 다 보는데 라우팅이 좁으면 그 자체가 구멍이다`);

  // 앞단 case 필터는 훅보다 **넓어야** 한다. 훅은 `git commit` 을 보므로 필터는 최소 `*git*`.
  const cmd = 내것[0].cmd;
  if (/case\s+/.test(cmd)) {
    assert.ok(/\*git\*/.test(cmd), `🔴 앞단 필터가 훅보다 좁다 — git commit 이 훅에 닿지도 못한다: ${cmd.slice(0, 120)}`);
  }

  // 실행 불가가 **조용한 통과**가 아니어야 한다(F044) — 없으면 다른 기계에서 통째로 죽는다
  assert.ok(/command -v node/.test(cmd) && /exit 1/.test(cmd),
    '🔴 node·훅 파일이 없을 때 조용히 넘어간다 — 실행 불가는 드러나야 한다(F044)');
  assert.ok(/CLAUDE_PROJECT_DIR/.test(cmd) && /PWD/.test(cmd),
    '🔴 등록이 로컬 절대경로다 — 다른 기계·클라우드에서 통째로 죽는다(F044)');
});
