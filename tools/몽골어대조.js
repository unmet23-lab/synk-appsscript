#!/usr/bin/env node
// 몽골어 사전 검문기 — 사람 검수의 대체가 아니라 **검수 앞의 거름망**이다(몽골어=사람, 불변).
//
// 왜 두 겹인가(2026-08-05 실측): 강한 모델은 역번역에서 깨진 문장도 의도를 추론해 「고쳐 읽는다」.
//   ① 직역 강제 역번역 — 의미가 흘렀는지 (다듬지 말라고 강제해야 파손이 한국어에 비친다)
//   ② 원문을 안 보여주는 문법·자연스러움 채점 — 문장이 깨졌는지 (①만으로는 구조적으로 못 잡는 계열:
//      어미 파손 «зогсоорой яах вэ»를 3.6-flash 채점이 「파손」으로 적중, 3.5-lite 역번역은 매끈하게 복원했다)
// 판정을 못 읽으면 「통과」가 아니라 「검수 필요」다 — 비밀값 게이트와 같은 실패 방향 원칙.
//
// 쓰는 법:  node tools/몽골어대조.js "<한국어 원문>" "<몽골어 번역문>"
// 종료코드: 0=정상(그래도 대외 확정본은 사람 검수) · 2=검수 필요(어색·파손·판정불능) · 1=실행 오류
// 키:      C:\Users\q1212\SYNK_보안\제미나이.txt (git 밖 · env GEMINI_KEY_PATH 로 대체)
// ⚠ 무료 티어는 입력이 구글 학습에 쓰일 수 있다 — 학생 개인정보 금지, 공개 카피 전용.

'use strict';
const fs = require('fs');

const 기본키경로 = 'C:/Users/q1212/SYNK_보안/제미나이.txt';
const 기본모델 = 'gemini-3.6-flash'; // 2.5-flash 는 신규 키에 404 (08-05 실측)
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// 키 파일에서 키만 뽑는다. 아는 접두어(AIza·AQ.·sk-)를 우선하고,
// 못 알아보는데 토큰이 여럿이면 — 아무거나 집어 조용히 401을 만드느니 — 크게 실패한다.
function 키추출(raw) {
  const tokens = String(raw).replace(/^\uFEFF/, '').trim().split(/\s+/).filter(Boolean);
  const known = tokens.find((t) => /^(AIza|AQ\.|sk-)/.test(t));
  if (known) return known;
  if (tokens.length === 1) return tokens[0]; // 새 형식 대비 — 단일 토큰이면 그것이 키다
  return null;
}

// 모델 답에서 판정 한 단어를 뽑는다. 형식을 안 지킨 답 = null = 검수 필요(통과 아님).
function 판정추출(text) {
  const m = /판정\s*[:：]?\s*(정상|어색|파손)/.exec(String(text || ''));
  return m ? m[1] : null;
}

// 원문↔역번역을 공백 토큰 LCS 로 대조해 «다른 곳»만 표식한다. 3초 눈검사용 — 의미 판정이 아니다.
function 토큰대조(원문, 역번역, 표식) {
  const mark = 표식 || ((t) => `«${t}»`);
  const A = String(원문).split(/\s+/).filter(Boolean);
  const B = String(역번역).split(/\s+/).filter(Boolean);
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const keepA = new Set(), keepB = new Set();
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { keepA.add(i); keepB.add(j); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return {
    원문표시: A.map((t, k) => (keepA.has(k) ? t : mark(t))).join(' '),
    역번역표시: B.map((t, k) => (keepB.has(k) ? t : mark(t))).join(' '),
    다른토큰: (A.length - keepA.size) + (B.length - keepB.size),
    전체토큰: A.length + B.length,
  };
}

async function 제미나이(key, model, prompt) {
  const res = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${(j.error && j.error.message) || ''}`.trim());
  const c = j.candidates && j.candidates[0];
  const t = c && c.content && c.content.parts && c.content.parts.map((p) => p.text).join('');
  return (t || '').trim();
}

async function main() {
  const [ko, mn] = process.argv.slice(2);
  if (!ko || !mn) {
    console.error('쓰는 법: node tools/몽골어대조.js "<한국어 원문>" "<몽골어 번역문>"');
    process.exit(1);
  }
  const keyPath = process.env.GEMINI_KEY_PATH || 기본키경로;
  if (!fs.existsSync(keyPath)) {
    console.error(`실행 오류: 키 파일이 없다 → ${keyPath}`);
    process.exit(1);
  }
  const key = 키추출(fs.readFileSync(keyPath, 'utf8'));
  if (!key) {
    console.error(`실행 오류: 키 파일에서 키를 못 골랐다(토큰 여러 개·아는 접두어 없음) → ${keyPath}`);
    process.exit(1);
  }
  const model = process.env.GEMINI_MODEL || 기본모델;
  const 색 = process.stdout.isTTY ? (t) => `\x1b[31m${t}\x1b[0m` : undefined;

  const [문법답, 역번역] = await Promise.all([
    제미나이(key, model,
      `다음 몽골어 문장의 문법과 자연스러움만 평가해라. 의도는 모른다고 가정한다.\n출력: "판정: 정상|어색|파손" + 이유 한 줄.\n\n${mn}`),
    제미나이(key, model,
      `다음 몽골어를 한국어로 "직역"해라. 자연스럽게 다듬지 말고 어색하면 어색한 채로 옮겨라. 번역문만 출력.\n\n${mn}`),
  ]);

  const 등급 = 판정추출(문법답);
  const 대조 = 토큰대조(ko, 역번역 || '(빈 응답)', 색);

  console.log(`모델: ${model} · 무료 티어(학생 개인정보 금지)`);
  console.log('\n■ 문법·자연스러움 (원문 안 보여주고 채점)');
  console.log('  ' + (문법답 || '(빈 응답)').replace(/\n/g, '\n  '));
  if (!등급) console.log('  ⚠ 판정 형식을 못 읽었다 → 통과가 아니라 검수 필요로 처리');
  console.log('\n■ 직역 역번역 (다듬기 금지)');
  console.log('  ' + (역번역 || '(빈 응답)'));
  console.log('\n■ 원문 대조 (표식 = 달라진 곳)');
  console.log('  원문:   ' + 대조.원문표시);
  console.log('  역번역: ' + 대조.역번역표시);
  console.log(`  다른 토큰 ${대조.다른토큰} / ${대조.전체토큰}`);

  const 통과 = 등급 === '정상';
  console.log(`\n■ 종합: ${통과 ? '✅ 기계 검문 통과 — 대외 확정본은 그래도 사람 검수' : '🔴 사람 검수 필요'}${등급 ? ` (문법 판정: ${등급})` : ' (판정불능)'}`);
  process.exit(통과 ? 0 : 2);
}

module.exports = { 키추출, 판정추출, 토큰대조 };

if (require.main === module) {
  main().catch((e) => {
    console.error('실행 오류:', e.message);
    process.exit(1);
  });
}
