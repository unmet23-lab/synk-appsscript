import test from 'node:test';
import assert from 'node:assert/strict';
import { WhisperModel } from '../interview/whisper-model.mjs';
import { createPcmBuffer, createWhisperWorkerRuntime, decoderWords, loadWhisperBackend, OUTPUT_RATE, whisperModelBases } from '../interview/whisper-worker.mjs';

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

const LOCAL_MODELS = new URL('../models/', new URL('../interview/whisper-worker.mjs', import.meta.url)).href;
const BUCKET_MODELS = 'https://storage.googleapis.com/synk-path-media/path/v2/models/83ac9cfcb9b70af3/';

const PROBE = BUCKET_MODELS + 'whisper-base/generation_config.json';
const HOSTED = { schemaVersion: 1, model: { base: BUCKET_MODELS } };
// media-hosting.json answers with `body`; the bucket check (HEAD) answers with `head` (a response, an Error, or a function).
function hostingFetch(body, { ok = true, head = { ok: true, status: 200 }, calls = [] } = {}) {
  return async (url, init = {}) => {
    calls.push(`${init.method || 'GET'} ${url}`);
    if (/\/interview\/media-hosting\.json$/.test(url)) { assert.equal(init.cache, 'no-store'); return { ok, json: async () => body }; }
    assert.equal(url, PROBE);
    assert.deepEqual([init.method, init.credentials, init.cache], ['HEAD', 'omit', 'no-store']);
    if (head instanceof Error) throw head;
    return typeof head === 'function' ? head() : head;
  };
}
const fakeTimers = () => { const pending = new Map(); let next = 0; return { pending, setTimeout(callback) { pending.set(++next, callback); return next; }, clearTimeout(id) { pending.delete(id); }, fire() { for (const [id, callback] of [...pending]) { pending.delete(id); callback(); } } }; };
const cacheWith = (urls) => ({ async open(name) { assert.equal(name, 'transformers-cache'); return { async match(url) { return urls.includes(url) ? { ok: true } : undefined; } }; } });

test('the public build tries the bucket copy of the model first and always keeps this origin behind it', async () => {
  const calls = [];
  assert.deepEqual(await whisperModelBases({ fetchImpl: hostingFetch(HOSTED, { calls }), cacheStorage: cacheWith([]) }), [BUCKET_MODELS, LOCAL_MODELS]);
  assert.deepEqual(calls, ['GET ' + new URL('../interview/media-hosting.json', import.meta.url).href, 'HEAD ' + PROBE]);
  for (const [name, fetchImpl] of [
    ['local build (model: null)', hostingFetch({ schemaVersion: 1, model: null })],
    ['missing hosting file', hostingFetch({}, { ok: false })],
    ['network failure', async () => { throw new TypeError('Failed to fetch'); }],
    ['broken json', async () => ({ ok: true, json: async () => { throw new SyntaxError('bad json'); } })],
    ['another bucket', hostingFetch({ model: { base: 'https://storage.googleapis.com/another-bucket/path/models/83ac9cfcb9b70af3/' } })],
    ['another host', hostingFetch({ model: { base: 'https://outside.example/synk-path-media/path/models/83ac9cfcb9b70af3/' } })],
    ['retired bucket', hostingFetch({ model: { base: 'https://storage.googleapis.com/synk-public-media/path/models/83ac9cfcb9b70af3/' } })],
    ['not a revision folder', hostingFetch({ model: { base: 'https://storage.googleapis.com/synk-path-media/path/v2/models/' } })],
    // The first upload (public cache) stays readable from Google's edge cache after the cap closes the bucket.
    ['pre-v2 public-cache folder', hostingFetch({ model: { base: 'https://storage.googleapis.com/synk-path-media/path/models/83ac9cfcb9b70af3/' } })],
    ['query string', hostingFetch({ model: { base: BUCKET_MODELS + '?x=1' } })],
  ]) assert.deepEqual(await whisperModelBases({ fetchImpl, cacheStorage: cacheWith([]) }), [LOCAL_MODELS], name);
});

test('a closed, failing or silent model bucket sends a new visitor straight to this origin', async () => {
  for (const [name, head, expire] of [
    ['403 after the monthly cap', { ok: false, status: 403 }, false],
    ['missing optional file (404)', { ok: false, status: 404 }, false],
    ['CORS or network failure', new TypeError('Failed to fetch'), false],
    ['no answer before the timeout', () => new Promise(() => {}), true],
  ]) {
    const timers = fakeTimers();
    const pending = whisperModelBases({ fetchImpl: hostingFetch(HOSTED, { head }), cacheStorage: cacheWith([]), timers });
    if (expire) { for (let i = 0; i < 50 && !timers.pending.size; i++) await new Promise((resolve) => setImmediate(resolve)); assert.equal(timers.pending.size, 1, name); timers.fire(); }
    assert.deepEqual(await pending, [LOCAL_MODELS], name);
    assert.equal(timers.pending.size, 0, name);
  }
});

test('a browser that already keeps the bucket copy uses it without asking the bucket, even while it is closed', async () => {
  const calls = [];
  assert.deepEqual(await whisperModelBases({ fetchImpl: hostingFetch(HOSTED, { calls, head: { ok: false, status: 403 } }), cacheStorage: cacheWith([PROBE]) }), [BUCKET_MODELS, LOCAL_MODELS]);
  assert.equal(calls.filter((call) => call.startsWith('HEAD')).length, 0);
  // Cache Storage refused (private mode, storage policy): fall back to the HEAD check.
  const refused = { async open() { throw new DOMException('denied', 'SecurityError'); } };
  assert.deepEqual(await whisperModelBases({ fetchImpl: hostingFetch(HOSTED), cacheStorage: refused }), [BUCKET_MODELS, LOCAL_MODELS]);
  assert.deepEqual(await whisperModelBases({ fetchImpl: hostingFetch(HOSTED), cacheStorage: undefined }), [BUCKET_MODELS, LOCAL_MODELS]);
});

function fakeTransformers(failing) {
  const env = { backends: { onnx: { wasm: {} } } }, attempts = [];
  class LogitsProcessor {}
  class LogitsProcessorList extends Array {}
  const pipeline = async (task, model, options) => {
    attempts.push({ task, model, base: env.localModelPath, localOnly: options.local_files_only });
    if (failing.has(env.localModelPath)) throw new Error('Forbidden access to file: ' + env.localModelPath);
    return { dispose() {} };
  };
  return { transformers: { pipeline, env, LogitsProcessor, LogitsProcessorList }, attempts, env };
}

test('a worker loads one model folder: a bucket-copy failure is marked for a fresh worker, never retried in place', async () => {
  // After a failed session ONNX Runtime refuses every later session in the same worker (10-13 browser run:
  // the same-origin retry failed with the bucket attempt's "protobuf parsing failed").
  const closed = fakeTransformers(new Set([BUCKET_MODELS]));
  await assert.rejects(loadWhisperBackend(() => {}, { base: BUCKET_MODELS, transformers: closed.transformers }), (error) => error.hostedModel === true && /Forbidden access/.test(error.message));
  assert.deepEqual(closed.attempts.map((attempt) => attempt.base), [BUCKET_MODELS]);
  assert.ok(closed.attempts.every((attempt) => attempt.model === 'whisper-base' && attempt.localOnly === true));
  assert.equal(closed.env.allowRemoteModels, false, 'the model hub is never contacted');

  const local = fakeTransformers(new Set([BUCKET_MODELS]));
  const backend = await loadWhisperBackend(() => {}, { localOnly: true, transformers: local.transformers });
  assert.equal(typeof backend.decode, 'function');
  assert.equal(backend.hosted, false);
  assert.deepEqual(local.attempts.map((attempt) => attempt.base), [LOCAL_MODELS]);

  const open = fakeTransformers(new Set());
  assert.equal((await loadWhisperBackend(() => {}, { base: BUCKET_MODELS, transformers: open.transformers })).hosted, true);

  const broken = fakeTransformers(new Set([LOCAL_MODELS]));
  await assert.rejects(loadWhisperBackend(() => {}, { localOnly: true, transformers: broken.transformers }), (error) => !error.hostedModel && /Forbidden access/.test(error.message));
});

test('the worker runtime marks bucket-copy load failures for a retry (not warmup failures), and passes localOnly through', async () => {
  const runtime = (loadBackend) => { const events = []; return { events, runtime: createWhisperWorkerRuntime({ postMessage: (event) => events.push(event), loadBackend }) }; };
  let seen;
  const hostedLoad = runtime(async (progress, options) => { seen = options; throw Object.assign(new Error('Forbidden access to file'), { hostedModel: true }); });
  await hostedLoad.runtime.handle({ action: 'load' });
  assert.deepEqual(seen, { localOnly: false });
  assert.deepEqual(hostedLoad.events.at(-1), { event: 'error', error: 'Forbidden access to file', fallback: true });
  const hostedWarmup = runtime(async () => ({ hosted: true, async warmup() { throw new Error('bad generation config'); }, async dispose() {} }));
  await hostedWarmup.runtime.handle({ action: 'load' });
  // Same bytes as this site's copy (upload receipt): a retry would only download the model again before the same error.
  assert.deepEqual(hostedWarmup.events.at(-1), { event: 'error', error: 'bad generation config' });
  const localLoad = runtime(async (progress, options) => { seen = options; throw new Error('local copy broken'); });
  await localLoad.runtime.handle({ action: 'load', localOnly: true });
  assert.deepEqual(seen, { localOnly: true });
  assert.deepEqual(localLoad.events.at(-1), { event: 'error', error: 'local copy broken' });
});

test('a bucket-copy failure starts exactly one fresh worker for this site\'s copy, and the replaced worker is ignored', () => {
  const workers = [];
  class Worker {
    messages = []; terminated = false;
    constructor(url, options) { workers.push(this); this.url = url; this.options = options; }
    postMessage(data) { this.messages.push(data); }
    terminate() { this.terminated = true; }
    send(data) { this.onmessage({ data }); }
  }
  const errors = [], loads = [];
  const model = new WhisperModel({ Worker });
  model.on('error', (event) => errors.push(event.error)); model.on('load', (event) => loads.push(event));
  assert.deepEqual(workers[0].messages, [{ action: 'load' }]);
  workers[0].send({ event: 'error', error: 'Forbidden access to file', fallback: true });
  assert.equal(workers.length, 2); assert.equal(workers[0].terminated, true);
  assert.equal(workers[1].url, workers[0].url); assert.deepEqual(workers[1].options, workers[0].options);
  assert.deepEqual(workers[1].messages, [{ action: 'load', localOnly: true }]);
  assert.deepEqual(errors, [], 'the retry is not reported as a failure');
  workers[0].send({ event: 'load', result: true }); workers[0].onerror({ message: 'late' });
  assert.equal(model.ready, false, 'messages from the replaced worker are ignored'); assert.deepEqual(errors, []);
  workers[1].send({ event: 'load', result: true });
  assert.equal(model.ready, true); assert.equal(loads.length, 1);
  new model.KaldiRecognizer(16000);
  assert.equal(workers[1].messages.at(-1).action, 'create');
  model.dispose(); assert.equal(workers[1].terminated, true);

  for (const [name, first, second] of [
    ['this site\'s copy fails too', { event: 'error', error: 'Forbidden', fallback: true }, { event: 'error', error: 'local copy broken', fallback: true }],
    ['a failure that is not about the bucket copy', { event: 'error', error: 'wasm missing' }, null],
  ]) {
    workers.length = 0;
    const failing = new WhisperModel({ Worker }), failures = [];
    failing.on('error', (event) => failures.push(event.error));
    workers[0].send(first);
    if (second) workers[1].send(second);
    assert.equal(workers.length, second ? 2 : 1, name);
    assert.deepEqual(failures, [second ? 'local copy broken' : 'wasm missing'], name);
    assert.equal(workers.at(-1).terminated, true, name);
  }
});
