/* 자립형 «동행» 회귀 — 대외로 나가는 한 장이 본판보다 뒤처지면 문다.
 *
 * ■ 무엇을 지키나 (실사고 2026-09-03 · **814줄** 뒤처져 있었다)
 *   홈페이지 정본은 `docs/홈페이지_시안/병합판.html` 이고, 첨부·메일로 건너가는 것은
 *   그림을 파일 안에 심은 `병합판_자립형.html` 한 장이다. 그런데 자립형을 다시 굽는 것은
 *   **손 규율**이었다 — 「본판을 고치면 자립형도 다시 굽는다」는 주석 한 줄.
 *   손 규율은 「내가 고칠 때」만 듣고 사고는 「남이 고칠 때」 난다.
 *   실측: 09-02 「쓰는 것만 싣는다」 배선과 09-03 문안 스윕이 **둘 다 본판에만** 닿았고,
 *   자립형은 아무 소리 없이 옛 판으로 남았다(그림 51장 808KB ↔ 지금 25장 481KB).
 *   🔴 **증상이 없다.** 자립형은 열면 멀쩡히 뜬다 — 다만 옛 판일 뿐이다.
 *
 * ■ 이 검사가 «안» 재는 것: 그림이 잘 심겼는지·화질. 그건 굽기 도구와 눈이 본다.
 *   여기서 재는 것은 **「본판과 같은 말을 하고 있나」** 하나다.
 *
 * ⚠ 이 검사가 틀릴 때의 모습 = **걷는 범위를 넓혀 놓고 초록.** 굽기가 더한 것을 걷어내는 자를
 *   넓히면 진짜 뒤처짐까지 함께 지워진다 ⇒ ② 가 그 자리를 문다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
/* 자는 굽는 쪽이 쥔다 — 여기서 따로 적으면 굽기가 한 일이 바뀐 날 조용히 갈린다. */
const { 자립형경로, 동행벗기기 } = require(path.join(루트, 'tools', '시안굽기.js'));
const { 표기접기 } = require(path.join(루트, 'tests', 'lib', '소스검사.js'));

/** 짝 — 본판 하나에 자립형 하나. 늘면 여기 한 줄만 더한다. */
const 짝들 = [path.join(루트, 'docs', '홈페이지_시안', '병합판.html')];

const 견줄판 = (s) => 표기접기(동행벗기기(s));

/* ── ① 급소 — 자립형이 본판과 «그림 빼고» 같다 ────────────────────────────── */

test('🔴 자립형이 본판보다 뒤처지지 않았다 — 09-03 에 814줄 뒤처져 있던 자리', () => {
  let 잰것 = 0;
  for (const 본판길 of 짝들) {
    const 자립길 = 자립형경로(본판길);
    assert.ok(fs.existsSync(본판길), `본판이 없다: ${path.relative(루트, 본판길)}`);
    assert.ok(fs.existsSync(자립길), `자립형이 없다: ${path.relative(루트, 자립길)} — 한 번 구워라`);
    잰것 += 1;

    const 본판 = 견줄판(fs.readFileSync(본판길, 'utf8'));
    const 자립 = 견줄판(fs.readFileSync(자립길, 'utf8'));
    if (본판 === 자립) continue;

    /* 처방을 «따를 수 있게» 낸다 — 무엇이 몇 줄 갈렸는지까지 짚는다. */
    const A = 본판.split('\n'); const B = 자립.split('\n');
    let 갈린줄 = 0; let 첫자리 = -1;
    for (let i = 0; i < Math.max(A.length, B.length); i += 1) {
      if (A[i] !== B[i]) { 갈린줄 += 1; if (첫자리 < 0) 첫자리 = i; }
    }
    assert.fail(
      `${path.basename(자립길)} 이 본판과 다르다 — 갈린 줄 ${갈린줄} (본판 ${A.length}줄 / 자립 ${B.length}줄 · 첫 자리 ${첫자리})\n`
      + `   본판: ${JSON.stringify((A[첫자리] || '').slice(0, 100))}\n`
      + `   자립: ${JSON.stringify((B[첫자리] || '').slice(0, 100))}\n`
      + `   → 자립형이 뒤처졌으면: node tools/시안굽기.js ${path.relative(루트, 본판길).replace(/\\/g, '/')}\n`
      + '     (그림을 다시 심으므로 ffmpeg 가 있어야 한다 — 없는 기계에선 굽기가 멈춘다)\n'
      + '   → 자립형만 손으로 고친 것이 있으면 그건 살아남지 못한다. 본판을 고치고 다시 구워라.'
    );
  }
  assert.equal(잰것, 짝들.length, `분모 — 짝 ${짝들.length}개 중 ${잰것}개만 검사됐다`);
});

/* ── ② 탐지력 — 픽스처가 진다(실저장소가 병들어 있기를 요구하지 않는다) ──── */

test('🔴 본판을 한 글자 고치고 안 구우면 문다 — 걷는 범위를 넓히면 이 검사가 자살한다', () => {
  const 본판 = fs.readFileSync(짝들[0], 'utf8');
  const 병든 = 본판.replace('<body', '<body data-병든="1"');
  assert.notEqual(병든, 본판, '픽스처가 아무것도 안 바꿨다 — 이 검사는 자기 자신만 증명한다');
  assert.notEqual(견줄판(병든), 견줄판(본판), '한 글자 차이를 「같다」로 읽는다');
});

/* ── ③ 걷는 자가 «본문»을 먹지 않는다 — 넓히면 뒤처짐이 함께 지워진다 ─────── */

test('걷는 것은 굽기가 더한 셋뿐이다 — 글은 한 글자도 안 건드린다', () => {
  const 앞 = '<p>정원은 16명입니다</p><img src="../캐릭터/몽글.webp" data-synk-mascot><script src="./a.js"></script>';
  const 뒤 = 동행벗기기(앞);
  assert.ok(뒤.includes('정원은 16명입니다'), '본문 글이 사라졌다');
  assert.ok(!뒤.includes('../캐릭터/몽글.webp'), 'src 값이 안 걷혔다 — 상대경로↔data URI 가 늘 다르게 읽힌다');
  assert.ok(!뒤.includes('data-synk-mascot'), '굽기가 자동으로 다는 표식이 안 걷혔다');
  assert.ok(!뒤.includes('./a.js'), '스크립트 src 가 안 걷혔다');

  /* 심은 판과 안 심은 판이 «같은 것»으로 읽혀야 한다 — 그게 이 자의 존재 이유다. */
  const 심긴판 = '<p>정원은 16명입니다</p><img src="data:image/webp;base64,AAAA"><script>/* 심은 몸 */ var a=1;</script>';
  const 안심긴판 = '<p>정원은 16명입니다</p><img src="../캐릭터/몽글.webp" data-synk-mascot><script src="./a.js"></script>';
  assert.equal(동행벗기기(심긴판), 동행벗기기(안심긴판), '심기 전후가 다르게 읽힌다 — 그러면 늘 빨갛다');
});

/* ── ④ 서체는 «두 모양»으로 심긴다 — 둘 다 걷혀야 한다 ────────────────────
   🔴 09-03 실측: 이 대조가 **딱 한 줄** 차이로 빨갰다. 굽기가 서체를 「옛 `@font-face`
      자리」에 물려 심는데(맨 면 · 블록에 안 싸인다), 되돌리기는 블록 모양만 걷고 있었다.
      「심겼나」는 두 모양을 다 세는데 「원고로」는 하나만 걷었다 — 자가 갈린 자리다. */

test('🔴 서체를 «옛 @font-face 자리»에 심은 판도 원고와 같게 읽힌다 — 한 줄로 빨갛던 자리', () => {
  const 맨면 = "@font-face{font-family:'SUIT Variable';font-weight:100 900;font-display:swap;"
    + "src:url(data:font/woff2;base64,d09GMgAA) format('woff2-variations');}";
  const CDN면 = "@font-face{font-family:'SUIT Variable';src:url(https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/x.woff2)}";
  const 본판꼴 = `<html><head><style>\n${CDN면}\nbody{margin:0}</style></head><body><p>글</p></body></html>`;
  const 구운꼴 = `<html><head><style>\n${맨면}\nbody{margin:0}</style></head><body><p>글</p></body></html>`;
  assert.notEqual(본판꼴, 구운꼴, '픽스처 둘이 같다 — 이 검사는 아무것도 증명하지 못한다');
  assert.equal(동행벗기기(본판꼴), 동행벗기기(구운꼴), '서체를 심은 자리가 «맨 면»이면 못 걷는다');
  assert.ok(!/data:font/.test(동행벗기기(구운꼴)), '심은 서체가 남았다');

  /* 블록 모양도 그대로 걷혀야 한다(두 모양 중 하나만 고치면 나머지가 샌다). */
  const 블록꼴 = `<html><head><style data-synk-폰트="SUIT">${맨면}</style><style>\nbody{margin:0}</style></head><body><p>글</p></body></html>`;
  assert.ok(!/data:font/.test(동행벗기기(블록꼴)), '블록으로 심은 서체가 남았다');

  /* 탐지력 — 「바깥 호출만 걷는」 옛 자로는 맨 면을 못 걷는다. 이 줄이 과녁을 넓힌 까닭이다. */
  const 브랜드폰트 = require(path.join(루트, 'tools', 'lib', '브랜드폰트.js'));
  assert.ok(/data:font/.test(브랜드폰트.걷기(구운꼴)), '옛 자로도 걷힌다면 이 칸은 아무것도 안 지킨다');
  assert.ok(브랜드폰트.심겼나(구운꼴), '`심겼나` 가 맨 면을 「심겼다」로 안 세면 두 자가 또 갈린다');
});
