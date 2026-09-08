#!/usr/bin/env node
'use strict';
/* 코덱스 훅 다리 — 클로드에 걸린 훅을 **코덱스에서 그대로** 돌린다.
 *
 * ■ 왜 있나 (2026-09-09 · 유호 지시 「어느 날엔 클로드, 어느 날엔 GPT · 워크플로우는 고정」)
 *   같은 저장소를 두 하네스가 오가며 만지는데, 규율의 절반이 **글이 아니라 기계**였다.
 *   `.claude/settings.json` 에 훅 22벌이 걸려 있고 그중 넷이 실제로 «손을 막는다»
 *   (clasp 배포 · 커밋 범위 · 자격증명 화면 · 학생 접점 말투). 코덱스 쪽에는 그것이 0벌이라
 *   GPT 로 일하는 날에는 **같은 저장소가 다른 규율로 돌았다.**
 *   09-09 에 코덱스에도 훅이 있다는 것을 확인했고(이벤트 12 · `~/.codex/hooks.json` ·
 *   `<repo>/.codex/hooks.json`), 그래서 옮기는 대신 **잇는다.**
 *
 * ■ 왜 «베끼지» 않고 «읽나»
 *   훅 목록을 여기 베껴 적으면 그 순간 정본이 둘이 된다. 그리고 갈라지는 방향은 언제나
 *   «클로드 쪽만 늘고 코덱스 쪽은 낡는» 쪽이다 — 새 훅은 늘 클로드 settings.json 에 먼저 붙는다.
 *   그래서 이 다리는 **`.claude/settings.json` 을 그때그때 읽는다.** 훅이 늘어도 이 파일은 안 고친다.
 *   (같은 정신의 형제 = `tools/브리핑.js` — 그쪽은 SessionStart 12벌을 읽어 돌린다.)
 *
 * ■ 두 하네스가 다른 세 가지 — 이 파일이 그것만 옮긴다
 *   ① **도구 이름**  코덱스 `exec_command`·`apply_patch`·`mcp__cua_repl.js`
 *                  ↔ 클로드 `Bash`·`Edit`·`mcp__computer-use__computer`
 *                  (matcher 는 클로드 이름으로 쓰여 있으므로 대조 «전»에 옮긴다)
 *   ② **막는 형식**  클로드 {permissionDecision:'deny', permissionDecisionReason}
 *                  ↔ 코덱스 {decision:{behavior:'deny', message}}
 *   ③ **말 얹는 형식** 클로드 additionalContext ↔ 코덱스도 additionalContext (같다 · 그대로)
 *
 * ■ 못 돌면 어떻게 하나 — 갈래가 둘이다 (F044 규율)
 *   · PreToolUse·PermissionRequest = **막는 자리**다. 다리가 죽으면 «통과»가 아니라 **차단**한다.
 *     안 그러면 가드가 죽은 날 저장소가 조용히 무방비가 된다(그 사고가 F044 다).
 *   · 그 밖(UserPromptSubmit·Stop·SessionEnd) = **알리는 자리**다. 죽으면 알리고 통과한다.
 *
 * ■ 🔴 왜 파일 이름이 로마자인가 — 규약이 아니라 **물리다**
 *   이 저장소는 도구 이름을 한글로 쓴다. 그런데 이 파일만 로마자다: 코덱스가 훅 명령을 돌릴 때
 *   윈도우 셸을 한 겹 거치는데, **거기에 한글 경로를 담으면 못 읽는다**(memory
 *   windows-task-and-korean-path — 배치에 한글 경로를 담아 exit 9009 를 맞은 자리와 같은 병).
 *   09-09 첫 배선이 `hook: PreToolUse Failed` 로 죽었고, 그때 이름이 한글이었다.
 *   형제 규약도 이미 로마자다 — `codex-build.js` · `codex-review.js`.
 *   ⚠ 그래서 이 이름은 **바꾸지 않는다.** 바꾸면 가드가 조용히 죽고, 죽은 얼굴이 「통과」와 같다.
 *
 * 사용 (코덱스가 부른다 · 배선 = `.codex/hooks.json` · 경로는 «절대»여야 한다):
 *   node tools/codex-hook-bridge.js <이벤트이름>   # stdin = 코덱스 훅 JSON
 *   node tools/codex-hook-bridge.js --자가시험      # 배선이 서 있는지 사람이 재는 자리
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

/* ■ 발자국 — 「막혔다」와 「아예 안 불렸다」를 가르는 수 (memory two-causes-need-a-separating-count)
 *   코덱스 화면은 훅이 죽어도 「Failed」 한 줄만 낸다. 그 한 줄로는 ⓐ다리가 안 불렸다
 *   ⓑ불렸는데 죽었다 ⓒ살아서 막았다가 구별되지 않는다. 그래서 다리가 스스로 적는다.
 *   자리 = 임시 폴더의 `synk-hook-bridge.log`(저장소를 더럽히지 않는다) · 끄기 = SYNK_HOOK_BRIDGE_LOG=0 */
const 발자국자리 = path.join(os.tmpdir(), 'synk-hook-bridge.log');
function 발자국(글) {
  if (process.env.SYNK_HOOK_BRIDGE_LOG === '0') return;
  try { fs.appendFileSync(발자국자리, `${new Date().toISOString()} ${글}\n`); } catch { /* 적기 실패가 가드를 죽이지는 않는다 */ }
}
발자국(`들어옴 argv=${JSON.stringify(process.argv.slice(2))} cwd=${process.cwd()}`);
process.on('uncaughtException', (e) => {
  발자국(`터짐 ${e && e.stack ? e.stack.split('\n')[0] : e}`);
  // 막는 자리에서 터지면 통과가 아니라 차단이다. 이벤트를 아직 모를 수 있으니 PreToolUse 로 낸다.
  try {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `코덱스 훅 다리가 터졌다 — ${e && e.message}` } }));
  } catch { /* 그래도 종료코드가 남는다 */ }
  process.exit(2);
});

const 뿌리 = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..');
const 설정경로 = path.join(뿌리, '.claude', 'settings.json');

/* 막는 자리인가 — 여기 없는 이벤트는 「알림」이라 실패해도 통과시킨다. */
const 막는이벤트 = new Set(['PreToolUse', 'PermissionRequest']);

/* ① 도구 이름 옮김 — 코덱스가 부르는 이름 → 클로드 matcher 가 아는 이름.
 *   ⚠ 넓게 잡는다. 「명령을 돌리는 것」은 무엇이든 Bash 로 본다 — 좁게 잡아 하나를 놓치면
 *     그게 곧 clasp 가드를 지나가는 구멍이다. 반대로 넓어서 생기는 손해는 «가드가 한 번 더 도는 것»뿐이다. */
const 도구이름옮김 = [
  [/^(Bash|shell|exec_command|write_stdin|functions\.exec|local_shell)$/i, 'Bash'],
  [/^(apply_patch|Edit|Write|MultiEdit|str_replace_editor)$/i, 'Edit'],
  [/^mcp__cua_repl/i, 'mcp__computer-use__computer'],
];

function 클로드이름(코덱스이름) {
  const t = String(코덱스이름 || '');
  for (const [re, 클] of 도구이름옮김) if (re.test(t)) return 클;
  return t; // 모르는 것은 그대로 — matcher 가 알아서 거른다
}

/* 코덱스 형식으로 «막는» 답을 낸다.
 *
 * 🔴 **형식이 이벤트마다 다르다** — 09-09 에 여기서 한 번 데였다.
 *   `PreToolUse`      → {permissionDecision:'deny', permissionDecisionReason}   (클로드와 «같은» 모양)
 *   `PermissionRequest` → {decision:{behavior:'deny', message}}                   (이 이벤트 «전용»)
 *   둘을 섞으면 코덱스가 그 출력을 못 알아보고 **훅을 「실패」로 적은 뒤 도구를 그대로 실행한다.**
 *   첫 배선이 정확히 그랬다: 로그에 `hook: PreToolUse Failed` 가 뜨고 `git add -A` 가 지나갔다
 *   (그날은 읽기 전용 샌드박스가 대신 막아서 아무 일도 안 났을 뿐이다).
 *
 * 🔑 그래서 **세 겹으로 막는다** — 문서가 인정하는 길이 셋이고, 하나가 안 먹어도 나머지가 선다:
 *   ⓐ 이벤트에 맞는 JSON  ⓑ 사유를 stderr 에  ⓒ 종료코드 2.
 *   가드는 「막았다고 믿었는데 안 막힌 것」이 가장 비싸다(F044). */
function 막는다(이벤트, 까닭) {
  const 몸 = 이벤트 === 'PermissionRequest'
    ? { hookEventName: 이벤트, decision: { behavior: 'deny', message: 까닭 } }
    : { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 까닭 };
  /* 🔴 **종료코드와 JSON 을 «같이» 내지 않는다** — 문서가 인정하는 길은 셋인데 «겹쳐 쓰는» 길은 없다.
   *   겹쳐 냈더니 코덱스가 훅을 실패로 적고 도구를 그대로 실행했다(09-09 실측 · 발자국은 남는데 차단이 안 됐다).
   *   기본은 방법 A(맞는 JSON + 종료 0). 방법 C(종료 2 + stderr)로 넘기려면 SYNK_HOOK_DENY=exit2. */
  if (process.env.SYNK_HOOK_DENY === 'exit2') {
    process.stderr.write(까닭 + '\n');
    발자국(`막음(exit2) ${이벤트}`);
    process.exit(2);
  }
  const 낸글 = JSON.stringify({ hookSpecificOutput: 몸 });
  process.stdout.write(낸글);
  발자국(`막음(json) ${이벤트} ${낸글.slice(0, 160)}`);
  process.exit(0);
}

/* 통과 — 얹을 말이 있으면 같이 낸다. */
function 통과(이벤트, 얹을말) {
  if (얹을말 && 얹을말.trim()) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 이벤트, additionalContext: 얹을말.trim() },
    }));
  }
  process.exit(0);
}

/* bash 를 찾는다 — 훅 명령이 전부 bash 문법(`case … in`·`${VAR:-$PWD}`)이라 cmd 로는 못 돈다. */
function bash찾기() {
  const 후보 = [
    process.env.SYNK_BASH,
    'C:/Program Files/Git/bin/bash.exe',
    'C:/Program Files/Git/usr/bin/bash.exe',
    '/usr/bin/bash',
    '/bin/bash',
  ].filter(Boolean);
  for (const b of 후보) { try { if (fs.existsSync(b)) return b; } catch { /* 계속 본다 */ } }
  return null;
}

// ══════════════════════════════════════════════════════════ 배선 설치

/* 🔴 **왜 저장소 안(.codex/hooks.json)이 아니라 «관리형» 자리인가** (09-09 실측이 정했다)
 *   코덱스는 훅을 그냥 안 돌린다 — **사람이 `/hooks` 로 신뢰를 준 것만** 돈다. 09-09 에 실측했다:
 *   신뢰 없이 돌리면 로그에 `hook:` 줄이 **한 줄도 안 뜨고** `git add -A` 가 그대로 지나갔다.
 *   그런데 유호님은 손으로 켜는 설정을 안 쓰신다(memory no-manual-setup-steps). 그래서
 *   **`%ProgramData%\OpenAI\Codex\requirements.toml`** 에 적는다 — 그 자리의 훅은 문서 문면 그대로
 *   「trusted by policy」라 사람 손이 0 이다.
 *   ⚠ `allow_managed_hooks_only` 는 **안 쓴다.** 켜면 프로젝트·플러그인 훅이 통째로 죽는다.
 *   ⚠ 그래서 `.codex/hooks.json` 은 **두지 않는다** — 두 자리에 같은 배선을 두면 훅이 두 번 돈다.
 *   ⚠ 이 파일은 git 밖에 산다. 정본 사본이 저장소에 남고(`docs/_ops/`), 이 도구가 그것을 심는다. */
const 관리자리 = process.env.SYNK_CODEX_REQUIREMENTS
  || path.join(process.env.ProgramData || process.env.PROGRAMDATA || 'C:/ProgramData', 'OpenAI', 'Codex', 'requirements.toml');
const 이벤트들 = ['PreToolUse', 'PermissionRequest', 'UserPromptSubmit', 'Stop'];
const 다리경로 = path.join(뿌리, 'tools', 'codex-hook-bridge.js').replace(/\\/g, '/');

function toml만들기() {
  const 줄 = [
    '# SYNK — 클로드에 걸린 훅을 코덱스에서도 그대로 돌린다.',
    '# 🔴 손으로 고치지 않는다. 정본 = tools/codex-hook-bridge.js --설치 가 만든다.',
    '# 훅 «목록»은 여기 없다 — .claude/settings.json 하나가 쥐고, 다리가 그때그때 읽는다.',
    '# 그래서 클로드 쪽에 훅이 늘어도 이 파일은 안 고친다.',
    '#',
    '# 여기 사는 까닭 = 이 자리의 훅만 «정책으로 신뢰»되어 사람 손이 0 이다.',
    '# SessionStart 는 tools/브리핑.js 가 따로 맡는다(두 번 돌면 알림이 겹친다).',
    '# SessionEnd 는 코덱스 상한이 3초라 클로드 훅이 못 끝낸다 — 그 자리는 Stop 이 받는다.',
    '',
    '[features]',
    'hooks = true',
    '',
  ];
  for (const ev of 이벤트들) {
    줄.push(`[[hooks.${ev}]]`);
    줄.push(`[[hooks.${ev}.hooks]]`);
    줄.push('type = "command"');
    줄.push(`command = "node ${다리경로} ${ev}"`);
    줄.push(`command_windows = "node ${다리경로} ${ev}"`);
    줄.push(`timeout = ${ev === 'Stop' ? 60 : ev === 'UserPromptSubmit' ? 120 : 180}`);
    줄.push(`statusMessage = "SYNK 가드 · ${ev}"`);
    줄.push('');
  }
  return 줄.join('\n');
}

if (process.argv.includes('--설치')) {
  const 새글 = toml만들기();
  const 덮기 = process.argv.includes('--덮어');
  try {
    if (fs.existsSync(관리자리)) {
      const 옛글 = fs.readFileSync(관리자리, 'utf8');
      if (옛글 === 새글) { console.log(`✅ 이미 같다 — ${관리자리}`); process.exit(0); }
      if (!/SYNK/.test(옛글) && !덮기) {
        console.error(`🔴 이 자리에 «남의 글»이 있다 — 덮지 않았다: ${관리자리}`);
        console.error('   내용을 보고 정말 덮을 것이면 --덮어 를 붙인다.');
        process.exit(1);
      }
      fs.writeFileSync(관리자리 + '.bak', 옛글); // 되돌릴 자리를 먼저 만든다
    }
    fs.mkdirSync(path.dirname(관리자리), { recursive: true });
    fs.writeFileSync(관리자리, 새글);
    console.log(`✅ 심었다 — ${관리자리}`);
    console.log(`   다리 = ${다리경로}`);
    console.log(`   이벤트 ${이벤트들.length}갈래: ${이벤트들.join(' · ')}`);
    console.log('   🔑 이 자리의 훅은 정책으로 신뢰되므로 /hooks 를 손으로 누를 일이 없다.');
    process.exit(0);
  } catch (e) {
    console.error(`🔴 못 심었다 — ${e.message}`);
    console.error('   권한이 막으면 SYNK_CODEX_REQUIREMENTS 로 다른 자리를 준다.');
    process.exit(1);
  }
}

// ══════════════════════════════════════════════════════════ 자가시험

if (process.argv.includes('--자가시험')) {
  const 줄 = [];
  let 빨강 = 0;
  const 재기 = (이름, 참, 값) => { 줄.push(`  ${참 ? '✅' : '🔴'} ${이름}${값 ? ' — ' + 값 : ''}`); if (!참) 빨강++; };

  재기('클로드 설정 파일', fs.existsSync(설정경로), 설정경로);
  const b = bash찾기();
  재기('bash', !!b, b || '못 찾았다 — SYNK_BASH 로 알려 준다');
  let 훅수 = 0, 이벤트수 = 0;
  try {
    const s = JSON.parse(fs.readFileSync(설정경로, 'utf8'));
    for (const [ev, 그룹들] of Object.entries(s.hooks || {})) {
      이벤트수++;
      for (const g of 그룹들 || []) 훅수 += (g.hooks || []).length;
    }
  } catch (e) { 재기('설정 읽기', false, e.message); }
  재기('훅을 읽었다', 훅수 > 0, `이벤트 ${이벤트수}갈래 · 훅 ${훅수}벌`);

  /* 🔴 배선은 «내용»까지 잰다 — 있기만 하고 낡으면 그게 가장 비싼 초록이다
   *   (경로가 어제 것을 가리키면 훅은 조용히 0벌이 되고, 그 얼굴이 「통과」와 같다). */
  let 심긴글 = null;
  try { 심긴글 = fs.readFileSync(관리자리, 'utf8'); } catch { /* 없다 */ }
  재기('코덱스 배선(관리 자리)', !!심긴글, 관리자리);
  if (심긴글) {
    재기('배선이 지금 다리를 가리킨다', 심긴글.includes(다리경로), 다리경로);
    const 빠진 = 이벤트들.filter((ev) => !심긴글.includes(`[[hooks.${ev}]]`));
    재기('이벤트 넷이 다 있다', 빠진.length === 0, 빠진.length ? `빠진 것: ${빠진.join(' · ')}` : 이벤트들.join(' · '));
    재기('훅 기능이 켜져 있다', /\[features\][\s\S]*hooks\s*=\s*true/.test(심긴글));
  } else {
    줄.push('     → 심는 법: node tools/codex-hook-bridge.js --설치');
  }
  const 겹침 = path.join(뿌리, '.codex', 'hooks.json');
  if (fs.existsSync(겹침)) 재기('겹치는 배선이 없다', false, `${겹침} 가 남아 있다 — 훅이 두 번 돈다`);

  console.log('🌉 코덱스 훅 다리 — 자가시험');
  console.log(줄.join('\n'));
  console.log(빨강 ? `\n🔴 ${빨강}줄이 빨갛다 — 코덱스에서 이 훅들은 안 돈다.` : '\n✅ 배선이 서 있다.');
  process.exit(빨강 ? 1 : 0);
}

// ══════════════════════════════════════════════════════════ 본체

const 이벤트 = process.argv[2] || '';
if (!이벤트) {
  // 이벤트를 모르면 무엇을 지켜야 하는지도 모른다 — 안전한 쪽은 막는 것이다.
  막는다('PreToolUse', '코덱스 훅 다리: 이벤트 이름 없이 불렸다. 배선(.codex/hooks.json)을 확인한다.');
}

let 입력 = '';
try {
  입력 = fs.readFileSync(0, 'utf8');
} catch {
  입력 = '';
}

let 코덱스 = {};
try { 코덱스 = JSON.parse(입력 || '{}'); } catch { 코덱스 = {}; }

let 설정;
try {
  설정 = JSON.parse(fs.readFileSync(설정경로, 'utf8'));
} catch (e) {
  const 말 = `코덱스 훅 다리: 클로드 설정(${설정경로})을 못 읽었다 — ${e.message}`;
  if (막는이벤트.has(이벤트)) 막는다(이벤트, 말 + ' · 통과가 아니라 차단한다(F044).');
  process.stderr.write(말 + '\n');
  process.exit(0);
}

const bash = bash찾기();
if (!bash) {
  const 말 = '코덱스 훅 다리: bash 를 못 찾았다. 훅 명령이 bash 문법이라 돌릴 수 없다.';
  if (막는이벤트.has(이벤트)) 막는다(이벤트, 말 + ' · 통과가 아니라 차단한다(F044).');
  process.stderr.write(말 + '\n');
  process.exit(0);
}

/* 클로드 쪽 이벤트 이름 — 지금은 같은 것만 쓴다.
 * (PermissionRequest 는 클로드에 없으므로 PreToolUse 훅을 빌려 쓴다 — 같은 것을 지키는 자리다.) */
const 클로드이벤트 = 이벤트 === 'PermissionRequest' ? 'PreToolUse' : 이벤트;
const 그룹들 = (설정.hooks || {})[클로드이벤트] || [];

/* stdin 을 클로드 형식으로 옮긴다. 공통 칸은 이름이 같아서 그대로 두고, 도구 이름만 갈아 끼운다. */
const 옮긴도구 = 클로드이름(코덱스.tool_name);
const 클로드입력 = Object.assign({}, 코덱스, {
  hook_event_name: 클로드이벤트,
  cwd: 코덱스.cwd || 뿌리,
});
if (코덱스.tool_name) {
  클로드입력.tool_name = 옮긴도구;
  클로드입력.코덱스_원래도구 = 코덱스.tool_name; // 잃지 않는다 — 판정이 원본을 봐야 할 때가 있다
}
const 넘길입력 = JSON.stringify(클로드입력);

const 얹을말 = [];
for (const 그룹 of 그룹들) {
  const m = 그룹.matcher;
  if (m && m !== '*' && m !== '') {
    let 맞나 = false;
    try { 맞나 = new RegExp(`^(?:${m})$`).test(옮긴도구) || new RegExp(m).test(옮긴도구); }
    catch { 맞나 = true; } // 정규식이 깨졌으면 «거르지 않는다» — 놓치는 것보다 한 번 더 도는 게 싸다
    if (!맞나) continue;
  }
  for (const h of 그룹.hooks || []) {
    if (h.type !== 'command' || !h.command) continue;
    const 초 = Number(h.timeout) > 0 ? Number(h.timeout) : 60;
    const r = spawnSync(bash, ['-c', h.command], {
      input: 넘길입력,
      encoding: 'utf8',
      timeout: 초 * 1000,
      cwd: 뿌리,
      env: Object.assign({}, process.env, {
        CLAUDE_PROJECT_DIR: 뿌리,
        SYNK_HOOK_VIA_CODEX: '1', // 훅이 「어디서 불렸나」를 알아야 할 때가 온다
      }),
    });

    /* 훅 자신이 못 돌았다 — 막는 자리면 그것이 곧 차단 사유다. */
    if (r.error) {
      const 말 = `코덱스 훅 다리: 훅을 못 돌렸다(${h.statusMessage || '이름 없음'}) — ${r.error.message}`;
      if (막는이벤트.has(이벤트)) 막는다(이벤트, 말 + ' · 통과가 아니라 차단한다(F044).');
      process.stderr.write(말 + '\n');
      continue;
    }

    const 나온글 = String(r.stdout || '');
    let 답 = null;
    try { 답 = JSON.parse(나온글); } catch { 답 = null; }

    /* ② 막는 형식 옮기기 — 클로드 permissionDecision → 코덱스 decision.behavior */
    const hso = 답 && 답.hookSpecificOutput;
    if (hso) {
      const 판정 = hso.permissionDecision || (hso.decision && hso.decision.behavior);
      if (판정 === 'deny') {
        막는다(이벤트, hso.permissionDecisionReason || (hso.decision && hso.decision.message) || '클로드 가드가 막았다.');
      }
      if (hso.additionalContext) 얹을말.push(String(hso.additionalContext));
    }

    /* 클로드 규약: 종료코드 2 = 차단(사유는 stderr). */
    if (r.status === 2) {
      const 까닭 = String(r.stderr || '').trim() || (나온글.trim() || '클로드 가드가 막았다(종료 2).');
      if (막는이벤트.has(이벤트)) 막는다(이벤트, 까닭);
      얹을말.push(까닭);
      continue;
    }

    /* 막는 자리가 아닌 곳에서는 stdout 을 그대로 말로 얹는다(SessionStart 알림들이 이 갈래다). */
    if (!hso && 나온글.trim() && !막는이벤트.has(이벤트)) 얹을말.push(나온글.trim());
    if (r.stderr && String(r.stderr).trim() && !막는이벤트.has(이벤트)) 얹을말.push(String(r.stderr).trim());
  }
}

통과(이벤트, 얹을말.join('\n'));
