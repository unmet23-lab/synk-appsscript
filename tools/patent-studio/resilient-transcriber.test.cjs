'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createResilientTranscriber } = require('./resilient-transcriber.cjs');
const audio = Buffer.from('actual-audio-input');
const failure = () => Object.assign(new Error('vendor-private-message'), { code: 'TRANSCRIBER_NETWORK' });
const adapter = (provider, run) => ({ status: async () => ({ available: true, provider, model: provider }), transcribe: run,
  warmup: async () => ({ available: true }), close: async () => {} });
const success = provider => ({ text: '실제 응답', alternatives: [{ text: '실제 응답' }], provider, model: provider, raw: { coverage: 'not_complete' } });

test('local default never calls the available external recognizer', async () => {
  let calls = 0;
  const t = createResilientTranscriber({ env: {}, local: adapter('local', async ({bytes}) => { assert.deepEqual(bytes,audio); return success('local'); }), cloud: adapter('gemini', async () => { calls++; return success('gemini'); }) });
  const r = await t.transcribe({ bytes: audio, mimeType: 'audio/wav' });
  assert.equal(r.provider, 'local'); assert.equal(calls, 0); assert.equal(r.raw.routeAttempts[0].outcome, 'succeeded');
});
test('explicit automatic fallback records the real failure and passes identical audio to local', async () => {
  const seen = [];
  const t = createResilientTranscriber({ env: {}, local: adapter('local', async ({bytes}) => { seen.push(Buffer.from(bytes)); return success('local'); }), cloud: adapter('gemini', async ({bytes}) => { seen.push(Buffer.from(bytes)); bytes.fill(0); throw failure(); }) });
  const r = await t.transcribe({ bytes: audio, mimeType: 'audio/wav', provider: 'auto' });
  assert.deepEqual(seen,[audio,audio]); assert.deepEqual(r.raw.routeAttempts.map(a=>a.outcome),['failed','succeeded']);
  assert.equal(r.raw.routeAttempts[0].code,'TRANSCRIBER_NETWORK'); assert.ok(!JSON.stringify(r).includes('vendor-private-message'));
});
test('external success is retained and does not trigger unnecessary local recognition', async () => {
  let calls = 0;
  const t = createResilientTranscriber({ env: {}, local: adapter('local', async () => {calls++;return success('local');}), cloud: adapter('gemini',async()=>success('gemini')) });
  assert.equal((await t.transcribe({bytes:audio,mimeType:'audio/wav',provider:'auto'})).provider,'gemini'); assert.equal(calls,0);
});
test('local failure and manual selection never silently transmit audio externally', async () => {
  let calls=0;const t=createResilientTranscriber({env:{},local:adapter('local',async()=>{throw failure();}),cloud:adapter('gemini',async()=>{calls++;return success('gemini');})});
  await assert.rejects(t.transcribe({bytes:audio,mimeType:'audio/wav'}));
  await assert.rejects(t.transcribe({bytes:audio,mimeType:'audio/wav',provider:'manual'})); assert.equal(calls,0);
});
test('preflight uses the local recognizer even when the configured default is external', async () => {
  let calls=0;const t=createResilientTranscriber({env:{SYNK_PATENT_STT_PROVIDER:'gemini'},local:adapter('local',async()=>success('local')),cloud:adapter('gemini',async()=>{calls++;return success('gemini');})});
  assert.equal((await t.preflight(audio)).provider,'local'); assert.equal(calls,0);
});
test('both failed routes remain failed and preserve attempt diagnostics', async () => {
  const t=createResilientTranscriber({env:{},local:adapter('local',async()=>{throw Object.assign(new Error(),{code:'LOCAL_MODEL_LOAD_FAILED'});}),cloud:adapter('gemini',async()=>{throw failure();})});
  await assert.rejects(t.transcribe({bytes:audio,mimeType:'audio/wav',provider:'auto'}),e=>e.routeAttempts.length===2&&e.routeAttempts.every(a=>a.outcome==='failed'));
});
