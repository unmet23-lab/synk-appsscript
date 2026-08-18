/* 세션 지문 통로 — 「내가 누구인가」를 도구 층이 읽는 자리의 회귀 (마찰 F632).
 *
 * 왜 따로 있나 (tests/대기열.test.js·tests/보드주인.test.js 와 겹치지 않는다):
 *   저기는 **지문이 있는 기계**를 전제한다 — 어느 검사도 그 변수를 비워 놓고 돌지 않는다.
 *   그런데 F632 는 정확히 그 전제가 깨진 기계에서 났다(클라우드 세션 · 변수가 빈 문자열).
 *   그때 도구가 낸 것은 「세션 지문을 못 읽었다」 **한 줄**이었고 다음 명령이 없었다 —
 *   정본이 시키는 「선언부터」를 지키는 유일한 길이 보드 파일을 손으로 쓰는 것이 됐다(F103).
 *
 * 🔑 그래서 이 파일이 재는 축은 「값이 맞나」가 아니라 **「막혔을 때 빠져나갈 길이 실제로 도나」**다.
 *   가드 맹점 ③(자기 처방을 되먹여 통과하는가)이 이 파일의 본체다 — 첫 판이 그 자리에서
 *   실제로 샜다: 처방이 `SYNK_세션지문=…` 이었고 POSIX 셸은 **비ASCII 변수 이름을 못 받는다.**
 *   화면엔 멀쩡한 처방이 떴는데 그대로 치면 `command not found` 였다.
 *
 * 〖틀릴 때의 모습〗 이 검사가 사인하는 길 — `열린번호()` 가 null 이면(대기열이 다 닫힌 날)
 *   통합 갈래가 통째로 skip 된다. 그건 통과가 아니므로 `t.skip` 으로 **드러낸다**(F207).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 지문lib = require(path.join(ROOT, 'tools', 'lib', '세션지문.js'));
const 큐 = require(path.join(ROOT, 'tools', '대기열.js'));

/* ── ① 출처 — 「없음」은 「지문이 없다」가 아니라 「못 읽었다」다 ───────────────────── */

test('출처 순서 — 지정 > 호스트 > 훅 > 없음', () => {
  const 환경 = { SYNK_SESSION_FINGERPRINT: 'abcd1234', CLAUDE_CODE_HOST_SESSION_ID: 'cloud_ffff0000' };
  assert.strictEqual(지문lib.읽기({ 환경 }).출처, '지정');
  assert.strictEqual(지문lib.읽기({ 환경 }).지문, 'abcd1234');

  const 환경2 = { CLAUDE_CODE_HOST_SESSION_ID: 'cloud_ffff0000-더-긴-것' };
  assert.strictEqual(지문lib.읽기({ 환경: 환경2 }).출처, '호스트');
  assert.strictEqual(지문lib.읽기({ 환경: 환경2 }).지문, 'ffff0000');

  const 판3 = 지문lib.읽기({ 환경: {}, 훅입력: { session_id: 'local_11112222-x' } });
  assert.strictEqual(판3.출처, '훅');
  assert.strictEqual(판3.지문, '11112222');
});

test('못 읽으면 «없음» 이고 **사유가 반드시 있다** — 0 과 모름을 가른다(F207)', () => {
  const 판 = 지문lib.읽기({ 환경: {} });
  assert.strictEqual(판.출처, '없음');
  assert.strictEqual(판.지문, '');
  assert.ok(판.사유.includes('CLAUDE_CODE_HOST_SESSION_ID'),
    `왜 못 쟀는지가 없으면 「지문 없음」과 구별이 안 된다: ${JSON.stringify(판)}`);
});

test('틀린 지정은 **조용히 흘리지 않는다** — 폴백이 답을 내면 사람은 자기 값이 쓰인 줄 안다', () => {
  const 환경 = { SYNK_SESSION_FINGERPRINT: 'zzz', CLAUDE_CODE_HOST_SESSION_ID: 'cloud_ffff0000' };
  const 판 = 지문lib.읽기({ 환경 });
  assert.strictEqual(판.출처, '없음', '틀린 지정이 호스트로 흘러내리면 새는 방향이 「통과」다');
  assert.ok(/8자리 hex/.test(판.사유), 판.사유);
});

/* ── ② 접두 — 지어내지 않는다 ─────────────────────────────────────────────── */

test('접두는 sid 에서 뽑고, 모르면 `sess_` 다 — `local_` 로 박지 않는다', () => {
  assert.strictEqual(지문lib.접두뽑기('cloud_d427746a-xx'), 'cloud_');
  assert.strictEqual(지문lib.접두뽑기('local_aaaa1111'), 'local_');
  assert.strictEqual(지문lib.접두뽑기('aaaa1111'), '', '접두가 없으면 없다고 말한다(여기서 짓지 않는다)');
  assert.strictEqual(지문lib.표기('aaaa1111'), 'sess_aaaa1111');
  assert.strictEqual(지문lib.표기('cloud_d427746a'), 'cloud_d427746a');
  assert.strictEqual(지문lib.표기(''), '', '지문이 없으면 표기도 없다 — 빈 접두만 남기지 않는다');
});

test('표기는 읽는 쪽이 실제로 받는 꼴이다 — `board-id.줄의지문` 이 도로 뽑아낸다', () => {
  const 보드id = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'board-id.js'));
  for (const sid of ['aaaa1111', 'cloud_bbbb2222', 'local_cccc3333']) {
    const 표 = 지문lib.표기(sid);
    assert.deepStrictEqual(보드id.줄의지문(`| 작업중 (\`${표}\`) — ▶착수 |`), [지문lib.지문(sid)],
      `쓰는 쪽 표기가 읽는 쪽보다 넓으면 그 틈은 늘 「통과」로 샌다: ${표}`);
  }
});

/* ── ③ 🔑 자기 처방을 되먹인다 (가드 맹점 ③) ────────────────────────────────── */

test('🔴 처방의 환경변수 이름이 **POSIX 셸이 받는 꼴**이다 — 첫 판이 여기서 샜다', () => {
  const 글 = 지문lib.처방('사유', 'node tools/board.js');
  const m = /(\S+)=<8자리hex>/.exec(글);
  assert.ok(m, `처방에 환경변수 통로가 없다:\n${글}`);
  const 이름 = m[1];
  assert.match(이름, /^[A-Za-z_][A-Za-z0-9_]*$/,
    `POSIX 셸의 \`VAR=값 명령\` 은 이 꼴만 받는다 — 화면엔 멀쩡한 처방이 뜨고 치면 command not found 다: ${이름}`);

  /* 정규식만 믿지 않고 **셸에 실제로 물어본다** — 잴 수 있는 것은 추정하지 않는다. */
  const r = spawnSync('sh', ['-c', `${이름}=x true`], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `셸이 그 이름을 거절했다: ${(r.stderr || '').trim()}`);
});

test('처방은 플래그를 주면 그 줄을 **먼저** 낸다 — 한 번에 칠 수 있는 길이 위다', () => {
  const 글 = 지문lib.처방('사유', 'node tools/대기열.js --집기 #Q9', { 플래그: '--지문' });
  const 플래그자리 = 글.indexOf('--지문 <8자리hex>');
  const 환경자리 = 글.indexOf('SYNK_SESSION_FINGERPRINT=');
  assert.ok(플래그자리 !== -1 && 환경자리 !== -1, 글);
  assert.ok(플래그자리 < 환경자리, `치기 쉬운 길이 아래에 있으면 안 읽힌다:\n${글}`);
});

/* ── ④ 통합 — `--집기` 가 막힌 자리에서 실제로 빠져나가는가 ──────────────────── */

/* 열린 항목에서 번호를 **가져온다** — 상수로 박으면 그 번호가 닫히는 날 조기 반환으로
 * 빠져나가 상시 초록이 된다(tests/대기열점유.test.js 와 같은 이유·같은 통로). */
const 열린번호 = () => { const it = 큐.항목들().find((x) => Number.isInteger(x.id)); return it ? it.id : null; };

/** 이 프로세스의 호스트 변수를 잠깐 비운다 — F632 가 난 그 기계를 그대로 만든다. */
function 지문없이(fn) {
  const 옛 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  const 옛지정 = process.env.SYNK_SESSION_FINGERPRINT;
  delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
  delete process.env.SYNK_SESSION_FINGERPRINT;
  try { return fn(); } finally {
    if (옛 !== undefined) process.env.CLAUDE_CODE_HOST_SESSION_ID = 옛;
    if (옛지정 !== undefined) process.env.SYNK_SESSION_FINGERPRINT = 옛지정;
  }
}

test('🔴 [F632] 지문 없는 기계에서 `--집기` 가 **따를 수 있는 처방**을 낸다(옛 판은 한 줄이었다)', (t) => {
  const id = 열린번호();
  if (id === null) return t.skip('열린 항목이 0 — 통과로 위장하지 않는다');
  const r = 지문없이(() => 큐.집기(id, '`tools/새.js` · talk 0', undefined, { 행들: [] }));
  assert.ok(r.오류, '지문이 없는데 줄을 조립하면 그건 남의 파일이거나 유령이다');
  assert.ok(/--지문/.test(r.오류) && /SYNK_SESSION_FINGERPRINT/.test(r.오류),
    `처방이 없으면 규약을 지키는 길이 도구 우회뿐이 된다(F103):\n${r.오류}`);
});

test('🔑 [F632] 그 처방을 되먹이면 실제로 통과한다 — 자기 처방을 막지 않는가(맹점 ③)', (t) => {
  const id = 열린번호();
  if (id === null) return t.skip('열린 항목이 0 — 통과로 위장하지 않는다');
  const r = 지문없이(() => 큐.집기(id, '`tools/새.js` · talk 0', undefined, { 행들: [], 지정: 'aaaa1111' }));
  assert.ok(!r.오류, `차단문이 시키는 그 값을 줬는데도 막혔다: ${r.오류}`);
  assert.ok(r.경로.endsWith(`aaaa1111.md`), `지정한 지문의 파일을 골라야 한다: ${r.경로}`);
  assert.ok(r.새줄.includes('`sess_aaaa1111`'), `접두를 모르면 sess_ 다: ${r.새줄}`);
});

/* 🔴 위 둘은 `집기()` 를 **직접** 부른다 — 그러면 argv 파싱이 검사에서 통째로 빠진다.
 *   처방이 사람에게 시키는 것은 `--지문 <8자리>` 를 **치는 것**이고, 그 한 칸이 안 읽히면
 *   화면의 처방은 멀쩡한데 따라도 안 통한다(첫 변이 판이 정확히 여기서 구멍이었다).
 *   그래서 이 갈래만 **CLI 를 실제로 띄운다.** */
const 안잡힌번호 = () => {
  for (const it of 큐.항목들()) {
    if (!Number.isInteger(it.id)) continue;
    const r = 큐.집기(it.id, '`tools/x.js` · talk 0', 'aaaa1111', {});
    if (!r.오류) return it.id;
  }
  return null;
};

test('🔑 [F632] CLI 가 `--지문` 을 실제로 읽는다 — 처방을 «쳐서» 통하는지 본다', () => {
  const id = 안잡힌번호();
  assert.ok(id !== null, '지금 아무도 안 잡은 열린 항목이 0이다 — 이 검사는 그때 아무것도 못 잰다(분모 0 · F207)');
  const 환경 = { ...process.env };
  delete 환경.CLAUDE_CODE_HOST_SESSION_ID;
  delete 환경.SYNK_SESSION_FINGERPRINT;
  const r = spawnSync(process.execPath,
    [path.join(ROOT, 'tools', '대기열.js'), '--집기', `#Q${id}`, '--파일', '`tools/x.js` · talk 0', '--지문', 'aaaa1111'],
    { encoding: 'utf8', env: 환경, timeout: 120000 });
  const 글 = `${r.stdout || ''}${r.stderr || ''}`;
  assert.ok(!/세션 지문을 못 읽었다/.test(글), `처방이 시키는 플래그를 도구가 안 읽었다:\n${글.slice(0, 500)}`);
  assert.ok(/보드\/aaaa1111\.md/.test(글) && /`sess_aaaa1111`/.test(글),
    `지정한 지문으로 줄이 조립돼야 한다:\n${글.slice(0, 600)}`);
});

/* board.js 의 «되찾기»(F146 처방 — 마감 뒤 아카이브로 거둬진 내 줄 알림)는 옛 판에서
 *   `if (내지문)` 아래라 **조용히 꺼졌다.** 그러면 「내 줄 없음」과 「안 쟀다」가 같은 침묵이고,
 *   침묵으로 꺼진 처방은 그 사고를 그대로 되돌린다. 여기선 **실제로 도구를 띄워** 본다 —
 *   그 층은 실보드를 읽는 자리라, 순수 함수로 떼어 재면 정작 이음매가 검사에서 빠진다. */
test('🔑 [F632] board.js 는 지문을 못 읽으면 **말한다** — 침묵으로 꺼지지 않는다(F207)', () => {
  const 환경 = { ...process.env };
  delete 환경.CLAUDE_CODE_HOST_SESSION_ID;
  delete 환경.SYNK_SESSION_FINGERPRINT;
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'board.js')],
    { encoding: 'utf8', env: 환경, timeout: 120000 });
  assert.strictEqual(r.status, 0, `board.js 가 안 떴다: ${(r.stderr || '').slice(-300)}`);
  assert.ok(/되찾기 층을 \*\*안 돌렸다\*\*/.test(r.stderr || ''),
    `못 잰 것을 안 말하면 「내 줄 없음」과 구별이 안 된다:\n${(r.stderr || '').slice(-400)}`);
  assert.ok(/SYNK_SESSION_FINGERPRINT/.test(r.stderr || ''), '말만 하고 길을 안 주면 따를 수 없는 처방이다(F103)');
});

test('☠️ [F632] 선언 줄이 접두를 **박지 않는다** — 클라우드 세션이 local_ 이라 말하면 provenance 가 거짓이다', (t) => {
  const id = 열린번호();
  if (id === null) return t.skip('열린 항목이 0 — 통과로 위장하지 않는다');
  const r = 큐.집기(id, '`tools/새.js` · talk 0', 'cloud_bbbb2222', { 행들: [] });
  assert.ok(!r.오류, r.오류);
  assert.ok(r.새줄.includes('`cloud_bbbb2222`'), `sid 의 접두를 그대로 써야 한다: ${r.새줄}`);
  assert.ok(!r.새줄.includes('`local_bbbb2222`'), `🔴 접두가 리터럴로 박혀 있다: ${r.새줄}`);
});
