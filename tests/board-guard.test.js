// board-guard 훅 회귀 테스트 — 세션보드 비대화 차단 장치가 살아있는지 검사한다.
// 실 세션보드 파일에 의존하지 않는다(임시 디렉터리에 같은 이름의 파일을 만들어 검사).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'board-guard.js');
const LONG = '가'.repeat(260);

// 임시 보드(11줄) — 줄 수 검사가 실제 저장소 상태에 흔들리지 않게 한다
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'boardguard-'));
const BOARD = path.join(TMP, '세션보드.md');
const ARCHIVE = path.join(TMP, '세션보드_아카이브.md');
const row = (i) => `| 2026-08-01 | 트랙${i} | Code.js | 완료 |`;
const activeRow = (i) => `| 2026-08-01 | 트랙${i} | Code.js | 작업중 |`;
const table = (n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', ...Array.from({ length: n }, (_, i) => row(i))].join('\n');
const activeTable = (n) => ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|', ...Array.from({ length: n }, (_, i) => activeRow(i))].join('\n');
fs.writeFileSync(BOARD, table(11), 'utf8');

function decide(payload) {
  const out = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
  if (!out.trim()) return 'allow';
  return JSON.parse(out).hookSpecificOutput.permissionDecision;
}

test('칸 200자 초과는 차단', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: `| 2026-08-01 | 트랙 | Code.js | ${LONG} |` } }),
    'deny'
  );
});

test('정상 길이 1줄 추가는 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: '| 2026-08-01 | 새 트랙 | Code.js | 작업중 |' } }),
    'allow'
  );
});

test('전체 18줄 초과 Write는 차단', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: table(20) } }), 'deny');
});

test('완료 줄 16개는 통과 (완료는 전체 상한까지 허용)', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: table(16) } }), 'allow');
});

test('활성 13줄은 전체가 상한 이내여도 차단', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: activeTable(13) } }), 'deny');
});

test('활성 12줄은 통과 (경계값)', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: BOARD, content: activeTable(12) } }), 'allow');
});

test('Edit 증분으로 전체 상한을 넘겨도 차단', () => {
  const many = Array.from({ length: 15 }, (_, i) => row(i)).join('\n');
  assert.strictEqual(decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: many } }), 'deny');
});

test('Edit 증분으로 활성 상한을 넘겨도 차단', () => {
  const many = Array.from({ length: 13 }, (_, i) => activeRow(i)).join('\n');
  assert.strictEqual(decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: 'x', new_string: many } }), 'deny');
});

test('아카이브 파일은 검사 대상이 아니다', () => {
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: ARCHIVE, content: `| a | b | c | ${LONG} |` } }), 'allow');
});

test('보드가 아닌 파일은 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: path.join(TMP, 'Code.js'), old_string: 'a', new_string: `| x | y | z | ${LONG} |` } }),
    'allow'
  );
});

/* ── 2026-08-01 실사고 회귀 ────────────────────────────────────────────────
 * 위 케이스들은 전부 new_string을 `|`로 시작하는 **완전한 행**으로 만든다.
 * 그런데 보드를 갱신하는 실제 모양은 **상태 칸 하나만 갈아끼우는 것**이고, 그 조각은
 * `|`로 시작하지 않아 isDataRow를 통과하지 못해 칸 검사가 통째로 건너뛰어졌다.
 * 같은 날 274자(ab2c60d)·213자(aa68ac7) 두 번이 그대로 통과했고 둘 다 사람이 눈으로 잡았다.
 * 아래 4건은 그 구멍을 못박는다 — 실패하면 가드가 다시 죽은 것이다. */

test('[회귀] 상태 칸만 부분 교체해도 200자 초과는 차단 — 실사고 경로', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: '완료 |', new_string: `${LONG} |` } }),
    'deny'
  );
});

test('[회귀] 상태 칸만 부분 교체하고 길이가 정상이면 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: '완료 |', new_string: '완료 — 라이브 검증까지 끝 |' } }),
    'allow'
  );
});

test('[회귀] 파이프가 전혀 없는 조각으로 칸을 부풀려도 차단', () => {
  // 결과 파일을 계산하므로 조각의 생김새와 무관하게 잡힌다
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: '트랙0', new_string: LONG } }),
    'deny'
  );
});

test('[회귀] replace_all 부분 교체도 검사한다', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: BOARD, old_string: '완료', new_string: LONG, replace_all: true } }),
    'deny'
  );
});
