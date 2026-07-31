#!/usr/bin/env node
// board-guard — 세션보드 비대화 차단 (PreToolUse 훅)
// CLAUDE.md 신뢰성 조항의 기계 강제: "줄은 선언만"이라는 프로즈 규칙이 지켜지지 않아
// 보드가 70,628자(추정 5~7만 토큰)까지 부푼 2026-07-31 사고의 재발 방지 장치.
// 검사 2종 — ①표 한 칸 200자 초과 금지 ②표 데이터 줄 14줄 초과 금지.
// 통과 시 출력 없이 종료. 아카이브 파일(docs/세션보드_아카이브.md)은 검사 대상이 아니다.
'use strict';
const fs = require('fs');
const path = require('path');

const MAX_CELL = 200;
const MAX_ROWS = 14; // 보드 규칙은 12줄 — 훅은 여유 2줄 뒤 차단

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
const filePath = String(ti.file_path || '');
const base = path.basename(filePath.replace(/\\/g, '/'));
if (base !== '세션보드.md') process.exit(0); // 아카이브·다른 문서는 통과

// 편집 종류별로 "새로 들어가는 텍스트"와 "줄 수 증감"을 모은다
const edits = tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti];
const incoming = [];
let delta = 0;
let fullContent = null;

if (tool === 'Write') {
  fullContent = String(ti.content || '');
  incoming.push(fullContent);
} else {
  for (const e of edits) {
    const ns = String(e.new_string || '');
    const os = String(e.old_string || '');
    incoming.push(ns);
    delta += countRows(ns) - countRows(os);
  }
}

function isDataRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return false;
  if (/^\|[\s:|-]+\|$/.test(t)) return false;        // 구분선 |---|---|
  if (/^\|\s*날짜\s*\|/.test(t)) return false;        // 헤더
  return true;
}

function countRows(text) {
  return text.split('\n').filter(isDataRow).length;
}

// ① 칸 길이 검사
const longCells = [];
for (const text of incoming) {
  for (const line of text.split('\n')) {
    if (!isDataRow(line)) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    cells.forEach((c, i) => {
      const len = c.trim().length;
      if (len > MAX_CELL) longCells.push(`${i + 1}번째 칸 ${len}자 — "${c.trim().slice(0, 40)}…"`);
    });
  }
}
if (longCells.length) {
  deny(
    '[board-guard] 세션보드 칸 길이 초과(칸당 ' + MAX_CELL + '자):\n- ' +
      longCells.join('\n- ') +
      '\n→ 보드 줄은 **선언만**이다. 보고·판정 본문은 memory/ 토픽 파일이나 docs/ 정본에 쓰고, 상태 칸에는 한 줄 요약 + 그 링크만 남길 것.'
  );
}

// ② 표 줄 수 검사
let total;
if (fullContent !== null) {
  total = countRows(fullContent);
} else {
  let current = 0;
  try {
    current = countRows(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    process.exit(0); // 파일을 못 읽으면 판단 불가 — 통과
  }
  total = current + delta;
}
if (total > MAX_ROWS) {
  deny(
    `[board-guard] 세션보드 표가 ${total}줄이 된다(상한 ${MAX_ROWS}줄, 목표 12줄).\n` +
      '→ 오래된 **완료** 줄부터 docs/세션보드_아카이브.md 맨 위로 옮긴 뒤 다시 시도할 것. 활성(작업중·진행중·대기) 줄은 남긴다.'
  );
}
process.exit(0);
