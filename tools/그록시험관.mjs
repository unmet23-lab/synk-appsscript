#!/usr/bin/env node
/**
 * 그록 시험관 — 낯선 사람 이해 시험의 넷째 시험관(2026-11-08 유호님 「그럼 이해 시험에만 넣자」).
 * `node tools/낯선이시험.js`가 만든 폴더의 질문.md · 장면 묶음(정지컷_*.jpg, 9번 비교용 지난*.jpg) · 말.txt를 그록(xAI 구독 CLI)에게 보내
 * 답을 <밖>/답_그록.md로 받는다. sonnet · haiku · GPT 시험관과 같은 질문이고, 서로 답을 보이지 않는다(기획장부/제작절차.md 「시험」).
 *
 *   node tools/그록시험관.mjs <밖 폴더>
 *
 * - 통로는 tools/lib/그록호출.js(구독 로그인 · API 키 안 씀). 그림은 사용자 폴더 밖 빈 폴더에 복사해 그록이 직접 열고,
 *   셸 · 고치기 · 웹 · MCP 도구와 사용자 폴더 · D: 읽기는 막는다. 한 번에 1~5분(11-07 실측, 짧은 지시문 30초 안팎).
 * - 그록은 11-08 디자인 눈가림에서 셋 가운데 가장 무르게 봤다 — 이 시험관 점수는 통과를 쉽게 만들지 않게 「다른 시험관도 넘고 그록도 넘어야」로만 쓰고,
 *   지적(답 3 · 9)은 「두 시험관이 같이 짚으면 고친다」 셈에 넣는다. <밖>/답_그록_기록.json에 초 · 턴 · 그림 이름을 남긴다.
 * - 끝 코드: 0 답 받음 · 1 답을 못 받음 · 2 쓰는 법 · 3 그록 CLI 없음 · 로그인 필요.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const 그록 = require('./lib/그록호출.js');
const 사용법 = '사용: node tools/그록시험관.mjs <낯선이시험 밖 폴더>';

/** 밖 폴더에서 질문 · 말 · 장면 · 지난 그림을 고른다(GPT 시험관과 같은 규칙). 없으면 까닭을 던진다. */
export function 자료고르기(밖) {
  const 질문파일 = path.join(밖, '질문.md'), 말파일 = path.join(밖, '말.txt');
  if (!fs.existsSync(질문파일)) throw new Error(`질문.md가 없다 — 먼저 node tools/낯선이시험.js로 만든다: ${질문파일}`);
  if (!fs.existsSync(말파일)) throw new Error(`말.txt가 없다: ${말파일}`);
  const 이름들 = fs.readdirSync(밖);
  const 장면 = 이름들.filter(f => /^정지컷_\d+\.jpg$/i.test(f)).sort();
  const 지난 = 이름들.filter(f => /^지난\d+_.*\.jpg$/i.test(f)).sort();
  if (!장면.length) throw new Error(`장면 묶음(정지컷_*.jpg)이 없다: ${밖}`);
  const 글 = p => fs.readFileSync(p, 'utf8').replace(/^﻿/, '').trim();
  return { 질문: 글(질문파일), 말: 글(말파일), 장면, 지난 };
}

/** 그록 답 글은 여러 턴의 혼잣말(「작업 폴더 그림만 열어 보겠습니다」)이 앞에 붙어 온다(11-08 실측) — 「1.」로 시작하는 첫 줄부터 남긴다. */
export function 답다듬기(글) {
  const s = String(글 || '').trim();
  // 혼잣말 끝 마침표 바로 뒤에 「1.」이 붙어 오기도 한다 — 「1~8번」처럼 뒤가 공백이 아닌 1은 번호로 보지 않는다
  const m = /(?:^|[\n.!?。])\s*(1[.)]\s)/.exec(s);
  return m ? s.slice(m.index + m[0].length - m[1].length).trim() : s;
}

/** 그록에게 보낼 글 — 그림은 작업 폴더에 같은 이름으로 두었으니 그 이름으로 열어 보라고 적는다. */
export function 시험글({ 질문, 말, 장면, 지난 }) {
  return [
    '이 시험은 작업 폴더에 둔 그림만 열어 보고 치른다. 질문에 적힌 그림 파일(정지컷_* · 지난*)은 작업 폴더에 같은 이름으로 있다 — 하나씩 열어 본다. 다른 파일 · 셸 · 인터넷은 쓰지 않는다.',
    `그림 차례: ${[...장면, ...지난].join(', ')}`,
    '',
    질문,
    '',
    '[말.txt]',
    말,
  ].join('\n');
}

async function main(argv) {
  const 밖 = argv[0];
  if (!밖) { console.error(사용법); return 2; }
  let 자료;
  try { 자료 = 자료고르기(밖); } catch (e) { console.error(`[그록시험관] ${e.message}`); return 2; }
  const 그림들 = [...자료.장면, ...자료.지난].map(f => path.resolve(밖, f));
  try {
    const r = await 그록.부르기({ 프롬프트: 시험글(자료), 그림들, 웹: false, 턴: Math.max(6, 그림들.length + 3), 시간초: 900 });
    const 답글 = 답다듬기(r.글);
    if (!답글) { console.error('[그록시험관] 답이 비었다'); return 1; }
    fs.writeFileSync(path.join(밖, '답_그록.md'), `# 그록 시험관 답 · 구독(grok CLI) · ${new Date().toISOString()}\n\n${답글}\n`);
    fs.writeFileSync(path.join(밖, '답_그록_기록.json'), `${JSON.stringify({ 초: Math.round(r.걸린ms / 1000), 턴수: r.턴수, 멈춘까닭: r.멈춘까닭, 그록이적은값USD: r.비용USD, 장면: 자료.장면, 지난: 자료.지난 }, null, 2)}\n`);
    console.log(답글);
    console.log(`\n[그록시험관] ${path.join(밖, '답_그록.md')} · ${Math.round(r.걸린ms / 1000)}초 · 턴 ${r.턴수 ?? '?'}`);
    return 0;
  } catch (e) {
    console.error(`[그록시험관] ${e.code || 'ERROR'} — ${e.message}`);
    return e.code === 'NOT_INSTALLED' || e.code === 'NEEDS_LOGIN' ? 3 : 1;
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('그록시험관.mjs')) {
  main(process.argv.slice(2)).then(c => { process.exitCode = c; });
}
