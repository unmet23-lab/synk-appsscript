#!/usr/bin/env node
// 감각층 소리 합성 — 펠트 터치 시제품 (정본 = docs/펠트엔진_감각층_설계.md §5 「자가 생성」 통로)
// 원칙: 씨앗 고정 = 같은 명령이면 바이트 동일(재파생 가능성 — 본체 §6-1). 의존성 0.
// 사용: node tools/감각층소리합성.js --out <디렉터리>
// 산출: 프로파일 A(포근·낮음)·B(밝은 사각) × { tap 4 · grain 8 · press 3 } = 30개 WAV(22050Hz·모노·16bit)

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

// RBJ biquad — lowpass / highpass 계수
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
// grain: 쓰다듬기 알갱이(사각) — 짧은 저역 노이즈 낟알. 앱이 속도에 따라 연쇄 재생한다.
function makeGrain(rnd, p) {
  const dur = (0.038 + rnd() * 0.022) * p.durMul;
  const n = Math.round(SR * dur);
  let x = noise(n, rnd);
  x = runBiquad(x, biquad('hp', 180, 0.71));
  x = runBiquad(x, biquad('lp', p.grainLp * (0.88 + rnd() * 0.24), 0.85));
  const atk = Math.round(n * (0.18 + rnd() * 0.12));
  for (let i = 0; i < n; i++) {
    const env = i < atk ? i / atk : Math.exp(-(i - atk) / (n * 0.32));
    x[i] *= env;
  }
  return normalize(x, 0.8);
}
// tap: 톡 — 낮은 사인 썸 + 짧은 저역 노이즈 트랜지언트(펠트라 먹먹하게)
function makeTap(rnd, p) {
  const dur = 0.13 + rnd() * 0.03, n = Math.round(SR * dur);
  const f0 = p.tapF0 * (0.94 + rnd() * 0.12);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 * (1 - 0.25 * (i / n)); // 살짝 내려앉는 음정 = 폭신함
    x[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.035);
  }
  let tr = noise(Math.round(SR * 0.014), rnd);
  tr = runBiquad(tr, biquad('lp', p.tapNoiseLp, 0.8));
  for (let i = 0; i < tr.length; i++) x[i] += tr[i] * 0.3 * Math.exp(-i / (tr.length * 0.5));
  return normalize(x, 0.8);
}
// press: 뭉 — 눌러 들어가는 섬유 압축(느린 스웰 + 낮은 웅)
function makePress(rnd, p) {
  const dur = 0.30 + rnd() * 0.06, n = Math.round(SR * dur);
  let x = noise(n, rnd);
  x = runBiquad(x, biquad('lp', p.pressLp * (0.9 + rnd() * 0.2), 0.9));
  const atk = Math.round(n * 0.28), rel = Math.round(n * 0.42);
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < atk) env = i / atk;
    else if (i > n - rel) env = (n - i) / rel;
    const wob = 0.85 + 0.15 * Math.sin(i / SR * 2 * Math.PI * (7 + rnd() * 0.1));
    x[i] *= env * wob;
    x[i] += 0.18 * Math.sin(2 * Math.PI * 88 * (i / SR)) * env * Math.exp(-(i / n) * 2.2);
  }
  return normalize(x, 0.75);
}

// 프로파일 — A: 포근·낮음(깊은 펠트) / B: 밝은 사각(보풀 결이 또렷)
const PROFILES = {
  A: { grainLp: 1200, tapF0: 140, tapNoiseLp: 900, pressLp: 520, durMul: 1.1 },
  B: { grainLp: 2400, tapF0: 170, tapNoiseLp: 1600, pressLp: 900, durMul: 0.92 },
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
        // 씨앗 = 판 + 프로파일 + 동작 + 번호 — 파일마다 독립·결정론
        const seed = SEED_BASE + prof.charCodeAt(0) * 1000 + kind.length * 100 + i;
        const rnd = mulberry32(seed);
        const x = MAKERS[kind](rnd, p);
        const file = path.join(dir, `${kind}_${i + 1}.wav`);
        const info = writeWav(file, x);
        rows.push({ 파일: `${prof}/${kind}_${i + 1}.wav`, ms: info.ms, bytes: info.bytes });
      }
    }
  }
  const total = rows.reduce((s, r) => s + r.bytes, 0);
  console.log(`[감각층소리합성] ${rows.length}개 = tap ${COUNTS.tap * 2} + grain ${COUNTS.grain * 2} + press ${COUNTS.press * 2} · 합계 ${(total / 1024).toFixed(1)}KB · 씨앗 ${SEED_BASE}`);
  for (const r of rows) console.log(`  ${r.파일}  ${r.ms}ms  ${(r.bytes / 1024).toFixed(1)}KB`);
}
main();
