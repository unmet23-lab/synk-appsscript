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
const { spawnSync } = require('child_process');

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

const level = ctx >= HARD ? '🔴' : '🟡';
const head = ctx >= HARD
  ? `지금 끊을 지점이다`
  : `슬슬 트랙을 닫을 준비`;

const msg =
  `${level} [context-budget] 컨텍스트 ${k(ctx)} / ${k(WINDOW)} (${pct}%) — ${head}.\n` +
  `${steps}\n` +
  `왜 컴팩트가 아니라 종료인가: 이 저장소 바닥값이 ${k(FLOOR)}라 컴팩트 도달점(≈${k(FLOOR + 5000)})이 ` +
  `새 세션 시작점(${k(FLOOR)})보다 크다. 세션 재시작이 더 작고 요약 손실도 0이다.`;

process.stdout.write(JSON.stringify({
  systemMessage: msg, // 유호님 화면
  hookSpecificOutput: {
    hookEventName: 'Stop',
    additionalContext: msg + '\n(이 신호를 받으면 다음 답 첫머리에 종료 제안을 1줄 올린다.)',
  },
}));
process.exit(0);
