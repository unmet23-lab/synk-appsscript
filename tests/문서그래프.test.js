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

/* [2026-08-04] 정본 경로를 **리터럴로 박지 않는다.** 이 파일은 바로 아래(§시간축)에서 「버전 리터럴은
 * 지키는 게 아니라 인질이었다」를 이미 배웠는데, **경로**엔 그 교훈을 안 썼다. 그 대가:
 * 유호님이 급여·수업규칙 정본을 `About Syestem/SYNK_리라이팅_v2/` 로 옮기자(b454140+dee30cf)
 * 이 파일의 테스트 5개가 ENOENT 로 죽어 master 가 빨개졌다 — **정작 재려던 성질(파생 엣지·훅 알림)은
 * 멀쩡했는데** 주소를 못 찾아 죽은 것이다. 파일이 옮겨졌다는 사실 자체는 `깨진 참조는 없다`가 잡는다.
 *   → 이름으로 찾는다. 못 찾으면 조용히 건너뛰지 말고 **거기서 실패한다**(0건 통과 방지). */
function 정본찾기(파일명) {
  const 뿌리 = path.join(ROOT, 'docs', '정본');
  const 훑기 = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? 훑기(p) : (e.name === 파일명 ? [p] : []);
  });
  const 찾음 = 훑기(뿌리);
  assert.strictEqual(찾음.length, 1,
    `docs/정본 아래에서 "${파일명}" 을 ${찾음.length}개 찾았다 — 0이면 이름이 바뀐 것이고, 2 이상이면 사본이 생긴 것이다`);
  return { abs: 찾음[0], rel: G.rel(찾음[0]) };
}

const 급여정본 = 정본찾기('SYNK LAB 급여 인센티브 정본.txt');

test('파생 주석 파싱 — 여러 줄·쉼표 나열 모두 읽는다', () => {
  const edges = G.parseEdges('제목\n<!-- 파생: a.md, b.md -->\n본문\n<!-- 파생: c.md -->\n');
  assert.deepStrictEqual(edges, ['a.md', 'b.md', 'c.md']);
});

test('정본 판별 — 파일명 또는 docs/정본/ 아래', () => {
  assert.ok(G.isCanon('docs/브랜드_폰트_정본.md'));
  assert.ok(G.isCanon(급여정본.rel));
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
  const list = g.derivedOf.get(급여정본.rel) || [];
  assert.ok(list.includes('docs/개원재무_2027_재산정_v1.md'), '개원재무는 급여 정본의 파생이다');
  assert.ok(list.length >= 3, `파생이 ${list.length}종 — 엣지가 사라졌는지 확인할 것`);
});

test('깨진 참조는 없다 — 있으면 알림이 거짓말을 한다', () => {
  assert.deepStrictEqual(G.build().broken, []);
});

/* [2026-08-15] 탐지는 옳았는데 **처방이 없어** 적색이 오래 앉아 있던 자리(clasp-guard 가 그동안 모두의
 * 배포를 막는다). `docs/브랜드킷.html` 의 `파생:` 이 경로 뒤에 산문을 이어 붙여 깨진 참조 1건이 됐고,
 * 문구가 「가리키는 정본이 없다」 하나뿐이라 읽은 세션이 **실재하는 파일을 찾으러 갔다.** 갈래를 가른다.
 * ⚠ 탐지력은 픽스처로 못박고, 실저장소에는 거짓양성만 검사한다(실저장소가 빨간 채여야 통과하는 회귀 금지). */
test('산문이 섞인 파생은 「없는 파일」이 아니라 「산문」으로 분류한다 — 픽스처', () => {
  const stem = `docgraph-prose-${process.pid}`;
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  // 실제로 물린 모양 그대로 — 한 주석 안에서 줄을 넘어가며 산문이 목록에 붙는다.
  fs.writeFileSync(derived,
    `# 임시 파생\n\n<!-- 파생: docs/문서_지도.md · 로고 도형 = docs/문서_지도.md §3 복사\n     조립: python tools/x.py — 손 편집 금지 -->\n`,
    'utf8');
  try {
    const hits = G.build().broken.filter((b) => b.from === `docs/${stem}_파생.md`);
    assert.strictEqual(hits.length, 1, `깨진 참조 ${hits.length}건 — 산문 조각 하나가 잡혀야 한다`);
    assert.strictEqual(hits[0].kind, '산문',
      `산문 조각을 "${hits[0].kind}" 로 분류했다 — 「없는파일」이면 읽는 사람이 실재하는 파일을 찾으러 간다`);
  } finally {
    fs.unlinkSync(derived);
  }
});

test('진짜 오탈자 경로는 그대로 「없는파일」이다 — 갈래를 나누다 처방을 뒤바꾸면 안 된다', () => {
  const stem = `docgraph-typo-${process.pid}`;
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  fs.writeFileSync(derived, `# 임시 파생\n\n<!-- 파생: docs/${stem}_없는정본.md -->\n`, 'utf8');
  try {
    const hits = G.build().broken.filter((b) => b.from === `docs/${stem}_파생.md`);
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].kind, '없는파일');
  } finally {
    fs.unlinkSync(derived);
  }
});

test('경로 모양 판정은 공백을 근거로 쓰지 않는다 — 실저장소 정본 6종에 공백이 실재한다', () => {
  // 거짓양성이 나면 멀쩡한 엣지가 「산문」으로 불린다. 실측 경로를 그대로 넣어 못박는다.
  assert.ok(G.looksLikePath('docs/정본/SYNK LAB/SYNK LAB 소개서.txt'), '공백 든 실재 정본을 산문으로 봤다');
  assert.ok(G.looksLikePath('docs/디자인_토큰.json'));
  assert.ok(!G.looksLikePath('로고 도형 = docs/발표물/_브랜드킷.md §3 복사'), '§ 뒤가 붙은 산문을 경로로 봤다');
  assert.ok(!G.looksLikePath('docs/a.md\n     조립: python tools/x.py'), '줄을 넘는 조각을 경로로 봤다');
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
    /* ⚠ 대상은 **마크다운 문서**다 — `코드만()` 으로 감싸지 않는다(갈래 ⓒ 비JS · 대기열 #Q72). */
    assert.ok(!fs.readFileSync(target, 'utf8').includes('파생'), '거부됐으면 파일이 안 바뀌어야 한다');
  } finally {
    fs.unlinkSync(target);
  }
});

test('훅: 정본을 편집하면 파생 목록을 알린다', () => {
  const out = runHook(급여정본.abs);
  assert.ok(out, '정본 편집인데 침묵하면 장치가 죽은 것');
  const j = JSON.parse(out);
  assert.ok(j.hookSpecificOutput.additionalContext.includes('개원재무'));
});

test('훅은 절대 차단하지 않는다 — permissionDecision을 내지 않는다', () => {
  const out = runHook(급여정본.abs);
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
  assert.strictEqual(runHook(급여정본.abs, 'Read'), '');
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

/* [2026-08-04] 이 테스트는 원래 실저장소 정본의 버전을 **리터럴로 박고** 있었다.
 * 그 결과 정본이 개정될 때마다 테스트가 따라 깨졌고, 하루에 두 번(급여 v1.5 → v1.6)
 * master를 빨갛게 만들어 남의 배포를 멈춰 세웠다. 리터럴은 지키는 게 아니라 인질이었다.
 *   → 지키려는 성질을 그대로 쓴다: 「그래프가 읽은 버전 = 본문이 말하는 버전」,
 *     그리고 「그 값은 파일명 stem이 아니다」. 판번호가 올라도 이 성질은 안 변한다.
 * (같은 결: worktree-version-collision — 특정 문구에 앵커 걸면 그 문구가 바뀔 때 가드가 죽는다) */
const CANON_SAMPLES = [
  'docs/반편성_정본_v2.md',                                  // 파일명 stem(v2) ≠ 본문(v2.3)
  급여정본.rel,                                              // 파일명에 버전이 아예 없다
];

test('정본 버전은 본문에서 읽는다 — 파일명을 믿으면 틀린다', () => {
  const g = G.build();
  for (const rel of CANON_SAMPLES) {
    const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const fromBody = G.canonVersion(body);
    assert.match(String(fromBody), /^v\d+(\.\d+)+$/, `${rel} 머리말에서 버전을 못 읽었다`);
    assert.strictEqual(g.docs.get(rel).version, fromBody,
      `${rel} — 그래프가 본문이 아닌 다른 곳에서 버전을 읽고 있다`);
    // 파일명에서 주워온 값이면 stem과 같아진다(`_v2.md` → 'v2').
    const stem = (path.basename(rel).match(/_(v\d+(?:\.\d+)*)\./) || [])[1];
    if (stem) assert.notStrictEqual(fromBody, stem, `${rel} — 파일명 stem을 버전으로 읽었다`);
  }
});

/* 위 사고의 재발 방지 — 실저장소 정본의 버전을 리터럴로 단언하면 이 파일이 스스로 막는다.
 * 픽스처(임시로 쓰고 지우는 docgraph-* 파일)는 리터럴을 계속 써도 된다. 거기가 탐지 능력을
 * 못박는 자리이고, 남이 개정할 일이 없어 인질이 되지 않는다. */
test('가드: 실저장소 정본의 버전을 리터럴로 박지 않는다', () => {
  const self = fs.readFileSync(__filename, 'utf8').split('\n');
  const offenders = self
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(({ line }) => /docs\/[^'"]*정본[^'"]*['"]\)\s*\.version\s*,\s*['"]v\d/.test(line));
  assert.deepStrictEqual(offenders.map((o) => o.no), [],
    '정본 버전을 리터럴로 단언하면 개정될 때마다 빨간불이 된다 — 본문에서 읽어 대조하라');
});

test('머리말 밖의 vN은 버전이 아니다 — 본문을 훑으면 아무 숫자나 집는다', () => {
  const long = ['# 제목', '', '내용', '', '', '', '', '', '', '', '', '', '', '한참 뒤에 v9.9 라고 적힘'];
  assert.strictEqual(G.canonVersion(long.join('\n')), null);
  assert.strictEqual(G.canonVersion('# 반편성 정본 v2.3 — 4실'), 'v2.3');
  assert.strictEqual(G.canonVersion('제목만 있고 버전이 없다'), null, '못 읽으면 null이지 추측이 아니다');
});

/* [2026-08-03] 이 테스트는 처음에 **실저장소의 낡은 인용 3건**을 세도록 썼다가,
 * 그 3건을 고치자마자 스스로 깨졌다. 회귀 테스트가 「버그가 아직 있을 것」을 요구하면
 * 고치는 순간 빨간불이 되고, 다음 사람은 테스트를 고치는 게 아니라 **꺼버린다.**
 * 그래서 탐지 능력은 픽스처로 못박고, 실저장소에는 거짓양성만 검사한다. */
test('낡은 인용을 잡는다 — 픽스처(정본 v2.3 vs 파생 v1.0)', () => {
  const stem = `docgraph-stale-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_정본.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  fs.writeFileSync(canon, '# 임시 정본 v2.3 — 시험용\n', 'utf8');
  fs.writeFileSync(derived, `# 임시 파생\n\n<!-- 파생: docs/${stem}_정본.md@v1.0 -->\n`, 'utf8');
  try {
    const g = G.build();
    const hit = g.stale.find((s) => s.from === `docs/${stem}_파생.md`);
    assert.ok(hit, '정본이 v2.3인데 v1.0을 인용하는 파생을 못 잡았다');
    assert.strictEqual(hit.cited, 'v1.0');
    assert.strictEqual(hit.now, 'v2.3');
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

test('버전이 같으면 낡음이 아니다 — 거짓양성이 나면 알림 전체가 신뢰를 잃는다', () => {
  const stem = `docgraph-fresh-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_정본.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  fs.writeFileSync(canon, '# 임시 정본 v2.3 — 시험용\n', 'utf8');
  fs.writeFileSync(derived, `# 임시 파생\n\n<!-- 파생: docs/${stem}_정본.md@v2.3 -->\n`, 'utf8');
  try {
    assert.ok(!G.build().stale.some((s) => s.from === `docs/${stem}_파생.md`));
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

test('실저장소: 현재 판을 인용한 파생은 낡음으로 올라오지 않는다', () => {
  // 정본을 특정하지 않는다 — 「인용한 값 = 지금 값」인데 낡음으로 잡혔으면 그 자체가 거짓양성이다.
  // 버전 리터럴이 없으므로 어느 정본이 개정돼도 이 테스트는 따라 깨지지 않는다(오히려 범위는 넓어졌다).
  const wrong = G.build().stale.filter((s) => s.cited === s.now);
  assert.deepStrictEqual(wrong, [], '이미 맞춘 문서를 낡음으로 올렸다');
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

/* ── 지도 누락 ─────────────────────────────────────────────────────────────
 * [2026-08-07] 엣지 검사가 못 보는 축: *연결이 낡았다*가 아니라 *색인에 아예 없다*.
 * 실사고 — 08-05 신설 `제품방향.md`가 스스로 「공용 정본」을 선언하는데 `문서_지도.md`는
 * 「제품 방향의 최신 정본 = SYNK_CONTEXT.md」인 채였다(정본 지목 두 갈래, 사흘).
 * 탐지력은 **픽스처로** 못박는다 — 실저장소 누락 건수를 박으면 그것을 고치는 순간 빨개진다
 * (가드의 맹점 ②: 버그가 아직 있을 것을 요구하는 회귀 금지). 실저장소에는 거짓양성만 검사한다.
 */
const 지도픽스처 = (지도본문, ...경로들) => new Map([
  ['docs/문서_지도.md', { rel: 'docs/문서_지도.md', text: 지도본문 }],
  ...경로들.map((r) => [r, { rel: r, text: '' }]),
]);

test('지도 누락 — 색인 밖 최상위 문서를 잡는다(픽스처)', () => {
  const g = G.findMapGaps(지도픽스처(
    '| **세션보드.md** | 선언판 |\n',
    'docs/세션보드.md', 'docs/제품방향.md', 'docs/코어엔진_설계.md',
  ));
  assert.equal(g.noMap, false);
  assert.deepEqual(g.missing, ['docs/제품방향.md', 'docs/코어엔진_설계.md']); // 가나다순(ㅈ→ㅋ)
});

test('지도 누락 — 하위 폴더는 안 센다(지도가 폴더 단위로 적는 자리)', () => {
  const g = G.findMapGaps(지도픽스처('| _ops/ | 마찰신호 |\n', 'docs/_ops/마찰신호.md', 'docs/정본/급여.md'));
  assert.deepEqual(g.missing, [], '하위 폴더 문서가 누락으로 올라왔다 — 알림이 매주 거짓말을 한다');
});

test('지도 누락 — 비슷한 이름에 묻히지 않는다(제품방향.md ≠ 제품방향_대조감사.md)', () => {
  const g = G.findMapGaps(지도픽스처('| 제품방향_대조감사.md | 감사 |\n', 'docs/제품방향.md'));
  assert.deepEqual(g.missing, ['docs/제품방향.md'], '긴 이름에 짧은 이름이 묻혀 미탐이 났다');
});

test('지도가 없으면 「누락 0」이 아니라 noMap 이다(미실행이 통과처럼 보이면 안 된다)', () => {
  const g = G.findMapGaps(new Map([['docs/제품방향.md', { rel: 'docs/제품방향.md', text: '' }]]));
  assert.equal(g.noMap, true);
  assert.deepEqual(g.missing, []);
});

test('실저장소: 지도에 실렸다고 판정한 문서는 진짜로 실려 있다(거짓양성 0)', () => {
  const g = G.build();
  assert.equal(g.mapGaps.noMap, false, `${G.DOC_MAP} 을 못 읽었다`);
  const 실린것 = [...g.docs.keys()]
    .filter((r) => /^docs\/[^/]+\.md$/.test(r) && r !== G.DOC_MAP && !g.mapGaps.missing.includes(r));
  assert.ok(실린것.length > 0, '최상위 문서를 하나도 못 읽었다 — SKIP 규칙을 의심하라');
  const 지도 = g.docs.get(G.DOC_MAP).text;
  for (const r of 실린것) {
    assert.ok(지도.includes(path.basename(r)), `${r} 을 「실렸다」로 판정했는데 지도 본문에 없다`);
  }
});

/* [2026-08-08 · F243] 정본을 **구현하는 코드**가 그래프 밖에 있었다.
 * 실측: 급여 정본 v1.6 이 재등록 배점을 30점으로 올렸을 때 문서 파생 5종은 전부 @v1.6 으로 최신이었고,
 * 낡은 것은 엣지가 없던 `엔진_운영배치.js` 하나였다 — 그래서 doc-propagation 도 rot-check 도 안 울렸다.
 * 탐지 능력은 아래 픽스처가 진다(실저장소 엣지 개수에 기대면 그것을 고치는 날 테스트가 깨진다). */
const 루트코드픽스처 = (stem, 본문) => {
  const f = path.join(ROOT, `${stem}.js`);
  fs.writeFileSync(f, 본문, 'utf8');
  return f;
};

test('코드 파일도 파생이다 — 루트 .js 의 엣지를 읽고 낡으면 잡는다(픽스처)', () => {
  const stem = `docgraph-code-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_정본.md`);
  fs.writeFileSync(canon, '# 임시 정본 v3.1 — 시험용\n', 'utf8');
  // 진짜 코드처럼 `//` 주석 안에 둔다 — 실제 심는 자리가 그 모양이다.
  const code = 루트코드픽스처(stem, `// 임시 코드\n// <!-- 파생: docs/${stem}_정본.md@v1.0 -->\nfunction a_() { return 1; }\n`);
  try {
    const g = G.build();
    assert.ok(g.docs.has(`${stem}.js`), '루트 .js 가 그래프에 아예 안 들어왔다');
    const hit = g.stale.find((s) => s.from === `${stem}.js`);
    assert.ok(hit, '정본이 v3.1 인데 v1.0 을 인용하는 **코드**를 못 잡았다');
    assert.strictEqual(hit.cited, 'v1.0');
    assert.strictEqual(hit.now, 'v3.1');
    // 정본을 편집하는 세션에게 이 코드가 파생으로 보여야 한다(doc-propagation 이 쓰는 바로 그 목록).
    assert.ok((g.derivedOf.get(`docs/${stem}_정본.md`) || []).includes(`${stem}.js`),
      'derivedOf 에 안 실리면 정본을 고치는 세션에게 코드가 안 보인다');
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(code);
  }
});

test('코드 스캔은 루트에서 멈춘다 — 하위 폴더로 내려가면 node_modules 를 훑는다', () => {
  const g = G.build();
  const 하위 = [...g.docs.keys()].filter((r) => /\.js$/i.test(r) && r.includes('/'));
  assert.deepStrictEqual(하위, [], '루트 밖 .js 가 들어왔다 — 재귀로 새면 node_modules·.git 까지 읽는다');
  assert.ok([...g.docs.keys()].some((r) => /^[^/]+\.js$/i.test(r)), '루트 .js 를 하나도 못 읽었다');
});

test('실저장소: 코드 파생에서 거짓양성이 안 난다(깨진 링크·이미 맞춘 인용)', () => {
  const g = G.build();
  const isJs = (r) => /\.js$/i.test(r);
  assert.deepStrictEqual(g.broken.filter((b) => isJs(b.from)), [], '코드가 없는 정본을 가리킨다');
  assert.deepStrictEqual(g.stale.filter((s) => isJs(s.from) && s.cited === s.now), [],
    '인용한 값 = 지금 값인데 낡음으로 올렸다');
});

/* [2026-08-09] 자기선언 정본 — `<!-- 정본: v1.0 -->`.
 * 왜 생겼나: isCanon 이 **파일명의 '정본' 글자와 `docs/정본/` 경로**만 봤다. 그래서 이 저장소에서
 * 가장 넓게 전파되는 정본(`docs/SYNK_철학.md` · 유호님 확정 08-09 「전 문서 리라이팅의 기준」)이
 * 그래프 밖에 있었고, 하루 15회 개정되는 동안 무엇이 낡았는지 아는 자리가 없었다(실측: 철학 몫 엣지 0).
 * 지키려는 성질: ①선언한 문서만 정본이 된다(옵트인 = 오탐 0) ②코드 펜스 속 예시는 안 센다
 * ③머리말 밖은 안 본다 ④선언한 버전이 머리말에서 주워 온 vN 을 **이긴다**. */
test('자기선언 정본 — 선언한 것만 읽고, 나머지는 null(오탐 0)', () => {
  assert.strictEqual(G.selfDeclaredCanon('# 제목\n<!-- 정본: v1.0 -->\n'), 'v1.0');
  assert.strictEqual(G.selfDeclaredCanon('# 제목\n<!--정본:v2.3-->\n'), 'v2.3', '공백 없는 표기도 같은 선언이다');
  assert.strictEqual(G.selfDeclaredCanon('# 제목\n> 이 문서가 정본이다 v1.0\n'), null,
    '산문에 "정본"과 vN 이 같이 있다고 정본이 되면 그건 옵트인이 아니라 수확이다');
  assert.strictEqual(G.selfDeclaredCanon('# 제목만 있다\n'), null);
});

test('자기선언 정본 — 코드 펜스 속 예시는 정본으로 세지 않는다', () => {
  // doc-graph 는 이 함정을 엣지 쪽에서 이미 한 번 밟았다(maskCode 주석). 같은 함정을 두 번 밟지 않는다.
  const 설명문서 = ['# 표기법 설명', '', '```', '<!-- 정본: v1.0 -->', '```', ''].join('\n');
  assert.strictEqual(G.selfDeclaredCanon(설명문서), null,
    '표기법을 설명하는 문서가 자기 예시 때문에 정본이 되면 도구가 자기 자신을 못 믿는다');
});

test('자기선언 정본 — 머리말 밖의 선언은 안 읽는다', () => {
  const 늦은선언 = ['# 제목', '', '', '', '', '', '', '', '', '', '', '', '<!-- 정본: v1.0 -->'].join('\n');
  assert.strictEqual(G.selfDeclaredCanon(늦은선언), null, 'canonVersion 과 같은 창(머리말)만 본다');
});

test('자기선언 정본 — 낡은 인용을 실제로 잡는다(픽스처 · 파일명에 "정본" 없음)', () => {
  // 탐지력을 픽스처로 못박는다. 파일명에 '정본'을 넣지 않는 것이 이 시험의 급소다 —
  // 넣으면 옛 isCanon 만으로도 통과해서, 자기선언이 죽어도 초록이 된다.
  const stem = `docgraph-self-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_철학.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  fs.writeFileSync(canon, '# 임시 철학\n<!-- 정본: v2.0 -->\n', 'utf8');
  fs.writeFileSync(derived, `# 임시 파생\n\n<!-- 파생: docs/${stem}_철학.md@v1.0 -->\n`, 'utf8');
  try {
    const g = G.build();
    const rel = `docs/${stem}_철학.md`;
    assert.ok(g.docs.get(rel).canon, '선언했는데 정본으로 안 섰다');
    assert.strictEqual(g.docs.get(rel).version, 'v2.0');
    const hit = g.stale.find((s) => s.from === `docs/${stem}_파생.md`);
    assert.ok(hit, '정본 v2.0 을 v1.0 으로 인용한 파생을 못 잡았다');
    assert.strictEqual(hit.cited, 'v1.0');
    assert.strictEqual(hit.now, 'v2.0');
    // 정본을 고치는 세션에게 보여야 한다 — doc-propagation 훅이 읽는 바로 그 목록.
    assert.ok((g.derivedOf.get(rel) || []).includes(`docs/${stem}_파생.md`),
      'derivedOf 에 안 실리면 철학을 고쳐도 아무에게도 안 보인다');
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

test('자기선언 정본 — 선언한 버전이 머리말의 다른 vN 을 이긴다', () => {
  const stem = `docgraph-selfwin-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_철학.md`);
  // 머리말에 v9.9 가 먼저 나온다. 주워 온 값이 이기면 선언은 장식이 된다.
  fs.writeFileSync(canon, '# 임시 철학 — 앱 v9.9 기준\n<!-- 정본: v1.0 -->\n', 'utf8');
  try {
    assert.strictEqual(G.build().docs.get(`docs/${stem}_철학.md`).version, 'v1.0');
  } finally {
    fs.unlinkSync(canon);
  }
});

/* [2026-08-09] **선언은 있는데 파서가 그 파일을 안 열었다** — 같은 결함의 2번째다.
 * 1번째(F243)는 루트 `.js` 가 스캔 밖이라 급여 정본 v1.6 개정이 코드에 4일간 안 닿았고,
 * 2번째는 `docs/홈페이지_시안/시안.html`·`시안.tpl.html` 이 `<!-- 파생: docs/SYNK_철학.md@v1.0 -->`
 * 를 **이미 선언해 놓았는데** `TEXT_EXT` 가 `md|txt` 뿐이라 열리지 않았다. 결과 = 철학 정본의
 * 파생 엣지 0종, 그런데 그 정본 머리는 그 엣지 수를 「전 문서 리라이팅 진행을 세는 유일한 자리」로
 * 적어 두었다. 새는 방향이 「통과」도 아니고 **「0」**이라 「전파 안 됨」과 구별되지 않았다.
 * 그래서 확장자를 하나 더 붙이는 데서 멈추지 않는다 — 아래 가드가 **계열 전체**를 막는다:
 * 앞으로 `.svg`·`.json`·`.ts` 어디에 선언해도, 열리지 않으면 여기서 빨개진다. */
test('[회귀] .html 파생 선언을 읽는다 — 확장자가 빠지면 엣지가 조용히 0이 된다(픽스처)', () => {
  const stem = `docgraph-html-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_정본.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.html`);
  fs.writeFileSync(canon, '# 임시 정본 v4.2 — 시험용\n', 'utf8');
  // 엣지 표기는 원래 HTML 주석이라 `.html` 안에서는 이게 **자연스러운 자리**다(주석으로 감쌀 필요 없음).
  fs.writeFileSync(derived, `<!-- 파생: docs/${stem}_정본.md@v1.0 -->\n<p>임시</p>\n`, 'utf8');
  try {
    const g = G.build();
    assert.ok(g.docs.has(`docs/${stem}_파생.html`), '.html 이 그래프에 아예 안 들어왔다');
    const hit = g.stale.find((s) => s.from === `docs/${stem}_파생.html`);
    assert.ok(hit, '정본이 v4.2 인데 v1.0 을 인용하는 .html 을 못 잡았다');
    assert.strictEqual(hit.cited, 'v1.0');
    assert.strictEqual(hit.now, 'v4.2');
    // 정본을 편집하는 세션에게 이 .html 이 파생으로 보여야 한다(doc-propagation 이 읽는 목록).
    assert.ok((g.derivedOf.get(`docs/${stem}_정본.md`) || []).includes(`docs/${stem}_파생.html`),
      'derivedOf 에 안 실리면 정본을 고치는 세션에게 렌더물이 안 보인다');
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

/* [2026-08-09] --add 의 **자리**는 형식마다 다르다. 원래 규칙은 「첫 `# ` 다음」 하나뿐이어서
 * `# ` 이 없는 `.txt`·`.html` 은 전부 `at=0` 으로 떨어져 **파일 맨 첫 줄**에 박혔다.
 * `.txt` 에서 그건 유호님이 읽는 정본의 첫 줄이 기계 표기가 된다는 뜻이다(눈높이 상시 지시).
 * 다른 가드와 달리 이 사고는 조용하지 않고 **문서에 남는다** — 그래서 자리를 못박는다. */
test('[회귀] --add 자리 — .txt 는 꼬리 각주로 간다(첫 줄에 기계 표기가 박히지 않는다)', () => {
  const stem = `docgraph-place-txt-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_정본.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.txt`);
  const 첫줄 = 'SYNK 임시 소개서';
  fs.writeFileSync(canon, '# 임시 정본 v1.0 — 시험용\n', 'utf8');
  fs.writeFileSync(derived, `${첫줄}\n부제 한 줄\n\n본문.\n`, 'utf8');
  try {
    assert.ok(G.addEdge(`docs/${stem}_파생.txt`, [`docs/${stem}_정본.md@v1.0`]), 'addEdge 가 아무것도 안 썼다');
    const lines = fs.readFileSync(derived, 'utf8').split('\n');
    assert.strictEqual(lines[0], 첫줄, '.txt 첫 줄이 기계 표기로 밀렸다 — 사람이 읽는 자리다');
    assert.ok(!lines.slice(0, 4).some((l) => l.includes('<!-- 파생')), '머리 4줄 안에 엣지가 들어왔다');
    assert.ok(lines.some((l) => l.trim() === `<!-- 파생: docs/${stem}_정본.md@v1.0 -->`), '엣지 줄을 아예 못 찾았다');
    assert.ok(lines.some((l) => l.startsWith('※')), '.txt 엔 주석 문법이 없다 — 무엇인지 밝히는 줄이 함께 있어야 한다');
    // 심은 뒤 진짜로 그래프에 서는지 — 자리를 옮겨 파서가 놓치면 「예쁘지만 안 도는」 상태가 된다.
    assert.ok((G.build().derivedOf.get(`docs/${stem}_정본.md`) || []).includes(`docs/${stem}_파생.txt`));
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

test('[회귀] --add 자리 — .html 은 doctype 뒤로 간다(doctype 을 밀어내면 렌더가 깨진다)', () => {
  const stem = `docgraph-place-html-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_정본.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.html`);
  fs.writeFileSync(canon, '# 임시 정본 v1.0 — 시험용\n', 'utf8');
  fs.writeFileSync(derived, '<!doctype html>\n<html><body>임시</body></html>\n', 'utf8');
  try {
    assert.ok(G.addEdge(`docs/${stem}_파생.html`, [`docs/${stem}_정본.md@v1.0`]));
    const lines = fs.readFileSync(derived, 'utf8').split('\n');
    assert.match(lines[0], /^<!doctype html>$/i, 'doctype 이 첫 줄에서 밀렸다 — 브라우저가 quirks 모드로 떨어진다');
    assert.strictEqual(lines[1].trim(), `<!-- 파생: docs/${stem}_정본.md@v1.0 -->`);
    assert.ok((G.build().derivedOf.get(`docs/${stem}_정본.md`) || []).includes(`docs/${stem}_파생.html`));
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

test('[회귀] --add 자리 — .md 는 첫 제목 다음(기존 규칙이 안 바뀌었다)', () => {
  const stem = `docgraph-place-md-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_정본.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  fs.writeFileSync(canon, '# 임시 정본 v1.0 — 시험용\n', 'utf8');
  fs.writeFileSync(derived, '# 임시 파생\n\n본문.\n', 'utf8');
  try {
    assert.ok(G.addEdge(`docs/${stem}_파생.md`, [`docs/${stem}_정본.md@v1.0`]));
    const lines = fs.readFileSync(derived, 'utf8').split('\n');
    assert.strictEqual(lines[0], '# 임시 파생');
    assert.strictEqual(lines[2].trim(), `<!-- 파생: docs/${stem}_정본.md@v1.0 -->`);
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

/* [2026-08-12 · F307] --add 자리 — `.js`.
 * `.js` 는 `.txt`·`.html` 갈래 어디에도 안 걸려 **마크다운 자리**로 떨어졌고, `# ` 이 없으니 `at=0` →
 * 파일 맨 앞에 **날 HTML 주석**이 박혔다(실측 `contents_상담AI.js`).
 * 🔴 급소는 「기계가 이걸 통과시킨다」다: `<!--` 는 sloppy 스크립트의 Annex B 한 줄 주석이라
 *   `node --check` 가 exit 0 을 내고 Apps Script 라이브에서도 안 터진다. 배포 전 구문검사가 눈이 멀어
 *   있어 증상은 「조용함」뿐 — 그래서 **구문검사로는 이 회귀를 못 짠다.** 표기를 직접 못박는다.
 * 🔑 탐지력은 **픽스처 문자열**이 진다(`엣지본문` 은 순수 함수라 파일을 안 만든다) — 실저장소는
 *   아래 「거짓양성만」 검사가 따로 본다. 실저장소에 위반을 심어 놓고 재면 그 순간이 사고다. */
test('[회귀·F307] --add 자리 — .js 는 `// ` 로 감싸고 머리 주석 다음에 온다(날 HTML 주석 금지)', () => {
  const 줄 = '<!-- 파생: docs/SYNK_철학.md@v1.0 -->';
  const 심은 = G.엣지본문('// SYNK 엔진 분할부\n// 로드 순서 정본 = .clasp.json\n\nfunction a_() {}\n', 줄, '엔진_x.js');
  const lines = 심은.split('\n');
  assert.strictEqual(lines[2], `// ${줄}`,
    `머리 주석 블록 바로 다음이 아니다 — 실제 표기 정본은 엔진_운영배치.js:3 이다:\n${심은}`);
  assert.strictEqual(lines[0], '// SYNK 엔진 분할부', '그 파일이 무엇인지 말하는 첫 줄을 기계 표기가 밀어냈다');
  assert.ok(!lines.some((l) => /^\s*<!--/.test(l)),
    `감싸지 않은 HTML 주석 줄이 남았다 — node --check 는 이걸 통과시킨다(Annex B):\n${심은}`);
  // 심은 뒤 파서가 그대로 읽어야 한다 — 예쁘게 감싸고 그래프에서 사라지면 「0」이 「없음」으로 읽힌다.
  assert.deepStrictEqual(G.parseEdges(심은), ['docs/SYNK_철학.md']);
});

test('[회귀·F307] --add 자리 — .js 머리가 셔뱅·use strict 여도, 아예 없어도 감싸개는 안 빠진다', () => {
  const 줄 = '<!-- 파생: docs/a.md@v1.0 -->';
  const 셔뱅 = G.엣지본문("#!/usr/bin/env node\n// doc-graph\n'use strict';\nconst fs = require('fs');\n", 줄, 'tools/x.js');
  assert.strictEqual(셔뱅.split('\n')[3], `// ${줄}`, `셔뱅·use strict 다음이 아니다:\n${셔뱅}`);
  // 머리가 없는 파일 — 맨 위여도 **감싸개는 남는다**(자리보다 감싸개가 급소다).
  const 민파일 = G.엣지본문('function a_() {}\n', 줄, 'x.js');
  assert.strictEqual(민파일.split('\n')[0], `// ${줄}`, `머리 없는 .js 에서 감싸개가 빠졌다:\n${민파일}`);
  // 블록 주석 앞에서 멈춘다 — 안으로 밀어 넣으면 엣지가 주석 «안»에 갇혀 파서가 영원히 0을 낸다.
  const 블록 = G.엣지본문('/* 여러 줄\n   머리 */\nfunction a_() {}\n', 줄, 'x.js');
  assert.strictEqual(블록.split('\n')[0], `// ${줄}`, `블록 주석 안으로 들어갔다:\n${블록}`);
  assert.deepStrictEqual(G.parseEdges(블록), ['docs/a.md']);
});

test('[회귀] --add 는 파일의 개행을 따른다 — CRLF 파일에 LF 한 줄을 섞지 않는다', () => {
  const 줄 = '<!-- 파생: docs/a.md@v1.0 -->';
  const 심은 = G.엣지본문('// 머리\r\n\r\nfunction a_() {}\r\n', 줄, 'x.js');
  assert.ok(!/[^\r]\n/.test(심은), `개행이 섞였다(끼워 넣은 줄만 LF) — 다음 사람의 diff 에서야 드러난다:\n${JSON.stringify(심은)}`);
  assert.strictEqual(심은.split('\r\n')[1], `// ${줄}`);
});

test('[회귀] --stamp 갈래(이미 있는 엣지 갱신)는 .js 의 `// ` 감싸개를 산 채로 둔다', () => {
  const 심은 = G.엣지본문('// 머리\n// <!-- 파생: docs/a.md -->\nfunction a_() {}\n',
    '<!-- 파생: docs/a.md@v1.3 -->', 'x.js');
  assert.strictEqual(심은.split('\n')[1], '// <!-- 파생: docs/a.md@v1.3 -->',
    `자리 갱신이 감싸개를 벗겼다 — --stamp 를 한 번 돌 때마다 날 주석이 된다:\n${심은}`);
});

/* 거짓양성만 검사한다 — 탐지력은 위 픽스처가 이미 졌다(가드 3맹점 ②).
 * 분모를 밝힌다: 0건이면 「위반 없음」이 아니라 **스캐너가 안 돈 것**이고 둘은 같은 초록이다(F207). */
test('[회귀·F307] 실저장소: 추적되는 .js 에 감싸지 않은 HTML 주석이 없다(거짓양성만)', () => {
  const 목록 = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-z', '--', '*.js'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split('\0').filter(Boolean);
  assert.ok(목록.length > 50, `.js 를 ${목록.length}개만 봤다 — 분모가 이렇게 작으면 초록이 미실행이다`);

  const 위반 = [];
  for (const f of 목록) {
    let src;
    try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { continue; }
    if (!src.includes('<!--')) continue;
    src.split(/\r?\n/).forEach((l, i) => {
      // 줄 어디에 있든 상관없다 — 재는 것은 「그 앞에 무엇이 있는가」다.
      // 문자열 리터럴 안의 예시(도구·테스트가 표기법을 설명하며 든다)는 `'`·`"`·백틱이 앞에 오고,
      // 블록 주석 본문은 `*` 가 앞에 온다. 앞이 **비어 있을 때만** 날 주석이다.
      const at = l.indexOf('<!--');
      if (at < 0) return;                                   // 없는 줄에 -1 을 slice 하면 전 줄이 「앞」이 된다
      if (/^\s*$/.test(l.slice(0, at))) 위반.push(`${f}:${i + 1}  ${l.trim().slice(0, 80)}`);
    });
  }
  assert.deepStrictEqual(위반, [],
    `줄 첫머리에 날 HTML 주석이 있는 .js — node --check 는 Annex B 로 통과시킨다(F307).\n감싸개 \`// \` 를 붙여라:\n${위반.join('\n')}`);
});

/* 계열 차단 — **doc-graph 의 walk 를 쓰지 않고** 직접 훑는다. 재려는 것이 바로 그 walk 의 사각이라,
 * 같은 walk 로 재면 사각을 사각으로 검사하는 셈이 된다(가드가 자기 전처리에 눈이 먼 형태).
 * 범위 = doc-graph 가 **덮으려는** 자리만: `docs/**`(의도적 제외인 SKIP 은 그대로 상속) + 저장소 루트 얕게.
 *   → `tools/`·`tests/` 는 애초에 스캔 범위 밖이다(그 파일들이 표기법을 **설명**하며 예시를 문자열로 들고 있다).
 *   → `docs/_archive/` 는 G.shouldSkip 이 거른다 — 하드코딩하지 않고 도구의 판정을 그대로 쓴다.
 * 분모를 밝힌다 — 0건이면 「위반 없음」이 아니라 **스캐너가 안 돈 것**이고, 둘은 같은 초록으로 보인다(F207). */
test('[회귀·계열] 파생을 선언한 docs·루트 파일은 전부 그래프 안에 있다 — 확장자 누락의 전 계열을 막는다', () => {
  const BIN = /\.(pdf|png|jpe?g|gif|webp|ico|otf|ttf|woff2?|zip|mp4|mp3|wav|m4a|xlsx?|docx?|pptx?|glb|psd|ai)$/i;
  const 선언한것 = [];

  const 읽어보기 = (abs) => {
    const r = G.rel(abs);
    if (G.shouldSkip(r) || BIN.test(abs)) return;
    let text;
    try {
      if (fs.statSync(abs).size > 2e6) return;
      text = fs.readFileSync(abs, 'utf8');
    } catch (_) { return; }
    if (!text.includes('파생')) return;
    // G.parseEdges 를 쓴다 — 코드 펜스 마스킹까지 **본체와 같은 판정**이어야 거짓양성이 안 난다.
    if (G.parseEdges(text).length) 선언한것.push(r);
  };

  (function 훑기(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (G.shouldSkip(G.rel(abs))) continue;
      if (e.isDirectory()) 훑기(abs); else 읽어보기(abs);
    }
  })(path.join(ROOT, 'docs'));

  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (e.isFile()) 읽어보기(path.join(ROOT, e.name));
  }

  // 픽스처가 아니라 실저장소 검사다 — 그래서 분모를 먼저 못박는다.
  assert.ok(선언한것.length >= 15,
    `파생을 선언한 파일을 ${선언한것.length}건밖에 못 찾았다 — 스캐너가 안 돈 것이지 위반이 없는 것이 아니다`);

  const g = G.build();
  const 밖 = 선언한것.filter((r) => !g.docs.has(r));
  assert.deepStrictEqual(밖, [],
    `파생을 선언했는데 그래프가 그 파일을 열지 않았다(분모 ${선언한것.length}건) — `
    + '선언이 장식이 된다. 고치는 자리는 선언 쪽이 아니라 tools/doc-graph.js 의 TEXT_EXT·SCAN_DIRS 다.');
});

/* [2026-08-10] 전파 보류 — `<!-- 전파보류: vN -->`.
 * 왜 있나: 철학 정본 v1.0→v1.3 의 파생 25종 전파를 유호님이 보류시켰는데, rot-check 는
 * 그 25건을 🔴 로 올렸다. 매 세션 적색 27건 중 25건이 「고치지 말라고 정해 둔 것」이라
 * ①진짜 적색 2건이 묻히고 ②세션이 그걸 놓친 일감으로 읽고 집었다(실측 08-10).
 *
 * 🔑 이 묶음의 급소는 **만료**다. 보류가 영구 면제가 되면 이 통로 자체가 은폐 장치가 된다. */
test('전파 보류 — 도장이 있으면 적색이 아니라 보류로 간다(픽스처)', () => {
  const stem = `docgraph-hold-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_철학.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  fs.writeFileSync(canon, '# 임시 철학\n<!-- 정본: v1.3 -->\n<!-- 전파보류: v1.3 -->\n', 'utf8');
  fs.writeFileSync(derived, `# 임시 파생\n\n<!-- 파생: docs/${stem}_철학.md@v1.0 -->\n`, 'utf8');
  try {
    const g = G.build();
    const from = `docs/${stem}_파생.md`;
    assert.ok(!g.stale.some((s) => s.from === from), '보류시킨 판인데 적색으로 올렸다');
    const held = g.staleHeld.find((s) => s.from === from);
    assert.ok(held, '보류 목록에도 없다 — 숨기면 「없는 것」이 된다(세어서 보이기는 해야 한다)');
    assert.strictEqual(held.cited, 'v1.0');
    assert.strictEqual(held.now, 'v1.3');
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

test('전파 보류 — 정본이 도장보다 더 오르면 보류가 만료돼 다시 적색이다(픽스처)', () => {
  // 이 시험이 이 묶음의 급소다. 이게 없으면 도장 한 번에 그 정본의 낡음이 영원히 안 보인다.
  const stem = `docgraph-holdexp-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_철학.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  fs.writeFileSync(canon, '# 임시 철학\n<!-- 정본: v1.4 -->\n<!-- 전파보류: v1.3 -->\n', 'utf8');
  fs.writeFileSync(derived, `# 임시 파생\n\n<!-- 파생: docs/${stem}_철학.md@v1.0 -->\n`, 'utf8');
  try {
    const g = G.build();
    const from = `docs/${stem}_파생.md`;
    assert.ok(!g.staleHeld.some((s) => s.from === from),
      'v1.3 보류 도장이 v1.4 개정까지 덮었다 — 보류가 영구 면제가 되면 은폐 장치다');
    const hit = g.stale.find((s) => s.from === from);
    assert.ok(hit, '보류가 만료됐는데 적색으로 안 돌아왔다');
    assert.strictEqual(hit.now, 'v1.4');
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

test('전파 보류 — 도장이 없으면 그대로 적색이다(도장이 새지 않는지)', () => {
  const stem = `docgraph-nohold-${process.pid}`;
  const canon = path.join(ROOT, 'docs', `${stem}_철학.md`);
  const derived = path.join(ROOT, 'docs', `${stem}_파생.md`);
  fs.writeFileSync(canon, '# 임시 철학\n<!-- 정본: v1.3 -->\n', 'utf8');
  fs.writeFileSync(derived, `# 임시 파생\n\n<!-- 파생: docs/${stem}_철학.md@v1.0 -->\n`, 'utf8');
  try {
    const g = G.build();
    const from = `docs/${stem}_파생.md`;
    assert.ok(g.stale.some((s) => s.from === from), '도장이 없는데 적색이 아니다');
    assert.ok(!g.staleHeld.some((s) => s.from === from), '도장 없이 보류로 샜다');
  } finally {
    fs.unlinkSync(canon);
    fs.unlinkSync(derived);
  }
});

test('전파 보류 파서 — 표기법을 설명하는 문서가 스스로 보류되지 않는다(maskCode)', () => {
  assert.strictEqual(G.selfDeclaredHold('# 제목\n<!-- 전파보류: v1.3 -->\n'), 'v1.3');
  assert.strictEqual(G.selfDeclaredHold('# 제목\n<!--전파보류:v2 -->\n'), 'v2', '공백 없는 표기도 같은 선언이다');
  const 설명문서 = ['# 표기법 설명', '', '```', '<!-- 전파보류: v1.3 -->', '```', ''].join('\n');
  assert.strictEqual(G.selfDeclaredHold(설명문서), null, '코드블록 안 예시가 진짜 도장이 됐다');
  assert.strictEqual(G.selfDeclaredHold('# 제목\n'), null);
});

test('실저장소: 적색과 보류는 겹치지 않는다 — 같은 건이 두 층에 있으면 분모가 두 번 세어진다', () => {
  const g = G.build();
  const key = (s) => `${s.from}→${s.target}`;
  const 적색 = new Set(g.stale.map(key));
  const 겹침 = g.staleHeld.filter((s) => 적색.has(key(s))).map(key);
  assert.deepStrictEqual(겹침, [], '한 건이 적색이면서 동시에 보류다');
});
