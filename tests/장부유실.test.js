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
 *        🔴 값을 치른 자리가 여기다: **F403(워크트리 갇힘)이 발각된 유일한 통로가 이 검사의
 *        적색이었다** — 그것도 그 세션이 마찰 행을 같은 가지에 «우연히» 적었기 때문이었다.
 *        이제 그 모양은 뒤처짐이라 콘솔 줄이 된다. 판정은 `tools/작업본소유자.js` 의 `워크트리갇힘`
 *        (커밋 시각 60분 문턱)이 진다 — 우연한 통로를 전용 장치로 옮긴 것이지, 없앤 것이 아니다.
 *        그 장치가 죽으면 이 자리도 같이 눈이 먼다.
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
/* 열린 코드 트랙의 가지인가 — 이름 규약이 재료다(④ 갈래 전용).
 * CLAUDE.md 「코드 트랙은 워크트리 + PR 로 짓는다 … ①`EnterWorktree`」 — 그 하네스가 내는 이름이
 * `worktree-<트랙>` 이고, 이 저장소 origin 의 실물이 전부 그 모양이다(그 사실은 아래 회귀가 잰다).
 * ⚠ `claude/*`(클라우드·폰)는 **일부러 뺀다** — F123 이 그 자리다. */
const 열린트랙가지 = (ref) => /(?:^|\/)worktree-[^/]+$/.test(String(ref || ''));

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

  /* ④ origin 의 **열린 가지들** (2026-08-18 실측) — ③ 이 로컬 워크트리만 세는 바람에 이 판정이
   *   「어느 기계에서 돌렸나」에 좌우됐다. 유호님 로컬에는 워크트리가 실제로 걸려 있어 초록인데,
   *   클라우드·CI 에는 워크트리가 **0개**라(못 센 게 아니라 진짜 0이라 위 catch 에도 안 걸린다)
   *   같은 판이 빨갛다. 실측: F595·F610·F612·F614·F616 이 「유실」로 떴는데 다섯 다
   *   `origin/worktree-*` 에 멀쩡히 살아 있었고, 그중 넷은 30분 뒤 머지되자 저절로 사라졌다.
   *   사라진 게 아니라 **아직 안 온 것**이다(F296 · 「repo 밖 환경에 기대는 검사는 CI에서 깨진다」).
   *
   * 🔑 이 저장소의 동선상 origin 이 진실 층이다 — CLAUDE.md 「커밋과 push 는 한 벌이다 …
   *   서버측 잠금도 PR 도 **origin 에 올라온 것만** 지킨다」. 워크트리는 그 판의 로컬 그림자다.
   * ⚠ 처방까지 못 따르던 자리다(F103): 배너는 「그 줄만 지금 장부에 되돌려 넣어라」라고 했는데,
   *   따르면 **남의 열린 트랙의 신고를 내 가지에 복제**해 머지 때 같은 번호가 둘이 된다(F586 그 사고).
   * ⚠ **원격 가지를 다 넣지는 않는다** — 넣으면 F123 이 무너진다(위 「갈라진 가지에만 남은 행은
   *   그대로 유실이다」 픽스처가 `origin/claude/phone` 으로 그것을 지킨다). 두 모양은 다르다:
   *     · `worktree-*` = `EnterWorktree`+`작업가지.js` 가 내는 **열린 코드 트랙**. PR 이 목록으로
   *       남고 SessionStart 훅이 하루 넘은 것을 적색으로 낸다 — 방치는 **다른 층이** 잡는다.
   *       실측한 다섯 건이 전부 이 모양이었고 넷은 30분 뒤 실제로 머지됐다.
   *     · `claude/*` = 클라우드·폰 세션 가지. F123 의 실제 사고가 그 자리이고, 그건 유실로
   *       경보해야 사람이 되살린다. 이 갈래는 안 건드린다.
   * ⚠ 대가 — 경계선이 그만큼 넓어진다: 방치된 `worktree-*` 가 「지워진 행」을 계속 뒤처짐으로
   *   덮어줘 진짜 유실을 가릴 수 있다. 가리지 **못하는** 쪽을 남겨둔 것이 안전판이다 —
   *   「내 이력에 있었는데 지금 없다 = 내가 지웠다」는 이 목록과 무관하게 그대로 유실이고
   *   (`유실()` 의 첫 갈래), F195(반입 덮어쓰기)를 지키는 것은 그쪽이다. 그리고 그 가지가
   *   끝내 지워지면 ref 도 함께 사라져 그때 유실로 뜬다 — 늦는 게 아니라 정확한 시점이다. */
  try {
    const 기본 = new Set(후보.map((c) => c.ref));
    for (const ref of git(cwd, 'for-each-ref', '--format=%(refname)', 'refs/remotes/')
      .split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      if (ref.endsWith('/HEAD') || 기본.has(ref)) continue;
      if (!열린트랙가지(ref)) continue;
      밀기(ref, `원격 ${ref.replace('refs/remotes/', '')}`);
    }
  } catch { /* 원격추적 ref 를 못 읽었다 — 0건이라는 뜻이 아니다 */ }
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

/* ── [2026-08-18] ④ 원격 열린 트랙 ─ 이 판정이 「어느 기계에서 돌렸나」에 좌우되던 것 ─────────
 * 실측(CI 모사 · 리눅스 클라우드): F595·F610·F612·F614·F616 이 「유실」로 떴는데 다섯 다
 * `origin/worktree-*` 에 멀쩡히 살아 있었고, 그중 넷은 30분 뒤 머지되자 저절로 사라졌다.
 * ③ 이 **로컬 워크트리**만 세는 것이 원인이었다 — 유호님 로컬엔 워크트리가 걸려 있어 초록이고,
 * 클라우드·CI 엔 0개라(못 센 게 아니라 진짜 0이라 catch 에도 안 걸린다) 같은 판이 빨갛다.
 * 처방까지 못 따르던 자리다(F103): 배너대로 「그 줄을 되돌려 넣으면」 남의 열린 트랙 신고를
 * 내 가지에 복제해 머지 때 같은 번호가 둘이 된다(F586 그 사고). */

test('🔑 거짓양성 — 워크트리가 0개인 기계에서도 `origin/worktree-*` 에 살아 있으면 뒤처짐이다', () => {
  const d = 픽스처([판([1, 2]), 판([1, 2, 3])]);
  git(d, 'remote', 'add', 'origin', '.');
  git(d, 'update-ref', 'refs/remotes/origin/worktree-f999-무언가', 'HEAD');   // 열린 트랙에만 F003 이 산다
  git(d, 'update-ref', 'refs/remotes/origin/master', 'HEAD~1');               // 상류엔 아직 없다
  git(d, 'branch', '--set-upstream-to=origin/master');
  git(d, 'reset', '--hard', '-q', 'HEAD~1');
  /* 이 픽스처엔 워크트리가 본체 하나뿐이다 = ③ 갈래는 아무것도 못 준다. 즉 ④ 가 없으면 빨갛다. */
  assert.deepStrictEqual(판정(d), { 유실: [], 뒤처짐: ['F003'] });
  치우기(d);
});

test('🔑 탐지 — ④ 를 더해도 `claude/*` 는 그대로 유실이다 (F123 을 무르지 않았다)', () => {
  /* 넓힌 경계가 옛 판정을 삼키지 않았는지 **같은 판**에서 잰다 — 위 F123 검사와 재료가 같고
   * 다른 것은 가지 이름뿐이라, 둘이 갈리면 그 차이가 곧 경계선이다. */
  const d = 픽스처([판([1, 2]), 판([1, 2, 3])]);
  git(d, 'remote', 'add', 'origin', '.');
  git(d, 'update-ref', 'refs/remotes/origin/claude/phone', 'HEAD');
  git(d, 'update-ref', 'refs/remotes/origin/master', 'HEAD~1');
  git(d, 'branch', '--set-upstream-to=origin/master');
  git(d, 'reset', '--hard', '-q', 'HEAD~1');
  assert.deepStrictEqual(판정(d), { 유실: ['F003'], 뒤처짐: [] });
  치우기(d);
});

test('🔴 등록층 — 판정 상수가 실 저장소의 열린 트랙 가지와 **같은 것**을 가리킨다', () => {
  /* ④ 는 이름으로 판정한다. 규약이 바뀌거나 상수가 어긋나면 이 갈래는 **조용히 0건**이 되고,
   * 증상은 옛 버그의 재발이다(남의 신고가 유실로 뜬다).
   *
   * 🔑 「상수로 걸러 그 결과가 규약에 맞나」로 물으면 **안 된다** — 상수를 엉뚱하게 바꾼 판에서
   *   걸러진 목록이 빈 배열이 되고, 그 검사는 「0건이니 skip」으로 통과한다. 실측했다: 변이 I
   *   (`worktree-` → `wt-`)를 이 검사가 그 모양으로 흘려보냈다(미실행은 통과와 같은 모양 · F207).
   *   그래서 **실물에서 규약 모양을 따로 세어 상수의 답과 대조한다.** 규약 문자열이 두 곳에
   *   적히는 것은 신뢰성 ④ 위반이 아니라 이 검사의 재료다 — 기대값을 상수 자신에게서 뽑으면
   *   무엇과도 비교하지 않는 것이 된다.
   * ⚠ 탐지력은 위 픽스처가 지고, 여기서는 **미측정을 skip 으로 드러낸다**(F296). */
  let refs = [];
  try {
    refs = git(REPO, 'for-each-ref', '--format=%(refname)', 'refs/remotes/')
      .split(/\r?\n/).map((s) => s.trim()).filter(Boolean).filter((r) => !r.endsWith('/HEAD'));
  } catch { /* origin 이 없는 기계 */ }
  if (!refs.length) { console.log('  ⚠ skip — 원격추적 ref 0건(오프라인 clone). 통과가 아니라 미실행이다'); return; }

  const 실물 = refs.filter((r) => r.includes('/worktree-'));   // 규약을 여기 직접 적는다(대조의 재료)
  const 상수 = refs.filter((r) => 열린트랙가지(r));
  assert.deepStrictEqual(상수, 실물,
    `④ 의 판정 상수가 실물 규약과 갈라졌다 — 원격 ${refs.length}개 중 규약 모양 ${실물.length}개를`
    + ` 상수는 ${상수.length}개로 봤다. 이 갈래가 조용히 0건이 되면 남의 열린 트랙 신고가 다시 「유실」로 뜬다.`);
  if (!실물.length) console.log(`  ⚠ 열린 트랙 가지 0건(원격 ${refs.length}개는 읽었다) — 지금 도는 코드 트랙이 없으면 정상이다`);
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
  const r = 유실(d);
  assert.deepStrictEqual({ 유실: r.유실, 뒤처짐: r.뒤처짐 }, { 유실: [], 뒤처짐: ['F003'] });
  /* 완화책도 회귀가 진다 — 이 줄은 상시로 울리므로 **누가 들고 있는지**가 빠지면 배경 소음이
   * 되고, 그러면 F403 을 넘겨받은 판정이 읽히지 않는다(〖틀릴 때의 모습〗①) */
  assert.match(r.어디.get('F003'), /워크트리 claude\/sibling/);
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

/* ── F586 ─ 「조각 하나 = 행 하나」가 깨지는 자리 ────────────────────────────────
 * 위 검사들과 **축이 다르다**: 저기는 「발급된 번호의 행이 없어졌나」를 «번호» 단위로 잰다.
 * F586 은 번호가 **살아 있는 채로** 행이 사라진 사고다 — 두 가지가 같은 F578 을 따서 같은 파일에
 * 각자 1행을 썼고, add/add 충돌을 사람이 「하나 고르기」로 풀어 남의 신고가 증발했다.
 * 번호로 재면 F578 은 멀쩡하니 위 검사들은 **원리상** 초록이다(맹점 ④ · 맞는 얼굴로 틀린 값).
 *
 * 🔑 이 회귀는 «막는 층»과 한 벌이다 — `.gitattributes` 의 `docs/_ops/장부/*.md merge=union`.
 *   union 이 없으면 두 행이 애초에 안 남아 여기서 잴 것이 없고(사라진 뒤라 늦다),
 *   union 만 있으면 「같은 행을 양쪽이 고친」 정상 편집이 조용히 행 둘로 늘어난다.
 *   실측 2026-08-18: union 없음 = exit 1·표식 3줄 / union = exit 0·표식 0·2행 생존.
 *   즉 **union 이 새는 방향이 이 탐지기 «안»**이라 조용한 통로가 안 남는다.
 *
 * ⚠ 틀릴 때의 모습 = 표기에 흔들려 «멀쩡한 파일»을 깨진 것으로 읽는 것이다. 실측 08-18:
 *   `^\| F` 로 세면 `docs/_ops/장부/F526.md`(행이 `|  F526 |` · 공백 둘)가 「0행」으로 나온다.
 *   그래서 아래 픽스처가 공백 표기를 값으로 못박는다(F518·F526 이 이름 대어 경고한 그 축).
 * 〖닫은 것 1개〗 `friction.js 조각행들()` 의 `.find()` — 첫 행만 집어 둘째를 읽기 층에서
 *   한 번 더 버리던 자리다. 머지가 살려 놔도 도구가 안 보여주면 없는 것과 같았다. */
const { 조각행뽑기, 조각이상 } = require('../tools/friction.js');
const 조각 = (번호, 줄들) => ({ 파일: `/x/${번호}.md`, 번호, 줄들 });

test('🔑 F586 탐지 — 조각 하나에 행이 둘이면 잡는다 (F578 이 정확히 이 모양이었다)', () => {
  const r = 조각이상([
    조각('F577', ['| F577 | 2026-08-17 | 마찰 | 하나 | |']),
    조각('F578', ['| F578 | 2026-08-17 | 마찰 | 배포 검수 과녁 | |',
      '| F578 | 2026-08-17 | 마찰 | git 자격증명 매달림 | |']),
  ]);
  assert.deepStrictEqual(r.겹침.map((g) => [g.파일, g.행수]), [['F578.md', 2]]);
  assert.deepStrictEqual(r.겹침[0].번호들, ['F578', 'F578']);
  assert.strictEqual(r.분모, 2, '분모를 안 내면 「겹침 0」과 「안 재봤다」가 같은 모양이 된다(F543·F207)');
});

test('🔑 F586 탐지 — 표기(앞뒤 공백)에 흔들리지 않는다 (`|  F526 |` 가 실제 장부에 산다)', () => {
  /* 🔴 08-18 실측: 내가 이 결함을 재려고 쓴 첫 명령(`grep -c "^| F[0-9]"`)이 바로 여기서 틀렸다.
   *   F526.md 를 「0행」으로 내서 멀쩡한 파일이 깨진 것처럼 보였다. 재는 층이 값을 깨뜨리면
   *   원본이 멀쩡해도 판정이 뒤집힌다(CLAUDE.md 「재는 층이 값을 깨뜨리지 않는지 확인」). */
  assert.deepStrictEqual(조각행뽑기('|  F526 | 2026-08-17 | 마찰 | 내용 | |\n').length, 1);
  assert.deepStrictEqual(조각행뽑기('|F001| a | b | c | d |\n|  F001  | a | b | c | d |\n').length, 2,
    '공백을 안 접으면 겹친 두 행 중 한쪽만 세어 「1행」으로 초록이 된다');
});

test('F586 거짓양성 — 행 하나짜리 조각과 산문은 잡지 않는다 (정상이 빨개지면 그 검사는 꺼진다)', () => {
  const r = 조각이상([조각('F580', ['| F580 | 2026-08-17 | 마찰 | 내용 | |'])]);
  assert.deepStrictEqual({ 겹침: r.겹침, 이름어긋남: r.이름어긋남 }, { 겹침: [], 이름어긋남: [] });
  /* 신고문이 다른 번호를 **인용**하는 것은 행이 아니다 — 장부는 서로를 상시 인용한다(F526 이 F518 을 든다). */
  assert.deepStrictEqual(조각행뽑기('| F586 | 날짜 | 마찰 | F578 과 같은 축이다(| F578 | 참조) | |\n').length, 1,
    '줄 머리에서만 센다 — 본문 속 인용을 행으로 세면 장부 전체가 빨개진다');
  assert.deepStrictEqual(조각행뽑기('# 머리말\n\n> F586 을 참조한다\n').length, 0);
});

test('🔑 F586 탐지 — 파일명과 행 번호가 다르면 잡는다 (겹침을 푸는 처방이 «옮기기»라 옮기다 만 자리가 생긴다)', () => {
  const r = 조각이상([조각('F578', ['| F602 | 2026-08-18 | 마찰 | 새 번호로 옮겼는데 파일명을 안 바꿨다 | |'])]);
  assert.deepStrictEqual(r.이름어긋남, [{ 파일: 'F578.md', 행: 'F602' }]);
  assert.deepStrictEqual(r.겹침, [], '이름 어긋남을 겹침으로 세면 두 결함이 한 칸에 뭉쳐 어디서 멈췄는지 사라진다');
});

test('🔑 F586 이음매 — 실제 파일을 읽는 통로가 둘 다 싣고, 배너가 «처방»까지 낸다 (F103)', () => {
  /* 픽스처 순수 함수만 검사하면 `조각들읽기()` 의 파일 읽기·`read()` 배선이 통째로 미측정이다.
   * 자식 프로세스로 격리 장부를 물려 그 층을 실제로 지나게 한다. */
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '장부겹침-'));
  const led = path.join(d, '마찰신호.md');
  fs.writeFileSync(led, '| ID | 날짜 | 종류 | 내용 | 해소 |\n|---|---|---|---|---|\n');
  fs.mkdirSync(path.join(d, '장부'));
  fs.writeFileSync(path.join(d, '장부', 'F578.md'),
    '|  F578 | 2026-08-17 | 마찰 | 배포 검수 과녁 | |\n| F578 | 2026-08-17 | 마찰 | git 자격증명 매달림 | |\n');
  /* 번호가 **다른** 두 행이 한 조각에 얹힌 판 — 옛 `read()` 는 둘째를 표에서 통째로 잃었다.
   * (같은 번호끼리는 표가 번호를 키로 접으므로, 전량 싣기의 값은 여기서만 값으로 보인다.) */
  fs.writeFileSync(path.join(d, '장부', 'F600.md'),
    '| F600 | 2026-08-18 | 마찰 | 먼저 있던 행 | |\n| F601 | 2026-08-18 | 실수 | 얹힌 행 | |\n');
  const r = require('node:child_process').spawnSync(process.execPath, ['-e',
    "const f=require(process.argv[1]);const j=f.조각이상(f.조각들읽기());"
    + "const ids=f.read().rows.map((x)=>x.id);"
    + "process.stdout.write(JSON.stringify({분모:j.분모,겹침:j.겹침.length,행수:j.겹침.map((g)=>g.행수).sort(),ids}));",
    path.join(REPO, 'tools', 'friction.js')],
  { encoding: 'utf8', env: { ...process.env, SYNK_FRICTION_LEDGER: led } });
  const 나온것 = JSON.parse(r.stdout);
  assert.deepStrictEqual({ 분모: 나온것.분모, 겹침: 나온것.겹침, 행수: 나온것.행수 }, { 분모: 2, 겹침: 2, 행수: [2, 2] },
    `실제 읽기 통로가 두 행을 못 실었다 — 옛 판의 .find() 가 살아 있다는 뜻이다. stderr: ${r.stderr}`);
  assert.deepStrictEqual(나온것.ids, ['F578', 'F600', 'F601'],
    '조각의 행을 전량 싣지 않으면 번호가 다른 둘째 행이 표에서 통째로 사라진다 — 배너도 없이 조용하다');
  /* 처방이 따를 수 있는 것이어야 한다 — 「하나 고르기」가 이 사고의 원인이었으니 배너가 그것을 막아야 한다 */
  assert.match(r.stderr, /하나를 지우지 마라/, '처방이 없는 경보는 사람이 가장 빠른 길(하나 지우기)로 간다 — 그게 F578 이다');
  assert.match(r.stderr, /새 번호 조각으로 옮긴다/, '무엇을 하라는지 없으면 우회가 정상 통로가 된다(F103)');
  치우기(d);
});

test('🔑 F586 막는 층 — 이 저장소의 `.gitattributes` 로 머지하면 겹친 두 행이 **둘 다** 산다', () => {
  /* 🔑 «표기»가 아니라 «행위»로 잰다(F590). `.gitattributes` 에 그 줄이 있나를 grep 하면
   *   패턴이 실제로 그 경로에 붙는지·union 이 정말 두 행을 남기는지를 하나도 안 재고 초록이 된다.
   *   그래서 **진짜 머지를 돌린다** — 실물 `.gitattributes` 를 그대로 실어서.
   * 이 검사가 없으면 union 줄은 장식이다: 누가 지워도 아무것도 안 빨개지고, 다음 충돌에서
   *   조용히 한 행이 사라진다(그게 F578 이다). */
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '장부union-'));
  const 조각쓰기 = (본문) => {
    fs.mkdirSync(path.join(d, 조각폴더), { recursive: true });   // checkout 이 빈 폴더를 걷어낸다
    fs.writeFileSync(path.join(d, 조각폴더, 'F578.md'), 본문);
  };
  git(d, 'init', '-q');
  fs.copyFileSync(path.join(REPO, '.gitattributes'), path.join(d, '.gitattributes'));   // 실물 그대로
  git(d, 'add', '--', '.gitattributes'); 커밋(d, 'base'); git(d, 'branch', '-M', 'master');

  git(d, 'checkout', '-q', '-b', 'A');
  조각쓰기('| F578 | 2026-08-17 | 마찰 | 배포 검수 과녁 | |\n');
  git(d, 'add', '-A'); 커밋(d, 'A');
  git(d, 'checkout', '-q', '-b', 'B', 'master');
  조각쓰기('| F578 | 2026-08-17 | 마찰 | git 자격증명 매달림 | |\n');
  git(d, 'add', '-A'); 커밋(d, 'B');

  /* 같은 번호를 딴 두 가지를 합친다 — F578 이 증발한 그 머지다. union 이면 충돌 없이 둘 다 남는다. */
  git(d, '-c', 'user.email=t@t', '-c', 'user.name=t', 'merge', 'A', '-m', 'Merge A');
  const 본문 = fs.readFileSync(path.join(d, 조각폴더, 'F578.md'), 'utf8');
  assert.strictEqual(조각행뽑기(본문).length, 2,
    'union 이 안 걸렸다 — 머지가 두 신고 중 하나를 버린다(F586). `.gitattributes` 의 `docs/_ops/장부/*.md merge=union` 을 확인한다');
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(본문), '충돌 표식이 남았다 — union 이 아니라 사람이 고르는 자리가 됐다');
  /* 대가도 값으로 못박는다 — 그 늘어난 행을 위 탐지기가 «실제로» 잡는지. 둘이 한 벌이라는 근거다. */
  assert.strictEqual(조각이상([조각('F578', 조각행뽑기(본문))]).겹침.length, 1,
    'union 이 만든 2행을 탐지기가 못 보면 조용한 통로가 그대로 남는다 — 두 층은 한 벌이어야 한다');
  치우기(d);
});

test('🔴 F586 실 저장소 — 조각은 전부 「한 파일 = 한 행」이고 파일명이 행 번호와 같다', () => {
  const f = require('../tools/friction.js');
  const { 분모, 겹침, 이름어긋남 } = f.조각이상(f.조각들읽기());
  /* 분모 하한 — 폴더를 못 읽거나 정규식이 표기를 놓치면 「겹침 0」이 나오는데 그건 통과가 아니라
   * 미측정이다(F207). 위 픽스처가 탐지력을 지고, 여기서는 **거짓양성만** 본다(맹점 ②). */
  assert.ok(분모 > 300, `조각을 ${분모}개만 읽었다 — 대상 소실은 통과가 아니다(F207)`);
  assert.deepStrictEqual(겹침, [], '조각 하나에 행이 둘이다 — 「둘 다 살아야 할 서로 다른 신고」일 수 있으니 지우지 말고 나중 것을 새 번호로 옮긴다(F586)');
  assert.deepStrictEqual(이름어긋남, [], '파일명과 행 번호가 다르다 — 옮기다 만 자리다(F586)');
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

/* ── F605 ─ jsonl 장부: CLAUDE.md 가 「이 파일이 잡는다」고 적은 대상이 여기 없었다 ──────────
 * 정본 문장: 「append-only 장부(마찰신호.md·심문기록·**결정록 류 jsonl**)는 행 삭제 금지 —
 *   tests/장부유실.test.js 가 fail 로 잡는다」. 실측 2026-08-18: 이 파일의 과녁은 위 두 상수
 *   (`마찰신호.md` · `docs/_ops/장부`)뿐이고 jsonl 은 **한 줄도 안 봤다**. 상주 텍스트가
 *   «없는 보호»를 있다고 말하던 자리다(F605 · 맹점 ④ — 맞는 얼굴로 틀린 값).
 *
 * 🔑 «번호»가 아니라 «줄 전문»이 키다 — F605 가 「행 단위 ID 가 없어 못 잰다」를 ㉢의 대가로
 *   적었는데, 실측으로 틀렸다. append-only 라는 성질 자체가 축이다: 한 번 올라온 레코드 줄이
 *   지금 없으면 그게 유실이다. 번호가 필요한 쪽은 마찰 조각(사람이 인용하는 주소)이지 jsonl 이 아니다.
 *
 * 🔑 이 회귀는 «막는 층»과 한 벌이다 — `.gitattributes` 의 `docs/_ops/*.jsonl merge=union`.
 *   실측 2026-08-18 (`jsonl머지` 실험 · 두 가지가 각자 마지막에 한 줄씩 append 한 판):
 *     · 지정 없음 = **충돌 exit 1 · 표식 3줄** → 사람이 「하나 고르기」로 풀면 한 세션의 레코드가 증발
 *     · union    = **충돌 0 · 표식 0 · 두 행 전부 생존**
 *   F578 이 정확히 그렇게 사라졌고, 그때 마찰 조각에만 union 을 걸었다(F586). jsonl 12벌은 안 걸렸다.
 *   워크트리+PR 이 정본 동선이라 가지는 상시 갈라져 있고, append-only 파일은 **둘 다 마지막 줄을
 *   건드리므로 갈라지면 반드시 충돌한다** — 드문 사고가 아니라 동선의 기본값이다.
 *
 * 〖틀릴 때의 모습〗 — 맹점 ④
 *   ① **머리말·빈 줄을 레코드로 세는 것.** 08-18 실측에서 내 첫 측정기가 여기서 틀렸다:
 *      「현재」는 모든 줄을, 「이력」은 `{` 줄만 세어 `판정예측.jsonl`(주석 2줄)이 멀쩡한데
 *      「2행 유실」로 나왔다. 두 축은 **같은 것을 세야** 한다(CLAUDE.md 「재는 층이 값을 깨뜨리지 않는지」).
 *   ② 「사라짐 0」이 **미측정**일 수 있다 — 경로 glob 이 빗나가거나 diff 를 못 읽으면 그 모양이다.
 *      그래서 분모(벌 수·레코드 수) 하한을 같이 단언한다(F207·F543).
 *   ③ union 이 새는 방향(같은 행을 양쪽이 다르게 고쳐 행이 «는다»)은 **이 탐지기 안**이다 —
 *      수정은 diff 에서 삭제+추가 쌍이라 옛 줄이 「이력에 있는데 지금 없다」로 걸린다.
 *      실측: 12벌 전부 이력 삭제줄 0 = 기존 행을 고친 적이 한 번도 없다. 그날이 오면 이 검사가 먼저 운다.
 * 〖닫은 것〗 없다 — 이 자리는 지금까지 **기계 0**이었다(닫을 옛 통로가 없다). 대신 정본 문장이
 *   참이 되므로, 「기계가 막아 줄 것」으로 읽고 지나가던 세션의 전제가 이제 실제로 선다. */

const jsonl과녁 = 'docs/_ops/*.jsonl';
const jsonl추적중 = (cwd) => new Set(git(cwd, 'ls-files', '--', jsonl과녁).split(/\r?\n/).filter(Boolean));

/* 대상 = 지금 추적되는 것 **∪ 이력에 한 번이라도 있던 것** (F605 후속 · `local_9b74b64b`).
 * 🔑 `ls-files` 만 보면 **장부를 통째로 지우는 것이 목록에서까지 사라져 조용히 통과한다** —
 *   한 벌이 없어지면 그 벌의 레코드 전부가 후보에서도 빠지므로 「사라짐 0」이 나온다.
 *   새는 방향이 「통과」인 전형이고(맹점 ④), 이 축이 막으려던 사고(반입이 통째로 덮어쓰기)의
 *   가장 큰 판이 정확히 이 모양이다. 변이 M1 이 이 자리를 잡는다. */
const jsonl장부들 = (cwd) => {
  const s = jsonl추적중(cwd);
  try {
    for (const f of git(cwd, 'log', '--all', '--format=', '--name-only', '--', jsonl과녁).split(/\r?\n/)) {
      const v = f.trim();
      if (v) s.add(v);
    }
  } catch { /* 이력 0 — 아래 분모 하한이 드러낸다 */ }
  return [...s].sort();
};

/* 레코드 = `{` 로 시작하는 줄 하나. 머리말 주석(`#`)·빈 줄은 레코드가 아니다(〖틀릴 때의 모습〗①).
 * 현재 파일과 diff 양쪽이 **이 한 함수**를 지나야 두 축이 안 갈린다. */
const jsonl레코드 = (본문) => new Set(본문.split(/\r?\n/).filter((l) => l.startsWith('{')));

/* 이력에 한 번이라도 올라왔던 레코드. 범위를 인자로 받는 이유는 F469 와 같다 —
 * `--all`(누구든 올린 적 있나)과 `HEAD`(**내 가지**에 있었나)를 같은 정규식으로 재야 답이 안 갈린다.
 * 🔑 머지 커밋은 `log -p` 가 안 펼치지만, 사라진 줄은 그 **부모 커밋**에서 이미 `+` 로 잡혀 있다 —
 *   그래서 「머지가 하나 고르기로 버린 행」이 이 축에 그대로 걸린다(아래 F605 탐지 회귀가 못박는다). */
const jsonl이력 = (cwd, p, 범위 = '--all') =>
  new Set([...git(cwd, 'log', 범위, '-p', '--format=', '--', p).matchAll(/^\+(\{[^\r\n]*)/gm)].map((m) => m[1]));

/* 후보 레코드 → 그걸 들고 있는 앞선 판. 번호판(`앞선판번호`)과 축은 같고 읽는 단위만 다르다 */
function jsonl앞선판(cwd, p, 후보) {
  const 어디 = new Map();
  const 본sha = new Set();
  for (const { ref, 이름 } of 살아있는후보(cwd)) {
    if (어디.size >= 후보.length) break;
    let sha;
    try { sha = git(cwd, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`).trim(); } catch { continue; }
    if (!sha || 본sha.has(sha)) continue;
    본sha.add(sha);
    try { git(cwd, 'merge-base', '--is-ancestor', sha, 'HEAD'); continue; } catch { /* 앞서 있다 = 재료다 */ }
    let 있는것;
    try { 있는것 = jsonl레코드(git(cwd, 'show', `${sha}:${p}`)); } catch { continue; }
    for (const r of 후보) if (!어디.has(r) && 있는것.has(r)) 어디.set(r, 이름);
  }
  return 어디;
}

/* 반환에 **분모**를 필수 칸으로 둔다 — 「사라짐 0」과 「안 재봤다」가 같은 모양이 되는 것을 막는다(F543 ㉠) */
function jsonl유실(cwd) {
  const 경로들 = jsonl장부들(cwd);
  const 추적중 = jsonl추적중(cwd);
  const 벌 = [];
  let 레코드수 = 0;
  /* 지금 «어디엔가» 살아 있는 레코드 전부 — 추적이 끊긴 경로를 판정할 때만 쓴다(그때만 만든다).
   * 이게 없으면 **이름 바꾸기가 대량 거짓적색**이 된다: 옛 경로는 못 읽고 그 레코드는 새 경로에
   * 멀쩡히 살아 있는데 「전부 유실」로 나온다. 파일이 아니라 «레코드»가 판정 단위다. */
  let 살아있는전체 = null;
  const 전체레코드 = () => {
    if (살아있는전체) return 살아있는전체;
    살아있는전체 = new Set();
    for (const q of 추적중) {
      try { for (const r of jsonl레코드(fs.readFileSync(path.join(cwd, q), 'utf8'))) 살아있는전체.add(r); }
      catch { /* 그 벌은 아래 못읽음으로 따로 선다 */ }
    }
    return 살아있는전체;
  };
  /* 판정은 **한 통로**로만 낸다 — 살아 있는 벌과 사라진 벌이 각자 판정하면 갈라진다
   * (「같은 판정을 두 곳에 적으면 갈라진다」 · 지침 v9.2 가드 ④). */
  const 벌판정 = (p, 현재) => {
    const 이력 = jsonl이력(cwd, p);
    const 후보 = [...이력].filter((r) => !현재.has(r));
    if (!후보.length) return { 사라짐: [], 뒤처짐: [], 어디: new Map() };
    /* 내 가지 이력에 있던 것이 지금 없다 = **내가 지웠다**(머지가 버린 것 포함). 남이 들고 있어도 유실이다 */
    const 내이력 = jsonl이력(cwd, p, 'HEAD');
    const 내가지움 = 후보.filter((r) => 내이력.has(r));
    const 안온것 = 후보.filter((r) => !내이력.has(r));
    const 어디 = 안온것.length ? jsonl앞선판(cwd, p, 안온것) : new Map();
    return {
      사라짐: [...내가지움, ...안온것.filter((r) => !어디.has(r))],
      뒤처짐: 안온것.filter((r) => 어디.has(r)),
      어디,
    };
  };

  for (const p of 경로들) {
    let 현재;
    try { 현재 = jsonl레코드(fs.readFileSync(path.join(cwd, p), 'utf8')); }
    catch {
      /* 🔑 추적 목록에 없는 경로 = **지워졌거나 이름이 바뀐 장부**다. 「못 읽었다」로 접으면
       *   파일 통째 삭제가 조용히 통과한다 — 살아 있는 «전체» 레코드를 「지금」으로 두고 같은
       *   판정을 지나게 한다. 지워졌으면 그 레코드가 아무 데도 없어 잡히고, 이름만 바뀌었으면
       *   새 경로에 살아 있어 안 잡힌다(변이 M1·M2). */
      if (!추적중.has(p)) { 벌.push({ 파일: p, 사라진벌: true, 현재: 0, ...벌판정(p, 전체레코드()) }); continue; }
      벌.push({ 파일: p, 못읽음: true, 사라짐: [], 뒤처짐: [], 어디: new Map() }); continue;
    }
    레코드수 += 현재.size;
    벌.push({ 파일: p, 현재: 현재.size, ...벌판정(p, 현재) });
  }
  return { 분모: 경로들.length, 레코드수, 벌, 못읽음: 벌.filter((b) => b.못읽음).map((b) => b.파일) };
}

/* 픽스처 단언용 — 파일명과 사라진 개수만 본다(줄 전문은 길어 읽기 어렵다) */
const j판정 = (cwd) => jsonl유실(cwd).벌
  .filter((b) => b.사라짐.length || b.뒤처짐.length)
  .map((b) => ({ 파일: path.basename(b.파일), 사라짐: b.사라짐.length, 뒤처짐: b.뒤처짐.length }));

const J장부 = 'docs/_ops/심문기록.jsonl';
const j줄 = (n) => JSON.stringify({ id: n, 판정: `내용 ${n}` });
const j판 = (ns, 머리말 = '') => 머리말 + ns.map(j줄).join('\n') + '\n';

function j픽스처(판들) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl유실-'));
  git(d, 'init', '-q');
  fs.mkdirSync(path.join(d, path.dirname(J장부)), { recursive: true });
  for (const p of 판들) {
    fs.writeFileSync(path.join(d, J장부), p);
    git(d, 'add', '--', J장부);
    커밋(d, '판');
  }
  git(d, 'branch', '-M', 'master');
  return d;
}

test('🔑 F605 탐지 — jsonl 에서 레코드가 사라지면 잡는다 (지금까지 이 자리는 기계 0이었다)', () => {
  const d = j픽스처([j판([1, 2, 3]), j판([1, 3])]);
  assert.deepStrictEqual(j판정(d), [{ 파일: '심문기록.jsonl', 사라짐: 1, 뒤처짐: 0 }]);
  치우기(d);
});

/* 🔑 이 트랙의 급소 — F578 이 실제로 증발한 모양을 jsonl 로 그대로 재현한다.
 * 머지 커밋 자체는 `log -p` 가 안 펼치므로, 「삭제줄을 센다」식 측정기는 **원리상 이걸 못 본다**.
 * 여기서 잡히는 이유는 A 의 레코드가 그 부모 커밋에서 이미 `+` 로 이력에 올랐기 때문이다. */
test('🔑 F605 탐지 — 머지 충돌을 「하나 고르기」로 풀어 남의 append 가 사라져도 잡는다 (F578 의 실제 모양)', () => {
  const d = j픽스처([j판([1, 2])]);
  git(d, 'checkout', '-q', '-b', 'A');
  fs.writeFileSync(path.join(d, J장부), j판([1, 2, 3]));   // 세션 A 가 자기 결과를 append
  git(d, 'add', '--', J장부); 커밋(d, 'A 가 append');
  git(d, 'checkout', '-q', 'master');
  fs.writeFileSync(path.join(d, J장부), j판([1, 2, 4]));   // 세션 B 가 같은 base 에서 append
  git(d, 'add', '--', J장부); 커밋(d, 'B 가 append');

  let 충돌 = false;
  try { git(d, '-c', 'user.email=t@t', '-c', 'user.name=t', 'merge', 'A', '-m', 'Merge A'); }
  catch { 충돌 = true; }
  assert.ok(충돌, 'union 이 안 걸린 판에서 충돌이 안 났다 — 이 픽스처가 재현하려던 상황이 아니다');

  /* 사람이 가장 빠른 길로 푼다: 자기 것만 남기고 커밋 (그게 F578 이다) */
  fs.writeFileSync(path.join(d, J장부), j판([1, 2, 4]));
  git(d, 'add', '--', J장부); 커밋(d, '충돌 해소 — 하나 고르기');

  assert.deepStrictEqual(j판정(d), [{ 파일: '심문기록.jsonl', 사라짐: 1, 뒤처짐: 0 }],
    '머지가 버린 레코드를 못 잡으면 이 검사는 F578 통로에 눈이 먼 채 초록이다');
  치우기(d);
});

test('F605 거짓양성 — 레코드가 늘기만 하면 0 (append-only 의 정상 동작을 막으면 그 검사는 꺼진다)', () => {
  const d = j픽스처([j판([1, 2]), j판([1, 2, 3])]);
  assert.deepStrictEqual(j판정(d), []);
  치우기(d);
});

/* 🔑 08-18 실측으로 내 첫 측정기가 틀렸던 자리 — 두 축이 다른 것을 세면 멀쩡한 파일이 빨개진다 */
test('🔑 F605 거짓양성 — 머리말 주석·빈 줄은 레코드가 아니다 (`판정예측.jsonl` 이 실제로 이 모양이다)', () => {
  const 머리 = '# 판정 예측 장부 — 봉인된 예측만 들어온다\n# 형식: {"id":…}\n';
  const d = j픽스처([j판([1, 2], 머리), j판([1, 2, 3], 머리) + '\n']);
  assert.deepStrictEqual(j판정(d), [],
    '주석을 레코드로 세면 「현재」와 「이력」이 다른 것을 세어 유실 0인 파일이 유실로 나온다');
  assert.strictEqual(jsonl레코드(머리 + j줄(1) + '\n\n').size, 1);
  치우기(d);
});

/* 🔑 F215·F469 의 jsonl 판 — 이걸 안 가르면 남이 장부에 한 줄 더할 때마다 내 워크트리가 빨개진다.
 * 거짓적색의 처방(「그 줄을 되돌려 넣어라」)이 그대로 장부 오염이라 위험은 쓰기 쪽이다. */
test('🔑 F605 거짓양성 — 기본 가지에 살아 있으면 유실이 아니라 뒤처짐이다 (F469 의 jsonl 판)', () => {
  const d = j픽스처([j판([1, 2])]);
  git(d, 'checkout', '-q', '-b', 'claude/wt');     // 워크트리 가지 — 상류가 안 걸린다
  git(d, 'checkout', '-q', 'master');
  fs.writeFileSync(path.join(d, J장부), j판([1, 2, 3]));
  git(d, 'add', '--', J장부); 커밋(d, 'master 가 한 줄 더한다');
  git(d, 'checkout', '-q', 'claude/wt');
  assert.deepStrictEqual(j판정(d), [{ 파일: '심문기록.jsonl', 사라짐: 0, 뒤처짐: 1 }]);
  치우기(d);
});

test('🔑 F605 탐지 — 죽은 가지에만 남은 레코드는 그대로 유실이다 (F123 원칙이 jsonl 에서도 산다)', () => {
  const d = j픽스처([j판([1, 2])]);
  git(d, 'checkout', '-q', '-b', 'claude/dead');
  fs.writeFileSync(path.join(d, J장부), j판([1, 2, 3]));
  git(d, 'add', '--', J장부); 커밋(d, '죽은 가지에만 산다');
  git(d, 'checkout', '-q', '-b', 'claude/wt', 'master');
  assert.deepStrictEqual(j판정(d), [{ 파일: '심문기록.jsonl', 사라짐: 1, 뒤처짐: 0 }]);
  치우기(d);
});

/* 🔑 막는 층 — «표기»가 아니라 «행위»로 잰다(F590). `.gitattributes` 를 grep 하면 패턴이 실제로
 * 그 경로에 붙는지·union 이 정말 두 append 를 남기는지를 하나도 안 재고 초록이 된다. */
test('🔑 F605 막는 층 — 이 저장소의 `.gitattributes` 로 머지하면 두 세션의 append 가 **둘 다** 산다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonlunion-'));
  git(d, 'init', '-q');
  fs.mkdirSync(path.join(d, path.dirname(J장부)), { recursive: true });
  fs.copyFileSync(path.join(REPO, '.gitattributes'), path.join(d, '.gitattributes'));   // 실물 그대로
  fs.writeFileSync(path.join(d, J장부), j판([1, 2]));
  git(d, 'add', '-A'); 커밋(d, 'base'); git(d, 'branch', '-M', 'master');

  git(d, 'checkout', '-q', '-b', 'A');
  fs.writeFileSync(path.join(d, J장부), j판([1, 2, 3]));
  git(d, 'add', '-A'); 커밋(d, 'A');
  git(d, 'checkout', '-q', '-b', 'B', 'master');
  fs.writeFileSync(path.join(d, J장부), j판([1, 2, 4]));
  git(d, 'add', '-A'); 커밋(d, 'B');

  git(d, '-c', 'user.email=t@t', '-c', 'user.name=t', 'merge', 'A', '-m', 'Merge A');
  const 본문 = fs.readFileSync(path.join(d, J장부), 'utf8');
  assert.strictEqual(jsonl레코드(본문).size, 4,
    'union 이 안 걸렸다 — 갈라진 두 세션이 각자 append 하면 머지가 한쪽을 버린다(F578·F586).'
    + ' `.gitattributes` 의 `docs/_ops/*.jsonl merge=union` 을 확인한다');
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(본문),
    '충돌 표식이 남았다 — union 이 아니라 사람이 «하나 고르는» 자리가 됐다. 그 선택이 곧 유실이다');
  치우기(d);
});

test('🔴 F605 실 저장소 — jsonl 장부에서 이력에 올라왔던 레코드가 지금도 전부 있다', () => {
  const { 분모, 레코드수, 벌, 못읽음 } = jsonl유실(REPO);
  /* 미측정 방어 — glob 이 빗나가거나 diff 를 못 읽으면 「사라짐 0」이 나오는데 그건 통과가 아니다(F207·F543).
   * 탐지력은 위 픽스처가 지고, 여기서는 **거짓양성만** 본다(맹점 ②). */
  assert.ok(분모 >= 10, `jsonl 장부를 ${분모}벌만 찾았다 — 대상 소실은 통과가 아니다(2026-08-18 실측 12벌)`);
  assert.ok(레코드수 > 250, `레코드가 ${레코드수}줄만 읽혔다 — 표기를 못 잡고 있다(2026-08-18 실측 325줄)`);
  assert.deepStrictEqual(못읽음, [], '추적되는 jsonl 을 작업본에서 못 읽었다 — 미측정이 초록으로 앉는다');

  const 뒤 = 벌.filter((b) => b.뒤처짐.length);
  if (뒤.length) console.log(
    `  ⚠ 내 작업본엔 없지만 **앞선 판에 살아 있는** jsonl 레코드 — 유실이 아니라 뒤처짐이다:\n`
    + 뒤.map((b) => `      · ${path.basename(b.파일)} ${b.뒤처짐.length}줄 ← ${[...new Set(b.어디.values())].join(', ')}`).join('\n')
    + '\n    → 복원 커밋 금지. 기본 가지가 들고 있으면 `git pull --rebase`, 남의 워크트리면 그 세션이 올릴 때까지 둔다.');

  const 사라진벌 = 벌.filter((b) => b.사라짐.length)
    .map((b) => ({ 파일: path.basename(b.파일), 사라짐: b.사라짐.length, 보기: b.사라짐[0].slice(0, 90) }));
  assert.deepStrictEqual(사라진벌, [],
    'jsonl 장부에서 레코드가 사라졌다(내 가지가 지웠거나, 머지 충돌을 «하나 고르기»로 풀었거나).\n'
    + '  되살리는 법 — 그 줄이 살아있는 판을 찾아 **지우지 말고 그 줄만** 되돌려 넣는다:\n'
    + `    git log --all -S '<사라진 줄의 일부>' --oneline -- docs/_ops/<파일>.jsonl\n`
    + '  ⚠ 충돌이 났다면 답은 «하나 고르기»가 아니라 **둘 다 남기기**다 — 그게 F578 을 증발시킨 손이다.');
});

/* ── F605 후속 ─ 위 축이 «한 벌 통째로» 사라지는 판을 못 보던 자리 (`local_9b74b64b` · 2026-08-18) ──
 * 두 세션이 F605 를 병렬로 잡았다(F070 의 모양). 먼저 착지한 판(`7ea7ddcc` · `local_82d71975`)이
 *   막는 층(.gitattributes union)까지 세워 본류를 끝냈고, 여기 둘은 그 위에 남아 있던 구멍만 얹는다.
 *
 * ㉠ **대상 목록이 `ls-files` 뿐이었다.** 그러면 장부 파일이 통째로 사라질 때 그 벌이 목록에서도
 *   빠져 후보가 0이 되고, 화면에는 「사라짐 0」이 뜬다 — 가장 큰 유실이 가장 조용하다.
 *   이 축이 애초에 막으려던 사고(F195 = 반입이 통째로 덮어쓰기)의 최대판이 정확히 이 모양이다.
 *   ⚠ 넓히는 대가 = 이름 바꾸기가 대량 거짓적색이 될 수 있다. 그래서 추적이 끊긴 경로의 「지금」을
 *     «살아 있는 전체 레코드»로 잡는다 — 판정 단위가 파일이 아니라 레코드이기 때문에 성립한다.
 *
 * ㉡ **F605 자신의 실패 모양이 봉인돼 있지 않았다.** 이 트랙이 고친 것은 「jsonl 이 무보호」가
 *   아니라 «상주 문장과 기계 과녁이 갈라진 것»이고, 그 갈라짐은 조용하다 — 문장은 계속
 *   「막아 준다」고 말하고 검사는 계속 초록이다. 과녁을 다시 좁히면 그때는 무엇이 우는가?
 *   지금까지는 **아무것도 안 울었다**. 그래서 둘을 한 검사에 묶는다.
 *   ⚠ 산문을 «파싱»하지 않는다 — 표현이 조금만 바뀌어도 「대상 0건」으로 새고 그 방향이 통과다.
 *     맡긴 대상을 여기 **값으로 못박고** 양방향(문장에 있나 · 과녁에 닿나)을 둘 다 단언한다. */

test('🔑 F605 탐지 — 장부를 통째로 지워도 잡는다 (`ls-files` 만 보면 최대 유실이 가장 조용하다)', () => {
  const d = j픽스처([j판([1, 2])]);
  fs.rmSync(path.join(d, J장부));
  git(d, 'add', '-A'); 커밋(d, '장부를 통째로 지운다');
  assert.deepStrictEqual(j판정(d), [{ 파일: path.basename(J장부), 사라짐: 2, 뒤처짐: 0 }]);
  치우기(d);
});

test('🔑 F605 거짓양성 — 장부 이름만 바뀌면 유실이 아니다 (판정 단위는 파일이 아니라 «레코드»다)', () => {
  const d = j픽스처([j판([1, 2])]);
  const 새경로 = 'docs/_ops/심문기록_v2.jsonl';
  git(d, 'mv', J장부, 새경로); 커밋(d, '장부 이름을 바꾼다');
  assert.deepStrictEqual(j판정(d), [],
    '이름만 바뀌었는데 유실로 읽었다 — 넓힌 대상 목록이 거짓적색을 낳으면 그 검사는 곧 꺼진다(F103)');
  /* 경계 — 이름을 바꾼 «뒤에» 레코드를 지우면 그건 그대로 유실이어야 한다.
   * 이게 없으면 위 단언은 「이름이 바뀐 벌은 통째로 안 본다」로도 통과한다(맹점 ②).
   * ⚠ 사라진 레코드는 **그것을 들고 있던 경로마다** 한 번씩 선다(옛 이름·새 이름 둘 다).
   *   중복이 아니라 목록이다 — 복원할 때 어느 판의 어느 경로를 뒤져야 하는지가 그것이라 안 접는다. */
  fs.writeFileSync(path.join(d, 새경로), j판([1]));
  git(d, 'add', '-A'); 커밋(d, '옮긴 장부에서 한 줄을 지운다');
  assert.deepStrictEqual(j판정(d), [
    { 파일: path.basename(J장부), 사라짐: 1, 뒤처짐: 0 },
    { 파일: path.basename(새경로), 사라짐: 1, 뒤처짐: 0 },
  ]);
  치우기(d);
});

/* 정본이 이 파일에 맡긴 대상 — 산문에서 파싱하지 않고 값으로 못박는다(위 ㉡의 ⚠) */
const 맡긴대상 = [
  { 낱말: '마찰신호.md', 닿나: () => 장부.endsWith('마찰신호.md') },
  { 낱말: '심문기록', 닿나: (ps) => ps.some((p) => p.includes('심문기록')) },
  { 낱말: '결정록', 닿나: (ps) => ps.some((p) => p.includes('결정록')) },
];

test('🔴 F605 실 저장소 — CLAUDE.md 가 이 파일에 맡긴 대상을 이 검사가 «실제로» 잰다', () => {
  const 문장 = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8')
    .split(/\r?\n/).find((l) => l.includes('장부유실.test.js'));
  assert.ok(문장,
    'CLAUDE.md 가 이 파일을 더는 안 짚는다 — 문장을 지웠거나 옮겼다면 이 검사의 존재 이유도 같이\n'
    + '  판정해야 한다. 조용히 초록이 되는 것이 F605 였다.');

  const 경로들 = jsonl장부들(REPO);
  for (const { 낱말, 닿나 } of 맡긴대상) {
    assert.ok(문장.includes(낱말),
      `CLAUDE.md 의 그 문장이 「${낱말}」을 더는 안 든다 — 표현을 바꿨으면 이 목록도 같이 바꾼다.\n`
      + `  안 그러면 이 검사가 «없는 약속»을 지키게 된다(그 반대가 F605 였다).\n  문장: ${문장}`);
    assert.ok(닿나(경로들),
      `CLAUDE.md 가 「${낱말}」을 이 파일에 맡겼는데 과녁이 그것에 안 닿는다 — F605 가 정확히 이 모양이었다.\n`
      + `  지금 jsonl 과녁(${jsonl과녁}) 이 잡은 것 ${경로들.length}벌: ${경로들.map((p) => path.basename(p)).join(' · ')}`);
  }
});
