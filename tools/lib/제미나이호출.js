#!/usr/bin/env node
'use strict';
/* 제미나이 호출 — **한 통로**(2026-09-02 · 유호 「전부 진행해줘」).
 *
 * ■ 왜 lib 로 올렸나
 *   `tools/몽골어대조.js` 가 쥐고 있던 HTTP 호출을 검수 러너(`tools/codex-review.js` 의 gemini 레인)도
 *   쓰게 됐다. 같은 함수가 두 파일에 있으면 재시도·타임아웃·스키마 처리가 갈리고, 갈린 쪽은 조용하다
 *   (constant-known-in-two-places). 그래서 여기 하나로 모으고 둘 다 여기서 가져간다.
 *
 * ■ 이 파일은 API 직결 전용이다. 로컬 검수의 기본 구독 경로는 `제미나이구독호출.js`다.
 *   API가 필요한 자리에서만 이 파일을 쓰며, 기본은 AI Studio 무료 문이다.
 *   유료 Vertex는 `--용도 돈 --유료-api`를 함께 줘야 한다.
 *
 * ■ 왜 API 직결 통로를 남기나
 *   09-02 실측: `gemini -m gemini-3.7-flash` 를 시켜도 `stats.models` 가 `gemini-3.5-flash` 였다
 *   (공개 이슈 #28859 · 수정 미병합). 서빙 모델이 조용히 바뀌는 통로에 검수 픽을 걸 수 없다.
 *   HTTP 직결은 응답 `modelVersion` 이 «무엇이 답했나»를 그대로 말한다 — 그 값을 장부에 적는다.
 *   인증·비용은 같다(같은 API 키 · 같은 무료 등급).
 *
 * ■ 동기 호출이 필요한 자리(검수 러너는 execFileSync 세상이다)는 이 파일을 **자식 프로세스로** 부른다:
 *     node tools/lib/제미나이호출.js --model <id> [--thinking high] [--schema <json파일>] -o <출력파일> [--timeout <ms>]
 *   프롬프트는 stdin 으로 받는다. 출력 파일 = { text, modelVersion, finishReason, usage }.
 *   종료코드 0=답함 · 1=인자 오류 · 2=호출 실패(= 확인 불가 · 「0건」으로 접지 않는다).
 *   키는 `tools/모델정책.js` 의 `제미나이키()` 가 읽는다(파일 경로만 · 값은 어디에도 안 적는다).
 */

const fs = require('fs');
const path = require('path');

/* 🚪 주소는 `tools/모델정책.js` 의 `제미나이URL(용도, 모델)` 하나가 쥔다(09-04) — 「글」은 AI Studio,
 * 「돈」은 Vertex AI 다. 여기 상수로 두면 문이 두 곳에 살아 한쪽만 옮겨진다(constant-known-in-two-places).
 * 용도를 안 준 호출은 정책의 `기본용도()`(= '글' · AI Studio 무료 문)로 간다. 여기서 값을
 * 다시 적지 않는다 — 기본이 두 곳에 살면 한쪽만 바뀐다. BASE 는 옛 이름 그대로 «기본 문»의 값을 내보낸다. */
const 정책 = require(require('path').join(__dirname, '..', '모델정책.js'));
const BASE = 정책.제미나이문(정책.기본용도()).base;
const 호출타임아웃 = 60_000;
const 재시도지연 = [5_000, 15_000]; // 무료 티어 분당 상한(429)·순간 장애(500/503)용

function 재시도가능(status) {
  return status === 429 || status === 500 || status === 503;
}

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

/* 🔄 무료 몫 → 구독 대체(2026-10-17 · 유호 「무료 다 쓰면 울트라로 넘어가게 세팅해도 좋을것같아」).
 * 무료 「글」 문이 몫 상한(429·RESOURCE_EXHAUSTED)에 막히면, 정책 `구독대체`와 부른 쪽 `opts.구독대체`가
 * 둘 다 켜진 경우에만 같은 모델·같은 사고 수준으로 Google AI 구독 통로(agy · 지금 Ultra 계정)를 한 번 부른다.
 * 대체하지 않는 것: 유료 「돈」(Vertex) · CI · 끄기 변수 SYNK_GEMINI_NO_SUBSCRIPTION_FALLBACK=1 ·
 *   429가 아닌 실패(400/401/403/5xx·잘린 답·서빙 모델 불일치는 몫 문제가 아니다).
 * 구독 통로가 그 모델을 모르면 멈춘다 — 모델을 바꾸지 않는다. 구독도 실패하면 Vertex로 가지 않고 끝낸다.
 * 하루 몫(PerDay · 다시 시도까지 60초 이상)이면 5·15초 재시도를 건너뛰고 바로 넘기고, 분당 몫이면 재시도 뒤 넘긴다. */
function 시간초(글) {
  const m = /^\s*((?:\d+(?:\.\d+)?\s*[hms]\s*)+)$/i.exec(String(글 || ''));
  if (!m) return null;
  let 초 = 0;
  for (const [, n, u] of m[1].matchAll(/(\d+(?:\.\d+)?)\s*([hms])/gi)) 초 += Number(n) * ({ h: 3600, m: 60, s: 1 }[u.toLowerCase()]);
  return 초;
}

function 몫읽기(status, 본문) {
  const e = (본문 && 본문.error) || {};
  const 말 = String(e.message || '');
  if (status !== 429 && e.status !== 'RESOURCE_EXHAUSTED') return { 몫: false };
  let 다시초 = null, 하루 = false;
  for (const d of Array.isArray(e.details) ? e.details : []) {
    if (d && typeof d.retryDelay === 'string') 다시초 = 시간초(d.retryDelay) ?? 다시초;
    for (const v of (d && Array.isArray(d.violations) ? d.violations : [])) {
      if (/PerDay|per_day/i.test(`${(v && v.quotaId) || ''} ${(v && v.quotaMetric) || ''}`)) 하루 = true;
    }
  }
  if (다시초 == null) { const m = /retry in ((?:\d+(?:\.\d+)?\s*[hms]\s*)+)/i.exec(말); if (m) 다시초 = 시간초(m[1]); }
  return { 몫: true, 하루: 하루 || (다시초 != null && 다시초 >= 60), 다시초, 사유: 말.slice(0, 200) };
}

function 구독대체허용(opts = {}, 용도, env = opts.환경 || process.env) {
  return !!opts.구독대체 && 정책.제미나이 && 정책.제미나이.구독대체 === true && 용도 === '글'
    && !env.CI && !env.GITHUB_ACTIONS && env.SYNK_GEMINI_NO_SUBSCRIPTION_FALLBACK !== '1';
}

async function 구독으로대체(model, prompt, opts, 몫) {
  const 부르기 = typeof opts.구독호출 === 'function' ? opts.구독호출 : require('./제미나이구독호출.js').부르기;
  let 기록;
  try {
    기록 = await 부르기({ model, prompt, schema: opts.schema || null, thinking: opts.thinking || 'high', timeoutMs: opts.구독타임아웃 });
  } catch (e) {
    throw new Error(`429 무료 몫 상한 — 구독 통로로 넘겼지만 실패했다(Vertex로는 가지 않는다): ${e.message}`);
  }
  const text = String((기록 && 기록.text) || '');
  if (!text) throw new Error('429 무료 몫 상한 — 구독 통로가 빈 답을 냈다');
  const 대체 = { from: 'google-ai-studio-free-api', 사유: 몫.하루 ? '하루 몫 상한' : '분당 몫 상한', 다시초: 몫.다시초 ?? null };
  if (opts.상세) return { ...기록, text, route: (기록 && 기록.route) || 'google-ai-subscription', requestedModel: model, 대체 };
  return text;
}

/* Gemini 의 responseSchema 는 JSON Schema 의 «부분집합»이다 — `additionalProperties`·`$schema`·
 * `description` 은 받되 `additionalProperties:false` 는 400 을 낸다. 우리 스키마(codex-review.schema.json)
 * 를 그대로 주려고 그 키만 걷는다. 걷은 뒤에도 필수 키·enum·타입은 그대로라 판정력은 같다. */
function 제미나이스키마(schema) {
  if (Array.isArray(schema)) return schema.map(제미나이스키마);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties' || k === '$schema') continue;
    out[k] = 제미나이스키마(v);
  }
  return out;
}

/* generateContent의 비스트리밍 텍스트 응답 계약(공식 REST v1, 2026-09-11).
 * STOP만 완결 답이며 thought=true는 최종 답이 아니다. 모델의 숫자/날짜 판번호는
 * 허용하되 flash-lite처럼 다른 제품 계열은 같은 접두라는 이유로 통과시키지 않는다. */
function 서빙모델일치(요청, 실제) {
  if (typeof 실제 !== 'string' || !실제) return false;
  if (실제 === 요청) return true;
  if (!실제.startsWith(`${요청}-`)) return false;
  return /^(?:\d{3}|\d{2}-\d{2}|\d{4}-\d{2}-\d{2})$/.test(실제.slice(요청.length + 1));
}

function 응답읽기(본문, model) {
  const c = 본문 && Array.isArray(본문.candidates) && 본문.candidates[0];
  if (!c) {
    const why = 본문 && 본문.promptFeedback && 본문.promptFeedback.blockReason;
    throw new Error(`완료 후보가 없다${why ? ` (${why})` : ''}`);
  }
  if (c.finishReason !== 'STOP') {
    throw new Error(`답이 정상 완료되지 않았다: ${c.finishReason || 'finishReason 없음'}`);
  }
  const parts = c.content && c.content.parts;
  const text = (Array.isArray(parts) ? parts : [])
    .filter((p) => p && p.thought !== true && typeof p.text === 'string')
    .map((p) => p.text).join('').trim();
  if (!text) throw new Error('최종 텍스트가 비었다(사고 요약은 답으로 세지 않는다)');
  if (!서빙모델일치(model, 본문.modelVersion)) {
    throw new Error(`서빙 모델 확인 불가: 요청 ${model} · 실제 ${본문.modelVersion || '(없음)'}`);
  }
  return { text, modelVersion: 본문.modelVersion, finishReason: c.finishReason };
}

/** 답 텍스트(기본) 또는 `opts.상세` 면 { text, modelVersion, finishReason, usage }.
 *  @param opts.용도 '글'(기본 · AI Studio 무료 문) | '돈'(명시 승인 전용 · Vertex)
 *  @param opts.구독대체 true면 무료 몫 429에서 같은 모델로 구독 통로를 부른다(위 설명). 상세에는 `대체`가 붙는다. */
async function 제미나이(key, model, prompt, opts = {}) {
  const 타임아웃 = Number(opts.timeoutMs) || 호출타임아웃;
  const 용도 = opts.용도 || 정책.기본용도();
  const 지연 = Array.isArray(opts.재시도지연) ? opts.재시도지연 : 재시도지연;
  // 비용 차단·자격 실패는 재시도로 풀리지 않는다. 전송 루프 밖에서 한 번 확인한다.
  const headers = await 정책.제미나이헤더(용도);
  for (let 회 = 0; ; 회++) {
    let res, 본문;
    try {
      res = await fetch(정책.제미나이URL(용도, model), {
        method: 'POST',
        // 🔑 인증 머리는 정책이 낸다 — 글=API 키 · 돈=OAuth 토큰(Vertex 는 키를 못 받는다 · 09-04).
        headers,
        body: JSON.stringify({
          // 🔑 `role` 은 Vertex 문이 요구한다(없으면 400 · 09-04) — AI Studio 도 받는 형태다.
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          // 사고 수준은 정책 픽의 모델일 때만 싣는다 — 딴 모델을 골랐으면 그 모델이 이 파라미터를
          // 받는지 모르므로 안 보낸다(조용한 400 방지).
          ...(opts.schema || opts.thinking
            ? {
                generationConfig: {
                  ...(opts.schema ? { responseMimeType: 'application/json', responseSchema: 제미나이스키마(opts.schema) } : {}),
                  ...(opts.thinking ? { thinkingConfig: { thinkingLevel: opts.thinking } } : {}),
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(타임아웃),
      });
    } catch (e) {
      if (회 < 지연.length) { await 잠깐(지연[회]); continue; }
      throw new Error(`네트워크/타임아웃: ${e.message}`);
    }
    // 성공 HTTP 뒤의 깨진 JSON은 같은 생성 요청을 다시 보내지 않는다.
    try { 본문 = await res.json(); }
    catch {
      if (res.ok) throw new Error(`HTTP ${res.status}: 응답 JSON을 읽을 수 없다`);
      본문 = null;
    }
    if (!res.ok) {
      const 몫 = 몫읽기(res.status, 본문);
      const 넘김 = 몫.몫 && 구독대체허용(opts, 용도);
      if (넘김 && 몫.하루) return 구독으로대체(model, prompt, opts, 몫);
      if (재시도가능(res.status) && 회 < 지연.length) { await 잠깐(지연[회]); continue; }
      if (넘김) return 구독으로대체(model, prompt, opts, 몫);
      if (!본문) throw new Error(`HTTP ${res.status}: 응답 JSON을 읽을 수 없다`);
      throw new Error(`${res.status} ${(본문.error && 본문.error.message) || ''}`.trim());
    }
    const 답 = 응답읽기(본문, model);
    if (opts.상세) {
      return {
        ...답,
        usage: 본문.usageMetadata || null,
        route: 용도 === '돈' ? 'vertex-paid-api' : 'google-ai-studio-free-api',
        requestedModel: model,
      };
    }
    return 답.text;
  }
}

/* ── CLI 진입(자식 프로세스용) ── */
function 인자(argv, 이름) {
  const i = argv.indexOf(이름);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (!v || /^--?[a-z]/i.test(v)) { console.error(`실행 오류: ${이름} 뒤에 값이 없다`); process.exit(1); }
  return v;
}

async function main() {
  const argv = process.argv.slice(2);
  const model = 인자(argv, '--model');
  const out = 인자(argv, '-o');
  if (!model || !out) { console.error('사용: node tools/lib/제미나이호출.js --model <id> [--thinking high] [--schema <json>] -o <출력> [--timeout <ms>] [--용도 글|돈] [--유료-api]  (프롬프트 = stdin)'); process.exit(1); }
  const thinking = 인자(argv, '--thinking');
  const 스키마경로 = 인자(argv, '--schema');
  const timeoutMs = Number(인자(argv, '--timeout')) || undefined;
  let schema = null;
  if (스키마경로) {
    try { schema = JSON.parse(fs.readFileSync(path.resolve(스키마경로), 'utf8')); }
    catch (e) { console.error(`실행 오류: 스키마를 못 읽었다 — ${e.message}`); process.exit(1); }
  }
  /* 🚪 API 기본은 무료 「글」 문이다. 유료 Vertex는 용도와 비용 승인을 둘 다 적어야 한다.
   * 개발 검수의 무거운 Pro 호출은 이 API가 아니라 Google AI Pro 구독 통로가 맡는다. */
  const 용도 = 인자(argv, '--용도') || 정책.기본용도();
  if (용도 !== '글' && 용도 !== '돈') {
    console.error(`실행 오류: --용도 는 글|돈 중 하나다 — 받은 값 "${용도}"`); process.exit(1);
  }
  const key = 용도 === '글' ? 정책.제미나이키('글') : null;
  if (용도 === '글' && !key) { console.error('확인 불가: ' + 정책.제미나이키안내('글')); process.exit(2); }
  const prompt = fs.readFileSync(0, 'utf8');
  if (!prompt.trim()) { console.error('실행 오류: stdin 프롬프트가 비었다'); process.exit(1); }
  try {
    const r = await 제미나이(key, model, prompt, { schema, thinking, timeoutMs, 용도, 상세: true });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(r), 'utf8');
  } catch (e) {
    console.error(`확인 불가: 제미나이 호출 실패 — ${e.message}`);
    process.exit(2);
  }
}

module.exports = { 제미나이, 제미나이스키마, 서빙모델일치, 응답읽기, 재시도가능, 몫읽기, 구독대체허용, 시간초, BASE, 호출타임아웃, 재시도지연 };

if (require.main === module) {
  main().catch((e) => { console.error('실행 오류:', e.message); process.exit(1); });
}
