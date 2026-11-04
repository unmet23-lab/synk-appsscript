// 말 랠리 — WORLD 캠퍼스 판의 화면 효과음(2026-11-04, 주문 폭주 world-sfx.mjs에서 공통 부품과 화면 소리만 옮겼다). 파일 없이 Web Audio로 그 자리에서 만든다.
// 탁구 손맛(톡 · 틱 · 팅 · 휙 · 스매시)은 sfx.mjs 그대로다 — 여기는 화면 소리뿐이다: 단추 · 시작 · 랠리 칩 · 숫자 굴림 · 숫자 앉음 · 끝 · 코인 · 먼 탁구 소리. LAB 화면은 이 파일을 불러오지 않는다.
//
// 브랜드 사운드킷 셋째 가족 「게임 효과음」 규칙(docs/브랜드_사운드킷/_사운드킷.md, world-sfx.test.mjs가 시험한다):
//   ① 한 소리는 400ms 이하다.  ② 실패음이 없다.  ③ 음이 있는 층은 사인·트라이앵글만 쓴다.  ④ 음높이는 C 펜타토닉(도·레·미·솔·라) 안이다.
// 크기(LEVEL)는 주문 폭주 소리재기.cjs가 잰 값(같은 소리는 같은 값)이고, 새 소리(start · far)는 그 잣대로 qa/world-campus-20261104/소리재기.cjs가 잰다.

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
/**
 * 소리들. 각 소리는 (bus, 시작 시각, 선택) → 끝나는 시각(시작부터 초)을 돌려준다. 모두 0.4초 안에 끝난다.
 * 폰 스피커는 200Hz 아래를 거의 못 내서 음 있는 층의 몸통은 도4(262Hz) 이상이다(조사_소리 「음량 · 폰 스피커」).
 */
export const SOUNDS = {
  // 시작: 공을 탁구대에 두 번 튀기는 나무 두 음(문 종 자리 — 「한 판 하기」)
  start(b, t) {
    return Math.max(wood(b, t, N.G5, 0.8, 0.09), wood(b, t + 0.16, N.C6, 1, 0.14) + 0.16);
  },
  // 먼 탁구대의 공 소리(뒤쪽 두 사람): 아주 작고 먹먹한 딸깍 — 방이 살아 있게. 음성이 나오는 동안은 내지 않는다(world-play.mjs)
  far(b, t, { hi = false } = {}) {
    return burst(b, { t, peak: hi ? 0.05 : 0.04, att: 0.0008, dec: hi ? 0.012 : 0.018, filters: [['bandpass', hi ? 1500 : 1100, 1.1], ['lowpass', 2400, 0.7]] });
  },
  // 연속 셋 · 다섯 · 여덟: 도6 미6 솔6 빠른 세 음
  combo(b, t) { return Math.max(wood(b, t, N.C6, 0.8, 0.12), wood(b, t + 0.07, N.E6, 0.85, 0.12) + 0.07, wood(b, t + 0.14, N.G6, 1, 0.22) + 0.14); },
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

/** 소리마다 전체 크기(K 가중 순간 음량을 맞춘 값). */
export const LEVEL = {
  tap: 15.312, combo: 4.685, tick: 26.082, roll: 24.774, land: 5.191, done: 12.322, coin: 6.414, start: 4.109,
  far: 10.093,
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

const DUCK = Math.pow(10, -4 / 20);   // 태오 목소리가 나오는 동안 효과음 −4dB

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
    /** 태오 목소리가 나오는 동안만 내린다. */
    duck(active) { ducked = !!active; apply(); },
  };
}
