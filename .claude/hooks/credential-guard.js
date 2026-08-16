#!/usr/bin/env node
/* credential-guard — 자격증명이 보이는 화면에서는 손을 뗀다 (F084)
 *
 * 실사고 2026-08-04: Apps Script 스크립트 속성 화면에서 `form_input` 을 썼다.
 *   `find` 가 「empty textbox for a property name」이라고 답한 ref 가 실제로는
 *   **CLAUDE_API_KEY 의 값 칸**이었고, 덮어쓰기가 **이전 값을 응답으로 돌려줘**
 *   API 키가 트랜스크립트에 평문으로 남았다. 오타 1개 막으려다 키를 태웠다.
 *
 * 교훈 두 개가 이 훅의 규칙 두 개다.
 *   ① `find` 의 설명은 **접근성 라벨이지 값이 아니다.** 「비었다」를 사실로 받고 쓰면
 *      눈 감고 덮는 것이다 → 자격증명 화면에서는 쓰기 자체를 막는다.
 *   ② 읽기 금지는 쓰기 금지를 함의한다 → 그 화면은 열어주고 손을 뗀다.
 *
 * 🔴 이 훅이 **못 보는 것**을 먼저 적는다(통과와 미실행이 같은 모양이면 안 되므로).
 *   훅은 도구 입력만 본다. 지금 어느 페이지인지는 `navigate` 로만 알 수 있으므로,
 *   **클릭으로 도달했거나 이미 열려 있던 자격증명 화면은 규칙①이 못 본다.**
 *   그 구간의 방어는 여전히 사람 규율이다 — 이 훅은 가장 흔한 경로(navigate → 쓰기)를
 *   기계로 잠글 뿐이다. 규칙②(값이 자격증명이면 차단)는 URL 을 몰라도 언제나 돈다.
 *
 * ⚠ 이 훅은 **비밀을 절대 기록하지 않는다.** 상태 파일에 담는 건 URL 뿐이고,
 *   차단 사유에도 맞은 값이 아니라 「어떤 종류인지」만 적는다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = process.env.SYNK_CRED_DIR || path.join(os.tmpdir(), 'synk-credential-guard');
const TTL = 12 * 60 * 60 * 1000; // 반나절 지난 URL 기록은 남의(또는 옛) 세션 잔재로 본다

/* ── 자격증명 화면 ────────────────────────────────────────────────────────
 * 값이 보이거나 값을 넣는 화면만. 「설정」 전체를 막으면 오탐이 일상이 되고,
 * 오탐이 일상이면 BYPASS 가 손버릇이 된다(F076·F088 이 그 계열이다). */
const 자격URL = [
  [/script\.google\.com\/.*\/settings/i, 'Apps Script 스크립트 속성 — F084 가 난 바로 그 화면'],
  [/\/settings\/(secrets|variables|keys|tokens|applications|developers)/i, 'GitHub 등의 시크릿·토큰 설정'],
  [/console\.anthropic\.com\/.*(keys|api)/i, 'Anthropic 콘솔 API 키'],
  [/\/(apis\/)?credentials\b/i, 'API 자격증명 화면'],
  [/\/(api[-_]?keys?|apikeys?|access[-_]?tokens?)\b/i, 'API 키·액세스 토큰 화면'],
  [/accounts\.google\.com|myaccount\.google\.com\/(security|signinoptions)/i, '계정·로그인 화면'],
  [/\/(password|signin|login|oauth\/authorize)\b/i, '비밀번호·로그인·권한 승인 화면'],
];

/* ── 로그인해야 쓰는 화면 (F467) ───────────────────────────────────────────
 * 실사고 2026-08-15: 로그인 벽이 있는 인스타그램을 **내장 브라우저**로 열었다가 유호님 교정
 *   (「구글 크롬으로 해줘 왜 굳이 이걸로」). 규약(원격 작업 = 작업 계정 크롬 · `tools/브라우저열기.js`)은
 *   이미 있었는데 **내장 브라우저를 기본값으로 집은 것**이 병이다.
 *
 * 🔑 막는 것은 «내장 브라우저» 하나뿐이다.
 *   `claude-in-chrome` 은 유호님의 **진짜 크롬**이라 로그인 세션이 살아 있고, 그게 정당한 통로다.
 *   서버를 안 가르고 막으면 남는 통로가 없어져 따를 수 없는 처방이 된다(F103 — 그런 가드는
 *   우회를 정상 통로로 만든다). 그래서 아래 사유문은 **갈 수 있는 두 길을 먼저 준다.**
 *
 * ⚠ 목록은 **실측된 것만** 넣는다(근거 없는 조항은 안 넣는다). 로그인 없이 보이는 공개 페이지·
 *   localhost 프리뷰는 내장 브라우저가 맞는 자리라, 넓히는 순간 매 세션 오탐이 된다. */
const 로그인벽 = [
  [/(^|\/\/|\.)instagram\.com/i, '인스타그램 — F467 이 난 바로 그 화면'],
  [/(^|\/\/|\.)(facebook|fb)\.com/i, '페이스북 — 홍보 게시물 발행 통로(유호님 계정)'],
  [/gemini\.google\.com/i, 'Gemini — 이미지·영상 생성(전송은 유호님 손)'],
  [/(script|drive|docs|sheets|mail)\.google\.com/i, '구글 작업 계정 자산 — 계정이 어긋나면 F089 처럼 오진단이 난다'],
  [/supabase\.com\/dashboard/i, 'Supabase 대시보드 — 운영 DB'],
];

/* ── 자격증명처럼 생긴 값 ──────────────────────────────────────────────────
 * 이건 URL 을 몰라도 돈다 — 「비밀을 페이지에 타이핑한다」는 반대 방향의 같은 사고다. */
const 자격값 = [
  [/\bsk-ant-[A-Za-z0-9_-]{16,}/, 'Anthropic API 키'],
  [/\bsk-[A-Za-z0-9]{24,}/, 'OpenAI 계열 API 키'],
  [/\b(ghp|gho|ghs|ghu)_[A-Za-z0-9]{20,}/, 'GitHub 토큰'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub 파인그레인드 토큰'],
  [/\bAIza[0-9A-Za-z_-]{30,}/, 'Google API 키'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack 토큰'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS 액세스 키'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '개인키'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, 'JWT'],
];

/* ── 도구 분류 — 이름은 커넥터마다 다르므로 **접미사**로 본다 ────────────────
 * 🔑 목록은 하나에서 파생시킨다(CLAUDE.md). 아래 두 배열이 settings.json 매처의
 *    근거이고, tests/자격증명가드 가 매처가 이보다 넓은지 되센다. */
const 이동도구 = ['navigate'];
const 쓰기도구 = ['form_input', 'computer', 'browser_batch', 'computer_batch', 'type', 'key',
  'file_upload', 'upload_image', 'javascript_tool', 'teach_step', 'teach_batch', 'write_clipboard'];

const 끝이름 = (t) => String(t || '').split('__').pop();
/** 어느 MCP 서버가 부른 것인가 — `mcp__<서버>__<도구>`. 내장 브라우저와 진짜 크롬을 가르는 축이다. */
const 서버이름 = (t) => (String(t || '').split('__')[1] || '');

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

function 파일(sid) {
  const safe = String(sid || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return path.join(DIR, `${safe}.json`);
}

function 읽기(sid) {
  try {
    const j = JSON.parse(fs.readFileSync(파일(sid), 'utf8'));
    if (!j.at || Date.now() - j.at > TTL) return {};
    return j.tabs || {};
  } catch (_) {
    return {};
  }
}

function 쓰기(sid, tabs) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(파일(sid), JSON.stringify({ at: Date.now(), tabs }));
  } catch (_) {
    /* 기록 실패는 작업을 막지 않는다 — 대신 규칙①이 그만큼 못 본다(위 머리말의 그 구간이다) */
  }
}

/* ── 1회용 예외 ────────────────────────────────────────────────────────────
 * MCP 도구에는 명령 앞에 `BYPASS=1` 을 붙일 자리가 없다(셸 명령이 아니다).
 * 그래서 예외는 **별도의 한 수**로 만든다 — 실수로는 나올 수 없고, 한 번 쓰면 사라진다.
 *   node .claude/hooks/credential-guard.js --allow-next
 * 상시 해제 스위치를 두지 않는 이유: 껐다는 사실을 아무도 기억하지 못하기 때문이다. */
const 예외파일 = () => path.join(DIR, 'allow-next.json');
const 예외TTL = 5 * 60 * 1000;

if (process.argv.includes('--allow-next')) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(예외파일(), JSON.stringify({ at: Date.now() }));
    process.stdout.write('[credential-guard] 다음 1회만 통과시킨다(5분 안에 쓰지 않으면 만료).\n');
  } catch (e) {
    process.stdout.write(`[credential-guard] 예외를 못 적었다: ${e.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

/** 1회용 예외가 살아 있으면 **소비하고** true. 소비는 성공·실패와 무관하게 한 번뿐이다. */
function 예외소비() {
  try {
    const j = JSON.parse(fs.readFileSync(예외파일(), 'utf8'));
    fs.unlinkSync(예외파일()); // 읽는 순간 태운다 — 남겨 두면 상시 해제와 같아진다
    return j.at && Date.now() - j.at < 예외TTL;
  } catch (_) {
    return false;
  }
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0); // 입력을 못 읽으면 검사할 것도 없다
}

const tool = String(input.tool_name || '');
const 이름 = 끝이름(tool);
const ti = input.tool_input || {};
const sid = String(input.session_id || process.env.CLAUDE_CODE_HOST_SESSION_ID || 'unknown');

/* ── 규칙② 먼저 — 값이 자격증명이면 URL 을 몰라도 막는다 ────────────────────
 * 도구를 가리지 않는다: 타이핑이든 붙여넣기든 업로드든, 비밀이 페이지로 나가는 건 같은 사고다. */
const 텍스트 = JSON.stringify(ti);
for (const [re, 뭔지] of 자격값) {
  if (re.test(텍스트)) {
    if (예외소비()) break;
    out('deny', `[credential-guard] 입력값에 ${뭔지}로 보이는 문자열이 있다 — 페이지에 비밀을 넣지 않는다 (F084).`
      + '\n비밀은 사람이 직접 넣는다. 화면을 열어 드리고 손을 떼는 것이 이 저장소의 규약이다.'
      + '\n(맞은 값은 여기 옮겨 적지 않는다 — 사유에 적는 순간 그게 또 트랜스크립트에 남는다.)'
      + '\n\n→ 정말 의도한 것이라면 먼저 유호님께 말하고: node .claude/hooks/credential-guard.js --allow-next');
  }
}

/* ── 이동 도구: URL 을 적어 둔다 + 규칙③(내장 브라우저 ↔ 로그인 벽) ──────── */
if (이동도구.includes(이름)) {
  const url = String(ti.url || '');
  if (url && !/^(back|forward)$/i.test(url)) {
    /* 규칙③ — 기록보다 **먼저** 판정한다. 막은 이동은 일어나지 않았으니 적으면 안 된다
     * (적어 두면 규칙①이 「거기 가 있다」고 믿고 엉뚱한 화면을 자격증명 화면으로 판정한다). */
    if (서버이름(tool) === 'Claude_Browser') {
      for (const [re, 뭔지] of 로그인벽) {
        if (re.test(url)) {
          if (예외소비()) break;
          out('deny', `[credential-guard] 내장 브라우저로 «로그인해야 쓰는 화면»을 연다 — 여기엔 유호님 로그인 세션이 없다 (F467).`
            + `\n대상: ${url}  (${뭔지})`
            + '\n\n🔑 열려도 로그인 화면만 나온다 — 유호님 교정 08-15 「구글 크롬으로 해줘 왜 굳이 이걸로」.'
            + '\n\n→ 둘 중 하나로 간다:'
            + `\n   ㄱ. 유호님이 보고 클릭할 화면이면 —  node tools/브라우저열기.js "${url}"`
            + '\n      (작업 계정 unmet23@gmail.com 크롬 프로필로 연다 · 못 찾으면 폴백 없이 정지)'
            + '\n   ㄴ. 내가 직접 조작해야 하면 —  mcp__claude-in-chrome__* (유호님의 진짜 크롬 · 로그인 세션이 산다)'
            + '\n\n→ 로그인 없이 보이는 공개 페이지라 정말 내장으로 열어야 하면:'
            + '\n   node .claude/hooks/credential-guard.js --allow-next');
        }
      }
    }
    const tabs = 읽기(sid);
    tabs[String(ti.tabId || '_')] = url;
    tabs._최근 = url;
    쓰기(sid, tabs);
  }
  process.exit(0);
}

/* ── 규칙① 쓰기 도구: 마지막으로 간 곳이 자격증명 화면이면 막는다 ────────── */
if (!쓰기도구.includes(이름)) process.exit(0);

// computer 계열은 진짜 「쓰기」일 때만 본다 — 스크롤·클릭까지 막으면 화면을 못 연다
if (이름 === 'computer') {
  const a = String(ti.action || '');
  if (!/^(type|key)$/.test(a)) process.exit(0);
}

const tabs = 읽기(sid);
const url = String(tabs[String(ti.tabId || '_')] || tabs._최근 || '');
if (!url) process.exit(0); // 어디인지 모르면 규칙①은 발동하지 않는다(머리말에 적어 둔 그 구간)

for (const [re, 뭔지] of 자격URL) {
  if (re.test(url)) {
    if (예외소비()) break;
    out('deny', `[credential-guard] 자격증명 화면(${뭔지})에서 \`${이름}\` — 여기서는 손을 뗀다 (F084).`
      + `\n마지막으로 이동한 주소: ${url}`
      + '\n\n🔑 F084 가 정확히 이 자리에서 났다 — `find` 가 「빈 칸」이라고 답한 ref 가 실제로는'
      + '\n   API 키의 값 칸이었고, 덮어쓰기가 **이전 값을 응답으로 돌려줘** 키가 평문으로 남았다.'
      + '\n   `find` 의 설명은 접근성 라벨이지 값이 아니다 — 「비었다」를 사실로 받고 쓰면 눈 감고 덮는 것이다.'
      + '\n\n→ 대신: 화면만 열어 두고 **유호님께 클릭 단위 절차를 드린다**(어느 화면 → 어떤 버튼 → 무엇 입력).'
      + '\n\n→ 자격증명이 아닌 칸을 꼭 만져야 한다면 그 사실을 먼저 유호님께 말하고:'
      + '\n   node .claude/hooks/credential-guard.js --allow-next'
      + '\n   (규칙②·③과 같은 한 수다 — MCP 도구에는 명령 앞에 `BYPASS=1` 을 붙일 자리가 없다. 위 머리말 참조.)');
  }
}

process.exit(0);
