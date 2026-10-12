import test from 'node:test';
import assert from 'node:assert/strict';
import { WhisperModel } from '../interview/whisper-model.mjs';
import { createPcmBuffer, createWhisperWorkerRuntime, decoderWords, OUTPUT_RATE } from '../interview/whisper-worker.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function pcm(seconds, rate = OUTPUT_RATE, frequency = 440) {
  return Float32Array.from({ length: Math.round(seconds * rate) }, (_, index) => Math.sin(2 * Math.PI * frequency * index / rate) * 8192);
}
function runtimeFixture({ delayed = false } = {}) {
  const events = [], calls = [], pending = [];
  let warmups = 0;
  const backend = { async warmup() { warmups += 1; }, async dispose() {}, decode(audio) {
    calls.push(audio);
    if (!delayed) return Promise.resolve({ text: '저는 직접 도왔습니다', words: [{ word: '저는', conf: .8 }, { word: '직접', conf: .7 }, { word: '도왔습니다', conf: .9 }] });
    const job = deferred(); pending.push(job); return job.promise;
  } };
  const runtime = createWhisperWorkerRuntime({ postMessage: (event) => events.push(event), loadBackend: async (progress) => { progress({ phase: 'download', loaded: 10, total: 10 }); return backend; } });
  const send = (action, details = {}) => runtime.handle({ action, recognizerId: 'a', ...details });
  const audio = (samples, details = {}) => send('audioChunk', { data: samples, sampleRate: OUTPUT_RATE, ...details });
  return { runtime, send, audio, events, calls, pending, get warmups() { return warmups; } };
}

test('PCM converts worklet scale, rejects invalid rates and keeps storage bounded', () => {
  assert.throws(() => createPcmBuffer(0), /sample rate/);
  const buffer = createPcmBuffer(16000, { maxSeconds: 1 });
  const signal = pcm(1.25); signal[100] = 16384;
  buffer.append(signal); buffer.flush();
  assert.equal(buffer.size, 16000);
  assert.equal(buffer.truncated, true);
  assert.equal(buffer.snapshot().length, 16000);
  assert.equal(buffer.snapshot()[100], .5);
  assert.throws(() => createPcmBuffer(16000).append(new Float32Array(20), 48000), /sample rate changed/);
});

test('the capture bound ignores complete zero padding but detects a nonzero sample anywhere in overflow', () => {
  for (const tail of [new Float32Array(128), new Float32Array(2048)]) {
    const buffer = createPcmBuffer(16000, { maxSeconds: 1 });
    buffer.append(pcm(1)); buffer.append(tail); buffer.flush();
    assert.equal(buffer.size, 16000);
    assert.equal(buffer.truncated, false, 'deadline padding alone did not discard speech');
  }
  for (const position of [0, 1, 127]) {
    const buffer = createPcmBuffer(16000, { maxSeconds: 1 });
    const tail = new Float32Array(128); tail[position] = .001;
    buffer.append(pcm(1)); buffer.append(tail); buffer.flush();
    assert.equal(buffer.size, 16000); assert.equal(buffer.truncated, true, `nonzero overflow at ${position} was discarded`);
  }
  const oneBlock = createPcmBuffer(16000, { maxSeconds: 1 });
  const joined = new Float32Array(16000 + 128); joined.set(pcm(1)); joined[joined.length - 1] = 1;
  oneBlock.append(joined); oneBlock.flush(); assert.equal(oneBlock.truncated, true, 'overflow later in the block that fills the buffer is also detected');
});

test('48 kHz resampling is chunk invariant and attenuates frequencies above the 16 kHz Nyquist limit', () => {
  const input = pcm(1, 48000);
  const whole = createPcmBuffer(48000), split = createPcmBuffer(48000);
  whole.append(input); whole.flush();
  for (let index = 0; index < input.length; index += 137) split.append(input.slice(index, index + 137));
  split.flush();
  assert.deepEqual(split.snapshot(), whole.snapshot());
  assert.ok(whole.size >= 16000 && whole.size < 16032);
  const aliased = createPcmBuffer(48000); aliased.append(pcm(1, 48000, 12000)); aliased.flush();
  assert.equal(aliased.snapshot(), null, '12 kHz cannot fold into a false 4 kHz speech signal');
});

test('44.1 kHz and 8 kHz are resampled and silence or isolated clicks cannot request a decode', () => {
  for (const rate of [44100, 8000]) {
    const buffer = createPcmBuffer(rate); buffer.append(pcm(1, rate)); buffer.flush();
    assert.ok(buffer.size > 15990 && buffer.size < 16050);
    assert.ok(buffer.snapshot().length > 15900);
  }
  const silent = createPcmBuffer(16000); silent.append(new Float32Array(16000)); silent.flush();
  assert.equal(silent.snapshot(), null);
  const click = createPcmBuffer(16000), samples = new Float32Array(16000); samples[300] = 32768;
  click.append(samples); click.flush(); assert.equal(click.snapshot(), null);
  const dc = createPcmBuffer(16000); dc.append(new Float32Array(16000).fill(1000)); dc.flush();
  assert.equal(dc.snapshot(), null, 'a stationary microphone offset is not speech');
});

test('the model becomes ready only after warmup, and an empty final is acknowledged without hallucination', async () => {
  const f = runtimeFixture(); await f.send('load');
  assert.equal(f.warmups, 1);
  assert.equal(f.events.at(-1).event, 'load'); assert.equal(f.events.at(-1).result, true);
  await f.send('create', { sampleRate: 16000 });
  await f.audio(new Float32Array(16000)); await f.send('retrieveFinalResult'); await tick();
  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.events.find((event) => event.final).result, { text: '', result: [], engine: 'whisper-base' });
  await f.runtime.dispose();
});

test('PCM port ordering retains the last partial block before the explicit final acknowledgement', async () => {
  const f = runtimeFixture(); await f.send('load'); await f.send('create', { sampleRate: 16000 });
  const port = { close() { this.closed = true; }, start() {} };
  await f.send('connectAudioPort', { port });
  port.onmessage({ data: { action: 'audioChunk', recognizerId: 'a', data: pcm(.5), sampleRate: 16000 } });
  port.onmessage({ data: { action: 'audioChunk', recognizerId: 'a', data: new Float32Array(128).fill(16384), sampleRate: 16000 } });
  port.onmessage({ data: { action: 'retrieveFinalResult', recognizerId: 'a' } });
  await tick();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].length, 8128);
  assert.equal(f.calls[0].at(-1), .5);
  assert.equal(f.events.filter((event) => event.final).length, 1);
  await f.send('retrieveFinalResult'); await f.audio(pcm(1)); await tick();
  assert.equal(f.events.filter((event) => event.final).length, 1, 'duplicate final/late PCM cannot append a second answer');
  await f.send('remove'); assert.equal(port.closed, true);
});

test('partial inference has an eight-second cadence, requires new voice, and never emits a committed result', async () => {
  const f = runtimeFixture(); await f.send('load'); await f.send('create', { sampleRate: 16000 });
  await f.audio(pcm(7)); await tick(); assert.equal(f.calls.length, 0);
  await f.audio(pcm(1)); await tick(); assert.equal(f.calls.length, 1);
  assert.equal(f.events.filter((event) => event.event === 'partialresult').length, 1);
  assert.equal(f.events.filter((event) => event.event === 'result').length, 0);
  await f.audio(new Float32Array(8 * 16000)); await tick(); assert.equal(f.calls.length, 1);
  await f.audio(pcm(.6)); await tick(); assert.equal(f.calls.length, 2);
  await f.runtime.dispose();
});

test('only one inference runs; queued partials coalesce and final takes priority with all PCM', async () => {
  const f = runtimeFixture({ delayed: true }); await f.send('load'); await f.send('create', { sampleRate: 16000 });
  await f.audio(pcm(8)); await f.audio(pcm(8)); await f.audio(pcm(8));
  await f.send('retrieveFinalResult'); assert.equal(f.calls.length, 1);
  f.pending[0].resolve({ text: 'stale partial', words: [] }); await tick();
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].length, 24 * 16000);
  assert.equal(f.events.filter((event) => event.event === 'partialresult').length, 0, 'stopping suppresses late partials');
  f.pending[1].resolve({ text: '마지막 말', words: [{ word: '마지막', conf: .7 }, { word: '말', conf: .8 }] }); await tick();
  assert.equal(f.events.filter((event) => event.final).length, 1);
  assert.equal(f.events.find((event) => event.final).result.text, '마지막 말');
  await f.runtime.dispose();
});

test('final reuses a completed partial only when the PCM differs solely by right-side zero padding', async () => {
  const f = runtimeFixture(); await f.send('load'); await f.send('create', { sampleRate: 16000 });
  await f.audio(pcm(8)); await tick();
  assert.equal(f.calls.length, 1);
  await f.audio(new Float32Array(6400));
  await f.send('retrieveFinalResult'); await tick();
  assert.equal(f.calls.length, 1, 'silence after an already decoded answer does not rerun the decoder');
  const partial = f.events.find((event) => event.event === 'partialresult');
  const final = f.events.find((event) => event.final);
  assert.equal(final.result.text, partial.result.partial);
  assert.equal(final.result.result.length, 3);
  assert.equal(f.events.filter((event) => event.final).length, 1);
  await f.runtime.dispose();
});

test('a complete thirty-second answer followed by a silent flush is not reported as truncated', async () => {
  const f = runtimeFixture(); await f.send('load'); await f.send('create', { sampleRate: 16000 });
  await f.audio(pcm(30)); await tick();
  await f.audio(new Float32Array(128)); await f.send('retrieveFinalResult'); await tick();
  const final = f.events.find((event) => event.final);
  assert.equal(final.result.text, '저는 직접 도왔습니다');
  assert.equal(final.result.truncated, undefined);
  assert.equal(f.calls.length, 1);
  await f.runtime.dispose();
});

test('final redecodes new voiced PCM and even a quiet nonzero tail rather than approximately matching a partial', async () => {
  for (const tail of [pcm(.3), new Float32Array(128).fill(.001)]) {
    const f = runtimeFixture(); await f.send('load'); await f.send('create', { sampleRate: 16000 });
    await f.audio(pcm(8)); await tick(); assert.equal(f.calls.length, 1);
    await f.audio(tail); await f.send('retrieveFinalResult'); await tick();
    assert.equal(f.calls.length, 2, 'any retained nonzero tail must reach the final decoder');
    assert.ok(f.calls[1].length > f.calls[0].length);
    assert.equal(f.calls[1].at(-1), tail.at(-1) / 32768);
    assert.equal(f.events.filter((event) => event.final).length, 1);
    await f.runtime.dispose();
  }
});

test('identical PCM in a new recognizer never reuses a previous recognizer result', async () => {
  const f = runtimeFixture({ delayed: true }); await f.send('load'); await f.send('create', { sampleRate: 16000 });
  const samples = pcm(8);
  await f.audio(samples); f.pending[0].resolve({ text: '첫 답변', words: [] }); await tick();
  await f.send('retrieveFinalResult'); await tick(); assert.equal(f.calls.length, 1);
  await f.send('remove'); await f.send('create', { recognizerId: 'b', sampleRate: 16000 });
  await f.audio(samples, { recognizerId: 'b' });
  assert.equal(f.calls.length, 2, 'the second owner must run its own inference');
  f.pending[1].resolve({ text: '두 번째 답변', words: [] }); await tick();
  await f.send('retrieveFinalResult', { recognizerId: 'b' }); await tick();
  assert.equal(f.calls.length, 2);
  const finals = f.events.filter((event) => event.final);
  assert.deepEqual(finals.map((event) => [event.recognizerId, event.result.text]), [['a', '첫 답변'], ['b', '두 번째 답변']]);
  await f.runtime.dispose();
});

test('remove/new capture discards old inference and final results without cancelling the next capture', async () => {
  const f = runtimeFixture({ delayed: true }); await f.send('load'); await f.send('create', { sampleRate: 16000 });
  await f.audio(pcm(8)); await f.send('retrieveFinalResult'); await f.send('remove');
  await f.send('create', { recognizerId: 'b', sampleRate: 16000 });
  await f.audio(pcm(1), { recognizerId: 'b' }); await f.send('retrieveFinalResult', { recognizerId: 'b' });
  f.pending[0].resolve({ text: 'old answer', words: [] }); await tick();
  assert.equal(f.calls.length, 2);
  f.pending[1].resolve({ text: '새 답변', words: [] }); await tick();
  const results = f.events.filter((event) => event.event === 'result' || event.event === 'partialresult');
  assert.equal(results.length, 1); assert.equal(results[0].recognizerId, 'b');
  assert.equal(results[0].result.text, '새 답변');
  await f.runtime.dispose();
});

test('decoder failures surface once and do not loop a queued final', async () => {
  const f = runtimeFixture({ delayed: true }); await f.send('load'); await f.send('create', { sampleRate: 16000 });
  await f.audio(pcm(8)); await f.send('retrieveFinalResult');
  f.pending[0].reject(new Error('wasm failed')); await tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.events.filter((event) => event.event === 'error').length, 1);
  assert.equal(f.events.filter((event) => event.final).length, 0);
  await f.runtime.dispose();
});

test('word scores preserve unknown coverage or token mismatches without rewriting the transcript', () => {
  const tokenizer = { decode(ids) { return ids.map((id) => ({ 1: ' 저는', 2: ' 차린', 3: ' 입니다' })[id] || '').join(''); } };
  assert.deepEqual(decoderWords(' 저는 차린 입니다', [1, 2, 3], [{ id: 1, p: .9 }, { id: 99, p: .99 }, { id: 3, p: .8 }], tokenizer), [
    { word: '저는', conf: .9 }, { word: '차린' }, { word: '입니다', conf: .8 },
  ]);
  assert.deepEqual(decoderWords(' 저는 차린', [1, 2], [], tokenizer), [{ word: '저는' }, { word: '차린' }]);
});

function modelFixture({ timeout = 45000 } = {}) {
  let worker, alarm;
  class Worker {
    messages = []; terminated = false;
    constructor(url, options) { worker = this; this.url = url; this.options = options; }
    postMessage(data, transfers) { this.messages.push({ data, transfers }); }
    terminate() { this.terminated = true; }
    send(data) { this.onmessage({ data }); }
  }
  const model = new WhisperModel({ Worker, inferenceTimeoutMs: timeout, timers: {
    setTimeout(callback) { alarm = callback; return 1; }, clearTimeout() { alarm = null; },
  } });
  return { model, get worker() { return worker; }, fireTimeout() { alarm?.(); } };
}

test('adapter preserves existing recognizer API and suppresses callbacks after remove/dispose', () => {
  const f = modelFixture(), result = [];
  assert.equal(f.worker.options.type, 'module'); assert.equal(f.model.ready, false);
  f.worker.send({ event: 'load', result: true }); assert.equal(f.model.ready, true);
  const r = new f.model.KaldiRecognizer(48000); r.setWords(true); r.on('result', (event) => result.push(event));
  assert.equal(f.worker.messages.at(-1).data.sampleRate, 48000);
  const port = {}; f.model.connectAudioPort(port); assert.deepEqual(f.worker.messages.at(-1).transfers, [port]);
  f.worker.send({ event: 'result', recognizerId: r.id, result: { text: '답변' }, final: true });
  assert.equal(result.length, 1);
  r.remove(); f.worker.send({ event: 'result', recognizerId: r.id, result: { text: 'old' }, final: true });
  assert.equal(result.length, 1);
  f.model.dispose(); f.worker.send({ event: 'load', result: true });
  assert.equal(f.model.ready, false); assert.equal(f.worker.terminated, true);
});

test('a worker inference timeout terminates it and returns an error instead of hanging capture', () => {
  const f = modelFixture(), errors = []; f.model.on('error', (event) => errors.push(event.error));
  f.worker.send({ event: 'load', result: true }); f.worker.send({ event: 'inference-start' }); f.fireTimeout();
  assert.equal(f.worker.terminated, true); assert.equal(f.model.ready, false);
  assert.match(errors[0], /timeout/);
  f.worker.send({ event: 'load', result: true }); f.worker.onerror({ message: 'late error' });
  assert.equal(f.model.ready, false); assert.equal(errors.length, 1, 'late worker messages cannot revive a failed model');
  f.model.dispose();
});

test('worker URLs cannot point to another origin', () => {
  assert.throws(() => new WhisperModel({ workerUrl: 'https://outside.example/worker.mjs' }), /same-origin/);
});
