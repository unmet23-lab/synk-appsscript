#!/usr/bin/env node
/**
 * 실시간 음성 상황극 듣기 시험 녹음(2026-10-29) — 대본.mjs의 세 장면을 엔진 · 목소리마다 같은 학습자 소리로 넣고
 * AI 상대역이 한 말을 줄마다 받는다. 엮은 판은 유호님이 귀로 고르는 비교 페이지로 간다.
 *
 *   node 녹음.mjs 학습자                        학습자 줄을 한 번 굽는다(대본의 학습자목소리) — 모든 엔진에 같은 소리
 *   node 녹음.mjs live <장면|전부> <목소리>      gpt-live-1(듣기와 말하기를 함께 하는 전이중) · 예: live 전부 noeul
 *   node 녹음.mjs realtime <장면|전부> <목소리>  gpt-realtime-2.1 · 예: realtime 전부 marin
 *   node 녹음.mjs gemini <장면|전부> <목소리>    gemini-3.8-live(무료 등급 키) · 예: gemini 전부 Kore
 *   node 녹음.mjs 엮기                          줄마다 크기를 맞추고 장면 × 목소리마다 대화 한 판(mp3)과 결과.json을 만든다
 *
 * - 소리는 마이크처럼 100ms씩 실제 속도로 보낸다(학습자 줄 → 침묵). 차례 감지는 엔진 것을 그대로 쓴다 —
 *   GPT-Live는 모델이 스스로, Realtime은 semantic_vad(eagerness low: 학습자가 머뭇거려도 기다리게, 제품에 쓸 설정),
 *   Gemini는 자동 활동 감지(END_SENSITIVITY_LOW · 침묵 1초 — 같은 뜻으로 맞춤). Gemini 입력은 16kHz라 학습자 줄을 ffmpeg로 한 번 바꿔 둔다.
 * - 상대역 1번 줄은 엔진이 먼저 말한다. 받아쓰기를 대본과 견줘(일치) 0.85 아래이거나 빠진 줄이 있으면 그 장면을
 *   한 번 더 받고 나은 쪽을 고른다(--시도 N). 두 시도 기록은 모두 남긴다.
 * - 키는 tools/GPT콘티굽기.mjs와 같은 차례(OPENAI_KEY_FILE → ~/SYNK_보안/openai_키목록.json, 「까지」 지난 키는 건너뜀)로
 *   고르고 값은 찍지 않는다. 연결 · 시작이 키 문제로 막히면 다음 키로 넘긴다. 결제 수단 없는 무료 크레딧 조직의 키뿐이다.
 *   Gemini는 tools/모델정책.js의 「글」 무료 키(~/SYNK_보안/제미나이_무료.txt, 결제 없는 프로젝트)만 쓴다 — 무료 등급은 보낸 내용이
 *   학습에 쓰이므로 지어낸 내부 대본만 넣는다. 유료 키로 넘어가지 않는다.
 * - 원본 WAV와 시도 기록은 .tmp/realtime-roleplay-20261029/(git 무시)에, 엮은 mp3는 이 폴더 소리/에 둔다. 결과.json과
 *   판만들기.mjs의 듣기판.html은 qa 결과라 커밋하지 않는다(.gitignore 10-20) — 숫자는 조사.md 「듣기 시험 1판」 표.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import 대본 from './대본.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '..', '..', '..', '..', '..');
const 작업 = process.env.SYNK_ROLEPLAY_WORK || path.join(저장소, '.tmp', 'realtime-roleplay-20261029');
const 바탕 = (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const 소켓바탕 = 바탕.replace(/^http/, 'ws');
const 보안 = path.join(os.homedir(), 'SYNK_보안');
const 목록파일 = process.env.SYNK_OPENAI_KEYLIST || path.join(보안, 'openai_키목록.json');

const 표본율 = 24000;
const 조각ms = 100;
const 엔진 = {
  live: { 모델: 'gpt-live-1', 이름: 'GPT-Live' },
  realtime: { 모델: 'gpt-realtime-2.1', 이름: 'Realtime 2.1' },
  gemini: { 모델: 'gemini-3.8-live', 이름: 'Gemini 3.8 Live' },
};
const 제미나이소켓 = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
// Gemini 3.8 Live 유료 값(무료 등급은 0원) — 글 입력 $0.75 · 음성 입력 $3 · 글 출력 $4.50 · 음성 출력 $12 /100만 토큰(Gemini API 값 10-29). 「유료였다면」 어림에만 쓴다.
const 제미나이값 = { 글입력: 0.75e-6, 음성입력: 3e-6, 글출력: 4.5e-6, 음성출력: 12e-6 };
// USD — GPT-Live 분당 $0.05, 2.1 음성 입력 $32 · 출력 $64 · 캐시 $0.40 /100만 토큰(조사.md 10-29). 글 토큰 값과 학습자 TTS는 어림.
const 값 = { live분: 0.05, 음성입력: 32e-6, 음성출력: 64e-6, 캐시: 0.4e-6, 글입력: 4e-6, 글출력: 16e-6, tts분: 0.015 };

function 멈춤(말, 코드 = 2) {
  console.error(`[녹음] ${말}`);
  process.exit(코드);
}
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));

/** 쓸 키 차례 — 이름과 파일만. 값은 부르기 직전에 읽는다(GPT콘티굽기.mjs와 같은 규칙). */
function 키차례() {
  if (process.env.OPENAI_KEY_FILE) return [{ 이름: path.basename(process.env.OPENAI_KEY_FILE), 파일: process.env.OPENAI_KEY_FILE }];
  if (!fs.existsSync(목록파일)) return [{ 이름: 'openai.txt', 파일: path.join(보안, 'openai.txt') }];
  const 목록 = JSON.parse(fs.readFileSync(목록파일, 'utf8').replace(/^﻿/, ''));
  if (!Array.isArray(목록)) 멈춤(`키 목록은 [{이름, 파일, 까지?}] 배열이어야 한다: ${목록파일}`);
  return 목록
    .filter((k) => !k.까지 || Date.now() < Date.parse(`${k.까지}T00:00:00+09:00`))
    .map((k) => ({ 이름: k.이름 || k.파일, 파일: path.isAbsolute(k.파일) ? k.파일 : path.join(path.dirname(목록파일), k.파일) }));
}
function 키읽기({ 이름, 파일 }) {
  if (!fs.existsSync(파일)) 멈춤(`키 파일이 없다(${이름}): ${파일}`);
  const v = fs.readFileSync(파일, 'utf8').replace(/^﻿/, '').trim();
  if (!/^sk-\S+$/.test(v)) 멈춤(`키 파일에 sk- 로 시작하는 값이 없다(${이름}): ${파일}`);
  return v;
}

// ── 소리 파일 ──
function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(표본율, 24);
  h.writeUInt32LE(표본율 * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function wav읽기(파일) {
  const b = fs.readFileSync(파일);
  let i = 12;
  let 형식 = null;
  while (i + 8 <= b.length) {
    const 이름 = b.toString('ascii', i, i + 4);
    const 크기 = b.readUInt32LE(i + 4);
    if (이름 === 'fmt ') 형식 = { 채널: b.readUInt16LE(i + 10), 표본율: b.readUInt32LE(i + 12), 비트: b.readUInt16LE(i + 22) };
    if (이름 === 'data') {
      if (!형식 || 형식.채널 !== 1 || 형식.표본율 !== 표본율 || 형식.비트 !== 16) 멈춤(`24kHz 16비트 모노 WAV가 아니다: ${파일}`);
      return b.subarray(i + 8, i + 8 + 크기);
    }
    i += 8 + 크기 + (크기 % 2);
  }
  멈춤(`WAV data 칸이 없다: ${파일}`);
}
/** 앞뒤 무음을 잘라 「말이 끝난 때 = 파일 끝」이 되게 한다(지연을 말끝에서 재려고). */
function 다듬기(pcm, 문턱 = 0.012, 여유ms = 60) {
  const n = pcm.length >> 1;
  const 틀 = 표본율 / 100;
  const 큼 = (s) => {
    let m = 0;
    for (let j = Math.max(0, s); j < Math.min(n, s + 틀); j++) m = Math.max(m, Math.abs(pcm.readInt16LE(j * 2)) / 32768);
    return m;
  };
  let a = 0;
  while (a < n && 큼(a) < 문턱) a += 틀;
  let b = n;
  while (b > a && 큼(b - 틀) < 문턱) b -= 틀;
  const 여유 = (표본율 * 여유ms) / 1000;
  return pcm.subarray(Math.max(0, a - 여유) * 2, Math.min(n, b + 여유) * 2);
}
const 초 = (pcm) => pcm.length / 2 / 표본율;

// ── 대본과 견주기 ──
const 숫자맞춤 = [[/4,?500\s*원/g, '사천오백원'], [/8\s*시/g, '여덟시'], [/12\s*시/g, '열두시'], [/1\s*시/g, '한시'], [/2\s*층/g, '이층'], [/1\s*잔/g, '한잔']];
function 정규(s) {
  let t = String(s || '').normalize('NFC');
  for (const [a, b] of 숫자맞춤) t = t.replace(a, b);
  return t.replace(/[\s.,!?…~'"“”‘’·:;()「」\-]/g, '');
}
function 일치(대본줄, 받은) {
  const a = [...정규(대본줄)];
  const b = [...정규(받은)];
  if (!a.length && !b.length) return 1;
  let 앞 = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const 지금 = [i];
    for (let j = 1; j <= b.length; j++) 지금[j] = Math.min(앞[j] + 1, 지금[j - 1] + 1, 앞[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    앞 = 지금;
  }
  return Number((1 - 앞[b.length] / Math.max(a.length, b.length)).toFixed(3));
}

function 지시문(장면) {
  const 줄 = 장면.줄.map((l) => `${l.누가 === '상대역' ? '상대역' : '학습자'}: ${l.말}`).join('\n');
  return `${대본.공통지시}\n\n장면: ${장면.이름}. 너의 역할: ${장면.상대역}. 연기: ${장면.연기}\n\n대본:\n${줄}`;
}

// ── 학습자 줄 굽기 ──
async function 키로부르기(부르기) {
  const 키들 = 키차례();
  for (const [i, k] of 키들.entries()) {
    const res = await 부르기(키읽기(k));
    if (res.ok) return { res, 키: k.이름 };
    const 글 = await res.text();
    const 코드 = /"code":\s*"([^"]+)"/.exec(글)?.[1] || '';
    if ((코드 === 'credit_balance_exhausted' || res.status === 401 || res.status === 403) && i < 키들.length - 1) {
      console.error(`[녹음] ${k.이름} 키: ${res.status} ${코드} — 다음 키(${키들[i + 1].이름})로`);
      continue;
    }
    멈춤(`오류(${k.이름}) ${res.status} ${코드}: ${글.slice(0, 300)}`, 1);
  }
  멈춤('쓸 수 있는 키가 없다', 3);
}
async function 학습자굽기(덮어쓰기) {
  const 목소리 = 대본.학습자목소리;
  const 기록 = [];
  for (const 장면 of 대본.장면) {
    const 줄들 = 장면.줄.filter((l) => l.누가 === '학습자');
    for (const [i, 줄] of 줄들.entries()) {
      const 나갈 = path.join(작업, '학습자', `${장면.id}_${i + 1}.wav`);
      if (fs.existsSync(나갈) && !덮어쓰기) {
        console.log(`[녹음] 있음 ${path.relative(작업, 나갈)}`);
        continue;
      }
      const { res, 키 } = await 키로부르기((v) => fetch(`${바탕}/audio/speech`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 목소리.모델, voice: 목소리.목소리, input: 줄.말, instructions: 목소리.지시, response_format: 'pcm' }),
      }));
      const pcm = 다듬기(Buffer.from(await res.arrayBuffer()));
      fs.mkdirSync(path.dirname(나갈), { recursive: true });
      fs.writeFileSync(나갈, wav(pcm));
      기록.push({ 장면: 장면.id, 번호: i + 1, 말: 줄.말, 초: Number(초(pcm).toFixed(2)), 키, 요청: res.headers.get('x-request-id') });
      console.log(`[녹음] 학습자 ${장면.id}_${i + 1} ${초(pcm).toFixed(2)}초 · 키 ${키}`);
    }
  }
  if (기록.length) {
    const 합초 = 기록.reduce((n, r) => n + r.초, 0);
    fs.writeFileSync(path.join(작업, '학습자', '기록.json'), `${JSON.stringify({ 때: new Date().toISOString(), 모델: 목소리.모델, 목소리: 목소리.목소리, 줄: 기록, 어림값USD: Number(((합초 / 60) * 값.tts분).toFixed(4)) }, null, 2)}\n`);
  }
}

// ── 실시간 연결 ──
class 소켓 {
  constructor(ws) {
    this.ws = ws;
    this.기다림 = [];
    this.듣기 = null;
    ws.addEventListener('message', (ev) => {
      const e = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (e.error) e.type ??= 'error';
      e.받은 = performance.now();
      this.듣기?.(e);
      for (const w of [...this.기다림]) {
        if (w.조건(e)) {
          this.기다림.splice(this.기다림.indexOf(w), 1);
          w.res(e);
        }
      }
    });
    ws.addEventListener('close', (ev) => {
      this.닫힘 = `${ev.code} ${ev.reason || ''}`.trim();
      for (const w of this.기다림.splice(0)) w.rej(new Error(`소켓이 닫혔다(${this.닫힘}) — ${w.이름} 기다리던 중`));
    });
  }
  보내기(o) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o));
  }
  기다리기(조건, ms, 이름) {
    return new Promise((res, rej) => {
      const w = { 조건, res, rej, 이름 };
      this.기다림.push(w);
      setTimeout(() => {
        const i = this.기다림.indexOf(w);
        if (i >= 0) {
          this.기다림.splice(i, 1);
          rej(new Error(`${이름}을 ${ms}ms 기다렸다`));
        }
      }, ms);
    });
  }
}
// Gemini는 JSON을 이진 틀로 보낸다 — 기본(blob)이면 풀기가 비동기라 뒤 틀이 먼저 처리돼 소리가 빠졌다(10-29). ArrayBuffer로 받아 차례를 지킨다.
function 열기(주소, 머리, 이름) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(주소, { headers: 머리 });
    ws.binaryType = 'arraybuffer';
    const 실패 = (e) => rej(Object.assign(new Error(`연결 실패(${이름}) ${e?.message || ''}`), { 다음키: true }));
    ws.addEventListener('error', 실패, { once: true });
    ws.addEventListener('open', () => {
      ws.removeEventListener('error', 실패);
      res(ws);
    }, { once: true });
  });
}
/** 마이크처럼 100ms마다 실제 속도로 보낸다. 넣은 줄이 없으면 침묵. 넣기()는 그 줄의 소리가 끝나는 시각으로 풀린다. */
class 소리펌프 {
  constructor(보내기, 율 = 표본율) {
    this.보내기 = 보내기;
    this.율 = 율;
    this.조각바이트 = (율 * 2 * 조각ms) / 1000;
    this.대기 = [];
    this.지금 = null;
    this.보낸조각 = 0;
    this.침묵 = Buffer.alloc(this.조각바이트);
  }
  시작하기() {
    this.시작 = performance.now();
    this.돌기();
  }
  넣기(pcm) {
    return new Promise((res) => this.대기.push({ pcm, res, 자리: 0 }));
  }
  돌기() {
    if (this.꺼짐) return;
    const 목표 = Math.floor((performance.now() - this.시작) / 조각ms) + 1;
    while (this.보낸조각 < 목표) {
      if (!this.지금 && this.대기.length) this.지금 = this.대기.shift();
      let 조각 = this.침묵;
      if (this.지금) {
        const 줄 = this.지금;
        조각 = 줄.pcm.subarray(줄.자리, 줄.자리 + this.조각바이트);
        const 실제 = 조각.length;
        줄.자리 += 실제;
        if (실제 < this.조각바이트) 조각 = Buffer.concat([조각, Buffer.alloc(this.조각바이트 - 실제)]);
        if (줄.자리 >= 줄.pcm.length) {
          this.지금 = null;
          // 이 조각은 시작 + 보낸조각 × 100ms부터 흐르는 소리다 — 말끝은 그 안의 실제 바이트 끝
          줄.res(this.시작 + this.보낸조각 * 조각ms + (실제 / 2 / this.율) * 1000);
        }
      }
      this.보내기(조각);
      this.보낸조각++;
    }
    this.타이머 = setTimeout(() => this.돌기(), 10);
  }
  끄기() {
    this.꺼짐 = true;
    clearTimeout(this.타이머);
  }
}
const 새답 = (번호) => ({ 번호, 소리: [], 글: '', 첫소리: null, 마지막소리: null, 끝남: false });
const 알림 = (답) => console.error(`  · ${답.번호}번 ${답.빠짐 ? '빠짐' : 답.잘림 ? '잘림' : 'ok'} 지연 ${답.학습자끝 && 답.첫소리 ? Math.round(답.첫소리 - 답.학습자끝) : '-'}ms 「${답.글.trim().slice(0, 60)}」`);
const 답길이ms = (답) => (답.소리.reduce((n, b) => n + b.length, 0) / 2 / 표본율) * 1000;
/** 답이 다 나오고(조용 1.5초 또는 응답 끝 표시) 듣는 사람이 다 들었을 때(첫 소리 + 길이 + 0.6초)까지 기다린다. */
async function 답끝(답, { 첫소리기한, 끝표시 = false }) {
  const 시작 = performance.now();
  for (;;) {
    await 쉼(100);
    const 지금 = performance.now();
    if (!답.첫소리) {
      if (지금 - 시작 > 첫소리기한) {
        답.빠짐 = true;
        return;
      }
      continue;
    }
    const 다나옴 = 끝표시 ? 답.끝남 : 지금 - 답.마지막소리 > 1500;
    if (다나옴 && 지금 > 답.첫소리 + 답길이ms(답) + 600) return;
    if (지금 - 시작 > 60000) {
      답.잘림 = true;
      return;
    }
  }
}

// GPT-Live는 말하지 않을 때도 출력 소리(무음)를 이어서 보낸다(10-29 첫 시도에서 「조용 1.5초」가 오지 않아 줄마다 60초를 다 기다림).
// 그래서 답의 처음 · 끝을 도착 시각이 아니라 소리 안의 목소리(20ms 틀 RMS)로 잡고, 목소리 뒤 무음 1.3초를 답 끝으로 본다.
const 목소리문턱 = 0.015;
const 틀바이트 = (표본율 / 50) * 2;
function 출력분석(출력, b, 받은, 답) {
  출력.조각.push(b);
  출력.바이트 += b.length;
  출력.마지막도착 = 받은;
  const 버퍼 = Buffer.concat([출력.남은, b]);
  let 자리 = 0;
  for (; 자리 + 틀바이트 <= 버퍼.length; 자리 += 틀바이트) {
    let 합 = 0;
    for (let j = 자리; j < 자리 + 틀바이트; j += 2) {
      const v = 버퍼.readInt16LE(j) / 32768;
      합 += v * v;
    }
    const 위치 = 출력.분석 + 자리;
    if (답 && 위치 >= 답.시작바이트 && Math.sqrt(합 / (틀바이트 / 2)) > 목소리문턱) {
      if (답.첫바이트 == null) {
        답.첫바이트 = 위치;
        답.첫소리 = 받은;
      }
      답.끝바이트 = 위치 + 틀바이트;
    }
  }
  출력.분석 += 자리;
  출력.남은 = 버퍼.subarray(자리);
}
async function live답끝(답, 출력, 기한) {
  const 시작 = performance.now();
  for (;;) {
    await 쉼(100);
    const 지금 = performance.now();
    if (답.첫바이트 == null) {
      if (지금 - 시작 > 기한) {
        답.빠짐 = true;
        return;
      }
      continue;
    }
    const 뒤무음ms = ((출력.분석 - 답.끝바이트) / 2 / 표본율) * 1000;
    const 끊김 = 지금 - 출력.마지막도착 > 1500;
    const 말ms = ((답.끝바이트 - 답.첫바이트) / 2 / 표본율) * 1000;
    if ((뒤무음ms >= 1300 || 끊김) && 지금 > 답.첫소리 + 말ms + 600) return;
    if (지금 - 시작 > 60000) {
      답.잘림 = true;
      return;
    }
  }
}

async function live돌리기({ 키, 목소리, 지시, 학습자줄, 상대줄 }) {
  const ws = new 소켓(await 열기(`${소켓바탕}/live/sessions`, { Authorization: `Bearer ${키읽기(키)}` }, 키.이름));
  const 첫줄 = `지금 바로 상대역 1번 줄을 글자 그대로 말한다: 「${상대줄[0]}」 그다음 학습자가 말할 때까지 기다린다.`;
  const 답들 = [];
  const 입력글 = [];
  const 오류 = [];
  const 종류 = {};
  const 출력 = { 조각: [], 바이트: 0, 분석: 0, 남은: Buffer.alloc(0), 마지막도착: 0 };
  let 지금답 = null;
  let 학습자칸 = -1;
  let 사용 = null;
  const 새live답 = (번호) => ({ ...새답(번호), 시작바이트: 출력.바이트 });
  ws.듣기 = (e) => {
    종류[e.type] = (종류[e.type] || 0) + 1;
    if (e.type === 'session.output_audio.delta') {
      출력분석(출력, Buffer.from(e.delta, 'base64'), e.받은, 지금답);
    } else if (e.type === 'session.output_transcript.delta') {
      if (지금답) 지금답.글 += e.delta;
    } else if (e.type === 'session.input_transcript.delta') {
      if (학습자칸 >= 0) 입력글[학습자칸] = (입력글[학습자칸] || '') + e.delta;
    } else if (e.type === 'session.closed') {
      사용 = e.usage;
    } else if (e.type === 'error') {
      오류.push(e.error);
    }
  };
  ws.보내기({
    type: 'session.start',
    event_id: 'start',
    session: {
      model: 엔진.live.모델,
      instructions: 지시,
      input: [{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: 첫줄 }] }],
      audio: { format: { type: 'audio/pcm', rate: 표본율 }, output: { voice: 목소리 } },
      delegation: { type: 'client' },
    },
  });
  const 시작 = await ws.기다리기((e) => e.type === 'session.started' || e.type === 'error', 20000, 'session.started');
  if (시작.type === 'error') throw Object.assign(new Error(`시작 거절: ${시작.error?.code} ${시작.error?.message}`), { 다음키: /credit|quota|auth|key|permission/i.test(`${시작.error?.code}`) });
  const 펌프 = new 소리펌프((조각) => ws.보내기({ type: 'session.input_audio.append', audio: 조각.toString('base64') }));
  지금답 = 새live답(1);
  답들.push(지금답);
  펌프.시작하기();
  ws.보내기({ type: 'session.instructions.append', event_id: 'greet', delegation_id: null, content: 첫줄 });
  await live답끝(지금답, 출력, 12000);
  알림(지금답);
  for (const [i, pcm] of 학습자줄.entries()) {
    지금답 = 새live답(i + 2);
    답들.push(지금답);
    학습자칸 = i;
    지금답.학습자끝 = await 펌프.넣기(pcm);
    await live답끝(지금답, 출력, 12000);
    알림(지금답);
  }
  지금답 = null;
  await 쉼(1000);
  ws.보내기({ type: 'session.close', event_id: 'close' });
  await ws.기다리기((e) => e.type === 'session.closed', 20000, 'session.closed').catch((e) => 오류.push({ message: e.message }));
  펌프.끄기();
  ws.ws.close();
  // 답마다 목소리 구간만(앞 0.12초 · 뒤 0.3초 여유) 잘라 낸다
  const 전체 = Buffer.concat(출력.조각);
  const 여유 = (ms) => Math.round((표본율 * ms) / 1000) * 2;
  for (const 답 of 답들) {
    답.소리 = 답.첫바이트 == null ? [] : [전체.subarray(Math.max(답.시작바이트, 답.첫바이트 - 여유(120)), Math.min(전체.length, 답.끝바이트 + 여유(300)))];
  }
  return { 세션: 시작.session?.id, 답들, 입력글, 사용, 오류, 종류, 출력초: Number((전체.length / 2 / 표본율).toFixed(1)), 값USD: ((사용?.seconds || 0) / 60) * 값.live분 };
}

async function realtime돌리기({ 키, 목소리, 지시, 학습자줄 }) {
  const ws = new 소켓(await 열기(`${소켓바탕}/realtime?model=${엔진.realtime.모델}`, { Authorization: `Bearer ${키읽기(키)}` }, 키.이름));
  const 답들 = [];
  const 입력글 = [];
  const 오류 = [];
  const 사용 = { 응답: 0, 글입력: 0, 음성입력: 0, 캐시: 0, 글출력: 0, 음성출력: 0 };
  let 지금답 = null;
  ws.듣기 = (e) => {
    if (e.type === 'response.output_audio.delta') {
      if (!지금답) return;
      지금답.소리.push(Buffer.from(e.delta, 'base64'));
      지금답.첫소리 ??= e.받은;
      지금답.마지막소리 = e.받은;
    } else if (e.type === 'response.output_audio_transcript.delta') {
      if (지금답) 지금답.글 += e.delta;
    } else if (e.type === 'response.created') {
      if (지금답) 지금답.끝남 = false;
    } else if (e.type === 'response.done') {
      // 학습자 말 중간 쉼에서 차례를 잘못 넘겨 시작한 응답은 학습자가 이어 말하면 cancelled(turn_detected)로 끝난다 —
      // 그 응답은 답 끝으로 치지 않는다(10-29 「저는 뚜자라고 합니다. / 잘 부탁드립니다.」에서 실측)
      if (지금답 && e.response?.status !== 'cancelled') 지금답.끝남 = true;
      const u = e.response?.usage;
      if (u) {
        const 안 = u.input_token_details || {};
        const 캐시 = 안.cached_tokens_details || {};
        사용.응답++;
        사용.글입력 += (안.text_tokens || 0) - (캐시.text_tokens || 0);
        사용.음성입력 += (안.audio_tokens || 0) - (캐시.audio_tokens || 0);
        사용.캐시 += 안.cached_tokens || 0;
        사용.글출력 += u.output_token_details?.text_tokens || 0;
        사용.음성출력 += u.output_token_details?.audio_tokens || 0;
      }
      if (e.response?.status && e.response.status !== 'completed') 오류.push({ 상태: e.response.status, 까닭: e.response.status_details });
    } else if (e.type === 'conversation.item.input_audio_transcription.completed') {
      입력글.push(e.transcript);
    } else if (e.type === 'error') {
      오류.push(e.error);
    }
  };
  const 생성 = await ws.기다리기((e) => e.type === 'session.created' || e.type === 'error', 20000, 'session.created');
  if (생성.type === 'error') throw Object.assign(new Error(`연결 거절: ${생성.error?.code} ${생성.error?.message}`), { 다음키: /credit|quota|auth|key|permission/i.test(`${생성.error?.code}`) });
  ws.보내기({
    type: 'session.update',
    session: {
      type: 'realtime',
      instructions: 지시,
      output_modalities: ['audio'],
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 표본율 },
          turn_detection: { type: 'semantic_vad', eagerness: 'low' },
          transcription: { model: 'gpt-4o-mini-transcribe', language: 'ko' },
        },
        output: { format: { type: 'audio/pcm', rate: 표본율 }, voice: 목소리 },
      },
    },
  });
  const 갱신 = await ws.기다리기((e) => e.type === 'session.updated' || e.type === 'error', 20000, 'session.updated');
  if (갱신.type === 'error') throw new Error(`설정 거절: ${갱신.error?.code} ${갱신.error?.message}`);
  const 펌프 = new 소리펌프((조각) => ws.보내기({ type: 'input_audio_buffer.append', audio: 조각.toString('base64') }));
  지금답 = 새답(1);
  답들.push(지금답);
  펌프.시작하기();
  ws.보내기({ type: 'response.create' });
  await 답끝(지금답, { 첫소리기한: 12000, 끝표시: true });
  알림(지금답);
  for (const [i, pcm] of 학습자줄.entries()) {
    지금답 = 새답(i + 2);
    답들.push(지금답);
    지금답.학습자끝 = await 펌프.넣기(pcm);
    await 답끝(지금답, { 첫소리기한: 15000, 끝표시: true });
    알림(지금답);
  }
  지금답 = null;
  await 쉼(1500);
  펌프.끄기();
  ws.ws.close();
  const 값USD = 사용.글입력 * 값.글입력 + 사용.음성입력 * 값.음성입력 + 사용.캐시 * 값.캐시 + 사용.글출력 * 값.글출력 + 사용.음성출력 * 값.음성출력;
  return { 세션: 생성.session?.id, 답들, 입력글, 사용, 오류, 값USD };
}

async function gemini돌리기({ 키값, 목소리, 지시, 학습자줄, 상대줄 }) {
  const ws = new 소켓(await 열기(제미나이소켓, { 'x-goog-api-key': 키값 }, 'Gemini 무료 키'));
  const 답들 = [];
  const 입력글 = [];
  const 오류 = [];
  const 쓰임 = [];
  let 지금답 = null;
  let 학습자칸 = -1;
  let 마지막쓰임 = null;
  ws.듣기 = (e) => {
    if (e.usageMetadata) 마지막쓰임 = e.usageMetadata;
    const sc = e.serverContent;
    if (!sc) return;
    for (const p of sc.modelTurn?.parts || []) {
      if (!p.inlineData?.data || !지금답) continue;
      지금답.소리.push(Buffer.from(p.inlineData.data, 'base64'));
      지금답.첫소리 ??= e.받은;
      지금답.마지막소리 = e.받은;
      지금답.끝남 = false;
    }
    if (sc.outputTranscription?.text && 지금답) 지금답.글 += sc.outputTranscription.text;
    if (sc.inputTranscription?.text && 학습자칸 >= 0) 입력글[학습자칸] = (입력글[학습자칸] || '') + sc.inputTranscription.text;
    if (sc.interrupted) {
      // 학습자 말 사이 쉼에서 시작한 답이 이어진 말에 끊겼다 — 그 소리는 버리고 진짜 답을 기다린다(Realtime의 취소와 같은 셈)
      오류.push({ 상태: 'cancelled', 까닭: 'interrupted' });
      if (지금답) Object.assign(지금답, { 소리: [], 글: '', 첫소리: null, 마지막소리: null, 끝남: false });
    }
    if (sc.turnComplete) {
      if (지금답 && 지금답.소리.length) 지금답.끝남 = true;
      if (마지막쓰임) 쓰임.push(마지막쓰임);
      마지막쓰임 = null;
    }
  };
  ws.보내기({
    setup: {
      model: `models/${엔진.gemini.모델}`,
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 목소리 } } } },
      systemInstruction: { parts: [{ text: 지시 }] },
      realtimeInputConfig: { automaticActivityDetection: { endOfSpeechSensitivity: 'END_SENSITIVITY_LOW', silenceDurationMs: 1000 } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  });
  const 시작 = await ws.기다리기((e) => e.setupComplete || e.type === 'error', 20000, 'setupComplete');
  if (시작.type === 'error') throw new Error(`시작 거절: ${JSON.stringify(시작.error).slice(0, 300)}`);
  const 펌프 = new 소리펌프((조각) => ws.보내기({ realtimeInput: { audio: { data: 조각.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } }), 16000);
  지금답 = 새답(1);
  답들.push(지금답);
  펌프.시작하기();
  ws.보내기({ clientContent: { turns: [{ role: 'user', parts: [{ text: `(상황극 시작) 지금 상대역 1번 줄을 글자 그대로 말한다: 「${상대줄[0]}」 그다음 학습자가 말할 때까지 기다린다.` }] }], turnComplete: true } });
  await 답끝(지금답, { 첫소리기한: 12000, 끝표시: true });
  알림(지금답);
  for (const [i, pcm] of 학습자줄.entries()) {
    지금답 = 새답(i + 2);
    답들.push(지금답);
    학습자칸 = i;
    지금답.학습자끝 = await 펌프.넣기(pcm);
    await 답끝(지금답, { 첫소리기한: 15000, 끝표시: true });
    알림(지금답);
  }
  지금답 = null;
  await 쉼(1500);
  펌프.끄기();
  ws.ws.close();
  // 쓰임: 차례마다 마지막 usageMetadata를 더한다(무료 등급이라 실제 값은 0원, 「유료였다면」만 셈)
  const 합 = { 글입력: 0, 음성입력: 0, 글출력: 0, 음성출력: 0, 생각: 0 };
  for (const u of 쓰임) {
    for (const d of u.promptTokensDetails || []) 합[d.modality === 'AUDIO' ? '음성입력' : '글입력'] += d.tokenCount || 0;
    for (const d of u.responseTokensDetails || []) 합[d.modality === 'AUDIO' ? '음성출력' : '글출력'] += d.tokenCount || 0;
    합.생각 += u.thoughtsTokenCount || 0;
  }
  const 유료였다면USD = 합.글입력 * 제미나이값.글입력 + 합.음성입력 * 제미나이값.음성입력 + (합.글출력 + 합.생각) * 제미나이값.글출력 + 합.음성출력 * 제미나이값.음성출력;
  return { 세션: null, 답들, 입력글, 사용: { ...합, 차례: 쓰임.length }, 오류, 값USD: 0, 유료였다면USD };
}

/** Gemini 입력용 16kHz 학습자 줄 — 24kHz WAV를 ffmpeg로 한 번 바꿔 .tmp에 둔다. */
function 학습자16k(파일24k) {
  const 나갈 = path.join(작업, '학습자16k', path.basename(파일24k).replace(/\.wav$/i, '.pcm'));
  if (!fs.existsSync(나갈)) {
    fs.mkdirSync(path.dirname(나갈), { recursive: true });
    ff(['-i', 파일24k, '-ar', '16000', '-ac', '1', '-f', 's16le', 나갈]);
  }
  return fs.readFileSync(나갈);
}

async function 장면받기(엔진키, 장면, 목소리, 시도번호) {
  const 학습자줄 = 장면.줄.filter((l) => l.누가 === '학습자').map((_, i) => {
    const 파일 = path.join(작업, '학습자', `${장면.id}_${i + 1}.wav`);
    if (!fs.existsSync(파일)) 멈춤(`학습자 줄이 없다 — 먼저 \`node 녹음.mjs 학습자\`: ${파일}`);
    return 엔진키 === 'gemini' ? 학습자16k(파일) : wav읽기(파일);
  });
  const 상대줄 = 장면.줄.filter((l) => l.누가 === '상대역').map((l) => l.말);
  let 결과;
  let 쓴키;
  if (엔진키 === 'gemini') {
    const 정책 = createRequire(import.meta.url)(path.join(저장소, 'tools', '모델정책.js'));
    const 키값 = 정책.제미나이키('글');
    if (!키값) 멈춤(정책.제미나이키안내('글'));
    결과 = await gemini돌리기({ 키값, 목소리, 지시: 지시문(장면), 학습자줄, 상대줄 });
    쓴키 = 'Gemini 무료 키(결제 없는 프로젝트)';
  }
  const 돌리기 = 엔진키 === 'live' ? live돌리기 : realtime돌리기;
  const 키들 = 엔진키 === 'gemini' ? [] : 키차례();
  for (const [i, 키] of 키들.entries()) {
    try {
      결과 = await 돌리기({ 키, 목소리, 지시: 지시문(장면), 학습자줄, 상대줄 });
      쓴키 = 키.이름;
      break;
    } catch (e) {
      if (!e.다음키 || i === 키들.length - 1) throw e;
      console.error(`[녹음] ${키.이름}: ${e.message} — 다음 키(${키들[i + 1].이름})로`);
    }
  }
  const 폴더 = path.join(작업, `${엔진키}_${목소리}`, `시도${시도번호}`);
  fs.mkdirSync(폴더, { recursive: true });
  const 줄 = 결과.답들.map((답, i) => {
    const pcm = Buffer.concat(답.소리);
    const 파일 = path.join(폴더, `${장면.id}_${i + 1}.wav`);
    if (pcm.length) fs.writeFileSync(파일, wav(pcm));
    return {
      번호: i + 1, 대본: 상대줄[i], 받아쓰기: 답.글.trim(), 일치: 일치(상대줄[i], 답.글),
      초: Number(초(pcm).toFixed(2)),
      지연ms: 답.학습자끝 && 답.첫소리 ? Math.round(답.첫소리 - 답.학습자끝) : null,
      빠짐: !!답.빠짐, 잘림: !!답.잘림, 파일: pcm.length ? path.relative(작업, 파일).replaceAll('\\', '/') : null,
    };
  });
  return {
    때: new Date().toISOString(), 엔진: 엔진키, 모델: 엔진[엔진키].모델, 목소리, 장면: 장면.id, 시도: 시도번호, 키: 쓴키, 세션: 결과.세션,
    줄, 학습자받아쓰기: 결과.입력글, 사용: 결과.사용, 어림값USD: Number(결과.값USD.toFixed(4)), 오류: 결과.오류,
    ...(결과.종류 ? { 이벤트: 결과.종류, 출력초: 결과.출력초 } : {}),
    ...(결과.유료였다면USD != null ? { 무료등급: true, 유료였다면USD: Number(결과.유료였다면USD.toFixed(4)) } : {}),
  };
}

const 최저일치 = (r) => Math.min(...r.줄.map((l) => (l.빠짐 ? 0 : l.일치)));
async function 녹음하기(엔진키, 장면고르기, 목소리, 시도수) {
  const 장면들 = 장면고르기 === '전부' ? 대본.장면 : 대본.장면.filter((s) => s.id === 장면고르기);
  if (!장면들.length) 멈춤(`없는 장면: ${장면고르기} (전부 | ${대본.장면.map((s) => s.id).join(' | ')})`);
  for (const 장면 of 장면들) {
    const 시도들 = [];
    for (let n = 1; n <= 시도수; n++) {
      const r = await 장면받기(엔진키, 장면, 목소리, n);
      시도들.push(r);
      console.log(`[녹음] ${엔진키} ${목소리} ${장면.id} 시도${n} · 키 ${r.키} · 최저 일치 ${최저일치(r)} · 지연 ${r.줄.map((l) => l.지연ms ?? '-').join('/')}ms · 어림 $${r.어림값USD}${r.오류.length ? ` · 오류 ${r.오류.length}` : ''}`);
      for (const l of r.줄) if (l.일치 < 0.85 || l.빠짐) console.log(`   ${l.번호}번 ${l.빠짐 ? '빠짐' : `일치 ${l.일치}`}: 「${l.받아쓰기}」`);
      if (최저일치(r) >= 0.85) break;
    }
    const 고른 = 시도들.reduce((a, b) => (최저일치(b) > 최저일치(a) ? b : a));
    const 기록 = { 고른시도: 고른.시도, 시도들 };
    fs.writeFileSync(path.join(작업, `${엔진키}_${목소리}`, `${장면.id}_기록.json`), `${JSON.stringify(기록, null, 2)}\n`);
  }
}

// ── 엮기: 줄마다 크기를 맞추고 대화 한 판으로 ──
const 목표LUFS = -18;
function ff(인자) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...인자], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) 멈춤(`ffmpeg 실패: ${인자.join(' ')}\n${(r.stderr || '').slice(-800)}`, 1);
  return r.stderr || '';
}
function 크기(파일) {
  const 출력 = ff(['-nostats', '-i', 파일, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const 요약 = 출력.split('Summary:').pop();
  const i = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(요약)?.[1];
  return i && i !== '-inf' ? Number(i) : null;
}
function 맞추기(원본, 나갈) {
  const i = 크기(원본);
  const 더할 = i === null ? 0 : Math.max(-20, Math.min(20, 목표LUFS - i));
  ff(['-i', 원본, '-af', `volume=${더할.toFixed(2)}dB,alimiter=limit=0.89:attack=2:release=50:level=false`, '-ar', String(표본율), '-ac', '1', '-c:a', 'pcm_s16le', 나갈]);
  return { 원래LUFS: i, 더한dB: Number(더할.toFixed(2)) };
}
function 엮기() {
  const 소리폴더 = path.join(여기, '소리');
  const 맞춤폴더 = path.join(작업, '맞춤');
  fs.mkdirSync(소리폴더, { recursive: true });
  fs.mkdirSync(맞춤폴더, { recursive: true });
  const 사이 = Buffer.alloc(Math.round(표본율 * 0.6) * 2);
  const 판들 = [];
  const 맞춘것 = new Map();
  const 맞춘파일 = (원본) => {
    if (!맞춘것.has(원본)) {
      const 나갈 = path.join(맞춤폴더, path.relative(작업, 원본).replace(/[\\/]/g, '__'));
      맞춘것.set(원본, { 파일: 나갈, ...맞추기(원본, 나갈) });
    }
    return 맞춘것.get(원본);
  };
  const 목소리폴더 = fs.readdirSync(작업).filter((d) => /^(live|realtime|gemini)_/.test(d)).sort();
  for (const 장면 of 대본.장면) {
    for (const 폴더 of 목소리폴더) {
      const 기록파일 = path.join(작업, 폴더, `${장면.id}_기록.json`);
      if (!fs.existsSync(기록파일)) continue;
      const 기록 = JSON.parse(fs.readFileSync(기록파일, 'utf8'));
      const 고른 = 기록.시도들.find((r) => r.시도 === 기록.고른시도);
      const 조각 = [];
      let 학습자번호 = 0;
      let 상대번호 = 0;
      for (const 줄 of 장면.줄) {
        if (조각.length) 조각.push(사이);
        if (줄.누가 === '학습자') {
          학습자번호++;
          조각.push(wav읽기(맞춘파일(path.join(작업, '학습자', `${장면.id}_${학습자번호}.wav`)).파일));
        } else {
          const l = 고른.줄[상대번호++];
          조각.push(l?.파일 ? wav읽기(맞춘파일(path.join(작업, l.파일)).파일) : Buffer.alloc(표본율 * 2));
        }
      }
      const 이름 = `${장면.id}_${폴더}`;
      const 임시 = path.join(작업, `${이름}.wav`);
      fs.writeFileSync(임시, wav(Buffer.concat(조각)));
      const mp3 = path.join(소리폴더, `${이름}.mp3`);
      ff(['-i', 임시, '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
      판들.push({
        장면: 장면.id, 엔진: 고른.엔진, 모델: 고른.모델, 목소리: 고른.목소리, 파일: `소리/${이름}.mp3`,
        초: Number((Buffer.concat(조각).length / 2 / 표본율).toFixed(1)), 시도: 기록.시도들.length, 고른시도: 기록.고른시도,
        줄: 고른.줄.map(({ 파일, ...l }) => ({ ...l, 원래LUFS: 파일 ? 맞춘파일(path.join(작업, 파일)).원래LUFS : null })),
        학습자받아쓰기: 고른.학습자받아쓰기, 어림값USD: Number(기록.시도들.reduce((n, r) => n + r.어림값USD, 0).toFixed(4)), 오류: 고른.오류,
        // 학습자 말 도중 끼어듦: Realtime은 말 사이 쉼에서 시작했다 취소된 응답, GPT-Live는 말끝보다 먼저 나온 첫 소리
        끼어듦: (고른.오류 || []).filter((o) => o.상태 === 'cancelled').length + 고른.줄.filter((l) => typeof l.지연ms === 'number' && l.지연ms < 0).length,
        ...(고른.무료등급 ? { 무료등급: true, 유료였다면USD: Number(기록.시도들.reduce((n, r) => n + (r.유료였다면USD || 0), 0).toFixed(4)) } : {}),
      });
      console.log(`[엮기] ${이름}.mp3`);
    }
  }
  const tts = fs.existsSync(path.join(작업, '학습자', '기록.json')) ? JSON.parse(fs.readFileSync(path.join(작업, '학습자', '기록.json'), 'utf8')) : null;
  const 결과 = {
    때: new Date().toISOString(), 대본: 대본.판, 목표LUFS, 줄사이초: 0.6,
    학습자목소리: { ...대본.학습자목소리, 어림값USD: tts?.어림값USD ?? null },
    판들,
    합계어림USD: Number((판들.reduce((n, p) => n + p.어림값USD, 0) + (tts?.어림값USD || 0)).toFixed(4)),
  };
  fs.writeFileSync(path.join(여기, '결과.json'), `${JSON.stringify(결과, null, 2)}\n`);
  console.log(`[엮기] 판 ${판들.length}개 · 합계 어림 $${결과.합계어림USD}`);
}

const 인자 = process.argv.slice(2);
const 덮어쓰기 = 인자.includes('--덮어쓰기');
const 시도i = 인자.indexOf('--시도');
const 시도수 = 시도i >= 0 ? Math.max(1, Number(인자[시도i + 1]) || 2) : 2;
const [명령, 장면고르기, 목소리] = 인자.filter((a, i) => !a.startsWith('--') && (시도i < 0 || i !== 시도i + 1));
fs.mkdirSync(작업, { recursive: true });
if (명령 === '학습자') await 학습자굽기(덮어쓰기);
else if (명령 === 'live' || 명령 === 'realtime' || 명령 === 'gemini') {
  if (!장면고르기 || !목소리) 멈춤(`사용: node 녹음.mjs ${명령} <장면|전부> <목소리>`);
  await 녹음하기(명령, 장면고르기, 목소리, 시도수);
} else if (명령 === '엮기') 엮기();
else 멈춤('사용: node 녹음.mjs 학습자 | live <장면|전부> <목소리> | realtime <장면|전부> <목소리> | gemini <장면|전부> <목소리> | 엮기');
