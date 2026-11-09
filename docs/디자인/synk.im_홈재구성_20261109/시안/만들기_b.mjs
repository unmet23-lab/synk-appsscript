#!/usr/bin/env node
// synk.im 홈 시안 B 「빼기 판」(2026-11-09). 새로 짜지 않고 공개본에서 빼기만 한다 — 입구와 네 무대는 공개본 그대로 두고,
// 상황극 띠 · 「쓸수록 달라지는 것」 · 여덟 엔진 구역 · 창업자 띠를 뺀 자리에 회사 설명과 지키는 것 · 방향만 넣는다.
// 까닭: 시안 A는 입구 아래 그림 면적이 공개본 41.6% → 3.3%로 줄어 「더 별로가 된 느낌」(유호님 11-09).
//   node docs/디자인/synk.im_홈재구성_20261109/시안/만들기_b.mjs → home-b.html
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = dirname(fileURLToPath(import.meta.url));
let h = await (await fetch('https://synk.im/')).text();
const 구간 = (앞, 뒤) => { const a = h.indexOf(앞), b = h.indexOf(뒤, a); if (a < 0 || b < 0) throw new Error(`못 찾음: ${앞}`); return [a, b]; };

// 1. 회사 머리: 공개본 틀 그대로, 글만 왜 · 무엇으로. 상황극 단추를 뺀다.
const 머리 = `<section class="cover" id="top"><span id="hero-introduction" class="sr-only" aria-hidden="true"></span><span id="founder" class="sr-only" aria-hidden="true"></span><div class="wrap">
<div class="cover-top"><p class="label"><i class="dot" aria-hidden="true"></i><span class="en">SYNK</span><span>개인화 엔진</span></p><span class="cover-rule" aria-hidden="true"></span><p class="mono cover-brands">LAB · SHIFT · PULSE · PATH</p></div>
<div class="cover-main"><h1 class="cover-title"><span>쓸수록 나를 아는</span> <span>AI를 만듭니다</span></h1>
<div class="cover-copy"><p class="lead">SYNK는 몽골의 한 학원에서 시작했습니다. 학생마다 필요한 도움이 다르다는 걸 알면서도 한 명씩 맞춰 줄 시간이 없었고, 그 일을 기술로 하려고 아틀라스를 만들었습니다. 한 사람의 목표와 실제로 해 본 결과를 읽고, 다음 도움을 그 사람에게 맞추는 엔진입니다.</p>
<div class="btns"><a class="btn btn-line" href="/atlas/">아틀라스 보기 <span class="arr" aria-hidden="true">→</span></a></div></div></div>
</div></section>
`;

// 2. 네 무대: 공개본 그대로. 상태 목록 · 이력 줄 · 고지 · 보조 링크는 각 사업 쪽에 있으니 칸에서 뺀다.
let [a, b] = 구간('<section class="section" id="business"', '<section class="lw" id="learner"');
let 사업 = h.slice(a, b);
사업 = 사업.replace(/<ul class="hs-status">.*?<\/ul>/gs, '').replace(/<p class="hs-proof">.*?<\/p>/gs, '').replace(/<p class="hs-note">.*?<\/p>/gs, '').replace(/<a class="[^"]*sub[^"]*"[^>]*>.*?<\/a>/gs, '');
사업 = 사업.replace('<span>K드라마 상황극으로,</span> <span>말하는 한국어를 만듭니다</span>', '<span>K드라마 속 유학생이 되어,</span> <span>한국어로 말합니다</span>');

// 3. 지키는 것 · 어디로 가나: 창업자 띠가 있던 검정 판 자리.
const 띠 = `<section class="b-band" id="atlas" aria-labelledby="belief-title"><div class="wrap">
<p class="b-label reveal" id="belief-title">지키는 것</p>
<ul class="b-beliefs reveal">
<li><h2>평균으로 짐작하지 않습니다</h2><p>나이·성별·국적이 아니라, 본인이 고른 설정과 실제로 해 본 결과로 맞춥니다.</p></li>
<li><h2>결정은 본인이 합니다</h2><p>엔진은 이유와 함께 제안할 뿐입니다. 무엇을 배우고 어디로 갈지는 본인이 정합니다.</p></li>
<li><h2>확인한 만큼만 말합니다</h2><p>도움이 됐는지 확인하고, 확인하지 않은 효과는 약속하지 않습니다.</p></li>
</ul>
<div class="b-way reveal"><p class="b-label">어디로 가나</p><p class="b-way-line"><span>한국어 공부에서 이 엔진을 끝까지 완성하고, 강의와 광고, 유학 준비로 넓혀 갑니다.</span> <span>지향하는 곳은 누구에게나 확실히 도움이 되는 엔진입니다.</span></p></div>
</div></section>
`;

const 머리시작 = h.indexOf('<section class="cover" id="top">'), 아래시작 = h.indexOf('<div class="section duo-band">');
if (머리시작 < 0 || 아래시작 < 0) throw new Error('공개본 구조가 바뀌었다');
h = h.slice(0, 머리시작) + 머리 + 사업 + 띠 + h.slice(아래시작);

// 4. 메뉴 · 시안 처리
h = h.replace(/<nav class="bar-nav" aria-label="주요 메뉴">.*?<\/nav>/s, '<nav class="bar-nav" aria-label="주요 메뉴"><a href="#top">회사 소개</a><a href="/atlas/">아틀라스</a><a href="#contact">문의</a></nav>');
h = h.replace(/<a href="\/founder\/">창업자<span aria-hidden="true">→<\/span><\/a>/, '');
h = h.replace(' data-visit', '').replace(/ data-pick="[a-z]+"/g, '');
h = h.replaceAll('href="/#', 'href="#').replace('<a href="#business">사업 소개<span aria-hidden="true">→</span></a>', '<a href="#top">회사 소개<span aria-hidden="true">→</span></a>').replace('href="#drama"', 'href="/lab/#drama"');
h = h.replace(/<link rel="stylesheet" href="\/assets\/v10\/(drama|learner)\.css[^>]*>\s*/g, '');
h = h.replace(/<script type="module" src="\/assets\/v10\/(drama|learner)\.js[^>]*><\/script>\s*/g, '');
h = h.replace(/<script type="module" src="\/social-conversion\.js[^>]*><\/script>\s*/g, '');
h = h.replace('</head>', '<meta name="robots" content="noindex"><link rel="stylesheet" href="home-b.css">\n</head>');
h = h.replace('</body>', `<script>const 옮김={'#drama':'/lab/#drama','#learner':'/lab/'};if(옮김[location.hash])location.replace(옮김[location.hash]);</script>\n</body>`);

writeFileSync(join(여기, 'home-b.html'), h);
console.log('home-b.html', Buffer.byteLength(h), '바이트');
