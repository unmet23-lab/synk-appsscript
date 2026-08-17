#!/usr/bin/env node
'use strict';
/* hook-registration-snapshot — 「이 세션이 뜬 판과 지금 등록이 다르다」를 그 자리에서 말한다 (F584)
 *
 * 무엇이 문제였나:
 *   `.claude/settings.json` 의 훅 **등록**을 바꾼 세션은, 그 바뀐 항목의 발동을 자기 세션에서
 *   신뢰할 수 없다. 실측 2026-08-17(`local_67f76e1d` · F519 트랙): 등록 블록을 옮긴 뒤 저장소
 *   안팎 양쪽에 위반 입력을 넣어 봤는데 둘 다 통과했다. 같은 Write 에서 `repo-staleness` 는
 *   정상 발동했고, 훅 파일 로직도 멀쩡했다 — 같은 페이로드를 그 훅에 직접 물리니 deny 를 냈다.
 *   즉 훅 통로도 파일도 살아 있는데 **그 세션이 만진 등록 항목만** 안 돌았다.
 *
 * 왜 알림이 필요한가 (급소는 미발동이 아니다):
 *   미실행은 화면에서 **「통과」와 똑같이 생겼다**(F207). 그래서 가드를 지은 세션이 그것을
 *   「라이브에서 확인했다」로 오독한다. 이 저장소는 가드 트랙마다 라이브 실증을 요구하는데
 *   (F200·F253 이 그 자리에서 죽은 가드를 잡았다), 등록을 만진 트랙에선 그 요구가 **구조적으로
 *   충족 불가**다 — 그 사실을 아무도 그 자리에서 말해주지 않는 것이 F584 다.
 *
 * ⚠ 메커니즘은 단정하지 않는다 — 하네스 내부는 grep 대상이 아니다(F184 계열). 근거가 닿는
 *   자리는 사실 하나뿐이다: **내 세션이 뜬 판과 지금 파일이 다르다.** 그래서 문구도 「안 돈다」가
 *   아니라 「이 세션의 발동 여부를 못 믿는다」까지만 간다. 틀린 단정은 다음 세션의 판정을 오염시킨다.
 *
 * 막지 않는다(PostToolUse). 등록을 바꾸는 것은 정상 작업이고, 막을 것은 오독뿐이다.
 *
 * ── 대가 (CLAUDE.md 「새 장치엔 대가를 함께 적는다」) ─────────────────────────────
 *   ① 맞는 얼굴로 틀린 값을 내는 자리: 셸로 settings.json 을 고치면(리다이렉트·sed -i·
 *      Set-Content) 이 훅은 Edit·Write 를 안 거치므로 **원리상 못 본다** — 침묵이 곧 「안 바뀜」이
 *      아니다. memory-index-guard 가 같은 대가를 지고 셸 통로를 따로 막았는데, 여기선 안 막는다:
 *      등록 편집은 정상 작업이라 통로를 좁힐 근거가 없고, 좁히면 따를 수 없는 처방이 된다(F103).
 *   ② 도장이 없으면(SessionStart 가 못 찍었거나 워크트리처럼 경로가 갈리면) 「모른다」를 낸다 —
 *      그것도 결과다. 미측정을 통과로 번역하지 않는 쪽이 이 훅의 존재 이유다.
 *   ③ 블록 순서만 바꾼 편집은 침묵한다(지문에 블록 인덱스를 안 넣는다). 등록 내용이 같으면
 *      하네스에도 같은 등록이라 경보는 소음이고, 소음은 진짜 경보를 죽인다.
 *   ④ 닫을 것: **없다.** 이 훅이 대신할 낡은 장치가 없다 — F584 는 지금 어느 층도 안 보는
 *      빈칸이라 새 신호다(경량 4차 과녁의 「장치 개수」에는 +1 로 계상된다).
 *
 * 🔴 이 장치는 **자기 자신의 라이브 실증을 원리상 못 낸다** — 등록되는 순간 그 세션에선 정확히
 *   같은 이유로 발동을 못 믿는다. 그래서 탐지력은 `tests/훅등록스냅샷.test.js` 픽스처가 지고,
 *   라이브 실증은 보드 줄의 「▶다음 세션 첫 확인」이 진다. 그 통로 자체가 이 트랙의 산출물이다.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.SYNK_HOOKREG_DIR || path.join(os.tmpdir(), 'synk-hook-registration');

/** 이 훅이 지키는 파일 이름들 — 하네스가 훅 등록을 읽는 자리. */
const 대상이름 = new Set(['settings.json', 'settings.local.json']);

/** 경로 정규화 — 도장 키가 갈리면 「도장 없음」이 되고, 그건 조용한 미측정이다.
 *  Windows 는 대소문자를 안 가리므로 낮춰서 맞춘다(이 저장소의 실제 실행 환경 · F296 계열). */
function 키경로(p) {
  const abs = path.resolve(String(p || '')).replace(/\\/g, '/');
  return process.platform === 'win32' ? abs.toLowerCase() : abs;
}

const 도장파일 = (sid, file) =>
  path.join(DIR, `${String(sid).replace(/[^\w.-]/g, '_')}-${crypto.createHash('sha1').update(키경로(file)).digest('hex').slice(0, 8)}`);

/**
 * 등록 **항목**의 집합 — (이벤트, matcher, command) 셋을 키로.
 *
 * ⚠ 블록 인덱스는 키에 안 넣는다(대가 ③). 그리고 command 는 통째로 넣는다 — 훅 파일 이름만
 *   뽑으면 `case` 필터·타임아웃·shell 이 바뀐 것을 놓치는데, 필터가 훅보다 좁아지는 것이
 *   바로 이 저장소가 세 번 겪은 등록층 사고다(F044·F053·F063).
 *
 * 🔑 키는 `JSON.stringify` 로 만든다 — 구분자를 직접 고르면 그 문자가 matcher·command 안에
 *   들어가는 날 두 항목이 같은 키로 뭉친다. 첫 판은 NUL 문자를 구분자로 썼는데, 그게
 *   **소스 파일에 진짜 제어문자로 박혀** ripgrep 이 이 파일을 바이너리로 취급했다(=Grep 에서
 *   사라진다). 동작도 테스트도 초록이라 안 보였고, 변이의 「미적용」이 우연히 드러냈다.
 *
 * @returns {Map<string,{이벤트:string,matcher:string,command:string}>|null} 못 읽으면 null(=모름)
 */
function 등록집합(본문) {
  let j;
  try { j = JSON.parse(본문); } catch (_) { return null; }
  const 훅들 = j && typeof j === 'object' ? j.hooks : null;
  const out = new Map();
  if (!훅들 || typeof 훅들 !== 'object') return out; // hooks 가 아예 없는 것은 「빈 등록」이지 모름이 아니다
  for (const [이벤트, 블록들] of Object.entries(훅들)) {
    if (!Array.isArray(블록들)) continue;
    for (const 블록 of 블록들) {
      const matcher = String((블록 && 블록.matcher) != null ? 블록.matcher : '');
      const 목록 = 블록 && Array.isArray(블록.hooks) ? 블록.hooks : [];
      for (const h of 목록) {
        const command = String((h && h.command) != null ? h.command : '');
        out.set(JSON.stringify([이벤트, matcher, command]), { 이벤트, matcher, command });
      }
    }
  }
  return out;
}

function 집합읽기(파일) {
  try { return 등록집합(fs.readFileSync(파일, 'utf8')); } catch (_) { return null; }
}

/** 사람이 읽을 한 줄 — 명령 전문은 길어서 훅 파일 이름으로 줄이되, 못 뽑으면 앞머리를 그대로 보인다. */
function 항목표시(v) {
  const m = /hooks\/([\w-]+)\.js/.exec(v.command);
  const 무엇 = m ? `${m[1]}.js` : (v.command.slice(0, 60) + (v.command.length > 60 ? '…' : ''));
  return `${v.이벤트} \`${v.matcher || '(매처없음)'}\` → ${무엇}`;
}

function 알림(본문) {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 본문 },
  }));
  process.exit(0);
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const sid = String(process.env.CLAUDE_CODE_HOST_SESSION_ID || input.session_id || '').trim();
if (!sid) process.exit(0); // 세션을 못 가르면 도장도 판정도 의미가 없다

const 이벤트 = String(input.hook_event_name || '');

/* ── SessionStart = 도장. 이 세션이 「무엇을 뜬 판으로 아는가」의 유일한 증거 ──────────────
 * 하네스가 실제로 뜬 스냅샷을 읽을 길은 없다. 대신 **세션이 시작될 때 디스크에 있던 등록**을
 * 남긴다 — 그것이 하네스가 그때 읽은 것과 같다는 가정 하나 위에 선다(그 가정이 깨지는 자리는
 * 세션 시작 직전에 남이 바꾼 경우인데, 그때도 결론은 같다: 내가 아는 판과 지금이 다르다). */
if (이벤트 === 'SessionStart' || (!이벤트 && !input.tool_name)) {
  const 뿌리 = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  for (const 이름 of 대상이름) {
    const 파일 = path.join(뿌리, '.claude', 이름);
    const 집합 = 집합읽기(파일);
    if (집합 === null) continue; // 없는 파일·깨진 JSON — 도장을 안 남긴다(그러면 아래에서 「모름」이 뜬다)
    try {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(도장파일(sid, 파일), JSON.stringify([...집합.keys()]), 'utf8');
    } catch (_) { /* 못 찍으면 판정이 「모름」이 된다 — 모름은 아래에서 드러난다 */ }
  }
  process.exit(0);
}

/* ── PostToolUse = 판정 ───────────────────────────────────────────────────────── */
if (!/^(Edit|Write|MultiEdit)$/.test(String(input.tool_name || ''))) process.exit(0);

const ti = input.tool_input || {};
const 파일 = String(ti.file_path || '');
if (!대상이름.has(path.basename(파일.replace(/\\/g, '/')))) process.exit(0);

const 지금 = 집합읽기(파일);
if (지금 === null) {
  알림(
    '[hook-registration-snapshot] 편집 뒤의 `' + path.basename(파일) + '` 을 **JSON 으로 못 읽었다**.\n'
    + '→ 등록층이 깨지면 훅 전체가 조용히 안 돈다 — 그리고 안 도는 방향은 언제나 「통과」다(F053·F207).\n'
    + '→ 지금 바로 문법을 확인한다: `node -e "JSON.parse(require(\'fs\').readFileSync(process.argv[1],\'utf8\'))" ' + 파일 + '`',
  );
}

let 기준 = null;
try { 기준 = new Set(JSON.parse(fs.readFileSync(도장파일(sid, 파일), 'utf8'))); } catch (_) { /* 도장 없음 */ }

if (!기준) {
  알림(
    '[hook-registration-snapshot] 이 세션은 `' + path.basename(파일) + '` 의 **세션 시작 판을 모른다** — 대조를 안 돌렸다(통과가 아니라 미측정이다 · F584).\n'
    + '→ 그러니 방금 바꾼 등록이 이 세션에서 도는지 **알 수 없다**. 라이브로 재서 「통과」가 나와도 그건 판정이 아니다(F207).\n'
    + '→ 흔한 원인은 경로가 갈린 것이다(워크트리의 `.claude/settings.json` 은 세션 시작 때 도장 찍힌 파일과 다른 파일이다).\n'
    + '   ⚠ 그 경우 하네스가 읽는 등록은 애초에 이 파일이 아니다 — 여기 바꾼 것은 **머지된 다음 세션부터** 산다.\n'
    + '→ 종결 조건에서 라이브 실증을 빼고 보드 상태 칸에 남긴다: `▶다음 세션 첫 확인 = <무엇을 어떻게 재면 발동을 확증하나>`',
  );
}

const 새로 = [...지금.entries()].filter(([k]) => !기준.has(k)).map(([, v]) => v);
const 사라짐 = [...기준].filter((k) => !지금.has(k)).map((k) => {
  let 셋 = [];
  try { 셋 = JSON.parse(k); } catch (_) { 셋 = []; }
  return { 이벤트: 셋[0] || '?', matcher: 셋[1] || '', command: 셋[2] || '' };
});

if (!새로.length && !사라짐.length) process.exit(0); // hooks 밖(permissions·env)만 고쳤거나 순서만 바꿨다 — 조용히 통과

const 줄 = [];
if (새로.length) {
  줄.push('  ＋ 새로 생긴 등록 ' + 새로.length + '건 — **이 세션엔 없던 것**이다:');
  for (const v of 새로.slice(0, 6)) 줄.push('     · ' + 항목표시(v));
  if (새로.length > 6) 줄.push(`     · … 그 밖 ${새로.length - 6}건`);
}
if (사라짐.length) {
  줄.push('  － 사라진 등록 ' + 사라짐.length + '건 — **이 세션이 뜰 때는 있던 것**이다:');
  for (const v of 사라짐.slice(0, 6)) 줄.push('     · ' + 항목표시(v));
  if (사라짐.length > 6) 줄.push(`     · … 그 밖 ${사라짐.length - 6}건`);
}

알림(
  '[hook-registration-snapshot] 이 세션이 뜬 판과 **지금 `' + path.basename(파일) + '`** 이 다르다 — 등록 '
  + (새로.length + 사라짐.length) + '건이 갈렸다.\n'
  + 줄.join('\n') + '\n\n'
  + '왜 알리나 (F584): 등록을 바꾼 세션은 **그 항목의 발동을 자기 세션에서 못 믿는다.** 실측\n'
  + '  2026-08-17(`local_67f76e1d`)에선 옮긴 등록이 그 세션 내내 안 돌았다 — 훅 파일 로직은 멀쩡했고\n'
  + '  (같은 페이로드를 직접 물리면 deny), 안 바뀐 항목만 계속 돌았다. 하네스 내부라 메커니즘은\n'
  + '  확증 못 했다 — 그래서 이 알림도 「안 돈다」가 아니라 「못 믿는다」까지만 말한다.\n\n'
  + '→ 지금 이 항목들을 라이브로 재지 마라. **「통과」가 나와도 그건 판정이 아니라 미측정이다**(F207).\n'
  + '→ 탐지력은 픽스처 회귀로 못박는다(실저장소 라이브는 이 세션에서 원리상 못 낸다 · F200 의 요구를\n'
  + '   이 트랙에선 이렇게 갈음한다).\n'
  + '→ 그리고 보드 상태 칸에 넘길 것을 적는다 — 그게 이 층의 처방이다:\n'
  + '   `▶다음 세션 첫 확인 = <무엇을 · 어떻게 재면 발동이 확증되나>`\n'
  + '   다음 세션은 등록을 안 바꿨으므로 그 훅이 살아 있다. **거기서만 잴 수 있다.**',
);
