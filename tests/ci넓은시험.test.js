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
      'desktop/tests/esm.test.mjs', 'desktop/tests/helper.mjs', 'desktop/tests/nested/ignored.test.mjs', 'desktop/tests/node_modules/ignored.test.mjs',
      'docs/마케팅/온라인마케팅지도/engagement/company/g.test.mjs', 'experiences/x/node_modules/y.test.js', 'experiences/x/h.test.js', 'tools/lib/i.test.cjs', 'tools/없음.test.js'];
    for (const p of 추적.filter((p) => p !== 'tools/없음.test.js')) { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), ''); }
    const 목록 = (묶음) => 넓은.목록(묶음, root, 추적);
    assert.deepEqual(목록('루트'), ['tests/b.test.mjs', 'tests/c.test.cjs'], '루트 .js 는 syntax-check 가 엄격하게 돈다');
    assert.deepEqual(목록('desktop'), ['desktop/tests/e.test.cjs', 'desktop/tests/esm.test.mjs'], 'desktop/package.json 처럼 CJS·ESM 시험만, helper·하위 폴더는 제외');
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
    'not ok 9 - 파일 모르는 실패',
    'not ok 10 - 할 일 # TODO',
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
  assert.deepEqual(넓은.견주기([], null), { 새: [], 남은: [], 풀린: [], 좁힐: [] });
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

test('종료판정 — 기준선에 실패가 있어도 못 읽은 실패·요약 없는 실행·시험 밖 실패는 빨강(아르곤 10-22 재확인 P1)', () => {
  const 기준 = [{ 파일: 'tests/a.test.mjs', 시험: 'A', 까닭: '알던 것' }];
  const 알던 = [{ 파일: 'tests/a.test.mjs', 시험: 'A' }];
  assert.equal(넓은.종료판정({ 파일: 3, 시험: 10, 실패수: 1, 셈: 1, 종료: 1, 실패: 알던 }, 기준).코드, 0, '알던 실패뿐이면 초록');
  const 못읽음 = 넓은.종료판정({ 파일: 3, 시험: 10, 실패수: 2, 셈: 1, 종료: 1, 실패: 알던 }, 기준);
  assert.equal(못읽음.코드, 1);
  assert.match(못읽음.줄들.join('\n'), /2개 가운데 1개를 못 읽었다/);
  assert.equal(넓은.종료판정({ 파일: 3, 시험: 0, 실패수: 0, 셈: 0, 종료: 1, 실패: [] }, 기준).코드, 1, '요약 없음');
  assert.equal(넓은.종료판정({ 파일: 3, 시험: 10, 실패수: 0, 셈: 0, 종료: 1, 실패: [] }, []).코드, 1, '시험 밖 실패');
  assert.equal(넓은.종료판정({ 파일: 3, 시험: 10, 실패수: 1, 셈: 1, 종료: 1, 실패: [{ 파일: 'tests/b.test.mjs', 시험: 'B' }] }, 기준).코드, 1, '새 실패');
});

test('기준선줄이기 — 그 run에서 통과한 줄만 빠지고, 새 실패는 안 들어오고, 후보 없는 묶음은 그대로다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci넓은시험-'));
  try {
    const 파일 = path.join(방, '기준선.json');
    fs.writeFileSync(파일, JSON.stringify({ 묶음: {
      루트: [{ 파일: 'tests/a.test.mjs', 시험: 'A', 까닭: 'ffmpeg 없음' }, { 파일: 'tests/b.test.mjs', 시험: 'B', 까닭: 'ffmpeg 없음' }],
      회사: [{ 파일: 'x/c.test.mjs', 시험: 'C', 까닭: '포트' }],
    } }));
    const 받은 = { 루트: [{ 파일: 'tests/a.test.mjs', 시험: 'A' }, { 파일: 'tests/새.test.mjs', 시험: '새 실패' }] };
    const r = 넓은.기준선줄이기(7, { 받은, 파일 });
    assert.deepEqual(r.뺀, { 루트: 1 });
    const 새 = JSON.parse(fs.readFileSync(파일, 'utf8'));
    assert.deepEqual(새.묶음.루트.map((x) => x.시험), ['A'], 'B는 통과해 빠지고, 새 실패는 들어오지 않는다');
    assert.deepEqual(새.묶음.회사.map((x) => x.시험), ['C'], '후보가 없는 묶음은 못 본 것이라 그대로');
    assert.equal(새.묶음.루트[0].까닭, 'ffmpeg 없음', '남는 줄의 까닭은 그대로');
    assert.equal(새.줄인run, 7);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('파일째 죽은 시험 — 그 파일 앞에 찍힌 stderr에서 오류 줄을 찾아 오류로 삼고 출력으로 붙인다', () => {
  const root = path.join(os.tmpdir(), '저장소');
  const tap = [
    'TAP version 13',
    '# a의 잡음',
    '# Subtest: 잘 도는 시험',
    'ok 1 - 잘 도는 시험',
    '# node:internal/modules/cjs/loader:1564',
    "# Error: Cannot find module '../../SYNK-talk/lib/x.js'",
    '#     at Module._resolveFilename (node:internal/modules/cjs/loader:1564:15)',
    '# Node.js v24.21.0',
    '# Subtest: tests/b.test.mjs',
    'not ok 2 - tests/b.test.mjs',
    '  ---', "  error: 'test failed'", '  ...',
    '# tests 2', '# pass 1', '# fail 1',
  ].join('\n');
  const [x] = 넓은.실패읽기(tap, root).실패;
  assert.equal(x.시험, 'tests/b.test.mjs');
  assert.equal(x.오류, "Error: Cannot find module '../../SYNK-talk/lib/x.js'");
  assert.deepEqual(x.출력, ['node:internal/modules/cjs/loader:1564', "Error: Cannot find module '../../SYNK-talk/lib/x.js'"], '앞 파일의 잡음·스택·Node 판 줄은 빼고');
  const 그냥 = 넓은.실패읽기(['not ok 1 - tests/c.test.mjs', '  ---', "  error: 'test failed'", '  ...', '# tests 1', '# fail 1'].join('\n'), root).실패[0];
  assert.equal(그냥.오류, 'test failed', 'stderr가 없으면 그대로');
  assert.equal(그냥.출력, undefined);
});

test('파일째 기준선 줄은 그 파일의 실패를 모두 덮고, 파일이 안 죽고 안의 시험만 깨지면 좁힐 줄로 알린다', () => {
  const 기준 = [{ 파일: 'tests/b.test.mjs', 시험: 'tests/b.test.mjs', 까닭: '형제 저장소 없음' }, { 파일: 'tests/c.test.mjs', 시험: 'tests/c.test.mjs', 까닭: '포트' }];
  const r = 넓은.견주기([{ 파일: 'tests/b.test.mjs', 시험: '안의 시험' }, { 파일: 'tests/d.test.mjs', 시험: 'tests/d.test.mjs' }], 기준);
  assert.deepEqual(r.새.map((x) => x.파일), ['tests/d.test.mjs'], '파일째 줄이 없는 파일은 그대로 새 실패');
  assert.deepEqual(r.남은.map((x) => x.시험), ['안의 시험']);
  assert.deepEqual(r.좁힐.map((x) => x.파일), ['tests/b.test.mjs']);
  assert.deepEqual(r.풀린.map((x) => x.파일), ['tests/c.test.mjs'], '실패가 하나도 없는 파일만 풀린다');
  assert.deepEqual(넓은.견주기([{ 파일: 'tests/b.test.mjs', 시험: 'tests/b.test.mjs' }], 기준).좁힐, [], '여전히 파일째 죽으면 좁히지 않는다');
});

test('기준선줄이기 — 파일째 줄은 그 run에서 실제로 깨진 안의 시험으로 좁히고, 다른 파일의 새 실패는 들이지 않는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci넓은시험-'));
  try {
    const 파일 = path.join(방, '기준선.json');
    fs.writeFileSync(파일, JSON.stringify({ 묶음: { 루트: [
      { 파일: 'tests/b.test.mjs', 시험: 'tests/b.test.mjs', 까닭: '형제 저장소 없음' },
      { 파일: 'tests/c.test.mjs', 시험: 'tests/c.test.mjs', 까닭: '포트' },
      { 파일: 'tests/e.test.mjs', 시험: 'tests/e.test.mjs', 까닭: '모듈 없음' },
    ] } }));
    const 받은 = { 루트: [{ 파일: 'tests/b.test.mjs', 시험: '안의 시험', 오류: 'Expected 1' }, { 파일: 'tests/e.test.mjs', 시험: 'tests/e.test.mjs' }, { 파일: 'tests/새.test.mjs', 시험: '새 실패' }] };
    const r = 넓은.기준선줄이기(9, { 받은, 파일, 날: '2026-10-22' });
    assert.deepEqual(r.뺀, { 루트: 1 });
    assert.deepEqual(r.좁힌, { 루트: 1 });
    const 새 = JSON.parse(fs.readFileSync(파일, 'utf8')).묶음.루트;
    assert.deepEqual(새.map((x) => `${x.파일} ${x.시험}`), ['tests/b.test.mjs 안의 시험', 'tests/e.test.mjs tests/e.test.mjs']);
    assert.equal(새[0].까닭, '2026-10-22 run 9에서 파일째 죽던 것이 풀린 뒤 남은 실패 — Expected 1');
    assert.equal(새[1].까닭, '모듈 없음', '여전히 파일째 죽는 줄은 까닭 그대로');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('자산받기 — 출시 목록의 해시·크기와 맞을 때만 놓고, 있는 파일은 건드리지 않고, 다르면 놓지 않는다', async () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci넓은시험-'));
  try {
    const 바이트 = Buffer.from('glTF 가짜'), 해시 = require('node:crypto').createHash('sha256').update(바이트).digest('hex');
    const 목록 = path.join(방, 'experiences/korean-racing/qa/package-manifest.json');
    fs.mkdirSync(path.dirname(목록), { recursive: true });
    fs.writeFileSync(목록, JSON.stringify({ files: [{ path: 'assets/car.glb', bytes: 바이트.length, sha256: 해시 }, { path: 'assets/coastal-rocks-v6.glb', bytes: 3, sha256: 'a'.repeat(64) }] }));
    const 부른 = [];
    const 받기 = async (url) => { 부른.push(url); return { ok: true, status: 200, arrayBuffer: async () => 바이트 }; };
    const 줄들 = await 넓은.공개자산받기('experiences', { root: 방, 받기 });
    assert.match(줄들[0], /^받음 — experiences\/korean-racing\/assets\/car\.glb/);
    assert.match(줄들[1], /^✗ 못 받음 — .*coastal-rocks-v6\.glb: 출시 목록과 다르다/);
    assert.deepEqual(fs.readFileSync(path.join(방, 'experiences/korean-racing/assets/car.glb')), 바이트);
    assert.equal(fs.existsSync(path.join(방, 'experiences/korean-racing/assets/coastal-rocks-v6.glb')), false);
    assert.ok(부른.every((url) => url.startsWith('https://raw.githubusercontent.com/unmet23-lab/synk-policy/main/try/racing/assets/')));
    assert.match((await 넓은.공개자산받기('experiences', { root: 방, 받기 }))[0], /^있음/, '있는 파일은 다시 받지 않는다');
    assert.deepEqual(await 넓은.공개자산받기('회사', { root: 방, 받기 }), [], '받을 것이 없는 묶음');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});
