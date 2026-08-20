/* 브랜드 색 잠금 — 2026-08-01 유호님 확정 「v10 Crew Dossier」 19색(정본 v1.6).
 *
 * 왜 이 파일이 필요한가:
 *   폰트는 `브랜드폰트.test.js`가 상시로 지키는데 **색은 지키는 게 없었다**. 08-02 전수 검증은
 *   그 시점의 스냅샷이지 재발 방지 장치가 아니다 — 구 색이 새 산출물에 다시 들어와도 아무것도 안 막았다.
 *   CLAUDE.md 「신뢰성」 = 프로즈보다 기계 강제. 08-03 브랜드 키트 종합 판정에서 이 비대칭이 최대 공백으로 나왔다.
 *
 * 설계 원칙 — **잡을 수 있다고 다 잡지 않는다. 오탐 없이 잡을 수 있는 것만 기계로 옮긴다.**
 *   실측으로 확인한 함정 2개가 이 파일의 구조를 결정했다:
 *   ① `#FF6D00`(오렌지)·`#3D5AFE`(블루)는 **브랜드에서만 폐기됐고 교재 제품층 기능색으로는 살아 있다**
 *      (받침 없음·오류 / 받침 있음·주조 — 정본이 「불가침」으로 규정). 단순 금지 목록으로 짜면 오탐.
 *      → 금지가 아니라 **카운트 동결**로 간다. 새로 늘면 실패시키고, 어느 층인지 사람이 판정하게 한다.
 *   ② Glide 앱 UI 색(Code.js의 tailwind 계열 60여 종)은 정본 §12가 **적용 제외**로 규정한 별도 정본이다.
 *      → 화이트리스트(키트 밖 금지) 방식은 여기서 통째로 오탐. 그래서 **금지 목록 + 카운트 동결**만 쓴다.
 *
 * 「선언」이 아니라 「적용된 결과」를 본다(memory `guard-must-check-result`):
 *   정본에 적힌 대비 수치를 **다시 계산해서** 대조한다. 색을 바꾸면 수치가 깨지고, 수치를 고치면 색과
 *   어긋나므로 둘이 서로를 지킨다. 문서가 조용히 낡는 것(08-03에 실제로 2건 발견)을 막는 유일한 방법이다.
 *
 * 정본 = docs/디자인_컨셉_정본_v1.md · hex 원천 = docs/_archive/브랜드_색상키트_원본_CrewDossier_2026-08-01.html
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { ENGINE_FILES } = require('./_engine-source');
const TOOLS = path.join(ROOT, 'docs', 'tools');
const CANON = path.join(ROOT, 'docs', '디자인_컨셉_정본_v1.md');
const HEX_SOURCE = path.join(ROOT, 'docs', '_archive', '브랜드_색상키트_원본_CrewDossier_2026-08-01.html');

/* ─── 확정 21색 — 2026-08-06 토큰 단일화: 목록의 정본은 docs/디자인_토큰.json 하나다.
 *     (같은 목록을 두 곳에 적으면 갈라진다 — 여기는 파생만 한다. 팔레트 구분·직책도 JSON에 있다.) */
const 토큰 = require('../docs/디자인_토큰.json');
const KIT = Object.fromEntries(토큰.색.킷.map((c) => [c.hex.toUpperCase(), c.이름]));
/* 2027 킷 「내일 꾸러미」(08-20 유호님 확정 · 조항 ⓙ) = 41색 — 코랄 램프 5+Wash · 바탕 3+양모 회색 4 ·
 * 2027 실 4×3단 · KC 4 · ⏳퇴역 대기 12(다크 트랙이 재배선 후 삭제하며 41→29 로 내린다) */
const 킷개수 = 41;

/* hex 원천 HTML 밖의 색 — **08-01 원본 HTML 은 그날의 스냅샷이지 킷의 미래가 아니다.**
 * 그 문서를 소급 개서하면 「그때 무엇이었는지」가 사라지므로(_archive 성격), 나중에 더해진 색은
 * 여기에 **원천을 적어** 등재한다. 이유 없는 예외는 두지 않는다. */
const 원천밖 = {
  '#13724A': 'Emerald — 2026-08-07 유호님 확정 추가(라이트 면의 성장·획득). 원천 = 컨셉 정본 조항 ⓖ · memory kit-slate-gray-2026-08-07',

  /* ─── 중성축 11색 — 2026-08-18 유호님 확정 「근사 검정 #08090C / 근사 흰색 #FAFAF9 · 코랄은 유지」.
   *   구 Navy 4단·Cream 4단·Slate 2색이 여기로 갈렸다. 값은 손으로 박은 것이 아니라 `tools/중성축.js` 가
   *   **정박점 2개에서 유도**한 것이다 — 각 색이 자기 바닥에 대해 갖던 WCAG 대비를 보존하고 색상만 죽였다.
   *   그래서 이 11줄의 진짜 원천은 문서가 아니라 **그 도구 + 정박점 2개**이고, 근거·유도 규칙은 조항 ⓗ에 있다.
   *   ⚠ 08-01 원천 HTML 은 그날의 스냅샷이라 소급 개서하지 않는다(_archive 성격) — 그래서 전부 「원천밖」이다. */
  '#08090C': 'Graphite — 08-18 확정 중성축의 다크 정박점(바탕·다크). 유도기 tools/중성축.js · 근거 = 컨셉 정본 조항 ⓗ',
  '#E4E4E7': 'Chalk — 다크 위 잉크. 구 Cream 의 바닥 대비 15.74 를 보존해 유도(15.69). 근거 = 조항 ⓗ',
  '#EAEAEA': 'Chalk 2 — 문서 콜아웃 바닥. 구 Cream 2 의 Paper 대비 1.15 를 보존해 유도. 근거 = 조항 ⓗ',
  '#D1D2D4': 'Chalk 3 — 반전면 보조·괘선. 구 Cream 3 의 다크 대비 13.13 을 보존해 유도(13.16). 근거 = 조항 ⓗ',
  '#262626': 'Graphite 3 — 발표물 본문 잉크. 구 Navy 의 Paper 대비 14.46 을 보존해 유도(14.49). 근거 = 조항 ⓗ',

  /* ─── 2027 킷 「내일 꾸러미」 25색 — 2026-08-20 유호님 확정 · 근거 = 컨셉 정본 조항 ⓙ.
   *   코랄 축 6 = 마스코트 평상복 램프 정렬(값 원천 = 확정 렌더 픽셀 실측 · tools/마스코트램프.py) ·
   *   바탕 3+양모 회색 4 · 2027 실 4꾸러미×3단(WGSN·Coloro S/S 27 키컬러의 펠트 번역판 · 대비 게이트 실측).
   *   ⚠ 옛 Paper #FAFAF9 · 옛 Ink #1B1B1A 항목은 킷에서 값이 갈려 여기서 졌다(죽은 예외는 지운다). */
  '#FBB7A3': 'Coral Soft — 코랄 램프 1(보풀 빛) = 평상복램프 Highlight. 근거 = 조항 ⓙ',
  '#FD9C87': 'Coral 2 — 코랄 램프 2(윗면) = 평상복램프 Top. 근거 = 조항 ⓙ',
  '#F96859': 'Coral — 코랄 램프 3(몸통) = 평상복램프 Core · 브랜드 기본색. 근거 = 조항 ⓙ',
  '#AE322A': 'Coral 3 — 코랄 램프 4(그늘) = 평상복램프 Deep · 신호 글자 5.98. 근거 = 조항 ⓙ',
  '#941F19': 'Coral Rim — 코랄 램프 5(바닥) = 평상복램프 Rim. 근거 = 조항 ⓙ',
  '#FEF0E9': 'Coral Wash — 신호 바닥(새 Paper 파생). 근거 = 조항 ⓙ',
  '#FBF7F0': 'Paper — 양모 종이(라이트 바탕). 팬톤 2026 Cloud Dancer 자리. 근거 = 조항 ⓙ',
  '#2B2320': 'Ink — 따뜻한 먹(Paper 위 14.42). 근거 = 조항 ⓙ',
  '#F0E3C8': 'Stitch — 실땀(마스코트 실물 밑단 실측 승격 · 운용 규칙 ②). 근거 = 조항 ⓙ',
  '#EDE7DC': 'Oat — 양모 회색 1(칩 바닥·가라앉은 면). 근거 = 조항 ⓙ',
  '#C7BFB2': 'Stone — 양모 회색 2(비활성 테두리). 근거 = 조항 ⓙ',
  '#8D857A': 'Ash Wool — 양모 회색 3(보조 글자). 근거 = 조항 ⓙ',
  '#575046': 'Deep Wool — 양모 회색 4(보조 강조). 근거 = 조항 ⓙ',
  '#C5D6F5': 'Lapis Soft — 청금석 1(안내 칩 바닥). 근거 = 조항 ⓙ',
  '#3D6BC9': 'Lapis — 청금석 2(몸통 · 2027 올해의 색 루미너스 블루 펠트판 · 면 위 글자는 Paper). 근거 = 조항 ⓙ',
  '#24448C': 'Lapis Deep — 청금석 3(링크·안내 글자 8.62). 근거 = 조항 ⓙ',
  '#D3E8BE': 'Meadow Soft — 메도우 1(정답 칩 바닥). 근거 = 조항 ⓙ',
  '#7DB45A': 'Meadow — 메도우 2(몸통 · 면 전용). 근거 = 조항 ⓙ',
  '#3F6B2E': 'Meadow Deep — 메도우 3(정답 글자 5.86). 근거 = 조항 ⓙ',
  '#FFEBB0': 'Butter Soft — 버터 1(보상 여린 면). 근거 = 조항 ⓙ',
  '#F5C445': 'Butter — 버터 2(몸통 · 면 위 Ink 9.43). 근거 = 조항 ⓙ',
  '#7E5A10': 'Butter Deep — 버터 3(보상 글자 5.86). 근거 = 조항 ⓙ',
  '#F8C7DE': 'Pop Soft — 팝 핑크 1(이벤트 칩 바닥). 근거 = 조항 ⓙ',
  '#E05C97': 'Pop — 팝 핑크 2(몸통 · 면은 큰 글자 전용 3.20). 근거 = 조항 ⓙ',
  '#99295D': 'Pop Deep — 팝 핑크 3(기념 글자 6.95). 근거 = 조항 ⓙ',
  '#1D1D1C': 'Graphite 2 — 문서의 가장 깊은 글자. 구 Navy Ink 의 대비 16.08 을 보존해 유도(16.15). 근거 = 조항 ⓗ',
  '#373737': 'Graphite 4 — 보조 잉크·괘선. 구 Navy 3 의 Paper 대비 11.47 을 보존해 유도(11.40). 근거 = 조항 ⓗ',
  '#8A8A8A': 'Ash — 다크 위 3층 잉크. 구 Slate 의 다크 대비 5.78 을 보존해 유도(5.77). 바닥 한정은 조항 ⓔ 가 그대로 진다',
  '#676767': 'Ash 2 — 라이트 위 3층 잉크. 구 Slate 2 의 Paper 대비 5.39 를 보존해 유도(5.42). 바닥 한정은 조항 ⓔ',
};

/* 중성축으로 «퇴역»한 구 킷 11색 — DEAD 와 다르다. DEAD 는 「어디에도 되살아나면 안 되는 색」이고,
 * 이쪽은 **08-18 이전 산출물에는 정당하게 살아 있는 색**이다(토큰 정본 규약 ④ 「동결된 구 산출물은
 * 소급 개서하지 않는다」). 그래서 저장소 전체를 금지하면 굳은 발표물 수십 벌이 통째로 적색이 된다.
 * 대신 **토큰을 소비하는 살아있는 층**(토큰 JSON·빌드 CSS·Canva 대조기)에서만 0건을 요구한다 —
 * 새 지면이 조용히 네이비로 돌아가는 것을 잡는 자리는 정확히 거기다. 검사는 아래 「퇴역색」 테스트. */
const 퇴역 = {
  '#0F1730': 'Navy 2 → Graphite #08090C', '#131A32': 'Navy Ink → Graphite 2 #1D1D1C',
  '#1A2340': 'Navy → Graphite 3 #262626', '#2A3358': 'Navy 3 → Graphite 4 #373737',
  '#FBF7EE': 'Paper → Paper #FAFAF9', '#F6F1E8': 'Cream → Chalk #E4E4E7',
  '#EFE7D7': 'Cream 2 → Chalk 2 #EAEAEA', '#E7DDC7': 'Cream 3 → Chalk 3 #D1D2D4',
  '#171820': 'Ink → Ink #1B1B1A', '#8A93AD': 'Slate → Ash #8A8A8A', '#5F657D': 'Slate 2 → Ash 2 #676767',
};

/* 완전히 죽은 색 — 어느 층에서도 되살아나면 안 된다. 등장 자체를 막는다. */
const DEAD = {
  '#0B1A2E': '구 미드나잇블루 배경 → Graphite #08090C',
  /* ⚠ 2026-08-18 이후 이 줄은 «거의 자기 자신을 가리킨다» — 새 다크 정박점 #08090C 는 이 색과 RGB 거리 1.4 다.
   *   조항 ⓗ 가 v1.2 의 폐기 확정을 되돌렸기 때문이고, 그래도 줄을 지우지 않는 이유는 두 가지다:
   *   ①정확히 #08080B 인 옛 값이 되살아나면 그건 여전히 「갈아타지 않은 판」이라 잡아야 한다
   *   ②이 줄이 남아 있어야 다음 사람이 «되돌렸다»는 사실을 여기서 읽는다.
   *   🔑 다만 이 형태의 가드는 «1 만큼 옮긴 부활»에 원리적으로 눈이 멀다 — 거리로 재는 검사는
   *      tools/중성축.js 의 ④ 가 진다(임계 16). 새로 죽이는 색이 생기면 그 축으로 잰다. */
  '#08080B': '구 순검정 배경 → Graphite #08090C (⚠조항 ⓗ 로 사실상 부활 — 거리 1.4)',
  '#F5F1E8': '구 웜크림 잉크 → Chalk #E4E4E7',
  '#FDFCF8': '구 종이 바탕 → Paper #FAFAF9',
  '#101014': '구 모드B 잉크 → Ink #1B1B1A',
  '#101528': '구 교재 다크(탈락) → Graphite #08090C',
  '#183946': '구 유호 원안 배경(탈락) → Graphite #08090C',
  '#FF3D8A': '구 신호색 2순위 형광핑크(미채택) → Coral #FF6B5C',
  '#6A13E4': 'Canva 기본색(삭제 완료) — 키트에 없는 색',
};

/* 「자리 한정 폐기」 — 브랜드 층에서는 죽었지만 교재 제품층 기능색으로는 살아 있다(정본이 불가침으로 규정).
 * 층을 기계로 구별할 수 없으므로 금지하지 않고 **현재 건수를 동결**한다. 늘면 사람이 판정한다. */
const FROZEN = {
  // 현재 건수 = synk_palette.html의 「제품층(앱 UI·교재 기능색) — 이 팔레트와 별개, 불가침」 구역 표기뿐.
  '#FF6D00': { known: 3, why: '교재 기능색 「받침 없음·오류」로는 유효 / 브랜드 신호색 자리엔 Coral #FF6B5C' },
  '#3D5AFE': { known: 2, why: '교재 기능색 「받침 있음·주조」로는 유효 / 모드 C 2도 잉크는 v1.5에서 KC Sun #FFD447로 교체' },
};

/* V9 레드 — 08-02 유호님 기각(「강렬하나 칙칙」). 비교 도구 2종만 의도적으로 보존한다. */
const V9_RED = '#C74A3A';
const V9_RED_OK = new Set(['트렌디미니멀_색전환_비교.html', '표지_AB_코랄vs레드.html']);

/* ─── 유틸 ────────────────────────────────────────────────────────────────── */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/* WCAG 2.x 상대 휘도 → 대비비. 정본 §12의 「측정값」을 이 식으로 재계산해 대조한다. */
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

/* 주석 속 색 언급은 세지 않는다 — 역사 기록(Code.js 헤더의 「코랄 #FF7A6B→#FF6B5C」 등)까지 잡으면
 * 가드가 문서화를 처벌하게 되고, 그러면 사람이 기록을 안 남기는 쪽으로 학습한다. 실제 지정만 본다. */
const stripComments = (src) =>
  src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // `https://` 를 주석으로 오인하지 않도록 앞 문자 확인

const readStripped = (p) => stripComments(fs.readFileSync(p, 'utf8'));

const toolFiles = fs.existsSync(TOOLS) ? fs.readdirSync(TOOLS).filter((f) => f.endsWith('.html')) : [];
const jsFiles = [...ENGINE_FILES, '상담AI.js', '교재연동.js', '만족도팩.js'].concat(
  fs.readdirSync(ROOT).filter((f) => /^contents_.*\.js$/.test(f))
);

/* 2026-08-05 · 라이브 접수 폼·대외 게시물을 등록층에 넣는다.
 * 감사(08-04)가 밝힌 것: 이 가드가 초록이었던 건 맞아서가 아니라 **그 파일들을 안 봤기 때문**이다.
 * 목록은 여기 새로 적지 않고 `tools/브랜드렌더린트.js` 의 `대상` 하나에서 파생시킨다 —
 * 두 곳에 적으면 갈라지고, 갈라지는 방향은 언제나 「통과」다.
 * ⚠ 렌더 린트는 크롬에 기대서 **CI 에선 통째로 skip 된다.** 즉 CI 에서 이 파일들을 실제로
 *   지키는 건 지금 이 소스 가드다 — 등록이 여기 있어야 하는 이유가 그것이다. */
const { 대상: RENDER_TARGETS } = require('../tools/브랜드렌더린트');

/* 검사 대상 = 브랜드가 닿는 표면 전부. [상대경로, 내용] */
const targets = [
  ...toolFiles.map((f) => [path.join('docs/tools', f), path.join(TOOLS, f)]),
  ...jsFiles.map((f) => [f, path.join(ROOT, f)]),
  ...RENDER_TARGETS.map((rel) => [rel, path.join(ROOT, rel)]),
]
  .filter(([, abs]) => fs.existsSync(abs))
  .map(([rel, abs]) => [rel, readStripped(abs)]);

/* 08-04 배포물 6종 키트 이관과 함께 발표물 폴더를 죽은색·동결색 검사(2·3절)에 넣는다 —
 * 이전엔 스캔 범위 밖이라 62 초록인데도 구 팔레트가 살았다(memory print-doc-pipeline).
 * 단 RGB 숫자 검사(4절)엔 넣지 않는다: 그 검사의 표적(캔버스 픽셀 코드)은 JS 에만 있고,
 * 정적 HTML 의 svg 좌표·mm 수치는 폐기색 triplet 과 우연히 겹치는 오탐 표면이다.
 * 발표물의 색 자체는 로고정본색.test.js 의 화이트리스트(키트 밖 0)가 더 세게 잠근다. */
const PRESENT_DIR = path.join(ROOT, 'docs', '발표물');
const printTargets = ['', '로고']
  .flatMap((sub) => {
    const d = path.join(PRESENT_DIR, sub);
    return fs.existsSync(d)
      ? fs.readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => path.posix.join('docs/발표물', sub, f))
      : [];
  })
  .map((rel) => [rel, path.join(ROOT, rel)])
  .filter(([, abs]) => fs.existsSync(abs))
  .map(([rel, abs]) => [rel, readStripped(abs)]);

/* ─── 0. 스캔이 조용히 0건이 되는 것 방지 ─────────────────────────────────── */
test('색 검사 대상 파일을 실제로 찾는다(경로가 바뀌면 가드가 죽는다)', () => {
  assert.ok(targets.length >= 10, `검사 대상이 ${targets.length}개뿐 — docs/tools 또는 엔진 파일 경로를 확인하라`);
  const withHex = targets.filter(([, src]) => /#[0-9A-Fa-f]{6}\b/.test(src));
  assert.ok(withHex.length >= 8, `hex를 가진 파일이 ${withHex.length}개뿐 — 스캔이 헛돌고 있다`);
});

/* ─── 1. 키트가 hex 원천과 일치한다 ───────────────────────────────────────── */
test(`키트 ${킷개수}색이 hex 원천과 전부 일치한다`, () => {
  assert.ok(fs.existsSync(HEX_SOURCE), `hex 원천이 없다: ${path.relative(ROOT, HEX_SOURCE)} — 08-02에 Downloads에서 이관한 정본이다`);
  const src = fs.readFileSync(HEX_SOURCE, 'utf8').toUpperCase();
  assert.equal(Object.keys(KIT).length, 킷개수, `키트는 ${킷개수}색이다 — 표를 고쳤다면 정본·Canva·이 테스트가 함께 움직여야 한다`);
  for (const [hex, name] of Object.entries(KIT)) {
    if (원천밖[hex]) continue; // 원천이 다른 색 — 아래 테스트가 그 근거를 따로 검사한다
    assert.ok(src.includes(hex), `원천 HTML에 ${name} ${hex}가 없다 — 키트 표와 원천이 어긋났다`);
  }
});

/* 예외가 예외로 남는지 — 「원천밖」은 **빠져나가는 문**이라 셋을 함께 잠근다:
 *   ① 실제로 킷에 있는 색인가(죽은 예외가 쌓이면 다음 사람이 그 목록을 신뢰한다)
 *   ② 원천 HTML 에 정말 없는가(있으면 예외가 필요 없다 — 조용히 검사를 건너뛰게 된다)
 *   ③ 근거 문서가 실재하는가(사유 문자열은 얼마든지 쓸 수 있다) */
/* ⚠ 이 파일의 `!src.includes(hex)`·`!up.includes(…)` 부정 단언들은 **HTML·CSS·인쇄물**을 본다 —
 *   `코드만()`(JS 렉서)으로 감싸지 않는다(갈래 ⓒ 비JS · 대기열 #Q72). HTML 주석은 `<!-- -->` 이고,
 *   JS 렉서를 대면 `url(//…)`·`https://` 뒤가 잘려 「그 색이 없다」가 거짓으로 참이 된다. */
test('hex 원천 밖 색은 근거가 실재한다(예외가 통로가 되지 않게)', () => {
  const src = fs.readFileSync(HEX_SOURCE, 'utf8').toUpperCase();
  const canon = fs.readFileSync(CANON, 'utf8');
  for (const [hex, why] of Object.entries(원천밖)) {
    assert.ok(KIT[hex], `${hex} 가 킷에 없는데 예외로 남아 있다 — 죽은 예외는 지운다`);
    assert.ok(!src.includes(hex), `${hex} 는 원천 HTML 에 있다 — 예외가 필요 없으니 「원천밖」에서 빼라`);
    assert.ok(why.length > 30, `${hex} 예외에 사유가 부실하다`);
    assert.ok(canon.includes(hex), `정본에 ${hex} 가 없다 — 근거 없이 킷에 들어온 색이다 (${why})`);
  }
  assert.ok(canon.includes('조항 ⓔ'), '정본에서 조항 ⓔ(보조 잉크 2)가 사라졌다 — Ash 의 바닥 한정이 이 조항에만 있다');
});

/* ─── 1-b. 중성축 퇴역색 — «살아있는 층»에서만 0건을 요구한다 (2026-08-18 조항 ⓗ) ─────────
 * DEAD 와 왜 다른가: DEAD 는 「어디에도 되살아나면 안 되는 색」이고 퇴역색은 **08-18 이전
 * 산출물에 정당하게 살아 있는 색**이다(토큰 규약 ④ 「동결된 구 산출물은 소급 개서하지 않는다」).
 * 저장소 전역 금지로 짜면 굳은 발표물 수십 벌이 통째로 적색이 되고, 그러면 이 가드는 꺼진다.
 * 그래서 과녁을 **살아있는 층**으로만 좁힌다 — 새 지면이 조용히 네이비로 돌아가는 곳이 정확히 거기다.
 *
 * 🔑 **2026-08-18 ④ 에서 과녁이 셋 → 살아있는 층 전체로 넓어졌다.** 처음 셋(토큰·빌드 CSS·Canva 대조기)만
 *   보던 판은 초록이었는데, 정작 화면을 그리는 **생성기 10벌 전부가 구 hex 를 들고 있었다**(실측 85건).
 *   지면만 고치고 생성기를 두면 다음 빌드가 퇴역색을 도로 심는다 — 「고쳤는데 되살아나는」 자리다.
 *   ⇒ 과녁 = ①토큰 소비 3자리 ②`지면방` 이 「입는다」로 판정한 살아있는 지면 전량 ③그것을 굽는 생성기.
 *   ②의 목록은 여기 손으로 안 적는다(지면방이 이미 그 판정을 진다 · 두 곳에 적으면 갈라진다).
 * ⚠ 굳은 산출물·아카이브는 과녁 밖이다 — 규약 ④ 대로 소급 개서하지 않으므로 넣으면 상시 적색이 되고,
 *   상시 적색인 가드는 꺼진다(F103 축). */
const 퇴역생성기 = [
  'tools/이해대장.js', 'tools/운영자료.js', 'tools/자율기록.js', 'tools/작동대장.js',
  'tools/브랜드킷조립.py', 'tools/교재읽기본.js', 'tools/인쇄본빌드.js', 'tools/시스템대장.js',
  'tools/발표물린트.js', 'tools/harness-export.js', 'tools/로고주입.js',
];
const 퇴역과녁 = [
  path.join(ROOT, 'docs', '디자인_토큰.json'),
  path.join(TOOLS, 'synk-tokens.css'),
  path.join(TOOLS, 'canva_키트_검증.js'),
  ...require('../tools/lib/지면방.js').점검().갈래.입는다.map((r) => path.join(ROOT, r.경로)),
  ...퇴역생성기.map((r) => path.join(ROOT, r)),
];

/* 🔑 분모를 먼저 밝힌다 — 경로가 바뀌어 과녁이 쪼그라들면 「0건」과 「안 봤다」가 같은 모양이다(F207). */
test('중성축 — 퇴역색 과녁이 실제로 잡혔다(분모 확인)', () => {
  assert.ok(퇴역과녁.length >= 30,
    `과녁이 ${퇴역과녁.length}벌뿐 — 2026-08-18 실측은 36벌(토큰 3 + 지면 22 + 생성기 11)이었다. 지면방 분류나 생성기 경로가 바뀌었는지 봐라`);
  const 없는것 = 퇴역과녁.filter((p) => !fs.existsSync(p)).map((p) => path.relative(ROOT, p));
  assert.deepEqual(없는것, [], `과녁 경로가 죽었다: ${없는것.join(', ')} — 경로가 바뀌면 가드가 조용히 죽는다`);
});
for (const p of 퇴역과녁) {
  test(`중성축 — ${path.relative(ROOT, p)} 에 퇴역한 구 킷 색이 없다`, () => {
    assert.ok(fs.existsSync(p), `과녁이 없다: ${path.relative(ROOT, p)} — 경로가 바뀌면 가드가 죽는다`);
    const up = fs.readFileSync(p, 'utf8').toUpperCase();
    for (const [hex, 갈길] of Object.entries(퇴역)) {
      /* 「구 Slate(#8A93AD 청회색)」처럼 **역사로 인용된** 자리는 통과시킨다 — 기록을 처벌하면 기록이 사라진다 */
      const 인용 = new RegExp(`구 [^"]{0,40}${hex}`, 'i');
      if (인용.test(fs.readFileSync(p, 'utf8'))) continue;
      assert.ok(!up.includes(hex), `${path.relative(ROOT, p)} 에 퇴역색 ${hex} 가 있다 → ${갈길} (조항 ⓗ)`);
    }
  });
}

/* 목록 자체가 낡는 것도 막는다 — 퇴역색이 킷에 되살아나 있으면 위 검사가 통째로 무의미해진다 */
test('중성축 — 퇴역 목록의 색은 킷에 하나도 없다(목록이 낡으면 검사가 헛돈다)', () => {
  assert.equal(Object.keys(퇴역).length, 11, '퇴역은 11색이다 — 조항 ⓗ 가 갈아탄 개수');
  const 되살아남 = Object.keys(퇴역).filter((h) => KIT[h]);
  assert.deepEqual(되살아남, [], `퇴역색이 킷에 돌아왔다: ${되살아남.join(', ')} — 조항 ⓗ 를 뒤집는 일이다`);
});

/* ─── 2. 죽은 색 회귀 차단 ────────────────────────────────────────────────── */
for (const [rel, src] of targets.concat(printTargets)) {
  test(`${rel} — 폐기된 구 색이 되살아나지 않았다`, () => {
    const up = src.toUpperCase();
    for (const [hex, fix] of Object.entries(DEAD)) {
      assert.ok(!up.includes(hex), `${rel}에 폐기색 ${hex}가 있다 → ${fix}`);
    }
    if (!V9_RED_OK.has(path.basename(rel))) {
      assert.ok(
        !up.includes(V9_RED),
        `${rel}에 V9 레드 ${V9_RED}가 있다 — 08-02 유호님 기각(「강렬하나 칙칙」·코랄 유지). ` +
          `의도된 비교 도구라면 V9_RED_OK에 파일명을 등재하고 사유를 적어라`
      );
    }
  });
}

/* ─── 3. 자리 한정 폐기색 — 카운트 동결 ──────────────────────────────────── */
test('자리 한정 폐기색(#FF6D00·#3D5AFE)이 새로 늘지 않았다', () => {
  for (const [hex, { known, why }] of Object.entries(FROZEN)) {
    const hits = [];
    for (const [rel, src] of targets.concat(printTargets)) {
      const n = (src.toUpperCase().match(new RegExp(hex, 'g')) || []).length;
      if (n) hits.push(`${rel} ${n}건`);
    }
    const total = hits.reduce((s, h) => s + Number(h.match(/(\d+)건$/)[1]), 0);
    assert.ok(
      total <= known,
      `${hex}가 ${total}건 — 알려진 건수는 ${known}건이다.\n  ${hits.join('\n  ')}\n` +
        `  판정 필요: ${why}\n` +
        `  교재 제품층이면 FROZEN.known을 올리고 사유를 적어라. 브랜드 층이면 키트 색으로 바꿔라.`
    );
  }
});

/* ─── 4. RGB 숫자 직접 대입 회귀 차단 ────────────────────────────────────── */
/* 08-01 실사고 — hex·rgba 문자열 검색을 전부 통과한 파일에서 구 색이 캔버스 픽셀 3,097개로 살아 있었다.
 * 원인은 색을 숫자로 하나씩 쓴 코드(`d[i]=245; d[i+1]=241; d[i+2]=232;`). 어떤 문자열 패턴에도 안 걸린다.
 * 오탐 실측 = 현재 저장소 전체에서 0건이므로 기계화해도 안전하다. */
/* SVG 패스 좌표는 색이 될 수 없는 층이다 — 2026-08-06 실측: 아이콘 원본(Phosphor 256 격자)의
 * `d="…M8,8… 11…"` 이 #08080B(8,8,11)·#101528(16,21,40) 삼중항과 우연히 일치해 첫 오탐 2건.
 * 색은 fill·stroke·hex 문자열로만 살고 그 층은 2절이 그대로 지키므로, 여기서만 d 속성을 걷어낸다.
 * 아래 픽스처 2줄이 「걷어내고도 잡는다 / 패스는 안 잡는다」를 함께 못박는다. */
const stripSvgPathData = (src) => src.replace(/\bd="[^"]*"/g, ' ');
test('픽스처: RGB 숫자 탐지는 살아 있고, SVG 패스 좌표는 잡지 않는다', () => {
  const detect = (src) => {
    const s = stripSvgPathData(src);
    return Object.keys(DEAD).some((hex) => {
      const [r, g, b] = rgb(hex);
      return new RegExp(`\\b${r}\\b[\\s\\S]{0,50}?\\b${g}\\b[\\s\\S]{0,50}?\\b${b}\\b`).test(s);
    });
  };
  assert.ok(detect('d[i]=245; d[i+1]=241; d[i+2]=232;'), '캔버스 픽셀 대입(#F5F1E8)을 놓친다 — 탐지력이 죽었다');
  assert.ok(!detect('<path d="M8,8a4,4,0,0,1,11,0Z"/>'), 'SVG 패스 좌표를 색으로 오인한다');
});
test('폐기색을 RGB 숫자로 직접 쓴 곳이 없다(캔버스 픽셀 우회 차단)', () => {
  const hits = [];
  for (const [hex, fix] of Object.entries(DEAD)) {
    const [r, g, b] = rgb(hex);
    // 세 성분이 짧은 창 안에 순서대로 나타나는 경우만 — 좌표·크기 숫자와의 우연한 일치를 피한다
    const re = new RegExp(`\\b${r}\\b[\\s\\S]{0,50}?\\b${g}\\b[\\s\\S]{0,50}?\\b${b}\\b`);
    for (const [rel, src] of targets) {
      const m = stripSvgPathData(src).match(re);
      if (m) hits.push(`${rel}: rgb(${r},${g},${b}) = ${hex} → ${fix}\n      ${JSON.stringify(m[0].slice(0, 60))}`);
    }
  }
  assert.equal(
    hits.length,
    0,
    `폐기색이 RGB 숫자로 살아 있다(문자열 검색으로는 안 잡히는 자리):\n    ` + hits.join('\n    ')
  );
});

/* ─── 5. 정본의 대비 수치 자기검증 ───────────────────────────────────────── */
/* 🔴 이 절의 초판은 **뚫려 있었다.** 기대값을 이 파일 안 배열에 적어두고 그걸 계산과 대조했는데,
 *    그러면 **정본 문서를 아무리 고쳐도 테스트가 모른다**. 변이 테스트(정본의 6.33을 7.90으로 조작)에서
 *    유일하게 통과해버린 구멍이었다 — memory `guard-must-check-result`의 「조각이 아니라 적용된 결과를
 *    검사하라」에 내가 다시 걸린 것이다. 그래서 지금은 **문서에서 숫자를 꺼내 계산과 맞춘다.**
 *
 * 정본은 같은 수치를 **네 곳**(모드 A/B 서술 · §2 7색표 · §12 측정표 · §11 코랄 5단표)에 중복해 적는다.
 * 실제로 v1.3 개정 때 §12만 고치고 나머지가 낡은 채 남아 08-03에 네 곳이 서로 어긋나 있었다.
 * 그래서 자리마다 앵커를 걸어 **전부** 검사한다. */
const CANON_SRC = fs.readFileSync(CANON, 'utf8');

/* [앵커 문구, 배경, 전경, 자리 설명] — 앵커가 있는 줄에서 숫자를 뽑아 계산값과 대조한다.
 * 앵커는 문서를 조금 손봐도 살아남게 짧고 특징적인 것으로 고른다(위치·줄번호 기반 금지 — 낡는다). */
const DOC_CLAIMS = [
  ['/ **잉크** Cream', '#0F1730', '#F6F1E8', '§모드 A 서술'],
  ['/ **잉크** Ink', '#FBF7EE', '#171820', '§모드 B 서술'],
  ['Paper 위 Coral 대비는', '#FBF7EE', '#FF6B5C', '§모드 B — 라이트 Coral 글자 금지 근거'],
  ['라이트 배경의 강조 글자는 Coral 3', '#FBF7EE', '#E8543F', '§모드 B — Coral 3 대형 허용 근거'],
  // §12 측정표 — v1.3에서 네 칸이 전부 틀려 있던 바로 그 표. 네 행 여덟 칸을 모두 건다.
  ['| **Coral (확정)** |', '#0F1730', '#FF6B5C', '§12 측정표 — Coral 다크'],
  ['| **Coral (확정)** |', '#FBF7EE', '#FF6B5C', '§12 측정표 — Coral 라이트'],
  ['| 구 오렌지 (폐기) |', '#0F1730', '#FF6D00', '§12 측정표 — 구 오렌지 다크(「얻음 ①」의 비교항)'],
  ['| 구 오렌지 (폐기) |', '#FBF7EE', '#FF6D00', '§12 측정표 — 구 오렌지 라이트'],
  ['| Cream (잉크) |', '#0F1730', '#F6F1E8', '§12 측정표 — Cream'],
  ['| Ink (잉크) |', '#FBF7EE', '#171820', '§12 측정표 — Ink'],
  ['| **잉크(다크 위)** | Cream', '#0F1730', '#F6F1E8', '§2 7색표 — Cream'],
  ['| **신호** | **Coral**', '#0F1730', '#FF6B5C', '§2 7색표 — Coral 다크'],
  ['| **신호(라이트 글자)** | **Coral 3**', '#FBF7EE', '#E8543F', '§2 7색표 — Coral 3'],
  ['| 잉크(라이트 위) | Ink', '#FBF7EE', '#171820', '§2 7색표 — Ink'],
  ['| 2도 잉크 | KC Sun', '#FBF7EE', '#FFD447', '§2 7색표 — KC Sun 글자 금지(v1.5)'],
  ['| Coral 2 | `#FF8877`', '#0F1730', '#FF8877', '§11 5단표 — Coral 2 다크'],
  ['| Coral 2 | `#FF8877`', '#FBF7EE', '#FF8877', '§11 5단표 — Coral 2 라이트'],
  ['| **Coral** | `#FF6B5C`', '#0F1730', '#FF6B5C', '§11 5단표 — Coral 다크 주 신호'],
  ['| Coral 3 | `#E8543F`', '#FBF7EE', '#E8543F', '§11 5단표 — Coral 3 라이트 대형'],
  ['| Coral 3 | `#E8543F`', '#0F1730', '#E8543F', '§11 5단표 — Coral 3 다크 pressed'],
  ['코랄 버튼 위 흰 글자는 대비', '#FF6B5C', '#FFFFFF', '§11 조항 ⓐ — 흰 글자 금지 근거'],
  ['코랄 버튼 위 흰 글자는 대비', '#FF6B5C', '#F6F1E8', '§11 조항 ⓐ — Cream 글자 금지 근거'],
  ['코랄 버튼 위 흰 글자는 대비', '#FF6B5C', '#171820', '§11 조항 ⓐ — Ink 글자 통과 근거'],
  // 「배경에 따라 신호가 옷을 갈아입는다」 표(v1.3.1) — 08-03에 이 표에도 낡은 6.5·17.0이 남아 있었다.
  ['| 다크 배경 신호(글자·면 모두) |', '#0F1730', '#FF6B5C', '§11 갈아입기표 — 다크 신호'],
  ['| 라이트 배경 **강조 글자**(대형) |', '#FBF7EE', '#E8543F', '§11 갈아입기표 — 라이트 강조 글자'],
  ['| 라이트 배경 본문 |', '#FBF7EE', '#171820', '§11 갈아입기표 — 라이트 본문'],
  ['그럼 밝은 배경에서 무엇으로 강조하는가', '#FBF7EE', '#E8543F', '§11 서술 — Coral 3 도입 근거'],
  ['그 자리에 Coral을 그대로 넣으면 대비가', '#FBF7EE', '#FF6B5C', '§11 서술 — 기계적 치환 사고 경고'],
  // 조항 ⓒ(v1.7) — Coral 3 강조 글자의 라이트 바닥 한정. 통과 3바닥과 미달 3바닥을 전부 건다.
  ['Coral 3 강조 글자의 바닥은', '#FBF7EE', '#E8543F', '§11 조항 ⓒ — Paper 바닥 통과 근거'],
  ['Coral 3 강조 글자의 바닥은', '#F6F1E8', '#E8543F', '§11 조항 ⓒ — Cream 바닥 통과 근거'],
  ['Coral 3 강조 글자의 바닥은', '#FFE9E4', '#E8543F', '§11 조항 ⓒ — Wash 바닥 통과 근거'],
  ['Coral 3 강조 글자의 바닥은', '#EFE7D7', '#E8543F', '§11 조항 ⓒ — Cream 2 바닥 미달 근거'],
  ['Coral 3 강조 글자의 바닥은', '#E7DDC7', '#E8543F', '§11 조항 ⓒ — Cream 3 바닥 미달 근거'],
  ['Coral 3 강조 글자의 바닥은', '#FFCFC6', '#E8543F', '§11 조항 ⓒ — Soft 바닥 미달 근거'],
  // 조항 ⓓ(v1.7) — 다크 대비는 Navy 2 기준. 밝은 다크 바닥(Navy·Navy 3) 실측 4칸을 건다.
  ['Navy 3 바닥에서 Coral 본문', '#2A3358', '#FF6B5C', '§11 조항 ⓓ — Navy 3 위 Coral 본문 미달 근거'],
  ['Navy 3 바닥에서 Coral 본문', '#1A2340', '#FF6B5C', '§11 조항 ⓓ — Navy 위 Coral 통과 근거'],
  ['Navy 3 바닥에서 Coral 본문', '#1A2340', '#E8543F', '§11 조항 ⓓ — Navy 위 Coral 3 대형 근거'],
  ['Navy 3 바닥에서 Coral 본문', '#2A3358', '#E8543F', '§11 조항 ⓓ — Navy 3 위 Coral 3 대형 근거'],
];

const lineWith = (anchor) => CANON_SRC.split(/\r?\n/).find((l) => l.includes(anchor));
const numbersIn = (line) => (line.match(/\d+\.\d+/g) || []).map(Number);

for (const [anchor, bg, fg, where] of DOC_CLAIMS) {
  test(`정본이 적은 대비가 실제 계산과 맞다 — ${where}`, () => {
    const line = lineWith(anchor);
    assert.ok(line, `정본에서 앵커 「${anchor}」를 못 찾았다 (${where}) — 문서가 개편됐으면 앵커를 갱신하라`);
    const actual = contrast(bg, fg);
    const found = numbersIn(line).filter((n) => Math.abs(n - actual) <= 0.05);
    assert.ok(
      found.length > 0,
      `${where}: ${bg}/${fg}의 실제 대비는 ${actual.toFixed(2)}인데 정본 줄에 그 숫자가 없다.\n` +
        `  줄에 적힌 숫자: [${numbersIn(line).join(', ')}]\n` +
        `  줄: ${line.trim().slice(0, 160)}\n` +
        `  색을 바꿨다면 이 줄의 수치를, 수치를 고쳤다면 색을 함께 맞춰라 — 접근성 조항의 근거가 이 숫자다.`
    );
  });
}

/* ─── 5b. 파생 색표(발표물/_브랜드킷.md)의 대비 수치 자기검증 ──────────────── */
/* [2026-08-09] ③ 색표 정리 — 킷 표의 대비 칸 중 세 값(14.46·11.47·13.13)은 정본 측정표에
 * 없는 킷 고유 쌍이라 **어느 검사도 안 지키는 고아**였다(문서압축 ② 반박 잔여 부채).
 * 값을 정본으로 옮겨 사본을 늘리는 대신, 같은 방식(문서에서 숫자를 꺼내 재계산과 대조)으로
 * 파생 표의 전 칸을 건다 — hex 를 바꾸면 여기 수치가 깨지고, 수치만 고치면 hex 와 어긋난다. */
const KIT_DOC = path.join(ROOT, 'docs', '발표물', '_브랜드킷.md');
const KIT_SRC = fs.readFileSync(KIT_DOC, 'utf8');

/* 2026-08-20 조항 ⓙ — Paper·Ink·코랄 축의 값이 갈렸다: 라이트 바탕 #FBF7F0 · Coral #F96859 ·
 * Coral 3 #AE322A. 표(문서)와 이 목록은 같은 커밋에서 움직인다 — 한쪽만 고치면 여기가 빨개진다. */
const KIT_CLAIMS = [
  ['| 잉크 | Graphite 3 |', '#FBF7F0', '#262626', '킷 §1 색표 — Graphite 3/Paper'],
  ['| 보조 잉크·괘선 | Graphite 4 |', '#FBF7F0', '#373737', '킷 §1 색표 — Graphite 4/Paper'],
  ['| 반전면 잉크 | Chalk |', '#08090C', '#E4E4E7', '킷 §1 색표 — Chalk/Graphite'],
  ['| 반전면 보조 | Chalk 3 |', '#08090C', '#D1D2D4', '킷 §1 색표 — Chalk 3/Graphite (고아였던 13.13)'],
  ['| **신호** | **Coral** |', '#08090C', '#F96859', '킷 §1 색표 — Coral 다크'],
  ['| **신호** | **Coral** |', '#FBF7F0', '#F96859', '킷 §1 색표 — Coral 라이트(면만 근거)'],
  ['| 신호 — 라이트 글자 | Coral 3 |', '#FBF7F0', '#AE322A', '킷 §1 색표 — Coral 3 라이트'],
  ['| Chalk `#E4E4E7` |', '#08090C', '#E4E4E7', '킷 §3 실측표 — Chalk 다크'],
  ['| Chalk `#E4E4E7` |', '#FBF7F0', '#E4E4E7', '킷 §3 실측표 — Chalk 라이트(사라짐 근거)'],
  ['| Coral `#F96859` |', '#08090C', '#F96859', '킷 §3 실측표 — Coral 다크'],
  ['| Coral `#F96859` |', '#FBF7F0', '#F96859', '킷 §3 실측표 — Coral 라이트'],
  ['| Coral 3 `#AE322A` |', '#08090C', '#AE322A', '킷 §3 실측표 — Coral 3 다크'],
  ['| Coral 3 `#AE322A` |', '#FBF7F0', '#AE322A', '킷 §3 실측표 — Coral 3 라이트'],
  ['| Graphite 3 `#262626` |', '#08090C', '#262626', '킷 §3 실측표 — Graphite 3 다크(묻힘 근거)'],
  ['| Graphite 3 `#262626` |', '#FBF7F0', '#262626', '킷 §3 실측표 — Graphite 3 라이트'],
  ['| Graphite 4 `#373737` |', '#08090C', '#373737', '킷 §3 실측표 — Graphite 4 다크(묻힘 근거)'],
  ['| Graphite 4 `#373737` |', '#FBF7F0', '#373737', '킷 §3 실측표 — Graphite 4 라이트'],
];

const kitLineWith = (anchor) => KIT_SRC.split(/\r?\n/).find((l) => l.includes(anchor));

for (const [anchor, bg, fg, where] of KIT_CLAIMS) {
  test(`킷 색표가 적은 대비가 실제 계산과 맞다 — ${where}`, () => {
    const line = kitLineWith(anchor);
    assert.ok(line, `_브랜드킷.md에서 앵커 「${anchor}」를 못 찾았다 (${where}) — 표가 개편됐으면 앵커를 갱신하라`);
    const actual = contrast(bg, fg);
    const found = numbersIn(line).filter((n) => Math.abs(n - actual) <= 0.05);
    assert.ok(
      found.length > 0,
      `${where}: ${bg}/${fg}의 실제 대비는 ${actual.toFixed(2)}인데 킷 표 줄에 그 숫자가 없다.\n` +
        `  줄에 적힌 숫자: [${numbersIn(line).join(', ')}]\n` +
        `  줄: ${line.trim().slice(0, 160)}\n` +
        `  색을 바꿨다면(원천 = 디자인_토큰.json) 이 표의 수치를, 수치를 고쳤다면 색을 함께 맞춰라.`
    );
  });
}

/* 낡은 수치의 부활 차단 — 정본이 같은 값을 네 곳에 적으므로, 한 곳만 고치고 나머지를 놓치는 것이
 * 이 문서의 고질적 실패 방식이다(08-03에 실제로 그 상태였다). 폐기된 수치의 등장 횟수를 동결한다.
 * 현재 허용분 = v1.6.1 정정 서술과 개정 이력에서 「예전엔 이렇게 적혀 있었다」로 인용하는 것뿐. */
/* 개정 이력은 append-only 산문이라 「예전엔 이렇게 적혀 있었다」가 계속 쌓인다 — 검사에서 뺀다.
 * 정책 대상은 **살아 있는 본문**뿐이다. */
const CANON_BODY = CANON_SRC.split('## 개정 이력')[0];
const STALE_NUMBERS = { '6.5': 3, '16.1': 1, '17.0': 1 };
test('정본 본문에서 폐기된 대비 수치가 되살아나지 않았다', () => {
  for (const [num, known] of Object.entries(STALE_NUMBERS)) {
    // 숫자 경계 필수 — 이걸 빠뜨리면 「6.5」가 정정된 값 「16.53」 안에서 매치돼
    // 가드가 자기가 고친 것을 위반으로 신고한다(초판이 실제로 그랬다).
    const n = (CANON_BODY.match(new RegExp(`(?<!\\d)${num.replace('.', '\\.')}(?!\\d)`, 'g')) || []).length;
    assert.ok(
      n <= known,
      `정본 본문에 낡은 수치 「${num}」가 ${n}번 — 허용은 ${known}번(v1.6.1 정정 주석의 인용)뿐이다.\n` +
        `  v1.3의 잘못된 측정값이 어딘가로 되돌아왔는지 확인하라. 정확한 값 = ` +
        `Cream/다크 ${contrast('#0F1730', '#F6F1E8').toFixed(2)} · Coral/다크 ${contrast('#0F1730', '#FF6B5C').toFixed(2)} · Ink/라이트 ${contrast('#FBF7EE', '#171820').toFixed(2)}`
    );
  }
});

/* 가드의 가드 — 대비 공식이 조용히 망가지면 위 13건이 **전부 통과하면서** 아무것도 안 지킨다.
 * memory `guard-must-check-result`의 반복 함정(정규식 하나 잘못돼 검사가 통째로 죽어 있었다).
 * WCAG 정의상 흰/검은 정확히 21, 같은 색끼리는 정확히 1이다 — 이 두 앵커가 식 전체를 고정한다. */
test('대비 공식이 살아 있다(WCAG 앵커 — 이게 깨지면 아래 검사가 전부 무의미)', () => {
  assert.equal(Number(contrast('#FFFFFF', '#000000').toFixed(4)), 21, '흰/검 대비가 21이 아니다 — 휘도 식이 망가졌다');
  assert.equal(Number(contrast('#FF6B5C', '#FF6B5C').toFixed(4)), 1, '같은 색 대비가 1이 아니다 — 휘도 식이 망가졌다');
  assert.ok(contrast('#0F1730', '#F6F1E8') > contrast('#0F1730', '#FF6B5C'), '밝은 잉크가 신호색보다 대비가 낮게 나온다 — 식이 뒤집혔다');
});

test('코랄은 라이트 배경 글자 기준을 「크기와 무관하게」 미달한다(조항의 물리적 근거)', () => {
  const c = contrast('#FBF7EE', '#FF6B5C');
  assert.ok(c < 3.0, `Paper 위 Coral 대비가 ${c.toFixed(2)}로 대형 기준 3.0을 넘었다 — 정본 조항의 전제가 바뀌었다`);
  assert.ok(contrast('#FBF7EE', '#E8543F') >= 3.0, 'Coral 3가 대형 기준 3.0에 미달 — 라이트 강조 글자 자리가 비어버린다');
  assert.ok(contrast('#FF6B5C', '#171820') >= 4.5, '코랄 면 위 Ink가 본문 기준 미달 — 조항 ⓐ가 무너진다');
});

/* ─── 6. 핵심 조항이 정본에서 사라지지 않았다 ───────────────────────────── */
/* 압축·개정 중에 「없어도 읽히는」 조항이 먼저 잘려나간다. 근데 잘리면 그 자리가 바로 오용된다. */
test('정본에 하중을 받는 조항이 남아 있다', () => {
  assert.ok(fs.existsSync(CANON), 'docs/디자인_컨셉_정본_v1.md가 없다 — 디자인 규칙의 정본이다');
  const src = fs.readFileSync(CANON, 'utf8');
  const MUST = [
    ['#E8543F', '라이트 강조 글자 Coral 3 — 없으면 Coral로 쓰게 된다'],
    ['#FFD447', 'KC Sun 모드 C 2도 잉크(v1.5) — 없으면 쿨블루로 되돌아가 겹침이 보라가 된다'],
    ['#0F1730', 'Navy 2 다크 바탕 — 코랄 면 위 허용 글자색이기도 하다'],
    ['#C8FF3D', 'Lime 성장·획득 시맨틱(v1.6)'],
    ['크기와 무관하게', '「크게 쓰면 괜찮다」 오독을 막는 문구 — v1.3.1에서 이 문구가 없어 실제 결함이 났다'],
  ];
  for (const [needle, why] of MUST) {
    assert.ok(src.includes(needle), `정본에서 「${needle}」가 사라졌다 — ${why}`);
  }
});

/* ─── 6-b. Canva 대조기가 낡지 않았다 ────────────────────────────────────── */
/* Canva는 repo 테스트가 볼 수 없는 유일한 적용면이다(브라우저 밖에서 읽을 방법이 없다).
 * 그래서 「붙여넣어 실행하는 대조기」를 두되, **그 대조기의 기대값이 정본과 어긋나는 것**을 여기서 막는다.
 * 검증기가 조용히 낡으면 「검증했다」는 초록불만 남고 실제로는 아무것도 안 지킨다 —
 * 없는 것보다 위험하다(memory `guard-must-check-result`). */
const CANVA_CHECKER = path.join(ROOT, 'docs', 'tools', 'canva_키트_검증.js');

test(`Canva 대조기가 키트 ${킷개수}색을 그대로 담고 있다`, () => {
  assert.ok(fs.existsSync(CANVA_CHECKER), 'docs/tools/canva_키트_검증.js가 없다 — Canva 점검의 유일한 자동화 수단이다');
  const src = fs.readFileSync(CANVA_CHECKER, 'utf8');
  const inChecker = new Set((src.match(/'#[0-9a-fA-F]{6}'\s*:/g) || []).map((s) => s.slice(1, 8).toLowerCase()));
  for (const hex of Object.keys(KIT)) {
    assert.ok(inChecker.has(hex.toLowerCase()), `대조기에 ${KIT[hex]} ${hex}가 빠졌다 — 그 색의 드리프트를 영영 못 잡는다`);
  }
  assert.equal(inChecker.size, 킷개수, `대조기가 ${inChecker.size}색을 담고 있다 — 키트는 ${킷개수}색이다`);
});

test('Canva 대조기가 v1.5 이전의 「Part 6 only」 팔레트 이름을 기대하지 않는다', () => {
  const src = fs.readFileSync(CANVA_CHECKER, 'utf8');
  const expected = src.match(/'05 K-Culture[^']*'/g) || [];
  assert.ok(expected.length > 0, '대조기에 05 K-Culture 팔레트 기대값이 없다');
  // 주석의 설명 인용은 세지 않는다 — 기대값 배열에 든 문자열만 본다
  for (const e of expected) {
    assert.ok(
      !/Part 6 only/.test(e),
      `대조기가 낡은 팔레트 이름을 기대하고 있다: ${e}\n` +
        `  v1.5에서 KC Sun이 모드 C 2도 잉크로 빠져 「Part 6 only」는 그 색에 대해 거짓이다.`
    );
  }
});

/* ─── 6-c. 대조기를 **실제로 돌려본다** ────────────────────────────────────
 * 6-b 는 소스에 hex 가 들어 있는지만 본다 — 그건 대조기의 **자료**지 **판정**이 아니다.
 * v1.10 에서 실측된 구멍: KIT 에 Emerald 를 넣었는데 개수 비교는 `!== 22` 인 채였다.
 * 6-b 는 초록인데 올바른 키트를 보고 빨간불이 났을 것이다 — 등록을 증명할 유일한 도구가
 * 거짓 적색을 내면 사람은 되레 등록이 잘못됐다고 믿는다.
 * 그래서 여기서는 **정본대로 등록된 화면을 넣고 초록이 나오는지**를 본다(memory `guard-must-check-result`). */
const vm = require('node:vm');

function 대조기실행(스와치들, 잎들) {
  const ctx = {
    console: { log() {} },
    document: {
      querySelectorAll(sel) {
        if (sel === '[aria-label]') return 스와치들.map((h) => ({ getAttribute: () => h }));
        return 잎들.map((t) => ({ childElementCount: 0, textContent: t }));
      },
    },
  };
  return vm.runInNewContext(fs.readFileSync(CANVA_CHECKER, 'utf8'), ctx);
}

/* 화면의 텍스트(팔레트·색 이름)는 대조기 자신의 기대값에서 뽑는다 — 그쪽은 6-b·6-b'가 따로 잠근다.
 * 여기서 비순환으로 검사하는 것은 **hex 목록(정본 토큰)과 개수 판정**이다. */
function 정본화면_잎() {
  const src = fs.readFileSync(CANVA_CHECKER, 'utf8');
  const 배열 = src.slice(src.indexOf('const PALETTES'), src.indexOf('const leaves'));
  return (배열.match(/'((?:[^'\\]|\\.)*)'/g) || []).map((s) => s.slice(1, -1));
}

test('대조기: 정본대로 등록된 화면이면 초록이다 (개수를 손으로 적으면 여기서 깨진다)', () => {
  const 결과 = 대조기실행(Object.keys(KIT).map((h) => h.toLowerCase()), 정본화면_잎());
  assert.deepEqual(결과, 'PASS', `정본 ${킷개수}색을 그대로 넣었는데 대조기가 문제를 냈다 — 대조기 쪽이 낡았다`);
});

test('대조기: 색 하나가 빠지면 잡는다 (탐지력 픽스처)', () => {
  const 일부 = Object.keys(KIT).map((h) => h.toLowerCase()).slice(1);
  const 결과 = 대조기실행(일부, 정본화면_잎());
  assert.ok(Array.isArray(결과) && 결과.some((p) => p.startsWith('빠진 색:')),
    `색을 하나 빼도 대조기가 통과시켰다 — 탐지력이 죽었다: ${JSON.stringify(결과)}`);
});

/* ─── 7. 정본이 가리키는 파일이 실제로 있다 ─────────────────────────────── */
/* 08-03에 낡은 서술 2건이 발견된 계열의 결함 — 문서가 없는 파일을 가리키면 그 지시는 조용히 죽는다. */
test('정본·키트가 가리키는 파일이 실재한다', () => {
  const MUST_EXIST = [
    'docs/디자인_컨셉_정본_v1.md',
    'docs/브랜드_폰트_정본.md',
    'docs/_archive/브랜드_색상키트_원본_CrewDossier_2026-08-01.html',
    'docs/tools/synk_palette.html',
    'docs/tools/synk_field_generator.html',
  ];
  for (const rel of MUST_EXIST) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `정본이 가리키는 ${rel}가 없다 — 참조가 끊겼다`);
  }
});
