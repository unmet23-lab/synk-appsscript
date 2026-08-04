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

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    initialUserMessage: String(baton.message),
  },
  systemMessage: `↩ 직전 세션의 인계문을 첫 메시지로 넣었다${extra}.`,
}));
process.exit(0);
