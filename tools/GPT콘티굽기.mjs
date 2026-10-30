#!/usr/bin/env node
/**
 * GPT 콘티 굽기 — AI 광고 · 홍보영상의 이미지 콘티(영상 시작 · 끝 그림으로 이어 쓰는 판 포함)를
 * GPT Image 2.5 Sunburst · max로 API에서 한 장 굽는다(2026-10-29 유호님 결정, 결정 표 같은 날).
 *
 * 광고 콘티의 다른 선택지는 Gemini 나노바나나(지금 경로)다 — 임팩트로 이기는 편은 Sunburst, 이야기로 이기는 편은 나노바나나.
 * 드라마 말하기 앱의 웹툰 칸 · 인물 시트도 이 도구로 굽는다(2026-10-30 유호님, experiences/drama/qa/웹툰시안-20261030/시안.mjs가 부른다).
 * 펠트 캐릭터 · 마스코트 · 소품 그림은 이 도구로 굽지 않는다 — 지금처럼 Codex 구독 경로(`tools/codex계정.js`)다.
 * 모델 · 품질은 Sunburst · max로 고정이고 바꾸는 인자를 두지 않는다.
 *
 *   node tools/GPT콘티굽기.mjs <지시문.txt> <나갈.png> [참고 그림…] [--크기 1152x2048] [--덮어쓰기]
 *
 * - 참고 그림이 있으면 /v1/images/edits(넘긴 순서 그대로), 없으면 /v1/images/generations.
 * - 크기는 가로 · 세로 둘 다 16의 배수(1080x1920은 API가 거절한다). 기본은 세로 9:16 1152x2048, 가로 영상은 2048x1152.
 * - 키 차례와 넘기기(크레딧 바닥 · 401 · 403이면 다음 무료 크레딧 키, 마지막 키까지 바닥이면 종료 3)는 `tools/lib/오픈AI키.mjs`.
 *   크레딧은 GPT Pro 구독의 월 API 크레딧이다(docs/AI_계정과_크레딧.md 「GPT」). 용도 '콘티'로 불러서 키 목록의 「안씀」에
 *   '콘티'가 든 키는 건너뛴다 — 10-30부터 unmet23(남은 크레딧은 운영 받아 적기 · 상황극 · 시험관 몫, 유호님 「응, 살려줘」).
 * - 그림 옆에 <이름>_기록.json(쓴 키 이름, 받은 크기 · 품질, 초, 요청 번호, 사용 토큰, 어림 값, 지시문 · 참고 sha256)을 남긴다.
 * - 값 · 시간 실측과 2K에서 구슬 눈에 흰자가 생기는 함정은 현장 노트 그림_굽기_오리기 「API로 GPT Image 2.5 Sunburst」.
 * - 시험은 SYNK_OPENAI_BASE로 가짜 서버를, SYNK_OPENAI_KEYLIST로 임시 키 목록을 준다(tests/GPT콘티굽기.test.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { 바탕주소, 차례로부르기, 부르기오류 } from './lib/오픈AI키.mjs';

const 모델 = 'gpt-image-2.5-sunburst';
const 품질 = 'max';
const 값표 = { 글입력: 5e-6, 그림입력: 8e-6, 출력: 30e-6 };  // 토큰당 USD — OpenAI 모델 문서(2026-10-29)
const 사용법 = '사용: node tools/GPT콘티굽기.mjs <지시문.txt> <나갈.png> [참고 그림…] [--크기 1152x2048] [--덮어쓰기]';

function 멈춤(말, 코드 = 2) {
  console.error(`[GPT콘티굽기] ${말}`);
  process.exit(코드);
}

const 위치 = [];
let 크기 = '1152x2048';
let 덮어쓰기 = false;
const 인자 = process.argv.slice(2);
for (let i = 0; i < 인자.length; i++) {
  if (인자[i] === '--크기') 크기 = 인자[++i] || '';
  else if (인자[i] === '--덮어쓰기') 덮어쓰기 = true;
  else 위치.push(인자[i]);
}
const [지시문파일, 나갈, ...참고] = 위치;
if (!지시문파일 || !나갈) 멈춤(사용법);
const 칸 = /^(\d+)x(\d+)$/.exec(크기);
if (!칸 || Number(칸[1]) % 16 || Number(칸[2]) % 16) 멈춤(`크기는 가로x세로이고 둘 다 16의 배수여야 한다: ${크기}`);
if (!/\.png$/i.test(나갈)) 멈춤('나갈 파일은 .png로 준다');
if (fs.existsSync(나갈) && !덮어쓰기) 멈춤(`이미 있다(덮으려면 --덮어쓰기): ${나갈}`);
if (!fs.existsSync(지시문파일)) 멈춤(`지시문 파일이 없다: ${지시문파일}`);
const 지시문 = fs.readFileSync(지시문파일, 'utf8').replace(/^﻿/, '').trim();
if (!지시문) 멈춤('지시문이 비었다');
for (const p of 참고) {
  if (!fs.existsSync(p)) 멈춤(`참고 그림이 없다: ${p}`);
  const b = fs.readFileSync(p);
  // PNG 색 형식 4 · 6은 투명 칸이 있다 — 투명 참고는 잘 안 먹는다(현장 노트 그림 굽기 「투명 참고 PNG」)
  if (b.length > 25 && b.readUInt32BE(0) === 0x89504e47 && (b[25] === 4 || b[25] === 6)) {
    console.error(`[GPT콘티굽기] 알림: 투명 칸이 있는 PNG 참고 ${path.basename(p)} — 흰 바탕 JPEG가 더 잘 먹는다`);
  }
}

const 그림형 = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
function 요청몸() {
  if (!참고.length) return { 주소: `${바탕주소()}/images/generations`, 몸: JSON.stringify({ model: 모델, prompt: 지시문, quality: 품질, size: 크기, n: 1 }), json: true };
  const 몸 = new FormData();
  for (const [이름, 값] of Object.entries({ model: 모델, prompt: 지시문, quality: 품질, size: 크기, n: '1' })) 몸.append(이름, 값);
  for (const p of 참고) 몸.append('image[]', new Blob([fs.readFileSync(p)], { type: 그림형(p) }), path.basename(p));
  return { 주소: `${바탕주소()}/images/edits`, 몸, json: false };
}

let 결과;
try {
  결과 = await 차례로부르기(요청몸, { 용도: '콘티', 알림: (말) => console.error(`[GPT콘티굽기] ${말}`) });
} catch (e) {
  if (e instanceof 부르기오류) 멈춤(e.message, e.코드);
  throw e;
}
const { 답, 글, 요청, 초, 쓴키 } = 결과;
const b64 = 답.data?.[0]?.b64_json;
if (!b64) 멈춤(`그림이 없는 답: ${글.slice(0, 300)}`, 1);
if (답.quality && 답.quality !== 품질) console.error(`[GPT콘티굽기] 알림: 받은 품질이 ${답.quality}다(${품질}가 아님) — 보고에 그대로 적는다`);

fs.mkdirSync(path.dirname(path.resolve(나갈)), { recursive: true });
fs.writeFileSync(나갈, Buffer.from(b64, 'base64'));
const u = 답.usage || {};
const 글입력 = u.input_tokens_details?.text_tokens ?? 0;
const 그림입력 = u.input_tokens_details?.image_tokens ?? 0;
const 출력 = u.output_tokens ?? 0;
const 어림 = Number((글입력 * 값표.글입력 + 그림입력 * 값표.그림입력 + 출력 * 값표.출력).toFixed(4));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const 기록 = {
  때: new Date().toISOString(), 모델, 품질, 크기, 키: 쓴키, 받은크기: 답.size ?? null, 받은품질: 답.quality ?? null, 초, 요청,
  사용: u, 어림값USD: 어림, 지시문sha256: sha(지시문),
  참고: 참고.map((p) => ({ 이름: path.basename(p), sha256: sha(fs.readFileSync(p)) })),
};
fs.writeFileSync(나갈.replace(/\.png$/i, '_기록.json'), `${JSON.stringify(기록, null, 2)}\n`);
console.log(`[GPT콘티굽기] ${나갈} · 키 ${쓴키} · ${답.size || 크기} · ${답.quality || 품질} · ${초}초 · 어림 $${어림} · 요청 ${요청}`);
