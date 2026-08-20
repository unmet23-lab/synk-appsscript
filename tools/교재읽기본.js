#!/usr/bin/env node
/* 교재읽기본 — 시냅스 코어 권1 원고를 **읽기용 HTML 한 장**으로 굽는다.
 *
 * 쓰는 법: node tools/교재읽기본.js            → docs/교재_읽기본/권1.html
 *          node tools/교재읽기본.js --바탕화면  → 바탕화면에도 한 벌
 *
 * 왜 있나 (2026-08-09 · 유호님 「보여줘」):
 *   권1 원고는 한 파일이 아니다 — 1·3~8과는 `docs/교재_시냅스코어_권1_원고_v2.md` 에 있고
 *   **2과 본문만 `docs/_archive/교재_시냅스코어_권1_초안_v1.md` §③** 에 있다(중복 사본 금지 원칙의
 *   결과다). v2 의 2과 자리에는 "저기가 정본" 이라는 안내 한 줄만 서 있어, 원고를 처음부터 끝까지
 *   읽으려면 사람이 두 파일을 오가야 했다. 여기서 **읽을 때만** 합친다 — 원본 md 는 건드리지 않는다.
 *
 * 원칙:
 *  · 정본은 repo 의 md 다. 이 HTML 은 열람용 스냅샷이고, 어긋나면 md 가 이긴다(머리에 날짜·원본 경로를 박는다).
 *  · 색·서체 값은 킷 토큰(docs/tools/synk-tokens.css)을 소비한다 — 손 hex 금지(DESIGN.md §5).
 *  · md 렌더는 공용 통로 `tools/lib/마크다운.js` — 이 문서는 지면 목업(``` 펜스)이 본체라
 *    펜스를 못 다루는 렌더러에 물리면 박스 그림이 조용히 문단으로 풀린다.
 *  · 🔴 지면 목업의 고정폭: 브랜드 모노(DM Mono)는 **한글 글리프가 없다**(DESIGN.md §3 금지 조항).
 *    라틴만 모노로 잡고 한글을 폴백에 맡기면 한 글자 폭이 라틴 2배가 아니게 되어 박스가 어긋난다.
 *    그래서 목업 블록만 **한글까지 한 벌로 고정폭인 가족**(D2Coding → DotumChe → GulimChe → MS Gothic)을
 *    쓴다. 킷이 침묵하는 자리라 킷과 충돌하지 않는다(§6 「킷이 침묵하는 디테일만」).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { esc, 렌더 } = require('./lib/마크다운.js');
// 바탕화면을 찾는 **단 하나의 통로**(파일 안 사본 금지 — `tests/바탕화면통로.test.js` 가 문다).
const { 경로: 바탕화면 } = require('./lib/바탕화면.js');

const ROOT = path.join(__dirname, '..');
const 본편 = path.join(ROOT, 'docs', '교재_시냅스코어_권1_원고_v2.md');
const 초안 = path.join(ROOT, 'docs', '_archive', '교재_시냅스코어_권1_초안_v1.md');
const TOKENS = path.join(ROOT, 'docs', 'tools', 'synk-tokens.css');
const OUT_DIR = path.join(ROOT, 'docs', '교재_읽기본');
const OUT = path.join(OUT_DIR, '권1.html');

/* ── ① 2과 합치기 ────────────────────────────────────────────────────────────
 * 줄 번호로 자르지 않는다 — 원고가 자라면 그 번호는 조용히 다른 데를 가리킨다.
 * 제목으로 찾고, **못 찾으면 던진다**(빠진 채로 구워지면 「2과가 없는 완주본」이 된다). */

/** md 에서 `#` 개수가 층인 제목 블록을 잘라 낸다 — 같은 층이나 더 위 제목을 만나면 끝. */
function 절잘라내기(md, 층, 제목패턴) {
  const lines = md.split(/\r?\n/);
  const 시작 = lines.findIndex((l) => new RegExp(`^#{${층}}\\s+`).test(l) && 제목패턴.test(l));
  if (시작 < 0) return null;
  let 끝 = lines.length;
  for (let i = 시작 + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= 층) { 끝 = i; break; }
  }
  return { 시작, 끝, 머리: lines[시작], 몸: lines.slice(시작 + 1, 끝).join('\n'), lines };
}

function 합치기(본편md, 초안md) {
  const 자리 = 절잘라내기(본편md, 1, /2과/);
  if (!자리) throw new Error('본편에서 「# 2과」 자리를 못 찾았다 — 원고 제목이 바뀌었는지 확인할 것.');
  const 원고 = 절잘라내기(초안md, 2, /2과\s*완전\s*원고/);
  if (!원고) throw new Error('초안 v1 에서 「## ③ 2과 완전 원고」 를 못 찾았다 — 2과 정본이 옮겨졌는지 확인할 것.');

  // 본편의 2과 자리(안내 한 줄)를 초안의 전문으로 갈아 끼운다. 제목은 본편 것을 쓴다.
  const 출처 = '> 📎 **이 과의 본문은 `docs/_archive/교재_시냅스코어_권1_초안_v1.md` §③ 에서 합쳐 온 것**입니다 — '
             + '원고가 두 파일로 갈려 있어 읽을 때만 이어 붙입니다(원본은 그대로).\n';
  const 새몸 = 출처 + '\n' + 원고.몸.replace(/^\s+|\s+$/g, '') + '\n';
  const out = 자리.lines.slice(0, 자리.시작 + 1).concat([''], 새몸.split('\n'), [''], 자리.lines.slice(자리.끝));
  return { md: out.join('\n'), 합친줄수: 새몸.split('\n').length };
}

/* ── ② 목차 ──────────────────────────────────────────────────────────────── */

const 슬러그 = (s) => 'sec-' + s.replace(/[`*_[\]()「」]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);

function 목차만들기(md) {
  return md.split(/\r?\n/)
    .map((l) => l.match(/^#\s+(.*)/))
    .filter(Boolean)
    .map((m) => m[1].replace(/\*\*/g, '').trim())
    .map((t) => ({ 글자: t, id: 슬러그(t) }));
}

/* ── ③ 껍데기 ────────────────────────────────────────────────────────────── */

// W5 로고 — docs/발표물/_브랜드킷.md §3 SVG 도형 정본 복사(좌표 재작도 금지)
const LOGO_W5 = `<svg class="logo" viewBox="-8 -2 181 116" role="img" aria-label="SYNK">
  <text x="0" y="86" font-family="Inter Tight, system-ui, sans-serif" font-size="72" font-weight="600" letter-spacing="-1" fill="#E4E4E7">syn</text>
  <path d="M138 44 L112 66 L138 88 L150 88 L124 66 L150 44 Z" fill="#F96859"/>
</svg>`;

const CSS = `
/* 지면 목업용 고정폭 — 한글까지 한 가족으로 잡아야 2:1 폭이 유지된다(파일 머리 주석 참조) */
:root{ --지면-font:'D2Coding','DotumChe','GulimChe','MS Gothic',ui-monospace,monospace; --지면-크기:13px; }

*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--synk-바탕);color:var(--synk-잉크);
  font-family:var(--synk-font);font-weight:450;line-height:1.75;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}

/* ── 머리 띠 ── */
.band{background:var(--synk-navy-2);color:var(--synk-cream);padding:28px 32px 24px;
  display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap}
.band .logo{height:34px;width:auto;flex:none;opacity:.95}
.band h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.25}
.band .cap{color:var(--synk-slate);font-size:12.5px;margin-top:6px;letter-spacing:.01em}
.band .우{margin-left:auto;display:flex;gap:8px;align-items:center}

button.칩{font:inherit;font-size:12.5px;font-weight:600;color:var(--synk-cream);
  background:transparent;border:1px solid var(--synk-navy-3);border-radius:9px;
  padding:7px 12px;min-height:40px;cursor:pointer;transition:background .16s ease,border-color .16s ease}
button.칩:hover{background:var(--synk-navy-3)}
button.칩:active{transform:scale(.96)}
button.칩:focus-visible{outline:2px solid var(--synk-coral);outline-offset:2px}

/* ── 판 ── */
.판{display:grid;grid-template-columns:250px minmax(0,1fr);gap:0;align-items:start}
nav{position:sticky;top:0;max-height:100vh;overflow-y:auto;padding:26px 18px 40px;
  border-right:1px solid var(--synk-보조잉크);border-color:color-mix(in srgb,var(--synk-보조잉크) 28%,transparent)}
nav .라벨{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:var(--synk-보조잉크2);margin:0 0 12px 10px}
nav a{display:block;padding:8px 10px;margin-bottom:1px;border-radius:8px;text-decoration:none;
  color:var(--synk-잉크);font-size:13.5px;font-weight:500;line-height:1.4;
  border-left:2px solid transparent;transition:background .14s ease}
nav a:hover{background:var(--synk-cream-2)}
nav a.현재{border-left-color:var(--synk-coral);font-weight:700;background:var(--synk-coral-wash)}
[data-synk-theme="dark"] nav a:hover{background:var(--synk-navy-3)}
[data-synk-theme="dark"] nav a.현재{background:var(--synk-navy-3);color:var(--synk-cream)}

main{padding:34px 40px 120px;min-width:0;max-width:960px}

/* ── 본문 타이포: 위계는 색이 아니라 밀도 ── */
h1{font-size:30px;font-weight:800;letter-spacing:-.025em;line-height:1.25;
  margin:64px 0 6px;padding-top:22px;border-top:2px solid var(--synk-보조잉크);scroll-margin-top:12px}
h1:first-of-type{margin-top:8px;border-top:0;padding-top:0}
h2{font-size:21px;font-weight:800;letter-spacing:-.015em;margin:44px 0 10px}
h3{font-size:16px;font-weight:700;margin:34px 0 8px;color:var(--synk-보조잉크)}
h4{font-size:14px;font-weight:700;margin:22px 0 6px;letter-spacing:.01em}
p{margin:0 0 14px;max-width:72ch}
strong{font-weight:750}
hr{border:0;border-top:1px solid var(--synk-보조잉크);opacity:.35;margin:34px 0}
code{font-family:var(--synk-font-mono);font-size:.88em;background:var(--synk-cream-2);
  padding:1px 5px;border-radius:5px;letter-spacing:.01em}
[data-synk-theme="dark"] code{background:var(--synk-navy-3)}
a{color:var(--synk-신호_글자_대형);text-underline-offset:3px}
[data-synk-theme="dark"] a{color:var(--synk-coral-2)}

blockquote{margin:0 0 18px;padding:14px 18px;background:var(--synk-cream-2);
  border-left:3px solid var(--synk-보조잉크);border-radius:0 10px 10px 0;font-size:14px}
blockquote p{margin:0 0 8px;max-width:none}
blockquote p:last-child{margin:0}
[data-synk-theme="dark"] blockquote{background:var(--synk-navy-3);border-left-color:var(--synk-slate)}

table{border-collapse:collapse;margin:0 0 22px;font-size:13.5px;width:100%;display:block;overflow-x:auto}
th,td{border:1px solid var(--synk-보조잉크);border-color:color-mix(in srgb,var(--synk-보조잉크) 30%,transparent);
  padding:8px 12px;text-align:left;vertical-align:top}
th{background:var(--synk-cream-2);font-weight:700}
[data-synk-theme="dark"] th{background:var(--synk-navy-3)}
td:last-child{font-variant-numeric:tabular-nums}

/* ── 지면 목업 = 교재의 「쪽」. 코드가 아니라 종이로 읽히게 한다 ── */
pre{font-family:var(--지면-font);font-size:var(--지면-크기);line-height:1.6;
  font-variant-ligatures:none;tab-size:4;
  background:var(--synk-cream-2);color:var(--synk-잉크);
  border:1px solid var(--synk-cream-3);border-radius:12px;
  padding:20px 22px;margin:0 0 22px;overflow-x:auto;
  box-shadow:0 1px 2px rgba(8,9,12,.05),0 8px 20px -12px rgba(8,9,12,.22)}
[data-synk-theme="dark"] pre{background:var(--synk-navy-3);border-color:var(--synk-navy);color:var(--synk-cream)}

ul,ol{margin:0 0 16px;padding-left:22px;max-width:72ch}
li{margin-bottom:5px}
li>ul,li>ol{margin-top:5px;margin-bottom:0}

footer{border-top:1px solid var(--synk-보조잉크);margin-top:60px;padding-top:20px;
  color:var(--synk-보조잉크2);font-size:12.5px;max-width:72ch}

@media (max-width:860px){
  .판{grid-template-columns:1fr}
  nav{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--synk-보조잉크)}
  main{padding:24px 20px 90px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}html{scroll-behavior:auto}}
@media print{
  nav,.band .우{display:none}
  .판{display:block}
  main{max-width:none;padding:0}
  pre{box-shadow:none;break-inside:avoid}
  h1{break-before:page}
  h1:first-of-type{break-before:auto}
  @page{margin:16mm 14mm}
  body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
`;

const JS = `
(function(){
  var 뿌리 = document.documentElement;
  // 테마 — 킷 토큰이 data-synk-theme 로 갈린다
  var 저장 = null; try{ 저장 = localStorage.getItem('synk-교재-테마'); }catch(e){}
  var 시스템다크 = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(저장 || (시스템다크 ? 'dark' : 'light'));
  function setTheme(t){
    뿌리.setAttribute('data-synk-theme', t);
    var b = document.getElementById('테마'); if (b) b.textContent = (t === 'dark' ? '☀ 밝게' : '☾ 어둡게');
    try{ localStorage.setItem('synk-교재-테마', t); }catch(e){}
  }
  document.getElementById('테마').addEventListener('click', function(){
    setTheme(뿌리.getAttribute('data-synk-theme') === 'dark' ? 'light' : 'dark');
  });

  // 지면 크기 — 목업만 키운다(본문은 그대로). 박스 그림은 폭이 생명이라 확대가 곧 가독성이다.
  var 크기 = 13; var 저장크기 = null; try{ 저장크기 = parseFloat(localStorage.getItem('synk-교재-지면')); }catch(e){}
  if (저장크기) 크기 = 저장크기;
  적용();
  function 적용(){
    뿌리.style.setProperty('--지면-크기', 크기 + 'px');
    var o = document.getElementById('지면크기'); if (o) o.textContent = Math.round(크기) + 'px';
    try{ localStorage.setItem('synk-교재-지면', String(크기)); }catch(e){}
  }
  document.getElementById('작게').addEventListener('click', function(){ 크기 = Math.max(10, 크기 - 1); 적용(); });
  document.getElementById('크게').addEventListener('click', function(){ 크기 = Math.min(24, 크기 + 1); 적용(); });

  // 목차 현재 위치 — 화면에 들어온 과를 표시한다
  var 링크 = {}; Array.prototype.forEach.call(document.querySelectorAll('nav a'), function(a){
    링크[a.getAttribute('href').slice(1)] = a;
  });
  var 제목들 = document.querySelectorAll('main h1[id]');
  if (window.IntersectionObserver && 제목들.length){
    var 보이는 = new Set();
    var io = new IntersectionObserver(function(목록){
      목록.forEach(function(e){ e.isIntersecting ? 보이는.add(e.target.id) : 보이는.delete(e.target.id); });
      var 첫 = null;
      Array.prototype.forEach.call(제목들, function(h){ if (!첫 && 보이는.has(h.id)) 첫 = h.id; });
      Object.keys(링크).forEach(function(k){ 링크[k].classList.toggle('현재', k === 첫); });
    }, { rootMargin: '0px 0px -72% 0px' });
    Array.prototype.forEach.call(제목들, function(h){ io.observe(h); });
  }
})();
`;

/* ── ④ 빌드 ──────────────────────────────────────────────────────────────── */

function 빌드(opt) {
  opt = opt || {};
  for (const p of [본편, 초안, TOKENS]) {
    if (!fs.existsSync(p)) throw new Error('없다: ' + path.relative(ROOT, p));
  }
  const 본편md = fs.readFileSync(본편, 'utf8');
  const 초안md = fs.readFileSync(초안, 'utf8');
  const { md, 합친줄수 } = 합치기(본편md, 초안md);

  const 목차 = 목차만들기(md);
  const 쓴id = new Set();
  const body = 렌더(md, {
    제목id: (글자, 층) => {
      if (층 !== 1) return null;
      const t = 글자.replace(/\*\*/g, '').trim();
      let id = 슬러그(t);
      while (쓴id.has(id)) id += '_';
      쓴id.add(id);
      return id;
    },
  });

  const 날짜 = new Date().toISOString().slice(0, 10);
  const 제목 = '시냅스 코어 권1 「첫 목소리」 — 원고 열람본';
  const html = `<!doctype html><html lang="ko" data-synk-theme="light"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(제목)}</title>
<style>${fs.readFileSync(TOKENS, 'utf8')}${CSS}</style></head>
<body>
<header class="band">${LOGO_W5}
  <div><h1>${esc(제목)}</h1>
  <div class="cap">열람용 스냅샷 ${날짜} · 정본은 저장소 md — 어긋나면 md 가 이긴다<br>
  1·3~8과 = docs/교재_시냅스코어_권1_원고_v2.md · 2과 = docs/_archive/교재_시냅스코어_권1_초안_v1.md §③</div></div>
  <div class="우">
    <button class="칩" id="작게" aria-label="지면 목업 작게">A−</button>
    <button class="칩" id="크게" aria-label="지면 목업 크게">A+</button>
    <span class="cap" id="지면크기" style="min-width:34px;text-align:center">13px</span>
    <button class="칩" id="테마">☾ 어둡게</button>
  </div>
</header>
<div class="판">
  <nav><p class="라벨">권1 차례</p>
${목차.map((t) => `    <a href="#${esc(t.id)}">${esc(t.글자)}</a>`).join('\n')}
  </nav>
  <main>
${body}
<footer>이 파일은 <strong>열람용 사본</strong>입니다 — 고치는 곳은 저장소 md 이고,
고친 뒤 <code>node tools/교재읽기본.js</code> 로 다시 굽습니다.<br>
⚠️ 인쇄·조판 전 필수: 본문의 <code>📱 [V1-0X-XX]</code> 는 설계상 가상 코드라
<code>docs/교재_앱_연동_매핑_v1.md</code> §④ 치환표대로 실존 QZ ID 로 바꿔야 QR 이 빈 곳을 안 가리킵니다.<br>
검수 상태: 유호님 검수 전 완주본 · 몽골어(⚡거울·키릴 대조)는 전량 원어민 검수 필요(R1).</footer>
  </main>
</div>
<script>${JS}</script>
</body></html>`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');
  const 낸것 = [OUT];

  if (opt.바탕화면) {
    const d = 바탕화면();
    fs.writeFileSync(path.join(d, '시냅스코어_권1_원고.html'), html, 'utf8');
    낸것.push(path.join(d, '시냅스코어_권1_원고.html'));
  }
  return { 낸것, 합친줄수, 과수: 목차.length, 바이트: Buffer.byteLength(html) };
}

if (require.main === module) {
  const r = 빌드({ 바탕화면: process.argv.includes('--바탕화면') });
  console.log(`구웠다 — 과 ${r.과수}개 · 2과 합친 줄 ${r.합친줄수} · ${(r.바이트 / 1024).toFixed(0)}KB`);
  r.낸것.forEach((f) => console.log('  · ' + f));
}

module.exports = { 빌드, 합치기, 절잘라내기, 목차만들기, OUT };
