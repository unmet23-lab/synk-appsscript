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

/* [2026-08-03] 저장소가 놓인 자리가 규칙을 바꾸면 안 된다.
 * 실사고: 세션 worktree는 `.claude/worktrees/<이름>/`에 만들어지는데, SKIP을 **절대경로**에 걸고
 * 있어서 `/worktrees/` 규칙이 그 안의 docs를 통째로 걸러냈다. build()가 0개를 돌려주고도
 * 예외는 없어서, 정본을 고쳐도 파생 알림이 그냥 안 떴다 — 죽은 장치와 조용한 장치가 똑같이 생겼다. */
test('SKIP은 상대경로 판정이다 — 저장소가 worktrees 아래 있어도 docs를 버리지 않는다', () => {
  assert.ok(G.shouldSkip('docs/_archive/옛문서.md'), '_archive는 여전히 걸러야 한다');
  assert.ok(G.shouldSkip('docs/세션보드_아카이브.md'), '보드 아카이브는 여전히 걸러야 한다');
  assert.ok(!G.shouldSkip('docs/개원재무_2027_재산정_v1.md'), '평범한 문서를 걸렀다');
  // 절대경로를 그대로 넣으면 안 된다는 것을 못박는다
  const abs = path.join(G.ROOT, 'docs', '개원재무_2027_재산정_v1.md');
  assert.ok(!G.shouldSkip(G.rel(abs)),
    'rel()을 통과한 경로가 걸러진다 — 세션 worktree에서 그래프가 통째로 빈다');
  assert.ok(G.build().docs.size > 0, 'build()가 문서를 하나도 못 찾았다 — 알림 장치가 침묵으로 죽는다');
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

/* ── [2026-08-03] 시간축 엣지 ─────────────────────────────────────────────
 * 지키려는 성질: ①버전 표기가 있어도 기존 호출자는 경로만 본다 ②정본 버전은 **본문**에서 읽는다
 * ③버전 없는 엣지는 '최신'이 아니라 '모름' ④--add는 @버전을 경로로 오인하지 않는다. */

test('splitVersion — @v1.1은 버전, 경로 속 @는 버전이 아니다', () => {
  assert.deepStrictEqual(G.splitVersion('docs/a.md@v1.1'), { target: 'docs/a.md', version: 'v1.1' });
  assert.deepStrictEqual(G.splitVersion('docs/a.md'), { target: 'docs/a.md', version: null });
  // 폴더명에 @가 들어간 경로를 버전으로 잘라 먹으면 엣지가 통째로 깨진다
  assert.deepStrictEqual(G.splitVersion('docs/@scope/a.md'), { target: 'docs/@scope/a.md', version: null });
  assert.deepStrictEqual(G.splitVersion('docs/a.md@배포'), { target: 'docs/a.md@배포', version: null });
});

test('parseEdges는 버전을 떼고 경로만 준다 — 훅·기존 호출자가 안 깨진다', () => {
  assert.deepStrictEqual(G.parseEdges('<!-- 파생: a.md@v1.1, b.md -->'), ['a.md', 'b.md']);
  assert.deepStrictEqual(G.parseEdgesFull('<!-- 파생: a.md@v1.1, b.md -->'),
    [{ target: 'a.md', version: 'v1.1' }, { target: 'b.md', version: null }]);
});

test('정본 버전은 본문에서 읽는다 — 파일명을 믿으면 틀린다', () => {
  // 실제 사례: 파일명은 `반편성_정본_v2.md`인데 본문은 v2.3이다.
  const g = G.build();
  assert.strictEqual(g.docs.get('docs/반편성_정본_v2.md').version, 'v2.3',
    '파일명(v2)이 아니라 본문(v2.3)을 읽어야 한다');
  assert.strictEqual(g.docs.get('docs/정본/SYNK LAB/SYNK LAB 급여 인센티브 정본.txt').version, 'v1.3');
});

test('머리말 밖의 vN은 버전이 아니다 — 본문을 훑으면 아무 숫자나 집는다', () => {
  const long = ['# 제목', '', '내용', '', '', '', '', '', '', '', '', '', '', '한참 뒤에 v9.9 라고 적힘'];
  assert.strictEqual(G.canonVersion(long.join('\n')), null);
  assert.strictEqual(G.canonVersion('# 반편성 정본 v2.3 — 4실'), 'v2.3');
  assert.strictEqual(G.canonVersion('제목만 있고 버전이 없다'), null, '못 읽으면 null이지 추측이 아니다');
});

test('낡은 인용을 실제로 잡는다 — 급여 정본 v1.3 vs 파생 v1.1', () => {
  const g = G.build();
  const stale = g.stale.filter((s) => /급여 인센티브 정본/.test(s.target));
  assert.ok(stale.length >= 3, `낡은 인용이 ${stale.length}건 — 실측 3건이 사라졌는지 확인할 것`);
  for (const s of stale) {
    assert.strictEqual(s.now, 'v1.3');
    assert.notStrictEqual(s.cited, s.now, '같은 버전인데 낡음으로 올라왔다');
  }
  // 같은 정본을 따르지만 v1.3으로 맞춰둔 문서는 낡음이 아니다(거짓양성 차단)
  assert.ok(!g.stale.some((s) => s.from === 'docs/반편성_정본_v2.md'),
    '이미 v1.3에 맞춘 문서를 낡음으로 올리면 알림 전체가 신뢰를 잃는다');
});

test('버전 없는 엣지는 낡음도 최신도 아닌 「모름」이다', () => {
  const g = G.build();
  const overlap = g.unversioned.filter((u) => g.stale.some((s) => s.from === u.from && s.target === u.target));
  assert.deepStrictEqual(overlap, [], '같은 엣지가 모름과 낡음에 동시에 잡히면 집계가 두 번 센다');
  assert.ok(g.unversioned.length > 0, '미기입이 0이면 집계가 비었는지 확인할 것');
});

/* [2026-08-03 회귀] 그래프에 대해 쓴 글이 그래프를 오염시키면 도구가 자기 자신을 못 믿는다.
 * memory-graph는 stripCode를 갖고 있었는데 doc-graph는 없었고, 표기법을 설명하는 문서
 * (docs/_ops/부패점검.md)를 쓰자마자 코드 펜스 안의 예시가 진짜 엣지로 새어
 * 그 문서가 「낡은 인용」으로 잡혔다. 같은 함정을 다른 파일에서 두 번 밟았다. */
test('[회귀] 코드 펜스·코드 스팬 안의 파생 예시는 엣지가 아니다', () => {
  const doc = '# 설명\n\n```\n<!-- 파생: docs/가짜정본.md@v1.1 -->\n```\n\n인라인도 `<!-- 파생: docs/가짜2.md -->` 마찬가지.\n';
  assert.deepStrictEqual(G.parseEdgesFull(doc), []);
  assert.deepStrictEqual(G.parseEdges(doc), []);
});

test('[회귀] 코드 밖의 진짜 선언은 코드 예시와 섞여 있어도 읽는다', () => {
  const doc = '# 설명\n\n<!-- 파생: docs/진짜.md@v2 -->\n\n```\n<!-- 파생: docs/예시.md -->\n```\n';
  assert.deepStrictEqual(G.parseEdgesFull(doc), [{ target: 'docs/진짜.md', version: 'v2' }]);
});

test('[회귀] 표기법 설명 문서가 자기 예시 때문에 낡음으로 잡히지 않는다', () => {
  const g = G.build();
  assert.ok(!g.stale.some((s) => s.from === 'docs/_ops/부패점검.md'),
    '도구를 설명하는 문서가 그 도구에 걸린다 — 알림 전체가 신뢰를 잃는다');
  assert.ok(!g.docs.get('docs/_ops/부패점검.md').edges.length,
    '설명 문서에는 진짜 파생 엣지가 없다');
});

test('[회귀] --add가 코드 펜스 안의 예시를 덮어쓰지 않는다', () => {
  const name = `docgraph-mask-${process.pid}.md`;
  const target = path.join(ROOT, 'docs', name);
  const body = '# 임시\n\n<!-- 파생: docs/브랜드_폰트_정본.md -->\n\n```\n<!-- 파생: docs/예시정본.md -->\n```\n';
  fs.writeFileSync(target, body, 'utf8');
  try {
    G.addEdge(`docs/${name}`, ['docs/반편성_정본_v2.md']);
    const after = fs.readFileSync(target, 'utf8');
    assert.ok(after.includes('<!-- 파생: docs/예시정본.md -->'), '코드 펜스 안의 예시가 지워졌다');
    assert.ok(after.includes('docs/반편성_정본_v2.md'), '새 엣지가 안 심겼다');
    assert.ok(after.includes('docs/브랜드_폰트_정본.md'), '기존 엣지가 사라졌다');
  } finally {
    fs.unlinkSync(target);
  }
});
