#!/usr/bin/env node
/**
 * 네온시안 — A실 후면 벽 네온사인 «두 안»을 나란히 굽는다 (2026-08-30 · 08-31 오독 수리 · **08-31 판정 닫힘**)
 *
 * ✅ **결과: ㉡ 코랄 `#F96859` «단색» 채택**(유호 확정 2026-08-31 「㉡ 코랄 단색으로 갈게」).
 *   정본은 **v6** 으로 올랐고 공간설계 §6 표 D·§8 2차 발주·§11 합의 1번이 같이 닫혔다.
 *   이 파일은 이제 «판정 지면»이 아니라 **«판정 기록»**을 굽는다 — 무엇을 보고 골랐나가 남는다.
 *   🔴 남은 자리 하나 = **네온 타입**(유리 튜브 / 아크릴 LED)은 아직 안 정해졌다. 발주 전에 묻는다.
 *
 * 왜 있었나: 인테리어 정본 v5 가 네온 색을 **「아직 정하지 않았다」**로 두고
 *   「두 안을 메인 룸 위에 얹어 **굽고 눈으로 고른다** · 네온 발주는 이 판정 뒤다」라고 못박았다
 *   (`docs/정본/…/07_SYNK_메인룸_인테리어.txt` §4 「벽에 굽는 색」).
 *   이 파일이 그 「굽는다」를 집행했다.
 *
 * 🔴 **첫 판(08-30)은 두 안을 «벽 색»으로 읽었다 — 오독이었다.** 정본 v5 문면이
 *   「㉠ 코랄 네온 #F96859 + 크림 #FBF7F0 / ㉡ 코랄 네온 #F96859 + Ink Deep #080605 **벽**」
 *   인데 ㉡ 에만 「벽」이 붙어 있어 ㉠ 의 크림도 벽으로 읽었다. 유래를 파니 답이 나왔다 —
 *   **v4.1 원문 125줄: 「SYNK 네온사인 — 오렌지 #FF6D00 + 웜크림 #F5F1E8 LED」.**
 *   네온이 처음부터 «두 색 LED» 였고, v5 는 그 폐기색 둘을 킷 현행(코랄·크림)으로 옮긴 것이다.
 *   ⇒ 갈리는 것은 벽이 아니라 **네온 자체의 색 구성**이다.
 *
 * 🔑 **후면 벽은 이미 정해져 있다 — 세 곳이 일관된다**(그래서 이 판정의 변수가 아니다):
 *   · 정본 v5 §4  「배경 컬러 — 딥 블랙 또는 다크 그레이」 · 「질감 — 흡음 패널 또는 템바보드」
 *   · 정본 v4.1    「배경 벽(거울 반대편): 다크 톤 마감」 · 「후면 벽은 다크 톤」
 *   · 공간설계 §6 표 D  「A실 · 후면 벽 · **흡음 패널(펠트 면)** · Ink Deep `#080605` · 무광」
 *   즉 **기존 벽에 무엇이 칠해져 있든 펠트 흡음 패널이 덮는다.** 매물이 안 정해진 것은
 *   이 자리의 차단자가 아니다(유호님 08-31 보류 사유가 여기엔 안 걸린다).
 *
 * 🔑 색·로고를 여기 다시 적지 않는다 — `docs/디자인_토큰.json` 과 `tools/lib/로고정본.js` 에서 읽는다.
 *   베껴 두면 킷이 바뀌는 날 시안만 옛 색으로 남고, 유호님이 «옛 그림으로 새 판을 판정»하시게 된다.
 *
 * 🔑 왜 2×2 인가 — 이 판정의 급소는 **조명이 켜졌을 때와 꺼졌을 때가 갈린다**는 것이다.
 *   토글로 만들면 유호님이 앞 장면을 «기억»으로 비교하셔야 한다. 네 장면을 한 화면에 둔다.
 *
 * ⚠ 이 지면은 **근사**다 — 실측 렌더가 아니라 CSS/SVG 로 그린 것이라 실제 네온의 광량·색온도와
 *   같지 않다. 가르는 데 쓰고, 발주 전에는 업체 실물 샘플을 한 번 더 본다. 그 사실을 지면에 적는다.
 * ⚠ ㉠ 의 «두 색을 어떻게 나누는가»는 **정본에 안 적혀 있다.** v4.1 이 「오렌지 + 웜크림」으로
 *   주·보조만 정했을 뿐이다. 그래서 가장 흔한 꼴(글자 = 주색 · 아웃라인 = 보조색)로 그리고,
 *   그 사실을 지면에 밝힌다 — 지어낸 것을 정본인 척 그리지 않는다.
 *
 * 사용: node tools/네온시안.js   →  docs/네온색_판정_2026-08-30.html
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 토큰 = JSON.parse(fs.readFileSync(path.join(루트, 'docs', '디자인_토큰.json'), 'utf8'));
const 로고 = require(path.join(루트, 'tools', 'lib', '로고정본.js'));

const 색 = Object.fromEntries(토큰['색']['킷'].map((c) => [c['이름'], c['hex']]));
const 본문스택 = 토큰['서체']['본문스택'];
const 모노스택 = 토큰['서체']['모노스택'];

/* 워드마크는 «정본이 그리는 것»을 그대로 받는다 — path 좌표를 여기 베끼지 않는다. */
const 워드마크SVG = 로고.워드마크({ 판: '다크', 표현: '민' });
const 워드패스 = [...워드마크SVG.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
const 뷰박스 = (워드마크SVG.match(/viewBox="([^"]+)"/) || [])[1] || '-8 -2 169 116';
if (워드패스.length !== 2) {
  console.error(`[네온시안] 워드마크 path 가 2개가 아니라 ${워드패스.length}개다 — 로고정본이 바뀌었다. 멈춘다.`);
  process.exit(2);
}

const CORAL = 색['Coral'];
const CORAL_SOFT = 색['Coral Soft'];
const CORAL_RIM = 색['Coral Rim'];
const PAPER = 색['Paper'];
const INK_DEEP = 색['Ink Deep'];

/** 한 장면(네온 갈래 × 조명)을 그린다. **벽은 둘 다 Ink Deep 으로 고정** — 이미 정해진 값이다.
 *  @param {'두색'|'단색'} o.안   ㉠ 코랄+크림 두 색 LED / ㉡ 코랄 단색
 *  @param {'촬영'|'무대'} o.조명 촬영 = 실내등 5000K 켬 · 무대 = 실내등 끔
 */
function 장면({ 안, 조명, 사람 }) {
  const 두색 = 안 === '두색';
  const 켜짐 = 조명 === '촬영';

  // 벽 — 흡음 패널(펠트 면) Ink Deep. 실내등을 켜면 아주 살짝만 밝아진다(무광 마감이라).
  const 벽색 = 켜짐 ? '#14100f' : INK_DEEP;
  const 리브 = 'rgba(255,255,255,.05)';
  // 네온이 벽에 뿌리는 빛 — 두 색 안은 크림 성분 때문에 뿌림이 더 희고 넓다.
  const 뿌림세기 = 켜짐 ? 0.34 : 0.62;
  const 뿌림색 = 두색 ? '252,224,214' : '249,104,89';
  const 바닥색 = 켜짐 ? '#2a2724' : '#141210';

  /* 튜브 면 — 켜진 네온은 «글자가 밝고 주변이 색으로 물든다». 조명을 끄면 면이 타오른다.
   * ㉠ 두 색: 글자 = 코랄(주) · 아웃라인 = 크림(보조) — v4.1 의 「오렌지 + 웜크림」 구조 그대로.
   * ㉡ 단색: 글자 = 코랄 하나. 아웃라인 없음. */
  /* 🔑 꺼진 조명의 면색을 Coral Soft 로 두면 **크림 아웃라인과 명도가 붙어 두 색 구조가 안 보인다**
   * (첫 정정판 실측 — ㉠ 무대 모드가 「크림 글자」로 읽혔다). 한 칸만 타오르는 Coral 2 를 쓴다. */
  const 면색 = 켜짐 ? CORAL : (색['Coral 2'] || CORAL_SOFT);
  const 글로우 = 켜짐 ? 0.72 : 1;
  const 아웃라인 = 두색 ? PAPER : CORAL_RIM;
  const 아웃라인굵기 = 두색 ? 2.6 : 0.7;
  const 아웃라인투명 = 두색 ? (켜짐 ? 0.92 : 1) : 0.55;

  const uid = `${안}-${조명}`;

  return `
  <figure class="장면" data-안="${안}" data-조명="${조명}">
    <div class="무대"
         style="--벽:${벽색}; --리브:${리브}; --바닥:${바닥색};
                --뿌림:${뿌림세기}; --뿌림색:${뿌림색};">
      <div class="벽">
        <div class="리브결" aria-hidden="true"></div>
        <div class="뿌린빛" aria-hidden="true"></div>
        <svg class="네온" viewBox="${뷰박스}" role="img" aria-label="SYNK 네온사인 ${두색 ? '두 색' : '코랄 단색'} · ${조명} 모드">
          <defs>
            <filter id="glow-${uid}" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" result="b1"/>
              <feGaussianBlur stdDeviation="6"   result="b2"/>
              <feGaussianBlur stdDeviation="14"  result="b3"/>
              <feMerge><feMergeNode in="b3"/><feMergeNode in="b2"/><feMergeNode in="b1"/></feMerge>
            </filter>
          </defs>
          <g filter="url(#glow-${uid})" opacity="${글로우}">
            ${워드패스.map((d) => `<path d="${d}" fill="${두색 ? PAPER : CORAL}"/>`).join('\n            ')}
          </g>
          <g>
            ${워드패스.map((d) => `<path d="${d}" fill="${면색}" stroke="${아웃라인}" stroke-width="${아웃라인굵기}" stroke-opacity="${아웃라인투명}" paint-order="stroke"/>`).join('\n            ')}
          </g>
        </svg>
      </div>
      <div class="바닥"><div class="반사" aria-hidden="true"></div></div>
      ${사람 ? 사람실루엣() : ''}
    </div>
    <figcaption>
      <b>${두색 ? '㉠ 코랄 + 크림 (두 색 LED) — 뺀 안' : '✅ ㉡ 코랄 단색 — 채택'}</b>
      <span class="모드">${켜짐 ? '촬영 모드 — 실내등 켬(5000K)' : '무대 모드 — 실내등 끔'}</span>
    </figcaption>
  </figure>`;
}

/** 카메라 축 판정용 인물 실루엣 — 「인물이 돋보이고 깊이가 산다」(정본 §4 후면 벽 원칙)를 눈으로 재게. */
function 사람실루엣() {
  return `
        <svg class="사람" viewBox="0 0 120 200" aria-label="촬영 인물 실루엣(카메라 축 판정용)">
          <g fill="#0b0908">
            <circle cx="60" cy="30" r="19"/>
            <path d="M60 52c-21 0-34 13-37 33l-6 42c-1 8 4 13 11 13h64c7 0 12-5 11-13l-6-42c-3-20-16-33-37-33z"/>
          </g>
          <g fill="none" stroke="${CORAL_SOFT}" stroke-width="2" opacity=".42">
            <path d="M41 22a19 19 0 0 1 19-9"/>
            <path d="M25 92c2-16 9-28 20-34"/>
          </g>
        </svg>`;
}

const 안내 = (제목, 몸) => `<div class="쪽지"><b>${제목}</b>${몸}</div>`;

const HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>네온사인 색 — 코랄 단색 확정 (2026-08-31)</title>
<style>
  :root{
    --coral:${CORAL}; --coral-soft:${CORAL_SOFT}; --paper:${PAPER};
    --ink-deep:${INK_DEEP};
    --본문:${본문스택}; --모노:${모노스택};
  }
  *{box-sizing:border-box}
  body{
    margin:0; padding:32px 24px 72px; background:${INK_DEEP}; color:${PAPER};
    font-family:var(--본문); font-weight:500; letter-spacing:-.02em; line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }
  .폭{max-width:1180px; margin:0 auto}
  h1{font-size:30px; font-weight:800; letter-spacing:-.04em; margin:0 0 6px}
  .머리설명{color:#b7ada4; margin:0 0 4px; font-size:15px}
  .머리설명 b{color:var(--paper); font-weight:600}
  .꼬리표{
    font-family:var(--모노); font-size:11px; letter-spacing:.18em; text-transform:uppercase;
    color:var(--coral); margin:0 0 14px;
  }
  .고정{
    margin:16px 0 0; padding:11px 15px; border-radius:10px;
    background:#100d0c; border:1px solid #262019; font-size:14px; color:#c6bcb4;
  }
  .고정 b{color:var(--paper); font-weight:700}

  .격자{display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin:22px 0 0}
  @media (max-width:900px){ .격자{grid-template-columns:1fr} }

  .장면{margin:0}
  .무대{
    position:relative; aspect-ratio:16/10; border-radius:14px; overflow:hidden;
    background:#000; box-shadow:0 10px 34px rgba(0,0,0,.5);
  }
  .벽{position:absolute; inset:0 0 22% 0; background:var(--벽); overflow:hidden}
  /* 흡음 패널 세로 리브 — 정본 §4 「질감 = 흡음 패널 또는 템바보드」 */
  .리브결{
    position:absolute; inset:0;
    background:repeating-linear-gradient(90deg,
      transparent 0 15px, var(--리브) 15px 17px, transparent 17px 32px);
  }
  .뿌린빛{
    position:absolute; inset:0;
    background:radial-gradient(ellipse 66% 46% at 50% 44%,
      rgba(var(--뿌림색),var(--뿌림)) 0%, rgba(var(--뿌림색),0) 70%);
    mix-blend-mode:screen;
  }
  .네온{
    position:absolute; left:50%; top:44%; transform:translate(-50%,-50%);
    width:52%; height:auto; overflow:visible;
  }
  /* 🔑 사람은 «벽» 안이 아니라 «무대» 안에 둔다 — 벽 박스(inset 0 0 22% 0) 안에 두면
     발이 바닥 시작선에서 잘려 «벽에 떠 있는» 그림이 된다(첫 판 실측). 바닥에 서게 한다. */
  .사람{position:absolute; right:3.5%; bottom:14%; height:56%; width:auto}
  .바닥{
    position:absolute; left:0; right:0; bottom:0; height:22%;
    background:linear-gradient(180deg, var(--바닥) 0%, #0b0a09 100%);
  }
  /* 걸레받이 그림자 — 벽과 바닥이 칼로 자른 듯 만나면 깊이가 안 산다 */
  .바닥:before{
    content:""; position:absolute; left:0; right:0; top:0; height:14px;
    background:linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,0));
  }
  /* 무광 PVC 바닥이라 반사는 «약하고 넓게» — 정본 §1 「무광 필수」 */
  .반사{
    position:absolute; inset:0;
    background:radial-gradient(ellipse 40% 120% at 50% 0%,
      rgba(var(--뿌림색),.28) 0%, rgba(var(--뿌림색),0) 72%);
    filter:blur(7px);
  }

  figcaption{display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-top:10px; font-size:14px}
  figcaption b{font-weight:700}
  figcaption .모드{color:#9a908a; font-size:13px}

  .판정{display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin-top:30px}
  @media (max-width:900px){ .판정{grid-template-columns:1fr} }
  .칸{border:1px solid #262019; border-radius:12px; padding:16px 18px; background:#0e0c0b}
  .칸 h3{margin:0 0 10px; font-size:16px; font-weight:700}
  .칸 ul{margin:0; padding-left:18px}
  .칸 li{margin:5px 0; font-size:14px; color:#cdc4bc}
  .칸 li b{color:var(--paper)}
  .얻:before{content:"얻는 것 — "; color:var(--coral-soft); font-weight:600}
  .잃:before{content:"대가 — "; color:#e2a08f; font-weight:600}

  .쪽지{
    margin-top:26px; border-left:3px solid var(--coral); padding:12px 16px;
    background:#100d0c; border-radius:0 10px 10px 0; font-size:14px; color:#c6bcb4;
  }
  /* 🔑 첫 자식으로 좁힌다 — 그냥 .쪽지 b 로 두면 본문 한가운데 강조까지 block 이 되어
     문장이 통째로 줄바꿈된다(첫 판 실측). */
  .쪽지 > b:first-child{display:block; color:var(--paper); font-weight:700; margin-bottom:5px}
  .쪽지 b{color:var(--paper); font-weight:700}
  .쪽지.정정{border-left-color:#e2a08f}
  code{font-family:var(--모노); font-size:12.5px; color:var(--coral-soft)}
  .견본{display:inline-block; width:11px; height:11px; border-radius:3px; vertical-align:-1px; margin-right:4px; border:1px solid rgba(255,255,255,.22)}
</style>
</head>
<body>
<div class="폭">

  <p class="꼬리표">✅ 닫힌 판정 · 2026-08-31 · 공간설계 §6 표 D</p>
  <h1>네온사인 색 — <span style="color:${CORAL}">코랄 단색</span>으로 정해졌습니다</h1>
  <p class="머리설명">
    <b>유호님 확정 2026-08-31</b> — 「㉡ 코랄 단색으로 갈게」. A실 <b>후면 벽</b>(메인 촬영 배경)에
    걸릴 SYNK 네온은 <code><span class="견본" style="background:${CORAL}"></span>Coral ${CORAL}</code>
    <b>한 색</b>입니다. <b>네온 발주가 열렸습니다.</b>
  </p>
  <p class="머리설명">
    아래는 <b>무엇을 보고 골랐나</b>의 기록입니다 — 두 안을 메인 룸 위에 얹어 굽고 눈으로 골랐습니다
    (정본 v6 §4 가 시킨 절차). 급소는 <b>조명이 켜졌을 때와 꺼졌을 때가 갈린다</b>는 것이라
    네 장면을 한 화면에 뒀습니다. 윗줄이 <b>촬영 모드</b>(실내등 5000K 켬), 아랫줄이 <b>무대 모드</b>(실내등 끔).
  </p>

  <p class="고정">
    🔒 <b>벽은 이 판정의 변수가 아니었습니다</b> — 후면 벽은 이미
    <code><span class="견본" style="background:${INK_DEEP}"></span>Ink Deep ${INK_DEEP}</code>
    <b>흡음 패널(펠트 면)</b>로 정해져 있습니다(정본 §4 「딥 블랙 또는 다크 그레이 · 흡음 패널」 ·
    공간설계 §6 표 D). <b>기존 벽에 무엇이 칠해져 있든 펠트 패널이 덮습니다</b> — 매물이 아직
    안 정해진 것은 이 자리의 차단자가 아니었습니다.
  </p>

  <div class="격자">
    ${장면({ 안: '두색', 조명: '촬영', 사람: true })}
    ${장면({ 안: '단색', 조명: '촬영', 사람: true })}
    ${장면({ 안: '두색', 조명: '무대', 사람: false })}
    ${장면({ 안: '단색', 조명: '무대', 사람: false })}
  </div>

  <div class="판정">
    <div class="칸">
      <h3 style="opacity:.72">㉠ 코랄 + 크림 — <b>뺀 안</b> <code><span class="견본" style="background:${CORAL}"></span>${CORAL}</code> <code><span class="견본" style="background:${PAPER}"></span>${PAPER}</code></h3>
      <ul>
        <li class="얻"><b>이름이 또렷하게 읽힙니다.</b> 밝은 크림 테두리가 글자를 벽에서 떼어 냅니다 — 로고 정본이 「이름은 읽혀야 한다」로 옛 워드마크를 은퇴시킨 그 기준입니다.</li>
        <li class="얻">멀리서·작은 화면에서 <b>형태가 안 뭉갭니다.</b> 릴·숏폼 배경으로 자주 쓰일 벽입니다.</li>
        <li class="얻">v4.1 이 처음 정했던 <b>두 색 구조를 그대로 잇습니다</b>(오렌지+웜크림 → 코랄+크림).</li>
        <li class="잃"><b>브랜드 색이 덜 강하게 남습니다.</b> 크림이 면적을 나눠 가져서, 사진 한 장만 보면 「코랄 브랜드」라는 인상이 약해집니다.</li>
        <li class="잃">제작이 <b>한 겹 더 듭니다</b> — 두 색 LED는 단색보다 견적이 올라갑니다(폭은 업체 견적에서 잽니다 · 안 재봤습니다).</li>
      </ul>
    </div>
    <div class="칸">
      <h3>✅ ㉡ 코랄 단색 — <b style="color:${CORAL}">채택</b> <code><span class="견본" style="background:${CORAL}"></span>${CORAL}</code></h3>
      <ul>
        <li class="얻"><b>브랜드 색이 통째로 남습니다.</b> 어두운 벽 위 코랄 하나라 사진 한 장이 곧 브랜드입니다.</li>
        <li class="얻"><b>단순해서 제작·수리가 쉽습니다.</b> 색이 하나면 나중에 한 구간만 갈아 끼울 때도 값이 쌉니다.</li>
        <li class="얻">앱·영상의 어둠(Ink Deep)과 <b>같은 값</b>이라 화면과 벽이 이어집니다.</li>
        <li class="잃">무대 모드에서 <b>글자가 빛에 살짝 번져 보입니다</b>(아랫줄 오른쪽). 코랄이 어두운 벽과 명도 차가 크지 않아서입니다.</li>
        <li class="잃">작게 찍히면 <b>글자 속이 메워져 보일</b> 수 있습니다 — 테두리가 없어서요.</li>
      </ul>
    </div>
  </div>

  ${안내('🔴 첫 판(08-30)은 이 둘을 «벽 색»으로 그렸습니다 — 오독이었고, 이 판이 정정본입니다',
    '정본 v5 문면이 <code>㉠ 코랄 네온 + 크림 / ㉡ 코랄 네온 + Ink Deep 벽</code> 인데 ' +
    '<b>㉡ 에만 「벽」이 붙어 있어</b> ㉠ 의 크림도 벽으로 읽었습니다. 유래를 파니 답이 나왔습니다 — ' +
    'v4.1 원문 125줄이 <b>「SYNK 네온사인 — 오렌지 #FF6D00 + 웜크림 #F5F1E8 LED」</b> 입니다. ' +
    '네온이 처음부터 «두 색 LED» 였고, v5 는 그 폐기색 둘을 킷 현행(코랄·크림)으로 옮긴 것입니다. ' +
    '⇒ 갈리는 것은 벽이 아니라 <b>네온 자체의 색 구성</b>입니다.')}

  ${안내('뺀 안 ㉠ 을 그린 방식 — 근거로 남깁니다',
    'v4.1 은 「오렌지 + 웜크림」으로 <b>주·보조만</b> 정했을 뿐, 어디에 무엇을 쓰는지는 안 적었습니다. ' +
    '그래서 가장 흔한 꼴 — <b>글자 = 코랄(주) · 아웃라인 = 크림(보조)</b> — 으로 그렸습니다. ' +
    '뒤집은 판(글자 크림 · 아웃라인 코랄)은 <b>안 그렸습니다</b> — 채택이 ㉡ 으로 갈려 필요가 없어졌습니다. ' +
    '나중에 ㉠ 을 다시 볼 일이 생기면 그 나눔부터 정해야 합니다.')}

  ${안내('이 그림은 «근사»입니다 — 그대로 발주하지 않습니다',
    'CSS·SVG 로 그린 것이라 실제 네온의 광량·색온도와 같지 않습니다. <b>가르는 데</b> 쓰고, ' +
    '고르신 뒤 업체 실물 샘플을 한 번 더 봅니다. 네온 형태는 로고 정본' +
    '(<code>tools/lib/로고정본.js</code>)이 그리는 워드마크 그대로이고, 색은 ' +
    '<code>docs/디자인_토큰.json</code> 에서 읽었습니다 — 이 지면이 옛 색을 들고 있을 수 없습니다.')}

  ${안내('✅ 무엇이 닫혔나 (2026-08-31)',
    '<b>인테리어 정본</b>이 <b>v6</b> 으로 오르며 §4 「벽에 굽는 색」이 확정으로 바뀌었고(머리 「아직 못 정한 것」도 «없다»로), ' +
    '<code>docs/공간설계_v1.md</code> 의 §6 표 D(사양표) 네온 칸 · §8 2차 25% 발주 줄 · §11 합의 1번이 같이 닫혔습니다. ' +
    '§9 유호님 몫 15번은 <b>그 자리에서 걷었습니다</b>(끝낸 줄은 남기지 않습니다). ' +
    '확정은 <code>docs/_ops/결정.md</code> 에 등재했습니다. ' +
    '곁들여 정본 문면의 그 두 줄도 <b>«벽으로 안 읽히게» 다시 썼습니다</b> — 08-30 에 제가 걸린 자리입니다.')}

  ${안내('🔴 아직 남은 자리 하나 — 네온 «타입»',
    '<b>유리 튜브인가 아크릴 LED인가</b>는 아직 아무 데도 안 정해져 있습니다. ' +
    '이 그림은 «채워진 글자 + 발광»(아크릴 LED 쪽)으로 그렸습니다 — ' +
    '유리 튜브면 글자가 <b>선</b>으로 그려져 훨씬 가늘어지고, 같은 코랄이라도 인상이 달라집니다. ' +
    '<b>발주 전에 한 번 더 여쭙겠습니다.</b>')}

  <p style="margin-top:34px; font-size:12.5px; color:#7d736c; font-family:var(--모노); letter-spacing:.02em">
    node tools/네온시안.js · 정본 = 07_SYNK_메인룸_인테리어.txt v6 §4 · 판정 닫힘 2026-08-31
  </p>
</div>
</body>
</html>
`;

const 출력 = path.join(루트, 'docs', '네온색_판정_2026-08-30.html');
fs.writeFileSync(출력, HTML, 'utf8');
console.log(`[네온시안] 구웠다 → ${path.relative(루트, 출력)}  (${(HTML.length / 1024).toFixed(1)}KB · 장면 4)`);
console.log(`           ㉠ 코랄 ${CORAL} + 크림 ${PAPER}  ·  ㉡ 코랄 ${CORAL} 단색`);
console.log(`           벽은 고정 = Ink Deep ${INK_DEEP} 흡음 패널  (전부 디자인_토큰.json 에서 읽음)`);
