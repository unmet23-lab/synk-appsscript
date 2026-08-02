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
 * 검사 범위 = docs/tools/*.html (폰트를 실제로 지정하는 산출물).
 *   ⏳ Code.js `CARD_FONT`는 타 세션 미커밋 점유로 **아직 교체 못 했다**(정본 §9).
 *      교체하는 세션이 이 파일 맨 아래 「CARD_FONT」 테스트의 skip을 풀 것.
 *   정본 = docs/브랜드_폰트_정본.md
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');
const TOOLS = path.join(ROOT, 'docs', 'tools');

/* 폰트 후보를 나란히 세워 비교하는 실측 도구 — 3종 밖 폰트가 있는 게 목적이라 제외한다. */
const EXEMPT = new Set([
  '_mn_font_probe.html',
  // 구 V9 Red↔정본 v10 Coral 토글 비교 도구 — 구 디자인 재현이 목적이라 폐기 폰트(Pretendard)가 의도적으로 들어 있다.
  // (2026-08-02 분할 2단계 세션이 등재 — 제작 세션에 메시지 통지함. 대외 산출물 아님·판정 도구 전용.)
  '트렌디미니멀_색전환_비교.html',
]);

/* 폐기된 구 지정. 이름만 남아 있어도 복붙으로 번지므로 등장 자체를 막는다. */
const RETIRED = ['Pretendard', 'Noto Sans KR', 'KoPubWorld', 'Nanum', '맑은 고딕'];

/* font-family 선언을 뽑는다. 값이 따옴표로 **시작**하는 게 정상이므로(`font-family:'Inter Tight',…`)
 * 문자 클래스에서 따옴표를 빼면 매치가 `font-family:`에서 끊겨 아래 검사가 통째로 죽는다.
 * 실제로 초판이 그렇게 죽어 있었고, 변이 테스트(순서를 일부러 뒤집기)로 잡았다. */
const fontDecls = (src) => src.match(/font-family\s*:[^;}]+/g) || [];

const htmlFiles = fs.existsSync(TOOLS)
  ? fs.readdirSync(TOOLS).filter((f) => f.endsWith('.html') && !EXEMPT.has(f))
  : [];

test('폰트 지정 산출물이 최소 1개는 검사된다(스캔이 조용히 0건이 되는 것 방지)', () => {
  assert.ok(htmlFiles.length > 0, 'docs/tools/*.html을 하나도 못 찾았다 — 경로가 바뀌었는지 확인');
});

for (const f of htmlFiles) {
  const src = fs.readFileSync(path.join(TOOLS, f), 'utf8');

  test(`${f} — 폐기된 구 폰트를 쓰지 않는다`, () => {
    for (const bad of RETIRED) {
      assert.ok(
        !src.includes(bad),
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
  for (const f of htmlFiles) {
    const src = fs.readFileSync(path.join(TOOLS, f), 'utf8');
    for (const decl of fontDecls(src)) {
      if (!decl.includes('DM Mono')) continue;
      assert.ok(
        !decl.includes('SUIT Variable'),
        `${f}: DM Mono 스택에 SUIT가 섞였다 — DM Mono는 로마자·숫자·기호 전용이다.\n  ${decl.trim()}`
      );
    }
  }
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
