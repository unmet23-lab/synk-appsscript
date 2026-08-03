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
const FREE = 4;
const HARD = 9;

let seq = 0;
function freshSession() {
  seq += 1;
  return `synk-test-${process.pid}-${seq}`;
}

function call(sessionId, { tool = 'mcp__claude-in-chrome__computer', action = 'screenshot' } = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: sessionId, tool_name: tool, tool_input: { action } }),
    encoding: 'utf8',
  });
  const out = (r.stdout || '').trim();
  if (!out) return { decision: 'allow', reason: '', silent: true };
  const j = JSON.parse(out).hookSpecificOutput;
  return { decision: j.permissionDecision, reason: j.permissionDecisionReason, silent: false };
}

function reset(sessionId) {
  spawnSync(process.execPath, [HOOK, '--reset', '--session', sessionId], { encoding: 'utf8' });
}

test.after(() => {
  // 테스트가 남긴 카운터 정리 (실환경 예산을 건드리지 않는다)
  const dir = path.join(os.tmpdir(), 'synk-screenshot-budget');
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(`synk-test-${process.pid}-`)) fs.unlinkSync(path.join(dir, f));
    }
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

test('세션이 다르면 예산도 따로다 (남의 세션이 내 예산을 먹지 않는다)', () => {
  const a = freshSession();
  const b = freshSession();
  for (let i = 1; i <= HARD; i += 1) call(a);
  const r = call(b);
  assert.strictEqual(r.decision, 'allow', '다른 세션의 소비가 내 예산에 잡혔다');
  assert.ok(r.silent);
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

test('망가진 입력에도 작업을 막지 않는다 (예산 관리는 안전장치가 아니다)', () => {
  const r = spawnSync(process.execPath, [HOOK], { input: '이건 JSON이 아니다', encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual((r.stdout || '').trim(), '', '입력을 못 읽었는데 차단했다');
});
