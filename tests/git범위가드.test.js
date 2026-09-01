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

/* 규칙 ⑧⑨(소유권 확인) 테스트는 2026-08-19 유호님 지시로 지웠다 — 해당 규칙 자체를
 * git-scope-guard.js 에서 잘라냈다(지운 세션 조율 체계에 기대던 5.4초짜리 원격 확인).
 * 아래 synk-memory push 차단(⑨-b)은 다른 규칙이라 그대로 남긴다. */

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
    'node tools/board.js && tools/memory-push.cmd', // tools/board.js 는 ⚠삭제됨 08-20 390195532 — 여기선 «명령 문자열» 픽스처라 그대로 둔다(가드가 파싱을 제대로 하는지만 본다)
    "& 'C:/Users/q1212/Documents/SYNK-appsscript/tools/memory-push.cmd'",
  ].forEach((c) => {
    const r = 가드(c);
    assert.ok(r.차단, '자동화 스크립트 손 호출을 막지 못했다: ' + c);
    assert.ok(/다음 회차/.test(r.사유), '「다음 회차가 싣는다」 처방이 빠졌다 — 처방 없는 차단은 우회를 가르친다(F103)');
    assert.ok(!/매시|정시|\d+\s*분마다/.test(r.사유),
      '주기를 사유에 적었다 — 그 값의 정본은 Task Scheduler 트리거다(「매시」로 적힌 채 실물은 10분이었다 · 08-29)');
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
