#!/usr/bin/env node
/**
 * 브랜드 킷 «색» 한 벌 조립 — docs/브랜드킷_색상.html + .pdf (유호 확정 2026-08-24 승격)
 *
 * 무엇: 2027 킷 «현행» 색 전량을 A4 공유용 한 벌(HTML+PDF 짝)로 굽는다 — 친구·파트너에게
 *       «색상 최신판»을 건네는 자리. 완성본 전체는 docs/브랜드킷.html(브랜드킷조립.py)이 지고,
 *       이 문서는 색만 진다.
 *
 * 값은 전부 정본에서 — 이 파일에 hex 원본은 없다:
 *   · hex·직책 = docs/디자인_토큰.json (⏳퇴역 대기는 **아예 안 싣는다** — 유호 확정 08-20 「아예 빼줘」,
 *     판정은 손 목록이 아니라 직책의 ⏳ 표식 — 브랜드킷조립.py 와 같은 규칙)
 *   · 지면 CSS = tools/lib/loom.js 인쇄 프리셋 (조립 단계에서 품는 ⓑ 경로 — 소개서 6벌과 같은 문법)
 *   · 로고 = tools/lib/로고정본.js 소비(유호 확정 08-24 «synk 승격» — 사본을 두지 않는다)
 *   · 폰트 = docs/tools/브랜드폰트_임베드.py 가 서브셋 임베드하고 PDF 까지 굽는다(크롬 헤드리스)
 *
 * 등록: 지면방(tools/lib/지면방.js) 「입는다」 등재 · 브랜드렌더린트 등록 ✗ — 색표 문서라
 *       신호 1점이 원리상 위반(docs/브랜드킷.html 과 같은 사유).
 *
 * 실측 교훈 둘 (2026-08-24 1차 굽기):
 *   · 스와치 라벨은 «면 위 글자»다 — Loom 낮 판의 `b{color:ink}` 강제가 어두운 스와치에서
 *     이름을 지운다(Ink 칩 이름 소실 실측). 라벨 계열은 전부 `color:inherit` 로 컨테이너의
 *     대비 계산색을 따르게 한다.
 *   · PDF 폰트 감사는 이름이 아니라 Tf→Tj 추적으로 — 크롬은 임베드 웹폰트를 무명 Type3 로
 *     싣고, 맑은고딕 등장은 공백 글리프뿐이다(memory pdf-font-audit-type3-trap).
 *
 * 사용법:  node tools/브랜드킷색상조립.js          → docs/브랜드킷_색상.html · docs/브랜드킷_색상.pdf
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const loom = require(path.join(루트, 'tools', 'lib', 'loom.js'));
const 로고정본 = require(path.join(루트, 'tools', 'lib', '로고정본.js'));
const 토큰 = JSON.parse(fs.readFileSync(path.join(루트, 'docs', '디자인_토큰.json'), 'utf8'));

const 킷 = 토큰['색']['킷'];
const 현행 = 킷.filter((c) => !String(c['직책'] || '').trimStart().startsWith('⏳'));
const 이름값 = Object.fromEntries(킷.map((c) => [c['이름'], c['hex']]));
const 잉크 = 이름값['Ink'], 종이 = 이름값['Paper'];

/* ── 스와치 라벨 색 — 순백·순검정 금지라 킷의 Ink/Paper 둘 중 «대비 큰 쪽»만 고른다
   (브랜드킷조립.py 글자색()과 같은 판정 — 밝기 문턱은 코랄 면에서 틀린 전력이 있다). ── */
function 럼(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function 대비(a, b) {
  const [x, y] = [럼(a), 럼(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const 라벨색 = (hex) => (대비(hex, 잉크) >= 대비(hex, 종이) ? 잉크 : 종이);

/* ── 직책 정리 — 공유용: 내부 표식(⚠ 이후 · 조항/확정 괄호)을 걷고 첫 문장만.
   ⚠글자 자체도 걷어야 한다 — 폰트 임베드가 브랜드 폰트에 없는 글자를 고아로 깬다. ── */
function 짧은직책(s) {
  let t = String(s || '').split('⚠')[0];
  t = t.replace(/\((?:[^()]*(?:조항|유호|확정|판정|실측|자리|F\d)[^()]*)\)/g, '');
  t = t.split(/\.\s/)[0].replace(/\s+/g, ' ').replace(/\s+·\s*$/, '').trim();
  return t.replace(/[.·]\s*$/, '');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── 램프 스트립 — 단을 이어 붙여 「색이 아니라 램프다」를 눈으로 보이게. 몸통 단은 넓게. ── */
function 램프(색들, { 몸통 = null } = {}) {
  const 칸 = 색들.map((c) => {
    const 주역 = c['이름'] === 몸통;
    return `<div class="단${주역 ? ' 몸통' : ''}" style="background:${c['hex']};color:${라벨색(c['hex'])}">
      <b>${esc(c['이름'])}</b><code>${c['hex'].toUpperCase()}</code>
      <span>${esc(짧은직책(c['직책']))}</span></div>`;
  }).join('');
  return `<div class="램프">${칸}</div>`;
}

function 칩들(색들) {
  return `<div class="칩판">` + 색들.map((c) =>
    `<div class="색칩" style="background:${c['hex']};color:${라벨색(c['hex'])}">
      <b>${esc(c['이름'])}</b><code>${c['hex'].toUpperCase()}</code>
      <span>${esc(짧은직책(c['직책']))}</span></div>`).join('') + `</div>`;
}

const 팔 = (이름) => 현행.filter((c) => c['팔레트'] === 이름);
const 코랄 = 팔('01 Core').filter((c) => c['이름'] !== 'Coral Wash');
const 워시 = 팔('01 Core').filter((c) => c['이름'] === 'Coral Wash');
const 바탕들 = 팔('02 Ground').filter((c) => ['Paper', 'Ink', 'Ink Deep', 'Stitch'].includes(c['이름']));
const 양모 = 팔('02 Ground').filter((c) => !['Paper', 'Ink', 'Ink Deep', 'Stitch'].includes(c['이름']));
const 실들 = 팔('03 Threads');
const KC = 팔('05 K-Culture');

/* 2027 실 4꾸러미 — 가족은 이름 접두로 가른다(토큰 순서 보존). 역할 문구 = DESIGN.md §2 표. */
const 실가족 = [
  { 접두: 'Lapis', 한글: '청금석', 역할: '길잡이 — 안내·힌트·링크 (2027 올해의 색)' },
  { 접두: 'Meadow', 한글: '메도우', 역할: '자람 — 정답·성장' },
  { 접두: 'Butter', 한글: '버터', 역할: '기쁨 — 별·보상' },
  { 접두: 'Pop', 한글: '팝', 역할: '특별함 — 기념·희귀' },
];

const 총수 = 현행.length;

const 실절 = 실가족.map((f) => `<div class="실꾸러미">
    <h3>${f.한글} <span class="흐린">${esc(f.역할)}</span></h3>
    ${램프(실들.filter((c) => c['이름'].startsWith(f.접두)), { 몸통: f.접두 })}
  </div>`).join('\n');

const 오늘 = new Date().toISOString().slice(0, 10);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SYNK 브랜드 킷 — 색</title>
<!-- 파생: docs/디자인_토큰.json -->
<!-- 2027 킷 「내일 꾸러미」 · 지면 = Loom 인쇄 프리셋 · 조립 ${오늘} — 파생 주석에 ·로 잇지 않는다(doc-graph 가 조각을 경로로 오독 · 조직계보 08-24 같은 병) -->
<!-- 조립: node tools/브랜드킷색상조립.js — 손 편집 금지(재조립이 덮는다) · PDF 짝과 한 벌 -->
<style>
/*@FONTS@*/
${loom.css({ 지면: '인쇄' })}
/* ── 이 지면 몫 — 스와치 레이아웃만. 간격은 전부 율 이름, 색은 전부 토큰 값이다. ── */
:root{ --font:'Inter Tight','SUIT',system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; }
.글{max-width:920px;margin:0 auto;padding:var(--켜) var(--단) var(--장);}
.표지머리{padding:var(--켜) 0 var(--단);}
.표지머리 svg{width:172px;display:block;}
.표지머리 h1{font-size:2.1rem;font-weight:800;letter-spacing:-.04em;line-height:var(--줄제목);
  margin:var(--단) 0 var(--숨);}
.메타{font-size:.86rem;}
.램프{display:flex;border-radius:14px;overflow:hidden;margin:var(--칸) 0;
  outline:1px solid rgba(0,0,0,.08);outline-offset:-1px;break-inside:avoid;}
.단{flex:1 1 0;min-height:118px;padding:var(--참);display:flex;flex-direction:column;gap:2px;}
.단.몸통{flex:1.6 1 0;}
.단 b{font-size:.82rem;font-weight:750;}
/* 스와치 라벨은 «면 위 글자»라 컨테이너가 계산한 대비색을 따른다 — Loom 낮 판의 b{ink} 강제가
   어두운 스와치에서 이름을 지운다(1차 굽기 실측: Ink 칩 이름 소실). */
.단 b,.색칩 b,.단 span,.색칩 span,.단 code,.색칩 code{color:inherit;}
.단 code,.색칩 code{font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:.72rem;
  font-weight:500;background:none;box-shadow:none;padding:0;opacity:.85;}
.단 span,.색칩 span{font-size:.66rem;line-height:1.45;opacity:.78;margin-top:auto;}
.칩판{display:flex;flex-wrap:wrap;gap:var(--틈);margin:var(--칸) 0;break-inside:avoid;}
.색칩{width:196px;min-height:104px;border-radius:14px;padding:var(--참);
  display:flex;flex-direction:column;gap:2px;outline:1px solid rgba(0,0,0,.08);outline-offset:-1px;}
.색칩 b{font-size:.82rem;font-weight:750;}
.실꾸러미{break-inside:avoid;}
.실꾸러미 h3 .흐린{font-weight:500;font-size:.82rem;margin-left:var(--숨);}
.원리 p{max-width:64ch;}
footer{margin-top:var(--장);font-size:.74rem;}
@media print{
  @page{size:A4;}
  html,body{background:var(--paper);}
  .글{max-width:none;padding:0;}
  .램프,.칩판,.색칩{outline-color:rgba(0,0,0,.1);}
  .단{min-height:96px;}
  section{break-inside:avoid;}
}
</style></head><body class="룸">
<div class="글">

<header class="표지머리">
  <!-- 로고 = 실행 정본(tools/lib/로고정본.js · 유호 확정 08-24 synk 승격) — 인쇄 지면이라 라이트 민판(필터 없는 순수 벡터가 300dpi 에서 정직하다) -->
  ${로고정본.워드마크({ 판: '라이트', 표현: '민', 슬래시: true })}
  <h1>SYNK 브랜드 킷 — 색</h1>
  <p class="메타 흐린">2027 킷 「내일 꾸러미」 · 현행 ${총수}색 · 값 원천 = 디자인_토큰.json · ${오늘}</p>
</header>

<section class="원리">
<h2>두 원리</h2>
<ul>
  <li><b>색이 아니라 램프다</b> — 유채색은 전부 3단(보풀 빛 Soft · 몸통 · 그늘 Deep).
      몸통은 «면»의 색이고, 글자는 그 실의 Deep 이나 Ink 가 진다.</li>
  <li><b>실은 부품, 램프가 정본</b> — 2027 실(청금석·메도우·버터·팝)은 유행이 지나면
      그 실만 뽑아 갈아끼운다. 구조는 남는다.</li>
</ul>
</section>

<section>
<h2>주인공 — 코랄 램프 5단</h2>
<p>마스코트 «몽글»의 평상복 램프 그대로다 — 마스코트 색이 곧 UI 색. 행동·신호·오답이 전부 이 한 실에서 나온다.</p>
${램프(코랄, { 몸통: 'Coral' })}
${칩들(워시)}
</section>

<section>
<h2>바탕 — 양모 종이와 따뜻한 먹</h2>
<p>순백·순검정은 쓰지 않는다 — 라이트의 하한이 Paper·Ink 다. 다크(앱)는 낮의 글자가 밤의 면이 되는 «양모 밤» 한 벌.</p>
${칩들(바탕들)}
${램프(양모)}
</section>

<section>
<h2>2027 실 — 4꾸러미 × 3단</h2>
<p>실마다 보풀 빛(Soft) · 몸통 · 그늘(Deep)의 3단. 한 화면의 유채 실은 <b>주연 1 + 조연 1</b>, 둘까지만 선다.</p>
${실절}
</section>

<section>
<h2>K컬처 전용 4색 <span class="칩">Part 6 전용</span></h2>
<p>K컬처 콘텐츠(Part 6)에서만 산다 — 일반 UI·지면에 반입하지 않는다.</p>
${칩들(KC)}
</section>

<section>
<h2>철칙 넷</h2>
<ul>
  <li><b>순백·순검정 금지</b> — 라이트 하한 = Paper <code>#FBF7F0</code> · Ink <code>#2B2320</code>.</li>
  <li><b>라이트 배경에 몸통색 글자 금지</b> — Coral·Meadow 는 면이고, 글자는 그 실의 Deep 이 진다.</li>
  <li><b>몸통 면 위 글자는 실마다 정해져 있다</b> — 코랄·버터 = Ink · 청금석 = Paper · 팝 = Ink(큰 글자).</li>
  <li><b>주연 1실 + 조연 1실</b> — 한 화면의 유채 실은 둘까지, 나머지 실은 그 화면에서 쉰다.</li>
</ul>
</section>

<footer class="흐린">SYNK LAB · 값의 정본 = docs/디자인_토큰.json · 규칙 전문 = DESIGN.md · 지면 = Loom(인쇄) · 이 문서는 조립 산출물 — 손 편집 금지 · 재조립 = node tools/브랜드킷색상조립.js</footer>

</div>
</body></html>`;

/* ── 굽기 — 임시 폴더에 굽고 docs/ 로 복사한다(지도대장 문법 — 크롬이 동기화 폴더에
   직접 쓰면 액세스 거부가 난 전력). 임베드 실패는 «조용히» 넘기지 않는다. ── */
function main() {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), '색상킷-'));
  const 원고 = path.join(임시, '색상_src.html');
  const 임베드html = path.join(임시, '브랜드킷_색상.html');
  const 임베드pdf = path.join(임시, '브랜드킷_색상.pdf');
  fs.writeFileSync(원고, html);

  const r = spawnSync('python',
    [path.join(루트, 'docs', 'tools', '브랜드폰트_임베드.py'), 원고, 임베드html, '--pdf', 임베드pdf],
    { encoding: 'utf8' });
  const 출 = (r.stdout || '') + (r.stderr || '');
  for (const 줄 of 출.trim().split('\n')) if (줄.trim()) console.log('   ' + 줄.trim());
  if (r.status !== 0 || !fs.existsSync(임베드pdf)) {
    throw new Error(`폰트 임베드·PDF 굽기 실패(rc=${r.status}) — 산출물을 덮지 않았다`);
  }

  const 출력html = path.join(루트, 'docs', '브랜드킷_색상.html');
  const 출력pdf = path.join(루트, 'docs', '브랜드킷_색상.pdf');
  fs.copyFileSync(임베드html, 출력html);
  fs.copyFileSync(임베드pdf, 출력pdf);
  console.log(`■ 조립  docs/브랜드킷_색상.html + .pdf  (현행 ${총수}색 = 코랄 ${코랄.length + 워시.length} + 바탕 ${바탕들.length + 양모.length} + 실 ${실들.length} + KC ${KC.length} · ${오늘})`);
}

if (require.main === module) main();
