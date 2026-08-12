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
  if (경고) { 메시지 += '\n' + 경고; 대조 = ` · 🔴 보드 원 줄 **${v.판정}**(경고를 첫 메시지에 붙였다)`; }
  else if (v) 대조 = ' · 보드 원 줄 그대로';   // 「쟀는데 같다」와 「안 쟀다」를 가른다(분모 · F207)
} catch (_) { 대조 = ' · ⚠ 보드 원 줄 대조 실패'; }

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    initialUserMessage: 메시지,
  },
  systemMessage: `↩ 직전 세션의 인계문을 첫 메시지로 넣었다${extra}${대조}.`,
}));
process.exit(0);
