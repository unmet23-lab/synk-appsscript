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

test('🔑 [옛 통로 금지] 호출부가 engineSource() 를 다시 접지 않는다 — 같은 판정이 두 곳이면 갈라진다', () => {
  const 샌곳 = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'tests')).filter((x) => x.endsWith('.test.js'))) {
    const src = fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8');
    /* 겨누는 것은 «engineSource() 의 결과를 다시 줄끝 접는» 표기 하나다.
     * 파일을 직접 읽어 접는 호출부는 이 이음매 밖이라 대상이 아니다(그건 별건 · 장부 F526 ▶). */
    if (/engineSource\(\)\s*\.replace\(\/\\r/.test(src)) 샌곳.push(f);
  }
  assert.deepEqual(샌곳, [], `이 파일들이 이음매 뒤에서 또 접는다: ${샌곳.join(', ')}`);
});
