'use strict';
/* F1 무료 진단 폼 «설명 한 줄» — 두 언어가 같은 약속을 하고, 이미 열린 폼까지 닿는다.
 *
 * ■ 왜 이 자가 있나 (2026-09-08)
 *   이 한 줄은 **밖으로 나가는 첫 글**이다(10월 첫 주 · 명품 마케팅 §⑬ 걸음 2). 두 번 밟았다:
 *   ① 09-08 오전에 **한국어만** 갈았다 — 그러면 한국어는 「어느 단계인지 보낸다」고 하고
 *      몽골어는 「진단 리포트가 간다」고 해 **두 언어가 서로 다른 약속을 한다**.
 *      tests/몽골어출구.test.js 가 잡아서 되돌렸다(그 문은 「검문을 지났나」를 본다 — 짝이 맞나는
 *      안 본다). 이 파일이 그 남은 축을 잰다.
 *   ② 폼을 만드는 자리는 «폼이 없을 때만» 돈다(멱등 · v9.60). 그래서 **코드를 고쳐도 이미 열린
 *      폼은 옛 문안을 그대로 단다** — 학생이 여는 것은 그 폼이다. 「코드를 고쳤으니 됐다」가
 *      여기서는 거짓이다. 그 손잡이(f1폼설명갱신)를 실제로 «돌려서» 잰다.
 *
 * ■ 이 자가 «안» 보는 것 — 먼저 밝힌다
 *   · 몽골어가 «맞는가»는 안 본다(기계 검문 = tools/몽골어대조.js · 마지막 도장은 원어민).
 *   · 폼이 실제로 갈렸는지도 안 본다(라이브는 이 자의 손 밖이다 — 가짜 폼으로 «갈려고 하는가»만).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');

/** 소스에서 한 덩이를 떼어낸다 — 시작 표식부터 끝 표식까지(끝 표식 포함). */
function 떼기(시작표식, 끝표식) {
  const a = SRC.indexOf(시작표식);
  assert.notStrictEqual(a, -1, `소스에서 「${시작표식}」 를 못 찾았다 — 표식이 바뀌었나`);
  const b = SRC.indexOf(끝표식, a);
  assert.notStrictEqual(b, -1, `소스에서 「${끝표식}」 를 못 찾았다 — 표식이 바뀌었나`);
  return SRC.slice(a, b + 끝표식.length);
}

const 다섯단계 = ['입문', '초급 1', '초급 2', '중급 1', '중급 2+'];

/** 실물 소스의 문안 정본을 «실제로 실행해서» 값을 받는다(소스 글자 대조가 아니다). */
function 문안읽기() {
  const 덩이 = 떼기('const F1_설명_KR', 'function F1_폼_설명_() { return F1_설명_KR + \'\\n\' + F1_설명_MN; }');
  return new Function(덩이 + '\nreturn { KR: F1_설명_KR, MN: F1_설명_MN, 짝: F1_폼_설명_() };')();
}

test('🔴 두 언어가 «같은 약속»을 한다 — 다섯 단계 이름이 양쪽에 다 있다', () => {
  const { KR, MN } = 문안읽기();
  const 빠진KR = 다섯단계.filter((n) => !KR.includes(n));
  const 빠진MN = 다섯단계.filter((n) => !MN.includes(n));
  assert.deepStrictEqual(빠진KR, [], '한국어 쪽에 없는 단계 이름이 있다');
  assert.deepStrictEqual(빠진MN, [], '몽골어 쪽에 없는 단계 이름이 있다 — 한쪽만 고쳤다(09-08 에 밟은 그 자리)');
});

test('🔑 단계 이름은 학생이 «리포트에서 받는 이름»과 같다', () => {
  /* 폼이 「입문」이라 하고 리포트가 다른 이름을 내면 학생은 자기가 뭘 받았는지 모른다.
   * 리포트 쪽 이름은 아래 `lvl` 이 쥔다 — 거기서 읽어 견준다(손으로 베끼지 않는다). */
  const lvl덩이 = 떼기("const lvl = score <= 4", "d: '심화 문형·유창성 단계' };");
  const 리포트이름 = (lvl덩이.match(/n: '([^']+)'/g) || []).map((s) => s.slice(4, -1));
  assert.deepStrictEqual(리포트이름, 다섯단계,
    '폼이 약속한 단계 이름과 리포트가 내는 이름이 갈렸다');
});

test('🔴 문안 «정본은 한 곳»이다 — 폼 설명에 날문자열을 다시 적지 않는다', () => {
  /* 읽는 자리가 둘(새 폼 만들기 · 이미 열린 폼 갈기)이라, 한 곳이 제 문자열을 들면 곧 갈린다.
   * (기억 `constant-known-in-two-places` 의 그 무늬) */
  const 호출 = SRC.match(/setDescription\([^)]*\)/g) || [];
  assert.ok(호출.length >= 2, 'setDescription 호출이 둘(만들기·갈기)보다 적다 — 갈기 통로가 사라졌나');
  const 날문자열 = 호출.filter((s) => /['"`]/.test(s));
  assert.deepStrictEqual(날문자열, [],
    '폼 설명에 문자열을 직접 적었다 — 정본은 F1_설명_KR·F1_설명_MN 하나뿐이다');
});

test('🔴 이미 열린 폼을 «실제로 갈려고 한다» — 코드만 고치면 학생은 옛 문안을 본다', () => {
  const { 짝 } = 문안읽기();
  const 함수덩이 = 떼기('function f1폼설명갱신() {', '\n}');
  const 문안덩이 = 떼기('const F1_설명_KR', 'function F1_폼_설명_() { return F1_설명_KR + \'\\n\' + F1_설명_MN; }');

  /** 가짜 무대 한 벌 — 시트·폼·로그. */
  function 무대({ 시트있나 = true, 편집URL = 'https://docs.google.com/forms/d/AAA/edit', 설명 = '옛 문안' } = {}) {
    const 기록 = { 쓴값: null, 로그: [] };
    const 폼 = {
      getDescription: () => 설명,
      setDescription: (v) => { 기록.쓴값 = v; 설명 = v; },
    };
    const 판 = new Function('무대', `
      const SpreadsheetApp = 무대.SpreadsheetApp, FormApp = 무대.FormApp, Logger = 무대.Logger;
      ${문안덩이}
      ${함수덩이}
      return f1폼설명갱신();
    `);
    const 짐 = {
      SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (시트있나 && n === '레벨테스트_응답' ? { getFormUrl: () => 편집URL } : null) }) },
      FormApp: { openByUrl: (u) => { if (!u) throw new Error('빈 URL'); return 폼; } },
      Logger: { log: (m) => 기록.로그.push(String(m)) },
    };
    return { 돌리기: () => 판(짐), 기록 };
  }

  // ① 옛 문안이 달려 있으면 정본으로 갈아 끼운다
  const a = 무대();
  const 답a = a.돌리기();
  assert.strictEqual(a.기록.쓴값, 짝, '이미 열린 폼에 정본을 안 씌웠다');
  assert.match(답a, /갈았습니다/, '무엇을 했는지 말하지 않는다');

  // ② 여러 번 눌러도 같다 — 이미 같으면 «아무것도 쓰지 않는다»
  const b = 무대({ 설명: 짝 });
  const 답b = b.돌리기();
  assert.strictEqual(b.기록.쓴값, null, '같은 값을 다시 썼다 — 멱등이 아니다');
  assert.match(답b, /이미 정본과 같습니다/, '안 바꿨다는 것을 말하지 않는다');

  // ③ 폼이 아직 없으면 «조용히 성공»하지 않는다 — 무엇을 해야 하는지 말한다
  const c = 무대({ 시트있나: false });
  const 답c = c.돌리기();
  assert.strictEqual(c.기록.쓴값, null);
  assert.match(답c, /createLevelTestForm/, '폼이 없을 때 다음 걸음을 안 준다');

  // ④ 시트는 있는데 폼 연결이 끊겼으면 그것도 갈라 말한다(③과 다른 처방이다)
  const d = 무대({ 편집URL: '' });
  const 답d = d.돌리기();
  assert.strictEqual(d.기록.쓴값, null);
  assert.match(답d, /연결/, '시트-폼 연결이 끊긴 것을 「폼이 없다」와 같이 말한다');
});
