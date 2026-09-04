#!/usr/bin/env node
// 몽골어 사전 검문기 — 사람 검수의 대체가 아니라 **검수 앞의 거름망**이다(몽골어=사람, 불변).
//
// 왜 다섯 겹인가(2026-08-05 실측 · ④는 09-01 · ⑤는 09-02 추가): 강한 모델은 역번역에서 깨진 문장도 의도를 추론해 「고쳐 읽는다」.
//   ① 직역 강제 역번역 — 의미가 흘렀는지 (다듬지 말라고 강제해야 파손이 한국어에 비친다)
//   ② 원문을 안 보여주는 문법·자연스러움 채점 — 문장이 깨졌는지 (①만으로는 구조적으로 못 잡는 계열:
//      어미 파손 «зогсоорой яах вэ»를 3.6-flash 채점이 「파손」으로 적중, 3.5-lite 역번역은 매끈하게 복원했다)
//   ③ 말투 — 뉘앙스가 뒤집혔는지 (①②는 「말이 되는가」만 본다. 문법이 완벽한 채로
//      "3일 연속이 끊겼습니다"가 되어도 둘 다 정상이라 통과한다 — 브랜드 규칙으로는 위반인데.
//      **제미나이 호출을 늘리지 않는다**: ①의 역번역이 이미 한국어라 voice-guard 의 자를 그대로 댄다)
//   ④ 맞춤법 — 철자가 틀렸는지 (자 = spellcheck.mn 사전·형태소, LLM 이 아니다 · 알맹이 = lib/몽골어맞춤법.js)
//      🔑 **①②③ 이 «원리상» 못 보는 축이라 자를 겹친 게 아니다.** 09-01 실측: 캐러셀 LAB001 을
//      ①②③ 은 「정상 — 오류 없고 자연스럽다」로 통과시켰고 ④가 `бүрт`(→`бүрд`)를 집었다.
//      그 낱말은 홍보 트리오 «정본»에 있었고 synk.im 라이브까지 나가 있었다.
//      까닭: 역번역은 깨진 철자를 LLM 이 «알아서 고쳐 읽어» 한국어에 파손이 안 비친다.
//   ⑤ 뜻 대조 — 역번역이 «원문과 같은 것»을 말하나 (자 = codex/OpenAI · 알맹이 = lib/뜻대조.js)
//      🔑 09-02 «자 시험»이 이 층의 **부재**를 잡아냈다. 알려진 방식으로 부순 문장 일곱 중 여섯은
//      ①②③④ 가 잡았는데 **하나가 ✅통과 도장을 받고 나갔다**: 낱말 바꿔치기(шалгалтын→хуримын ·
//      시험장→결혼식장). 역번역은 「왜냐하면 **결혼식장**에 AI 가 함께 들어가지 않으니까」라고
//      글자 그대로 찍어 놨는데, ②는 원문을 안 보고 ④는 хуримын 이 실재 낱말이라 조용했다.
//      ⇒ 구멍은 「자가 모자라다」가 아니라 **「역번역↔원문을 «뜻»으로 대조하는 층이 없었다」**였다.
//      🔴 이 층만 벤더가 다르다(codex). 역번역을 만든 제미나이에게 물으면 제 답을 제가 채점한다.
//      🔑 이 판정은 **몽골어를 몰라도 된다** — 한국어 둘을 견주는 일이다.
// 어느 층이든 답을 못 받거나 못 읽으면 「통과」가 아니라 「검수 필요」다 — 비밀값 게이트와 같은 실패 방향 원칙.
//
// 쓰는 법:  node tools/몽골어대조.js "<한국어 원문>" "<몽골어 번역문>"
//          node tools/몽골어대조.js --파일 <경로>   ← 실제 카피(여러 줄·따옴표)는 이쪽
//          --한증인  을 붙이면 ⑤(codex)를 건너뛴다 — 빠른 확인용. **미측정이지 통과가 아니다.**
//          파일 형식 = 한국어 원문 블록 / 단독 줄 `---` / 몽골어 번역 블록
// 종료코드: 0=정상(그래도 대외 확정본은 사람 검수) · 2=검수 필요(어색·파손·판정불능·역번역 실패) · 1=실행 오류
// 키:      C:\Users\q1212\SYNK_보안\제미나이.txt (git 밖 · env GEMINI_KEY_PATH 로 대체)
// 장부:    docs/_ops/몽골어검문.jsonl — 매 실행이 한 줄(통과·불통과 **둘 다**). `--파일` 모드면
//          대상 파일 지문이 남아 「검문 뒤 문안이 바뀐 것」을 tools/ai스택점검.js 가 센다.
// ⚠ 무료 티어는 입력이 구글 학습에 쓰일 수 있다 — 학생 개인정보 금지, 공개 카피 전용.
// ⚠ 신뢰 경계: 우리가 쓴 카피 검문용이다. 남이 보낸 몽골어(DM 등)를 넣는 용도가 아니다 —
//    본문이 프롬프트에 실리므로 외부 텍스트는 지시 주입 표면이 된다.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
/* ④ 맞춤법 — 2026-09-01 에 붙였다. 앞 세 층이 **원리상 못 보던 축**이라 자를 겹친 게 아니다:
 *   같은 캐러셀 글에 ①②③ 은 「정상」을 냈고 ④가 `бүрт`(→`бүрд`)를 집었다. 그 낱말은 홍보 트리오
 *   «정본»에 있었고 synk.im 라이브까지 나가 있었다. 역번역은 깨진 철자를 고쳐 읽어 한국어에 안 비친다. */
const { 맞춤법검사 } = require('./lib/몽골어맞춤법.js');
/* ⑤ 뜻 대조 — 2026-09-02 에 붙였다. 자 시험이 이 층의 «부재»를 잡아냈다:
 *   낱말 하나를 바꿔치기한 문장(시험장→결혼식장)이 ①②③④ 를 전부 지나 ✅통과 도장을 받았다.
 *   역번역은 「결혼식장에 AI 가…」라고 찍어 놨는데 **아무도 원문과 대조하지 않았다.**
 *   🔴 이 층만 codex(OpenAI)로 간다 — 역번역을 만든 제미나이가 제 답을 채점하면 늘 「같다」다. */
const { 뜻대조 } = require('./lib/뜻대조.js');
/* HTTP 호출은 `tools/lib/제미나이호출.js` **한 통로**다(09-02) — 검수 러너의 gemini 레인과 같은 함수를 쓴다.
 * 재시도·타임아웃·스키마 처리를 여기 다시 적지 않는다(두 곳이 알면 갈린다). */
const { 제미나이, 재시도가능 } = require('./lib/제미나이호출.js');

/* 🔑 검문은 기본이 **「글」 열쇠**(공짜 몫)다 — 유호 확정 09-03 「글은 공짜, 그림은 유료」.
 * 경로는 여기서 안 정한다(정본 = 모델정책.js `제미나이키경로(용도)` · 09-03 전엔 이 파일이 따로 알고 있었다).
 *
 * 🆕 09-04 — `--돈` 손잡이를 붙였다. 왜:
 *   공짜 몫으로는 검문 한 판(80요청)이 원리상 안 돈다(§2-감수 · 09-03 실측).
 *   🔑 [09-05] 그 판정의 정본은 `모델정책.js` 의 `돈열쇠판정()` 하나다 — 한도 숫자를 여기 다시
 *     적지 않는다. 09-04 까지 두 파일이 이 사실을 **반대로** 알고 있었다(저기선 「여유가 크다」).
 *   그래서 검문 ①②가 09-02 저녁부터 멈춰 있었다. 09-04 에 무료 크레딧 $300 이 Vertex 문에
 *   실제로 붙으면서(프로브 초록) **그 벽 없이 대량으로 돌릴 자리**가 생겼다.
 * 🚫 **기본은 안 바꾼다.** 용도를 잊었을 때 공짜로 가야 실패 방향이 「돈이 샌다」가 되지 않는다
 *   (모델정책.js 의 같은 규율). 대량으로 돌릴 때만 사람이 `--돈` 을 명시한다. */
const 열쇠용도 = process.argv.includes('--돈') ? '돈' : '글';
const 제미나이픽 = 정책.제미나이설정(); // 기본 = gemini-3.8-flash / thinking_level=high (유호 지시 09-03)
const 기본모델 = 제미나이픽.model;

// 키 파일에서 키만 뽑는다. 아는 접두어(AIza·AQ.·sk-)를 우선하고,
// 못 알아보는데 토큰이 여럿이면 — 아무거나 집어 조용히 401을 만드느니 — 크게 실패한다.
function 키추출(raw) {
  const tokens = String(raw).replace(/^\uFEFF/, '').trim().split(/\s+/).filter(Boolean);
  const known = tokens.find((t) => /^(AIza|AQ\.|sk-)/.test(t));
  if (known) return known;
  if (tokens.length === 1) return tokens[0]; // 새 형식 대비 — 단일 토큰이면 그것이 키다
  return null;
}

/* 몽골어«만» 든 실물 파일(캐러셀 원고 등)에서 검문할 글만 뽑는다.
 * 🔑 왜 있나(2026-09-02): 검문을 «짝 파일»(한국어/---/몽골어)에 돌리면 도장이 그 짝 파일에 찍힌다.
 *   그런데 실제로 고쳐지는 것은 «원고»라서, 원고를 한 글자 고쳐도 도장이 그대로 남는다 —
 *   장부가 막으려던 바로 그 병이다(`ai스택점검` 이 「저장소 밖 24 · 드리프트를 원리상 못 잰다」로 울었다).
 *   짝 파일을 저장소에 넣는 길도 있었지만 그러면 몽골어가 «두 곳»에 살아 갈린다
 *   ([[constant-known-in-two-places]]) — 그래서 원고를 «직접» 재고 원문만 밖에서 준다.
 * ⚠ 마크다운·머리말은 검문 대상이 아니다: `언어: mn` 같은 줄을 그대로 보내면 맞춤법 자가 `mn` 을
 *   모르는 낱말로 센다. 뜻 대조도 제목·기호를 「빠진 것」으로 읽는다. */
function 실물에서뽑기(text) {
  const 줄들 = String(text).replace(/^﻿/, '').split(/\r?\n/);
  const 뽑음 = [];
  for (const raw of 줄들) {
    let l = raw.trim();
    if (!l) continue;
    if (/^-{3,}$/.test(l)) continue;                 // 장 구분
    if (/^[가-힣]+:\s/.test(l)) continue;             // 머리말 (훅: · 언어: · 마무리:)
    l = l.replace(/^#+\s*/, '')                       // 제목 표식
         .replace(/^>\s*/, '')                        // 인용
         .replace(/^[🔑🔴⚠✅⚪✖·]+\s*/u, '')          // 표식 글머리
         .replace(/\*\*(.+?)\*\*/g, '$1')             // 굵게
         .replace(/`([^`]+)`/g, '$1');                // 코드
    if (l) 뽑음.push(l);
  }
  return 뽑음.join(' ').trim();
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

/* ── 검문 장부 (2026-09-01 · 유호님 「셋 다 지어줘」)
 *
 * 왜 있나: 이 검문의 **도장이 사람이 쓴 문장이었다.** 실측 09-01 — 도장이 박힌 문서 4벌
 *   (`AI활용문안_몽골어_검수표`·`함께한날_몽골어_검수표`·`직장경험_회수_배포문`·`몽골어_검수_발주서`)
 *   중 **지문을 든 것 0벌.** 즉 검문 뒤 문안을 한 글자 고쳐도 도장이 그대로 남았고, 「이 문안이
 *   검문을 지났나」를 세는 방법이 없었다(장부 0줄).
 *
 * 🔑 자를 새로 만들지 않는다 — ①배포 검수가 이미 쓰는 자를 그대로 빌린다:
 *   «대상 파일의 sha256 앞 12» (`codex-review.js:2110` · `review-runs.js:205` 와 같은 계산).
 *   그래야 「검문 뒤 바뀐 문안」 판정이 심문 드리프트와 **같은 자**로 나온다(one-ruler-per-judgment).
 *
 * ⚠ 장부 쓰기가 실패해도 **판정은 그대로 낸다.** 여기서 죽으면 검문 자체가 안 도는 셈이 되고,
 *   그건 이 장부가 막으려는 것보다 나쁘다. 대신 실패를 **말한다** — 조용히 넘어가면 「기록됐다」와
 *   「안 됐다」가 같은 모양이 된다.
 * ⚠ 인자 모드(문자열 둘)는 파일이 없어 드리프트를 못 잰다 — 그 줄은 `대상:"(인자)"`로 남고
 *   번역문 지문만 든다. 「안 잰 것」이지 「통과」가 아니라서 갈라 적는다. */
const ROOT = path.resolve(__dirname, '..');
const 장부경로 = () => process.env.SYNK_MN_LEDGER || path.join(ROOT, 'docs', '_ops', '몽골어검문.jsonl');

function 지문(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

/** @returns {string|null} 실패 사유(없으면 null) — 부르는 쪽이 «말할» 재료다. */
function 장부쓰기(줄) {
  try {
    const p = 장부경로();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(줄) + '\n', 'utf8');
    return null;
  } catch (e) {
    return e.message;
  }
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

async function main() {
  const argv = process.argv.slice(2);
  let ko, mn, 대상 = '(인자)', 대상지문 = null;
  if (argv[0] === '--파일') {
    if (!argv[1] || !fs.existsSync(argv[1])) {
      console.error('실행 오류: --파일 뒤에 실재하는 경로가 필요하다');
      process.exit(1);
    }
    /* `--원문 <경로>` 를 주면 대상 파일은 «몽골어만» 든 실물(캐러셀 원고 등)로 읽는다.
     * 그래야 도장이 «짝 파일»이 아니라 실제로 고쳐지는 원고에 찍혀 드리프트를 잰다. */
    const 원문칸 = argv.indexOf('--원문');
    if (원문칸 > 0) {
      const 원문경로 = argv[원문칸 + 1];
      if (!원문경로 || !fs.existsSync(원문경로)) {
        console.error('실행 오류: --원문 뒤에 실재하는 한국어 파일 경로가 필요하다');
        process.exit(1);
      }
      ko = 실물에서뽑기(fs.readFileSync(원문경로, 'utf8'));
      mn = 실물에서뽑기(fs.readFileSync(argv[1], 'utf8'));
      if (!ko || !mn) {
        console.error('실행 오류: 뽑고 나니 한쪽이 비었다 — 파일이 머리말·기호뿐인가');
        process.exit(1);
      }
      대상 = path.relative(ROOT, path.resolve(argv[1])).replace(/\\/g, '/');
      대상지문 = 지문(fs.readFileSync(argv[1]));
    } else {
    const 쪼갬 = 파일분해(fs.readFileSync(argv[1], 'utf8'));
    if (!쪼갬) {
      console.error('실행 오류: 파일 형식이 아니다 — 한국어 원문 / 단독 줄 --- / 몽골어 번역 순이어야 한다');
      console.error('        (또는 `--원문 <한국어파일>` 을 주면 대상 파일을 몽골어 실물로 읽는다)');
      process.exit(1);
    }
      ko = 쪼갬.원문; mn = 쪼갬.번역;
      // 드리프트를 재는 자는 **파일 지문**이다 — 검문한 그 바이트가 그대로인지만 이게 안다.
      대상 = path.relative(ROOT, path.resolve(argv[1])).replace(/\\/g, '/');
      대상지문 = 지문(fs.readFileSync(argv[1]));
    }
  } else {
    // 플래그는 원문이 아니다 — 안 걸러내면 `--한증인` 이 한국어 원문 자리로 들어간다.
    [ko, mn] = argv.filter((a) => !a.startsWith('--'));
  }
  if (!ko || !mn) {
    console.error('쓰는 법: node tools/몽골어대조.js "<한국어 원문>" "<몽골어 번역문>"');
    console.error('        node tools/몽골어대조.js --파일 <경로>   (한국어 / --- / 몽골어)');
    console.error('        뒤에 --돈 을 붙이면 유료 문(Vertex)으로 간다 — 무료 크레딧이 내고 하루 20발 벽이 없다.');
    process.exit(1);
  }
  const keyPath = 정책.제미나이키경로(열쇠용도);
  if (!fs.existsSync(keyPath)) {
    console.error('실행 오류: ' + 정책.제미나이키안내(열쇠용도));
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

  /* 맞춤법 층은 **다른 서비스**(spellcheck.mn)라 제미나이 분당 상한과 안 부딪힌다 —
   * 먼저 띄워 놓고 아래 제미나이 두 번이 도는 동안 같이 굴린다(벽시계 공짜). */
  const 맞춤법약속 = 맞춤법검사(mn).catch(() => null);

  // 직렬 호출 — 무료 티어 분당 상한을 나란히 때리지 않는다. 문법(판정층)이 먼저다.
  const 문법답 = await 제미나이(key, model,
    `다음 몽골어 글의 문법과 자연스러움만 평가해라. 원문·의도는 모른다고 가정한다.\n여러 문장이면 전부 보고 가장 나쁜 문장 기준으로 판정한다.\n문제가 있으면 문제문장 필드에 그 문장을 원문 그대로 담아라.\n\n${mn}`,
    { schema: 문법스키마, thinking, 용도: 열쇠용도 });
  const 역번역 = await 제미나이(key, model,
    `다음 몽골어를 한국어로 "직역"해라. 자연스럽게 다듬지 말고 어색하면 어색한 채로, 문장 수와 순서를 그대로 유지해 옮겨라. 번역문만 출력.\n\n${mn}`,
    { thinking, 용도: 열쇠용도 });

  const 문법 = 문법파싱(문법답);
  const 역실패 = !역번역;

  /* 「어느 문으로 갔나」를 화면이 말한다 — 안 적으면 대량으로 돌린 뒤 「공짜로 돈 줄 알았다」가 된다. */
  console.log(`모델: ${model}${thinking ? ' · thinking=' + thinking : ''} · ${열쇠용도 === '돈'
    ? '유료 문(Vertex · 무료 크레딧이 낸다 · 하루 몫 벽 없음)'
    : '무료 몫(하루 20발 · 학생 개인정보 금지)'}`);
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

  /* ④ 맞춤법 — 앞 세 층이 못 보는 축. null = 서비스에 «못 물어봤다»(0건 아님). */
  const 맞춤법 = await 맞춤법약속;
  const 맞춤법미실행 = 맞춤법 === null;
  console.log('\n■ 맞춤법 (spellcheck.mn · 사전 자 — 역번역이 원리상 못 보는 축)');
  if (맞춤법미실행) {
    console.log('  🔴 이 층은 **안 돌았다** — 서비스에 못 닿았거나 응답 형식이 바뀌었다.');
    console.log('     0건이 아니라 «미측정»이다.');
  } else if (맞춤법.의심.length) {
    for (const w of 맞춤법.의심) {
      const s = 맞춤법.제안[w];
      console.log(`  ✖ ${w}${s === null ? ' (제안 못 받음)' : s && s.length ? ' → ' + s.slice(0, 5).join(', ') : ' (제안 없음 — 사전에 아예 없는 낱말)'}`);
    }
    console.log('  → 제안이 있으면 대개 진짜 오타다. 제안이 «없으면» 사전 밖 낱말(외래어·고유명사)이라 사람이 본다.');
  } else {
    console.log('  ✅ 의심 낱말 없음');
  }
  if (맞춤법 && 맞춤법.허용.length) {
    console.log(`  (우리 이름이라 통과시킨 것: ${[...new Set(맞춤법.허용)].join(', ')})`);
  }

  /* ⑤ 뜻 대조 — 역번역이 «원문과 같은 것»을 말하나. codex(다른 업체)가 한국어 둘을 견준다.
   *   `--한증인` 을 주면 건너뛴다(빠른 확인용) — 다만 «미측정»이지 통과가 아니다. */
  const 한증인 = argv.includes('--한증인');
  let 뜻 = null, 뜻미실행 = true;
  if (!역실패) {
    if (한증인) {
      console.log('\n■ 뜻 대조 (codex) — ⏭ --한증인 이라 안 돌렸다. **미측정**이지 통과가 아니다.');
    } else {
      뜻 = await 뜻대조(ko, 역번역);
      뜻미실행 = 뜻 === null;
      console.log('\n■ 뜻 대조 (codex · 다른 업체 — 역번역을 만든 자가 제 답을 채점하지 않게)');
      if (뜻미실행) {
        console.log('  🔴 이 층은 **안 돌았다** — codex 를 못 불렀거나(한도·부재) 답 형식을 못 읽었다.');
        console.log('     0건이 아니라 «미측정»이다.');
      } else {
        if (뜻.큰것.length) {
          console.log('  ✖ **큰 차이** — 읽는 사람이 다르게 믿게 된다:');
          for (const c of 뜻.큰것) console.log(`     · ${c}`);
          console.log('  → 문법이 멀쩡한 채로 «딴 얘기»가 되는 계열이다. 앞 네 층은 원리상 못 잡는다.');
        } else {
          console.log('  ✅ 큰 차이 없음 (읽는 사람이 다르게 믿을 만한 것은 없다)');
        }
        if (뜻.작은것.length) {
          console.log(`  ⚪ 작은 차이 ${뜻.작은것.length}건 — 게이트를 막지 않는다(직역이라 나는 것):`);
          for (const s of 뜻.작은것.slice(0, 6)) console.log(`     · ${s}`);
          if (뜻.작은것.length > 6) console.log(`     · … 외 ${뜻.작은것.length - 6}건`);
        }
        if (뜻.어긋남) console.log(`  ⚠ 모델이 큰것 ${뜻.큰수}개라 했는데 걷힌 줄은 ${뜻.큰것.length}개다 — 셈을 믿었다.`);
      }
    }
  }

  // 실패 방향: 어느 층이든 「모름」이면 통과가 아니다 — 미실행도 「모름」이다.
  const 통과 = !!문법 && 문법.판정 === '정상' && !역실패 && !말투미실행 && !말투.length
    && !맞춤법미실행 && !맞춤법.의심.length && !뜻미실행 && 뜻.같다;
  const 사유 = !문법 ? '판정불능'
    : 역실패 ? '역번역 실패'
    : 문법.판정 !== '정상' ? `문법 판정: ${문법.판정}`
    : 말투미실행 ? '말투 층 미실행(voice-guard 철거 — 사람 검수 필요)'
    : 말투.length ? `말투 위반 ${말투.length}건(${말투.map((v) => v.id).join('·')})`
    : 맞춤법미실행 ? '맞춤법 층 미실행(spellcheck.mn 못 닿음 — 사람 검수 필요)'
    : 맞춤법.의심.length ? `맞춤법 의심 ${맞춤법.의심.length}건(${맞춤법.의심.slice(0, 5).join('·')})`
    : 뜻미실행 ? (한증인 ? '뜻 대조 층 건너뜀(--한증인)' : '뜻 대조 층 미실행(codex 못 부름 — 사람 검수 필요)')
    : !뜻.같다 ? `뜻 큰 차이 ${뜻.큰것.length || 뜻.큰수}건: ${뜻.이유 || '(이유 미기재)'}`
    : '통과';
  console.log(`\n■ 종합: ${통과 ? '✅ 기계 검문 통과 — 대외 확정본은 그래도 사람 검수' : '🔴 사람 검수 필요'} (${사유})`);

  /* 장부 — 「이 문안이 검문을 지났나」를 세는 유일한 자리. 통과·불통과를 **둘 다** 남긴다:
   * 통과만 남기면 「검문했는데 걸렸다」와 「아예 안 했다」가 같은 모양이 된다. */
  const 실패 = 장부쓰기({
    시각: new Date().toISOString(),
    대상, 대상지문,
    번역지문: 지문(Buffer.from(String(mn), 'utf8')),
    모델: model, 사고: thinking || null,
    통과, 사유,
    층: {
      문법: 문법 ? 문법.판정 : null,            // null = 판정불능(안 잰 것)
      역번역: !역실패,
      말투: 말투미실행 ? null : 말투.length,    // null = 미실행 · 숫자 = 잰 결과
      맞춤법: 맞춤법미실행 ? null : 맞춤법.의심.length, // 같은 규약 — null 은 0 이 아니다
      // null = 미측정 · 숫자 둘 = 잰 결과(작은 것은 게이트를 안 막지만 «몇 건이었나»는 남긴다)
      뜻: 뜻미실행 ? null : { 큰것: 뜻.큰것.length, 작은것: 뜻.작은것.length },
    },
  });
  if (실패) console.log(`⚠ 장부에 못 남겼다(${실패}) — 이 검문은 «셈에 안 잡힌다»: ${장부경로()}`);
  else console.log(`   장부: ${path.relative(ROOT, 장부경로()).replace(/\\/g, '/')}${대상지문 ? ` · 대상지문 ${대상지문}` : ' · (인자 모드 — 드리프트는 못 잰다)'}`);

  process.exit(통과 ? 0 : 2);
}

module.exports = { 키추출, 판정추출, 문법파싱, 파일분해, 재시도가능, 토큰대조, 말투대조, 지문, 장부쓰기, 장부경로 };

if (require.main === module) {
  main().catch((e) => {
    console.error('실행 오류:', e.message);
    process.exit(1);
  });
}
