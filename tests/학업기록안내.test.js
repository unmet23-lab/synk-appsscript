'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 시트·메일을 호출하지 않고 실제 기록 계산과 안내문 생성을 함께 실행한다.
function load() {
  const ctx = vm.createContext({ scheduledSoFar_: () => 10 });
  const blocks = [
    ['엔진_콘텐츠AI.js', 'academicMsg_', 'readAcademicLogs_'],
    ['엔진_폼리포트.js', 'reportCardComment_', 'drawScoreChart_'],
  ];
  for (const [file, start, end] of blocks) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const a = source.indexOf('function ' + start + '(');
    const b = source.indexOf('function ' + end + '(', a);
    assert.ok(a >= 0 && b > a, file + ': 함수 범위를 찾지 못함');
    vm.runInContext(source.slice(a, b), ctx);
  }
  return ctx;
}

const mock = (ds, val) => ({ ds, type: 'mock', val });
const level = (ds, val) => ({ ds, type: 'level', val });

test('같은 달의 두 시험도 직전 기록과 비교하며 점수 상승·하락·유지를 구분한다', () => {
  const ctx = load();
  for (const [next, expected] of [[69, /7점 올랐어요/], [55, /7점 낮아요/], [62, /점수가 같아요/]]) {
    const snap = ctx.academicSnapshot_([mock('2026-09-01', 62), mock('2026-09-20', next)]);
    assert.equal(snap.delta, next - 62);
    assert.equal(snap.curMock, next);
    assert.equal(snap.bestMock, Math.max(62, next));
    assert.match(snap.ko, expected);
    assert.ok(snap.mn.length > 0);
    if (next !== 62) assert.ok(snap.mn.includes('7'));
  }
});

test('첫 기록·비교할 시험이 없는 기록·급수 상승을 서로 구분한다', () => {
  const ctx = load();
  assert.equal(ctx.academicSnapshot_([]), null);
  const first = ctx.academicSnapshot_([mock('2026-09-01', 62)]);
  assert.equal(first.delta, '');
  assert.match(first.ko, /첫 평가/);
  const noComparison = ctx.academicSnapshot_([level('2026-08-01', 2), mock('2026-09-01', 62)]);
  assert.equal(noComparison.delta, '');
  assert.match(noComparison.ko, /평가 결과를 기록/);
  const up = ctx.academicSnapshot_([level('2026-08-01', 2), level('2026-09-01', 3)]);
  assert.equal(up.levelUps, 1);
  assert.match(up.ko, /2급에서 3급으로/);
});

test('리포트는 급수가 오른 학생의 모의 점수 하락도 표시하고 출석일을 보존한다', () => {
  const ctx = load();
  const row = [];
  row[0] = 'S1'; row[1] = '학생'; row[21] = 4;
  const data = ctx.reportCardData_(row, [
    level('2026-08-01', 2), mock('2026-09-01', 62),
    level('2026-09-10', 3), mock('2026-09-20', 55),
  ], {}, new Date('2026-09-20T00:00:00Z'));
  assert.equal(data.levelText, '2급 → 3급');
  assert.equal(data.scoreText, '-7');
  assert.equal(data.attendText, '4일');
  assert.match(data.comment, /2급에서 3급으로/);
  assert.match(data.comment, /7점 낮아요/);
  assert.match(data.comment, /4일 출석/);
});

test('리포트는 첫 모의시험을 점수 유지로 처리하지 않고 개근을 따로 안내한다', () => {
  const ctx = load();
  const row = [];
  row[21] = 10;
  const data = ctx.reportCardData_(row, [mock('2026-09-20', 62)], {}, new Date('2026-09-20T00:00:00Z'));
  assert.equal(data.delta, null);
  assert.equal(data.scoreText, '—');
  assert.equal(data.gaegeun, true);
  assert.match(data.comment, /첫 모의시험/);
  assert.match(data.comment, /오늘까지 수업에 빠짐없이 출석/);
});
