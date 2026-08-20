#!/usr/bin/env node
/**
 * 오브시안 — 「펠트 오브를 어느 천으로 입힐까」 판정 재료를 한 장으로 굽는다.
 *
 * 왜 있나 (유호 지시 2026-08-20 「오브 기본 원료는 코랄이 좋아보이는데 시안을 최대한 많이」):
 *   오브는 지면에서 **부피를 가진 유일한 물건**이고 한 지면에 1점뿐이라, 그 색은 취향이 아니라
 *   «신호 1점 규율과 맞물리는 판정»이다. 그런데 판정할 재료가 없었다 — 지금까지 기본 천은
 *   `loom.js 기본천()` 의 폴백 첫 칸이 «조용히» 정하고 있었고(그게 퇴역색 Chalk 였다),
 *   아무도 다른 천을 나란히 본 적이 없다. 눈으로 못 고른 것은 코드가 대신 골라 왔다.
 *
 * 무엇을 하나:
 *   ① 부품 CSS 는 **Loom 통로에서 받는다**(`loom.css({지면:'부품만'})`) — 여기서 손으로 안 쓴다.
 *      시안이 제 CSS 를 지니면 그 순간 오브가 지면과 갈리고, 갈린 오브를 보고 고르면 판정이 거짓이 된다.
 *   ② 천은 `docs/tools/펠트천.json`(구운 실물의 data URI)에서 전량 읽는다 — 굽는 자와 보는 자가
 *      같은 값을 본다. 새 천을 구우면 이 시안이 저절로 따라온다.
 *   ③ 밤·낮 두 무대에 같은 오브를 놓는다. 오브는 두 지면 모두에 서므로 한쪽만 보고 고르면
 *      나머지 한쪽에서 무너진다(실측 축: 밝은 천은 밤에서 뜨고 어두운 천은 낮에서 뜬다).
 *   ④ 실제 맥락(표지 한 장)을 유력 후보로 재현한다 — 스와치로 고른 색이 지면에서 다르게 읽히는
 *      것이 흔해서, 격자만 내면 「예쁜 천」을 고르고 「맞는 천」을 놓친다.
 *
 * 🚫 브랜드렌더린트에 등록하지 않는다 — 천 28장을 나란히 세우는 것이 이 지면의 «내용»이라
 *   신호 1점·구역 규율이 원리상 위반으로 잡힌다(브랜드킷.html 과 같은 갈래).
 *
 * 사용법:  node tools/오브시안.js            → docs/오브_시안.html (자립형 1파일)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const loom = require('./lib/loom.js');

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
  const 토큰 = JSON.parse(fs.readFileSync(토큰길, 'utf8'));
  const 킷 = Object.fromEntries(토큰['색']['킷'].map((c) => [c['hex'].toUpperCase(), c]));
  return { 천, 킷 };
}

/** 이 천이 현행 킷인가 · 퇴역 대기인가 · 킷 밖인가 — 고르기 전에 «자격»을 먼저 보여준다.
 *
 * 🔑 「킷 안」과 「고를 수 있다」는 다르다 — KC 4색은 현행 킷이지만 **Part 6 전용**이라
 *   본채의 오브가 그 천을 입으면 구역 규율(DESIGN.md 철칙 ④)을 어긴다. 딱지 없이 나란히 세우면
 *   보는 사람이 그걸 후보로 읽는다: **판정 재료가 잘못된 선택지를 만들면 안 된다.**
 */
function 자격(항, 킷) {
  const h = String(항['목표'] || '').toUpperCase();
  const c = 킷[h];
  if (!c) return { 급: 'out', 딱지: '🔴 현행 킷 밖', 이름: null };
  if (String(c['직책'] || '').trimStart().startsWith('⏳')) {
    return { 급: 'ret', 딱지: '⏳ 퇴역 대기', 이름: c['이름'] };
  }
  if (String(c['팔레트'] || '').includes('K-Culture')) {
    return { 급: 'kc', 딱지: '🚫 Part 6 전용', 이름: c['이름'] };
  }
  return { 급: 'ok', 딱지: '', 이름: c['이름'] };
}

/** 오브 한 알 — `.오브` 는 Loom 이 짓고, 여기서는 «천만» 갈아끼운다. */
function 오브(항, 글자, 크기) {
  const 크 = 크기 ? `style="width:${크기}px;height:${크기}px;border-radius:${Math.round(크기 * 0.277)}px;` +
    `font-size:${(크기 / 112 * 2.6).toFixed(2)}rem;background-image:url(${항.uri});background-size:46px"`
    : `style="background-image:url(${항.uri});background-size:46px"`;
  return `<div class="오브" ${크}>${esc(글자)}</div>`;
}

function 격자(천, 킷, 급들) {
  const 목록 = Object.entries(천)
    .map(([이름, 항]) => ({ 이름, 항, 자: 자격(항, 킷) }))
    .filter((x) => 급들.includes(x.자.급))
    .sort((a, b) => a.이름.localeCompare(b.이름));
  return 목록.map(({ 이름, 항, 자 }) => `
    <figure class="칸${자.급 === 'ok' ? '' : ' 낡음'}">
      ${오브(항, '싱', 0)}
      <figcaption><b>${esc(이름)}</b><code>${esc(항['목표'] || '')}</code>
        ${자.딱지 ? `<em>${esc(자.딱지)}</em>` : ''}
        <span>결 ${항['결퍼센트']}% · ${항['한변']}px</span></figcaption>
    </figure>`).join('');
}

/** 맥락 목업 — 표지 한 장. 격자에서 고른 눈을 «실제로 서는 자리»에서 다시 확인한다. */
function 표지(항, 이름, 밤) {
  return `
  <div class="표지 ${밤 ? '밤' : '낮'}">
    <div class="표지머리">
      ${오브(항, '싱', 96)}
      <div>
        <div class="표지칩">SYNK LAB</div>
        <h3>몽골에서 한국어를<br>게임처럼 배운다</h3>
        <p class="표지설명">이 지면에서 부피를 가진 물건은 왼쪽 오브 하나다 —
        나머지는 전부 글자와 여백이 진다.</p>
      </div>
    </div>
    <div class="표지발">${esc(이름)} · ${esc(항['목표'] || '')}</div>
  </div>`;
}

function main() {
  const { 천, 킷 } = 읽기();
  const 부품CSS = loom.css({ 지면: '부품만' });
  const t = loom.정본();
  const C = (n) => t.색[n];

  const 후보 = ['Coral', 'Oat', 'Stitch', 'Paper', 'Lapis', 'Meadow', 'Butter', 'Pop']
    .filter((n) => 천[n]);

  const 총 = Object.keys(천).length;
  const 현행 = Object.entries(천).filter(([, 항]) => 자격(항, 킷).급 === 'ok').length;
  const 못쓸것 = 총 - 현행;

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>펠트 오브 — 기본 원료 시안</title>
<!-- 자동 생성: node tools/오브시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 부품 CSS = tools/lib/loom.js(통로) · 천 = docs/tools/펠트천.json · 색 = docs/디자인_토큰.json -->
<style>
:root{
  --paper:${C('Paper')}; --ink:${C('Ink')}; --inkdeep:${C('Ink Deep')};
  --oat:${C('Oat')}; --stone:${C('Stone')}; --ashwool:${C('Ash Wool')};
  --coral:${C('Coral')}; --coral3:${C('Coral 3')}; --stitch:${C('Stitch')};
  --font:'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
}
*{box-sizing:border-box;margin:0}
body{background:var(--paper);color:var(--ink);font-family:var(--font);line-height:1.6}
header{background:var(--inkdeep);color:var(--paper);padding:48px 7% 40px}
header h1{font-size:28px;font-weight:800;letter-spacing:-.03em}
header p{color:var(--stone);font-size:14px;margin-top:8px;max-width:78ch}
section{padding:40px 7%}
section+section{border-top:1px solid var(--stone)}
h2{font-size:19px;font-weight:800;letter-spacing:-.02em}
.lead{color:var(--ashwool);font-size:13.5px;margin:6px 0 20px;max-width:80ch}
.무대{padding:32px;border-radius:18px}
.무대.밤{background:var(--inkdeep)}
.무대.낮{background:var(--paper);outline:1px solid var(--stone);outline-offset:-1px}
.격자{display:flex;flex-wrap:wrap;gap:26px}
.칸{width:132px;text-align:center}
.칸 figcaption{margin-top:10px;font-size:11.5px;line-height:1.5}
.칸 b{display:block;font-size:12.5px}
.칸 code{font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:10.5px;opacity:.75}
.칸 em{display:block;font-style:normal;font-weight:700;color:var(--coral3);font-size:10.5px}
.칸 span{display:block;opacity:.6;font-size:10px}
.칸.낡음{opacity:.5}
.무대.밤 .칸 figcaption{color:var(--oat)}
.무대.밤 .칸 em{color:${C('Coral 2')}}
.표지들{display:flex;flex-wrap:wrap;gap:22px}
.표지{width:430px;border-radius:16px;padding:26px;overflow:hidden}
.표지.밤{background:var(--inkdeep);color:var(--paper)}
.표지.낮{background:var(--paper);color:var(--ink);outline:1px solid var(--stone);outline-offset:-1px}
.표지머리{display:flex;gap:20px;align-items:center}
.표지 h3{font-size:19px;font-weight:800;letter-spacing:-.03em;line-height:1.25;margin-top:6px}
.표지칩{font-size:10.5px;font-weight:700;letter-spacing:.14em;color:var(--coral)}
.표지설명{font-size:11.5px;margin-top:8px;opacity:.72;line-height:1.55}
.표지발{margin-top:18px;padding-top:12px;border-top:1px solid rgba(128,128,128,.35);
  font-size:10.5px;font-family:'DM Mono',ui-monospace,Consolas,monospace;opacity:.65}
.자범{display:flex;gap:30px;align-items:flex-end;flex-wrap:wrap}
.자범 figure{text-align:center}
.자범 figcaption{margin-top:8px;font-size:11px;color:var(--oat)}
footer{padding:26px 7% 44px;font-size:11.5px;color:var(--ashwool)}
.물음{background:${C('Coral Wash')};border-radius:14px;padding:18px 20px;margin-top:18px;
  font-size:13px;max-width:82ch}
.물음 b{color:var(--coral3)}
${부품CSS}
</style></head><body>

<header>
  <h1>펠트 오브 — 어느 천을 기본으로 입힐까</h1>
  <p>오브는 지면에서 <b>부피를 가진 유일한 물건</b>이고 한 지면에 1점뿐이다. 그래서 이 색은 취향이 아니라
  «신호 1점 규율과 맞물리는 판정»이다. 아래는 지금 구워져 있는 천 ${총}장(고를 수 있는 ${현행}장 + 못 고르는 ${못쓸것}장) 전량을
  <b>같은 오브·같은 조명</b>에 놓은 것이다. 부품 CSS 는 지면과 같은 통로(<code>tools/lib/loom.js</code>)에서 왔다.</p>
</header>

<section>
  <h2>1. 밤 무대 — 현행 킷 천</h2>
  <p class="lead">앱·소개서가 서는 자리다. 어두운 바탕에서는 <b>밝은 천이 뜨고 어두운 천은 가라앉는다</b>.</p>
  <div class="무대 밤"><div class="격자">${격자(천, 킷, ['ok'])}</div></div>
</section>

<section>
  <h2>2. 낮 무대 — 같은 천, 종이 위</h2>
  <p class="lead">인쇄물·발표물이 서는 자리다. <b>한쪽만 보고 고르면 나머지에서 무너진다</b> — 두 무대를 같이 본다.</p>
  <div class="무대 낮"><div class="격자">${격자(천, 킷, ['ok'])}</div></div>
</section>

<section>
  <h2>3. 실제 맥락 — 표지 한 장</h2>
  <p class="lead">격자는 「예쁜 천」을 고르게 하고 맥락은 「맞는 천」을 고르게 한다. 유력 후보를 실제 자리에 놓았다.</p>
  <div class="표지들">
    ${후보.map((n) => 표지(천[n], n, true)).join('')}
    ${후보.slice(0, 4).map((n) => 표지(천[n], n, false)).join('')}
  </div>
</section>

<section>
  <h2>4. 크기 — 표지 112px vs 인쇄 74px</h2>
  <p class="lead">인쇄 지면에서 오브는 74px 로 줄고 배경 그래픽이 꺼질 수 있다. 작아지면 결이 안 읽히는 천이 있다.</p>
  <div class="무대 밤"><div class="자범">
    ${후보.map((n) => `<figure>${오브(천[n], '싱', 112)}${오브(천[n], '싱', 74)}
      <figcaption>${esc(n)}</figcaption></figure>`).join('')}
  </div></div>
</section>

<section>
  <h2>5. 고르면 안 되는 천 — 퇴역 · 킷 밖 · 구역 전용</h2>
  <p class="lead">지금까지 기본값이던 <b>Chalk 가 여기 있다</b>(⏳퇴역 대기). KC 4색은 현행 킷이지만
  <b>Part 6 전용</b>이라 본채 오브가 입으면 구역 규율(철칙 ④)을 어긴다 — 킷 안이라고 다 후보가 아니다.
  무엇을 «안» 고를지도 판정의 일부라 함께 낸다.</p>
  <div class="무대 밤"><div class="격자">${격자(천, 킷, ['ret', 'out', 'kc'])}</div></div>
  <div class="물음">
    <b>정해야 할 것 하나</b> — 오브의 기본 염료를 무엇으로 둘까. 정하면
    <code>docs/디자인_토큰.json</code> 에 <code>색.기본색</code> 을 세우고, 그 뒤로는
    <code>loom.js 기본천()</code> 이 <b>고칠 것 없이</b> 따라온다(이미 그 키를 먼저 읽는다).
    지금은 그 키가 없어 폴백 무채(<code>Oat</code>)가 서 있다.
  </div>
</section>

<footer>자동 생성 — <code>node tools/오브시안.js</code> · 천 = <code>docs/tools/펠트천.json</code>(구운 실물) ·
부품 CSS = <code>tools/lib/loom.js</code> · 색 = <code>docs/디자인_토큰.json</code>.
이 지면은 천을 나란히 세우는 것이 내용이라 브랜드렌더린트에 등록하지 않는다.</footer>
</body></html>`;

  fs.writeFileSync(출력, html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(`■ 오브 시안  ${path.relative(루트, 출력)}  (${kb}KB · 천 ${총}장 = 후보 ${현행} + 제외 ${총 - 현행})`);
  console.log(`   무대 2 · 맥락 표지 ${후보.length + Math.min(4, 후보.length)}장 · 크기 변주 ${후보.length}쌍`);
  if (/src\s*=\s*"(?!data:)/.test(html)) { console.error('🔴 외부 자원 참조가 남았다 — 자립형이 아니다'); process.exit(1); }
  console.log('   ✅ 자립형 — 외부 자원 0');
}

if (require.main === module) main();
module.exports = { 자격 };
