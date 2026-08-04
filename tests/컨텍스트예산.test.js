/**
 * context-budget 훅 회귀 — 「끊을 지점」 신호가 실제로 켜지고, 아닐 때 안 켜진다
 *
 * 왜 있나 — 이 훅은 **막지 않는** 계기판이라 고장 나도 아무것도 안 깨진다.
 *   즉 조용히 죽어도 화면은 평소와 똑같다(= 가드가 새는 방향은 언제나 「통과」).
 *   그래서 탐지 능력을 픽스처로 못박는다.
 *
 * 탐지 능력은 **픽스처가 진다** — 실저장소·실세션 트랜스크립트에 기대지 않는다.
 *   실환경 의존 검사(git 트리 상태 등)는 CI에서 깨지거나 조용히 미실행된다(CLAUDE.md).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'context-budget.js');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');

/** usage 레코드 한 줄. 세 항목의 **합**이 컨텍스트다(하나만 크면 안 걸려야 한다). */
function line(read, create, inp) {
  return JSON.stringify({
    type: 'assistant',
    message: {
      usage: {
        input_tokens: inp || 0,
        cache_read_input_tokens: read || 0,
        cache_creation_input_tokens: create || 0,
        output_tokens: 500,
      },
    },
  });
}

let tmpRoot;
test.before(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ctxbudget-'));
});
test.after(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 무해 */ }
});

let seq = 0;
/** 픽스처 트랜스크립트를 만들고 훅을 돌려 stdout 을 판정으로 돌려준다 */
function runHook(lines, opts) {
  const o = opts || {};
  const tp = path.join(tmpRoot, `t${seq++}.jsonl`);
  fs.writeFileSync(tp, lines.join('\n') + '\n');
  const input = JSON.stringify({
    session_id: 'ctxbudget-test',
    hook_event_name: 'Stop',
    transcript_path: 'transcript_path' in o ? o.transcript_path : tp,
    cwd: o.cwd || path.join(tmpRoot, 'not-a-git-repo'),
  });
  const r = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8', timeout: 20000 });
  const out = (r.stdout || '').trim();
  if (!out) return { silent: true, status: r.status, msg: '' };
  const j = JSON.parse(out);
  return { silent: false, status: r.status, msg: String(j.systemMessage || ''), json: j };
}

test('임계 아래에서는 조용하다 — 평소 작업을 방해하지 않는다', () => {
  for (const ctx of [40_000, 90_000, 119_000]) {
    const v = runHook([line(ctx - 1000, 500, 500)]);
    assert.ok(v.silent, `${ctx} 토큰에서 말을 걸었다 — 임계(120k) 아래는 조용해야 한다`);
  }
});

test('120k 초과에서 🟡 신호를 낸다', () => {
  const v = runHook([line(125_000, 2_000, 500)]);
  assert.ok(!v.silent, '127.5k 인데 조용하다 — 신호가 안 켜졌다');
  assert.match(v.msg, /🟡/, '경고 단계 표식이 없다');
  assert.match(v.msg, /트랙을 닫을 준비/, '무엇을 하라는지가 없다');
});

test('150k 초과에서 🔴「지금 끊을 지점」으로 올라간다', () => {
  const v = runHook([line(155_000, 3_000, 500)]);
  assert.match(v.msg, /🔴/, '위험 단계 표식이 없다');
  assert.match(v.msg, /지금 끊을 지점/, '종료 지시가 없다');
});

test('컨텍스트는 세 항목의 합이다 — 한 항목만으로는 못 넘는다', () => {
  // 각각은 임계 아래지만 합치면 135k. 합산을 빠뜨리면 이 케이스가 조용해진다.
  const v = runHook([line(60_000, 60_000, 15_000)]);
  assert.ok(!v.silent, '60k+60k+15k = 135k 인데 조용하다 — 합산이 아니라 한 항목만 보고 있다');
  assert.match(v.msg, /135k/, `합산값이 안 보인다: ${v.msg}`);
});

test('🔑 마지막 usage 를 읽는다 — 컴팩트로 컨텍스트가 내려가면 신호도 꺼진다', () => {
  // 이 훅의 유일한 「조용해져야 하는」 상태 변화다. 앞줄만 보거나 최대값을 쓰면
  // 컴팩트 직후에도 계속 「끊어라」를 외쳐 신호가 무의미해진다.
  const v = runHook([
    line(175_000, 2_000, 500), // 컴팩트 직전
    line(70_000, 3_000, 500),  // 컴팩트 직후 — 실제 API 가 받은 양이 내려간다
  ]);
  assert.ok(v.silent, `컴팩트 후 73.5k 인데 아직 경고한다 — 마지막 usage 가 아니라 옛 값을 보고 있다: ${v.msg}`);
});

test('usage 없는 줄이 섞여도 마지막 usage 를 찾아낸다', () => {
  const v = runHook([
    JSON.stringify({ type: 'user', message: { content: 'x' } }),
    line(130_000, 2_000, 500),
    JSON.stringify({ type: 'user', message: { content: 'y' } }),
    '', // 빈 줄
    '{망가진 JSON',
  ]);
  assert.ok(!v.silent, '뒤에 usage 없는 줄들이 붙자 못 찾았다 — 역방향 탐색이 첫 실패에서 멈춘다');
  assert.match(v.msg, /132\.5k|133k/, `합산값이 이상하다: ${v.msg}`);
});

test('트랜스크립트가 없거나 usage 가 하나도 없으면 조용히 통과한다 (거짓양성 0)', () => {
  assert.ok(runHook([], { transcript_path: path.join(tmpRoot, '없는파일.jsonl') }).silent,
    '없는 트랜스크립트에 반응했다');
  assert.ok(runHook([], { transcript_path: '' }).silent, '빈 경로에 반응했다');
  assert.ok(runHook([JSON.stringify({ type: 'user', message: { content: 'x' } })]).silent,
    'usage 가 없는데 반응했다');
});

test('git 을 못 부르는 위치에서도 죽지 않고, 미커밋을 「0건」으로 단정하지 않는다', () => {
  const v = runHook([line(155_000, 1_000, 500)], { cwd: path.join(tmpRoot, 'not-a-git-repo') });
  assert.strictEqual(v.status, 0, '비-git 위치에서 훅이 실패 종료했다 — 계기판이 작업을 방해하면 안 된다');
  assert.doesNotMatch(v.msg, /잃는 게 없다/,
    'git 판정 불가인데 「미커밋 0건」 쪽 문구를 냈다 — 모름과 0건은 다르다');
  assert.match(v.msg, /미커밋 확인/, '판정 불가일 때 확인을 시키지 않는다');
});

test('미커밋이 있으면 커밋을 먼저 시키고, 없으면 끊어도 된다고 말한다', (t) => {
  const g = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10000 });
  if (g(['--version']).error) return t.skip('git 없음 — 미커밋 분기 검사 건너뜀');

  const repo = fs.mkdtempSync(path.join(tmpRoot, 'repo-'));
  if (g(['init'], repo).status !== 0) return t.skip('git init 실패 — 분기 검사 건너뜀');

  const clean = runHook([line(155_000, 1_000, 500)], { cwd: repo });
  assert.match(clean.msg, /잃는 게 없다/, `미커밋 0건인데 안전 문구가 없다: ${clean.msg}`);

  fs.writeFileSync(path.join(repo, '새파일.txt'), 'x');
  const dirty = runHook([line(155_000, 1_000, 500)], { cwd: repo });
  assert.match(dirty.msg, /미커밋 1건 먼저 커밋/, `미커밋 1건을 못 셌다: ${dirty.msg}`);
});

test('등록층 — Stop 에 등록돼 있고, 앞단에서 좁히는 필터가 없다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const entries = (s.hooks && s.hooks.Stop) || [];
  const cmds = entries.flatMap((e) => (e.hooks || []).map((h) => String(h.command || '')));
  const mine = cmds.filter((c) => /hooks\/context-budget\.js/.test(c));
  assert.strictEqual(mine.length, 1, 'context-budget 이 Stop 이벤트에 등록돼 있지 않다 — 파일만 있으면 안 돈다');
  // 「라우팅은 훅보다 넓어야 한다」 — Stop 은 거를 tool_input 이 없으므로 case 필터 자체가 구멍이다
  assert.doesNotMatch(mine[0], /case "\$IN" in/,
    '앞단 case 필터가 붙었다 — 판정층이 둘이 되면 조용히 샌다(F053)');
  assert.match(mine[0], /\$\{CLAUDE_PROJECT_DIR:-\$PWD\}/,
    '등록이 로컬 절대경로다 — 다른 기계에서 통째로 죽는다(F044)');
});
