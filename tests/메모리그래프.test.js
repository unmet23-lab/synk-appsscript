// memory-graph 회귀 테스트 — 메모리를 그래프로 읽는 장치가 살아있는지 검사한다.
// 실제 메모리 디렉터리에 의존하지 않는다(임시 디렉터리에 가짜 메모리를 만들어 검사).
//
// 핵심 회귀 2건(둘 다 첫 실행에서 실제로 물린 함정):
//  ① 코드 스팬 오염 — 표기법을 **설명하는** 문서가 그 예시를 진짜 엣지로 내보내 없는 노드를 만들었다.
//  ② 자기증식 — 역링크 섹션을 파싱에서 빼지 않으면 자기가 쓴 엣지를 다시 읽어 매 실행마다 불어난다.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'memory-graph.js');
const G = require(TOOL);

function mkMemory(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memgraph-'));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body, 'utf8');
  }
  return dir;
}

test('링크 타입 파싱 — 무타입은 관련, 타입은 그대로', () => {
  const links = G.parseLinks('본문 [[a]] 과 [[대체>b]] 와 [[막힘>c]] 와 [[근거>d]]');
  assert.deepStrictEqual(links.map((l) => [l.type, l.target]), [
    ['관련', 'a'], ['대체', 'b'], ['막힘', 'c'], ['근거', 'd'],
  ]);
  assert.ok(links.every((l) => l.known));
});

test('미지 타입은 삼키지 않고 known=false로 드러낸다', () => {
  const links = G.parseLinks('[[대쳬>a]]'); // 오탈자
  assert.strictEqual(links[0].known, false);
  assert.strictEqual(links[0].type, '대쳬');
});

test('[[#섹션-앵커]]는 노드 엣지가 아니다', () => {
  assert.strictEqual(G.parseLinks('[[#우클릭-메뉴는-선택된-컴포넌트에-걸린다]]').length, 0);
});

test('회귀①: 코드 스팬·펜스 안의 링크는 엣지가 아니다', () => {
  const dir = mkMemory({
    'MEMORY.md': '- [a](a.md)\n',
    'a.md': '표기법 설명: `[[대체>예시]]` 를 쓴다.\n\n```\n[[막힘>펜스안]]\n```\n\n진짜 링크는 [[b]] 뿐이다.\n',
    'b.md': '내용\n',
  });
  const nodes = G.load(dir);
  const a = nodes.get('a');
  assert.deepStrictEqual(a.links.map((l) => l.target), ['b'], '코드 안 예시가 엣지로 새면 안 된다');
  assert.strictEqual(G.diagnose(nodes).broken.length, 0);
});

test('회귀②: 역링크 섹션은 파싱에서 제외돼 자기증식하지 않는다', () => {
  const dir = mkMemory({
    'MEMORY.md': '- [a](a.md)\n- [b](b.md)\n',
    'a.md': '[[b]]\n',
    'b.md': '내용\n',
  });
  const run = () => {
    const nodes = G.load(dir);
    G.writeBacklinks(nodes);
    return G.load(dir);
  };
  run(); run(); run();
  const after = G.load(dir);
  assert.strictEqual(after.get('b').links.length, 0, 'b가 역링크를 읽어 a를 가리키면 안 된다');
  assert.strictEqual(after.get('a').links.length, 1);
});

test('역링크 쓰기는 멱등하다 — 2회차부터 변경 0', () => {
  const dir = mkMemory({
    'MEMORY.md': '- [a](a.md)\n- [b](b.md)\n',
    'a.md': '[[근거>b]]\n',
    'b.md': '내용\n',
  });
  assert.ok(G.writeBacklinks(G.load(dir)) > 0);
  assert.strictEqual(G.writeBacklinks(G.load(dir)), 0);
  assert.strictEqual(G.writeBacklinks(G.load(dir)), 0);
});

test('역링크 쓰기는 본문을 보존한다(추가만)', () => {
  const body = '---\nname: b\n---\n\n중요한 본문 내용\n';
  const dir = mkMemory({ 'MEMORY.md': '- [a](a.md)\n- [b](b.md)\n', 'a.md': '[[b]]\n', 'b.md': body });
  G.writeBacklinks(G.load(dir));
  const after = fs.readFileSync(path.join(dir, 'b.md'), 'utf8');
  assert.ok(after.includes('중요한 본문 내용'));
  assert.strictEqual(G.stripBacklinks(after).replace(/\s+$/, ''), body.replace(/\s+$/, ''));
  assert.ok(after.includes('관련 ← [[a]]'));
});

test('깨진 링크는 잡고, 결정 노드는 깨진 게 아니다', () => {
  const dir = mkMemory({
    'MEMORY.md': '- [a](a.md)\n',
    'a.md': '[[막힘>결정-개원일-확정]] 과 [[없는파일]]\n',
  });
  const d = G.diagnose(G.load(dir));
  assert.deepStrictEqual(d.broken.map((b) => b.target), ['없는파일']);
});

test('인덱스 불일치 — 유령과 누락을 양방향으로 잡는다', () => {
  const dir = mkMemory({
    'MEMORY.md': '- [a](a.md)\n- [사라진](사라진.md)\n',
    'a.md': '[[b]]\n',
    'b.md': '내용\n', // 인덱스에 줄이 없다
  });
  const d = G.diagnose(G.load(dir));
  assert.deepStrictEqual(d.ghostInIndex, ['사라진']);
  assert.deepStrictEqual(d.missingFromIndex, ['b']);
});

/* 2026-08-07 쪼개기(F184): 상한이 「줄」이라 옛 절을 `지도.md` 로 내보냈다.
 * 인덱스를 MEMORY.md 하나로만 세면 **옮긴 98건이 「누락」으로 뜬다** — 옮긴 것과 잃은 것이
 * 같은 모양이 되는 자리다. 양방향으로 못박는다: 지도에만 있어도 등재된 것이고,
 * 지도의 유령도 유령이며, 지도 자신은 토픽 파일이 아니다(자기가 누락으로 뜨면 안 된다). */
test('인덱스는 두 파일 — 지도.md 에만 있는 줄도 등재로 센다', () => {
  const dir = mkMemory({
    'MEMORY.md': '- [a](a.md)\n',
    '지도.md': '- [b](b.md)\n- [없는것](없는것.md)\n',
    'a.md': '내용\n',
    'b.md': '내용\n', // MEMORY.md 엔 없지만 지도에 있다 — 누락이 아니다
  });
  const d = G.diagnose(G.load(dir));
  assert.deepStrictEqual(d.missingFromIndex, [], 'b 가 누락으로 떴다 — 지도를 인덱스로 안 셌다');
  assert.deepStrictEqual(d.ghostInIndex, ['없는것'], '지도 쪽 유령을 못 잡는다');
});

test('결정 큐 — 연쇄 해소를 세고 직접 건수와 구분한다', () => {
  // D를 풀면 a가 풀리고, a를 기다리던 b·c도 연쇄로 풀린다 → D의 값은 3
  const dir = mkMemory({
    'MEMORY.md': '- [a](a.md)\n- [b](b.md)\n- [c](c.md)\n',
    'a.md': '[[막힘>결정-D]]\n',
    'b.md': '[[막힘>a]]\n',
    'c.md': '[[막힘>b]]\n',
  });
  const { ranked } = G.decisions(G.load(dir));
  const top = ranked[0];
  assert.strictEqual(top.blocker, '결정-D');
  assert.strictEqual(top.unblocks, 3, 'a→b→c 연쇄까지 세야 한다');
  assert.strictEqual(top.direct, 1, '직접 막는 건 a 하나');
  assert.strictEqual(top.kind, '결정');
});

test('순환 대기는 조용히 넘기지 않고 잡는다', () => {
  const dir = mkMemory({
    'MEMORY.md': '- [a](a.md)\n- [b](b.md)\n',
    'a.md': '[[막힘>b]]\n',
    'b.md': '[[막힘>a]]\n',
  });
  const { cycles } = G.decisions(G.load(dir));
  assert.ok(cycles.length > 0, '서로 기다리면 영원히 안 풀린다 — 반드시 드러나야 한다');
});

test('고아 판정에 인덱스 링크는 연결로 세지 않는다', () => {
  // 인덱스는 모두를 가리키므로 그걸 세면 고아가 영원히 0이 되어 검사가 무의미해진다
  const dir = mkMemory({
    'MEMORY.md': '- [섬](섬.md)\n[[섬]]\n',
    '섬.md': '아무도 안 가리키고 아무도 안 가리킴\n',
  });
  assert.deepStrictEqual(G.diagnose(G.load(dir)).orphans, ['섬']);
});

test('CLI가 실제로 돈다 — --json 출력이 파싱 가능', () => {
  const dir = mkMemory({ 'MEMORY.md': '- [a](a.md)\n', 'a.md': '[[막힘>결정-X]]\n' });
  const out = execFileSync(process.execPath, [TOOL, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, SYNK_MEMORY_DIR: dir },
  });
  const j = JSON.parse(out);
  assert.strictEqual(j.decisions.ranked[0].blocker, '결정-X');
  assert.strictEqual(j.broken.length, 0);
});

/* ── 메모리 폴더의 자리 (장부 F206) ────────────────────────────────────────
 * 워크트리 세션에서 슬러그가 `…-.claude-worktrees-<이름>` 으로 파생돼 **없는 폴더**를 가리켰다.
 * 증상이 오류가 아니라 「메모리 0건」이라 「깨끗함」과 같은 모양이었다 — 아무도 못 본 이유다.
 * 탐지는 픽스처가 진다: 실저장소에 워크트리가 있느냐에 기대면 CI 에서 조용히 미실행이 된다. */
function 가짜트리() {
  const 메인 = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'memgraph-main-')));
  fs.mkdirSync(path.join(메인, '.git', 'worktrees', 'wt'), { recursive: true });
  fs.writeFileSync(path.join(메인, '.git', 'HEAD'), 'ref: refs/heads/master\n');
  const 트리 = path.join(메인, '.claude', 'worktrees', 'wt');
  fs.mkdirSync(트리, { recursive: true });
  // 워크트리의 `.git` 은 디렉터리가 아니라 한 줄짜리 **파일**이다 — 그 한 줄이 사고의 씨앗이었다.
  fs.writeFileSync(path.join(트리, '.git'), `gitdir: ${path.join(메인, '.git', 'worktrees', 'wt')}\n`);
  for (const r of [메인, 트리]) {   // 워크트리는 같은 파일을 체크아웃한다 — 같은 모듈을 두 자리에 심는다
    fs.mkdirSync(path.join(r, 'tools'), { recursive: true });
    fs.mkdirSync(path.join(r, '.claude', 'hooks', 'lib'), { recursive: true });
    fs.copyFileSync(TOOL, path.join(r, 'tools', 'memory-graph.js'));
    /* 🔴 `tools/lib` 부품을 **통째로** 싣는다 — 이름으로 고르면 도구에 의존이 하나 늘 때마다
     *   이 픽스처가 MODULE_NOT_FOUND 로 죽는다(2026-08-18 인자 게이트 부착이 그렇게 깨뜨렸다). */
    const LIB = path.join(__dirname, '..', 'tools', 'lib');
    fs.mkdirSync(path.join(r, 'tools', 'lib'), { recursive: true });
    for (const n of fs.readdirSync(LIB).filter((x) => x.endsWith('.js'))) {
      fs.copyFileSync(path.join(LIB, n), path.join(r, 'tools', 'lib', n));
    }
    fs.copyFileSync(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'worktrees.js'),
      path.join(r, '.claude', 'hooks', 'lib', 'worktrees.js'));
  }
  return { 메인, 트리 };
}

test('회귀: 워크트리에서도 메모리 폴더는 메인 트리 하나를 가리킨다 (F206)', () => {
  const 옛 = process.env.SYNK_MEMORY_DIR;
  delete process.env.SYNK_MEMORY_DIR;   // 덮어쓰기가 살아 있으면 둘이 같아져 **허수 통과**가 된다
  try {
    const { 메인, 트리 } = 가짜트리();
    const 메인값 = require(path.join(메인, 'tools', 'memory-graph.js')).memoryDir();
    const 트리값 = require(path.join(트리, 'tools', 'memory-graph.js')).memoryDir();
    assert.strictEqual(트리값, 메인값, '워크트리 세션이 다른 메모리 폴더를 본다 — 큐가 조용히 0건이 된다');
    assert.ok(!/worktrees/.test(트리값), `슬러그에 워크트리 경로가 섞였다: ${트리값}`);
  } finally {
    if (옛 === undefined) delete process.env.SYNK_MEMORY_DIR; else process.env.SYNK_MEMORY_DIR = 옛;
  }
});

/* ── 옛 통로 금지 (F206 처방) ──────────────────────────────────────────────
 * 하네스 폴더(`~/.claude/projects/<슬러그>`)를 **손으로 조립하는 자리**를 금지한다.
 * 다섯 곳이 각자 조립했고 셋이 서로 다른 방식으로 어긋났는데(하드코딩·cwd·워크트리)
 * 증상은 전부 「0건」이라 서로 구별조차 안 됐다. 3번째부터는 고치는 게 아니라 **못 쓰게** 한다. */
const 손조립 = [
  { 이름: "'projects' 를 손으로 join", re: /['"]projects['"]\s*,/ },
  { 이름: '이 기계 이름을 하드코딩', re: /C--[A-Za-z0-9_]+-/ },
];
const 조립정본 = 'memory-graph.js';   // 조립해도 되는 유일한 자리 — 자기 처방을 자기가 막으면 안 된다

function 조립검사(뿌리) {
  const 결과 = { 훑은수: 0, 위반: [] };
  const 걷기 = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'worktrees') 걷기(p); continue; }
      if (!e.name.endsWith('.js') || e.name === 조립정본) continue;
      결과.훑은수 += 1;
      fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((줄, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(줄)) return;     // 주석 줄은 설명이지 조립이 아니다
        for (const s of 손조립) if (s.re.test(줄)) 결과.위반.push(`${path.relative(뿌리, p)}:${i + 1} — ${s.이름}`);
      });
    }
  };
  걷기(뿌리);
  return 결과;
}

test('탐지력: 손으로 조립한 하네스 경로를 두 표기 모두 잡는다 (픽스처)', () => {
  // 실저장소가 깨끗해진 뒤에도 **탐지 능력 자체**는 여기서 증명된다(버그가 남아 있길 요구하지 않는다)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memgraph-조립-'));
  fs.writeFileSync(path.join(dir, '나쁜1.js'), "path.join(os.homedir(), '.claude', 'projects', slug);\n");
  fs.writeFileSync(path.join(dir, '나쁜2.js'), "const M = '~/.claude/projects/C--Users-q1212-Documents-SYNK-appsscript/memory';\n");
  fs.writeFileSync(path.join(dir, '착한.js'), "const M = require('./memory-graph.js').memoryDir();\n");
  const r = 조립검사(dir);
  assert.strictEqual(r.훑은수, 3);
  assert.strictEqual(r.위반.length, 2, `두 표기 다 잡아야 한다:\n${r.위반.join('\n')}`);
});

test('[실저장소] 도구·훅에 손조립이 남아 있지 않다', () => {
  const ROOT = path.join(__dirname, '..');
  let 훑은수 = 0; const 위반 = [];
  for (const 뿌리 of [path.join(ROOT, 'tools'), path.join(ROOT, '.claude', 'hooks')]) {
    const r = 조립검사(뿌리);
    훑은수 += r.훑은수; 위반.push(...r.위반);
  }
  // 0건과 **미실행**은 같은 모양이면 안 된다 — 훑은 수를 먼저 못박는다
  assert.ok(훑은수 > 20, `훑은 파일이 ${훑은수}개다 — 검사가 안 돈 것에 가깝다`);
  assert.deepStrictEqual(위반, [], `하네스 경로를 손으로 조립한 자리가 있다:\n${위반.join('\n')}`);
});
