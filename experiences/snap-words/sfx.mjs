// 찰칵 낱말 — 효과음 · 바탕 소리(설계 6절). 파일 없이 Web Audio로 그 자리에서 만든다. 만드는 법과 규칙은 주문 폭주 world-sfx.mjs와 같은 사운드킷 셋째 가족:
//   ① 한 소리는 400ms 이하  ② 실패음이 없다 — 다르게 찍어도 내려가는 음 없이 낮은 한 음  ③ 음이 있는 층은 사인 · 트라이앵글
//   ④ 음높이는 C 펜타토닉(도 · 레 · 미 · 솔 · 라), 몸통은 C4 이상(폰 스피커)  ⑤ 잡음 층은 짧고 넓은 대역만. sfx.test.mjs가 시험한다.
export const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760 };
export const LADDER = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6];

function mulberry(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** 부드러운 리미터 곡선: −3dBFS(0.7)까지는 그대로, 그 위는 곡선으로 눌러 0.93을 넘지 않는다(겹칠 때만 일한다). 주문 폭주 world-sfx.mjs와 같다. */
export function softLimit(x) {
  const a = Math.abs(x), k = 0.7, top = 0.93;
  if (a <= k) return x;
  return Math.sign(x) * (k + (top - k) * Math.tanh((a - k) / (top - k)));
}
/** 소리 길의 끝: 효과음 · 낱말 소리가 함께 지나는 리미터. */
export function createLimiter(c, destination = c.destination) {
  const half = c.createGain(); half.gain.value = 0.5;
  const limit = c.createWaveShaper(), curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i += 1) { const x = (i / 512 - 1) * 2; curve[i] = softLimit(x) / 2; }
  limit.curve = curve;
  const back = c.createGain(); back.gain.value = 2;
  half.connect(limit); limit.connect(back); back.connect(destination);
  return half;
}
export function createBus(c, { seed = 11, destination = c.destination } = {}) {
  const rand = mulberry(seed), out = c.createGain();
  out.connect(destination);
  const length = Math.floor(c.sampleRate);
  const noise = c.createBuffer(1, length, c.sampleRate), data = noise.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = rand() * 2 - 1;
  return { c, out, rand, noise };
}
function tone(b, { type = 'sine', f, f2 = 0, glide = 0.05, t, peak, att = 0.003, dec = 0.1, dest = b.out }) {
  const { c } = b, o = c.createOscillator(), g = c.createGain();
  g.gain.value = 0;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + glide);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + att + dec + 0.01);
  return att + dec + 0.01;
}
function burst(b, { t, peak, att = 0.002, dec = 0.04, filters = [], dest = b.out }) {
  const { c } = b, src = c.createBufferSource(), g = c.createGain();
  g.gain.value = 0; src.buffer = b.noise;
  let node = src;
  for (const [type, f, q = 0.7, f2 = 0, dur = 0] of filters) {
    const fl = c.createBiquadFilter();
    fl.type = type; fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    fl.Q.value = type === 'bandpass' ? Math.min(q, 0.9) : q;
    node.connect(fl); node = fl;
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  node.connect(g); g.connect(dest);
  const len = att + dec + 0.01;
  src.start(t, b.rand() * 0.5, len); src.stop(t + len);
  return len;
}
const wood = (b, t, f, v = 1, dec = 0.26) => Math.max(tone(b, { f, t, peak: 0.11 * v, att: 0.002, dec }), tone(b, { f: f * 4, t, peak: 0.02 * v, att: 0.001, dec: 0.05 }), burst(b, { t, peak: 0.12 * v, att: 0.0008, dec: 0.008, filters: [['bandpass', 2400, 0.8]] }));
const chime = (b, t, f, v = 1, dec = 0.3) => Math.max(tone(b, { f, t, peak: 0.07 * v, att: 0.002, dec }), tone(b, { f: f * 2, t, peak: 0.018 * v, att: 0.001, dec: dec * 0.45 }));

/** 소리 이름 → 만드는 법. 끝나는 상대 시각을 돌려준다. */
export const SOUNDS = Object.freeze({
  // 초점: 옛 카메라의 AF 「삑삑」
  focus: (b, t) => Math.max(tone(b, { f: N.E6, t, peak: 0.04, att: 0.002, dec: 0.035 }), 0.06 + tone(b, { f: N.E6, t: t + 0.06, peak: 0.05, att: 0.002, dec: 0.04 })),
  // 렌즈 다가감: 아주 작은 모터
  lens: (b, t) => burst(b, { t, peak: 0.022, att: 0.04, dec: 0.2, filters: [['bandpass', 900, 0.8, 1500, 0.22]] }),
  // 셔터: 앞막 딸깍 · 몸통 · 뒷막 딸깍 · 필름 감김 셋
  shutter: (b, t) => {
    const ends = [
      burst(b, { t, peak: 0.42, att: 0.001, dec: 0.012, filters: [['highpass', 3000]] }),
      tone(b, { f: N.G4, f2: N.C4, glide: 0.05, t, peak: 0.17, att: 0.001, dec: 0.06 }),
      0.05 + burst(b, { t: t + 0.05, peak: 0.26, att: 0.001, dec: 0.018, filters: [['bandpass', 1800, 0.8]] }),
      0.09 + burst(b, { t: t + 0.09, peak: 0.3, att: 0.001, dec: 0.012, filters: [['highpass', 2400]] }),
    ];
    for (const [i, dt] of [0.16, 0.205, 0.25].entries()) ends.push(dt + burst(b, { t: t + dt, peak: 0.09 + i * 0.012, att: 0.001, dec: 0.014, filters: [['bandpass', 1300 + i * 240, 0.8]] }));
    return Math.max(...ends);
  },
  // 사진이 앨범에 꽂힘: 종이 + 판마다 한 칸 위(새 낱말일 때만 음이 난다 — opts.note)
  card: (b, t, { step = 0, quiet = false } = {}) => {
    const a = burst(b, { t, peak: quiet ? 0.1 : 0.2, att: 0.001, dec: 0.03, filters: [['bandpass', 2600, 0.8]] });
    return quiet ? a : Math.max(a, wood(b, t + 0.01, LADDER[Math.min(LADDER.length - 1, Math.max(0, step))], 0.9));
  },
  // 메시지 옴
  message: (b, t) => Math.max(chime(b, t, N.G5, 0.8, 0.14), 0.08 + chime(b, t + 0.08, N.C6, 0.9, 0.2)),
  // 부탁 맞음: 보내는 소리 + 세 음
  right: (b, t) => Math.max(burst(b, { t, peak: 0.1, att: 0.02, dec: 0.12, filters: [['bandpass', 1200, 0.8, 3200, 0.14]] }), 0.09 + wood(b, t + 0.09, N.C5), 0.16 + wood(b, t + 0.16, N.E5, 1, 0.2), 0.23 + wood(b, t + 0.23, N.G5, 1.1, 0.15)),
  // 부탁 다름: 낮은 「톡」 한 음 — 내려가는 음 없음
  other: (b, t) => tone(b, { type: 'triangle', f: N.A4, t, peak: 0.07, att: 0.002, dec: 0.08 }),
  // 초점 없이 셔터: 아주 작은 딸깍(소리로 꾸짖지 않는다)
  nope: (b, t) => burst(b, { t, peak: 0.06, att: 0.001, dec: 0.012, filters: [['highpass', 1800]] }),
  // 인화지가 나옴
  print: (b, t) => {
    const ends = [burst(b, { t, peak: 0.08, att: 0.03, dec: 0.32, filters: [['bandpass', 1100, 0.8, 2600, 0.34]] })];
    for (let i = 0; i < 6; i += 1) ends.push(0.03 + i * 0.05 + burst(b, { t: t + 0.03 + i * 0.05, peak: 0.03, att: 0.001, dec: 0.008, filters: [['highpass', 3000]] }));
    return Math.max(...ends);
  },
  // 손글씨로 이름이 써짐 + 한 음
  name: (b, t, { step = 0 } = {}) => {
    const ends = [];
    for (const [i, dt] of [0, 0.05, 0.11, 0.16].entries()) ends.push(dt + burst(b, { t: t + dt, peak: 0.055 + (i % 2) * 0.012, att: 0.003, dec: 0.03, filters: [['bandpass', 4200 - i * 300, 0.8]] }));
    ends.push(0.2 + chime(b, t + 0.2, LADDER[Math.min(LADDER.length - 1, Math.max(0, step))], 0.9, 0.17));
    return Math.max(...ends);
  },
  // 고른 답이 달랐음: 낮은 한 음
  soft: (b, t) => tone(b, { f: N.D5, t, peak: 0.045, att: 0.004, dec: 0.12 }),
  // 장소 도장
  stamp: (b, t) => Math.max(burst(b, { t, peak: 0.45, att: 0.001, dec: 0.05, filters: [['lowpass', 700]] }), wood(b, t, N.C4, 1.4, 0.1), ...[N.C5, N.E5, N.G5, N.C6].map((f, i) => 0.07 + i * 0.03 + chime(b, t + 0.07 + i * 0.03, f, 0.75, 0.2))),
  // 조리개 열림
  iris: (b, t) => Math.max(burst(b, { t, peak: 0.07, att: 0.03, dec: 0.18, filters: [['bandpass', 1400, 0.8, 3000, 0.2]] }), burst(b, { t, peak: 0.1, att: 0.001, dec: 0.012, filters: [['highpass', 2600]] })),
  // 단추 누름
  tap: (b, t) => burst(b, { t, peak: 0.08, att: 0.001, dec: 0.012, filters: [['bandpass', 2200, 0.8]] }),
  // 학교 고양이(합성 — 쓰다듬는 뜻밖의 즐거움. 사운드킷 규칙 밖이지만 길이는 지킨다)
  meow: (b, t) => {
    const { c } = b, o = c.createOscillator(), o2 = c.createOscillator(), f1 = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'triangle';
    for (const [osc, mul] of [[o, 1], [o2, 2]]) { osc.frequency.setValueAtTime(620 * mul, t); osc.frequency.exponentialRampToValueAtTime(980 * mul, t + 0.12); osc.frequency.exponentialRampToValueAtTime(560 * mul, t + 0.36); }
    f1.type = 'bandpass'; f1.Q.value = 2.2; f1.frequency.setValueAtTime(1000, t); f1.frequency.exponentialRampToValueAtTime(2100, t + 0.12); f1.frequency.exponentialRampToValueAtTime(900, t + 0.36);
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.05); g.gain.setValueAtTime(0.13, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(f1); o2.connect(f1); f1.connect(g); g.connect(b.out);
    o.start(t); o2.start(t); o.stop(t + 0.39); o2.stop(t + 0.39);
    return 0.39;
  },
});

/**
 * 소리마다 크기(11-04 오프라인 렌더로 400ms 평균을 재어 맞춤): 보통 알림 −28 · 획득 −27 · 성취 −23 · 도장 −22dB 안팎, 셔터는 봉우리 −2dB 아래.
 * 고양이만 합성이라 그대로 두고 살짝 낮춘다. 낱말 소리(−17 LUFS 안팎)보다 늘 아래다.
 */
export const LEVEL = Object.freeze({ card: 2.85, focus: 3.9, iris: 4.2, lens: 5, meow: 0.9, message: 3.55, name: 4.6, nope: 4.7, other: 5, print: 6.2, right: 2.54, shutter: 1.7, soft: 4.4, stamp: 3.6, tap: 8 });
export function renderSfx(bus, name, t, opts) {
  const make = SOUNDS[name]; if (!make) return 0;
  const g = bus.c.createGain(); g.gain.value = LEVEL[name] ?? 1; g.connect(bus.out);
  return make({ ...bus, out: g }, t, opts);
}

/**
 * 바탕 소리: 장소마다 아주 낮은 환경음. 정문 = 바람 + 먼 새, 학생회관 = 넓은 실내의 낮은 웅성임. 낱말 소리 동안은 물러난다(duck).
 * 파일 없이 만들어 받는 양이 없다. 움직임이 없을 때만 시작한다(오디오 문맥을 깨우는 멈춤을 전환과 겹치지 않게 — 주문 폭주 11-03).
 */
export function createAmbience(c, kind, { destination = c.destination, level = 1 } = {}) {
  const rand = mulberry(29), master = c.createGain(), nodes = [];
  master.gain.value = 0; master.connect(destination);
  const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = rand() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'indoor' ? 520 : 780;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = kind === 'indoor' ? 90 : 160;
  const body = c.createGain(); body.gain.value = kind === 'indoor' ? 0.06 : 0.05;
  src.connect(hp); hp.connect(lp); lp.connect(body); body.connect(master);
  const lfo = c.createOscillator(), lfoGain = c.createGain(); lfo.frequency.value = kind === 'indoor' ? 0.09 : 0.13; lfoGain.gain.value = kind === 'indoor' ? 0.012 : 0.022;
  lfo.connect(lfoGain); lfoGain.connect(body.gain);
  src.start(); lfo.start(); nodes.push(src, lfo);
  let timer = 0, stopped = false;
  const bird = () => {
    if (stopped || c.state !== 'running') return;
    const t = c.currentTime + 0.02, n = 2 + Math.floor(rand() * 3), base = [N.E6, N.G6, N.A6][Math.floor(rand() * 3)], pan = c.createStereoPanner?.();
    const g = c.createGain(); g.gain.value = 0.012 + rand() * 0.01;
    if (pan) { pan.pan.value = rand() * 1.6 - 0.8; g.connect(pan); pan.connect(master); } else g.connect(master);
    for (let i = 0; i < n; i += 1) {
      const o = c.createOscillator(), e = c.createGain(), at = t + i * (0.1 + rand() * 0.05);
      o.frequency.setValueAtTime(base * 2, at); o.frequency.exponentialRampToValueAtTime(base * (rand() > 0.5 ? 2.5 : 1.7), at + 0.07);
      e.gain.value = 0; e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(1, at + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
      o.connect(e); e.connect(g); o.start(at); o.stop(at + 0.09);
    }
    timer = setTimeout(bird, 4000 + rand() * 6000);
  };
  const murmur = () => {
    if (stopped || c.state !== 'running') return;
    const bus = { c, out: master, rand, noise: buf };
    burst(bus, { t: c.currentTime + 0.02, peak: 0.018 + rand() * 0.014, att: 0.18, dec: 0.5, filters: [['bandpass', 500 + rand() * 500, 0.8]] });
    timer = setTimeout(murmur, 700 + rand() * 1800);
  };
  let vol = level, ducked = false;
  const apply = (tc = 0.25) => master.gain.setTargetAtTime(vol * (ducked ? 0.16 : 1), c.currentTime, tc);
  return {
    start() { apply(0.6); timer = setTimeout(kind === 'indoor' ? murmur : bird, 1600); },
    stop() { stopped = true; clearTimeout(timer); master.gain.setTargetAtTime(0, c.currentTime, 0.2); setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch { /* 이미 멈춤 */ } } master.disconnect(); }, 900); },
    setVolume(v) { vol = Math.max(0, Math.min(1.5, v)); apply(); },
    duck(on) { ducked = !!on; apply(0.06); },
  };
}
