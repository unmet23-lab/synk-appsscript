'use strict';
// tools/ci읽기기록.cjs·tools/ci읽기대조.cjs와 세 워크플로의 경로 목록(2026-10-20).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 대조, 희소목록, 시험목록 } = require('../tools/ci읽기대조.cjs');
const { 푸시필터 } = require('../tools/원격ci.js');

const ROOT = path.join(__dirname, '..');
const 워크플로 = (f) => fs.readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf8');

const 희소 = '          sparse-checkout-cone-mode: false\n          sparse-checkout: |\n            /*\n            !*.png\n';
const 무거운 = `name: syntax-check\non:\n  push:\n    paths-ignore:\n      - 'docs/_ops/트랙.md'\n      - 'docs/현장노트/**'\n  workflow_dispatch:\njobs:\n  check:\n    steps:\n      - uses: actions/checkout@v5\n        with:\n          path: SYNK-appsscript\n${희소}      - name: talk\n        uses: actions/checkout@v5\n        with:\n          repository: unmet23-lab/SYNK-talk\n          sparse-checkout: |\n            /package.json\n`;
const 기록 = `name: records-check\non:\n  push:\n    paths:\n      - 'docs/_ops/트랙.md'\n      - 'docs/현장노트/**'\n      - '.github/workflows/records-check.yml'\njobs:\n  records:\n    steps:\n      - uses: actions/checkout@v5\n        with:\n${희소}      - run: node --test tests/트랙읽기.test.js\n`;

function 판(root, 기록들, { 무거운yaml = 무거운, 기록yaml = 기록, 희소빠짐 = new Set() } = {}) {
  return 대조({ root, 기록들, 무거운yaml, 기록yaml, 희소빠짐 }).어긋남;
}
const 프로세스 = (root, pid, ppid, argv, reads, spawns = []) => ({ pid, ppid, cwd: root, argv: ['node', ...argv],
  reads: reads.map(([p, kinds]) => [path.join(root, p), kinds]), spawns });

test('희소 목록은 저장소 체크아웃 단계 것만, 시험 목록은 tests/ 파일 이름만 읽는다', () => {
  assert.deepEqual(희소목록(무거운), [['/*', '!*.png']]);
  assert.deepEqual(시험목록(기록), ['tests/트랙읽기.test.js']);
});

test('기록 전용 경로를 읽은 시험이 records-check에 없으면, 단계가 읽으면 멈춘다 — 폴더 나열만은 세지 않는다', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-read-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs', '현장노트'), { recursive: true });
  const 실행기 = 프로세스(root, 1, 0, ['--test', 'tests/트랙읽기.test.js', 'tests/다른.test.js'], []);
  const 맞음 = 프로세스(root, 2, 1, ['tests/트랙읽기.test.js'], [['docs/_ops/트랙.md', ['read']]]);
  assert.deepEqual(판(root, [실행기, 맞음]), []);
  // 다른 시험이 기록 경로를 읽는다 → records-check에 더하라는 어긋남. 그 시험이 띄운 자식이 읽어도 그 시험 몫이다.
  const 다른 = 프로세스(root, 3, 1, ['tests/다른.test.js'], []);
  const 손자 = { ...프로세스(root, 4, 3, ['tools/도구.js'], [['docs/현장노트/git.md', ['exists', 'read']]]) };
  const 어긋남 = 판(root, [실행기, 맞음, 다른, 손자]);
  assert.equal(어긋남.length, 1); assert.match(어긋남[0], /② tests\/다른\.test\.js가 기록 전용 경로를 읽는다\(docs\/현장노트\/git\.md\)/);
  // 폴더를 훑기만 한 것은 세지 않는다.
  assert.deepEqual(판(root, [실행기, 프로세스(root, 5, 1, ['tests/다른.test.js'], [['docs/현장노트', ['stat', 'dir']]])]), []);
  // 시험 밖 단계가 읽으면 단계 이름으로 멈춘다.
  const 단계 = 판(root, [프로세스(root, 9, 0, ['tools/prism래칫.js'], [['docs/_ops/트랙.md', ['read']]])]);
  assert.match(단계[0], /② tools\/prism래칫\.js 단계가 기록 전용 경로를 읽는다/);
  // 저장소 안에서 돈 git show HEAD:<기록 경로>도 읽기로 센다. 임시 저장소에서 돈 같은 명령은 세지 않는다.
  const 깃 = (cwd) => [프로세스(root, 3, 1, ['tests/다른.test.js'], [], [{ command: 'git', args: ['show', 'HEAD:docs/_ops/트랙.md'], cwd }])];
  assert.equal(판(root, 깃(root)).length, 1);
  assert.equal(판(root, 깃(os.tmpdir())).length, 0);
  // 저장소 안에서 돌아도 -C·--git-dir·GIT_DIR이 임시 저장소를 가리키면 그 저장소의 파일이다(내커밋 시험의 꼴).
  const 남의깃 = (spawn) => [프로세스(root, 3, 1, ['tests/다른.test.js'], [], [{ command: 'git', cwd: root, ...spawn }])];
  assert.equal(판(root, 남의깃({ args: ['--git-dir', path.join(os.tmpdir(), 'x', 'origin.git'), 'show', 'master:docs/_ops/트랙.md'] })).length, 0);
  assert.equal(판(root, 남의깃({ args: ['-C', os.tmpdir(), 'diff', '--', 'docs/_ops/트랙.md'] })).length, 0);
  assert.equal(판(root, 남의깃({ args: ['show', 'HEAD:docs/_ops/트랙.md'], gitDir: path.join(os.tmpdir(), 'y') })).length, 0);
  assert.equal(판(root, 남의깃({ args: ['-C', 'docs', 'show', 'HEAD:docs/_ops/트랙.md'] })).length, 1);
});

test('희소 체크아웃이 뺀 파일을 열거나 재면 멈춘다', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-read-sparse-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const 희소빠짐 = new Set(['docs/캐릭터/정본_4K/몽글_웃음.png']);
  const 읽음 = 프로세스(root, 2, 0, ['tests/그림.test.js'], [['docs/캐릭터/정본_4K/몽글_웃음.png', ['exists']]]);
  const 어긋남 = 판(root, [읽음], { 희소빠짐 });
  assert.equal(어긋남.length, 1); assert.match(어긋남[0], /③ tests\/그림\.test\.js가 희소 체크아웃이 뺀 파일을 연다\(docs\/캐릭터\/정본_4K\/몽글_웃음\.png\)/);
});

test('두 워크플로의 기록 경로·희소 목록이 다르면 멈춘다', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-read-lists-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const 빠진기록 = 기록.replace("      - 'docs/현장노트/**'\n", '');
  assert.match(판(root, [], { 기록yaml: 빠진기록 }).join('\n'), /① 기록 전용 경로 목록이 다르다 — syntax-check\.yml에만: docs\/현장노트\/\*\*/);
  const 다른희소 = 기록.replace('!*.png', '!*.jpg');
  assert.match(판(root, [], { 기록yaml: 다른희소 }).join('\n'), /sparse-checkout 목록이 다르다/);
  assert.match(판(root, [], { 무거운yaml: 무거운.replace('paths-ignore', 'paths') }).join('\n'), /paths-ignore 목록을 못 읽었다/);
});

test('실제 워크플로 — 기록 경로·희소 목록이 같고, Windows 검사의 paths는 희소 목록과 같으며, 가벼운 시험 파일이 있다', () => {
  const 무거운yaml = 워크플로('syntax-check.yml'), 기록yaml = 워크플로('records-check.yml'), 창yaml = 워크플로('windows-check.yml');
  assert.deepEqual(대조({ root: ROOT, 기록들: [], 무거운yaml, 기록yaml, 희소빠짐: new Set() }).어긋남, []);
  const 창필터 = 푸시필터(창yaml), [창희소] = 희소목록(창yaml);
  assert.equal(창필터.종류, 'paths');
  assert.deepEqual([...창필터.패턴].sort(), [...창희소.map((p) => p.replace(/^\//, '')), '.github/workflows/windows-check.yml'].sort());
  const 가벼운 = 시험목록(기록yaml);
  assert.ok(가벼운.length >= 1);
  for (const f of 가벼운) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} 가 없다`);
});

test('읽기 기록은 실제 프로세스의 읽기·자식 명령을 남기고, realpathSync.native 같은 붙은 함수를 지킨다', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-read-trace-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const 대상 = path.join(dir, '읽을것.txt');
  fs.writeFileSync(대상, 'x');
  const 코드 = `const fs=require('node:fs');fs.readFileSync(${JSON.stringify(대상)});` +
    `if(typeof fs.realpathSync.native!=='function')process.exit(3);fs.realpathSync.native(${JSON.stringify(dir)});` +
    `require('node:child_process').spawnSync(process.execPath,['-e','0']);`;
  const 기록폴더 = path.join(dir, '기록');
  const r = spawnSync(process.execPath, ['-e', 코드], { encoding: 'utf8',
    env: { ...process.env, SYNK_READ_TRACE_DIR: 기록폴더, NODE_OPTIONS: `--require "${path.join(ROOT, 'tools', 'ci읽기기록.cjs').split(path.sep).join('/')}"` } });
  assert.equal(r.status, 0, r.stderr);
  const 기록들 = fs.readdirSync(기록폴더).map((f) => JSON.parse(fs.readFileSync(path.join(기록폴더, f), 'utf8')));
  assert.equal(기록들.length, 2, '부모와 자식 node 둘');
  const 부모 = 기록들.find((x) => x.spawns.length);
  assert.ok(부모.reads.some(([p, kinds]) => p === path.resolve(대상) && kinds.includes('read')));
  assert.equal(부모.spawns[0].args[0], '-e');
});
