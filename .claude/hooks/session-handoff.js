#!/usr/bin/env node
// session-handoff — 직전 세션이 떨군 인계 문구를 새 세션의 첫 메시지로 넣는다 (SessionStart 훅)
//
// 왜 있나 (유호님 지시 2026-08-04: "자동으로 끄고 이어서 마지막 정리글만 새 세션에 자동으로 시작하게"):
//   context-budget 훅이 🔴(150k)에서 인계 문구를 화면에 띄우지만, 유호님이 그걸 **복붙**해야 했다.
//   `initialUserMessage` 로 새 세션의 첫 프롬프트에 바로 넣으면 그 손일이 사라진다.
//
// ⚠ 자동화되는 건 절반뿐이다 — **세션을 자동으로 끄는 건 불가능하다**(공식 문서 실측:
//   어떤 훅도 세션을 종료하지 못하고 `continue:false` 도 턴만 멈춘다). 끄는 동작은
//   유호님이 창을 닫거나 `/clear` 하는 한 번으로 남는다. 그 하나는 없앨 방법이 없다.
//
// 바통 = `.claude/state/handoff.json`(gitignore 됨 · context-budget 이 씀).
//   **한 번 쓰면 지운다** — 안 지우면 며칠 뒤 새 세션이 옛 인계문을 물고 시작한다.
//   TTL 도 둔다: 오래된 바통은 이미 끝난 트랙이라 이어받으면 오히려 방해다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// context-budget 과 **같은 폴더**를 봐야 한다(이음매도 같은 이름 — 갈라지면 바통이 안 넘어간다)
const STATE_DIR = process.env.SYNK_CTXBUDGET_DIR || path.join(os.tmpdir(), 'synk-context-budget');
const BATON = path.join(STATE_DIR, 'handoff.json');

const TTL_MS = 12 * 60 * 60 * 1000; // 12시간 — 하루 넘은 인계는 트랙이 이미 바뀌었다고 본다

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { /* 입력 없이도 계속 */ }

// `resume` 은 컨텍스트가 그대로 살아 있으므로 인계문이 필요 없다(중복 지시가 된다).
// 등록 매처에서도 거르지만, 판정층을 하나로 두려고 여기서도 본다.
const src = String(input.source || input.matcher || '');
if (src === 'resume') process.exit(0);

let baton;
try {
  baton = JSON.parse(fs.readFileSync(BATON, 'utf8'));
} catch (_) {
  process.exit(0); // 바통 없음 = 평범한 새 세션. 조용히 통과.
}

// 읽었으면 성패와 무관하게 **먼저 지운다** — 남겨두면 다음 세션도, 그 다음 세션도 물고 온다.
try { fs.unlinkSync(BATON); } catch (_) { /* 못 지워도 아래 TTL 이 2차 방어 */ }

const at = Number(baton && baton.at) || 0;
if (!at || Date.now() - at > TTL_MS) process.exit(0);

const msg = String((baton && baton.message) || '').trim();
if (!msg) process.exit(0);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    initialUserMessage: msg,
  },
  systemMessage: '↩ 직전 세션의 인계 문구를 첫 메시지로 넣었다 (context-budget 바통).',
}));
process.exit(0);
