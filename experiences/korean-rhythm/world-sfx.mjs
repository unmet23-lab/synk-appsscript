// 말의 리듬 — WORLD 캠퍼스 판(축제 무대 연습실, 2026-11-04)의 효과음. 파일 없이 Web Audio로 그 자리에서 만든다.
// 게임(world-play.mjs), 크기 재기(qa/world-campus-20261104/소리재기.cjs), 견본(qa/world-campus-20261104/소리견본.cjs)이 이 파일 하나를 함께 쓴다.
// LAB 화면은 audio.mjs의 옛 소리 그대로다(이 파일을 불러오지 않는다).
//
// 브랜드 사운드킷 셋째 가족 「게임 효과음」 규칙(docs/브랜드_사운드킷/_사운드킷.md, world-sfx.test.mjs가 시험한다 — 주문 폭주 world-sfx.mjs와 같은 규칙):
//   ① 한 소리는 400ms 이하다.  ② 실패음이 없다 — 틀려도 내려가는 버저 없이 짧은 두 음이 오른다, 놓친 노트에는 소리가 없다.
//   ③ 음이 있는 층은 사인·트라이앵글만 쓴다.  ④ 음높이는 C 펜타토닉(도·레·미·솔·라) 안이다 — 세 곡이 모두 C장조(잰 값 qa/world-campus-20261104/조.json).
// 잡음 층은 짧고 넓은 대역만 쓴다. 음 있는 층의 몸통은 도4(262Hz) 이상(폰 스피커).
// 버스 · 리미터 · tone · burst · wood · chime은 주문 폭주 world-sfx.mjs와 같은 글이다(게임 폴더는 혼자 선다 — 고치면 둘 다 고친다).
// 크기(LEVEL)는 소리재기.cjs가 BS.1770 K 가중 400ms 순간 최대로 재어 목표에 맞춘 값이다.

const N = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880.0, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.0,
  C7: 2093.0, D7: 2349.32, E7: 2637.02, G7: 3135.96, A7: 3520.0,
};
/** 맞힐 때마다 오르는 계단: 도5 레5 미5 솔5 라5 도6 레6 미6 솔6 라6 */
export const PENTA = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6, N.G6, N.A6];
/** 레인마다 키음의 음(O 미6 · X 도6 — 한 단 낮은 X). 딱!은 옥타브 위 반짝을 하나 더 얹는다. */
export const LANE_NOTE = [N.E6, N.C6];

function rng(seed) {   // mulberry32 — 오프라인 렌더를 다시 해도 같은 잡음 · 같은 변주
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 부드러운 리미터 곡선: −3dBFS(0.7)까지는 그대로, 그 위는 곡선으로 눌러 0.93(−0.6dBFS)을 넘지 않는다. */
export function softLimit(x) {
  const a = Math.abs(x), k = 0.7, top = 0.93;
  if (a <= k) return x;
  return Math.sign(x) * (k + (top - k) * Math.tanh((a - k) / (top - k)));
}

/** 소리 길: 소리마다 → out(켜기 · 끄기 · 전체 크기) → 리미터 → 스피커. */
export function createBus(c, { seed = 7, destination = c.destination } = {}) {
  const rand = rng(seed);
  const out = c.createGain();
  const half = c.createGain(); half.gain.value = 0.5;
  const limit = c.createWaveShaper();
  const curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i += 1) { const x = (i / 512 - 1) * 2; curve[i] = softLimit(x) / 2; }
  limit.curve = curve;
  const back = c.createGain(); back.gain.value = 2;
  out.connect(half); half.connect(limit); limit.connect(back); back.connect(destination);
  const length = Math.floor(c.sampleRate * 1.0);
  const noise = c.createBuffer(1, length, c.sampleRate), data = noise.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = rand() * 2 - 1;
  return { c, out, rand, noise, vary: (amount) => 1 + (rand() * 2 - 1) * amount };
}

/** 음 하나(사인 · 트라이앵글). 끝나는 시각(상대)을 돌려준다. */
function tone(b, { type = 'sine', f, t, peak, att = 0.004, dec = 0.1, dest = b.out }) {
  const { c } = b, o = c.createOscillator(), g = c.createGain();
  g.gain.value = 0;   // 기본 크기 1이 시작 표본 하나에 새어 딸깍이 난다(주문 폭주 11-03 소리재기) — 처음부터 0
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + att + dec + 0.01);
  return att + dec + 0.01;
}
/** 넓은 대역 잡음 한 줌. filters: [종류, 주파수, Q, 끝 주파수, 미끄럼 시간] — 띠 거르개는 Q 0.9 이하만. */
function burst(b, { t, peak, att = 0.002, dec = 0.04, filters = [], dest = b.out }) {
  const { c } = b, src = c.createBufferSource(), g = c.createGain();
  g.gain.value = 0;
  src.buffer = b.noise;
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
/** 나무 실로폰 한 음: 바탕음 + 두 옥타브 위 + 짧은 딸깍. */
function wood(b, t, f, v = 1, dec = 0.3) {
  return Math.max(tone(b, { f, t, peak: 0.11 * v, att: 0.002, dec }), tone(b, { f: f * 4, t, peak: 0.022 * v, att: 0.001, dec: 0.05 }),
    burst(b, { t, peak: 0.14 * v, att: 0.0008, dec: 0.008, filters: [['bandpass', 2400, 0.8]] }));
}
/** 종 한 음: 바탕음 + 옥타브만. */
function chime(b, t, f, v = 1, dec = 0.34) {
  return Math.max(tone(b, { f, t, peak: 0.07 * v, att: 0.002, dec }), tone(b, { f: f * 2, t, peak: 0.02 * v, att: 0.001, dec: dec * 0.45 }));
}

/**
 * 소리들. 각 소리는 (bus, 시작 시각, 선택) → 끝나는 시각(시작부터 초)을 돌려준다. 모두 0.4초 안에 끝난다.
 * 키음은 「넓은 딸깍(타악 끝) + 레인 음」 두 겹 — 딱!은 옥타브 반짝이 더 얹히고, 아쉬워요는 같은 음을 한 옥타브 아래 트라이앵글로 어둡게.
 */
export const SOUNDS = {
  // 노트를 침: quality 1 = 딱! · 0.8 = 좋아요 · 그 아래 = 아쉬워요. 90ms 안에 끝난다(박이 촘촘해도 다음 소리와 안 뭉친다)
  key(b, t, { lane = 0, quality = 1 } = {}) {
    const f = LANE_NOTE[lane ? 1 : 0];
    if (quality >= 1) {
      return Math.max(burst(b, { t, peak: 0.08, att: 0.0006, dec: 0.006, filters: [['highpass', 2200, 0.7]] }),
        tone(b, { f, t, peak: 0.05, att: 0.001, dec: 0.05 }), tone(b, { f: f * 2, t, peak: 0.014, att: 0.001, dec: 0.028 }));
    }
    if (quality >= 0.8) {
      return Math.max(burst(b, { t, peak: 0.07, att: 0.0006, dec: 0.006, filters: [['highpass', 2000, 0.7]] }), tone(b, { f, t, peak: 0.042, att: 0.001, dec: 0.042 }));
    }
    return Math.max(burst(b, { t, peak: 0.06, att: 0.0008, dec: 0.008, filters: [['lowpass', 2600, 0.7], ['highpass', 600]] }),
      tone(b, { type: 'triangle', f: f / 2, t, peak: 0.03, att: 0.002, dec: 0.035 }));
  },
  // 답을 골랐다(박자 전에 먼저 누름 — 「골랐어요」): 그 레인 음을 한 옥타브 아래로 작게 톡
  pick(b, t, { lane = 0 } = {}) { return Math.max(tone(b, { type: 'triangle', f: LANE_NOTE[lane ? 1 : 0] / 2, t, peak: 0.035, att: 0.002, dec: 0.06 }), burst(b, { t, peak: 0.04, att: 0.0006, dec: 0.004, filters: [['highpass', 2400, 0.7]] })); },
  // 길게 누른 노트를 끝까지: 솔5 짧은 톡 + 딸깍
  release(b, t) { return Math.max(tone(b, { type: 'triangle', f: N.G5, t, peak: 0.035, att: 0.002, dec: 0.05 }), burst(b, { t, peak: 0.05, att: 0.0006, dec: 0.004, filters: [['highpass', 2600, 0.7]] })); },
  // 시작 전 네 박: 나무 딸깍(셋은 솔5, 마지막은 도6 — 「하나 둘 셋 넷!」)
  count(b, t, { accent = false } = {}) { return wood(b, t, accent ? N.C6 : N.G5, accent ? 0.9 : 0.7, accent ? 0.16 : 0.1); },
  // 무대 연습 시작: 불 켜지는 바람(넓은 잡음이 열림) + 도5 → 솔5 종
  open(b, t) {
    const a = burst(b, { t, peak: 0.16, att: 0.06, dec: 0.22, filters: [['lowpass', 500, 0.7, 2600, 0.24], ['highpass', 180]] });
    return Math.max(a, chime(b, t + 0.03, N.C5, 0.9, 0.24) + 0.03, chime(b, t + 0.12, N.G5, 1, 0.26) + 0.12);
  },
  // 문장 안내(늘 같은 소리): 솔5 → 도6 부드러운 두 종. 음성 0.45초 전에 나서 음성 전에 끝난다
  listen(b, t) { return Math.max(chime(b, t, N.G5, 0.75, 0.16), chime(b, t + 0.11, N.C6, 0.85, 0.2) + 0.11); },
  // 들은 내용 맞힘: 펜타토닉 오르막 네 음(그 곡에서 맞힌 수 n만큼 한 칸 위, 5칸 천장) + 끝에 짤랑
  right(b, t, { n = 1 } = {}) {
    const k = Math.min(5, Math.max(1, n)) - 1;
    const run = [PENTA[k], PENTA[k + 2], PENTA[k + 4], PENTA[Math.min(PENTA.length - 1, k + 5)]];
    let end = 0;
    run.forEach((f, i) => {
      const at = t + i * 0.06, dec = i === 3 ? 0.16 : 0.07;
      end = Math.max(end, tone(b, { type: 'triangle', f, t: at, peak: 0.05, att: 0.002, dec }) + i * 0.06, tone(b, { f: f * 2, t: at, peak: 0.018, att: 0.002, dec: dec * 0.7 }) + i * 0.06);
    });
    return Math.max(end, tone(b, { f: N.A6, t: t + 0.24, peak: 0.02, att: 0.001, dec: 0.04 }) + 0.24, tone(b, { f: N.E7, t: t + 0.25, peak: 0.012, att: 0.001, dec: 0.04 }) + 0.25,
      burst(b, { t: t + 0.24, peak: 0.05, att: 0.0008, dec: 0.004, filters: [['highpass', 3500, 0.7]] }) + 0.24);
  },
  // 들은 내용과 다름: 벌주는 소리 없이 묻는 듯한 두 음(솔4 → 라4)
  differ(b, t) {
    return Math.max(tone(b, { f: N.G4, t, peak: 0.05, att: 0.01, dec: 0.08 }), tone(b, { f: N.A4, t: t + 0.09, peak: 0.05, att: 0.01, dec: 0.11 }) + 0.09,
      burst(b, { t, peak: 0.04, att: 0.0008, dec: 0.01, filters: [['lowpass', 2000, 0.7]] }));
  },
  // 콤보 10 · 25 · 50 · 100: 도6 미6 솔6 빠른 세 음
  milestone(b, t) { return Math.max(wood(b, t, N.C6, 0.8, 0.12), wood(b, t + 0.07, N.E6, 0.85, 0.12) + 0.07, wood(b, t + 0.14, N.G6, 1, 0.22) + 0.14); },
  // 숫자가 오를 때 한 칸: 라6 아주 짧게 + 잡음 틱(부르는 쪽이 초당 15번 안으로)
  roll(b, t) { return Math.max(tone(b, { f: N.A6, t, peak: 0.012, att: 0.001, dec: 0.01 }), burst(b, { t, peak: 0.03, att: 0.0005, dec: 0.002, filters: [['highpass', 3000, 0.7]] })); },
  // 결과의 문장 점 하나가 찍힘: 맞힘은 사다리 톡(도5 · 레5 · 미5 · 솔5 · 라5), 놓침은 아주 작은 딸깍
  dot(b, t, { step = 1, ok = true } = {}) {
    if (!ok) return burst(b, { t, peak: 0.04, att: 0.0006, dec: 0.004, filters: [['lowpass', 2200, 0.7]] });
    const f = PENTA[Math.min(4, Math.max(0, step - 1))];
    return Math.max(tone(b, { f, t, peak: 0.05, att: 0.002, dec: 0.1 }), tone(b, { type: 'triangle', f: f * 2, t, peak: 0.012, att: 0.001, dec: 0.05 }),
      burst(b, { t, peak: 0.045, att: 0.0008, dec: 0.008, filters: [['bandpass', 2600, 0.8]] }));
  },
  // 큰 숫자가 자리에 앉음: 도6 띵(솔5 겹)
  land(b, t) { return Math.max(wood(b, t, N.C6, 0.9, 0.28), wood(b, t + 0.01, N.G5, 0.6, 0.26) + 0.01); },
  // 무대 끝: 도5 · 미5 · 솔5 · 라5를 20ms씩 흩어 치는 화음 + 넓은 반짝
  done(b, t) {
    let end = burst(b, { t, peak: 0.05, att: 0.002, dec: 0.02, filters: [['highpass', 3500, 0.7]] });
    [N.C5, N.E5, N.G5, N.A5].forEach((f, i) => { const at = t + i * 0.02; end = Math.max(end, tone(b, { type: 'triangle', f, t: at, peak: 0.035, att: 0.003, dec: 0.28 }) + i * 0.02, tone(b, { f: f * 2, t: at, peak: 0.012, att: 0.003, dec: 0.18 }) + i * 0.02); });
    return end;
  },
  // 5/5 도장: 낮은 쿵(넓은 잡음) + 도5 · 솔5 나무 두 음
  stamp(b, t) {
    return Math.max(burst(b, { t, peak: 0.2, att: 0.001, dec: 0.05, filters: [['lowpass', 900, 0.7], ['highpass', 140]] }),
      wood(b, t + 0.01, N.C5, 0.9, 0.2) + 0.01, wood(b, t + 0.09, N.G5, 1, 0.26) + 0.09);
  },
  // 코인: 맑은 두 음(솔6 → 도7)
  coin(b, t) { return Math.max(chime(b, t, N.G6, 0.7, 0.14), chime(b, t + 0.07, N.C7, 0.8, 0.24) + 0.07); },
};

/** 소리마다 전체 크기(소리재기.cjs로 잰 K 가중 순간 음량을 목표에 맞춘 값 — 잰 기록은 qa/world-sfx-levels.json). */
export const LEVEL = {
  key: 10.606, pick: 11.511, release: 11.711, count: 5.246, open: 5.891, listen: 5.721, right: 9.387, differ: 7.463,
  milestone: 3.721, roll: 24.774, dot: 10.13, land: 5.191, done: 12.322, stamp: 5.387, coin: 6.414,
};

/** 소리 하나를 bus에 만든다(게임 · 견본 · 오프라인 렌더가 같은 길). 끝나는 시각(상대)을 돌려준다. */
export function renderSfx(bus, name, when = 0, opts = {}) {
  const make = SOUNDS[name];
  if (!make) return 0;
  const g = bus.c.createGain();
  g.gain.value = LEVEL[name] ?? 1;
  g.connect(bus.out);
  return make({ ...bus, out: g }, when, opts);
}

const DUCK = Math.pow(10, -4 / 20);   // 문장이 나오는 동안 효과음 −4dB(주문 폭주 조사_소리 「음성 중 효과음」)

/** 게임에서 쓰는 손잡이: 문맥을 받아 bus를 만들고, 이름으로 부른다. on()이 거짓이면 아무것도 내지 않는다. */
export function createSfx(c, { seed = (Date.now() >>> 0), on = () => true, volume = 1 } = {}) {
  const bus = createBus(c, { seed });
  let vol = Math.min(1, Math.max(0, volume)), ducked = false;
  const apply = () => bus.out.gain.setTargetAtTime(vol * (ducked ? DUCK : 1), c.currentTime, 0.05);
  bus.out.gain.value = vol;
  const ok = () => on() && c && c.state === 'running';
  return {
    bus, c,
    play(name, opts) { return ok() ? renderSfx(bus, name, c.currentTime + 0.005, opts) : 0; },
    /** 문맥 시계의 when초에 낸다(카운트처럼 미리 예약하는 소리). 지난 시각이면 지금. */
    at(name, when, opts) { return ok() ? renderSfx(bus, name, Math.max(c.currentTime + 0.005, when), opts) : 0; },
    setVolume(v) { vol = Math.min(1, Math.max(0, v)); apply(); },
    duck(active) { if (ducked === !!active) return; ducked = !!active; apply(); },   // 장면마다 불려도 바뀔 때만 건다
  };
}
