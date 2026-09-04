#!/usr/bin/env node
// 발표물빌드 — `docs/발표물/_src_*.html` 을 브랜드 폰트 임베드본으로 굽는다.
//
// 왜 있나 (유호님 08-05 확정 "임베드 통로에 태운다"):
//   발표물 6종은 폰트를 **이름으로만** 지정하고 있었다. 그 폰트가 깔린 기계에서만 제대로 나오고,
//   안 깔린 기계에선 맑은고딕·굴림으로 조용히 폴백한다 — 화면은 멀쩡해 보이고 종이에서만 틀린다.
//   이 PC 가 정확히 그 상태였다(설치된 브랜드 폰트는 SUIT 뿐). 임베드하면 기계를 안 탄다.
//
// 왜 스크립트인가: 손으로 6번 부르면 언젠가 5번만 부른다. 그때 빠진 1개는 **초록으로 보인다**
//   (파일이 그대로 있으니까). 목록을 손으로 들지 않고 `_src_` 규칙에서 파생시킨다.
//
// 사용법:
//   node tools/발표물빌드.js            # HTML 만
//   node tools/발표물빌드.js --pdf      # PDF 까지 (헤드리스 크롬)
//   node tools/발표물빌드.js --check    # 굽지 않고 「빌드가 필요한가」만 본다(CI·배포 게이트용)
//
// 종료 코드: 실패·미갱신이 있으면 1.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
// 픽스처 이음매 — 회귀가 실저장소를 건드리지 않고 탐지력을 잴 수 있게 한다(bump-version 의 SYNK_BUMP_ROOT 와 같은 계열).
const DIR = process.env.SYNK_PRESENT_ROOT || path.join(ROOT, 'docs', '발표물');
const EMBED = path.join(ROOT, 'docs', 'tools', '브랜드폰트_임베드.py');
const SRC_PREFIX = '_src_';

/** 소스 → 산출물 이름. 접두만 뗀다 — 산출물 파일명은 절대 안 바꾼다(대외 링크·유호님 즐겨찾기가 걸려 있다). */
const outNameOf = (srcName) => srcName.slice(SRC_PREFIX.length);

// 마커·주입 판정은 여기 베끼지 않는다 — 뿌리는 쪽과 확인하는 쪽이 갈리면 조용히 통과한다.
const 활자주입 = require('./lib/활자주입.js');
const MARKER = 활자주입.마커;

/** 표기를 접는다 — 파이썬 write_text·git autocrlf 를 거치며 CRLF·줄끝 공백이 섞여도 내용 대조가
 *  안 흔들리게. 🔑 정의는 `tests/lib/소스검사.js` 하나다: 손으로 접으면 CRLF 축만 막히고 줄끝 공백은
 *  그대로 새어, 파이썬이 한 칸 흘린 날 «지면이 갈라졌다»는 거짓 적색이 된다(#Q101 · 실측 14/14 반쪽).
 *  ⚠ 대조 전용이다 — 쓰는 쪽(`writeFileSync(out, html)`)은 원문을 그대로 쓴다. */
const { 표기접기: normalize } = require('../tests/lib/소스검사.js');

/* ══════════════════════════════════════════════════════════════════════════
   Loom — 발표물 6벌이 부품을 «입는» 통로 (F517 · 2026-08-16)

   왜 원고에 CSS 를 안 적고 여기서 얹나:
     적으면 같은 CSS 가 6벌로 갈라지고, 토큰이 바뀌어도 지면에 안 닿는다 — 소개서 6벌이
     정확히 그 상태였다(F498). **CSS 는 `loom.js` 한 곳에서만 나온다.**

   🔴 **훅이 없으면 안 얹는다** — 이게 이 파일에서 제일 중요한 줄이다.
     `지면방` 의 전파 술어는 CSS 주석 마커 하나(`/*loom부품:`)라, 얹기만 하면 부품이 0개여도
     「입었다」로 켜진다(F517②). 실측: 착수 시점 발표물 6벌의 부품 클래스는 **6벌 전부 0개**였다.
     그대로 얹었으면 「전파 13/21 초록 · 부품 0」이 됐을 것이다.
     ⇒ 원고가 부품을 실제로 부를 때만 얹는다. 그래야 «마커가 켜졌다» = «부품이 있다» 가 된다.
   ══════════════════════════════════════════════════════════════════════════ */
/* 2026-08-18 — 아래 판정 셋(훅 게이트·재는 자 하나·원고 CSS 뒤)은 이제 **공용 통로**가 진다.
 * 뗀 이유: 남은 지면 12벌의 생성기가 다섯이라, 여기 두면 그 다섯이 각자 베낀다.
 * 여기 남은 것은 「이 지면은 인쇄부품이다」라는 **발표물 고유의 선택**뿐이다. */
const loom얹기모듈 = require('./lib/loom얹기.js');
/* 🔴 `부품만` 이 아니라 «낮» 을 실은 프리셋이다 — 발표물은 **종이로 나가는 지면**이다.
 *   `낮` 층이 없으면 부품 색이 Cream 계열로 남고, 크롬 인쇄는 「배경 그래픽」이 기본 꺼짐이라
 *   흰 종이 위 Cream = **1.13:1** 로 부품이 통째로 사라진다.
 * 🔴 그리고 `인쇄부품` 이 **아니다**(2026-08-19 교체): 그 프리셋의 낮 교정은 통째로 `@media print`
 *   안이라 **화면에서는 안 걸린다**. 발표물은 종이로만 사는 게 아니다 — 덱은 «띄워서» 보고,
 *   안내문·브로셔도 화면으로 먼저 읽힌다. `.룸` 이 h2 를 물면서 그 자리가 실측으로 드러났다:
 *   Chalk 제목 on Paper = **1.21:1**(기준 3) — 밝은 칸 전부에서 제목이 사라졌다.
 *   ⇒ `밝은부품` = 인쇄부품 + `밝은글`(같은 값을 @media 밖에서 한 번 더). 종이 쪽은 안 바뀐다. */
const LOOM_지면 = '밝은부품';
/** 얹은 블록을 되뜯는 표식 — `--check` 가 원고와 1:1 로 대조하려면 되돌릴 수 있어야 한다. */
const LOOM_뜯기 = /\n?<style data-loom="[^"]*">[\s\S]*?<\/style>/;

/**
 * 이 원고가 실제로 부르는 Loom 훅 — **닿는 선택자들**의 이름.
 *
 * 🔑 판정을 여기 안 적는다. 2026-08-17 까지는 적었고(부품 클래스 ∩ 마크업 클래스),
 *    `지면방` 은 따로 자기 판정을 들었다 — **같은 물음에 두 답**이라 갈릴 수 있었다.
 *    실제 갈리는 자리: `.번호` 처럼 `h2>span:not(.번호)` 안에만 사는 클래스는
 *    「부품 클래스」 정규식엔 잡히지만 **아무 데도 안 닿는다.** 그런 원고 하나면
 *    빌드는 「훅 1개」라 얹고, 등록층은 「마커만」이라 빨개진다.
 *    ⇒ 재는 자는 `tools/lib/loom훅.js` 하나다.
 * ⚠**마크업만 본다** — 원고의 CSS 안에 우연히 같은 이름이 있어도 그건 훅이 아니다.
 */
const 훅들 = (html) => loom얹기모듈.훅들(html, LOOM_지면);

/**
 * 얹을까 — **훅이 하나라도 있을 때만.** 이 한 줄이 「마커만 켜진 초록」을 막는 게이트다.
 * 🔑 `if (훅.length)` 를 빌드 루프 «안»에 두지 않고 함수로 뗀 이유: 그 루프는 파이썬 임베드를
 *    타므로 픽스처가 못 닿고, **못 닿는 게이트는 변이 검사에서 구멍으로 나온다**(실측 08-16:
 *    게이트를 꺼도 시험 9건이 전부 초록이었다). 지면방 `분모확인()` 이 떼어져 있는 것과 같은 계열.
 */
const 얹을까 = loom얹기모듈.얹을까;

/**
 * 얹기 — 원고의 **마지막 `</style>` 뒤**에 둔다.
 * 🔑 앞에 두면 안 되는 이유(처음에 그렇게 짰다가 되돌렸다): 부품 클래스와 원고 클래스는
 *   특정도가 같다(`.칩` vs `.tag` = 0,1,0). 앞에 두면 동점에서 원고가 이겨,
 *   `class="tag 칩"` 을 달아도 **아무 일도 안 일어난다** — 훅은 늘었는데 화면은 그대로인,
 *   딱 「맞는 얼굴로 틀린 값」이다. 부품 클래스는 «내가 일부러 단 것»이므로 이기는 게 맞다.
 * ⚠안 단 요소는 여전히 안전하다 — 맨요소 규칙은 `.룸` 안에서만 살기 때문이다(F517).
 */
const loom뜯기 = loom얹기모듈.뜯기;

/* ══════════════════════════════════════════════════════════════════════════
   룸 범위 — 「어느 칸이 Loom 을 입나」를 **재서** 정한다 (2026-08-19 · ④ 잔여 3벌)
   ══════════════════════════════════════════════════════════════════════════
   `인쇄부품` 은 맨요소 규칙(h2·ol·li·td…)을 `.룸` 안에 가둔다. 그래서 발표물 3벌은
   훅이 0 이라 계속 안 입고 있었다 — `.칩` 을 안 쓰는 원고들이다.

   🔴 그런데 `.룸` 을 **판 전체**에 씌우면 안 된다: 덱에는 «어두운 슬라이드»가 섞여 있고
     (01 = 밝은 11 + 어두운 5 · 03 = 표지 2 벌) 낮 층은 그 안의 글까지 Ink 로 바꾼다.
     어두운 판 위의 Ink = 사라짐. 그래서 **밝은 칸에만** 씌운다.

   🔑 어느 칸이 어두운지는 **눈이 아니라 자로** 가른다 — 원고의 `:root` 변수를 풀어
     그 칸의 배경 상대휘도를 재고 문턱(0.35) 아래면 어두운 칸이다. 클래스 이름
     (`dark`·`cover`)으로 가르면 다음 덱이 다른 이름을 쓰는 순간 조용히 샌다.
   ⚠ 틀릴 때의 모습 = 배경을 «자기 규칙»이 아니라 부모·이미지에서 받는 칸을 밝다고 읽는다.
     그때는 그 칸이 Loom 을 입고 글이 안 보인다 — 그래서 빌드 로그가 **밝음/어둠 셈을 찍는다**.
*/

/** `:root{--x:#hex}` 를 풀어 이름→hex 로. 원고마다 이름이 달라(`--navy-2`·`--graphite`) 이름은 안 믿는다. */
function 변수표(html) {
  const 표 = new Map();
  /* 🔴 이름 문자류를 ASCII 로 잡지 않는다 — 이 저장소의 클래스·변수엔 한글이 산다(`.룸` 자신이 그렇다).
     JS 의 `\\w` 는 ASCII 라, ASCII 로만 잡으면 한글 이름 칸이 **통째로 안 보인다**(F647 계열). */
  for (const m of html.matchAll(/--([\w\u00C0-\uFFFF-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) 표.set(m[1], m[2]);
  return 표;
}

/** hex → 상대휘도(WCAG). 3자리 hex 도 받는다. */
function 휘도(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * 원고 CSS 에서 «어두운 배경을 스스로 정하는» 클래스 이름들.
 * 규칙 하나만 본다: `.클래스{… background[-color]: <색> …}` — 색은 hex 이거나 `var(--이름)`.
 */
function 어두운클래스들(html) {
  const 표 = 변수표(html);
  const 어둠 = new Set();
  for (const m of html.matchAll(/\.([A-Za-z\u00C0-\uFFFF_][\w\u00C0-\uFFFF-]*)[^{}]*\{([^{}]*)\}/g)) {
    const 배경 = /(?:^|[;{\s])background(?:-color)?\s*:\s*([^;]+)/.exec(m[2]);
    if (!배경) continue;
    const v = 배경[1];
    const 변수 = /var\(\s*--([\w\u00C0-\uFFFF-]+)/.exec(v);
    const 직접 = /#[0-9a-fA-F]{3,8}/.exec(v);
    const hex = 직접 ? 직접[0] : (변수 ? 표.get(변수[1]) : null);
    if (hex && 휘도(hex) < 0.35) 어둠.add(m[1]);
  }
  return 어둠;
}

/**
 * 밝은 `<section>` 에만 `class="… 룸"` 을 단다. 이미 달렸으면 그대로 둔다(멱등).
 * @returns {{html:string, 밝음:number, 어둠:number}}
 */
function 룸씌우기(html) {
  const 어둠 = 어두운클래스들(html);
  let 밝음 = 0; let 어두움 = 0;
  const 새판 = html.replace(/<section\s+class="([^"]*)"/g, (전체, cls) => {
    const 이름들 = cls.split(/\s+/).filter(Boolean);
    if (이름들.some((n) => 어둠.has(n))) { 어두움 += 1; return 전체; }
    밝음 += 1;
    return 이름들.includes('룸') ? 전체 : `<section class="${cls} 룸"`;
  });
  return { html: 새판, 밝음, 어둠: 어두움 };
}

/**
 * 번호를 **원고가 손으로 적은** `<ol>` 에 `.민` 을 단다 — 안 달면 «① 1. …» 두 번 번호가 된다.
 * 재는 법: 그 목록의 첫 `<li>` 가 «1.»·«1)»·«①» 로 시작하나. 실물 = 01 덱의 `ol.q3`.
 */
function 민목록(html) {
  let 센다 = 0;
  const 새판 = html.replace(/<ol(\s+class="([^"]*)")?([^>]*)>([\s\S]{0,400}?)<\/li>/g, (전체, 클래스절, cls, 나머지, 첫칸) => {
    const 글 = 첫칸.replace(/<[^>]+>/g, '').trim();
    if (!/^(?:[0-9]+\s*[.)]|[①-⑳])/.test(글)) return 전체;
    const 이름들 = (cls || '').split(/\s+/).filter(Boolean);
    if (이름들.includes('민')) return 전체;
    센다 += 1;
    return `<ol class="${[...이름들, '민'].join(' ')}"${나머지}>${첫칸}</li>`;
  });
  return { html: 새판, 센다 };
}


/**
 * 빌드가 «심은» 활자 한 벌의 모양. 가르는 표식은 **`src:url(data:font`** 하나다.
 *
 * ■ 🔴 왜 「첫 `@font-face` 묶음」이면 안 되나 (2026-08-31~09-03 · 나흘짜리 주인 없는 적색)
 *   옛 판은 「`@font-face{…}` 가 줄바꿈으로 이어진 묶음」을 «파일에서 처음 만나는» 자리에서
 *   되돌렸다. 그러다 08-31 `c3273d30d`(낫표를 킷에 박은 커밋)가 원고 맨 위에 **손글씨** 활자
 *   한 줄을 들였다 — `@font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),…}`.
 *   그것이 마커보다 «앞»에 서므로, 되돌리기가 **엉뚱한 한 줄을 마커로 바꾸고** 심은 활자는
 *   그대로 남긴다. ⇒ 원고와 영원히 어긋난다.
 *   🔴 **그리고 그 적색은 처방을 따라도 안 꺼진다** — 다시 구워도 같은 자리에서 같은 값이 난다.
 *   실측 09-03: 산출물 7벌 전량이 「소스를 고치고 안 구웠다」 · 그 말은 **사실이 아니었다**
 *   (원고도 산출물도 안 낡았다). 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).
 *
 * ■ 왜 이 표식인가 — 심는 쪽이 정한다. `docs/tools/브랜드폰트_임베드.py` 는 한 벌을
 *   `…font-display:block;src:url(data:font/woff2;base64,…) format('woff2')}` 로 짓고
 *   `"\n".join(faces)` 로 마커 자리에 통째로 넣는다. 손글씨 활자는 `src:local(…)` 이라
 *   **원리상 안 겹친다**(실측 09-03: 원고 7벌에 `data:font` 0건).
 * ■ base64 안엔 `}` 가 안 나온다(알파벳이 A-Za-z0-9+/=) — `[^}]*` 가 안전한 이유.
 * ■ ⚠ 이 자가 틀릴 때의 모습 = **되돌리기가 헛돌고 「낡았다」로 나온다.** 그래서 `--check` 가
 *   되돌린 판에 심은 활자가 «남아 있는지»를 따로 보고, 남았으면 낡음이 아니라 **이 자를 짚는다.**
 */
const 심긴활자 = String.raw`@font-face\{[^}]*src:url\(data:font[^}]*\}`;
const 심긴묶음 = new RegExp(`${심긴활자}(?:\\n${심긴활자})*`);
/* 쪽번호 폴리필도 «되돌릴 수» 있어야 한다 — 아니면 그 지면 하나가 영원히 「낡음」으로 운다.
 * 빌드가 마커 자리에 훅 + 폴리필을 한 덩어리로 넣으므로, 되돌리는 것도 그 한 덩어리다.
 * ⚠ [^]*? 를 쓴 이유 — 줄바꿈까지 먹는 «아무 글자»를 뜻한다. 폴리필 안에 </script 가
 *   0건인 것은 실측했다(09-03). 그 전제가 깨지면 첫 닫는 표에서 끊긴다. */
const PAGED_MARKER = '<!--@PAGED@-->';
const 심긴쪽번호 = /<script>window[.]PagedConfig[^]*?<script data-synk-paged="[^"]*">[^]*?<[/]script>/;

/** 되돌리기가 실제로 됐나 — 심은 활자가 남아 있으면 헛돈 것이다(원고가 스스로 품은 경우는 뺀다). */
const 심긴활자남았나 = (s) => /src:url\(data:font/.test(s);

/**
 * 산출물에서 임베드된 @font-face 묶음을 도로 마커로 되돌린다 → 소스와 1:1 비교가 된다.
 * 빌드가 `marker → faces.join('\n')` 이라 되돌리는 것도 그 한 덩어리다.
 */
/* ⚠Loom 블록을 **먼저** 뜯는다 — 순서가 뒤바뀌면 `@font-face` 정규식이 첫 매치를 찾을 때
 *   앞에 얹힌 블록 안을 먼저 볼 수 있다. 지금 Loom CSS 엔 `@font-face` 가 없지만,
 *   «오늘 없다»를 근거로 순서를 정하면 생기는 날 조용히 틀린다. */
const unembed = (html, 원고) =>
  자리표되돌리기(
    룸벗기기(loom뜯기(normalize(html)), 원고).replace(심긴묶음, MARKER).replace(심긴쪽번호, PAGED_MARKER),
    원고
  );

/**
 * 자리표(`@@펠트종이@@`·`@@마스코트@@` …)를 도로 세운다 — **심는 자의 짝**이다.
 *
 * 🔴 왜 생겼나 (2026-09-05): 빌드가 심는 것은 다섯인데(활자·쪽번호·Loom·펠트 천·마스코트)
 *   되돌리는 것이 셋뿐이라, 자리표를 쓰는 지면 하나가 **다시 구워도 영영 「소스를 고치고 안 구웠다」**
 *   로 떴다. 그 적색 하나가 `tests/발표물되돌리기.test.js` 를 통해 **배포 게이트를 막았다**
 *   (v9.311 이 커밋·백업까지 가고 라이브 앞에서 섰다). 09-05 새벽에 천·마스코트 심기가 들어오면서
 *   짝이 안 따라온 자리다 — `unembed` 머리말이 경고한 「되돌릴 수 없는 변환을 빌드에 넣으면
 *   «낡음»과 «빌드가 한 일»이 같은 모양이 된다」가 그대로 일어났다.
 *
 * 🔑 **원고가 「어디에 무엇이 있었나」를 알려준다.** 심긴 값(base64)으로 되맞추지 않는 까닭:
 *   마스코트는 인쇄 크기로 **줄여서** 심으므로 그 바이트를 다시 만들려면 파이썬을 불러야 하고,
 *   그러면 `--check` 가 자산·외부 도구에 매달린다(CI 에 그 도구가 없는 날 «거짓 적색»이 된다).
 *   자리표 앞뒤의 본문은 빌드가 건드리지 않으므로, 그 조각으로 자리를 맞추면 파일도 도구도 안 부른다.
 * ⚠ 조각이 한 자리라도 안 맞으면 **손대지 않고 그대로 돌려준다** — 반쯤 되돌린 판을 내면
 *   「낡음」 판정이 조용히 틀린다(틀릴 때 방향은 「낡았다」여야지 「성하다」가 아니다).
 * ⚠ 자산 파일이 없어 «빈 채»로 심긴 자리도 맞는다(심기가 그때 자리표를 빈 문자열로 지운다).
 */
function 자리표되돌리기(벗은, 원고) {
  if (typeof 원고 !== 'string' || 원고.indexOf('@@') < 0) return 벗은;
  const 조각 = normalize(원고).split(/(@@[^@\n"')\s]+@@)/);
  if (조각.length < 3) return 벗은;
  let 남은 = 벗은, 결과 = '';
  for (let i = 0; i < 조각.length; i++) {
    if (i % 2 === 1) {                                    // 자리표 자리 — 심긴 값을 걷고 이름을 세운다
      const 심긴 = 남은.match(/^data:image\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=]*/);
      결과 += 조각[i];
      if (심긴) 남은 = 남은.slice(심긴[0].length);
      continue;
    }
    if (!남은.startsWith(조각[i])) return 벗은;            // 못 맞췄다 — 반쯤 되돌리지 않는다
    결과 += 조각[i];
    남은 = 남은.slice(조각[i].length);
  }
  return 결과 + 남은;
}

/**
 * 빌드가 «더한» 범위 표식(`룸`·`민`)을 도로 걷는다 — 원고(`_src_`)와 1:1 대조가 되려면 되돌릴 수 있어야 한다.
 *
 * 🔴 이 함수가 없으면 `--check` 가 **여섯 벌 전부를 「소스를 고치고 안 구웠다」로** 신고한다(실측 2026-08-19).
 *   그리고 그 적색은 사실이 아니다 — 원고는 그대로고 빌드가 더한 것이다. 되돌릴 수 없는 변환을
 *   빌드에 넣으면 「낡음」과 「빌드가 한 일」이 같은 모양이 된다.
 * 🔴 **[2026-09-05] 그날이 왔다.** 이 머리말이 「원고에 달 일이 생기면 이 자리부터 다시 본다」고
 *   적어 둔 그 자리다 — `_src_10_상담결과_요약_A4.html` 이 스스로 `class="sheet 룸"` 을 하나 달았고
 *   빌드가 하나를 더해 산출물엔 둘이 됐는데, 이 함수가 **둘 다** 걷어 원고와 영영 어긋났다.
 *   그 적색 하나가 `tests/발표물되돌리기.test.js` 를 통해 **배포 게이트를 막았다**(v9.311 이 라이브 앞에서 섰다).
 * 🔑 그래서 **원고를 받아 «빌드가 더한 것»만 걷는다.** 개수로 세지 않고 **그 표식이 붙은 다른 class 로**
 *   가른다 — 개수 순서로 맞추면 빌드가 «앞쪽»에 더한 날 원고 것을 걷고 만다.
 * ⚠ 원고를 안 주면 예전처럼 전부 걷는다(옛 호출부·시험 호환).
 */
const 룸표식 = (원고, 정규식) =>
  new Set(typeof 원고 === 'string' ? [...원고.matchAll(정규식)].map((m) => m[1]) : []);

const 룸벗기기 = (html, 원고) => {
  const 남길섹션 = 룸표식(원고, /<section\s+class="([^"]*?)\s+룸"/g);
  const 남길목록 = 룸표식(원고, /<ol\s+class="([^"]*?)\s+민"/g);
  const 원고민홀로 = typeof 원고 === 'string' && /<ol\s+class="민"/.test(원고);
  return html
    .replace(/(<section\s+class="([^"]*?))\s+룸"/g, (m, 앞, cls) => (남길섹션.has(cls) ? m : `${앞}"`))
    .replace(/(<ol\s+class="([^"]*?))\s+민"/g, (m, 앞, cls) => (남길목록.has(cls) ? m : `${앞}"`))
    .replace(/<ol\s+class="민"/g, (m) => (원고민홀로 ? m : '<ol'));
};

/** 파이썬 실행기를 찾는다. 못 찾으면 **통과가 아니라 실패** — 조용히 건너뛰면 낡은 산출물이 초록으로 남는다. */
function findPython() {
  for (const cmd of ['python', 'py', 'python3']) {
    const r = spawnSync(cmd, ['-c', 'import fontTools, brotli'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return cmd;
  }
  return null;
}

/* ── 폰트 스택 린트 ────────────────────────────────────────────────
 * 임베드는 「폰트를 실어 보낸다」까지만 한다. **소스가 안 실린 폰트 이름을 부르면** 그 글자는
 * 기계에 깔린 폰트가 그린다 — 이 PC 는 SUIT Variable 이 깔려 있어서 인쇄물 6종의 한글이 전부
 * 그걸로 나가고 있었다(08-06 PDF 실측: BAAAAA+SUITVariable-ExtraBold). 안 깔린 기계에선 굵기가
 * 통째로 내려앉는데, **양쪽 다 화면은 멀쩡해 보인다.**
 * FACES 는 임베드 스크립트에서 **파생**한다 — 목록을 두 곳에 적으면 갈라진다.
 */
const GENERIC = new Set(['system-ui', 'sans-serif', 'serif', 'monospace', 'ui-monospace', 'cursive', 'fantasy', 'ui-sans-serif', 'ui-serif']);
const SKIP_VALUE = /^(inherit|initial|unset|revert|var\()/i;

function embeddedFaces() {
  const block = fs.readFileSync(EMBED, 'utf8').match(/^FACES = \[([\s\S]*?)^\]/m);
  if (!block) return null; // 스크립트 모양이 바뀌면 조용히 통과시키지 않는다
  const faces = [...block[1].matchAll(/\(\s*"([^"]+)"\s*,\s*(\d+)/g)].map((m) => ({ fam: m[1], wt: Number(m[2]) }));
  return faces.length ? faces : null;
}

/** 소스 1개를 검사한다 → 위반 문자열 배열. */
function lintFonts(html, faces) {
  const bad = [];
  const fams = new Set(faces.map((f) => f.fam));

  // ① 시스템 폴백에 닿기 전에 나오는 이름은 전부 임베드된 것이어야 한다.
  //    (버그는 2번째 자리에 있었다 — 1번째만 보면 'Inter Tight' 라 통과한다)
  // ⚠ 스택 **전체**를 떠야 한다. 초판은 따옴표에서 끊겨 첫 이름만 봤고 — 잡으라고 만든 그 버그를
  //    그대로 통과시켰다(픽스처가 잡음). CSS 선언과 SVG 속성은 끝나는 문자가 달라 따로 뜬다.
  const stacks = [
    ...[...html.matchAll(/font-family\s*:\s*([^;{}<>]+)/g)].map((m) => m[1]),
    ...[...html.matchAll(/font-family\s*=\s*"([^"]*)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/font-family\s*=\s*'([^']*)'/g)].map((m) => m[1]),
  ];
  for (const stack of stacks) {
    const value = stack.trim();
    if (SKIP_VALUE.test(value)) continue;
    for (const raw of value.split(',')) {
      const name = raw.trim().replace(/^['"]|['"]$/g, '');
      if (!name) continue;
      if (GENERIC.has(name)) break;                      // 여기서부터는 의도된 폴백
      if (!fams.has(name)) { bad.push(`임베드 안 된 폰트를 폴백보다 앞에서 부른다: '${name}'`); break; }
    }
  }

  // ② 쓰는 굵기가 임베드 범위 밖이면 브라우저가 **합성**한다(가짜 볼드) — 범위 안이면 대체만 된다.
  //    한글을 지는 건 SUIT 뿐이라 SUIT 범위로 잰다.
  const suit = faces.filter((f) => f.fam === 'SUIT').map((f) => f.wt);
  const used = [...html.matchAll(/font-weight\s*[:=]\s*["']?(\d{3,4})\b/g)].map((m) => Number(m[1]));
  if (suit.length && used.length) {
    const lo = Math.min(...suit), hi = Math.max(...suit);
    for (const w of new Set(used)) {
      if (w < lo || w > hi) bad.push(`SUIT 임베드 범위(${lo}~${hi}) 밖의 굵기 ${w} — 가짜 볼드가 합성된다`);
    }
  }
  return [...new Set(bad)];
}

function lintAll(srcs) {
  const faces = embeddedFaces();
  if (!faces) {
    console.error(`🔴 ${path.relative(ROOT, EMBED)} 에서 FACES 를 못 읽었다 — 린트가 조용히 죽는다`);
    return 1;
  }
  let bad = 0;
  for (const s of srcs) {
    for (const msg of lintFonts(fs.readFileSync(path.join(DIR, s), 'utf8'), faces)) {
      console.error(`🔴 ${s} — ${msg}`);
      bad++;
    }
  }
  return bad ? 1 : 0;
}

function sources() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter((f) => f.startsWith(SRC_PREFIX) && f.endsWith('.html'))
    .sort();
}

function main() {
  const args = process.argv.slice(2);
  const wantPdf = args.includes('--pdf');
  const checkOnly = args.includes('--check');

  const srcs = sources();
  if (!srcs.length) {
    console.error(`🔴 ${path.relative(ROOT, DIR)} 에 ${SRC_PREFIX}*.html 이 0건 — 경로가 바뀌었는지 확인하라.`);
    console.error('   (0건을 「할 일 없음」으로 넘기면 스캔이 조용히 죽은 것을 못 본다)');
    return 1;
  }

  // 굽기 전에 소스부터 본다 — 안 실린 폰트를 부르는 소스도 「성공적으로」 구워져 나온다(rc 0).
  if (lintAll(srcs)) return 1;

  // --check = 「산출물이 이 소스에서 나온 게 맞는가」를 **내용으로** 본다. 굽지 않으므로 파이썬이 없어도 답한다.
  //
  // ⚠ mtime 으로 재면 **CI 에서 깨진다**(08-05 실측: 로컬 1254/0 초록인데 원격은 빨강).
  //   git 은 파일 시각을 보존하지 않는다. 새 클론에선 모든 파일이 체크아웃 시각을 받는데,
  //   그 순서를 정하는 건 **체크아웃 쓰기 순서**다 — `01_….html` 이 `_src_01_….html` 보다
  //   먼저 쓰이므로 **소스가 항상 더 새로 보인다.** 그래서 플래키가 아니라 **매번 결정적으로**
  //   6/6 걸렸고, 로컬(빌드 직후라 산출물이 더 새로움)에선 영원히 안 걸린다.
  //   (원인 특정은 옆 세션 local_ab10e000 의 지적 — 나는 「순서가 제멋대로」까지만 봤다.)
  //   시각은 repo 밖 환경 상태지 내용이 아니다 → 판정을 내용으로 옮겼다. 내용 대조는 더 세다:
  //   「소스를 고치고 안 구웠다」를 시각이라는 대리 지표가 아니라 **차이 자체**로 잡는다.
  if (checkOnly) {
    const stale = [];
    for (const s of srcs) {
      const out = path.join(DIR, outNameOf(s));
      if (!fs.existsSync(out)) { stale.push(`${outNameOf(s)} — 산출물 없음`); continue; }
      /* 🔴 PDF 는 «있나»만 잰다 — «낡았나»는 원리상 못 잰다(아래 사각 고지 참조).
       * 08-26 실측: 11_AI활용_학부모안내 가 _src_ 밖에 있어 PDF 가 아예 없었는데,
       * 이 검사는 그것을 「6종 전부 최신」으로 읽고 초록을 냈다. 존재는 시각과 달리
       * 클론에서도 결정적이라 CI 에서 안 깨진다. */
      const pdf = out.replace(/\.html$/, '.pdf');
      if (!fs.existsSync(pdf)) stale.push(`${path.basename(pdf)} — PDF 가 없다(인쇄물인데 종이가 없다 · --pdf 로 굽는다)`);
      const html = fs.readFileSync(out, 'utf8');
      if (!/@font-face/.test(html)) { stale.push(`${outNameOf(s)} — 산출물에 @font-face 가 없다(임베드 안 된 사본)`); continue; }
      if (html.includes(MARKER)) { stale.push(`${outNameOf(s)} — 마커가 그대로 남았다(치환 실패본)`); continue; }
      const 원고 = normalize(fs.readFileSync(path.join(DIR, s), 'utf8'));
      const 벗은 = unembed(html, 원고);   // 원고를 준다 — 자리표가 어디에 있었는지는 원고만 안다
      /* 🔴 「낡음」과 «되돌리기가 헛돈 것»을 가른다 — 08-31~09-03 에 이 둘이 같은 얼굴이라
       *   7벌이 나흘 동안 「소스를 고치고 안 구웠다」로 서 있었고, 그 처방을 따라도 안 꺼졌다.
       *   심은 활자가 되돌린 판에 남아 있는데 원고엔 없다 = 낡은 게 아니라 **자가 안 맞는 것**이다. */
      if (심긴활자남았나(벗은) && !심긴활자남았나(원고)) {
        stale.push(`${outNameOf(s)} — 심은 활자를 못 되돌렸다(되돌리기 과녁이 산출물과 안 맞는다)`
          + ' — **다시 구워도 안 꺼진다.** 고칠 자리는 산출물이 아니라 `tools/발표물빌드.js` 의 `심긴묶음` 이다');
        continue;
      }
      if (벗은 !== 원고) {
        stale.push(`${outNameOf(s)} — 소스와 산출물 내용이 어긋난다(소스를 고치고 안 구웠다)`);
        continue;
      }
      /* Loom — 「훅이 있나」와 「얹혔나」가 **어긋나면** 그것도 낡음이다.
       * 훅을 원고에 새로 달고 안 구우면 산출물엔 CSS 가 없고, 훅을 뗐는데 안 구우면 CSS 만 남는다.
       * 뒤쪽이 특히 위험하다 — 마커는 켜져 있어서 「입었다」로 읽힌다(F517②). */
      /* 🔑 훅은 «범위를 씌운 뒤»의 원고로 잰다 — 빌드가 `.룸` 을 더하고 나서야 맨요소 훅이 닿는다.
       * 씌우기 전으로 재면 훅 0 인데 산출물엔 Loom 이 있으니 「부품 0인 채 마커만」으로 오진한다. */
      const 훅 = 훅들(룸씌우기(민목록(원고).html).html);
      const 얹힘 = LOOM_뜯기.test(normalize(html));
      if (얹을까(훅) && !얹힘) stale.push(`${outNameOf(s)} — 훅 ${훅.length}개(${훅.join('·')})인데 Loom 이 안 얹혔다`);
      else if (!얹을까(훅) && 얹힘) stale.push(`${outNameOf(s)} — 훅 0개인데 Loom 이 얹혔다(부품 0인 채 마커만 켜진다)`);
      else if (얹힘) {
        /* 불리언만 보면 loom 이 바뀐 날 구세대 CSS 를 영원히 초록으로 읽는다(반박 패스 H-2 실측:
         * 08-19 기본천 배선 뒤 옛 블록 3벌이 「전부 최신」으로 나왔다) — 블록 «내용»까지 대조한다. */
        const 지금블록 = (normalize(loom얹기모듈.강제얹기(html, LOOM_지면)).match(LOOM_뜯기) || [''])[0];
        const 실린블록 = (normalize(html).match(LOOM_뜯기) || [''])[0];
        if (지금블록 !== 실린블록) stale.push(`${outNameOf(s)} — 얹힌 Loom CSS 가 지금 세대와 다르다(loom 이 바뀐 뒤 안 구웠다)`);
      }
    }
    if (stale.length) {
      console.log(`🔴 발표물 빌드 필요 ${stale.length}건 — \`node tools/발표물빌드.js --pdf\` 를 돌려라`);
      stale.forEach((s) => console.log(`   - ${s}`));
      return 1;
    }
    console.log(`✅ 발표물 ${srcs.length}종 전부 최신 (임베드본 확인)`);
    /* 🚫 이 검사가 «못 보는 것»을 스스로 적는다 — 초록이 무엇을 뜻하는지 오해하지 않게.
     * 08-26 실측: HTML 은 17:24 인데 PDF 6벌이 08-24 22:21 이었고, 이 검사는 그때도
     * 「6종 전부 최신」이라고 답했다. 오늘 고친 것이 종이에는 하나도 안 들어가 있었다.
     * mtime 으로는 못 잰다 — 위 주석대로 git 이 시각을 안 보존해 CI 에서 매번 깨진다. */
    console.log('   🚫 이 초록은 «HTML» 에 대한 것이다 — PDF 가 그 HTML 로 구워졌는지는 못 잰다.');
    console.log('      (시각으로 재면 CI 에서 깨지고, 내용으로 재려면 PDF 를 해독해야 한다)');
    console.log('      ⇒ 인쇄·배포 전에는 --pdf 로 한 번 굽고,');
    console.log('        docs/tools/인쇄물_키트검사.py 가 그 PDF 를 열어 실물로 판정한다.');
    return 0;
  }

  const py = findPython();
  if (!py) {
    console.error('🔴 python + fontTools + brotli 를 못 찾았다. `pip install fonttools brotli`');
    return 1;
  }

  let fail = 0;
  /* CSS 조립은 공용 통로가 안에서 한 번만 한다(캐시) — 6번 부르면 6번 갈릴 수 있는 자리를 원천에서 없앤다. */
  const loom붙은것 = [], loom안붙은것 = [];
  for (const s of srcs) {
    const src = path.join(DIR, s);
    const out = path.join(DIR, outNameOf(s));

    console.log(`\n── ${outNameOf(s)}`);
    /* 🔴 Loom 을 «폰트를 심기 전»에 입힌다 (유호 지시 09-03 「인쇄물도 Loom 입혀야지」).
     *   전에는 파이썬이 HTML 과 PDF 를 함께 내고 **그 뒤**에 Loom 을 얹었다. 그래서 화면에서
     *   보는 지면과 손에 쥐는 종이가 «다른 문서»였다(상담브로셔 12쪽 중 10쪽이 달랐다 · 09-03 실측).
     *   차례를 뒤집으면 한 벌에서 둘이 같이 나온다.
     *   ⚠ 덤으로 하나 더 맞는다 — 부품이 «그리는» 글자가 서브셋 계산에 먼저 들어간다.
     *     뒤에 얹으면 그 글자만 종이에서 네모가 된다(쪽번호에서 이미 밟은 함정이다). */
    let 원고 = fs.readFileSync(src, 'utf8');
    /* 🔴 자리표(`@@마스코트@@`)를 쓰는 지면은 여기서 채운다 — 안 채우면 산출물에 자리표가 글자 그대로
     *   남아 종이에 깨진 그림이 뜬다(09-05 실측: 10번이 그랬다). 심는 자는 **조판기와 같은 함수**다
     *   — 통로가 둘이면 「손으로 채우는 판」과 「기계가 채운 판」의 그림이 조용히 갈린다.
     *   자리표가 없는 지면은 그냥 지나간다. */
    const 조판 = require('./상담결과조판.js');
    const 코결과 = 조판.마스코트심기(원고);
    if (코결과.심었나) { 원고 = 코결과.html; console.log(`   ·  마스코트 심음 (${코결과.크기KB} KB)`); }
    else if (코결과.사유 !== '지면에 자리가 없다') { 원고 = 코결과.html; console.log(`   ⚠ 마스코트 — ${코결과.사유}`); }
    const 천결과 = 조판.펠트심기(원고);
    if (천결과.심은것.length || 천결과.빈것.length) {
      원고 = 천결과.html;
      console.log(`   ·  펠트 천 ${천결과.심은것.join(' · ') || ''}${천결과.빈것.length ? ' 🔴 파일 없음: ' + 천결과.빈것.join(' · ') : ''}`);
    }
    /* 범위 먼저 — `.룸` 이 없으면 맨요소 훅이 «어디에도 안 닿아» 훅 0 이 되고, 훅 0 이면 안 얹는다. */
    const 민결과 = 민목록(원고);
    const 범위결과 = 룸씌우기(민결과.html);
    if (범위결과.html !== 원고) {
      원고 = 범위결과.html;
      console.log(`   ·  룸 범위 — 밝은 칸 ${범위결과.밝음} 에 씌움 · 어두운 칸 ${범위결과.어둠} 은 건너뜀`
        + (민결과.센다 ? ` · 손번호 목록 ${민결과.센다}벌에 .민` : ''));
    }
    const 얹은결과 = loom얹기모듈.얹기(원고, { 지면: LOOM_지면 });
    if (얹은결과.얹힘) {
      원고 = 얹은결과.html;
      loom붙은것.push(`${outNameOf(s)} (훅 ${얹은결과.훅.length}: ${얹은결과.훅.join('·')})`);
      console.log(`   ✅ Loom 부품 ${얹은결과.훅.length}종 — ${얹은결과.훅.join('·')}`);
    } else {
      loom안붙은것.push(outNameOf(s));
      console.log(`   ·  Loom 훅 0 — 안 얹었다 (${얹은결과.사유})`);
    }

    /* 파이썬은 «부품까지 입은» 원고를 받는다. 임시 방에 건네고 곧 지운다 —
       원고방(`_src_`)에 중간물을 남기면 그게 다음 회차의 «원고»로 잡힌다. */
    const 임시방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-발표물-'));
    const 임시원고 = path.join(임시방, path.basename(s));
    fs.writeFileSync(임시원고, 원고, 'utf8');
    const cmd = [EMBED, 임시원고, out];
    if (wantPdf) cmd.push('--pdf', out.replace(RegExp('[.]html$'), '.pdf'));
    const r = spawnSync(py, cmd, { encoding: 'utf8', timeout: 900000 });
    try { fs.rmSync(임시방, { recursive: true, force: true }); } catch { /* 청소 실패는 결과와 무관 */ }
    if (r.stdout) process.stdout.write(r.stdout.replace(/^/gm, '   '));
    if (r.status !== 0) {
      fail++;
      console.error(`   🔴 실패 (rc=${r.status})`);
      if (r.stderr) console.error(r.stderr.replace(/^/gm, '   '));
      continue;
    }

    // 「돌았다」가 아니라 **결과**를 본다 — 치환이 안 돼도 rc 0 으로 끝날 수 있다.
    let html = fs.readFileSync(out, 'utf8');
    if (!활자주입.주입됐나(html)) {
      fail++;
      console.error('   🔴 산출물에 임베드가 안 들어갔다(마커 잔존 또는 @font-face 없음)');
      continue;
    }

    /* 부품이 «실제로 실렸는지» 산출물에서 되읽는다 — 「얹었다」가 아니라 «들어 있다»를 본다.
       얹기는 위(폰트 심기 «전»)에서 이미 끝났다. 여기서 다시 얹으면 두 번 얹힌다. */
    if (얹은결과.얹힘 && !LOOM_뜯기.test(normalize(html))) {
      fail++;
      console.error('   🔴 Loom 을 얹었는데 산출물에 그 블록이 없다 — 폰트를 심으며 잃었다');
      continue;
    }
  }

  /* 0 은 분모와 함께 쓴다 — 「몇 벌이 입었나」를 갈래로 쪼개 밝힌다. */
  console.log(`\n${fail ? '🔴' : '✅'} 발표물 ${srcs.length}종 · 실패 ${fail}건`);
  console.log(`   Loom = 입음 ${loom붙은것.length} + 훅 없어 안 입음 ${loom안붙은것.length}  (합계 ${srcs.length})`);
  loom붙은것.forEach((s) => console.log(`     ✅ ${s}`));
  loom안붙은것.forEach((s) => console.log(`     ·  ${s} — 훅을 달면 다음 빌드에 입는다`));
  return fail ? 1 : 0;
}

/* 🔑 CLI 로 부를 때만 돈다 — `require` 로 열 수 있어야 **게이트를 픽스처가 문다**.
 *   그전엔 로드 즉시 `process.exit` 이라 단위 시험이 원리적으로 못 닿았고, 못 닿는 게이트는
 *   변이 검사에서 구멍으로 나온다(지면방 `분모확인()` 이 같은 이유로 떼어져 있다). */
if (require.main === module) process.exit(main());

/* ⚠ `loom얹기` 는 이제 **공용 통로가 진다**(2026-08-18). 여기서 다시 내보내는 이유는
 *   `tests/발표물Loom.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 가 «발표물 관점»에서 그 통로를 계속 재기 때문이다 —
 *   시그니처를 맞춰 두면 그 회귀가 통로의 회귀도 겸한다(재는 자를 늘리지 않는다).
 *   🔑 CSS 인자는 안 받는다 — 통로가 프리셋에서 스스로 만든다(두 곳에서 만들면 갈라진다).
 *   🔴 **게이트 없는 쪽(`강제얹기`)을 내보낸다** — 원래 계약이 그랬다(게이트는 호출부의 `얹을까`).
 *      게이트를 여기 품으면 픽스처가 「훅 0 인데 얹힌 판」을 못 만들고, 그 순간 탐지력 회귀가
 *      «잡을 게 없어서» 초록이 된다(실측 2026-08-18: `발표물Loom` ⑨ 가 그렇게 뒤집혔다). */
const loom얹기 = (html) => loom얹기모듈.강제얹기(html, LOOM_지면);

module.exports = { 훅들, 얹을까, loom얹기, loom뜯기, unembed, LOOM_지면, LOOM_뜯기,
  룸씌우기, 민목록, 어두운클래스들, 휘도, 심긴묶음, 심긴활자남았나, MARKER,
  PAGED_MARKER, 심긴쪽번호 };
