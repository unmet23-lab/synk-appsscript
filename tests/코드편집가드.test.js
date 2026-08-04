/* code-edit-guard 회귀 — 셸로 코드 파일을 고치는 통로를 기계가 막는가.
 *
 * 왜 있나: 같은 사고가 **네 번** 났고 넷 다 결말이 같다 — 원복이 실패해 파일이 변이 상태로 남았다.
 *   F050 파이썬 heredoc 편집(이스케이프가 꼬여 두 번 파손) · F065 python subprocess 중간 사망으로
 *   원복 라인 미실행 · F067 `sed -i` + /tmp 로 간 백업 · 그리고 직전 세션의 네 번째.
 *   CLAUDE.md 「3번째 = 잘못 쓸 수 없는 공용 통로를 만들고 옛 통로를 테스트로 금지」.
 *
 * ⚠ 거짓양성이 특히 비싸다 — 이 저장소는 셸을 매 턴 쓴다. 과잉 차단은 BYPASS 를 습관으로
 *   가르치므로(v6.11), **통과해야 하는 목록을 차단 목록과 같은 무게로** 검사한다.
 *   그중 `node tools/로고주입.js` 는 이 훅이 권하는 **반대편 정답**이라 특히 중요하다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

// SYNK_TEST_CODEEDIT_HOOK = 변이 실험용 이음매. 평소엔 실훅을 본다.
const HOOK = process.env.SYNK_TEST_CODEEDIT_HOOK
  || path.resolve(__dirname, '..', '.claude', 'hooks', 'code-edit-guard.js');

function 가드(command, tool = 'Bash') {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: tool, tool_input: { command } }),
    encoding: 'utf8',
  });
  const out = (r.stdout || '').trim();
  if (!out) return { 차단: false, 조용: true, 사유: '' };
  const h = JSON.parse(out).hookSpecificOutput || {};
  return {
    차단: h.permissionDecision === 'deny',
    조용: false,
    사유: String(h.permissionDecisionReason || ''),
  };
}

test('훅 파일이 있고 실행된다 (없으면 아래 검사가 전부 무의미해진다)', () => {
  assert.ok(fs.existsSync(HOOK), 'code-edit-guard.js 가 없다');
  assert.equal(가드('ls -la').조용, true, '무관한 명령에 반응했다');
});

// ── ① in-place 편집기 (F067) ───────────────────────────────────────────────

test('sed -i 를 막는다 — F067 실사고 그대로', () => {
  const r = 가드("sed -i 's/불변/변이/' tools/eval-score.js");
  assert.equal(r.차단, true, 'F067 과 같은 형태가 통과했다');
  assert.match(r.사유, /F067/, '왜 막는지 근거가 없다');
  assert.match(r.사유, /Edit/, '대안을 안 알려준다 — 막기만 하면 BYPASS 를 배운다');
});

test('다른 저장소 파일이어도 막는다 (F067 의 대상은 SYNK-talk 였다)', () => {
  // 「repo 밖이면 봐준다」로 짰으면 실사고를 그대로 놓쳤을 자리다.
  assert.equal(가드('sed -i "s/a/b/" C:/Users/q1212/Documents/SYNK-talk/tools/eval-score.js').차단, true,
    '다른 저장소의 코드 파일을 놓쳤다 — F067 이 바로 그 경우다');
});

test('in-place 의 다른 표기·다른 실행기도 같은 통로다', () => {
  for (const c of [
    'sed --in-place "s/a/b/" Code.js',
    'sed -i.bak "s/a/b/" Code.js',
    'sed -ri "s/a/b/" Code.js',
    'perl -pi -e "s/a/b/" Code.js',
    'perl -i.bak -pe "s/a/b/" Code.js',
    'ruby -i -pe "gsub(/a/,%q(b))" Code.js',
  ]) {
    assert.equal(가드(c).차단, true, `막지 않았다: ${c}`);
  }
});

// ── ② 코드 파일에 써넣기 ───────────────────────────────────────────────────

test('리다이렉트로 코드 파일을 덮어쓰면 막는다', () => {
  for (const c of [
    'cat tmp.js > Code.js',
    'node tools/gen.js >> contents_교재.js',
    'printf "x" > "docs/발표물/02_학부모_안내문_A4_kr.html"',
    'echo "{}" > .clasp.json',
  ]) {
    assert.equal(가드(c).차단, true, `막지 않았다: ${c}`);
  }
});

test('tee · cp/mv 덮어쓰기 · PowerShell 쓰기 cmdlet 도 같은 통로다', () => {
  assert.equal(가드('cat a | tee Code.js').차단, true, 'tee 를 놓쳤다');
  assert.equal(가드('cp /tmp/eval-score.js.bak tools/eval-score.js').차단, true,
    '백업 되돌리기가 곧 덮어쓰기다 — F065·F067 이 실패한 바로 그 단계다');
  assert.equal(가드('mv new.js Code.js').차단, true, 'mv 덮어쓰기를 놓쳤다');
  assert.equal(가드('Set-Content -Path Code.js -Value $x', 'PowerShell').차단, true,
    'PowerShell 쓰기 cmdlet 을 놓쳤다 — 셸이 둘이라는 걸 훅이 알아야 한다');
  assert.equal(가드('$x | Out-File tests/safety.test.js', 'PowerShell').차단, true, 'Out-File 을 놓쳤다');
  assert.equal(가드('[IO.File]::WriteAllText("Code.js", $s)', 'PowerShell').차단, true, 'WriteAllText 를 놓쳤다');
});

// ── ③ 인라인 스크립트의 쓰기 (F050·F065) ───────────────────────────────────

test('python 인라인/힙독이 코드 파일에 쓰면 막는다 — F050·F065 그대로', () => {
  const 인라인 = 가드(`python -c "open('tools/eval-score.js','w').write(s)"`);
  assert.equal(인라인.차단, true, 'F065 와 같은 형태가 통과했다');
  assert.match(인라인.사유, /F050|F065/, '왜 막는지 근거가 없다');

  const 힙독 = 가드("python3 <<'PY'\nimport pathlib\npathlib.Path('tests/safety.test.js').write_text(x)\nPY");
  assert.equal(힙독.차단, true, 'F050 의 파이썬 heredoc 형태가 통과했다');
});

test('node -e 의 writeFileSync 도 같은 통로다', () => {
  assert.equal(가드(`node -e "require('fs').writeFileSync('Code.js', s)"`).차단, true,
    '실행기가 node 라고 봐주면 안 된다 — 두 겹 이스케이프는 언어를 안 가린다');
});

test('힙독은 「실행기에게 먹이는 것」만 본다 (커밋 메시지 힙독은 산문이다)', () => {
  // 가드가 산문을 벌하면 사람은 문서화를 그만두고 BYPASS 를 배운다(F049 계열).
  const r = 가드("git commit -F - <<'EOF'\nfix: writeFileSync('Code.js') 통로를 막았다\nEOF");
  assert.equal(r.조용, true, '커밋 메시지 안의 코드 예시를 명령으로 읽었다');
});

// ── 거짓양성 (차단 목록과 같은 무게) ────────────────────────────────────────

test('repo 도구 실행은 건드리지 않는다 — 이 훅이 권하는 반대편 정답이다', () => {
  for (const c of [
    'node tools/로고주입.js',
    'node tools/로고주입.js --check',
    'node tools/bump-version.js --desc "요약"',
    'node tools/board-move.js "문구"',
    'node tools/test-ci.js',
    'node --check Code.js',
  ]) {
    assert.equal(가드(c).조용, true, `정당한 도구 실행을 막았다: ${c}`);
  }
});

test('인라인 스크립트가 코드 파일을 **읽기만** 하면 통과한다', () => {
  /* 변이 실험이 드러낸 빈틈이다 — 쓰기API 검사를 통째로 없애는 변이를 넣었는데 **전부 초록**이었다.
   * 인라인 조회는 이 저장소의 일상인데(경로 하나 없는 테스트만 있었다), 그 한정이 실제로
   * 무엇을 지키는지 회귀가 증명하지 못하고 있었다(초록은 멀쩡함의 증명이 아니다). */
  for (const c of [
    `node -e "console.log(require('fs').readFileSync('Code.js','utf8').length)"`,
    `node -e "require('./tools/clasp-project.js')"`,
    `python3 -c "print(open('appsscript.json').read())"`,
  ]) {
    assert.equal(가드(c).조용, true, `읽기만 하는 인라인 조회를 막았다: ${c}`);
  }
});

test('읽기·스트림 편집은 통과한다 (in-place 가 아닌 sed 는 파일을 안 건드린다)', () => {
  for (const c of [
    "sed 's/a/b/' Code.js",
    "sed -n '1,20p' Code.js",
    "sed -e 's/a/b/' Code.js > /dev/null",
    'grep -i "writeFileSync" Code.js',
    'cat Code.js | head -50',
    'perl -e "print 1"',
    'cp Code.js /tmp/백업.js',
    'diff Code.js /tmp/백업.js',
  ]) {
    assert.equal(가드(c).조용, true, `무관한 명령을 막았다: ${c}`);
  }
});

test('임시 경로 쓰기는 통과한다 — 변이본을 사본으로 뜨는 것이 권장 경로다', () => {
  /* 막을 수 없는 걸 막으면 변이 검증 자체가 불가능해지고, 사람은 BYPASS 를 배운다(v6.11).
   * 처음엔 `sed -i` 를 무조건 막게 짰다가 이 목록에 걸려 규칙①에 경로 판정을 넣었다. */
  for (const c of [
    'node tools/x.js > /tmp/out.json',
    'echo "x" > C:/Users/q1212/AppData/Local/Temp/claude/scratchpad/probe.js',
    'node -e "require(\'fs\').writeFileSync(\'/tmp/probe.js\', s)"',
    'ls > /dev/null 2>&1',
    'sed -i "s/a/b/" /tmp/mut-guard.js',
    'sed -i "s/a/b/" "C:/Users/q1212/AppData/Local/Temp/claude/x/scratchpad/mut.js"',
    `node -e "require('fs').writeFileSync('/tmp/scratchpad/mut.js', s)"`,
  ]) {
    assert.equal(가드(c).조용, true, `권장 경로를 막았다: ${c}`);
  }
});

/* ── 아래 두 묶음은 병렬 세션(c04e7b7)이 shell-inline-guard 안에 세웠던 회귀다.
 *    같은 트랙이 두 훅으로 갈라졌다가 이쪽으로 합쳐지면서, 그 훅에서 규칙이 빠진다.
 *    **탐지 능력이 이관 과정에서 조용히 사라지지 않도록** 여기로 옮겨 못박는다. */

test('병렬 세션이 못박았던 차단 목록을 그대로 막는다 (트랙 병합 시 탐지 유실 방지)', () => {
  for (const c of [
    'sed -i "s/a/b/" Code.js',
    'sed -i.bak "s/a/b/" tools/doc-graph.js',
    'perl -pi -e "s/a/b/" 엔진_수집.js',
    'sed --in-place "s/a/b/" tests/safety.test.js',
    `python3 -c "open('Code.js','w').write(s)"`,
    `node -e "require('fs').writeFileSync('tools/x.js', s)"`,
  ]) {
    const r = 가드(c);
    assert.equal(r.차단, true, `이관 과정에서 탐지가 사라졌다: ${c}`);
    assert.match(r.사유, /Edit/, '무엇으로 대신할지(Edit 도구)를 안 알려준다');
  }
});

test('병렬 세션이 못박았던 통과 목록도 그대로 통과한다', () => {
  for (const c of [
    'git commit -m "feat: sed -i 로 파일 고치는 걸 막는다" -- a.js',
    'git commit -m "perl 은 -i 를 -pi 처럼 결합한다" -- a.js',
    'git commit -F - <<EOF\nsed -i 사고 기록\nEOF',
    'sed -e "s/a/b/" Code.js',
    'sed -n "1,20p" Code.js',
    'awk "{print \\$1}" a.txt',
    'grep -i foo Code.js',
    'sed "s/a/b/" Code.js | grep -i foo',
  ]) {
    assert.equal(가드(c).차단, false, `이관 과정에서 거짓양성이 늘었다: ${c}`);
  }
});

test('명령에 적힌 산문은 명령이 아니다 (F049 계열 — 문서화를 벌하지 않는다)', () => {
  for (const c of [
    'git commit -m "fix: sed -i 통로를 훅으로 막았다" -- .claude/hooks/code-edit-guard.js',
    'grep -rn "sed -i" docs/',
    'node tools/friction.js add --note "sed -i 로 Code.js 를 고쳤다"',
  ]) {
    assert.equal(가드(c).조용, true, `산문을 명령으로 읽었다: ${c}`);
  }
});

test('BYPASS 는 통한다 (금지가 목적이 아니다)', () => {
  assert.equal(가드('CODE_EDIT_BYPASS=1 sed -i "s/a/b/" Code.js').조용, true,
    '의도적 예외 통로가 막혔다');
});

test('Bash·PowerShell 이 아닌 도구에는 반응하지 않는다', () => {
  assert.equal(가드('sed -i "s/a/b/" Code.js', 'Edit').조용, true,
    '다른 도구의 입력에까지 반응했다 — 등록 밖에서 도는 판정은 유지비만 든다');
});

test('망가진 입력에도 작업을 막지 않는다', () => {
  const r = spawnSync(process.execPath, [HOOK], { input: '이건 JSON이 아니다', encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual((r.stdout || '').trim(), '', '입력을 못 읽었는데 차단했다');
});

// ── 등록층 (훅이 정확해도 안 불리면 통과가 된다 · F053) ─────────────────────

test('settings.json 라우팅이 이 훅보다 넓다', () => {
  const p = path.resolve(__dirname, '..', '.claude', 'settings.json');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const entry = (cfg.hooks?.PreToolUse || []).find((e) =>
    (e.hooks || []).some((h) => String(h.command || '').includes('code-edit-guard.js')));
  assert.ok(entry, 'code-edit-guard 가 settings.json 에 등록돼 있지 않다 — 파일만 있으면 안 돈다');
  assert.ok(new RegExp(entry.matcher).test('Bash'), '매처가 Bash 를 안 잡는다');
  assert.ok(new RegExp(entry.matcher).test('PowerShell'), '매처가 PowerShell 을 안 잡는다');

  /* case 필터가 **없어야** 한다.
   * 이 훅이 막는 표면은 sed·perl·ruby·tee·cp·mv·>·>>·Set-Content·Out-File·WriteAllText·
   * node/python/perl/ruby/deno/bun/php 인라인 … 으로 넓다. 앞단에서 다시 거르면
   * 규칙이 늘 때마다 필터를 같이 넓혀야 하고, 안 넓히면 **조용히** 샌다(F053·F063).
   * 판정층은 하나여야 한다 — screenshot-budget 이 같은 이유로 필터를 걷어냈다. */
  const cmd = String((entry.hooks || []).find((h) =>
    String(h.command || '').includes('code-edit-guard.js')).command);
  assert.ok(!/case "\$IN" in/.test(cmd),
    'settings.json 이 앞단에서 다시 거르고 있다 — 훅보다 좁은 필터는 그 자체가 구멍이다(F053)');
});
