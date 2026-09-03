'use strict';
/* 굽기 돈 게이트 — **「막힌다고 말하나」가 아니라 「진짜로 안 던지나」**를 잰다 (2026-09-03).
 *
 * 왜 이렇게 재나: 소스에 `if (돈벽)` 이 «있는지»를 정규식으로 보면, 그 조건이 영영 참이 안 되는
 * 코드여도 초록이 뜬다(test-guards-the-defect). 그래서 여기서는 `fetch` 를 갈아끼우고
 * **호출 횟수**를 센다 — 벽이 선 뒤 그 수가 안 늘어나는 것이 「돈을 안 썼다」의 유일한 증거다.
 *
 * 이 파일은 네트워크를 쓰지 않는다(가짜 fetch). 돈 0원.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');

const 모듈경로 = path.join(__dirname, '..', 'tools', 'lib', '이미지굽기.js');

/** 모듈을 «새로» 연다 — 돈벽은 모듈 안 상태라 시험마다 초기화되어야 한다. */
function 새로열기() {
  delete require.cache[require.resolve(모듈경로)];
  return require(모듈경로);
}

/** 정해진 status 를 내는 가짜 fetch 를 깔고, 호출 횟수를 세는 상자를 돌려준다. */
function 가짜fetch(status, 본문 = '{}') {
  const 상자 = { 횟수: 0 };
  const 원래 = global.fetch;
  global.fetch = async () => {
    상자.횟수 += 1;
    return { ok: status >= 200 && status < 300, status, text: async () => 본문, json: async () => ({}) };
  };
  상자.되돌리기 = () => { global.fetch = 원래; };
  return 상자;
}

const 한컷인자 = (이름) => ({
  이름, 지시: '무시된다', 참조: [], 저장경로: path.join(os.tmpdir(), `synk-시험-${이름}.png`), k: '가짜키',
});

test('🔑 돈 벽이 선 뒤에는 **네트워크를 아예 안 탄다** — 첫 장이 429면 둘째 장은 호출 0', async () => {
  const M = 새로열기();
  const f = 가짜fetch(429, '{"error":{"message":"prepayment credits are depleted"}}');
  try {
    await assert.rejects(() => M.한컷(한컷인자('첫장')), (e) => e.돈벽 === true, '429 인데 돈벽으로 안 세웠다');
    assert.strictEqual(f.횟수, 1, '첫 장은 한 번 던지는 게 맞다');

    await assert.rejects(() => M.한컷(한컷인자('둘째장')), (e) => e.안던졌다 === true,
      '벽이 섰는데 둘째 장이 «안 던졌다»로 거절되지 않았다');
    assert.strictEqual(f.횟수, 1, '🔴 벽이 선 뒤에도 또 던졌다 — 이게 09-03 에 하루 몫을 태운 그 무늬다');

    assert.strictEqual(M.구워도되나().된다, false, '벽이 섰는데 구워도된다고 답한다');
  } finally { f.되돌리기(); }
});

test('돈 벽과 «그 장만의 실패»를 가른다 — 400 은 벽이 아니라서 다음 장을 막지 않는다', async () => {
  const M = 새로열기();
  const f = 가짜fetch(400, '{"error":{"message":"bad prompt"}}');
  try {
    await assert.rejects(() => M.한컷(한컷인자('첫장')), (e) => !e.돈벽, '400 을 돈벽으로 잘못 세웠다');
    await assert.rejects(() => M.한컷(한컷인자('둘째장')), (e) => !e.안던졌다);
    assert.strictEqual(f.횟수, 2, '400 은 그 장만의 실패다 — 다음 장은 그대로 던져야 한다');
    assert.strictEqual(M.구워도되나().된다, true);
  } finally { f.되돌리기(); }
});

test('벽으로 세는 상태 — 429·402 는 벽 · 403 은 문면이 돈일 때만 · 400/500 은 아니다', () => {
  const M = 새로열기();
  assert.ok(M.돈벽인가(429, ''), '429 가 벽이 아니다');
  assert.ok(M.돈벽인가(402, ''), '402(결제 필요)가 벽이 아니다');
  assert.ok(M.돈벽인가(403, 'billing account not found'), '결제 문면의 403 이 벽이 아니다');
  assert.ok(!M.돈벽인가(403, 'model not allowed'), '돈과 무관한 403 을 벽으로 셌다');
  assert.ok(!M.돈벽인가(400, 'invalid argument'), '400 을 벽으로 셌다');
  assert.ok(!M.돈벽인가(500, 'internal'), '저쪽 사고(500)를 벽으로 셌다 — 그건 다시 던져 볼 자리다');
});

test('예상비용은 굽기 «전»에 답한다(0원 · 네트워크 0) — 4K 가 더 비싸다', () => {
  const M = 새로열기();
  const a = M.예상비용(4, '1K');
  assert.strictEqual(a.장수, 4);
  assert.ok(a.원 > 0, '원 값이 안 나온다');
  assert.ok(M.예상비용(1, '4K').달러 > M.예상비용(1, '1K').달러, '4K 가 1K 보다 싸게 셈된다');
  /* 표가 낡으면 사람이 잘못된 수를 보고 판단한다 — 머리말의 공식 가격표(09-03)와 묶어 둔다. */
  assert.strictEqual(M.장당달러['1K'], 0.134, '1K 장당 값이 09-03 공식 가격표와 다르다');
  assert.strictEqual(M.장당달러['4K'], 0.24, '4K 장당 값이 09-03 공식 가격표와 다르다');
});

test('🔑 돈 드는 두 도구가 **게이트를 실제로 부른다** — 붙여만 두고 안 부르면 장치가 죽는다', () => {
  const fs = require('node:fs');
  for (const 이름 of ['펠트색굽기.js', '라디오무대굽기.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 이름), 'utf8');
    assert.match(src, /배치게이트\s*\(/, `${이름} 이 배치게이트를 안 부른다`);
    assert.match(src, /배치게이트[^)]*\)\s*\)\s*\)/, `${이름} 이 게이트 결과를 «보고 멈추지» 않는다`);
  }
});
