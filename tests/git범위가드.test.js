/* git-scope-guard 회귀 — 커밋 범위 사고(F006·F013·F014·F015)의 기계 강제가 실제로 작동하는가.
 *
 * 왜 결과를 검사하나: 이 가드의 실패 모드는 두 방향이고 **성격이 정반대**다.
 *   ① 안 막음(거짓음성) → 남의 파일·유호님 git 밖 정본이 또 커밋에 딸려간다
 *   ② 과하게 막음(거짓양성) → 사람이 BYPASS를 습관적으로 붙이는 법을 배운다(2026-08-02 「노이즈 가드는 우회를 학습시킨다」)
 * 그래서 차단 목록만이 아니라 **통과해야 하는 목록을 같은 무게로** 검사한다.
 * 특히 「커밋 메시지에 `git add -A` 라고 적기만 한 경우」 — clasp-guard가 2026-08-01에 정확히 이 오탐으로
 * 사고를 문서화하는 커밋 자체를 막았다. 가드는 실행되는 명령을 봐야지 사람이 쓴 문장을 보면 안 된다. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { ROOT } = require('./_engine-source');

// SYNK_TEST_SCOPE_HOOK = 변이 실험용 이음매(스크린샷예산의 SYNK_TEST_HOOK 과 같은 목적, 이름만 분리 —
// 한 변수를 두 훅이 나눠 쓰면 test-ci 가 전체를 돌릴 때 한쪽 변이가 다른 쪽에 새어 든다).
// 🔴 격리 사본은 **`.claude/hooks/` 를 통째로** 복사해서 만든다 — 파일 하나만 임시폴더에 두면
//    이 훅이 깊은 경로에서 지연 require 하는 `lib/handoff-store.js` 가 안 잡힌다. 그때 증상은
//    「그 검사들만 빨감」이라 **변이 결과로 오독하기 쉽다**(실측 2026-08-18 · F590 트랙에서 기준선 적색
//    2건 → 사유가 `Cannot find module …\lib\handoff-store.js` 였다. 변이 통로가 「기준선이 이미 적색」
//    으로 멈춰 세워 준 덕에 그 판의 숫자를 안 믿었다 — 그게 그 게이트의 값이다).
const HOOK = process.env.SYNK_TEST_SCOPE_HOOK || path.join(ROOT, '.claude', 'hooks', 'git-scope-guard.js');

/* [2026-08-04] 가드가 **저장소 상태**(진행 중인 rebase·미커밋 수정)를 보게 되면서
 * 이 테스트들은 기본 cwd(=공유 저장소)에서 돌면 **옆 세션이 merge 중일 때 실패**하게 됐다.
 * 실제로 한 번은 3건 실패, 재실행에선 통과했다 — 재현되지 않는 빨간불은 테스트를 꺼버리게 만든다.
 * 그래서 판정용 cwd를 **깨끗한 임시 저장소**로 고정한다(가드가 보는 세계를 테스트가 통제한다).
 * 상태를 일부러 만들어야 하는 검사는 아래 `가드_at`으로 각자 저장소를 세운다. */
const 깨끗한저장소 = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'scope-guard-clean-'));
execFileSync('git', ['init', '-q'], { cwd: 깨끗한저장소 });
process.on('exit', () => { try { fs.rmSync(깨끗한저장소, { recursive: true, force: true }); } catch {} });

function 가드(command) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
    cwd: 깨끗한저장소,
  });
  if (!out.trim()) return { 차단: false, 사유: '' };
  const j = JSON.parse(out);
  const h = j.hookSpecificOutput || {};
  return { 차단: h.permissionDecision === 'deny', 사유: String(h.permissionDecisionReason || '') };
}

test('훅 파일이 있고 실행된다 (없으면 아래 검사가 전부 무의미해진다)', () => {
  assert.ok(fs.existsSync(HOOK), 'git-scope-guard.js 가 없다');
  assert.equal(가드('git status --short').차단, false);
});

test('범위를 넓히는 명령을 막는다 — 지정하지 않은 파일까지 담는 형태', () => {
  [
    'git add -A && git commit -m "x"',
    'git add .',
    'git add --all',
    'git commit -am "x"',
    'git commit -a -m "x"',
  ].forEach((c) => {
    const r = 가드(c);
    assert.ok(r.차단, '막지 못했다: ' + c);
    assert.ok(/경로/.test(r.사유), '차단 사유에 대안(경로 지정 커밋)이 없다: ' + c);
  });
});

test('정상 커밋 형태는 통과한다 (과잉 차단은 BYPASS 습관을 만든다)', () => {
  [
    'git commit -m "x" -- a.js b.js',          // 1순위 권장 형태
    'git add a.js b.js && git commit -m "x"',  // 한 호출 안에서 묶은 형태
    'git add -p',                              // 부분 스테이징
    'git status --short',
    'git diff --cached --stat',
    'git commit --amend --no-edit',
  ].forEach((c) => {
    assert.equal(가드(c).차단, false, '정상 명령을 막았다: ' + c);
  });
});

test('커밋 메시지·heredoc 안의 문자열은 명령으로 세지 않는다 (문서화를 벌하지 않는다)', () => {
  assert.equal(가드('git commit -m "fix: git add -A 를 쓰지 말 것"').차단, false,
    '메시지에 적기만 한 것을 막았다 — 이 사고를 기록하는 커밋 자체가 차단된다');
  const heredoc = 'git commit -F - <<\'EOF\'\n설명: git add -A 가 남의 파일을 담았다\nEOF';
  assert.equal(가드(heredoc).차단, false, 'heredoc 본문을 명령으로 읽었다');
});

test('의도적 예외는 BYPASS로만 열린다 (우회가 눈에 보이게)', () => {
  assert.equal(가드('GIT_SCOPE_BYPASS=1 git add -A').차단, false);
  assert.equal(가드('git add -A').차단, true, 'BYPASS 없이 통과하면 게이트가 없는 것과 같다');
});

test('git clean을 막는다 — 미추적 파일은 복구 경로가 0이다 (F025)', () => {
  [
    'git clean -fd',
    'git clean -f',
    'git clean -fdx',
    'git clean -fd codex/',   // 경로를 좁혀도 남의 신작을 지우는 성질은 그대로다
  ].forEach((c) => {
    const r = 가드(c);
    assert.ok(r.차단, '막지 못했다: ' + c);
    assert.ok(/미추적|dry-run/.test(r.사유), '차단 사유에 원리·대안이 없다: ' + c);
  });
});

test('git clean의 안전한 형태는 통과한다 (과잉 차단은 BYPASS 습관을 만든다)', () => {
  [
    'git clean -n',                          // dry-run — 지우지 않는다
    'git clean --dry-run -d',
    'GIT_SCOPE_BYPASS=1 git clean -fd',      // 의식적 우회
    'git commit -m "docs: git clean 사고 기록" -- docs/a.md',  // 메시지에 적기만 한 것
  ].forEach((c) => {
    assert.equal(가드(c).차단, false, '안전한 명령을 막았다: ' + c);
  });
});

/* git 전역 옵션 뒤에 오는 서브커맨드 — 2026-08-04 실측 구멍.
 * 규칙들이 `\bgit\s+add\b` 처럼 서브커맨드가 `git` 바로 뒤에 온다고 가정했는데,
 * 실제로 상시 쓰는 형태는 `git -C <경로> add -A` 다(settings.json 권한 목록에도 그 형태가 잔뜩 있다).
 * 규칙 5개가 **하나도** 못 잡았고, 못 잡는 방향은 「통과」였다. 공용 접두사 G 로 처방. */
test('git 전역 옵션(-C·-c·--no-pager) 뒤에 와도 잡는다 (F053 계열)', () => {
  const R = 'C:/some/repo';
  [
    `git -C ${R} add -A`,
    `git -C ${R} add .`,
    `git -C "${R}" add --all`,
    `git -C ${R} commit -am "x"`,
    `git -C ${R} clean -fd`,
    'git -c user.name=x add -A',
    'git --no-pager add -A',
    `git -C ${R} -c core.pager=cat add -A`,
  ].forEach((c) => {
    assert.ok(가드(c).차단, '전역 옵션 뒤의 서브커맨드를 놓쳤다: ' + c);
  });
});

test('전역 옵션이 붙어도 정상 형태는 통과한다 (과잉 차단 방지)', () => {
  const R = 'C:/some/repo';
  [
    `git -C ${R} commit -m "x" -- a.js b.js`,
    `git -C ${R} status`,
    `git -C ${R} log --oneline -5`,
    `git -C ${R} clean -n`,
    `git -C ${R} add a.js b.js`,
  ].forEach((c) => {
    assert.equal(가드(c).차단, false, '정상 명령을 막았다: ' + c);
  });
});

test('훅이 settings.json에 실제로 등록돼 있다 (파일만 있고 안 불리면 없는 것과 같다)', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const pre = (s.hooks && s.hooks.PreToolUse) || [];
  const 등록 = JSON.stringify(pre);
  assert.ok(등록.indexOf('git-scope-guard') >= 0, 'settings.json PreToolUse에 git-scope-guard가 없다');
  const bash = pre.filter((h) => /Bash/.test(String(h.matcher || '')));
  assert.ok(bash.length >= 1 && JSON.stringify(bash).indexOf('git-scope-guard') >= 0,
    'Bash 매처에 걸려 있지 않으면 git 명령을 못 본다');
});

/* ── ④ rebase·merge 진행 중 커밋 차단 (2026-08-04 F038) ─────────────────────
 * 실사고: 옆 세션이 리베이스를 도는 동안 다른 세션이 `git commit -- 경로`를 했고,
 * 그 커밋이 detached HEAD 위에 얹혀 리베이스 순서 안으로 들어갔다.
 * 🔑 범인은 부주의가 아니라 **도구가 상태를 안 보여준 것**이다 — `git status --short`는
 * 「rebase in progress」를 표시하지 않는다. 그래서 사람의 주의가 아니라 훅이 본다.
 * 여기서도 통과 목록을 차단 목록과 같은 무게로 검사한다(과잉 차단 = BYPASS 학습). */

function 임시저장소(진행파일, fn) {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'scope-guard-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    if (진행파일) {
      const target = path.join(dir, '.git', 진행파일);
      if (진행파일.endsWith('HEAD')) fs.writeFileSync(target, 'deadbeef\n');
      else fs.mkdirSync(target, { recursive: true });
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function 가드_at(command, cwd) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8', cwd,
  });
  if (!out.trim()) return { 차단: false, 사유: '' };
  const h = JSON.parse(out).hookSpecificOutput || {};
  return { 차단: h.permissionDecision === 'deny', 사유: String(h.permissionDecisionReason || '') };
}

test('rebase·merge 진행 중이면 커밋을 막는다 — 남의 작업 순서 안으로 들어간다', () => {
  [['rebase-merge', 'rebase'], ['rebase-apply', 'rebase'], ['MERGE_HEAD', 'merge'],
   ['CHERRY_PICK_HEAD', 'cherry-pick'], ['REVERT_HEAD', 'revert']].forEach(([f, 이름]) => {
    임시저장소(f, (dir) => {
      const r = 가드_at('git commit -m "x" -- a.md', dir);
      assert.ok(r.차단, `${f} 진행 중인데 커밋을 막지 못했다`);
      assert.ok(r.사유.includes(이름), `차단 사유가 무엇이 진행 중인지 말하지 않는다: ${r.사유}`);
      assert.ok(/--short/.test(r.사유), '「--short는 이 상태를 안 보여준다」는 핵심 정보가 빠졌다');
    });
  });
});

test('진행 중이 아니면 통과한다 — 평소 커밋을 막으면 안 된다', () => {
  임시저장소(null, (dir) => {
    assert.equal(가드_at('git commit -m "x" -- a.md', dir).차단, false, '평범한 커밋을 막았다');
  });
});

test('진행 중이어도 커밋이 아닌 명령·의식적 우회는 통과한다', () => {
  임시저장소('rebase-merge', (dir) => {
    ['git status', 'git add a.md', 'git rebase --continue', 'git rebase --abort',
     'GIT_SCOPE_BYPASS=1 git commit -m "x" -- a.md'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, '진행 중에도 허용돼야 하는 명령을 막았다: ' + c);
    });
  });
});

/* ── F573: 서브커맨드 «이름의 끝» — `-` 는 낱말 경계다 (2026-08-17 실측) ────────────
 * 실사고: ④의 `merge\b` 가 `git merge-base --is-ancestor` 를 deny 했다. 그건 커밋을 만들 수
 *   없는 **읽기 전용 조회**이고, 하필 인계문·F566 계열이 「착지 확인에 쓰라」고 지목하는 명령이다
 *   — 가드가 자기 처방의 확인 통로를 막았다(F103 형태).
 * 🔑 이 검사가 재는 것은 규칙 하나가 아니라 **성질**이다: 어떤 규칙도 서브커맨드 이름을
 *   반토막 내 읽지 않는다. 새 규칙이 `\b` 로 다시 적으면 여기서 빨개진다.
 * ⚠ 분모를 같은 test 안에 둔다 — 목록만 줄여서 초록을 만들 수 없게(F207). 대시 없는 형태
 *   (`git merge other`)는 계속 차단이어야 하고, 그게 깨지면 경계가 탐지력을 먹은 것이다. */
const 대시서브커맨드 = [
  // git help -a 실측(2026-08-17) — 위 동사 목록과 접두가 겹치는 실존 서브커맨드 전량
  'git merge-base --is-ancestor HEAD HEAD',
  'git merge-tree HEAD HEAD',
  'git merge-file a.md b.md c.md',
  'git merge-index cat a.md',
  'git merge-one-file',
  'git commit-tree HEAD^{tree} -m x',
  'git commit-graph verify',
  'git checkout-index a.md',
];

test('F573 대시 서브커맨드를 커밋 생성으로 읽지 않는다 — 읽기 전용 조회가 막히면 확인 통로가 사라진다', () => {
  임시저장소('MERGE_HEAD', (dir) => {
    assert.equal(대시서브커맨드.length, 8, '분모가 바뀌었다 — 목록을 줄여 초록을 만든 것이 아닌지 본다');
    대시서브커맨드.forEach((c) => {
      const r = 가드_at(c, dir);
      assert.equal(r.차단, false, `대시 서브커맨드를 막았다(이름을 반토막 읽었다): ${c}\n사유: ${r.사유}`);
    });
    /* 대시가 아니라 **붙은** 이름도 같은 축이다 — `mergetool` 은 하필 충돌을 푸는 그 명령이라,
     * 경계를 `(?!-)` 로 좁혀 적으면 여기가 막힌다(옛 `\b` 에서는 우연히 안 막혔다). */
    ['git mergetool', 'git mergetool --tool=vimdiff'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, `충돌 해소 통로를 막았다: ${c}`);
    });
    // 분모 — 이 둘이 통과하면 경계가 탐지력을 먹었다는 뜻이고, 위 초록은 전부 의미가 없다
    assert.ok(가드_at('git merge other', dir).차단, 'merge 진행 중 새 머지를 막지 못했다 — 경계가 규칙을 죽였다');
    assert.ok(가드_at('git commit -m "x" -- a.md', dir).차단, 'F038 원형을 막지 못했다 — 경계가 규칙을 죽였다');
  });
});

test('F573 규칙들이 서브커맨드 끝을 `\\b` 로 적지 않는다 — 옛 통로를 소스에서 금지한다', () => {
  /* HOOK 을 읽는다(ROOT 고정 경로가 아니라) — 변이는 `SYNK_TEST_SCOPE_HOOK` 으로 격리 사본을 물리므로
   * 고정 경로를 읽으면 이 검사만 원본을 보고 초록이 되어 변이가 조용히 통과한다(F207 계열). */
  const 소스 = fs.readFileSync(HOOK, 'utf8');
  assert.match(소스, /const 끝 = '\(\?!\[-/, '공용 경계 상수 `끝` 이 없다 — 호출부마다 적으면 또 갈라진다');
  /* `re('<동사>\\b` 형태만 잡는다 — 동사 «뒤»가 아니라 플래그 뒤의 `\b`(`\s--hard\b`)는 정당하다. */
  const 샌자리 = [...소스.matchAll(/re\('(\([a-z|-]+\)|[a-z-]+)\\\\b/g)].map((m) => m[1]);
  assert.deepEqual(샌자리, [],
    `서브커맨드 바로 뒤에 \\b 를 쓴 자리가 남았다(대시 이름을 반토막 읽는다): ${샌자리.join(' · ')}\n`
    + '→ `re(\'add\' + 끝 + …)` 형태로 적는다.');
});

test('저장소 밖에서도 훅이 죽지 않는다 — 가드가 터지면 모든 Bash가 막힌다', () => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'no-git-'));
  try {
    assert.equal(가드_at('git commit -m "x" -- a.md', dir).차단, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ── ⑤ 되감기 차단 (2026-08-04 F037) ────────────────────────────────────────
 * 실사고: `git rebase --abort`가 작업 트리를 HEAD로 되돌리며 옆 세션의 미커밋 편집 2파일을 쓸어냈다.
 * ③ git clean이 「미추적」을 지킨다면 ⑤는 「추적 중인 남의 수정」을 지킨다 — 둘 다 reflog에 안 남는다.
 * 🔑 되감기 자체는 금지하지 않는다. 깨끗한 트리에서는 통과해야 한다(그래야 BYPASS를 학습하지 않는다). */

function 더러운저장소(fn) {
  return 임시저장소(null, (dir) => {
    fs.writeFileSync(path.join(dir, 'a.md'), '처음\n');
    execFileSync('git', ['add', 'a.md'], { cwd: dir });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'a.md'), '남이 지금 편집 중\n');  // 미커밋 수정
    return fn(dir);
  });
}

test('미커밋 수정이 있으면 되감기를 막는다 — 남의 편집은 reflog에도 안 남는다', () => {
  더러운저장소((dir) => {
    ['git rebase --abort', 'git merge --abort', 'git reset --hard', 'git reset --hard origin/master',
     'git checkout -- .', 'git restore -- .'].forEach((c) => {
      const r = 가드_at(c, dir);
      assert.ok(r.차단, '되감기를 막지 못했다: ' + c);
      assert.ok(/미커밋/.test(r.사유), '차단 사유에 원리가 없다: ' + c);
      assert.ok(/a\.md/.test(r.사유), '무엇이 사라질지 보여주지 않는다 — 그러면 판단할 수 없다');
    });
  });
});

test('트리가 깨끗하면 되감기는 통과한다 (정당한 abort를 막으면 안 된다)', () => {
  임시저장소(null, (dir) => {
    ['git rebase --abort', 'git reset --hard', 'git checkout -- .'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, '깨끗한 트리인데 막았다: ' + c);
    });
  });
});

/* ── F590: ⑤의 축은 «표기»가 아니라 «행위»다 (2026-08-18 실측) ────────────────────
 * 옛 판정은 `(checkout|restore)…\s--\s+\.` 하나였다 — 즉 「`-- .` 라고 쓴 것」만 봤다.
 * 격리 픽스처로 실훅에 태워 보니 **소멸형 16건 중 막힌 것 5 · 구멍 11**이었고, 그 구멍에
 * `git checkout .` 과 `git restore .` 이 들어 있었다. 둘은 git 이 스스로 권하는 가장 흔한 표기이고,
 * `.claude/settings.local.json` 허용목록의 `Bash(git checkout *)`·`Bash(git restore *)` 에 걸려
 * **권한 프롬프트도 없이** 돈다 — F037(옆 세션 미커밋 2파일 소멸)이 그대로 열려 있었다.
 * 🔑 F590 신고분(`checkout-index -a -f`)은 그 11 중 하나다. 신고문의 판정 기준은 「그 한 명령의
 *   실사용이 0이면 안 닫는다」였고 실사용 0은 참이었지만(`git log -S` 전량 = 장부·주석·픽스처뿐),
 *   **분모가 명령이 아니라 행위 부류**였다. 부류로 세면 답이 뒤집힌다.
 * ⚠ 분모를 같은 test 안에 둔다 — 목록을 줄여 초록을 만들 수 없게(F207). */
const 소멸형 = [
  'git reset --hard', 'git reset --hard origin/master',        // 옛 규칙 (살아 있나)
  'git checkout -- .', 'git restore -- .', 'git checkout HEAD -- .',
  'git checkout .', 'git restore .',                            // ← 가장 흔한 표기가 새던 자리
  'git restore --worktree .', 'git restore --source=HEAD --staged --worktree .',
  'git checkout -f', 'git checkout --force master',
  'git switch -f master', 'git switch --discard-changes master',
  'git checkout-index -a -f', 'git checkout-index --all --force',  // ← F590 신고분
  'git read-tree -u --reset HEAD',
];

test('🔴 F590 작업본을 통째로 덮어쓰는 형태를 «행위»로 막는다 — 표기만 보면 11칸이 샌다', () => {
  더러운저장소((dir) => {
    assert.equal(소멸형.length, 16, '분모가 바뀌었다 — 목록을 줄여 초록을 만든 것이 아닌지 본다');
    소멸형.forEach((c) => {
      const r = 가드_at(c, dir);
      assert.ok(r.차단, `작업본을 덮어쓰는데 통과했다(남의 미커밋이 소멸한다): ${c}`);
      assert.ok(/미커밋/.test(r.사유), '차단 사유에 원리가 없다: ' + c);
      assert.ok(/a\.md/.test(r.사유), '무엇이 사라질지 안 보여준다 — 그러면 판단할 수 없다: ' + c);
    });
  });
});

/* 과잉 차단은 BYPASS 를 습관으로 만든다(2026-08-01 clasp-guard 실사고: 사고를 **문서화하는** 커밋이
 * 막혔다). 그래서 「통과해야 하는 목록」을 같은 무게로 검사한다 — 특히 세 부류:
 *   ⓐ 커밋 메시지에 그 명령을 «적기만» 한 것  ⓑ 경로를 지정한 정당한 통로  ⓒ 인덱스만 되돌리는 것 */
test('🔴 F590 넓힌 판정이 정당한 통로를 안 막는다 — 과잉 차단은 우회를 가르친다', () => {
  더러운저장소((dir) => {
    [
      // ⓐ 적기만 한 것 (실행되지 않는 텍스트)
      'git commit -m "docs: 마찰 F590 — git checkout . 이 구멍이었다" -- docs/x.md',
      'git commit -m \'fix: git checkout-index -a -f 도 같은 부류\' -- docs/y.md',
      // ⓑ 경로 지정 — 범위를 사람이 골랐다(①③⑤가 공유하는 원칙)
      'git checkout -- a.md', 'git checkout HEAD -- a.md', 'git checkout-index a.md',
      // ⓒ 인덱스만 — 작업본 내용은 남는다(잃을 것이 없다)
      'git restore --staged .', 'git restore --cached .', 'git read-tree HEAD',
      // ⓓ 트리를 안 건드리는 것
      'git checkout -b feature/새것', 'git switch -c feature/새것', 'git switch master',
      // ⓔ `--force` 오탐 — 이건 ⑥의 자리이지 ⑤가 아니다
      'git push --force-with-lease origin master',
      /* ⓕ 🔑 강제꼴의 «경계»를 재는 유일한 실물 — `-C` 의 긴 이름이다(진짜 플래그다).
       *   가지를 강제로 다시 만들 뿐 작업본 수정은 그대로 들고 간다 → 통과가 정답.
       *   경계를 `끝` 대신 `\b` 로 적으면 `--force` 뒤의 `-` 가 낱말 경계라 여기가 막힌다(F573 그 형태).
       *   변이 ⑦이 이 줄 없이는 구멍이었다 — 이 한 줄이 그 자리를 실제 명령으로 못박는다. */
      'git switch --force-create feature/새것',
    ].forEach((c) => {
      const r = 가드_at(c, dir);
      assert.ok(!/되감기 차단/.test(r.사유), `⑤가 정당한 통로를 막았다: ${c}\n사유: ${r.사유}`);
    });
    // 분모 — 이 둘이 통과하면 위 초록은 「규칙이 죽었다」는 뜻이라 전부 의미가 없다
    assert.ok(가드_at('git checkout .', dir).차단, '탐지력이 죽었다 — 예외가 규칙을 먹었다');
    assert.ok(가드_at('git restore --staged --worktree .', dir).차단,
      '`--staged` 예외가 `--worktree` 까지 풀어 줬다 — 그 조합은 작업본을 덮는다');
  });
});

test('🔴 F590 깨끗한 트리에서는 넓힌 형태도 전부 통과한다 (잃을 것이 없으면 조용하다)', () => {
  임시저장소(null, (dir) => {
    소멸형.forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, `깨끗한 트리인데 막았다 — BYPASS 를 가르친다: ${c}`);
    });
  });
});

/* 🔴 판정 대상은 **명령이 향한 저장소**다 (F134 · 2026-08-06 F137 과 같은 뿌리).
 *   이 훅의 `process.cwd()` 는 셸의 현재 위치가 아니라 세션 프로젝트 폴더라, `cd <남의 저장소> &&`
 *   뒤의 되감기를 **내 저장소의 미커밋**으로 판정했다. F134 는 거짓양성(깨끗한 워크트리를 막음)이라
 *   안전했지만, **방향을 뒤집으면 통과다** — 그래서 두 방향을 다 못박는다.
 *   ⚠ 한쪽만 검사하면 「안 막는다」만 지켜지고 정작 지켜야 할 「막는다」가 새 나간다. */
test('🔴 `cd <다른 저장소> && …` 되감기는 그 저장소로 판정한다 (F134 · 양방향)', () => {
  더러운저장소((더러운) => {
    임시저장소(null, (깨끗) => {
      // ① 더러운 데서 실행하지만 명령이 향한 곳은 깨끗하다 → 막으면 거짓양성(F134 원형)
      const a = 가드_at(`cd ${깨끗} && git reset --hard`, 더러운);
      assert.equal(a.차단, false,
        `향한 저장소는 깨끗한데 실행 위치의 미커밋으로 막았다 — F134 그대로다:\n${a.사유}`);
      // ② 뒤집으면 이쪽이 진짜 사고다 → 반드시 막고, 무엇이 사라질지 그 저장소 파일로 보여준다
      const b = 가드_at(`cd ${더러운} && git reset --hard`, 깨끗);
      assert.ok(b.차단, '남의 미커밋이 있는 저장소를 향한 되감기가 조용히 통과했다 — 새는 방향이다');
      assert.ok(/a\.md/.test(b.사유), `무엇이 사라질지 그 저장소 기준으로 안 보여줬다:\n${b.사유}`);
    });
  });
});

test('cd 가 없으면 판정 위치는 그대로다 — 넓히기만 하고 옛 계약을 안 깬다', () => {
  더러운저장소((dir) => {
    assert.ok(가드_at('git reset --hard', dir).차단, 'cd 없는 되감기 판정이 바뀌었다');
    // 못 읽는 경로로의 cd 는 무시한다 — 파싱 실패가 판정을 엉뚱한 곳으로 보내면 그것도 「통과」다
    assert.ok(가드_at('cd /존재하지않는곳 && git reset --hard', dir).차단,
      '못 읽는 cd 경로 때문에 판정을 놓았다 — 실패는 통과가 아니라 원위치여야 한다');
  });
});

test('되감기가 아닌 checkout·restore는 더러운 트리에서도 통과한다 (범위가 좁으면 안전하다)', () => {
  더러운저장소((dir) => {
    ['git checkout -b 새브랜치', 'git checkout master', 'git restore --staged a.md',
     'GIT_SCOPE_BYPASS=1 git reset --hard'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, '안전한 명령을 막았다: ' + c);
    });
    /* 경로를 못 박은 커밋은 **⑤가** 막으면 안 된다 — 그게 이 검사의 원래 뜻이다.
     * (⑧ 신설 뒤로는 같은 명령이 다른 이유로 걸릴 수 있다: 이 픽스처의 a.md 는 주인 기록이 없어
     *  「모름」이다. 그건 ⑧이 일하는 것이지 ⑤의 오탐이 아니므로, 사유로 둘을 가른다.
     *  「차단 여부」만 재면 두 규칙이 한 칸에 뭉개져 ⑤의 오탐이 다시 생겨도 안 보인다.) */
    const r = 가드_at('git commit -m "docs: reset --hard 사고 기록" -- a.md', dir);
    assert.doesNotMatch(r.사유, /되감기/, '⑤가 경로 지정 커밋을 되감기로 오인했다');
  });
});

/* ── F103: 가드가 **자기 처방을 막지 않는가** (2026-08-05) ─────────────────────────
 * 실사고: 병합 충돌을 해소하려는데 ④가 `git merge --continue` 를, 이어서 ⑤가 `git merge --abort` 를
 * 막았다. 안내문이 지시하는 두 탈출구가 **둘 다** 막혀 남은 통로가 GIT_SCOPE_BYPASS 뿐이었다.
 * 처방을 따를 수 없으면 우회가 정상 통로가 된다(memory `guard-detection-layers`).
 *
 * 🔑 그때 이 파일에는 이미 「진행 중에도 --continue·--abort 는 통과한다」 검사가 있었다(위 202행).
 *    그런데 그 검사가 쓴 동사는 `rebase` 하나였고, `rebase` 는 ④의 목록에 **처음부터 없었다** —
 *    통과한 이유가 처방이 맞아서가 아니라 규칙이 그 동사를 아예 안 봐서였다. 검사가 공허했고,
 *    그 비대칭(merge 는 막히고 rebase 는 통과)이 곧 버그였는데 한 칸만 재느라 안 보였다.
 *    그래서 여기서는 **(진행 중인 작업) × (탈출구)** 를 전수로 돈다. */

const 진행목록 = [['MERGE_HEAD', 'merge'], ['rebase-merge', 'rebase'], ['rebase-apply', 'rebase'],
  ['CHERRY_PICK_HEAD', 'cherry-pick'], ['REVERT_HEAD', 'revert']];

test('진행 중인 작업의 탈출구는 전수로 통과한다 — 한 동사만 재면 통과가 우연이다 (F103)', () => {
  진행목록.forEach(([파일, op]) => {
    ['--continue', '--abort', '--skip', '--quit'].forEach((탈출) => {
      임시저장소(파일, (dir) => {
        const c = `git ${op} ${탈출}`;
        assert.equal(가드_at(c, dir).차단, false, `자기 처방을 막았다: ${c} (${파일} 진행 중)`);
      });
    });
  });
});

test('④의 차단 사유가 시키는 명령이 실제로 통과한다 — 따를 수 없는 처방은 처방이 아니다 (F103)', () => {
  임시저장소('MERGE_HEAD', (dir) => {
    const r = 가드_at('git commit -m "x" -- a.md', dir);
    assert.ok(r.차단, '전제가 깨졌다 — 진행 중 커밋이 안 막혔다');
    const 지시 = [...r.사유.matchAll(/git\s+(?:merge|rebase|cherry-pick|revert)\s+--[a-z]+/g)].map((m) => m[0]);
    assert.ok(지시.length >= 2, `안내문이 탈출구(마치기·되돌리기)를 안 준다: ${r.사유}`);
    지시.forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, `안내문이 시킨 명령을 같은 가드가 막는다: ${c}`);
    });
  });
});

test('해소 스테이징을 마침 명령과 한 호출로 묶어도 통과한다 — 체인째 막지 않는다 (F103)', () => {
  임시저장소('MERGE_HEAD', (dir) => {
    assert.equal(가드_at('git add a.md && git merge --continue', dir).차단, false,
      '체인 안의 commit 계열 단어 하나 때문에 해소 스테이징까지 통째로 막았다');
    assert.equal(가드_at('git add a.md && git commit -m "해소"', dir).차단, true,
      '진행 중 맨 커밋은 여전히 막아야 한다 — 체인 분해가 ④를 무르게 만들면 안 된다(F038)');
  });
});

/* ⚠ 이 검사는 **변이 시험이 찾아냈다**. 위 검사만으로는 체인 분해를 지워도 초록이었다 —
 * 명령 전체에서 마침꼴을 한 번만 찾으면 `add && continue` 는 어차피 통과하기 때문이다.
 * 분해가 실제로 지키는 것은 그 반대 방향이다: **탈출구 한 조각을 앞에 붙여 커밋을 세탁하는 것.**
 * 예외를 두면 그 예외가 체인 전체에 번지지 않는지를 같이 못박아야 한다. */
test('탈출구를 앞에 붙여도 뒤따르는 커밋은 그대로 막는다 — 예외가 체인을 세탁하면 안 된다 (F103)', () => {
  임시저장소('MERGE_HEAD', (dir) => {
    ['git merge --continue && git commit -m "x" -- a.md',
     'git merge --abort; git commit -m "x" -- a.md',
     'git merge --abort || git commit -m "x" -- a.md'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, true, `탈출구 한 조각이 체인 전체를 통과시켰다: ${c}`);
    });
  });
});

/* 위 셋은 .git 안에 진행 파일만 놓은 **가짜** 픽스처라 트리가 깨끗하다.
 * 진짜 충돌은 트리를 더럽히고(unmerged), 그때 ⑤가 abort 를 막는 것이 F103 의 나머지 절반이었다. */
function 충돌저장소({ 남의수정 = false }, fn) {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'scope-guard-conflict-'));
  const g = (...a) => execFileSync('git',
    ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, stdio: 'pipe' });
  try {
    g('init', '-q');
    fs.writeFileSync(path.join(dir, 'a.md'), '기준\n');
    fs.writeFileSync(path.join(dir, '남의파일.md'), '남의 것\n');   // 한글 이름 = core.quotepath 회귀를 겸한다
    g('add', 'a.md', '남의파일.md'); g('commit', '-qm', 'base');
    g('checkout', '-q', '-b', 'other');
    fs.writeFileSync(path.join(dir, 'a.md'), '저쪽\n'); g('commit', '-qam', 'other');
    g('checkout', '-q', '-');                                        // 기본 브랜치 이름에 안 기댄다
    fs.writeFileSync(path.join(dir, 'a.md'), '이쪽\n'); g('commit', '-qam', 'mine');
    try { g('merge', 'other'); } catch { /* 충돌로 실패하는 것이 이 픽스처의 목적이다 */ }
    assert.ok(fs.existsSync(path.join(dir, '.git', 'MERGE_HEAD')),
      '픽스처가 충돌 merge 를 못 만들었다 — 아래 검사가 통과해도 아무 뜻이 없다');
    if (남의수정) fs.writeFileSync(path.join(dir, '남의파일.md'), '남이 지금 고치는 중\n');
    return fn(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('충돌로 더러워진 트리에서도 탈출구는 열려 있다 — 충돌 파일은 그 작업 자신의 상태다 (F103)', () => {
  충돌저장소({}, (dir) => {
    ['git merge --continue', 'GIT_EDITOR=true git merge --continue', 'git merge --abort',
     'git add a.md && git merge --continue'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, `충돌 해소의 유일한 통로를 막았다: ${c}`);
    });
    assert.equal(가드_at('git reset --hard', dir).차단, true,
      'reset --hard 는 그 작업의 탈출구가 아니라 뭉툭한 도구다 — 충돌분까지 그대로 세야 한다(F037)');
  });
});

test('충돌 중이라도 무관한 남의 미커밋이 있으면 abort 를 막는다 — F037 보호는 그대로 (F103)', () => {
  충돌저장소({ 남의수정: true }, (dir) => {
    const r = 가드_at('git merge --abort', dir);
    assert.ok(r.차단, '남의 편집이 쓸려나가는데 통과시켰다 — 충돌분 제외가 규칙⑤를 통째로 무르게 만들었다');
    assert.match(r.사유, /남의파일\.md/,
      '무엇이 사라질지 안 보여준다(한글이 8진 이스케이프로 나오면 이 검사가 잡는다 — core.quotepath)');
    assert.match(r.사유, /충돌 중인 \d+개는 뺐다/, '무엇을 위험으로 셌는지 밝히지 않으면 판단이 안 선다');
  });
});

/* ── 규칙 ⑦: stash 는 남의 수정을 「지우는」 대신 「옮긴다」 (F066·F068) ──────────────
 * 되감기(규칙⑤)와 같은 자리, 방향만 다르다. 실사고에서 pop 이 늦어 원 세션이
 * 「내 편집이 사라졌다」고 오판해 복구를 시작하기 직전까지 갔다 — 피해가 작았던 건 운이었다.
 * 가르는 기준은 금지가 아니라 **범위**다: 경로 없으면 남의 것이 반드시 함께 간다. */

test('경로 없는 stash 는 더러운 트리에서 막는다 (F066 — 옆 세션 121줄이 딸려 갔다)', () => {
  더러운저장소((dir) => {
    ['git stash', 'git stash -u', 'git stash push', 'git stash save "잠깐"'].forEach((c) => {
      const r = 가드_at(c, dir);
      assert.equal(r.차단, true, `트리 전체를 쓸어담는데 막지 않았다: ${c}`);
      assert.match(r.사유, /git show HEAD:/, '치우지 말고 읽는 대안(git show HEAD:경로)을 안 준다');
    });
  });
});

test('경로를 준 stash 는 통과하되 확인을 요구한다 (자기 대피는 정당하다)', () => {
  더러운저장소((dir) => {
    const r = 가드_at('git stash push -- a.md', dir);
    assert.equal(r.차단, false, '경로를 준 대피까지 막으면 자기 편집을 지킬 방법이 없다(규칙⑤가 권하는 경로다)');
    assert.ok(r.사유, '조용히 지나갔다 — 그 파일이 남의 것인지 확인할 계기가 사라진다');
  });
});

test('조회 계열은 건드리지 않는다 — 읽기를 막으면 통로가 BYPASS 밖에 없어진다 (F212)', () => {
  더러운저장소((dir) => {
    ['git stash list', 'git stash show', 'git stash show -p stash@{0}', 'git stash create'].forEach((c) => {
      assert.strictEqual(가드_at(c, dir).사유, '', `읽기 전용 조회를 막거나 잔소리했다: ${c}`);
    });
  });
});

/* 🔴 F212 잔여 — 위 목록의 이름은 「읽기전용」이었는데 그 안에 pop·apply·drop·clear·branch 가 있었다.
 *    ⑦은 **담는 방향**만 세고 있었고, 쏟는 방향과 지우는 방향은 통째로 무사통과였다.
 *    실물 08-07: repo-staleness(F208)가 autostash 잔재 7파일을 알리며 「pop 은 대조 전 금지」라고
 *    말하는데 그 금지를 세는 층이 없었다 — 같은 판정이 두 곳에 적혀 갈라진 자리다. */
function 스태시있는저장소(더럽게, fn) {
  return 임시저장소(null, (dir) => {
    const g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'a.md'), '처음\n');
    g('add', 'a.md');
    g('commit', '-qm', 'init');
    fs.writeFileSync(path.join(dir, 'a.md'), '갇힌 편집\n');
    g('stash', 'push', '-q', '-m', '남의 autostash 잔재');
    if (더럽게) fs.writeFileSync(path.join(dir, 'a.md'), '남이 지금 편집 중\n');
    return fn(dir);
  });
}

test('🔴 pop·apply 를 더러운 트리에서 막는다 — ⑦의 역방향(담는 대신 쏟는다)', () => {
  스태시있는저장소(true, (dir) => {
    ['git stash pop', 'git stash apply', 'git stash apply stash@{0}',
     'git -C . stash pop'].forEach((c) => {
      const r = 가드_at(c, dir);
      assert.equal(r.차단, true, `남의 미커밋 위로 쏟는데 막지 않았다: ${c}`);
      assert.match(r.사유, /a\.md/, `무엇이 위험한지 안 보여준다: ${c}`);
    });
  });
});

test('깨끗한 트리에서는 pop 이 조용하다 — 잃을 것이 없으면 그건 정당한 복구다', () => {
  스태시있는저장소(false, (dir) => {
    assert.strictEqual(가드_at('git stash pop', dir).사유, '', '되살릴 자리에서 막았다');
  });
});

test('🔴 drop·clear·branch 를 막는다 — 아무 ref 도 안 가리키면 지우는 순간 복구 경로가 0이다', () => {
  스태시있는저장소(false, (dir) => {
    ['git stash drop', 'git stash clear', 'git stash drop stash@{0}',
     'git stash branch 살리기 stash@{0}'].forEach((c) => {
      const r = 가드_at(c, dir);
      assert.equal(r.차단, true, `유일본을 지우는데 막지 않았다: ${c}`);
      assert.match(r.사유, /autostash 잔재/, `무엇을 잃는지 안 보여준다: ${c}`);
    });
  });
});

/* 🔑 통과 조건은 **보존**이다(⑨의 「복원」과 같은 통로 · F103). 「어차피 못 지운다」로 두면
 *    잔재를 영영 못 치우게 되고 남은 출구가 BYPASS(전 규칙 off)뿐이라 F212 가 그대로 재발한다.
 *    ⚠ 이 검사는 repo-staleness 의 잔재 정리 처방(`stash drop`)이 다시 통하게 되는 자리이기도 하다. */
test('🔑 처방 되먹임 ② — 태그로 못 박으면 같은 drop 이 그대로 통과한다', () => {
  스태시있는저장소(false, (dir) => {
    assert.equal(가드_at('git stash drop stash@{0}', dir).차단, true, '전제가 안 섰다');
    execFileSync('git', ['tag', '보관/autostash-0', 'stash@{0}'], { cwd: dir });
    const r = 가드_at('git stash drop stash@{0}', dir);
    assert.equal(r.차단, false, `못 박았는데도 막는다 — 따를 수 없는 처방이라 출구가 BYPASS 뿐이다:\n${r.사유}`);
  });
});

test('⑦-c 는 **겨냥한 조각만** 본다 — 못 박힌 것 말고 다른 게 남아 있어도 그 drop 은 통과한다', () => {
  스태시있는저장소(false, (dir) => {
    // 두 번째 잔재를 하나 더 만든다(못 박히지 않은 채로)
    fs.writeFileSync(path.join(dir, 'a.md'), '두 번째 갇힌 편집\n');
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'stash', 'push', '-q', '-m', '또 다른 잔재'],
      { cwd: dir });
    execFileSync('git', ['tag', '보관/autostash-0', 'stash@{0}'], { cwd: dir });
    assert.equal(가드_at('git stash drop stash@{0}', dir).차단, false, '못 박은 조각을 남의 조각 때문에 막았다');
    assert.equal(가드_at('git stash drop stash@{1}', dir).차단, true, '안 박힌 조각을 남의 태그 덕에 통과시켰다');
    assert.equal(가드_at('git stash clear', dir).차단, true, 'clear 는 전부를 지우는데 하나만 보고 통과시켰다');
  });
});

test('빈 stash 에서는 drop·clear 가 조용하다 (과잉 차단은 BYPASS 를 가르친다)', () => {
  더러운저장소((dir) => {
    ['git stash drop', 'git stash clear'].forEach((c) => {
      assert.strictEqual(가드_at(c, dir).사유, '', `잃을 것이 없는데 막았다: ${c}`);
    });
  });
});

test('🔴 체인 뒤에 숨은 pop·drop 도 잡는다 (F218 — 앞 조각의 조회가 통과권이 아니다)', () => {
  스태시있는저장소(true, (dir) => {
    ['git stash list && git stash pop', 'git stash show; git stash drop'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, true, `앞 조각이 조회라고 뒤엣 것을 놓쳤다: ${c}`);
    });
  });
});

/* CLAUDE.md 가드 맹점③ — 차단 사유가 시키는 명령을 그 가드에 되먹여 통과하는지 본다.
 * 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103·F212 가 정확히 그 자리였다). */
test('🔑 처방 되먹임 — 차단 사유가 주는 명령이 이 가드를 통과한다', () => {
  스태시있는저장소(true, (dir) => {
    ['git stash show -p stash@{0}',
     'git stash show -p stash@{0} > 어딘가.patch',
     'git checkout stash@{0} -- 경로A 경로B'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, `자기 처방을 자기가 막는다: ${c}`);
    });
  });
});

test('깨끗한 트리에서는 stash 도 조용하다 (과잉 차단은 BYPASS 를 가르친다)', () => {
  임시저장소(null, (dir) => {
    assert.strictEqual(가드_at('git stash', dir).사유, '', '잃을 것이 없는데 막았다');
  });
});

/* 🔴 체인 (F216) — 규칙을 명령 **전체**에 걸면 양방향으로 틀린다. ④가 F103 에서 받은
 *    「체인을 분해해서 본다」 처방을 ⑦만 안 받고 있었다. 두 방향을 함께 못박는다. */
test('🔴 체인 뒤에 숨은 맨 stash 를 잡는다 — 첫 번째 하나만 보면 통과한다', () => {
  더러운저장소((dir) => {
    ['git stash list && git stash', 'git status; git stash', 'git stash show | cat; git stash -u'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, true, `앞 조각이 조회라고 뒤엣 맨 stash 를 놓쳤다: ${c}`);
    });
  });
});

test('체인 안의 조회는 여전히 안 막는다 — 거짓양성이 곧 BYPASS 손버릇이다', () => {
  더러운저장소((dir) => {
    // 옛 판은 `(\S*)` 가 구분자까지 삼켜 서브커맨드를 「list;」로 읽고 이것들을 막았다
    ['git stash list; git stash show', 'git stash list; git status', 'git stash show --stat x | tail -2'].forEach((c) => {
      assert.strictEqual(가드_at(c, dir).사유, '', `읽기 전용 조회를 막았다: ${c}`);
    });
  });
});

/* 🔴 F218 — ⑦과 **같은 원인**이 ②③⑤에도 있었다. 발동은 조각을 안 넘는데 **예외**를 명령
 *    전체에서 찾아, 앞 조각의 무해한 형태가 뒤 조각의 위험한 명령에 통과권을 줬다.
 *    셋 다 이 가드가 존재하는 이유 그 자체를 뚫는 방향이다(F013·F025·F037). */
test('🔴 앞 조각의 안전한 형태가 뒤 조각에 통과권을 주지 않는다 (F218 — ②③⑤)', () => {
  더러운저장소((dir) => {
    [
      ['git commit -- a.md && git commit -a -m x', /commit -a/],          // ② 남의 스테이징 동승
      ['git clean -n && git clean -fd', /git clean/],                     // ③ 미추적 삭제(복구 0)
      ['git rebase --abort && git reset --hard origin/master', /되감/],   // ⑤ 남의 미커밋 소멸
    ].forEach(([c, 지문]) => {
      const r = 가드_at(c, dir);
      assert.equal(r.차단, true, `앞 조각이 안전하다고 뒤엣 위험을 놓쳤다: ${c}`);
      assert.match(r.사유, 지문, `막긴 했는데 다른 규칙이 잡았다(원인이 안 고쳐진 것): ${c}`);
    });
  });
});

test('그 셋의 안전한 형태는 여전히 통과한다 — 과잉 차단은 BYPASS 를 가르친다 (F218)', () => {
  더러운저장소((dir) => {
    /* ⚠ 「막혔나」로 재면 안 되는 자리가 둘이다 — 더러운 트리에서 `git commit -- a.md` 는 ⑧(커밋
     *   범위 소유자)이, `git rebase --abort` 는 ⑤ 자신이 정상적으로 잡는다(237·247행이 이미 못박음).
     *   여기서 물을 것은 **그 규칙이 발동했는지**지 명령이 통과했는지가 아니다. */
    assert.doesNotMatch(가드_at('git commit -- a.md', dir).사유, /commit -a/,
      '경로를 준 커밋을 ② 가 잡았다 — 예외가 자기 조각에서 안 걸린다');
    const r = 가드_at('git clean -n', dir);
    assert.equal(r.차단, false, `dry-run 을 막았다\n   사유: ${r.사유}`);
  });
});

/* ⑤의 「abort 는 unmerged 를 위험에서 뺀다」 완화(F103)는 **충돌뿐인 트리**에서만 걸린다.
 * 일반 더러운 트리로는 이 자리를 못 잰다 — 다른 이유로 막혀 초록이 난다(변이 시험이 드러냈다:
 * 조각 고르는 순서를 지워도 아무 검사가 안 빨개졌다). 픽스처는 아래 `충돌저장소` 를 그대로 쓴다. */
test('🔴 충돌뿐인 트리 — abort 의 완화가 뒤따르는 reset --hard 를 세탁하지 않는다 (F218 ⑤)', () => {
  충돌저장소({}, (dir) => {
    assert.equal(가드_at('git merge --abort', dir).차단, false,
      '충돌뿐인 트리의 정당한 abort 를 막았다 — 그 작업의 유일한 탈출구다(F103)');
    assert.equal(가드_at('git merge --abort && git reset --hard origin/master', dir).차단, true,
      'abort 의 완화가 뒤엣 reset --hard 까지 세탁했다 — 남의 미커밋이 그대로 날아간다(F037)');
  });
});

test('stash 도 BYPASS 는 통한다', () => {
  더러운저장소((dir) => {
    assert.equal(가드_at('GIT_SCOPE_BYPASS=1 git stash', dir).차단, false, '의도적 예외 통로가 막혔다');
  });
});

/* ── 규칙 ⑥: 커밋 메시지를 셸 인용에 맡기지 않는다 (F054·F056·F060 — 같은 자리 3번째) ──
 * 프로즈가 두 번 실패한 자리다. v7.11 「셸이 둘이다」 조항이 있는 상태에서 F060 이 났고,
 * F056 은 처방(스크래치패드 + -F)까지 적어둔 뒤였다. 그래서 기계로 옮겼고, 여기서 그 탐지력을 잰다.
 *
 * ⚠ 이 규칙은 **거짓양성이 특히 비싸다** — 커밋 메시지에 코드를 인용하는 것은 이 저장소의 일상이고
 *   (지금 이 커밋도 그렇다), 과하게 막으면 BYPASS 를 습관으로 배운다. 그래서 안전한 형태
 *   (작은따옴표·이스케이프·-F·$ 뒤 숫자)를 차단 목록과 같은 무게로 검사한다. */

test('커밋 메시지 안에서 셸이 해석하는 문자를 막는다 (사라지거나 딴것으로 바뀐다)', () => {
  const 위험 = [
    ['git commit -m "인용 `mono` 있음" -- a.js', '백틱 — F060 실사고 그대로'],
    ['git commit -m "오늘 $(date) 기준" -- a.js', '명령 치환 $( )'],
    ['git commit -m "경로 $HOME 아래" -- a.js', '변수 확장 $HOME'],
    ['git commit -m "값 ${VAR} 참조" -- a.js', '변수 확장 ${ }'],
    ['git commit --message="백틱 `x` 포함" -- a.js', '--message= 형태도 같은 통로다'],
  ];
  for (const [c, why] of 위험) {
    const r = 가드(c);
    assert.equal(r.차단, true, `안 막았다(${why}): ${c}`);
    assert.match(r.사유, /-F/, '대안(-F)을 안 알려준다 — 막기만 하는 가드는 BYPASS를 학습시킨다');
  }
});

test('셸이 해석하지 않는 형태는 통과한다 (코드 인용은 이 저장소의 일상이다)', () => {
  const 안전 = [
    "git commit -m 'fix: `mono` 인용 — 작은따옴표는 리터럴이다' -- a.js",
    'git commit -m "이스케이프한 \\`백틱\\` 과 \\$변수 는 글자다" -- a.js',
    'git commit -F /tmp/msg.txt -- a.js',
    'git commit -m "가격 $100 인상" -- a.js',
    'git commit -m "평범한 제목" -- a.js',
    'git log --oneline -5',
  ];
  for (const c of 안전) {
    assert.equal(가드(c).차단, false, `안전한 형태를 막았다: ${c}`);
  }
});

test('전처리에 눈이 멀지 않는다 — stripNonExecutedText 가 -m 을 지운 뒤를 보면 이 결함은 안 보인다', () => {
  // 이 검사가 있는 이유: 위쪽 규칙들은 `exec`(= -m "…" 이 MSG 로 치환된 문자열)를 본다.
  // 규칙 ⑥ 이 실수로 같은 것을 보면 **항상 통과**가 되고, 그 방향은 조용하다.
  const r = 가드('git commit -m "백틱 `x`" -- a.js');
  assert.equal(r.차단, true, '메시지 본문을 못 보고 있다 — 원본 cmd 가 아니라 전처리 결과를 검사한 것');
});

/* ───────── 규칙 ⑧ · 범위 **안의 내용** (F073 · F104 · 2026-08-05) ─────────
 *
 * 왜 있나: ①~⑦ 은 전부 **명령의 범위**만 본다. 그런데 실사고 3건(d64ad85·b489f2e·6711ff2)은
 *   전부 이 가드가 권하는 `commit -- 경로` 형태로 났다 — 경로를 못 박아도 커밋되는 건 그 경로의
 *   **작업본 현재 상태**라, 같은 파일에 남이 편집해 둔 줄이 함께 실린다.
 *
 * 🔴 이 묶음의 최우선 불변식 = **「내가 만졌다」가 「내 것뿐이다」로 접히지 않는다.**
 *   b489f2e 는 내가 편집한 보드를 내가 커밋한 사고다 — 파일 단위 소유로는 원리상 안 보인다.
 *
 * 실저장소가 아니라 **픽스처 저장소 + 픽스처 상태 디렉터리** 위에서 돈다(작업본소유자 회귀와 같은 이음매).
 *   실저장소에 기대면 「지금 누가 살아있나」에 따라 초록/빨강이 흔들린다 — 재현 안 되는 빨강은 테스트를 꺼버리게 만든다. */
const os = require('node:os');
const store8 = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js'));
const 임시8 = [];
process.on('exit', () => { for (const d of 임시8) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} } });

function 픽스처8() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'scope8-repo-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'scope8-state-'));
  임시8.push(repo, state);
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { cwd: repo, encoding: 'utf8' });
  g('init', '-q');
  fs.writeFileSync(path.join(repo, '보드.md'), '| 내 줄 |\n| 남의 줄 |\n');
  fs.writeFileSync(path.join(repo, '엔진.js'), 'let a = 1;\n');
  g('add', '-A'); g('commit', '-qm', 'seed');
  return { repo, state, g };
}
/** track-collision 이 쌓는 것과 **같은 이름 규칙**으로 놓는다(safeId 는 lib 것을 쓴다 — 두 곳에 적으면 갈라진다). */
function 만진기록(state, repo, sid, touched, 분전 = 1, 검사시각) {
  const p = path.join(state, `track-${store8.projectKey(repo)}-${store8.safeId(sid)}.json`);
  /* `dirtyChecked` = **경로별** 「그 세션이 마지막으로 만진 때」(ms). 안 주면 넣지 않는다 —
   * 라이브에도 없을 수 있는 필드이고, 없을 때 ⑨가 「모름=막는 쪽」으로 떨어지는 것이 기본값이다(F241). */
  /* `at` 은 실물(track-collision 107행)이 늘 찍는 칸이다 — 픽스처가 빠뜨리면 `sweep()` 이 이 기록을
   * 지워 버려서, 청소를 끼운 검사가 **엉뚱한 이유로** 초록이 된다(남을 못 보니 통과 · F266). */
  fs.writeFileSync(p, JSON.stringify({
    at: Date.now(), baseline: 'x', lastHead: 'x', touched, warned: [], ...(검사시각 ? { dirtyChecked: 검사시각 } : {}),
  }));
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(p, t, t);
}
function 가드8({ repo, state, 나 = 'local_me', ownerRoot, 형제 }, command) {
  const env = { ...process.env, SYNK_CTXBUDGET_DIR: state, CLAUDE_CODE_HOST_SESSION_ID: 나 };
  /* `ownerRoot: null` = 이음매를 **비운다**. 그래야 훅이 스스로 잡는 뿌리를 잴 수 있다 —
   * 이 값을 늘 채워 주면 배선이 어긋나도 검사는 초록이다(F193 이 그렇게 살아남았다). */
  if (ownerRoot === null) delete env.SYNK_OWNER_ROOT;
  else env.SYNK_OWNER_ROOT = ownerRoot === undefined ? repo : ownerRoot;
  if (형제) env.SYNK_OWNER_SIBLINGS = 형제.join(';');
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8', cwd: repo, env,
  });
  if (!out.trim()) return { 차단: false, 사유: '' };
  const h = JSON.parse(out).hookSpecificOutput || {};
  return { 차단: h.permissionDecision === 'deny', 사유: String(h.permissionDecisionReason || '') };
}

test('🔴 ⑧ 내가 만진 파일이어도 **남이 함께 만졌으면** 펼쳐 보인다 (b489f2e·6711ff2 재현)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 내 줄 · 수정 |\n');   // 남의 줄이 사라진 상태
  만진기록(f.state, f.repo, 'local_me', ['보드.md']);
  만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
  const r = 가드8(f, 'git commit -m "보드 갱신" -- 보드.md');
  assert.equal(r.차단, true, '파일 단위 소유로 접혀 「내것」으로 통과했다 — 이 사고는 원리상 안 보이게 된다');
  assert.match(r.사유, /peer/, '누구와 함께 만졌는지를 안 알려준다');
  assert.match(r.사유, /남의 줄/, 'diff 본문을 안 펼쳤다 — 이름만 세는 검사(--stat)는 이 사고를 못 본다');
});

test('🔴 ⑧ 「내가 이미 커밋한 파일」은 소유 근거가 못 된다 (F104 신고 원문 그대로)', () => {
  /* 신고 원문: 「커밋 직전 diff 를 안 봐 남의 세리프 부활을 내 커밋에 실어 push 했다(d64ad85)」.
   * 그때 그 파일을 내 것으로 읽은 근거가 **내가 앞서 그 파일을 커밋했다는 사실**이었다.
   * 픽스처로 그 상태를 그대로 만든다: 내가 커밋한 이력이 있는 파일 + 그 뒤 남이 되살린 서체. */
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '카드.html'), 'font-family: SUIT;\n');
  f.g('add', '카드.html'); f.g('commit', '-qm', '내가 앞서 커밋한 파일');
  fs.writeFileSync(path.join(f.repo, '카드.html'), "font-family: SUIT;\n--kc-serif:'Fraunces';\n");
  만진기록(f.state, f.repo, 'local_peer', ['카드.html']);
  const r = 가드8(f, 'git commit -m "주석 현행화" -- 카드.html');
  assert.equal(r.차단, true, '커밋 이력을 소유 근거로 읽으면 d64ad85 가 그대로 재현된다');
  assert.match(r.사유, /Fraunces/, '무엇이 함께 실릴지 안 펼쳤다 — 커밋 「직전」에 보여야 의미가 있다');
});

test('⑧ 증명된 내 것뿐이면 **조용히 통과한다** (노이즈 가드는 BYPASS 를 학습시킨다)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '엔진.js'), 'let a = 2;\n');
  만진기록(f.state, f.repo, 'local_me', ['엔진.js']);
  assert.equal(가드8(f, 'git commit -m "엔진 수정" -- 엔진.js').차단, false, '내 것만 있는데 막았다');
});

test('🔴 ⑧ 펼침은 줄 수만이 아니라 **바이트로도** 자른다 (F316 — 가드가 제 세션을 죽인 자리)', () => {
  /* 2026-08-10 실측: 발표물 HTML 은 minify 되어 한 줄이 54,293 바이트다. 자르기가 「40줄」만
   * 세던 동안 커밋 한 번이 254만 바이트(≈60만 토큰)를 뿜어 컨텍스트 창(200k)을 4배로 넘겼고,
   * 같은 트랙을 이어받은 세션 9개가 연쇄로 같은 자리에서 죽었다.
   * 무엇을 막는 가드였든 세션을 끝내 버리면 그 자리에서 일이 멈춘다 — 막는 힘이 아니라 크기의 결함이다. */
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '덱.html'), '<div>seed</div>\n');
  f.g('add', '덱.html'); f.g('commit', '-qm', 'seed 덱');
  fs.writeFileSync(path.join(f.repo, '덱.html'), `<div>${'x'.repeat(54293)}</div>\n`);
  만진기록(f.state, f.repo, 'local_peer', ['덱.html']);
  const r = 가드8(f, 'git commit -m "덱" -- 덱.html');
  assert.equal(r.차단, true, '남이 만진 파일인데 안 막았다 — 이 검사의 전제가 깨졌다');
  assert.ok(r.사유.length < 15000, `펼침이 ${r.사유.length}바이트다 — 바이트 상한이 안 걸렸다(F316 재현)`);
  assert.match(r.사유, /덱\.html/, '잘라 놓고 무엇이 걸렸는지도 안 말한다');
  /* F103 — 잘랐으면 **실행 가능한** 대안을 줘야 한다. 여기서 `git diff` 전량을 시키면
   * 그게 바로 컨텍스트를 터뜨린 그 명령이라, 처방을 따르는 순간 세션이 또 죽는다. */
  assert.match(r.사유, /--stat|cut -c/, '잘라 놓고 안전하게 보는 법을 안 줬다');
});

test('🔴 ⑧ 긴 줄 **안쪽**이 바뀌면 다시 펼친다 (자르기가 스스로 낸 구멍)', () => {
  /* 해시 재료를 「잘린 글」로 잡으면 잘려 나간 구역의 변경이 해시를 못 흔들어
   * 「아까 봤다」로 조용히 통과한다 — 크기를 고치다 탐지에 사각을 뚫는 자리다.
   *
   * 🔑 픽스처는 **미추적 신규 파일**이어야 이 사각이 실제로 열린다(2026-08-10 변이로 실측).
   *   추적 파일로 쓰면 `git diff` 머리의 `index <blob>..<blob>` 줄이 앞 300바이트 안에 들어와
   *   내용이 바뀔 때마다 해시를 대신 흔들어 준다 — 잘린 글로 잡아도 초록이라, 탐지력 없는
   *   회귀가 「지킨다」는 얼굴로 남는다. 미추적 경로는 diff 가 아니라 파일 본문을 직접 읽어
   *   그 머리가 없으므로, 잘려 나간 구역의 변경이 곧바로 사각이 된다. */
  const f = 픽스처8();
  const 앞 = 'x'.repeat(50000);
  fs.writeFileSync(path.join(f.repo, '덱.html'), `<div>${앞}AAAA</div>\n`);   // 미추적 신규
  만진기록(f.state, f.repo, 'local_peer', ['덱.html']);
  assert.equal(가드8(f, 'git commit -m "x" -- 덱.html').차단, true, '첫 창은 펼치고 막아야 한다');
  fs.writeFileSync(path.join(f.repo, '덱.html'), `<div>${앞}BBBB</div>\n`);   // 잘려 나간 구역만 바뀐다
  assert.equal(가드8(f, 'git commit -m "x" -- 덱.html').차단, true,
    '잘린 구역의 변경을 못 봤다 — 해시를 원본이 아니라 잘린 글로 잡으면 이 자리가 통째로 사각이 된다');
});

test('⑧ 자기 처방을 막지 않는다 — 같은 명령을 그대로 다시 실행하면 통과한다 (맹점 ③ · F103)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 바뀐 줄 |\n');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
  const 첫 = 가드8(f, 'git commit -m "x" -- 보드.md');
  assert.equal(첫.차단, true, '처음엔 펼쳐야 한다');
  assert.match(첫.사유, /다시 실행/, '처방을 안 적었다 — 남는 탈출구가 BYPASS 하나뿐이면 우회가 정상 통로가 된다');
  assert.equal(가드8(f, 'git commit -m "x" -- 보드.md').차단, false, '처방대로 재실행했는데 또 막혔다(F103 재현)');
});

test('⑧ 미추적 신규 파일이 섞이면 처방이 「add 부터」를 같이 말한다 (F383)', () => {
  /* 신고 원문: 「같은 명령을 그대로 다시 실행한다」가 미추적 파일에선 따를 수 없다 —
   * 차단은 실행 전에 걸려 한 호출에 묶인 앞선 add 도 함께 무효가 되므로, add 없이 커밋만
   * 다시 치면 git 이 pathspec 오류로 죽는다(08-12 한 세션 2회). 처방이 그 갈래를 말해야
   * 우회(add -A)가 정상 통로가 되지 않는다(F103 계열). */
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '새표.md'), '| 새 파일 |\n');   // 미추적 신규 — 주인 모름
  const r = 가드8(f, 'git commit -m "x" -- 새표.md');
  assert.equal(r.차단, true, '미추적 신규 파일(주인 모름)인데 안 막았다 — 전제가 깨졌다');
  assert.match(r.사유, /미추적 신규 파일.*있다/, '미추적 갈래를 처방이 안 말한다 — 재실행이 pathspec 오류로 죽는다(F383)');
  assert.match(r.사유, /git add/, 'add 를 앞세우라는 실행 가능한 처방이 없다');
  assert.match(r.사유, /F383/, '근거 번호가 없다 — 다음 사람이 왜인지 못 찾는다');
});

test('⑧ 추적 파일뿐이면 미추적 갈래 문구를 붙이지 않는다 (F383 음성 — 노이즈가 되면 안 읽는다)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '표.md'), '| 1판 |\n');
  f.g('add', '표.md'); f.g('commit', '-qm', '표 최초');
  fs.writeFileSync(path.join(f.repo, '표.md'), '| 2판 |\n');
  만진기록(f.state, f.repo, 'local_peer', ['표.md']);
  const r = 가드8(f, 'git commit -m "x" -- 표.md');
  assert.equal(r.차단, true, '남이 만진 추적 파일인데 안 막았다');
  assert.doesNotMatch(r.사유, /F383|미추적 신규 파일\*\*이 있다/, '추적 파일뿐인데 미추적 처방이 붙었다 — 매번 붙는 경고는 곧 아무도 안 읽는다');
});

test('⑧ 그 사이 내용이 바뀌면 **다시** 펼친다 (한 번 본 것으로 영구 면제되지 않는다)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 1차 |\n');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
  assert.equal(가드8(f, 'git commit -m "x" -- 보드.md').차단, true);
  assert.equal(가드8(f, 'git commit -m "x" -- 보드.md').차단, false, '면제가 안 걸렸다');
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 2차 — 남이 그 사이 쓴 줄 |\n');
  const r = 가드8(f, 'git commit -m "x" -- 보드.md');
  assert.equal(r.차단, true, '내용이 바뀌었는데 옛 면제가 그대로 살아 통과했다');
  assert.match(r.사유, /2차/, '바뀐 내용을 안 펼쳤다');
});

/* 🔴 F141 — 처방이 **실행 불가능해지는** 자리(F103 계열 · 2026-08-06 실측 4회 연속 재차단).
 * `세션보드.md`·`마찰신호.md` 처럼 여러 세션이 상시 덧쓰는 파일은 시도할 때마다 내용이 달라져
 * 「같은 명령을 그대로 다시 실행하면 통과한다」에 **영영 못 닿는다.** 남는 문이 BYPASS 하나면
 * 우회가 정상 통로가 된다 — 그래서 끝나야 하고, 끝내되 **보여주면서** 끝나야 한다. */
test('🔴 ⑧ 매 시도마다 내용이 바뀌어도 끝난다 — 3번째는 통과하고 그 창에 바뀐 것이 실린다 (F141)', () => {
  const f = 픽스처8();
  const 보드 = path.join(f.repo, '보드.md');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
  const 명령 = 'git commit -m "x" -- 보드.md';

  fs.writeFileSync(보드, '| 1차 |\n');
  assert.equal(가드8(f, 명령).차단, true, '첫 창은 펼치고 막아야 한다');
  fs.writeFileSync(보드, '| 2차 — 옆 세션이 그 사이 덧썼다 |\n');
  const r2 = 가드8(f, 명령);
  assert.equal(r2.차단, true, '바뀐 내용은 한 번 더 보여준다');
  assert.match(r2.사유, /2차/, '바뀐 줄을 안 펼쳤다');
  fs.writeFileSync(보드, '| 3차 — 또 덧썼다 |\n');
  const r3 = 가드8(f, 명령);
  assert.equal(r3.차단, false,
    '무한 차단이다 — 처방(같은 명령 재실행)에 영영 못 닿으면 BYPASS 가 정상 통로가 된다(F103 재현)');
  assert.match(r3.사유, /3차/,
    '통과시키면서 그 사이 바뀐 것을 안 보여줬다 — 그건 보호가 아니라 그냥 조용한 통과다');
});

/** 세션이 하나 열리거나 닫히면 도는 **그 청소**를 실물로 부른다(`take()` · session-end-handoff 40행).
 *  `store8` 은 진짜 상태 폴더에 묶여 있으므로(STATE_DIR 은 로드 때 굳는다) 픽스처 폴더로 묶은 사본을
 *  새로 들인다 — 청소를 여기서 흉내 내면 그 흉내가 실물과 갈라지는 순간 검사가 눈이 먼다. */
function 청소(state) {
  const 경로 = require.resolve(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js'));
  const 전 = process.env.SYNK_CTXBUDGET_DIR;
  process.env.SYNK_CTXBUDGET_DIR = state;
  delete require.cache[경로];
  try {
    return require(경로).sweep();
  } finally {
    if (전 === undefined) delete process.env.SYNK_CTXBUDGET_DIR;
    else process.env.SYNK_CTXBUDGET_DIR = 전;
    delete require.cache[경로];   // 실물 폴더에 묶인 사본이 캐시에 남지 않게
  }
}

test('🔴 ⑧ 처방(「같은 명령을 그대로 다시 실행한다」)이 옆 세션 하나로 무효가 된다 (F266)', () => {
  /* 신고 원문: 같은 명령으로 2회 커밋을 시도했는데 둘 다 「지금 이 명령이 실어 갈 내용」(=첫 창)이 떴다.
   * 원인은 회차 로직이 아니라 **기억이 사라지는 것**이었다 — 이 기억엔 `at` 이 없었고, `sweep()` 은
   * `at` 없는 파일을 나이와 무관하게 지운다. 그 sweep 은 세션이 열리거나 닫힐 때마다 돌고 이 저장소는
   * 늘 세션 여럿이 굴러간다. 그래서 deny 문이 시키는 그 명령이 **영영 안 통하고** 남는 문은 BYPASS 뿐이다
   * (F103 → F141 → F229 → F264 에 이은 4번째 · 「차단 사유가 시키는 명령을 그 가드에 되먹여 본다」).
   * 조건은 하나만 바꾼다 — 그 사이에 청소가 도느냐. */
  const 재실행이통하나 = (사이에청소) => {
    const f = 픽스처8();
    fs.writeFileSync(path.join(f.repo, '보드.md'), '| 남이 쓴 줄 |\n');
    만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
    const 명령 = 'git commit -m "x" -- 보드.md';
    assert.equal(가드8(f, 명령).차단, true, '첫 창은 펼치고 막아야 한다');
    if (사이에청소) {
      assert.equal(청소(f.state), 0,
        '청소가 픽스처를 지웠다 — 그러면 이 검사는 「남이 안 보여서」 초록이 된다(엉뚱한 이유)');
    }
    return 가드8(f, 명령).차단 === false;
  };
  assert.equal(재실행이통하나(false), true,
    '기준선이 깨졌다 — 내용이 그대로면 재실행은 통과해야 한다(처방 자체가 거짓말이 된다)');
  assert.equal(재실행이통하나(true), true,
    '세션 하나가 열렸다 닫히는 것만으로 ⑧의 기억이 증발한다 — 처방이 실행 불가능해지고 BYPASS 가 정상 통로가 된다');
});

test('⑧ 두 번째 창은 **바뀐 것만** 싣는다 (같은 diff 를 다시 훑게 하지 않는다)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 보드 1차 |\n');
  fs.writeFileSync(path.join(f.repo, '엔진.js'), 'let a = 2; // 엔진쪽줄\n');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md', '엔진.js']);
  const 명령 = 'git commit -m "x" -- 보드.md 엔진.js';
  const r1 = 가드8(f, 명령);
  assert.match(r1.사유, /── 엔진\.js/, '첫 창은 둘 다 펼쳐야 한다');

  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 보드 2차 |\n');   // 보드만 바뀐다
  const r2 = 가드8(f, 명령);
  assert.equal(r2.차단, true);
  assert.match(r2.사유, /보드 2차/, '바뀐 파일을 안 펼쳤다');
  assert.doesNotMatch(r2.사유, /── 엔진\.js/,
    '안 바뀐 파일까지 다시 펼쳤다 — 두 번째 창의 값은 「무엇이 그 사이 바뀌었나」 하나뿐이다');
});

/* 🔴 F229 — F141 이 세운 3회차 탈출구는 **코드에만 있고 처방문이 안 가리켰다**(2026-08-08 실측).
 * deny 문의 두 갈래가 보드·장부에선 둘 다 실행 불가능하다: ①「전부 내 것이면 재실행」은 남의 줄이
 * 늘 섞이는 파일에서 **영원히 거짓**이고 ②「범위에서 빼라」는 그 파일이 유일하면 뺄 것이 없다.
 * 신고자는 2회차에서 멈췄고 그때 보드엔 종결 줄 7건이 미커밋으로 쌓여 있었다 — 새는 쪽이 인계 손실이다.
 * 고친 자리는 문구가 아니라 전제다: 이 두 파일은 남의 줄이 **함께 실리는 것이 정상**이라 첫 시도에 통과한다. */
/* 🔑 경로를 **통째로** 받는다(F293). 옛 판은 이름만 받아 폴더를 안에서 지어냈는데, 그러면
 *   폴더째 공유인 자리(`docs/_ops/보드/<지문>.md`·`docs/_ops/장부/F0NN.md`)를 원리상 못 만든다 —
 *   검사가 못 만드는 모양이 곧 검사에 안 걸리는 모양이고, 실제로 그 두 폴더가 사각이었다. */
function 공유판픽스처(f, rel = 'docs/세션보드.md') {
  const 폴더 = rel.split('/').slice(0, -1).join('/');
  fs.mkdirSync(path.join(f.repo, ...폴더.split('/')), { recursive: true });
  fs.writeFileSync(path.join(f.repo, rel), '| 내 종결 줄 |\n');
  f.g('add', rel); f.g('commit', '-qm', 'seed 공유판');
  fs.writeFileSync(path.join(f.repo, rel), '| 내 종결 줄 |\n| 남이 그 사이 쓴 선언 |\n');
  만진기록(f.state, f.repo, 'local_peer', [rel]);
  return rel;
}

test('🔴 ⑧ 상시 공유 선언판은 **첫 시도부터** 통과한다 — 처방 두 갈래가 여기선 둘 다 실행 불가능하다 (F229)', () => {
  const f = 픽스처8();
  const rel = 공유판픽스처(f);
  const r = 가드8(f, `git commit -m "보드 종결" -- ${rel}`);
  assert.equal(r.차단, false,
    '첫 시도에 막았다 — 「전부 내 것이면 재실행」은 남의 줄이 늘 섞이는 이 파일에서 영원히 거짓이고,'
    + ' 「범위에서 빼라」는 유일 파일이라 뺄 것이 없다. 두 갈래가 다 막히면 종결 줄이 미커밋으로 남는다(F229)');
  assert.match(r.사유, /남이 그 사이 쓴 선언/,
    '통과시키면서 실려 갈 내용을 안 펼쳤다 — 「안 보여주고 통과」는 보호가 아니라 그냥 조용한 통과다');
  assert.match(r.사유, /사라지지/,
    '무엇을 봐야 하는지를 안 알려줬다 — 이 파일에서 남는 위험은 남의 줄 **삭제** 하나뿐이다');
});

test('⑧ 장부도 같은 자리다 — 목록이 보드 하나에만 걸려 있으면 나머지 절반이 그대로 막힌다 (F229)', () => {
  const f = 픽스처8();
  const rel = 공유판픽스처(f, 'docs/_ops/마찰신호.md');
  assert.equal(가드8(f, `git commit -m "F229 해소" -- ${rel}`).차단, false,
    '장부는 보드와 같은 성질인데(F141 주석이 둘을 나란히 든다) 한쪽만 풀렸다');
});

/* 🔴 F293 — 완화 목록이 **이주를 안 따라가** 구조적으로 죽어 있었다(2026-08-12 실측).
 * 가드가 자기 목록을 따로 들고 두 경로만 적어 뒀는데, 그 둘은 지금 «옛 주소»다: 보드는 세션별
 * 파일로(F250), 장부는 번호별 조각 파일로 갈렸다. 그래서 완화는 아무도 안 쓰는 파일에서만 열리고
 * 살아 있는 공유판은 전부 첫 시도에 막혀 매번 diff 를 펼쳤다 — 그 펼침이 세션을 죽인다(F316).
 * 🔑 회귀를 **경로 셋으로** 건다: 이 셋은 옛 목록이 원리상 못 맞히는 모양이라, 목록을 정본에서
 *   파생하지 않고 되돌리면 여기가 빨개진다(사본으로 돌아가는 길을 검사가 막는다). */
for (const [무엇, rel] of [
  ['보드 폴더(F250 — 세션별 파일)', 'docs/_ops/보드/deadbeef.md'],
  ['장부 폴더(번호별 조각 파일)', 'docs/_ops/장부/F999.md'],
  ['작업대기열(세션마다 자기 줄을 넣는 선언판)', 'docs/_ops/작업대기열.md'],
]) {
  test(`🔴 ⑧ 지금 살아 있는 공유판도 첫 시도에 통과한다 — ${무엇} (F293)`, () => {
    const f = 픽스처8();
    공유판픽스처(f, rel);
    const r = 가드8(f, `git commit -m "x" -- ${rel}`);
    assert.equal(r.차단, false,
      `${rel} 이 막혔다 — 완화 목록이 정본(handoff-store 공용장부)에서 파생되지 않고 사본으로 굳었다는 뜻이다(F293)`);
    assert.match(r.사유, /남이 그 사이 쓴 선언/,
      '통과시키면서 실려 갈 내용을 안 펼쳤다 — 「안 보여주고 통과」는 보호가 아니다');
  });
}

/* ⚠ 완화가 «넓어지지는» 않았는지도 같이 못박는다 — 새는 방향이 반대로 뒤집히면
 * 남의 미커밋 코드가 조용히 실려 나간다(⑧이 애초에 막는 그것). */
test('⑧ 공유판 완화는 docs 아래 선언판까지다 — 이름이 비슷한 코드 경로는 그대로 막힌다 (F293)', () => {
  const f = 픽스처8();
  const rel = 공유판픽스처(f, 'tools/보드.js');
  assert.equal(가드8(f, `git commit -m "x" -- ${rel}`).차단, true,
    '「보드」라는 낱말이 들었다고 완화가 번졌다 — 판정은 낱말이 아니라 정본 목록이 진다');
});

test('🔴 ⑧ 코드 경로가 섞이면 완화가 **안 번진다** — 공유판 면제는 그 파일뿐이다 (F229)', () => {
  const f = 픽스처8();
  const rel = 공유판픽스처(f);
  fs.writeFileSync(path.join(f.repo, '엔진.js'), 'let a = 9; // 남이 쓴 줄\n');
  만진기록(f.state, f.repo, 'local_peer', [rel, '엔진.js']);
  const r = 가드8(f, `git commit -m "x" -- ${rel} 엔진.js`);
  assert.equal(r.차단, true,
    '공유판을 묶었더니 코드 파일까지 면제됐다 — 그러면 보드를 끼워 넣는 것이 ⑧의 우회로가 된다');
  assert.match(r.사유, /남이 쓴 줄/, '차단하면서 내용을 안 펼쳤다');
});

test('⑧ 회차는 **범위별**로 센다 — 딴 명령의 회차를 물려받아 조용히 통과하지 않는다', () => {
  const f = 픽스처8();
  const 보드 = path.join(f.repo, '보드.md');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md', '엔진.js']);
  fs.writeFileSync(보드, '| 1차 |\n');
  가드8(f, 'git commit -m "x" -- 보드.md');
  fs.writeFileSync(보드, '| 2차 |\n');
  가드8(f, 'git commit -m "x" -- 보드.md');          // 여기까지 보드 범위 2회

  fs.writeFileSync(path.join(f.repo, '엔진.js'), 'let a = 9; // 남이 쓴 줄\n');
  const r = 가드8(f, 'git commit -m "x" -- 엔진.js');
  assert.equal(r.차단, true,
    '다른 범위인데 앞선 회차를 물려받아 첫 시도부터 통과했다 — 회차를 전역으로 세면 그게 구멍이다');
  assert.match(r.사유, /남이 쓴 줄/, '첫 창인데 내용을 안 펼쳤다');
});

test('⑧ 미추적 신규 파일도 본다 — diff 가 비었다고 「변경 없음」으로 새지 않는다', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '남의신작.js'), 'const 남의것 = true;\n');
  const r = 가드8(f, 'git commit -m "x" -- 남의신작.js');
  assert.equal(r.차단, true, '미추적 파일이 통째로 검사 밖이다(미추적은 무보호 상태다 · F025)');
  assert.match(r.사유, /남의것/, '내용을 안 보여줬다 — 미추적은 git diff 가 원래 비어 있다');
});

test('⑧ 경로가 `add` 쪽에만 있는 형태도 잡는다 (가드가 함께 권하는 통로다)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 남이 쓴 줄 |\n');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
  const r = 가드8(f, 'git add 보드.md && git commit -m "x"');
  assert.equal(r.차단, true, 'add 쪽 경로를 안 읽으면 이 형태가 통째로 검사 밖이 된다');
});

test('🔴 ⑧ 소유 판정을 못 돌리면 **통과가 아니라** 펼친다 (모름은 안전이 아니다)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '엔진.js'), 'let a = 3;\n');
  만진기록(f.state, f.repo, 'local_me', ['엔진.js']);
  const 밖 = fs.mkdtempSync(path.join(os.tmpdir(), 'scope8-notrepo-'));
  임시8.push(밖);
  const r = 가드8({ ...f, ownerRoot: 밖 }, 'git commit -m "x" -- 엔진.js');
  assert.equal(r.차단, true, '판정 불가가 「미커밋 0건」과 같은 모양이 됐다 — 있는데 안심시키는 가드다');
});

test('⑧ 읽기 명령을 막지 않는다 — 서브커맨드를 토큰으로 가른다', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 뭔가 |\n');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
  /* 🔑 **스테이징을 채워 둔다.** 안 채우면 이 오탐이 잠복형이 된다: 정규식으로 서브커맨드를 재면
   *   `git log --oneline commit` 이 커밋으로 오인되지만, 범위가 비면 거기서 조용히 빠져나가
   *   차단까지 가지 않는다 — **검사는 초록인데 결함은 살아 있는** 상태다(변이 ⑥이 이걸로 새어 나갔다).
   *   스테이징이 있으면 그 오인이 곧바로 「읽기 명령 차단」으로 드러난다. */
  execFileSync('git', ['add', '보드.md'], { cwd: f.repo });
  for (const c of ['git log --oneline commit', 'git show HEAD:보드.md', 'git diff HEAD -- 보드.md', 'git status']) {
    assert.equal(가드8(f, c).차단, false, `읽기 명령을 막았다: ${c}`);
  }
  // 반대 방향도 함께 못박는다 — 진짜 커밋은 그 스테이징을 범위로 읽어 잡아야 한다(ⓒ 분기).
  assert.equal(가드8(f, 'git commit -m "x"').차단, true, '범위를 안 준 커밋이 스테이징을 안 본다');
});

test('🔴 ⑧ **형제 저장소**의 미커밋은 이 커밋 범위가 아니다 (F134 확장이 열어 둔 자리)', () => {
  /* 작업본소유자가 형제 저장소 미커밋도 항목에 담기 시작했다(F134). 그런데 ⑧의 범위 대조는
   * `gitCwd` 기준 경로로 하므로, 범위가 **디렉터리**면(위 검사대로 일상이다) 두 저장소에 같은
   * 폴더 이름이 있는 순간 형제 파일이 이 커밋에 실릴 것처럼 걸린다. 그리고 펼치기는 `gitCwd`
   * 에서 그 경로를 못 찾아 「내용을 못 읽었다」로 끝난다 — 사람이 고칠 수 없는 차단이고,
   * 그런 거짓 경보가 쌓이면 ⑧ 자체가 꺼진다(맹점 ③ · F103). */
  const f = 픽스처8();
  const 형제 = 픽스처8();
  fs.mkdirSync(path.join(f.repo, 'docs'));
  fs.writeFileSync(path.join(f.repo, 'docs', '내것.md'), '내 줄\n');
  만진기록(f.state, f.repo, 'local_me', ['docs/내것.md']);
  fs.mkdirSync(path.join(형제.repo, 'docs'));                        // 같은 폴더 이름 — 흔한 모양
  fs.writeFileSync(path.join(형제.repo, 'docs', '남의것.sql'), 'peer\n');

  const r = 가드8({ ...f, 형제: [형제.repo] }, 'git commit -m "내 문서" -- docs');
  assert.ok(!r.사유.includes('남의것.sql'),
    `형제 저장소 파일을 이 커밋 범위로 셌다 — 펼칠 수도 없는 경로라 차단이 처방 없이 남는다:\n${r.사유}`);
  assert.equal(r.차단, false, `증명된 내 것뿐인데 차단했다 — 노이즈 가드는 BYPASS 를 학습시킨다:\n${r.사유}`);
});

/* ⑨ **되돌림** — 남이 **이미 커밋한** 줄이 내 작업본에서 사라졌나 (F187 · 2026-08-07).
 *
 * ⑧과 축이 반대라 픽스처도 반대다: ⑧은 남의 **미커밋**을 심고, 여기는 남의 **커밋**을 심은 뒤
 * 작업본에서 그 줄을 지운다 — 도구가 옛 내용 위에 통째로 덮어쓴 상태가 정확히 그 모양이다.
 * 🔑 아래 검사들은 일부러 `local_peer` 의 **만진 기록을 비워 둔다.** 그래야 ⑧이 「내것 ∧ 함께 없음」
 *   으로 조용히 비켜서고, 짖는 것이 ⑨ 하나뿐임이 증명된다(⑧의 diff 본문에도 그 줄이 나오므로
 *   줄 내용만 대조하면 어느 규칙이 잡았는지 구별이 안 된다 — 그래서 커밋 해시로도 함께 못박는다). */
function 남이커밋(f, 파일, 내용, sid = 'local_peer') {
  fs.writeFileSync(path.join(f.repo, 파일), 내용);
  f.g('add', 파일);
  f.g('commit', '-qm', `남의 수리\n\nSession-Id: ${sid}`);
  return f.g('rev-parse', 'HEAD').trim().slice(0, 7);
}

test('🔴 ⑨ 남이 방금 커밋한 줄이 내 작업본에서 사라졌으면 막는다 (F187 실사고 재현)', () => {
  const f = 픽스처8();
  const h = 남이커밋(f, '왕복시험.js', 'const 기존 = 1;\nconst 새학생모드 = true;\nconst 동의발급실행 = true;\n');
  만진기록(f.state, f.repo, 'local_peer', [], 1);          // 아직 도는 세션 · 작업본은 안 만졌다
  만진기록(f.state, f.repo, 'local_me', ['왕복시험.js'], 0);
  // 내 도구가 그 커밋 **이전** 내용 위에 덮어썼다 — 남의 두 줄이 통째로 없다
  fs.writeFileSync(path.join(f.repo, '왕복시험.js'), 'const 기존 = 1;\nconst 내수정 = 2;\n');
  const r = 가드8(f, 'git commit -m "내 수정" -- 왕복시험.js');
  assert.equal(r.차단, true, `되돌림이 그대로 커밋된다 — git 은 오류를 안 내고 증상은 「-」 줄뿐이다:\n${r.사유}`);
  assert.match(r.사유, /되돌린다|되돌림/, '무슨 사고인지 이름을 안 붙였다 — ⑧의 「모름」과 구별이 안 된다');
  assert.match(r.사유, /새학생모드/, '사라지는 줄을 안 짚었다 — 눈으로 세게 하면 F187 이 그대로 재발한다');
  assert.ok(r.사유.includes(h), `되돌리는 커밋이 어느 것인지 안 알려줬다(${h}):\n${r.사유}`);
});

test('⑨ 자기 처방을 막지 않는다 — 지운 줄을 되살리면 같은 명령이 통과한다 (F103)', () => {
  const f = 픽스처8();
  남이커밋(f, '왕복시험.js', 'const 기존 = 1;\nconst 새학생모드 = true;\n');
  만진기록(f.state, f.repo, 'local_peer', [], 1);
  만진기록(f.state, f.repo, 'local_me', ['왕복시험.js'], 0);
  fs.writeFileSync(path.join(f.repo, '왕복시험.js'), 'const 기존 = 1;\nconst 내수정 = 2;\n');
  assert.equal(가드8(f, 'git commit -m "x" -- 왕복시험.js').차단, true, '처음엔 막아야 한다');
  // 사유가 시키는 대로 남의 줄을 되살린다
  fs.writeFileSync(path.join(f.repo, '왕복시험.js'), 'const 기존 = 1;\nconst 새학생모드 = true;\nconst 내수정 = 2;\n');
  const r = 가드8(f, 'git commit -m "x" -- 왕복시험.js');
  assert.equal(r.차단, false, `복원했는데도 막는다 — 따를 수 없는 처방은 BYPASS 를 정상 통로로 만든다:\n${r.사유}`);
});

test('🔴 ⑨ 같은 명령을 반복해도 안 뚫린다 — 통과 조건은 재실행이 아니라 **복원**이다', () => {
  /* ⑧은 공유 파일의 무한 차단을 끝내려 「같은 범위 3번째면 통과」를 갖고 있다(F141). 되돌림이
   * 그 문으로 새면 이 규칙은 있으나 마나다 — 재실행은 사라진 줄을 되살리지 않기 때문이다. */
  const f = 픽스처8();
  남이커밋(f, '왕복시험.js', 'const 기존 = 1;\nconst 새학생모드 = true;\n');
  만진기록(f.state, f.repo, 'local_peer', [], 1);
  만진기록(f.state, f.repo, 'local_me', ['왕복시험.js'], 0);
  fs.writeFileSync(path.join(f.repo, '왕복시험.js'), 'const 기존 = 1;\n');
  for (const 회 of [1, 2, 3, 4]) {
    assert.equal(가드8(f, 'git commit -m "x" -- 왕복시험.js').차단, true,
      `${회}번째 시도가 통과했다 — 반복만으로 되돌림이 세탁된다`);
  }
});

test('🔴 ⑨ **형제 저장소**에서 커밋해도 잰다 — 세션 기록은 「연 저장소」 키에 쌓인다', () => {
  /* 트랙 절반은 appsscript 를 열고 talk 파일을 만진다(F187 실사고가 그 모양이다). 산 세션 목록을
   * 커밋 대상 저장소 키로만 뽑으면 형제에서는 목록이 통째로 비어 이 규칙이 **영영 안 짖는다** —
   * 새는 방향은 언제나 「통과」다. 그래서 두 뿌리에서 모아 합집합으로 본다. */
  const f = 픽스처8();
  남이커밋(f, '왕복시험.js', 'const 기존 = 1;\nconst 새학생모드 = true;\n');
  만진기록(f.state, ROOT, 'local_peer', [], 1);            // 남의 세션은 **이 저장소**를 열고 형제를 만졌다
  만진기록(f.state, f.repo, 'local_me', ['왕복시험.js'], 0);
  fs.writeFileSync(path.join(f.repo, '왕복시험.js'), 'const 기존 = 1;\n');
  const r = 가드8(f, 'git commit -m "x" -- 왕복시험.js');
  assert.equal(r.차단, true, `형제 저장소에서 커밋하면 산 세션 목록이 비어 영영 안 짖는다:\n${r.사유}`);
});

test('⑨ 끝난 세션의 옛 줄을 지우는 건 평범한 작업이다 — 안 짖는다 (거짓양성)', () => {
  const f = 픽스처8();
  남이커밋(f, '엔진.js', 'let a = 1;\nlet 옛기능 = true;\n');
  만진기록(f.state, f.repo, 'local_peer', [], 99);         // 심장박동 멎음
  만진기록(f.state, f.repo, 'local_me', ['엔진.js'], 0);
  fs.writeFileSync(path.join(f.repo, '엔진.js'), 'let a = 1;\n');
  const r = 가드8(f, 'git commit -m "옛 기능 제거" -- 엔진.js');
  assert.equal(r.차단, false, `옛 코드 삭제까지 막으면 가드가 꺼진다(그리고 BYPASS 가 일상이 된다):\n${r.사유}`);
});

test('⑨ **내** 커밋의 줄을 지우는 건 안 짖는다 (거짓양성)', () => {
  const f = 픽스처8();
  남이커밋(f, '엔진.js', 'let a = 1;\nlet 내가쓴줄 = true;\n', 'local_me');
  만진기록(f.state, f.repo, 'local_me', ['엔진.js'], 0);
  fs.writeFileSync(path.join(f.repo, '엔진.js'), 'let a = 1;\n');
  assert.equal(가드8(f, 'git commit -m "정리" -- 엔진.js').차단, false, '내 줄을 내가 지우는 것까지 막았다');
});

test('⑨ 남의 줄이 **그대로 있으면** 조용하다 — 삭제 자체가 아니라 되돌림만 잰다 (거짓양성)', () => {
  const f = 픽스처8();
  남이커밋(f, '엔진.js', 'let a = 1;\nlet 남의기능 = true;\n');
  만진기록(f.state, f.repo, 'local_peer', [], 1);
  만진기록(f.state, f.repo, 'local_me', ['엔진.js'], 0);
  fs.writeFileSync(path.join(f.repo, '엔진.js'), 'let a = 1;\nlet 남의기능 = true;\nlet 내기능 = 2;\n');
  assert.equal(가드8(f, 'git commit -m "내 기능" -- 엔진.js').차단, false, '남의 줄을 안 건드렸는데 막았다');
});

/* ⑨ F189 — 「지웠다」와 「제자리에서 고쳤다」. 위 검사들은 전부 **새 파일**을 심어(=순수 추가 커밋)
 * 지운 줄이 0이라, 두 형태를 가르는 자리를 하나도 안 밟는다. 아래 셋이 그 자리를 픽스처로 못박는다:
 * 오탐 1(실사고 재현) · 진탐 1(수리가 탐지를 깎았나) · 거짓양성 1(같은 커밋 안의 자리 이동). */
function 남이수정(f, 파일, 처음, 나중) {
  남이커밋(f, 파일, 처음);
  const h = 남이커밋(f, 파일, 나중);
  만진기록(f.state, f.repo, 'local_peer', [], 1);          // 아직 도는 세션
  만진기록(f.state, f.repo, 'local_me', [파일], 0);
  return h;
}

test('🔴 ⑨ 남의 줄을 **제자리에서 고친 것**은 되돌림이 아니다 (F189 실사고 재현 · 02cd32d)', () => {
  /* 실사고: 절단문서 진행표의 한 줄에 8번을 끼워 넣는 편집인데 차단됐다. 판정이 「그 줄이 문자열로
   * 남아 있나」 하나뿐이라 **수정하면 원문이 사라져** 되돌림과 모양이 같아진다 — 그런데 공유 문서의
   * 한 줄을 고치는 것은 이 저장소의 일상이라, 이 오탐은 곧 BYPASS 를 정상 통로로 만든다(F103). */
  const f = 픽스처8();
  남이수정(f, '절단문서.md',
    '| 닫힘 | 남음 |\n| **5**(멱등키) | **2**·**6**·**8**·**14** |\n',
    '| 닫힘 | 남음 |\n| **5**(멱등키)·**6**(빈 껍데기) | **2**·**8**·**14** |\n');
  // 같은 줄에 8번을 끼워 넣는다 — 남의 원문은 사라지지만 **부모로 돌아간 것이 아니다**
  fs.writeFileSync(path.join(f.repo, '절단문서.md'),
    '| 닫힘 | 남음 |\n| **5**(멱등키)·**6**(빈 껍데기)·**8**(선택지 id) | **2**·**14** |\n');
  const r = 가드8(f, 'git commit -m "①-8 닫음" -- 절단문서.md');
  assert.equal(r.차단, false, `제자리 수정을 되돌림으로 읽었다 — 진행표 한 줄 갱신이 영구 차단된다:\n${r.사유}`);
});

test('🔴 ⑨ **수정형 커밋**이어도 작업본이 부모 판이면 막는다 (F189 수리가 탐지를 깎았나)', () => {
  /* F189 수리의 대가를 재는 자리다. 가르는 근거를 「그 커밋이 지운 줄이 아직 사나」로 두었으니,
   * 그 조건이 통째로 빠지거나 반대로 뒤집히면 **수정형 커밋에 대한 되돌림이 통째로 새어 나간다** —
   * 그리고 위의 순수 추가 픽스처들은 그 구멍을 하나도 안 밟는다(전부 지운 줄 0이라 옛 갈래로 간다). */
  const f = 픽스처8();
  남이수정(f, '절단문서.md',
    '| 닫힘 | 남음 |\n| **5**(멱등키) | **2**·**6**·**8**·**14** |\n',
    '| 닫힘 | 남음 |\n| **5**(멱등키)·**6**(빈 껍데기) | **2**·**8**·**14** |\n');
  // 내 도구가 그 커밋 **이전** 판 위에 덮어썼다 — 옛 줄이 그대로 살아 있다(=스테일)
  fs.writeFileSync(path.join(f.repo, '절단문서.md'),
    '| 닫힘 | 남음 |\n| **5**(멱등키) | **2**·**6**·**8**·**14** |\n| 내가 새로 붙인 문단 한 줄 |\n');
  const r = 가드8(f, 'git commit -m "내 수정" -- 절단문서.md');
  assert.equal(r.차단, true, `스테일 작업본이 수정형 커밋을 조용히 되돌린다 — 증상은 「-」 줄뿐이다:\n${r.사유}`);
  assert.match(r.사유, /빈 껍데기/, '사라지는 줄을 안 짚었다');
});

test('⑨ 같은 커밋 안에서 **자리만 옮긴 줄**은 부모의 증거가 아니다 (거짓양성)', () => {
  /* 옮긴 줄은 그 커밋의 `-`에도 `+`에도 있다. 빼지 않으면 「옛 줄이 아직 산다」가 **항상 참**이 되어,
   * 줄 순서를 바꾼 커밋 뒤로는 제자리 수정이 다시 전부 차단된다(오탐이 형태만 바꿔 돌아온다). */
  const f = 픽스처8();
  남이수정(f, '보드.md',
    '| 옮겨 다니는 줄 하나 |\n| 첫째 칸 |\n| 둘째 칸 |\n| 셋째 칸 |\n| 남이 쓴 상태 칸 원문 |\n',
    '| 첫째 칸 |\n| 둘째 칸 |\n| 셋째 칸 |\n| 옮겨 다니는 줄 하나 |\n| 남이 쓴 상태 칸 갱신 |\n');
  // 남의 상태 칸만 제자리에서 다시 고친다 — 옮겨 다닌 줄은 그대로 둔다
  fs.writeFileSync(path.join(f.repo, '보드.md'),
    '| 첫째 칸 |\n| 둘째 칸 |\n| 셋째 칸 |\n| 옮겨 다니는 줄 하나 |\n| 남이 쓴 상태 칸 갱신 2 |\n');
  const r = 가드8(f, 'git commit -m "상태 갱신" -- 보드.md');
  assert.equal(r.차단, false, `자리만 옮긴 줄을 부모의 흔적으로 셌다 — F189 오탐이 그대로 돌아온다:\n${r.사유}`);
});

/* 🔴 재는 단위가 판정 단위와 달랐다 — 판정은 **줄**인데 `지금.includes(줄)` 은 문자열 조각도 참으로 읽는다.
 *    실측 08-07(이 검사가 태어난 이유): 6536fd5 가 지운 이어쓰기 조각 `.split(/&&|…/)` 가 그 커밋이
 *    새로 더한 한 줄 **안에** 그대로 들어 있어, 옛 판이 살아 있는 것으로 읽혀 정당한 리팩터가 막혔다.
 *    처방은 「그 줄을 되살려라」인데 그 줄은 이미 있다 = 따를 수 없는 처방 → 남은 출구가 BYPASS 뿐(F103·F212).
 *    두 방향을 함께 못박는다 — 반대쪽(조각이라서 「안 사라졌다」로 통과)이 더 나쁘다. */
test('🔴 ⑨ 옛 줄이 **다른 줄 안에 조각으로** 들어 있는 것은 부모의 증거가 아니다 (거짓양성)', () => {
  /* 이 검사를 낳은 실물: 6536fd5 가 지운 이어쓰기 조각이 같은 커밋이 더한 한 줄 **안에** 들어 있었다. */
  const f = 픽스처8();
  남이수정(f, '가드.js',
    'function 고르기(원본, 조건) {\n  const 목록 = 원본\n    .split(/,/)\n    .filter(Boolean);\n  return 목록;\n}\n',
    'function 고르기(원본, 조건) {\n  const 뽑기 = 원본.split(/,/).find(조건);\n  return 뽑기;\n}\n');
  // 내가 그 지역변수 이름만 바꾼다 — 옛 줄 `.split(/,/)` 은 **조각으로만** 산다(부모 판이 아니다)
  fs.writeFileSync(path.join(f.repo, '가드.js'),
    'function 고르기(원본, 조건) {\n  const 골라낸것 = 원본.split(/,/).find(조건);\n  return 골라낸것;\n}\n');
  const r = 가드8(f, 'git commit -m "이름 바꿈" -- 가드.js');
  assert.equal(r.차단, false, `줄 조각을 부모의 흔적으로 셌다 — 정당한 리팩터가 영구 차단되고 출구가 BYPASS 뿐이다:\n${r.사유}`);
});

test('⑨ **들여쓰기된** 남의 줄이 그대로 있으면 사라진 것이 아니다 (거짓양성)', () => {
  /* 재는 쪽은 diff 줄을 trim 해서 모으므로 작업본도 같은 눈금으로 읽어야 한다. 안 그러면 들여쓰기가
   * 있는 줄은 **전부** 「사라졌다」가 되어, 함수 안을 만지는 모든 커밋이 막힌다(코드에선 그게 기본형이다). */
  const f = 픽스처8();
  남이커밋(f, '가드.js', 'function 검사(값) {\n  const 남의판정 = 값 > 1234 && 값 < 5678;\n  return 남의판정;\n}\n');
  만진기록(f.state, f.repo, 'local_peer', [], 1);
  만진기록(f.state, f.repo, 'local_me', ['가드.js'], 0);
  // 남의 줄은 그대로 두고 내 줄만 덧붙인다
  fs.writeFileSync(path.join(f.repo, '가드.js'),
    'function 검사(값) {\n  const 남의판정 = 값 > 1234 && 값 < 5678;\n  return 남의판정;\n}\nconst 내가붙인상수 = 42;\n');
  const r = 가드8(f, 'git commit -m "상수 추가" -- 가드.js');
  assert.equal(r.차단, false, `들여쓰기된 줄을 「사라졌다」로 읽었다 — 함수 안을 만지는 커밋이 전부 막힌다:\n${r.사유}`);
});

test('🔴 ⑨ 사라짐도 **줄 단위**로 잰다 — 조각으로 흩어진 것은 「그대로 있다」가 아니다', () => {
  /* 반대 방향(새는 쪽). 남이 커밋한 줄들이 내 한 줄 **안에** 조각으로 다 들어 있으면 문자열 포함은
   * 「하나도 안 사라졌다」로 읽고 통과시킨다 — 남의 3줄 판이 조용히 내 1줄로 되돌아간다.
   * ⚠ 순수 추가 커밋이라 부모의 흔적이 없다 = 못 가르는 자리이고, ⑨는 거기서 막는 쪽에 선다(F189). */
  const f = 픽스처8();
  남이수정(f, '가드.js',
    "const 남의상수 = '건드리지 않는 줄';\n",
    "const 남의상수 = '건드리지 않는 줄';\nconst 목록 = 원본\n  .split(/,/)\n  .find(조건);\n");
  // 내 도구가 남의 3줄 체인을 한 줄로 눌러 담았다 — 조각은 전부 남지만 그 줄들은 없다
  fs.writeFileSync(path.join(f.repo, '가드.js'),
    "const 남의상수 = '건드리지 않는 줄';\nconst 목록 = 원본.split(/,/).find(조건);\n");
  const r = 가드8(f, 'git commit -m "한 줄로" -- 가드.js');
  assert.equal(r.차단, true, `조각이 남았다고 통과시켰다 — 남의 커밋이 조용히 되돌아간다:\n${r.사유}`);
});

/* ⑨ F241 — 「지웠다」와 **「커밋한 뒤 자기 줄을 고쳤다」**. 위 F189 셋은 부모를 *그 커밋이 지운 줄*로
 * 재는데, **순수 추가 커밋엔 그 흔적이 0**이라 못 가르는 자리로 막는 쪽에 남아 있었다 — 그리고
 * 보드 선언 줄 추가가 정확히 그 형태다(세션이 자기 줄 하나를 더하고, 진행에 따라 그 줄을 고친다).
 * 가르는 재료는 diff 밖에 있다: **그 세션이 커밋 뒤 그 파일을 만졌나**(track-collision 의 경로별 시계).
 * 넷이 그 자리를 못박는다 — 오탐 1(실사고) · 진탐 1(수리가 탐지를 깎았나) · 경계 1(같은 초) · 사각 1(⑧이 받나). */
/* ⚠ 파일 이름이 검사 재료다 — 픽스처에 **없는** 파일이라야 그 커밋이 순수 추가가 된다.
 *   `보드.md`(픽스처 시드)로 쓰면 덮어쓰기가 *수정형* 커밋이 되어 F189 갈래로 빠지고,
 *   이 넷은 F241 자리를 하나도 안 밟은 채 초록이 된다(첫 판이 실제로 그랬고 진탐 둘이 잡았다). */
function 순수추가커밋(f) {
  남이커밋(f, '선언판.md', '| 첫째 |\n| **F239** 선언 — 만지는 파일: board-guard.js · 상태: 착수 |\n');
  return Number(f.g('log', '-1', '--format=%ct').trim());
}

test('🔴 ⑨ 남이 **커밋한 뒤 자기 줄을 고친 것**은 되돌림이 아니다 (F241 실사고 재현 · 7dd319a)', () => {
  /* 실사고 08-08: `local_c8e8aa51` 이 F239 선언 줄을 커밋한 뒤 같은 줄의 「만지는 파일」 칸을 고쳤고,
   * 그 다음 세션의 보드 커밋이 2회 연속 막혔다. 처방 「그 줄을 되살려라」는 **남의 더 새로운 편집을
   * 내 손으로 되돌리는 것**이라 F073 이 금지한 바로 그 행위다 = 따를 수 없는 처방, 출구가 BYPASS 뿐(F103).
   * 🔑 `touched` 는 비워 둔다 — 그래야 ⑧이 비켜서고 판정한 것이 ⑨ 하나임이 증명된다(아래 사각 검사가 짝). */
  const f = 픽스처8();
  const ct = 순수추가커밋(f);
  만진기록(f.state, f.repo, 'local_peer', [], 1, { '선언판.md': (ct + 5) * 1000 });   // 커밋 5초 뒤 고쳤다
  만진기록(f.state, f.repo, 'local_me', ['선언판.md'], 0);
  // 그 세션이 자기 줄의 칸을 제자리에서 고친 판 — 트리는 하나라 내 작업본에 그 최신 판이 있다
  fs.writeFileSync(path.join(f.repo, '선언판.md'),
    '| 첫째 |\n| **F239** 선언 — 만지는 파일: auto-commit.js · edit-stamp.js · 상태: 착수 |\n| 내 선언 줄 |\n');
  const r = 가드8(f, 'git commit -m "내 선언" -- 선언판.md');
  assert.equal(r.차단, false,
    `남의 후속 편집을 되돌림으로 읽었다 — 종결 줄이 못 올라가면 인계 3통로 중 보드가 끊긴다:\n${r.사유}`);
});

test('🔴 ⑨ 그 세션이 **커밋 전**에 만진 것은 알리바이가 아니다 (F241 수리가 탐지를 깎았나)', () => {
  /* 새는 방향을 재는 자리다. 시계를 안 보고 「그 세션이 살아 있으면 통과」로 넓히면 ⑨는 **통째로 꺼진다** —
   * 발동 조건 자체가 이미 「산 세션」이기 때문이다(신고문의 처방 후보 ②를 그대로 쓰면 그렇게 된다). */
  const f = 픽스처8();
  const ct = 순수추가커밋(f);
  만진기록(f.state, f.repo, 'local_peer', [], 1, { '선언판.md': (ct - 60) * 1000 });  // 커밋 1분 **전**이 마지막
  만진기록(f.state, f.repo, 'local_me', ['선언판.md'], 0);
  // 내 도구가 그 커밋 이전 판 위에 덮어썼다 — 남의 선언 줄이 통째로 없다
  fs.writeFileSync(path.join(f.repo, '선언판.md'), '| 첫째 |\n| 내 선언 줄 |\n');
  const r = 가드8(f, 'git commit -m "내 선언" -- 선언판.md');
  assert.equal(r.차단, true, `커밋 전 기록을 알리바이로 셌다 — 되돌림이 통째로 새어 나간다:\n${r.사유}`);
  assert.match(r.사유, /F239/, '사라지는 줄을 안 짚었다');
});

test('🔴 ⑨ **같은 초**의 기록은 「커밋 뒤」가 아니다 — 못 가르면 막는 쪽이다 (F241 경계)', () => {
  /* `%ct` 는 초 절삭이라 그 커밋의 실제 시각은 [ct, ct+1) 안 어디든이다. 같은 초를 「뒤」로 세면
   * 커밋 **직전**에 만진 기록이 알리바이가 되고, 새는 방향은 통과다(F062 계열의 경계). */
  const f = 픽스처8();
  const ct = 순수추가커밋(f);
  만진기록(f.state, f.repo, 'local_peer', [], 1, { '선언판.md': ct * 1000 + 999 });
  만진기록(f.state, f.repo, 'local_me', ['선언판.md'], 0);
  fs.writeFileSync(path.join(f.repo, '선언판.md'), '| 첫째 |\n| 내 선언 줄 |\n');
  assert.equal(가드8(f, 'git commit -m "내 선언" -- 선언판.md').차단, true,
    '같은 초를 「뒤」로 읽었다 — 커밋 직전의 기록이 알리바이가 된다');
});

test('🔴 ⑨ **형제 저장소** 좌표의 만진 기록도 알리바이로 읽는다 (F241 · 트랙 절반이 그 모양이다)', () => {
  /* 기록의 좌표는 「연 저장소」 기준이라, appsscript 를 열고 talk 를 만진 세션의 시계는
   * `../SYNK-talk/…` 로 쌓인다. 그 접두를 안 벗기면 형제에서는 알리바이가 **통째로 안 보이고**
   * F241 오탐이 그 절반에서 그대로 산다 — 위 넷은 전부 같은 뿌리라 이 자리를 안 밟는다. */
  const f = 픽스처8();
  const ct = 순수추가커밋(f);
  만진기록(f.state, ROOT, 'local_peer', [], 1, { [`../${path.basename(f.repo)}/선언판.md`]: (ct + 5) * 1000 });
  만진기록(f.state, f.repo, 'local_me', ['선언판.md'], 0);
  fs.writeFileSync(path.join(f.repo, '선언판.md'),
    '| 첫째 |\n| **F239** 선언 — 만지는 파일: auto-commit.js · 상태: 착수 |\n| 내 선언 줄 |\n');
  const r = 가드8(f, 'git commit -m "내 선언" -- 선언판.md');
  assert.equal(r.차단, false, `형제 좌표를 못 읽어 알리바이가 안 보인다 — 오탐이 트랙 절반에서 그대로 산다:\n${r.사유}`);
});

test('⑨ 가 비켜선 자리는 ⑧ 이 받는다 — 그 파일엔 그 세션의 미커밋이 반드시 있다 (사각 없음)', () => {
  /* F241 완화의 대가를 재는 자리. 그 세션이 고친 **뒤에** 내 도구가 다시 옛 판으로 덮으면 ⑨는
   * 통과시킨다 — 그때 그 파일엔 그 세션의 미커밋이 있으므로 ⑧이 「함께 만졌다」로 받아 펼친다.
   * 즉 완화가 사각을 만들지 않는다. 위 오탐 검사와 다른 것은 `touched` 하나뿐이다. */
  const f = 픽스처8();
  const ct = 순수추가커밋(f);
  만진기록(f.state, f.repo, 'local_peer', ['선언판.md'], 1, { '선언판.md': (ct + 5) * 1000 });
  만진기록(f.state, f.repo, 'local_me', ['선언판.md'], 0);
  fs.writeFileSync(path.join(f.repo, '선언판.md'), '| 첫째 |\n| 내 선언 줄 |\n');
  const r = 가드8(f, 'git commit -m "내 선언" -- 선언판.md');
  assert.equal(r.차단, true, `⑨가 비켜선 자리를 ⑧도 안 받으면 통째로 사각이다:\n${r.사유}`);
  assert.match(r.사유, /선언판\.md/, '무엇이 실릴지 안 펼쳤다');
  assert.ok(!/되돌림|되돌린다/.test(r.사유),
    `⑨가 잡은 것으로 읽힌다 — 이 검사는 ⑧이 받는다는 것을 증명해야 한다:\n${r.사유}`);
});

/* ───────── ⑨ · **이름이 곧 주인인 파일** = 인계문 조각 (F555 · 2026-08-17) ─────────
 *
 * 왜 «구조적» 거짓양성인가 — ⑨의 F241 알리바이(`커밋뒤만졌나`)가 읽는 `dirtyChecked` 는
 *   track-collision 이 **Edit·Write 도구 호출에서만** 찍는다. 그런데 인계문은 session-report 의
 *   `원자쓰기` 가 Node 에서 fs 로 직접 쓴다 — 도구를 안 거치므로 그 기록이 **원리상 한 줄도 안
 *   남는다.** 작업본소유자 273~282행이 같은 사실을 이미 적어 뒀다(「그 쓰기는 Edit·Write 를 안
 *   거쳐서 `touched` 기록에 한 줄도 안 남는다」) — 그 파일이 ⑨에 대해서만 사각이었다.
 *   그래서 알리바이가 **절대 참이 될 수 없고**, 생성기가 파일을 통째로 다시 쓸 때마다 옛 판의
 *   줄이 「사라진」 것으로 읽혀 되돌림으로 막힌다.
 *
 * 🔑 처방(「되살려라」)을 따르면 **낡은 판으로 되돌아가고** 다음 생성이 또 덮는다 = 따를 수 없는
 *   처방이고, 실제로 BYPASS 가 정상 통로가 됐다(F103 · 신고 원문).
 *
 * ⚠ 여는 범위는 **인계문 조각 하나**다. 보드 조각(`docs/_ops/보드/<지문>.md`)은 Write 도구로 쓰므로
 *   알리바이가 정상 작동한다 — 같이 열면 넓히는 쪽이고 새는 방향은 「통과」다. 그리고 **파일 이름의
 *   주인과 그 커밋의 주인이 같을 때만** 연다. 아래 음성 검사 둘이 그 두 경계를 못박는다. */
function 인계문커밋(f, 지문, 내용, sid) {
  fs.mkdirSync(path.join(f.repo, 'docs/_ops/인계문'), { recursive: true });
  return 남이커밋(f, `docs/_ops/인계문/${지문}.md`, 내용, sid || `local_${지문}`);
}

test('🔴 F555 재현 — 생성기가 통째로 다시 쓴 인계문을 ⑨ 가 「되돌림」으로 막는다', () => {
  const f = 픽스처8();
  const 경로 = 'docs/_ops/인계문/peer.md';
  인계문커밋(f, 'peer', '# 인계 — peer\n- 트랙: 옛 판이 남긴 트랙 줄\n- 다음: 옛 판이 남긴 다음 할 일\n');
  /* 🔑 `dirtyChecked` 를 **일부러 안 준다** — 생성기가 fs 로 쓰는 라이브의 모양 그대로다.
   *   여기에 기록을 주면 F241 이 통과시켜서, 이 검사는 **결함이 살아 있어도 초록**이 된다. */
  만진기록(f.state, f.repo, 'local_peer', [], 1);
  만진기록(f.state, f.repo, 'local_me', [경로], 0);
  // 생성기가 최신 상태로 통째로 다시 썼다(append 아님) — 옛 줄은 «갱신»된 것이지 지워진 게 아니다
  fs.writeFileSync(path.join(f.repo, 경로), '# 인계 — peer\n- 트랙: 새 판이 남긴 트랙 줄\n- 다음: 새 판이 남긴 다음 할 일\n');
  const r = 가드8(f, `git commit -m "인계문 갱신" -- ${경로}`);
  /* 🔑 과녁은 **⑨ 하나**다. ⑧ 이 「남도 만졌다」로 한 번 펼치는 것은 정상이고 — 파일 이름이
   *   주인을 가리키니 `판정들` 이 peer 를 주인으로 세운다 — 그 처방은 「같은 명령을 그대로 다시
   *   실행」이라 **따를 수 있다**(F141). F555 가 「따를 수 없다」고 신고한 것은 ⑨ 의 「되살려라」
   *   뿐이다: 그것만이 방금 생성된 최신판을 낡은 판으로 되돌리라고 시킨다.
   *   ⚠ 그래서 `차단 false` 로 단정하지 않는다 — 그렇게 재면 ⑧의 정상 동작까지 결함으로 세고,
   *     그 검사를 초록으로 만들려면 ⑧을 깎아야 한다(과녁이 아닌 것을 고치게 만드는 검사다). */
  assert.ok(!/되돌린다|되돌림/.test(r.사유),
    `⑨ 가 여전히 되돌림으로 막는다 — 그 처방(되살려라)을 따르면 낡은 판으로 돌아가고 다음 생성이 또 덮는다(F103):\n${r.사유}`);
  /* 그리고 남은 출구가 BYPASS 가 아님을 실제로 못박는다 — ⑧ 의 처방(재실행)이 통해야 한다.
   * 완화가 없으면 ⑨ 는 재실행으로 안 뚫리므로(통과 조건이 «복원»이다) 이 줄이 두 번째 그물이다. */
  const 다시 = 가드8(f, `git commit -m "인계문 갱신" -- ${경로}`);
  assert.equal(다시.차단, false,
    `펼친 뒤 재실행이 안 통한다 — 남는 출구가 BYPASS 하나뿐이면 그게 F555 가 신고한 상태 그대로다:\n${다시.사유}`);
});

test('🔴 F555 완화는 **이름이 가리키는 주인의 커밋**에만 연다 — 남이 쓴 판이면 그대로 막는다', () => {
  /* 새는 방향을 못박는 자리. 파일 이름만 보고 열면 「A 의 인계문을 B 가 적어 둔 줄」까지 조용히
   * 삭제로 실린다 — 그건 생성기의 자기 갱신이 아니라 진짜 되돌림이다. */
  const f = 픽스처8();
  const 경로 = 'docs/_ops/인계문/peer.md';
  인계문커밋(f, 'peer', '# 인계 — peer\n- 남이 손으로 적어 넣은 줄\n', 'local_other');
  만진기록(f.state, f.repo, 'local_other', [], 1);
  만진기록(f.state, f.repo, 'local_me', [경로], 0);
  fs.writeFileSync(path.join(f.repo, 경로), '# 인계 — peer\n- 내가 통째로 덮어쓴 줄\n');
  const r = 가드8(f, `git commit -m "덮어쓰기" -- ${경로}`);
  assert.equal(r.차단, true, `완화가 파일 이름만 보고 넓게 열렸다 — 새는 방향은 언제나 「통과」다:\n${r.사유}`);
  assert.match(r.사유, /되돌린다|되돌림/, '⑨ 가 잡은 것이 맞는지 이름으로 못박는다');
});

test('F555 완화가 **보드 조각으로 안 번진다** — 거기는 Write 기록이 남아 F241 이 이미 가른다', () => {
  const f = 픽스처8();
  const 경로 = 'docs/_ops/보드/peer.md';
  fs.mkdirSync(path.join(f.repo, 'docs/_ops/보드'), { recursive: true });
  남이커밋(f, 경로, '| 2026-08-17 | 남이 선언한 트랙 줄 | 만질 파일 | 상태 |\n');
  만진기록(f.state, f.repo, 'local_peer', [], 1);
  만진기록(f.state, f.repo, 'local_me', [경로], 0);
  fs.writeFileSync(path.join(f.repo, 경로), '| 2026-08-17 | 내가 통째로 덮어쓴 줄 | 만질 파일 | 상태 |\n');
  const r = 가드8(f, `git commit -m "보드" -- ${경로}`);
  assert.equal(r.차단, true, `완화가 보드 조각까지 번졌다 — 그 폴더는 Write 도구로 쓰므로 알리바이가 정상 작동한다:\n${r.사유}`);
});

test('🔴 ⑧ 은 **gitCwd 저장소**를 본다 — 형제 저장소 커밋에서 통째로 헛돌지 않는다 (F193)', () => {
  /* 위 ⑧ 검사들은 전부 `SYNK_OWNER_ROOT` 를 채워 준다 — 그래서 훅이 **스스로** 어느 뿌리를
   * 잡는지는 이 묶음 어디서도 안 쟀고, 그 사각에서 F193 이 살았다. 실사고 모양은
   * `cd SYNK-talk && git commit -- …`: 조사()가 appsscript 를 보게 되고, talk 파일은 「형제」로
   * 태그돼 `!i.저장소` 에 걸러지므로 **잴 것이 하나도 안 남는다**(=조용한 통과).
   * 실측(2026-08-07): 픽스처의 진짜 미커밋=통과 · 픽스처에 없는 appsscript 경로=차단. */
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 내 줄 |\n| 남의 줄 · 남이 고침 |\n');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
  const r = 가드8({ ...f, ownerRoot: null }, `cd ${f.repo} && git commit -m "x" -- 보드.md`);
  assert.equal(r.차단, true, `뿌리를 안 넘겨주면 ⑧ 이 남의 저장소를 재고 이 커밋은 조용히 나간다:\n${r.사유}`);
  assert.match(r.사유, /보드\.md/, '이 저장소의 위험을 안 짚었다');
});

test('⑧ 리다이렉션 대상은 커밋 범위가 아니다 — `> out.txt` (F193)', () => {
  /* `… -- 엔진.js > out.txt` 의 `>`·`out.txt` 가 그대로 범위로 들어갔다(실측 범위키 `>|엔진.js|out.txt`).
   * 해는 두 겹 — 안 담길 파일이 범위로 세이고, 회차 카운터 키가 **명령 표기마다 달라져**
   * F141 이 세운 「3번째면 통과」 탈출구가 안 열린다(=BYPASS 가 정상 통로가 된다 · F103). */
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, 'out.txt'), '남이 흘려둔 파일\n');
  만진기록(f.state, f.repo, 'local_peer', ['out.txt']);
  const r = 가드8(f, 'git commit -m "x" -- 엔진.js > out.txt');
  assert.equal(r.차단, false, `셸 꼬리를 경로로 읽어 커밋에 없는 파일을 범위로 셌다:\n${r.사유}`);
});

test('⑧ 범위가 **디렉터리**여도 그 안을 본다 (경로를 폴더로 주는 건 일상이다)', () => {
  const f = 픽스처8();
  fs.mkdirSync(path.join(f.repo, 'tests'));
  fs.writeFileSync(path.join(f.repo, 'tests', '남의검사.test.js'), 'assert(남의것);\n');
  만진기록(f.state, f.repo, 'local_peer', ['tests/남의검사.test.js']);
  const r = 가드8(f, 'git commit -m "x" -- tests');
  assert.equal(r.차단, true, '디렉터리로 주면 그 안이 통째로 검사 밖이 된다 — 새는 방향은 언제나 통과다');
  assert.match(r.사유, /남의검사/, '무엇이 실릴지 안 보여줬다');
});

/* ── ⑨ synk-memory push 차단 (F392) ──────────────────────────────
 * 규약 「세션은 읽기·커밋까지 — push 는 스케줄러·Actions 몫」의 기계 강제.
 * 판정 재료는 그 저장소의 `git remote -v` 라, 픽스처마다 원격을 실제로 단다. */
function 원격저장소(url) {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'scope-guard-remote-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (url) execFileSync('git', ['remote', 'add', 'origin', url], { cwd: dir });
  return dir;
}

test('⑨ synk-memory 원격이 달린 저장소의 push 를 막는다 — 커밋은 통과 (F392: 세션은 커밋까지)', () => {
  const dir = 원격저장소('https://github.com/unmet23-lab/synk-memory.git');
  try {
    ['git push', 'git push origin master', 'git push -u origin master'].forEach((c) => {
      const r = 가드_at(c, dir);
      assert.ok(r.차단, '메모리 백업 저장소의 push 를 막지 못했다: ' + c);
      assert.ok(/스케줄러|Actions/.test(r.사유), '차단 사유가 「누구 몫인지」를 말하지 않는다');
      assert.ok(/커밋/.test(r.사유), '「커밋까지는 세션 몫」이 빠졌다 — 처방 없는 차단은 우회를 가르친다(F103)');
    });
    // 처방문 되먹임(가드 3맹점 ③): 차단 사유가 시키는 「커밋에서 멈춘다」는 이 가드를 통과해야 한다
    assert.equal(가드_at('git commit -m "메모 갱신" -- topic.md', dir).차단, false,
      '커밋까지 막으면 처방을 따를 수 없다 — 그 순간 BYPASS 가 정상 통로가 된다');
    assert.equal(가드_at('git log --oneline -3', dir).차단, false, '읽기는 규약 그대로 자유다');
    assert.equal(가드_at('GIT_SCOPE_BYPASS=1 git push origin master', dir).차단, false,
      '의식적 우회(자동화 사망을 확인한 경우)는 존중한다');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
});

test('⑨ 보통 저장소의 push 는 안 막는다 — 배포 통로(origin master)가 일상이다', () => {
  const dir = 원격저장소('https://github.com/unmet23-lab/SYNK-appsscript.git');
  try {
    assert.equal(가드_at('git push origin master', dir).차단, false, '무관한 저장소의 push 를 막았다 — 과잉 차단은 BYPASS 습관을 만든다');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
});

test('⑨ 원격 없는 저장소·URL 직지정도 새지 않는다', () => {
  const 무원격 = 원격저장소(null);
  try {
    assert.equal(가드_at('git push origin master', 무원격).차단, false, '원격 조회가 비면 대상 아님으로 접는다(막는 쪽으로 새면 안 된다)');
    // 저장소 밖에서 URL 을 직접 찍는 형태 — 원격 목록엔 없지만 명령 조각에 있다
    const r = 가드_at('git push https://github.com/unmet23-lab/synk-memory.git master', 무원격);
    assert.ok(r.차단, 'URL 직지정 push 가 원격 목록 판정을 우회했다 — 새는 방향은 통과다');
  } finally { try { fs.rmSync(무원격, { recursive: true, force: true }); } catch {} }
});

test('⑨ `-C` 로 밖에서 조준한 push 도 그 저장소 기준으로 판정한다 (G 접두 규약)', () => {
  const dir = 원격저장소('https://github.com/unmet23-lab/synk-memory.git');
  try {
    const r = 가드(`git -C ${dir.replace(/\\/g, '/')} push origin master`);
    assert.ok(r.차단, '-C 형태를 못 잡았다 — 2026-08-04 「규칙 5개가 하나도 못 잡던」 그 구멍이다');
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
});

test('⑨-b 스케줄러 push 스크립트의 손 호출을 막는다 — 처방문 되먹임 구멍 (가드 맹점 ③)', () => {
  /* ⑨의 사유(「push 는 자동화 몫」)를 읽은 세션이 그 자동화(tools/memory-push.cmd)를 손으로
   * 당기면 같은 push 가 가드 시야 밖(.cmd 안의 git)에서 재현된다 — 처방이 우회 경로가 되면 안 된다. */
  [
    'tools/memory-push.cmd',
    'cmd /c tools\\memory-push.cmd',
    'node tools/board.js && tools/memory-push.cmd',
    "& 'C:/Users/q1212/Documents/SYNK-appsscript/tools/memory-push.cmd'",
  ].forEach((c) => {
    const r = 가드(c);
    assert.ok(r.차단, '자동화 스크립트 손 호출을 막지 못했다: ' + c);
    assert.ok(/정시/.test(r.사유), '「다음 정시가 싣는다」 처방이 빠졌다 — 처방 없는 차단은 우회를 가르친다(F103)');
  });
});

/* ── 규칙 ⑩: 훅 건너뛰기(`--no-verify`) (F473 · 2026-08-15) ──────────────────
 * 한 플래그가 pre-commit 여덟 + commit-msg 하나를 한꺼번에 끈다. 그중 제어문자·옛글자는
 * 커밋되는 순간 이력에 영원히 남아 다음 커밋으로 못 고친다 — 그래서 사후 검사로는 늦다. */

test('⑩ 훅 건너뛰기를 막는다 — commit·amend·결합 플래그·push 전부', () => {
  [
    'git commit --no-verify -m "x" -- a.md',
    'git commit --amend --no-verify -F msg.txt',
    'git commit -n -m "x" -- a.md',
    'git commit -nm "x" -- a.md',
    'git push --no-verify origin master',
  ].forEach((c) => {
    const r = 가드(c);
    assert.ok(r.차단, '훅 건너뛰기가 통과했다: ' + c);
    assert.match(r.사유, /F473/, `막긴 했는데 다른 규칙이 잡았다(원인이 안 고쳐진 것): ${c}`);
  });
});

test('⑩ 정상 통로·확인 통로는 그대로 둔다 — 그리고 이 사고를 «적는» 커밋도 통과해야 한다', () => {
  [
    // 차단 사유가 시키는 처방 그 자체 — 이게 막히면 남는 문은 BYPASS 하나뿐이다(맹점 ③)
    'git commit --amend -F msg.txt',
    // push 의 -n 은 --dry-run 이다 — 확인용 통로를 막으면 따를 수 없는 처방이 된다
    'git push -n origin master',
    // 🔑 44~46 줄이 경고한 그 자리 — 메시지 «안»의 문자열을 실행으로 읽으면 이 사고를 문서화할 수 없다
    'git commit -m "F473 — --no-verify 를 내 편의로 쓴 사고를 적는다" -- docs/x.md',
    'GIT_SCOPE_BYPASS=1 git commit --no-verify -m "x" -- a.md',
  ].forEach((c) => {
    assert.equal(가드(c).차단, false, '막으면 안 되는 것을 막았다: ' + c);
  });
});

test('⑨-b 읽기·언급은 자유다 — 문서화를 벌하는 가드는 BYPASS 를 가르친다', () => {
  [
    'cat tools/memory-push.cmd',
    'type tools\\memory-push.cmd',
    'rg -n "autostash" tools/memory-push.cmd',
    'git log --oneline -3 -- tools/memory-push.cmd',
    'git commit -m "memory-push.cmd 머리말 갱신" -- docs/x.md',
  ].forEach((c) => {
    assert.equal(가드(c).차단, false, '읽기·언급을 막았다: ' + c);
  });
});
