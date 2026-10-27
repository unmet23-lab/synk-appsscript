/** The village sound and SYNK music on the screen (vertical slice W7b, village design §4-4). town/soundscape.mjs
 * says how loud each layer and each bus is; this module makes the sound. The village sound is synthesised — no
 * files, like WORLD's own sounds (brand-opening/world-sound.mjs): the rights are this code itself and nothing is
 * downloaded. The brand sound kit's ear rules hold here too (docs/브랜드_사운드킷/_사운드킷.md): noise only broad (no
 * narrow band that reads as radio hiss) and every tone a plain sine at a steady pitch (no buzz, jitter or detuned
 * beating). SYNK music plays the songs on the list (none until chosen) through one <audio> pair, crossfaded.
 *
 * The two switches live on the device (localStorage, the same namespace as WORLD's sound settings and apart from
 * its button sounds). A switch turns on only by the person's own act (prefAfter); nothing here ever turns one on.
 * A browser that cannot keep the setting starts both off, so a sound once turned off cannot come back by being
 * forgotten (village design acceptance 11). Both buses go to 0 at once while a microphone is open in this origin
 * (WORLD's recording window keeps synk.world.mic fresh while it records), while the window is hidden, and while
 * another town window is the one sounding — the window a person touched (or sat in) last, chosen on the device.
 */
import { LAYERS, TRACKS, GAINS, FADES, soundscapeAt, busLevels, prefAfter, micOpen } from './town/soundscape.mjs';
import { DAY } from './town/clock.mjs';

export const PREF_KEYS = Object.freeze({ village: 'synk.world.town-sound', music: 'synk.world.town-music' });
export const AUDIO_CHANNEL = 'synk-world-audio';
/** WORLD's recording window writes the time here while its microphone is open (world-sound.mjs recordingSignal). */
export const MIC_KEY = 'synk.world.mic';
/** The town window that sounds: { id, at } — the last one a person touched or sat in. */
export const OWNER_KEY = 'synk.world.town-sound-owner';
const ms = n => n / 1000;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];

/* ── noise, made once per audio context ── broad noise only (the kit's rule): white, pink and brown loops whose
   ends are blended into their starts so a loop never clicks. */
function loopBuffer(ctx, seconds, shape) {
  const rate = ctx.sampleRate, fade = Math.floor(rate * .25), length = Math.floor(rate * seconds) + fade, data = new Float32Array(length);
  shape(data);
  let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < length; i++) data[i] /= peak || 1;
  for (let i = 0; i < fade; i++) { const t = i / fade; data[i] = data[i] * t + data[length - fade + i] * (1 - t); }
  const buffer = ctx.createBuffer(1, length - fade, rate); buffer.copyToChannel(data.subarray(0, length - fade), 0);
  return buffer;
}
function noiseBuffers(ctx) {
  return {
    white: loopBuffer(ctx, 2, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }),
    // Paul Kellet's pink filter.
    pink: loopBuffer(ctx, 3, d => { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1;
      b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362; b6 = w * .115926; } }),
    brown: loopBuffer(ctx, 4, d => { let last = 0; for (let i = 0; i < d.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last; } }),
  };
}

/* ── the pieces ── */
function filter(ctx, type, frequency, q = .7) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q; return f; }
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes.at(-1); }
function panned(ctx, out, pan) { if (!ctx.createStereoPanner) return out; const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(out); p.notes = 0; return p; }
/** Each sound through a note's own panner holds it; the last one to end lets it go (the layer's gain lives on). */
const hold = out => { if (out.notes !== undefined) out.notes++; };
const letGo = out => { if (out.notes !== undefined && --out.notes === 0) out.disconnect(); };
/** A loop that runs as long as the layer lives. */
function loop(ctx, buffer, offset = Math.random()) { const s = ctx.createBufferSource(); s.buffer = buffer; s.loop = true; s.start(ctx.currentTime, offset * buffer.duration); return s; }
/** One plain sine with an envelope (attack, decay to silence) and an optional glide; cleans itself up. */
function tone(ctx, out, { t, f, f2 = 0, glide = .05, peak, attack = .004, decay = .1 }) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + glide);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + attack + decay);
  o.connect(g); g.connect(out); hold(out); o.start(t); o.stop(t + attack + decay + .05); o.onended = () => { o.disconnect(); g.disconnect(); letGo(out); };
}
/** A short broad noise tap (a raindrop, a tick) through a high-pass and a low-pass — never one narrow band. */
function tap(ctx, out, noise, { t, peak, decay = .006, low = 1800, high = 9000 }) {
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = noise;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + .0008); g.gain.exponentialRampToValueAtTime(.0001, t + .0008 + decay);
  chain(s, filter(ctx, 'highpass', low, .5), filter(ctx, 'lowpass', high, .5), g).connect(out); hold(out);
  s.start(t, Math.random() * (noise.duration - .1)); s.stop(t + decay + .05); s.onended = () => { s.disconnect(); g.disconnect(); letGo(out); };
}

/* ── the layers ── each builds its steady part into out and returns tick(level, from, to), which schedules the
   events falling in [from, to) — as many as the level asks for. */
const LAYER_MAKERS = {
  wind(ctx, out, n) {
    const low = filter(ctx, 'lowpass', 420, .6), g = ctx.createGain(); g.gain.value = .65;
    chain(loop(ctx, n.brown), low, g).connect(out);
    // The wind breathes: a very slow swell in strength and brightness.
    const lfo = ctx.createOscillator(), depth = ctx.createGain(), sway = ctx.createOscillator(), sweep = ctx.createGain();
    lfo.frequency.value = rand(.05, .08); depth.gain.value = .3; lfo.connect(depth); depth.connect(g.gain); lfo.start();
    sway.frequency.value = rand(.06, .09); sweep.gain.value = 140; sway.connect(sweep); sweep.connect(low.frequency); sway.start();
    return null;
  },
  rainOpen(ctx, out, n) {
    chain(loop(ctx, n.pink), filter(ctx, 'highpass', 350, .5), filter(ctx, 'lowpass', 6500, .3)).connect(out);
    return (level, from, to) => { for (let t = from + rand(0, .06); t < to; t += rand(.07, .16) / Math.max(.2, level)) tap(ctx, panned(ctx, out, rand(-.6, .6)), n.white, { t, peak: rand(.25, .7) }); };
  },
  rainRoof(ctx, out, n) {
    chain(loop(ctx, n.pink), filter(ctx, 'lowpass', 1600, .4)).connect(out);
    const thrum = ctx.createGain(); thrum.gain.value = .5; chain(loop(ctx, n.brown), filter(ctx, 'lowpass', 160, .5), thrum).connect(out);
    return (level, from, to) => { for (let t = from + rand(0, .08); t < to; t += rand(.08, .18) / Math.max(.2, level)) tap(ctx, panned(ctx, out, rand(-.8, .8)), n.white, { t, peak: rand(.2, .5), decay: .012, low: 600, high: 2600 }); };
  },
  drip(ctx, out) {
    return (level, from, to) => { for (let t = from + rand(0, .4); t < to; t += rand(.6, 2.4) / Math.max(.15, level)) {
      const p = panned(ctx, out, rand(-.7, .7)), f = rand(1500, 2200);
      tone(ctx, p, { t, f, f2: f * .55, glide: .04, peak: rand(.2, .35), attack: .002, decay: .12 }); tone(ctx, p, { t, f: 420, peak: .08, attack: .002, decay: .05 });
    } };
  },
  chime(ctx, out) {
    // A 풍경: one small temple bell under the eaves, rung now and then by the wind — inharmonic plain sines.
    const ring = (t, strength) => { const f = rand(1100, 1250), p = panned(ctx, out, rand(-.3, .3));
      [[1, 1, 2.4], [2.32, .45, 1.5], [4.25, .2, .8], [6.63, .1, .4]].forEach(([ratio, amp, decay]) => tone(ctx, p, { t, f: f * ratio, peak: .25 * amp * strength, attack: .002, decay })); };
    return (level, from, to) => { for (let t = from + rand(0, 2); t < to; t += rand(6, 18) / Math.max(.15, level)) { ring(t, rand(.6, 1)); if (Math.random() < .4) ring(t + rand(.25, .5), rand(.3, .55)); } };
  },
  birds(ctx, out) {
    const chirp = (p, t, f0) => tone(ctx, p, { t, f: f0, f2: f0 * 1.22, glide: .045, peak: rand(.08, .14), attack: .005, decay: .08 });
    const trill = (p, t) => { const f = rand(3600, 4100); tone(ctx, p, { t, f, f2: f * .74, glide: .12, peak: rand(.07, .11), attack: .006, decay: .14 }); };
    return (level, from, to) => { for (let t = from + rand(0, 1.5); t < to; t += rand(2.5, 8) / Math.max(.15, level)) {
      const p = panned(ctx, out, rand(-.8, .8));
      if (Math.random() < .65) { const f0 = rand(2600, 3500), count = 2 + Math.floor(Math.random() * 4); for (let i = 0, at = t; i < count; i++, at += rand(.07, .16)) chirp(p, at, f0 * rand(.97, 1.03)); }
      else trill(p, t);
    } };
  },
  crickets(ctx, out) {
    // A few crickets, each on its own steady pitch far from the others (no beating), chirping three pulses at a time.
    const singers = [3800, 4100, 4400].map((f, i) => ({ f, period: rand(.75, 1.1), next: 0, pan: [-.5, .4, .05][i] }));
    return (level, from, to) => { const active = Math.ceil(level * singers.length - .001);
      singers.forEach((s, i) => { if (i >= active) { s.next = 0; return; } if (!s.next || s.next < from - 1) s.next = from + rand(0, s.period);
        for (; s.next < to; s.next += s.period * rand(.95, 1.05)) { const p = panned(ctx, out, s.pan); for (let k = 0; k < 3; k++) tone(ctx, p, { t: s.next + k * .04, f: s.f, peak: .05, attack: .003, decay: .018 }); } }); };
  },
  frogs(ctx, out) {
    // A low two-note croak with a soft burr (amplitude, not pitch, wavers), two frogs answering each other.
    const croak = (t, f, pan) => { const o = ctx.createOscillator(), g = ctx.createGain(), am = ctx.createOscillator(), depth = ctx.createGain(), p = panned(ctx, out, pan);
      o.frequency.value = f; am.frequency.value = 28; depth.gain.value = .045; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.06, t + .02); g.gain.linearRampToValueAtTime(.0001, t + .14);
      am.connect(depth); depth.connect(g.gain); o.connect(g); g.connect(p); hold(p); o.start(t); am.start(t); o.stop(t + .2); am.stop(t + .2); o.onended = () => { o.disconnect(); g.disconnect(); am.disconnect(); depth.disconnect(); letGo(p); }; };
    return (level, from, to) => { for (let t = from + rand(0, 1); t < to; t += rand(.9, 3.2) / Math.max(.15, level)) { const pan = pick([-.6, .5]), f = pan < 0 ? 220 : 196; croak(t, f, pan); croak(t + .17, f * .9, pan); } };
  },
  cafe(ctx, out, n) {
    const clink = t => { const p = panned(ctx, out, rand(-.4, .4)); tone(ctx, p, { t, f: rand(2800, 3000), peak: .07, attack: .002, decay: .25 }); tone(ctx, p, { t, f: rand(5100, 5300), peak: .03, attack: .002, decay: .12 }); };
    const pour = t => { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = n.pink; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.05, t + .2); g.gain.linearRampToValueAtTime(.05, t + .7); g.gain.linearRampToValueAtTime(.0001, t + .9);
      chain(s, filter(ctx, 'lowpass', 1200, .4), g).connect(out); s.start(t, rand(0, 1.5)); s.stop(t + 1); s.onended = () => { s.disconnect(); g.disconnect(); }; };
    return (level, from, to) => { for (let t = from + rand(0, 3); t < to; t += rand(5, 14) / Math.max(.15, level)) { clink(t); if (Math.random() < .3) clink(t + rand(.15, .3)); if (Math.random() < .25) pour(t + rand(1, 3)); } };
  },
};

/** Builds one layer into dest (an AudioContext or an OfflineAudioContext — the QA renders layers to measure them). */
export function buildLayer(name, ctx, dest, buffers = noiseBuffers(ctx)) {
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(dest);
  const tick = LAYER_MAKERS[name]?.(ctx, gain, buffers) || null;
  return { gain, tick };
}
/** Renders a whole village mix offline, as the screen would play it (layers: { name: level }, bus: the village bus
 * level) — for listening samples and loudness checks. gains overrides a layer's reference gain (an ear check of a
 * layer at another strength). */
export async function renderMix({ layers: levels, seconds = 20, bus = 1, gains = {}, sampleRate = 44100 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate), buffers = noiseBuffers(ctx);
  const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -10; limiter.ratio.value = 4; limiter.knee.value = 6;
  const village = ctx.createGain(); village.gain.value = bus; chain(village, limiter, ctx.destination);
  for (const [name, level] of Object.entries(levels)) {
    const gain = gains[name] ?? GAINS[name] ?? 0; if (!(level > .01) || !(gain > 0)) continue;
    const layer = buildLayer(name, ctx, village, buffers); layer.gain.gain.value = level * gain; layer.tick?.(level, 0, seconds);
  }
  return ctx.startRendering();
}
/** Renders a layer offline for the QA's loudness measurement (level 0~1, the layer's reference gain applied). */
export async function renderLayer(name, { seconds = 8, level = 1, sampleRate = 44100 } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const layer = buildLayer(name, ctx, ctx.destination); layer.gain.gain.value = level * (GAINS[name] ?? 0);
  layer.tick?.(level, 0, seconds);
  return ctx.startRendering();
}

/* ── the switches ── on the device. A browser that refuses storage starts both off (a turned-off sound must never
   come back by being forgotten); a refused write keeps an «off» in the session store too. */
const memory = {};
const storageWorks = (() => { try { const probe = '__synk_town_sound_probe__'; localStorage.setItem(probe, '1'); localStorage.removeItem(probe); return true; } catch { return false; } })();
function storedPref(name) {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try { const raw = store().getItem(PREF_KEYS[name]); if (raw === 'true') return true; if (raw === 'false') return false; } catch {}
  }
  return name in memory ? memory[name] : null;
}
/** First values: the village sound on unless WORLD's button sounds are off; SYNK music off until turned on; both off
 * where nothing can be kept. */
function firstPref(name) {
  if (!storageWorks) return false;
  if (name === 'music') return false;
  try { return localStorage.getItem('synk.world.sound') !== 'false'; } catch { return false; }
}
const readPref = name => storedPref(name) ?? firstPref(name);
function writePref(name, value) {
  memory[name] = value;
  let kept = false;
  try { localStorage.setItem(PREF_KEYS[name], String(value)); kept = true; } catch {}
  if (!kept) try { sessionStorage.setItem(PREF_KEYS[name], String(value)); } catch {}
}
const readStamp = key => { try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) && value > 0 ? value : null; } catch { return null; } };
const readOwner = () => { try { const value = JSON.parse(localStorage.getItem(OWNER_KEY) || 'null'); return value && typeof value.id === 'string' && Number.isFinite(value.at) ? value : null; } catch { return null; } };

export function createTownSound({ surfaceId = crypto.randomUUID() } = {}) {
  let ctx = null, master = null, tap = null, buses = null, layers = null, buffers = null, ticker = 0, scheduledTo = 0, suspendTimer = 0, disposed = false;
  let last = { layers: {}, buses: { village: 0, music: 0 } }, input = null, owner = readOwner(), interrupted = false;
  // A microphone open elsewhere in this origin: the time WORLD's recording window last wrote (wall clock — another
  // document's), or the close it said on the fast channel.
  const mic = { heardAt: readStamp(MIC_KEY), closedAt: null };
  const prefs = { village: readPref('village'), music: readPref('music') }, listeners = new Set();
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(AUDIO_CHANNEL) : null;
  const music = createMusic({ onChange: () => { apply(); notify(); } });
  if (channel) channel.onmessage = event => {
    const data = event.data;
    if (data?.type === 'mic') { if (data.open === true) mic.heardAt = Date.now(); else if (data.open === false) mic.closedAt = Date.now(); apply(); }
    if (data?.type === 'owner') { owner = readOwner(); apply(); }
  };
  const storage = event => {
    if (event.key === PREF_KEYS.village || event.key === PREF_KEYS.music) { prefs.village = readPref('village'); prefs.music = readPref('music'); apply(); notify(); }
    if (event.key === MIC_KEY) { const at = readStamp(MIC_KEY); if (at) mic.heardAt = at; else mic.closedAt = Date.now(); apply(); }
    if (event.key === OWNER_KEY) { owner = readOwner(); if (!owner && input && !input.hidden) claim(); apply(); }
  };
  addEventListener('storage', storage);
  function notify() { for (const fn of listeners) try { fn({ ...prefs }); } catch {} }
  /** This window becomes the one that sounds (a person touched it, or sat down in it). */
  function claim() {
    owner = { id: surfaceId, at: Date.now() };
    try { localStorage.setItem(OWNER_KEY, JSON.stringify(owner)); } catch {}
    try { channel?.postMessage({ type: 'owner' }); } catch {}
  }
  function releaseOwner() {
    if (owner?.id !== surfaceId) return;
    owner = null; try { if (readOwner()?.id === surfaceId) localStorage.removeItem(OWNER_KEY); } catch {}
    try { channel?.postMessage({ type: 'owner' }); } catch {}
  }
  // Where storage is refused the claim lives only here: such a window counts as sounding while it is seen.
  const sounding = () => !storageWorks || owner?.id === surfaceId;
  const recordingNow = () => micOpen({ ...mic, now: Date.now() });

  function ensure() {
    if (ctx || disposed) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch { return null; }
    buffers = noiseBuffers(ctx);
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -10; limiter.ratio.value = 4; limiter.knee.value = 6;
    master = ctx.createGain(); master.gain.value = 1; chain(master, limiter, ctx.destination);
    // The output, for the QA (that it is really silent while a microphone is open) — it changes nothing.
    tap = ctx.createAnalyser(); tap.fftSize = 2048; limiter.connect(tap);
    buses = { village: ctx.createGain(), music: ctx.createGain() }; for (const bus of Object.values(buses)) { bus.gain.value = 0; bus.connect(master); }
    layers = Object.fromEntries(LAYERS.map(name => [name, buildLayer(name, ctx, buses.village, buffers)]));
    music.attach(ctx, buses.music);
    // A phone call or Siri interrupts the audio; it comes back when the window is seen again or at the next touch.
    ctx.addEventListener('statechange', () => { interrupted = ctx.state === 'interrupted' || ctx.state === 'suspended' && !(last.buses.village === 0 && last.buses.music === 0); });
    scheduledTo = ctx.currentTime;
    ticker = setInterval(tick, 200);
    return ctx;
  }
  /** Schedules the next stretch of events, layer by layer, at the levels the scene asks for now (a layer whose
   * reference gain is 0 makes no events at all). */
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (recordingNow() !== last.recording) apply();
    const from = Math.max(scheduledTo, ctx.currentTime + .02), to = ctx.currentTime + .45;
    if (last.buses.village > 0) for (const name of LAYERS) { const level = GAINS[name] > 0 ? last.layers[name] || 0 : 0; if (level > .01) layers[name].tick?.(level, from, to); }
    scheduledTo = to;
  }
  /** Turns the scene now (update's input) into levels, and moves every gain toward them. */
  function apply() {
    if (!input) return;
    const recording = recordingNow();
    const scape = soundscapeAt({ light: input.light, ms: input.ms, listener: input.listener, awake: input.awake });
    const bus = busLevels({ village: prefs.village, music: prefs.music && !music.held() && !music.paused(), staying: input.staying, dialog: input.dialog, recording, hidden: input.hidden, owner: sounding() });
    const silentBefore = last.buses.village === 0 && last.buses.music === 0;
    last = { layers: scape.layers, buses: bus, recording, sheltered: scape.sheltered };
    if (!ctx) return;
    const now = ctx.currentTime, silent = bus.village === 0 && bus.music === 0;
    clearTimeout(suspendTimer);
    if (silent) {
      // A microphone silences at once; hiding fades a little; then the context stops working.
      const fade = ms(recording ? FADES.muteMs : FADES.hideMs);
      for (const node of Object.values(buses)) { node.gain.cancelScheduledValues(now); node.gain.setValueAtTime(node.gain.value, now); node.gain.linearRampToValueAtTime(0, now + fade); }
      music.level(0, fade);
      suspendTimer = setTimeout(() => { if (ctx && last.buses.village === 0 && last.buses.music === 0 && ctx.state === 'running') ctx.suspend().catch(() => {}); }, fade * 1000 + 50);
      return;
    }
    if (ctx.state !== 'running') ctx.resume().then(() => { interrupted = false; }, () => {});
    session('ambient');
    const glide = ms(silentBefore ? FADES.resumeMs : FADES.layerMs) / 3;
    buses.village.gain.cancelScheduledValues(now); buses.village.gain.setTargetAtTime(bus.village, now, glide);
    buses.music.gain.cancelScheduledValues(now); buses.music.gain.setTargetAtTime(bus.music > 0 ? 1 : 0, now, glide);
    music.level(bus.music, ms(FADES.musicMs));
    for (const name of LAYERS) layers[name].gain.gain.setTargetAtTime((scape.layers[name] || 0) * GAINS[name], now, ms(FADES.layerMs) / 3);
  }

  return {
    /** The scene now: { light, ms, listener:{x,z,sheltered?}, awake, staying, dialog, hidden }. A window coming back
     * into view reads the microphone key before it sounds again (it may have been frozen while hidden). */
    update(next) {
      // Seen again: read the microphone key, and sound again unless another window took over while this one was away.
      if (input?.hidden && !next.hidden) { const at = readStamp(MIC_KEY); if (at) mic.heardAt = Math.max(mic.heardAt || 0, at); else mic.closedAt = Date.now(); if (!readOwner()) claim(); if (interrupted) ctx?.resume().catch(() => {}); }
      if (!input?.hidden && next.hidden) releaseOwner();
      if (next.staying && !input?.staying) claim();
      input = next; music.day(next.ms); apply();
    },
    /** Called from a person's input event in this window: it becomes the window that sounds, and the audio wakes
     * (browsers start sound only from such an event). */
    unlock() {
      if (disposed) return;
      if (owner?.id !== surfaceId) claim();
      if (!(prefs.village || prefs.music && TRACKS.length)) { apply(); return; }
      const c = ensure(); if (!c) return;
      if (c.state !== 'running' && !(last.buses.village === 0 && last.buses.music === 0)) c.resume().then(() => { interrupted = false; }, () => {});
      music.prime();
      apply();
    },
    prefs: () => ({ ...prefs }),
    /** A switch from the person's own click on that switch: event must be its trusted input event, caught on that
     * switch (not some other button's), to turn a sound on. */
    setPref(name, value, event) {
      if (!(name in prefs)) return false;
      const next = prefAfter({ current: prefs[name], wanted: value === true, trusted: event?.isTrusted === true && event.currentTarget?.dataset?.soundPref === name });
      if (next !== prefs[name]) { prefs[name] = next; writePref(name, next); notify(); }
      if (next) this.unlock(); else apply();
      return next;
    },
    onPrefs(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    hasMusic: () => TRACKS.length > 0,
    /** Why music waits though its switch is on ('data' — a saving or cellular connection), or null. */
    musicHeld: () => music.held(),
    /** Music paused from a headset, a media key or the lock screen (its switch stays on). */
    musicPaused: () => music.paused(),
    /** The output's loudness now (RMS, 0~1) — for the QA. */
    level() { if (!tap) return 0; const data = new Float32Array(tap.fftSize); tap.getFloatTimeDomainData(data); let sum = 0; for (const v of data) sum += v * v; return Math.sqrt(sum / data.length); },
    stats: () => ({ context: ctx?.state ?? 'none', prefs: { ...prefs }, storage: storageWorks, sounding: sounding(), buses: { ...last.buses }, recording: !!last.recording, sheltered: !!last.sheltered,
      layers: Object.fromEntries(Object.entries(last.layers).map(([k, v]) => [k, Math.round(v * 1000) / 1000])), tracks: TRACKS.length, music: music.stats(), channel: !!channel,
      output: buses ? { village: buses.village.gain.value, music: buses.music.gain.value } : null }),
    dispose() {
      disposed = true; clearInterval(ticker); clearTimeout(suspendTimer); removeEventListener('storage', storage); releaseOwner(); channel?.close(); music.dispose();
      ctx?.close().catch(() => {}); ctx = null;
    },
  };
}

/** iPhone's audio session: the village sound and music both follow the silent switch (ambient). */
function session(type) { try { const value = navigator.audioSession; if (value && value.type !== type) value.type = type; } catch {} }

/** SYNK music: the list's songs in the day's shuffled order, one <audio> pair through the audio context (so the
 * level works on iPhones too), each song crossfading into the next. With no songs it does nothing at all. It waits
 * on a data-saving or cellular connection (the village design's Wi-Fi rule for downloads — the switch stays as it
 * is), and a headset's or the lock screen's pause is a pause, never the switch. */
function createMusic({ onChange = () => {} } = {}) {
  let ctx = null, out = null, players = [], current = 0, order = [], index = 0, dayKey = null, target = 0, timer = 0, paused = false, retry = null;
  const shuffle = seed => { const list = TRACKS.map((t, i) => i); let s = seed >>> 0; for (let i = list.length - 1; i > 0; i--) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % (i + 1); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const held = () => { const c = navigator.connection; return TRACKS.length && (c?.saveData === true || c?.type === 'cellular') ? 'data' : null; };
  function start(player, track) {
    player.audio.src = new URL(track.file, location.href).href; player.audio.currentTime = 0; player.track = track;
    player.audio.play().then(() => session('ambient'), () => { retry = player; });
    try { if (navigator.mediaSession) navigator.mediaSession.metadata = new MediaMetadata({ title: track.title }); } catch {}
  }
  function next() {
    if (!order.length) return;
    const from = players[current], to = players[1 - current], track = TRACKS[order[index % order.length]]; index++;
    start(to, track); const now = ctx.currentTime, fade = ms(FADES.musicMs);
    to.gain.gain.cancelScheduledValues(now); to.gain.gain.setValueAtTime(0, now); to.gain.gain.linearRampToValueAtTime(target, now + fade);
    from.gain.gain.cancelScheduledValues(now); from.gain.gain.setValueAtTime(from.gain.gain.value, now); from.gain.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => { if (players[current] !== from) from.audio.pause(); }, fade * 1000 + 100);
    current = 1 - current;
  }
  return {
    attach(context, bus) {
      if (!TRACKS.length) return;
      ctx = context; out = bus;
      players = [0, 1].map(() => { const audio = new Audio(); audio.preload = 'none'; const gain = ctx.createGain(); gain.gain.value = 0; ctx.createMediaElementSource(audio).connect(gain); gain.connect(out); return { audio, gain, track: null }; });
      for (const p of players) p.audio.addEventListener('timeupdate', () => { if (target > 0 && !paused && p === players[current] && p.audio.duration && p.audio.duration - p.audio.currentTime < ms(FADES.musicMs)) next(); });
      try {
        navigator.mediaSession?.setActionHandler('pause', () => { paused = true; onChange(); });
        navigator.mediaSession?.setActionHandler('play', () => { paused = false; onChange(); });
      } catch {}
      navigator.connection?.addEventListener?.('change', onChange);
    },
    held,
    paused: () => paused,
    /** From inside a person's own input (a tap, a click, a key): WebKit lets each <audio> play only once a gesture has
     * touched it, so the pair not yet given a song is loaded here, and a song the browser refused is tried again. */
    prime() {
      for (const p of players) if (!p.audio.getAttribute('src')) p.audio.load();
      if (retry && target > 0 && !paused) { const p = retry; retry = null; if (p === players[current]) p.audio.play().then(() => session('ambient'), () => { retry = p; }); }
    },
    day(at) { if (!TRACKS.length || !Number.isFinite(at)) return; const key = Math.floor(at / DAY); if (key !== dayKey) { dayKey = key; order = shuffle(key); } },
    level(value, fade) {
      if (!players.length) return;
      if (value === target) return; clearTimeout(timer); const now = ctx.currentTime, was = target; target = value;
      if (value > 0 && was === 0) { if (!players[current].track) { next(); return; } const p = players[current]; p.audio.play().catch(() => { retry = p; }); }
      const p = players[current]; p.gain.gain.cancelScheduledValues(now); p.gain.gain.setValueAtTime(p.gain.gain.value, now); p.gain.gain.linearRampToValueAtTime(value, now + fade);
      if (value === 0) timer = setTimeout(() => { for (const q of players) q.audio.pause(); }, fade * 1000 + 100);
    },
    stats: () => ({ playing: players.some(p => !p.audio.paused), track: players[current]?.track?.id ?? null, held: held(), paused }),
    dispose() { clearTimeout(timer); for (const p of players) { p.audio.pause(); p.audio.removeAttribute('src'); } },
  };
}
