#!/usr/bin/env node
// 발표물린트 — 인쇄물 HTML이 정본 잠금값을 지키는지 기계로 검사한다.
//
// 왜 있나: 발표물 10종은 전부 「자립형 HTML 1파일」이라 공통 CSS를 뺄 수 없다.
//   즉 색·서체·인쇄 규격이 파일마다 복사된다 — 복사본은 언젠가 갈라진다.
//   갈라지는 방향은 언제나 조용하다(화면은 멀쩡해 보이고 종이에서만 틀린다).
//   그래서 「사람이 눈으로 확인」 대신 이 린트가 진다.
//
// 사용법:
//   node tools/발표물린트.js docs/발표물/05_커리큘럼_로드맵_A3.html
//   node tools/발표물린트.js docs/발표물/*.html
//   node tools/발표물린트.js --넘침 docs/발표물/*.html   # 쪽이 넘쳐 잘리는지까지 (헤드리스 크롬)
//
// 종료 코드: 위반이 있으면 1. 크롬이 없어 --넘침 을 **안 돌렸으면 2**(통과 아님).
// CI·/deploy 에서 그대로 쓸 수 있다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const 활자주입 = require('./lib/활자주입.js');

// 정본 = docs/정본/SYNK/SYNK 집필 규범.txt §7(금칙어 — 구 발표물 제작 프롬프트 [공통 블록] ■2)
//
// ⚠ 「졌다」·「늦었다」는 **단독 낱말일 때만** 금칙어다. 한글 음절 뒤에 붙으면 전혀 다른 말이 된다
//   — 「즐거워졌다」·「좋아졌다」·「나아졌다」는 정반대 뜻인데 부분일치로 잡으면 다 걸린다
//   (실측: 상담 브로셔의 핀란드 인용문 「학교가 더 즐거워졌다」가 금칙어로 잡혔다).
//   가드가 실작업을 벌주면 사람이 가드를 끈다. 그래서 앞 글자가 한글이면 통과시킨다.
const BANNED = ['패배', '실패', '불운', '하락', '부족', '안 됨'];
const BANNED_STANDALONE = ['졌다', '늦었다'];

// 폐기 표기 — 되살아나면 그 산출물은 폐기다(정본 ■3·■5·■7·■9)
const DEAD = [
  'Define', 'Build', 'Execute',          // 구 사이클 (현행 = Learn→Plan→Experience→Record)
  '다음 필살기', '내일의 필살기',           // 둘 다 퇴역(08-13) — 확정 표기는 「다음에 맞힐 문제」
                                          //   한국인도 첫 독해에 못 읽는 은유였다(F394 · 기업마스터 제6조 구판 표현)
                                          //   선행 실측: 동결 `_src` 6종 포함 docs/발표물 전량에 이 문구 0건 — 거짓양성 없음
  '감응력', '협응력', '공감능력',           // 구 역량 표현 — 대외물 금지
  'Pretendard', 'Noto Sans KR', 'KoPubWorld', // 구 서체 (현행 = SUIT·Inter Tight·DM Mono)
  '원어민급 지향',                        // TOPIK 6급 전제 표현 — 상한 5급 확정으로 폐기
];

/**
 * 반전면 색. #101528 은 **탈락한 값**이다(디자인 컨셉 정본 v1.2) —
 * 채도 43%라 축소하면 순검정과 구별되지 않아 인스타 썸네일·저가 안드로이드에서 색조가 죽는다.
 * #0B1A2E(구 미드나잇)도 2026-08-04 브랜드 키트 이관(_브랜드킷.md v2.0)으로 탈락 —
 * 반전면 확정값은 키트의 Navy 2 다.
 */
const MIDNIGHT_OK = '#08090C';
const MIDNIGHT_DEAD = ['#101528', '#08080B', '#0B1A2E'];

function lint(file) {
  const html = fs.readFileSync(file, 'utf8');
  // 인쇄면에 실제로 찍히는 텍스트만 본다 — 주석·CSS 안의 말은 종이에 안 나온다.
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  // ⚠ CSS 주석도 걷어낸다. 안 걷으면 「#101528 은 탈락값이다」라고 적어 둔 주석 자체를
  //   위반으로 잡는다(실측 — 이 린트가 처음 돈 날 자기 주석에 걸렸다).
  //   가드는 「실제로 렌더에 쓰이는 표기」만 봐야 한다.
  // ⚠ `<style>` 태그 자체를 떼고 본다. 안 떼면 **첫 규칙의 셀렉터에 `<style>` 이 붙어**
  //   `@font-face` 가 `<style>\n@font-face` 로 읽힌다(08-05 픽스처가 잡았다). 지금껏 안 물린 건
  //   첫 규칙이 늘 `.mono`·`@page` 라 우연히 통과했을 뿐이다 — 셀렉터 기준 판정 전부의 이음매다.
  const css = (html.match(/<style[\s\S]*?<\/style>/g) || []).join('\n')
    .replace(/<\/?style[^>]*>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const bad = [];
  const info = [];
  const hit = (list) => list.filter((w) => text.includes(w));

  const banned = hit(BANNED).concat(
    BANNED_STANDALONE.filter((w) => new RegExp(`(^|[^가-힣])${w}`).test(text))
  );
  if (banned.length) bad.push(`금칙어 8종: ${banned.join(', ')}`);

  const dead = hit(DEAD);
  if (dead.length) bad.push(`폐기 표기: ${dead.join(', ')}`);

  // 자립형 1파일 — 외부 자원이 하나라도 있으면 유호님 환경에서 깨진다
  // ⚠`data:` 는 **외부가 아니라 인라인**이다. 규칙이 지키려는 것은 「파일 하나로 열린다」이고
  //   data URI 는 그 규칙을 어기는 게 아니라 지키는 방법이다 — 08-22 B2 «신호만 펠트»
  //   (워드마크 꺾쇠를 렌더판으로 인라인)를 넣자 여기서 거짓 위반이 났다. 규칙이 아니라 자가 틀렸다.
  const ext = [...body.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !u.startsWith('#') && !u.startsWith('data:'));
  if (ext.length) bad.push(`외부 자원: ${ext.join(', ')}`);
  if (/@import/.test(html) || /url\(\s*['"]?https?:/.test(html)) bad.push('@import 또는 CDN url()');

  // 기간 약속 금지 — 승급은 도달제다(정본 ■7)
  if (/(\d+)\s*(개월|주|년)\s*이?면\s*\d*\s*급/.test(text)) bad.push('기간 약속(「N개월이면 N급」)');

  // 비노출 잠금 — 고객 대면물에서 SYNK STUDIO 는 언급하지 않는다(정본 ■8)
  const hidden = ['STUDIO'].filter((w) => text.includes(w));
  if (hidden.length) bad.push(`비노출 잠금 위반: ${hidden.join(', ')}`);

  // 철회된 제품 라인 — 의류·굿즈·식품(구 Wear·Pantry·우산명)은 2026-08-16 계보에서
  // 제거됐다(조직계보 v1.4 부록 5 · 유호님 확정). 비노출이 아니라 철회라 예외 자리가
  // 없다 — 투자자 덱에도 안 쓴다. 구 덱을 재활용하면 조용히 되살아나므로 여기서 막는다.
  //   ⚠ 경계를 안 두면 오탐이 난다 — 「소프트웨어·하드웨어」가 「웨어」에, 「Wearable」이
  //   「Wear」에 걸린다(에듀테크 발표물에 실제로 나올 낱말이다). 그래서 한글 쪽은 SYNK·싱크
  //   접두를 요구하고, 영문 쪽은 뒤에 소문자가 붙지 않을 것을 요구한다.
  const 철회패턴 = [
    ['Wear', /Wear(?![a-z])/],
    ['Pantry', /Pantry(?![a-z])/],
    ['SYNK LIFE', /SYNK\s*LIFE/],
    ['싱크 웨어', /(?:SYNK|싱크)\s*웨어/],
    ['팬트리', /팬트리/],
  ];
  const 철회됨 = 철회패턴.filter(([, re]) => re.test(text)).map(([이름]) => 이름);
  if (철회됨.length) bad.push(`철회된 제품 라인(2026-08-16): ${철회됨.join(', ')}`);

  // 소개·안내물에 가격 수치를 넣지 않는다(정본 ■8)
  if (/\d[\d,]*\s*만?₮|\d[\d,]*\s*원(?![가-힣])/.test(text)) bad.push('가격 수치');

  // 🚫 DM Mono 에 한글·키릴 — 글리프가 없어 인쇄하는 순간 깨진다(정본 ■9 금칙①)
  const monoBad = [...body.matchAll(/class="[^"]*\bmono\b[^"]*"[^>]*>([^<]*)</g)]
    .map((m) => m[1]).filter((t) => /[ㄱ-힣Ѐ-ӿ]/.test(t));
  if (monoBad.length) bad.push(`DM Mono 에 한글·키릴: ${monoBad.join(' | ')}`);

  // 🔑 DM Mono 는 .mono 클래스 통로로만 입힌다 — CSS 가 다른 셀렉터로 입히면 위의 내용
  //   검사(class="mono" 기준)가 그 자리를 영영 못 본다. 실측: 01 덱 리허설표가
  //   `.reh td.c{font-family:'DM Mono'…}` 로 한글 셀을 mono 에 태웠는데 린트는 초록이었다.
  //   라우팅은 검사보다 넓어야 한다 — 통로를 하나로 강제해야 내용 검사가 완전해진다.
  //   예외: ::before/::after 는 마크업 클래스를 못 다는 대신 content 가 CSS 안에 있으니 그걸 직접 검사한다.
  const monoRoute = [];
  for (const chunk of css.split('}')) {
    const parts = chunk.split('{');
    if (parts.length < 2) continue;
    const decls = parts.pop();
    const sel = (parts.pop() || '').trim();
    if (!/DM Mono/i.test(decls)) continue;
    // ⚠ @font-face 는 폰트를 **정의**할 뿐 어떤 요소에도 **입히지 않는다.** 이 검사의 표적은
    //   「입히는 자리」라 선언 블록을 잡으면 거짓양성이다(08-05 임베드 이관에서 6종 전부 빨개졌다).
    //   같은 함정을 인쇄물_키트검사가 먼저 밟았다 — 「선언을 읽고 사용을 안 읽었다」.
    //   ⚠ @media 는 제외 대상이 아니다: 위 파싱이 중첩 안쪽 셀렉터를 뽑으므로 그대로 검사된다.
    if (/^@font-face\b/i.test(sel)) continue;
    const content = decls.match(/content\s*:\s*['"]([^'"]*)['"]/);
    if (content) {
      if (/[ㄱ-힣Ѐ-ӿ]/.test(content[1])) monoRoute.push(`${sel} (content "${content[1]}" 에 한글·키릴)`);
      continue;
    }
    const badSel = sel.split(',').map((s) => s.trim()).filter((s) => s && !/\.mono\b/.test(s));
    if (badSel.length) monoRoute.push(badSel.join(', '));
  }
  if (monoRoute.length) bad.push(`DM Mono 를 .mono 통로 밖에서 입힌다(내용 검사가 못 보는 자리): ${monoRoute.join(' · ')}`);

  // 세 번째 모노 통로 — 시맨틱 태그(code·kbd·tt)는 브라우저 기본 모노스페이스라
  //   한글이 들어가면 굴림체로 폴백한다(01 덱의 <code>08_설명회_…</code> 실측 — PDF 폰트
  //   덤프에서 GulimChe 가 한글 잉크를 그리고 있었다). 라틴 파일명·코드는 무방하다.
  const semMono = [...body.matchAll(/<(code|kbd|tt)\b[^>]*>([^<]*)</g)]
    .map((m) => m[2]).filter((t) => /[ㄱ-힣Ѐ-ӿ]/.test(t));
  if (semMono.length) bad.push(`시맨틱 모노 태그(code·kbd·tt)에 한글·키릴 — 굴림 폴백: ${semMono.join(' | ')}`);

  // 이모지를 그대로 인쇄하지 않는다(정본 ■9) — 단색 라인 아이콘으로 치환한다.
  //
  // ⚠ 범위로 잡으면 안 된다. 처음 코드포인트 구간(2600–27BF)으로 검사했더니
  //   ☐(체크박스)·→(화살표)·▷ 같은 **활자**까지 잡아 멀쩡한 산출물 3개가 빨개졌다.
  //   가드가 실작업을 벌주면 사람이 가드를 끈다. 유니코드 속성으로 「그림문자」만 고른다.
  //   Extended_Pictographic = 그림으로 렌더되는 문자(📷 ✂ ⛔). ☐ → ▷ · 는 여기 안 든다.
  const emoji = [...new Set(body.match(/\p{Extended_Pictographic}/gu) || [])];
  if (emoji.length) bad.push(`인쇄면에 이모지: ${emoji.join(' ')} (단색 라인 아이콘으로 바꿀 것)`);

  // 구 서체가 CSS 스택에 남아 있는지도 본다(본문 텍스트엔 안 보이지만 렌더는 바뀐다)
  const deadFont = ['Pretendard', 'Noto Sans KR', 'KoPubWorld'].filter((f) => css.includes(f));
  if (deadFont.length) bad.push(`CSS 스택에 구 서체: ${deadFont.join(', ')}`);

  // 반전면 색 — 탈락값이 되살아나면 막는다
  const revived = MIDNIGHT_DEAD.filter((c) => new RegExp(c, 'i').test(css));
  if (revived.length) bad.push(`반전면에 탈락한 색 ${revived.join(', ')} (확정값은 ${MIDNIGHT_OK})`);

  // 인쇄 규격
  const size = (css.match(/@page\s*\{[^}]*size:\s*([^;]+);/) || [])[1];
  if (!size) bad.push('@page 용지 선언 없음');
  if (!/@page\s*\{[^}]*margin:\s*0/.test(css)) bad.push('@page 여백 0 잠금 없음(크롬이 머리글을 찍는다)');
  if (!/print-color-adjust:\s*exact/.test(css)) bad.push('print-color-adjust: exact 없음(배경이 인쇄에서 날아간다)');

  info.push(`용지 ${size ? size.trim() : '?'}`);
  info.push(`「____」 빈칸 ${(text.match(/_{4,}/g) || []).length}개`);
  // 교재를 언급한 산출물만 진행 상태를 함께 적어야 한다(정본 ■7)
  if (/시냅스 코어|코어 \d권|교재/.test(text) && !text.includes('검수를 앞두고')) {
    bad.push('교재를 언급하면서 진행 상태(원어민 검수를 앞두고 있음)를 안 밝혔다');
  }
  return { bad, info };
}

/* ══ 넘침 검사 (--넘침) ══════════════════════════════════════════════════════
 * 왜 텍스트 검사로는 못 잡나 — 쪽 상자는 전부 `overflow:hidden` 이다. 내용이 한 줄만
 * 넘쳐도 **잘린 채로 조용히 초록**이 된다. 위 검사들은 파일의 글자를 읽으니 「글자는 다 있다」고
 * 말하고, 종이에서만 사라진다. 이 파일 머리말이 말하는 실패 모드 그 자체인데 정작 안 보고 있었다.
 * 실측(2026-08-10): 설명회 덱에 슬로건 부연 한 줄을 넣자 01·09·16장이 각각 9·19·3px 넘쳐
 * 잘렸다 — 린트도 빌드도 전부 초록이었다.
 *
 * 무엇을 「쪽 상자」로 보나: **클래스 이름을 손으로 적지 않는다**(새 산출물이 다른 이름을 쓰면
 * 그 자리가 통째로 사각이 된다). 대신 렌더된 성질로 고른다 —
 *   ① 잘림이 일어나는 상자여야 한다: computed overflow-x/y 중 하나가 hidden
 *   ② 쪽 크기여야 한다: clientHeight 가 그 문서에서 가장 큰 상자의 절반 이상
 * ⚠ 0건과 「아무것도 안 봤다」를 가른다 — 잰 상자 수(분모)를 항상 함께 낸다(F207).
 */
const 넘침측정기 = `(() => {
  const all = [...document.querySelectorAll('body *')];
  // ⚠ 「잰 쪽 0」에는 뜻이 둘이다 — ①문서가 안 떴다(사고) ②이 문서엔 쪽 상자가 없다(정상).
  //   둘을 같은 모양으로 내면 로드 실패가 통과로 읽힌다. 그래서 몸통 요소 수를 함께 낸다.
  const 몸통 = all.length;
  const 상자 = all.filter((el) => {
    const cs = getComputedStyle(el);
    return cs.overflowX === 'hidden' || cs.overflowY === 'hidden';
  }).filter((el) => el.clientHeight > 0);
  if (!상자.length) return { 잰것: 0, 몸통, 넘친것: [] };
  const 최대 = Math.max(...상자.map((el) => el.clientHeight));
  const 쪽 = 상자.filter((el) => el.clientHeight >= 최대 / 2);
  const 넘친것 = [];
  /* ⚠ scrollHeight-clientHeight 로 재지 **않는다.** flex 상자에서는 아래쪽 padding 이
   *   scrollHeight 에 얹혀 아무것도 안 잘렸는데 「넘쳤다」가 나온다(실측: 02 안내문 hero
   *   — 모든 자식이 상자 안에 있는데 22px 초과로 잡혔다). 거짓양성이 곧 「검사를 끄는 손버릇」이다.
   *   그래서 **실제로 상자 밖으로 나간 자손이 있는가**를 직접 본다 — 그것만이 잘림이다. */
  쪽.forEach((el, i) => {
    const box = el.getBoundingClientRect();
    let dy = 0, dx = 0, 범인 = '';
    for (const c of el.querySelectorAll('*')) {
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = c.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      /* 위·왼쪽도 본다 — 쪽 상자가 가운데 정렬(justify-content center)이면 넘친 내용이
       * **양끝으로** 잘린다. 아래만 보면 그런 슬라이드에서 절반을 놓친다(설명회 덱이 그 모양이다). */
      const oy = Math.round(Math.max(r.bottom - box.bottom, box.top - r.top));
      const ox = Math.round(Math.max(r.right - box.right, box.left - r.left));
      if (oy > dy || ox > dx) {
        if (oy > dy) dy = oy;
        if (ox > dx) dx = ox;
        범인 = (c.className || c.tagName).toString().slice(0, 24) + ' “' + c.textContent.trim().replace(/\\s+/g, ' ').slice(0, 24) + '”';
      }
    }
    if (dy > 1 || dx > 1) {
      const h = el.querySelector('h1,h2,h3');
      넘친것.push({
        i: i + 1,
        표: (el.className || el.tagName).toString().slice(0, 40),
        제목: h ? h.textContent.trim().replace(/\\s+/g, ' ').slice(0, 30) : '',
        세로: dy > 1 ? dy : 0, 가로: dx > 1 ? dx : 0, 범인,
      });
    }
  });
  return { 잰것: 쪽.length, 몸통, 넘친것 };
})()`;

/** 헤드리스 크롬으로 한 파일을 재서 넘친 쪽을 낸다. 통로는 브랜드렌더린트와 **같은 모양**이다. */
function 넘침(file, chrome) {
  const html = fs.readFileSync(file, 'utf8');
  /* ⚠ 활자가 안 박힌 원본(`_src_*`)은 **잴 수 있는 대상이 아니다** — 폴백 활자로 조판돼
   *   글자 폭이 달라진다(실측: `_src_02` 6/6 적색 ↔ 같은 내용 산출물 0/8). 「못 쟀다」가 아니라
   *   「대상 아님」이라 쪽 상자 0 과 같은 갈래로 낸다. 판정은 활자주입 한 곳에서만 온다. */
  if (활자주입.원본인가(html)) return { 활자미주입: true, 잰것: 0, 몸통: 0, 넘친것: [] };
  /* ⚠ `load` 는 **활자가 앉기 전**이다 — 여기서 재면 같은 파일이 회차마다 갈린다.
   *   실측(2026-08-10 · 02 안내문 kr): 잰 쪽 2·몸통 157 로 DOM 은 매 회차 똑같은데
   *   넘침만 0px ↔ 18px 로 튀었다(6회 중 1~3회 적색). 18px = 한 줄 높이 — 폴백 활자로
   *   재면 한 줄이 덜 접혀 통과하고, 본 활자가 앉은 뒤엔 접혀 넘친다. 죽은 세션 둘이
   *   서로 반대 실측을 보고한 원인이 이것이다(`286c22f7` 20/20 초록 ↔ `f12f3c7d` 🔴18px).
   *   ⚠ 새는 방향은 여기서도 「통과」다 — 폰트가 늦으면 조용히 초록이 된다.
   *   그래서 `document.fonts.ready` 를 기다리고, 그 뒤 한 턴을 더 넘겨 재배치를 앉힌다.
   *   ⚠ 프레임(`requestAnimationFrame`)으로 넘기지 **않는다** — `--virtual-time-budget` 아래선
   *   rAF 가 안 돌아 8회 중 6회가 「결과를 못 냈다」로 죽었다(실측). 가상 시간이 굴려 주는
   *   `setTimeout` 만 쓴다. 못 기다리면 결과를 아예 안 내보낸다 — 호출부가
   *   「측정기가 결과를 못 냈다」로 죽는다(통과 아님). */
  const 주입 = `<script>window.addEventListener('load', () => {
    const 재기 = () => {
      let r; try { r = ${넘침측정기}; } catch (e) { r = { 오류: String(e && e.stack || e) }; }
      try { r.폰트 = document.fonts ? document.fonts.status : '없음'; } catch (e) { r.폰트 = '못읽음'; }
      /* 기다렸는데도 안 앉았으면 **결과를 내지 않는다.** 여기서 그냥 재면 그 판정은
       * 폴백 활자의 것이고, 새는 방향은 언제나 「넘침 0 = 통과」다. 조용한 초록보다 시끄러운 실패. */
      if (r.폰트 !== 'loaded' && r.폰트 !== '없음') r.오류 = '활자가 안 앉은 채 쟀다 (status=' + r.폰트 + ')';
      const pre = document.createElement('pre');
      pre.id = 'SYNK_OVERFLOW_OUT';
      pre.textContent = JSON.stringify(r);
      document.documentElement.appendChild(pre);
    };
    const 활자 = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    활자.then(() => setTimeout(재기, 0));
  });</script>`;
  const 주입본 = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${주입}</body>`) : html + 주입;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-넘침-'));
  const tmp = path.join(dir, 'page.html');
  try {
    fs.writeFileSync(tmp, 주입본, 'utf8');
    // ⚠ 한글 경로 → encodeURI. 안 하면 빈 문서가 뜨고 넘침 0건으로 「통과」한다.
    const url = 'file:///' + encodeURI(tmp.replace(/\\/g, '/'));
    const out = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', url,
    ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/<pre id="SYNK_OVERFLOW_OUT">([\s\S]*?)<\/pre>/);
    if (!m) throw new Error('측정기가 결과를 못 냈다 — 페이지 스크립트 오류이거나 로드 실패');
    const r = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
    if (r.오류) throw new Error('측정기 예외: ' + r.오류);
    // 빈 문서를 「통과」로 읽지 않는다 — 단 「쪽 상자가 없는 문서」와는 가른다(번역 작업본이 그렇다).
    if (!r.몸통) throw new Error('문서가 비어 있다 — 로드 실패를 통과로 읽을 뻔했다');
    return r;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 정리 실패는 검사 결과를 안 바꾼다 */ }
  }
}

function main(argv) {
  const 넘침검사 = argv.includes('--넘침');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.error('사용법: node tools/발표물린트.js [--넘침] <html...>');
    return 2;
  }

  let chrome = null;
  if (넘침검사) {
    // 크롬 경로 목록을 여기 베끼지 않는다 — 같은 판정을 두 곳에 적으면 갈라진다.
    ({ findChrome: chrome } = require('./브랜드렌더린트.js'));
    chrome = chrome();
    if (!chrome) {
      console.error('SKIP: 크롬을 못 찾았다 — 넘침 검사를 **안 돌렸다**(통과 아님). CHROME_PATH 로 지정할 수 있다.');
      return 2;
    }
  }

  let fail = 0;
  for (const f of files) {
    const { bad, info } = lint(f);
    if (넘침검사) {
      let r;
      try { r = 넘침(f, chrome); }
      catch (e) { console.error(`✗ ${f} — 넘침 검사 실패: ${e.message}`); return 2; }
      info.push(r.활자미주입
        ? '활자 미주입 원본 — 넘침 검사 대상 아님(폴백 활자라 폭이 다르다)'
        : r.잰것
          ? `쪽 ${r.잰것}개 실측`
          : `쪽 상자 0 — 넘침 검사 대상 아님(요소 ${r.몸통}개는 떴다)`);
      for (const v of r.넘친것) {
        const 방향 = [v.세로 ? `세로 ${v.세로}px` : '', v.가로 ? `가로 ${v.가로}px` : ''].filter(Boolean).join(' · ');
        bad.push(`쪽 ${v.i}(${v.표}${v.제목 ? ` · “${v.제목}”` : ''})이 ${방향} 넘쳐 잘린다 — overflow:hidden 이라 화면에선 안 보인다. 밖으로 나간 것: ${v.범인}`);
      }
    }
    if (bad.length) {
      fail++;
      console.log(`🔴 ${f}  (${info.join(' · ')})`);
      bad.forEach((b) => console.log(`   - ${b}`));
    } else {
      console.log(`✅ ${f}  (${info.join(' · ')})`);
    }
  }
  return fail ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { lint, 넘침, main };
