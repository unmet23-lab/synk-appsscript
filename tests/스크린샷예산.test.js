/**
 * screenshot-budget 회귀 — 원격 작업의 스크린샷 남발 차단
 *
 * 왜 있나: 프로즈 조항이 **두 번** 실패했다(07-31 448장 → v6.10 조항 신설 → 08-04 20장+ 재발).
 * 「같은 절차에서 2번째 = 시스템 결함, 처방은 기계」의 적용이라, 이 훅이 실제로 세고
 * 실제로 막는지를 픽스처로 못박는다. 실저장소 상태에 의존하지 않는다.
 *
 * ⚠ 이 가드는 안전장치가 아니라 **예산 관리**다 — 좌표 클릭이 필요한 실작업까지 막으면
 *    원격 작업 자체가 불가능해진다. 그래서 사다리(조용히 통과 → 눈에 보이게 경고 → 차단)이고
 *    리셋 통로를 남겨 뒀다. 검사도 그 세 구간을 전부 본다(차단만 검사하면 거짓양성이 안 보인다).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

// SYNK_TEST_HOOK = 변이 실험용 이음매. 평소엔 실훅을 본다(실저장소를 흔들지 않고 탐지력만 잰다).
const HOOK = process.env.SYNK_TEST_HOOK || path.resolve(__dirname, '..', '.claude', 'hooks', 'screenshot-budget.js');
// SYNK_TEST_SETTINGS = 같은 목적의 이음매(등록층 쪽). 이게 없던 동안 매처 검사는 실파일만 봐서
// **탐지력을 잴 방법이 없었다** — 변이를 넣으려면 실저장소의 등록을 망가뜨려야 했기 때문이다.
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.resolve(__dirname, '..', '.claude', 'settings.json');
const FREE = 4;
const HARD = 9;
const DAY_FREE = 12;
const DAY_HARD = 25;
const BLOCK_FREE = 6;
const BLOCK_HARD = 12;

// 카운터를 통째로 임시 폴더에 격리한다. 일일 예산이 생긴 뒤로는 이게 필수다 —
// 안 하면 이 테스트가 실환경 하루 예산(25장)을 먹어 치우고, 반대로 실환경이 테스트를 흔든다.
const BUDGET_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-budget-test-'));

let seq = 0;
function freshSession() {
  seq += 1;
  return `synk-test-${process.pid}-${seq}`;
}

// day 기본값 = 세션 id. 테스트마다 **하루 예산도 따로** 쓰게 만들어, 앞 테스트의 소비가
// 뒤 테스트의 조용함을 깨지 않게 한다. 일일 예산 자체를 보는 검사는 day를 명시해 공유한다.
function call(sessionId, { tool = 'mcp__claude-in-chrome__computer', action = 'screenshot', input, day } = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      session_id: sessionId,
      tool_name: tool,
      tool_input: input !== undefined ? input : { action },
    }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_BUDGET_DIR: BUDGET_DIR, SYNK_BUDGET_DAY: day || sessionId },
  });
  const out = (r.stdout || '').trim();
  if (!out) return { decision: 'allow', reason: '', silent: true };
  const j = JSON.parse(out).hookSpecificOutput;
  return { decision: j.permissionDecision, reason: j.permissionDecisionReason, silent: false };
}

function reset(sessionId, { day, all = false } = {}) {
  const args = all ? [HOOK, '--reset'] : [HOOK, '--reset', '--session', sessionId];
  spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: { ...process.env, SYNK_BUDGET_DIR: BUDGET_DIR, SYNK_BUDGET_DAY: day || sessionId },
  });
}

test.after(() => {
  try {
    fs.rmSync(BUDGET_DIR, { recursive: true, force: true });
  } catch (_) {}
});

test(`처음 ${FREE}장은 조용히 통과한다 (실작업을 방해하지 않는다)`, () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) {
    const r = call(s);
    assert.strictEqual(r.decision, 'allow', `${i}장째가 막혔다`);
    assert.ok(r.silent, `${i}장째에 불필요한 잔소리가 붙었다 — 예산 안에서는 조용해야 한다`);
  }
});

test(`${FREE + 1}장부터 ${HARD}장까지는 통과하되 남은 예산이 눈에 보인다`, () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) call(s);
  for (let i = FREE + 1; i <= HARD; i += 1) {
    const r = call(s);
    assert.strictEqual(r.decision, 'allow', `${i}장째가 막혔다 — 아직 상한이 아니다`);
    assert.ok(!r.silent, `${i}장째가 조용히 지나갔다 — 경고 구간인데 안 보인다`);
    assert.match(r.reason, /read_page/, '대체 수단을 제시하지 않는다 — 막기만 하는 경고는 행동을 안 바꾼다');
    assert.match(r.reason, new RegExp(`${i}/${HARD}`), '몇 장 썼는지가 안 보인다');
  }
});

test(`${HARD}장을 넘기면 차단하고, 무엇으로 대체할지와 리셋 방법을 준다`, () => {
  const s = freshSession();
  for (let i = 1; i <= HARD; i += 1) call(s);
  const r = call(s);
  assert.strictEqual(r.decision, 'deny', '상한을 넘겼는데 통과했다');
  assert.match(r.reason, /read_page/, '대체 수단이 없다');
  assert.match(r.reason, /--reset/, '빠져나갈 통로를 안 알려준다 — 금지가 목적이 아니다');
});

test('차단된 시도는 세지 않는다 (리셋 없이 영원히 막히면 안 된다)', () => {
  const s = freshSession();
  for (let i = 1; i <= HARD; i += 1) call(s);
  call(s); // 차단 1
  call(s); // 차단 2
  reset(s);
  const r = call(s);
  assert.strictEqual(r.decision, 'allow', '리셋 후에도 막혔다 — 차단 시도가 카운터를 밀었다');
  assert.ok(r.silent, '리셋 후 첫 장은 예산 안이라 조용해야 한다');
});

test('세션이 다르면 세션 예산은 따로다 (남의 세션이 내 세션 예산을 먹지 않는다)', () => {
  // 같은 날로 묶어서 본다 — day를 나눠 버리면 이 검사가 저절로 통과해 버린다.
  const day = freshSession();
  const a = freshSession();
  const b = freshSession();
  for (let i = 1; i <= HARD; i += 1) call(a, { day });
  const r = call(b, { day });
  assert.strictEqual(r.decision, 'allow', '다른 세션의 소비가 내 세션 예산에 잡혔다');
  assert.ok(r.silent, `누적 ${HARD + 1}장은 아직 일일 예산(${DAY_FREE}) 안이라 조용해야 한다`);
});

test('zoom도 그림이므로 함께 센다', () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) call(s, { action: 'zoom' });
  const r = call(s, { action: 'zoom' });
  assert.ok(!r.silent, 'zoom이 예산에서 빠져 있다 — 그림은 그림이다');
});

test('텍스트 판독 도구와 클릭은 세지 않는다 (권장 경로를 벌주지 않는다)', () => {
  const s = freshSession();
  for (const t of [
    { tool: 'mcp__claude-in-chrome__read_page', action: '' },
    { tool: 'mcp__claude-in-chrome__find', action: '' },
    { tool: 'mcp__claude-in-chrome__get_page_text', action: '' },
    { tool: 'mcp__claude-in-chrome__computer', action: 'left_click' },
    { tool: 'mcp__claude-in-chrome__computer', action: 'type' },
  ]) {
    const r = call(s, t);
    assert.ok(r.silent, `${t.tool}/${t.action} 가 예산에 잡혔다 — 텍스트 경로를 벌주면 안 된다`);
  }
  // 위 호출들이 카운터를 전혀 올리지 않았는지, 이후 FREE장이 조용한지로 확인
  for (let i = 1; i <= FREE; i += 1) {
    assert.ok(call(s).silent, `${i}장째가 이미 경고 구간 — 비이미지 호출이 예산을 먹었다`);
  }
});

// ── 3번째 실패(08-04 실측)의 회귀 ─────────────────────────────────────────────
// 훅이 있는데도 한 세션이 40장을 찍었다. 샌 통로는 셋이고, 형태가 서로 다르다.
// 픽스처는 **실제로 전사에 찍힌 입력 구조** 그대로다(키를 지어내면 검사가 헛돈다).

// computer_batch — 액션이 평평하게 들어온다
const BATCH_FLAT = (...acts) => ({ actions: acts.map((a) => ({ action: a })) });
// browser_batch — {name, input:{action}} 으로 한 겹 더 감싼다
const BATCH_NESTED = (...acts) => ({ actions: acts.map((a) => ({ name: 'computer', input: { action: a } })) });

test('배치 도구 안의 스크린샷도 센다 — 평평한 형태(computer_batch)', () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) {
    call(s, { tool: 'mcp__computer-use__computer_batch', input: BATCH_FLAT('left_click', 'wait', 'screenshot') });
  }
  const r = call(s, { tool: 'mcp__computer-use__computer_batch', input: BATCH_FLAT('screenshot') });
  assert.ok(!r.silent, 'computer_batch로 감싸면 예산을 빠져나간다 — 08-04에 이 경로로 8장이 샜다');
});

test('배치 도구 안의 스크린샷도 센다 — 중첩 형태(browser_batch)', () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) {
    call(s, { tool: 'mcp__claude-in-chrome__browser_batch', input: BATCH_NESTED('left_click', 'screenshot') });
  }
  const r = call(s, { tool: 'mcp__claude-in-chrome__browser_batch', input: BATCH_NESTED('screenshot') });
  assert.ok(!r.silent, 'browser_batch로 감싸면 예산을 빠져나간다 — 08-04에 이 경로로 13장·161만 자가 샜다');
});

test('배치 1회가 그림 3장이면 예산도 3장을 먹는다 (컨텍스트에 실리는 양이 그렇다)', () => {
  const s = freshSession();
  const r = call(s, { tool: 'mcp__computer-use__computer_batch', input: BATCH_FLAT('screenshot', 'zoom', 'screenshot') });
  assert.ok(r.silent, '3장은 아직 예산(4장) 안이다');
  const r2 = call(s, { tool: 'mcp__computer-use__computer_batch', input: BATCH_FLAT('screenshot', 'screenshot') });
  assert.ok(!r2.silent, '3+2=5장인데 조용하다 — 배치를 1장으로 세고 있다');
  assert.match(r2.reason, /5\/9/, '누적 장수가 배치 내부까지 반영되지 않았다');
});

test('scroll도 그림을 되돌려주므로 센다 (08-04 실측: 6회 중 5회가 이미지)', () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) call(s, { action: 'scroll' });
  const r = call(s, { action: 'scroll' });
  assert.ok(!r.silent, 'scroll이 예산에서 빠져 있다 — 58만 자가 이 경로로 샜다');
});

test('그림이 없는 배치는 세지 않는다 (거짓양성이 실작업을 막으면 안 된다)', () => {
  const s = freshSession();
  for (let i = 1; i <= 6; i += 1) {
    const r = call(s, { tool: 'mcp__claude-in-chrome__browser_batch', input: BATCH_NESTED('left_click', 'type', 'key', 'wait') });
    assert.ok(r.silent, '클릭·타이핑만 든 배치가 예산을 먹었다');
  }
  for (let i = 1; i <= FREE; i += 1) assert.ok(call(s).silent, '비이미지 배치가 카운터를 밀었다');
});

test('이름 자체가 그림인 도구도 센다 (액션 필드가 없다)', () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) call(s, { tool: 'mcp__computer-use__screenshot', input: {} });
  const r = call(s, { tool: 'mcp__computer-use__screenshot', input: {} });
  assert.ok(!r.silent, 'mcp__computer-use__screenshot 이 예산에서 빠졌다');
});

// ── 5번째 실패(08-04 독해)의 회귀 ─────────────────────────────────────────────
// 앞의 넷을 다 막고도 통로가 셋 남아 있었다. 원인이 두 층에 하나씩:
//   ① 훅 **안에서** 목록이 갈라졌다 — 액션 판정은 scroll 을 아는데 도구 이름 판정은 몰랐다.
//   ② 매처가 scroll·teach_step·gif_creator 를 안 잡아 훅에 닿지도 않았다.
// 아래 셋이 각각 ①의 탐지력, ②의 라우팅, 그리고 둘이 **다시 갈라지는 것**을 잡는다.

/** 이름만으로(액션 필드 없이) 훅이 그림으로 세는지 물어본다. FREE 를 넘겨 경고가 붙는지로 판정. */
function countsAsImage(tool) {
  const s = freshSession();
  for (let i = 0; i <= FREE; i += 1) {
    if (!call(s, { tool, input: {} }).silent) return true;
  }
  return false;
}

test('독립 scroll 도구도 센다 — 액션 필드가 없어 두 층 다 빠져나갔다', () => {
  assert.ok(
    countsAsImage('mcp__computer-use__scroll'),
    'mcp__computer-use__scroll 이 예산에서 빠졌다 — 액션으로 오는 scroll 은 세면서 도구로 오면 안 센다'
  );
});

test('gif_creator 도 센다 (결과가 GIF 다 — 정지 이미지보다 크다)', () => {
  assert.ok(countsAsImage('mcp__claude-in-chrome__gif_creator'), 'gif_creator 가 예산에서 빠졌다');
});

test('이름이 비슷할 뿐인 도구는 세지 않는다 (라우팅을 넓혀도 권장 경로를 벌주지 않는다)', () => {
  for (const tool of [
    'mcp__claude-in-chrome__upload_image',   // 이미지를 **올린다** — 결과가 그림이 아니다
    'mcp__Claude_Browser__read_page',
    'mcp__computer-use__cursor_position',
    'mcp__computer-use__type',
  ]) {
    assert.ok(!countsAsImage(tool), `${tool} 가 그림으로 잡혔다 — 거짓양성`);
  }
});

test('ref 기반 scroll_to 는 세지 않는다 (그게 스크린샷 대신 권장하는 경로다)', () => {
  const s = freshSession();
  for (let i = 0; i <= FREE; i += 1) {
    assert.ok(call(s, { action: 'scroll_to' }).silent, 'scroll_to 가 예산에 잡혔다 — 대체 수단을 벌주면 갈아탈 곳이 없다');
  }
});

// ★ 핵심 회귀 — 훅과 매처가 **다시 갈라지는 것**을 잡는다.
// 기대값(어떤 도구가 그림이냐)을 하드코딩하지 않는다: 훅에 직접 물어보고, **센다고 답한 것만**
// 매처를 요구한다. 그래서 훅의 IMAGE_TOOL_NAMES 에 이름을 추가하면서 매처를 안 넓히면
// 여기서 빨간불이 난다 — 훅등록.test.js 의 「라우팅은 훅보다 넓다」를 액션 없는 도구에 적용한 것.
// 목록은 **실재하는 MCP 도구**만 담는다(지어낸 이름을 매처에 요구하면 등록이 쓰레기로 자란다).
const REMOTE_TOOLS = [
  'mcp__computer-use__screenshot', 'mcp__computer-use__zoom', 'mcp__computer-use__scroll',
  'mcp__computer-use__teach_step', 'mcp__computer-use__cursor_position', 'mcp__computer-use__type',
  'mcp__computer-use__left_click', 'mcp__computer-use__key', 'mcp__computer-use__wait',
  'mcp__claude-in-chrome__gif_creator', 'mcp__claude-in-chrome__read_page',
  'mcp__claude-in-chrome__find', 'mcp__claude-in-chrome__get_page_text',
  'mcp__claude-in-chrome__navigate', 'mcp__claude-in-chrome__upload_image',
  'mcp__Claude_Browser__read_page', 'mcp__Claude_Browser__find',
];

test('훅이 그림으로 세는 도구는 매처도 전부 잡는다 (둘이 갈라지면 조용히 샌다)', (t) => {
  const p = SETTINGS;
  if (!fs.existsSync(p)) return t.skip('settings.json 없음 — 이 검사는 실저장소에서만 돈다');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const entry = (cfg.hooks?.PreToolUse || []).find((e) =>
    (e.hooks || []).some((h) => String(h.command || '').includes('screenshot-budget.js'))
  );
  assert.ok(entry, 'screenshot-budget 훅이 등록돼 있지 않다');

  const missing = [];
  let counted = 0;
  for (const tool of REMOTE_TOOLS) {
    if (!countsAsImage(tool)) continue; // 훅이 관심 없는 도구 — 라우팅을 따질 자리가 아니다
    counted += 1;
    if (!new RegExp(entry.matcher).test(tool)) missing.push(tool);
  }
  assert.deepStrictEqual(
    missing, [],
    `훅은 세는데 매처가 안 잡는다 — 호출되지 않으면 통과가 된다: ${missing.join(', ')}`
  );
  assert.ok(counted >= 4, `이름만으로 그림인 도구가 ${counted}건뿐 — REMOTE_TOOLS 가 훅 규칙을 못 따라가고 있다`);
});

// 훅이 아무리 정확해도 **매처에 없으면 애초에 안 불린다.** 08-04에 샌 진짜 층이 여기다:
// 훅은 zoom을 알았지만 settings.json 매처가 배치 도구를 몰랐고, 죽는 방향이 「통과」였다.
test('settings.json 매처에 그림을 낳는 도구가 전부 등록돼 있다', (t) => {
  const p = SETTINGS;
  if (!fs.existsSync(p)) return t.skip('settings.json 없음 — 이 검사는 실저장소에서만 돈다');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const entry = (cfg.hooks?.PreToolUse || []).find((e) =>
    (e.hooks || []).some((h) => String(h.command || '').includes('screenshot-budget.js'))
  );
  assert.ok(entry, 'screenshot-budget 훅이 settings.json에 등록돼 있지 않다 — 파일만 있으면 안 돈다');
  for (const tool of [
    'mcp__claude-in-chrome__computer',
    'mcp__claude-in-chrome__browser_batch',
    'mcp__Claude_Browser__computer',
    'mcp__computer-use__screenshot',
    'mcp__computer-use__computer_batch',
    // 08-05: 액션 수 상한을 신설하면서 라우팅도 같이 넓혔다. 배치 도구가 하나라도 빠지면
    // 훅이 아무리 정확해도 안 불리고, 죽는 방향은 언제나 「통과」다.
    'mcp__computer-use__teach_batch',
    // 08-04(5번째): 배치는 다 잡았는데 **액션 필드 없는 단건 도구** 셋이 빠져 있었다.
    'mcp__computer-use__scroll',
    'mcp__computer-use__teach_step',
    'mcp__claude-in-chrome__gif_creator',
  ]) {
    assert.ok(
      new RegExp(entry.matcher).test(tool),
      `매처가 ${tool} 를 안 잡는다 — 훅이 정확해도 호출되지 않으면 통과가 된다`
    );
  }
});

test('판정층은 하나다 — settings.json이 액션을 따로 걸러선 안 된다', (t) => {
  const p = SETTINGS;
  if (!fs.existsSync(p)) return t.skip('settings.json 없음');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cmd = (cfg.hooks?.PreToolUse || [])
    .flatMap((e) => e.hooks || [])
    .map((h) => String(h.command || ''))
    .find((c) => c.includes('screenshot-budget.js')) || '';
  assert.ok(
    !/case .*\bin \*(screenshot|zoom)/.test(cmd),
    'settings.json이 액션을 다시 거르고 있다 — 판정이 두 곳이면 두 곳 다 고쳐야 하고, 08-04엔 둘 다 배치를 몰랐다'
  );
});

// ── 4번째 실패(08-05 실측)의 회귀 ─────────────────────────────────────────────
// 훅도 매처도 멀쩡한데 하루 146장이 통과했다. 샌 곳은 **예산의 단위**였다:
// 상한이 세션당이라 하루 24세션이면 상한도 24배가 된다. 처방 = 일일 누적 층.

// 하루치를 상한까지 채운다 — 세션당 5장(세션 상한 9 이내)씩 여러 세션으로.
function fillDay(day) {
  let last;
  for (let i = 0; i < DAY_HARD / 5; i += 1) {
    const s = freshSession();
    for (let k = 0; k < 5; k += 1) last = call(s, { day });
  }
  return last;
}

test('세션을 갈아타도 일일 예산은 이어진다 (08-04엔 이 경로로 하루 146장이 통과했다)', () => {
  const day = freshSession();
  const last = fillDay(day);
  assert.strictEqual(last.decision, 'allow', `${DAY_HARD}장째는 아직 상한 이내여야 한다`);

  const r = call(freshSession(), { day });
  assert.strictEqual(r.decision, 'deny', '새 세션을 열었더니 일일 예산이 리셋됐다 — 4번째 실패의 재발');
  assert.match(r.reason, /일일 상한/, '왜 막혔는지(일일 상한)가 안 보인다');
  assert.match(r.reason, /read_page/, '대체 수단이 없다');
});

test('세션만 리셋해도 일일 예산은 남는다 (리셋으로 우회할 수 있으면 층이 없는 것과 같다)', () => {
  const day = freshSession();
  const s = freshSession();
  for (let i = 0; i < DAY_HARD - 5; i += 1) call(freshSession(), { day });
  for (let i = 0; i < 5; i += 1) call(s, { day });

  reset(s, { day });                       // 세션 예산만 푼다
  const r = call(s, { day });
  assert.strictEqual(r.decision, 'deny', '세션 리셋이 일일 예산까지 풀었다');
  assert.match(r.reason, /일일 상한/);
});

test('전체 리셋(--reset)은 일일 예산도 푼다 (금지가 목적이 아니다)', () => {
  const day = freshSession();
  fillDay(day);
  assert.strictEqual(call(freshSession(), { day }).decision, 'deny', '전제: 이미 일일 상한');

  reset(null, { day, all: true });
  const r = call(freshSession(), { day });
  assert.strictEqual(r.decision, 'allow', '전체 리셋 후에도 막혔다 — 빠져나갈 통로가 없다');
});

test('날이 바뀌면 일일 예산이 초기화된다', () => {
  const d1 = freshSession();
  const d2 = freshSession();
  fillDay(d1);
  assert.strictEqual(call(freshSession(), { day: d1 }).decision, 'deny', '전제: d1은 이미 상한');

  const r = call(freshSession(), { day: d2 });
  assert.strictEqual(r.decision, 'allow', '날이 바뀌었는데 예산이 안 풀렸다');
  assert.ok(r.silent, '새 날의 첫 장은 조용해야 한다');
});

// ── 한 호출의 액션 수 (20블록 룩백) ───────────────────────────────────────────
// 그림과 무관한 층이다. 클릭만 든 대형 배치도 결과 블록을 그만큼 만들고,
// 20블록을 넘기면 다음 턴이 프리픽스를 통째로 재캐시한다(쓰기 = 읽기의 12.5배).

test(`그림이 없어도 액션이 ${BLOCK_HARD}개를 넘으면 차단한다`, () => {
  const acts = Array(BLOCK_HARD + 1).fill('left_click');
  const r = call(freshSession(), {
    tool: 'mcp__computer-use__computer_batch',
    input: BATCH_FLAT(...acts),
  });
  assert.strictEqual(r.decision, 'deny', `액션 ${BLOCK_HARD + 1}개짜리 배치가 통과했다`);
  assert.match(r.reason, /20/, '왜 막는지(20블록 룩백)를 안 알려준다');
  assert.match(r.reason, /--reset/, '빠져나갈 통로를 안 알려준다');
});

test(`액션 ${BLOCK_FREE + 1}개부터는 통과하되 눈에 보인다`, () => {
  const acts = Array(BLOCK_FREE + 1).fill('left_click');
  const r = call(freshSession(), {
    tool: 'mcp__claude-in-chrome__browser_batch',
    input: BATCH_NESTED(...acts),
  });
  assert.strictEqual(r.decision, 'allow', '경고 구간인데 막혔다');
  assert.ok(!r.silent, '경고 구간인데 조용하다');
  assert.match(r.reason, new RegExp(`액션 ${BLOCK_FREE + 1}개`), '몇 개인지가 안 보인다');
});

test(`액션 ${BLOCK_FREE}개까지는 조용하다 (평범한 배치를 벌주면 배치를 못 쓴다)`, () => {
  const acts = Array(BLOCK_FREE).fill('left_click');
  const r = call(freshSession(), {
    tool: 'mcp__computer-use__computer_batch',
    input: BATCH_FLAT(...acts),
  });
  assert.ok(r.silent, '평범한 크기의 배치가 잔소리를 유발했다');
});

test('망가진 입력에도 작업을 막지 않는다 (예산 관리는 안전장치가 아니다)', () => {
  const r = spawnSync(process.execPath, [HOOK], { input: '이건 JSON이 아니다', encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual((r.stdout || '').trim(), '', '입력을 못 읽었는데 차단했다');
});
