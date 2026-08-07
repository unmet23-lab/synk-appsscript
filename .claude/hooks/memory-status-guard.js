#!/usr/bin/env node
// memory-status-guard — 메모리 토픽 파일에 **해소를 적는 순간**, 같은 파일에 남은 ⏳ 를 그 자리에 펼친다 (PreToolUse 훅)
//
// 왜 있나 (F108 · 2026-08-05 실사고):
//   한 토픽 파일 안에서 「✅ 라이브 반영 종결」 절과 「⏳ clasp push 미실행」 절이 **동시에 살아 있었다.**
//   나중 세션이 해소를 **새 절에 덧붙였고** 앞 절의 ⏳ 를 안 닫았다 —
//   그래서 이미 끝난 배포가 결정 큐를 타고 유호님께 「승인 대기」로 배달됐다.
//   🔑 원인은 오타가 아니라 구조다: **파일 순서는 시간순이 아니다.** 여러 세션이 각자 덧붙이므로
//      「뒤 절이 최신」이라는 보장이 없고, 읽는 쪽(큐·사람)은 줄 하나만 보고 판단한다.
//   장부 처방 = 「토픽 파일의 상태 줄은 하나만 두고 갱신한다」. 이 훅이 그 처방의 발동 장치다.
//
// 왜 **자동 판별이 아니라 주입**인가 (2026-08-06 실측):
//   「⏳ 줄과 해소 줄의 키워드가 겹치면 낡은 것」으로 자동 판정해 봤다 — 큐 40건 중 **27건이 걸렸고**
//   대부분 무관한 줄이었다(공유 토큰 2개면 아무 줄이나 걸린다). 메모리는 git 밖이라 줄 단위 이력도 없고,
//   같은 주제인지 아닌지는 **문장을 해석해야** 갈린다. 거짓양성 가드는 사람이 가드를 무시하게 만든다(F113).
//   → 판정 주체를 사람·모델로 둔다. 대신 **판정할 재료를 정확한 순간에** 눈앞에 놓는다:
//     해소를 적는 그 세션은 방금 무엇을 끝냈는지 알고, 그 파일의 남은 ⏳ 도 다섯 줄 안이면 다 읽는다.
//
// 발동 조건 넷 — 전부 맞아야 뜬다(하나라도 아니면 조용히 통과):
//   ① 메모리 토픽 파일이다(MEMORY.md 는 인덱스라 제외 — 거긴 memory-index-guard 몫)
//   ② 이번 편집이 **새로 넣는 줄**에 해소 표기가 있다(✅·종결·완료·해소·닫음)
//   ③ 편집 후에도 살아 있는 ⏳ 항목이 1건 이상 남는다
//   ④ 이번 편집이 ⏳ 항목을 **하나도 안 줄였다** — 줄였으면 제자리 갱신을 이미 한 것이다
//   ⚠ 천장: 해소를 표식 없이 적으면(예: "유호님 답 왔다, 그대로 간다") 안 뜬다. 표식 없는 해소까지
//     잡으려면 문장 해석이 필요하고, 그게 위에서 기각한 그 길이다.
//
// 「남은 ⏳」의 판정은 **decision-queue 의 줄판정 하나**에서 파생한다 —
//   여기서 자기 정규식으로 세면 큐가 배달하지 않는 줄(헤더·범례·취소선으로 닫힌 줄)까지
//   「남았다」고 말하게 된다. 같은 판정을 두 곳에 적으면 갈라진다(CLAUDE.md 신뢰성 ④).
//
// 성격 = 차단이 아니라 주입(design-guard 와 같은 판단): 세션·파일당 1회만 막고,
//   표시를 **먼저** 남기므로 같은 편집을 그대로 다시 실행하면 통과한다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const { 줄판정 } = require(path.join(ROOT, 'tools', 'decision-queue.js'));
const { memoryDir, INDEX_FILES } = require(path.join(ROOT, 'tools', 'memory-graph.js'));

/* 인덱스는 **한 파일이 아니다**(F184 쪼개기: MEMORY.md + 지도.md). 여기 이름을 다시 적으면
 * 갈라진다 — 목록은 memory-graph 의 INDEX_FILES 하나에서만 파생시킨다(CLAUDE.md 신뢰성 ④). */
const INDEX = INDEX_FILES;
const 해소표기 = /✅|종결|완료|해소|닫음/;
const 보여줄최대 = 8;   // 그 이상은 세션이 안 읽는다 — 나머지는 --check 로 본다

/* ── 곁들여: 파일명 정책 (F181) ──────────────────────────────────────────────
 * 같은 토픽이 날마다 새 파일로 갈라지고, 그 11자(`-YYYY-MM-DD`)가 **인덱스 줄마다** 붙는다.
 * 2026-08-07 실측: 인덱스 링크 153개 × 11자 = 1,683자 = 인덱스의 8.2%. 인덱스는 매 세션
 * 전량 로드되므로 이 몫은 작업량과 무관하게 세션 수만큼 곱해진다.
 * 날짜는 이미 인덱스 구획 제목(`## 최근 (08-07)`)과 파일 본문이 갖고 있어 파일명에선 중복이다.
 * ⚠ 검사 대상은 **아직 없는 파일뿐** — 이미 있는 날짜 파일까지 막으면 옛 메모리를 못 고치게 되고,
 *   그러면 다음 사람은 규칙을 지키는 게 아니라 훅을 끈다(v6.11 「과잉 차단은 BYPASS 습관을 만든다」). */
const 날짜접미사 = /-\d{4}-\d{2}-\d{2}$/;
function 날짜파일명(filePath) {
  return 날짜접미사.test(path.basename(String(filePath)).replace(/\.md$/i, ''));
}

/** 날짜 뗀 이름 — 처방에 그대로 쓴다(F103: 시키는 대로 하면 통과해야 한다). */
function 날짜뗀이름(filePath) {
  return path.basename(String(filePath)).replace(/\.md$/i, '').replace(날짜접미사, '') + '.md';
}

/** 메모리 토픽 파일인가. 인덱스는 지도라 상태를 담지 않는다(거긴 memory-index-guard 몫). */
function 대상인가(filePath, dir) {
  const p = String(filePath).replace(/\\/g, '/');
  const d = String(dir || memoryDir()).replace(/\\/g, '/').replace(/\/$/, '');
  if (!p.toLowerCase().startsWith(d.toLowerCase() + '/')) return false;
  if (!/\.md$/i.test(p)) return false;
  return !INDEX.includes(path.basename(p));
}

/** 살아 있는 ⏳ 항목 — 큐가 실제로 배달하는 줄만. [{n, text}] */
function 살아있는(본문) {
  const out = [];
  String(본문).split('\n').forEach((line, i) => {
    const 판정 = 줄판정(line);
    if (판정 && 판정.clean) out.push({ n: i + 1, text: 판정.clean });
  });
  return out;
}

/** 편집을 적용한 뒤의 본문 — 「남는가」는 편집 전이 아니라 편집 후로 판정해야 한다. */
function 편집후(tool, ti, 원본) {
  if (tool === 'Write') return String(ti.content || '');
  const edits = tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti];
  let s = String(원본 || '');
  for (const e of edits) {
    const old = String(e.old_string || '');
    const neu = String(e.new_string || '');
    if (!old) { s += neu; continue; }          // old 가 비면 신규 작성 취급
    s = e.replace_all ? s.split(old).join(neu) : s.replace(old, neu);
  }
  return s;
}

/** 이번 편집이 새로 넣는 줄만(Write 는 디스크에 없던 줄만) — 기존 ✅ 가 매번 훅을 깨우면 안 된다. */
function 새줄(tool, ti, 원본) {
  const 기존 = new Set(String(원본 || '').split('\n').map((l) => l.trim()));
  const chunks = tool === 'Write'
    ? [String(ti.content || '')]
    : (tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti]).map((e) => String(e.new_string || ''));
  const out = [];
  for (const c of chunks) for (const l of c.split('\n')) if (!기존.has(l.trim())) out.push(l);
  return out;
}

/* 목록에 **행 번호를 안 쓴다** — 이 창의 번호는 「편집 후」 기준이라 아직 디스크에 없는 자리고,
 * 메모리는 세션 여럿이 동시에 고쳐 번호가 곧 밀린다. 찾아가는 근거는 줄 내용이다
 * (CLAUDE.md: 행 번호·좌표는 근거가 아니다 · 결정 큐도 같은 이유로 지문으로 재조준한다). */
function 메시지(filePath, 남은) {
  const 목록 = 남은.slice(0, 보여줄최대)
    .map((it) => `  · ${it.text.length > 150 ? it.text.slice(0, 149) + '…' : it.text}`);
  const 더 = 남은.length > 보여줄최대 ? [`  … 외 ${남은.length - 보여줄최대}건`] : [];
  return [
    `[memory-status-guard] 이 파일에 **해소**를 적는다 — 그런데 같은 파일에 살아 있는 ⏳ 가 ${남은.length}줄 있다.`,
    `  ${path.basename(filePath)}`,
    '',
    '방금 적은 것이 이 중 하나를 끝냈다면 **새 절에만 적지 말고 그 줄을 제자리에서 ⏳→✅ 로 고쳐라.**',
    '파일 순서는 시간순이 아니다 — 세션마다 덧붙이므로 앞 절이 낡은 채 남고, 큐는 줄 하나만 보고',
    '그걸 유호님께 「승인 대기」로 배달한다(F108 실사고: 이미 끝난 배포가 그렇게 나갔다).',
    '',
    ...목록,
    ...더,
    '',
    '무관하면 **같은 편집을 그대로 다시 실행하면 통과한다**(표시는 이미 남겼다 — 세션·파일당 1회).',
    `지금 상태를 다시 재려면: node .claude/hooks/memory-status-guard.js --check "${filePath}"`,
  ].join('\n');
}

/* ── 세션·파일당 1회 ──────────────────────────────────────────────────────── */
const DIR = process.env.SYNK_MEMORY_STATUS_DIR || path.join(os.tmpdir(), 'synk-memory-status-guard');

/** 세션 id 가 없으면 **날짜**로 떨어진다 — 한 파일을 모두가 공유하면 첫 세션 뒤 영영 안 뜬다
 *  (「모름」이 「통과」가 되는 형태 · design-guard 와 같은 판단). */
function 표시경로(sid, filePath) {
  const key = String(sid || process.env.CLAUDE_CODE_HOST_SESSION_ID || `날짜-${new Date().toISOString().slice(0, 10)}`);
  const 파일키 = path.basename(String(filePath)).replace(/\.md$/i, '');
  return path.join(DIR, `${key}__${파일키}`.replace(/[^\w.-]/g, '_') + '.mark');
}

/** 차단 출력 — 두 판정(⏳ 잔존·날짜 파일명)이 같은 통로로 나간다. */
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
}

function 파일명메시지(filePath) {
  return [
    `[memory-status-guard] 새 메모리 파일명에 날짜를 달지 마라 — \`${날짜뗀이름(filePath)}\` 로 써라.`,
    '',
    '같은 토픽이 날마다 새 파일로 갈라지고, 그 11자(`-YYYY-MM-DD`)가 **인덱스 줄마다** 붙는다.',
    '인덱스는 매 세션 전량 로드되므로 이 몫은 세션 수만큼 곱해진다',
    '(2026-08-07 실측: 링크 153개 = 1,683자 = 인덱스의 8.2%. F181).',
    '날짜는 이미 인덱스 구획 제목(`## 최근 (08-07)`)과 파일 본문이 갖고 있다.',
    '',
    '→ 그 이름이 이미 있으면 **그 파일을 갱신해라** — 중복 대신 갱신이 메모리 규칙 그대로다.',
    '→ 정말 다른 주제면 날짜가 아니라 **더 구체적인 슬러그**로 갈라라.',
  ].join('\n');
}

module.exports = { 대상인가, 살아있는, 편집후, 새줄, 메시지, 표시경로, DIR, 해소표기, INDEX, 날짜파일명, 날짜뗀이름, 파일명메시지 };
if (require.main !== module) return; // require 로 불렸으면 여기까지 — 아래는 CLI·훅 본체다

/* --check <파일> : 훅과 **같은 판정기**로 지금 살아 있는 ⏳ 를 센다(F052 — 잴 통로를 하나로).
 * grep '⏳' 로 세면 헤더·범례·취소선으로 닫힌 줄까지 세어 훅과 다른 숫자가 나온다. */
if (process.argv.includes('--check')) {
  const target = process.argv[process.argv.indexOf('--check') + 1];
  if (!target) {
    console.error('사용법: node .claude/hooks/memory-status-guard.js --check <메모리 토픽 파일>');
    process.exit(2);
  }
  let 본문;
  try { 본문 = fs.readFileSync(target, 'utf8'); }
  catch (_) { console.error(`읽을 수 없다: ${target}`); process.exit(2); }
  const 남은 = 살아있는(본문);
  console.log(`[memory-status-guard --check] ${target}`);
  console.log(`  살아 있는 ⏳ ${남은.length}건 — 큐가 배달하는 줄만(헤더·범례·취소선 제외)`);
  for (const it of 남은) console.log(`  ${String(it.n).padStart(4)}행  ${it.text.slice(0, 150)}`);
  process.exit(남은.length ? 1 : 0);
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const tool = String(input.tool_name || '');
if (!/^(Edit|Write|MultiEdit)$/.test(tool)) process.exit(0);

const ti = input.tool_input || {};
const filePath = String(ti.file_path || '').replace(/\\/g, '/');
if (!대상인가(filePath)) process.exit(0);

// 파일명 정책 — **새로 만드는 파일에만**. 있는 파일을 고치는 것은 막지 않는다.
if (날짜파일명(filePath) && !fs.existsSync(filePath)) deny(파일명메시지(filePath));

let 원본 = '';
try { 원본 = fs.readFileSync(filePath, 'utf8'); } catch (_) { /* 새 파일 — 전부 새 줄이 맞다 */ }

// ② 이번 편집이 해소를 적는가
if (!새줄(tool, ti, 원본).some((l) => 해소표기.test(l))) process.exit(0);

// ③④ 편집 후에도 ⏳ 가 남는가 · 이번 편집이 ⏳ 를 줄였는가(줄였으면 이미 제자리 갱신을 했다)
const 남은 = 살아있는(편집후(tool, ti, 원본));
if (!남은.length) process.exit(0);
if (남은.length < 살아있는(원본).length) process.exit(0);

const 표시 = 표시경로(input.session_id, filePath);
if (fs.existsSync(표시)) process.exit(0);

/* 표시를 **먼저** 남긴다. 나중에 남기면 deny 뒤 재실행에서 또 막혀 무한 루프가 된다. */
try {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(표시, new Date().toISOString(), 'utf8');
} catch (e) {
  // 표시를 못 남기면 매번 막게 되므로, 차단하지 않고 드러낸다(F044 — 조용한 통과는 안 된다).
  process.stderr.write(`[memory-status-guard] 세션 표시 실패 — 이번엔 통과시킨다: ${e.message}\n`);
  process.exit(0);
}

deny(메시지(filePath, 남은));
