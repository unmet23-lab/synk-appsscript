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

test('돌리기 — 넓은 CI와 같은 120초 개별 한도를 Node 실행 인자로 전달한다', (t) => {
  const root = 저장소(t, {
    'desktop/tests/한도.test.cjs': "require('node:test')('개별 한도', () => {});\n",
  });
  // Node가 자식 시험의 execArgv에서는 test-runner 인자를 빼므로 실제 spawn 경계에서 잡고 그대로 실행한다.
  const 파일 = require.resolve('../tools/관련시험.js'), 안require = require('node:module').createRequire(파일), 모듈 = { exports: {} };
  let 실행;
  require('node:vm').runInNewContext(fs.readFileSync(파일, 'utf8'), {
    require: id => id === 'node:child_process' ? { spawnSync: (명령, 인자, 설정) => { 실행 = { 명령, 인자, 설정 }; return spawnSync(명령, 인자, 설정); } } : 안require(id),
    module: 모듈, __dirname: path.dirname(파일), __filename: 파일, process, Buffer, console,
  });
  const r = 모듈.exports.돌리기({ root, 시험: ['desktop/tests/한도.test.cjs'], 자리: false });
  assert.equal(r.통과함, true, JSON.stringify(r));
  assert.equal(r.통과, 1);
  assert.equal(실행.명령, process.execPath);
  assert.equal(실행.인자.filter(a => a.startsWith('--test-timeout=')).join(), '--test-timeout=120000');
  assert.ok(실행.인자.indexOf('--test-timeout=120000') < 실행.인자.indexOf('desktop/tests/한도.test.cjs'));
  assert.equal(실행.설정.timeout, 15 * 60e3, '전체 한도는 그대로다');
});

function 긴목록실행(t, { 응답 = () => ({ status: 0 }), 경과 = 0, 시각보정 = 0, 한도ms = 900000, 시험: 선택시험, 파일당시험수 = 1, staleTap = null } = {}) {
  const root = 저장소(t, {}), calls = [], 파일 = require.resolve('../tools/관련시험.js');
  const 안require = require('node:module').createRequire(파일), 모듈 = { exports: {} };
  const 시험 = 선택시험 || Array.from({ length: 700 }, (_, i) => `tests/공백 있는 경로/${'검사대상'.repeat(9)}-${i}.test.js`);
  let now = 1794690000000, monotonic = 0n;
  require('node:vm').runInNewContext(fs.readFileSync(파일, 'utf8'), {
    require: id => id === 'node:child_process' ? { spawnSync: (command, args, options) => {
      const selected = args.filter(arg => !arg.startsWith('--'));
      calls.push({ command, args: [...args], options, selected });
      const result = 응답(calls.length, selected);
      if (!result.noTap) {
        const fail = result.failed || 0;
        const cases = selected.flatMap(file => Array.from({ length: 파일당시험수 }, (_, i) => `${file} case ${i + 1}`));
        const text = typeof result.tapText === 'string' ? result.tapText : ['TAP version 13', ...cases.map((name, i) => `${i < fail ? 'not ok' : 'ok'} ${i + 1} - ${name}`),
          `1..${cases.length}`, `# tests ${cases.length}`, '# suites 0', `# pass ${cases.length - fail}`, `# fail ${fail}`, '# cancelled 0', '# skipped 0', '# todo 0', '# duration_ms 1'].join('\n');
        fs.writeFileSync(args.find(arg => arg.startsWith('--test-reporter-destination=')).split('=').slice(1).join('='), text);
      }
      const elapsed = typeof 경과 === 'function' ? 경과(calls.length) : 경과;
      now += elapsed + (typeof 시각보정 === 'function' ? 시각보정(calls.length) : 시각보정);
      monotonic += BigInt(elapsed) * 1000000n;
      return result;
    } } : 안require(id),
    module: 모듈, __dirname: path.dirname(파일), __filename: 파일,
    process: { ...process, platform: 'win32', hrtime: { bigint: () => monotonic } }, Buffer, console,
    Date: class extends Date { static now() { return now; } },
  });
  if (staleTap !== null) fs.writeFileSync(path.join(os.tmpdir(), `synk-관련시험-${process.pid}-${now}.tap`), staleTap);
  const result = 모듈.exports.돌리기({ root, 시험, 워크트리: true, 새파일: ['tests/new.test.js'], 자리: false, 한도ms });
  return { result, calls, 시험, 관련: 모듈.exports };
}

// 실제로 인용한 명령 문자열의 UTF-16 길이를 잰다. 제품의 길이 계산 루프를 복제하지 않는다.
const 인용명령길이 = args => args.map(arg => '"' + arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"').join(' ').length;

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

test('프로세스 결과와 미확인·중간·완료 보고서의 조합이 관문과 원인 보존을 결정한다', t => {
  const one = ['tests/one.test.js'];
  for (const response of [{ status: 0, tapText: 'ok 1 - case\n1..1\n# tests 1\n' }, { status: 9, noTap: true }, { status: null, signal: 'SIGKILL', noTap: true }]) {
    const { result, 관련: subject } = 긴목록실행(t, { 시험: one, 응답: () => response });
    assert.equal(result.통과함, false); assert.equal(subject.시간만넘김(result), false);
    if (response.status === 9) assert.match(result.이유, /node --test 종료 9.*TAP/);
    if (response.signal) assert.match(result.이유, /node --test 신호 SIGKILL/);
  }
  for (const code of ['ENOENT', 'EACCES', 'ENOBUFS']) {
    const { result, 관련: subject } = 긴목록실행(t, { 시험: one, 응답: () => ({ status: null, error: { code } }) });
    assert.equal(result.통과함, false); assert.equal(subject.시간만넘김(result), false); assert.match(result.이유, new RegExp(code));
  }
  const unknown = ['', '# tests 0\n', 'ok 1 - skip # SKIP\n', 'ok 1 - todo # TODO\n', '  ok 1 - child\n', '  value: |\n    ok 1 - yaml\n', 'not ok 1 - name \\# TODO\n', 완전보고서('not ok 1 - suite', { tests: 0, pass: 0, suites: 1 }), 완전보고서('ok 1 - case', { pass: 0, fail: 1 }), 완전보고서('ok 1 - case', { pass: 0, cancelled: 1 })];
  for (const tapText of unknown) {
    const { result, 관련: subject } = 긴목록실행(t, { 시험: one, 응답: () => ({ status: null, error: { code: 'ETIMEDOUT' }, tapText }) });
    assert.equal(result.시간넘김, true); assert.equal(subject.시간만넘김(result), false, tapText); assert.ok(result.TAP오류);
  }
  for (const tapText of ['ok 1 - done\n', 완전보고서()]) {
    const { result, 관련: subject } = 긴목록실행(t, { 시험: one, 응답: () => ({ status: null, error: { code: 'ETIMEDOUT' }, tapText }) });
    assert.equal(result.통과함, false); assert.equal(subject.시간만넘김(result), true, tapText);
    assert.equal(result.통과, tapText === 'ok 1 - done\n' ? 0 : 1);
  }
  const stale = 긴목록실행(t, { 시험: one, staleTap: 완전보고서(), 응답: () => ({ status: 0, noTap: true }) });
  assert.equal(stale.result.통과함, false); assert.match(stale.result.TAP오류, /ENOENT/);
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
  for (const tail of ['ok 1 - slow # SK', 'ok 1 - future # TO', 'ok 1 - slow', 'not ok 1 - broken', 'ok 1 - done\r']) {
    for (const batch of [1, 2]) {
      const { result, 관련: subject } = 긴목록실행(t, { 응답: index => index === batch
        ? { status: null, error: { code: 'ETIMEDOUT' }, tapText: 'ok 9 - finished\n' + tail } : { status: 0 } });
      assert.equal(result.통과함, false);
      assert.equal(subject.시간만넘김(result), false, `${batch}: ${tail}`);
      assert.match(result.TAP오류, /마지막 줄이 끝나지 않았다/);
    }
  }
});

test('YAML 진단 안의 결과 문구와 깊은 닫힘은 실제 실패로 세지 않는다', t => {
  const diagnostic = 'not ok 1 - todo # TODO\n  ---\n  error: |-\n    not ok 9 - text\n    ...\n      ...\n    ---\n    ok 8 - text\n    # Subtest: text\n    1..9\n  ...';
  const full = 완전보고서(diagnostic, { pass: 0, todo: 1 });
  const report = 관련.보고서판정(full);
  assert.equal(report.상태, '완료'); assert.equal(report.본실패, 0);
  const good = 긴목록실행(t, { 시험: ['tests/todo.test.js'], 응답: () => ({ status: 0, tapText: full }) });
  assert.equal(good.result.통과함, true); assert.equal(good.result.실패.length, 0);
  const failed = 관련.보고서판정(diagnostic + '\n    not ok 2 - real\n');
  assert.equal(failed.본실패, 1);
  const open = 'ok 1 - finished\nnot ok 2 - todo # TODO\n  ---\n  error: |-\n    not ok 9 - text\n';
  assert.equal(관련.보고서판정(open).본실패, 0);
  assert.notEqual(관련.보고서판정(완전보고서(open)).상태, '완료', '열린 진단 뒤의 계획과 요약을 완료로 세지 않는다');
  const timed = 긴목록실행(t, { 시험: ['tests/fail.test.js'], 응답: () => ({ status: null, error: { code: 'ETIMEDOUT' }, tapText: diagnostic + '\nnot ok 2 - real \\# TODO\n' }) });
  assert.equal(timed.관련.시간만넘김(timed.result), false);
  assert.match(timed.result.TAP오류, /실패 결과 1개/);
});

test('CRLF를 정규화해도 LF 없이 남은 CR 꼬리를 지우지 않는다', t => {
  const full = 완전보고서().replace(/\n/g, '\r\n');
  assert.equal(관련.보고서판정(full).상태, '완료');
  for (let i = 1; i < full.length; i++) if (full[i - 1] === '\r') {
    assert.equal(관련.보고서판정(full.slice(0, i)).상태, '미확인', `CR cut ${i}`);
  }
  for (const tail of ['\r', '\r\r']) for (const batch of [1, 2]) {
    const { result, 관련: subject } = 긴목록실행(t, { 응답: index => index === batch
      ? { status: null, error: { code: 'ETIMEDOUT' }, tapText: 'ok 1 - finished\r\n' + tail } : { status: 0 } });
    assert.equal(subject.시간만넘김(result), false, `${batch}: ${JSON.stringify(tail)}`);
    assert.match(result.TAP오류, /마지막 줄이 끝나지 않았다/);
  }
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

test('Windows 긴 시험 목록은 빠뜨리거나 중복하지 않고 모두 실행하며 환경과 개별 한도를 보존한다', t => {
  const { result, calls, 시험 } = 긴목록실행(t, { 경과: 1500 });
  assert.ok(calls.length > 1, '32,767자를 넘는 명령 하나로 실행하지 않는다');
  assert.deepEqual(calls.flatMap(call => call.selected), 시험);
  for (const [index, call] of calls.entries()) {
    const quotedLength = 인용명령길이([call.command, ...call.args]);
    assert.ok(quotedLength <= 30000, quotedLength);
    assert.ok(call.args.includes('--test-timeout=120000'));
    assert.equal(call.options.timeout, 900000 - 1500 * index, '뒷 묶음은 남은 시간만 쓴다');
    assert.equal(call.options.env.CI, '1');
    assert.equal(call.options.env.SYNK_새파일, '["tests/new.test.js"]');
    assert.equal(call.options.env.NODE_TEST_CONTEXT, undefined);
  }
  assert.equal(result.통과함, true); assert.equal(result.시험, 시험.length); assert.equal(result.통과, 시험.length);
  assert.equal(result.실패수, 0); assert.equal(result.묶음.실행, result.묶음.전체);
});

test('Windows 인용 경계는 짧은 공백 경로와 따옴표 앞·끝의 역슬래시까지 센다', t => {
  // 이스케이프 경계 입력은 spawn 모의 경계까지만 전달하며 실제 Windows 파일로 만들지 않는다.
  const lists = [
    Array.from({ length: 2000 }, (_, i) => `tests/a ${String(i).padStart(4, '0')}.test.js`),
    Array.from({ length: 900 }, (_, i) => `tests/${'\\'.repeat(5)}"공백 ${i}.test.js`),
    Array.from({ length: 1400 }, (_, i) => `tests/끝 공백 ${i}.test.js${'\\'.repeat(8)}`),
  ];
  for (const 시험 of lists) {
    const { result, calls } = 긴목록실행(t, { 시험 });
    assert.equal(result.통과함, true);
    assert.ok(calls.length > 1);
    assert.deepEqual(calls.flatMap(call => call.selected), 시험);
    for (const [index, call] of calls.entries()) {
      assert.ok(인용명령길이([call.command, ...call.args]) <= 30000, '인용한 실제 명령은 여유 한도 안이다');
      const next = calls[index + 1]?.selected[0];
      if (next) assert.ok(인용명령길이([call.command, ...call.args, next]) > 29975, '불필요하게 작은 묶음으로 잘라 경계 검사를 피하지 않는다');
    }
  }
});

test('묶음마다 복수 시험이 있는 TAP을 파일 수로 줄이지 않고 합산한다', t => {
  const { result, calls, 시험 } = 긴목록실행(t, { 파일당시험수: 3, 응답: index => index === 2 ? { status: 1, failed: 2 } : { status: 0 } });
  assert.equal(calls.length, 2);
  const expected = calls.reduce((sum, call) => sum + call.selected.length * 3, 0);
  assert.ok(expected > 시험.length);
  assert.equal(result.시험, expected);
  assert.equal(result.통과, expected - 2);
  assert.equal(result.실패수, 2);
  assert.equal(result.실패.length, 2);
  assert.equal(result.통과함, false);
});

test('정상 종료한 묶음의 TAP 읽기 실패는 앞선 집계만으로 성공 처리하지 않는다', t => {
  for (const unreadableBatch of [1, 2]) {
    const { result, calls, 관련: subject } = 긴목록실행(t, { 응답: index => ({ status: 0, noTap: index === unreadableBatch }) });
    assert.equal(calls.length, unreadableBatch, '집계 실패 뒤에는 다음 묶음을 실행하지 않는다');
    assert.equal(result.통과함, false);
    assert.equal(subject.시간만넘김(result), false);
    assert.match(result.이유, new RegExp(`${unreadableBatch}번 묶음 TAP 읽기 실패.*ENOENT`));
    assert.equal(result.통과, unreadableBatch === 1 ? 0 : calls[0].selected.length, '확인한 앞선 결과만 보존한다');
  }
});

test('정상 종료라도 빈 TAP과 완료 요약이 없는 TAP은 검증 통과로 세지 않는다', t => {
  for (const tapText of ['', 'TAP version 13\n# reporter stopped\n', 'TAP version 13\nok 1 - partial case\n', 'TAP version 13\nok 1 - partial case\n1..1\n# tests 1\n']) {
    for (const missingBatch of [1, 2]) {
      const { result, calls, 관련: subject } = 긴목록실행(t, { 응답: index => index === missingBatch ? { status: 0, tapText } : { status: 0 } });
      assert.equal(result.통과함, false);
      assert.equal(subject.시간만넘김(result), false);
      assert.equal(calls.length, missingBatch);
      assert.match(result.TAP오류, new RegExp(`${missingBatch}번 묶음 TAP`));
      assert.equal(result.묶음.미실행파일, calls.length === 1 ? 700 - calls[0].selected.length : 0);
    }
  }
});

test('긴 목록의 실제 실패와 실행 오류를 뒤 묶음의 결과로 덮지 않는다', t => {
  const failed = 긴목록실행(t, { 응답: () => ({ status: 1, failed: 1 }) });
  assert.equal(failed.calls.length, 1); assert.equal(failed.result.통과함, false); assert.equal(failed.result.실패수, 1);
  assert.equal(failed.관련.시간만넘김(failed.result), false);
  const remaining = failed.시험.length - failed.calls[0].selected.length;
  assert.equal(failed.result.묶음.미실행파일, remaining);
  assert.equal(failed.result.이유, `전체 ${failed.result.묶음.전체}묶음 중 1묶음에서 멈췄다. 남은 ${remaining}개 파일은 실행하지 않았다.`);
  const spawnError = 긴목록실행(t, { 응답: () => ({ status: null, error: { code: 'ENOENT' }, noTap: true }) });
  assert.equal(spawnError.calls.length, 1); assert.equal(spawnError.result.통과함, false);
  assert.match(spawnError.result.이유, /ENOENT/); assert.equal(spawnError.관련.시간만넘김(spawnError.result), false);
});

test('뒤 묶음 시간 초과에 TAP이 없으면 앞의 통과 수는 보존하되 시간만 넘긴 것으로 승인하지 않는다', t => {
  const { result, calls, 관련: subject } = 긴목록실행(t, { 응답: index => index === 1 ? { status: 0 } : { status: null, error: { code: 'ETIMEDOUT' }, noTap: true } });
  assert.equal(calls.length, 2); assert.equal(result.통과함, false); assert.equal(result.시간넘김, true);
  assert.equal(result.통과, calls[0].selected.length); assert.equal(result.시험, calls[0].selected.length); assert.ok(result.시험 < result.묶음.선택파일); assert.equal(subject.시간만넘김(result), false);
  assert.match(result.이유, /15분 안에 끝나지 않았다.*2번 묶음 TAP 읽기 실패.*ENOENT/);
});

test('시간 초과의 빈 TAP은 막고 읽을 수 있는 중간 통과 TAP은 기존 시간 초과 정책을 유지한다', t => {
  for (const tapText of ['', 'TAP version 13\n# reporter started\n']) {
    const { result, 관련: subject } = 긴목록실행(t, { 응답: () => ({ status: null, error: { code: 'ETIMEDOUT' }, tapText }) });
    assert.equal(result.시간넘김, true);
    assert.equal(subject.시간만넘김(result), false);
    assert.match(result.TAP오류, /확인한 시험 결과가 없다/);
  }
  const { result, calls, 관련: subject } = 긴목록실행(t, { 응답: index => index === 1 ? { status: 0 } : { status: null, error: { code: 'ETIMEDOUT' }, tapText: 'TAP version 13\nok 1 - completed before timeout\n' } });
  assert.equal(result.통과함, false);
  assert.equal(result.시간넘김, true);
  assert.equal(result.통과, calls[0].selected.length, '완료 요약이 없는 뒤 묶음의 통과 수는 만들어 더하지 않는다');
  assert.equal(result.TAP오류, undefined);
  assert.equal(subject.시간만넘김(result), true);
  const later = 긴목록실행(t, { 응답: index => index === 1 ? { status: 0 } : { status: null, error: { code: 'ETIMEDOUT' }, tapText: '# tests 0\n' } });
  assert.equal(later.calls.length, 2);
  assert.equal(later.result.통과, later.calls[0].selected.length);
  assert.equal(later.관련.시간만넘김(later.result), false);
  for (const counts of [{ 실패수: 1, 취소: 0 }, { 실패수: 0, 취소: 1 }]) assert.equal(subject.시간만넘김({ 시간넘김: true, 실패: [], ...counts }), false);
});

test('앞 묶음이 전체 시간을 소진하면 남은 묶음을 새 한도로 실행하지 않는다', t => {
  const { result, calls } = 긴목록실행(t, { 경과: 2000, 한도ms: 1000 });
  assert.equal(calls.length, 1); assert.equal(result.통과함, false); assert.equal(result.시간넘김, true);
  assert.ok(result.묶음.실행 < result.묶음.전체);
});

test('시스템 시각이 앞뒤로 보정돼도 실제 경과 시간으로 남은 한도와 실행 시간을 센다', t => {
  for (const correction of [20000, -20000]) {
    const { result, calls } = 긴목록실행(t, {
      경과: index => index === 1 ? 890000 : 5000,
      시각보정: index => index === 1 ? correction : 0,
    });
    assert.equal(calls.length, 2, '시각 보정 때문에 남은 묶음을 건너뛰지 않는다');
    assert.equal(calls[1].options.timeout, 10000, '시각 보정으로 실행 한도를 늘리거나 줄이지 않는다');
    assert.equal(result.통과함, true); assert.equal(result.초, 895);
  }
});

test('한도 0은 기존처럼 전체 제한 없이 실행하며 실제 실패를 시간 초과로 넘기지 않는다', t => {
  const passed = 긴목록실행(t, { 한도ms: 0, 경과: 1000000 });
  assert.ok(passed.calls.length > 1); assert.equal(passed.result.통과함, true);
  assert.ok(passed.calls.every(call => call.options.timeout === 0));
  const failed = 긴목록실행(t, { 한도ms: 0, 응답: () => ({ status: 1, failed: 1 }) });
  assert.equal(failed.calls.length, 1); assert.equal(failed.result.통과함, false); assert.equal(failed.result.실패수, 1);
  assert.equal(failed.관련.시간만넘김(failed.result), false);
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
