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
// v4 (08-15 · 유호 귀검수 3 「전체 너무 빠르다 → 차분하게 · 더 하이톤의 귀여운 생명체」):
//   차분 = 시간축을 늘린다 — 옹알이 음절 ~1.5× 길게 + 음절 간격 2배 + 꼬리 길게 + 어택·릴리즈 둥글게
//   + 스프링 느리게(9.2→6.8Hz — 출렁임은 남기고 조급함만 뺀다) + 낟알·뭉·톡·«몽» 전부 길고 느리게.
//   하이톤 = 음높이 축을 올린다 — 곡선 전체 ~1.4× 위로 + 몸통 공명 1150→1480Hz(작은 몸) +
//   저역 온기층 축소(0.15→0.07) + LP 상향(1900→2700 — 올라간 배음이 숨쉬게).
// v5 (08-15 · 유호 귀검수 4 「귀여운 느낌은 있는데 상큼한 느낌이 없어」): 옹알이만 — 속도·음높이 유지,
//   ①어택 크리스프(0.34→0.22 — 첫입은 톡, 꼬리는 여전히 둥글게) ②밝기 개방(LP 3400·3차 배음 강화
//   +4차 한 방울·저역 온기 0.07→0.05·숨소리 절반) ③이슬 «핑» — 음절 머리에 1.9~2.4kHz 초소형 반짝
//   ④말끝 치켜(flick) — 만족·반김·간지럼 끝을 살짝 올린다(상승 억양=상큼). 잠꼬대는 전부 제외(자는 소리).
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
  const dur = (0.09 + rnd() * 0.045) * p.durMul; // v4: 낟알 길게 — 촘촘한 재촉이 아니라 느긋한 결
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
  const dur = 0.17 + rnd() * 0.03, n = Math.round(SR * dur); // v4: 여운 길게 — «톡» 이 아니라 «토옥»
  const f0 = p.tapF0 * (0.94 + rnd() * 0.12);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 * (1 - 0.25 * (i / n));
    x[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.05);
  }
  let tr = noise(Math.round(SR * 0.014), rnd);
  tr = runBiquad(tr, biquad('lp', p.tapNoiseLp, 0.8));
  for (let i = 0; i < tr.length; i++) x[i] += tr[i] * 0.3 * Math.exp(-i / (tr.length * 0.5));
  return normalize(x, 0.8);
}
// press: 뭉 — v2: LP 하향 + 한 겹 더 + 느린 어택·둥근 꼬리 + 떨림 완화 = 눌러 안기는 소리
function makePress(rnd, p) {
  const dur = 0.44 + rnd() * 0.07, n = Math.round(SR * dur); // v4: 더 길고 느리게 — 천천히 안기는 «무웅»
  let x = noise(n, rnd);
  const fc = p.pressLp * (0.9 + rnd() * 0.2);
  x = runBiquad(x, biquad('lp', fc, 0.85));
  x = runBiquad(x, biquad('lp', fc * 1.4, 0.85));
  const atk = Math.round(n * 0.36), rel = Math.round(n * 0.5);
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < atk) env = 0.5 * (1 - Math.cos(Math.PI * i / atk));
    else if (i > n - rel) env = 0.5 * (1 - Math.cos(Math.PI * (n - i) / rel));
    const wob = 0.93 + 0.07 * Math.sin(i / SR * 2 * Math.PI * (4.0 + rnd() * 0.1));
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
  /* 🔑 간격·치켜·굴림은 «가이드 결»이 바꾸는 손잡이다(기본값은 v5 그대로 = 몽글 판이 안 흔들린다).
     · 간격 — 음절 사이 숨. 좁히면 재잘거림이 된다
     · 치켜 — 말끝을 올리는 정도. 크면 장난스러운 물음표가 붙는다
     · 굴림 — 음절 안에서 음이 한 번 출렁인다. 「삐딱함」이 여기서 난다 */
  const GAP = (opt.간격 ?? 1) * 0.1, TAIL = 0.13; // v4: 음절 사이 숨 고르기 2배 — 재잘거림이 아니라 나긋한 옹알이
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
      if (s.y.flick && t > 0.85) f *= 1 + 0.08 * (opt.치켜 ?? 1) * ((t - 0.85) / 0.15); // v5: 말끝 살짝 치켜 — 상승 억양=상큼
      /* 굴림 — 음절 한가운데서 음이 한 번 출렁인다. 0 이면 v5 원판과 «바이트가 같다» */
      if (opt.굴림) f *= 1 + opt.굴림 * Math.sin(2 * Math.PI * 1.6 * t) * Math.min(1, t * 4);
      target[s0 + i] = f;
      const atk = opt.atk || 0.22, relS = 0.44; // v5: 첫입은 톡(크리스프), 꼬리는 둥글게(v4) — 상큼의 절반은 어택이다
      let e = 1;
      if (t < atk) e = 0.5 * (1 - Math.cos(Math.PI * t / atk));
      else if (t > 1 - relS) e = 0.5 * (1 - Math.cos(Math.PI * (1 - t) / relS));
      env[s0 + i] = e * (s.y.amp || 1);
    }
    filled = Math.min(n, s0 + sn);
  }
  for (let i = filled; i < n; i++) target[i] = target[filled - 1];
  const k = Math.pow(2 * Math.PI * 6.8, 2), c = 2 * 0.24 * Math.sqrt(k); // v4: 6.8Hz·ζ0.24 — 출렁임은 남기고 조급함만 뺀다
  const x = new Float64Array(n);
  let p = target[0], v = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    v += (k * (target[i] - p) - c * v) / SR;
    p += v / SR;
    const vib = 1 + 0.008 * Math.sin(2 * Math.PI * 6.3 * i / SR); // 미세 파르르(사람 비브라토 아님)
    ph += 2 * Math.PI * p * vib / SR;
    /* 악기 갈래 — `opt.악기` 가 없으면 아래 몽글 식 그대로(바이트 불변). 있으면 그 «배음표»로 낸다.
       🔑 목소리를 가르는 것은 값이 아니라 «악기»다(유호 반려 08-27~28 의 교훈) — 같은 식에서
          음높이·속도만 바꾸면 원리상 「같은 목소리의 흉내」가 된다. 사운드킷 확정 악기와 같은 표를 쓴다. */
    let tone;
    if (opt.악기) {
      tone = 0;
      let 합 = 0;
      for (const [배, 세기] of opt.악기.배음) { tone += 세기 * Math.sin(배 * ph); 합 += 세기; }
      tone /= 합;
      if (opt.악기.그로울) {  // 각진 그르렁(tanh 스퍼터) — 용의 몸이 내는 떨림
        const g = opt.악기.그로울;
        const m = Math.tanh(3 * Math.sin(2 * Math.PI * g.속도 * i / SR));
        tone *= 1 - g.깊이 * (0.5 + 0.5 * m);
      }
      tone *= 2.2;  // 배음 정규화로 줄어든 몸집 보정(아래 normalize 가 최종 피크를 잡는다)
    } else {
      tone = Math.sin(ph) + 0.34 * Math.sin(2.01 * ph + 0.4) + 0.16 * Math.sin(3.02 * ph)
        + 0.05 * Math.sin(4.03 * ph + 0.9) // v5: 고차 배음 강화 — 밝음·맑음(상큼의 몸통)
        + 0.05 * Math.sin(0.5 * ph); // v5: 옥타브 아래 더 축소 — 온기는 남기고 흐림만 뺀다
    }
    x[i] = tone * env[i];
  }
  const res = runBiquad(x, biquad('bp', opt.악기?.공명 || 1480, 5)); // v4: 몸통 공명 상향 — 더 작은 몸 = 더 귀여운 공명
  const mix = new Float64Array(n);
  for (let i = 0; i < n; i++) mix[i] = 0.68 * x[i] + 0.45 * res[i];
  const out = runBiquad(mix, biquad('lp', opt.lp || 3400, 0.8)); // v5: 밝기 개방 2700→3400
  if (opt.sparkle !== 0 && !opt.악기?.반짝끔) {
    // v5: 이슬 «핑» — 음절 머리마다 아주 작은 고음 방울 하나(이슬·과즙의 반짝). LP 뒤에 얹어 크리스프하게.
    for (const s of segs) {
      const s0 = Math.round(SR * s.at);
      const pf = 1900 + rnd() * 500;
      const pn = Math.round(SR * 0.045);
      for (let i = 0; i < pn && s0 + i < n; i++) {
        const t = i / SR;
        out[s0 + i] += Math.sin(2 * Math.PI * pf * t) * Math.exp(-t * 90) * 0.09 * (s.y.amp || 1);
      }
    }
  }
  const br = runBiquad(noise(n, rnd), biquad('lp', 850, 0.8));
  for (let i = 0; i < n; i++) out[i] += br[i] * (opt.breath || 0.012); // v5: 숨소리 절반 — 뽀얀 김을 걷어 맑게
  return normalize(out, opt.peak || 0.6);
}
// boing: 몸 되튐 «몽» — 꾹 눌렀다 놓으면 몸이 낮게 튕겨 돌아온다(목소리 아님 · 몸의 소리)
function makeBoing(rnd) {
  const dur = 0.19 + rnd() * 0.02, n = Math.round(SR * dur); // v4: 여운 길게 — «몽» 이 아니라 «모옹»
  const x = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 86 * (1 + 0.6 * Math.exp(-t * 18));
    ph += 2 * Math.PI * f / SR;
    const wob = 1 + 0.22 * Math.exp(-t * 7) * Math.sin(2 * Math.PI * 9.5 * t);
    const env = Math.exp(-t * 10) * Math.min(1, i / (SR * 0.004));
    x[i] = (Math.sin(ph) + 0.28 * Math.sin(2 * ph)) * env * wob;
  }
  let tick = noise(Math.round(SR * 0.02), rnd);
  tick = runBiquad(tick, biquad('lp', 480, 0.8));
  for (let i = 0; i < tick.length; i++) x[i] += tick[i] * 0.25 * Math.exp(-i / (tick.length * 0.4));
  return normalize(x, 0.5);
}
// 옹알이 어휘 7 — 이름은 기분이지 뜻이 아니다(언어 0) · v4: 음절 ~1.5× 길게(차분)+곡선 ~1.4× 위로(하이톤)
// v5: flick(말끝 치켜)로 상큼 — 하강 곡선(따뜻함)은 유지하되 끝만 살짝 올린다 · 잠꼬대는 상큼 전부 제외
const MURMURS = [
  { 이름: '만족', syl: [{ ms: 480, f0: 650, f1: 525, flick: true }] },
  { 이름: '만족2', syl: [{ ms: 220, f0: 580, f1: 620 }, { ms: 430, f0: 670, f1: 510, flick: true }] },
  { 이름: '궁금', syl: [{ ms: 340, f0: 565, f1: 815 }] },
  { 이름: '반김', syl: [{ ms: 180, f0: 540, f1: 700 }, { ms: 260, f0: 730, f1: 640, flick: true }] },
  { 이름: '간지럼', syl: [{ ms: 130, f0: 750, f1: 850, amp: 0.85 }, { ms: 130, f0: 810, f1: 900, amp: 0.9 }, { ms: 170, f0: 865, f1: 700, flick: true }] },
  { 이름: '잠깸', syl: [{ ms: 380, f0: 450, f1: 485, amp: 0.8 }, { ms: 320, f0: 555, f1: 755 }] },
  { 이름: '잠꼬대', syl: [{ ms: 540, f0: 480, f1: 435, amp: 0.55 }, { ms: 450, f0: 455, f1: 412, amp: 0.45 }], opt: { lp: 1450, breath: 0.028, peak: 0.42, atk: 0.36, sparkle: 0 } },
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
    console.error('사용: node tools/감각층소리합성.js --out <디렉터리> [--가이드 몽글|까몽]');
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
  /* ── 가이드 결 (2026-08-26 신설) ────────────────────────────────────────
   * `--가이드 까몽` 을 주면 옹알이만 «까몽의 결»로 낸다. 인자를 안 주면 **바이트가 안 바뀐다**
   *   (아래 결 표의 몽글 줄이 전부 1배 · 대조로 확인함).
   * 🔑 값의 근거는 이 파일이 아니라 `docs/캐릭터/가이드_정본.md` §2 다 —
   *   「소리 결: 몽글 = 높고 둥근 / 까몽 = 장난기(통통 튀며 약 올리는 곡선)」.
   *   ⚠ 옛 근거 「까몽 = 낮고 짧은 · 말 빈도 거의 안 함」은 **v1.0 축이고 유호 판정 08-27 로 반려됐다**
   *     (정본 §2 머리말 — 「셋 다 말이 많다. 갈리는 것은 말의 «결»이다」). 인용하지 마라. */
  const 가이드결 = {
    몽글: { 피치: 1, 길이: 1, lp: 1, peak: 1 },
    /* 🔴 까몽 = **아기 용**(유호 확정 08-28 「이제 목소리는 좋아」 · 사운드킷 확정 악기와 같은 배음표).
     *
     * ■ 08-29 개정 — «값 변주»에서 «악기 교체»로
     *   전 판은 몽글의 배음식(1+0.34·2+0.16·3+…)에 피치·길이만 곱한 것이었다. 그런데 유호님이
     *   사운드킷에서 그 방식을 정확히 반려하셨다 — 「몽글이 성대모사한 느낌 · 완전 달라야」(08-27).
     *   🔑 **목소리를 가르는 것은 값이 아니라 악기다.** 그래서 배음표 자체를 확정 악기(아기 용)로 갈고,
     *   각진 그르렁(tanh 스퍼터)을 얹고, 몸통 공명을 낮추고(더 큰 몸), 이슬 반짝은 껐다(용에겐 안 맞는다).
     * ■ 유지한 것 — 개구쟁이 손잡이 넷(유호 지시 08-26 「옹알이보다 개구쟁이 느낌으로」)
     *   짧고 빠르게(길이 0.7·간격 0.5) · 말끝 치켜(2.6) · 음절 안 출렁(굴림 0.045) · 밝기는 안 내린다(lp 1.0).
     *   ⚠ 밝기를 내리면 장난기가 아니라 «시무룩»이 난다 — 첫 판(lp 0.72)이 그래서 폐기됐다.
     * ■ 피치 0.86 → 0.72: 확정 악기의 자리(247~554Hz)에 옹알이도 들어가야 «같은 목의 소리»로 들린다.
     *   낮아져도 안 어두운 이유가 배음표다(도톰한 2·3배음) — 그게 악기 교체의 값이다. */
    까몽: {
      피치: 0.72, 길이: 0.7, lp: 1, peak: 0.92, 간격: 0.5, 치켜: 2.6, 굴림: 0.045,
      악기: {
        배음: [[1, 1], [2, 0.55], [3, 0.22], [4, 0.08]],  // = 사운드킷 「아기 용」 확정 배음표
        그로울: { 속도: 30, 깊이: 0.35 },                  // 각 스퍼터 — 그르렁
        공명: 1180,                                        // 몸통 공명 하향(1480→) = 더 큰 몸
        반짝끔: true,                                      // 이슬 «핑» 제거 — 몽글의 어휘다
      },
    },
  };
  const gIdx = process.argv.indexOf('--가이드');
  const 가이드 = gIdx === -1 ? '몽글' : process.argv[gIdx + 1];
  const 결 = 가이드결[가이드];
  if (!결) {
    console.error(`알 수 없는 가이드 「${가이드}」. 있는 것: ${Object.keys(가이드결).join(', ')}`);
    process.exit(1);
  }

  const mDir = path.join(outRoot, 'M');
  fs.mkdirSync(mDir, { recursive: true });
  MURMURS.forEach((m, i) => {
    const rnd = mulberry32(SEED_BASE + 77000 + i);
    const syl = 결.피치 === 1 && 결.길이 === 1
      ? m.syl
      : m.syl.map((y) => ({ ...y, ms: Math.round(y.ms * 결.길이), f0: y.f0 * 결.피치, f1: y.f1 * 결.피치 }));
    const 기본결 = 결.lp === 1 && 결.peak === 1 && !결.간격 && !결.치켜 && !결.굴림 && !결.악기;
    const opt = 기본결
      ? m.opt
      : {
          ...(m.opt || {}),
          lp: Math.round((m.opt?.lp || 3400) * 결.lp),
          peak: (m.opt?.peak || 0.6) * 결.peak,
          간격: 결.간격,
          치켜: 결.치켜,
          굴림: 결.굴림,
          악기: 결.악기,
        };
    const x = makeMurmur(rnd, syl, opt);
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
  console.log(`[감각층소리합성 v5] ${rows.length}개 = A·B ${COUNTS.tap + COUNTS.grain + COUNTS.press}×2 + 옹알이 ${MURMURS.length} + 몸 2 · 합계 ${(total / 1024).toFixed(1)}KB · 씨앗 ${SEED_BASE}`);
  for (const r of rows) console.log(`  ${r.파일}  ${r.ms}ms  ${(r.bytes / 1024).toFixed(1)}KB`);
}
main();
