// handoff-store — 세션 인계 바통의 **유일한 통로** (context-budget · session-end-handoff · session-handoff 공용)
//
// 왜 모아 뒀나 — 바통을 쓰는 곳이 셋(Stop·SessionEnd)이고 읽는 곳이 하나(SessionStart)다.
//   파일명 규칙·프로젝트 격리·청소가 각 훅에 흩어지면 **한 곳만 고쳐도 조용히 갈라진다**.
//   CLAUDE.md 「3번째 = 원인을 쓸 수 없게 만든다 — 호출부마다 고치는 대신 잘못 쓸 수 없는
//   공용 통로를 만든다」의 적용. 여기 말고 다른 데서 바통 경로를 조립하면 안 된다.
//
// 08-04 실측된 결함 3종이 이 파일의 존재 이유다:
//   ① 바통이 **전역 1개**라 마지막에 쓴 세션이 이겼다 — 🔴에 닿은 세션이 셋인 날,
//      내 인계문이 「구글폼 접수」 트랙 것으로 덮였다. → 세션별 파일로 가른다.
//   ② **프로젝트 격리가 없었다** — tmp 폴더 하나를 모든 저장소가 공유했다.
//      다른 저장소 세션의 인계문을 물면 새 세션이 엉뚱한 트랙을 이어간다. → cwd 키로 가른다.
//   ③ **청소가 없었다** — 상태 파일이 하루 5개씩 영구히 쌓였다. → 읽을 때마다 쓸어낸다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const wt = require(path.join(__dirname, 'worktrees.js'));
// 「형제는 어디 있나」의 정본. 이 파일이 위에서 말하는 「공용 통로」와 같은 조항의 적용이다.
const 형제저장소 = require(path.join(__dirname, '형제저장소.js'));
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require('./board-id.js');

// 이음매는 테스트 격리 전용 — 로직을 끄지 않고 위치만 바꾼다. **세 훅이 같은 이름을 봐야 한다**
// (갈라지면 바통이 안 넘어가고, 증상은 「조용히 아무 일도 안 일어남」이라 눈에 안 띈다).
const STATE_DIR = process.env.SYNK_CTXBUDGET_DIR || path.join(os.tmpdir(), 'synk-context-budget');

const BATON_TTL_MS = 12 * 60 * 60 * 1000; // 인계문: 12시간 넘으면 트랙이 이미 바뀌었다고 본다
const SWEEP_TTL_MS = 24 * 60 * 60 * 1000; // 카운터 등 잡파일: 하루 지나면 지운다

/** cwd → 짧고 안정적인 프로젝트 키. 경로를 그대로 파일명에 쓸 수 없어 해시로 줄인다.
 *
 * ⚠ **구분자를 먼저 통일한다.** 2026-08-04 실측: 같은 저장소인데 `C:/Users/...`(슬래시)와
 *   `C:\Users\...`(백슬래시)가 **서로 다른 키**를 내 상태가 조용히 둘로 갈렸다
 *   (`cec367f48f` vs `de787defcb`). 대소문자·끝슬래시는 이미 지웠는데 구분자만 남아 있었다.
 *   증상은 「아무 일도 안 일어남」이라 눈에 안 띈다 — 이 파일이 존재하는 이유 ②(프로젝트 격리)와
 *   같은 함정의 다른 입구다. 호출부가 `path.resolve` 를 쓰든 리터럴을 쓰든 같은 키여야 한다.
 *
 * 🔴 **그리고 세 번째 입구가 있었다 — 워크트리**(2026-08-04 실측, 유호님 "전에 설정했는데 잘 안 됐다").
 *   `.claude/worktrees/…` 에서 돌던 세션의 바통이 **다른 키**(`1fc2df68ae`)로 떨어져,
 *   메인 저장소 세션의 `take()` prefix 와 안 맞아 **영영 안 집혔다.** 워크트리는 남의 저장소가
 *   아니라 **같은 저장소의 다른 체크아웃**이라 인계는 이어져야 한다. 그때 살아있던 바통 3개 중
 *   메인이 집을 수 있는 것이 **0개**였다 — 증상은 여기서도 「조용히 아무 일도 안 일어남」이다.
 *   `lib/worktrees.js` 가 track-collision 을 고치며 이미 같은 처방을 냈는데(F079) 이 파일만
 *   남아 있었다. CLAUDE.md 「호출부마다 고치는 대신 잘못 쓸 수 없는 공용 통로」의 미적용 자리.
 *
 * ⚠ 메인에서 부르면 값이 **지금까지와 완전히 같다**(worktrees.mainWorktree 계약) — 이미 굴러가는
 *   메인 세션의 상태는 안 깨지고, 워크트리 세션만 같은 키로 합류한다. git 을 못 부르면 cwd 그대로. */
function projectKey(cwd) {
  const base = wt.mainWorktree(cwd);
  const norm = String(base || cwd || '').replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 10);
}

/** 세션 id → 파일명에 쓸 수 있는 꼴.
 *
 * ⚠ **뭉개진 글자는 구분자를 잃는다.** 옛 구현은 `[^A-Za-z0-9_-]` 를 전부 `_` 로 바꿔서,
 *   비ASCII id 둘(`같은세션`·`다른세션`)이 **같은 파일명**(`____`)이 됐다. 그러면 한 세션의
 *   억제 표식이 옆 세션을 통째로 침묵시키고, 증상은 「알림이 안 뜬다」뿐이라 눈에 안 띈다.
 *   실제 id 는 UUID(ASCII)라 지금 터지지는 않지만, 터질 때 조용한 종류라 원천을 막는다.
 *
 * 🔑 **ASCII 만으로 된 id 는 값이 지금과 완전히 같다** — 굴러가는 세션들의 상태 파일은 안 깨진다.
 *   뭉갠 자국이 생겼을 때만 원문 해시 6자를 꼬리로 붙여 서로 다른 이름이 되게 한다. */
function safeId(id) {
  const 원문 = String(id || 'unknown');
  const 안전 = 원문.replace(/[^A-Za-z0-9_-]/g, '_');
  if (안전 === 원문) return 안전.slice(0, 60);
  return 안전.slice(0, 53) + '-' + crypto.createHash('sha1').update(원문).digest('hex').slice(0, 6);
}

function batonName(cwd, sessionId) {
  return `handoff-${projectKey(cwd)}-${safeId(sessionId)}.json`;
}

/* ── 형제 저장소 좌표 (F134·F137 이 남겨 둔 사각 — 「주인 가르기」) ─────────────
 * 이 프로젝트의 트랙은 저장소 **둘**을 함께 만진다(보드 줄 절반이 「SYNK-talk: …」다).
 * 그런데 만진 기록의 좌표는 「ROOT 상대 경로」 하나뿐이었고, ROOT 밖 경로는 쓰는 쪽
 * (track-collision)이 **버렸다** — 그래서 형제 파일의 주인은 언제나 ❔모름이었다.
 * F134 는 「안 보임 → 모름」까지만 올렸고(읽는 쪽 확장), 여기가 그 위 칸이다.
 *
 * 🔑 좌표를 두 곳에 적으면 그 순간 갈라지고, 갈라진 쪽의 증상은 **「전부 모름」**이다 —
 *   쓰는 쪽·읽는 쪽 회귀가 각자 자기 가정을 적어 두므로 **양쪽 다 초록으로 보인다.**
 *   그래서 쓰는 쪽과 읽는 쪽이 아래 셋만 쓴다(여기 말고 다른 데서 좌표를 조립하면 안 된다).
 *
 * ⚠ 접두를 `../` 로 잡는 이유 = `git status` 가 내놓는 저장소 상대 경로는 **절대 `../` 로
 *   시작하지 않는다.** 저장소 이름만 붙이면(`SYNK-talk/…`) 저장소 **안**의 같은 이름 폴더와
 *   글자가 겹쳐 남의 파일을 내 것으로 읽는다 — 그 폴더는 이 저장소에 실제로 있었다(`synk-talk/`).
 *   오귀속은 「내것」 쪽으로 새고, 그건 곧 남의 작업본을 편집해도 된다는 말이 된다(F073). */
const SIBLING_DEFAULT = ['SYNK-talk'];

/** 형제 저장소들 `[{뿌리, 저장소}]`. 자리는 `형제저장소.형제경로()` 하나에서 파생한다 —
 *  「`<root>/../<이름>`」을 손으로 적으면 **워크트리에서 `..` 이 `worktrees/` 를 가리켜** 형제가
 *  통째로 빠지고, 그러면 형제 파일의 주인이 다시 ❔모름이 된다(이 절이 없애려던 바로 그 상태).
 *  이 기계에 없으면 **조용히 빠진다** — CI 엔 형제가 없고, 거기서 없는 것을 못 읽었다고 울면
 *  거짓 경보가 되어 장치가 꺼진다(못 읽은 것과 없는 것은 읽는 쪽이 갈라 말한다).
 *  이음매 `SYNK_OWNER_SIBLINGS` = 테스트 격리 전용. **쓰는 쪽·읽는 쪽이 같은 이름을 봐야 한다** —
 *  이음매가 갈라지면 한쪽 픽스처만 형제를 보고, 계약 검사가 통째로 헛돈다. */
function siblings(root) {
  const 지정 = String(process.env.SYNK_OWNER_SIBLINGS || '').trim();
  const 후보 = 지정
    ? 지정.split(/[;,]/).map((s) => s.trim()).filter(Boolean).map((s) => path.resolve(root, s))
    : SIBLING_DEFAULT.map((n) => 형제저장소.형제경로(root, n));
  const 본 = new Set([path.resolve(root)]);
  const 결과 = [];
  for (const 뿌리 of 후보) {
    if (본.has(뿌리)) continue;
    본.add(뿌리);
    if (!fs.existsSync(path.join(뿌리, '.git'))) continue;
    결과.push({ 뿌리, 저장소: path.basename(뿌리) });
  }
  return 결과;
}

/** 형제 좌표의 접두. 읽는 쪽은 이걸 **벗겨** 그 저장소의 상대 경로로 되돌린다. */
function siblingPrefix(name) { return `../${name}/`; }

/** 절대경로 → 만진 기록의 좌표.
 *  ROOT 안이면 상대 경로 · 형제 안이면 `../<이름>/상대` · 둘 다 아니면 **null**(스크래치패드 등).
 *  ⚠ ROOT 안 판정이 **먼저**다 — 순서를 뒤집으면 형제가 ROOT 하위에 체크아웃된 경우
 *    같은 파일이 두 좌표를 갖고, 그 갈라짐은 「모름」으로만 보인다. */
function touchKey(root, abs) {
  const 안 = path.relative(root, abs);
  if (안 && !안.startsWith('..') && !path.isAbsolute(안)) return 안.replace(/\\/g, '/');
  for (const { 뿌리, 저장소 } of siblings(root)) {
    const rel = path.relative(뿌리, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    return siblingPrefix(저장소) + rel.replace(/\\/g, '/');
  }
  return null;
}

/** 공용 장부 — **모든 세션이 규약상 만지는** 파일. 여기서의 겹침은 충돌이 아니라 정상이다.
 *
 *  왜 lib 에 있나: 겹침을 보는 장치가 둘이고(`track-collision` 만진겹침 · `작업본소유자` 뒤늦은
 *  남의 커밋), 목록을 각자 적으면 갈라진다 — 갈라진 쪽의 증상은 **경고 홍수**이고, 홍수는
 *  「아무도 안 읽음」이라 없는 장치와 같아진다(track-collision 이 신설 당일 실측한 그 자리:
 *  13건 중 11건이 세션보드라 진짜 신호 2건이 묻혔다).
 *
 *  ⚠ `.claude/settings.json` 은 여기 넣지 않는다 — 그건 공용 장부가 아니라 **공유 작업면**이고,
 *    2026-08-04 진짜 충돌이 정확히 거기서 났다. 장부와 작업면을 섞으면 신호를 통째로 버린다. */
const 공용장부 = Object.freeze([
  /* ⚰ 세션보드.md · 세션보드_아카이브.md · 마찰신호.md · 작업대기열.md — **넷 다 08-22 운영
   *   대개편 때 소멸**(트랙 조율이 트랙.md·하네스로 이관). 실측 08-23 전수조사: 파일이 없는데
   *   목록에 남아 넉 줄이 상시 false — 훅이 조용히 무력화돼 있었다(F293 이 고친 병의 파일-소멸판).
   *   죽은 이름을 남기지 않는다 — 되살리려면 그 파일이 실물로 돌아온 커밋에서 한 줄씩. */
  'docs/버전_이력.md',
  /* ⚰ docs/지침_이력.md — 09-02 삭제(CLAUDE.md v10 이 「근거는 git 이력」으로 대체 · 08-22 뒤 등재 0). */
  /* 🔴 현행 공용 장부의 실물은 이 둘이다(CLAUDE.md 「무엇을 정했나 = 결정.md · 무엇이 남았나 =
   *   트랙.md」) — 모든 세션이 규약상 매 확정마다 행을 넣는다. 목록에 없던 동안 이 둘의 정상
   *   겹침이 «충돌»로 세어졌다(F293 대기열 누락과 같은 모양 · 실측 08-23). */
  'docs/_ops/결정.md',
  'docs/_ops/트랙.md',
]);

/** 폴더째 공용인 자리 — 장부 행은 번호별 조각 파일(F250 후반)이라 이름을 다 적을 수 없다.
 *  ⚰ 보드 폴더(docs/_ops/보드/)는 08-22 소멸 — 세션보드 넷과 같은 이관. */
const 공용장부폴더 = Object.freeze(['docs/_ops/장부/']);

/** 🔑 판정은 **여기 하나**다. 위 목록은 track-collision 이 자기 Set 을 따로 들고 있어서
 *  실제로 두 벌이었다 — 이 머리말이 「두 벌로 만들지 않는다」고 적어둔 채로. 보드가 폴더로
 *  갈리면서 정확 일치로는 못 재게 됐고, 그때 한 곳만 고치면 갈라짐이 그대로 실현된다. */
function 공용장부인가(f) {
  const p = String(f || '').replace(/\\/g, '/');
  return 공용장부.includes(p) || 공용장부폴더.some((d) => p.startsWith(d));
}

function stateDir() { return STATE_DIR; }

/* ── 세션 상태 파일과 「끝났다」 도장 ─────────────────────────────────────
 * 🔴 왜 도장이 필요한가 (마찰 F252 · 2026-08-08 실사고): 살았나/죽었나를 **심장박동 하나**로
 *   재고 있었다. 그런데 박동 = 도구 호출이라, 유호님 답을 75분 기다리며 **쉬는 세션**은
 *   죽은 세션과 글자 하나 다르지 않다. 그래서 산 세션 `local_15ab8497` 의 미커밋 11파일이
 *   ⚪유물로 떨어졌고 옆 세션이 그대로 커밋했다(talk 87e7061 · appsscript 1daa329).
 *   임계값(SYNK_OWNER_ALIVE_MIN)을 늘리는 것은 **반대 방향으로만 틀린다** — 쉬는 시간은
 *   위로 열려 있고, 늘릴수록 진짜 유물이 영영 무보호로 남는다(F025).
 * 🔑 그래서 침묵으로 죽음을 **추정**하지 않고, SessionEnd 가 죽음에 **도장**을 찍는다.
 *   도장 없는 침묵은 ⚪(이어받아도 된다)가 아니라 ❔(확인하고 만져라)로 내려간다.
 * ⚠ 강제 종료엔 SessionEnd 가 안 돈다 — 그건 ❔로 남는다. 새는 방향이 「사람이 한 번 본다」라 맞다. */

/** 세션별 만진기록 파일. 쓰는 쪽(track-collision)·도장(session-end)·읽는 쪽이 **여기 하나**를 쓴다
 *  — 이름을 두 곳에 적으면 갈라지고, 갈라진 쪽의 증상은 「도장이 안 보임」 곧 조용한 오판정이다(F206). */
function trackPath(cwd, sessionId) {
  return path.join(STATE_DIR, `track-${projectKey(cwd)}-${safeId(sessionId)}.json`);
}

/** 이 세션이 정상 종료했다고 도장을 찍는다. 파일이 없으면 만들지 않는다 —
 *  만진 기록이 없는 세션은 유물을 남길 수도 없어서, 빈 파일을 만들면 sweep 대상만 늘어난다. */
function markEnded(cwd, sessionId) {
  try {
    const p = trackPath(cwd, sessionId);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    fs.writeFileSync(p, JSON.stringify({ ...j, 끝남: Date.now() }));
    return true;
  } catch (_) { return false; }
}

/* ── 심장박동 (2026-08-12) ──────────────────────────────────────────────────
 * 🔴 무엇이 고장나 있었나 (유호님 「잘 작성돼 있는지」 검토에서 실측):
 *   박동을 쓰는 곳이 `track-collision`(PreToolUse **Edit|Write|MultiEdit**) **하나뿐**이라,
 *   **셸만 돌리는 세션은 박동이 멎었다.** `작업본소유자.살았나` 는 30분을 넘기면 「끝난 세션」으로
 *   보고, 그 세션의 보드 줄은 `죽은착수` 로 잡혀 **다음 세션에게 「이어받아라」로 그려진다**(F073 입구).
 *   검수·심문 한 패스가 실측 20~32분인데(보드 `f9ec8e9d`) 그건 임시 디렉터리에서 돌아
 *   저장소 파일 mtime 반증에도 안 걸린다 — **살아있는 세션이 조용히 죽은 것으로 보인다.**
 *   F264 가 이 병의 「나 자신」 쪽만 고쳤고(자기 증명), 「남이 나를 보는 쪽」은 그대로 남아 있었다.
 *
 * 🔑 읽는 쪽이 보는 박동은 `at` 필드가 아니라 **파일 mtime** 이다(`작업본소유자.세션들`).
 *   그래서 쓰기 자체가 박동이고, `at` 은 같이 맞춰 둔다(두 값이 어긋나면 다음 사람이 헷갈린다).
 * 🔑 좌표(뿌리·세션 id)를 여기 모은다 — `track-collision` 과 규칙이 갈리면 **다른 파일**이 생겨
 *   박동이 둘로 쪼개지고, 증상은 「찍었는데 아무도 못 봄」이다. 회귀가 두 통로의 경로를 대조한다. */

/** 만진기록의 저장소 좌표 — `track-collision:48` 과 같은 규칙. */
function trackRoot() {
  return process.env.SYNK_TRACK_ROOT || path.resolve(__dirname, '..', '..', '..');
}

/** 이 세션의 id — `track-collision:79` 와 같은 우선순위(호스트 id 가 먼저). */
function trackSessionId(input) {
  return String(보드id.보드id() || (input && input.session_id) || '').trim();
}

/** 심장박동만 갱신한다.
 *
 * ⚠ **통째로 덮어쓰지 않는다.** 이 파일에는 `track-collision` 이 쌓은 **만진 기록**이 들어 있고,
 *   그게 날아가면 그 세션은 자기 파일조차 자기 것으로 증명하지 못한다(F264 와 같은 증상·원인만 반대).
 * ⚠ `markEnded` 와 달리 **파일이 없으면 만든다.** 거기는 「유물을 못 남기는 세션에 빈 파일을
 *   만들지 않는다」가 맞지만 여기 목적은 정반대다 — 만진 게 없어도 **살아있다는 사실 자체**를
 *   남이 읽어야 한다. 도장(`끝남`)은 손대지 않는다: 죽음을 되돌리는 건 이 함수의 일이 아니다.
 * @returns {boolean} 찍었나 — 못 찍어도 부르는 쪽(가드)을 죽이지 않는다.
 */
function 박동찍기(input) {
  try {
    const sid = trackSessionId(input);
    if (!sid) return false;                       // id 를 모르면 남의 파일을 만들 위험이 있다
    const p = trackPath(trackRoot(), sid);
    let j = {};
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch (_) { j = {}; }
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ ...j, at: Date.now() }));
    return true;
  } catch (_) { return false; }
}

/** 세션별 단계 카운터(발화 중복 억제용). 프로젝트 키를 붙여 저장소 간 간섭을 막는다. */
function stagePath(cwd, sessionId) {
  return path.join(STATE_DIR, `stage-${projectKey(cwd)}-${safeId(sessionId)}.json`);
}

function readStage(cwd, sessionId) {
  try {
    const j = JSON.parse(fs.readFileSync(stagePath(cwd, sessionId), 'utf8'));
    if (!j.at || Date.now() - j.at > SWEEP_TTL_MS) return 0;
    return Number(j.stage) || 0;
  } catch (_) { return 0; }
}

function writeStage(cwd, sessionId, stage) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(stagePath(cwd, sessionId), JSON.stringify({ stage, at: Date.now(), cwd: String(cwd || '') }));
    return true;
  } catch (_) { return false; }
}

/* ── 편집 지문 — **모델이 직접 쓴 내용**의 바이트 해시 ─────────────────────
 * 쓰는 곳은 `edit-stamp` 훅 하나(PostToolUse), 읽는 곳은 `auto-commit` 하나(Stop).
 *
 * 왜 여기 있나 (마찰 F225 · 2026-08-07 실사고): 자동커밋은 「내가 만진 파일」을 커밋하는데
 *   만진 기록(track-collision)은 **PreToolUse** 라 「편집하려 했다」까지만 안다. 그 뒤 디스크에
 *   무엇이 놓였는지는 아무도 안 봤고, 그래서 변이 시험이 놓아 둔 **일부러 깨뜨린 판**이 그대로
 *   커밋됐다(c3c8d98 — 커밋 제목은 「미커밋 노출 차단」이라 정상 보호처럼 보였다).
 *   자동커밋 머리말은 이미 「Bash·외부 앱이 만든 변경은 원리적으로 못 가른다」고 적어 뒀다 —
 *   없던 것은 판정이 아니라 **기록**이다.
 *
 * ⚠ 해시·경로·형식을 훅 두 곳에 적으면 그 순간 갈라지고, 갈라진 쪽의 증상은 「무기록」,
 *   곧 **조용히 아무것도 안 실림**이다(맹점 ④). 그래서 넷 다 여기 하나에서만 나온다. */
function 편집지문계산(abs) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex'); } catch (_) { return null; }
}

/** 이 파일이 **실행조차 안 되는가** — `.js` 계열은 구문검사, `.json` 은 파싱. 그 밖은 판정 대상이 아니다.
 *
 * 왜 여기 있나 (마찰 F239 · 2026-08-08 실측):
 *   원래 자동커밋 안에만 있었다 — 「깨진 판을 master 로 안 보낸다」. 그런데 같은 물음이
 *   **편집 직후**에도 필요하다. 훅 파일이 깨지면 등록층의 F044 방어(`command -v node` ·
 *   `[ -f "$H" ]`)를 **그대로 통과**한다 — 파일은 멀쩡히 있으니까. 그 다음 `node "$H"` 가
 *   exit 1 + 빈 stdout 으로 죽고, 하네스는 빈 출력을 **통과**로 읽는다. 즉 그 순간부터
 *   그 가드가 조용히 열린다(실측: board-guard.js 에 `let 이전` 이 두 번 선언된 3분).
 *   F044 는 「실행 불가는 deny 로 드러낸다」였는데, 등록층은 그것을 **파일 존재**로 근사했다.
 * ⚠ 대상 목록을 두 곳에 적으면 갈라지고, 갈라진 쪽의 증상은 「깨진 걸 못 본다」 = 통과다(맹점 ④).
 * ⚠ 구문이 멀쩡한 것과 **옳은** 것은 다르다 — 변이는 문법을 지킨 채 의미만 죽인다.
 *   이 함수는 「실행조차 안 된다」만 재고, 그 이상은 지문(F225)과 테스트가 진다. */
function 구문깨졌나(abs) {
  if (/\.(js|mjs|cjs)$/i.test(abs)) {
    const c = require('child_process').spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    return !!(c.error || c.status !== 0);
  }
  // 깨진 settings.json 이 실리면 **다음 세션의 훅 전체**가 죽는다 — 같은 무게로 본다.
  if (/\.json$/i.test(abs)) {
    try { JSON.parse(fs.readFileSync(abs, 'utf8')); return false; } catch (_) { return true; }
  }
  return false;
}

function 편집지문경로(cwd, sessionId) {
  return path.join(STATE_DIR, `editstamp-${projectKey(cwd)}-${safeId(sessionId)}.json`);
}

/** `{좌표: 해시}` — 좌표는 `touchKey` 와 **같은 공간**(형제는 `../이름/` 접두).
 *  없거나 낡았으면 빈 객체다. 읽는 쪽은 무기록을 「모름」으로 다뤄야 한다 — 모름은 커밋하지 않는다. */
function 편집지문읽기(cwd, sessionId) {
  try {
    const j = JSON.parse(fs.readFileSync(편집지문경로(cwd, sessionId), 'utf8'));
    if (!j || !j.at || Date.now() - Number(j.at) > SWEEP_TTL_MS) return {};
    return (j.지문 && typeof j.지문 === 'object') ? j.지문 : {};
  } catch (_) { return {}; }
}

/** 한 좌표만 얹는다(나머지 좌표는 보존). 못 써도 조용히 false — 편집은 이미 끝났고,
 *  읽는 쪽이 「무기록=안 싣는다」로 떨어져 안전한 방향으로 실패한다. */
function 편집지문쓰기(cwd, sessionId, 좌표, 해시) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const 지문 = { ...편집지문읽기(cwd, sessionId), [좌표]: 해시 };
    fs.writeFileSync(편집지문경로(cwd, sessionId), JSON.stringify({ at: Date.now(), 지문 }));
    return true;
  } catch (_) { return false; }
}

/** 인계문 블록을 이 세션에서 **이미 지시했는지**. 처음 부른 쪽만 true (F122).
 *
 * 블록을 지시하는 훅이 둘이다 — context-budget(Stop, 300k 도달) · track-boundary(커밋 착지, 300k 이상).
 * 임계가 같은 값이라 한 세션에서 **둘 다** 울고, 서로를 몰라 유호님 화면에 같은 블록이 두 번 나갔다
 * (유호님 08-06: "마지막쯤 한번, 마지막에 또 한번"). 판정을 두 곳에 적으면 갈라지므로 상태는
 * 여기 하나에 둔다 — 이 파일이 존재하는 이유(③ 흩어진 규칙)와 같은 형태다.
 *
 * ⚠ 못 쓰면 **true(=지시한다)** 로 답한다. 중복이 침묵보다 낫다 — 블록이 안 나가면 인계가 통째로 빈다.
 */
function claimBlock(cwd, sessionId) {
  const p = path.join(STATE_DIR, `block-${projectKey(cwd)}-${safeId(sessionId)}.json`);
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j && Number(j.at) && Date.now() - Number(j.at) <= SWEEP_TTL_MS) return false;
  } catch (_) { /* 없거나 못 읽으면 아직 안 나간 것으로 본다 */ }
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ at: Date.now(), cwd: String(cwd || '') }));
  } catch (_) { /* 못 써도 지시는 낸다 */ }
  return true;
}

/** 오래된 파일을 지운다. 읽기·쓰기 어느 쪽에서 불러도 되게 **조용히 실패**한다. */
function sweep() {
  let removed = 0;
  let files;
  try { files = fs.readdirSync(STATE_DIR); } catch (_) { return 0; }
  for (const f of files) {
    const p = path.join(STATE_DIR, f);
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      // 옛 형식은 나이와 무관하게 버린다 — 전역 `handoff.json`(트랙이 섞이던 그 파일)과
      // 프로젝트 키 없는 `<세션uuid>.json` 카운터. 남기면 24시간 동안 오해의 소지가 된다.
      if (f === 'handoff.json' || /^[0-9a-fA-F-]{36}\.json$/.test(f)) {
        fs.unlinkSync(p); removed += 1; continue;
      }
      const ttl = f.startsWith('handoff-') ? BATON_TTL_MS : SWEEP_TTL_MS;
      if (!j.at || Date.now() - Number(j.at) > ttl) { fs.unlinkSync(p); removed += 1; }
    } catch (_) {
      // 파싱조차 안 되는 파일은 옛 형식(전역 handoff.json 등)이거나 쓰다 만 것 — 지운다
      try { fs.unlinkSync(p); removed += 1; } catch (__) { /* 못 지워도 진행 */ }
    }
  }
  return removed;
}

/** 바통을 떨군다. 같은 세션이 여러 번 떨구면 **마지막 것이 그 세션의 바통**이다(덮어쓰기). */
function drop(cwd, sessionId, message, meta) {
  if (!String(message || '').trim()) return false;
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(STATE_DIR, batonName(cwd, sessionId)),
      JSON.stringify({ at: Date.now(), cwd: String(cwd || ''), sessionId: String(sessionId || ''), message: String(message), ...(meta || {}) })
    );
    return true;
  } catch (_) { return false; }
}

/**
 * **이 프로젝트**의 바통 중 가장 최근 것을 집어 오고, **집은 것만** 지운다(일회용).
 * 다른 프로젝트 바통은 건드리지 않는다 — 남의 저장소 세션이 이어받으면 안 된다.
 *
 * ⚠ 처음엔 뒤처진 바통도 **함께 지웠다**("안 지우면 다음 세션이 옛것을 문다"). 그게 틀렸다 —
 *   08-04 실측: 창을 여러 개 쓰는 이 환경에선 300k 를 넘긴 세션이 동시에 여럿이라, 새 창
 *   하나가 열릴 때마다 **다른 트랙의 인계문이 통째로 삭제**됐다. 실제로 이 저장소에서
 *   1분 차이로 떨어진 바통 둘 중 뒤엣것이 앞엣것을 밀어냈다. 잃는 쪽이 무는 쪽보다 나쁘다.
 *   이제 남은 바통은 **다음에 여는 창이 순서대로 이어받는다**(TTL 12시간이 안전판이다).
 */
function take(cwd) {
  sweep();
  const prefix = `handoff-${projectKey(cwd)}-`;
  let files;
  try { files = fs.readdirSync(STATE_DIR).filter((f) => f.startsWith(prefix)); } catch (_) { return null; }
  if (!files.length) return null;

  const found = [];
  for (const f of files) {
    const p = path.join(STATE_DIR, f);
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && Number(j.at) && Date.now() - Number(j.at) <= BATON_TTL_MS) found.push({ p, j });
      else fs.unlinkSync(p);
    } catch (_) { try { fs.unlinkSync(p); } catch (__) { /* 진행 */ } }
  }
  if (!found.length) return null;

  found.sort((a, b) => Number(b.j.at) - Number(a.j.at));
  const winner = found[0];
  // **집은 것만** 지운다. 나머지는 다음에 여는 창의 몫이다(위 ⚠ 참조).
  try { fs.unlinkSync(winner.p); } catch (_) { /* 진행 */ }
  return { ...winner.j, remaining: found.length - 1 };
}

/* safeId 도 내보낸다 — track-collision 이 같은 STATE_DIR 에 세션별 파일을 쓴다.
 * 파일명 규칙을 그쪽에서 다시 적으면 sweep() 이 못 알아보는 이름이 생기고, 증상은
 * 「조용히 안 지워짐」이라 눈에 안 띈다(이 파일이 존재하는 이유 ③과 같은 함정). */
module.exports = {
  stateDir, projectKey, safeId, batonName, trackPath, markEnded, stagePath, readStage, writeStage, claimBlock, sweep, drop, take,
  박동찍기, trackRoot, trackSessionId,
  siblings, siblingPrefix, touchKey, 공용장부, 공용장부폴더, 공용장부인가,
  편집지문계산, 편집지문경로, 편집지문읽기, 편집지문쓰기, 구문깨졌나,
  BATON_TTL_MS, SWEEP_TTL_MS,
};
