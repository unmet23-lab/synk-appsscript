'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createTranscriber, MAX_AUDIO_BYTES } = require('../tools/patent-studio/transcriber.cjs');

const model = 'gemini-3.8-flash';
const bytes = Buffer.from('RIFF-audio-fixture-bytes');
const response = (value = { text: '어제 공원에 갔어요.', alternatives: [] }, extra = {}) => ({
  modelVersion: model,
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }],
  ...extra,
});
function policy(overrides = {}) {
  return {
    제미나이설정: () => ({ model }),
    제미나이URL: (purpose, selected) => purpose === '돈'
      ? 'https://aiplatform.googleapis.com/v1/projects/test/locations/global/publishers/google/models/' + selected + ':generateContent'
      : 'https://generativelanguage.googleapis.com/v1beta/models/' + selected + ':generateContent',
    제미나이키: () => 'test-secret-not-for-output',
    제미나이헤더: async () => ({ 'x-goog-api-key': 'test-secret-not-for-output' }),
    유료API허용: (_args, env) => env.SYNK_ALLOW_PAID_API === '1',
    붙인자격: () => 'fixture-only',
    벌텍스프로젝트: () => 'test',
    벌텍스자격확인: (j) => { if (!j.valid) throw new Error('private-path-and-token'); },
    ...overrides,
  };
}
function adapter(options = {}) {
  return createTranscriber({
    policy: policy(), env: {},
    fetchImpl: async () => ({ ok: true, json: async () => response() }),
    ...options,
  });
}

test('status checks configuration without a generation or authentication request', async () => {
  let touched = false;
  const a = adapter({ policy: policy({ 제미나이헤더: async () => { touched = true; } }),
    fetchImpl: async () => { touched = true; } });
  assert.deepEqual(await a.status(), { available: true, provider: 'gemini', model, reason: 'configured_not_probed' });
  assert.equal(touched, false);
});

test('manual, missing credentials, and a blocked Vertex route never transmit audio', async () => {
  let calls = 0;
  for (const a of [
    adapter({ env: { SYNK_PATENT_STT_PROVIDER: 'manual' } }),
    adapter({ policy: policy({ 제미나이키: () => null }) }),
    adapter({ env: { SYNK_PATENT_STT_PROVIDER: 'vertex' } }),
  ]) {
    assert.equal((await a.status()).available, false);
    await assert.rejects(() => a.transcribe({ bytes, mimeType: 'audio/wav' }),
      { code: 'TRANSCRIBER_UNAVAILABLE' });
  }
  const a = adapter({ env: { SYNK_PATENT_STT_PROVIDER: 'vertex' }, fetchImpl: async () => { calls++; } });
  await assert.rejects(() => a.transcribe({ bytes, mimeType: 'audio/wav' }));
  assert.equal(calls, 0);
});

test('sends the actual audio bytes without any caller-supplied expected answer', async () => {
  let sent;
  let sentBody;
  const a = adapter({ fetchImpl: async (_url, init) => {
    sentBody = init.body;
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => response({
      text: '어제 공원에 갔어요.',
      alternatives: [{ text: '어제 공원에 갔어요.', confidence: 1 }, { text: '어제 공원에 가요.', confidence: 0.7 }],
    }) };
  } });
  const result = await a.transcribe({ bytes, mimeType: 'audio/webm;codecs=opus', expectedAnswer: '비밀 정답 예시' });
  const parts = sent.contents[0].parts;
  assert.equal(parts[1].inlineData.mimeType, 'audio/webm');
  assert.deepEqual(Buffer.from(parts[1].inlineData.data, 'base64'), bytes);
  assert.equal(JSON.stringify(sent).includes('비밀 정답 예시'), false);
  assert.deepEqual(result.alternatives, [{ text: '어제 공원에 갔어요.' }, { text: '어제 공원에 가요.' }]);
  assert.equal(result.raw.request.audioSha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.raw.request.audioRef, 'sha256:' + result.raw.request.audioSha256);
  assert.equal(result.raw.request.prompt, parts[0].text);
  assert.deepEqual(result.raw.request.generationConfig, sent.generationConfig);
  assert.equal(result.raw.request.requestBodySha256, crypto.createHash('sha256').update(sentBody, 'utf8').digest('hex'));
  const reconstructed = structuredClone(result.raw.request.requestBodyTemplate);
  const audioPart = reconstructed.contents[0].parts[1].inlineData;
  assert.equal(audioPart.dataRef, result.raw.request.audioRef);
  reconstructed.contents[0].parts[1].inlineData = { mimeType: audioPart.mimeType, data: bytes.toString('base64') };
  assert.equal(JSON.stringify(reconstructed), sentBody);
  assert.equal(JSON.stringify(result.raw.request).includes(bytes.toString('base64')), false);
  assert.equal(Object.hasOwn(result.raw.request, 'headers'), false);
  assert.equal(Object.hasOwn(result.raw.request, 'endpoint'), false);
  assert.equal(result.raw.coverage, 'not_complete');
  assert.equal(JSON.stringify(result).includes('test-secret-not-for-output'), false);
  assert.equal((await a.status()).reason, 'last_request_succeeded');
});

test('audio is copied before awaiting authentication', async () => {
  const original = Buffer.from(bytes);
  const input = Buffer.from(bytes);
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  let submitted;
  const a = adapter({
    policy: policy({ 제미나이헤더: async () => { await ready; return {}; } }),
    fetchImpl: async (_url, init) => { submitted = JSON.parse(init.body); return { ok: true, json: async () => response() }; },
  });
  const work = a.transcribe({ bytes: input, mimeType: 'audio/wav' });
  input.fill(0);
  release();
  await work;
  assert.deepEqual(Buffer.from(submitted.contents[0].parts[1].inlineData.data, 'base64'), original);
});

test('rejects empty, unsupported, and oversized input before vendor calls', async () => {
  let calls = 0;
  const a = adapter({ fetchImpl: async () => { calls++; } });
  await assert.rejects(() => a.transcribe({ bytes: Buffer.alloc(0), mimeType: 'audio/wav' }), { code: 'INVALID_AUDIO' });
  await assert.rejects(() => a.transcribe({ bytes, mimeType: 'text/html' }), { code: 'UNSUPPORTED_AUDIO_TYPE' });
  await assert.rejects(() => a.transcribe({ bytes: Buffer.alloc(MAX_AUDIO_BYTES + 1), mimeType: 'audio/wav' }), { code: 'AUDIO_TOO_LARGE' });
  assert.equal(calls, 0);
});

test('does not send credentials to a configured non-provider endpoint', async () => {
  let calls = 0;
  const a = adapter({
    policy: policy({ 제미나이URL: () => 'https://example.invalid/models/test:generateContent' }),
    fetchImpl: async () => { calls++; },
  });
  assert.equal((await a.status()).reason, 'unsupported_endpoint');
  await assert.rejects(() => a.transcribe({ bytes, mimeType: 'audio/wav' }), { code: 'TRANSCRIBER_UNAVAILABLE' });
  assert.equal(calls, 0);
});

test('rejects truncated, wrong-model, malformed, and empty candidate responses', async () => {
  const bad = [
    response(undefined, { modelVersion: 'different-model' }),
    response(undefined, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] }),
    response(undefined, { candidates: [] }),
    response(undefined, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not-json' }] } }] }),
    response({ text: '들린 말', alternatives: [{ confidence: 0.9 }] }),
  ];
  for (const body of bad) {
    const a = adapter({ fetchImpl: async () => ({ ok: true, json: async () => body }) });
    await assert.rejects(() => a.transcribe({ bytes, mimeType: 'audio/wav' }), { code: 'TRANSCRIBER_RESPONSE' });
  }
});

test('no speech is an empty transcript, distinct from missing or failed transcription', async () => {
  const a = adapter({ fetchImpl: async () => ({ ok: true, json: async () => response({ text: '', alternatives: [] }) }) });
  const r = await a.transcribe({ bytes, mimeType: 'audio/wav' });
  assert.equal(r.text, '');
  assert.deepEqual(r.alternatives, []);
});

test('HTTP and network failures expose fixed codes, no provider message, and no automatic retry', async () => {
  let calls = 0;
  let readErrorBody = false;
  const a = adapter({ fetchImpl: async () => {
    calls++;
    return { ok: false, status: 429, json: async () => { readErrorBody = true; return { error: 'secret-and-audio-path' }; } };
  } });
  await assert.rejects(() => a.transcribe({ bytes, mimeType: 'audio/wav' }), { code: 'TRANSCRIBER_HTTP', httpStatus: 429 });
  assert.equal(calls, 1);
  assert.equal(readErrorBody, false);
  assert.equal((await a.status()).reason, 'last_request_failed_vendor_http_429');
  const b = adapter({ fetchImpl: async () => { throw new Error('secret-and-audio-path'); } });
  await assert.rejects(() => b.transcribe({ bytes, mimeType: 'audio/wav' }), e => e.code === 'TRANSCRIBER_NETWORK' && !e.message.includes('secret'));
});

test('a failed request can be explicitly retried without a different provider', async () => {
  let calls = 0;
  const a = adapter({ fetchImpl: async () => {
    calls++;
    return calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => response() };
  } });
  await assert.rejects(() => a.transcribe({ bytes, mimeType: 'audio/wav' }));
  assert.equal((await a.status()).available, true);
  assert.equal((await a.status()).reason, 'last_request_failed_vendor_http_503');
  const r = await a.transcribe({ bytes, mimeType: 'audio/wav' });
  assert.equal(r.provider, 'gemini');
  assert.equal((await a.status()).available, true);
});
