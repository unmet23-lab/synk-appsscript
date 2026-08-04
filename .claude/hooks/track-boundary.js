#!/usr/bin/env node
// track-boundary — **작업 경계에서** 세션을 끊자고 말한다 (PostToolUse 훅)
//
// 왜 있나 (2026-08-04 · 유호님 "3개 계정으로 직렬작업 계속 끊임없이 할 건데 토큰이 너무 많다"):
//   7일 134세션 실측(`node tools/token-audit.js`)에서 비용의 **88% 가 컨텍스트 재읽기**였고,
//   지침·메모리·도구정의를 합친 세션 시작 오버헤드는 134세션 전부 합쳐 **0.55%** 였다.
//   즉 아낄 자리는 상주물이 아니라 **세션 길이**다 — 턴당 비용이
//   짧은 세션 ≈58k vs 1,500턴 넘긴 세션 336~526k 로 **8배** 벌어진다.
//
//   🔑 그런데 `context-budget`(Stop) 은 이미 있었고, 그래도 08-04 에 2,376·1,572·1,364턴
//      세션이 실제로 있었다. **알림은 떴는데 안 끊긴 것**이다. 이유는 임계가 말해 주는 것이
//      「지금 비싸다」일 뿐 **「지금 끊어도 되는 자리인가」**가 아니었기 때문이다.
//      작업 한복판에서 끊으라는 말은 따를 수 없고, 따를 수 없는 처방은 무시된다(F049 계열).
//
//   그래서 이 훅은 **끊어도 되는 자리**를 찾는다 — 커밋이 성공한 직후. 그 순간은
//   ①작업 단위가 하나 닫혔고 ②인계에 필요한 셋(커밋·보드 줄·메모리) 중 첫째가 이미 남았다.
//   유호님 선택(08-04): "트랙 끝에서 끊자".
//
// 임계 300k = `context-budget` 의 🔴(HARD)와 **같은 값**이다. 유호님 확정 목적이
//   「300k 넘으면 알아서 클로즈」이므로 이 훅은 그 목적에 **종속**된다 — 새 기준을 만들지 않는다.
//   둘의 분업:
//     · context-budget(Stop)      → 300k 도달을 알고 AI 를 깨워 정리를 **시작**시킨다.
//     · track-boundary(PostToolUse) → 그 뒤 커밋이 착지한 순간 **「지금 그 자리다」**를 짚는다.
//   왜 둘이 필요한가 (08-04 실측): 깨워도 안 끊겼다. `f6aa60e5` 는 깨워진 뒤에도 **760k** 까지
//   갔고 `a7a9e4fd` 는 **20번** 깨워졌는데 388k 까지 갔다. 도달을 아는 것과 끊을 자리를 아는 것은
//   다른 일이다 — 작업 한복판의 「끊어라」는 따를 수 없고, 따를 수 없는 처방은 무시된다(F049 계열).
//
// ⚠ 절대 차단하지 않는다. 커밋은 이미 끝났고, **어떤 훅도 세션을 끝내지 못한다**(공식 문서 실측).
//   창 닫기는 유호님 손에 남으므로, 여기서 하는 일은 **끊었을 때 손실이 0이 되게 만드는 것**이다 —
//   인계문을 파일로 남기고 그 경로를 알린다(유호님 08-04: "프롬프트나 텍스트파일을 전달").
'use strict';
const fs = require('fs');
const path = require('path');
const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
const report = require(path.join(__dirname, 'lib', 'session-report.js'));
const { currentContext, FLOOR } = require(path.join(__dirname, 'lib', 'context-size.js'));
const { stripNonExecutedText } = require(path.join(__dirname, 'lib', 'shell-text.js'));

// context-budget 의 🔴(HARD)와 같은 값. 유호님 확정 기준이라 여기서 따로 정하지 않는다.
const 임계 = 300_000;

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const tool = String(input.tool_name || '');
if (!/^(Bash|PowerShell)$/.test(tool)) process.exit(0);

const cmd = String((input.tool_input && input.tool_input.command) || '');
if (!cmd) process.exit(0);

/* 인용·heredoc 안의 산문을 걷어낸 뒤에 본다 — 커밋 메시지에 "git commit" 이라고 적었거나
 * `grep "git commit"` 을 돌린 것까지 경계로 세면 안 된다. commit-noop-guard 와 같은 공용 통로. */
const exec = stripNonExecutedText(cmd);
if (!/\bgit\b[^|;&\n]*?\bcommit\b/.test(exec)) process.exit(0);
if (/\bgit\b[^|;&\n]*?\bcommit\b[^|;&\n]*?(--dry-run|--porcelain)/.test(exec)) process.exit(0);

const res = input.tool_response;
const 출력 = [
  typeof res === 'string' ? res : '',
  res && typeof res === 'object' ? String(res.stdout || '') : '',
  res && typeof res === 'object' ? String(res.stderr || '') : '',
].join('\n');

/* **성공한 커밋만** 경계로 센다. git 은 성공하면 `[master 2b5e7af] <제목>` 을 되뱉는다.
 * commit-noop-guard 는 정확히 이 줄을 걷어내고 나머지를 보고(실패 감지), 이 훅은 이 줄만 본다 —
 * 두 훅이 같은 출력의 **반대편**을 읽는다. no-op 커밋을 「트랙이 닫혔다」로 세면 안 된다(F071). */
if (!/^\s*\[[^\]\n]*\b[0-9a-f]{7,40}\]/m.test(출력)) process.exit(0);

const tp = String(input.transcript_path || '');
if (!tp || !fs.existsSync(tp)) process.exit(0);
const info = currentContext(tp);
if (info === null) process.exit(0);

const ctx = info.tokens;
if (ctx < 임계) process.exit(0); // 싼 구간에서는 아무 말도 하지 않는다

const cwd = input.cwd || process.cwd();
const sid = input.session_id;

/* 세션당 1회. 파일명 규칙은 **store 에서 파생**시킨다 — 여기서 다시 조립하면
 * `sweep()` 이 못 알아보는 이름이 생기고 상태 파일이 영구히 쌓인다(handoff-store 존재 이유 ③). */
const 표식 = path.join(store.stateDir(), `boundary-${store.projectKey(cwd)}-${store.safeId(sid)}.json`);
try { if (fs.existsSync(표식)) process.exit(0); } catch (_) { /* 못 읽으면 한 번 더 말하는 쪽으로 */ }
try {
  fs.mkdirSync(store.stateDir(), { recursive: true });
  fs.writeFileSync(표식, JSON.stringify({ at: Date.now(), cwd: String(cwd), ctx }));
} catch (_) { /* 못 써도 알림은 낸다 — 중복 발화가 침묵보다 낫다 */ }

const k = (n) => `${Math.round(n / 1000)}k`;
const 배수 = (ctx / FLOOR).toFixed(1);
const dirty = report.dirtyCount(cwd);
const 인계문 = report.buildHandoff(cwd, sid, { dirty, reason: '트랙 경계에서 정리' });
// 파일로도 남긴다 — 자동 입력이 안 닿는 자리(다른 계정·폰)에서 유호님이 열어 복사할 통로.
const 파일 = report.writeHandoffFile(cwd, 인계문, { sessionId: sid, reason: '트랙 경계' });

const 본문 =
  `[track-boundary] **커밋이 하나 착지했다 — 지금이 끊기 좋은 자리다.**\n\n`
  + `· 이 세션은 지금 **매 턴 ${k(ctx)}** 를 다시 청구한다. 새 창은 ${k(FLOOR)} 에서 시작한다.\n`
  + `· 즉 여기서 계속하면 같은 일을 **새 창의 ${배수}배 값**으로 하는 것이다.\n`
  + (dirty === null ? '· 미커밋: 확인 필요\n'
    : dirty === 0 ? '· 미커밋 0건 — 인계 조건이 이미 갖춰졌다\n'
      : `· 저장소 미커밋 ${dirty}건 — 내 것이 섞였는지 \`node tools/작업본소유자.js\` 로 가른다\n`)
  + `\n**유호님께 이렇게 전한다** (그대로 옮기지 말고, 아래 판단을 먼저 하고 말한다):\n`
  + `  · 이어서 할 **굵직한 일이 남았으면** → 지금 끊는 게 이득이다. 보드 줄을 다음 할 일까지\n`
  + `    적어 두고(그게 인계의 전부다), 유호님께 "이 창을 닫고 새 창을 열어 주세요"라고 말한다.\n`
    + `    이때 **아래 인계문을 그대로 보여 준다** — 새 창이 열리면 자동으로 입력되지만,\n`
  + `    자동 입력이 안 되는 경로(다른 계정·폰)에서는 유호님이 이걸 복사해 붙이면 그대로 이어진다.\n`
  + (파일 ? `    같은 내용이 **\`docs/_ops/인계문.md\`** 에도 저장됐다 — 이 경로를 유호님께 알린다.\n` : '')
  + `  · **자잘한 마무리만** 남았으면 그냥 끝내라. 끊는 것 자체도 비용이다(새 세션은 파일을 다시 읽는다).\n`
  + `  · 유호님이 계속하자고 하시면 그대로 계속한다 — 이건 계기판이지 게이트가 아니다.\n\n`
  + report.frame(인계문);

process.stdout.write(JSON.stringify({
  systemMessage: `📍 트랙 경계 — 컨텍스트 ${k(ctx)}(새 창의 ${배수}배). 끊을지 판단할 자리`,
  hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 본문 },
}));
process.exit(0);
