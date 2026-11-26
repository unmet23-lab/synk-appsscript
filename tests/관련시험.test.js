'use strict';

// 관련시험 — 임시 git 저장소에서만 고르고 돌린다. gh·네트워크는 부르지 않는다(원격이 GitHub가 아니다).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');

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

// 시간 한도로 끊긴 시험 자식은 돌리기가 돌아온 뒤에도 수십 ms 동안 cwd로 폴더를 쥔다(Windows). Node 24 rmSync의 maxRetries는 이 EPERM을
// 다시 시도하지 않아 직접 기다린다. 한도는 느림 시험의 20초보다 짧게 둔다 — 자식이 정말 살아남으면 여기서 깨진다(현장노트 시험_화면확인).
async function 지우기(폴더, 한도ms = 10e3) {
  const 끝 = Date.now() + 한도ms;
  for (;;) {
    try {
      fs.rmSync(폴더, { recursive: true, force: true });
      return;
    } catch (e) {
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(e.code) || Date.now() >= 끝) throw e;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

function 저장소(t, 파일) {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-관련시험-'));
  t.after(() => 지우기(폴더));
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

test('고르기 — 이름의 일부만 같은 시험을 빼고 직접·간접 참조와 지도에서 확인한 읽기는 남긴다', (t) => {
  const 대상 = 'pkg/tools/run.mjs';
  const root = 저장소(t, {
    [대상]: '', 'other/run.mjs': '', 'pkg/tools/index.js': '',
    'pkg/lib/helper.mjs': "export { x } from './cycle.mjs';",
    'pkg/lib/cycle.mjs': "import './helper.mjs'; export { x } from '../tools/run.mjs';",
    'tests/직접.test.js': "spawn('node', ['pkg/tools/run.mjs']);",
    'tests/간접.test.js': "import '../pkg/lib/helper.mjs';",
    'tests/조각.test.js': "read(join(root, 'pkg', 'tools', 'run.mjs'));",
    'tests/윈도우.test.js': String.raw`run("pkg\\tools\\run.mjs");`,
    'tests/다른모듈.test.js': "import '../other/run.mjs';",
    'tests/두번.test.js': "import '../other/run.mjs'; read(join(base, 'run.mjs'));",
    'tests/이름일부.test.js': "// a.run.mjs 회원-run.mjs 회원_run.mjs 한run.mjs pkg/tools/run.mjs.bak",
    'tests/이름미정.test.js': "read(join(base, makeName()));",
    'tests/흔한경로.test.js': "spawn('node', ['pkg/tools/index.js']);",
    'tests/폴더진입.test.js': "require('../pkg/tools');",
  });
  const 필요 = ['간접', '두번', '윈도우', '조각', '직접'].map(n => `tests/${n}.test.js`);
  const 지도 = { 시험: { 'tests/이름미정.test.js': { 읽음: [대상] }, 'tests/간접.test.js': { 읽음: [] } } };
  const 선택 = (p, m) => 관련.고르기({ root, 바뀐: [p], 지도: m }).시험;
  assert.deepEqual(선택(대상, null), 필요.sort());
  assert.deepEqual(선택(대상, 지도), [...필요, 'tests/이름미정.test.js'].sort());
  assert.deepEqual(선택('pkg/tools/index.js', null), ['tests/폴더진입.test.js', 'tests/흔한경로.test.js']);
  fs.unlinkSync(path.join(root, 대상));
  assert.deepEqual(선택(대상, null), 필요, '지운 모듈을 불러오는 시험도 실행한다');
});

test('고르기 — 패키지 main과 주석이 있는 재수출을 따르고 다른 import 경로의 끝은 제외한다', (t) => {
  const root = 저장소(t, {
    'pkg/package.json': JSON.stringify({main:'./lib/entry'}),
    'pkg/lib/entry.js': '', 'pkg/index.js': '', 'lib/leaf.mjs': '', 'old/lib/leaf.mjs': '',
    'lib/loader.cjs': "const loader = module; module.exports = ['import', require('./handler.cjs'), require.resolve(/* near */ './opt.cjs'), loader.require('./alias.cjs')];",
    'lib/handler.cjs': '', 'lib/opt.cjs': '', 'lib/alias.cjs': '', 'tests/호출.test.js': "require('../lib/loader.cjs');",
    'lib/bridge.mjs': "export * from /* source */ './leaf.mjs';",
    'tests/선언.test.js': "require('../pkg');",
    'tests/도우미.test.js': "import '../lib/bridge.mjs';",
    'tests/동명이인.test.js': "import '../old/lib/leaf.mjs';",
  });
  const 선택 = p => 관련.고르기({root, 바뀐:[p], 지도:null}).시험;
  assert.deepEqual([선택('pkg/lib/entry.js'), 선택('pkg/package.json'), 선택('lib/leaf.mjs')],
    [['tests/선언.test.js'], ['tests/선언.test.js'], ['tests/도우미.test.js']]);
  for (const p of ['lib/handler.cjs', 'lib/opt.cjs', 'lib/alias.cjs']) assert.deepEqual(선택(p), ['tests/호출.test.js'], p);
  fs.unlinkSync(path.join(root,'pkg/lib/entry.js'));
  assert.deepEqual(선택('pkg/lib/entry.js'), ['tests/선언.test.js']);
});

test('상대 경로 리터럴은 별칭·변수·미완성 소스의 시험을 고르되 실패 귀속 근거와 구분한다', (t) => {
  const root = 저장소(t, {
    'tests/별칭.test.js': "require('../lib/helpers.cjs'); require('../lib/partial.cjs');",
    'lib/helpers.cjs': "module.exports = (load) => { let p = './first.cjs'; load(p); p = `./next.cjs`; load(p); return ['./fixture.json']; };",
    'lib/partial.cjs': "run('./partial-input.cjs'); (",
    'lib/first.cjs': '', 'lib/next.cjs': '', 'lib/partial-input.cjs': '', 'lib/fixture.json': '{}',
  });
  const 직접 = 'tests/별칭.test.js';
  const 엄격 = 관련.불러오는파일(root, 직접);
  for (const 이름 of ['first.cjs', 'next.cjs', 'partial-input.cjs', 'fixture.json']) {
    const p = 'lib/' + 이름;
    assert.deepEqual(관련.고르기({root, 바뀐:[p], 지도:null}).시험, [직접], p);
    assert.ok(!엄격.has(p), '추정한 자료 경로를 근거로 시험 실패를 면제하지 않는다: ' + p);
  }
});

test('구문 캐시는 같은 내용도 현재 폴더에서 해석하고 변경·손상 뒤에 다시 읽는다', (t) => {
  const root = 저장소(t, {
    'a/use.cjs': "require('./leaf.cjs');", 'b/use.cjs': "require('./leaf.cjs');",
    'a/leaf.cjs': '', 'a/next.cjs': '', 'b/leaf.cjs': '',
    'tests/a.test.js': "require('../a/use.cjs');", 'tests/b.test.js': "require('../b/use.cjs');",
  });
  const 선택 = p => 관련.고르기({root, 바뀐:[p], 지도:null}).시험;
  const 캐시 = path.join(root, '.git', 'synk-관련시험', '구문참조.json');
  assert.deepEqual(선택('a/leaf.cjs'), ['tests/a.test.js']);
  const 처음 = fs.readFileSync(캐시);
  assert.deepEqual(선택('b/leaf.cjs'), ['tests/b.test.js']);
  assert.deepEqual(fs.readFileSync(캐시), 처음);
  const 원천 = path.join(root,'a/use.cjs'), 시각 = fs.statSync(원천).mtime;
  fs.writeFileSync(원천, "require('./next.cjs');");
  fs.utimesSync(원천, 시각, 시각);
  assert.deepEqual(선택('a/next.cjs'), ['tests/a.test.js']);
  assert.deepEqual(선택('a/leaf.cjs'), []);
  fs.writeFileSync(캐시, 처음.subarray(0, 처음.length - 1));
  assert.deepEqual(선택('a/next.cjs'), ['tests/a.test.js']);
});

test('고르기 — 조건부 등록부에 적힌 시험 파일 · 등록부 폴더 · 그 워크플로를 바꾸면 등록 시험(.cjs)을 같이 고른다(11-12)', (t) => {
  const 등록시험 = 'tests/conditional-qa.test.cjs';
  const 파일 = {
    'tests/등록된.test.js': "require('node:test').test('PC에만 있는 도구로 도는 시험', { skip: false }, () => {});\n",
    'tests/무관.test.js': "require('node:assert');\n",
    [등록시험]: "require('node:test').test('등록부 대조', () => {});\n",
    'tools/conditional-qa/cases.json': JSON.stringify({ cases: [{ id: 'S1', file: 'tests/등록된.test.js', name: 'PC에만 있는 도구로 도는 시험' }] }),
    'tools/conditional-qa/guard.cjs': '',
    '.github/workflows/conditional-qa.yml': 'name: conditional-qa\n',
    'tools/다른.js': '',
  };
  const root = 저장소(t, 파일);
  const 고름 = (바뀐, 뿌리 = root) => 관련.고르기({ root: 뿌리, 바뀐, 지도: null });
  assert.deepEqual(고름(['tests/등록된.test.js']).시험, [등록시험, 'tests/등록된.test.js'], '등록부에 적힌 시험 파일을 바꾸면 등록 시험도 돈다');
  assert.equal(고름(['tests/등록된.test.js']).까닭[등록시험], '조건부 등록부가 보는 파일: tests/등록된.test.js');
  for (const p of ['tools/conditional-qa/cases.json', 'tools/conditional-qa/guard.cjs', '.github/workflows/conditional-qa.yml', 등록시험]) {
    assert.deepEqual(고름([p]).시험, [등록시험], p);
  }
  assert.deepEqual(고름(['tests/무관.test.js']).시험, ['tests/무관.test.js'], '등록부에 없는 시험 파일로는 고르지 않는다');
  assert.deepEqual(고름(['tools/다른.js']).시험, []);
  // 등록부가 깨져 있으면 그 파일 목록으로는 못 고르지만 넘어지지 않고, 등록 시험이 없는 저장소에서는 고를 것이 없다
  const 깨진 = 저장소(t, { ...파일, 'tools/conditional-qa/cases.json': '{' });
  assert.deepEqual(고름(['tests/등록된.test.js'], 깨진).시험, ['tests/등록된.test.js']);
  assert.deepEqual(고름(['tools/conditional-qa/cases.json'], 깨진).시험, [등록시험]);
  const { [등록시험]: _뺀, ...없는 } = 파일;
  assert.deepEqual(고름(['tests/등록된.test.js', 'tools/conditional-qa/guard.cjs'], 저장소(t, 없는)).시험, ['tests/등록된.test.js']);
});

test('고르기 — 넓은 CI의 회사·PC·경험·도구·루트 시험을 같은 분모로 고른다', (t) => {
  const 회사 = 'docs/마케팅/온라인마케팅지도/engagement/company';
  const 대상 = [
    'tests/module.test.mjs', 'tests/module.test.cjs',
    `${회사}/direct-tab-role-client.test.mjs`, `${회사}/nested/server.test.js`,
    'desktop/tests/client.test.cjs', 'desktop/tests/client.test.mjs',
    'experiences/example/server.test.mjs', 'tools/example/check.test.cjs',
  ];
  const 제외 = ['tests/helper.mjs', 'tests/nested/outside.test.mjs', 'desktop/tests/not-ci.test.js',
    'desktop/installer/tests/measure.cjs', `${회사}/fixture.mjs`, `${회사}/node_modules/a/skip.test.mjs`];
  const root = 저장소(t, Object.fromEntries([...대상, ...제외].map(p => [p, '// related-product-module.mjs\n'])));
  const 넓은 = require('../tools/ci넓은시험.js');
  const 실제 = [...new Set(Object.keys(넓은.묶음들).flatMap(묶음 => 넓은.목록(묶음, root)))].sort();
  assert.deepEqual(관련.CI시험목록(root).sort(), 실제, 'wide CI inventory and pre-push candidates must agree');
  assert.deepEqual(실제, [...대상].sort());
  const 직접 = 관련.고르기({root,바뀐:[...대상, ...제외],지도:null});
  assert.deepEqual(직접.시험,[...대상].sort());
  assert.ok(대상.every(p=>직접.까닭[p]==='바꾼 시험'));
  const 소스 = 관련.고르기({root,바뀐:[`${회사}/related-product-module.mjs`],지도:null});
  assert.deepEqual(소스.시험,[...대상].sort(), 'wide tests are also eligible for source-text matching');
  const 새것 = `${회사}/new-directory.test.mjs`;
  fs.writeFileSync(path.join(root,새것),'// first push\n');
  const 새판 = 관련.고르기({root,바뀐:[새것,'docs/_ops/트랙.md'],지도:null});
  assert.deepEqual(새판.시험,[새것]);
  assert.equal(새판.까닭[새것],'바꾼 시험','untracked new wide test must run before its first commit');
  fs.unlinkSync(path.join(root,대상[0]));
  assert.ok(!관련.고르기({root,바뀐:[대상[0]],지도:null}).시험.includes(대상[0]),'deleted tests are not runnable');
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

// 기록 전용 경로를 실제로 읽는 시험 목록 — CI 읽기 대조 ②가 지키는 records-check.yml의 node --test 줄
const 기록흐름 = `name: records-check
on:
  push:
    paths:
      - 'docs/_ops/트랙.md'
      - 'docs/현장노트/**'
jobs:
  records:
    steps:
      - run: node --test --test-reporter=tap tests/트랙읽기.test.js tests/결정읽기.test.js
`;
// 내커밋·바로올리기·짝검사 시험처럼 트랙 경로를 mkdtemp 가짜 저장소의 파일 이름으로만 적는 시험
const 이름만시험 = "const 트랙 = 'docs/_ops/트랙.md'; // 가짜 저장소 파일 이름 · docs/현장노트/윈도우_셸.md\nrequire('../tools/가나다라.js');\n";

test('고르기 — 기록 전용 경로는 글로 고르지 않는다: 트랙 글자만 적은 시험은 안 고르고, 지도에서 트랙을 읽은 시험은 고른다(10-22)', (t) => {
  const root = 저장소(t, {
    '.github/workflows/records-check.yml': 기록흐름,
    'tests/이름만.test.js': 이름만시험,
    'tests/트랙읽기.test.js': "fs.readFileSync(path.join(루트, 'docs', '_ops', '트랙.md'), 'utf8');\n",
    'tests/결정읽기.test.js': "fs.readFileSync(path.join(루트, 'docs', '_ops', '결정.md'), 'utf8');\n",
    'tools/가나다라.js': '',
  });
  const 지도 = { run: 7, 시험: {
    'tests/이름만.test.js': { 읽음: ['tools/가나다라.js'], 폴더: [], 무늬: [] },
    'tests/트랙읽기.test.js': { 읽음: ['docs/_ops/트랙.md'], 폴더: [], 무늬: [] },
    'tests/결정읽기.test.js': { 읽음: ['docs/_ops/결정.md'], 폴더: [], 무늬: [] },
  } };
  const r = 관련.고르기({ root, 바뀐: ['docs/_ops/트랙.md', 'docs/현장노트/윈도우_셸.md', 'tools/나머지.js'], 지도 });
  assert.deepEqual(r.시험, ['tests/트랙읽기.test.js'], '글에 트랙·현장노트 경로만 적은 시험과 트랙을 안 읽는 기록 시험은 안 고른다');
  assert.equal(r.까닭['tests/트랙읽기.test.js'], '읽음: docs/_ops/트랙.md');
  const 섞임 = 관련.고르기({ root, 바뀐: ['docs/_ops/트랙.md', 'tools/가나다라.js'], 지도: null });
  assert.equal(섞임.까닭['tests/이름만.test.js'], '글에 경로: tools/가나다라.js', '기록 밖 경로는 여전히 글로 고른다');
  fs.rmSync(path.join(root, '.github/workflows/syntax-check.yml'));
  assert.equal(관련.고르기({ root, 바뀐: ['docs/_ops/트랙.md', 'tools/나머지.js'], 지도 }).까닭['tests/이름만.test.js'], '글에 경로: docs/_ops/트랙.md',
    'paths-ignore 목록을 못 읽으면 기록 경로를 가르지 못하니 예전처럼 넓게 고른다');
});

test('고르기 — 지도가 모르는 시험(지도를 못 받음·지도 뒤에 생김)은 기록 경로가 섞이면 records-check.yml 목록으로 고른다(10-22)', (t) => {
  const root = 저장소(t, {
    '.github/workflows/records-check.yml': 기록흐름,
    'tests/이름만.test.js': 이름만시험,
    'tests/트랙읽기.test.js': '// 지도 뒤에 생긴 시험\n',
    'tests/결정읽기.test.js': '//\n',
    'tools/가나다라.js': '',
  });
  const 바뀐 = ['docs/_ops/트랙.md', 'tools/나머지.js'];
  const 없음 = 관련.고르기({ root, 바뀐, 지도: null });
  assert.deepEqual(없음.시험, ['tests/결정읽기.test.js', 'tests/트랙읽기.test.js'], '지도가 없으면 목록 전부 — 이름만 적은 시험은 안 고른다');
  assert.equal(없음.까닭['tests/트랙읽기.test.js'], '기록 시험(records-check.yml)·지도에 없음: docs/_ops/트랙.md');
  const 지도 = { run: 8, 시험: {
    'tests/이름만.test.js': { 읽음: ['tools/가나다라.js'], 폴더: [], 무늬: [] },
    'tests/결정읽기.test.js': { 읽음: ['docs/_ops/결정.md'], 폴더: [], 무늬: [] },
  } };
  assert.deepEqual(관련.고르기({ root, 바뀐, 지도 }).시험, ['tests/트랙읽기.test.js'], '지도가 아는 시험은 지도대로 — 결정만 읽는 시험은 트랙 push에 안 붙는다');
  assert.deepEqual(관련.고르기({ root, 바뀐: ['tools/나머지.js'], 지도: null }).시험, [], '기록 경로가 없으면 목록을 보지 않는다');
  assert.deepEqual(관련.기록시험목록(root), ['tests/트랙읽기.test.js', 'tests/결정읽기.test.js']);
  fs.rmSync(path.join(root, '.github/workflows/records-check.yml'));
  assert.deepEqual(관련.기록시험목록(root), []);
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

/** 몰이 장부 글(tools/lib/관련시험몰이.cjs와 같은 꼴) — 파일마다 { 끝: { 종료, 신호 } | { 오류 } | null(끊긴 때 돌던 중), 안돌림: true }. */
function 몰이장부(파일들, { 끊김 = false, 끝 = true } = {}) {
  const 줄 = [{ 몰이판: 1, 수: 파일들.length }];
  파일들.forEach((f, 번호) => { if (f.안돌림) return; 줄.push({ 번호, 시작: true }); if (f.끝) 줄.push({ 번호, ...f.끝 }); });
  if (끊김) 줄.push({ 끊김: true });
  if (끝) 줄.push({ 끝: true });
  return 줄.map((x) => `${JSON.stringify(x)}\n`).join('');
}
const 끝남 = { 종료: 0, 신호: null };
/** 파일마다 장부 칸과 TAP 글(tap — Error면 읽다 그 오류가 난 것)을 주고 몰이판정을 부른다. 파일 이름을 안 주면 tests/f<번호>.test.js다. */
function 판정(파일들, { 끊김 = false, 끝 = true, 몰이 = { status: 0 }, 장부글, 한도ms } = {}) {
  const 시험 = 파일들.map((f, i) => f.파일 || `tests/f${i}.test.js`);
  const tap = (i) => { const 값 = 파일들[i].tap; if (값 instanceof Error) throw 값; return 값 ?? null; };
  return 관련.몰이판정({ 장부글: 장부글 === undefined ? 몰이장부(파일들, { 끊김, 끝 }) : 장부글, tap, 시험, root: null, 몰이, 한도ms });
}
const 읽기오류 = (code) => Object.assign(new Error(code), { code });

/** 돌리기를 vm에서 돌리고 몰이(spawnSync)만 흉내 낸다 — 일 파일을 읽어 장부와 TAP을 그 폴더에 쓴다. 걸린 시간은 단조 시계만 민다. */
function 몰이흉내(t, { 시험 = ['tests/a.test.js'], 한도ms = 900000, 경과 = 0, 응답 = (일) => ({ 장부: 몰이장부(일.시험.map(() => ({ 끝: 끝남 }))), tap: () => 완전보고서() }) } = {}) {
  const root = 저장소(t, {}), 파일 = require.resolve('../tools/관련시험.js');
  const 안require = require('node:module').createRequire(파일), 모듈 = { exports: {} }, calls = [];
  let monotonic = 0n;
  require('node:vm').runInNewContext(fs.readFileSync(파일, 'utf8'), {
    require: (id) => id === 'node:child_process' ? { spawnSync: (command, args, options) => {
      if (!String(args?.[0] || '').endsWith('관련시험몰이.cjs')) return spawnSync(command, args, options);
      const 일 = JSON.parse(fs.readFileSync(args[1], 'utf8'));
      calls.push({ command, args, options, 일 });
      const 답 = 응답(일);
      if (답.장부 !== null) fs.writeFileSync(path.join(일.폴더, '장부.jsonl'), 답.장부);
      일.시험.forEach((_, i) => { const 글 = 답.tap(i); if (글 !== null) fs.writeFileSync(path.join(일.폴더, `${i}.tap`), 글); });
      monotonic += BigInt(경과) * 1000000n;
      return 답.결과 || { status: 0 };
    } } : 안require(id),
    module: 모듈, __dirname: path.dirname(파일), __filename: 파일,
    process: { ...process, hrtime: { bigint: () => monotonic } }, Buffer, console,
  });
  return { result: 모듈.exports.돌리기({ root, 시험, 워크트리: true, 새파일: ['tests/new.test.js'], 자리: false, 한도ms }), calls };
}

const 완전보고서 = (본문 = 'ok 1 - case', { tests = 1, pass = 1, fail = 0, cancelled = 0, skipped = 0, todo = 0, suites = 0 } = {}) =>
  ['TAP version 13', 본문, '1..1', `# tests ${tests}`, `# suites ${suites}`, `# pass ${pass}`, `# fail ${fail}`, `# cancelled ${cancelled}`, `# skipped ${skipped}`, `# todo ${todo}`, '# duration_ms 1.25', ''].join('\n');

test('보고서 판정은 마지막 계획 뒤의 요약만 읽고 없는 수치를 0으로 만들지 않는다', () => {
  const text = 완전보고서('# tests 99\n# pass 99\n# fail 0\n# duration_ms 1\nok 1 - case', { tests: 2, pass: 0, fail: 2 });
  assert.equal(관련.보고서판정(text).상태, '완료');
  assert.equal(관련.보고서판정(text).요약.실패수, 2);
  assert.equal(관련.보고서판정(text).요약.시험, 2);
  const minimal = 완전보고서().replace(/^# (suites|skipped|todo) .*\n/gm, '');
  assert.equal(관련.보고서판정(minimal).상태, '완료');
  assert.equal(관련.보고서판정(minimal).요약.건너뜀, null);
  for (const text of [null, '', 'TAP version 13\n', '# tests 0\n', '# comment\n']) assert.equal(관련.보고서판정(text).상태, '미확인');
  assert.equal(관련.보고서판정('# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# duration_ms 1').상태, '미확인');
  assert.equal(관련.보고서판정('ok 1 - partial\n1..1\n# tests 1\n').상태, '중간');
});

test('완료 요약의 절단·중복·잘못된 숫자와 숨은 줄 경계를 거절한다', () => {
  const full = 완전보고서(), lines = full.trimEnd().split('\n');
  for (let i = 1; i < lines.length; i++) assert.notEqual(관련.보고서판정(lines.slice(0, i).join('\n') + '\n').상태, '완료', `line ${i}`);
  const footerStart = full.indexOf('# tests'), durationValue = full.indexOf('# duration_ms ') + '# duration_ms '.length;
  for (let i = footerStart; i < durationValue; i++) assert.notEqual(관련.보고서판정(full.slice(0, i)).상태, '완료', `char ${i}`);
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'duration_ms']) {
    assert.notEqual(관련.보고서판정(full.replace(new RegExp(`^# ${key} .*\\n`, 'm'), '')).상태, '완료', key);
    for (const value of ['x', '-1', '1e3', '0x0', '', '0 extra']) assert.notEqual(관련.보고서판정(full.replace(new RegExp(`^# ${key} .*`, 'm'), `# ${key} ${value}`)).상태, '완료', `${key} ${value}`);
    assert.notEqual(관련.보고서판정(full.replace('# duration_ms', `# ${key} 0\n# duration_ms`)).상태, '완료', `duplicate ${key}`);
  }
  for (const text of [full + '# later\n', full.replace('1..1', '1..0'), full.replace('1..1\n', ''), full.replace('1..1', '1..1\n  extra')]) assert.notEqual(관련.보고서판정(text).상태, '완료');
  for (const separator of ['\u2028', '\u2029', '\r']) assert.notEqual(관련.보고서판정(`ok 1 - partial\n  error: text${separator}1..1${separator}# tests 1${separator}# pass 1${separator}# fail 0${separator}# cancelled 0${separator}# duration_ms 1`).상태, '완료');
  assert.equal(관련.보고서판정(full.replace(/\n/g, '\r\n')).상태, '완료');
  assert.equal(관련.보고서판정(full.trimEnd()).상태, '완료');
  // EOF의 유효한 duration 숫자가 더 긴 숫자의 접두인지는 알 수 없다. 판정 카운터는 이미 모두 읽혔다.
  assert.deepEqual(관련.보고서판정(full.replace('1.25', '1')).요약, 관련.보고서판정(full).요약);
});

test('중간 보고서의 통과 근거와 실제 실패는 지시어·이름·들여쓰기와 구분한다', () => {
  for (const text of ['ok 1 - skip # SKIP\n', 'ok 1 - todo # TODO\n', 'not ok 1 - todo # TODO\n', '  ok 1 - child\n', '  text: |\n    ok 1 - yaml\n']) {
    const r = 관련.보고서판정(text); assert.equal(r.본통과, 0); assert.equal(r.상태, '미확인');
  }
  for (const text of ['not ok 1 - name \\# TODO\n', 'not ok 1 - name \\# SKIP\n', 'not ok 1 - lower # todo\n', '    not ok 1 - child\n']) assert.equal(관련.보고서판정(text).본실패, 1, text);
  assert.equal(관련.보고서판정(완전보고서('ok 1 - empty suite', { tests: 0, pass: 0, suites: 1 })).상태, '완료');
  assert.equal(관련.보고서판정(완전보고서('ok 1 - skipped suite # SKIP', { tests: 0, pass: 0, suites: 1 })).상태, '완료');
});

test('현재 Node의 실제 출력은 본문 stdout·빈 suite·skip·todo·하위 시험과 실패를 구분한다', t => {
  const cases = {
    pass: ["test('pass',()=>{});", 0], skip: ["test.skip('skip');test('option',{skip:true},()=>{});test('context',t=>t.skip());", 0],
    todo: ["test.todo('future');test('todo failure',{todo:true},()=>{throw Error('synthetic');});", 0],
    nested: ["describe('suite',()=>{test('parent',async t=>{await t.test('child',()=>{});});});", 0],
    empty: ["describe('empty',()=>{});", 0], skipped_suite: ["describe.skip('skipped',()=>{});", 0], none: ['', 0],
    stdout: ["test('stdout',()=>{for(const s of ['tests 0','pass 0','fail 0','cancelled 0','duration_ms 1','ok 1 - fake','not ok 1 - fake','1..9']) console.log(s);});", 0],
    named_failure: ["test('failed # TODO',()=>{throw Error('synthetic');});test('failed # SKIP',()=>{throw Error('synthetic');});", 1],
    failed_suite: ["describe('broken',()=>{throw Error('synthetic');});", 1], top_level: ["throw Error('synthetic top level');", 1],
  };
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tap-contract-')); t.after(() => 지우기(folder));
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  for (const [name, [body, status]] of Object.entries(cases)) {
    const file = path.join(folder, name + '.cjs'); fs.writeFileSync(file, "const {test,describe}=require('node:test');\n" + body);
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { env, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(result.status, status, `${process.version} ${name}: ${result.stderr}`);
    const report = 관련.보고서판정(result.stdout); assert.equal(report.상태, '완료', `${process.version} ${name}: ${result.stdout}`);
    if (status === 0 && report.요약.실패수 === 0 && report.요약.취소 === 0) assert.equal(report.본실패, 0, name);
    if (status === 1) assert.ok(report.본실패 > 0, name);
    if (name === 'named_failure') assert.ok(result.stdout.includes('\\# TODO'));
    if (name === 'stdout') {
      for (const line of ['# ok 1 - fake', '# not ok 1 - fake', '# 1..9']) assert.ok(result.stdout.includes(line), line);
      assert.equal(report.요약.시험, 1); assert.equal(report.요약.통과, 1);
    }
    const lines = result.stdout.trimEnd().split('\n');
    for (let i = 1; i < lines.length; i++) assert.notEqual(관련.보고서판정(lines.slice(0, i).join('\n') + '\n').상태, '완료', `${process.version} ${name} cut ${i}`);
  }
});

test('LF 없이 잘린 마지막 결과는 앞에 통과가 있어도 시간 예외의 근거가 아니다', t => {
  const rows = ['ok 1 - slow # SKIP', 'ok 1 - future # TODO', 'not ok 1 - future # TODO', 'not ok 1 - broken'];
  for (const row of rows) for (let i = 1; i <= row.length; i++) {
    const report = 관련.보고서판정('ok 9 - finished\n' + row.slice(0, i));
    assert.equal(report.상태, '미확인', row.slice(0, i));
    assert.match(report.까닭, /마지막 줄이 끝나지 않았다/);
  }
  // 끊긴 때 돌던 파일의 TAP — 앞에 통과로 끝난 파일이 있어도 막는다.
  for (const tail of ['ok 1 - slow # SK', 'ok 1 - future # TO', 'ok 1 - slow', 'not ok 1 - broken', 'ok 1 - done\r']) {
    for (const 앞통과 of [false, true]) {
      const 돌던 = { 끝: null, tap: 'ok 9 - finished\n' + tail };
      const r = 판정(앞통과 ? [{ 끝: 끝남, tap: 완전보고서() }, 돌던] : [돌던, { 안돌림: true }], { 끊김: true });
      assert.equal(r.통과함, false);
      assert.equal(관련.시간만넘김(r), false, `${앞통과}: ${tail}`);
      assert.match(r.TAP오류, /마지막 줄이 끝나지 않았다/);
    }
  }
});

test('YAML 진단 안의 결과 문구와 깊은 닫힘은 실제 실패로 세지 않는다', t => {
  const diagnostic = 'not ok 1 - todo # TODO\n  ---\n  error: |-\n    not ok 9 - text\n    ...\n      ...\n    ---\n    ok 8 - text\n    # Subtest: text\n    1..9\n  ...';
  const full = 완전보고서(diagnostic, { pass: 0, todo: 1 });
  const report = 관련.보고서판정(full);
  assert.equal(report.상태, '완료'); assert.equal(report.본실패, 0);
  const good = 판정([{ 파일: 'tests/todo.test.js', 끝: 끝남, tap: full }]);
  assert.equal(good.통과함, true); assert.equal(good.실패.length, 0);
  const failed = 관련.보고서판정(diagnostic + '\n    not ok 2 - real\n');
  assert.equal(failed.본실패, 1);
  const open = 'ok 1 - finished\nnot ok 2 - todo # TODO\n  ---\n  error: |-\n    not ok 9 - text\n';
  assert.equal(관련.보고서판정(open).본실패, 0);
  assert.notEqual(관련.보고서판정(완전보고서(open)).상태, '완료', '열린 진단 뒤의 계획과 요약을 완료로 세지 않는다');
  const timed = 판정([{ 파일: 'tests/fail.test.js', 끝: null, tap: diagnostic + '\nnot ok 2 - real \\# TODO\n' }], { 끊김: true });
  assert.equal(관련.시간만넘김(timed), false);
  assert.ok(timed.실패.length && timed.실패.every((x) => x.파일 === 'tests/fail.test.js'), JSON.stringify(timed.실패));
});

test('CRLF를 정규화해도 LF 없이 남은 CR 꼬리를 지우지 않는다', t => {
  const full = 완전보고서().replace(/\n/g, '\r\n');
  assert.equal(관련.보고서판정(full).상태, '완료');
  for (let i = 1; i < full.length; i++) if (full[i - 1] === '\r') {
    assert.equal(관련.보고서판정(full.slice(0, i)).상태, '미확인', `CR cut ${i}`);
  }
  for (const tail of ['\r', '\r\r']) for (const 앞통과 of [false, true]) {
    const 돌던 = { 끝: null, tap: 'ok 1 - finished\r\n' + tail };
    const r = 판정(앞통과 ? [{ 끝: 끝남, tap: 완전보고서() }, 돌던] : [돌던], { 끊김: true });
    assert.equal(관련.시간만넘김(r), false, `${앞통과}: ${JSON.stringify(tail)}`);
    assert.match(r.TAP오류, /마지막 줄이 끝나지 않았다/);
  }
});

test('몰이판정 — 끝난 파일은 종료 0과 깨끗한 완료 TAP일 때만 통과고, 종료 · 신호 · 띄우기 오류 · 모자란 TAP은 그 파일의 깨짐이다', () => {
  assert.deepEqual(판정([{ 끝: 끝남, tap: 완전보고서() }]), { 시험: 1, 통과: 1, 실패수: 0, 취소: 0, 건너뜀: 0, 할일: 0, 실패: [], 통과함: true });
  for (const [끝, tap, 까닭] of [
    [끝남, 'ok 1 - case\n1..1\n# tests 1\n', /TAP 완료 요약이 없다/], [끝남, null, /TAP이 없다/], [끝남, 읽기오류('EACCES'), /TAP을 읽지 못했다 \(EACCES\)/],
    [끝남, '', /TAP에 확인한 시험 결과가 없다/],
    [끝남, 완전보고서('ok 1 - case', { pass: 0, cancelled: 1 }), /TAP에 실패나 취소가 있다/],
    [{ 종료: 9, 신호: null }, null, /종료 9/], [{ 종료: 1, 신호: null }, 완전보고서('ok 1 - case', { pass: 0, fail: 1 }), /종료 1/],
    [{ 종료: null, 신호: 'SIGKILL' }, 완전보고서(), /신호 SIGKILL/], [{ 오류: 'ENOENT' }, 완전보고서(), /띄우지 못함 ENOENT/],
  ]) {
    const r = 판정([{ 파일: 'tests/one.test.js', 끝, tap }]);
    assert.equal(r.통과함, false, String(tap)); assert.equal(관련.시간만넘김(r), false);
    assert.deepEqual(r.실패.map((x) => x.파일), ['tests/one.test.js']);
    assert.match(r.실패[0].이름, 까닭, String(tap)); assert.match(r.이유, 까닭);
    assert.equal(r.실패[0].기록없음, true, 'TAP에 실패 줄 없이 지어낸 항목이다 — 공용 작업본 면제가 보지 않는다');
    // 끝난 파일의 TAP이 없거나 읽다 오류가 나면 기록을 믿을 수 없다(3회차 GPT GA2).
    if (tap === null || tap instanceof Error) assert.match(r.TAP오류, /tests\/one\.test\.js TAP(이 없다|을 읽지 못했다)/, String(tap));
  }
});

test('몰이판정 — 끝난 파일 TAP의 실패는 이름 · 위치를 그대로 두고 파일은 그 시험 파일로 둔다 · 파일마다 요약을 더한다', () => {
  const 깨짐 = 완전보고서("not ok 1 - 잎\n  ---\n  location: 'tests/lib/도우미.js:3:5'\n  ...", { tests: 3, pass: 2, fail: 1 });
  const r = 판정([{ 파일: 'tests/a.test.js', 끝: 끝남, tap: 완전보고서('ok 1 - case', { tests: 3, pass: 3 }) },
    { 파일: 'tests/b.test.js', 끝: { 종료: 1, 신호: null }, tap: 깨짐 }]);
  assert.equal(r.통과함, false); assert.equal(r.시험, 6); assert.equal(r.통과, 5); assert.equal(r.실패수, 1);
  assert.deepEqual(r.실패, [{ 이름: '잎', 위치: 'tests/lib/도우미.js:3', 파일: 'tests/b.test.js' }]);
  assert.equal(r.이유, undefined, 'TAP에 실패가 있으면 덧붙일 까닭이 없다');
  // 이름에 「# TODO」가 든 실제 실패(Node는 \# 로 적는다) — 공통 파서가 이름을 못 뽑아도 TAP에 찍힌 실패라 기록없음이 아니다(4회차 GPT GA1).
  for (const 끝 of [{ 종료: 1, 신호: null }, null]) {
    const 이름만 = 판정([{ 파일: 'tests/t.test.js', 끝, tap: 완전보고서("not ok 1 - failed \\# TODO\n  ---\n  location: 'tests/t.test.js:2:1'\n  ...", { pass: 0, fail: 1 }) }], { 끊김: !끝 });
    assert.equal(이름만.통과함, false); assert.equal(관련.시간만넘김(이름만), false);
    assert.deepEqual(이름만.실패.map((x) => [x.파일, x.기록없음]), [['tests/t.test.js', undefined]], JSON.stringify(이름만.실패));
  }
});

test('몰이판정 — 끊긴 실행은 먼저 끝난 파일의 실패와 돌던 파일 TAP에 찍힌 실패로 막고, 확인한 것이 있으면서 실패가 없으면 시간만 넘김이다', () => {
  const 통과 = { 끝: 끝남, tap: 완전보고서() };
  const 됨 = 판정([통과, { 끝: null, tap: 'TAP version 13\nok 1 - done\n' }, { 안돌림: true }], { 끊김: true });
  assert.equal(됨.시간넘김, true); assert.equal(관련.시간만넘김(됨), true, JSON.stringify(됨));
  assert.deepEqual(됨.못봄, { 돌던중: 1, 안돌림: 1 }); assert.equal(됨.통과, 1, '완료 요약이 없는 파일의 통과 수는 만들어 더하지 않는다');
  assert.equal(됨.이유, '15분 안에 끝나지 않았다 · 끝까지 못 본 파일 2개(돌던 중 1 · 안 돌림 1)');
  // 돌던 파일만 있고 그 TAP의 통과 줄이 하나라도 있으면 확인한 것이다. 끝까지 나온 깨끗한 TAP도 같다.
  for (const tap of ['ok 1 - done\n', 완전보고서()]) assert.equal(관련.시간만넘김(판정([{ 끝: null, tap }], { 끊김: true })), true, tap);
  // 확인한 것이 없으면 막는다 — 빈 TAP · 머리만 · 건너뜀 · TODO · 하위 시험 · YAML 안의 결과.
  for (const tap of [null, '', 'TAP version 13\n', '# tests 0\n', 'ok 1 - skip # SKIP\n', 'ok 1 - todo # TODO\n', '  ok 1 - child\n', '  value: |\n    ok 1 - yaml\n']) {
    const r = 판정([{ 끝: null, tap }], { 끊김: true });
    assert.equal(관련.시간만넘김(r), false, String(tap)); assert.equal(r.TAP오류, '한도 안에 확인한 시험 결과가 없다');
  }
  // 이미 찍힌 실패 · 끝까지 나온 TAP의 실패 · 취소 · 먼저 끝난 파일의 깨짐은 막는다.
  for (const 파일들 of [
    [{ 파일: 'tests/a.test.js', 끝: null, tap: "ok 1 - done\nnot ok 2 - 깨짐\n  ---\n  location: 'tests/a.test.js:3:1'\n  ...\n" }],
    [{ 파일: 'tests/a.test.js', 끝: null, tap: 'not ok 1 - name \\# TODO\n' }],
    [{ 파일: 'tests/a.test.js', 끝: null, tap: 완전보고서('ok 1 - case', { pass: 0, fail: 1 }) }],
    [{ 파일: 'tests/a.test.js', 끝: null, tap: 완전보고서('ok 1 - case', { pass: 0, cancelled: 1 }) }],
    [{ 파일: 'tests/a.test.js', 끝: { 종료: 1, 신호: null }, tap: 완전보고서('not ok 1 - suite', { tests: 0, pass: 0, suites: 1 }) }, { 끝: null, tap: 'ok 1 - done\n' }],
  ]) {
    const r = 판정(파일들, { 끊김: true });
    assert.equal(관련.시간만넘김(r), false, JSON.stringify(파일들));
    assert.ok(r.실패.length && r.실패.every((x) => x.파일 === 'tests/a.test.js'), JSON.stringify(r.실패));
  }
  // 완료 요약이 다 나오기 전의 실패 · 취소 단서도 깨짐이다(3회차 GPT GA3).
  for (const 줄 of ['# fail 1', '# cancelled 1']) {
    const r = 판정([통과, { 파일: 'tests/a.test.js', 끝: null, tap: `ok 1 - done\n1..1\n# tests 1\n# pass 0\n${줄}\n` }], { 끊김: true });
    assert.equal(관련.시간만넘김(r), false, 줄); assert.deepEqual(r.실패.map((x) => x.파일), ['tests/a.test.js'], 줄);
  }
  // 돌던 파일 TAP이 LF로 끝나지 않으면 실패가 보였어도 믿을 수 없다 — 진단 도중 · 마지막 duration 줄(3회차 GPT GA4).
  for (const tap of ["ok 1 - done\nnot ok 2 - 깨짐\n  ---\n  location: 'tests/a.test.js:3:1'\n  error: |-\n    펑", 완전보고서().trimEnd()]) {
    const r = 판정([통과, { 파일: 'tests/a.test.js', 끝: null, tap }], { 끊김: true });
    assert.equal(관련.시간만넘김(r), false, tap); assert.match(r.TAP오류, /tests\/a\.test\.js TAP 마지막 줄이 끝나지 않았다/, tap);
  }
  // 돌던 파일의 TAP이 아직 없으면(ENOENT) 못 봄이지만, 읽다 다른 오류가 나면 믿을 수 없다(3회차 GPT GA2).
  assert.equal(관련.시간만넘김(판정([통과, { 끝: null, tap: null }], { 끊김: true })), true);
  const 읽다오류 = 판정([통과, { 파일: 'tests/a.test.js', 끝: null, tap: 읽기오류('EACCES') }], { 끊김: true });
  assert.equal(관련.시간만넘김(읽다오류), false); assert.match(읽다오류.TAP오류, /tests\/a\.test\.js TAP을 읽지 못했다 \(EACCES\)/);
  // 몰이가 멈춰 바깥 한도(ETIMEDOUT)로 끝났어도 시간 넘김이다.
  const 멈춤 = 판정([통과], { 끝: false, 몰이: { status: null, error: { code: 'ETIMEDOUT' } } });
  assert.equal(멈춤.시간넘김, true); assert.equal(관련.시간만넘김(멈춤), true);
});

test('몰이판정 — 장부가 없거나 깨졌거나 몰이가 끝나지 않고 죽었으면 막는다', () => {
  const 하나 = [{ 끝: 끝남, tap: 완전보고서() }];
  for (const [장부글, 까닭] of [[null, /장부가 없다/], ['', /머리 줄이 없다/], ['{"몰이판":1,"수":2}\n', /머리 줄이 없다/], ['{"몰이판":2,"수":1}\n', /머리 줄이 없다/],
    [몰이장부(하나).slice(0, -1), /마지막 줄이 끝나지 않았다/], [`${몰이장부(하나)}{"번호":0\n`, /읽을 수 없는 줄/], [`${몰이장부(하나)}[1]\n`, /읽을 수 없는 줄/],
    ['{"몰이판":1,"수":1}\n{"번호":5,"시작":true}\n', /차례에 맞지 않는다/], ['{"몰이판":1,"수":1}\n{"번호":0,"종료":0}\n', /차례에 맞지 않는다/],
    [`${몰이장부(하나)}{"번호":0,"종료":0}\n`, /차례에 맞지 않는다/], ['{"몰이판":1,"수":1}\n{"번호":0,"시작":true}\n{"번호":0,"시작":true}\n', /차례에 맞지 않는다/],
    // 끝 뒤의 줄 · 끊김 뒤의 끝 아닌 줄(3회차 GPT GA7).
    ['{"몰이판":1,"수":1}\n{"끝":true}\n{"번호":0,"시작":true}\n{"번호":0,"종료":0,"신호":null}\n', /차례에 맞지 않는다/],
    ['{"몰이판":1,"수":1}\n{"번호":0,"시작":true}\n{"끊김":true}\n{"번호":0,"종료":0,"신호":null}\n{"끝":true}\n', /차례에 맞지 않는다/],
    ['{"몰이판":1,"수":1}\n{"번호":0,"시작":true}\n{"끊김":true}\n{"끊김":true}\n{"끝":true}\n', /차례에 맞지 않는다/]]) {
    for (const 몰이 of [{ status: 0 }, { status: null, error: { code: 'ETIMEDOUT' } }]) {
      const r = 판정(하나, { 장부글, 몰이 });
      assert.equal(r.통과함, false, String(장부글)); assert.equal(관련.시간만넘김(r), false, String(장부글)); assert.match(r.TAP오류, 까닭, String(장부글));
    }
  }
  const 죽음 = 판정([{ 끝: 끝남, tap: 완전보고서() }, { 끝: null }], { 끝: false, 몰이: { status: 1, stderr: 'Error: 펑\n    at 어딘가' } });
  assert.equal(죽음.통과함, false); assert.equal(관련.시간만넘김(죽음), false);
  assert.match(죽음.이유, /^관련 시험 몰이가 끝나지 않고 죽었다 \(종료 1: Error: 펑\)/);
  const 끝없음 = 판정(하나, { 끝: false, 몰이: { status: 0 } });
  assert.equal(끝없음.통과함, false); assert.match(끝없음.이유, /몰이가 끝나지 않고 죽었다/);
  const 못띄움 = 판정(하나, { 장부글: null, 몰이: { status: null, error: { code: 'ENOENT' } } });
  assert.equal(못띄움.통과함, false); assert.match(못띄움.이유, /관련 시험 몰이 실행 실패 \(ENOENT\).*장부가 없다/);
});

test('돌리기 — 몰이에 시험 목록 · 개별 한도 · 동시 수를 일 파일로 넘기고, 환경 · 전체 한도 · 걸린 초를 지킨 뒤 임시 폴더를 지운다', (t) => {
  const 긴목록 = Array.from({ length: 700 }, (_, i) => `tests/공백 있는 경로/${'검사대상'.repeat(9)}-${i}.test.js`);
  const { result, calls } = 몰이흉내(t, { 시험: 긴목록, 경과: 895000 });
  assert.equal(calls.length, 1, '몰이 한 번에 모든 파일을 넘긴다 — 명령 길이 한도와 상관없다');
  const [{ command, args, options, 일 }] = calls;
  assert.equal(command, process.execPath); assert.equal(args[0], path.join(__dirname, '..', 'tools', 'lib', '관련시험몰이.cjs'));
  assert.deepEqual(일.시험, 긴목록); assert.deepEqual(일.고정, ['--test', '--test-timeout=120000', '--test-reporter=tap']);
  assert.ok(일.동시 >= 2); assert.equal(일.한도ms, 900000);
  assert.equal(options.timeout, 930000, '몰이가 멈추면 30초 뒤 끝낸다');
  assert.equal(options.env.CI, '1'); assert.equal(options.env.SYNK_새파일, '["tests/new.test.js"]'); assert.equal(options.env.NODE_TEST_CONTEXT, undefined);
  assert.equal(result.통과함, true, JSON.stringify(result).slice(0, 300)); assert.equal(result.시험, 700); assert.equal(result.초, 895, '걸린 초는 단조 시계로 센다');
  assert.ok(!fs.existsSync(일.폴더), '임시 폴더를 지운다');
  assert.equal(몰이흉내(t, { 한도ms: 0 }).calls[0].options.timeout, 0, '한도 0은 전체 제한 없이 돈다');
  const 없음 = 몰이흉내(t, { 응답: () => ({ 장부: null, tap: () => null, 결과: { status: 2, stderr: '펑' } }) }).result;
  assert.equal(없음.통과함, false); assert.match(없음.TAP오류, /장부가 없다/);
});

test('몰이 — 동시 수만큼 띄우고, 한도에 끊김을 먼저 적은 뒤 SIGKILL하며 그 뒤에 끝난 것은 적지 않는다 · 한도 0은 끊지 않는다 · 띄우기 오류를 적는다', async (t) => {
  const { 몰기, 자식명령 } = require('../tools/lib/관련시험몰이.cjs');
  const { EventEmitter } = require('node:events');
  const 장부 = (폴더) => fs.readFileSync(path.join(폴더, '장부.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const 새폴더 = () => { const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-몰이-')); t.after(() => 지우기(폴더)); return 폴더; };
  const 고정 = ['--test', '--test-timeout=120000', '--test-reporter=tap'], 시험 = ['tests/a.test.js', 'tests/b.test.js', 'tests/c.test.js'];
  const 띄움 = [];
  const 가짜 = () => { const c = new EventEmitter(); c.죽임 = []; c.kill = (s) => { c.죽임.push(s); setImmediate(() => c.emit('close', 1, null)); return true; }; 띄움.push(c); return c; };
  const 일 = { 시험, 동시: 2, 한도ms: 300, 폴더: 새폴더(), 고정 };
  const 끝 = 몰기(일, { 띄우기: 가짜, 끝기다림ms: 1000 });
  assert.equal(띄움.length, 2, '동시 수만큼만 띄운다');
  띄움[0].emit('close', 0, null);
  assert.equal(띄움.length, 3, '하나가 끝나면 다음을 띄운다');
  await 끝;
  assert.deepEqual(장부(일.폴더), [{ 몰이판: 1, 수: 3 }, { 번호: 0, 시작: true }, { 번호: 1, 시작: true }, { 번호: 0, 종료: 0, 신호: null }, { 번호: 2, 시작: true }, { 끊김: true }, { 끝: true }]);
  assert.deepEqual(띄움.map((c) => c.죽임), [[], ['SIGKILL'], ['SIGKILL']]);
  assert.deepEqual(자식명령(일, 1), [...고정, `--test-reporter-destination=${path.join(일.폴더, '1.tap')}`, 'tests/b.test.js'], '개별 한도는 시험 파일보다 앞이다');
  const 영 = { 시험, 동시: 2, 한도ms: 0, 폴더: 새폴더(), 고정 };
  await 몰기(영, { 띄우기: () => { const c = new EventEmitter(); c.kill = () => assert.fail('한도 0은 끊지 않는다'); setTimeout(() => c.emit('close', 0, null), 20); return c; } });
  assert.ok(!장부(영.폴더).some((x) => x.끊김)); assert.equal(장부(영.폴더).filter((x) => x.종료 === 0).length, 3);
  const 오류 = { 시험: 시험.slice(0, 2), 동시: 2, 한도ms: 0, 폴더: 새폴더(), 고정 };
  let 번째 = 0;
  await 몰기(오류, { 띄우기: () => {
    if (번째++ === 0) throw Object.assign(new Error('못 띄움'), { code: 'EACCES' });
    const c = new EventEmitter(); setImmediate(() => { c.emit('error', Object.assign(new Error('없음'), { code: 'ENOENT' })); c.emit('close', -2, null); }); return c;
  } });
  assert.deepEqual(장부(오류.폴더).filter((x) => x.오류).map((x) => [x.번호, x.오류]), [[0, 'EACCES'], [1, 'ENOENT']]);
});

test('실제 Node의 다중행 TODO·중첩·TODO 조상과 실제 실패를 함께 판정한다', t => {
  const payload = 'first\nnot ok 1 - example\nok 2 - fake\n# Subtest: text\n---\n...\n  ...\n1..9';
  const throwing = `()=>{throw Error(${JSON.stringify(payload)});}`;
  const cases = {
    todo: [`test('todo',{todo:true},${throwing});`, 0],
    nested_todo: [`describe('suite',()=>{test('todo',{todo:true},${throwing});});`, 0],
    child_todo: [`test('parent',async t=>{await t.test('todo',{todo:true},${throwing});});`, 0],
    todo_parent: [`test('parent',{todo:true},async t=>{await t.test('child',${throwing});});`, 0],
    todo_describe: [`describe.todo('parent',()=>{test('child',${throwing});});`, 0],
    todo_throwing_describe: [`describe.todo('parent',${throwing});`, 0],
    actual_failure: [`test('failed',${throwing});`, 1],
    nested_failure: [`test('parent',async t=>{await t.test('failed',${throwing});});`, 1],
  };
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tap-diagnostic-')); t.after(() => 지우기(folder));
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  t.diagnostic(`실제 Node ${process.version}에서 진단 자료와 TODO 조상을 확인한다.`);
  for (const [name, [body, status]] of Object.entries(cases)) {
    const file = name + '.cjs'; fs.writeFileSync(path.join(folder, file), "const {test,describe}=require('node:test');\n" + body);
    const actual = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(folder, file)], { env, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(actual.status, status, `${name}: ${actual.stderr}`);
    const report = 관련.보고서판정(actual.stdout);
    assert.equal(report.상태, '완료', `${name}: ${actual.stdout}`);
    if (status === 0) { assert.equal(report.요약.실패수, 0, name); assert.equal(report.요약.취소, 0, name); assert.equal(report.본실패, 0, name); }
    else assert.ok(report.본실패 > 0, name);
    const result = 관련.돌리기({ root: folder, 시험: [file], 자리: false });
    assert.equal(result.통과함, status === 0, `${name}: ${JSON.stringify(result)}`);
    if (status === 0) assert.equal(result.실패.length, 0, name);
  }
});

test('돌리기 — 실제 시간 초과 전에 확인한 시험 결과가 없으면 검증 미확인으로 막는다', (t) => {
  const root = 저장소(t, {
    'tests/느림.test.js': "require('node:test')('오래 걸림', () => new Promise((r) => setTimeout(r, 20000)));\n",
  });
  const r = 관련.돌리기({ root, 시험: ['tests/느림.test.js'], 한도ms: 2000 });
  assert.equal(r.통과함, false);
  assert.equal(r.시간넘김, true);
  assert.match(r.이유, /^2초 안에 끝나지 않았다/);
  assert.equal(관련.시간만넘김(r), false);
  assert.equal(관련.시간만넘김({ ...r, 실패: [{ 이름: '먼저 깨짐', 위치: 'tests/느림.test.js:2', 파일: 'tests/느림.test.js' }] }), false, '끊기기 전에 깨진 것이 있으면 막는다');
  assert.equal(관련.시간만넘김({ 통과함: false, 실패: [], 이유: 'node --test 종료 1' }), false, '시간 말고 다른 까닭은 그대로 깨짐');
  assert.equal(관련.시간만넘김(null), false);
});

// 한 실행기로 나란히 돌리면 Node는 시험 파일을 이름순으로만 TAP에 내, 1느림이 끝나기 전에는 뒤 파일의 결과가 TAP에 없었다(11-26 재현).
// 이제 파일마다 따로 돌린다(tools/lib/관련시험몰이.cjs). 아래 재현은 모두 실제 Node로 끊는다.
const 끊김파일 = {
  'tests/1느림.test.js': "const { test } = require('node:test');\ntest('먼저 끝남', () => {});\ntest('오래 걸림', () => new Promise((r) => setTimeout(r, 60000)));\n",
  'tests/1깨지고느림.test.js': "const { test } = require('node:test'); const assert = require('node:assert');\ntest('먼저 깨짐', () => { assert.equal(1, 2); });\ntest('오래 걸림', () => new Promise((r) => setTimeout(r, 60000)));\n",
  'tests/2깨짐.test.js': "const { test } = require('node:test'); const assert = require('node:assert');\ntest('뒤에서 깨짐', () => { assert.equal(1, 2); });\n",
  'tests/2됨.test.js': "require('node:test')('뒤에서 됨', () => {});\n",
  // 파일 맨 위 after()가 던지는 꼴 넷(1회차 GPT GA1) — 맨 위 · ESM 별칭 async · 도우미 모듈이 등록 · 콜백.
  'tests/2훅.test.js': "const { test, after } = require('node:test');\ntest('뒤 통과', () => {});\nafter(() => { throw new Error('맨 위 after 실패'); });\n",
  'tests/2훅별칭.test.mjs': "import { test, after as 끝 } from 'node:test';\ntest('뒤 통과', () => {});\n끝(async () => { throw new Error('별칭 after 실패'); });\n",
  'tests/2훅도우미.test.js': "require('./lib/정리.js');\nrequire('node:test')('뒤 통과', () => {});\n",
  'tests/lib/정리.js': "require('node:test').after(() => { throw new Error('도우미 after 실패'); });\n",
  'tests/2훅콜백.test.js': "const { test, after } = require('node:test');\ntest('뒤 통과', () => {});\nafter((t, done) => { done(new Error('콜백 after 실패')); });\n",
  // 2회차 GPT 지적의 꼴 — 도우미가 등록한 시험(GA1), exit 리스너가 종료 코드를 0으로 되돌림(GA3), TODO가 종료 코드 1을 남김(GA4),
  // 같은 도우미 줄에서 등록한 이름이 같은 잎(GA5 · GA6).
  'tests/2도우미깨짐.test.js': "require('./lib/깨는도우미.js');\n",
  'tests/lib/깨는도우미.js': "require('node:test')('도우미가 등록한 시험', () => { throw new Error('도우미 실패'); });\n",
  'tests/2훅되돌림.test.js': "const { test, after } = require('node:test');\ntest('뒤 통과', () => {});\nafter(() => { throw new Error('맨 위 after 실패'); });\nprocess.on('exit', () => { process.exitCode = 0; });\n",
  'tests/2할일종료.test.js': "const { test } = require('node:test');\ntest('할일', { todo: true }, () => { process.exitCode = 1; throw new Error('할일'); });\n",
  'tests/2같은줄.test.js': "const { describe, test } = require('node:test');\nconst 같음 = () => test('same', () => { throw new Error('같음'); });\ndescribe('list', 같음);\ndescribe('delete', 같음);\n",
  // 대조군: 맨 위 after()는 통과하고 TODO 시험이 던진다 — 실패가 아니다.
  'tests/2됨훅.test.js': "const { test, after } = require('node:test');\ntest('뒤 통과', () => {});\ntest('할일', { todo: true }, () => { throw new Error('할일'); });\nafter(() => {});\n",
};
/** 한도에 끊어 돌린다. 바쁜 PC에서는 한도 안에 시험이 하나도 안 끝날 수 있어, 그때만 한도를 늘려 다시 돈다. */
function 끊어돌리기(root, 시험, 다됨) {
  let r;
  for (const 한도ms of [6000, 15000, 30000]) {
    r = 관련.돌리기({ root, 시험, 한도ms, 자리: false });
    if (다됨(r)) break;
  }
  return r;
}
const 결과봄 = (x) => !/확인한 시험 결과가 없다/.test(x.이유 || '');

test('돌리기 — 한도에 끊겨도 먼저 끝난 뒤 파일의 실패로 막는다', (t) => {
  const root = 저장소(t, 끊김파일);
  const r = 끊어돌리기(root, ['tests/1느림.test.js', 'tests/2깨짐.test.js'], (x) => x.실패.some((f) => f.위치 === 'tests/2깨짐.test.js:2'));
  assert.equal(r.시간넘김, true, JSON.stringify(r));
  assert.equal(관련.시간만넘김(r), false, JSON.stringify(r));
  assert.deepEqual(r.실패.map((f) => [f.이름, f.위치, f.파일]), [['뒤에서 깨짐', 'tests/2깨짐.test.js:2', 'tests/2깨짐.test.js']]);
  assert.match(r.이유, /^6초 안에 끝나지 않았다|^15초|^30초/);
});

test('돌리기 — 끊긴 때 돌던 파일의 TAP에 이미 찍힌 실패로도 막고, 그 실패의 파일은 그 시험 파일이다', (t) => {
  const root = 저장소(t, 끊김파일);
  const r = 끊어돌리기(root, ['tests/1깨지고느림.test.js', 'tests/2됨.test.js'], (x) => x.실패.length > 0);
  assert.equal(r.시간넘김, true, JSON.stringify(r));
  assert.equal(관련.시간만넘김(r), false, JSON.stringify(r));
  assert.ok(r.실패.some((f) => f.이름 === '먼저 깨짐' && f.파일 === 'tests/1깨지고느림.test.js'), JSON.stringify(r.실패));
});

test('돌리기 — 끊긴 뒤 파일의 파일 맨 위 after() 실패도 막는다(네 꼴 · 1회차 GPT GA1)', (t) => {
  const root = 저장소(t, 끊김파일);
  const 훅들 = ['tests/2훅.test.js', 'tests/2훅별칭.test.mjs', 'tests/2훅도우미.test.js', 'tests/2훅콜백.test.js'];
  const r = 끊어돌리기(root, ['tests/1느림.test.js', ...훅들], (x) => 훅들.every((f) => x.실패.some((y) => y.파일 === f)));
  assert.equal(r.시간넘김, true, JSON.stringify(r));
  assert.equal(관련.시간만넘김(r), false, JSON.stringify(r));
  for (const f of 훅들) assert.ok(r.실패.some((y) => y.파일 === f), `${f}: ${JSON.stringify(r.실패)}`);
});

test('돌리기 — 도우미가 등록한 시험의 실패도 그 시험 파일의 실패다(2회차 GPT GA1)', (t) => {
  const root = 저장소(t, 끊김파일);
  const r = 끊어돌리기(root, ['tests/1느림.test.js', 'tests/2도우미깨짐.test.js'], (x) => x.실패.length > 0);
  assert.equal(관련.시간만넘김(r), false, JSON.stringify(r));
  assert.ok(r.실패.some((f) => f.이름 === '도우미가 등록한 시험'), JSON.stringify(r.실패));
  assert.ok(r.실패.every((f) => f.파일 === 'tests/2도우미깨짐.test.js'), JSON.stringify(r.실패));
});

test('돌리기 — exit 리스너가 종료 코드를 0으로 되돌려도 파일 맨 위 after() 실패로 막는다(2회차 GPT GA3)', (t) => {
  const root = 저장소(t, 끊김파일);
  const r = 끊어돌리기(root, ['tests/1느림.test.js', 'tests/2훅되돌림.test.js'], (x) => x.실패.length > 0);
  assert.equal(r.시간넘김, true, JSON.stringify(r));
  assert.equal(관련.시간만넘김(r), false, JSON.stringify(r));
  assert.ok(r.실패.some((f) => f.파일 === 'tests/2훅되돌림.test.js'), JSON.stringify(r.실패));
});

test('돌리기 — 끝까지 돈 실행은 그 파일을 Node로 돌린 판정과 같다(이름이 <root>인 expectFailure 시험 · 2회차 GPT GA3)', (t) => {
  const root = 저장소(t, { 'tests/뿌리이름.test.js': "require('node:test')('<root>', { expectFailure: true }, () => { throw new Error('예상한 실패'); });\n" });
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const 직접 = spawnSync(process.execPath, ['--test', 'tests/뿌리이름.test.js'], { cwd: root, env, windowsHide: true, timeout: 60e3 });
  const r = 관련.돌리기({ root, 시험: ['tests/뿌리이름.test.js'], 자리: false });
  assert.equal(r.통과함, 직접.status === 0, `${process.version} 직접 종료 ${직접.status}: ${JSON.stringify(r)}`);
});

test('돌리기 — 실패 없이 한도에 끊기면 지금처럼 시간만 넘김이다(TODO가 종료 코드 1을 남긴 파일 · 2회차 GPT GA4 · 대조군)', (t) => {
  const root = 저장소(t, 끊김파일);
  const r = 끊어돌리기(root, ['tests/1느림.test.js', 'tests/2됨.test.js', 'tests/2됨훅.test.js', 'tests/2할일종료.test.js'], 결과봄);
  assert.equal(r.시간넘김, true, JSON.stringify(r));
  assert.equal(관련.시간만넘김(r), true, JSON.stringify(r));
  assert.deepEqual(r.실패, []);
});

test('돌리기 — 같은 도우미 줄에서 등록한 이름이 같은 잎이 둘 다 깨지면 둘 다 목록에 둔다(2회차 GPT GA5 · GA6)', (t) => {
  const root = 저장소(t, 끊김파일);
  const r = 끊어돌리기(root, ['tests/1느림.test.js', 'tests/2같은줄.test.js'], (x) => x.실패.length >= 2);
  assert.equal(관련.시간만넘김(r), false, JSON.stringify(r));
  assert.deepEqual(r.실패.map((f) => f.이름).sort(), ['delete › same', 'list › same'], JSON.stringify(r.실패));
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

test('git 무늬 — `.`·`dir/.`·`dir/`은 그 폴더 전부, 저장소 맨 위의 `.`은 전부(아르곤 10-22 재확인 P2)', () => {
  const root = path.join(os.tmpdir(), '가상저장소');
  const 무늬 = (args, cwd = root) => 관련.git무늬({ command: 'git', args, cwd }, root);
  assert.deepEqual(무늬(['ls-files', '--', '.']), ['*']);
  assert.deepEqual(무늬(['ls-files', '.'], path.join(root, 'tests')), ['tests']);
  assert.deepEqual(무늬(['ls-files', '--', 'docs/']), ['docs']);
  assert.equal(관련.git무늬식(무늬(['ls-files', '.'], path.join(root, 'tests'))[0]).test('tests/a.test.js'), true);
});

test('불러오는파일 — 지도에 없는 시험이 require·import로 닿는 저장소 모듈을 끝까지 따라간다 · 도구 글의 경로 목록·문서·node_modules는 뺀다(10-31)', (t) => {
  const root = 저장소(t, {
    'tests/새.test.js': [
      "const a = require('../tools/a.js');",
      "const b = require(\"../tools/b\"); // 끝을 안 적어도 Node처럼 찾는다",
      "const c = require(path.join(__dirname, '..', 'tools', 'c.js'));",
      "const 도구경로 = path.join(REPO, 'tools', 'lib', 'd.cjs');",
      "spawnSync(process.execPath, ['tools/e.js']);",
      "const 값 = require('../tools/값.json');",
      "const 폴더 = require('../tools/폴더');",
      "const 글 = fs.readFileSync(path.join(REPO, 'docs', '트랙.md'), 'utf8');",
      "require('../node_modules/x/index.js');",
    ].join('\n'),
    'tests/esm.test.mjs': "import { f } from '../tools/f.mjs';\nexport * from './g.mjs';\nconst h = await import('../tools/h.mjs');\n",
    'tests/g.mjs': '',
    'tools/a.js': "const a2 = require('./lib/a2.js');\nfunction 늦게() { return require('./늦은.js'); }\n",
    // 도구 글의 경로 목록 · path.join 조각 · 감싼 require는 따라가지 않는다(짝검사 표처럼 대개 자료다)
    'tools/lib/a2.js': "require('../a.js'); // 돌아 들어와도 한 번\nconst 목록 = ['tools/목록.js', path.join(ROOT, 'tools', '목록2.js')];\n있으면('../목록3.js');\n",
    'tools/늦은.js': '', 'tools/b.js': '', 'tools/c.js': '', 'tools/lib/d.cjs': '', 'tools/e.js': '', 'tools/값.json': '{}',
    'tools/폴더/index.js': '', 'tools/f.mjs': "import '../tools/a.js';\n", 'tools/h.mjs': '',
    'tools/목록.js': '', 'tools/목록2.js': '', 'tools/목록3.js': '', 'tools/무관.js': '',
    'docs/트랙.md': '', 'node_modules/x/index.js': '',
  });
  const 정렬 = (s) => [...s].sort();
  assert.deepEqual(정렬(관련.불러오는파일(root, 'tests/새.test.js')), [
    'tests/새.test.js', 'tools/a.js', 'tools/b.js', 'tools/c.js', 'tools/e.js', 'tools/lib/a2.js', 'tools/lib/d.cjs', 'tools/값.json', 'tools/늦은.js', 'tools/폴더/index.js',
  ].sort());
  assert.deepEqual(정렬(관련.불러오는파일(root, 'tests/esm.test.mjs')),
    ['tests/esm.test.mjs', 'tests/g.mjs', 'tools/a.js', 'tools/f.mjs', 'tools/h.mjs', 'tools/lib/a2.js', 'tools/늦은.js'].sort());
  assert.equal(관련.불러오는파일(root, 'tests/새.test.js', { 한도: 3 }), null, '한도를 넘으면 모른다(읽는다고 본다)');
  assert.deepEqual(정렬(관련.불러오는파일(root, 'tests/없는.test.js')), ['tests/없는.test.js'], '파일이 없으면 그 시험만');
});

// ── 자리(한 PC에서 동시에 도는 push 전 관련 시험 수, 10-22) ─────────────────────────────────────

const 자리폴더 = (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-관련시험-자리-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  return 폴더;
};
const 표들 = (폴더) => fs.readdirSync(폴더).filter((f) => f.endsWith('.lock')).sort();
const 표이름 = (ms, pid) => `${String(ms).padStart(15, '0')}-${pid}-시험.lock`.replace('시험', 'aa11');

test('자리 — 수만큼만 잡히고, 기다림이 지나면 자리 없이 돈다(막지 않는다) · 기다리는 쪽은 표를 안 둔다 · 놓으면 다음이 바로 잡는다 · 놓기는 제 표만 지운다', (t) => {
  const 폴더 = 자리폴더(t);
  const 가 = 관련.자리잡기(폴더, { 수: 2 });
  const 나 = 관련.자리잡기(폴더, { 수: 2 });
  assert.deepEqual([가.번호, 나.번호], [0, 1]);
  assert.equal(표들(폴더).length, 2);
  const 앞 = Date.now();
  const 다 = 관련.자리잡기(폴더, { 수: 2, 기다림ms: 300, 간격ms: 50 });
  assert.equal(다.번호, null, '두 자리를 살아 있는 주인(이 프로세스)이 쥐었다');
  assert.ok(Date.now() - 앞 >= 300, '기다림만큼은 기다렸다');
  assert.equal(표들(폴더).length, 2, '기다리는 쪽은 표를 두지 않는다');
  가.놓기();
  const 라 = 관련.자리잡기(폴더, { 수: 2, 기다림ms: 1000, 간격ms: 50 });
  assert.equal(라.번호, 1, '먼저 쥔 나 하나 다음이다');
  assert.equal(라.기다린초, 0);
  나.놓기(); 라.놓기(); 다.놓기();
  assert.deepEqual(표들(폴더), []);

  const 마 = 관련.자리잡기(폴더, { 수: 1 });
  const 남 = 표이름(Date.now() + 1000, process.pid);
  fs.writeFileSync(path.join(폴더, 남), '');
  마.놓기();
  assert.deepEqual(표들(폴더), [남], '놓기는 제 이름의 표만 지운다');
});

test('자리 — 주인이 없거나 30분 넘게 그대로인 표는 치우고, 그 이름의 표만 지운다(새로 뽑은 남의 표는 안 지운다 · 아르곤 10-22 P1)', (t) => {
  const 폴더 = 자리폴더(t);
  const 죽은pid = spawnSync(process.execPath, ['-e', '']).pid;
  const 죽은표 = 표이름(Date.now() - 5000, 죽은pid);
  fs.writeFileSync(path.join(폴더, 죽은표), '');
  const 가 = 관련.자리잡기(폴더, { 수: 1, 기다림ms: 500, 간격ms: 50 });
  assert.equal(가.번호, 0, '주인이 없는 앞 표는 치우고 잡는다');
  assert.ok(!표들(폴더).includes(죽은표));
  가.놓기();

  const 멈춘표 = 표이름(Date.now() - 3600e3, process.pid);
  fs.writeFileSync(path.join(폴더, 멈춘표), '');
  const 옛 = (Date.now() - 3600e3) / 1000;
  fs.utimesSync(path.join(폴더, 멈춘표), 옛, 옛);
  const 나 = 관련.자리잡기(폴더, { 수: 1, 기다림ms: 500, 간격ms: 50 });
  assert.equal(나.번호, 0, '30분 넘게 그대로인 표는 주인이 살아 있어도 멈춘 것으로 본다');
  나.놓기();

  // 같은 pid로 다시 뽑은 새 표는 이름(뽑은 시각)이 달라 옛 표를 치울 때 같이 지워지지 않는다
  const 새표 = 표이름(Date.now(), process.pid);
  fs.writeFileSync(path.join(폴더, 새표), '');
  const 다 = 관련.자리잡기(폴더, { 수: 1, 기다림ms: 200, 간격ms: 50 });
  assert.equal(다.번호, null, '살아 있는 새 표가 자리를 쥐었다');
  assert.deepEqual(표들(폴더), [새표]);
});

test('자리 — 고르다 죽은 프로세스의 전체 잠금(.고르는중)은 10초가 지나면 치우고 잡는다', (t) => {
  const 폴더 = 자리폴더(t);
  const 잠금 = path.join(폴더, '.고르는중');
  fs.mkdirSync(잠금);
  const 옛 = (Date.now() - 60e3) / 1000;
  fs.utimesSync(잠금, 옛, 옛);
  const 앞 = Date.now();
  const 가 = 관련.자리잡기(폴더, { 수: 1, 기다림ms: 2000, 간격ms: 50 });
  assert.equal(가.번호, 0);
  assert.ok(Date.now() - 앞 < 5000, '낡은 전체 잠금에서 오래 기다리지 않았다');
  assert.equal(fs.existsSync(잠금), false, '잡은 뒤에는 전체 잠금을 푼다');
  가.놓기();
});

// 전체 잠금 폴더를 만드는 mkdir만 정해 둔 오류 코드 차례로 실패시킨다(코드가 다 떨어지면 진짜 mkdir). 자리 폴더를 만드는 mkdir는 그대로 둔다.
function 잠금mkdir흉내(t, 코드들) {
  const 진짜 = fs.mkdirSync;
  const 남은 = [...코드들];
  const 본 = { 시도: 0 };
  t.mock.method(fs, 'mkdirSync', (경로, ...나머지) => {
    if (path.basename(String(경로)) !== '.고르는중') return 진짜(경로, ...나머지);
    본.시도++;
    const 코드 = typeof 코드들 === 'string' ? 코드들 : 남은.shift();
    if (!코드) return 진짜(경로, ...나머지);
    throw Object.assign(new Error(`${코드}: 흉내, mkdir '${경로}'`), { code: 코드 });
  });
  return 본;
}

test('자리 — 전체 잠금 mkdir가 잠깐 EPERM · EACCES · EBUSY를 내도(Windows의 막 지워지는 폴더 자리) 죽지 않고 다시 해서 잡는다', (t) => {
  const 폴더 = 자리폴더(t);
  const 본 = 잠금mkdir흉내(t, ['EPERM', 'EPERM', 'EACCES', 'EBUSY']);
  const 가 = 관련.자리잡기(폴더, { 수: 1, 기다림ms: 2000, 간격ms: 50 });
  assert.equal(가.번호, 0);
  assert.equal(본.시도, 5, '네 번 막힌 뒤 다섯째에 만들었다');
  assert.equal(fs.existsSync(path.join(폴더, '.고르는중')), false, '잡은 뒤에는 전체 잠금을 푼다');
  assert.equal(표들(폴더).length, 1);
  가.놓기();
});

test('자리 — 전체 잠금 mkdir가 한도 내내 권한 오류만 내면(진짜 권한 문제) 끝없이 돌지 않고 그 오류를 던진다 · 다른 오류는 바로 던진다', (t) => {
  const 폴더 = 자리폴더(t);
  const 본 = 잠금mkdir흉내(t, 'EPERM');
  const 앞 = Date.now();
  assert.throws(() => 관련.자리잡기(폴더, { 수: 1, 막힘한도ms: 150 }), (e) => e.code === 'EPERM' && /mkdir/.test(e.message));
  assert.ok(Date.now() - 앞 >= 150, '한도만큼은 다시 해 봤다');
  assert.ok(Date.now() - 앞 < 10e3, '한도를 넘겨 오래 돌지 않았다');
  assert.ok(본.시도 >= 2, `다시 해 본 뒤에 던졌다(${본.시도}번)`); // 바쁜 PC에서 첫 쉼이 한도보다 길면 둘째에서 던진다
  assert.deepEqual(표들(폴더), [], '못 잡았으면 표를 두지 않는다');
  t.mock.restoreAll();

  const 다른 = 잠금mkdir흉내(t, 'ENOSPC');
  assert.throws(() => 관련.자리잡기(폴더, { 수: 1 }), (e) => e.code === 'ENOSPC');
  assert.equal(다른.시도, 1, '다시 할 오류가 아니면 첫 번에 던진다');
});

test('자리 — 권한 오류 사이에 남이 쥔 잠금(EEXIST)이 보이면 연달아 막힌 시간을 처음부터 다시 센다(바쁠 때 한도에 걸려 죽지 않는다)', (t) => {
  const 폴더 = 자리폴더(t);
  // 한 바퀴가 20ms라 열 번을 번갈아 실패하면 200ms — 한도 60ms를 통째로 세면 던졌을 길이다
  const 본 = 잠금mkdir흉내(t, Array.from({ length: 10 }, (_, i) => (i % 2 ? 'EEXIST' : 'EPERM')));
  const 가 = 관련.자리잡기(폴더, { 수: 1, 막힘한도ms: 60 });
  assert.equal(가.번호, 0);
  assert.equal(본.시도, 11);
  가.놓기();
});

test('자리 — 권한 오류를 다시 하는 한도는 단조 시계로 센다(시스템 시각이 앞으로 뛰어도 그 자리에서 던지지 않는다 · GPT 11-19 P2)', (t) => {
  const 폴더 = 자리폴더(t);
  const 본 = 잠금mkdir흉내(t, ['EPERM', 'EPERM']);
  const 진짜now = Date.now;
  // 첫 EPERM 뒤에 시스템 시각이 31초 앞으로 맞춰진 꼴 — 기본 한도 30초를 벽시계로 세면 둘째 EPERM에서 던진다
  t.mock.method(Date, 'now', () => 진짜now() + (본.시도 >= 2 ? 31e3 : 0));
  const 가 = 관련.자리잡기(폴더, { 수: 1 });
  assert.equal(가.번호, 0);
  assert.equal(본.시도, 3, '두 번 막힌 뒤 셋째에 만들었다');
  가.놓기();
});

test('자리 — 여러 프로세스가 같은 때 자리를 고르고 놓기를 되풀이해도 전체 잠금에서 죽는 프로세스가 없다(11-19 EPERM)', async (t) => {
  const 폴더 = 자리폴더(t);
  const 도구 = path.join(__dirname, '..', 'tools', '관련시험.js');
  // 자리 수를 넉넉히 줘 전체 잠금에서만 다툰다. 고치기 전 판은 Windows에서 여섯 번 가운데 네 번 한 프로세스 이상이 EPERM으로 끝났다.
  const 끝 = await Promise.all(Array.from({ length: 6 }, () => new Promise((resolve) => {
    const 자식 = spawn(process.execPath, ['-e', `
      const 관련 = require(${JSON.stringify(도구)});
      for (let i = 0; i < 200; i++) 관련.자리잡기(${JSON.stringify(폴더)}, { 수: 99 }).놓기();
    `], { stdio: ['ignore', 'ignore', 'pipe'] });
    let 글 = '';
    자식.stderr.on('data', (d) => { 글 += d; });
    자식.on('exit', (코드) => resolve(코드 === 0 ? '됨' : (글.match(/E[A-Z]+: [^\n]*/) || [글.slice(0, 300)])[0]));
    t.after(() => { try { 자식.kill(); } catch { /* 이미 끝남 */ } });
  })));
  assert.deepEqual(끝, Array(6).fill('됨'));
  assert.deepEqual(표들(폴더), []);
  assert.equal(fs.existsSync(path.join(폴더, '.고르는중')), false);
});

test('자리 — 다른 프로세스가 쥔 자리는 놓을 때까지 기다린다', async (t) => {
  const 폴더 = 자리폴더(t);
  const 도구 = path.join(__dirname, '..', 'tools', '관련시험.js');
  const 쥔이 = spawn(process.execPath, ['-e', `
    const 관련 = require(${JSON.stringify(도구)});
    const 자리 = 관련.자리잡기(${JSON.stringify(폴더)}, { 수: 1 });
    console.log('잡음 ' + 자리.번호);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    자리.놓기();
  `], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => { try { 쥔이.kill(); } catch { /* 이미 끝남 */ } });
  await new Promise((resolve, reject) => {
    쥔이.stdout.on('data', (d) => { if (String(d).includes('잡음 0')) resolve(); });
    쥔이.on('exit', () => reject(new Error('자리를 잡기 전에 끝났다')));
  });
  const 앞 = Date.now();
  const 내 = 관련.자리잡기(폴더, { 수: 1, 간격ms: 100 });
  assert.equal(내.번호, 0);
  assert.ok(Date.now() - 앞 >= 800, '쥔이가 놓을 때까지 기다렸다');
  내.놓기();
  assert.deepEqual(표들(폴더), []);
});

test('돌리기 — 공용 git 폴더에서 자리를 잡고 돌고 놓는다 · 결과에 자리 · 기다림 0은 바로 자리 없이 · 끄기 · 자리글', (t) => {
  const root = 저장소(t, { 'tests/됨.test.js': "require('node:test')('됨', () => {});\n" });
  const 자리곳 = path.join(root, '.git', 'synk-관련시험', '자리');
  const r = 관련.돌리기({ root, 시험: ['tests/됨.test.js'] });
  assert.equal(r.통과함, true, JSON.stringify(r));
  assert.deepEqual(r.자리, { 번호: 0, 수: 2, 기다린초: 0 });
  assert.deepEqual(표들(자리곳), [], '돌고 나면 자리를 놓는다');

  // 기다림 0을 주면 기본 30분으로 바뀌지 않고 그 값 그대로다(아르곤 10-22 P2)
  const 쥠 = 관련.자리잡기(자리곳, { 수: 1 });
  const 앞 = Date.now();
  const 바로 = 관련.돌리기({ root, 시험: ['tests/됨.test.js'], 자리: { 수: 1, 기다림ms: 0 } });
  assert.equal(바로.자리.번호, null);
  assert.ok(Date.now() - 앞 < 60e3, '30분을 기다리지 않았다');
  쥠.놓기();

  assert.equal(관련.돌리기({ root, 시험: ['tests/됨.test.js'], 자리: false }).자리, undefined);
  process.env.SYNK_관련시험_자리 = '끔';
  try { assert.equal(관련.돌리기({ root, 시험: ['tests/됨.test.js'] }).자리, undefined); } finally { delete process.env.SYNK_관련시험_자리; }
  assert.equal(관련.자리글({ 번호: 0, 수: 2, 기다린초: 0 }), '');
  assert.equal(관련.자리글({ 번호: 1, 수: 2, 기다린초: 5 }), ' · 자리 기다림 5초');
  assert.match(관련.자리글({ 번호: null, 수: 2, 기다린초: 1800 }), /자리 2개가 1800초 동안 안 비어 자리 없이 돌았다/);
  assert.equal(관련.자리글(undefined), '');
});

// ── 일꾼 서버(11-26) — 일꾼.실행은 가짜로 주고, 이 PC 판은 임시 저장소에서 실제로 돈다 ─────────────
/** 파일 하나의 TAP — 결과마다 [이름, 됨, 건너뜀?]. */
const 일꾼TAP = (결과들) => ['TAP version 13', ...결과들.map(([이름, 됨, 건너뜀], i) => `${됨 ? 'ok' : 'not ok'} ${i + 1} - ${이름}${건너뜀 ? ' # SKIP 서버에 없다' : ''}`), `1..${결과들.length}`,
  `# tests ${결과들.length}`, '# suites 0', `# pass ${결과들.filter((x) => x[1] && !x[2]).length}`, `# fail ${결과들.filter((x) => !x[1]).length}`,
  '# cancelled 0', `# skipped ${결과들.filter((x) => x[2]).length}`, '# todo 0', '# duration_ms 1', ''].join('\n');
/** 서버 몰이의 답(tools/일꾼시험.js 응답읽기가 돌려주는 꼴) — 파일마다 [TAP, 종료 코드]. 끊김이면 마지막 파일은 돌던 중이다. */
function 일꾼답(파일들, { 끊김 = false, 초 = 1, 몰이 = { status: 0, signal: null }, 환경 = [] } = {}) {
  const 줄 = [{ 몰이판: 1, 수: 파일들.length }], taps = {};
  파일들.forEach(([tap, 종료], i) => {
    줄.push({ 번호: i, 시작: true });
    if (tap !== null) taps[String(i)] = tap;
    if (!(끊김 && i === 파일들.length - 1)) 줄.push({ 번호: i, 종료, 신호: null });
  });
  if (끊김) 줄.push({ 끊김: true });
  줄.push({ 끝: true });
  return { 몰이, 장부글: `${줄.map((x) => JSON.stringify(x)).join('\n')}\n`, taps, 환경, 초 };
}

function 일꾼저장소(t) {
  return 저장소(t, {
    'tests/돕는.js': "module.exports = 1;\n",
    'tests/잇는.test.js': "require('./돕는.js'); require('node:test')('잇는', () => {});\n",
    'tests/됨.test.js': "require('node:test')('됨', () => {});\n",
    'tests/깨짐.test.js': "const { test } = require('node:test'); const assert = require('node:assert');\ntest('일부러 깨짐', () => { assert.equal(1, 2); });\n",
  });
}

test('일꾼 — 일꾼에서 통과하면 그 결과를 쓰고 이 PC에서는 돌지 않는다', (t) => {
  const root = 일꾼저장소(t), 받은 = [];
  // 이 PC에서 돌면 깨지는 시험이다 — 통과함이 참이면 이 PC 판이 돌지 않은 것이다
  const 일꾼 = { 실행: (입력) => { 받은.push(입력); return 일꾼답([[일꾼TAP([['일부러 깨짐', true]]), 0]], { 초: 7 }); } };
  const r = 관련.돌리기({ root, 시험: ['tests/깨짐.test.js'], 새파일: ['tests/깨짐.test.js'], 자리: false, 일꾼 });
  assert.equal(r.통과함, true, JSON.stringify(r));
  assert.deepEqual(r.일꾼, { 결과: '통과', 초: 7 });
  assert.equal(r.초, 7);
  assert.deepEqual(받은.map((x) => [x.시험, x.새파일, x.한도ms]), [[['tests/깨짐.test.js'], ['tests/깨짐.test.js'], 15 * 60e3]]);
});

test('일꾼 — 일꾼에서 깨지면 고른 시험 전부를 이 PC에서 다시 돌려 그 결과를 따른다(통과면 통과 · 깨지면 깨짐)', (t) => {
  const root = 일꾼저장소(t);
  const 깨진일꾼 = { 실행: () => 일꾼답([[일꾼TAP([['리눅스에서만', false]]), 1]], { 초: 3 }) };
  const 됨 = 관련.돌리기({ root, 시험: ['tests/됨.test.js'], 자리: false, 일꾼: 깨진일꾼 });
  assert.equal(됨.통과함, true, JSON.stringify(됨));
  assert.equal(됨.일꾼.결과, '깨짐');
  assert.deepEqual(됨.일꾼.깨진시험, ['리눅스에서만']);
  const 깨짐 = 관련.돌리기({ root, 시험: ['tests/깨짐.test.js'], 자리: false, 일꾼: 깨진일꾼 });
  assert.equal(깨짐.통과함, false);
  assert.deepEqual(깨짐.실패.map((x) => x.이름), ['리눅스에서만', '일부러 깨짐'], '서버 실패도 결과의 실패에 든다(일꾼몰이-4 GA1)');
  assert.equal(깨짐.일꾼.결과, '깨짐');
  assert.equal(깨짐.면제없음, true, '서버에서 실제로 깨졌고 이 PC도 통과하지 못했다 — 시간 넘김 주의 · 미커밋 면제를 쓰지 않는다(일꾼몰이-3 GA1 · GA6 · GA8)');
  assert.match(깨짐.이유, /서버에서 깨진 시험\(리눅스에서만\)을 이 PC가 끝까지 통과로 뒤집지 못했다/);
  assert.equal(됨.면제없음, undefined, '이 PC가 끝까지 통과하면 그 판을 쓴다');
  const 지어낸 = 관련.돌리기({ root, 시험: ['tests/깨짐.test.js'], 자리: false, 일꾼: { 실행: () => 일꾼답([['', 0]]) } });
  assert.equal(지어낸.통과함, false);
  assert.equal(지어낸.면제없음, undefined, 'TAP 없이 지어낸 서버 실패뿐이면 일꾼 이전과 같은 이 PC 판이다');
  // 서버에서 깨끗이 통과한 파일도 이 PC에서 다시 돈다 — 깨진 판의 서버 기록만으로 파일을 가르지 않는다(일꾼몰이-2 설계 다시 보기)
  const 둘 = 관련.돌리기({ root, 시험: ['tests/깨짐.test.js', 'tests/됨.test.js'], 자리: false,
    일꾼: { 실행: () => 일꾼답([[일꾼TAP([['일부러 깨짐', true]]), 0], [일꾼TAP([['됨', false]]), 1]]) } });
  assert.equal(둘.통과함, false, JSON.stringify(둘));
  assert.deepEqual(둘.실패.map((x) => x.이름), ['됨', '일부러 깨짐']);
});

test('일꾼 — 시험이 안 돌았거나(되돌림) 일꾼이 던지거나 시간을 넘기거나 장부 · TAP을 믿을 수 없으면 이 PC에서 돈다', (t) => {
  const root = 일꾼저장소(t);
  const 되돌림 = 관련.돌리기({ root, 시험: ['tests/깨짐.test.js'], 자리: false, 일꾼: { 실행: () => ({ 되돌림: '일꾼 준비 실패 202' }) } });
  assert.equal(되돌림.통과함, false, '이 PC 판이 돌아 깨짐을 잡는다');
  assert.deepEqual(되돌림.일꾼, { 결과: '못 씀', 까닭: '일꾼 준비 실패 202' });
  const 던짐 = 관련.돌리기({ root, 시험: ['tests/됨.test.js'], 자리: false, 일꾼: { 실행: () => { throw new Error('ssh 없음'); } } });
  assert.equal(던짐.통과함, true);
  assert.match(던짐.일꾼.까닭, /ssh 없음/);
  const 중간 = ['TAP version 13', 'ok 1 - 앞 시험', ''].join('\n');
  const 넘김 = 관련.돌리기({ root, 시험: ['tests/깨짐.test.js'], 자리: false, 일꾼: { 실행: () => 일꾼답([[중간, null]], { 끊김: true, 초: 300 }) } });
  assert.equal(넘김.통과함, false, '서버 시간 넘김은 통과로 치지 않고 이 PC 판이 깨짐을 잡는다');
  assert.deepEqual(넘김.실패.map((x) => x.이름), ['일부러 깨짐']);
  assert.equal(넘김.일꾼.결과, '시간 넘김');
  const 됨TAP = 일꾼TAP([['됨', true]]);
  for (const [이름, 답] of [
    ['빈 TAP', 일꾼답([['', 0]])],
    ['TAP이 없음', 일꾼답([[null, 0]])],
    ['장부 머리 수가 다름', { ...일꾼답([[됨TAP, 0]]), 장부글: '{"몰이판":1,"수":2}\n{"번호":0,"시작":true}\n{"번호":0,"종료":0,"신호":null}\n{"끝":true}\n' }],
    ['장부 없음', { ...일꾼답([[됨TAP, 0]]), 장부글: null }],
  ]) {
    const r = 관련.돌리기({ root, 시험: ['tests/됨.test.js'], 자리: false, 일꾼: { 실행: () => 답 } });
    assert.equal(r.통과함, true, `${이름}: 일꾼 통과가 아니다 — 이 PC에서 다시 돌아 통과한다 ${JSON.stringify(r)}`);
    assert.equal(r.일꾼.결과, '깨짐', 이름);
  }
});

test('일꾼으로 — 서버 몰이가 종료 0과 장부 끝 줄로 끝나지 않았으면 판정이 통과여도 통과로 치지 않는다(일꾼몰이 GPT GA1 · GA2)', (t) => {
  const root = 일꾼저장소(t);
  const 됨 = [[일꾼TAP([['됨', true]]), 0]];
  const 끝없는 = (답) => ({ ...답, 장부글: 답.장부글.replace('{"끝":true}\n', '') });
  for (const [이름, 답] of [['종료 137', { ...일꾼답(됨), 몰이: { status: 137, signal: null } }], ['신호', { ...일꾼답(됨), 몰이: { status: null, signal: 'SIGKILL' } }], ['끝 줄 없음', 끝없는(일꾼답(됨))]]) {
    const r = 관련.일꾼으로({ root, 시험: ['tests/됨.test.js'], 새파일: [], 한도ms: 300e3, 일꾼: { 실행: () => 답 } });
    assert.equal(r.통과함, false, 이름);
    assert.match(r.이유, /서버 몰이가 제대로 끝나지 않았다/, 이름);
  }
  // 이 PC에서 돌면 깨지는 파일을 서버가 통과로 적었지만 몰이가 137로 끝났다 — 통과로 치지 않고 이 PC에서 다시 돌아 깨짐을 잡는다
  const r = 관련.돌리기({ root, 시험: ['tests/깨짐.test.js'], 자리: false, 일꾼: { 실행: () => ({ ...일꾼답([[일꾼TAP([['일부러 깨짐', true]]), 0]]), 몰이: { status: 137, signal: null } }) } });
  assert.equal(r.통과함, false, JSON.stringify(r));
  assert.deepEqual(r.실패.map((x) => x.이름), ['일부러 깨짐']);
});

test('일꾼 — 서버에서 통과해도 서버에 없는 준비물(SYNK-talk · 크롬 · 윈도우 · git 밖 자료)에 기대거나 서버에서 건너뛴 시험이 있는 파일은 이 PC에서 한 번 더 돈다(Fable 11-26 A′ · 일꾼몰이 GPT GA3)', (t) => {
  const root = 저장소(t, {
    'tests/형제.test.js': "// ../SYNK-talk가 없으면 건너뛴다\nconst { test } = require('node:test'); const assert = require('node:assert');\ntest('형제 꼴', () => { assert.equal(1, 2); });\n",
    'tests/도우미.js': "module.exports = { 크롬있음: false };\n",
    'tests/도우미씀.test.js': "require('./도우미.js'); require('node:test')('도우미씀', () => {});\n",
    'tests/보통.test.js': "const { test } = require('node:test'); const assert = require('node:assert');\ntest('보통 깨짐', () => { assert.equal(1, 2); });\n",
    'tools/잠금.js': "module.exports = process.platform === 'win32' ? 'win' : 'posix';\n",
    'tests/도구씀.test.js': "require('../tools/잠금.js'); require('node:test')('도구씀', () => {});\n",
    'tools/os갈래.js': "module.exports = require('node:os').platform() === 'win' + '32';\n",
    'tests/os씀.test.js': "require('../tools/os갈래.js'); require('node:test')('os씀', () => {});\n",
  });
  assert.deepEqual(관련.환경시험(root, ['tests/형제.test.js', 'tests/도우미씀.test.js', 'tests/도구씀.test.js', 'tests/os씀.test.js', 'tests/보통.test.js', 'tests/없음.test.js']),
    ['tests/형제.test.js', 'tests/도우미씀.test.js', 'tests/도구씀.test.js', 'tests/os씀.test.js', 'tests/없음.test.js'],
    '파일 글과 그 파일이 불러오는 도우미 · 도구의 글을 보고(도구의 process.platform 갈래 — Fable 설계 검토 일꾼몰이), 못 읽으면 기댄다고 본다');
  const 서버통과 = (결과들) => ({ 실행: () => 일꾼답(결과들.map((x) => [일꾼TAP([x]), 0]), { 초: 5 }) });
  const 깨짐 = 관련.돌리기({ root, 시험: ['tests/형제.test.js', 'tests/보통.test.js'], 자리: false, 일꾼: 서버통과([['형제 꼴', true], ['보통 깨짐', true]]) });
  assert.equal(깨짐.통과함, false, '준비물에 기대는 파일이 이 PC에서 깨지면 깨짐이다');
  assert.deepEqual(깨짐.실패.map((x) => x.이름), ['형제 꼴'], '이 PC에서는 그 파일만 돈다');
  assert.deepEqual([깨짐.일꾼.이PC.파일, 깨짐.일꾼.이PC.결과], [1, '깨짐']);
  const 됨 = 관련.돌리기({ root, 시험: ['tests/도우미씀.test.js', 'tests/보통.test.js'], 자리: false, 일꾼: 서버통과([['도우미씀', true], ['보통 깨짐', true]]) });
  assert.equal(됨.통과함, true, JSON.stringify(됨));
  assert.deepEqual([됨.일꾼.결과, 됨.일꾼.이PC.결과], ['통과', '통과']);
  // 무늬가 없어도 서버가 건너뛴 시험이 있는 파일은 이 PC에서 돈다 — 보통.test.js는 이 PC에서 깨진다
  const 건너뜀 = 관련.돌리기({ root, 시험: ['tests/도우미씀.test.js', 'tests/보통.test.js'], 자리: false, 일꾼: 서버통과([['도우미씀', true], ['보통 깨짐', true, true]]) });
  assert.equal(건너뜀.통과함, false, JSON.stringify(건너뜀));
  assert.deepEqual(건너뜀.실패.map((x) => x.이름), ['보통 깨짐']);
  assert.deepEqual(관련.이PC볼파일(root, ['tests/도우미씀.test.js', 'tests/보통.test.js'], { 건너뛴파일: ['tests/보통.test.js'] }), ['tests/도우미씀.test.js', 'tests/보통.test.js']);
  // 서버가 그 커밋에서 셈한 이 PC 파일도 이 PC에서 돈다(일꾼몰이-5 GA3) — 이 PC 작업본에는 무늬가 없는 보통.test.js
  const 서버셈 = 관련.돌리기({ root, 시험: ['tests/보통.test.js'], 자리: false, 일꾼: { 실행: () => 일꾼답([[일꾼TAP([['보통 깨짐', true]]), 0]], { 환경: ['tests/보통.test.js'] }) } });
  assert.equal(서버셈.통과함, false, JSON.stringify(서버셈));
  assert.deepEqual(서버셈.실패.map((x) => x.이름), ['보통 깨짐']);
});

test('일꾼으로 — 서버 판정도 이 PC와 같은 몰이판정이다: 끊기기 전 깨진 파일은 깨짐 · 시간 넘김 까닭은 서버 한도(일꾼.한도ms)', (t) => {
  const root = 일꾼저장소(t);
  let 받은한도 = null;
  const 넘김 = 관련.일꾼으로({ root, 시험: ['tests/됨.test.js'], 새파일: [], 한도ms: 15 * 60e3,
    일꾼: { 한도ms: 300e3, 실행: ({ 한도ms }) => { 받은한도 = 한도ms; return { 몰이: { status: null, error: { code: 'ETIMEDOUT' } }, 장부글: null, taps: {}, 초: 300 }; } } });
  assert.equal(받은한도, 300e3);
  assert.match(넘김.이유, /5분 안에 끝나지 않았다/);
  assert.equal(넘김.통과함, false);
  // 앞 파일은 깨져 끝났고 뒤 파일은 돌던 중에 끊겼다 — 앞 파일의 실패는 그대로 깨짐이다(11-26 몰이 설계)
  const 끊김 = 관련.일꾼으로({ root, 시험: ['tests/깨짐.test.js', 'tests/됨.test.js'], 새파일: [], 한도ms: 300e3,
    일꾼: { 실행: () => 일꾼답([[일꾼TAP([['일부러 깨짐', false]]), 1], ['TAP version 13\n', null]], { 끊김: true, 초: 300 }) } });
  assert.equal(끊김.통과함, false);
  assert.equal(관련.시간만넘김(끊김), false, '깨진 파일이 보였으니 시간만 넘긴 것이 아니다');
  assert.deepEqual(끊김.실패.map((x) => [x.이름, x.파일]), [['일부러 깨짐', 'tests/깨짐.test.js']]);
});
