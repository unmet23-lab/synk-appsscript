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

/** 훅을 실제로 돌린다. 상태 폴더를 갈아 끼워 세션당 1회 억제를 격리한다.
 *  🔴 cwd 는 주어진 게 없으면 **임시 폴더**다 — 절대 ROOT(실저장소)를 기본값으로 삼지 않는다.
 *  훅이 cwd 아래 docs/_ops/인계문.md 를 실제로 쓰기 때문에, ROOT 로 돌리면 이 스위트가
 *  돌 때마다 실인계문이 가짜 블록(세션 s1·block…)으로 밀려난다(F096 실사고 — CI·로컬 검증마다
 *  진짜 인계가 증발했고, 유호님이 "복사해 붙이라"고 안내받은 파일이 오염돼 있었다). */
function 돌려(입력, stateDir) {
  const cwd = 입력.cwd || 임시('synk-tb-cwd-');
  const r = spawnSync(process.execPath, [HOOK], {
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
  // 옛 형식 그대로 — 세션별 파일은 하나도 없는 상태
  fs.writeFileSync(목차, '# 다음 세션 인계문 (자동 생성 · 최근 3개)\n\n'
    + ['aaaa1111', 'bbbb2222', 'cccc3333']
      .map((s) => `## 2026-08-05 00:0${s[0] === 'a' ? 1 : s[0] === 'b' ? 2 : 3} · 세션 ${s} · 세션 정리\n\n\`\`\`\n${s} 의 옛 인계문\n\`\`\`\n`)
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
  const r = spawnSync(process.execPath, [TOOL], {
    cwd: d, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 'tool-test-sess' },
  });
  assert.equal(r.status, 0, `도구가 실패 종료했다: ${r.stderr}`);
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

  const r = spawnSync(process.execPath, [TOOL, '--no-save'], {
    cwd: d, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 'nosave-test-sess' },
  });
  assert.equal(r.status, 0, `도구가 실패 종료했다: ${r.stderr}`);
  // 복붙 통로는 살아 있어야 한다 — 안 쓰는 대신 화면 출력까지 죽으면 처방이 통째로 빈다.
  assert.match(r.stdout, /^SYNK 이어서 작업한다/, '--no-save 가 stdout 까지 죽였다 — 복붙할 실물이 사라진다(F096 그 증상)');
  assert.equal(fs.readFileSync(사본, 'utf8'), 원본,
    '🔴 --no-save 인데 공유 사본을 건드렸다 — 점검 한 번이 살아있는 남의 인계문을 지운다(store 바통이 비면 그 파일이 마지막 사본이다)');
});

/* 장치와 발동 조건은 같은 커밋에서 — 플래그만 만들고 처방이 안 가리키면 아무도 안 쓴다. */
test('🔴 처방-실행층 결속 — 「수동 재출력」 안내는 --no-save 를 준다', () => {
  const 본문 = fs.readFileSync(path.join(HOOKS, 'context-budget.js'), 'utf8');
  const m = 본문.match(/수동 재출력 `([^`]+)`/);
  assert.ok(m, '「수동 재출력」 안내가 사라졌다 — 유호님이 다시 뽑을 통로가 빈다');
  assert.match(m[1], /--no-save/,
    `🔴 재출력 처방이 사본을 갱신한다(${m[1]}) — 점검하러 돌린 한 번이 남의 인계문을 밀어낸다`);
});

test('🔴 처방-실행층 결속 — wake·/close·track-boundary 가 가리키는 인계문 도구가 실재한다', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', '인계문.js')), '도구 실물이 없다');
  for (const [파일, 이름] of [
    [path.join(HOOKS, 'context-budget.js'), 'context-budget(wake ④)'],
    [path.join(HOOKS, 'track-boundary.js'), 'track-boundary'],
    [path.join(ROOT, '.claude', 'skills', 'close', 'SKILL.md'), '/close 스킬'],
  ]) {
    assert.ok(fs.readFileSync(파일, 'utf8').indexOf('node tools/인계문.js') !== -1,
      `${이름} 이 인계문 출력 도구를 안 가리킨다 — 지시문구가 화면에 나오는 경로가 끊긴다(F096)`);
  }
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

// ⚠ 실저장소 검사는 **거짓양성만** — 이 스위트가 쓰는 가짜 세션 id 가 실인계문에 박혔는지만 본다.
//   (옆 세션이 그 순간 실인계문을 쓰는 건 정상이라, 내용 전체 불변을 걸면 거짓 적색이 난다.)
//   맨 끝에 둔다 — 앞의 모든 훅 실행이 끝난 뒤의 상태를 봐야 한다.
test('🔴 이 스위트는 실저장소 docs/_ops/인계문.md 를 오염시키지 않는다 (F096)', () => {
  let 본문 = '';
  try { 본문 = fs.readFileSync(path.join(ROOT, 'docs', '_ops', '인계문.md'), 'utf8'); } catch (_) { return; }
  const 가짜 = /^## .* · 세션 (s[1-6]|block|17027542|7dd54149|aaaaaaaa|bbbbbbbb|cccccccc|dddddddd|mine2222|other111|wtsess|tool-tes)( · |\s*$)/m;
  const 잡힘 = 본문.match(가짜);
  assert.equal(잡힘, null,
    `🔴 시험의 가짜 세션 블록이 실인계문에 있다(세션 ${잡힘 && 잡힘[1]}) — 유호님이 "복사해 붙이라"고 안내받는 파일이 오염됐다(F096 실사고). 훅 호출에 cwd 를 실저장소로 준 테스트를 찾아라`);
});
