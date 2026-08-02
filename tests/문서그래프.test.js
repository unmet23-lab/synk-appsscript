// doc-graph + doc-propagation 훅 회귀 테스트.
// 지키려는 성질: ①엣지는 파생이 선언한다 ②오탈자 정본은 심지 못한다
// ③훅은 차단하지 않는다(망각을 막는 장치지 실수를 막는 장치가 아니다)
// ④파생 선언이 없는 문서에는 침묵한다(오탐 0).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'doc-graph.js');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'doc-propagation.js');
const G = require(TOOL);

function runHook(filePath, tool = 'Edit') {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: tool, tool_input: { file_path: filePath } }),
    encoding: 'utf8',
  });
  return out.trim();
}

test('파생 주석 파싱 — 여러 줄·쉼표 나열 모두 읽는다', () => {
  const edges = G.parseEdges('제목\n<!-- 파생: a.md, b.md -->\n본문\n<!-- 파생: c.md -->\n');
  assert.deepStrictEqual(edges, ['a.md', 'b.md', 'c.md']);
});

test('정본 판별 — 파일명 또는 docs/정본/ 아래', () => {
  assert.ok(G.isCanon('docs/브랜드_폰트_정본.md'));
  assert.ok(G.isCanon('docs/정본/SYNK LAB/SYNK LAB 급여 인센티브 정본.txt'));
  assert.ok(!G.isCanon('docs/세션보드.md'));
});

test('실제 저장소에서 급여 정본의 파생이 잡힌다', () => {
  const g = G.build();
  const list = g.derivedOf.get('docs/정본/SYNK LAB/SYNK LAB 급여 인센티브 정본.txt') || [];
  assert.ok(list.includes('docs/개원재무_2027_재산정_v1.md'), '개원재무는 급여 정본의 파생이다');
  assert.ok(list.length >= 3, `파생이 ${list.length}종 — 엣지가 사라졌는지 확인할 것`);
});

test('깨진 참조는 없다 — 있으면 알림이 거짓말을 한다', () => {
  assert.deepStrictEqual(G.build().broken, []);
});

test('--add는 없는 정본을 거부한다(오탈자 엣지 차단)', () => {
  const tmp = path.join(os.tmpdir(), `docgraph-${process.pid}.md`);
  fs.writeFileSync(path.join(ROOT, 'docs', path.basename(tmp)), '# 임시\n', 'utf8');
  const target = path.join(ROOT, 'docs', path.basename(tmp));
  try {
    assert.throws(() => {
      execFileSync(process.execPath, [TOOL, '--add', `docs/${path.basename(tmp)}`, 'docs/없는정본.md'], {
        encoding: 'utf8', stdio: 'pipe',
      });
    });
    assert.ok(!fs.readFileSync(target, 'utf8').includes('파생'), '거부됐으면 파일이 안 바뀌어야 한다');
  } finally {
    fs.unlinkSync(target);
  }
});

test('훅: 정본을 편집하면 파생 목록을 알린다', () => {
  const out = runHook(path.join(ROOT, 'docs', '정본', 'SYNK LAB', 'SYNK LAB 급여 인센티브 정본.txt'));
  assert.ok(out, '정본 편집인데 침묵하면 장치가 죽은 것');
  const j = JSON.parse(out);
  assert.ok(j.hookSpecificOutput.additionalContext.includes('개원재무'));
});

test('훅은 절대 차단하지 않는다 — permissionDecision을 내지 않는다', () => {
  const out = runHook(path.join(ROOT, 'docs', '정본', 'SYNK LAB', 'SYNK LAB 급여 인센티브 정본.txt'));
  const j = JSON.parse(out);
  assert.strictEqual(j.hookSpecificOutput.permissionDecision, undefined,
    '차단도 allow도 하지 않는다 — 권한 판정을 대신하면 나중 deny 규칙을 조용히 뚫는다');
});

test('훅: 파생이 없는 문서에는 침묵한다(오탐 0)', () => {
  assert.strictEqual(runHook(path.join(ROOT, 'docs', '세션보드.md')), '');
});

test('훅: docs 밖 파일에는 침묵한다', () => {
  assert.strictEqual(runHook(path.join(ROOT, 'Code.js')), '');
});

test('훅: Edit·Write·MultiEdit 외 도구에는 반응하지 않는다', () => {
  const canon = path.join(ROOT, 'docs', '정본', 'SYNK LAB', 'SYNK LAB 급여 인센티브 정본.txt');
  assert.strictEqual(runHook(canon, 'Read'), '');
});
