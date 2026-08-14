#!/usr/bin/env node
/* auto-commit — 턴이 끝날 때 내 편집을 그 자리에서 커밋해 **미커밋 노출 시간을 0으로** (Stop 훅)
 *
 * 왜 있나 (2026-08-07 · 유호님 지시 「인계문 쓰던 방식 그대로, 충돌 안 나게」):
 *   마찰장부 169건에서 가장 많은 단어가 「미커밋」(34회)이다. F025(미추적이 git clean 에 소멸 —
 *   이력·stash·reflog 어디에도 없음) · F037(추적 미커밋이 남의 rebase --abort 에 쓸림) ·
 *   F073(내 미커밋이 남의 커밋에 실려 나감) — 셋 다 **미커밋으로 떠 있는 시간**에만 일어난다.
 *   세션을 8개로 늘리면 그 시간대가 서로 겹친다. 처방은 파일 구조가 아니라 시간이다.
 *
 * 🔴 형제 저장소도 **함께** 커밋한다 (첫 판에서 빠졌던 구멍 · 유호님 최종 검토 지시로 발견):
 *   보드 18줄 중 **5줄이 `SYNK-talk`**(앱 본진)을 만진다. 트랙은 appsscript 를 열고 talk 파일을
 *   편집하는 형태라(touchKey ⓑ · `../SYNK-talk/…` 좌표) `../` 로 시작한다는 이유로 건너뛰면
 *   **유호님 작업의 절반이 자동화 밖**에 남는다. F134·F137·F142 가 전부 이 사각에서 났다.
 *   형제 판정은 `작업본소유자.형제세션들` 하나에서 가져온다 — 좌표 정규화(ⓐ/ⓑ 합치기)를
 *   여기서 다시 적으면 갈라지고, 갈라진 쪽의 증상은 언제나 「통과」다(맹점 ④).
 *
 * 무엇을 커밋하나 — **「내것 ∧ 함께 없음」만** (git-scope-guard ⑧과 같은 조건):
 *   · 내 세션이 Edit·Write 로 만진 파일(track-collision 기록)  ∩  지금 미커밋인 파일
 *   · 살아있는 다른 세션이 같은 파일을 만졌으면(F104 「함께」) 남기고 알린다 —
 *     경로를 못 박아도 같은 파일 안의 남의 줄은 함께 실린다.
 *
 * 커밋하지 않는 것:
 *   · docs/세션보드.md · 세션보드_아카이브.md — F102 🚫보드 자동커밋(이동은 board-move.js 의 의식)
 *   · docs/_ops/마찰신호.md — friction-close-guard 가 Bash 층에서 지키는 통로를 우회하지 않는다
 *   · 구문 깨진 .js / 깨진 .json — 반쪽 문장을 스냅샷으로 남기면 push 순간 CI 가 빨개지고,
 *     깨진 settings.json 은 다음 세션의 훅을 통째로 죽인다. 고쳐지면 다음 턴에 자동으로 실린다.
 *   · 삭제 — Edit·Write 는 지우지 않으므로 삭제는 내 기록 밖의 손이다.
 *   · **내가 쓴 뒤 밖에서 바뀐 파일** — `edit-stamp` 훅이 편집 직후 남긴 바이트 지문과 다르면
 *     안 싣는다(F225). 만진 기록은 PreToolUse 라 「편집하려 했다」까지만 알아서, 변이 시험이
 *     놓아 둔 **일부러 깨뜨린 판**이 여기까지 똑같은 모양으로 온다 — 실물 `c3c8d98` 은 변이
 *     2개가 얹힌 `repo-staleness.js` 를 「자동커밋: 미커밋 노출 차단」이라는 얼굴로 실었다.
 *   · **편집 지문이 없는 파일** — 거절된 편집(PreToolUse 는 거절돼도 만진 기록을 남긴다)이거나
 *     그 훅이 안 돈 경우다. Bash·외부 앱이 만든 변경도 여기로 떨어진다(모름은 커밋하지 않는다).
 *   · push 는 하지 않는다 — 되돌리기 어렵고 CI 를 태운다. push 는 `/close` 의 몫이다(그 4단계가
 *     원격 run 까지 확인한다). Apps Script 코드의 라이브 반영도 그대로 `/deploy` 가 통로다.
 *
 * 안전 형태:
 *   · 제목은 항상 「자동커밋: 」으로 시작 — 이 훅이 낸 커밋을 나중에 골라낼 수 있는 유일한 표식이다.
 *   · [vNEXT] 자리표가 든 **배포 파일**은 pre-commit 게이트(`tools/자리표검사.js`)가 막는다 — 이 훅은
 *     그때 조용히 물러난다(아래 「실패는 어느 층이든 exit 0」). 미커밋 노출은 /close·작업본소유자가 받는다.
 *     ⚠ 옛 주석은 「그대로 커밋해도 안전 — bump-version 의 자리표 설계가 그 목적이다」였다. 그 문장을
 *     믿은 세션이 자리표를 실어 남의 배포를 막았다(실측 `694497ad` · F450). 안전한 것은 **미커밋인
 *     동안**이지 커밋이 아니다 — `tests/버전채번.test.js` 가 커밋된 자리표를 빨갛게 만든다.
 *   · rebase·merge·cherry-pick 진행 중인 저장소는 건너뛴다(F035·F038) — 다른 저장소는 계속한다.
 *   · index.lock 경합(옆 세션 훅과 동시 커밋)은 300ms 3회만 기다린다.
 *   · 커밋했다고 믿지 않고 결과를 본다(F071) — 그 경로들이 깨끗해졌는지 재확인.
 *   · 실패는 어느 층이든 exit 0 — 이 훅은 편의 장치지 가드가 아니다. 못 하면 조용히 물러나고,
 *     노출은 기존 통로(/close·작업본소유자)가 그대로 받는다.
 *   · 커밋한 턴에만 입을 연다 — 잔소리하는 장치는 읽히지 않게 된다(작업본소유자와 같은 원칙).
 *   · 끄기: settings.json 의 등록을 지우거나 SYNK_AUTOCOMMIT_OFF=1.
 *
 * 회귀: tests/자동커밋.test.js (픽스처 저장소 — 실저장소에는 아무 것도 하지 않는다)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.env.SYNK_AUTOCOMMIT_OFF === '1') process.exit(0);

let input = {};
try {
  const raw = fs.readFileSync(0, 'utf8');
  input = raw ? JSON.parse(raw) : {};
} catch (_) { process.exit(0); }

const ROOT = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const 원본sid = String(process.env.CLAUDE_CODE_HOST_SESSION_ID || input.session_id || '').trim();
if (!원본sid) process.exit(0);

/* 판정층은 하나 — 작업본소유자를 읽기만 한다. 못 읽으면 추측 커밋 대신 침묵(안전한 방향).
 * ⚠ `조사()` 는 부르지 않는다 — 그 안의 원격대기()가 `git fetch` 를 한다. 턴마다 fetch 는
 *   유호님 회선(실측 13.5Mbps)에서 Stop 훅을 매번 붙잡는다. 필요한 판정 함수만 가져온다. */
let owner; let store;
try {
  owner = require(path.join(__dirname, '..', '..', 'tools', '작업본소유자.js'));
  store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
} catch (_) { process.exit(0); }
const 나 = store.safeId(원본sid);

/* 내가 **직접 쓴 내용**의 지문 — `{좌표: 해시}`. 좌표는 만진 기록과 같은 공간(형제는 `../이름/`).
 * 한저장소() 는 저장소 상대 경로로 보므로 접두를 떼서 넘긴다(정규화를 저쪽에 또 적지 않는다). */
const 지문전체 = store.편집지문읽기(ROOT, 원본sid);
function 지문떼기(접두) {
  if (!접두) return 지문전체;
  const m = Object.create(null);
  for (const [k, v] of Object.entries(지문전체)) if (k.startsWith(접두)) m[k.slice(접두.length)] = v;
  return m;
}

function git(args, cwd) {
  return spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd, encoding: 'utf8', timeout: 15000, windowsHide: true,
    // Session-Id 트레일러(prepare-commit-msg)가 이 변수를 읽는다 — 없으면 커밋이 주인 없는 채로 남는다(F142)
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: 원본sid },
  });
}
const gitOk = (args, cwd) => { const r = git(args, cwd); return (!r.error && r.status === 0) ? String(r.stdout || '') : null; };
const 슬래시 = (f) => String(f).replace(/\\/g, '/');

const 제외 = new Set([
  'docs/세션보드.md', 'docs/세션보드_아카이브.md', // F102 — 🚫보드 자동커밋
  'docs/_ops/마찰신호.md',                          // friction-close-guard 통로 보존
]);
/* 장부 조각(F250 후반)도 같은 사유로 제외 — friction.js 가 번호를 알고 그 자리에서 커밋한다.
 * F0NN 을 모르는 이 통로가 조각을 실으면 close-guard 가 그 커밋을 원리상 못 읽는다.
 * 보드 세션별 파일(F250)은 위 F102 와 **같은 사유**다 — 옛 좌표만 제외에 남아 이주 뒤 보호가
 * 통째로 빠졌고, 08-08 17:06 에 이 통로가 `docs/_ops/보드/6da8da21.md` 를 실제로 실었다.
 *
 * ⚠ 이 제외의 **옛 근거는 죽었다**(F367 · 2026-08-12) — 「보드 줄의 이동은 board-move.js 의
 *   의식이라 중간 판이 실리면 반쪽만 착지한다」(F248 계열)는 성립하지 않는다: board-move 는
 *   `fs.writeFileSync` 라 편집 도장이 없고 이 통로는 도장 있는 것만 싣는다(아래 무기록 버킷).
 *   제외가 없어도 board-move 의 중간 판은 **원리상 못 본다.**
 *   그런데도 **유지하는** 산 근거는 실측이다 — 오늘 커밋 481건 중 이 훅이 낸 것은 **3건**
 *   (보드를 손 커밋한 세션 47개 중 3개)뿐이다. 세션이 즉시 손 커밋해 Stop 시점엔 더러운 보드가
 *   없기 때문이다. 즉 제외를 떼도 **흡수될 커밋이 없고**(보드 손커밋 184건은 그대로 남는다),
 *   대신 갱신을 뺏길 때마다 `docs: 보드 …` 서술 메시지가 익명 자동커밋 메시지로 바뀐다 —
 *   그 메시지는 **인계문이 다음 세션에 넘기는 재료**다. 얻는 것 0 · 잃는 것 > 0 이라 떼지 않는다. */
const 제외폴더 = ['docs/_ops/장부/', 'docs/_ops/보드/'];

/** 한 저장소를 처리한다. 저장소가 늘어도 **로직은 이 함수 하나**다 —
 *  형제용을 따로 적으면 그 순간 갈라지고, 갈라진 쪽의 증상은 언제나 「통과」다. */
function 한저장소(뿌리, 이름, 내touched, 남touched, 지문) {
  if (!내touched.length) return null;
  if (gitOk(['rev-parse', '--is-inside-work-tree'], 뿌리) === null) return null;
  for (const 상태 of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD']) {
    const o = gitOk(['rev-parse', '--git-path', 상태], 뿌리);
    if (o && fs.existsSync(path.resolve(뿌리, o.trim()))) return null; // 그 상태를 만든 손이 끝낼 일이다
  }

  /* `-z` 라 경로가 날것으로 온다(이스케이프 층이 값을 깨뜨리지 않는다 · F045 계열).
   * `-uall` 이 없으면 새 폴더의 미추적이 `?? docs/` 한 줄로 접혀 파일이 사라진다(작업본소유자 실측). */
  const zr = git(['status', '--porcelain', '-z', '-uall'], 뿌리);
  if (zr.error || zr.status !== 0) return null;
  const 토큰 = String(zr.stdout || '').split('\0').filter(Boolean);
  const 더러움 = new Set();
  for (let i = 0; i < 토큰.length; i++) {
    더러움.add(토큰[i].slice(3));
    if (/[RC]/.test(토큰[i].slice(0, 2))) i++; // 이름바뀜: 다음 토큰은 옛 경로 — 새 경로가 지금 자리다
  }

  const 후보 = []; const 함께남김 = []; const 깨짐 = []; const 무기록 = []; const 밖에서바뀜 = [];
  for (const f0 of 내touched) {
    const f = 슬래시(f0);
    if (f.startsWith('../') || 제외.has(f) || 제외폴더.some((d) => f.startsWith(d)) || !더러움.has(f)) continue;
    const 절대 = path.join(뿌리, f);
    if (!fs.existsSync(절대)) continue;                    // 삭제는 내 기록 밖의 손이다
    if (남touched.has(f)) { 함께남김.push(f); continue; }   // 내것 ∧ 함께 없음 만 (F104)
    /* 🔑 「내것」의 마지막 칸 — 지금 디스크에 있는 것이 **내가 쓴 그 바이트**인가 (F225).
     * 만진 기록은 PreToolUse 라 편집 의도까지고, 그 뒤 변이 시험·스크립트가 덮어써도
     * 여기까지 모양이 같다. 구문검사는 못 잡는다 — 변이는 문법이 멀쩡한 채로 의미만 죽인다. */
    const 기대 = 지문[f];
    if (!기대) { 무기록.push(f); continue; }
    if (store.편집지문계산(절대) !== 기대) { 밖에서바뀜.push(f); continue; }
    /* 실행조차 안 되는 판은 안 싣는다. 대상 목록(`.js` 계열 · `.json`)은 **정본 하나**에서 온다 —
     * 같은 물음을 편집 직후에도 묻게 되면서 두 곳이 됐고, 갈라지면 「깨진 걸 못 본다」로 샌다(F239). */
    if (store.구문깨졌나(절대)) { 깨짐.push(f); continue; }
    후보.push(f);
  }

  /* ── 🔴 **이 커밋 하나로 판이 서는가** (마찰 F248 · 2026-08-08 실사고) ───────────────
   * 구문검사는 「깨졌나」까지만 본다. 실물 `fb0bbce`: 이 훅이 `tests/safety.test.js` 의 새
   * `[vNEXT]` 케이스 129줄만 실었는데 그 테스트가 부르는 구현은 **아직 어디에도 없었다** —
   * HEAD 에 함수 0건이라 원격 run 31239587806 이 4건 실패했고 master 가 **60분간** 적색이었다
   * (짝은 같은 세션의 다음 자동커밋 `4e47bfb` 이 실었다 — 그 세션은 내내 몰랐다).
   * 바이트는 지켰는데 공유 브랜치가 깨진 자리다. 새는 방향이 침묵이 아니라 **남에게 전가된
   * 적색**이라 F225·F247 보다 나쁘다 — 그 상태는 남의 `/deploy` 게이트를 그대로 막는다.
   *
   * 🔑 「테스트를 돌리기엔 Stop 이 비싸다」는 원래 설계 이유는 **전 스위트**를 가정한 것이다.
   *   실을 파일만 돌리면 실측 `safety.test.js` = **1.7초**(144건)고 전 스위트는 313초다.
   *   즉 접었던 이유가 이 좁은 범위에는 적용되지 않는다.
   * 🔑 판정은 **떨어뜨리기**지 보류가 아니다 — 적색을 만드는 건 그 테스트 파일이므로 나머지는
   *   그대로 싣는다(F025 보호를 통째로 끄지 않는다). 위 네 버킷과 같은 모양이다.
   * ⚠ 미실행은 통과가 아니다(F207) — 스폰 실패·타임아웃도 **안 싣고 말한다**. 이 훅의
   *   「모름은 커밋하지 않는다」와 같은 방향이고, 처방(경로 지정 손 커밋)은 실행 가능하다.
   * ponytail: 천장 = **느린 스위트**(실측 `트랙충돌.test.js` 143초)는 매번 미측정으로 떨어져
   *   손 커밋이 된다. 올릴 길은 파일 분할이거나 이 예산 상향이지, 미측정을 통과로 바꾸는 게 아니다. */
  const 적색 = []; const 미측정 = [];
  const 실을테스트 = 후보.filter((f) => /(^|\/)tests\/[^/]*\.test\.js$/.test(f));
  if (실을테스트.length) {
    /* 예산은 이음매로 연다 — 안 열면 「미측정」 갈래를 45초 기다리지 않고는 못 재고,
     * 못 재는 갈래는 결국 안 재게 된다(F207 이 말하는 그 자리). 기본값은 그대로 45초다. */
    const 예산 = Number(process.env.SYNK_AUTOCOMMIT_TEST_MS || 45000);
    /* 🔴 `NODE_TEST_CONTEXT` 를 물려주면 자식이 **자기를 러너가 아니라 「러너의 자식 파일」로** 안다 —
     *   실측: 적색 테스트인데 status **0**·stdout **빈 문자열**. 이 훅을 회귀에서 부르면 부모가
     *   `node --test` 라 항상 그 상태가 되고, 그러면 이 검사는 **영원히 초록**이다(F207 의 정확한 모양:
     *   미실행이 통과와 같은 얼굴로 온다). 자식 환경에서 지운다. */
    /* 🔑 그 위에 **CI 모사 한 벌**(tools/lib/ci모사환경 — TZ=UTC·빈 HOME)을 얹는다 (F389).
     *   이 검사가 지키는 것은 「원격 CI(UTC·홈 없음)가 빨개질 파일을 안 싣는 것」이라, 재는 눈금도
     *   그 층이라야 한다. 실 HOME 으로 재면 repo 밖(메모리층) 검사가 여기서만 켜져 — CI 에선
     *   초록일 테스트 파일이 남의 메모리 상태 탓에 손커밋으로 강등된다(같은 스위트의 세 러너
     *   중 마지막 남았던 실 HOME 갈래다: test-ci·clasp-guard 는 이미 한 벌). */
    let 모사 = null;
    try { 모사 = require(path.join(__dirname, '..', '..', 'tools', 'lib', 'ci모사환경.js')).만들기(); } catch (_) { /* 아래에서 미측정으로 */ }
    if (!모사) {
      // 환경을 못 조립하면 재지 못한 것이다 — 미실행을 통과로 접지 않는다(F207). 훅 전체를 죽이지도 않는다.
      미측정.push(...실을테스트);
      for (const f of 실을테스트) { const i = 후보.indexOf(f); if (i >= 0) 후보.splice(i, 1); }
    } else {
    const 자식env = 모사.env;
    delete 자식env.NODE_TEST_CONTEXT;
    const tr = spawnSync(process.execPath, ['--test', ...실을테스트], {
      cwd: 뿌리, env: 자식env, encoding: 'utf8', timeout: 예산, windowsHide: true,
    });
    모사.치우기();
    /* 🔑 **분모를 본다**(CLAUDE.md 「초록은 분모와 함께만 읽는다」). status 0 만 믿으면 위와 같은
     *   미실행이 그대로 통과가 된다 — 요약 줄(`ℹ fail N` · TAP 이면 `# fail N`)이 없으면 못 잰 것이다.
     * ⚠ **변이 시험이 이 줄을 못 잡는다(6/7)** — 바로 위 `delete` 가 지금 아는 유일한 산출 경로를
     *   막아서 이 조건이 도달 불가이기 때문이다. 지우지 않는 이유: 오늘 실측된 사고가 정확히
     *   「status 0 + 빈 출력」이었고, 그 얼굴을 만드는 원인이 그 env 하나뿐이라는 보장이 없다.
     *   즉 이건 죽은 코드가 아니라 **두 번째 자물쇠**고, 새는 방향(조용한 초록)이 나쁜 자리다. */
    const 요약있나 = /^[#ℹ]\s*fail\s+\d+/m.test(String(tr.stdout || ''));
    // 타임아웃은 status=null·signal 로 온다 — 실패(status≠0)와 갈라야 처방이 갈린다.
    const 못쟀다 = !!tr.error || tr.status === null || !요약있나;
    if (못쟀다 || tr.status !== 0) {
      (못쟀다 ? 미측정 : 적색).push(...실을테스트);
      for (const f of 실을테스트) { const i = 후보.indexOf(f); if (i >= 0) 후보.splice(i, 1); }
    }
    } // ← 모사 조립 성공 갈래 끝
  }

  const 뺀것있나 = 함께남김.length || 깨짐.length || 무기록.length || 밖에서바뀜.length || 적색.length || 미측정.length;
  if (!후보.length) return 뺀것있나 ? { 이름, 후보: [], 함께남김, 깨짐, 무기록, 밖에서바뀜, 적색, 미측정 } : null;

  const 이름들 = 후보.map((f) => path.basename(f));
  const 머리 = 이름들.slice(0, 3).join('·') + (이름들.length > 3 ? ` +${이름들.length - 3}` : '');
  const 메시지 = `자동커밋: ${머리} — 미커밋 노출 차단(Stop 훅)`;

  const add = git(['add', '--', ...후보], 뿌리);
  if (add.error || add.status !== 0) return { 이름, 후보: [], 함께남김, 깨짐, 무기록, 밖에서바뀜, 적색, 미측정, 실패: String(add.stderr || add.error || '').trim().slice(0, 160) };

  let cm;
  for (let 시도 = 0; 시도 < 3; 시도++) {
    cm = git(['commit', '-m', 메시지, '--', ...후보], 뿌리);
    if (!cm.error && cm.status === 0) break;
    if (!/index\.lock/.test(String(cm.stderr || ''))) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); // 옆 세션 훅과의 락 경합만 기다린다
  }
  if (cm.error || cm.status !== 0) return { 이름, 후보: [], 함께남김, 깨짐, 무기록, 밖에서바뀜, 적색, 미측정, 실패: String(cm.stderr || cm.error || '').trim().slice(0, 160) };

  /* 커밋했다고 믿지 말고 결과를 본다(F071) — 겹침·경로 어긋남이면 git 은 성공처럼 조용히 지나간다. */
  const 남은 = gitOk(['status', '--porcelain', '-z', '--', ...후보], 뿌리);
  const 미완 = (남은 === null || 남은.trim() !== '');
  return { 이름, 후보, 함께남김, 깨짐, 무기록, 밖에서바뀜, 적색, 미측정, 해시: (gitOk(['rev-parse', '--short', 'HEAD'], 뿌리) || '').trim(), 미완, 머리 };
}

let ss;
try { ss = owner.세션들(ROOT); } catch (_) { process.exit(0); }
const 산것들 = ss.filter(owner.살았나);
const 결과들 = [];

// ① 이 저장소 — 형제 좌표(`../…`)는 한저장소() 안에서 걸러진다.
{
  const 내기록 = 산것들.find((s) => s.sid === 나);
  if (내기록) {
    const 남 = new Set();
    for (const s of 산것들) if (s.sid !== 나) for (const f of s.touched) 남.add(슬래시(f));
    const r = 한저장소(ROOT, null, 내기록.touched, 남, 지문떼기(''));
    if (r) 결과들.push(r);
  }
}

// ② 형제 저장소들 — 좌표 정규화(ⓐ 그 저장소를 연 세션 / ⓑ 내 키의 `../이름/`)는 형제세션들이 진다.
try {
  for (const { 뿌리, 저장소 } of store.siblings(ROOT)) {
    let 형제ss;
    try { 형제ss = owner.형제세션들(뿌리, 저장소, ss); } catch (_) { continue; }
    const 내기록 = 형제ss.find((s) => s.sid === 나);
    if (!내기록) continue;
    const 남 = new Set();
    for (const s of 형제ss) if (s.sid !== 나 && owner.살았나(s)) for (const f of s.touched) 남.add(슬래시(f));
    const r = 한저장소(뿌리, 저장소, 내기록.touched, 남, 지문떼기(store.siblingPrefix(저장소)));
    if (r) 결과들.push(r);
  }
} catch (_) { /* 형제 조회 실패가 이 저장소의 커밋을 되돌리지는 않는다 */ }

if (!결과들.length) process.exit(0);

const 줄 = [];
for (const r of 결과들) {
  const 딱지 = r.이름 ? `${r.이름} ` : '';
  if (r.실패) { 줄.push(`[자동커밋] ⚠ ${딱지}커밋 실패 — 이번 턴은 물러난다: ${r.실패}`); continue; }
  if (r.후보.length) {
    줄.push(`[자동커밋] ${딱지}${r.후보.length}개 → ${r.해시} (${r.머리})`);
    if (r.미완) 줄.push(`   ⚠ 커밋 뒤에도 일부가 미커밋으로 남았다 — \`git -C ${r.이름 ? `../${r.이름}` : '.'} status\` 로 직접 확인`);
  }
  if (r.함께남김.length) 줄.push(`   ⚠ ${딱지}남이 함께 만진 ${r.함께남김.length}건은 남겼다(F104): ${r.함께남김.join(', ')} — git diff 로 가른 뒤 손 커밋`);
  if (r.깨짐.length) 줄.push(`   ⚠ ${딱지}구문 깨짐 ${r.깨짐.length}건 대기: ${r.깨짐.join(', ')} — 고쳐지면 다음 턴에 자동으로 실린다`);
  if (r.밖에서바뀜.length) 줄.push(`   ⚠ ${딱지}내가 쓴 뒤 **밖에서 바뀐** ${r.밖에서바뀜.length}건은 안 실었다(F225 — 변이 시험·스크립트가 놓아 둔 판일 수 있다): ${r.밖에서바뀜.join(', ')} — 내 판이 맞으면 다시 저장하면 다음 턴에 실린다`);
  if (r.무기록.length) 줄.push(`   ⚠ ${딱지}편집 지문이 없는 ${r.무기록.length}건은 안 실었다(편집이 거절됐거나 edit-stamp 훅이 안 돌았다): ${r.무기록.join(', ')} — 모름은 커밋하지 않는다`);
  /* F248: 처방은 **실행 가능해야** 한다 — 「짝을 같이 커밋해라」로 끝내면 무엇을·어떻게가 빈다. */
  if (r.적색 && r.적색.length) 줄.push(`   🔴 ${딱지}지금 **적색인** 테스트 ${r.적색.length}건은 안 실었다(F248 — 반쪽만 착지하면 master 가 빨개지고 남의 /deploy 가 막힌다): ${r.적색.join(', ')} — 짝(구현)까지 되면 다음 턴에 자동으로 실린다`);
  if (r.미측정 && r.미측정.length) 줄.push(`   ⚠ ${딱지}테스트 ${r.미측정.length}건은 **못 쟀다**(예산 초과·스폰 실패·요약 줄 없음)라 안 실었다 — 미실행은 통과가 아니다(F207). 직접 돌려 보고: git commit -m "..." -- ${r.미측정.join(' ')}`);
}
if (!줄.length) process.exit(0);
process.stdout.write(JSON.stringify({ systemMessage: 줄.join('\n') }));
process.exit(0);
