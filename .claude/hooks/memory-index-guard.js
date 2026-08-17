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
// ⚠ 검사 대상은 **이번 편집 뒤에 새로 존재하게 되는 줄뿐**이다(디스크에 그대로 있던 줄은 제외).
//   파일 전체를 검사하면 기존 25줄이 인질이 되어 인덱스를 아예 못 고치게 되고, 그러면 다음 사람은
//   규칙을 지키는 게 아니라 훅을 끈다(v6.11: "과잉 차단은 BYPASS 습관을 만든다").
//   재는 축은 「들어온 조각」이 아니라 **편집 결과의 줄**이다 — 부분 치환은 조각이 짧아도
//   결과 줄이 277자일 수 있고, 그게 그대로 통과하던 자리가 F123 이다(08-06 MEMORY.md 압축 실측 3줄).
//
// ③ 축(2026-08-17 · F519) — **동시 편집**. 위 ①② 는 「한 세션이 파일을 살찌우는 것」만 봤고,
//   「두 세션이 같은 파일을 동시에 고치는 것」은 아무 층도 안 봤다. 저장소 안 파일을 지키는 넉 층
//   (git status · 작업본소유자 · board-guard · repo-staleness)이 **전부 이 파일 밖**이라서다.
//   실사고: 두 세션이 같은 8차 압축을 각자 돌렸고 나중에 쓴 판이 남이 내린 5줄을 되살렸다.
//   발각은 우연이었다(로그의 바이트 수가 안 맞은 것뿐).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const MAX_LINE = 250;
const TARGET = 'MEMORY.md';

/* 총 줄 수 상한 — 「압축은 추가만큼 중요」(CLAUDE.md 지침 진화)의 기계 강제. 2026-08-07 신설, 마찰 F181.
 *
 * 왜 줄당 상한만으로는 안 됐나 (실측):
 *   이 훅은 **줄당 250자**만 봤고 파일 전체는 아무도 안 봤다. 그래서 250자 이내의 착한 줄이
 *   무한히 쌓였고, 유일한 제동은 사람이 알아채서 하는 손 압축이었다 — 인덱스 머리말이
 *   스스로 세는 그 횟수가 **12차**다. 같은 절차를 12번 손으로 했으면 그건 실수가 아니라
 *   시스템 결함이다(CLAUDE.md 신뢰성: 2번째 = 결함 · 3번째 = 원인을 쓸 수 없게 만든다).
 *
 * 값의 근거 — 발명도 실측도 아니고 **인용**이다. 하네스가 세션에 직접 내는 문구:
 *     "Compact it to under 140 lines."
 *   그래서 상한 = **139줄**(under 140). 이 저장소가 정한 값이 아니라 우리가 못 바꾸는 값이라,
 *   여기서 다른 숫자를 발명하면 훅이 조용한 채로 하네스만 계속 경고한다.
 *
 * 🔴 이 트랙이 밟은 오진 (같은 세션 안에서 두 번 갈아탔다 — 남기는 이유가 있다):
 *   ① F181 등재문의 「17.1KB 를 내라는 **용량 훅**」은 저장소에 없다(hooks·tools·tests 전량 grep).
 *      그 17.1KB 는 위 하네스 문구를 **KB 로 오역**한 것이었다.
 *   ② 그래서 나도 처음엔 **자(char) 상한 21,000** 으로 짰다. 그건 안 물리는 층이다 —
 *      실측 순간 인덱스는 140줄(=목표 초과)인데 19,522자(=상한 안)라 훅이 **조용했다**.
 *      "잴 수 있는 건 잰다" 를 지키고도 **어느 층을 잴지**를 틀리면 이렇게 된다(F089).
 *   교훈: 상한의 근거는 「내가 잰 값」이 아니라 「그 한계를 실제로 집행하는 쪽이 말한 값」이다.
 *
 * 새는 방향을 고정한다: **줄이는 편집은 상한을 넘든 말든 언제나 통과**한다.
 *   보는 건 「지금보다 줄이 늘면서 상한을 넘는 것」 하나뿐이라, 압축·재배치·남의 rename 은 안 막힌다.
 *   차단문이 시키는 「같은 편집에서 뺄 줄을 골라라」도 이 통로로 그대로 실행된다(자기 처방 · F103). */
const MAX_LINES = 139;

const 줄수 = (s) => s.split('\n').length;

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
  // 총 줄 수도 **같은 판정기**로 낸다 — 사람이 wc -l 로 따로 재면 층이 갈린다(F052 의 처방).
  const 총량초과 = 줄수(본문) > MAX_LINES;
  console.log(
    `  총 ${줄수(본문)}줄 / 상한 ${MAX_LINES}줄 (${총량초과 ? '✖ 초과' : `여유 ${MAX_LINES - 줄수(본문)}줄`})` +
    `  ※ 하네스 원문 "Compact it to under 140 lines."`
  );
  // 자 수는 **게이트가 아니다**. 옆 세션이 절감 산술에 쓰길래 참고로 같이 찍는다 —
  // 단위를 헷갈리지 않게 「상한 아님」을 문구에 박아 둔다(이 트랙이 실제로 밟은 함정이다).
  console.log(`  (참고 · 상한 아님) ${본문.length}자 — 자를 줄여도 줄 수는 안 준다`);
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
const ti = input.tool_input || {};

/* ── 기준(base) 도장 — 「내가 무엇을 보고 조립했나」의 유일한 증거 (F519) ─────────────
 *
 * 이 파일은 repo **밖**이라 git·board-guard·작업본소유자·repo-staleness 어느 층도 못 본다.
 * 그래서 동시 편집을 가를 재료가 하나도 없다 — 남이 그 사이 넣은 줄인지, 내가 지우기로 한
 * 줄인지 구별할 방법이 **원리상** 없었다. 그 재료를 여기서 만든다: 내가 이 파일을 전문으로
 * 연 순간의 판을 세션별로 남긴다.
 *
 * 🔑 하네스가 이미 막고 있지 않다 — 실측(2026-08-17)으로 갈랐다. 남이 고친 뒤의 Edit 은
 *   "the edit applied cleanly, but the file contains other changes not in your context" 라는
 *   **알림 한 줄과 함께 그대로 적용**됐다. 알림은 되돌림이 아니다.
 *
 * 자리는 tmp 다(세션이 죽으면 같이 사라지는 것이 맞다 — 기준은 그 세션의 눈이지 저장소의 사실이 아니다). */
const 기준DIR = process.env.SYNK_INDEX_BASE_DIR || path.join(os.tmpdir(), 'synk-index-base');
const 기준키 = (sid, file) =>
  `${String(sid).replace(/[^\w.-]/g, '_')}-${crypto.createHash('sha1').update(file).digest('hex').slice(0, 8)}`;
function 기준쓰기(sid, file, 본문) {
  if (!sid || 본문 == null) return;
  try {
    fs.mkdirSync(기준DIR, { recursive: true });
    fs.writeFileSync(path.join(기준DIR, 기준키(sid, file)), 본문, 'utf8');
  } catch (_) { /* 도장을 못 남기면 다음 판정이 「모름」이 된다 — 모름은 아래에서 알림으로 드러난다 */ }
}
function 기준읽기(sid, file) {
  if (!sid) return null;
  try { return fs.readFileSync(path.join(기준DIR, 기준키(sid, file)), 'utf8'); } catch (_) { return null; }
}

/** 이 편집으로 파일이 어떻게 되는지와 무관하게, **셸이 이 파일을 덮어쓰는 모양**인지 본다.
 *
 * F519 의 실사고가 정확히 이 통로였다: 조립 산출물(`MEMORY.new.md`)을 만들고 그것을 옮겼다.
 * 그렇게 들어온 판은 Edit·Write 를 안 거치므로 위 ①②③ 이 **한 번도 안 돈다** — 그리고
 * 그 흔적이 이미 저장소에 남아 있었다: 줄당 250자 가드가 서 있는 내내 301자 줄이 하나 살았다
 * (memory/memory-index-total-cap.md · 「Edit·Write 가 아닌 통로로 들어왔다는 뜻」).
 *
 * ⚠ 여기서 잡는 것은 **셸이 목적지로 이 파일을 적은 경우**뿐이다. `node 조립.js` 처럼
 *   스크립트 안에서 fs 로 쓰는 것은 명령문에 안 드러나 **원리상 못 본다**(이 장치의 대가). */
function 셸덮어쓰기(cmd) {
  const T = String.raw`(?:[^\s"'<>|;&]*[\/\\])?MEMORY\.md`;
  const 후보 = [
    [new RegExp(String.raw`>>?\s*["']?${T}`), '리다이렉트(> · >>)'],
    [new RegExp(String.raw`\btee\b[^|;&]*?${T}`), 'tee'],
    [new RegExp(String.raw`\bsed\b[^|;&]*\s-i[^|;&]*${T}`), 'sed -i'],
    [new RegExp(String.raw`\b(?:mv|cp)\b[^|;&]*\s["']?${T}["']?\s*(?:$|[|;&])`), 'mv·cp 의 목적지'],
    [new RegExp(String.raw`\b(?:Set-Content|Out-File|Add-Content)\b[^|;&]*${T}`), 'PowerShell 쓰기 cmdlet'],
    [new RegExp(String.raw`\b(?:Move-Item|Copy-Item)\b[^|;&]*${T}["']?\s*(?:$|[|;&])`), 'PowerShell 이동·복사의 목적지'],
  ];
  for (const [re, 이름] of 후보) if (re.test(cmd)) return 이름;
  return null;
}

if (tool === 'Bash' || tool === 'PowerShell') {
  const 모양 = 셸덮어쓰기(String(ti.command || ''));
  if (!모양) process.exit(0);
  deny(
    `[memory-index-guard] 셸로 메모리 인덱스를 덮어쓰려 한다 — ${모양}.\n` +
    '→ 이 통로엔 판정층이 **하나도 없다**. 남이 그 사이 넣은 줄이 소리 없이 사라진다(F519 실사고:\n' +
    '  두 세션이 같은 압축을 동시에 했고 나중에 쓴 판이 남이 내린 5줄을 되살렸다 · 발각은 우연이었다).\n' +
    '→ **`Write` 도구로 써라** — 그래야 이 훅이 「내가 읽은 판 vs 지금 디스크」를 대조한다(그게 이 층의 전부다).\n' +
    '→ 조립 산출물(`MEMORY.new.md` 류)은 **스크래치패드**에 둔다. 메모리 폴더에 두면\n' +
    '  `tools/decision-queue.js` 가 폴더의 `*.md` 를 훑어 그것을 새 소스로 읽는다(F519 곁가지: ⏳ 유령 34건).'
  );
}

if (!/^(Read|Edit|Write|MultiEdit)$/.test(tool)) process.exit(0);

const filePath = String(ti.file_path || '').replace(/\\/g, '/');
if (path.basename(filePath) !== TARGET) process.exit(0);

/* Read = 판정이 아니라 **도장**이다(조용히 통과시킨다).
 * ⚠ 구역 읽기(offset·limit)는 도장을 안 찍는다 — 일부만 본 세션을 「전문을 본 세션」으로 세면
 *   아래 3자 대조의 기준이 거짓이 되고, 거짓 기준은 **막아야 할 것을 통과**시킨다.
 *   구역 읽기는 read-budget 이 권장하는 정상 통로라 드문 일도 아니다. */
if (tool === 'Read') {
  if (ti.offset != null || ti.limit != null) process.exit(0);
  try { 기준쓰기(input.session_id, filePath, fs.readFileSync(filePath, 'utf8')); } catch (_) { /* 없는 파일 */ }
  process.exit(0);
}

// 인덱스 항목 줄만 본다. 머리말·구획 제목·인용문은 길어도 되고, 실제로 규칙을 설명하는 자리다.
const isEntry = (line) => /^\s*-\s*\[/.test(line);

/** 이번 편집이 새로 넣는 텍스트(조각 축) — 결과 시뮬레이션이 불가능할 때의 폴백에만 쓴다. */
const incoming = [];
if (tool === 'Write') {
  incoming.push(String(ti.content || ''));
} else {
  const edits = tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti];
  for (const e of edits) incoming.push(String(e.new_string || ''));
}

let 디스크 = null;
try { 디스크 = fs.readFileSync(filePath, 'utf8'); } catch (_) { /* 새 파일이면 전부 새 줄이 맞다 */ }

/* Edit 도구가 실제로 할 치환을 같은 순서로 흉내내 결과 본문을 만든다(board-guard.js 의
 * applyEdits 와 같은 모양). 원래 ② 총량 검사 전용이었는데 ① 줄당 검사도 이걸 쓴다 — F123:
 * 상한이 걸린 대상은 「들어온 조각」이 아니라 「편집 뒤 파일의 줄」이다.
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

/* ── ① 줄당 상한 — 재는 축은 편집 **결과**의 줄이다(F123) ──────────────────────
 * 디스크에 그대로 있던 줄은 안 센다(기존 긴 줄 인질 금지 — 압축·재배치·아카이브 이동은 통과).
 * 단 긴 줄을 **건드렸는데** 상한 위로 남기면 그건 이번 편집의 결과 줄이라 막힌다 —
 * 「부분 치환으로 고쳤더니 여전히 277자」가 조각 축에선 조용히 통과하던 자리가 F123 이다.
 * 결과를 못 만들면(매칭 실패 = 그 Edit 은 어차피 실패한다) 조각 축으로 폴백한다 —
 * 검사가 통째로 사라지는 모양(미실행=통과)은 만들지 않는다. */
const known = new Set(디스크 === null ? [] : 디스크.split('\n').map((l) => l.trim()));
const 검사줄 = 결과 !== null
  ? 결과.split('\n').filter((l) => !known.has(l.trim()))
  : incoming.flatMap((chunk) => chunk.split('\n'));
const offenders = 검사줄.filter((l) => isEntry(l) && l.length > MAX_LINE);

/* ── ③ 동시 편집 — 되돌릴 수 없는 손해라 ①② 보다 **먼저** 판정한다 (F519) ──────────
 *
 * 순서가 규칙이다. F228 에서 이미 한 번 배웠다: ①②(칸·줄수 = 되돌릴 수 있는 불편)가 앞에서
 * deny 해 버리면 겹침 검사(되돌릴 수 없는 손해)가 **구조적으로 침묵**한다. 그래서 ① 은 위에서
 * **계산만** 하고 판정은 여기 아래로 미뤘다. 길이·총량은 문장을 고치면 끝이지만, 모르고 지운
 * 남의 줄은 아무도 모른다 — 되돌림 비용이 다르면 앞자리는 비싼 쪽이 가진다.
 *
 * 재는 축은 셋이다: **내가 읽은 판(기준) · 지금 디스크 · 내가 쓸 판**.
 *   지금 디스크엔 있는데 → 내 기준엔 없었고 → 내 판에도 없는 줄 = **내가 못 본 채 지우는 줄**.
 * 기준에 있던 줄을 내가 뺀 것은 압축이다(내 판정이라 안 막는다 — 그걸 막으면 F103).
 *
 * Write 만 본다. Edit·MultiEdit 은 `old_string` 이 지금 디스크와 대조되므로 **모르는 줄을
 * 원리상 못 지운다** — 안 새는 자리에 검사를 세우면 거짓양성만 는다. */
const 줄집합 = (본문) => new Set(본문.split('\n').map((l) => l.trim()));
const 기준본 = 기준읽기(input.session_id, filePath);
const 소실 = (tool === 'Write' && 디스크 !== null && 결과 !== null && 기준본 !== null)
  ? 디스크.split('\n').filter((l) => {
    const t = l.trim();
    return isEntry(l) && !줄집합(기준본).has(t) && !줄집합(결과).has(t);
  })
  : [];

if (소실.length) {
  const 보기 = 소실.slice(0, 5)
    .map((l) => `   · ${l.trim().slice(0, 90)}${l.trim().length > 90 ? '…' : ''}`).join('\n');
  deny(
    `[memory-index-guard] 내가 읽은 판과 **지금 디스크**가 다르다 — 이 통째 쓰기로 ${소실.length}줄이 사라진다.\n` +
    `${보기}${소실.length > 5 ? `\n   · … 외 ${소실.length - 5}줄` : ''}\n` +
    '→ 이 줄들은 내가 이 파일을 연 뒤에 **다른 세션이 넣은 것**이다(내 기준 판엔 없었다).\n' +
    '  repo 밖 파일이라 git·board-guard·작업본소유자 어느 층도 이 충돌을 못 본다 — 그래서 여기서 본다(F519).\n' +
    '→ ① **`Read` 로 지금 판을 다시 열고** 그 위에서 다시 조립해라 — 내 압축 결과에 저 줄들을 얹는다.\n' +
    '→ ② 그래도 지우는 게 맞다면, 다시 읽은 뒤 같은 Write 를 하면 **통과한다**. 그때는 판정이지 사고가 아니다.\n' +
    '→ ⚠ 줄이는 편집 자체는 안 막는다. 막는 건 «내가 못 본 줄»이 사라지는 것 하나뿐이다.' +
    (offenders.length ? `\n→ (참고) 같은 편집에 ${MAX_LINE}자 초과 줄도 ${offenders.length}개 있다 — 이 건을 푼 뒤 다시 나온다.` : '')
  );
}

if (offenders.length) {
  const worst = offenders.sort((a, b) => b.length - a.length)[0];
  const name = (worst.match(/^\s*-\s*\[([^\]]+)\]/) || [, '?'])[1];
  deny(
    `[memory-index-guard] 인덱스 줄이 ${MAX_LINE}자를 넘는다 — ${offenders.length}줄, ` +
    `최장 ${worst.length}자(${name}).\n` +
    '→ 재는 것은 편집 **결과**의 줄이다 — 조각을 짧게 나눠 넣어도 결과 줄이 길면 막힌다(F123).\n' +
    '→ 인덱스는 지도다. 판정 본문·수치·경위는 **토픽 파일**에 쓰고, 여기엔 한 문장 + 플래그만 남겨라.\n' +
    '→ 🚫재제안 금지·⏳·⚠ 플래그는 깎지 마라. 그게 인덱스의 존재 이유다 — 줄일 것은 설명이다.\n' +
    `→ 이 상한(${MAX_LINE}자)은 발명한 값이 아니라 실측이다: 기존 인덱스의 75%가 이미 그 안에 있다.`
  );
}

/* ── ② 총량 상한 — 위 ① 과 같은 「편집 결과」로 줄 수를 잰다 ─────────────────────
 *
 * 성격 = **차단이 아니라 주입**(memory-status-guard·design-guard 와 같은 판단).
 *
 * 왜 하드 차단이 아닌가 — 옆 세션(a237f510)의 독립 실측이 내 첫 설계를 반박했다:
 *   인덱스 유입은 **하루 19~21줄**인데(08-07 절 실측) 상한은 139줄이고 낡은 절이 비워지는 속도가
 *   그보다 느리다. 하드 차단을 걸면 곧 **상시 차단**이 되고, 처방("뺄 것을 골라라")의 재료도
 *   며칠이면 바닥난다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).
 *   ⚠ 단 「압축은 영구 적자」까지 그대로 받지는 않았다: 낡은 절은 실제로 재생되는 자원이다
 *     (08-07 절 21줄 → 하루 지난 08-06 절 11줄 = 절반이 자연 퇴출).
 *
 * 그래서 **세션당 1회**만 막는다. 자국을 먼저 남기므로 같은 편집을 그대로 다시 실행하면 통과한다.
 *   얻는 것: 늘리는 순간이 **눈에 보이고 의도적**이 된다(12차 손 압축이 실패한 지점이 바로 이 가시성이다).
 *   포기하는 것: 하드 상한. 그건 애초에 이 층에서 못 이긴다 — 진짜 손잡이는 「쪼개기」이고 유호님 판정이다
 *   ([[memory-index-compression-arithmetic]] · 매 세션 상주해야 하는 건 🚫재제안 금지뿐이라는 도전안). */
const 자국DIR = process.env.SYNK_INDEX_CAP_DIR || path.join(os.tmpdir(), 'synk-index-cap');

/** 이번 세션에 이미 말했나. **세션 id 를 모르면 자국을 안 남긴다** — 모름은 통과가 아니다. */
function 이미말했나(sid) {
  if (!sid) return false;
  const f = path.join(자국DIR, String(sid).replace(/[^\w.-]/g, '_'));
  if (fs.existsSync(f)) return true;
  try { fs.mkdirSync(자국DIR, { recursive: true }); fs.writeFileSync(f, String(Date.now())); } catch (_) { /* 자국을 못 남겨도 경고는 낸다 */ }
  return false;
}

const 지금줄 = 디스크 === null ? 0 : 줄수(디스크);

// 보는 건 「지금보다 줄이 늘면서 상한을 넘는 것」 하나뿐이다. 줄이는 편집은 상한 위에서도 조용히 통과한다.
if (결과 !== null && 줄수(결과) > MAX_LINES && 줄수(결과) > 지금줄 && !이미말했나(input.session_id)) {
  deny(
    `[memory-index-guard] 인덱스가 하네스 상한을 넘는다 — 편집 결과 ${줄수(결과)}줄 ` +
    `(상한 ${MAX_LINES}줄 · 지금 ${지금줄}줄).\n` +
    '→ 이 숫자는 이 저장소가 정한 게 아니다. 하네스가 직접 내는 문구다: "Compact it to under 140 lines."\n' +
    '  **자(KB)가 아니라 줄이다** — 문장을 짧게 줄여도 줄 수는 0줄 준다. 줄을 없애야 준다.\n' +
    '→ 처방은 하네스 원문 그대로다: "move detail into topic files, and merge or drop stale entries."\n' +
    '  ① **인덱스 줄의 설명절을 토픽 파일로 옮겨라 — 플래그(🚫·⏳·⚠)와 링크만 남긴다.**\n' +
    '     2026-08-07 실측 기준 이게 **남은 유일한 수단**이다.\n' +
    '  ② 낡은 줄 병합·삭제. ⚠ 병합은 줄을 길게 만들어 곧 줄당 250자 상한에 막힌다 — ①을 먼저 해야 자리가 난다.\n' +
    '  ⛔ 빈줄 걷기·작은 절 병합은 **이미 25줄을 다 썼다**(08-07 · 두 번째 시도가 0쌍). 거기서 다시 찾지 마라.\n' +
    '→ 🚫재제안 금지·⏳·⚠ 플래그는 한 개도 깎지 마라. 그게 인덱스의 존재 이유다 — 줄일 것은 설명절이다.\n' +
    '→ **줄이는 편집은 이 검사를 언제나 통과한다** — 압축·재배치·파일명 교체는 상한 위에서도 안 막힌다.\n' +
    '→ 그래도 이 줄이 남아야 한다고 판단하면 **같은 편집을 그대로 다시 실행하라 — 이 세션에선 통과한다.**\n' +
    '  (하루 유입이 19~21줄이라 이 층은 압축으로 못 이긴다. 진짜 손잡이는 「쪼개기」이고 유호님 판정\n' +
    '   대기다. 여기서 막는 목적은 이기는 게 아니라 **늘리는 순간을 보이게 하는 것**이다.)\n' +
    '→ 지금 상태 = node .claude/hooks/memory-index-guard.js --check <MEMORY.md 경로>'
  );
}

/* ── 여기까지 왔으면 이 편집은 통과다. 두 가지를 남긴다. ─────────────────────────
 *
 * ㉠ **기준 갱신** — 내가 쓰는 판이 곧 내가 아는 판이다. 이걸 안 하면 내 두 번째 Write 가
 *   내 «첫 번째 Write 가 넣은 줄»을 남의 줄로 읽어 스스로를 막는다(거짓차단 = 우회의 씨앗 · F103).
 *   ⚠ 이 도장은 낙관적이다 — 도구가 이 뒤에 실패하면 「쓴 적 없는 판」이 기준이 된다.
 *     그 방향은 **덜 막는 쪽**이라 사고가 아니라 누락이고, 다시 Read 하면 즉시 참으로 돌아온다.
 *
 * ㉡ **기준이 없으면 그렇다고 말한다** — 통째 쓰기인데 이 세션이 이 파일을 전문으로 연 적이 없으면
 *   ③ 은 **아무것도 재지 않았다**. 그때 조용하면 「초록」과 「안 잼」이 화면에서 같은 모양이 된다(F207).
 *   막지는 않는다: 이 훅이 Read 매처에서 빠지는 날 그 침묵이 곧 상시 차단이 되기 때문이다
 *   (따를 수 없는 처방 · F103). 대신 어느 층이 비었는지를 말한다. */
if (결과 !== null) 기준쓰기(input.session_id, filePath, 결과);

if (tool === 'Write' && 디스크 !== null && 기준본 === null) {
  const 글 = '[memory-index-guard] 이 세션은 이 인덱스를 **`Read` 로 연 적이 없다** — '
    + '동시 편집 대조(③)를 **안 돌렸다**(통과가 아니라 미측정이다 · F519).\n'
    + '→ 남이 그 사이 넣은 줄이 이 통째 쓰기에 실려 사라져도 아무도 모른다.\n'
    + '→ 다음부터: 조립 전에 `Read` 로 전문을 연다(구역 읽기 offset·limit 은 기준이 안 된다).\n'
    + '→ 이 알림이 매번 뜨면 매처가 `Read` 를 안 잡고 있다는 뜻이다 — `.claude/settings.json` 을 본다.';
  process.stdout.write(JSON.stringify({
    systemMessage: 글,
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 글 },
  }));
}
