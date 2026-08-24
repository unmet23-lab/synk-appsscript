#!/usr/bin/env node
/**
 * 로고정본 — SYNK 로고의 «실행 정본» (유호 확정 2026-08-24 「승격 집행해」)
 *
 * 무엇: 워드마크 `synk` · 기호 `<` · 도장, 세 부품의 SVG 가 전부 여기서 나온다.
 *   판정(어느 자리에 무엇을)의 정본은 docs/발표물/_브랜드킷.md §3 그대로이고,
 *   이 파일은 그 판정을 «그리는» 한 곳이다 — 마스코트자산.js 와 같은 문법.
 *   사본 여덟 곳 문제(§3 머리말)의 해법: 소비자(로고주입·인쇄본빌드·교재읽기본·
 *   브랜드킷조립·로고시트·색상조립)는 전부 이 모듈을 require 하거나 CLI 로 받는다.
 *
 * 확정 사슬 (전부 유호 08-24 · 결정.md):
 *   · 워드마크 = `synk` — k 는 Inter Tight SemiBold «실제 글리프»(아래 K 상수 · 유도 각주).
 *     예전 `syn<` 워드마크는 은퇴 — 오인(「syn+화살표」) 때문. 이름은 읽혀야 한다.
 *   · 두 층 — 이름 `synk` 는 «보여주는 순간»(스플래시·대외·간판), 기호 `<` 는
 *     «이미 안에 들어온 자리»(상단바·진행·로딩·도장·워터마크·불릿). 워드마크는 하나다.
 *   · 기본 표현 = 잉크 카드 «벡터 펠트» + 명품화 4레버(보풀 헤일로 · 손맛 실땀 ·
 *     두께 2톤 · [카드면일 때] 천 직조). 예전 민벡터·렌더판 PNG 표현은 기본에서 은퇴.
 *   · 기호 = 자수판 — 둥근 몸 13 · 벌림 60°(v2 그대로) · 28px 이상에서만 실땀
 *     (아래에선 스스로 접힌다 — 작은 자리의 점선은 노이즈다 · 08-24 실측).
 *   · 도장 = 배지 문법 — 펠트 원 + 쿠션 볼록 + 실땀 링 + 접지 + «광학 중심»
 *     (꺾쇠는 꼭짓점이 눈을 끌어 기하 중심이 쏠려 보인다 — 토큰 광학 규칙의 거울판).
 *   · 색 = 기본 Coral · 특별 자리(기념·한정) Pop. 램프 3단이 펠트 결(보풀·몸통·그늘)을 짠다.
 *
 * 왜 렌더판 PNG 를 버렸나: 구움/ 은 git 밖이라 남의 기계에서 로고가 «사라졌다»
 *   (08-24 실사고 — 유호님 화면에서 꺾쇠가 그림자만 남았다). 벡터 펠트는 어디서나 선다.
 *
 * 사용:
 *   const 로고 = require('./tools/lib/로고정본.js');
 *   로고.워드마크({ 판:'다크'|'라이트', 표현:'펠트'|'민', 슬래시:true, 클래스:'logo' })
 *   로고.기호({ px, 색값, 땀색, 펠트:true })      // px<28 이면 실땀이 접힌다
 *   로고.도장({ px })
 *   CLI:  node tools/lib/로고정본.js --json        // 표준형 전부(파이썬 소비자용)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 루트 = path.resolve(__dirname, '..', '..');
const 토큰 = JSON.parse(fs.readFileSync(path.join(루트, 'docs', '디자인_토큰.json'), 'utf8'));
const 색 = Object.fromEntries(토큰['색']['킷'].map((c) => [c['이름'], c['hex']]));

/* ── 도형 — 좌표를 손으로 다시 그리지 않는다 ──────────────────────────────────
 * SYN: Inter Tight SemiBold 72px · baseline y=86 · 자간 -1 을 path 로 뜬 것(스플래시 08-21 원본).
 * K:   같은 폰트·같은 눈금의 소문자 k 실제 글리프. 유도(08-24): fontTools 로
 *      docs/브랜드_폰트/InterTight/InterTight-SemiBold.ttf 의 cmap['k'] 를
 *      scale 72/2048, baseline 86, x=113.89(= s·y·n 진행폭 합, 자간 -1 포함)로 변환.
 *      bbox x117.3~153.0 · y33.6(어센더)~86.
 *      🔑 **컨투어를 하나로 합쳤다(union · skia-pathops)** — 폰트 원본 k 는 세 조각
 *      (스템·윗팔·아랫팔)이 겹쳐 선 것이라, 실땀을 두르면 stroke 가 **내부 경계까지** 돌아
 *      글자가 세 조각으로 쪼개져 보였다(08-24 실측 · 240px 확대에서 크림색 X 자국).
 *      syn 은 글자마다 한 덩어리라 이 병이 없다. union 은 «자수 와펜이라면 한 장으로 잘려 있다»는
 *      물리와도 맞는다. 재유도 = pathops.simplify(parse_path(원본K)) — 좌표를 손으로 안 고친다.
 * CHEV: 꺾쇠 v2(유호 확정 08-22 좌표 통일) — 이제 워드마크가 아니라 «기호»의 뼈대다.
 *       벌림 60°는 의도된 날카로움(유호 08-18) — 기호에서도 각은 지키고 획만 둥글린다. */
const SYN = 'M35.8 57.9 25.9 58.5Q25.5 56.6 23.8 55.3Q22.1 53.9 19.3 53.9Q16.7 53.9 15.0 55.0Q13.3 56.0 13.3 57.8Q13.3 59.2 14.4 60.2Q15.5 61.2 18.2 61.8L25.4 63.2Q31.1 64.3 33.9 66.9Q36.7 69.5 36.7 73.8Q36.7 77.7 34.5 80.6Q32.2 83.5 28.3 85.1Q24.4 86.8 19.3 86.8Q11.5 86.8 6.8 83.5Q2.2 80.2 1.4 74.6L12.1 74.1Q12.6 76.5 14.5 77.7Q16.3 78.9 19.3 78.9Q22.1 78.9 23.9 77.8Q25.7 76.7 25.7 75.0Q25.7 72.0 20.6 71.0L13.8 69.6Q8.1 68.5 5.3 65.6Q2.5 62.8 2.5 58.4Q2.5 54.6 4.5 51.9Q6.6 49.2 10.4 47.7Q14.1 46.2 19.1 46.2Q26.6 46.2 30.8 49.3Q35.1 52.5 35.8 57.9Z M44.0 100.7Q41.9 100.7 40.1 100.4Q38.3 100.1 37.1 99.6L39.6 91.5L39.9 91.6Q42.7 92.4 44.6 91.9Q46.6 91.5 47.6 88.8L48.2 87.1L34.1 46.7H45.6L53.7 75.6H54.1L62.3 46.7H73.8L58.6 90.3Q57.5 93.4 55.6 95.8Q53.7 98.1 50.9 99.4Q48.0 100.7 44.0 100.7Z M84.0 63.3V86.0H73.1V46.7H83.8V53.7H84.2Q85.5 50.2 88.4 48.2Q91.4 46.2 95.7 46.2Q99.8 46.2 102.9 48.0Q105.9 49.8 107.6 53.1Q109.3 56.4 109.3 61.0V86.0H98.4V62.9Q98.4 59.4 96.6 57.3Q94.7 55.2 91.4 55.2Q89.2 55.2 87.6 56.2Q85.9 57.2 84.9 59.0Q84.0 60.8 84.0 63.3Z';
const K = 'M117.3046875 86.0V33.6171875H126.55078125V62.48046875H127.21875L141.31640625 46.6953125H152.14453125L136.91339111328125 63.68389129638672L153.0234375 86.0H141.94921875L129.9180908203125 69.20931243896484L126.55078125 72.82667541503906V86.0Z';
const CHEV = 'M146 46.7 L112 66.35 L146 86 L159 86 L125 66.35 L159 46.7 Z';
const 기호선 = 'M150 48 L118 66.35 L150 84.7';   // 꼭짓점 (118,66.35) · 벌림 60° · 획 기반

/* ── 색 유틸 ── */
function n3(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4));
}

/* ── 필터·그라디언트 defs — id 는 sl- 접두(한 지면에 여러 벌 실려도 같은 내용이라 무해) ── */
function 펠트필터(id, 보풀hex, 그늘hex) {
  const [lr, lg, lb] = n3(보풀hex);
  const [dr, dg, db] = n3(그늘hex);
  return `<filter id="${id}" x="-18%" y="-22%" width="136%" height="144%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="7" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" result="shape"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.15 0.5" numOctaves="2" seed="13" result="n1"/>
    <feColorMatrix in="n1" type="matrix" values="0 0 0 0 ${lr}  0 0 0 0 ${lg}  0 0 0 0 ${lb}  0 0 0 0.8 -0.46" result="lf"/>
    <feComposite in="lf" in2="shape" operator="in" result="lfc"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.8 0.45" numOctaves="3" seed="29" result="n2"/>
    <feColorMatrix in="n2" type="matrix" values="0 0 0 0 ${dr}  0 0 0 0 ${dg}  0 0 0 0 ${db}  0 0 0 0.8 -0.37" result="df"/>
    <feComposite in="df" in2="shape" operator="in" result="dfc"/>
    <feMerge><feMergeNode in="shape"/><feMergeNode in="dfc"/><feMergeNode in="lfc"/></feMerge>
  </filter>`;
}

function defs() {
  return `<defs>
  <path id="sl-syn" d="${SYN}"/><path id="sl-k" d="${K}"/>
  ${펠트필터('sl-felt-paper', 색['Paper'], 색['Stone'])}
  ${펠트필터('sl-felt-ink', 색['Deep Wool'], 색['Ink Deep'])}
  ${펠트필터('sl-felt-coral', 색['Coral Soft'], 색['Coral 3'])}
  <filter id="sl-cut" x="-14%" y="-18%" width="128%" height="136%">
    <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="7" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="2.2"/>
  </filter>
  <filter id="sl-soft" x="-14%" y="-18%" width="128%" height="136%">
    <feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="2" seed="5" result="w"/>
    <feDisplacementMap in="SourceGraphic" in2="w" scale="1.2"/>
  </filter>
  <filter id="sl-fuzz1" x="-20%" y="-25%" width="140%" height="150%">
    <feTurbulence type="fractalNoise" baseFrequency="0.55 0.75" numOctaves="2" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="6.5"/><feGaussianBlur stdDeviation="0.35"/>
  </filter>
  <filter id="sl-fuzz2" x="-24%" y="-30%" width="148%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.28 0.4" numOctaves="2" seed="23" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="11"/><feGaussianBlur stdDeviation="0.5"/>
  </filter>
  <filter id="sl-contact" x="-20%" y="-25%" width="140%" height="150%"><feGaussianBlur stdDeviation="1.2"/></filter>
  <linearGradient id="sl-core" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="${색['Stone']}" stop-opacity="0.32"/>
    <stop offset="0.5" stop-color="${색['Stone']}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="sl-cushion-hi" cx="50%" cy="26%" r="68%">
    <stop offset="0" stop-color="${색['Paper']}" stop-opacity="0.20"/>
    <stop offset="0.55" stop-color="${색['Paper']}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="sl-cushion-lo" cx="50%" cy="88%" r="72%">
    <stop offset="0" stop-color="${색['Coral Rim']}" stop-opacity="0.30"/>
    <stop offset="0.6" stop-color="${색['Coral Rim']}" stop-opacity="0"/>
  </radialGradient>
</defs>`;
}

/* 손맛 실땀 — 균일 점선은 미싱이다. 불균일 리듬 + 위상 어긋난 옅은 겹(굵기 흔들림). */
const 손땀d = ['3.4 2.7 2.9 3.3 2.5 3.1', '2.9 3.2 3.3 2.6 3.0 2.8'];

/* 글자 한 벌 — 명품화 4레버 중 글자 몫 셋(보풀·손땀·두께 2톤). 천 직조는 카드(호출부) 몫. */
function 글자펠트(참조, 몸색, 그늘색, 필터, { 땀보조색 = 색['Ink Deep'], 심 = false } = {}) {
  return `
    <use href="${참조}" fill="${색['Ink Deep']}" opacity="0.5" transform="translate(0.8,1.6)" filter="url(#sl-contact)"/>
    <use href="${참조}" fill="${몸색}" opacity="0.13" filter="url(#sl-fuzz2)"/>
    <use href="${참조}" fill="${몸색}" opacity="0.28" filter="url(#sl-fuzz1)"/>
    <g filter="url(#sl-cut)"><use href="${참조}" fill="${그늘색}" transform="translate(0.4,2.0)"/></g>
    <g filter="url(#sl-cut)"><use href="${참조}" fill="${그늘색}" opacity="0.55" transform="translate(0,1.2)"/></g>
    <g filter="url(${필터})"><use href="${참조}" fill="${몸색}"/>${심 ? `<use href="${참조}" fill="url(#sl-core)"/>` : ''}</g>
    <g filter="url(#sl-soft)">
      <use href="${참조}" fill="none" stroke="${땀보조색}" stroke-width="1.1"
        stroke-dasharray="${손땀d[0]}" stroke-linecap="round" opacity="0.4" transform="translate(0.5,0.8)"/>
      <use href="${참조}" fill="none" stroke="${색['Stitch']}" stroke-width="1.0"
        stroke-dasharray="3.1 2.8 3.4 2.5 2.9 3.2" stroke-linecap="round" opacity="0.6"/>
      <use href="${참조}" fill="none" stroke="${색['Stitch']}" stroke-width="0.7"
        stroke-dasharray="${손땀d[1]}" stroke-dashoffset="1.5" stroke-linecap="round" opacity="0.28"/>
    </g>`;
}

/** 워드마크 안쪽(그룹 내용물만) — 스플래시 같은 합성 지면이 자기 무대에 얹을 때 쓴다. */
function 워드마크안쪽({ 판 = '다크' } = {}) {
  const syn = 판 === '라이트'
    ? 글자펠트('#sl-syn', 색['Ink'], 색['Ink Deep'], '#sl-felt-ink', { 땀보조색: 색['Deep Wool'] })
    : 글자펠트('#sl-syn', 색['Paper'], 색['Stone'], '#sl-felt-paper', { 심: true });
  const k = 글자펠트('#sl-k', 색['Coral'], 색['Coral 3'], '#sl-felt-coral');
  return syn + k;
}

const 슬래시들 = (잉크, 투명, dx = -6) => `
  <path d="M${196 + dx} 92 L${216 + dx} 40 L${228 + dx} 40 L${208 + dx} 92 Z" fill="${잉크}" opacity="${투명}"/>
  <path d="M${234 + dx} 92 L${254 + dx} 40 L${266 + dx} 40 L${246 + dx} 92 Z" fill="${잉크}" opacity="${투명}"/>`;

/**
 * 워드마크 `synk` — 완결 SVG.
 * 판: '다크'(어두운 바탕 — syn Paper) | '라이트'(밝은 바탕 — syn Ink). k 는 언제나 Coral.
 * 표현: '펠트'(기본) | '민'(작은 자리·폴백 — 필터 0, 어디서나 가볍게).
 * 슬래시: true 면 W1 락업(synk //) — «//» 는 잉크의 저채도(세 번째 색이 아니다).
 */
function 워드마크({ 판 = '다크', 표현 = '펠트', 슬래시 = false, 클래스 = '' } = {}) {
  const 잉크 = 판 === '라이트' ? 색['Ink'] : 색['Paper'];
  const 슬투명 = 판 === '라이트' ? 0.45 : 0.5;
  const cls = 클래스 ? ` class="${클래스}"` : '';
  if (표현 === '민') {
    const vb = 슬래시 ? '-8 -2 284 116' : '-8 -2 169 116';
    return `<svg${cls} viewBox="${vb}" role="img" aria-label="SYNK">
  <path d="${SYN}" fill="${잉크}"/>
  <path d="${K}" fill="${색['Coral']}"/>${슬래시 ? 슬래시들(잉크, 슬투명) : ''}
</svg>`;
  }
  const vb = 슬래시 ? '-14 -8 296 128' : '-14 -8 181 128';   // 보풀 여유
  return `<svg${cls} viewBox="${vb}" role="img" aria-label="SYNK">
${defs()}
  <g>${워드마크안쪽({ 판 })}</g>${슬래시 ? 슬래시들(잉크, 슬투명) : ''}
</svg>`;
}

/**
 * 기호 `<` 자수판 — 둥근 몸 13 · 60° · px≥28 에서만 실땀(작으면 스스로 접힌다).
 * 색값 기본 Coral(특별 자리 Pop) · 도장 위처럼 몸이 밝을 땐 땀색을 유채로 준다.
 */
function 기호({ px = 24, 색값 = 색['Coral'], 그늘값 = 색['Coral 3'], 땀색 = 색['Stitch'], 펠트 = false, 투명도 = 1, 클래스 = '' } = {}) {
  const cls = 클래스 ? ` class="${클래스}"` : '';
  const 몸 = (fill) => `<path d="${기호선}" fill="none" stroke="${fill}" stroke-width="13"
    stroke-linecap="round" stroke-linejoin="round"/>`;
  const 땀 = px >= 28 ? `<g filter="url(#sl-soft)">
    <path d="${기호선}" fill="none" stroke="${땀색}" stroke-width="1.7"
      stroke-dasharray="${손땀d[0]}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    <path d="${기호선}" fill="none" stroke="${땀색}" stroke-width="1.2"
      stroke-dasharray="${손땀d[1]}" stroke-dashoffset="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.36"/>
  </g>` : '';
  if (!펠트) {
    return `<svg${cls} viewBox="100 34 66 65" style="width:${px}px;height:auto;display:block;opacity:${투명도}" role="img" aria-label="SYNK 기호">
${px >= 28 ? defs() : ''}${몸(색값)}${땀}</svg>`;
  }
  return `<svg${cls} viewBox="96 28 74 77" style="width:${px}px;height:auto;display:block;opacity:${투명도}" role="img" aria-label="SYNK 기호">
${defs()}
  <g opacity="0.5" filter="url(#sl-contact)"><g transform="translate(0.9,1.8)">${몸(색['Ink Deep'])}</g></g>
  <g opacity="0.13" filter="url(#sl-fuzz2)">${몸(색값)}</g>
  <g opacity="0.28" filter="url(#sl-fuzz1)">${몸(색값)}</g>
  <g filter="url(#sl-cut)"><g transform="translate(0,1.6)">${몸(그늘값)}</g></g>
  <g filter="url(#sl-felt-coral)">${몸(색값)}</g>
  ${땀}
</svg>`;
}

/**
 * 도장 — 배지 문법(유호 확정 배지 08-21 의 결 + 08-24 명품화).
 * 기호는 «광학 중심»(-3.6 단위 — 꼭짓점 쏠림 보정 · 렌더 눈검증 08-24)에 앉는다.
 */
function 도장({ px = 108, 클래스 = '' } = {}) {
  const cls = 클래스 ? ` class="${클래스}"` : '';
  const 몸 = (fill) => `<path d="${기호선}" fill="none" stroke="${fill}" stroke-width="13"
    stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg${cls} viewBox="0 0 120 126" style="width:${px}px;height:auto;display:block" role="img" aria-label="SYNK 도장">
${defs()}
  <ellipse cx="60" cy="114" rx="34" ry="7" fill="${색['Ink Deep']}" opacity="0.5" filter="url(#sl-contact)"/>
  <circle cx="60" cy="58" r="52" fill="${색['Coral']}" opacity="0.14" filter="url(#sl-fuzz2)"/>
  <circle cx="60" cy="58" r="52" fill="${색['Coral']}" opacity="0.30" filter="url(#sl-fuzz1)"/>
  <g filter="url(#sl-cut)"><circle cx="60" cy="60.4" r="52" fill="${색['Coral 3']}"/></g>
  <g filter="url(#sl-felt-coral)"><circle cx="60" cy="58" r="52" fill="${색['Coral']}"/></g>
  <circle cx="60" cy="58" r="52" fill="url(#sl-cushion-hi)"/>
  <circle cx="60" cy="58" r="52" fill="url(#sl-cushion-lo)"/>
  <g filter="url(#sl-soft)">
    <circle cx="60" cy="58" r="43.5" fill="none" stroke="${색['Stitch']}" stroke-width="1.9"
      stroke-dasharray="4.6 3.8 4.1 4.3 3.7 4.4" stroke-linecap="round" opacity="0.85"/>
    <circle cx="60" cy="58" r="43.5" fill="none" stroke="${색['Coral Rim']}" stroke-width="1.2"
      stroke-dasharray="4.2 4.1 3.8 4.5 4.0 3.9" stroke-dashoffset="2.1" stroke-linecap="round" opacity="0.30"/>
  </g>
  <g transform="translate(60,58) scale(0.83) translate(-136.6,-66.35) translate(-3.6,0)">
    <g opacity="0.45" filter="url(#sl-contact)"><g transform="translate(1.1,2.1)">${몸(색['Coral Rim'])}</g></g>
    <g filter="url(#sl-cut)"><g transform="translate(0,1.5)">${몸(색['Coral 3'])}</g></g>
    <g filter="url(#sl-felt-paper)">${몸(색['Paper'])}</g>
    <g filter="url(#sl-soft)">
      <path d="${기호선}" fill="none" stroke="${색['Coral']}" stroke-width="1.6"
        stroke-dasharray="${손땀d[0]}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    </g>
  </g>
</svg>`;
}

module.exports = { SYN, K, CHEV, 기호선, 색, defs, 워드마크, 워드마크안쪽, 기호, 도장 };

/* ── CLI — 파이썬 소비자(브랜드킷조립·로고시트)용 ── */
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({
      펠트다크: 워드마크({ 판: '다크' }),
      펠트라이트: 워드마크({ 판: '라이트' }),
      민다크: 워드마크({ 판: '다크', 표현: '민' }),
      민라이트: 워드마크({ 판: '라이트', 표현: '민' }),
      펠트다크_슬래시: 워드마크({ 판: '다크', 슬래시: true }),
      민다크_슬래시: 워드마크({ 판: '다크', 표현: '민', 슬래시: true }),
      기호_큰: 기호({ px: 96, 펠트: true }),
      기호_중: 기호({ px: 44 }),
      기호_작: 기호({ px: 20 }),
      도장: 도장({ px: 108 }),
    }));
  } else {
    console.log('용법: node tools/lib/로고정본.js --json');
    process.exit(args.length ? 1 : 0);
  }
}
