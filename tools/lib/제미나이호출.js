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
 *  @param opts.용도 '글'(기본 · AI Studio 무료 문) | '돈'(명시 승인 전용 · Vertex) */
async function 제미나이(key, model, prompt, opts = {}) {
  const 타임아웃 = Number(opts.timeoutMs) || 호출타임아웃;
  // 비용 차단·자격 실패는 재시도로 풀리지 않는다. 전송 루프 밖에서 한 번 확인한다.
  const headers = await 정책.제미나이헤더(opts.용도 || 정책.기본용도());
  for (let 회 = 0; ; 회++) {
    let res, 본문;
    try {
      res = await fetch(정책.제미나이URL(opts.용도 || 정책.기본용도(), model), {
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
      if (회 < 재시도지연.length) { await 잠깐(재시도지연[회]); continue; }
      throw new Error(`네트워크/타임아웃: ${e.message}`);
    }
    // 성공 HTTP 뒤의 깨진 JSON은 같은 생성 요청을 다시 보내지 않는다.
    try { 본문 = await res.json(); }
    catch {
      if (!res.ok && 재시도가능(res.status) && 회 < 재시도지연.length) {
        await 잠깐(재시도지연[회]); continue;
      }
      throw new Error(`HTTP ${res.status}: 응답 JSON을 읽을 수 없다`);
    }
    if (!res.ok) {
      if (재시도가능(res.status) && 회 < 재시도지연.length) { await 잠깐(재시도지연[회]); continue; }
      throw new Error(`${res.status} ${(본문.error && 본문.error.message) || ''}`.trim());
    }
    const 답 = 응답읽기(본문, model);
    if (opts.상세) {
      return {
        ...답,
        usage: 본문.usageMetadata || null,
        route: (opts.용도 || 정책.기본용도()) === '돈' ? 'vertex-paid-api' : 'google-ai-studio-free-api',
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

module.exports = { 제미나이, 제미나이스키마, 서빙모델일치, 응답읽기, 재시도가능, BASE, 호출타임아웃, 재시도지연 };

if (require.main === module) {
  main().catch((e) => { console.error('실행 오류:', e.message); process.exit(1); });
}
