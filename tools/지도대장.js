#!/usr/bin/env node
// 지도대장 — 바탕화면 `SYNK_지도` 폴더(사본)와 repo 정본이 갈라지지 않게 잰다.
//
// 왜 있나 (2026-08-04 유호님 확정: "발행본은 버리고 「폴더 사본 + repo 정본」 2곳만 유지"):
//   그날 사본이 셋이었고 **셋 다 갈라져 있었다.**
//     ① 아티팩트 발행본 — 이 계정에서 보이지도 않아(list 0건·URL 미기록) **영원히 갱신 불가**한 채
//        옛 금지선 문구로 떠 있었다. 갱신할 수 없는 사본은 낡는 게 아니라 처음부터 거짓말이다.
//     ② 정본만 고치고 폴더 사본을 안 고쳤다 — **유호님이 눈으로 잡아냈다.** 기계가 아니라 사람이
//        잡고 있었다는 뜻이고, 그건 다음번엔 안 잡힌다는 뜻이다.
//     ③ `_읽어보세요.md` 표는 지도 3종을 적었는데 폴더엔 2종뿐이었다(effort 지도 부재).
//        손으로 적은 목록은 실제와 갈라진다 — F080 과 같은 자리라 **표를 생성으로 바꿨다.**
//   사본이 하나 줄면 낡을 곳이 하나 준다. 남은 둘은 사람이 아니라 이 도구가 잰다.
//
// 엣지 표기는 doc-graph 와 **같은 것을 쓴다**(표기를 둘로 만들면 그 둘이 갈라진다).
// 지도 HTML 아무 곳에 한 줄:
//   <!-- 파생: docs/AI_스택_가이드.md@4aef3b3 -->
// `@` 뒤는 **정본을 마지막으로 확인한 커밋**이다. 정본이 그 뒤로 커밋되면 이 사본은 저절로 '낡음'이
// 된다 — 사실이 모순되는 대신 **만료**한다. 도장이 없으면 '최신'이 아니라 **'모름'**으로 센다.
//
// ⚠ 왜 mtime 으로 안 재나: 이 폴더는 OneDrive 아래라 **동기화가 mtime 을 흔든다.**
//   정본 신선도는 커밋 해시로(사실), PDF 신선도는 `.지도대장.json` 에 적어둔 **HTML 해시**로 잰다.
//   기록이 없으면 mtime 으로 폴백하되 그 사실을 결과에 밝힌다(모름을 통과로 바꾸지 않는다).
//
// ⚠ repo **밖** 폴더를 읽으므로 CI·클라우드 세션엔 폴더가 없다. 그때는 통과가 아니라 **skip**으로
//   드러낸다(통과와 미실행이 같은 모양이면 안 된다 · CLAUDE.md 신뢰성 조항).
//   탐지력은 tests/지도대장.test.js 의 픽스처가 지고, 실폴더에서는 거짓양성만 검사한다.
//
// 사용법:
//   node tools/지도대장.js                 리포트(사람용)
//   node tools/지도대장.js --check         문제가 있으면 exit 1 (CI·훅)
//   node tools/지도대장.js --bake [이름]   PDF 재생성(+폰트 게이트). 이름 생략 시 낡은 것 전부
//   node tools/지도대장.js --stamp [이름]  정본 도장을 현재 커밋으로 = "지금 맞다" 선언
//   node tools/지도대장.js --readme        _읽어보세요.md 의 지도 표를 폴더에서 다시 생성
//   node tools/지도대장.js --json
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const 활자주입 = require('./lib/활자주입.js');   // 마커·주입 판정은 한 곳에서만 온다
const { 찾기: 바탕화면찾기 } = require('./lib/바탕화면.js');   // 바탕화면 실경로는 이 통로 하나뿐
const { 갈래폴더 } = require('./운영자료.js');   // 폴더 이름 정본(글자 사본 금지 · require 부작용 0)

/** repo 루트 — 환경변수가 이음매다(테스트가 픽스처 git 저장소로 「낡음」 탐지력을 CI에서 잰다.
 *  실저장소 이력은 CI에서 shallow 라 조상 판정이 조용히 어긋날 수 있다 — 그래서 픽스처가 진다). */
const ROOT = path.resolve(process.env.SYNK_지도_ROOT || path.join(__dirname, '..'));
const 상태파일 = '.지도대장.json';

/** 지도 폴더 — 환경변수가 이음매다(테스트 픽스처가 실폴더를 안 건드리고 탐지력만 잰다). */
function 지도폴더() {
  const 덮어쓰기 = process.env.SYNK_지도_DIR;
  if (덮어쓰기) return path.resolve(덮어쓰기);
  /* 🔴 자리는 실물을 따라간다 — 유호님이 2026-08-13 에 이 폴더를 `SYNK 운영자료\_자료\` 아래로 옮겼다.
   * 옛 기본값(바탕화면 최상위)을 그대로 두면 도구가 「폴더가 없다」로 skip 해 대장·읽어보세요가
   * 영영 안 갱신되고, 새 지도를 굽는 날 **최상위에 두 번째 폴더가 생겨 갈라진다** —
   * 같은 날 철학 폴더에서 실제로 벌어진 사고다(00·01 이 두 자리에서 서로 다른 내용으로 남았다).
   * ⚠ 바탕화면은 `~/Desktop` 이 아니라 `~/OneDrive/Desktop` 이다(리디렉션 · ~/Desktop 은 빈 껍데기)
   *   — 그 판정은 위 통로가 지고, 통로가 못 찾은 날만 옛 조립으로 내려간다.
   *
   * 🔴 [2026-08-18] 이 자리는 **던지면 안 된다** — 여기서 「없다」를 알리는 통로는 예외가 아니라
   *   **없는 경로**다. 실측(CI 모사 · 리눅스 클라우드): 바탕화면이 없는 기계에서 `경로()` 가 던져
   *   `tests/지도대장.test.js:297` 이 fail 로 떴는데, 그 검사도·`시스템대장 --render` 도·`훑기()` 도
   *   **셋 다 「폴더 없음 → skip」 절을 이미 갖고 있었다.** 던지는 통로가 그 절보다 앞서 죽어서
   *   방어 셋이 한꺼번에 눈이 멀었다(F296 · 「실저장소 검사는 fail 아닌 skip 으로 드러낸다」).
   *   ⚠ 옛 줄의 `|| 옛조립` 폴백은 **원리상 한 번도 안 돌았다** — `경로()` 는 못 찾으면 null 이
   *   아니라 던지므로 `||` 에 닿지 못한다. 폴백이 있는 얼굴로 없는 자리였다.
   *   ⚠ 대가: 못 찾은 기계에서 이 함수는 **실존하지 않는 경로**를 준다. 굽는 자리가 그걸 만들어
   *   쓰면 「없는 곳에 산출물이 나간다」가 되므로, 쓰기 통로는 전부 `훑기().있음`·`existsSync`
   *   뒤에만 산다(위 세 호출부가 그 모양이고, `tests/지도대장.test.js` 가 못박는다). */
  const 찾음 = 바탕화면찾기();
  const 바탕 = 찾음.존재 ? 찾음.경로 : (찾음.경로 || path.join(os.homedir(), 'OneDrive', 'Desktop'));
  // 지도는 「그날 보는 자료」라 운영 갈래에 산다. HTML+PDF 쌍이라 평평하게 풀면 개수가 두 배로
  // 보여서, 운영 갈래 **안의** 폴더로 둔다(유호 확정 폴더 수는 최상위 얘기다).
  // 2026-08-17 재편으로 뿌리가 바탕화면 자체가 됐다 — 갈래 값이 「SYNK LAB\운영」을 들고 있다.
  return path.join(갈래폴더(바탕, '운영'), 'SYNK_지도');
}

/* 엣지 정규식 — doc-graph 와 같은 표기.
 * ⚠ 정본 경로에 한글이 들어가므로 `[\w/.-]` 같은 ASCII 문자군을 쓰면 **한글 경로를 통째로 놓친다**
 *   (이 저장소 도구가 실제로 세 번 당한 자리). `>` 아닌 것 전부로 받고 나중에 다듬는다. */
const 엣지_RE = /<!--\s*파생\s*:\s*([^>]+?)\s*-->/g;

/** 지도 HTML 하나에서 정본 선언을 읽는다 → [{ 정본, 도장 }] */
function 엣지읽기(html) {
  const out = [];
  엣지_RE.lastIndex = 0;
  let m;
  while ((m = 엣지_RE.exec(html)) !== null) {
    for (const 조각 of m[1].split(',')) {
      const s = 조각.trim();
      if (!s) continue;
      const at = s.lastIndexOf('@');
      // `@` 가 경로 안에 있을 수도 있으니 마지막 것만, 그리고 뒤가 커밋처럼 생겼을 때만 도장으로 본다
      if (at > 0 && /^[0-9a-f]{7,40}$/i.test(s.slice(at + 1))) {
        out.push({ 정본: s.slice(0, at), 도장: s.slice(at + 1).toLowerCase() });
      } else {
        out.push({ 정본: s, 도장: null });
      }
    }
  }
  return out;
}

function git(args, opts) {
  // core.quotepath=false — 끄지 않으면 한글 경로가 "\354\203\201…" 로 이스케이프돼 매칭이 통째로 빗나간다
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...(opts || {}),
  }).trim();
}

/** 정본의 마지막 커밋 해시(없으면 null) */
function 정본커밋(정본) {
  try {
    const h = git(['log', '-1', '--format=%H', '--', 정본]);
    return h || null;
  } catch (_) {
    return null;
  }
}

/** a 커밋이 b 커밋의 조상인가(= b 가 a 보다 새롭다) */
function 조상인가(a, b) {
  if (!a || !b) return false;
  const r = spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: ROOT, stdio: 'ignore' });
  return r.status === 0;
}

const 해시 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

function 상태읽기(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 상태파일), 'utf8'));
  } catch (_) {
    return {};
  }
}
function 상태쓰기(dir, 상태) {
  fs.writeFileSync(path.join(dir, 상태파일), JSON.stringify(상태, null, 2) + '\n', 'utf8');
}

/**
 * 폴더를 훑어 지도 목록을 만든다.
 * 반환: { 있음, dir, 지도들: [{ 이름, html, pdf, 엣지들, 문제[] }] }
 * 폴더가 없으면 `있음:false` — 호출부가 **통과와 구분**할 수 있어야 한다.
 */
function 훑기(dir) {
  dir = dir || 지도폴더();
  if (!fs.existsSync(dir)) return { 있음: false, dir, 지도들: [] };

  const 상태 = 상태읽기(dir);
  const 지도들 = [];

  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.html')) continue;
    const 이름 = f.replace(/\.html$/, '');
    const htmlPath = path.join(dir, f);
    const pdfPath = path.join(dir, 이름 + '.pdf');
    const buf = fs.readFileSync(htmlPath);
    const html = buf.toString('utf8');
    const 지도 = {
      이름,
      html: htmlPath,
      pdf: fs.existsSync(pdfPath) ? pdfPath : null,
      html해시: 해시(buf),
      엣지들: 엣지읽기(html),
      문제: [],
    };

    // ① 정본 선언 — 어디서 왔는지 모르는 사본은 그 자체가 결함이다(갱신할 방법이 없다)
    if (!지도.엣지들.length) {
      지도.문제.push(
        `정본 선언이 없다 — 이 지도가 무엇의 사본인지 기계가 모른다.\n` +
        `     → HTML 안에 한 줄: <!-- 파생: docs/….md -->  (그 뒤 node tools/지도대장.js --stamp "${이름}")`
      );
    }

    for (const e of 지도.엣지들) {
      const 절대 = path.join(ROOT, e.정본);
      if (!fs.existsSync(절대)) {
        지도.문제.push(`정본이 저장소에 없다: ${e.정본} — 경로가 바뀌었거나 지워졌다`);
        continue;
      }
      const 현재 = 정본커밋(e.정본);
      if (!e.도장) {
        지도.문제.push(
          `정본 도장이 없다: ${e.정본} — 이 사본이 아직 맞는지 **모른다**(최신이 아니라 모름).\n` +
          `     → node tools/지도대장.js --stamp "${이름}"`
        );
      } else if (현재 && e.도장 !== 현재.slice(0, e.도장.length) && 조상인가(e.도장, 현재)) {
        let 몇건 = '';
        try { 몇건 = git(['rev-list', '--count', `${e.도장}..${현재}`, '--', e.정본]); } catch (_) {}
        지도.문제.push(
          `사본이 낡았다: ${e.정본} 이(가) 도장(${e.도장}) 이후 ${몇건 || '?'}회 커밋됐다.\n` +
          `     → 정본 변경을 이 지도에 반영한 뒤 --stamp, 반영이 필요 없으면 그냥 --stamp`
        );
      }
    }

    // ② PDF 짝 — 유호님이 실제로 여는 건 PDF다. 없으면 지도가 반쪽이다
    if (!지도.pdf) {
      지도.문제.push(`PDF 짝이 없다 (${이름}.pdf) — → node tools/지도대장.js --bake "${이름}"`);
    } else {
      const 기록 = 상태[f];
      if (기록 && 기록.html해시) {
        if (기록.html해시 !== 지도.html해시) {
          지도.문제.push(
            `PDF가 낡았다 — HTML이 마지막 굽기 이후 바뀌었다(해시 불일치).\n` +
            `     → node tools/지도대장.js --bake "${이름}"`
          );
        }
      } else {
        // 기록이 없다 = 모름. mtime 으로 폴백하되 **모름이라고 말한다**
        const 폴백 =
          fs.statSync(pdfPath).mtimeMs + 2000 < fs.statSync(htmlPath).mtimeMs
            ? `PDF가 HTML보다 오래됐다(mtime 기준)`
            : null;
        지도.문제.push(
          (폴백 ? `${폴백} · ` : '') +
          `굽기 기록이 없어 PDF 신선도를 **확정할 수 없다**(OneDrive 가 mtime 을 흔든다).\n` +
          `     → 한 번 구워 기록을 남긴다: node tools/지도대장.js --bake "${이름}"`
        );
      }

      // ③ 폰트 게이트 — 화면에선 멀쩡하고 **PDF에서만** 브랜드 서체가 죽는다(실측된 사고 2건)
      const 폰트 = 임베드폰트(pdfPath);
      const 빠짐 = 폰트 === null ? [] : 빠진서체(폰트);
      if (빠짐.length) {
        지도.문제.push(
          `PDF에 브랜드 서체가 없다: ${빠짐.join('·')} — 이 기계에 깔린 글꼴로 나갔다는 뜻이다.\n` +
          `     임베드된 것: ${폰트.join(', ') || '(없음)'}\n` +
          `     고치는 법: node tools/지도대장.js --bake "${이름}" (굽기가 폰트를 HTML 에 실어 넣는다)`
        );
      }
    }

    지도들.push(지도);
  }

  return { 있음: true, dir, 지도들 };
}

/** PDF에서 임베드 폰트 이름을 뽑는다(못 읽으면 null — 없음과 구분한다)
 *  ⚠ 평문 `/BaseFont` 만 훑으면 **압축 오브젝트 스트림 안의 폰트를 통째로 놓친다.**
 *    2026-08-06 실측: 같은 PDF 를 평문으로 세면 「굴림체 1종」, 스트림을 풀면 SUIT 4종이 나왔다.
 *    그 오독으로 「브랜드 폰트 0건」이라 보고했다 — 안 보이는 것을 없는 것으로 세면 안 된다. */
function 임베드폰트(pdfPath) {
  let buf;
  try { buf = fs.readFileSync(pdfPath); } catch (_) { return null; }
  const out = new Set();
  const 훑기 = (s) => {
    const re = /\/(?:BaseFont|FontName)\s*\/([A-Za-z0-9+,#._-]+)/g;
    let m;
    while ((m = re.exec(s)) !== null) out.add(m[1].replace(/^[A-Z]{6}\+/, ''));
  };

  const s = buf.toString('latin1');
  훑기(s);

  // stream…endstream 을 전부 inflate 시도한다(이미지·비압축은 그냥 실패하고 넘어간다)
  let i = 0;
  while ((i = s.indexOf('stream', i)) !== -1) {
    let start = i + 6;
    if (s[start] === '\r') start++;
    if (s[start] === '\n') start++;
    const end = s.indexOf('endstream', start);
    if (end === -1) break;
    try { 훑기(zlib.inflateSync(buf.subarray(start, end)).toString('latin1')); } catch (_) {}
    i = end + 9;
  }
  return [...out];
}

/* ── 브랜드 서체 게이트 ──────────────────────────────────────────────
 * 정본 3종 = SUIT(한글) · Inter Tight(라틴·키릴) · DM Mono(계기판). DESIGN.md §3.
 * 🔑 Inter Tight·DM Mono 는 **이 PC 에 설치돼 있지 않다** — 그래서 PDF 에 이 이름이 보이면
 *   그건 임베드가 실제로 먹혔다는 뜻이다(설치 폰트로는 통과할 수 없는 검사다). */
const 브랜드서체 = [
  { 이름: 'SUIT', re: /SUIT/i },
  { 이름: 'Inter Tight', re: /InterTight/i },
  { 이름: 'DM Mono', re: /DMMono/i },
];
const 빠진서체 = (폰트) => 브랜드서체.filter((f) => !폰트.some((n) => f.re.test(n))).map((f) => f.이름);

/** 헤드리스 크롬 경로 — 없으면 null */
function 크롬() {
  const 후보 = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  return 후보.find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } }) || null;
}

/** 🔴 SUIT 는 **700(Bold) 원본이 폰트 폴더에 없다**(`SUIT-Bold.otf` 미투입 — 유호님 몫으로 열려 있다).
 *  지도 CSS 는 700 을 열 곳 넘게 쓰는데, 그 굵기가 없으면 크롬은 800 으로 낮춰 그리는 게 아니라
 *  **굵은 한글을 통째로 Noto Sans KR 로 떨어뜨린다**(2026-08-06 실측 — 임베드했는데도 Noto 3종이 나왔다).
 *  그래서 ExtraBold 면이 700 까지 맡게 한다. 원본이 들어오면 이 함수는 지운다. */
const SUIT700 = (html) => html.replace(
  "@font-face{font-family:'SUIT';font-style:normal;font-weight:800;",
  "@font-face{font-family:'SUIT';font-style:normal;font-weight:700 800;");

/** python + fontTools 를 찾는다(없으면 null) — `tools/발표물빌드.js` 와 같은 통로 */
function 파이썬() {
  for (const cmd of ['python', 'py', 'python3']) {
    const r = spawnSync(cmd, ['-c', 'import fontTools, brotli'], { encoding: 'utf8' });
    if (r.status === 0) return cmd;
  }
  return null;
}

/**
 * 브랜드 폰트를 HTML 에 **실어 넣는다**(굽기 직전 · 이미 들어 있으면 건너뛴다).
 *
 * 왜: 지도 HTML 들은 폰트를 **이름으로만** 불렀다. 그러면 그 폰트가 깔린 기계에서만 맞고,
 *   유호님 폰·인쇄소·다른 PC 에서는 조용히 맑은고딕/굴림으로 떨어진다(2026-08-06 실측).
 *   화면은 늘 멀쩡해 보이므로 사람 눈으로는 영원히 안 잡힌다.
 * 🔑 스택도 함께 고쳐야 한다 — 임베드되는 패밀리 이름은 `SUIT` 인데 소스는 `'SUIT Variable'`
 *   (=**설치본 이름**)을 부르고 있었다. 이름이 어긋나면 임베드해도 설치본으로 돌아간다.
 * 🔑 `'DM Mono'` 는 라틴 전용(381 글리프)이라 모노 자리의 한글은 `SUIT` 가 받는다.
 */
function 폰트심기(htmlPath) {
  let html;
  try { html = fs.readFileSync(htmlPath, 'utf8'); } catch (e) { return { ok: false, 이유: `HTML 을 못 읽었다: ${e.message}` }; }
  if (/@font-face/.test(html)) {                 // 이미 심겨 있다 — 굵기 범위만 손봐 주고 나간다
    const 고침 = SUIT700(html);
    if (고침 !== html) { fs.writeFileSync(htmlPath, 고침); return { ok: true, 보수: true }; }
    return { ok: true, 건너뜀: true };
  }

  const 전 = html;
  html = html.replace(/(--sans|--synk-font)\s*:[^;]*;/g, "$1: 'Inter Tight','SUIT',sans-serif;");
  html = html.replace(/(--mono|--synk-font-mono)\s*:[^;]*;/g, "$1: 'DM Mono','SUIT',monospace;");
  html = html.replace(/font-family:\s*'Inter Tight'[^;]*;/g, "font-family:'Inter Tight','SUIT',sans-serif;");
  html = html.replace(/font-family:\s*'DM Mono'[^;]*;/g, "font-family:'DM Mono','SUIT',monospace;");
  // ⚠ no-op ≠ 부재 — 처음부터 정본 스택으로 쓴 HTML 은 위 치환이 전부 제자리라 `html === 전` 이 된다
  //   (2026-08-07 실측: 새 지도 굽기가 여기서 죽어 소스를 'SUIT Variable' 표기로 우회했다).
  //   게이트의 목적은 「이 HTML 이 브랜드 스택을 쓰는가」이므로 정본 문자열이 있으면 진행한다.
  if (html === 전 && !html.includes("'Inter Tight','SUIT'")) {
    return { ok: false, 이유: `브랜드 폰트 스택을 못 찾았다 — 이 HTML 은 다른 방식으로 서체를 지정한다.\n  손으로 \`'Inter Tight','SUIT'\` / \`'DM Mono','SUIT'\` 로 고친 뒤 다시 --bake.` };
  }
  if (!html.includes('<style>')) return { ok: false, 이유: '<style> 이 없어 @font-face 를 넣을 자리가 없다' };

  const py = 파이썬();
  if (!py) return { ok: false, 이유: 'python + fontTools + brotli 를 못 찾았다 — `pip install fonttools brotli`' };
  const EMBED = path.join(__dirname, '..', 'docs', 'tools', '브랜드폰트_임베드.py');
  if (!fs.existsSync(EMBED)) return { ok: false, 이유: `임베드 스크립트가 없다: ${EMBED}` };

  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-font-'));
  const src = path.join(임시, 'src.html');
  const out = path.join(임시, 'out.html');
  fs.writeFileSync(src, html.replace('<style>', `<style>\n${활자주입.마커}`));

  // ⚠ 지도는 ✅🔴⛔ 같은 이모지를 상태 언어로 쓴다 — 어느 텍스트 폰트에도 없고 OS 가 컬러로 그린다.
  //   그걸 오류로 치면 지도는 영원히 임베드를 못 받는다. 대신 무엇이 폴백되는지 아래에 찍는다.
  const r = spawnSync(py, [EMBED, src, out, '--폴백허용'], { encoding: 'utf8', timeout: 300000 });
  const 폴백 = String(r.stdout || '').split('\n').filter((l) => l.startsWith('⚠'));
  if (r.status !== 0 || !fs.existsSync(out)) {
    return { ok: false, 이유: `폰트 임베드 실패: ${String(r.stderr || r.stdout || '').split('\n').slice(-3).join(' ').trim()}` };
  }
  let 결과 = fs.readFileSync(out, 'utf8');
  if (!활자주입.주입됐나(결과)) {
    return { ok: false, 이유: '임베드 산출물에 @font-face 가 없다(마커가 그대로 남았다)' };
  }

  const 전범위 = 결과;
  결과 = SUIT700(결과);
  if (결과 === 전범위) return { ok: false, 이유: 'SUIT 800 면을 못 찾았다 — 700 굵기가 폴백으로 샌다(임베드 스크립트 FACES 확인)' };

  fs.writeFileSync(htmlPath, 결과);           // 화면판·재인쇄용 HTML 도 같이 고쳐진다
  try { fs.rmSync(임시, { recursive: true, force: true }); } catch (_) {}
  return { ok: true, 심음: true, 폴백 };
}

/**
 * PDF 굽기 — 임시 폴더에 굽고 복사한다.
 * ⚠ 크롬에게 OneDrive 폴더로 **직접** 쓰게 하면 액세스 거부(0x5)가 난다(2026-08-04 실측).
 *   그때 오류 문구는 "Failed to write file" 뿐이라 원인이 안 보인다 — 그래서 통로를 아예 우회한다.
 */
function 굽기(htmlPath) {
  const bin = 크롬();
  if (!bin) return { ok: false, 이유: '크롬을 못 찾았다(CHROME_PATH 로 지정 가능)' };

  const 심기 = 폰트심기(htmlPath);
  if (!심기.ok) return 심기;

  const 이름 = path.basename(htmlPath, '.html');
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-map-'));
  const 임시pdf = path.join(임시, 'out.pdf');
  const url = 'file:///' + htmlPath.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');

  const r = spawnSync(bin, [
    // ⚠ `--virtual-time-budget` 이 없으면 **임베드 폰트가 로드되기 전에** 인쇄가 끝난다 —
    //   PDF 는 조용히 폴백(굴림체)으로 나가고 크기만 1/15 로 줄어든다(2026-08-06 실측).
    //   설치된 폰트로 그릴 때는 티가 안 나서 여태 안 보였다.
    '--headless', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000',
    `--print-to-pdf=${임시pdf}`, url,
  ], { encoding: 'utf8', timeout: 120000 });

  if (!fs.existsSync(임시pdf)) {
    return { ok: false, 이유: `크롬이 PDF를 못 만들었다: ${String(r.stderr || '').split('\n').slice(-3).join(' ').trim()}` };
  }

  // 폰트 게이트를 **복사 전에** 통과시킨다 — 깨진 판으로 멀쩡한 판을 덮지 않는다
  const 폰트 = 임베드폰트(임시pdf) || [];
  const 빠짐 = 빠진서체(폰트);
  if (빠짐.length) {
    return {
      ok: false,
      이유: `브랜드 서체가 PDF에 안 들어가 굽기를 중단했다: ${빠짐.join('·')} — 기존 PDF는 그대로 뒀다.\n` +
            `  임베드된 것: ${폰트.join(', ') || '(없음)'}\n` +
            `  HTML 의 폰트 스택이 임베드된 패밀리 이름('Inter Tight'·'SUIT'·'DM Mono')을 부르는지 본다.`,
    };
  }

  const 대상 = path.join(path.dirname(htmlPath), 이름 + '.pdf');
  fs.copyFileSync(임시pdf, 대상);
  try { fs.rmSync(임시, { recursive: true, force: true }); } catch (_) {}

  const dir = path.dirname(htmlPath);
  const 상태 = 상태읽기(dir);
  상태[이름 + '.html'] = { html해시: 해시(fs.readFileSync(htmlPath)), 폰트 };
  상태쓰기(dir, 상태);

  return { ok: true, 대상, 폰트, 크기: fs.statSync(대상).size };
}

/** 정본 도장 갱신 — **파생 주석 안만** 정본 현재 커밋으로 다시 쓴다.
 *  ⚠ 예전엔 파일 전역 split/join 이었다 — 본문이 제 정본 경로를 언급하는 지도
 *    (DESIGN.md 전후비교)의 보이는 글·CSS 주석에까지 도장이 박혔다(2026-08-05 실측 2건).
 *    주석 밖 도장은 다음 stamp 가 안 고치는 죽은 복제라, 쓰는 범위를 주석으로 못박고
 *    주석은 치환이 아니라 파싱→재조립한다(경로가 다른 경로의 접두어여도 안 샌다). */
function 도장찍기(htmlPath) {
  const 원본 = fs.readFileSync(htmlPath, 'utf8');
  if (!엣지읽기(원본).length) return { ok: false, 이유: '정본 선언(<!-- 파생: … -->)이 없다 — 먼저 심어야 한다' };

  const 찍은것 = [];
  // 바깥 순회는 클론으로 — 안의 엣지읽기가 공용 엣지_RE.lastIndex 를 움직여도 안 어긋난다
  const html = 원본.replace(new RegExp(엣지_RE.source, 엣지_RE.flags), (주석) => {
    const 조각들 = 엣지읽기(주석).map((e) => {
      const 현재 = 정본커밋(e.정본);
      if (!현재) {
        찍은것.push(`${e.정본} → (커밋 이력 없음, 건너뜀)`);
        return e.도장 ? `${e.정본}@${e.도장}` : e.정본;
      }
      const 짧게 = 현재.slice(0, 7);
      찍은것.push(`${e.정본} @${짧게}`);
      return `${e.정본}@${짧게}`;
    });
    return 조각들.length ? `<!-- 파생: ${조각들.join(', ')} -->` : 주석;
  });
  fs.writeFileSync(htmlPath, html, 'utf8');
  return { ok: true, 찍은것 };
}

/** _읽어보세요.md 의 지도 표를 폴더에서 **생성**한다(손으로 적으면 실제와 갈라진다) */
function 표만들기(지도들) {
  const 줄 = ['| 지도 | 정본 |', '|---|---|'];
  for (const m of 지도들) {
    const 제목 = m.이름.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(/_/g, ' ');
    const 정본 = m.엣지들.length
      ? m.엣지들.map((e) => `\`${e.정본}\` (저장소)`).join(' · ')
      : '**선언 없음** — 클로드에게 알려주세요';
    줄.push(`| ${제목} | ${정본} |`);
  }
  return 줄.join('\n');
}

const 표_시작 = '<!-- 지도표:시작 (node tools/지도대장.js --readme 가 생성한다 · 손으로 고치지 말 것) -->';
const 표_끝 = '<!-- 지도표:끝 -->';

function 리드미갱신(dir, 지도들) {
  const p = path.join(dir, '_읽어보세요.md');
  if (!fs.existsSync(p)) return { ok: false, 이유: '_읽어보세요.md 가 없다' };
  const 원본 = fs.readFileSync(p, 'utf8');
  const 새표 = `${표_시작}\n\n${표만들기(지도들)}\n\n${표_끝}`;
  const re = new RegExp(`${표_시작.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${표_끝.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  let 새것;
  if (re.test(원본)) {
    새것 = 원본.replace(re, 새표);
  } else {
    // 첫 실행 — 기존 손 표(| 지도 | 정본 |)를 찾아 대체한다
    const 손표 = /\| *지도 *\| *정본 *\|[\s\S]*?(?=\n\n|\n##|$)/;
    새것 = 손표.test(원본) ? 원본.replace(손표, 새표) : 원본.trimEnd() + '\n\n' + 새표 + '\n';
  }
  if (새것 === 원본) return { ok: true, 바뀜: false };
  fs.writeFileSync(p, 새것, 'utf8');
  return { ok: true, 바뀜: true };
}

/* ───────────────── CLI ───────────────── */

function 리포트(결과, { 훅 } = {}) {
  if (!결과.있음) {
    const 글 = `[지도대장] skip — 지도 폴더가 없다: ${결과.dir}\n` +
      `  (CI·클라우드 세션엔 이 폴더가 없다. **통과가 아니라 미실행**이다.)`;
    return { 글, 문제수: 0, skip: true };
  }
  const 줄 = [];
  let 문제수 = 0;
  for (const m of 결과.지도들) {
    문제수 += m.문제.length;
    if (훅 && !m.문제.length) continue;
    줄.push(`${m.문제.length ? '🔴' : '✅'} ${m.이름}`);
    for (const p of m.문제) 줄.push(`   · ${p}`);
  }
  if (!결과.지도들.length) 줄.push('(지도 0건 — 폴더는 있는데 .html 이 없다)');
  const 머리 = `[지도대장] ${결과.dir}\n지도 ${결과.지도들.length}종 · 문제 ${문제수}건` +
    (문제수 ? '' : ' — 폴더 사본과 repo 정본이 맞다');
  return { 글: [머리, ...줄].join('\n'), 문제수, skip: false };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const 값 = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  const dir = 지도폴더();

  if (has('--bake') || has('--stamp')) {
    const 명령 = has('--bake') ? '--bake' : '--stamp';
    const 결과 = 훑기(dir);
    if (!결과.있음) { console.log(리포트(결과).글); process.exit(0); }
    const 지정 = 값(명령);
    const 대상 = 지정 ? 결과.지도들.filter((m) => m.이름.includes(지정)) : 결과.지도들;
    if (!대상.length) { console.error(`대상 없음: ${지정 || '(전체)'}`); process.exit(1); }
    let 실패 = 0;
    for (const m of 대상) {
      const r = 명령 === '--bake' ? 굽기(m.html) : 도장찍기(m.html);
      if (r.ok) {
        console.log(명령 === '--bake'
          ? `✅ ${m.이름}.pdf 재생성 (${r.크기.toLocaleString()} 바이트 · 폰트 ${r.폰트.length}종)`
          : `✅ ${m.이름} 도장: ${r.찍은것.join(' · ')}`);
        // ⚠ 도장은 **HTML 을 고친다** — 이미 구운 뒤에 찍으면 그 PDF 가 그 자리에서 낡는다.
        //   순서는 stamp → bake 다. 2026-08-06 에 한 세션에서 세 번 밟은 자리라 여기서 말해 준다.
        if (명령 === '--stamp' && 상태읽기(path.dirname(m.html))[path.basename(m.html)]) {
          console.log(`   → 도장이 HTML 을 바꿨다. 이어서: node tools/지도대장.js --bake "${m.이름}"`);
        }
      } else {
        실패 += 1;
        console.error(`🔴 ${m.이름} — ${r.이유}`);
      }
    }
    process.exit(실패 ? 1 : 0);
  }

  if (has('--readme')) {
    const 결과 = 훑기(dir);
    if (!결과.있음) { console.log(리포트(결과).글); process.exit(0); }
    const r = 리드미갱신(dir, 결과.지도들);
    console.log(r.ok ? (r.바뀜 ? '✅ _읽어보세요.md 표 갱신' : '변경 없음 — 표가 이미 폴더와 같다') : `🔴 ${r.이유}`);
    process.exit(r.ok ? 0 : 1);
  }

  const 결과 = 훑기(dir);
  if (has('--json')) {
    console.log(JSON.stringify({ ...결과, 지도들: 결과.지도들.map((m) => ({ ...m, html: path.basename(m.html) })) }, null, 2));
    process.exit(0);
  }
  const r = 리포트(결과, { 훅: has('--hook') });
  if (has('--hook') && !r.문제수 && !r.skip) process.exit(0);
  console.log(r.글);
  process.exit(has('--check') && r.문제수 ? 1 : 0);
}

module.exports = { 지도폴더, 훑기, 엣지읽기, 굽기, 도장찍기, 표만들기, 리드미갱신, 임베드폰트, 빠진서체, 폰트심기, 리포트 };
