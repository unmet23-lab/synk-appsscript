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
