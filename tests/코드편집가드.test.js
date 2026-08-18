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
const os = require('node:os');
const { 훅띄우기 } = require('./lib/훅띄우기');

// SYNK_TEST_CODEEDIT_HOOK = 변이 실험용 이음매. 평소엔 실훅을 본다.
const HOOK = process.env.SYNK_TEST_CODEEDIT_HOOK
  || path.resolve(__dirname, '..', '.claude', 'hooks', 'code-edit-guard.js');

const 저장소 = path.resolve(__dirname, '..');

/* cwd 를 **명시로 넘긴다.** 훅은 상대 경로를 cwd 기준으로 푸는데, 러너의 cwd 에 기대면
 * 「어디서 돌리느냐」에 따라 초록이 갈린다 — repo 밖 환경에 기댄 검사는 CI 에서 깨진다. */
function 가드(command, tool = 'Bash', cwd = 저장소, env = null) {
  const r = 훅띄우기(HOOK, {
    input: JSON.stringify({ tool_name: tool, tool_input: { command }, cwd }),
    encoding: 'utf8',
    // env = 홈 표기(`~`·`$HOME`) 검사용. 실제 홈에 기대면 기계마다 초록이 갈린다.
    env: env ? { ...process.env, ...env } : process.env,
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

/* 「대상이 지금 있는가」를 보는 규칙이 생겨서, 있고 없음을 **진짜 파일로** 만들어 검사한다.
 * 저장소 안에 만들지 않는다 — 검사가 작업 트리를 더럽히면 남의 커밋에 실려 나간다(F037). */
const 임시들 = [];
function 픽스처(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeedit-'));
  임시들.push(dir);
  for (const [상대, 내용] of Object.entries(파일들)) {
    const p = path.join(dir, 상대);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (내용 === null) fs.mkdirSync(p, { recursive: true }); else fs.writeFileSync(p, 내용);
  }
  return dir;
}
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 검사 결과가 아니다 */ } } });

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
  /* 🔑 F067 을 **실제로 있는 파일**로 못 박는다.
   *   원래 이 줄은 `tools/eval-score.js` 를 썼는데 그건 SYNK-talk 파일이라 이 저장소엔 없다.
   *   규칙이 「대상이 있나」를 안 물어보던 시절엔 그래도 초록이었다 — 즉 **없는 파일을 지킨다고
   *   주장하는 초록**이었다. 픽스처를 F067 모양으로 만들어 넘긴다(cwd 를 그 저장소로). */
  const 톡 = 픽스처({ 'tools/eval-score.js': 'const 점수 = 1;' });
  assert.equal(가드('cp /tmp/eval-score.js.bak tools/eval-score.js', 'Bash', 톡).차단, true,
    '백업 되돌리기가 곧 덮어쓰기다 — F065·F067 이 실패한 바로 그 단계다');
  assert.equal(가드('mv new.js Code.js').차단, true, 'mv 덮어쓰기를 놓쳤다');
  assert.equal(가드('Set-Content -Path Code.js -Value $x', 'PowerShell').차단, true,
    'PowerShell 쓰기 cmdlet 을 놓쳤다 — 셸이 둘이라는 걸 훅이 알아야 한다');
  assert.equal(가드('$x | Out-File tests/safety.test.js', 'PowerShell').차단, true, 'Out-File 을 놓쳤다');
  assert.equal(가드('[IO.File]::WriteAllText("Code.js", $s)', 'PowerShell').차단, true, 'WriteAllText 를 놓쳤다');
});

// ── ②-b cp·mv 는 「덮어쓸 것이 있을 때만」 덮어쓰기다 (F076) ────────────────
/* F076 실사고: 이 훅이 rename(`mv X X_구판.html`)과 새 사본 뜨기까지 막아서 한 세션이
 * **2회 연속 CODE_EDIT_BYPASS** 했다. 오탐이 잦으면 우회가 손버릇이 되고, 그 손버릇은
 * 진짜 덮어쓰기도 같은 손짓으로 통과시킨다 — 가드가 사는 방식이 아니라 죽는 방식이다.
 * 그래서 **통과해야 하는 쪽과 막아야 하는 쪽을 같은 무게로** 못 박는다. */

test('🔑 대상이 없으면 막지 않는다 — rename 과 새 사본은 이 통로가 아니다 (F076)', () => {
  const dir = 픽스처({
    'docs/정본/SYNK LAB/자료/크루카드_한국어.html': '<p>정본</p>',
    '엔진_수집.js': 'const a = 1;',
  });
  for (const c of [
    // F076 ②: 정본 자료 「구판」 표시 — 공백과 한글이 든 실제 경로 모양 그대로
    'mv "docs/정본/SYNK LAB/자료/크루카드_한국어.html" "docs/정본/SYNK LAB/자료/크루카드_한국어_구판_참고용.html"',
    // F076 ①: 정본 → 사본(바탕화면 배포). 없는 이름에 만드는 것은 아무것도 안 지운다
    'cp "docs/정본/SYNK LAB/자료/크루카드_한국어.html" "docs/사본/크루카드_배포본.html"',
    'mv 엔진_수집.js 엔진_수집_구판.js',
  ]) {
    const r = 가드(c, 'Bash', dir);
    assert.equal(r.차단, false, `없는 이름에 만드는 것을 막았다 — BYPASS 를 가르치는 자리다: ${c}\n${r.사유}`);
  }
});

test('그래도 「이미 있는」 코드 파일을 덮으면 막는다 — 느슨해진 게 아니다', () => {
  const dir = 픽스처({
    'docs/정본/SYNK LAB/자료/크루카드_한국어.html': '<p>정본</p>',
    'docs/정본/SYNK LAB/자료/크루카드_한국어_구판_참고용.html': '<p>구판</p>',
    'Code.js': 'const a = 1;',
  });
  for (const c of [
    // 같은 명령인데 **대상이 이미 있다** — 위 테스트와 오직 이 한 가지만 다르다
    'mv "docs/정본/SYNK LAB/자료/크루카드_한국어.html" "docs/정본/SYNK LAB/자료/크루카드_한국어_구판_참고용.html"',
    'cp /tmp/Code.js.bak Code.js',
  ]) {
    const r = 가드(c, 'Bash', dir);
    assert.equal(r.차단, true, `있는 파일을 덮는데 통과시켰다: ${c}`);
    assert.match(r.사유, /이미 있는|덮어쓴다/, '무엇 때문에 막는지가 안 보인다');
  }
});

test('🔴 공백이 든 경로를 조각내지 않는다 — 조각은 언제나 「없는 파일」이라 조용히 통과한다', () => {
  /* 이게 F076 아래 깔려 있던 두 번째 결함이다. 인용을 풀 때 공백을 지우면
   * `docs/정본/SYNK LAB/자료/X.html` 이 `자료/X.html` 로 잘리고, 그 조각은 무엇을 물어도
   * 「없다」가 나온다. 즉 대상 검사를 붙여도 **공백 든 경로는 영원히 통과**한다.
   * 이 저장소 경로 상당수가 공백을 품으므로, 새는 방향은 통과 쪽이다. */
  const dir = 픽스처({ 'docs/정본/SYNK LAB/자료/등록서.html': '<p>x</p>' });
  const r = 가드('cp /tmp/x.html "docs/정본/SYNK LAB/자료/등록서.html"', 'Bash', dir);
  assert.equal(r.차단, true, '공백 든 경로를 조각내 「없는 파일」로 읽었다');
  assert.match(r.사유, /SYNK LAB\/자료\/등록서\.html/, '사람에게 보이는 경로가 조각나 있다 — 조각을 보고 판정했다는 뜻이다');
});

test('디렉터리로 옮기면 진짜 대상은 `대상/원본이름` 이다', () => {
  const dir = 픽스처({
    'Code.js': 'const a = 1;',
    'backup/Code.js': 'const a = 0;',
    'backup/.keep': '',
    '새폴더/.keep': '',
  });
  assert.equal(가드('cp Code.js backup/', 'Bash', dir).차단, true,
    '대상 토큰만 보고 넘겼다 — backup/Code.js 가 이미 있다');
  assert.equal(가드('cp Code.js 새폴더/', 'Bash', dir).차단, false,
    '빈 폴더로 복사하는 것까지 막았다 — 지울 것이 없다');
});

test('대상을 특정할 수 없으면 막는다 — 모름을 통과로 번역하지 않는다', () => {
  const dir = 픽스처({ 'Code.js': 'const a = 1;' });
  for (const c of ['cp /tmp/a.js $대상.js', 'mv 구본.js *.js']) {
    assert.equal(가드(c, 'Bash', dir).차단, true, `글롭·변수를 「없다」로 읽었다: ${c}`);
  }
});

test('PowerShell 명명 인자는 자리가 아니라 이름으로 읽는다', () => {
  const dir = 픽스처({ 'Code.js': 'const a = 1;', '새것.js': 'const b = 2;' });
  assert.equal(가드('Copy-Item -Destination Code.js -Path 새것.js', 'PowerShell', dir).차단, true,
    '-Destination 이 앞에 오면 대상이 뒤집힌다');
  assert.equal(가드('Copy-Item -Destination 없던것.js -Path 새것.js', 'PowerShell', dir).차단, false,
    '없는 대상까지 막았다');
});

/* ── ②-b 잔여분 — 「해소」 뒤에 실측으로 드러난 3건 ─────────────────────────
 * F076 을 해소한 뒤 **신고된 그 두 명령을 그대로 다시 넣어 봤더니 아직 막혔다.**
 * 둘 다 `$HOME/OneDrive/Desktop/…` 이었는데 홈 표기가 unknown 으로 떨어져
 * 「모르면 막는다」에 걸린 것이다 — 장부는 해소인데 신고자는 그대로 막히는 상태였다.
 * 🔑 교훈: 마찰을 닫을 땐 **신고에 적힌 입력 그대로**를 회귀에 넣는다. 원인을 고쳤다는
 *   확신은 그 입력이 통과하는 걸 본 것과 다르다. */

test('`~`·`$HOME` 은 펼쳐서 본다 — 안 펼치면 F076 신고 명령이 그대로 막힌다', () => {
  const 홈 = 픽스처({ 'OneDrive/Desktop/있는것.html': '<p>x</p>' });
  const 환경 = { HOME: 홈, USERPROFILE: 홈 };
  assert.equal(가드('mv "$HOME/OneDrive/Desktop/없는것.html" "$HOME/OneDrive/Desktop/없는것_구판_참고용.html"', 'Bash', 저장소, 환경).조용,
    true, 'F076 신고 명령 ②(구판 rename)가 아직 막힌다');
  assert.equal(가드('cp docs/x.html "~/OneDrive/Desktop/새 사본 · 한국어.html"', 'Bash', 저장소, 환경).조용,
    true, 'F076 신고 명령 ①(바탕화면 사본)이 아직 막힌다 — `~` 를 못 펼쳤다');
  /* ⚠ 펼치기가 **통과 핑계**가 되면 안 된다 — 같은 표기라도 대상이 있으면 막아야 한다.
   *   이 줄이 없으면 「$HOME 이면 통과」라는 변이가 초록으로 지나간다. */
  assert.equal(가드('cp 정본.html "$HOME/OneDrive/Desktop/있는것.html"', 'Bash', 저장소, 환경).차단,
    true, '$HOME 을 펼치고도 **있는** 대상을 놓쳤다');
});

test('인용된 디렉터리 대상도 본다 — 확장자가 없다고 지우면 대상이 통째로 사라진다', () => {
  /* 인용 없는 `dir/` 는 원래 살아남았지만, 인용되면 `keepQuoted` 가 확장자로 걸러 **지웠다**.
   * 이 저장소의 실제 경로엔 공백이 흔해서(`SYNK LAB`) 디렉터리 대상은 대개 인용된다 —
   * 즉 실사용 쪽이 통째로 새고 있었다. */
  const dir = 픽스처({ '자료 폴더/원본.js': 'const a = 1;', '원본.js': 'const b = 2;', 'Code.js': 'const c = 3;' });
  assert.equal(가드('cp Code.js "자료 폴더/"', 'Bash', dir).조용, true,
    '충돌하지 않는 복사를 막았다 — 디렉터리라고 무조건 막으면 F076 이 되돌아온다');
  assert.equal(가드('cp 원본.js "자료 폴더/"', 'Bash', dir).차단, true,
    '인용된 디렉터리(끝 슬래시)가 샜다 — 진짜 자리는 `자료 폴더/원본.js` 다');
  assert.equal(가드('cp 원본.js "자료 폴더"', 'Bash', dir).차단, true,
    '끝 슬래시가 없으면 대상이 지워진다 — `cp x.js "$HOME/OneDrive/Desktop"` 형태가 통째로 샌다');
});

test('명령 자리가 아닌 `cp`·`mv` 는 명령이 아니다 (검색어·인자 자리 · F049 계열)', () => {
  /* 🔬 변이 실측이 잡아낸 빈틈이다 — 「명령 자리에서만 본다」는 제한을 지운 변이를 넣었더니
   *   **아무 테스트도 빨개지지 않았다.** 제한이 무엇을 지키는지 회귀가 증명하지 못하고 있었다.
   *   지우면 `grep -rn cp A B` 의 `cp` 가 명령으로 읽혀 B 를 「덮어쓸 대상」으로 본다. */
  const dir = 픽스처({ 'Code.js': 'const a = 1;', 'tests/safety.test.js': '// x' });
  assert.equal(가드('grep -rn cp Code.js tests/safety.test.js', 'Bash', dir).조용, true,
    '검색어 자리의 cp 를 명령으로 읽었다');
  assert.equal(가드('echo mv Code.js tests/safety.test.js', 'Bash', dir).조용, true,
    '인자 자리의 mv 를 명령으로 읽었다');
});

test('근거를 경우별로 갈라 적는다 — git 밖이면 「되돌릴 수단이 없다」', () => {
  /* F076 은 「막았다」만이 아니라 **틀린 근거를 읊었다**는 신고이기도 하다. 바탕화면 사본에
   * 대고 「python subprocess 가 중간에 죽었다」를 읽히면 다음부터 메시지를 안 읽고,
   * 그때부터 BYPASS 는 손버릇이 된다. 그래서 문구도 회귀로 못박는다. */
  const 밖 = 픽스처({ '있는것.js': 'const a = 1;' });               // 임시 폴더 위엔 `.git` 이 없다
  const r1 = 가드('cp 정본.js 있는것.js', 'Bash', 밖);
  assert.equal(r1.차단, true, 'git 밖 대상을 놓쳤다 — repo 밖이라고 봐주면 F067 이 그대로 샌다');
  assert.match(r1.사유, /되돌릴 수단이 없는/, 'git 밖인데 「되돌릴 수 있다」는 전제로 적혔다');

  const 안 = 픽스처({ '있는것.js': 'const a = 1;', '.git/HEAD': 'ref: refs/heads/master' });
  const r2 = 가드('cp 정본.js 있는것.js', 'Bash', 안);
  assert.equal(r2.차단, true, '저장소 안 대상을 놓쳤다');
  assert.match(r2.사유, /F065|4단계/, '되돌릴 수단이 있는 자리인데 근거가 안 바뀌었다');
  assert.doesNotMatch(r2.사유, /되돌릴 수단이 없는/, '저장소 안인데 「되돌릴 수 없다」로 적혔다');
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

/* ── 셸 변수 경로 (F088) ───────────────────────────────────────────────────
 * 실사고: `d=$(mktemp -d)` 로 뜬 임시 디렉터리의 `$d/src/x.js` 를 「코드 파일 덮어쓰기」로 막았다.
 *   변수를 못 푸는 fail-closed 자체는 옳지만, **훅이 준 처방을 따를 수가 없었다** —
 *   「임시 파일이면 스크래치패드로 옮겨라」인데 이미 스크래치패드였다. 이 세션에서도 한 번 더 났다.
 * 🔑 그래서 판정을 낮추지 않고 **모르는 것의 범위만 좁혔다.** 아래 두 묶음이 그 경계를 못박는다 —
 *   푼 것은 통과, 못 푼 것은 여전히 차단. 한쪽만 검사하면 「느슨해졌다」를 못 본다. */

test('같은 명령 안에서 선언된 변수는 풀어서 본다 — 임시 경로면 통과 (F088)', () => {
  for (const c of [
    'd=$(mktemp -d) && node tools/x.js > "$d/src/out.js"',
    'SP=/c/Users/q1212/AppData/Local/Temp/claude/x/scratchpad; git show HEAD:tests/a.test.js > "$SP/mirror/tests/a.test.js"',
    'export OUT="/tmp/probe"; echo x > ${OUT}/y.js',
    'd=$(mktemp -d); sed -i "s/a/b/" "$d/mut.js"',
    '$d = "C:/Users/q1212/AppData/Local/Temp/claude/w"; Set-Content "$d/a.js" -Value "x"',
  ]) {
    const tool = c.startsWith('$d =') ? 'PowerShell' : 'Bash';
    assert.equal(가드(c, tool).조용, true, `풀 수 있는 임시 변수 경로를 막았다: ${c}`);
  }
});

test('🔴 변수를 못 풀거나 값이 임시가 아니면 그대로 막는다 — 느슨해진 게 아니다 (F088)', () => {
  for (const [c, 왜] of [
    ['echo x > "$UNKNOWN_DIR/Code.js"', '선언이 없는 변수 — 값을 알 방법이 없으면 막는 게 계약이다'],
    ['echo x > "$HOME/proj/Code.js"', '바깥에서 온 환경변수도 이 명령 안엔 선언이 없다'],
    ['SP=docs; echo x > "$SP/index.html"', '선언은 있지만 값이 임시가 아니다'],
    ['d=/tmp; echo x > "$d/../Documents/SYNK-appsscript/Code.js"', '`..` 로 임시 밖을 가리킨다 — 정규화 없이 재면 통과로 샌다'],
    ['d=$(git rev-parse --show-toplevel); echo x > "$d/Code.js"', 'mktemp 아닌 명령치환은 값을 모른다'],
  ]) {
    assert.equal(가드(c).차단, true, `${왜}: ${c}`);
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
  const r = 훅띄우기(HOOK, { input: '이건 JSON이 아니다', encoding: 'utf8' });
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

/* ── 자기 처방 되먹임 (CLAUDE.md 가드 맹점 ③) ────────────────────────────────────
 * 「차단 사유가 시키는 명령을 그 가드에 되먹여 통과하는지 본다 — 따를 수 없는 처방은 우회를
 * 정상 통로로 만든다(F103).」 이 훅은 그 함정을 **이미 한 번 밟았고**(머리말 F088: 3번 처방이
 * 「스크래치패드로 옮겨라」인데 이미 스크래치패드였다), 2026-08-17 에 같은 자리에서 또 밟았다:
 * F591 트랙이 처방 3 을 따르려다 **세 번 연속** 막혔다 — ①상대 표기로 스크래치패드에서 돌렸고
 * ②경로를 node argv 로 조립했고 ③PowerShell 에서 `$env:CODE_EDIT_BYPASS='1'` 로 따옴표를 씌웠다.
 * ①③은 처방문이 말해주지 않던 것이라 문구에 넣었고, 여기서 그 약속이 지켜지는지 잰다.
 * ⚠ 실행은 하지 않는다 — 훅에 명령 문자열만 물리고 판정을 읽는다. */

test('처방 되먹임 ① — 스크래치패드 «절대경로» 쓰기는 통과한다(처방 3 이 실제로 통한다)', () => {
  /* ⚠ 두 갈래를 **따로** 잰다. 이 저장소의 실제 스크래치패드는 `AppData/Local/Temp/` 아래라
   * `temp` 규칙과 `scratchpad` 규칙이 **겹친다** — 겹친 자리만 검사하면 한쪽을 통째로 지워도
   * 초록이다(2026-08-17 변이로 실측한 구멍이다: `/scratchpad/` 를 죽였는데 36건 전부 통과했다). */
  const 실물 = 가드('node -e "require(\'fs\').writeFileSync(\'C:/Users/x/AppData/Local/Temp/claude/scratchpad/mut.js\',\'x\')"');
  assert.ok(!실물.차단,
    `처방대로 했는데 막혔다 — 따를 수 없는 처방은 BYPASS 를 손버릇으로 만들고, 그 손버릇은 진짜 덮어쓰기도 통과시킨다: ${실물.사유.slice(0, 200)}`);

  const temp밖 = 가드('node -e "require(\'fs\').writeFileSync(\'D:/work/scratchpad/mut.js\',\'x\')"');
  assert.ok(!temp밖.차단,
    `«scratchpad» 규칙 자체가 죽었다 — temp 아래가 아닌 스크래치패드를 못 본다: ${temp밖.사유.slice(0, 160)}`);
});

test('처방 되먹임 ② — 상대 표기는 막되, «왜 스크래치패드인데도 막았는지»를 말한다', () => {
  const r = 가드('node -e "require(\'fs\').writeFileSync(\'mut.js\',\'x\')"');
  assert.ok(r.차단,
    '상대 표기를 통과시켰다 — cwd 를 모르는 채 열어주면 temp 아래 저장소에서 가드가 통째로 꺼진다(훅 머리말의 그 자리)');
  assert.match(r.사유, /절대경로로 적어야 한다/,
    '막기만 하고 이유를 안 말한다 — 그 침묵이 F591 에서 같은 처방을 세 번 헛돌게 했다(맞는 얼굴로 다른 것을 가리킨다)');
});

test('처방 되먹임 ③ — 문서화된 BYPASS 표기가 **두 셸 모두**에서 실제로 통한다', () => {
  const bash = 가드('CODE_EDIT_BYPASS=1 node -e "require(\'fs\').writeFileSync(\'Code.js\',\'x\')"');
  assert.ok(!bash.차단, `bash 표기 우회가 안 통한다: ${bash.사유.slice(0, 160)}`);

  // 이 저장소의 주 셸은 PowerShell 이다(CLAUDE.md 「셸이 둘이다」) — 처방문이 한쪽만 알면 반쪽이다.
  const ps = 가드('$env:CODE_EDIT_BYPASS=1; node -e "require(\'fs\').writeFileSync(\'Code.js\',\'x\')"', 'PowerShell');
  assert.ok(!ps.차단, `PowerShell 표기 우회가 안 통한다 — 주 셸에서 못 쓰는 우회는 없는 우회다: ${ps.사유.slice(0, 160)}`);
});

/* ── 보드 정본 조각 — 등록층 구멍 (2026-08-18 실측 · `local_9a6c0547`) ──────────────
 * 🔴 무엇이 났나: 보드 선언을 `cat > docs/_ops/보드/<지문>.md <<EOF` 로 썼다. `board-guard` 는
 *   등록 매처가 `Edit|Write|MultiEdit` 라 **한 번도 안 돌았고**, 트랙 충돌·칸 상한·지문 검사가
 *   통째로 건너뛰어졌다. 그날 남과 **82초 차**로 같은 트랙(F616)을 선언해 둘 다 지었다.
 *   즉 새는 방향은 「통과」이고, 그 통과의 값은 **트랙 하나 전체**다.
 * 🔑 재는 축 = 「셸로 보드에 쓰면 막히는가」와 「도구·읽기는 그대로 통과하는가」를 **같은 무게로**.
 *   과잉 차단은 BYPASS 를 습관으로 가르치므로(이 파일 머리말) 통과 목록이 절반이다. */
test('🔑 보드 — 셸 쓰기 네 통로가 다 막힌다 (board-guard 가 안 도는 자리다)', () => {
  const 통로 = [
    ['힙독', 'cat > docs/_ops/보드/deadbeef.md <<EOF\n| x |\nEOF'],
    ['리다이렉트', 'echo hi > docs/_ops/보드/deadbeef.md'],
    ['인용된 경로', 'echo hi > "docs/_ops/보드/deadbeef.md"'],
    ['sed -i', 'sed -i s/a/b/ docs/_ops/보드/deadbeef.md'],
  ];
  for (const [이름, cmd] of 통로) {
    const r = 가드(cmd);
    assert.ok(r.차단, `${이름} 로 보드에 쓰는데 안 막혔다 — board-guard 가 통째로 건너뛰어진다`);
    assert.match(r.사유, /보드 정본 조각/, `${이름}: 차단문이 대상을 「코드 파일」이라 부른다 — 맞는 얼굴로 틀린 이름이다`);
    /* 처방이 갈려야 한다 — 「Edit 로 고쳐라」만 주면 **따라도 board-guard 는 여전히 안 돈다**(F103). */
    assert.match(r.사유, /`Write` 도구로 쓴다/, `${이름}: 보드 전용 처방이 없다 — 처방을 따라도 가드가 안 돈다`);
    assert.match(r.사유, /board-guard/, `${이름}: 무엇이 안 도는지를 안 말한다`);
  }
});

test('🔑 보드 — `cp`·`mv` 로 **이미 있는** 보드 조각을 덮는 것도 막는다 (토큰 판정 갈래)', () => {
  /* 🔴 이 갈래는 위 시험이 원리상 못 본다 — 리다이렉트·`sed -i` 는 «문자열 스캔»(`코드경로들`)이
   *   잡고, `cp`·`mv` 는 인자 자리로 뜻이 갈려 «토큰 판정»(`코드대상인가`)이 잡는다. 통로가 둘이라
   *   한쪽만 넓히면 나머지가 조용히 샌다(2026-08-18 변이가 첫 판을 구멍으로 잡았다).
   * ⚠ 대상이 **실제로 있을 때만** 막는다(F076) — 그래서 실재하는 보드 조각을 과녁으로 쓴다. */
  const 실재 = 'docs/_ops/보드/9a6c0547.md';
  assert.ok(fs.existsSync(path.join(저장소, 실재)), `픽스처 전제가 깨졌다 — ${실재} 가 없다(그러면 이 검사는 아무것도 안 잰다)`);
  const r = 가드(`cp /tmp/어떤파일.md ${실재}`);
  assert.ok(r.차단, '`cp` 로 남의 보드 조각을 덮는데 안 막혔다 — 그 한 수로 남의 선언이 사라진다');
  assert.match(r.사유, /보드 정본 조각/, '차단문이 대상을 「코드 파일」이라 부른다');

  /* 통과 쪽도 같은 무게로 — rename·새 이름 만들기는 F076 이 막지 말라고 못박은 자리다. */
  const 새이름 = 가드(`mv ${실재} docs/_ops/보드/아직없는지문.md`);
  assert.ok(!새이름.차단, `없는 이름으로 옮기는 것을 막았다 — 따를 수 없는 처방이 된다(F076): ${새이름.사유.slice(0, 160)}`);
});

test('🔑 보드 — 읽기·도구·다른 md·스크래치패드는 그대로 통과한다 (거짓양성이 BYPASS 를 가르친다)', () => {
  const 통과 = [
    ['읽기', 'cat docs/_ops/보드/9a6c0547.md'],
    /* 🔑 이 훅이 권하는 **반대편 정답** — 도구는 노드에서 쓰므로 셸 파서의 눈에 안 보이고, 그게 옳다.
     *   막으면 완료 줄 이관(`board-move`)이라는 정상 통로가 통째로 끊긴다. */
    ['board-move 도구', 'node tools/board-move.js "어떤 문구"'],
    ['보드수거 도구', 'node tools/보드수거.js --실행'],
    /* 과녁은 **보드 조각**뿐이다 — 장부·인계문 같은 다른 .md 까지 막으면 이 훅이 통째로 넓어진다. */
    ['다른 md(장부)', 'echo hi > docs/_ops/장부/F999.md'],
    ['스크래치패드', 'echo hi > /tmp/x/scratchpad/docs/_ops/보드/z.md'],
  ];
  for (const [이름, cmd] of 통과) {
    const r = 가드(cmd);
    assert.ok(!r.차단, `${이름} 를 막았다 — 거짓양성은 BYPASS 를 손버릇으로 만든다: ${r.사유.slice(0, 200)}`);
  }
});

test('처방 되먹임 ④ — 처방문이 두 셸의 표기를 **둘 다** 적고 있다', () => {
  const r = 가드('node -e "require(\'fs\').writeFileSync(\'Code.js\',\'x\')"');
  assert.ok(r.차단, '검사 전제가 깨졌다 — 이 명령은 막혀야 처방문이 나온다');
  assert.match(r.사유, /CODE_EDIT_BYPASS=1/, '우회 표기를 안 알려준다');
  assert.match(r.사유, /\$env:CODE_EDIT_BYPASS/,
    'PowerShell 표기가 빠졌다 — 주 셸 사용자에겐 처방이 없는 것과 같다(F591 에서 실제로 헛돌았다)');
});
