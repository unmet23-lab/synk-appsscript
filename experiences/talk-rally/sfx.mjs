// 말 랠리 — 탁구 손맛 소리 합성기. 파일 없이 Web Audio로 그 자리에서 만든다(빈칸 베기 sfx.mjs와 같은 길·같은 규칙).
// 게임(audio.mjs)과 확인용 오프라인 렌더(qa/sound.cjs)가 이 파일 하나를 함께 쓴다.
// 브랜드 사운드킷의 셋째 가족 ‘게임 효과음’ 규칙(docs/브랜드_사운드킷/_사운드킷.md)을 지킨다.
//   ① 한 소리는 400ms 이하다.
//   ② 실패음이 없다. 틀린 대답으로 받아쳐도 같은 ‘톡’이 나고 맞힘의 ‘팅’만 빠진다.
//   ③ 음이 있는 층은 사인·트라이앵글만 쓴다.
//   ④ 음높이는 C 펜타토닉(도·레·미·솔·라) 안에 둔다. 미끄럼도 시작음과 끝음이 음계 안이다.
// 잡음 층은 짧고 넓게 쓴다(좁은 대역 잡음은 무전 잡음처럼 들린다).

/** C 펜타토닉 계단: 도5 레5 미5 솔5 라5 도6 레6 미6 솔6 라6 */
export const PENTA = [523.25, 587.33, 659.26, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
/** 랠리 n번째 맞힘의 음. 계단을 하나씩 오르고 10번째부터는 같은 음이다. */
export const rallyNote = (n) => PENTA[Math.min(PENTA.length - 1, Math.max(0, Math.floor(n) - 1))];
/** 손 빠르기(px/ms)를 휘두르기 세기 0~1로 바꾼다. */
export const swingPower = (speed) => Math.max(0, Math.min(1, (speed - 0.5) / 2.5));

function rng(seed) {   // mulberry32: 오프라인 렌더를 다시 해도 같은 잡음이 나오게
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));

/**
 * 소리별 전체 크기. qa/sound.cjs로 구워 K 가중 순간 음량(BS.1770, 400ms)을 재고 맞춘다(qa/sound-results.json).
 * 기준은 사운드킷 파일(몽글 목소리 -11.6, 성취 -15.6, 획득 -20.8)과 몽글의 말(음성 파일, loudnorm -18).
 * 받아치기 ‘톡’이 주인공이고, 상대 ‘톡’과 탁구대 ‘틱’은 그보다 낮게 둔다.
 */
export const LEVEL = { hit: 2.6, opponent: 2.4, bounce: 4.2, swing: 4.46, star: 4.2 };

/** 소리 길: 소리마다 → out(켜기·끄기) → 부드러운 리미터 → 스피커. 빈칸 베기와 같다. */
export function createBus(c, { seed = 11 } = {}) {
  const rand = rng(seed);
  const out = c.createGain();
  const half = c.createGain(); half.gain.value = 0.5;
  const limit = c.createWaveShaper();
  limit.curve = softLimit(); limit.oversample = 'none';
  out.connect(half).connect(limit).connect(c.destination);
  const verb = c.createConvolver();
  verb.buffer = roomTail(c, rand);
  const wet = c.createGain(); wet.gain.value = 0.2;
  verb.connect(wet).connect(out);
  return { c, out, verb, rand, white: noiseBuffer(c, rand, false), pink: noiseBuffer(c, rand, true) };
}

/** 부드러운 리미터 곡선(빈칸 베기와 같은 값). */
export function softLimit(knee = 0.7, top = 0.93, n = 4097) {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = 2 * ((i / (n - 1)) * 2 - 1), m = Math.abs(u);
    curve[i] = Math.sign(u) * (m <= knee ? m : knee + (top - knee) * Math.tanh((m - knee) / (top - knee)));
  }
  return curve;
}

function noiseBuffer(c, rand, pink) {
  const n = Math.round(c.sampleRate * 1.2), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, peak = 1e-9;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    if (!pink) { d[i] = w; continue; }
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    peak = Math.max(peak, Math.abs(d[i]));
  }
  if (pink) for (let i = 0; i < n; i++) d[i] /= peak;
  return buf;
}
function roomTail(c, rand) {
  const n = Math.round(c.sampleRate * 0.35), buf = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / n, 3) * Math.min(1, i / 64);
  }
  return buf;
}
function place(b, level, x = 0, to = x, t = 0, dur = 0) {
  const c = b.c, g = c.createGain();
  g.gain.value = level;
  if (!c.createStereoPanner) { g.connect(b.out); return g; }
  const p = c.createStereoPanner();
  p.pan.setValueAtTime(clamp(x), t);
  if (to !== x) p.pan.linearRampToValueAtTime(clamp(to), t + dur);
  g.connect(p).connect(b.out);
  return g;
}
function env(b, t, attack, peak, decay) {
  const g = b.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}
function tone(b, type, t, f0, f1, glide, end) {
  const o = b.c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
  o.start(t); o.stop(t + end);
  return o;
}
function hiss(b, t, dur, pink = true) {
  const s = b.c.createBufferSource();
  s.buffer = pink ? b.pink : b.white;
  s.start(t, b.rand() * (s.buffer.duration - dur - 0.02), dur);
  return s;
}
function filter(b, type, f, q = 0.7) {
  const n = b.c.createBiquadFilter();
  n.type = type; n.frequency.value = f; n.Q.value = q;
  return n;
}
function ring(b, t, f, level, decay, dest) {
  for (const [type, mul, lv] of [['triangle', 1, 1], ['sine', 2, 0.3]]) {
    const g = env(b, t, 0.004, level * lv, decay);
    tone(b, type, t, f * mul, 0, 0, 0.004 + decay + 0.02).connect(g);
    g.connect(dest); g.connect(b.verb);
  }
}
/** 라켓에 공이 맞는 ‘톡’: 닿는 순간 잡음 한 톨 + 나무 몸통(솔5→미5)과 고무 위층(미6→레6). power가 클수록 크고 밝다. */
function tock(b, t, power, dest) {
  const p = clamp(power, 0, 1);
  // 세 층의 꼭대기가 한순간에 겹치지 않게 잡음은 작게, 몸통·위층은 2~3ms에 걸쳐 올린다(틀림의 꼭대기 -1.2 → -1.9dBFS 실측, 빈칸 베기의 가장 큰 베기와 같은 정도)
  hiss(b, t, 0.02, false).connect(filter(b, 'highpass', 2600, 0.6)).connect(env(b, t, 0.0006, 0.08 + 0.06 * p, 0.009)).connect(dest);
  tone(b, 'triangle', t + 0.0008, 783.99, 659.26, 0.04, 0.075).connect(env(b, t + 0.0008, 0.0028, 0.22 + 0.1 * p, 0.065)).connect(dest);
  tone(b, 'sine', t + 0.0005, 1318.51, 1174.66, 0.03, 0.05).connect(env(b, t + 0.0005, 0.002, 0.08 + 0.06 * p, 0.04)).connect(dest);
}

/** 소리 모음. 모두 (버스, 시작 시각, 설정)을 받고, 소리가 끝나는 시각(시작에서 몇 초)을 돌려준다. */
export const VOICES = {
  /**
   * 받아치기: 내 라켓이 공을 친 순간. 맞는 대답 쪽이면 랠리 계단의 ‘팅’을 얹고, 스매시면 낮은 ‘쿵’과 두 칸 위 음까지.
   * 틀린 대답 쪽으로 쳐도 같은 ‘톡’이 난다(실패음 없음). x: 공이 가는 자리(-1 왼쪽 ~ 1 오른쪽).
   */
  hit(b, t, { correct = true, rally = 1, smash = false, power = 0.6, x = 0 } = {}) {
    const dest = place(b, LEVEL.hit, x * 0.4);
    tock(b, t, smash ? 1 : power, dest);
    if (smash) {
      // 스매시의 무게: 낮은 ‘쿵’(라3→도2)과 넓은 바람 한 번
      tone(b, 'sine', t + 0.003, 220, 65.41, 0.09, 0.16).connect(env(b, t + 0.003, 0.002, 0.24, 0.15)).connect(dest);
      hiss(b, t, 0.12).connect(filter(b, 'highpass', 900, 0.5)).connect(env(b, t, 0.004, 0.2, 0.1)).connect(dest);
    }
    if (!correct) return 0.1;
    ring(b, t + 0.01, rallyNote(rally), 0.34, 0.32, dest);
    if (smash) ring(b, t + 0.035, rallyNote(rally + 2), 0.16, 0.3, dest);
    return 0.36;
  },

  /** 몽글이 친 순간의 ‘톡’. 멀리서 오니 내 받아치기보다 작고, 공이 오는 쪽(x)에 둔다. */
  opponent(b, t, { power = 0.5, x = 0 } = {}) {
    tock(b, t, power, place(b, LEVEL.opponent, x * 0.3));
    return 0.08;
  },

  /** 탁구대에 튀는 ‘틱’: 잡음 한 톨 + 도6 짧게. near가 1이면 내 쪽(조금 크다). */
  bounce(b, t, { x = 0, near = 0 } = {}) {
    const dest = place(b, LEVEL.bounce * (0.75 + 0.25 * clamp(near, 0, 1)), x * 0.4);
    hiss(b, t, 0.015, false).connect(filter(b, 'highpass', 3200, 0.6)).connect(env(b, t, 0.0005, 0.12, 0.006)).connect(dest);
    tone(b, 'sine', t + 0.0005, 1046.5, 0, 0, 0.04).connect(env(b, t + 0.0005, 0.001, 0.12, 0.032)).connect(dest);
    tone(b, 'triangle', t + 0.0005, 523.25, 0, 0, 0.035).connect(env(b, t + 0.0005, 0.001, 0.05, 0.025)).connect(dest);
    return 0.045;
  },

  /** 휘두르기: 대답을 그어 고르거나 라켓이 나갈 때(빈칸 베기의 넓은 바람과 같은 모양). power 0~1, x에서 to로. */
  swing(b, t, { power = 0.6, x = 0, to = x } = {}) {
    const p = clamp(power, 0, 1), dur = 0.24 - 0.07 * p;
    const dest = place(b, LEVEL.swing, x * 0.7, to * 0.7, t, dur);
    const lp = filter(b, 'lowpass', 600, 0.8);
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.exponentialRampToValueAtTime(1800 + 3400 * p, t + dur * 0.42);
    lp.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = b.c.createGain(), lv = 0.12 + 0.2 * p;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lv, t + dur * 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    hiss(b, t, dur + 0.02).connect(filter(b, 'highpass', 320, 0.5)).connect(lp).connect(g).connect(dest);
    return dur + 0.02;
  },

  /** 결과의 별 하나(도6·미6·솔6). */
  star(b, t, { i = 0 } = {}) {
    ring(b, t, [1046.5, 1318.51, 1567.98][i % 3], 0.16, 0.26, place(b, LEVEL.star, (i - 1) * 0.3));
    return 0.3;
  },
};
