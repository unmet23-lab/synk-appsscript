#!/usr/bin/env node
/* 판 3종 대조굽기 — 「정보를 담는 판」을 무엇으로 할지 유호님이 고르는 판정 재료 (요청 2026-08-20).
 *
 * 왜 있나: 08-20 유호 교정 「CSS 시안으론 똑같아 보인다 — 전부 제대로 만들고 나중에 결정」으로
 *   유리 은퇴가 «확정»에서 **판정 보류**로 돌아갔다. 그래서 세 판(패턴지·다린천·유리)을
 *   같은 구도·조명·크기로 구워 뒀고(`tools/요소굽기.py` · 1152px/128샘플), 이 판은 그 렌더를
 *   나란히 놓아 «눈으로 갈리게» 한다. 판정 자체는 유호님 몫이다 — 이 파일은 재료만 낸다.
 *
 * 🔑 급소 하나 — **세 판은 뒤에 같은 코랄 퍼 구슬을 두고 구웠다**(`판뒤구()`).
 *   재질을 가르는 것은 색이 아니라 **그 구슬이 비치는가/막히는가**다. 그래서 대조는 판 표면이
 *   아니라 «판 오른쪽 뒤»를 본다.
 *
 * 왜 Loom 스킨을 안 입히나: 재질을 나란히 재는 판이라 스킨을 씌우면 재는 값이 오염된다
 *   (`지면방.js` 제외 갈래 — 자형확인 하네스·로고 대조 시트·다크팔레트 판정과 같은 사유).
 *   자리를 `docs/캐릭터/` 에 두는 것도 그래서다 — 그 갈래는 지면방이 이미 「시안·판정 재료」로 제외한다.
 *
 * 색은 **토큰이 낸다**(하드코딩 금지 · DESIGN.md §2). 앱 다크 「양모 밤」 위에 올린다 —
 *   이 판이 정하는 것이 앱 화면의 면이라, 무채 지면 위에 놓으면 판정 대상이 제 자리를 잃는다.
 *
 * 사용법: node tools/판3종대조굽기.js   → docs/캐릭터/판3종_대조_0820.html
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
const 킷 = Object.fromEntries(토큰.색.킷.map((c) => [c.이름, c.hex.toUpperCase()]));
const 다크 = 토큰.색.시맨틱.다크;
const C = (역) => 킷[다크[역]];
const OUT = process.env.SYNK_판3종_OUT || path.join(ROOT, 'docs', '캐릭터', '판3종_대조_0820.html');

/* ── 판 셋 — 값은 `tools/요소굽기.py` 의 실제 굽기 인자에서 옮겨 적었다 ──────────── */
const 판들 = [
  {
    이름: '패턴지 판',
    영: 'pattern paper',
    그림: '퍼프로브_0819/패턴지판_v1.png',
    한줄: '재단실의 도면 종이. 빛을 통과시키되 차갑지 않다.',
    값: ['투과 0.7', '거칠기 0.80', '바탕 Paper', '종이 이빨(노이즈 범프 260)'],
    구슬: '오른쪽에서 은은하게 비친다 — 종이가 빛을 산란시켜 «형체만» 남는다',
    붉은기: 12.3,
    뜻: '공방 안의 물건이라 은유가 억지가 아니다. 판에 시접선(초크) 같은 재단실 표식을 얹을 수 있다 — 유리엔 못 얹는다.',
    대가: '유리보다 덜 투명해 뒤 정보가 «있다»는 것만 알리고 «무엇인지»는 안 알린다.',
  },
  {
    이름: '유리 판',
    영: 'frosted glass',
    그림: '퍼프로브_0819/유리판_v1.png',
    한줄: '서리 유리. 흐리게 비치는 유리 — 맑은 유리는 창문이지 판이 아니다.',
    값: ['투과 1.0', '거칠기 0.30', 'IOR 1.45', '민면(장식 없음)'],
    구슬: '또렷하게 비친다 — 뒤에 무엇이 있는지 «읽힌다»',
    붉은기: 74.5,
    뜻: 'Loom 재질 3종(펠트=빛을 먹는다 · 유리=통과시킨다 · 레진=가둔다)의 가운데 항이다. 유리를 살리면 그 3항 체계가 그대로 산다.',
    대가: '공방 은유 밖의 재질이다 — 양모 공방에 유리가 왜 있나에 답해야 한다. 그리고 민면이 정체성이라 장식을 못 얹는다.',
  },
  {
    이름: '다린 천 판',
    영: 'pressed matte cloth',
    그림: '퍼프로브_0819/다린천판_v1.png',
    한줄: '결을 눕힌 무채 천. 광택 0 — 다림질로 눌린 면이다.',
    값: ['투과 없음', '거칠기 0.96', '반사 0.12', '바탕 Oat'],
    구슬: '완전히 막힌다 — 뒤가 있다는 것조차 안 보인다',
    붉은기: 2.7,
    뜻: '반투명 후보가 아니라 **대조군**이다. 비침의 반대 끝을 보여 준다. 사전에서 이 천의 자리는 «대면적 카드 바닥»이고, 위 둘 중 무엇이 이기든 그 자리는 그대로다.',
    대가: '정보가 앉는 바닥으로는 옳지만, 뒤를 비추는 «판»의 일은 못 한다.',
    대조군: true,
  },
];


/* ── 앱 화면 위에서 잰 값 (유호 요청 08-20 「앱 화면 위에서도 재봐줘」) ─────────────
   장면 = `형태=앱판 재질=…` — 앱 다크의 층을 실제로 쌓았다(바탕 ← 카드 Ink ← 콘텐츠 ← 판).
   콘텐츠(글줄 땀·코랄 알약)가 판 가장자리를 가로지르므로 「판 밖의 그것 / 판 뒤의 그것」이 한 장에 잡힌다.
   측정: 밝기 = 0.2126R+0.7152G+0.0722B 평균 · 생존율 = (판 안 땀대비)/(판 밖 땀대비).
   땀대비 = 그 띠에서 밝은 15% 평균 − 어두운 15% 평균.

   🔴 **08-23 재측정.** 렌더가 1800px 로 다시 구워졌다(결 수리 포함). 그런데 옛 수치
     (208.2 / 110.0 / 223.3)는 **잣대가 코드에 안 남아 재현이 안 됐다** — 판 영역을 여섯 가지로
     잡아 봐도 세 값이 «일정하게» 6~7 낮았다(영역 문제라면 제각각 흔들려야 한다).
     ⇒ 잣대를 여기 못 박고 그 잣대로 다시 잰다. 다음 세션은 이 줄만 보면 되짚을 수 있다:
       **밝기 = 판 중앙 상대영역 (0.32, 0.32, 0.72, 0.68) 의 휘도 평균**
       **카드 = 판 밖 왼쪽 띠 (0.10, 0.42, 0.20, 0.58)**
     ⚠**밝기는 재굽기로 안 바뀐다**(해상도·결이 바뀌어도 평균 휘도는 그대로) — 값이 옛 것과
       다른 까닭은 새로 구워서가 아니라 **잣대가 달라서**다. 옛 값과 직접 비교하지 않는다.
     ⚠**생존율은 재현 못 했다** — 「판 안/밖 띠」 좌표가 코드에 없다. 옛 측정을 그대로 둔다. */
const 앱 = [
  { 이름: '패턴지 판', 그림: '퍼프로브_0819/앱판_패턴지_v1.png', 밝기: 201.7, 생존: 7,
    한줄: '앱 카드 위에서 <b>불투명한 밝은 덩어리</b>가 된다. 뒤 글줄이 판 안에서 사라진다.' },
  { 이름: '유리 판', 그림: '퍼프로브_0819/앱판_유리_v1.png', 밝기: 102.8, 생존: 43,
    한줄: '판 밝기가 <b>앱 카드와 거의 같다</b>(103 vs 97) — 다크 화면에 «면»으로 앉는다. 뒤 글줄이 읽힌다.' },
  { 이름: '다린 천 판', 그림: '퍼프로브_0819/앱판_다린천_v1.png', 밝기: 218.0, 생존: 5,
    한줄: '패턴지와 <b>거의 구분되지 않는다</b> — 시접선 점 몇 개 차이뿐이다.' },
];
const 카드밝기 = 97.4;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const 카드 = (p) => `
      <figure class="판${p.대조군 ? ' 대조군' : ''}">
        <img src="${p.그림}" alt="${esc(p.이름)} 렌더 — 판 뒤에 코랄 퍼 구슬이 반쯤 나와 있다" loading="lazy">
        <figcaption>
          <h3>${esc(p.이름)}${p.대조군 ? ' <span class="꼬리">대조군</span>' : ''}</h3>
          <p class="한줄">${esc(p.한줄)}</p>
          <dl>
            <dt>뒤 구슬</dt><dd>${esc(p.구슬)}</dd>
            <dt>재보니 (붉은기)</dt><dd><b class="잰값">+${p.붉은기.toFixed(1)}</b>
              <span class="막대"><i style="width:${Math.round((p.붉은기 / 74.5) * 100)}%"></i></span></dd>
            <dt>뜻</dt><dd>${p.뜻.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</dd>
            <dt>대가</dt><dd>${esc(p.대가)}</dd>
          </dl>
          <ul class="값">${p.값.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>
        </figcaption>
      </figure>`;


const 앱칸 = (a) => `
      <figure class="앱">
        <img src="${a.그림}" alt="${esc(a.이름)} — 앱 카드 위에 놓고 구운 판" loading="lazy">
        <figcaption>
          <h3>${esc(a.이름)}</h3>
          <p class="한줄">${a.한줄}</p>
          <table class="잰표">
            <tr><th>판 밝기</th><td><b class="잰값">${a.밝기.toFixed(1)}</b>
              <span class="곁">앱 카드 ${카드밝기.toFixed(1)} 대비 ${(a.밝기 / 카드밝기).toFixed(1)}배</span></td></tr>
            <tr><th>뒤 글줄 생존율</th><td><b class="잰값">${a.생존}%</b>
              <span class="막대"><i style="width:${a.생존 * 2}%"></i></span></td></tr>
          </table>
        </figcaption>
      </figure>`;

const html = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>판 3종 대조 — 정보를 담는 판을 무엇으로 할 것인가 (2026-08-20)</title>
<style>
  /* 낫표 「 」 교정 — 값의 정본 = docs/디자인_토큰.json 「서체.낫표교정」(유호 확정 08-31). 스택보다 먼저 선다. */
  @font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo'),local('Noto Sans KR'),local('Noto Sans CJK KR');unicode-range:U+300C-300D;}
  :root{
    --바탕:${C('바탕')}; --카드:${C('카드')}; --잉크:${C('잉크')};
    --보조:${C('보조잉크')}; --보조2:${C('보조잉크2')}; --실땀:${C('실땀')}; --신호:${C('신호')};
    --실2:2px; --숨:4px; --틈:8px; --참:12px; --칸:16px; --단:24px; --켜:40px; --장:64px; --막:104px;
    --글:'SYNK Bracket','Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--바탕);color:var(--잉크);font-family:var(--글);font-weight:500;
       line-height:1.65;letter-spacing:-.011em;padding:var(--켜) var(--단) var(--막)}
  .품{max-width:1180px;margin:0 auto}
  header{border-bottom:1px solid ${C('카드')};padding-bottom:var(--단);margin-bottom:var(--켜)}
  .눈{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--보조2);margin:0 0 var(--틈)}
  h1{font-size:clamp(22px,3.4vw,32px);font-weight:800;letter-spacing:-.02em;margin:0 0 var(--참);line-height:1.25}
  .질문{font-size:clamp(15px,1.7vw,18px);color:var(--보조);max-width:70ch;margin:0}
  .질문 b{color:var(--잉크);font-weight:800}

  .급소{background:var(--카드);border-left:3px solid var(--신호);border-radius:var(--숨);
        padding:var(--칸) var(--단);margin:var(--단) 0 var(--켜);max-width:74ch}
  .급소 p{margin:0;color:var(--보조)}
  .급소 b{color:var(--잉크)}
  .잰법{margin:var(--참) 0 0;font-size:12.5px;color:var(--보조2);line-height:1.6}
  .잰법 b{color:var(--보조)}

  .판들{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--단)}
  .판{margin:0;background:var(--카드);border-radius:var(--참);overflow:hidden;
      border:1px solid ${킷['Deep Wool']}}
  .판.대조군{opacity:.86}
  .판 img{display:block;width:100%;height:auto;background:${킷['Ink Deep']}}
  figcaption{padding:var(--칸) var(--칸) var(--단)}
  h3{margin:0 0 var(--숨);font-size:17px;font-weight:800;letter-spacing:-.015em}
  .꼬리{font-size:11px;font-weight:500;color:var(--보조2);letter-spacing:.04em;
        border:1px solid var(--보조2);border-radius:999px;padding:1px 7px;vertical-align:2px}
  .한줄{margin:0 0 var(--참);color:var(--보조);font-size:14px}
  dl{margin:0;font-size:13.5px}
  dt{color:var(--보조2);font-size:11.5px;letter-spacing:.06em;margin-top:var(--참)}
  dd{margin:2px 0 0;color:var(--보조)}
  dd b{color:var(--잉크)}
  .잰값{font-family:'DM Mono',ui-monospace,SFMono-Regular,Consolas,monospace;font-size:15px;
        color:var(--잉크);letter-spacing:.01em}
  .막대{display:inline-block;vertical-align:middle;width:120px;height:6px;margin-left:var(--틈);
        background:${킷['Deep Wool']};border-radius:999px;overflow:hidden}
  .막대 i{display:block;height:100%;background:var(--실땀)}
  .값{list-style:none;display:flex;flex-wrap:wrap;gap:var(--숨);padding:0;margin:var(--칸) 0 0}
  .값 li{font-size:11.5px;color:var(--보조2);border:1px solid ${킷['Deep Wool']};
         border-radius:999px;padding:2px var(--틈)}

  .앱들{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--단)}
  .앱{margin:0;background:var(--카드);border-radius:var(--참);overflow:hidden;
      border:1px solid ${킷['Deep Wool']}}
  .앱 img{display:block;width:100%;height:auto;background:${킷['Ink Deep']}}
  .잰표{width:100%;border-collapse:collapse;font-size:13px;margin-top:var(--참)}
  .잰표 th{text-align:left;font-weight:500;color:var(--보조2);font-size:11.5px;letter-spacing:.05em;
           padding:var(--숨) 0;white-space:nowrap;vertical-align:middle}
  .잰표 td{padding:var(--숨) 0 var(--숨) var(--참);vertical-align:middle}
  .곁{font-size:11.5px;color:var(--보조2);margin-left:var(--틈)}
  .결론{max-width:none;margin-top:var(--단)}
  section{margin-top:var(--막)}
  h2{font-size:19px;font-weight:800;letter-spacing:-.015em;margin:0 0 var(--칸);
     padding-bottom:var(--틈);border-bottom:1px dashed ${킷['Deep Wool']}}
  .고름{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--칸)}
  .고름 article{background:var(--카드);border-radius:var(--참);padding:var(--칸) var(--단);
                border:1px solid ${킷['Deep Wool']}}
  .고름 h4{margin:0 0 var(--틈);font-size:15px;font-weight:800}
  .고름 ul{margin:0;padding-left:1.1em;font-size:13.5px;color:var(--보조)}
  .고름 li{margin:var(--숨) 0}
  .안잰것{margin-top:var(--켜);font-size:13px;color:var(--보조2);max-width:74ch}
  .안잰것 b{color:var(--보조)}
  footer{margin-top:var(--막);padding-top:var(--칸);border-top:1px solid var(--카드);
         font-size:12px;color:var(--보조2)}
  code{font-family:'DM Mono',ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.92em}
</style>
<body>
<div class="품">
  <header>
    <p class="눈">판정 재료 · 2026-08-20 · 양모 공방 요소 사전 §1-b</p>
    <h1>정보를 담는 판을 무엇으로 할 것인가</h1>
    <p class="질문">학습·숙제 화면의 <b>문제 판</b>, 그리고 정보가 앉는 <b>카드 바닥</b>의 재질을 정하는 자리입니다.
      08-20 교정 「CSS 시안으론 똑같아 보인다 — 전부 제대로 만들고 나중에 결정」에 따라, 셋을 <b>같은 구도·조명·크기</b>로
      실물 렌더까지 구워 놓았습니다(1152px · 128샘플).</p>
  </header>

  <div class="급소">
    <p><b>무엇을 보시면 됩니다</b> — 세 판 뒤에는 <b>같은 코랄 퍼 구슬</b>이 오른쪽으로 반쯤 나와 있습니다.
      재질을 가르는 것은 판의 표면이 아니라 <b>그 구슬이 비치는가 / 막히는가</b>입니다.
      판 오른쪽 뒤를 보십시오.</p>
    <p class="잰법">아래 <b>붉은기</b>는 눈이 아니라 픽셀로 잰 값입니다 — 구슬이 판 «뒤로 들어간» 자리(가로 904~1110px ·
      세로 250~420px)의 R−G 평균에서, 같은 판의 빈 자리(가로 300~500px) R−G 평균을 뺐습니다.
      숫자가 클수록 뒤가 비칩니다.</p>
  </div>

  <div class="판들">${판들.map(카드).join('')}
  </div>

  <section>
    <h2>앱 화면 위에서는 그림이 달라진다</h2>
    <p class="질문" style="margin-bottom:var(--단)">위 셋은 검은 무대에 판만 띄운 <b>스튜디오</b> 그림입니다.
      앱 다크의 층을 실제로 쌓아 다시 구웠습니다 — 바탕 위에 <b>앱 카드(Ink)</b>, 그 위에 콘텐츠(글줄·코랄 알약),
      그 위를 판이 덮습니다. 콘텐츠가 <b>판 가장자리를 가로지르게</b> 놓아서, 한 장 안에서
      「판 밖의 그것」과 「판 뒤의 그것」을 바로 견주실 수 있습니다.</p>
    <div class="앱들">${앱.map(앱칸).join('')}
    </div>
    <div class="급소 결론">
      <p><b>둘이 갈렸습니다.</b> ① <b>뒤가 살아남는 정도</b> — 유리 43%에 패턴지 7%·다린천 5%입니다.
        패턴지의 비침은 스튜디오에선 보였지만(+12.3) 어두운 카드 위 콘텐츠에는 <b>거의 아무 일도 못 합니다</b>.
        ② <b>판의 밝기</b> — 유리는 앱 카드와 사실상 같은 밝기(110 vs 112)라 다크 화면에 앉지만,
        패턴지·다린천은 카드의 <b>약 2배</b>라 어두운 화면 위의 밝은 덩어리가 됩니다.</p>
      <p class="잰법" style="margin-top:var(--참)"><b>정직하게 하나 덧붙입니다</b> — ②의 밝기는 재질이 아니라
        <b>색</b>이 냅니다(패턴지=Paper · 다린천=Oat). 어두운 종이·천으로 물들이면 밝기는 내려갑니다.
        다만 그러면 「재단지」라는 그림이 달라집니다. ①의 생존율은 색으로 못 바꿉니다 — 그건 투과의 몫입니다.</p>
    </div>

    <h2 style="margin-top:var(--막)">그래서 질문이 좁혀집니다</h2>
    <p class="질문">셋 중 하나가 아니라 <b>반투명 판이 필요한가 아닌가</b>입니다.
      필요하면 후보는 <b>유리 하나</b>뿐이고(패턴지는 앱에서 불투명하게 굽니다),
      필요 없다면 패턴지·다린천은 같은 부류라 <b>은유</b>로 고르시면 됩니다 — 재단실의 도면 종이냐, 다린 천이냐.</p>
  </section>

  <section>
    <h2>고르면 따라오는 것</h2>
    <div class="고름">
      <article>
        <h4>㉠ 패턴지 — 유리 은퇴를 확정</h4>
        <ul>
          <li>요소 사전 5자리의 「판정 보류」 표식을 걷고 「반투명 판 = 패턴지」로 못박는다</li>
          <li>DESIGN.md 재질 3종 문장(펠트·유리·레진)에서 유리 항을 갈아야 한다 — 이게 제일 큰 파장이다</li>
          <li>Loom 부품 중 유리를 쓰는 자리(판·번호·태그)를 재배선</li>
        </ul>
      </article>
      <article>
        <h4>㉡ 유리 — 은퇴를 철회</h4>
        <ul>
          <li>요소 사전의 「판정 보류」 표식만 걷으면 끝난다 — 재질 3종 체계가 그대로 산다</li>
          <li>대신 「양모 공방에 유리가 왜 있나」에 한 줄로 답해 둔다(나중에 다시 흔들리지 않게)</li>
          <li>패턴지 형태는 굽는 자에 남겨 둔다 — 지운 뒤 다시 짓는 값이 아니다</li>
        </ul>
      </article>
      <article>
        <h4>다린 천 — 어느 쪽이든 남는다</h4>
        <ul>
          <li>이건 반투명 후보가 아니라 <b>대면적 카드 바닥</b>이다(사전 §1-b)</li>
          <li>㉠·㉡ 어느 쪽이 이겨도 바닥의 자리는 안 바뀐다 — 확인만 받으면 된다</li>
        </ul>
      </article>
    </div>

    <p class="안잰것"><b>아직 안 잰 것</b> — 판 위에 <b>실제 글자를 얹었을 때의 가독</b>입니다.
      글자는 HTML 층이 지는 것이라(타이포 불가침) 렌더가 아니라 앱 화면에서 재야 합니다.
      재질이 정해지면 그 자리에서 재겠습니다.</p>
  </section>

  <footer>
    굽는 자 <code>node tools/판3종대조굽기.js</code> · 렌더 <code>tools/요소굽기.py</code> ·
    색 정본 <code>docs/디자인_토큰.json</code>(앱 다크 「양모 밤」) · 판 두께만 다릅니다(천 0.055 / 종이·유리 0.028 — 실물이 그렇습니다).
  </footer>
</div>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('구움:', path.relative(ROOT, OUT), '·', html.length, '자 · 판', 판들.length, '벌');
