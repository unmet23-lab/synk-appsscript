'use strict';

// TAP 실패 읽기 — node 24 `--test-reporter=tap`의 실제 꼴(10-22 이 PC에서 뽑은 것)을 줄여 넣었다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

const { tap실패 } = require('../tools/lib/tap실패.js');

const root = path.join(os.tmpdir(), '저장소');
const 위 = (rel, 줄) => `${path.join(root, ...rel.split('/'))}:${줄}:1`.replace(/\\/g, '\\\\');

const 표본 = [
  'TAP version 13',
  '# Subtest: API',
  '    # Subtest: 알던 실패',
  '    not ok 1 - 알던 실패',
  '      ---',
  "      duration_ms: 0.8",
  `      location: '${위('tests/a.test.js', 2)}'`,
  "      failureType: 'testCodeFailure'",
  "      error: 'x'",
  '      ...',
  '    # Subtest: 새 실패',
  '    not ok 2 - 새 실패',
  '      ---',
  `      location: '${위('tests/a.test.js', 3)}'`,
  "      failureType: 'testCodeFailure'",
  '      error: |-',
  '        이름만 적고 안 싣는 지면 1벌.',
  '           → 심는다: node tools/lib/브랜드폰트.js --심기 "x.html"',
  '      ...',
  '    # Subtest: 됨',
  '    ok 3 - 됨',
  '    1..3',
  'not ok 1 - API',
  '  ---',
  `  location: '${위('tests/a.test.js', 1)}'`,
  "  failureType: 'subtestsFailed'",
  "  error: '2 subtests failed'",
  '  ...',
  '# Subtest: tests\\\\b.test.mjs',
  'not ok 2 - tests\\\\b.test.mjs',
  '  ---',
  `  location: '${위('tests/b.test.mjs', 1)}'`,
  "  failureType: 'testCodeFailure'",
  "  error: 'test failed'",
  '  ...',
  '--- not ok ---',
  'not ok 1 - API',
  '1..2',
  '# tests 4', '# pass 1', '# fail 3', '# cancelled 0', '# skipped 0',
].join('\n');

test('describe 안의 하위 시험은 잎마다 「부모 › 잎」으로 세고, 부모(subtestsFailed)는 세지 않는다', () => {
  const r = tap실패(표본, { root });
  assert.deepEqual(r.실패.map((x) => [x.시험, x.위치]), [
    ['API › 알던 실패', 'tests/a.test.js:2'],
    ['API › 새 실패', 'tests/a.test.js:3'],
    ['tests/b.test.mjs', 'tests/b.test.mjs:1'],
  ]);
  assert.equal(r.실패[1].오류, '이름만 적고 안 싣는 지면 1벌.');
  assert.deepEqual(r.실패[1].안내, ['심는다: node tools/lib/브랜드폰트.js --심기 "x.html"']);
  assert.deepEqual([r.시험, r.통과, r.실패수], [4, 1, 3]);
});

test('파일째 죽은 시험은 OS와 상관없이 저장소 기준 경로를 이름으로 쓰고, location이 없어도 이름으로 파일을 잡는다', () => {
  const r = tap실패(['not ok 1 - tests\\\\c.test.mjs', '  ---', "  error: 'test failed'", '  ...'].join('\n'), { root });
  assert.equal(r.실패[0].파일, 'tests/c.test.mjs');
  assert.equal(r.실패[0].시험, 'tests/c.test.mjs');
});

test('root 없이(CI 로그) 위치는 경로 안의 tests/·docs/부터 자르고, 상대 location은 root 기준으로 푼다', () => {
  const 로그 = ['not ok 5 - 회사 시험', "  location: '/home/runner/work/x/x/SYNK-appsscript/docs/마케팅/company/a.test.mjs:12:3'", '  ...'].join('\n');
  assert.equal(tap실패(로그).실패[0].위치, 'docs/마케팅/company/a.test.mjs:12');
  const 상대 = tap실패(["not ok 1 - 상대", "  location: 'tests/d.test.js:7:1'", '  ...'].join('\n'), { root });
  assert.equal(상대.실패[0].위치, 'tests/d.test.js:7', 'cwd가 아니라 root 기준으로 푼다');
});

test('다른 파일의 같은 이름은 따로 센다', () => {
  const 로그 = [
    'not ok 1 - 된다', `  location: '${위('tests/e.test.js', 1)}'`, '  ...',
    'not ok 2 - 된다', `  location: '${위('tests/f.test.js', 1)}'`, '  ...',
  ].join('\n');
  assert.deepEqual(tap실패(로그, { root }).실패.map((x) => x.파일), ['tests/e.test.js', 'tests/f.test.js']);
});

test('TODO·SKIP은 실패로 안 세고, 셈은 node의 # fail과 같게 센다(describe 빼고, t.test 부모는 넣고)', () => {
  const 글 = [
    'not ok 1 - 할 일 # TODO', '  ---', "  type: 'test'", '  ...',
    '# Subtest: 묶음', '    not ok 1 - 잎', '      ---', "      type: 'test'", "      failureType: 'testCodeFailure'", '      ...',
    'not ok 2 - 묶음', '  ---', "  type: 'suite'", "  failureType: 'subtestsFailed'", '  ...',
    '# Subtest: 부모 시험', '    not ok 1 - 자식', '      ---', "      type: 'test'", '      ...',
    'not ok 3 - 부모 시험', '  ---', "  type: 'test'", "  failureType: 'subtestsFailed'", '  ...',
    '# fail 3',
  ].join('\n');
  const r = tap실패(글, { root });
  assert.deepEqual(r.실패.map((x) => x.시험), ['묶음 › 잎', '부모 시험 › 자식']);
  assert.equal(r.셈, 3, '잎 둘 + test 부모 하나 — describe와 TODO는 안 센다');
  assert.equal(r.실패수, 3);
});

test('이름이 .test.js로 끝나는 보통 시험은 파일 이름으로 덮지 않는다 — 같은 파일의 두 실패가 둘 다 남는다', () => {
  const 글 = [
    '# Subtest: 고르기', '    not ok 1 - tests/a.test.js', '      ---', `      location: '${위('tests/관련.test.js', 5)}'`, '      ...',
    '    not ok 2 - tests/b.test.js', '      ---', `      location: '${위('tests/관련.test.js', 6)}'`, '      ...',
    'not ok 1 - 고르기', '  ---', "  type: 'suite'", "  failureType: 'subtestsFailed'", '  ...',
    'not ok 2 - tests/c.test.js', '  ---', `  location: '${위('tests/관련.test.js', 9)}'`, '  ...',
  ].join('\n');
  assert.deepEqual(tap실패(글, { root }).실패.map((x) => [x.시험, x.파일]), [
    ['고르기 › tests/a.test.js', 'tests/관련.test.js'], ['고르기 › tests/b.test.js', 'tests/관련.test.js'], ['tests/c.test.js', 'tests/관련.test.js'],
  ]);
});

test('요약 칸에 부모 경로 없이 다시 찍힌 잎·부모는 가짜 실패로 남기지 않는다', () => {
  const 글 = ['# Subtest: 묶음', '    # Subtest: 세부', '    not ok 1 - 세부', '      ---', "      location: 'tests/a.test.js:3:1'", '      ...',
    'not ok 1 - 묶음', '  ---', "  failureType: 'subtestsFailed'", '  ...', '# --- not ok ---', '    not ok 1 - 세부', 'not ok 1 - 묶음'].join('\n');
  assert.deepEqual(tap실패(글, { root }).실패.map((x) => x.시험), ['묶음 › 세부']);
});
