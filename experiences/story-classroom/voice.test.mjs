import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { StoryVoice } from './voice.mjs';
import { VOICE_LINES, VOICE_TEXT_VERSION } from './voice-lines.mjs';

const bytes = new Uint8Array([17, 31, 55, 89, 144, 233]).buffer;
const sha256 = value => createHash('sha256').update(new Uint8Array(value)).digest('hex');
const validManifest = () => ({
  textVersion: VOICE_TEXT_VERSION,
  lines: VOICE_LINES.map(line => ({ ...line, file: `assets/voice/${line.id}.mp3`, sha256: sha256(bytes) })),
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const responseFor = data => ({ ok: true, json: async () => data, arrayBuffer: async () => bytes.slice(0) });
const flush = () => new Promise(resolve => setImmediate(resolve));
async function until(condition) {
  for (let tries = 0; tries < 100; tries += 1) {
    if (condition()) return;
    await flush();
  }
  assert.fail('Expected asynchronous voice state did not occur');
}

function fixture({ manifest = validManifest(), fetchHook, decodeHook, startHook, contextState = 'running', throwSourceStart = false } = {}) {
  const started = [], statuses = [], calls = [], ducks = [];
  const context = {
    state: contextState, destination: {}, sources: [], started: [], active: new Set(), maxActive: 0, decoded: 0,
    async decodeAudioData(value) {
      this.decoded += 1;
      return decodeHook ? decodeHook(value, this) : { duration: 1, bytes: value };
    },
    createGain() {
      return { gain: { value: 0 }, connected: false, disconnected: false, connect() { this.connected = true; }, disconnect() { this.disconnected = true; } };
    },
    createBufferSource() {
      const source = {
        buffer: null, onended: null, started: false, stopped: false, disconnected: false,
        connect(gain) { this.gain = gain; },
        disconnect() { this.disconnected = true; },
        start() {
          if (throwSourceStart) throw new Error('Audio output unavailable');
          this.started = true;
          context.started.push(this);
          context.active.add(this);
          context.maxActive = Math.max(context.maxActive, context.active.size);
        },
        stop() { this.stopped = true; context.active.delete(this); this.onended?.(); },
        finish() { context.active.delete(this); this.onended?.(); },
      };
      context.sources.push(source);
      return source;
    },
  };
  const audio = {
    enabled: true, context, startCalls: 0,
    async start() {
      this.startCalls += 1;
      if (startHook) await startHook(this.startCalls, context);
      context.state = 'running';
    },
    duckVoice(value) { ducks.push(value); },
  };
  const fetcher = async url => {
    const path = new URL(url).pathname;
    calls.push(path);
    const kind = path.endsWith('manifest.json') ? 'manifest' : 'mp3';
    if (fetchHook) {
      const custom = fetchHook({ kind, path, calls });
      if (custom !== undefined) return custom;
    }
    return responseFor(kind === 'manifest' ? manifest : null);
  };
  const hash = { async digest(algorithm, value) {
    assert.equal(algorithm, 'SHA-256');
    const result = createHash('sha256').update(new Uint8Array(value)).digest();
    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
  } };
  const voice = new StoryVoice({
    audio, fetcher, hash,
    onStatus(status) { statuses.push(status); },
    onStarted(line) {
      assert.equal(context.active.size, 1, 'A semantic aid callback requires actual playback');
      assert.equal(context.started.at(-1).started, true);
      started.push(line);
    },
  });
  return { voice, audio, context, started, statuses, calls, ducks };
}

test('onStarted runs once after the actual source starts, never at fetch or decode time', async t => {
  const pendingDecode = deferred();
  const f = fixture({ decodeHook: () => pendingDecode.promise });
  t.after(() => f.voice.destroy());
  const speaking = f.voice.speak([VOICE_LINES[0]]);
  await until(() => f.context.decoded === 1);
  assert.equal(f.started.length, 0);
  assert.equal(f.context.started.length, 0);
  pendingDecode.resolve({ duration: 1 });
  await until(() => f.started.length === 1);
  assert.equal(f.voice.state, 'playing');
  assert.equal(f.voice.currentId, VOICE_LINES[0].id);
  f.context.started[0].finish();
  assert.equal(await speaking, true);
  assert.equal(f.voice.state, 'ready');
  assert.equal(f.ducks.at(-1), false);
});

test('wrong manifest versions, text, speakers, missing IDs, unsafe paths and invalid hashes block playback', async () => {
  const cases = [
    manifest => { manifest.textVersion = 'obsolete'; },
    manifest => { manifest.lines[0].text += ' changed'; },
    manifest => { manifest.lines[0].speaker = 'other'; },
    manifest => { manifest.lines.pop(); },
    manifest => { manifest.lines[0].id = manifest.lines[1].id; },
    manifest => { manifest.lines[0].file = '../private.mp3'; },
    manifest => { manifest.lines[0].file = 'https://external.example/voice.mp3'; },
    manifest => { manifest.lines[0].sha256 = 'invalid'; },
  ];
  for (const mutate of cases) {
    const manifest = validManifest();
    mutate(manifest);
    const f = fixture({ manifest });
    assert.equal(await f.voice.speak([VOICE_LINES[0]]), false);
    assert.equal(f.voice.state, 'error');
    assert.equal(f.context.started.length, 0);
    assert.equal(f.started.length, 0);
    assert.equal(f.calls.filter(path => path.endsWith('.mp3')).length, 0);
    assert.equal(f.voice.loading, null);
    f.voice.destroy();
  }
});

test('runtime text mismatching the verified voice ID is rejected without speaking a stale recording', async t => {
  const f = fixture();
  t.after(() => f.voice.destroy());
  assert.equal(await f.voice.speak([{ ...VOICE_LINES[0], text: '새 문장' }]), false);
  assert.equal(f.started.length, 0);
  assert.equal(f.context.decoded, 0);
  assert.equal(f.voice.state, 'error');
});

test('a corrupted MP3 is rejected before decoding and before the semantic aid callback', async t => {
  const manifest = validManifest();
  manifest.lines[0].sha256 = '0'.repeat(64);
  const f = fixture({ manifest });
  t.after(() => f.voice.destroy());
  assert.equal(await f.voice.speak([VOICE_LINES[0]]), false);
  assert.equal(f.context.decoded, 0);
  assert.equal(f.started.length, 0);
  assert.match(f.statuses.at(-1).message, /파일을 확인/);
});

test('failed decode or audio start does not mark an inaudible attempt as audio help', async () => {
  for (const options of [
    { decodeHook: async () => { throw new Error('Invalid audio bytes'); } },
    { throwSourceStart: true },
  ]) {
    const f = fixture(options);
    assert.equal(await f.voice.speak([VOICE_LINES[0]]), false);
    assert.equal(f.started.length, 0);
    assert.equal(f.context.active.size, 0);
    assert.equal(f.voice.state, 'error');
    f.voice.destroy();
  }
});

test('stopping while the manifest fetch is pending prevents the old scene voice from starting', async t => {
  const pending = deferred();
  const f = fixture({ fetchHook: ({ kind }) => kind === 'manifest' ? pending.promise : undefined });
  t.after(() => f.voice.destroy());
  const speaking = f.voice.speak([VOICE_LINES[0]]);
  await until(() => f.calls.length === 1);
  f.voice.stop();
  pending.resolve(responseFor(validManifest()));
  assert.equal(await speaking, false);
  assert.equal(f.started.length, 0);
  assert.equal(f.context.started.length, 0);
  assert.equal(f.voice.state, 'idle');
});

test('a pending old MP3 cannot replace a newer scene voice or overlap it', async t => {
  const pending = deferred();
  const first = VOICE_LINES[0], second = VOICE_LINES[1];
  const f = fixture({ fetchHook: ({ kind, path }) => kind === 'mp3' && path.endsWith(`${first.id}.mp3`) ? pending.promise : undefined });
  t.after(() => f.voice.destroy());
  const old = f.voice.speak([first]);
  await until(() => f.calls.some(path => path.endsWith(`${first.id}.mp3`)));
  const current = f.voice.speak([second]);
  await until(() => f.started.length === 1);
  pending.resolve(responseFor(null));
  assert.equal(await old, false);
  assert.deepEqual(f.started.map(line => line.id), [second.id]);
  assert.equal(f.voice.currentId, second.id);
  assert.equal(f.voice.state, 'playing');
  assert.equal(f.context.maxActive, 1);
  f.context.started[0].finish();
  assert.equal(await current, true);
});

test('a pending old audio-context resume cannot overwrite a newer voice status', async t => {
  const pending = deferred();
  const f = fixture({ contextState: 'suspended', startHook: count => count === 1 ? pending.promise : undefined });
  t.after(() => f.voice.destroy());
  const old = f.voice.speak([VOICE_LINES[0]]);
  await until(() => f.audio.startCalls === 1);
  const current = f.voice.speak([VOICE_LINES[1]]);
  await until(() => f.started.length === 1);
  assert.equal(f.voice.state, 'playing');
  pending.resolve();
  assert.equal(await old, false);
  assert.equal(f.voice.state, 'playing');
  assert.equal(f.voice.currentId, VOICE_LINES[1].id);
  f.context.started[0].finish();
  assert.equal(await current, true);
});

test('stop settles an active voice promise promptly as cancelled and releases the output', async t => {
  const f = fixture();
  t.after(() => f.voice.destroy());
  const speaking = f.voice.speak([VOICE_LINES[0]]);
  await until(() => f.started.length === 1);
  const source = f.context.started[0];
  f.voice.stop();
  assert.equal(await speaking, false);
  assert.equal(source.stopped, true);
  assert.equal(source.disconnected, true);
  assert.equal(source.gain.disconnected, true);
  assert.equal(f.context.active.size, 0);
  assert.equal(f.voice.source, null);
  assert.equal(f.voice.state, 'idle');
  assert.equal(f.ducks.at(-1), false);
});

test('a queue starts each sentence only after the preceding recording ends', async t => {
  const f = fixture();
  t.after(() => f.voice.destroy());
  const queue = VOICE_LINES.slice(0, 3);
  const speaking = f.voice.speak(queue);
  for (let index = 0; index < queue.length; index += 1) {
    await until(() => f.started.length === index + 1);
    assert.equal(f.context.active.size, 1);
    assert.equal(f.context.started.length, index + 1);
    assert.equal(f.started[index].id, queue[index].id);
    await flush();
    assert.equal(f.context.started.length, index + 1);
    f.context.started[index].finish();
  }
  assert.equal(await speaking, true);
  assert.equal(f.context.active.size, 0);
  assert.equal(f.context.maxActive, 1);
});

test('automatic-off requires explicit replay; replay uses the verified decoded recording cache', async t => {
  const f = fixture();
  t.after(() => f.voice.destroy());
  f.voice.automatic = false;
  assert.equal(await f.voice.speak([VOICE_LINES[0]]), false);
  assert.equal(f.calls.length, 0);
  const first = f.voice.speak([VOICE_LINES[0]], { manual: true });
  await until(() => f.started.length === 1);
  f.context.started[0].finish();
  assert.equal(await first, true);
  const beforeReplay = f.calls.length;
  const replay = f.voice.speak([VOICE_LINES[0]], { manual: true });
  await until(() => f.started.length === 2);
  assert.equal(f.calls.length, beforeReplay);
  assert.equal(f.context.decoded, 1);
  f.context.started[1].finish();
  assert.equal(await replay, true);
});

test('mute and reading-only block both automatic speech and manual replay', async () => {
  for (const mode of ['muted', 'reading']) {
    const f = fixture({ contextState: 'suspended' });
    if (mode === 'muted') f.audio.enabled = false;
    else f.voice.readingOnly = true;
    assert.equal(await f.voice.speak([VOICE_LINES[0]]), false);
    assert.equal(await f.voice.speak([VOICE_LINES[0]], { manual: true }), false);
    assert.equal(f.voice.state, mode);
    assert.equal(f.started.length, 0);
    assert.equal(f.calls.length, 0);
    assert.equal(f.audio.startCalls, 0);
    f.voice.destroy();
  }
});

test('explicit mute/reading stop cancels an active queue and does not play its remaining sentences', async t => {
  const f = fixture();
  t.after(() => f.voice.destroy());
  const speaking = f.voice.speak(VOICE_LINES.slice(0, 3));
  await until(() => f.started.length === 1);
  f.voice.readingOnly = true;
  f.voice.stop();
  assert.equal(await speaking, false);
  assert.equal(f.started.length, 1);
  assert.equal(f.context.active.size, 0);
  assert.equal(await f.voice.speak([VOICE_LINES[1]], { manual: true }), false);
  assert.equal(f.voice.state, 'reading');
});

test('missing voice and missing manifest failures can be retried without false aid callbacks', async () => {
  for (const missing of ['manifest', 'mp3']) {
    let attempts = 0;
    const f = fixture({ fetchHook: ({ kind }) => {
      if (kind === missing && attempts++ === 0) return { ok: false };
      return undefined;
    } });
    assert.equal(await f.voice.speak([VOICE_LINES[0]], { manual: true }), false);
    assert.equal(f.started.length, 0);
    assert.equal(f.voice.state, 'error');
    const retry = f.voice.speak([VOICE_LINES[0]], { manual: true });
    await until(() => f.started.length === 1);
    f.context.started[0].finish();
    assert.equal(await retry, true);
    assert.equal(f.started.length, 1);
    f.voice.destroy();
  }
});
