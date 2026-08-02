#!/usr/bin/env node
// memory-index-guard — 메모리 인덱스(MEMORY.md) 비대화 차단 (PreToolUse 훅)
//
// CLAUDE.md 신뢰성 조항의 기계 강제. board-guard가 세션보드에 한 일을 인덱스에 한다.
//
// 왜 훅인가 (프로즈가 실패한 증거):
//   "인덱스는 지도다. 한 줄에 판정 본문을 쓰지 않는다"는 규칙이 **그 파일 맨 위에** 적혀 있다.
//   읽는 사람 눈앞에 있는데도 2026-08-03 실측에서 107줄 중 25줄이 이를 어겼다
//   (>400자가 17줄 · 최장 2,637자 = 한 줄이 인덱스의 9%). 헤더가 스스로 "다이어트 역주행 +75%"라고
//   적고도 계속 늘었다. 눈앞의 프로즈가 못 막으면 남은 건 기계뿐이다. 마찰 F012.
//
// 왜 이 파일이 특별한가: 인덱스는 **매 세션 전량 로드**된다. 병행 6세션이면 하루 6번이다.
//   보드·지침과 달리 여기서 새는 토큰은 작업량과 무관하게 매번 나간다.
//
// 임계값 근거 (추정하지 않고 쟀다 — v6.10이 "임계값 근거 없음"으로 기계화를 보류한 전례):
//   2026-08-03 실측 107줄 · 중앙 136자 · 75분위 **229자** · 90분위 577자.
//   상한 250자 = 75분위 바로 위 = **이미 4분의 3이 지키고 있는 선**. 새 규칙을 발명한 게 아니라
//   지금 잘 쓰인 줄들의 실측 상한을 그대로 못박은 것이다.
//
// ⚠ 검사 대상은 **이번 편집이 새로 넣는 줄뿐**이다. 파일 전체를 검사하면 기존 25줄이 인질이 되어
//   인덱스를 아예 못 고치게 되고, 그러면 다음 사람은 규칙을 지키는 게 아니라 훅을 끈다
//   (v6.11: "과잉 차단은 BYPASS 습관을 만든다").
'use strict';
const fs = require('fs');
const path = require('path');

const MAX_LINE = 250;
const TARGET = 'MEMORY.md';

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0);
}

const tool = String(input.tool_name || '');
if (!/^(Edit|Write|MultiEdit)$/.test(tool)) process.exit(0);

const ti = input.tool_input || {};
const filePath = String(ti.file_path || '').replace(/\\/g, '/');
if (path.basename(filePath) !== TARGET) process.exit(0);

// 인덱스 항목 줄만 본다. 머리말·구획 제목·인용문은 길어도 되고, 실제로 규칙을 설명하는 자리다.
const isEntry = (line) => /^\s*-\s*\[/.test(line);

/** 이번 편집이 새로 넣는 텍스트만 모은다(Write는 전문이 곧 새 텍스트다). */
const incoming = [];
if (tool === 'Write') {
  incoming.push(String(ti.content || ''));
} else {
  const edits = tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti];
  for (const e of edits) incoming.push(String(e.new_string || ''));
}

/* Write는 전문 교체라 「새로 넣는 줄」이 곧 전체다 — 그대로 검사하면 기존 25줄 때문에
 * 압축 작업 자체가 막힌다. 그래서 Write일 때는 **디스크의 현재 내용에 없던 줄**만 새 줄로 센다.
 * (같은 줄을 그대로 옮겨 적는 재배치·아카이브 이동은 통과해야 한다.) */
let known = new Set();
if (tool === 'Write') {
  try {
    known = new Set(fs.readFileSync(filePath, 'utf8').split('\n').map((l) => l.trim()));
  } catch (_) { /* 새 파일이면 전부 새 줄이 맞다 */ }
}

const offenders = [];
for (const chunk of incoming) {
  for (const line of chunk.split('\n')) {
    if (!isEntry(line)) continue;
    if (known.has(line.trim())) continue; // 이미 있던 줄 — 이번 편집이 만든 빚이 아니다
    if (line.length > MAX_LINE) offenders.push(line);
  }
}

if (offenders.length) {
  const worst = offenders.sort((a, b) => b.length - a.length)[0];
  const name = (worst.match(/^\s*-\s*\[([^\]]+)\]/) || [, '?'])[1];
  deny(
    `[memory-index-guard] 인덱스 줄이 ${MAX_LINE}자를 넘는다 — ${offenders.length}줄, ` +
    `최장 ${worst.length}자(${name}).\n` +
    '→ 인덱스는 지도다. 판정 본문·수치·경위는 **토픽 파일**에 쓰고, 여기엔 한 문장 + 플래그만 남겨라.\n' +
    '→ 🚫재제안 금지·⏳·⚠ 플래그는 깎지 마라. 그게 인덱스의 존재 이유다 — 줄일 것은 설명이다.\n' +
    `→ 이 상한(${MAX_LINE}자)은 발명한 값이 아니라 실측이다: 기존 인덱스의 75%가 이미 그 안에 있다.`
  );
}
