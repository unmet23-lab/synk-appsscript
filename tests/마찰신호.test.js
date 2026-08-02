// friction 장부 회귀 테스트. 실제 장부(docs/_ops/마찰신호.md)는 건드리지 않는다.
// 지키려는 성질: ①ID가 겹치지 않는다 ②표를 깨뜨리는 입력이 장부를 파싱 불가로 만들지 못한다
// ③빈 해소·중복 해소를 거부한다(해소 칸이 거짓이면 "무엇이 작동했나" 집계 전체가 거짓말이 된다)
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'friction.js');

const HEAD = [
  '# 마찰 신호 장부',
  '',
  '| ID | 날짜 | 종류 | 신호 | 해소 |',
  '|---|---|---|---|---|',
  '| F001 | 2026-07-17 | 교정 | 첫 신호 | memory/x |',
  '| F002 | 2026-08-01 | 실수 | 둘째 신호 | |',
  '',
].join('\n');

function mkLedger() {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'friction-')), '마찰신호.md');
  fs.writeFileSync(f, HEAD, 'utf8');
  return f;
}

function run(ledger, args, expectFail = false) {
  try {
    return execFileSync(process.execPath, [TOOL, ...args], {
      encoding: 'utf8', stdio: 'pipe',
      env: { ...process.env, SYNK_FRICTION_LEDGER: ledger },
    });
  } catch (e) {
    if (expectFail) return { failed: true, stderr: String(e.stderr || '') };
    throw e;
  }
}

const rowsOf = (ledger) =>
  fs.readFileSync(ledger, 'utf8').split('\n').filter((l) => /^\|\s*F\d+\s*\|/.test(l.trim()));

test('add — ID가 이어지고 표 안에 들어간다', () => {
  const L = mkLedger();
  run(L, ['add', '실수', '새 신호']);
  const rows = rowsOf(L);
  assert.strictEqual(rows.length, 3);
  assert.ok(rows[2].includes('F003'), 'F002 다음은 F003이어야 한다');
  assert.ok(rows[2].includes('새 신호'));
  assert.ok(rows[2].trim().endsWith('| |'), '새 신호의 해소 칸은 비어야 한다');
});

test('add — 표를 깨뜨리는 파이프·개행을 삼키지 않고 치환한다', () => {
  const L = mkLedger();
  run(L, ['add', '마찰', 'a | b | c']);
  const rows = rowsOf(L);
  assert.strictEqual(rows.length, 3);
  assert.ok(!rows[2].includes('a | b'), '파이프가 그대로 들어가면 장부가 파싱 불가가 된다');
  // 장부가 여전히 읽힌다
  const out = run(L, []);
  assert.ok(out.includes('전체 3건'));
});

test('add — 모르는 종류는 거부한다', () => {
  const L = mkLedger();
  const r = run(L, ['add', '잡담', '설명'], true);
  assert.ok(r.failed);
  assert.strictEqual(rowsOf(L).length, 2, '거부됐으면 장부가 안 바뀌어야 한다');
});

test('add — 빈 설명은 거부한다', () => {
  const L = mkLedger();
  assert.ok(run(L, ['add', '실수', ''], true).failed);
  assert.strictEqual(rowsOf(L).length, 2);
});

test('add --date — 과거 신호를 소급 기록할 수 있다', () => {
  const L = mkLedger();
  run(L, ['add', '거절', '지난 제안 기각', '--date', '2026-07-20']);
  assert.ok(rowsOf(L)[2].includes('2026-07-20'));
});

test('resolve — 해소 수단을 적고, 빈 해소는 거부한다', () => {
  const L = mkLedger();
  run(L, ['resolve', 'F002', 'tools/무언가.js']);
  assert.ok(rowsOf(L)[1].includes('tools/무언가.js'));
  const L2 = mkLedger();
  assert.ok(run(L2, ['resolve', 'F002', ''], true).failed, '빈 해소가 들어가면 집계가 거짓말을 한다');
});

test('resolve — 이미 해소된 신호는 덮어쓰지 않는다', () => {
  const L = mkLedger();
  const r = run(L, ['resolve', 'F001', '다른 수단'], true);
  assert.ok(r.failed);
  assert.ok(rowsOf(L)[0].includes('memory/x'), '기존 해소 기록이 보존돼야 한다');
});

test('resolve — 없는 ID는 거부한다', () => {
  const L = mkLedger();
  assert.ok(run(L, ['resolve', 'F999', '수단'], true).failed);
});

test('집계 — 살아있는 신호와 해소를 나눠 센다', () => {
  const L = mkLedger();
  const out = run(L, []);
  assert.ok(out.includes('전체 2건'));
  assert.ok(out.includes('해소 1'));
  assert.ok(out.includes('살아있음 1'));
  assert.ok(out.includes('둘째 신호'), '살아있는 신호는 목록에 나와야 한다');
});

test('--open — 살아있는 신호만 낸다', () => {
  const L = mkLedger();
  const out = run(L, ['--open']);
  assert.ok(out.includes('둘째 신호'));
  assert.ok(!out.includes('첫 신호'));
});

test('실제 장부가 파싱 가능하고 형식이 살아있다', () => {
  const real = require(TOOL);
  const { rows } = real.read();
  assert.ok(rows.length >= 10, `장부 행 ${rows.length}건 — 형식이 깨지면 0건으로 보인다`);
  assert.ok(rows.every((r) => real.KINDS.includes(r.kind)), '모르는 종류가 섞이면 집계에서 조용히 사라진다');
});
