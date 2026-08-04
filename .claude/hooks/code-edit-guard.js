#!/usr/bin/env node
// code-edit-guard — 코드 파일을 **셸로** 고치는 통로를 막는다 (PreToolUse 훅)
//
// 왜 있나 — 같은 사고가 **네 번** 났고, 넷 다 결말이 같다: 원복이 실패해 **파일이 변이 상태로 남았다**.
//   F050  파이썬 heredoc 으로 테스트 파일을 편집 → 이스케이프가 꼬여 두 번 깨뜨렸다
//   F065  python subprocess 로 코드 파일을 변이 → 자식 stdout 을 CP949 로 디코드하다 예외,
//         **원복 라인이 실행되지 않았다**
//   F067  `sed -i` 로 SYNK-talk `tools/eval-score.js` 변이 → 백업 `cp` 가 /tmp 로 가서 원복 실패
//   그리고 직전 세션이 네 번째를 밟았다. CLAUDE.md 「3번째 = 원인을 쓸 수 없게 만든다 —
//   호출부마다 고치는 대신 **잘못 쓸 수 없는 공용 통로**를 만들고 옛 통로를 테스트로 금지」의 적용.
//
// 🔑 셋의 공통 구조는 「빨리 하려고」가 아니라 **원복이 별도 단계라는 것**이다.
//   셸 변이는 (백업 → 변이 → 검사 → 원복) 4단계고, 중간에 죽으면 3단계에서 멈춘다.
//   `Edit` 도구는 변이도 원복도 **같은 한 수**라 중간 상태가 존재하지 않는다.
//   그래서 이 훅이 권하는 것은 "조심하라"가 아니라 **단계를 없애는 도구**다.
//
// ⚠ 임시 변이 테스트도 예외가 아니다 — F067 이 정확히 그 변명으로 났다(「변이 테스트를 빨리 돌리려고」).
//
// 무엇을 막나 (셋 다 실사고의 형태 그대로):
//   ① in-place 편집기      sed -i · perl -pi · ruby -i            (F067)
//   ② 코드 파일에 써넣기    > · >> · tee · cp/mv 덮어쓰기 · PowerShell 쓰기 cmdlet
//   ③ 인라인 스크립트의 쓰기 node -e/python -c/힙독 안의 writeFileSync·open(...,'w')  (F050·F065)
//
// 무엇을 안 막나 (거짓양성은 BYPASS 를 습관으로 가르친다 · v6.11):
//   · 스트림 편집(`sed 's/a/b/' f`), 읽기(`cat`·`grep`·`node --check`)
//   · **repo 도구 실행**(`node tools/로고주입.js`) — 정본 하나가 여러 파일을 갱신하는 건
//     이 훅이 권하는 **반대편 정답**이다(변환이 반복되면 스크립트가 아니라 도구로 굳힌다)
//   · 임시 경로(스크래치패드·/tmp·AppData\Local\Temp·/dev/null) 쓰기
//   · **cp·mv 로 「없는 이름」에 만들기** — rename(`mv X X_구판.html`)과 새 사본 뜨기.
//     F076: 여기서 2회 연속 BYPASS 가 나왔다. 규칙 이름은 「덮어쓰기」인데 **덮어쓸 것이
//     있는지를 한 번도 안 봤다.** 게다가 이 훅의 처방은 「`Edit` 도구로 고쳐라」인데
//     `Edit` 는 파일을 옮기지도 복사하지도 못한다 — **따를 수 없는 처방을 주는 가드는
//     설계상 BYPASS 를 가르친다.** 대상이 실제로 있을 때만 막는다(아래 ②-b).
//
// 의도적 예외: 명령에 CODE_EDIT_BYPASS=1 을 붙인다.
'use strict';
const fs = require('fs');
const path = require('path');
const { stripNonExecutedText } = require(path.join(__dirname, 'lib', 'shell-text.js'));

/* 코드 파일 = 「깨지면 실행이 멈추거나 배포가 나가는 것」.
 * 목록을 하나에서 파생시킨다 — 훅 안에서도 같은 판정을 두 곳에 적으면 갈라진다(F063). */
const 코드확장 = ['js', 'gs', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'html', 'htm', 'css', 'py', 'sh', 'ps1', 'yml', 'yaml'];
const 확장RE = new RegExp(`\\.(${코드확장.join('|')})$`, 'i');
const 경로RE = new RegExp(`[^\\s'"|;&<>()]*\\.(${코드확장.join('|')})\\b`, 'gi');

function out(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

/* 처방을 먼저 준다 — 막기만 하는 가드는 우회를 가르친다.
 * 세 사고 전부 「원복이 별도 단계라 중간에 죽었다」이므로, 처방도 단계를 없애는 쪽이다. */
const 처방 =
  '\n\n→ 대신:'
  + '\n   1) **`Edit` 도구**로 고친다 — 되돌릴 때도 `Edit` 한 수다. 중간 상태가 없어 죽어도 파일이 안 남는다.'
  + '\n      일시적 변이(변이 테스트)도 예외가 아니다 — F067 이 정확히 그 변명으로 났다.'
  + '\n   2) 같은 변환을 **반복**한다면 셸이 아니라 repo 도구로 굳힌다(`tools/로고주입.js` 형태 — 정본 1개 + `--check`).'
  + '\n   3) 대상이 임시 파일이면 스크래치패드 경로로 옮긴다(그 경로는 이 훅이 안 본다).'
  + '\n   의도적 예외라면 명령 앞에 CODE_EDIT_BYPASS=1 을 붙인다.';

/** 임시·비영속 경로인가 — 여기 쓰는 건 사고가 아니다. */
function 임시경로(p) {
  const s = String(p).replace(/\\/g, '/').toLowerCase();
  return /(^|\/)(tmp|temp)\//.test(s)
    || /appdata\/local\/temp/.test(s)
    || /scratchpad/.test(s)
    || /(^|\/)node_modules\//.test(s)
    || s.startsWith('/dev/');
}

/** 문자열 안에서 보호 대상 코드 파일 경로만 뽑는다. */
function 코드경로들(s) {
  const hits = String(s).match(경로RE) || [];
  return hits.filter((p) => !임시경로(p));
}

/** 이미 토큰으로 갈라 놓은 **한 인자**가 보호 대상인가 (경로RE 를 다시 돌리지 않는다 · F063).
 *  cp·mv 는 인자 자리로 뜻이 갈려서 문자열 스캔이 아니라 토큰 판정이 필요하다. */
const 코드대상인가 = (p) => 확장RE.test(String(p)) && !임시경로(p);

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (_) {
  process.exit(0); // 입력을 못 읽으면 검사할 명령도 없다
}

const tool = String(input.tool_name || '');
if (!/^(Bash|PowerShell)$/i.test(tool)) process.exit(0);
const cmd = String((input.tool_input && input.tool_input.command) || '');
if (!cmd) process.exit(0);
if (/CODE_EDIT_BYPASS=1/.test(cmd)) process.exit(0);

/* 실행부만 남긴다 — 커밋 메시지·검색어에 적힌 문장을 명령으로 읽으면 문서화가 벌받는다(F049).
 * 단 **인용된 코드 경로**는 살린다(`> "docs/x.html"` 을 놓치면 규칙②가 통째로 헛돈다).
 * 인라인 스크립트 본문은 인용 안이 곧 검사 대상이라 여기 말고 규칙③에서 원본을 본다. */
/* ⚠ 인용 안의 **공백을 살린다.**
 *   이 저장소의 실제 경로는 `docs/정본/SYNK LAB/자료/…` 처럼 공백을 품는데, 인용을 그냥
 *   풀어 놓으면 아래 토큰 나누기가 경로를 조각내 `자료/X.html` 같은 **없는 경로**가 판정
 *   재료가 된다. F076 의 실제 입력이 정확히 이 모양이었고, 그래서 「대상이 있나」를 물어도
 *   영원히 「없다」가 나온다 — 조각은 언제나 없으니까. 공백을 U+0001 로 바꿔 한 토큰으로
 *   묶고, **파일을 만지거나 사람에게 보이기 직전에** `되돌림` 으로 푼다. */
// ⚠ 반드시 **이스케이프로** 적는다. 날문자로 적으면 눈에 안 보여서, 어느 편집이 지워도
//    `공백표` 가 빈 문자열이 되고 `되돌림` 이 글자 사이마다 공백을 끼운다 — 조용한 전면 파손이다.
const 공백표 = '';
const 되돌림 = (s) => String(s).split(공백표).join(' ');
/* 이 상수가 깨지면 경로에서 공백이 **사라져** 「없는 파일」이 되고, 그러면 아래 판정이 전부
 * 통과로 기운다 — 새는 방향이 언제나 통과인 그 형태다. 그래서 조용히 넘기지 않고 deny 로 드러낸다. */
if (공백표.length !== 1) {
  out('deny', '[code-edit-guard] 내부 상수(공백표)가 깨져 경로를 정확히 못 읽는다 — 검사할 수 없으니 막는다.'
    + '\n훅을 고치거나, 이 명령이 안전하다고 판단하면 CODE_EDIT_BYPASS=1 을 붙인다.');
}
const 실행부 = stripNonExecutedText(cmd, {
  keepQuoted: 확장RE,
  keepAs: (body) => ` ${body.split(' ').join(공백표)} `,
});

/* 명령이 실제로 실행될 위치. 상대 경로를 풀 때만 쓴다 — 없으면 훅 프로세스의 cwd 로 떨어지고,
 * 그때는 「해석 못 함」이 아니라 「다른 기준」이 되므로 아래 판정이 fail-closed 로 기운다. */
const 작업디렉터리 = String(input.cwd || process.cwd());

/* ── ① in-place 편집기 (F067) ─────────────────────────────────────────────
 * 스트림 편집이 필요하면 stdout 으로 내보내면 되고, 반복 변환이면 repo 도구로 굳힌다.
 *
 * ⚠ 대상 경로를 **본다**. 처음엔 `sed -i` 자체를 무조건 막게 짰는데, 그러면 권장 경로인
 *   「사본을 스크래치패드에 떠서 변이시킨다」까지 막혀 변이 검증 자체가 불가능해진다.
 *   막을 수 없는 걸 막는 가드는 BYPASS 를 습관으로 가르친다(v6.11). 보호 대상 코드 파일이
 *   하나라도 걸릴 때만 막는다 — F067 의 대상(SYNK-talk `tools/eval-score.js`)은 걸리고
 *   `/tmp/mut.js` 는 안 걸린다. */
function 인플레이스(s) {
  const re = /\b(sed|perl|ruby)\b([^\n;|&]*)/g;
  let m;
  while ((m = re.exec(s))) {
    for (const raw of (m[2].match(/(?:^|\s)(--?[A-Za-z][^\s]*)/g) || [])) {
      const f = raw.trim();
      // `--in-place` · `-i` · `-i.bak` · 묶음 플래그(`-pi`·`-ri`). `-e`·`-n`·`-f` 는 안 걸린다.
      if (/^--in-place\b/.test(f) || /^-[A-Za-z]*i(\.[^\s]*)?$/.test(f)) return { 이름: m[1], 플래그: f };
    }
  }
  return null;
}
const ip = 인플레이스(실행부);
const ip대상 = ip ? 코드경로들(실행부) : [];
if (ip && ip대상.length) {
  out('deny', `[code-edit-guard] \`${ip.이름} ${ip.플래그}\` 가 코드 파일을 **제자리에서** 바꾼다 — \`${ip대상[0]}\``
    + '\n2026-08-04 F067 실사고: 변이 테스트를 빨리 돌리려고 SYNK-talk `tools/eval-score.js` 에 `sed -i` 를 걸었는데,'
    + ' 백업 `cp` 가 /tmp 로 가서 **원복이 실패**했고 파일이 변이 상태로 남았다.'
    + '\n같은 결말이 네 번째다(F050 파이썬 heredoc · F065 python subprocess 중간 사망 · F067 여기 · 직전 세션 4번째).'
    + 처방);
}

/* ── ② 코드 파일에 써넣기 ────────────────────────────────────────────────
 * 리다이렉트·tee·cp/mv 덮어쓰기·PowerShell 쓰기 cmdlet. F065 의 「백업 cp」도 이 통로다. */
const 쓰기규칙 = [
  { 왜: '리다이렉트(`>` · `>>`)', re: /(?:^|[^\d\w>])>>?\s*([^\s'"|;&<>()]+)/g, 대상: (m) => [m[1]] },
  { 왜: '`tee`', re: /\btee\b((?:\s+-\S+)*)\s+([^\s'"|;&<>()]+)/g, 대상: (m) => [m[2]] },
  // cp·mv 는 여기 없다 — 인자 자리로 뜻이 갈리고 「대상이 있나」를 물어야 해서 ②-b 에서 따로 본다.
  // 쓰기 cmdlet 은 인자 자리 구분 없이 「그 안의 코드 경로」가 곧 쓰기 대상이다.
  { 왜: 'PowerShell 쓰기 cmdlet', re: /\b(?:Set-Content|Out-File|Add-Content)\b([^\n;|&]*)/gi, 대상: (m) => [m[1]] },
  { 왜: '.NET 파일 쓰기', re: /\[(?:System\.)?IO\.File\]::(?:WriteAll\w+|AppendAll\w+)\s*\(([^)]*)\)/gi, 대상: (m) => [m[1]] },
];
for (const 규칙 of 쓰기규칙) {
  let m;
  규칙.re.lastIndex = 0;
  while ((m = 규칙.re.exec(실행부))) {
    for (const 조각 of 규칙.대상(m)) {
      const 맞은것 = 코드경로들(조각);
      if (!맞은것.length) continue;
      out('deny', `[code-edit-guard] ${규칙.왜}로 코드 파일을 덮어쓴다 — \`${되돌림(맞은것[0])}\``
        + '\n셸 변이는 (백업→변이→검사→원복) 4단계라 중간에 죽으면 **변이 상태로 남는다**.'
        + ' 2026-08-04 F065: python subprocess 가 자식 stdout 을 CP949 로 디코드하다 예외를 던져 원복 라인이 아예 실행되지 않았다.'
        + 처방);
    }
  }
}

/* ── ②-b cp·mv 는 **덮어쓸 것이 있을 때만** 덮어쓰기다 (F076) ────────────────
 * 🔴 이 규칙은 원래 「마지막 인자가 코드 파일이면 막는다」였다. 그래서 rename 과 새 사본
 *   뜨기까지 막았고, 한 세션이 **2회 연속 BYPASS** 했다. 가드가 죽는 방식이 정확히 이것이다 —
 *   못 지킬 규칙은 우회를 손버릇으로 만들고, 그 손버릇은 **진짜 덮어쓰기도 같이 통과시킨다.**
 *
 * 🔑 가르는 축은 「덮어쓸 것이 지금 있는가」다. 그게 이 규칙 이름의 뜻이고,
 *   `Edit` 도구가 대안이 되는 조건이기도 하다(`Edit` 는 옮기지도 복사하지도 못한다 —
 *   따를 수 없는 처방을 주면 안 된다). 지키는 것: `cp /tmp/x.bak Code.js` 같은
 *   **백업 되돌리기** — F065·F067 이 실패한 바로 그 4단계의 마지막 칸.
 *
 * ⚠ 모르면 막는다. 글롭·변수처럼 대상을 특정할 수 없으면 「없다」가 아니라 **모른다**이고,
 *   가드에서 모름을 통과로 번역하면 새는 방향은 언제나 통과다. */
const 이동RE = /\b(cp|mv|copy|move|Copy-Item|Move-Item)\b([^\n;|&]*)/gi;

/** 'yes' | 'no' | 'unknown' — 이 자리에 지금 무언가 있는가. */
function 있나(p) {
  const s = 되돌림(p);
  /* 글롭·변수·틸드는 해석 못 한다. `$` 는 **뒤를 보지 않고** 잡는다 — `\w` 로 좁혔더니
   * `$대상.js` 처럼 한글로 시작하는 변수를 놓쳤고(JS 의 `\w` 는 ASCII 다), 놓친 방향은 통과였다. */
  if (!s || /[*?]|\$|%\w+%|(^|[\\/])~([\\/]|$)/.test(s)) return 'unknown';
  try {
    return fs.existsSync(path.isAbsolute(s) ? s : path.resolve(작업디렉터리, s)) ? 'yes' : 'no';
  } catch (_) { return 'unknown'; }
}

/** 디렉터리로 옮기면 진짜 대상은 `대상/원본이름` 이다 — 대상 토큰만 보면 통째로 눈이 먼다. */
function 실제대상들(원본들, 대상) {
  const s = 되돌림(대상);
  let 디렉터리 = false;
  try { 디렉터리 = fs.statSync(path.isAbsolute(s) ? s : path.resolve(작업디렉터리, s)).isDirectory(); } catch (_) { /* 없으면 파일 자리다 */ }
  if (!디렉터리) return [대상];
  const 앞 = 대상.replace(/[\\/]+$/, '');
  return 원본들.map((o) => `${앞}/${path.basename(되돌림(o))}`);
}

let mv;
while ((mv = 이동RE.exec(실행부))) {
  const 토큰 = (mv[2].match(/\S+/g) || []);
  const 위치 = [];
  let 대상 = null;
  for (let i = 0; i < 토큰.length; i++) {
    const t = 토큰[i];
    // PowerShell 명명 인자 — 자리로만 읽으면 `Copy-Item -Destination b -Path a` 에서 대상이 뒤집힌다.
    if (/^-{1,2}(?:Destination|Dest)$/i.test(t)) { 대상 = 토큰[++i] || 대상; continue; }
    if (/^-{1,2}(?:Path|LiteralPath)$/i.test(t)) { if (토큰[i + 1]) 위치.push(토큰[++i]); continue; }
    if (/^-/.test(t)) continue;   // 그 밖의 플래그
    위치.push(t);
  }
  if (대상 === null) 대상 = 위치.pop() || null;
  if (!대상 || !위치.length) continue;   // `mv a` 같은 조각은 판정 재료가 아니다

  for (const 후보 of 실제대상들(위치, 대상)) {
    if (!코드대상인가(후보)) continue;
    const 상태 = 있나(후보);
    if (상태 === 'no') continue;         // 🔑 덮어쓸 것이 없다 — rename·새 사본이다 (F076)
    const 이름 = mv[1];
    out('deny', 상태 === 'unknown'
      ? `[code-edit-guard] \`${이름}\` 의 대상을 특정할 수 없다 — \`${되돌림(후보)}\``
        + '\n글롭·변수가 섞여 있어 **덮어쓰는지 아닌지를 못 읽는다.** 모름을 통과로 바꾸지 않는다.'
        + '\n대상을 하나씩 풀어서 쓰면 이 훅은 rename·새 사본을 막지 않는다.'
        + 처방
      : `[code-edit-guard] \`${이름}\` 가 **이미 있는** 코드 파일을 덮어쓴다 — \`${되돌림(후보)}\``
        + '\n셸 변이는 (백업→변이→검사→원복) 4단계라 중간에 죽으면 **변이 상태로 남는다**.'
        + ' 2026-08-04 F065: python subprocess 가 자식 stdout 을 CP949 로 디코드하다 예외를 던져 원복 라인이 아예 실행되지 않았다.'
        + '\n(대상이 **없는** 이름이면 막지 않는다 — rename 과 새 사본은 이 통로가 아니다 · F076)'
        + 처방);
  }
}

/* ── ③ 인라인 스크립트가 코드 파일을 쓴다 (F050·F065) ──────────────────────
 * 여기서는 **원본**을 본다 — 인용·힙독 안이 곧 검사 대상이라 실행부를 쓰면 눈이 먼다.
 * 대신 앵커를 좁힌다: 실행기 + eval 플래그, 또는 **실행기에게 먹이는** 힙독. 그래야
 * 커밋 메시지에 적힌 코드 예시가 걸리지 않는다(가드는 산문을 벌하면 안 된다 · F049). */
const 실행기 = '(?:node|python3?|perl|ruby|deno|bun|php)';
const 쓰기API = new RegExp([
  'writeFileSync', 'appendFileSync', 'createWriteStream', 'copyFileSync', 'renameSync', 'cpSync',
  'unlinkSync', 'truncateSync', 'writeFile\\b', 'appendFile\\b',
  'write_text', 'writelines', 'shutil\\.(?:copy|move)', 'os\\.(?:replace|rename|remove)', 'fileinput',
  'File\\.write', 'IO\\.write',
  "open\\s*\\([^)]*['\"][waxr]\\+?b?t?['\"]", // open(p,'w') · open(p,'a') · open(p,'r+')
].join('|'), 'i');

const 본문들 = [];
// (a) 실행기에게 먹이는 힙독 — 여는 줄에 실행기가 있어야 한다(`git commit -F - <<EOF` 는 아니다)
const 힙 = /([^\n]*)<<-?\s*(['"]?)([A-Za-z_]\w*)\2[^\n]*\n([\s\S]*?)^\s*\3\s*$/gm;
let h;
while ((h = 힙.exec(cmd))) {
  if (new RegExp(`\\b${실행기}\\b`).test(h[1])) 본문들.push({ 형태: `힙독(<<${h[3]})`, 본문: h[4] });
}
// (b) -e / -c / --eval 본문. 힙독 본문과 커밋 메시지는 먼저 걷어낸다(앵커가 산문 안에서 잡히지 않게).
const 앵커용 = cmd
  .replace(힙, ' <<HEREDOC ')
  .replace(/(-m|--message)\s+(['"])[\s\S]*?\2/g, '$1 MSG');
const e = new RegExp(`\\b${실행기}\\b[^\\n]*?\\s(?:-e|-c|--eval)\\s`).exec(앵커용);
if (e) 본문들.push({ 형태: `인라인(${e[0].trim().split(/\s+/)[0]} …)`, 본문: 앵커용.slice(e.index + e[0].length) });

for (const { 형태, 본문 } of 본문들) {
  if (!쓰기API.test(본문)) continue;
  const 맞은것 = 코드경로들(본문);
  if (!맞은것.length) continue;
  out('deny', `[code-edit-guard] ${형태} 스크립트가 코드 파일에 쓴다 — \`${맞은것[0]}\``
    + '\n2026-08-04 F050: 파이썬 heredoc 으로 테스트 파일을 편집하다 이스케이프가 꼬여 **두 번 깨뜨렸다**.'
    + ' F065: 같은 통로에서 스크립트가 중간에 죽어 원복이 실행되지 않았다.'
    + '\n인라인 스크립트는 셸 인용 + 언어 이스케이프가 **두 겹**이라, 틀려도 실패가 아니라 오염으로 나온다.'
    + 처방);
}

process.exit(0);
