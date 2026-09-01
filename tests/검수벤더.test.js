'use strict';
/* 벤더 편성(09-02) — 「셋째 벤더를 꽂을 자리」가 회차의 속성이 됐다. 이 회귀가 재는 것:
 *   ① 편성 — 기본은 codex 만 · `--벤더 둘` 이면 gemini 한 회차가 뒤에 붙는다 · 모르는 값은 거절(기본값으로 안 접는다)
 *   ② 합의 분모 — 못 본 회차(확인불가)는 분모가 아니다(codex 만 본 지적이 「1/2」로 읽히면 «합의 없음»처럼 보인다)
 *   ③ 장부 모양 — 회차별에 벤더·서빙모델·확인불가가 실리고 벤더들이 붙는다
 *   ④ gemini 스키마 — Gemini responseSchema 는 additionalProperties 를 거절하므로 걷어야 한다(안 걷으면 400)
 * 실제 codex·gemini 호출은 없다 — 순수 함수만 잰다(검사 못 하는 자리 = 조용히 새는 자리라 함수로 갈라 뒀다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const 검수 = require(path.join(ROOT, 'tools', 'codex-review.js'));
const { 제미나이스키마 } = require(path.join(ROOT, 'tools', 'lib', '제미나이호출.js'));

test('① 편성 — 기본은 codex ×회차 · `--벤더 둘` 은 gemini 한 회차를 뒤에 붙인다', () => {
  assert.deepEqual(검수.벤더편성([], 2), ['codex', 'codex']);
  assert.deepEqual(검수.벤더편성(['--벤더', '둘'], 1), ['codex', 'gemini']);
  assert.deepEqual(검수.벤더편성(['--벤더', '둘'], 2), ['codex', 'codex', 'gemini']);
  assert.deepEqual(검수.벤더편성(['--벤더', 'codex'], 1), ['codex']);
});

test('① 모르는 벤더 값은 거절한다 — gemini 단독도 없다(게이트는 codex 가 진다)', () => {
  for (const v of ['gemini', 'claude', '셋', '']) {
    assert.throws(() => 검수.벤더모드(['--벤더', v]), (e) => e.확인불가 === true, `«${v}» 가 조용히 기본값으로 접혔다`);
  }
  assert.throws(() => 검수.벤더모드(['--벤더']), (e) => e.확인불가 === true, '값 없는 --벤더 가 조용히 통과했다');
  assert.ok(검수.아는플래그.has(검수.벤더플래그), '--벤더 가 아는 플래그 목록에 없다 — F135 가드가 거절한다');
});

test('🔒 잠금에 windows.sandbox="elevated" 가 명시로 들어간다 — 없으면 제한 토큰 샌드박스가 Store pwsh 를 못 띄워 «모든 명령이 차단»된다 (09-02 실측)', () => {
  const i = 검수.잠금플래그.indexOf('windows.sandbox="elevated"');
  assert.ok(i > 0 && 검수.잠금플래그[i - 1] === '-c', '`-c windows.sandbox="elevated"` 가 잠금플래그에서 빠졌다 — 검수자가 git 한 줄도 못 돌린 채 「확인 불가」만 낸다');
  assert.ok(검수.잠금플래그.includes('--ignore-user-config'), '넷째 플래그는 --ignore-user-config 를 «대신»하는 게 아니라 «더하는» 것이다');
});

const 지적 = (파일, 제목, 등급 = 'P1') => ({ 등급, 파일, 라인: 0, 제목, 근거: '근거', 수정방향: '고친다' });

test('② 합의 분모 = 실제로 본 회차 — gemini 회차가 확인불가면 codex 지적은 1/1 이다', () => {
  const r = 검수.회차병합([
    { 벤더: 'codex', 요약: 'a', 지적: [지적('Code.js', '널 참조')], 원문: 'x' },
    { 벤더: 'gemini', 실패: '429 한도', 요약: '', 지적: [], 원문: '' },
  ]);
  assert.equal(r.지적.length, 1);
  assert.equal(r.지적[0].합의, '1/1', '못 본 회차가 분모에 들어갔다');
  assert.deepEqual(r.벤더들, ['codex', 'gemini']);
  assert.equal(r.회차별[1].확인불가, '429 한도');
  assert.equal(r.회차별[1].지적수, null, '못 본 회차가 「0건」으로 찍혔다 — 안 봤다와 0건이 같은 모양이다');
  assert.equal(r.회차별[0].벤더, undefined, 'codex 회차에 벤더 칸이 붙었다 — 옛 행(전량 codex)과 모양이 갈린다(없으면 codex)');
  assert.equal(r.회차별[1].벤더, 'gemini');
  assert.match(r.요약, /\[1회\] a/);
  assert.match(r.요약, /\[2회·gemini\] 확인 불가/);
});

test('③ 두 벤더가 같은 결함을 짚으면 합의 2/2 · 한쪽만 짚으면 단독으로 센다', () => {
  const r = 검수.회차병합([
    { 벤더: 'codex', 요약: 'a', 지적: [지적('Code.js', '널 참조'), 지적('엔진_폼리포트.js', '빈 배열', 'P2')], 원문: 'x' },
    { 벤더: 'gemini', 서빙모델: 'gemini-3.7-flash-001', 요약: 'b', 지적: [지적('Code.js', '널 참조')], 원문: 'y' },
  ]);
  const 합의 = Object.fromEntries(r.지적.map((f) => [f.제목, f.합의]));
  assert.equal(합의['널 참조'], '2/2');
  assert.equal(합의['빈 배열'], '1/2');
  assert.equal(r.회차별[0].단독, 1);
  assert.equal(r.회차별[1].단독, 0);
  assert.equal(r.회차별[1].서빙모델, 'gemini-3.7-flash-001', '서빙 모델이 장부 모양에 안 실렸다');
  assert.match(검수.회차별줄 ? 검수.회차별줄(r.회차별, r.지적) : '2회·gemini', /2회·gemini/);
});

test('③ 병렬 계획 — 검수 회차는 편성 길이를, 기능체크는 codex 회차를 쓴다', () => {
  const 계획 = 검수.병렬계획([], 1, 2);
  assert.deepEqual(계획, [{ 단계: '검수', 회차: 2 }, { 단계: '기능', 회차: 1 }]);
  assert.deepEqual(검수.병렬계획(['--버그만'], 1, 2), [{ 단계: '검수', 회차: 2 }], '검수 2 = 자식 총합 2 인데 안 띄운다');
  assert.deepEqual(검수.병렬계획([], 1), [{ 단계: '검수', 회차: 1 }, { 단계: '기능', 회차: 1 }], '옛 호출(셋째 인자 없음)이 갈렸다 — 검수 회차는 기본이 codex 회차다');
  assert.deepEqual(검수.병렬계획(['--버그만'], 1), [], '검수 1 뿐이면 자식을 안 띄운다(옛 규칙 그대로)');
});

test('④ gemini 스키마 — additionalProperties 를 깊이까지 걷고 나머지는 그대로다', () => {
  const s = { type: 'object', additionalProperties: false, required: ['a'], properties: { a: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { g: { type: 'string', enum: ['P0'] } } } } } };
  const g = 제미나이스키마(s);
  assert.equal(JSON.stringify(g).includes('additionalProperties'), false);
  assert.deepEqual(g.required, ['a']);
  assert.deepEqual(g.properties.a.items.properties.g.enum, ['P0']);
  assert.equal(s.additionalProperties, false, '원본을 건드렸다');
});

test('④ gemini 프롬프트 — 규칙·대상·diff 가 실린다(규칙이 없으면 그 절만 빠진다)', () => {
  const p = 검수.gemini프롬프트({ 종류: 'commit', 값: 'abc1234', 파일들: ['Code.js'] }, '+ const x = 1;', '## Code Review Rules\n1. 한국어');
  assert.match(p, /둘째 검수자/);
  assert.match(p, /## Code Review Rules/);
  assert.match(p, /commit abc1234 · 파일 1개/);
  assert.match(p, /\+ const x = 1;/);
  assert.doesNotMatch(검수.gemini프롬프트({ 종류: 'commit', 값: 'a' }, 'd', ''), /검수 규칙\(AGENTS\.md\)/);
});
