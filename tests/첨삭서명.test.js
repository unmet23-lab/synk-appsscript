'use strict';
/* 첨삭 서명 회귀 — 2026-09-07 (유호 지시 「명품 습관을 전부 일감에 등록해서 하나씩」 · 트랙 §0-명품 ㉡)
 *
 * 무엇을 지키나: **「이 답장을 사람이 봤나」에 거짓이 안 붙는가.**
 *   실측 09-07: `HW_FEEDBACK_HEADERS` 에 `model`·`prompt_ver`(어느 AI 가 썼나)는 있는데
 *   «누가 봐줬나» 칸이 0 이었다. 그런데 칸만 만들면 더 나쁜 자리가 열린다 —
 *   `AI_FEEDBACK_AUTOPUBLISH = true` 라 지금 첨삭은 **무인 발행**이고, 무인이 낸 '노출' 과
 *   사람이 격리를 풀어 만든 '노출' 이 시트에서 **같은 글자**다. 안 가르면 학생이 받는
 *   카드 전량에 「선생님이 보았습니다」가 붙어 매일 거짓말이 된다.
 *
 * 🔴 소급 불가라 이 회귀가 지금 선다: 행이 «만들어질 때» 어느 길로 나갔는지는 그 순간에만 참이고
 *   `상태` 열은 나중에 덮인다. 1기 첫 첨삭(11-30) 전에 안 서면 그 값이 영영 빈다.
 *
 * ⚠ 여기서 재는 것은 **판정 코어**(`사람이봤나_`)와 **헤더 정본**뿐이다.
 *   시트에 실제로 열이 서는 층(`헤더보정_`)은 라이브 Sheets 를 부르므로 «안 재봤다» —
 *   동의이력 회귀가 시트 래퍼를 뺀 것과 같은 선이다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
/* ⚠ 줄끝을 먼저 고른다 — 작업본이 CRLF 라 LF 표식으로 자르면 「함수 끝을 못 찾는다」로 죽는다. */
const 수집소스 = () => fs.readFileSync(path.join(ROOT, '엔진_수집.js'), 'utf8').replace(/\r\n/g, '\n');
const AI소스 = () => fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8').replace(/\r\n/g, '\n');

function 조각(src, 표식, 끝표식) {
  const s = src.indexOf(표식);
  assert.ok(s > -1, `표식을 못 찾았다: ${표식} — 이름이 바뀌었으면 이 시험부터 고친다`);
  const e = src.indexOf(끝표식, s);
  assert.ok(e > s, `끝을 못 찾았다: ${끝표식}`);
  return src.slice(s, e + 끝표식.length);
}

/* `사람이봤나_` 는 `노출카드_` 와 `발행경로_` 를 부른다 — 셋을 한 스코프에 올린다. */
const 판정 = (() => {
  const src = 수집소스();
  const 몸 = [
    조각(src, 'function 노출카드_(', '\n}\n'),
    조각(src, 'const 발행경로_ =', '\n'),
    조각(src, 'function 사람이봤나_(', '\n}\n'),
  ].join('\n');
  return new Function(몸 + '\nreturn { 사람이봤나_: 사람이봤나_, 발행경로_: 발행경로_ };')();
})();
const 봤나 = 판정.사람이봤나_;
const 길 = 판정.발행경로_;

/* ── 심장 ── */

test('🔴 무인 발행이 낸 «노출» 에는 서명이 안 붙는다 — 붙으면 학생이 받는 카드 전량이 매일 거짓말이 된다', () => {
  assert.strictEqual(봤나(길.무인, '노출'), false);
});

test('🔴 발행경로가 빈 옛 행은 «안 봤다»가 아니라 «모른다» — 모를 때는 말하지 않는다', () => {
  /* 이 칸이 서기 전에 쌓인 행 전량. 없는 것을 참으로 읽으면 옛 카드에 거짓 서명이 소급된다. */
  assert.strictEqual(봤나('', '노출'), false);
  assert.strictEqual(봤나(null, '노출'), false);
  assert.strictEqual(봤나(undefined, '노출'), false);
});

/* ── 사람이 실제로 손댄 자리 ── */

test('격리로 멈춘 카드를 사람이 풀어 «노출» 이 되면 서명이 선다', () => {
  assert.strictEqual(봤나(길.격리, '노출'), true);
});

test('수동 검수 모드(대기)에서 사람이 승인하면 서명이 선다', () => {
  assert.strictEqual(봤나(길.대기, '노출'), true);
});

test('멈춘 채로 아직 안 풀린 카드에는 서명이 없다 — 「멈췄다」와 「사람이 봤다」는 다른 말이다', () => {
  assert.strictEqual(봤나(길.격리, '격리:짧음'), false);
  assert.strictEqual(봤나(길.대기, '대기'), false);
});

test('오류 행에는 서명이 없다 — 학생에게 나가지도 않은 행이다', () => {
  assert.strictEqual(봤나(길.오류, '오류:파싱실패'), false);
  assert.strictEqual(봤나(길.오류, '노출'), false);
});

test('낯선 발행경로는 참으로 읽지 않는다 — 어휘가 늘면 이 시험이 먼저 빨개져야 한다', () => {
  assert.strictEqual(봤나('사람', '노출'), false);
  assert.strictEqual(봤나('무인 ', '노출'), false); // 앞뒤 공백만 접고, 낯선 값은 그대로 거짓
});

test('앞뒤 공백은 접는다 — 시트 손편집이 흔한 칸이다', () => {
  assert.strictEqual(봤나(' 격리 ', '노출'), true);
});

/* ── 헤더 정본 ── */

test('🔴 서명 두 칸은 헤더 «끝» 에 있다 — 중간 삽입은 소비처를 조용히 파괴한다', () => {
  const src = 수집소스();
  const m = src.match(/const HW_FEEDBACK_HEADERS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'HW_FEEDBACK_HEADERS 리터럴을 못 찾았다');
  const 헤더 = JSON.parse(m[1].replace(/'/g, '"'));
  assert.deepStrictEqual(헤더.slice(-2), ['발행경로', '확인자'], '서명 두 칸이 끝에 없다');
  assert.strictEqual(헤더.indexOf('schema_ver'), 헤더.length - 3, 'schema_ver 앞자리가 밀렸다 — 앞 20칸은 못 박혀 있다');
});

test('☠️ 헤더 배열 안에 주석이 없다 — safety 골격 대조가 이 리터럴을 JSON 으로 읽는다', () => {
  /* 09-07 실측: 배열 «안» 에 주석 한 줄을 넣었더니 시험 셋이 한꺼번에 빨개졌다.
     증상은 「JSON 파싱 실패」라 원인이 헤더라는 것이 안 보인다 — 그래서 여기서 먼저 잡는다. */
  const src = 수집소스();
  const m = src.match(/const HW_FEEDBACK_HEADERS = \[([\s\S]*?)\];/);
  assert.ok(m, 'HW_FEEDBACK_HEADERS 리터럴을 못 찾았다');
  assert.ok(!/\/\/|\/\*/.test(m[1]), '헤더 배열 안에 주석이 있다 — 배열 밖으로 뺀다');
});

/* ── 배선 ── */

test('🔴 첨삭을 쓰는 자리 «전부» 가 발행경로를 싣는다 — 하나라도 빠지면 그 행의 서명이 영영 빈다', () => {
  /* ⚠ 「참조 수 = 호출 수」로 세면 안 된다 — 한 호출 안 삼항이 발행경로_ 를 셋 쓴다(09-07 실측).
     호출 «하나씩» 잘라서 그 안에 들었는지를 본다. */
  const src = AI소스();
  const 호출들 = [];
  let i = 0;
  for (;;) {
    const s = src.indexOf('fb.appendRow([', i);
    if (s < 0) break;
    const e = src.indexOf(']);', s);
    assert.ok(e > s, 'appendRow 의 끝(`]);`)을 못 찾았다 — 표기가 바뀌었으면 이 시험부터 고친다');
    호출들.push(src.slice(s, e));
    i = e;
  }
  assert.ok(호출들.length >= 2, `첨삭 appendRow 를 ${호출들.length}곳 찾았다 — 분모 소실은 통과가 아니다`);
  const 빠진곳 = 호출들.filter((c) => c.indexOf('발행경로_') < 0).length;
  assert.strictEqual(빠진곳, 0, `appendRow ${호출들.length}곳 중 ${빠진곳}곳이 발행경로를 안 싣는다`);
});

test('무인 여부는 상수에서 파생한다 — 리터럴을 다시 적으면 스위치를 내려도 안 따라온다', () => {
  const src = AI소스();
  assert.ok(/AI_FEEDBACK_AUTOPUBLISH \? 발행경로_\.무인 : 발행경로_\.대기/.test(src),
    '발행경로가 AI_FEEDBACK_AUTOPUBLISH 를 안 읽는다 — 상태 열과 갈라진다');
});
