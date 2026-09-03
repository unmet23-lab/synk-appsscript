#!/usr/bin/env node
'use strict';
/**
 * model-ledger — 「이 트랙이 어느 모델로 돌았나」를 기계가 적고, 이어받는 세션에게 짖는다.
 *
 * ■ 왜 있나 (09-03 실책 · memory model-effort-defaults 끝머리)
 *   엔진 7종 인계문이 「지금까지 전 단계가 **Fable 5.1** 로 돌았다」를 적어 두었는데,
 *   그 줄을 읽고도 내 세션 모델(Opus)을 확인하지 않고 그대로 이어 돌렸다.
 *   유호님이 다음 날 「이거 맞아?」로 잡으셨다.
 *   ⇒ 이어받는 작업에서 모델은 «세팅»이 아니라 **«재료의 일부»**다.
 *      앞 단계와 같은 모델이라야 뒤 단계가 그 위에 선다.
 *   사람 손(인계문에 적기)에만 걸려 있던 층을 하네스에 넘긴다.
 *
 * ■ 설계 판정 넷 (session-end-ledger 의 규율을 그대로 따른다)
 *   ① **장부는 git 밖이다** — 추적하면 모델을 바꿀 때마다 미커밋이 하나 생겨
 *      `git status` 가 영영 안 깨끗해진다(게이트초 장부가 그 병으로 로컬로 빠졌다).
 *   ② **한 줄 = 한 사건**(append-only). 세션 여럿이 동시에 적어도 줄이 안 깨진다.
 *   ③ **0건이면 완전 침묵.** 모델을 안 바꿨으면 그건 정상이고, 짖으면 세션 첫머리만 시끄러워진다.
 *   ④ **짖는 자리는 «다를 때»뿐** — 앞 세션이 쓰던 모델과 지금이 같으면 아무 말도 안 한다.
 *
 * ■ 대가 (틀릴 때의 모습)
 *   - 세션 «시작» 때의 모델은 전환이 아니라서 장부에 안 남을 수 있다.
 *     그래서 --시작 은 「앞에 무엇이 돌았나」만 말하고 「지금 무엇이냐」는 상태줄에 맡긴다.
 *   - 기계가 강제 종료되면 그 전환은 장부에 없다 — «없다»가 아니라 «못 쟀다»다.
 *
 * 사용법:  node model-ledger.js --전환   (PostModelSwitch 훅)
 *          node model-ledger.js --시작   (SessionStart 훅)
 */
const fs = require('fs');
const path = require('path');

const 장부이름 = '모델장부.jsonl';
const 뿌리 = () => process.env.CLAUDE_PROJECT_DIR || process.cwd();
const 장부경로 = () => path.join(뿌리(), '.claude', 장부이름);

// 기계 이름 → 사람이 읽는 이름. 모르는 것은 원문 그대로 둔다(지어내지 않는다).
const 이름표 = {
  'claude-opus-5': 'Opus 5',
  'claude-opus-4-8': 'Opus 4.8',
  'claude-sonnet-5': 'Sonnet 5',
  'claude-haiku-4-5': 'Haiku 4.5',
  'claude-fable-5-1': 'Fable 5.1',
  'claude-fable-5': 'Fable 5',
};
const 읽는이름 = (id) => (id ? (이름표[id] || id) : '?');

function 입력읽기() {
  return new Promise((resolve) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (s += d));
    process.stdin.on('end', () => resolve(s));
    setTimeout(() => resolve(s), 5000);
  });
}

// ───────────── --전환 : 바뀌는 자리에서 적는다 ─────────────
async function 전환() {
  let 입력 = {};
  try { 입력 = JSON.parse((await 입력읽기()) || '{}'); } catch { /* 입력이 깨져도 전환을 막지 않는다 */ }

  const 줄 = {
    시각: new Date().toISOString(),
    세션: 입력.session_id || null,
    전: 입력.from_model || null,
    후: 입력.to_model || null,
    자리: 입력.cwd || null,
  };
  try {
    fs.appendFileSync(장부경로(), JSON.stringify(줄) + '\n', 'utf8');
  } catch { /* 못 적어도 모델 전환을 막지 않는다 — 이 훅은 기록자이지 문지기가 아니다 */ }

  process.exit(0); // 조용히. 바꾼 사람은 자기가 바꾼 걸 안다.
}

// ───────────── --시작 : 이어받는 세션에게만 짖는다 ─────────────
/* 🔑 「이어받는 세션」만이다. 유호님이 «이 세션 안에서» 모델을 바꾸신 것은 유호님이 아시니 안 짖는다.
 *    그래서 마지막 전환의 세션 id 가 지금 세션과 같으면 침묵한다.
 *    (09-03 실측 교훈: 조건이 «상태»면 한 번 걸린 뒤 계속 뜬다. 알림은 «사건»이어야 한다.) */
async function 시작() {
  let 나 = null;
  try { 나 = (JSON.parse((await 입력읽기()) || '{}')).session_id || null; } catch { /* 없어도 돈다 */ }

  let 줄들;
  try {
    줄들 = fs.readFileSync(장부경로(), 'utf8').trim().split('\n').filter(Boolean);
  } catch {
    process.exit(0); // 장부가 아직 없다 = 이 기계에서 모델을 바꾼 적이 없다. 정상이므로 침묵.
  }

  // 최근 24시간 안의 전환만 본다 — 그보다 오래된 것은 「이어받는 작업」이 아니다
  const 한계 = Date.now() - 24 * 60 * 60 * 1000;
  let 마지막 = null;
  for (let i = 줄들.length - 1; i >= 0; i--) {
    let o;
    try { o = JSON.parse(줄들[i]); } catch { continue; }
    if (!o.후 || !o.시각) continue;
    if (new Date(o.시각).getTime() < 한계) break;
    마지막 = o;
    break;
  }
  if (!마지막) process.exit(0); // 0건이면 완전 침묵
  if (나 && 마지막.세션 === 나) process.exit(0); // 이 세션 안에서 바꾸신 것 — 유호님이 아신다

  const 나이분 = Math.round((Date.now() - new Date(마지막.시각).getTime()) / 60000);
  const 언제 = 나이분 < 60 ? `${나이분}분 전` : `${Math.round(나이분 / 60)}시간 전`;

  // 「이 알림이 값이 있었나」를 2주 뒤에 기계가 세도록 그 자리에서 적어 둔다(tools/알림값점검.js)
  try { require('./lib/알림장부.js').적기('모델', { 전: 마지막.전, 후: 마지막.후 }); } catch { /* 못 적어도 알림은 나간다 */ }

  console.log(
    `🎚 **앞선 작업이 돈 모델** — ${언제} ${읽는이름(마지막.전)} → **${읽는이름(마지막.후)}** 로 바뀌었다.\n` +
    `   이어받는 트랙이면 «앞 단계와 같은 모델»이라야 그 위에 선다(09-03 실책 자리).\n` +
    `   지금 무엇으로 돌고 있는지는 «입력칸 아래 앱 바»가 안다 · 모델 픽은 유호님 몫이다.`
  );
  process.exit(0);
}

const 모드 = process.argv[2];
if (모드 === '--전환') 전환().catch(() => process.exit(0));
else if (모드 === '--시작') 시작().catch(() => process.exit(0));
else { console.error('사용법: --전환 (PostModelSwitch) | --시작 (SessionStart)'); process.exit(1); }
