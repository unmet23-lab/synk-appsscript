'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const childProcess = require('node:child_process');
const { createResilientTranscriber } = require('./resilient-transcriber.cjs');

// Protocol fixtures only. These tests never run Python or any external API.
function fixtureConfiguration() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-reliability-'));
  for (const name of ['model.bin', 'tokenizer.json', 'config.json', 'vocabulary.txt']) fs.writeFileSync(path.join(dir, name), 'fixture');
  const configPath = path.join(dir, 'local.json');
  fs.writeFileSync(configPath, JSON.stringify({ python: process.execPath, modelPath: dir, modelId: 'protocol-fixture', modelFingerprint: 'fixture', files: [] }));
  return configPath;
}
function fakeWorker(onRequest) {
  const w = new EventEmitter();
  w.stdin = new PassThrough(); w.stdout = new PassThrough(); w.stderr = new PassThrough();
  let exited = false;
  w.kill = () => { if (!exited) { exited = true; queueMicrotask(() => { w.emit('exit', 0); w.emit('close', 0); }); } return true; };
  w.stdin.on('finish', () => w.kill());
  let buffer = '';
  w.stdin.on('data', chunk => { buffer += chunk; let end; while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (line) onRequest?.(JSON.parse(line), w);
  } });
  w.emitResult = data => w.stdout.write(JSON.stringify(data) + '\n');
  return w;
}
function localWithSpawn(t, spawn) {
  t.mock.method(childProcess, 'spawn', spawn);
  delete require.cache[require.resolve('./local-transcriber.cjs')];
  return require('./local-transcriber.cjs').createLocalTranscriber;
}

test('a spawn error without exit can be retried after the runtime is repaired', async t => {
  let launches = 0;
  const create = localWithSpawn(t, () => {
    const worker = fakeWorker(); launches++;
    if (launches === 1) queueMicrotask(() => { worker.emit('error', Object.assign(new Error('fixture'), { code: 'EACCES' })); worker.emit('close', -1); });
    else queueMicrotask(() => worker.emitResult({ type: 'ready', modelFiles: [], networkAttempts: 0 }));
    return worker;
  });
  const transcriber = create({ configPath: fixtureConfiguration(), timeoutMs: 100 });
  try {
    await assert.rejects(transcriber.warmup(), e => e.code === 'LOCAL_WORKER_START_FAILED');
    const retried = await transcriber.warmup();
    assert.equal(retried.loaded, true);
    assert.equal(launches, 2);
  } finally { await transcriber.close(); }
});

test('explicit Gemini selection never dispatches through the configured Vertex adapter', async () => {
  let cloudCalls = 0;
  const transcriber = createResilientTranscriber({ env: { SYNK_PATENT_STT_PROVIDER: 'vertex' },
    local: { status: async () => ({ available: false, provider: 'local' }), close: async () => {} },
    cloud: { status: async () => ({ available: true, provider: 'vertex' }), transcribe: async () => {
      cloudCalls++; return { text: 'fixture', provider: 'vertex', alternatives: [{ text: 'fixture' }], raw: {} };
    } } });
  await assert.rejects(transcriber.transcribe({ bytes: Buffer.from('fixture'), mimeType: 'audio/wav', provider: 'gemini' }), e => e.code === 'TRANSCRIBER_UNAVAILABLE');
  assert.equal(cloudCalls, 0);
});

test('concurrent local requests retain their own bytes even when replies arrive out of order', async t => {
  const create = localWithSpawn(t, () => {
    const requests = [], worker = fakeWorker((request, w) => {
      requests.push(request);
      if (requests.length === 2) for (const r of [...requests].reverse()) queueMicrotask(() => w.emitResult({ type: 'result', id: r.id,
        audioSha256: r.audioSha256, text: Buffer.from(r.audioBase64, 'base64').toString(), networkAttempts: 0 }));
    });
    queueMicrotask(() => worker.emitResult({ type: 'ready', modelFiles: [], networkAttempts: 0 }));
    return worker;
  });
  const transcriber = create({ configPath: fixtureConfiguration(), timeoutMs: 1000 });
  try {
    const results = await Promise.all(['first', 'second'].map(text => transcriber.transcribe({ bytes: Buffer.from(text), mimeType: 'audio/wav' })));
    assert.deepEqual(results.map(r => r.text), ['first', 'second']);
  } finally { await transcriber.close(); }
});

test('a timed-out worker is terminated and a later request can start a fresh worker', async t => {
  let launches = 0;
  const create = localWithSpawn(t, () => {
    launches++;
    const worker = fakeWorker(launches === 1 ? undefined : (r, w) => w.emitResult({ type: 'result', id: r.id,
      audioSha256: r.audioSha256, text: 'recovered', networkAttempts: 0 }));
    queueMicrotask(() => worker.emitResult({ type: 'ready', modelFiles: [], networkAttempts: 0 }));
    return worker;
  });
  const transcriber = create({ configPath: fixtureConfiguration(), timeoutMs: 40 });
  try {
    await assert.rejects(transcriber.transcribe({ bytes: Buffer.from('first') }), e => e.code === 'LOCAL_TRANSCRIPTION_TIMEOUT');
    await new Promise(resolve => setImmediate(resolve));
    const result = await transcriber.transcribe({ bytes: Buffer.from('retry') });
    assert.equal(result.text, 'recovered'); assert.equal(launches, 2);
  } finally { await transcriber.close(); }
});
