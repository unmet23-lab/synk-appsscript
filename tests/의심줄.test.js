'use strict';
/* evals/의심줄.js 회귀 — 2차 검수(08-29 codex P1 7d941e08dcbe·f8dd5e4e67c7)가 잡은 두 구멍을 픽스처로 못 박는다(09-02 수리):
 *   ① 판정은 맞는데 근거채점이 떨어진 칸(지어낸 문제문장)이 의심 줄에 안 올랐다 — 답(판정)만 읽었다.
 *   ② 한 모델의 결과 행이 통째로 빠진 문항이 그 모델의 못잼으로 안 세어졌다 — 점수판이 반쪽인데 반쪽인 줄을 몰랐다.
 * ⚠ 네트워크 0 — promptfoo 결과 JSON 모양(0.122.x)을 흉내 낸 픽스처다. */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { 의심줄추출 } = require(path.join(__dirname, '..', 'evals', '의심줄.js'));

const 행 = (모델, 이름, 기대, 답, 채점) => ({
  provider: { id: 'google:gemini-x', label: 모델 },
  testCase: { description: 이름, vars: { 기대, 몽골어: 'Сайн байна уу', 근거: '픽스처' } },
  response: { output: JSON.stringify(답) },
  gradingResult: 채점,
});
const 판정채점 = (pass, reason) => ({ pass, score: pass ? 1 : 0, reason, assertion: { type: 'javascript', value: 'file://검문자.js:판정채점' } });
const 근거채점 = (pass, reason) => ({ pass, score: pass ? 1 : 0, reason, assertion: { type: 'javascript', value: 'file://검문자.js:근거채점' } });

const 원본 = { results: { results: [
  // ㉠1 — 3.7 은 판정(어색)은 맞는데 근거가 지어낸 문장 · 3.6 은 판정도 근거도 맞다
  행('3.7', '㉠1', '비정상', { 판정: '어색', 이유: 'x', 문제문장: '지어낸 문장' },
    { pass: false, componentResults: [판정채점(true, '기대 비정상 · 모델 판정 어색'), 근거채점(false, '문제문장이 입력 안에 없다(지어냈다) → "지어낸 문장"')] }),
  행('3.6', '㉠1', '비정상', { 판정: '어색', 이유: 'x', 문제문장: 'Сайн' },
    { pass: true, componentResults: [판정채점(true, '기대 비정상 · 모델 판정 어색'), 근거채점(true, '근거 실물 ✓')] }),
  // ㉡1 — 3.7 만 답했다. 3.6 의 결과 행이 통째로 없다.
  행placeholder(),
] } };
function 행placeholder() {
  return 행('3.7', '㉡1', '정상', { 판정: '정상', 이유: 'x' }, { pass: true, componentResults: [판정채점(true, '기대 정상 · 모델 판정 정상')] });
}

test('① 판정은 맞아도 채점 부품(근거채점)이 떨어진 칸은 의심 줄에 오른다 — 판정채점 실패는 두 줄로 안 올린다', () => {
  const { 올릴것, 점수 } = 의심줄추출(원본);
  const 줄 = 올릴것.find((x) => x.이름 === '㉠1');
  assert.ok(줄, '㉠1 이 의심 줄에 없다 — 지어낸 근거가 사람 검토에서 빠진다');
  assert.ok(줄.사유.some((s) => /3\.7: 채점 부품 실패 — .*지어냈다/.test(s)), `근거채점 실패 사유가 없다: ${JSON.stringify(줄.사유)}`);
  assert.ok(!줄.사유.some((s) => /3\.7: 어색 ← 기대/.test(s)), '판정이 맞는데 어긋남으로도 올렸다');
  assert.ok(!줄.사유.some((s) => /3\.6/.test(s)), '멀쩡한 3.6 칸을 올렸다');
  assert.strictEqual(점수.get('3.7').맞음, 2, '판정 축 점수는 그대로(맞음)여야 한다 — 근거 흠은 곁 셈이다');
  assert.strictEqual(점수.get('3.7').근거흠, 1);
});

test('② 결과 행이 통째로 빠진 모델·문항은 그 모델의 못잼이다 — 점수판이 반쪽인 줄을 안다', () => {
  const { 올릴것, 점수, 문항 } = 의심줄추출(원본);
  assert.strictEqual(문항.size, 2);
  const 줄 = 올릴것.find((x) => x.이름 === '㉡1');
  assert.ok(줄 && 줄.사유.some((s) => /3\.6: 오류\(결과 행 없음/.test(s)), `빠진 행이 의심 줄에 없다: ${JSON.stringify(줄 && 줄.사유)}`);
  assert.deepStrictEqual(점수.get('3.6'), { 맞음: 1, 틀림: 0, 못잼: 1, 근거흠: 0 });
  assert.deepStrictEqual(점수.get('3.7'), { 맞음: 2, 틀림: 0, 못잼: 0, 근거흠: 1 });
});

test('결과 칸을 하나도 못 찾으면 「0건」이 아니라 던진다(확인 불가)', () => {
  assert.throws(() => 의심줄추출({ results: { results: [] } }), /칸\(results\)을 못 찾았다/);
});
