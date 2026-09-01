'use strict';
/* 낭독 미션 목록 회귀 — 2026-09-01 (심문 P0-② 수리)
 *
 * 무엇을 지키나: **한 숙제에 지정한 낱말이 «전부» 로그에 남는가.**
 *   그전 구현은 `out[id] = tx` 라 뒤 행이 앞 행을 덮었다. HW306 처럼 낱말 여섯을 지정하면
 *   **다섯이 조용히 사라졌다** — 오류도 경고도 없이. 그런데 `voiceSweep_` 주석은 그때도
 *   「그날의 값을 **스냅샷**한다」고 적고 있었으니 **구현이 자기 주석을 못 지킨 것**이었다.
 *
 * 🔴 이 자리가 소급 불가 직격인 까닭: 그날 학생에게 무엇을 읽게 했는지는 **그날만** 알 수 있다.
 *   2029년에 2027년 학생에게 「그때 그 목록을 읽어 주세요」를 시킬 수 없다.
 *
 * ⚠ 이 함수에는 09-01 까지 회귀가 **0벌**이었다 — 그래서 결함이 조용히 서 있었다.
 * ⚠ 라이브 Sheets 는 안 부른다. 시트는 `tests/lib/시트흉내.js` 의 계약을 쓴다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 시트흉내 } = require('./lib/시트흉내.js');

const ROOT = path.resolve(__dirname, '..');

/* ⚠ **줄끝을 먼저 고른다** — 이 저장소 작업본은 CRLF 라 `\n}\n` 으로 자르면 «함수 끝을 못 찾는다».
 *   CI(리눅스·LF)에서만 통과하고 로컬에서만 빨간, 또는 그 반대의 시험이 되는 자리다. */
function 소스() {
  return fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8').replace(/\r\n/g, '\n');
}

/** `voiceMissionTexts_` 를 소스에서 잘라 격리 실행한다(엔진 전역 없이). */
function 함수뽑기(보낸메일) {
  const src = 소스();
  const s = src.indexOf('function voiceMissionTexts_(');
  assert.ok(s > -1, 'voiceMissionTexts_ 를 못 찾았다 — 이름이 바뀌었으면 이 시험부터 고친다');
  const e = src.indexOf('\n}\n', s);
  assert.ok(e > s, '함수 끝을 못 찾았다');
  const 본문 = src.slice(s, e + 2);
  return new Function('adminMail', 본문 + '\nreturn voiceMissionTexts_;')(
    (제목, 몸) => 보낸메일.push({ 제목, 몸 }));
}

/** voice_missions 흉내 — 헤더까지 담는 통짜 격자(첫행 1). */
function 목록시트(행들, 헤더) {
  const sh = 시트흉내({ 첫행: 1, 행들: [헤더 || ['미션ID', '축', '목표발화', '비고'], ...행들] });
  return { getSheetByName: (n) => (n === 'voice_missions' ? sh : null) };
}

test('🔴 한 미션ID 에 낱말이 여럿이면 **전부** 온다 — 덮으면 그날 시킨 것이 영영 사라진다', () => {
  const 메일 = [];
  const fn = 함수뽑기(메일);
  const out = fn(목록시트([
    ['HW306', 'P3', '읽었어요', ''],
    ['HW306', 'P3', '많았어요', ''],
    ['HW306', 'P9', '있어요', ''],
    ['HW318', 'P10', '책상', ''],
  ]));
  assert.deepStrictEqual(out.HW306, ['P3:읽었어요', 'P3:많았어요', 'P9:있어요']);
  assert.deepStrictEqual(out.HW318, ['P10:책상']);
  assert.strictEqual(메일.length, 0);
});

test('축을 낱말과 함께 담는다 — 축이 목록에만 있고 로그에 없으면 나중에 축별로 못 센다', () => {
  const out = 함수뽑기([])(목록시트([['HW306', 'P3', '읽었어요', '']]));
  assert.deepStrictEqual(out.HW306, ['P3:읽었어요']);
});

test('축 열이 없으면 낱말만 담는다 — 없는 것을 지어내지 않는다', () => {
  const out = 함수뽑기([])(목록시트(
    [['HW306', '읽었어요', '']],
    ['미션ID', '목표발화', '비고']));
  assert.deepStrictEqual(out.HW306, ['읽었어요']);
});

test('빈 낱말 행은 건너뛴다 — 빈 칸이 목록에 끼어도 스냅샷을 더럽히지 않는다', () => {
  const out = 함수뽑기([])(목록시트([
    ['HW306', 'P3', '읽었어요', ''],
    ['HW306', 'P3', '', ''],
    ['', 'P3', '버려진낱말', ''],
  ]));
  assert.deepStrictEqual(out.HW306, ['P3:읽었어요']);
});

test('시트가 없으면 «빈 표»다(정상 — 아직 안 쓰심) · 메일도 안 보낸다', () => {
  const 메일 = [];
  const out = 함수뽑기(메일)({ getSheetByName: () => null });
  assert.deepStrictEqual(out, {});
  assert.strictEqual(메일.length, 0, '아직 안 쓴 것을 결함으로 알리면 상시 소음이 된다');
});

test('🔑 열 이름이 안 맞으면 «조용히 빈 표»가 아니라 원장에게 알린다 — 0건이 성공 얼굴이 되면 안 된다', () => {
  const 메일 = [];
  const out = 함수뽑기(메일)(목록시트(
    [['HW306', '읽었어요']],
    ['숙제번호', '낱말']));                       // 계약된 이름이 아니다
  assert.deepStrictEqual(out, {});
  assert.strictEqual(메일.length, 1);
  assert.match(메일[0].제목, /낭독 미션 목록/);
});

test('🔑 voiceSweep_ 는 배열을 «구분자로 이어» 한 칸에 넣는다 — 배열을 그대로 넣으면 시트가 삼킨다', () => {
  const src = 소스();
  const s = src.indexOf('function voiceSweep_(');
  const 본문 = src.slice(s, src.indexOf('\n}\n', s));
  assert.match(본문, /\(목표문\[mid\] \|\| \[\]\)\.join\(/,
    '목표발화 적재가 배열 이어붙이기가 아니다 — 하나만 담던 옛 결함으로 되돌아갔는지 본다');
  assert.ok(!/목표문\[mid\] \|\| ''/.test(본문), '옛 단일 값 적재가 남아 있다');
});
