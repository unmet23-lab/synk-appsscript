#!/usr/bin/env node
// session-end-handoff — 세션이 끝날 때 인계 바통을 떨군다 (SessionEnd 훅)
//
// 왜 있나 (08-04 실측 결함 ④) — 인계가 **🔴(150k) 도달 시에만** 걸려 있었다.
//   그런데 대부분의 세션은 임계에 안 닿고 끝난다. 즉 자동 인계가 **평상시엔 아예 안 돌았다**.
//   유호님 요구("자동화가 되어야해")의 핵심이 여기다: 유호님은 그냥 창을 닫고 새로 열 뿐이고,
//   그 전환마다 다음 세션이 직전 작업을 알고 시작해야 한다.
//
// 아무 세션에서나 떨구지는 않는다 — **일한 세션만**:
//   ① 이 세션 이름으로 된 커밋이 있거나 ② **내가** 편집한 파일이 있거나 ③ 임계(🟡)를 넘겼거나.
//   질문 한 번 하고 끝난 세션까지 바통을 남기면, 다음 세션이 「이어서 작업한다」를 물고
//   시작해 엉뚱한 일을 한다. 인계문은 **다음 세션의 컨텍스트에 실리는 비용**이기도 하다.
//
// ⚠ SessionEnd 는 **1.5초 예산**을 공유한다(공식 문서). 그래서 여기서 하는 일은
//   git 두 번 + 파일 쓰기 하나뿐이다. 무거운 걸 넣으면 조용히 잘린다.
// ⚠ 창을 강제로 닫으면 이 훅이 못 돌 수 있다. 그래서 context-budget(Stop)이 🔴에서
//   미리 바통을 떨궈 둔다 — **두 겹인 게 설계다**(같은 세션이면 나중 것이 덮어쓴다).
'use strict';
const fs = require('fs');
const path = require('path');
const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
const report = require(path.join(__dirname, 'lib', 'session-report.js'));

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { /* 입력 없이도 진행 */ }

const cwd = input.cwd || process.cwd();
const sid = input.session_id;
const reason = String(input.reason || input.matcher || '');

// `resume`·`compact` 는 세션이 **끝난 게 아니라 이어지는** 것이다 — 인계문을 남기면 중복이 된다.
if (reason === 'resume' || reason === 'compact') process.exit(0);

/* 죽음에 도장을 찍는다 (F252). 여기가 「일한 세션」 판정보다 **위**인 이유: 도장은 인계문과
 * 목적이 다르다 — 인계문은 다음 세션이 읽을 것이라 일한 세션만 남기지만, 도장은 「이 세션의
 * 미커밋을 이어받아도 되는가」의 근거라 **끝난 모든 세션**이 찍어야 한다. 아래 worked 게이트
 * 안에 두면 조용히 안 찍히는 세션이 생기고, 그 세션의 유물은 영영 ❔에 갇힌다. */
store.markEnded(cwd, report.hostSessionId(sid));

store.sweep(); // 종료 시점은 청소하기 좋은 자리다(다음 세션 읽기가 빨라진다)

const dirty = report.dirtyCount(cwd);
const commits = report.myCommits(cwd, report.hostSessionId(sid));
const stage = store.readStage(cwd, sid); // 🟡 이상을 넘겼으면 1 이상

/* ② 는 「미커밋이 있다」가 아니라 «내» 미커밋이 있다 (2026-08-12 유호님 신고 · 실측).
 *   `dirtyCount` 는 저장소 **전체**를 센다. 이 저장소는 세션이 동시에 여덟씩 돌아 미커밋이
 *   0 이 된 적이 없다 — 그래서 위 머리말이 막겠다고 적어 둔 「질문 한 번 하고 끝난 세션」을
 *   ②가 **원리상 한 번도 못 걸렀다**(늘 참). 실측: 인계문 55건 중 10건이 커밋 0·트랙 0이고,
 *   그 10건은 다음 창에 「이어서 작업한다」로 박혀 없는 트랙을 이어받게 했다(예 `8a384d90`
 *   — 제가 한 일은 없고 **남의** 미커밋 12건 때문에 「일한 세션」이 됐다).
 * 🔑 재는 층을 옮긴다: 저장소의 더러움(남의 것 포함) → **이 세션이 남긴 편집 도장**
 *   (`edit-stamp` PostToolUse · Edit|Write|MultiEdit|NotebookEdit). id 는 반드시
 *   `hostSessionId` 다 — 도장을 찍는 쪽이 그 id 이고(F074), 어긋나면 늘 `{}` 라 **모든
 *   세션이 조용히 바통을 잃는다**(새는 방향이 「무기록」이라 화면에 아무 표도 안 난다).
 * ⚠ 새는 방향은 「남긴다」로 둔다 — 못 남기는 손해가 하나 더 남기는 손해보다 크다.
 *   도장이 **빈 것**과 통로가 **죽은 것**은 둘 다 `{}` 라 안 갈린다(편집지문읽기 주석). 그래서
 *   통로의 생사를 **따로** 잰다: 이 저장소 이름으로 찍힌 도장이 하나라도 있으면 살아 있다.
 *   ⚠ `STATE_DIR 이 있나` 로 근사하면 안 된다 — `edit-stamp` 가 등록에서 빠지거나 죽으면
 *   폴더는 멀쩡한 채 도장만 0 이 되고, 그러면 **모든 세션이 조용히 바통을 잃는다**(가드가
 *   등록층에서 새는 그 형태 · 여기서 새는 방향은 「통과」가 아니라 「무기록」이라 더 안 보인다).
 *   통로가 안 보이면 옛 판정(저장소 전체)으로 폴백한다 — 바통 하나 더 남는 쪽이 안전하다.
 * ⚠ Bash·외부 앱이 만든 변경엔 도장이 없다 — 그건 ①(커밋)·③(임계)이 받는다. 코드 파일의
 *   셸 편집은 `code-edit-guard` 가 이미 막으므로 여기 남는 구멍은 문서뿐이다. */
let 내미커밋;
try {
  const 도장들 = fs.readdirSync(store.stateDir())
    .filter((f) => f.startsWith(`editstamp-${store.projectKey(cwd)}-`));
  if (!도장들.length) throw new Error('통로 불명');           // 아무도 안 찍었다 → 폴백
  내미커밋 = Object.keys(store.편집지문읽기(cwd, report.hostSessionId(sid))).length > 0;
} catch (_) {
  내미커밋 = dirty !== null && dirty > 0;                     // 옛 판정 폴백
}

// 「일한 세션」 판정. 셋 다 아니면 조용히 나간다.
const worked = commits.length > 0 || 내미커밋 || stage > 0;
if (!worked) process.exit(0);

/* ㈎ 「일했나」와 「실을 것이 있나」는 **다른 질문**이다 (F661 ㈎ · 유호 픽 2026-08-19).
 *   위 `worked` 게이트는 ①커밋 ②내 편집 도장 ③임계 중 하나면 통과다. 그래서 **문서 한 줄만
 *   고치고 커밋도 보드 선언도 없이 끝난 세션**이 계속 통과했고, 그 인계문은 다음 창에
 *   「커밋 없음 · 트랙 없음 · 새 트랙을 잡아라」만 싣고 **유호님의 첫 발화 자리**를 썼다.
 *   실측 2026-08-19(git 이력 전량 47건): 그런 «빈껍데기»가 4건 9%. 이 훅 머리말의 ② 수리
 *   (저장소 더러움 → 내 편집 도장)가 55건 중 10건(18%)을 9%까지 내렸고, 여기가 그 나머지다.
 * 🔑 판정은 `buildHandoff` 가 커밋·보드 줄을 재며 채운다 — 여기서 다시 재지 않는다(1.5초 예산).
 * ⚠ 사본도 같이 안 쓴다: 사본은 「자동 입력이 안 닿는 자리에서 열어 복사할 것」인데, 복사해도
 *   실을 것이 없는 글이라 남길 값이 없다. 오히려 `인계문수거` 훅이 그 빈 파일을 커밋해
 *   이력에 잡음을 남긴다(실측: 그 커밋이 실제로 났다). */
const 메타 = {};
const msg = report.buildHandoff(cwd, sid, { dirty, reason: reason || undefined, 메타 });

if (메타.실을것없음) {
  process.stdout.write(JSON.stringify({
    systemMessage: '↪ 인계 바통을 **안 남겼다** — 이 세션은 커밋도 보드 줄도 없어 다음 창에 실을 것이 없다'
      + '(F661 ㈎). 새 창은 빈 첫 메시지로 열린다 — 유호님 용건이 그 세션의 출발점이 된다.',
  }));
  process.exit(0);
}

store.drop(cwd, sid, msg, { trigger: `session-end:${reason || 'other'}`, ...메타 });
// 파일로도 남긴다 — 바통은 새 창이 **자동으로** 물지만, 자동 입력이 안 닿는 자리
// (다른 계정·폰·자동 입력 실패)에서는 유호님이 열어서 복사할 것이 있어야 한다.
const 파일 = report.writeHandoffFile(cwd, msg, { sessionId: report.hostSessionId(sid), reason: reason || undefined });

// SessionEnd 의 출력은 유호님 화면에 스치듯 지나간다 — 짧게 한 줄만.
process.stdout.write(JSON.stringify({
  systemMessage: `↪ 인계 바통을 남겼다(커밋 ${commits.length}건${dirty === null ? '' : ` · 미커밋 ${dirty}건`}). 새 세션에서 자동으로 이어진다${파일 ? ' · 사본 docs/_ops/인계문.md' : ''}.`,
}));
process.exit(0);
