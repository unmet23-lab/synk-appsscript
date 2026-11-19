// 검정 구 지도의 효과음(2026-11-20 유호님). 소리를 낼 수 없는 환경에서도 화면이 멈추지 않고, 악보가 약속한 모양인지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbSound, mapScore, unmapScore } from '../renderer/orb-sound.mjs';

/* 부른 것을 적기만 하는 가짜 AudioContext */
function fakeAudio() {
  const log = { made: 0, starts: [], closed: 0, hushed: 0, resumed: 0, state: 'running' };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(v) { if (v === 0) log.hushed++; } });
  const node = kind => ({ kind, type: '', buffer: null, gain: param(), frequency: param(), Q: param(), connect() {}, start(at) { log.starts.push({ kind, at }); }, stop() {} });
  class Ctx {
    constructor() { log.made++; this.currentTime = 10; this.sampleRate = 48000; this.destination = {}; }
    get state() { return log.state; }
    resume() { log.resumed++; if (log.wake) log.state = 'running'; return Promise.resolve(); }
    createGain() { return node('gain'); }
    createOscillator() { return node('osc'); }
    createBiquadFilter() { return node('filter'); }
    createBufferSource() { return node('noise'); }
    createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
    close() { log.closed++; return Promise.resolve(); }
  }
  return { win: { AudioContext: Ctx }, log };
}

test('the map score is a few soft key taps while the dots scatter, then three clear notes rising as the stars settle', () => {
  for (const small of [false, true]) {
    const s = mapScore(small, () => 0.5);
    assert.equal(s.tocks.length, small ? 4 : 7);
    assert.equal(s.notes.length, 3);
    assert.ok(s.notes[0].freq < s.notes[1].freq && s.notes[1].freq < s.notes[2].freq, 'rising');
    assert.ok(Math.max(...s.tocks.map(t => t.at)) < s.notes[0].at, 'the taps end before the first note');
    assert.ok(s.notes[2].at < 0.7, 'all three notes start within the time the map takes to open');
    for (const t of s.tocks) assert.ok(t.gain > 0 && t.gain <= 0.07 && t.freq >= 1700 && t.freq <= 2600);
    for (const n of s.notes) assert.ok(n.gain > 0 && n.gain <= 0.02);
  }
  assert.ok(mapScore(true, () => 0.5).notes[0].gain < mapScore(false, () => 0.5).notes[0].gain, 'the small map beside the orb is quieter');
  const u = unmapScore();
  assert.equal(u.length, 3);
  assert.ok(u[0].freq > u[1].freq && u[1].freq > u[2].freq && u[0].gain > u[2].gain, 'falling and fading');
});

test('map, unmap and key play through one audio context, made only when first needed', () => {
  const { win, log } = fakeAudio();
  const sound = createOrbSound({ win });
  assert.equal(log.made, 0);
  assert.equal(sound.key(), true);
  assert.equal(log.made, 1);
  assert.deepEqual(log.starts.map(s => s.kind), ['noise', 'osc'], 'one tap: a short noise and its low body');
  log.starts.length = 0;
  assert.equal(sound.map(false), true);
  assert.equal(log.starts.filter(s => s.kind === 'noise').length, 7);
  assert.equal(log.starts.filter(s => s.kind === 'osc').length, 7 + 6, 'seven tap bodies and three notes with an overtone each');
  log.starts.length = 0;
  assert.equal(sound.unmap(), true);
  assert.equal(log.starts.filter(s => s.kind === 'noise').length, 3);
  assert.equal(log.made, 1);
  sound.dispose();
  assert.equal(log.closed, 1);
  assert.equal(sound.key(), false, 'silent after dispose');
});

test('it stays silent when sound is turned off, and never throws where sound cannot be made', () => {
  const a = fakeAudio();
  const off = createOrbSound({ win: a.win, enabled: () => false });
  assert.equal(off.map(true), false); assert.equal(off.key(), false); assert.equal(a.log.made, 0);
  const none = createOrbSound({ win: {} });
  assert.equal(none.map(false), false); assert.equal(none.unmap(), false); assert.equal(none.key(), false);
  const broken = createOrbSound({ win: { AudioContext: class { constructor() { throw new Error('no device'); } } } });
  assert.equal(broken.map(false), false); assert.equal(broken.key(), false);
  const throwing = createOrbSound({ win: a.win, enabled: () => { throw new Error('x'); } });
  assert.equal(throwing.key(), false);
});

test('while the audio context is still suspended nothing is scheduled, so sounds cannot pile up and burst on the first click (carbon A1)', () => {
  const { win, log } = fakeAudio();
  log.state = 'suspended';
  const sound = createOrbSound({ win });
  assert.equal(sound.map(true), false); assert.equal(sound.key(), false); assert.equal(sound.unmap(), false);
  assert.equal(log.starts.length, 0, 'nothing queued on the stopped clock');
  assert.equal(log.resumed, 3, 'each try only asks the context to wake');
  log.state = 'running';
  assert.equal(sound.key(), true);
  assert.equal(log.starts.filter(s => s.kind === 'noise').length, 1, 'only the sound asked for now is heard');
});

test('closing the map or opening it again silences what is left of the earlier map sound (carbon A2)', () => {
  const { win, log } = fakeAudio();
  const sound = createOrbSound({ win });
  sound.map(true);
  assert.equal(log.hushed, 0);
  sound.unmap();
  assert.equal(log.hushed, 1, 'the notes still to come are faded out when the map folds');
  sound.unmap();
  assert.equal(log.hushed, 1, 'nothing left to silence');
  sound.map(true); sound.map(false);
  assert.equal(log.hushed, 2, 'a new map sound replaces the one before it');
  sound.key();
  assert.equal(log.hushed, 2, 'pointing at a name does not cut the map sound');
});

test('the very first sound after the app starts is not lost when the new context needs a moment to wake (Fable F4)', async () => {
  const { win, log } = fakeAudio();
  log.state = 'suspended'; log.wake = true;
  const sound = createOrbSound({ win });
  assert.equal(sound.key(), false, 'not yet running at the moment of the call');
  assert.equal(log.starts.length, 0);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(log.starts.filter(s => s.kind === 'noise').length, 1, 'played once, as soon as the context woke');
  // 전부터 있던 맥락이 다시 멈춘 때에는 뒤늦게 내지 않는다(쌓이지 않는다)
  log.state = 'suspended'; log.wake = false;
  sound.key(); sound.key();
  log.state = 'running';
  await new Promise(r => setTimeout(r, 0));
  assert.equal(log.starts.filter(s => s.kind === 'noise').length, 1);
});
