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
 *
 * ── F469(08-15) · F215 의 워크트리판 — 같은 오진이 「상류 하나만 본다」로 되돌아왔다 ──
 *   F215 의 처방은 가르는 재료를 **`@{upstream}` 하나**로 잡았다. 그런데 Claude Code 워크트리
 *   가지엔 상류가 안 걸린다 → 빈 판 = **후보 전부가 유실**. 워크트리가 6개씩 도는 지금은 누가
 *   장부에 행 하나를 더할 때마다 나머지 전부의 test-ci 가 빨개진다(주인 없는 적색 양산기).
 *   실측 08-15: master `7785ce3c`(F467) · 남의 산 워크트리 `c51a52db`(F468) 둘 다 이 모양이었다.
 *
 *   그래서 재료를 **세 갈래**로 넓혔다 — 상류 · 기본 가지(master/main·origin) · **지금 체크아웃된
 *   워크트리들의 HEAD**. 「가지」가 아니라 「워크트리」를 세는 이유는 F403 그대로다: 미병합 가지
 *   셋 중 둘은 낡은 사본이었고, 워크트리인 것만 산 작업이었다.
 *   ⚠ F123 원칙은 그대로다 — **죽은 가지에만 남은 행은 여전히 유실**이다. 회귀 두 벌로 못박았다:
 *     워크트리가 살아 있을 땐 뒤처짐, `worktree remove` 뒤엔 같은 상태가 다시 유실.
 *   ⚠ 넓히기가 F195 탐지를 삼키지 않게 **가르는 축을 하나 더 뒀다**: 후보가 **내 가지 이력**
 *     (`git log HEAD`)에 있었으면 남이 들고 있어도 유실이다 — 그건 「아직 안 온 것」이 아니라
 *     내가 지운 것이다. 이 축이 없으면 master 가 한 칸만 앞서도 반입이 덮어쓴 행 전부가
 *     「뒤처짐」으로 초록이 된다.
 *
 *   〖틀릴 때의 모습〗 — 맹점 ④. 장치는 안 도는 쪽보다 **맞는 얼굴로 틀린 값을 내는 쪽**으로 샌다.
 *     ① 앞선 판이 들고 있는 행은 빨간불이 아니라 **콘솔 한 줄**로 내려앉는다. 워크트리가 여럿
 *        도는 동안 이 줄은 상시로 울리니, 진짜가 섞여도 안 읽힌다 — 그래서 **어느 판이 들고
 *        있는지를 줄마다 이름으로 찍는다**(무명 경고는 배경 소음이 된다 · 작업본소유자.js 와 같은 판단).
 *     ② `git worktree list`·`merge-base` 가 죽으면 후보를 **전부 「살아 있다」로 읽는다** —
 *        새는 방향이 초록이다. 그래서 종수 하한(현재·이력 > 100)을 같이 단언해 미측정을 드러낸다.
 *     ③ 내 가지에서 지운 것을 **rebase 로 이력에서까지 지우면** 내 가지 이력 축이 못 본다.
 *   〖닫은 것 1개〗 `상류번호()` — 「상류 하나 · 없으면 빈 판」 전제를 통째로 지웠다. 폴백으로도
 *     안 남긴다(남기면 같은 거짓적색이 그 갈래로 다시 난다).
 *   〖안 닫는 것과 근거〗 `tools/작업본소유자.js` 의 `워크트리갇힘` 은 그대로 둔다 — 축이 다르다
 *     (여기는 「부서졌나」, 저기는 「갇혔나」). 이 넓히기가 만든 꼬리 위험(워크트리에만 있는 행이
 *     조용히 오래 남는 것)을 지금 지고 있는 장치가 저것이라, 같이 닫으면 그 자리가 빈다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 장부 = 'docs/_ops/마찰신호.md';
const 조각폴더 = 'docs/_ops/장부';   // 행은 이제 여기 F0NN.md 조각으로 산다(F250 후반) — .md 는 동결 아카이브
const REPO = path.resolve(__dirname, '..');

const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, '-c', 'core.quotepath=false', ...a],
  { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });

/* 이력에 한 번이라도 올라왔던 번호 — diff 의 추가줄에서 모은다.
 * 커밋마다 `git show` 를 돌리는 방식은 실 저장소에서 5분을 넘겼다(08-07 실측).
 * 범위를 인자로 받는 이유는 F469: `--all`(누구든 올린 적 있나)과 `HEAD`(**내 가지**에 있었나)를
 * 같은 정규식으로 재야 두 답이 갈리지 않는다. */
const 이력번호 = (cwd, 범위 = '--all') =>
  new Set([...git(cwd, 'log', 범위, '-p', '--format=', '--', 장부, 조각폴더).matchAll(/^\+\|\s*(F\d{3})\s*\|/gm)].map((m) => m[1]));

/* 현재 = **작업본 파일**이지 HEAD 가 아니다. HEAD 를 보면 처방("그 줄을 되돌려 넣어라")을
 * 따라도 커밋 전까지 계속 빨간 채라, 따를 수 없는 처방이 된다(F103). 08-07 실측으로 잡았다. */
const 번호 = (본문) => new Set([...본문.matchAll(/^\|\s*(F\d{3})\s*\|/gm)].map((m) => m[1]));

const 현재번호 = (cwd) => {
  const s = 번호(fs.readFileSync(path.join(cwd, 장부), 'utf8'));
  let 이름들 = [];
  try { 이름들 = fs.readdirSync(path.join(cwd, 조각폴더)); } catch { /* 조각 0 */ }
  for (const n of 이름들) { const m = /^(F\d{3})\.md$/.exec(n); if (m) s.add(m[1]); }
  return s;
};

/* ── 「살아 있는 판」 후보 (F215 → F469) ─────────────────────────────────────────
 * 여기 실린 ref 만이 「사라진 게 아니라 아직 안 온 것」의 증거가 된다. 이 목록이 곧 경계선이라
 * 넓힐 때마다 F123(죽은 가지에만 남은 것은 유실)이 얼마나 남는지가 정해진다.
 * 후보가 있을 때만 부른다 — 평시 비용 0. */
function 살아있는후보(cwd) {
  const 후보 = [];
  const 밀기 = (ref, 이름) => { if (ref) 후보.push({ ref, 이름 }); };

  // ① 상류 — 걸려 있으면 가장 강한 신호다(F215 가 유일하게 봤던 갈래)
  try { const up = git(cwd, 'rev-parse', '--abbrev-ref', '@{upstream}').trim(); 밀기(up, `상류 ${up}`); } catch { /* 상류 없음 */ }

  // ② 기본 가지 — 워크트리 가지엔 상류가 안 걸린다. F469 의 빈칸이 정확히 여기였다.
  try { const h = git(cwd, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD').trim(); 밀기(h, `기본가지 ${h}`); } catch { /* origin/HEAD 미설정 */ }
  for (const b of ['master', 'main']) {
    for (const r of [`refs/heads/${b}`, `refs/remotes/origin/${b}`]) {
      try { git(cwd, 'rev-parse', '--verify', '--quiet', r); 밀기(r, `기본가지 ${r.replace(/^refs\/(heads|remotes)\//, '')}`); } catch { /* 그 가지 없음 */ }
    }
  }

  // ③ 지금 체크아웃돼 있는 워크트리들의 HEAD — 「가지」가 아니라 **워크트리**를 센다(F403).
  //    미병합 가지는 낡은 사본이 섞이지만, 워크트리에 걸려 있다는 것은 산 세션이 들고 있다는 뜻이다.
  //    HEAD sha 로 잡으면 detached 워크트리도 그대로 들어온다.
  try {
    for (const 줄 of git(cwd, 'worktree', 'list', '--porcelain').split(/\r?\n/)) {
      if (줄.startsWith('HEAD ')) { const sha = 줄.slice(5).trim(); 밀기(sha, `워크트리 ${sha.slice(0, 8)}`); }
      else if (줄.startsWith('branch ') && 후보.length) {
        후보[후보.length - 1].이름 = `워크트리 ${줄.slice(7).trim().replace(/^refs\/heads\//, '')}`;
      }
    }
  } catch { /* 워크트리를 못 셌다 — 0건이라는 뜻이 아니다(F403). 위 〖틀릴 때의 모습〗② */ }
  return 후보;
}

/* 후보 번호 → 그걸 들고 있는 판 이름. **내 HEAD 가 이미 담고 있는 판은 재료가 아니다** —
 * 거기 있는 것은 「안 온 것」이 아니라 내가 지운 것이다. 이 한 줄이 내 워크트리를 목록에서
 * 빼는 일까지 대신한다(경로 비교는 Windows 대소문자·단축경로에서 샌다). */
function 앞선판번호(cwd, 후보번호) {
  const 어디 = new Map();
  const 본sha = new Set();
  for (const { ref, 이름 } of 살아있는후보(cwd)) {
    if (어디.size >= 후보번호.length) break;              // 전부 설명됐다 — 더 안 부른다
    let sha;
    try { sha = git(cwd, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`).trim(); } catch { continue; }
    if (!sha || 본sha.has(sha)) continue;
    본sha.add(sha);
    try { git(cwd, 'merge-base', '--is-ancestor', sha, 'HEAD'); continue; } catch { /* 앞서 있다 = 재료다 */ }

    const 있는것 = new Set();
    try { for (const n of 번호(git(cwd, 'show', `${sha}:${장부}`))) 있는것.add(n); } catch { /* 그 판엔 아카이브가 없다 */ }
    try {   // 조각의 번호는 파일 이름이 든다 — 그 트리의 이름만 훑는다
      for (const m of git(cwd, 'ls-tree', '-r', '--name-only', sha, '--', 조각폴더)
        .matchAll(/(?:^|\/)(F\d{3})\.md$/gm)) 있는것.add(m[1]);
    } catch { /* 조각 폴더가 아직 없다 */ }

    for (const f of 후보번호) if (!어디.has(f) && 있는것.has(f)) 어디.set(f, 이름);
  }
  return 어디;
}

/* 유실 = 내가 지웠거나 앞선 판 어디에도 없다 · 뒤처짐 = 내 가지엔 온 적 없고 앞선 판이 들고 있다 */
function 유실(cwd) {
  const 현재 = 현재번호(cwd);
  const 후보 = [...이력번호(cwd)].filter((f) => !현재.has(f)).sort();
  if (!후보.length) return { 유실: [], 뒤처짐: [], 어디: new Map() };

  /* 🔑 내 가지 이력에 있던 것이 지금 없다 = **내가 지웠다**. 남이 들고 있어도 유실이다(F469).
   *   이 갈래가 없으면 master 가 한 칸만 앞서도 F195(반입 덮어쓰기)가 통째로 초록이 된다. */
  const 내이력 = 이력번호(cwd, 'HEAD');
  const 내가지움 = 후보.filter((f) => 내이력.has(f));
  const 안온것 = 후보.filter((f) => !내이력.has(f));

  const 어디 = 안온것.length ? 앞선판번호(cwd, 안온것) : new Map();
  return {
    유실: [...내가지움, ...안온것.filter((f) => !어디.has(f))].sort(),
    뒤처짐: 안온것.filter((f) => 어디.has(f)),
    어디,
  };
}

/* 픽스처 단언용 — `어디`(누가 들고 있나)는 실 저장소 메시지 전용이라 뺀다 */
const 판정 = (cwd) => { const r = 유실(cwd); return { 유실: r.유실, 뒤처짐: r.뒤처짐 }; };

/* ── 픽스처 — 탐지력은 여기가 진다(실 저장소는 거짓양성만 검사한다) ── */
const 행 = (n) => `| F${String(n).padStart(3, '0')} | 2026-08-07 | 실수 | 내용 ${n} | |`;
const 판 = (ns) => '| ID | 날짜 | 종류 | 내용 | 해소 |\n|---|---|---|---|---|\n' + ns.map(행).join('\n') + '\n';

/* CI 는 빈 HOME 으로 돈다 — 신원을 안 주면 commit 이 죽어 검사가 통째로 미실행이 된다 */
const 커밋 = (d, m) => git(d, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', m);
const 판커밋 = (d, ns, m = '판') => {
  fs.writeFileSync(path.join(d, 장부), 판(ns));
  git(d, 'add', '--', 장부);
  커밋(d, m);
};

function 픽스처(판들) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '장부유실-'));
  git(d, 'init', '-q');
  fs.mkdirSync(path.join(d, path.dirname(장부)), { recursive: true });
  for (const p of 판들) {
    fs.writeFileSync(path.join(d, 장부), p);
    git(d, 'add', '--', 장부);
    커밋(d, '판');
  }
  /* 가지 이름을 못박는다 — `init.defaultBranch` 가 main 인 기계에서 「기본 가지」 갈래가
   * 조용히 다른 것을 재면 아래 F469 회귀가 통과의 얼굴로 미측정이 된다 */
  git(d, 'branch', '-M', 'master');
  return d;
}

const 치우기 = (...ds) => { for (const d of ds) fs.rmSync(d, { recursive: true, force: true, maxRetries: 3 }); };

test('🔑 탐지 — 이력에 있던 행이 사라지면 잡는다 (F195 가 정확히 이 모양이었다)', () => {
  const d = 픽스처([판([1, 2, 3]), 판([1, 3])]);
  assert.deepStrictEqual(판정(d), { 유실: ['F002'], 뒤처짐: [] });
  치우기(d);
});

test('🔑 탐지 — 통째로 덮어써도 잡는다 (반입이 낸 실제 모양: 여러 행이 한 번에 증발)', () => {
  const d = 픽스처([판([1, 2, 3, 4]), 판([1])]);
  assert.deepStrictEqual(판정(d), { 유실: ['F002', 'F003', 'F004'], 뒤처짐: [] });
  치우기(d);
});

/* 행이 .md 밖(조각 폴더)으로 이사한 뒤의 유실 통로 — 아카이브만 재면 F251+ 는 영원히 미측정이다 */
test('🔑 탐지 — 조각 폴더의 행이 사라져도 잡는다 (조각 시대의 반입·삭제 사고)', () => {
  const d = 픽스처([판([1, 2])]);
  const dir = path.join(d, 조각폴더);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'F003.md'), 행(3) + '\n');
  git(d, 'add', '--', 조각폴더); 커밋(d, '조각 F003');
  fs.rmSync(path.join(dir, 'F003.md'));
  git(d, 'add', '--', 조각폴더); 커밋(d, '조각 삭제');
  assert.deepStrictEqual(판정(d), { 유실: ['F003'], 뒤처짐: [] });
  치우기(d);
});

test('거짓양성 — 조각으로 산 행은 유실이 아니다 (아카이브에 없는 것이 정상이다)', () => {
  const d = 픽스처([판([1, 2])]);
  const dir = path.join(d, 조각폴더);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'F003.md'), 행(3) + '\n');
  git(d, 'add', '--', 조각폴더); 커밋(d, '조각 F003');
  assert.deepStrictEqual(판정(d), { 유실: [], 뒤처짐: [] });
  치우기(d);
});

test('거짓양성 — 행이 늘기만 하면 유실 0 (append-only 의 정상 동작을 막으면 안 된다)', () => {
  const d = 픽스처([판([1, 2]), 판([1, 2, 3])]);
  assert.deepStrictEqual(판정(d), { 유실: [], 뒤처짐: [] });
  치우기(d);
});

/* 🔑 F215 — 거짓적색 쪽 탐지. 이 형태가 「유실」로 나오면 그 처방(행 복원 커밋)이 장부를 오염시킨다 */
test('🔑 거짓양성 — 상류엔 있고 내 작업본에만 없으면 유실이 아니라 뒤처짐이다 (F215)', () => {
  const d = 픽스처([판([1, 2]), 판([1, 2, 3])]);
  git(d, 'remote', 'add', 'origin', '.');   // 상류 config 가 없으면 set-upstream-to 가 죽는다
  git(d, 'update-ref', 'refs/remotes/origin/master', 'HEAD');          // 상류 = F003 이 있는 판
  git(d, 'branch', '--set-upstream-to=origin/master');
  git(d, 'reset', '--hard', '-q', 'HEAD~1');                            // 내 작업본만 한 커밋 뒤처진다
  assert.deepStrictEqual(판정(d), { 유실: [], 뒤처짐: ['F003'] });
  치우기(d);
});

/* 상류가 아니라 **갈라진 가지**에만 남은 것은 뒤처짐이 아니다 — F123 이 폰 브랜치에만 있던 실제 모양 */
test('🔑 탐지 — 갈라진 가지에만 남은 행은 그대로 유실이다 (F123)', () => {
  const d = 픽스처([판([1, 2]), 판([1, 2, 3])]);
  git(d, 'remote', 'add', 'origin', '.');   // 상류 config 가 없으면 set-upstream-to 가 죽는다
  git(d, 'update-ref', 'refs/remotes/origin/claude/phone', 'HEAD');    // 갈라진 가지에만 F003 이 산다
  git(d, 'update-ref', 'refs/remotes/origin/master', 'HEAD~1');        // 상류엔 없다
  git(d, 'branch', '--set-upstream-to=origin/master');
  git(d, 'reset', '--hard', '-q', 'HEAD~1');
  assert.deepStrictEqual(판정(d), { 유실: ['F003'], 뒤처짐: [] });
  치우기(d);
});

/* ── F469 회귀 ─ 상류가 없는 가지(= Claude Code 워크트리 가지)에서의 네 갈래 ──────────────
 * 실측 08-15: 이 넷을 안 가르면 남이 장부에 행 하나를 더할 때마다 나머지 워크트리 전부가 빨개졌다. */

test('🔑 거짓양성 — 상류가 없어도 기본 가지(master)에 살아 있으면 뒤처짐이다 (F469 · master 가 F467 을 더한 모양)', () => {
  const d = 픽스처([판([1, 2])]);
  git(d, 'checkout', '-q', '-b', 'claude/wt');   // 워크트리 가지 — 상류가 안 걸린다
  git(d, 'checkout', '-q', 'master');
  판커밋(d, [1, 2, 3], 'master 가 F003 을 더한다');
  git(d, 'checkout', '-q', 'claude/wt');
  assert.deepStrictEqual(판정(d), { 유실: [], 뒤처짐: ['F003'] });
  치우기(d);
});

test('🔑 탐지 — 상류가 없고 기본 가지에도 없으면 그대로 유실이다 (F123 원칙이 F469 뒤에도 산다)', () => {
  const d = 픽스처([판([1, 2])]);
  git(d, 'checkout', '-q', '-b', 'claude/dead');
  판커밋(d, [1, 2, 3], '죽은 가지에만 F003 이 산다');
  git(d, 'checkout', '-q', '-b', 'claude/wt', 'master');
  assert.deepStrictEqual(판정(d), { 유실: ['F003'], 뒤처짐: [] });
  치우기(d);
});

/* 🔑 실제로 이 워크트리를 빨갛게 만든 모양 — F468 이 남의 산 워크트리에만 있었다(08-15) */
test('🔑 거짓양성 — 남의 산 워크트리가 들고 있으면 뒤처짐이다 (F469 · F468 의 실제 모양)', () => {
  const d = 픽스처([판([1, 2])]);
  const wt = d + '-wt';
  git(d, 'checkout', '-q', '-b', 'claude/wt');
  git(d, 'worktree', 'add', '-q', '-b', 'claude/sibling', wt, 'master');
  판커밋(wt, [1, 2, 3], '남의 세션이 F003 을 더한다');
  assert.deepStrictEqual(판정(d), { 유실: [], 뒤처짐: ['F003'] });
  치우기(wt, d);
});

/* 🔑 넓힌 경계가 실제로 경계인지 — 워크트리를 지우면 같은 상태가 다시 유실이어야 한다.
 * 이게 없으면 위 회귀는 「전부 뒤처짐이라 답해도」 통과한다(맹점 ②: 탐지력 없는 초록). */
test('🔑 탐지 — 워크트리를 지우면 그 가지에만 남은 행은 다시 유실이다 (F469 경계)', () => {
  const d = 픽스처([판([1, 2])]);
  const wt = d + '-wt';
  git(d, 'checkout', '-q', '-b', 'claude/wt');
  git(d, 'worktree', 'add', '-q', '-b', 'claude/sibling', wt, 'master');
  판커밋(wt, [1, 2, 3], '남의 세션이 F003 을 더한다');
  git(d, 'worktree', 'remove', '--force', wt);   // 가지 `claude/sibling` 은 그대로 남는다
  assert.deepStrictEqual(판정(d), { 유실: ['F003'], 뒤처짐: [] });
  치우기(wt, d);
});

/* 🔑 넓히기가 F195 를 삼키지 않는지 — 앞선 판이 그 행을 들고 있어도, **내 가지 이력에 있던** 것이
 * 지금 없으면 유실이다. 한 픽스처가 양방향을 동시에 못박는다(내가 지운 F002 = 적색 / 아직 안 온 F003 = 뒤처짐). */
test('🔑 탐지 — 앞선 판이 들고 있어도 내가 지운 행은 유실이다 (F469 가 F195 를 안 삼키는지)', () => {
  const d = 픽스처([판([1, 2])]);
  git(d, 'checkout', '-q', '-b', 'claude/wt');
  git(d, 'checkout', '-q', 'master');
  판커밋(d, [1, 2, 3], 'master 가 앞서 나간다');
  git(d, 'checkout', '-q', 'claude/wt');
  fs.writeFileSync(path.join(d, 장부), 판([1]));   // 반입이 통째로 덮어써 F002 가 증발한다
  assert.deepStrictEqual(판정(d), { 유실: ['F002'], 뒤처짐: ['F003'] });
  치우기(d);
});

test('🔴 실 저장소 — 이력에 올라왔던 행이 지금도 전부 있다', () => {
  const 현재 = 현재번호(REPO);
  const 이력 = 이력번호(REPO);
  /* 미측정 방어 — 정규식이 실제 표기를 놓치면 위 세 줄이 전부 「사라짐 0」으로 초록이 된다 */
  assert.ok(현재.size > 100, `현재 장부에서 ${현재.size}종만 읽혔다 — 정규식이 실제 표기를 못 잡았다(미측정은 통과가 아니다)`);
  /* 이력 >= 현재 로는 못 쓴다 — 새 행을 막 추가한 작업본은 **정상적으로** 현재가 더 많다(add 때마다 빨개진다) */
  assert.ok(이력.size > 100, `이력에서 ${이력.size}종만 읽혔다 — diff 를 못 읽고 있다(경로가 바뀌었으면 --follow 가 필요하다)`);

  const { 유실: 사라짐, 뒤처짐, 어디 } = 유실(REPO);
  /* 뒤처짐은 결함이 아니라 내 체크아웃 상태다 — 소리는 내되 빨갛게 하지 않는다(F215: 거짓적색의 처방이 오염이었다).
   * **어느 판이 들고 있는지 이름을 찍는다** — 워크트리가 여럿 도는 동안 상시로 울리는 줄이라,
   * 이름이 없으면 배경 소음이 되어 진짜가 섞여도 안 읽힌다(F469 〖틀릴 때의 모습〗①). */
  if (뒤처짐.length) console.log(
    `  ⚠ 내 작업본엔 없지만 **앞선 판에 살아 있는** 행 ${뒤처짐.length}건 — 유실이 아니라 뒤처짐이다:\n`
    + 뒤처짐.map((f) => `      · ${f} ← ${어디.get(f)}`).join('\n')
    + '\n    → 복원 커밋 금지. 기본 가지가 들고 있으면 `git pull --rebase`,\n'
    + '      남의 워크트리가 들고 있으면 그 세션이 올릴 때까지 그냥 둔다(오래 남으면 `node tools/작업본소유자.js` 가 갇힘으로 센다).');

  assert.deepStrictEqual(사라짐, [],
    '장부에서 행이 사라졌다(내 가지가 지웠거나, 앞선 판 어디에도 없다). 되살리는 법 — 그 번호가 살아있는 판을 찾아 그 줄만 지금 장부에 되돌려 넣는다:\n'
    + `  git log --all -S "| F123 |" --oneline -- ${장부} ${조각폴더}\n`
    + `  git show <그 커밋>:${장부} | grep "^| F123 |"\n`
    + '(번호는 위 목록의 것으로 바꾼다. 폰 브랜치에만 남아 있는 경우가 실제로 있었다 — F123·08-07)');
});
