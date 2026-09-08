'use strict';
/* 직장 경험 폼 서명이 «묻는 자리»를 보는가 — 2026-09-08 (배포 검수 P1 0b525a02163c · P2 61e7fc738d02·050b0b7ad402)
 *
 * 무엇을 지키나: 폼을 「우리 폼」으로 채택하는 자가 **제목 글자만** 세지 않는가.
 *   글자만 세면 섹션 머리·설명 블록에 그 이름을 붙여 흉내 낼 수 있고, 그러면 **묻는 문항이 하나도
 *   없는 폼**이 서명을 통과한다. 그 뒤 `setDestination` 이 그 폼을 정본으로 굳히면 되돌릴 수 없다.
 *
 * 🔑 필수 여부(isRequired)는 일부러 안 잰다 — 라이브 폼이 옛 판이라 선택으로 서 있을 수 있는데
 *   그것을 **안 재봤다**. 안 재본 것으로 문을 잠그면 진짜 폼이 거절돼 복구 길이 막힌다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 폼 = fs.readFileSync(path.join(REPO, '엔진_폼리포트.js'), 'utf8');

function 떼어오기(소스, 머리) {
  const i = 소스.indexOf(머리);
  assert.ok(i >= 0, '함수를 못 찾았다: ' + 머리);
  const j = 소스.indexOf('\n}', i);
  assert.ok(j > i, '함수 끝을 못 찾았다: ' + 머리);
  return 소스.slice(i, j + 2);
}

const 제목자 = 떼어오기(폼, 'function 직장폼제목_(');
const 묻는자 = 떼어오기(폼, 'function 묻는문항_(');
const 서명자 = 떼어오기(폼, 'function 직장폼서명_(');

const T = { SECTION_HEADER: 'SECTION_HEADER', PAGE_BREAK: 'PAGE_BREAK', IMAGE: 'IMAGE', VIDEO: 'VIDEO', TEXT: 'TEXT', PARAGRAPH_TEXT: 'PARAGRAPH_TEXT' };
const TITLE = 'SYNK 직장 경험 기록';

function 서명만들기(로그 = []) {
  return new Function('FormApp', 'WORK_FORM_TITLE', 'DriveApp', 'Logger',
    제목자 + '\n' + 묻는자 + '\n' + 서명자 + '\nreturn { 직장폼서명_, 묻는문항_ };'
  )({ ItemType: T }, TITLE, { getFileById: () => { throw new Error('안 쓴다'); } },
    { log: (m) => 로그.push(String(m)) });
}

/** 폼 한 장 모사 — 설문지 제목 + 문항 목록(종류까지). */
const 가짜폼 = (제목, 문항들) => ({
  getTitle: () => 제목,
  getId: () => 'FORM1',
  getItems: () => 문항들.map(([t, 종류]) => ({ getTitle: () => t, getType: () => 종류 })),
});

const 진짜문항 = [
  ['일한 곳', T.TEXT], ['무슨 일', T.PARAGRAPH_TEXT], ['시킨 일 그대로', T.PARAGRAPH_TEXT],
  ['예정에 없던 일이 생긴 적', T.PARAGRAPH_TEXT], ['자료활용동의', T.MULTIPLE_CHOICE],
];

test('① 진짜 폼은 그대로 지난다 — 대조군(이 줄이 빨가면 아래 시험은 무의미하다)', () => {
  const { 직장폼서명_ } = 서명만들기();
  assert.strictEqual(직장폼서명_(가짜폼(TITLE, 진짜문항), false), true);
});

test('🔴 ② 이름을 «섹션 머리»로만 흉내 낸 폼은 거절한다 (검수 P1 0b525a02163c)', () => {
  const { 직장폼서명_ } = 서명만들기();
  const 흉내 = 가짜폼(TITLE, [
    ['시킨 일 그대로', T.SECTION_HEADER],
    ['예정에 없던 일이 생긴 적', T.SECTION_HEADER],
  ]);
  assert.strictEqual(직장폼서명_(흉내, false), false,
    '묻는 문항이 하나도 없는 폼이 서명을 통과하면 setDestination 이 그 폼을 정본으로 굳힌다');
});

test('🔴 ③ 쪽 나눔·사진·영상 블록도 «묻는 자리»가 아니다', () => {
  const { 직장폼서명_ } = 서명만들기();
  for (const 종류 of [T.PAGE_BREAK, T.IMAGE, T.VIDEO]) {
    const f = 가짜폼(TITLE, [['시킨 일 그대로', 종류], ['예정에 없던 일이 생긴 적', 종류]]);
    assert.strictEqual(직장폼서명_(f, false), false, 종류 + ' 를 문항으로 셌다');
  }
});

test('④ 한쪽만 흉내여도 거절한다 — 둘 다 있어야 서명이다', () => {
  const { 직장폼서명_ } = 서명만들기();
  const f = 가짜폼(TITLE, [['시킨 일 그대로', T.PARAGRAPH_TEXT], ['예정에 없던 일이 생긴 적', T.SECTION_HEADER]]);
  assert.strictEqual(직장폼서명_(f, false), false);
});

test('🔴 ⑤ 종류를 «못 읽으면» 예전대로 지나되, 그 사실이 기록에 남는다 (2회차 c8c1d42fedc7)', () => {
  const 로그 = [];
  const { 직장폼서명_ } = 서명만들기(로그);
  const f = {
    getTitle: () => TITLE, getId: () => 'FORM1',
    getItems: () => 진짜문항.map(([t]) => ({ getTitle: () => t, getType() { throw new Error('권한 없음'); } })),
  };
  assert.strictEqual(직장폼서명_(f, false), true, '종류를 못 읽는다고 진짜 폼이 거절되면 복구 길이 막힌다');
  /* 열린 기본값은 «옛 동작»이라 그대로 두되, 조용하면 「안 쟀다」와 「괜찮다」가 같은 모양이 된다. */
  assert.ok(로그.length > 0, '형상 검사가 우회된 사실이 어디에도 안 남는다');
  assert.match(로그[0], /못 읽어/);
});

/* 🔴 [09-08 검수 2회차 748eb20e6452] 앞 판 ⑥ 은 «소스에 그 글자가 있나»만 봤다. 그래서 아래 ⑦ 이
 *   짚는 진짜 결함(옛 완료 도장을 안 뗀다)이 있는데도 초록이었다 — [[test-guards-the-defect]] 의 그 무늬다.
 *   ⇒ 완료 도장 블록을 소스에서 «떼어 내» 실제로 돌리고, 도장에 «무엇이 적혔나»를 본다. */
function 도장블록뽑기() {
  const i = 폼.indexOf('const 있는문항 = f0.getItems()');
  assert.ok(i > 0, '완료 도장 블록을 못 찾았다 — 모양이 바뀌었으면 이 뽑기도 함께 고친다');
  const j = 폼.indexOf("빠진필수.join(' · '));", i);
  assert.ok(j > i, '완료 도장 블록의 끝을 못 찾았다');
  const k = 폼.indexOf('\n          }', j);
  assert.ok(k > j, '완료 도장 블록의 닫는 괄호를 못 찾았다');
  return 폼.slice(i, k + 12);
}

const 필수소스 = /const WORK_REQUIRED_ = \[[^\]]*\];/.exec(폼);
assert.ok(필수소스, '필수 문항 정본 배열을 못 찾았다');

/* 🔑 앞머리 값도 «소스에서» 가져온다 — 시험에 그 글자를 다시 적으면 한 값을 두 곳이 알게 되어 갈린다. */
const 앞머리소스 = /const WORK_DONE_MISSING_ = '[^']*';/.exec(폼);
assert.ok(앞머리소스, '완료 표식의 «까닭» 앞머리 상수를 못 찾았다');
const WORK_DONE_MISSING_ = new Function(앞머리소스[0] + '\nreturn WORK_DONE_MISSING_;')();

/** 완료 도장 블록을 실제로 돌린다. `담을곳` 에 app_state 에 적힌 값이 그대로 들어온다. */
function 도장돌리기(폼객체, 담을곳) {
  const { 묻는문항_ } = 서명만들기();
  const WORK_REQUIRED_ = new Function(필수소스[0] + '\nreturn WORK_REQUIRED_;')();
  const f = new Function('f0', '묻는문항_', 'WORK_REQUIRED_', 'WORK_DONE_MISSING_', 'setState', 'st', 'Logger',
    도장블록뽑기() + '\nreturn 빠진필수;');
  return f(폼객체, 묻는문항_, WORK_REQUIRED_, WORK_DONE_MISSING_, (_st, k, v) => { 담을곳[k] = v; }, {}, { log() {} });
}

test('⑥ 필수 다섯이 다 «묻는 자리»면 완료 도장을 찍는다 — 대조군', () => {
  const 담김 = {};
  const 빠짐 = 도장돌리기(가짜폼(TITLE, 진짜문항), 담김);
  assert.deepEqual(빠짐, []);
  assert.strictEqual(담김['직장폼완료'], 'y');
});

test('🔴 ⑦ 필수가 빠지면 «이미 찍혀 있던» 완료 도장을 뗀다 (검수 2회차 P1 0226902a897b)', () => {
  /* 앞 판은 「안 찍는다」로만 두었다. 그래서 폼 ID 는 비었는데 완료 표식만 y 로 남은 상태에서
   *   이 경로를 타면, 「자료활용동의」가 빠진 것을 **발견하고도** y 가 살아 있어 아래 「만들다 만 상태」
   *   안내(`!== 'y'` 로 걸린다)를 지나쳐 「이미 있습니다」로 끝났다 — 동의 없는 응답이 조용히 쌓인다. */
  const 담김 = { 직장폼완료: 'y' };                        // 옛 도장이 남아 있는 자리
  const 흉내 = 가짜폼(TITLE, [
    ['일한 곳', T.TEXT], ['무슨 일', T.PARAGRAPH_TEXT], ['시킨 일 그대로', T.PARAGRAPH_TEXT],
    ['예정에 없던 일이 생긴 적', T.PARAGRAPH_TEXT],
    ['자료활용동의', T.SECTION_HEADER],                    // 묻지 않는 블록으로 흉내
  ]);
  const 빠짐 = 도장돌리기(흉내, 담김);
  assert.deepEqual(빠짐, ['자료활용동의'], '섹션 머리를 필수 문항으로 세면 안 된다');
  assert.notStrictEqual(담김['직장폼완료'], 'y',
    '옛 도장을 안 떼면 「이미 있습니다」로 지나가 동의 없는 응답이 쌓인다');
  /* 🔴 [5회차 P1 d8eb1dbcd4b9] 빈 값이 아니라 «까닭»이라야 아래 안내가 갈래를 가른다. */
  assert.strictEqual(담김['직장폼완료'], '필수누락:자료활용동의',
    '왜 뗐는지를 안 남기면 그 뒤 안내가 「섹션 7개를 보고 y 를 적으세요」로 나가 누락이 그대로 지나간다');
});

test('🔴 ⑧ 그 뒤 안내가 «무엇이 빠졌는지»를 이름으로 말한다 (검수 5회차 P1 d8eb1dbcd4b9)', () => {
  /* 표식을 떼는 길을 열었는데 그 길 «끝»의 안내가 옛것이었다. 안내대로 y 를 손으로 넣으면
   *   방금 찾아낸 누락이 그대로인 채 재실행이 「이미 있습니다」로 끝난다. */
  const 안내자 = new Function('WORK_DONE_MISSING_',
    떼어오기(폼, 'function 직장폼미완안내_(') + '\nreturn 직장폼미완안내_;')('필수누락:');

  const 누락안내 = 안내자('필수누락:자료활용동의', 'https://example/x');
  assert.match(누락안내, /자료활용동의/, '무엇이 빠졌는지를 이름으로 말하지 않는다');
  assert.match(누락안내, /y 를 손으로 적지 마세요/, '손으로 도장을 찍지 말라고 말해야 한다');
  assert.ok(누락안내.indexOf('섹션 7개') === -1, '누락 갈래에 「섹션 7개를 세라」가 남아 있으면 엉뚱한 곳을 보신다');

  /* 옛 갈래(표식이 애초에 없다)는 그대로 남아야 한다 — 그 폼을 위해 있던 안내다. */
  const 끊긴안내 = 안내자('', 'https://example/x');
  assert.match(끊긴안내, /섹션 7개/, '문항을 붙이다 끊긴 폼의 안내가 사라졌다');
  assert.match(끊긴안내, /y 로 적으면 됩니다/, '그 갈래에서는 손으로 적는 것이 맞다');
});
