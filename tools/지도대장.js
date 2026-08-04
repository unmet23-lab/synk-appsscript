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
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 상태파일 = '.지도대장.json';

/** 지도 폴더 — 환경변수가 이음매다(테스트 픽스처가 실폴더를 안 건드리고 탐지력만 잰다). */
function 지도폴더() {
  const 덮어쓰기 = process.env.SYNK_지도_DIR;
  if (덮어쓰기) return path.resolve(덮어쓰기);
  // ⚠ 바탕화면은 `~/Desktop` 이 아니라 `~/OneDrive/Desktop` 이다(리디렉션 · ~/Desktop 은 빈 껍데기)
  return path.join(os.homedir(), 'OneDrive', 'Desktop', 'SYNK_지도');
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

      // ③ 폰트 게이트 — 화면에선 멀쩡하고 **PDF에서만** 계기판 성격이 죽는다(실측된 사고)
      const 폰트 = 임베드폰트(pdfPath);
      if (폰트 !== null && !폰트.some((n) => /Consolas/i.test(n))) {
        지도.문제.push(
          `PDF에 모노 폰트(Consolas)가 임베드되지 않았다 — 인쇄본에서 계기판 성격이 죽는다.\n` +
          `     원인은 거의 항상 CSS --mono 스택 맨 앞이 Consolas 가 아닌 것. 고치고 --bake.`
        );
      }
    }

    지도들.push(지도);
  }

  return { 있음: true, dir, 지도들 };
}

/** PDF에서 임베드 폰트 이름을 뽑는다(못 읽으면 null — 없음과 구분한다) */
function 임베드폰트(pdfPath) {
  let buf;
  try { buf = fs.readFileSync(pdfPath); } catch (_) { return null; }
  const s = buf.toString('latin1');
  const out = new Set();
  const re = /\/BaseFont\s*\/([A-Za-z0-9+,#-]+)/g;
  let m;
  while ((m = re.exec(s)) !== null) out.add(m[1].replace(/^[A-Z]{6}\+/, ''));
  return [...out];
}

/** 헤드리스 크롬 경로 — 없으면 null */
function 크롬() {
  const 후보 = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  return 후보.find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } }) || null;
}

/**
 * PDF 굽기 — 임시 폴더에 굽고 복사한다.
 * ⚠ 크롬에게 OneDrive 폴더로 **직접** 쓰게 하면 액세스 거부(0x5)가 난다(2026-08-04 실측).
 *   그때 오류 문구는 "Failed to write file" 뿐이라 원인이 안 보인다 — 그래서 통로를 아예 우회한다.
 */
function 굽기(htmlPath) {
  const bin = 크롬();
  if (!bin) return { ok: false, 이유: '크롬을 못 찾았다(CHROME_PATH 로 지정 가능)' };

  const 이름 = path.basename(htmlPath, '.html');
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-map-'));
  const 임시pdf = path.join(임시, 'out.pdf');
  const url = 'file:///' + htmlPath.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');

  const r = spawnSync(bin, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${임시pdf}`, url,
  ], { encoding: 'utf8', timeout: 120000 });

  if (!fs.existsSync(임시pdf)) {
    return { ok: false, 이유: `크롬이 PDF를 못 만들었다: ${String(r.stderr || '').split('\n').slice(-3).join(' ').trim()}` };
  }

  // 폰트 게이트를 **복사 전에** 통과시킨다 — 깨진 판으로 멀쩡한 판을 덮지 않는다
  const 폰트 = 임베드폰트(임시pdf) || [];
  if (!폰트.some((n) => /Consolas/i.test(n))) {
    return {
      ok: false,
      이유: `모노 폰트(Consolas)가 임베드되지 않아 굽기를 중단했다 — 기존 PDF는 그대로 뒀다.\n` +
            `  임베드된 것: ${폰트.join(', ') || '(없음)'}\n` +
            `  CSS 의 --mono 스택 **맨 앞**이 Consolas 여야 한다(ui-monospace 를 앞세우면 아예 임베드되지 않는다).`,
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

/** 정본 도장 갱신 — 지도 HTML 안의 엣지를 정본 현재 커밋으로 다시 쓴다 */
function 도장찍기(htmlPath) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const 엣지들 = 엣지읽기(html);
  if (!엣지들.length) return { ok: false, 이유: '정본 선언(<!-- 파생: … -->)이 없다 — 먼저 심어야 한다' };

  const 찍은것 = [];
  for (const e of 엣지들) {
    const 현재 = 정본커밋(e.정본);
    if (!현재) { 찍은것.push(`${e.정본} → (커밋 이력 없음, 건너뜀)`); continue; }
    const 짧게 = 현재.slice(0, 7);
    const 옛 = e.도장 ? `${e.정본}@${e.도장}` : e.정본;
    html = html.split(옛).join(`${e.정본}@${짧게}`);
    찍은것.push(`${e.정본} @${짧게}`);
  }
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

module.exports = { 지도폴더, 훑기, 엣지읽기, 굽기, 도장찍기, 표만들기, 리드미갱신, 임베드폰트, 리포트 };
