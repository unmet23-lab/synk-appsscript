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
const 실행부 = stripNonExecutedText(cmd, {
  keepQuoted: 확장RE,
  keepAs: (body) => ` ${body} `,
});

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
  // cp/mv 는 **마지막 인자**만 덮어쓰기다 — `cp Code.js /tmp/백업` 을 막으면 백업을 벌하는 꼴이 된다.
  { 왜: '복사·이동으로 덮어쓰기', re: /\b(?:cp|mv|copy|move|Copy-Item|Move-Item)\b([^\n;|&]*)/gi,
    대상: (m) => { const a = (m[1].match(/[^\s]+/g) || []).filter((t) => !t.startsWith('-')); return a.length > 1 ? [a[a.length - 1]] : []; } },
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
      out('deny', `[code-edit-guard] ${규칙.왜}로 코드 파일을 덮어쓴다 — \`${맞은것[0]}\``
        + '\n셸 변이는 (백업→변이→검사→원복) 4단계라 중간에 죽으면 **변이 상태로 남는다**.'
        + ' 2026-08-04 F065: python subprocess 가 자식 stdout 을 CP949 로 디코드하다 예외를 던져 원복 라인이 아예 실행되지 않았다.'
        + 처방);
    }
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
