#!/usr/bin/env node
'use strict';
/* repo-staleness — 내가 보고 있는 판이 `origin/master` 보다 얼마나 낡았나 (PreToolUse: Edit|Write|MultiEdit).
 *
 * 🔴 2026-08-07 실측(F192)이 이 훅의 존재 이유다. 클라우드(폰) 세션이 clone 시점 판으로 일하는 동안
 *   PC 세션들이 master 를 밀었다: 폰 브랜치가 **34 커밋 뒤 · 36분 전 판**인 채로 `docs/세션보드.md` 를
 *   편집했다. 그대로 반입하면 그 사이 남이 쓴 보드 줄이 **삭제로** 실린다(F187 과 같은 형태).
 *
 * 🔑 왜 로컬 충돌 장치로는 못 잡나 — `작업본소유자.js`·`track-collision.js` 는 **이 기계의**
 *   파일 mtime 과 세션 로그를 읽는다. 클라우드 세션의 작업 트리는 다른 기계에 있어서, 그 둘은
 *   폰을 **원리상** 못 본다(반대도 같다). 기계를 건너 남는 유일한 흔적은 커밋뿐이고, 커밋은
 *   `origin` 을 통해서만 보인다. 그래서 이 훅은 파일이 아니라 **ref 거리**를 잰다.
 *
 * 🔑 발화 자리를 Edit·Write 로 고른 이유: 뒤처짐이 사고로 바뀌는 순간은 「편집을 시작할 때」다.
 *   SessionStart 는 못 쓴다 — 클라우드 세션은 **시작 시점엔 최신**이고, 뒤처짐은 30분 뒤에 생긴다.
 *   커밋 시점은 늦다(이미 뒤처진 판 위에서 다 만든 뒤다).
 *
 * ⚠ **가드가 아니라 알림이다** — 절대 작업을 세우지 않는다. 뒤처짐은 차단 사유가 아니고,
 *   차단하면 폰 세션이 아무것도 못 한다. 알면 스스로 fetch 한다.
 *
 * ⚠ 침묵 조건은 **뒤처짐 0** 하나다. 실측상 PC 세션은 작업 트리를 공유해 거의 항상 0이라
 *   소음이 안 난다 — 울리는 것은 기계를 건넌 판뿐이다.
 *
 * ⚠ repo 밖 환경(네트워크·origin)에 기대므로 CI 에서는 잴 것이 없다 — 그때는 **조용히 통과**하고
 *   탐지력은 픽스처 회귀(`tests/저장소뒤처짐.test.js`)가 진다.
 *
 * 🔴 2026-08-07 두 번째 실측(F208)이 범위를 넓혔다 — 낡음만이 아니라 **진행 중인 git 작업**도
 *   같은 사고 통로다: 남의 세션이 시작한 rebase 의 autostash 가 이 트리의 미커밋 편집 3파일을
 *   걷어가 HEAD 판으로 되돌렸고, 발각 단서는 「diff --stat 이 비어 있음」 하나였다. 못 돌려준
 *   잔재는 stash 에 갇히는데(19:13 실측: 7파일) 어느 층도 주인에게 알리지 않는다.
 *   그래서 둘을 더 본다: ①진행 중 작업 — 스로틀 **앞**, 매 편집(분 단위로 끝나는 상태라 조용한
 *   창 5분 뒤에 두면 정확히 위험한 그 순간에 침묵한다) ②autostash 잔재 — 측정 주기·세션당 1회
 *   (몇 시간을 사는 상태라 매번 울리면 홍수고, 홍수는 「아무도 안 읽음」이다).
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require('./lib/board-id.js');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const 기준 = 'origin/master';
/* 🔴 **이 상수가 4일간 죽은 경로를 가리켰다** (2026-08-12 실측 · F250 이주의 낙진).
 *   보드 정본은 08-08 에 세션별 파일(`docs/_ops/보드/<지문>.md`)로 갈렸고 옛 `docs/세션보드.md`
 *   는 안내 스텁이 됐다. 그런데 여기가 안 따라가서 `보드변경` 이 **구조적으로 0** 이었다 —
 *   08-08 이후 옛 경로 커밋 **0** · 새 폴더 **858**. 알림 한 갈래가 조용히 꺼졌고, 그 침묵은
 *   「보드가 안 바뀌었다」와 화면에서 **같은 모양**이라 아무도 못 봤다(새는 방향은 언제나 통과).
 *   곁들여 본문이 처방하던 `git log … -- <보드>` 도 늘 빈 출력이었다 — 따를 수 없는 처방(F103).
 *   🔑 폴더로 잰다(파일 하나가 아니다) — 세션마다 파일이 갈리므로 파일 단위로는 원리상 못 센다.
 *   ⚠ 여기 손으로 다시 적었지만 **`tools/lib/보드.js` 의 `폴더()` 와 같아야 한다** — 다음 이주
 *     때 또 남지 않게 `tests/저장소뒤처짐.test.js` 가 둘의 일치를 기계로 잰다(require 를 이
 *     hot-path 훅에 물리는 대신 탐지를 회귀가 진다). */
const 보드 = 'docs/_ops/보드';
/* fetch 는 네트워크라 매 편집마다 물릴 수 없다. 5분 = 실측 세션보드 변경 간격 중앙값(3분)보다
 * 조금 길게 — 더 짧게 잡아도 얻는 것이 없고, 더 길면 그 사이 보드가 두 번 넘게 바뀐다. */
const 조용한간격_MS = 5 * 60 * 1000;

function g(args, cwd, ms = 5000) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout: ms, stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/** 뒤처짐 판정 — **정본 1개**. 회귀는 사본을 들지 말고 이 함수를 부른다(F045: 갈라지면 통과 쪽으로 샌다).
 *  반환: null = 잴 수 없음(origin 없음·git 아님) · `{ 뒤: 0 }` = 최신 · `{ 뒤, 나이분, 보드변경 }`.
 *  `fetch:false` 는 **테스트 전용 이음매**가 아니다 — 네트워크가 없는 환경에서도 로컬 ref 로 재라는 뜻이다. */
function 재다(cwd, { fetch: 가져오나 = true } = {}) {
  try { g(['rev-parse', '--verify', '--quiet', `${기준}^{commit}`], cwd); }
  catch (_) { return null; }   // origin/master 가 없으면 잴 것이 없다
  if (가져오나) {
    // 못 가져와도 판정은 한다 — 로컬 ref 로만 재면 뒤처짐을 **작게** 본다(안전한 방향은 아니지만 조용한 실패보단 낫다)
    try { g(['fetch', 'origin', 'master', '--quiet'], cwd, 8000); } catch (_) { /* 네트워크 없음 */ }
  }
  let 뒤;
  try { 뒤 = Number(g(['rev-list', '--count', `HEAD..${기준}`], cwd)); }
  catch (_) { return null; }
  if (!Number.isFinite(뒤) || 뒤 === 0) return { 뒤: 0 };

  let 나이분 = null;
  let 보드변경 = null;
  try {
    /* 나이는 **HEAD 시각이 아니라 갈라진 지점**부터 잰다 — 내 커밋이 새것이어도 내가 **보고 있는 판**은
     * 갈라진 그 시점이다. HEAD 로 재면 방금 커밋한 폰 세션이 「0분 전 판」으로 나온다. */
    const mb = g(['merge-base', 'HEAD', 기준], cwd);
    const 끝 = Number(g(['log', '-1', '--format=%ct', 기준], cwd));
    const 시작 = Number(g(['log', '-1', '--format=%ct', mb], cwd));
    if (Number.isFinite(끝) && Number.isFinite(시작)) 나이분 = Math.round((끝 - 시작) / 60);
  } catch (_) { /* 부가 정보다 — 없어도 알린다 */ }
  try { 보드변경 = Number(g(['rev-list', '--count', `HEAD..${기준}`, '--', 보드], cwd)); }
  catch (_) { /* 같다 */ }
  return { 뒤, 나이분, 보드변경 };
}

/** 알림 본문 — 숫자만 주면 무엇을 할지 모른다. **다음 한 수**를 같이 준다(F055: 셀 수 있는 단위로). */
function 본문(r) {
  const 곁 = [
    // 0분은 정보가 아니다 — 「0분 전 판인데 8커밋 뒤」는 사람을 멈춰 세운다(발화 실측에서 나왔다).
    // 이 저장소는 커밋 간격 중앙값 1분이라 **짧은 시간에 많이 뒤처지는** 것이 정상이다.
    r.나이분 ? `${r.나이분}분 전 판` : null,
    r.보드변경 ? `그 사이 세션보드 **${r.보드변경}번** 바뀜` : null,
  ].filter(Boolean).join(' · ');
  return `[repo-staleness] 내 판이 \`${기준}\` 보다 **${r.뒤} 커밋 뒤**다${곁 ? ` (${곁})` : ''}.\n\n`
    + '지금 편집을 시작하면 **다른 세션이 이미 잡은 트랙**을 모르고 고르게 된다 — 이 저장소는\n'
    + '커밋 간격 중앙값 1분·세션보드 3분이라(2026-08-07 실측), 뒤처짐은 곧 「남이 뭘 하는지 모름」이다.\n'
    + '뒤처진 판 위의 공유 문서 편집은 반입될 때 남의 줄을 **삭제로** 싣는다(F187·F192).\n\n'
    + '→ 트랙을 고르기 전에:\n'
    + `   git fetch origin master && git log --oneline HEAD..${기준} -- ${보드}\n`
    /* ⚠ [2026-08-18 유호 교정] 「클라우드(폰) 세션」이라 부르던 자리 — 폰으로 작업하는 것이 없다.
     *   이 처방이 실제로 겨누는 것은 `claude/*` 로 push 하는 **클라우드(웹) 세션**이다(F623).
     *   위 머리말의 08-07 역사 서술은 사실이라 그대로 둔다. */
    + '→ 클라우드 세션이면 `claude/*` 브랜치라 master 로 직접 못 민다 — 코드보다 **판정·읽기**에 쓴다.';
}

/** 진행 중 git 작업 — F208 의 사고 통로. 상태 파일은 **per-worktree** git-dir 에 있다
 *  (`--absolute-git-dir` 가 워크트리면 자기 방을 준다 — 메인의 rebase 는 워크트리 파일을 안 쓸므로
 *  방을 섞으면 거짓 경보가 된다). 반환: 작업 이름 또는 null. */
function 진행중작업(cwd) {
  let 방;
  try { 방 = g(['rev-parse', '--absolute-git-dir'], cwd); } catch (_) { return null; }
  if (fs.existsSync(path.join(방, 'rebase-merge')) || fs.existsSync(path.join(방, 'rebase-apply'))) return 'rebase';
  if (fs.existsSync(path.join(방, 'MERGE_HEAD'))) return 'merge';
  if (fs.existsSync(path.join(방, 'CHERRY_PICK_HEAD'))) return 'cherry-pick';
  if (fs.existsSync(path.join(방, 'REVERT_HEAD'))) return 'revert';
  return null;
}

/** 잔재 조각별 「잃은 것인가」 — **F219 가 여기서 났다.** 첫 판은 제목이 autostash 인지만 보고
 *  「그 세션의 작업이 갇혀 있다」를 **단정**했다. 실측(08-07 stash@{0}): 7조각 중 고유 작업은 0이었고
 *  (2 랜딩·2 삭제·3 공유문서 구판) 그 단정 때문에 세션마다 같은 대조를 처음부터 다시 했다.
 *
 *  🔑 **단정할 수 있는 것은 「안 잃었다」쪽뿐이다** — blob 이 HEAD 와 같으면 그 조각은 확실히 살아 있고,
 *    삭제 조각은 실을 내용이 없다. 다르면 「랜딩된 뒤 더 고쳐졌다」와 「진짜 갇혔다」가 **같은 모양**이라
 *    기계는 모른다(실측: decision-queue.js 는 본문이 HEAD 에 있는데 그 뒤 커밋으로 blob 이 갈라졌다).
 *    그래서 셋으로 낸다 — 삭제·동일·모름. 「모름」을 「갇힘」으로 쓰면 F219 를 되살리는 것이다.
 *
 *  ⚠ 경로 목록은 `-z` 로 받는다 — quotepath 가 켜지면 한글 경로가 이스케이프돼 `rev-parse ref:경로` 가
 *    통째로 빗나가고, 빗나간 조각은 「모름」으로 흘러 **거짓 경보 쪽**으로 샌다(F045). */
function 잔재조각(cwd, ref) {
  let 이름들;
  try { 이름들 = g(['diff', '--name-only', '-z', `${ref}^`, ref], cwd); } catch (_) { return []; }
  return 이름들.split('\0').filter(Boolean).map((경로) => {
    let 내것;
    try { 내것 = g(['rev-parse', `${ref}:${경로}`], cwd); } catch (_) { return { 경로, 상태: '삭제' }; }
    let 지금 = null;
    try { 지금 = g(['rev-parse', `HEAD:${경로}`], cwd); } catch (_) { /* HEAD 에 없는 조각 */ }
    return { 경로, 상태: 지금 === 내것 ? '동일' : '모름' };
  });
}

/** rebase --autostash 가 되돌려주지 못한 잔재 — 누군가의 미커밋이 갇혀 있다(F208 실측 19:13).
 *  stash 는 저장소 전역이라 어느 워크트리에서 봐도 같다. 일반 stash(주인이 일부러 둔 것)는 안 센다. */
function 갇힌스태시(cwd) {
  let 줄들;
  try { 줄들 = g(['stash', 'list', '--format=%H %gd %gs'], cwd); } catch (_) { return []; }
  if (!줄들) return [];
  return 줄들.split('\n').map((l) => {
    const m = l.match(/^([0-9a-f]{40}) (stash@\{\d+\}) (.*)$/);
    return m ? { 해시: m[1], ref: m[2], 제목: m[3] } : null;
  }).filter((s) => s && /(^|: )autostash$/.test(s.제목));
}

function 진행중본문(작업) {
  return `[repo-staleness] 이 작업 트리에 **${작업} 진행 중**이다 — 남의 세션이 시작한 것일 수 있다\n`
    + '(F208 실측: 남의 rebase 의 autostash 가 진행 중이던 세션의 미커밋 3파일을 조용히 HEAD 판으로 되돌렸다).\n'
    + '지금 편집하면 ①그 작업이 끝날 때 편집이 쓸리거나 ②자동커밋이 detached HEAD 위에 떠 master 밖에 남는다.\n\n'
    + '→ `git status` 전문으로 어느 작업인지 본다 · 남의 것이면 끝날 때까지 이 트리의 편집을 멈춘다.\n'
    + `→ 내가 끝내야 하면 abort 금지(남의 미커밋을 쓸어간다) — 필요한 것을 커밋한 뒤 \`git ${작업} --quit\`(상태만 접고 파일은 그대로).`;
}

/** 잔재 알림 — **조각을 세어서 보여준다**(F219). 옛 판은 「작업이 갇혀 있다」를 단정하고 `-p` 를 시켰다:
 *  단정은 실측에서 틀렸고(고유 작업 0), `-p` 는 수천 줄이라 세션마다 같은 대조를 처음부터 다시 했다.
 *  ⚠ 목록은 잘라 낸다 — 알림이 길면 안 읽히고, 안 읽히는 알림은 없는 것과 같다(이 파일의 「소음은 알림을 죽인다」). */
const 조각표시상한 = 8;
function 잔재본문(잔재들) {
  const 줄 = [];
  for (const s of 잔재들) {
    const 모름 = (s.조각 || []).filter((c) => c.상태 === '모름');
    const 안잃음 = (s.조각 || []).length - 모름.length;
    줄.push(`· ${s.ref} — 대조가 필요한 조각 **${모름.length}개**`
      + (안잃음 ? ` (나머지 ${안잃음}개는 HEAD 와 같거나 삭제라 잃은 것이 없다)` : ''));
    for (const c of 모름.slice(0, 조각표시상한)) 줄.push(`    ${c.경로}`);
    if (모름.length > 조각표시상한) 줄.push(`    …외 ${모름.length - 조각표시상한}개`);
  }
  return `[repo-staleness] stash 에 **autostash 잔재 ${잔재들.length}건** — 누군가의 rebase 가 그 순간의\n`
    + '미커밋을 걷어갔다가 되돌려주지 못한 것이다(F208). 아래는 **HEAD 와 달라 대조가 필요한** 조각이다.\n'
    + '「진짜 갇힌 작업」인지 「랜딩된 뒤 더 고쳐진 것」인지는 기계가 못 가른다 — 거기까지만 안다(F219).\n\n'
    + `${줄.join('\n')}\n\n`
    + `→ 무엇이 다른지: \`git stash show --stat ${잔재들[0].ref}\` (\`-p\` 전문은 수천 줄이다 — 조각을 골라 본다)\n`
    + '→ `pop` 은 대조 전 금지 — 지금 작업본과 겹치면 그대로 덮는다. 필요한 조각만 살린다.\n'
    + `→ **대조해서 살릴 것이 없으면 그 stash 를 없앤다**(\`git stash drop ${잔재들[0].ref}\`) — 안 없애면\n`
    + '   다음 세션들이 같은 대조를 처음부터 다시 한다. 파괴 하위명령을 가드가 막으면 그 사유문의 통로를 따른다.';
}

module.exports = { 재다, 본문, 진행중작업, 갇힌스태시, 잔재조각, 진행중본문, 잔재본문, 조용한간격_MS, 기준, 보드 };

if (require.main !== module) return;

let 입력 = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { 입력 += c; });
process.stdin.on('end', () => {
  let ev = {};
  try { ev = JSON.parse(입력 || '{}'); } catch (_) { process.exit(0); }
  const cwd = ev?.cwd || ROOT;

  /* F208 ① — 진행 중 작업은 스로틀 **앞**에서 본다. 순서가 내용이다: 조용한 창(5분) 뒤에 두면
   * 분 단위로 끝나는 이 상태를 정확히 위험한 그 순간에 놓친다. 검사 비용은 로컬 fs 몇 번뿐이다. */
  let 작업 = null;
  try { 작업 = 진행중작업(cwd); } catch (_) { /* 판정 실패는 기존 침묵 방향 */ }
  if (작업) {
    process.stdout.write(JSON.stringify({
      systemMessage: `⚠ 이 작업 트리에 ${작업} 진행 중 — 지금 편집은 쓸릴 수 있다 (F208)`,
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 진행중본문(작업) },
    }));
    process.exit(0);
  }

  /* throttle — 못 쓰면 **매번 검사한다**(느릴 뿐 안전한 방향). 조용히 안 재는 쪽으로 새면
   * 통과와 미실행이 같은 모양이 된다(F193 이 정확히 그 자리에서 났다). */
  let 표 = null;
  let 지난 = {};
  try {
    const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
    표 = path.join(store.stateDir(),
      `staleness-${store.projectKey(cwd)}-${store.safeId(보드id.세션id() || 'nosid')}.json`);
    try { 지난 = JSON.parse(fs.readFileSync(표, 'utf8')) || {}; } catch (_) { 지난 = {}; }
    const 최근 = Number(지난.at);
    if (Number.isFinite(최근) && Date.now() - 최근 < 조용한간격_MS) process.exit(0);
  } catch (_) { /* store 를 못 불러도 잰다 */ }

  let r;
  try { r = 재다(cwd); } catch (_) { process.exit(0); }

  /* F208 ② — autostash 잔재는 측정 주기에 실린다. 같은 잔재는 **세션당 1회**(stash 해시로 기억) —
   * 몇 시간을 사는 상태라 5분마다 다시 울리면 홍수가 되고, 홍수는 「아무도 안 읽음」이다. */
  const 알린잔재 = Array.isArray(지난.잔재) ? 지난.잔재 : [];
  let 본잔재 = [];
  let 새잔재 = [];
  try {
    본잔재 = 갇힌스태시(cwd);
    새잔재 = 본잔재
      .filter((s) => !알린잔재.includes(s.해시))
      .map((s) => ({ ...s, 조각: 잔재조각(cwd, s.ref) }))
      /* 조각이 전부 「동일·삭제」면 잃은 것이 하나도 없다 — 그 잔재로 사람을 부르지 않는다(F219).
       * 조각을 못 읽었으면(빈 배열) 조용해지는 쪽이 아니라 **알리는 쪽**으로 남긴다. */
      .filter((s) => !s.조각.length || s.조각.some((c) => c.상태 === '모름'));
  } catch (_) { /* 부가 신호다 */ }

  if (표) {
    try {
      fs.mkdirSync(path.dirname(표), { recursive: true });
      /* 도장은 **본 것 전부**에 찍는다(조용히 넘긴 잔재도) — 안 찍으면 HEAD 가 움직여 「동일」이던
       * 조각이 「모름」으로 바뀌는 순간 같은 잔재가 부활해 다시 운다. */
      fs.writeFileSync(표, JSON.stringify({
        at: Date.now(),
        잔재: [...new Set([...알린잔재, ...본잔재.map((s) => s.해시)])],
      }));
    } catch (_) { /* 못 써도 판정은 이미 했다 */ }
  }

  const 낡음글 = r && r.뒤 ? 본문(r) : null;
  const 잔재글 = 새잔재.length ? 잔재본문(새잔재) : null;
  if (!낡음글 && !잔재글) process.exit(0);   // 최신·잔재 없음·잴 수 없음이면 조용히 — 소음은 알림을 죽인다

  process.stdout.write(JSON.stringify({
    systemMessage: 낡음글
      ? `⚠ 내 판이 ${기준} 보다 ${r.뒤} 커밋 뒤다`
      : `⚠ stash 에 autostash 잔재 ${새잔재.length}건 — 누군가의 미커밋이 갇혀 있다 (F208)`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: [낡음글, 잔재글].filter(Boolean).join('\n\n'),
    },
  }));
  process.exit(0);
});
