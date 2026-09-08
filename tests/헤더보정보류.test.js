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
  assert.strictEqual(보류.length, 1, '보류한 자리를 안 돌려주면 아무도 모른다');
});

test('🔴 ④ 이름이 «비었어도» 아래에 값이 있으면 안 덮는다 (검수 2회차 ea4027be9310)', () => {
  /* 첫 판은 이 자리를 「덮는다」로 두었고, 시험이 그것을 **정답으로 못 박고 있었다.**
   *   아침 자(`시트칸정본맞추기_`)는 「이름은 없는데 아래에 값이 있는 열」을 만나면 그 표를 멈추는데
   *   (검수 86417b4327af 채택), 밤 통로가 그 판정을 우회해 정본 이름을 씌우고 있었다.
   *   ⇒ 이름 없는 데이터 열의 값이 「숙제ID」의 값으로 오인된다(소급 불가). */
  const sh = 가짜시트(['id', 'student_id', '제출일', '', '오류태그'], [['A1', 's1', '11-03', '뭔지 모르는 값', 'e']]);
  const 보류 = 보류만들기()(sh, 정본);
  assert.strictEqual(sh._칸()[3], '', '이름 없는 데이터 열에 정본 이름을 씌우면 그 값이 남의 값으로 읽힌다');
  assert.strictEqual(보류.length, 1, '보류했으면 그 자리를 돌려줘야 한다');
  assert.match(보류[0], /이름 없음/, '「남의 이름」과 「이름 없음」을 갈라 말해야 사람이 다르게 대응한다');
});

test('④-b 이름이 비었고 아래도 비었으면 «덮는다» — 참말로 빈 칸은 이름을 세워야 append 가 안 샌다', () => {
  const sh = 가짜시트(['id', 'student_id', '제출일', '', '오류태그'], [['A1', 's1', '11-03', '', 'e']]);
  const 보류 = 보류만들기()(sh, 정본);
  assert.strictEqual(sh._칸()[3], '숙제ID');
  assert.deepEqual(보류, []);
});

test('🔴 ⑤ 보류 목록에 «1행 원문»을 담지 않는다 (검수 2회차 P1 02ab57bcd477)', () => {
  /* 머리줄이 지워지면 학생 이름이 1행으로 올라온다. 그 원문을 담으면 부르는 쪽 로그가 그대로
   *   복사해 학생 식별 데이터의 출구가 된다(CLAUDE.md 안전 넷). */
  const 학생이름 = '바트체첵';
  const sh = 가짜시트(['id', 'student_id', '제출일', 학생이름, '오류태그'], [['A1', 's1', '11-03', '값', 'e']]);
  const 보류 = 보류만들기()(sh, 정본);
  assert.strictEqual(보류.length, 1);
  assert.ok(보류[0].indexOf(학생이름) === -1,
    '보류 줄이 1행 원문을 담으면 그것이 로그로 새어 나간다 (나온 값: ' + 보류[0] + ')');
  assert.match(보류[0], /4열/, '어디를 봐야 하는지는 남아야 한다');
  assert.match(보류[0], /숙제ID/, '정본 이름은 우리 것이라 적어도 된다');
});

test('⑥ 멱등 — 두 번 돌려도 같다', () => {
  const sh = 가짜시트(['id', 'student_id', '제출일', '🔒 Row ID'], [['A1', 's1', '11-03', 'FBDEMO-01']]);
  const f = 보류만들기();
  const 첫 = f(sh, 정본);
  const 둘 = f(sh, 정본);
  assert.deepEqual(첫, 둘);
  assert.strictEqual(sh._칸()[3], '🔒 Row ID');
  assert.strictEqual(sh.getMaxColumns(), 5, '폭이 두 번 늘면 안 된다');
});

test('⑦ hw_feedback 통로가 그 보류판을 «실제로» 지난다 — 그리고 결과를 돌려준다', () => {
  const HEADERS = 정본;
  const f = new Function('HW_FEEDBACK_HEADERS',
    값있나소스 + '\n' + 보류소스 + '\n' + 증분소스 + '\nreturn hwFeedbackEnsureCols_;')(HEADERS);
  const sh = 가짜시트(['id', 'student_id', '제출일', '🔒 Row ID'], [['A1', 's1', '11-03', 'FBDEMO-01']]);
  const 보류 = f(sh);
  assert.strictEqual(보류.length, 1, '증분 통로가 보류 목록을 안 돌려주면 부르는 쪽이 못 알린다');
  assert.ok(보류[0].indexOf('Row ID') === -1, '통로를 지나도 1행 원문은 안 실린다');
  assert.strictEqual(sh._칸()[3], '🔒 Row ID');
});

test('⑧ 야간 배치가 보류를 «조용히» 넘기지 않는다 — 0건과 「안 재봤다」가 같은 모양이면 안 된다', () => {
  const i = 콘텐츠.indexOf('hwFeedbackEnsureCols_(fb)');
  assert.ok(i > 0, '야간 배치가 hw_feedback 칸 증분을 안 부른다');
  const 뒤 = 콘텐츠.slice(i, i + 1200);
  assert.ok(/헤더보류/.test(콘텐츠.slice(i - 60, i + 1200)), '보류 결과를 받지 않는다 — 받아야 알릴 수 있다');
  assert.ok(/Logger\.log/.test(뒤), '보류한 자리를 남기는 자리가 없다');
});

test('🔴 ⑨ 야간 안내가 «확정 안 Ⓒ» 를 가리킨다 (검수 2회차 8eedb5868cf3)', () => {
  /* 유호 확정 09-07 「c」 = 값을 옮겨 적고 · 데모 줄을 걷고 · 이름을 세운다. **열을 옮기지 않는다.**
   *   앞 판 안내는 「옮기기는 아침 자 + SHEET_COL_PUSH」라 그 확정과 어긋났다 — 그대로 따르면
   *   새 첨삭의 숙제ID 가 정본 열에서 빠진다. */
  const i = 콘텐츠.indexOf('hwFeedbackEnsureCols_(fb)');
  const 뒤 = 콘텐츠.slice(i, i + 1200);
  const 안내 = 뒤.slice(뒤.indexOf('Logger.log'), 뒤.indexOf('Logger.log') + 400);
  assert.ok(안내.indexOf('SHEET_COL_PUSH') === -1,
    '안내가 아직 「옮기기」 스위치를 가리킨다 — 확정 안 Ⓒ 는 열을 옮기지 않는다');
  assert.ok(/시트_RowID_정리_설계/.test(안내), '푸는 차례가 적힌 정본을 안 가리킨다');
});
