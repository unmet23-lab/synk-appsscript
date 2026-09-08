'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { 수용검사, 완료판정 } = require('../tools/lib/수용증거.js');
const 검수 = require('../tools/codex-review.js');
const 기준 = ['빈 입력은 미제출이다.', '저장한 결과를 다시 읽는다.'];
const 항목 = (기준, 판정 = '충족') => ({ 기준, 판정, 근거: 'tests/example.test.js:12 실제 결과' });
const 정상 = 기준.map((k) => 항목(k));
const 판정 = (항목들) => 수용검사(기준, { 항목: 항목들, 요약: '대조' });
const 완료 = (수용) => 완료판정({ 수용, 시험: [{ 통과: true }], 차단: [], sha: 'abc' });

test('수용 조건 전체를 독립적으로 확인한 결과만 완료한다', () => {
  const r = 판정([...정상].reverse());
  assert.equal(r.충족수, 2);
  assert.equal(완료(r), true);
});
for (const [이름, rows] of [
  ['항목별 확인불가', [정상[0], 항목(기준[1], '확인불가')]],
  ['빈 배열', []], ['누락', [정상[0]]], ['중복으로 분모 채움', [정상[0], 정상[0]]],
  ['다른 기준으로 분모 채움', [정상[0], 항목('없는 기준')]],
  ['잘못된 판정', [정상[0], 항목(기준[1], '괜찮다')]],
  ['근거 없음', [정상[0], { ...정상[1], 근거: ' ' }]],
]) test(`${이름}은 미충족 0이어도 완료가 아니다`, () => {
  const r = 판정(rows);
  assert.equal(r.확인불가, true);
  assert.equal(완료(r), false);
});
test('미충족과 확인불가는 수리 원인이 다르다', () => {
  const r = 판정([정상[0], 항목(기준[1], '미충족')]);
  assert.equal(r.확인불가, false);
  assert.equal(r.미충족.length, 1);
  assert.equal(완료(r), false);
  assert.equal(수용검사(기준, { 확인불가: '호출 실패' }).확인불가, true);
});
test('시험 없음·실패·검수 생략·차단 지적은 수용 충족과 별개로 완료를 막는다', () => {
  const 기본 = { 수용: 판정(정상), 시험: [{ 통과: true }], 차단: [], sha: 'abc' };
  for (const 변경 of [{ 시험: [] }, { 시험: [{ 통과: false }] }, { 검수생략: true }, { 차단: [{}] }, { sha: null }]) {
    assert.equal(완료판정({ ...기본, ...변경 }), false);
  }
});
test('번호 없는 제목·번호 있는 제목·CRLF에서 검수 규칙을 읽고 다음 절을 제외한다', () => {
  for (const 머리 of ['## Code Review Rules', '## 4. Code Review Rules']) {
    const r = 검수.검수규칙추출(`# 지침\r\n${머리}\r\n재현 입력을 적는다.\r\n### 예시\r\n예시 내용\r\n## 5. 다음\r\n다른 역할`);
    assert.match(r, /재현 입력/);
    assert.match(r, /예시 내용/);
    assert.doesNotMatch(r, /다른 역할/);
  }
});
test('필수 규칙 누락·빈 본문은 확인불가로 드러낸다', () => {
  for (const md of ['# 없는 문서', '## Code Review Rules\n\n## 다음\n내용']) {
    assert.throws(() => 검수.검수규칙추출(md), (e) => e.확인불가 === true);
  }
});
test('현재 저장소 규칙이 실제 Gemini 프롬프트에 들어간다', () => {
  const 규칙 = 검수.검수규칙읽기();
  const p = 검수.gemini프롬프트({ 종류: 'commit', 값: 'abc', 파일들: ['a.js'] }, 'diff', 규칙);
  assert.match(규칙, /값비싼 변경/);
  assert.ok(p.includes(규칙));
});
