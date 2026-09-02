'use strict';
/* 발음밀도 자의 회귀 — 규격 §2-1·§2-3 이 기대는 셈 규칙을 낱말 몇 개로 못박는다.
 *   특히 「십만 원」(연음 0 · 비음화 1 · 어절 안만 센다)은 09-02 에 12↔13 검산을 닫은 그 규칙이다 —
 *   자가 바뀌면 규격의 수가 조용히 갈리므로 여기서 운다.
 *   반대로도 잰다: 띄어쓰기를 지운 「십만원」은 연음 1 이 «더» 나야 한다(자가 실제로 어절을 보는지).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const 자 = require(path.join(__dirname, '..', 'tools', '발음밀도.js'));

const 셈of = (줄) => 자.세기(줄).셈;

test('「십만 원」 — 연음 0 · 비음화 1 (어절 안에서만 센다 · 규격 §2-3 정본 12 의 근거)', () => {
  const s = 셈of('십만 원');
  assert.equal(s.연음, 0);
  assert.equal(s.비음화, 1);
});

test('반대로 — 「십만원」(어절 하나)은 연음 1 이 더 난다 · 자가 어절을 실제로 본다', () => {
  assert.equal(셈of('십만원').연음, 1);
  assert.equal(셈of('십만원').비음화, 1);
});

test('경음화 씨앗 — 학교·숙제 는 각 1 (규격 §2-1 +2 제안의 실재 확인)', () => {
  assert.equal(셈of('학교').경음화, 1);
  assert.equal(셈of('숙제').경음화, 1);
});

test('겹받침은 «낱말 요령» — 읽고 = 겹받침 1 + 경음화 1 · 없는데 = 겹받침 1 + 비음화 1', () => {
  const 읽고 = 셈of('읽고');
  assert.equal(읽고.겹받침, 1);
  assert.equal(읽고.경음화, 1);
  const 없는데 = 셈of('없는데');
  assert.equal(없는데.겹받침, 1);
  assert.equal(없는데.비음화, 1);
});

test('ㄶ·ㅀ + ㄴ 은 비음화가 아니다 (규격 자: 「많네」 비음화 0) · ㄺ + ㄴ 은 맞다 (「읽는」 1)', () => {
  assert.equal(셈of('많네').비음화, 0);
  assert.equal(셈of('읽는').비음화, 1);
});

test('12항 4호 — ㅎ 계열 «겹»받침 뒤 ㅅ 은 경음화다 (09-03 es-hangul 교차검사가 찾아낸 유일한 구멍)', () => {
  // 메운 자리 — 이 셋은 고침 전까지 전부 0 이었다
  assert.equal(셈of('않습니다').경음화, 1);
  assert.equal(셈of('많습니다').경음화, 1);
  assert.equal(셈of('싫소').경음화, 1);
  // ㅎ 홑받침은 원래부터 ㄷ류에 있어 잡혔다 — 회귀 방지
  assert.equal(셈of('좋소').경음화, 1);
  // 경계: ㄶ + ㄱ 은 격음화지 경음화가 아니다(「않고[안코]」) — 새 규칙이 여기까지 번지면 안 된다
  assert.equal(셈of('않고').경음화, 0);
  assert.equal(셈of('않고').격음화, 1);
  // 경계: ㅀ + ㄷ 도 격음화다(「싫다[실타]」)
  assert.equal(셈of('싫다').경음화, 0);
  assert.equal(셈of('싫다').격음화, 1);
});

test('한글 밖 글자는 건너뛴다 · 빈 줄·주석은 발화가 아니다(재기 분모)', () => {
  assert.equal(자.세기('TOPIK 83').셈.연음, 0);
  const r = 자.재기(['십만 원', '학교']);
  assert.equal(r.발화수, 2);
  assert.equal(r.하나이상, 2);
  assert.equal(r.총건, 2);
  assert.equal(r.총글자, 5);
});
