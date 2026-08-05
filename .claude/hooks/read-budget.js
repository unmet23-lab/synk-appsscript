'use strict';
/**
 * read-budget — 큰 파일 **전문** 읽기 예산 (PreToolUse: Read)
 *
 * 왜 있나 (2026-08-05, 유호님 마찰):
 *   "매번 앱스크립트를 읽는건지 뭘 하는건지 모르겠는데 답변할때마다 너무 느리고 토큰도 엄청
 *    잡아먹거든? 중요한 작업이나 내가 스킬쓸때 말고는 간단한 md파일만 읽고 답변해줬으면 좋겠어."
 *
 *   진단은 앱스크립트가 아니었다. **메모리 파일 한 개가 지침+인덱스를 합친 것보다 컸다** —
 *   실측: memory/ai-stack-decision.md 75,603 B = **36,111 토큰**(Read 상한 25k에 걸려 잘림).
 *   CLAUDE.md 18,739 B · MEMORY.md 27,644 B · memory 폴더 전체 171파일 1,287,409 B.
 *   즉 「관련 메모리를 읽는다」는 이름의 한 호출이 세션 시작 오버헤드 전체를 넘어섰다.
 *
 * ⚠ 프로즈는 이미 있었고 이미 샜다 — CLAUDE.md 「큰 파일은 Grep으로 찾아 Read offset/limit로
 *   그 구역만(전체 읽기 금지)」 조항이 있는 상태에서 그 사고가 났다(내가 어겼다).
 *   「프로즈보다 기계 강제」의 적용이라 여기로 옮긴다.
 *
 * 성격 = **안전장치가 아니라 예산 관리**다(screenshot-budget 계열).
 *   큰 파일 전문 읽기가 정당한 국면이 실제로 있다(압축 작업·정본 전수 검수·스킬 실행).
 *   그래서 사다리다: 조용히 통과 → 눈에 보이게 경고 → 차단, 그리고 리셋 통로를 남긴다.
 *   차단만 있으면 유호님이 "중요한 작업"이라 부른 국면 자체가 불가능해진다.
 *
 * 층이 셋인 이유 — 하나만 두면 그 단위 밖으로 샌다(screenshot-budget이 실측으로 배운 것):
 *   ① 세션당  : 한 세션에서 몇 개를 통째로 여는가
 *   ② 하루    : 세션을 갈아타며 새는 것을 막는다(08-04 스크린샷 실사고와 같은 형태)
 *   ③ 파일별  : **같은 파일 재읽기**. token-audit 실측에서 재읽기가 소모의 ≈절반이었다 —
 *               전문 3회보다 같은 파일 10회가 비싼데, ①②만으론 후자가 안 보인다.
 *
 * 알려진 구멍(다음 실패 때 여기서 잡을 것): limit≤CHUNK 구역 읽기를 여러 번 이어 붙이면
 *   전문과 같아진다. ③이 그 대부분을 잡지만(구역 읽기도 파일별로 센다) 파일을 갈아타며
 *   나눠 읽는 형태는 통과한다. 실측 전에 과잉 설계하지 않는다.
 *
 * 리셋(의도적 예외): node .claude/hooks/read-budget.js --reset [--session X]
 * 회귀 = tests/읽기예산.test.js (로직·등록층·자기 처방까지 검사).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FREE = 3;       // 세션: 이 수까지는 조용히 통과
const HARD = 6;       // 세션: 이 수를 넘기면 차단(= 7번째부터)

const DAY_FREE = 8;   // 하루: 조용히 통과
const DAY_HARD = 18;  // 하루: 이 수를 넘기면 차단

const REREAD_FREE = 2; // 같은 파일: 이 횟수까지 조용히
const REREAD_HARD = 5; // 같은 파일: 이 횟수를 넘기면 차단

// 「큰 파일」의 경계. 16 KB ≈ 7,600 토큰(아래 환산 근거) — 한 호출이 이보다 커지면
// 그 비용은 남은 턴 수만큼 곱해진다. 작은 파일은 이 훅이 아예 건드리지 않는다.
const BIG = 16 * 1024;

// 「구역 읽기」의 경계(줄). 이 이하로 limit 을 주면 무료 통과 — 처방이 시키는 경로를
// 벌주면 그 처방은 따를 수 없는 처방이 되고, 우회가 정상 통로가 된다(F103).
const CHUNK = 400;

// 바이트→토큰 환산. 실측 1건에서 뽑은 계수다(ai-stack-decision.md 75,603 B = 36,111 토큰).
// 한글 UTF-8 기준이라 영문·코드에는 과대평가된다 — 그래서 문구에 「약」을 붙이고
// 판정에는 쓰지 않는다(판정은 바이트로 한다). 사람이 크기를 체감하라고 있는 숫자다.
const TOKENS_PER_KB = 478;

// 이 층의 대상이 아닌 것들. 이미지는 screenshot-budget 계열이고, PDF 는 pages 파라미터가
// 따로 있어 전문/구역 구분이 다르다. 여기서 막으면 엉뚱한 곳에서 거짓양성이 난다.
const NOT_TEXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.pdf']);

// 이음매 2개는 **테스트 격리 전용**이다(로직을 끄지 않는다 — 카운터를 어디에 둘지만 바꾼다).
const DIR = process.env.SYNK_BUDGET_DIR || path.join(os.tmpdir(), 'synk-read-budget');

function dayKey() {
  if (process.env.SYNK_BUDGET_DAY) return String(process.env.SYNK_BUDGET_DAY);
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function safeName(s) {
  return String(s || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
}

function counterFile(sessionId) {
  return path.join(DIR, `s-${safeName(sessionId)}.json`);
}

function dayFile(day) {
  return path.join(DIR, `d-${safeName(day)}.json`);
}

function readState(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { n: Number(j.n) || 0, files: j.files && typeof j.files === 'object' ? j.files : {} };
  } catch (_) {
    return { n: 0, files: {} };
  }
}

function writeState(file, state) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ n: state.n, files: state.files, at: Date.now() }));
  } catch (_) {
    /* 카운터를 못 써도 작업을 막지 않는다 — 이 훅은 예산 관리지 안전장치가 아니다 */
  }
}

// ── CLI: 리셋 ─────────────────────────────────────────────────────────────
// `--reset` 단독 → 세션·일일 전부. `--reset --session X` → 그 세션만(일일은 그대로 남는다).
if (process.argv.includes('--reset')) {
  const idIdx = process.argv.indexOf('--session');
  try {
    if (idIdx !== -1 && process.argv[idIdx + 1]) {
      fs.unlinkSync(counterFile(process.argv[idIdx + 1]));
      console.log('[read-budget] 그 세션의 예산만 리셋했다 (일일 예산은 그대로).');
    } else {
      let removed = 0;
      for (const f of fs.readdirSync(DIR)) {
        if (/^[sd]-.*\.json$/.test(f)) { fs.unlinkSync(path.join(DIR, f)); removed += 1; }
      }
      console.log(removed
        ? '[read-budget] 세션·일일 예산을 리셋했다. 왜 전문이 필요한지 답에 1줄 남길 것.'
        : '[read-budget] 리셋할 카운터가 없다(이미 0).');
    }
  } catch (_) {
    console.log('[read-budget] 리셋할 카운터가 없다(이미 0).');
  }
  process.exit(0);
}

// ── 훅 본체 ───────────────────────────────────────────────────────────────
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

if (String(input.tool_name || '') !== 'Read') process.exit(0);

const ti = input.tool_input || {};
const fp = ti.file_path;
if (!fp || typeof fp !== 'string') process.exit(0);

if (NOT_TEXT.has(path.extname(fp).toLowerCase())) process.exit(0);

let size;
try {
  const st = fs.statSync(fp);
  if (!st.isFile()) process.exit(0);
  size = st.size;
} catch (_) {
  process.exit(0); // 없는 파일은 Read 자신이 알린다 — 예산 문제가 아니다
}

if (size <= BIG) process.exit(0); // 작은 파일은 이 훅의 관심 밖이다

const kb = Math.round(size / 1024);
const approxTok = Math.round((size / 1024) * TOKENS_PER_KB);
const HOW = '큰 파일은 통째로 열지 말고 ①`Grep`으로 필요한 줄을 찾고 ②`Read`에 `offset`+`limit`(≤'
  + CHUNK + ')을 줘서 그 구역만 읽는다.';
const RESET = '정말 전문이 필요하면: `node .claude/hooks/read-budget.js --reset` 실행 후 사유를 1줄 남긴다.';

const lim = Number(ti.limit);
const isChunk = Number.isFinite(lim) && lim > 0 && lim <= CHUNK;

const day = dayKey();
const sfile = counterFile(input.session_id);
const dfile = dayFile(day);
const sst = readState(sfile);
const dst = readState(dfile);

// 파일별 재읽기는 **구역 읽기도 센다** — 같은 파일을 400줄씩 20번 읽으면 전문보다 비싸다.
const key = path.resolve(fp);
const rn = (sst.files[key] || 0) + 1;

if (rn > REREAD_HARD) {
  out('deny',
    `[read-budget] 이 세션에서 \`${path.basename(fp)}\`를 이미 ${rn - 1}번 읽었다 — 같은 파일 상한 ${REREAD_HARD}회 초과.\n` +
    '재읽기는 실측에서 토큰 소모의 **약 절반**을 차지했다. 이미 읽은 내용은 대화에 남아 있으니 다시 열지 말고 그것을 쓴다.\n' +
    `${HOW}\n${RESET}`);
}

// 구역 읽기는 전문 예산(세션·일일)을 먹지 않는다 — 권장 경로를 벌주지 않기 위해서다.
if (isChunk) {
  sst.files[key] = rn;
  writeState(sfile, sst);
  if (rn > REREAD_FREE) {
    out('allow', `[read-budget] \`${path.basename(fp)}\` ${rn}번째 읽기(상한 ${REREAD_HARD}회). 이미 본 구역을 다시 열고 있지 않은지 확인할 것.`);
  }
  process.exit(0);
}

// 여기부터 = 큰 파일 **전문** 읽기
const n = sst.n + 1;
const dn = dst.n + 1;

if (n > HARD) {
  out('deny',
    `[read-budget] 이 세션에서 큰 파일을 이미 ${n - 1}개 통째로 읽었다 — 세션 상한 ${HARD}개 초과.\n` +
    `이번 대상: \`${path.basename(fp)}\` ${kb} KB(약 ${approxTok.toLocaleString()} 토큰).\n` +
    `${HOW}\n${RESET}`);
}

if (dn > DAY_HARD) {
  out('deny',
    `[read-budget] 오늘 이미 큰 파일 ${dn - 1}개를 통째로 읽었다 — **일일 상한 ${DAY_HARD}개** 초과.\n` +
    '세션을 새로 열어도 이 예산은 그대로다. 상한이 세션당이던 층은 세션을 갈아타며 샜다(08-04 실사고).\n' +
    `${HOW}\n${RESET}`);
}

sst.n = n;
sst.files[key] = rn;
writeState(sfile, sst);
dst.n = dn;
writeState(dfile, dst);

const notes = [];
if (n > FREE) notes.push(`세션 ${n}/${HARD}개`);
if (dn > DAY_FREE) notes.push(`오늘 ${dn}/${DAY_HARD}개`);
if (rn > REREAD_FREE) notes.push(`\`${path.basename(fp)}\` ${rn}번째`);

if (notes.length) {
  out('allow',
    `[read-budget] 큰 파일 전문 읽기 — ${notes.join(' · ')} · 이번 ${kb} KB(약 ${approxTok.toLocaleString()} 토큰).\n${HOW}`);
}

process.exit(0);
