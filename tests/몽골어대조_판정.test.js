'use strict';
/* 몽골어 검문 — 문법 층 답 해석의 «실패 방향» 회귀 (2026-09-06 · 철학 5회차 심문 아스트라 A6)
 *
 * 무엇을 지키나: 산문 폴백이 「판정: 정상 아님」을 `정상` 으로 읽던 구멍. 부정 판정을 통과로 읽으면
 *   다른 층이 초록일 때 «종합 통과»에 보태져 「판정불능은 통과가 아니다」가 깨진다.
 *
 * ⚠ 여기서 «못» 재는 것: 실제 제미나이 왕복(키가 있어야 돈다) · 종료코드 경로(main 은 API 를 부른다 —
 *   장부 실패 → 종료코드 1 은 코드로만 확인했다 · 손 실행 안 했다).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const 대조 = require(path.join(path.resolve(__dirname, '..'), 'tools', '몽골어대조.js'));

test('🔴 「정상 아님」은 정상이 아니다 — 부정이 붙으면 판정불능(null · 통과 아님)', () => {
  assert.strictEqual(대조.판정추출('판정: 정상 아님. 문법이 파손되어 있습니다.'), null);
  assert.strictEqual(대조.판정추출('판정: 정상이 아닙니다'), null);
  assert.strictEqual(대조.판정추출('판정: 정상적이지 않습니다'), null);
  assert.strictEqual(대조.판정추출('판정 : 정상은 아님'), null);
  /* 「파손 아님」을 정상으로 뒤집어 읽지도 않는다 — 산문은 못 믿는다 */
  assert.strictEqual(대조.판정추출('판정: 파손 아님'), null);
});

test('부정이 없으면 그대로 읽는다 — 정상·어색·파손 셋', () => {
  assert.strictEqual(대조.판정추출('판정: 정상'), '정상');
  assert.strictEqual(대조.판정추출('판정: 정상. 이유 없음'), '정상');
  assert.strictEqual(대조.판정추출('판정：정상입니다'), '정상');
  assert.strictEqual(대조.판정추출('판정: 어색 — 조사가 어긋났다'), '어색');
  assert.strictEqual(대조.판정추출('판정: 파손'), '파손');
  assert.strictEqual(대조.판정추출('아무 말도 없다'), null);
  assert.strictEqual(대조.판정추출(''), null);
});

test('문법파싱 — JSON 이 1순위, 산문은 폴백, 부정 산문은 null 로 실패한다', () => {
  assert.deepStrictEqual(
    대조.문법파싱(JSON.stringify({ 판정: '어색', 이유: 'x', 문제문장: 'y' })),
    { 판정: '어색', 이유: 'x', 문제문장: 'y' },
  );
  assert.strictEqual(대조.문법파싱('판정: 정상 아님. 문법이 파손되어 있습니다.'), null);
  const 산문 = 대조.문법파싱('판정: 정상\n이유: 없음');
  assert.ok(산문 && 산문.판정 === '정상', '부정 없는 산문은 그대로 읽는다');
});
