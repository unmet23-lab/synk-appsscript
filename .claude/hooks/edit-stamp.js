#!/usr/bin/env node
/* edit-stamp — 편집이 **성공한 직후** 그 파일의 바이트 지문을 남긴다 (PostToolUse · Edit|Write)
 *
 * 왜 있나 (마찰 F225 · 2026-08-07 실사고):
 *   자동커밋(Stop 훅)은 「내가 만진 파일」을 커밋한다. 그런데 만진 기록(track-collision)은
 *   **PreToolUse** 라 「편집하려 했다」까지만 알고, 그 뒤 디스크에 무엇이 놓였는지는 안 본다.
 *   변이 시험이 일부러 깨뜨린 판을 그 자리에 두고 턴이 끝나면 자동커밋이 그것을 그대로 실었다 —
 *   실물 `c3c8d98`: 변이 2개가 얹힌 `repo-staleness.js` 가 master 로 나갔고, 잔재 판정의
 *   핵심이 죽은 채였다. **새는 방향이 나쁘다** — 커밋 제목이 「자동커밋: 미커밋 노출 차단」이라
 *   정상 보호처럼 보인다. 이 저장소는 보드 줄마다 변이 시험을 요구하므로(「변이 N/N」) 그
 *   「깨진 파일이 디스크에 있는 시간」은 예외가 아니라 상시다.
 *
 *   자동커밋 머리말은 이미 이렇게 적어 뒀다 — 「Bash·외부 앱이 만든 변경은 기록이 없어
 *   원리적으로 못 가른다(모름은 커밋하지 않는다)」. 없던 것은 판정이 아니라 **기록**이다.
 *   이 훅이 그 기록이고, 그래서 판정은 한 줄로 끝난다: **내가 쓴 그 바이트가 아직 그대로인가.**
 *
 * 덤으로 닫히는 자리: **거절된 편집**. PreToolUse 는 거절돼도 만진 기록을 남기므로,
 *   내가 한 글자도 안 쓴 파일이 남의 손에 더러워지면 예전엔 그게 「내것」으로 실렸다.
 *   여기 지문이 없으면 자동커밋이 안 싣는다.
 *
 * 계약:
 *   · 좌표·상태경로·해시는 전부 `lib/handoff-store.js` 에서 나온다 — 여기서 다시 조립하지 않는다.
 *     갈라지면 증상이 「무기록=조용히 안 실림」이라 양쪽 회귀가 다 초록으로 보인다(맹점 ④).
 *   · **절대 차단하지 않는다**(인덱스지 가드가 아니다). 못 써도 조용히 물러난다 —
 *     그때 자동커밋은 「무기록=모름」으로 **안 싣는** 안전한 방향으로 떨어진다.
 *   · 저장소·형제 저장소 밖(스크래치패드)은 담지 않는다 — 자동커밋이 보는 공간과 같아야 한다.
 *   · 훅 파일을 **실행 불가로 만든 편집**은 그 자리에서 말한다(F239) — 차단은 여전히 안 한다.
 *
 * 회귀: tests/자동커밋.test.js (지문 통로 · 라우팅이 track-collision 보다 좁지 않은지)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const abs = String((input.tool_input && input.tool_input.file_path) || '').trim();
if (!abs) process.exit(0);

const ROOT = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
/* 자동커밋·track-collision 이 보는 것과 **같은 id** 여야 짝이 맞는다(F074) — 그래서 순서를
 * 여기 적지 않고 `세션식별.자리id()` 한 곳에서 받는다(F633). */
const sid = require(path.join(__dirname, 'lib', '세션식별.js')).자리id(process.env, input);
if (!sid) process.exit(0);

const 절대 = path.resolve(abs);
const 좌표 = store.touchKey(ROOT, 절대);
if (!좌표) process.exit(0);                      // 저장소·형제 밖 — 자동커밋도 안 보는 공간이다

const 지문 = store.편집지문계산(절대);
if (!지문) process.exit(0);                      // 곧바로 지워졌다 — 자동커밋도 삭제는 안 싣는다

store.편집지문쓰기(ROOT, sid, 좌표, 지문);

/* ── 훅 파일을 깨뜨렸으면 **그 자리에서** 말한다 (마찰 F239 · 2026-08-08 실측) ────────
 * 등록층의 F044 방어는 `command -v node` 와 `[ -f "$H" ]` 뿐이다 — 파일이 **있는데** 깨진
 * 경우는 그 둘을 그대로 통과하고, 이어지는 `node "$H"` 가 exit 1 + **빈 stdout** 으로 죽는다.
 * 하네스는 빈 출력을 「통과」로 읽으므로, 그 순간부터 그 가드가 막던 것이 전부 통과한다.
 * 실측: 남과 같은 자리를 고치다 board-guard.js 에 `let 이전` 이 두 번 선언된 3분이 있었고,
 * 그동안 보드 가드가 없었다. 알아챈 통로는 이 훅이 아니라 diff 를 눈으로 읽은 것이었다.
 *
 * ⚠ **차단하지 않는다.** 깨진 훅을 되돌리는 유일한 통로가 Edit 이라, 여기서 막으면 자기
 *   처방을 막는다(F103) — 게다가 Edit 에는 BYPASS 환경변수를 붙일 자리조차 없어 교착이다.
 *   자동커밋 쪽은 이미 같은 판정으로 **안 싣는다**(`구문깨졌나`) — 새는 방향은 그쪽이 받는다.
 * ⚠ 실패해도 조용히 물러난다 — 지문은 위에서 이미 썼다. 이 알림 때문에 인덱스를 잃지 않는다. */
try {
  if (/[\\/]\.claude[\\/]hooks[\\/].+\.(?:js|mjs|cjs)$/i.test(절대) && store.구문깨졌나(절대)) {
    const 이름 = path.relative(ROOT, 절대).replace(/\\/g, '/');
    const 글 = `🔴 [edit-stamp] 훅 파일이 지금 **실행 불가**다 — ${이름}\n`
      + '   등록층은 「node 가 있나 · 파일이 있나」만 재므로 이건 그대로 통과하고, 훅이 exit 1 + 빈 stdout 으로\n'
      + '   죽으면 하네스는 그것을 **통과**로 읽는다. 즉 이 가드가 막던 것이 지금 전부 통과한다(F239).\n'
      + `→ 지금 고친다: \`node --check ${이름}\` 로 자리를 보고 **Edit 로** 되돌린다(셸 편집은 code-edit-guard 가 막는다).\n`
      + '   남과 함께 만진 파일이면 내 것만 걷어낸다 — `git diff` 로 가른 뒤 내 헝크만 되돌린다(F073).';
    process.stdout.write(JSON.stringify({
      systemMessage: 글,
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 글 },
    }));
  }
} catch (_) { /* 알림 실패가 지문을 되돌리지는 않는다 */ }
process.exit(0);
