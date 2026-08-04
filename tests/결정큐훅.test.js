/**
 * session-decisions 훅 회귀 — 「유호님 결정 대기가 세션 시작에 뜬다」
 *
 * 왜 있나 (2026-08-05 · 유호님 확정):
 *   tools/decision-queue.js 는 미결 57건을 이미 세고 있었는데 **헤르메스 텔레그램으로만** 나갔다.
 *   PC 세션 시작 화면에는 한 번도 안 떴고, 그래서 유호님은 큐의 존재조차 모르셨다.
 *   실측으로 갈린 판정 — 마찰 101건 중 79%가 AI 자기 살림이고 유호님 사업 물건은 6%인데,
 *   3년 계획의 속도를 정하는 것은 **유호님 답을 기다리는 미결**이다.
 *
 * 이 파일이 지키는 것 (이식성·등록 일반론은 tests/훅이식성.test.js 가 이미 전 훅을 훑는다 —
 * 여기서는 그게 **안 덮는 것만** 진다):
 *   ① session-decisions 가 SessionStart 에 **실제로 등록돼 있다.**
 *      이식성 테스트는 「등록된 것」을 검사하지 「등록돼 있어야 한다」를 검사하지 않는다 —
 *      등록이 통째로 빠지면 그쪽은 초록인 채로 이 기능이 사라진다(F053: 새는 방향은 언제나 통과).
 *   ② **기존 수리 훅 3종이 계속 살아 있다.** 유호님 지시 그대로다 —
 *      「도전안을 받아들이되 **그 뒤에도 수리할 것들도 같이** 나오게」.
 *      결정 큐가 수리 목록을 밀어내면 그건 지시 위반이고, 여기서 빨간불이 난다.
 *   ③ **미실행을 침묵으로 위장하지 않는다** — 메모리 정본이 없는 환경에서 빈 출력을 내면
 *      「대기 0건」과 구분이 안 된다. 통과와 미실행이 같은 모양이면 안 된다.
 *   ④ 세션을 막지 않는다 — 큐를 못 세도 exit 0.
 *
 * ⚠ 실제 메모리(repo 밖)를 세는 회귀는 쓰지 않는다 — 유호님이 결정에 답하는 순간 빨개지고,
 *   다음 사람은 테스트를 고치는 게 아니라 끈다. 탐지력은 전부 픽스처가 진다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'session-decisions.js');

/** SessionStart 에 등록된 훅 명령 전부 */
function sessionStartCommands() {
  const j = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  return (j.hooks.SessionStart || []).flatMap((g) => (g.hooks || []).map((h) => String(h.command || '')));
}

function runHook(env) {
  return spawnSync(process.execPath, [HOOK], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    input: '',
  });
}

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-dqhook-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body, 'utf8');
  return dir;
}

// ── ① 등록 ────────────────────────────────────────────────────────────────
test('① session-decisions 가 SessionStart 에 등록돼 있다', () => {
  const cmds = sessionStartCommands();
  assert.ok(
    cmds.some((c) => c.includes('.claude/hooks/session-decisions.js')),
    'SessionStart 에 session-decisions 등록이 없다 — 훅 파일이 있어도 안 돈다(F044·F053)',
  );
});

// ── ② 유호님 지시 잠금 ─────────────────────────────────────────────────────
test('② 결정 큐가 기존 수리 훅을 밀어내지 않았다 (유호님 지시: 수리도 같이 나오게)', () => {
  const cmds = sessionStartCommands().join('\n');
  for (const 수리훅 of ['tools/rot-check.js', '.claude/hooks/session-handoff.js', 'tools/작업본소유자.js']) {
    assert.ok(
      cmds.includes(수리훅),
      `${수리훅} 가 SessionStart 에서 사라졌다 — 유호님 지시는 「결정 큐를 더하되 수리 목록은 그대로」였다`,
    );
  }
});

// ── ③ 실행층: 픽스처 ───────────────────────────────────────────────────────
test('③ 미결이 있으면 건수와 항목을 낸다', () => {
  const dir = fixture({ 'a.md': '# A\n- ⏳ 픽스처 결정 하나\n' });
  const r = runHook({ SYNK_MEMORY_DIR: dir });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /답 대기 1건/);
  assert.match(r.stdout, /픽스처 결정 하나/);
});

test('③ 미결이 없으면 0건이라고 **말한다** (조용히 사라지지 않는다)', () => {
  const dir = fixture({ 'a.md': '# A\n- 결정 아닌 그냥 본문\n' });
  const r = runHook({ SYNK_MEMORY_DIR: dir });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /0건/);
});

// ── ③ 실행층: 미실행을 침묵으로 위장하지 않는다 ─────────────────────────────
test('③ 🔑 메모리 정본이 없으면 「못 셌다」고 밝힌다 — 「0건」과 같은 모양이면 안 된다', () => {
  const dir = path.join(os.tmpdir(), 'synk-dqhook-없는폴더-' + process.pid);
  const r = runHook({ SYNK_MEMORY_DIR: dir });
  assert.match(r.stdout, /못 셌다/, '큐를 못 셌는데 조용하면 미실행이 통과처럼 보인다');
  assert.doesNotMatch(r.stdout, /답 대기 0건/, '못 센 것을 0건으로 위장하면 안 된다');
});

test('④ 큐를 못 세도 세션을 막지 않는다 (exit 0)', () => {
  const r = runHook({ SYNK_MEMORY_DIR: path.join(os.tmpdir(), 'synk-dqhook-없는폴더2-' + process.pid) });
  assert.equal(r.status, 0, '정보성 훅이 세션 시작을 막으면 안 된다');
});

// ── 길이 상한 (매 세션 상주 비용) ──────────────────────────────────────────
test('한 항목이 터미널 한 줄을 넘지 않는다 (매 세션 상주하는 비용)', () => {
  const h = require('../.claude/hooks/session-decisions.js');
  const 긴줄 = '가'.repeat(500);
  assert.ok(h.oneLine(긴줄).length <= h.MAX_LEN, '상한을 안 지키면 세션마다 그만큼 곱해진다');
  assert.match(h.oneLine(긴줄), /…$/, '잘랐으면 잘렸다고 보여야 한다');
  assert.equal(h.oneLine('짧은 줄'), '짧은 줄', '거짓양성: 짧은 줄은 안 건드린다');
  assert.equal(h.oneLine('여러\n줄\n입력'), '여러 줄 입력', '개행은 한 줄로 접는다');
});

test('토픽 슬러그의 꼬리 날짜만 뗀다 (거짓양성 없이)', () => {
  const h = require('../.claude/hooks/session-decisions.js');
  assert.equal(h.shortTopic('print-doc-pipeline-2026-08-04'), 'print-doc-pipeline');
  assert.equal(h.shortTopic('company-brain'), 'company-brain', '날짜가 없으면 그대로 둔다');
  assert.equal(h.shortTopic('roadmap-4stage-2026-08-04'), 'roadmap-4stage');
});
