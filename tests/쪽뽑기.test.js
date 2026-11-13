'use strict';

// 쪽 뽑기 — 남의 HTML에서 제목 · 설명 · 제품(값 · 별점 · 후기 글) · 본문만 뽑는지, 깨진 쪽 · 일부러 꼰 쪽에서도 멈추지 않고 제때 끝나는지.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { 뽑기, 꼬리표읽기, 문자풀기, 다듬기, 한계 } = require('../tools/lib/쪽뽑기.js');

const 제품쪽 = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>오미톡 오미자 스파클링 250ml | 문경상회</title>
<meta name="description" content="문경 오미자로 만든 무설탕 스파클링. 한 캔 2,900원.">
<meta property="og:site_name" content="문경상회">
<meta property="og:image" content="https://shop.example.com/img/omi.jpg">
<meta name="theme-color" content="#c2185b">
<link rel="canonical" href="https://shop.example.com/p/omitok">
<style>.hidden-style-text { color: red }</style>
<script>var 숨은스크립트글 = "<p>이건 본문이 아니다</p>";</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"Product","name":"오미톡 오미자 스파클링","brand":{"@type":"Brand","name":"문경상회"},"description":"다섯 가지 맛이 나는 오미자 탄산음료",
  "offers":{"@type":"Offer","price":"2900","priceCurrency":"KRW","availability":"https://schema.org/InStock"},
  "aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"132"},
  "review":[{"@type":"Review","author":{"@type":"Person","name":"홍길동"},"datePublished":"2026-10-01","reviewRating":{"ratingValue":"5"},"reviewBody":"달지 않아서 운동 끝나고 마시기 좋아요"},
            {"@type":"Review","author":"김아무개","reviewBody":"색이 예뻐서 손님상에 올렸어요"}]},
 {"@type":"VideoObject","name":"오미톡 15초","description":"여름 광고","duration":"PT15S","uploadDate":"2026-06-01","author":{"name":"문경상회 채널"}}
]}
</script>
</head>
<body>
<nav><a href="/">홈</a> <a href="/cart">장바구니메뉴</a></nav>
<main>
<h1>오미톡 <em>오미자</em> 스파클링</h1>
<p>문경 오미자를 그대로 &amp; 설탕 없이.</p>
<h2>이런 분께</h2>
<ul><li>단 음료가 부담스러운 분</li><li>색이 고운 음료를 찾는 분</li></ul>
<img src="/a.jpg" alt="오미자 열매와 캔이 놓인 탁자"><img src="/b.jpg" alt="b">
<table><tr><th>용량</th><td>250ml</td></tr></table>
<svg><text>그림 안 글자</text></svg>
<noscript>스크립트를 켜 주세요</noscript>
</main>
<footer>사업자등록번호 바닥글</footer>
</body></html>`;

test('제품 쪽에서 제목 · 설명 · 제품 사실 · 후기 글 · 머리글 · 본문을 뽑는다', () => {
  const r = 뽑기(제품쪽);
  assert.equal(r.제목, '오미톡 오미자 스파클링 250ml | 문경상회');
  assert.equal(r.설명, '문경 오미자로 만든 무설탕 스파클링. 한 캔 2,900원.');
  assert.deepEqual([r.사이트, r.정본, r.언어, r.색, r.대표그림], ['문경상회', 'https://shop.example.com/p/omitok', 'ko', '#c2185b', 'https://shop.example.com/img/omi.jpg']);
  assert.equal(r.제품.length, 1);
  const 제품 = r.제품[0];
  assert.deepEqual([제품.이름, 제품.브랜드, 제품.값, 제품.통화, 제품.재고, 제품.별점, 제품.후기수], ['오미톡 오미자 스파클링', '문경상회', '2900', 'KRW', 'InStock', '4.8', '132']);
  assert.deepEqual(제품.후기, [{ 글: '달지 않아서 운동 끝나고 마시기 좋아요', 별점: '5' }, { 글: '색이 예뻐서 손님상에 올렸어요' }]);
  assert.deepEqual(r.영상, [{ 이름: '오미톡 15초', 설명: '여름 광고', 길이: 'PT15S', 올린날: '2026-06-01', 올린이: '문경상회 채널' }]);
  assert.deepEqual(r.머리글, [{ 단계: 'h1', 글: '오미톡 오미자 스파클링' }, { 단계: 'h2', 글: '이런 분께' }]);
  assert.match(r.본문, /문경 오미자를 그대로 & 설탕 없이\./);
  assert.match(r.본문, /단 음료가 부담스러운 분\n색이 고운 음료를 찾는 분/);
  assert.match(r.본문, /\[그림: 오미자 열매와 캔이 놓인 탁자\]/);
  assert.match(r.본문, /용량 250ml/);
  assert.equal(r.그림수, 2);
  assert.equal(r.본문잘림, false);
});

test('후기를 쓴 사람 이름 · 날짜는 옮기지 않고, 스크립트 · 스타일 · 메뉴 · 바닥글 · 그림 안 글자는 본문에 넣지 않는다', () => {
  const r = 뽑기(제품쪽);
  const 전부 = JSON.stringify(r);
  for (const 없어야 of ['홍길동', '김아무개', '2026-10-01']) assert.equal(전부.includes(없어야), false, 없어야);
  for (const 없어야 of ['숨은스크립트글', '이건 본문이 아니다', 'hidden-style-text', '장바구니메뉴', '바닥글', '그림 안 글자', '스크립트를 켜 주세요', 'schema.org']) assert.equal(r.본문.includes(없어야), false, 없어야);
});

test('문자 풀기 · 다듬기 — 보이지 않는 글자와 제어 문자는 지운다', () => {
  assert.equal(문자풀기('A &amp; B &lt;b&gt; &#44032; &#xAC00; &nbsp;끝 &unknown; &#0; &#xD800;'), 'A & B <b> 가 가  끝 &unknown;    ');
  const 숨김 = [0x200b, 0x200e, 0x202e, 0x2028, 0x2029, 0xfeff, 0x0007, 0x001b].map((코드) => String.fromCharCode(코드)).join('');
  assert.equal(다듬기(`가${숨김}나   다\n\n\n\n라 `), '가나 다\n라');
  assert.equal(다듬기(`  한\t줄 \n 로 `, false), '한 줄 로');
});

test('깨진 쪽 — 닫히지 않은 꼬리표 · 따옴표 · 제목 · 주석이 와도 던지지 않고 읽을 수 있는 데까지 읽는다', () => {
  assert.equal(뽑기('<title>닫히지 않은 제목<p>본문은 살아 있다</p>').본문, '본문은 살아 있다');
  assert.equal(뽑기('<title>닫히지 않은 제목<p>본문은 살아 있다</p>').제목, '닫히지 않은 제목');
  assert.equal(뽑기('<p>앞</p><script>끝나지 않는 스크립트 <p>뒤</p>').본문, '앞');
  assert.equal(뽑기('<p>앞</p><!-- 끝나지 않는 주석 <p>뒤</p>').본문, '앞');
  assert.equal(뽑기('<p title="닫히지 않은 따옴표>글</p>').본문, '');
  assert.equal(뽑기('3 < 5 이고 a<b 다').본문, '3 < 5 이고 a');
  assert.equal(뽑기('<svg/><p>스스로 닫힌 그림 뒤</p>').본문, '스스로 닫힌 그림 뒤');
  assert.equal(뽑기('<nav>메뉴<main><p>닫히지 않은 메뉴 뒤 본문</p></main>').본문, '닫히지 않은 메뉴 뒤 본문');
  assert.equal(뽑기('<script type="application/ld+json">{깨진 JSON</script><p>글</p>').제품.length, 0);
  for (const 값 of [undefined, null, 42, {}, '']) assert.deepEqual([뽑기(값).제목, 뽑기(값).본문], ['', '']);
  assert.equal(꼬리표읽기('<1abc>', 0), null);
  assert.equal(꼬리표읽기('< p>', 0), null);
  assert.deepEqual(꼬리표읽기('<A HREF=x.html  Title = "가 나" disabled>', 0).속성, { href: 'x.html', title: '가 나', disabled: '' });
});

test('한계 — 본문 2만 자, 후기 열두 줄, 제품 다섯, 속성 마흔, 메타 이백', () => {
  const 긴 = 뽑기(`<p>${'가나다라마 '.repeat(20000)}</p>`);
  assert.equal(긴.본문.length, 한계.본문);
  assert.equal(긴.본문잘림, true);
  const 후기들 = Array.from({ length: 50 }, (_, i) => ({ reviewBody: `후기 ${i} ${'길'.repeat(500)}` }));
  const 제품들 = Array.from({ length: 9 }, (_, i) => ({ '@type': 'Product', name: `제품 ${i}`, review: 후기들 }));
  const r = 뽑기(`<script type="application/ld+json">${JSON.stringify(제품들)}</script>`);
  assert.equal(r.제품.length, 한계.제품수);
  assert.equal(r.제품[0].후기.length, 한계.후기수);
  assert.equal(r.제품[0].후기[0].글.length, 한계.후기글);
  const 메타 = 뽑기(Array.from({ length: 500 }, (_, i) => `<meta name="k${i}" content="v">`).join(''));
  assert.equal(Object.keys(메타.메타).length, 한계.메타수);
  // 같은 이름이 또 오면 처음 것을 둔다(뒤에서 덮어쓰지 못한다) · 객체의 기본 속성 이름이 와도 그대로 글이다.
  const 겹침 = 뽑기('<meta name="description" content="처음"><meta name="description" content="나중"><meta name="__proto__" content="x"><meta name="constructor" content="y">');
  assert.equal(겹침.설명, '처음');
  assert.equal(Object.getPrototypeOf(겹침.메타), Object.prototype);
});

test('일부러 꼰 3MB 쪽에서도 제때 끝난다(입력 길이에 비례)', () => {
  const 크기 = 3 * 1024 * 1024;
  const 채우기 = (조각) => 조각.repeat(Math.ceil(크기 / 조각.length)).slice(0, 크기);
  const 꼬인것 = {
    '닫히지 않는 따옴표': 채우기('<a href="'),
    '부등호만': 채우기('<'),
    '여는 꼬리표만': 채우기('<div class=a '),
    '닫히지 않는 그림': 채우기('<svg>'),
    '닫히지 않는 주석': 채우기('<!--'),
    '닫히지 않는 선언': 채우기('<!'),
    '빈 스크립트 줄': 채우기('<script></script>'),
    '구조 자료 줄': 채우기('<script type="application/ld+json">{"@type":"Product","name":"x"}</script>'),
    '문자 참조 줄': 채우기('&amp;&#x41;&nosuch;'),
    '속성 줄': `<p ${채우기('a=1 ')}>글</p>`,
    '깊은 겹침': 채우기('<div><nav><h1>'),
    '보통 쪽': 채우기('<div class="item"><h3>제목</h3><p>설명 글이 조금 있다.</p><img src="x.jpg" alt="그림 설명이 있다"></div>\n'),
  };
  for (const [이름, 글] of Object.entries(꼬인것)) {
    const 시작 = process.hrtime.bigint();
    const r = 뽑기(글);
    const 걸린 = Number(process.hrtime.bigint() - 시작) / 1e6;
    assert.ok(r && typeof r.본문 === 'string', 이름);
    assert.ok(r.본문.length <= 한계.본문, 이름);
    // 평소에는 수십 ms다. 다른 일로 바쁜 PC에서도 넘지 않을 넉넉한 선 — 제곱으로 느려지는 길이 생기면 이 선을 크게 넘는다.
    assert.ok(걸린 < 4000, `${이름}: ${걸린.toFixed(0)}ms`);
  }
});
