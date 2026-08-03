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
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
// SYNK_TEST_SETTINGS = 변이 실험용 이음매. 평소엔 실등록을 본다(실저장소를 흔들지 않고 탐지력만 잰다).
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');
const HOOKS = path.join(ROOT, '.claude', 'hooks');

function settings() {
  return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
}

/** settings.json 에서 훅별 { matcher, command } 를 뽑는다 */
function registry() {
  const out = new Map();
  for (const e of settings().hooks.PreToolUse || []) {
    for (const h of e.hooks || []) {
      const m = /hooks\/([a-z-]+)\.js/.exec(String(h.command || ''));
      if (m) out.set(m[1], { matcher: e.matcher, command: String(h.command) });
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
  const r = spawnSync(process.execPath, [path.join(HOOKS, `${hook}.js`)], { input, encoding: 'utf8' });
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
];

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
  for (const tool of ['mcp__claude-in-chrome__computer', 'mcp__claude-in-chrome__browser_batch', 'mcp__computer-use__computer_batch']) {
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
