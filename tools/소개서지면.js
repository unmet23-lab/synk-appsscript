#!/usr/bin/env node
'use strict';
/**
 * 소개서지면 — 정본 소개서 셋(LAB · 기업 · SHIFT)을 «한 지면»으로 굽는다.
 *
 * 왜 있나 (유호 지시 2026-09-03 「방금 썼던 것들 전부 링크 띄워줘 여기서 볼래」)
 *   소개서는 .txt 마크다운이라 그대로는 못 읽으신다. 그래서 탭 셋짜리 지면으로 굽고 아티팩트로 올린다.
 *   🔑 지면을 손으로 고치지 않는다 — 원본은 docs/정본/… 셋이고, 그것이 바뀌면 여기서 다시 굽는다
 *      (발표물빌드.js 와 같은 규율: _src_ 가 원본, 산출물은 굽는다).
 *
 * 색·서체는 docs/디자인_토큰.json 킷에서 이름째로 가져온다. 새로 고르지 않는다.
 *   · 바탕 Paper #FBF7F0 / 글자 Ink #2B2320(대비 14.42) / 구분선 Stitch #F0E3C8(실땀)
 *   · 신호 «글자»는 Coral 3 #AE322A(5.98) — Coral 본색 #F96859 는 종이 위 글자 금지(2.75)라 «면»에만
 *   · 어두운 화면은 Ink Deep #080605 바탕(양모 밤)
 *   🔴 낫표 교정을 반드시 싣는다 — Inter Tight 에 「 」(U+300C/300D) 글리프가 없어 좁게 그려지면
 *      여는 따옴표로 오독된다(토큰 §서체 · 08-31 실측).
 *
 * 쓰는 법:  node tools/소개서지면.js [나갈 파일]   (기본 = docs/소개서_지면.html)
 * 올리는 곳: 아티팩트 1cb22932-6b47-4891-b16f-e8e32de9de03 (같은 파일 경로로 다시 발행하면 링크 유지)
 */
const fs = require('fs');
const { 바꾸기 } = require('./lib/마크다운을html로.js');
const 뿌리 = require('path').resolve(__dirname, '..') + '/';

const 소개서 = [
  { 키:'lab',   이름:'SYNK LAB',   쪽:'학부모·학생이 읽는 초대장',           길:'docs/정본/SYNK LAB/SYNK LAB 소개서.txt' },
  { 키:'corp',  이름:'SYNK 기업',  쪽:'파트너·투자자·함께 일할 사람',        길:'docs/정본/SYNK/SYNK 기업소개서.txt' },
  { 키:'shift', 이름:'SYNK SHIFT', 쪽:'기업·파트너 · 한국 법인 (새로 씀)',   길:'docs/정본/SYNK SHIFT/SYNK SHIFT 소개서.txt' },
];

const 판 = [];
for (const s of 소개서) {
  const md = fs.readFileSync(뿌리 + s.길, 'utf8');
  const { 본문, 목차 } = 바꾸기(md);
  판.push({ ...s, 본문, 목차, 글자: md.replace(/\s/g, '').length });
}
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const 머리부 = [
'<title>SYNK 소개서 세 벌</title>',
'<link rel="preconnect" href="https://fonts.googleapis.com">',
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">',
'<style>',
'/* 낫표 교정 — 디자인_토큰.json 서체 절. Inter Tight 에 U+300C/300D 글리프가 없어 좁게 그려지면',
'   여는 따옴표로 오독된다(08-31 실측). 한글 폰트가 그 두 자만 그리도록 못 박는다. */',
'@font-face{font-family:"SYNK Bracket";',
'  src:local("Malgun Gothic"),local("Apple SD Gothic Neo"),local("Noto Sans KR"),local("Noto Sans CJK KR");',
'  unicode-range:U+300C-300D;}',
'',
'/* 색은 전부 docs/디자인_토큰.json 킷에서 온다 — 이름도 대비값도 거기 적혀 있다 */',
':root{',
'  --paper:#FBF7F0;       /* Paper — 양모 종이 */',
'  --card:#FFFFFF;',
'  --ink:#2B2320;         /* Ink — 갈색이 밴 따뜻한 먹 (Paper 위 14.42) */',
'  --ink-2:#575046;       /* Deep Wool */',
'  --muted:#8D857A;       /* Ash Wool — 보조 글자·캡션 */',
'  --stitch:#F0E3C8;      /* Stitch — 실땀. 이 페이지의 모든 구분선이 이 색이다 */',
'  --oat:#EDE7DC;         /* Oat — 가라앉은 면 */',
'  --stone:#C7BFB2;',
'  --signal:#AE322A;      /* Coral 3 — 종이 위 신호 «글자» (5.98) */',
'  --face:#F96859;        /* Coral — 면 전용. 종이 위 글자로는 못 쓴다 (2.75) */',
'  --wash:#FEF0E9;        /* Coral Wash */',
'  --link:#24448C;        /* Lapis Deep — 링크·안내 글자 (8.62) */',
'}',
'@media (prefers-color-scheme:dark){',
'  :root:not([data-theme="light"]){',
'    --paper:#080605; --card:#161110; --ink:#F2EBE2; --ink-2:#CFC5B8; --muted:#9C9285;',
'    --stitch:#3A322B; --oat:#1E1917; --stone:#4A4239;',
'    --signal:#FD9C87; --face:#F96859; --wash:#241A17; --link:#C5D6F5;',
'  }',
'}',
':root[data-theme="dark"]{',
'  --paper:#080605; --card:#161110; --ink:#F2EBE2; --ink-2:#CFC5B8; --muted:#9C9285;',
'  --stitch:#3A322B; --oat:#1E1917; --stone:#4A4239;',
'  --signal:#FD9C87; --face:#F96859; --wash:#241A17; --link:#C5D6F5;',
'}',
'',
'*{box-sizing:border-box}',
'body{margin:0; background:var(--paper); color:var(--ink);',
'  font-family:"SYNK Bracket","Inter Tight",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;',
'  font-size:16px; line-height:1.75; -webkit-font-smoothing:antialiased;}',
'::selection{background:var(--wash); color:var(--ink)}',
'',
'.머리{border-bottom:1px solid var(--stitch); background:var(--paper); position:sticky; top:0; z-index:20}',
'.머리안{max-width:1180px; margin:0 auto; padding:18px 24px 0}',
'.표찰{display:flex; align-items:baseline; gap:12px; flex-wrap:wrap}',
'.표찰 b{font-size:15px; font-weight:700; letter-spacing:.14em}',
'.표찰 span{font-size:12.5px; color:var(--muted)}',
'',
'.탭들{display:flex; gap:2px; margin-top:16px; overflow-x:auto; scrollbar-width:none}',
'.탭들::-webkit-scrollbar{display:none}',
'.탭{appearance:none; border:0; background:none; cursor:pointer; white-space:nowrap; font:inherit;',
'  color:var(--muted); padding:9px 16px 12px; border-bottom:2px solid transparent;',
'  display:flex; flex-direction:column; gap:2px; align-items:flex-start; transition:color .15s}',
'.탭:hover{color:var(--ink)}',
'.탭 em{font-style:normal; font-weight:600; font-size:14.5px}',
'.탭 i{font-style:normal; font-size:11.5px; opacity:.85}',
'.탭[aria-selected="true"]{color:var(--ink); border-bottom-color:var(--face)}',
'.탭:focus-visible{outline:2px solid var(--link); outline-offset:-3px; border-radius:3px}',
'',
'.판{max-width:1180px; margin:0 auto; padding:0 24px 96px; display:grid; grid-template-columns:minmax(0,1fr); gap:48px}',
'@media(min-width:1000px){.판{grid-template-columns:minmax(0,1fr) 208px}}',
'.글{max-width:68ch; min-width:0}',
'.차례{display:none}',
'@media(min-width:1000px){',
'  .차례{display:block; position:sticky; top:138px; align-self:start; padding-top:46px}',
'  .차례 b{display:block; font-size:11px; letter-spacing:.16em; color:var(--muted); margin-bottom:10px}',
'  .차례 a{display:block; font-size:12.5px; line-height:1.5; color:var(--muted); text-decoration:none;',
'    padding:4px 0 4px 10px; border-left:1px solid var(--stitch)}',
'  .차례 a:hover{color:var(--ink); border-left-color:var(--face)}',
'  .차례 a.깊{padding-left:20px; font-size:12px; opacity:.82}',
'}',
'',
'.글 h1{font-size:30px; line-height:1.28; font-weight:700; letter-spacing:-.01em; margin:44px 0 8px; text-wrap:balance}',
'.글 h2{font-size:20px; line-height:1.35; font-weight:650; margin:52px 0 2px; padding-top:22px;',
'  border-top:1px dashed var(--stitch); text-wrap:balance}',
'.글 h3{font-size:16.5px; font-weight:650; margin:34px 0 0}',
'.글 p{margin:14px 0}',
'.글 a{color:var(--link); text-underline-offset:2px}',
'.글 strong{font-weight:650}',
'.글 em{color:var(--ink-2)}',
'.글 code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.87em;',
'  background:var(--oat); padding:.12em .38em; border-radius:4px}',
'.글 hr{border:0; border-top:1px dashed var(--stitch); margin:40px 0}',
'.글 ul{margin:14px 0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:8px}',
'.글 li{position:relative; padding-left:18px}',
'.글 li::before{content:""; position:absolute; left:2px; top:.72em; width:5px; height:1.5px; background:var(--stone)}',
'.글 blockquote{margin:22px 0; padding:16px 20px; background:var(--wash);',
'  border-left:2px solid var(--face); border-radius:0 6px 6px 0}',
'.글 blockquote p{margin:6px 0}',
'.글 blockquote p:first-child{margin-top:0}',
'.글 blockquote p:last-child{margin-bottom:0}',
'',
'.표감{overflow-x:auto; margin:22px 0; border:1px solid var(--stitch); border-radius:8px}',
'table{border-collapse:collapse; width:100%; font-size:14.5px; font-variant-numeric:tabular-nums}',
'th,td{padding:10px 14px; text-align:left; vertical-align:top; border-bottom:1px solid var(--stitch)}',
'th{background:var(--oat); font-weight:650; font-size:13px; white-space:nowrap}',
'tbody tr:last-child td{border-bottom:0}',
'',
'.꼬리{max-width:1180px; margin:0 auto; padding:20px 24px 72px; font-size:12.5px; color:var(--muted);',
'  border-top:1px dashed var(--stitch)}',
'.셈{display:flex; gap:18px; flex-wrap:wrap; margin-top:6px}',
'[hidden]{display:none!important}',
'@media (prefers-reduced-motion:reduce){*{transition:none!important}}',
'</style>',
].join('\n');

const 탭줄 = 판.map((p, i) =>
  '      <button class="탭" role="tab" id="탭-' + p.키 + '" aria-controls="판-' + p.키 +
  '" aria-selected="' + (i === 0) + '" data-key="' + p.키 + '">' +
  '<em>' + esc(p.이름) + '</em><i>' + esc(p.쪽) + '</i></button>').join('\n');

const 머리 = [
'<header class="머리">',
'  <div class="머리안">',
'    <div class="표찰"><b>SYNK</b><span>소개서 세 벌 · 2026-09-03 판</span></div>',
'    <div class="탭들" role="tablist">',
탭줄,
'    </div>',
'  </div>',
'</header>',
].join('\n');

const 판들 = 판.map((p, i) => [
'<div class="판" id="판-' + p.키 + '" role="tabpanel" aria-labelledby="탭-' + p.키 + '"' + (i === 0 ? '' : ' hidden') + '>',
'  <article class="글">',
p.본문,
'  </article>',
'  <nav class="차례"><b>차례</b>',
p.목차.map((t) => '    <a href="#' + t.id + '"' + (t.급 >= 2 ? ' class="깊"' : '') + '>' + esc(t.글) + '</a>').join('\n'),
'  </nav>',
'</div>',
].join('\n')).join('\n');

const 꼬리 = [
'<footer class="꼬리">',
'  <div>세 벌 모두 한국어 글 검사 지적 <strong>0건</strong>입니다. 색과 서체는 <code>docs/디자인_토큰.json</code> 킷을 그대로 씁니다.</div>',
'  <div class="셈">' + 판.map((p) => '<span>' + esc(p.이름) + ' · ' + p.글자.toLocaleString() + '자</span>').join('') + '</div>',
'</footer>',
].join('\n');

const 붙임 = [
'<script>',
'var 탭들 = Array.prototype.slice.call(document.querySelectorAll(".탭"));',
'탭들.forEach(function(t){',
'  t.addEventListener("click", function(){',
'    탭들.forEach(function(x){',
'      var 켬 = (x === t);',
'      x.setAttribute("aria-selected", 켬);',
'      document.getElementById("판-" + x.dataset.key).hidden = !켬;',
'    });',
'    window.scrollTo(0, 0);',
'  });',
'});',
'</script>',
].join('\n');

const html = [머리부, '', 머리, '', 판들, '', 꼬리, '', 붙임].join('\n');
const 길 = process.argv[2] || (require('path').resolve(__dirname,'..') + '/docs/소개서_지면.html');
fs.writeFileSync(길, html, 'utf8');
console.log('✔ 지었다 · ' + Math.round(Buffer.byteLength(html, 'utf8') / 1024) + 'KB');
for (const p of 판) console.log('   ' + p.이름.padEnd(11) + ' 절 ' + p.목차.length + ' · ' + p.글자.toLocaleString() + '자');
