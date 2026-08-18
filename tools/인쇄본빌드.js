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
 *  · 폰트는 **시스템 설치본에 기대지 않는다** — `docs/tools/브랜드폰트_임베드.py` 를 지나
 *    「쓰는 글자만」 서브셋해 HTML 에 심고 그걸 굽는다(2026-08-07 전환).
 *    🔴 왜: 초판은 설치본을 이름으로 불렀는데, 유호님 PC 에는 **Inter Tight 도 DM Mono 도
 *    설치돼 있지 않다**(`Inter`·`SUIT Variable` 뿐 · 실측). 그런데 초판의 폰트 검사는
 *    `fc-list` 기반이라 윈도우에서 **통째로 침묵**한다 — 여기서 재빌드하면 조용히 더 나빠졌다.
 *    임베드는 폰트 **파일**을 쓰므로 어느 기계에서 구워도 같고, 3종에 없는 글자는 빌드가 잡는다.
 *  · 브랜드 3종에 없는 글자는 `인쇄_치환` 으로 종이에서만 바꾼다(원문 md 는 불변).
 *    치환으로 뜻을 잃는 것(이모지 상태 언어·한자 어원 카드)만 폴백으로 남기고 목록을 찍는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { 칸나누기 } = require('./lib/표.js');   // 날 split 은 백틱 안 파이프에서 칸을 민다(F119·F253)
const 활자주입 = require('./lib/활자주입.js');   // 마커를 뿌리는 쪽과 확인하는 쪽이 같은 글자를 쓴다
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', '인쇄본');
const TOKENS = path.join(ROOT, 'docs', 'tools', 'synk-tokens.css');
const EMBED = path.join(ROOT, 'docs', 'tools', '브랜드폰트_임베드.py');

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
  /* C. 경영 정본 — **기본 굽기에서 뺀다**(유호 픽 08-17 「ㄹ」= 분모 축소).
   *   이 다섯은 «유호님 혼자 읽는» 문서다. 남에게 건네지도, 인쇄해 옆에 두지도 않는다.
   *   그러면 PDF 일 이유가 없고, 바탕화면은 **정본 바로가기**로 두는 편이 낫다 —
   *   바로가기는 원본을 가리키므로 **낡을 수가 없다**(사본은 낡는다 · `운영자료.js` 머리말 ②).
   *   🔑 지우지 않고 `기본:false` 로 둔 이유: 이름을 대면(`인쇄본빌드.js 철학`) 여전히 구워진다.
   *      「대외에 건넬 일이 생기는 날」이 있고, 그때 매니페스트를 다시 짜게 만들면 그 자리가 낡는다. */
  { src: 'docs/제품방향.md',               title: 'SYNK 제품 방향',             sub: '로드맵·「출시」의 정의·핵심 등식·설계 불변식', group: '경영 정본', 기본: false },
  { src: 'docs/SYNK_철학.md',              title: 'SYNK 철학 — 내부·운영 / 교육 / 대외', sub: '철학 3벌 — 유호님 확정 화법 · 새 슬로건', group: '경영 정본', 기본: false },
  { src: 'docs/기업철학_홈페이지_v1.md',   title: 'SYNK 기업 철학',             sub: '대외 철학 문서(홈페이지본)',             group: '경영 정본', 기본: false },
  { src: 'docs/조직계보_정본_v1.md',       title: 'SYNK 조직 계보',             sub: '브랜드 4 + 전사 레이어 2 — 로드맵 표기', group: '경영 정본', 기본: false },
  { src: 'docs/개원재무_2027_재산정_v1.md', title: '개원 재무 재산정 (2027)',   sub: '고정비·BEP·좌석 — 내부용',               group: '경영 정본', 기본: false },
  // D. 교육 설계
  { src: 'docs/커리큘럼_정본_v1.md',       title: 'SYNK 커리큘럼 정본',         sub: '6레벨 학습설계·실라버스·평가 루브릭',    group: '교육 설계' },
  { src: 'docs/반편성_정본_v2.md',         title: '반편성 정본',                sub: '4실 24반·정원 16·384석·BEP 119명',      group: '교육 설계' },
  { src: 'docs/홍보_트리오_정본_v1.md',    title: '홍보 트리오 정본',           sub: '대외 메시지 축 — 질문·스스로·마음',      group: '교육 설계' },
];

/* ── 인쇄 치환표 — 화면(md)은 그대로, 종이에서만 바꾼다 ────────────────────
 * 대상 = 브랜드 3종(Inter Tight·SUIT·DM Mono) 어디에도 없어 **폴백이 확정된** 글자 중
 * 뜻을 잃지 않고 바꿀 수 있는 것. 목록은 추측이 아니라 전수 실측이다(폰트 cmap 합집합
 * 13,773종 ∩ 매니페스트 16종 원문 → 고아 63종 = 이모지 47 + 그 밖 16).
 * 🚫 여기 넣지 않은 것 — 이모지 47종(✅🔴⏳ 같은 상태 언어 · 바꾸면 문서가 뜻을 잃고,
 *    어차피 어느 텍스트 폰트에도 없어 OS 가 컬러로 그린다).
 * ⛔ **옛 글자(한자·가나)는 치환하지 않는다 — 원문에서 없앤다.** 2026-08-07 유호님 확정:
 *    쓰는 문자는 **한글·몽골어·영어 셋뿐**이다. 종이에서만 바꾸면 화면(md)엔 남아 정책이
 *    반쪽이 되므로, 옛 글자는 아래 게이트가 잡아 **빌드를 깬다**(예외 등재 없음).
 *    어원 묶음 카드도 「생 = 살다 → 생활·학생」 식 뿌리 음절로 원문을 고쳤다(커리큘럼 정본 §6-2).
 *    ⚠ 이 파일에도 그 글자를 **적지 않는다** — 규칙을 설명하려고 예시를 박으면 가드가 자기 소스에
 *      걸린다(회귀 `tests/문서문자.test.js`). 필요하면 코드포인트로 쓴다.
 * 순서가 중요하다 — 앞의 규칙이 만든 글자를 뒤가 다시 건드리지 않게 좁은 것부터 둔다. */
const 인쇄_치환 = [
  [/[├└]─/g, '+- '],            // 조직계보 트리 — 구조는 들여쓰기가 지므로 ASCII 로 충분
  [/─/g, '-'],
  [/≡/g, '='],                   // 「≡(모든 시트) 버튼」 — 괄호 설명이 뜻을 이미 진다
  [/ⓐ/g, '(a)'], [/ⓑ/g, '(b)'], [/ⓒ/g, '(c)'], [/ⓓ/g, '(d)'],
  /* 원 문자 한글 — 철학 정본이 층 이름으로 쓴다(이해 세 층 ㉠㉡㉢ · 증보 갈래 ㉮㉯㉰).
   * 🔴 ①②③④ 로 뭉치면 안 된다 — 같은 문서가 「똑똑하게」 4층을 ①②③④ 로 이미 쓰고 있어
   *    두 축이 종이에서 한 글자로 겹친다(뜻을 잃는다 = 치환 대상이 아니라 폴백 대상이 된다).
   *    그래서 괄호+낱자로 푼다 — 축이 갈린 채 남고, 낱자는 SUIT 에 있다(게이트가 실측한다). */
  [/㉠/g, '(ㄱ)'], [/㉡/g, '(ㄴ)'], [/㉢/g, '(ㄷ)'], [/㉣/g, '(ㄹ)'],
  [/㉮/g, '(가)'], [/㉯/g, '(나)'], [/㉰/g, '(다)'],
  /* 내림 괄호 — 짝을 통째로 바꿔 **뜻을 정확히** 옮긴다(한쪽만 바꾸면 수식이 반쪽이 된다).
   * 화면(md)은 수식 표기 그대로 두는 것이 맞고, 종이에서만 낱말로 편다 — 이 표의 목적 그대로.
   * `내림`을 쓰는 이유: 이 수식을 읽는 사람이 강사다(floor 는 읽는 사람의 낱말이 아니다). */
  [/⌊([^⌋]*)⌋/g, '내림($1)'],
  [/＿/g, '__'],                 // 전각 밑줄(서명란) → 반각 2배로 폭 보존
  [/☐/g, '[  ]'],               // 동의 체크박스 — 브랜드 3종에 없어 폰트를 깔아도 폴백한다
];
function 치환(md) { return 인쇄_치환.reduce((s, [re, to]) => s.replace(re, to), md); }

/* 폴백은 허용하되 **아는 폴백만** 허용한다 — 새 글자가 들어오면 그건 치환표가 놓친 것이고,
 * 조용히 통과시키면 초판이 밟은 자리로 되돌아간다(폰트 경고를 아무도 안 봤다).
 * 이모지는 어느 텍스트 폰트에도 없으니 유니코드 속성으로 판정하고(손 목록은 반드시 낡는다),
 * 그 밖의 예외는 이유가 있는 것만 이름으로 둔다. */
const 폴백_예외 = new Set(['️']);   // 이모지 변이 선택자(U+FE0F) — 앞 글자에 딸려 오는 꼬리표뿐
function 폴백_점검(임베드출력) {
  const 줄 = (임베드출력.match(/^⚠ .*$/m) || [])[0];
  if (!줄) return [];
  // 🔑 표시된 글자가 아니라 **코드포인트**로 복원한다 — `(\S)` 로 잡으면 이모지가 서로게이트
  // 페어의 뒤 유닛만 물려 전부 「모르는 글자」가 된다(2026-08-07 실측: 16종 중 14종 오판).
  // 콘솔 인코딩이 글자를 깨도 U+XXXX 는 안 깨진다 — 재는 층이 값을 깨뜨리면 안 된다.
  const 글자 = [...new Set((줄.match(/U\+[0-9A-F]{4,6}/g) || [])
    .map((m) => String.fromCodePoint(parseInt(m.slice(2), 16))))];
  return 글자.filter((c) => !/\p{Extended_Pictographic}/u.test(c) && !폴백_예외.has(c));
}

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
      const cells = (r) => 칸나누기(r).map(inline);
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
${활자주입.마커}
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

/**
 * 무엇을 구울 것인가 — **순수 함수로 꺼내 둔다**(main 안에 두면 회귀가 원리상 못 본다).
 * 🔑 이름을 «대면» 기본 갈래를 넘어 굽는다 — 안 대면 `기본:false` 는 빠진다(유호 픽 08-17 「ㄹ」).
 *    두 자리를 가르는 이유: 「전량 재굽기」의 분모와 「이거 하나 달라」의 분모는 다르다.
 *    합치면 둘 중 하나가 반드시 틀린다(전량이 5벌을 헛굽거나, 지목이 5벌을 못 굽거나).
 * @param {string} [filter] 이름 부분일치. 없으면 기본 갈래 전량.
 */
function 굽을것(filter) {
  return filter
    ? MANIFEST.filter((d) => d.src.includes(filter) || d.title.includes(filter))
    : MANIFEST.filter((d) => d.기본 !== false);
}

/* ── 빌드 ── */
function main() {
  /* 🔑 이 도구는 **위치 인자만** 받는다 — 그래도 게이트를 건다. 모르는 `--` 낱말이 조용히
   *   지나가면 사람은 자기가 부탁한 좁힘이 먹은 줄 알고, 그게 이 트랙의 병이다. */
  const 아는플래그 = [];
  /* ⚠ `--pdf`·`--폴백허용` 은 **파이썬 자식**에 넘기는 낱말이라 여기 없다(298줄 spawn). */
  const 플래그오류 = 인자게이트('인쇄본빌드', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const filter = process.argv[2];
  const targets = 굽을것(filter);
  if (!targets.length) { console.error('[인쇄본빌드] 매니페스트에 일치 항목이 없다: ' + filter); process.exit(1); }
  const py = ['python', 'python3'].find((p) => {
    try { execFileSync(p, ['-c', 'import fontTools'], { stdio: 'pipe' }); return true; } catch (_) { return false; }
  });
  if (!py) { console.error('[인쇄본빌드] python + fontTools 가 없다 — 임베드 통로가 필수다(설치본에 기대지 않는다)'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-print-'));
  const snapDate = new Date().toISOString().slice(0, 10);
  let fail = 0;
  for (const doc of targets) {
    const srcPath = path.join(ROOT, doc.src);
    if (!fs.existsSync(srcPath)) { console.error('✗ 원본 없음: ' + doc.src); fail++; continue; }
    const md = fs.readFileSync(srcPath, 'utf8');
    const html = pageHtml(doc, renderMd(치환(md)), snapDate);
    const base = path.basename(doc.src).replace(/\.md$/, '');
    const htmlPath = path.join(tmp, base + '.html');
    const pdfPath = path.join(OUT_DIR, base + '.pdf');
    fs.writeFileSync(htmlPath, html);
    try {
      // 임베드 통로가 굽는다 — 3종에 없는 글자는 `--폴백허용` 이라 깨지 않고 **목록을 찍는다**
      const r = execFileSync(py, [EMBED, htmlPath, path.join(tmp, base + '.embed.html'),
        '--pdf', pdfPath, '--폴백허용'], { encoding: 'utf8', stdio: 'pipe', timeout: 180000 });
      const 샌것 = 폴백_점검(r);
      const kb = Math.round(fs.statSync(pdfPath).size / 1024);
      if (샌것.length) {
        console.error(`✗ ${base}.pdf (${kb}KB) — 치환표가 못 걷은 글자: `
          + 샌것.map((c) => `${c} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' '));
        fail++;
      } else console.log(`✓ ${base}.pdf (${kb}KB)`);
    } catch (e) {
      const 말 = (e.stdout || '') + (e.stderr || '') || e.message || String(e);
      console.error('✗ 굽기 실패: ' + base + ' — ' + 말.trim().split('\n').slice(-3).join(' / '));
      fail++;
    }
  }
  console.log(fail ? `[인쇄본빌드] 실패 ${fail}건` : `[인쇄본빌드] 완료 — ${targets.length}건 → docs/인쇄본/`);
  process.exit(fail ? 1 : 0);
}
if (require.main === module) main();
module.exports = { 치환, 폴백_점검, 인쇄_치환, MANIFEST, 굽을것 };
