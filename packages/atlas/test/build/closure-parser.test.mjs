// 입구 스크립트 읽기의 파서(parse5)를 못 불러오면 제품 흐름 시험이 실패해야 한다 — 정규식으로 물러서거나 건너뛰지 않는다(설계 주인 11-23
// 조건 2). 자식 node에서 parse5 해석만 막는 훅을 걸고 game-closure.mjs를 불러 보고, 그 훅으로 제품 흐름 시험 파일을 돌려 실패를 본다.
// 훅이 없을 때 같은 모듈이 불러와지고, 쓰는 parse5가 이 꾸러미 devDependencies의 잠긴 판(8.0.1)인지도 함께 본다.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { testEnv } from '../../tools/test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLOSURE = pathToFileURL(path.join(ROOT, 'test', 'support', 'game-closure.mjs')).href;
const BLOCK = [
  "import { registerHooks } from 'node:module';",
  'registerHooks({ resolve(specifier, context, next) {',
  "  if (specifier === 'parse5' || specifier.startsWith('parse5/')) {",
  "    const error = new Error('parse5 해석 막음(시험)'); error.code = 'ERR_MODULE_NOT_FOUND'; throw error;",
  '  }',
  '  return next(specifier, context);',
  '} });',
].join('\n');
const run = args =>
  spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: testEnv(),
    encoding: 'utf8',
    timeout: 120_000,
  });

test('parse5를 못 불러오면 입구 읽기 모듈이 실패한다 — 물러서지 않는다', () => {
  const blocked = run([
    '--input-type=module',
    '-e',
    `${BLOCK}\nawait import(${JSON.stringify(CLOSURE)});`,
  ]);
  assert.notEqual(blocked.status, 0, blocked.stdout + blocked.stderr);
  assert.match(blocked.stderr, /parse5 해석 막음/);
  const read = `const m = await import(${JSON.stringify(CLOSURE)});\nconsole.log(JSON.stringify(m.scriptSrcs('<script src=./a.mjs></script>')));`;
  const open = run(['--input-type=module', '-e', read]);
  assert.equal(open.status, 0, open.stderr);
  assert.equal(open.stdout.trim(), '["./a.mjs"]');
});

test('parse5를 못 불러오면 제품 흐름 시험 파일이 실패한다(끝 코드 0이 아니다)', () => {
  const hook = `data:text/javascript,${encodeURIComponent(BLOCK)}`;
  const result = run([
    '--import',
    hook,
    '--test',
    path.join(ROOT, 'test', 'build', 'product-flow.test.mjs'),
  ]);
  assert.notEqual(result.status, 0, '제품 흐름 시험이 parse5 없이 지나가면 안 된다');
  assert.match(result.stdout + result.stderr, /parse5 해석 막음/);
});

test('빈 · 읽지 못한 importmap은 멈춘다 — 감지를 뺀 변형은 이 장면을 지나간다(r6 GA1 · 설계 주인 잣대 ㄷ)', async () => {
  const { htmlTraps } = await import(CLOSURE);
  const broken = [
    '<script type="importmap"></script>',
    '<script type="importmap">  \n </script>',
    '<script type="importmap">{"imports":</script>',
  ];
  for (const html of broken) assert.equal(htmlTraps(html).length, 1, html);
  assert.equal(
    htmlTraps('<script type="importmap">{"imports":{"three":"/three.mjs"}}</script>').length,
    0,
  );
  // 변형 — 본문 없는 script를 importmap 검사보다 먼저 건너뛴다(고치기 전 꼴). 같은 폴더의 점 사본으로 불러 위 장면이 가르는지 본다.
  const file = path.join(ROOT, 'test', 'support', 'game-closure.mjs');
  const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const from = "  if (attrOf(node, 'src') !== undefined) return null;\n";
  assert.equal(source.split(from).length, 2, '바꿀 글이 꼭 한 번 있다');
  const copy = path.join(ROOT, 'test', 'support', `.mutant-game-closure-${process.pid}.mjs`);
  fs.writeFileSync(
    copy,
    source.replace(
      from,
      "  if (attrOf(node, 'src') !== undefined || !hasText(node)) return null;\n",
    ),
  );
  try {
    const mutant = await import(pathToFileURL(copy).href);
    assert.equal(
      mutant.htmlTraps(broken[0]).length,
      0,
      '변형은 빈 importmap을 지나간다 — 위 장면이 잡는다',
    );
  } finally {
    fs.rmSync(copy, { force: true });
  }
});

test('쓰는 parse5는 이 꾸러미 devDependencies의 잠긴 판이다', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.devDependencies.parse5, '8.0.1', '정확한 판 번호');
  assert.equal(lock.packages[''].devDependencies.parse5, '8.0.1');
  assert.equal(lock.packages['node_modules/parse5'].version, '8.0.1');
  // 시험 도우미 자리에서 풀리는 parse5의 package.json(꾸러미 안의 경로를 거슬러 찾는다 — exports가 package.json을 내지 않아도).
  let dir = path.dirname(fileURLToPath(import.meta.resolve('parse5')));
  while (
    !fs.existsSync(path.join(dir, 'package.json')) ||
    JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name !== 'parse5'
  ) {
    assert.notEqual(path.dirname(dir), dir, 'parse5 package.json을 찾는다');
    dir = path.dirname(dir);
  }
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version,
    '8.0.1',
    dir,
  );
});
