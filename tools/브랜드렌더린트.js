#!/usr/bin/env node
/* 브랜드렌더린트 — 브랜드 키트 준수를 **렌더된 픽셀 기준**으로 검사한다.
 *
 * 왜 따로 있나(= `tests/브랜드색.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 로 안 되는 이유):
 *   소스 검색은 「이 파일에 #FF6B5C 가 있다」까지만 안다. 그런데 정본이 금지하는 것은
 *   **「라이트 배경 위의 코랄 글자」** 처럼 **두 값의 관계**다. 배경은 조상에서 상속되고,
 *   글자색은 CSS 변수를 거쳐 오며, 최종 승자는 캐스케이드가 정한다 —
 *   즉 **렌더를 해봐야만 알 수 있다.**
 *   실측(2026-08-04~05): 소스 가드 3종이 전부 초록인 채로 라이브 접수 폼에
 *   대비 위반 162건·라이트 위 코랄 글자 60건이 살아 있었다.
 *
 * 무엇을 재나:
 *   ① 대비 — 조상을 거슬러 올라가 실제 배경을 찾고 WCAG 대비를 잰다.
 *   ② 키트 밖 색 — 렌더된 color/background-color 가 킷(디자인_토큰.json) 밖인가.
 *   ③ 키트 밖 서체 — 렌더에 **실제로 쓰인** 폰트가 정본 3종 밖인가.
 *   ④ 구역 밖 색(직책) — 킷 안이어도 **제 구역 밖**이면 위반이다(DESIGN.md 철칙 ④).
 *      ①~③ 은 「무엇을 썼나」를 보고, ④ 는 「어디에 썼나」를 본다 — 2026-08-07까지 ④ 가 없어서
 *      KC 색이 Part 6 밖에 있어도 초록이었다(= 직책 위반은 아무도 안 잡았다).
 *   ②④ 는 **의사요소(::before/::after)까지** 본다 — 요소 자신만 보던 시절엔 색을 ::before 로만
 *      칠한 페이지가 「키트 밖 색 0」으로 통과했다(2026-08-07 실측 · 크루카드의 점·띠가 그 형태).
 *
 * 실측에서 나온 함정 3개(다시 밟지 말 것):
 *   ⚠ `background-image`(그라디언트)를 만나면 **판정을 포기**한다. 평균색을 못 재는데
 *     억지로 재면 「흰 글자 대비 1.0」 같은 오탐이 76건 쏟아진다.
 *   ⚠ `font-family` 는 **쉼표로 갈라야** 한다. 첫 패밀리만 뽑으면 폴백이 안 보인다.
 *   ⚠ 한글 경로는 `file://` URL 에서 반드시 encodeURI 한다. 안 하면 조용히 빈 문서가 뜬다
 *     — 그리고 빈 문서의 위반은 **0건**이라 통과처럼 보인다(새는 방향은 언제나 통과다).
 *
 * ⚠ 이 린트는 **크롬에 기댄다.** 크롬이 없으면 검사하지 않고 **exit 2 + `SKIP`** 로 드러낸다.
 *   통과(0)와 미실행(2)이 같은 모양이면 안 된다 — CI 에서 조용히 안 도는 게 최악이다.
 *   탐지력 자체는 `tests/브랜드렌더린트.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 의 픽스처가 진다.
 *
 * 사용법:
 *   node tools/브랜드렌더린트.js crewcard/카드_kr.html
 *   node tools/브랜드렌더린트.js --json docs/개인정보처리방침_게시용.html
 * 종료 코드: 0=위반 없음 · 1=위반 있음 · 2=검사 불가(크롬 없음)
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ── 정본 값 ────────────────────────────────────────────────────────────────
 * 킷 색은 **여기 적지 않는다** — `docs/디자인_토큰.json` 에서 파생한다.
 * 2026-08-07 실증: 이 파일에 손으로 적힌 사본이 토큰과 이미 갈라져 있었다(`Lime 2` 가 킷에 없는데
 * 크루카드가 렌더 중이었다 · F143 — 파생으로 바꾸자 드러났고, 유호님 판정으로 킷에 편입됐다).
 * 「같은 판정을 두 곳에 적으면 갈라진다」의 그 자리라 사본을 없앤다. 서체 3종은 폰트 정본이 원천이라 아래 그대로. */
const KIT = Object.fromEntries(
  require(path.join(ROOT, 'docs', '디자인_토큰.json')).색.킷.map((c) => [c.hex.toUpperCase(), c.이름])
);

/* 킷 밖인데 **라이브가 실제로 그리고 있는** 색 — 제외가 아니라 ⏳미결이다.
 * 이유를 적지 않은 통과는 두지 않는다(등록층 조항). 킷 편입 여부는 유호님 확정 사안이라
 * 여기서 임의로 킷에 넣지 않고, 대신 「누가·어디서·왜」를 남겨 판정 전까지 빨간불이 되지 않게만 한다.
 * 2026-08-07: 첫 입주자였던 `Lime 2 #B8E836` 은 **유호님이 킷 편입으로 판정**해 비웠다(킷 22색).
 * 비어 있는 것이 정상 상태다 — 여기 무언가 있으면 그건 아직 안 끝난 판정이다. */
const 킷밖_유예 = {};
for (const [hex, v] of Object.entries(킷밖_유예)) KIT[hex] = `⏳${v.이름}(킷 밖·유예)`;

/* ── 마스코트 IP 색 ─────────────────────────────────────────────────────────
 * 유호님 확정 2026-08-13(B안): 체리 젤리는 **킷 색이 아니다** — 마스코트 고유색이다.
 * 그래서 KIT 에 합치지 않는다. 합치는 순간 앱 UI 어디에나 쓸 수 있는 색이 되고,
 * 그건 확정을 뒤집는 일이다(ΔE 9.1 이라 「코랄의 6번째 단」으로 흡수된다 — 토큰 `_왜_UI에_안_쓰나`).
 *
 * 그래서 이 색들의 통과 여부는 **파일 단위**로 갈린다:
 *   · `마스코트콘텐츠` 목록 안 → 통과(마스코트가 주인공인 자리다)
 *   · 그 밖(=앱 UI·대외 문서) → 「키트 밖 색」으로 그대로 잡힌다  ← 실행 규칙 ①이 여기서 강제된다
 * 값은 토큰 정본에서 파생한다(손으로 적은 사본이 갈라진 F143 을 반복하지 않는다).
 *
 * ── 2026-08-15: 램프가 **의상별로 둘**이 됐다 (유호님 확정 08-15 ① 상태 의상) ──
 * 🔴 **체리 퇴역 2026-08-19**(유호 확정 「이제 아예 안쓸거야」) — 08-15 의 «상태 의상» 2벌은
 *   끝났고 의상은 **코랄 펠트 하나**다. 그래서 두 상수의 뜻이 이렇게 갈린다:
 *   · MASCOT      = **빈 집합**   → ② IP 색 판정. 킷 «밖» 색이 0개가 됐다.
 *                                    코랄을 여기 넣지 않는 이유는 그대로다 — 평상복 코랄은 킷
 *                                    Coral 3 와 ΔE2000 2.7 이라 **이미 킷 색**이고, IP 색으로
 *                                    올리면 코랄 계열 면에서 킷 값 대신 「측정된 렌더 hex」가
 *                                    통과해 철칙 ④가 조용히 무뎌진다.
 *                                    ⇒ 비워 두는 것은 **허용을 안 넓힌다**는 뜻이라 «닫히는» 쪽이다.
 *   · MASCOT_바닥 = 평상복(코랄)  → ① 바닥 계산. 의상이 하나뿐이라 합집합이 곧 평상복이다.
 *                                    이 축은 비우면 안 된다 — 비우면 「마스코트가 이 바닥에서
 *                                    뜨는가」를 **아무것도 안 재고 통과**시킨다.
 * 📏 퇴역 전 실측(킷 23색 전수 · 임계 12): 막히는 면 체리만 6 → 합집합 6 = 새로 막히는 면 0.
 *    즉 체리를 빼도 ① 축의 판정은 그대로다(체리가 막던 면을 코랄도 막고 있었다). */
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
/* 마스코트 «그림»을 경로로 알아보는 목록은 이 파일에 적지 않는다 — 갈라진 사본이 조용히 눈을 감는다.
 * 브라우저로 넘길 코드라 정규식 객체가 아니라 «소스»를 받아 저쪽에서 짓는다(이스케이프가 안 갈린다). */
const { 패턴소스: 마스코트패턴소스 } = require('./lib/마스코트자산');
const 램프맵 = (단들) => Object.fromEntries((단들 || []).map((c) => [c.hex.toUpperCase(), c.이름]));
/* 🔑 `?.램프` 를 그대로 두지 않고 «없음»을 명시한다 — 옵셔널 체이닝이 조용히 undefined 를
 *   내면 「퇴역해서 비었다」와 「토큰이 깨져서 못 읽었다」가 같은 모양이 된다. */
const MASCOT = {};                                    // 체리 퇴역(08-19) — 킷 밖 IP 색 0개
const MASCOT_바닥 = 램프맵(토큰.색.마스코트?.평상복램프);
/* ── 마스코트를 올릴 수 있는 바닥 = **목록이 아니라 계산** ───────────────────
 * 처음엔 허용 바닥 넷(Paper·Cream 2·Coral Wash·Navy 2)을 목록으로 뒀는데,
 * 첫 실행에서 캐러셀의 Cream 바닥이 위반으로 잡혔다 — 재보니 Cream 23.5 로 «충분»했다.
 * 목록이 틀렸던 것이지 파일이 틀린 게 아니었다. 손 목록은 안 잰 색을 조용히 금지한다.
 * 그래서 판정을 계산으로 옮긴다: 킷에 색이 늘어도 목록을 고칠 일이 없다.
 *
 * 재는 값 = 마스코트 램프 중 **바닥에 가장 먼저 먹히는 단**과 바닥의 CIEDE2000 색차.
 * 임계 12 의 근거(실측): 막아야 하는 자리의 최댓값 9.1(Coral 2) 과
 * 통과해야 하는 자리의 최솟값 16.2(Coral Wash) 사이다. 그 사이에 Coral 면 10.1 하나가
 * 걸치는데, 신호 면 위에 캐릭터를 얹는 자리는 설계에 없어 막는 쪽에 둔다. */
const 마스코트바닥_임계 = 12;

/* 체리 램프가 통과하는 파일 — **이유 없는 통과는 두지 않는다**(등록층 조항과 같은 문법).
 * 🔴 **2026-08-20: 비었다. 그리고 지금은 아무 효과도 없는 장치다.**
 *   체리 퇴역(08-19)으로 위 `MASCOT` 이 빈 집합이라, 이 목록에 파일을 넣어도 KIT 에 더해질 램프가 0개다.
 *   목록 자체는 남긴다 — 마스코트 IP 색이 다시 생기면 그때 이 자리가 통로가 된다(구조는 살아 있다).
 *   ⚠ 걷어낸 세 항목은 전부 **파일이 이미 없었다**(실측 08-20 · 08-19 마스코트 정리에서 삭제·개명):
 *     · `캐러셀_괜찮아요_다섯뜻.html` → `캐러셀_괜찮아요_다섯뜻_룸무대.html` 로 개명
 *     · `영상도구_비교_0814.html` · `자개_캐러셀_예시_0814.html` → 삭제
 *   없는 파일을 예외로 들고 있으면 「예외를 관리하고 있다」는 얼굴로 아무것도 안 지킨다(F671 계열).
 * ⚠ 이 목록에 앱 화면을 넣는 것은 실행 규칙 ①을 무르는 일이다. 넣기 전에 유호님 확정을 받는다. */
const 마스코트콘텐츠 = {};
/* 정본 = docs/브랜드_폰트_정본.md §3 — 「모든 산출물은 이 3종만」.
 * 폴백 낱말(system-ui·sans-serif…)은 CDN 이 죽었을 때 레이아웃을 지키는 안전망이라
 * 금지 대상이 아니다(정본 §7). 실제로 **그려진** 폰트만 본다. */
/* 🔑 'SYNK Bracket' 은 «넷째 브랜드 폰트가 아니다» — 낫표 「 」 두 글자(U+300C/300D)만 잡는
 *   별칭 가족이고, 실제로 그리는 것은 OS 의 한국어 시스템 폰트다(Malgun Gothic 등 · 전부 GENERIC_OK).
 *   유호 확정 2026-08-31 「낫표 그거 킷에 박아줘」 · 값의 정본 = docs/디자인_토큰.json 「서체.낫표교정」.
 *   ⚠ 이 줄이 없으면 가드가 정본이 «시킨» 것을 위반으로 잡는다 — 바로 위 F094 가 지목한 재발 무늬다. */
const FONTS_OK = ['Inter Tight', 'SUIT Variable', 'SUIT', 'DM Mono', 'SYNK Bracket'];
/* ⚠ 이 목록은 **DESIGN.md §3 이 적어 둔 정본 스택에서 뽑는다.** 가드가 정본이 권장하는
 *   폴백을 위반으로 잡으면, 사람은 정본을 따랐는데 빨간불을 보게 되고 결국 가드를 끈다
 *   (F094 가 지목한 재발 원인이 정확히 「처방을 따를 수 없어 표기가 갈라진다」였다).
 *   정본 스택: 'SYNK Bracket','Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif
 *             'DM Mono',ui-monospace,SFMono-Regular,Consolas,monospace */
const GENERIC_OK = [
  'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif', 'serif',
  'monospace', 'ui-monospace', 'ui-sans-serif', 'ui-serif',
  'Segoe UI', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo',
  'Cascadia Mono', 'Consolas', 'SFMono-Regular', 'Menlo',
];

/* ── Part 06 K-Culture 예약 서체 — 정본 3종의 유일한 예외 (유호님 08-05 확정) ──
 * 정본 `docs/브랜드_폰트_정본.md` §4-1. K-Culture 면은 **일부러 다른 서체를 쓰는 특별면**이다.
 * 🔑 예외는 「이 폰트를 허용한다」가 아니라 **「이 구역 안에서만 허용한다」**다.
 *   폰트 이름만 화이트리스트에 얹으면 예외가 저장소 전체로 새고, 그러면 다음 감사가
 *   본문에 섞여 든 Fraunces 를 「등록된 서체」로 읽는다. 경계를 함께 적어야 예외가 예외로 남는다.
 * 2026-08-05 실사고: 이 예약이 카드 파일 **주석에만** 있어서, 정본을 따른 세션이 통째로 지웠다.
 *   주석은 가드가 아니다 — 그래서 여기(기계)와 정본(사람) 양쪽에 적는다. */
const KC_FONTS_OK = ['Fraunces', 'Gowun Batang', 'Cormorant'];
const KC_SCOPE = '.kc-page, .kc-card';

/* 색 전용 경계 — **서체 경계보다 넓다**(유호님 확정 2026-08-07 2차 「예전처럼 알록달록하게」).
 * 크루카드 표지 4칸 띠(`.cov-deliverables`)는 카드 전체를 예고하는 자리라 네 칸이 네 색을 쓴다
 * (01 Coral · 02 KC Cool · 03 Lime 2 · 04 KC Hot). 같은 날 오전의 「C안」(03 한 칸만 KC 핑크 ·
 * 경계 `.kc-preview`)은 이 지시로 폐기됐다 — 유호님 확정이 일반 조항보다 우선한다.
 * 🔴 **서체는 같이 넓히지 않는다** — 표지 띠에 Fraunces 까지 들어오면 그 칸이 Part 6 행세를 한다.
 *   상수를 둘로 나눈 이유가 그것이다. 하나로 뒀으면 다음 사람이 색을 넓히면서 서체를 조용히 같이 넓힌다
 *   (「경계를 함께 적어야 예외가 예외로 남는다」 — 위 서체 예약 주석과 같은 축). */
const KC_COLOR_SCOPE = KC_SCOPE + ', .cov-deliverables';

/* ── Part 06 K-Culture 예약 **색** — 서체와 같은 경계를 색에도 적용한다 ────────
 * 정본 `DESIGN.md` 철칙 ④: 「Lime·KC 4색은 전용 구역(앱 성장층·Part 6) 밖 반입 금지」.
 * 2026-08-07까지 이 린트는 **킷 멤버십만** 봐서, KC 색이 Part 6 밖에 있어도 초록이었다
 * — 즉 직책 위반은 아무도 안 잡고 있었다. 경계는 이미 위 KC_SCOPE 에 있으므로 새로 정의하지 않는다.
 * 목록은 토큰에서 파생한다(손 사본은 갈라진다 · F143).
 *
 * 🔴 **Lime 은 여기 넣지 않는다 — 일부러다.** Lime 의 전용 구역은 「앱 성장층」인데 그 경계를
 *   가리키는 CSS 선택자가 없다(크루카드는 앱 목업을 그리므로 Lime 이 정당한 자리가 실재한다).
 *   경계 없이 색만 금지하면 목업 전체가 오탐이 되고, 따를 수 없는 처방은 가드를 꺼지게 만든다(F094).
 *   구역을 먼저 정하는 것이 선행 조건이고, 그때까지 Lime 직책은 사람이 본다. */
const KC_COLORS = Object.fromEntries(
  require(path.join(ROOT, 'docs', '디자인_토큰.json')).색.킷
    .filter((c) => c.팔레트 === '05 K-Culture')
    .map((c) => [c.hex.toUpperCase(), c.이름])
);

/* 구역 밖인데 **라이브가 이미 그리고 있는** 자리 — `킷밖_유예` 와 같은 성격이다.
 * 고객 대면 화면을 내 판단으로 바꾸지 않고, 판정 전까지 빨간불이 되지 않게만 한다.
 * 키 = `파일:셀렉터` · 값 = 사유. **이유 없는 통과는 두지 않는다.** */
const 구역밖_유예 = {
  /* 2026-08-07 — 비었다. 표지 4칸 띠 4건이 유호님 「C안」 확정으로 **해소**됐다(유예 → 결정).
   * 처리 방향이 중요하다: 색을 화이트리스트에 얹어 통과시킨 게 아니라 **경계를 넓혔다**
   * (`KC_COLOR_SCOPE` 의 `.kc-preview`). 유예는 「판정 전까지 빨간불만 끈다」는 임시 장치이고,
   * 판정이 나면 여기서 빠져야 한다 — 안 빼면 결정이 임시 조치의 모습으로 남는다.
   * 장치 자체는 남긴다(다음 라이브 위반이 또 생긴다). 빈 채로 두는 것이 정상 상태다. */
};

/* ── 등록층 ────────────────────────────────────────────────────────────────
 * 「가드는 로직보다 등록층에서 샌다」의 그 층이다. 2026-08-04 감사에서 소스 가드 3종이
 * 전부 초록이었는데, 맞아서가 아니라 **이 파일들이 목록에 없었기 때문**이었다.
 * 목록은 여기 하나뿐이다 — `tests/브랜드렌더린트.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 가 이걸 import 해서 쓴다.
 * 두 곳에 적으면 갈라지고, 갈라지는 방향은 언제나 「통과」다. */
const 대상 = [
  'crewcard/카드_kr.html',                    // 라이브 접수 폼(doGet 서빙) — 고객 대면
  'crewcard/카드_mn.html',
  'docs/크루카드/크루카드_한국어.html',        // 위 두 파일의 docs 사본(크루카드사본.js 가 동일성 강제)
  'docs/크루카드/크루카드_몽골어.html',
  'docs/개인정보처리방침_게시용.html',         // 법적 대외 게시물
  'docs/컴퓨터를 잃어버렸을 때.html',          // 비상 복구 절차서 — 유호님이 급할 때 여는 화면이다.
                                              // 대외물은 아니지만 그때 못 읽으면 절차가 없는 것과 같다(2026-08-10 등재).
  'docs/엔진/SYNK_Core_소개서.html',           // 엔진 갈래 소개서 정본 — 유호님 상시 열람(운영자료 바로가기 대상)
  'docs/엔진/SYNK_Loom_소개서.html',           //   + 홈페이지 재료의 뿌리라 장수 문서다. 첫 등재 시 4벌 전부 0건 실측(2026-08-15).
  'docs/엔진/SYNK_Vellum_소개서.html',
  'docs/엔진/SYNK_엔진_지도.html',
  'docs/엔진/SYNK_Trail_소개서.html',          // 자산층(쌓는 셋) 소개서 3벌 — 지도 v2.0 편입(2026-08-15 · 유호 확정).
  'docs/엔진/SYNK_Prism_소개서.html',          //   같은 갈래 = 같은 등록 — 4벌만 남기면 새 3벌은 CI 가 영원히 안 본다.
  'docs/엔진/SYNK_Temper_소개서.html',         //   ⚠이 칸은 **세 번** 갈렸다 — v2.1 이름 확정(처방→Pilot 08-15) → v2.3 개명(Pilot→Temper 08-17)
  'docs/엔진/SYNK_Reed_소개서.html',           // 무대층(셋째 줄) 소개서 — 지도 v2.5 편입(08-26 유호 확정) · 소개서 등재 09-01.
                                              //   → 08-18 회사명 결합(파일명 6벌 전부 `SYNK_` 접두 · 유호 지시).
                                              //   개명하면서 이 목록을 안 고치면 등록층이 없는 파일을 가리켜 조용히 0벌을 잰다.
                                              //   두 번 갈린 칸은 세 번째도 갈린다 — 파일명이 바뀌는 커밋에서 여기부터 연다.
                                              // ⚠위 6벌은 2026-08-15 부터 지면 스킨 「검은 무대」를 입는다. 이 린트는 배경이
                                              //   그라디언트·이미지면 «판정을 포기»하므로 그 문서들에서 대비 분모가 거의 0이 된다
                                              //   (실측: SYNK_Core 342개 중 341개 포기). **그 분모는 여기가 안 진다** —
                                              //   `node tools/펠트문서.js --대비` 가 밤 9짝 + 낮 7짝으로 진다. 둘을 한 벌로 읽는다.
];

/* 제외 — **이유를 적지 않은 제외는 두지 않는다.** 이유 없는 제외가 곧 등록층의 구멍이다.
 * 각 항목의 수치는 2026-08-05 실측값이다(제외가 「깨끗해서」가 아님을 남긴다). */
const 제외 = [
  ['docs/크루카드/자형확인_몽골키릴.html',
    '자형 비교 하네스 — 여러 서체를 나란히 그리는 것이 이 파일의 목적이고 __SynkNoSuchFont__ 더미까지 있다. 대외물 아님. (실측 7/40/2)'],
  /* [v9.199] 구판 참고용 2 · 등록서 렌더 1 은 **저장소에서 아카이브로 나갔다**(`7f32cfd7` 압축 지도 ㉢ ·
   * 유호 전부○ 판정). 없는 파일을 계속 제외로 들고 있으면 「제외했는데 파일이 없다」로 master 가
   * 빨개져 **모든 세션의 배포 게이트**가 막힌다 — 실제로 막혀서 걷었다. 파일이 돌아오면 항목도
   * 함께 돌아온다(제외의 근거는 파일이지 이 목록이 아니다). */
  ['docs/정본/SYNK LAB/자료/_src_오프라인_신규_등록서.html',
    '⏳제외가 아니라 **인계**다 — 흰 면 35곳이 살아 있다. _src_→빌드 통로는 발표물 빌드 트랙(세션 5d53cc35)이 들고 있어 손대면 충돌한다.'],
  /* 2026-08-13 — 마스코트 바닥 검사를 세우며 등록을 시도했다가 **재는 층이 틀린 것**을 확인하고 물렸다.
   * 이 파일은 카드 7장을 나란히 보는 «미리보기 시트»이고, 발행물은 카드 한 장(1080px 정사각)이다.
   * 카드가 `container-type:inline-size` 라 미리보기에서는 579px 로 렌더되고, 그러면 `3.3cqw` 글자가
   * 7.2px 로 잡혀 대비 기준이 4.5(본문)로 붙는다 — 발행 크기에서는 35.6px 라 기준 3.0 이고 통과한다.
   * 즉 **거짓 적색 7건**이다. 등록하면 주인 없는 적색이 남의 배포를 막는다.
   * 🔑 마스코트 바닥·체리 색 검사는 이 파일에서도 이미 **손으로 돌면 문다**(실측: 마스코트 7장 전부 통과).
   *    막힌 것은 자동 등록뿐이고, 풀 조건은 「컨테이너 쿼리 산출물을 발행 폭으로 재는 통로」다. */
  ['docs/캐릭터/캐러셀_괜찮아요_다섯뜻_룸무대.html',
    '⏳미리보기 시트라 카드가 발행 폭(1080px)이 아닌 579px 로 렌더된다 — 대비 7건이 거짓 적색이다(실측 08-13). 발행 폭으로 재는 통로가 서면 등록한다. (2026-08-20: 구 이름 `캐러셀_괜찮아요_다섯뜻.html` 은 없어졌고 이 파일로 개명됐다 — 제외의 근거는 파일이지 이 목록이 아니다.)'],
  ['bots/오버레이/마스코트.html',
    'OBS 투명 오버레이 — 발행 화면은 마스코트 PNG 뿐이고 글자 표면은 검수용 데모·무대 모드에만 있다(투명 페이지를 재면 거짓 적색). P3 방송 합성판이 서면 그 판을 등재한다(2026-08-14).'],
  /* 2026-08-15 — 마스코트 색 A/B 보드. **손으로 돌려서 실측하고** 제외했다(추측 아님):
   *   대비 위반 0 · 킷 밖 서체 0 · 직책 위반 0 · 텍스트 요소 183 —
   *   유일한 적색은 **킷 밖 색 4건**이고 그 넷이 `#C55143`(기존 펠트 코어)·`#C74A3A`(기각된 V9 레드)
   *   ·`#E55D50`(재염색 코어)·`#E35A4D`(네이티브 코어)다. 즉 **잰 결과를 칩으로 띄운 것**이라
   *   이 지면에서는 킷 밖인 게 정상이다(측정 대상이지 UI 색이 아니다).
   * ⚠처음엔 제외 사유를 「신호 1점 위반」으로 적었는데 **린트는 그 축을 재지 않는다** — 손으로
   *   돌려보고 고쳤다. 틀린 사유는 없는 사유보다 나쁘다(다음 사람이 검증을 못 한다).
   * 🔑 골격 자체는 킷을 지킨다 — 바탕 Navy 2 · 잉크 Cream · 통과/미달을 두 색으로 가르지 않고
   *    미달만 Coral 이 짚는다(통과는 웨이트). */
  /* ⚰ 09-05 저녁 삭제 — 아래 한 줄은 그 지면이 왜 제외였는지의 기록이고, 지면 자체는 없다.
     다음 사람이 이 목록을 「지금 도는 지면」으로 읽지 않게 여기서 걷는다. */
  ['⚰docs/펠트코랄_0815.html(09-05 삭제)',
    '마스코트 색 A/B 보드 — 적색은 「킷 밖 색 4건」 하나뿐이고 그 넷이 측정된 코어색 칩(#C55143·#C74A3A·#E55D50·#E35A4D)이다. 잰 값을 보여주는 게 이 지면의 내용이라 등록하면 영구 거짓 적색이 된다(실측 08-15: 대비 0·서체 0·직책 0). 색 확정 후 단일 시안 페이지가 서면 그것을 등재한다.'],
];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function findChrome() {
  return CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

/* ── 페이지 안에서 도는 측정기 ───────────────────────────────────────────────
 * 문자열로 주입한다. 여기 안에서는 저장소의 어떤 것도 참조할 수 없다. */
/* `freeze:false` 는 **회귀 전용 탈출구**다 — 시간정지를 끄면 픽스처가 실제로 물리는지 재려고
 * 둔다. 인자로 받는 이유: 페이지가 읽는 플래그(window.__…)로 두면 검사 대상 파일이 그 값을
 * 켜서 가드를 통째로 우회할 수 있다. 호출자만 줄 수 있어야 탈출구가 구멍이 되지 않는다. */
function 측정기소스(kitHexes, fontsOk, genericOk, kcFontsOk, kcScope, freeze, kcColors, kcColorScope) {
  return `(() => {
  const KIT = new Set(${JSON.stringify(kitHexes)});
  const FONTS_OK = new Set(${JSON.stringify(fontsOk)});
  const GENERIC_OK = new Set(${JSON.stringify(genericOk)});
  const KC_FONTS_OK = new Set(${JSON.stringify(kcFontsOk)});
  const KC_COLORS = new Set(${JSON.stringify(Object.keys(kcColors || {}))});
  const KC_SCOPE = ${JSON.stringify(kcScope)};
  // 색 경계는 서체 경계보다 한 칸 넓다(예고 1칸) — 둘을 **따로** 들고 있어야 안 섞인다.
  const KC_COLOR_SCOPE = ${JSON.stringify(kcColorScope || kcScope)};
  // 예약 서체는 **그 구역 안에서만** 통과한다. 밖에서 같은 폰트가 나오면 그대로 위반이다.
  const KC구역 = (el) => el.closest(KC_SCOPE) !== null;

  /* ⚠ 시간축을 멈추고 잰다 — **전환 중간 프레임은 저자가 지정한 색이 아니다.**
   * 2026-08-05 CI 실측: \`.m-card-lbl .dot\` 의 \`transition:background .3s\` 가
   * Cream(rgba) → Lime 으로 넘어가는 **중간값 #D3FC65** 가 「키트 밖 색」으로 잡혔다.
   * 같은 커밋이 로컬에선 통과하고 CI 에선 실패하는 플래키였고(러너가 느려 전환 중에 재였다),
   * 원인 파일은 멀쩡한데 가드만 빨간 전형적인 형태다 — **재는 층이 값을 깨뜨리면 안 된다.**
   * transition:none 을 얹으면 진행 중이던 전환이 최종값으로 즉시 스냅하고,
   * animation:none 은 프레임을 기본 상태로 되돌린다. 둘 다 「정적 지정값」에 맞추는 방향이다. */
  const 시간정지 = document.createElement('style');
  시간정지.textContent = '*,*::before,*::after{transition:none !important;animation:none !important}';
  if (${freeze !== false}) {
    document.head.appendChild(시간정지);
    /* ⚠ CSS 두 줄로는 **element.animate() (WAAPI)** 가 안 멈춘다 — animation:none 은 CSS 애니메이션만 지운다.
     * 실측 2026-08-06: WAAPI 로 배경을 red→green 시킨 요소가 시간정지를 켠 채 중간값 #808000 으로 잡혔다.
     * getAnimations() 는 전환·CSS 애니메이션·WAAPI 를 한 목록으로 주므로 여기서 **원인 종류 전체**를 끈다.
     * 🔑 정직하게 적어 둔다 — 변이 실측에서 **위 CSS 두 줄을 지워도 픽스처는 전부 초록이었다**(이 취소가
     *   혼자 다 덮는다). 두 줄을 남기는 이유는 하나뿐이다: getAnimations 가 없는 옛 크롬에서 폴백이
     *   된다. 그러니 이 CSS 를 「검증된 방어」로 읽지 말 것 — 오늘 이것을 지지하는 픽스처는 없다.
     *   (⚠ 이 주석은 템플릿 문자열 **안**이다 — 백틱을 쓰면 측정기 소스가 그 자리에서 끊긴다.) */
    for (const a of (document.getAnimations ? document.getAnimations() : [])) {
      try { a.cancel(); } catch (e) { /* 이미 끝난 것 */ }
    }
  }
  void document.body.offsetHeight; // 강제 리플로우 — 스냅을 확정시킨 뒤에 잰다

  const hex = (rgb) => {
    const m = String(rgb).match(/-?[\\d.]+/g);
    if (!m || m.length < 3) return null;
    if (m.length > 3 && Number(m[3]) === 0) return 'TRANSPARENT';
    return '#' + m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const lum = (h) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  /* ⚠ 배경은 **알파를 합성해야** 실제 색이 된다. hex() 는 알파 0 만 투명으로 보고 나머지는
   *   불투명 원색으로 돌려주는데, 그러면 rgba(255,107,92,.12) 가 코랄 원색으로 잡힌다.
   *   실측 2026-08-06: 시스템 대장 내부판의 legend(코랄 12% on 네이비)가 「대비 2.07」 오탐
   *   2건으로 나왔다 — 눈으로 보면 크림 글자가 어두운 판 위에 또렷하다.
   *   오탐은 사람이 가드를 끄게 만들고, 반대 방향(밝은 반투명이 글자를 지우는 경우)은
   *   조용히 통과시킨다. 그래서 두 방향 다 여기서 합성으로 막는다. */
  const rgba = (v) => {
    const m = String(v).match(/-?[\\d.]+/g);
    if (!m || m.length < 3) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? Number(m[3]) : 1 };
  };
  const over = (t, b) => {                       // t(자식) 를 b(조상) 위에 얹는다 — source-over
    const a = t.a + b.a * (1 - t.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const ch = (k) => (t[k] * t.a + b[k] * b.a * (1 - t.a)) / a;
    return { r: ch('r'), g: ch('g'), b: ch('b'), a };
  };
  const 표기 = (c) => '#' + ['r', 'g', 'b']
    .map((k) => Math.round(c[k]).toString(16).padStart(2, '0')).join('').toUpperCase();

  // 조상을 거슬러 실제 배경을 찾는다. 그라디언트를 만나면 **판정 포기**(오탐 방지).
  const 배경찾기 = (el) => {
    let 쌓임 = { r: 0, g: 0, b: 0, a: 0 };
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { hex: null, why: 'gradient' };
      const c = rgba(cs.backgroundColor);
      if (c && c.a > 0) 쌓임 = over(쌓임, c);
      if (쌓임.a >= 0.999) return { hex: 표기(쌓임), why: null };     // 불투명해졌다 = 여기서 끝
    }
    // 조상을 다 올라가도 안 채워졌다 = 캔버스(흰색)가 마지막 층이다
    return { hex: 표기(over(쌓임, { r: 255, g: 255, b: 255, a: 1 })), why: 쌓임.a > 0 ? null : 'root' };
  };

  const 셀렉터 = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };

  const 대비위반 = [], 키트밖색 = [], 키트밖서체 = [], 구역밖색 = [], 마스코트바닥 = [];
  /* 직책 검사 — 킷 안이라도 **제 구역 밖이면** 위반이다(DESIGN.md 철칙 ④).
   * 의사요소는 제 소유 요소의 구역을 그대로 쓴다(::before 는 el 안에 그려진다). */
  const 구역검사 = (el, hexv, 자리, 접미 = '') => {
    if (!KC_COLORS.has(hexv) || el.closest(KC_COLOR_SCOPE)) return;
    구역밖색.push({ sel: 셀렉터(el) + 접미, hex: hexv, 자리, 숨김: !el.getClientRects().length });
  };
  const 색집계 = new Map(), 서체집계 = new Map();
  let 잰것 = 0, 그라디언트건너뜀 = 0;

  // ⚠ 종이·화면에 **안 그려지는** 요소는 세지 않는다. <style>·<script>·<title> 은
  //   텍스트 노드를 가지므로 「직접 텍스트」 필터를 그냥 통과하는데, 거기 잡힌 색·서체는
  //   파일이 선언한 게 아니라 **브라우저 기본값**이다. 실측(첫 실행): 그 넷이
  //   Noto Sans KR 4건·순검정 4건으로 잡혀 「키트 밖」 목록을 오염시켰다 —
  //   가드가 자기 전처리에 눈이 멀면 없는 위반을 만들어내고, 사람은 그걸 고치려 든다.
  const 안그려짐 = new Set(['STYLE', 'SCRIPT', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK']);

  // 순수 장식(aria-hidden)은 **대비 판정에서만** 뺀다 — WCAG 1.4.3 이 명시로 면제하는 자리다.
  // ⚠ 이걸 「위반 지우개」로 쓰면 안 된다. aria-hidden 은 스크린리더가 그 내용을 통째로
  //   안 읽는다는 뜻이라, 정보를 담은 요소에 붙이면 접근성을 **더** 망가뜨린다 —
  //   즉 대가가 실재해서 스스로 남용을 막는다. 색·서체 검사는 그대로 적용한다(장식도 키트 안이어야 한다).
  const 장식 = (el) => el.closest('[aria-hidden="true"]') !== null;

  // ── 면 검사는 **텍스트와 무관하게** 전 요소를 돈다 ──────────────────────────
  // 철칙 ①(순백·순검정 금지)은 글자만의 규칙이 아니다. 처음엔 이 검사를 아래 글자 루프
  // 안에 뒀는데, 그러면 **직접 텍스트를 가진 요소만** 보게 된다 —
  // 실측: 그 상태로 카드가 「흰 면 22곳」만 냈고, 정작 소스엔 background:#fff 패널이
  // 6규칙 더 있었다(자식에게 텍스트를 넘긴 컨테이너라 루프에 안 걸렸다).
  // 가드가 「22곳」이라고 말하면 사람은 그게 전부인 줄 안다 — 부분 집계가 완전 집계처럼 보이는 게
  // 이 부류의 진짜 위험이다.
  /* ⚠ **의사요소(::before / ::after)도 재야 한다.** getComputedStyle(el) 은 요소 자신만 본다 —
   *   2026-08-07 실측: 색이 오직 ::before{background:#FF00FF} 로만 그려진 페이지에서 이 린트가
   *   「✅ 키트 밖 색 0」을 냈다. 새는 방향은 언제나 통과다.
   *   크루카드의 점·띠(.del:nth-child(n)::before · .kicker::before)가 정확히 이 형태라
   *   **라이브의 그 색들은 여태 한 번도 검사되지 않았다.**
   *   content:none 이면 안 그려지므로 건너뛴다(안 그러면 전 요소가 유령 2개씩 낸다).
   *   ⚠ 이 구역은 통째로 템플릿 리터럴 안이다 — 주석에 백틱을 쓰면 문자열이 끊긴다(08-07 실족). */
  const 의사 = ['::before', '::after'];
  const 그려지는의사 = (cs) => cs.content && cs.content !== 'none' && cs.content !== 'normal';

  for (const el of document.querySelectorAll('*')) {
    if (안그려짐.has(el.tagName)) continue;
    const bgc = hex(getComputedStyle(el).backgroundColor);
    if (bgc && bgc !== 'TRANSPARENT' && !KIT.has(bgc)) {
      키트밖색.push({ sel: 셀렉터(el), hex: bgc, 자리: '면', 숨김: !el.getClientRects().length });
    }
    if (bgc && bgc !== 'TRANSPARENT') 구역검사(el, bgc, '면');
    for (const p of 의사) {
      const pcs = getComputedStyle(el, p);
      if (!그려지는의사(pcs)) continue;
      const pbg = hex(pcs.backgroundColor);
      if (pbg && pbg !== 'TRANSPARENT' && !KIT.has(pbg)) {
        키트밖색.push({ sel: 셀렉터(el) + p, hex: pbg, 자리: '면', 숨김: !el.getClientRects().length });
      }
      if (pbg && pbg !== 'TRANSPARENT') 구역검사(el, pbg, '면', p);
      // 글자색은 **의사요소가 실제로 글자를 그릴 때만** 본다(빈 content 면 색이 보이지 않는다).
      const 글있음 = /^["'].*[^"']["']$/.test(pcs.content.trim()) && pcs.content.trim().length > 2;
      const pfg = hex(pcs.color);
      if (글있음 && pfg && pfg !== 'TRANSPARENT' && !KIT.has(pfg)) {
        키트밖색.push({ sel: 셀렉터(el) + p, hex: pfg, 자리: '글자', 숨김: !el.getClientRects().length });
      }
      if (글있음 && pfg && pfg !== 'TRANSPARENT') 구역검사(el, pfg, '글자', p);
    }
  }

  /* ── 마스코트가 어느 바닥 위에 있는가 (수집만) ─────────────────────────────
   * 유호님 확정 08-13 실행 규칙 ②. **판정은 여기서 안 한다** — 바닥 hex 만 모아 올리고
   * 색차 계산은 도구(Node) 쪽이 한다. 처음엔 허용 목록을 여기 박았는데, 손 목록이
   * 안 잰 색(Cream 23.5)을 조용히 금지했다. 계산으로 옮기면 그 실패 형태가 사라진다.
   *
   * ⚠ **못 잡는 자리를 정직하게 적어 둔다**: 마스코트를 data URI 로 인라인하고
   *   data-synk-mascot 도 안 달면 이 검사는 그 그림을 못 본다. 경로가 사라지면 식별자가 없다.
   *   그래서 인라인하는 산출물은 그 속성을 달아야 하고, 그 규약을 DESIGN.md 가 적는다.
   *   조용히 통과시키느니 한계를 적는 쪽이 낫다 — 안 적으면 「0건」이 「깨끗함」으로 읽힌다. */
  const 마스코트다 = (el) =>
    el.hasAttribute('data-synk-mascot') ||
    new RegExp(${JSON.stringify(마스코트패턴소스)}).test(el.getAttribute('src') || '');

  /* 🔴 «img 만» 돌고 있었다 (2026-09-02 실측). 위 머리말은 「인라인하면 data-synk-mascot 을 달아라」로
   *   한계를 정직하게 적어 뒀는데, **속성을 달아도 img 가 아니면 못 봤다** — 크루카드가 몽글을
   *   i 태그 + background-image 로 세우자 그 세 장이 통째로 안 세어졌고, 출력은 그대로 초록이었다
   *   (분모 0 = 「해당 없음」인데 「깨끗함」으로 읽힌다).
   *   ⇒ 속성이 달린 것은 태그를 안 가린다. img 는 경로로도 잡히므로 둘을 합집합으로 돈다.
   *   ⚠ 이 구간은 브라우저에 «문자열로» 주입된다 — 주석에 백틱을 쓰면 템플릿 리터럴이 깨진다. */
  let 마스코트잰것 = 0;
  for (const el of document.querySelectorAll('img, [data-synk-mascot]')) {
    if (!마스코트다(el)) continue;
    마스코트잰것++;                       // ⚠ 분모다 — 0 장이면 「깨끗함」이 아니라 「해당 없음」이다
    const bg = 배경찾기(el);
    if (!bg.hex) { 그라디언트건너뜀++; continue; }
    마스코트바닥.push({
      sel: 셀렉터(el), bg: bg.hex, src: (el.getAttribute('src') || '').slice(-40),
      숨김: !el.getClientRects().length,
    });
  }

  for (const el of document.querySelectorAll('*')) {
    if (안그려짐.has(el.tagName)) continue;
    // 직접 자식으로 텍스트를 가진 요소만 — 안 그러면 래퍼가 상속색으로 중복 계산된다.
    const 직접텍스트 = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!직접텍스트) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;

    const fg = hex(cs.color);
    if (!fg || fg === 'TRANSPARENT') continue;
    잰것++;
    const size = parseFloat(cs.fontSize) || 0;
    const weight = Number(cs.fontWeight) || 400;
    const 숨김 = cs.display === 'none' || !el.getClientRects().length;

    // ① 색이 키트 안인가
    색집계.set(fg, (색집계.get(fg) || 0) + 1);
    if (!KIT.has(fg)) 키트밖색.push({ sel: 셀렉터(el), hex: fg, size, 숨김, 글: 직접텍스트.slice(0, 28) });
    구역검사(el, fg, '글자');

    // ② 서체 — 쉼표로 갈라야 폴백이 보인다
    for (const raw of cs.fontFamily.split(',')) {
      const f = raw.trim().replace(/^["']|["']$/g, '');
      if (!f) continue;
      서체집계.set(f, (서체집계.get(f) || 0) + 1);
      if (!FONTS_OK.has(f) && !GENERIC_OK.has(f) && !(KC_FONTS_OK.has(f) && KC구역(el))) {
        키트밖서체.push({ sel: 셀렉터(el), font: f, 숨김, 글: 직접텍스트.slice(0, 28) });
      }
    }

    // ③ 대비 — 장식은 면제(위 주석)
    if (장식(el)) continue;
    const bg = 배경찾기(el);

    if (!bg.hex) { 그라디언트건너뜀++; continue; }
    const r = ratio(fg, bg.hex);
    const 대형 = size >= 24 || (size >= 18.66 && weight >= 700);
    const 기준 = 대형 ? 3 : 4.5;
    if (r < 기준) {
      대비위반.push({
        sel: 셀렉터(el), fg, bg: bg.hex, 대비: Math.round(r * 100) / 100,
        기준, size, weight, 숨김, 글: 직접텍스트.slice(0, 28),
      });
    }
  }

  const 상위 = (m) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  return {
    잰것, 그라디언트건너뜀,
    대비위반, 키트밖색, 키트밖서체, 구역밖색, 마스코트바닥, 마스코트잰것,
    색분포: 상위(색집계), 서체분포: 상위(서체집계),
  };
})()`;
}

/* ── CIEDE2000 ──────────────────────────────────────────────────────────────
 * 마스코트 바닥 판정에만 쓴다. **측정기(페이지 안)가 아니라 여기서** 계산하는 이유:
 * 측정기는 문자열로 주입되는 층이라 무거워질수록 실패 지점이 늘고, 색차는 hex 두 개만
 * 있으면 나오므로 페이지 안에서 잴 이유가 없다. 측정기는 「바닥이 무슨 색인지」만 본다. */
function hex2lab(h) {
  const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const X = v[0] * 0.4124564 + v[1] * 0.3575761 + v[2] * 0.1804375;
  const Y = v[0] * 0.2126729 + v[1] * 0.7151522 + v[2] * 0.0721750;
  const Z = v[0] * 0.0193339 + v[1] * 0.1191920 + v[2] * 0.9503041;
  const f = (t) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const [fx, fy, fz] = [f(X / 0.95047), f(Y / 1), f(Z / 1.08883)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function deltaE2000(h1, h2) {
  const [L1, a1, b1] = hex2lab(h1), [L2, a2, b2] = hex2lab(h2);
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else hbp = (h1p + h2p < 360) ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * hbp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * hbp - 63) * Math.PI / 180);
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * (30 * Math.exp(-(((hbp - 275) / 25) ** 2))) * Math.PI / 180) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

/* 바닥 하나에 대한 판정 — 램프 전 단 중 **가장 먼저 먹히는 단**이 기준이다.
 * 최솟값을 쓰는 이유: 코어가 또렷해도 하이라이트가 먹히면 윤곽이 뭉갠다(그게 실제 증상이다).
 * ⚠ 여기가 읽는 것은 `MASCOT` 이 아니라 **`MASCOT_바닥`(두 의상 합집합)**이다 — 마스코트가
 *   실제로 어느 옷을 입고 그 면 위에 서든 먹히면 먹히는 것이라서다(위 의상 주석). */
function 마스코트가바닥에서는가(bgHex) {
  const 단 = Object.keys(MASCOT_바닥);
  if (!단.length) return { ok: true, 최소: null, 단: null };
  let 최소 = Infinity, 이름 = null;
  for (const h of 단) {
    const d = deltaE2000(h, bgHex);
    if (d < 최소) { 최소 = d; 이름 = MASCOT_바닥[h]; }
  }
  return { ok: 최소 >= 마스코트바닥_임계, 최소: Math.round(최소 * 10) / 10, 단: 이름 };
}

/* 체리 램프가 이 파일에서 통과하는가 — **파일 단위**로 갈린다(마스코트 IP 색 주석 참조).
 * 측정기는 페이지 안에서 돌아 제 경로를 모르므로 판정이 여기 있다(유예 처리와 같은 이유). */
function 마스코트콘텐츠인가(file) {
  const 상대 = path.relative(ROOT, file).replace(/\\/g, '/');
  return Object.keys(마스코트콘텐츠).some((k) => 상대.endsWith(k));
}

function 측정(file, chrome, opts = {}) {
  const html = fs.readFileSync(file, 'utf8');
  /* 마스코트 콘텐츠에서만 램프를 KIT 에 얹는다 — 그 밖에서는 얹지 않으므로
   * 체리가 앱 UI 에 들어가면 「키트 밖 색」으로 그대로 잡힌다(실행 규칙 ① 강제). */
  const 램프허용 = opts.마스코트콘텐츠 === undefined ? 마스코트콘텐츠인가(file) : opts.마스코트콘텐츠;
  const kitHexes = 램프허용 ? [...Object.keys(KIT), ...Object.keys(MASCOT)] : Object.keys(KIT);
  const 주입 = `<script>window.addEventListener('load', () => {
    let r; try { r = ${측정기소스(kitHexes, FONTS_OK, GENERIC_OK, KC_FONTS_OK, KC_SCOPE, opts.freeze, opts.kcColors === undefined ? KC_COLORS : opts.kcColors, opts.kcColorScope || KC_COLOR_SCOPE)}; }
    catch (e) { r = { 오류: String(e && e.stack || e) }; }
    const pre = document.createElement('pre');
    pre.id = 'SYNK_LINT_OUT';
    pre.textContent = JSON.stringify(r);
    document.documentElement.appendChild(pre);
  });</script>`;

  // </body> 앞에 넣는다 — 없으면 끝에 붙인다.
  const 주입본 = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${주입}</body>`) : html + 주입;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lint-'));
  const tmp = path.join(dir, 'page.html');
  try {
    fs.writeFileSync(tmp, 주입본, 'utf8');
    // ⚠ 한글 경로 → encodeURI. 안 하면 빈 문서가 뜨고 위반 0건으로 「통과」한다.
    const url = 'file:///' + encodeURI(tmp.replace(/\\/g, '/'));
    const out = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', url,
    ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

    const m = out.match(/<pre id="SYNK_LINT_OUT">([\s\S]*?)<\/pre>/);
    if (!m) throw new Error('측정기가 결과를 못 냈다 — 페이지 스크립트 오류이거나 로드 실패');
    const 결과 = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
    if (결과.오류) throw new Error('측정기 예외: ' + 결과.오류);
    // 빈 문서를 「통과」로 읽지 않는다.
    if (!결과.잰것) throw new Error('텍스트 요소를 하나도 못 쟀다 — 로드 실패를 통과로 읽을 뻔했다');
    /* 마스코트 바닥 판정 — 측정기는 바닥 hex 만 모았고, 무는지는 여기서 색차로 가른다.
     * `마스코트바닥`(수집) → `마스코트바닥위반`(판정)으로 이름이 갈리는 것이 의도다. */
    결과.마스코트바닥위반 = (결과.마스코트바닥 || [])
      .map((v) => ({ ...v, ...마스코트가바닥에서는가(v.bg) }))
      .filter((v) => !v.ok);
    return 결과;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 정리 실패는 검사 결과를 바꾸지 않는다 */ }
  }
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */
function main(argv) {
  const json = argv.includes('--json');
  // 인자가 없으면 등록층 전량을 돈다 — 「어느 파일을 봤는지」를 사람이 매번 타이핑하게 두면
  // 목록이 손에서 갈라진다(F080 이 그 자리였다).
  const files = argv.filter((a) => !a.startsWith('--'));
  const 표적 = files.length ? files : 대상.map((p) => path.join(ROOT, p));
  if (!files.length) console.log(`등록층 ${대상.length}개 · 제외 ${제외.length}개(이유는 tools/브랜드렌더린트.js 의 \`제외\`)`);

  const chrome = findChrome();
  if (!chrome) {
    console.error('SKIP: 크롬을 못 찾았다 — 렌더 검사를 **안 돌렸다**(통과 아님). CHROME_PATH 로 지정할 수 있다.');
    return 2;
  }

  const 전체 = {};
  let 위반합 = 0;
  for (const f of 표적) {
    let r;
    try { r = 측정(f, chrome); }
    catch (e) { console.error(`✗ ${f} — ${e.message}`); return 2; }
    /* 유예를 **여기서** 뺀다 — 측정기는 페이지 안에서 돌아 자기 파일 경로를 모른다.
     * 유예 키는 `repo 상대경로:셀렉터`. 임시 사본을 검사할 때도 걸리도록 경로 끝으로 맞춘다. */
    const 상대 = path.relative(ROOT, f).replace(/\\/g, '/');
    // ⚠ 첫 콜론에서 가른다 — 셀렉터가 `::before` 라 lastIndexOf 를 쓰면 의사요소 안에서 잘린다(08-07 실족).
    //   repo 상대경로에는 콜론이 없으므로 첫 콜론이 곧 구분자다.
    const 유예됨 = (v) => Object.keys(구역밖_유예)
      .some((k) => { const i = k.indexOf(':'); return 상대.endsWith(k.slice(0, i)) && v.sel === k.slice(i + 1); });
    r.구역밖_유예됨 = r.구역밖색.filter(유예됨);
    r.구역밖색 = r.구역밖색.filter((v) => !유예됨(v));

    전체[f] = r;
    const n = r.대비위반.length + r.키트밖색.length + r.키트밖서체.length + r.구역밖색.length
      + (r.마스코트바닥위반 || []).length;
    위반합 += n;
    if (json) continue;

    console.log(`\n── ${f}`);
    console.log(`   잰 텍스트 요소 ${r.잰것} · 그라디언트라 대비 판정 포기 ${r.그라디언트건너뜀}`);
    const 요약 = (라벨, 목록, 키) => {
      if (!목록.length) { console.log(`   ✅ ${라벨} 0`); return; }
      const 묶음 = new Map();
      for (const v of 목록) { const k = 키(v); 묶음.set(k, (묶음.get(k) || 0) + 1); }
      console.log(`   🔴 ${라벨} ${목록.length}건`);
      for (const [k, c] of Array.from(묶음).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
        console.log(`      ${String(c).padStart(4)}× ${k}`);
      }
    };
    요약('대비 위반', r.대비위반, (v) => `${v.fg} on ${v.bg} = ${v.대비} (기준 ${v.기준}, ${v.size}px/${v.weight})`);
    요약('키트 밖 색', r.키트밖색, (v) => v.hex);
    요약('키트 밖 서체', r.키트밖서체, (v) => v.font);
    요약('구역 밖 색(직책 위반)', r.구역밖색, (v) => `${v.hex} @ ${v.sel} (${v.자리})`);
    /* 마스코트가 아예 없는 파일에서 「✅ 0」은 **깨끗함이 아니라 해당 없음**이다 —
     * 0 을 통과로 읽게 두면 등록층이 새는 그 형태가 된다. 그래서 분모(잰 장수)와 함께 낸다. */
    if (r.마스코트바닥위반 && r.마스코트바닥위반.length) {
      요약(`마스코트가 먹히는 바닥 (마스코트 ${r.마스코트잰것}장 중)`, r.마스코트바닥위반,
        (v) => `${v.bg} 위 — ${v.단} 이 색차 ${v.최소} (임계 ${마스코트바닥_임계}) · ${v.src}`);
    } else if (r.마스코트잰것) {
      console.log(`   ✅ 마스코트 바닥 0 — ${r.마스코트잰것}장 전부 뜬다(임계 ${마스코트바닥_임계})`);
    }
    // 유예는 **조용히 넘기지 않는다** — 안 보이는 유예는 곧 잊힌 위반이다.
    if (r.구역밖_유예됨.length) {
      console.log(`   ⏳ 구역 밖 색 유예 ${r.구역밖_유예됨.length}건 — 유호님 판정 대기(사유는 tools/브랜드렌더린트.js 의 \`구역밖_유예\`)`);
    }
  }
  if (json) console.log(JSON.stringify(전체, null, 1));
  return 위반합 ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = {
  KIT, 킷밖_유예, 구역밖_유예, FONTS_OK, GENERIC_OK, KC_FONTS_OK, KC_COLORS, KC_SCOPE, KC_COLOR_SCOPE,
  MASCOT, MASCOT_바닥, 마스코트바닥_임계, 마스코트가바닥에서는가, deltaE2000,
  마스코트콘텐츠, 마스코트콘텐츠인가,
  findChrome, 측정, 대상, 제외, ROOT,
};
