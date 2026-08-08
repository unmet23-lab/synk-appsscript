#!/usr/bin/env node
// board-guard — 세션보드 비대화 차단 (PreToolUse 훅)
// CLAUDE.md 신뢰성 조항의 기계 강제: "줄은 선언만"이라는 프로즈 규칙이 지켜지지 않아
// 보드가 70,628자(추정 5~7만 토큰)까지 부푼 2026-07-31 사고의 재발 방지 장치.
// 검사 2종 — ①표 한 칸 200자 초과 금지 ②표 데이터 줄 14줄 초과 금지.
// 통과 시 출력 없이 종료. 아카이브 파일(docs/세션보드_아카이브.md)은 검사 대상이 아니다.
'use strict';
const fs = require('fs');
const path = require('path');
const 표 = require(path.join(__dirname, '..', '..', 'tools', 'lib', '표.js'));

const MAX_CELL = 200;
const MAX_ACTIVE = 12; // 활성(완료 아닌) 줄 상한 — 병행 세션이 실제로 조율해야 하는 대상
const MAX_ROWS = 18;   // 전체 상한 — 완료 줄이 쌓이는 것도 결국 막는다(6줄 여유)

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

/* ── 순서: **되돌릴 수 없는 것을 먼저 말한다** (마찰 F221 · 2026-08-08 실측) ──────
 * ①②③은 `deny` 로 즉시 끝내고 ④(자리 겹침)는 파일 맨 뒤에 있었다. 그래서 **만석이면 ④ 가
 * 구조적으로 침묵한다** — 그리고 만석은 이 저장소의 일상이다(F224 가 방금 그 처방을 세웠다).
 * 실물: 내 F226 선언이 「표가 19줄이 된다」에만 막혀, 0분 전 남이 **같은 트랙·같은 파일**을
 * 선언한 것을 한 마디도 못 들었다. 알아챈 통로는 가드가 아니라 board-move 부산물이었다.
 * 비대칭이 뿌리다 — 칸 초과·만석은 **되돌릴 수 있는 불편**(문장을 줄이거나 줄을 옮기면 끝)이고,
 * 겹침은 **되돌릴 수 없는 손해**(중복 구현·조사 낭비)다. 되돌릴 수 있는 쪽이 앞을 막고 있었다.
 * 그래서 ①②③은 사유를 **보류**만 하고, ④를 지난 뒤에 낸다(막는 힘은 그대로다 — 순서만 바뀐다). */
let 보류 = null;
const 미룬deny = (reason) => { if (보류 === null) 보류 = reason; };

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0);
}

const tool = String(input.tool_name || '');
if (!/^(Edit|Write|MultiEdit)$/.test(tool)) process.exit(0);

const ti = input.tool_input || {};
const filePath = String(ti.file_path || '');
const base = path.basename(filePath.replace(/\\/g, '/'));
if (base !== '세션보드.md') process.exit(0); // 아카이브·다른 문서는 통과

// 편집 종류별로 "새로 들어가는 텍스트"와 "줄 수 증감"을 모은다
const edits = tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti];
const incoming = [];
let delta = 0;
let activeDelta = 0;
let fullContent = null;

if (tool === 'Write') {
  fullContent = String(ti.content || '');
  incoming.push(fullContent);
} else {
  for (const e of edits) {
    const ns = String(e.new_string || '');
    const os = String(e.old_string || '');
    incoming.push(ns);
    delta += countRows(ns) - countRows(os);
    activeDelta += countActive(ns) - countActive(os);
  }
}

/* ── 결과 기반 검사 (2026-08-01 실사고 대응) ───────────────────────────────
 * 들어오는 '조각'만 보면 **상태 칸 하나를 갈아끼우는 편집**(보드 갱신의 가장 흔한 모양)이
 * `|`로 시작하지 않아 isDataRow를 통과하지 못하고 검사 자체를 건너뛰었다.
 * 그 결과 같은 날 200자 위반이 두 번(274자 `ab2c60d` · 213자 `aa68ac7`) 그대로 들어갔고
 * 둘 다 훅이 아니라 사람이 눈으로 잡았다 — 가드가 있다는 믿음이 없는 것보다 위험했다.
 * 기존 테스트가 못 잡은 이유도 같다: 모든 케이스가 new_string을 `|`로 시작하는 완전한 행으로 만들었다
 * (실사용이 아니라 구현의 가정을 시험한 것).
 * → **조각의 생김새에 앵커를 걸지 않는다.** 편집을 실제로 적용한 결과 파일을 검사한다. */
function applyEdits(content) {
  let out = content;
  for (const e of edits) {
    const os = String(e.old_string || '');
    const ns = String(e.new_string || '');
    if (!os || !out.includes(os)) return null; // 매칭 실패 = Edit 자체가 실패할 것 → 판단 보류
    out = e.replace_all ? out.split(os).join(ns) : out.replace(os, () => ns);
  }
  return out;
}

let resulting = fullContent;
if (resulting === null) {
  try {
    resulting = applyEdits(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    resulting = null; // 파일을 못 읽으면 아래 폴백으로
  }
}

function isDataRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return false;
  if (/^\|[\s:|-]+\|$/.test(t)) return false;        // 구분선 |---|---|
  if (/^\|\s*날짜\s*\|/.test(t)) return false;        // 헤더
  return true;
}

function countRows(text) {
  return text.split('\n').filter(isDataRow).length;
}

// 활성 = 상태 칸이 '완료'로 시작하지 않는 줄(작업중·진행중·대기·미확정…).
//
// [2026-08-03 수리] 보드의 실제 표기는 **완료** — 굵게 쓴다. 그런데 원래 판정은 `/^완료/`라
// 앞의 `**`에 걸려 **완료 줄이 전부 활성으로 세어졌다.** 결과: 활성 상한(12)이 사실상
// 전체 상한처럼 작동해, 완료 줄만 12개여도 새 세션이 자기 줄을 못 넣었다(실제로 막혔다).
// 「오분류는 활성을 줄이는 방향뿐」이라던 원래 주석은 방향이 반대였다 — 늘리는 방향이었다.
// 그래서 장식을 떼고 판정한다. 가드가 검사해야 하는 건 문법이 아니라 **사람이 실제로 쓰는 표기**다.
// 장식 패턴은 **함수 안**에 둔다 — 이 파일은 톱레벨에서 countActive를 부르는데,
// 톱레벨 const로 빼면 그 시점엔 아직 초기화 전이라 TDZ로 죽는다(고치자마자 한 번 밟았다).
// `node --check`는 구문만 보므로 이 부류를 못 잡는다. 잡은 건 테스트였다.
// [2026-08-04 재수리 · F094] 위 수리로도 부족했다 — 장식을 뗀 뒤 `/^완료/`로 봤는데
// 사람들이 쓰는 실제 표기는 `**✅전량 종결**`·`**✅라이브 [v9.183]**`처럼 **완료로 시작하지 않는다.**
// 다시 완료 줄이 활성으로 세어져 활성 16줄이 됐고, 새 세션이 자기 줄을 못 넣었다(내가 그걸 밟았다).
//
// 🔑 같은 자리 **2번째**다. 접두를 하나씩 추가하는 방식이면 3번째가 반드시 온다 —
//   원인은 접두가 아니라 **「무엇으로 시작하는가」로 판정한 것**이다.
//   그래서 판정을 어휘 두 목록으로 바꾸고, **그 목록에서 안내 문구까지 파생**시킨다.
//   F094 가 지목한 재발 원인이 「처방을 따를 수 없어 표기가 갈라진다」이므로,
//   가드가 **무엇을 쓰면 완료로 세는지 스스로 말해야** 갈라짐이 멈춘다.
//
// ⚠ 활성 어휘가 **이긴다**(우선순위). 「라이브 검증 중」처럼 두 어휘가 같이 있는 줄은
//   활성으로 봐야 한다 — 활성을 완료로 세는 오분류는 **조용히** 보드를 늘리고,
//   조용한 누수가 시끄러운 누수보다 나쁘다(새는 방향은 언제나 통과다).
// ⚠ **함수로 둔다.** 톱레벨 const 로 빼면 이 파일이 57행에서 countActive 를 먼저 부르므로
//   TDZ 로 죽는다 — 위 08-03 주석이 정확히 그 경고를 남겼는데 08-04 수리에서 **또 밟았다**.
//   `node --check` 는 구문만 보므로 이 부류를 못 잡는다. 잡은 건 이번에도 테스트였다.
function 어휘() {
  return {
    완료: ['완료', '종결', '라이브'],
    활성: ['작업중', '진행중', '중단', '대기', '미확정', '보류', '보고만', '검증 중', '예정', '준비 중'],
  };
}

function isActiveRow(line) {
  const decor = /^[\s*_`~>✅🔴⚠️☑️✔️🟢🟡]+/u;
  const { 완료, 활성 } = 어휘();
  const cells = cellsOfRow(line);
  const status = (cells[cells.length - 1] || '').trim().replace(decor, '');
  // 첫 구절만 본다 — 뒤쪽 서술의 「…로 종결」·「라이브 실측」이 활성 줄을 완료로 뒤집지 않게.
  const 첫구절 = status.split(/[—(]/)[0];
  if (활성.some((w) => 첫구절.includes(w))) return true;
  // 「미완료」·「안 끝남」을 완료로 읽지 않는다 — 부정 접두가 붙은 것은 완료가 아니다.
  return !new RegExp(`(?<![미안못])(${완료.join('|')})`).test(첫구절);
}

function 활성줄들(text) {
  return text.split('\n').filter(isDataRow).filter(isActiveRow);
}

function countActive(text) {
  return 활성줄들(text).length;
}

/* 막을 때 **무엇을 활성으로 셌는지** 보여준다.
 * F094 가 두 번 난 이유는 오분류를 아무도 볼 수 없었기 때문이다 — 사람 눈엔 완료 줄인데
 * 훅은 활성이라 하고, 그 둘을 대조할 방법이 없었다. 목록을 내밀면 다음엔 즉시 보인다. */
function 활성목록(text) {
  const 줄 = 활성줄들(text).map((l) => {
    const c = cellsOfRow(l);
    const 트랙 = (c[1] || '').trim().replace(/\*/g, '').slice(0, 28);
    const 상태 = (c[c.length - 1] || '').trim().slice(0, 22);
    return `     · ${트랙} → ${상태}`;
  });
  return 줄.length ? '\n   지금 활성으로 센 줄:\n' + 줄.join('\n') : '';
}

/* ②의 처방은 **그대로 실행할 수 있어야 한다** (F103 축 · 2026-08-07 실측)
 * 전체 상한에 걸리면 ②는 「오래된 완료 줄부터 옮겨라」만 냈다 — 어느 줄인지도, 그 줄을
 * board-move 에 **어떤 문구로** 줘야 하는지도 없다. board-move 는 부분문자열 유일 매칭이라
 * 문구 고르기가 손일이고(굵게·백틱·「」가 섞여 셸에서도 깨진다), 그래서 아무도 안 치우고
 * 만석이 유지돼 다음 세션이 선언을 못 한다 — 실측: 내가 이 자리에서 막혔고, 손으로 고른
 * 문구 2개 중 1개가 빗나갔다. ①(활성 상한)은 이미 목록을 내밀고 있었다. 같은 것을 ②에도.
 *
 * ⚠ 생사 판정은 **여기서 하지 않는다** — board-move 가 그 자리(주인·미커밋)를 이미 본다.
 *   훅이 그것까지 재현하면 판정이 두 곳으로 갈라지고, 갈라진 쪽은 조용히 틀린다. */
function 완료줄들(text) {
  return text.split('\n').filter(isDataRow).filter((l) => !isActiveRow(l));
}

/* board-move 와 **같은 판정**(부분문자열·유일)으로 문구를 고른다.
 * 따옴표·백틱 앞에서 자른다 — 큰따옴표로 감싼 인자 안에서 그 둘만 셸을 깬다(백틱은 명령치환).
 * `*` 는 자르지 않는다: 큰따옴표 안에서 확장되지 않고, 자르면 유일해질 여지만 좁아진다. */
function 이관문구(line, 전체) {
  const 안전 = (cellsOfRow(line)[1] || '').trim().replace(/^\*+/, '').split(/["`]/)[0].trim();
  if (!안전) return null;
  for (let n = 4; n <= 안전.length + 3; n += 3) {
    const needle = 안전.slice(0, Math.min(n, 안전.length));
    if (전체.filter((l) => l.includes(needle)).length === 1) return needle;
  }
  return null;
}

function 이관처방(text) {
  const 전체 = text.split('\n').filter(isDataRow);
  /* 자르기는 **문구를 뽑은 뒤**다 — 앞쪽 줄에서 유일 문구를 못 찾았다고 처방이 비면
   * 「완료 줄이 있는데 옮길 명령이 없다」는 모순이 나온다(그 자리가 곧 우회다). */
  const 명령 = 완료줄들(text).map((l) => 이관문구(l, 전체)).filter(Boolean).slice(0, 5);
  /* 명령이 0개인 자리는 **도달할 수 없다** — 완료 줄이 없으면 전체 상한보다 활성 상한(①)이
   * 먼저 잡는다. 남는 것은 파일을 못 읽은 폴백뿐이라 거기선 조용히 원래 문구만 낸다. */
  if (!명령.length) return '';
  return '\n   아카이브로 옮길 **완료** 줄 — 그대로 실행하면 된다(주인 생사·남의 미커밋은 board-move 가 본다):\n'
    + 명령.map((n) => `     node tools/board-move.js "${n}"`).join('\n');
}

/* 안내도 위 목록에서 파생한다 — 판정과 안내가 갈라지면 「시킨 대로 썼는데 막힌다」가 되고,
 * 그게 F094 의 재발 원인(처방을 따를 수 없어 표기가 갈라진다)이다. */
function 표기안내() {
  const { 완료, 활성 } = 어휘();
  return `\n   완료로 세는 표기: 상태 칸 **첫 구절**에 ${완료.map((w) => `「${w}」`).join('·')} 중 하나`
    + `\n   (앞의 굵게·✅ 같은 장식은 무시한다. 예: **✅전량 종결** · **완료·라이브 [v9.183]**)`
    + `\n   활성으로 세는 표기: ${활성.map((w) => `「${w}」`).join('·')} — 이쪽이 우선한다`;
}

/* 칸 가르기는 공용 통로에서 온다 — 날 split 은 백틱 안의 파이프까지 칸막이로 세서
 * 그 뒤 칸이 한 칸씩 밀린다. 밀리면 상태 칸이 짧은 조각이 되어 **200자 검사가 짧게 재고**
 * 완료 줄이 활성으로 세어진다(둘 다 조용하다 · 사연은 tools/lib/표.js 머리말). */
function cellsOfRow(line) {
  return 표.칸나누기(line);
}

/* 편집 **전**의 판. ①(칸 길이)·③(주인 표식)·④(자리 겹침)가 전부 「이 줄이 편집 전에 있었나」를
 * 묻는다 — 그래서 **여기 한 곳에서만** 읽는다(같은 판정을 두 곳에 적으면 갈라진다).
 * ⚠ 아래에서 다시 `let 이전` 을 선언하면 같은 이름 재선언으로 파일이 통째로 죽는다.
 *   2026-08-08 에 실제로 그렇게 죽었고(F239), **죽은 훅은 조용히 통과로 읽힌다** — 즉 이 한 줄이
 *   없으면 가드가 있는 게 아니라 꺼진 것이다. 회귀가 「훅이 실제로 돈다」를 따로 못박는다. */
let 이전 = null;
try { 이전 = fs.readFileSync(filePath, 'utf8'); } catch (_) { 이전 = null; }
const 보드id = require(path.join(__dirname, 'lib', 'board-id.js'));

/* ── ① 칸 길이 검사 — **내가 바꾼 줄만 막는다** (마찰 F233·F234·F235·F237 · 2026-08-08) ────
 * 하루에 네 번 신고된 자리다(F237 은 F235 의 중복 신고). 원래는 결과 파일의 **모든** 행을 쟀다.
 * 그래서 남의 활성 줄 하나가 200자를 넘으면 **그 순간부터 아무 세션도 자기 줄을 못 고쳤다** —
 * 내 칸이 통과해도 막힌다. 처방문은 「문장을 줄이거나 아카이브로 옮겨라」인데 줄일 대상이
 * 남의 미커밋 줄이라 F073(남의 작업본 편집 금지)과 정면으로 충돌한다. 즉 **따를 수 있는 처방이
 * 하나도 없었고**(F103 축), 남는 탈출구는 BYPASS 아니면 갱신 포기였다. 실제로 포기가 났다:
 * 소급불가 ①-2 는 종결됐는데 보드 줄은 4회 연속 차단돼 「🔵착수」로 커밋됐고, 다음 세션이
 * 끝난 트랙을 이어받으려 했다 — 인계 3통로 중 보드 줄이 끊긴 것이다.
 *
 * 🔑 새는 방향을 실측으로 갈랐다(조건 하나씩 · 2026-08-08):
 *     남의 기존 위반 O + 내 칸 짧다 → 막힘  ← 이것이 사고
 *     남의 기존 위반 X + 내 칸 길다 → 막힘  ← **탐지력은 여기 있다. 그대로 둔다.**
 *   그래서 수리는 탐지력을 깎지 않는다. 재는 대상만 「내가 건드린 줄」로 좁힌다.
 *
 * ⚠ 「내 줄」은 지문으로 가르지 않는다 — **편집 전 판에 그 행이 글자 그대로 있었나**로 가른다.
 *   지문으로 가르면 지문 없는 줄(클라우드·폰)에서 판정이 무너지고, 무엇보다 내가 *남의 줄을*
 *   길게 고친 경우를 놓친다(그건 막아야 한다). 손 안 댄 줄은 바이트가 같아 저절로 빠진다.
 * ⚠ 이전 판을 못 읽으면 옛행이 비어 **전부 내 것으로 센다** — 즉 옛 동작(전량 차단)으로 돌아간다.
 *   폴백이 느슨해지는 쪽이면 그게 곧 구멍이다(새는 방향은 언제나 통과다).
 * ⚠ 이미 있던 위반은 **조용히 넘기지 않는다** — 차단 대신 알림으로 낸다(아래 맨 끝). 차단이
 *   사라진 자리에 침묵을 두면 200자 규칙이 있다는 믿음만 남고 아무도 안 치운다. */
const longCells = [];
const 남의긴칸 = [];
if (resulting !== null) {
  const 옛행 = new Set((이전 || '').split('\n').filter(isDataRow).map((l) => l.trim()));
  for (const line of resulting.split('\n')) {
    if (!isDataRow(line)) continue;
    const 내가바꿨다 = !옛행.has(line.trim());
    cellsOfRow(line).forEach((c, i) => {
      const len = c.trim().length;
      if (len <= MAX_CELL) return;
      const 적기 = `${i + 1}번째 칸 ${len}자 — "${c.trim().slice(0, 40)}…"`;
      if (내가바꿨다) longCells.push(적기);
      // 주인을 함께 낸다 — 조율할 상대를 모르면 알림은 치울 수 없는 잔소리가 된다(F237 처방②).
      else 남의긴칸.push(`${적기}\n     주인: ${(보드id.줄의지문(line)[0] || '????????')} · 트랙 「${(cellsOfRow(line)[1] || '').replace(/\*/g, '').trim().slice(0, 40)}…」`);
    });
  }
} else {
  // 폴백 — 결과를 못 만들 때만. 조각이 완전한 행이 아니어도 `|` 조각 단위로 재 본다.
  for (const text of incoming) {
    for (const line of text.split('\n')) {
      if (isDataRow(line)) {
        cellsOfRow(line).forEach((c, i) => {
          const len = c.trim().length;
          if (len > MAX_CELL) longCells.push(`${i + 1}번째 칸 ${len}자 — "${c.trim().slice(0, 40)}…"`);
        });
      } else if (line.includes('|')) {
        표.칸나누기(line).forEach((c) => {
          const len = c.trim().length;
          if (len > MAX_CELL) longCells.push(`칸 조각 ${len}자 — "${c.trim().slice(0, 40)}…"`);
        });
      }
    }
  }
}
if (longCells.length) {
  미룬deny(
    '[board-guard] 세션보드 칸 길이 초과(칸당 ' + MAX_CELL + '자) — **내가 이 편집으로 바꾼 줄**이다:\n- ' +
      longCells.join('\n- ') +
      '\n→ 보드 줄은 **선언만**이다. 보고·판정 본문은 memory/ 토픽 파일이나 docs/ 정본에 쓰고, 상태 칸에는 한 줄 요약 + 그 링크만 남길 것.' +
      '\n   (남이 이미 넣어둔 과길이 칸은 이제 이 문으로 막지 않는다 — 알림으로만 나온다 · F235)'
  );
}

/* ── ② 표 줄 수 검사 — 활성 상한과 전체 상한을 따로 본다.
 * ①과 **같은 규칙**을 여기에도 건다(마찰 F234 · 2026-08-08): 상한을 이미 넘긴 판을 물려받았을
 * 뿐 내 편집이 더 늘리지 않으면 막지 않는다. 이유도 ①과 같다 — 처방이 「완료 줄을 아카이브로
 * 옮겨라」인데 옮길 완료 줄의 주인이 전부 살아 있으면 board-move 가 원칙⑥으로 거부한다.
 * 그러면 따를 수 있는 처방이 하나도 없고(F103 축) 남는 것은 BYPASS 아니면 **갱신 포기**다.
 * ⚠ 늘리는 편집(줄 추가)은 그대로 막는다 — 판이 커지는 것을 막는 게 이 검사의 몫이고,
 *   그 힘을 빼면 상한이 있으나 마나가 된다. 푸는 것은 **유지보수 편집**뿐이다. */
let total, active;
if (resulting !== null) {
  total = countRows(resulting);
  active = countActive(resulting);
} else {
  if (이전 === null) {
    /* 파일을 못 읽으면 ②는 판단 불가다. 다만 **①의 보류까지 함께 삼키면 안 된다** —
     * 보류는 F221 수리로 생긴 상태고, 여기서 조용히 나가면 칸 초과가 통과가 된다(새는 방향). */
    if (보류 !== null) deny(보류);
    process.exit(0);
  }
  total = countRows(이전) + delta;
  active = countActive(이전) + activeDelta;
}
/* 편집 **전**의 줄 수. 이전 판을 못 읽으면 0 이라 「전부 내가 늘렸다」가 되어 옛 동작(전량 차단)으로
 * 돌아간다 — ①의 폴백과 같은 방향이다(못 재면 느슨해지는 쪽이면 그게 곧 구멍이다). */
const 이전total = 이전 === null ? 0 : countRows(이전);
const 이전active = 이전 === null ? 0 : countActive(이전);
const 물려받은 = [];
const 판 = resulting !== null ? resulting : (이전 || '');
if (active > MAX_ACTIVE && active > 이전active) {
  미룬deny(
    `[board-guard] 세션보드 활성 줄이 ${active}줄이 된다(상한 ${MAX_ACTIVE}줄).\n` +
      '→ 활성 줄이 이만큼이면 조율이 아니라 소음이다. 끝난 트랙의 상태를 먼저 완료 표기로 갱신하거나, 남의 줄이 아니라 내 줄을 합쳐라.' +
      표기안내() +
      활성목록(판)
  );
} else if (active > MAX_ACTIVE) {
  물려받은.push(`활성 ${active}줄(상한 ${MAX_ACTIVE}) — 내 편집은 안 늘렸다`);
}
if (total > MAX_ROWS && total > 이전total) {
  미룬deny(
    `[board-guard] 세션보드 표가 ${total}줄이 된다(상한 ${MAX_ROWS}줄).\n` +
      '→ 오래된 **완료** 줄부터 docs/세션보드_아카이브.md 맨 위로 옮긴 뒤 다시 시도할 것. 활성(작업중·진행중·대기) 줄은 남긴다.' +
      이관처방(판)
  );
} else if (total > MAX_ROWS) {
  물려받은.push(`전체 ${total}줄(상한 ${MAX_ROWS}) — 내 편집은 안 늘렸다`);
}

/* ── ③ 새 줄은 **주인을 말해야 한다** (마찰 F165 · 2026-08-07) ────────────
 * ①②는 보드가 부푸는 것을 막았다. ③은 다른 축이다 — **줄이 누구 것인지 알아볼 수 있는가.**
 * 보드 줄의 주인을 찾는 도구는 둘 다(인계문 생성기 · board-move 원칙 ⑥) 줄에 적힌
 * 커밋 해시로 찾는데, 해시는 이 저장소의 *관행*이지 규칙이 아니었다. 그래서 코드 커밋이
 * 하나도 안 나간 트랙은 줄에 아무 지문이 없고, 두 도구가 각자 반대 방향으로 샜다:
 *   · 인계문 → 「내 줄을 못 찾았다, 정말 없으면 멈춰라」(멀쩡히 있는 자기 트랙을 두고 멈춘다)
 *   · board-move → 주인 생사를 못 봐서 **살아있는 세션의 줄을 아카이브로 옮긴다**(F146 그 사고)
 * 프로즈로 「지문을 적어라」라고 쓰면 안 적힌다. 그래서 쓰는 순간 기계가 요구한다.
 *
 * ⚠ 판정은 **트랙 칸**으로 한다 — 상태 칸 갱신(보드 편집의 가장 흔한 모양)은 텍스트가 통째로
 *   바뀌므로 「새 줄」로 세면 갱신마다 막힌다. 트랙 칸이 그대로면 같은 줄이다.
 * ⚠ 내 지문을 **모르는 세션에는 요구하지 않는다** — 환경변수가 빈 환경(클라우드·폰)에서
 *   요구하면 따를 수 없는 처방이 되고, 그건 우회를 정상 통로로 만든다(F103). */
const 내id = String(process.env.CLAUDE_CODE_HOST_SESSION_ID || '');
const 트랙칸 = (line) => (cellsOfRow(line)[1] || '').trim();
const 파일칸 = (line) => (cellsOfRow(line)[2] || '').trim();
/* `보드id`·`이전` 은 ① 위에서 이미 만들었다 — 여기서 다시 읽으면 같은 판정이 두 곳에서
 * 갈라진다(CLAUDE.md 신뢰성 ④: 「훅 안에서도 같은 판정을 두 곳에 적으면 갈라진다」). */

if (resulting !== null && 내id) {
  const 내지문 = 보드id.지문(내id);
  /* 🔴 [2026-08-07] **접두를 빠뜨린 지문**이 「해시」로 통과하던 자리 — F165 가 다른 문으로 재발했다.
   *   실측: 상태 칸에 `` `b6cb681a` `` 라고(접두 없이) 적었더니 이 가드는 hex 8자리를 커밋 해시로
   *   보고 통과시켰는데, 같은 줄을 인계문이 읽고 「내 보드 줄을 못 찾았다」를 냈다 — 읽는 쪽
   *   (`board-id.줄의지문`)은 `local_` 접두가 붙은 것만 지문으로 세기 때문이다. 같은 모양이 지금
   *   보드에 하나 더 있다. 쓰는 쪽이 받는 표기가 읽는 쪽보다 넓으면 그 틈은 늘 「통과」로 샌다.
   *   ⚠ 해시 자체는 계속 통과시킨다 — ✅종결 줄이 자기 커밋 해시를 적는 것은 읽는 쪽이 실제로
   *   쓰는 재료다(형제 저장소 해시 포함 · F142). 막는 것은 **내 지문을 접두 없이 쓴 그 한 가지**뿐이라
   *   거짓양성이 0 이다(내 지문과 우연히 같은 짧은 해시는 접두를 붙이면 그대로 통과한다). */
  const 주인말함 = (line) => {
    if (보드id.줄의지문(line).length > 0) return true;
    return (String(line).match(/\b[0-9a-f]{7,40}\b/g) || [])
      .some((h) => h.toLowerCase() !== 내지문);
  };
  if (이전 !== null) {
    const 옛트랙 = new Set(이전.split('\n').filter(isDataRow).map(트랙칸));
    const 무명 = resulting.split('\n').filter(isDataRow)
      .filter((l) => !옛트랙.has(트랙칸(l)))
      .filter((l) => !주인말함(l));
    if (무명.length) {
      미룬deny(
        '[board-guard] 새 보드 줄에 **주인 표식이 없다**(F165):\n- ' +
          무명.map((l) => 트랙칸(l).replace(/\*/g, '').slice(0, 50) + '…').join('\n- ') +
          `\n→ 줄 어딘가에 **내 세션 지문 \`local_${내지문}\`** 를 적어라 — **\`local_\` 접두까지 그대로**` +
          `(커밋 해시가 이미 적혀 있으면 그것도 된다). 접두를 뗀 \`${내지문}\` 는 읽는 쪽이 못 읽는다.` +
          `\n   상태 칸이 흔한 자리다: \`작업중 (\`local_${내지문}\`) — …\`` +
          '\n   왜: 지문도 해시도 없는 줄은 **인계문이 「내 줄 없음」으로 읽어** 다음 세션이 자기 트랙을 잃고,' +
          '\n   board-move 는 주인이 살아있는지 못 봐 그 줄을 아카이브로 옮긴다(F146·F165).'
      );
    }
  }
}

/* ── ④ 새 트랙은 **남이 이미 잡은 자리**를 다시 잡지 않는다 (2026-08-07 실측) ────
 * ①②는 보드가 부푸는 것을, ③은 줄의 주인을 봤다. ④는 **줄과 줄 사이**다.
 *
 * 🔴 실측(2026-08-07): 세션 `82404266` 이 절단문서 `②-20`(`functions/tasks/index.ts`)을 선언한
 *   3분 뒤 `b170e8dc` 가 **같은 항목·같은 파일**을 선언했다. 둘 다 규약을 지켰다 — 시작할 때
 *   보드를 읽었고, 그때는 상대 줄이 아직 없었다. 겹침을 보는 곳이 `작업본소유자` 의
 *   **SessionStart 출력 하나뿐**이라 그건 스냅샷이고, 그 뒤에 선언한 쪽은 원리적으로 못 본다
 *   (track-collision 이 자기 머리말에 적어둔 실패를 보드 축에서 그대로 반복했다).
 *   사람이 알아채고 물러났는데 **둘 다 물러나 교착**이 났다 — 늦게 안 만큼 값이 비쌌다.
 *
 * 🔴 [F203] 첫 판은 재료를 **`git diff HEAD` 로 좁혔다** — 「선점은 미커밋 보드 줄로만 드러난다」
 *   (F161)를 규칙으로 굳혔는데, 그건 그 사건의 *모양*이지 선점의 정의가 아니었다. 이 저장소는
 *   보드를 상시 커밋하고(중앙값 3분 · 지나가는 세션이 남의 줄까지 동승시킨다), 커밋되는 순간
 *   그 착수 선언은 ④ 에게서 **사라진다.** 조건 하나만 바꾼 대조(파일·표식 동일):
 *     남의 선언 미커밋 → 막음 · **커밋됨 → 통과**
 *   그래서 08-07 에 `d2453563` 의 F123 선언이 `ceab9d3` 로 커밋된 뒤 `41ae1a64` 가 같은 F123 을
 *   선언했고 ④ 는 조용했다. 보호 창이 「보드가 다음에 커밋될 때까지」였던 것이다.
 * 🔑 재료는 **편집 전 파일의 활성 줄 전부**다 — 미커밋 줄은 이미 그 파일 안에 있으니 `git` 은
 *   더 볼 것이 없고(중복 재료), 커밋된 줄까지 같이 보인다. 즉 수리는 넓히기가 아니라 **덜어내기**다.
 * ⚠ 자리는 둘로 센다. **트랙 머리의 표식**(`②-20`·`F196`)과 **만지는 파일의 경로**다 —
 *   파일이 안 겹쳐도 같은 항목을 파면 중복이고(오늘이 그 경우), 항목 번호가 없어도 같은 파일을
 *   고치면 커밋에서 부딪친다. 표식은 **머리**에서만 뽑는다: 본문에서의 인용(「지금 ②-20 을
 *   두 세션이 판다」)은 선점이 아니라 참조라, 문장 어디서나 세면 남을 언급만 해도 막힌다.
 * ⚠ 홑 이름(`index.ts`)은 안 센다 — 저장소에 7벌이 있어 전부와 겹친다(거짓 차단이 곧 우회다).
 * ⚠ 활성 줄끼리만 본다. ✅종결 줄은 자리를 잡고 있는 게 아니라 치우기를 기다리는 것이다.
 *
 * ponytail: **동시 선언**(둘 다 이 훅을 통과한 뒤 각자 쓰기)은 여전히 못 막는다 — 막으려면 락이
 *   필요하고 그건 이 사고 빈도에 안 맞는다. 그 창은 초 단위고, 지금 실측된 사고는 3분 차다. */
const 장부RE = /(세션보드|마찰신호|버전_이력|지침_이력)/;
const 표식 = require(path.join(__dirname, 'lib', '표식.js')); // 번호 규칙은 한 곳에서만 산다(F203)

/* 🚫 로 시작하는 항목은 **안 만진다는 명시**지 선점이 아니다 (마찰 F221 · 2026-08-08 실측).
 * 이 보드의 관습은 「만지는 파일」 칸에 비켜난 자리까지 함께 적는 것이다 —
 * `(🚫tools/board-move.js=local_0a3a2a04 · 🚫보드 외 docs · talk 편집 0)`.
 * 그것을 자리로 세면 **비켜났다고 적을수록 막힌다.** 실물: 내 F221 선언이 「board-move.js 는
 * 남의 것이라 안 만진다」고 적었다는 이유로 차단됐고, 나는 그 표기를 지워서 통과시켰다 —
 * 거짓 차단이 곧 우회다(F103). 관습을 정직하게 쓸수록 벌받는 가드는 관습을 죽인다.
 * 스팬 경계는 사람이 실제로 쓰는 구분자 ` · ` 다(항목 안에 붙은 `·` 는 같은 금지 항목이다). */
const 금지스팬빼기 = (칸) => 칸.split(/\s·\s/).filter((조각) => !조각.includes('🚫')).join(' · ');

function 자리들(line) {
  const 자리 = new Set();
  const 머리 = 표식.머리(트랙칸(line));
  if (머리) 자리.add(머리);
  for (const m of 금지스팬빼기(파일칸(line)).matchAll(/[\w가-힣./_-]+\.(?:ts|tsx|js|jsx|mjs|cjs|gs|json|html|md|sql|ya?ml)\b/g)) {
    const p = m[0].replace(/^(?:\.\.?\/)+/, '').toLowerCase();
    if (p.split('/').length < 2 || 장부RE.test(p)) continue;
    자리.add(p);
  }
  return 자리;
}

if (resulting !== null && 이전 !== null) {
  const 옛줄 = 이전.split('\n').filter(isDataRow);
  const 옛트랙 = new Set(옛줄.map(트랙칸));
  const 새줄 = resulting.split('\n').filter(isDataRow)
    .filter((l) => !옛트랙.has(트랙칸(l)))
    .filter(isActiveRow);
  /* 남의 착수 선언 = **편집 전 판의 활성 줄.** 커밋 여부를 안 가른다(F203) — 미커밋 줄도
   * 이 파일 안에 있고, 커밋됐다고 그 세션이 자리를 놓은 것은 아니다. */
  const 남의선언 = 새줄.length ? 옛줄.filter(isActiveRow) : null;
  if (남의선언) {
    const 내지문 = 내id ? 보드id.지문(내id) : '';
    const 겹침 = [];
    for (const 새 of 새줄) {
      const 내자리 = 자리들(새);
      if (!내자리.size) continue;
      for (const 남 of 남의선언) {
        if (트랙칸(남) === 트랙칸(새)) continue;
        const 지문들 = 보드id.줄의지문(남);
        if (내지문 && 지문들.includes(내지문)) continue; // 이번 세션이 아까 적은 줄
        const 같은 = [...자리들(남)].filter((k) => 내자리.has(k));
        if (같은.length) 겹침.push(`${같은.join('·')} ← \`local_${지문들[0] || '????????'}\` 「${트랙칸(남).replace(/\*/g, '').slice(0, 44)}…」`);
      }
    }
    if (겹침.length) {
      deny(
        '[board-guard] 이 자리는 **남이 이미 선언했다** — 보드의 활성 줄이다(커밋 여부는 안 가른다 · F161·F203):\n- ' +
          [...new Set(겹침)].join('\n- ') +
          '\n→ **겹치면 내가 비켜난다**(중복 구현은 되돌릴 수 없다).' +
          '\n   · 다른 트랙을 잡는다 — 장부 미해소(`node tools/friction.js --open`) · 보드 ⏳ · 결정 큐' +
          '\n   · 그 세션이 이미 끝났다고 보이면 `node tools/작업본소유자.js` 로 생사를 먼저 확인한다' +
          '\n   · **죽은 세션의 줄이면** 그 줄부터 치운다: `node tools/board-move.js "그 트랙 문구"`' +
          '\n     (활성에서 빠지면 이 문이 열린다 — 남은 채로 우회하면 다음 세션이 같은 자리를 또 판다)' +
          '\n   왜: 겹침을 보는 곳이 세션 시작 출력 하나뿐이라 **뒤에 선언한 쪽은 상대를 원리적으로 못 본다.**'
      );
    }
  }
}

/* ④ 를 지났으니 이제 ①②③ 의 보류 사유를 낸다(F221 · 막는 힘은 그대로, 순서만 뒤다). */
if (보류 !== null) deny(보류);

/* 통과시킨다 — 그런데 이미 있던 과길이 칸은 **말은 한다**(F235 수리의 나머지 절반).
 * 차단을 뺀 자리에 침묵을 두면 200자 규칙이 있다는 믿음만 남고 아무도 안 치운다.
 * 통로는 clasp-guard:332 와 같다 — `permissionDecision` 을 안 실으므로 편집을 막지 않는다.
 * deny 는 위에서 프로세스를 끝내므로 이 자리는 **통과할 때만** 도달한다(출력이 겹치지 않는다). */
if (남의긴칸.length || 물려받은.length) {
  const 글 = `⚠ [board-guard] 물려받은 보드 위반 ${남의긴칸.length + 물려받은.length}건 — **내 편집은 막지 않았다**(F234·F235):\n- `
    + [...남의긴칸, ...물려받은].join('\n- ')
    + '\n→ 내가 줄이지 않는다 — 남의 줄 편집은 F073 이 금지한다(내 바이트가 남의 커밋에 실려 나간다).'
    + '\n   그 세션이 살아있으면 그쪽 몫이고, **죽었으면** 줄을 치우면 이 칸도 함께 사라진다:'
    + '\n   생사 `node tools/작업본소유자.js` → 이관 `node tools/board-move.js "그 트랙 문구"`';
  process.stdout.write(JSON.stringify({
    systemMessage: 글,
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 글 },
  }));
}
process.exit(0);
