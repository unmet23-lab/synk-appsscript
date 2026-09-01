#!/usr/bin/env node
/* 목소리굽기 — 문장을 주면 소리가 나온다.
 *
 * 유호님 판정(2026-09-01 「둘 다 너무 좋은데?」)으로 엔진 둘이 섰다.
 * 판정 근거 전량 = `docs/깃허브_정찰_0901.html`. 여기는 그 결론을 «실행»으로 굳힌 자리다.
 *
 *   한국어  → Qwen3-TTS · 목소리 Sohee   (한국어가 «모국어»인 목소리 · 톤을 말로 지시할 수 있다)
 *   몽골어  → OmniVoice                  (600+ 언어 · 몽골어를 싣는 유일한 후보)
 *
 * 🔑 **경로와 모델 이름의 정본은 이 파일 하나다.** 같은 값을 두 곳이 알면 반드시 갈린다.
 *    엔진·가상환경·모델은 저장소 «밖»에 산다 — 엔진은 빌리고 기록은 소유한다.
 *
 * 쓰기:
 *   node tools/목소리굽기.js "안녕하세요. 오늘도 함께 공부해요."
 *   node tools/목소리굽기.js "잘했어요!" --톤 "밝고 신나게, 칭찬하듯"
 *   node tools/목소리굽기.js "Сайн байна уу." --언어 몽골어
 *   node tools/목소리굽기.js "안녕하세요" --출력 docs/소리/인사.wav
 *   node tools/목소리굽기.js --목록
 *
 * ⚠ 실측(2026-09-01 · 전부 CPU): 5초 소리에 17~33초. OmniVoice 는 **모델 적재에만 12분**이
 *   더 든다 — 여러 줄을 뽑을 거면 한 번에 몰아서 부르는 편이 낫다.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

// ── 정본: 빌린 것들이 사는 자리 ────────────────────────────────────────────
const 빌림뿌리 = 'C:\\Users\\q1212\\Documents\\synk-vendor';

// 🔴 **두 엔진은 같은 가상환경에 못 산다**(2026-09-01 실측). qwen-tts 를 omnivoice 옆에 깔면
//    transformers 가 5.16 → 4.57 로 내려가고 omnivoice 가 즉사한다
//    (`ImportError: cannot import name 'HiggsAudioV2TokenizerModel'`). 그래서 환경을 갈라 둔다.
//    둘 다 Intel Arc(XPU) 판 torch 를 쓴다 — `torch==2.12.0+xpu`(CPU 판이 깔려 있으면 조용히 무시되니
//    반드시 uninstall 뒤 설치한다 · pip 은 이 자리에서 45분간 실패했고 uv 는 4분에 끝냈다).

const 엔진표 = {
  qwen: {
    설명: 'Qwen3-TTS — 모국어 목소리(한국어는 Sohee)',
    venv: path.join(빌림뿌리, '.venv-qwen', 'Scripts', 'python.exe'),
    모델: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
    기본목소리: 'Sohee',
  },
  omnivoice: {
    설명: 'OmniVoice — 600+ 언어(몽골어를 싣는 유일한 후보)',
    venv: path.join(빌림뿌리, '.venv-xpu', 'Scripts', 'python.exe'),
    모델: 'k2-fsa/OmniVoice',
    기본목소리: null,            // 참조 없는 auto voice
  },
};

// 언어 이름 → [엔진, 모델에 넘길 언어값]
const 언어표 = {
  '한국어': ['qwen', 'Korean'],
  '몽골어': ['omnivoice', 'Mongolian'],
  '영어':   ['qwen', 'English'],
  '일본어': ['qwen', 'Japanese'],
  '중국어': ['qwen', 'Chinese'],
};

// Qwen CustomVoice 가 쥔 목소리들(모국어) — 한국어는 Sohee 하나뿐이다.
const 목소리표 = {
  Sohee: '한국어 — 따뜻하고 감정이 풍부한 여성',
  Ono_Anna: '일본어 — 가볍고 날렵한 장난기 있는 여성',
  Vivian: '중국어 — 밝고 살짝 날 선 젊은 여성',
  Serena: '중국어 — 따뜻하고 부드러운 젊은 여성',
  Ryan: '영어 — 리듬감 있는 활동적인 남성',
  Aiden: '영어 — 맑은 중음의 밝은 미국 남성',
  Uncle_Fu: '중국어 — 낮고 부드러운 연륜 있는 남성',
};

function 도움말() {
  console.log(`목소리굽기 — 문장을 주면 소리가 나온다

  node tools/목소리굽기.js "<문장>" [--언어 한국어] [--톤 "..."] [--목소리 Sohee] [--출력 경로]
  node tools/목소리굽기.js --목록

언어`);
  for (const [이름, [엔진]] of Object.entries(언어표)) {
    console.log(`  ${이름.padEnd(6)} → ${엔진표[엔진].설명}`);
  }
  console.log(`
목소리 (한국어는 Sohee 하나뿐이다)`);
  for (const [이름, 설명] of Object.entries(목소리표)) {
    console.log(`  ${이름.padEnd(10)} ${설명}`);
  }
  console.log(`
톤은 «말로» 준다 — 「다정하고 따뜻하게, 아이를 맞이하듯」 · 「밝고 신나게, 칭찬하듯」
출력을 안 주면 docs/소리/ 밑에 문장 앞머리로 이름을 짓는다.`);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--도움') || args.includes('-h')) { 도움말(); return 0; }
  if (args.includes('--목록')) { 도움말(); return 0; }

  // 값을 받는 플래그 — 그 «다음 칸»은 문장이 아니라 값이다(안 가르면 톤 문구를 문장으로 읽는다).
  const 값플래그 = new Set(['--언어', '--톤', '--목소리', '--출력']);
  const 값 = (키, 기본) => {
    const i = args.indexOf(키);
    return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : 기본;
  };

  let 글 = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) { if (값플래그.has(args[i])) i++; continue; }
    if (글 === null) 글 = args[i];
  }
  if (!글) { console.error('🔴 읽을 문장이 없다.'); 도움말(); return 2; }

  const 언어이름 = 값('--언어', '한국어');
  if (!언어표[언어이름]) {
    console.error(`🔴 모르는 언어: ${언어이름} (아는 것: ${Object.keys(언어표).join(' · ')})`);
    return 2;
  }
  const [엔진키, 언어값] = 언어표[언어이름];
  const 엔진 = 엔진표[엔진키];

  if (!fs.existsSync(엔진.venv)) {
    console.error(`🔴 엔진이 이 기계에 없다: ${엔진.venv}`);
    console.error('   빌린 것은 저장소에 안 들어온다 — 새 기계면 다시 깔아야 한다(정찰 지면 참조).');
    return 3;
  }

  const 목소리 = 값('--목소리', 엔진.기본목소리 || 'Sohee');
  const 톤 = 값('--톤', null);

  let 출력 = 값('--출력', null);
  if (!출력) {
    const 이름 = 글.replace(/[\\/:*?"<>|\s.!,]+/g, '_').slice(0, 24) || '소리';
    출력 = path.join(ROOT, 'docs', '소리', `${이름}.wav`);
  }
  출력 = path.resolve(ROOT, 출력);
  fs.mkdirSync(path.dirname(출력), { recursive: true });

  const 알맹이 = path.join(__dirname, 'lib', '목소리.py');
  const 인자 = [알맹이, '--엔진', 엔진키, '--글', 글, '--언어', 언어값,
                '--목소리', 목소리, '--출력', 출력, '--모델', 엔진.모델];
  if (톤) 인자.push('--톤', 톤);

  console.log(`▶ ${언어이름} · ${엔진.설명}${톤 ? ` · 톤 「${톤}」` : ''}`);
  const r = spawnSync(엔진.venv, 인자, {
    stdio: 'inherit',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (r.status !== 0) { console.error('🔴 굽기 실패'); return r.status || 1; }
  console.log(`✅ ${path.relative(ROOT, 출력)}`);
  return 0;
}

process.exit(main(process.argv));
