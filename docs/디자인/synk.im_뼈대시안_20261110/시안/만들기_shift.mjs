// synk.im 뼈대 시안 — SHIFT 쪽(2026-11-10). 만들기.mjs가 부른다.
// 공개본 /shift/에서 실물(예약표 · 강사 칸 · 50분 수업 예시 · 문의 양식 주소 · 비용 줄)을 그대로 꺼내 새 틀에 놓는다. 제공 범위 · 값은 공개본에 적힌 것만 쓴다.
// 짜임: 첫 화면(새 제목 + 큰 예약표) → 강의 방식(50분 수업 예시) → 하는 일(한 줄씩 + 펼치기) → 강사 → 비용 → 맺음 → 묻기 → 알아 두실 것.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function SHIFT({ 받기, 사이, 바꿈, 화살, 예약표글, 공통, 여기 }) {
  const 공개 = await 받기('/shift/');
  const 머리 = 공개.slice(0, 공개.indexOf('<section class="sv-hero"'));
  const 아래 = 공개.slice(공개.indexOf('<section class="section" id="contact"'));
  const 판 = 예약표글(사이(공개, '<figure class="sv-board"', '</div></div></section><div class="sv-figures">'));
  const 양식 = [...사이(공개, '<ul class="sv-qlinks', '</ul>').matchAll(/href="([^"]+)"/g)].map(m => m[1]); // 특강 · 진로 강의 · 강사 추천 · 자동화와 그 밖
  if (양식.length !== 4) throw new Error('문의 양식 주소가 넷이 아니다');
  const 칸이름 = { '이런 곳에 맞습니다': '누구에게', '받는 것': '남는 것', '먼저 정하는 것': '미리 정할 것', '진행 순서': '순서' };
  const 사실 = n => {
    const li = 사이(공개, `id="service-${n}"`, n < 4 ? `id="service-${n + 1}"` : '</ol>\n</div></section>');
    let dl = li.slice(li.indexOf('<dl class="sv-facts">'), li.indexOf('</dl>') + 5);
    for (const [옛, 새] of Object.entries(칸이름)) dl = dl.replace(`<dt>${옛}</dt>`, `<dt>${새}</dt>`);
    const 예 = (li.match(/<p class="sv-ex"><span>예를 들면<\/span>([^<]*)<\/p>/) || [])[1] || '';
    return dl.replace('강사 증거 카드', '강사 소개서').replace('증거 카드와 샘플', '소개서와 샘플').replace('</dl>', `<div><dt>예</dt><dd>${예.trim()}</dd></div></dl>`);
  };
  // 첫 화면의 「예를 들면」 — 공개본 서비스마다 적힌 예시 그대로(맹검 2회: 예약표가 콘텐츠 · SNS 일 위주라 「우리 같은 사무직 회사 일도 되나」가 안 풀린다)
  const 예글 = n => { const li = 사이(공개, `id="service-${n}"`, n < 4 ? `id="service-${n + 1}"` : '</ol>\n</div></section>'); const m = li.match(/<p class="sv-ex"><span>예를 들면<\/span>([^<]*)<\/p>/); if (!m) throw new Error(`서비스 ${n}의 예시를 못 읽음`); return m[1].trim(); };
  const 시간줄 = 사이(공개, '<ol class="lc-time">', '</ol>') + '</ol>';
  const 단계 = [...시간줄.matchAll(/<li><span class="mono">(\d+)<span class="ko">분<\/span><\/span><span>([^<]*?) — ([^<]*)<\/span><\/li>/g)].map(m => ({ 분: +m[1], 이름: m[2], 글: m[3] }));
  if (단계.length !== 4) throw new Error('50분 수업 예시 네 칸을 못 읽음');
  const 예시글 = (공개.match(/href="(https:\/\/m\.blog\.naver\.com\/shiftclass\/\d+)" target="_blank" rel="noopener">예시 글 전체 보기/) || [])[1];
  const 강사 = 사이(공개, '<div class="lc-card lc-person">', '<div class="lc-card lc-rec">');
  const 사진 = 강사.slice(강사.indexOf('<div class="lc-photo">'), 강사.indexOf('<div class="lc-person-body">'));
  const 이력 = 강사.slice(강사.indexOf('<ul class="lc-hist">'), 강사.indexOf('</ul>') + 5);
  const 근거 = 강사.slice(강사.indexOf('<dl class="lc-ev">'), 강사.indexOf('</dl>') + 5);
  const 흐름 = [...사이(공개, '<ol class="sv-flow reveal">', '</ol>').matchAll(/<b>([^<]*)<\/b><p>([^<]*)<\/p>/g)].map(m => ({ 이름: m[1], 글: m[2] }));
  const 값 = [...사이(공개, '<ol class="sv-price reveal">', '</ol>').matchAll(/<h3 class="sv-h4">([^<]*)<\/h3><p>([^<]*)<\/p>/g)].map(m => ({ 이름: m[1], 글: m[2] }));
  if (흐름.length !== 4 || 값.length !== 3) throw new Error('자동화 흐름 · 비용 줄 수가 다르다');

  const 일 = [
    { n: 1, 이름: 'AI 특강', 줄: '직원이 자기 업무로 결과물 하나를 만들어 가는 실습 특강입니다.', 단추: '이 강의로 문의', 주소: 양식[0] },
    { n: 2, 이름: '학교 AI 진로 강의', 줄: 'AI가 내 관심 분야의 일을 어떻게 바꾸는지 보고, 지금 무엇을 준비할지 한 장으로 쓰는 수업입니다.', 단추: '이 강의로 문의', 주소: 양식[1] },
    { n: 3, 이름: '강사 찾아 드리기', 줄: '목표와 청중을 듣고 맞는 강사를 찾아 드립니다. 누가 오는지는 계약 전에 알려 드립니다.', 단추: '강사 추천 문의', 주소: 양식[2] },
    { n: 4, 이름: 'AI 업무 자동화', 줄: '매주 되풀이하는 일 하나를 자동으로 돌립니다. 사람이 확인할 자리와, 멈추면 알리는 길까지 같이 만듭니다.', 단추: '자동화 문의', 주소: 양식[3] },
  ];

  const 본문 = `<section class="k-sec k-night k-sv-hero" id="top" aria-labelledby="p-title"><span id="shift" class="sr-only" aria-hidden="true"></span><span id="worlds" class="sr-only" aria-hidden="true"></span><div class="wrap">
<p class="k-rule"><span>AI 강의와 업무 자동화</span></p>
<div class="k-sv-top"><h1 class="k-claim k-spec" id="p-title"><span class="dim">AI 강의가 끝나면,</span> <span>결과물 하나가 남습니다</span></h1>
<p class="k-sv-now" aria-hidden="true"><span>서울 지금</span><b data-clock-mirror></b></p></div>
<div class="k-sv-grid">
<div class="k-sv-copy"><p class="k-lead">도구 이름을 훑는 강의가 아닙니다. 듣는 사람이 자기 일에서 결과물 하나를 직접 만들고, 혼자 다시 하는 법까지 가져갑니다. 원하면 강의 뒤에 회사의 반복 업무 하나를 자동으로 돌려 드립니다.</p>
<p class="k-acts"><a class="k-btn" href="#services">강의 의뢰 ${화살('↓')}</a><a class="k-btn is-line" href="#process">자동화 의뢰 ${화살('↓')}</a></p>
<ul class="k-sv-figs"><li class="is-by">이 예약표를 만들고 돌리는 사람이 직접 강의합니다.</li><li><a href="#how">50분 수업 예시 — <b>다시 쓸 요청문 한 줄</b>, <b>AI 답을 확인하는 순서 세 가지</b>가 남습니다</a></li><li class="is-ex"><b>AI 특강</b><span>예를 들면 ${예글(1)}</span></li><li class="is-ex"><b>업무 자동화</b><span>예를 들면 ${예글(4)}</span></li></ul></div>
${판.replace('<p class="sv-board-foot">', '<p class="k-sv-sum"><b>30개 넘는 일</b>이 사람 없이 제시간에 돕니다. 공개 전에는 <b>20가지 넘는 검사</b>가 실수를 막습니다.</p><p class="sv-board-foot">')}
</div>
</div></section>
<section class="k-sec k-sv-how" id="how" aria-labelledby="how-title"><div class="wrap">
<p class="k-rule"><span>강의 방식</span></p>
<div class="k-two"><h2 class="k-title" id="how-title">강의는 이렇게 합니다</h2>
<ul class="k-keep"><li><h3>듣는 사람의 일에서 시작합니다</h3><p>학생은 관심 분야에서, 직원은 실제 업무에서 실습 과제를 고릅니다.</p></li><li><h3>각자 하나를 만들어 갑니다</h3><p>처음 쓰는 사람은 자기 결과물 하나를, 이미 쓰는 사람은 다시 쓸 요청 · 확인 · 수정 순서를 가져갑니다.</p></li><li><h3>확인하고 고치는 법까지</h3><p>AI가 낸 답을 그대로 믿지 않고, 어디를 확인하고 어떻게 고칠지 연습합니다.</p></li></ul></div>
<figure class="k-hour" aria-labelledby="hour-title"><figcaption id="hour-title"><b>50분 수업 예시</b><span>교사 연수나 직장인 교육처럼, 어른이 각자 휴대폰이나 노트북으로 AI를 쓸 수 있는 자리</span></figcaption>
<ol class="k-hour-bar">${단계.map(s => `<li style="--m:${s.분}"><span class="k-n">${s.분}분</span><b>${s.이름}</b><span>${s.글}</span></li>`).join('')}</ol>
<p class="k-hour-out"><b>가져가는 것</b><span>다시 쓸 요청문 한 줄과, AI 답을 확인하는 순서 세 가지</span>${예시글 ? `<a class="k-link" href="${예시글}" target="_blank" rel="noopener">예시 글 전체 보기 ${화살('↗')}</a>` : ''}</p></figure>
</div></section>
<section class="k-sec k-sv-svc" id="services" aria-labelledby="services-title"><span id="lectures" class="sr-only" aria-hidden="true"></span><div class="wrap">
<p class="k-rule"><span>하는 일</span></p>
<div class="k-two"><h2 class="k-title" id="services-title"><span>먼저 가르치고,</span> <span>원하면 만들어 드립니다</span></h2>
<p class="k-lead">강의가 먼저입니다. 맞는 강사를 찾아 드리는 일과, 강의를 들은 회사의 반복 업무 하나를 자동으로 돌리는 일이 뒤를 잇습니다.</p></div>
<ol class="k-svc">${일.map(s => `<li id="service-${s.n}"${s.n === 4 ? '><span id="process" class="sr-only" aria-hidden="true"></span' : ''}><h3>${s.이름}</h3><p class="k-body">${s.줄}</p><a class="k-btn is-line" href="${s.주소}" target="_blank" rel="noopener">${s.단추} ${화살('↗')}</a>
<details><summary><span>누구에게 · 남는 것 · 순서</span></summary>${사실(s.n)}${s.n === 4 ? `<ol class="k-flow">${흐름.map(f => `<li><b>${f.이름}</b><p>${f.글}</p></li>`).join('')}</ol>` : ''}</details></li>`).join('')}</ol>
</div></section>
<section class="k-sec k-sv-teacher" id="teacher" aria-labelledby="teacher-title"><div class="wrap">
<p class="k-rule"><span>강사</span></p>
<h2 class="k-title" id="teacher-title"><span>위 예약표를 만들고 돌리는 사람이</span> <span>직접 강의합니다</span></h2>
<div class="k-teacher"><div class="k-teacher-me">${사진}
<div><h3 class="k-teacher-name"><b>양유호</b> <span>SYNK 창업자</span></h3>
<p class="k-body">강의에서는 수강하는 회사의 실제 업무 하나를 골라, 같은 방법으로 결과물 하나를 함께 만듭니다. 일정과 지역은 협의합니다.</p>
${이력}
${근거.replace('<dt>본인이 만든 결과</dt>', '<dt>직접 만든 것</dt>').replace('<dt>공개할 수 있는 샘플</dt>', '<dt>공개한 글</dt>').replace('href="/#platform"', 'href="/account/platform.html#home"')}
<p><a class="k-link" href="/founder/#career">창업자 소개 전체 보기 ${화살()}</a></p></div></div>
<div class="k-teacher-other"><h3>다른 강사가 필요하면</h3><p class="k-body">목표와 청중을 듣고 맞는 AI 강사나 AI 진로 강사를 찾아 제안합니다. 계약 전에 그 강사의 이력과 샘플을 강사 소개서로 먼저 보여 드립니다.</p>
<p><a class="k-btn is-line" href="${양식[2]}" target="_blank" rel="noopener">강사 추천 문의 ${화살('↗')}</a></p></div></div>
</div></section>
<section class="k-sec k-sv-price" id="pricing" aria-labelledby="pricing-title"><span id="shift-contract" class="sr-only" aria-hidden="true"></span><div class="wrap">
<p class="k-rule"><span>비용</span></p>
<div class="k-two"><div><h2 class="k-title" id="pricing-title"><span>요금표 대신,</span> <span>범위를 먼저 정합니다</span></h2>
<p class="k-lead">의뢰마다 대상과 범위를 정한 뒤 견적을 드리고, 무엇을 기준으로 정하는지는 미리 알려 드립니다.</p></div>
<ul class="k-keep">${값.map(v => `<li><h3>${v.이름}</h3><p>${v.글}</p></li>`).join('')}</ul></div>
</div></section>
<section class="sv-ask k-night" id="ask" aria-labelledby="ask-title"><div class="wrap">
<p class="k-rule"><span>의뢰</span></p>
<div class="sv-ask-in">
<div><h2 class="k-title" id="ask-title"><span>되풀이하는 일 하나를</span> <span>알려 주세요</span></h2><p>강의 · 강사 · 자동화 모두 문의 양식 하나로 받습니다. 진행 여부와 일정 · 견적을 이메일로 답드립니다. 컨설팅 · 조사 · 브랜딩은 의뢰 때 상의합니다. 학생이나 직원의 개인 자료는 적지 말아 주세요.</p><p class="k-sv-askmail"><a href="mailto:hello@synk.im">hello@synk.im</a><a href="https://synk.im/privacy/#website-questions">문의할 때의 개인정보 처리 ${화살()}</a></p></div>
${사이(공개, '<ul class="sv-qlinks', '</ul>').replace(' reveal"', '"')}</ul>
</div></div></section>
`;
  const 알아둘것 = `<aside class="k-tail" aria-labelledby="know-title"><div class="wrap"><p class="k-rule"><span id="know-title">알아 두실 것</span></p>
<ul><li>50분 수업 예시는 SYNK SHIFT가 공개한 예시입니다. 실제 수업은 청중과 시간, 기기에 맞춰 바꿉니다.</li>
<li>학교 수업에서는 학생이 쓸 기기와 서비스, 서비스마다 다른 나이 조건, 학생 자료 취급을 학교와 먼저 정합니다.</li>
<li>문의 단추를 누르면 새 창에서 Google Forms가 유형과 내용이 미리 적힌 채로 열립니다. 답장 받을 이메일과 동의를 채워 보내 주셔야 접수됩니다.</li>
<li>줄어든 비용은 자동화 전후를 같은 조건에서 재고, 무엇과 비교했는지 함께 말씀드립니다. 자동화에 이어 둔 외부 서비스의 이용료는 따로 들 수 있습니다.</li></ul></div></aside>
`;
  // 묻기 구역의 메일 · 양식 줄은 바로 위 「의뢰」와 겹친다 — SHIFT에서는 의뢰 띠로 올리고 질문창만 남긴다.
  let h = 머리 + 본문 + 바꿈(아래, /<div class="ask-side">[\s\S]*?<\/div><p class="ask-note"[^>]*>[^<]*<\/p><\/div>/, '');
  h = 공통(h);
  h = 바꿈(h, '<footer class="foot" id="company-info">', 알아둘것 + '<footer class="foot" id="company-info">');
  h = h.replace(/<nav class="bar-nav" aria-label="주요 메뉴">.*?<\/nav>/s, '<nav class="bar-nav" aria-label="주요 메뉴"><a href="#how">강의 방식</a><a href="#services">하는 일</a><a href="#teacher">강사</a><a href="#pricing">비용</a><a href="#contact">문의</a></nav>');
  h = h.replace(/<title>[^<]*<\/title>/, '<title>SYNK SHIFT — AI 강의가 끝나면, 결과물 하나가 남습니다 (뼈대 시안)</title>');
  writeFileSync(join(여기, 'shift.html'), h.replace('<body ', '<body data-k="shift" '));
  console.log('shift.html', Buffer.byteLength(h), '바이트');
}
