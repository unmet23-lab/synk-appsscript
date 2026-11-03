// 주문 폭주 — WORLD 캠퍼스 판의 카페 효과음(2026-11-03 2판). 파일 없이 Web Audio로 그 자리에서 만든다.
// 게임(app.mjs의 WORLD 분기), 소리 시청 페이지(qa/world-campus-20261103/소리시청.htm), 크기 재기(qa/world-campus-20261103/소리재기.cjs)가
// 이 파일 하나를 함께 쓴다 — 들은 소리와 게임 소리가 갈라지지 않는다(브랜드 사운드킷과 같은 원칙). LAB 화면은 audio.mjs의 옛 소리 그대로다.
//
// 브랜드 사운드킷 셋째 가족 「게임 효과음」 규칙(docs/브랜드_사운드킷/_사운드킷.md, world-sfx.test.mjs가 시험한다):
//   ① 한 소리는 400ms 이하다.  ② 실패음이 없다 — 주문과 다르게 만들어도 내려가는 버저 없이 짧은 두 음이 오른다.
//   ③ 음이 있는 층은 사인·트라이앵글만 쓴다.  ④ 음높이는 C 펜타토닉(도·레·미·솔·라) 안이다. 미끄럼도 시작음과 끝음이 음계 안이다.
// 붓기·김·미끄러짐 같은 잡음 층은 짧고 넓은 대역만 쓴다(좁은 대역은 무전 잡음처럼 들린다, 08-28 귀 검수).
// 크기(LEVEL)는 소리재기.cjs로 구워 K 가중 순간 음량(BS.1770, 400ms)을 재고 사운드킷 파일(획득 −20.8 · 성취 −15.6 LUFS)에 맞춘 값이다.

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
/** 손님마다 다른 문 종 두 음(소리만으로 누가 왔는지 — 모두 오르는 두 음). */
export const GUEST_CHIME = { g1: [N.E6, N.G6], g2: [N.A5, N.C6], g3: [N.G5, N.A5], g4: [N.D6, N.E6], g5: [N.C6, N.E6], g6: [N.G6, N.A6] };

/**
 * 소리들. 각 소리는 (bus, 시작 시각, 선택) → 끝나는 시각(시작부터 초)을 돌려준다. 모두 0.4초 안에 끝난다.
 * 재료 소리는 「질감(넓은 잡음) + 그 재료의 음」 두 겹이고, 컵에 담길 때 사다리 음(step = 그 컵의 몇 번째 재료)이 끝에 붙는다.
 * 폰 스피커는 200Hz 아래를 거의 못 내서 음 있는 층의 몸통은 도4(262Hz) 이상이다(조사_소리 「음량 · 폰 스피커」).
 */
export const SOUNDS = {
  // 손님 등장: 문 종 두 음 — 손님마다 동기가 다르다(guest). 앞에 아주 짧은 딸깍(종의 추)
  arrive(b, t, { guest = 'g1' } = {}) {
    const [a1, a2] = GUEST_CHIME[guest] || GUEST_CHIME.g1;
    const tick = burst(b, { t, peak: 0.06, att: 0.0008, dec: 0.004, filters: [['highpass', 3000, 0.7]] });
    return Math.max(tick, chime(b, t + 0.004, a1, 0.9, 0.2) + 0.004, chime(b, t + 0.12, a2, 1, 0.24) + 0.12);
  },
  // 손님이 기다리다 떠남(점심 러시): 같은 문 종을 작게(벌주는 소리 없음)
  leave(b, t, { guest = 'g1' } = {}) {
    const [a1, a2] = GUEST_CHIME[guest] || GUEST_CHIME.g1;
    return Math.max(chime(b, t, a1, 0.45, 0.16), chime(b, t + 0.1, a2, 0.4, 0.18) + 0.1);
  },
  // 카페 문 열기: 불 켜지는 바람(넓은 잡음이 열린다) + 문 종 도6 → 솔6
  open(b, t) {
    const a = burst(b, { t, peak: 0.16, att: 0.06, dec: 0.22, filters: [['lowpass', 500, 0.7, 2600, 0.24], ['highpass', 180]] });
    return Math.max(a, chime(b, t + 0.03, N.C6, 0.9, 0.24) + 0.03, chime(b, t + 0.12, N.G6, 1, 0.26) + 0.12);
  },
  // 커피: 졸졸 — 잡음 알갱이 4개(점점 작게) + 몸통 도4/솔4 중 하나 + 사다리 톡
  coffee(b, t, { step = 0 } = {}) {
    let end = 0;
    const body = pick(b, [N.C4, N.G4]);
    for (let i = 0; i < 4; i += 1) {
      const at = t + i * (0.025 + b.rand() * 0.02);
      end = Math.max(end, burst(b, { t: at, peak: (0.16 - i * 0.025) * b.vary(0.1), att: 0.002, dec: 0.012, filters: [['lowpass', 1600 * b.vary(0.15), 0.6], ['highpass', 300]] }) + at - t);
    }
    end = Math.max(end, tone(b, { type: 'triangle', f: body, t, peak: 0.05, att: 0.006, dec: 0.16 }));
    return step ? Math.max(end, fillTok(b, t + 0.17, step) + 0.17) : end;
  },
  // 차: 사르륵 — 넓은 잡음 + 레5(옅은 레6) 또는 라4
  tea(b, t, { step = 0 } = {}) {
    const f = pick(b, [N.D5, N.A4]);
    const end = Math.max(burst(b, { t, peak: 0.16 * b.vary(0.1), att: 0.01, dec: 0.03, filters: [['lowpass', 3200, 0.6], ['highpass', 500]] }),
      tone(b, { f, t: t + 0.01, peak: 0.045, att: 0.004, dec: 0.15 }) + 0.01, tone(b, { f: f * 2, t: t + 0.01, peak: 0.01, att: 0.003, dec: 0.07 }) + 0.01);
    return step ? Math.max(end, fillTok(b, t + 0.17, step) + 0.17) : end;
  },
  // 우유: 둥근 몽 — 트라이앵글 미4(또는 솔4) + 옥타브 사인, 부드러운 시작 + 스윽
  milk(b, t, { step = 0 } = {}) {
    const f = pick(b, [N.E4, N.G4]);
    const end = Math.max(tone(b, { type: 'triangle', f, t, peak: 0.05, att: 0.015, dec: 0.17 }), tone(b, { f: f * 2, t, peak: 0.03, att: 0.015, dec: 0.15 }),
      burst(b, { t, peak: 0.14, att: 0.01, dec: 0.025, filters: [['lowpass', 1100, 0.6]] }));
    return step ? Math.max(end, fillTok(b, t + 0.19, step) + 0.19) : end;
  },
  // 얼음(이 게임의 간판 소리): 달그락 — 사인 땡 2~3개(미6 · 솔6 · 라6 · 도7, 바로 앞 땡과 다른 음), 땡마다 앞에 아주 짧은 넓은 딸깍
  //   hits: 땡마다의 시각(초) — 게임은 3D 얼음이 컵 바닥에 닿는 시각(stage.mjs ICE_LAND)을 넘겨 소리와 그림을 맞춘다. 없으면 30~60ms 간격 2~3개.
  ice(b, t, { step = 0, hits = null } = {}) {
    let end = 0, last = null, at = t, prevHit = 0;
    const count = hits ? hits.length : b.rand() < 0.5 ? 2 : 3;
    for (let i = 0; i < count; i += 1) {
      if (hits) at = t + hits[i];
      const f = pick(b, [N.E6, N.G6, N.A6, N.C7], last); last = f;
      end = Math.max(end, burst(b, { t: at, peak: 0.032 * b.vary(0.15), att: 0.0006, dec: 0.003, filters: [['highpass', 2500, 0.7]] }) + at - t);
      end = Math.max(end, tone(b, { f, t: at + 0.002, peak: 0.05 * b.vary(0.15), att: 0.001, dec: 0.05 }) + at + 0.002 - t);
      end = Math.max(end, tone(b, { f: f * 2, t: at + 0.002, peak: 0.012, att: 0.001, dec: 0.03 }) + at + 0.002 - t);
      prevHit = at - t;
      if (!hits) at += 0.03 + b.rand() * 0.03;
    }
    const tok = hits ? Math.max(0.2, prevHit + 0.04) : 0.2;
    return step ? Math.max(end, fillTok(b, t + tok, step) + tok) : end;
  },
  // 설탕: 사락 — 짧은 알갱이 여섯을 흩뿌리고 끝에 솔6 반짝
  sugar(b, t, { step = 0 } = {}) {
    let end = 0;
    for (let i = 0; i < 6; i += 1) {
      const at = t + b.rand() * 0.12;
      end = Math.max(end, burst(b, { t: at, peak: 0.07 * b.vary(0.2), att: 0.0006, dec: 0.003, filters: [['highpass', 1800, 0.7]] }) + at - t);
    }
    end = Math.max(end, tone(b, { f: N.G6, t: t + 0.13, peak: 0.02, att: 0.002, dec: 0.05 }) + 0.13);
    return step ? Math.max(end, fillTok(b, t + 0.19, step) + 0.19) : end;
  },
  // 차갑게: 쨍 — 트라이앵글 솔5 → 라5 → 도6 오르막 + 미6 · 라6 반짝 + 높은 넓은 잡음 휙
  cold(b, t, { step = 0 } = {}) {
    let end = burst(b, { t, peak: 0.1, att: 0.03, dec: 0.06, filters: [['highpass', 3000, 0.7]] });
    [N.G5, N.A5, N.C6].forEach((f, i) => { end = Math.max(end, tone(b, { type: 'triangle', f, t: t + i * 0.045, peak: 0.03, att: 0.002, dec: 0.06 }) + i * 0.045); });
    end = Math.max(end, tone(b, { f: N.E6, t: t + 0.14, peak: 0.016, att: 0.002, dec: 0.08 }) + 0.14, tone(b, { f: N.A6, t: t + 0.16, peak: 0.012, att: 0.002, dec: 0.08 }) + 0.16);
    return step ? Math.max(end, fillTok(b, t + 0.2, step) + 0.2) : end;
  },
  // 넣은 재료 다시 빼기: 사다리 음(빠진 뒤 남은 수의 칸)을 작게
  remove(b, t, { step = 1 } = {}) { return fillTok(b, t, Math.max(1, step), 0.55); },
  // 컵 하나 더: 도자기를 나무 작업대에 내려놓는 톡(솔4 + 도5) + 짧은 딸깍
  cup(b, t) {
    return Math.max(tone(b, { type: 'triangle', f: N.G4, t, peak: 0.06, att: 0.002, dec: 0.08 }), tone(b, { f: N.C5, t, peak: 0.03, att: 0.001, dec: 0.06 }),
      burst(b, { t, peak: 0.08, att: 0.0008, dec: 0.015, filters: [['lowpass', 2600, 0.7]] }));
  },
  // 비우기: 컵을 옆으로 치우는 짧은 쓱
  clear(b, t) { return burst(b, { t, peak: 0.12, att: 0.03, dec: 0.15, filters: [['bandpass', 900, 0.5, 600, 0.15]] }); },
  // 서빙: 나무 위를 미끄러지는 컵(넓은 잡음 70ms) + 내려놓는 톡(솔4 + 도5)
  serve(b, t) {
    const a = burst(b, { t, peak: 0.16, att: 0.015, dec: 0.06, filters: [['bandpass', 700, 0.6, 1200, 0.07]] });
    return Math.max(a, tone(b, { type: 'triangle', f: N.G4, t: t + 0.07, peak: 0.06, att: 0.002, dec: 0.1 }) + 0.07, tone(b, { f: N.C5, t: t + 0.07, peak: 0.03, att: 0.002, dec: 0.08 }) + 0.07);
  },
  // 맞음: 펜타토닉 오르막 네 음(시작음이 연속 단계만큼 위, 5단계 천장) + 끝에 짤랑. 연속 5부터 위 옥타브 겹
  correct(b, t, { combo = 1 } = {}) {
    const k = Math.min(5, Math.max(1, combo)) - 1;   // 0..4
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
  // 주문과 다름: 벌주는 소리 없이 묻는 듯한 두 음(솔4 → 라4) + 아주 작은 톡
  differ(b, t) {
    return Math.max(tone(b, { f: N.G4, t, peak: 0.05, att: 0.01, dec: 0.08 }), tone(b, { f: N.A4, t: t + 0.09, peak: 0.05, att: 0.01, dec: 0.11 }) + 0.09,
      burst(b, { t, peak: 0.04, att: 0.0008, dec: 0.01, filters: [['lowpass', 2000, 0.7]] }));
  },
  // 점심 러시 남은 10초: 똑딱(도6 / 솔5 번갈아, 마지막 셋은 라5 / 도6)
  tick(b, t, { n = 0, last = false } = {}) {
    const f = last ? (n % 2 ? N.A5 : N.C6) : (n % 2 ? N.G5 : N.C6);
    return Math.max(tone(b, { type: 'triangle', f, t, peak: 0.03, att: 0.001, dec: 0.015 }), burst(b, { t, peak: 0.02, att: 0.0005, dec: 0.002, filters: [['highpass', 2500, 0.7]] }));
  },
  // 숫자가 오를 때 한 칸: 라6 아주 짧게 + 잡음 틱(초당 최대 15번 — 부르는 쪽이 간격을 지킨다)
  roll(b, t) { return Math.max(tone(b, { f: N.A6, t, peak: 0.012, att: 0.001, dec: 0.01 }), burst(b, { t, peak: 0.03, att: 0.0005, dec: 0.002, filters: [['highpass', 3000, 0.7]] })); },
  // 큰 숫자가 자리에 앉음: 도6 띵(솔5 겹)
  land(b, t) { return Math.max(wood(b, t, N.C6, 0.9, 0.28), wood(b, t + 0.01, N.G5, 0.6, 0.26) + 0.01); },
  // 영업 끝: 도5 · 미5 · 솔5 · 라5 함께 + 넓은 반짝
  done(b, t) {
    let end = burst(b, { t, peak: 0.05, att: 0.002, dec: 0.02, filters: [['highpass', 3500, 0.7]] });
    // 네 음을 20ms씩 흩어 친다(한꺼번에 치면 봉우리가 겹쳐 리미터가 화음을 뭉갠다 — 11-03 소리재기)
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
  tap: 15.312, coffee: 6.805, tea: 6.644, milk: 6.873, ice: 6.377, sugar: 9.191, cold: 4.501, remove: 14.084,
  cup: 11.96, clear: 9.633, arrive: 4.389, leave: 6.699, open: 5.068, serve: 10.628, correct: 9.7, combo: 4.685,
  differ: 7.463, tick: 27.933, roll: 24.774, land: 5.191, done: 12.322, coin: 6.414,
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

const DUCK = Math.pow(10, -4 / 20);   // 주문 음성이 나오는 동안 효과음 −4dB(조사_소리 「음성 중 효과음」)

/** 게임에서 쓰는 손잡이: 문맥을 받아 bus를 만들고, 이름으로 부른다. on()이 거짓이면 아무것도 내지 않는다. */
export function createSfx(c, { seed = (Date.now() >>> 0), on = () => true, volume = 1 } = {}) {
  const bus = createBus(c, { seed });
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
    /** 주문 음성이 나오는 동안만 내린다. */
    duck(active) { ducked = !!active; apply(); },
  };
}
