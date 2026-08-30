#!/usr/bin/env node
// 몽골어 사전 검문기 — 사람 검수의 대체가 아니라 **검수 앞의 거름망**이다(몽골어=사람, 불변).
//
// 왜 두 겹인가(2026-08-05 실측): 강한 모델은 역번역에서 깨진 문장도 의도를 추론해 「고쳐 읽는다」.
//   ① 직역 강제 역번역 — 의미가 흘렀는지 (다듬지 말라고 강제해야 파손이 한국어에 비친다)
//   ② 원문을 안 보여주는 문법·자연스러움 채점 — 문장이 깨졌는지 (①만으로는 구조적으로 못 잡는 계열:
//      어미 파손 «зогсоорой яах вэ»를 3.6-flash 채점이 「파손」으로 적중, 3.5-lite 역번역은 매끈하게 복원했다)
//   ③ 말투 — 뉘앙스가 뒤집혔는지 (①②는 「말이 되는가」만 본다. 문법이 완벽한 채로
//      "3일 연속이 끊겼습니다"가 되어도 둘 다 정상이라 통과한다 — 브랜드 규칙으로는 위반인데.
//      **제미나이 호출을 늘리지 않는다**: ①의 역번역이 이미 한국어라 voice-guard 의 자를 그대로 댄다)
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
// 모델·사고 수준은 모델정책이 정본이다(유호님 확정 "flash high" · 2026-08-05) — 여기 하드코딩하지 않는다.
// 이 파일의 「2.5-flash 는 신규 키에 404」 실측이 그 정본의 근거 중 하나로 들어가 있다.
const 정책 = require('./모델정책.js');
/* 말투 자는 voice-guard 가 정본이었다(원본 = skills/synk-brand 「반례」 표).
 * 🔴 2026-08-19 자기검증 층 철거(e75fc7fc)로 그 훅이 사라졌고, **이 파일은 그 뒤로 부르면 즉시 죽었다**
 *   (require 실패 · 실측 08-20). 규칙을 여기서 다시 쓰지 않는다(지침: 고칠 때 새 장치를 짓지 않는다)
 *   — 대신 층을 «미실행»으로 드러낸다. 빈 배열로 물러서면 「말투 위반 0건」이 되어 안 잰 것이 통과로 읽힌다. */
let 말투위반 = null;
try { ({ 위반찾기: 말투위반 } = require('../.claude/hooks/voice-guard.js')); }
catch { 말투위반 = null; }

const 기본키경로 = 'C:/Users/q1212/SYNK_보안/제미나이.txt';
const 제미나이픽 = 정책.제미나이설정(); // 기본 = gemini-3.7-flash / thinking_level=high (유호 지시 08-31)
const 기본모델 = 제미나이픽.model;
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

/** 말투 층 — 번역이 뉘앙스를 뒤집었는지. **제미나이 호출을 늘리지 않는다**: 역번역이 이미 한국어라
 *  거기에 voice-guard 의 자를 그대로 댄다.
 *
 *  🔑 원문 대비 **새로 생긴 규칙**만 센다. 원문에도 있던 위반은 번역 탓이 아니라 원문 탓이고
 *    (그건 voice-guard 훅이 파일에서 잡는 자리다), 직역 강제라 표현이 요란해지는 것까지
 *    말투 위반으로 세면 거름망이 아니라 모래주머니가 된다.
 *    → 조건을 하나만 바꿔 대조한다: 같은 자 · 같은 언어 · 다른 것은 「번역을 거쳤다」뿐. */
/** @returns {Array|null} — `null` 은 «못 쟀다»다(빈 배열 = 「쟀는데 0건」과 갈린다). */
function 말투대조(원문, 역번역) {
  if (!말투위반) return null;          // 자가 없다 — 0건으로 위장하지 않는다
  if (!역번역) return [];
  const 원문규칙 = new Set(말투위반(원문).map((v) => v.id));
  return 말투위반(역번역).filter((v) => !원문규칙.has(v.id));
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
          // 사고 수준은 정책 픽의 모델일 때만 싣는다 — env GEMINI_MODEL 로 딴 모델을 골랐으면
          // 그 모델이 이 파라미터를 받는지 모르므로 안 보낸다(조용한 400 방지).
          ...(opts.schema || opts.thinking
            ? {
                generationConfig: {
                  ...(opts.schema ? { responseMimeType: 'application/json', responseSchema: opts.schema } : {}),
                  ...(opts.thinking ? { thinkingConfig: { thinkingLevel: opts.thinking } } : {}),
                },
              }
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
  const thinking = model === 제미나이픽.model ? 제미나이픽.thinking_level : undefined;
  const 색 = process.stdout.isTTY ? (t) => `\x1b[31m${t}\x1b[0m` : undefined;

  // 직렬 호출 — 무료 티어 분당 상한을 나란히 때리지 않는다. 문법(판정층)이 먼저다.
  const 문법답 = await 제미나이(key, model,
    `다음 몽골어 글의 문법과 자연스러움만 평가해라. 원문·의도는 모른다고 가정한다.\n여러 문장이면 전부 보고 가장 나쁜 문장 기준으로 판정한다.\n문제가 있으면 문제문장 필드에 그 문장을 원문 그대로 담아라.\n\n${mn}`,
    { schema: 문법스키마, thinking });
  const 역번역 = await 제미나이(key, model,
    `다음 몽골어를 한국어로 "직역"해라. 자연스럽게 다듬지 말고 어색하면 어색한 채로, 문장 수와 순서를 그대로 유지해 옮겨라. 번역문만 출력.\n\n${mn}`,
    { thinking });

  const 문법 = 문법파싱(문법답);
  const 역실패 = !역번역;

  console.log(`모델: ${model}${thinking ? ' · thinking=' + thinking : ''} · 무료 티어(학생 개인정보 금지)`);
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

  const 말투 = 말투대조(ko, 역번역);
  const 말투미실행 = 말투 === null;
  if (!역실패) {
    console.log('\n■ 말투 (역번역에 **새로** 생긴 위반 = 번역이 뉘앙스를 뒤집었다는 신호)');
    if (말투미실행) {
      console.log('  🔴 이 층은 **안 돌았다** — 자(.claude/hooks/voice-guard.js)가 2026-08-19 철거됐다.');
      console.log('     0건이 아니라 «미측정»이다. 말투는 사람이 본다(자 = skills/synk-brand 「반례」 표).');
    } else if (말투.length) {
      for (const v of 말투) console.log(`  ✖ [${v.id}] "${v.문구}" — ${v.왜}`);
      console.log('  → 원문엔 없던 위반이다. 몽골어 문장이 손실·비교·재촉 쪽에서 세고 있지 않은지 본다.');
    } else {
      console.log('  ✅ 원문에 없던 말투 위반 없음 (자 = skills/synk-brand 「반례」 표)');
    }
  }

  // 실패 방향: 어느 층이든 「모름」이면 통과가 아니다 — 미실행도 「모름」이다.
  const 통과 = !!문법 && 문법.판정 === '정상' && !역실패 && !말투미실행 && !말투.length;
  const 사유 = !문법 ? '판정불능'
    : 역실패 ? '역번역 실패'
    : 문법.판정 !== '정상' ? `문법 판정: ${문법.판정}`
    : 말투미실행 ? '말투 층 미실행(voice-guard 철거 — 사람 검수 필요)'
    : `말투 위반 ${말투.length}건(${말투.map((v) => v.id).join('·')})`;
  console.log(`\n■ 종합: ${통과 ? '✅ 기계 검문 통과 — 대외 확정본은 그래도 사람 검수' : '🔴 사람 검수 필요'} (${사유})`);
  process.exit(통과 ? 0 : 2);
}

module.exports = { 키추출, 판정추출, 문법파싱, 파일분해, 재시도가능, 토큰대조, 말투대조 };

if (require.main === module) {
  main().catch((e) => {
    console.error('실행 오류:', e.message);
    process.exit(1);
  });
}
