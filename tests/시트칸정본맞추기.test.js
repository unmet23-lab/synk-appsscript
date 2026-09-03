'use strict';
/* 시트 칸 정본 맞추기 회귀 — 2026-09-03
 *
 * 무엇을 지키나: **라이브 시트 칸이 골격 정본을 따라오는가**, 그리고 따라오면서
 *   «남의 열을 덮어쓰지 않는가».
 *   실물(09-03 라이브 93탭 전수 대조): ensureSheet 가 «없는 탭»만 만들기 때문에 골격에 칸을
 *   더해도 이미 있는 탭은 영영 옛 칸이었다 — voice_log 18↔7 · hw_feedback 20↔12 ·
 *   talk_log 13↔10 · quiz_log 13↔11 · jacket_grants 7↔6.
 *   voice_log 의 목표발화·시즌·미션ID 가 없으면 「그날 무엇을 읽었나」가 영영 없다(소급 불가).
 *
 * 🔑 이 시험은 **소스에 글자가 있나를 세지 않는다** — 함수를 실제로 실행해 칸이 서는지,
 *   그리고 위험한 자리에서 «멈추는지»를 본다([[test-guards-the-defect]] 의 그 자리).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 셋업 = fs.readFileSync(path.join(REPO, '엔진_셋업확장.js'), 'utf8');
const 수집 = fs.readFileSync(path.join(REPO, '엔진_수집.js'), 'utf8');

/** 열 0에서 닫히는 첫 중괄호까지를 함수 하나로 떼어 온다(Apps Script 전역이라 require 가 안 된다). */
function 떼어오기(소스, 머리) {
  const i = 소스.indexOf(머리);
  assert.ok(i >= 0, '함수를 못 찾았다: ' + 머리);
  const j = 소스.indexOf('\n}', i);
  assert.ok(j > i, '함수 끝을 못 찾았다: ' + 머리);
  return 소스.slice(i, j + 2);
}

const 보정소스 = 떼어오기(수집, 'function 헤더보정_(');
const 값있나소스 = 떼어오기(셋업, 'function 열에값있나_(');
const 맞추기소스 = 떼어오기(셋업, 'function 시트칸정본맞추기_(');

/** 골격을 주입해 함수를 만든다. */
function 만들기(골격) {
  return new Function(
    'sheetSkeleton_',
    보정소스 + '\n' + 값있나소스 + '\n' + 맞추기소스 + '\nreturn 시트칸정본맞추기_;'
  )(() => 골격);
}

/** 구글 시트 한 장 모사 — 1행(칸 이름)과 그 아래 데이터 행. */
function 가짜시트(칸들, 아래 = []) {
  let cols = 칸들.slice();
  let 행들 = 아래.map((r) => r.slice());
  return {
    getMaxColumns: () => cols.length,
    getLastRow: () => 1 + 행들.length,
    getRange(r, c, nr, nc) {
      const n = nc == null ? 1 : nc;
      if (r === 1) {
        return {
          _col: c,
          getValues: () => [cols.slice(c - 1, c - 1 + n)],
          setValue(v) { cols[c - 1] = v; },
        };
      }
      const 몇 = nr == null ? 1 : nr;                  // 2행부터 읽는 갈래
      return {
        _col: c,
        getValues: () => {
          const out = [];
          for (let k = 0; k < 몇; k++) {
            const row = 행들[r - 2 + k] || [];
            out.push(row.slice(c - 1, c - 1 + n));
          }
          return out;
        },
      };
    },
    insertColumnsAfter(after, n) {
      for (let i = 0; i < n; i++) { cols.push(''); 행들.forEach((r) => r.push('')); }
    },
    moveColumns(range, dest) {           // 실제 API 와 같이 «이동 전» 좌표 기준
      const from = range._col;
      const 옮김 = (arr) => {
        const [v] = arr.splice(from - 1, 1);
        const at = dest > from ? dest - 1 : dest;
        arr.splice(at - 1, 0, v);
      };
      옮김(cols);
      행들.forEach(옮김);
    },
    칸: () => cols.slice(),
    행: () => 행들.map((r) => r.slice()),
  };
}
const 가짜문서 = (시트들) => ({ getSheetByName: (n) => 시트들[n] || null });

test('빈 칸을 정본대로 채운다 — voice_log 무늬(18칸 정본 ↔ 라이브 7칸)', () => {
  const 정본 = ['student_id', '제출일', '미션', '파일URL', 'file_id', 'created_at',
    '전사', '전사상태', '전사일시', '급수', '미션ID', 'schema_ver',
    '목표발화', '시즌', '전사신뢰도', '전사엔진판', '발음태그', '돌려준날'];
  const sh = 가짜시트(['student_id', '제출일', '미션', '파일URL', 'file_id', 'created_at', '']);
  const 맞추기 = 만들기([['voice_log', 정본]]);
  const r = 맞추기(가짜문서({ voice_log: sh }));

  assert.deepStrictEqual(sh.칸().slice(0, 18), 정본, '정본 18칸이 그대로 서야 한다');
  assert.ok(sh.칸().includes('목표발화'), '「그날 무엇을 읽었나」의 칸이 서야 한다');
  assert.strictEqual(r.건너뛴표.length, 0);
  assert.strictEqual(r.민열.length, 0, '덮어쓸 남의 열이 없으니 밀 것도 없다');
});

test('남의 열은 덮지 않고 맨 뒤로 민다 — hw_feedback 무늬(12열 🔒 Row ID)', () => {
  const 정본 = ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션',
    '상태', '학생확인', '포인트지급', '숙제ID', '오류태그', '재작성원본', '다시쓰기URL',
    '숙제문항', '급수', 'model', 'prompt_ver', 'schema_ver'];
  const 라이브 = 정본.slice(0, 11).concat(['🔒 Row ID']);
  const sh = 가짜시트(라이브);
  const 맞추기 = 만들기([['hw_feedback', 정본]]);
  const r = 맞추기(가짜문서({ hw_feedback: sh }));

  const 결과 = sh.칸();
  assert.deepStrictEqual(결과.slice(0, 20), 정본, '정본 20칸이 제자리에 서야 한다');
  assert.ok(결과.includes('🔒 Row ID'), '남의 열은 사라지지 않는다 — 값이 딸려 있다');
  assert.ok(결과.indexOf('🔒 Row ID') >= 20, '남의 열은 정본 범위 «밖»으로 밀려야 한다');
  assert.strictEqual(결과[11], '숙제ID', '12열은 정본 이름이어야 한다');
  assert.strictEqual(r.민열.length, 1);
  assert.strictEqual(r.건너뛴표.length, 0);
});

test('정본 이름끼리 자리가 섞이면 «멈춘다» — 덮으면 값이 남의 이름을 뒤집어쓴다', () => {
  const 정본 = ['id', 'student_id', '제출일', '상태'];
  const sh = 가짜시트(['id', '제출일', 'student_id', '상태']); // 2·3열이 뒤바뀐 라이브
  const 맞추기 = 만들기([['뒤섞인표', 정본]]);
  const r = 맞추기(가짜문서({ 뒤섞인표: sh }));

  assert.strictEqual(r.맞춘표.length, 0, '이 표는 맞추면 안 된다');
  assert.strictEqual(r.건너뛴표.length, 1, '건너뛰고 사람에게 넘겨야 한다');
  assert.deepStrictEqual(sh.칸(), ['id', '제출일', 'student_id', '상태'], '한 칸도 안 건드려야 한다');
});

test('🔴 이름 없는데 «아래에 값이 있는» 열은 덮지 않고 멈춘다 (이종 검수 86417b4327af)', () => {
  const 정본 = ['id', 'student_id', '제출일', '상태'];
  // 3열의 이름이 비었는데 그 아래에 값이 있다 = 무엇인지 모르는 데이터 열
  const sh = 가짜시트(['id', 'student_id', '', '상태'], [['A1', 'SYNK-001', '남의값', '노출']]);
  const 맞추기 = 만들기([['이름없는열표', 정본]]);
  const r = 맞추기(가짜문서({ 이름없는열표: sh }));

  assert.strictEqual(r.맞춘표.length, 0, '이 표는 맞추면 안 된다');
  assert.strictEqual(r.건너뛴표.length, 1, '멈추고 사람에게 넘겨야 한다');
  assert.strictEqual(sh.칸()[2], '', '3열에 「제출일」을 씌우면 「남의값」이 제출일로 읽힌다');
  assert.deepStrictEqual(sh.행()[0], ['A1', 'SYNK-001', '남의값', '노출'], '값은 한 칸도 안 움직여야 한다');
});

test('참말로 빈 열이면 정본 이름을 채운다 — 아래에 값이 없다', () => {
  const 정본 = ['id', 'student_id', '제출일', '상태'];
  const sh = 가짜시트(['id', 'student_id', '', ''], [['A1', 'SYNK-001', '', '']]);
  const 맞추기 = 만들기([['참말로빈표', 정본]]);
  const r = 맞추기(가짜문서({ 참말로빈표: sh }));

  assert.deepStrictEqual(sh.칸(), 정본, '빈 열은 정본 이름이 서야 한다');
  assert.strictEqual(r.건너뛴표.length, 0);
});

test('없는 탭은 건드리지 않는다 — 그건 ensureSheet 몫이다', () => {
  const 맞추기 = 만들기([['없는표', ['a', 'b']]]);
  const r = 맞추기(가짜문서({}));
  assert.strictEqual(r.맞춘표.length, 0);
  assert.strictEqual(r.건너뛴표.length, 0);
});

test('아침 배치가 «값을 쓰는 일들보다 먼저» 칸을 세운다', () => {
  const i = 셋업.indexOf('function morningJobs()');
  assert.ok(i > 0, 'morningJobs 를 못 찾았다');
  const 몸 = 셋업.slice(i, 셋업.indexOf('\n}', i));
  const 차례 = [...몸.matchAll(/safeRun\('([^']+)'/g)].map((m) => m[1]);
  const 칸 = 차례.indexOf('시트칸맞추기');
  assert.ok(칸 >= 0, '아침 배치에 칸 맞추기가 걸려 있어야 한다 — 안 걸리면 라이브가 정본을 영영 안 따라온다');
  const 값쓰는것 = ['학생ID발급', 'syncProfiles', 'jacketWatch'];
  for (const 이름 of 값쓰는것) {
    const j = 차례.indexOf(이름);
    if (j >= 0) assert.ok(칸 < j, `칸 세우기가 ${이름} 보다 앞이어야 한다 — 칸이 없으면 그날 값이 안 적힌다`);
  }
});
