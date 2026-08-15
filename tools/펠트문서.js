#!/usr/bin/env node
/**
 * Loom L4 — 펠트 문서 스킨 (HTML 지면이 입는 펠트)
 *
 * 무엇: 우리 HTML 문서(소개서·판정 재료·검수표·발표 자료)가 공통으로 입는 «펠트 지면» 한 벌.
 *       값은 전부 정본에서 온다 — 색 = docs/디자인_토큰.json · 천 = docs/tools/펠트천.json.
 *       이 파일에는 **레이아웃 문법**만 있고 hex·데이터는 없다(중복 정본 금지).
 *
 * 왜: 문서마다 <style> 을 손으로 베껴 쓰면 브랜드가 문서 수만큼 갈라진다(실측: 엔진 소개서 6벌이
 *     같은 CSS 를 각자 들고 있었다). 스킨을 한 곳에서 조립해 주입하면 값 개정이 한 수가 된다.
 *
 * 통로:  python tools/펠트천굽기.py      # 패치 → data URI 타일
 *        node tools/펠트문서.js --굽기 입력.html 출력.html
 *        node tools/펠트문서.js --검사 문서.html   # 자립성·스킨 최신 여부
 *
 * 입력 HTML 은 `<!--펠트스킨-->` 표식 한 줄을 두면 된다 — 그 자리에 <style> 이 들어간다.
 *
 * 설계 판정(실측이 정했다 · 2026-08-15):
 *   · 밝은 천은 결을 93~99% 지키는데 **Navy 2 는 굽고 나면 63.7%** 라 굽기 가드가 거부한다.
 *     → 펠트 문서는 «밝은 문서»다. 어두운 자리는 텍스처 없는 평면 Navy 2 로 정직하게 둔다.
 *       (가짜 결을 그려 넣지 않는다 — 헌법 ① 「결은 사진 픽셀에서만」)
 *   · 위계는 색이 아니라 «두께»가 진다(킷 3규칙 ②의 밀도를 펠트 문법으로 옮긴 것) —
 *     조각이 매트에서 얼마나 떠 있나(그림자 깊이)로 층을 만들고, 색은 신호 1점(코랄)만 쓴다.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const 루트 = path.dirname(__dirname);
const 천길 = path.join(루트, 'docs', 'tools', '펠트천.json');
const 토큰길 = path.join(루트, 'docs', '디자인_토큰.json');

const 표식 = '<!--펠트스킨-->';
// 지면 기본 팔레트 — 이 4장이면 문서 한 벌이 선다(약 48KB · base64 65KB).
const 기본천 = ['Paper', 'Cream', 'Cream3', 'Coral'];

/* 결 진정(damping) — 천 위에 «킷 평면색»을 이만큼 덮어 결 진폭을 줄인다.
   왜 칩 하나뿐인가: 실측(--대비)이 그렇게 갈랐다. 톤 사다리를 잡고 나니
   글자가 앉는 모든 면이 최악 7.0:1 이상으로 올라와 결을 깎을 이유가 사라졌고,
   코랄 칩만 결의 어두운 1% 자리에서 3.81:1 이라 30% 를 치른다(필요치 28%).
   → 결은 지면·조각·표지에 100% 로 남는다. 값을 치르는 면은 지면 전체의 1%도 안 된다. */
const 진정 = { Coral: 0.30 };

function 정본읽기() {
  if (!fs.existsSync(천길)) {
    throw new Error('펠트천이 없다 — 먼저 `python tools/펠트천굽기.py` 를 돌린다: ' + 천길);
  }
  const 천 = JSON.parse(fs.readFileSync(천길, 'utf8'));
  const 토큰 = JSON.parse(fs.readFileSync(토큰길, 'utf8'));
  const 색 = {};
  for (const c of 토큰['색']['킷']) 색[c['이름']] = c['hex'];
  return { 천: 천['천'], 규격: 천['_규격'], 색, 서체: 토큰['서체'] };
}

/** 킷 색을 CSS 변수로 — 이름을 케밥으로 눕힌다(Cream 3 → cream3). */
function 변수이름(이름) {
  return '--' + 이름.toLowerCase().replace(/\s+/g, '');
}

/** #RRGGBB → "R,G,B" — 반투명 진정 층이 쓴다(rgba() 는 hex 를 못 받는다). */
function rgb분해(hex) {
  const n = String(hex).replace('#', '');
  if (n.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).join(',');
}

/**
 * 스킨 CSS 를 조립한다.
 * @param {string[]} 쓸천  인라인할 천 이름들(생략 = 기본 4장)
 */
function 스킨(쓸천) {
  const { 천, 규격, 색, 서체 } = 정본읽기();
  const 목록 = (쓸천 && 쓸천.length ? 쓸천 : 기본천);
  const 없는것 = 목록.filter((n) => !천[n]);
  if (없는것.length) {
    throw new Error('구운 적 없는 천: ' + 없는것.join(', ') +
      ' — 공용 역할이 맞는지 보고(`python tools/펠트패치.py 역할`) 굽기를 다시 돌린다');
  }

  // 문서가 쓰는 킷 색만 변수로 낸다(안 쓰는 20색을 매 문서에 싣지 않는다).
  const 쓰는색 = ['Paper', 'Ink', 'Navy', 'Navy 2', 'Navy 3', 'Cream', 'Cream 3',
    'Coral', 'Coral 3', 'Coral Wash', 'Slate', 'Slate 2'];
  const 색줄 = 쓰는색
    .filter((n) => 색[n])
    .map((n) => `    ${변수이름(n)}:${색[n]};${rgb분해(색[n]) ? ` ${변수이름(n)}-rgb:${rgb분해(색[n])};` : ''}`)
    .join('\n');
  const 천줄 = 목록
    .map((n) => `    --천-${n.toLowerCase()}:url(${천[n].uri});`)
    .join('\n');
  const 천주 = 목록
    .map((n) => `${n} 결 ${천[n].결퍼센트}%`)
    .join(' · ');

  return `<style>
/* ── SYNK 펠트 지면 v0.1 — 조립 산출물(손 편집 금지) ─────────────────────────
   통로: python tools/펠트천굽기.py → node tools/펠트문서.js --굽기
   천: ${천주}  ·  ${규격.한변}px ${규격.형식}  (실물 양모 사진에서 잘라 염색한 타일 — 헌법 ①)
   색: docs/디자인_토큰.json 킷  ·  서체: 브랜드 폰트 정본 3종 배타
   ⚠어두운 면에 결을 그리지 않는다 — 다크 펠트는 압축 뒤 결 63.7%(하한 90%) 로 굽기가 거부한다.
   ────────────────────────────────────────────────────────────────────── */
  :root{
${색줄}
${천줄}
    --결: 96px;             /* 섬유 크기 — 150px 은 실측 렌더에서 섬유가 아니라 «얼룩»으로 읽혔다 */
    --깃: 14px;             /* 펠트 조각 모서리(펠트는 각을 못 세운다) */
    --스티치인셋: 8px;       /* 실이 가장자리에서 들어온 거리 */
    --진정: ${진정.Coral};   /* 코랄 칩의 결 진폭만 눌러 글자 대비를 산다(--대비가 정한 값) */
    --실: rgba(23,24,32,.17);      /* 스티치 실 — 밝은 조각 위 */
    --실연: rgba(23,24,32,.10);
    /* 그림자는 Navy 2 틴트만 — 순검정 금지(DESIGN.md 감각 규칙) */
    --그늘: 15,23,48;
    --font: ${서체.본문스택};
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;scroll-padding-top:24px;}
  /* 톤 사다리 = 깊이다(실측 렌더 1회차 교훈: 바탕과 조각이 같은 톤이면 «오려 붙인 펠트»가 안 선다).
     뒤 ← 작업판 Cream 3  ·  조각 Cream  ·  표지·강조 Paper → 앞.
     셋 다 킷의 바탕 층이라 «신호 1점」 규칙과 충돌하지 않는다(색이 아니라 면이다). */
  body{
    margin:0;
    background-color:var(--cream3);
    background-image:var(--천-cream3);
    background-size:var(--결);
    color:var(--ink);
    font-family:var(--font);
    font-weight:500;
    font-size:16px;
    line-height:1.75;
    letter-spacing:-.02em;
    word-break:keep-all;
    -webkit-font-smoothing:antialiased;
  }
  /* 제본 띠 — 유일한 다크 면. 면적이 작아서 결이 없어도 「평면 잉크」로 읽힌다. */
  body::before{
    content:'';position:fixed;inset:0 0 auto;height:6px;z-index:9;
    background:var(--navy2);
    box-shadow:0 1px 3px rgba(15,23,48,.45);
  }

  .판{max-width:1240px;margin:0 auto;padding:34px 24px 80px;
     display:grid;grid-template-columns:minmax(0,1fr);gap:0 40px;}
  .글{max-width:74ch;}

  /* ── 펠트 조각 ─────────────────────────────────────────────────────────
     두께 = 안쪽 위 잔털 하이라이트 + 아래 눌린 선 + 매트에 드리운 그림자.
     이 세 겹이 「떠 있는 정도」를 만든다 — 위계를 색 대신 여기서 낸다. */
  .조각{
    position:relative;
    background-color:var(--cream);
    background-image:var(--천-cream);
    background-size:var(--결);
    border-radius:var(--깃);
    padding:20px 22px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.55),
      inset 0 -1px 0 rgba(var(--그늘),.05),
      0 1.5px 0 rgba(var(--그늘),.10),
      0 12px 20px -14px rgba(var(--그늘),.5);
  }
  .조각.밝은{background-color:var(--paper);background-image:var(--천-paper);}
  /* 본문 시트 — 장문은 결 위에 바로 앉히지 않는다(실측 렌더 2회차: 읽히긴 해도 눈이 쉬지 못했다).
     작업판(뒤) → 시트(본문) → 조각(앞) 세 층이 되고, 읽는 면은 가장 조용한 가운데 층이다. */
  .조각.지면{padding:30px 34px 24px;margin:0 0 8px;}
  .조각.지면>:first-child{margin-top:0;}
  .조각.지면>h2:first-child{margin-top:.4em;}
  .조각.두꺼운{
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.55),
      inset 0 -1px 0 rgba(var(--그늘),.05),
      0 2.5px 0 rgba(var(--그늘),.11),
      0 22px 34px -20px rgba(var(--그늘),.55);
  }
  /* 블랭킷 스티치 — 조각 안쪽을 한 바퀴 돈다.
     동심원 모서리: 안쪽 반지름 = 바깥 반지름 − 인셋(DESIGN.md 감각 규칙) */
  .조각.스티치::before{
    content:'';position:absolute;inset:var(--스티치인셋);pointer-events:none;
    border:2px dashed var(--실);
    border-radius:calc(var(--깃) - var(--스티치인셋));
  }
  .조각.스티치>*{position:relative;}

  /* 코랄 펠트 칩 — 지면의 유일한 신호(킷 3규칙 ①).
     칩 위 글자는 Ink 만(철칙 ③ — 흰 글자는 이 색에서 대비 미달 2.8). */
  .칩{
    display:inline-block;
    background-color:var(--coral);
    background-image:
      linear-gradient(rgba(var(--coral-rgb),var(--진정)),rgba(var(--coral-rgb),var(--진정))),
      var(--천-coral);
    background-size:auto,var(--결);
    color:var(--ink);
    font-weight:800;letter-spacing:-.01em;
    padding:.08em .5em;border-radius:9px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 1px 0 rgba(var(--그늘),.16),
               0 5px 9px -6px rgba(var(--그늘),.55);
  }
  .칩.작은{font-size:.74em;padding:.16em .55em;letter-spacing:.08em;font-weight:700;border-radius:7px;}

  /* ── 표지 조각 ───────────────────────────────────────────────────────── */
  .표지{margin:20px 0 30px;padding:34px 32px 28px;}
  .표지 .머리{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:16px;}
  .표지 h1{
    margin:.06em 0 .2em;font-size:clamp(2.1rem,5.6vw,3.1rem);font-weight:800;
    letter-spacing:-.04em;line-height:1.08;color:var(--ink);
  }
  .표지 .한줄{margin:0;font-size:1.08em;color:var(--navy);max-width:48em;}
  .표지 .메타{margin:18px 0 0;font-size:.83em;font-weight:400;color:var(--navy3);}

  /* ── 본문 ────────────────────────────────────────────────────────────── */
  h2{
    display:flex;align-items:center;gap:.5em;flex-wrap:wrap;
    margin:2.6em 0 .7em;font-size:1.27em;font-weight:800;letter-spacing:-.03em;line-height:1.35;
  }
  h2>span:not(.칩){flex:0 1 auto;min-width:0;}
  /* 실 한 줄이 제목 뒤를 마감한다 — 옛 3px 코랄 괘선을 대신한다(색 대신 밀도) */
  h2::after{
    content:'';flex:1 1 2em;height:2px;min-width:2em;
    background:repeating-linear-gradient(90deg,var(--실) 0 8px,transparent 8px 15px);
  }
  h3{margin:1.7em 0 .4em;font-size:1.02em;font-weight:800;letter-spacing:-.02em;color:var(--navy);}
  p{margin:.6em 0;}
  ul,ol{margin:.5em 0 .9em;padding-left:1.35em;}
  li{margin:.34em 0;}
  li::marker{color:var(--navy3);}
  b,strong{font-weight:800;}
  a{color:var(--ink);text-decoration:none;
    background:linear-gradient(90deg,var(--실) 0 6px,transparent 6px 11px) bottom left/11px 2px repeat-x;
    padding-bottom:2px;}
  a:hover{background-image:linear-gradient(90deg,var(--coral3) 0 6px,transparent 6px 11px);}
  .흐린{color:var(--navy3);}
  .작게{font-size:.87em;}
  /* 코드 조각은 «가장 앞» 톤이라 작업판 위에서도 조각 위에서도 똑같이 떠 보인다.
     서체는 본문 그대로 — DM Mono 에는 한글·키릴 글리프가 없어 우리 코드 이름이 깨진다(브랜드 폰트 정본). */
  code{font-family:inherit;font-size:.94em;font-weight:600;
       background-color:var(--cream3);background-image:var(--천-cream3);background-size:var(--결);
       padding:.06em .4em;border-radius:6px;
       box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 1px 0 rgba(var(--그늘),.09);}

  /* 강조 배너 — 왼쪽에 코랄 펠트 탭을 덧대 꿰맨 모양 */
  .알림{margin:16px 0;padding:16px 20px 16px 24px;font-size:.94em;overflow:hidden;}
  .알림::after{content:'';position:absolute;left:0;top:0;bottom:0;width:8px;
    background-color:var(--coral);background-image:var(--천-coral);background-size:var(--결);
    box-shadow:1px 0 0 rgba(var(--그늘),.13);}
  .알림.조용{}
  .알림.조용::after{background:var(--navy3);}

  blockquote{margin:1em 0;padding:16px 20px;font-size:.94em;color:var(--navy);}
  blockquote i{color:var(--navy);}

  /* ── 표 = 펠트 띠 ─────────────────────────────────────────────────────
     1px 격자를 걷어내고, 행을 실로 꿰맨 천 띠로 만든다. */
  .표틀{margin:1em 0;padding:8px;overflow-x:auto;}
  table{border-collapse:separate;border-spacing:0;width:100%;font-size:.92em;}
  th,td{padding:.62em .8em;text-align:left;vertical-align:top;}
  thead th{
    background-color:var(--cream3);background-image:var(--천-cream3);background-size:var(--결);
    font-weight:800;color:var(--ink);letter-spacing:-.02em;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.5);
  }
  thead th:first-child{border-radius:8px 0 0 8px;}
  thead th:last-child{border-radius:0 8px 8px 0;}
  tbody td{border-top:2px dashed var(--실연);}
  tbody tr:first-child td{border-top:0;}

  /* ── 목차 레일 ───────────────────────────────────────────────────────── */
  .레일{display:none;}
  .레일 ol{list-style:none;margin:0;padding:0;counter-reset:칸;}
  .레일 li{margin:0;}
  .레일 a{display:block;padding:.3em .55em;border-radius:8px;font-size:.86em;
    color:var(--navy3);background:none;letter-spacing:-.02em;}
  .레일 a:hover{color:var(--ink);background:rgba(23,24,32,.05);}
  .레일 a.여기{color:var(--ink);font-weight:800;
    background-color:var(--paper);background-image:var(--천-paper);background-size:var(--결);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 1px 0 rgba(var(--그늘),.09);}
  .레일 .꼭지{font-size:.72em;font-weight:700;letter-spacing:.14em;color:var(--navy3);
    margin:0 0 .7em;padding-left:.55em;}

  /* 좁은 화면용 접이 목차 — 레일이 없을 때만 보인다 */
  .접이차례{margin:16px 0;padding:14px 18px;font-size:.9em;}
  .접이차례 summary{cursor:pointer;font-weight:800;letter-spacing:-.02em;}
  .접이차례 a{margin-right:.2em;}

  @media (min-width:1080px){
    .판{grid-template-columns:206px minmax(0,1fr);}
    .레일{display:block;position:sticky;top:34px;align-self:start;padding-top:6px;}
    .접이차례{display:none;}
  }

  footer{margin:3.4em 0 0;padding:18px 0 0;color:var(--navy3);font-size:.84em;
    border-top:2px dashed var(--실연);}

  @media print{
    body{background-image:var(--천-paper);}
    body::before{display:none;}
    .레일{display:none;}
    .판{display:block;padding:0;}
    .조각{box-shadow:0 0 0 1px rgba(var(--그늘),.13);break-inside:avoid;}
    h2{break-after:avoid;}
    @page{margin:14mm;}
    *{print-color-adjust:exact;-webkit-print-color-adjust:exact;}
  }
</style>`;
}

/** 목차 레일에 현재 절을 표시하는 스크립트(외부 의존 0). */
function 레일스크립트() {
  return `<script>
(function(){
  var 링크=[].slice.call(document.querySelectorAll('.레일 a[href^="#"]'));
  if(!링크.length||!('IntersectionObserver' in window))return;
  var 표={};링크.forEach(function(a){var s=document.getElementById(a.hash.slice(1));if(s)표[a.hash.slice(1)]=a;});
  var 본=Object.keys(표).map(function(id){return document.getElementById(id);});
  var 눈=new IntersectionObserver(function(들){
    들.forEach(function(e){
      if(e.isIntersecting){
        링크.forEach(function(a){a.classList.remove('여기');});
        표[e.target.id].classList.add('여기');
      }
    });
  },{rootMargin:'-10% 0px -80% 0px',threshold:0});
  본.forEach(function(s){눈.observe(s);});
})();
</script>`;
}

function 굽기(입력, 출력, 쓸천) {
  const 원문 = fs.readFileSync(입력, 'utf8');
  if (!원문.includes(표식)) {
    throw new Error('표식이 없다 — 입력 HTML 에 ' + 표식 + ' 한 줄을 둔다: ' + 입력);
  }
  const 결과 = 원문.replace(표식, 스킨(쓸천) + '\n' + 레일스크립트());
  fs.mkdirSync(path.dirname(출력), { recursive: true });
  fs.writeFileSync(출력, 결과, 'utf8');
  return { 바이트: Buffer.byteLength(결과, 'utf8') };
}

/* ── 대비 심판 ──────────────────────────────────────────────────────────────
   왜 여기 있나: `브랜드렌더린트.js` 는 배경이 **그라디언트·이미지면 대비 판정을 포기**한다
   (실측 2026-08-15: 이 시안에서 텍스트 169개 전부 포기 → 「✅ 대비 위반 0」의 분모가 0이었다).
   펠트를 깔면 우리 문서의 대비 검사가 통째로 눈이 머는 셈이라, 그 자리를 이 명령이 대신 진다.
   면이 아니라 **결**이므로 평균색으로 재지 않는다 — 글자가 앉는 최악의 픽셀(p1/p99)로 심판한다. */

/** WCAG 상대휘도 — hex 문자열 → Y */
function 휘도(hex) {
  const n = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
}
const 대비비 = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** 스킨이 실제로 쓰는 «글자 × 천» 짝 — 스킨 CSS 가 바뀌면 여기도 같이 옮긴다. */
const 짝들 = [
  { 글자: 'Ink', 천: 'Cream', 자리: '본문 시트 — 이 문서에서 글자가 가장 많이 앉는 면' },
  { 글자: 'Navy', 천: 'Cream', 자리: 'h3 · 시트 위 인용' },
  { 글자: 'Navy 3', 천: 'Cream', 자리: '시트 위 흐린 주석·푸터·목록 글머리' },
  { 글자: 'Ink', 천: 'Paper', 자리: '표지 · 앞층 조각(알림·표·인용)' },
  { 글자: 'Navy', 천: 'Paper', 자리: '표지 한 줄' },
  { 글자: 'Navy 3', 천: 'Paper', 자리: '표지 메타 · 조각 안 흐린 주석' },
  { 글자: 'Ink', 천: 'Cream3', 자리: '표 머리 · 코드 조각' },
  { 글자: 'Navy 3', 천: 'Cream3', 자리: '레일 항목(작업판 위)' },
  { 글자: 'Ink', 천: 'Coral', 자리: '코랄 칩(신호 1점)' },
];

/* 허용 바닥 — DESIGN.md §2 조항 ⓒ·ⓔ. 「바닥을 틀리는 것이 이 색들의 유일한 오용 형태」라
   대비가 통과해도 바닥이 틀리면 위반이다(대비는 이유 중 하나일 뿐 규정 자체가 아니다). */
const 바닥규칙 = {
  'Slate 2': ['Paper', 'Cream', 'Cream 2', 'Coral Wash'],
  'Coral 3': ['Paper', 'Cream', 'Coral Wash'],
};
/** 천 이름(케밥 없는 파일명) → 킷 색 이름 */
const 천을킷이름으로 = { Paper: 'Paper', Cream: 'Cream', Cream3: 'Cream 3', Coral: 'Coral', CoralSoft: 'Coral Soft', Slate: 'Slate' };

function 대비판정() {
  const { 천, 색 } = 정본읽기();
  const 줄 = [];
  for (const p of 짝들) {
    const t = 천[p.천];
    if (!t) { 줄.push({ ...p, 흠: '천을 안 구웠다' }); continue; }
    if (!t.휘도) { 줄.push({ ...p, 흠: '휘도 분포가 없다 — `python tools/펠트천굽기.py` 재실행' }); continue; }
    const 글Y = 휘도(색[p.글자]);
    // 글자가 천보다 어두우면 «가장 어두운 자리»가 최악, 밝으면 «가장 밝은 자리»가 최악이다.
    const 생최악Y = 글Y < t.휘도.중앙 ? t.휘도.p1 : t.휘도.p99;
    // 진정 층(킷 평면색 α 덮기)이 걸린 천은 그만큼 결 진폭이 눌린다 — 실제로 화면에 나오는 값으로 잰다.
    const α = 진정[p.천] || 0;
    const 평면Y = 휘도(색[천을킷이름으로[p.천]] || 색[p.천] || '#808080');
    const 섞 = (y) => α * 평면Y + (1 - α) * y;
    const 최악Y = 섞(생최악Y);
    const 기준 = 4.5;
    const 최악 = 대비비(글Y, 최악Y);
    const 허용 = 바닥규칙[p.글자];
    const 바닥이름 = 천을킷이름으로[p.천] || p.천;
    const 바닥위반 =허용 && !허용.includes(바닥이름);
    줄.push({
      ...p,
      중앙: 대비비(글Y, 섞(t.휘도.중앙)),
      최악,
      진정: α,
      기준,
      바닥위반,
      통과: 최악 >= 기준 && !바닥위반,
    });
  }
  return 줄;
}
const 채움 = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));

/** 자립성 검사 — 외부에서 끌어오는 «그림»이 하나라도 있으면 첨부 단독일 때 전멸한다(F: 홈페이지 2라운드). */
function 검사(파일) {
  const 원문 = fs.readFileSync(파일, 'utf8');
  const 흠 = [];
  if (원문.includes(표식)) 흠.push('스킨이 아직 안 구워졌다(표식이 남아 있다)');
  const 상대그림 = [...원문.matchAll(/<img[^>]+src="(?!data:)([^"]+)"/g)].map((m) => m[1]);
  if (상대그림.length) 흠.push('인라인 안 된 그림 ' + 상대그림.length + '개: ' + 상대그림.slice(0, 3).join(', '));
  const 외부 = [...원문.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  const 폰트만 = 외부.filter((u) => !/fonts\.googleapis|SUIT-Variable/.test(u));
  if (폰트만.length) 흠.push('폰트 밖 외부 자원 ' + 폰트만.length + '개: ' + 폰트만.slice(0, 3).join(', '));
  return { 흠, 외부폰트: 외부.length - 폰트만.length, 바이트: Buffer.byteLength(원문, 'utf8') };
}

if (require.main === module) {
  const 인자 = process.argv.slice(2);
  const 모드 = 인자[0];
  try {
    if (모드 === '--굽기') {
      const [, 입력, 출력, ...천들] = 인자;
      if (!입력 || !출력) throw new Error('용법: node tools/펠트문서.js --굽기 <입력.html> <출력.html> [천 이름…]');
      const r = 굽기(입력, 출력, 천들);
      console.log('■ 펠트 스킨 주입  %s → %s  (%sKB)',
        path.relative(루트, 입력), path.relative(루트, 출력), (r.바이트 / 1024).toFixed(1));
      const c = 검사(출력);
      if (c.흠.length) {
        console.log('   🔴 자립성 흠 %d건:', c.흠.length);
        c.흠.forEach((h) => console.log('      · ' + h));
        process.exit(1);
      }
      console.log('   ✅ 자립형 — 인라인 안 된 그림 0 · 외부 자원은 폰트 %d개뿐(없으면 system-ui 로 내려앉는다)', c.외부폰트);
    } else if (모드 === '--검사') {
      const c = 검사(인자[1]);
      console.log('■ %s  %sKB', 인자[1], (c.바이트 / 1024).toFixed(1));
      if (c.흠.length) { c.흠.forEach((h) => console.log('   🔴 ' + h)); process.exit(1); }
      console.log('   ✅ 자립형 (외부 = 폰트 %d개)', c.외부폰트);
    } else if (모드 === '--대비') {
      const 줄 = 대비판정();
      console.log('■ 펠트 지면 대비 — 평균색이 아니라 «최악의 섬유»로 심판한다');
      console.log('   (브랜드렌더린트는 배경이 이미지면 판정을 포기한다 — 그 분모를 이 표가 진다)');
      let 실패 = 0;
      let 바닥 = 0;
      for (const r of 줄) {
        if (r.흠) {
          console.log('   🔴 ' + 채움(r.글자, 9) + ' on ' + 채움(r.천, 7) + '  ' + r.흠);
          실패++; continue;
        }
        if (!r.통과) 실패++;
        if (r.바닥위반) 바닥++;
        console.log('   ' + (r.통과 ? '✅' : '🔴') + ' ' + 채움(r.글자, 9) + ' on ' + 채움(r.천, 7)
          + '  중앙 ' + 채움(r.중앙.toFixed(2), 5) + ':1 · 최악 ' + 채움(r.최악.toFixed(2), 5) + ':1'
          + '  (기준 ' + r.기준.toFixed(1) + ':1 · 진정 ' + Math.round(r.진정 * 100) + '%)  ' + r.자리
          + (r.바닥위반 ? '  ⛔허용 바닥 밖(DESIGN.md §2)' : ''));
      }
      console.log('   합계 ' + 줄.length + '짝 = 통과 ' + (줄.length - 실패) + ' + 미달 ' + 실패
        + ' (그중 바닥 규정 위반 ' + 바닥 + ')  ·  안 잰 짝 0 — 스킨이 쓰는 글자×천 전량');
      if (실패) process.exit(1);
    } else if (모드 === '--스킨') {
      console.log(스킨(인자.slice(1)));
    } else {
      console.log('용법:\n  node tools/펠트문서.js --굽기 <입력.html> <출력.html> [천…]\n' +
        '  node tools/펠트문서.js --검사 <문서.html>\n  node tools/펠트문서.js --대비\n' +
        '  node tools/펠트문서.js --스킨 [천…]');
      process.exit(2);
    }
  } catch (e) {
    console.error('🔴 ' + e.message);
    process.exit(1);
  }
}

module.exports = { 스킨, 굽기, 검사, 표식, 기본천 };
