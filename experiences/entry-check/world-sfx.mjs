// 입장 검사 — WORLD 캠퍼스 판의 입장 부스 효과음(2026-11-04). 파일 없이 Web Audio로 그 자리에서 만든다.
// 본체(음 · 잡음 · 리미터 · 사다리 · 맞음 · 다름 · 숫자 소리)는 주문 폭주 world-sfx.mjs(11-03 2판)를 그대로 옮겼고, 도장 · 창문 · 종이 · 짐 소리를 더했다.
// 게임(app.mjs의 WORLD 분기 → world-play.mjs)과 크기 재기(qa/world-campus-20261104/소리재기.cjs)가 이 파일 하나를 함께 쓴다. LAB 화면은 audio.mjs의 옛 소리 그대로다.
//
// 브랜드 사운드킷 셋째 가족 「게임 효과음」 규칙(docs/브랜드_사운드킷/_사운드킷.md, world-sfx.test.mjs가 시험한다):
//   ① 한 소리는 400ms 이하다.  ② 실패음이 없다 — 판정이 틀려도 내려가는 버저 없이 짧은 두 음이 오른다.
//   ③ 음이 있는 층은 사인·트라이앵글만 쓴다.  ④ 음높이는 C 펜타토닉(도·레·미·솔·라) 안이다. 미끄럼도 시작음과 끝음이 음계 안이다.
// 종이 · 셔터 · 잉크 같은 잡음 층은 짧고 넓은 대역만 쓴다(좁은 대역은 무전 잡음처럼 들린다, 08-28 귀 검수).
// 도장은 이 게임의 간판 소리다: 고무가 종이를 때리는 넓은 「탁」 + 책상이 받는 몸통 + 잉크가 눌리는 짧은 「칙」. 폰 스피커를 생각해 몸통은 도4(262Hz) 이상.

const N = {
  C3: 130.81, G3: 196.0, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880.0, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.0,
  C7: 2093.0, D7: 2349.32, E7: 2637.02, G7: 3135.96, A7: 3520.0,
};
/** 맞힐 때마다 오르는 계단: 도5 레5 미5 솔5 라5 도6 레6 미6 솔6 라6 (연속 10번째부터 같은 음) */
export const PENTA = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6, N.G6, N.A6];
export const comboNote = (combo) => PENTA[Math.min(PENTA.length - 1, Math.max(0, Math.floor(combo) - 1))];

function rng(seed) {   // mulberry32 — 오프라인 렌더를 다시 해도 같은 잡음 · 같은 변주
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 부드러운 리미터 곡선: −3dBFS(0.7)까지는 그대로, 그 위는 곡선으로 눌러 0.93(−0.6dBFS)을 넘지 않는다(겹칠 때만 일한다). */
export function softLimit(x) {
  const a = Math.abs(x), k = 0.7, top = 0.93;
  if (a <= k) return x;
  return Math.sign(x) * (k + (top - k) * Math.tanh((a - k) / (top - k)));
}

/** 끝 리미터: 목소리 · 효과음 · 음악이 겹쳐도 스피커로 1.0을 넘겨 찌그러지지 않게 같은 곡선으로 한 번 더 받는다. 입력 마디를 돌려준다(WORLD 소리 길의 맨 끝). 보통 흐름에서는 없어도 0.925로 넘지 않지만(11-05 실측) 빠르게 찍으면 도장과 말이 겹칠 수 있어 보증으로 둔다. */
export function createLimiter(c, destination = c.destination) {
  const half = c.createGain(); half.gain.value = 0.5;
  const limit = c.createWaveShaper();
  const curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i += 1) { const x = (i / 512 - 1) * 2; curve[i] = softLimit(x) / 2; }
  limit.curve = curve;
  const back = c.createGain(); back.gain.value = 2;
  half.connect(limit); limit.connect(back); back.connect(destination);
  return half;
}

/**
 * 소리 길: 소리마다 → out(켜기 · 끄기 · 전체 크기) → 리미터 → 스피커.
 * 브라우저 압축기는 한계 아래 소리까지 줄여서(사운드킷 실측) 쓰지 않는다.
 */
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
function tone(b, { type = 'sine', f, f2 = 0, glide = 0.05, t, peak, att = 0.004, dec = 0.1, dest = b.out }) {
  const { c } = b, o = c.createOscillator(), g = c.createGain();
  g.gain.value = 0;   // 기본 크기 1이 시작 표본 하나에 새어 딸깍이 난다(11-03 소리재기에서 한 표본 −0.6dBFS 튐) — 처음부터 0
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + glide);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + att + dec + 0.01);
  return att + dec + 0.01;
}
/** 넓은 대역 잡음 한 줌(붓기 · 김 · 미끄러짐 · 딸깍). filters: [종류, 주파수, Q, 끝 주파수, 미끄럼 시간] — 띠 거르개는 Q 0.9 이하만. */
function burst(b, { t, peak, att = 0.002, dec = 0.04, filters = [], dest = b.out }) {
  const { c } = b, src = c.createBufferSource(), g = c.createGain();
  g.gain.value = 0;   // tone()과 같은 까닭
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
/** 나무 실로폰 한 음: 바탕음 + 두 옥타브 위(같은 음이름) + 짧은 딸깍. */
function wood(b, t, f, v = 1, dec = 0.3) {
  const e1 = tone(b, { f, t, peak: 0.11 * v, att: 0.002, dec });
  const e2 = tone(b, { f: f * 4, t, peak: 0.022 * v, att: 0.001, dec: 0.05 });
  const e3 = burst(b, { t, peak: 0.14 * v, att: 0.0008, dec: 0.008, filters: [['bandpass', 2400, 0.8]] });
  return Math.max(e1, e2, e3);
}
/** 종 한 음: 바탕음 + 옥타브(같은 음이름)만 — 3배음은 음계 밖일 수 있어 넣지 않는다. */
function chime(b, t, f, v = 1, dec = 0.34) {
  const e1 = tone(b, { f, t, peak: 0.07 * v, att: 0.002, dec });
  const e2 = tone(b, { f: f * 2, t, peak: 0.02 * v, att: 0.001, dec: dec * 0.45 });
  return Math.max(e1, e2);
}
const pick = (b, list, avoid = null) => {
  const pool = list.filter((x) => x !== avoid);
  return pool[Math.floor(b.rand() * pool.length) % pool.length];
};
/** 컵이 차오르는 「톡」 사다리: 그 컵의 n번째 재료 = 도5 · 레5 · 미5 · 솔5 · 라5(사인 + 옥타브 트라이앵글 + 짧은 딸깍). */
export const FILL = [N.C5, N.D5, N.E5, N.G5, N.A5];
function fillTok(b, t, step = 1, v = 1) {
  const f = FILL[Math.min(FILL.length - 1, Math.max(0, step - 1))];
  return Math.max(tone(b, { f, t, peak: 0.05 * v, att: 0.002, dec: 0.1 }), tone(b, { type: 'triangle', f: f * 2, t, peak: 0.012 * v, att: 0.001, dec: 0.05 }),
    burst(b, { t, peak: 0.045 * v, att: 0.0008, dec: 0.008, filters: [['bandpass', 2600, 0.8]] }));
}
/** 손님마다 다른 부스 종 두 음(소리만으로 누가 왔는지 — 모두 오르는 두 음). 원고 손님 키(content.mjs CAST)로 부른다. */
export const GUEST_CHIME = {
  bear: [N.E6, N.G6], raccoon: [N.A5, N.C6], rabbit: [N.G5, N.A5], fox: [N.D6, N.E6], squirrel: [N.G6, N.A6], hedgehog: [N.C6, N.E6],
  penguin: [N.D6, N.G6], ducks: [N.C6, N.D6], otter: [N.G5, N.C6], deer: [N.E6, N.A6], panda: [N.A5, N.D6], sheep: [N.D6, N.A6],
};
/** 고무도장 한 번: 넓은 「탁」(고무가 종이를 때림) + 책상 몸통(트라이앵글 + 옥타브 사인) + 잉크 「칙」. 통과는 몸통이 미4, 거절은 도4. */
function stampHit(b, t, f, v = 1) {
  const slap = burst(b, { t, peak: 0.3 * v * b.vary(0.06), att: 0.0006, dec: 0.022, filters: [['lowpass', 2400, 0.7], ['highpass', 260]] });
  const body = tone(b, { type: 'triangle', f, t: t + 0.002, peak: 0.12 * v, att: 0.002, dec: 0.11 }) + 0.002;
  const ring = tone(b, { f: f * 2, t: t + 0.002, peak: 0.035 * v, att: 0.002, dec: 0.06 }) + 0.002;
  const ink = burst(b, { t: t + 0.03, peak: 0.07 * v, att: 0.004, dec: 0.05, filters: [['bandpass', 1500, 0.7], ['lowpass', 3800]] }) + 0.03;
  return Math.max(slap, body, ring, ink);
}

/**
 * 소리들. 각 소리는 (bus, 시작 시각, 선택) → 끝나는 시각(시작부터 초)을 돌려준다. 모두 0.4초 안에 끝난다.
 */
export const SOUNDS = {
  // 손님 등장: 부스 종 두 음 — 손님마다 동기가 다르다(guest). 앞에 아주 짧은 딸깍
  arrive(b, t, { guest = 'bear' } = {}) {
    const [a1, a2] = GUEST_CHIME[guest] || GUEST_CHIME.bear;
    const tick = burst(b, { t, peak: 0.06, att: 0.0008, dec: 0.004, filters: [['highpass', 3000, 0.7]] });
    return Math.max(tick, chime(b, t + 0.004, a1, 0.9, 0.2) + 0.004, chime(b, t + 0.12, a2, 1, 0.24) + 0.12);
  },
  // 손님이 들어가거나 돌아섬: 같은 종을 작게(벌주는 소리 없음)
  leave(b, t, { guest = 'bear' } = {}) {
    const [a1, a2] = GUEST_CHIME[guest] || GUEST_CHIME.bear;
    return Math.max(chime(b, t, a1, 0.45, 0.16), chime(b, t + 0.1, a2, 0.4, 0.18) + 0.1);
  },
  // 창문 열기(근무 시작): 블라인드가 걷히는 드르륵(넓은 잡음 틱 일곱, 점점 빨라짐) + 열리는 바람 + 도6 → 솔6
  open(b, t) {
    let end = burst(b, { t, peak: 0.1, att: 0.05, dec: 0.2, filters: [['lowpass', 700, 0.7, 2800, 0.22], ['highpass', 220]] });
    let at = t;
    for (let i = 0; i < 7; i += 1) { end = Math.max(end, burst(b, { t: at, peak: 0.07 * b.vary(0.15), att: 0.0006, dec: 0.006, filters: [['bandpass', 1800, 0.8]] }) + at - t); at += 0.034 - i * 0.003; }
    return Math.max(end, chime(b, t + 0.2, N.C6, 0.8, 0.16) + 0.2, chime(b, t + 0.27, N.G6, 0.9, 0.11) + 0.27);
  },
  // 종이가 책상에 미끄러져 놓임(표 · 카드를 내밀 때): 넓은 잡음이 1300 → 700Hz로 쓱 + 아주 작은 톡
  slide(b, t) {
    return Math.max(burst(b, { t, peak: 0.13, att: 0.02, dec: 0.1, filters: [['bandpass', 1300, 0.6, 700, 0.12]] }),
      tone(b, { type: 'triangle', f: N.G4, t: t + 0.11, peak: 0.025, att: 0.002, dec: 0.05 }) + 0.11);
  },
  // 짐이 쇠 쟁반에 놓임: 쇠 쟁반 땡(사다리 step = 몇 번째 짐, 한 옥타브 위) + 낮은 톡
  place(b, t, { step = 1 } = {}) {
    const f = FILL[Math.min(FILL.length - 1, Math.max(0, step - 1))] * 2;
    return Math.max(tone(b, { f, t, peak: 0.035, att: 0.001, dec: 0.08 }), tone(b, { type: 'triangle', f: N.G4, t, peak: 0.04, att: 0.002, dec: 0.06 }),
      burst(b, { t, peak: 0.06, att: 0.0008, dec: 0.01, filters: [['bandpass', 2600, 0.8]] }));
  },
  // 통과 도장
  stampPass(b, t) { return stampHit(b, t, N.E4, 1); },
  // 거절 도장(이유를 고른 뒤): 몸통이 도4 — 한 번 치는 소리라 내려가는 음이 아니다
  stampReject(b, t) { return stampHit(b, t, N.C4, 1.05); },
  // 거절을 누름 → 안내문 규칙이 고를 수 있는 판이 됨: 종이 넘김 + 나무 미5
  choose(b, t) {
    return Math.max(burst(b, { t, peak: 0.08, att: 0.004, dec: 0.04, filters: [['bandpass', 2000, 0.7]] }), wood(b, t + 0.02, N.E5, 0.7, 0.12) + 0.02);
  },
  // 돋보기: 미6 · 솔6 · 라6 빠른 반짝
  hint(b, t) {
    return Math.max(tone(b, { f: N.E6, t, peak: 0.025, att: 0.002, dec: 0.05 }), tone(b, { f: N.G6, t: t + 0.05, peak: 0.025, att: 0.002, dec: 0.05 }) + 0.05,
      tone(b, { f: N.A6, t: t + 0.1, peak: 0.022, att: 0.002, dec: 0.09 }) + 0.1);
  },
  // 근무 중 새 알림: 종이 펄럭(넓은 잡음 두 번) + 도6 → 미6
  notify(b, t) {
    return Math.max(burst(b, { t, peak: 0.08, att: 0.01, dec: 0.04, filters: [['bandpass', 1600, 0.6]] }), burst(b, { t: t + 0.06, peak: 0.06, att: 0.01, dec: 0.04, filters: [['bandpass', 1900, 0.6]] }) + 0.06,
      chime(b, t + 0.1, N.C6, 0.9, 0.16) + 0.1, chime(b, t + 0.2, N.E6, 1, 0.18) + 0.2);
  },
  // 맞음: 펜타토닉 오르막 네 음(시작음이 연속 단계만큼 위, 5단계 천장) + 끝에 짤랑. 연속 5부터 위 옥타브 겹 — 주문 폭주와 같은 소리
  correct(b, t, { combo = 1 } = {}) {
    const k = Math.min(5, Math.max(1, combo)) - 1;
    const run = [PENTA[k], PENTA[k + 2], PENTA[k + 4], PENTA[Math.min(PENTA.length - 1, k + 5)]];
    let end = 0;
    run.forEach((f, i) => {
      const at = t + i * 0.06, dec = i === 3 ? 0.16 : 0.07;
      end = Math.max(end, tone(b, { type: 'triangle', f, t: at, peak: 0.05, att: 0.002, dec }) + i * 0.06, tone(b, { f: f * 2, t: at, peak: 0.018, att: 0.002, dec: dec * 0.7 }) + i * 0.06);
      if (k >= 4) end = Math.max(end, tone(b, { f: f * 4, t: at, peak: 0.008, att: 0.002, dec: dec * 0.5 }) + i * 0.06);
    });
    end = Math.max(end, tone(b, { f: N.A6, t: t + 0.24, peak: 0.02, att: 0.001, dec: 0.04 }) + 0.24, tone(b, { f: N.E7, t: t + 0.25, peak: 0.012, att: 0.001, dec: 0.04 }) + 0.25,
      burst(b, { t: t + 0.24, peak: 0.05, att: 0.0008, dec: 0.004, filters: [['highpass', 3500, 0.7]] }) + 0.24);
    return end;
  },
  // 연속 셋 · 다섯 · 여덟: 도6 미6 솔6 빠른 세 음
  combo(b, t) { return Math.max(wood(b, t, N.C6, 0.8, 0.12), wood(b, t + 0.07, N.E6, 0.85, 0.12) + 0.07, wood(b, t + 0.14, N.G6, 1, 0.22) + 0.14); },
  // 판정이 손님과 다름: 벌주는 소리 없이 묻는 듯한 두 음(솔4 → 라4) + 아주 작은 톡
  differ(b, t) {
    return Math.max(tone(b, { f: N.G4, t, peak: 0.05, att: 0.01, dec: 0.08 }), tone(b, { f: N.A4, t: t + 0.09, peak: 0.05, att: 0.01, dec: 0.11 }) + 0.09,
      burst(b, { t, peak: 0.04, att: 0.0008, dec: 0.01, filters: [['lowpass', 2000, 0.7]] }));
  },
  // 숫자가 오를 때 한 칸: 라6 아주 짧게 + 잡음 틱(초당 최대 15번 — 부르는 쪽이 간격을 지킨다)
  roll(b, t) { return Math.max(tone(b, { f: N.A6, t, peak: 0.012, att: 0.001, dec: 0.01 }), burst(b, { t, peak: 0.03, att: 0.0005, dec: 0.002, filters: [['highpass', 3000, 0.7]] })); },
  // 큰 숫자가 자리에 앉음: 도6 띵(솔5 겹)
  land(b, t) { return Math.max(wood(b, t, N.C6, 0.9, 0.28), wood(b, t + 0.01, N.G5, 0.6, 0.26) + 0.01); },
  // 근무 끝: 도5 · 미5 · 솔5 · 라5를 20ms씩 흩어 친다 + 넓은 반짝
  done(b, t) {
    let end = burst(b, { t, peak: 0.05, att: 0.002, dec: 0.02, filters: [['highpass', 3500, 0.7]] });
    [N.C5, N.E5, N.G5, N.A5].forEach((f, i) => { const at = t + i * 0.02; end = Math.max(end, tone(b, { type: 'triangle', f, t: at, peak: 0.035, att: 0.003, dec: 0.28 }) + i * 0.02, tone(b, { f: f * 2, t: at, peak: 0.012, att: 0.003, dec: 0.18 }) + i * 0.02); });
    return end;
  },
  // 코인: 맑은 두 음(솔6 → 도7)
  coin(b, t) { return Math.max(chime(b, t, N.G6, 0.7, 0.14), chime(b, t + 0.07, N.C7, 0.8, 0.24) + 0.07); },
  // 단추: 손끝으로 톡(늘 같은 소리 — UI 소리는 변주하지 않는다)
  tap(b, t) { return Math.max(burst(b, { t, peak: 0.1, att: 0.001, dec: 0.02, filters: [['bandpass', 1300, 0.8], ['lowpass', 3200]] }), tone(b, { f: N.G4, t, peak: 0.018, att: 0.002, dec: 0.035 })); },
};

/** 소리마다 전체 크기(소리재기.cjs로 잰 K 가중 순간 음량을 맞춘 값 — 잰 기록은 qa/world-sfx-levels.json, 시험이 둘이 같은지 본다). */
export const LEVEL = {
  tap: 15.312, arrive: 4.389, leave: 6.699, open: 7.64, slide: 9.633, place: 11.053, stampPass: 8.235, stampReject: 7.84,
  choose: 5.969, hint: 10.595, notify: 5.781, correct: 9.7, combo: 4.685, differ: 7.463, roll: 24.774, land: 5.191,
  done: 12.322, coin: 6.414,
};

/** 소리 하나를 bus에 만든다(게임 · 시청 · 오프라인 렌더가 같은 길). 끝나는 시각(상대)을 돌려준다. */
export function renderSfx(bus, name, when = 0, opts = {}) {
  const make = SOUNDS[name];
  if (!make) return 0;
  const g = bus.c.createGain();
  g.gain.value = LEVEL[name] ?? 1;
  g.connect(bus.out);
  return make({ ...bus, out: g }, when, opts);
}

const DUCK = Math.pow(10, -4 / 20);   // 손님 목소리가 나오는 동안 효과음 −4dB(조사_소리 「음성 중 효과음」)

/** 게임에서 쓰는 손잡이: 문맥을 받아 bus를 만들고, 이름으로 부른다. on()이 거짓이면 아무것도 내지 않는다. */
export function createSfx(c, { seed = (Date.now() >>> 0), on = () => true, volume = 1, destination = c.destination } = {}) {
  const bus = createBus(c, { seed, destination });
  let vol = Math.min(1, Math.max(0, volume)), ducked = false;
  const apply = () => bus.out.gain.setTargetAtTime(vol * (ducked ? DUCK : 1), c.currentTime, 0.05);
  bus.out.gain.value = vol;
  return {
    bus,
    play(name, opts) {
      if (!on() || !c || c.state !== 'running') return 0;
      return renderSfx(bus, name, c.currentTime + 0.005, opts);
    },
    /** 사용자 크기 0~1(멈춤 창 「효과음」). */
    setVolume(v) { vol = Math.min(1, Math.max(0, v)); apply(); },
    /** 손님 목소리가 나오는 동안만 내린다. */
    duck(active) { ducked = !!active; apply(); },
  };
}
