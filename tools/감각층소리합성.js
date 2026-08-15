#!/usr/bin/env node
// 감각층 소리 합성 — 펠트 터치 시제품 (정본 = docs/펠트엔진_감각층_설계.md §5 「자가 생성」 통로)
// 원칙: 씨앗 고정 = 같은 명령이면 바이트 동일(재파생 가능성 — 본체 §6-1). 의존성 0.
// 사용: node tools/감각층소리합성.js --out <디렉터리>
// v2 (08-15 · 유호 귀검수 「사각·뭉이 사포 느낌」): 알갱이·뭉을 부드럽게 —
//   LP 하향 + 한 겹 더(-24dB/oct) + hann 봉투(딱딱한 어택 제거) + 낟알 길게.
//   + 옹알이(M) 6종 신설 — 말이 아니다: 낱말·음소 0, 음높이 곡선만(무언의 선생님 원칙).
// 산출: A·B × { tap 4 · grain 8 · press 3 } + M(옹알이 · 프로파일 무관 = 목소리 정체성 1개) 6종

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
// murmur: 옹알이 — ⚠말이 아니다. 낱말·음소 모사 0 · TTS 0. 음높이 곡선(오르내림)만으로 기분.
//   음절 = {ms, f0시작, f0끝, 세기} — 사인 + 배음 2개 + 미세 비브라토 + 숨결 노이즈 한 톨.
function makeMurmur(rnd, syllables) {
  const GAP = 0.05;
  const total = syllables.reduce((s, y) => s + y.ms / 1000, 0) + GAP * (syllables.length - 1);
  const n = Math.round(SR * total);
  const x = new Float64Array(n);
  let cursor = 0;
  for (let si = 0; si < syllables.length; si++) {
    const y = syllables[si];
    const sn = Math.round(SR * y.ms / 1000);
    let ph = 0;
    for (let i = 0; i < sn; i++) {
      const t = i / sn;
      const vib = 1 + 0.015 * Math.sin(2 * Math.PI * 5.5 * (i / SR));
      const f = (y.f0 + (y.f1 - y.f0) * t) * vib * (0.99 + rnd() * 0.02 * 0); // rnd 자리 유지(결정론)
      ph += 2 * Math.PI * f / SR;
      const atk = 0.3, relS = 0.35;
      let env = 1;
      if (t < atk) env = 0.5 * (1 - Math.cos(Math.PI * t / atk));
      else if (t > 1 - relS) env = 0.5 * (1 - Math.cos(Math.PI * (1 - t) / relS));
      const tone = Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph);
      x[cursor + i] += tone * env * (y.amp || 1);
    }
    cursor += sn + Math.round(SR * GAP);
  }
  let out = runBiquad(x, biquad('lp', 1800, 0.8)); // 목소리 아닌 «톤»으로 뭉근하게
  const br = runBiquad(noise(n, rnd), biquad('lp', 900, 0.8));
  for (let i = 0; i < n; i++) out[i] += br[i] * 0.02;
  return normalize(out, 0.6);
}
// 옹알이 어휘 6 — 이름은 기분이지 뜻이 아니다(언어 0)
const MURMURS = [
  { 이름: '만족', syl: [{ ms: 300, f0: 420, f1: 350 }] },
  { 이름: '만족2', syl: [{ ms: 150, f0: 380, f1: 405 }, { ms: 300, f0: 430, f1: 335 }] },
  { 이름: '궁금', syl: [{ ms: 220, f0: 380, f1: 530 }] },
  { 이름: '반김', syl: [{ ms: 130, f0: 350, f1: 455 }, { ms: 180, f0: 480, f1: 430 }] },
  { 이름: '간지럼', syl: [{ ms: 100, f0: 520, f1: 585, amp: 0.9 }, { ms: 120, f0: 560, f1: 470 }] },
  { 이름: '잠깸', syl: [{ ms: 240, f0: 300, f1: 330, amp: 0.85 }, { ms: 200, f0: 380, f1: 505 }] },
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
    const x = makeMurmur(rnd, m.syl);
    const file = path.join(mDir, `murmur_${i + 1}.wav`);
    const info = writeWav(file, x);
    rows.push({ 파일: `M/murmur_${i + 1}.wav (${m.이름})`, ms: info.ms, bytes: info.bytes });
  });
  const total = rows.reduce((s, r) => s + r.bytes, 0);
  console.log(`[감각층소리합성 v2] ${rows.length}개 = A·B ${COUNTS.tap + COUNTS.grain + COUNTS.press}×2 + 옹알이 ${MURMURS.length} · 합계 ${(total / 1024).toFixed(1)}KB · 씨앗 ${SEED_BASE}`);
  for (const r of rows) console.log(`  ${r.파일}  ${r.ms}ms  ${(r.bytes / 1024).toFixed(1)}KB`);
}
main();
