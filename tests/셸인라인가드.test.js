/* shell-inline-guard 회귀 — 셸 인용에 코드를 맡기는 것을 기계가 막는가.
 *
 * 왜 있나: 같은 계열이 4번 났다(F054 here-string 누출 · F056 제목 첫머리 @ ·
 * F060 커밋 메시지 백틱 · F064 인라인 스크립트의 \$ 이스케이프). 앞의 셋은 커밋 메시지라
 * git-scope-guard 규칙⑥이 막지만, F064 는 git 명령이 아니라 **그 훅에 닿지도 않는다** —
 * 통로 자체가 없던 자리라 훅을 새로 세웠다.
 *
 * ⚠ 이 가드는 거짓양성이 특히 비싸다 — `node -e` 한 줄 조회는 이 저장소의 일상이고,
 *   과잉 차단은 BYPASS 를 습관으로 가르친다. 그래서 **통과해야 하는 목록을 차단 목록과
 *   같은 무게로** 검사한다(git-scope-guard·screenshot-budget 과 같은 원칙).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process'); // bash 재현용 — 훅은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

// SYNK_TEST_INLINE_HOOK = 변이 실험용 이음매. 평소엔 실훅을 본다.
const HOOK = process.env.SYNK_TEST_INLINE_HOOK
  || path.resolve(__dirname, '..', '.claude', 'hooks', 'shell-inline-guard.js');

function 가드(command, tool = 'Bash') {
  const r = 훅띄우기(HOOK, {
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
  assert.ok(fs.existsSync(HOOK), 'shell-inline-guard.js 가 없다');
  assert.equal(가드('ls -la').조용, true, '무관한 명령에 반응했다');
});

// ── ① 셸을 잘못 골랐다 (F054·F056) ─────────────────────────────────────────
// 실패가 아니라 **오염**이라 더 늦게 발견된다 — 본문이 「비슷하게 생긴 무언가」로 섞여 든다.

test('Bash 에 PowerShell here-string 을 보내면 막는다 (F054·F056)', () => {
  const r = 가드("git commit -F - <<X\n@'\n제목\n'@\nX", 'Bash');
  assert.equal(r.차단, true, 'Bash 에 @\'…\'@ 를 보냈는데 통과했다');
  assert.match(r.사유, /heredoc/, '무엇으로 대체할지를 안 알려준다');
});

test('PowerShell 에 Bash heredoc 을 보내면 막는다', () => {
  const r = 가드('git commit -F - <<EOF\n제목\nEOF', 'PowerShell');
  assert.equal(r.차단, true, 'PowerShell 에 heredoc 을 보냈는데 통과했다');
  assert.match(r.사유, /here-string/, '무엇으로 대체할지를 안 알려준다');
});

test('셸에 맞는 문법은 통과한다 (양쪽 다 정상 용법이 있다)', () => {
  assert.equal(가드('git commit -F - <<EOF\n제목\nEOF', 'Bash').조용, true,
    'Bash 의 정상 heredoc 을 막았다');
  assert.equal(가드("$m = @'\n제목\n'@", 'PowerShell').조용, true,
    'PowerShell 의 정상 here-string 을 막았다');
});

// ── ② 인라인 스크립트의 이스케이프 (F064) ──────────────────────────────────
// `\$` 는 「리터럴 달러」와 「확장하려다 잘못 막은 것」이 글자로 구별되지 않는다.

test('인라인 스크립트 안의 이스케이프된 $ 를 막는다 (F064 실사고 그대로)', () => {
  const r = 가드('node -e "const p=process.argv[1]; console.log(p)" "\\$SP"');
  assert.equal(r.차단, true, 'F064 와 같은 형태가 통과했다');
  assert.match(r.사유, /Write/, '대안(파일로 쓰기)을 안 알려준다 — 막기만 하면 BYPASS 를 배운다');
  assert.match(r.사유, /F064/, '왜 막는지 근거가 없다');
});

test('인라인 스크립트 안의 이스케이프된 백틱도 막는다 (F060 과 같은 축)', () => {
  const r = 가드('node -e "console.log(\\`x\\`)"');
  assert.equal(r.차단, true, '이스케이프된 백틱이 통과했다');
});

test('실행기가 node 가 아니어도 같은 통로다', () => {
  for (const c of [
    'python3 -c "print(\\$X)"',
    'perl -e "print \\$x"',
    'python -c "import os; print(\\$P)"',
  ]) {
    assert.equal(가드(c).차단, true, `막지 않았다: ${c}`);
  }
});

// ── 거짓양성 (차단 목록과 같은 무게) ────────────────────────────────────────

test('한 줄 인라인 조회는 조용히 통과한다 (이 저장소의 일상이다)', () => {
  for (const c of [
    'node -e "console.log(1+1)"',
    `node -e "JSON.parse(require('fs').readFileSync('a.json','utf8'))"`,
    'node --check a.js',
    'node tools/test-ci.js',
    'python3 script.py',
  ]) {
    assert.equal(가드(c).조용, true, `일상 명령을 건드렸다: ${c}`);
  }
});

test('실행기가 아닌 명령의 $ 와 백틱은 건드리지 않는다', () => {
  for (const c of [
    'git commit -m "정규식 ^scroll\\$ 을 못박았다" -- a.js',
    'echo "메일 test@example.com"',
    'grep -n "\\$HOME" a.sh',
    // ⚠ 아래 둘이 이 검사의 핵심이다 — `-e` 는 실행기 전용 플래그가 아니다.
    //   변이 실험이 이 빈틈을 드러냈다: 실행기 한정(node|python|…)을 없애는 변이를 넣었는데
    //   **13건 전부 초록이었다**. 위 세 줄엔 `-e` 를 쓰는 명령이 하나도 없어서, 한정이 실제로
    //   무엇을 지키는지 테스트가 증명하지 못하고 있었다(초록은 멀쩡함의 증명이 아니다).
    'grep -e "\\$HOME" a.sh',
    'sed -e "s/\\$x/y/" a.txt',
  ]) {
    assert.equal(가드(c).조용, true, `무관한 명령을 막거나 잔소리했다: ${c}`);
  }
});

test('여러 줄이어도 이스케이프가 깨끗하면 막지 않는다 (경고만)', () => {
  const r = 가드('node -e "\nconst fs=require(\'fs\');\nconsole.log(fs.readdirSync(\'.\').length);\n"');
  assert.equal(r.차단, false, '깨끗한 여러 줄 스크립트를 막았다 — 사다리의 중간 칸이다');
  assert.equal(r.조용, false, '여러 줄인데 아무 말도 없다 — 위험해지기 직전 자리를 안 알린다');
  assert.match(r.사유, /Write/, '무엇으로 옮기라는 건지가 없다');
});

/* ── ③ 코드 파일을 셸로 고치는 통로는 이 훅의 범위가 아니다 ──────────────────
 * 2026-08-04 조율: 같은 마찰(F050·F065·F067)을 두 세션이 각자 막았고, 옆 세션의
 * `code-edit-guard.js` 가 상위집합이라 이쪽 규칙을 물렸다(회귀도 tests/코드편집가드.test.js 로).
 * 남겨두면 판정층이 둘이 되고, 그게 08-04 스크린샷 예산 3번째 실패의 형태였다.
 * 이 훅은 셸 **문법·인용**만 본다 — 오배송(①)과 이스케이프(②). */

test('코드 파일을 고치는 명령은 이 훅이 판정하지 않는다 (code-edit-guard 의 몫)', () => {
  // 이 훅이 조용해야 판정층이 하나로 유지된다. 실제 차단은 code-edit-guard 가 한다
  // (그쪽 등록·탐지력은 tests/훅등록.test.js 와 tests/코드편집가드.test.js 가 지킨다).
  for (const c of [
    'sed -i "s/a/b/" Code.js',
    'perl -pi -e "s/a/b/" 엔진_수집.js',
    `node -e "require('fs').writeFileSync('tools/x.js', s)"`,
  ]) {
    assert.equal(가드(c).차단, false, `판정층이 둘이 됐다 — 규칙을 늘릴 때 둘 다 고쳐야 한다: ${c}`);
  }
});

test('BYPASS 는 통한다 (금지가 목적이 아니다)', () => {
  assert.equal(가드('SHELL_INLINE_BYPASS=1 node -e "console.log(\\$X)"').조용, true,
    '의도적 예외 통로가 막혔다');
});

// ── 등록층 (훅이 정확해도 안 불리면 통과가 된다 · F053) ─────────────────────

test('settings.json 매처·필터가 이 훅이 막는 입력을 전부 넘긴다', (t) => {
  const p = path.resolve(__dirname, '..', '.claude', 'settings.json');
  if (!fs.existsSync(p)) return t.skip('settings.json 없음 — 이 검사는 실저장소에서만 돈다');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const entry = (cfg.hooks?.PreToolUse || []).find((e) =>
    (e.hooks || []).some((h) => String(h.command || '').includes('shell-inline-guard.js'))
  );
  assert.ok(entry, 'shell-inline-guard 가 settings.json 에 등록돼 있지 않다 — 파일만 있으면 안 돈다');
  assert.ok(new RegExp(entry.matcher).test('Bash'), '매처가 Bash 를 안 잡는다');
  assert.ok(new RegExp(entry.matcher).test('PowerShell'), '매처가 PowerShell 을 안 잡는다');

  // case 필터를 bash 로 그대로 재현한다(패턴을 다시 구현하면 같이 틀린다).
  const cmd = String((entry.hooks || []).find((h) =>
    String(h.command || '').includes('shell-inline-guard.js')).command);
  const m = /case "\$IN" in ([^)]*)\)/.exec(cmd);
  if (!m) return; // 필터 없음 = 전부 훅으로 (가장 넓다)

  const 막는입력 = [
    ['Bash', "git commit -F - <<X\n@'\n제목\n'@\nX"],
    ['PowerShell', 'git commit -F - <<EOF\n제목\nEOF'],
    ['Bash', 'node -e "console.log(1)" "\\$SP"'],
    ['Bash', 'python3 -c "print(\\$X)"'],
    ['Bash', 'perl -e "print \\$x"'],
  ];
  const 미통과 = [];
  for (const [tool, command] of 막는입력) {
    const input = JSON.stringify({ tool_name: tool, tool_input: { command } });
    if (!가드(command, tool).차단) continue; // 훅이 관심 없는 입력은 따질 자리가 아니다
    const r = spawnSync('bash', ['-c',
      `IN=$(cat); case "$IN" in ${m[1].trim()}) echo PASS ;; *) echo BLOCK ;; esac`],
    { input, encoding: 'utf8' });
    if (r.error) return t.diagnostic('bash 없음 — case 필터 재현 건너뜀');
    if (!/PASS/.test(r.stdout || '')) 미통과.push(command.slice(0, 40));
  }
  assert.deepStrictEqual(미통과, [],
    '훅은 막는데 case 필터가 안 넘긴다 — 라우팅이 훅보다 좁으면 그 자체가 구멍이다(F053)');
});

test('망가진 입력에도 작업을 막지 않는다 (문법 도우미지 안전장치가 아니다)', () => {
  const r = 훅띄우기(HOOK, { input: '이건 JSON이 아니다', encoding: 'utf8' });
  assert.strictEqual((r.stdout || '').trim(), '', '입력을 못 읽었는데 차단했다');
});
