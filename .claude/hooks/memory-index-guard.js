#!/usr/bin/env node
// memory-index-guard — 메모리 인덱스(MEMORY.md) 비대화 차단 (PreToolUse 훅)
//
// CLAUDE.md 신뢰성 조항의 기계 강제. board-guard가 세션보드에 한 일을 인덱스에 한다.
//
// 왜 훅인가 (프로즈가 실패한 증거):
//   "인덱스는 지도다. 한 줄에 판정 본문을 쓰지 않는다"는 규칙이 **그 파일 맨 위에** 적혀 있다.
//   읽는 사람 눈앞에 있는데도 2026-08-03 실측에서 107줄 중 25줄이 이를 어겼다
//   (>400자가 17줄 · 최장 2,637자 = 한 줄이 인덱스의 9%). 헤더가 스스로 "다이어트 역주행 +75%"라고
//   적고도 계속 늘었다. 눈앞의 프로즈가 못 막으면 남은 건 기계뿐이다. 마찰 F012.
//
// 왜 이 파일이 특별한가: 인덱스는 **매 세션 전량 로드**된다. 병행 6세션이면 하루 6번이다.
//   보드·지침과 달리 여기서 새는 토큰은 작업량과 무관하게 매번 나간다.
//
// 임계값 근거 (추정하지 않고 쟀다 — v6.10이 "임계값 근거 없음"으로 기계화를 보류한 전례):
//   2026-08-03 실측 107줄 · 중앙 136자 · 75분위 **229자** · 90분위 577자.
//   상한 250자 = 75분위 바로 위 = **이미 4분의 3이 지키고 있는 선**. 새 규칙을 발명한 게 아니라
//   지금 잘 쓰인 줄들의 실측 상한을 그대로 못박은 것이다.
//
// ⚠ 검사 대상은 **이번 편집이 새로 넣는 줄뿐**이다. 파일 전체를 검사하면 기존 25줄이 인질이 되어
//   인덱스를 아예 못 고치게 되고, 그러면 다음 사람은 규칙을 지키는 게 아니라 훅을 끈다
//   (v6.11: "과잉 차단은 BYPASS 습관을 만든다").
'use strict';
const fs = require('fs');
const path = require('path');

const MAX_LINE = 250;
const TARGET = 'MEMORY.md';

/* 총량 상한 — 「압축은 추가만큼 중요」(CLAUDE.md 지침 진화)의 기계 강제. 2026-08-07 신설, 마찰 F181.
 *
 * 왜 줄당 상한만으로는 안 됐나 (실측):
 *   이 훅은 **줄당 250자**만 봤고 파일 전체는 아무도 안 봤다. 그래서 250자 이내의 착한 줄이
 *   무한히 쌓였고, 유일한 제동은 사람이 알아채서 하는 손 압축이었다 — 인덱스 머리말이
 *   스스로 세는 그 횟수가 **12차**다. 같은 절차를 12번 손으로 했으면 그건 실수가 아니라
 *   시스템 결함이다(CLAUDE.md 신뢰성: 2번째 = 결함 · 3번째 = 원인을 쓸 수 없게 만든다).
 *   옆 세션(a237f510) 실측: 톱니 16.4k↔20.3k 자 · 압축 사이 바닥이 **+700자/일**로 올라간다.
 *   즉 손 압축은 기울기를 못 바꾼다. 못 바꾸는 걸 12번 더 하는 대신 상한을 기계에 준다.
 *
 * ⚠ F181 등재문의 「17.1KB 를 내라는 용량 훅」은 **실재하지 않는다**(2026-08-07 저장소 전수 실측:
 *   그 숫자는 장부 본문과 인덱스 머리말에만 있다). 목표를 못 지킨 게 아니라 목표를 잴 층이 없었다.
 *
 * 값의 근거 — 발명이 아니라 실측: 2026-08-07 MEMORY.md = **20,502자**(197링크·108줄).
 *   상한은 그 위 첫 round 인 21,000자. 여유 500자는 「성장 예산」이 아니라 **한 줄 분의 슬랙**이다
 *   — 상한을 실측에 딱 붙이면 다음 편집이 두 글자 때문에 막히고, 그러면 사람은 규칙을 지키는 게
 *   아니라 훅을 끈다(v6.11 「과잉 차단은 BYPASS 습관을 만든다」).
 *
 * 새는 방향을 고정한다: **줄이는 편집은 상한을 넘든 말든 언제나 통과**한다.
 *   막는 건 「지금보다 커지면서 상한을 넘는 것」 하나뿐이라, 압축·재배치·남의 rename 은 안 막힌다.
 *   차단문이 시키는 「같은 편집에서 뺄 줄을 골라라」도 이 통로로 그대로 실행된다(자기 처방 · F103). */
const MAX_TOTAL = 21000;

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

/* --check <파일> : 훅과 **같은 판정기**로 지금 상태를 잰다 (F052 의 처방).
 *
 * 2026-08-04 실사고: 인덱스 줄 길이를 `awk` 로 재고 「250자 위반」이라 보고했는데,
 *   awk 는 **바이트**를 세고 훅은 JS 문자를 센다. 한글이 3바이트라 175자가 324로 보였다.
 *   같은 사이클에 v7.10 「재는 층이 값을 깨뜨리지 않는지 본다」를 박아놓고 몇 분 뒤 밟은 것이다.
 *
 * 🔑 프로즈로 「조심해서 재라」고 쓰는 대신 **잴 통로를 하나로** 만든다 — 훅이 막는 기준과
 *   사람이 재는 기준이 같은 코드에서 나오면 층이 갈릴 수가 없다.
 *   (CLAUDE.md 「호출부마다 고치는 대신 잘못 쓸 수 없는 공용 통로를 만든다」) */
if (process.argv.includes('--check')) {
  const i = process.argv.indexOf('--check');
  const target = process.argv[i + 1];
  if (!target) {
    console.error('사용법: node .claude/hooks/memory-index-guard.js --check <MEMORY.md 경로>');
    process.exit(2);
  }
  let 본문;
  try { 본문 = fs.readFileSync(target, 'utf8'); }
  catch (e) { console.error(`읽을 수 없다: ${target}`); process.exit(2); }
  const 줄 = 본문.split(/\r?\n/);
  const 위반 = [];
  줄.forEach((l, n) => {
    if (!l.trim().startsWith('- ')) return; // 훅과 같은 대상(인덱스 줄)만
    if (l.length > MAX_LINE) 위반.push({ n: n + 1, len: l.length, head: l.slice(0, 50) });
  });
  const 인덱스줄 = 줄.filter((l) => l.trim().startsWith('- ')).length;
  console.log(`[memory-index-guard --check] ${target}`);
  console.log(`  인덱스 줄 ${인덱스줄}개 · 상한 ${MAX_LINE}자(JS 문자 기준 — 바이트가 아니다)`);
  // 총량도 **같은 판정기**로 낸다 — 사람이 wc -c 로 따로 재면 층이 갈린다(F052 의 처방).
  const 총량초과 = 본문.length > MAX_TOTAL;
  console.log(
    `  총량 ${본문.length}자 / 상한 ${MAX_TOTAL}자 (${총량초과 ? '✖ 초과' : `여유 ${MAX_TOTAL - 본문.length}자`})`
  );
  for (const v of 위반) console.log(`  ✖ ${v.n}행 ${v.len}자 — ${v.head}…`);
  if (!위반.length && !총량초과) {
    console.log('  ✅ 위반 0건');
    process.exit(0);
  }
  if (총량초과) console.log('  → 늘리는 편집만 막힌다. 줄이는 편집은 언제나 통과한다.');
  console.log(`\n  ⚠ wc -m·awk length 로 재면 한글이 3배로 부풀어 다른 숫자가 나온다(F052).`);
  process.exit(1);
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
const filePath = String(ti.file_path || '').replace(/\\/g, '/');
if (path.basename(filePath) !== TARGET) process.exit(0);

// 인덱스 항목 줄만 본다. 머리말·구획 제목·인용문은 길어도 되고, 실제로 규칙을 설명하는 자리다.
const isEntry = (line) => /^\s*-\s*\[/.test(line);

/** 이번 편집이 새로 넣는 텍스트만 모은다(Write는 전문이 곧 새 텍스트다). */
const incoming = [];
if (tool === 'Write') {
  incoming.push(String(ti.content || ''));
} else {
  const edits = tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti];
  for (const e of edits) incoming.push(String(e.new_string || ''));
}

/* Write는 전문 교체라 「새로 넣는 줄」이 곧 전체다 — 그대로 검사하면 기존 25줄 때문에
 * 압축 작업 자체가 막힌다. 그래서 Write일 때는 **디스크의 현재 내용에 없던 줄**만 새 줄로 센다.
 * (같은 줄을 그대로 옮겨 적는 재배치·아카이브 이동은 통과해야 한다.) */
let 디스크 = null;
try { 디스크 = fs.readFileSync(filePath, 'utf8'); } catch (_) { /* 새 파일이면 전부 새 줄이 맞다 */ }

let known = new Set();
if (tool === 'Write' && 디스크 !== null) {
  known = new Set(디스크.split('\n').map((l) => l.trim()));
}

const offenders = [];
for (const chunk of incoming) {
  for (const line of chunk.split('\n')) {
    if (!isEntry(line)) continue;
    if (known.has(line.trim())) continue; // 이미 있던 줄 — 이번 편집이 만든 빚이 아니다
    if (line.length > MAX_LINE) offenders.push(line);
  }
}

if (offenders.length) {
  const worst = offenders.sort((a, b) => b.length - a.length)[0];
  const name = (worst.match(/^\s*-\s*\[([^\]]+)\]/) || [, '?'])[1];
  deny(
    `[memory-index-guard] 인덱스 줄이 ${MAX_LINE}자를 넘는다 — ${offenders.length}줄, ` +
    `최장 ${worst.length}자(${name}).\n` +
    '→ 인덱스는 지도다. 판정 본문·수치·경위는 **토픽 파일**에 쓰고, 여기엔 한 문장 + 플래그만 남겨라.\n' +
    '→ 🚫재제안 금지·⏳·⚠ 플래그는 깎지 마라. 그게 인덱스의 존재 이유다 — 줄일 것은 설명이다.\n' +
    `→ 이 상한(${MAX_LINE}자)은 발명한 값이 아니라 실측이다: 기존 인덱스의 75%가 이미 그 안에 있다.`
  );
}

/* ── ② 총량 상한 ──────────────────────────────────────────────────────────────
 * ① 은 「이번에 새로 넣는 줄」만 보면 됐지만 총량은 **결과 전체**를 봐야 나온다.
 * 그래서 Edit 도구가 실제로 할 치환을 같은 순서로 흉내내 결과 본문을 만든다
 * (board-guard.js 의 applyEdits 와 같은 모양 — 그쪽은 표 줄 수를, 여기선 길이를 센다).
 * 매칭 실패는 Edit 자체가 실패할 신호라 **판단을 보류**한다(추측으로 막지 않는다). */
function 편집결과() {
  if (tool === 'Write') return String(ti.content || '');
  if (디스크 === null) return null;
  const edits = tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti];
  let out = 디스크;
  for (const e of edits) {
    const 옛 = String(e.old_string || '');
    const 새 = String(e.new_string || '');
    if (!옛 || !out.includes(옛)) return null;
    out = e.replace_all ? out.split(옛).join(새) : out.replace(옛, () => 새);
  }
  return out;
}

const 결과 = 편집결과();
const 지금 = 디스크 === null ? 0 : 디스크.length;

// 막는 건 「지금보다 커지면서 상한을 넘는 것」 하나뿐이다. 줄이는 편집은 상한 위에서도 통과한다.
if (결과 !== null && 결과.length > MAX_TOTAL && 결과.length > 지금) {
  deny(
    `[memory-index-guard] 인덱스 총량이 상한을 넘는다 — 편집 결과 ${결과.length}자 ` +
    `(상한 ${MAX_TOTAL}자 · 지금 ${지금}자).\n` +
    '→ 인덱스는 **매 세션 전량 로드**된다. 여기서 늘어난 한 줄의 값은 남은 세션 수만큼 곱해진다.\n' +
    '→ 처방은 「같은 편집에서 뺄 것을 함께 고르는 것」이다 — 해소된 ⏳ · 끝난 트랙의 최근 줄 · 설명절 순.\n' +
    '→ 🚫재제안 금지·⏳·⚠ 플래그는 깎지 마라. 그게 인덱스의 존재 이유다(줄일 것은 설명이다).\n' +
    '→ **줄이는 편집은 이 검사를 언제나 통과한다** — 압축·재배치·파일명 교체는 상한 위에서도 안 막힌다.\n' +
    '→ 단위는 JS 문자다(바이트로 재면 한글이 3배로 부푼다 · F052). ' +
    '지금 상태 = node .claude/hooks/memory-index-guard.js --check <MEMORY.md 경로>'
  );
}
