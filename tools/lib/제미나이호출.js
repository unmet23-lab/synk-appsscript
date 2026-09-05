#!/usr/bin/env node
'use strict';
/* 제미나이 호출 — **한 통로**(2026-09-02 · 유호 「전부 진행해줘」).
 *
 * ■ 왜 lib 로 올렸나
 *   `tools/몽골어대조.js` 가 쥐고 있던 HTTP 호출을 검수 러너(`tools/codex-review.js` 의 gemini 레인)도
 *   쓰게 됐다. 같은 함수가 두 파일에 있으면 재시도·타임아웃·스키마 처리가 갈리고, 갈린 쪽은 조용하다
 *   (constant-known-in-two-places). 그래서 여기 하나로 모으고 둘 다 여기서 가져간다.
 *
 * ■ 왜 CLI(HTTP 직결)인가 — Gemini CLI(`gemini -p`) 가 아니라
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
 * 🔄 09-05 밤 — 용도를 안 준 호출은 정책의 `기본용도()`(= '돈' · Vertex · 크레딧)로 간다(유호 확정). 여기서 '글' 을
 *   다시 적지 않는다 — 기본이 두 곳에 살면 한쪽만 바뀐다. BASE 는 옛 이름 그대로 «기본 문»의 값을 내보낸다. */
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

/** 답 텍스트(기본) 또는 `opts.상세` 면 { text, modelVersion, finishReason, usage }.
 *  @param opts.용도 '돈'(기본 · Vertex AI 문 · 09-05) | '글'(AI Studio 공짜 문 · 옵트인) — 주소를 이 값이 고른다(09-04) */
async function 제미나이(key, model, prompt, opts = {}) {
  const 타임아웃 = Number(opts.timeoutMs) || 호출타임아웃;
  for (let 회 = 0; ; 회++) {
    let res, 본문;
    try {
      res = await fetch(정책.제미나이URL(opts.용도 || 정책.기본용도(), model), {
        method: 'POST',
        // 🔑 인증 머리는 정책이 낸다 — 글=API 키 · 돈=OAuth 토큰(Vertex 는 키를 못 받는다 · 09-04).
        headers: await 정책.제미나이헤더(opts.용도 || 정책.기본용도()),
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
      본문 = await res.json();
    } catch (e) {
      if (회 < 재시도지연.length) { await 잠깐(재시도지연[회]); continue; }
      throw new Error(`네트워크/타임아웃: ${e.message}`);
    }
    if (!res.ok) {
      if (재시도가능(res.status) && 회 < 재시도지연.length) { await 잠깐(재시도지연[회]); continue; }
      throw new Error(`${res.status} ${(본문.error && 본문.error.message) || ''}`.trim());
    }
    const c = 본문.candidates && 본문.candidates[0];
    const t = c && c.content && c.content.parts && c.content.parts.map((p) => p.text).join('');
    const text = (t || '').trim();
    if (opts.상세) {
      return {
        text,
        modelVersion: 본문.modelVersion || null,   // «무엇이 답했나» — 픽과 다르면 장부가 그 사실을 들고 나간다
        finishReason: (c && c.finishReason) || null,
        usage: 본문.usageMetadata || null,
      };
    }
    return text;
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
  if (!model || !out) { console.error('사용: node tools/lib/제미나이호출.js --model <id> [--thinking high] [--schema <json>] -o <출력> [--timeout <ms>]  (프롬프트 = stdin)'); process.exit(1); }
  const thinking = 인자(argv, '--thinking');
  const 스키마경로 = 인자(argv, '--schema');
  const timeoutMs = Number(인자(argv, '--timeout')) || undefined;
  let schema = null;
  if (스키마경로) {
    try { schema = JSON.parse(fs.readFileSync(path.resolve(스키마경로), 'utf8')); }
    catch (e) { console.error(`실행 오류: 스키마를 못 읽었다 — ${e.message}`); process.exit(1); }
  }
  /* 🚪 **창구를 부르는 쪽이 고른다** (2026-09-04 · 그날 실측이 이 문을 열게 했다).
   *   🔄 09-05 밤 — 기본은 「돈」(Vertex · 크레딧)이다(유호 확정 「앞으로 제미나이 열쇠는 vertex로」 · 정책 `기본용도()`).
   *     「글」(AI Studio · 공짜 몫)은 `--용도 글` 을 손으로 줄 때만 — 아래 09-04 사연은 그 문이 왜 예비로 내려갔는지다.
   *   (09-04 판) 기본은 「글」이었다 — 몽골어 검문과 검수 둘째 눈처럼 **자주·가볍게** 도는 일.
   *   🔴 그런데 공짜 몫은 **하루 20발**이고, 09-04 «첫» 설계 심문이 정확히 거기서 죽었다:
   *     `Quota exceeded ... generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash`.
   *     심문은 문서 전문을 통째로 보내는 «무겁고 드문» 호출이라, 이 몫에 얹으면 그날 다른 일이 다 막힌다.
   *   ⇒ 무거운 자리는 `--용도 돈`(Vertex AI · 크레딧 ₩435,523 · ⏰시한 2026-11-13)으로 부른다.
   *   ⚠ 「돈」은 잔액이 닳는다 — **자주 도는 자리를 여기로 옮기지 않는다**(마르면 카드로 넘어간다).
   *   🚫 그림·음악·목소리는 여기를 안 지나간다(각자 제 통로에서 「돈」을 쓴다 · 유호 확정 09-03). */
  const 용도 = 인자(argv, '--용도') || 정책.기본용도();
  if (용도 !== '글' && 용도 !== '돈') {
    console.error(`실행 오류: --용도 는 글|돈 중 하나다 — 받은 값 "${용도}"`); process.exit(1);
  }
  const key = 정책.제미나이키(용도);
  if (!key) { console.error('확인 불가: ' + 정책.제미나이키안내(용도)); process.exit(2); }
  const prompt = fs.readFileSync(0, 'utf8');
  if (!prompt.trim()) { console.error('실행 오류: stdin 프롬프트가 비었다'); process.exit(1); }
  try {
    const r = await 제미나이(key, model, prompt, { schema, thinking, timeoutMs, 용도, 상세: true });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(r), 'utf8');
    if (r.modelVersion && !String(r.modelVersion).startsWith(model)) {
      console.error(`⚠ 서빙 모델이 픽과 다르다 — 픽 ${model} · 답한 것 ${r.modelVersion}`);
    }
  } catch (e) {
    console.error(`확인 불가: 제미나이 호출 실패 — ${e.message}`);
    process.exit(2);
  }
}

module.exports = { 제미나이, 제미나이스키마, 재시도가능, BASE, 호출타임아웃, 재시도지연 };

if (require.main === module) {
  main().catch((e) => { console.error('실행 오류:', e.message); process.exit(1); });
}
