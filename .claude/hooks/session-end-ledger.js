#!/usr/bin/env node
'use strict';
/**
 * session-end-ledger — 세션이 «어떤 상태로 죽었는지»를 적고(SessionEnd),
 *                      다음 세션 첫머리에 그 유산을 짖는다(SessionStart).
 *
 * ■ 왜 있나 (유호 픽 2026-09-01 ㉯ · 하네스재판정_0901 §4-B1)
 *   `/close` 스킬이 **스스로** 적어 둔 구멍이다:
 *     「세션이 죽으며 열어둔 채 남긴 PR을 짖는 훅은 **지금 없다**. 닫거나 다음 할 일을 적는 자리는 여기뿐이다」
 *   그런데 실측(09-01 · 최근 7일 96세션): **`/close` 로 끝난 세션은 11개뿐**이다.
 *   나머지 **85세션은 그 「여기뿐」인 자리를 안 지나고 죽었다.** 즉 마지막 층이 사람 손에만 걸려 있었다.
 *   ⇒ 하네스가 `SessionEnd` 를 이미 내고 있으므로, 그 자리를 하네스에 넘긴다.
 *
 * ■ 설계 판정 다섯
 *   ① **`SessionEnd` 는 컨텍스트를 못 주입한다**(공식 규격 — systemMessage 만 낸다).
 *      그래서 «죽는 세션에게» 말하지 않고 **«다음 세션이 읽을 장부»에 적는다.** 통로가 둘이 아니라 하나다.
 *   ② **장부는 git 밖이다.** 추적하면 세션이 끝날 때마다 미커밋이 하나 생겨 `git status` 가 영영
 *      안 깨끗해진다 — 게이트초 장부가 정확히 그 병으로 로컬로 빠졌다(08-30 · `11a28fbd7`).
 *      선례는 `기억래칫.json`: **도구가 쓰고 도구가 읽는 기계 상태.**
 *   ③ **알릴 때는 장부를 안 믿고 «지금 git» 과 대조한다.** 장부는 그 시점 사진이라 곧 낡는다.
 *      아직 그대로 남아 있는 것만 짖는다 — 안 그러면 다음 세션이 «이미 처리된 것»에 겁먹는다.
 *   ④ **제일 무거운 것은 «안 민 커밋»이다** — CLAUDE.md 「안 민 작업은 이 기계에만 있는 것이다」.
 *      미커밋보다 먼저 적고 먼저 짖는다.
 *   ⑤ **0건이면 완전 침묵**(rot-check 선례). 죽었는데 남긴 게 없으면 그건 정상이다.
 *
 * ■ 대가 (틀릴 때의 모습)
 *   - 세션 여럿이 동시에 죽으면 장부 줄이 섞인다 → 그래서 **append-only 한 줄 = 한 사건**이고
 *     읽을 때 세션 id 별 최신만 본다(`자율기록.js` 급소 ①과 같은 자리).
 *   - 기계가 강제 종료되면 `SessionEnd` 가 아예 안 돈다 → 그 세션은 장부에 없다.
 *     그래서 SessionStart 는 장부만이 아니라 **지금 git 상태도 같이** 본다(③의 다른 쓸모).
 *
 * 사용법:  node session-end-ledger.js --끝     (SessionEnd 훅)
 *          node session-end-ledger.js --시작   (SessionStart 훅)
 */
const fs = require('fs');
const path = require('path');
const { 깃 } = require('./lib/git길.js');

const 장부이름 = '세션끝장부.jsonl';

// 🔑 «못 쟀다»(null)와 «0건»(빈 배열·0)을 갈라서 돌려준다 — 둘이 같은 얼굴이 되면 이 장부가 거짓말을 한다.
function 상태(cwd) {
  const g = (args) => { const r = 깃(cwd, args); return r.ok ? r.out : null; };
  const 미커밋 = g(['status', '--porcelain']);
  const ahead = g(['rev-list', '--count', '@{u}..HEAD']); // 업스트림이 없으면 null 이 맞다
  return {
    미커밋: 미커밋 === null ? null : 미커밋.split('\n').filter(Boolean),
    가지: g(['rev-parse', '--abbrev-ref', 'HEAD']),
    안민커밋: ahead === null ? null : Number(ahead),
    머리: g(['rev-parse', '--short', 'HEAD']),
  };
}

function 읽기() {
  return new Promise((resolve) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (s += d));
    process.stdin.on('end', () => resolve(s));
    setTimeout(() => resolve(s), 5000);
  });
}

const 뿌리 = () => process.env.CLAUDE_PROJECT_DIR || process.cwd();
const 장부경로 = () => path.join(뿌리(), '.claude', 장부이름);

// ───────────── --끝 : 죽는 자리에서 적는다 ─────────────
async function 끝() {
  let 입력 = {};
  try { 입력 = JSON.parse((await 읽기()) || '{}'); } catch { /* 입력 없이도 적는다 */ }
  const cwd = 입력.cwd || 뿌리();
  const s = 상태(cwd);

  const 줄 = {
    시각: new Date().toISOString(),
    세션: 입력.session_id || null,
    사유: 입력.reason || null,
    가지: s.가지,
    머리: s.머리,
    안민커밋: s.안민커밋,
    미커밋: s.미커밋 === null ? null : s.미커밋.slice(0, 40),
  };
  try {
    fs.appendFileSync(장부경로(), JSON.stringify(줄) + '\n', 'utf8');
  } catch { /* 못 적어도 세션 종료를 막지 않는다 */ }

  const 남긴것 = [];
  if (s.안민커밋) 남긴것.push(`안 민 커밋 ${s.안민커밋}`);
  if (s.미커밋 && s.미커밋.length) 남긴것.push(`미커밋 ${s.미커밋.length}`);
  if (남긴것.length) {
    /* 🔴 2026-09-01 실측 수리 — **최상위 `systemMessage` 여야 한다.**
     *   첫 판은 공식 문서대로 `hookSpecificOutput.hookEventName: "SessionEnd"` 를 냈는데
     *   하네스(2.1.252)가 **스키마에서 거부**했다:
     *     「expected one of "PreToolUse" | "UserPromptSubmit" | "UserPromptExpansion"
     *       | "SessionStart" | "Setup" | "PreModelSwitch" | …」 — 목록에 SessionEnd 가 없다.
     *   거부되면 출력 «전체»가 버려져 경고가 한 번도 안 나간다. 그리고 그 실패는 조용해서
     *   로그를 안 보면 「경고 0건 = 남긴 것 없음」으로 읽힌다 — 이 파일이 막으려던 바로 그 무늬다.
     *   옆 세션(synk-appsscript-9d)이 `claude mcp list` 를 돌리다 그 오류를 보고 알려줬다.
     *   ⇒ **문서보다 실측이 이긴다.** 장부 적기(위)는 이 형식과 무관하게 이미 끝나 있다. */
    console.log(JSON.stringify({
      systemMessage: `⚠ 이 세션이 남긴 것 — ${남긴것.join(' · ')} (다음 세션 첫머리에 다시 짖습니다)`,
    }));
  }
  process.exit(0);
}

// ───────────── --시작 : 유산을 짖는다 ─────────────
function 시작() {
  const cwd = 뿌리();
  const s = 상태(cwd);
  if (s.미커밋 === null) {
    console.log('🧾 앞 세션 유산을 못 쟀다(git 을 못 불렀다) — 이건 «없다»가 아니라 «확인 불가»다.');
    process.exit(0);
  }

  // 장부에서 「남긴 채 끝난」 마지막 세션 하나만 (참고용 — 판정은 지금 git 이 한다)
  let 앞선 = null;
  try {
    const 전문 = fs.readFileSync(장부경로(), 'utf8').trim().split('\n').filter(Boolean);
    for (let i = 전문.length - 1; i >= 0; i--) {
      const o = JSON.parse(전문[i]);
      if ((o.안민커밋 || 0) > 0 || (o.미커밋 || []).length > 0) { 앞선 = o; break; }
    }
  } catch { /* 장부가 아직 없다 — 첫 세션이면 정상 */ }

  const 말 = [];
  if (s.안민커밋) 말.push(`🔴 **안 민 커밋 ${s.안민커밋}개** — 이 작업은 지금 이 기계에만 있다. \`git push\` 로 내보낸다`);
  if (s.미커밋.length) {
    const 원장 = s.미커밋.filter((l) => /docs\/_ops\/(트랙|결정)\.md/.test(l));
    말.push(`🟡 미커밋 ${s.미커밋.length}건${원장.length ? ` (**공용 원장 ${원장.length}건 포함**)` : ''} — 임자를 가르고(지금 도는 세션 확인) 내 것만 커밋한다`);
  }
  if (!말.length) process.exit(0); // 0건이면 완전 침묵

  if (앞선) {
    const 나이 = Math.round((Date.now() - new Date(앞선.시각).getTime()) / 60000);
    말.push(`   ↳ 장부: 앞 세션이 ${나이}분 전 \`${앞선.사유 || '?'}\` 로 끝나며 같은 것을 남겼다(참고 — 판정은 위 실측이 한다)`);
  }
  console.log('🧾 **앞 세션이 남긴 것**\n' + 말.map((l) => '   ' + l).join('\n'));
  process.exit(0);
}

const 모드 = process.argv[2];
if (모드 === '--끝') 끝().catch(() => process.exit(0));
else if (모드 === '--시작') { try { 시작(); } catch { process.exit(0); } }
else { console.error('사용법: --끝 (SessionEnd) | --시작 (SessionStart)'); process.exit(1); }
