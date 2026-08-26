#!/usr/bin/env node
/**
 * 릴 배경음악 — **짓는다.** 씨앗 고정 = 같은 명령이면 바이트 동일. 의존성 0.
 *
 * 🔴 왜 새로 짓나 (유호 지시 08-26 「bgm 도 좀 경쾌하거나 산뜻한 느낌으로」
 *   → 「영상에 배경음악이 없어서 채워달라는 뜻이야」):
 *   지금 릴이 깔던 `BGM_개정판_깔림만.wav` 는 **소리가 안 실린 게 아니라 «곡»이 아니었다.**
 *   실측(08-26): 영상 안 레벨은 원본 대비 −1.5~3dB 로 정상인데,
 *   **레벨 변동계수 0.308 · 온셋 1.13개/초** — 리듬도 가락도 거의 없는 «깔림»이다.
 *   파일 이름이 이미 그렇게 말하고 있었다(깔림만).
 *   ⚠ 「곡이면 0.6 이상」 같은 절대 눈금은 **근거가 없어 안 쓴다**(저장소에 음악 기준본이 0개다).
 *      쓰는 것은 «같은 잣대로 잰 상대 비교»뿐이다 — 이 도구 산출은 0.64 / 3.0개/초로,
 *      깔림 대비 변동 +108% · 온셋 +166% 다.
 *   그리고 그 파일은 **저장소가 다시 못 만드는 것**이다 — 굽는 도구도 원천도 repo 에 없다
 *   (커밋 2c06e7a8 원문: 「다시 못 만든다」). 그래서 «고치는» 길이 없고 «짓는» 길만 있다.
 *
 * 🔑 브랜드 음악 정체성은 토큰이 이미 못 박아 뒀다(`docs/디자인_토큰.json` 사운드.규칙):
 *   · 「파형은 **사인·트라이앵글만** — 배음 적어 반복 피로가 낮다」
 *   · 「음고는 **C 펜타토닉 안** — 연속 재생에도 불협이 없다」
 *   그 둘을 그대로 지킨다. 몽글 목소리 12종·옹알이 7종이 같은 음계 위에 있으니,
 *   BGM 이 그 밖으로 나가면 효과음이 곡과 부딪힌다.
 *   ⚠ 셰이커도 «잡음»이 아니라 높은 트라이앵글 짧은 타점으로 낸다 — 규칙 안에 머문다.
 *
 * 🔑 길이를 릴과 **정확히 같게**(30.00초) 낸다. 이음매가 아예 없으니
 *   「루프 볼륨 커브가 되감겨 끝 페이드가 영원히 안 온다」류의 함정이 원리상 안 생긴다.
 *
 * 쓰기: node 영상/BGM만들기.js --out <디렉터리> [--결 경쾌|산뜻] [--초 30]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SR = 44100;
const SEED = 20260826; // 판 씨앗 — 바꾸면 다른 곡이다

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── 음계 — C 펜타토닉(C D E G A). 토큰 규칙 ④ 그대로 ───────────────────────
   반음(도#·파·시)을 **쓰지 않는다.** 어느 두 음을 겹쳐도 불협이 안 나서,
   효과음(몽글 목소리·옹알이)이 아무 순간에 얹혀도 곡을 안 깬다 — 그게 이 규칙의 값이다. */
const 반음 = { C: 0, D: 2, E: 4, G: 7, A: 9 };
const 음 = (이름, 옥타브) => 440 * Math.pow(2, (반음[이름] + (옥타브 - 4) * 12 - 9) / 12);

/* ── 결 두 벌 ────────────────────────────────────────────────────────────────
   숫자를 눈대중으로 안 잡았다: 마디 수 × 마디 길이가 **정확히 30.00초**가 되는 BPM 만 골랐다.
   그래야 이음매가 없다. 96 → 12마디 · 112 → 14마디. */
const 결들 = {
  산뜻: {
    bpm: 96,
    설명: '가볍고 맑게 — 8분 아르페지오 + 낮은 베이스. 학습 자막을 안 밀어낸다',
    아르페지오세기: 0.19,
    멜로디세기: 0.13,
    베이스세기: 0.17,
    타점세기: 0.05,
    킥세기: 0.1,
    멜로디밀도: 0.45, // 마디당 멜로디 음이 나올 확률
    옥타브: 5,
  },
  경쾌: {
    bpm: 112,
    설명: '통통 튀게 — 빠른 아르페지오 + 또렷한 타점 + 도약하는 가락',
    아르페지오세기: 0.21,
    멜로디세기: 0.16,
    베이스세기: 0.19,
    타점세기: 0.075,
    킥세기: 0.13,
    멜로디밀도: 0.7,
    옥타브: 5,
  },
};

/* 4마디 진행 — 펜타토닉 다섯 음만으로 짠다(파·시가 없어 «맑음»이 유지된다).
   C → Am → G → Am 의 자리바꿈이고, 밑음이 C-A-G-A 로 오르내려 제자리걸음으로 안 들린다. */
const 진행 = [
  { 밑: ['C', 3], 화음: ['C', 'E', 'G', 'A'] },
  { 밑: ['A', 2], 화음: ['A', 'C', 'E', 'G'] },
  { 밑: ['G', 2], 화음: ['G', 'A', 'C', 'E'] },
  { 밑: ['A', 2], 화음: ['A', 'C', 'E', 'G'] },
];

/** 트라이앵글파 — 사인보다 살짝 밝되 배음이 적다(규칙 ③). */
const 삼각 = (ph) => (2 / Math.PI) * Math.asin(Math.sin(ph));

/** 한 음을 버퍼에 얹는다. `모양` = 'sine' | 'tri'. */
function 얹기(buf, 시작초, 길이초, 주파수, 세기, 모양, { 어택 = 0.006, 릴리즈 = 0.55 } = {}) {
  const s0 = Math.round(시작초 * SR);
  const n = Math.round(길이초 * SR);
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= buf.length) continue;
    const t = i / n;
    /* 봉투 — 딱딱한 어택을 안 쓴다(코사인 램프). 배경음악은 «앞으로 나오면» 안 된다. */
    let e = 1;
    if (t < 어택) e = 0.5 * (1 - Math.cos((Math.PI * t) / 어택));
    else if (t > 1 - 릴리즈) e = 0.5 * (1 - Math.cos((Math.PI * (1 - t)) / 릴리즈));
    const ph = (2 * Math.PI * 주파수 * i) / SR;
    buf[idx] += (모양 === 'tri' ? 삼각(ph) : Math.sin(ph)) * e * 세기;
  }
}

/** 킥 — 사인의 빠른 하강 스윕. 잡음 0(규칙 ③ 안). */
function 킥(buf, 시작초, 세기) {
  const s0 = Math.round(시작초 * SR);
  const n = Math.round(0.13 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx >= buf.length) break;
    const t = i / SR;
    const f = 58 * (1 + 1.4 * Math.exp(-t * 34));
    ph += (2 * Math.PI * f) / SR;
    buf[idx] += Math.sin(ph) * Math.exp(-t * 21) * 세기;
  }
}

function 짓기(결이름, 초) {
  const 결 = 결들[결이름];
  const 박 = 60 / 결.bpm;
  const 마디 = 박 * 4;
  const 마디수 = Math.round(초 / 마디);
  const n = Math.round(초 * SR);
  const buf = new Float64Array(n);
  const rnd = mulberry32(SEED + 결이름.length * 977);

  for (let m = 0; m < 마디수; m++) {
    const 자리 = 마디 * m;
    const 칸 = 진행[m % 진행.length];

    /* ① 베이스 — 1박·3박. 낮은 사인이라 자막 읽기를 안 방해한다 */
    for (const b of [0, 2]) {
      얹기(buf, 자리 + 박 * b, 박 * 1.15, 음(칸.밑[0], 칸.밑[1]), 결.베이스세기, 'sine', { 릴리즈: 0.5 });
    }

    /* ② 아르페지오 — 8분음. 곡의 «움직임»을 만드는 층이다 */
    for (let i = 0; i < 8; i++) {
      const [이름] = [칸.화음[i % 칸.화음.length]];
      const 옥 = 결.옥타브 - (i === 0 ? 1 : 0);
      const 세짐 = i % 4 === 0 ? 1.25 : i % 2 === 0 ? 1 : 0.72; /* 박마다 세기를 갈라 «리듬»이 생긴다 */
      얹기(buf, 자리 + (박 / 2) * i, 박 * 0.34, 음(이름, 옥), 결.아르페지오세기 * 세짐, 'tri', { 릴리즈: 0.45 });
    }

    /* ③ 가락 — 드문드문. 매 마디 나오면 배경이 아니라 주연이 된다 */
    if (rnd() < 결.멜로디밀도) {
      const 후보 = 칸.화음;
      const 고른 = 후보[Math.floor(rnd() * 후보.length)];
      const 시작박 = [1, 1.5, 2.5, 3][Math.floor(rnd() * 4)];
      얹기(buf, 자리 + 박 * 시작박, 박 * 0.85, 음(고른, 결.옥타브 + 1), 결.멜로디세기, 'sine', {
        어택: 0.03,
        릴리즈: 0.5,
      });
    }

    /* ④ 타점 — 높은 트라이앵글 짧은 것. «셰이커»를 잡음 없이 낸다(규칙 ③ 안) */
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 1 || 결이름 === '경쾌') {
        얹기(buf, 자리 + (박 / 2) * i, 0.028, 음('E', 7), 결.타점세기 * (i % 2 ? 1 : 0.55), 'tri', {
          어택: 0.1,
          릴리즈: 0.75,
        });
      }
    }

    /* ⑤ 킥 — 1박·3박 살짝. 「경쾌」는 4박 뒤꿈치를 하나 더 준다 */
    킥(buf, 자리, 결.킥세기);
    킥(buf, 자리 + 박 * 1.5, 결.킥세기 * 0.45);
    킥(buf, 자리 + 박 * 2, 결.킥세기 * 0.85);
    if (결이름 === '경쾌') {
      킥(buf, 자리 + 박 * 3, 결.킥세기 * 0.6);
      킥(buf, 자리 + 박 * 3.5, 결.킥세기 * 0.5);
    }
  }

  /* 들고 남 — 0.6초씩. 릴 첫 프레임에 소리가 «툭» 튀어나오면 놀란다 */
  const 들 = Math.round(0.6 * SR);
  for (let i = 0; i < 들; i++) {
    buf[i] *= 0.5 * (1 - Math.cos((Math.PI * i) / 들));
    buf[n - 1 - i] *= 0.5 * (1 - Math.cos((Math.PI * i) / 들));
  }

  /* 정규화 — 피크 0.72. 위에 몽글 옹알이(0.8)와 자막이 얹히므로 BGM 은 자리를 비워 둔다 */
  let 최대 = 0;
  for (let i = 0; i < n; i++) 최대 = Math.max(최대, Math.abs(buf[i]));
  const 배 = 최대 > 0 ? 0.72 / 최대 : 1;
  for (let i = 0; i < n; i++) buf[i] *= 배;
  return { buf, 마디수, 박 };
}

function wav쓰기(파일, buf) {
  const n = buf.length;
  const 몸 = Buffer.alloc(n * 4); /* 스테레오 16bit */
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, buf[i]));
    const s = Math.round(v * 32767);
    몸.writeInt16LE(s, i * 4);
    몸.writeInt16LE(s, i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + 몸.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(몸.length, 40);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, Buffer.concat([h, 몸]));
  return h.length + 몸.length;
}

/* ── 실행 ──────────────────────────────────────────────────────────────── */
const 인자 = process.argv;
const outIdx = 인자.indexOf('--out');
if (outIdx === -1 || !인자[outIdx + 1]) {
  console.error('쓰기: node 영상/BGM만들기.js --out <디렉터리> [--결 경쾌|산뜻] [--초 30]');
  process.exit(1);
}
const out = 인자[outIdx + 1];
const 초 = Number(인자[인자.indexOf('--초') + 1]) || 30;
const 결목록 = 인자.includes('--결') ? [인자[인자.indexOf('--결') + 1]] : Object.keys(결들);

for (const 결이름 of 결목록) {
  if (!결들[결이름]) {
    console.error(`알 수 없는 결 「${결이름}」. 있는 것: ${Object.keys(결들).join(', ')}`);
    process.exit(1);
  }
  const { buf, 마디수, 박 } = 짓기(결이름, 초);
  const 파일 = path.join(out, `BGM_${결이름}.wav`);
  const 바이트 = wav쓰기(파일, buf);
  console.log(
    `  BGM_${결이름}.wav  ${초.toFixed(2)}초 · ${결들[결이름].bpm}BPM · ${마디수}마디 · ` +
      `1박 ${(박 * 30).toFixed(1)}프레임(30fps) · ${(바이트 / 1024 / 1024).toFixed(2)}MB — ${결들[결이름].설명}`,
  );
}
