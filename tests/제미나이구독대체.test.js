'use strict';

// 무료 몫 429 → 같은 모델로 Google AI 구독 통로(2026-10-17). 네트워크·agy는 모두 스텁이며 실제 키를 읽지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const 정책 = require('../tools/모델정책.js');
const 호출 = require('../tools/lib/제미나이호출.js');

const model = 'gemini-3.8-flash';
const 깨끗한환경 = {};
const 하루몫 = { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 20. Please retry in 23h7m.',
  details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests' }] },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '83220s' }] } };
const 분당몫 = { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded. Please retry in 12.5s.',
  details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12s' }] } };
const 정상 = { modelVersion: model, candidates: [{ content: { parts: [{ text: 'API 답' }] }, finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 3 } };

function 전송(t, 순서) {
  t.mock.method(정책, '제미나이헤더', async () => ({ 'content-type': 'application/json' }));
  let i = 0;
  return t.mock.method(globalThis, 'fetch', async () => {
    const [status, body] = 순서[Math.min(i++, 순서.length - 1)];
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
}
function 가짜구독(답 = { text: '구독 답', modelVersion: 'gemini-3.8-flash-high', route: 'google-ai-subscription' }) {
  const 받은 = [];
  const fn = async (arg) => { 받은.push(arg); if (답 instanceof Error) throw 답; return 답; };
  return { fn, 받은 };
}

test('몫 읽기: 하루 몫·분당 몫·몫 아님을 가르고 다시 시도 시간을 초로 읽는다', () => {
  assert.equal(호출.시간초('83220s'), 83220);
  assert.equal(호출.시간초('23h7m'), 83220);
  assert.equal(호출.시간초('12.5s'), 12.5);
  assert.equal(호출.시간초('곧'), null);
  assert.deepEqual(호출.몫읽기(429, 하루몫).하루, true);
  const 분 = 호출.몫읽기(429, 분당몫);
  assert.equal(분.몫, true); assert.equal(분.하루, false); assert.equal(분.다시초, 12);
  assert.equal(호출.몫읽기(429, { error: { message: 'Please retry in 23h7m.' } }).하루, true);
  assert.equal(호출.몫읽기(429, null).몫, true);
  for (const status of [400, 401, 403, 500, 503]) assert.equal(호출.몫읽기(status, { error: { message: 'x' } }).몫, false);
});

test('대체는 정책·부른 쪽이 모두 허용한 무료 문에서만 — 유료·CI·끄기 변수·미허용은 막는다', () => {
  assert.equal(정책.제미나이.구독대체, true);
  assert.equal(정책.제미나이.폴백허용, false);
  assert.equal(호출.구독대체허용({ 구독대체: true }, '글', 깨끗한환경), true);
  assert.equal(호출.구독대체허용({}, '글', 깨끗한환경), false);
  assert.equal(호출.구독대체허용({ 구독대체: true }, '돈', 깨끗한환경), false);
  assert.equal(호출.구독대체허용({ 구독대체: true }, '글', { CI: 'true' }), false);
  assert.equal(호출.구독대체허용({ 구독대체: true }, '글', { GITHUB_ACTIONS: 'true' }), false);
  assert.equal(호출.구독대체허용({ 구독대체: true }, '글', { SYNK_GEMINI_NO_SUBSCRIPTION_FALLBACK: '1' }), false);
});

test('하루 몫 429는 재시도 없이 같은 모델·사고·스키마로 구독을 한 번 부르고, 상세에 넘김을 남긴다', async (t) => {
  const fetch = 전송(t, [[429, 하루몫]]);
  const 구독 = 가짜구독();
  const schema = { type: 'object', properties: { 판정: { type: 'string' } } };
  const r = await 호출.제미나이(null, model, '합성 입력', { 상세: true, 구독대체: true, 구독호출: 구독.fn, 환경: 깨끗한환경, thinking: 'high', schema, 재시도지연: [0, 0] });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(구독.받은.length, 1);
  assert.deepEqual({ ...구독.받은[0], timeoutMs: undefined }, { model, prompt: '합성 입력', schema, thinking: 'high', timeoutMs: undefined });
  assert.equal(r.text, '구독 답');
  assert.equal(r.route, 'google-ai-subscription');
  assert.deepEqual(r.대체, { from: 'google-ai-studio-free-api', 사유: '하루 몫 상한', 다시초: 83220 });
  assert.equal(await 호출.제미나이(null, model, '합성 입력', { 구독대체: true, 구독호출: 구독.fn, 환경: 깨끗한환경, 재시도지연: [0, 0] }), '구독 답');
});

test('분당 몫 429는 정해 둔 재시도를 먼저 하고, 그래도 막히면 구독으로 넘긴다', async (t) => {
  const fetch = 전송(t, [[429, 분당몫]]);
  const 구독 = 가짜구독();
  const r = await 호출.제미나이(null, model, '합성 입력', { 상세: true, 구독대체: true, 구독호출: 구독.fn, 환경: 깨끗한환경, 재시도지연: [0, 0] });
  assert.equal(fetch.mock.callCount(), 3);
  assert.equal(구독.받은.length, 1);
  assert.equal(r.대체.사유, '분당 몫 상한');

  fetch.mock.mockImplementation(async () => ({ ok: false, status: 429, json: async () => 분당몫 }));
  let n = 0;
  fetch.mock.mockImplementation(async () => (n++ === 0 ? { ok: false, status: 429, json: async () => 분당몫 } : { ok: true, status: 200, json: async () => 정상 }));
  const 회복 = await 호출.제미나이(null, model, '합성 입력', { 상세: true, 구독대체: true, 구독호출: 구독.fn, 환경: 깨끗한환경, 재시도지연: [0, 0] });
  assert.equal(회복.route, 'google-ai-studio-free-api');
  assert.equal(구독.받은.length, 1, '재시도에서 풀리면 구독을 부르지 않는다');
});

test('허용하지 않았거나 몫 문제가 아니면 구독을 부르지 않는다', async (t) => {
  const 구독 = 가짜구독();
  const fetch = 전송(t, [[429, 하루몫]]);
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력', { 구독호출: 구독.fn, 환경: 깨끗한환경, 재시도지연: [0, 0] }), /^Error: 429/);
  assert.equal(fetch.mock.callCount(), 3);
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력', { 구독대체: true, 구독호출: 구독.fn, 환경: { CI: 'true' }, 재시도지연: [0, 0] }), /429/);
  for (const [status, body, 횟수] of [[400, { error: { message: 'bad' } }, 1], [403, { error: { message: 'denied' } }, 1], [500, { error: { message: 'oops' } }, 3]]) {
    let k = 0;
    fetch.mock.mockImplementation(async () => { k++; return { ok: false, status, json: async () => body }; });
    await assert.rejects(() => 호출.제미나이(null, model, '합성 입력', { 구독대체: true, 구독호출: 구독.fn, 환경: 깨끗한환경, 재시도지연: [0, 0] }), new RegExp(String(status)));
    assert.equal(k, 횟수, `${status}`);
  }
  let m = 0;
  fetch.mock.mockImplementation(async () => { m++; return { ok: true, status: 200, json: async () => ({ ...정상, candidates: [{ finishReason: 'MAX_TOKENS' }] }) }; });
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력', { 구독대체: true, 구독호출: 구독.fn, 환경: 깨끗한환경 }), /MAX_TOKENS/);
  assert.equal(m, 1);
  assert.equal(구독.받은.length, 0);
});

test('구독도 실패하면 Vertex로 가지 않고 두 원인을 함께 알린다', async (t) => {
  const fetch = 전송(t, [[429, 하루몫]]);
  const 구독 = 가짜구독(new Error('Google AI 구독 통로가 지원하지 않는 픽 gemini-3.6-flash/high'));
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력', { 구독대체: true, 구독호출: 구독.fn, 환경: 깨끗한환경 }),
    /429 무료 몫 상한 — 구독 통로로 넘겼지만 실패했다\(Vertex로는 가지 않는다\): Google AI 구독 통로가 지원하지 않는 픽/);
  assert.equal(fetch.mock.callCount(), 1);
  const 빈답 = 가짜구독({ text: '' });
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력', { 구독대체: true, 구독호출: 빈답.fn, 환경: 깨끗한환경 }), /빈 답/);
});
