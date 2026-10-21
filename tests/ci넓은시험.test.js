'use strict';

// CI 넓은 시험 — 목록·TAP 읽기·기준선 견주기만 잰다(묶음 전체를 돌리지는 않는다).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 넓은 = require('../tools/ci넓은시험.js');

test('목록 — 묶음마다 제 자리의 추적 시험만, node_modules·루트 .js·없는 파일은 뺀다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci넓은시험-'));
  try {
    const 추적 = ['tests/a.test.js', 'tests/b.test.mjs', 'tests/c.test.cjs', 'tests/lib/d.test.mjs', 'desktop/tests/e.test.cjs', 'desktop/tests/f.test.js',
      'docs/마케팅/온라인마케팅지도/engagement/company/g.test.mjs', 'experiences/x/node_modules/y.test.js', 'experiences/x/h.test.js', 'tools/lib/i.test.cjs', 'tools/없음.test.js'];
    for (const p of 추적.filter((p) => p !== 'tools/없음.test.js')) { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), ''); }
    const 목록 = (묶음) => 넓은.목록(묶음, root, 추적);
    assert.deepEqual(목록('루트'), ['tests/b.test.mjs', 'tests/c.test.cjs'], '루트 .js 는 syntax-check 가 엄격하게 돈다');
    assert.deepEqual(목록('desktop'), ['desktop/tests/e.test.cjs'], 'desktop/package.json 의 test 와 같은 꼴만');
    assert.deepEqual(목록('회사'), ['docs/마케팅/온라인마케팅지도/engagement/company/g.test.mjs']);
    assert.deepEqual(목록('experiences'), ['experiences/x/h.test.js']);
    assert.deepEqual(목록('tools'), ['tools/lib/i.test.cjs']);
    assert.throws(() => 목록('없는묶음'), /모르는 묶음/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('실패읽기 — not ok 이름과 저장소 기준 파일을 짝짓고, 같은 줄은 한 번만', () => {
  const root = path.join(os.tmpdir(), '저장소');
  const tap = [
    'TAP version 13',
    'not ok 3 - real PostgreSQL export: deleted',
    '  ---',
    `  location: '${path.join(root, 'tests', 'pg.test.mjs').replace(/\\/g, '\\\\')}:40:3'`,
    '  ...',
    'not ok 3 - real PostgreSQL export: deleted',
    `  location: '${path.join(root, 'tests', 'pg.test.mjs').replace(/\\/g, '\\\\')}:40:3'`,
    'not ok 9 - 파일 모르는 실패 # TODO',
    '# tests 10', '# pass 7', '# fail 2', '# skipped 1',
  ].join('\n');
  const r = 넓은.실패읽기(tap, root);
  assert.deepEqual(r.실패, [{ 파일: 'tests/pg.test.mjs', 시험: 'real PostgreSQL export: deleted' }, { 파일: null, 시험: '파일 모르는 실패' }]);
  assert.equal(r.시험, 10);
  assert.equal(r.실패수, 2);
  assert.equal(r.건너뜀, 1);
});

test('견주기 — 기준선 밖 실패만 새 실패, 기준선에 있는데 통과한 것은 풀린 것', () => {
  const 기준 = [{ 파일: 'tests/pg.test.mjs', 시험: 'A', 까닭: 'CI에 PostgreSQL이 없다' }, { 파일: 'tests/port.test.mjs', 시험: 'B', 까닭: '고정 포트' }];
  const r = 넓은.견주기([{ 파일: 'tests/pg.test.mjs', 시험: 'A' }, { 파일: 'tests/new.test.mjs', 시험: 'C' }], 기준);
  assert.deepEqual(r.새, [{ 파일: 'tests/new.test.mjs', 시험: 'C' }]);
  assert.deepEqual(r.남은, [{ 파일: 'tests/pg.test.mjs', 시험: 'A' }]);
  assert.deepEqual(r.풀린.map((x) => x.시험), ['B']);
  assert.deepEqual(넓은.견주기([], null), { 새: [], 남은: [], 풀린: [] });
});

test('기준선읽기 — 까닭 없는 줄은 받지 않고, 파일이 없으면 null', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci넓은시험-'));
  try {
    const 파일 = path.join(방, '기준선.json');
    assert.equal(넓은.기준선읽기(파일), null);
    fs.writeFileSync(파일, JSON.stringify({ 묶음: { 루트: [{ 파일: 'tests/a.test.mjs', 시험: 'x', 까닭: ' ' }] } }));
    assert.throws(() => 넓은.기준선읽기(파일), /까닭/);
    fs.writeFileSync(파일, JSON.stringify({ 묶음: { 루트: [{ 파일: 'tests/a.test.mjs', 시험: 'x', 까닭: '고정 포트' }] } }));
    assert.equal(넓은.기준선읽기(파일).묶음.루트.length, 1);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('같은 describe 안의 새 실패는 기준선의 다른 잎에 묻히지 않는다(아르곤 10-22 P1)', () => {
  const tap = [
    '# Subtest: API', '    # Subtest: 알던 실패', '    not ok 1 - 알던 실패', '      ---', "      failureType: 'testCodeFailure'", "      error: 'x'", '      ...',
    '    # Subtest: 새 실패', '    not ok 2 - 새 실패', '      ---', "      failureType: 'testCodeFailure'", "      error: 'y'", '      ...',
    'not ok 1 - API', '  ---', "  failureType: 'subtestsFailed'", '  ...',
  ].join('\n');
  const r = 넓은.실패읽기(tap);
  assert.deepEqual(r.실패.map((x) => x.시험), ['API › 알던 실패', 'API › 새 실패']);
  const 기준 = [{ 파일: '(파일 모름)', 시험: 'API › 알던 실패', 까닭: '알던 것' }];
  assert.deepEqual(넓은.견주기(r.실패, 기준).새.map((x) => x.시험), ['API › 새 실패']);
});
