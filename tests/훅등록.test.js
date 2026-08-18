/**
 * 훅 등록층 회귀 — 「훅이 막는 것은 라우팅도 통과시켜야 한다」
 *
 * 왜 있나 (F044·F053 같은 자리, 세 번째):
 *   가드는 로직보다 **등록층**에서 샌다. 훅 파일이 멀쩡하고 자체 테스트가 초록이어도,
 *   settings.json 의 matcher/case 필터가 그 입력을 안 넘기면 훅은 **호출되지 않고**,
 *   호출되지 않는 방향은 언제나 「통과」다.
 *   2026-08-04 실측 — CLAUDE.md 가 「`git clean` 은 git-scope-guard 가 기계 차단」이라 적어둔 상태에서
 *   실제로는 필터가 `*"git add"*|*"git commit"*` 만 넘겨 **훅에 닿지도 않았다**(훅은 deny를 내는데).
 *   같은 이유로 `git -C <경로> add -A` 도 필터·훅 양쪽에서 빠져 있었다.
 *
 * 검사 방식 — 기대값을 하드코딩하지 않는다:
 *   케이스마다 ①훅에 직접 물어 판정을 받고 ②그 판정이 「막음」이면 라우팅도 통과해야 한다고 단언한다.
 *   훅이 안 막는 입력은 검사 대상이 아니다(거짓양성 방지). 이 불변식이면 **훅에 규칙이 늘어도**
 *   라우팅을 같이 안 넓히면 여기서 빨간불이 난다 — 그게 이번 사고의 재발 조건이다.
 *
 * ⚠ 실제 git/clasp 명령을 실행하지 않는다. 훅에 입력만 주고 판정을 읽는다.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process'); // bash 필터 재현용 — 훅은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

const ROOT = path.resolve(__dirname, '..');
// SYNK_TEST_SETTINGS = 변이 실험용 이음매. 평소엔 실등록을 본다(실저장소를 흔들지 않고 탐지력만 잰다).
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');
const HOOKS = path.join(ROOT, '.claude', 'hooks');

function settings() {
  return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
}

/**
 * settings.json 에서 훅별 { event, matcher, command } 를 뽑는다.
 *
 * ⚠ 전 이벤트를 훑는다 — PreToolUse 만 보던 시절엔 **다른 이벤트에 등록된 훅이 통째로 안 보였다**.
 *   「등록이 없으면 안 돈다」를 검사하는 테스트가 정작 등록층의 일부만 보면, 미등록 훅이
 *   초록으로 통과한다(가드가 새는 방향은 언제나 「통과」다 · F053).
 */
function registry() {
  const out = new Map();
  for (const [event, entries] of Object.entries(settings().hooks || {})) {
    for (const e of entries || []) {
      for (const h of e.hooks || []) {
        /* ⚠ `[a-z-]+` 로 좁히면 **한글 훅 파일명을 통째로 못 본다** — 등록이 있는데
         * 「등록이 없다」는 거짓 실패가 나고, 반대로 미등록 한글 훅은 조용히 통과한다
         * (실측 2026-08-18: `원격능력.js` 를 등록했는데 이 파서가 못 읽어 fail).
         * 이 저장소는 `tools/` 를 이미 한글로 짓는다(작업가지·대기열·보드수거…) —
         * 훅만 영문을 강제할 근거가 없으므로 **파서가 표기를 따라간다**(가드 맹점 ①). */
        const m = /hooks\/([^\s"'/]+?)\.js/.exec(String(h.command || ''));
        if (m) out.set(m[1], { event, matcher: e.matcher, command: String(h.command) });
      }
    }
  }
  return out;
}

/** command 안의 `case "$IN" in <패턴>)` 을 **bash로 그대로 재현**한다(패턴을 다시 구현하면 같이 틀린다) */
function caseGatePasses(command, input) {
  const m = /case "\$IN" in ([^)]*)\)/.exec(command);
  if (!m) return true; // 필터 없음 = 전부 훅으로
  const r = spawnSync('bash', ['-c', `IN=$(cat); case "$IN" in ${m[1].trim()}) echo PASS ;; *) echo BLOCK ;; esac`], {
    input, encoding: 'utf8',
  });
  if (r.error) return null; // bash 없음 → 판정 불가
  return /PASS/.test(r.stdout || '');
}

function askHook(hook, input) {
  const r = 훅띄우기(path.join(HOOKS, `${hook}.js`), { input, encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  if (!out) return { blocks: false, decision: 'silent' };
  let d;
  try { d = JSON.parse(out).hookSpecificOutput.permissionDecision; } catch (_) { return { blocks: true, decision: 'nonjson' }; }
  // deny 는 물론이고, 경고를 붙인 allow 도 「훅이 이 입력에 관심이 있다」는 뜻이라 라우팅이 필요하다
  return { blocks: d === 'deny', decision: d };
}

// 훅이 막을 법한 입력들. 훅이 실제로 막는지는 여기서 단정하지 않는다(위 불변식 참고).
// ⚠ 트리 상태에 따라 판정이 바뀌는 규칙(되감기·미커밋 검사)은 넣지 않는다 — 불안정 테스트가 된다.
const CASES = [
  ['git-scope-guard', 'Bash', { command: 'git ' + 'add -A' }, 'git add -A'],
  ['git-scope-guard', 'Bash', { command: `git -C ${ROOT} ` + 'add -A' }, 'git -C <경로> add -A'],
  ['git-scope-guard', 'Bash', { command: 'git ' + 'add .' }, 'git add .'],
  ['git-scope-guard', 'Bash', { command: 'git ' + 'commit -a -m x' }, 'git commit -a'],
  ['git-scope-guard', 'Bash', { command: `git -C ${ROOT} ` + 'commit -a -m x' }, 'git -C <경로> commit -a'],
  ['git-scope-guard', 'Bash', { command: 'git ' + 'clean -fd' }, 'git clean'],
  ['git-scope-guard', 'Bash', { command: `git -C ${ROOT} ` + 'clean -fd' }, 'git -C <경로> clean'],
  ['git-scope-guard', 'PowerShell', { command: 'git ' + 'add -A' }, 'PowerShell 쪽 git add -A'],
  ['clasp-guard', 'Bash', { command: 'clasp pull' }, 'clasp pull(작업본 덮어쓰기)'],
  ['clasp-guard', 'PowerShell', { command: '& "C:\\Users\\q1212\\AppData\\Roaming\\npm\\clasp.cmd" pull' }, 'PowerShell clasp pull'],
  ['board-guard', 'Edit', {
    file_path: path.join(ROOT, 'docs', '세션보드.md'),
    old_string: '| 2026-07-28 | SYNK FIELD',
    new_string: '| 2026-07-28 | ' + 'x'.repeat(400) + ' | SYNK FIELD',
  }, '세션보드 칸 200자 초과'],
  ['memory-index-guard', 'Edit', {
    file_path: path.join(require('node:os').homedir(), '.claude', 'projects', 'C--Users-q1212-Documents-SYNK-appsscript', 'memory', 'MEMORY.md'),
    old_string: '## 앱·개발',
    new_string: '## 앱·개발\n- [x](x.md) — ' + '가'.repeat(400),
  }, 'MEMORY.md 250자 초과 줄'],
  ['screenshot-budget', 'mcp__claude-in-chrome__browser_batch', {
    actions: Array.from({ length: 12 }, () => ({ name: 'computer', input: { action: 'screenshot' } })),
  }, '배치 스크린샷 12장(예산 초과)'],
  ['doc-propagation', 'Edit', {
    file_path: path.join(ROOT, 'docs', '급여_정본.md'), old_string: 'a', new_string: 'b',
  }, 'docs 정본 편집'],
  // F064(2026-08-04): 인라인 스크립트는 git 명령이 아니라 git-scope-guard 에 닿지도 않았다 —
  // 라우팅이 좁아서가 아니라 **통로 자체가 없던** 자리라 훅을 새로 세웠다.
  ['shell-inline-guard', 'Bash', { command: 'node -e "console.log(1)" ' + '"\\$SP"' }, '인라인 스크립트의 \\$ 이스케이프'],
  ['shell-inline-guard', 'Bash', { command: "git commit -F - <<X\n@'\n제목\n'@\nX" }, 'Bash 에 PowerShell here-string'],
  /* F050·F065·F067(2026-08-04) + 직전 세션의 네 번째 — 셸로 코드 파일을 변이시키다 원복이 실패해
   * 파일이 변이 상태로 남았다. 표면이 넓어(sed·cp·리다이렉트·PowerShell cmdlet·인라인 스크립트)
   * 앞단 필터를 두면 규칙이 늘 때마다 조용히 샌다 — 그래서 이 훅은 case 필터 없이 등록한다.
   * 필터가 다시 생기면 아래 세 줄이 그 자리에서 빨간불을 낸다. */
  ['code-edit-guard', 'Bash', { command: 'sed -i "s/a/b/" tools/eval-score.js' }, 'sed -i 로 코드 파일 in-place(F067)'],
  ['code-edit-guard', 'Bash', { command: 'cat tmp.js > Code.js' }, '리다이렉트로 코드 파일 덮어쓰기'],
  ['code-edit-guard', 'PowerShell', { command: 'Set-Content -Path Code.js -Value $x' }, 'PowerShell 쓰기 cmdlet'],
  ['code-edit-guard', 'Bash', { command: `python -c "open('tests/safety.test.js','w').write(s)"` }, '인라인 스크립트의 코드 파일 쓰기(F050·F065)'],
];

/* ⚠ track-collision 은 이 CASES 목록에 넣지 않는다 — 판정이 **트리 상태**(남의 미커밋이 지금
 * 디스크에 있나)에 달려 있어, 여기 넣으면 산 세션 유무로 초록·빨강이 뒤집히는 불안정 검사가 된다.
 *   🔴 2026-08-08(F239) 이후 그 훅은 ⑤ 축에서 **실제로 deny 를 낸다** — 「deny 를 안 내는 훅」이
 *   아니다. 라우팅은 위 불변식이 요구하는 것과 같은 무게로 지켜야 하고, 그 몫은
 *   tests/트랙충돌.test.js 가 진다(매처 3종 + 앞단 필터 부재 + **미실행=deny**). */

test('훅이 전부 settings.json 에 등록돼 있고, 등록이 가리키는 파일이 실재한다', () => {
  const reg = registry();
  const files = fs.readdirSync(HOOKS).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));
  for (const f of files) {
    assert.ok(reg.has(f), `${f}.js 가 저장소에 있는데 settings.json 에 등록이 없다 — 파일만 있으면 안 돈다`);
  }
  for (const [hook] of reg) {
    assert.ok(fs.existsSync(path.join(HOOKS, `${hook}.js`)), `등록은 있는데 ${hook}.js 가 없다`);
  }
});

test('라우팅은 훅보다 넓다 — 훅이 막는 입력을 matcher·case 필터가 전부 통과시킨다', (t) => {
  const reg = registry();
  const failures = [];
  let checked = 0;
  let bashMissing = false;

  for (const [hook, tool, ti, desc] of CASES) {
    const ent = reg.get(hook);
    assert.ok(ent, `${hook} 등록 없음`);
    const input = JSON.stringify({ session_id: `route-${process.pid}`, tool_name: tool, tool_input: ti });

    const verdict = askHook(hook, input);
    if (!verdict.blocks) continue; // 훅이 관심 없는 입력 — 라우팅을 따질 자리가 아니다
    checked += 1;

    if (!new RegExp(ent.matcher).test(tool)) {
      failures.push(`${hook}: matcher 가 ${tool} 를 안 잡는다 — 훅은 ${verdict.decision} 인데 호출되지 않는다 (${desc})`);
      continue;
    }
    const passes = caseGatePasses(ent.command, input);
    if (passes === null) { bashMissing = true; continue; }
    if (!passes) {
      failures.push(`${hook}: case 필터가 이 입력을 안 넘긴다 — 훅은 ${verdict.decision} 인데 호출되지 않는다 (${desc})`);
    }
  }

  if (bashMissing) t.diagnostic('bash 없음 — case 필터 재현은 건너뜀(matcher 검사만 수행)');
  assert.ok(checked >= 6, `막히는 케이스가 ${checked}건뿐 — 케이스 목록이 훅 규칙을 못 따라가고 있다`);
  assert.deepStrictEqual(failures, [], '\n  ' + failures.join('\n  '));
});

test('screenshot-budget 은 판정층이 하나다 (배치·우회 형태를 앞단에서 다시 거르지 않는다)', () => {
  const ent = registry().get('screenshot-budget');
  assert.ok(ent, 'screenshot-budget 등록 없음');
  assert.ok(
    !/case "\$IN" in \*(screenshot|zoom)/.test(ent.command),
    'settings.json 이 액션을 다시 거르고 있다 — 08-04엔 그 필터와 훅이 둘 다 배치를 몰랐다'
  );
  for (const tool of [
    'mcp__claude-in-chrome__computer', 'mcp__claude-in-chrome__browser_batch', 'mcp__computer-use__computer_batch',
    // 08-04(5번째 실패): 배치 형태만 보다가 **액션 필드 없는 단건 도구**를 놓쳤다.
    // 훅은 이것들을 그림 1장으로 세는데 매처가 안 잡으면 호출 자체가 없다.
    // 어느 도구가 그림이냐를 훅에 물어 자동 추적하는 검사는 tests/스크린샷예산.test.js 에 있다.
    'mcp__computer-use__scroll', 'mcp__computer-use__teach_step', 'mcp__claude-in-chrome__gif_creator',
  ]) {
    assert.ok(new RegExp(ent.matcher).test(tool), `매처가 ${tool} 를 안 잡는다`);
  }
});

test('무관한 입력은 훅이 조용히 흘려보낸다 (라우팅을 넓혀도 실작업을 벌주지 않는다)', () => {
  const irrelevant = [
    ['git-scope-guard', 'Bash', { command: 'npm test' }],
    ['git-scope-guard', 'Bash', { command: 'git status' }],
    ['git-scope-guard', 'Bash', { command: 'git log --oneline -5' }],
    ['clasp-guard', 'Bash', { command: 'ls -la' }],
    ['board-guard', 'Write', { file_path: path.join(ROOT, 'Code.js'), content: 'x' }],
    ['memory-index-guard', 'Write', { file_path: path.join(ROOT, 'Code.js'), content: 'x' }],
    ['doc-propagation', 'Write', { file_path: path.join(ROOT, 'Code.js'), content: 'x' }],
  ];
  for (const [hook, tool, ti] of irrelevant) {
    const input = JSON.stringify({ session_id: `quiet-${process.pid}`, tool_name: tool, tool_input: ti });
    const v = askHook(hook, input);
    assert.strictEqual(v.decision, 'silent', `${hook} 가 무관한 입력(${ti.command || path.basename(ti.file_path)})에 반응했다 — 거짓양성`);
  }
});
