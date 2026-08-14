/* 브랜드 폰트 3종 잠금 — 2026-08-01 유호님 확정(SUIT Variable · Inter Tight · DM Mono).
 *
 * 왜 기계로 막나: 「앞으로 이 폰트만 쓴다」는 프로즈 조항은 새 세션·새 파일에서 그냥 잊힌다.
 *   구 지정(Pretendard·Noto Sans KR·KoPubWorld)이 이미 5개 파일에 퍼져 있었고, 전부 복붙으로 번졌다.
 *   CLAUDE.md 「신뢰성」 — 프로즈보다 기계 강제.
 *
 * 「선언」이 아니라 「적용된 결과」를 본다(memory `guard-must-check-result` — 같은 함정에 3번 빠졌다):
 *   font-family에 'SUIT Variable'이라고 써 두고 웹폰트 로드를 빠뜨리면, 화면은 조용히 시스템 고딕으로
 *   폴백된다. 에러도 안 나고 눈으로도 잘 안 보인다. 그래서 이름과 로드를 **함께** 검사한다.
 *
 * 검사 범위 = docs/tools/*.html (폰트를 실제로 지정하는 산출물) + Code.js `CARD_FONT`·`CARD_WEBFONT`.
 *   ✅ 2026-08-03 — `CARD_FONT` 3종 교체·skip 해제 **완료**(35 pass · skipped 0). 전파도 끝났다(정본 §9).
 *   정본 = docs/브랜드_폰트_정본.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');
const TOOLS = path.join(ROOT, 'docs', 'tools');

/* 폰트 후보를 나란히 세워 비교하는 실측 도구 — 3종 밖(폐기 포함) 폰트가 있는 게 목적이라
 * 「폐기 폰트 등장 금지」 검사만 면제한다. [v9.135] 종전엔 파일 단위 면제라 스택 순서·로드·
 * DM Mono 혼용 검사까지 통째로 빠졌다 — 면제는 면제 사유가 있는 검사에만 건다. */
const EXEMPT = new Set([
  '_mn_font_probe.html',
  // 구 V9 재현 비교 도구 — 폰트 의도적 동결(brand-color-kit 메모리 참조). 폐기 폰트(Pretendard·Noto·JetBrains Mono)는
  // 「비교 변수를 색으로 고정」하기 위한 동결이라 검사 대상이 아니다(색만 V9↔v10 토글 · 대외 산출물 아님).
  // 2026-08-02 브랜드 색 세션 요청으로 분할 2단계 세션이 등재 대행(세션 간 메시지 왕복 + acc1527 승인).
  '트렌디미니멀_색전환_비교.html',
]);

/* 폐기된 구 지정. 이름만 남아 있어도 복붙으로 번지므로 등장 자체를 막는다. */
const RETIRED = ['Pretendard', 'Noto Sans KR', 'KoPubWorld', 'Nanum', '맑은 고딕'];

/* font-family 선언을 뽑는다. 값이 따옴표로 **시작**하는 게 정상이므로(`font-family:'Inter Tight',…`)
 * 문자 클래스에서 따옴표를 빼면 매치가 `font-family:`에서 끊겨 아래 검사가 통째로 죽는다.
 * 실제로 초판이 그렇게 죽어 있었고, 변이 테스트(순서를 일부러 뒤집기)로 잡았다. */
/* ⚠ `font-family:` 만 보면 **CSS 변수 선언이 통째로 빠져나간다.** 2026-08-05 실측:
 *   `--kc-serif:'Fraunces',…` 로 선언하고 `font-family:var(--kc-serif)` 로 쓰면
 *   이 검사는 `var(...)` 만 읽고 통과시킨다 — 폰트 이름이 사는 자리가 한 칸 옮겨갔을 뿐인데
 *   화이트리스트 전체가 눈이 먼다(같은 파일을 렌더 린트는 26건으로 잡았다).
 *   서체를 담는 커스텀 속성도 같은 무게로 본다. */
const fontDecls = (src) => [
  ...(src.match(/font-family\s*:[^;}]+/g) || []),
  ...(src.match(/--[\w-]*(?:font|serif|sans|mono)[\w-]*\s*:[^;}]+/g) || []),
];

/* 주석은 렌더에 안 나온다 — 정책 대상은 **살아 있는 지정**뿐이다.
 * 2026-08-05 실측: 등록층을 넓히자마자 이 검사가 5파일에서 빨개졌는데, 원인은 전부
 * 「구 지정은 Pretendard 였다」·「Noto Sans KR 은 폐기 서체다」라고 **적어 둔 문장**이었다.
 * 즉 폐기를 기록한 행위 자체가 위반으로 잡혔다. 가드가 실작업을 벌주면 사람이 가드를 끈다 —
 * `tools/발표물린트.js` 가 자기 주석에 걸렸던 것과 같은 부류다(그쪽은 이미 이렇게 고쳤다). */
const stripComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // `https://` 를 주석으로 오인하지 않도록 앞 문자 확인

/* 2026-08-05 · 라이브 접수 폼·대외 게시물을 등록층에 넣는다.
 * 08-04 감사가 밝힌 것: 이 가드가 초록이었던 건 맞아서가 아니라 **그 파일들을 안 봤기 때문**이다.
 * 목록은 여기 새로 적지 않고 `tools/브랜드렌더린트.js` 의 `대상` 하나에서 파생시킨다.
 * 이 등록이 **즉시** 잡은 것: 개인정보처리방침_게시용이 3종을 선언만 하고 웹폰트를 하나도
 * 안 불러오고 있었다(아래 「쓴 폰트를 실제로 로드한다」가 빨개졌다). */
const { 대상: RENDER_TARGETS } = require('../tools/브랜드렌더린트');

/* [표시이름, 절대경로] — docs/tools 는 파일명만, 등록층은 상대경로를 그대로 보여준다. */
const htmlTargets = [
  ...(fs.existsSync(TOOLS) ? fs.readdirSync(TOOLS).filter((f) => f.endsWith('.html')) : [])
    .map((f) => [f, path.join(TOOLS, f)]),
  ...RENDER_TARGETS.map((rel) => [rel, path.join(ROOT, rel)]),
].filter(([, abs]) => fs.existsSync(abs));

test('폰트 지정 산출물이 최소 1개는 검사된다(스캔이 조용히 0건이 되는 것 방지)', () => {
  assert.ok(htmlTargets.filter(([f]) => !EXEMPT.has(f)).length > 0, 'docs/tools/*.html을 하나도 못 찾았다 — 경로가 바뀌었는지 확인');
  assert.ok(htmlTargets.length > RENDER_TARGETS.length, '등록층만 잡히고 docs/tools 가 안 잡혔다 — 경로 확인');
});

for (const [f, abs] of htmlTargets) {
  const src = fs.readFileSync(abs, 'utf8');

  /* ⚠ 여기 대상은 **HTML·CSS** 다 — `코드만()`(JS 렉서)으로 감싸지 않는다(갈래 ⓒ 비JS · #Q72).
   *   주석 제거는 이미 이 파일의 `stripComments`(HTML 주석 + CSS 블록 주석)가 맡는다. 아래 `decl`
   *   도 font-family 선언 «값»이지 원문이 아니다. */
  if (!EXEMPT.has(f)) test(`${f} — 폐기된 구 폰트를 쓰지 않는다`, () => {
    const live = stripComments(src);
    for (const bad of RETIRED) {
      assert.ok(
        !live.includes(bad),
        `${f}에 폐기 폰트 「${bad}」가 남아 있다. 정본 docs/브랜드_폰트_정본.md의 3종만 쓴다`
      );
    }
  });

  test(`${f} — 스택 순서: Inter Tight가 SUIT Variable보다 앞`, () => {
    if (!src.includes('SUIT Variable')) return; // 한글을 안 쓰는 산출물은 해당 없음
    for (const decl of fontDecls(src)) {
      if (!decl.includes('SUIT Variable') || !decl.includes('Inter Tight')) continue;
      assert.ok(
        decl.indexOf('Inter Tight') < decl.indexOf('SUIT Variable'),
        `${f}: SUIT가 Inter Tight보다 앞에 있다 → SUIT의 라틴 자형이 먼저 잡혀 몽골어·영문이 ` +
          `Inter Tight로 안 간다. 폴백은 글리프 단위로 동작하므로 순서가 곧 언어 배분이다.\n  ${decl.trim()}`
      );
    }
  });

  /* 「적용된 결과」 검사 — 이름을 썼으면 실제로 불러와야 한다. */
  test(`${f} — 쓴 폰트를 실제로 로드한다(선언만 하고 폴백되는 것 방지)`, () => {
    if (src.includes('SUIT Variable')) {
      assert.ok(
        /sun-typeface\/SUIT/.test(src),
        `${f}: 'SUIT Variable'을 쓰면서 SUIT CDN을 안 불렀다 → 한글이 조용히 시스템 고딕으로 폴백된다`
      );
    }
    if (src.includes('Inter Tight')) {
      assert.ok(
        /Inter\+Tight/.test(src),
        `${f}: 'Inter Tight'를 쓰면서 웹폰트를 안 불렀다 → 영문·몽골어가 폴백된다`
      );
    }
  });
}

/* DM Mono엔 키릴·한글 글리프가 아예 없다(2026-08-01 google/fonts METADATA.pb 실검증:
 * 서브셋이 latin·latin-ext 뿐). 몽골어를 넣으면 통째로 다른 폰트로 폴백돼 워드마크가 무너진다. */
test('DM Mono를 쓰는 파일은 한글·키릴을 같은 지정에 섞지 않는다', () => {
  for (const [f, abs] of htmlTargets) {
    const src = fs.readFileSync(abs, 'utf8');
    for (const decl of fontDecls(src)) {
      if (!decl.includes('DM Mono')) continue;
      assert.ok(
        !decl.includes('SUIT Variable'),
        `${f}: DM Mono 스택에 SUIT가 섞였다 — DM Mono는 로마자·숫자·기호 전용이다.\n  ${decl.trim()}`
      );
    }
  }
});

/* ⚠ 08-03 브랜드 키트 종합 판정에서 드러난 구멍 — 위 검사는 전부 **블랙리스트**다.
 *   폐기된 5종이 돌아오는 건 막지만 **3종 밖 새 폰트**(Montserrat·Poppins 등)가 들어오는 건 통과시킨다.
 *   정본 금칙 4는 「3종만 쓴다」인데 기계는 「구 3종만 안 쓴다」를 검사하고 있었다 — 둘은 다른 규칙이다.
 *   자동 생성이 늘수록 이 구멍으로 들어온다(생성기가 예쁜 폰트를 임의로 고른다). 그래서 화이트리스트로 잠근다.
 *
 * 허용 = 브랜드 3종 + CSS 제네릭/시스템 폴백(실측으로 열거 — 저장소 전체에서 이 목록이 전부였다).
 * 폴백은 CDN이 죽었을 때 레이아웃을 지키는 안전망이라 금지 대상이 아니다(정본 §7). */
/* 목록은 tools/브랜드렌더린트.js 하나에서 파생시킨다 — 두 곳에 적었더니 **실제로 갈라져 있었다.**
 * 렌더 린트는 `SUIT`(jsDelivr SUIT-Variable.css 가 함께 정의하는 별칭)를 허용하는데 여기엔
 * 없었고, 위에서 변수 선언까지 보게 만든 순간 카드 4종이 「SUIT」로 빨개졌다.
 * 그 전까지 안 걸린 건 맞아서가 아니라 `--serif:` 선언을 아무도 안 봤기 때문이다. */
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
 *   소스 층에서 잴 수 있는 경계는 「`--kc-*` 선언 안인가」다 — 그래서 카드가 그 통로 하나만
 *   쓰도록 좁혀 뒀다(구역 경계 자체는 렌더 린트가 `.kc-page` 조상으로 잰다).
 * 목록은 위 BRAND_FAMILIES 와 같은 출처에서 온다 — 두 곳에 적으면 갈라지고,
 * 갈라지는 방향은 언제나 「통과」다. */
const KC_ALLOWED = new Set(KC_FONTS_OK.map((s) => s.toLowerCase()));
const isKcDecl = (decl) => /^\s*--kc-/.test(decl);

test('3종 밖 폰트가 새로 들어오지 않는다(화이트리스트 — 블랙리스트로는 못 막는다)', () => {
  const violations = [];
  for (const [f, abs] of htmlTargets) {
    if (EXEMPT.has(f)) continue; // 비교 도구는 3종 밖 폰트가 있는 것이 목적
    const src = fs.readFileSync(abs, 'utf8');
    for (const decl of fontDecls(src)) {
      for (const token of decl.replace(/^font-family\s*:/, '').split(',')) {
        const name = token.trim().replace(/^["']|["']$/g, '').trim();
        // HTML이 섞여 들어온 파싱 부스러기는 폰트 이름이 아니다 — 폰트명은 라틴·숫자·하이픈·공백뿐
        if (!name || !/^[-A-Za-z0-9 ]+$/.test(name)) continue;
        if (ALLOWED_FAMILIES.has(name.toLowerCase())) continue;
        if (isKcDecl(decl) && KC_ALLOWED.has(name.toLowerCase())) continue; // Part 06 예약 — 그 통로 안에서만
        violations.push(`${f}: 「${name}」`);
      }
    }
  }
  assert.equal(
    violations.length,
    0,
    `정본 3종·시스템 폴백 밖의 폰트가 지정됐다:\n  ${violations.join('\n  ')}\n` +
      `SYNK가 쓰는 서체는 SUIT Variable(한글)·Inter Tight(라틴+몽골 키릴)·DM Mono(워드마크·라벨)뿐이다.\n` +
      `새 서체를 정말 도입한다면 정본 docs/브랜드_폰트_정본.md 개정이 먼저이고, ` +
      `키릴 몽골 고유자 「ө·ү」 실측(도구 docs/tools/_mn_font_probe.html)이 필수다.`
  );
});

/* HTML만 검사하면 빈틈이 남는다 — 앱 카드 폰트는 Code.js 안의 문자열이고, 콘텐츠 파일도 마찬가지다.
 * 「폐기 폰트가 **새로** 들어오는 것」을 잡으려면 알려진 잔여 건수를 못 박고 그보다 늘면 실패시킨다.
 * 지금 알려진 잔여 = CARD_FONT 1건(정본 §9의 교체 대기). 이 숫자는 교체 시 0으로 내린다. */
const JS_TARGETS = [...require('./_engine-source').ENGINE_FILES, '상담AI.js', '교재연동.js', '만족도팩.js']
  .concat(fs.readdirSync(ROOT).filter((f) => /^contents_.*\.js$/.test(f)));
const KNOWN_RETIRED_IN_JS = 0; // CARD_FONT 교체 완료(08-01) — 이제 한 건도 허용하지 않는다

test('JS 산출물에 폐기 폰트가 새로 들어오지 않는다', () => {
  const hits = [];
  for (const f of JS_TARGETS) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    src.split(/\r?\n/).forEach((line, i) => {
      if (!/font-family\s*:/.test(line)) return; // 주석 속 언급은 세지 않는다 — 실제 지정만
      for (const bad of RETIRED) {
        if (line.includes(bad)) hits.push(`${f}:${i + 1} 「${bad}」`);
      }
    });
  }
  assert.ok(
    hits.length <= KNOWN_RETIRED_IN_JS,
    `JS에 폐기 폰트 지정이 ${hits.length}건 — 알려진 잔여는 ${KNOWN_RETIRED_IN_JS}건뿐이다.\n  ` +
      hits.join('\n  ') +
      `\n정본 docs/브랜드_폰트_정본.md의 3종만 쓴다. 교체를 끝냈으면 KNOWN_RETIRED_IN_JS를 0으로 내려라.`
  );
});

test('브랜드 폰트 정본 문서가 존재한다', () => {
  const doc = path.join(ROOT, 'docs', '브랜드_폰트_정본.md');
  assert.ok(fs.existsSync(doc), 'docs/브랜드_폰트_정본.md가 없다 — 3종 규칙의 정본이다');
  const src = fs.readFileSync(doc, 'utf8');
  for (const fam of ['SUIT Variable', 'Inter Tight', 'DM Mono']) {
    assert.ok(src.includes(fam), `정본에 「${fam}」 항목이 없다`);
  }
});

/* CARD_FONT 교체 완료(08-01, lectures 트랙 세션이 Code.js를 놓은 직후). */
test('Code.js CARD_FONT가 브랜드 3종을 쓴다', () => {
  const src = engineSource();
  const m = src.match(/const CARD_FONT = "([^"]+)"/);
  assert.ok(m, 'Code.js에서 CARD_FONT 상수를 못 찾았다');
  const decl = m[1];
  for (const bad of RETIRED) assert.ok(!decl.includes(bad), `CARD_FONT에 폐기 폰트 「${bad}」`);
  assert.ok(decl.includes('Inter Tight') && decl.includes('SUIT Variable'), 'CARD_FONT가 3종 스택이 아니다');
  assert.ok(
    decl.indexOf('Inter Tight') < decl.indexOf('SUIT Variable'),
    'CARD_FONT 스택 순서가 뒤집혔다 — Inter Tight가 앞'
  );
});

/* 이 파일에서 가장 중요한 검사 — 「이름만 바꾸고 로드를 빠뜨리는」 실패를 막는다.
 * 학생 기기에 SUIT·Inter Tight는 없다. 로드가 없으면 전 카드가 시스템 폰트로 조용히 폴백되는데,
 * 에러도 안 나고 화면도 그럴싸해서 사람 눈으로는 「적용됐다」와 구별이 안 된다.
 * 그래서 ① 로더가 두 폰트를 다 부르는지 ② 카드 루트마다 실제로 붙었는지를 결과로 검사한다. */
test('CARD_WEBFONT가 두 웹폰트를 실제로 로드한다', () => {
  const src = engineSource();
  // `\r?\n` — CRLF 사본에서 `;\r\n`이 되어 매치가 통째로 실패하던 것을 막는다(08-02 옆 세션 경고, safety.test.js v9.107과 같은 계열).
  const m = src.match(/const CARD_WEBFONT = ([\s\S]*?);\r?\n/);
  assert.ok(m, 'CARD_WEBFONT 상수가 없다 — CARD_FONT만 바꾸면 전 카드가 폴백된다(정본 §9)');
  const decl = m[1];
  assert.ok(/sun-typeface\/SUIT/.test(decl), 'CARD_WEBFONT가 SUIT를 안 부른다 → 한글이 폴백된다');
  assert.ok(/Inter\+Tight/.test(decl), 'CARD_WEBFONT가 Inter Tight를 안 부른다 → 영문·몽골어가 폴백된다');
  assert.ok(/<style>/.test(decl), 'CARD_WEBFONT에 <style> 블록이 없다 — style 속성 값에는 @import를 못 넣는다');
});

test('카드 루트마다 CARD_WEBFONT가 붙어 있다', () => {
  const src = engineSource();
  const roots = src.match(/'<div style="' \+ CARD_FONT/g) || [];
  assert.ok(roots.length > 0, "카드 루트 패턴을 못 찾았다 — 렌더 구조가 바뀌었는지 확인");
  const loaded = src.match(/CARD_WEBFONT \+ '<div style="' \+ CARD_FONT/g) || [];
  assert.equal(
    loaded.length,
    roots.length,
    `카드 루트 ${roots.length}곳 중 ${loaded.length}곳에만 CARD_WEBFONT가 붙었다 — ` +
      `빠진 카드는 폰트가 폴백된다. 새 카드를 추가했다면 CARD_WEBFONT를 앞에 붙여라`
  );
});
