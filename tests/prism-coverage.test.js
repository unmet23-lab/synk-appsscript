'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../엔진_수집.js'), 'utf8');
const now = Date.parse('2026-10-02T00:00:00Z');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
function fixture(overrides = {}) {
  const reads = {}, logs = [];
  const sheet = (name, rows, width) => ({
    getLastRow: () => rows.length + 1, getLastColumn: () => width,
    getRange(row, column, count, columns) {
      assert.ok(columns <= width);
      reads[name] = (reads[name] || 0) + 1;
      return { getValues: () => rows.slice(row - 2, row - 2 + count)
        .map(values => Array.from({ length: columns }, (_, index) => values[column - 1 + index] ?? '')) };
    },
  });
  const definitions = {
    profiles: { rows: [['active', '', '', 'student']], width: 4 },
    hw_feedback: { rows: [], width: 14 }, quiz_log: { rows: [], width: 10 },
    talk_log: { rows: [], width: 7 }, ...overrides,
  };
  const tables = Object.fromEntries(Object.entries(definitions).map(([name, value]) =>
    [name, value && sheet(name, value.rows, value.width)]));
  const context = vm.createContext({ Date: FixedDate,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({
      getSheetByName: name => tables[name] || null, getSpreadsheetTimeZone: () => 'Asia/Seoul',
    }) }, Utilities: { formatDate: () => '2026-10-02' },
    Logger: { log: line => logs.push(line) }, asDate_: value => new Date(value), LECTURE_SRC_PREFIX: '강의:',
  });
  vm.runInContext(source, context);
  return { report: () => context.dataCoverageReport({ raw: true }), reads, logs,
    monthly: () => context.dataCoverageMonthly_() };
}
const feedback = (sid, date = now - 1000) => ['submission', sid, new Date(date)];
const quiz = sid => ['quiz', sid, 'q1', '', '', '', '', '정답', '', new Date(now - 1000)];
const talk = sid => ['talk', sid, 1, '', '', '', new Date(now - 1000)];

test('participation numerator uses the same distinct student population as denominator', () => {
  const f = fixture({
    profiles: { rows: [['active', '', '', 'student'], ['active', '', '', 'student'], ['teacher', '', '', 'teacher']], width: 4 },
    hw_feedback: { rows: [feedback('active'), feedback('alumni'), feedback('teacher')], width: 14 },
    quiz_log: { rows: [quiz('active'), quiz('unknown')], width: 10 },
    talk_log: { rows: [talk('active')], width: 7 },
  });
  const result = f.report();
  assert.equal(result.stats.재원, 1);
  assert.equal(result.stats.활동, 1);
  assert.match(result.text, /최근 7일에 하나라도 낸 학생 1\/1명 \(100%\)/);
  for (const name of ['hw_feedback', 'quiz_log', 'talk_log']) assert.equal(f.reads[name], 1);
});

test('only dates within the seven-day observation window count', () => {
  for (const date of [now + 1, now - 7 * 86400000 - 1, 'invalid']) {
    const f = fixture({ hw_feedback: { rows: [feedback('active', date)], width: 14 } });
    assert.equal(f.report().stats.활동, 0);
  }
  const f = fixture({ hw_feedback: { rows: [feedback('active', now - 7 * 86400000)], width: 14 } });
  assert.equal(f.report().stats.활동, 1);
});

test('empty observed sheets mean zero, missing sheets or date columns remain unknown', () => {
  assert.equal(fixture().report().stats.활동, 0);
  for (const definition of [null, { rows: [['legacy', 'active']], width: 8 }]) {
    const result = fixture({ quiz_log: definition }).report();
    assert.equal(result.stats.활동, null);
    assert.equal(result.stats.참여관측.상태, '미관측');
    assert.deepEqual([...result.stats.참여관측.미관측시트], ['quiz_log']);
    assert.match(result.text, /참여율 미관측/);
    assert.doesNotMatch(result.text, /최근 7일에 하나라도 낸 학생 0\/1/);
  }
});

test('missing population cannot masquerade as a school with zero students', () => {
  const f = fixture({ profiles: null });
  assert.equal(f.report().stats.재원, null);
  f.monthly();
  assert.ok(f.logs.some(line => line.includes('재원 미관측')));
  assert.ok(!f.logs.some(line => line.includes('재원 0명이라 침묵')));
});

test('unavailable source sheets do not claim measured zero or absent error types', () => {
  const result = fixture({ hw_feedback: null, quiz_log: null, talk_log: null }).report();
  for (const key of ['첨삭', '태그있음', '빈유형', '퀴즈응답', '대화턴', '골든표본', '골든응답', '골든수정']) {
    assert.equal(result.stats[key], null, key);
  }
  for (const name of ['hw_feedback', 'quiz_log', 'talk_log', 'voice_log', 'teacher_gold']) {
    assert.ok(result.text.includes(`미관측 — ${name} 시트가 없습니다.`));
  }
  assert.doesNotMatch(result.text, /전체 0건|응답 0건|누적 0턴|아직 한 건도 못 잡은 오류 유형/);
});

test('fully observed zero-student population retains quiet monthly behavior', () => {
  const f = fixture({ profiles: { rows: [], width: 4 } });
  const result = f.report();
  assert.equal(result.stats.재원, 0);
  assert.equal(result.stats.활동, 0);
  f.monthly();
  assert.ok(f.logs.some(line => line.includes('재원 0명이라 침묵')));
});
