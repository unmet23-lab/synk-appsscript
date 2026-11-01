'use strict';
/* synk.im/builds/homepage — yuhobuilds 「AI 홈페이지가 다 똑같은 이유」 나눔 자료(2026-11-01).
 * 쪽(index.html)과 PDF 원고(guide.html)를 내용.json 한 곳에서 그린다. 글 · 숫자는 여기에 적지 않아 둘이 어긋날 수 없다.
 * 검사·그리기는 순수 함수이고, 빌드(../build.mjs homepage)가 파일을 쓰고 Chrome으로 PDF를 뽑는다.
 */
const fs = require('node:fs');
const path = require('node:path');
const 규칙 = require('../../../../tools/lib/게시글규칙.js');

const PDF_NAME = 'AI홈페이지_물건하나_자료.pdf';
const SITE = 'synk.im/builds/homepage';
const WIDTH = 480; // PDF 한 장의 폭(px). 휴대폰 PDF 보기에서 폭에 맞춰도 글이 읽히는 크기.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const thumb = (stage, id) => `shots/${stage}/${id}.webp`;
const large = (stage, id) => `shots/${stage}/${id}-l.webp`;
const fill = (template, kind, object) => template.replace('{업종}', kind).replace('{물건}', object);

// 확인 범위를 넘는 말(10-31 · 11-01 문구 한계). 글마다 본다.
const BEYOND = [
  [/(손님|매출|방문|주문|예약)[^.。]{0,12}(늘|는다|올라|오른|증가|많아)/, '손님 · 매출이 는다는 말'],
  [/(다른|어떤|모든|어느)\s*AI[^.。]{0,12}(돼요|됩니다|같아요|통해요|나와요)/, '다른 AI에서도 된다는 말'],
  [/AI\s*생성/, '「AI 생성」 표기'],
];

function textsOf(data) {
  const a = data.만들기;
  const out = [['제목', data.제목], ['부제', data.부제], ['요약', data.요약], ['메타설명', data.메타설명], ['요청문', data.요청문], ['이렇게', data.이렇게.머리], ['이렇게', data.이렇게.쪽], ['고르는법', data.고르는법.머리], ['만들기', a.머리], ['만들기', a.PDF], ['만들기', a.약속], ['만들기', a.예시.업종], ['만들기', a.예시.물건]];
  for (const t of [...data.구역, ...a.업종예시, ...Object.values(a.알림)]) out.push(['쪽 글', t]);
  for (const p of data.판) out.push([p.id, p.이름], [p.id, p.업종], [p.id, p.물건]);
  for (const l of data.더보기) out.push(['더보기', l.제목], ['더보기', l.글]);
  for (const s of data.단계) out.push(...[s.이름, s.풀이, s.결과, s.붙인말, s.붙인말없음].filter(Boolean).map((t) => [s.id, t]));
  for (const r of data.고르는법.기준) out.push(['기준', r.제목], ['기준', r.글]);
  for (const r of data.한계) out.push(['한계', r.제목], ['한계', r.글]);
  return out;
}

function check(data) {
  const out = [];
  const ids = new Set(data.판.map((p) => p.id));
  if (data.판.length !== 7) out.push('판은 일곱이어야 한다');
  if (data.단계.length !== 4) out.push('단계는 넷이어야 한다');
  for (const s of data.단계) {
    for (const id of s.몰린판) if (!ids.has(id)) out.push(`${s.id}: 없는 판 ${id}`);
    const [n, of] = s.수.split('/').map(Number);
    if (of !== data.판.length) out.push(`${s.id}: 수의 분모가 판 수와 다르다`);
    if (!s.끝 && n !== s.몰린판.length) out.push(`${s.id}: 수 ${s.수}와 몰린 판 ${s.몰린판.length}이 다르다`);
    if (s.끝 && s.몰린판.length) out.push(`${s.id}: 끝 단계에 몰린 판이 있다`);
  }
  if (!data.요청문.includes('{업종}') || !data.요청문.includes('우리 가게 {물건}의 색과 글씨로 화면을 만들어 줘.')) out.push('요청문 틀에 업종 · 「우리 가게 ○○의 색과 글씨로 화면을 만들어 줘.」가 없다');
  if (!data.한계.some((r) => r.글.includes('추측'))) out.push('왜 몰리는지를 쓰면 「추측」이라고 적는다');
  for (const [where, text] of textsOf(data)) {
    for (const [re, what] of BEYOND) if (re.test(text)) out.push(`${where}: 확인 범위 밖 — ${what}: ${text}`);
    for (const f of 규칙.checkText(text, { where, brand: 'LAB', language: 'ko', platform: 'web' })) {
      if (f.level === 규칙.FIX && ['ai-name', 'maker-tool', 'relative-date', 'internal-code'].includes(f.code)) out.push(`${where}: ${f.message}`);
    }
  }
  return out;
}

// ── 쪽 ──
function shotLink(data, stage, p, no) {
  const on = stage.몰린판.includes(p.id);
  const cap = `${no}단계 · ${p.이름}${stage.끝 ? ` · ${p.물건}` : ''}`;
  // 몰린 판은 노란 테로만 보이지 않게 대체 글에도 적는다(화면 낭독기)
  const alt = `${cap} 실제 화면${on ? ', 한쪽으로 몰린 판' : ''}`;
  return `<a class="shot${on ? ' on' : ''}" href="${large(stage.id, p.id)}" data-open="${stage.id}" data-cap="${esc(cap)}" data-alt="${esc(alt)}"><img src="${thumb(stage.id, p.id)}" alt="${esc(alt)}" width="240" height="519" loading="lazy" decoding="async"></a>`;
}

function roundBlock(data, s, i) {
  const no = i + 1;
  const said = s.붙인말 ? `<p class="said"><b>끝에 붙인 말</b>「${esc(s.붙인말)}」</p>` : `<p class="said"><b>끝에 붙인 말</b>${esc(s.붙인말없음)}</p>`;
  const tool = s.색빼기 ? `<button type="button" class="chip gray-btn" data-gray="grid-${s.id}" aria-pressed="false">색 빼고 보기</button>` : '';
  return `      <article class="round" id="${s.id}">
        <div class="round-head"><div><p class="round-no">${no}단계</p><h3>${esc(s.이름)}</h3></div>${tool}</div>
        ${said}
        <div class="shots" id="grid-${s.id}">${data.판.map((p) => shotLink(data, s, p, no)).join('')}<div class="tally${s.끝 ? ' win' : ''}"><b>${esc(s.수)}</b><span>${esc(s.결과)}</span></div></div>
        <p class="read">${esc(s.풀이)}</p>
      </article>`;
}

const CSS = `/* 이 쪽에만 있는 부품(싱ㅋ 시그널 토큰만 쓴다). 공통 양식은 app.css(core/signal.css). */
#app{counter-reset:blk}
section.block{counter-increment:blk;scroll-margin-top:84px}
section.block>h2 .no::before{content:counter(blk,decimal-leading-zero)}
.intro h1{font-size:clamp(38px,4.2vw,60px)}
.intro .meta{margin-bottom:24px}
.cta{display:flex;flex-wrap:wrap;gap:10px}
/* 우체통은 세로로 길어서 큰 글자 머리 위에서 끝나게 높이로 맞춘다 */
.intro .poster.tall .cut{top:8%;right:11%;width:auto;height:62%}
/* 네 단계: 붙인 말 → 일곱 화면 + 집계 칸 → 한 줄. 몰린 판만 버터 테, 끝 단계엔 테가 없어진다 */
.round{margin:0;padding:28px 0;border-bottom:1px solid var(--line)}
.round:first-of-type{padding-top:14px}
.round:last-of-type{padding-bottom:0;border-bottom:0}
.round-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.round-no{margin:0 0 2px;font-size:13px;font-weight:550;color:var(--ink-3)}
.round h3{margin:0;font-size:20px;font-weight:650;line-height:1.35;letter-spacing:-.015em}
.gray-btn{flex:none;min-height:44px;padding:0 15px;font-size:14px;margin-top:-2px}
.said{margin:12px 0 14px;padding:12px 16px 13px;border-radius:16px;background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--line);font-size:15.5px;line-height:1.6;color:var(--ink-2);text-wrap:pretty}
.said b{display:block;margin:0 0 2px;font-size:13px;font-weight:550;color:var(--ink-3)}
.shots{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}
.shot{position:relative;display:block;overflow:hidden;border-radius:10px;background:var(--surface-2);box-shadow:0 0 0 1px var(--line)}
.shot img{width:100%;height:auto;aspect-ratio:3/5;object-fit:cover;object-position:top;transition:filter .18s var(--ease)}
.shot.on::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 3px var(--led-check);pointer-events:none}
.shots.gray img{filter:grayscale(1)}
@media(forced-colors:active){.shot.on{outline:3px solid Highlight;outline-offset:-3px}}
.tally{display:flex;flex-direction:column;justify-content:flex-end;gap:4px;min-width:0;padding:10px;border-radius:10px;background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--line-2)}
.tally b{font-size:30px;font-weight:680;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.tally span{font-size:13px;font-weight:550;line-height:1.3;color:var(--ink-2)}
.tally.win{background:var(--studio),var(--face);color:var(--on-face);box-shadow:inset 0 1px 0 rgba(255,255,255,.16)}
.tally.win span{color:var(--on-face)}
.read{margin:12px 0 0;font-size:15.5px;line-height:1.6;color:var(--ink);text-wrap:pretty}
/* 물건 고르는 법: 기준 셋 + 실제 물건 일곱 + 만들기로 가는 칸 */
.rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none;counter-reset:rule}
.rules li{counter-increment:rule;padding:18px 20px;border-radius:var(--r-lg);background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--line)}
.rules li::before{content:counter(rule,decimal-leading-zero);display:block;margin:0 0 10px;font:500 11.5px/1 var(--mono);letter-spacing:.08em;color:var(--ink-3)}
.rules b{display:block;font-size:17px;font-weight:600;line-height:1.35;letter-spacing:-.01em}
.rules p{margin:6px 0 0;font-size:15px;line-height:1.6;color:var(--ink-2);text-wrap:pretty}
.picks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 0;padding:0;list-style:none}
.pick{display:flex;flex-direction:column;height:100%;overflow:hidden;border-radius:18px;background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--line);color:var(--ink);text-decoration:none}
.pick img{width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;object-position:top}
.pick b{display:block;padding:12px 14px 0;font-size:15.5px;font-weight:600;line-height:1.4;letter-spacing:-.01em}
.pick span{display:block;padding:2px 14px 14px;font-size:13px;color:var(--ink-3)}
.pick.go{justify-content:flex-end;gap:6px;padding:16px;background:var(--ink);color:var(--on-ink);box-shadow:none}
.pick.go b{padding:0;font-size:17px;font-weight:650}
.pick.go span{padding:0;font-size:14px;color:inherit;opacity:.72}
/* 요청문 만들기 */
.maker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 14px}
.fld{min-width:0}
.fld label{display:block;margin:0 0 8px;font-size:15.5px;font-weight:600}
.fld input{display:block;width:100%;min-height:52px;padding:0 16px;border:0;border-radius:14px;background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--line-2);font-size:16px}
.fld input::placeholder{color:var(--ink-3)}
.fld input:focus{outline:2px solid var(--tint);outline-offset:1px}
.fld .hint{margin:10px 0 0}
.kinds{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}
.kinds .chip{padding:0 14px;font-size:14px}
.maker .copybox{grid-column:1 / -1;margin:0}
.maker .copybox textarea{min-height:128px;resize:none}
@supports not (field-sizing:content){.maker .copybox textarea{min-height:176px}}
.maker .status{flex:1 1 180px}
.maker .privacy{grid-column:1 / -1;display:flex;align-items:flex-start;gap:9px;margin:0;font-size:14px;color:var(--ink-3)}
.maker .privacy::before{content:"";flex:none;width:7px;height:7px;margin-top:8px;border-radius:50%;background:var(--led-ok);box-shadow:0 0 0 3px rgba(125,180,90,.22)}
/* 조건과 한계 */
dl.facts{display:grid;gap:0;margin:0}
dl.facts>div{display:grid;grid-template-columns:150px minmax(0,1fr);gap:16px;padding:14px 0;border-top:1px solid var(--line)}
dl.facts>div:first-child{border-top:0;padding-top:6px}
dl.facts dt{font-size:15px;font-weight:600;color:var(--ink)}
dl.facts dd{margin:0;max-width:66ch;font-size:15.5px;line-height:1.66;color:var(--ink-2);text-wrap:pretty}
.links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0 0;padding:0;list-style:none}
.links a{display:flex;flex-direction:column;gap:4px;height:100%;padding:16px 18px;border-radius:18px;background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--line);text-decoration:none}
.links b{font-size:15.5px;font-weight:650}
.links span{font-size:14px;color:var(--ink-3)}
/* 크게 보기 */
.lb{width:min(100vw,460px);max-width:100vw;max-height:100dvh;margin:auto;padding:0;border:0;background:transparent;color:#FAFAF9;overflow:hidden}
.lb::backdrop{background:rgba(6,7,9,.95)}
.lb figure{display:flex;flex-direction:column;align-items:center;gap:10px;margin:0;padding:calc(12px + env(safe-area-inset-top,0px)) 16px calc(12px + env(safe-area-inset-bottom,0px))}
/* 그림 밖 칸(위아래 여백 · 캡션 두 줄 · 단추 줄 · 홈 막대)을 다 빼고 남는 높이만 그림에 준다 */
.lb img{width:auto;max-width:100%;height:auto;max-height:calc(100vh - 150px);max-height:calc(100dvh - 150px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));aspect-ratio:390/844;border-radius:12px;background:#121317}
.lb figcaption{min-height:1.5em;font-size:14px;font-weight:550;text-align:center}
.lb-bar{display:flex;gap:8px;width:100%}
.lb-bar button{flex:1;min-height:48px;border:0;border-radius:999px;background:rgba(255,255,255,.1);color:#FAFAF9;font-size:15px;font-weight:600}
.lb-bar [data-close]{background:#FAFAF9;color:#08090C}
@media(hover:hover){.shot:hover,.pick:hover{box-shadow:0 0 0 1px var(--ink-4)}.links a:hover{box-shadow:inset 0 0 0 1px var(--line-2);background:var(--surface-2)}}
@media(prefers-reduced-motion:reduce){.shot img{transition:none}}
@media(max-width:880px){.rules{grid-template-columns:minmax(0,1fr)}.links{grid-template-columns:minmax(0,1fr)}}
/* 휴대폰: 포스터는 낮은 띠로, 화면은 4칸 두 줄(집계가 여덟째 칸) */
@media(max-width:760px){
  .intro .poster.tall{min-height:196px;--word-scale:44cqw}
  .intro .poster.tall .cut{top:6%;right:5%;width:auto;height:88%}
  .intro .poster .led-chip{display:none}
  .intro h1{margin:12px 0 16px}
  .shots{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  .picks{grid-template-columns:repeat(2,minmax(0,1fr))}
  .maker{grid-template-columns:minmax(0,1fr)}
}
@media(max-width:560px){
  .tool{padding-left:8px;padding-right:8px}
  .tool>main{padding:22px 14px 26px}
  .tally{padding:8px}
  .rules li{padding:14px 16px}
  .rules li::before{margin-bottom:6px}
  .tally b{font-size:24px}
  dl.facts>div{grid-template-columns:minmax(0,1fr);gap:4px}
  .cta .btn{flex:1 1 0;padding:0 16px}
  .intro .meta{display:none}
  .intro .lead{margin-bottom:20px}
}
@media print{.bar,.gray-btn,.lb{display:none}.maker .copybox textarea{display:block!important}}`;

function renderPage(data) {
  const [c1, c2, c3, c4] = data.구역;
  const a = data.만들기;
  const start = fill(data.요청문, '【업종】', '【물건】');
  // 물건 이름 뒤에 조사를 붙이지 않는다(받침에 따라 으로 · 로가 갈린다)
  const pickAlt = (p) => esc(`${p.이름} 실제 화면, 정해 준 물건은 ${p.물건}`);
  const picks = data.판.map((p) => `<li><a class="pick" href="${large('s4', p.id)}" data-open="picks" data-cap="${esc(`${p.이름} · ${p.물건}`)}" data-alt="${pickAlt(p)}"><img src="${large('s4', p.id)}" alt="${pickAlt(p)}" width="585" height="1266" loading="lazy" decoding="async"><b>${esc(p.물건)}</b><span>${esc(p.이름)}</span></a></li>`).join('');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(data.제목)} · yuhobuilds</title>
<meta name="description" content="${esc(data.메타설명)}">
<meta name="theme-color" content="#060709">
<script>
/* 화면 테마: SYNK 플랫폼(웹, 같은 synk.im)에서 고른 밤·낮·기기 설정을 따른다. 고른 적이 없으면 밤(core/signal.css). */
(function(){var v='night';try{v=localStorage.getItem('synk.platform.theme')||'night'}catch(e){}if(['night','day','system'].indexOf(v)<0)v='night';document.documentElement.setAttribute('data-theme',v);var day=v==='day'||(v==='system'&&window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches);document.querySelector('meta[name="theme-color"]').setAttribute('content',day?'#ECECEA':'#060709')})();
</script>
<link rel="canonical" href="${esc(data.주소)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="yuhobuilds">
<meta property="og:title" content="${esc(data.제목)} · ${esc(data.부제)}">
<meta property="og:description" content="${esc(data.메타설명)}">
<meta property="og:url" content="${esc(data.주소)}">
<meta property="og:image" content="${esc(data.주소)}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="assets/favicon-32.png">
<link rel="preload" href="assets/SUIT-subset.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="app.css">
<style>
${CSS}
</style>
</head>
<body>
<div class="tool">
  <header class="bar">
    <a class="brand" href="https://synk.im/builds/" aria-label="yuhobuilds 맞춤 프로그램 모음">
      <span class="bead"><img src="assets/brand-shift.webp" alt="synk SHIFT" width="88" height="24"></span>
      <span class="crumb" aria-hidden="true">yuhobuilds <i>/</i> homepage</span>
    </a>
  </header>
  <main id="app">
    <section class="intro">
      <div>
        <p class="eyebrow">Homepage</p>
        <h1 tabindex="-1">${esc(data.제목)}<br><span class="hl">${esc(data.부제)}</span></h1>
        <p class="lead">${esc(data.요약)}</p>
        <ul class="meta" aria-label="이 화면에 든 것">
          <li>실제 화면 28장</li>
          <li>물건 고르는 법</li>
          <li>요청문 만들기</li>
          <li>PDF 한 장</li>
        </ul>
        <div class="cta">
          <a class="btn primary" href="#make">요청문 만들기</a>
          <a class="btn soft" href="guide.pdf" download="${PDF_NAME}">PDF 받기</a>
        </div>
      </div>
      <div class="art">
        <div class="poster tall" data-word="물건" style="--len:2">
          <span class="label">One object</span>
          <span class="led-chip">실제 화면</span>
          <img class="cut" src="assets/homepage-art-intro.webp" alt="" width="502" height="900">
        </div>
      </div>
    </section>

    <section class="block" aria-labelledby="h-rounds">
      <h2 id="h-rounds"><span class="no"></span>${esc(c1)}</h2>
      <p class="sub">${esc(data.이렇게.머리)} ${esc(data.이렇게.쪽)}</p>
${data.단계.map((s, i) => roundBlock(data, s, i)).join('\n')}
    </section>

    <section class="block" aria-labelledby="h-pick">
      <h2 id="h-pick"><span class="no"></span>${esc(c2)}</h2>
      <p class="sub">${esc(data.고르는법.머리)}</p>
      <ol class="rules">${data.고르는법.기준.map((r) => `<li><b>${esc(r.제목)}</b><p>${esc(r.글)}</p></li>`).join('')}</ol>
      <ul class="picks" aria-label="일곱 판에 정해 준 물건">${picks}<li><a class="pick go" href="#make"><b>우리 가게 물건으로</b><span>요청문 만들기로 가기</span></a></li></ul>
    </section>

    <section class="block" id="make" aria-labelledby="h-make">
      <h2 id="h-make"><span class="no"></span>${esc(c3)}</h2>
      <p class="sub">${esc(a.머리)}</p>
      <form class="maker" data-make data-template="${esc(data.요청문)}" data-msg-empty="${esc(a.알림.빈칸)}" data-msg-done="${esc(a.알림.복사됨)}" data-msg-fail="${esc(a.알림.실패)}" autocomplete="off">
        <div class="fld">
          <label for="make-kind">어떤 가게인가요?</label>
          <input id="make-kind" name="kind" type="text" maxlength="40" placeholder="${esc(a.예시.업종)}" enterkeyhint="next">
          <div class="kinds" role="group" aria-label="업종 예시">${a.업종예시.map((k) => `<button type="button" class="chip" data-kind="${esc(k)}" aria-pressed="false">${esc(k)}</button>`).join('')}</div>
        </div>
        <div class="fld">
          <label for="make-object">가게의 어떤 물건인가요?</label>
          <input id="make-object" name="object" type="text" maxlength="60" placeholder="${esc(a.예시.물건)}" enterkeyhint="done">
          <p class="hint">색까지 같이 적어 주세요.</p>
        </div>
        <div class="copybox main">
          <label for="make-out">완성된 요청문</label>
          <textarea id="make-out" data-out readonly>${esc(start)}</textarea>
          <div class="row"><button type="button" class="btn primary" data-copy disabled>요청문 복사</button><span class="status" data-status role="status"></span></div>
        </div>
        <p class="privacy">${esc(a.약속)}</p>
      </form>
    </section>

    <section class="block" aria-labelledby="h-limit">
      <h2 id="h-limit"><span class="no"></span>${esc(c4)}</h2>
      <dl class="facts">${data.한계.map((r) => `<div><dt>${esc(r.제목)}</dt><dd>${esc(r.글)}</dd></div>`).join('')}</dl>
      <ul class="links">
        <li><a href="guide.pdf" download="${PDF_NAME}"><b>PDF로 받기</b><span>이 화면과 같은 내용 한 장</span></a></li>
${data.더보기.map((l) => `        <li><a href="${esc(l.주소)}"><b>${esc(l.제목)}</b><span>${esc(l.글)}</span></a></li>`).join('\n')}
      </ul>
    </section>
  </main>
  <footer class="foot">
    <span>yuhobuilds · 유호 · AI와 회사 만들기</span>
    <span><a href="https://www.instagram.com/yuhobuilds/" target="_blank" rel="noopener">Instagram</a> · <a href="https://www.youtube.com/@yuhobuilds" target="_blank" rel="noopener">YouTube</a></span>
  </footer>
  <dialog class="lb" data-box aria-label="화면 크게 보기">
    <figure>
      <img alt="" width="390" height="844">
      <figcaption></figcaption>
      <div class="lb-bar"><button type="button" data-prev>이전</button><button type="button" data-next>다음</button><button type="button" data-close>닫기</button></div>
    </figure>
  </dialog>
</div>
<noscript><p style="max-width:680px;margin:40px auto;padding:0 20px;font-size:17px">요청문 만들기는 브라우저 안에서 돌아요. 자바스크립트를 켜 주세요.</p></noscript>
<script src="request.js"></script>
<script src="view.js"></script>
</body>
</html>
`;
}

// ── PDF 원고 ── 흰 종이 · 폭 480px 한 장. 높이는 빌드가 재서 __HEIGHT__ 자리에 넣는다.
const GUIDE_CSS = `@font-face{font-family:'SUIT Variable';font-weight:100 900;src:url(assets/SUIT-subset.woff2) format('woff2')}
@font-face{font-family:'DM Mono';font-weight:500;src:url(assets/DMMono-500.woff2) format('woff2');unicode-range:U+0021-007E}
@page{size:${WIDTH}px __HEIGHT__px;margin:0}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;background:#fff}
body{width:${WIDTH}px;font:450 16px/1.6 'SUIT Variable',sans-serif;color:#08090C;word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
.sheet{padding:26px 24px 28px}
.top{display:flex;align-items:center;justify-content:space-between;margin:0 0 22px;padding:0 0 12px;border-bottom:1px solid rgba(8,9,12,.14)}
.top img{height:20px;width:auto}
.top span{font:500 12px/1 'DM Mono',monospace;letter-spacing:.04em;color:rgba(8,9,12,.62)}
h1{margin:0 0 12px;font-size:34px;font-weight:680;line-height:1.16;letter-spacing:-.035em}
h1 span{color:rgba(8,9,12,.56)}
.lead{margin:0;font-size:16px;line-height:1.62;color:rgba(8,9,12,.76)}
section{margin:30px 0 0}
h2{display:flex;align-items:baseline;gap:10px;margin:0 0 4px;padding:0 0 10px;border-bottom:1px solid rgba(8,9,12,.14);font-size:22px;font-weight:650;letter-spacing:-.02em;line-height:1.25}
h2 .no{font:500 12px/1 'DM Mono',monospace;letter-spacing:.08em;color:rgba(8,9,12,.56)}
.sub{margin:10px 0 0;font-size:15px;line-height:1.6;color:rgba(8,9,12,.72)}
.round{margin:20px 0 0;break-inside:avoid}
.round-no{margin:0;font-size:13px;font-weight:550;color:rgba(8,9,12,.56)}
h3{margin:0;font-size:18px;font-weight:650;line-height:1.35;letter-spacing:-.015em}
.said{margin:8px 0 10px;padding:9px 12px;border-radius:10px;background:#F2F2F0;font-size:14px;line-height:1.55;color:rgba(8,9,12,.76)}
.shots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.shot{position:relative;overflow:hidden;border-radius:7px;box-shadow:0 0 0 1px rgba(8,9,12,.12)}
.shot img{display:block;width:100%;height:auto;aspect-ratio:3/5;object-fit:cover;object-position:top}
.shot.on::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 3px #F5C445}
.tally{display:flex;flex-direction:column;justify-content:flex-end;gap:3px;padding:8px;border-radius:7px;background:#F2F2F0}
.tally b{font-size:26px;font-weight:680;line-height:1;letter-spacing:-.03em}
.tally span{font-size:13px;font-weight:550;line-height:1.3;color:rgba(8,9,12,.74)}
.tally.win{background:#3D6BC9;color:#fff}
.tally.win span{color:#fff}
.read{margin:8px 0 0;font-size:15px;line-height:1.55}
.rules{margin:12px 0 0;padding:0;list-style:none}
.rules li{padding:9px 0;border-top:1px solid rgba(8,9,12,.1)}
.rules li:first-child{border-top:0;padding-top:0}
.rules b{display:block;font-size:16px;font-weight:600}
.rules span{font-size:14.5px;line-height:1.55;color:rgba(8,9,12,.72)}
table{width:100%;margin:10px 0 0;border-collapse:collapse;font-size:14.5px}
th{padding:7px 0;text-align:left;font-weight:600;white-space:nowrap;vertical-align:top;width:92px}
td{padding:7px 0;color:rgba(8,9,12,.76)}
tr+tr>*{border-top:1px solid rgba(8,9,12,.1)}
.box{margin:12px 0 0;padding:14px;border-radius:12px;box-shadow:inset 0 0 0 1.5px #08090C;font-size:16px;font-weight:550;line-height:1.6}
.eg{margin:8px 0 0;font-size:14px;line-height:1.55;color:rgba(8,9,12,.72)}
a{color:inherit}
.fact{padding:9px 0;border-top:1px solid rgba(8,9,12,.1)}
.fact:first-of-type{border-top:0}
.fact b{display:block;font-size:15px;font-weight:600}
.fact span{font-size:14.5px;line-height:1.58;color:rgba(8,9,12,.74)}
.end{margin:24px 0 0;padding:12px 0 0;border-top:1px solid rgba(8,9,12,.14);font-size:13px;color:rgba(8,9,12,.62)}`;

function renderGuide(data) {
  const [c1, c2, c3, c4] = data.구역;
  const a = data.만들기;
  const shot = (s, p) => `<div class="shot${s.몰린판.includes(p.id) ? ' on' : ''}"><img src="${thumb(s.id, p.id)}" alt="" width="240" height="519"></div>`;
  const rounds = data.단계.map((s, i) => `<div class="round"><p class="round-no">${i + 1}단계</p><h3>${esc(s.이름)}</h3><p class="said">${s.붙인말 ? `끝에 붙인 말: 「${esc(s.붙인말)}」` : esc(s.붙인말없음)}</p><div class="shots">${data.판.map((p) => shot(s, p)).join('')}<div class="tally${s.끝 ? ' win' : ''}"><b>${esc(s.수)}</b><span>${esc(s.결과)}</span></div></div><p class="read">${esc(s.풀이)}</p></div>`).join('');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(data.제목)} · ${esc(data.부제)}</title>
<style>
${GUIDE_CSS}
</style>
</head>
<body>
<div class="sheet">
  <div class="top"><img src="assets/brand-shift.webp" alt="synk SHIFT"><span>${SITE}</span></div>
  <h1>${esc(data.제목)}<br><span>${esc(data.부제)}</span></h1>
  <p class="lead">${esc(data.요약)}</p>
  <section><h2><span class="no">01</span>${esc(c1)}</h2><p class="sub">${esc(data.이렇게.머리)}</p>${rounds}</section>
  <section><h2><span class="no">02</span>${esc(c2)}</h2><p class="sub">${esc(data.고르는법.머리)}</p>
    <ul class="rules">${data.고르는법.기준.map((r) => `<li><b>${esc(r.제목)}</b><span>${esc(r.글)}</span></li>`).join('')}</ul>
    <table>${data.판.map((p) => `<tr><th>${esc(p.이름)}</th><td>${esc(p.물건)}</td></tr>`).join('')}</table>
  </section>
  <section><h2><span class="no">03</span>${esc(c3)}</h2><p class="sub">${esc(a.PDF)}</p>
    <p class="box">${esc(fill(data.요청문, '【업종】', '【물건】'))}</p>
    <p class="eg">예: ${esc(fill(data.요청문, a.예시.업종, a.예시.물건))}</p>
    <p class="eg"><a href="${esc(data.주소)}">${SITE}</a></p>
  </section>
  <section><h2><span class="no">04</span>${esc(c4)}</h2>${data.한계.map((r) => `<div class="fact"><b>${esc(r.제목)}</b><span>${esc(r.글)}</span></div>`).join('')}</section>
  <p class="end">yuhobuilds · 유호 · AI와 회사 만들기</p>
</div>
<script>document.fonts.ready.then(function(){document.documentElement.setAttribute('data-height',Math.ceil(document.querySelector('.sheet').getBoundingClientRect().height))})</script>
</body>
</html>
`;
}

function read(here = __dirname) { return JSON.parse(fs.readFileSync(path.join(here, '내용.json'), 'utf8')); }

// 그림 파일이 다 있는지 — 단계 × 판마다 작은 그림 · 큰 그림 둘.
function missingShots(data, here = __dirname) {
  const out = [];
  for (const s of data.단계) for (const p of data.판) for (const f of [thumb(s.id, p.id), large(s.id, p.id)]) if (!fs.existsSync(path.join(here, f))) out.push(f);
  return out;
}

module.exports = { check, read, missingShots, renderPage, renderGuide, WIDTH };
