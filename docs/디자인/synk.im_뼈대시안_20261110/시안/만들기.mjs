#!/usr/bin/env node
// synk.im 뼈대 시안 1단계 만들기(2026-11-10). 공개본 HTML을 받아 구역을 갈아 끼운다.
// 실물(입구 그림 · 30일 체험 · 네 무대의 영상 · 예약표 · 지도 · 질문창 · 내려받기)은 공개본 것을 그대로 싣고, 틀과 글만 바꾼다. 글은 ../../synk.im_전체판단_20261110/리라이팅.md의 「제안」.
//   node docs/디자인/synk.im_뼈대시안_20261110/시안/만들기.mjs            → home-ga.html · home-na.html · shift.html
//   회사 한 줄만 바꿔 보기: --한줄 "윗줄|아랫줄" --꼬리 b   → home-ga-b.html · home-na-b.html
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 인자 = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = 인자.indexOf(이름); return i >= 0 ? 인자[i + 1] : 기본; };
const 한줄 = 값('--한줄', '사람마다 막히는 곳이 다릅니다|그 한 곳부터 풀어 주는 AI를 만듭니다').split('|');
const 꼬리 = 값('--꼬리', '') ? '-' + 값('--꼬리', '') : '';
const 받기 = async 경로 => (await fetch('https://synk.im' + 경로)).text();
const 사이 = (글, 앞, 뒤) => { const a = 글.indexOf(앞), b = 글.indexOf(뒤, a + 1); if (a < 0 || b < 0) throw new Error(`못 찾음: ${앞} … ${뒤}`); return 글.slice(a, b); };
const 바꿈 = (글, 옛, 새) => { if (!(옛 instanceof RegExp ? 옛.test(글) : 글.includes(옛))) throw new Error(`바꿀 곳 없음: ${옛}`); return 글.replace(옛, 새); };
const 화살 = (글 = '→') => `<span class="arr" aria-hidden="true">${글}</span>`;
const 제목줄 = 줄 => 줄.length > 1 ? `<span class="dim">${줄[0]}</span> <span>${줄[1]}</span>` : `<span>${줄[0]}</span>`;

// 예약표 줄 이름: 안에서 부르는 작업 이름 → 손님이 알아듣는 말(리라이팅 SHIFT)
const 예약표글 = 글 => 글
  .replaceAll('인기 공개 콘텐츠 조사 · 제작 가이드', '잘된 공개 콘텐츠 조사')
  .replaceAll('고른 기획을 최종본까지 제작', '오늘 올릴 영상 제작')
  .replaceAll('게시 성과 판정', '올린 게시물 성과 점검')
  .replaceAll('수요 스캔 · 다음 기획 후보', '내일 만들 주제 찾기')
  .replaceAll('저장 공간 지킴이', '저장 공간 정리')
  .replaceAll('SYNK가 자기 회사에 돌리는 자동화 · 오늘', 'SYNK는 지금도 이렇게 돌아갑니다 · 오늘의 예약표');

function 공통(h, 덧붙일머리 = '') {
  // 시안에서는 방문을 세지 않는다. 메뉴의 창업자 줄은 뺀다(11-09 — 바닥 링크만 남는다).
  h = h.replace(' data-visit', '').replace(/ data-pick="[a-z]+"/g, '');
  h = h.replace('<a href="/founder/">창업자</a>', '').replace(/<a href="\/founder\/">창업자<span aria-hidden="true">→<\/span><\/a>/, '');
  h = h.replace(/<script type="module" src="\/social-conversion\.js[^>]*><\/script>\s*/g, '');
  // 모든 쪽 공통 글(리라이팅 「모든 쪽 공통」)
  h = h.replace('<span>궁금한 것을 물어보세요</span>', '<span>무엇이든 물어보세요</span>');
  h = h.replace('공개한 안내 안에서 바로 답합니다. 상담이나 협업 제안은 담당자에게 보내 주세요.', '공개된 내용은 여기서 바로 답합니다. 상담과 제안은 메일로 받습니다.');
  h = h.replace(/<p class="label"><span class="en">Ask SYNK<\/span><\/p>/, '<p class="k-rule"><span>묻기</span></p>');
  h = h.replace('SYNK는 개인화 엔진 아틀라스와 SYNK 플랫폼을 만드는 회사입니다. 한국어 교육에서 시작해 기업 서비스와 영상 제작, 유학·취업 준비에도 같은 엔진을 씁니다.', 'SYNK는 한 사람에게 맞추는 엔진, 아틀라스를 만듭니다. 한국어 교육에서 시작했습니다.');
  h = h.replace('</head>', `<meta name="robots" content="noindex"><link rel="stylesheet" href="skeleton.css">${덧붙일머리}\n</head>`);
  h = h.replace('</body>', '<script type="module" src="skeleton.js"></script>\n</body>');
  return h;
}

// ───────── 홈
async function 홈(판) {
  const 공개 = await 받기('/');
  const 머리 = 공개.slice(0, 공개.indexOf('<section class="gate"'));
  let 입구 = 사이(공개, '<section class="gate"', '<section class="cover" id="top">');
  const 사업 = 사이(공개, '<section class="section" id="business"', '<section class="lw" id="learner"');
  let 증거 = 사이(공개, '<section class="lw" id="learner"', '<section class="section" id="atlas"');
  const 소식 = 사이(공개, '<ol class="news">', '</section>');
  const 플랫폼 = 사이(공개, '<section class="duo-col duo-pf', '<section class="section" id="contact"');
  const 내려받기 = 플랫폼.slice(플랫폼.indexOf('<div class="btns platform-downloads"'), 플랫폼.indexOf('<div class="btns pf-open">'));
  const 맥안내 = 사이(플랫폼, '<details class="more"><summary>Mac 설치 방법', '</section>');
  const 아래 = 공개.slice(공개.indexOf('<section class="section" id="contact"'));

  // 입구 — 그림(하늘 · 처마 · 싱ㅋ · 견본선)은 그대로.
  if (판 === '가') {
    // 판 가: 지금 짜임 그대로, 한 줄만 새 문장
    입구 = 바꿈(입구, '<span>SYNK는 한국어 교육에서 시작한 개인화 기술 회사입니다.</span>', '<span>한 사람에게 맞추는 AI를 만듭니다. 한국어 교육에서 시작했습니다.</span>');
  } else {
    // 판 나: 문 넷 자리에 회사 문장 하나. 문은 아래 「네 가지 사업」 구역으로 내려간다.
    입구 = 바꿈(입구, /<nav class="gate-doors visit"[\s\S]*?<\/nav>/, `<div class="gate-doors k-gate-say">
<div><h1 class="k-gate-claim">${제목줄(한줄)}</h1>
<p class="k-gate-sub">한국어 교육에서 시작했습니다.</p></div>
<p class="k-gate-go"><a class="k-btn is-paper" href="#learner">지금 돌아가는 모습 보기 ${화살('↓')}</a></p>
</div>`);
  }

  // 회사 한 문장(판 가만 — 판 나는 입구가 말했다)
  const 회사글 = '한국어 학원에서 시작했습니다. 한 사람이 실제로 해 본 것을 읽고 다음 할 일을 고르는 엔진, 아틀라스를 만듭니다. 지금은 한국어 교육, 회사의 AI 수업, 광고 제작, 한국 유학 준비 네 곳에서 일합니다.';
  // 판 가의 쪽 주장은 입구 바로 아래에 견본선 사이로 놓이고, 곧바로 증거가 온다(주장과 증거 사이에 글 구역을 따로 두면 한 번 내린 자리에 실물이 안 보인다 — 맹검 1회)
  const 회사 = 판 === '가' ? `<section class="k-sec k-night k-co" id="top" aria-labelledby="co-title"><span id="hero-introduction" class="sr-only" aria-hidden="true"></span><div class="wrap">
<h1 class="k-claim k-spec" id="co-title">${제목줄(한줄)}</h1>
</div></section>
` : '<span id="top" class="sr-only" aria-hidden="true"></span><span id="hero-introduction" class="sr-only" aria-hidden="true"></span>';

  // 살아 있는 증거 — 공개본 #learner 무대 · 시간 줄 그대로. 머리만 새 틀로. 회사 설명은 증거 제목 오른쪽 받침 글, 알약 단추는 하나.
  const 증거머리 = `<div class="wrap lw-head k-proof-head">
<p class="k-rule"><span>지금 돌아가는 아틀라스 — SYNK WORLD</span></p>
<div class="k-proof-row"><h2 class="lw-title k-title" id="learner-title"><span>틀린 말은 1분 뒤에,</span> <span>맞힌 말은 <span class="nb">잊을 때쯤</span> 돌아옵니다</span></h2>
<div class="k-proof-side"><p class="k-body">${회사글}</p><div class="lw-go"><a class="k-btn is-line" href="/lab/#learner">한 문제 풀어 보기 ${화살()}</a><a class="k-link" href="/atlas/">아틀라스가 하는 일 보기 ${화살()}</a></div></div>
</div></div>
`;
  증거 = 바꿈(증거, /<div class="wrap lw-head">[\s\S]*?(?=<div class="lw-stage">)/, 증거머리);
  증거 = 바꿈(증거, /<b>고르지 않아도 됩니다\.<\/b>[^<]*/, '<b>고르지 않아도 됩니다.</b> 어제 한 것에 따라 오늘이 달라집니다.');
  증거 = 증거.replace('<section class="lw"', '<section class="lw k-night"');

  // 문 넷 — 무대(영상 · 예약표 · 지도)는 공개본 것 그대로, 손님으로 둘씩 묶는다.
  const 틀 = 이름 => { const 칸 = 사이(사업, `class="hs hs-${이름}"`, '<div class="hs-txt">'); return 예약표글(칸.slice(칸.indexOf('<a class="hs-frame'))); };
  const 문 = ({ 키, 이름, 줄, 지금 }) => `<li class="k-door hs hs-${키}" id="${키}" data-dur="${{ lab: 8, shift: 7, pulse: 12.3, path: 7 }[키]}">${키 === 'lab' ? '<span id="world" class="sr-only" aria-hidden="true"></span>' : ''}
${틀(키)}
<div class="k-door-txt"><p class="k-brand"><i class="dot dot-${키}" aria-hidden="true"></i>SYNK ${이름}</p>
<h3><span>${줄[0]}</span> <span>${줄[1]}</span></h3>
<p class="k-nowline"><b>지금</b>${지금}</p>
<a class="k-link" href="/${키}/">${이름} 보기 ${화살()}</a></div></li>`;
  const 문들 = {
    lab: { 키: 'lab', 이름: 'LAB', 줄: ['말해야 다음 장면이', '열리는 한국어'], 지금: 'SYNK WORLD — TOPIK 연습과 한국어 게임' },
    path: { 키: 'path', 이름: 'PATH', 줄: ['한국에 오기 전에,', '먼저 해 봅니다'], 지금: '면접 연습과 서울 하루(무료)' },
    shift: { 키: 'shift', 이름: 'SHIFT', 줄: ['듣고 끝나는 강의 말고,', '결과물이 남는 AI 수업'], 지금: 'AI 특강과 학교 AI 진로 강의 의뢰' },
    pulse: { 키: 'pulse', 이름: 'PULSE', 줄: ['카메라 앞에서 10년,', '배우가 AI 모델을 연출합니다'], 지금: 'AI 모델 스물한 명 캐스팅북과 광고 의뢰' },
  };
  const 사업구역 = `<section class="k-sec k-doors" id="business" aria-labelledby="business-title"><span id="worlds" class="sr-only" aria-hidden="true"></span><div class="wrap">
<p class="k-rule"><span>네 가지 사업</span></p>
<h2 class="sr-only" id="business-title">배우는 사람에게도, 맡기는 회사에도</h2>
<div class="k-doors-grid" data-stages>
<div class="k-group"><p class="k-group-h" aria-hidden="true">배우는 사람에게도,</p><ol class="k-door-list">${문(문들.lab)}${문(문들.path)}</ol></div>
<div class="k-group"><p class="k-group-h" aria-hidden="true">맡기는 회사에도</p><ol class="k-door-list">${문(문들.shift)}${문(문들.pulse)}</ol></div>
</div>
<p class="k-doors-foot">한국어를 배우는 분은 LAB과 PATH로, 일을 맡기는 회사는 SHIFT와 PULSE로 오시면 됩니다.</p>
</div></section>
`;

  // 최근에 새로 연 것(크게) · 지키는 것 셋 · 플랫폼 한 줄
  const 소식구역 = `<section class="k-sec k-now" aria-labelledby="now-title"><div class="wrap">
<p class="k-rule"><span>소식</span></p>
<div class="k-now-grid">
<div class="k-news" id="now"><h2 class="k-title" id="now-title">최근에 새로 연 것</h2>
${소식.replace('href="#drama"', 'href="/lab/#drama"').replace('aria-hidden="true">↑</span>', 'aria-hidden="true">→</span>')}
<div class="k-pf" id="platform"><span id="platform-get" class="sr-only" aria-hidden="true"></span><strong>SYNK ID 하나로 전부 씁니다</strong>
<a class="k-link" href="/account/platform.html#home">웹에서 열기 ${화살()}</a>
<details class="k-pf-get"><summary class="k-link">PC 앱 받기 ${화살('↓')}</summary><div class="k-pf-body">${내려받기}
<p class="k-small">미리보기판입니다(Windows 64비트 · macOS 13 이상). 설치 중 보안 확인 창이 뜨면 다운로드 뒤 나오는 안내대로 여시면 됩니다.</p>
${맥안내}</div></details></div>
</div>
<div class="k-keep-col" id="atlas"><h2 class="k-keep-h">지키는 것 셋</h2>
<ul class="k-keep">
<li><h3>나이로 짐작하지 않습니다</h3><p>나이 · 성별 · 국적으로 넘겨짚지 않습니다. 본인이 고른 것과 실제로 해 본 것만 봅니다.</p></li>
<li><h3>내가 한 것과 AI의 짐작을 섞지 않습니다</h3><p>직접 쓴 답과 한 행동은 그대로 두고, AI가 짐작한 것은 따로 표시합니다. 틀렸으면 본인이 고칩니다.</p></li>
<li><h3>되는 것만 된다고 말합니다</h3><p>지금 되는 것과 준비하는 것을 나눠 적습니다. 재 보지 않은 효과는 말하지 않습니다.</p></li>
</ul><p class="k-keep-go"><a class="k-link" href="/atlas/">아틀라스 쪽에서 더 보기 ${화살()}</a></p></div>
</div>
</div></section>
`;

  let h = 머리 + 입구 + 회사 + 증거 + 사업구역 + 소식구역 + 아래;
  h = 공통(h);
  h = h.replace('<title>SYNK — 쓸수록 나를 아는 AI를 만듭니다</title>', '<title>SYNK — 한 사람에게 맞추는 AI를 만듭니다 (뼈대 시안)</title>');
  h = h.replace(/<nav class="bar-nav" aria-label="주요 메뉴">.*?<\/nav>/s, '<nav class="bar-nav" aria-label="주요 메뉴"><a href="#top">회사 소개</a><a href="/atlas/">아틀라스</a><a href="#business">사업</a><a href="#now">소식</a><a href="#contact">문의</a></nav>');
  h = h.replaceAll('href="/#', 'href="#').replace('href="#drama"', 'href="/lab/#drama"');
  // 홈에서 뺀 구역의 스타일 · 스크립트. 네 무대의 상영은 skeleton.js가 맡는다(home-v12.js는 네 칸이 옆으로 나란한 짜임에 맞춘 것).
  h = h.replace(/<link rel="stylesheet" href="\/assets\/v10\/drama\.css[^>]*>\s*/g, '').replace(/<script type="module" src="\/assets\/v10\/(drama|home-v12)\.js[^>]*><\/script>\s*/g, '');
  // 홈에는 「다음에 여는 것」 · 「알아 두실 것」 묶음이 없다(밝힐 상태 · 면책이 없다). 판 나는 입구에서 빠진 방문 집계 안내만 바닥 줄로 옮긴다.
  if (판 === '나') h = 바꿈(h, '<div class="foot-bottom">', '<div class="foot-bottom"><span>방문 목적과 경로를 익명으로 집계합니다. <a href="/privacy/#visitor-stats" style="color:inherit">자세히</a></span>');
  const 이름 = `home-${판 === '가' ? 'ga' : 'na'}${꼬리}.html`;
  writeFileSync(join(여기, 이름), h.replace('<body ', `<body data-k="home-${판 === '가' ? 'ga' : 'na'}" `));
  console.log(이름, Buffer.byteLength(h), '바이트');
}

await 홈('가');
await 홈('나');
if (!꼬리) { const { SHIFT } = await import('./만들기_shift.mjs').catch(() => ({})); if (SHIFT) await SHIFT({ 받기, 사이, 바꿈, 화살, 예약표글, 공통, 여기 }); }
