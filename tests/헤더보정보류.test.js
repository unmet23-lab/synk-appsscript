'use strict';
/* 야간 헤더 보정이 «보류한 열»을 덮지 않는가 — 2026-09-08 (배포 검수 P1 7d7e5ecc43e7)
 *
 * 무엇을 지키나: **값이 있는 «남의 이름» 열의 이름을 야간 통로가 덮지 않는가.**
 *   실물 = 라이브 `hw_feedback` 12열 「🔒 Row ID」(죽은 Glide 잔재 · 값 1행).
 *   아침 자(`시트칸정본맞추기_`)는 그 열을 정본 폭 «밖»으로 옮기거나(스위치 뒤) 그 표를 멈춘다.
 *   그런데 야간 AI 첨삭 배치가 부르는 `hwFeedbackEnsureCols_` 는 그 판정을 안 거치고
 *   `헤더보정_` 로 이름만 덮었다 — 덮는 순간 **그 열이 남의 것이었다는 마지막 증거**가 사라져
 *   아침 자도 못 알아보고, 옮길 기회가 영영 없어진다(소급 불가 · 유호 자리 = 1기 첫 주 전).
 *
 * 🔑 글자를 세지 않는다 — 함수를 실제로 돌려 «칸 이름이 어떻게 남았나»를 본다
 *   ([[test-guards-the-defect]]).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 셋업 = fs.readFileSync(path.join(REPO, '엔진_셋업확장.js'), 'utf8');
const 수집 = fs.readFileSync(path.join(REPO, '엔진_수집.js'), 'utf8');
const 콘텐츠 = fs.readFileSync(path.join(REPO, '엔진_콘텐츠AI.js'), 'utf8');

/** 열 0에서 닫히는 첫 중괄호까지를 함수 하나로 떼어 온다(Apps Script 전역이라 require 가 안 된다). */
function 떼어오기(소스, 머리) {
  const i = 소스.indexOf(머리);
  assert.ok(i >= 0, '함수를 못 찾았다: ' + 머리);
  const j = 소스.indexOf('\n}', i);
  assert.ok(j > i, '함수 끝을 못 찾았다: ' + 머리);
  return 소스.slice(i, j + 2);
}

const 값있나소스 = 떼어오기(셋업, 'function 열에값있나_(');
const 보류소스 = 떼어오기(수집, 'function 헤더보정보류_(');
const 증분소스 = 떼어오기(수집, 'function hwFeedbackEnsureCols_(');

/** 시트 한 장 모사 — 1행(칸 이름)과 그 아래 데이터 행. 쓰기는 실제로 반영된다. */
function 가짜시트(칸들, 아래 = []) {
  const cols = 칸들.slice();
  const 행들 = 아래.map((r) => r.slice());
  return {
    _칸: () => cols.slice(),
    getMaxColumns: () => cols.length,
    getLastRow: () => 1 + 행들.length,
    getRange(r, c, nr, nc) {
      const n = nc == null ? 1 : nc;
      if (r === 1) {
        return { getValues: () => [cols.slice(c - 1, c - 1 + n)], setValue(v) { cols[c - 1] = v; } };
      }
      const 몇 = nr == null ? 1 : nr;
      return {
        getValues: () => {
          const out = [];
          for (let k = 0; k < 몇; k++) out.push((행들[r - 2 + k] || []).slice(c - 1, c - 1 + n));
          return out;
        },
      };
    },
    insertColumnsAfter(after, n) {
      for (let i = 0; i < n; i++) { cols.push(''); 행들.forEach((r) => r.push('')); }
    },
  };
}

const 정본 = ['id', 'student_id', '제출일', '숙제ID', '오류태그'];

function 보류만들기() {
  return new Function(값있나소스 + '\n' + 보류소스 + '\nreturn 헤더보정보류_;')();
}

test('① 빈 칸에는 정본 이름을 채운다 — 폭도 정본까지 늘린다', () => {
  const sh = 가짜시트(['id', 'student_id', '제출일']);
  const 보류 = 보류만들기()(sh, 정본);
  assert.deepEqual(sh._칸(), 정본, '없던 칸 둘이 정본 이름으로 서야 한다');
  assert.deepEqual(보류, [], '보류할 것이 없다');
});

test('② 이름이 다른데 «아래에 값이 없으면» 덮는다 — 죽은 이름표까지 지킬 까닭은 없다', () => {
  const sh = 가짜시트(['id', 'student_id', '제출일', '🔒 Row ID', '오류태그'], [['A1', 's1', '11-03', '', 'e']]);
  const 보류 = 보류만들기()(sh, 정본);
  assert.strictEqual(sh._칸()[3], '숙제ID', '값이 없는 남의 이름은 정본으로 갈아야 한다');
  assert.deepEqual(보류, []);
});

test('🔴 ③ 이름이 다르고 «아래에 값이 있으면» 안 덮는다 (검수 P1 7d7e5ecc43e7)', () => {
  /* 라이브 hw_feedback 12열 「🔒 Row ID」의 실물 꼴 — 값 한 행(데모 FBDEMO-01). */
  const sh = 가짜시트(['id', 'student_id', '제출일', '🔒 Row ID', '오류태그'], [['A1', 's1', '11-03', 'FBDEMO-01', 'e']]);
  const 보류 = 보류만들기()(sh, 정본);
  assert.strictEqual(sh._칸()[3], '🔒 Row ID',
    '값이 있는 남의 이름을 덮으면 그 열이 남의 것이었다는 마지막 증거가 사라진다(소급 불가)');
  assert.deepEqual(보류, ['4열 「🔒 Row ID」'], '보류한 자리를 안 돌려주면 아무도 모른다');
});

test('④ 이름이 «비었는데» 값이 있으면 덮는다 — 여기서 막으면 첨삭 배치가 매일 밤 반쯤 선다', () => {
  const sh = 가짜시트(['id', 'student_id', '제출일', '', '오류태그'], [['A1', 's1', '11-03', '뭔가', 'e']]);
  const 보류 = 보류만들기()(sh, 정본);
  assert.strictEqual(sh._칸()[3], '숙제ID', '빈 이름 갈래는 아침 자가 따로 멈춰 세운다');
  assert.deepEqual(보류, []);
});

test('⑤ 멱등 — 두 번 돌려도 같다', () => {
  const sh = 가짜시트(['id', 'student_id', '제출일', '🔒 Row ID'], [['A1', 's1', '11-03', 'FBDEMO-01']]);
  const f = 보류만들기();
  const 첫 = f(sh, 정본);
  const 둘 = f(sh, 정본);
  assert.deepEqual(첫, 둘);
  assert.strictEqual(sh._칸()[3], '🔒 Row ID');
  assert.strictEqual(sh.getMaxColumns(), 5, '폭이 두 번 늘면 안 된다');
});

test('⑥ hw_feedback 통로가 그 보류판을 «실제로» 지난다 — 그리고 결과를 돌려준다', () => {
  const HEADERS = 정본;
  const f = new Function('HW_FEEDBACK_HEADERS',
    값있나소스 + '\n' + 보류소스 + '\n' + 증분소스 + '\nreturn hwFeedbackEnsureCols_;')(HEADERS);
  const sh = 가짜시트(['id', 'student_id', '제출일', '🔒 Row ID'], [['A1', 's1', '11-03', 'FBDEMO-01']]);
  const 보류 = f(sh);
  assert.deepEqual(보류, ['4열 「🔒 Row ID」'], '증분 통로가 보류 목록을 안 돌려주면 부르는 쪽이 못 알린다');
  assert.strictEqual(sh._칸()[3], '🔒 Row ID');
});

test('⑦ 야간 배치가 보류를 «조용히» 넘기지 않는다 — 0건과 「안 재봤다」가 같은 모양이면 안 된다', () => {
  const i = 콘텐츠.indexOf('hwFeedbackEnsureCols_(fb)');
  assert.ok(i > 0, '야간 배치가 hw_feedback 칸 증분을 안 부른다');
  const 뒤 = 콘텐츠.slice(i, i + 700);
  assert.ok(/헤더보류/.test(콘텐츠.slice(i - 60, i + 700)), '보류 결과를 받지 않는다 — 받아야 알릴 수 있다');
  assert.ok(/Logger\.log/.test(뒤), '보류한 자리를 남기는 자리가 없다');
});
