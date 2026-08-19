#!/usr/bin/env node
/* 시스템대장 — 「지금 무엇이 갖춰져 있나」(docs/시스템_대장.md 정본)를 지키고, 바탕화면 두 장으로 굽는다.
 *
 * 왜 있나 (2026-08-05 유호님: "새 기능 추가하거나 구축할 때마다 기록을 남기는 시스템을 만들고 싶어"):
 *   기록은 이미 넘쳤다 — 버전 이력 131항목·커밋 979개·보드 아카이브. 전부 개발자 언어라 유호님이 못 연다.
 *   그래서 새 장부를 만들지 않고 **채번 게이트(bump-version --종류)가 대외 언어 한 줄을 강제로 받게** 했고,
 *   이 도구는 그 정본을 두 장(내부판=전 구역+기술 상세 / 대외판=(대외) 구역만)으로 렌더한다.
 *   시간순 일지가 아니라 **현재형 부품 목록**이다 — 유호님이 실제로 묻는 것은 "언제 했나"가 아니라
 *   "내가 지금 뭘 갖고 있나"다(몽골 검수자 채용·투자자·파트너 설명 전부 이 질문).
 *
 * 사용법:
 *   node tools/시스템대장.js --check    정본 형식 검증(CI·훅 — repo 파일만 보므로 어디서든 돈다)
 *   node tools/시스템대장.js --render   바탕화면 SYNK_지도 에 내부판·대외판 HTML+PDF 굽기(+README 표)
 *
 * 기입은 이 CLI 가 아니라 bump-version 이 한다(잊을 수 있는 통로는 통로가 아니다):
 *   node tools/bump-version.js --desc "…" --종류 신설 --시스템 "이름" --한줄 "…" --구역 "접수·상담"
 *
 *   node tools/시스템대장.js --소급 --구역 … --시스템 … --한줄 … --시작 "[v9.38]" [--최근 …] [--상태 "🟢 Glide 의존"]
 *     예외로 여기 있는 유일한 기입 경로 = **소급 등재**(이미 라이브인데 대장에 줄이 없던 것).
 *     코드가 안 바뀌니 태울 번호가 없어 채번을 안 한다 — 새로 만드는 것에 쓰면 안 된다.
 *
 * ⚠ 렌더는 repo 밖(바탕화면)을 쓰므로 CI·클라우드엔 폴더가 없다 — 그때는 통과가 아니라 skip 으로
 *   드러낸다(지도대장과 같은 원칙). PDF 폰트 게이트(--mono 맨 앞 Consolas)도 지도대장 것을 그대로 진다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 칸나누기 } = require('./lib/표.js');   // 날 split 은 백틱 안 파이프에서 칸을 민다(F119·F253)

const ROOT = path.resolve(process.env.SYNK_대장_ROOT || path.join(__dirname, '..'));
const 상태허용 = ['🟢', '🟡', '⚪'];

function 대장경로(root) { return path.join(root || ROOT, 'docs', '시스템_대장.md'); }
function 이력경로(root) { return path.join(root || ROOT, 'docs', '버전_이력.md'); }

const eolOf = (s) => (s.includes('\r\n') ? '\r\n' : '\n');

/* ── 파싱 ─────────────────────────────────────────────────────────────────
 * 구역 머리 = `## 이름 (대외)` / `## 이름 (내부)` — 대외판 노출은 구역 단위다.
 * 행 = 5칸 표: | 상태 | 시스템 | 한 줄 | 시작 | 최근 | */
function 파싱(md) {
  const 구역들 = [];
  const 문제 = [];
  let 현재 = null;
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^##\s+(.+?)\s+\((대외|내부)\)\s*$/);
    if (h) { 현재 = { 이름: h[1], 노출: h[2], 행들: [], 머리줄: i }; 구역들.push(현재); continue; }
    if (/^##\s/.test(line)) { 문제.push(`${i + 1}행: 구역 머리에 (대외)/(내부) 표기가 없다 — 「${line}」`); 현재 = null; continue; }
    if (!/^\|/.test(line)) continue;
    const cells = 칸나누기(line);   // 양끝 파이프는 이 통로가 뗀다
    if (cells.length !== 5) { 문제.push(`${i + 1}행: 칸이 5개가 아니다(${cells.length}개)`); continue; }
    if (/^-+$/.test(cells[0].replace(/\s/g, '')) || cells[0] === '상태') continue; // 헤더·구분선
    if (!현재) { 문제.push(`${i + 1}행: 구역 밖의 행 — 어느 판에 실릴지 모른다`); continue; }
    현재.행들.push({ 상태: cells[0], 시스템: cells[1], 한줄: cells[2], 시작: cells[3], 최근: cells[4], 줄번호: i });
  }
  return { 구역들, 문제 };
}

function 검증(파싱결과) {
  const 문제 = [...파싱결과.문제];
  const 본이름 = new Map();
  for (const 구 of 파싱결과.구역들) {
    if (!구.행들.length) 문제.push(`구역 「${구.이름}」이 비어 있다`);
    for (const 행 of 구.행들) {
      if (!상태허용.some((s) => 행.상태.startsWith(s)))
        문제.push(`${행.줄번호 + 1}행: 상태가 🟢/🟡/⚪ 로 시작하지 않는다 — 「${행.상태}」`);
      if (!행.시스템) 문제.push(`${행.줄번호 + 1}행: 시스템 이름이 비었다`);
      if (!행.한줄) 문제.push(`${행.줄번호 + 1}행: 한 줄이 비었다 — 이 줄이 이 대장의 존재 이유다`);
      if (Array.from(행.한줄).length > 200)
        문제.push(`${행.줄번호 + 1}행: 한 줄이 200자를 넘는다 — 계기판은 문단이 아니라 줄이다`);
      if (!행.시작 || !행.최근) 문제.push(`${행.줄번호 + 1}행: 시작/최근 칸이 비었다(모르면 ~v9.36 나 날짜로)`);
      if (본이름.has(행.시스템))
        문제.push(`${행.줄번호 + 1}행: 시스템 「${행.시스템}」 중복(먼저 ${본이름.get(행.시스템) + 1}행) — 값이 두 곳이면 갈린다`);
      else 본이름.set(행.시스템, 행.줄번호);
    }
  }
  return 문제;
}

/* ── 기입 — bump-version 의 채번 게이트가 부른다 ─────────────────────────── */

/** 채번 **전** 검증 — 여기서 throw 해야 번호가 안 탄다. 통과하면 아무것도 안 쓴다. */
function 신설검증(md, { 구역, 시스템, 한줄 }) {
  for (const [k, v] of Object.entries({ 구역, 시스템, 한줄 }))
    if (!v || !String(v).trim()) throw new Error(`--${k} 값이 비었다`);
  for (const [k, v] of Object.entries({ 시스템, 한줄 }))
    if (String(v).includes('|')) throw new Error(`--${k} 에 '|' 는 못 쓴다(표가 깨진다)`);
  const p = 파싱(md);
  const 구 = p.구역들.find((g) => g.이름 === 구역);
  if (!구) throw new Error(`구역 「${구역}」이 대장에 없다 — 있는 구역: ${p.구역들.map((g) => g.이름).join(' · ') || '(없음)'}`);
  for (const g of p.구역들)
    for (const 행 of g.행들)
      if (행.시스템 === 시스템)
        throw new Error(`시스템 「${시스템}」은 이미 있다(구역 ${g.이름}) — 새 시스템이 아니면 --종류 보강 --시스템 "${시스템}"`);
  return true;
}

/** 신설 행을 해당 구역 표의 맨 아래에 붙인다. 반환 = 새 md.
 *  상태·시작·최근은 **소급 등재 전용** 선택 인자다(2026-08-06) — 이미 라이브인데 대장에 줄이 없던 것을
 *  넣을 때 쓴다. 채번 게이트(--종류 신설)는 이 셋을 주지 않으므로 종전대로 🟡 반영 대기 + 새 버전이 박힌다.
 *  왜 필요했나: 소급분에 게이트를 그대로 쓰면 ①이미 🟢인 것이 🟡로 ②시작이 과거인데 새 버전으로 붙고
 *  ③라이브 코드 0줄인데 번호를 태운다 — 따를 수 없는 처방은 손 편집이라는 우회를 정상 통로로 만든다(F103). */
function 기입(md, { 구역, 시스템, 한줄, 버전, 상태, 시작, 최근 }) {
  신설검증(md, { 구역, 시스템, 한줄 });
  const eol = eolOf(md);
  const lines = md.split(/\r?\n/);
  const p = 파싱(md);
  const 구 = p.구역들.find((g) => g.이름 === 구역);
  // 표의 끝 = 구역 머리 이후 마지막 `|` 줄 (행이 아직 없으면 구분선 줄)
  let 끝 = 구.머리줄;
  for (let i = 구.머리줄 + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    if (/^\|/.test(lines[i])) 끝 = i;
  }
  if (끝 === 구.머리줄) throw new Error(`구역 「${구역}」에 표가 없다 — 정본 형식이 깨져 있다(--check)`);
  const 태그 = (v) => (/^v9\./.test(v) ? `[${v}]` : v);
  lines.splice(끝 + 1, 0,
    `| ${상태 || '🟡 반영 대기'} | ${시스템} | ${한줄} | ${태그(시작 || 버전)} | ${태그(최근 || 시작 || 버전)} |`);
  const 새md = lines.join(eol);
  // 결과 검사 — 상태 값·표 깨짐·중복을 개별 검증으로 나열하지 않고 기존 검증기 하나에 맡긴다.
  // 갈라질 목록을 만들지 않는 게 목적이다(같은 판정을 두 곳에 적으면 갈라진다).
  const 문제 = 검증(파싱(새md));
  if (문제.length) throw new Error('기입 결과가 형식 검증에 걸렸다 — 아무것도 쓰지 않았다:\n  ' + 문제.join('\n  '));
  return 새md;
}

/** 보강 — 기존 행의 「최근」 칸을 새 버전으로. 반환 = 새 md. */
function 최근갱신(md, { 시스템, 버전 }) {
  const eol = eolOf(md);
  const lines = md.split(/\r?\n/);
  const p = 파싱(md);
  for (const g of p.구역들) {
    for (const 행 of g.행들) {
      if (행.시스템 !== 시스템) continue;
      const 태그 = /^v9\./.test(버전) ? `[${버전}]` : 버전;
      lines[행.줄번호] = `| ${행.상태} | ${행.시스템} | ${행.한줄} | ${행.시작} | ${태그} |`;
      return lines.join(eol);
    }
  }
  throw new Error(`시스템 「${시스템}」이 대장에 없다 — 신설이면 --종류 신설, 이름은 대장과 글자까지 같아야 한다`);
}

/* ── 렌더 ───────────────────────────────────────────────────────────────── */

/** 버전_이력.md → Map('v9.186' → 제목 한 줄). 내부판 기술 상세가 여기서 나온다(중복 기록 금지). */
function 이력제목맵(이력md) {
  const map = new Map();
  for (const line of 이력md.split(/\r?\n/)) {
    const m = line.match(/^- \*\*\[(v9\.\d+)\]\*\*\s*(.*)/);
    if (m) map.set(m[1], Array.from(m[2].replace(/\*\*/g, '')).slice(0, 90).join(''));
  }
  return map;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function 집계(파싱결과, 노출필터) {
  let 전체 = 0, 라이브 = 0, 대기 = 0;
  for (const g of 파싱결과.구역들) {
    if (노출필터 && g.노출 !== 노출필터) continue;
    for (const 행 of g.행들) {
      전체 += 1;
      if (행.상태.startsWith('🟢')) 라이브 += 1;
      else if (행.상태.startsWith('🟡')) 대기 += 1;
    }
  }
  return { 전체, 라이브, 대기 };
}

/* 폰트 규칙 — 산세리프는 브랜드 킷 순서(Inter Tight→SUIT), 모노는 지도대장 PDF 게이트가
 * Consolas 맨 앞을 기계로 요구한다(ui-monospace 를 앞세우면 임베드가 아예 안 된다 · 실측). */
const 공통CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: var(--sans); background: var(--bg); color: var(--tx); line-height: 1.55;
         -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 44px 24px 72px; }
  @page { margin: 10mm; }
  @media print { .wrap { padding: 0; max-width: none; } section { break-inside: avoid-page; } }
`;

/** 내부판 — 유호님 계기판. 전 구역 + 기술 상세(버전 이력 제목) 접힘. */
function 내부HTML(파싱결과, 제목맵, { 날짜, 도장 }) {
  const c = 집계(파싱결과);
  const 구역html = 파싱결과.구역들.map((g) => {
    const rows = g.행들.map((행) => {
      const 태그들 = [행.시작, 행.최근].filter((t, i, a) => a.indexOf(t) === i);
      const 상세 = 태그들
        .map((t) => { const v = (t.match(/\[?(v9\.\d+)\]?/) || [])[1]; return v && 제목맵.get(v) ? `<span class="vt">[${v}]</span> ${esc(제목맵.get(v))}` : null; })
        .filter(Boolean).join('<br>');
      const dot = 행.상태.startsWith('🟢') ? 'on' : 행.상태.startsWith('🟡') ? 'wait' : 'plan';
      const 사유 = 행.상태.replace(/^[🟢🟡⚪]\s*/u, '');
      return `<div class="row">
        <div class="st"><i class="dot ${dot}"></i>${사유 ? `<em>${esc(사유)}</em>` : ''}</div>
        <div class="nm">${esc(행.시스템)}</div>
        <div class="ln">${esc(행.한줄)}</div>
        <div class="vr">${esc(행.시작)}${행.최근 !== 행.시작 ? ` → ${esc(행.최근)}` : ''}</div>
        ${상세 ? `<details class="dt"><summary>기술 상세</summary><div>${상세}</div></details>` : ''}
      </div>`;
    }).join('\n');
    return `<section><h2>${esc(g.이름)} <span class="scope">${g.노출}</span></h2>\n${rows}</section>`;
  }).join('\n');

  return `<!-- 파생: docs/시스템_대장.md${도장 ? '@' + 도장 : ''} -->
<title>SYNK 시스템 대장 — 내부판</title>
<style>
  :root {
    /* 킷 23색만. 08-06 에 회색을 통째로 걷어냈더니 글자 위계가 3단→2단으로 줄었고 유호님이 렌더로
     * 지적했다 — 그래서 08-07 에 킷이 「06 Slate」를 얻었다(컨셉 정본 조항 ⓔ).
     * 1층 --tx(Cream) · 2층 --dim(Cream 3) · 3층 --mute(Slate). 3층은 판번호·라벨·주석 몫이다.
     * 🔴 --mute 는 **다크 전용**이다(Slate on Paper 2.86). 이 템플릿의 바닥 3면 전부 통과:
     *    --bg 5.78 · --card 5.05 · legend 의 wash 합성면 4.98. */
    --bg: #08090C; --card: #262626; --line: #373737;
    --tx: #E4E4E7; --dim: #D1D2D4; --mute: #8C8C8C;
    --sig: #FF6B5C; --wash: rgba(255,107,92,.12);
    --sans: 'Inter Tight', 'SUIT Variable', -apple-system, 'Segoe UI',
            'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    /* Consolas 맨 앞 — 지도대장 PDF 폰트 게이트(뒤로 밀면 인쇄본에서 계기판 성격이 죽는다) */
    --mono: Consolas, 'DM Mono', 'Cascadia Mono', ui-monospace, 'Malgun Gothic', monospace;
  }
  ${공통CSS}
  .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: .18em; color: var(--sig); }
  h1 { font-size: 32px; font-weight: 800; letter-spacing: -.02em; margin: 8px 0 4px; }
  .sub { color: var(--dim); font-size: 13.5px; }
  .strip { display: flex; gap: 26px; margin: 22px 0 8px; padding: 14px 18px;
           background: var(--card); border: 1px solid var(--line); border-radius: 10px; }
  .strip b { display: block; font-family: var(--mono); font-size: 24px; font-weight: 700; }
  .strip span { font-size: 11.5px; color: var(--mute); }
  .strip .sig b { color: var(--sig); }
  section { margin-top: 30px; }
  h2 { font-size: 13px; letter-spacing: .12em; color: var(--dim); text-transform: uppercase;
       border-bottom: 1px solid var(--line); padding-bottom: 7px; margin-bottom: 4px; }
  h2 .scope { float: right; font-family: var(--mono); font-size: 10.5px; color: var(--mute); letter-spacing: .06em; }
  .row { display: grid; grid-template-columns: 108px 172px 1fr 122px; gap: 0 14px;
         align-items: baseline; padding: 9px 6px; border-bottom: 1px solid var(--line); }
  .row:last-child { border-bottom: 0; }
  .st { font-size: 10.5px; color: var(--mute); display: flex; align-items: baseline; gap: 6px; }
  .st em { font-style: normal; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; align-self: center; }
  .dot.on { background: var(--sig); } .dot.wait { background: none; border: 2px solid var(--sig); }
  /* 설계만 = 신호 없음. 코랄(신호)을 빼고 보조 잉크 테두리로 — 회색을 새로 들이지 않는다 */
  .dot.plan { background: none; border: 2px solid var(--dim); width: 5px; height: 5px; }
  .nm { font-weight: 700; font-size: 14.5px; }
  .ln { font-size: 13px; color: var(--dim); }
  .vr { font-family: var(--mono); font-size: 11px; color: var(--mute); text-align: right; }
  .dt { grid-column: 2 / 5; font-size: 11.5px; color: var(--mute); margin-top: 2px; }
  .dt summary { cursor: pointer; font-family: var(--mono); font-size: 10.5px; }
  .dt .vt { font-family: var(--mono); color: var(--mute); }
  @media print { .dt { display: none; } }
  .legend { margin-top: 34px; padding: 12px 16px; background: var(--wash); border-radius: 8px;
            font-size: 11.5px; color: var(--mute); }
  .legend code { font-family: var(--mono); }
</style>
<div class="wrap">
  <div class="eyebrow">SYNK · SYSTEM LEDGER</div>
  <h1>시스템 대장 — 내부판</h1>
  <div class="sub">지금 무엇이 갖춰져 있나 · ${esc(날짜)} 스냅샷 · 정본 = 저장소 docs/시스템_대장.md</div>
  <div class="strip">
    <div class="sig"><b>${c.전체}</b><span>시스템</span></div>
    <div><b>${c.라이브}</b><span>🟢 라이브</span></div>
    <div><b>${c.대기}</b><span>🟡 반영 대기</span></div>
    <div><b>${파싱결과.구역들.length}</b><span>구역</span></div>
  </div>
  ${구역html}
  <div class="legend">● 라이브 · ○ 반영 대기 · 흐린 테두리 = 설계만. 새 줄은 손이 아니라 채번 게이트가 붙인다 —
  <code>bump-version --종류 신설 --시스템 … --한줄 … --구역 …</code> 없이는 버전이 안 나간다.</div>
</div>`;
}

/** 대외판 — (대외) 구역만, 버전 태그 없이. 투자자·강사·파트너에게 그대로 보여주는 한 장. */
function 대외HTML(파싱결과, { 날짜, 도장 }) {
  const c = 집계(파싱결과, '대외');
  const 구역html = 파싱결과.구역들.filter((g) => g.노출 === '대외').map((g) => {
    const rows = g.행들.map((행) => `<div class="row${행.상태.startsWith('🟢') ? '' : ' wait'}">
      <div class="nm">${esc(행.시스템)}</div>
      <div class="ln">${esc(행.한줄)}${행.상태.startsWith('🟡') ? ' <em>(준비 중)</em>' : ''}</div>
    </div>`).join('\n');
    return `<section><h2>${esc(g.이름)}</h2>\n${rows}</section>`;
  }).join('\n');

  return `<!-- 파생: docs/시스템_대장.md${도장 ? '@' + 도장 : ''} -->
<title>SYNK 시스템 한 장</title>
<style>
  :root {
    /* 킷 23색만. 2층 --nv3(Navy 3) · 3층 --mute(Slate 2 · 08-07 조항 ⓔ).
     * 구 회색 #6B7186 을 되살린 것이 아니다 — 그 값은 Paper 4.53·Cream 4.31 로 미달이라
     * 명도만 내려 크림 3면을 통과시킨 값이 Slate 2 다(Paper 5.39 · Wash 4.95).
     * 🔴 --mute 는 **라이트 전용**이다(Slate 2 는 다크 바닥에서 3.07 로 미달). */
    --bg: #FAFAF9; --tx: #1B1B1A; --nv: #262626; --nv3: #373737; --mute: #666666;
    --line: #D1D2D4; --sig: #FF6B5C; --sig3: #E8543F; --wash: #FFE9E4;
    --sans: 'Inter Tight', 'SUIT Variable', -apple-system, 'Segoe UI',
            'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    /* Consolas 맨 앞 — 지도대장 PDF 폰트 게이트 */
    --mono: Consolas, 'DM Mono', 'Cascadia Mono', ui-monospace, 'Malgun Gothic', monospace;
  }
  ${공통CSS}
  .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: .2em; color: var(--nv3); }
  h1 { font-size: 34px; font-weight: 800; letter-spacing: -.02em; color: var(--nv); margin: 8px 0 6px; }
  h1 .sig { color: var(--sig3); }
  .sub { color: var(--nv3); font-size: 14px; max-width: 58ch; }
  .count { display: inline-block; margin-top: 18px; padding: 8px 14px; background: var(--wash);
           border-radius: 8px; font-size: 13px; color: var(--nv); }
  .count b { font-family: var(--mono); font-size: 17px; }
  section { margin-top: 30px; }
  h2 { font-size: 12.5px; letter-spacing: .14em; color: var(--nv3); text-transform: uppercase;
       padding-bottom: 7px; border-bottom: 2px solid var(--nv); margin-bottom: 2px; }
  .row { display: grid; grid-template-columns: 188px 1fr; gap: 0 16px; align-items: baseline;
         padding: 10px 4px; border-bottom: 1px solid var(--line); }
  .row:last-child { border-bottom: 0; }
  .nm { font-weight: 700; font-size: 14.5px; color: var(--nv);
        padding-left: 14px; position: relative; }
  .nm::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
                width: 7px; height: 7px; background: var(--sig); border-radius: 2px; }
  .wait .nm::before { background: none; border: 2px solid var(--sig); width: 5px; height: 5px; }
  .ln { font-size: 13.5px; color: var(--nv3); }
  .ln em { font-style: normal; color: var(--mute); font-size: 12px; }
  .foot { margin-top: 36px; padding-top: 12px; border-top: 2px solid var(--nv);
          font-size: 11.5px; color: var(--mute); display: flex; justify-content: space-between; }
  /* 워드마크 글리프 재구성 금지(킷 §4 — SVG 정본만) + 라이트 바탕 소형 코랄 글자 금지(철칙 ②) → 텍스트 표기만 */
  .foot .mk { font-family: var(--mono); font-weight: 700; color: var(--nv); letter-spacing: .08em; }
</style>
<div class="wrap">
  <div class="eyebrow">SYNK LAB · ULAANBAATAR</div>
  <h1>사람이 잊어도 시스템이 하는 일<span class="sig">.</span></h1>
  <div class="sub">SYNK 는 학원이 아니라 인프라를 짓고 있습니다 — 접수부터 수업·학부모 소통·데이터 축적까지,
  지금 자동으로 돌아가는 것들의 목록입니다.</div>
  <div class="count">가동 중 <b>${c.라이브}</b>종${c.대기 ? ` · 준비 중 ${c.대기}종` : ''}</div>
  ${구역html}
  <div class="foot"><span>${esc(날짜)} 기준 · 이 목록은 시스템이 스스로 갱신합니다</span><span class="mk">SYNK LAB</span></div>
</div>`;
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

function 오늘() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function 정본도장() {
  try {
    const { execFileSync } = require('child_process');
    return execFileSync('git', ['-c', 'core.quotepath=false', 'log', '-1', '--format=%h', '--', 'docs/시스템_대장.md'],
      { cwd: ROOT, encoding: 'utf8' }).trim() || null;
  } catch (_) { return null; }
}

function main(argv) {
  const md = fs.readFileSync(대장경로(), 'utf8');
  const p = 파싱(md);
  const 문제 = 검증(p);

  if (argv.includes('--check')) {
    if (문제.length) { 문제.forEach((m) => console.error('✗ ' + m)); return 1; }
    const c = 집계(p);
    console.log(`✅ 시스템 대장 — ${c.전체}종(🟢${c.라이브}·🟡${c.대기}) · 구역 ${p.구역들.length} · 형식 문제 0`);
    return 0;
  }

  /* 소급 등재 — 「이미 라이브인데 대장에 줄이 없던 것」 전용. 채번을 안 한다(코드가 안 바뀌므로 태울 번호가 없다).
   * 새로 만드는 시스템은 여기가 아니라 채번 게이트로: bump-version --종류 신설 --시스템 … --한줄 … --구역 … */
  if (argv.includes('--소급')) {
    const 값 = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
    const 시작 = 값('--시작');
    if (!시작) throw new Error('--소급 에는 --시작 이 필요하다 — 이미 있던 것이라 오늘 버전을 박으면 대장이 거짓말을 한다\n'
      + '    예: --소급 --구역 "수업 운영" --시스템 "이름" --한줄 "대외 언어 한 줄" --시작 "[v9.38]" --상태 "🟢 Glide 의존"');
    const spec = { 구역: 값('--구역'), 시스템: 값('--시스템'), 한줄: 값('--한줄'),
      상태: 값('--상태') || '🟢', 시작, 최근: 값('--최근') || 시작, 버전: 시작 };
    fs.writeFileSync(대장경로(), 기입(md, spec), 'utf8');
    console.log(`✅ 소급 등재 — ${spec.구역} / ${spec.시스템} | ${spec.상태} | ${spec.시작} → ${spec.최근}`);
    return 0;
  }

  if (argv.includes('--render')) {
    if (문제.length) { 문제.forEach((m) => console.error('✗ ' + m)); console.error('깨진 정본은 굽지 않는다 — 위부터 고쳐라'); return 1; }
    const 지도대장 = require('./지도대장.js');
    const dir = 지도대장.지도폴더();
    if (!fs.existsSync(dir)) {
      console.log(`[시스템대장] skip — 지도 폴더가 없다: ${dir} (CI·클라우드 세션. 통과가 아니라 미실행이다)`);
      return 0;
    }
    let 이력 = '';
    try { 이력 = fs.readFileSync(이력경로(), 'utf8'); } catch (_) {}
    const 도장 = 정본도장();
    if (!도장) console.error('⚠ 정본이 아직 커밋 안 됐다 — 도장 없이 굽는다(커밋 후 다시 --render 하면 도장이 박힌다)');
    const 메타 = { 날짜: 오늘(), 도장 };
    const 쌍 = [
      [`${메타.날짜}_시스템_대장.html`, 내부HTML(p, 이력제목맵(이력), 메타)],
      [`${메타.날짜}_SYNK_시스템_한장.html`, 대외HTML(p, 메타)],
    ];
    let 실패 = 0;
    for (const [이름, html] of 쌍) {
      const hp = path.join(dir, 이름);
      fs.writeFileSync(hp, html, 'utf8');
      const r = 지도대장.굽기(hp);
      if (r.ok) console.log(`✅ ${이름} + PDF (${r.크기.toLocaleString()} 바이트 · 폰트 ${r.폰트.length}종)`);
      else { 실패 += 1; console.error(`🔴 ${이름} — ${r.이유}`); }
    }
    // 낡은 스냅샷 안내(삭제는 사람 몫 — 지우셔도 됩니다가 폴더 규칙이다)
    const 구판 = fs.readdirSync(dir).filter((f) =>
      /^\d{4}-\d{2}-\d{2}_(시스템_대장|SYNK_시스템_한장)\.(html|pdf)$/.test(f) && !f.startsWith(메타.날짜));
    if (구판.length) console.log(`ℹ 낡은 스냅샷 ${구판.length}개가 남아 있다(지워도 된다): ${구판.join(', ')}`);
    const 훑 = 지도대장.훑기(dir);
    지도대장.리드미갱신(dir, 훑.지도들);
    return 실패 ? 1 : 0;
  }

  console.log('사용법: node tools/시스템대장.js --check | --render');
  return 문제.length ? 1 : 0;
}

module.exports = { 대장경로, 이력경로, 파싱, 검증, 신설검증, 기입, 최근갱신, 이력제목맵, 내부HTML, 대외HTML, 집계 };

if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
