#!/usr/bin/env node
// synk.im 홈 시안 만들기(2026-11-09). 공개본 HTML을 받아 입구 · 메뉴 · 본문을 바꿔 home.html을 낸다.
// 공개본의 입구 그림 · 메뉴 · 소식 · 플랫폼 · 문의 · 바닥은 그대로 싣고, 스타일과 스크립트도 공개본 것을 쓴다(없는 주소는 serve.cjs가 synk.im으로 넘긴다).
//   node docs/디자인/synk.im_홈재구성_20261109/시안/만들기.mjs
// 회사 한 줄만 바꿔 보기: --한줄 "윗줄|아랫줄" --출력 home-b.html
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 인자 = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = 인자.indexOf(이름); return i >= 0 ? 인자[i + 1] : 기본; };
const 한줄 = 값('--한줄', '사람마다 막히는 곳이 다릅니다|해 본 결과를 읽고, 다음 도움을 맞춰 주는 AI를 만듭니다').split('|');
const 출력 = 값('--출력', 'home.html');

const 공개본 = await (await fetch('https://synk.im/')).text();
const 사이 = (글, 앞, 뒤) => { const a = 글.indexOf(앞); const b = 글.indexOf(뒤, a); if (a < 0 || b < 0) throw new Error(`못 찾음: ${앞}`); return 글.slice(a, b); };

// 공개본의 무대 넷(그림 · 영상 · 예약표 · 지도)을 그대로 옮긴다. 줄 글은 공개본 제목 그대로.
const 사업구역 = 사이(공개본, '<section class="section" id="business"', '<section class="lw" id="learner"');
const 틀 = 이름 => {
  const 칸 = 사이(사업구역, `class="hs hs-${이름}"`, '<div class="hs-txt">');
  return 칸.slice(칸.indexOf('<a class="hs-frame')).replace('<a class="hs-frame', `<a tabindex="-1" aria-hidden="true" data-frame="${이름}" class="hs-frame`).replace(/ aria-label="[^"]*"/, '');
};
const 사업 = [
  { 키: 'lab', 이름: 'LAB', 줄: 'K드라마 속 유학생이 되어, 한국어로 말합니다' },
  { 키: 'shift', 이름: 'SHIFT', 줄: 'AI를 강의하고, 반복 업무는 자동화합니다' },
  { 키: 'pulse', 이름: 'PULSE', 줄: '카메라 앞에서 10년, 배우가 AI 모델을 연출합니다' },
  { 키: 'path', 이름: 'PATH', 줄: '한국 유학부터 취업, 정착까지 함께 준비합니다' },
];
const 줄들 = 사업.map((s, i) => `<li id="${s.키}" data-row="${s.키}"${i ? '' : ' class="is-on"'}><a href="/${s.키}/">${s.키 === 'lab' ? '<span id="world" class="sr-only" aria-hidden="true"></span>' : ''}<span class="v13-name"><i class="dot dot-${s.키}" aria-hidden="true"></i>${s.이름}</span><span class="v13-line">${s.줄}</span><span class="arr" aria-hidden="true">→</span></a></li>`).join('');
const 틀들 = 사업.map((s, i) => 틀(s.키).replace('class="hs-frame', `class="${i ? '' : 'is-on '}hs-frame`)).join('');

const 본문 = `<section class="v13-why" id="top" aria-labelledby="why-title"><span id="hero-introduction" class="sr-only" aria-hidden="true"></span><span id="founder" class="sr-only" aria-hidden="true"></span><div class="wrap">
<p class="v13-label reveal">왜 시작했나</p>
<h2 class="v13-why-title reveal" id="why-title"><span>한 명씩 맞춰 줄</span> <span>시간이 없었습니다</span></h2>
<p class="v13-why-story reveal">SYNK의 기술은 몽골 울란바토르의 한 학원에서 출발했습니다. 학생마다 필요한 도움이 다르다는 걸 알면서도, 모두를 그렇게 챙기기에는 시간이 모자랐습니다. 그 일을 기술로 하려고 만든 회사입니다.</p>
</div></section>
<section class="v13-what" id="atlas" aria-labelledby="what-title"><div class="wrap">
<p class="v13-label reveal">무엇을 만드나</p>
<h2 class="v13-title reveal" id="what-title"><span>쓸수록 나를 아는</span> <span class="dim">AI 엔진, 아틀라스</span></h2>
<p class="v13-what-lead reveal">한 사람의 목표와 지금 상황을 <b>이해하고</b>, 내용과 설명, 화면과 소리를 그 사람에게 <b>맞추고</b>, 도움이 됐는지 <b>확인합니다</b></p>
<p class="v13-go reveal"><a class="link" href="/atlas/">여덟 엔진 자세히 보기<span class="arr" aria-hidden="true">→</span></a></p>
<p class="v13-belief-head reveal" id="belief-title">지키는 것</p>
<ol class="v13-beliefs reveal" aria-labelledby="belief-title">
<li><h3>평균으로 짐작하지 않습니다</h3><p>나이·성별·국적이 아니라, 본인이 고른 설정과 실제로 해 본 결과로 맞춥니다.</p></li>
<li><h3>결정은 본인이 합니다</h3><p>엔진은 이유와 함께 제안할 뿐입니다. 무엇을 배우고 어디로 갈지는 본인이 정합니다.</p></li>
<li><h3>확인한 만큼만 말합니다</h3><p>도움이 됐는지 확인하고, 확인하지 않은 효과는 약속하지 않습니다.</p></li>
</ol>
</div></section>
<section class="v13-biz" id="business" aria-labelledby="business-title" data-biz><span id="worlds" class="sr-only" aria-hidden="true"></span><div class="wrap"><div class="v13-biz-grid">
<div><p class="v13-label reveal">무엇을 하나</p>
<h2 class="v13-title reveal" id="business-title"><span>아틀라스로</span> <span class="dim">네 가지 일을 합니다</span></h2>
<ol class="v13-rows reveal">${줄들}</ol></div>
<div class="reveal"><div class="v13-stage">${틀들}</div></div>
</div></div></section>
<section class="v13-way" aria-labelledby="way-title"><div class="wrap">
<p class="v13-label reveal">어디로 가나</p>
<h2 class="v13-title reveal" id="way-title"><span>지금은 한국어 공부에서 이 엔진을 끝까지 완성하고</span> <span class="dim">강의와 광고, 유학 준비로 넓혀 가며</span> <span>누구에게나 확실히 도움이 되는 엔진을 지향합니다</span></h2>
<p class="v13-lead reveal">20대부터 60대까지, 게임을 하든 공부를 하든 상담을 받든 그 사람에게 맞는 도움을 받게 하는 것이 목표입니다.</p>
</div></section>
`;

let h = 공개본;
const 시작 = h.indexOf('<section class="cover" id="top">');
const 끝 = h.indexOf('<div class="section duo-band">');
if (시작 < 0 || 끝 < 0) throw new Error('공개본 구조가 바뀌었다');
h = h.slice(0, 시작) + 본문 + h.slice(끝);

// 입구: 회사 한 줄을 쪽 제목으로(메뉴 밖), 질문은 작은 안내로(스타일 쪽). 위 메뉴와 같은 작은 링크 셋은 뺀다.
const 옛줄 = /<nav class="gate-doors visit" aria-labelledby="visit-q" data-visit><p class="gate-kicker">.*?<\/p>/s;
if (!옛줄.test(h)) throw new Error('입구 줄을 못 찾음');
h = h.replace(옛줄, `<div class="gate-doors visit" data-visit><h1 class="gate-say">${한줄[1] ? `<span class="a">${한줄[0]}</span> <span class="b">${한줄[1]}</span>` : `<span class="b">${한줄[0]}</span>`}</h1><nav class="visit-nav" aria-labelledby="visit-q">`);
h = h.replace(/<div class="visit-more">.*?<\/div>\s*/s, '');
h = h.replace(/(<p class="visit-note">.*?<\/p>)<\/nav>/s, '$1</nav></div>');
// 시안에서는 방문을 세지 않는다(공개본도 synk.im 주소에서만 센다 — 표시까지 빼 둔다)
h = h.replace(' data-visit', '').replace(/ data-pick="[a-z]+"/g, '');
// 메뉴: 회사 소개 · 문의만 남기고 아틀라스 · 창업자 · 소식 · 플랫폼은 본문과 바닥에서 잇는다
h = h.replace(/<nav class="bar-nav" aria-label="주요 메뉴">.*?<\/nav>/s, '<nav class="bar-nav" aria-label="주요 메뉴"><a href="#top">회사 소개</a><a href="#contact">문의</a></nav>');
// 쪽 안 주소 · 옮긴 구역
// 창업자는 찾아온 사람에게만: 위 메뉴 · 휴대폰 메뉴에서 빼고 바닥 링크만 둔다(11-09 유호님)
h = h.replace(/<a href="\/founder\/">창업자<span aria-hidden="true">→<\/span><\/a>/, '');
h = h.replaceAll('href="/#', 'href="#').replace('<a href="#business">사업 소개<span aria-hidden="true">→</span></a>', '<a href="#top">회사 소개<span aria-hidden="true">→</span></a>').replace('href="#drama"', 'href="/lab/#drama"').replace('href="#learner"', 'href="/lab/"');
// 스타일 · 스크립트
h = h.replace(/<link rel="stylesheet" href="\/assets\/v10\/(drama|learner)\.css[^>]*>\s*/g, '');
h = h.replace(/<script type="module" src="\/assets\/v10\/(drama|learner|home-v12)\.js[^>]*><\/script>\s*/g, '');
h = h.replace(/<script type="module" src="\/social-conversion\.js[^>]*><\/script>\s*/g, '');
h = h.replace('</head>', '<meta name="robots" content="noindex"><link rel="stylesheet" href="home-v13.css">\n</head>');
h = h.replace('</body>', '<script type="module" src="home-v13.js"></script>\n</body>');

writeFileSync(join(여기, 출력), h);
console.log(출력, Buffer.byteLength(h), '바이트');
