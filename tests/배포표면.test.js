/* 배포 표면 가드 회귀 테스트 — tools/deploy-security-check.js
 *
 * 왜 이 테스트가 있나: 2026-08-02 임시 doGet 러너 실사고를 수리한 뒤, 같은 결함이 다시 들어오는 것을
 * 기계로 막으려고 가드를 세웠다. 그런데 **가드는 조용히 눈이 먼다** — 판별식을 한 글자 고치면
 * 통과율이 100%가 되고, 초록 화면은 "멀쩡하다"로 읽힌다([[guard-must-check-result]]).
 * 그래서 가드가 「무엇을 잡아야 하는가」와 「무엇을 잡으면 안 되는가」를 양쪽 다 못박는다.
 * 실측 기준선: 08-02에 길이(16자)만 보게 했더니 `p.op === 'purgeTestCheckins'` 가 시크릿으로 걸렸다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { looksSecret, topLevelFunctions, parseDeploymentLine } = require('../tools/deploy-security-check.js');

test('looksSecret — 난수 토큰은 잡는다(미탐 방지)', () => {
  // 08-02 실사고의 실제 토큰 모양(소문자·대문자·숫자·구분자 4종)
  assert.strictEqual(looksSecret('2Kn1KrbV-NAUVoCxjiGT7It7_-ueMp0_'), true);
  assert.strictEqual(looksSecret('AKfycbyu3CD5tD-0saS42bWiS7CAtl2z'), true);
  // 대소문자가 없는 hex 다이제스트 — 문자 종류 규칙만으로는 새므로 따로 태우는 경로
  assert.strictEqual(looksSecret('a3f9c2e1b8d74f60a3f9c2e1b8d74f60'), true);
});

test('looksSecret — 사람이 지은 이름은 잡지 않는다(오탐 방지)', () => {
  // 이 한 줄이 08-02에 실제로 오탐났던 값이다. 회귀하면 여기서 죽는다.
  assert.strictEqual(looksSecret('purgeTestCheckins'), false);
  assert.strictEqual(looksSecret('updateBizDashboard'), false);
  assert.strictEqual(looksSecret('sheetSelfHealNow'), false);
});

test('topLevelFunctions — doGet 본문이 다음 함수까지만 잘린다', () => {
  const src = [
    'function doGet(e) {',
    '  const p = e.parameter;',
    '  return ok(p);',
    '}',
    '',
    'function doPost(e) {',
    '  sh.deleteRow(2);',   // doPost의 삭제는 doGet 본문에 새면 안 된다
    '}',
  ].join('\n');
  const fns = topLevelFunctions(src);
  assert.deepStrictEqual(fns.map((f) => f.name), ['doGet', 'doPost']);
  assert.ok(!fns[0].body.includes('deleteRow'), 'doGet 본문이 doPost까지 삼켰다 — 경계 판정 붕괴');
  assert.strictEqual(fns[0].line, 1);
  assert.strictEqual(fns[1].line, 6);
});

/* 아래 3줄은 2026-08-02 `clasp deployments` **실제 출력**이다(설명만 원문 유지, ID는 그대로).
 * 임시 배포를 잘 정리할수록 이 판정은 라이브에서 한 번도 안 돌아 — 깨져도 초록이 된다.
 * 그래서 실측 출력을 여기 박아 테스트가 대신 지킨다. */
test('parseDeploymentLine — 임시 배포를 가려낸다', () => {
  const temp = parseDeploymentLine(
    '- AKfycbz-UieG50Mom61UXIrEt-gvqXBWVHiIIaAMVFxPp_-ZuQXrmcQ6rvQeA8K8LIvc5Bic @28 - temp-data-cleanup-runner'
  );
  assert.strictEqual(temp.ver, '28');
  assert.strictEqual(temp.desc, 'temp-data-cleanup-runner', "설명 앞의 '- '가 안 떨어졌다");
  assert.strictEqual(temp.temp, true);

  // @HEAD 줄은 설명이 비어 있다 — 여기서 temp=true가 되면 상시 배포가 매번 걸려 가드가 노이즈가 된다
  const head = parseDeploymentLine('- AKfycbyErIaGA8TGxVMoVO3r5ou1RllX9l1-uMJx4p4CrG0 @HEAD ');
  assert.strictEqual(head.ver, 'HEAD');
  assert.strictEqual(head.temp, false);

  assert.strictEqual(parseDeploymentLine('Found 3 deployments.'), null);
});

test('topLevelFunctions — 문자열·주석 안의 중괄호에 속지 않는다', () => {
  const src = [
    'function doGet(e) {',
    '  const s = "}{ 닫는 괄호처럼 생긴 문자열 }";',
    '  /* } 주석 안의 닫는 괄호 */',
    '  return s;',
    '}',
    'function next() { return 1; }',
  ].join('\n');
  const fns = topLevelFunctions(src);
  assert.deepStrictEqual(fns.map((f) => f.name), ['doGet', 'next']);
  assert.ok(fns[0].body.includes('return s;'), 'doGet 본문이 문자열 중괄호에서 조기 종료됐다');
});
