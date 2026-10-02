// 빈칸 베기 — 손맛 소리 합성기. 파일 없이 Web Audio로 그 자리에서 만든다.
// 게임(audio.mjs), 소리 시청 페이지(sound-lab.html), 확인용 오프라인 렌더(qa/sound.cjs)가 이 파일 하나를 함께 쓴다.
// 그래서 시청 페이지에서 들은 소리와 게임에서 나는 소리가 갈라지지 않는다(브랜드 사운드킷과 같은 원칙).
//
// 브랜드 사운드킷 규칙(docs/브랜드_사운드킷/_사운드킷.md)을 지킨다.
//   ① 한 소리는 400ms 이하다.
//   ② 실패음이 없다. 틀려도 같은 베는 소리에서 ‘팅’만 빠진다(하강 버저 없음).
//   ③ 음이 있는 층은 사인·트라이앵글만 쓴다.
//   ④ 음높이는 C 펜타토닉(도·레·미·솔·라) 안에 둔다. 미끄럼도 시작음과 끝음이 음계 안이다.
// 바람·펠트 결 같은 잡음 층은 짧고 넓게 쓴다. 좁은 대역의 잡음은 무전 잡음처럼 들린다(08-28 귀 검수).
// 사운드킷의 셋째 가족 ‘게임 효과음’이다(docs/브랜드_사운드킷/_사운드킷.md, 토큰 사운드.게임효과음).
// 2026-10-02 유호님 확정: A 「펠트 사각」(felt), 크기는 아래 LEVEL 그대로(「알맞게」), 손맛은 그대로.
// clean(B · 맑은 사인, 잡음 없음)은 고르지 않은 후보로 시청 페이지에만 남긴다.

/** C 펜타토닉 계단: 도5 레5 미5 솔5 라5 도6 레6 미6 솔6 라6 */
export const PENTA = [523.25, 587.33, 659.26, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
export const VARIANTS = ['felt', 'clean'];
export const VARIANT_LABEL = { felt: 'A · 펠트 사각', clean: 'B · 맑은 사인' };

/** 연속 n번째 맞힘의 음. 계단을 하나씩 오르고 10번째부터는 같은 음이다. */
export function comboNote(combo) {
  return PENTA[Math.min(PENTA.length - 1, Math.max(0, Math.floor(combo) - 1))];
}
/** 손 빠르기(px/ms)를 휘두르기 세기 0~1로 바꾼다. */
export function swingPower(speed) {
  return Math.max(0, Math.min(1, (speed - 0.5) / 2.5));
}

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
 * 소리별 전체 크기. qa/sound.cjs로 구워 K 가중 순간 음량(BS.1770, 400ms)을 재고 맞춘 값이다(qa/sound-results.json).
 * 기준은 사운드킷 파일이다(크기를 바꾸지 않는다): 몽글 목소리 -11.6, 성취 -15.6, 획득(픽) -20.8.
 * 베기가 주인공이다: 맞힘 -17.8(목소리보다 6 낮고 획득보다 3 높게, 꼭대기 -3.3dBFS), 틀림 -23.7,
 * 휘두르기 -23(빠르게)~-29(천천히), 던지기 -26.6, 별 -20.6, 끼워짐 ‘톡’ -28(획득과 겹쳐도 리미터에 거의 안 걸리게).
 */
export const LEVEL = { whoosh: 4.46, slice: 2.23, launch: 2.45, snap: 3.75, star: 4.2 };

/**
 * 소리 길: 소리마다 → out(켜기·끄기) → 부드러운 리미터 → 스피커.
 * 리미터는 -3dBFS(0.7)까지는 손대지 않고, 소리가 겹쳐 그 위로 올라갈 때만 곡선으로 눌러 0.93(-0.6dBFS)을 넘지 않게 한다.
 * 사운드킷 파일은 하나씩이면 최고 -2.9dBFS라 그대로 지나간다(브라우저 압축기는 한계 아래 소리까지 줄여서 쓰지 않는다).
 * 맑은 음(팅·별)만 짧은 방 울림(0.35초)을 조금 섞는다.
 */
export function createBus(c, { seed = 7 } = {}) {
  const rand = rng(seed);
  const out = c.createGain();
  const half = c.createGain(); half.gain.value = 0.5;   // 곡선이 두 배 크기(겹친 소리)까지 받게 반으로 줄여 넣는다
  const limit = c.createWaveShaper();
  limit.curve = softLimit(); limit.oversample = 'none';   // 과표본을 켜면 날카로운 순간음에서 곡선 꼭대기를 넘는다(1.002 실측)
  out.connect(half).connect(limit).connect(c.destination);
  const verb = c.createConvolver();
  verb.buffer = roomTail(c, rand);
  const wet = c.createGain(); wet.gain.value = 0.2;
  verb.connect(wet).connect(out);
  return { c, out, verb, rand, white: noiseBuffer(c, rand, false), pink: noiseBuffer(c, rand, true) };
}

/** 부드러운 리미터 곡선. 들어오는 값(-1~1)은 반으로 줄인 소리라 원래 크기 u는 두 배다. */
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
    // 분홍 잡음(Paul Kellet): 높은 소리가 덜 날카로운 바람결
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

/** 좌우 자리(-1 왼쪽 ~ 1 오른쪽)와 전체 크기. to가 있으면 dur 동안 옮긴다. */
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
/** 크기 곡선: attack 동안 곧게 오르고 decay 동안 지수로 잦아든다(사운드킷과 같은 감쇠 모양). */
function env(b, t, attack, peak, decay) {
  const g = b.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}
/** 음: f0에서 f1로 glide초 동안 미끄러지고 end초에 멈춘다(f1이 없으면 한 음). */
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
/** 맑은 ‘팅’: 트라이앵글 + 한 옥타브 위 사인(정수 배음이라 종소리처럼 들리지 않는다) + 방 울림 조금. */
function ring(b, t, f, level, decay, dest) {
  for (const [type, mul, lv] of [['triangle', 1, 1], ['sine', 2, 0.3]]) {
    const g = env(b, t, 0.004, level * lv, decay);
    tone(b, type, t, f * mul, 0, 0, 0.004 + decay + 0.02).connect(g);
    g.connect(dest); g.connect(b.verb);
  }
}

/** 소리 모음. 모두 (버스, 시작 시각, 설정)을 받고, 소리가 끝나는 시각(시작에서 몇 초)을 돌려준다. */
export const VOICES = {
  /** 휘두르기: 손이 빠르게 지나갈 때 난다(벤 것과 상관없음). power 0~1, x에서 to로(-1 왼쪽 ~ 1 오른쪽). */
  whoosh(b, t, { power = 0.6, x = 0, to = x, variant = 'felt' } = {}) {
    const p = clamp(power, 0, 1), dur = 0.24 - 0.07 * p;
    const dest = place(b, LEVEL.whoosh, x * 0.7, to * 0.7, t, dur);
    if (variant === 'clean') {
      // 사인 두 줄이 내려 스친다(도6→솔4, 도7→솔5)
      tone(b, 'sine', t, 1046.5, 392, dur * 0.7, dur + 0.02).connect(env(b, t, 0.012, 0.035 + 0.082 * p, dur - 0.012)).connect(dest);
      tone(b, 'sine', t, 2093, 784, dur * 0.7, dur + 0.02).connect(env(b, t, 0.012, 0.0086 + 0.02 * p, dur * 0.8)).connect(dest);
      return dur + 0.02;
    }
    // 넓은 바람: 분홍 잡음이 어두웠다가 밝아지고 다시 어두워진다. 가운데가 가장 크다(옆을 스쳐 지나가는 모양)
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

  /** 베기: 조각이 베인 순간. 맞히면 연속 계단의 ‘팅’을 얹는다. 틀려도 같은 베는 소리가 난다(실패음 없음). */
  slice(b, t, { correct = true, combo = 1, x = 0, variant = 'felt' } = {}) {
    const dest = place(b, LEVEL.slice, x * 0.35);   // 맞힘·틀림 모두 같은 베는 소리(틀림에는 ‘팅’만 없다)
    if (variant === 'clean') {
      // 칼끝 ‘착’: 아주 빠른 사인 미끄럼(도8→라5, 20ms)
      tone(b, 'sine', t, 4186, 880, 0.02, 0.05).connect(env(b, t, 0.0015, 0.3, 0.04)).connect(dest);
    } else {
      // 닿는 순간 ‘딱’(높은 잡음 12ms)
      hiss(b, t, 0.03, false).connect(filter(b, 'highpass', 3600, 0.6)).connect(env(b, t, 0.0008, 0.22, 0.014)).connect(dest);
      // 펠트가 베이는 ‘사각’: 넓은 잡음이 밝은 데서 빨리 어두워진다(0.12초). 층마다 1~3ms씩 엇갈려 시작해 꼭대기가 한꺼번에 겹치지 않게
      const t1 = t + 0.0015, lp = filter(b, 'lowpass', 9000, 0.6);
      lp.frequency.setValueAtTime(9000, t1);
      lp.frequency.exponentialRampToValueAtTime(2000, t1 + 0.09);
      hiss(b, t1, 0.15).connect(filter(b, 'highpass', 1000, 0.5)).connect(lp).connect(env(b, t1, 0.003, 0.5, 0.12)).connect(dest);
    }
    // 무게: 낮은 ‘퉁’(라3→도2)과, 휴대폰 스피커에서도 들리는 ‘톡’(미5→솔4)
    tone(b, 'sine', t + 0.003, 220, 65.41, 0.09, 0.155).connect(env(b, t + 0.003, 0.002, 0.2, 0.15)).connect(dest);
    tone(b, 'triangle', t + 0.001, 659.26, 392, 0.05, 0.08).connect(env(b, t + 0.001, 0.001, 0.2, 0.07)).connect(dest);
    if (!correct) return 0.16;
    // 맞힘의 ‘팅’: 연속할수록 C 펜타토닉 계단을 오른다. 4연속부터는 두 칸 위 음을 겹쳐 더 환하게
    ring(b, t + 0.012, comboNote(combo), 0.36, 0.34, dest);
    if (combo >= 4) ring(b, t + 0.04, comboNote(combo + 2), 0.14, 0.3, dest);
    return 0.38;
  },

  /** 던지기: 조각이 바닥에서 튀어 오를 때 ‘뽁’(솔3→솔4). n은 같은 순간에 오른 조각 수다. */
  launch(b, t, { x = 0, n = 1, variant = 'felt' } = {}) {
    const dest = place(b, LEVEL.launch, x * 0.5), lv = Math.min(1, 0.75 + 0.12 * n);
    tone(b, 'sine', t, 196, 392, 0.09, 0.16).connect(env(b, t, 0.008, 0.12 * lv, 0.13)).connect(dest);
    tone(b, 'triangle', t, 392, 784, 0.07, 0.12).connect(env(b, t, 0.006, 0.03 * lv, 0.09)).connect(dest);
    if (variant !== 'clean') hiss(b, t, 0.1).connect(filter(b, 'lowpass', 900, 0.7)).connect(env(b, t, 0.015, 0.05 * lv, 0.07)).connect(dest);
    return 0.16;
  },

  /** 빈칸 채움: 날아간 낱말이 빈칸에 끼워질 때 ‘톡’(솔4→미4). 사운드킷 ‘획득’(픽)과 함께 울린다. */
  snap(b, t, { x = 0 } = {}) {
    const dest = place(b, LEVEL.snap, x * 0.4);
    tone(b, 'triangle', t, 392, 329.63, 0.035, 0.07).connect(env(b, t, 0.001, 0.2, 0.05)).connect(dest);
    tone(b, 'sine', t, 1567.98, 0, 0, 0.04).connect(env(b, t, 0.001, 0.05, 0.02)).connect(dest);
    return 0.07;
  },

  /** 결과의 별 하나(도6·미6·솔6). */
  star(b, t, { i = 0 } = {}) {
    ring(b, t, [1046.5, 1318.51, 1567.98][i % 3], 0.16, 0.26, place(b, LEVEL.star, (i - 1) * 0.3));
    return 0.3;
  },
};
