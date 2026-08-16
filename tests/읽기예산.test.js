/**
 * read-budget 회귀 — 큰 파일 전문 읽기 예산
 *
 * 왜 있나: 2026-08-05 유호님 마찰("답변할때마다 너무 느리고 토큰도 엄청 잡아먹거든?
 *   중요한 작업이나 스킬 쓸 때 말고는 간단한 md파일만 읽고 답변해줬으면 좋겠어").
 *   진단은 앱스크립트가 아니라 **메모리 파일 1개 = 36,111 토큰**이었다.
 *   CLAUDE.md에 「큰 파일 전체 읽기 금지」 조항이 **이미 있는 상태에서** 그 사고가 났다 —
 *   프로즈가 샜으니 기계로 옮겼고, 여기서 그 기계가 실제로 세고 실제로 막는지를 못박는다.
 *
 * 검사 범위는 세 층 전부 — 로직 / 등록층(settings.json 매처) / **자기 처방**.
 *   세 번째가 핵심이다: 차단 사유가 시키는 명령을 그 가드에 되먹여 통과하는지 본다.
 *   따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).
 *
 * 실저장소 상태에 의존하지 않는다 — 픽스처를 임시 폴더에 만들어 탐지력을 재고,
 *   실저장소는 등록층만 본다(거짓양성 검사).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { 훅띄우기 } = require('./lib/훅띄우기');

// 변이 실험용 이음매. 평소엔 실훅·실등록을 본다.
const HOOK = process.env.SYNK_TEST_HOOK || path.resolve(__dirname, '..', '.claude', 'hooks', 'read-budget.js');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.resolve(__dirname, '..', '.claude', 'settings.json');

// 훅과 같은 값. 여기 손으로 적는 이유 = 훅이 상수를 조용히 바꾸면 이 검사가 깨져서 드러난다.
const FREE = 3;
const HARD = 6;
const DAY_HARD = 18;
const REREAD_FREE = 2;
const REREAD_HARD = 5;
const BIG = 16 * 1024;
const CHUNK = 400;
// 누적 바이트 층(2026-08-16). 훅 상수를 import 하지 않고 **여기 따로 적는다** — 우리 상수를
// 빌려 쓰면 상수가 틀린 날 테스트도 같이 초록이 된다(F457 과 같은 축).
const SESS_BYTES_WARN = 100 * 1024;
const SESS_BYTES_HARD = 250 * 1024;

// 카운터를 임시 폴더에 격리한다 — 안 하면 이 테스트가 실환경 일일 예산을 먹어 치운다.
const BUDGET_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-read-budget-test-'));
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-read-fix-'));

let seq = 0;
function freshSession() {
  seq += 1;
  return `synk-read-test-${process.pid}-${seq}`;
}

// 큰 파일 픽스처. 이름을 갈아가며 만들어 **파일별 재읽기 카운터가 섞이지 않게** 한다
// (섞이면 세션 예산 검사가 재읽기 차단에 걸려 엉뚱한 이유로 초록/빨강이 된다).
let fixSeq = 0;
function bigFile(bytes) {
  fixSeq += 1;
  const p = path.join(FIX, `big-${fixSeq}.md`);
  fs.writeFileSync(p, 'ㄱ'.repeat(Math.ceil((bytes || BIG + 4096) / 3)));
  assert.ok(fs.statSync(p).size > BIG, '픽스처가 실제로 임계보다 커야 한다');
  return p;
}

function smallFile() {
  fixSeq += 1;
  const p = path.join(FIX, `small-${fixSeq}.md`);
  fs.writeFileSync(p, '작은 파일');
  assert.ok(fs.statSync(p).size <= BIG);
  return p;
}

function call(sessionId, tool_input, { tool = 'Read', day } = {}) {
  const r = 훅띄우기(HOOK, {
    input: JSON.stringify({ session_id: sessionId, tool_name: tool, tool_input }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_BUDGET_DIR: BUDGET_DIR, SYNK_BUDGET_DAY: day || sessionId },
  });
  const out = (r.stdout || '').trim();
  if (!out) return { decision: 'allow', reason: '', silent: true };
  const j = JSON.parse(out).hookSpecificOutput;
  return { decision: j.permissionDecision, reason: j.permissionDecisionReason, silent: false };
}

function reset(sessionId, { all = false } = {}) {
  const args = all ? [HOOK, '--reset'] : [HOOK, '--reset', '--session', sessionId];
  훅띄우기(args, {
    encoding: 'utf8',
    env: { ...process.env, SYNK_BUDGET_DIR: BUDGET_DIR },
  });
}

test.after(() => {
  fs.rmSync(BUDGET_DIR, { recursive: true, force: true });
  fs.rmSync(FIX, { recursive: true, force: true });
});

// ── ① 거짓양성: 막으면 안 되는 것들 ─────────────────────────────────────────
// 탐지력만 검사하고 이쪽을 빼면, 가드가 「전부 차단」으로 퇴화해도 초록이 된다.

test('작은 파일은 조용히 통과한다', () => {
  const s = freshSession();
  const r = call(s, { file_path: smallFile() });
  assert.ok(r.silent, '작은 파일에 말을 걸면 안 된다: ' + r.reason);
});

test('없는 파일은 통과한다 (예산 문제가 아니라 Read 자신이 알릴 일)', () => {
  const s = freshSession();
  const r = call(s, { file_path: path.join(FIX, '없는파일.md') });
  assert.ok(r.silent);
});

test('Read 가 아닌 도구는 건드리지 않는다 (Grep = 처방이 시키는 경로)', () => {
  const s = freshSession();
  const big = bigFile();
  for (const tool of ['Grep', 'Edit', 'Write', 'Bash']) {
    const r = call(s, { file_path: big, pattern: 'x' }, { tool });
    assert.ok(r.silent, `${tool} 을 막으면 안 된다`);
  }
});

test('이미지·PDF 는 이 층의 대상이 아니다', () => {
  const s = freshSession();
  for (const ext of ['.png', '.jpg', '.pdf']) {
    const p = path.join(FIX, `img${ext}`);
    fs.writeFileSync(p, Buffer.alloc(BIG + 4096));
    const r = call(s, { file_path: p });
    assert.ok(r.silent, `${ext} 를 막으면 안 된다`);
  }
});

test(`전문 ${FREE}개까지는 조용하다 (정상 작업을 벌주지 않는다)`, () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) {
    const r = call(s, { file_path: bigFile() });
    assert.ok(r.silent, `${i}번째에서 이미 말을 걸었다: ${r.reason}`);
  }
});

// ── ② 탐지력: 실제로 세고 실제로 막는가 ──────────────────────────────────────

test(`전문 ${FREE}개 초과부터 경고하고 ${HARD}개 초과에서 차단한다`, () => {
  const s = freshSession();
  for (let i = 1; i <= FREE; i += 1) call(s, { file_path: bigFile() });

  const warn = call(s, { file_path: bigFile() }); // FREE+1
  assert.strictEqual(warn.decision, 'allow');
  assert.ok(!warn.silent, 'FREE 초과인데 조용하다 — 예산이 안 세어지고 있다');
  assert.match(warn.reason, /세션 4\/6/);

  for (let i = FREE + 2; i <= HARD; i += 1) {
    const r = call(s, { file_path: bigFile() });
    assert.strictEqual(r.decision, 'allow', `${i}번째는 아직 통과여야 한다`);
  }

  const blocked = call(s, { file_path: bigFile() }); // HARD+1
  assert.strictEqual(blocked.decision, 'deny', `${HARD}개 초과인데 통과했다`);
  assert.match(blocked.reason, /세션 상한/);
});

test('같은 파일 재읽기를 따로 센다 (전문 예산만으로는 안 보이는 층)', () => {
  const s = freshSession();
  const one = bigFile();
  for (let i = 1; i <= REREAD_FREE; i += 1) {
    const r = call(s, { file_path: one, limit: 100 });
    assert.ok(r.silent, `구역 읽기 ${i}회는 조용해야 한다: ${r.reason}`);
  }
  const warn = call(s, { file_path: one, limit: 100 });
  assert.strictEqual(warn.decision, 'allow');
  assert.match(warn.reason, /3번째/);

  for (let i = REREAD_FREE + 2; i <= REREAD_HARD; i += 1) call(s, { file_path: one, limit: 100 });
  const blocked = call(s, { file_path: one, limit: 100 });
  assert.strictEqual(blocked.decision, 'deny', '같은 파일 상한을 안 막았다');
  assert.match(blocked.reason, /같은 파일 상한/);
});

test('일일 예산은 세션을 갈아타도 살아남는다 (08-04 스크린샷과 같은 형태의 구멍)', () => {
  const day = `day-${process.pid}-${seq}`;
  let last = null;
  for (let i = 1; i <= DAY_HARD + 1; i += 1) {
    // 매번 새 세션 = 세션 예산은 절대 안 참. 일일 층이 없으면 전부 통과한다.
    last = call(freshSession(), { file_path: bigFile() }, { day });
  }
  assert.strictEqual(last.decision, 'deny', '세션을 갈아타며 일일 상한을 넘었는데 통과했다');
  assert.match(last.reason, /일일 상한/);
});

test('세션만 리셋해도 일일 예산은 그대로다', () => {
  const day = `day2-${process.pid}-${seq}`;
  const s = freshSession();
  for (let i = 1; i <= DAY_HARD + 1; i += 1) call(freshSession(), { file_path: bigFile() }, { day });
  reset(s); // 세션 리셋
  const r = call(s, { file_path: bigFile() }, { day });
  assert.strictEqual(r.decision, 'deny', '세션 리셋이 일일 예산까지 지웠다');
});

// ── ③ 구역 읽기 = 처방이 시키는 경로. 벌주면 안 되고, 흉내내도 안 된다 ────────

test(`limit ≤ ${CHUNK} 는 전문 예산을 먹지 않는다`, () => {
  const s = freshSession();
  for (let i = 1; i <= HARD + 3; i += 1) {
    const r = call(s, { file_path: bigFile(), offset: 100, limit: CHUNK });
    assert.notStrictEqual(r.decision, 'deny', `구역 읽기 ${i}회째가 차단됐다 — 처방을 따를 수 없게 된다`);
  }
});

test(`limit > ${CHUNK} 는 전문으로 센다 (큰 limit 으로 우회 못 한다)`, () => {
  const s = freshSession();
  for (let i = 1; i <= HARD; i += 1) call(s, { file_path: bigFile(), limit: CHUNK + 1 });
  const r = call(s, { file_path: bigFile(), limit: 99999 });
  assert.strictEqual(r.decision, 'deny', '큰 limit 이 예산을 우회했다');
});

test('offset 만 있고 limit 이 없으면 전문이다 (끝까지 읽는다는 뜻)', () => {
  const s = freshSession();
  for (let i = 1; i <= HARD; i += 1) call(s, { file_path: bigFile(), offset: 50 });
  const r = call(s, { file_path: bigFile(), offset: 50 });
  assert.strictEqual(r.decision, 'deny', 'offset 만으로 예산을 우회했다');
});

// ── ④ 자기 처방 (F103) — 차단 사유가 시키는 것이 실제로 통과하는가 ───────────

test('차단 사유가 시키는 두 방법이 그 가드를 실제로 통과한다', () => {
  const s = freshSession();
  for (let i = 1; i <= HARD; i += 1) call(s, { file_path: bigFile() });
  const blocked = call(s, { file_path: bigFile() });
  assert.strictEqual(blocked.decision, 'deny');

  // 처방①: Grep 으로 찾고 limit 으로 구역만 → 통과해야 한다
  assert.match(blocked.reason, /Grep/, '처방에 Grep 이 없다');
  assert.match(blocked.reason, /limit/, '처방에 limit 이 없다');
  const viaChunk = call(s, { file_path: bigFile(), offset: 1, limit: CHUNK });
  assert.notStrictEqual(viaChunk.decision, 'deny', '처방대로 구역을 읽었는데 여전히 막힌다');

  // 처방②: --reset → 통과해야 한다
  assert.match(blocked.reason, /--reset/, '처방에 리셋 통로가 없다');
  reset(s);
  const viaReset = call(s, { file_path: bigFile() });
  assert.notStrictEqual(viaReset.decision, 'deny', '리셋했는데 여전히 막힌다');
});

// ── ⑤ 등록층 — 가드는 로직보다 등록층에서 샌다 ──────────────────────────────

test('settings.json 이 Read 를 이 훅으로 라우팅한다', () => {
  const cfg = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const pre = (cfg.hooks && cfg.hooks.PreToolUse) || [];
  const entry = pre.find((b) => (b.hooks || []).some((h) => String(h.command || '').includes('read-budget.js')));
  assert.ok(entry, 'read-budget.js 가 PreToolUse 에 등록돼 있지 않다 — 훅이 아예 안 돈다');

  // 매처가 Read 를 실제로 잡는가. 훅은 tool_name==='Read' 만 처리하므로 라우팅이 그보다 좁으면 구멍이다.
  assert.ok(new RegExp(`^(?:${entry.matcher})$`).test('Read'), `매처가 Read 를 안 잡는다: ${entry.matcher}`);

  const cmd = entry.hooks.find((h) => String(h.command || '').includes('read-budget.js')).command;
  // 이식성: 로컬 절대경로면 다른 기계에서 통째로 죽는다(F044)
  assert.ok(cmd.includes('${CLAUDE_PROJECT_DIR:-$PWD}'), '등록이 프로젝트 변수+폴백을 안 쓴다');
  assert.ok(!/[A-Za-z]:\\/.test(cmd), '등록에 윈도 절대경로가 박혔다');
  // 실패 안전: 훅을 못 찾으면 통과가 아니라 차단이어야 한다
  assert.ok(cmd.includes('"permissionDecision":"deny"'), '훅 미실행 시 통과하게 돼 있다(F044)');
});

// ── ③ 누적 바이트 층 (2026-08-16 신설) ─────────────────────────────────────
// 왜: 옛 층은 16KB 이상만 봤고, 실측에서 그건 Read 소모의 **17.6%** 였다.
//     나머지 82.4%(특히 2~8KB 구간이 혼자 48.5%)는 어느 층도 안 보고 있었다.
//     훅은 그동안 «맞는 얼굴로» 돌고 있었다 — 안 도는 쪽보다 이쪽이 더 위험하다(맹점 ④).
// 픽스처가 BIG **아래**인 것이 이 절의 핵심이다 — 개수 층이 못 보는 크기여야
// 「무엇이 잡았는지」가 갈린다.

function midFile(bytes) {
  fixSeq += 1;
  const p = path.join(FIX, `mid-${fixSeq}.md`);
  fs.writeFileSync(p, 'ㄱ'.repeat(Math.ceil((bytes || 15 * 1024) / 3)));
  const sz = fs.statSync(p).size;
  assert.ok(sz <= BIG, '이 픽스처는 개수 층 경계 아래여야 한다 — 아니면 무엇이 잡았는지 못 가른다');
  return p;
}

test('정상 세션(실측 p50 = 33KB)은 누적 층을 만나지도 않는다', () => {
  const s = freshSession();
  let r;
  for (let i = 1; i <= 2; i += 1) r = call(s, { file_path: midFile(15 * 1024) });
  assert.ok(r.silent,
    '30KB 에서 울면 실측 세션의 절반이 매번 경고를 본다 — 그런 가드는 곧 꺼진다');
});

test('16KB 미만 파일이 쌓이면 누적 층이 잡는다 (옛 층이 통째로 못 보던 구간)', () => {
  const s = freshSession();
  let r;
  for (let i = 1; i <= 7; i += 1) r = call(s, { file_path: midFile(15 * 1024) });
  assert.ok(!r.silent,
    `누적 105KB(경고선 ${SESS_BYTES_WARN / 1024}KB)인데 조용하다 — 바이트 층이 안 세어지고 있다`);
  assert.notStrictEqual(r.decision, 'deny', '경고 자리에서 차단하면 정상 작업이 막힌다');
  assert.match(r.reason, /세션 누적/, '무엇이 걸렸는지 문구가 말해야 한다');
});

test('누적이 세션 상한을 넘으면 차단한다', () => {
  const s = freshSession();
  let r;
  for (let i = 1; i <= 17; i += 1) r = call(s, { file_path: midFile(15 * 1024) });
  assert.strictEqual(r.decision, 'deny',
    `누적 255KB 인데 통과했다 — 상한 ${SESS_BYTES_HARD / 1024}KB`);
  assert.match(r.reason, /세션 상한/);
});

test('구역 읽기는 누적 바이트를 안 먹는다 (처방을 벌주면 우회가 정상 통로가 된다 · F103)', () => {
  const s = freshSession();
  const big = bigFile(60 * 1024);
  let r;
  for (let i = 1; i <= 2; i += 1) r = call(s, { file_path: big, limit: 100 });
  // 전문이었으면 120KB 라 경고선을 넘었을 자리다.
  assert.ok(r.silent || !/누적/.test(r.reason || ''),
    '구역 읽기가 누적을 먹으면 차단 사유가 시키는 그 경로가 같은 가드에 막힌다');
});

test('일일 누적도 세션을 갈아타면 살아남는다 (바이트 축 — 변이가 구멍으로 잡은 자리)', () => {
  const day = `bytes-day-${process.pid}`;
  let r;
  // 세션마다 1장씩 = 세션 누적은 절대 안 걸린다. 걸릴 수 있는 건 일일 축뿐이다.
  for (let i = 1; i <= 11; i += 1) {
    r = call(freshSession(), { file_path: bigFile(60 * 1024) }, { day });
  }
  assert.match(r.reason || '', /오늘 누적/,
    '세션을 갈아타면 바이트 예산이 리셋된다 — 08-04 스크린샷과 같은 형태의 구멍');
});

test('작은 파일도 누적에 실린다 (경계 아래라고 0으로 치면 82.4% 가 다시 사각이 된다)', () => {
  const s = freshSession();
  for (let i = 1; i <= 6; i += 1) call(s, { file_path: midFile(15 * 1024) });
  // 여기까지 90KB — 아직 조용하다. 다음 한 장이 경고선을 넘긴다.
  const r = call(s, { file_path: midFile(15 * 1024) });
  assert.ok(!r.silent, '작은 파일이 누적에서 빠지면 이 자리가 영원히 조용하다');
});
