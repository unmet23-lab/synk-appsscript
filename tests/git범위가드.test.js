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

const HOOK = path.join(ROOT, '.claude', 'hooks', 'git-scope-guard.js');

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

test('되감기가 아닌 checkout·restore는 더러운 트리에서도 통과한다 (범위가 좁으면 안전하다)', () => {
  더러운저장소((dir) => {
    ['git checkout -b 새브랜치', 'git checkout master', 'git restore --staged a.md',
     'GIT_SCOPE_BYPASS=1 git reset --hard',
     'git commit -m "docs: reset --hard 사고 기록" -- a.md'].forEach((c) => {
      assert.equal(가드_at(c, dir).차단, false, '안전한 명령을 막았다: ' + c);
    });
  });
});
