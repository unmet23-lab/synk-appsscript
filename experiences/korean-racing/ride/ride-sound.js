// MT 바닷가 자전거 레이스(WORLD 판)의 소리(2026-11-04, 설계 qa/world-mt-20261104/설계.md 5절). 파일 없이 Web Audio로 그 자리에서 만든다.
// 환경 층(바람 · 바퀴 구름 · 프리휠 · 체인 · 파도)은 속도를 계속 따르고, 사건 소리(정답 · 오답 · 추월 벨 · 접촉 · 브레이크 · 기어)는
// 브랜드 사운드킷 「게임 효과음」 규칙을 따른다: ① 400ms 이하 ② 실패음 없음(내려가는 버저 금지) ③ 음 층은 사인 · 트라이앵글 ④ C 펜타토닉.
// 잡음 층은 넓은 대역만 쓴다(좁은 대역은 무전 잡음, 08-28 귀 검수). LAB 화면은 이 파일을 불러오지 않는다.

const N = { G2: 98, C3: 130.81, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093, D7: 2349.32, E7: 2637.02 };
/** 맞힐 때마다 오르는 계단(연속 10번째부터 같은 음). */
export const PENTA = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6, N.G6, N.A6];
export const comboNote = (combo) => PENTA[Math.min(PENTA.length - 1, Math.max(0, Math.floor(combo) - 1))];

/** 사건 소리 표(시험이 규칙을 잰다): 길이(초)와 음 층의 음높이. */
export const EVENTS = Object.freeze({
  correct: { seconds: .36, pitches: (combo = 1) => [comboNote(combo), comboNote(combo + 1)] },
  wrong: { seconds: .3, pitches: () => [N.G4, N.A4] },   // 묻는 두 음(오른다)
  bell: { seconds: .38, pitches: () => [N.G6, N.C7, N.E7] },
  bump: { seconds: .22, pitches: () => [N.C3, N.G2] },
  brake: { seconds: .26, pitches: () => [] },
  gear: { seconds: .07, pitches: () => [] },
  whoosh: { seconds: .36, pitches: () => [] },
});

const WHEEL_CIRCUMFERENCE = 2 * Math.PI * .345, FREEWHEEL_CLICKS = 18, METERS_PER_CRANK = 7;
/** 바퀴 초당 회전 · 프리휠 딸깍 수 · 크랭크 초당 회전(시험 · 소리 · 3D가 같은 값을 쓴다). */
export function rideRates(speed) {
  const wheel = Math.max(0, speed) / WHEEL_CIRCUMFERENCE;
  return { wheel, clicks: wheel * FREEWHEEL_CLICKS, crank: Math.max(0, speed) / METERS_PER_CRANK };
}
/** 환경 층 크기(0~1 무렵). 시험 · 시청 페이지도 이 식을 쓴다. speed m/s, boost 0/1, narrating 음성 중. */
export function rideMix({ speed = 0, boosting = false, pedaling = false, narrating = false, slope = 0 } = {}) {
  const v = Math.max(0, speed), t = Math.min(1, v / 18), duck = narrating ? .3 : 1, down = Math.max(0, Math.min(1, -slope / .1));
  return {
    wind: Math.min(1.1, (.03 + t * t * .58 + down * .07) * (boosting ? 1.5 : 1)) * duck,
    windCut: 400 + v * 90 * (boosting ? 1.4 : 1) + down * 300,
    roll: Math.min(.7, t * .5) * duck,
    freewheel: pedaling || v < .25 ? 0 : (.1 + t * .06) * (narrating ? .4 : 1),
    chain: pedaling && v > .4 ? .11 * duck : 0,
    waves: narrating ? .03 : .05,
  };
}

function noiseBuffer(ctx, seconds, kind, seed = 1) {
  let s = seed >>> 0 || 1; const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; };
  const n = Math.floor(ctx.sampleRate * seconds), buffer = ctx.createBuffer(1, n, ctx.sampleRate), d = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, brown = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd();
    if (kind === 'brown') { brown = (brown + .02 * w) / 1.02; d[i] = brown * 3.2; }
    else { b0 = .997 * b0 + w * .03; b1 = .96 * b1 + w * .11; b2 = .75 * b2 + w * .25; d[i] = (b0 + b1 + b2) * .55; }   // 분홍에 가까운 결
  }
  // 고리 이음매를 부드럽게.
  const fade = Math.min(2048, n >> 2); for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[n - fade + i] * (1 - k); }
  return buffer;
}
/** 1초 고리에 짧은 딸깍을 count번(재생 속도를 바퀴 회전수로 두면 초당 count × 회전수). 프리휠 · 체인에 쓴다. */
function clickLoop(ctx, count, { bright = 1, width = .0016, seed = 7 } = {}) {
  const n = ctx.sampleRate, buffer = ctx.createBuffer(1, n, ctx.sampleRate), d = buffer.getChannelData(0);
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let c = 0; c < count; c++) {
    const at = Math.floor(((c + (rnd() - .5) * .12) / count) * n), len = Math.floor(width * n), amp = .8 + rnd() * .2;
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd() * 2 - 1, hp = w - prev * (1 - bright * .6); prev = w;   // 거친 고역 통과
      d[(at + i + n) % n] += hp * amp * Math.exp(-i / (len * .3));
    }
  }
  return buffer;
}

/**
 * 소리 장치. ctx는 게임의 AudioContext(첫 탭 뒤 열린 것).
 * update({ speed, boosting, pedaling, narrating, slope })를 매 프레임, 사건은 correct(combo) · wrong() · bell() · bump() · brake() · gear()로.
 * quiet()는 멈춤 · 화면 벗어남. 음악(해안선)은 race-controller의 coastRadio가 맡는다(rig.music).
 */
export function createRideSound(ctx, { destination = ctx.destination } = {}) {
  const out = ctx.createGain(); out.gain.value = 1; out.connect(destination);
  const smooth = (param, value, tau = .12) => param.setTargetAtTime(value, ctx.currentTime, tau);
  const loop = (buffer, rate = 1) => { const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true; src.playbackRate.value = rate; src.start(); return src; };
  const gain = (value = 0) => { const g = ctx.createGain(); g.gain.value = value; return g; };
  const filter = (type, freq, q = .7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  // 바람: 잡음 둘을 좌우로 벌린다.
  const windGain = gain(), windCut = filter('lowpass', 500, .5), windHigh = filter('highpass', 120, .5);
  const merger = ctx.createChannelMerger(2);
  const pink = noiseBuffer(ctx, 3.1, 'pink', 11), pink2 = noiseBuffer(ctx, 2.7, 'pink', 29);
  loop(pink).connect(merger, 0, 0); loop(pink2).connect(merger, 0, 1);
  const windGust = gain(1);
  merger.connect(windHigh); windHigh.connect(windCut); windCut.connect(windGain); windGain.connect(windGust); windGust.connect(out);
  // 돌풍: 아주 느리게 크기를 흔든다. 뒤 칸에 곱해서 흔든다 — 크기 값(windGain.gain)에 바로 이으면 더해져서 quiet() 뒤에도 바람이 남는다.
  const gust = ctx.createOscillator(), gustDepth = gain(.3); gust.frequency.value = .2; gust.connect(gustDepth); gustDepth.connect(windGust.gain); gust.start();
  // 바퀴 구름: 갈색 잡음의 넓은 대역.
  const rollGain = gain(), rollLow = filter('lowpass', 900, .5), rollHigh = filter('highpass', 90, .5);
  loop(noiseBuffer(ctx, 2.3, 'brown', 41)).connect(rollHigh); rollHigh.connect(rollLow); rollLow.connect(rollGain); rollGain.connect(out);
  // 프리휠: 재생 속도 = 바퀴 초당 회전수. 멈출수록 딸깍 사이가 벌어진다.
  const free = loop(clickLoop(ctx, FREEWHEEL_CLICKS, { bright: 1 }), .001), freeGain = gain(), freeHigh = filter('highpass', 1800, .6);
  free.connect(freeHigh); freeHigh.connect(freeGain); freeGain.connect(out);
  // 체인: 한 바퀴에 둘, 낮고 부드럽게.
  const chain = loop(clickLoop(ctx, 2, { bright: .25, width: .05, seed: 13 }), .001), chainGain = gain(), chainLow = filter('lowpass', 1400, .5);
  chain.connect(chainLow); chainLow.connect(chainGain); chainGain.connect(out);
  // 파도: 낮은 잡음이 6~9초로 밀려왔다 빠진다.
  const waveGain = gain(), waveSwell = gain(1), waveLow = filter('lowpass', 520, .5), swell = ctx.createOscillator(), swellDepth = gain(.32);
  swell.frequency.value = .13; swell.connect(swellDepth); swellDepth.connect(waveSwell.gain); swell.start();
  loop(noiseBuffer(ctx, 3.7, 'pink', 53)).connect(waveLow); waveLow.connect(waveGain); waveGain.connect(waveSwell); waveSwell.connect(out);

  let quietNow = false, last = { speed: 0, narrating: false };
  function update({ speed = 0, boosting = false, pedaling = false, narrating = false, slope = 0 } = {}) {
    quietNow = false; last = { speed, narrating };
    const mix = rideMix({ speed, boosting, pedaling, narrating, slope }), rates = rideRates(speed);
    smooth(windGain.gain, mix.wind, .18); smooth(windCut.frequency, mix.windCut, .2); smooth(rollGain.gain, mix.roll, .12);
    smooth(freeGain.gain, mix.freewheel, .05); free.playbackRate.setTargetAtTime(Math.max(.001, rates.wheel), ctx.currentTime, .08);
    smooth(chainGain.gain, mix.chain, .1); chain.playbackRate.setTargetAtTime(Math.max(.001, rates.crank), ctx.currentTime, .1);
    smooth(waveGain.gain, mix.waves, .4);
  }
  function quiet() { quietNow = true; for (const g of [windGain, rollGain, freeGain, chainGain, waveGain]) smooth(g.gain, 0, .08); }

  /* ── 사건 소리 ── */
  const duck = () => (last.narrating ? .63 : 1);   // 음성 중에는 −4dB
  function tone(freq, at, { type = 'sine', level = .1, attack = .006, decay = .2, glideTo = null } = {}) {
    const o = ctx.createOscillator(), g = gain(0); o.type = type; o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + decay * .8);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level * duck(), at + attack); g.gain.exponentialRampToValueAtTime(.0008, at + decay);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + decay + .02); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  const burst = noiseBuffer(ctx, .5, 'pink', 71);
  function noise(at, { low = 6000, high = 800, level = .1, attack = .004, decay = .12, sweep = null } = {}) {
    const src = ctx.createBufferSource(), g = gain(0), lp = filter('lowpass', low, .5), hp = filter('highpass', high, .5);
    src.buffer = burst; src.loop = true;
    if (sweep) lp.frequency.exponentialRampToValueAtTime(sweep, at + decay * .75);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level * duck(), at + attack); g.gain.exponentialRampToValueAtTime(.0008, at + decay);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); src.start(at); src.stop(at + decay + .02);
    src.onended = () => { src.disconnect(); hp.disconnect(); lp.disconnect(); g.disconnect(); };
  }
  const now = () => ctx.currentTime + .002;
  function gear(at = now()) { noise(at, { low: 7000, high: 2200, level: .1, decay: .018 }); noise(at + .035, { low: 5000, high: 1500, level: .13, decay: .022 }); }
  function whoosh(at = now()) { noise(at, { low: 500, high: 200, sweep: 5200, level: .15, attack: .1, decay: EVENTS.whoosh.seconds }); }
  function correct(combo = 1) {
    const at = now(), [a, b] = EVENTS.correct.pitches(combo);
    tone(a, at, { type: 'triangle', level: .11, decay: .2 }); tone(b, at + .075, { level: .1, decay: .26 });
    gear(at + .08); whoosh(at + .12);
  }
  function wrong() { const at = now(), [a, b] = EVENTS.wrong.pitches(); tone(a, at, { type: 'triangle', level: .07, decay: .14 }); tone(b, at + .11, { type: 'triangle', level: .07, decay: .18 }); }
  function bell() {
    const at = now();
    for (const t of [0, .15]) { const [p, q, r] = EVENTS.bell.pitches(); tone(p, at + t, { level: .075, attack: .002, decay: .22 }); tone(q, at + t, { level: .05, attack: .002, decay: .18 }); tone(r, at + t, { level: .024, attack: .002, decay: .12 }); }
  }
  function bump() { const at = now(), [a, b] = EVENTS.bump.pitches(); tone(a, at, { level: .17, attack: .003, decay: .16, glideTo: b }); noise(at, { low: 2400, high: 300, level: .08, decay: .05 }); tone(N.E7, at + .03, { level: .012, attack: .002, decay: .1 }); }
  function brake() { noise(now(), { low: 6000, high: 2000, level: .03, attack: .03, decay: EVENTS.brake.seconds }); }
  /** 결마다 바퀴 소리: 크루저는 굵은 타이어라 낮고, 하이브리드는 얇아 높다. */
  function setStyle(style) { rollLow.frequency.value = style === 'hybrid' ? 1500 : 900; rollHigh.frequency.value = style === 'hybrid' ? 170 : 90; }
  return { update, quiet, setStyle, correct, wrong, bell, bump, brake, gear, whoosh, get quietNow() { return quietNow; } };
}
