// 환승 러시 소리(설계 6절): 안내 · 길 안내 · 승객 목소리와 차임 · 레일 · 문 · 발소리 · 표지 지남 · 묻는 두 음 · 카드 「삑」 · 도장 「탁」.
// 효과음은 주문 폭주 셋째 가족 규칙: ≤400ms(레일 · 환경음 고리는 예외) · 실패음 없음 · 사인/트라이앵글 · C 펜타토닉 · 넓은 잡음.
// 듣기 재료를 깎지 않는다: 목소리는 대역 제한 · 울림 없이 마른 소리 그대로, 음성 동안 바닥 소리는 물러나고 효과음은 −4dB.
// WORLD 앱 설정 「효과음」 · 「진동」 — world-sound.mjs PREF_KEYS와 같은 열쇠(기본 켜짐)
const pref = (name) => { try { return localStorage.getItem(`synk.world.${name}`) !== 'false'; } catch { return true; } };
// 아이폰 오디오 세션 — world-sound.mjs와 같은 규칙: 안내 음성이 나는 동안만 playback(무음 모드에서도 들린다), 그 밖에는 ambient(무음 스위치를 따른다)
const session = (type) => { try { const s = navigator.audioSession; if (s && s.type !== type) s.type = type; } catch { /* 없음 */ } };
export function haptic(kind = 'ok') {
  if (!pref('haptic')) return;
  try { if (typeof navigator.vibrate === 'function') navigator.vibrate(kind === 'tap' ? [8] : [10]); } catch { /* 진동 없음 */ }
}
export function createSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -5; limiter.knee.value = 3; limiter.ratio.value = 14; limiter.attack.value = 0.002; limiter.release.value = 0.12; limiter.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = 0.78; master.connect(limiter);
  const bed = ctx.createGain(); bed.gain.value = 1; bed.connect(master);
  const FX = pref('sound') ? 0.8 : 0, FX_DUCK = pref('sound') ? 0.5 : 0;
  const fx = ctx.createGain(); fx.gain.value = FX; fx.connect(master);
  const voice = ctx.createGain(); voice.gain.value = 0.92; voice.connect(master);
  const analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.55;
  const buffers = new Map();
  const now = () => ctx.currentTime;
  const gainAt = (v = 0) => { const g = ctx.createGain(); g.gain.setValueAtTime(v, now()); return g; };
  function noiseBuffer(seconds = 2, color = 'white') {
    const b = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  const white = noiseBuffer(2), brown = noiseBuffer(4, 'brown');
  function impulse(seconds, decay) {
    const len = Math.round(ctx.sampleRate * seconds), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  const hallRoom = impulse(1.6, 2.6);

  async function load(name, url) {
    if (buffers.has(name)) return buffers.get(name);
    const res = await fetch(url); if (!res.ok) throw Error('소리를 받지 못했어요: ' + url);
    const b = await ctx.decodeAudioData(await res.arrayBuffer()); buffers.set(name, b); return b;
  }
  let speaking = null;
  /** 목소리 한 줄. 끝까지 들으면 true, 멈추면 false로 풀린다. */
  function speak(name) {
    const b = buffers.get(name); if (!b) return Promise.resolve(false);
    stopVoice();
    const src = ctx.createBufferSource(); src.buffer = b;
    const dry = gainAt(1); src.connect(dry); dry.connect(voice); dry.connect(analyser);
    const t = now() + 0.15;
    session('playback'); api.onVoice?.(true);
    bed.gain.cancelScheduledValues(now()); bed.gain.setTargetAtTime(0.38, now(), 0.05); fx.gain.setTargetAtTime(FX_DUCK, now(), 0.05);
    src.start(t);
    return new Promise((resolve) => {
      const done = (ok) => { if (speaking?.src !== src) return; speaking = null; session('ambient'); api.onVoice?.(false); bed.gain.setTargetAtTime(1, now() + 0.4, 0.2); fx.gain.setTargetAtTime(FX, now() + 0.2, 0.1); resolve(ok); };
      speaking = { src, done };
      src.onended = () => done(true);
    });
  }
  function stopVoice() { if (!speaking) return; const s = speaking; try { s.src.onended = null; s.src.stop(); } catch { /* 이미 멈춤 */ } s.done(false); }
  const bins = new Uint8Array(analyser.frequencyBinCount);
  function voiceLevels() {
    analyser.getByteFrequencyData(bins);
    return [[3, 8], [8, 16], [16, 30], [30, 52], [52, 90]].map(([a, b]) => { let s = 0; for (let i = a; i < b; i++) s += bins[i]; return Math.min(1, s / (b - a) / 170); });
  }
  function tone(freq, t0, dur, { type = 'sine', gain = 0.2, to = fx, attack = 0.006 } = {}) {
    const o = ctx.createOscillator(), g = gainAt(0); o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(to); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function hiss(t0, dur, { from = 2500, toF = 5000, gain = 0.12, q = 0.7, to = fx } = {}) {
    const s = ctx.createBufferSource(); s.buffer = white; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(toF, t0 + dur);
    const g = gainAt(0); g.gain.linearRampToValueAtTime(gain, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f).connect(g).connect(to); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  // 차임: 우리 두 음(E5 → C5) — 실제 운영사 차임과 다른 음정 · 결(설계 4 · 6절)
  function chime() {
    const t = now() + 0.02, verb = ctx.createConvolver(); verb.buffer = hallRoom; const wet = gainAt(0.22); verb.connect(wet).connect(fx);
    for (const [f, d] of [[659.25, 0], [523.25, 0.42]]) { tone(f, t + d, 0.9, { gain: 0.16 }); tone(f * 2, t + d, 0.5, { gain: 0.03 }); tone(f, t + d, 0.9, { gain: 0.06, to: verb }); }
  }
  // 레일: 낮은 우르릉 + 이음매 딸깍-딱(속도에 맞춰 간격)
  let rail = null;
  function railStart() {
    if (rail) return;
    const s = ctx.createBufferSource(); s.buffer = brown; s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 190; const g = gainAt(0); g.gain.linearRampToValueAtTime(0.23, now() + 0.6);
    s.connect(lp).connect(g).connect(bed); s.start();
    const hum = ctx.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 96; const hg = gainAt(0); hg.gain.linearRampToValueAtTime(0.006, now() + 0.6); hum.connect(hg).connect(bed); hum.start();
    rail = { s, g, lp, hum, hg, speed: 1, next: now() + 0.3 };
  }
  function railSpeed(v) { if (!rail) return; rail.speed = v; rail.g.gain.setTargetAtTime(0.04 + 0.19 * v, now(), 0.3); rail.lp.frequency.setTargetAtTime(110 + 120 * v, now(), 0.3); rail.hum.frequency.setTargetAtTime(40 + 70 * v, now(), 0.4); rail.hg.gain.setTargetAtTime(0.006 * v, now(), 0.3); }
  function railTick() {
    if (!rail || rail.speed < 0.04) return;
    while (rail.next < now() + 0.12) {
      const t = rail.next, gap = 0.11 / Math.max(0.25, rail.speed);
      for (const [dt, f, gn] of [[0, 900, 0.055], [gap, 700, 0.07]]) {
        const s = ctx.createBufferSource(); s.buffer = white; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.4;
        const g = gainAt(0); g.gain.linearRampToValueAtTime(gn * (0.5 + 0.5 * rail.speed), t + dt + 0.004); g.gain.exponentialRampToValueAtTime(0.0006, t + dt + 0.07);
        s.connect(bp).connect(g).connect(bed); s.start(t + dt, Math.random()); s.stop(t + dt + 0.1);
      }
      rail.next += 0.62 / Math.max(0.18, rail.speed);
    }
  }
  function railStop() { if (!rail) return; const r = rail; rail = null; r.g.gain.setTargetAtTime(0, now(), 0.4); r.hg.gain.setTargetAtTime(0, now(), 0.3); setTimeout(() => { try { r.s.stop(); r.hum.stop(); } catch { /* 이미 멈춤 */ } }, 2500); }
  let hall = null;
  function hallStart() {
    if (hall) return;
    const s = ctx.createBufferSource(); s.buffer = brown; s.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.5;
    const g = gainAt(0); g.gain.linearRampToValueAtTime(0.09, now() + 0.8); s.connect(bp).connect(g).connect(bed); s.start(0, 1.3); hall = { s, g };
  }
  function hallStop() { if (!hall) return; const h = hall; hall = null; h.g.gain.setTargetAtTime(0, now(), 0.3); setTimeout(() => { try { h.s.stop(); } catch { /* 이미 멈춤 */ } }, 2000); }

  const sfx = {
    doorOpen() { const t = now(); tone(783.99, t, 0.32, { type: 'triangle', gain: 0.07 }); tone(587.33, t + 0.16, 0.36, { type: 'triangle', gain: 0.06 }); hiss(t + 0.05, 0.38, { from: 4200, toF: 1800, gain: 0.11 }); hiss(t + 0.2, 0.35, { from: 700, toF: 300, gain: 0.08, q: 0.5 }); },
    doorClose() { const t = now(); hiss(t, 0.34, { from: 900, toF: 2600, gain: 0.08, q: 0.5 }); tone(196, t + 0.3, 0.12, { type: 'triangle', gain: 0.1 }); },
    step(side = 1) { const t = now(); const s = ctx.createBufferSource(); s.buffer = white; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700 + Math.random() * 500; bp.Q.value = 1.1; const p = ctx.createStereoPanner(); p.pan.value = 0.12 * side; const g = gainAt(0); g.gain.linearRampToValueAtTime(0.06, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0006, t + 0.06); s.connect(bp).connect(g).connect(p).connect(fx); s.start(t, Math.random()); s.stop(t + 0.08); tone(92 + Math.random() * 10, t, 0.09, { gain: 0.09 }); },
    swish(dir = 1) { const t = now(); const s = ctx.createBufferSource(); s.buffer = white; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.18); const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.4 * dir, t); p.pan.linearRampToValueAtTime(0.4 * dir, t + 0.18); const g = gainAt(0); g.gain.linearRampToValueAtTime(0.09, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0006, t + 0.22); s.connect(bp).connect(g).connect(p).connect(fx); s.start(t, Math.random()); s.stop(t + 0.25); },
    pass() { const t = now(); tone(783.99, t, 0.28, { type: 'triangle', gain: 0.13 }); tone(1046.5, t + 0.07, 0.34, { gain: 0.12 }); },
    ask() { const t = now(); tone(392, t, 0.2, { type: 'triangle', gain: 0.12 }); tone(440, t + 0.16, 0.26, { type: 'triangle', gain: 0.12 }); },
    streak() { const t = now(); [783.99, 880, 1046.5].forEach((f, i) => tone(f, t + i * 0.07, 0.26, { type: 'triangle', gain: 0.1 })); },
    tick() { tone(2093, now(), 0.03, { gain: 0.04 }); },
    gate() { const t = now(); tone(1568, t, 0.16, { gain: 0.14, attack: 0.003 }); hiss(t + 0.12, 0.3, { from: 1200, toF: 600, gain: 0.05 }); },
    whoosh() { hiss(now(), 0.4, { from: 400, toF: 2400, gain: 0.08, q: 0.4 }); },
    stamp() { const t = now(); tone(146.83, t, 0.1, { gain: 0.22, attack: 0.002 }); hiss(t, 0.05, { from: 1600, toF: 700, gain: 0.1, q: 0.6 }); },
    tap() { tone(1174.66, now(), 0.06, { gain: 0.05 }); },
    gift() { const t = now(); [1046.5, 1318.51].forEach((f, i) => tone(f, t + i * 0.09, 0.22, { type: 'triangle', gain: 0.08 })); },
  };

  const api = {
    ctx, output: master, limiter, onVoice: null, load, speak, stopVoice, chime, voiceLevels, sfx, railStart, railSpeed, railTick, railStop, hallStart, hallStop,
    resume: () => ctx.state === 'suspended' ? ctx.resume() : Promise.resolve(),
    suspend: () => ctx.state === 'running' ? ctx.suspend() : Promise.resolve(),
  };
  return api;
}
