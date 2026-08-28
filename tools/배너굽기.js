#!/usr/bin/env node
/* 배너굽기 — 유튜브 채널 배너를 로고 정본 하나에서 굽는다. (유호 지시 2026-08-28)
 *
 * 🔑 «배너»와 «채널아트»는 같은 것이다 — 유튜브가 옛 이름(채널 아트)을 버리고
 *   지금은 고객센터에서도 「배너 이미지」 하나로 부른다. 파일도 하나만 올린다.
 *
 * 🔴 규격 — 2026-08-28 유튜브 고객센터 «원문 실측»(support.google.com/youtube/answer/10456525):
 *   · 업로드 최소: 16:9 의 **2048×1152**
 *   · 권장(특히 TV 화면을 염두에 둘 경우): **2560×1440**  ← 여기서 굽는 크기
 *   · **텍스트·로고가 잘리지 않는 최소 크기: 1235×338**  ← 이 파일의 존재 이유
 *   · 파일 크기 6MB 이하
 *   ⚠ 데스크톱·모바일이 «각각» 몇 픽셀을 보여주는지는 **공식 문서에 없다**(안 재봤다).
 *     흔히 도는 2560×423 은 출처를 못 찾았으므로 여기 쓰지 않는다 —
 *     확실한 것은 1235×338 하나뿐이고, 그 안에만 넣으면 어디서도 안 잘린다.
 *
 * 🔑 그래서 배너 디자인의 전부는 이것이다: **캔버스의 48%×23% 짜리 가운데 띠.**
 *   대부분의 채널이 이걸 몰라서 큰 화면에서만 멀쩡하고 폰에서 글자가 잘린다.
 *   바깥 영역은 «분위기»만 진다 — 글자도 로고도 두지 않는다.
 *
 * 사용:
 *   node tools/배너굽기.js               안 전부 + 시안 지면
 *   node tools/배너굽기.js --안 밤       한 안만
 *   node tools/배너굽기.js --안내선      안전 영역을 그려 넣은 «검수용» 판도 같이 굽는다
 *   출력 = docs/SHIFT/배너/<안>.png · 시안 = docs/SHIFT/배너/시안.html
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { 색, 기호선, 워드마크 } = require('./lib/로고정본.js');

const ROOT = path.resolve(__dirname, '..');
const 낼곳 = path.join(ROOT, 'docs/SHIFT/배너');

const W = 2560, H = 1440;          // 권장 크기(TV 포함)
const 안전W = 1235, 안전H = 338;    // 어디서도 안 잘리는 띠

/* ══ 재질 — 명품화의 기본은 세밀한 재질 표현이다 (유호 지시 08-28) ═══════════════
 *
 * 문법은 «로고정본의 펠트 필터»(feTurbulence 2층 = 밝은 보풀 lf + 어두운 결 df)를 그대로 잇고,
 * 값만 배너 스케일로 다시 잰다. 🔑 왜 값을 다시 재나 — 필터의 주파수·변위는 «사용자 좌표» 단위라,
 * 로고(viewBox 181 을 216px 로 = 1.2px/단위)에서 좋던 결을 viewBox 74 짜리 꺾쇠를 1400px 로
 * 키워 쓰면(18.9px/단위) 보풀이 16배 굵은 «얼룩»이 된다. 섬유 굵기는 물체 크기와 무관하다 —
 * 큰 펠트 조각일수록 결이 상대적으로 잘아야 실물처럼 읽힌다.
 * ⇒ 배너 쪽 SVG 는 전부 «픽셀 좌표계»로 조립하고(1 단위 ≈ 1px), 필터 값은 로고정본의
 *   픽셀 환산값을 그대로 쓴다. 도형(기호선)은 transform=scale 로 키운다.
 *
 * 그리고 이 재질층이 «미학»만이 아니다 — 어두운 라디얼 그라디언트는 유튜브 재압축에서
 * 밴딩(띠 얼룩)이 생기는데, 전면의 미세 노이즈가 디더 역할을 해 그것을 깬다. */

/** 전면 양모 천 — 뭉침(저주파) 2층 + 섬유(고주파) 2층. 팔레트만 받아 라이트/다크 둘 다 굽는다. */
function 양모천svg({ 보풀, 그늘, 어둡나 }) {
  const rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(4));
  };
  const [lr, lg, lb] = rgb(보풀), [dr, dg, db] = rgb(그늘);
  /* 알파 = 노이즈 밝기에서 유도(0 0 0 k b 행) — 로고정본과 같은 문법.
   *
   * 🔴 첫 판의 병(08-28 렌더 눈검증): 뭉침 두 층의 알파 기울기(0.5·0.34)가 너무 세서
   *   «천의 명암»이 아니라 «얼룩진 돌»이 됐다. 명품 천의 문법은 반대다 —
   *   멀리서는 거의 민면이고, 가까이서만 결이 산다. 그래서 뭉침은 겨우 보일 만큼(≤0.2),
   *   섬유(고주파)는 성기지만 또렷하게 — «세밀한」은 굵게가 아니라 «잘게»다. */
  /* 두 번째 눈검증(1:1 돋보기)의 처방 — 뭉침은 첫 판이 과했고 이 값이 맞았는데,
   * «섬유»는 1:1 에서 거의 안 보였다(임계 0.72 는 프랙탈 노이즈에서 드물다).
   * 잔털의 문턱을 낮춰 1:1 에서 또렷하고 축소에서 사라지는 자리(≈0.54)에 놓는다. */
  const 뭉침어둠알파 = 어둡나 ? '0.3 -0.19' : '0.2 -0.13';
  const 뭉침빛알파 = 어둡나 ? '0.26 -0.16' : '0.3 -0.2';
  const 보풀알파 = 어둡나 ? '0.95 -0.48' : '0.7 -0.44';
  const 그늘알파 = 어둡나 ? '0.6 -0.33' : '0.5 -0.33';
  return `<svg class="천" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <filter id="bn-wool" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feFlood flood-color="#000" flood-opacity="0" result="base"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.008" numOctaves="3" seed="41" result="m1"/>
      <feColorMatrix in="m1" type="matrix" values="0 0 0 0 ${dr}  0 0 0 0 ${dg}  0 0 0 0 ${db}  0 0 0 ${뭉침어둠알파}" result="뭉침어둠"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.013 0.018" numOctaves="3" seed="53" result="m2"/>
      <feColorMatrix in="m2" type="matrix" values="0 0 0 0 ${lr}  0 0 0 0 ${lg}  0 0 0 0 ${lb}  0 0 0 ${뭉침빛알파}" result="뭉침빛"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.05 0.52" numOctaves="2" seed="13" result="f1"/>
      <feColorMatrix in="f1" type="matrix" values="0 0 0 0 ${lr}  0 0 0 0 ${lg}  0 0 0 0 ${lb}  0 0 0 ${보풀알파}" result="잔털빛"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.82 0.42" numOctaves="3" seed="29" result="f2"/>
      <feColorMatrix in="f2" type="matrix" values="0 0 0 0 ${dr}  0 0 0 0 ${dg}  0 0 0 0 ${db}  0 0 0 ${그늘알파}" result="잔털어둠"/>
      <feMerge>
        <feMergeNode in="base"/><feMergeNode in="뭉침어둠"/><feMergeNode in="뭉침빛"/>
        <feMergeNode in="잔털어둠"/><feMergeNode in="잔털빛"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" filter="url(#bn-wool)"/>
</svg>`;
}

/** 톤온톤 펠트 꺾쇠 — 잉크색 펠트 조각을 밤 천 위에 «꿰매 붙인» 아플리케.
 *  층은 로고정본 펠트 문법 그대로(접촉 그림자 → 겉보풀 fuzz 2층 → 잘린 단 → 몸 → 손땀),
 *  좌표계만 픽셀이다. 색은 킷의 잉크 램프(몸 Ink · 보풀 Deep Wool · 그늘 Ink Deep)라
 *  멀리서는 «무늬»고 가까이서만 «조각»이다 — 명품 톤온톤의 문법. */
function 잉크펠트꺾쇠(px) {
  const S = px / 74;                        // 기호 펠트 viewBox 폭 74 → px
  const 몸 = (fill) => `<path d="${기호선}" fill="none" stroke="${fill}" stroke-width="13"
      stroke-linecap="round" stroke-linejoin="round"/>`;
  /* 손땀 — 실물 손바느질 땀은 5~8mm 로 «조각이 커져도 안 커진다».
   * dasharray 는 scale 안 좌표라, 원하는 픽셀 땀(≈26px)을 S 로 나눠 단위로 되돌린다. */
  const 땀길 = (24 / S).toFixed(2), 땀틈 = (18 / S).toFixed(2);
  /* 🔴 첫 판의 병 둘(08-28 렌더 눈검증):
   *   ① 잘린 단 변위가 30px 로 과해 윤곽이 «뭉텅한 덩어리»가 됐다 — 실물 펠트의 가위단은
   *      거의 곧고 «살짝만» 흔들린다. 변위를 12px 로 내리고 흔들림 주기를 잘게(0.016).
   *   ② 보풀(lf)의 알파 기울기 0.8 이 커서 조각의 몸통이 회갈색으로 떠 «톤온톤»이 죽었다 —
   *      멀리서 무늬·가까이서 조각이려면 보풀은 어둠 속에서 겨우 반짝여야 한다(0.5). */
  return `<svg class="아플리케" viewBox="0 0 ${px} ${px * (77 / 74)}" style="width:${px}px" aria-hidden="true">
  <defs>
    <filter id="bn-cut" x="-12%" y="-12%" width="124%" height="124%">
      <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="3" seed="7" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="12"/>
    </filter>
    <filter id="bn-fuzz1" x="-16%" y="-16%" width="132%" height="132%">
      <feTurbulence type="fractalNoise" baseFrequency="0.5 0.68" numOctaves="2" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="9"/><feGaussianBlur stdDeviation="0.5"/>
    </filter>
    <filter id="bn-fuzz2" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.24 0.36" numOctaves="2" seed="23" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="20"/><feGaussianBlur stdDeviation="1.2"/>
    </filter>
    <filter id="bn-felt-ink" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="3" seed="7" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="12" result="shape"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.96 0.42" numOctaves="2" seed="13" result="n1"/>
      <feColorMatrix in="n1" type="matrix" values="0 0 0 0 0.3412  0 0 0 0 0.3137  0 0 0 0 0.2745  0 0 0 0.5 -0.31" result="lf"/>
      <feComposite in="lf" in2="shape" operator="in" result="lfc"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.66 0.38" numOctaves="3" seed="29" result="n2"/>
      <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.0314  0 0 0 0 0.0235  0 0 0 0 0.0196  0 0 0 0.72 -0.36" result="df"/>
      <feComposite in="df" in2="shape" operator="in" result="dfc"/>
      <feMerge><feMergeNode in="shape"/><feMergeNode in="dfc"/><feMergeNode in="lfc"/></feMerge>
    </filter>
    <filter id="bn-soft" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="5" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="8"/>
    </filter>
  </defs>
  <g transform="scale(${S}) translate(-96,-28)">
    <g opacity="0.5" filter="url(#bn-soft)"><g transform="translate(1.0,2.3)">${몸(색['Ink Deep'])}</g></g>
    <g opacity="0.1" filter="url(#bn-fuzz2)">${몸(색['Ink'])}</g>
    <g opacity="0.22" filter="url(#bn-fuzz1)">${몸(색['Ink'])}</g>
    <g filter="url(#bn-cut)"><g transform="translate(0,1.7)">${몸(색['Ink Deep'])}</g></g>
    <g filter="url(#bn-felt-ink)">${몸(색['Ink'])}</g>
    <g filter="url(#bn-soft)">
      <path d="${기호선}" fill="none" stroke="${색['Ink Deep']}" stroke-width="${(4.6 / S).toFixed(3)}"
        stroke-dasharray="${땀길} ${땀틈}" stroke-dashoffset="${(9 / S).toFixed(2)}"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.5"
        transform="translate(0,${(1.8 / S).toFixed(3)})"/>
      <path d="${기호선}" fill="none" stroke="${색['Deep Wool']}" stroke-width="${(3.4 / S).toFixed(3)}"
        stroke-dasharray="${땀길} ${땀틈}" stroke-linecap="round" stroke-linejoin="round" opacity="0.42"/>
    </g>
  </g>
</svg>`;
}

/** 이음 손땀 — 천 두 장을 이어 붙인 수평 솔기. 큰 화면에서만 보이는 자리의 «공예 단서». */
function 이음선svg(y, 실색, 투명) {
  return `<svg class="이음" viewBox="0 0 ${W} 60" style="top:${y}px" aria-hidden="true">
  <defs>
    <filter id="bn-seam" x="-2%" y="-200%" width="104%" height="500%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.3" numOctaves="2" seed="19" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="7"/>
    </filter>
  </defs>
  <g filter="url(#bn-seam)" opacity="${투명}">
    <line x1="60" y1="30" x2="${W - 60}" y2="30" stroke="${실색}" stroke-width="3.4"
      stroke-dasharray="27 20 24 22 29 18" stroke-linecap="round"/>
    <line x1="60" y1="34" x2="${W - 60}" y2="34" stroke="${색['Ink Deep']}" stroke-width="2.6"
      stroke-dasharray="25 22 27 19 24 21" stroke-dashoffset="11" stroke-linecap="round" opacity="0.7"/>
  </g>
</svg>`;
}

/** 문안 — 공개선 12칸을 지난다.
 *  ⑫ 기본 시제 = 「짓고 있습니다」 · ⑩ 돈 ✗ · ⑪ 일의 숫자는 배너에 안 쓴다(안 바뀌는 자리라 낡는다).
 *  ⚠ 업로드 주기도 안 쓴다 — 아직 확정이 아니고(첫 3편 실측 뒤), 박으면 못 지키는 날 거짓말이 된다. */
const 큰줄 = 'AI로 교육 회사를 짓고 있습니다';
const 작은줄 = '학원 하나를 혼자 짓는 실황';

const 안들 = {
  밤: {
    이름: '① 밤 바탕',
    설명: '유튜브 기본이 다크라 화면에 이어 붙는다',
    바탕: 색['Ink Deep'],
    글자: 색['Paper'],
    보조: 색['Stone'],
    로고: () => 워드마크({ 판: '다크', 표현: '펠트', 색갈래: '코랄' }),
    천: { 보풀: 색['Deep Wool'], 그늘: '#000000', 어둡나: true },
  },
  양모: {
    이름: '② 양모 바탕',
    설명: '브랜드 지면과 같은 결. 다크 UI 위에서 카드처럼 뜬다',
    바탕: 색['Paper'],
    글자: 색['Ink'],
    보조: 색['Ash Wool'],
    로고: () => 워드마크({ 판: '라이트', 표현: '펠트', 색갈래: '코랄' }),
    천: { 보풀: '#FFFFFF', 그늘: 색['Oat'], 어둡나: false },
  },
  밤기호: {
    이름: '③ 밤 바탕 · 기호 — ✅ 확정 + 명품화 (08-28)',
    설명: '톤온톤 잉크 펠트 아플리케 + 양모 천 결 + 이음 손땀 · 업로드본 = yuhobuilds_배너.png',
    바탕: 색['Ink Deep'],
    글자: 색['Paper'],
    보조: 색['Stone'],
    /* 로고 = «단색다크» (유호 지시 08-28 「배경이 검정이니 k를 흰색 재질로 · 저번의 차분한
     * 스티치 테두리 버전」) — k 가 syn 과 같은 Paper 펠트가 되고 실땀 테두리가 글자를 두른다.
     * 최종표 지면·프로필과 같은 판이라 SHIFT 지면끼리 로고가 갈리지 않게 되는 부수 효과도 있다. */
    로고: () => 워드마크({ 판: '다크', 표현: '펠트', 색갈래: '단색' }),
    천: { 보풀: 색['Deep Wool'], 그늘: '#000000', 어둡나: true },
    워터마크: true,
    이음: true,
    확정: 'yuhobuilds_배너',
  },
};

/** 한 안의 자립형 HTML. `안내선` 이 참이면 안전 영역을 그린다(검수용 · 업로드본에는 안 넣는다).
 *
 * 층 순서(아래→위) — 실물 천 위에 실물 조각을 얹는 순서 그대로다:
 *   바닥색 → 양모 천 결 → 조명(키라이트 + 비네트) → 펠트 아플리케 → 이음 손땀 → 글·로고 → 안내선.
 * 조명의 광원은 50% 42% — 정중앙보다 «조금 위». 천은 늘 위에서 빛을 받는다. */
function 지면(안, 안내선) {
  const a = 안들[안];
  const 천 = a.천 ? 양모천svg(a.천) : '';
  const 워터 = a.워터마크 ? `<div class="워터">${잉크펠트꺾쇠(1440)}</div>` : '';
  const 이음 = a.이음 ? 이음선svg(Math.round(H * 0.875), 색['Deep Wool'], 0.3) : '';
  const 선 = 안내선 ? `<div class="안전선"><span>안전 영역 ${안전W}×${안전H} — 여기 밖은 기기에 따라 잘린다</span></div>` : '';
  const 어둡 = a.천 ? a.천.어둡나 : true;
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:${a.바탕};}
  .판{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${a.바탕};
    display:grid;place-items:center;
    font-family:'Inter Tight','SUIT Variable',system-ui,'Malgun Gothic',sans-serif;}
  .천{position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block;}
  /* 바깥 영역은 «분위기»만 — 글자도 로고도 두지 않는다. 키라이트가 위, 비네트가 가장자리. */
  .결{position:absolute;inset:0;z-index:1;
    background:
      radial-gradient(ellipse 58% 74% at 50% 42%, ${어둡 ? 'rgba(251,247,240,0.045)' : 'rgba(255,255,255,0.5)'} 0%, transparent 62%),
      radial-gradient(ellipse 118% 148% at 50% 46%, transparent 0%, transparent 52%, ${어둡 ? 'rgba(0,0,0,0.42)' : 'rgba(43,35,32,0.13)'} 100%);}
  .워터{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;
    display:grid;place-items:center;
    filter:drop-shadow(0 26px 40px rgba(0,0,0,0.5));}
  .워터 svg{display:block;}
  .이음{position:absolute;left:0;width:100%;height:60px;z-index:2;display:block;}
  /* 안전 영역 — 모든 글자가 여기 «안»에 있다.
   * 🔴 overflow:hidden 이 이 파일의 안전장치다. 첫 판은 내용(로고 212 + 큰줄 109 + 작은줄 55 + 간격 68
   *    = 444px)이 338 을 넘겼는데, flex 는 넘친 것을 «바깥으로 밀어» 조용히 안전 영역 밖에 세웠다
   *    — 큰 화면에서는 멀쩡해 보이고 폰에서만 잘린다(08-28 실측 · 안내선 판에서 잡았다).
   *    이제 넘치면 그 자리에서 «잘려» 보이므로 눈검증이 반드시 잡는다.
   *    아래 크기는 합이 316px 로 22px 여유를 둔 값이다 — 문안을 늘리면 이 셈을 다시 한다. */
  .속{position:relative;z-index:3;width:${안전W}px;height:${안전H}px;overflow:hidden;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;}
  /* 로고·글자가 천 위에 «앉는다» — 광원이 위(42%)니 그림자는 전부 아래로.
   * 글자의 이중 그림자 = 자수의 깊이: 아래로 부드러운 접촉 + 윗모서리에 실낱 하이라이트.
   * 폰트는 안 건드린다(킷 3규칙) — 이것은 활자가 아니라 «빛»의 층이다. */
  .로고{width:190px;filter:drop-shadow(0 7px 13px rgba(0,0,0,${어둡 ? '0.55' : '0.18'}));}
  .로고 svg{width:100%;height:auto;display:block;}
  .큰{font-size:80px;font-weight:800;letter-spacing:-0.035em;line-height:1.14;color:${a.글자};margin:0;
    text-shadow:0 3px 5px rgba(0,0,0,${어둡 ? '0.5' : '0.14'})${어둡 ? ', 0 -1px 0 rgba(251,247,240,0.07)' : ''};}
  .작은{font-size:36px;font-weight:500;letter-spacing:-0.01em;color:${a.보조};margin:0;
    text-shadow:0 2px 3px rgba(0,0,0,${어둡 ? '0.4' : '0.1'});}
  .안전선{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;
    width:${안전W}px;height:${안전H}px;box-sizing:border-box;
    border:3px dashed rgba(249,104,89,.85);border-radius:8px;}
  .안전선 span{position:absolute;left:0;top:-46px;font-size:26px;color:#F96859;white-space:nowrap;}
</style>
<div class="판">
  <!-- 이음(솔기)이 워터(아플리케)보다 먼저다 — 실물이라면 조각을 솔기 «위에» 꿰맨다. -->
  ${천}<div class="결"></div>${이음}${워터}${선}
  <div class="속">
    <div class="로고">${a.로고()}</div>
    <p class="큰">${큰줄}</p>
    <p class="작은">${작은줄}</p>
  </div>
</div>`;
}

function 크롬() {
  const 후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
  if (!후보.length) throw new Error('크롬을 못 찾았다 — 후보 2곳에 없다');
  return 후보[0];
}

function 굽기(안, 안내선) {
  const 이름 = 안내선 ? `${안}_안내선` : 안;
  const src = path.join(낼곳, `_${이름}.html`);
  const png = path.join(낼곳, `${이름}.png`);
  fs.writeFileSync(src, 지면(안, 안내선), 'utf8');
  const r = spawnSync(크롬(), ['--headless=new', '--disable-gpu', '--force-device-scale-factor=1',
    '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${png}`,
    'file:///' + src.replace(/\\/g, '/')], { encoding: 'utf8' });
  if (!fs.existsSync(png)) throw new Error(`굽기 실패: ${이름}\n${r.stderr || ''}`);
  fs.unlinkSync(src);
  const 바이트 = fs.statSync(png).size;
  /* 6MB 는 유튜브가 거절하는 선이다 — 넘으면 조용히 두지 않고 그 자리에서 말한다. */
  const 넘음 = 바이트 > 6 * 1024 * 1024;
  return { 안: 이름, png, 바이트, 넘음 };
}

/** 시안 — 판정 자리. data URI 는 «한 번만» 적는다(프로필 시안이 13.7MB 로 부은 그 함정). */
function 시안(굽힌것) {
  /* 🔴 배너는 data URI 로 «안 품는다» — 프로필 시안과 반대 판정이다(08-28).
   *   섬유 노이즈는 PNG 압축이 안 먹혀 한 벌이 4MB 대이고, base64 ×1.33 ×3벌 = 13.2MB 지면이
   *   git 이력에 판마다 쌓인다(실측). 시안은 «옆 파일»을 상대 경로로 본다 — 후보 PNG 는
   *   같은 폴더의 굽기 산출물이라 시안을 여는 기계에는 늘 있고(없으면 `node tools/배너굽기.js` 한 번),
   *   git 이 쥐는 것은 확정본 하나뿐이다. */
  const 키 = {};
  굽힌것.forEach(({ 안 }, i) => { 키[안] = `--b${i + 1}`; });
  const 변수 = 굽힌것.map(({ 안, png }) =>
    `    ${키[안]}:url("./${path.basename(png)}");`).join('\n');

  const 칸 = 굽힌것.map(({ 안, 바이트, 넘음 }) => {
    const a = 안들[안] || { 이름: 안, 설명: '' };
    const v = `background-image:var(${키[안]})`;
    return `<section class="안">
  <h2>${a.이름}</h2>
  <p class="설명">${a.설명}</p>
  <div class="띠줄"><span class="라벨">전체 (TV·큰 화면)</span><i class="배너" style="${v}"></i></div>
  <div class="띠줄"><span class="라벨">안전 영역만 (어디서도 안 잘리는 부분)</span>
    <i class="잘린띠" style="${v}"></i></div>
  <p class="파일"><code>docs/SHIFT/배너/${안}.png</code> · ${(바이트 / 1048576).toFixed(2)}MB
    ${넘음 ? '<b class="빨강">🔴 6MB 초과 — 유튜브가 거절한다</b>' : '<span class="초록">✅ 6MB 이하</span>'}</p>
</section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>yuhobuilds 유튜브 배너 — 세 안</title>
<style>
  :root{--paper:${색['Paper']};--inkdeep:${색['Ink Deep']};--coral:${색['Coral']};
    --stone:${색['Stone']};--ash:${색['Ash Wool']};
${변수}
  }
  body{margin:0;padding:40px 24px 72px;background:var(--inkdeep);color:var(--paper);
    font-family:'Inter Tight','SUIT Variable',system-ui,'Malgun Gothic',sans-serif;}
  .지면{max-width:1000px;margin:0 auto;}
  h1{font-size:1.9rem;font-weight:800;letter-spacing:-.03em;margin:0 0 8px;}
  .머리{color:var(--stone);font-size:.95rem;line-height:1.7;margin:0 0 36px;}
  .머리 b{color:var(--paper);}
  .안{padding:24px;margin:0 0 20px;border-radius:18px;
    background:rgba(228,228,231,.045);box-shadow:inset 0 0 0 1px rgba(228,228,231,.12);}
  .안 h2{font-size:1.05rem;font-weight:800;margin:0 0 4px;}
  .설명{color:var(--stone);font-size:.88rem;margin:0 0 18px;}
  .띠줄{margin:0 0 16px;}
  .라벨{display:block;font-size:.76rem;color:var(--ash);margin:0 0 6px;}
  .배너{display:block;width:100%;aspect-ratio:${W}/${H};border-radius:10px;
    background-size:cover;background-position:center;}
  /* 안전 영역만 보여 주는 띠 — 배너를 확대해 가운데 1235×338 만 창에 남긴다. */
  .잘린띠{display:block;width:100%;aspect-ratio:${안전W}/${안전H};border-radius:10px;
    background-size:${(W / 안전W * 100).toFixed(2)}% auto;background-position:center;
    box-shadow:inset 0 0 0 2px rgba(249,104,89,.5);}
  .파일{margin:14px 0 0;font-size:.78rem;color:var(--ash);}
  .빨강{color:#FD9C87;} .초록{color:var(--stone);}
  code{font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:.92em;}
  .꼬리{margin-top:32px;color:var(--stone);font-size:.86rem;line-height:1.75;}
  .꼬리 b{color:var(--paper);}
</style></head>
<body><div class="지면">
<h1>yuhobuilds 유튜브 배너 — 세 안</h1>
<p class="머리"><b>배너와 채널아트는 같은 것입니다</b> — 유튜브가 옛 이름(채널 아트)을 버리고 지금은 「배너 이미지」 하나로 부릅니다. 올리는 파일도 하나입니다.<br>
규격은 2026-08-28 에 유튜브 고객센터 원문으로 확인했습니다: 권장 <b>2560×1440</b>(TV 포함) · 최소 2048×1152 · <b>글자가 안 잘리는 영역 1235×338</b> · 6MB 이하.<br>
🔴 <b>판정은 아래 «안전 영역만» 줄로 하십시오</b> — 캔버스의 48%×23% 짜리 가운데 띠이고, 폰에서 보이는 것이 그것입니다.
다시 구우려면 <code>node tools/배너굽기.js</code>. ⚠ 이 지면은 옆 폴더의 후보 PNG 를 «상대 경로»로 봅니다 — 그림이 비어 보이면 그 명령 한 번이면 다시 채워집니다.</p>
${칸}
<p class="꼬리">
<b>바깥 영역에는 글자도 로고도 두지 않았습니다</b> — 큰 화면에서만 보이는 자리라 거기에 뜻을 실으면 폰에서 그 뜻이 사라집니다. 대신 «분위기»(가장자리로 갈수록 어두워지는 결)만 넣었고, ③은 꺾쇠를 크게 눕혀 큰 화면의 덤으로 뒀습니다.<br>
<b>업로드 주기는 안 적었습니다</b> — 아직 확정이 아니고(첫 3편 실측 뒤), 배너에 박으면 못 지키는 날 그것이 거짓말이 됩니다. 같은 이유로 「곧 나옵니다」류와 숫자도 뺐습니다(공개선 ⑫·⑪).
</p>
</div></body></html>`;
}

function main() {
  const argv = process.argv.slice(2);
  const 하나 = argv.includes('--안') ? argv[argv.indexOf('--안') + 1] : null;
  const 안내선 = argv.includes('--안내선');
  if (하나 && !안들[하나]) throw new Error(`모르는 안: ${하나} (있는 것: ${Object.keys(안들).join(' · ')})`);

  fs.mkdirSync(낼곳, { recursive: true });
  const 목록 = 하나 ? [하나] : Object.keys(안들);
  const 굽힌것 = [];
  for (const 안 of 목록) {
    const r = 굽기(안, false);
    console.log(`${r.넘음 ? '🔴' : '✅'} ${안.padEnd(8)} ${W}×${H} · ${(r.바이트 / 1048576).toFixed(2)}MB${r.넘음 ? ' — 6MB 초과!' : ''}`);
    굽힌것.push(r);
    if (안내선) {
      const g = 굽기(안, true);
      console.log(`   ↳ 검수용 안내선 판 · ${path.relative(ROOT, g.png)}`);
    }
  }

  /* 확정된 안은 «업로드본» 이름으로 한 벌 더 — 프로필굽기와 같은 규약.
   * 이 한 벌만 git 이 쥔다(후보·안내선 판은 .gitignore · 시안이 품는다). */
  const 확정안 = 굽힌것.find(({ 안 }) => 안들[안] && 안들[안].확정);
  if (확정안) {
    const 업로드본 = path.join(낼곳, `${안들[확정안.안].확정}.png`);
    fs.copyFileSync(확정안.png, 업로드본);
    console.log(`\n🏷  확정 = ${path.relative(ROOT, 업로드본)} (← ${확정안.안})`);
  }

  if (!하나) {
    const s = path.join(낼곳, '시안.html');
    fs.writeFileSync(s, 시안(굽힌것), 'utf8');
    console.log(`📄 시안 = ${path.relative(ROOT, s)} — «안전 영역만» 줄로 고르십시오`);
  }
  console.log(`\n[배너굽기] ${굽힌것.length}벌 · ${path.relative(ROOT, 낼곳)}`);
}

main();
