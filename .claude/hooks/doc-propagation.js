#!/usr/bin/env node
// doc-propagation — 정본을 고칠 때 "이걸 따르는 문서가 N종 있다"를 편집 직전에 알린다.
//
// 왜 있나: doc-audit(2026-07-28) 발견 — "정본 개정이 대외 문서에 전파 안 된다".
// 급여 정본이 v1.1→v1.3으로 오르는 동안 개원재무·가격표·생태계갭은 v1.1을 인용한 채 남았다.
// 사람이 기억해야 하는 규칙은 결국 안 지켜진다 → 기계로 옮긴다(CLAUDE.md 신뢰성 조항).
//
// **차단하지 않는다.** permissionDecision을 건드리지 않고 additionalContext만 준다.
//  - 차단은 board-guard처럼 마찰을 만드는데, 여기서 막을 것은 실수가 아니라 '망각'이다.
//  - allow를 반환하지도 않는다 — 훅이 권한 판정을 대신하면 나중에 추가될 deny 규칙을 조용히 뚫는다.
// 오탐 0 설계: 엣지는 명시적 주석으로만 생기므로, 선언이 없는 문서는 애초에 검사 대상이 아니다
// (미탐은 있어도 오탐은 없다 — deploy-security-gate의 "오탐 없이 잡을 수 있는 것만 기계로" 규칙).
'use strict';
const fs = require('fs');
const path = require('path');

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0);
}

const tool = String(input.tool_name || '');
if (!/^(Edit|Write|MultiEdit)$/.test(tool)) process.exit(0);

const filePath = String((input.tool_input || {}).file_path || '');
if (!filePath) process.exit(0);

// docs 밖이면 즉시 종료 — 훅은 매 편집마다 도니 값싼 경로를 먼저 닫는다
const norm = filePath.replace(/\\/g, '/');
if (!/\/docs\//.test(norm + '/') && !/^docs\//.test(norm)) process.exit(0);

let g;
try {
  g = require(path.join(__dirname, '..', '..', 'tools', 'doc-graph.js'));
} catch (_) {
  process.exit(0); // 도구가 없으면 조용히 통과 — 훅이 작업을 멈추게 하지 않는다
}

let target;
try {
  target = g.rel(path.resolve(filePath));
} catch (_) {
  process.exit(0);
}

let derived = [];
try {
  derived = g.build().derivedOf.get(target) || [];
} catch (_) {
  process.exit(0);
}
if (!derived.length) process.exit(0);

const msg =
  `[doc-propagation] ${target} 은(는) 정본이고, 이걸 따르는 파생 문서가 ${derived.length}종 있다:\n` +
  derived.map((d) => `  - ${d}`).join('\n') +
  `\n→ 이번 편집이 파생에 전파돼야 하는 값(수치·규정·명칭)을 바꾸는 것이라면, 위 문서도 같이 갱신할 것.\n` +
  `   서술만 다듬는 편집이면 무시해도 된다. (목록 확인: node tools/doc-graph.js --of "${target}")`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg },
}));
process.exit(0);
