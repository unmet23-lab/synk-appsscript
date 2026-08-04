#!/usr/bin/env node
/* 브랜드렌더린트 — 브랜드 키트 준수를 **렌더된 픽셀 기준**으로 검사한다.
 *
 * 왜 따로 있나(= `tests/브랜드색.test.js` 로 안 되는 이유):
 *   소스 검색은 「이 파일에 #FF6B5C 가 있다」까지만 안다. 그런데 정본이 금지하는 것은
 *   **「라이트 배경 위의 코랄 글자」** 처럼 **두 값의 관계**다. 배경은 조상에서 상속되고,
 *   글자색은 CSS 변수를 거쳐 오며, 최종 승자는 캐스케이드가 정한다 —
 *   즉 **렌더를 해봐야만 알 수 있다.**
 *   실측(2026-08-04~05): 소스 가드 3종이 전부 초록인 채로 라이브 접수 폼에
 *   대비 위반 162건·라이트 위 코랄 글자 60건이 살아 있었다.
 *
 * 무엇을 재나:
 *   ① 대비 — 조상을 거슬러 올라가 실제 배경을 찾고 WCAG 대비를 잰다.
 *   ② 키트 밖 색 — 렌더된 color/background-color 가 19색 밖인가.
 *   ③ 키트 밖 서체 — 렌더에 **실제로 쓰인** 폰트가 정본 3종 밖인가.
 *
 * 실측에서 나온 함정 3개(다시 밟지 말 것):
 *   ⚠ `background-image`(그라디언트)를 만나면 **판정을 포기**한다. 평균색을 못 재는데
 *     억지로 재면 「흰 글자 대비 1.0」 같은 오탐이 76건 쏟아진다.
 *   ⚠ `font-family` 는 **쉼표로 갈라야** 한다. 첫 패밀리만 뽑으면 폴백이 안 보인다.
 *   ⚠ 한글 경로는 `file://` URL 에서 반드시 encodeURI 한다. 안 하면 조용히 빈 문서가 뜬다
 *     — 그리고 빈 문서의 위반은 **0건**이라 통과처럼 보인다(새는 방향은 언제나 통과다).
 *
 * ⚠ 이 린트는 **크롬에 기댄다.** 크롬이 없으면 검사하지 않고 **exit 2 + `SKIP`** 로 드러낸다.
 *   통과(0)와 미실행(2)이 같은 모양이면 안 된다 — CI 에서 조용히 안 도는 게 최악이다.
 *   탐지력 자체는 `tests/브랜드렌더린트.test.js` 의 픽스처가 진다.
 *
 * 사용법:
 *   node tools/브랜드렌더린트.js crewcard/카드_kr.html
 *   node tools/브랜드렌더린트.js --json docs/개인정보처리방침_게시용.html
 * 종료 코드: 0=위반 없음 · 1=위반 있음 · 2=검사 불가(크롬 없음)
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* ── 정본 값 ────────────────────────────────────────────────────────────────
 * 키트 19색·서체 3종은 여기 두 상수가 유일한 원천이다. 두 곳에 적으면 갈라진다. */
const KIT = {
  '#F6F1E8': 'Cream', '#FBF7EE': 'Paper', '#EFE7D7': 'Cream 2', '#E7DDC7': 'Cream 3',
  '#FF6B5C': 'Coral', '#FF8877': 'Coral 2', '#E8543F': 'Coral 3',
  '#FFCFC6': 'Coral Soft', '#FFE9E4': 'Coral Wash',
  '#1A2340': 'Navy', '#0F1730': 'Navy 2', '#2A3358': 'Navy 3', '#131A32': 'Navy Ink',
  '#C8FF3D': 'Lime', '#B8E836': 'Lime 2', '#171820': 'Ink',
  '#FF3E88': 'KC Hot Pink', '#FF6BA8': 'KC Pink 2', '#FFD447': 'KC Sun', '#4E7CFF': 'KC Cool Blue',
};
/* 정본 = docs/브랜드_폰트_정본.md §3 — 「모든 산출물은 이 3종만」.
 * 폴백 낱말(system-ui·sans-serif…)은 CDN 이 죽었을 때 레이아웃을 지키는 안전망이라
 * 금지 대상이 아니다(정본 §7). 실제로 **그려진** 폰트만 본다. */
const FONTS_OK = ['Inter Tight', 'SUIT Variable', 'SUIT', 'DM Mono'];
const GENERIC_OK = [
  'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif', 'serif',
  'monospace', 'ui-monospace', 'ui-sans-serif', 'ui-serif',
  'Segoe UI', 'Malgun Gothic', '맑은 고딕', 'Cascadia Mono', 'Consolas', 'SFMono-Regular',
];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function findChrome() {
  return CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

/* ── 페이지 안에서 도는 측정기 ───────────────────────────────────────────────
 * 문자열로 주입한다. 여기 안에서는 저장소의 어떤 것도 참조할 수 없다. */
function 측정기소스(kitHexes, fontsOk, genericOk) {
  return `(() => {
  const KIT = new Set(${JSON.stringify(kitHexes)});
  const FONTS_OK = new Set(${JSON.stringify(fontsOk)});
  const GENERIC_OK = new Set(${JSON.stringify(genericOk)});

  const hex = (rgb) => {
    const m = String(rgb).match(/-?[\\d.]+/g);
    if (!m || m.length < 3) return null;
    if (m.length > 3 && Number(m[3]) === 0) return 'TRANSPARENT';
    return '#' + m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const lum = (h) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  // 조상을 거슬러 실제 배경을 찾는다. 그라디언트를 만나면 **판정 포기**(오탐 방지).
  const 배경찾기 = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { hex: null, why: 'gradient' };
      const h = hex(cs.backgroundColor);
      if (h && h !== 'TRANSPARENT') return { hex: h, why: null };
    }
    return { hex: '#FFFFFF', why: 'root' };
  };

  const 셀렉터 = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };

  const 대비위반 = [], 키트밖색 = [], 키트밖서체 = [];
  const 색집계 = new Map(), 서체집계 = new Map();
  let 잰것 = 0, 그라디언트건너뜀 = 0;

  // ⚠ 종이·화면에 **안 그려지는** 요소는 세지 않는다. <style>·<script>·<title> 은
  //   텍스트 노드를 가지므로 「직접 텍스트」 필터를 그냥 통과하는데, 거기 잡힌 색·서체는
  //   파일이 선언한 게 아니라 **브라우저 기본값**이다. 실측(첫 실행): 그 넷이
  //   Noto Sans KR 4건·순검정 4건으로 잡혀 「키트 밖」 목록을 오염시켰다 —
  //   가드가 자기 전처리에 눈이 멀면 없는 위반을 만들어내고, 사람은 그걸 고치려 든다.
  const 안그려짐 = new Set(['STYLE', 'SCRIPT', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK']);

  // 순수 장식(aria-hidden)은 **대비 판정에서만** 뺀다 — WCAG 1.4.3 이 명시로 면제하는 자리다.
  // ⚠ 이걸 「위반 지우개」로 쓰면 안 된다. aria-hidden 은 스크린리더가 그 내용을 통째로
  //   안 읽는다는 뜻이라, 정보를 담은 요소에 붙이면 접근성을 **더** 망가뜨린다 —
  //   즉 대가가 실재해서 스스로 남용을 막는다. 색·서체 검사는 그대로 적용한다(장식도 키트 안이어야 한다).
  const 장식 = (el) => el.closest('[aria-hidden="true"]') !== null;

  for (const el of document.querySelectorAll('*')) {
    if (안그려짐.has(el.tagName)) continue;
    // 직접 자식으로 텍스트를 가진 요소만 — 안 그러면 래퍼가 상속색으로 중복 계산된다.
    const 직접텍스트 = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!직접텍스트) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;

    const fg = hex(cs.color);
    if (!fg || fg === 'TRANSPARENT') continue;
    잰것++;
    const size = parseFloat(cs.fontSize) || 0;
    const weight = Number(cs.fontWeight) || 400;
    const 숨김 = cs.display === 'none' || !el.getClientRects().length;

    // ① 색이 키트 안인가
    색집계.set(fg, (색집계.get(fg) || 0) + 1);
    if (!KIT.has(fg)) 키트밖색.push({ sel: 셀렉터(el), hex: fg, size, 숨김, 글: 직접텍스트.slice(0, 28) });

    // ② 서체 — 쉼표로 갈라야 폴백이 보인다
    for (const raw of cs.fontFamily.split(',')) {
      const f = raw.trim().replace(/^["']|["']$/g, '');
      if (!f) continue;
      서체집계.set(f, (서체집계.get(f) || 0) + 1);
      if (!FONTS_OK.has(f) && !GENERIC_OK.has(f)) {
        키트밖서체.push({ sel: 셀렉터(el), font: f, 숨김, 글: 직접텍스트.slice(0, 28) });
      }
    }

    // ③ 대비 — 장식은 면제(위 주석)
    if (장식(el)) continue;
    const bg = 배경찾기(el);
    if (!bg.hex) { 그라디언트건너뜀++; continue; }
    const r = ratio(fg, bg.hex);
    const 대형 = size >= 24 || (size >= 18.66 && weight >= 700);
    const 기준 = 대형 ? 3 : 4.5;
    if (r < 기준) {
      대비위반.push({
        sel: 셀렉터(el), fg, bg: bg.hex, 대비: Math.round(r * 100) / 100,
        기준, size, weight, 숨김, 글: 직접텍스트.slice(0, 28),
      });
    }
  }

  const 상위 = (m) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  return {
    잰것, 그라디언트건너뜀,
    대비위반, 키트밖색, 키트밖서체,
    색분포: 상위(색집계), 서체분포: 상위(서체집계),
  };
})()`;
}

function 측정(file, chrome) {
  const html = fs.readFileSync(file, 'utf8');
  const 주입 = `<script>window.addEventListener('load', () => {
    let r; try { r = ${측정기소스(Object.keys(KIT), FONTS_OK, GENERIC_OK)}; }
    catch (e) { r = { 오류: String(e && e.stack || e) }; }
    const pre = document.createElement('pre');
    pre.id = 'SYNK_LINT_OUT';
    pre.textContent = JSON.stringify(r);
    document.documentElement.appendChild(pre);
  });</script>`;

  // </body> 앞에 넣는다 — 없으면 끝에 붙인다.
  const 주입본 = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${주입}</body>`) : html + 주입;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lint-'));
  const tmp = path.join(dir, 'page.html');
  try {
    fs.writeFileSync(tmp, 주입본, 'utf8');
    // ⚠ 한글 경로 → encodeURI. 안 하면 빈 문서가 뜨고 위반 0건으로 「통과」한다.
    const url = 'file:///' + encodeURI(tmp.replace(/\\/g, '/'));
    const out = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', url,
    ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

    const m = out.match(/<pre id="SYNK_LINT_OUT">([\s\S]*?)<\/pre>/);
    if (!m) throw new Error('측정기가 결과를 못 냈다 — 페이지 스크립트 오류이거나 로드 실패');
    const 결과 = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
    if (결과.오류) throw new Error('측정기 예외: ' + 결과.오류);
    // 빈 문서를 「통과」로 읽지 않는다.
    if (!결과.잰것) throw new Error('텍스트 요소를 하나도 못 쟀다 — 로드 실패를 통과로 읽을 뻔했다');
    return 결과;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 정리 실패는 검사 결과를 바꾸지 않는다 */ }
  }
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */
function main(argv) {
  const json = argv.includes('--json');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (!files.length) { console.error('사용법: node tools/브랜드렌더린트.js [--json] <파일...>'); return 2; }

  const chrome = findChrome();
  if (!chrome) {
    console.error('SKIP: 크롬을 못 찾았다 — 렌더 검사를 **안 돌렸다**(통과 아님). CHROME_PATH 로 지정할 수 있다.');
    return 2;
  }

  const 전체 = {};
  let 위반합 = 0;
  for (const f of files) {
    let r;
    try { r = 측정(f, chrome); }
    catch (e) { console.error(`✗ ${f} — ${e.message}`); return 2; }
    전체[f] = r;
    const n = r.대비위반.length + r.키트밖색.length + r.키트밖서체.length;
    위반합 += n;
    if (json) continue;

    console.log(`\n── ${f}`);
    console.log(`   잰 텍스트 요소 ${r.잰것} · 그라디언트라 대비 판정 포기 ${r.그라디언트건너뜀}`);
    const 요약 = (라벨, 목록, 키) => {
      if (!목록.length) { console.log(`   ✅ ${라벨} 0`); return; }
      const 묶음 = new Map();
      for (const v of 목록) { const k = 키(v); 묶음.set(k, (묶음.get(k) || 0) + 1); }
      console.log(`   🔴 ${라벨} ${목록.length}건`);
      for (const [k, c] of Array.from(묶음).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
        console.log(`      ${String(c).padStart(4)}× ${k}`);
      }
    };
    요약('대비 위반', r.대비위반, (v) => `${v.fg} on ${v.bg} = ${v.대비} (기준 ${v.기준}, ${v.size}px/${v.weight})`);
    요약('키트 밖 색', r.키트밖색, (v) => v.hex);
    요약('키트 밖 서체', r.키트밖서체, (v) => v.font);
  }
  if (json) console.log(JSON.stringify(전체, null, 1));
  return 위반합 ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { KIT, FONTS_OK, GENERIC_OK, findChrome, 측정 };
