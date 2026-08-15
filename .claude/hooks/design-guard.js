#!/usr/bin/env node
// design-guard — 시각 산출물을 만질 때 브랜드 킷이 **반드시** 컨텍스트에 들어오게 한다 (PreToolUse 훅)
//
// 왜 있나 (2026-08-06, 유호님 지시):
//   "디자인같은거 할때는 상시로 적용하게 세팅해줘 브랜딩이 가장 중요한데 빼먹으면 안돼"
//
//   진단 — **스킬은 불러야 적용된다.** 항상 떠 있는 건 이름+설명 한 줄뿐이고,
//   본문(규칙 전문)은 Skill 툴로 호출할 때만 컨텍스트에 들어온다. 안 부르면 규칙이 아예 없다.
//   트랜스크립트 407개 실측(2026-08-06):
//     · make-interfaces-feel-better  0회  ← 08-05 반입 후 한 번도 적용된 적이 없다
//     · emil-design-eng              0회
//     · review-animations            호출 불가(disable-model-invocation) → **2026-08-09 유호 판정으로 삭제**
//     · synk-design                  4회
//   그 사이 발표물 HTML 6종·크루카드가 그 원칙 없이 만들어졌다.
//
// 층이 이미 둘 있는데 둘 다 이 구멍을 못 막는다:
//   · CLAUDE.md — 매 턴 상주하지만 **디자인 언급이 0건**이다(2026-08-06 grep 실측).
//   · 회귀 5종  — 색·폰트·대비 같은 **값**은 잡는다(브랜드렌더린트는 렌더 픽셀까지 잰다).
//                 못 잡는 건 **감각**(모서리·그림자·광학 정렬·히트 영역·모션)이고 그게 스킬의 몫이다.
//   → 남은 구멍 = 「스킬을 부를 생각을 하는가」. 그건 프로즈로 못 막는다
//     (CLAUDE.md 「프로즈보다 기계 강제로 옮긴다」의 적용).
//
// 성격 = **차단이 아니라 주입**이다.
//   세션에서 시각 산출물을 처음 만질 때 딱 1회 막고 그 자리에서 킷을 넣는다.
//   표시를 **먼저** 남기므로 같은 편집을 그대로 재실행하면 통과한다(막는 게 목적이 아니다).
//   매번 막으면 BYPASS 습관이 생기고(voice-guard 가 화이트리스트를 고른 것과 같은 판단),
//   아예 안 막으면 stdout 은 모델에 안 실려 조용히 통과한다 — 그래서 「1회 deny」다.
//
// ⚠ 킷 본문을 여기 적지 않는다 — DESIGN.md 에서 **파생**한다.
//   같은 판정을 두 곳에 적으면 갈라진다(CLAUDE.md 신뢰성 §, 가드 맹점④).
//   앵커는 문구가 바뀌면 죽으므로 tests/디자인가드.test.js 가 추출 결과가 비면 빨개진다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
// 경로를 밖에서 갈아끼울 수 있어야 **앵커가 죽은 판**을 픽스처로 만들 수 있다
// (실저장소가 깨끗해지면 「앵커 죽음을 잡는다」를 아무도 증명하지 않게 된다).
const DESIGN = process.env.SYNK_DESIGN_MD || path.join(ROOT, 'DESIGN.md');

/* 대상 = 「눈에 보이는 것」이 나오는 파일. DESIGN.md 머리말의 범위와 같다.
 * `.md` 는 대상이 아니다 — 문서는 시각 산출물이 아니고, 넣으면 거짓양성이 폭발해
 * 훅 자체가 꺼진다(read-budget·voice-guard 가 같은 이유로 범위를 좁혔다). */
const 대상 = [
  /\.(html|css|svg)$/i,               // 인쇄물·발표물·웹앱·크루카드·아이콘
  /\.(tsx|jsx)$/,                     // 앱 화면(SYNK-talk Expo UI 착수 대비)
  /(^|\/)docs\/디자인_토큰\.json$/,    // 색·서체 값의 기계 원천 — 여기서 CSS 가 파생된다
];

/* 제외 — 이유 없는 제외는 두지 않는다(브랜드렌더린트 `제외` 와 같은 규율). */
const 제외 = [
  [/(^|\/)tests\//, '픽스처는 **일부러 더럽다** — 탐지력을 지려면 위반이 살아 있어야 한다'],
  [/(^|\/)node_modules\//, '남의 코드 — 우리 킷을 적용할 대상이 아니다'],
];

const 대상인가 = (p) => 대상.some((re) => re.test(p)) && !제외.some(([re]) => re.test(p));

/* ── 킷 추출 — DESIGN.md 가 정본이고 여기는 파생이다 ────────────────────── */

/** 앵커로 시작해 **빈 줄**까지를 그대로 떠온다(CRLF 포함 — 이 저장소 파일은 \r\n 이다). */
function 블록(본문, 앵커) {
  const i = 본문.indexOf(앵커);
  if (i < 0) return '';
  const 끝 = 본문.slice(i).search(/\r?\n\r?\n/);
  return (끝 < 0 ? 본문.slice(i) : 본문.slice(i, i + 끝)).replace(/\r/g, '').trim();
}

/** 한 줄짜리 앵커. */
function 줄(본문, 앵커) {
  const line = 본문.replace(/\r/g, '').split('\n').find((l) => l.includes(앵커));
  return line ? line.trim() : '';
}

function 킷추출() {
  let 본문;
  try { 본문 = fs.readFileSync(DESIGN, 'utf8'); } catch (_) { return null; }
  const 조각 = {
    삼규칙: 줄(본문, '- 3규칙:'),
    이모지: 줄(본문, '이모지 과다 금지'),
    철칙: 블록(본문, '**철칙 4**'),
    감각: 줄(본문, '- 감각 규칙:'),
  };
  // 앵커가 하나라도 죽으면 **조용히 빈 킷을 내보내지 않는다** — 빈 주입은 미실행과 같은 모양이다.
  조각.죽은앵커 = Object.entries(조각).filter(([k, v]) => k !== '죽은앵커' && !v).map(([k]) => k);
  return 조각;
}

/* 「전문을 읽어라」는 처방의 **대가를 지금 재서** 말한다.
 * 🔴 여기 크기를 손으로 적으면 파일이 자라는 순간 거짓말이 된다 — 실측(2026-08-14 · #Q73):
 *   이 줄은 「≈4.5KB — read-budget 무료 구간」이라 적혀 있었는데 실물은 **17,507B** 였다.
 *   즉 read-budget 이 「큰 파일」로 막는 읽기를 이 훅이 **무료라고 말하며 권하고** 있었다.
 *   그게 F103 「따를 수 없는 처방」이고, 따를 수 없는 처방은 우회를 정상 통로로 만든다.
 *   장치는 안 도는 쪽보다 **맞는 얼굴로 틀린 값을 내는 쪽**으로 더 자주 샌다(CLAUDE.md 맹점 ④).
 * 🔴 2차(2026-08-15 · #Q73 수리 하루 만에 26B 재초과): 초과 분기의 구 처방 「파일을 문턱 아래로
 *   되돌려라」 자체가 사람이 바이트를 지키는 해법이라 재발했다(같은 절차 2번째 = 시스템 결함).
 *   그래서 지금 초과 분기는 수선 지시가 아니라 **따라갈 수 있는 읽기 경로**를 처방한다 —
 *   구역 읽기(limit≤CHUNK)는 read-budget 이 **일부러 예산 밖에 둔** 권장 통로다(그쪽 F103 조항).
 *   크기·CHUNK·구역 수 전부 지금 재서 말한다. 「한 구역에 전문이 들어온다」는 전제는
 *   tests/디자인가드.test.js 가 줄수 ≤ CHUNK 로 지킨다(바이트 문턱보다 수십 배 여유).
 * BIG·CHUNK 는 read-budget 소스에서 읽는다 — 같은 값을 두 곳에 안 적는다.
 * ⚠ 대가: 선언 모양이 바뀌면 정규식이 못 잡아 무료/초과 판정만 조용히 빠진다(크기는 계속 맞다).
 *   그 자리는 닫혀 있다 — BIG 파싱이 죽으면 문턱 초과 픽스처가 「넘었다」를 잃고,
 *   CHUNK 파싱이 죽으면 그 테스트의 상수 추출 단언이 먼저 적색이 된다. */
function 전문읽기_대가() {
  let size;
  try { size = fs.statSync(DESIGN).size; } catch (_) {
    return '값이 더 필요하면 DESIGN.md 전문을 연다 — 크기를 못 쟀으니 구역 읽기(`offset`+`limit`)로.';
  }
  const kb = (size / 1024).toFixed(1);
  const 속 = '킷 표·철칙·폰트 스택·로고·산출물별 통로';
  let BIG = null;
  let CHUNK = null;
  try {
    const 예산 = fs.readFileSync(path.join(ROOT, '.claude', 'hooks', 'read-budget.js'), 'utf8');
    const m = 예산.match(/const BIG\s*=\s*(\d+)\s*\*\s*(\d+)/);
    if (m) BIG = Number(m[1]) * Number(m[2]);
    const c = 예산.match(/const CHUNK\s*=\s*(\d+)/);
    if (c) CHUNK = Number(c[1]);
  } catch (_) { /* 못 읽으면 크기만 말한다 — 이 훅을 여기서 멈추지 않는다 */ }
  if (BIG === null) return `값이 더 필요하면 DESIGN.md 전문(${kb}KB): ${속}.`;
  const bigKb = (BIG / 1024).toFixed(0);
  if (size < BIG) return `값이 더 필요하면 DESIGN.md 전문(${kb}KB — read-budget 무료 구간 ${bigKb}KB 안): ${속}.`;
  let 구역처방 = '`Read` 에 `offset`+`limit` 을 줘 **구역으로** 연다';
  if (CHUNK !== null) {
    let 줄수 = null;
    try { 줄수 = fs.readFileSync(DESIGN, 'utf8').split(/\r?\n/).length; } catch (_) { /* 줄수 없이 말한다 */ }
    const 구역수 = 줄수 === null ? null : Math.max(1, Math.ceil(줄수 / CHUNK));
    구역처방 = `\`Read\` 에 \`limit: ${CHUNK}\` 을 줘 **구역으로** 연다`
      + (구역수 === null ? '' : 구역수 === 1
        ? `(${줄수}줄이라 그 한 번에 전문이 다 들어온다)`
        : `(${줄수}줄 = ${구역수}구역 — offset 을 ${CHUNK}씩 올려 이어 읽는다)`);
  }
  return `⚠ DESIGN.md 가 ${kb}KB 로 read-budget 「큰 파일」(${bigKb}KB)을 넘었다 — 전문 통짜 읽기는 예산(세션·일일)에 걸린다.\n`
    + `  전문이 필요하면 ${구역처방} — 구역 읽기는 그 예산 밖이다(같은 파일 재읽기만 센다). ${속} 전부가 거기 있다.`;
}

function 메시지(filePath) {
  const k = 킷추출();
  if (!k) {
    return `[design-guard] DESIGN.md 를 못 읽었다 (${DESIGN}). 킷 없이 시각 산출물을 만들지 않는다 — 경로부터 확인해라.`;
  }
  const 킷 = [k.삼규칙, k.이모지, '', k.철칙, '', k.감각].filter((v) => v !== undefined).join('\n');
  const 경고 = k.죽은앵커.length
    ? `\n⚠ DESIGN.md 앵커 ${k.죽은앵커.join('·')} 가 죽었다 — 아래 인용이 불완전하다. **DESIGN.md 전문을 읽어라.**\n`
    : '';
  return [
    `[design-guard] 시각 산출물이다 — 이 세션에서 브랜딩이 아직 안 걸렸다: ${filePath}`,
    `킷을 넣는다. **표시는 이미 남겼으니 같은 편집을 그대로 다시 실행하면 통과한다.**`,
    경고,
    '── DESIGN.md 에서 그대로 인용 ' + '─'.repeat(46),
    킷,
    '─'.repeat(78),
    '',
    '순서: ① 킷으로 골격(색·타이포·로고) → ② 스킬로 디테일 → ③ 린트로 증명. **충돌하면 킷이 이긴다.**',
    '  ② 디테일 스킬 — 값이 아니라 감각을 채운다(회귀 테스트가 원리상 못 잡는 층):',
    '     · make-interfaces-feel-better : 모서리·광학 정렬·그림자·히트 영역·tabular-nums·아이콘 획',
    '     · emil-design-eng             : 모션·이징·인터랙션 판단 (모션이 있을 때만)',
    '  ③ 검사 — node tools/브랜드렌더린트.js <파일>   (0=위반없음 1=위반 2=크롬없음·미실행)',
    '',
    전문읽기_대가(),
    '새 파일이면 렌더 린트 등록층(tools/브랜드렌더린트.js `대상`)에 넣을지 판단해라 — 등록 안 된 파일은 CI 가 영원히 안 본다.',
  ].join('\n');
}

/* ── 세션 표시 — 세션당 1회 ──────────────────────────────────────────────── */

const DIR = process.env.SYNK_DESIGN_GUARD_DIR || path.join(os.tmpdir(), 'synk-design-guard');

/** 세션 id 가 없으면 **날짜**로 떨어진다 — 모든 세션이 한 파일을 공유하면
 *  첫 세션 이후로 영영 안 뜬다(「모름」이 「통과」가 되는 형태). 최소 하루 1회는 뜬다. */
function 표시경로(sid) {
  const key = String(sid || process.env.CLAUDE_CODE_HOST_SESSION_ID || `날짜-${new Date().toISOString().slice(0, 10)}`);
  return path.join(DIR, key.replace(/[^\w.-]/g, '_') + '.mark');
}

module.exports = { 대상, 제외, 대상인가, 킷추출, 메시지, 표시경로, DIR, DESIGN };
if (require.main !== module) return; // require 로 불렸으면 여기까지 — 아래는 CLI·훅 본체다

/* --show : 훅이 실제로 넣는 문장을 그대로 본다(잴 통로를 하나로 — F052).
 * 회귀가 이걸 되먹여 「따를 수 없는 처방」인지 검사한다(F103). */
if (process.argv.includes('--show')) {
  console.log(메시지('<예시>.html'));
  process.exit(킷추출()?.죽은앵커.length ? 1 : 0);
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

if (!/^(Edit|Write|MultiEdit)$/.test(String(input.tool_name || ''))) process.exit(0);

const filePath = String((input.tool_input || {}).file_path || '').replace(/\\/g, '/');
if (!대상인가(filePath)) process.exit(0);

const 표시 = 표시경로(input.session_id);
if (fs.existsSync(표시)) process.exit(0); // 이번 세션엔 이미 걸렸다 — 조용히 통과

/* 표시를 **먼저** 남긴다. 나중에 남기면 deny 뒤 재실행에서 또 막혀 무한 루프가 된다. */
try {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(표시, new Date().toISOString(), 'utf8');
} catch (e) {
  // 표시를 못 남기면 매번 막게 되므로, 차단하지 않고 드러낸다(F044 계열 — 조용한 통과는 안 된다).
  process.stderr.write(`[design-guard] 세션 표시 실패 — 이번엔 통과시킨다: ${e.message}\n`);
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: 메시지(filePath),
  },
}));
