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

function 서명만들기() {
  return new Function('FormApp', 'WORK_FORM_TITLE', 'DriveApp',
    제목자 + '\n' + 묻는자 + '\n' + 서명자 + '\nreturn { 직장폼서명_, 묻는문항_ };'
  )({ ItemType: T }, TITLE, { getFileById: () => { throw new Error('안 쓴다'); } });
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

test('🔴 ⑤ 종류를 «못 읽으면» 예전대로 지난다 — 안 재본 것으로 진짜 폼을 막지 않는다', () => {
  const { 직장폼서명_ } = 서명만들기();
  const f = {
    getTitle: () => TITLE, getId: () => 'FORM1',
    getItems: () => 진짜문항.map(([t]) => ({ getTitle: () => t, getType() { throw new Error('권한 없음'); } })),
  };
  assert.strictEqual(직장폼서명_(f, false), true, '종류를 못 읽는다고 진짜 폼이 거절되면 복구 길이 막힌다');
});

test('⑥ 완료 도장도 같은 자를 쓴다 — 응답 탭 복구 경로가 「묻는 자리」만 센다', () => {
  assert.ok(/있는문항 = f0\.getItems\(\)\.filter\(묻는문항_\)/.test(폼),
    '완료 도장이 섹션 머리를 필수 문항으로 세면 「자료활용동의」 없이 응답이 쌓인다');
});
