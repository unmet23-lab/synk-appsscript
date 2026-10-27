/** The tea board's hand sounds (vertical slice W8, design §11-4 · W8 note §2-9): one short synthesised sound the
 * moment a hand does something — a cup set down, tea poured, a spoon of honey, 「다 됐어요」, a cup carried and served,
 * a guest pleased. Like blank-slice/sfx.mjs and talk-rally/sfx.mjs this is the brand sound kit's third family, game
 * sounds (docs/브랜드_사운드킷/_사운드킷.md), and keeps its four rules: ① one sound lasts 400ms or less (presses stay
 * under 250ms — a slow sound reads as lag), ② no failure sound (a cup a guest wants changed makes none, emptying a cup
 * is a soft brush, never a falling buzzer), ③ tones are sine or triangle only, ④ every pitch, and both ends of every
 * glide, sit in C pentatonic. Noise is broad and short (felt grain), never a narrow band.
 *
 * Each sound is a score — a plain list of notes and noise strokes from score(name, opts) — so the rules are checked in
 * node without an audio context (tests/town-sfx.test.js), and the same score renders live and offline (the samples).
 *
 * These are effect sounds, so they follow WORLD's effect switch (synk.world.sound, on unless set off) and its
 * vibration switch (synk.world.haptic) — the same ones its button taps follow — and never the village-sound switch.
 * Nothing here turns a switch on. No sound while a microphone is open in this origin (WORLD's recording window keeps
 * synk.world.mic fresh while it records) or while the window is hidden. Only the window a hand is touching plays them.
 */
import { micOpen } from './town/soundscape.mjs';
import { MIC_KEY } from './day-sound.mjs';

export const PREFS = Object.freeze({ sound: 'synk.world.sound', haptic: 'synk.world.haptic' });

// C pentatonic (도·레·미·솔·라) — the only pitches a score may name.
const N = { G3: 196, A3: 220, C4: 261.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98 };
export const PITCHES = Object.freeze(Object.values(N));
/** Whole level of each sound — fitted to the design targets by the offline K-weighted momentary loudness of the samples
 * (qa-tea-ui samples): a cup set down and a cup served ≈ -24, pouring ≈ -26, honey ≈ -27, 「다 됐어요」 ≈ -23, a guest
 * pleased ≈ -21 and the last guest just under the kit's 「획득」 (-20.8); emptying and lifting stay soft. The walking town's
 * layer sits near -27~-26, so a press reads just above it (10-27). */
export const LEVEL = Object.freeze({ cup: 1.8, pour: 1.35, spoon: 1.6, done: 1.25, empty: 1.75, pick: 2.2, serve: 1.5, match: 1.75, final: 1.7 });

const tone = (type, at, f0, f1, glide, attack, decay, level, pan = 0) => ({ kind: 'tone', type, at, f0, f1: f1 ?? f0, glide: glide ?? 0, attack, decay, level, pan });
const stroke = (at, dur, filter, from, to, level, pan = 0, pink = true) => ({ kind: 'noise', at, dur, filter, from, to: to ?? from, level, pan, pink });
const ring = (at, f, decay, level, pan = 0) => [tone('triangle', at, f, f, 0, .004, decay, level, pan), tone('sine', at, f * 2, f * 2, 0, .004, decay * .8, level * .3, pan)];

/** The notes of one sound. opts: cup { vessel: 'warm'|'cold' } · pour { tea } · spoon { honey: 0|1|2 }. variant
 * turns a sound heard twice in a row a little (the second spoon, the same jar again). */
export function score(name, { vessel = 'warm', tea = 'barley', honey = 1, variant = 0 } = {}) {
  const v = variant % 2;
  switch (name) {
    case 'cup': {   // a cup set on the felt board: a soft thump and a short ceramic knock (warm lower, cold higher)
      const hi = vessel === 'cold' ? [N.G5, N.E5] : [N.E5, N.C5];
      return [stroke(0, .045, 'lowpass', 900, 500, .5, -.1), tone('sine', 0, N.G3, N.G3, 0, .003, .08, .25), tone('triangle', .004, hi[0], hi[1], .03, .003, .12, .34, -.1)];
    }
    case 'pour': {  // tea poured: a rising sine as the cup fills (each jar its own pitch) under broad felt grain
      const [from, to] = { barley: [N.C5, N.G5], yuzu: [N.D5, N.A5], today: [N.E5, N.C6] }[tea] || [N.C5, N.G5];
      return [tone('sine', 0, from, to, .26, .02, .3, .22, .15), stroke(0, .28, 'bandpass', 1500, 2400, .1, .15)];
    }
    case 'spoon': { // honey: a drop that climbs a step each spoon; back to none is a soft low pop, not a fall
      if (honey === 0) return [tone('sine', 0, N.C5, N.C5, 0, .004, .1, .22), stroke(0, .03, 'lowpass', 700, 700, .2)];
      const [a, b] = honey === 1 ? (v ? [N.D6, N.A5] : [N.E6, N.C6]) : (v ? [N.A5, N.E5] : [N.G6, N.E6]);
      return [tone('triangle', 0, a, b, .04, .003, .13, .3, .1), stroke(0, .02, 'highpass', 2600, 2600, .12, .1)];
    }
    case 'done':    // 「다 됐어요」: two clear rings, do then mi
      return [...ring(0, N.C6, .28, .32), ...ring(.045, N.E6, .25, .26)];
    case 'empty':   // a cup emptied: a soft brush that dims, no tone at all
      return [stroke(0, .16, 'lowpass', 1800, 600, .3)];
    case 'pick':    // a finished cup lifted into the hand
      return [tone('triangle', 0, N.G6, N.G6, 0, .002, .06, .2), stroke(0, .015, 'highpass', 3000, 3000, .12)];
    case 'serve':   // a cup set down before a guest
      return [stroke(0, .06, 'lowpass', 500, 300, .5), tone('sine', 0, N.G4, N.G4, 0, .003, .12, .4), tone('triangle', .006, N.C5, N.C5, 0, .003, .08, .12)];
    case 'match':   // 「딱 좋아요」: sol rising to do
      return [...ring(0, N.G5, .2, .3, -.05), ...ring(.07, N.C6, .26, .3, .05)];
    case 'final':   // the order's last guest seated: do · mi · sol
      return [...ring(0, N.C6, .2, .26, -.1), ...ring(.06, N.E6, .2, .24), ...ring(.12, N.G6, .24, .22, .1)];
    default: return [];
  }
}
/** When a score has fallen silent (its dry sound, seconds). */
export const lengthOf = notes => notes.reduce((end, n) => Math.max(end, n.kind === 'tone' ? n.at + n.attack + n.decay : n.at + n.dur), 0);
export const NAMES = Object.freeze(Object.keys(LEVEL));

/** Soft limiter: untouched to −3dBFS, a curve above so overlapping sounds never pass −0.6dBFS (blank-slice's shape). */
function softLimit(knee = .7, top = .93, n = 4097) {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = 2 * ((i / (n - 1)) * 2 - 1), m = Math.abs(u);
    curve[i] = Math.sign(u) * (m <= knee ? m : knee + (top - knee) * Math.tanh((m - knee) / (top - knee)));
  }
  return curve;
}
function noiseBuffers(c) {
  let seed = 11;
  const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const make = pink => {
    const n = Math.round(c.sampleRate * .6), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, peak = 1e-9;
    for (let i = 0; i < n; i++) {
      const w = rand() * 2 - 1;
      d[i] = pink ? (b0 = .99765 * b0 + w * .099046, b1 = .963 * b1 + w * .2965164, b2 = .57 * b2 + w * 1.0526913, b0 + b1 + b2 + w * .1848) : w;
      peak = Math.max(peak, Math.abs(d[i]));
    }
    for (let i = 0; i < n; i++) d[i] /= peak;
    return buf;
  };
  return { pink: make(true), white: make(false) };
}
/** The bus: every sound → out → half → soft limiter → (tap) → destination. Returned for the offline samples too. */
export function createBus(c, destination = c.destination) {
  const out = c.createGain(), half = c.createGain(), limit = c.createWaveShaper(), tap = c.createAnalyser?.() || null;
  half.gain.value = .5; limit.curve = softLimit(); limit.oversample = 'none';
  out.connect(half).connect(limit);
  if (tap) { tap.fftSize = 2048; limit.connect(tap); tap.connect(destination); } else limit.connect(destination);
  return { c, out, tap, noise: noiseBuffers(c) };
}
/** Draws one score into the bus at time t. */
export function render(bus, notes, t, level = 1) {
  const c = bus.c;
  for (const n of notes) {
    const g = c.createGain(), pan = c.createStereoPanner?.() || null;
    if (pan) { pan.pan.value = Math.max(-1, Math.min(1, n.pan || 0)); g.connect(pan).connect(bus.out); } else g.connect(bus.out);
    const at = t + n.at, peak = Math.max(.0002, n.level * level);
    if (n.kind === 'tone') {
      const o = c.createOscillator();
      o.type = n.type; o.frequency.setValueAtTime(n.f0, at);
      if (n.f1 !== n.f0 && n.glide > 0) o.frequency.exponentialRampToValueAtTime(n.f1, at + n.glide);
      g.gain.setValueAtTime(.0001, at); g.gain.linearRampToValueAtTime(peak, at + n.attack); g.gain.exponentialRampToValueAtTime(.0001, at + n.attack + n.decay);
      o.connect(g); o.start(at); o.stop(at + n.attack + n.decay + .02);
    } else {
      const s = c.createBufferSource(), f = c.createBiquadFilter();
      s.buffer = n.pink ? bus.noise.pink : bus.noise.white;
      f.type = n.filter; f.Q.value = n.filter === 'bandpass' ? .5 : .7;
      f.frequency.setValueAtTime(n.from, at); if (n.to !== n.from) f.frequency.exponentialRampToValueAtTime(n.to, at + n.dur);
      g.gain.setValueAtTime(.0001, at); g.gain.linearRampToValueAtTime(peak, at + Math.min(.006, n.dur / 4)); g.gain.exponentialRampToValueAtTime(.0001, at + n.dur);
      s.connect(f).connect(g); s.start(at, 0, n.dur + .01);
    }
  }
}

const readPref = key => { try { const raw = localStorage.getItem(key); if (raw === 'false') return false; } catch {} return true; };
const readStamp = key => { try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) && value > 0 ? value : null; } catch { return null; } };
const VIBRATE = Object.freeze({ cup: 8, pour: 6, spoon: 6, done: 10, pick: 6, serve: 10, match: 12 });

/** The live player. play(name, opts) sounds now (returns whether it did); unlock() is called from a person's own
 * input so the browser lets the context run. */
export function createTeaSfx() {
  let ctx = null, bus = null, disposed = false;
  const last = { name: null, n: 0 };
  function ensure() {
    if (ctx || disposed) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return null; }
    bus = createBus(ctx);
    return ctx;
  }
  const quiet = () => !readPref(PREFS.sound) || document.hidden || micOpen({ heardAt: readStamp(MIC_KEY), now: Date.now() });
  function play(name, opts = {}) {
    if (disposed || !LEVEL[name] || quiet()) return false;
    const c = ensure(); if (!c) return false;
    if (c.state === 'suspended') c.resume().catch(() => {});
    if (c.state !== 'running') return false;
    last.n = last.name === name ? last.n + 1 : 0; last.name = name;
    render(bus, score(name, { ...opts, variant: last.n }), c.currentTime + .004, LEVEL[name]);
    if (VIBRATE[name] && readPref(PREFS.haptic) && matchMedia?.('(pointer: coarse)').matches) try { navigator.vibrate?.(VIBRATE[name]); } catch {}
    return true;
  }
  function unlock() { if (quiet()) return; const c = ensure(); if (c?.state === 'suspended') c.resume().catch(() => {}); }
  function level() {
    if (!bus?.tap) return 0;
    const data = new Float32Array(bus.tap.fftSize); bus.tap.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((s, x) => s + x * x, 0) / data.length);
  }
  function dispose() { disposed = true; try { ctx?.close(); } catch {} ctx = null; }
  return { play, unlock, level, stats: () => ({ context: ctx?.state || null, quiet: quiet() }), dispose };
}
