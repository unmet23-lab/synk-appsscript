import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFilmPlayer, evaluateFilmReadiness, resolveFilmClipUrl } from '../interview/film-player.mjs';

const tick = () => new Promise((resolve) => setTimeout(resolve, 2));
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); } assert.fail('condition did not become true'); }
function clip(id, kind = 'speaking') { return { id, status: 'ready', kind, src: `/assets/interview/film/${id}.mp4`, audio: kind === 'listening' ? 'silent' : 'native', reviewed: true, transition: { headHoldMs: 500, tailHoldMs: 800, validated: true } }; }
const goodManifest = () => ({ status: 'ready', source: { status: 'verified', provider: 'Seedance' }, projection: 'rectilinear-mono', stereo: false, clips: [clip('intro'), clip('question'), clip('followup'), clip('listen', 'listening')] });

function environment(options = {}) {
  const videos = [], states = [], ended = [];
  class Element extends EventTarget {
    style = {}; children = []; hidden = false; attributes = new Map();
    appendChild(element) { this.children.push(element); element.parent = this; return element; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); if (name === 'src') this.src = ''; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((element) => element !== this); }
  }
  class Video extends Element {
    src = ''; paused = true; muted = true; loop = false; preload = ''; readyState = 0; duration = NaN; videoWidth = 0; videoHeight = 0;
    calls = []; frames = new Map(); frameId = 0; mediaTime = 0; loadId = 0; autoData = options.autoData !== false; autoFrames = options.autoFrames !== false; deferred = []; deferNextPlay = false;
    get currentTime() { return this.mediaTime; }
    set currentTime(value) { this.mediaTime = value; if (this.autoFrames) queueMicrotask(() => this.renderFrame()); }
    load() {
      const token = ++this.loadId; this.readyState = 0; this.videoWidth = 0; this.videoHeight = 0; this.mediaTime = 0;
      if (!this.src) return;
      queueMicrotask(() => {
        if (token !== this.loadId) return;
        this.readyState = 1; this.duration = options.duration || 3; this.dispatchEvent(new Event('loadedmetadata'));
        if (this.autoData) this.data();
      });
    }
    data() { this.readyState = 2; this.videoWidth = 320; this.videoHeight = 180; this.dispatchEvent(new Event('loadeddata')); }
    play() {
      this.calls.push({ muted: this.muted, time: this.currentTime, src: this.src, opacity: this.style.opacity });
      if (this.failNextPlay) { this.failNextPlay = false; return Promise.reject(new DOMException('blocked', 'NotAllowedError')); }
      this.paused = false;
      if (this.autoFrames) queueMicrotask(() => this.renderFrame());
      if (this.deferNextPlay) { this.deferNextPlay = false; return new Promise((resolve) => this.deferred.push(() => { this.paused = false; resolve(); })); }
      return Promise.resolve();
    }
    pause() { this.paused = true; }
    requestVideoFrameCallback(callback) { const id = ++this.frameId; this.frames.set(id, callback); return id; }
    cancelVideoFrameCallback(id) { this.frames.delete(id); }
    renderFrame(mediaTime = this.mediaTime + (options.frameTimeOffset || 0)) { const callbacks = [...this.frames.values()]; this.frames.clear(); if (options.frameReadyState !== undefined) this.readyState = options.frameReadyState; for (const callback of callbacks) callback(performance.now(), { mediaTime, presentedFrames: 1, width: 320, height: 180 }); }
    end() { this.mediaTime = this.duration; this.paused = true; this.dispatchEvent(new Event('ended')); }
    errorNow() { this.dispatchEvent(new Event('error')); }
  }
  const document = { createElement(tag) { if (tag === 'video') { const video = new Video(); videos.push(video); return video; } return new Element(); } };
  const mount = new Element(); mount.ownerDocument = document;
  const manifest = options.manifest || goodManifest();
  const player = createFilmPlayer({ mount, manifest, prepareTimeoutMs: 80, startTimeoutMs: 80, stallTimeoutMs: options.stallTimeoutMs || 500, transitionMs: options.transitionMs || 0, onState: (event) => states.push(event), onEnded: (event) => ended.push(event) });
  return { player, videos, states, ended, mount, manifest, activeVideo: () => videos.find((video) => video.style.opacity === '1') };
}

test('only reviewed, verified same-origin mono video with validated silent transition handles is ready', () => {
  const manifest = goodManifest(); assert.deepEqual(evaluateFilmReadiness(manifest, ['intro']), { ready: true, missing: [], errors: [] });
  for (const mutate of [
    (m) => { m.stereo = true; }, (m) => { m.projection = 'stereo-vr180'; }, (m) => { m.source.status = 'missing'; },
    (m) => { m.clips[0].src = '/assets/reference.png'; }, (m) => { m.clips[0].src = 'https://remote.example/intro.mp4'; },
    (m) => { m.clips[0].src = 'data:video/mp4,not-a-real-film'; }, (m) => { m.clips[0].reviewed = 'yes'; },
    (m) => { m.clips[0].transition.validated = false; }, (m) => { m.clips[0].transition.headHoldMs = 0; },
    (m) => { m.clips[0].audio = 'tts'; }, (m) => { m.clips.push(m.clips[0]); },
  ]) { const invalid = structuredClone(manifest); mutate(invalid); assert.equal(evaluateFilmReadiness(invalid, ['intro']).ready, false); }
  assert.equal(evaluateFilmReadiness({ ...manifest, clips: [null] }).ready, false);
});

test('the actual ungenerated manifest is blocked, even though it has a reference still and plannedSrc', async () => {
  const manifest = JSON.parse(await readFile(new URL('../interview/film-manifest.json', import.meta.url), 'utf8'));
  const result = evaluateFilmReadiness(manifest, manifest.clips.map((item) => item.id));
  assert.equal(result.ready, false); assert.equal(result.missing.length, 16);
  const env = environment({ manifest });
  await assert.rejects(env.player.prepare(['intro']), { code: 'film-not-ready' });
  assert.equal(env.player.state, 'blocked'); assert.ok(env.videos.every((video) => !video.src && video.calls.length === 0));
  assert.ok(env.videos.every((video) => !video.attributes.has('poster'))); env.player.dispose();
});

test('metadata without decoded data times out instead of reporting ready', async () => {
  const env = environment({ autoData: false });
  await assert.rejects(env.player.prepare(['intro']), { code: 'prepare-timeout' });
  assert.equal(env.player.state, 'error'); assert.equal(env.videos[0].calls.length, 0); env.player.dispose();
});

test('loadeddata without a submitted video frame also times out', async () => {
  const env = environment({ autoFrames: false });
  await assert.rejects(env.player.prepare(['intro']), { code: 'prepare-timeout' });
  assert.equal(env.player.state, 'error'); assert.equal(env.videos[0].frames.size, 0); env.player.dispose();
});

test('preparation verifies requested actual frames with only two muted video elements', async () => {
  const env = environment(); const result = await env.player.prepare(['intro', 'question', 'followup']);
  assert.deepEqual(result.decoded, ['intro', 'question', 'followup']);
  assert.deepEqual(new Set(result.buffered), new Set(['intro', 'question']));
  assert.equal(env.videos.length, 2); assert.equal(env.player.state, 'ready'); assert.equal(env.player.current, null);
  assert.ok(env.videos.every((video) => video.muted && video.paused)); env.player.dispose();
});

test('preparation ignores a stale submitted frame after seeking and waits for the verified head', async () => {
  const env = environment({ autoFrames: false });
  const preparation = env.player.prepare(['intro']);
  // Attach a rejection handler immediately so a regression remains an assertion
  // failure instead of an unhandled asynchronous rejection.
  const outcome = preparation.then((value) => value, (error) => error);
  const video = env.videos[0];
  await until(() => !video.paused && video.frames.size > 0);
  video.mediaTime = 1.1; video.renderFrame();
  await until(() => video.paused && video.currentTime === 0 && video.frames.size > 0);
  video.renderFrame(1.1); await tick();
  assert.equal(env.player.state, 'preparing');
  assert.equal(video.style.opacity, '0'); assert.equal(video.muted, true);
  assert.equal(video.frames.size, 1, 'the stale callback is replaced while the seek finishes');
  video.renderFrame(0);
  assert.equal((await outcome).ready, true);
  assert.equal(env.player.state, 'ready');
  assert.equal(video.calls.length, 1, 'paused seeking must not silently play through native speech');
  assert.equal(video.frames.size, 0); env.player.dispose();
});

test('changing quality between sessions reloads sources in the same two video elements', async () => {
  const env = environment(), originalVideos = [...env.videos];
  await env.player.prepare(['intro', 'question']); await env.player.play('intro');
  const firstSource = env.activeVideo().src;
  env.player.stop();
  env.manifest.clips = env.manifest.clips.map((clip) => ({ ...clip, src: clip.src.replace('.mp4', '-720p.mp4') }));
  await env.player.prepare(['intro', 'question']); await env.player.play('intro');
  assert.notEqual(env.activeVideo().src, firstSource);
  assert.match(env.activeVideo().src, /intro-720p\.mp4$/);
  assert.deepEqual(env.videos, originalVideos); assert.equal(env.videos.length, 2);
  env.player.dispose();
});

test('only finite nonnegative listening offsets can trim the beginning; native dialogue cannot be skipped', async () => {
  const manifest = goodManifest(), listening = manifest.clips.find((item) => item.id === 'listen');
  listening.playbackStartSeconds = 0.75;
  assert.equal(evaluateFilmReadiness(manifest, ['listen']).ready, true);
  for (const value of [-1, Infinity, NaN, '0.75', null]) {
    listening.playbackStartSeconds = value;
    assert.equal(evaluateFilmReadiness(manifest, ['listen']).ready, false, String(value));
  }
  manifest.clips[0].playbackStartSeconds = 0.25;
  const env = environment({ manifest });
  await assert.rejects(env.player.play('intro'), { code: 'film-not-ready' });
  assert.ok(env.videos.every((video) => video.calls.length === 0));
  env.player.dispose();
});

test('listening begins at its decoded trim position while snapshots and pause/resume keep original timestamps', async () => {
  const manifest = goodManifest();
  Object.assign(manifest.clips.find((item) => item.id === 'listen'), { playbackStartSeconds: 0.75, fps: '24/1' });
  const env = environment({ manifest });
  await env.player.prepare(['listen']);
  const primed = env.videos.find((video) => video.src.endsWith('/listen.mp4'));
  assert.equal(primed.currentTime, 0.75);
  assert.equal(primed.paused, true);
  await env.player.play('listen', { loop: false });
  assert.equal(env.activeVideo().calls.at(-1).time, 0.75);
  assert.equal(env.player.current.time, 0.75);
  assert.equal(env.player.current.duration, 3);
  assert.equal(env.activeVideo().muted, true);
  env.activeVideo().mediaTime = 1.35;
  env.player.pause(); await env.player.resume();
  assert.equal(env.player.current.time, 1.35);
  assert.equal(env.videos.length, 2);
  env.player.dispose();
});

test('trimmed listening starts tolerate at most one source frame of seek rounding', async () => {
  const manifest = goodManifest();
  Object.assign(manifest.clips.find((item) => item.id === 'listen'), { playbackStartSeconds: 0.75, fps: '24/1' });
  const rounded = environment({ manifest, frameTimeOffset: -1 / 24 });
  await rounded.player.play('listen', { loop: false });
  assert.equal(rounded.player.current.time, 0.75);
  rounded.player.dispose();
  const stale = environment({ manifest, frameTimeOffset: -2 / 24 });
  await assert.rejects(stale.player.prepare(['listen']), { code: 'prepare-timeout' });
  assert.ok(stale.videos.every((video) => video.muted && video.paused && video.frames.size === 0));
  assert.equal(stale.player.current, null);
  stale.player.dispose();
});

test('a trim must leave room for both verified handles within the actual decoded duration', async () => {
  for (const offset of [1.7, 3, 4]) {
    const manifest = goodManifest();
    manifest.clips.find((item) => item.id === 'listen').playbackStartSeconds = offset;
    const env = environment({ manifest, duration: 3 });
    await assert.rejects(env.player.prepare(['listen']), { code: 'invalid-hold-duration' });
    assert.equal(env.player.current, null);
    env.player.dispose();
  }
});

test('queued trims and quality changes preserve the chosen starting pose with two decoders', async () => {
  const manifest = goodManifest();
  manifest.clips.find((item) => item.id === 'listen').playbackStartSeconds = 0.5;
  const env = environment({ manifest });
  await env.player.play('intro');
  await env.player.queue('listen', { loop: false });
  env.activeVideo().end();
  await until(() => env.player.current?.id === 'listen');
  assert.equal(env.player.current.time, 0.5);
  env.player.stop();
  env.manifest.clips = env.manifest.clips.map((item) => ({ ...item, src: item.src.replace('.mp4', '-720p.mp4') }));
  await env.player.prepare(['listen']); await env.player.play('listen', { loop: false });
  assert.match(env.activeVideo().src, /listen-720p\.mp4$/);
  assert.equal(env.player.current.time, 0.5);
  assert.equal(env.videos.length, 2);
  env.player.dispose();
});

test('a delayed listening play promise starts from the visible verified trim without replaying it', async () => {
  const manifest = goodManifest();
  manifest.clips.find((item) => item.id === 'listen').playbackStartSeconds = 0.75;
  const env = environment({ manifest });
  await env.player.prepare(['listen']);
  const video = env.videos.find((item) => item.src.endsWith('/listen.mp4'));
  video.deferNextPlay = true;
  const playback = env.player.play('listen', { loop: false });
  await until(() => video.deferred.length === 1);
  assert.equal(video.currentTime, 0.75);
  assert.equal(video.style.opacity, '1');
  assert.equal(env.player.getVideos().find((item) => item.video === video).opacity, 1);
  assert.deepEqual(video.calls.at(-1), { muted: true, time: 0.75, src: video.src, opacity: '1' });
  video.mediaTime = 1.4;
  video.deferred.shift()(); await playback;
  assert.equal(env.player.current.id, 'listen');
  assert.equal(env.player.current.time, 1.4, 'the visible performance must not jump back when play settles');
  assert.equal(video.calls.at(-1).time, 0.75);
  assert.equal(video.calls.length, 2, 'one muted preparation and one exposed start');
  assert.equal(env.states.filter((event) => event.state === 'playing').length, 1);
  assert.equal(env.videos.length, 2);
  assert.equal(video.muted, true);
  env.player.dispose();
});

test('an advanced cached listening clock requires fresh hidden decoding before exposure', async () => {
  const manifest = goodManifest();
  Object.assign(manifest.clips.find((item) => item.id === 'listen'), { playbackStartSeconds: 0.5, transition: { headHoldMs: 250, tailHoldMs: 350, validated: true } });
  const env = environment({ manifest });
  await env.player.prepare(['listen']);
  const video = env.videos.find((item) => item.src.endsWith('/listen.mp4'));
  const preparedLoad = video.loadId;
  video.mediaTime = 1.033606; video.autoFrames = false;
  const playback = env.player.play('listen', { loop: false });
  const outcome = playback.then((value) => value, (error) => error);
  await until(() => !video.paused && video.frames.size > 0);
  assert.ok(video.loadId > preparedLoad);
  assert.equal(video.muted, true);
  assert.equal(video.style.opacity, '0');
  video.renderFrame(1.033606);
  await until(() => video.paused && video.currentTime === 0.5 && video.frames.size > 0);
  video.renderFrame(1.033606); await tick();
  assert.equal(video.frames.size, 1);
  assert.equal(video.style.opacity, '0');
  video.renderFrame(0.5);
  assert.equal((await outcome).id, 'listen');
  assert.equal(video.calls.at(-1).time, 0.5);
  assert.equal(video.muted, true);
  assert.equal(video.paused, false);
  assert.equal(env.states.filter((event) => event.state === 'playing').length, 1);
  env.player.dispose();
});

test('a delayed new RVFC does not discard the already decoded paused head or delay exposure', async () => {
  const manifest = goodManifest();
  Object.assign(manifest.clips.find((item) => item.id === 'listen'), { playbackStartSeconds: 0.5, transition: { headHoldMs: 250, tailHoldMs: 350, validated: true } });
  const env = environment({ manifest });
  await env.player.prepare(['listen']);
  const video = env.videos.find((item) => item.src.endsWith('/listen.mp4'));
  video.autoFrames = false;
  await env.player.play('listen', { loop: false });
  assert.equal(env.player.current.id, 'listen');
  assert.equal(env.player.current.time, 0.5);
  assert.equal(video.calls.at(-1).time, 0.5);
  assert.equal(video.style.opacity, '1');
  assert.equal(video.muted, true);
  assert.equal(video.calls.length, 2, 'the paused decoded proof is consumed without another hidden play');
  video.mediaTime = 1.033606; video.renderFrame(); await tick();
  assert.equal(env.player.state, 'playing');
  assert.equal(env.states.filter((event) => event.state === 'playing').length, 1);
  assert.equal(env.states.filter((event) => event.state === 'error').length, 0);
  assert.equal(env.videos.length, 2);
  env.player.dispose();
});

test('stop during an exposed listening start closes it and a late promise cannot restart it', async () => {
  const manifest = goodManifest();
  manifest.clips.find((item) => item.id === 'listen').playbackStartSeconds = 0.5;
  const env = environment({ manifest });
  await env.player.prepare(['listen']);
  const video = env.videos.find((item) => item.src.endsWith('/listen.mp4'));
  video.deferNextPlay = true;
  const playback = env.player.play('listen', { loop: false }), cancelled = assert.rejects(playback, { name: 'AbortError' });
  await until(() => video.deferred.length === 1);
  assert.equal(video.style.opacity, '1');
  env.player.stop(); await cancelled; video.deferred.shift()(); video.renderFrame(); await tick();
  assert.equal(env.player.current, null); assert.equal(env.player.state, 'idle');
  assert.ok(env.videos.every((item) => item.muted && item.paused && item.frames.size === 0));
  assert.ok(env.player.getVideos().every((item) => item.opacity === 0));
  env.player.dispose();
});

test('dissolve retains an opaque outgoing frame until the new frame covers it and delays slot reuse', async () => {
  const env = environment({ transitionMs: 45 });
  await env.player.play('intro'); const outgoing = env.player.getVideos().find((item) => item.opacity === 1).video;
  const oldSource = outgoing.src;
  await env.player.play('listen');
  const drawing = env.player.getVideos();
  assert.equal(drawing[0].video, outgoing); assert.equal(drawing[0].opacity, 1);
  assert.ok(drawing[1].opacity >= 0 && drawing[1].opacity < 1);
  assert.equal(outgoing.src, oldSource, 'automatic loop must not replace the visible outgoing decoder immediately');
  await new Promise((resolve) => setTimeout(resolve, 55));
  assert.equal(env.player.getVideos().filter((item) => item.opacity === 1).length, 1);
  assert.notEqual(outgoing.src, oldSource, 'decoder can be reused after the dissolve');
  env.player.stop(); assert.ok(env.player.getVideos().every((item) => item.opacity === 0)); env.player.dispose();
});

test('a rejected exposed handoff restores the outgoing frame without committing a new owner', async () => {
  const env = environment({ transitionMs: 45 });
  await env.player.play('intro'); await env.player.queue('question');
  const outgoing = env.activeVideo(), owner = env.player.current.playbackId;
  const incoming = env.videos.find((video) => video !== outgoing);
  incoming.failNextPlay = true; outgoing.end();
  await until(() => env.player.state === 'error');
  assert.deepEqual(incoming.calls.at(-1), { muted: false, time: 0, src: incoming.src, opacity: '1' });
  assert.equal(env.player.current.playbackId, owner);
  assert.equal(env.player.current.id, 'intro');
  assert.equal(incoming.style.opacity, '0');
  assert.equal(env.player.getVideos().find((item) => item.video === outgoing).opacity, 1);
  assert.ok(env.videos.every((video) => video.paused && video.muted));
  env.player.dispose();
});

test('a never-settled handoff keeps the existing start timeout and restores the outgoing frame', async () => {
  const env = environment({ transitionMs: 45 });
  await env.player.play('intro'); await env.player.queue('question');
  const outgoing = env.activeVideo(), incoming = env.videos.find((video) => video !== outgoing);
  incoming.deferNextPlay = true; outgoing.end();
  assert.equal(incoming.deferred.length, 1);
  const drawing = env.player.getVideos();
  assert.equal(drawing[0].video, outgoing); assert.equal(drawing[0].opacity, 1);
  assert.equal(drawing[1].video, incoming); assert.ok(drawing[1].opacity >= 0);
  await until(() => env.player.state === 'error');
  assert.equal(env.states.at(-1).code, 'start-timeout');
  assert.equal(env.player.current.id, 'intro');
  assert.equal(env.player.getVideos().find((item) => item.video === outgoing).opacity, 1);
  incoming.deferred.shift()(); await tick();
  assert.equal(incoming.paused, true); assert.equal(incoming.muted, true);
  assert.equal(incoming.style.opacity, '0');
  env.player.dispose();
});

test('pause during an exposed handoff restores the outgoing frame and resumes through a freshly verified head', async () => {
  const env = environment({ transitionMs: 45 });
  await env.player.play('intro'); await env.player.queue('question');
  const outgoing = env.activeVideo(), incoming = env.videos.find((video) => video !== outgoing), firstLoad = incoming.loadId;
  incoming.deferNextPlay = true; outgoing.end();
  assert.equal(incoming.deferred.length, 1);
  incoming.mediaTime = 0.8; env.player.pause();
  assert.equal(env.player.state, 'paused');
  assert.equal(incoming.muted, true); assert.equal(incoming.paused, true); assert.equal(incoming.style.opacity, '0');
  assert.equal(env.player.getVideos().find((item) => item.video === outgoing).opacity, 1);
  await env.player.resume();
  await until(() => env.player.state === 'playing' && env.player.current?.id === 'question');
  assert.ok(incoming.loadId > firstLoad, 'an already exposed proof cannot be reused after cancellation');
  assert.equal(incoming.calls.at(-1).time, 0);
  incoming.deferred.shift()(); await tick();
  assert.equal(incoming.paused, false); assert.equal(incoming.muted, false);
  assert.equal(env.player.current.id, 'question');
  env.player.dispose();
});

test('an entire question consumed before start acknowledgement is an explicit failure, not a lost ended event', async () => {
  const env = environment(); await env.player.prepare(['intro']);
  const video = env.videos[0]; video.deferNextPlay = true;
  const playback = env.player.play('intro'), rejected = assert.rejects(playback, { code: 'start-timeout' });
  await until(() => video.deferred.length === 1);
  video.end();
  assert.equal(video.paused, true); assert.equal(video.muted, true);
  video.deferred.shift()(); await rejected;
  assert.equal(env.player.state, 'error'); assert.equal(env.player.current, null);
  assert.equal(env.ended.length, 0); assert.equal(video.style.opacity, '0');
  assert.ok(env.videos.every((item) => item.paused && item.muted));
  env.player.dispose();
});

test('speaking uses native audio; listening forces mute and uses managed, non-native looping', async () => {
  const env = environment(); await env.player.play('intro');
  assert.equal(env.activeVideo().muted, false); assert.equal(env.activeVideo().loop, false);
  await env.player.play('listen');
  assert.equal(env.activeVideo().muted, true); assert.equal(env.activeVideo().loop, false);
  assert.equal(env.player.current.loop, true); await assert.rejects(env.player.play('question', { loop: true }), { code: 'speaking-loop' });
  env.player.stop(); assert.equal(env.player.current, null); assert.ok(env.videos.every((video) => video.paused && !video.src)); env.player.dispose();
});

test('queued question waits for the listening loop boundary, then changes to native speech', async () => {
  const env = environment(); await env.player.play('listen'); await env.player.queue('question');
  assert.equal(env.player.current.id, 'listen'); const previous = env.activeVideo(); previous.end();
  await until(() => env.player.current?.id === 'question');
  assert.equal(env.activeVideo().muted, false); assert.equal(previous.paused, true);
  assert.equal(env.ended[0].id, 'listen'); assert.equal(env.ended[0].queuedId, 'question'); env.player.dispose();
});

test('a listening clip automatically repeats through the other decoded slot without losing ended boundaries', async () => {
  const env = environment(); await env.player.play('listen'); await until(() => env.states.some((event) => event.queued === 'listen'));
  const first = env.activeVideo(); first.end();
  await until(() => env.activeVideo() !== first && env.player.state === 'playing');
  assert.equal(env.player.current.id, 'listen'); assert.equal(env.activeVideo().muted, true); assert.equal(env.videos.length, 2); env.player.dispose();
});

test('each performance has its own owner ID while queue readiness and pause/resume preserve it', async () => {
  const env = environment();
  await env.player.play('listen', { loop: false });
  const owner = env.player.current.playbackId;
  await env.player.queue('intro');
  assert.equal(env.player.current.playbackId, owner);
  env.player.pause(); await env.player.resume();
  assert.equal(env.player.current.playbackId, owner);
  await until(() => env.states.at(-1)?.queued === 'intro');
  env.activeVideo().end();
  await until(() => env.player.current?.id === 'intro');
  assert.notEqual(env.player.current.playbackId, owner);
  env.player.dispose();
});

test('cancelling a ready successor leaves current actors moving and never changes clips at ended', async () => {
  const env = environment();
  await env.player.play('listen', { loop: false });
  const active = env.activeVideo(), owner = env.player.current.playbackId;
  active.currentTime = 1;
  await env.player.queue('question');
  env.player.cancelQueued();
  assert.equal(active.paused, false);
  assert.equal(active.currentTime, 1);
  assert.equal(env.player.current.playbackId, owner);
  active.end(); await tick();
  assert.equal(env.player.current.id, 'listen');
  assert.equal(env.player.state, 'ended');
  assert.equal(env.ended.at(-1).queuedId, null);
  assert.ok(env.videos.every((video) => video.muted));
  env.player.dispose();
});

test('cancelling a pending decoder or a paused successor cannot revive it later', async () => {
  const env = environment();
  await env.player.play('listen', { loop: false });
  const active = env.activeVideo(), other = env.videos.find((video) => video !== active);
  other.autoData = false;
  const queue = env.player.queue('question');
  env.player.cancelQueued();
  await assert.rejects(queue, { name: 'AbortError' });
  other.data(); await tick();
  assert.equal(active.paused, false);
  other.autoData = true;
  await env.player.queue('intro');
  env.player.pause(); env.player.cancelQueued(); await env.player.resume();
  active.end(); await tick();
  assert.equal(env.player.current.id, 'listen');
  assert.equal(env.ended.at(-1).queuedId, null);
  assert.equal(env.videos.length, 2);
  env.player.dispose();
});

test('recognition repair can immediately requeue after cancelling a delayed handoff', async () => {
  const env = environment();
  await env.player.play('listen', { loop: false });
  await env.player.queue('question');
  const outgoing = env.activeVideo(), successor = env.videos.find((video) => video !== outgoing);
  successor.deferNextPlay = true;
  outgoing.end();
  assert.equal(successor.deferred.length, 1, 'successor is waiting for play() at the clip boundary');
  env.player.cancelQueued();
  await new Promise((resolve, reject) => queueMicrotask(() => env.player.queue('followup').then(resolve, reject)));
  await until(() => env.player.current?.id === 'followup');
  successor.deferred.shift()(); await tick();
  assert.equal(env.player.current.id, 'followup');
  assert.equal(env.activeVideo().paused, false);
  assert.equal(env.player.state, 'playing');
  assert.equal(env.videos.length, 2);
  env.player.dispose();
});

test('repair requeue of the same trimmed clip does not reuse a consumed priming proof', async () => {
  const manifest = goodManifest();
  Object.assign(manifest.clips.find((item) => item.id === 'listen'), { playbackStartSeconds: 0.5, fps: '24/1' });
  const env = environment({ manifest });
  await env.player.play('intro'); await env.player.queue('listen', { loop: false });
  const outgoing = env.activeVideo(), successor = env.videos.find((video) => video !== outgoing), preparedLoad = successor.loadId;
  successor.deferNextPlay = true; outgoing.end();
  await until(() => successor.deferred.length === 1);
  successor.mediaTime = 1.3;
  env.player.cancelQueued();
  await new Promise((resolve, reject) => queueMicrotask(() => env.player.queue('listen', { loop: false }).then(resolve, reject)));
  await until(() => env.player.current?.id === 'listen' || env.player.state === 'error');
  assert.equal(env.player.state, 'playing');
  assert.equal(env.player.current.time, 0.5);
  assert.ok(successor.loadId > preparedLoad, 'the cancelled start consumed its preparation and must be decoded again');
  successor.deferred.shift()(); await tick();
  assert.equal(env.player.current.id, 'listen'); assert.equal(env.activeVideo().paused, false);
  env.player.dispose();
});

test('late decoding of a replaced queue cannot win over the newest queued clip', async () => {
  const env = environment(); await env.player.play('intro'); const spare = env.videos.find((video) => video !== env.activeVideo());
  spare.autoData = false;
  const stale = env.player.queue('question'); const cancelled = assert.rejects(stale, { name: 'AbortError' });
  await tick(); spare.autoData = true; await env.player.queue('followup'); await cancelled;
  spare.renderFrame(); env.activeVideo().end(); await until(() => env.player.current?.id === 'followup');
  assert.equal(env.player.current.id, 'followup'); env.player.dispose();
});

test('an ended clip remains visible while the next decoder is loading', async () => {
  const env = environment(); await env.player.play('intro'); const old = env.activeVideo(), spare = env.videos.find((video) => video !== old);
  spare.autoData = false; const queued = env.player.queue('question'); await tick(); old.end();
  assert.equal(env.player.state, 'waiting'); assert.equal(old.style.opacity, '1'); assert.equal(spare.style.opacity, '0');
  spare.data(); await queued; await until(() => env.player.current?.id === 'question'); env.player.dispose();
});

test('stop cancels a pending play and suppresses a late play promise without resuming media', async () => {
  const env = environment(); env.videos[0].deferNextPlay = true;
  const playback = env.player.play('intro'); const cancelled = assert.rejects(playback, { name: 'AbortError' });
  await until(() => env.videos[0].deferred.length === 1); env.player.stop(); await cancelled;
  env.videos[0].deferred.shift()(); await tick();
  assert.equal(env.player.state, 'idle'); assert.equal(env.player.current, null); assert.ok(env.videos.every((video) => video.paused)); env.player.dispose();
});

test('a restarted native question is exposed and audible from its exact paused start before a delayed response', async () => {
  const manifest = goodManifest(); manifest.clips[0].transition.headHoldMs = 250;
  const env = environment({ manifest });
  try {
    await env.player.play('intro'); env.activeVideo().end(); env.player.stop();
    await env.player.prepare(['intro']);
    const video = env.videos.find((item) => item.src.endsWith('/intro.mp4'));
    video.autoFrames = false; video.deferNextPlay = true;
    const outcome = env.player.play('intro').then((value) => value, (error) => error);
    await until(() => video.deferred.length === 1);
    assert.equal(video.currentTime, 0);
    assert.equal(video.muted, false); assert.equal(video.style.opacity, '1');
    assert.deepEqual(video.calls.at(-1), { muted: false, time: 0, src: video.src, opacity: '1' });
    assert.equal(env.player.getVideos().find((item) => item.video === video).opacity, 1);
    video.mediaTime = 0.253471; video.deferred.shift()();
    assert.equal((await outcome).id, 'intro');
    assert.equal(env.player.current.time, 0.253471, 'the already exposed native dialogue is not restarted');
    assert.equal(video.muted, false); assert.equal(video.style.opacity, '1');
    assert.equal(env.states.filter((event) => event.state === 'error').length, 0);
  } finally { env.player.dispose(); }
});

test('native audio never waits for a late play promise to unmute after speech has begun', async () => {
  const env = environment(); await env.player.prepare(['intro']);
  const video = env.videos.find((item) => item.src.endsWith('/intro.mp4'));
  video.deferNextPlay = true;
  const playback = env.player.play('intro');
  await until(() => video.deferred.length === 1);
  // Audio is enabled at time zero with an already decoded, visible head.
  // A late promise therefore cannot truncate the first spoken syllable.
  assert.equal(video.currentTime, 0); assert.equal(video.frames.size, 0);
  assert.equal(video.muted, false); assert.equal(video.style.opacity, '1');
  assert.equal(video.calls.at(-1).time, 0); assert.equal(video.calls.at(-1).muted, false);
  video.mediaTime = .65;
  video.deferred.shift()(); await playback;
  assert.equal(env.player.state, 'playing'); assert.equal(env.player.current.time, .65);
  assert.equal(video.calls.length, 2, 'the hidden preparation is followed by exactly one exposed start');
  assert.equal(video.muted, false); assert.equal(video.paused, false);
  env.player.dispose();
});

test('cancelling a native pending start mutes it immediately and cannot pause a newer question', async () => {
  const env = environment();
  try {
    await env.player.prepare(['intro']);
    const video = env.videos[0]; video.autoFrames = false; video.deferNextPlay = true;
    const playback = env.player.play('intro'), cancelled = assert.rejects(playback, { name: 'AbortError' });
    await until(() => video.deferred.length === 1);
    assert.equal(video.muted, false); assert.equal(video.style.opacity, '1');
    env.player.stop(); await cancelled;
    assert.equal(video.muted, true); assert.equal(video.paused, true); assert.equal(video.style.opacity, '0');
    video.autoFrames = true; await env.player.play('question');
    video.deferred.shift()(); video.renderFrame(.65); await tick();
    assert.equal(env.player.current.id, 'question');
    assert.equal(env.activeVideo().muted, false); assert.equal(env.activeVideo().paused, false);
  } finally { env.player.dispose(); }
});

test('a cancelled old play promise does not pause a newer film that reused the same element', async () => {
  const env = environment(); env.videos[0].deferNextPlay = true;
  const old = env.player.play('intro'); const cancelled = assert.rejects(old, { name: 'AbortError' });
  await until(() => env.videos[0].deferred.length === 1); await env.player.play('question'); await cancelled;
  env.videos[0].deferred.shift()(); await tick();
  assert.equal(env.player.current.id, 'question'); assert.equal(env.activeVideo().paused, false); env.player.dispose();
});

test('a cancelled resume cannot pause a newer resume of the same source and decoder version', async () => {
  const env = environment(); await env.player.play('intro');
  const video = env.activeVideo(), loadId = video.loadId, playbackId = env.player.current.playbackId;
  video.mediaTime = 0.9; env.player.pause(); video.deferNextPlay = true;
  const oldResume = env.player.resume(), cancelled = assert.rejects(oldResume, { name: 'AbortError' });
  await until(() => video.deferred.length === 1);
  env.player.pause(); await cancelled; await env.player.resume();
  assert.equal(video.paused, false);
  video.deferred.shift()(); await tick();
  assert.equal(env.player.state, 'playing');
  assert.equal(video.paused, false);
  assert.equal(video.muted, false);
  assert.equal(video.loadId, loadId, 'both resumes retain the same decoded source');
  assert.equal(env.player.current.playbackId, playbackId);
  assert.equal(env.player.current.time, 0.9);
  env.player.dispose();
});

test('a cancelled resume with no newer request cannot revive its paused source', async () => {
  const env = environment(); await env.player.play('intro');
  const video = env.activeVideo(); env.player.pause(); video.deferNextPlay = true;
  const resume = env.player.resume(), cancelled = assert.rejects(resume, { name: 'AbortError' });
  await until(() => video.deferred.length === 1);
  env.player.pause(); await cancelled;
  video.deferred.shift()(); await tick();
  assert.equal(env.player.state, 'paused');
  assert.equal(video.paused, true); assert.equal(video.muted, true);
  env.player.dispose();
});

test('pause/resume retains the current timestamp and re-establishes the queued boundary', async () => {
  const env = environment(); await env.player.play('intro'); await env.player.queue('question');
  const video = env.activeVideo(); video.mediaTime = 0.9; env.player.pause();
  assert.equal(env.player.state, 'paused'); assert.ok(env.videos.every((item) => item.paused && item.muted));
  await env.player.resume(); assert.equal(video.currentTime, 0.9); assert.equal(video.muted, false);
  video.end(); await until(() => env.player.current?.id === 'question'); env.player.dispose();
});

test('pause during preparation cancels work without a late hidden playback', async () => {
  const env = environment({ autoData: false }); const pending = env.player.play('intro');
  const cancelled = assert.rejects(pending, { name: 'AbortError' }); await tick(); env.player.pause(); await cancelled;
  env.videos[0].data(); await tick(); assert.ok(env.videos.every((video) => video.paused)); assert.equal(env.player.state, 'paused'); env.player.dispose();
});

test('media errors and rejected play requests are explicit failures and close pending frame callbacks', async () => {
  const env = environment({ autoData: false }); const pending = env.player.prepare(['intro']); const rejected = assert.rejects(pending, { code: 'media-error' });
  await tick(); env.videos[0].errorNow(); await rejected; assert.equal(env.player.state, 'error'); env.player.dispose();
  const denied = environment(); denied.videos[0].failNextPlay = true;
  await assert.rejects(denied.player.play('intro'), { name: 'NotAllowedError' });
  assert.ok(denied.videos.every((video) => video.frames.size === 0 && video.paused)); denied.player.dispose();
});

test('a playback stall has a finite watchdog and does not pretend the frozen frame is playing', async () => {
  const env = environment({ stallTimeoutMs: 15 }); await env.player.play('intro');
  await until(() => env.player.state === 'error');
  assert.equal(env.states.at(-1).code, 'stall-timeout'); assert.ok(env.videos.every((video) => video.paused)); env.player.dispose();
});

test('neutral handles longer than the real media duration are rejected after decoding metadata', async () => {
  const env = environment({ duration: 0.8 }); await assert.rejects(env.player.prepare(['intro']), { code: 'invalid-hold-duration' }); env.player.dispose();
});

test('a submitted frame remains valid when seek temporarily lowers readyState', async () => {
  const env = environment({ frameReadyState: 1 });
  await env.player.prepare(['intro']); assert.equal(env.player.state, 'ready');
  assert.equal(env.videos[0].readyState, 1); env.player.dispose();
});

test('manifest-relative sources use the module directory even from the nested film review page', async () => {
  const previous = globalThis.location;
  globalThis.location = { href: 'https://path.invalid/interview/film/' };
  const manifest = goodManifest(); manifest.clips[0].src = '../assets/interview/film/intro.mp4';
  const env = environment({ manifest });
  try {
    assert.equal(evaluateFilmReadiness(manifest, ['intro']).ready, true);
    await env.player.play('intro');
    assert.equal(env.activeVideo().src, 'https://path.invalid/assets/interview/film/intro.mp4');
  } finally { env.player.dispose(); if (previous === undefined) delete globalThis.location; else globalThis.location = previous; }
});

test('same-origin film URLs retain a mounted path without weakening media validation', () => {
  for (const mount of ['/', '/path/', '/preview/path/']) {
    const context = { moduleUrl: `https://synk.example${mount}interview/film-player.mjs`, pageUrl: `https://synk.example${mount}interview/film/rehearsal.html` };
    assert.equal(resolveFilmClipUrl('../assets/interview/film/strict-question-4k.mp4', context), `https://synk.example${mount}assets/interview/film/strict-question-4k.mp4`);
    for (const invalid of ['https://remote.example/clip.mp4', 'https://user:password@synk.example/clip.mp4', '../assets/clip.mp4#fragment', 'data:video/mp4,clip', '../assets/poster.jpg', '..\\assets\\clip.mp4']) assert.equal(resolveFilmClipUrl(invalid, context), null, invalid);
  }
});

test('the PATH media bucket is the only other origin a film may come from', () => {
  const context = { moduleUrl: 'https://synk.im/path/interview/film-player.mjs', pageUrl: 'https://synk.im/path/interview/film/rehearsal.html' };
  const hosted = 'https://storage.googleapis.com/synk-public-media/path/interview/film/8e8db2f4a5e98ff1/strict-question-4k.mp4';
  assert.equal(resolveFilmClipUrl(hosted, context), hosted);
  for (const invalid of [
    'http://storage.googleapis.com/synk-public-media/path/interview/film/x/clip.mp4',
    'https://storage.googleapis.com/another-bucket/path/clip.mp4',
    'https://storage.googleapis.com/synk-public-media/other/clip.mp4',
    'https://storage.googleapis.com/synk-public-media/path/../other/clip.mp4',
    'https://storage.googleapis.com/synk-public-media/path/clip.mp4?alt=media',
    'https://storage.googleapis.com/synk-public-media/path/clip.mp4#t=1',
    'https://user@storage.googleapis.com/synk-public-media/path/clip.mp4',
    'https://storage.googleapis.com.evil.example/synk-public-media/path/clip.mp4',
    'https://storage.googleapis.com/synk-public-media/path/poster.jpg',
  ]) assert.equal(resolveFilmClipUrl(invalid, context), null, invalid);
});

test('films are requested in CORS mode so the room can draw their frames', () => {
  const env = environment();
  try {
    assert.equal(env.videos.length, 2);
    for (const video of env.videos) assert.equal(video.crossOrigin, 'anonymous');
  } finally { env.player.dispose(); }
});
