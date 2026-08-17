/* 재심신호 회귀 — 「모델이 갈렸나 · 주기가 도래했나」 판정.
 *
 * 🔑 이 검사가 지키는 것은 **「0번 돌았다」의 재발 방지**다(2026-08-17 실측: 유호 상시 08-10
 *   「새 강력 모델마다 전층 재검토」가 네 층 전수 발동 0 — 발동 조건을 사람 손에 걸었기 때문).
 *   그래서 탐지력만큼이나 **「못 읽었을 때 조용히 통과하지 않는가」**를 무겁게 검사한다 —
 *   새는 방향은 언제나 「통과」다(CLAUDE.md 신뢰성 ④).
 *
 * ⚠ 날짜에 기대는 검사는 CI 에서 깨진다(F296). 그래서 `지금` 을 **전부 주입**하고
 *   시스템 시계를 한 번도 안 읽는다 — 수요일에만 초록인 검사는 회귀가 아니라 함정이다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 신호 = require('../tools/lib/재심신호.js');

/** 픽스처 저장소 — 로그 줄들을 심고 뿌리 경로를 돌려준다. */
function 뿌리만들기(줄들) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-재심-'));
  const 경로 = path.join(뿌리, 신호.로그상대경로);
  fs.mkdirSync(path.dirname(경로), { recursive: true });
  fs.writeFileSync(경로, (줄들 || []).map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n')
    + ((줄들 || []).length ? '\n' : ''), 'utf8');
  return 뿌리;
}

const 날 = (s) => 신호.날짜파싱(s);

/* ── 모델 변경 탐지 ─────────────────────────────────────────── */

test('탐지: 모델이 갈리면 잡는다 (픽스처)', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-10', 모델: 'claude-opus-4', 사건: '관측' }]);
  const r = 신호.판정({ 모델: 'claude-opus-5', 뿌리, 지금: 날('2026-08-17') });
  assert.equal(r.측정, true);
  assert.ok(r.모델바뀜, '모델이 갈렸는데 못 잡았다');
  assert.equal(r.모델바뀜.이전, 'claude-opus-4');
  assert.equal(r.모델바뀜.지금, 'claude-opus-5');
  assert.equal(r.모델바뀜.이전날짜, '2026-08-10');
});

test('거짓양성 0: 같은 모델이면 안 잡는다', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-10', 모델: 'claude-opus-5', 사건: '관측' }]);
  const r = 신호.판정({ 모델: 'claude-opus-5', 뿌리, 지금: 날('2026-08-11') });
  assert.equal(r.모델바뀜, null);
  assert.equal(r.적을줄, null, '안 갈렸는데 관측 줄을 또 적으면 로그가 소음이 된다');
});

test('로그 비대 방지: 관측 줄은 첫 회차와 «갈릴 때»만 적는다', () => {
  const 첫 = 신호.판정({ 모델: 'claude-opus-5', 뿌리: 뿌리만들기([]), 지금: 날('2026-08-17') });
  assert.ok(첫.적을줄, '첫 관측은 적어야 한다 — 안 적으면 다음 세션도 영영 «첫 관측»이다');
  assert.equal(첫.적을줄.사건, '관측');

  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-10', 모델: 'claude-opus-4', 사건: '관측' }]);
  const 갈림 = 신호.판정({ 모델: 'claude-opus-5', 뿌리, 지금: 날('2026-08-17') });
  assert.ok(갈림.적을줄, '갈렸으면 적어야 다음 세션이 새 기준을 쓴다');
});

/* ── 🔴 못 읽었을 때: 「안 바뀌었다」로 접지 않는다 ───────────── */

test('모델을 못 읽으면 «못 쟀다»로 낸다 — 통과로 접히지 않는다', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-10', 모델: 'claude-opus-4', 사건: '관측' }]);
  for (const 모델 of [null, undefined, '', '   ']) {
    const r = 신호.판정({ 모델, 뿌리, 지금: 날('2026-08-17') });
    assert.equal(r.측정, false, `모델=${JSON.stringify(모델)} 인데 측정됐다고 했다`);
    assert.ok(r.사유 && r.사유.length > 0, '못 잰 이유가 비었다');
    assert.equal(r.모델바뀜, null);
    assert.equal(r.적을줄, null, '모델을 모르는데 관측 줄을 적으면 장부가 오염된다');
  }
});

test('모델을 못 읽어도 «주기» 판정은 산다 — 두 트리거는 독립이다', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-01', 모델: 'x', 사건: '재심', 본것: 3, 뒤집음: 0 }]);
  const r = 신호.판정({ 모델: null, 뿌리, 지금: 날('2026-08-17') });
  assert.equal(r.측정, false);
  assert.ok(r.주기도래, '모델을 못 읽었다고 주기까지 죽으면 구멍이 두 배가 된다');
});

test('로그가 아예 없어도 죽지 않는다 (첫 설치일)', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-재심-빈-'));
  const r = 신호.판정({ 모델: 'claude-opus-5', 뿌리, 지금: 날('2026-08-17') });
  assert.equal(r.측정, true);
  assert.equal(r.모델바뀜, null, '비교 대상이 없는 것은 «갈렸다»가 아니다');
  assert.ok(r.적을줄, '첫 줄은 심어야 한다');
  assert.ok(r.주기도래, '재심 이력 0 = 제도 첫 회차라 도래로 친다');
});

test('깨진 줄을 «버리지 않고 센다» — 침묵하면 기록 없음과 못 읽음이 같아진다', () => {
  const 뿌리 = 뿌리만들기(['{ 이건 JSON 이 아니다', { 날짜: '2026-08-10', 모델: 'a', 사건: '관측' }, '또 깨짐']);
  const r = 신호.판정({ 모델: 'b', 뿌리, 지금: 날('2026-08-17') });
  assert.equal(r.깨짐, 2);
  assert.ok(r.모델바뀜, '깨진 줄이 섞여도 성한 줄로는 판정해야 한다');
});

/* ── 주기(수요일) ───────────────────────────────────────────── */

test('주기: 마지막 재심 이후 수요일이 지나면 도래한다', () => {
  // 2026-08-12 는 수요일. 재심을 08-12 에 했다면 다음 도래는 08-19(수).
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-12', 모델: 'm', 사건: '재심', 본것: 5, 뒤집음: 1 }]);
  assert.equal(신호.판정({ 모델: 'm', 뿌리, 지금: 날('2026-08-18') }).주기도래, null, '화요일엔 아직 아니다');
  const r = 신호.판정({ 모델: 'm', 뿌리, 지금: 날('2026-08-19') });
  assert.ok(r.주기도래, '수요일이 왔는데 안 떴다');
  assert.equal(r.주기도래.도래일, '2026-08-19');
});

test('주기: 재심 «당일»에는 다시 안 뜬다 — 같은 날 두 번 뜨면 배경이 된다', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-19', 모델: 'm', 사건: '재심', 본것: 5, 뒤집음: 0 }]);
  assert.equal(신호.판정({ 모델: 'm', 뿌리, 지금: 날('2026-08-19') }).주기도래, null);
});

test('주기: 수요일에 세션을 안 열었어도 다음에 열면 뜬다 (놓친 회차가 사라지지 않는다)', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-12', 모델: 'm', 사건: '재심', 본것: 5, 뒤집음: 0 }]);
  const r = 신호.판정({ 모델: 'm', 뿌리, 지금: 날('2026-08-22') }); // 토요일
  assert.ok(r.주기도래, '수요일을 지나쳤다고 회차가 증발하면 이 제도는 또 0번 돈다');
  assert.equal(r.주기도래.지난날, 10);
});

test('주기: 날짜가 깨진 재심 줄은 «도래»로 드러낸다 — 조용히 잠들지 않는다', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '어제', 모델: 'm', 사건: '재심' }]);
  const r = 신호.판정({ 모델: 'm', 뿌리, 지금: 날('2026-08-17') });
  assert.ok(r.주기도래, '기준을 못 읽으면 안전한 쪽(도래)으로 기울인다');
  assert.match(r.주기도래.사유 || '', /못 읽/);
});

test('다음주기일은 항상 수요일이고, 기준일 자신은 아니다', () => {
  for (const s of ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-23']) {
    const d = 신호.다음주기일(날(s));
    assert.equal(d.getDay(), 신호.주기요일, `${s} → ${신호.날짜문자열(d)} 가 수요일이 아니다`);
    assert.ok(d > 날(s), `${s} 의 다음 주기일이 자기 자신 이하다`);
  }
});

/* ── 기록 ───────────────────────────────────────────────────── */

test('재심완료가 분모와 함께 append 되고, 그 뒤엔 도래가 닫힌다', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-01', 모델: 'm', 사건: '재심', 본것: 1, 뒤집음: 0 }]);
  assert.ok(신호.판정({ 모델: 'm', 뿌리, 지금: 날('2026-08-19') }).주기도래);

  assert.equal(신호.재심완료({ 뿌리, 모델: 'm', 본것: 12, 뒤집음: 2, 지금: 날('2026-08-19') }), true);
  const 줄들 = 신호.로그읽기(path.join(뿌리, 신호.로그상대경로)).줄들;
  const 끝 = 줄들[줄들.length - 1];
  assert.equal(끝.사건, '재심');
  assert.equal(끝.본것, 12);
  assert.equal(끝.뒤집음, 2);
  assert.equal(신호.판정({ 모델: 'm', 뿌리, 지금: 날('2026-08-19') }).주기도래, null, '적었는데도 계속 뜨면 알림이 배경이 된다');
});

test('append-only — 기존 줄을 지우지 않는다', () => {
  const 뿌리 = 뿌리만들기([{ 날짜: '2026-08-01', 모델: 'a', 사건: '관측' }]);
  신호.재심완료({ 뿌리, 모델: 'a', 본것: 1, 뒤집음: 0, 지금: 날('2026-08-19') });
  const 줄들 = 신호.로그읽기(path.join(뿌리, 신호.로그상대경로)).줄들;
  assert.equal(줄들.length, 2);
  assert.equal(줄들[0].사건, '관측');
});

/* ── 대기열 쪽 계약 (〖모델상한〗 = 이 배선의 «무엇을») ──────── */

test('대기열: 〖모델상한〗 표식이 차단 사유로 뽑힌다', () => {
  const 대기열 = require('../tools/대기열.js');
  assert.equal(대기열.모델상한표식, '모델상한');
  assert.equal(대기열.차단(`〖${대기열.모델상한표식}〗 **뭔가** 지금 모델로는 안 된다`), '모델상한');
  assert.equal(대기열.차단('〖지금〗 **집을 수 있다**'), '', '「지금」은 빈 문자열이어야 한다');
  assert.equal(대기열.차단('**표식 없음**'), null, '미표기는 «지금 가능»이 아니라 null(모름)이다');
});

/* ── 🔑 배선 그 자체 (훅 stdin → 전사 → 모델) ────────────────────
 * 판정 로직은 위에서 다 덮었다. 남은 미검증은 **배선**이고, 이 트랙이 고치는 병이
 * 「로직은 멀쩡한데 발동이 안 됐다」라 여기가 진짜 급소다. 자식 프로세스로 stdin 을 실제로 준다. */

/** 전사 픽스처 — `lib/context-size.js` 가 찾는 모양(`message.usage` + `message.model`). */
function 전사만들기(모델) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-전사-')), 't.jsonl');
  fs.writeFileSync(p, `${JSON.stringify({ type: 'x' })}\n`
    + `${JSON.stringify({ message: { model: 모델, usage: { input_tokens: 1234 } } })}\n`, 'utf8');
  return p;
}

/** 대기열의 `세션모델()` 을 **자식 프로세스에서** 부른다 — stdin 은 프로세스 경계에서만 진짜다. */
function 세션모델을(입력) {
  const { execFileSync } = require('node:child_process');
  const 대기열 = path.resolve(__dirname, '..', 'tools', '대기열.js');
  const out = execFileSync(process.execPath,
    ['-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(대기열)}).세션모델()))`],
    { input: 입력 === null ? '' : JSON.stringify(입력), encoding: 'utf8' });
  return JSON.parse(out);
}

test('배선: 훅 stdin 의 transcript_path 로 실제 모델을 뽑는다', () => {
  const r = 세션모델을({ transcript_path: 전사만들기('claude-opus-5'), cwd: '.', session_id: 's' });
  assert.equal(r.훅, true);
  assert.equal(r.모델, 'claude-opus-5', '배선이 끊기면 모델 트리거는 영영 안 돈다');
});

test('배선: stdin 이 아예 없으면 «손 실행»이다 — 경고 대상이 아니다', () => {
  const r = 세션모델을(null);
  assert.equal(r.훅, false, '손 실행을 이상 신호로 세면 경고가 배경이 된다');
  assert.equal(r.모델, null);
});

test('배선: 훅인데 못 읽으면 «훅=true + 사유»로 드러난다 — 손 실행과 같은 모양이 아니다', () => {
  const 없음 = 세션모델을({ cwd: '.', session_id: 's' });           // transcript_path 누락
  assert.equal(없음.훅, true);
  assert.match(없음.사유 || '', /transcript_path/);

  const 빈전사 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-빈전사-')), 't.jsonl');
  fs.writeFileSync(빈전사, `${JSON.stringify({ type: 'x' })}\n`, 'utf8'); // usage 줄 0
  const 못뽑음 = 세션모델을({ transcript_path: 빈전사 });
  assert.equal(못뽑음.훅, true);
  assert.equal(못뽑음.모델, null);
  assert.ok(못뽑음.사유, '못 뽑은 이유가 비면 「안 바뀌었다」와 구분이 안 된다');
});

test('등록층: 대기열 훅 명령이 stdin 을 실제로 넘긴다 (안 넘기면 배선 전체가 죽는다)', () => {
  const s = path.resolve(__dirname, '..', '.claude', 'settings.json');
  let 원문;
  try { 원문 = fs.readFileSync(s, 'utf8'); } catch (_) { return; } // 설정이 없는 환경 — skip(F296)
  const 줄 = (JSON.parse(원문).hooks?.SessionStart || [])
    .flatMap((g) => g.hooks || []).map((h) => String(h.command || ''))
    .find((c) => c.includes('대기열.js'));
  assert.ok(줄, '대기열 훅 등록을 못 찾았다');
  assert.match(줄, /printf %s "\$IN" \| node/, '🔴 stdin 을 안 넘기면 모델 축이 통째로 눈이 먼다 — 가드는 등록층에서 샌다');
});

test('실저장소: 판정이 실제 대기열 파일 위에서 터지지 않는다 (거짓양성만 본다)', () => {
  const 대기열 = require('../tools/대기열.js');
  const 전체 = 대기열.항목들();
  if (전체 === null) return; // 파일이 없는 환경 — fail 이 아니라 조용히 통과(F296)
  for (const it of 전체) {
    const c = 대기열.차단(it.본문);
    assert.ok(c === null || typeof c === 'string', '차단 판정이 문자열도 null 도 아닌 것을 냈다');
  }
});
