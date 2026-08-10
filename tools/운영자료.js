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
 *   node tools/운영자료.js --갱신                     이미 들어간 **사본**을 정본 내용으로 다시 굽는다
 *
 * ②의 뒷문 — `--사본`으로 들어간 것은 바로가기가 아니라서 정본을 고쳐도 안 따라간다.
 * 2026-08-09 에 실제로 벌어졌다(정본의 주말가를 고쳤는데 유호님 화면은 옛값 그대로).
 * `--갱신`이 그 자리를 기계로 닫는다. 짝은 **번호를 뗀 파일명으로만** 찾고,
 * 후보가 0개거나 2개 이상이면 **덮지 않고 「출처 모름」으로 보고한다** — 짐작해서 덮는 것은 비가역이다.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
// 바탕화면을 찾는 **단 하나의 통로**(파일 안 사본 금지 — `tests/바탕화면통로.test.js` 가 문다).
const { 찾기: 바탕화면 } = require('./lib/바탕화면.js');

const 폴더명 = 'SYNK 운영자료';
const ROOT = path.resolve(__dirname, '..');

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

function ps(스크립트) {
  const enc = Buffer.from(PS_프리앰블 + 스크립트, 'utf16le').toString('base64');
  return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', enc], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'], // stderr 로 새는 CLIXML 을 stdout 과 섞지 않는다
  }).trim();
}

/* 바탕화면 실경로는 위 `./lib/바탕화면.js` 가 준다 — 여기 사본을 되살리면 회귀가 문다
 * (문자열만 적어도 문다. 옛 방식 이름을 주석에 남기는 것도 다음 사본의 씨앗이라 같이 막는다).
 * 이 파일이 쓰던 PowerShell 셸 확장은 레지스트리와 **같은 값**이었다(2026-08-10 실측 · 판정 근거는 통로 머리에).
 * 확장 실패를 조용히 넘기지 않는 몫(`폴백` → 아래 main 의 경고)은 그대로 승계한다. */

function 목록읽기(폴더) {
  if (!fs.existsSync(폴더)) return [];
  const sh = [];
  for (const n of fs.readdirSync(폴더)) {
    let 대상 = null;
    if (n.toLowerCase().endsWith('.lnk')) {
      try {
        대상 = ps(
          '$s=New-Object -ComObject WScript.Shell;' +
            `$l=$s.CreateShortcut(${JSON.stringify(path.join(폴더, n))});$l.TargetPath`
        );
      } catch { /* 못 읽으면 대상 미상 */ }
    }
    sh.push({ 이름: n, 대상 });
  }
  return sh;
}

function 바로가기만들기(링크경로, 대상) {
  ps(
    '$s=New-Object -ComObject WScript.Shell;' +
      `$l=$s.CreateShortcut(${JSON.stringify(링크경로)});` +
      `$l.TargetPath=${JSON.stringify(path.resolve(대상))};` +
      '$l.Description="SYNK 정본 바로가기 — 원본이 바뀌면 자동으로 최신이 열립니다";' +
      '$l.Save()'
  );
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

/* ── 본체 ─────────────────────────────────────────────────────── */

/** 이미 들어간 사본을 정본 내용으로 다시 굽는다. 바로가기는 원래 항상 최신이라 건드리지 않는다. */
function 갱신(폴더) {
  const 사본들 = 목록읽기(폴더).filter((it) => !it.이름.toLowerCase().endsWith('.lnk'));
  if (!사본들.length) {
    console.log(`■ ${폴더}\n  사본 0건 — 전부 바로가기라 갱신할 것이 없다`);
    return 0;
  }
  const 후보 = 정본후보();
  let 갱신함= 0, 이미최신= 0, 모름 = 0;
  for (const it of 사본들) {
    const 정본 = 짝찾기(it.이름, 후보);
    if (!정본) {
      console.log(`· 출처 모름 — 안 건드린다: ${it.이름}`);
      모름 += 1;
      continue;
    }
    const 놓을곳 = path.join(폴더, it.이름);
    if (fs.readFileSync(정본).equals(fs.readFileSync(놓을곳))) {
      console.log(`· 이미 최신: ${it.이름}`);
      이미최신 += 1;
      continue;
    }
    fs.copyFileSync(정본, 놓을곳);
    console.log(`✅ 갱신  ${it.이름}\n         ← ${path.relative(ROOT, 정본)}`);
    갱신함 += 1;
  }
  console.log(`\n■ ${폴더}\n  사본 ${사본들.length}건 — 갱신 ${갱신함} · 이미 최신 ${이미최신} · 출처 모름 ${모름}`);
  return 0;
}

function main(argv) {
  const 인자 = argv.slice(2);
  const { 경로: 바탕, 폴백 } = 바탕화면();
  const 폴더 = path.join(바탕, 폴더명);
  if (폴백) {
    console.error('⚠ 바탕화면 실경로 확장에 실패해 폴백을 썼다 — 여기가 유호님 화면이 맞는지 눈으로 확인할 것');
    console.error(`  폴백 경로: ${폴더}`);
  }

  if (인자.includes('--갱신')) return 갱신(폴더);

  if (인자.includes('--목록') || 인자.length === 0) {
    const 항목 = 목록읽기(폴더);
    if (!항목.length) {
      console.log(`■ ${폴더}\n  (비었거나 아직 없다)`);
      if (인자.length === 0) console.log('\n쓰기: node tools/운영자료.js <파일...> [--이름 "표시 이름"]');
      return 0;
    }
    console.log(`■ ${폴더} — ${항목.length}건`);
    for (const it of 항목) {
      const 꼬리 = it.대상 ? `  → ${it.대상}${fs.existsSync(it.대상) ? '' : '  🔴 대상 없음'}` : '';
      console.log(`  · ${it.이름}${꼬리}`);
    }
    return 0;
  }

  const i = 인자.indexOf('--이름');
  const 준이름 = i >= 0 ? 인자[i + 1] : null;
  const 사본강제 = 인자.includes('--사본');
  const 파일들 = 인자.filter((a, k) => !a.startsWith('--') && k !== i + 1);
  if (준이름 && 파일들.length > 1) {
    console.error('🔴 --이름 은 파일 하나에만 쓴다');
    return 1;
  }

  fs.mkdirSync(폴더, { recursive: true });
  let 항목 = 목록읽기(폴더);
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
    const 놓을곳 = path.join(폴더, 파일명);

    if (링크냐) {
      바로가기만들기(놓을곳, 절대);
      console.log(`✅ 바로가기  ${파일명}\n              → ${path.relative(ROOT, 절대)}`);
    } else {
      fs.copyFileSync(절대, 놓을곳);
      console.log(`✅ 복사      ${파일명}`);
    }
    항목 = 목록읽기(폴더);
    넣음 += 1;
  }

  if (넣음) console.log(`\n■ ${폴더}`);
  return 0;
}

module.exports = { 다음번호, 바로가기냐, 안전한이름, 이미있나, 짝찾기, 정본후보, 폴더명 };

if (require.main === module) process.exit(main(process.argv));
