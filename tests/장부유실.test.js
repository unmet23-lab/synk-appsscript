/* 장부 행 유실 — 「이력에 올라왔던 F 번호가 지금 장부에 없다」를 잰다.
 *
 * 왜 따로 있나 (tests/마찰신호.test.js 와 겹치지 않는다):
 *   저기는 **쓰기 통로**만 본다 — add·resolve·채번이 옳게 도는가. 그런데 F195 는 쓰기가 아니라
 *   **반입**이 append-only 장부를 통째로 덮어 F189·F192·F193·F194 가 조용히 증발한 사고였다.
 *   덮어쓴 쪽은 add 를 부르지도 않으니 저 회귀 전부가 초록인 채로 행이 사라진다.
 *
 * 08-07 실측(이 검사가 태어난 이유): 그렇게 사라진 **F123** 이 폰 브랜치에만 남은 채 떠 있었다.
 *   장부 번호가 F001~F200 인데 행은 198개 — 아무도 그 둘을 대조하지 않았다. 손으로 짜서야 났다.
 *
 * 「번호 중복」(F041·F201 채번 락)과 축이 다르다: 저기는 **같은 번호 둘**, 여기는
 *   **발급된 번호의 행이 없어진 것**. 통로도 다르다(채번 vs 파일 덮어쓰기).
 *
 * ⚠ 이 검사의 유일한 사인방식은 정규식이 실제 표기를 놓치는 것이다 — 그러면 「사라짐 0」이
 *   나오는데 그건 통과가 아니라 미측정이다. 그래서 종수 하한을 같이 단언한다.
 *
 * F215(08-07) — **뒤처짐을 유실로 오진했다.** 이력은 `--all`(모든 ref)에서 모으는데 현재는
 *   체크아웃된 파일 하나다. 스코프가 다르니 남이 밀어둔 행이 내 작업본에 아직 안 왔을 때
 *   두 상태가 같은 모양이 된다. 실측: F206 이 origin 에 멀쩡한데 로컬이 뒤처져 「유실」로 떴고,
 *   그 처방(행 복원 커밋 `2214740`)을 따르는 순간 장부가 오염된다 — 거짓적색인데 위험은 쓰기 쪽.
 *   가르는 재료 = **다른 ref 의 지금 장부**. 거기 살아 있으면 사라진 게 아니라 내가 뒤처진 것이다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 장부 = 'docs/_ops/마찰신호.md';
const REPO = path.resolve(__dirname, '..');

const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, '-c', 'core.quotepath=false', ...a],
  { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });

/* 이력에 한 번이라도 올라왔던 번호 — diff 의 추가줄에서 모은다.
 * 커밋마다 `git show` 를 돌리는 방식은 실 저장소에서 5분을 넘겼다(08-07 실측). */
const 이력번호 = (cwd) =>
  new Set([...git(cwd, 'log', '--all', '-p', '--format=', '--', 장부).matchAll(/^\+\|\s*(F\d{3})\s*\|/gm)].map((m) => m[1]));

/* 현재 = **작업본 파일**이지 HEAD 가 아니다. HEAD 를 보면 처방("그 줄을 되돌려 넣어라")을
 * 따라도 커밋 전까지 계속 빨간 채라, 따를 수 없는 처방이 된다(F103). 08-07 실측으로 잡았다. */
const 번호 = (본문) => new Set([...본문.matchAll(/^\|\s*(F\d{3})\s*\|/gm)].map((m) => m[1]));

const 현재번호 = (cwd) => 번호(fs.readFileSync(path.join(cwd, 장부), 'utf8'));

/* **상류의 지금 장부** — 「사라졌다」와 「아직 안 왔다」를 가르는 유일한 재료(F215).
 * 모든 ref 가 아니라 상류 하나다: 갈라진 가지(폰 브랜치)에만 남은 것은 뒤처짐이 아니라
 * 진짜 유실이었다(F123·08-07). 상류가 없거나 그 판이 없으면 빈 판 = 전부 유실로 남긴다.
 * 후보가 있을 때만 부른다 — 평시 비용 0. */
function 상류번호(cwd) {
  try {
    const up = git(cwd, 'rev-parse', '--abbrev-ref', '@{upstream}').trim();
    return 번호(git(cwd, 'show', `${up}:${장부}`));
  } catch { return new Set(); }
}

/* 유실 = 상류에도 없다(진짜 사라짐) · 뒤처짐 = 상류엔 있는데 내 작업본에만 없다 */
function 유실(cwd) {
  const 현재 = 현재번호(cwd);
  const 후보 = [...이력번호(cwd)].filter((f) => !현재.has(f)).sort();
  if (!후보.length) return { 유실: [], 뒤처짐: [] };
  const 상류 = 상류번호(cwd);
  return { 유실: 후보.filter((f) => !상류.has(f)), 뒤처짐: 후보.filter((f) => 상류.has(f)) };
}

/* ── 픽스처 — 탐지력은 여기가 진다(실 저장소는 거짓양성만 검사한다) ── */
const 행 = (n) => `| F${String(n).padStart(3, '0')} | 2026-08-07 | 실수 | 내용 ${n} | |`;
const 판 = (ns) => '| ID | 날짜 | 종류 | 내용 | 해소 |\n|---|---|---|---|---|\n' + ns.map(행).join('\n') + '\n';

function 픽스처(판들) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '장부유실-'));
  git(d, 'init', '-q');
  fs.mkdirSync(path.join(d, path.dirname(장부)), { recursive: true });
  for (const p of 판들) {
    fs.writeFileSync(path.join(d, 장부), p);
    git(d, 'add', '--', 장부);
    /* CI 는 빈 HOME 으로 돈다 — 신원을 안 주면 commit 이 죽어 검사가 통째로 미실행이 된다 */
    git(d, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', '판');
  }
  return d;
}

test('🔑 탐지 — 이력에 있던 행이 사라지면 잡는다 (F195 가 정확히 이 모양이었다)', () => {
  const d = 픽스처([판([1, 2, 3]), 판([1, 3])]);
  assert.deepStrictEqual(유실(d), { 유실: ['F002'], 뒤처짐: [] });
  fs.rmSync(d, { recursive: true, force: true });
});

test('🔑 탐지 — 통째로 덮어써도 잡는다 (반입이 낸 실제 모양: 여러 행이 한 번에 증발)', () => {
  const d = 픽스처([판([1, 2, 3, 4]), 판([1])]);
  assert.deepStrictEqual(유실(d), { 유실: ['F002', 'F003', 'F004'], 뒤처짐: [] });
  fs.rmSync(d, { recursive: true, force: true });
});

test('거짓양성 — 행이 늘기만 하면 유실 0 (append-only 의 정상 동작을 막으면 안 된다)', () => {
  const d = 픽스처([판([1, 2]), 판([1, 2, 3])]);
  assert.deepStrictEqual(유실(d), { 유실: [], 뒤처짐: [] });
  fs.rmSync(d, { recursive: true, force: true });
});

/* 🔑 F215 — 거짓적색 쪽 탐지. 이 형태가 「유실」로 나오면 그 처방(행 복원 커밋)이 장부를 오염시킨다 */
test('🔑 거짓양성 — 상류엔 있고 내 작업본에만 없으면 유실이 아니라 뒤처짐이다 (F215)', () => {
  const d = 픽스처([판([1, 2]), 판([1, 2, 3])]);
  git(d, 'remote', 'add', 'origin', '.');   // 상류 config 가 없으면 set-upstream-to 가 죽는다
  git(d, 'update-ref', 'refs/remotes/origin/master', 'HEAD');          // 상류 = F003 이 있는 판
  git(d, 'branch', '--set-upstream-to=origin/master');
  git(d, 'reset', '--hard', '-q', 'HEAD~1');                            // 내 작업본만 한 커밋 뒤처진다
  assert.deepStrictEqual(유실(d), { 유실: [], 뒤처짐: ['F003'] });
  fs.rmSync(d, { recursive: true, force: true });
});

/* 상류가 아니라 **갈라진 가지**에만 남은 것은 뒤처짐이 아니다 — F123 이 폰 브랜치에만 있던 실제 모양 */
test('🔑 탐지 — 갈라진 가지에만 남은 행은 그대로 유실이다 (F123)', () => {
  const d = 픽스처([판([1, 2]), 판([1, 2, 3])]);
  git(d, 'remote', 'add', 'origin', '.');   // 상류 config 가 없으면 set-upstream-to 가 죽는다
  git(d, 'update-ref', 'refs/remotes/origin/claude/phone', 'HEAD');    // 갈라진 가지에만 F003 이 산다
  git(d, 'update-ref', 'refs/remotes/origin/master', 'HEAD~1');        // 상류엔 없다
  git(d, 'branch', '--set-upstream-to=origin/master');
  git(d, 'reset', '--hard', '-q', 'HEAD~1');
  assert.deepStrictEqual(유실(d), { 유실: ['F003'], 뒤처짐: [] });
  fs.rmSync(d, { recursive: true, force: true });
});

test('🔴 실 저장소 — 이력에 올라왔던 행이 지금도 전부 있다', () => {
  const 현재 = 현재번호(REPO);
  const 이력 = 이력번호(REPO);
  /* 미측정 방어 — 정규식이 실제 표기를 놓치면 위 세 줄이 전부 「사라짐 0」으로 초록이 된다 */
  assert.ok(현재.size > 100, `현재 장부에서 ${현재.size}종만 읽혔다 — 정규식이 실제 표기를 못 잡았다(미측정은 통과가 아니다)`);
  /* 이력 >= 현재 로는 못 쓴다 — 새 행을 막 추가한 작업본은 **정상적으로** 현재가 더 많다(add 때마다 빨개진다) */
  assert.ok(이력.size > 100, `이력에서 ${이력.size}종만 읽혔다 — diff 를 못 읽고 있다(경로가 바뀌었으면 --follow 가 필요하다)`);

  const { 유실: 사라짐, 뒤처짐 } = 유실(REPO);
  /* 뒤처짐은 결함이 아니라 내 체크아웃 상태다 — 소리는 내되 빨갛게 하지 않는다(F215: 거짓적색의 처방이 오염이었다) */
  if (뒤처짐.length) console.log(`  ⚠ 상류엔 있는데 내 작업본엔 없는 행 ${뒤처짐.length}건 — 유실이 아니라 **뒤처짐**이다: ${뒤처짐.join(' ')}\n    → 복원 커밋 금지. \`git pull --rebase\` 로 따라잡는다.`);

  assert.deepStrictEqual(사라짐, [],
    '장부에서 행이 사라졌다(상류에도 없다). 되살리는 법 — 그 번호가 살아있는 판을 찾아 그 줄만 지금 장부에 되돌려 넣는다:\n'
    + `  git log --all -S "| F123 |" --oneline -- ${장부}\n`
    + `  git show <그 커밋>:${장부} | grep "^| F123 |"\n`
    + '(번호는 위 목록의 것으로 바꾼다. 폰 브랜치에만 남아 있는 경우가 실제로 있었다 — F123·08-07)');
});
