'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { 세션인가, 코덱스인가, 조상세션, 세션과자손, 끌grep } = require('../tools/세션우선순위.js');

const 앱 = 'C:\\Program Files\\WindowsApps\\Claude_5.11492.2.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe';
const 코드 = 'C:\\Users\\q\\AppData\\Local\\Claude-Data\\claude_pzs8sxrjxfjjc\\claude-code\\2.1.321\\d0e\\claude.exe';
const 표 = [
  { ProcessId: 10, ParentProcessId: 1, Name: 'explorer.exe', ExecutablePath: 'C:\\Windows\\explorer.exe' },
  { ProcessId: 20, ParentProcessId: 10, Name: 'claude.exe', ExecutablePath: 앱 },
  { ProcessId: 21, ParentProcessId: 20, Name: 'claude.exe', ExecutablePath: 앱 }, // --type=renderer
  { ProcessId: 30, ParentProcessId: 20, Name: 'claude.exe', ExecutablePath: 코드 }, // 세션
  { ProcessId: 31, ParentProcessId: 30, Name: 'cmd.exe', ExecutablePath: 'C:\\Windows\\System32\\cmd.exe' },
  { ProcessId: 32, ParentProcessId: 31, Name: 'node.exe', ExecutablePath: 'C:\\Program Files\\nodejs\\node.exe' }, // 훅
  { ProcessId: 33, ParentProcessId: 30, Name: 'bash.exe', ExecutablePath: 'C:\\Program Files\\Git\\usr\\bin\\bash.exe' },
  { ProcessId: 34, ParentProcessId: 33, Name: 'node.exe', ExecutablePath: 'C:\\Program Files\\nodejs\\node.exe' }, // 렌더
  { ProcessId: 40, ParentProcessId: 20, Name: 'claude.exe', ExecutablePath: 코드.replace(/\\/g, '/') }, // 다른 세션(경로 빗금 꼴)
  { ProcessId: 50, ParentProcessId: 10, Name: 'chrome.exe', ExecutablePath: 'C:\\Program Files\\Google\\Chrome\\chrome.exe' },
];

test('세션 프로세스만 세션으로 본다 — 앱 본체 · 화면 담당은 아니다', () => {
  assert.equal(세션인가(표[1]), false);
  assert.equal(세션인가(표[2]), false);
  assert.equal(세션인가(표[3]), true);
  assert.equal(세션인가(표[8]), true);
  assert.equal(세션인가(표[9]), false);
});

test('훅 프로세스의 조상에서 그 세션을 찾는다', () => {
  assert.equal(조상세션(표, 32), 30);
  assert.equal(조상세션(표, 34), 30);
});

test('세션 밖에서 부르면 아무것도 고르지 않는다 — 앱 화면을 낮추지 않는다', () => {
  assert.equal(조상세션(표, 50), null);
  assert.equal(조상세션(표, 21), null);
  assert.equal(조상세션(표, 999), null);
});

test('「지금」은 세션들과 그 자손만 고른다', () => {
  const 고름 = 세션과자손(표).sort((a, b) => a - b);
  assert.deepEqual(고름, [30, 31, 32, 33, 34, 40]);
  assert.ok(!고름.includes(20) && !고름.includes(21) && !고름.includes(50));
});

test('GPT(Codex) 앱의 codex.exe와 그 자손도 함께 고른다 — 조건부 시험 같은 예약 일은 고르지 않는다', () => {
  const 코덱스 = 'C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0\\app\\resources\\codex.exe';
  const 표2 = [
    ...표,
    { ProcessId: 60, ParentProcessId: 10, Name: 'codex.exe', ExecutablePath: 코덱스 },
    { ProcessId: 61, ParentProcessId: 60, Name: 'pwsh.exe', ExecutablePath: 'C:\\pwsh.exe' },
    { ProcessId: 70, ParentProcessId: 1, Name: 'pythonw.exe', ExecutablePath: 'C:\\py\\pythonw.exe' }, // 예약 작업
    { ProcessId: 71, ParentProcessId: 70, Name: 'node.exe', ExecutablePath: 'C:\\Program Files\\nodejs\\node.exe' }, // conditional-qa
    { ProcessId: 80, ParentProcessId: 1, Name: 'codex.exe', ExecutablePath: 'C:\\Users\\q\\npm\\codex.exe' }, // 앱 밖 codex는 아니다
  ];
  assert.equal(코덱스인가(표2.find((r) => r.ProcessId === 60)), true);
  assert.equal(코덱스인가(표2.find((r) => r.ProcessId === 80)), false);
  const 고름 = 세션과자손(표2);
  assert.ok(고름.includes(60) && 고름.includes(61));
  assert.ok(!고름.includes(70) && !고름.includes(71) && !고름.includes(80));
});

test('주인 없이 10분 넘게 돈 grep만 끈다 — 주인이 살아 있거나 10분이 안 된 것은 두고, 번호를 물려받은 새 부모는 주인으로 보지 않는다', () => {
  const 지금 = Date.parse('2026-11-15T08:00:00Z');
  const 행들 = [
    { ProcessId: 1, Created: '2026-11-15T07:21:00Z', ParentCreated: null }, // 39분째 · 부모 없음 → 끈다
    { ProcessId: 2, Created: '2026-11-15T07:30:00Z', ParentCreated: '2026-11-15T07:29:59Z' }, // 부모 살아 있음 → 둔다
    { ProcessId: 3, Created: '2026-11-15T07:55:00Z', ParentCreated: null }, // 5분째 → 둔다
    { ProcessId: 4, Created: '2026-11-15T07:00:00Z', ParentCreated: '2026-11-15T07:40:00Z' }, // 부모 번호를 나중 프로세스가 물려받음 → 끈다
    { ProcessId: 5, Created: '2026-11-15T07:50:00Z', ParentCreated: null }, // 딱 10분 → 끈다
    { ProcessId: 6, Created: '읽지 못함', ParentCreated: null }, // 시각을 못 읽으면 둔다
  ];
  assert.deepEqual(끌grep(행들, 지금), [1, 4, 5]);
  assert.deepEqual(끌grep(행들[0], 지금), [1]); // PowerShell이 행 하나를 배열 없이 줄 때
  assert.deepEqual(끌grep(null, 지금), []);
});

test('부모가 자기 자신이거나 고리를 이뤄도 멈춘다', () => {
  const 고리 = [
    { ProcessId: 1, ParentProcessId: 2, Name: 'a.exe', ExecutablePath: 'a' },
    { ProcessId: 2, ParentProcessId: 1, Name: 'b.exe', ExecutablePath: 'b' },
  ];
  assert.equal(조상세션(고리, 1), null);
  assert.deepEqual(세션과자손(고리), []);
});
