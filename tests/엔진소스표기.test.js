'use strict';
/* 표식 절단이 «표기»가 아니라 «행동»을 재는지 못박는다 — F526 ㉠ (2026-08-17)
 *
 * ■ 무엇이 났나 (실측이다 — 추정이 아니다)
 *   행동을 한 글자도 안 바꾸는 변형을 얼린 트리에 얹고 스위트 전량을 돌렸다(분모 3895):
 *     · 줄끝 LF→CRLF (1363 파일)      → 새 적색 **0**
 *     · 줄 끝에 공백 한 칸 (372 파일) → 새 적색 **40**, 그중 **28건이 「섹션 끝 표식을 찾지 못함」**
 *     · 머리 주석 1줄 (372 파일)      → 새 적색 3
 *   CRLF 가 0인 이유는 안전해서가 아니라 **08-03 에 이미 터져서 호출부 세 곳이 각자 접고 있었기**
 *   때문이다. 형제 축(줄끝 공백)은 안 막혀 있었고, 그 하나가 수집 24 · 소급성 4 를 한꺼번에 죽였다.
 *
 * ■ 왜 이 회귀가 필요한가
 *   접기를 이음매(`_engine-source`)로 옮겼다. 그런데 **접기가 죽어도 실저장소는 초록일 수 있다** —
 *   지금 소스에 줄끝 공백이 우연히 0이면 접기가 없어도 통과한다. 그래서 탐지력은 **픽스처가** 지고,
 *   실저장소에는 거짓양성만 검사한다(CLAUDE.md 신뢰성 ②).
 *
 * ■ ⚠ 이 파일이 «안» 지는 것
 *   부정 단언(「~가 없어야 한다」)이 표기 때문에 **조용히 초록**이 되는 방향은 여기서 못 본다 —
 *   패턴이 안 맞으면 그냥 통과라 적색이 안 난다. 그 축은 변이(`tools/변이.js`)가 지는 자리다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROOT, ENGINE_FILES, engineSource, engineParts, 표기접기 } = require('./_engine-source');
const 소스검사 = require('./lib/소스검사');

/* 실제로 죽던 그 모양 그대로 — `'\n}\n'` 처럼 **줄 끝을 걸친** 표식으로 구간을 자른다. */
function 잘라본다(소스, 시작, 끝) {
  const s = 소스.indexOf(시작);
  if (s === -1) return null;
  const e = 소스.indexOf(끝, s + 시작.length);
  if (e === -1) return null;
  return 소스.slice(s, e);
}

const 원본 = 'function quizSweep_(ss) {\n  var a = 1;\n}\nfunction next_() {\n}\n';

/* ── 탐지력 — 픽스처가 진다 ─────────────────────────────────────────────── */

test('🔴 [탐지력] 줄 끝 공백만 다른 판도 같은 구간을 자른다 — 40건 중 28건이 여기서 났다', () => {
  const 공백판 = 원본.replace(/\n/g, ' \n');
  assert.notEqual(원본, 공백판, '픽스처가 애초에 안 다르다 — 이 검사가 무의미해진다');

  /* 접기 없이는 «진짜로» 죽는지부터 보인다 — 안 죽으면 이 회귀가 무엇을 지키는지 알 수 없다. */
  assert.equal(잘라본다(공백판, 'function quizSweep_(ss) {', '\n}\n'), null,
    '접기 없이도 표식이 잡힌다면 이 픽스처가 실패 모드를 재현하지 못한 것이다');

  assert.equal(잘라본다(표기접기(공백판), 'function quizSweep_(ss) {', '\n}\n'),
    잘라본다(원본, 'function quizSweep_(ss) {', '\n}\n'));
});

test('🔴 [탐지력] CRLF 만 다른 판도 같은 구간을 자른다 — 08-03 에 9건을 죽인 축', () => {
  const crlf = 원본.replace(/\n/g, '\r\n');
  assert.equal(잘라본다(crlf, 'function quizSweep_(ss) {', '\n}\n'), null, '픽스처가 실패 모드를 재현 못 함');
  assert.equal(잘라본다(표기접기(crlf), 'function quizSweep_(ss) {', '\n}\n'),
    잘라본다(원본, 'function quizSweep_(ss) {', '\n}\n'));
});

test('🔴 [좁게] 내용이 갈리면 접어도 그대로 잡힌다 — 접기가 진짜 갈림을 삼키면 그게 더 나쁘다', () => {
  const 갈린판 = 원본.replace('var a = 1;', 'var a = 2;').replace(/\n/g, ' \r\n');
  assert.notEqual(표기접기(갈린판), 표기접기(원본));
  assert.ok(/var a = 2;/.test(표기접기(갈린판)), '접기가 내용까지 지웠다');
});

test('🔴 [좁게] 줄 «가운데» 공백은 안 건드린다 — 들여쓰기·간격은 그대로 뜻이다', () => {
  const s = '  var a  =  1;\n';
  assert.equal(표기접기(s), '  var a  =  1;\n');
});

test('개행이 없는 마지막 줄의 꼬리 공백도 접는다 — 파일 끝이 사각으로 남던 자리', () => {
  assert.equal(표기접기('var a = 1;   '), 'var a = 1;');
});

/* ── 실저장소 — 거짓양성만 (탐지력은 위가 진다) ──────────────────────────── */

test('실저장소: engineSource() 에는 CR 도 줄끝 공백도 없다 — 접기가 실제로 돈다', () => {
  const code = engineSource();
  assert.equal(code.indexOf('\r'), -1, 'CR 이 남았다 — 접기가 안 돌았거나 이음매를 우회한 호출이 있다');
  const 샌줄 = code.split('\n').map((l, i) => (/[ \t]$/.test(l) ? i + 1 : 0)).filter(Boolean);
  assert.deepEqual(샌줄, [], `줄끝 공백이 남은 줄: ${샌줄.slice(0, 5).join(',')}`);
});

test('🔑 배선 — engineParts() 는 **안 접는다**. 두 이음매가 일부러 다르다', () => {
  /* 구문 검사·톱레벨 스코프는 원문이 뜻이다. 합치면 한쪽이 반드시 틀린다.
   * ⚠ 「CR 이 있다」로 재지 않는다 — 그건 체크아웃 환경(autocrlf)에 기대는 검사라 CI 에서 갈린다(F296).
   *   대신 «파일 바이트 그대로인가»로 잰다. 이건 어느 환경에서도 같은 답을 낸다. */
  const parts = engineParts();
  assert.ok(parts.length > 0, `엔진 파일 0건 — 분모가 비면 이 검사는 판정이 아니다 (ENGINE_FILES ${ENGINE_FILES.length})`);
  for (const p of parts) {
    assert.equal(p.src, fs.readFileSync(path.join(ROOT, p.file), 'utf8'),
      `${p.file} — engineParts() 가 원문을 손댔다. 접기는 engineSource() 쪽 몫이다`);
  }
});

/* 겨누는 것은 «engineSource() 의 결과를 다시 줄끝 접는» 표기 하나다.
 * 파일을 직접 읽어 접는 호출부는 이 이음매 밖이라 대상이 아니다(그건 별건 · 장부 F526 ▶). */
const 옛통로인가 = (src) => /engineSource\(\)\s*\.replace\(\/\\r/.test(src);

test('🔴 [탐지력] 옛 통로 판별기가 실제로 잡는다 — 실저장소가 깨끗하면 아래 검사는 눈멀어도 초록이다', () => {
  assert.ok(옛통로인가("const code = engineSource().replace(/\\r\\n/g, '\\n');"), '거둔 그 표기를 못 잡는다');
  assert.ok(옛통로인가('const code = engineSource()\n  .replace(/\\r/g, ""); '), '줄을 바꿔 쓰면 빠져나간다');
  assert.ok(!옛통로인가('const code = engineSource();'), '거짓양성 — 정상 호출을 위반으로 읽는다');
  assert.ok(!옛통로인가("const s = 원고.replace(/\\r\\n/g, '\\n');"), '거짓양성 — 이음매 밖의 접기까지 잡는다');
});

test('🔑 [옛 통로 금지] 실저장소: 호출부가 engineSource() 를 다시 접지 않는다 (거짓양성 검사)', () => {
  const 파일들 = fs.readdirSync(path.join(ROOT, 'tests')).filter((x) => x.endsWith('.test.js'));
  assert.ok(파일들.length > 0, '테스트 파일 0건 — 분모가 비면 이 초록은 판정이 아니다(F207)');
  const 샌곳 = 파일들.filter((f) => 옛통로인가(fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8')));
  assert.deepEqual(샌곳, [], `이 파일들이 이음매 뒤에서 또 접는다: ${샌곳.join(', ')}`);
});

/* ── #Q101 — 엔진 «밖» 파일을 읽는 자리도 같은 문을 지난다 (2026-08-17) ────────────────
 * F526 이 세운 접기는 자리가 `_engine-source` 라 **엔진 소스를 읽는 호출부만** 안전했다.
 * 엔진 아닌 파일을 읽는 자리엔 지날 문이 없어 저마다 손으로 접었고, 29벌 전부 CRLF 축만
 * 접은 반쪽이었다. 실측(분모 3945 · 새 적색 10): 표식 절단 5 = CI모사 2 · 리포트카드 2 · 수집 1.
 * 그래서 정의를 `lib/소스검사.js` 하나로 모으고 `파일소스()`·`구간()` 을 문으로 냈다. */

test('🔴 [탐지력] 접기 정의가 **한 벌**이다 — 두 곳이면 한쪽만 고쳐지는 날 갈라진다', () => {
  assert.equal(표기접기, 소스검사.표기접기,
    '`_engine-source` 가 자기 사본을 다시 들었다 — 같은 판정이 두 곳이면 갈라진다(CLAUDE.md)');
  const 사본 = fs.readFileSync(path.join(ROOT, 'tests', '_engine-source.js'), 'utf8');
  assert.doesNotMatch(사본, /const 표기접기 = /,
    '`_engine-source` 안에 접기 정의가 다시 생겼다 — 정의는 lib/소스검사.js 한 곳이다');
});

test('🔴 [탐지력] 표기접기 픽스처 — 실저장소가 우연히 깨끗하면 접기가 죽어도 초록이다', () => {
  assert.ok(소스검사.표기접기픽스처.length >= 4, '픽스처가 비면 이 초록은 판정이 아니다(F207)');
  for (const { 왜, 입력, 기대 } of 소스검사.표기접기픽스처) {
    assert.equal(소스검사.표기접기(입력), 기대, `접기가 이 축에서 죽었다 — ${왜}`);
  }
});

test('🔴 [탐지력] 구간() 은 앵커를 찾기 «전에» 접는다 — 표기 한 글자에 표식이 끊기던 자리', () => {
  const 원 = 'function f_(a) {\n  var x = 1;\n}\nfunction g_() {\n}\n';
  for (const [축, 판] of [['줄끝 공백', 원.replace(/\n/g, ' \n')], ['CRLF', 원.replace(/\n/g, '\r\n')]]) {
    /* 접기 없이는 «진짜로» 끊기는지부터 보인다 — 안 끊기면 이 픽스처가 실패 모드를 재현 못 한 것이다. */
    assert.equal(판.indexOf('\n}\n'), -1, `픽스처가 실패 모드를 재현 못 함 — ${축}`);
    assert.equal(소스검사.구간(판, 'function f_(a) {', '\n}\n'),
      소스검사.구간(원, 'function f_(a) {', '\n}\n'), `구간() 이 ${축} 축에서 다른 구간을 잘랐다`);
  }
});

test('🔴 [급소] 구간() 은 끝앵커를 못 찾으면 **던진다** — 손 자르기는 `slice(i, -1)` 로 파일 나머지를 삼켰다', () => {
  const 소스 = 'function f_() {\n  var x = 1;\n';   // 닫는 줄이 없다
  /* 옛 모양을 그대로 재현해 «무엇이 나빴는지»를 값으로 못박는다: 부정 단언이 뒤집히고(적색),
   * 긍정 단언은 조용히 초록이 된다. 둘 다 「엉뚱한 구간을 봤다」는 사실을 안 보여 준다. */
  const i = 소스.indexOf('function f_() {');
  assert.equal(소스.slice(i, 소스.indexOf('\n}\n', i)), 'function f_() {\n  var x = 1;',
    '옛 손 자르기가 파일 나머지를 삼키지 않는다면 이 회귀가 지킬 것이 없다');
  assert.throws(() => 소스검사.구간(소스, 'function f_() {', '\n}\n'), /못 찾았다/,
    '끝앵커가 없는데 조용히 무언가를 돌려준다 — 미실행이 초록과 같은 모양이 된다');
});

test('🔑 [실저장소] 엔진 밖 파일을 읽는 세 자리가 손 접기를 안 쓴다 (거짓양성 검사)', () => {
  /* 겨누는 것은 «이 트랙이 문으로 보낸 파일들»뿐이다 — 저장소 전량은 아직 29벌이고(실측),
   * 그 이관은 이 트랙 밖이다(장부 F526 ▶). 여기 목록만 되돌아가지 않게 못박는다. */
  const 문을쓴다 = ['CI모사.test.js', '리포트카드공개.test.js', '수집.test.js'];
  for (const f of 문을쓴다) {
    const src = fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8');
    assert.doesNotMatch(src, /readFileSync\([^)]*\)\s*\.replace\(\/\\r/,
      `${f} 가 손 접기로 돌아갔다 — 그 접기는 CRLF 축만 막는 반쪽이다(#Q101 실측)`);
    assert.match(src, /require\('\.\/lib\/소스검사(\.js)?'\)/, `${f} 가 공용 통로를 안 지난다`);
  }
});
