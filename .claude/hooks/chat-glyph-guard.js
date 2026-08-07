#!/usr/bin/env node
// chat-glyph-guard — 이번 턴 **내 발화**가 유호님 화면에서 깨지는 두 자리를 턴이 끝나기 전에 잡는다 (Stop 훅)
//
//   ① 옛 글자(한자·가나) — 유호님이 못 읽는 글자          (F167)
//   ② 표의 칸수가 구분선과 다름 — 열 하나가 통째로 빈다   (F119)
//
// 두 규칙이 한 훅에 사는 이유: 축이 같다(「이번 턴 내 산문」) — 아래 턴 경계·꼬리읽기·루프금지가
//   그대로 공유된다. 규칙마다 훅을 떼면 **등록층이 하나 더 생기고, 가드가 새는 곳은 언제나 거기다**
//   (F044 · CLAUDE.md 신뢰성). 파일 이름이 ①만 가리키는 것은 알고 둔다 — 개명은 settings.json·회귀·
//   훅등록 검사를 함께 건드리는데 행동이 0 만큼도 안 바뀐다.
//
// 왜 있나 (F167 · 2026-08-07): 유호님이 「한글·몽골어·영어 셋만」이라고 확정한 직후, 보고 **표**에
//   한자 20자가 그대로 실려 나갔다. 파일 층 검문(tests/문서문자.test.js)은 그날 닫혔지만
//   사고 표면은 파일이 아니라 **채팅**이었고, 그 층은 「훅은 대화를 못 본다」는 진단과 함께
//   기계 없이 남았다. 그 진단은 오진이다 — Stop 훅은 transcript_path 를 받는다
//   (context-budget.js:128 이 이미 같은 경로를 읽는다). 유호님이 못 읽는 글자가 화면에 닿기 전,
//   같은 턴 안에서 되돌리는 것이 이 훅의 전부다.
//
// 무엇을 재나 — **이번 턴의 내 발화만**. 축을 정확히 둔다:
//   · assistant 항목의 text 블록만 본다. thinking·tool_use 입력·tool_result 는 유호님께
//     보이는 산문이 아니다(도구 결과 속 한자는 내 위반이 아니라 관측 대상이다).
//   · 턴 경계 = 마지막 **실제 유저 입력**(content 가 문자열이거나, 배열인데 tool_result 가 없는
//     user 항목 · isMeta 는 경계가 아니다). tool_result 캐리어는 user 역할로 돌아오므로
//     그걸 경계로 잡으면 턴 중간 보고 표(F167 의 실제 모양)가 통째로 사각이 된다.
//   · 지난 턴은 안 잰다 — 이미 화면에 닿은 글은 이 층에서 못 되돌린다(그건 그 턴의 Stop 몫이었다).
//
// 옛글자 정의는 tests/문서문자.test.js 와 **같은 값**이어야 한다 — 직접 import 하면 훅이 테스트
//   파일에 기대게 되므로 사본으로 두고, [단일 출처] 회귀(tests/채팅글자가드.test.js)가 두 소스의
//   문자 클래스를 그대로 대조한다. ⚠ 범위 경계를 글자로 적지 않는다 — 적으면 문서문자 스캔이
//   이 파일을 잡는다(그쪽 머리말과 같은 규율).
//
// 루프를 만들지 않는다: stop_hook_active 면 통과다(이미 한 번 되돌린 턴을 또 막으면
//   수정문이 또 막히는 자리만 남는다 — 처방을 따를 수 있어야 가드다 · F103).
// 새는 방향: 판정 불가(입력·대화록 없음·파싱 실패)는 전부 **통과**다 — 이 훅은 소통 가드지
//   안전장치가 아니라서, 여기가 막히면 세션 전체가 멈춘다. 탐지력은 회귀 픽스처가 못박는다.
'use strict';
const fs = require('fs');
const path = require('path');
const 표 = require(path.join(__dirname, '..', '..', 'tools', 'lib', '표.js')); // 백틱 안 파이프는 칸막이가 아니다

// tests/문서문자.test.js:28 과 같은 클래스 — 한자(통합·확장A)+가나. 갈라짐은 [단일 출처] 회귀가 잡는다.
const 옛글자 = new RegExp('[\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF]', 'gu');

/* ② 표 칸수 — F119(2026-08-06 유호님 교정: "판정 열이 비어 보임").
 *
 * 원인은 **칸 폭이 아니라 칸수**였다. 전 대화록 단일변수 실측(2026-08-07):
 *   사고 표 862517d8 = 헤더 `| # | 피드백 | 판정 |`·구분선 둘 다 3열인데 데이터 6행이 전부 2열.
 *   피드백과 판정을 한 칸에 합쳐 써서 GFM 이 3번째 열을 **빈 칸으로 채웠다** — 렌더가 깨진 게
 *   아니라 내가 안 쓴 것이다. 폭 가설은 같은 실측이 기각했다(그 표의 최대 칸은 402 인데,
 *   402 짜리 칸을 가진 다른 표들은 유호님이 문제 삼은 적이 없다).
 *
 * 왜 기계가 필요한가 — **이 실패는 나에게 안 보인다.** 내가 쓴 원문에는 판정 내용이 멀쩡히 있고,
 *   비는 것은 유호님 화면뿐이다(F167 과 같은 계열). 그래서 잡는 층도 같은 층이다.
 *
 * 빈도(전 대화록 685개): 어긋난 행 7/6,126(0.11%) · 표 2/1,459 — 그중 하나가 그 사고다.
 * 거짓양성은 원리적으로 0 이다 — GFM 에서 행 칸수 ≠ 구분선 칸수는 **언제나** 빈 열(모자람) 또는
 *   버려진 칸(넘침)이다. 임계값이 없으니 눈금을 고를 일도 없다.
 */
function 어긋난표칸(text) {
  const 구분선 = (t) => /^\|[\s:|-]+\|?$/.test(t) && t.includes('-');
  const out = [];
  let 펜스 = false, 기준 = 0, 머리 = '';
  for (const 원줄 of String(text).split('\n')) {
    const t = 원줄.trim();
    // 코드펜스 안은 표가 아니라 **표를 보여주는 글**이다(이 결함을 설명하는 예시가 그 자리에 산다).
    if (/^(```|~~~)/.test(t)) { 펜스 = !펜스; 기준 = 0; 머리 = ''; continue; }
    if (펜스) continue;
    if (!t.startsWith('|')) { 기준 = 0; 머리 = ''; continue; }
    if (기준 === 0) {
      if (!구분선(t)) { 머리 = t; continue; }   // 아직 구분선 전 — 마지막 줄이 헤더다
      기준 = 표.칸나누기(t).length;
      // 헤더도 같은 규칙을 받는다 — 헤더 칸수가 구분선과 다르면 GFM 은 표로 **렌더하지도 않는다**.
      const h = 머리 ? 표.칸나누기(머리).length : 기준;
      if (h !== 기준) out.push({ 기준, 실제: h, 줄: 머리 });
      continue;
    }
    const n = 표.칸나누기(t).length;
    if (n !== 기준) out.push({ 기준, 실제: n, 줄: t });
  }
  return out;
}

// 한 턴 발화가 이보다 클 수 없는 꼬리만 읽는다(출력 상한 ≈ 130KB) — 매 턴 전체 읽기는 세금이다.
const 꼬리 = 512 * 1024;

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }
if (input.stop_hook_active) process.exit(0); // 이번 턴은 이미 한 번 되돌렸다 — 루프 금지

const tp = String(input.transcript_path || '');
if (!tp) process.exit(0);

let raw;
try {
  const size = fs.statSync(tp).size;
  const start = Math.max(0, size - 꼬리);
  const buf = Buffer.alloc(size - start);
  const fd = fs.openSync(tp, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, start); } finally { fs.closeSync(fd); }
  raw = buf.toString('utf8');
} catch (_) { process.exit(0); }

const 줄들 = raw.split('\n');
if (raw.length >= 꼬리) 줄들.shift(); // 꼬리 절단으로 깨진 첫 줄

/** 이번 턴의 내 발화(text 블록)를 뒤에서 앞으로 모은다 — 실제 유저 입력에서 멈춘다. */
const 내발화 = [];
for (let i = 줄들.length - 1; i >= 0; i--) {
  let e; try { e = JSON.parse(줄들[i]); } catch (_) { continue; }
  const c = e && e.message && e.message.content;
  if (e.type === 'assistant' && Array.isArray(c)) {
    for (const b of c) if (b && b.type === 'text' && b.text) 내발화.push(String(b.text));
  } else if (e.type === 'user' && !e.isMeta) {
    const 도구캐리어 = Array.isArray(c) && c.some((b) => b && b.type === 'tool_result');
    if (!도구캐리어) break; // 실제 유저 턴 — 여기부터는 지난 턴이다
  }
}
if (!내발화.length) process.exit(0);

const 사유 = [];

/* ① 옛 글자 */
const 위반 = new Set();
for (const t of 내발화) for (const m of t.match(옛글자) || []) 위반.add(m);
if (위반.size) {
  const 코드 = [...위반].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
  const 목록 = 코드.slice(0, 8).join(' ') + (코드.length > 8 ? ` 외 ${코드.length - 8}종` : '');
  사유.push(
    `방금 발화에 옛 글자 ${위반.size}종(${목록})이 있다 — 유호님은 그 글자를 못 읽는다`
    + '(F167 · 확정 「한글·몽골어·영어 셋만」).\n'
    + '→ 같은 내용을 **그 글자 없이** 다시 말하라: 한글로 풀거나, 글자 자체를 짚어야 하면 U+ 코드나 한글 음으로 적는다.\n'
    + '→ 파일·데이터 인용이 원인이면 원문을 붙이지 말고 한글로 요약하라. 표기만 바꾸면 이 검문은 통과한다.',
  );
}

/* ② 표 칸수 — 내발화는 뒤에서 앞으로 모았으니 되돌려서 위→아래 순서로 짚는다. */
const 깨진행 = [];
for (const t of [...내발화].reverse()) 깨진행.push(...어긋난표칸(t));
if (깨진행.length) {
  const 짚기 = 깨진행.slice(0, 4).map((v) => {
    const 방향 = v.실제 < v.기준 ? `${v.기준 - v.실제}칸 모자라 오른쪽 열이 빈다` : `${v.실제 - v.기준}칸 넘쳐 그만큼 버려진다`;
    return `   · ${v.기준}열이어야 하는데 ${v.실제}열 — ${방향}\n     ${v.줄.slice(0, 110)}`;
  }).join('\n');
  사유.push(
    `방금 발화의 표에서 ${깨진행.length}행의 칸수가 구분선과 다르다 — **유호님 화면에서 그 열이 통째로 빈다**`
    + '(F119 · 08-06 교정 「판정 열이 비어 보임」. 내 원문엔 내용이 있어서 나는 못 본다).\n'
    + `${짚기}\n`
    + '→ 그 표를 다시 내되 **모든 행의 `|` 개수를 구분선과 똑같이** 맞춰라. 칸을 합쳐 쓴 것이 원인이면\n'
    + '  합친 내용을 원래 열로 가르거나, 열 자체를 줄여 헤더·구분선을 함께 고친다.\n'
    + '→ 표가 사안에 안 맞으면(칸마다 문단이 들어간다면) 표를 버리고 목록·산문으로 낸다 — F119 의 원 처방이다.',
  );
}

if (!사유.length) process.exit(0);
process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: 사유.map((s) => `[chat-glyph-guard] ${s}`).join('\n\n'),
}));
