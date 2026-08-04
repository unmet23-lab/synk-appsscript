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
// 컨텍스트를 재는 규칙과 바닥값은 **공용 통로 하나**에서 온다 — 이 값을 읽는 훅이
// track-boundary 까지 둘이 됐고, 두 곳에 적으면 갈라진다(CLAUDE.md 가드 등록층 ④ · F063).
const { currentContext, FLOOR } = require(path.join(__dirname, 'lib', 'context-size.js'));

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

// 바닥값(FLOOR)은 lib/context-size.js 에 있다 — track-boundary 와 같은 수를 봐야 한다.

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

// 🔴 **위가 통째로 침묵 구간이었다**(결함 ⑤의 재발 — 08-04 실측).
//   단계당 1회라 300k 에서 한 번 울면 500k 까지 무신호, ⚫ 뒤로는 영원히 무신호였다.
//   하루 실측에서 세 세션이 600k·771k·786k 까지 **아무 신호 없이** 올라갔다.
//   그래서 🔴(HARD) 부터는 **STEP 마다 다시 운다.**
//
//   ⚠ 간격이 200k→100k 로 좁아졌다. 유호님 지시가 뒤집혔기 때문이다:
//     08-04 오전 "너무 많이 뜨게는 하지 마" → 같은 날 저녁 **"조금 더 떠도 될 것 같다.
//     뜬지 안 뜬지 내가 체크를 못했나?"** — 여덟 번을 띄우고도 못 보셨다는 뜻이라,
//     소음을 걱정할 게 아니라 **눈에 닿는 횟수**를 늘려야 하는 국면이다.
//   1M 창 기준 200·300·400·500·600·700·800·900k = 최대 8회.
const REPEAT_ABS = 100_000;

// 창이 작은 모델도 같은 비율로 — haiku(200k 창)면 HARD 150k · STEP 40k 라 창 안에서 2번.
function thresholds(win) {
  return {
    WARN: Math.min(WARN_ABS, Math.round(win * 0.60)),
    HARD: Math.min(HARD_ABS, Math.round(win * 0.75)),
    LAST: Math.min(LAST_ABS, Math.round(win * 0.90)),
    STEP: Math.max(1, Math.min(REPEAT_ABS, Math.round(win * 0.20))),
  };
}

// ⚠ 절대값만 쓰면 **창이 작은 모델은 영원히 안 울린다** — haiku 는 창이 200k 라
//   컨텍스트가 200k 를 넘을 수가 없다. 임계를 올리자마자 생긴 구멍이다(08-04).
//   그래서 두 축 중 **먼저 걸리는 쪽**을 쓴다: 큰 창은 비용 축(절대값), 작은 창은 용량 축(비율).
//   1M 창 → 200k/300k/500k(+700k·900k) · 200k 창 → 120k/150k/180k.

// 발화는 **단계당 1회**다. 매 턴 띄우면 경고가 배경 소음이 되고 정작 단계 상승을 놓친다.
// 단계는 🟡 하나 + 🔴 위로 STEP 마다 하나씩이라, 1M 창에서 세션당 최대 8번.

/** ctx → 단계. 1=🟡(WARN) · 2 이상은 HARD 부터 STEP 마다 +1. */
function stageOf(ctx, t) {
  if (ctx >= t.HARD) return 2 + Math.floor((ctx - t.HARD) / t.STEP);
  return 1;
}

/** 색은 단계가 아니라 **컨텍스트**로 정한다 — 창이 다른 모델에서도 같은 뜻이어야 한다. */
function levelOf(ctx, t) { return ctx >= t.LAST ? '⚫' : ctx >= t.HARD ? '🔴' : '🟡'; }

function headOf(stage) {
  if (stage === 1) return '슬슬 트랙을 닫을 준비';
  if (stage === 2) return '지금 끊을 지점이다';
  if (stage === 3) return '한참 지났다 — 지금 끊어라';
  // 4번째부터는 「몇 번째로 말하는지」를 세어 보여준다 — 같은 문구가 반복되면 배경이 된다.
  // 단계 번호 = 그 세션에서 이번이 몇 번째 발화인지와 같다(단계당 1회니까).
  return `${stage}번째 경고 — 아직 안 끊었다`;
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0); // 입력을 못 읽으면 조용히 — 이 훅은 안전장치가 아니라 계기판이다
}

const tp = String(input.transcript_path || '');
if (!tp || !fs.existsSync(tp)) process.exit(0);

const info = currentContext(tp); // 규칙은 lib/context-size.js 에 있다(두 훅 공용)
if (info === null) process.exit(0);

const ctx = info.tokens;
const WINDOW = windowFor(info.model);
const T = thresholds(WINDOW); // 창을 안 뒤에야 임계가 정해진다

const cwd = input.cwd || process.cwd();
const sid = input.session_id;

const stage = ctx < T.WARN ? 0 : stageOf(ctx, T);
const prev = store.readStage(cwd, sid);

// 🔑 **컨텍스트가 내려가면 단계도 따라 내린다.**
//   안 내리면 컴팩트 뒤의 다음 사이클이 통째로 침묵한다 — 08-04 실측: 760k 까지 갔다가
//   컴팩트로 174k 가 된 세션의 stage 가 4로 남아, 다시 300·400·500·600k 를 넘어도
//   전부 억제되고 700k 에 닿아야 입을 열게 돼 있었다. 컴팩트 한 번이 알림 400k 구간을
//   통째로 삼킨다. 억제 카운터는 「가장 높이 갔던 곳」이 아니라 **지금 어디인지**를 담아야 한다.
//   ⚠ 내려갈 때는 말하지 않는다 — 줄어든 건 좋은 일이고, 알릴 것은 오르는 쪽뿐이다.
if (stage < prev) { store.writeStage(cwd, sid, stage); process.exit(0); }
if (stage === 0) process.exit(0); // 임계 아래에선 아무 말도 하지 않는다
if (prev >= stage) process.exit(0); // 같은 단계에서 두 번 말하지 않는다
store.writeStage(cwd, sid, stage);

// 🔴 **첫 도달에만** AI 를 깨워 정리를 시킨다 — 세션당 정확히 1회.
// 유호님 08-04: "지금은 자동화가 아니야. 억지로 내가 신경써야" — 화면에 문구만 띄우는 건
// 계기판이지 자동화가 아니었다. 여기서 AI 가 커밋·보드 줄·메모리를 끝내 두면
// 유호님에게 남는 손일은 **창을 닫는 것 하나**가 된다(그건 어떤 훅도 대신 못 한다).
const wake = prev < 2 && stage >= 2;

const dirty = report.dirtyCount(cwd);
const pct = Math.round((ctx / WINDOW) * 100);
const k = (n) => `${Math.round(n / 1000)}k`;

// 끊기 절차 — 「인계되는 것은 커밋·보드 줄·메모리 셋뿐」(CLAUDE.md 세션 규약)
//
// ⚠ 절차를 나열하지 않는다. 08-04 실측: 경고가 8번 떴는데도 세션은 786k 까지 갔다.
//   부족한 건 알림이 아니라 **끊는 비용**이었다 — 커밋·보드·메모리 셋을 손으로 하려니
//   「나중에」가 됐다. 그래서 알림을 늘리는 대신 **한 줄로 실행되게** 한다(유호님 확정, 08-04).
//   `/close` 스킬이 그 셋을 순서대로 처리한다(.claude/skills/close/SKILL.md).
const CLOSE = '**`/close`**';
let steps;
if (dirty === null) {
  steps = `${CLOSE} 라고 입력하면 미커밋 확인·커밋·보드 줄·인계까지 한 번에 끝난다.`;
} else if (dirty > 0) {
  steps = `미커밋 ${dirty}건 — ${CLOSE} 라고 입력하면 범위 지정 커밋·보드 줄·인계까지 한 번에 끝난다.`;
} else {
  steps = `미커밋 0건 — ${CLOSE} 로 보드 줄만 정리하면 끝. 지금 끊으면 잃는 게 없다.`;
}

const handoffMsg = report.buildHandoff(cwd, sid, { dirty });

// 🔴 부터 **바통을 떨군다** — 세션이 어떻게 끝나든(창을 그냥 닫아 SessionEnd 가 못 돌아도)
// 다음 세션이 이어받게 하는 보험이다. 평범한 종료는 session-end-handoff 가 따로 떨군다.
if (stage >= 2) store.drop(cwd, sid, handoffMsg, { ctx, trigger: `context-${stage === 3 ? 'last' : 'hard'}` });
// 🔴 부터는 **파일로도** 남긴다 — 바통(자동 입력)이 안 닿는 자리(다른 계정·폰)의 보조 통로.
// 유호님 08-04: "새 세션에서 바로 이어서 할 수 있게 프롬프트나 텍스트파일을 전달".
if (stage >= 2) report.writeHandoffFile(cwd, handoffMsg, { sessionId: sid, reason: `컨텍스트 ${Math.round(ctx / 1000)}k` });

// ⚠ 퍼센트를 앞세우지 않는다 — **거짓 안심을 준다**(유호님 "오푸스·페이블만 쓸 것", 08-04).
//   그 둘은 창이 1M 이라 끊어야 할 지점에서도 「31%」로 보인다. 실제 근거는 창 점유율이 아니라
//   **한 턴마다 그만큼을 통째로 다시 읽는다**는 것이다(하루 비용의 88% 가 그 재읽기였다).
//   그래서 절대값과 턴당 재읽기를 앞에 놓고, 퍼센트는 괄호 안 참고로만 남긴다.
const msg =
  `${levelOf(ctx, T)} [context-budget] 컨텍스트 ${k(ctx)} — ${headOf(stage)}. ` +
  `**한 턴마다 ${k(ctx)} 를 다시 읽는다**(창 ${k(WINDOW)} 의 ${pct}% — 창은 기준이 아니다).\n` +
  `${steps}\n` +
  `왜 컴팩트가 아니라 종료인가: 바닥값이 ${k(FLOOR)}라 컴팩트 도달점(≈${k(FLOOR + 5000)})이 ` +
  `새 세션 시작점(${k(FLOOR)})보다 크다. 세션 재시작이 더 작고 요약 손실도 0이다.\n\n` +
  report.frame(handoffMsg) +
  '\n💡 창을 새로 열거나 `/clear` 하면 위 문구가 **자동으로 입력**된다(복붙 불필요).';

// ⚠ AI 를 깨우는 것(`additionalContext`)은 **🔴 첫 도달 1회로 못 박는다.**
//
// 신설 당일(2026-08-04) 무한 루프를 실측했다: additionalContext 는 AI 턴을 깨우고,
//   Stop 훅이라 그 턴이 끝나면 또 발화한다 → [훅 → AI 턴 → Stop → 훅] 이 유호님 입력
//   없이 돈다(실측 4연속 144k→147k→148k→149k). **컨텍스트를 아끼려던 훅이 컨텍스트를 먹었다.**
//   그때 처방은 「아예 안 깨운다」였다. 그 대가가 유호님이 매번 직접 정리하는 것이었고,
//   같은 날 저녁 그게 마찰로 돌아왔다 — "지금은 자동화가 아니야. 억지로 내가 신경써야."
//
// 루프를 막는 건 「안 깨우기」가 아니라 **단계 억제**다: wake 는 `prev < 2 && stage >= 2`
//   라 세션당 딱 한 번 참이 된다. AI 가 깨어나 정리하며 컨텍스트가 올라 다음 단계에
//   닿아도 그때는 prev >= 2 라 다시 깨우지 않는다(화면 문구만 나간다).
// 회귀: tests/컨텍스트예산.test.js 「AI 는 🔴 첫 도달에만 깨운다」.
const out = { systemMessage: msg };
if (wake) {
  out.hookSpecificOutput = {
    hookEventName: 'Stop',
    additionalContext: [
      `[context-budget] 컨텍스트가 ${k(ctx)} 를 넘었다. **이건 유호님이 방금 시킨 일이 아니라 훅이 자동 발동한 것이다.**`,
      '유호님에게 남는 손일이 「창 닫기」 하나가 되도록 **지금 인계를 끝내라** — `/close` 스킬의 절차를 따른다:',
      '① `git status` 전문으로 내 미커밋만 가려 범위 지정 커밋 ② `docs/세션보드.md` 의 내 트랙 줄에 **다음 할 일 1줄** ③ 굵직한 판정이 있으면 메모리에.',
      '끝나면 **한 줄로 보고하고 멈춘다.** 새 작업을 시작하지 않는다 — 끊을지 말지는 유호님이 정한다.',
    ].join('\n'),
  };
}
process.stdout.write(JSON.stringify(out));
process.exit(0);
