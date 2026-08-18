/**
 * 심장박동 회귀 — 「살아있는 세션이 남에게 죽은 것으로 보이지 않는가」
 *
 * 왜 있나 (2026-08-12 · 유호님 「작업본소유자·philosophy-card 가 잘 작성돼 있는지」 검토에서 실측):
 *   박동을 쓰는 곳이 `track-collision`(PreToolUse **Edit|Write|MultiEdit**) 하나뿐이었다.
 *   그래서 **셸만 돌리는 세션은 박동이 멎었고**, `작업본소유자.살았나` 는 30분을 넘기면 그 세션을
 *   「끝난 것」으로 본다 → 보드 줄이 `죽은착수` 로 잡혀 **다음 세션에게 「이어받아라」로 그려진다**
 *   (F073 입구). 검수·심문 한 패스가 실측 20~32분이라 이건 예외가 아니라 곧 상시가 된다.
 *
 * 이 회귀가 막는 네 가지 죽는 방식:
 *   ① **좌표가 갈린다** — 쓰는 통로가 둘인데 경로 규칙이 어긋나면 파일이 둘로 쪼개지고,
 *      증상은 「찍었는데 아무도 못 봄」이다. 그래서 **파일이 하나만 생기는지**를 행동으로 본다.
 *   ② **만진 기록을 날린다** — 통째로 덮어쓰면 그 세션은 자기 파일도 자기 것으로 증명 못 한다.
 *   ③ **조기 종료 뒤로 밀린다** — 가드의 `exit(0)` 갈래 어딘가 뒤에 있으면 그 갈래에서 조용히 멎는다.
 *   ④ **등록층이 좁아진다** — settings 에서 `case` 필터가 붙는 순간 박동은 그만큼 안 뛴다(F044·F053).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 훅띄우기 } = require('./lib/훅띄우기');   // 날 spawnSync 금지 — 미실행이 「통과」로 번역된다

const ROOT = path.resolve(__dirname, '..');
const 가드 = path.join(ROOT, '.claude', 'hooks', 'code-edit-guard.js');
const 충돌훅 = path.join(ROOT, '.claude', 'hooks', 'track-collision.js');
const store = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js'));

const SID = 'local_babo1234-0000-0000-0000-00000000babo';

/** 시험용 상태 폴더 하나. 실제 세션 상태를 절대 안 건드린다. */
function 새폴더(이름) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `synk-박동-${이름}-`));
  return d;
}

function 환경(폴더) {
  return {
    ...process.env,
    SYNK_CTXBUDGET_DIR: 폴더,
    SYNK_TRACK_ROOT: ROOT,
    CLAUDE_CODE_HOST_SESSION_ID: SID,
  };
}

const track파일들 = (d) => fs.readdirSync(d).filter((f) => f.startsWith('track-') && f.endsWith('.json'));

function 가드띄우기(폴더, 입력) {
  return 훅띄우기(가드, { input: JSON.stringify(입력), encoding: 'utf8', env: 환경(폴더) });
}

/* ── ① 좌표 — 두 통로가 **같은 파일 하나**를 쓴다 ───────────────────────────── */

test('좌표 — 셸 통로와 편집 통로가 같은 만진기록 파일 하나를 쓴다(갈리면 박동이 쪼개진다)', () => {
  const d = 새폴더('좌표');

  가드띄우기(d, { tool_name: 'Bash', tool_input: { command: 'ls -la' }, session_id: SID, cwd: ROOT });
  const 셸뒤 = track파일들(d);
  assert.strictEqual(셸뒤.length, 1, `셸 통로가 만진기록을 안 만들었다(박동이 안 뛴다): ${JSON.stringify(셸뒤)}`);

  훅띄우기(충돌훅, {
    input: JSON.stringify({
      tool_name: 'Edit', tool_input: { file_path: path.join(ROOT, 'README.md') }, session_id: SID, cwd: ROOT,
    }),
    encoding: 'utf8',
    env: 환경(d),
  });
  const 편집뒤 = track파일들(d);

  assert.strictEqual(
    편집뒤.length, 1,
    `만진기록이 ${편집뒤.length}개다 — 두 통로의 좌표가 갈렸다. 갈린 쪽은 아무도 안 읽는다: ${JSON.stringify(편집뒤)}`,
  );
  fs.rmSync(d, { recursive: true, force: true });
});

/* ── ② 남의 기록을 안 지운다 ────────────────────────────────────────────────── */

test('보존 — 박동이 만진 기록·죽음 도장을 지우지 않는다(덮어쓰면 자기 파일도 증명 못 한다)', () => {
  const d = 새폴더('보존');
  const p = path.join(d, path.basename(store.trackPath(ROOT, SID)));
  fs.writeFileSync(p, JSON.stringify({ touched: { 'tools/x.js': 1 }, siblingBase: 'zzz', 끝남: 12345, at: 1 }));

  가드띄우기(d, { tool_name: 'Bash', tool_input: { command: 'echo hi' }, session_id: SID, cwd: ROOT });

  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.deepStrictEqual(j.touched, { 'tools/x.js': 1 }, '만진 기록이 날아갔다 — 그 세션은 자기 파일도 못 증명한다');
  assert.strictEqual(j.siblingBase, 'zzz', '형제 저장소 기준이 날아갔다');
  assert.strictEqual(j.끝남, 12345, '죽음 도장을 지웠다 — 죽음을 되돌리는 건 박동의 일이 아니다(F252)');
  assert.ok(j.at > 1, '박동(at)이 안 갱신됐다');
  fs.rmSync(d, { recursive: true, force: true });
});

/* ── ③ 조기 종료 갈래마다 찍힌다 ─────────────────────────────────────────────
 * 이 가드는 비-Bash·빈 명령·BYPASS 에서 즉시 나간다. 박동이 그 뒤에 있으면
 * **그 갈래에서만 조용히 멎는다** — 지금 고치는 병 그대로다. */

for (const [이름, 입력] of [
  ['비-Bash 도구', { tool_name: 'Read', tool_input: { file_path: 'a.md' } }],
  ['빈 명령', { tool_name: 'Bash', tool_input: { command: '' } }],
  ['BYPASS 붙은 명령', { tool_name: 'Bash', tool_input: { command: 'CODE_EDIT_BYPASS=1 sed -i s/a/b/ x.js' } }],
  ['막히는 명령', { tool_name: 'Bash', tool_input: { command: 'sed -i "s/a/b/" tools/board.js' } }],
]) {
  test(`갈래 — ${이름} 에서도 박동이 찍힌다(조기 종료 앞에 있는가)`, () => {
    const d = 새폴더('갈래');
    가드띄우기(d, { ...입력, session_id: SID, cwd: ROOT });
    assert.strictEqual(
      track파일들(d).length, 1,
      `이 갈래에서 박동이 안 찍혔다 — 박동이 조기 종료 «뒤»에 있다(${이름})`,
    );
    fs.rmSync(d, { recursive: true, force: true });
  });
}

/* ── ④ 등록층 — 셸 통로가 좁아지면 박동도 그만큼 안 뛴다 ────────────────────── */

test('등록층 — code-edit-guard 가 Bash|PowerShell 에 «필터 없이» 걸려 있다', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const 항목 = (s.hooks.PreToolUse || [])
    .filter((e) => /Bash/.test(String(e.matcher || '')))
    .flatMap((e) => (e.hooks || []).map((h) => String(h.command || '')))
    .filter((c) => c.includes('code-edit-guard.js'));

  assert.strictEqual(항목.length, 1, 'code-edit-guard 가 PreToolUse Bash 에 등록돼 있지 않다 — 박동도 가드도 안 돈다');
  assert.ok(
    !/case\s+"\$IN"\s+in/.test(항목[0]),
    '셸 통로에 case 필터가 붙었다 — 그만큼 박동이 조용히 안 뛴다(모든 셸 호출에 도는 유일한 훅이라 여기 얹었다)',
  );
});

/* ── ⑤ 부수효과가 가드를 죽이지 않는다 ─────────────────────────────────────── */

test('안전 — 세션 id 를 모르면 아무 파일도 안 만들고 false 를 낸다(남의 파일 생성 금지)', () => {
  const d = 새폴더('무id');
  /* ⚠ 「모름」은 **id 소스 전부**를 비워야 만들어진다(F633). HOST 하나만 지우면 주변 env 의
   *   `CLAUDE_CODE_SESSION_ID` 가 답을 흘려 넣고, 그러면 이 검사는 **러너에 따라** 갈린다
   *   (CI 엔 그 변수가 없어 통과 · 로컬 세션에선 실패 — F296 이 이름 댄 환경 의존 그 자리다).
   *   목록을 여기 다시 적지 않는다 — 소스가 늘면 이 목록만 낡는다. */
  const 세션식별 = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', '세션식별.js'));
  const 옛것 = new Map(세션식별.환경변수들.map((k) => [k, process.env[k]]));
  const 옛dir = process.env.SYNK_CTXBUDGET_DIR;
  try {
    for (const k of 세션식별.환경변수들) delete process.env[k];
    process.env.SYNK_CTXBUDGET_DIR = d;
    assert.strictEqual(store.박동찍기({}), false, 'id 없이 찍으면 엉뚱한 이름의 파일이 쌓인다');
  } finally {
    for (const [k, v] of 옛것) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (옛dir === undefined) delete process.env.SYNK_CTXBUDGET_DIR; else process.env.SYNK_CTXBUDGET_DIR = 옛dir;
  }
  fs.rmSync(d, { recursive: true, force: true });
});
