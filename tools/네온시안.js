#!/usr/bin/env node
/**
 * 네온시안 — A실 후면 벽 네온사인 «두 안»을 나란히 굽는다 (2026-08-30)
 *
 * 왜 있나: 인테리어 정본 v5 가 네온 색을 **「아직 정하지 않았다」**로 두고
 *   「두 안을 메인 룸 위에 얹어 **굽고 눈으로 고른다** · 네온 발주는 이 판정 뒤다」라고 못박았다
 *   (`docs/정본/…/07_SYNK_메인룸_인테리어.txt` §4 「벽에 굽는 색」).
 *   그런데 파생인 `docs/공간설계_v1.md` 는 §6 사양표에 네온을 **Coral 확정**으로 박고
 *   §8 2차 발주에도 넣어 뒀다(08-30 에 미정으로 되돌렸다 · §9 유호님 몫 15번).
 *   이 파일은 그 「굽는다」를 집행한다.
 *
 * 🔑 색·로고를 여기 다시 적지 않는다 — `docs/디자인_토큰.json` 과 `tools/lib/로고정본.js` 에서 읽는다.
 *   베껴 두면 킷이 바뀌는 날 시안만 옛 색으로 남고, 유호님이 «옛 그림으로 새 판을 판정»하시게 된다.
 *
 * 🔑 왜 2×2 인가 — 이 판정의 급소는 «벽 색»이 아니라 **조명이 켜졌을 때와 꺼졌을 때가 갈린다**는 것이다.
 *   토글로 만들면 유호님이 앞 장면을 «기억»으로 비교하셔야 한다. 네 장면을 한 화면에 둔다.
 *
 * ⚠ 이 지면은 **근사**다 — 실측 렌더가 아니라 CSS/SVG 로 그린 것이라 실제 네온의 광량·색온도와
 *   같지 않다. 가르는 데 쓰고, 발주 전에는 업체 실물 샘플을 한 번 더 본다. 그 사실을 지면에 적는다.
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
const INK = 색['Ink'];

/** 한 장면(벽 색 × 조명)을 그린다.
 *  @param {object} o
 *  @param {'크림'|'잉크'} o.벽    벽 갈래
 *  @param {'촬영'|'무대'} o.조명  조명 모드(촬영 = 5000K 켜짐 · 무대 = 실내등 끔)
 */
function 장면({ 벽, 조명, 사람 }) {
  const 잉크 = 벽 === '잉크';
  const 켜짐 = 조명 === '촬영';

  /* 벽 바탕 — 크림은 반사율이 높아 실내등을 끄면 어두워지되 **회색이 아니라 네온을 받은 따뜻한 톤**이
   * 된다(무채색으로 두면 실물과 다르고, 그게 이 판정의 급소인 「크림은 색이 샌다」를 못 보이게 한다).
   * 잉크는 반사율이 낮아 거의 검은 채로 남는다. */
  const 벽색 = 잉크
    ? (켜짐 ? '#14100f' : '#080605')
    : (켜짐 ? PAPER : '#6f5c55');
  // 흡음 패널 리브(세로) — 정본 §4 「질감 = 흡음 패널 또는 템바보드」.
  const 리브 = 잉크
    ? 'rgba(255,255,255,.045)'
    : (켜짐 ? 'rgba(43,35,32,.085)' : 'rgba(43,35,32,.16)');
  // 네온이 벽에 뿌리는 빛 — 어두울수록 세고, 크림 벽은 더 넓게 물든다(반사율).
  const 뿌림세기 = 켜짐 ? (잉크 ? 0.34 : 0.16) : (잉크 ? 0.62 : 0.78);
  const 뿌림반경 = 잉크 ? 62 : 78;
  /* 튜브 면 — 켜진 네온은 «글자가 밝고 주변이 색으로 물든다». 그래서 조명을 끄면 글자 면이
   * 코랄에서 Coral Soft 쪽으로 타오르고, 글로우가 세진다. 촬영 모드에선 실내광이 세서
   * 글자 면이 제 색(Coral)으로 보인다 — 그 차이가 이 판정의 절반이다. */
  const 면색 = 켜짐 ? CORAL : CORAL_SOFT;
  const 글로우 = 켜짐 ? 0.72 : 1;
  const 바닥색 = 켜짐 ? '#2a2724' : '#141210';

  const uid = `${벽}-${조명}`;

  return `
  <figure class="장면" data-벽="${벽}" data-조명="${조명}">
    <div class="무대"
         style="--벽:${벽색}; --리브:${리브}; --바닥:${바닥색};
                --뿌림:${뿌림세기}; --반경:${뿌림반경}%;">
      <div class="벽">
        <div class="리브결" aria-hidden="true"></div>
        <div class="뿌린빛" aria-hidden="true"></div>
        <svg class="네온" viewBox="${뷰박스}" role="img" aria-label="SYNK 네온사인 ${벽} 벽 ${조명} 모드">
          <defs>
            <filter id="glow-${uid}" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" result="b1"/>
              <feGaussianBlur stdDeviation="6"   result="b2"/>
              <feGaussianBlur stdDeviation="14"  result="b3"/>
              <feMerge>
                <feMergeNode in="b3"/><feMergeNode in="b2"/><feMergeNode in="b1"/>
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#glow-${uid})" opacity="${글로우}">
            <path d="${워드패스[0]}" fill="${CORAL}"/>
            <path d="${워드패스[1]}" fill="${CORAL}"/>
          </g>
          <g>
            <path d="${워드패스[0]}" fill="${면색}" stroke="${CORAL_RIM}" stroke-width=".7" stroke-opacity=".55"/>
            <path d="${워드패스[1]}" fill="${면색}" stroke="${CORAL_RIM}" stroke-width=".7" stroke-opacity=".55"/>
          </g>
        </svg>
      </div>
      <div class="바닥"><div class="반사" aria-hidden="true"></div></div>
      ${사람 ? 사람실루엣(잉크, 켜짐) : ''}
    </div>
    <figcaption>
      <b>${잉크 ? '㉡ Ink Deep 벽' : '㉠ 크림 벽'}</b>
      <span class="모드">${켜짐 ? '촬영 모드 — 실내등 켬(5000K)' : '무대 모드 — 실내등 끔'}</span>
    </figcaption>
  </figure>`;
}

/** 카메라 축 판정용 인물 실루엣 — 「인물이 돋보이고 깊이가 산다」(정본 §4 후면 벽 원칙)를 눈으로 재게. */
function 사람실루엣(잉크, 켜짐) {
  // 크림 벽 + 조명 켬 = 인물이 밝은 배경에 «묻힌다». 그 대비를 값으로 만든다.
  const 몸색 = 켜짐 ? (잉크 ? '#0e0c0b' : '#3b352f') : (잉크 ? '#000' : '#2a2521');
  const 림 = 켜짐 ? 0.18 : 0.5;
  return `
        <svg class="사람" viewBox="0 0 120 200" aria-label="촬영 인물 실루엣(카메라 축 판정용)">
          <g fill="${몸색}">
            <circle cx="60" cy="30" r="19"/>
            <path d="M60 52c-21 0-34 13-37 33l-6 42c-1 8 4 13 11 13h64c7 0 12-5 11-13l-6-42c-3-20-16-33-37-33z"/>
          </g>
          <g fill="none" stroke="${CORAL_SOFT}" stroke-width="2" opacity="${림}">
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
<title>네온사인 색 — 두 안 (2026-08-30)</title>
<style>
  :root{
    --coral:${CORAL}; --coral-soft:${CORAL_SOFT}; --paper:${PAPER};
    --ink:${INK}; --ink-deep:${INK_DEEP};
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

  .격자{
    display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin:26px 0 0;
  }
  @media (max-width:900px){ .격자{grid-template-columns:1fr} }

  .장면{margin:0}
  .무대{
    position:relative; aspect-ratio:16/10; border-radius:14px; overflow:hidden;
    background:#000; box-shadow:0 10px 34px rgba(0,0,0,.5);
  }
  .벽{
    position:absolute; inset:0 0 22% 0; background:var(--벽); overflow:hidden;
  }
  /* 흡음 패널 세로 리브 — 정본 §4 「질감 = 흡음 패널 또는 템바보드」 */
  .리브결{
    position:absolute; inset:0;
    background:repeating-linear-gradient(90deg,
      transparent 0 15px, var(--리브) 15px 17px, transparent 17px 32px);
  }
  /* 네온이 벽에 뿌리는 빛 */
  .뿌린빛{
    position:absolute; inset:0;
    background:radial-gradient(ellipse var(--반경) 46% at 50% 44%,
      rgba(249,104,89,var(--뿌림)) 0%, rgba(249,104,89,0) 70%);
    mix-blend-mode:screen;
  }
  .네온{
    position:absolute; left:50%; top:44%; transform:translate(-50%,-50%);
    width:52%; height:auto; overflow:visible;
  }
  /* 🔑 사람은 «벽» 안이 아니라 «무대» 안에 둔다 — 벽 박스(inset 0 0 22% 0) 안에 두면
     발이 바닥 시작선에서 잘려 «벽에 떠 있는» 그림이 된다(첫 판 실측). 바닥에 서게 한다. */
  .사람{
    position:absolute; right:3.5%; bottom:14%; height:56%; width:auto;
  }
  /* 걸레받이 그림자 — 벽과 바닥이 칼로 자른 듯 만나면 깊이가 안 산다 */
  .바닥:before{
    content:""; position:absolute; left:0; right:0; top:0; height:14px;
    background:linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,0));
  }
  .바닥{
    position:absolute; left:0; right:0; bottom:0; height:22%;
    background:linear-gradient(180deg, var(--바닥) 0%, #0b0a09 100%);
  }
  /* 무광 PVC 바닥이라 반사는 «약하고 넓게» — 정본 §1 「무광 필수」 */
  .반사{
    position:absolute; inset:0;
    background:radial-gradient(ellipse 40% 120% at 50% 0%,
      rgba(249,104,89,.30) 0%, rgba(249,104,89,0) 72%);
    filter:blur(7px);
  }

  figcaption{
    display:flex; align-items:baseline; gap:10px; flex-wrap:wrap;
    margin-top:10px; font-size:14px;
  }
  figcaption b{font-weight:700}
  figcaption .모드{color:#9a908a; font-size:13px}

  .판정{
    display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin-top:30px;
  }
  @media (max-width:900px){ .판정{grid-template-columns:1fr} }
  .칸{
    border:1px solid #262019; border-radius:12px; padding:16px 18px; background:#0e0c0b;
  }
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
  /* 🔑 첫 자식으로 좁힌다 — 그냥 .쪽지 b 로 두면 **본문 한가운데 강조까지 block 이 되어**
     문장이 통째로 줄바꿈된다(첫 판 실측: 「가르는 데」·「네온 발주는 이 판정 뒤」가 튀어나왔다). */
  .쪽지 > b:first-child{display:block; color:var(--paper); font-weight:700; margin-bottom:5px}
  .쪽지 b{color:var(--paper); font-weight:700}
  code{font-family:var(--모노); font-size:12.5px; color:var(--coral-soft)}
  .견본{display:inline-block; width:11px; height:11px; border-radius:3px; vertical-align:-1px; margin-right:4px; border:1px solid rgba(255,255,255,.22)}
</style>
</head>
<body>
<div class="폭">

  <p class="꼬리표">발주 전 판정 · 공간설계 §9-15</p>
  <h1>네온사인 색 — 두 안 중 하나를 골라 주세요</h1>
  <p class="머리설명">
    A실 <b>후면 벽</b>(메인 촬영 배경)에 걸릴 SYNK 네온입니다. 네온 색은 <b>둘 다 코랄</b>
    <code><span class="견본" style="background:${CORAL}"></span>${CORAL}</code> 로 같고,
    <b>갈리는 것은 «벽 색»</b> 하나입니다.
  </p>
  <p class="머리설명">
    급소는 벽 색 자체가 아니라 <b>조명이 켜졌을 때와 꺼졌을 때가 갈린다</b>는 것이라, 네 장면을 한 화면에 뒀습니다.
    윗줄이 <b>촬영 모드</b>(실내등 5000K 켬), 아랫줄이 <b>무대 모드</b>(실내등 끔)입니다.
  </p>

  <div class="격자">
    ${장면({ 벽: '크림', 조명: '촬영', 사람: true })}
    ${장면({ 벽: '잉크', 조명: '촬영', 사람: true })}
    ${장면({ 벽: '크림', 조명: '무대', 사람: false })}
    ${장면({ 벽: '잉크', 조명: '무대', 사람: false })}
  </div>

  <div class="판정">
    <div class="칸">
      <h3>㉠ 크림 벽 <code><span class="견본" style="background:${PAPER}"></span>${PAPER}</code></h3>
      <ul>
        <li class="얻"><b>낮의 방이 밝고 넓어 보인다.</b> 13평 방에서 이건 작지 않다.</li>
        <li class="얻">브랜드 종이색이라 <b>로비·인쇄물과 한 벌</b>로 이어진다.</li>
        <li class="잃">촬영 모드에서 <b>글자는 읽히는데 «빛나 보이지 않습니다»</b> — 윗줄 왼쪽입니다. 밝은 벽이 글로우를 먹어서, 네온을 켠 값이 화면에 안 남습니다.</li>
        <li class="잃">인물 실루엣이 <b>밝은 배경에 눌립니다</b>. 정본 §4 가 후면 벽에 「딥 블랙 또는 다크 그레이 — 인물이 돋보이고 깊이가 산다」를 적어 둔 까닭입니다.</li>
        <li class="잃">무대 모드에선 벽이 <b>네온 빛을 넓게 받아 물듭니다</b>(아랫줄 왼쪽). 분위기로 볼 수도 있고, 색이 새는 것으로 볼 수도 있습니다.</li>
      </ul>
    </div>
    <div class="칸">
      <h3>㉡ Ink Deep 벽 <code><span class="견본" style="background:${INK_DEEP}"></span>${INK_DEEP}</code></h3>
      <ul>
        <li class="얻"><b>네온이 두 모드 다 산다.</b> 촬영에서도 대비가 안 죽습니다.</li>
        <li class="얻"><b>인물이 뜬다</b> — 후면 벽의 본래 일(메인 촬영 배경)에 곧장 맞습니다.</li>
        <li class="얻">세계관 첫 화면의 어둠과 <b>같은 값</b>이라 앱·영상과 벽이 이어집니다.</li>
        <li class="잃">방이 <b>좁고 무겁게</b> 느껴질 수 있습니다 — 후면 한 면만이라 커튼·미러가 있는 다른 세 면이 균형을 잡아 주지만, 실물에서 다시 볼 자리입니다.</li>
        <li class="잃">먼지·손자국이 <b>잘 보인다</b>. 무광 마감이라 닦는 손이 늘어납니다.</li>
      </ul>
    </div>
  </div>

  ${안내('이 그림은 «근사»입니다 — 그대로 발주하지 않습니다',
    'CSS·SVG 로 그린 것이라 실제 네온의 광량·색온도와 같지 않습니다. ' +
    '<b>가르는 데</b> 쓰고, 고르신 뒤 업체 실물 샘플을 한 번 더 봅니다. ' +
    '네온 형태는 로고 정본(<code>tools/lib/로고정본.js</code>)이 그리는 워드마크 그대로이고, ' +
    '색은 <code>docs/디자인_토큰.json</code> 에서 읽었습니다 — 이 지면이 옛 색을 들고 있을 수 없습니다.')}

  ${안내('고르시면 어디가 움직이나',
    '<code>docs/공간설계_v1.md</code> §6 표 D(사양표)의 네온 칸 · §8 2차 25% 발주 줄 · §9 유호님 몫 15번, ' +
    '그리고 인테리어 정본 §4 「벽에 굽는 색」이 한 커밋에서 같이 닫힙니다. ' +
    '<b>네온 발주는 이 판정 뒤</b>라고 정본이 못박아 둔 자리입니다.')}

  ${안내('한 가지 더 — 이 판정에 안 든 것',
    '네온 <b>타입</b>(유리 튜브 / 아크릴 LED)은 아직 아무 데도 안 정해져 있습니다. ' +
    '이 그림은 «채워진 글자 + 발광»(아크릴 LED 쪽)으로 그렸습니다. ' +
    '유리 튜브면 글자가 <b>선</b>으로 그려져 훨씬 가늘어집니다 — 색을 고르신 뒤 따로 여쭙겠습니다.')}

  <p style="margin-top:34px; font-size:12.5px; color:#7d736c; font-family:var(--모노); letter-spacing:.02em">
    node tools/네온시안.js · 정본 = 07_SYNK_메인룸_인테리어.txt v5 §4 · 2026-08-30
  </p>
</div>
</body>
</html>
`;

const 출력 = path.join(루트, 'docs', '네온색_판정_2026-08-30.html');
fs.writeFileSync(출력, HTML, 'utf8');
console.log(`[네온시안] 구웠다 → ${path.relative(루트, 출력)}  (${(HTML.length / 1024).toFixed(1)}KB · 장면 4)`);
console.log(`           네온 ${CORAL} · ㉠ 벽 ${PAPER} · ㉡ 벽 ${INK_DEEP}  (전부 디자인_토큰.json 에서 읽음)`);
