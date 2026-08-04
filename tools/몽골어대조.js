#!/usr/bin/env node
// 몽골어 사전 검문기 — 사람 검수의 대체가 아니라 **검수 앞의 거름망**이다(몽골어=사람, 불변).
//
// 왜 두 겹인가(2026-08-05 실측): 강한 모델은 역번역에서 깨진 문장도 의도를 추론해 「고쳐 읽는다」.
//   ① 직역 강제 역번역 — 의미가 흘렀는지 (다듬지 말라고 강제해야 파손이 한국어에 비친다)
//   ② 원문을 안 보여주는 문법·자연스러움 채점 — 문장이 깨졌는지 (①만으로는 구조적으로 못 잡는 계열:
//      어미 파손 «зогсоорой яах вэ»를 3.6-flash 채점이 「파손」으로 적중, 3.5-lite 역번역은 매끈하게 복원했다)
// 어느 층이든 답을 못 받거나 못 읽으면 「통과」가 아니라 「검수 필요」다 — 비밀값 게이트와 같은 실패 방향 원칙.
//
// 쓰는 법:  node tools/몽골어대조.js "<한국어 원문>" "<몽골어 번역문>"
//          node tools/몽골어대조.js --파일 <경로>   ← 실제 카피(여러 줄·따옴표)는 이쪽
//          파일 형식 = 한국어 원문 블록 / 단독 줄 `---` / 몽골어 번역 블록
// 종료코드: 0=정상(그래도 대외 확정본은 사람 검수) · 2=검수 필요(어색·파손·판정불능·역번역 실패) · 1=실행 오류
// 키:      C:\Users\q1212\SYNK_보안\제미나이.txt (git 밖 · env GEMINI_KEY_PATH 로 대체)
// ⚠ 무료 티어는 입력이 구글 학습에 쓰일 수 있다 — 학생 개인정보 금지, 공개 카피 전용.
// ⚠ 신뢰 경계: 우리가 쓴 카피 검문용이다. 남이 보낸 몽골어(DM 등)를 넣는 용도가 아니다 —
//    본문이 프롬프트에 실리므로 외부 텍스트는 지시 주입 표면이 된다.

'use strict';
const fs = require('fs');

const 기본키경로 = 'C:/Users/q1212/SYNK_보안/제미나이.txt';
const 기본모델 = 'gemini-3.6-flash'; // 2.5-flash 는 신규 키에 404 (08-05 실측)
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const 호출타임아웃 = 60_000;
const 재시도지연 = [5_000, 15_000]; // 무료 티어 분당 상한(429)·순간 장애(500/503)용

// 키 파일에서 키만 뽑는다. 아는 접두어(AIza·AQ.·sk-)를 우선하고,
// 못 알아보는데 토큰이 여럿이면 — 아무거나 집어 조용히 401을 만드느니 — 크게 실패한다.
function 키추출(raw) {
  const tokens = String(raw).replace(/^\uFEFF/, '').trim().split(/\s+/).filter(Boolean);
  const known = tokens.find((t) => /^(AIza|AQ\.|sk-)/.test(t));
  if (known) return known;
  if (tokens.length === 1) return tokens[0]; // 새 형식 대비 — 단일 토큰이면 그것이 키다
  return null;
}

// --파일 모드: 한국어 블록 / 단독 줄 --- / 몽골어 블록. 형식이 어긋나면 null(크게 실패).
function 파일분해(text) {
  const s = String(text).replace(/^\uFEFF/, '');
  const sep = /^[ \t]*---[ \t]*\r?$/m.exec(s);
  if (!sep) return null;
  const 원문 = s.slice(0, sep.index).trim();
  const 번역 = s.slice(sep.index + sep[0].length).trim(); // 번역 블록 안의 --- 는 번역에 남는다
  if (!원문 || !번역) return null;
  return { 원문, 번역 };
}

function 재시도가능(status) {
  return status === 429 || status === 500 || status === 503;
}

// 산문 정규식 폴백 — 형식을 안 지킨 답 = null = 검수 필요(통과 아님).
function 판정추출(text) {
  const m = /판정\s*[:：]?\s*(정상|어색|파손)/.exec(String(text || ''));
  return m ? m[1] : null;
}

// 문법 층 답 해석: 1순위 = 구조화 JSON(스키마 강제 — 산문 파싱은 지적 0건과 파싱 실패가
// 같은 모양이 되는 함정이라 저장소가 이미 데인 형태다) · 2순위 = 산문 정규식 · 실패 = null.
function 문법파싱(raw) {
  const s = String(raw || '').trim();
  try {
    const j = JSON.parse(s);
    if (['정상', '어색', '파손'].includes(j.판정)) {
      return { 판정: j.판정, 이유: String(j.이유 || ''), 문제문장: j.문제문장 ? String(j.문제문장) : '' };
    }
  } catch (e) { /* 산문 폴백으로 */ }
  const 판정 = 판정추출(s);
  return 판정 ? { 판정, 이유: s, 문제문장: '' } : null;
}

// 원문↔역번역을 공백 토큰 LCS 로 대조해 다른 곳만 표식한다. 3초 눈검사용 — 의미 판정이 아니다.
// 기본 표식은 ⟦⟧ — «» 는 몽골어 표준 인용부호라 본문과 충돌한다.
function 토큰대조(원문, 역번역, 표식) {
  const mark = 표식 || ((t) => `⟦${t}⟧`);
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

const 문법스키마 = {
  type: 'object',
  properties: {
    판정: { type: 'string', enum: ['정상', '어색', '파손'] },
    이유: { type: 'string' },
    문제문장: { type: 'string' },
  },
  required: ['판정', '이유'],
};

async function 제미나이(key, model, prompt, opts = {}) {
  for (let 회 = 0; ; 회++) {
    let res, 본문;
    try {
      res = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          ...(opts.schema
            ? { generationConfig: { responseMimeType: 'application/json', responseSchema: opts.schema } }
            : {}),
        }),
        signal: AbortSignal.timeout(호출타임아웃),
      });
      본문 = await res.json();
    } catch (e) {
      if (회 < 재시도지연.length) { await new Promise((r) => setTimeout(r, 재시도지연[회])); continue; }
      throw new Error(`네트워크/타임아웃: ${e.message}`);
    }
    if (!res.ok) {
      if (재시도가능(res.status) && 회 < 재시도지연.length) {
        await new Promise((r) => setTimeout(r, 재시도지연[회]));
        continue;
      }
      throw new Error(`${res.status} ${(본문.error && 본문.error.message) || ''}`.trim());
    }
    const c = 본문.candidates && 본문.candidates[0];
    const t = c && c.content && c.content.parts && c.content.parts.map((p) => p.text).join('');
    return (t || '').trim();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  let ko, mn;
  if (argv[0] === '--파일') {
    if (!argv[1] || !fs.existsSync(argv[1])) {
      console.error('실행 오류: --파일 뒤에 실재하는 경로가 필요하다');
      process.exit(1);
    }
    const 쪼갬 = 파일분해(fs.readFileSync(argv[1], 'utf8'));
    if (!쪼갬) {
      console.error('실행 오류: 파일 형식이 아니다 — 한국어 원문 / 단독 줄 --- / 몽골어 번역 순이어야 한다');
      process.exit(1);
    }
    ko = 쪼갬.원문; mn = 쪼갬.번역;
  } else {
    [ko, mn] = argv;
  }
  if (!ko || !mn) {
    console.error('쓰는 법: node tools/몽골어대조.js "<한국어 원문>" "<몽골어 번역문>"');
    console.error('        node tools/몽골어대조.js --파일 <경로>   (한국어 / --- / 몽골어)');
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

  // 직렬 호출 — 무료 티어 분당 상한을 나란히 때리지 않는다. 문법(판정층)이 먼저다.
  const 문법답 = await 제미나이(key, model,
    `다음 몽골어 글의 문법과 자연스러움만 평가해라. 원문·의도는 모른다고 가정한다.\n여러 문장이면 전부 보고 가장 나쁜 문장 기준으로 판정한다.\n문제가 있으면 문제문장 필드에 그 문장을 원문 그대로 담아라.\n\n${mn}`,
    { schema: 문법스키마 });
  const 역번역 = await 제미나이(key, model,
    `다음 몽골어를 한국어로 "직역"해라. 자연스럽게 다듬지 말고 어색하면 어색한 채로, 문장 수와 순서를 그대로 유지해 옮겨라. 번역문만 출력.\n\n${mn}`);

  const 문법 = 문법파싱(문법답);
  const 역실패 = !역번역;

  console.log(`모델: ${model} · 무료 티어(학생 개인정보 금지)`);
  console.log('\n■ 문법·자연스러움 (원문 안 보여주고 채점)');
  if (문법) {
    console.log(`  판정: ${문법.판정}${문법.이유 ? ' — ' + 문법.이유 : ''}`);
    if (문법.문제문장) console.log(`  문제문장: ${문법.문제문장}`);
  } else {
    console.log('  ' + (문법답 || '(빈 응답)').replace(/\n/g, '\n  '));
    console.log('  ⚠ 판정을 못 읽었다 → 통과가 아니라 검수 필요로 처리');
  }
  console.log('\n■ 직역 역번역 (다듬기 금지)');
  console.log('  ' + (역번역 || '(빈 응답) ⚠ 역번역 층이 답을 안 냈다 → 검수 필요로 처리'));
  if (!역실패) {
    const 대조 = 토큰대조(ko, 역번역, 색);
    console.log('\n■ 원문 대조 (표식 = 달라진 곳 · 직역이라 요란한 게 정상 — 판정은 문법 층이 낸다)');
    console.log('  원문:   ' + 대조.원문표시);
    console.log('  역번역: ' + 대조.역번역표시);
    console.log(`  다른 토큰 ${대조.다른토큰} / ${대조.전체토큰}`);
  }

  // 실패 방향: 어느 층이든 「모름」이면 통과가 아니다.
  const 통과 = !!문법 && 문법.판정 === '정상' && !역실패;
  const 사유 = !문법 ? '판정불능' : 역실패 ? '역번역 실패' : `문법 판정: ${문법.판정}`;
  console.log(`\n■ 종합: ${통과 ? '✅ 기계 검문 통과 — 대외 확정본은 그래도 사람 검수' : '🔴 사람 검수 필요'} (${사유})`);
  process.exit(통과 ? 0 : 2);
}

module.exports = { 키추출, 판정추출, 문법파싱, 파일분해, 재시도가능, 토큰대조 };

if (require.main === module) {
  main().catch((e) => {
    console.error('실행 오류:', e.message);
    process.exit(1);
  });
}
