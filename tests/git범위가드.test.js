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

test('복구·조회 계열은 건드리지 않는다 (pop 은 오히려 되살리는 쪽이다)', () => {
  더러운저장소((dir) => {
    ['git stash pop', 'git stash list', 'git stash apply', 'git stash show', 'git stash drop'].forEach((c) => {
      assert.strictEqual(가드_at(c, dir).사유, '', `조회·복구를 막거나 잔소리했다: ${c}`);
    });
  });
});

test('깨끗한 트리에서는 stash 도 조용하다 (과잉 차단은 BYPASS 를 가르친다)', () => {
  임시저장소(null, (dir) => {
    assert.strictEqual(가드_at('git stash', dir).사유, '', '잃을 것이 없는데 막았다');
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
function 만진기록(state, repo, sid, touched, 분전 = 1) {
  const p = path.join(state, `track-${store8.projectKey(repo)}-${store8.safeId(sid)}.json`);
  fs.writeFileSync(p, JSON.stringify({ baseline: 'x', lastHead: 'x', touched, warned: [] }));
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

test('⑧ 자기 처방을 막지 않는다 — 같은 명령을 그대로 다시 실행하면 통과한다 (맹점 ③ · F103)', () => {
  const f = 픽스처8();
  fs.writeFileSync(path.join(f.repo, '보드.md'), '| 바뀐 줄 |\n');
  만진기록(f.state, f.repo, 'local_peer', ['보드.md']);
  const 첫 = 가드8(f, 'git commit -m "x" -- 보드.md');
  assert.equal(첫.차단, true, '처음엔 펼쳐야 한다');
  assert.match(첫.사유, /다시 실행/, '처방을 안 적었다 — 남는 탈출구가 BYPASS 하나뿐이면 우회가 정상 통로가 된다');
  assert.equal(가드8(f, 'git commit -m "x" -- 보드.md').차단, false, '처방대로 재실행했는데 또 막혔다(F103 재현)');
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
