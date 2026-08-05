// 몽골어대조 도구의 순수 로직 회귀 — 네트워크·키 파일 없이 돈다(CI 안전).
// 라이브 호출 품질(모델이 파손을 잡는가)은 여기서 재지 않는다 — 그건 픽스처로 못 박을 수 없는 층이다.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

// require 자체가 네트워크·키 파일을 건드리면 이 줄에서 죽는다 — 그것이 첫 검사다.
const { 키추출, 판정추출, 문법파싱, 파일분해, 재시도가능, 토큰대조, 말투대조 } = require('../tools/몽골어대조.js');

test('키추출: BOM·개행·여분 공백을 벗기고 AQ. 형식을 집는다', () => {
  assert.strictEqual(키추출('﻿  AQ.FAKE0FAKE0FAKE0FAKE0FAKE0\n'), 'AQ.FAKE0FAKE0FAKE0FAKE0FAKE0');
});

test('키추출: 설명 문장 속에서도 아는 접두어(AIza)를 골라낸다', () => {
  assert.strictEqual(키추출('키: AIzaSyFAKE0FAKE0FAKE0FAKE0FAKE0FAKE0 (08-05 발급)'), 'AIzaSyFAKE0FAKE0FAKE0FAKE0FAKE0FAKE0');
});

test('키추출: 접두어를 몰라도 단일 토큰이면 그것이 키다 (미래 형식 대비)', () => {
  assert.strictEqual(키추출('ZZ_unknown_format_key_123'), 'ZZ_unknown_format_key_123');
});

test('키추출: 토큰 여러 개 + 아는 접두어 없음 = null (아무거나 집어 조용한 401 을 만들지 않는다)', () => {
  assert.strictEqual(키추출('이 파일은 키 보관용 입니다'), null);
});

test('판정추출: 세 등급을 콜론 유무·전각 콜론까지 읽는다', () => {
  assert.strictEqual(판정추출('판정: 파손\n이유: 어미 결합 오류'), '파손');
  assert.strictEqual(판정추출('판정:정상'), '정상');
  assert.strictEqual(판정추출('판정： 어색 — 나열이 부자연'), '어색');
});

test('판정추출: 형식을 안 지킨 답·빈 답은 null — 통과가 아니라 검수 필요 쪽으로 떨어진다', () => {
  assert.strictEqual(판정추출('이 문장은 대체로 괜찮아 보입니다'), null);
  assert.strictEqual(판정추출(''), null);
  assert.strictEqual(판정추출(undefined), null);
});

test('문법파싱: 구조화 JSON 을 1순위로 읽는다 (문제문장까지)', () => {
  const r = 문법파싱('{"판정":"파손","이유":"어미 결합 오류","문제문장":"Өнөөдөр …"}');
  assert.deepStrictEqual(r, { 판정: '파손', 이유: '어미 결합 오류', 문제문장: 'Өнөөдөр …' });
});

test('문법파싱: JSON 이 깨지면 산문 정규식으로 폴백한다', () => {
  const r = 문법파싱('판정: 어색 — 나열이 부자연스럽다');
  assert.strictEqual(r.판정, '어색');
});

test('문법파싱: JSON 인데 판정 값이 등급 밖이면 폴백·실패 순으로 떨어진다 (모르는 값을 통과로 안 읽는다)', () => {
  assert.strictEqual(문법파싱('{"판정":"양호","이유":"…"}'), null);
  assert.strictEqual(문법파싱(''), null);
});

test('파일분해: 한국어 / --- / 몽골어 3부를 가른다 (CRLF·BOM 포함)', () => {
  const r = 파일분해('﻿점수를 넘어.\r\n---\r\nОнооноос давж.\r\n');
  assert.deepStrictEqual(r, { 원문: '점수를 넘어.', 번역: 'Онооноос давж.' });
});

test('파일분해: 구분줄이 없거나 블록이 비면 null — 반쪽을 조용히 검문하지 않는다', () => {
  assert.strictEqual(파일분해('한국어만 있는 파일'), null);
  assert.strictEqual(파일분해('한국어\n---\n   '), null);
  assert.strictEqual(파일분해('\n---\n몽골어'), null);
});

test('파일분해: 번역 블록 안의 --- 는 구분자가 아니라 본문이다 (첫 구분자만 가른다)', () => {
  const r = 파일분해('원문\n---\n번역 첫 줄\n---\n번역 둘째 줄');
  assert.strictEqual(r.번역, '번역 첫 줄\n---\n번역 둘째 줄');
});

test('재시도가능: 429·500·503 만 재시도 — 400(요청 결함)·401(키 결함)·404(모델 없음)는 즉시 실패', () => {
  assert.ok(재시도가능(429) && 재시도가능(500) && 재시도가능(503));
  assert.ok(!재시도가능(400) && !재시도가능(401) && !재시도가능(404));
});

test('토큰대조: 동일 문장이면 표식 0', () => {
  const r = 토큰대조('오늘 그 문 앞에', '오늘 그 문 앞에');
  assert.strictEqual(r.다른토큰, 0);
  assert.ok(!r.원문표시.includes('⟦') && !r.역번역표시.includes('⟦'));
});

test('토큰대조: 달라진 토큰만 양쪽에서 표식된다', () => {
  const r = 토큰대조('오늘 그 문 앞에 서 볼래?', '오늘 그 문의 앞에 서라 어떻게 하나?');
  assert.ok(r.다른토큰 > 0);
  assert.ok(r.원문표시.includes('⟦서⟧') || r.원문표시.includes('⟦볼래?⟧'));
  assert.ok(r.역번역표시.includes('⟦문의⟧') && r.역번역표시.includes('⟦서라⟧'));
  assert.ok(r.원문표시.startsWith('오늘 그 '), '같은 머리는 표식 없이 남아야 한다');
});

test('토큰대조: 기본 표식은 «» 가 아니다 — «» 는 몽골어 표준 인용부호라 본문과 충돌한다', () => {
  const r = 토큰대조('그 «Синк» 학원', '그 다른 학원');
  assert.ok(r.원문표시.includes('⟦«Синк»⟧'), '본문의 «» 는 그대로 두고 ⟦⟧ 로 감싼다');
  assert.ok(!r.원문표시.includes('««'), '표식이 인용부호와 겹쳐 이중 «« 를 만들면 안 된다');
});

test('토큰대조: 표식 함수를 주면 그걸 쓴다 (TTY 색상 주입 자리)', () => {
  const r = 토큰대조('가 나', '가 다', (t) => `[${t}]`);
  assert.ok(r.역번역표시.includes('[다]'));
});

/* ── 말투 층(③) — 번역이 뉘앙스를 뒤집었는지 ────────────────────────────────
 * 왜 필요한가(2026-08-06 라이브 실측): 몽골어 «Таны 3 өдрийн дараалал тасарлаа» 는
 *   문법 층이 "정상 — 문법적으로 올바르며 자연스러운 문장"이라 했고 역번역도 성공했다.
 *   **기존 2겹이었다면 exit 0 으로 통과했다.** 그런데 원문은 "오늘 오면 연속 1일부터
 *   다시 쌓여요"였다 — 재시작으로 세던 문장이 손실로 세는 문장이 됐다.
 *   ①②는 「말이 되는가」만 본다. 브랜드 규칙은 그 위 층이다. */

test('말투: 원문에 없던 위반이 역번역에 생기면 잡는다 (뉘앙스 뒤집힘)', () => {
  const r = 말투대조('오늘 오면 연속 1일부터 다시 쌓여요', '당신의 3일의 연속이 끊어졌다');
  assert.equal(r.length, 1);
  assert.equal(r[0].id, '손실강조');
});

test('말투: 원문에 **이미 있던** 위반은 번역 탓이 아니다 — 새 규칙만 센다', () => {
  // 원문 자체가 위반이면 그건 voice-guard 훅이 파일에서 잡는 자리다. 여기서 두 번 세면
  // 거름망이 아니라 모래주머니가 된다(사람 검수를 늘리는 방향).
  assert.deepEqual(말투대조('틀렸습니다', '틀렸습니다'), []);
  assert.deepEqual(말투대조('마감 임박입니다', '마감 임박! 서둘러'), []);
});

test('말투: 직역이 요란해도 규칙에 안 걸리면 통과 (거짓양성 방지)', () => {
  // 실측 역번역 "오늘 오면 순서는 1일로부터 다시 시작한다" — 토큰은 6/12 가 다른데 위반 0건이었다.
  assert.deepEqual(말투대조('오늘 오면 연속 1일부터 다시 쌓여요', '오늘 오면 순서는 1일로부터 다시 시작한다'), []);
});

test('말투: 역번역이 비면 빈 배열 — 그 실패는 역번역 층이 게이트로 잡는다', () => {
  assert.deepEqual(말투대조('아무 문장', ''), []);
  assert.deepEqual(말투대조('아무 문장', null), []);
});

test('말투: 자를 두 벌 만들지 않는다 — voice-guard 가 규칙 정본이다', () => {
  const { 규칙 } = require('../.claude/hooks/voice-guard.js');
  assert.ok(규칙.length >= 9, '규칙을 voice-guard 에서 가져오지 못했다');
  // voice-guard 를 require 해도 훅 본체(stdin 읽기)가 돌면 안 된다 — 여기까지 왔으면 통과다.
});
