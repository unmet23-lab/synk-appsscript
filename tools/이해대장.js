#!/usr/bin/env node
/**
 * 이해대장 — 철학 정본 부록 A 를 **한 장의 색 화면**으로 그린다.
 *
 * 왜 있나 (2026-08-12 · 유호님 아이디어 「옵시디언 화면처럼 색상을 지정해 한눈에 파악」):
 *   부록 A 는 표 두 개라 「무엇이 있다」는 읽히는데 **「어디가 비었다」가 안 읽힌다.**
 *   특히 A-1 의 ㉡(사람 이해) 「돈다」 칸이 비어 있는 것 — 그게 우리 회사가 존재하는 이유인데
 *   마크다운 표에서는 다른 칸과 똑같은 무게로 지나간다. 색은 장식이 아니라 **진단**이다.
 *
 * 설계 세 가지:
 *   ① **정본에서 «파싱»한다 — 사본을 두지 않는다.** 여기 데이터를 베끼면 정본이 개정될 때
 *      화면만 낡아, 「비었다」가 실제로는 채워졌는데도 빨간 채로 남는다(philosophy-card 와 같은 규칙).
 *   ② **색은 브랜드 킷에서만.** 유호님 확정 — 색/폰트는 킷만. 임의 색을 쓰면 이 화면이
 *      「우리 것이 아닌 화면」이 되고, 그 순간 대외에 못 쓴다. 대비 규칙도 DESIGN.md 를 따른다
 *      (KC Sun 은 글자 금지 → 면으로만 · Emerald 는 라이트 전용, 면으로 깔면 글자는 Cream·Paper).
 *   ③ **못 읽으면 조용히 넘어가지 않는다.** 표를 못 찾았는데 빈 화면을 내면 「비어 있음」과
 *      「못 읽음」이 같은 모양이 된다(F207). 무엇이 왜 안 됐는지 말하고 비정상 종료한다.
 *
 * 쓰기: node tools/이해대장.js            → docs/이해대장.html 생성
 *      node tools/이해대장.js --바로가기  → 생성 + 바탕화면 「SYNK 운영자료」에 .lnk
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..');
const 정본경로 = path.join(ROOT, 'docs', 'SYNK_철학.md');
const 산출경로 = path.join(ROOT, 'docs', '이해대장.html');

/** 브랜드 킷 — DESIGN.md §1 이 정본. 여기 있는 것은 «인용»이고, 새 색을 만들지 않는다. */
const 킷 = {
  paper: '#FBF7EE', ink: '#171820', navy: '#1A2340', navy2: '#0F1730', navy3: '#2A3358',
  cream: '#F6F1E8', cream3: '#E7DDC7', slate2: '#5F657D',
  coral: '#FF6B5C', coral3: '#E8543F', coralWash: '#FFE9E4',
  sun: '#FFD447', emerald: '#13724A',
};

/** 상태 칸 → 색. 「비었다」가 가장 눈에 띄어야 한다 — 그게 이 화면의 목적이다. */
const 상태색 = {
  돈다:        { 면: 킷.emerald, 글자: 킷.cream },
  '짓고 있다': { 면: 킷.sun,     글자: 킷.ink },
  '아직 없다': { 면: 킷.coral,   글자: 킷.navy2 },
  '개원과 함께 연다': { 면: 킷.slate2, 글자: 킷.cream },
};

/** 조직 층 → 왼쪽 띠 색. 유호님 요청 = 「학습·앱 / 데이터·엔진 / 운영 / 브랜드」를 색으로 가른다. */
const 층색 = {
  '학습·앱': 킷.coral3, '데이터·엔진': 킷.emerald, 운영: 킷.navy3,
  브랜드: 킷.sun, '수업·현장': 킷.slate2,
};

/** 마크다운 표식만 걷는다 — 뜻은 안 건드린다(평문화). */
function 평문(s) {
  return String(s)
    .replace(/\*\*/g, '').replace(/`/g, '')
    .replace(/\*\(([^)]*)\)\*/g, '($1)')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 표 한 벌을 뽑는다 — 제목 줄 다음의 첫 `|` 블록. 구분선(|---|)은 버린다. */
function 표뽑기(md, 제목정규식) {
  const lines = md.split(/\r?\n/);
  const i = lines.findIndex((l) => 제목정규식.test(l));
  if (i < 0) return null;
  const 행 = [];
  let 봤나 = false;
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j].trim();
    if (!l.startsWith('|')) { if (봤나) break; continue; }   // 표 시작 전 설명문은 건너뛴다
    봤나 = true;
    if (/^\|[\s:|-]+\|$/.test(l)) continue;                  // 구분선
    행.push(l.slice(1, -1).split('|').map(평문));
  }
  return 행.length >= 2 ? 행 : null;                          // 머리 + 최소 1행
}

/** 칸이 실질적으로 비었는가 — 「—」·「없다」는 «내용»이 아니라 «빈 것»이다.
 *  ⚠ **원문 표기 그대로 들어와도 판정한다**: 표뽑기() 는 평문()을 거치지만 이 함수를 따로 부르는
 *  자리(회귀·다른 도구)는 굵게 표식이 살아 있는 원문을 준다. 표식에 눈이 멀면 `**없다.**` 를
 *  「내용 있음」으로 세고, 그 순간 이 화면은 **빈 칸을 찬 칸으로 보고한다** — 가장 비싼 실패다. */
function 비었나(칸) {
  const s = String(칸).replace(/[*`_~]/g, '').replace(/[🔴⚠✅·\s]/g, '');
  return !s || s === '—' || s === '-' || /^없다/.test(s);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 엔진 도달 실측 — **손으로 적지 않는다.** 실값 정본은 형제 저장소의 래칫 두 개다.
 *   `도달0상한`             = 도달이 0인 사건 수
 *   `생산자섰는데도달0상한` = 생산자는 섰는데 도달이 0인 사건 수 (이쪽이 더 아프다 — 모으고 안 쓴다는 뜻)
 * 래칫이라 **내려가는 것은 언제나 통과하고 올라가면 빨개진다** — 그래서 이 숫자는 «지금의 빚»이다.
 *
 * ⚠ 형제 저장소는 **repo 밖 환경**이다(CI·워크트리엔 없다). 없을 때 0 으로 적으면
 *   「빚이 0」과 「못 쟀다」가 같은 모양이 된다(F207) — 그래서 null 을 돌려주고 화면이 그렇게 말한다.
 */
function 도달실측(root) {
  const p = path.resolve(root, '..', 'SYNK-talk', 'lib', '이벤트검증.js');
  if (!fs.existsSync(p)) return null;
  const src = fs.readFileSync(p, 'utf8');
  const 집기 = (이름) => {
    const m = src.match(new RegExp(`^const\\s+${이름}\\s*=\\s*(\\d+)`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const 도달0 = 집기('도달0상한');
  const 생산자만 = 집기('생산자섰는데도달0상한');
  return (도달0 === null && 생산자만 === null) ? null : { 도달0, 생산자만, 어디: p };
}

/** 「엔진에 닿는가」 열만 «내용»으로 색을 정한다 — 이 열은 상태 이름이 아니라 판정이 값이다.
 *  🔑 이 열이 표의 결론이다: 「돈다」가 초록인데 여기가 빨간 칸 = 다 된 것처럼 보이는 미완성. */
function 도달색(내용) {
  if (/닿는다/.test(내용)) return { 면: 킷.emerald, 글자: 킷.cream };
  if (/끊겼다|미뤄|못 닿/.test(내용)) return { 면: 킷.coral, 글자: 킷.navy2 };
  return { 면: 킷.cream3, 글자: 킷.navy };   // 「물을 수조차 없다」 — 재료가 0이라 판정 자체가 없다
}

function 칸그리기(내용, 상태) {
  const c = /엔진에 닿는가/.test(상태 || '') ? 도달색(내용)
    : (상태색[상태] || { 면: 킷.slate2, 글자: 킷.cream });
  const 빔 = 비었나(내용);
  // 빈 칸은 «면을 비우고 테두리만» 남긴다 — 채워진 칸 옆에서 구멍처럼 보이는 것이 이 화면의 전부다.
  const 배경 = 빔 ? 'transparent' : c.면;
  const 글자색 = 빔 ? 킷.coral3 : c.글자;
  const 테두리 = 빔 ? `2px dashed ${킷.coral3}` : '1px solid rgba(0,0,0,.08)';
  return `<td style="background:${배경};color:${글자색};border:${테두리}">`
    + (빔 ? '<span class="빔">비었다</span>' : `<span>${esc(내용)}</span>`)
    + '</td>';
}

function 표그리기(행들, 층별색인가) {
  const [머리, ...몸] = 행들;
  const th = 머리.map((h) => `<th>${esc(h)}</th>`).join('');
  const tr = 몸.map((행) => {
    const [이름, ...칸들] = 행;
    const 띠 = 층별색인가
      ? (Object.entries(층색).find(([k]) => 이름.includes(k)) || [, 킷.slate2])[1]
      : 킷.navy3;
    const tds = 칸들.map((칸, i) => 칸그리기(칸, 머리[i + 1])).join('');
    return `<tr><th class="행이름" style="border-left:8px solid ${띠}">${esc(이름)}</th>${tds}</tr>`;
  }).join('');
  return `<table><thead><tr><th></th>${th.replace(/^<th><\/th>/, '')}</tr></thead><tbody>${tr}</tbody></table>`;
}

function main() {
  const 바로가기 = process.argv.includes('--바로가기');
  if (!fs.existsSync(정본경로)) {
    console.error(`[이해대장] 판단 정본이 없다: ${정본경로} — 그릴 재료가 없다(워크트리면 정상).`);
    process.exit(1);
  }
  const md = fs.readFileSync(정본경로, 'utf8');
  const ver = (md.match(/<!--\s*정본:\s*(v[\d.]+)\s*-->/) || [, '(판 미상)'])[1];

  const 이해 = 표뽑기(md, /^###\s*A-1\./);
  const 실물 = 표뽑기(md, /^###\s*A-2\./);
  if (!이해 || !실물) {
    console.error('[이해대장] 부록 A 의 표를 못 읽었다 — 절 구조가 바뀌었다.'
      + `\n  · A-1 이해 대장: ${이해 ? `OK(${이해.length - 1}행)` : '못 찾음(앵커 ### A-1.)'}`
      + `\n  · A-2 실물 대장: ${실물 ? `OK(${실물.length - 1}행)` : '못 찾음(앵커 ### A-2.)'}`
      + '\n  → 빈 화면을 내지 않는다(「비었다」와 「못 읽었다」가 같은 모양이면 안 된다). 정본을 열어라: docs/SYNK_철학.md');
    process.exit(1);
  }

  // 「비었다」 몇 칸인가 — 화면 맨 위에 숫자로 박는다. 분모 없는 초록을 만들지 않는다(F207).
  const 빈칸 = 이해.slice(1).flatMap((r) => r.slice(1)).filter(비었나).length;
  const 전체칸 = 이해.slice(1).flatMap((r) => r.slice(1)).length;

  const 실측 = 도달실측(ROOT);
  const 도달줄 = 실측
    ? `<b>도달이 0인 사건 ${실측.도달0}종</b> · 생산자는 섰는데 도달이 0인 사건 <b>${실측.생산자만}종</b>`
      + `<span class="잔글"> — 래칫이라 내려가면 통과, 올라가면 빨개진다 · 실값 정본 = SYNK-talk/lib/이벤트검증.js</span>`
    : '<b>⚠ 못 쟀다</b><span class="잔글"> — 형제 저장소(SYNK-talk)를 못 읽었다. '
      + '「빚이 0」이 아니라 「안 재봤다」이다 — 이 둘을 같은 모양으로 두지 않는다.</span>';

  const html = `<!doctype html><html lang="ko"><meta charset="utf-8">
<title>SYNK 이해 대장 — 어디가 비었나 (${ver})</title>
<style>
  :root{color-scheme:light}
  body{margin:0;padding:32px;background:${킷.paper};color:${킷.ink};
       font-family:"SUIT","Pretendard",system-ui,sans-serif;font-size:15px;line-height:1.6}
  h1{font-size:26px;margin:0 0 4px;color:${킷.navy}}
  .부제{color:${킷.slate2};margin:0 0 24px;font-size:14px}
  .요약{display:inline-block;background:${킷.coralWash};color:${킷.coral3};
        border-radius:999px;padding:6px 16px;font-weight:700;margin-bottom:24px}
  h2{font-size:19px;margin:34px 0 6px;color:${킷.navy}}
  .설명{color:${킷.slate2};font-size:13.5px;margin:0 0 12px}
  table{width:100%;border-collapse:separate;border-spacing:4px;table-layout:fixed}
  th{font-size:13px;font-weight:700;text-align:left;padding:8px 10px;color:${킷.navy}}
  thead th{background:${킷.cream3};border-radius:6px}
  .행이름{background:${킷.cream};border-radius:6px;vertical-align:top;width:19%}
  td{padding:10px 12px;border-radius:6px;vertical-align:top;font-size:13px}
  .빔{font-weight:700;letter-spacing:.04em}
  .범례{margin-top:34px;padding-top:16px;border-top:1px solid ${킷.cream3};
        color:${킷.slate2};font-size:12.5px}
  .칩{display:inline-block;border-radius:999px;padding:2px 12px;margin-right:8px;font-weight:700;font-size:12px}
  .실측{margin-top:12px;padding:12px 16px;background:${킷.cream};border-left:6px solid ${킷.emerald};
        border-radius:6px;font-size:13px}
  .잔글{color:${킷.slate2};font-size:12px}
  footer{margin-top:28px;color:${킷.slate2};font-size:12px}
</style>
<h1>이해 대장</h1>
<p class="부제">SYNK 철학 정본 ${ver} · 부록 A 에서 자동으로 그린다 — 이 화면은 손으로 고치지 않는다.</p>
<div class="요약">이해 ${전체칸}칸 중 <b>${빈칸}칸이 비었다</b></div>

<h2>A-1. 이해 대장 — 그 학생을 얼마나 알게 됐나</h2>
<p class="설명">㉠은 어느 학원이든 오답노트로 흉내 낸다. <b>㉡이 우리만 가질 수 있는 자리</b>이고, 새 기능은 여기서 가장 비어 있는 칸부터 채운다.<br>
🔗 <b>맨 오른쪽 열이 이 표의 결론이다</b> — 모으는 것만으로는 아무것도 안 자란다. <b>「돈다」가 초록인데 그 열이 빨간 칸이 가장 위험하다</b>(다 된 것처럼 보이는 미완성). 도달의 정의는 <b>「읽힌 것」</b>이지 「보이는 것」이 아니다.</p>
${표그리기(이해, false)}
<div class="실측">📏 엔진 도달 실측 — ${도달줄}</div>

<h2>A-2. 실물 대장 — 무엇을 만들었나 <span style="font-weight:400;color:${킷.slate2};font-size:14px">(왼쪽 띠 = 조직 층)</span></h2>
<p class="설명">시제는 이 표가 정한다 — <b>「이미 돌아간다」 칸에 없는 것을 현재형으로 쓰지 않는다</b>(정본 §0).</p>
${표그리기(실물, true)}

<div class="범례">
  <span class="칩" style="background:${킷.emerald};color:${킷.cream}">돈다</span>
  <span class="칩" style="background:${킷.sun};color:${킷.ink}">짓고 있다</span>
  <span class="칩" style="background:${킷.slate2};color:${킷.cream}">개원과 함께</span>
  <span class="칩" style="background:transparent;color:${킷.coral3};border:2px dashed ${킷.coral3}">비었다</span>
  <div style="margin-top:10px">색은 브랜드 킷 23색에서만 뽑는다(유호님 확정) · KC Sun 은 면으로만 쓰고 글자로 쓰지 않는다.</div>
</div>
<footer>생성: node tools/이해대장.js — 정본이 바뀌면 다시 돌린다(사본을 두지 않는다).</footer>
</html>`;

  fs.writeFileSync(산출경로, html, 'utf8');
  const 닿는층 = 이해.slice(1).filter((r) => /닿는다/.test(r[r.length - 1])).length;
  console.log(`[이해대장] ${path.relative(ROOT, 산출경로)} — 정본 ${ver} · 이해 ${전체칸}칸 중 ${빈칸}칸이 비었다`
    + ` · 엔진에 닿는 층 ${닿는층}/${이해.length - 1}`
    + (실측 ? ` · 도달 0인 사건 ${실측.도달0}종(생산자만 선 것 ${실측.생산자만}종)` : ' · 도달 실측 못 함(형제 저장소 없음)'));

  if (바로가기) {
    const { execFileSync } = require('node:child_process');
    // 운영자료 폴더 통로는 하나뿐이다(유호 상시 08-09) — 손 경로 금지.
    execFileSync(process.execPath, [path.join(ROOT, 'tools', '운영자료.js'), '--링크', 산출경로],
      { stdio: 'inherit' });
  }
}

if (require.main === module) main();
module.exports = { 표뽑기, 비었나, 평문, 도달실측, 킷 };
