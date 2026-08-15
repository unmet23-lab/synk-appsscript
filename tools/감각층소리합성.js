#!/usr/bin/env node
// 감각층 소리 합성 — 펠트 터치 시제품 (정본 = docs/펠트엔진_감각층_설계.md §5 「자가 생성」 통로)
// 원칙: 씨앗 고정 = 같은 명령이면 바이트 동일(재파생 가능성 — 본체 §6-1). 의존성 0.
// 사용: node tools/감각층소리합성.js --out <디렉터리>
// v2 (08-15 · 유호 귀검수 「사각·뭉이 사포 느낌」): 알갱이·뭉을 부드럽게 —
//   LP 하향 + 한 겹 더(-24dB/oct) + hann 봉투(딱딱한 어택 제거) + 낟알 길게.
//   + 옹알이(M) 6종 신설 — 말이 아니다: 낱말·음소 0, 음높이 곡선만(무언의 선생님 원칙).
// v3 (08-15 · 유호 귀검수 2 「A 확정 · 옹알이는 애기 ✗ 고유 생명체 ○」): 옹알이 재합성 —
//   사람 흉내 성분(느린 비브라토·정수 배음)을 빼고, 대신 ①피치 스프링(몸의 젤리 탄성이 목소리에도 —
//   음이 목표에 출렁이며 안착) ②몸통 공명 한 점(전 옹알이 공통 = 한 생명체) ③치켜 올라가는 어택
//   ④비정수 배음(2.01×·3.02×)의 은은한 맥놀이. + 잠꼬대(M7) + 몸 되튐 «몽»(body/boing) 신설.
// 산출: A·B × { tap 4 · grain 8 · press 3 } + M(옹알이 · 프로파일 무관 = 목소리 정체성 1개) 7종 + body 2종
//   (A = 유호 확정 08-15 「a 방향이 맞아」 — B 는 비교 이력용으로만 남긴다)

'use strict';
const fs = require('fs');
const path = require('path');

const SR = 22050;
const SEED_BASE = 20260815; // 판 씨앗 — 바꾸면 다른 판이다(정본 판 = 20260815)

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function biquad(kind, fc, q) {
  const w0 = 2 * Math.PI * fc / SR, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * q);
  let b0, b1, b2;
  if (kind === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
  else if (kind === 'bp') { b0 = al; b1 = 0; b2 = -al; } // 정점 0dB 밴드패스 — 몸통 공명용
  else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; } // hp
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function runBiquad(x, c) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function noise(n, rnd) { const x = new Float64Array(n); for (let i = 0; i < n; i++) x[i] = rnd() * 2 - 1; return x; }
function normalize(x, peak) {
  let m = 0; for (const v of x) m = Math.max(m, Math.abs(v));
  if (m === 0) return x;
  const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; return x;
}
function writeWav(file, x) {
  const n = x.length, data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, x[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
  return { ms: Math.round(n / SR * 1000), bytes: 44 + data.length };
}

// ── 동작 3종 ──────────────────────────────────────────────────────────────
// grain: 쓰다듬기 낟알 — v2: hann 봉투(둥근 어택·둥근 꼬리) + LP 두 겹 = 사포 → 포근
function makeGrain(rnd, p) {
  const dur = (0.06 + rnd() * 0.03) * p.durMul;
  const n = Math.round(SR * dur);
  let x = noise(n, rnd);
  x = runBiquad(x, biquad('hp', 120, 0.71));
  const fc = p.grainLp * (0.88 + rnd() * 0.24);
  x = runBiquad(x, biquad('lp', fc, 0.75));
  x = runBiquad(x, biquad('lp', fc * 1.3, 0.75)); // 한 겹 더 — 고역 가루가 사포의 정체였다
  for (let i = 0; i < n; i++) x[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1))); // hann
  return normalize(x, 0.8);
}
// tap: 톡 — v1 그대로(귀검수에서 지적 없음)
function makeTap(rnd, p) {
  const dur = 0.13 + rnd() * 0.03, n = Math.round(SR * dur);
  const f0 = p.tapF0 * (0.94 + rnd() * 0.12);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 * (1 - 0.25 * (i / n));
    x[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.035);
  }
  let tr = noise(Math.round(SR * 0.014), rnd);
  tr = runBiquad(tr, biquad('lp', p.tapNoiseLp, 0.8));
  for (let i = 0; i < tr.length; i++) x[i] += tr[i] * 0.3 * Math.exp(-i / (tr.length * 0.5));
  return normalize(x, 0.8);
}
// press: 뭉 — v2: LP 하향 + 한 겹 더 + 느린 어택·둥근 꼬리 + 떨림 완화 = 눌러 안기는 소리
function makePress(rnd, p) {
  const dur = 0.34 + rnd() * 0.06, n = Math.round(SR * dur);
  let x = noise(n, rnd);
  const fc = p.pressLp * (0.9 + rnd() * 0.2);
  x = runBiquad(x, biquad('lp', fc, 0.85));
  x = runBiquad(x, biquad('lp', fc * 1.4, 0.85));
  const atk = Math.round(n * 0.36), rel = Math.round(n * 0.5);
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < atk) env = 0.5 * (1 - Math.cos(Math.PI * i / atk));
    else if (i > n - rel) env = 0.5 * (1 - Math.cos(Math.PI * (n - i) / rel));
    const wob = 0.93 + 0.07 * Math.sin(i / SR * 2 * Math.PI * (5.5 + rnd() * 0.1));
    x[i] *= env * wob;
    x[i] += 0.15 * Math.sin(2 * Math.PI * 82 * (i / SR)) * env * Math.exp(-(i / n) * 2.0);
  }
  return normalize(x, 0.72);
}
// murmur v3: 옹알이 — ⚠말이 아니다. 낱말·음소 모사 0 · TTS 0. 음높이 곡선(오르내림)만으로 기분.
//   「애기 ✗ 고유 생명체 ○」(유호 귀검수 2)의 합성 번역:
//   · 사람 성분 제거 — 사람형 느린 비브라토(5.5Hz)·정수 배음 스택을 뺀다.
//   · 피치 스프링 — 몸의 젤리 탄성이 목소리에도: 음높이가 목표 곡선을 스프링(≈9Hz·저감쇠)으로
//     쫓아가 출렁이며 안착한다. 음절 전환·어택마다 «보잉» 잔진동이 저절로 생긴다.
//   · 몸통 공명 한 점(1150Hz BP) — 모든 옹알이 공통. 모음이 아닌 고정 공명 = 한 생명체의 몸.
//   · 치켜 올라가는 어택 — 음절 첫 30ms 를 낮게 시작해 «머릅?» 씨앗.
//   · 비정수 배음(2.01×·3.02×) — 은은한 맥놀이(생물의 미세 흔들림 · 기계음 아님).
function makeMurmur(rnd, syllables, opt) {
  opt = opt || {};
  const GAP = 0.05, TAIL = 0.07;
  const segs = [];
  let total = 0;
  for (let si = 0; si < syllables.length; si++) {
    segs.push({ at: total, y: syllables[si] });
    total += syllables[si].ms / 1000 + (si < syllables.length - 1 ? GAP : 0);
  }
  total += TAIL; // 스프링 잔진동 꼬리
  const n = Math.round(SR * total);
  const target = new Float64Array(n), env = new Float64Array(n);
  let filled = 0;
  for (const s of segs) {
    const s0 = Math.round(SR * s.at), sn = Math.round(SR * s.y.ms / 1000);
    const grace = Math.min(Math.round(SR * 0.03), sn >> 2);
    for (let i = filled; i < s0; i++) target[i] = target[filled - 1] || s.y.f0; // 음절 사이: 직전 값 유지
    for (let i = 0; i < sn && s0 + i < n; i++) {
      const t = i / sn;
      let f = s.y.f0 + (s.y.f1 - s.y.f0) * t;
      if (i < grace) f = s.y.f0 * (0.78 + 0.22 * i / grace);
      target[s0 + i] = f;
      const atk = 0.26, relS = 0.34;
      let e = 1;
      if (t < atk) e = 0.5 * (1 - Math.cos(Math.PI * t / atk));
      else if (t > 1 - relS) e = 0.5 * (1 - Math.cos(Math.PI * (1 - t) / relS));
      env[s0 + i] = e * (s.y.amp || 1);
    }
    filled = Math.min(n, s0 + sn);
  }
  for (let i = filled; i < n; i++) target[i] = target[filled - 1];
  const k = Math.pow(2 * Math.PI * 9.2, 2), c = 2 * 0.21 * Math.sqrt(k); // 고유진동 9.2Hz · 감쇠비 0.21
  const x = new Float64Array(n);
  let p = target[0], v = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    v += (k * (target[i] - p) - c * v) / SR;
    p += v / SR;
    const vib = 1 + 0.010 * Math.sin(2 * Math.PI * 6.3 * i / SR); // 미세 파르르(사람 비브라토 아님)
    ph += 2 * Math.PI * p * vib / SR;
    const tone = Math.sin(ph) + 0.34 * Math.sin(2.01 * ph + 0.4) + 0.08 * Math.sin(3.02 * ph)
      + 0.15 * Math.sin(0.5 * ph); // 옥타브 아래 한 겹 — 작은 몸의 온기
    x[i] = tone * env[i];
  }
  const res = runBiquad(x, biquad('bp', 1150, 5)); // 몸통 공명 — 전 옹알이 공통(정체성)
  const mix = new Float64Array(n);
  for (let i = 0; i < n; i++) mix[i] = 0.68 * x[i] + 0.45 * res[i];
  const out = runBiquad(mix, biquad('lp', opt.lp || 1900, 0.8));
  const br = runBiquad(noise(n, rnd), biquad('lp', 850, 0.8));
  for (let i = 0; i < n; i++) out[i] += br[i] * (opt.breath || 0.016);
  return normalize(out, opt.peak || 0.6);
}
// boing: 몸 되튐 «몽» — 꾹 눌렀다 놓으면 몸이 낮게 튕겨 돌아온다(목소리 아님 · 몸의 소리)
function makeBoing(rnd) {
  const dur = 0.15 + rnd() * 0.02, n = Math.round(SR * dur);
  const x = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 86 * (1 + 0.6 * Math.exp(-t * 26));
    ph += 2 * Math.PI * f / SR;
    const wob = 1 + 0.22 * Math.exp(-t * 9) * Math.sin(2 * Math.PI * 12.5 * t);
    const env = Math.exp(-t * 13) * Math.min(1, i / (SR * 0.004));
    x[i] = (Math.sin(ph) + 0.28 * Math.sin(2 * ph)) * env * wob;
  }
  let tick = noise(Math.round(SR * 0.02), rnd);
  tick = runBiquad(tick, biquad('lp', 480, 0.8));
  for (let i = 0; i < tick.length; i++) x[i] += tick[i] * 0.25 * Math.exp(-i / (tick.length * 0.4));
  return normalize(x, 0.5);
}
// 옹알이 어휘 7 — 이름은 기분이지 뜻이 아니다(언어 0) · v3: 곡선 상향 조율 + 잠꼬대 신설
const MURMURS = [
  { 이름: '만족', syl: [{ ms: 320, f0: 470, f1: 380 }] },
  { 이름: '만족2', syl: [{ ms: 150, f0: 420, f1: 450 }, { ms: 290, f0: 485, f1: 370 }] },
  { 이름: '궁금', syl: [{ ms: 230, f0: 410, f1: 590 }] },
  { 이름: '반김', syl: [{ ms: 120, f0: 390, f1: 505 }, { ms: 170, f0: 530, f1: 465 }] },
  { 이름: '간지럼', syl: [{ ms: 90, f0: 545, f1: 615, amp: 0.85 }, { ms: 90, f0: 585, f1: 650, amp: 0.9 }, { ms: 115, f0: 625, f1: 505 }] },
  { 이름: '잠깸', syl: [{ ms: 250, f0: 325, f1: 350, amp: 0.8 }, { ms: 210, f0: 400, f1: 545 }] },
  { 이름: '잠꼬대', syl: [{ ms: 360, f0: 345, f1: 315, amp: 0.55 }, { ms: 300, f0: 330, f1: 298, amp: 0.45 }], opt: { lp: 1050, breath: 0.028, peak: 0.42 } },
];

// 프로파일 — A: 포근·낮음(깊은 펠트) / B: 밝은 사각(보풀 결이 또렷) · v2에서 둘 다 부드럽게 하향
const PROFILES = {
  A: { grainLp: 750, tapF0: 140, tapNoiseLp: 900, pressLp: 400, durMul: 1.1 },
  B: { grainLp: 1450, tapF0: 170, tapNoiseLp: 1600, pressLp: 650, durMul: 0.95 },
};
const COUNTS = { tap: 4, grain: 8, press: 3 };
const MAKERS = { tap: makeTap, grain: makeGrain, press: makePress };

function main() {
  const outIdx = process.argv.indexOf('--out');
  if (outIdx === -1 || !process.argv[outIdx + 1]) {
    console.error('사용: node tools/감각층소리합성.js --out <디렉터리>');
    process.exit(1);
  }
  const outRoot = process.argv[outIdx + 1];
  const rows = [];
  for (const [prof, p] of Object.entries(PROFILES)) {
    const dir = path.join(outRoot, prof);
    fs.mkdirSync(dir, { recursive: true });
    for (const [kind, count] of Object.entries(COUNTS)) {
      for (let i = 0; i < count; i++) {
        const seed = SEED_BASE + prof.charCodeAt(0) * 1000 + kind.length * 100 + i;
        const rnd = mulberry32(seed);
        const x = MAKERS[kind](rnd, p);
        const file = path.join(dir, `${kind}_${i + 1}.wav`);
        const info = writeWav(file, x);
        rows.push({ 파일: `${prof}/${kind}_${i + 1}.wav`, ms: info.ms, bytes: info.bytes });
      }
    }
  }
  const mDir = path.join(outRoot, 'M');
  fs.mkdirSync(mDir, { recursive: true });
  MURMURS.forEach((m, i) => {
    const rnd = mulberry32(SEED_BASE + 77000 + i);
    const x = makeMurmur(rnd, m.syl, m.opt);
    const file = path.join(mDir, `murmur_${i + 1}.wav`);
    const info = writeWav(file, x);
    rows.push({ 파일: `M/murmur_${i + 1}.wav (${m.이름})`, ms: info.ms, bytes: info.bytes });
  });
  const bDir = path.join(outRoot, 'body');
  fs.mkdirSync(bDir, { recursive: true });
  for (let i = 0; i < 2; i++) {
    const rnd = mulberry32(SEED_BASE + 88000 + i);
    const x = makeBoing(rnd);
    const file = path.join(bDir, `boing_${i + 1}.wav`);
    const info = writeWav(file, x);
    rows.push({ 파일: `body/boing_${i + 1}.wav`, ms: info.ms, bytes: info.bytes });
  }
  const total = rows.reduce((s, r) => s + r.bytes, 0);
  console.log(`[감각층소리합성 v3] ${rows.length}개 = A·B ${COUNTS.tap + COUNTS.grain + COUNTS.press}×2 + 옹알이 ${MURMURS.length} + 몸 2 · 합계 ${(total / 1024).toFixed(1)}KB · 씨앗 ${SEED_BASE}`);
  for (const r of rows) console.log(`  ${r.파일}  ${r.ms}ms  ${(r.bytes / 1024).toFixed(1)}KB`);
}
main();
