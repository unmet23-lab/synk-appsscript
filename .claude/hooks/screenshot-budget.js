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
//
// 4번째 실패(2026-08-05 실측) — 훅도 매처도 멀쩡한데 하루 146장이 통과했다.
//   샌 곳은 로직도 등록층도 아니고 **예산의 단위**였다: 상한이 「세션당」이라
//   하루 24세션이면 상한도 24배가 된다(세션당 9장 × 24 = 216장이 규칙상 합법).
//   7일 실측: 브라우저·컴퓨터 도구 4종이 도구결과 점유의 81%, 이미지 1,177장.
//   처방 = **일일 누적 예산을 겹친다**(세션당은 그대로 두고 둘 중 먼저 걸리는 쪽이 이긴다).
//   ⚠ 세션 예산만 리셋해도 일일 예산은 살아 있다 — 그게 이 층을 만든 이유다.
//
// 같은 커밋의 두 번째 층: **한 호출의 액션 수**(BLOCK_*).
//   근거는 캐시 구조다 — 프롬프트 캐시의 breakpoint는 뒤로 최대 20블록만 훑는데,
//   한 턴이 그 폭을 넘기면 다음 턴이 이전 캐시를 못 찾고 **프리픽스를 통째로 다시 쓴다**.
//   캐시 쓰기는 읽기의 12.5배라, 54만 컨텍스트에서 1회 미스 = 67.5만 가중 단위.
//   실측된 것은 증상(단건 70만 토큰 재캐시 196건·모델전환/TTL/서브에이전트는 대조로 기각)이고,
//   20블록이 그 원인이라는 것은 캐시 문서에 근거한 **추론**이다. 그래서 상한을 넉넉히 잡고
//   차단보다 경고 구간을 길게 뒀다 — 틀렸을 때 실작업을 막지 않기 위해서다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const FREE = 4;   // 세션: 조용히 통과
const HARD = 9;   // 세션: 이 수를 넘기면 차단(= 10번째부터)

const DAY_FREE = 12;  // 하루: 조용히 통과
const DAY_HARD = 25;  // 하루: 이 수를 넘기면 차단 (실측 168장/일 → 약 1/7)

const BLOCK_FREE = 6;   // 한 호출의 액션 수: 조용히 통과
const BLOCK_HARD = 12;  // 한 호출의 액션 수: 이 수를 넘기면 차단

// 이음매 2개는 **테스트 격리 전용**이다(로직을 끄지 않는다 — 카운터를 어디에 둘지만 바꾼다).
// 이게 없으면 회귀 테스트가 실환경 일일 예산을 먹어 치우고, 반대로 실환경이 테스트를 흔든다.
const DIR = process.env.SYNK_BUDGET_DIR || path.join(os.tmpdir(), 'synk-screenshot-budget');

// 날짜는 로컬 기준. 주입 가능하게 둔 이유 = 「날이 바뀌면 초기화된다」를 회귀로 못박기 위해서다
// (실제 자정을 기다리는 테스트는 CI에서 못 돈다).
function dayKey() {
  if (process.env.SYNK_BUDGET_DAY) return String(process.env.SYNK_BUDGET_DAY);
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function counterFile(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return path.join(DIR, `${safe}.json`);
}

// 일일 카운터는 세션 파일과 같은 폴더에 산다 — 바 `--reset`이 둘 다 지우게 하려고.
function dayFile() {
  return path.join(DIR, `day-${dayKey().replace(/[^0-9-]/g, '_')}.json`);
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

// --reset : 의도적 예외.
//   `--reset`             → 세션·일일 카운터 전부 (일일 상한을 푸는 유일한 통로)
//   `--reset --session X` → 그 세션만. **일일 예산은 그대로 남는다** — 세션을 갈아타며
//                           일일 상한을 우회하는 걸 막기 위해서다(4번째 실패의 원인이 그것이었다).
if (process.argv.includes('--reset')) {
  const idIdx = process.argv.indexOf('--session');
  try {
    if (idIdx !== -1 && process.argv[idIdx + 1]) {
      fs.unlinkSync(counterFile(process.argv[idIdx + 1]));
      console.log('[screenshot-budget] 그 세션의 예산만 리셋했다 (일일 예산은 그대로).');
      process.exit(0);
    }
    for (const f of fs.readdirSync(DIR)) fs.unlinkSync(path.join(DIR, f));
    console.log('[screenshot-budget] 세션·일일 예산을 리셋했다. 왜 그림이 필요한지 답에 1줄 남길 것.');
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

// 한 호출이 낳는 **액션 수**. 그림 여부와 무관하다 — 클릭 15개짜리 배치도 결과 블록 15개를 만들고,
// 그게 20블록 룩백을 깨면 다음 턴이 프리픽스를 통째로 재캐시한다(캐시 쓰기 = 읽기의 12.5배).
// countImageActions와 같은 트리를 훑되 액션 이름을 가리지 않는다 — 파서가 둘이면 또 갈라진다.
function countActions(v, depth) {
  if (!v || typeof v !== 'object' || depth > 6) return 0;
  if (Array.isArray(v)) {
    let n = 0;
    for (const x of v) n += countActions(x, depth + 1);
    return n;
  }
  let n = 0;
  if (typeof v.action === 'string') n += 1;
  for (const [k, x] of Object.entries(v)) {
    if (k === 'action') continue;
    if (x && typeof x === 'object') n += countActions(x, depth + 1);
  }
  return n;
}

// 이름 자체가 그림인 도구(mcp__computer-use__screenshot 등)는 액션 필드가 없다.
const shots = /__(screenshot|zoom)$/.test(tool) ? 1 : countImageActions(ti, 0);
const blocks = countActions(ti, 0);

const ALT =
  '대체 수단 — 내용·구조 확인은 `read_page`(접근성 트리·ref 포함) · 요소 찾기는 `find` · ' +
  '본문만 필요하면 `get_page_text` · 클릭은 좌표 대신 `ref` · 화면을 내리는 대신 `scroll_to`(ref). ' +
  '그림이 정말 필요한 자리는 ①ref가 없는 요소의 좌표 클릭 ②최종 증명 1장뿐이다.';

const BLOCK_ALT =
  '한 호출에 액션을 몰아넣지 말고 나눠 던진다 — 결과 블록이 20개를 넘기면 다음 턴이 ' +
  '이전 캐시를 못 찾고 프리픽스를 통째로 다시 쓴다(캐시 쓰기 = 읽기의 12.5배).';

// ① 액션 수 상한 — 그림이 없어도 걸린다(클릭만 든 대형 배치가 정확히 이 문제다)
if (blocks > BLOCK_HARD) {
  out(
    'deny',
    `[screenshot-budget] 이 호출에 액션 ${blocks}개 — 한 호출 상한 ${BLOCK_HARD}개 초과.\n` +
      `${BLOCK_ALT}\n` +
      '정말 한 번에 보내야 하면: `node .claude/hooks/screenshot-budget.js --reset` 후 사유를 1줄 남긴다.'
  );
}

// 그림이 없으면 이미지 예산은 건드리지 않는다(권장 경로를 벌주지 않는다) — 액션 수만 알린다
if (shots < 1) {
  if (blocks > BLOCK_FREE) {
    out('allow', `[screenshot-budget] 이 호출에 액션 ${blocks}개(상한 ${BLOCK_HARD}). ${BLOCK_ALT}`);
  }
  process.exit(0);
}

const file = counterFile(input.session_id);
const n = readCount(file) + shots;
const dfile = dayFile();
const dn = readCount(dfile) + shots;

// ② 세션 상한. 카운터를 올리지 않는다 — 차단된 시도까지 세면 리셋 없이는 영원히 막힌다
if (n > HARD) {
  out(
    'deny',
    `[screenshot-budget] 이 세션에서 이미 ${n - shots}장을 찍었다 — 이번 호출 ${shots}장까지면 상한 ${HARD}장 초과.\n` +
      `${ALT}\n` +
      '정말 그림이 필요하면: `node .claude/hooks/screenshot-budget.js --reset` 실행 후 ' +
      '**왜 필요한지 답에 1줄** 남기고 다시 시도한다.\n' +
      '(근거: 프로즈 조항이 2회 실패 — 07-31 448장, 08-04 20장+)'
  );
}

// ③ 일일 상한 — 세션을 갈아타도 이건 안 리셋된다(그게 4번째 실패의 처방이다)
if (dn > DAY_HARD) {
  out(
    'deny',
    `[screenshot-budget] 오늘 이미 ${dn - shots}장 — 이번 호출 ${shots}장까지면 **일일 상한 ${DAY_HARD}장** 초과.\n` +
      '세션을 새로 열어도 이 예산은 그대로다. 상한이 세션당이던 08-04에 하루 146장이 통과했고, ' +
      '그 이미지들은 각 세션의 남은 턴 수만큼 재청구됐다.\n' +
      `${ALT}\n` +
      '오늘 정말 더 필요하면: `node .claude/hooks/screenshot-budget.js --reset`(세션·일일 전부) 후 사유를 1줄 남긴다.'
  );
}

writeCount(file, n);
writeCount(dfile, dn);

const notes = [];
if (n > FREE) notes.push(`세션 ${n}/${HARD}장`);
if (dn > DAY_FREE) notes.push(`오늘 ${dn}/${DAY_HARD}장`);
if (blocks > BLOCK_FREE) notes.push(`이 호출 액션 ${blocks}개`);

if (notes.length) {
  out('allow', `[screenshot-budget] ${notes.join(' · ')}. ${ALT}`);
}

process.exit(0);
