#!/usr/bin/env node
/* 인쇄본빌드 — docs/ 의 열람 가치가 있는 정본·절차서를 SYNK 킷 적용 PDF 로 굽는다.
 *
 * 통로: md → 킷 HTML(토큰 소비: docs/tools/synk-tokens.css) → 헤드리스 크롬 print-to-pdf
 *      → docs/인쇄본/<원본이름>.pdf
 * 쓰는 법: node tools/인쇄본빌드.js            (매니페스트 전체)
 *          node tools/인쇄본빌드.js 런북       (이름 부분일치만)
 *
 * 원칙:
 *  · PDF 는 **열람용 스냅샷**이다 — 정본은 repo 의 md 이고, 어긋나면 정본이 이긴다.
 *    (표지에 스냅샷 날짜·정본 경로를 박아 사본이 정본 행세를 못 하게 한다)
 *  · 색·서체 값은 킷 토큰(synk-tokens.css)을 소비한다 — 손 hex 금지(DESIGN.md §5).
 *  · 로고는 _브랜드킷.md §3 의 W5 SVG 도형 정본을 복사한다(좌표 재작도 금지).
 *  · 흐르는 다쪽 문서라 여백은 @page margin 으로 준다(고정판형 발표물의 margin 0 규격과
 *    다른 계열 — 본문이 페이지를 넘나들며 흐르므로 매 쪽 여백은 @page 가 담당한다).
 *  · 폰트는 시스템 설치본을 이름으로 부른다(SUIT·Inter Tight·DM Mono).
 *    크롬이 PDF 에 쓴 글리프를 서브셋 임베드하므로 산출 PDF 는 자립형이다.
 *    ⚠ SUIT 미설치 기계에서 구우면 한글이 폴백 폰트로 나간다 — 아래 폰트 검사가 경고한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', '인쇄본');
const TOKENS = path.join(ROOT, 'docs', 'tools', 'synk-tokens.css');

/* ── 매니페스트 — 「화면 밖에서 읽히거나 남에게 건네는 문서」만 ── */
const MANIFEST = [
  // A. 손 절차서 (원장이 인쇄해 옆에 두는 것)
  { src: 'docs/응급복구_런북.md',          title: '응급복구 런북',              sub: '엔진이 멈췄을 때 유호님 단독 복구 절차', group: '절차서' },
  { src: 'docs/상담AI_개통_지금할일.md',   title: '상담AI 개통 — 지금 할 일',   sub: 'Meta 앱·토큰·검수 신청 클릭 절차',      group: '절차서' },
  { src: 'docs/DM상담_Phase0_절차서.md',   title: 'DM 상담 Phase 0 절차서',     sub: 'Meta 콘솔 설정 — 페북=학부모·인스타=학생', group: '절차서' },
  { src: 'docs/궤적_원장기록_실행지.md',   title: '궤적 원장기록 실행지',       sub: '졸업생 진로를 outcome_log 에 적는 법',   group: '절차서' },
  // B. 사람에게 건네는 것
  { src: 'docs/강사_교수법_매뉴얼_v1.md',  title: '강사 교수법 매뉴얼',         sub: '수업 진행·게임화 운영·금칙',             group: '전달용' },
  { src: 'docs/원어민_검수지_v1.md',       title: '원어민 검수지',              sub: '몽골어 원어민 검수 게이트',              group: '전달용' },
  { src: 'docs/몽골어_검수_발주서.md',     title: '몽골어 검수 발주서',         sub: '검수 범위·기준·납품 형식',               group: '전달용' },
  { src: 'docs/자주묻는질문_정본.md',      title: '자주 묻는 질문 (FAQ)',       sub: '챗봇·상담 데스크 공용 단일 원천',        group: '전달용' },
  // C. 경영 정본
  { src: 'docs/제품방향.md',               title: 'SYNK 제품 방향',             sub: '4개년 로드맵·핵심 등식·설계 불변식',     group: '경영 정본' },
  { src: 'docs/기업철학_홈페이지_v1.md',   title: 'SYNK 기업 철학',             sub: '대외 철학 문서(홈페이지본)',             group: '경영 정본' },
  { src: 'docs/조직계보_정본_v1.md',       title: 'SYNK 조직 계보',             sub: '브랜드 4 + 전사 레이어 2 — 로드맵 표기', group: '경영 정본' },
  { src: 'docs/개원재무_2027_재산정_v1.md', title: '개원 재무 재산정 (2027)',   sub: '고정비·BEP·좌석 — 내부용',               group: '경영 정본' },
  // D. 교육 설계
  { src: 'docs/커리큘럼_정본_v1.md',       title: 'SYNK 커리큘럼 정본',         sub: '6레벨 학습설계·실라버스·평가 루브릭',    group: '교육 설계' },
  { src: 'docs/반편성_정본_v2.md',         title: '반편성 정본',                sub: '4실 24반·정원 16·384석·BEP 119명',      group: '교육 설계' },
  { src: 'docs/가격_수업표_추천_v3.md',    title: '가격·수업표 현행안',         sub: '수강료·시간표·추천 구성',                group: '교육 설계' },
  { src: 'docs/홍보_트리오_정본_v1.md',    title: '홍보 트리오 정본',           sub: '대외 메시지 축 — 질문·스스로·마음',      group: '교육 설계' },
];

/* ── 초소형 md 렌더러 (이 저장소 문서가 실제로 쓰는 문법만) ── */
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<span class="lnk">$1</span>'); // 인쇄물 — 링크는 글자만
  return s;
}
function renderMd(md) {
  md = md.replace(/<!--[\s\S]*?-->/g, '');              // 주석 제거
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0, listStack = [];
  const closeLists = (depth) => { while (listStack.length > depth) out.push('</' + listStack.pop() + '>'); };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {                            // 코드 펜스
      closeLists(0); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push('<pre>' + esc(buf.join('\n')) + '</pre>'); continue;
    }
    if (/^\s*$/.test(line)) { closeLists(0); i++; continue; }
    if (/^(---|\*\*\*|___)\s*$/.test(line)) { closeLists(0); out.push('<hr/>'); i++; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) { closeLists(0); const n = h[1].length; out.push(`<h${n}>` + inline(h[2]) + `</h${n}>`); i++; continue; }
    if (/^>/.test(line)) {                              // 인용 콜아웃 (연속 줄 묶음)
      closeLists(0); const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + renderMd(buf.join('\n')) + '</blockquote>'); continue;
    }
    if (/^\s*\|/.test(line)) {                          // 표
      closeLists(0); const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => inline(c.trim()));
      let html = '<table>'; let headDone = false;
      for (const r of rows) {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(r)) { headDone = true; continue; }
        const tag = headDone ? 'td' : 'th';
        html += '<tr>' + cells(r).map((c) => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
        if (!headDone) headDone = true; // 구분줄 없는 표 방어 — 첫 줄만 머리
      }
      out.push(html + '</table>'); continue;
    }
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)/);
    if (li) {
      const depth = Math.floor(li[1].replace(/\t/g, '  ').length / 2) + 1;
      const kind = /^\d/.test(li[2]) ? 'ol' : 'ul';
      while (listStack.length > depth) out.push('</' + listStack.pop() + '>');
      while (listStack.length < depth) { out.push('<' + kind + '>'); listStack.push(kind); }
      // 다음 줄이 이어지는 본문(들여쓰기 연속)이면 같은 항목으로 붙인다
      let body = li[3]; let j = i + 1;
      while (j < lines.length && /^\s{2,}\S/.test(lines[j]) && !/^\s*([-*+]|\d+[.)])\s/.test(lines[j]) && !/^\s*\|/.test(lines[j])) {
        body += ' ' + lines[j].trim(); j++;
      }
      i = j; out.push('<li>' + inline(body) + '</li>'); continue;
    }
    closeLists(0);
    // 문단 — 소프트 줄바꿈은 공백으로 접고(md 규칙) 인라인은 문단 전체에 1회(굵게가 줄을 넘어도 산다)
    let body = line.trim(); let j = i + 1;
    while (j < lines.length && !/^\s*$/.test(lines[j]) && !/^(#{1,4}\s|>|```|\s*\||\s*([-*+]|\d+[.)])\s|---\s*$)/.test(lines[j])) {
      body += ' ' + lines[j].trim(); j++;
    }
    i = j; out.push('<p>' + inline(body) + '</p>');
  }
  closeLists(0);
  return out.join('\n');
}

/* ── 킷 템플릿 ── */
// W5 로고 — docs/발표물/_브랜드킷.md §3 SVG 도형 정본 복사(좌표 재작도 금지)
const LOGO_W5 = `<svg class="logo" viewBox="-8 -2 181 116" role="img" aria-label="SYNK">
  <text x="0" y="86" font-family="Inter Tight, system-ui, sans-serif" font-size="72" font-weight="600" letter-spacing="-1" fill="#F6F1E8">syn</text>
  <path d="M138 44 L112 66 L138 88 L150 88 L124 66 L150 44 Z" fill="#FF6B5C"/>
</svg>`;

function pageHtml(doc, bodyHtml, snapDate) {
  const tokens = fs.readFileSync(TOKENS, 'utf8');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(doc.title)}</title>
<style>
${tokens}
@page { size: A4; margin: 17mm 15mm 19mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
body {
  background: var(--synk-paper);
  color: var(--synk-navy);                 /* 잉크(발표물 본문) — 순검정 금지 */
  font-family: 'Inter Tight','SUIT',system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  font-weight: 500; font-size: 10.3pt; line-height: 1.78;
  word-break: keep-all; overflow-wrap: break-word;
}
/* 표지 띠 — Navy 2 반전면. 크림 글자, 3층 라벨은 Slate(다크 허용 바닥) */
.cover { background: var(--synk-navy-2); color: var(--synk-cream); padding: 11mm 12mm 9mm;
         border-radius: 4px; margin-bottom: 9mm; page-break-inside: avoid; }
.cover .logo { height: 9mm; display: block; margin-bottom: 7mm; }
.cover .group { font-size: 8pt; font-weight: 600; letter-spacing: .14em; color: var(--synk-slate); text-transform: uppercase; }
.cover h1.doc { font-family: 'SUIT','Inter Tight',sans-serif; font-weight: 800; font-size: 21.5pt;
                line-height: 1.3; letter-spacing: -0.015em; color: var(--synk-cream); margin: 2.5mm 0 2mm; }
.cover .sub { font-size: 10.5pt; font-weight: 500; color: var(--synk-cream-3); }
.cover .meta { margin-top: 6mm; padding-top: 3mm; border-top: 1px solid var(--synk-navy-3);
               font-size: 7.5pt; line-height: 1.7; color: var(--synk-slate); }
.cover .meta b { color: var(--synk-cream-3); font-weight: 600; }
/* 본문 위계 — 신호는 h2 코랄 바 하나. 강조는 색이 아니라 웨이트가 진다 */
h1 { font-family:'SUIT','Inter Tight',sans-serif; font-weight: 800; font-size: 15pt; color: var(--synk-navy-ink);
     letter-spacing: -0.01em; margin: 8mm 0 3mm; }
h2 { font-family:'SUIT','Inter Tight',sans-serif; font-weight: 800; font-size: 12.5pt; color: var(--synk-navy-ink);
     margin: 7mm 0 2.5mm; padding-left: 3mm; border-left: 2.2mm solid var(--synk-coral); }
h3 { font-family:'SUIT','Inter Tight',sans-serif; font-weight: 700; font-size: 11pt; color: var(--synk-navy);
     margin: 5mm 0 2mm; }
h4 { font-weight: 700; font-size: 10.3pt; margin: 4mm 0 1.5mm; }
p { margin: 0 0 2.6mm; }
strong { font-weight: 700; color: var(--synk-navy-ink); }
del { color: var(--synk-slate-2); }
.lnk { font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
hr { border: 0; border-top: 1px solid var(--synk-cream-3); margin: 5mm 0; }
ul, ol { margin: 0 0 2.8mm 5.5mm; } li { margin-bottom: 1.1mm; }
blockquote { background: var(--synk-cream-2); border-left: 1.4mm solid var(--synk-navy-3);
             border-radius: 3px; padding: 2.6mm 3.4mm; margin: 0 0 3mm; font-size: 9.6pt; page-break-inside: avoid; }
blockquote p { margin-bottom: 1.4mm; } blockquote :last-child { margin-bottom: 0; }
code { font-family: 'DM Mono','Inter Tight','SUIT',monospace; font-size: .92em; letter-spacing: .01em;
       background: var(--synk-cream-2); border-radius: 2px; padding: 0 .25em; }
blockquote code, th code, td code { background: var(--synk-cream-3); }
pre { font-family: 'DM Mono','Inter Tight','SUIT',monospace; font-size: 8.6pt; line-height: 1.6;
      background: var(--synk-cream-2); border: 1px solid var(--synk-cream-3); border-radius: 3px;
      padding: 3mm 3.5mm; margin: 0 0 3mm; white-space: pre-wrap; overflow-wrap: anywhere; letter-spacing: .02em; }
table { width: 100%; border-collapse: collapse; margin: 0 0 3.5mm; font-size: 9.1pt; line-height: 1.6; }
th { font-family:'SUIT','Inter Tight',sans-serif; font-weight: 700; text-align: left; color: var(--synk-navy-ink);
     background: var(--synk-cream-2); border-bottom: 1.5px solid var(--synk-navy-3); padding: 1.6mm 2.2mm; }
td { border-bottom: 1px solid var(--synk-cream-3); padding: 1.6mm 2.2mm; vertical-align: top; }
tr { page-break-inside: avoid; }
</style></head><body>
<div class="cover">
  ${LOGO_W5}
  <div class="group">${esc(doc.group)}</div>
  <h1 class="doc">${esc(doc.title)}</h1>
  <div class="sub">${esc(doc.sub)}</div>
  <div class="meta">이 PDF는 <b>${snapDate} 열람용 스냅샷</b>입니다 — 정본은 저장소의 <b>${esc(doc.src)}</b> 이며, 내용이 어긋나면 언제나 정본이 이깁니다.</div>
</div>
${bodyHtml}
</body></html>`;
}

/* ── 빌드 ── */
function main() {
  const filter = process.argv[2];
  const targets = filter ? MANIFEST.filter((d) => d.src.includes(filter) || d.title.includes(filter)) : MANIFEST;
  if (!targets.length) { console.error('[인쇄본빌드] 매니페스트에 일치 항목이 없다: ' + filter); process.exit(1); }
  const chrome = ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
  if (!chrome) { console.error('[인쇄본빌드] 크롬을 못 찾았다'); process.exit(1); }
  // 폰트 검사(리눅스만) — SUIT 없으면 한글이 폴백으로 나간다
  try {
    const fl = execFileSync('fc-list', [], { encoding: 'utf8' });
    if (!/SUIT/i.test(fl)) console.error('⚠ SUIT 미설치 — 한글이 브랜드 폰트가 아니라 폴백으로 나간다');
  } catch (_) { /* fc-list 없는 OS — 통과 */ }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-print-'));
  const snapDate = new Date().toISOString().slice(0, 10);
  let fail = 0;
  for (const doc of targets) {
    const srcPath = path.join(ROOT, doc.src);
    if (!fs.existsSync(srcPath)) { console.error('✗ 원본 없음: ' + doc.src); fail++; continue; }
    const md = fs.readFileSync(srcPath, 'utf8');
    const html = pageHtml(doc, renderMd(md), snapDate);
    const base = path.basename(doc.src).replace(/\.md$/, '');
    const htmlPath = path.join(tmp, base + '.html');
    const pdfPath = path.join(OUT_DIR, base + '.pdf');
    fs.writeFileSync(htmlPath, html);
    try {
      execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--force-color-profile=srgb',
        '--no-pdf-header-footer', '--print-to-pdf=' + pdfPath, 'file://' + htmlPath], { stdio: 'pipe', timeout: 60000 });
      const kb = Math.round(fs.statSync(pdfPath).size / 1024);
      console.log(`✓ ${base}.pdf (${kb}KB)`);
    } catch (e) { console.error('✗ 굽기 실패: ' + base + ' — ' + (e.message || e)); fail++; }
  }
  console.log(fail ? `[인쇄본빌드] 실패 ${fail}건` : `[인쇄본빌드] 완료 — ${targets.length}건 → docs/인쇄본/`);
  process.exit(fail ? 1 : 0);
}
main();
