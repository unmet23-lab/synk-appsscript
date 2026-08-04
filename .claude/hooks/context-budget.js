#!/usr/bin/env node
// context-budget — 컨텍스트가 「끊을 지점」에 닿았는지 알린다 (Stop 훅)
//
// 왜 있나 — 2026-08-04 실측으로 전제가 뒤집혔다.
//   이 저장소의 **바닥값(컴팩트해도 안 줄어드는 상주분)이 68,539 토큰**이다.
//   시스템 프롬프트 + 도구 스키마 + CLAUDE.md(17.5KB) + MEMORY.md(23.7KB).
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
//   같은 이유로 **세션을 자동으로 끄는 것도 불가능하다**(`continue:false` 도 턴만 멈춘다).
//
// 재료가 추정이 아니다 — 트랜스크립트 jsonl 의 assistant 레코드에 API 가 돌려준 **실제 usage** 가 박힌다.
//   컨텍스트 = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
//   (바이트 수로 추정하면 시스템 프롬프트·도구 스키마가 안 잡혀 실제의 절반이 나온다 — 08-04 실측)
//   컴팩트가 일어나도 이 값은 API 가 실제로 받은 양이라 자동으로 내려간다.
//
// ⚠ 트랜스크립트는 비동기로 쓰여 현재 턴이 아직 안 실렸을 수 있다(공식 문서). 이 훅이 읽는 값은
//   **최대 한 턴 뒤처진다**(≈5k). 정밀 계측기가 아니라 신호등이다.
//
// 절대 막지 않는다. 끊을지 말지는 유호님 판단이고, 훅은 판단 재료만 준다.
'use strict';
const fs = require('fs');
const path = require('path');
const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
const report = require(path.join(__dirname, 'lib', 'session-report.js'));

// 컨텍스트 창 — 모델마다 다르다(F058). 처음엔 200k 로 박아 뒀다가 실측으로 뒤집혔다:
// 이 저장소 트랜스크립트 전수의 최대 관측치 = opus-4-8 999,167 · opus-5 997,026 ·
// fable-5 897,285 · sonnet-5 674,888 · haiku-4-5 189,467. 즉 실제 창은 **1M**이었고
// 200k 가정은 5배 작아 「223k / 200k (112%)」 같은 값을 화면에 냈다.
const WINDOWS = [
  [/^claude-haiku/, 200_000],
  [/^claude-(opus|sonnet|fable)/, 1_000_000],
];
// 모르는 모델은 **작은 쪽**으로 가정한다 — 창을 크게 잡으면 퍼센트가 작아 보여 늦게 알린다.
function windowFor(model) {
  for (const [re, w] of WINDOWS) if (re.test(String(model || ''))) return w;
  return 200_000;
}

// 08-04 실측 바닥값. 「컴팩트해도 여기까지만 내려간다」를 사람 말로 보여주는 데 쓴다.
const FLOOR = 68_500;

// ⚠ 임계는 **창 한계가 아니라 비용 축**이다. 창이 1M 이라 300k 도 30% 에 불과하지만,
//   비용은 창의 몇 퍼센트냐가 아니라 **절대 토큰 × 남은 턴 수**로 붙는다(하루 소비의 88% 가
//   이미 실린 컨텍스트의 재읽기였다).
//
// 숫자는 **전 세션 전사 131개 시뮬레이션**으로 정했다(2026-08-04, 유호님 "300k나 400k는 어때?").
//   끊은 뒤 바닥값 68.5k 에서 다시 쌓이는 톱니를 재현해 순절약과 끊김 횟수를 같이 쟀다:
//     임계   절약률   세션당 끊김   끊김 1회당 효율
//     120k   32.7%    6.1회         5.4%p   ← 소음. 150k 대비 1.2%p 벌자고 끊김이 1.6배
//     150k   31.5%    3.9회         8.1%p   ← 옛 기본값
//     200k   28.8%    2.3회        12.5%p
//     300k   22.6%    1.1회        20.5%p   ← **무릎**. 세션당 정확히 한 번 끊긴다
//     400k   17.0%    0.7회        24.3%p   ← 5.6%p 를 더 포기하는데 끊김은 0.4회만 준다
//   비용 분포도 같은 결론이다 — 150k 아래 세션 32개를 다 합쳐도 전체 비용의 1.1% 고,
//   **400k+ 세션 60개가 87.8%** 를 먹었다. 낮은 임계는 비용과 무관한 자리에서 울린다.
//   ⚠ 시뮬레이션은 「끊어도 같은 턴 수로 같은 일을 한다」고 가정한다 — 새 세션이 파일을
//     다시 읽는 몫이 빠져 있어 실절약은 이보다 낮다. 그래서 절대값이 아니라 **상대 비교**로 썼다.
const WARN_ABS = 200_000; // 🟡 슬슬 트랙을 닫을 준비
const HARD_ABS = 300_000; // 🔴 지금 끊어라 — 여기가 무릎이다
const LAST_ABS = 500_000; // ⚫ 마지막 경고. 🔴 뒤 완전 침묵이면 900k 를 넘겨도 무소식이었다(결함 ⑤).

// ⚠ 절대값만 쓰면 **창이 작은 모델은 영원히 안 울린다** — haiku 는 창이 200k 라
//   컨텍스트가 200k 를 넘을 수가 없다. 임계를 올리자마자 생긴 구멍이다(08-04).
//   그래서 두 축 중 **먼저 걸리는 쪽**을 쓴다: 큰 창은 비용 축(절대값), 작은 창은 용량 축(비율).
//   1M 창 → 200k/300k/500k · 200k 창 → 120k/150k/180k.
function thresholds(win) {
  return {
    WARN: Math.min(WARN_ABS, Math.round(win * 0.60)),
    HARD: Math.min(HARD_ABS, Math.round(win * 0.75)),
    LAST: Math.min(LAST_ABS, Math.round(win * 0.90)),
  };
}

// 발화는 **단계당 1회**다(유호님 지시 08-04: "너무 많이 뜨게는 하지 마").
// 세션당 최대 3번(🟡·🔴·⚫). 매 턴 띄우면 경고가 배경 소음이 되고 정작 단계 상승을 놓친다.

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0); // 입력을 못 읽으면 조용히 — 이 훅은 안전장치가 아니라 계기판이다
}

const tp = String(input.transcript_path || '');
if (!tp || !fs.existsSync(tp)) process.exit(0);

/**
 * 트랜스크립트에서 **마지막** usage 를 찾아 `{ tokens, model }` 을 낸다. 못 찾으면 null.
 * 모델을 같이 돌려주는 이유 = 창 크기가 모델마다 다르기 때문(F058).
 * 같은 줄에서 뽑는다 — 따로 찾으면 토큰과 모델이 다른 턴 것이 섞인다.
 */
function currentContext(file) {
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch (_) { return null; }
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
    if (n > 0) return { tokens: n, model: String((o.message && o.message.model) || '') };
  }
  return null;
}

const info = currentContext(tp);
if (info === null) process.exit(0);

const ctx = info.tokens;
const WINDOW = windowFor(info.model);
const { WARN, HARD, LAST } = thresholds(WINDOW); // 창을 안 뒤에야 임계가 정해진다
if (ctx < WARN) process.exit(0); // 임계 아래에선 아무 말도 하지 않는다

const cwd = input.cwd || process.cwd();
const sid = input.session_id;

const stage = ctx >= LAST ? 3 : ctx >= HARD ? 2 : 1;
if (store.readStage(cwd, sid) >= stage) process.exit(0); // 같은 단계에서 두 번 말하지 않는다
store.writeStage(cwd, sid, stage);

const dirty = report.dirtyCount(cwd);
const pct = Math.round((ctx / WINDOW) * 100);
const k = (n) => `${Math.round(n / 1000)}k`;

const LEVEL = { 1: '🟡', 2: '🔴', 3: '⚫' };
const HEAD = { 1: '슬슬 트랙을 닫을 준비', 2: '지금 끊을 지점이다', 3: '한참 지났다 — 지금 끊어라' };

// 끊기 절차 — 「인계되는 것은 커밋·보드 줄·메모리 셋뿐」(CLAUDE.md 세션 규약)
let steps;
if (dirty === null) {
  steps = '① 미커밋 확인(`git status` 전문) → ② 커밋 → ③ 보드 줄에 다음 할 일 1줄 → ④ 세션 종료';
} else if (dirty > 0) {
  steps = `① **미커밋 ${dirty}건 먼저 커밋**(범위 지정 ` + '`git commit -m "..." -- 경로들`' +
    ') → ② 보드 줄에 다음 할 일 1줄 → ③ 세션 종료';
} else {
  steps = '미커밋 0건 — ① 보드 줄에 다음 할 일 1줄 → ② 세션 종료. 지금 끊으면 잃는 게 없다.';
}

const handoffMsg = report.buildHandoff(cwd, sid, { dirty });

// 🔴 부터 **바통을 떨군다** — 세션이 어떻게 끝나든(창을 그냥 닫아 SessionEnd 가 못 돌아도)
// 다음 세션이 이어받게 하는 보험이다. 평범한 종료는 session-end-handoff 가 따로 떨군다.
if (stage >= 2) store.drop(cwd, sid, handoffMsg, { ctx, trigger: `context-${stage === 3 ? 'last' : 'hard'}` });

const msg =
  `${LEVEL[stage]} [context-budget] 컨텍스트 ${k(ctx)} / ${k(WINDOW)} (${pct}%) — ${HEAD[stage]}.\n` +
  `${steps}\n` +
  `왜 컴팩트가 아니라 종료인가: 바닥값이 ${k(FLOOR)}라 컴팩트 도달점(≈${k(FLOOR + 5000)})이 ` +
  `새 세션 시작점(${k(FLOOR)})보다 크다. 세션 재시작이 더 작고 요약 손실도 0이다.\n\n` +
  report.frame(handoffMsg) +
  '\n💡 창을 새로 열거나 `/clear` 하면 위 문구가 **자동으로 입력**된다(복붙 불필요).';

// ⚠ systemMessage 만 낸다 — `hookSpecificOutput.additionalContext` 를 붙이면 안 된다.
//
// 신설 당일(2026-08-04) 실측된 자기모순: additionalContext 는 AI 에게 주입돼 **새 턴을 깨운다**.
//   Stop 훅이라 매 턴 끝에 발화하므로, 임계를 넘긴 뒤엔 유호님 입력이 없어도
//   [훅 발화 → AI 턴 → 그 턴의 Stop → 훅 발화] 가 무한히 돈다.
//   실측 4연속: 144k → 147k → 148k → 149k. **컨텍스트를 아끼려고 만든 훅이 컨텍스트를 먹었다.**
//   AI 에게 알릴 실익도 없다 — 끊는 판단과 실행은 유호님 몫이다.
// 회귀: tests/컨텍스트예산.test.js 「AI 를 깨우지 않는다」.
process.stdout.write(JSON.stringify({ systemMessage: msg }));
process.exit(0);
