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
 * v0.3 — 유호 픽 3 집행 2026-08-15 (「방향·림·고칠점 전부 신경써줘」= 셋 다 위임)
 *   ① 방향 = **유지**. 검은 무대는 유호 교정·레퍼런스 4장·08-14 「브랜드 분위기」 분해가 각각
 *      따로 도착한 같은 좌표라 뒤집을 근거가 0이다. 다만 v0.2 는 **화면 전용으로 지어져 있었다** —
 *      문서는 화면에서만 살지 않는다. 그래서 방향을 바꾸는 대신 «낮 지면»(인쇄·PDF)을 한 겹 더 짓는다.
 *   ② 림 = **무채로 뒤집는다**(기본값 교체). 실측이 갈랐다 — 두 판의 «다른 픽셀»만 떼어 재니
 *      스펙트럼 = 색상 7갈래·최대 C* 53.5·평균 33.0 / 무채 = 1갈래·최대 25.5·평균 12.4.
 *      그리고 스펙트럼의 실제 지배 색상은 보라 24.9%+자주 23.5%+분홍 16.2% = **64.6%가 자주-보라**다.
 *      킷에 그 직책이 없는 색이 지면의 강조를 가져간다 → 철칙 ④(바탕+잉크+**신호 1점**) 위반.
 *      「면이 아니라 빛」이라는 v0.2 의 해석은 레퍼런스가 **오브 1점**일 때만 성립한다 —
 *      이 문서는 유리 8 + 절 번호 10 = 18곳이라 프리즘이 사건이 아니라 벽지가 된다.
 *      🚫스펙트럼 기본값 복귀 재제안. 레시피는 지우지 않고 `--림 스펙트럼` 으로 남긴다(오브 1점짜리 지면용).
 *   ③ 고칠 곳 = 아래 「낮 지면」 + 초점·선택·색상표·링크 어포던스(전부 렌더 실측으로 «없음» 확인).
 *
 * ⚠**인쇄를 검은 무대로 두면 안 되는 이유는 취향이 아니라 실패 모드다**:
 *   크롬 인쇄 대화상자의 「배경 그래픽」은 **기본이 꺼짐**이고, 그러면 바탕만 흰 종이가 되고 글자는
 *   Cream 그대로 남는다 — **Cream on 흰 종이 = 1.13:1**(본문이 통째로 사라진다 · Slate 3.06 · Paper 1.07).
 *   낮 지면은 잉크가 어두워서(Ink on 흰 종이 17.68:1) 그 체크가 켜지든 꺼지든 **읽힌다**.
 *   덤으로 잉크값도 준다 — 현행 인쇄 지면 실측: 바탕 rgb(15,23,48) · A4 한 장의 89.7%가 진남색 면.
 *
 * 통로:  python tools/펠트천굽기.py                       # 패치 → data URI 타일
 *        node tools/펠트문서.js --굽기 입력.html 출력.html   # <!--펠트스킨--> 자리에 주입
 *        node tools/펠트문서.js --검사 문서.html            # 자립성(그림 외부 참조 0)
 *        node tools/펠트문서.js --대비                      # 글자×면 전량 심판(밤 지면 + 낮 지면)
 *        node tools/펠트문서.js --림 스펙트럼               # 분산 림을 되돌린다(기본값은 무채)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.dirname(__dirname);
/* Loom 부품 통로 — 재질·부품·율의 정본은 여기 하나다(2026-08-16 배선).
   이 파일은 그 위에 «지면 골격»(판·레일·표지·표·수치·모션)만 얹는다. */
const loom = require('./lib/loom.js');
/* 표기 접기 정의는 하나다 — `tests/lib/소스검사.js`. 재현 대조(아래 `몸통`)가 손으로 접으면
 * CRLF 축만 막혀, 굽는 기계가 줄끝에 한 칸 흘린 날 «지면이 갈라졌다»가 된다(#Q101 · 14/14 반쪽). */
const { 표기접기 } = require('../tests/lib/소스검사.js');
const 천길 = path.join(루트, 'docs', 'tools', '펠트천.json');
const 토큰길 = path.join(루트, 'docs', '디자인_토큰.json');

const 표지오브길 = path.join(루트, 'docs', 'tools', '표지오브.json');

const 표식 = '<!--펠트스킨-->';
// 검은 무대에서 실물 오브로 쓰는 천 — 첫째가 «기본 염료»다(유호 확정 08-19 · 조항 ⓘ:
// 기본색 · 결 98.7% 라 굽기 가드 통과). 뒤는 무채 후퇴(다크 펠트는 결이 죽어 애초에 밝은 천만).
// 🔑이름을 여기 적지 않고 토큰 색.기본색 에서 파생한다 — 사본이 생기면 유호님이 기본색을 바꾸는 날
// loom 만 따라가고 스킨·대비 심판은 옛 천을 잰다(반박 패스 M-2 · 「같은 판정을 두 곳에 적으면 갈라진다」).
const 기본색이름 = (() => {
  try { return JSON.parse(fs.readFileSync(토큰길, 'utf8')).색.기본색.이름 || 'Chalk'; }
  catch { return 'Chalk'; }   // 토큰이 없으면 정본읽기()가 어차피 던진다 — 여기선 무채 후퇴만
})();
const 기본천 = [기본색이름, 'Chalk', 'Paper'];

function 정본읽기() {
  if (!fs.existsSync(천길)) {
    throw new Error('펠트천이 없다 — 먼저 `python tools/펠트천굽기.py` 를 돌린다: ' + 천길);
  }
  const 천 = JSON.parse(fs.readFileSync(천길, 'utf8'));
  const 토큰 = JSON.parse(fs.readFileSync(토큰길, 'utf8'));
  const 색 = {};
  for (const c of 토큰['색']['킷']) 색[c['이름']] = c['hex'];
  if (!fs.existsSync(표지오브길)) {
    throw new Error('표지오브가 없다 — 먼저 `python tools/표지오브굽기.py` 를 돌린다: ' + 표지오브길);
  }
  const 표지오브 = JSON.parse(fs.readFileSync(표지오브길, 'utf8'));
  return { 천: 천['천'], 규격: 천['_규격'], 색, 서체: 토큰['서체'], 표지오브 };
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
    ['Chalk', 0.55, 338],
  ],
  무채: [
    ['Ash', 0.45, 25], ['Chalk', 0.60, 120], ['Ash', 0.35, 210],
    ['Chalk', 0.42, 300], ['Ash', 0.5, 350],
  ],
};

/* ── 면 사전 — 글자가 앉을 수 있는 모든 바닥 ────────────────────────────────
   유리는 «합성»이다(무대 위에 반투명 층이 겹친다) — 그래서 대비를 잴 때
   평면 hex 가 아니라 층을 실제로 합성한 값으로 잰다. 눈이 보는 것이 그 값이다. */
const 면들 = {
  무대: { 바탕: 'Graphite', 층: [] },
  유리: { 바탕: 'Graphite', 층: [['Graphite 2', 0.55], ['Chalk', 0.035]] },
  유리밝은: { 바탕: 'Graphite', 층: [['Graphite 2', 0.55], ['Chalk', 0.085]] },
  펠트오브: { 천: 기본색이름 },   /* 표지 오브의 «자» — v0.4(09-01)부터 실물은 실굽기 렌더(표지오브.json · Paper ·
                                     중심휘도 199/255)인데 심판은 천 타일로만 재므로 근백색 천(기본색)이 근사자다.
                                     둘 다 근백색이라 성립 — 오브 색을 어두운 쪽으로 바꾸는 날 이 근사가 깨진다(그날 여기부터). */
  /* 낮 지면(인쇄·PDF) — 종이 위엔 합성이 없다. 전부 킷의 평면 hex 그대로다.
     ⚠이 셋을 «잰다»는 것이 요점이다: 지면을 하나 더 지어놓고 자를 안 대면
       안 재는 면이 하나 늘 뿐이다(장치가 새는 방향은 언제나 통과다). */
  종이: { 바탕: 'Paper', 층: [] },
  종이판: { 바탕: 'Chalk 2', 층: [] },
  종이줄: { 바탕: 'Chalk 3', 층: [] },
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
  { 글자: 'Chalk', 면: '무대', 자리: '본문 — 이 문서에서 글자가 가장 많이 앉는 자리' },
  { 글자: 'Ash', 면: '무대', 자리: '보조 문장·메타·푸터·레일 비활성' },
  { 글자: 'Chalk', 면: '유리', 자리: '유리 패널 본문·표 본문' },
  { 글자: 'Ash', 면: '유리', 자리: '유리 패널 보조·표 주석' },
  { 글자: 'Chalk', 면: '유리밝은', 자리: '표 머리·레일 활성·코드 조각' },
  { 글자: 'Coral 2', 면: '유리', 자리: '다크 보조 강조 글자(킷 직책 그대로)' },
  { 글자: 'Coral', 면: '무대', 자리: '신호 — 절 번호 옆 점·활성 표식' },
  { 글자: 'Ink', 면: '펠트오브', 큰가: true, 자리: '펠트 오브 위 글자(표지 명패 — .오브 2.3rem·800 고정 = 대형 기준 · v0.4 실물은 실굽기 렌더, 천은 근사자. 본문 크기 글자를 이 면에 올리지 않는다)' },
  { 글자: 'Ash', 면: '무대', 큰가: true, 자리: '히어로 그러데이션의 어두운 끝(대형 타이포)' },
  /* ── 낮 지면(인쇄·PDF) ── 화면과 «같은 골격, 다른 빛». 킷 직책의 허용 바닥을 그대로 탄다:
     Slate 는 다크 전용이라 종이에선 Slate 2 로 바뀌고, Coral 은 라이트에서 글자 금지라
     강조 글자는 Coral 3(24px↑)만 쓴다. 그래서 짝 목록이 밤·낮으로 갈리는 것이 정상이다. */
  { 글자: 'Ink', 면: '종이', 지면: '낮', 자리: '본문 — 종이에서 글자가 가장 많이 앉는 자리' },
  { 글자: 'Ash 2', 면: '종이', 지면: '낮', 자리: '보조 문장·메타·푸터' },
  { 글자: 'Ink', 면: '종이판', 지면: '낮', 자리: '패널 본문(화면의 «유리»가 종이에선 콜아웃 바닥)' },
  { 글자: 'Ash 2', 면: '종이판', 지면: '낮', 자리: '패널 보조·인용' },
  { 글자: 'Ink', 면: '종이줄', 지면: '낮', 자리: '표 머리·절 번호 원판' },
  { 글자: 'Coral 3', 면: '종이', 지면: '낮', 큰가: true, 자리: '신호 — 종이에서는 Coral 이 글자로 못 서서 Coral 3(24px↑)' },
  { 글자: 'Ink', 면: '펠트오브', 지면: '낮', 큰가: true, 자리: '낮의 오브는 평면 Chalk 명패(렌더는 종이에 안 옮긴다 · v0.4) — 명패 2.3rem·800 고정, 대형 기준' },
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

/** 스킨 CSS 조립. @param 쓸천 인라인할 펠트 타일 @param 림 '무채'(기본)|'스펙트럼' */
function 스킨(쓸천, 림 = '무채') {
  const { 천, 규격, 색, 서체, 표지오브 } = 정본읽기();
  const 목록 = (쓸천 && 쓸천.length ? 쓸천 : 기본천);
  const 없는것 = 목록.filter((n) => !천[n]);
  if (없는것.length) throw new Error('구운 적 없는 천: ' + 없는것.join(', '));
  if (!림레시피[림]) throw new Error('림 레시피는 스펙트럼·무채 둘뿐이다 — 받은 값: ' + 림);

  const 쓰는색 = ['Graphite', 'Graphite 2', 'Graphite 3', 'Graphite 4', 'Chalk', 'Chalk 2', 'Chalk 3', 'Paper',
    'Ink', 'Coral', 'Coral 2', 'Coral 3', 'Ash', 'Ash 2', 'KC Cool Blue'];
  const 색줄 = 쓰는색.filter((n) => 색[n])
    .map((n) => `    ${변수이름(n)}:${색[n]}; ${변수이름(n)}-rgb:${rgb분해(색[n]).join(',')};`).join('\n');
  const 천줄 = 목록.map((n) => `    --천-${n.toLowerCase()}:url(${천[n].uri});`).join('\n');
  const 림줄 = 림레시피[림]
    .map(([이름, a, deg]) => `rgba(${rgb분해(색[이름]).join(',')},${a}) ${deg}deg`).join(',\n      ');
  const 천주 = 목록.map((n) => `${n} 결 ${천[n].결퍼센트}%`).join(' · ');

  /* 모바일 브라우저의 «상단 띠» — 안 정하면 흰색으로 남아 검은 무대 위에 흰 띠가 한 줄 선다.
     원고의 <meta> 에 맡기지 않고 스킨이 진다(전파 대상 문서마다 빠질 한 줄이라 F472 와 같은 자리). */
  return `<meta name="theme-color" content="${색['Graphite']}">
<style>
/* ── SYNK 지면 「검은 무대」 v0.2 — 조립 산출물(손 편집 금지) ────────────────────
   통로: python tools/펠트천굽기.py → node tools/펠트문서.js --굽기
   문법: 순흑에 가까운 무대 · 실물 펠트 오브 1점 · 유리 크롬(스펙큘러+분산 림)
   색:  무대 Navy 2 · 잉크 Cream · 3층 Slate · 신호 Coral «빛으로만»
        ⚠유리에 안료를 칠하지 않는다 — 색은 1.5px 분산 림(${림} 판)이 낸다.
   천:  ${천주} · ${규격.한변}px ${규격.형식} (실물 양모 사진 — 헌법 ①)
   ──────────────────────────────────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════════════════════
   ① Loom — 색·율·재질·부품 14종. **여기가 정본이고 이 파일은 그것을 소비한다.**

   ⚠이 주석에 백틱을 쓰지 않는다 — 여기는 템플릿 리터럴 «안»이라 하나로 지면이 통째로 끊긴다.

   왜 갈랐나 (실측 08-16): 이 스킨과 tools/lib/loom.js 가 **선택자 20개를 두 곳에서**
   정의하고 있었다(.유리 · .번호 · blockquote · a · code · h2 · h3 · ol · ul · p · td · th …).
   그래서 loom 이 «구운 재질»(Blender 렌더)로 갈아탄 뒤에도 소개서 6벌은 여기 있는
   backdrop-filter:blur(30px) 글래스모피즘을 계속 입고 있었다 — F498(유호 「너무 싸구려 AI처럼」)이
   고쳐진 것은 loom 쪽뿐이었고, 실제 지면은 안 닿았다. 지침: 같은 판정을 두 곳에 적으면 갈라진다.

   그리고 loom 에만 있던 부품 9종이 이 지면에 **아예 없었다** —
   각주번호·체크·칩·히어로수·실금·잔번호·쪽번호·링크점·인용부호. 전부 맨 텍스트였다.
   ⚠순서가 규율이다 — loom 이 «먼저», 골격이 «뒤». 뒤가 이기므로 골격은 고의로 덮을 수 있고,
     덮은 자리는 아래 §② 에 이유가 한 줄씩 붙어 있다(이유 없는 덮기는 중복 정본의 재발이다).
   ══════════════════════════════════════════════════════════════════════════ */
${loom.css({ 지면: '문서', 림, 천: 천[목록[0]] ? `url(${천[목록[0]].uri})` : null })}

/* ══════════════════════════════════════════════════════════════════════════
   ② 지면 골격 — Loom 부품이 «안 다루는» 층: 판·레일·표지·표·수치·콜아웃·모션.
      부품이 「지면의 작은 것」이라면 여기는 「지면 그 자체」다.
   ══════════════════════════════════════════════════════════════════════════ */
  :root{
${천줄}
    --유리막: rgba(var(--graphite2-rgb),.55);
    --윤: rgba(var(--chalk-rgb),.16);      /* 위 스펙큘러 */
    --윤약: rgba(var(--chalk-rgb),.07);
    --금: rgba(var(--chalk-rgb),.10);      /* 괘선 — 유리에 그은 실금 */
    --그늘: 0,0,0;                          /* 무대는 순흑 그림자를 쓴다(면이 아니라 빛의 부재) */
  }
  /* ⚠scroll-behavior 를 html 에 상시로 걸지 않는다 — 링크로 들어올 때 «먼 거리 자동 스크롤»이
     로드 순간에 돌아 어수선하다. 부드러움은 사용자가 «누른» 이동에만 붙인다(스크립트). */
  html{scroll-padding-top:96px;}

  .판{max-width:1220px;margin:0 auto;padding:0 26px 120px;
      display:grid;grid-template-columns:minmax(0,1fr);gap:0 44px;}
  .글{max-width:70ch;min-width:0;}

  /* ── 유리 = Loom §② 가 진다(위임). 여기 남는 것은 «이 지면만의 변주» 하나뿐 ──── */
  .유리.깊은{
    box-shadow:
      inset 0 1px 0 rgba(var(--chalk-rgb),.22),
      inset 0 -1px 0 var(--윤약),
      0 2px 3px rgba(var(--그늘),.55),
      0 48px 90px -40px rgba(var(--그늘),1);
  }

  /* ── 표지 = 무대 위 실물 오브 1점 + 편집 타이포 ─────────────────────────── */
  .표지{padding:104px 0 66px;display:grid;gap:30px;grid-template-columns:1fr;}
  /* 실물 오브 1점 — 레퍼런스 ①(검은 무대 위 밝은 양모 아이콘)의 문법.
     이 지면에서 «부피»를 가진 유일한 물건이고, 그래서 하나뿐이어야 한다.
     v0.4(09-01 · 유호 교정 「이거 별로야 — Loom 실굽기 재질·요소를 써라」):
     펠트천 타일 + inset 그림자 «CSS 흉내»(F498 계급 — 헌법 ① 「결은 사진 픽셀에서만」 위반)를 걷고
     실굽기 렌더(오브공방_0821 · ${표지오브.색이름} · 표지오브굽기.py)를 그대로 싣는다 —
     잔털·스티치·받침 그늘까지 전부 렌더의 것. 림라이트 그라디언트·테두리 흉내도 같이 걷었다. */
  .오브{
    width:132px;height:132px;flex:none;position:relative;
    background-image:url(${표지오브.uri});background-size:cover;background-position:center;
    display:grid;place-items:center;
    color:var(--ink);font-weight:800;font-size:2.3rem;letter-spacing:-.05em;
  }
  .표지 .꼭지{
    display:inline-flex;align-items:center;gap:.55em;
    font-size:.7rem;font-weight:700;letter-spacing:.2em;color:var(--ash);
    text-transform:uppercase;margin:0;
  }
  .표지 .꼭지::before{
    content:'';width:6px;height:6px;border-radius:50%;background:var(--coral);
    box-shadow:0 0 10px 1px rgba(var(--coral-rgb),.75);   /* 신호 = 면이 아니라 빛 */
  }
  .표지 h1{
    margin:.18em 0 0;font-size:clamp(3.2rem,10vw,6.6rem);font-weight:800;
    letter-spacing:-.052em;line-height:.93;
    background:linear-gradient(174deg,var(--chalk) 0%,var(--chalk) 44%,var(--ash) 118%);
    -webkit-background-clip:text;background-clip:text;color:transparent;
  }
  .표지 .한줄{
    margin:.7em 0 0;font-size:clamp(1.06rem,2.1vw,1.32rem);line-height:1.62;
    color:var(--chalk);max-width:30ch;font-weight:450;letter-spacing:-.025em;
  }
  .표지 .메타{margin:0;font-size:.83rem;color:var(--ash);letter-spacing:-.012em;}
  @media (min-width:760px){
    .표지{grid-template-columns:112px minmax(0,1fr);align-items:start;gap:34px;}
  }

  /* ── 절 머리·본문·링크·코드 = Loom §② 가 진다(위임) ────────────────────────
     남기는 것 셋. 이유가 없으면 안 남긴다 — 이유 없는 덮기가 곧 중복 정본이다.
       ㉠ h3 앞 코랄 대시 — 3단 제목의 «신호». Loom 은 h3 를 부품으로 안 본다(글자층).
       ㉡ 레일·차례·꼬리의 링크점 억제 — 메뉴 항목마다 코랄 점이 서면 신호 1점이 죽는다.
       ㉢ 레일 ol 은 부품 «순번»이 아니다 — 유리 원판이 서면 .n 의 01 과 두 번 세어진다. */
  h3::before{content:'';display:inline-block;width:14px;height:1px;vertical-align:middle;
    margin-right:.6em;background:rgba(var(--coral-rgb),.85);}
  .레일 a::before,.접이차례 a::before,footer a::before{content:none;}
  .레일 ol>li{padding-left:0;margin:0;min-height:0;counter-increment:none;}
  .레일 ol>li::before,.레일 ol>li::after{content:none;}

  /* 콜아웃 — 유리 판 + 왼쪽에 세운 빛 한 줄 */
  .알림{margin:22px 0;padding:20px 24px;font-size:.96rem;overflow:hidden;}
  .알림::after{content:'';position:absolute;left:0;top:14%;bottom:14%;width:2px;border-radius:2px;
    background:linear-gradient(180deg,rgba(var(--coral-rgb),0),rgba(var(--coral-rgb),.95),rgba(var(--coral-rgb),0));
    box-shadow:0 0 14px 1px rgba(var(--coral-rgb),.5);}
  .알림.조용::after{background:linear-gradient(180deg,rgba(var(--ash-rgb),0),rgba(var(--ash-rgb),.8),rgba(var(--ash-rgb),0));
    box-shadow:none;}

  /* 수치 타일 — 「12칸 중 3칸」처럼 숫자 하나가 문장을 대신하는 자리(.유리 와 함께 쓴다).
     ⚠.n 은 레일도 쓰는 이름이라 반드시 «.수치 안에서만» 잡는다 — 안 그러면 레일 번호가 커진다. */
  .수치들{display:flex;flex-wrap:wrap;gap:12px;margin:1.25em 0;}
  .수치{flex:1 1 190px;min-width:0;padding:15px 17px;}
  .수치 .n{font-size:1.3rem;font-weight:800;letter-spacing:-.032em;line-height:1.22;color:var(--chalk);}
  .수치 .l{margin-top:4px;font-size:.85rem;line-height:1.5;color:var(--ash);}

  /* 인용 = Loom 부품 «인용부호»가 진다(위임) — 여기서는 유리 판과 겹쳐 쓰므로 안여백만 준다. */
  blockquote.유리{padding:var(--단) calc(var(--단) + var(--숨));}

  /* ── 표 = 유리판 위의 실금 ───────────────────────────────────────────────── */
  .표틀{margin:1.5em 0;padding:6px;overflow-x:auto;}
  table{border-collapse:separate;border-spacing:0;width:100%;font-size:.93rem;}
  th,td{padding:.78em .9em;text-align:left;vertical-align:top;color:var(--chalk);}
  thead th{
    font-weight:800;letter-spacing:-.02em;font-size:.8rem;text-transform:none;color:var(--chalk);
    background:rgba(var(--chalk-rgb),.055);
  }
  thead th:first-child{border-radius:var(--깃속) 0 0 var(--깃속);}
  thead th:last-child{border-radius:0 var(--깃속) var(--깃속) 0;}
  tbody td{border-top:1px solid var(--금);}
  tbody tr:first-child td{border-top:0;}
  tbody tr:hover td{background:rgba(var(--chalk-rgb),.028);}

  /* ── 레일 = 유리 알약 메뉴 ───────────────────────────────────────────────── */
  .레일{display:none;}
  .레일 .꼭지{font-size:.66rem;font-weight:700;letter-spacing:.2em;color:var(--ash);
    text-transform:uppercase;margin:0 0 14px;padding-left:14px;}
  .레일 ol{list-style:none;margin:0;padding:0;display:grid;gap:2px;}
  .레일 a{
    display:flex;align-items:center;gap:.6em;position:relative;
    padding:.44em .8em .44em .78em;border-radius:11px;
    font-size:.845rem;line-height:1.35;color:var(--ash);box-shadow:none;
    transition:color 190ms ease,background 190ms ease;
  }
  .레일 a .n{font-size:.78em;opacity:.75;flex:none;width:1.5em;}
  .레일 a:hover{color:var(--chalk);background:rgba(var(--chalk-rgb),.05);}
  .레일 a.여기{
    color:var(--chalk);font-weight:700;
    background:linear-gradient(170deg,rgba(var(--chalk-rgb),.13),rgba(var(--chalk-rgb),.03)),var(--유리막);
    box-shadow:inset 0 1px 0 rgba(var(--chalk-rgb),.18),0 10px 20px -12px rgba(var(--그늘),.9);
  }
  .레일 a.여기::after{
    content:'';position:absolute;left:-9px;top:50%;transform:translateY(-50%);
    width:3px;height:16px;border-radius:3px;background:var(--coral);
    box-shadow:0 0 12px 1px rgba(var(--coral-rgb),.8);
  }

  .접이차례{margin:24px 0;font-size:.92rem;}
  .접이차례 summary{cursor:pointer;font-weight:800;letter-spacing:-.02em;color:var(--chalk);}
  .접이차례 a{margin-right:.15em;}

  @media (min-width:1060px){
    .판{grid-template-columns:214px minmax(0,1fr);}
    .레일{display:block;position:sticky;top:40px;align-self:start;padding:34px 0 0;}
    .접이차례{display:none;}
  }

  footer{margin:5em 0 0;padding:26px 0 0;color:var(--ash);font-size:.87rem;
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

  /* ── 낮 지면 — 인쇄·PDF ──────────────────────────────────────────────────
     v0.2 는 종이에도 검은 무대를 그대로 깔았다. 그게 왜 결함인지는 취향이 아니라 두 수치다:
       ① 크롬 인쇄의 「배경 그래픽」은 **기본이 꺼짐**이다 → 바탕만 흰 종이가 되고 글자는 Cream 그대로
          남는다. **Cream on 흰 종이 = 1.13:1** — 소개서 본문이 통째로 사라진다(Slate 3.06 · Paper 1.07).
       ② 체크가 켜져 있어도 실측 A4 한 장의 **89.7%가 진남색 면**이다(바탕 rgb(15,23,48)).
     낮 지면은 잉크가 어두워서 그 체크가 켜지든 꺼지든 읽힌다(Ink on 흰 종이 17.68:1).
     ⚠«다른 디자인»이 아니라 **같은 골격에 다른 빛**이다 — 판·레일·오브·번호·표 구조가 그대로다.
     색은 킷 직책의 허용 바닥을 탄다: Slate 는 다크 전용이라 종이에선 Slate 2,
     Coral 은 라이트에서 글자 금지라 강조 글자는 Coral 3. 짝 전량은 «--대비» 가 잰다.
     ⚠이 주석에 백틱을 쓰지 않는다 — 스킨 CSS 는 템플릿 리터럴 «안»이라 백틱 하나가 지면을 통째로 끊는다. */
  @media print{
    /* ⚠재질을 종이에서 «굳히는» 층(유리→판 · 레진→구슬 · 번호→찍힌 원판)은 Loom 낮 지면이 진다.
       여기 남는 것은 골격의 인쇄 변주뿐이다 — 판·레일·표지·표·수치·콜아웃·꼬리. */
    .판{display:block;padding:0;max-width:none;}
    .글{max-width:none;}
    .레일,.접이차례{display:none;}

    /* 🔴등장 애니메이션을 «반드시» 되돌린다 — html.js .듦{opacity:0} 이 인쇄에도 그대로 걸린다.
       실측: 로드 시점에 31개 중 29개가 opacity 0 이었다. 스크립트에 4초 안전판이 있지만
       그 전에 Ctrl+P 를 누르거나 헤드리스로 PDF 를 뽑으면 그 29개가 빈 채로 인쇄된다.
       안전판에 기대는 대신 인쇄에서는 숨김 자체를 없앤다(못 새게 만드는 쪽이 싸다). */
    html.js .듦,html.js .듦.왔다{opacity:1!important;transform:none!important;transition:none!important;}

    .유리.깊은{box-shadow:none;}

    /* 표지 오브 — 실굽기 렌더는 «검은 무대의 물건»이라 흰 종이에 안 옮긴다(비네트가 얼룩이 된다).
       종이는 평면 Chalk 명패(재질 흉내 0 — 정직한 플랫). 「배경 그래픽」이 꺼진 인쇄에선
       배경류가 전부 빠져 글자만 남는다 — 렌더 시절과 같은 동작이라 잃는 것 없음. */
    .오브{background-image:none;background-color:${색['Chalk']};border-radius:31px;}

    .표지{padding:0 0 22px;gap:16px;grid-template-columns:74px minmax(0,1fr);}
    .표지 h1{
      font-size:30pt;line-height:1.04;
      background:none;-webkit-background-clip:border-box;background-clip:border-box;
      color:var(--ink);-webkit-text-fill-color:var(--ink);   /* ⚠이 줄이 없으면 제목이 투명하게 인쇄된다 */
    }
    .표지 .한줄{color:var(--ink);font-size:12pt;max-width:46ch;}
    .표지 .꼭지,.표지 .메타{color:var(--ash2);}

    .표틀{overflow:visible;padding:0;}
    table{break-inside:auto;}
    thead th{background:var(--chalk3);color:var(--ink);}
    tbody td{border-top:1px solid var(--chalk3);}
    tbody tr:hover td{background:none;}

    .수치들{gap:8px;}
    .수치 .n{color:var(--ink);}
    .수치 .l{color:var(--ash2);}
    .알림::after{background:var(--coral3);box-shadow:none;}
    .알림.조용::after{background:var(--ash2);}
    footer{border-top:1px solid var(--chalk3);}
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

/* ── 원고 변환 — 옛 지면 → 「검은 무대」 원고 ─────────────────────────────────
   왜 도구인가: 엔진 소개서 6벌이 **같은 골격**(header/kicker/one/meta/toc/banner/wide/muted)이다.
   손으로 6번 고치면 6번 다르게 고쳐진다 — 다음에 문서가 하나 늘 때 또 갈라진다.
   ⚠이 변환기는 «모르는 것을 조용히 버리지 않는다» — 매핑 없는 클래스를 전부 이름째 돌려준다.
     빠뜨린 채 통과하는 것이 이 자리의 유일한 실패 모드다(새는 방향은 언제나 「통과」다). */
const 클래스지도 = {
  kicker: '꼭지', one: '한줄', meta: '메타', muted: '흐린', small: '작게',
  banner: '유리 알림 듦', wide: '유리 표틀 듦', toc: '접이차례',
};
const 동그라미 = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮';

function 원고(입력, 출력) {
  const 원본 = fs.readFileSync(입력, 'utf8');
  let s = 원본;
  const 흠 = [];
  const 잰것 = {};

  if (s.includes(표식)) 흠.push('이미 원고다(표식이 있다) — 두 번 변환하면 골격이 겹친다');
  if (!/<style>[\s\S]*?<\/style>/.test(s)) 흠.push('옛 <style> 이 없다 — 골격이 다른 문서라 손으로 본다');

  /* ① 차례(toc) 를 «먼저» 뜯는다 — 레일의 짧은 이름이 여기 있다. h2 제목은 길어서 레일에 못 쓴다. */
  const toc = s.match(/<nav class="toc">([\s\S]*?)<\/nav>/);
  const 차례 = toc ? [...toc[1].matchAll(/<a href="#(s\d+)">\s*([^<]+?)\s*<\/a>/g)]
    .map((m) => ({ id: m[1], 이름: m[2].replace(new RegExp(`^[${동그라미}]\\s*`), '').trim() })) : [];
  잰것.차례 = 차례.length;
  if (!차례.length) 흠.push('차례(nav.toc)를 못 찾았다 — 레일을 세울 재료가 없다');

  /* ② 표지 — 옛 <header> 의 네 조각을 그대로 옮긴다(글자는 한 자도 안 고친다). */
  const h = s.match(/<header>([\s\S]*?)<\/header>/);
  if (!h) 흠.push('<header> 가 없다');
  let 표지 = '';
  if (h) {
    const 안 = h[1];
    const 집기 = (re) => { const m = 안.match(re); return m ? m[1].trim() : ''; };
    const 꼭지 = 집기(/<div class="kicker">([\s\S]*?)<\/div>/);
    const 제목 = 집기(/<h1>([\s\S]*?)<\/h1>/);
    const 한줄 = 집기(/<p class="one">([\s\S]*?)<\/p>/);
    const 메타 = 집기(/<div class="meta">([\s\S]*?)<\/div>/);
    for (const [이름, 값] of [['kicker', 꼭지], ['h1', 제목], ['one', 한줄], ['meta', 메타]]) {
      if (!값) 흠.push(`표지 조각 «${이름}» 이 비었다`);
    }
    // 오브 글자 = 제목 첫 글자(태그를 벗긴 뒤). 실물 오브는 지면에 «하나»여야 한다.
    const 민제목 = 제목.replace(/<[^>]+>/g, '').trim();
    표지 = `<header class="표지">
  <div class="오브" aria-hidden="true">${민제목.slice(0, 1)}</div>
  <div>
    <p class="꼭지">${꼭지}</p>
    <h1>${제목}</h1>
    <p class="한줄">${한줄}</p>
    <p class="메타">${메타}</p>
  </div>
</header>`;
  }

  /* ③ 레일 — 차례에서 파생한다(같은 판정을 두 곳에 적으면 갈라진다). */
  const 레일이름 = (h ? (s.match(/<h1>([\s\S]*?)<\/h1>/) || [, ''])[1] : '').replace(/<[^>]+>/g, '').trim();
  const 레일 = `<nav class="레일" aria-label="차례">
  <p class="꼭지">${레일이름}</p>
  <ol>
${차례.map((c, i) => `    <li><a href="#${c.id}"><span class="n">${String(i + 1).padStart(2, '0')}</span> ${c.이름}</a></li>`).join('\n')}
  </ol>
</nav>`;

  /* ④ 몸통 — 옛 머리·스타일을 들어내고 클래스를 갈아 끼운다. */
  s = s.replace(/<style>[\s\S]*?<\/style>\s*/, 표식 + '\n\n');
  s = s.replace(/<header>[\s\S]*?<\/header>\s*/, `<div class="판">\n\n${레일}\n\n<div class="글">\n\n${표지}\n`);

  // 배너 — 첫 장은 신호(코랄 빛줄), 두 번째부터는 «조용»(회색). 둘 다 빛줄이면 신호가 신호가 아니다.
  let 배너 = 0;
  s = s.replace(/<div class="banner">/g, () => `<div class="유리 알림${배너++ ? ' 조용' : ''} 듦">`);
  잰것.배너 = 배너;

  // 차례 → 접이식(넓은 화면에서는 레일이 대신하므로 스킨이 감춘다)
  s = s.replace(/<nav class="toc">([\s\S]*?)<\/nav>/, (_, 안) =>
    `<details class="유리 잔잔 접이차례">\n  <summary>차례</summary>\n  <p style="margin:.7em 0 0">${안.replace(/^\s*<b>차례<\/b>\s*—\s*/, '').trim()}</p>\n</details>`);

  s = s.replace(/<div class="wide">/g, '<div class="유리 표틀 듦">');
  s = s.replace(/<blockquote>/g, '<blockquote class="유리 듦">');
  s = s.replace(/<div class="cards">/g, '<div class="수치들 듦">');
  s = s.replace(/<div class="card">/g, '<div class="유리 잔잔 수치">');
  s = s.replace(/class="small muted"/g, 'class="작게 흐린"');
  s = s.replace(/class="legend"/g, 'class="작게 흐린"');
  s = s.replace(/class="muted"/g, 'class="흐린"');
  s = s.replace(/class="small"/g, 'class="작게"');

  /* h2 — 절 번호를 «유리 원판»으로 세운다. 옛 제목의 동그라미 숫자는 지운다(두 번 세지 않는다). */
  let 절 = 0;
  s = s.replace(/<h2 id="(s\d+)">([\s\S]*?)<\/h2>/g, (_, id, 글) => {
    절++;
    const 민 = 글.replace(new RegExp(`^\\s*[${동그라미}]\\s*`), '').trim();
    return `<h2 id="${id}" class="듦"><span class="번호">${String(절).padStart(2, '0')}</span><span>${민}</span></h2>`;
  });
  잰것.절 = 절;
  if (절 !== 차례.length) 흠.push(`절 ${절}개 ≠ 차례 ${차례.length}개 — 레일이 없는 절이나 절이 없는 레일이 생긴다`);

  /* 등장 — 줄머리에서 시작하는 블록에만 건다. 이 문서들은 손으로 쓴 HTML 이라
     블록 요소가 0열에서 시작한다(들여쓴 것은 표지·표 안이라 건드리면 안 되는 자리다). */
  let 듦 = 0;
  s = s.replace(/^<(p|ul|ol|h3|details)(?=[ >])/gm, (m, t) => { 듦++; return `<${t} class="듦"`; });
  s = s.replace(/^<(p|ul|ol|h3|details) class="듦"([ >])/gm, (m, t, 끝) => `<${t} class="듦"${끝}`);
  // 이미 class 가 있던 것은 위 치환이 속성을 둘로 만든다 — 합친다.
  s = s.replace(/<(p|ul|ol|h3|details) class="듦" class="([^"]*)"/g, '<$1 class="듦 $2"');
  잰것.듦 = 듦;

  /* ⑤ 닫기 — footer 는 .글 안에 남고, 판·글을 </html> 앞에서 닫는다. */
  s = s.replace(/(\s*)<\/html>\s*$/, '\n\n</div><!-- /글 -->\n</div><!-- /판 -->\n</html>\n');

  /* ⑥ 남은 옛 클래스 — 조용히 버리지 않는다. */
  /* 자가검사 — 등장 클래스를 붙이는 자리는 «이미 class 가 있던 요소»를 잠깐 속성 둘로 만든다.
     합치는 치환이 하나라도 빗나가면 브라우저가 뒤 속성을 통째로 버려서 그 요소의 스타일이 사라진다
     — 그런데 화면은 «멀쩡한 문서»처럼 보인다(새는 방향은 언제나 통과다). 그래서 여기서 못박는다. */
  const 중복 = [...s.matchAll(/<[a-zA-Z][^>]*\sclass="[^"]*"[^>]*\sclass="/g)];
  if (중복.length) 흠.push(`class 속성이 둘인 요소 ${중복.length}개 — 뒤 속성이 조용히 버려진다`);

  // 스킨의 클래스는 전부 한글이다 — 그래서 «로마자로 남은 것»이 곧 못 옮긴 것이다.
  // 아는 예외는 레일의 숫자 칸(n) 하나뿐이고, 그 밖은 이름째 보고한다.
  const 아는것 = new Set(['n', 'l']);   // 수치 타일의 숫자·라벨 — 스킨이 «.수치 안에서만» 잡는다
  잰것.매핑못한클래스 = [...new Set([...s.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)))]
    .filter((c) => c && /^[A-Za-z][\w-]*$/.test(c) && !아는것.has(c));

  fs.mkdirSync(path.dirname(출력), { recursive: true });
  fs.writeFileSync(출력, s, 'utf8');
  return { 흠, 잰것, 바이트: Buffer.byteLength(s, 'utf8'), 원본바이트: Buffer.byteLength(원본, 'utf8') };
}

/* ══════════════════════════════════════════════════════════════════════════
   전량 — 「어느 지면들이 이 스킨을 입는가」를 **한 자리에** 적는다 (2026-08-16)

   왜 이게 없으면 전파가 안 되나 (실측):
     소개서 6벌을 굽는 명령이 **저장소 어디에도 없었다** — 이 파일 46행 주석의 예시 한 줄뿐이라
     사람이 6번 손으로 쳐야 했다. 그래서 토큰·스킨이 바뀌어도 지면에 «안 닿았다».
     철학 정본 「하지 않는 것 ㉡ — 사람 손을 늘리는 해법은 해법이 아니라 미룬 결함이다」의 자리다.
     ⚠목록을 여기 한 곳에만 둔다 — 두 곳에 적으면 갈라지고, 갈라지면 한쪽이 조용히 안 구워진다.

   대가 — 틀릴 때의 모습:
     · **산출물을 손으로 고쳐 두면 전량 굽기가 그것을 조용히 되돌린다**(실측 08-16: `Loom_소개서`
       한 벌이 원고보다 5,869자 앞서 있었다 — 원고 v1.0 / 산출 v1.2). exit 0 으로 지나간다.
       → 닫은 방식 = `--재현` 이 굽기 전에 «원고가 정본인가»를 6벌 전량 대조하고,
         (옛 회귀 `tests/펠트문서.test.js` 는 08-19 대청소 e75fc7fc 로 걷혔다 — 지금 상시 회귀 없음). 되돌리는 통로 = `--되메우기`.
   ══════════════════════════════════════════════════════════════════════════ */
const 지면방 = { 원고: 'docs/엔진/_원고', 산출: 'docs/엔진' };

/** 원고 ↔ 산출물 짝 전량. 원고방에 있는 것이 분모다(산출물 쪽은 지도·구판이 섞여 분모가 못 된다). */
function 지면짝들(방 = 지면방) {
  const 원고방 = path.join(루트, 방.원고);
  if (!fs.existsSync(원고방)) return [];
  return fs.readdirSync(원고방).filter((f) => f.endsWith('.html')).sort()
    .map((f) => ({ 이름: f, 원고: path.join(원고방, f), 산출: path.join(루트, 방.산출, f) }));
}

/** 몸통 = `</style>` 뒤. 스킨은 굽기마다 바뀌므로 «원고가 정본인가»는 몸통으로만 갈린다. */
const 몸통 = (s) => {
  const i = s.indexOf('</style>');
  return 표기접기(i < 0 ? s : s.slice(i + 8)).trim();
};

/**
 * 재현 대조 — 원고를 다시 구우면 «지금 그 자리에 있는 산출물»이 나오는가.
 * 🔑 이것이 「원고가 정본이다」의 유일한 증거다. 갈라진 지면은 재굽기가 손 수정을 삼킨다.
 * @param 임시방 굽기 결과를 버릴 디렉터리(비교만 하고 산출물은 안 건드린다)
 */
function 재현대조(임시방, 방 = 지면방) {
  fs.mkdirSync(임시방, { recursive: true });
  return 지면짝들(방).map((p) => {
    if (!fs.existsSync(p.산출)) return { ...p, 상태: '산출없음' };
    const 임시 = path.join(임시방, '재현_' + p.이름);
    try { 굽기(p.원고, 임시); } catch (e) { return { ...p, 상태: '굽기실패', 사유: e.message }; }
    const a = 몸통(fs.readFileSync(임시, 'utf8'));
    const b = 몸통(fs.readFileSync(p.산출, 'utf8'));
    return { ...p, 상태: a === b ? '재현' : '갈라짐', 원고자: a.length, 산출자: b.length };
  });
}

/**
 * 되메우기 — 산출물에서 원고를 복원한다(구운 스킨을 표식으로 되돌린다).
 * 산출물을 손으로 고쳐 버린 자리를 «원고가 정본»으로 되돌리는 유일한 통로.
 * ⚠원고를 덮어쓴다 — `--재현` 이 「갈라짐」이라 말한 지면에만 쓴다.
 *
 * 🔑 «굽기가 넣은 것»을 통째로 뜯는다 — `스킨()` 은 meta+style 이고 `스크립트()` 는 script 두 벌이다.
 *    개수를 숫자로 박지 않고 «style 뒤에 붙어 오는 script 를 연달아» 먹는다. 숫자를 박으면
 *    스크립트가 한 벌 늘어난 날 되메우기가 조용히 반쪽만 뜯고, 그 원고는 두 번 다시 안 맞는다.
 * ⚠**되메운 뒤 스스로 왕복을 잰다** — 반쪽만 뜯겨도 파일은 멀쩡해 보이기 때문이다(실측 08-16:
 *   첫 판이 script 두 벌을 남겨 원고에 실었는데 `--되메우기` 는 ✅ 를 찍고 끝났다).
 */
function 되메우기(산출, 원고) {
  const s = fs.readFileSync(산출, 'utf8');
  const 뜯기 = /(?:<meta name="theme-color"[^>]*>\s*)?<style>[\s\S]*?<\/style>(?:\s*<script[^>]*>[\s\S]*?<\/script>)*/;
  if (!뜯기.test(s)) throw new Error('구운 스킨을 못 찾았다 — 이 파일은 굽기 산출물이 아니다: ' + 산출);
  const 되돌린 = s.replace(뜯기, 표식);
  if (!되돌린.includes(표식)) throw new Error('표식이 안 들어갔다 — 되메우기 실패');

  /* 왕복 시험 — 되메운 원고를 다시 구우면 산출물의 «몸통»이 그대로 나와야 한다. */
  const 임시 = path.join(os.tmpdir(), 'synk-되메움-' + path.basename(산출));
  fs.writeFileSync(임시 + '.원고', 되돌린, 'utf8');
  굽기(임시 + '.원고', 임시);
  const 왕복 = 몸통(fs.readFileSync(임시, 'utf8'));
  const 원본몸통 = 몸통(s);
  if (왕복 !== 원본몸통) {
    throw new Error('왕복이 안 맞는다 — 되메운 원고를 다시 구우면 몸통이 달라진다('
      + 왕복.length + '자 vs ' + 원본몸통.length + '자). 원고를 쓰지 않았다: ' + 산출);
  }

  fs.mkdirSync(path.dirname(원고), { recursive: true });
  fs.writeFileSync(원고, 되돌린, 'utf8');
  return { 바이트: Buffer.byteLength(되돌린, 'utf8') };
}

/**
 * 전량 굽기 — 「Loom 을 입는 지면」 목록 전량.
 * ⚠**게이트가 함수 «안»에 있다.** CLI 분기에 두면 테스트가 못 닿고, 못 닿는 게이트는
 *   변이 검사에서 구멍으로 나온다(실측 08-16: 게이트를 꺼도 21건이 전부 초록이었다).
 * @throws 원고가 낡은 지면이 하나라도 있으면 **한 벌도 굽지 않고** 던진다 —
 *         갈라진 채로 구우면 산출물의 손 수정이 exit 0 으로 사라진다.
 */
function 전량({ 림 = '무채', 방 = 지면방, 임시방 } = {}) {
  const 갈 = 재현대조(임시방 || path.join(os.tmpdir(), 'synk-재현대조'), 방)
    .filter((r) => r.상태 === '갈라짐');
  if (갈.length) {
    const e = new Error('원고가 낡은 지면 ' + 갈.length + '벌 — 지금 구우면 산출물의 손 수정이 사라진다: '
      + 갈.map((r) => r.이름).join(', ') + '\n먼저 돌린다: node tools/펠트문서.js --재현');
    e.갈라짐 = 갈;
    throw e;
  }
  return 지면짝들(방).map((p) => {
    const r = 굽기(p.원고, p.산출, [], 림);
    return { ...p, 바이트: r.바이트, 흠: 검사(p.산출).흠 };
  });
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
  // 기본값 = 무채(유호 픽 3 집행 · 실측 근거는 파일 머리 ②). 스펙트럼은 남기되 명시해야 나온다.
  const 림 = 림들 >= 0 ? 인자[림들 + 1] : '무채';
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
    } else if (모드 === '--원고') {
      const [, 입력, 출력] = 남은;
      if (!입력 || !출력) throw new Error('용법: node tools/펠트문서.js --원고 <옛문서.html> <원고.html>');
      const r = 원고(입력, 출력);
      console.log('■ 원고 변환  %s → %s', path.relative(루트, 입력), path.relative(루트, 출력));
      console.log('   절 %d · 차례 %d · 배너 %d · 등장 %d  (%s → %sKB)',
        r.잰것.절, r.잰것.차례, r.잰것.배너, r.잰것.듦,
        (r.원본바이트 / 1024).toFixed(1), (r.바이트 / 1024).toFixed(1));
      if (r.잰것.매핑못한클래스.length) {
        console.log('   ⚠ 못 옮긴 옛 클래스 %d개 — 스킨에 그 자리가 없다(손으로 본다): %s',
          r.잰것.매핑못한클래스.length, r.잰것.매핑못한클래스.join(', '));
      } else console.log('   ✅ 못 옮긴 옛 클래스 0개');
      if (r.흠.length) { console.log('   🔴 흠 %d건:', r.흠.length); r.흠.forEach((h) => console.log('      · ' + h)); process.exit(1); }
    } else if (모드 === '--검사') {
      const c = 검사(남은[1]);
      console.log('■ %s  %sKB', 남은[1], (c.바이트 / 1024).toFixed(1));
      if (c.흠.length) { c.흠.forEach((h) => console.log('   🔴 ' + h)); process.exit(1); }
      console.log('   ✅ 자립형 (외부 = 폰트 %d개)', c.외부폰트);
    } else if (모드 === '--대비') {
      const 줄 = 대비판정();
      console.log('■ 지면 대비 — 유리는 «층 합성»으로, 펠트는 «결 p1/p99»로, 종이는 «평면»으로 잰다');
      console.log('   (브랜드렌더린트는 배경이 그라디언트·이미지면 판정을 포기한다 — 그 분모를 이 표가 진다)');
      let 실패 = 0;
      /* 지면을 갈라 찍는다 — 합계 하나로 뭉치면 「낮 지면은 아예 안 쟀다」와 「낮도 전부 통과」가
         같은 모양이 된다(0 은 분모와 함께 쓴다). */
      for (const 지면 of ['밤', '낮']) {
        const 몫 = 줄.filter((r) => (r.지면 || '밤') === 지면);
        console.log(`\n   ── ${지면} 지면 ${지면 === '밤' ? '(화면 · 검은 무대)' : '(인쇄·PDF · 종이)'} — ${몫.length}짝`);
        for (const r of 몫) {
          if (r.흠) { console.log('   🔴 ' + 채움(r.글자, 8) + ' on ' + 채움(r.면, 9) + '  ' + r.흠); 실패++; continue; }
          if (!r.통과) 실패++;
          console.log('   ' + (r.통과 ? '✅' : '🔴') + ' ' + 채움(r.글자, 8) + ' on ' + 채움(r.면, 9)
            + '  ' + 채움(r.최악.toFixed(2), 5) + ':1  (기준 ' + r.기준.toFixed(1) + ' · ' + 채움(r.방식, 9) + ')  ' + r.자리);
        }
      }
      /* 인쇄의 실패 모드를 «자» 안에 둔다 — 배경 그래픽 체크가 꺼지면 바탕만 흰 종이가 된다.
         이 줄이 없으면 낮 지면이 왜 있어야 하는지가 커밋 메시지에만 남고 기계엔 안 남는다. */
      const { 색: 색표 } = 정본읽기();
      console.log('\n   ── 배경 그래픽을 «끈» 인쇄 (크롬 인쇄 대화상자 기본값) — 바탕이 흰 종이가 된다');
      for (const [글, 지면] of [['Chalk', '밤'], ['Ink', '낮']]) {
        const c = 대비비(휘도(색표[글]), 1);
        const ok = c >= 4.5;
        console.log('   ' + (ok ? '✅' : '🔴') + ' ' + 채움(글, 8) + ' on 흰 종이  ' + 채움(c.toFixed(2), 5)
          + ':1  ' + (ok ? `— ${지면} 지면은 체크가 꺼져도 읽힌다` : `— ${지면} 지면은 이때 본문이 사라진다(그래서 인쇄는 낮 지면이 진다)`));
      }
      console.log('\n   합계 ' + 줄.length + '짝 = 통과 ' + (줄.length - 실패) + ' + 미달 ' + 실패
        + '  ·  안 잰 짝 0 — 스킨이 쓰는 글자×면 전량(밤 ' + 줄.filter((r) => !r.지면).length
        + ' + 낮 ' + 줄.filter((r) => r.지면 === '낮').length + ')');
      if (실패) process.exit(1);
    } else if (모드 === '--재현') {
      const 줄 = 재현대조(path.join(os.tmpdir(), 'synk-재현대조'));
      console.log('■ 원고가 정본인가 — 다시 구우면 지금 그 자리의 산출물이 나오는가 (%d벌)', 줄.length);
      for (const r of 줄) {
        if (r.상태 === '재현') console.log('   ✅ ' + r.이름);
        else if (r.상태 === '갈라짐') console.log('   🔴 ' + r.이름 + ' — 몸통 다름(원고 ' + r.원고자
          + '자 vs 산출 ' + r.산출자 + '자) · 재굽기가 산출물의 손 수정을 삼킨다');
        else console.log('   ❔ ' + r.이름 + ' — ' + r.상태 + (r.사유 ? ' · ' + r.사유 : ''));
      }
      const 갈 = 줄.filter((r) => r.상태 === '갈라짐');
      console.log('\n   합계 ' + 줄.length + '벌 = 재현 ' + 줄.filter((r) => r.상태 === '재현').length
        + ' + 갈라짐 ' + 갈.length + ' + 못 잼 ' + 줄.filter((r) => !['재현', '갈라짐'].includes(r.상태)).length);
      if (갈.length) {
        console.log('\n   → 산출물 쪽이 최신이면 원고를 되메운다(그 뒤 --전량 이 열린다):');
        갈.forEach((r) => console.log('     node tools/펠트문서.js --되메우기 ' +
          path.relative(루트, r.산출).split(path.sep).join('/') + ' ' +
          path.relative(루트, r.원고).split(path.sep).join('/')));
        process.exit(1);
      }
    } else if (모드 === '--되메우기') {
      const [, 산출, 원고출] = 남은;
      if (!산출 || !원고출) throw new Error('용법: node tools/펠트문서.js --되메우기 <산출물.html> <원고.html>');
      const r = 되메우기(path.join(루트, 산출), path.join(루트, 원고출));
      console.log('■ 되메움  %s → %s  (%sKB · 구운 스킨을 표식으로 되돌렸다)',
        산출, 원고출, (r.바이트 / 1024).toFixed(1));
    } else if (모드 === '--전량') {
      let 결과;
      try { 결과 = 전량({ 림 }); } catch (e) {
        if (!e.갈라짐) throw e;
        console.error('🔴 원고가 낡은 지면 %d벌 — 지금 구우면 산출물의 손 수정이 조용히 사라진다.', e.갈라짐.length);
        e.갈라짐.forEach((r) => console.error('   · ' + r.이름));
        console.error('   먼저 돌린다: node tools/펠트문서.js --재현   (되메우기 명령을 그대로 낸다)');
        /* 나가는 문 (F544) — 이 차단은 «방향»을 못 본다. 「원고와 산출물이 다르다」는 관측은
         * 산출물을 손으로 고친 **사고**와 원고를 고친 **정당한 작업**에서 똑같이 나온다.
         * 되메우기는 산출물→원고 방향이라, 원고를 방금 고친 세션이 위 처방만 따르면 자기 수정을 지운다.
         * 방향 자동 판정(git 시각·명시 플래그)은 F544 에 남겼고, 여기서는 나가는 문부터 연다 —
         * 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103). */
        console.error('   ⚠ 원고를 «방금 고친» 것이면 되메우기를 따르지 마라 — 그 수정이 사라진다(F544).');
        console.error('     그 경우의 통로: node tools/펠트문서.js --굽기 <원고 경로> <산출물 경로>  (갈라진 벌만 개별로)');
        process.exit(1);
      }
      console.log('■ 전량 굽기 %d벌 (림 %s) — 이 목록이 「Loom 을 입는 지면」의 정본이다', 결과.length, 림);
      let 실패 = 0;
      for (const p of 결과) {
        const ok = !p.흠.length;
        if (!ok) 실패++;
        console.log('   ' + (ok ? '✅' : '🔴') + ' ' + 채움(p.이름, 26)
          + (p.바이트 / 1024).toFixed(1) + 'KB' + (ok ? '' : '  ' + p.흠.join(' / ')));
      }
      console.log('\n   합계 ' + 결과.length + '벌 = 구움 ' + (결과.length - 실패) + ' + 흠 ' + 실패);
      if (실패) process.exit(1);
    } else if (모드 === '--스킨') {
      console.log(스킨(남은.slice(1), 림));
    } else {
      console.log('용법:\n  node tools/펠트문서.js --굽기 <입력.html> <출력.html> [천…] [--림 스펙트럼|무채]\n' +
        '  node tools/펠트문서.js --전량 [--림 …]      # 원고방 전량 (지면 목록의 정본)\n' +
        '  node tools/펠트문서.js --재현               # 원고가 정본인가 (전량 굽기의 게이트)\n' +
        '  node tools/펠트문서.js --되메우기 <산출물> <원고>\n' +
        '  node tools/펠트문서.js --검사 <문서.html>\n  node tools/펠트문서.js --대비\n' +
        '  node tools/펠트문서.js --스킨 [천…]');
      process.exit(2);
    }
  } catch (e) { console.error('🔴 ' + e.message); process.exit(1); }
}

module.exports = { 스킨, 굽기, 검사, 원고, 대비판정, 표식, 기본천, 림레시피, 클래스지도,
  지면짝들, 재현대조, 되메우기, 전량, 지면방, 몸통 };
