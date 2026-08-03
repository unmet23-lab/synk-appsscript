#!/usr/bin/env node
// screenshot-budget — 원격 작업의 스크린샷 남발 차단 (PreToolUse 훅)
//
// 왜 있나 — 프로즈가 **두 번** 실패했다.
//   ① 2026-07-31: 컨텍스트 낭비 범인이 스크린샷 448장으로 실측됨 → CLAUDE.md v6.10에
//      「화면 확인은 텍스트 우선, 스크린샷은 좌표 클릭용+최종 증명 1장만」 조항 신설.
//   ② 2026-08-04: 그 조항이 있는 상태에서 한 세션에 20장+ 를 또 찍었다(유호님 교정).
//   → 지침 자기 규칙 「같은 절차에서 2번째 = 시스템 결함, 처방은 기계」의 적용.
//
// 정책 = 사다리(막기만 하면 좌표 클릭이 필요한 실작업이 불가능해진다):
//   1..FREE      조용히 통과
//   FREE+1..HARD 통과하되 **매번 남은 예산을 눈에 보이게** 알린다(대체 수단 제시)
//   HARD 초과    차단 — 텍스트 도구로 갈아타거나, 사유를 밝히고 예산을 리셋한다
//
// 리셋(의도적 예외): node .claude/hooks/screenshot-budget.js --reset
//   리셋은 막지 않는다. 목적은 금지가 아니라 **「지금 정말 그림이 필요한가」를 한 번 묻는 것**이다.
//
// 세지 않는 것: 텍스트 판독 도구(read_page·find·get_page_text)와 클릭·타이핑은 대상이 아니다 — 권장 경로다.
//
// 3번째 실패(2026-08-04 실측) — 훅이 있는데도 한 세션이 40장을 찍었다. 원인은 **판정층이 둘**이었다는 것:
//   settings.json의 `case "$IN" in *screenshot*` 필터와 이 파일의 액션 판정이 각각 따로 알았고,
//   둘 다 ①배치 도구(browser_batch·computer_batch) ②scroll을 몰랐다. 실측 근거:
//     · browser_batch 18회 → 이미지 13장·161만 자 통과(훅 발화 0회)
//     · computer_batch  8회 → 이미지 8장 통과(훅 발화 0회)
//     · computer|scroll 6회 → 이미지 5장·58만 자 통과(훅은 screenshot|zoom만 셌다)
//   처방(「원인을 쓸 수 없게 만든다」) = settings.json의 case 필터를 없애 **판정층을 이 파일 하나로** 모으고,
//   액션 이름을 키 위치로 찾지 않고 입력 트리를 재귀로 훑는다(배치 형태가 둘이라 키가 다르다).
//   회귀 = tests/스크린샷예산.test.js (배치·scroll·매처 등록까지 검사).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const FREE = 4;   // 조용히 통과
const HARD = 9;   // 이 수를 넘기면 차단(= 10번째부터)

const DIR = path.join(os.tmpdir(), 'synk-screenshot-budget');

function counterFile(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return path.join(DIR, `${safe}.json`);
}

function readCount(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    // 24시간 지난 카운터는 남의(또는 옛) 세션 잔재로 보고 0부터
    if (!j.at || Date.now() - j.at > 24 * 60 * 60 * 1000) return 0;
    return Number(j.n) || 0;
  } catch (_) {
    return 0;
  }
}

function writeCount(file, n) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ n, at: Date.now() }));
  } catch (_) {
    /* 카운터를 못 써도 작업을 막지 않는다 — 이 훅은 예산 관리지 안전장치가 아니다 */
  }
}

// --reset : 의도적 예외. 인자로 세션 id를 받으면 그것만, 없으면 전체.
if (process.argv.includes('--reset')) {
  const idIdx = process.argv.indexOf('--session');
  try {
    if (idIdx !== -1 && process.argv[idIdx + 1]) {
      fs.unlinkSync(counterFile(process.argv[idIdx + 1]));
    } else {
      for (const f of fs.readdirSync(DIR)) fs.unlinkSync(path.join(DIR, f));
    }
    console.log('[screenshot-budget] 예산을 리셋했다. 왜 그림이 필요한지 답에 1줄 남길 것.');
  } catch (_) {
    console.log('[screenshot-budget] 리셋할 카운터가 없다(이미 0).');
  }
  process.exit(0);
}

function out(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0);
}

const tool = String(input.tool_name || '');
const ti = input.tool_input || {};

// 그림을 낳는 액션. zoom·scroll도 이미지를 되돌려준다(08-04 실측: scroll 6회 중 5회가 이미지).
const IMAGE_ACTION = /^(screenshot|zoom|scroll)$/;

// 입력 트리에서 이미지 액션의 **개수**를 센다.
// 키 위치로 찾지 않는 이유 = 배치 형태가 둘이고 중첩이 다르다(실측):
//   computer_batch : {actions:[{action:'screenshot'}]}
//   browser_batch  : {actions:[{name:'computer', input:{action:'screenshot'}}]}
// 배치 1회가 그림 3장이면 예산도 3장을 먹어야 한다 — 그게 컨텍스트에 실제로 실리는 양이다.
function countImageActions(v, depth) {
  if (!v || typeof v !== 'object' || depth > 6) return 0;
  if (Array.isArray(v)) {
    let n = 0;
    for (const x of v) n += countImageActions(x, depth + 1);
    return n;
  }
  let n = 0;
  if (typeof v.action === 'string' && IMAGE_ACTION.test(v.action)) n += 1;
  for (const [k, x] of Object.entries(v)) {
    if (k === 'action') continue;
    if (x && typeof x === 'object') n += countImageActions(x, depth + 1);
  }
  return n;
}

// 이름 자체가 그림인 도구(mcp__computer-use__screenshot 등)는 액션 필드가 없다.
const shots = /__(screenshot|zoom)$/.test(tool) ? 1 : countImageActions(ti, 0);

if (shots < 1) process.exit(0);

const file = counterFile(input.session_id);
const n = readCount(file) + shots;

const ALT =
  '대체 수단 — 내용·구조 확인은 `read_page`(접근성 트리·ref 포함) · 요소 찾기는 `find` · ' +
  '본문만 필요하면 `get_page_text` · 클릭은 좌표 대신 `ref` · 화면을 내리는 대신 `scroll_to`(ref). ' +
  '그림이 정말 필요한 자리는 ①ref가 없는 요소의 좌표 클릭 ②최종 증명 1장뿐이다.';

if (n > HARD) {
  // 카운터를 올리지 않는다 — 차단된 시도까지 세면 리셋 없이는 영원히 막힌다
  out(
    'deny',
    `[screenshot-budget] 이 세션에서 이미 ${n - shots}장을 찍었다 — 이번 호출 ${shots}장까지면 상한 ${HARD}장 초과.\n` +
      `${ALT}\n` +
      '정말 그림이 필요하면: `node .claude/hooks/screenshot-budget.js --reset` 실행 후 ' +
      '**왜 필요한지 답에 1줄** 남기고 다시 시도한다.\n' +
      '(근거: 프로즈 조항이 2회 실패 — 07-31 448장, 08-04 20장+)'
  );
}

writeCount(file, n);

if (n > FREE) {
  out('allow', `[screenshot-budget] ${n}/${HARD}장. 남은 ${HARD - n}장. ${ALT}`);
}

process.exit(0);
