#!/usr/bin/env node
// session-handoff — 직전 세션이 남긴 인계문을 새 세션의 첫 메시지로 넣는다 (SessionStart 훅)
//
// 왜 있나 (유호님 지시 2026-08-04: "자동으로 끄고 이어서 마지막 정리글만 새 세션에 자동으로 시작하게"):
//   `initialUserMessage` 로 첫 프롬프트에 바로 넣으면 복붙이라는 손일이 사라진다.
//
// ⚠ 자동화되는 건 절반뿐이다 — **세션을 자동으로 끄는 건 불가능하다**(공식 문서 실측:
//   어떤 훅도 세션을 종료하지 못하고 `continue:false` 도 턴만 멈춘다). 창을 닫거나 `/clear`
//   하는 한 번은 유호님 손에 남는다. 그 하나는 없앨 방법이 없다.
//
// 08-04 실측 결함 ①② 의 처방이 여기 걸려 있다:
//   ① 바통이 전역 1개라 🔴에 닿은 세션 셋 중 **마지막이 이겼다**(내 인계문이 남의 트랙 것으로 덮임).
//   ② 프로젝트 격리가 없어 **다른 저장소** 세션의 인계문까지 물 수 있었다.
//   → 이제 바통은 `handoff-<프로젝트키>-<세션id>.json` 이고, 여기서는 **이 저장소 것 중 최신 하나**만
//     집는다. 집은 것도 뒤처진 것도 전부 지운다(안 지우면 다음 세션이 옛것을 문다).
//   판정은 전부 lib/handoff-store.js 안에 있다 — 여기서 경로를 조립하지 않는다.
'use strict';
const fs = require('fs');
const path = require('path');
const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
const report = require(path.join(__dirname, 'lib', 'session-report.js'));

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { /* 입력 없이도 진행 */ }

// `resume`·`compact` 는 컨텍스트가 살아 있다 — 인계문을 넣으면 중복 지시가 된다.
// 등록 매처에서도 거르지만 판정층을 하나로 두려고 여기서도 본다.
const src = String(input.source || input.matcher || '');
if (src === 'resume' || src === 'compact') process.exit(0);

const cwd = input.cwd || process.cwd();
const baton = store.take(cwd); // 이 저장소의 최신 바통 1개(집으면 지운다) + 오래된 것 청소
if (!baton || !String(baton.message || '').trim()) process.exit(0);

const extra = baton.remaining > 0
  ? ` (다른 트랙 인계문 ${baton.remaining}건이 **아직 대기 중** — 창을 하나 더 열면 그게 이어받는다)`
  : '';

/* 🔴 **인계문에 실린 보드 줄은 «사본»이고, 여기가 원본을 볼 수 있는 유일한 자리다** (F343 원인 쪽).
 *   인계문은 마감 시점에 렌더돼 저장되므로 그 안의 「상태/다음」은 그때 얼어붙는다. 그런데 `/close`
 *   는 세션을 죽이지 않아 그 뒤로도 그 세션이 자기 🎫 를 옮길 수 있다 — 실측에서 이어받은 세션이
 *   낡은 과녁으로 이종 검수 11분을 태웠다. 쓰는 쪽은 못 재지만 **읽는 쪽은 잰다**(잴 수 있는 건 잰다).
 * ⚠ 대조가 실패해도 인계 자체는 나간다 — 이 훅의 본업은 바통 전달이고, 대조는 그 위에 얹은 경고다.
 *   여기서 throw 하면 인계문이 통째로 사라지고 그 손해가 낡은 사본보다 크다. */
let 메시지 = String(baton.message);
let 대조 = '';
try {
  const v = report.낡음(cwd, 메시지);
  const 경고 = report.낡음경고(v);
  if (경고) { 메시지 += '\n' + 경고; 대조 = ` · 🔴 보드 원 줄 **${v.판정}**(경고를 함께 실었다)`; }
  else if (v) 대조 = ' · 보드 원 줄 그대로';   // 「쟀는데 같다」와 「안 쟀다」를 가른다(분모 · F207)
} catch (_) { 대조 = ' · ⚠ 보드 원 줄 대조 실패'; }

/* ── ㈐ **유호님의 첫 발화 자리를 돌려준다** (F661 ㈐ · 유호 픽 2026-08-19) ──────────────
 * 옛 판은 `initialUserMessage` 로 냈다. 그러면 인계문이 **유호님이 쓰신 첫 메시지로** 대화에
 * 박힌다 — 유호님은 그 글을 쓰지도 읽지도 않았는데 그것이 유호님의 첫 수가 된다. 실측
 * 2026-08-19: 유호님이 「인계문이 도움이 되고 있냐」를 물으러 연 창이 인계문의 「새 트랙을
 * 잡아라」부터 출발했고, 유호님은 진짜 용건을 그 위에 끼워 넣어야 했다.
 *
 * 🔑 **왜 `additionalContext` 가 아니라 plain-text stdout 인가** — 공식 문서가 정한 자리다:
 *   「exceptions are UserPromptSubmit, UserPromptExpansion, and **SessionStart**, where Claude
 *   Code adds **plain-text stdout as context that Claude can see and act on**」.
 *   그리고 stdout 이 JSON 이면 «구조화 제어»로 파싱돼 그 통로를 못 탄다 — 즉 둘 중 하나다.
 *   `additionalContext` 는 이 저장소의 PreToolUse·PostToolUse·Stop 에서 검증됐지만 **SessionStart
 *   에서 쓰는 자리는 0건**이었다(실측). 검증 안 된 필드에 인계문 전체를 걸면, 안 먹었을 때
 *   증상은 「인계문이 그냥 없다」= 조용한 유실이다(F096 이 고친 그 사고). 반면 plain-text stdout
 *   은 **이 저장소의 SessionStart 훅 대부분이 이미 쓰는 통로**다(작업본소유자·대기열·philosophy-card
 *   … 같은 매처에서 매 세션 실제로 도는 것을 본다). 되돌림 비용이 큰 쪽을 안 고른다.
 *
 * ⚠ **대가 — 자동 출발이 사라진다.** 옛 판은 유호님이 창만 열면 AI 턴이 깨어나 이어갔다.
 *   이제는 유호님의 첫 발화가 있어야 세션이 움직인다. 그게 ㈐ 가 사려던 바로 그것이지만,
 *   「이어서 해」만 하던 회차에는 한 마디가 늘어난다. 그래서 머리말이 **그 한 마디를 글자로**
 *   준다 — 무엇을 말해야 옛 동작이 되는지 모르면 처방이 아니다(F103).
 * ⚠ `systemMessage` 는 못 쓴다(그건 JSON 통로다). 대신 stdout 자체가 유호님 화면에도
 *   `SessionStart:startup hook success:` 로 스치므로, 사본 경로·대기 건수를 꼬리에 싣는다. */
const 머리 = '↩ **직전 세션이 남긴 인계문**입니다 — 자동 생성된 글이고 **유호님이 쓰신 것이 아닙니다.**\n'
  + '🔑 **유호님이 용건을 말씀하시면 그 용건이 이 세션의 출발점이다** — 아래는 배경으로만 쓴다.\n'
  + '   용건 없이 「이어서」·「계속」이라고만 하시면 그때 아래 트랙을 잇는다.\n'
  + '──── 인계문 ────\n';
const 꼬리 = `\n──── 인계문 끝 ────\n사본 \`docs/_ops/인계문.md\`${extra}${대조}\n`;

process.stdout.write(머리 + 메시지 + 꼬리);
process.exit(0);
