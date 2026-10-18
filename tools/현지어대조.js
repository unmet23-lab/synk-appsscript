#!/usr/bin/env node
// 현지어 사전 검문기(10-18) — 나라별 채널판 문안을 원어민 검수 앞에서 한 번 거른다. 몽골어 검문(tools/몽골어대조.js)의 두 겹만 옮겼다.
//   ① 원문을 안 보여 주는 문법·자연스러움 채점(아르곤) — 문장이 깨졌는지
//   ② 다듬기를 막은 직역 역번역(flash) — 뜻이 흘렀는지. 역번역↔한국어 원문의 «뜻» 대조는 사람(또는 Claude)이 한국어 둘을 견줘 한다.
// 몽골어의 맞춤법 사전(spellcheck.mn) 같은 자는 다른 언어엔 없다 — 그래서 이 도구의 「정상」은 «거름망 통과»일 뿐 확정이 아니다.
//
// 쓰는 법:  node tools/현지어대조.js --언어 "태국어" --파일 <경로>
//          파일 형식 = 한국어 원문 블록 / 단독 줄 `---` / 번역 블록 (줄마다 같은 번호를 달면 대조가 쉽다)
//          모델: 문법 = GEMINI_GRAMMAR_MODEL || gemini-4-argon(high), 역번역 = 모델정책 기본(flash high). 통로는 Google AI 구독(agy 로그인 계정)뿐이다.
// 종료코드: 0 = 문법 「정상」 + 역번역 받음 · 2 = 검수 필요(어색·파손·판정불능·역번역 실패) · 1 = 실행 오류
// ⚠ 우리가 쓴 공개 카피 전용 — 남이 보낸 글은 넣지 않는다(본문이 프롬프트에 실린다).
'use strict';
const fs = require('fs');
const 정책 = require('./모델정책.js');

function 인자(이름) {
  const i = process.argv.indexOf(이름);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function 파일분해(text) {
  const 줄 = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const 칸 = 줄.findIndex((l) => l.trim() === '---');
  if (칸 < 1) return null;
  const ko = 줄.slice(0, 칸).join('\n').trim();
  const 번역 = 줄.slice(칸 + 1).join('\n').trim();
  return ko && 번역 ? { ko, 번역 } : null;
}

const 문법스키마 = {
  type: 'object',
  properties: {
    판정: { type: 'string', enum: ['정상', '어색', '파손'] },
    이유: { type: 'string' },
    문제줄: { type: 'array', items: { type: 'object', properties: { 줄: { type: 'string' }, 문제: { type: 'string' }, 고침: { type: 'string' } }, required: ['줄', '문제'] } },
  },
  required: ['판정', '이유'],
};

async function main() {
  const 언어 = 인자('--언어');
  const 파일 = 인자('--파일');
  if (!언어 || !파일) {
    console.error('쓰는 법: node tools/현지어대조.js --언어 "<언어 이름>" --파일 <경로>   (한국어 / --- / 번역)');
    process.exit(1);
  }
  const 짝 = 파일분해(fs.readFileSync(파일, 'utf8'));
  if (!짝) {
    console.error('실행 오류: 파일 형식이 아니다 — 한국어 원문 / 단독 줄 --- / 번역 순이어야 한다');
    process.exit(1);
  }
  const { 부르기 } = require('./lib/제미나이구독호출.js');
  const 기본 = 정책.제미나이설정();
  const 역모델 = process.env.GEMINI_MODEL || 기본.model;
  const 역사고 = 기본.thinking_level || 'high';
  const 문법모델 = process.env.GEMINI_GRAMMAR_MODEL || 'gemini-4-argon';
  const 부름 = async (model, prompt, 옵션 = {}) => String(((await 부르기({ model, prompt, thinking: 옵션.thinking || 'high', schema: 옵션.schema || null })) || {}).text || '');

  const 문법답 = await 부름(문법모델,
    `다음은 ${언어}로 쓴 어린이·초보 학습자용 한국어 관용구 퀴즈 쇼츠의 화면 글과 게시 문안이다. 원문·의도는 모른다고 가정하고 ${언어}의 문법·맞춤법·자연스러움만 평가해라.\n` +
    `게임 쇼 표지(예: 「틀렸어!」, 「3초 안에 맞혀 봐!」), 짧은 보기 버튼, 일부러 글자 그대로 옮긴 우스운 오답 딱지(줄 끝이 ?)가 섞여 있다 — 오답 딱지가 어색한 건 일부러다.\n` +
    `한국어 발음 표기(로마자·현지 글자로 적은 한국어)는 평가하지 마라. 여러 줄이면 전부 보고 가장 나쁜 줄 기준으로 판정하고, 문제 있는 줄은 문제줄에 원문 그대로 담고 고침을 제안해라.\n\n${짝.번역}`,
    { schema: 문법스키마, thinking: 'high' });
  const 역번역 = await 부름(역모델,
    `다음 ${언어} 글을 한국어로 "직역"해라. 자연스럽게 다듬지 말고 어색하면 어색한 채로, 줄 수·번호·순서를 그대로 유지해 옮겨라. 번역문만 출력.\n\n${짝.번역}`,
    { thinking: 역사고 });

  let 문법 = null;
  try { 문법 = JSON.parse(문법답); } catch (e) { /* 아래에서 판정불능 */ }
  console.log(`언어: ${언어} · 문법 채점 ${문법모델}(high) · 직역 역번역 ${역모델}(${역사고}) · 구독 문(agy 로그인 계정)`);
  console.log('\n■ 문법·자연스러움 (원문 안 보여 주고 채점)');
  if (문법 && ['정상', '어색', '파손'].includes(문법.판정)) {
    console.log(`  판정: ${문법.판정} — ${문법.이유 || ''}`);
    for (const p of 문법.문제줄 || []) console.log(`  · ${p.줄}\n    문제: ${p.문제}${p.고침 ? `\n    고침: ${p.고침}` : ''}`);
  } else {
    console.log('  ' + (문법답 || '(빈 응답)').replace(/\n/g, '\n  '));
    console.log('  ⚠ 판정을 못 읽었다 → 검수 필요');
  }
  console.log('\n■ 한국어 원문');
  console.log('  ' + 짝.ko.replace(/\n/g, '\n  '));
  console.log('\n■ 직역 역번역 (다듬기 금지 — 원문과 뜻을 견준다)');
  console.log('  ' + (역번역 ? 역번역.replace(/\n/g, '\n  ') : '(빈 응답) ⚠ 검수 필요'));
  const ok = 문법 && 문법.판정 === '정상' && 역번역;
  console.log(`\n결과: ${ok ? '거름망 통과(확정 아님 — 역번역 뜻 대조는 따로)' : '검수 필요'}`);
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error('실행 오류:', e && e.message ? e.message : e);
  process.exit(1);
});
