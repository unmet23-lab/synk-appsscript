'use strict';
/**
 * 오류사전 킬 스위치 — 「모으는 곳만 있고 쓰는 곳이 없는」 배치를 한 줄로 끌 수 있는가. (발전안 20260911 갈래 ③)
 *
 * ■ 재는 것
 *   ① 판정 함수 `오류사전꺼짐_` — 정확히 '1' 일 때만 꺼진다(빈칸·미설정·다른 값은 켜짐 = 옛 동작 그대로).
 *   ② 등록층 — aiStudioBatch_ 의 오류사전 갈래가 그 판정을 «실제로» 문에 건다(함수만 있고 안 걸면 초록과 같은 모양이다).
 *   ③ 정직성 — error_bank 를 읽는 코드가 엔진에 아직 0 이라는 사실을 이 회귀가 «관찰»로 남긴다. 소비자가 서면 이 단언을 지우고
 *      장부(엔진_셋업확장.js 수집도달_ hw_feedback 곁소비자 주석)를 같이 고친다 — 「있을 것을 요구하는 회귀」가 아니라 «지금 없다»를 이름 대는 것이다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { engineSource } = require('./_engine-source');
const { 코드만 } = require('./lib/소스검사.js');
const code = engineSource();

function 조각(시작, 끝) {
  const s = code.indexOf(시작);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${시작}`);
  const e = code.indexOf(끝, s + 시작.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${끝}`);
  return code.slice(s, e);
}

const 판정함수 = new Function(조각('function 오류사전꺼짐_(', 'function 오류뱅크포이즌_(') + '\nreturn 오류사전꺼짐_;')();

test('① 오류사전꺼짐_ — 정확히 1 일 때만 꺼진다', () => {
  assert.equal(판정함수('1'), true);
  assert.equal(판정함수(' 1 '), true);
  assert.equal(판정함수(''), false);
  assert.equal(판정함수(null), false);
  assert.equal(판정함수(undefined), false);
  assert.equal(판정함수('0'), false);
  assert.equal(판정함수('on'), false);
});

test('② 등록층 — 오류사전 갈래의 문이 실제로 이 판정을 건다', () => {
  const 갈래 = 조각('// ② G 오류사전', '// ③ H5 반 브리핑');
  assert.match(코드만(갈래), /can\(\)\s*&&\s*!오류사전꺼짐_\(props\.getProperty\('오류사전_OFF'\)\)/,
    '오류사전 갈래가 판정을 안 건다 — 함수만 있고 문에 안 걸면 스위치가 없는 것과 같다');
});

test('③ 관찰 — error_bank 를 읽는 코드가 엔진에 0 이다(소비자가 서면 이 단언과 장부 주석을 같이 고친다)', () => {
  const 몸 = 코드만(code);
  const 쓰기 = (몸.match(/ensureSheet\(ss, 'error_bank'/g) || []).length;
  assert.ok(쓰기 >= 1, '쓰는 자리가 사라졌다 — 이 관찰의 분모가 깨졌다');
  const 읽기 = (몸.match(/getSheetByName\(\s*'error_bank'\s*\)/g) || []).length;
  assert.equal(읽기, 0, `error_bank 를 읽는 자리가 ${읽기}곳 생겼다 — 소비자가 섰으면 이 단언을 지우고 시트 장부 곁소비자 주석과 발전안 갈래 ③ 결정을 갱신한다`);
});
