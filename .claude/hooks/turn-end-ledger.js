#!/usr/bin/env node
'use strict';
/**
 * turn-end-ledger — 턴이 끝날 때 «공용 원장 미커밋»을 딱 한 번 짖는다. (Stop 훅)
 *
 * ■ 왜 있나 (유호 픽 2026-09-01 ㉯ · 하네스재판정_0901 §4-B2)
 *   CLAUDE.md 는 「공용 원장(트랙.md·결정.md)은 고치는 즉시 커밋한다」고 적는다.
 *   그런데 그건 **글**이고, 그 글이 못 막은 사고 —「남의 커밋이 내 미커밋을 실어 간다」— 가
 *   **여덟 번** 났다(마지막 넷이 08-26 하루 · 일곱째는 대비 절차를 «실행하는 도중»에,
 *   여덟째는 그 규약을 «짓는 커밋»에서). 「적어 둔다고 막히지 않는다」가 정확히 이 자리다.
 *   ⇒ 검사가 «아직 안 일어난» 시점(턴이 끝나기 직전)에 서야 한다. 끝난 뒤면 부검이다.
 *
 * ■ 설계 판정 넷
 *   ① **deny 는 세션당 한 번뿐이다.** Stop 훅이 반복 deny 하면 무한 루프가 된다(공식 경고).
 *      `stop_hook_active` 를 우선 믿되, 그 필드가 없는 판을 대비해 **파일 스로틀**을 같이 둔다.
 *      두 번째부터는 조용히 통과시킨다 — 못 커밋하는 사정(남의 것·rebase 중)이 있을 수 있고,
 *      그때 세션을 가두는 것이 미커밋보다 나쁘다.
 *   ② **«내 것인가»를 안 가른다.** 이 기계는 세션 일곱이 동시에 도는 곳이라 작업본만 보고는
 *      임자를 못 가른다(그게 사고의 원인이기도 하다). 그래서 문구가 **「남의 것이면 그냥 끝내라」**
 *      를 같이 말한다. 거짓 경보 한 번의 비용 < 실린 미커밋 하나의 비용.
 *   ③ **0건이면 완전 침묵.** rot-check 선례. 매 턴 도는 훅이라 조용함이 기본값이다.
 *   ④ **막는 층이 아니다.** 안전 4종(clasp·git-scope·credential·voice)은 손대지 않았다.
 *      이건 «띄우는» 층이고, 죽으면 세션은 그냥 끝난다(아래 catch).
 *
 * ■ 대가 (틀릴 때의 모습)
 *   - 남의 세션이 원장을 열어 둔 채 오래 두면 내 턴마다(첫 번째만) 헛경보가 뜬다.
 *   - deny 한 번을 소진한 뒤 진짜 미커밋이 생기면 그 세션에선 더 안 짖는다 —
 *     그 자리는 `/close` 와 SessionEnd 훅이 받는다(두 층이 겹쳐야 안 샌다).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { 깃 } = require('./lib/git길.js');

// 공용 원장 — 「임자를 안 적는 파일」만 여기 든다
const 원장 = ['docs/_ops/트랙.md', 'docs/_ops/결정.md'];

function 읽기() {
  return new Promise((resolve) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (s += d));
    process.stdin.on('end', () => resolve(s));
    setTimeout(() => resolve(s), 5000); // stdin 이 안 닫히는 판 대비
  });
}

function 스로틀경로(sid) {
  const dir = path.join(os.tmpdir(), 'synk-stop-hook');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* 이미 있음 */ }
  return path.join(dir, `${String(sid || 'nosid').replace(/[^\w.-]/g, '_')}.짖음`);
}

(async () => {
  let 입력 = {};
  try {
    입력 = JSON.parse((await 읽기()) || '{}');
  } catch {
    process.exit(0); // 입력을 못 읽으면 조용히 통과 — 막는 층이 아니다
  }

  const cwd = 입력.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sid = 입력.session_id;

  // ① 루프 방지 — 이미 한 번 짖었으면 통과
  if (입력.stop_hook_active === true) process.exit(0);
  const 표 = 스로틀경로(sid);
  if (fs.existsSync(표)) process.exit(0);

  // ② 원장이 미커밋인가
  const r = 깃(cwd, ['status', '--porcelain', '--', ...원장]);
  if (!r.ok) {
    // 🔴 못 쟀으면 «0건»과 같은 얼굴로 죽지 않는다 — 턴은 막지 않되 «확인 불가»라고 말한다.
    //    이 훅의 첫 판이 정확히 이 자리에서 침묵했다(cwd 가 POSIX 경로라 spawn 이 ENOENT).
    try { fs.writeFileSync(스로틀경로(sid), 'unmeasured'); } catch { /* 넘긴다 */ }
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        systemMessage: `⚠ 공용 원장 미커밋을 «못 쟀습니다» (${r.why}) — 이건 «0건»이 아닙니다. \`git status\` 로 직접 봅니다`,
      },
    }));
    process.exit(0);
  }
  const 더러움 = r.out.split('\n').map((l) => l.trim()).filter(Boolean);
  if (더러움.length === 0) process.exit(0); // 0건이면 완전 침묵

  try { fs.writeFileSync(표, new Date().toISOString()); } catch { /* 스로틀 실패는 넘긴다 */ }

  const 목록 = 더러움.map((l) => '  · ' + l).join('\n');
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'Stop',
      permissionDecision: 'deny',
      permissionDecisionReason: '공용 원장이 미커밋 상태다',
      additionalContext:
        '🔴 **공용 원장이 미커밋이다 — 끝내기 전에 처리한다.**\n' + 목록 + '\n\n' +
        '· **내가 고친 것이면 지금 커밋한다**: `git commit -m "..." -- <경로>` (범위를 못 박는다).\n' +
        '· **남의 세션 것이면 손대지 말고 그냥 끝낸다** — 이 훅은 임자를 못 가른다.\n' +
        '· rebase·merge 중이면 아무것도 하지 말고 그대로 끝낸다.\n' +
        '⚠ 이 경보는 **이 세션에 한 번뿐**이다(무한 루프 방지). 다음 턴부터는 조용하다.',
      systemMessage: `⚠ 공용 원장 미커밋 ${더러움.length}건 — 내 것이면 커밋, 남의 것이면 그대로 끝냅니다`,
    },
  }));
  process.exit(0);
})().catch(() => process.exit(0));
