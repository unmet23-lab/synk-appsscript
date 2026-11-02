#!/usr/bin/env node
/**
 * GPT 시험관 — 낯선 사람 이해 시험의 셋째 시험관(다른 회사 눈, 2026-10-29 유호님 「제안대로 바꿔」).
 * `node tools/낯선이시험.js`가 만든 폴더의 질문.md · 장면 묶음(정지컷_*.jpg, 9번 비교용 지난*.jpg) · 말.txt를 그대로 OpenAI API에 보내
 * 답을 <밖>/답_GPT.md로 받는다. sonnet · haiku 시험관과 같은 질문이고, 서로 답을 보이지 않는다(기획장부/제작절차.md 「시험」).
 *
 *   node tools/GPT시험관.mjs <밖 폴더> [--모델 gpt-6.1-sol]
 *
 * - 키 차례 · 넘기기는 tools/lib/오픈AI키.mjs(GPT Pro 구독의 월 API 크레딧, 마지막 키까지 바닥이면 종료 3 — 돈 드는 길 없음). 키는 찍지 않는다.
 * - 2026-11-03부터 월 API 크레딧은 WORLD 말하기 받아 적기 몫이라(유호님 「openai크레딧은 다른데 쓰지말고 여기에만 써」) 키를 받지 못한다 —
 *   그 자리(종료 3)에서 같은 질문 · 말 · 장면을 구독 경로(`tools/codex계정.js exec`, 셸 · 파일 손대지 않기)로 보내 답을 받는다.
 *   모델은 지정하지 못하고 기록 「키」가 「구독」이다. 구독 계정도 없으면 종료 3. 시험은 SYNK_CODEX_ROTATE로 가짜 codex계정을 준다.
 * - 한 번에 몇 센트(그림 4~8장 + 글). <밖>/답_GPT_기록.json에 모델 · 쓴 키 이름 · 초 · 토큰 · 어림 값 · 보낸 그림을 남긴다.
 * - 시험은 SYNK_OPENAI_BASE로 가짜 서버를 준다(tests/GPT시험관.test.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

/* 구독 경로 — 같은 질문 · 말을 표준입력으로, 장면 · 지난 그림을 붙인 순서대로 -i로 준다. 답은 마지막 메시지(-o) 그대로 */
async function 구독시험(API까닭) {
  const 그림들 = [...장면, ...지난];
  const 글 = 'Do not run any shell commands, do not open, create or edit any files and do not use any tools. Answer only from the text '
    + `and images in this message.

(첨부 그림은 이 순서로 붙였다: ${그림들.join(', ')})
${안내}

${질문}

[말.txt]
${말}`;
  const 작업 = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-examiner-sub-'));
  const 답파일 = path.join(작업, 'last.txt');
  const 돌림 = process.env.SYNK_CODEX_ROTATE || path.join(path.dirname(fileURLToPath(import.meta.url)), 'codex계정.js');
  const 인자 = [돌림, 'exec', '--skip-git-repo-check', '-C', 작업, '-s', 'read-only', ...그림들.flatMap((f) => ['-i', path.resolve(밖, f)]), '-o', 답파일, '-'];
  const 시작 = Date.now();
  const r = await new Promise((resolve) => {
    const c = spawn(process.execPath, 인자, { timeout: 15 * 60 * 1000 });
    let 로그 = '';
    c.stdout.on('data', (d) => { 로그 += d; });
    c.stderr.on('data', (d) => { 로그 += d; });
    c.on('error', (e) => resolve({ code: 1, 로그: `${로그}
${e.message}` }));
    c.on('close', (code) => resolve({ code, 로그 }));
    c.stdin.end(글);
  });
  const 초 = Math.round((Date.now() - 시작) / 1000);
  if (r.code === 3) 멈춤(`API 크레딧을 쓰지 않아 구독 경로로 넘겼지만 쓸 수 있는 구독 계정도 없다(codex계정 종료 3 — node tools/codex계정.js로 본다). API: ${API까닭}`, 3);
  const 답글 = fs.existsSync(답파일) ? fs.readFileSync(답파일, 'utf8').trim() : '';
  if (r.code !== 0 || !답글) 멈춤(`구독 경로에서 답을 받지 못했다(종료 ${r.code}): ${(답글 || r.로그).slice(-400)}`, 1);
  fs.writeFileSync(path.join(밖, '답_GPT.md'), `# GPT 시험관 답 · 구독(Codex) · ${new Date().toISOString()}

${답글}
`);
  fs.writeFileSync(path.join(밖, '답_GPT_기록.json'), `${JSON.stringify({ 모델: '구독(Codex — 모델 지정 못함)', 키: '구독', 초, 어림값USD: 0, API넘긴까닭: API까닭, 장면, 지난 }, null, 2)}
`);
  console.log(답글);
  console.log(`
[GPT시험관] ${path.join(밖, '답_GPT.md')} · 구독(Codex) · ${초}초 · API 크레딧 0`);
}

let 결과;
try {
  결과 = await 차례로부르기(요청몸, { 알림: (m) => console.error(`[GPT시험관] ${m}`), 제한ms: 5 * 60 * 1000 });
} catch (e) {
  if (e instanceof 부르기오류 && e.코드 === 3) {
    console.error(`[GPT시험관] API 크레딧을 쓰지 않고 구독 경로(Codex)로 묻는다: ${e.message}`);
    await 구독시험(e.message);
    process.exit(0);
  }
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
