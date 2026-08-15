#!/usr/bin/env node
/* 운영자료 내보내기 — 유호님이 눈으로 보는 산출물을 바탕화면 「SYNK 운영자료」로 보낸다.
 *
 * 유호 상시 지시(2026-08-09): "앞으로 뭐 만들면 여기로 다 넣어줘. 참고파일 등등 전부."
 * 경계 = 유호님이 보는 것만. 코드·테스트·훅·계약 JSON 은 repo 가 정본이라 넣지 않는다.
 *
 * 이 도구가 기계로 막는 것 둘:
 *   ① **바탕화면 경로 함정** — 실경로는 `OneDrive\Desktop` 인데 `USERPROFILE\Desktop` 도
 *      **존재하고 Test-Path 가 True** 라 「맞게 썼다」로 읽힌다. 2026-08-09 에 그 자리에
 *      폴더를 만들고 유호님께 「바탕화면에 넣었습니다」라고 보고했다(유호님이 "안 보이는데?"로 잡음).
 *      → 경로를 상수로 쓰지 않고 셸에 묻는다 — 그 판정은 `tools/lib/바탕화면.js` 한 곳에만 산다(2026-08-10 단일화).
 *      → 확장에 실패해 폴백을 쓰면 **조용히 넘어가지 않고 경고한다**(F044: 실제로 일하는 건 폴백이다).
 *   ② **사본이 낡는 것** — repo 안 문서는 복사하지 않고 `.lnk` 바로가기로 넣는다.
 *      복사본은 정본이 바뀌어도 안 바뀐다(docs/인쇄본/개원재무_*.pdf 가 그 사례 — 수치는 이미 대체됐다).
 *
 * 쓰기:
 *   node tools/운영자료.js <파일...>                 파일을 폴더에 넣는다(repo 안=바로가기 · 밖=복사)
 *   node tools/운영자료.js <파일> --이름 "표시 이름"  번호 뒤에 붙일 이름을 직접 준다
 *   node tools/운영자료.js --목록                     지금 폴더에 뭐가 있는지 본다
 *   node tools/운영자료.js --지금상태                 `_지금상태.html` 을 굽는다(무엇이 낡았는지 한 장으로)
 *   node tools/운영자료.js --링크화                   사본을 같은 번호의 바로가기로 바꾼다(낡을 것을 0으로)
 *   node tools/운영자료.js --링크화 <사본> --정본 <경로>  이름이 갈려 자동으로 못 잡는 한 건을 짝을 대고 바꾼다
 *   node tools/운영자료.js --옛판 [--집행]            같은 계열의 옛 판을 걷는다(기본 드라이런)
 *   위 전부에 `--갈래 철학|정본|운영` 을 붙일 수 있다(기본 = 운영 · `--지금상태` 는 늘 셋을 다 본다).
 *
 * ②의 뒷문 — `--사본`으로 들어간 것은 바로가기가 아니라서 정본을 고쳐도 안 따라간다.
 * 2026-08-09 에 실제로 벌어졌다(정본의 주말가를 고쳤는데 유호님 화면은 옛값 그대로).
 * 처방은 **`--링크화`** 다 — 바로가기는 원본을 가리키므로 낡을 수가 없다. 옛 처방이던 `--갱신`
 * (사본을 정본 내용으로 다시 굽는 손잡이)은 2026-08-14 에 닫았다: 사람이 불러야 도는 손잡이는
 * 안 부르면 낡고(철학 ㉡), 실측에서 살아 있는 대상이 **0** 이었다(사본 15건 전부 git 밖 산출물).
 * 그 자리를 대신하는 것이 `--지금상태` 다 — 고쳐 주지는 않지만, **낡았다는 사실을 숨기지 않는다.**
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
// 바탕화면을 찾는 **단 하나의 통로**(파일 안 사본 금지 — `tests/바탕화면통로.test.js` 가 문다).
const { 찾기: 바탕화면 } = require('./lib/바탕화면.js');

const 폴더명 = 'SYNK 운영자료';
const ROOT = path.resolve(__dirname, '..');

/** 갈래 — 유호님이 여는 화면은 이 폴더들뿐이다(유호 확정 2026-08-13 「이렇게 3개의 폴더만 있었으면」
 * + 유호 지시 2026-08-15 「엔진 폴더 — 회사 고유 IP 저장소」로 4번째 갈래와 그 하위 셋이 늘었다).
 *
 * 왜 하위 폴더인가: 한 폴더에 30개가 평평하게 쌓이니 「BGM 후보니 캐릭터 시안이니 쭉 나와」
 * 무엇이 규칙이고 무엇이 그날 자료인지 안 보였다. 번호는 **갈래마다 따로** 매긴다 —
 * 갈래를 옮긴 파일 때문에 다른 갈래의 번호가 밀리면 유호님이 기억하는 번호가 흔들린다.
 * 키(철학·정본·운영·엔진·코어·룸·몽글)는 명령줄에서 쓰는 짧은 이름이고, 값은 화면에 보이는 폴더 이름이다.
 * 앞 숫자는 탐색기 정렬을 유호님이 말한 순서(철학 → 정본 → 운영 → 엔진)로 고정한다.
 * 엔진 하위 셋(코어·룸·몽글)은 값이 중첩 경로다 — `갈래폴더`의 path.join 이 그대로 삼킨다.
 * ⚠대가: `--지금상태`·`--목록`의 폴더 이름이 `4_SYNK 엔진\1_SYNK Core` 꼴로 길어진다(판정 로직 무변). */
const 갈래들 = Object.freeze({
  철학: '1_SYNK 철학',
  정본: '2_SYNK LAB 정본',
  운영: '3_SYNK LAB 운영',
  엔진: '4_SYNK 엔진',
  코어: path.join('4_SYNK 엔진', '1_SYNK Core'),
  룸: path.join('4_SYNK 엔진', '2_Loom'),
  몽글: path.join('4_SYNK 엔진', '3_몽글 엔진'),
});
const 기본갈래 = '운영';

/** 갈래 이름을 폴더 절대경로로. 모르는 갈래는 **조용히 기본으로 떨어뜨리지 않고** 던진다
 *  — 오타 하나가 엉뚱한 갈래에 파일을 쌓으면 유호님 화면에서만 드러난다. */
function 갈래폴더(뿌리, 갈래 = 기본갈래) {
  const 이름 = 갈래들[갈래];
  if (!이름) throw new Error(`모르는 갈래: ${갈래} (쓸 수 있는 것: ${Object.keys(갈래들).join(' · ')})`);
  return path.join(뿌리, 이름);
}

/* ── 순수 함수(회귀가 이 넷을 붙든다) ─────────────────────────── */

/** 파일 목록에서 다음 일련번호. `01_…` 형태만 번호로 인정한다. */
function 다음번호(이름들) {
  const 쓴것 = 이름들
    .map((n) => /^(\d{2})_/.exec(n))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  const 다음 = 쓴것.length ? Math.max(...쓴것) + 1 : 1;
  return String(다음).padStart(2, '0');
}

/** repo 안이면 바로가기(사본 금지), 밖이면 복사. */
function 바로가기냐(파일경로, 루트 = ROOT) {
  const rel = path.relative(path.resolve(루트), path.resolve(파일경로));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Windows 파일명이 못 담는 문자를 지운다. 확장자는 부르는 쪽이 붙인다. */
function 안전한이름(이름) {
  return 이름
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

/** 이미 같은 대상이 들어가 있나 — 재실행해도 중복이 안 생기게.
 *  바로가기는 `대상`으로, **사본은 대상 기록이 없으므로 번호를 뗀 파일명으로** 본다
 *  (사본을 대상으로만 검사하면 돌릴 때마다 09·10·11… 로 쌓인다). */
function 이미있나(항목들, 대상절대경로) {
  const t = path.resolve(대상절대경로).toLowerCase();
  const base = path.basename(대상절대경로).toLowerCase();
  const 번호뗀 = (n) => n.replace(/^\d{2}_/, '').toLowerCase();
  return 항목들.some(
    (it) =>
      (it.대상 && path.resolve(it.대상).toLowerCase() === t) ||
      번호뗀(it.이름) === base ||
      번호뗀(it.이름) === `${path.basename(대상절대경로, path.extname(대상절대경로))}.lnk`.toLowerCase()
  );
}

/* ── 환경(여기부터 repo 밖) ───────────────────────────────────── */

/** PowerShell 을 UTF-16LE base64 로 부른다 — 한글 경로가 셸 인용에서 깨지지 않게.
 *
 * 🔴 **읽는 층이 값을 깨뜨린 자리다**(2026-08-09 실측). 프리앰블 두 줄이 없으면:
 *   ① 출력 코드페이지가 CP949 라 한글 경로가 `????` 로 와서 **멀쩡한 바로가기를
 *      「🔴 대상 없음」으로 오보**한다(실제 대상은 있다 — 확인은 PowerShell 쪽에서 True 7/7).
 *   ② 진행률 표시가 stderr 로 CLIXML 을 뱉어 출력을 통째로 덮는다.
 * 둘 다 「원본은 멀쩡한데 재는 층이 틀린」 형태라 조용하다 — 그래서 프리앰블을 상수로 박는다.
 */
const PS_프리앰블 =
  "$ProgressPreference='SilentlyContinue';" +
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' +
  '$OutputEncoding=[Text.Encoding]::UTF8;';

/** PowerShell 이 stderr 로 뱉는 CLIXML 을 **사람이 읽는 한 줄로** 푼다. 순수 함수.
 *
 * 🔴 이걸 안 하면 실패가 「stderr 없이 exit 1」로 보인다(2026-08-13 유호 신고 그 모양).
 * 원래 이 자리는 stderr 를 통째로 버렸다 — 이유는 「CLIXML 이 결과에 낀다」였는데,
 * execFileSync 는 stdout·stderr 를 **따로** 담으므로 섞일 일이 없다. 버릴 이유가 없었고,
 * 버린 대가로 원인을 말하는 문장(`Unable to save shortcut "…\x ? y.lnk"`)이 통째로 사라졌다. */
function PS오류읽기(원문) {
  const s = String(원문 || '');
  const 조각 = [...s.matchAll(/<S\s+S="Error">([\s\S]*?)<\/S>/g)].map((m) => m[1]);
  return (조각.length ? 조각.join('') : s.replace(/^#<\s*CLIXML[^>]*>/, ''))
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' · ')
    .slice(0, 500);
}

function ps(스크립트) {
  const enc = Buffer.from(PS_프리앰블 + 스크립트, 'utf16le').toString('base64');
  try {
    return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', enc], {
      encoding: 'utf8',
      windowsHide: true,
      // stdout·stderr 는 **다른 파이프**라 섞이지 않는다 — stderr 를 버리면 원인만 사라진다.
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    const 말 = PS오류읽기(e.stderr);
    const err = new Error(말 || `PowerShell 이 exit ${e.status} 로 죽었고 stderr 도 비었다`);
    err.status = e.status;
    throw err;
  }
}

/* 바탕화면 실경로는 위 `./lib/바탕화면.js` 가 준다 — 여기 사본을 되살리면 회귀가 문다
 * (문자열만 적어도 문다. 옛 방식 이름을 주석에 남기는 것도 다음 사본의 씨앗이라 같이 막는다).
 * 이 파일이 쓰던 PowerShell 셸 확장은 레지스트리와 **같은 값**이었다(2026-08-10 실측 · 판정 근거는 통로 머리에).
 * 확장 실패를 조용히 넘기지 않는 몫(`폴백` → 아래 main 의 경고)은 그대로 승계한다. */

/* ── 바로가기 통로 ────────────────────────────────────────────────
 *
 * 🔴 **WScript.Shell 은 경로를 시스템 ANSI 코드페이지로 깎는다**(2026-08-13 유호 신고 → 실측).
 *   유호님이 `--이름 "캐릭터 시안 v5 — 살아있음 반응 시연"` 로 부르자 stderr 없이 exit 1.
 *   층을 하나씩만 바꿔 대조하니 인코딩(UTF-16LE base64 왕복)도 파일시스템(fs 로 같은 이름 생성)도
 *   멀쩡했고 **CreateShortcut 만** 죽었다. 오류문이 스스로 자백한다 —
 *   `Unable to save shortcut "…\x ? y.lnk"` : 긴 줄표가 `?` 로 깎였고, `?` 는 파일명 금지문자다.
 *
 *   실패는 **세 얼굴이고 둘은 조용하다**(이 기계 ANSI=949 기준 실측):
 *     ㉠ 죽는다        — `—`(U+2014) `–` `“` `✅` `⚠` `🔴`  → `?` → FileNotFoundException
 *     ㉡ 딴 이름으로 만든다 — `é` → `e` (exit 0 인데 요청한 경로엔 파일이 없다)
 *     ㉢ 빈 값을 준다   — 그 이름 lnk 의 TargetPath 가 `''` → 「대상 없음」 오보의 씨앗
 *   코드페이지 **안**의 것은 전부 멀쩡했다(`―` `·` `→` `「` `㉠` `…` `’` `①` `Ⅰ` `√` 한글 `ß`).
 *
 * 그래서 처방을 「이름에서 특수문자를 지운다」로 잡지 않는다 — 멀쩡한 표기까지 깎아
 * 유호님이 읽는 이름을 훼손하고, 코드페이지 표를 JS 안에 베껴 두면 그 표가 갈라진다.
 * **COM 에는 ASCII 임시 이름만 주고 fs.rename 으로 확정한다** — 그 층이 그 문자를 만날 일을 없앤다.
 * 읽기도 같은 이유로 한 통로에 모은다(`바로가기대상읽기`). 탐지력 = `tests/운영자료.test.js` 의 CP949 모사 셸.
 */

/** COM 에 넘길 **임시 링크 이름** — 무엇을 주든 ASCII 로만 남긴다. 순수 함수.
 *  ⚠확장자는 반드시 `.lnk`(WScript.Shell 은 .lnk/.url 이 아니면 CreateShortcut 자체를 거부한다). */
function 임시링크이름(꼬리) {
  const 안전 = String(꼬리).replace(/[^A-Za-z0-9._-]/g, '') || '0';
  return `__mk-${안전}.lnk`;
}

let 임시번호 = 0;
const 다음임시 = (앞) => 임시링크이름(`${앞}-${process.pid}-${(임시번호 += 1)}`);

/** 바로가기를 만든다. 링크 이름이 무엇이든(긴 줄표·이모지) 만들어져야 한다.
 *  `셸` 은 테스트가 CP949 를 모사해 갈아끼우는 자리다 — 실환경 없이도 탐지력이 선다. */
function 바로가기만들기(링크경로, 대상, { 셸 = ps } = {}) {
  const 최종 = path.resolve(링크경로);
  const 대상절대 = path.resolve(대상);
  const 임시 = path.join(path.dirname(최종), 다음임시('w'));
  const 치우기 = () => { try { fs.rmSync(임시, { force: true }); } catch { /* 임시 정리 실패는 삼킨다 */ } };
  try {
    셸(
      '$s=New-Object -ComObject WScript.Shell;' +
        `$l=$s.CreateShortcut(${JSON.stringify(임시)});` +
        `$l.TargetPath=${JSON.stringify(대상절대)};` +
        '$l.Description="SYNK 정본 바로가기 — 원본이 바뀌면 자동으로 최신이 열립니다";' +
        '$l.Save()'
    );
  } catch (e) {
    치우기();
    throw new Error(못만든이유(최종, 대상절대, e.message));
  }
  // 「성공했다」를 안 믿는다 — ㉡(조용히 딴 이름)이 정확히 exit 0 으로 온다.
  if (!fs.existsSync(임시)) {
    throw new Error(못만든이유(최종, 대상절대, '셸이 성공을 알렸는데 그 자리에 파일이 없다 — 이름이 조용히 깎여 딴 곳에 만들어졌다'));
  }
  fs.renameSync(임시, 최종); // fs 는 유니코드를 그대로 쓴다(실측) — 이름 확정은 여기서
  return 최종;
}

/** 실패를 **이름과 함께** 말한다. 남는 위험은 하나뿐 — 폴더 경로(바탕화면 쪽)에 못 담는 문자가 있는 경우.
 *  그건 도구가 못 피하니, 적어도 조용히 죽지는 않게 한다. */
function 못만든이유(링크경로, 대상, 셸말) {
  return [
    '바로가기를 못 만들었다 — 이 층(WScript.Shell)은 경로를 Windows ANSI 코드페이지로 깎는다.',
    `  링크: ${링크경로}`,
    `  대상: ${대상}`,
    '  이름 쪽은 도구가 ASCII 임시이름으로 우회한다 — 그래도 죽었다면 **폴더 경로**에 그 코드페이지가 못 담는 문자가 있다.',
    `  셸: ${셸말}`,
  ].join('\n');
}

/** 바로가기가 가리키는 곳. 못 읽으면 `null`(빈 문자열을 「대상 없음」으로 번역하지 않는다).
 *
 * ㉢ 실측: 이름에 못 담는 문자가 있으면 COM 은 **안 죽고 빈 문자열**을 준다. 그래서 빈 값이 오면
 * 「대상이 없다」로 단정하지 말고 ASCII 임시 이름으로 **복사해서 한 번 더 읽는다**(읽기는 비파괴다). */
function 바로가기대상읽기(링크경로, { 셸 = ps } = {}) {
  const 절대 = path.resolve(링크경로);
  const 읽기 = (p) => {
    try {
      return 셸('$s=New-Object -ComObject WScript.Shell;' + `$l=$s.CreateShortcut(${JSON.stringify(p)});$l.TargetPath`);
    } catch { return ''; }
  };
  const 직접 = 읽기(절대);
  if (직접) return 직접;
  if (!fs.existsSync(절대)) return null;
  const 임시 = path.join(path.dirname(절대), 다음임시('r'));
  try {
    fs.copyFileSync(절대, 임시);
    return 읽기(임시) || null;
  } catch {
    return null;
  } finally {
    try { fs.rmSync(임시, { force: true }); } catch { /* 임시 정리 실패는 삼킨다 */ }
  }
}

function 목록읽기(폴더) {
  if (!fs.existsSync(폴더)) return [];
  const sh = [];
  for (const n of fs.readdirSync(폴더)) {
    // 만드는 중이던 임시 링크는 목록에도 번호에도 끼지 않는다(중간에 죽으면 남는다).
    if (n.startsWith('__mk-')) continue;
    // 하위 폴더는 자료가 아니다 — 「4_SYNK 엔진」 갈래 뿌리의 하위 셋(코어·룸·몽글)이 여기 걸린다.
    // 세면 `--지금상태`가 폴더를 ❔모름 행으로 오보하고 번호·옛판 판정에 끼어든다(2026-08-15).
    try { if (fs.statSync(path.join(폴더, n)).isDirectory()) continue; } catch { continue; }
    const 대상 = n.toLowerCase().endsWith('.lnk') ? 바로가기대상읽기(path.join(폴더, n)) : null;
    sh.push({ 이름: n, 대상 });
  }
  return sh;
}

/** 사본 이름(`01_운영_한눈에.html`)의 정본을 후보 중에서 고른다.
 *  **정확히 1개일 때만** 고른다 — 0개·2개 이상이면 null 이고, 부르는 쪽은 덮지 않는다. */
function 짝찾기(사본이름, 후보절대경로들) {
  const base = 사본이름.replace(/^\d{2}_/, '').toLowerCase();
  const 맞는것 = 후보절대경로들.filter((p) => path.basename(p).toLowerCase() === base);
  return 맞는것.length === 1 ? 맞는것[0] : null;
}

/** 사본의 정본이 될 수 있는 파일들. `_archive`(구판)·`_ops`(운영 장부)는 후보가 아니다. */
function 정본후보(루트 = path.join(ROOT, 'docs')) {
  const 결과 = [];
  const 건너뛸 = new Set(['_archive', '_ops', 'node_modules', '.git']);
  const 걷기 = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (건너뛸.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) 걷기(p);
      else 결과.push(p);
    }
  };
  if (fs.existsSync(루트)) 걷기(루트);
  return 결과;
}

/** 파일명에서 **계열과 판**을 뽑는다. 판 표기가 없으면 `null` — 그러면 이 파일은 영영 안 걷힌다.
 *
 * 유호 지시 2026-08-13: "캐릭터 시안 1,2,3,4 있으면 1,2,3은 자동삭제되고 확정된 4만 유지".
 * 🔴 급소는 「무엇을 같은 계열로 볼 것인가」다 — 잘못 묶으면 **비가역으로** 필요한 것을 지운다.
 *   그래서 판정을 좁게 잡는다: 이름에 `v4` 같은 판 번호나 `2026-08-07` 같은 날짜가 **실제로 박혀
 *   있을 때만** 계열로 인정한다. `BGM 후보 A`·`BGM 후보 B` 처럼 병렬 후보는 판 표기가 없으니
 *   계열이 안 잡히고, 따라서 자동으로 지워지지 않는다 — 그 둘은 서로의 옛 판이 아니라 **같이 놓고
 *   고르는 것**이기 때문이다. 좁게 잡아 못 걷는 것은 사람이 지우면 되지만, 넓게 잡아 지운 것은 못 되돌린다.
 */
/** 계열키와 기저키가 **같은 앞부분**을 쓰게 하는 단 하나의 자리.
 *  두 곳에 따로 적으면 한쪽만 고치는 날 판정이 갈린다(가드 맹점 ④). */
function 이름정리(파일명) {
  return String(파일명)
    .replace(/^\d{2}_/, '')           // 운영자료가 붙인 일련번호
    .replace(/\.[^.]+$/, '')          // 확장자
    .replace(/\s*\([^)]*\)\s*$/, ''); // 끝의 괄호 설명 — 판마다 달라서 계열 판정에 넣으면 안 묶인다
}

function 계열키(파일명) {
  let s = 이름정리(파일명);
  const 판 = [];
  s = s.replace(/(?<![a-zA-Z0-9])[vV](\d+)(?:\.(\d+))?(?![0-9])/g, (_, a, b) => {
    판.push(Number(a) * 1000 + Number(b || 0));
    return ' ';
  });
  s = s.replace(/(?<![0-9])(20\d{2})-(\d{2})-(\d{2})(?![0-9])/g, (_, y, m, d) => {
    판.push(Number(`${y}${m}${d}`));
    return ' ';
  });
  if (!판.length) return null;       // 판 표기가 없다 = 계열이 아니다 = 안 걷는다
  const 계열 = s.replace(/[\s_-]+/g, ' ').trim().toLowerCase();
  if (!계열.replace(/ /g, '').trim()) return null; // 판 말고 아무것도 안 남으면 못 믿는다
  return { 계열, 판: Math.max(...판) };
}

/** 이름 목록에서 **걷어낼 옛 판**을 고른다. 순수 함수 — 탐지력은 픽스처가 진다.
 *  같은 계열이 둘 이상이고 판이 서로 다를 때만 고른다(같은 판이 둘이면 어느 쪽이 최신인지 모른다). */
function 옛판고르기(이름들, { 계열만 = null } = {}) {
  const 묶음 = new Map();
  for (const n of 이름들) {
    const k = 계열키(n);
    if (!k) continue;
    if (계열만 && k.계열 !== 계열만) continue;
    if (!묶음.has(k.계열)) 묶음.set(k.계열, []);
    묶음.get(k.계열).push({ 이름: n, 판: k.판 });
  }
  const 걷을것 = [];
  for (const [계열, 것들] of 묶음) {
    if (것들.length < 2) continue;
    const 최신 = Math.max(...것들.map((x) => x.판));
    if (것들.every((x) => x.판 === 최신)) continue; // 판이 다 같다 — 옛 판이란 게 없다
    for (const x of 것들) if (x.판 !== 최신) 걷을것.push({ ...x, 계열, 최신 });
  }
  return 걷을것;
}

/** 판 표기가 **없는** 이름의 정규화 키. 판 표기가 있으면 기저판이 아니므로 `null`. */
function 기저키(파일명) {
  if (계열키(파일명)) return null;
  return 이름정리(파일명).replace(/[\s_-]+/g, ' ').trim().toLowerCase() || null;
}

/** 앞 낱말 몇 개가 같아야 「짝일 것 같다」고 부를지. 넓게 잡는다 — 이 층은 **보고만** 하기 때문이다. */
const 의심_최소겹침 = 2;

/** 계열로 **안 잡히는** 짝을 의심으로 드러낸다 — 지우지 않는다.
 *
 * 왜 (2026-08-14 실측): `--옛판` 이 "걷어낼 옛 판이 없다"고 **초록 얼굴로** 답한 자리에
 * 구판 4쌍이 그대로 있었다(FB 인사카드·티저·커버·프로필 ↔ 그 `v2 체리젤리`). 원인은 계열키가
 * 좁아서가 아니라 **옛것 쪽에 판 표기가 없어서**다 — 무표기는 계열키가 `null` 이라 묶일 상대가
 * 아예 없고, 그래서 `계열키` 머리말이 말한 「영영 안 걷힌다」가 조용히 성립한다.
 * 장치가 안 도는 게 아니라 **맞는 얼굴로 틀린 값을 내는** 자리였다(지침 v9.2 맹점 ④).
 *
 * 대가(같이 적는다):
 *  · 틀릴 때의 모습 = **거짓양성**이다. 앞 두 낱말만 같으면 짝으로 부르므로 관계없는 둘이
 *    나란히 찍힌다 — 사람이 무시하면 끝난다. 반대로 좁게 잡아 놓치면 오늘의 거짓 초록이 다시 난다.
 *    그래서 이 층은 넓고, **삭제 판정은 좁은 채로 둔다**(넓게 잡아 지운 것은 못 되돌린다).
 *  · 닫은 것 = `--옛판` 의 「걷어낼 옛 판이 없다」 한 줄짜리 초록. 이제 그 줄은 혼자 못 나온다.
 */
function 짝의심(이름들) {
  const 낱말 = (s) => s.split(' ').filter(Boolean);
  const 기저들 = [];
  const 판있는것 = [];
  for (const n of 이름들) {
    const k = 계열키(n);
    if (k) { 판있는것.push({ 이름: n, 계열: k.계열, 판: k.판 }); continue; }
    const b = 기저키(n);
    if (b) 기저들.push({ 이름: n, 키: b });
  }
  const 결과 = [];
  for (const a of 기저들) {
    const aw = 낱말(a.키);
    if (aw.length < 의심_최소겹침) continue;   // 낱말이 하나뿐이면 무엇과도 겹쳐 보인다
    const 짝 = [];
    for (const b of 판있는것) {
      const bw = 낱말(b.계열);
      let i = 0;
      while (i < aw.length && i < bw.length && aw[i] === bw[i]) i += 1;
      if (i >= 의심_최소겹침) 짝.push(b.이름);
    }
    if (짝.length) 결과.push({ 이름: a.이름, 짝 });
  }
  /* ② 양쪽 다 판 표기가 있는데 **계열이 갈린** 짝. 꼬리 낱말이 판마다 바뀌면 이렇게 샌다 —
   *    실측 08-14: `…티저영상 6초 v2 체리젤리` ↔ `…티저영상 v3 (열일곱 번째)`. 같은 줄기인데
   *    계열이 「…티저영상 6초 체리젤리」와 「…티저영상」 둘로 갈려 옛판고르기가 영영 안 묶는다.
   *    나보다 **새 판**이 있는 것만 든다 — 최신을 의심 목록에 올리면 사람이 최신을 지운다. */
  for (const a of 판있는것) {
    const aw = 낱말(a.계열);
    if (aw.length < 의심_최소겹침) continue;
    const 짝 = [];
    for (const b of 판있는것) {
      if (b.계열 === a.계열 || b.판 <= a.판) continue;
      const bw = 낱말(b.계열);
      let i = 0;
      while (i < aw.length && i < bw.length && aw[i] === bw[i]) i += 1;
      if (i >= 의심_최소겹침) 짝.push(b.이름);
    }
    if (짝.length) 결과.push({ 이름: a.이름, 짝 });
  }
  return 결과;
}

function 의심보고(의심) {
  if (!의심.length) return;
  console.log(`\n  🟡 계열로 **안 잡히는** 짝 의심 ${의심.length}건 — 옛것에 판 표기가 없어 자동으로는 영영 안 걷힌다.`);
  console.log('     자동 삭제는 안 한다 — 좁게 잡아 못 걷는 것은 사람이 지우면 되지만, 넓게 잡아 지운 것은 못 되돌린다.');
  for (const x of 의심) {
    console.log(`     · ${x.이름}`);
    for (const p of x.짝) console.log(`         ↔ ${p}`);
  }
}

/* ── 본체 ─────────────────────────────────────────────────────── */

/** 같은 계열의 옛 판을 걷는다. 기본은 **드라이런** — 지우려면 `--집행`.
 *  `방금` 을 주면 그 파일이 속한 계열만 본다(파일을 넣은 직후 자동 호출되는 자리). */
function 옛판정리(폴더, { 집행 = false, 조용히 = false, 방금 = null } = {}) {
  const 이름들 = 목록읽기(폴더).map((it) => it.이름);
  // 방금 넣은 파일에 판 표기가 없으면 걷을 계열 자체가 없다 — 여기서 끝낸다.
  // (계열만 을 null 로 두면 「제한 없음」이 되어 넣기와 무관한 파일까지 폴더 전체를 훑는다.)
  if (방금 && !계열키(방금)) return 0;
  const 계열만 = 방금 ? 계열키(방금).계열 : null;
  const 걷을것 = 옛판고르기(이름들, { 계열만 });
  // 🔴 「없다」를 혼자 내보내지 않는다 — 그 한 줄이 초록의 얼굴로 구판 4쌍을 덮고 있었다(2026-08-14).
  //    폴더 전체를 볼 때만 잰다(`방금` 은 넣은 파일 한 계열만 보는 자리라 분모가 다르다).
  const 의심 = 방금 ? [] : 짝의심(이름들);
  if (!걷을것.length) {
    if (!조용히) {
      console.log(`■ ${폴더}\n  걷어낼 옛 판이 없다 (파일 ${이름들.length}건)`);
      의심보고(의심);
    }
    return 0;
  }
  for (const x of 걷을것) {
    console.log(`${집행 ? '🗑 ' : '[드라이런] '}${x.이름}  — 같은 계열에 더 새 판이 있다`);
    if (집행) fs.rmSync(path.join(폴더, x.이름), { force: true });
  }
  if (!집행) console.log(`\n  ${걷을것.length}건 — 지우려면 \`--옛판 --집행\``);
  의심보고(의심);
  return 0;
}

/* ── 지금상태 — 폴더가 스스로 「나 낡았다」고 말한다 ─────────────────────────
 *
 * 왜 (2026-08-14 유호 채택): 이 폴더의 진짜 병은 개수도 갈래도 아니라 **열기 전에는 낡았는지
 * 알 수 없다**는 것이었다. `04_SYNK_철학.pdf` 라는 이름은 그것이 v1.5 라는 걸 한 글자도 말하지
 * 않았고, 그래서 정본이 하루에 두 번 올라도(v1.7 15:56 · v1.8 23:36) 아무도 못 알아챘다.
 * `03_개원 재무 (달력만 유효)` 처럼 사람이 손으로 적어 넣은 표시는 **다음 낡음엔 안 붙는다**.
 *
 * 대가(새 장치엔 같이 적는다 — 지침 v9.2 맹점 ④):
 *  · 틀릴 때의 모습 = 「초록이면 최신」으로 읽히는 자리가 하나 더 생긴다. 그래서 정본을 못 찾은
 *    항목은 초록이 아니라 **❔모름**으로 적는다 — 모르는 것과 최신인 것은 다른 상태다.
 *  · 닫은 것 = `--갱신`. 실측 2026-08-14: 사본 15건이 **전부** 「출처 모름」(git 밖 산출물)이라
 *    살아 있는 대상이 0이었고, 이 파일 머리말이 이미 「손잡이를 없애는 쪽이 근본 처방」이라
 *    적고 있었다(사람이 불러야 도는 손잡이는 안 부르면 낡는다 · 철학 ㉡).
 */

const 판정문 = Object.freeze({
  원본:       ['✅', '원본을 가리킨다 — 낡을 수 없다'],
  스냅샷최신: ['✅', '구운 것이 정본만큼 새것이다'],
  스냅샷낡음: ['🔴', '구운 것이 정본보다 옛것 — 다시 구워야 한다'],
  사본최신:   ['✅', '사본이 정본과 같다'],
  사본낡음:   ['🔴', '사본이 정본보다 옛것이다'],
  외부:       ['🔗', '바깥 링크 — 이 표가 판정할 대상이 아니다'],
  모름:       ['❔', '정본을 못 찾았다 — 낡았는지 «알 수 없다»'],
  끊김:       ['🔴', '가리키는 대상이 없다'],
});

/** 한 항목의 지금 상태. **순수** — 파일 사실만 받아 판정을 낸다(회귀가 이 함수를 붙든다). */
function 상태판정({ 바로가기 = false, 대상없음 = false, 외부 = false, 정본시각 = null, 실체시각 = null }) {
  if (외부) return '외부';
  if (대상없음) return '끊김';
  if (정본시각 == null || 실체시각 == null) return 바로가기 ? '원본' : '모름';
  if (실체시각 < 정본시각) return 바로가기 ? '스냅샷낡음' : '사본낡음';
  return 바로가기 ? '스냅샷최신' : '사본최신';
}

/** `docs/인쇄본/X.pdf` 처럼 **구운 것**의 원본 md 를 찾는다. 못 찾으면 null(모름으로 떨어진다). */
function 스냅샷원본(실체, 후보) {
  if (!/\.pdf$/i.test(실체)) return null;
  return 짝찾기(path.basename(실체).replace(/\.pdf$/i, '.md'), 후보);
}

/** 문서 머리의 정본 선언(`<!-- 정본: v1.8 -->`)을 읽는다. 없으면 null — 지어내지 않는다. */
function 정본판(파일) {
  try {
    const m = fs.readFileSync(파일, 'utf8').slice(0, 400).match(/정본:\s*(v[\d.]+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

const 때 = (p) => { try { return fs.statSync(p).mtime; } catch { return null; } };

/** 갈래 하나의 상태 줄들. */
function 상태줄들(폴더, 후보) {
  return 목록읽기(폴더).map((it) => {
    const 놓인곳 = path.join(폴더, it.이름);
    const 바로가기 = it.이름.toLowerCase().endsWith('.lnk');
    const 외부 = it.이름.toLowerCase().endsWith('.url');
    const 실체 = 바로가기 ? it.대상 : 놓인곳;
    const 대상없음 = 바로가기 && (!실체 || !fs.existsSync(실체));
    const 정본 = 대상없음 || 외부 ? null
      : (바로가기 ? 스냅샷원본(실체, 후보) : 짝찾기(it.이름, 후보));
    const 판정 = 상태판정({
      바로가기, 대상없음, 외부,
      정본시각: 정본 ? 때(정본) : null,
      실체시각: 실체 ? 때(실체) : null,
    });
    return {
      이름: it.이름,
      가리키는곳: 바로가기 && 실체 ? path.relative(ROOT, 실체).replace(/\\/g, '/') : null,
      정본: 정본 ? path.relative(ROOT, 정본).replace(/\\/g, '/') : null,
      판: 정본 ? 정본판(정본) : (실체 && /\.(md|html)$/i.test(실체) ? 정본판(실체) : null),
      갱신: 때(실체 || 놓인곳),
      판정,
    };
  });
}

const 날짜글 = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '—');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** `_지금상태.html` 을 뿌리에 굽는다 — 갈래 폴더보다 먼저 눈에 들어오게 밑줄로 시작한다. */
function 지금상태빌드(뿌리) {
  const 후보 = 정본후보();
  const 갈래줄 = Object.entries(갈래들).map(([갈래, 폴더]) => ({
    갈래, 폴더, 줄: 상태줄들(path.join(뿌리, 폴더), 후보),
  }));
  const 전부 = 갈래줄.flatMap((g) => g.줄);
  const 셈 = (k) => 전부.filter((r) => 판정문[r.판정][0] === k).length;

  const 표 = (줄) => `<table><thead><tr><th>상태</th><th>이름</th><th>판</th><th>마지막 갱신</th><th>가리키는 곳</th></tr></thead><tbody>${
    줄.map((r) => {
      const [기호, 말] = 판정문[r.판정];
      return `<tr><td class="s" title="${esc(말)}">${기호} ${esc(말)}</td><td>${esc(r.이름)}</td>`
        + `<td>${r.판 ? esc(r.판) : '<span class=q>—</span>'}</td><td>${날짜글(r.갱신)}</td>`
        + `<td class="p">${r.가리키는곳 ? esc(r.가리키는곳) : '<span class=q>이 폴더가 원본</span>'}</td></tr>`;
    }).join('')}</tbody></table>`;

  const html = `<!doctype html><html lang="ko"><meta charset="utf-8">
<title>SYNK 운영자료 — 지금 상태</title><style>
body{background:#FBF7EE;color:#171820;font-family:'SUIT','Inter Tight','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
     line-height:1.7;max-width:1040px;margin:0 auto;padding:44px 26px;word-break:keep-all;}
header{background:#0F1730;color:#F6F1E8;margin:-44px -26px 32px;padding:32px 26px 24px;}
header h1{margin:0;font-size:1.45em;color:#F6F1E8;}
header .cap{color:#8A93AD;font-size:.86em;margin-top:6px;}
h2{font-size:1.1em;margin:2em 0 .5em;padding-bottom:.25em;border-bottom:3px solid #FF6B5C;}
table{border-collapse:collapse;width:100%;font-size:.87em;}
th,td{border:1px solid #2A3358;padding:.4em .55em;text-align:left;vertical-align:top;}
th{background:#0F1730;color:#F6F1E8;font-weight:600;}
td.s{white-space:nowrap;}td.p{font-size:.92em;color:#5F657D;}
/* 🔴 흐린 회색은 #5F657D 다 — #8A93AD 는 종이(#FBF7EE) 위에서 대비 2.86 이라 린트가 문다.
 *    #8A93AD 는 남색 띠(#0F1730) 위에서만 쓴다(header .cap). */
.q{color:#5F657D;}
.tally{background:#FFE9E4;border-left:4px solid #FF6B5C;padding:.7em 1em;margin:1.2em 0;font-size:.93em;}
footer{margin-top:2.6em;color:#5F657D;font-size:.8em;}
</style>
<header><h1>SYNK 운영자료 — 지금 상태</h1>
<div class="cap">이 표는 열기 전에 「낡았는지」를 말해 준다. 굽는 명령 = <code>node tools/운영자료.js --지금상태</code></div></header>
<div class="tally">🔴 낡음·끊김 <b>${셈('🔴')}</b> · ❔ 모름 <b>${셈('❔')}</b> · ✅ 최신 <b>${셈('✅')}</b> · 🔗 바깥 링크 <b>${셈('🔗')}</b>
<br><span class="q">❔모름은 «최신이 아니다»가 아니라 «알 수 없다»다 — 저장소에 짝이 없는 산출물(BGM·이미지·영상)이 여기 든다. 초록으로 접지 않는다.</span></div>
${갈래줄.map((g) => `<h2>${esc(g.폴더)} — ${g.줄.length}건</h2>${표(g.줄)}`).join('\n')}
<footer>구운 때 ${날짜글(new Date())} · 이 파일은 파생이다 — 고칠 것은 여기가 아니라 저장소의 정본이다.</footer>
</html>`;

  const 놓을곳 = path.join(뿌리, '_지금상태.html');
  fs.writeFileSync(놓을곳, html);
  console.log(`✅ ${놓을곳}\n   🔴 ${셈('🔴')} · ❔ ${셈('❔')} · ✅ ${셈('✅')} · 🔗 ${셈('🔗')}  (전체 ${전부.length}건)`);
  for (const r of 전부) if (판정문[r.판정][0] === '🔴') console.log(`   🔴 ${r.이름} — ${판정문[r.판정][1]}`);
  return 0;
}

/** 사본을 **같은 번호의 바로가기로** 바꾼다 — 갱신해 줘야 하는 파일을 아예 0으로 만든다.
 *
 * 왜 `--갱신` 이 있는데 또 필요한가 (2026-08-13 유호 승인):
 *   `--갱신` 은 사람이 불러야 도는 손잡이라, 안 부르면 사본은 계속 낡는다. 실제로 낡았다 —
 *   `_자료\SYNK_홈페이지_시안_2026-08-09.html` 이 08-10 판 정본보다 옛것인 채 유호님 화면에 있었다.
 *   바로가기는 **원본을 가리키므로 낡을 수가 없다** — 손잡이를 없애는 쪽이 근본 처방이다(철학 ㉡).
 *
 * 안전 둘:
 *   ① 짝을 **정확히 1개** 찾고 **내용까지 같을 때만** 자동으로 바꾼다. 이름이 갈리거나 내용이 다르면
 *      짐작하지 않고 남긴다 — 그 경우는 호출자가 `--정본` 으로 짝을 대 준다(그때는 내용 대조 없이 바꾸되
 *      다르면 경고한다: 사본이 구판이라 바로가기로 바꾸는 것이 **정확히 그 상황의 처방**이기 때문).
 *   ② 사본을 먼저 지우지 않는다 — 임시 이름으로 링크를 만들어 **대상이 읽히는지 확인한 뒤**
 *      사본을 지우고 이름을 확정한다. 중간에 죽어도 사본은 살아 있다.
 */
function 링크화(폴더, { 사본경로 = null, 정본경로 = null } = {}) {
  const 한건 = (파일, 정본, 강제) => {
    const 이름 = path.basename(파일);
    if (이름.toLowerCase().endsWith('.lnk')) {
      console.log(`· 이미 바로가기 — 건너뜀: ${이름}`);
      return 'skip';
    }
    if (!fs.existsSync(정본)) {
      console.error(`❌ 정본이 없다 — 안 건드린다: ${이름}\n   ${정본}`);
      return 'fail';
    }
    const 같나 = fs.readFileSync(정본).equals(fs.readFileSync(파일));
    if (!같나 && !강제) {
      console.log(`· 내용이 다르다 — 안 건드린다(--정본 으로 짝을 대면 바꾼다): ${이름}`);
      return 'skip';
    }
    const 뿌리 = path.join(path.dirname(파일), path.basename(이름, path.extname(이름)));
    const 최종 = 뿌리 + '.lnk';
    // ⚠임시 이름도 `.lnk` 로 끝나야 한다 — WScript.Shell 은 확장자가 .lnk/.url 이 아니면
    //   CreateShortcut 자체를 거부한다(2026-08-13 실측: `.lnk.tmp` 로 만들었더니 통째로 실패).
    const 임시 = 뿌리 + '.만드는중.lnk';
    바로가기만들기(임시, 정본);
    // 만들었다고 믿지 않고 **대상이 실제로 읽히는지** 확인한 뒤에야 사본을 지운다.
    // ⚠읽기는 공용 통로로 — 직접 ps 로 읽으면 이름에 `—` 가 든 사본에서 빈 값이 와서
    //   멀쩡한 링크를 「엉뚱한 곳을 가리킨다」로 오보하고 사본을 영영 못 바꾼다(㉢ 실측).
    const 읽힌대상 = 바로가기대상읽기(임시);
    if (path.resolve(읽힌대상 || '') !== path.resolve(정본)) {
      try { fs.unlinkSync(임시); } catch { /* 임시 정리 실패는 삼킨다 */ }
      console.error(`❌ 바로가기가 엉뚱한 곳을 가리킨다 — 사본을 지키고 멈춘다: ${이름}`);
      return 'fail';
    }
    fs.unlinkSync(파일);
    fs.renameSync(임시, 최종);
    console.log(
      `✅ 바로가기  ${path.basename(최종)}${같나 ? '' : '  ⚠사본이 정본과 달랐다(구판이었다는 뜻)'}\n` +
        `              → ${path.relative(ROOT, 정본)}`
    );
    return 'ok';
  };

  /* 짝을 직접 댄 한 건만 — 이름이 갈려 자동으로는 못 잡는 자리를 여는 통로. */
  if (사본경로) {
    const 파일 = path.isAbsolute(사본경로) ? 사본경로 : path.join(폴더, 사본경로);
    if (!fs.existsSync(파일)) {
      console.error(`❌ 그 사본이 없다: ${파일}`);
      return 1;
    }
    const 정본 = 정본경로
      ? path.resolve(path.isAbsolute(정본경로) ? 정본경로 : path.join(ROOT, 정본경로))
      : 짝찾기(path.basename(파일), 정본후보());
    if (!정본) {
      console.error(`❌ 짝을 못 찾았다 — \`--정본 <저장소 안 경로>\` 로 대 준다: ${path.basename(파일)}`);
      return 1;
    }
    return 한건(파일, 정본, Boolean(정본경로)) === 'fail' ? 1 : 0;
  }

  /* 자동 — 최상위 사본 중 짝이 확실하고 내용까지 같은 것만. */
  const 사본들 = 목록읽기(폴더).filter(
    (it) => !it.이름.toLowerCase().endsWith('.lnk') && fs.statSync(path.join(폴더, it.이름)).isFile()
  );
  const 후보 = 정본후보();
  let 바꿈 = 0, 남김 = 0;
  for (const it of 사본들) {
    const 정본 = 짝찾기(it.이름, 후보);
    if (!정본) {
      console.log(`· 출처 모름 — 안 건드린다: ${it.이름}`);
      남김 += 1;
      continue;
    }
    if (한건(path.join(폴더, it.이름), 정본, false) === 'ok') 바꿈 += 1;
    else 남김 += 1;
  }
  console.log(`\n■ ${폴더}\n  사본 ${사본들.length}건 — 바로가기로 ${바꿈} · 남김 ${남김}`);
  return 0;
}

/** 플래그 값 자리(`--이름 X`·`--갈래 Y` 의 X·Y)를 뺀 「넣을 파일」 인자만 추린다.
 *  🔴 실측 2026-08-13: 플래그가 **없으면** `indexOf`가 -1 → `-1+1=0` 이 되어 0번째 인자
 *  (첫 파일)를 값 자리로 오인해 버렸다. 파일 목록이 비면 루프가 0회라 **조용히 exit 0**
 *  — 성공의 얼굴을 한 무동작(새는 방향은 언제나 「통과」다). 값 자리는 플래그가 실제로
 *  있을 때만 뺀다. 회귀 = tests/운영자료.test.js 「파일인자」. */
function 파일인자(인자) {
  const 값자리 = new Set();
  for (const 플래그 of ['--이름', '--갈래']) {
    const j = 인자.indexOf(플래그);
    if (j >= 0) 값자리.add(j + 1);
  }
  return 인자.filter((a, k) => !a.startsWith('--') && !값자리.has(k));
}

function main(argv) {
  const 인자 = argv.slice(2);
  const { 경로: 바탕, 폴백 } = 바탕화면();
  const 폴더 = path.join(바탕, 폴더명);
  if (폴백) {
    console.error('⚠ 바탕화면 실경로 확장에 실패해 폴백을 썼다 — 여기가 유호님 화면이 맞는지 눈으로 확인할 것');
    console.error(`  폴백 경로: ${폴더}`);
  }

  const 값 = (k) => {
    const j = 인자.indexOf(k);
    return j >= 0 && 인자[j + 1] && !인자[j + 1].startsWith('--') ? 인자[j + 1] : null;
  };
  let 갈래;
  try {
    갈래 = 값('--갈래') || 기본갈래;
    var 갈래폴더경로 = 갈래폴더(폴더, 갈래);
  } catch (e) {
    console.error(`🔴 ${e.message}`);
    return 1;
  }

  // 🔑 `--지금상태` 는 **갈래를 안 받는다** — 셋을 한 장에 담는 것이 이 표의 요점이다.
  //    갈래별로 갈라 굽게 두면 유호님이 세 장을 열어야 하고, 안 연 한 장이 낡음의 자리가 된다.
  if (인자.includes('--지금상태')) return 지금상태빌드(폴더);

  if (인자.includes('--갱신')) {
    console.error('🔴 `--갱신` 은 닫혔다(2026-08-14) — 사본을 다시 굽는 대신 `--링크화` 로 바로가기로 바꾼다.'
      + '\n   바로가기는 원본을 가리키므로 낡을 수가 없다. 무엇이 낡았는지는 `--지금상태`.');
    return 1;
  }

  if (인자.includes('--링크화')) {
    return 링크화(갈래폴더경로, { 사본경로: 값('--링크화'), 정본경로: 값('--정본') });
  }

  if (인자.includes('--옛판')) return 옛판정리(갈래폴더경로, { 집행: 인자.includes('--집행') });

  if (인자.includes('--목록') || 인자.length === 0) {
    /* 갈래를 준 게 아니면 **셋을 다 보여준다** — 유호님이 여는 화면이 셋이라, 하나만 찍으면
     * 나머지 둘에 뭐가 있는지 도구로는 영영 안 보인다(그게 `_자료` 가 잊혔던 경로다). */
    const 볼것 = 값('--갈래') ? [갈래] : Object.keys(갈래들);
    let 합 = 0;
    for (const g of 볼것) {
      const 그폴더 = 갈래폴더(폴더, g);
      const 항목 = 목록읽기(그폴더);
      합 += 항목.length;
      console.log(`\n■ ${갈래들[g]} — ${항목.length}건`);
      for (const it of 항목) {
        const 꼬리 = it.대상 ? `  → ${it.대상}${fs.existsSync(it.대상) ? '' : '  🔴 대상 없음'}` : '';
        console.log(`  · ${it.이름}${꼬리}`);
      }
      if (!항목.length) console.log('  (비었거나 아직 없다)');
    }
    console.log(`\n${폴더}  — 전체 ${합}건`);
    if (인자.length === 0) {
      console.log('\n쓰기: node tools/운영자료.js <파일...> [--갈래 철학|정본|운영] [--이름 "표시 이름"]');
    }
    return 0;
  }

  const i = 인자.indexOf('--이름');
  const 준이름 = i >= 0 ? 인자[i + 1] : null;
  const 사본강제 = 인자.includes('--사본');
  const 파일들 = 파일인자(인자);
  if (준이름 && 파일들.length > 1) {
    console.error('🔴 --이름 은 파일 하나에만 쓴다');
    return 1;
  }

  const 폴더_ = 갈래폴더경로;
  fs.mkdirSync(폴더_, { recursive: true });
  let 항목 = 목록읽기(폴더_);
  let 넣음 = 0;

  for (const f of 파일들) {
    const 절대 = path.resolve(f);
    if (!fs.existsSync(절대)) {
      console.error(`🔴 없는 파일: ${f}`);
      continue;
    }
    if (이미있나(항목, 절대)) {
      console.log(`· 이미 들어 있다 — 건너뜀: ${path.basename(절대)}`);
      continue;
    }

    const 링크냐 = 바로가기냐(절대) && !사본강제;
    const 베이스 = 안전한이름(준이름 || path.basename(절대, 링크냐 ? path.extname(절대) : ''));
    const 번호 = 다음번호(항목.map((x) => x.이름));
    const 파일명 = 링크냐 ? `${번호}_${베이스}.lnk` : `${번호}_${베이스}${path.extname(절대)}`;
    const 놓을곳 = path.join(폴더_, 파일명);

    if (링크냐) {
      바로가기만들기(놓을곳, 절대);
      console.log(`✅ 바로가기  ${파일명}\n              → ${path.relative(ROOT, 절대)}`);
    } else {
      fs.copyFileSync(절대, 놓을곳);
      console.log(`✅ 복사      ${파일명}`);
    }
    항목 = 목록읽기(폴더_);
    넣음 += 1;
    /* 새 판이 들어왔으면 같은 계열의 옛 판은 그 자리에서 걷는다 — 유호 지시 08-13
     * 「캐릭터 시안 1,2,3,4 있으면 1,2,3은 자동삭제되고 확정된 4만」. 사람이 나중에
     * 지우러 오는 해법은 안 지켜진다(철학 ㉡). 계열 판정이 확실한 것만 걷는다(아래 계열키). */
    옛판정리(폴더_, { 집행: true, 조용히: true, 방금: 파일명 });
    항목 = 목록읽기(폴더_);
  }

  if (넣음) console.log(`\n■ ${갈래들[갈래]}`);
  return 0;
}

module.exports = {
  다음번호, 바로가기냐, 안전한이름, 이미있나, 짝찾기, 정본후보, 폴더명, 갈래들, 갈래폴더,
  계열키, 기저키, 짝의심, 옛판고르기, 파일인자, 상태판정, 스냅샷원본, 정본판,
  임시링크이름, PS오류읽기, 바로가기만들기, 바로가기대상읽기,
};

if (require.main === module) process.exit(main(process.argv));
