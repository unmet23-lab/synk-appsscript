#!/usr/bin/env node
// context-budget — 컨텍스트가 「끊을 지점」에 닿았는지 매 턴 알린다 (Stop 훅)
//
// 왜 있나 — 2026-08-04 실측으로 전제가 뒤집혔다.
//   이 저장소의 **바닥값(컴팩트해도 안 줄어드는 상주분)이 68,539 토큰**이다.
//   시스템 프롬프트 + 도구 스키마 + CLAUDE.md(17.5KB) + MEMORY.md(23.7KB) — 200k 창의 34%.
//   그래서:
//     · 컴팩트 도달점  = 바닥 68.5k + 요약문 ≈ 73k
//     · 새 세션 시작점 = 68.5k  ← **더 작고, 요약 손실이 0이다**
//   결론 = 이 저장소에서 컴팩트는 세션 재시작보다 열등하다. 알릴 것은 「컴팩트하라」가 아니라
//   **「지금이 끊을 지점이다」**이고, 끊기가 안전하려면 미커밋이 0이어야 하므로 그것도 같이 본다.
//
// 왜 훅이 컴팩트를 「걸지」 않고 「알리기만」 하나 — 못 걸어서다(공식 문서 실측):
//   훅은 이벤트에 반응만 하고 이벤트를 일으키지 못한다 · 슬래시 명령 실행 불가 ·
//   autoCompactEnabled 는 on/off 뿐이고 **임계값은 하드코딩이라 못 바꾼다** ·
//   PreCompact 훅은 컴팩트를 **막는** 방향만 된다(exit 2). 즉 살 수 있는 건 알림층뿐이다.
//
// 재료가 추정이 아니다 — 트랜스크립트 jsonl 의 assistant 레코드에 API 가 돌려준 **실제 usage** 가 박힌다.
//   컨텍스트 = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
//   (바이트 수로 추정하면 시스템 프롬프트·도구 스키마가 안 잡혀 실제의 절반이 나온다 — 08-04 실측)
//   컴팩트가 일어나도 이 값은 API 가 실제로 받은 양이라 자동으로 내려간다. 별도 처리가 필요 없다.
//
// ⚠ 트랜스크립트는 비동기로 쓰여 현재 턴이 아직 안 실렸을 수 있다(공식 문서). 그래서 이 훅이 읽는 값은
//   **최대 한 턴 뒤처진다**(≈5k). 임계를 여유 있게 잡은 이유다 — 정밀 계측기가 아니라 신호등이다.
//
// 절대 막지 않는다. 끊을지 말지는 유호님 판단이고, 훅은 판단 재료만 준다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// 발화는 **단계당 1회**다(유호님 지시 08-04: "너무 많이 뜨게는 하지 마").
// 매 턴 띄우면 경고가 배경 소음이 되고, 정작 🟡→🔴 상승을 놓친다.
// 이음매는 테스트 격리 전용 — 로직을 끄지 않고 카운터 위치만 바꾼다.
const STATE_DIR = process.env.SYNK_CTXBUDGET_DIR || path.join(os.tmpdir(), 'synk-context-budget');

// 컨텍스트 창. 200k 가정 — 모델이 바뀌면 이 값만 고친다.
const WINDOW = 200_000;

// 08-04 실측 바닥값. 「컴팩트해도 여기까지만 내려간다」를 사람 말로 보여주는 데 쓴다.
const FLOOR = 68_500;

const WARN = 120_000; // 슬슬 트랙을 닫을 준비 — 아직 여유는 있다
const HARD = 150_000; // 지금 끊어라 — 자동 컴팩트(창 한계 근처)가 걸리기 전에

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0); // 입력을 못 읽으면 조용히 — 이 훅은 안전장치가 아니라 계기판이다
}

const tp = String(input.transcript_path || '');
if (!tp || !fs.existsSync(tp)) process.exit(0);

/** 트랜스크립트에서 **마지막** usage 를 찾아 컨텍스트 토큰 수를 낸다. 못 찾으면 null. */
function currentContext(file) {
  let lines;
  try {
    lines = fs.readFileSync(file, 'utf8').split('\n');
  } catch (_) {
    return null;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l || l.indexOf('"usage"') === -1) continue; // 파싱 비용 절약 — 매 턴 도는 훅이다
    let o;
    try { o = JSON.parse(l); } catch (_) { continue; }
    const u = o && o.message && o.message.usage;
    if (!u) continue;
    const n =
      (Number(u.input_tokens) || 0) +
      (Number(u.cache_read_input_tokens) || 0) +
      (Number(u.cache_creation_input_tokens) || 0);
    if (n > 0) return n;
  }
  return null;
}

const ctx = currentContext(tp);
if (ctx === null || ctx < WARN) process.exit(0); // 조용히 통과 — 임계 아래에선 아무 말도 하지 않는다

/** 미커밋이 남았는지. 끊으라고 말하려면 이게 0이어야 안전하다(F025·F037). */
function dirtyFiles(cwd) {
  try {
    const r = spawnSync('git', ['status', '--porcelain'], {
      cwd: cwd || process.cwd(), encoding: 'utf8', timeout: 5000,
    });
    if (r.error || r.status !== 0) return null; // git 을 못 부르면 「모름」 — 0건과 구별한다
    return (r.stdout || '').split('\n').filter((s) => s.trim()).length;
  } catch (_) {
    return null;
  }
}

const dirty = dirtyFiles(input.cwd);
const pct = Math.round((ctx / WINDOW) * 100);
const k = (n) => `${Math.round(n / 1000)}k`;

// 끊기 절차 — 「인계되는 것은 커밋·보드 줄·메모리 셋뿐」(CLAUDE.md 세션 규약)
let steps;
if (dirty === null) {
  steps = '① 미커밋 확인(`git status` 전문) → ② 커밋 → ③ 보드 줄에 다음 할 일 1줄 → ④ 세션 종료';
} else if (dirty > 0) {
  steps = `① **미커밋 ${dirty}건 먼저 커밋**(범위 지정 `+ '`git commit -m "..." -- 경로들`' +
    ') → ② 보드 줄에 다음 할 일 1줄 → ③ 세션 종료';
} else {
  steps = '미커밋 0건 — ① 보드 줄에 다음 할 일 1줄 → ② 세션 종료. 지금 끊으면 잃는 게 없다.';
}

const stage = ctx >= HARD ? 2 : 1;
const level = stage === 2 ? '🔴' : '🟡';
const head = stage === 2 ? '지금 끊을 지점이다' : '슬슬 트랙을 닫을 준비';

// 단계당 1회 — 같은 단계에서 이미 말했으면 조용히 나간다(🟡 뒤 🔴 로 올라가면 한 번 더).
const stateFile = path.join(
  STATE_DIR,
  `${String(input.session_id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)}.json`
);
let said = 0;
try { said = Number(JSON.parse(fs.readFileSync(stateFile, 'utf8')).stage) || 0; } catch (_) { said = 0; }
if (said >= stage) process.exit(0);
try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ stage, at: Date.now() }));
} catch (_) {
  /* 카운터를 못 써도 알림은 낸다 — 다만 그 세션에선 매 턴 뜬다 */
}

/**
 * 새 세션에 **그대로 붙여넣을** 인계 문구(유호님 지시 08-04).
 * 세션 간에 넘어가는 것은 커밋·보드 줄·메모리 셋뿐이라(CLAUDE.md), 그 셋의 주소를 적는다.
 * 이 세션이 뭘 했는지는 추정하지 않고 **`Session-Id` 트레일러로 실제 커밋을 찾는다**(F041 —
 * author·시각 인접성은 세션 구분자가 아니다).
 *
 * ⚠ id 가 **둘**이다. 훅 입력의 `session_id` 는 내부 에이전트 id 고, 트레일러에 박히는 것은
 *   `CLAUDE_CODE_HOST_SESSION_ID`(호스트 세션 id)다 — prepare-commit-msg 가 그렇게 쓰고,
 *   그 파일이 "내부 id 는 쓰지 말 것"이라 명시해 뒀다. 처음에 둘을 같은 것으로 가정했다가
 *   **자기 커밋을 하나도 못 찾았다**(08-04 실측). 트레일러와 같은 원천을 쓴다.
 */
function handoff(cwd, fallbackId) {
  const sessionId = process.env.CLAUDE_CODE_HOST_SESSION_ID || fallbackId;
  const lines = [];
  if (sessionId) {
    const r = spawnSync('git', ['log', '--format=%h %s', '-20', `--grep=Session-Id: ${sessionId}`], {
      cwd: cwd || process.cwd(), encoding: 'utf8', timeout: 5000,
    });
    if (!r.error && r.status === 0) {
      for (const l of String(r.stdout || '').split('\n')) if (l.trim()) lines.push(l.trim());
    }
  }
  const did = lines.length
    ? lines.map((l) => `· ${l}`).join('\n')
    : '· (이 세션 이름으로 된 커밋 없음 — 보드 줄과 메모리에서 찾을 것)';
  return (
    '── 새 세션 열고 아래를 그대로 붙여넣으세요 ──\n' +
    'SYNK 이어서 작업한다. 직전 세션에서 한 것:\n' +
    `${did}\n` +
    `· 미커밋 ${dirty === null ? '(확인 필요)' : `${dirty}건`}\n` +
    '먼저 `git log --oneline -10` 과 `docs/세션보드.md` 를 열어 내 트랙 줄을 찾고, ' +
    '관련 메모리를 읽은 뒤 다음 할 일부터 이어라.\n' +
    '──────────────────────────────'
  );
}

const msg =
  `${level} [context-budget] 컨텍스트 ${k(ctx)} / ${k(WINDOW)} (${pct}%) — ${head}.\n` +
  `${steps}\n` +
  `왜 컴팩트가 아니라 종료인가: 이 저장소 바닥값이 ${k(FLOOR)}라 컴팩트 도달점(≈${k(FLOOR + 5000)})이 ` +
  `새 세션 시작점(${k(FLOOR)})보다 크다. 세션 재시작이 더 작고 요약 손실도 0이다.\n\n` +
  handoff(input.cwd, input.session_id);

// ⚠ systemMessage 만 낸다 — `hookSpecificOutput.additionalContext` 를 붙이면 안 된다.
//
// 신설 당일(2026-08-04) 실측된 자기모순: additionalContext 는 AI 에게 주입돼 **새 턴을 깨운다**.
//   Stop 훅이라 매 턴 끝에 발화하므로, 임계를 넘긴 뒤엔 유호님 입력이 없어도
//   [훅 발화 → AI 턴 → 그 턴의 Stop → 훅 발화] 가 무한히 돈다.
//   실측 4연속: 144k → 147k → 148k → 149k. **컨텍스트를 아끼려고 만든 훅이 컨텍스트를 먹었다.**
//   AI 에게 알릴 실익도 없다 — 끊는 판단과 실행은 유호님 몫이고, AI 는 알아도 할 게 없다.
// 회귀: tests/컨텍스트예산.test.js 「AI 를 깨우지 않는다」.
process.stdout.write(JSON.stringify({ systemMessage: msg }));
process.exit(0);
