/* clasp-guard 워크트리 차단의 **처방 경로** 회귀 — 「메인 저장소」가 워크트리 자신을 가리키면
 * 그 처방은 따를 수 없다(F103 축: 따를 수 없는 처방은 우회를 정상 통로로 만든다).
 *
 * 08-07 실측으로 잡았다 — 워크트리에서 clasp push 를 걸면 사유가 이렇게 나왔다:
 *   「→ ①브랜치를 master에 반영 ②메인 저장소(<바로 그 워크트리>)에서 /deploy」
 * 시키는 대로 그 자리에서 /deploy 하면 같은 훅이 또 막는다. 무한이다.
 *
 * 왜 ROOT 를 쓰면 안 되나: 등록층이 `${CLAUDE_PROJECT_DIR:-$PWD}` 라서 워크트리 세션에서는
 *   **워크트리의 훅 사본**이 돌고, `__dirname` 에서 파생한 ROOT 도 워크트리다. 훅 안 주석은
 *   「settings.json 에 절대경로로 등록돼 ROOT 가 항상 메인」을 전제했는데 그 전제가 이미 죽어
 *   있었다 — 규칙 0 의 설계 전체가 그 죽은 문장 위에 서 있었다.
 *
 * ⚠ 픽스처로 짓는다(실저장소를 안 본다). 실저장소를 재면 남의 미커밋·보안검사 상태에 따라
 *   빨개져서 「환경이 달라서」와 「가드가 고장나서」를 못 가른다 — F215·F217 이 정확히 그 병이고,
 *   이 파일이 그 두 자리와 같은 통로로 태어나면 안 된다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 훅띄우기 } = require('./lib/훅띄우기');

const GUARD = path.join(__dirname, '..', '.claude', 'hooks', 'clasp-guard.js');
const PUSH = '"/c/Users/q1212/AppData/Roaming/npm/clasp.cmd" push --force';

const git = (cwd, ...a) =>
  execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/* 메인 + 워크트리 한 벌. 워크트리에도 `.clasp.json` 을 둔다 — 없으면 훅의 프로젝트 판별이
 * ROOT(실저장소)로 떨어지고, 그러면 규칙 0 앞의 보안 검사가 **실저장소**를 재게 된다. */
function 픽스처() {
  const 메인 = fs.mkdtempSync(path.join(os.tmpdir(), '워크트리처방-'));
  fs.writeFileSync(path.join(메인, '.clasp.json'), '{}');
  fs.writeFileSync(path.join(메인, '.claspignore'), '**/**\n!Code.js\n');
  fs.writeFileSync(path.join(메인, 'Code.js'), 'function noop() {}\n');
  git(메인, 'init', '-q');
  git(메인, 'add', '-A');
  /* CI 는 빈 HOME 으로 돈다 — 신원을 안 주면 commit 이 죽어 검사가 통째로 미실행이 된다 */
  git(메인, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', '판');
  const 워크트리 = path.join(메인, '..', path.basename(메인) + '-wt');
  git(메인, 'worktree', 'add', '-q', '--detach', 워크트리, 'HEAD');
  return { 메인: fs.realpathSync(메인), 워크트리: fs.realpathSync(워크트리) };
}

function 치움({ 메인, 워크트리 }) {
  try { git(메인, 'worktree', 'remove', '--force', 워크트리); } catch (_) {}
  for (const d of [워크트리, 메인]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
}

function 사유(cwd) {
  const r = 훅띄우기(GUARD, {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: PUSH }, cwd }),
    encoding: 'utf8',
    timeout: 120000,
  });
  const out = (r.stdout || '').trim();
  /* 미실행을 통과로 읽지 않는다 — 스폰이 죽으면 out 이 비고, 아래 단언은 전부 「사유 없음」으로
   * 조용히 갈린다. 여기서 먼저 소리를 낸다(F207 · 초록은 분모와 함께만 읽는다). */
  assert.ok(out, `훅이 아무것도 안 냈다 — status=${r.status} · 미실행은 통과가 아니다`);
  return JSON.parse(out).hookSpecificOutput.permissionDecisionReason;
}

test('🔑 워크트리 차단의 「메인 저장소」가 워크트리 자신이 아니라 진짜 메인을 가리킨다', () => {
  const fx = 픽스처();
  try {
    const reason = 사유(fx.워크트리);

    /* 앵커 — 이게 없으면 아래 경로 단언은 「다른 사유로 막힌 것」을 재게 된다(F217 의 병) */
    assert.match(reason, /워크트리에서는 clasp push/, `규칙 0 이 아니라 다른 사유로 막혔다:\n${reason}`);

    const m = reason.match(/메인 저장소\(([^)]*)\)/);
    assert.ok(m, `처방에 메인 저장소 경로가 없다:\n${reason}`);
    const 처방 = path.resolve(m[1]);

    assert.notStrictEqual(처방, fx.워크트리,
      '처방이 차단된 워크트리 자신을 가리킨다 — 시키는 대로 하면 같은 훅이 또 막는다(F103)');
    assert.strictEqual(처방, fx.메인,
      `처방이 진짜 메인을 안 가리킨다. ROOT(__dirname 파생)를 쓰면 워크트리 세션에서 훅 사본의\n`
      + `위치가 나온다 — 메인은 git 의 --git-common-dir 에서 파생해야 한다.\n`
      + `  처방=${처방}\n  메인=${fx.메인}\n  워크트리=${fx.워크트리}`);
  } finally {
    치움(fx);
  }
});

test('반대 방향 — 메인 저장소에서 부르면 워크트리 사유로 막지 않는다(정상 배포를 접으면 안 된다)', () => {
  const fx = 픽스처();
  try {
    const r = 훅띄우기(GUARD, {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: PUSH }, cwd: fx.메인 }),
      encoding: 'utf8',
      timeout: 120000,
    });
    const out = (r.stdout || '').trim();
    /* 메인에서는 통과(무출력)일 수도, 다른 불변식으로 막힐 수도 있다 — 저장소 상태에 매인다.
     * 고정할 수 있는 것은 **워크트리 사유만은 아니어야 한다**는 것 하나뿐이다. */
    if (out) {
      const reason = JSON.parse(out).hookSpecificOutput.permissionDecisionReason;
      assert.doesNotMatch(reason, /워크트리에서는 clasp push/,
        `메인 저장소를 워크트리로 오판했다:\n${reason}`);
    }
  } finally {
    치움(fx);
  }
});
