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
const TOOLS = path.join(ROOT, 'docs', 'tools');

/* 폰트 후보를 나란히 세워 비교하는 실측 도구 — 3종 밖 폰트가 있는 게 목적이라 제외한다. */
const EXEMPT = new Set(['_mn_font_probe.html']);

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

test('브랜드 폰트 정본 문서가 존재한다', () => {
  const doc = path.join(ROOT, 'docs', '브랜드_폰트_정본.md');
  assert.ok(fs.existsSync(doc), 'docs/브랜드_폰트_정본.md가 없다 — 3종 규칙의 정본이다');
  const src = fs.readFileSync(doc, 'utf8');
  for (const fam of ['SUIT Variable', 'Inter Tight', 'DM Mono']) {
    assert.ok(src.includes(fam), `정본에 「${fam}」 항목이 없다`);
  }
});

/* ⏳ CARD_FONT 미교체 — 08-01 기준 lectures 트랙 세션이 Code.js를 활발히 편집 중이다.
 *    (그 세션이 CARD_FONT를 한 번 바꿨다가 되돌리는 것을 실제로 관측했다 — 몇 분 사이에.)
 *    지금 끼어들면 ① 중복 편집 ② 커밋에 남의 미완성 lectures 코드가 딸려 라이브로 나간다.
 *    교체하는 세션이 이 skip을 지우면 그때부터 회귀가 잠긴다. 절차 = 정본 §9. */
test('Code.js CARD_FONT가 브랜드 3종을 쓴다', { skip: 'CARD_FONT 교체 대기 — 정본 §9' }, () => {
  const src = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');
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
