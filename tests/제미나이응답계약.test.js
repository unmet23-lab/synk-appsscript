'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const 정책 = require('../tools/모델정책.js');
const 호출 = require('../tools/lib/제미나이호출.js');

// 공식 REST GenerateContentResponse/Content 모양. 합성 데이터만 쓰며 네트워크는 스텁이다.
const model = 'gemini-3.8-flash';
const 정상 = (patch = {}) => ({
  modelVersion: model,
  candidates: [{ content: { role: 'model', parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4, totalTokenCount: 7 },
  ...patch,
});
function 전송스텁(t, response) {
  t.mock.method(정책, '제미나이헤더', async () => ({ 'content-type': 'application/json' }));
  return t.mock.method(globalThis, 'fetch', async () => ({
    ok: true, status: 200, json: async () => response,
  }));
}

test('사고 요약은 제외하고 최종 텍스트와 사용량·서빙 모델을 보존한다', async (t) => {
  전송스텁(t, 정상({ candidates: [{ finishReason: 'STOP', content: { parts: [
    { thought: true, text: '합성 사고 요약' },
    { thoughtSignature: 'synthetic-signature' },
    { text: '{"ok":' }, { text: 'true}' },
  ] } }] }));
  const r = await 호출.제미나이(null, model, '합성 입력', { 상세: true });
  assert.equal(r.text, '{"ok":true}');
  assert.equal(r.modelVersion, model);
  assert.equal(r.finishReason, 'STOP');
  assert.equal(r.usage.totalTokenCount, 7);
});

test('잘린 답·차단·미완료를 내용이 있어도 성공으로 내보내지 않는다', () => {
  for (const finishReason of ['MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER', undefined]) {
    assert.throws(() => 호출.응답읽기(정상({ candidates: [{
      finishReason, content: { parts: [{ text: '{"ok":true}' }] },
    }] }), model), /정상 완료되지 않았다/);
  }
  assert.throws(() => 호출.응답읽기({ promptFeedback: { blockReason: 'SAFETY' } }, model), /완료 후보가 없다/);
});

test('빈 답과 사고 요약만 있는 답은 정상 STOP이어도 거절한다', () => {
  for (const parts of [[], [{ text: ' ' }], [{ text: '합성 사고', thought: true }]]) {
    assert.throws(() => 호출.응답읽기(정상({ candidates: [{ finishReason: 'STOP', content: { parts } }] }), model), /최종 텍스트가 비었다/);
  }
});

test('같은 모델의 숫자·날짜 판번호만 허용하고 다른 계열과 서빙 모델 누락은 거절한다', () => {
  for (const suffix of ['', '-001', '-09-02', '-2026-09-02']) {
    assert.equal(호출.서빙모델일치(model, model + suffix), true);
  }
  for (const actual of [null, '', model + '-lite', model + '0', 'gemini-3.1-pro-preview']) {
    assert.throws(() => 호출.응답읽기(정상({ modelVersion: actual }), model), /서빙 모델 확인 불가/);
  }
});

test('비용 차단과 인증 실패는 HTTP 0회·인증 1회로 즉시 끝낸다', async (t) => {
  const e = Object.assign(new Error('합성 유료 차단'), { code: 'PAID_API_DISABLED' });
  const auth = t.mock.method(정책, '제미나이헤더', async () => { throw e; });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('전송되면 안 됨'); });
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력', { 용도: '돈' }), (caught) => caught === e);
  assert.equal(auth.mock.callCount(), 1);
  assert.equal(fetch.mock.callCount(), 0);
});

test('HTTP 성공 뒤 깨진 JSON·모델 불일치·잘린 답은 추론을 다시 청구하지 않는다', async (t) => {
  const fetch = 전송스텁(t, 정상());
  fetch.mock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('broken'); } }));
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력'), /응답 JSON/);
  assert.equal(fetch.mock.callCount(), 1);

  fetch.mock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => 정상({ modelVersion: 'gemini-3.5-flash' }) }));
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력'), /서빙 모델 확인 불가/);
  assert.equal(fetch.mock.callCount(), 2);

  fetch.mock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => 정상({ candidates: [{ finishReason: 'MAX_TOKENS' }] }) }));
  await assert.rejects(() => 호출.제미나이(null, model, '합성 입력'), /MAX_TOKENS/);
  assert.equal(fetch.mock.callCount(), 3);
});

function 프로브설정(t, { paid = false, credentials = true } = {}) {
  const fs = require('node:fs');
  const saved = { ...process.env };
  t.after(() => {
    for (const key of ['SYNK_VERTEX_OAUTH', 'SYNK_VERTEX_PROJECT', 'SYNK_ALLOW_PAID_API', 'GEMINI_KEY_PATH_FREE']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  });
  process.env.SYNK_VERTEX_OAUTH = 'synthetic-oauth.json';
  process.env.SYNK_VERTEX_PROJECT = 'synthetic-project';
  process.env.GEMINI_KEY_PATH_FREE = 'synthetic-free-key.txt';
  process.env.SYNK_ALLOW_PAID_API = paid ? '1' : '0';
  t.mock.method(fs, 'existsSync', (p) => credentials && ['synthetic-oauth.json', 'synthetic-free-key.txt'].includes(p));
  t.mock.method(fs, 'readFileSync', (p) => {
    if (p === 'synthetic-free-key.txt') return 'synthetic-key';
    if (p === 'synthetic-oauth.json') return JSON.stringify({ 프로젝트: 'synthetic-project',
      client_id: 'synthetic-client', client_secret: 'synthetic-secret', refresh_token: 'synthetic-refresh' });
    throw new Error('합성 캐시는 없다. 다른 자격 파일도 읽지 않는다');
  });
  t.mock.method(fs, 'writeFileSync', () => {});
  const logs = [];
  t.mock.method(console, 'log', (...args) => logs.push(args.join(' ')));
  t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
  return logs;
}

test('생존 프로브도 빈 HTTP 200·미완료·다른 모델을 성공으로 세지 않는다', async (t) => {
  프로브설정(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => ({}) }));
  for (const body of [{}, 정상({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
    정상({ modelVersion: 'gemini-3.1-pro-preview' }), 정상({ modelVersion: undefined })]) {
    fetch.mock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => body }));
    const result = await 정책.제미나이생존({ 용도: '글' });
    assert.equal(result.살았나, null);
    assert.equal(result.종류, '응답불완전');
  }
  fetch.mock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => 정상() }));
  assert.equal((await 정책.제미나이생존({ 용도: '글' })).살았나, true);
  assert.equal(fetch.mock.callCount(), 5);
});

test('OAuth 자격 부재는 CLI 확인 불가·비정상 종료이며 요청·거짓 성공이 없다', async (t) => {
  const logs = 프로브설정(t, { paid: true, credentials: false });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('전송 금지'); });
  assert.equal(await 정책.제미나이확인('돈'), 2);
  assert.equal(fetch.mock.callCount(), 0);
  assert.match(logs.join('\n'), /확인 불가\(키없음\)/);
  assert.doesNotMatch(logs.join('\n'), /응답 OK|✅ 프로브/);
});

test('유료 차단도 확인 성공이 아니며 호출하지 않고 비정상 종료한다', async (t) => {
  const logs = 프로브설정(t, { paid: false });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('전송 금지'); });
  assert.equal(await 정책.제미나이확인('돈'), 2);
  assert.equal(fetch.mock.callCount(), 0);
  assert.match(logs.join('\n'), /확인 불가\(유료차단\)/);
  assert.doesNotMatch(logs.join('\n'), /응답 OK|✅ 프로브/);
});

test('OAuth 프로브는 폐기 API 키 없이 정상 응답을 확인하고 불완전 응답은 거절한다', async (t) => {
  const logs = 프로브설정(t, { paid: true });
  let body = 정상();
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => ({ ok: true, status: 200,
    json: async () => url === 'https://oauth2.googleapis.com/token'
      ? { access_token: 'synthetic-access-token', expires_in: 3600 } : body }));
  assert.equal(await 정책.제미나이확인('돈'), 0);
  assert.match(logs.join('\n'), /응답 OK/);
  body = {};
  logs.length = 0;
  assert.equal(await 정책.제미나이확인('돈'), 2);
  assert.match(logs.join('\n'), /확인 불가\(응답불완전\)/);
  assert.doesNotMatch(logs.join('\n'), /응답 OK|✅ 프로브/);
  assert.equal(fetch.mock.callCount(), 4);
});
