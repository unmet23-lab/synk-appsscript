'use strict';

// 관련시험 — 임시 git 저장소에서만 고르고 돌린다. gh·네트워크는 부르지 않는다(원격이 GitHub가 아니다).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const 관련 = require('../tools/관련시험.js');

const 흐름 = `name: syntax-check
on:
  push:
    paths-ignore:
      - 'docs/_ops/트랙.md'
      - 'docs/현장노트/**'
jobs:
  check:
    steps:
      - run: node --test --test-reporter=tap tests/*.test.js 2>&1 | tee "$test_log" || rc=$?
`;

function 저장소(t, 파일) {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-관련시험-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true, maxRetries: 5 }));
  for (const [p, v] of Object.entries({ '.github/workflows/syntax-check.yml': 흐름, ...파일 })) {
    fs.mkdirSync(path.dirname(path.join(폴더, p)), { recursive: true });
    fs.writeFileSync(path.join(폴더, p), v);
  }
  const g = (...a) => execFileSync('git', a, { cwd: 폴더, stdio: 'pipe', encoding: 'utf8' });
  g('init', '-q', '-b', 'master');
  g('-c', 'user.name=시험', '-c', 'user.email=t@example.invalid', 'add', '-A');
  g('-c', 'user.name=시험', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', '바탕');
  return 폴더;
}

test('고르기 — 바꾼 시험 · 시험 글의 경로·이름 · 기록 전용은 고르지 않음 · 흔한 이름은 글로 안 고름', (t) => {
  const root = 저장소(t, {
    'tests/값.test.js': "require('../tools/가나다라.js'); // README.md 도 적혀 있다\n",
    'tests/무관.test.js': "require('node:assert');\n",
    'tests/이름.test.js': "const 도구 = path.join(루트, 'tools', '바로올리기.js');\n",
    'tests/도움.js': '// CI가 돌지 않는 도움 파일\n',
    'tools/가나다라.js': '', 'tools/바로올리기.js': '', 'README.md': '',
  });
  const 고름 = (바뀐) => 관련.고르기({ root, 바뀐, 지도: null });
  assert.deepEqual(고름(['tools/가나다라.js']).시험, ['tests/값.test.js']);
  assert.equal(고름(['tools/가나다라.js']).까닭['tests/값.test.js'], '글에 경로: tools/가나다라.js');
  assert.deepEqual(고름(['tools/바로올리기.js']).시험, ['tests/이름.test.js'], '경로를 쪼개 적어도 파일 이름으로 잡는다');
  assert.deepEqual(고름(['tests/무관.test.js']).시험, ['tests/무관.test.js']);
  assert.equal(고름(['tests/무관.test.js']).까닭['tests/무관.test.js'], '바꾼 시험');
  assert.deepEqual(고름(['README.md']).시험, [], 'README.md 같은 흔한 이름은 글로 고르지 않는다');
  assert.deepEqual(고름(['tests/도움.js']).시험, [], 'CI 무늬(tests/*.test.js) 밖 파일은 시험이 아니다');
  const 기록 = 고름(['docs/_ops/트랙.md', 'docs/현장노트/윈도우_셸.md']);
  assert.equal(기록.기록전용, true);
  assert.deepEqual(기록.시험, []);
  assert.equal(고름(['docs/_ops/트랙.md', 'tools/가나다라.js']).기록전용, false, '하나라도 기록 밖이면 고른다');
});

test('고르기 — 지도: 읽은 파일 · 나열한 폴더(새 파일) · git ls-files 무늬로 고른다', (t) => {
  const root = 저장소(t, { 'tests/자.test.js': '// 이름을 안 부르는 자\n', 'tests/딴.test.js': '//\n' });
  const 지도 = { run: 42, 시험: {
    'tests/자.test.js': { 읽음: ['docs/가/쪽.html'], 폴더: ['docs/새'], 무늬: ['*.html'] },
    'tests/딴.test.js': { 읽음: ['docs/딴.md'], 폴더: [], 무늬: ['experiences/*'] },
  } };
  const 고름 = (바뀐) => 관련.고르기({ root, 바뀐, 지도 });
  assert.equal(고름(['docs/가/쪽.html']).까닭['tests/자.test.js'], '읽음: docs/가/쪽.html');
  assert.equal(고름(['docs/새/처음.md']).까닭['tests/자.test.js'], '폴더 나열: docs/새');
  assert.equal(고름(['다른/곳/새.html']).까닭['tests/자.test.js'], 'git 무늬 *.html: 다른/곳/새.html');
  assert.deepEqual(고름(['experiences/a/b.js']).시험, ['tests/딴.test.js'], 'git 무늬의 *는 / 를 건넌다(git pathspec)');
  assert.deepEqual(고름(['docs/아무.md']).시험, []);
  assert.equal(고름(['docs/가/쪽.html']).지도, 42);
});

test('지도만들기 — 시험 프로세스(자식 포함)가 읽은 추적 파일·폴더·git 무늬만 남기고 node_modules·추적 밖은 뺀다', () => {
  const root = path.join(os.tmpdir(), '가상저장소');
  const 절대 = (p) => path.join(root, ...p.split('/'));
  const 기록들 = [
    { pid: 10, ppid: 1, cwd: root, argv: ['node', '--test', 'tests/자.test.js', 'tests/딴.test.js'], reads: [], spawns: [] },
    { pid: 11, ppid: 10, cwd: root, argv: ['node', 절대('tests/자.test.js')],
      reads: [[절대('docs/가/쪽.html'), ['read']], [절대('docs/새'), ['dir']], [절대('node_modules/x/index.js'), ['read']],
        [절대('.tmp/임시.json'), ['read']], [절대('tests/자.test.js'), ['read']], [root, ['dir']]],
      spawns: [{ command: 'git', args: ['-C', root, 'ls-files', '-z', '--', '*.html'], cwd: root }] },
    { pid: 12, ppid: 11, cwd: root, argv: ['node', 절대('tools/도구.js')], reads: [[절대('tools/도구.js'), ['read']]], spawns: [] },
    { pid: 13, ppid: 10, cwd: root, argv: ['node', 절대('tests/딴.test.js')], reads: [],
      spawns: [{ command: 'git', args: ['ls-files'], cwd: 절대('experiences') }, { command: 'git', args: ['ls-files', '--', '*.md'], cwd: os.tmpdir() }] },
  ];
  const 추적 = ['docs/가/쪽.html', 'docs/새/a.md', 'tests/자.test.js', 'tests/딴.test.js', 'tools/도구.js', 'experiences/a.js'];
  const 지도 = 관련.지도만들기(기록들, root, 추적);
  assert.deepEqual(지도['tests/자.test.js'], { 읽음: ['docs/가/쪽.html', 'tools/도구.js'], 폴더: ['.', 'docs/새'], 무늬: ['*.html'] });
  assert.deepEqual(지도['tests/딴.test.js'], { 읽음: [], 폴더: [], 무늬: ['experiences/*'] }, '저장소 밖에서 돈 git은 뺀다');
});

test('돌리기 — 고른 시험을 TAP으로 돌리고 깨진 시험 이름·위치(저장소 기준)를 돌려준다', (t) => {
  const root = 저장소(t, {
    'tests/됨.test.js': "require('node:test')('됨', () => {});\n",
    'tests/깨짐.test.js': "const { test } = require('node:test'); const assert = require('node:assert');\ntest('일부러 깨짐', () => { assert.equal(1, 2); });\n",
  });
  const 됨 = 관련.돌리기({ root, 시험: ['tests/됨.test.js'] });
  assert.equal(됨.통과함, true);
  assert.equal(됨.통과, 1);
  const 깨짐 = 관련.돌리기({ root, 시험: ['tests/됨.test.js', 'tests/깨짐.test.js'] });
  assert.equal(깨짐.통과함, false);
  assert.equal(깨짐.실패수, 1);
  assert.deepEqual(깨짐.실패.map((x) => [x.이름, x.위치]), [['일부러 깨짐', 'tests/깨짐.test.js:2']]);
  assert.deepEqual(관련.돌리기({ root, 시험: [] }), { 통과함: true, 시험: 0, 통과: 0, 실패수: 0, 실패: [], 초: 0 });
});

test('CI시험무늬 — syntax-check.yml의 node --test 줄에서 읽고, 없으면 tests/*.test.js', (t) => {
  const root = 저장소(t, {});
  assert.deepEqual(관련.CI시험무늬(root), ['tests/*.test.js']);
  fs.writeFileSync(path.join(root, '.github/workflows/syntax-check.yml'), '      - run: node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs\n');
  assert.deepEqual(관련.CI시험무늬(root), ['tests/*.test.js', 'tests/*.test.mjs', 'tests/*.test.cjs']);
  fs.rmSync(path.join(root, '.github'), { recursive: true });
  assert.deepEqual(관련.CI시험무늬(root), ['tests/*.test.js']);
});

test('git 무늬 — 와일드카드 없는 폴더 무늬는 그 아래 전부와 맞는다 · 읽나는 세 기준으로 까닭을 준다(아르곤 10-22 P1)', () => {
  assert.equal(관련.git무늬식('tests').test('tests/값.test.js'), true);
  assert.equal(관련.git무늬식('tests/').test('tests/a/b.js'), true);
  assert.equal(관련.git무늬식('tests').test('tests2/a.js'), false);
  assert.equal(관련.git무늬식('*.html').test('docs/a/b.html'), true);
  const 칸 = { 읽음: ['a.js'], 폴더: ['docs/새'], 무늬: ['experiences'] };
  assert.equal(관련.읽나(칸, 'a.js'), '읽음: a.js');
  assert.equal(관련.읽나(칸, 'docs/새/b.md'), '폴더 나열: docs/새');
  assert.equal(관련.읽나(칸, 'experiences/x/y.mjs'), 'git 무늬 experiences: experiences/x/y.mjs');
  assert.equal(관련.읽나(칸, 'tools/z.js'), null);
  assert.equal(관련.읽나(null, 'a.js'), null);
});

test('지도읽기 — 받기에 실패하면 30분은 다시 묻지 않고, 지나면 다시 묻는다(아르곤 10-22 P2)', (t) => {
  const root = 저장소(t, {});
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/o/r.git'], { cwd: root, stdio: 'pipe' });
  const 부름 = [];
  const gh = (args) => { 부름.push(args[1]); return args[1] === 'list' ? '[]' : null; };
  const t0 = Date.parse('2026-10-22T01:00:00Z');
  assert.equal(관련.지도읽기(root, { gh, 지금ms: t0 }), null);
  assert.deepEqual(부름, ['list'], '처음에는 묻는다');
  assert.equal(관련.지도읽기(root, { gh, 지금ms: t0 + 10 * 60e3 }), null);
  assert.deepEqual(부름, ['list'], '실패 뒤 30분 안에는 묻지 않는다');
  관련.지도읽기(root, { gh, 지금ms: t0 + 31 * 60e3 });
  assert.deepEqual(부름, ['list', 'list'], '30분이 지나면 다시 묻는다');
  관련.지도읽기(root, { gh, 받기: false, 지금ms: t0 + 120 * 60e3 });
  assert.equal(부름.length, 2, '받기:false(미리 보기)는 묻지 않는다');
});

test('고르기 — 같은 push로 처음 올리는 (아직 추적 안 된) 시험 파일도 「바꾼 시험」으로 고른다', (t) => {
  const root = 저장소(t, {});
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tests', '새.test.js'), '// 새 시험\n');
  const r = 관련.고르기({ root, 바뀐: ['tests/새.test.js'], 지도: null });
  assert.deepEqual(r.시험, ['tests/새.test.js']);
  assert.equal(r.까닭['tests/새.test.js'], '바꾼 시험');
});
