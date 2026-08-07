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
/* 세션 id 는 **호스트 id** 다 — 자동커밋·track-collision 이 보는 것과 같은 id 여야 짝이 맞는다(F074). */
const sid = String(process.env.CLAUDE_CODE_HOST_SESSION_ID || input.session_id || '').trim();
if (!sid) process.exit(0);

const 좌표 = store.touchKey(ROOT, path.resolve(abs));
if (!좌표) process.exit(0);                      // 저장소·형제 밖 — 자동커밋도 안 보는 공간이다

const 지문 = store.편집지문계산(path.resolve(abs));
if (!지문) process.exit(0);                      // 곧바로 지워졌다 — 자동커밋도 삭제는 안 싣는다

store.편집지문쓰기(ROOT, sid, 좌표, 지문);
process.exit(0);
