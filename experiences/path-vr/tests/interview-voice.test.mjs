import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createVoiceInput, mergeVoiceResults, voiceError } from '../interview/voice.mjs';

function fixturePlatform({ deny = false, noLoad = false, delayedPermission = false } = {}) {
  let recognizer;
  let node;
  let context;
  let grant;
  const track = { stopped: false, stop() { this.stopped = true; }, addEventListener() {} };
  class Recognizer {
    id = 'test-recognizer';
    events = new Map();
    constructor() { recognizer = this; }
    setWords() {}
    on(name, callback) { this.events.set(name, callback); }
    remove() { this.removed = true; }
    result(text, final = false) { this.events.get('result')({ result: { text }, final }); }
    rawResult(result, final = false) { this.events.get('result')({ result, final }); }
  }
  const events = new Map();
  const model = { ready: false, KaldiRecognizer: Recognizer, on(name, callback) { events.set(name, callback); }, connectAudioPort() {}, dispose() { this.ready = false; this.disposed = true; } };
  class Context {
    state = 'suspended';
    sampleRate = 16000;
    destination = {};
    audioWorklet = { async addModule() {} };
    constructor() { context = this; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createGain() { return { gain: {}, connect() { return this; }, disconnect() {} }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  }
  class Worklet {
    messages = [];
    port = { postMessage: (message) => this.messages.push(message), close() {} };
    constructor() { node = this; }
    connect(next) { return next; }
    disconnect() {}
  }
  return {
    platform: { Worker: class {}, WebAssembly, isSecureContext: true, AudioContext: Context, AudioWorkletNode: Worklet,
      MessageChannel: class { port1 = {}; port2 = {}; },
      navigator: { mediaDevices: { getUserMedia: async () => {
        if (deny) throw new DOMException('denied', 'NotAllowedError');
        if (delayedPermission) return new Promise((resolve) => { grant = resolve; });
        return { getTracks: () => [track] };
      } } },
    },
    async modelFactory() {
      if (!noLoad) setTimeout(() => { model.ready = true; events.get('load')?.({ result: true }); }, 0);
      return model;
    },
    model, track, events,
    get node() { return node; }, get context() { return context; }, get recognizer() { return recognizer; },
    grant() { grant({ getTracks: () => [track] }); },
  };
}

test('AudioWorklet sends the final partial PCM block before the final request, with no audible output', async () => {
  let Processor;
  const hostMessages = [];
  const workerMessages = [];
  const sandbox = { Float32Array, Math, sampleRate: 16000,
    AudioWorkletProcessor: class { port = { postMessage: (message) => hostMessages.push(message) }; },
    registerProcessor: (_, implementation) => { Processor = implementation; },
  };
  vm.runInNewContext(await readFile(new URL('../interview/audio-worklet.js', import.meta.url), 'utf8'), sandbox);
  const processor = new Processor();
  processor.port.onmessage({ data: { type: 'connect', port: { postMessage: (message) => workerMessages.push(message) }, recognizerId: 'fixture' } });
  const output = new Float32Array(128);
  for (let block = 0; block < 17; block += 1) processor.process([[new Float32Array(128).fill(0.5), new Float32Array(128).fill(-0.25)]], [[output]]);
  processor.port.onmessage({ data: { type: 'flush' } });
  assert.deepEqual(workerMessages.map((message) => message.action), ['audioChunk', 'audioChunk', 'retrieveFinalResult']);
  assert.equal(workerMessages[0].data.length, 2048);
  assert.equal(workerMessages[1].data.length, 128);
  assert.equal(workerMessages[0].data[0], 4096);
  assert.equal(workerMessages[1].sampleRate, 16000);
  assert.ok(output.every((value) => value === 0));
  assert.ok(hostMessages.some((message) => message.type === 'level' && message.value > 0));
});

test('stop closes the microphone immediately but waits for explicit final recognition, preserving all segments', async () => {
  const environment = fixturePlatform();
  const results = [];
  const input = createVoiceInput({ ...environment, onResult: (result) => results.push(result.text), finalTimeoutMs: 200 });
  await input.start();
  environment.recognizer.result('안녕하세요');
  let resolved = false;
  const stopping = input.stop().then((result) => { resolved = true; return result; });
  assert.equal(environment.track.stopped, true);
  environment.recognizer.result('한국어를 공부합니다');
  await Promise.resolve();
  assert.equal(resolved, false, 'an ordinary endpoint must not acknowledge stop');
  environment.recognizer.result('감사합니다', true);
  assert.equal((await stopping).text, '안녕하세요 한국어를 공부합니다 감사합니다');
  assert.equal(environment.context.state, 'closed');
  assert.equal(environment.recognizer.removed, true);
  assert.equal(results.at(-1), '안녕하세요 한국어를 공부합니다 감사합니다');
  await input.dispose();
});

test('word metadata survives final flushing and confidence is weighted by words, not endpoint segments', async () => {
  const environment = fixturePlatform(), observed = [];
  const input = createVoiceInput({ ...environment, onResult: (result) => observed.push(result), finalTimeoutMs: 200 });
  await input.start();
  environment.recognizer.rawResult({ text: '경험', result: [{ word: '경험', conf: .2, start: 0, end: .3 }] });
  const stopping = input.stop();
  environment.recognizer.rawResult({ text: '이 없습니다 정말로', result: [
    { word: '이', conf: 1, start: .3, end: .4 },
    { word: '없습니다', conf: 1, start: .4, end: .9 },
    { word: '정말로', conf: 1, start: 1, end: 1.5 },
  ] }, true);
  const result = await stopping;
  assert.equal(result.text, '경험 이 없습니다 정말로');
  assert.equal(result.confidence, .8);
  assert.equal(result.confidenceCoverage, 1);
  assert.deepEqual(result.words[0], { word: '경험', conf: .2, start: 0, end: .3 });
  assert.deepEqual(result.words[2], { word: '없습니다', conf: 1, start: .4, end: .9 });
  assert.deepEqual(observed.at(-1), result);
  await input.dispose();
});

test('missing, invalid and text-only word scores stay unknown rather than borrowing an average', () => {
  const result = mergeVoiceResults([
    { text: '제가 식사를 도왔습니다', words: [
      { word: '제가', conf: .99, start: 0, end: .2 },
      { word: '식사를', start: .2, end: .5 },
      { word: '도왔습니다', conf: NaN, start: .5, end: 1 },
    ] },
    { text: '직접 했습니다', confidence: 1 },
    { text: '정말', words: [{ word: '정말', conf: 1.1 }] },
  ]);
  assert.equal(result.text, '제가 식사를 도왔습니다 직접 했습니다 정말');
  assert.equal(result.confidence, .99);
  assert.equal(result.confidenceCoverage, 1 / 6);
  assert.ok(result.words.slice(1).every((word) => !Object.hasOwn(word, 'conf')));
  assert.deepEqual(result.words[1], { word: '식사를', start: .2, end: .5 });
  assert.deepEqual(mergeVoiceResults(), { text: '', words: [], confidenceCoverage: 0 });
  assert.deepEqual(mergeVoiceResults([{ text: '모릅니다', confidence: .99 }]), {
    text: '모릅니다', words: [{ word: '모릅니다' }], confidenceCoverage: 0,
  });
});

test('pause/resume merging preserves every capture score and original word times without rewriting misrecognitions', () => {
  const prefix = mergeVoiceResults([{ text: '차린 한국어', words: [
    { word: '차린', conf: .99, start: 0, end: .4 }, { word: '한국어', conf: .9, start: .4, end: 1 },
  ] }]);
  const resumed = { text: '공부 합니다', words: [
    { word: '공부', conf: .5, start: 0, end: .3 }, { word: '합니다', start: .3, end: .7 },
  ] };
  const result = mergeVoiceResults([prefix, resumed]);
  assert.equal(result.text, '차린 한국어 공부 합니다', 'an apparent wrong word must never be silently replaced');
  assert.equal(result.confidence, (.99 + .9 + .5) / 3);
  assert.equal(result.confidenceCoverage, 3 / 4);
  assert.deepEqual(result.words[2], resumed.words[0], 'timestamps belong to the original capture');
  assert.deepEqual(result.words[3], resumed.words[1]);
  assert.deepEqual(mergeVoiceResults([{ ...prefix, text: '저는 한국어' }]).words, [
    { word: '저는' }, { word: '한국어' },
  ], 'edited text cannot inherit scores from a different recognized phrase');
});

test('microphone permission denial reports a recoverable status and closes AudioContext', async () => {
  const environment = fixturePlatform({ deny: true });
  const statuses = [];
  const input = createVoiceInput({ ...environment, onStatus: (status) => statuses.push(status) });
  await assert.rejects(input.start(), { name: 'NotAllowedError' });
  assert.equal(statuses.at(-1).code, 'microphone-denied');
  assert.equal(environment.context.state, 'closed');
  assert.equal(input.ready, true, 'the downloaded model can be reused after permission changes');
  await input.dispose();
});

test('stop during permission prompt closes a microphone that is granted later', async () => {
  const environment = fixturePlatform({ delayedPermission: true });
  const input = createVoiceInput(environment);
  const starting = input.start();
  const rejected = assert.rejects(starting, { name: 'AbortError' });
  while (!environment.context) await new Promise((resolve) => setTimeout(resolve, 1));
  await input.stop();
  environment.grant();
  await rejected;
  await Promise.resolve();
  assert.equal(environment.track.stopped, true);
  assert.equal(environment.context.state, 'closed');
  await input.dispose();
});

test('model load timeout destroys the worker and allows a retry', async () => {
  const environment = fixturePlatform({ noLoad: true });
  const input = createVoiceInput({ ...environment, prepareTimeoutMs: 10 });
  await assert.rejects(input.prepare(), /timeout/);
  assert.equal(environment.model.disposed, true);
  assert.equal(input.ready, false);
  await input.dispose();
});

test('final-result timeout closes capture and invalidates the unresponsive worker', async () => {
  const environment = fixturePlatform();
  const input = createVoiceInput({ ...environment, finalTimeoutMs: 10 });
  await input.start();
  await assert.rejects(input.stop(), /timeout/);
  assert.equal(environment.track.stopped, true);
  assert.equal(environment.context.state, 'closed');
  assert.equal(environment.model.disposed, true);
  assert.equal(input.ready, false);
  await input.dispose();
});

test('dispose cancels model initialization without waiting for its full timeout', async () => {
  const environment = fixturePlatform({ noLoad: true });
  const input = createVoiceInput({ ...environment, prepareTimeoutMs: 20_000 });
  const preparing = input.prepare();
  const rejected = assert.rejects(preparing, { name: 'AbortError' });
  await Promise.resolve();
  await input.dispose();
  await rejected;
  assert.equal(environment.model.disposed, true);
  assert.equal(input.ready, false);
});

test('stop during model preparation never opens a late microphone', async () => {
  const environment = fixturePlatform({ noLoad: true });
  const input = createVoiceInput(environment);
  const starting = input.start();
  const rejected = assert.rejects(starting, { name: 'AbortError' });
  await Promise.resolve();
  await input.stop();
  environment.model.ready = true;
  environment.events.get('load')({ result: true });
  await rejected;
  assert.equal(environment.context, undefined);
  await input.dispose();
});

test('memory failures have actionable Korean feedback', () => {
  assert.equal(voiceError(new Error('memory access out of bounds')).code, 'memory');
  assert.equal(voiceError(new Error('HTTP error! status: 404')).code, 'model-download');
});
