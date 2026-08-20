#!/usr/bin/env node
/**
 * 오브시안 — 「펠트 오브를 어느 천으로 입힐까」 판정 재료를 **Loom 지면**으로 굽는다.
 *
 * 왜 있나 (유호 지시 2026-08-20 「오브 기본 원료는 코랄이 좋아보이는데 시안을 최대한 많이」):
 *   오브는 지면에서 **부피를 가진 유일한 물건**이고 한 지면에 1점뿐이라, 그 색은 취향이 아니라
 *   «신호 1점 규율과 맞물리는 판정»이다. 그런데 판정할 재료가 없었다 — 지금까지 기본 천은
 *   `loom.js 기본천()` 의 폴백 첫 칸이 «조용히» 정하고 있었고(그게 퇴역색 Chalk 였다).
 *
 * 🔴 **첫 판을 버리고 다시 지었다 (유호 교정 08-20 「너무 허접해보여 · Loom 엔진으로 명품화」).**
 *   첫 판의 잘못은 하나로 모인다: `loom.css({지면:'부품만'})` 로 **부품만** 받아 놓고
 *   지면 골격(머리·절·격자·카드)은 **내가 손으로 CSS 를 썼다.** 그래서 오브만 Loom 것이고
 *   나머지는 남의 문법이라, 소개서 6벌과 같은 세계로 안 보였다 — 「통로 밖에서 지면 CSS 를 손으로
 *   쓰지 않는다」(DESIGN.md §2-d)를 어긴 대가가 정확히 그 인상이다.
 *   ⇒ 지금은 **CSS 를 한 줄도 안 쓴다.** 원고(HTML)만 짓고 `<!--펠트스킨-->` 자리에
 *     `tools/펠트문서.js`(Loom L4 「검은 무대」)가 소개서와 **같은 한 벌**을 주입한다.
 *
 * 지면 문법 = 소개서와 동일: `.판` > `nav.레일` + `.글` · `header.표지`(오브 1점) ·
 *   `h2.듦`+`span.번호` · `.유리 알림` · `blockquote.유리` · `.수치들`>`.수치 유리` · `.유리 표틀`.
 *
 * 무엇을 하나:
 *   ① 천은 `docs/tools/펠트천.json`(구운 실물의 data URI)에서 전량 읽는다 — 굽는 자와 보는 자가
 *      같은 값을 본다. 새 천을 구우면 이 시안이 저절로 따라온다.
 *   ② 밤·낮 두 무대에 같은 오브를 놓는다. 오브는 두 지면 모두에 서므로 한쪽만 보고 고르면
 *      나머지 한쪽에서 무너진다(밝은 천은 밤에서 뜨고 어두운 천은 낮에서 뜬다).
 *   ③ 실제 맥락(표지 한 장)을 유력 후보로 재현한다 — 격자만 내면 「예쁜 천」을 고르고 「맞는 천」을 놓친다.
 *   ④ 「킷 안」과 「고를 수 있다」를 가른다 — KC 4색은 현행 킷이지만 Part 6 전용이라 본채 오브가
 *      입으면 철칙 ④ 위반이다. 판정 재료가 잘못된 선택지를 만들면 그 판정은 재료 탓에 틀린다.
 *
 * 🚫 브랜드렌더린트에 등록하지 않는다 — 천을 나란히 세우는 것이 이 지면의 «내용»이라
 *   신호 1점·구역 규율이 원리상 위반으로 잡힌다(브랜드킷.html 과 같은 갈래).
 *
 * 사용법:  node tools/오브시안.js            → docs/오브_시안.html (자립형 1파일)
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 천길 = path.join(루트, 'docs', 'tools', '펠트천.json');
const 토큰길 = path.join(루트, 'docs', '디자인_토큰.json');
const 출력 = path.join(루트, 'docs', '오브_시안.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function 읽기() {
  if (!fs.existsSync(천길)) {
    console.error('🔴 docs/tools/펠트천.json 이 없다 — `python tools/펠트천굽기.py` 를 먼저 돌린다.');
    process.exit(1);
  }
  const 천 = JSON.parse(fs.readFileSync(천길, 'utf8'))['천'] || {};
  const 킷 = Object.fromEntries(
    JSON.parse(fs.readFileSync(토큰길, 'utf8'))['색']['킷'].map((c) => [c['hex'].toUpperCase(), c]));
  return { 천, 킷 };
}

/** 이 천이 «고를 수 있는» 것인가 — 킷 멤버십과 자격은 다르다(위 ④). */
function 자격(항, 킷) {
  const c = 킷[String(항['목표'] || '').toUpperCase()];
  if (!c) return { 급: 'out', 딱지: '현행 킷 밖' };
  if (String(c['직책'] || '').trimStart().startsWith('⏳')) return { 급: 'ret', 딱지: '퇴역 대기' };
  if (String(c['팔레트'] || '').includes('K-Culture')) return { 급: 'kc', 딱지: 'Part 6 전용' };
  return { 급: 'ok', 딱지: '' };
}

/** 오브 한 알 — `.오브` 는 Loom 이 짓는다. 여기서 주는 것은 «천»(값)뿐이다. */
const 오브 = (항, 글 = '싱', px = 0) => {
  const 재 = `background-image:url(${항.uri});background-size:46px`;
  const 크 = px ? `;width:${px}px;height:${px}px;border-radius:${Math.round(px * .277)}px` +
    `;font-size:${(px / 112 * 2.6).toFixed(2)}rem` : '';
  return `<div class="오브" style="${재}${크}" aria-hidden="true">${esc(글)}</div>`;
};

/** 격자 한 판 — Loom `.수치들`>`.수치 유리` 를 그대로 쓴다(내가 격자를 새로 안 짓는다). */
function 격자(천, 킷, 급들, { 낮 = false } = {}) {
  const 칸 = Object.entries(천)
    .map(([이름, 항]) => ({ 이름, 항, 자: 자격(항, 킷) }))
    .filter((x) => 급들.includes(x.자.급))
    .sort((a, b) => a.이름.localeCompare(b.이름))
    .map(({ 이름, 항, 자 }) => `
    <div class="수치 유리 잔잔" style="flex:1 1 150px;${낮 ? 'background:var(--paper)' : ''}">
      ${오브(항, '싱', 76)}
      <p class="n" style="margin-top:11px;font-size:1.02rem${낮 ? ';color:var(--ink)' : ''}">${esc(이름)}</p>
      <p class="l"${낮 ? ' style="color:var(--ash2)"' : ''}>${esc(항['목표'] || '')} · 결 ${항['결퍼센트']}%${자.딱지 ? ` · <b>${esc(자.딱지)}</b>` : ''}</p>
    </div>`).join('');
  return `<div class="수치들">${칸}</div>`;
}

/** 맥락 — 표지 한 장을 유리 판 위에 재현한다. 격자에서 고른 눈을 실제 자리에서 다시 본다. */
const 맥락 = (항, 이름, 낮) => `
  <div class="수치 유리" style="flex:1 1 330px;padding:22px 24px${낮 ? ';background:var(--paper)' : ''}">
    <div style="display:flex;gap:18px;align-items:center">
      ${오브(항, '싱', 88)}
      <div style="min-width:0">
        <p class="꼭지">SYNK LAB</p>
        <p class="n" style="font-size:1.12rem;margin-top:2px${낮 ? ';color:var(--ink)' : ''}">몽골에서 한국어를<br>게임처럼 배운다</p>
        <p class="l" style="margin-top:6px${낮 ? ';color:var(--ash2)' : ''}">이 지면에서 부피를 가진 물건은 이 오브 하나다.</p>
      </div>
    </div>
    <p class="l" style="margin-top:14px${낮 ? ';color:var(--ash2)' : ''}">${esc(이름)} · ${esc(항['목표'] || '')}</p>
  </div>`;

function main() {
  const { 천, 킷 } = 읽기();
  const 총 = Object.keys(천).length;
  const 후보수 = Object.values(천).filter((항) => 자격(항, 킷).급 === 'ok').length;
  const 유력 = ['Coral', 'Oat', 'Stitch', 'Paper', 'Lapis', 'Meadow', 'Butter', 'Pop'].filter((n) => 천[n]);
  const 표지천 = 천['Coral'] || 천[유력[0]];

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>오브의 천 — 기본 원료 시안</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/오브시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 지면 = tools/펠트문서.js(Loom L4 검은 무대) · 천 = docs/tools/펠트천.json · 색 = docs/디자인_토큰.json -->
<!--펠트스킨-->

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">오브 원료</p>
  <ol>
    <li><a href="#s1"><span class="n">01</span> 밤 무대</a></li>
    <li><a href="#s2"><span class="n">02</span> 낮 무대</a></li>
    <li><a href="#s3"><span class="n">03</span> 실제 맥락</a></li>
    <li><a href="#s4"><span class="n">04</span> 크기</a></li>
    <li><a href="#s5"><span class="n">05</span> 못 고르는 천</a></li>
    <li><a href="#s6"><span class="n">06</span> 정할 것</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  ${오브(표지천, '싱')}
  <div>
    <p class="꼭지">SYNK Loom · 재질 판정 재료</p>
    <h1>오브의 천</h1>
    <p class="한줄">오브는 지면에서 <b>부피를 가진 유일한 물건</b>이고 한 지면에 <b>1점</b>뿐이다.
    그래서 이 색은 취향이 아니라 <b>신호 1점 규율과 맞물리는 판정</b>이다.
    구워져 있는 천 ${총}장을 같은 오브·같은 조명에 놓았다.</p>
    <p class="메타">자동 생성 · <code>node tools/오브시안.js</code> · 천 ${총}장(고를 수 있는 ${후보수} + 못 고르는 ${총 - 후보수}) ·
    지면 = Loom L4 「검은 무대」 · 값 = 디자인_토큰.json · 천 = 펠트천.json(구운 실물)</p>
  </div>
</header>

<div class="유리 알림 듦"><b>왜 이 문서가 있나</b> — 지금까지 오브의 기본 천은
<code>loom.js 기본천()</code> 의 폴백 첫 칸이 <b>조용히</b> 정해 왔고, 그게 ⏳퇴역 대기색인
<b>Chalk</b> 였다. 눈으로 못 고른 것은 코드가 대신 골라 온다 — 그래서 나란히 세운다.</div>

<div class="유리 알림 조용 듦"><b>「킷 안」과 「고를 수 있다」는 다르다</b> —
KC 4색은 현행 킷이지만 <b>Part 6 전용</b>이라 본채 오브가 입으면 철칙 ④를 어긴다.
§05 에 따로 세웠다: 판정 재료가 잘못된 선택지를 만들면 그 판정은 <b>재료 탓에</b> 틀린다.</div>

<h2 id="s1" class="듦"><span class="번호">01</span><span>밤 무대 — 앱·소개서가 서는 자리</span></h2>
<p class="듦">어두운 바탕에서는 <b>밝은 천이 뜨고 어두운 천은 가라앉는다</b>.
오브가 「사람이 만든 물건」으로 읽히는지, 아니면 바탕에 먹히는지를 여기서 본다.</p>
${격자(천, 킷, ['ok'])}

<h2 id="s2" class="듦"><span class="번호">02</span><span>낮 무대 — 같은 천, 종이 위</span></h2>
<p class="듦">인쇄물·발표물이 서는 자리다. <b>한쪽만 보고 고르면 나머지에서 무너진다</b> —
밤에서 잘 뜨는 밝은 천이 종이 위에서는 윤곽을 잃는 일이 흔하다.</p>
${격자(천, 킷, ['ok'], { 낮: true })}

<h2 id="s3" class="듦"><span class="번호">03</span><span>실제 맥락 — 표지 한 장</span></h2>
<p class="듦">격자는 「예쁜 천」을 고르게 하고 맥락은 「맞는 천」을 고르게 한다.
유력 후보 ${유력.length}종을 실제로 서는 자리에 놓았다 — 위 ${유력.length}장이 밤, 아래가 낮이다.</p>
<div class="수치들">${유력.map((n) => 맥락(천[n], n, false)).join('')}</div>
<div class="수치들">${유력.slice(0, 4).map((n) => 맥락(천[n], n, true)).join('')}</div>

<h2 id="s4" class="듦"><span class="번호">04</span><span>크기 — 표지 112px vs 인쇄 74px</span></h2>
<p class="듦">인쇄 지면에서 오브는 74px 로 줄고 배경 그래픽이 꺼질 수 있다.
작아지면 결이 안 읽히는 천이 있다 — <b>결이 사라지면 펠트가 아니라 색 사각형</b>이다.</p>
<div class="수치들">
${유력.map((n) => `
  <div class="수치 유리 잔잔" style="flex:1 1 210px">
    <div style="display:flex;gap:14px;align-items:flex-end">${오브(천[n], '싱', 112)}${오브(천[n], '싱', 74)}</div>
    <p class="n" style="margin-top:12px">${esc(n)}</p>
    <p class="l">${esc(천[n]['목표'] || '')} · 결 ${천[n]['결퍼센트']}% · ${천[n]['한변']}px 원본</p>
  </div>`).join('')}
</div>

<h2 id="s5" class="듦"><span class="번호">05</span><span>못 고르는 천 — 무엇을 안 고를지도 판정이다</span></h2>
<p class="듦">지금까지 기본값이던 <b>Chalk 가 여기 있다</b>(⏳퇴역 대기).
KC 4색은 현행 킷이지만 <b>Part 6 전용</b>이라 본채에 반입할 수 없다.</p>
${격자(천, 킷, ['ret', 'out', 'kc'])}

<h2 id="s6" class="듦"><span class="번호">06</span><span>정할 것 하나</span></h2>
<blockquote class="유리 듦">오브의 기본 염료를 무엇으로 둘까. 정하면
<code>docs/디자인_토큰.json</code> 에 <code>색.기본색</code> 을 세우는 것으로 끝난다 —
<code>loom.js 기본천()</code> 과 <code>펠트문서.js</code> 가 <b>고칠 것 없이</b> 따라온다
(둘 다 이미 그 키를 먼저 읽는다). 지금은 그 키가 없어 폴백 무채가 서 있다.</blockquote>
<ul class="듦">
<li><b>이 지면은 브랜드렌더린트에 등록하지 않는다</b> — 천을 나란히 세우는 것이 내용이라
신호 1점·구역 규율이 원리상 위반으로 잡힌다(브랜드킷.html 과 같은 갈래).</li>
<li><b>Ink · Ink Deep 천은 아직 없다</b> — 밝은 천을 어둡게 만들면 결이 6~37% 로 죽어
양모가 아니라 검은 판이 된다. 어두운 양모 원료 사진이 선행 조건이다.</li>
</ul>

<footer class="메타">자동 생성 — <code>node tools/오브시안.js</code> ·
지면 스킨 = <code>tools/펠트문서.js</code>(Loom L4) · 부품 = <code>tools/lib/loom.js</code> ·
천 = <code>docs/tools/펠트천.json</code> · 색 = <code>docs/디자인_토큰.json</code>.
<b>이 파일에는 손으로 쓴 지면 CSS 가 없다.</b></footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `orb-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }

  const html = fs.readFileSync(출력, 'utf8');
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(`■ 오브 시안  ${path.relative(루트, 출력)}  (${kb}KB · 천 ${총}장 = 후보 ${후보수} + 제외 ${총 - 후보수})`);
  console.log(`   무대 2 · 맥락 ${유력.length + Math.min(4, 유력.length)}장 · 크기 ${유력.length}쌍 · 지면 = Loom L4`);
  // 자립성은 굽는 층이 이미 보지만, 「그림이 밖을 가리키면 첨부가 깨진다」는 이 지면의 존재 이유라 여기서도 센다.
  const 밖 = (html.match(/src\s*=\s*"(?!data:)/g) || []).length;
  if (밖) { console.error(`🔴 외부 그림 참조 ${밖}건 — 자립형이 아니다`); process.exit(1); }
  console.log('   ✅ 자립형 — 외부 그림 0');
}

if (require.main === module) main();
module.exports = { 자격 };
