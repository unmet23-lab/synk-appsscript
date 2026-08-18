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
const { spawnSync } = require('node:child_process'); // git 재현용 — node 자식은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

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

/** 훅을 실제로 돌린다. 상태 폴더를 갈아 끼워 세션당 1회 억제를 격리한다.
 *  🔴 cwd 는 주어진 게 없으면 **임시 폴더**다 — 절대 ROOT(실저장소)를 기본값으로 삼지 않는다.
 *  훅이 cwd 아래 docs/_ops/인계문.md 를 실제로 쓰기 때문에, ROOT 로 돌리면 이 스위트가
 *  돌 때마다 실인계문이 가짜 블록(세션 s1·block…)으로 밀려난다(F096 실사고 — CI·로컬 검증마다
 *  진짜 인계가 증발했고, 유호님이 "복사해 붙이라"고 안내받은 파일이 오염돼 있었다). */
function 돌려(입력, stateDir) {
  const cwd = 입력.cwd || 임시('synk-tb-cwd-');
  const r = 훅띄우기(HOOK, {
    input: JSON.stringify({ ...입력, cwd }),
    encoding: 'utf8',
    // 🔴 호스트 세션 id 를 **비운다** — 안 비우면 시험을 돌린 실세션의 id 가 훅에 새서
    //   ①가짜 블록이 진짜 세션 행세를 하고(변이 검증의 카나리아까지 무력화) ②그 세션의
    //   실커밋이 가짜 인계문에 실린다(08-04 실측: 가짜 3블록에 실커밋 목록이 들어 있었다).
    env: { ...process.env, SYNK_CTXBUDGET_DIR: stateDir, CLAUDE_CODE_HOST_SESSION_ID: '' },
    cwd,
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
  const 기본 = { tool_name: 'Bash', tool_input: { command: 'git commit -m "x" -- a.md' } };

  const s1cwd = 임시('synk-tb-s1cwd-');
  assert.equal(돌려({ ...기본, cwd: s1cwd, session_id: 's1', tool_response: 성공, transcript_path: 큰 }, 임시('synk-tb-a-')).발화,
    true, '성공 커밋 + 400k 인데 침묵했다 — 이러면 장치가 없는 것과 같다');
  // 인계문 파일은 **입력 cwd 아래**에 남아야 한다 — 실저장소가 아니라(위 돌려() 주석의 실사고)
  assert.ok(fs.existsSync(path.join(s1cwd, 'docs', '_ops', '인계문.md')),
    '발화했는데 인계문 파일이 입력 cwd 아래에 없다 — 그럼 어딘가 다른 곳(실저장소?)에 쓴 것이다');

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
  // cwd 고정 — 세션당 1회 표식이 projectKey(cwd) 로 갈리므로, 호출마다 cwd 가 바뀌면 억제가 안 보인다
  const inp = { tool_name: 'Bash', cwd: 임시('synk-tb-once-cwd-'), session_id: A, tool_input: { command: 'git commit -m "x" -- a.md' }, tool_response: 성공, transcript_path: tp };
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
  const r = 돌려({ tool_name: 'Bash', session_id: 'block', tool_input: { command: 'git commit -m "x" -- a.md' }, tool_response: 성공, transcript_path: 트랜스크립트(400_000) }, 임시('synk-tb-blk-'));
  assert.equal(r.발화, true);
  assert.ok(!/"permissionDecision"\s*:\s*"deny"|"decision"\s*:\s*"block"/.test(JSON.stringify(r)),
    '🔴 계기판이어야 할 훅이 차단을 냈다');
});

test('boardTrack — 내 커밋 해시로 내 줄을 찾고, 못 찾으면 남의 줄로 폴백하지 않는다', () => {
  const d = 임시('synk-tb-board-');
  fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
  fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'),
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

/* F165 (2026-08-07 실사고) — 해시가 없는 줄이 통째로 사각지대였다.
 * 「양보 종결」처럼 코드 커밋이 하나도 안 나간 트랙은 줄에 해시가 없다. 그래서 세션
 * `a0b27c60` 의 인계문이 「내 줄을 못 찾았다, 정말 없으면 멈춰라」로 나갔고, 그 줄은
 * 보드에 멀쩡히 있었다 — 다음 세션이 자기 트랙을 두고 멈출 뻔했다. */
test('boardTrack — 해시 없는 줄도 내 세션 지문으로 찾는다 (F165)', () => {
  const d = 임시('synk-tb-f165-');
  fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
  fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'),
    '| 날짜 | 트랙 | 파일 | 상태 |\n|---|---|---|---|\n'
    + '| 2026-08-07 | 남의 트랙 | a.js | 작업중 (`local_11112222`) — 남이 하는 일 |\n'
    + '| 2026-08-07 | 양보 종결 트랙 | b.js | **양보 종결**(`local_a0b27c60`) — 다음=옆 세션 구현이 정본 |\n');

  const 나 = 'local_a0b27c60-a3f8-48f9-8444-02a9724a61b2';
  const 찾음 = report.boardTrack(d, [], 나);
  assert.ok(찾음 && /양보 종결 트랙/.test(찾음.track),
    '🔴 지문이 줄에 적혀 있는데 못 찾았다 — F165 가 그대로다(다음 세션이 자기 트랙을 두고 멈춘다)');
  assert.ok(/다음=/.test(찾음.state), '상태 칸(=다음 할 일)을 안 가져왔다');
  assert.equal(찾음.근거, '지문', '무엇으로 찾았는지를 안 밝힌다');

  // 🔑 지문은 **줄에 적혀 있어야** 참이다 — 남의 줄을 이어받는 쪽이 더 큰 사고다(F073).
  assert.equal(report.boardTrack(d, [], 'local_99998888-0000-0000-0000-000000000000'), null,
    '🔴 남의 줄을 집었다 — 모름을 통과로 번역했다');
  assert.equal(report.boardTrack(d, [], ''), null, '커밋도 지문도 없는데 뭘 집었다');

  // 해시 경로는 그대로 산다(지문을 붙이며 옛 재료를 잃으면 그게 회귀다)
  fs.appendFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'),
    '| 2026-08-07 | 해시 트랙 | c.js | ✅종결(5e5b03f) — 다음=배포 |\n');
  const 해시로 = report.boardTrack(d, ['5e5b03f docs: 뭔가'], '');
  assert.ok(해시로 && /해시 트랙/.test(해시로.track) && 해시로.근거 === '해시', '🔴 해시 경로가 죽었다');
});

/* 🔴 F202 (2026-08-07 실측) — **남의 줄이 내 커밋을 인용하면 내 인계문을 가로챈다.**
 *   옛 구현은 해시 일치와 지문 일치를 같은 무게로 보고 보드를 위에서부터 훑다 먼저 만난 줄에서
 *   멈췄다. 그런데 트랙끼리 서로의 커밋을 근거로 짚는 것은 이 저장소에서 흔한 일이라, 그런 줄이
 *   내 줄보다 위에 있으면 「▶ 내 보드 줄」이 통째로 남의 트랙으로 나간다 — 오류 0·경고 0.
 *   증거의 무게가 다르다: 지문은 그 줄이 **스스로 내 것이라 말한 것**이고 해시는 정황이다. */
test('boardTrack — 남의 줄이 내 해시를 인용해도 내 지문 줄을 집는다 (F202)', () => {
  const d = 임시('synk-tb-f202-');
  fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
  fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'),
    '| 날짜 | 트랙 | 파일 | 상태 |\n|---|---|---|---|\n'
    // 남의 줄이 **먼저** 오고, 근거로 내 커밋을 인용한다 — 실측이 정확히 이 배치였다.
    + '| 2026-08-07 | 남의 트랙 | a.js | ✅종결(`local_b170e8dc`) — 격차는 전부 방금 5e5b03f 하나 |\n'
    + '| 2026-08-07 | 내 트랙 | b.js | ✅종결(5e5b03f · `local_a0b27c60`) — 다음=없음 |\n');

  const 나 = 'local_a0b27c60-a3f8-48f9-8444-02a9724a61b2';
  const 찾음 = report.boardTrack(d, ['5e5b03f docs: 내 커밋'], 나);
  assert.ok(찾음 && /내 트랙/.test(찾음.track),
    `🔴 남의 줄을 집었다 — 다음 세션이 남의 트랙을 이어받는다: ${JSON.stringify(찾음)}`);
  assert.equal(찾음.근거, '지문', '지문 줄이 있는데 해시로 찾았다 — 우선순위가 뒤집혔다');

  /* 자기 처방(F103) — 지문이 **한 줄도 없을 때만** 해시로 내려가는 폴백은 살아 있어야 한다.
   *   안 그러면 이 수리가 F165 가 막아 둔 사각(해시만 있는 줄)을 되살린다. */
  const 폴백 = report.boardTrack(d, ['5e5b03f docs: 내 커밋'], 'local_99998888-0000-0000-0000-000000000000');
  assert.ok(폴백 && 폴백.근거 === '해시', '🔴 지문이 없는데 해시 폴백까지 죽었다 — F165 회귀');
});

/* 🔴 F338 (2026-08-12 실사고 · 유호님 지적) — **남의 세션 파일 안의 줄이 내 줄로 나갔다.**
 *   F202 가 지문을 해시 위로 올렸지만 **남은 해시 폴백에서 같은 사고가 그대로 다시 났다.**
 *   실물: 죽은 세션 `ffa75dcb` 의 인계문이 23:22 재생성될 때 「▶ 내 보드 줄」에 살아있는
 *   `e556253e` 의 **활성** 줄이 박혔다. 그 줄은 ㉠제목에 `ffa75dcb` 를 인용하고(인계받았다는 뜻)
 *   ㉡상태 칸에 ffa75dcb 의 커밋 `f5fcfa30` 을 인용해서, 파일명 사전순(`e…` < `f…`)으로 내
 *   줄보다 위에 오자 해시 폴백이 그것을 먼저 물었다 — 오류 0·경고 0·모양은 정상.
 *   결과물은 **죽은 세션의 인계문이 남의 살아있는 트랙을 「이어라」로 지시하는** 모양이다.
 *
 * 🔑 처방은 재료를 늘리는 게 아니라 **층을 바꾸는 것**이다: 줄 안에 적힌 것은 인용될 수 있지만
 *   보드 **파일 경로**는 board-guard 가 강제하는 규칙이라 인용될 수 없다(F250 · board-id.파일지문).
 *
 * ⚠ 이 픽스처는 **버그가 아직 있을 것을 요구하지 않는다**(가드 맹점 ②) — 실저장소가 아니라
 *   여기서 탐지력을 지고, 검사하는 것은 「남의 파일 줄을 안 문다」는 성질 하나다. */
test('boardTrack — 남의 세션 파일 줄이 내 지문·내 해시를 인용해도 내 것으로 안 잡는다 (F338)', () => {
  const 보드깔기 = (prefix, 파일들) => {
    const d = 임시(prefix);
    const dir = path.join(d, 'docs', '_ops', '보드');
    fs.mkdirSync(dir, { recursive: true });
    for (const [이름, 줄] of Object.entries(파일들)) {
      fs.writeFileSync(path.join(dir, 이름), `# 보드 — ${이름}\n\n| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |\n|---|---|---|---|\n${줄}\n`);
    }
    return d;
  };
  const 나 = 'local_ffa75dcb-ceb8-46a0-b989-115bf0bae2c7';
  const 내커밋 = ['f5fcfa30 [v9.211] 오류뱅크 커서 수리'];
  // 실측 배치 그대로 — 남의 파일이 사전순으로 **먼저** 오고, 그 줄이 내 지문과 내 해시를 둘 다 인용한다.
  const 남의줄 = '| 2026-08-11 | **⓪f5fcfa30 재검수→배포**(ffa75dcb 🎫 인계 · `local_e556253e`) | as | ▶재검수 백그라운드 가동 |';
  const 내줄 = '| 2026-08-11 | **⓪v9.210 재검수→배포 + 명부스윕 인계** | as | ✅v9.211 종결 — 다음=재검수 |';

  const d = 보드깔기('synk-tb-f337a-', { 'e556253e.md': 남의줄, 'ffa75dcb.md': 내줄 });
  const 찾음 = report.boardTrack(d, 내커밋, 나);
  assert.ok(찾음 && /명부스윕 인계/.test(찾음.track),
    `🔴 남의 세션 파일 줄을 집었다 — 죽은 세션 인계문이 남의 활성 트랙을 「이어라」로 시킨다: ${JSON.stringify(찾음)}`);
  assert.doesNotMatch(찾음.track, /🎫 인계/, '🔴 남의 줄 제목이 실렸다');
  assert.equal(찾음.근거, '파일', '파일 소유로 안 가렸다 — 줄 내용으로 가리면 인용과 선언을 구별 못 한다');
  assert.match(찾음.state, /다음=재검수/, '상태 칸(=다음 할 일)을 안 가져왔다');

  /* 🔑 반대 방향 — **내 파일이 아예 없을 때** 남의 파일 줄로 폴백하면 고친 게 없다.
   *   이게 새는 방향이고(모름 → 통과), 실사고의 손해는 전부 이 방향에서 났다. */
  const 내것없음 = 보드깔기('synk-tb-f337b-', { 'e556253e.md': 남의줄 });
  assert.equal(report.boardTrack(내것없음, 내커밋, 나), null,
    '🔴 내 보드 파일이 없는데 남의 파일 줄을 집었다 — 모름을 통과로 번역했다(F073)');
  assert.equal(report.무주줄(내것없음), 0,
    '🔴 남의 세션 파일 줄을 「주인 못 가림」으로 셌다 — 인계문이 「그 줄들을 보라」로 남의 트랙을 가리킨다');

  /* 🔑 파일이 주인을 밝히면 줄에 지문도 해시도 없어도 내 줄이다 — F165 사각지대가 파일 층에서 닫힌다. */
  const 재료없음 = 보드깔기('synk-tb-f337c-', { 'ffa75dcb.md': '| 2026-08-11 | 양보 종결 트랙 | b.js | 미확정 — 다음=없음 |' });
  const 파일로 = report.boardTrack(재료없음, [], 나);
  assert.ok(파일로 && /양보 종결 트랙/.test(파일로.track) && 파일로.근거 === '파일',
    `🔴 내 파일 안의 줄인데 못 찾았다 — 다음 세션이 자기 트랙을 두고 멈춘다: ${JSON.stringify(파일로)}`);
  assert.equal(report.무주줄(재료없음), 0,
    '🔴 파일이 주인을 밝힌 줄을 모호로 셌다 — boardTrack 과 갈라져 인계문이 반대로 말한다');
});

/* 🔴 F170 (2026-08-07) — 「트랙 종결」과 「트랙 없음」이 **한 문구**로 나갔다.
 * 트랙 없이 끝난 세션의 인계문이 「보드를 열어 확인하고 정말 없으면 없다고 말하고 멈춰라」로
 * 나가서, 다음 세션은 그걸 「이어갈 게 없다」가 아니라 「내가 뭘 놓쳤나」로 읽고 커밋 트레일러·
 * 보드·장부를 처음부터 되훑었다. 세션 셋이 연달아 그렇게 탔다(116b4059 → 83d5c0d2 → 그 다음).
 * 트랙이 없는 세션에게 옳은 다음 수는 **멈춤이 아니라 새 트랙**이고, 「없다」가 사실인지 모름인지는
 * 이 통로가 **이미 읽은 보드**로 잴 수 있다 — 지문 없는 옛 줄이 0 이면 사실이다. */
test('인계문 — 트랙 없음을 「멈춰라」가 아니라 「새 트랙」으로 넘긴다 (F170)', () => {
  const 머리 = '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n';
  const 보드 = (prefix, 줄들) => {
    const d = 임시(prefix);
    fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'), 머리 + 줄들.join(''));
    return d;
  };
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  try {
    // ① 줄이 전부 지문을 달았다 → 「내 트랙 없음」은 **가능성이 아니라 사실**. 다시 열 이유가 없다.
    const 확정 = 보드('synk-tb-f170a-', [
      '| 2026-08-07 | 남의 트랙 | a.js | 작업중 (`local_11112222`) — 남이 하는 일 |\n',
      '| 2026-08-07 | 또 다른 남의 트랙 | b.js | ✅종결 (`local_33334444`) — 끝 |\n',
    ]);
    assert.equal(report.무주줄(확정), 0,
      '지문이 다 적힌 보드인데 무주줄을 셌다 — 머리글·구분선을 데이터 줄로 셌을 것이다');
    /* 🔑 `가지: {모름:false}` = **가지(워크트리) 층까지 다 훑었다** (F529 로 분모가 넓어졌다).
     *   임시 폴더는 git 저장소가 아니라 실제로는 그 층을 못 재고, 못 잰 회차는 「다시 열 필요
     *   없다」를 쓸 수 없다 — 여기서 재고 싶은 것은 **다 쟀을 때 단정하는가**이므로 명시한다. */
    const 다쟀다 = { dirty: 0, 가지: { 줄들: [], 모름: false } };
    const a = report.buildHandoff(확정, null, 다쟀다);
    assert.doesNotMatch(a, /멈춰라/,
      `🔴 트랙 없이 끝난 세션에 「멈춰라」가 나갔다 — F170 이 그대로다:\n${a}`);
    assert.match(a, /새 트랙/, '다음 수를 안 줬다 — 「없다」로만 끝나면 새 세션이 보드·장부를 되훑는다');
    assert.match(a, /다시 열 필요 없다/, '이미 보드를 읽고도 「보드를 열어 확인하라」를 시켰다');
    assert.doesNotMatch(a, /남의 트랙/, '남의 보드 줄을 내 트랙으로 실었다(F073)');

    // ② 주인을 밝힐 재료가 **아무것도 없는** 줄만 모호다 — 모름은 모름으로 두되 **수를 밝힌다**.
    //    🔴 해시 줄까지 모호로 세면 실제 보드 18줄 중 17줄이 모호라, 새 문구가 「보드 전문을
    //    읽어라」로 되돌아간다(첫 구현이 실측에 그렇게 반박당했다). 해시 줄은 boardTrack 이
    //    이미 해시로 가렸으므로 여기서 다시 의심하지 않는다.
    const 모호 = 보드('synk-tb-f170b-', [
      '| 2026-08-07 | 남의 트랙 | a.js | 작업중 (`local_11112222`) — 남이 하는 일 |\n',
      '| 2026-08-04 | 해시로 밝힌 줄 | b.js | ✅종결(5e5b03f) — 지문은 없지만 해시가 있다 |\n',
      '| 2026-08-04 | 재료 없는 줄 | c.js | 미확정 |\n',
    ]);
    assert.equal(report.무주줄(모호), 1,
      '🔴 해시로 주인을 밝힌 줄까지 셌다 — 실저장소에선 17/18 이 모호가 되어 고친 게 없어진다');
    const b = report.buildHandoff(모호, null, { dirty: 0 });
    assert.match(b, /\*\*1개\*\*/,
      `모호한 줄 수를 안 밝혔다 — 확정과 같은 모양이 되면 가른 의미가 없다:\n${b}`);
    assert.doesNotMatch(b, /다시 열 필요 없다/, '🔴 모름을 사실로 단정했다');
    assert.doesNotMatch(b, /멈춰라/, '모호한 쪽에 「멈춰라」가 남아 있다');
    assert.match(b, /새 트랙/, '모호한 쪽에 다음 수가 없다');

    // ③ 보드를 못 읽으면 수를 지어내지 않는다(`옛 줄 null개` 가 나가면 안 된다).
    const 없음 = 임시('synk-tb-f170c-');
    assert.equal(report.무주줄(없음), null, '보드가 없는데 수를 지어냈다');
    const c = report.buildHandoff(없음, null, { dirty: 0 });
    assert.doesNotMatch(c, /null/, `🔴 보드를 못 읽고도 수를 적었다:\n${c}`);
    assert.match(c, /못 읽었다/, '못 읽은 것을 밝히지 않았다');

    // ④ 반대 방향 — 내 줄이 있으면 이 문구가 나오면 안 된다.
    //    (한쪽만 검사하면 no-track 분기를 통째로 지워도 초록이다 · CLAUDE.md 가드 맹점)
    const 있음 = 보드('synk-tb-f170d-', [
      '| 2026-08-07 | 내 트랙 | a.js | 작업중 (`local_ba86eeb2`) — 다음=회귀 붙이기 |\n',
    ]);
    const d2 = report.buildHandoff(있음, null, { dirty: 0 });
    assert.match(d2, /다음=회귀 붙이기/, '내 줄이 있는데 상태/다음을 안 실었다');
    assert.doesNotMatch(d2, /새 트랙을 잡아라/, '🔴 내 트랙이 있는데 새 트랙을 잡으라고 했다');
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

/* 🔴 F169 (2026-08-07) — 인계문이 **✅종결 줄의 ⚠잔여를 「다음 할 일」로** 배달했다.
 * 보드에 「⚠라이브 미반영=다음 /deploy」라 적힌 종결 줄이 새 세션에 「그것부터 이어라」로 나갔는데,
 * 그 배포는 나가면 안 되는 것이었다(clasp push 는 작업본을 올리는데 대상이 **남의 미커밋**을 물고
 * 있었다). 실피해는 clasp-guard ③ 이 막아 0 이었지만 세션 하나가 통째로 그 판정에 쓰였다.
 * F170 은 「트랙 없음」만 고쳤다 — 「트랙 종결」은 다음 수가 같은데도 옛 문구가 남아 있었다. */
test('인계문 — ✅종결 줄의 ⚠잔여를 「이어라」로 번역하지 않는다 (F169)', () => {
  const 머리 = '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n';
  const 보드 = (prefix, 줄) => {
    const d = 임시(prefix);
    fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'), 머리 + 줄);
    return d;
  };
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  try {
    // ① 사고 그대로 재현 — 종결 줄 + ⚠잔여.
    const 종결 = 보드('synk-tb-f169a-',
      '| 2026-08-07 | 크루카드 띠 | 카드.html | ✅**종결·push**(`local_ba86eeb2`) — ⚠라이브 미반영=다음 /deploy |\n');
    const a = report.buildHandoff(종결, null, { dirty: 0 });
    assert.match(a, /라이브 미반영/, '종결이라고 줄 내용을 **감추면** 안 된다 — 배경으로 넘기는 것이지 지우는 게 아니다');
    assert.doesNotMatch(a, /다음 할 일부터 이어라/,
      `🔴 종결 줄의 ⚠잔여가 그대로 지시로 나갔다 — F169 가 그대로다:\n${a}`);
    assert.match(a, /배경이지 지시가 아니다/, '잔여를 어떻게 읽어야 하는지 안 말했다');
    assert.match(a, /새 트랙을 잡아라/, '종결 뒤 다음 수를 안 줬다(트랙 없음과 같은 자리다)');

    // ② 거짓양성 — ⏸ 는 **이어가라고 적어 둔 줄**이다. 여기까지 종결로 읽으면 진짜 인계가 끊긴다.
    //    (④ 의 `작업중` 과 다른 표기를 쓴다 — 사람이 실제로 쓰는 표기로 검사한다 · 가드 맹점 ①)
    const 일시정지 = 보드('synk-tb-f169b-',
      '| 2026-08-07 | 홈페이지 시안 | 시안/ | ⏸**내일 이어감**(`local_ba86eeb2`) — 다음=캐릭터 교체 |\n');
    const b = report.buildHandoff(일시정지, null, { dirty: 0 });
    assert.match(b, /다음 할 일부터 이어라/, `🔴 ⏸ 트랙을 종결로 읽어 인계를 끊었다:\n${b}`);
    assert.doesNotMatch(b, /새 트랙을 잡아라/, '⏸ 인데 새 트랙을 잡으라고 했다');

    // ③ 판정은 **첫 글자**로만 한다 — 본문에서 낱말을 찾으면 남의 종결을 인용한 줄까지 걸린다.
    assert.equal(report.종결줄('✅**종결·push**(abc) — ⚠잔여'), true);
    assert.equal(report.종결줄('✅**쓰기 절반 종결**'), true, '절반 종결도 「내가 이어갈 일」로 적힌 게 아니다');
    assert.equal(report.종결줄('작업중 — 옆 세션이 ✅종결 했으니 그 뒤를 잇는다'), false,
        '🔴 본문의 ✅ 로 종결을 판정했다 — 남의 종결을 인용한 살아있는 줄이 통째로 끊긴다');
    assert.equal(report.종결줄('🔵착수(`local_b6cb681a`)'), false);
    assert.equal(report.종결줄(''), false);
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

/* 🎫 = 「남의 줄은 이어받지 않는다」의 **유일한 예외** — 주인이 「나는 이걸 안 한다」고 놓은 일감.
 *
 * 왜 회귀가 필요한가 (2026-08-09 · 유호님 지시 「벽에 막힌 일감이 버려지지 않도록 다른 세션에서
 *   알아서 이어할 수 있게」): 금지문만 있고 예외가 없으면 `/afk` 가 승인 벽에 놓고 간 일감은
 *   **구조적으로 버려진다** — 아무도 집으면 안 되는 줄이 되기 때문이다. 그런데 이 문구는 매 세션
 *   컨텍스트에 실려서 상시 압축 압력을 받는다(buildHandoff 주석: 「짧게 유지한다」). 예외 한 줄이
 *   깎이면 🎫 는 **아무도 안 지키는 표식**이 되고, 증상은 에러가 아니라 침묵이다(버려진 일감은
 *   소리를 안 낸다). 그래서 금지와 예외는 **한 문장 안에** 붙어 있어야 하고 그것을 여기서 못박는다.
 *
 * ⚠ 짝이 되는 검사가 ④다 — 「집어도 된다」만 남고 「내 줄을 새로 선언하라」가 깎이면, 이어받기가
 *   곧 남의 보드 파일 편집이 되어 F073 을 예외라는 이름으로 되살린다. 두 짝을 같이 검사한다.
 * 탐지는 픽스처가 진다 — 실저장소는 안 본다(CLAUDE.md 가드 맹점 ②). */
test('인계문 — 「이어받지 않는다」 옆에 🎫 예외가 같이 나간다 (벽에 놓인 일감이 버려지는 자리)', () => {
  const 머리 = '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n';
  const 보드 = (prefix, 줄) => {
    const d = 임시(prefix);
    fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'), 머리 + 줄);
    return d;
  };
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  try {
    /* 「새 트랙」 문구는 **두 갈래**가 같이 쓴다(F170 트랙 없음 · F169 트랙 종결).
     * 한쪽만 검사하면 나중에 갈라져도 초록이다 — 상수를 하나로 둔 이유가 그거다. */
    const 없음 = 보드('synk-tb-ticket-a-',
      '| 2026-08-07 | 남의 트랙 | a.js | 작업중 (`local_11112222`) — 남이 하는 일 |\n');
    const 종결 = 보드('synk-tb-ticket-b-',
      '| 2026-08-07 | 내 트랙 | b.js | ✅**종결·push**(`local_ba86eeb2`) — 끝 |\n');

    for (const [이름, dir] of [['트랙 없음(F170)', 없음], ['트랙 종결(F169)', 종결]]) {
      const h = report.buildHandoff(dir, null, { dirty: 0 });
      assert.match(h, /새 트랙을 잡아라/, `${이름}: 다음 수 문구 자체가 없다 — 아래 검사가 무의미해진다`);

      // ① 예외가 나간다. 없으면 벽에 놓인 일감을 **집을 수 있는 사람이 0명**이 된다.
      assert.match(h, /🎫/,
        `🔴 ${이름}: 🎫 예외가 인계문에서 사라졌다 — /afk 가 벽에 놓고 간 일감을 아무도 못 집는다(버려짐은 침묵으로 나타난다):\n${h}`);

      // ② 금지문은 그대로 살아 있다. 예외만 남으면 반대 방향 사고(F073)가 열린다.
      assert.match(h, /이어받지는 않는다/,
        `🔴 ${이름}: 예외를 달면서 금지문을 지웠다 — 이제 남의 살아있는 트랙까지 집어도 되는 것으로 읽힌다:\n${h}`);

      // ③ 근거 마찰번호를 남긴다 — 「왜 금지인가」가 사라지면 다음 압축이 금지째 지운다.
      assert.match(h, /F073/, `${이름}: 금지의 근거(F073)가 빠졌다`);

      // ④ 짝 — 집는 방법이 「**네** 지문 파일에 네 줄」이어야 한다. 빠지면 이어받기가 남의 보드 편집이 된다.
      //    ⚠ 옛 문구는 「내 파일에 내 줄」이었다 — 읽는 이에게 「내」는 **글쓴이**라 정확히 반대로 읽혔다(F332).
      assert.match(h, /`docs\/_ops\/보드\/<네 지문>\.md` 에 네 줄/,
        `🔴 ${이름}: 「집어도 된다」만 남고 집는 방법이 빠졌다 — 이어받는 세션이 남의 보드 줄을 고쳐 F073 이 예외라는 이름으로 되살아난다:\n${h}`);
      assert.doesNotMatch(h, /내 파일에 내 줄/,
        `🔴 ${이름}: 「내 파일에 내 줄」이 돌아왔다 — 이 글의 「내」는 글쓴이(죽은 세션)라 F332 가 그대로 재발한다:\n${h}`);
    }

    /* ⑤ 거짓양성 방향 — ⏸ 는 **내가 이어갈 줄**이라 애초에 「새 트랙」이 안 나간다.
     *   그 갈래에까지 🎫 를 흘리면 자기 트랙을 남에게 내놓으라는 말이 된다. */
    const 일시정지 = 보드('synk-tb-ticket-c-',
      '| 2026-08-07 | 홈페이지 시안 | 시안/ | ⏸**내일 이어감**(`local_ba86eeb2`) — 다음=캐릭터 교체 |\n');
    const c = report.buildHandoff(일시정지, null, { dirty: 0 });
    assert.doesNotMatch(c, /🎫/,
      `🔴 이어가기로 적어 둔 내 트랙에 🎫 가 나갔다 — 남이 집어가면 병렬 중복 구현이다:\n${c}`);
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

/* 🔴 F332 (2026-08-12 실사고) — 인계문의 「나」와 **읽는 이의 「나」가 다른 세션**인데 안 갈렸다.
 *
 * 이 글은 세션 A 가 쓰고 세션 B 가 자기 **첫 메시지**로 받는다. 옛 문구는 트랙 없음 갈래에서
 * 「그중 **내 것(`647ee2cb`)**은 없다」로 나갔고, B 는 그 8자리를 제 지문으로 읽어
 * `docs/_ops/보드/647ee2cb.md`(죽은 A 의 파일)에 자기 줄을 썼다 — F250 위반을 **인계문이 시켰다**.
 * 실제로 막은 것은 git-scope-guard 였다(장치가 시키고 다른 장치가 막은 꼴).
 *
 * 🔑 새는 방향이 「그럴듯한 통과」다 — 오류도 경고도 안 나고 모양이 정상이라, 이 검사가 없으면
 *   다음 압축이 이음매 한 줄을 「군더더기」로 지우고 증상은 다시 침묵으로 돌아온다.
 * 탐지는 픽스처가 진다 — 실저장소 인계문은 안 본다(CLAUDE.md 가드 맹점 ②). */
test('인계문 — 글쓴이 지문을 「내 것」으로 배달하지 않는다 · 읽는 이의 지문 출처를 준다 (F332)', () => {
  const 머리 = '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n';
  const 보드 = (prefix, 줄들) => {
    const d = 임시(prefix);
    fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'), 머리 + 줄들.join(''));
    return d;
  };
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  const 지문 = 'ba86eeb2';
  try {
    /* ① 사고 그대로 — 줄이 전부 남의 것이라 「트랙 없음」이 확정되고, 그 문장이 지문을 글자로 싣는다. */
    const 없음 = 보드('synk-tb-f332a-', [
      '| 2026-08-12 | 남의 트랙 | a.js | ▶작업중 (`local_11112222`) — 남이 하는 일 |\n',
    ]);
    // 🔑 가지 층까지 다 훑은 회차로 고정한다 — 못 잰 회차엔 이 단정 문장이 아예 안 나간다(F529).
    const 다쟀다 = { dirty: 0, 가지: { 줄들: [], 모름: false } };
    const a = report.buildHandoff(없음, null, 다쟀다);
    assert.match(a, new RegExp(지문), '지문을 통째로 지웠다 — 「그 세션이 누구였나」는 커밋·보드를 되짚는 비용을 줄이는 재료다');
    assert.doesNotMatch(a, new RegExp('내 것\\(`' + 지문 + '`\\)'),
      `🔴 글쓴이 지문이 「내 것」으로 나갔다 — 받은 세션이 죽은 세션의 보드 파일에 자기 줄을 쓴다(F250·F332):\n${a}`);
    assert.match(a, new RegExp('그 세션\\(`' + 지문 + '`\\)'),
      '지문의 주인을 3인칭으로 안 밝혔다 — 「내/그」가 안 갈리면 8자리는 다시 읽는 이의 것으로 읽힌다');

    /* ② **모든** 갈래가 이음매를 진다. 한 갈래만 지면 나머지에서 같은 사고가 그대로 난다. */
    const 종결 = 보드('synk-tb-f332b-', ['| 2026-08-12 | 내 트랙 | b.js | ✅**종결**(`local_ba86eeb2`) — 끝 |\n']);
    const 이어감 = 보드('synk-tb-f332c-', ['| 2026-08-12 | 내 트랙 | c.js | ⏸**내일 이어감**(`local_ba86eeb2`) — 다음=회귀 |\n']);
    for (const [이름, h] of [
      ['트랙 없음', a],
      ['트랙 종결', report.buildHandoff(종결, null, { dirty: 0 })],
      ['이어받기', report.buildHandoff(이어감, null, { dirty: 0 })],
    ]) {
      const 첫줄 = h.split('\n')[0];
      assert.match(첫줄, /너는 다른 세션이다/,
        `🔴 ${이름}: 이음매가 **첫 줄**에 없다 — 뒤따르는 「나·내」를 가르는 문장은 그것들보다 먼저 읽혀야 한다:\n${h}`);
      assert.match(첫줄, /CLAUDE_CODE_HOST_SESSION_ID/,
        `🔴 ${이름}: 읽는 이의 지문이 **어디서 오는지**를 안 줬다 — 출처가 없으면 화면에 있는 유일한 8자리(글쓴이 것)를 쓴다`);
      assert.match(첫줄, /네 지문 파일에만/, `🔴 ${이름}: 보드 줄을 어디에 쓰는지가 이음매에서 빠졌다`);
      assert.equal(첫줄.includes('undefined'), false, `🔴 ${이름}: 이음매에 undefined 가 샜다`);
      // 매 세션 컨텍스트에 실리는 글이다 — 이음매는 한 줄을 넘기지 않는다(주석의 약속을 기계로 붙든다).
      assert.ok(첫줄.length <= 260, `🔴 ${이름}: 이음매가 ${첫줄.length}자다 — 매 세션 곱해지는 자리라 한 줄로 유지한다`);
    }

    /* ③ 이어받기 갈래는 **어디에 선언하는지**까지 말해야 한다. 방금 보여 준 줄은 끝난 세션의
     *   파일 안에 있어서, 말이 없으면 받은 세션은 자연히 그 줄을 고치러 간다(사고의 실제 경로). */
    const c = report.buildHandoff(이어감, null, { dirty: 0 });
    assert.match(c, /다음 할 일부터 이어라/, '이어받기 갈래가 아니다 — 아래 검사가 무의미해진다');
    assert.match(c, /`docs\/_ops\/보드\/<네 지문>\.md`/,
      `🔴 이어받으라고만 하고 **어디에 선언할지**를 안 줬다 — 받은 세션이 죽은 세션의 보드 파일을 고친다:\n${c}`);
    /* ⚠ 옛 검사는 `/끝난 세션의 보드 파일/` 이었다 — 지켜야 할 것은 **「남의 파일이다」**이지
     *   생사 단언이 아니다(F343: 그 세션은 살아서 계속 커밋한다). 축만 옮기고 사실은 그대로 붙든다. */
    assert.match(c, /그 세션의 보드 파일.*남의 파일이다/, '그 줄이 남의 파일에 있다는 사실 자체를 안 말했다');
    assert.doesNotMatch(c, /끝난 세션의 보드 파일/,
      `🔴 이어받기 갈래가 다시 「끝난 세션」이라 단언한다 — 같은 단언이 두 자리에 살면 한 곳만 고쳐도 새다(F343):\n${c}`);

    /* ④ 거짓양성 방향 — 지문이 없는 세션(폰 클라우드 등)에서도 문장이 서야 한다.
     *   백틱만 남거나 「그 세션()」이 나가면 이음매가 오히려 혼란을 만든다. */
    process.env.CLAUDE_CODE_HOST_SESSION_ID = '';
    const d = report.buildHandoff(없음, null, 다쟀다);
    const d첫줄 = d.split('\n')[0];
    /* ⚠ 옛 검사는 `/끝난 세션/` 이었다 — 그 단언 자체가 F343 의 원인이라 문구가 바뀌었다.
     *   지키려던 것(「지문이 없다고 이음매가 통째로 사라지지 않는다」)은 그대로 두고 축만 옮긴다. */
    assert.match(d첫줄, /마감하며/, '지문이 없다고 이음매가 통째로 사라졌다');
    assert.doesNotMatch(d첫줄, /끝난 세션/,
      `🔴 이음매가 다시 「끝난 세션」이라 단언한다 — 그 세션은 살아서 계속 커밋한다(F343):\n${d첫줄}`);
    assert.match(d첫줄, /너는 다른 세션이다/, '지문 없는 갈래에서 이음매의 핵심 문장이 빠졌다');
    assert.doesNotMatch(d, /``|\(\)/, `🔴 지문 없는 갈래가 빈 백틱·빈 괄호를 냈다:\n${d첫줄}`);
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

/* 🔴 F343 의 **원인** 쪽 (2026-08-12 실측 · 결과 쪽은 board-guard ④ 가 이미 막았다).
 *
 * 인계문이 「끝난 세션 `52a7abc6`」이라 단언하고 🎫 로 「`--commit 52eac5b2` 재검수」를 넘겼는데,
 * 그 세션은 인계문을 쓴 뒤에도 살아서 자기 🎫 를 직접 처리하고 보드 줄을 **새 과녁**으로 갱신했다.
 * 이어받은 세션이 치른 값 = 낡은 과녁으로 이종 검수 11분(codex 실비) · 보드 선언→철회 · board-move 2건.
 *
 * 🔑 고칠 것은 세션 수명이 아니라 **①단언**과 **②사본을 대조할 좌표**다. 그리고 낡음은 쓰는
 *   시점엔 원리상 모르고 **읽는 시점엔 잴 수 있다** — 그래서 `낡음()` 은 읽는 자리의 함수다.
 * 🔑 검사는 문구가 아니라 **왕복**으로 건다(build → 낡음). producer·parser 가 같은 파일에 있어도
 *   문구를 다듬으면 갈라질 수 있고, 갈라진 쪽 증상은 「경고가 안 뜬다」= **통과와 같은 모양**이다. */
test('인계문 — 보드 줄 «사본»의 낡음을 읽는 자리에서 잰다 (F343 원인 쪽)', () => {
  const 머리 = '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n';
  const 짓기 = (줄) => {
    const d = 임시('synk-tb-f343-');
    fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'), 머리 + 줄);
    return d;
  };
  const 원 = '| 2026-08-12 | 내 트랙 | a.js | ▶작업중 (`local_ba86eeb2`) — 🎫 다음=`--commit 52eac5b2` 재검수 |\n';
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  try {
    const d = 짓기(원);
    const h = report.buildHandoff(d, null, { dirty: 0 });

    /* ① 사본에 **원본 주소**가 붙어야 한다 — 없으면 받은 세션에게 사본이 유일한 현실이고,
     *   「지금 다시 읽어라」는 따를 수 없는 처방이 된다(F103). 좌표는 실제 그 파일이어야 한다. */
    assert.match(h, /원본 `docs\/_ops\/보드\/sess\.md`/,
      `🔴 사본만 싣고 원본 주소를 안 줬다 — 다시 볼 이유가 안 보인다:\n${h}`);

    /* ② 왕복 — 안 바뀌었으면 「그대로」. 여기가 거짓양성 방향이다(늘 짖는 경고는 곧 배경이 된다). */
    const v0 = report.낡음(d, h);
    assert.ok(v0, '인계문에서 대조 좌표를 못 되읽었다 — producer 와 parser 가 갈라졌다');
    assert.strictEqual(v0.판정, '그대로', `🔴 원본이 그대로인데 「${v0.판정}」이라 짖는다 — 거짓양성이 이 경고의 사망 원인이다`);
    assert.strictEqual(report.낡음경고(v0), null, '「그대로」인데 경고를 냈다 — 매번 뜨는 줄은 아무도 안 읽는다');

    /* ③ 실사고 재현 — 그 세션이 마감 뒤에도 일해 🎫 과녁을 옮겼다. 이게 잡혀야 한다. */
    fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'),
      머리 + 원.replace('52eac5b2', 'c0f148aa'));
    const v1 = report.낡음(d, h);
    assert.strictEqual(v1.판정, '바뀜', `🔴 🎫 과녁이 옮겨졌는데 못 잡았다 — 낡은 과녁으로 값비싼 조작이 나간다:\n${JSON.stringify(v1)}`);
    const 경고 = report.낡음경고(v1);
    assert.match(경고, /낡았다/, '판정만 내고 다음 세션이 읽을 말이 없다');
    assert.match(경고, /sess\.md/, '어디를 다시 열어야 하는지를 경고가 안 준다(F103)');

    /* ④ 줄이 통째로 치워진 갈래 — 아카이브 이관·파일 삭제. 침묵하면 그게 새는 방향이다. */
    fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'), 머리);
    assert.strictEqual(report.낡음(d, h).판정, '사라짐', '줄이 사라졌는데 「그대로」로 셌다');
    fs.rmSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'));
    assert.strictEqual(report.낡음(d, h).판정, '사라짐', '보드 파일이 없어졌는데 조용히 통과시켰다');

    /* ⑤ 대조할 사본이 애초에 없는 인계문(트랙 없이 끝난 세션·옛 바통)은 **null** —
     *   「못 쟀다」를 「바뀜」으로 번역하면 트랙 없는 세션마다 붉은 줄이 나간다. */
    const 없음 = 짓기('| 2026-08-12 | 남의 트랙 | z.js | ▶작업중 (`local_11112222`) — 남 |\n');
    assert.strictEqual(report.낡음(없음, report.buildHandoff(없음, null, { dirty: 0 })), null,
      '트랙 줄이 안 실린 인계문에 대조 판정을 냈다');
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

/* 🔴 F172 (2026-08-07) — 인계문 목차가 **반쪽으로 커밋됐다**.
 * `writeFileSync` 는 자른 뒤에 쓰는데, 그 창에서 수거 도구가 `git commit` 으로 스냅샷을 떠
 * 1b2f681 에 마지막 줄이 중간에서 끊긴 목차가 들어갔다(부모보다 **짧아졌다**). 내용은 폴더
 * 파생이라 다음 /close 가 덮어 복구되지만, 그 사이 목차를 여는 다른 계정·폰은 링크가 끊긴
 * 것을 본다 — F111 통로가 있는 이유가 그 열람이다. 세션 여럿이 상시 커밋하는 저장소라
 * 그 창은 언제든 다시 열린다. */
test('writeHandoffFile — 목차·세션 파일을 임시파일+rename 으로 갈아 끼운다 (F172)', () => {
  const d = 임시('synk-tb-f172-');
  const 목차 = report.writeHandoffFile(d, '첫 인계', { sessionId: 'local_aaaa1111' });
  assert.ok(목차 && fs.existsSync(목차), '목차를 못 만들었다');
  const 원본 = fs.readFileSync(목차, 'utf8');
  assert.match(원본, /첫 인계/, '첫 기록이 목차에 안 실렸다');

  // ① 임시 파일이 남으면 git 이 그걸 본다(그 자체가 새 오염이다).
  const 잔여 = (p) => fs.readdirSync(p).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(잔여(path.dirname(목차)), [], '목차 폴더에 임시 파일이 남았다');
  const 세션폴더 = path.join(path.dirname(목차), '인계문');
  assert.deepEqual(잔여(세션폴더), [], '세션 폴더에 임시 파일이 남았다');

  // ② 🔑 쓰기가 실패하면 **옛 목차가 그대로 남는다.** 임시 경로를 폴더로 막아 스테이징을
  //    실패시킨다 — 제자리 쓰기였다면 목차가 바뀐다(= 스냅샷이 반쪽을 볼 수 있는 상태).
  fs.mkdirSync(`${목차}.${process.pid}.tmp`);
  report.writeHandoffFile(d, '둘째 인계', { sessionId: 'local_bbbb2222' });
  assert.equal(fs.readFileSync(목차, 'utf8'), 원본,
    '🔴 목차를 제자리에서 덮어썼다 — 자르고-쓰는 창이 그대로다(F172)');

  // ③ 세션 파일 쪽은 막히지 않았으므로 정상 기록됐다(②가 통째 실패로 초록이 되면 안 된다).
  assert.ok(잔여 && fs.readdirSync(세션폴더).some((f) => f.startsWith('bbbb2222')),
    '둘째 세션 파일이 안 써졌다 — ②가 「아무것도 안 했다」로 통과했을 수 있다');

  // ④ **갈아 끼우기가 실패하면 임시 파일을 걷는다.** 남은 `.tmp` 는 미추적 파일이라
  //    그 자체가 새 오염이다(F025: 미추적은 이력·stash 어디에도 없는 유일한 무보호 상태).
  //    대상을 폴더로 만들면 tmp 쓰기는 성공하고 rename 만 실패한다 — 청소 경로가 그때 돈다.
  const d2 = 임시('synk-tb-f172b-');
  const 목차2 = report.writeHandoffFile(d2, '첫 인계', { sessionId: 'local_cccc3333' });
  fs.rmSync(목차2);
  fs.mkdirSync(목차2);
  report.writeHandoffFile(d2, '둘째 인계', { sessionId: 'local_dddd4444' });
  assert.deepEqual(잔여(path.dirname(목차2)), [],
    '🔴 갈아 끼우기가 실패한 뒤 임시 파일이 남았다 — 미추적 잔여물이 저장소에 쌓인다');
});

/* 원인을 **쓸 수 없게** 만든다 — 호출부마다 고치면 다음 호출부에서 되살아난다
 * (CLAUDE.md 신뢰성: 3번째는 옛 통로를 테스트로 금지). */
test('🔴 session-report 는 원자쓰기 밖에서 fs.writeFileSync 를 쓰지 않는다 (F172)', () => {
  const src = fs.readFileSync(path.join(HOOKS, 'lib', 'session-report.js'), 'utf8');
  const 개수 = (src.match(/fs\.writeFileSync\(/g) || []).length;
  assert.equal(개수, 1,
    `fs.writeFileSync 가 ${개수}곳이다 — 원자쓰기() 안의 1곳만 허용한다(나머지는 자르고-쓰는 창을 되살린다)`);
  assert.match(src, /function 원자쓰기[\s\S]{0,400}renameSync/,
    '원자쓰기가 rename 으로 갈아 끼우지 않는다 — 이름만 원자다');
});

test('board-id — 지문 규칙이 작업본소유자.짧게 와 갈라지지 않는다 (F165)', () => {
  const 보드id = require(path.join(HOOKS, 'lib', 'board-id.js'));
  const owner = require(path.join(ROOT, 'tools', '작업본소유자.js'));
  // 두 도구가 서로 다른 8자리를 쓰면 「내 줄」의 정의가 갈라지고, 갈라진 쪽 증상은 통과다.
  for (const id of ['local_3fd8f6db-8bee-47b1-a3d1-b156f732f5e9', 'local_a0b27c60-a3f8-48f9-8444-02a9724a61b2']) {
    assert.equal(보드id.지문(id), owner.짧게(id), `🔴 지문 규칙이 갈라졌다: ${id}`);
  }
  // 접두 없는 8자리는 커밋 해시와 생김새가 같다 — 지문으로 세면 남의 해시 줄이 내 줄이 된다.
  assert.deepEqual(보드id.줄의지문('| x | y | z | ✅종결(5e5b03f·a0b27c60) |'), [],
    '🔴 접두 없는 hex 를 지문으로 읽었다 — 남의 커밋 해시가 적힌 줄을 내 줄로 집는다');
  assert.deepEqual(보드id.줄의지문('작업중 (`local_a0b27c60`) · `local_11112222`'), ['a0b27c60', '11112222']);
});

test('writeHandoffFile — 파일로 남고, 최신 3개를 펴 보이되 밀려난 것도 안 버린다', () => {
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
  // 목차에 그대로 펴 보이는 것은 3개까지 — 유호님의 「맨 위 블록을 복사」 습관을 그대로 둔다.
  assert.equal((본문.match(/^## \d{4}-/gm) || []).length, 3, '펼침 3개 상한을 안 지켰다 — 목차가 무한히 자란다');
  // 🔑 유호님 확정(08-05 · F099 본안): **밀려나도 사라지지는 않는다.**
  //   옛 구조는 여기서 「첫째」가 지워지는 것을 정상으로 봤다. 그게 축출이었다 —
  //   칸(3)보다 살아있는 세션(실측 10)이 많으면 정상 종료만으로 남의 인계문이 사라진다.
  assert.ok(!/```\n첫째 인계문\n```/.test(본문), '펼침에서 안 내려갔다 — 최신 3개가 아니다');
  assert.ok(/\(인계문\/aaaaaaaa\.md\)/.test(본문),
    '🔴 밀려난 인계문이 목차에서 통째로 사라졌다 — 링크로라도 남아야 한다(F099 본안)');
  const 세션파일 = path.join(path.dirname(f1), '인계문', 'aaaaaaaa.md');
  assert.ok(fs.existsSync(세션파일),
    '🔴 세션별 파일이 지워졌다 — 남이 쓰기만 해도 내 인계문이 사라진다(F099 그 사고)');
  assert.match(fs.readFileSync(세션파일, 'utf8'), /첫째 인계문/, '세션 파일 내용이 비었다');

  // 빈 인계문은 파일을 건드리지 않는다(빈 블록이 맨 위를 차지하면 다음 세션이 그걸 문다)
  assert.equal(report.writeHandoffFile(d, '   ', { sessionId: 'e' }), null, '빈 인계문을 파일에 썼다');

  // 시각은 **로컬**이어야 한다 — UTC 면 한국에서 9시간 어긋나 유호님이 「방금 것」을 못 가린다
  const 올해 = new Date().getFullYear();
  const 시 = (본문.match(new RegExp('^## ' + 올해 + '-\\d\\d-\\d\\d (\\d\\d):', 'm')) || [])[1];
  assert.equal(시, String(new Date().getHours()).padStart(2, '0'), '🔴 인계문 시각이 로컬 시각이 아니다(UTC 로 찍혔다)');
});

/* 🔴 id 를 **모르는** 세션끼리 서로를 지웠다 (2026-08-07 실측: 폰 브랜치가 `_.md` 를 커밋했다 `ff2b2d3`).
 *   훅 셋은 payload 의 `session_id` 를 폴백으로 넘기지만 `/close`(tools/인계문.js)는 payload 가 없어
 *   `CLAUDE_CODE_HOST_SESSION_ID` 하나에 걸리는데, 폰 클라우드엔 그 변수가 없다. 그러면 파일명이
 *   `_` 하나로 접혀 **마지막에 끊은 세션만 남는다** — writeHandoffFile 이 없애려던 그 축출인데,
 *   하필 **인계가 유일한 통로인** 계정(대화 맥락이 안 넘어간다)에서만 산다. 증상은 언제나 「조용함」이다. */
test('writeHandoffFile — id 를 모르는 세션이 둘이어도 서로를 안 지운다 (폰 클라우드)', () => {
  const d = 임시('synk-tb-anon-');
  const 목차 = report.writeHandoffFile(d, '폰 첫 세션 인계문', { sessionId: '' });
  report.writeHandoffFile(d, '폰 둘째 세션 인계문', { sessionId: undefined });

  const 폴더 = path.join(path.dirname(목차), '인계문');
  const 본문 = fs.readFileSync(목차, 'utf8');
  assert.match(본문, /폰 첫 세션 인계문/,
    '🔴 앞 세션의 인계문이 사라졌다 — id 없는 세션들이 한 파일(`_.md`)을 나눠 쓴다');
  assert.match(본문, /폰 둘째 세션 인계문/, '뒤 세션의 인계문이 안 실렸다');
  assert.equal(fs.readdirSync(폴더).filter((f) => f.endsWith('.md')).length, 2,
    '🔴 세션별 파일이 하나로 접혔다 — 이름 층에 축출 경로가 그대로 있다');

  // 🔑 반대 방향도 같이 잠근다 — id 를 **아는** 세션은 여전히 자기 파일 하나만 갈아 끼운다.
  //    안 잠그면 「쓰기마다 새 파일」로 고쳐 놓고 목차가 무한히 자라도 이 검사는 초록이다.
  report.writeHandoffFile(d, '첫 판', { sessionId: 'local_aaaa1111' });
  report.writeHandoffFile(d, '둘째 판', { sessionId: 'local_aaaa1111' });
  assert.deepEqual(fs.readdirSync(폴더).filter((f) => f.startsWith('aaaa1111')), ['aaaa1111.md'],
    '🔴 id 가 있는데도 쓰기마다 파일이 늘었다');
  assert.match(fs.readFileSync(path.join(폴더, 'aaaa1111.md'), 'utf8'), /둘째 판/,
    '자기 파일이 안 갱신됐다');
});

/* 저장 정본을 git 밖에 두면 목차의 링크가 **다른 계정·폰에서 전부 깨진다** — 그 통로가 이 파일의
 * 존재 이유라, 「안 펴진 것도 안 버린다」는 약속이 조용히 거짓이 된다. CLAUDE.md: 저장소 안에
 * 있는데 무시되는 파일이 가장 위험하고, **근본 해법은 git 눈에 들이는 것 · 자격증명만 예외**다.
 * 옆 세션이 `.gitignore` 로 빼는 안을 냈고(2026-08-05 조율) 그 판단으로 접었으니, 다음 세션이
 * 다시 집지 않게 기계로 못박는다. 실저장소 검사라 거짓양성만 — git 이 없으면 skip 으로 드러낸다. */
test('🔴 docs/_ops/인계문/ 은 git 밖으로 나가면 안 된다 (목차 링크가 다른 계정에서 깨진다)', (t) => {
  // ⚠ **폴더로 물으면 영영 안 걸린다.** 실측(2026-08-05): 규칙을 실제로 심어 놓고도
  //   `check-ignore docs/_ops/인계문/` 은 status 1(=정상)을 냈고, 이미 **추적 중인** 파일로 물어도
  //   1이 나온다 — git 은 추적 파일에 무시 규칙을 적용하지 않는다. 두 표기 모두 「통과」로 보여서
  //   가드가 초록인 채 새는 형태였다(변이로 잡았다). 위험한 건 **앞으로 생길 새 세션 파일**이니
  //   그 자리를 그대로 묻는다 — 없는 경로도 규칙 매칭은 된다.
  const r = spawnSync('git', ['check-ignore', '-v', 'docs/_ops/인계문/__새세션이_생길_자리__.md'], {
    cwd: ROOT, encoding: 'utf8', timeout: 10000,
  });
  if (r.error) return t.skip(`git 을 못 불러 검사하지 않았다: ${r.error.message}`);
  // check-ignore: 0 = 무시됨(=사고), 1 = 무시 안 됨(정상), 그 외 = 오류
  if (r.status === 0) {
    assert.fail(`🔴 인계문 폴더가 무시 규칙에 걸렸다 — 목차 링크가 다른 계정·폰에서 전부 깨진다:\n${r.stdout.trim()}`);
  }
  assert.equal(r.status, 1, `git check-ignore 가 예상 밖으로 끝났다(status=${r.status}): ${r.stderr.trim()}`);
});

/* F099 본안(유호님 확정 08-05) — 이 저장소의 실제 조건: 살아있는 세션이 **10개**인데
 * 옛 구조의 칸은 3개였다. 그래서 「정상 종료」만으로도 남의 인계문이 사라졌다(실측 86초 만에
 * 세 칸 전부 갈림). 세션 수가 칸 수를 넘겨도 **아무도 잃지 않는다**를 못박는다 —
 * 이게 안 지켜지면 계정 간 인계라는 이 파일의 존재 이유가 무너진다. */
test('🔴 writeHandoffFile — 세션 10개가 써도 축출 0 (칸보다 세션이 많은 게 이 저장소의 상시 조건)', () => {
  const d = 임시('synk-tb-noevict-');
  const ids = Array.from({ length: 10 }, (_, i) => `sess${String(i).padStart(4, '0')}`);
  let f = null;
  for (const id of ids) f = report.writeHandoffFile(d, `${id} 의 인계문`, { sessionId: id });

  const 폴더 = path.join(path.dirname(f), '인계문');
  for (const id of ids) {
    const p = path.join(폴더, `${id}.md`);
    assert.ok(fs.existsSync(p), `🔴 ${id} 의 인계문이 사라졌다 — 남이 쓰기만 해도 내 바통이 없어진다`);
    assert.match(fs.readFileSync(p, 'utf8'), new RegExp(`${id} 의 인계문`), `${id} 파일 내용이 어긋난다`);
  }

  // 목차는 전부를 **가리킨다** — 펴 보이든 링크든, 10개가 다 닿아야 한다.
  const 목차 = fs.readFileSync(f, 'utf8');
  for (const id of ids) {
    assert.ok(목차.indexOf(id) !== -1, `🔴 목차에서 ${id} 로 가는 길이 없다 — 파일은 있는데 못 찾으면 없는 것과 같다`);
  }
  assert.equal((목차.match(/^## \d{4}-/gm) || []).length, 3, '펼침이 3개가 아니다(복붙 습관이 깨진다)');
});

/* 구조를 고치는 변경이 그 구조가 지키던 것을 부수는 자리 — 목차를 폴더에서 파생시키는데
 * 폴더가 비어 있으면 첫 쓰기가 옛 블록 3개를 통째로 밀어낸다. 이 이주는 **한 번뿐이고
 * 되돌릴 수 없어서**(옛 블록은 다른 어디에도 없다) 회귀로 못박는다. */
test('🔴 writeHandoffFile — 옛 한 파일 구조의 인계문을 세션별 파일로 이주시킨다(착지 순간 증발 방지)', () => {
  const d = 임시('synk-tb-migrate-');
  const dir = path.join(d, 'docs', '_ops');
  fs.mkdirSync(dir, { recursive: true });
  const 목차 = path.join(dir, '인계문.md');
  // ⚠ 머리의 시각은 **지금**에서 만든다 — 날짜를 박아 두면 TTL(12시간)이 지나는 순간 이주분이
  //   곧바로 prune 돼 이 시험이 스스로 빨개진다(f0000ae 가 같은 자리에서 CI 를 빨갛게 했다).
  const n = new Date();
  const p2 = (x) => String(x).padStart(2, '0');
  const 오늘 = `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())} ${p2(n.getHours())}:${p2(n.getMinutes())}`;
  // 옛 형식 그대로 — 세션별 파일은 하나도 없는 상태
  fs.writeFileSync(목차, '# 다음 세션 인계문 (자동 생성 · 최근 3개)\n\n'
    + ['aaaa1111', 'bbbb2222', 'cccc3333']
      .map((s) => `## ${오늘} · 세션 ${s} · 세션 정리\n\n\`\`\`\n${s} 의 옛 인계문\n\`\`\`\n`)
      .join('\n'));

  report.writeHandoffFile(d, '새 구조 첫 인계문', { sessionId: 'dddd4444' });

  for (const s of ['aaaa1111', 'bbbb2222', 'cccc3333']) {
    const p = path.join(dir, '인계문', `${s}.md`);
    assert.ok(fs.existsSync(p), `🔴 옛 인계문 ${s} 가 이주되지 않았다 — 바꾸는 순간 살아있는 인계문이 증발한다`);
    assert.match(fs.readFileSync(p, 'utf8'), new RegExp(`${s} 의 옛 인계문`), `${s} 이주 내용이 어긋난다`);
  }
  // 이주분 3 + 새것 1 = 4개가 모두 목차에서 닿아야 한다
  const 본문 = fs.readFileSync(목차, 'utf8');
  for (const s of ['aaaa1111', 'bbbb2222', 'cccc3333', 'dddd4444']) {
    assert.ok(본문.indexOf(s) !== -1, `🔴 목차에서 ${s} 로 가는 길이 없다`);
  }

  // **두 번 돌아도 덮지 않는다** — 이주가 그 세션의 최신 인계문을 옛것으로 되돌리면 안 된다.
  report.writeHandoffFile(d, 'aaaa1111 의 새 인계문', { sessionId: 'aaaa1111' });
  report.writeHandoffFile(d, '또 다른 세션', { sessionId: 'eeee5555' });
  assert.match(fs.readFileSync(path.join(dir, '인계문', 'aaaa1111.md'), 'utf8'), /aaaa1111 의 새 인계문/,
    '🔴 이주가 최신 인계문을 옛 블록으로 되돌렸다 — 옛것이 새것을 덮는다');
});

test('writeHandoffFile — 같은 세션이 다시 쓰면 **교체**된다(3칸을 혼자 차지하지 않는다)', () => {
  const d = 임시('synk-tb-dedupe-');
  report.writeHandoffFile(d, '남의 트랙 인계문', { sessionId: 'other111' });
  report.writeHandoffFile(d, '내 첫판', { sessionId: 'mine2222' });
  const f = report.writeHandoffFile(d, '내 최신판', { sessionId: 'mine2222' });
  const 본문 = fs.readFileSync(f, 'utf8');
  assert.ok(/내 최신판/.test(본문), '최신판이 없다');
  assert.ok(!/내 첫판/.test(본문),
    '🔴 같은 세션의 옛 블록이 남았다 — 한 세션이 여러 번 쓰면(🔴→경계→종료) 3칸을 다 차지해 남의 트랙을 밀어낸다(F096 실사고)');
  assert.ok(/남의 트랙 인계문/.test(본문), '🔴 남의 블록이 밀려났다 — 교체가 아니라 축출이 됐다');
  assert.equal((본문.match(/^## /gm) || []).length, 2, '블록 수가 어긋난다(남의 것 1 + 내 것 1이어야 한다)');
});

test('writeHandoffFile — 워크트리에서 불러도 **메인** 저장소 파일에 쓴다 (같은 함정 4번째 입구)', (t) => {
  const g = (a, c) => spawnSync('git', a, { cwd: c, encoding: 'utf8', timeout: 15000 });
  if (g(['--version']).error) return t.skip('git 없음');
  const 메인 = 임시('synk-tb-wtmain-');
  g(['init', '-q'], 메인);
  g(['config', 'user.email', 't@t'], 메인);
  g(['config', 'user.name', 't'], 메인);
  fs.writeFileSync(path.join(메인, 'a.txt'), 'x');
  g(['add', 'a.txt'], 메인);
  g(['commit', '-qm', 'init'], 메인);
  const 워크 = path.join(메인, '.claude', 'worktrees', 'wt1');
  const 만듦 = g(['worktree', 'add', '-q', 워크], 메인);
  if (만듦.status !== 0) return t.skip('git worktree 불가 — 이 환경에서 검사 못 함(통과로 위장하지 않는다)');

  const f = report.writeHandoffFile(워크, '워크트리에서 쓴 인계문', { sessionId: 'wtsess' });
  assert.ok(f, '워크트리 cwd 에서 파일을 못 썼다');
  const 실경로 = (p) => { try { return fs.realpathSync(p).toLowerCase(); } catch (_) { return path.resolve(p).toLowerCase(); } };
  assert.equal(실경로(f), 실경로(path.join(메인, 'docs', '_ops', '인계문.md')),
    `🔴 메인이 아니라 ${f} 에 썼다 — 유호님이 여는 파일과 다른 자리라 인계문이 유령이 된다(바통 워크트리 유실과 같은 형태)`);
});

test('tools/인계문.js — stdout 전문이 그대로 「새 세션 첫 메시지」다', () => {
  const TOOL = path.join(ROOT, 'tools', '인계문.js');
  assert.ok(fs.existsSync(TOOL), '🔴 tools/인계문.js 가 없다 — wake·/close 가 가리키는 실행층이 비었다(F053 형태)');
  const d = 임시('synk-tb-tool-');
  const r = 훅띄우기(TOOL, {   // 실패 종료도, 안 뜬 것도 통로가 드러낸다
    cwd: d, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 'tool-test-sess' },
  });
  assert.match(r.stdout, /^SYNK 이어서 작업한다/, 'stdout 머리가 인계문이 아니다 — 복붙하면 지시문이 아닌 것이 들어간다');
  assert.ok(!/── 다음 세션 인계문 ──/.test(r.stdout), 'stdout 에 장식 테두리가 섞였다 — 복붙 지시문이 오염된다');
  assert.ok(fs.existsSync(path.join(d, 'docs', '_ops', '인계문.md')), '파일 사본을 안 남겼다 — 파일 통로(다른 계정·폰)가 빈다');
});

/* 사본 파일은 칸이 3개뿐이고 **세션들이 공유한다.** 그래서 점검차 한 번 돌리는 것만으로도
 * 내 블록이 맨 위로 들어가며 가장 오래된 남의 블록을 밀어낸다 — 2026-08-05 실측: 확인차
 * 돌렸더니 살아있는 옆 세션의 블록이 파일에서 사라졌고, 그때 store 바통은 take() 로 이미
 * 비어 있어 **그 파일이 마지막 사본이었다.** 막 시작한 세션은 커밋도 보드 줄도 없어 블록이
 * 사실상 비는데, 그 빈 블록이 「맨 위를 복사하라」고 적힌 자리를 차지한다(F096 재현).
 * 탐지력은 픽스처로 못박는다 — 실저장소 파일은 건드리지 않는다. */
test('tools/인계문.js --no-save — 남의 블록을 밀어내지 않는다(점검이 인계를 지우면 안 된다)', () => {
  const TOOL = path.join(ROOT, 'tools', '인계문.js');
  const d = 임시('synk-tb-nosave-');
  const 사본 = path.join(d, 'docs', '_ops', '인계문.md');
  fs.mkdirSync(path.dirname(사본), { recursive: true });

  // 살아있는 남의 세션 3칸을 미리 채워 둔다 — 한 칸이라도 밀리면 실패해야 한다.
  const 원본 = '# 다음 세션 인계문 (자동 생성 · 최근 3개)\n\n'
    + ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']
      .map((s) => `## 2026-08-05 00:00 · 세션 ${s} · 세션 정리\n\n\`\`\`\n남의 트랙 ${s}\n\`\`\`\n`)
      .join('\n');
  fs.writeFileSync(사본, 원본);

  const r = 훅띄우기([TOOL, '--no-save'], {   // 실패 종료도, 안 뜬 것도 통로가 드러낸다
    cwd: d, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 'nosave-test-sess' },
  });
  // 복붙 통로는 살아 있어야 한다 — 안 쓰는 대신 화면 출력까지 죽으면 처방이 통째로 빈다.
  assert.match(r.stdout, /^SYNK 이어서 작업한다/, '--no-save 가 stdout 까지 죽였다 — 복붙할 실물이 사라진다(F096 그 증상)');
  assert.equal(fs.readFileSync(사본, 'utf8'), 원본,
    '🔴 --no-save 인데 공유 사본을 건드렸다 — 점검 한 번이 살아있는 남의 인계문을 지운다(store 바통이 비면 그 파일이 마지막 사본이다)');
});

/* 모르는 인자는 실행이 아니라 정지다 — 2026-08-14 실측: `--help` 를 받은 채 그대로 «실행»돼
 * 산 세션의 가짜 「마감」 인계문이 목차 맨 위(「여기를 복사하라」 자리)를 차지했다. --no-save 가
 * 연 문(점검 통로)의 옆문이다: 플래그 오타·탐색 호출이 곧 파일 쓰기가 된다.
 * 탐지력은 픽스처로 못박는다 — 실저장소 파일은 건드리지 않는다. */
test('tools/인계문.js 모르는 인자 — 아무것도 안 쓰고 멈춘다(탐색 호출이 가짜 마감 인계문을 굽는 자리)', () => {
  const TOOL = path.join(ROOT, 'tools', '인계문.js');
  const d = 임시('synk-tb-unknown-');
  const r = 훅띄우기([TOOL, '--help'], {
    cwd: d, encoding: 'utf8', timeout: 20000, 통과코드: [1],
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 'unknown-flag-sess' },
  });
  assert.ok(!fs.existsSync(path.join(d, 'docs', '_ops', '인계문.md')),
    '🔴 모르는 인자인데 사본을 구웠다 — 산 세션의 가짜 마감 인계문이 「여기를 복사하라」 자리에 앉는다(2026-08-14 실측)');
  /* ⚠ 낱말이 둘인 이유: 판정이 **공용 통로**(`tools/lib/인자게이트.js`)로 옮겨 갔다(2026-08-18).
   *   통로는 `--` 낱말을 「모르는 플래그」라 부르고, 이 도구가 따로 세는 위치 인자는 「모르는 인자」다.
   *   재는 축은 그대로 «거부 사유가 보이나»이고, 아래 한 줄을 **더 세게** 잠갔다 —
   *   사유만 있고 처방이 없으면 우회가 정상 통로가 된다(F103). */
  assert.match(r.stderr, /모르는 (인자|플래그)/, '거부 사유가 안 보인다 — 부르는 쪽이 무엇을 고칠지 모른다');
  assert.match(r.stderr, /--no-save/, '아는 낱말을 안 보여주면 처방 없는 차단이다 — 부르는 쪽이 무엇을 쓸지 모른다(F103)');
});

/* ── 죽음 도장(`끝남`)은 «/close 통로»에서만 찍힌다 (F447 · 2026-08-15) ─────────────
 * 무엇이 고장나 있었나: 도장이 SessionEnd 훅에만 있어서, `/close` 를 다 돌고도 **창이 열려
 *   있는 동안은** 그 세션이 board-guard 에게 「살아있다」로 읽혔다. 그래서 제 인계문이 시킨
 *   다음 걸음을 다음 세션이 못 집었다 — 인계 통로가 자기 처방을 스스로 막는다(맹점 ③).
 * ⚠ F447 은 「도장이 **없다**」로 적었지만 재실측은 다르다: 인계문 57건 중 무도장 **0건**
 *   (도장 53 + 만진 기록 자체가 없는 세션 4). 창을 닫으면 SessionEnd 가 뒤늦게 찍는다 —
 *   **없는 게 아니라 늦는다.** 그래서 이 회귀가 잠그는 것은 「찍히나」가 아니라 «언제»다.
 * 🔑 세 방향을 같은 무게로 못박는다(통과 목록도 차단 목록과 같은 무게 — CLAUDE.md):
 *   ㉠ 저장 모드는 찍는다 ㉡ `--no-save`(점검)는 안 찍는다 ㉢ **인계문을 쓰는 다른 통로는
 *   안 찍는다.** ㉢ 이 급소다 — 도장을 공용 writer(`writeHandoffFile`)로 올리면 세 통로가
 *   한꺼번에 통과하는데, 그중 둘(`context-budget` 🔴 wake · `track-boundary`)은 **살아서
 *   계속 도는** 세션이 부르는 자리라 산 세션의 작업본이 ⚪ 유물로 떨어진다(F252 그 사고).
 * 탐지력은 픽스처로 못박는다 — 실저장소 상태 폴더는 건드리지 않는다. */
function 만진기록두기(state, cwd, sid) {
  const store = require(path.join(HOOKS, 'lib', 'handoff-store.js'));
  // 이름 규칙은 track-collision 이 쓰는 것과 같다 — 도장은 **기존 파일에만** 찍힌다.
  const p = path.join(state, `track-${store.projectKey(cwd)}-${store.safeId(sid)}.json`);
  fs.writeFileSync(p, JSON.stringify({ baseline: 'x', touched: { 'a.js': 1 }, at: Date.now() }));
  return p;
}
/** 상태 폴더를 통째로 읽어 도장을 센다 — 경로를 손으로 맞히면 «못 찾아서 초록»이 난다. */
function 도장들(state) {
  return fs.readdirSync(state).filter((f) => f.startsWith('track-')).map((f) => {
    let j = {}; try { j = JSON.parse(fs.readFileSync(path.join(state, f), 'utf8')); } catch (_) { /* 깨진 건 무도장으로 센다 */ }
    return { f, 끝남: j.끝남 };
  });
}

test('🔴 tools/인계문.js 저장 모드 — 인계문과 **같은 걸음**에서 죽음 도장을 찍는다 (F447)', () => {
  const TOOL = path.join(ROOT, 'tools', '인계문.js');
  const d = 임시('synk-tb-stamp-');
  const state = 임시('synk-tb-stampst-');
  const sid = 'stamp-close-sess';
  만진기록두기(state, d, sid);

  훅띄우기(TOOL, {
    cwd: d, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, SYNK_CTXBUDGET_DIR: state, CLAUDE_CODE_HOST_SESSION_ID: sid },
  });

  const 잰것 = 도장들(state);
  assert.equal(잰것.length, 1, `상태 폴더에 track 파일이 1개가 아니다(${잰것.length}) — 이 시험이 엉뚱한 것을 재고 있다`);
  assert.ok(Number(잰것[0].끝남) > 0,
    '🔴 /close 가 인계문을 쓰고도 도장을 안 찍었다 — 창이 열려 있는 동안 이 세션은 「살아있다」로 읽혀,'
    + ' 제 인계문이 시킨 다음 걸음을 다음 세션이 못 집는다(F447 실사고: 세션 하나가 P1 트랙을 포기했다)');
});

test('🔴 tools/인계문.js --no-save — 점검은 도장을 안 찍는다 (산 세션을 죽이면 안 된다)', () => {
  const TOOL = path.join(ROOT, 'tools', '인계문.js');
  const d = 임시('synk-tb-nostamp-');
  const state = 임시('synk-tb-nostampst-');
  const sid = 'nosave-stamp-sess';
  만진기록두기(state, d, sid);

  훅띄우기([TOOL, '--no-save'], {
    cwd: d, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, SYNK_CTXBUDGET_DIR: state, CLAUDE_CODE_HOST_SESSION_ID: sid },
  });

  const 잰것 = 도장들(state);
  assert.equal(잰것.length, 1, `상태 폴더에 track 파일이 1개가 아니다(${잰것.length}) — 이 시험이 엉뚱한 것을 재고 있다`);
  assert.strictEqual(잰것[0].끝남, undefined,
    '🔴 점검(--no-save)이 도장을 찍었다 — 「인계문 다시 보기」 한 번에 산 세션의 미커밋이 ⚪(이어받아도 된다)로 떨어진다(F252 재현)');
});

test('🔴 track-boundary(살아서 계속 도는 세션)는 도장을 안 찍는다 — 도장을 공용 writer 로 올리면 여기가 샌다', () => {
  const state = 임시('synk-tb-livest-');
  const cwd = 임시('synk-tb-livecwd-');
  const sid = 'live-boundary-sess';
  만진기록두기(state, cwd, sid);

  const r = 돌려({
    tool_name: 'Bash', tool_input: { command: 'git commit -m "x" -- a.md' },
    cwd, session_id: sid, tool_response: 성공, transcript_path: 트랜스크립트(400_000),
  }, state);
  assert.equal(r.발화, true, '전제가 깨졌다 — 훅이 발화를 안 해서 이 시험은 아무것도 안 재고 있다');
  assert.ok(fs.existsSync(path.join(cwd, 'docs', '_ops', '인계문.md')),
    '전제가 깨졌다 — 훅이 인계문을 안 썼다(그럼 「썼는데 도장은 안 찍었다」를 못 잰다)');

  const 잰것 = 도장들(state);
  assert.equal(잰것.length, 1, `상태 폴더에 track 파일이 1개가 아니다(${잰것.length}) — 이 시험이 엉뚱한 것을 재고 있다`);
  assert.strictEqual(잰것[0].끝남, undefined,
    '🔴 트랙 경계에서 도장이 찍혔다 — 이 세션은 계속 일하는데 그 작업본이 ⚪ 유물이 된다.'
    + ' 도장은 «인계문을 쓰는 것»이 아니라 «창을 닫는 것»에 붙어야 한다(F447 · F252)');
});

/* 장치와 발동 조건은 같은 커밋에서 — 플래그만 만들고 처방이 안 가리키면 아무도 안 쓴다.
 *
 * ⚠ **재는 파일이 옮겨졌다: `context-budget.js` → `/close` 스킬** (F353 · 2026-08-12).
 *   F349 수리(`f7e89e3c`)가 컨텍스트 경고 화면을 «3줄 · 빈 줄 0»으로 기계 고정하면서 거기 살던
 *   인계 목차 4줄을 지웠고, 이 처방도 그 안에 있어 함께 사라졌다. 되돌리면 안 된다 —
 *   `tests/컨텍스트예산.test.js` 가 그 화면에 `--no-save` 가 «있으면» 빨개진다(그쪽 금지 목록에
 *   그 글자가 박혀 있다). 두 회귀가 한 파일을 반대 방향으로 잡고 있었던 것이 F353 이다.
 *   🔑 그래서 처방은 «화면»이 아니라 **사람이 끊을 때 실제로 읽는 문서**에 산다. 화면 쪽 통로가
 *     비지 않는 것은 그쪽 회귀가 따로 잰다(`/close`·`인계문.js` 중 하나를 가리키는지).
 *   🚫 이 검사를 `context-budget.js` 로 되돌리는 것 · 🚫 코드 «주석»으로 통과시키는 것
 *     (주석은 유호님이 읽는 자리가 아니라, 그러면 이 검사가 영구히 무의미해진다). */
test('🔴 처방-실행층 결속 — 「수동 재출력」 안내는 --no-save 를 준다', () => {
  const 본문 = fs.readFileSync(path.join(ROOT, '.claude', 'skills', 'close', 'SKILL.md'), 'utf8');
  const m = 본문.match(/수동 재출력 `([^`]+)`/);
  assert.ok(m, '「수동 재출력」 안내가 사라졌다 — 유호님이 다시 뽑을 통로가 빈다');
  assert.match(m[1], /--no-save/,
    `🔴 재출력 처방이 사본을 갱신한다(${m[1]}) — 점검하러 돌린 한 번이 남의 인계문을 밀어낸다`);
});

test('🔴 처방-실행층 결속 — wake·/close·블록 지시가 가리키는 인계문 도구가 실재한다', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', '인계문.js')), '도구 실물이 없다');
  // ⚠ 두 훅의 블록 지시문은 **lib/session-report.js(blockOrder)** 하나에서 파생된다(F122).
  //   훅 파일 본문을 뒤지면 파생 뒤에는 영영 못 찾는다 — 출처를 따라간다.
  /* ⚠ `context-budget.js` 는 **일부러 빠졌다**(F353 · 2026-08-12). F349 가 그 화면을 3줄로
   *   고정하며 인계 목차를 지웠고, `tests/컨텍스트예산.test.js` 가 그 부재를 «기계로» 요구한다 —
   *   여기 되살리면 두 회귀가 서로를 깨고 어느 쪽도 초록이 될 수 없다. 화면이 통로를 아예
   *   안 가리키는 것은 그쪽 회귀가 막는다(`/close`·`인계문.js` 중 하나를 요구).
   *   🚫 이 목록에 훅 파일을 다시 넣기 — 지울 이유가 목차 부재 요구와 정면으로 부딪친다. */
  for (const [파일, 이름] of [
    [path.join(HOOKS, 'lib', 'session-report.js'), 'blockOrder(두 훅의 블록 지시 원천)'],
    [path.join(ROOT, '.claude', 'skills', 'close', 'SKILL.md'), '/close 스킬'],
  ]) {
    assert.ok(fs.readFileSync(파일, 'utf8').indexOf('node tools/인계문.js') !== -1,
      `${이름} 이 인계문 출력 도구를 안 가리킨다 — 지시문구가 화면에 나오는 경로가 끊긴다(F096)`);
  }
});

/* F122 (유호님 08-06 교정: "마지막쯤 한번, 마지막에 또 한번") — 블록을 지시하는 훅이 **둘**이고
 * 임계가 같은 값(300k)이라 한 세션에서 둘 다 운다. 서로를 모른 채 각자 「코드 블록으로 붙여라」를
 * 시켜서 같은 블록이 두 번 나갔다. 상태를 handoff-store 한 곳에 두고 못박는다.
 *
 * **양쪽 순서를 다 검사한다** — 어느 쪽이 먼저 우는지는 커밋이 턴 어디에 떨어지느냐에 달렸고
 * 고정돼 있지 않다. 한 순서만 검사하면 반대 순서로 조용히 두 번 나간다. */
test('🔴 F122 — 두 훅이 같은 세션에서 울어도 인계문 블록은 한 번만 지시된다', () => {
  const CB = path.join(HOOKS, 'context-budget.js');
  const 커밋 = { tool_name: 'Bash', tool_input: { command: 'git commit -m "x" -- a.md' }, tool_response: 성공 };

  const 예산 = (cwd, sid, st) => {
    const r = 훅띄우기(CB, {
      input: JSON.stringify({ session_id: sid, hook_event_name: 'Stop', transcript_path: 트랜스크립트(400_000), cwd }),
      encoding: 'utf8', cwd, timeout: 20000,
      env: { ...process.env, SYNK_CTXBUDGET_DIR: st, CLAUDE_CODE_HOST_SESSION_ID: '' },
    });
    const j = JSON.parse(String(r.stdout || '{}'));
    // AI 를 움직이는 것은 additionalContext 뿐이다 — systemMessage(유호님 화면)는 다른 채널이다
    return (j.hookSpecificOutput && j.hookSpecificOutput.additionalContext) || '';
  };
  const 경계 = (cwd, sid, st) => 돌려({ ...커밋, cwd, session_id: sid, transcript_path: 트랜스크립트(400_000) }, st).본문;

  const 블록수 = (s) => (String(s).match(/── 다음 세션 인계문 ──/g) || []).length;
  const A = '17027542-8024-46b6-932b-559733264a1e';
  const B = '7dd54149-844f-4dc1-893a-e2f470207d85';

  for (const [이름, 먼저, 나중] of [['경계→예산', 경계, 예산], ['예산→경계', 예산, 경계]]) {
    const st = 임시('synk-f122-'); const cwd = 임시('synk-f122-cwd-');
    const 첫 = 먼저(cwd, A, st);
    const 둘 = 나중(cwd, A, st);

    assert.equal(블록수(첫) + 블록수(둘), 1,
      `🔴 ${이름}: 한 세션에서 인계문 블록이 ${블록수(첫) + 블록수(둘)}번 지시됐다 — 유호님 화면에 같은 블록이 두 번 나간다(F122 그 증상)`);
    assert.equal(블록수(첫), 1, `🔴 ${이름}: 먼저 운 훅이 블록을 안 냈다 — 복사할 실물이 화면에 없다(F096)`);
    // 두 번째는 **침묵이 아니다** — 블록만 빠지고 「이미 지시됐다」는 알려야 한다.
    //   통째로 조용해지면 첫 지시를 AI 가 흘렸을 때 인계가 통째로 빈다.
    assert.ok(둘.trim().length > 0, `🔴 ${이름}: 두 번째 훅이 통째로 침묵했다 — 첫 지시를 흘리면 인계가 없다`);
    assert.match(둘, /이미 지시됐다/, `🔴 ${이름}: 두 번째 훅이 블록도 안 내고 이유도 안 알린다 — AI 가 빠진 걸 결함으로 읽는다`);

    // 옆 세션은 제 몫을 받는다 — 억제가 세션을 안 가르면 남의 세션이 통째로 침묵한다
    assert.equal(블록수(먼저(cwd, B, st)), 1,
      `🔴 ${이름}: 억제가 세션을 안 갈랐다 — 옆 세션의 인계문이 통째로 사라진다(바통 전역 1개였던 그 결함과 같은 형태)`);
  }
});

/* claimBlock 은 **부작용이 있는 판정**이다(부르면 표식이 탄다). 지시를 내지 않는 발화가
 * 표식을 태우면 정작 지시해야 할 훅이 침묵한다 — 증상은 「인계문이 아예 안 나옴」이다. */
test('🔴 F122 — 깨우지 않는 발화는 블록 표식을 태우지 않는다', () => {
  const CB = path.join(HOOKS, 'context-budget.js');
  const st = 임시('synk-f122-warn-'); const cwd = 임시('synk-f122-warncwd-');
  const sid = '2f9a7c31-0d55-4a1e-9f2c-6b8e4d0a7c11';
  const 돌림 = (ctx) => {
    const r = 훅띄우기(CB, {
      input: JSON.stringify({ session_id: sid, hook_event_name: 'Stop', transcript_path: 트랜스크립트(ctx), cwd }),
      encoding: 'utf8', cwd, timeout: 20000,
      env: { ...process.env, SYNK_CTXBUDGET_DIR: st, CLAUDE_CODE_HOST_SESSION_ID: '' },
    });
    const j = JSON.parse(String(r.stdout || '{}'));
    return (j.hookSpecificOutput && j.hookSpecificOutput.additionalContext) || '';
  };
  assert.equal(돌림(210_000), '', '🟡 에서 AI 를 깨웠다 — 아직 정리할 때가 아니다');
  assert.match(돌림(310_000), /── 다음 세션 인계문 ──/,
    '🔴 🟡 발화가 블록 표식을 미리 태웠다 — 정작 🔴 에서 블록이 안 나온다(침묵은 중복보다 나쁘다)');
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

/* ── 🔴 F529 (2026-08-17) — 인계문이 **워크트리 가지 안의 보드 선언**을 못 본다 ───────────────
 *
 * 실사고: 세션 `24ba4d6b` 는 10:04 에 가지 안에서 보드를 선언하고, PR #24 를 「변이 미검증 1건」인
 *   채 열어 두고 마감했다. 4분 뒤 쓰인 그 세션의 인계문은 «▶ 트랙 없이 끝난 세션이다 — 추정이
 *   아니라 실측이다 … 보드를 다시 열 필요 없다» 였다. 08-15 확정 「코드 트랙은 워크트리+PR」의
 *   순서가 ①EnterWorktree ②보드 선언이라, **모든 코드 트랙의 선언이 가지 안에 앉는다.**
 *
 * 🔑 이 병이 F521(대기열)·F528(board-guard)보다 나쁜 이유: 인계문은 다음 세션의 **첫 입력**이라
 *   「다시 열 필요 없다」가 못 보는 것을 넘어 **안 보게 만든다.** 실측 2026-08-17 수리 직전:
 *   가지에 선언한 세션 **10 중 10** 이 master 보드에 줄 0 — 사각은 부분이 아니라 전멸이었다.
 *
 * ⚠ 탐지력은 **픽스처로** 못박는다(F296·가드 맹점 ②) — 실저장소의 열린 가지 수에 기대면
 *   PR 이 다 머지된 날 이 시험이 조용히 아무것도 안 재게 된다. */
/* 모양은 **정본에서 가져온다**(`가지끝줄`) — 여기 손으로 베끼면 두 벌이 되고, 갈라진 쪽의 증상은
 * 언제나 「통과」다(맹점 ④). 실제로 그랬다: 이 줄은 옛 표식 `~보드가지~` 를 리터럴로 들고 있었다. */
const 가지픽스처 = (가지, 파일, ...줄들) => {
  const 보드lib = require(path.join(__dirname, '..', 'tools', 'lib', '보드.js'));
  return 줄들.map((l) => 보드lib.가지끝줄(가지, 파일, l)).join('\n');
};

const 보드폴더 = (prefix, 파일, 본문) => {
  const d = 임시(prefix);
  fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
  if (파일) fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 파일),
    '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n' + (본문 || ''));
  return d;
};

test('boardTrack — 워크트리 «가지 안»의 보드 선언을 찾는다 (F529 · 실측 10/10 전멸)', () => {
  // master 에는 **남의 줄만** 있다 — 실측 10건이 전부 이 모양이었다(내 줄 0).
  const d = 보드폴더('synk-tb-f529a-', 'ffffffff.md',
    '| 2026-08-17 | 남의 트랙 | a.js | 작업중 (`local_ffffffff`) — 남이 하는 일 |\n');
  const 나 = 'local_24ba4d6b-1111-2222-3333-444455556666';
  const 가지출력 = 가지픽스처('worktree-board-rows-denominator', '24ba4d6b.md',
    '| 2026-08-17 | **보드 전체 상한도 셀 수 있는 줄만 센다** | board-guard.js | 착수 (`local_24ba4d6b`) — 다음=변이 재실행 후 머지 |');

  /* ① 먼저 **옛 사각을 재현**한다 — 가지를 안 보면 null 이고, 그 null 이 「트랙 없이 끝났다」로
   *   번역됐다. 이게 안 서면 아래 초록은 탐지력을 못 잰다(가드 맹점 ②). */
  assert.equal(report.boardTrack(d, [], 나, { 가지: { 줄들: [], 모름: false } }), null,
    '픽스처가 옛 사각을 재현하지 못한다 — 이 시험은 아무것도 못 잰다');

  const 찾음 = report.boardTrack(d, [], 나, { 가지출력 });
  assert.ok(찾음 && /보드 전체 상한/.test(찾음.track),
    `🔴 가지 안의 내 선언을 못 찾았다 — F529 가 그대로다(다음 세션이 갇힌 트랙을 버린다): ${JSON.stringify(찾음)}`);
  assert.match(찾음.state, /변이 재실행/, '상태 칸(=다음 할 일)을 안 가져왔다 — 주소만 있고 내용이 없으면 인계가 아니다');
  assert.equal(찾음.가지, 'worktree-board-rows-denominator',
    '🔴 어느 가지인지를 안 실었다 — 위 「원본 …」 경로는 master 에 없어서, 가지 이름이 없으면 받은 세션은 열 곳이 없다');

  /* ② 반대 방향 — 가지 층이 F338·F073 을 되돌리면 안 된다. 남의 가지 줄은 내 지문·내 해시를
   *   인용해도 내 트랙이 아니다(master 에서 막아 둔 것을 새 층이 뚫으면 그게 회귀다). */
  assert.equal(report.boardTrack(d, [], 'local_99998888-0000-0000-0000-000000000000', { 가지출력 }), null,
    '🔴 남의 가지 줄을 내 트랙으로 집었다 — 가지 층이 F073·F338 을 되돌렸다');
});

test('boardTrack — master 에 내 줄이 있으면 가지 층을 **부르지도 않는다** (F529 수리의 대가)', () => {
  const 나 = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  const d = 보드폴더('synk-tb-f529b-', 'ba86eeb2.md',
    '| 2026-08-17 | 내 master 트랙 | a.js | 작업중 (`local_ba86eeb2`) — 다음=회귀 |\n');

  /* `보드.가지줄들` 은 git 스폰 1회(실측 226~486ms)다 — master 에서 이미 찾았는데도 매번 부르면
   *   마감 경로가 그만큼 느려진다. 「안 부른다」를 **글자가 아니라 접근으로** 잰다. */
  let 봤나 = false;
  const 감시 = { get 줄들() { 봤나 = true; return []; }, 모름: false };
  const 찾음 = report.boardTrack(d, [], 나, { 가지: 감시 });
  assert.ok(찾음 && /내 master 트랙/.test(찾음.track), 'master 줄을 못 찾았다 — 옛 판정이 깨졌다');
  assert.equal(찾음.가지, undefined, 'master 줄에 가지 이름이 붙었다 — 없는 가지를 가리킨다');
  assert.equal(봤나, false, '🔴 master 에서 찾고도 가지 층을 훑었다 — 마감마다 git 스폰 한 번이 공짜로 붙는다');
});

test('인계문 — 가지에서 찾은 줄은 «어느 가지인지»와 F403 을 달고 나간다 (F529)', () => {
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_24ba4d6b-1111-2222-3333-444455556666';
  try {
    const d = 보드폴더('synk-tb-f529c-', 'ffffffff.md',
      '| 2026-08-17 | 남의 트랙 | a.js | 작업중 (`local_ffffffff`) |\n');
    const 가지출력 = 가지픽스처('worktree-board-rows-denominator', '24ba4d6b.md',
      '| 2026-08-17 | **보드 전체 상한** | board-guard.js | 착수 (`local_24ba4d6b`) — 다음=변이 재실행 후 머지 |');
    const h = report.buildHandoff(d, null, { dirty: 0, 가지출력 });

    assert.doesNotMatch(h, /트랙 없이 끝난 세션이다/,
      `🔴 가지에 선언이 멀쩡히 있는데 「트랙 없이 끝났다」로 나갔다 — 실사고 24ba4d6b 그대로다:\n${h}`);
    assert.doesNotMatch(h, /다시 열 필요 없다/, '🔴 확인을 금지하는 문장이 그대로 나갔다');
    assert.match(h, /다음=변이 재실행/, '가지 줄의 「다음 할 일」을 안 실었다');
    assert.match(h, /worktree-board-rows-denominator/,
      `🔴 가지 이름이 없다 — 「원본 docs/_ops/보드/24ba4d6b.md」는 master 에 없어서 받은 세션이 못 연다:\n${h}`);
    assert.match(h, /머지 안 된 가지/, '그 줄이 아직 master 에 없다는 사실을 안 밝혔다');
    assert.match(h, /F403|gh pr list/,
      '🔴 갇힌 트랙인지 볼 통로를 안 줬다 — 가지에만 있는 선언이 바로 F403 «워크트리 갇힘»의 모습이다');
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

test('인계문 — 가지 층을 «못 쟀으면» 「다시 열 필요 없다」를 안 쓴다 (F529 · 아는 만큼만)', () => {
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  try {
    const d = 보드폴더('synk-tb-f529d-', 'ffffffff.md',
      '| 2026-08-17 | 남의 트랙 | a.js | 작업중 (`local_ffffffff`) |\n');

    const 못잼 = report.buildHandoff(d, null, { dirty: 0, 가지: { 줄들: [], 모름: true } });
    assert.doesNotMatch(못잼, /다시 열 필요 없다/,
      `🔴 못 잰 층을 «없다»로 번역했다 — 이 문장은 확인 자체를 금지한다(F529 의 급소):\n${못잼}`);
    assert.match(못잼, /못 훑었다/, '못 쟀다는 사실을 안 밝혔다 — 초록은 분모와 함께 쓴다(F207)');
    assert.match(못잼, /새 트랙/, '못 잰 갈래에 다음 수가 없다');

    // 반대 방향 — 다 쟀으면 단정은 **살아 있어야** 한다(F170 이 세운 값을 이 수리가 죽이면 안 된다).
    const 다잼 = report.buildHandoff(d, null, { dirty: 0, 가지: { 줄들: [], 모름: false } });
    assert.match(다잼, /다시 열 필요 없다/,
      `🔴 다 재고도 단정을 못 한다 — F170 이 없앤 「보드를 다시 열어라」가 되살아났다:\n${다잼}`);
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

test('낡음 — 가지에만 있는 원본을 「사라짐」으로 단정하지 않는다 (F529 가 반대편에 세울 뻔한 거짓말)', () => {
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_24ba4d6b-1111-2222-3333-444455556666';
  try {
    const d = 보드폴더('synk-tb-f529e-', 'ffffffff.md',
      '| 2026-08-17 | 남의 트랙 | a.js | 작업중 (`local_ffffffff`) |\n');
    const 가지출력 = 가지픽스처('worktree-board-rows-denominator', '24ba4d6b.md',
      '| 2026-08-17 | **보드 전체 상한** | board-guard.js | 착수 (`local_24ba4d6b`) — 다음=변이 재실행 후 머지 |');

    // 🔑 **왕복으로** 못박는다(build→낡음) — 문구를 다듬다 좌표가 어긋나면 대조가 조용히 죽는다.
    const h = report.buildHandoff(d, null, { dirty: 0, 가지출력 });
    const v = report.낡음(d, h, { 가지출력 });
    assert.ok(v, '대조 자체가 안 섰다 — 인계문에 원본 좌표가 안 실렸다');
    assert.equal(v.판정, '가지',
      `🔴 가지에 살아 있는 줄을 「${v.판정}」으로 판정했다 — 한 거짓말을 고치며 반대편에 새 거짓말을 세운 꼴이다`);
    assert.equal(v.가지, 'worktree-board-rows-denominator', '어느 가지인지를 안 실었다');

    const 경고 = report.낡음경고(v);
    assert.match(경고, /안 온 것/,
      '🔴 「지워졌다」와 「아직 안 왔다」를 같은 무게로 냈다 — 받은 세션이 갇힌 트랙을 버린다(F403)');

    /* 반대 방향 — 가지에 **없으면** 「사라짐」은 그대로다. 이 수리는 순증이라,
     *   가지에서 실제로 찾았을 때만 판정을 바꾼다(F343 이 세운 경고를 안 깎는다). */
    const 없는가지 = 가지픽스처('worktree-딴것', 'aabbccdd.md', '| 2026-08-17 | 딴 트랙 | z.js | 착수 (`local_aabbccdd`) |');
    assert.equal(report.낡음(d, h, { 가지출력: 없는가지 }).판정, '사라짐',
      '🔴 가지에 없는데도 「가지」로 냈다 — 사라진 줄을 살아있다고 말한다');
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

test('무주줄 — 분모가 boardTrack 이 훑는 범위와 같다 (F529 · 갈라지면 더 센 단정이 나간다)', () => {
  const d = 보드폴더('synk-tb-f529f-', 'ffffffff.md',
    '| 2026-08-17 | 남의 트랙 | a.js | 작업중 (`local_ffffffff`) |\n');
  // 가지 안의 **재료 없는 줄** — 파일명도 지문 꼴이 아니고 해시도 없다.
  const 가지출력 = 가지픽스처('worktree-x', '유물-옛판.md', '| 2026-08-17 | 재료 없는 줄 | c.js | 미확정 |');

  assert.equal(report.무주줄(d, { 가지: { 줄들: [], 모름: false } }), 0, 'master 쪽 셈이 틀렸다');
  assert.equal(report.무주줄(d, { 가지출력 }), 1,
    '🔴 가지 안의 모호한 줄을 안 셌다 — boardTrack 은 그 줄을 보는데 분모만 master 라면, 「모호 0 = 실측된 없음」으로 기울어 **더 센 단정**이 나간다(가드 맹점 ④)');
});

// ⚠ 실저장소 검사는 **거짓양성만** — 이 스위트가 쓰는 가짜 세션 id 가 실인계문에 박혔는지만 본다.
//   (옆 세션이 그 순간 실인계문을 쓰는 건 정상이라, 내용 전체 불변을 걸면 거짓 적색이 난다.)
//   맨 끝에 둔다 — 앞의 모든 훅 실행이 끝난 뒤의 상태를 봐야 한다.
test('🔴 이 스위트는 실저장소 docs/_ops/인계문.md 를 오염시키지 않는다 (F096)', () => {
  let 본문 = '';
  try { 본문 = fs.readFileSync(path.join(ROOT, 'docs', '_ops', '인계문.md'), 'utf8'); } catch (_) { return; }
  const 가짜 = /^## .* · 세션 (s[1-6]|block|17027542|7dd54149|2f9a7c31|aaaaaaaa|bbbbbbbb|cccccccc|dddddddd|mine2222|other111|wtsess|tool-tes)( · |\s*$)/m;
  const 잡힘 = 본문.match(가짜);
  assert.equal(잡힘, null,
    `🔴 시험의 가짜 세션 블록이 실인계문에 있다(세션 ${잡힘 && 잡힘[1]}) — 유호님이 "복사해 붙이라"고 안내받는 파일이 오염됐다(F096 실사고). 훅 호출에 cwd 를 실저장소로 준 테스트를 찾아라`);
});
