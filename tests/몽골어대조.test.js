// 몽골어대조 도구의 순수 로직 회귀 — 네트워크·키 파일 없이 돈다(CI 안전).
// 라이브 호출 품질(모델이 파손을 잡는가)은 여기서 재지 않는다 — 그건 픽스처로 못 박을 수 없는 층이다.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

// require 자체가 네트워크·키 파일을 건드리면 이 줄에서 죽는다 — 그것이 첫 검사다.
const { 키추출, 판정추출, 토큰대조 } = require('../tools/몽골어대조.js');

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

test('토큰대조: 동일 문장이면 표식 0', () => {
  const r = 토큰대조('오늘 그 문 앞에', '오늘 그 문 앞에');
  assert.strictEqual(r.다른토큰, 0);
  assert.ok(!r.원문표시.includes('«') && !r.역번역표시.includes('«'));
});

test('토큰대조: 달라진 토큰만 양쪽에서 표식된다', () => {
  const r = 토큰대조('오늘 그 문 앞에 서 볼래?', '오늘 그 문의 앞에 서라 어떻게 하나?');
  assert.ok(r.다른토큰 > 0);
  assert.ok(r.원문표시.includes('«서»') || r.원문표시.includes('«볼래?»'));
  assert.ok(r.역번역표시.includes('«문의»') && r.역번역표시.includes('«서라»'));
  assert.ok(r.원문표시.startsWith('오늘 그 '), '같은 머리는 표식 없이 남아야 한다');
});

test('토큰대조: 표식 함수를 주면 그걸 쓴다 (TTY 색상 주입 자리)', () => {
  const r = 토큰대조('가 나', '가 다', (t) => `[${t}]`);
  assert.ok(r.역번역표시.includes('[다]'));
});
