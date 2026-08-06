#!/usr/bin/env node
// 작업본소유자 — 「이 미커밋 변경은 누구 것인가」 (F073)
//
// 왜 있나:
//   세션 시작 시 `git status` 는 **두 가지를 같은 모양으로** 보여준다.
//     ⓐ 전 세션이 남기고 끝난 미완 → 이어받는 게 맞다
//     ⓑ 지금 살아서 돌고 있는 남의 작업본 → 손대면 사고다
//   F073 실사고: 보드의 「진행중」 줄을 ⓐ로 읽고 편집했는데 실제로는 ⓑ였고,
//   내 편집이 6분 뒤 남의 커밋에 그대로 실려 나갔다(uncommitted-swept-by-peer 의 반대 방향).
//   같은 트랙 병렬 3번째다(F070 가드 중복 · 크루카드 포크).
//
//   🔑 정보가 없었던 게 아니다 — **아무도 안 읽고 있었다.**
//      `track-collision` 훅이 세션마다 `track-<프로젝트>-<세션>.json` 에 만진 파일 목록을
//      이미 쌓고 있고, 그 파일의 mtime 이 곧 심장박동이다. 이 도구는 **읽는 쪽**이다.
//      (쓰는 쪽은 그 훅 소유다 — 여기서 다시 구현하지 않는다. 판정층을 둘로 만들면 갈라진다.)
//
// ⚠ 「모름」을 「안전」으로 바꾸지 않는다.
//    Edit·Write 를 안 거친 변경(Bash 스크립트·외부 앱·git 조작)은 만진 기록이 없다.
//    그건 ⓐ도 ⓑ도 아니라 **❔모름**이고, 그렇게 표시한다. 실측에서 14건 중 8건이 이랬다.
//
// 쓰는 법
//   node tools/작업본소유자.js          사람용 표
//   node tools/작업본소유자.js --hook   SessionStart 훅용 — 🔴가 있을 때만 말한다
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// SYNK_OWNER_ROOT = **보는 저장소**만 바꾸는 이음매(로직은 안 끈다 · SYNK_TRACK_ROOT 와 같은 패턴).
const ROOT = process.env.SYNK_OWNER_ROOT || path.resolve(__dirname, '..');
// ⚠ lib 는 ROOT 가 아니라 **이 파일 옆**에서 가져온다 — lib 은 이 저장소가 배포하는 것이고
//   ROOT 는 「어느 작업 트리를 보느냐」일 뿐이다. ROOT 기준으로 require 하면 픽스처마다
//   lib 사본을 깔아야 하고, 그건 곧 판정기가 갈라진다는 뜻이다.
const store = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));

/* 워크트리 — 이 도구의 사각지대였다 (F079 · 옆 세션 local_dee95eb9 이 실사고로 잡아 넘겼다).
 * 두 겹이었고 **둘 다 「보이는 것이 0건」으로 조용히 새는** 방향이다:
 *   ⓐ `git status` 는 자기 트리만 본다 — 실측: 옆 트리가 2건을 들고 있는데 메인은 0건으로 셌다.
 *   ⓑ 🔴 더 깊은 것 — 상태 파일 접두의 `projectKey` 가 **트리마다 다르다**
 *      (실측: 메인 cec367f48f vs 워크트리 1fc2df68ae·9514265e22·80c1561a3e).
 *      감지 로직을 아무리 고쳐도 **재료가 갈라져 있어** 워크트리 세션은 파일 목록에서부터 안 잡힌다.
 * 처방 = 쓰는 쪽(track-collision)이 **메인 트리 키로 통일**했고(ba17f78), 읽는 이쪽도 같은 키를 쓴다.
 *   메인에서 돌 때 값이 안 변하므로 오늘의 계약은 안 깨진다 — 넓히기만 한다. */
let wt = null;
try { wt = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'worktrees.js')); } catch (_) { wt = null; }

/** 상태 파일 접두의 기준 — 트리가 달라도 **메인 하나로** 모은다. lib 이 없으면 옛 동작 그대로. */
function 키기준(r) {
  if (!wt) return r;
  try { return wt.mainWorktree(r) || r; } catch (_) { return r; }
}

/** 심장박동 유효 시간. 이보다 오래된 세션은 「끝난 것」으로 본다.
 *  짧게 잡으면 살아있는 세션을 죽었다고 해 사고가 나고(위험한 방향),
 *  길게 잡으면 끝난 세션을 살아있다고 해 조심하게 된다(안전한 방향). 그래서 넉넉히 잡는다. */
const 살아있음_분 = Number(process.env.SYNK_OWNER_ALIVE_MIN || 30);

/** 심장박동이 아직 뛰는가. 인계문수거(F111)도 **이 판정 하나**를 쓴다 — 살았다/죽었다를
 *  두 곳에 적으면 갈라지고, 갈라진 쪽의 증상은 「살아있는 세션의 인계문을 거둬 감」이다. */
const 살았나 = (s) => s.분 <= 살아있음_분;

/* ⚪ 유물 주장의 반증 여유. 심장박동이 멎은 뒤에 바뀐 파일은 그 세션의 것일 수 없다.
 *  🔴 실사고 2026-08-04(F090): 이 도구가 `Code.js` 를 ⚪「이어받아도 된다」로 내놨는데, 실제로는
 *     **살아있는** 세션이 `node tools/bump-version.js`(Bash)로 방금 고친 것이었다. Bash 가 쓴 파일은
 *     만진 기록이 안 남고(track-collision 은 Edit·Write 만 본다), 40분 전 끝난 세션의 **옛 기록이
 *     그 자리를 이겼다.** 새는 방향은 언제나 통과다 — 그대로 이어받아 커밋했으면 F073 재현이다.
 *  그래서 유물 주장은 파일 mtime 으로 반증한다. **판정을 올리지 않고 「모름」의 범위만 넓힌다** —
 *  ⚪는 「손대도 된다」고 말하는 유일한 칸이라, 확신이 없으면 거기 두지 않는 것이 맞다.
 *  여유가 필요한 이유: track-collision 은 PreToolUse 라 상태 파일이 **파일보다 먼저** 쓰인다. */
const 유물여유_분 = Number(process.env.SYNK_OWNER_STALE_MIN || 2);

/* 형제 저장소 — 이 도구의 두 번째 사각지대였다 (F134·F137 · 2026-08-06 세 번째 재현).
 *   워크트리(위)는 **같은 저장소의 다른 체크아웃**이라 이미 세는데, `../SYNK-talk` 는
 *   **다른 저장소**라 `git status` 에 애초에 안 나온다. 그런데 이 프로젝트의 트랙은 두 저장소를
 *   함께 만진다(보드 줄 절반이 「SYNK-talk: …」다). 실측 3건 전부 **새는 방향이 「0건」**이다:
 *     F134 되감기 가드가 talk 를 향한 명령을 appsscript 상태로 판정 · F137 남이 편집 중인 talk
 *     파일을 「비었다」고 읽고 내 트랙으로 선언 · 08-06 이 세션 시작에서 talk 미커밋 3건(그 중
 *     하나는 45초 전에 쓰인 살아있는 작업본)이 이 도구 출력에 **한 줄도 안 나왔다**.
 *   목록·좌표 규칙은 여기 적지 않는다 — `lib/handoff-store.js` 하나에서 파생시킨다(쓰는 쪽
 *   track-collision 이 같은 함수를 쓴다 · 양쪽에 적으면 갈라지고 증상은 「전부 모름」이다). */

function git(args, cwd = ROOT) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd, encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  if (r.error || r.status !== 0) return null;
  return String(r.stdout || '');
}

/** 미커밋 경로들. git 을 못 부르면 **null(=모름)** — 빈 배열(=없음)과 구별한다.
 *
 * 🔴 `-uall` 이 없으면 **새 폴더의 미추적 파일이 통째로 접힌다** — `docs/정본/엔진_시험.js` 가
 *    `?? docs/` 한 줄이 되어 파일이 목록에서 사라진다(실측). 하필 미추적이 이력·stash·reflog
 *    어디에도 없는 유일한 무보호 상태(F025)인데, 거기가 사각이었다. 추적 파일의 수정은
 *    멀쩡히 보이므로 **라이브에서는 정상으로 보인다** — 옆 세션(dee95eb9)이 자기 변이 검사에서
 *    「픽스처가 평평하면 경로 처리가 안 시험된다」를 넘겨줘, 중첩 픽스처를 넣다가 드러났다. */
function 미커밋들(뿌리 = ROOT) {
  const out = git(['status', '--porcelain', '-uall'], 뿌리);
  if (out === null) return null;
  const 씻기 = (l) => l.slice(3).split(' -> ').pop().replace(/^"(.*)"$/, '$1');  // 이름 바뀜: 새 경로가 지금 자리다
  const 목록 = out.split(/\r?\n/).filter(Boolean).map((l) => ({ 파일: 씻기(l), 트리: null }));

  /* 다른 작업 트리의 미커밋도 같이 센다 — 안 세면 「0건」이 되고, 그 0 은 안전과 구별되지 않는다.
   * ⚠ 비용: othersDirty 는 트리 5개에 ≈330ms 다. anyOthers() 는 fs 두 번(<1ms)이라 먼저 거른다. */
  try {
    if (wt && wt.anyOthers(뿌리)) {
      for (const t of wt.othersDirty(뿌리) || []) {
        const 이름 = String(t.path || '').split(/[\\/]/).filter(Boolean).pop() || '다른 트리';
        for (const f of t.files || []) 목록.push({ 파일: f, 트리: 이름 });
      }
    }
  } catch (_) { /* 워크트리 조회 실패가 메인 판정을 막지는 않는다 */ }
  return 목록;
}

/** 파일이 마지막으로 바뀐 시각(ms). 못 읽으면 **null(=모름)** — 0(=아주 옛날)과 구별한다.
 *  삭제된 파일은 여기서 null 이 되고, 그건 「유물임을 확인 못 했다」는 뜻이지 유물이라는 뜻이 아니다. */
function 파일시각(f, 뿌리 = ROOT) {
  try { return fs.statSync(path.join(뿌리, f)).mtimeMs; } catch (_) { return null; }
}

/** 세션별 {sid, 분, 박동, touched}. track-collision 이 쌓아 둔 것을 읽기만 한다. */
function 세션들(뿌리 = ROOT) {
  const dir = store.stateDir();
  const 접두 = `track-${store.projectKey(키기준(뿌리))}-`;   // 트리가 달라도 메인 키 하나로 (F079)
  let 목록;
  try { 목록 = fs.readdirSync(dir); } catch (_) { return []; }
  const now = Date.now();
  const 결과 = [];
  for (const f of 목록) {
    if (!f.startsWith(접두) || !f.endsWith('.json')) continue;
    const p = path.join(dir, f);
    let j; let 분; let 박동;
    try {
      박동 = fs.statSync(p).mtimeMs;
      분 = Math.round((now - 박동) / 60000);
      j = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) { continue; }
    결과.push({ sid: f.slice(접두.length, -5), 분, 박동, touched: Array.isArray(j.touched) ? j.touched : [] });
  }
  return 결과.sort((a, b) => a.분 - b.분);
}

/** 형제 파일의 주인 후보. 기록이 **두 군데**에 남는다 — 한쪽만 보면 형제는 영원히 ❔모름이다.
 *   ⓐ 그 저장소를 **프로젝트로 연** 세션 → 그 저장소 키 · 그 저장소 상대 경로
 *   ⓑ 이 저장소를 연 세션이 `../SYNK-talk/…` 를 **편집** → **내 키** · 형제 접두 경로
 *  라이브의 거의 전부가 ⓑ다(트랙은 appsscript 에서 열고 talk 파일을 만진다).
 *  ⓑ 의 좌표에서 접두를 벗겨 ⓐ와 **같은 좌표**로 맞춘다 — 좌표가 다르면 대조가 전부 빗나가고,
 *  빗나간 결과는 「0건」이 아니라 「모름」이라 **고장이 정상처럼 보인다.**
 *
 *  ponytail: 반대 방향(ROOT 가 형제일 때 appsscript 기록을 찾는 것)은 안 한다 — 그쪽은 못 찾아도
 *  ❔모름으로 떨어져 **보여주면서 통과**하는 안전한 방향이고(git-scope-guard ⑧), 찾으려면
 *  「형제의 형제」를 디렉터리에서 뒤져야 한다(🚫 자동 스캔 확장 · memory cross-repo-blindness). */
function 형제세션들(뿌리, 저장소, 내세션들) {
  const 접두 = store.siblingPrefix(저장소);
  const 합 = new Map();
  const 넣기 = (s, touched) => {
    const 있 = 합.get(s.sid);
    if (!있) { 합.set(s.sid, { ...s, touched }); return; }
    // 같은 세션이 양쪽에 있으면 박동은 **더 최근** 것을 쓴다(살아있음 판정이 안전한 쪽으로 틀린다).
    if (s.박동 > 있.박동) { 있.박동 = s.박동; 있.분 = s.분; }
    있.touched = [...new Set([...있.touched, ...touched])];
  };
  for (const s of 세션들(뿌리)) 넣기(s, s.touched);
  for (const s of 내세션들) {
    const 옮긴 = s.touched.filter((f) => f.startsWith(접두)).map((f) => f.slice(접두.length));
    if (옮긴.length) 넣기(s, 옮긴);
  }
  return [...합.values()].sort((a, b) => a.분 - b.분);
}

const 판정 = { 내것: '내것', 남의살아있는: '남의살아있는', 끝난세션: '끝난세션', 모름: '모름', 다른트리: '다른트리' };

/** 한 저장소의 미커밋 목록에 판정을 매긴다. 저장소가 늘어도 **판정은 이 함수 하나**다 —
 *  형제용 판정을 따로 적으면 그 순간 갈라지고, 갈라진 쪽의 증상은 언제나 「통과」다. */
function 판정들(파일들, ss, 나, 뿌리, 저장소) {
  return 파일들.map(({ 파일: f, 트리 }) => {
    const 주인 = ss.filter((s) => s.touched.includes(f));
    const 산주인 = 주인.filter(살았나);
    /* 🔑 **「내 것」은 「내 것뿐」이 아니다** (F104 · 2026-08-05).
     *   아래 판정은 내가 만졌으면 그 자리에서 `내것`으로 접는다 — 남이 **같은 파일을 함께**
     *   만졌어도 그 사실이 사라진다. 공유 파일(세션보드·마찰장부)에서 그게 실사고가 됐다:
     *   b489f2e·6711ff2 는 내가 편집한 보드를 경로까지 못 박아 커밋했는데, 같은 파일에 있던
     *   **남의 줄 편집·삭제가 함께 실려** push 됐다. 종류 칸만 보면 영원히 안 보인다.
     *   그래서 종류와 **직교하는** `함께` 를 모든 항목에 단다 — 판정을 바꾸지 않고 사실만 늘린다
     *   (기존 소비자는 그대로 돌고, 새 소비자[git-scope-guard ⑧]가 이 칸을 본다).
     *
     *   ⚠ **살아있는 세션만** 센다. 만진 기록에는 「아직 미커밋인가」가 안 담겨 있어서, 전량을 세면
     *      **이미 커밋하고 끝난 세션**까지 공범으로 잡는다(실측: 이 규칙을 만든 커밋에서 바로 오탐).
     *      실사고 3건은 전부 **동시에 돌던** 세션이 원인이라 이 좁힘이 탐지를 안 깎는다.
     *      남는 사각: 내가 만진 파일에 **죽은 세션의 미커밋**이 얹혀 있는 경우 — 그건 ⚪유물이라
     *      「이어받아도 된다」가 이 도구의 판정이고(F025), 여기서 뒤집지 않는다. */
    const 함께 = 산주인.filter((s) => s.sid !== 나);
    if (트리) return { 파일: f, 트리, 저장소, 종류: 판정.다른트리, 주인: [], 함께: [] };
    if (나 && 산주인.some((s) => s.sid === 나)) return { 파일: f, 트리, 저장소, 종류: 판정.내것, 주인: [], 함께 };
    const 남 = 산주인.filter((s) => s.sid !== 나);
    if (남.length) return { 파일: f, 트리, 저장소, 종류: 판정.남의살아있는, 주인: 남, 함께 };
    /* ⚪ 유물이라고 말하려면 **그 세션이 끝난 뒤로 안 바뀌었어야** 한다 (F090).
     *   기록만 보면 「누가 언젠가 만졌다」는 것뿐이고, 그 뒤에 다른 통로(Bash·외부 앱·git)가
     *   덮어썼는지는 기록에 안 남는다. 시각으로 반증되면 ⚪가 아니라 ❔로 내린다. */
    if (주인.length) {
      const 박동 = Math.max(...주인.map((s) => s.박동));
      const 바뀐때 = 파일시각(f, 뿌리);
      if (바뀐때 !== null && 바뀐때 <= 박동 + 유물여유_분 * 60000) return { 파일: f, 트리, 저장소, 종류: 판정.끝난세션, 주인, 함께 };
      return { 파일: f, 트리, 저장소, 종류: 판정.모름, 주인: [], 함께, 반증: { 주인, 잰것: 바뀐때 !== null } };
    }
    return { 파일: f, 트리, 저장소, 종류: 판정.모름, 주인: [], 함께 };
  });
}

function 조사() {
  const 나 = store.safeId(process.env.CLAUDE_CODE_HOST_SESSION_ID || '');
  const ss = 세션들();
  const 파일들 = 미커밋들();
  if (파일들 === null) return { git못부름: true, 나, 항목: [], 세션수: ss.length, 못본형제: [] };

  const 항목 = 판정들(파일들, ss, 나, ROOT, null);
  /* 형제 저장소도 **같은 판정**을 거친다. 못 읽으면 건너뛰지 않고 이름을 들고 나간다 —
   * 「형제를 못 봤다」와 「형제가 깨끗하다」가 같은 모양이면 이 확장이 있으나 마나다. */
  const 못본형제 = [];
  for (const { 뿌리, 저장소 } of store.siblings(ROOT)) {
    const 목록 = 미커밋들(뿌리);
    if (목록 === null) { 못본형제.push(저장소); continue; }
    항목.push(...판정들(목록, 형제세션들(뿌리, 저장소, ss), 나, 뿌리, 저장소));
  }
  return { git못부름: false, 나, 항목, 세션수: ss.filter(살았나).length, 못본형제 };
}

const 짧게 = (s) => s.replace(/^local_/, '').slice(0, 8);
/** 형제 저장소의 파일은 **어느 저장소인지 붙여서** 보여준다 — 경로만 보면 내 저장소 것으로 읽고
 *  없는 파일을 찾으러 간다(그리고 「없네」로 끝나면 다시 0건이다). */
const 표시 = (i) => (i.저장소 ? `${i.저장소}/${i.파일}` : i.파일);

function 보고(r, { 훅 }) {
  if (r.git못부름) return 훅 ? '' : '[작업본소유자] git 을 못 불렀다 — 판정 불가(0건 아님).';
  const 위험 = r.항목.filter((i) => i.종류 === 판정.남의살아있는);
  const 유물 = r.항목.filter((i) => i.종류 === 판정.끝난세션);
  const 다른트리 = r.항목.filter((i) => i.종류 === 판정.다른트리);

  /* 형제 저장소에서 **주인을 못 가른 것**만 따로 묶는다 — 내 저장소의 ❔ 목록에 섞으면
   * 「내 파일인데 없네」로 읽힌다. 주인이 갈린 형제 파일은 그대로 🔴·⚪ 로 간다.
   * (쓰는 쪽이 형제 좌표를 담기 시작한 뒤로 여기 남는 것은 **Edit·Write 를 안 거친 변경**뿐이다 —
   *  옛날처럼 「원리상 못 가름」이 아니다. 이유가 바뀌었으므로 아래 처방 문구도 그걸 말한다.) */
  const 형제모름 = r.항목.filter((i) => i.저장소 && i.종류 === 판정.모름);
  const 모름 = r.항목.filter((i) => i.종류 === 판정.모름 && !i.저장소);

  // 훅 모드: 위험이 없으면 침묵한다. 잔소리하는 장치는 읽히지 않게 된다.
  // 다른 트리의 미커밋도 위험에 넣는다 — 그건 남의 세션이 지금 들고 있는 것이다(F079).
  if (훅 && !위험.length && !다른트리.length && !형제모름.length && !r.못본형제.length) return '';
  /* 형제 때문에 입을 여는 경우엔 **형제만** 말한다 — 내 저장소의 ⚪·❔ 까지 매 세션 쏟으면
   * 그 순간부터 아무도 안 읽는다(이 도구가 침묵을 지키는 이유와 같다). */
  const 간략 = 훅 && !위험.length && !다른트리.length;

  const 줄 = [];
  줄.push(`[작업본소유자] 미커밋 ${r.항목.length}건 · 살아있는 세션 ${r.세션수}개`);
  if (위험.length) {
    줄.push('', `🔴 살아있는 남의 작업본 ${위험.length}건 — **편집하지 않는다**(F073: 내 편집이 남의 커밋에 실려 나간다)`);
    for (const i of 위험) 줄.push(`   · ${표시(i)}  ← ${i.주인.map((s) => `${짧게(s.sid)}·${s.분}분 전`).join(', ')}`);
  }
  if (다른트리.length) {
    const 트리별 = {};
    for (const i of 다른트리) (트리별[i.트리] = 트리별[i.트리] || []).push(i.파일);
    줄.push('', `🌿 **다른 작업 트리**의 미커밋 ${다른트리.length}건 — 그 트리 세션이 지금 들고 있다(F079)`);
    for (const [t, fs2] of Object.entries(트리별)) 줄.push(`   · ${t}: ${fs2.join(', ')}`);
    줄.push('   메인의 `git status` 엔 안 뜬다 — 「0건」으로 보이던 자리다. 그 트리에서 커밋될 때까지 기다린다.');
  }
  if (형제모름.length) {
    const 저장소별 = {};
    for (const i of 형제모름) (저장소별[i.저장소] = 저장소별[i.저장소] || []).push(i.파일);
    줄.push('', `🔗 **형제 저장소**의 미커밋 ${형제모름.length}건 — 내 \`git status\` 엔 안 뜬다(F134·F137: 여기가 「0건」이던 자리)`);
    for (const [s, fs2] of Object.entries(저장소별)) 줄.push(`   · ${s}: ${fs2.join(', ')}`);
    줄.push('   이건 주인 **모름**이다 — Edit·Write 를 안 거친 변경(Bash·외부 앱·git)이라 기록이 없다.');
    줄.push('   **모름은 안전이 아니다** — 만지기 전에 그 저장소에서 직접 본다:');
    줄.push(`   git -C ../${Object.keys(저장소별)[0]} status  ·  git -C ../${Object.keys(저장소별)[0]} log --oneline -5`);
  }
  if (r.못본형제.length) {
    줄.push('', `⚠ 형제 저장소 ${r.못본형제.join(', ')} 를 **못 읽었다** — 0건이 아니라 판정 불가다.`);
  }
  if (유물.length && !간략) {
    줄.push('', `⚪ 끝난 세션이 남긴 것 ${유물.length}건 — 이어받아도 된다(미추적은 무보호 상태다 · F025)`);
    for (const i of 유물) 줄.push(`   · ${표시(i)}  ← ${i.주인.map((s) => `${짧게(s.sid)}·${s.분}분 전`).join(', ')}`);
  }
  if (모름.length && !간략) {
    줄.push('', `❔ 주인 모름 ${모름.length}건 — Edit·Write 를 안 거친 변경(Bash·외부 앱·git)이라 기록이 없다.`);
    줄.push('   **모름은 안전이 아니다** — 만지기 전에 `git log --oneline -5` 와 보드로 확인한다.');
    for (const i of 모름) {
      // 유물로 볼 뻔한 것은 **왜 아닌지**까지 적는다 — 이유 없이 칸만 바뀌면 옛 기록을 믿고 되돌린다(F090).
      if (!i.반증) { 줄.push(`   · ${표시(i)}`); continue; }
      const 누구 = i.반증.주인.map((s) => `${짧게(s.sid)}·${s.분}분 전`).join(', ');
      줄.push(`   · ${표시(i)}  ⚠ ${누구} 의 기록이 있지만 ${i.반증.잰것 ? '**그 뒤에 바뀌었다**' : '**바뀐 때를 못 쟀다**'} — 유물이 아니다(다른 통로가 썼다)`);
    }
  }
  return 줄.join('\n');
}

if (require.main === module) {
  const 훅 = process.argv.includes('--hook');
  const 글 = 보고(조사(), { 훅 });
  if (글) process.stdout.write(글 + '\n');
  process.exit(0);
}

/* 세션들·살았나·짧게 는 인계문수거(F111)가 소비한다 — 생존 판정과 sid 표기를 거기서
 * 다시 적으면 두 도구가 서로 다른 「살아있음」을 보게 된다(새는 방향 = 수거해 감). */
module.exports = { 조사, 보고, 판정, 세션들, 살았나, 짧게 };
