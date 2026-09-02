/* 브랜드 폰트 3종 잠금 — 2026-08-01 유호님 확정(SUIT Variable · Inter Tight · DM Mono).
 *
 * ══ 다시 세운 자다 (2026-09-03 · 유호 지시 「브랜드폰트 시험 다시 세워줘」) ═══
 *   이 파일은 2026-08-19 대청소(e75fc7fc · 테스트 237→9)에 걷혔다. 그런데 정본 문서 §9 는
 *   그 뒤로도 「있다 · 스택 구성·순서·CARD_WEBFONT 동반을 기계 검사한다」고 적고 있었다.
 *   🔴 **적힌 장치와 실물이 갈린 채 15일**이었고, 그 사이 값을 실제로 잃었다:
 *      09-03 에 「스택에 SUIT 를 적어 놓고 웹폰트를 한 번도 안 부르는」 지면이 **42벌** 나왔다.
 *      옛 판의 「쓴 폰트를 실제로 로드한다」 검사가 살아 있었으면 그날 태어날 때 잡혔다 —
 *      실제로 그 검사는 개인정보처리방침 지면에서 같은 결함을 한 번 잡은 이력이 있다(08-05).
 *   ⇒ 교훈은 「자를 지우지 마라」가 아니라 **「자를 지우면 그 자를 말하는 문서도 같이 고쳐라」**다.
 *      안 그러면 다음 사람이 「기계가 막고 있다」를 믿고 안 본다.
 *
 * ══ 무엇을 재나 — 「선언」이 아니라 «적용된 결과» ═════════════════════════
 *   font-family 에 'SUIT Variable' 이라고 써 두고 로드를 빠뜨리면 화면은 조용히 시스템 고딕으로
 *   내려앉는다. 에러도 안 나고 눈으로도 잘 안 보인다. 그래서 **이름과 로드를 함께** 본다.
 *
 * ══ 옆 자와 겹치지 않게 갈랐다 (한 판정엔 자 하나) ═══════════════════════
 *   · `tests/지면폰트.test.js` = **SUIT 를 어디서 받아오나**(아티팩트 CSP·인라인) · 분모 = 추적 HTML 전량
 *   · 이 파일               = **3종만 쓰나 · 순서가 맞나 · 폐기가 안 돌아오나 · Inter Tight 로드 · Code.js 카드**
 *     분모 = 등록층(`tools/브랜드렌더린트.js` 의 `대상` + `docs/tools/*.html`)
 *   ⇒ SUIT «로드» 는 저쪽 ⑦ 이 전량으로 잰다. 여기서는 등록층 안에서만 겹쳐 본다(둘 다 있어야
 *     새 지면과 대외 지면 양쪽이 덮인다) — 판정 규칙은 `tools/lib/브랜드폰트.js` 하나에서 온다.
 *
 * 정본 = docs/브랜드_폰트_정본.md
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');
const 브랜드폰트 = require(path.join(ROOT, 'tools', 'lib', '브랜드폰트.js'));
const TOOLS = path.join(ROOT, 'docs', 'tools');

/* 폰트 후보를 나란히 세워 비교하는 실측 도구 — 3종 밖(폐기 포함) 폰트가 있는 게 목적이라
 * 「폐기 폰트 등장 금지」 검사만 면제한다. 면제는 면제 사유가 있는 검사에만 건다(v9.135). */
const EXEMPT = new Set([
  '_mn_font_probe.html',
  // 구 V9 재현 비교 도구 — 폰트 의도적 동결. 폐기 폰트는 「비교 변수를 색으로 고정」하기 위한
  // 동결이라 검사 대상이 아니다(색만 V9↔v10 토글 · 대외 산출물 아님).
  '트렌디미니멀_색전환_비교.html',
]);

/* 「로드했나」를 면제하는 자리 — **자리표 통로**가 빌드 때 채운다. 사유 없는 면제는 안 받는다. */
const 로드_면제 = new Map([
  ['OG카드_마스터.html', '`/*@FONTS@*/` 자리표를 `python docs/tools/브랜드폰트_임베드.py` 가 채운다. '
    + '이 파일은 「빌드 전 미리보기」 마스터이고 최종 픽셀은 임베드된 폰트가 낸다(머리 주석에 그렇게 적혀 있다).'],
]);

/* 폐기된 구 지정. 이름만 남아 있어도 복붙으로 번지므로 등장 자체를 막는다. */
const RETIRED = ['Pretendard', 'Noto Sans KR', 'KoPubWorld', 'Nanum', '맑은 고딕'];

const fontDecls = (src) => [
  ...(src.match(/font-family\s*:[^;}]+/g) || []),
  ...(src.match(/--[\w-]*(?:font|serif|sans|mono)[\w-]*\s*:[^;}]+/g) || []),
];

/* 주석은 렌더에 안 나온다 — 정책 대상은 «살아 있는 지정»뿐이다.
 * 08-05 실측: 등록층을 넓히자마자 5파일이 빨개졌는데 원인이 전부 「구 지정은 Pretendard 였다」
 * 처럼 **적어 둔 문장**이었다. 즉 폐기를 기록한 행위가 위반으로 잡혔다. 가드가 실작업을 벌주면
 * 사람이 가드를 끈다. */
const stripComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // `https://` 를 주석으로 오인하지 않도록 앞 문자 확인

/* 🔑 `local()` 안의 이름은 «채택»이 아니다 — 그 기계에 이미 깔린 폰트를 빌려 쓰는 자리다.
 * 낫표 「 」 교정(유호 확정 08-31)이 정확히 그 모양이다:
 *   @font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),…,local('Noto Sans KR');unicode-range:U+300C-300D;}
 * 정본이 「`SYNK Bracket` 은 넷째 브랜드 폰트가 아니다 — 두 글자만 잡는 자리」라고 못박는다(§2).
 * ⚠ 이 한 줄이 없으면 낫표 교정이 실린 지면 **전량**이 「폐기 폰트」로 빨개진다(09-03 실측 36건).
 *   그 적색은 08-31 에 유호님이 확정한 것을 벌주는 것이라 곧 꺼진다. */
const stripLocal = (src) => src.replace(/local\(\s*['"][^'")]*['"]\s*\)/g, '');

const 살아있는지정 = (src) => stripLocal(stripComments(src));

/* 목록은 여기 새로 적지 않고 `tools/브랜드렌더린트.js` 의 `대상` 하나에서 파생시킨다.
 * 08-04 감사가 밝힌 것: 이 가드가 초록이었던 건 맞아서가 아니라 **그 파일들을 안 봤기 때문**이다. */
const { 대상: RENDER_TARGETS } = require('../tools/브랜드렌더린트');

/* [표시이름, 절대경로] — docs/tools 는 파일명만, 등록층은 상대경로를 그대로 보여준다. */
const htmlTargets = [
  ...(fs.existsSync(TOOLS) ? fs.readdirSync(TOOLS).filter((f) => f.endsWith('.html')) : [])
    .map((f) => [f, path.join(TOOLS, f)]),
  ...RENDER_TARGETS.map((rel) => [rel, path.join(ROOT, rel)]),
].filter(([, abs]) => fs.existsSync(abs));

/* ── 분모가 조용히 0 이 되는 것을 막는다 ─────────────────────────────────── */

test('폰트 지정 산출물이 최소 1개는 검사된다(스캔이 조용히 0건이 되는 것 방지)', () => {
  assert.ok(htmlTargets.filter(([f]) => !EXEMPT.has(f)).length > 0, 'docs/tools/*.html 을 하나도 못 찾았다 — 경로가 바뀌었는지 확인');
  assert.ok(htmlTargets.length > RENDER_TARGETS.length, '등록층만 잡히고 docs/tools 가 안 잡혔다 — 경로 확인');
});

for (const [f, abs] of htmlTargets) {
  const src = fs.readFileSync(abs, 'utf8');

  if (!EXEMPT.has(f)) test(`${f} — 폐기된 구 폰트를 쓰지 않는다`, () => {
    const live = 살아있는지정(src);
    for (const bad of RETIRED) {
      assert.ok(
        !live.includes(bad),
        `${f} 에 폐기 폰트 「${bad}」가 남아 있다. 정본 docs/브랜드_폰트_정본.md 의 3종만 쓴다.\n`
        + '  (주석과 `local()` 별칭은 이미 뺐다 — 여기 걸렸다면 «살아 있는 지정»이다)'
      );
    }
  });

  test(`${f} — 스택 순서: Inter Tight 가 SUIT Variable 보다 앞`, () => {
    if (!src.includes('SUIT Variable')) return; // 한글을 안 쓰는 산출물은 해당 없음
    for (const decl of fontDecls(src)) {
      if (!decl.includes('SUIT Variable') || !decl.includes('Inter Tight')) continue;
      assert.ok(
        decl.indexOf('Inter Tight') < decl.indexOf('SUIT Variable'),
        `${f}: SUIT 가 Inter Tight 보다 앞에 있다 → SUIT 의 라틴 자형이 먼저 잡혀 몽골어·영문이 `
        + `Inter Tight 로 안 간다. 폴백은 글리프 단위라 순서가 곧 언어 배분이다.\n  ${decl.trim()}`
      );
    }
  });

  /* 「적용된 결과」 검사 — 이름을 썼으면 실제로 불러와야 한다.
   * 🔑 로드의 «모양이 셋»이다(09-03 에 하나 늘었다):
   *   ⓐ 지면 «안»에 심음 — data URI(`tools/lib/브랜드폰트.js` · 09-03 신설 · 아티팩트 CSP 때문)
   *   ⓑ 바깥 CDN — 제외 갈래(Glide 카드·크루카드·로컬 계기)가 아직 쓴다
   *   ⓒ 빌드가 심은 @font-face 여러 벌 — 발표물·인쇄 통로(`브랜드폰트_임베드.py`)
   * 셋 중 하나면 «불렀다». ⓐ만 인정하면 라이브 폼이, ⓑ만 인정하면 오늘 심은 87벌이 빨개진다. */
  test(`${f} — 쓴 폰트를 실제로 로드한다(선언만 하고 폴백되는 것 방지)`, () => {
    const 면제 = 로드_면제.get(f);
    if (src.includes('SUIT')) {
      const 실렸나 = 브랜드폰트.심겼나(src)                       // ⓐ 지면 안
        || /sun-typeface\/SUIT/.test(src)                         // ⓑ 바깥 CDN
        || /@font-face[^}]*font-family\s*:\s*['"]SUIT/i.test(src); // ⓒ 빌드 임베드
      assert.ok(실렸나 || 면제,
        `${f}: SUIT 를 쓰면서 어디서도 안 불렀다 → 한글이 조용히 시스템 고딕으로 내려앉는다.\n`
        + '  → 심는다: node tools/lib/브랜드폰트.js --심기 ' + JSON.stringify(path.relative(ROOT, abs).replace(/\\/g, '/'))
        + '\n  → 빌드가 심어 주는 자리면 이 파일의 `로드_면제` 에 **사유와 함께** 넣는다.');
    }
    if (src.includes('Inter Tight')) {
      const 실렸나 = /Inter\+Tight/.test(src)                            // Google Fonts
        || /@font-face[^}]*font-family\s*:\s*['"]Inter Tight/i.test(src); // 빌드 임베드
      assert.ok(실렸나 || 면제,
        `${f}: 'Inter Tight' 를 쓰면서 웹폰트를 안 불렀다 → 영문·몽골어가 폴백된다.\n`
        + '  (SUIT 에는 키릴이 한 글자도 없다 — 몽골어는 Inter Tight 가 없으면 갈 곳이 시스템 폰트뿐이다)');
    }
  });
}

/* DM Mono 엔 키릴·한글 글리프가 아예 없다(08-01 google/fonts METADATA.pb 실검증:
 * 서브셋이 latin·latin-ext 뿐). 몽골어를 넣으면 통째로 다른 폰트로 폴백돼 워드마크가 무너진다. */
test('DM Mono 를 쓰는 파일은 한글·키릴을 같은 지정에 섞지 않는다', () => {
  for (const [f, abs] of htmlTargets) {
    const src = fs.readFileSync(abs, 'utf8');
    for (const decl of fontDecls(src)) {
      if (!decl.includes('DM Mono')) continue;
      assert.ok(
        !decl.includes('SUIT Variable'),
        `${f}: DM Mono 스택에 SUIT 가 섞였다 — DM Mono 는 로마자·숫자·기호 전용이다.\n  ${decl.trim()}`
      );
    }
  }
});

/* ⚠ 위 검사는 전부 **블랙리스트**다 — 폐기 5종이 돌아오는 건 막지만 **3종 밖 새 폰트**
 *   (Montserrat·Poppins 등)가 들어오는 건 통과시킨다. 정본 금칙 4 는 「3종만 쓴다」인데
 *   기계는 「구 3종만 안 쓴다」를 재고 있었다 — 둘은 다른 규칙이다. 그래서 화이트리스트로 잠근다.
 * 목록은 `tools/브랜드렌더린트.js` 하나에서 파생시킨다 — 두 곳에 적었더니 실제로 갈라져 있었다. */
const { FONTS_OK: BRAND_FAMILIES, KC_FONTS_OK } = require('../tools/브랜드렌더린트');
const SYSTEM_FALLBACKS = [
  'system-ui', 'ui-monospace', '-apple-system', 'BlinkMacSystemFont',
  'sans-serif', 'serif', 'monospace', 'cursive',
  'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Helvetica Neue', 'Helvetica', 'Arial',
  'Consolas', 'SFMono-Regular', 'Menlo', 'Monaco', 'Courier New', 'inherit', 'initial', 'unset',
];
const ALLOWED_FAMILIES = new Set([...BRAND_FAMILIES, ...SYSTEM_FALLBACKS].map((s) => s.toLowerCase()));

/* Part 06 K-Culture 예약 서체 — 정본 §4-1 의 유일한 예외(유호님 08-05 확정).
 * 🔑 예외의 무게는 **경계**에 있다: 이름만 허용 목록에 얹으면 예외가 저장소 전체로 샌다.
 *   소스 층에서 잴 수 있는 경계는 「`--kc-*` 선언 안인가」다. */
const KC_ALLOWED = new Set(KC_FONTS_OK.map((s) => s.toLowerCase()));
const isKcDecl = (decl) => /^\s*--kc-/.test(decl);

test('3종 밖 폰트가 새로 들어오지 않는다(화이트리스트 — 블랙리스트로는 못 막는다)', () => {
  const violations = [];
  for (const [f, abs] of htmlTargets) {
    if (EXEMPT.has(f)) continue; // 비교 도구는 3종 밖 폰트가 있는 것이 목적
    const src = 살아있는지정(fs.readFileSync(abs, 'utf8'));
    for (const decl of fontDecls(src)) {
      for (const token of decl.replace(/^font-family\s*:/, '').split(',')) {
        const name = token.trim().replace(/^["']|["']$/g, '').trim();
        // HTML 이 섞여 들어온 파싱 부스러기는 폰트 이름이 아니다 — 폰트명은 라틴·숫자·하이픈·공백뿐
        if (!name || !/^[-A-Za-z0-9 ]+$/.test(name)) continue;
        if (ALLOWED_FAMILIES.has(name.toLowerCase())) continue;
        if (isKcDecl(decl) && KC_ALLOWED.has(name.toLowerCase())) continue; // Part 06 예약 — 그 통로 안에서만
        violations.push(`${f}: 「${name}」`);
      }
    }
  }
  assert.equal(
    violations.length, 0,
    `정본 3종·시스템 폴백 밖의 폰트가 지정됐다:\n  ${violations.join('\n  ')}\n`
    + 'SYNK 가 쓰는 서체는 SUIT Variable(한글)·Inter Tight(라틴+몽골 키릴)·DM Mono(워드마크·라벨)뿐이다.\n'
    + '새 서체를 정말 도입한다면 정본 docs/브랜드_폰트_정본.md 개정이 먼저이고, '
    + '키릴 몽골 고유자 「ө·ү」 실측(도구 docs/tools/_mn_font_probe.html)이 필수다.'
  );
});

/* HTML 만 검사하면 빈틈이 남는다 — 앱 카드 폰트는 Code.js 안의 문자열이고, 콘텐츠 파일도 마찬가지다. */
const JS_TARGETS = [...require('./_engine-source').ENGINE_FILES, '상담AI.js', '교재연동.js', '만족도팩.js']
  .concat(fs.readdirSync(ROOT).filter((f) => /^contents_.*\.js$/.test(f)));

test('JS 산출물에 폐기 폰트가 새로 들어오지 않는다', () => {
  const hits = [];
  for (const f of JS_TARGETS) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    src.split(/\r?\n/).forEach((line, i) => {
      if (!/font-family\s*:/.test(line)) return; // 주석 속 언급은 세지 않는다 — 실제 지정만
      const live = stripLocal(line);
      for (const bad of RETIRED) {
        if (live.includes(bad)) hits.push(`${f}:${i + 1} 「${bad}」`);
      }
    });
  }
  assert.equal(hits.length, 0,
    `JS 에 폐기 폰트 지정이 ${hits.length}건 — 알려진 잔여는 0건이다(CARD_FONT 교체 완료 08-01).\n  `
    + hits.join('\n  ') + '\n정본 docs/브랜드_폰트_정본.md 의 3종만 쓴다.');
});

test('브랜드 폰트 정본 문서가 존재한다', () => {
  const doc = path.join(ROOT, 'docs', '브랜드_폰트_정본.md');
  assert.ok(fs.existsSync(doc), 'docs/브랜드_폰트_정본.md 가 없다 — 3종 규칙의 정본이다');
  const src = fs.readFileSync(doc, 'utf8');
  for (const fam of ['SUIT Variable', 'Inter Tight', 'DM Mono']) {
    assert.ok(src.includes(fam), `정본에 「${fam}」 항목이 없다`);
  }
  /* 🔴 이 파일이 지워졌던 15일 동안 정본은 「기계가 검사한다」고 말하고 있었다.
   *    적힌 장치와 실물이 갈리면 다음 사람이 그 말을 믿고 안 본다 — 그 자리를 여기서 문다. */
  assert.ok(src.includes('tests/브랜드폰트.test.js'),
    '정본이 이 자를 안 가리킨다 — 자와 문서가 갈리면 「기계가 막는다」가 거짓이 된다');
});

test('Code.js CARD_FONT 가 브랜드 3종을 쓴다', () => {
  const src = engineSource();
  const m = src.match(/const CARD_FONT = "([^"]+)"/);
  assert.ok(m, 'Code.js 에서 CARD_FONT 상수를 못 찾았다');
  const decl = stripLocal(m[1]);
  for (const bad of RETIRED) assert.ok(!decl.includes(bad), `CARD_FONT 에 폐기 폰트 「${bad}」`);
  assert.ok(decl.includes('Inter Tight') && decl.includes('SUIT Variable'), 'CARD_FONT 가 3종 스택이 아니다');
  assert.ok(
    decl.indexOf('Inter Tight') < decl.indexOf('SUIT Variable'),
    'CARD_FONT 스택 순서가 뒤집혔다 — Inter Tight 가 앞'
  );
});

/* 이 파일에서 가장 중요한 검사 — 「이름만 바꾸고 로드를 빠뜨리는」 실패를 막는다.
 * 학생 기기에 SUIT·Inter Tight 는 없다. 로드가 없으면 전 카드가 시스템 폰트로 조용히 내려앉는데,
 * 에러도 안 나고 화면도 그럴싸해서 사람 눈으로는 「적용됐다」와 구별이 안 된다.
 * ⚠ 여기는 **CDN 그대로**다 — 학생 폰이 여는 Glide 카드라 아티팩트 CSP 가 없고,
 *   610KB 를 39자리에 인라인하면 카드가 못 열린다(09-03 판정 · `tests/지면폰트.test.js` 제외 표). */
test('CARD_WEBFONT 가 두 웹폰트를 실제로 로드한다', () => {
  const src = engineSource();
  // `\r?\n` — CRLF 사본에서 `;\r\n` 이 되어 매치가 통째로 실패하던 것을 막는다(08-02).
  const m = src.match(/const CARD_WEBFONT = ([\s\S]*?);\r?\n/);
  assert.ok(m, 'CARD_WEBFONT 상수가 없다 — CARD_FONT 만 바꾸면 전 카드가 폴백된다(정본 §9)');
  const decl = m[1];
  assert.ok(/sun-typeface\/SUIT/.test(decl), 'CARD_WEBFONT 가 SUIT 를 안 부른다 → 한글이 폴백된다');
  assert.ok(/Inter\+Tight/.test(decl), 'CARD_WEBFONT 가 Inter Tight 를 안 부른다 → 영문·몽골어가 폴백된다');
  assert.ok(/<style>/.test(decl), 'CARD_WEBFONT 에 <style> 블록이 없다 — style 속성 값에는 @import 를 못 넣는다');
});

test('카드 루트마다 CARD_WEBFONT 가 붙어 있다', () => {
  const src = engineSource();
  const roots = src.match(/'<div style="' \+ CARD_FONT/g) || [];
  assert.ok(roots.length > 0, '카드 루트 패턴을 못 찾았다 — 렌더 구조가 바뀌었는지 확인');
  const loaded = src.match(/CARD_WEBFONT \+ '<div style="' \+ CARD_FONT/g) || [];
  assert.equal(
    loaded.length, roots.length,
    `카드 루트 ${roots.length}곳 중 ${loaded.length}곳에만 CARD_WEBFONT 가 붙었다 — `
    + '빠진 카드는 폰트가 폴백된다. 새 카드를 추가했다면 CARD_WEBFONT 를 앞에 붙여라'
  );
});

/* ── 탐지력 — 실저장소가 초록이어도 이 자가 «무는지»를 픽스처가 증명한다 ───
 * 옛 판은 이 자리가 비어 있었다(변이를 손으로 넣어 봤다고 주석에만 적혀 있었다).
 * 손 변이는 다음 사람에게 안 남는다 — 남는 것은 코드뿐이다. */

test('🔴 자가 실제로 문다 — 세 결함을 픽스처로 증명한다', () => {
  const 안전 = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

  /* ① 스택 순서 뒤집힘 — 09-03 에 실물 6벌에서 나왔던 모양 */
  const 뒤집힘 = "font-family:'SUIT Variable','Inter Tight',sans-serif";
  const decl = fontDecls(뒤집힘)[0];
  assert.ok(decl, '선언을 못 뽑는다 — fontDecls 가 죽었다');
  assert.ok(decl.indexOf('Inter Tight') > decl.indexOf('SUIT Variable'), '뒤집힌 픽스처가 안 뒤집혔다');

  /* ② 폐기 폰트 — «살아 있는 지정»만 걸리고 주석·local() 은 안 걸린다 */
  assert.ok(살아있는지정("font-family:'Pretendard'").includes('Pretendard'), '살아 있는 폐기 지정을 못 본다');
  assert.ok(!살아있는지정('/* 구 지정은 Pretendard 였다 */').includes('Pretendard'), '주석을 위반으로 센다');
  assert.ok(!살아있는지정("src:local('Noto Sans KR')").includes('Noto Sans KR'),
    'local() 별칭을 위반으로 센다 — 낫표 교정(유호 확정 08-31)이 실린 지면 전량이 빨개진다');

  /* ③ 「이름만 쓰고 로드 안 함」 — 오늘 42벌을 낳은 그 결함 */
  const 이름만 = "<style>body{font-family:'Inter Tight','SUIT Variable',sans-serif}</style>";
  assert.equal(브랜드폰트.심겼나(이름만), false, '안 실린 지면을 «실렸다»로 읽는다');
  assert.ok(!/Inter\+Tight/.test(이름만), 'Inter Tight 로드가 없는 픽스처인데 있다고 읽는다');
  const 고친것 = 브랜드폰트.심기(이름만).html;
  assert.equal(브랜드폰트.심겼나(고친것), true, '심었는데 «안 실렸다»로 읽는다');

  /* ④ 화이트리스트 — 3종 밖 새 폰트가 실제로 걸리나 */
  const 새폰트 = fontDecls("font-family:'Montserrat',sans-serif")[0];
  const 이름들 = 새폰트.replace(/^font-family\s*:/, '').split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, '').trim());
  assert.ok(이름들.includes('Montserrat') && !ALLOWED_FAMILIES.has('montserrat'),
    '3종 밖 폰트가 허용 목록에 있다 — 화이트리스트가 새고 있다');
});
