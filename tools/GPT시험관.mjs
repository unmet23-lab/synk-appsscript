#!/usr/bin/env node
/**
 * GPT 시험관 — 낯선 사람 이해 시험의 셋째 시험관(다른 회사 눈, 2026-10-29 유호님 「제안대로 바꿔」).
 * `node tools/낯선이시험.js`가 만든 폴더의 질문.md · 장면 묶음(정지컷_*.jpg, 9번 비교용 지난*.jpg) · 말.txt를 그대로 OpenAI API에 보내
 * 답을 <밖>/답_GPT.md로 받는다. sonnet · haiku 시험관과 같은 질문이고, 서로 답을 보이지 않는다(기획장부/제작절차.md 「시험」).
 *
 *   node tools/GPT시험관.mjs <밖 폴더> [--모델 gpt-6.1-sol]
 *
 * - 키 차례 · 넘기기는 tools/lib/오픈AI키.mjs(GPT Pro 구독의 월 API 크레딧, 마지막 키까지 바닥이면 종료 3 — 돈 드는 길 없음). 키는 찍지 않는다.
 * - 한 번에 몇 센트(그림 4~8장 + 글). <밖>/답_GPT_기록.json에 모델 · 쓴 키 이름 · 초 · 토큰 · 어림 값 · 보낸 그림을 남긴다.
 * - 시험은 SYNK_OPENAI_BASE로 가짜 서버를 준다(tests/GPT시험관.test.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { 바탕주소, 차례로부르기, 부르기오류 } from './lib/오픈AI키.mjs';

const 값표 = { 'gpt-6.1-sol': { 입력: 2e-6, 출력: 10e-6 } };  // 토큰당 USD — tools/learning-blind/providers.mjs와 같은 값
const 사용법 = '사용: node tools/GPT시험관.mjs <낯선이시험 밖 폴더> [--모델 gpt-6.1-sol]';

function 멈춤(말, 코드 = 2) {
  console.error(`[GPT시험관] ${말}`);
  process.exit(코드);
}

const 인자 = process.argv.slice(2);
let 모델 = 'gpt-6.1-sol';
const 위치 = [];
for (let i = 0; i < 인자.length; i++) {
  if (인자[i] === '--모델') 모델 = 인자[++i] || '';
  else 위치.push(인자[i]);
}
const 밖 = 위치[0];
if (!밖 || !모델) 멈춤(사용법);
const 질문파일 = path.join(밖, '질문.md');
const 말파일 = path.join(밖, '말.txt');
if (!fs.existsSync(질문파일)) 멈춤(`질문.md가 없다 — 먼저 node tools/낯선이시험.js로 만든다: ${질문파일}`);
if (!fs.existsSync(말파일)) 멈춤(`말.txt가 없다: ${말파일}`);
const 이름들 = fs.readdirSync(밖);
const 장면 = 이름들.filter((f) => /^정지컷_\d+\.jpg$/i.test(f)).sort();
const 지난 = 이름들.filter((f) => /^지난\d+_.*\.jpg$/i.test(f)).sort();
if (!장면.length) 멈춤(`장면 묶음(정지컷_*.jpg)이 없다: ${밖}`);

const 질문 = fs.readFileSync(질문파일, 'utf8').replace(/^﻿/, '').trim();
const 말 = fs.readFileSync(말파일, 'utf8').replace(/^﻿/, '').trim();
const 안내 = '(이 시험은 파일을 여는 도구 없이 치른다. 질문에 적힌 파일은 아래에 파일 이름과 함께 그대로 붙였다 — 「Read 도구로 열어 보고」는 붙인 것을 보라는 뜻이다. 그림은 붙인 순서가 질문에 적힌 순서다.)';
const 그림칸 = (f) => [
  { type: 'input_text', text: `[${f}]` },
  { type: 'input_image', image_url: `data:image/jpeg;base64,${fs.readFileSync(path.join(밖, f)).toString('base64')}`, detail: 'high' },
];
const 내용 = [
  { type: 'input_text', text: `${안내}\n\n${질문}` },
  { type: 'input_text', text: `[말.txt]\n${말}` },
  ...장면.flatMap(그림칸),
  ...지난.flatMap(그림칸),
];
const 요청몸 = () => ({
  주소: `${바탕주소()}/responses`,
  몸: JSON.stringify({ model: 모델, store: false, reasoning: { effort: 'low' }, max_output_tokens: 3000, input: [{ role: 'user', content: 내용 }] }),
  json: true,
});

let 결과;
try {
  결과 = await 차례로부르기(요청몸, { 알림: (m) => console.error(`[GPT시험관] ${m}`), 제한ms: 5 * 60 * 1000 });
} catch (e) {
  if (e instanceof 부르기오류) 멈춤(e.message, e.코드);
  throw e;
}
const { 답, 요청, 초, 쓴키 } = 결과;
const 글들 = [];
if (typeof 답.output_text === 'string' && 답.output_text.trim()) 글들.push(답.output_text);
else for (const item of 답.output || []) if (item.type === 'message') for (const c of item.content || []) if (c.type === 'output_text') 글들.push(c.text);
const 답글 = 글들.join('\n').trim();
if (!답글) 멈춤(`글 답이 비었다(요청 ${요청})`, 1);

const u = 답.usage || {};
const 값 = 값표[모델];
const 어림 = 값 ? Number(((u.input_tokens ?? 0) * 값.입력 + (u.output_tokens ?? 0) * 값.출력).toFixed(4)) : null;
fs.writeFileSync(path.join(밖, '답_GPT.md'), `# GPT 시험관 답 · ${모델} · ${new Date().toISOString()}\n\n${답글}\n`);
fs.writeFileSync(path.join(밖, '답_GPT_기록.json'), `${JSON.stringify({ 모델, 키: 쓴키, 초, 요청, 사용: u, 어림값USD: 어림, 장면, 지난 }, null, 2)}\n`);
console.log(답글);
console.log(`\n[GPT시험관] ${path.join(밖, '답_GPT.md')} · ${모델} · 키 ${쓴키} · ${초}초 · 어림 ${어림 == null ? '?' : `$${어림}`} · 요청 ${요청}`);
