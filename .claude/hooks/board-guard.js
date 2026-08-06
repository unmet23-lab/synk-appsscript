#!/usr/bin/env node
// board-guard — 세션보드 비대화 차단 (PreToolUse 훅)
// CLAUDE.md 신뢰성 조항의 기계 강제: "줄은 선언만"이라는 프로즈 규칙이 지켜지지 않아
// 보드가 70,628자(추정 5~7만 토큰)까지 부푼 2026-07-31 사고의 재발 방지 장치.
// 검사 2종 — ①표 한 칸 200자 초과 금지 ②표 데이터 줄 14줄 초과 금지.
// 통과 시 출력 없이 종료. 아카이브 파일(docs/세션보드_아카이브.md)은 검사 대상이 아니다.
'use strict';
const fs = require('fs');
const path = require('path');

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
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
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
    const c = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    const 트랙 = (c[1] || '').trim().replace(/\*/g, '').slice(0, 28);
    const 상태 = (c[c.length - 1] || '').trim().slice(0, 22);
    return `     · ${트랙} → ${상태}`;
  });
  return 줄.length ? '\n   지금 활성으로 센 줄:\n' + 줄.join('\n') : '';
}

/* 안내도 위 목록에서 파생한다 — 판정과 안내가 갈라지면 「시킨 대로 썼는데 막힌다」가 되고,
 * 그게 F094 의 재발 원인(처방을 따를 수 없어 표기가 갈라진다)이다. */
function 표기안내() {
  const { 완료, 활성 } = 어휘();
  return `\n   완료로 세는 표기: 상태 칸 **첫 구절**에 ${완료.map((w) => `「${w}」`).join('·')} 중 하나`
    + `\n   (앞의 굵게·✅ 같은 장식은 무시한다. 예: **✅전량 종결** · **완료·라이브 [v9.183]**)`
    + `\n   활성으로 세는 표기: ${활성.map((w) => `「${w}」`).join('·')} — 이쪽이 우선한다`;
}

function cellsOfRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
}

// ① 칸 길이 검사 — 결과 파일이 있으면 그것만 본다(권위 있는 판정)
const longCells = [];
if (resulting !== null) {
  for (const line of resulting.split('\n')) {
    if (!isDataRow(line)) continue;
    cellsOfRow(line).forEach((c, i) => {
      const len = c.trim().length;
      if (len > MAX_CELL) longCells.push(`${i + 1}번째 칸 ${len}자 — "${c.trim().slice(0, 40)}…"`);
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
        line.split('|').forEach((c) => {
          const len = c.trim().length;
          if (len > MAX_CELL) longCells.push(`칸 조각 ${len}자 — "${c.trim().slice(0, 40)}…"`);
        });
      }
    }
  }
}
if (longCells.length) {
  deny(
    '[board-guard] 세션보드 칸 길이 초과(칸당 ' + MAX_CELL + '자):\n- ' +
      longCells.join('\n- ') +
      '\n→ 보드 줄은 **선언만**이다. 보고·판정 본문은 memory/ 토픽 파일이나 docs/ 정본에 쓰고, 상태 칸에는 한 줄 요약 + 그 링크만 남길 것.'
  );
}

// ② 표 줄 수 검사 — 활성 상한과 전체 상한을 따로 본다
let total, active;
if (resulting !== null) {
  total = countRows(resulting);
  active = countActive(resulting);
} else {
  let cur;
  try {
    cur = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    process.exit(0); // 파일을 못 읽으면 판단 불가 — 통과
  }
  total = countRows(cur) + delta;
  active = countActive(cur) + activeDelta;
}
if (active > MAX_ACTIVE) {
  deny(
    `[board-guard] 세션보드 활성 줄이 ${active}줄이 된다(상한 ${MAX_ACTIVE}줄).\n` +
      '→ 활성 줄이 이만큼이면 조율이 아니라 소음이다. 끝난 트랙의 상태를 먼저 완료 표기로 갱신하거나, 남의 줄이 아니라 내 줄을 합쳐라.' +
      표기안내() +
      활성목록(resulting !== null ? resulting : (() => { try { return fs.readFileSync(filePath, 'utf8'); } catch (_) { return ''; } })())
  );
}
if (total > MAX_ROWS) {
  deny(
    `[board-guard] 세션보드 표가 ${total}줄이 된다(상한 ${MAX_ROWS}줄).\n` +
      '→ 오래된 **완료** 줄부터 docs/세션보드_아카이브.md 맨 위로 옮긴 뒤 다시 시도할 것. 활성(작업중·진행중·대기) 줄은 남긴다.'
  );
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
if (resulting !== null && 내id) {
  const 보드id = require(path.join(__dirname, 'lib', 'board-id.js'));
  const 트랙칸 = (line) => (cellsOfRow(line)[1] || '').trim();
  const 주인말함 = (line) => /\b[0-9a-f]{7,40}\b/.test(line) || 보드id.줄의지문(line).length > 0;
  let 이전 = null;
  try { 이전 = fs.readFileSync(filePath, 'utf8'); } catch (_) { 이전 = null; }
  if (이전 !== null) {
    const 옛트랙 = new Set(이전.split('\n').filter(isDataRow).map(트랙칸));
    const 무명 = resulting.split('\n').filter(isDataRow)
      .filter((l) => !옛트랙.has(트랙칸(l)))
      .filter((l) => !주인말함(l));
    if (무명.length) {
      const 내지문 = 보드id.지문(내id);
      deny(
        '[board-guard] 새 보드 줄에 **주인 표식이 없다**(F165):\n- ' +
          무명.map((l) => 트랙칸(l).replace(/\*/g, '').slice(0, 50) + '…').join('\n- ') +
          `\n→ 줄 어딘가에 **내 세션 지문 \`local_${내지문}\`** 를 적어라(커밋 해시가 이미 적혀 있으면 그것도 된다).` +
          `\n   상태 칸이 흔한 자리다: \`작업중 (\`local_${내지문}\`) — …\`` +
          '\n   왜: 지문도 해시도 없는 줄은 **인계문이 「내 줄 없음」으로 읽어** 다음 세션이 자기 트랙을 잃고,' +
          '\n   board-move 는 주인이 살아있는지 못 봐 그 줄을 아카이브로 옮긴다(F146·F165).'
      );
    }
  }
}
process.exit(0);
