// worktrees — 「이 저장소에 딸린 작업 트리가 몇 개고, 남들은 지금 무엇을 들고 있나」
//
// 왜 있나 (F079 · 2026-08-04):
//   세션 둘이 **같은 시각 같은 파일 두 개**를 각자 고쳤다(F076 수리). 한쪽은 메인 저장소,
//   한쪽은 `.claude/worktrees/…` 워크트리였고, 서로를 감지하는 장치가 셋이나 있었는데
//   **셋 다 못 봤다.** 같은 트랙 병렬 4번째다(F070 · 크루카드 포크 · F073 · 이번).
//
//   🔑 왜 못 봤나 — 셋 다 「메인 작업 트리만이 이 저장소다」라고 가정했다:
//     · track-collision  → `master` 착지 커밋만 본다. 워크트리가 커밋 안 했으면 아무것도 없다.
//     · 작업본소유자      → 메인의 `git status` 만 본다. **다른 작업 트리의 미커밋은 안 나온다.**
//     · 상태 폴더 접두    → 🔴 이게 가장 깊다. 키가 cwd 해시라 메인과 워크트리가 **다른 키**를
//        받는다(실측 `cec367f48f` vs `1fc2df68ae`). 그래서 두 세션은 심장박동도 만진 파일도
//        서로 안 보인다 — 감지기를 아무리 고쳐도 **재료 자체가 갈라져 있었다.**
//
//   그리고 `.claude/worktrees/` 는 `.git/info/exclude` 에 있어 메인 눈에 아예 안 띈다.
//   저장소 **안**에 있는데 git 이 못 보는 자리 — CLAUDE.md 가 가장 위험하다고 적어둔 그 형태고,
//   `info/exclude` 는 커밋되지 않는 로컬 파일이라 기계마다 다르게 동작하기까지 한다.
//
// 🔑 정보가 없었던 게 아니다. 워크트리는 **`.git` 을 공유한다** — `git worktree list` 가
//    처음부터 전부 알고 있었다. 아무도 안 물어봤을 뿐이다(F073 과 같은 결말).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/** 실패를 null 로 돌려주는 git. 이 모듈은 편의지 안전장치가 아니다 — git 사정으로 작업을 세우지 않는다.
 *  `core.quotepath=false` 는 선택이 아니다: 이 저장소 파일은 대부분 한글이라, 없으면 경로가
 *  `"\354\227\224…"` 로 나와 대조가 전부 빗나가고 결과는 **「겹침 없음 = 조용」**이다. */
function git(args, cwd) {
  try {
    const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd, encoding: 'utf8', timeout: 5000, windowsHide: true,
    });
    if (r.error || r.status !== 0) return null;
    return String(r.stdout || '');
  } catch (_) { return null; }
}

/**
 * **메인** 작업 트리의 절대 경로. 워크트리 안에서 물어도 같은 답이 나온다.
 *
 * 🔑 이게 이 모듈의 핵심이다. 상태 폴더 키를 여기에 걸면 메인이든 워크트리든 **같은 키**를 받아
 *    서로가 보인다. 그리고 메인에서 부르면 값이 지금까지와 **완전히 같으므로**, 이미 굴러가는
 *    상태 파일·계약(작업본소유자가 읽는 `track-…json`)이 깨지지 않는다 — 넓히기만 하고
 *    되돌리지 않는 변경이다.
 *
 * 못 알아내면 `cwd` 를 그대로 돌려준다(= 지금까지의 동작). 모름을 새 동작으로 번역하지 않는다.
 */
/**
 * 공통 `.git` 디렉터리. **git 을 부르지 않고 fs 로 먼저 푼다.**
 *
 * ⚠ 왜 fs 냐 — 이 값은 PreToolUse 훅이 **매 편집마다** 필요로 한다. 실측에서
 *   `git rev-parse --git-common-dir` 한 번이 **68ms** 였다. 편집 100번이면 7초를 그냥 태운다.
 *   fs 로는 stat 두 번(<1ms)이면 끝난다 — 규칙이 단순해서다:
 *     · 메인      → `<root>/.git` 이 **디렉터리**다. 그게 곧 공통 디렉터리.
 *     · 워크트리   → `<root>/.git` 이 **파일**이고 `gitdir: …/.git/worktrees/<이름>` 한 줄이다.
 *   못 풀면 git 에 물어보고, 그것도 안 되면 null(=모름).
 */
function gitCommonDir(root) {
  const 기본 = path.resolve(String(root || '.'));
  const p = path.join(기본, '.git');
  try {
    const st = fs.statSync(p);
    if (st.isDirectory()) return p;
    const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(p, 'utf8'));
    if (m) {
      const gd = path.resolve(기본, m[1].trim());          // …/.git/worktrees/<이름>
      const 위 = path.dirname(path.dirname(gd));           // …/.git
      if (path.basename(path.dirname(gd)) === 'worktrees' && fs.existsSync(path.join(위, 'HEAD'))) return 위;
      return gd;                                           // 낯선 배치 — 아는 척하지 않는다
    }
  } catch (_) { /* fs 로 못 풀었다 — 아래에서 git 에 물어본다 */ }

  // --path-format 은 git 2.31+ 다. 없으면 상대 경로가 나올 수 있어 기준으로 푼다.
  const out = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], 기본)
    || git(['rev-parse', '--git-common-dir'], 기본);
  return out && out.trim() ? path.resolve(기본, out.trim()) : null;
}

function mainWorktree(cwd) {
  const 기본 = path.resolve(String(cwd || '.'));
  const 공통 = gitCommonDir(기본);
  if (!공통) return 기본;                                  // 모름 — 지금까지의 동작 그대로
  // 공통 git 디렉터리(`…/.git`)의 부모가 메인 작업 트리다. bare 면 부모가 저장소 자체라 그대로 쓴다.
  const 부모 = path.dirname(공통);
  return 부모 && 부모 !== 공통 ? 부모 : 기본;
}

/**
 * **다른 작업 트리가 있기는 한가** — git 없이 fs 로만(<1ms).
 *
 * 🔑 이 한 줄이 비용 문제를 끝낸다. 실측: 트리 5개에 `othersDirty` 가 **327ms** 다.
 *   그런데 워크트리를 쓰는 세션은 소수고, 나머지는 여기서 `false` 로 즉시 끝난다.
 *   「비싸니까 주기를 길게」가 아니라 **「대부분은 아예 안 돈다」**로 푼다 —
 *   주기를 늘리면 그만큼 못 보는 창이 생기고, 못 보는 창이 곧 F079 다.
 */
function anyOthers(cwd) {
  const 공통 = gitCommonDir(cwd);
  if (!공통) return null;                                  // 모름 — 통과로 번역하지 않는다
  try { return fs.readdirSync(path.join(공통, 'worktrees')).some((n) => !n.startsWith('.')); }
  catch (_) { return false; }                              // 폴더 자체가 없다 = 워크트리 없음
}

/** 같은 자리인가 — 윈도의 대소문자·구분자·끝슬래시 차이로 「남」이 되지 않게 한다. */
function 같은곳(a, b) {
  const n = (s) => path.resolve(String(s || '')).replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
  return n(a) === n(b);
}

/** `git worktree list --porcelain` 을 그대로 읽는다 — 목록을 손으로 조립하지 않는다. */
function all(cwd) {
  const out = git(['worktree', 'list', '--porcelain'], path.resolve(String(cwd || '.')));
  if (out === null) return null;               // 모름 — 빈 배열(=없음)과 구별한다
  const 목록 = [];
  let 지금 = null;
  for (const 줄 of out.split(/\r?\n/)) {
    if (줄.startsWith('worktree ')) {
      if (지금) 목록.push(지금);
      지금 = { path: 줄.slice(9).trim(), head: '', branch: '', detached: false, prunable: false };
    } else if (!지금) continue;
    else if (줄.startsWith('HEAD ')) 지금.head = 줄.slice(5).trim();
    else if (줄.startsWith('branch ')) 지금.branch = 줄.slice(7).trim().replace(/^refs\/heads\//, '');
    else if (줄 === 'detached') 지금.detached = true;
    else if (줄.startsWith('prunable')) 지금.prunable = true;
  }
  if (지금) 목록.push(지금);
  return 목록;
}

/**
 * **나 아닌** 작업 트리들이 지금 들고 있는 미커밋 파일.
 *
 * ⚠ 경로는 각 작업 트리의 **루트 상대**다. 같은 저장소의 다른 체크아웃이라 메인의 상대 경로와
 *   뜻이 같다 — 그래서 그대로 대조할 수 있다(⚰그걸 재던 tests/코드편집가드.test.js 는 삭제됐다 · 08-23 실측).
 * ⚠ `prunable`(디렉터리가 사라진 유령 등록)은 건너뛴다 — 없는 트리에 git 을 부르면 느리기만 하다.
 */
function othersDirty(cwd) {
  const 나 = path.resolve(String(cwd || '.'));
  if (anyOthers(나) === false) return [];    // 🔑 fs 로 먼저 거른다 — 대부분 여기서 끝난다(비용 0)
  const 전부 = all(나);
  if (전부 === null) return null;
  const 결과 = [];
  for (const w of 전부) {
    if (w.prunable || 같은곳(w.path, 나)) continue;
    /* 🔑 `-uall` 이 없으면 **새 폴더의 미추적 파일이 통째로 접힌다** — `?? src/옆트리것.js` 가
     *   `?? src/` 로 뭉쳐 파일이 목록에서 사라진다. 추적 파일의 수정은 멀쩡히 보이므로
     *   **라이브에선 정상으로 보인다**(58ce9737 실측 지적 · F085). 하필 그 사각이 미추적이라
     *   더 나쁘다 — 이력·stash·reflog 어디에도 없는 유일한 무보호 상태다(F025).
     *   같은 자리를 당시 `tools/작업본소유자.js` 도 밟았다(67fecc0 — ⚰그 도구는 08-20 보드 층
     *   철거로 삭제됐고, 「회귀로 잠근다」던 그 회귀도 함께 사라졌다 · 08-23 실측). */
    const out = git(['status', '--porcelain', '-uall'], w.path);
    if (out === null) continue;                 // 그 트리를 못 읽었다 — 조용히 건너뛴다
    const 파일 = out.split(/\r?\n/).filter(Boolean).map((줄) => {
      const p = 줄.slice(3);
      const 뒤 = p.split(' -> ').pop();          // 이름 바뀜: 새 경로가 지금 자리다
      return 뒤.replace(/^"(.*)"$/, '$1');
    });
    if (파일.length) 결과.push({ path: w.path, branch: w.branch || (w.detached ? 'detached' : ''), files: 파일 });
  }
  return 결과;
}

module.exports = { gitCommonDir, mainWorktree, anyOthers, all, othersDirty, 같은곳 };
