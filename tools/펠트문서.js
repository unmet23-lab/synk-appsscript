#!/usr/bin/env node
/**
 * Loom L4 — SYNK 지면 스킨 「검은 무대」 v0.2 (HTML 문서·판정 재료가 입는 한 벌)
 *
 * 무엇: 우리 HTML 산출물(소개서·판정 재료·검수표·발표 자료)의 공통 지면.
 *       값은 전부 정본에서 온다 — 색 = docs/디자인_토큰.json · 천 = docs/tools/펠트천.json.
 *       이 파일에는 **레이아웃·광학 문법**만 있고 hex 원본은 없다(중복 정본 금지).
 *
 * v0.2 로 갈아엎은 이유 (유호 교정 2026-08-15):
 *   v0.1 은 재질만 펠트로 바꾸고 «문서 골격»은 옛날 것 그대로였다 — 유호님 판정 「옛날 것 같다·
 *   전혀 트렌디하지 않다」. 첨부 레퍼런스 4장의 공통 문법을 뜯으면 답이 하나로 모인다:
 *     ① 순흑에 가까운 무대   ② 부피가 있는 실물 오브 1점   ③ 유리(굴절·스펙큘러·분산 림)
 *     ④ **색이 안료가 아니라 «빛»이다** — 4장 어디에도 브랜드색 «면»이 없다.
 *   이건 우리 08-14 「브랜드 분위기」 분해 결론(순흑 무대·실물 재질 오브 1점·안이 들여다보임)과
 *   같은 좌표다. 그때 시연을 체리(빨강) 젤리로 구웠던 것이 이번 교정의 과녁이다.
 *
 * 색 규율 (킷과 어긋나지 않게 못박는다)
 *   · 무대 = Navy 2(킷에서 가장 깊은 면) · 잉크 = Cream · 3번째 글자 층 = Slate
 *     (Slate 의 허용 바닥이 정확히 Navy 2·Navy·Navy Ink 라 이 무대가 그 색의 제 자리다)
 *   · **유리에는 안료를 칠하지 않는다.** 유리 몸은 무채(Navy Ink 반투명)이고, 색은 분산 림이 낸다.
 *     안료를 칠하는 순간 「유리」가 아니라 「색 젤리」가 된다 — 유호 교정의 핵심.
 *   · 신호 1점(Coral)은 살아 있되 **면이 아니라 빛으로** 쓴다: 실선 1px·점 하나·눌림 상태.
 *   · 펠트는 «실물 오브» 자리에 남는다 — 검은 무대 위 밝은 양모(레퍼런스 ①과 같은 문법).
 *     다크 펠트는 굽기 가드가 거부하므로(결 63.7%) 애초에 밝은 천만 오브로 쓴다.
 *
 * 통로:  python tools/펠트천굽기.py                       # 패치 → data URI 타일
 *        node tools/펠트문서.js --굽기 입력.html 출력.html   # <!--펠트스킨--> 자리에 주입
 *        node tools/펠트문서.js --검사 문서.html            # 자립성(그림 외부 참조 0)
 *        node tools/펠트문서.js --대비                      # 글자×면 전량 심판
 *        node tools/펠트문서.js --림 무채                   # 분산 림을 무채로(대안판)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const 루트 = path.dirname(__dirname);
const 천길 = path.join(루트, 'docs', 'tools', '펠트천.json');
const 토큰길 = path.join(루트, 'docs', '디자인_토큰.json');

const 표식 = '<!--펠트스킨-->';
// 검은 무대에서 실물 오브로 쓰는 천 — 밝은 것만(다크 펠트는 결이 죽는다).
const 기본천 = ['Cream', 'Paper'];

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

const 변수이름 = (이름) => '--' + 이름.toLowerCase().replace(/\s+/g, '');
function rgb분해(hex) {
  const n = String(hex).replace('#', '');
  if (n.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

/* ── 분산 림 레시피 ─────────────────────────────────────────────────────────
   유리 가장자리에서 파장이 갈라지는 현상. 레퍼런스 4장 전부의 «서명»이다.
   ⚠이것은 팔레트가 아니라 «광학»이다 — 면을 칠하는 색이 아니라 1.5px 테두리의 빛이라
     철칙 ④(한 지면 = 바탕+잉크+신호 1점)의 «면» 조항과 층이 다르다.
     그래도 판단은 유호님 몫이라 무채 대안을 같은 도구에 둔다(`--림 무채`).
   스펙트럼 판의 색각은 킷 색을 파장 순서로 눕힌 것이다(새 hex 0개). */
const 림레시피 = {
  스펙트럼: [
    ['KC Cool Blue', 0.55, 25], ['Lime', 0.30, 80], ['KC Sun', 0.40, 130],
    ['Coral', 0.45, 185], ['KC Hot Pink', 0.34, 232], ['KC Cool Blue', 0.50, 290],
    ['Cream', 0.55, 338],
  ],
  무채: [
    ['Slate', 0.45, 25], ['Cream', 0.60, 120], ['Slate', 0.35, 210],
    ['Cream', 0.42, 300], ['Slate', 0.5, 350],
  ],
};

/* ── 면 사전 — 글자가 앉을 수 있는 모든 바닥 ────────────────────────────────
   유리는 «합성»이다(무대 위에 반투명 층이 겹친다) — 그래서 대비를 잴 때
   평면 hex 가 아니라 층을 실제로 합성한 값으로 잰다. 눈이 보는 것이 그 값이다. */
const 면들 = {
  무대: { 바탕: 'Navy 2', 층: [] },
  유리: { 바탕: 'Navy 2', 층: [['Navy Ink', 0.55], ['Cream', 0.035]] },
  유리밝은: { 바탕: 'Navy 2', 층: [['Navy Ink', 0.55], ['Cream', 0.085]] },
  펠트오브: { 천: 'Cream' },
};

/** sRGB 알파 합성 — CSS 가 실제로 하는 계산(기본 색공간 sRGB). */
function 합성(색, 면) {
  let [r, g, b] = rgb분해(색[면.바탕]);
  for (const [이름, a] of 면.층) {
    const [nr, ng, nb] = rgb분해(색[이름]);
    r = r * (1 - a) + nr * a; g = g * (1 - a) + ng * a; b = b * (1 - a) + nb * a;
  }
  return [r, g, b];
}
const 채널휘도 = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const 휘도RGB = ([r, g, b]) => 0.2126 * 채널휘도(r) + 0.7152 * 채널휘도(g) + 0.0722 * 채널휘도(b);
const 휘도 = (hex) => 휘도RGB(rgb분해(hex));
const 대비비 = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** 스킨이 실제로 쓰는 «글자 × 면» 짝 — 스킨 CSS 가 바뀌면 여기도 같이 옮긴다. */
const 짝들 = [
  { 글자: 'Cream', 면: '무대', 자리: '본문 — 이 문서에서 글자가 가장 많이 앉는 자리' },
  { 글자: 'Slate', 면: '무대', 자리: '보조 문장·메타·푸터·레일 비활성' },
  { 글자: 'Cream', 면: '유리', 자리: '유리 패널 본문·표 본문' },
  { 글자: 'Slate', 면: '유리', 자리: '유리 패널 보조·표 주석' },
  { 글자: 'Cream', 면: '유리밝은', 자리: '표 머리·레일 활성·코드 조각' },
  { 글자: 'Coral 2', 면: '유리', 자리: '다크 보조 강조 글자(킷 직책 그대로)' },
  { 글자: 'Coral', 면: '무대', 자리: '신호 — 절 번호 옆 점·활성 표식' },
  { 글자: 'Ink', 면: '펠트오브', 자리: '펠트 오브 위 글자(표지 명패)' },
  { 글자: 'Slate', 면: '무대', 큰가: true, 자리: '히어로 그러데이션의 어두운 끝(대형 타이포)' },
];

function 대비판정() {
  const { 천, 색 } = 정본읽기();
  const 줄 = [];
  for (const p of 짝들) {
    const 면 = 면들[p.면];
    const 글Y = 휘도(색[p.글자]);
    const 기준 = p.큰가 ? 3.0 : 4.5;
    if (면.천) {
      const t = 천[면.천];
      if (!t || !t.휘도) { 줄.push({ ...p, 흠: '천 휘도 없음 — `python tools/펠트천굽기.py` 재실행' }); continue; }
      const 최악Y = 글Y < t.휘도.중앙 ? t.휘도.p1 : t.휘도.p99;
      줄.push({ ...p, 중앙: 대비비(글Y, t.휘도.중앙), 최악: 대비비(글Y, 최악Y), 기준, 방식: '결 p1/p99',
        통과: 대비비(글Y, 최악Y) >= 기준 });
    } else {
      const bgY = 휘도RGB(합성(색, 면));
      const c = 대비비(글Y, bgY);
      줄.push({ ...p, 중앙: c, 최악: c, 기준, 방식: '층 합성', 통과: c >= 기준 });
    }
  }
  return 줄;
}
const 채움 = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));

/** 스킨 CSS 조립. @param 쓸천 인라인할 펠트 타일 @param 림 '스펙트럼'|'무채' */
function 스킨(쓸천, 림 = '스펙트럼') {
  const { 천, 규격, 색, 서체 } = 정본읽기();
  const 목록 = (쓸천 && 쓸천.length ? 쓸천 : 기본천);
  const 없는것 = 목록.filter((n) => !천[n]);
  if (없는것.length) throw new Error('구운 적 없는 천: ' + 없는것.join(', '));
  if (!림레시피[림]) throw new Error('림 레시피는 스펙트럼·무채 둘뿐이다 — 받은 값: ' + 림);

  const 쓰는색 = ['Navy 2', 'Navy Ink', 'Navy', 'Navy 3', 'Cream', 'Cream 3', 'Paper',
    'Ink', 'Coral', 'Coral 2', 'Coral 3', 'Slate', 'KC Cool Blue'];
  const 색줄 = 쓰는색.filter((n) => 색[n])
    .map((n) => `    ${변수이름(n)}:${색[n]}; ${변수이름(n)}-rgb:${rgb분해(색[n]).join(',')};`).join('\n');
  const 천줄 = 목록.map((n) => `    --천-${n.toLowerCase()}:url(${천[n].uri});`).join('\n');
  const 림줄 = 림레시피[림]
    .map(([이름, a, deg]) => `rgba(${rgb분해(색[이름]).join(',')},${a}) ${deg}deg`).join(',\n      ');
  const 천주 = 목록.map((n) => `${n} 결 ${천[n].결퍼센트}%`).join(' · ');

  return `<style>
/* ── SYNK 지면 「검은 무대」 v0.2 — 조립 산출물(손 편집 금지) ────────────────────
   통로: python tools/펠트천굽기.py → node tools/펠트문서.js --굽기
   문법: 순흑에 가까운 무대 · 실물 펠트 오브 1점 · 유리 크롬(스펙큘러+분산 림)
   색:  무대 Navy 2 · 잉크 Cream · 3층 Slate · 신호 Coral «빛으로만»
        ⚠유리에 안료를 칠하지 않는다 — 색은 1.5px 분산 림(${림} 판)이 낸다.
   천:  ${천주} · ${규격.한변}px ${규격.형식} (실물 양모 사진 — 헌법 ①)
   ──────────────────────────────────────────────────────────────────────── */
  :root{
${색줄}
${천줄}
    --결: 84px;
    --깃: 22px;                 /* 유리 조각 모서리 */
    --깃속: 12px;               /* 그 안에 드는 것(동심원: 바깥 − 패딩) */
    --유리막: rgba(var(--navyink-rgb),.55);
    --윤: rgba(var(--cream-rgb),.16);      /* 위 스펙큘러 */
    --윤약: rgba(var(--cream-rgb),.07);
    --금: rgba(var(--cream-rgb),.10);      /* 괘선 — 유리에 그은 실금 */
    --그늘: 0,0,0;                          /* 무대는 순흑 그림자를 쓴다(면이 아니라 빛의 부재) */
    --font: ${서체.본문스택};
  }
  *{box-sizing:border-box;}
  /* ⚠scroll-behavior 를 html 에 상시로 걸지 않는다 — 링크로 들어올 때 «먼 거리 자동 스크롤»이
     로드 순간에 돌아 어수선하다. 부드러움은 사용자가 «누른» 이동에만 붙인다(스크립트). */
  html{scroll-padding-top:96px;background:var(--navy2);}

  /* ── 무대 ───────────────────────────────────────────────────────────────
     가장자리는 킷에서 가장 깊은 면(Navy 2) 그대로 두고, 가운데만 한 단 들어올린다.
     = 순흑을 새로 만들지 않고 «무대 조명»으로 깊이를 낸다(새 hex 0개). */
  body{
    margin:0;min-height:100vh;
    background:
      radial-gradient(105% 62% at 50% -14%, rgba(var(--navy3-rgb),.62) 0%, rgba(var(--navy3-rgb),0) 58%),
      radial-gradient(120% 88% at 50% 34%, rgba(0,0,0,0) 8%, rgba(0,0,0,.66) 100%),
      linear-gradient(180deg, rgba(0,0,0,.34), rgba(0,0,0,.52)),
      var(--navy2);
    background-attachment:fixed;
    color:var(--cream);
    font-family:var(--font);font-weight:450;font-size:17px;line-height:1.72;
    letter-spacing:-.021em;word-break:keep-all;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  }

  .판{max-width:1220px;margin:0 auto;padding:0 26px 120px;
      display:grid;grid-template-columns:minmax(0,1fr);gap:0 44px;}
  .글{max-width:70ch;min-width:0;}

  /* ── 유리 ───────────────────────────────────────────────────────────────
     세 겹으로 «두께»를 만든다: ①위에서 든 빛(스펙큘러) ②몸의 반투명 ③무대에 진 그림자.
     backdrop-filter 가 없는 환경에서도 몸 색이 있어 그대로 선다(성능·구형 폴백). */
  .유리{
    position:relative;
    border-radius:var(--깃);
    /* 몸은 무대보다 «어둡다» — 레퍼런스 실측: 유리는 밝아서 보이는 게 아니라
       어두운 몸 위에서 테두리만 형형해서 유리로 읽힌다. 밝히면 그냥 반투명 카드가 된다. */
    background:
      linear-gradient(176deg, rgba(var(--cream-rgb),.11) 0%, rgba(var(--cream-rgb),.022) 26%,
                     rgba(0,0,0,.06) 62%, rgba(0,0,0,.14) 100%),
      var(--유리막);
    -webkit-backdrop-filter:blur(30px) saturate(165%);
    backdrop-filter:blur(30px) saturate(165%);
    box-shadow:
      inset 0 1px 0 var(--윤),
      inset 0 -1px 0 var(--윤약),
      0 1px 2px rgba(var(--그늘),.6),
      0 30px 60px -28px rgba(var(--그늘),1);
    padding:24px 26px;
  }
  /* 분산 림 — 유리 가장자리에서 파장이 갈라진다. 테두리 «두께만» 남기는 마스크 xor. */
  .유리::before{
    content:'';position:absolute;inset:0;border-radius:inherit;padding:1.2px;pointer-events:none;
    background:conic-gradient(from 208deg,
      ${림줄});
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;
    /* 블룸 = 림이 무대로 새어 나온 잔광. 별도 층을 안 쓰고 림 자신에 드리운다
       (::after 는 콜아웃의 신호 빛줄이 이미 쓴다 — 한 자리에 둘을 겹치면 조용히 하나가 죽는다). */
    opacity:.95;z-index:1;
    filter:saturate(1.5)
           drop-shadow(0 0 5px rgba(var(--kccoolblue-rgb),.34))
           drop-shadow(0 0 10px rgba(var(--coral-rgb),.2));
  }
  .유리>*{position:relative;z-index:2;}
  .유리.잔잔{--깃:16px;padding:18px 20px;}
  .유리.잔잔::before{opacity:.72;}
  .유리.깊은{
    box-shadow:
      inset 0 1px 0 rgba(var(--cream-rgb),.22),
      inset 0 -1px 0 var(--윤약),
      0 2px 3px rgba(var(--그늘),.55),
      0 48px 90px -40px rgba(var(--그늘),1);
  }

  /* ── 표지 = 무대 위 실물 오브 1점 + 편집 타이포 ─────────────────────────── */
  .표지{padding:104px 0 66px;display:grid;gap:30px;grid-template-columns:1fr;}
  /* 실물 오브 1점 — 레퍼런스 ①(검은 무대 위 밝은 양모 아이콘)의 문법.
     이 지면에서 «부피»를 가진 유일한 물건이고, 그래서 하나뿐이어야 한다. */
  .오브{
    width:112px;height:112px;border-radius:31px;flex:none;position:relative;overflow:hidden;
    background-color:var(--cream);background-image:var(--천-cream);background-size:46px;
    box-shadow:
      inset 0 3px 4px rgba(255,255,255,.62),
      inset 0 -14px 24px -6px rgba(var(--navy2-rgb),.5),
      inset 8px 0 20px -10px rgba(var(--navy2-rgb),.35),
      inset -8px 0 20px -10px rgba(var(--navy2-rgb),.35),
      0 2px 0 rgba(var(--그늘),.6),
      0 38px 60px -20px rgba(var(--그늘),1);
    display:grid;place-items:center;
    color:var(--ink);font-weight:800;font-size:2.6rem;letter-spacing:-.05em;
  }
  /* 잔털 림라이트 — 위 가장자리에서 빛이 섬유 끝을 태운다 */
  .오브::before{
    content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    background:radial-gradient(78% 52% at 42% -6%, rgba(255,255,255,.72), rgba(255,255,255,0) 62%);
  }
  .오브::after{
    content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.28);
  }
  .표지 .꼭지{
    display:inline-flex;align-items:center;gap:.55em;
    font-size:.7rem;font-weight:700;letter-spacing:.2em;color:var(--slate);
    text-transform:uppercase;margin:0;
  }
  .표지 .꼭지::before{
    content:'';width:6px;height:6px;border-radius:50%;background:var(--coral);
    box-shadow:0 0 10px 1px rgba(var(--coral-rgb),.75);   /* 신호 = 면이 아니라 빛 */
  }
  .표지 h1{
    margin:.18em 0 0;font-size:clamp(3.2rem,10vw,6.6rem);font-weight:800;
    letter-spacing:-.052em;line-height:.93;
    background:linear-gradient(174deg,var(--cream) 0%,var(--cream) 44%,var(--slate) 118%);
    -webkit-background-clip:text;background-clip:text;color:transparent;
  }
  .표지 .한줄{
    margin:.7em 0 0;font-size:clamp(1.06rem,2.1vw,1.32rem);line-height:1.62;
    color:var(--cream);max-width:30ch;font-weight:450;letter-spacing:-.025em;
  }
  .표지 .메타{margin:0;font-size:.83rem;color:var(--slate);letter-spacing:-.012em;}
  @media (min-width:760px){
    .표지{grid-template-columns:112px minmax(0,1fr);align-items:start;gap:34px;}
  }

  /* ── 절 머리 — 유리 원판 번호 + 사라지는 실금 ───────────────────────────── */
  h2{
    display:flex;align-items:center;gap:.62em;flex-wrap:wrap;
    margin:4.2em 0 .85em;font-size:clamp(1.32rem,2.5vw,1.72rem);font-weight:800;
    letter-spacing:-.038em;line-height:1.24;color:var(--cream);
  }
  h2>span:not(.번호){flex:0 1 auto;min-width:0;}
  h2::after{
    content:'';flex:1 1 3em;min-width:2em;height:1px;
    background:linear-gradient(90deg,rgba(var(--cream-rgb),.24),rgba(var(--cream-rgb),0));
  }
  .번호{
    flex:none;width:2.05em;height:2.05em;border-radius:50%;position:relative;
    display:grid;place-items:center;
    font-size:.62em;font-weight:800;letter-spacing:0;color:var(--cream);
    background:
      linear-gradient(170deg,rgba(var(--cream-rgb),.14),rgba(var(--cream-rgb),.02) 58%),
      var(--유리막);
    box-shadow:inset 0 1px 0 rgba(var(--cream-rgb),.2),0 12px 22px -12px rgba(var(--그늘),.95);
  }
  .번호::before{
    content:'';position:absolute;inset:0;border-radius:50%;padding:1.4px;pointer-events:none;
    background:conic-gradient(from 208deg,
      ${림줄});
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;
    opacity:1;filter:saturate(1.6)
      drop-shadow(0 0 4px rgba(var(--kccoolblue-rgb),.5))
      drop-shadow(0 0 8px rgba(var(--coral-rgb),.28));
  }
  h3{margin:2.1em 0 .4em;font-size:1.02rem;font-weight:800;letter-spacing:-.028em;color:var(--cream);}
  h3::before{content:'';display:inline-block;width:14px;height:1px;vertical-align:middle;
    margin-right:.6em;background:rgba(var(--coral-rgb),.85);}

  /* ── 본문 ──────────────────────────────────────────────────────────────── */
  p{margin:.75em 0;color:var(--cream);}
  ul,ol{margin:.7em 0 1.1em;padding-left:1.3em;}
  li{margin:.42em 0;}
  li::marker{color:var(--slate);}
  b,strong{font-weight:750;color:var(--cream);}
  .흐린{color:var(--slate);}
  .작게{font-size:.9rem;}
  a{color:var(--cream);text-decoration:none;
    box-shadow:inset 0 -1px 0 rgba(var(--cream-rgb),.28);
    transition:box-shadow 180ms ease,color 180ms ease;}
  a:hover{color:var(--cream);box-shadow:inset 0 -1px 0 rgba(var(--coral-rgb),.9);}
  code{font-family:inherit;font-size:.93em;font-weight:600;color:var(--cream);
    background:rgba(var(--cream-rgb),.085);
    padding:.1em .45em;border-radius:7px;
    box-shadow:inset 0 0 0 1px rgba(var(--cream-rgb),.09);}

  /* 콜아웃 — 유리 판 + 왼쪽에 세운 빛 한 줄 */
  .알림{margin:22px 0;padding:20px 24px;font-size:.96rem;overflow:hidden;}
  .알림::after{content:'';position:absolute;left:0;top:14%;bottom:14%;width:2px;border-radius:2px;
    background:linear-gradient(180deg,rgba(var(--coral-rgb),0),rgba(var(--coral-rgb),.95),rgba(var(--coral-rgb),0));
    box-shadow:0 0 14px 1px rgba(var(--coral-rgb),.5);}
  .알림.조용::after{background:linear-gradient(180deg,rgba(var(--slate-rgb),0),rgba(var(--slate-rgb),.8),rgba(var(--slate-rgb),0));
    box-shadow:none;}

  blockquote{margin:1.4em 0;padding:22px 26px;font-size:.97rem;color:var(--slate);}
  blockquote i,blockquote em{color:var(--cream);font-style:italic;}

  /* ── 표 = 유리판 위의 실금 ───────────────────────────────────────────────── */
  .표틀{margin:1.5em 0;padding:6px;overflow-x:auto;}
  table{border-collapse:separate;border-spacing:0;width:100%;font-size:.93rem;}
  th,td{padding:.78em .9em;text-align:left;vertical-align:top;color:var(--cream);}
  thead th{
    font-weight:800;letter-spacing:-.02em;font-size:.8rem;text-transform:none;color:var(--cream);
    background:rgba(var(--cream-rgb),.055);
  }
  thead th:first-child{border-radius:var(--깃속) 0 0 var(--깃속);}
  thead th:last-child{border-radius:0 var(--깃속) var(--깃속) 0;}
  tbody td{border-top:1px solid var(--금);}
  tbody tr:first-child td{border-top:0;}
  tbody tr:hover td{background:rgba(var(--cream-rgb),.028);}

  /* ── 레일 = 유리 알약 메뉴 ───────────────────────────────────────────────── */
  .레일{display:none;}
  .레일 .꼭지{font-size:.66rem;font-weight:700;letter-spacing:.2em;color:var(--slate);
    text-transform:uppercase;margin:0 0 14px;padding-left:14px;}
  .레일 ol{list-style:none;margin:0;padding:0;display:grid;gap:2px;}
  .레일 a{
    display:flex;align-items:center;gap:.6em;position:relative;
    padding:.44em .8em .44em .78em;border-radius:11px;
    font-size:.845rem;line-height:1.35;color:var(--slate);box-shadow:none;
    transition:color 190ms ease,background 190ms ease;
  }
  .레일 a .n{font-size:.78em;opacity:.75;flex:none;width:1.5em;}
  .레일 a:hover{color:var(--cream);background:rgba(var(--cream-rgb),.05);}
  .레일 a.여기{
    color:var(--cream);font-weight:700;
    background:linear-gradient(170deg,rgba(var(--cream-rgb),.13),rgba(var(--cream-rgb),.03)),var(--유리막);
    box-shadow:inset 0 1px 0 rgba(var(--cream-rgb),.18),0 10px 20px -12px rgba(var(--그늘),.9);
  }
  .레일 a.여기::after{
    content:'';position:absolute;left:-9px;top:50%;transform:translateY(-50%);
    width:3px;height:16px;border-radius:3px;background:var(--coral);
    box-shadow:0 0 12px 1px rgba(var(--coral-rgb),.8);
  }

  .접이차례{margin:24px 0;font-size:.92rem;}
  .접이차례 summary{cursor:pointer;font-weight:800;letter-spacing:-.02em;color:var(--cream);}
  .접이차례 a{margin-right:.15em;}

  @media (min-width:1060px){
    .판{grid-template-columns:214px minmax(0,1fr);}
    .레일{display:block;position:sticky;top:40px;align-self:start;padding:34px 0 0;}
    .접이차례{display:none;}
  }

  footer{margin:5em 0 0;padding:26px 0 0;color:var(--slate);font-size:.87rem;
    border-top:1px solid var(--금);}

  /* ── 모션 — 절제(DESIGN.md 감각 규칙: transform/opacity만·300ms 상한·reduced-motion 존중) */
  /* ⚠숨김은 «JS 가 살아 있을 때만» 건다 — html.js 게이트가 없으면 스크립트가 한 번만 안 돌아도
     문서가 통째로 빈 화면이 된다(홈페이지 트랙 실측). 그 클래스는 스킨 직후 인라인 한 줄이 건다. */
  html.js .듦{opacity:0;transform:translate3d(0,14px,0);}
  html.js .듦.왔다{opacity:1;transform:none;
    transition:opacity 280ms cubic-bezier(.22,.61,.36,1),transform 280ms cubic-bezier(.22,.61,.36,1);}
  @media (prefers-reduced-motion:reduce){
    html{scroll-behavior:auto;}
    html.js .듦,html.js .듦.왔다{opacity:1;transform:none;transition:none;}
    *{animation:none!important;}
  }

  @media print{
    body{background:var(--navy2);}
    .레일{display:none;} .판{display:block;padding:0;}
    .유리{break-inside:avoid;-webkit-backdrop-filter:none;backdrop-filter:none;}
    h2{break-after:avoid;}
    @page{margin:12mm;}
    *{print-color-adjust:exact;-webkit-print-color-adjust:exact;}
  }
</style>`;
}

/** 레일 현재 절 표시 + 절 등장(외부 의존 0 · reduced-motion 은 CSS 가 이미 끈다). */
function 스크립트() {
  return `<script>document.documentElement.classList.add('js');</script>
<script>
// ⚠스킨은 표식 자리(문서 머리)에 주입되므로 이 시점엔 본문이 아직 없다 — 파싱이 끝난 뒤 건다.
(function(준비){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',준비);
  else 준비();
})(function(){
  // 부드러운 이동은 «누른» 것에만 — 로드 시 앵커 진입은 즉시 자리를 잡는다.
  var 잔잔 = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click',function(e){
    var a=e.target.closest && e.target.closest('a[href^="#"]');
    if(!a||잔잔)return;
    var 표적=document.getElementById(a.getAttribute('href').slice(1));
    if(!표적)return;
    e.preventDefault();표적.scrollIntoView({behavior:'smooth',block:'start'});
    if(history.replaceState)history.replaceState(null,'',a.getAttribute('href'));
  });
  var 링크=[].slice.call(document.querySelectorAll('.레일 a[href^="#"]'));
  var 표={};링크.forEach(function(a){var s=document.getElementById(a.hash.slice(1));if(s)표[a.hash.slice(1)]=a;});
  if(링크.length&&'IntersectionObserver' in window){
    var 눈=new IntersectionObserver(function(들){
      들.forEach(function(e){
        if(e.isIntersecting){링크.forEach(function(a){a.classList.remove('여기');});표[e.target.id].classList.add('여기');}
      });
    },{rootMargin:'-12% 0px -78% 0px',threshold:0});
    Object.keys(표).forEach(function(id){눈.observe(document.getElementById(id));});
  }
  var 들 = [].slice.call(document.querySelectorAll('.듦'));
  if(!들.length)return;
  var 깨움=function(el){el.classList.add('왔다');};
  if(!('IntersectionObserver' in window)){들.forEach(깨움);return;}
  // ⚠«이미 지나간» 것을 먼저 깨운다 — 앵커(#s3)로 바로 들어오면 그 위 절들은 영영 교차하지
  //   않아서 자리만 차지한 채 투명하게 남는다(실측: 빈 화면 1,400px). 숨김의 대가는 이 자리다.
  var 남을것=[];
  들.forEach(function(el){
    if(el.getBoundingClientRect().top < window.innerHeight*1.15) 깨움(el); else 남을것.push(el);
  });
  if(!남을것.length)return;
  var 등장=new IntersectionObserver(function(항목,자기){
    항목.forEach(function(e){if(e.isIntersecting){깨움(e.target);자기.unobserve(e.target);}});
  },{rootMargin:'0px 0px -8% 0px',threshold:.01});
  남을것.forEach(function(el){등장.observe(el);});
  // 최후 안전판 — 관찰자가 어떤 이유로든 안 돌면(확대·인쇄·기이한 뷰포트) 전부 드러낸다.
  setTimeout(function(){남을것.forEach(깨움);},4000);
});
</script>`;
}

function 굽기(입력, 출력, 쓸천, 림) {
  const 원문 = fs.readFileSync(입력, 'utf8');
  if (!원문.includes(표식)) throw new Error('표식이 없다 — 입력 HTML 에 ' + 표식 + ' 한 줄을 둔다: ' + 입력);
  const 결과 = 원문.replace(표식, 스킨(쓸천, 림) + '\n' + 스크립트());
  fs.mkdirSync(path.dirname(출력), { recursive: true });
  fs.writeFileSync(출력, 결과, 'utf8');
  return { 바이트: Buffer.byteLength(결과, 'utf8') };
}

/** 자립성 — 외부에서 끌어오는 «그림»이 하나라도 있으면 첨부 단독일 때 전멸한다. */
function 검사(파일) {
  const 원문 = fs.readFileSync(파일, 'utf8');
  const 흠 = [];
  if (원문.includes(표식)) 흠.push('스킨이 아직 안 구워졌다(표식이 남아 있다)');
  const 상대그림 = [...원문.matchAll(/<img[^>]+src="(?!data:)([^"]+)"/g)].map((m) => m[1]);
  if (상대그림.length) 흠.push('인라인 안 된 그림 ' + 상대그림.length + '개: ' + 상대그림.slice(0, 3).join(', '));
  const 외부 = [...원문.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  const 폰트밖 = 외부.filter((u) => !/fonts\.googleapis|SUIT-Variable/.test(u));
  if (폰트밖.length) 흠.push('폰트 밖 외부 자원 ' + 폰트밖.length + '개: ' + 폰트밖.slice(0, 3).join(', '));
  return { 흠, 외부폰트: 외부.length - 폰트밖.length, 바이트: Buffer.byteLength(원문, 'utf8') };
}

if (require.main === module) {
  const 인자 = process.argv.slice(2);
  const 모드 = 인자[0];
  const 림들 = 인자.indexOf('--림');
  const 림 = 림들 >= 0 ? 인자[림들 + 1] : '스펙트럼';
  const 남은 = 림들 >= 0 ? 인자.filter((_, i) => i !== 림들 && i !== 림들 + 1) : 인자;
  try {
    if (모드 === '--굽기') {
      const [, 입력, 출력, ...천들] = 남은;
      if (!입력 || !출력) throw new Error('용법: node tools/펠트문서.js --굽기 <입력.html> <출력.html> [천…] [--림 무채]');
      const r = 굽기(입력, 출력, 천들, 림);
      console.log('■ 지면 스킨 주입  %s → %s  (%sKB · 림 %s)',
        path.relative(루트, 입력), path.relative(루트, 출력), (r.바이트 / 1024).toFixed(1), 림);
      const c = 검사(출력);
      if (c.흠.length) { console.log('   🔴 자립성 흠 %d건:', c.흠.length); c.흠.forEach((h) => console.log('      · ' + h)); process.exit(1); }
      console.log('   ✅ 자립형 — 인라인 안 된 그림 0 · 외부는 폰트 %d개뿐(없으면 system-ui 로 내려앉는다)', c.외부폰트);
    } else if (모드 === '--검사') {
      const c = 검사(남은[1]);
      console.log('■ %s  %sKB', 남은[1], (c.바이트 / 1024).toFixed(1));
      if (c.흠.length) { c.흠.forEach((h) => console.log('   🔴 ' + h)); process.exit(1); }
      console.log('   ✅ 자립형 (외부 = 폰트 %d개)', c.외부폰트);
    } else if (모드 === '--대비') {
      const 줄 = 대비판정();
      console.log('■ 검은 무대 대비 — 유리는 «층 합성»으로, 펠트는 «결 p1/p99»로 잰다');
      console.log('   (브랜드렌더린트는 배경이 그라디언트·이미지면 판정을 포기한다 — 그 분모를 이 표가 진다)');
      let 실패 = 0;
      for (const r of 줄) {
        if (r.흠) { console.log('   🔴 ' + 채움(r.글자, 8) + ' on ' + 채움(r.면, 9) + '  ' + r.흠); 실패++; continue; }
        if (!r.통과) 실패++;
        console.log('   ' + (r.통과 ? '✅' : '🔴') + ' ' + 채움(r.글자, 8) + ' on ' + 채움(r.면, 9)
          + '  ' + 채움(r.최악.toFixed(2), 5) + ':1  (기준 ' + r.기준.toFixed(1) + ' · ' + 채움(r.방식, 9) + ')  ' + r.자리);
      }
      console.log('   합계 ' + 줄.length + '짝 = 통과 ' + (줄.length - 실패) + ' + 미달 ' + 실패
        + '  ·  안 잰 짝 0 — 스킨이 쓰는 글자×면 전량');
      if (실패) process.exit(1);
    } else if (모드 === '--스킨') {
      console.log(스킨(남은.slice(1), 림));
    } else {
      console.log('용법:\n  node tools/펠트문서.js --굽기 <입력.html> <출력.html> [천…] [--림 스펙트럼|무채]\n' +
        '  node tools/펠트문서.js --검사 <문서.html>\n  node tools/펠트문서.js --대비\n' +
        '  node tools/펠트문서.js --스킨 [천…]');
      process.exit(2);
    }
  } catch (e) { console.error('🔴 ' + e.message); process.exit(1); }
}

module.exports = { 스킨, 굽기, 검사, 대비판정, 표식, 기본천, 림레시피 };
