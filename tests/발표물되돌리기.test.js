/* 발표물 «되돌리기» 회귀 — `--check` 가 산출물을 원고로 되돌릴 때 무엇을 과녁으로 삼나.
 *
 * ■ 무엇을 지키나 (실사고 2026-08-31 → 09-03 · 나흘짜리 주인 없는 적색)
 *   `node tools/발표물빌드.js --check` 가 산출물 7벌 전량을 「소스를 고치고 안 구웠다」로 내고
 *   exit 1 했다. **그 말은 사실이 아니었다** — 원고도 산출물도 안 낡았다.
 *   되돌리기가 «파일에서 처음 만나는 @font-face 묶음»을 과녁으로 삼았는데, 08-31 커밋
 *   `c3273d30d` 가 원고 맨 위에 **손글씨** 활자 한 줄(`src:local(…)`)을 들여 그것이 마커보다
 *   앞에 섰다. 되돌리기는 엉뚱한 한 줄을 마커로 바꾸고 심은 활자는 그대로 남겼다.
 *
 * 🔴 **최악의 성질은 「고칠 수 없는 적색」이라는 것이다.** 처방(`--pdf` 로 다시 굽기)을 따라도
 *   같은 자리에서 같은 값이 난다. 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103) —
 *   그래서 이 파일은 ⓐ 되돌리기가 맞는 과녁을 잡는가 와 ⓑ **못 잡았을 때 그렇게 말하는가**를
 *   둘 다 문다. ⓑ 가 없으면 다음에 과녁이 어긋나는 날 또 「낡았다」로 나온다.
 *
 * ⚠ 이 검사가 틀릴 때의 모습 = **과녁을 넓혀 놓고 초록.** 되돌리기가 손글씨 활자까지 먹으면
 *   왕복은 성립하는데 원고의 한 줄이 사라진다 ⇒ ③ 이 그 자리를 문다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const 루트 = path.resolve(__dirname, '..');
const 발표물 = path.join(루트, 'docs', '발표물');
const 빌드 = require(path.join(루트, 'tools', '발표물빌드.js'));
const { unembed, 심긴활자남았나, MARKER } = 빌드;

/* ── 픽스처 — 실물과 같은 모양으로 짓는다(축소 모형은 실물과 갈리고, 갈리면 통과한다) ──── */

/** 원고가 스스로 품은 «손글씨» 활자 — 기계 글꼴에 기대는 줄이라 `src:local(…)` 이다. */
const 손글씨 = "@font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Noto Sans KR')}";
/** 빌드가 «심는» 활자 한 벌 — `docs/tools/브랜드폰트_임베드.py` 가 짓는 모양 그대로. */
const 심은 = (fam, wt) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${wt};`
  + `font-display:block;src:url(data:font/woff2;base64,AAAABBBB) format('woff2')}`;

const 원고 = [
  '<html><head><style>',
  손글씨,
  '',
  MARKER,
  '@page { size: A4 portrait; margin: 0; }',
  '</style></head><body><p>상담 결과</p></body></html>',
].join('\n');

/** 파이썬이 하는 일 그대로 — 마커 자리에 심은 활자들을 줄바꿈으로 이어 넣는다. */
const 심긴것 = [심은('Inter Tight', 400), 심은('Inter Tight', 700), 심은('SUIT', 400)].join('\n');
const 산출 = 원고.replace(MARKER, 심긴것);

/* ── ① 급소 — 손글씨 활자가 «마커보다 앞»에 있어도 왕복이 성립한다 ──────────── */

test('🔴 원고가 손글씨 @font-face 를 품어도 산출물이 원고로 되돌아온다 — 08-31 에 7벌을 세운 자리', () => {
  assert.notEqual(산출, 원고, '픽스처가 심지를 않았다 — 이 검사는 아무것도 증명하지 못한다');
  assert.ok(산출.indexOf(손글씨) < 산출.indexOf('data:font'), '픽스처에서 손글씨가 심은 것보다 앞에 서야 한다');
  assert.equal(unembed(산출), 원고, '되돌리기가 원고를 복원하지 못한다');
});

/* ── ② 탐지력 — «옛 과녁»으로는 왜 안 되는지를 값으로 못박는다 ─────────────── */

test('🔴 옛 과녁(처음 만나는 묶음)으로 재면 못 되돌린다 — 과녁을 좁힌 까닭이 여기 있다', () => {
  const 옛과녁 = /@font-face\{[^}]*\}(?:\n@font-face\{[^}]*\})*/;
  const 옛판 = 산출.replace(옛과녁, MARKER);
  assert.notEqual(옛판, 원고, '옛 과녁으로도 왕복이 되면 이 회귀는 아무것도 안 지킨다');
  assert.ok(심긴활자남았나(옛판), '옛 과녁은 심은 활자를 남긴다 — 그것이 나흘짜리 적색의 모양이었다');
});

/* ── ③ 과녁을 넓히면 안 된다 — 손글씨 활자는 원고의 «내용»이다 ─────────────── */

test('되돌리기가 손글씨 활자를 먹지 않는다 — 먹으면 왕복은 되고 원고 한 줄이 사라진다', () => {
  assert.ok(unembed(산출).includes(손글씨), '손글씨 활자가 되돌린 판에서 사라졌다');
  assert.equal(심긴활자남았나(unembed(산출)), false, '심은 활자가 되돌린 판에 남았다');
});

/* ── ④ 탐지력 — 진짜 낡음은 그대로 문다 ────────────────────────────────────── */

test('🔴 원고를 한 글자 고치고 안 구우면 문다 — 과녁을 좁히다 뜻까지 좁히면 영원한 초록이 된다', () => {
  const 낡은산출 = 산출.replace('<p>상담 결과</p>', '<p>상담 결과지</p>');
  assert.notEqual(낡은산출, 산출, '변이가 아무것도 안 바꿨다');
  assert.notEqual(unembed(낡은산출), 원고, '내용이 갈렸는데 「최신」으로 읽는다');
});

/* ── ⑤ 실물 — 지금 저장소의 산출물이 실제로 되돌아오나(상태가 아니라 «자»를 잰다) ── */

test('실물 산출물 전량에서 되돌리기가 헛돌지 않는다', () => {
  const 원고들 = fs.readdirSync(발표물).filter((f) => f.startsWith('_src_') && f.endsWith('.html')).sort();
  assert.ok(원고들.length > 0, `${path.relative(루트, 발표물)} 에 _src_*.html 이 0건 — 분모가 조용히 사라졌다`);

  let 잰것 = 0;
  for (const s of 원고들) {
    const 산출길 = path.join(발표물, s.slice('_src_'.length));
    if (!fs.existsSync(산출길)) continue;                 // 「굽기가 밀렸나」는 --check 몫이다
    잰것 += 1;
    const 벗은 = unembed(fs.readFileSync(산출길, 'utf8'));
    assert.equal(
      심긴활자남았나(벗은), false,
      `${path.basename(산출길)} — 되돌린 판에 심은 활자가 남았다. 이건 «낡음»이 아니라 과녁이 안 맞는 것이고,`
      + ' 다시 구워도 안 꺼진다 — tools/발표물빌드.js 의 `심긴묶음` 을 본다'
    );
  }
  /* 0 은 분모와 함께 쓴다 — 몇 벌을 봤는지 안 밝히면 미실행이 통과와 같은 모양이다. */
  assert.ok(잰것 >= 7, `실물 대조가 ${잰것}벌뿐이다(원고 ${원고들.length}) — 산출물이 사라졌는지 본다`);
});

/* ── ⑤-b CSS 가 «그리는» 글자도 서브셋에 들어가야 한다 ─────────────────────
   🔴 2026-09-03 실측(03_상담브로셔 · 종이에 한 글자): 서브셋은 「쓰이는 글자」로 만드는데
      그 목록을 뽑는 `visible_text` 가 <style> 을 통째로 버린다. 그런데 CSS 는 글자를 그린다
      (`.vs .col li::before{content:'— '}`). 본문에도 그 글자가 있는 동안은 우연히 덮였고,
      09-03 문안 스윕이 본문의 긴 줄표를 0 으로 만들자 서브셋에서 빠져 **맑은고딕이 그렸다.**
      인쇄물 키트검사 실측: 옛 판 MalgunGothic 잉크글자 0 → 새 판 1(—) → 배선 뒤 다시 0.
   ⚠ 여기서 재는 것은 «배선»뿐이다 — 글자를 실제로 심는지는 파이썬이 돌아야 알 수 있고,
      이 스위트는 파이썬을 안 부른다(부르는 검사가 0건이다 · 09-03 실측). 배선이 끊기면
      그 순간 조용히 옛 사고로 돌아가므로, 끊기는 것만이라도 기계가 문다.
      실물 판정은 `python docs/tools/인쇄물_키트검사.py <pdf>` 가 진다(손으로 부른다 · pypdf 필요). */

test('🔴 임베드가 CSS `content:` 글자를 서브셋에 넣는 배선이 살아 있다', () => {
  const 임베드 = fs.readFileSync(path.join(루트, 'docs', 'tools', '브랜드폰트_임베드.py'), 'utf8');
  assert.match(임베드, /def css_content_chars\(/, 'CSS 가 그리는 글자를 모으는 함수가 없다');
  assert.match(
    임베드, /chars \|= css_only/,
    '함수는 있는데 «쓰이는 글자»에 안 더한다 — 부르고 답을 버리면 안 부른 것과 같다'
  );
  /* 실저장소 픽스처: 그 사고가 난 원고에 지금도 그 글자가 «본문 밖»에 산다. */
  const src = fs.readFileSync(path.join(발표물, '_src_03_상담브로셔_A4_12쪽.html'), 'utf8');
  assert.match(src, /content\s*:\s*'—/, '픽스처가 사라졌다 — 이 칸이 무엇을 지키는지 다시 적어라');
});

/* ── ⑥ 「낡음」과 「과녁이 안 맞음」이 **다른 말**을 낸다 ────────────────────
   ⚠ 여기서만 자식 프로세스를 쓴다 — `main()` 은 내보내지 않고, 이 도구가 이미 갖고 있던
      픽스처 이음매(`SYNK_PRESENT_ROOT`)가 지금까지 **아무도 안 써서 안 증명된 상태**였다. */

test('🔴 과녁이 어긋나면 「다시 구워라」가 아니라 「과녁이 안 맞는다」고 말한다', () => {
  const 원고이름 = '_src_10_상담결과_요약_A4.html';
  const 산출이름 = '10_상담결과_요약_A4.html';
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-발표물-'));
  try {
    fs.copyFileSync(path.join(발표물, 원고이름), path.join(방, 원고이름));
    const 산출본 = fs.readFileSync(path.join(발표물, 산출이름), 'utf8');

    /* 과녁이 어긋나는 모양을 «만든다» — 심은 활자 사이가 빈 줄로 벌어져 묶음이 끊긴 판.
       실사고와 같은 갈래다: 산출물의 «모양»이 되돌리기가 아는 모양과 달라진다. */
    const 벌어진 = 산출본.replace("format('woff2')}\r\n@font-face{", "format('woff2')}\r\n\r\n@font-face{")
      .replace("format('woff2')}\n@font-face{", "format('woff2')}\n\n@font-face{");
    assert.notEqual(벌어진, 산출본, '픽스처가 산출물을 못 벌렸다 — 심은 활자의 모양이 바뀌었는지 본다');

    const 돌린다 = () => {
      try {
        return execFileSync(process.execPath, [path.join(루트, 'tools', '발표물빌드.js'), '--check'],
          { cwd: 루트, encoding: 'utf8', env: { ...process.env, SYNK_PRESENT_ROOT: 방 } });
      } catch (e) { return `${e.stdout || ''}${e.stderr || ''}`; }
    };

    fs.writeFileSync(path.join(방, 산출이름), 산출본);
    const 성한판 = 돌린다();
    assert.ok(!성한판.includes('못 되돌렸다'), `성한 산출물에 과녁 경고가 떴다:\n${성한판}`);
    assert.ok(!성한판.includes('내용이 어긋난다'), `성한 산출물을 「낡았다」로 읽는다:\n${성한판}`);

    fs.writeFileSync(path.join(방, 산출이름), 벌어진);
    const 벌어진판 = 돌린다();
    assert.ok(벌어진판.includes('못 되돌렸다'), `과녁이 어긋났는데 그 말을 안 한다:\n${벌어진판}`);
    assert.ok(!벌어진판.includes('내용이 어긋난다'),
      `과녁 문제를 「소스를 고치고 안 구웠다」로 말한다 — 따를 수 없는 처방이다:\n${벌어진판}`);
  } finally {
    fs.rmSync(방, { recursive: true, force: true });
  }
});

/* ── ⑦ 빌드가 «더한» 것만 걷는다 ─────────────────────────────────────────────
   🔴 2026-09-05 실사고 — 원고가 스스로 `class="sheet 룸"` 을 하나 달자 되돌리기가 **둘 다** 걷어
      그 지면이 다시 구워도 영영 「소스를 고치고 안 구웠다」로 떴고, 그 적색 하나가 배포 게이트를
      막았다(v9.311 이 커밋·백업까지 가고 라이브 앞에서 섰다). `룸벗기기` 머리말이 「원고에 달 일이
      생기면 이 자리부터 다시 본다」고 예고해 둔 자리다.
   🔑 개수가 아니라 **그 표식이 붙은 다른 class 로** 가른다 — 개수 순서로 맞추면 빌드가 «앞쪽»에
      더한 날 원고 것을 걷는다. 그래서 이 자는 «원고 것이 뒤, 빌드 것이 앞»인 판으로 잰다. */
test('🔴 원고가 스스로 «룸» 을 달면 되돌리기가 그것은 «안» 걷는다 — 빌드가 더한 것만 걷는다', () => {
  const 원고 = '<section class="표지">a</section>\n<section class="sheet 룸">b</section>';
  const 산출 = '<section class="표지 룸">a</section>\n<section class="sheet 룸">b</section>';
  assert.equal(빌드.unembed(산출, 원고), 원고,
    '원고가 이미 단 «룸» 까지 걷었다 — 그 지면은 다시 구워도 영영 「낡음」으로 뜬다');
  assert.equal(빌드.unembed(산출), '<section class="표지">a</section>\n<section class="sheet">b</section>',
    '원고를 안 주면 예전처럼 전부 걷어야 한다(옛 호출부·시험 호환)');
});

/* ── ⑧ 자리표는 도로 세운다 ─────────────────────────────────────────────────
   🔴 같은 날 같은 자리에서 나온 둘째 구멍 — 빌드가 심는 것은 다섯인데(활자·쪽번호·Loom·펠트 천·
      마스코트) 되돌리는 것이 셋뿐이라, 자리표를 쓰는 지면이 영영 어긋났다.
   🔑 심긴 값(base64)으로 되맞추지 않는다 — 마스코트는 줄여서 심으므로 그 바이트를 다시 만들려면
      파이썬을 불러야 하고, 그러면 `--check` 가 외부 도구에 매달려 CI 에서 거짓 적색이 된다. */
test('🔴 심긴 자리표를 도로 세운다 — 못 맞추면 «반쯤 되돌린 판»을 내지 않는다', () => {
  const 원고 = '<style>--천:url("@@펠트종이@@");</style><img src="@@마스코트@@">';
  const 산출 = '<style>--천:url("data:image/webp;base64,AAAA");</style><img src="data:image/webp;base64,BBBB">';
  assert.equal(빌드.unembed(산출, 원고), 원고, '자리표를 못 세웠다 — 그 지면은 영영 「낡음」이다');

  /* 자산 파일이 없어 «빈 채»로 심긴 자리도 맞아야 한다(심기가 그때 자리표를 빈 문자열로 지운다). */
  const 빈판 = '<style>--천:url("");</style><img src="">';
  assert.equal(빌드.unembed(빈판, 원고), 원고, '파일이 없어 비워진 자리를 못 세웠다');

  /* 조각이 어긋나면 손대지 않는다 — 틀릴 때 방향은 「낡았다」여야지 「성하다」가 아니다. */
  const 갈린판 = '<style>--다른천:url("data:image/webp;base64,AAAA");</style><img src="data:image/webp;base64,BBBB">';
  assert.equal(빌드.unembed(갈린판, 원고), 갈린판, '못 맞췄는데 반쯤 되돌렸다 — 낡음 판정이 조용히 틀린다');
});
