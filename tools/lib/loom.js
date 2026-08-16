#!/usr/bin/env node
/**
 * Loom — SYNK 그래픽 엔진의 «공용 통로» (부품 · 율 · 재질)
 *
 * 무엇: 어느 지면(문서·캐러셀·인쇄물·홈페이지·앱 화면)이든 **같은 부품·같은 여백·같은 재질**을
 *       입도록 CSS 를 내는 단 하나의 자리. 값은 전부 `docs/디자인_토큰.json` 에서 온다
 *       — 이 파일에 hex·px 원본은 없다(중복 정본 금지).
 *
 * 왜 새 파일인가 (실측 2026-08-16):
 *   Loom 지면 스킨(`tools/펠트문서.js`)은 이미 정교한데 **93개 HTML 중 6개**(엔진 소개서)에만 닿아 있었다.
 *   캐러셀 8벌·인쇄본빌드·발표물빌드·브랜드킷조립은 전부 자기 CSS 를 손으로 지녔다.
 *   원인은 「스킨이 부족해서」가 아니라 **스킨이 «문서 한 벌»로 통짜라 다른 지면이 조각을 못 가져간다**는 것이다.
 *   캐러셀은 레일도 표지도 필요 없고 «번호와 불릿»만 필요하다 — 통짜는 그걸 못 준다.
 *   그래서 부품을 조각으로 빼낸다. F472 그대로의 자리다: 정본에 값을 두는 것만으로는 안 되고
 *   **누군가 그 값을 읽어야** 정본이 살아 있다 — 읽는 자리를 여러 지면이 쓸 수 있는 모양으로 만든다.
 *
 * 설계 축 셋 (유호 지시 2026-08-16)
 *   ① **부품** — 「1번 2번조차 텍스트가 아닌 재질로」. 지면의 작은 것 전량이 재질을 입는다.
 *      🔑 **CSS counter 로 «자동»이다** — 원고에 `<h2>제목</h2>` 만 써도 유리 원판 번호가 선다.
 *         번호를 손으로 적게 두면 그 순간 지면마다 갈리고, 갈리면 시스템이 아니다.
 *   ② **율** — 「모든 여백에는 이유가 있어야 한다」. 간격이 이름을 갖는다(실·숨·틈·참·칸·단·켜·장·막).
 *      이름이 있으면 「여기 왜 24px?」에 답할 수 있고, 답할 수 없는 간격은 애초에 안 쓰게 된다.
 *   ③ **재질 3종** — 펠트(먹는다)·유리(통과시킨다)·레진(가둔다). 물성으로 위계를 낸다.
 *      DESIGN.md §1 「위계는 색이 아니라 밀도」의 확장 — 밀도 → 물성.
 *
 * 대가 — 틀릴 때의 모습 (지침 v9.2 맹점 ④: 장치는 «맞는 얼굴로 틀린 값»으로 더 자주 샌다)
 *   · **부품 목록에만 늘고 CSS 가 안 따라오면 조용히 텍스트로 남는다.** 화면은 멀쩡해 보인다.
 *     → 닫은 방식 = `--분모`. 토큰 목록과 실제 생성 CSS 의 마커를 대조해 «구현 안 된 부품»을 이름째 센다.
 *   · **counter 는 «가짜 번호»를 만든다** — HTML 에 없던 번호가 생기므로 스크린리더·복사에 안 잡힌다.
 *     → 닫은 방식 = 번호를 `::before` 가 아니라 «있으면 그 span, 없으면 counter» 두 판으로 낸다
 *       (`.번호` 요소가 있으면 그것이 이기고, 없을 때만 counter 가 선다).
 *   · **낮 지면(인쇄)에서 레진은 원리적으로 약해진다** — glow·blur 가 종이에 안 실린다.
 *     → 닫은 방식 = 낮 판은 코어를 «면»으로 굳히고 굴절밴드를 «선»으로 굳힌다(구슬로 읽히게).
 *       못 닫은 것 = 코스틱(샌 빛)은 낮에 사라진다. 그건 종이의 한계라 억지로 안 흉내낸다.
 *
 * 통로:
 *   node tools/lib/loom.js --css [지면]      # 지면 = 문서(기본)·캐러셀·인쇄·웹·전량
 *   node tools/lib/loom.js --분모            # 부품 목록 대비 구현 수 (0은 분모와 함께)
 *   node tools/lib/loom.js --율              # 여백 사다리를 사람이 읽는 표로
 */
'use strict';

const fs = require('fs');
const path = require('path');

const 루트 = path.resolve(__dirname, '..', '..');
const 토큰길 = path.join(루트, 'docs', '디자인_토큰.json');
const 구운길 = path.join(루트, 'docs', 'Loom_자산', '구운재질.json');

function 정본() {
  const t = JSON.parse(fs.readFileSync(토큰길, 'utf8'));
  const 색 = {};
  for (const c of t['색']['킷']) 색[c['이름']] = c['hex'];
  return { 색, 율: t['율'], 재질: t['재질'], 부품: t['부품'], 서체: t['서체'] };
}

/* ── 색 유틸 ──────────────────────────────────────────────────────────────── */
const 변수이름 = (이름) => '--' + String(이름).toLowerCase().replace(/\s+/g, '');
function rgb(hex) {
  const n = String(hex).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
/** rgba(…) 문자열 — 색 «이름»을 받는다(hex 를 직접 받지 않는 것이 이 파일의 규율이다). */
function 알파(색, 이름, a) {
  if (!색[이름]) throw new Error('킷에 없는 색 이름: ' + 이름);
  return `rgba(${rgb(색[이름]).join(',')},${a})`;
}

/* ── 부품 마커 ─────────────────────────────────────────────────────────────
   생성된 CSS 안에 부품 이름을 심는다 — `--분모` 가 이것을 세어 토큰 목록과 대조한다.
   ⚠주석이라 지워도 렌더는 멀쩡하다(그래서 «새는 방향은 통과»다) — 회귀가 그 자리를 진다. */
const 마커 = (이름) => `/*loom부품:${이름}*/`;

/* ══════════════════════════════════════════════════════════════════════════
   ① 율 — 여백·광학 변수
   ══════════════════════════════════════════════════════════════════════════ */
function 율(t = 정본()) {
  const 단 = Object.entries(t.율['단계'])
    .map(([이름, v]) => `    --${이름}:${v.px}px;   /* ${v.직책} */`).join('\n');
  return `  /* ── 율 — 모든 간격이 여기서 나온다. 이름 없는 px 을 지면에 적지 않는다.
     4px 기반 ×1.5 근사 — 인접 두 단이 눈에 갈려야 «고른» 것이 된다. */
  :root{
${단}
    /* 사다리 — 장 ≥ 켜×1.5 ≥ 단×2.5 (깨지면 문서가 한 덩어리로 읽힌다) */
    --제목위:3.5em; --제목아래:.85em;      /* 위>아래 3:1 — 제목은 «다음 것»에 붙는다 */
    --줄본문:1.72; --줄제목:1.24; --줄히어로:.93;
  }`;
}

/* ══════════════════════════════════════════════════════════════════════════
   ② 재질 — 유리·레진·펠트의 CSS 서명
   ══════════════════════════════════════════════════════════════════════════ */

/** 유리 — 몸은 어둡고 «테두리만 형형»하다. 밝히면 반투명 카드가 된다. */
function 유리몸(색, 유 , 림줄) {
  return `
  .유리{
    position:relative;border-radius:var(--깃);
    background:
      linear-gradient(176deg, ${알파(색, 'Cream', .11)} 0%, ${알파(색, 'Cream', .022)} 26%,
                     rgba(0,0,0,.06) 62%, rgba(0,0,0,.14) 100%),
      ${알파(색, 'Navy Ink', 유['몸알파'])};
    -webkit-backdrop-filter:blur(${유['흐림px']}px) saturate(${유['채도배'] * 100}%);
    backdrop-filter:blur(${유['흐림px']}px) saturate(${유['채도배'] * 100}%);
    box-shadow:
      inset 0 1px 0 ${알파(색, 'Cream', 유['윤'])},
      inset 0 -1px 0 ${알파(색, 'Cream', 유['윤약'])},
      0 1px 2px rgba(0,0,0,.6),
      0 30px 60px -28px rgba(0,0,0,1);
    padding:var(--단) calc(var(--단) + var(--숨));
  }
  /* 분산 림 — 유리 가장자리에서 파장이 갈라진다. 테두리 «두께만» 남기는 마스크 xor. */
  .유리::before{
    content:'';position:absolute;inset:0;border-radius:inherit;
    padding:${유['림두께px']}px;pointer-events:none;z-index:1;
    background:conic-gradient(from 208deg,${림줄});
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;
    opacity:.95;
    filter:saturate(1.5) drop-shadow(0 0 5px ${알파(색, 'KC Cool Blue', .34)})
           drop-shadow(0 0 10px ${알파(색, 'Coral', .2)});
  }
  .유리>*{position:relative;z-index:2;}
  .유리.잔잔{--깃:16px;padding:var(--칸) var(--단);}
  .유리.잔잔::before{opacity:.72;}`;
}

/**
 * 레진 — 유리와 갈리는 것은 «두께»다. 유리는 뒤가 비쳐서 유리고, 레진은 안에 빛이 «갇혀서» 레진이다.
 * 다섯 겹 전부 있어야 한다(하나만 빠져도 그냥 유리로 읽힌다):
 *   ①몸(무채 반투명) ②굴절밴드(두꺼운 inset — «두께»의 유일한 단서) ③코어(중심보다 위의 갇힌 빛)
 *   ④표면스펙(코어와 «따로» 있는 바깥 광원의 상) ⑤코스틱(바닥으로 샌 유채 빛)
 * @param 빛 갇힌 빛의 색 «이름» — 몸에는 안료를 안 칠하므로 색은 여기서만 나온다.
 */
function 레진몸(색, 레, 빛 = 'Cream') {
  const [r1, r2] = 레['굴절밴드px'];
  return `
    background:
      radial-gradient(${레['코어반경비'] * 100}% ${레['코어반경비'] * 100}% at 50% ${50 - 레['코어상향비'] * 100}%,
        ${알파(색, 빛, .58)} 0%, ${알파(색, 빛, .12)} 62%, ${알파(색, 빛, 0)} 78%),
      ${알파(색, 'Navy Ink', 레['몸알파'])};
    box-shadow:
      inset 0 0 0 1px ${알파(색, 'Cream', .1)},
      inset 0 ${r1}px ${r2}px -${r1}px ${알파(색, 빛, .45)},
      inset 0 -${r1}px ${r2}px -${Math.round(r1 * 0.7)}px rgba(0,0,0,.58),
      0 ${Math.round(레['코스틱퍼짐px'] * 0.43)}px ${레['코스틱퍼짐px']}px -${r1 + 1}px ${알파(색, 빛, 레['코스틱알파'])};`;
}
/** 레진 ④표면스펙 — 물체 «밖»의 광원이 표면에 맺힌 상. 코어와 분리돼야 두께가 읽힌다. */
const 레진스펙 = `
    content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    background:radial-gradient(30% 22% at 38% 16%, rgba(255,255,255,.85), rgba(255,255,255,0) 70%);`;

/* ══════════════════════════════════════════════════════════════════════════
   ③ 부품 — 지면의 «작은 것» 전량
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 번호 부품 — 절번호·순번·각주·차례.
 * 🔑 **counter 가 기본값이다.** 원고가 번호를 안 적어도 선다 — 손으로 적게 두면 지면마다 갈린다.
 *    다만 `.번호` span 이 «있으면» 그것이 이긴다(옛 원고·수동 번호 호환 · 접근성).
 */
function 번호들(색, 유, 림줄) {
  /* ⚠원판·원판림은 **position 을 정하지 않는다** — 호출부가 정한다.
     실측 08-16: 원판 안에 position:relative 가 있어서, 호출부가 앞에 쓴 position:absolute 를
     «나중에 오는 것이 이겨» 덮었다(ol 순번 원판이 제자리에 안 앉았는데 렌더는 멀쩡해 보였다).
     ⚠광학 보정을 `%` 로 주지 않는다 — CSS 백분율 패딩은 **부모의 «너비»** 기준이라,
     34.97px 원판에 h2 폭 790px 의 1.5% = **11.86px** 이 들어갔다(실측 08-16 · 「맞는 얼굴로 틀린 값」).
     실측한 어긋남 = font-size 의 **1.25%**(canvas 잉크 경계 vs line box 중앙 · 폴백 system-ui 기준).
     패딩은 중앙을 «절반»만 미므로 집행값은 그 2배인 .025em 이다. */
  /* ⚠그림자는 «매개변수»다 — 호출부가 뒤에 box-shadow 를 또 쓰면 같은 속성이 두 번 나온다.
     렌더는 뒤가 이겨서 의도대로 보이지만, 그 중복이 쌓이면 어느 쪽이 사는지 못 읽게 된다
     (실측 08-16: `.각주` 는 font-size 도 겹쳐서 원판 크기를 .6em 으로 잡고 글자만 .62em 이었다). */
  const 원판 = (크기, 글자, 그늘) => `
    flex:none;width:${크기};height:${크기};border-radius:50%;
    display:inline-grid;place-items:center;padding-bottom:.025em;
    font-size:${글자};font-weight:800;letter-spacing:0;font-variant-numeric:tabular-nums;
    color:var(--cream);
    background:
      linear-gradient(170deg, ${알파(색, 'Cream', .14)}, ${알파(색, 'Cream', .02)} 58%),
      ${알파(색, 'Navy Ink', 유['몸알파'])};
    box-shadow:${그늘 || `inset 0 1px 0 ${알파(색, 'Cream', .2)},0 12px 22px -12px rgba(0,0,0,.95)`};`;
  const 원판림 = (두께) => `
    content:'';border-radius:50%;padding:${두께}px;pointer-events:none;
    background:conic-gradient(from 208deg,${림줄});
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;
    filter:saturate(1.6) drop-shadow(0 0 4px ${알파(색, 'KC Cool Blue', .5)})
           drop-shadow(0 0 8px ${알파(색, 'Coral', .28)});`;

  return `
  ${마커('절번호')}
  /* 절번호 — 원고가 번호를 안 적어도 counter 가 세운다. .번호 span 이 있으면 그것이 이긴다. */
  .글,article,body{counter-reset:절;}
  h2{counter-increment:절;
     display:flex;align-items:center;gap:calc(var(--숨) * 2.5);flex-wrap:wrap;
     margin:var(--제목위) 0 var(--제목아래);
     font-size:clamp(1.32rem,2.5vw,1.72rem);font-weight:800;
     letter-spacing:-.038em;line-height:var(--줄제목);color:var(--cream);}
  h2>span:not(.번호){flex:0 1 auto;min-width:0;}
  h2:not(:has(.번호))::before{content:counter(절,decimal-leading-zero);position:relative;${원판('2.05em', '.62em')}}
  h2:not(:has(.번호))::after{content:'';flex:1 1 3em;min-width:2em;height:var(--실);
     background:linear-gradient(90deg,${알파(색, 'Cream', .24)},${알파(색, 'Cream', 0)});}
  .번호{position:relative;${원판('2.05em', '.62em')}}
  .번호::before{position:absolute;inset:0;${원판림(유['림원판두께px'])}}

  ${마커('순번')}
  /* 순번 — ol 의 1·2·3. 브라우저 기본 마커를 끄고 유리 원판으로 세운다(유호 지시의 정확한 자리). */
  ol{list-style:none;counter-reset:순번;padding-left:0;margin:var(--단) 0;}
  ol>li{counter-increment:순번;position:relative;
        padding-left:calc(1.55em + var(--칸));margin:var(--참) 0;min-height:1.55em;}
  ol>li::before{content:counter(순번);position:absolute;left:0;top:.06em;${원판('1.55em', '.72em')}}
  /* ⚠림에도 «같은» font-size 를 준다 — em 은 자기 font-size 기준이라, .72em 이 걸린 ::before 는
     1.55em=18.97px 인데 안 걸린 ::after 는 1.55em=26.34px 이었다(실측 08-16). 림이 원판보다 컸다. */
  ol>li::after{position:absolute;left:0;top:.06em;font-size:.72em;
    width:1.55em;height:1.55em;${원판림(1.1)}}

  ${마커('차례번호')}
  .잔번호{position:relative;${원판('1.35em', '.66em', `inset 0 1px 0 ${알파(색, 'Cream', .16)}`)}}

  ${마커('각주번호')}
  .각주{position:relative;${원판('1.25em', '.62em', `inset 0 1px 0 ${알파(색, 'Cream', .16)}`)}
    vertical-align:super;}`;
}

/** 불릿·체크·히어로수 — 레진 계열. 반복되는 것은 무채 빛, 1점짜리만 코랄. */
function 레진부품(색, 레) {
  return `
  ${마커('불릿')}
  /* 불릿 — 지면에서 가장 많이 반복되는 부품이라 가장 작게(7px) 쓴다.
     ⚠갇힌 빛이 무채인 이유: 수십 개가 코랄이면 «신호 1점»이 죽는다(철칙 ④). */
  ul{list-style:none;padding-left:0;margin:var(--단) 0;}
  ul>li{position:relative;padding-left:calc(var(--칸) + var(--참));margin:var(--숨) 0;}
  ul>li::before{
    content:'';position:absolute;left:var(--숨);top:.62em;   /* x-height 중앙 — 행 중앙이 아니다 */
    width:7px;height:7px;border-radius:50%;${레진몸(색, 레, 'Cream')}
  }
  ul>li::after{content:'';position:absolute;left:var(--숨);top:.62em;width:7px;height:7px;
    border-radius:50%;pointer-events:none;
    background:radial-gradient(34% 26% at 36% 18%, rgba(255,255,255,.9), rgba(255,255,255,0) 70%);}

  ${마커('체크')}
  .체크{display:inline-grid;place-items:center;position:relative;
    width:1.3em;height:1.3em;border-radius:50%;flex:none;padding-bottom:.025em;
    font-size:.72em;font-weight:800;color:var(--cream);${레진몸(색, 레, 'Cream')}}
  .체크::before{${레진스펙}}

  ${마커('히어로수')}
  /* 히어로수 — 지면당 «1점». 가장 센 물성이라 둘이면 서로를 죽인다.
     여기서만 갇힌 빛이 코랄이다 — 면이 아니라 «속의 빛»이라 신호 1점 규율 안에 든다.
     ⚠padding 은 광학 보정(.025em)까지 한 줄에 — 뒤에 따로 쓰면 이 줄이 그것을 덮는다. */
  .히어로수{display:inline-grid;place-items:center;position:relative;
    min-width:2.6em;height:2.6em;padding:0 var(--참) .025em;border-radius:999px;
    font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;letter-spacing:-.04em;
    font-variant-numeric:tabular-nums;color:var(--cream);${레진몸(색, 레, 'Coral')}}
  .히어로수::before{${레진스펙}}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   ②-b 구운 재질 — CSS 흉내를 «렌더한 사진»으로 덮는다 (v1.3 · 2026-08-16)

   왜 이 층이 따로 있나:
     헌법 ①은 「결은 사진 픽셀에서만 · 프로시저럴은 매끈한 왁스로 읽혀 기각」인데
     v1.0 은 **펠트만 그것을 지켰다** — 위 유리·레진은 `linear-gradient`+`backdrop-filter`,
     즉 5~6년 전 글래스모피즘이자 지금 AI 툴의 기본 산출이었다(F498 · 유호 「너무 싸구려 AI처럼」).
     처방 = 「사진이 없는 재질의 «사진»은 렌더다」. `tools/룸굽기.js` 가 Blender Cycles 로
     굴절·분산·코스틱·박막을 **실제로 계산해** 굽고, 이 층이 그것을 지면에 얹는다.

   설계 결정 셋 (전부 실패 모드에서 나왔다):
     ① **덮되 지우지 않는다.** 위 CSS 층은 그대로 두고 이 층이 뒤에 와서 이긴다.
        자산이 없는 환경(굽기 전·다른 기계)에서 지면이 «빈 칸»이 되지 않는다.
     ② **base64 로 지면 «안»에 산다.** 외부 파일 참조는 첨부 단독으로 열린 지면에서
        전멸했다(홈페이지 트랙 실측 08-15 · 그림 7/7). 경로는 지면마다 다르고, 다르면 깨진다.
     ③ **두 층(몸 + 접지)으로 얹는다.** 설계 §3-4 ⚠ 는 「③뒤·⑥합주는 지면 배경을 알아야
        성립 → 한 번 굽고 아무 데나 붙이기와 원리적으로 충돌」이라 적었다. 그 충돌의 절반은
        **접지**다 — 그림자·코스틱이 몸에 구워져 있으면 배경이 바뀔 때마다 다시 구워야 한다.
        갈라 놓으면 지면이 그림자만 따로 얹어 배경마다 다시 굽지 않아도 접지가 맞는다.
        (굴절에 비친 «뒤»는 여전히 무대의 것이라 충돌이 사라지진 않는다 — 절반이 열린 것이고,
         그 절반이 지면 «수»만큼 곱해지던 쪽이다.)

   대가 — 틀릴 때의 모습:
     · **자산이 낡아도 지면은 멀쩡해 보인다.** 구운재질.json 이 옛 판이면 아무도 안 운다.
       → 닫은 방식 = `--분모` 가 부품별로 «구움/흉내»를 이름째 낸다(0은 분모와 함께).
     · **지면이 무거워진다.** 부품 수만큼 곱해지는 것이 아니라 «부품 종류» 수만큼 붙는다
       (같은 data URI 는 브라우저가 한 번만 디코드한다). 실측 무게는 분모가 낸다.
   ══════════════════════════════════════════════════════════════════════════ */

/** 구운 자산을 읽는다 — 없으면 `null`(그럼 이 층 전체가 안 나가고 CSS 흉내가 산다). */
function 구운재질() {
  try {
    if (!fs.existsSync(구운길)) return null;
    const j = JSON.parse(fs.readFileSync(구운길, 'utf8'));
    return j && j['부품'] && Object.keys(j['부품']).length ? j : null;
  } catch (e) {
    return null;
  }
}

/**
 * 한 부품의 «배경 두 줄» — 몸이 위, 접지가 아래.
 * ⚠접지를 `multiply` 로 섞지 않는다 — 알파 PNG 라 이미 어두운 값만 들었고,
 *   블렌드를 걸면 지면 배경색에 따라 그림자가 «색»을 가져간다(무채 규율 위반).
 */
function 얹기(p, { 크기 = 'contain', 접지 = true } = {}) {
  const 층 = [`url("${p['몸']}")`];
  const 사이즈 = [크기];
  if (접지 && p['층'] === 2 && p['접지']) { 층.push(`url("${p['접지']}")`); 사이즈.push(크기); }
  return `background-image:${층.join(',')};
    background-size:${사이즈.join(',')};background-position:center;background-repeat:no-repeat;
    background-color:transparent;`;
}

/**
 * 구움층 — 있는 자산만 덮는다.
 * 🔑 선택자는 위 CSS 와 **같은 자리**를 겨눈다. 새 부품을 짓는 것이 아니라 재질만 갈아끼운다
 *    (지오메트리·위치·counter 배선은 이미 맞고, 틀린 것은 «무엇으로 그렸나» 하나뿐이었다).
 */
/**
 * 구움표 — **부품 ↔ 자산 ↔ CSS 를 한 자리에** 적는다.
 * 🔑 갈라 적으면 갈라진다(지침: 같은 판정을 두 곳에 적으면 목록은 하나에서 파생한다).
 *    첫 판은 `구움층` 과 `분모` 가 각자 표를 지녀서, **CSS 규칙이 없는 「링크점」이 초록으로 셌다**
 *    — 자산이 구워졌다는 것과 지면이 그것을 쓴다는 것은 다른 사실인데 한 낱말로 뭉쳤다.
 *    이제 분모는 이 표에서 «CSS 를 실제로 낸 것»만 구움으로 센다.
 * ⚠`마커()` 를 여기 쓰지 않는다 — 마커는 «부품 목록»의 분모라, 재질 교체가 새 부품처럼 세어진다.
 */
const 구움표 = [
  { 부품: ['절번호', '순번', '차례번호', '각주번호'], 자산: '원판', css: (P) => `
  /* 번호 원판 — 지면에서 가장 많이 도는 «각진» 부품이라 모따기가 여기서 값을 한다.
     날카로운 모서리는 CG 티의 1순위인데, 35px 로 줄여도 모따기 하이라이트의 실선은 살아남는다. */
  h2:not(:has(.번호))::before,.번호,ol>li::before,.잔번호,.각주{
    ${얹기(P['원판'])}
    box-shadow:0 12px 22px -12px rgba(0,0,0,.95);}
  /* 분산 림은 이제 **렌더 안**에 산다 — conic-gradient 흉내를 끈다(둘이 겹치면 테가 두 겹이 된다). */
  .번호::before,ol>li::after{display:none;}` },

  { 부품: ['불릿', '체크'], 자산: '레진구_무채', css: (P) => `
  /* 불릿·체크 — 헌법 「반복 부품의 갇힌 빛은 무채」. 코랄이 갇히는 것은 히어로 1점뿐이다. */
  ul>li::before{${얹기(P['레진구_무채'])}box-shadow:none;}
  ul>li::after{display:none;}          /* 표면스펙도 렌더 안에 있다 */
  .체크{${얹기(P['레진구_무채'])}box-shadow:none;}
  .체크::before{display:none;}` },

  { 부품: ['히어로수'], 자산: '레진구', css: (P) => `
  /* 히어로수 — 지면당 1점. 여기서만 갇힌 빛이 코랄이다.
     ⚠자릿수가 늘면 상자가 가로로 길어지는데 구운 것은 «구»라 함께 늘어난다.
       그래서 contain 으로 두고, 상자를 늘리는 대신 구를 가운데 두고 숫자를 그 위에 올린다. */
  .히어로수{${얹기(P['레진구'])}box-shadow:none;
    min-width:2.9em;height:2.9em;padding:0 var(--참) .025em;}
  .히어로수::before{display:none;}` },

  { 부품: ['태그'], 자산: '칩', css: (P) => `
  /* 칩 — 가로로 늘어나는 부품이라 «늘려도 안 무너지는» 9분할로 얹는다.
     border-image 는 네 모서리를 고정하고 변만 늘린다(직교 렌더라 네 변의 두께가 같다). */
  .칩{background-image:none;background-color:transparent;box-shadow:none;
    border:14px solid transparent;border-image:url("${P['칩']['몸']}") 42 fill / 14px / 0 stretch;
    padding:calc(var(--숨) - 2px) calc(var(--참) - 6px);}
  .칩::before{display:none;}` },

  { 부품: ['링크점'], 자산: '유리구', css: (P) => `
  /* 링크점 — 본문 링크 뒤의 작은 표식 구슬. 유리(통과시킨다)라 «가리키는 것»이 비쳐 보인다. */
  a .점,.링크점{${얹기(P['유리구'])}box-shadow:none;}` },

  { 부품: [], 자산: '판', css: (P) => `
  /* 유리 카드 — 크기가 지면마다 달라 통짜 렌더로는 못 쓴다. 직교로 구운 판을 9분할로 늘린다.
     ⚠**테두리만** 가져온다(fill 없음) — 안쪽을 늘리면 굴절 결이 늘어져 «찢어진 유리»가 된다.
       그래서 카드 안쪽은 CSS 반투명이 남는다. 이 부품은 «반쯤 구운» 상태이고,
       부품 목록에는 카드가 없으므로(=구획이 아니라 그릇) 재질 분모에도 안 센다. */
  .유리{border:22px solid transparent;
    border-image:url("${P['판']['몸']}") 58 / 22px / 0 stretch;
    padding:calc(var(--단) - 8px) calc(var(--단) + var(--숨) - 8px);}
  .유리::before{opacity:.35;}          /* 흉내 림은 아주 옅게만 — 렌더 테와 겹치면 두 겹이 된다 */` },
];

/** 구움층 — 있는 자산만 덮는다. 없으면 그 줄이 통째로 안 나가고 CSS 흉내가 산다. */
function 구움층(자산) {
  if (!자산) return '';
  const P = 자산['부품'];
  const 조각 = 구움표.filter((r) => P[r.자산]).map((r) => r.css(P));
  return 조각.length ? `\n  /* ══ 구운 재질 (Blender Cycles · tools/룸굽기.js) ══ */${조각.join('\n')}` : '';
}

/** 이 부품이 «지면에서 실제로» 구운 재질을 입었나 — 자산이 있고 **그 CSS 가 나갔을 때**만 참. */
function 구운부품이름들(자산) {
  if (!자산) return new Set();
  const P = 자산['부품'];
  return new Set(구움표.filter((r) => P[r.자산]).flatMap((r) => r.부품));
}

/** 나머지 — 칩·실금·따옴·펠트오브·링크점. */
function 잔부품(색, 유, 림줄, 천) {
  const 천줄 = 천 ? `background-image:${천};background-size:46px;` : '';
  return `
  ${마커('태그')}
  .칩{display:inline-flex;align-items:center;gap:var(--숨);
    padding:calc(var(--숨) + 1px) var(--참);border-radius:999px;position:relative;
    font-size:.78rem;font-weight:700;letter-spacing:-.01em;color:var(--cream);
    background:linear-gradient(170deg, ${알파(색, 'Cream', .12)}, ${알파(색, 'Cream', .03)} 60%),
               ${알파(색, 'Navy Ink', 유['몸알파'])};
    box-shadow:inset 0 1px 0 ${알파(색, 'Cream', .18)},0 8px 16px -10px rgba(0,0,0,.9);}
  .칩::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;
    pointer-events:none;background:conic-gradient(from 208deg,${림줄});
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;opacity:.8;}

  ${마커('구분선')}
  /* 실금 — 선은 재질을 «안» 입는다. 획이라 두께가 없고, 두께가 없으면 물성이 없다. */
  .실금{height:var(--실);border:0;margin:var(--켜) 0;
    background:linear-gradient(90deg,${알파(색, 'Cream', 0)},${알파(색, 'Cream', .22)} 18%,
      ${알파(색, 'Cream', .22)} 82%,${알파(색, 'Cream', 0)});}

  ${마커('인용부호')}
  blockquote{position:relative;margin:var(--켜) 0;padding:var(--단) var(--단) var(--단) calc(var(--켜) + var(--참));
    font-size:.97rem;color:var(--slate);}
  blockquote::before{content:'\\201C';position:absolute;left:var(--칸);top:calc(var(--칸) - var(--숨));
    display:grid;place-items:center;width:1.7em;height:1.7em;border-radius:50%;
    font-size:1.5em;line-height:1;font-weight:800;color:var(--cream);
    padding-top:.28em;   /* 광학 — 여는 따옴표는 글리프가 위쪽에 몰려 있다 */
    background:linear-gradient(170deg, ${알파(색, 'Cream', .13)}, ${알파(색, 'Cream', .02)} 58%),
               ${알파(색, 'Navy Ink', 유['몸알파'])};
    box-shadow:inset 0 1px 0 ${알파(색, 'Cream', .2)},0 10px 20px -12px rgba(0,0,0,.9);}
  blockquote i,blockquote em{color:var(--cream);font-style:italic;}

  ${마커('표지오브')}
  /* 펠트 오브 — 이 지면에서 «부피»를 가진 유일한 물건이라 하나뿐이어야 한다.
     빛을 먹는 재질(roughness .95)이라 유리·레진 옆에서 «사람이 만든 것»으로 읽힌다. */
  .오브{width:112px;height:112px;border-radius:31px;flex:none;position:relative;overflow:hidden;
    background-color:var(--cream);${천줄}
    display:grid;place-items:center;
    color:var(--ink);font-weight:800;font-size:2.6rem;letter-spacing:-.05em;
    box-shadow:
      inset 0 3px 4px rgba(255,255,255,.62),
      inset 0 -14px 24px -6px ${알파(색, 'Navy 2', .5)},
      inset 8px 0 20px -10px ${알파(색, 'Navy 2', .35)},
      inset -8px 0 20px -10px ${알파(색, 'Navy 2', .35)},
      0 2px 0 rgba(0,0,0,.6), 0 38px 60px -20px rgba(0,0,0,1);}
  /* 잔털 림라이트 — 위 가장자리에서 빛이 섬유 «끝»을 태운다(펠트의 서명) */
  .오브::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    background:radial-gradient(78% 52% at 42% -6%, rgba(255,255,255,.72), rgba(255,255,255,0) 62%);}
  .오브::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.28);}

  ${마커('링크점')}
  /* 링크 — 40~50대가 읽는다는 것을 셈에 넣으면 밑선 알파만으로는 링크가 아니다.
     셋을 겹친다: 밑선 .62 · 굵기 한 단 · 앞에 코랄 점(3px 이라 신호 1점을 안 넘는다). */
  a{color:var(--cream);text-decoration:none;font-weight:560;
    box-shadow:inset 0 -1px 0 ${알파(색, 'Cream', .62)};
    transition:box-shadow 180ms ease,color 180ms ease;}
  a:not(.민):not(.레일 a)::before{content:'';display:inline-block;width:3px;height:3px;
    border-radius:50%;vertical-align:.32em;margin-right:var(--숨);
    background:var(--coral);box-shadow:0 0 6px ${알파(색, 'Coral', .7)};}
  a:hover{box-shadow:inset 0 -1px 0 ${알파(색, 'Coral', .9)};}

  ${마커('쪽번호')}
  /* 쪽번호 — 낮 지면에서만 산다. 화면에는 «쪽»이라는 것이 없다. */
  .쪽번호{display:none;}

  ${마커('본문타이포')}
  /* 🚫본문 타이포 — 불가침. 글자에 재질을 입히지 않는다(DESIGN.md §1 「타이포는 안 건드린다」).
     여기 있는 것은 «재질을 안 입힌다»는 선언이고, 그래서 분모에 든다(빠뜨린 것과 갈리게). */
  p,li,td,th{font-family:var(--font);}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   ④ 낮 지면 — 인쇄·PDF
   ══════════════════════════════════════════════════════════════════════════ */
function 낮(색, 레) {
  return `
  /* ── 낮 지면 ────────────────────────────────────────────────────────────
     ⚠검은 무대를 종이에 그대로 두면 안 되는 이유는 취향이 아니라 실패 모드다:
       크롬 인쇄의 「배경 그래픽」은 **기본이 꺼짐**이라 바탕만 흰 종이가 되고 글자는 Cream 으로
       남는다 — **Cream on 흰 종이 = 1.13:1**(본문이 통째로 사라진다).
     «다른 디자인»이 아니라 **같은 골격에 다른 빛**이다 — 부품 구조가 그대로다.
     재질도 죽이지 않고 «굳힌다»: 유리는 판이 되고, 레진은 구슬이 된다.
       유리 → 뒤가 비치는 것이 유리인데 종이엔 뒤가 없다 → 면 + 실선
       레진 → glow 가 종이에 안 실린다 → 코어를 «면»으로, 굴절밴드를 «선»으로 굳힌다
       못 옮기는 것 = 코스틱(샌 빛). 종이의 한계라 억지로 흉내내지 않는다. */
  @media print{
    html{background:var(--paper);color-scheme:light;}
    body{background:var(--paper);background-attachment:initial;color:var(--ink);
         font-size:10.6pt;line-height:1.62;}

    .유리{background:var(--cream2);border:1px solid var(--cream3);
      -webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none;
      break-inside:avoid;padding:var(--칸) calc(var(--칸) + var(--숨));}
    .유리::before{content:none;}

    /* 번호 — 유리 원판이 «찍힌 원판»이 된다. 분산 림은 선 하나로 굳는다. */
    h2{color:var(--ink);margin:calc(var(--켜) * .6) 0 var(--참);font-size:14pt;break-after:avoid;}
    h2:not(:has(.번호))::before,.번호,.잔번호,.각주{
      background:var(--cream3);color:var(--ink);box-shadow:inset 0 0 0 1px var(--slate2);}
    h2:not(:has(.번호))::after{background:var(--cream3);}
    .번호::before{content:none;}
    ol>li::before{background:var(--cream3);color:var(--ink);
      box-shadow:inset 0 0 0 1px var(--slate2);}
    ol>li::after{content:none;}

    /* 레진 — 코어를 면으로, 굴절밴드를 선으로. 구슬로 읽히되 종이에서 뜨지 않는다. */
    ul>li::before{background:${알파(색, 'Coral 3', .22)};
      box-shadow:inset 0 0 0 1px ${알파(색, 'Coral 3', .55)};}
    ul>li::after{background:none;}
    .체크,.히어로수{color:var(--ink);
      background:radial-gradient(58% 58% at 50% 44%, ${알파(색, 'Coral 3', .26)}, ${알파(색, 'Coral 3', .07)} 70%),
                 var(--cream2);
      box-shadow:inset 0 0 0 1px ${알파(색, 'Coral 3', .5)};}
    .체크::before,.히어로수::before{content:none;}

    .칩{background:var(--cream2);color:var(--ink);box-shadow:inset 0 0 0 1px var(--cream3);}
    .칩::before{content:none;}
    .실금{background:var(--cream3);}
    blockquote{color:var(--slate2);}
    blockquote::before{background:var(--cream3);color:var(--ink);box-shadow:none;}
    blockquote i,blockquote em{color:var(--ink);}
    .오브{width:74px;height:74px;border-radius:20px;color:var(--ink);font-size:1.7rem;
      box-shadow:none;border:1px solid var(--cream3);}   /* 배경을 끄면 천이 사라지니 테두리가 형태를 진다 */
    .오브::before,.오브::after{content:none;}

    p,li,b,strong,td,th,h3{color:var(--ink);}
    li::marker{color:var(--slate2);}
    .흐린,footer{color:var(--slate2);}
    a{color:var(--ink);font-weight:640;box-shadow:none;border-bottom:1px solid var(--coral3);}
    a:not(.민)::before{background:var(--coral3);box-shadow:none;}
    code{color:var(--ink);background:var(--cream2);box-shadow:inset 0 0 0 1px var(--cream3);}

    /* 쪽번호 — 낮에만 산다. @page 여백 안에 앉힌다. */
    .쪽번호{display:block;position:fixed;bottom:4mm;right:0;
      font-size:8.5pt;color:var(--slate2);font-variant-numeric:tabular-nums;}
    thead{display:table-header-group;}
    tr,.수치{break-inside:avoid;}
    @page{margin:14mm;}
    *{print-color-adjust:exact;-webkit-print-color-adjust:exact;}
  }`;
}

/* ══════════════════════════════════════════════════════════════════════════
   ⑤ 조립
   ══════════════════════════════════════════════════════════════════════════ */

/** 림 레시피 — 기본 무채(유호 픽 3 · 08-15). 스펙트럼은 «오브 1점»짜리 지면 전용. */
const 림레시피 = {
  무채: [['Slate', .45, 25], ['Cream', .60, 120], ['Slate', .35, 210], ['Cream', .42, 300], ['Slate', .5, 350]],
  스펙트럼: [['KC Cool Blue', .55, 25], ['Lime', .30, 80], ['KC Sun', .40, 130], ['Coral', .45, 185],
    ['KC Hot Pink', .34, 232], ['KC Cool Blue', .50, 290], ['Cream', .55, 338]],
};

/** 지면 프리셋 — 같은 부품을 다른 «묶음»으로 낸다. 캐러셀은 레일도 표지도 필요 없다. */
/* ⚠`구움` 은 **언제나 마지막**이다 — 뒤에 오는 규칙이 이기는 CSS 의 성질로 흉내를 덮는다.
 *   앞에 두면 아무 일도 안 일어나는데 화면은 «멀쩡해 보인다»(맞는 얼굴로 틀린 값의 전형).
 *   `인쇄`에는 안 넣는다 — 크롬 인쇄는 배경 그래픽이 기본 꺼짐이라 구운 재질이 통째로 안 나가고,
 *   그러면 번호가 «맨 숫자»로 남는다. 낮 지면은 재질을 죽이지 않고 «굳히는» 층(낮)이 담당한다. */
const 지면들 = {
  문서: ['율', '바탕', '유리', '번호', '레진', '잔', '낮', '구움'],
  캐러셀: ['율', '바탕', '유리', '번호', '레진', '잔', '구움'],   // 인쇄 없음 — 화면(이미지) 전용
  인쇄: ['율', '바탕', '유리', '번호', '레진', '잔', '낮'],
  웹: ['율', '바탕', '유리', '번호', '레진', '잔', '구움'],
  부품만: ['율', '유리', '번호', '레진', '잔', '구움'],           // 남의 지면에 얹을 때
  흉내: ['율', '바탕', '유리', '번호', '레진', '잔', '낮'],       // 대조용 — 구운 층을 뺀 옛 판
};

/**
 * @param 옵션 {지면, 림, 천} — 천 = 펠트 타일 CSS url(...) 문자열(없으면 오브가 민 크림으로 선다)
 */
function css(옵션 = {}) {
  const t = 정본();
  const { 색 } = t;
  const 지면 = 옵션.지면 || '문서';
  const 조각들 = 지면들[지면];
  if (!조각들) throw new Error('모르는 지면: ' + 지면 + ' — ' + Object.keys(지면들).join('·'));
  const 림이름 = 옵션.림 || '무채';
  if (!림레시피[림이름]) throw new Error('림은 무채·스펙트럼 둘뿐이다 — 받은 값: ' + 림이름);

  const 유 = t.재질['유리'], 레 = t.재질['레진'];
  const 림줄 = 림레시피[림이름].map(([이름, a, deg]) => `${알파(색, 이름, a)} ${deg}deg`).join(',');

  const 쓰는색 = ['Navy 2', 'Navy Ink', 'Navy', 'Navy 3', 'Cream', 'Cream 2', 'Cream 3', 'Paper',
    'Ink', 'Coral', 'Coral 2', 'Coral 3', 'Slate', 'Slate 2', 'KC Cool Blue'];
  const 색줄 = 쓰는색.filter((n) => 색[n])
    .map((n) => `    ${변수이름(n)}:${색[n]}; ${변수이름(n)}-rgb:${rgb(색[n]).join(',')};`).join('\n');

  const 바탕 = `
  :root{
${색줄}
    --깃:22px; --깃속:12px;                /* 동심원 — 바깥 = 안쪽 + 패딩 */
    --font:${t.서체['본문스택']};
  }
  *{box-sizing:border-box;}
  html{scroll-padding-top:96px;background:var(--navy2);color-scheme:dark;}
  ::selection{background:${알파(색, 'Coral', .28)};color:var(--cream);}
  :focus-visible{outline:2px solid var(--coral);outline-offset:3px;border-radius:6px;
    box-shadow:0 0 0 1px ${알파(색, 'Cream', .55)},0 0 14px 2px ${알파(색, 'Coral', .45)};}
  body{margin:0;min-height:100vh;
    background:
      radial-gradient(105% 62% at 50% -14%, ${알파(색, 'Navy 3', .62)} 0%, ${알파(색, 'Navy 3', 0)} 58%),
      radial-gradient(120% 88% at 50% 34%, rgba(0,0,0,0) 8%, rgba(0,0,0,.66) 100%),
      linear-gradient(180deg, rgba(0,0,0,.34), rgba(0,0,0,.52)),
      var(--navy2);
    background-attachment:fixed;color:var(--cream);
    font-family:var(--font);font-weight:450;font-size:17px;line-height:var(--줄본문);
    letter-spacing:-.021em;word-break:keep-all;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
  p{margin:var(--참) 0;color:var(--cream);}
  h3{margin:var(--켜) 0 var(--숨);font-size:1.02rem;font-weight:800;
     letter-spacing:-.028em;color:var(--cream);}
  b,strong{font-weight:750;color:var(--cream);}
  .흐린{color:var(--slate);} .작게{font-size:.9rem;}
  code{font-family:${t.서체['모노스택']};font-size:.93em;font-weight:600;color:var(--cream);
    background:${알파(색, 'Cream', .085)};padding:.1em .45em;border-radius:7px;
    box-shadow:inset 0 0 0 1px ${알파(색, 'Cream', .09)};}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}`;

  const 만들기 = {
    율: () => 율(t),
    바탕: () => 바탕,
    유리: () => 유리몸(색, 유, 림줄),
    번호: () => 번호들(색, 유, 림줄),
    레진: () => 레진부품(색, 레),
    잔: () => 잔부품(색, 유, 림줄, 옵션.천),
    낮: () => 낮(색, 레),
    구움: () => (옵션.구움 === false ? '' : 구움층(구운재질())),
  };

  const 머리 = `/* ── Loom ${지면} 지면 — 조립 산출물(손 편집 금지) ──────────────────────────
   통로: node tools/lib/loom.js --css ${지면}
   값:   docs/디자인_토큰.json (색·율·재질·부품) — 이 CSS 에 hex·px 원본은 없다
   물성 사다리: 펠트(먹는다) → 유리(통과시킨다) → 레진(가둔다) · 림 ${림이름}
   ⚠번호는 CSS counter 가 «자동»으로 세운다 — 원고가 번호를 안 적어도 된다.
   ──────────────────────────────────────────────────────────────────────── */`;

  return [머리, ...조각들.map((n) => 만들기[n]())].join('\n');
}

/* ── 분모 — 부품 목록 대비 실제 구현 (0은 분모와 함께 쓴다) ───────────────────
 * 🔑 v1.3 부터 **두 축**을 센다. 「부품이 있나」와 「그 부품이 무엇으로 그려졌나」는 다른 질문이고,
 *    앞의 축만 세면 14/14 초록인 채로 재질 전부가 CSS 흉내인 상태를 «완성»으로 읽는다.
 *    F498 이 정확히 그 상태였다 — 부품은 다 있었고, 전부 글래스모피즘이었다. */
function 분모() {
  const t = 정본();
  const 전량 = css({ 지면: '문서' });
  const 구현 = new Set([...전량.matchAll(/\/\*loom부품:([^*]+)\*\//g)].map((m) => m[1]));
  const 목록 = t.부품['목록'].map((p) => ({ ...p, 있나: 구현.has(p['이름']) }));
  const 없는것 = 목록.filter((p) => !p.있나).map((p) => p['이름']);
  const 목록밖 = [...구현].filter((n) => !t.부품['목록'].some((p) => p['이름'] === n));

  /* 재질 축 — 구운 것 / 흉내 / 재질 없음(선·글자처럼 물성이 원래 없는 것). */
  const 자산 = 구운재질();
  const 실제구움 = 구운부품이름들(자산);   // ⚠「자산이 있다」가 아니라 「그 CSS 가 나갔다」
  /* ⚠이 표가 «분모»다 — 여기 빠진 부품은 흉내인 채로 초록도 빨강도 아닌 자리에 숨는다.
   *   그래서 미분류를 0으로 만들고, 새 부품이 생기면 여기에 한 줄이 강제된다. */
  const 재질맵 = {
    절번호: '원판', 순번: '원판', 차례번호: '원판', 각주번호: '원판',
    불릿: '레진구_무채', 체크: '레진구_무채', 히어로수: '레진구', 태그: '칩',
    링크점: '유리구',
    표지오브: '사진',   // 펠트는 실물이 있다 — 헌법 ①대로 «찍은 것»이 이미 정답이다(굽지 않는다)
    구분선: null, 인용부호: null, 쪽번호: null, 본문타이포: null,  // 획·글자는 물성이 없다(§3-3)
  };
  const 재질축 = 목록.filter((p) => p.있나).map((p) => {
    const 필요 = 재질맵[p['이름']];
    if (필요 === null) return { 이름: p['이름'], 상태: '해당없음' };
    if (필요 === undefined) return { 이름: p['이름'], 상태: '미분류' };
    if (필요 === '사진') return { 이름: p['이름'], 상태: '사진', 자산: '실물 양모 타일' };
    return { 이름: p['이름'], 상태: 실제구움.has(p['이름']) ? '구움' : '흉내', 자산: 필요 };
  });
  const 셈 = (s) => 재질축.filter((x) => x.상태 === s).length;

  return {
    목록, 총: 목록.length, 구현: 목록.length - 없는것.length, 없는것, 목록밖,
    재질: {
      구움: 셈('구움'), 흉내: 셈('흉내'), 사진: 셈('사진'),
      해당없음: 셈('해당없음'), 미분류: 셈('미분류'),
      목록: 재질축, 자산수: 자산 ? Object.keys(자산['부품']).length : 0,
      바이트: 자산 ? JSON.stringify(자산).length : 0,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   ⑥ 시연 — 부품 전량을 한 장에
   ⚠**토큰 목록에서 조립한다** — 새 부품이 늘면 시연에 «자동으로» 나타난다.
     손으로 쓴 시연은 부품이 늘 때마다 낡고, 낡은 시연은 「없는 것」을 「있다」고 보여준다.
   ══════════════════════════════════════════════════════════════════════════ */
const 예시 = {
  절번호: '<h2>이 절의 번호는 원고에 없다</h2><p class="흐린 작게">HTML 은 <code>&lt;h2&gt;제목&lt;/h2&gt;</code> 뿐이고, 번호는 CSS counter 가 세운다.</p>',
  차례번호: '<p><span class="잔번호">03</span> <span class="흐린">레일·목차에서 쓰는 작은 판</span></p>',
  순번: '<ol><li>브라우저 기본 마커를 껐다</li><li>원판이 유리로 선다</li><li>번호는 <code>counter</code> 가 센다</li></ol>',
  불릿: '<ul><li>가장 많이 반복되는 부품이라 7px</li><li>갇힌 빛은 무채 — 수십 개가 코랄이면 신호가 죽는다</li><li>x-height 중앙에 앉는다(행 중앙이 아니다)</li></ul>',
  히어로수: '<p style="margin:var(--칸) 0"><span class="히어로수">16</span> <span class="흐린">지면당 1점 — 여기서만 갇힌 빛이 코랄이다</span></p>',
  표지오브: '<div class="오브" aria-hidden="true">S</div><p class="흐린 작게" style="margin-top:var(--참)">실물 양모 사진 타일 — 빛을 먹는 유일한 재질</p>',
  태그: '<p><span class="칩">펠트</span> <span class="칩">유리</span> <span class="칩">레진</span></p>',
  구분선: '<hr class="실금">',
  인용부호: '<blockquote>명품화는 정말 사소한 것의 디테일을 챙겨가면서 발전된다고 생각해.</blockquote>',
  체크: '<p><span class="체크">✓</span> <span class="흐린">완료·통과 표식 — 레진 구슬</span></p>',
  각주번호: '<p>이 문장에 각주가 붙는다<span class="각주">1</span></p>',
  쪽번호: '<p class="흐린 작게">🖨 낮 지면에서만 산다 — 화면에는 「쪽」이라는 것이 없다. <b>Ctrl+P</b> 로 확인.</p>',
  링크점: '<p><a href="#">코랄 점 3px + 밑선 .62 + 굵기 한 단</a> — 셋을 겹쳐야 링크로 읽힌다.</p>',
  본문타이포: '<p>🚫 글자에는 재질을 입히지 않는다. 본문은 본문이다 — 이것이 <b>불가침</b>이고, 그래서 목록에 실려 분모에 든다.</p>',
};

function 시연(옵션 = {}) {
  const t = 정본();
  const { 색 } = t;
  let 천 = null;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(루트, 'docs', 'tools', '펠트천.json'), 'utf8'));
    if (j['천'] && j['천']['Cream']) 천 = `url(${j['천']['Cream'].uri})`;
  } catch { /* 천이 없으면 오브는 민 크림으로 선다 — 시연은 그래도 나온다 */ }

  const 스타일 = css({ 지면: '문서', 림: 옵션.림, 천 });

  /* 물성 사다리 — 이 시연의 «판정 재료»다. 셋을 같은 크기로 나란히 두어야 차이가 보인다. */
  const 유 = t.재질['유리'], 레 = t.재질['레진'];
  const 사다리 = `
  .사다리{display:flex;gap:var(--켜);flex-wrap:wrap;margin:var(--단) 0;}
  .물성{text-align:center;flex:0 0 auto;}
  .물성 .알{width:92px;height:92px;border-radius:50%;margin:0 auto var(--참);position:relative;}
  .물성 .름{font-weight:800;font-size:.95rem;color:var(--cream);}
  .물성 .뜻{font-size:.8rem;color:var(--slate);margin-top:2px;max-width:15ch;}
  .알.펠{background-color:var(--cream);${천 ? `background-image:${천};background-size:46px;` : ''}
    box-shadow:inset 0 3px 4px rgba(255,255,255,.62),
      inset 0 -14px 24px -6px ${알파(색, 'Navy 2', .5)},
      0 2px 0 rgba(0,0,0,.6),0 38px 60px -20px rgba(0,0,0,1);}
  .알.펠::before{content:'';position:absolute;inset:0;border-radius:inherit;
    background:radial-gradient(78% 52% at 42% -6%, rgba(255,255,255,.72), rgba(255,255,255,0) 62%);}
  .알.유{background:linear-gradient(176deg, ${알파(색, 'Cream', .11)} 0%, ${알파(색, 'Cream', .022)} 26%,
      rgba(0,0,0,.06) 62%, rgba(0,0,0,.14) 100%), ${알파(색, 'Navy Ink', 유['몸알파'])};
    -webkit-backdrop-filter:blur(${유['흐림px']}px);backdrop-filter:blur(${유['흐림px']}px);
    box-shadow:inset 0 1px 0 ${알파(색, 'Cream', 유['윤'])},0 30px 60px -28px rgba(0,0,0,1);}
  .알.유::before{content:'';position:absolute;inset:0;border-radius:50%;padding:${유['림두께px']}px;
    background:conic-gradient(from 208deg,${림레시피[옵션.림 || '무채'].map(([n, a, d]) => `${알파(색, n, a)} ${d}deg`).join(',')});
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;filter:saturate(1.5);}
  .알.레{${레진몸(색, 레, 'Coral')}}
  .알.레::before{${레진스펙}}

  /* 율 — 여백을 «눈에 보이는 막대»로. 숫자만 적으면 4와 8의 차이가 안 보인다. */
  .율표{display:grid;gap:var(--틈);margin:var(--단) 0;}
  .율줄{display:grid;grid-template-columns:2.2em 4.2em 1fr;align-items:center;gap:var(--칸);}
  .율줄 .름{font-weight:800;color:var(--cream);}
  .율줄 .막{height:10px;border-radius:99px;${레진몸(색, 레, 'Cream')}}
  .율줄 .설{font-size:.82rem;color:var(--slate);}

  /* 광학 — 켜고 끈 대조.
     ⚠실물 차이는 0.5px 이라 «그냥 나란히 두면 안 보인다» — 시연이 아무것도 증명하지 못한다.
       그래서 3배 확대 + 원판 «기하 중앙»에 기준선을 긋는다. 선 위에서 숫자가 어긋난 게 보인다. */
  .대조{display:flex;gap:var(--막);align-items:flex-start;margin:var(--켜) 0;flex-wrap:wrap;}
  .대조 .짝{text-align:center;}
  .확대{position:relative;zoom:3;width:fit-content;margin:0 auto;}
  .확대::after{content:'';position:absolute;left:-5px;right:-5px;top:50%;height:.4px;
    background:var(--coral);opacity:.85;pointer-events:none;z-index:5;}
  .대조 .짝 .cap{font-size:.78rem;color:var(--slate);margin-top:var(--칸);max-width:20ch;}
  .생번호{padding-bottom:0!important;}

  .틀{max-width:min(1120px,100%);margin:0 auto;padding:0 var(--단) var(--막);}
  .글{max-width:74ch;}
  .판{margin:var(--단) 0;}
  .표지막{padding:var(--막) 0 var(--장);display:grid;gap:var(--단);}
  .표지막 h1{margin:0;font-size:clamp(3rem,9vw,5.6rem);font-weight:800;
    letter-spacing:-.052em;line-height:var(--줄히어로);
    background:linear-gradient(174deg,var(--cream) 0%,var(--cream) 44%,var(--slate) 118%);
    -webkit-background-clip:text;background-clip:text;color:transparent;}
  .꼭지{display:inline-flex;align-items:center;gap:var(--틈);margin:0;
    font-size:.7rem;font-weight:700;letter-spacing:.2em;color:var(--slate);text-transform:uppercase;}
  .꼭지::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--coral);
    box-shadow:0 0 10px 1px ${알파(색, 'Coral', .75)};}
  @media print{ .알.유,.알.레{box-shadow:inset 0 0 0 1px var(--slate2);} }`;

  const 율줄들 = Object.entries(t.율['단계']).map(([이름, v]) =>
    `<div class="율줄"><span class="름">${이름}</span><span class="흐린 작게">${v.px}px</span>` +
    `<div><div class="막" style="width:${v.px}px"></div><div class="설">${v['직책']}</div></div></div>`).join('\n');

  const 부품절 = t.부품['목록'].map((p, i) => {
    const 몸 = 예시[p['이름']] || `<p class="흐린">예시 미작성 — <code>예시.${p['이름']}</code> 를 loom.js 에 둔다.</p>`;
    return `<div class="유리 판">
  <p class="꼭지">${p['재질']} · ${p['이름']}</p>
  ${몸}
  <p class="흐린 작게" style="margin-top:var(--참)">${p['자리']}</p>
</div>`;
  }).join('\n');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="${색['Navy 2']}">
<title>Loom 부품 시연 — 물성 사다리·율·광학</title>
<style>
${스타일}
${사다리}
</style></head>
<body><div class="틀"><div class="글">

<header class="표지막">
  <div class="오브" aria-hidden="true">L</div>
  <div>
    <p class="꼭지">SYNK 그래픽 엔진</p>
    <h1>Loom</h1>
    <p style="max-width:34ch;font-size:1.1rem">지면의 «작은 것» 전량이 재질을 입는다.
       번호도, 불릿도, 따옴표도 — 텍스트로 두지 않는다.</p>
    <p class="흐린 작게">부품 ${t.부품['목록'].length}종 · 값 = docs/디자인_토큰.json · 조립 = tools/lib/loom.js --시연</p>
  </div>
</header>

<h2>물성 사다리 — 세 재질은 «빛을 다루는 방식»으로 갈린다</h2>
<p>색으로 위계를 내는 것은 누구나 한다. 물성으로 내려면 정본과 측정이 있어야 한다.
   아래 셋은 같은 크기·같은 자리인데, 눈은 <b>먹는다 → 통과시킨다 → 가둔다</b> 순서로 읽는다.</p>
<div class="사다리">
  <div class="물성"><div class="알 펠"></div><div class="름">펠트</div><div class="뜻">빛을 먹는다 — 사람이 만든 것</div></div>
  <div class="물성"><div class="알 유"></div><div class="름">유리</div><div class="뜻">빛을 통과시킨다 — 담는 것</div></div>
  <div class="물성"><div class="알 레"></div><div class="름">레진</div><div class="뜻">빛을 가둔다 — 여기가 제일 무겁다</div></div>
</div>
<div class="유리 판"><p class="작게" style="margin:0">
  <b>왜 이 순서인가</b> — 펠트는 확산(roughness .95)이라 빛을 되돌려주지 않고,
  유리는 뒤가 비쳐 «층»을 보여주고, 레진은 두께 안에 빛을 가둬 시선을 붙든다.
  그래서 <b>레진은 지면당 1점</b>이다. 둘이면 서로를 죽인다.</p></div>

<h2>율 — 모든 여백에는 이유가 있다</h2>
<p>간격이 이름을 가지면 「여기 왜 24px?」에 <b>「블록 사이니까 <code>단</code>」</b>이라고 답할 수 있다.
   답할 수 없는 간격은 애초에 안 쓰게 된다 — 그게 이 표의 목적이다.</p>
<div class="율표">
${율줄들}
</div>
<div class="유리 판"><p class="작게" style="margin:0">
  <b>사다리</b> — 장 ${t.율['단계']['장'].px} ≥ 켜 ${t.율['단계']['켜'].px}×1.5 ≥ 단 ${t.율['단계']['단'].px}×2.5.
  절·문단무리·블록의 비율이다. 이게 깨지면 절대값이 아무리 넉넉해도 문서가 한 덩어리로 읽힌다.</p></div>

<h2>광학 — 수학 중심과 «보이는» 중심은 다르다</h2>
<p>눈은 어긋남을 짚어내지 못하면서도 알아챈다. 아래 두 원판은 숫자 위치만 다르다 —
   <b>3배 확대</b>했고, 코랄 선이 원판의 «기하 중앙»이다.</p>
<div class="대조">
  <div class="짝"><div class="확대"><span class="번호 생번호">08</span></div>
    <div class="cap">보정 없음 — 숫자가 선보다 아래로 가라앉는다</div></div>
  <div class="짝"><div class="확대"><span class="번호">08</span></div>
    <div class="cap">1.25% 올림 — 잉크가 선 위에 «앉는다»</div></div>
</div>
<div class="유리 판"><p class="작게" style="margin:0">
  <b>이 값은 지어낸 것이 아니라 잰 것이다</b>(2026-08-16) — canvas 로 숫자 글리프의 «잉크 경계»를 재고
  line box 중앙과 비교했다: 잉크 중앙이 <b>font-size 의 1.25%</b> 아래에 맺힌다.
  패딩은 중앙을 절반만 미므로 집행값은 그 2배인 <code>.025em</code> 이다.
  실물 크기에서는 <b>0.5px</b> — 짚어낼 수 없지만 알아챈다. 그게 이 층의 전부다.
  <span class="흐린">⚠폴백 서체(system-ui)로 잰 값 — Inter Tight 가 실린 지면에서 재확인이 남았다.</span></p></div>
<ul>
${t.율['광학']['규칙'].map((r) => `<li>${r}</li>`).join('\n')}
</ul>

<h2>부품 ${t.부품['목록'].length}종 — 전량</h2>
<p>아래는 <b>토큰 목록에서 자동 조립</b>된다. 부품이 늘면 여기에 저절로 나타나고,
   구현이 없으면 <code>node tools/lib/loom.js --분모</code> 가 이름째 센다.</p>
${부품절}

<hr class="실금">
<p class="흐린 작게">Loom · 조립 산출물(손 편집 금지) — 값이 바뀌면
  <code>node tools/lib/loom.js --시연 docs/Loom_부품_시연.html</code> 재실행</p>
<div class="쪽번호">SYNK · Loom</div>

</div></div></body></html>
`;
}

module.exports = { css, 율, 분모, 시연, 지면들, 림레시피, 정본, 마커 };

/* ── CLI ──────────────────────────────────────────────────────────────────── */
if (require.main === module) {
  const 인자 = process.argv.slice(2);
  const 모드 = 인자[0];
  try {
    if (모드 === '--css') {
      const 림i = 인자.indexOf('--림');
      process.stdout.write(css({
        지면: 인자[1] && !인자[1].startsWith('--') ? 인자[1] : '문서',
        림: 림i >= 0 ? 인자[림i + 1] : '무채',
      }) + '\n');
    } else if (모드 === '--분모') {
      const r = 분모();
      console.log('■ Loom 부품 — 토큰 목록 대비 구현');
      for (const p of r.목록) {
        console.log('   ' + (p.있나 ? '✅' : '🔴') + ' ' + p['이름'].padEnd(10)
          + ' [' + String(p['재질']).padEnd(4) + ']  ' + p['자리']);
      }
      console.log('\n   합계 ' + r.총 + ' = 구현 ' + r.구현 + ' + 없음 ' + r.없는것.length
        + (r.없는것.length ? '  🔴 ' + r.없는것.join(', ') : ''));
      if (r.목록밖.length) {
        console.log('   ⚠ 목록 밖 부품 ' + r.목록밖.length + '개 — CSS 엔 있는데 토큰 목록에 없다: '
          + r.목록밖.join(', ') + '  (목록이 분모라 이쪽도 흠이다)');
      }
      /* 🔑 두 번째 축 — 「있나」가 아니라 「**무엇으로 그렸나**」.
       *    이 줄이 없던 판에서 14/14 초록인 채로 재질 전부가 글래스모피즘이었다(F498). */
      const m = r.재질;
      console.log('\n■ 그 부품은 무엇으로 그려졌나 — 재질 축');
      for (const x of m.목록) {
        const 표 = { 구움: '✅ 구움', 사진: '✅ 사진', 흉내: '🟡 CSS 흉내',
          해당없음: '·  물성 없음', 미분류: '❔ 미분류' }[x.상태];
        console.log('   ' + 표.padEnd(12) + ' ' + x.이름 + (x.자산 ? '   ← ' + x.자산 : ''));
      }
      console.log('\n   합계 ' + m.목록.length + ' = 구움 ' + m.구움 + ' + 사진 ' + m.사진
        + ' + 흉내 ' + m.흉내 + ' + 물성없음 ' + m.해당없음 + ' + 미분류 ' + m.미분류);
      console.log('   구운 자산 ' + m.자산수 + '벌 · 지면에 실리는 무게 '
        + (m.바이트 / 1024).toFixed(0) + 'KB'
        + (m.자산수 ? '' : '   → node tools/룸굽기.js --전량 && python tools/룸자산화.py'));
      if (r.없는것.length || r.목록밖.length) process.exit(1);
    } else if (모드 === '--시연') {
      const 출력 = 인자[1] || path.join(루트, 'docs', 'Loom_부품_시연.html');
      const 림i = 인자.indexOf('--림');
      const s = 시연({ 림: 림i >= 0 ? 인자[림i + 1] : '무채' });
      fs.mkdirSync(path.dirname(출력), { recursive: true });
      fs.writeFileSync(출력, s, 'utf8');
      /* 자립성 — 첨부 단독으로 열릴 때 그림이 하나라도 외부면 전멸한다(홈페이지 트랙 실측). */
      const 외부 = [...s.matchAll(/(?:src|href)="(?!data:|#)([^"]+)"/g)].map((m) => m[1]);
      console.log('■ Loom 시연  → %s  (%sKB)', path.relative(루트, 출력), (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1));
      const r = 분모();
      console.log('   부품 %d = 구현 %d + 없음 %d · 예시 %d/%d',
        r.총, r.구현, r.없는것.length, r.목록.filter((p) => 예시[p['이름']]).length, r.총);
      if (외부.length) { console.log('   🔴 외부 자원 %d개 — 자립형이 아니다: %s', 외부.length, 외부.slice(0, 3).join(', ')); process.exit(1); }
      console.log('   ✅ 자립형 — 외부 자원 0');
    } else if (모드 === '--율') {
      const t = 정본();
      console.log('■ Loom 율 — 모든 간격이 여기서 나온다 (이름 없는 px 을 지면에 적지 않는다)');
      for (const [이름, v] of Object.entries(t.율['단계'])) {
        console.log('   ' + 이름 + '  ' + String(v.px + 'px').padEnd(6) + '  ' + v['직책']);
      }
      const s = t.율['단계'];
      console.log('\n   사다리 — 장 ' + s['장'].px + ' ≥ 켜 ' + s['켜'].px + '×1.5=' + s['켜'].px * 1.5
        + ' ≥ 단 ' + s['단'].px + '×2.5=' + s['단'].px * 2.5
        + '   ' + (s['장'].px >= s['켜'].px * 1.5 && s['켜'].px * 1.5 >= s['단'].px * 2.5 ? '✅ 선다' : '🔴 무너졌다'));
      console.log('\n   광학 보정 ' + t.율['광학']['규칙'].length + '건:');
      t.율['광학']['규칙'].forEach((r) => console.log('   · ' + r));
    } else {
      console.log('용법:\n  node tools/lib/loom.js --css [문서|캐러셀|인쇄|웹|부품만] [--림 무채|스펙트럼]\n'
        + '  node tools/lib/loom.js --분모\n  node tools/lib/loom.js --율');
      process.exit(2);
    }
  } catch (e) { console.error('🔴 ' + e.message); process.exit(1); }
}
