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
const 스위치소스 = 떼어오기(셋업, 'function 열밀기켜졌나_(');
const 기록소스 = 떼어오기(셋업, 'function 시트칸맞추기기록_(');

/** 골격을 주입해 함수를 만든다.
 *  🔑 `PropertiesService` 는 **일부러 안 준다** — 여기서 스위치는 못 읽히고, 그때 기본값이
 *     「안 민다」여야 한다. 그 기본값 자체가 이 시험이 지키는 것이다(유호 확정 09-07). */
function 만들기(골격) {
  return new Function(
    'sheetSkeleton_',
    보정소스 + '\n' + 값있나소스 + '\n' + 스위치소스 + '\n' + 맞추기소스 + '\nreturn 시트칸정본맞추기_;'
  )(() => 골격);
}

/** 기록 함수를 만든다 — `ensureSheet`·`setState`·`Logger` 를 모사로 준다. */
function 기록만들기(담을곳) {
  const 칸들 = {};
  const st = {
    _칸: 칸들,
    getLastRow: () => Object.keys(칸들).length,
    getRange: () => ({ setValue() {}, setValues() {} }),
  };
  return new Function(
    'ensureSheet', 'setState', 'Logger',
    기록소스 + '\nreturn 시트칸맞추기기록_;'
  )(
    () => st,
    (_st, key, val) => { 담을곳[key] = val; },
    { log() {} }
  );
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
    /* 🔑 「그 자리 «앞»에 빈 열」 — 뒤에 있던 열이 오른쪽으로 밀린다(값도 함께).
     *   이동 뒤 빈 자리를 도로 채우는 데 쓴다(09-08 검수 P1). */
    insertColumnsBefore(before, n) {
      for (let i = 0; i < n; i++) {
        cols.splice(before - 1, 0, '');
        행들.forEach((r) => r.splice(before - 1, 0, ''));
      }
    },
    moveColumns(range, dest) {           // 실제 API 와 같이 «이동 전» 좌표 기준
      /* 🔴 09-07 실행층 실측 — 진짜 API 는 목적지가 폭을 넘으면 던진다(「해당 열이 범위를 벗어납니다.」).
       *   이 줄이 없으면 아래 splice 가 «범위를 넘겨도 조용히 끝에» 넣어 버려서, 이 가짜가
       *   라이브에서 한 번도 안 되는 코드에 거짓 초록을 준다(실제로 나흘간 그랬다).
       *   ⇒ 실행층에서만 드러나는 API 를 흉내낼 때는 «되는 것»만이 아니라 «던지는 자리»도 흉내낸다. */
      if (!(dest >= 1 && dest <= cols.length)) {
        throw new Error('해당 열이 범위를 벗어납니다. (목적지 ' + dest + ' · 폭 ' + cols.length + ')');
      }
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

/* 🔴 아래 두 시험이 유호 확정 09-07 「기본은 늘리기만 · 옮기는 것은 스위치 뒤에」를 지킨다.
 *   같은 라이브 무늬(hw_feedback 12열)를 스위치 끈 판과 켠 판으로 두 번 잰다. */
const HW정본 = ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션',
  '상태', '학생확인', '포인트지급', '숙제ID', '오류태그', '재작성원본', '다시쓰기URL',
  '숙제문항', '급수', 'model', 'prompt_ver', 'schema_ver'];
const HW라이브 = HW정본.slice(0, 11).concat(['🔒 Row ID']);

test('🔴 스위치가 꺼져 있으면 한 칸도 안 건드린다 — 옮기기는 소급 불가다(유호 확정 09-07)', () => {
  const sh = 가짜시트(HW라이브, [['FBDEMO-01', 'SYNK-001', '', '', '', '', '', '', '노출', '', '', '남의값']]);
  const 맞추기 = 만들기([['hw_feedback', HW정본]]);
  const r = 맞추기(가짜문서({ hw_feedback: sh }));   // 옵션을 안 준다 = 라이브 기본 갈래

  assert.deepStrictEqual(sh.칸(), HW라이브, '칸이 하나도 안 움직여야 한다 — 폭조차 안 늘린다');
  assert.deepStrictEqual(sh.행()[0][11], '남의값', '남의 열의 값이 제자리에 있어야 한다');
  assert.strictEqual(r.맞춘표.length, 0, '이 표는 맞추면 안 된다');
  assert.strictEqual(r.민열.length, 0, '한 열도 밀면 안 된다');
  assert.strictEqual(r.보류표.length, 1, '손 안 댄 까닭이 사람에게 보여야 한다');
  assert.match(r.보류표[0], /12열/, '몇 열이 걸렸는지 말해야 한다');
  assert.match(r.보류표[0], /SHEET_COL_PUSH/, '켜는 법을 함께 말해야 한다');
  assert.strictEqual(r.밀기, false, '스위치를 못 읽으면 «안 민다»가 기본이다');
});

test('빈 칸 채우기는 스위치와 무관하게 늘 돈다 — 값을 한 칸도 안 건드리기 때문이다', () => {
  const 정본 = ['id', 'student_id', '제출일', '상태'];
  const sh = 가짜시트(['id', 'student_id'], [['A1', 'SYNK-001']]);
  const 맞추기 = 만들기([['늘리기만표', 정본]]);
  const r = 맞추기(가짜문서({ 늘리기만표: sh }));      // 스위치 꺼진 기본 갈래

  assert.deepStrictEqual(sh.칸(), 정본, '남의 열이 없으니 스위치와 상관없이 정본이 서야 한다');
  assert.strictEqual(r.보류표.length, 0, '보류할 것이 없다');
  assert.strictEqual(r.맞춘표.length, 1);
});

test('남의 열은 덮지 않고 맨 뒤로 민다 — hw_feedback 무늬(12열 🔒 Row ID · 스위치 켠 판)', () => {
  const 정본 = HW정본;
  const 라이브 = HW라이브;
  const sh = 가짜시트(라이브);
  const 맞추기 = 만들기([['hw_feedback', 정본]]);
  const r = 맞추기(가짜문서({ hw_feedback: sh }), { 밀기: true });

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

test('🔴 남의 열을 밀어도 «값이 남의 이름을 뒤집어쓰지» 않는다 — 뺀 자리를 도로 채운다 (09-08 검수 P1)', () => {
  /* 검수 df3b1e78·47ca570f 가 잡은 자리다. `moveColumns` 는 열을 «빼서» 옮기므로 뒤 열이
   * 한 칸씩 왼쪽으로 당겨지는데, 그대로 두고 `헤더보정_` 가 이름만 덮으면 c 가 B 의 값으로 읽힌다.
   * 🔑 **값 없는 무늬로만 재면 이 병이 안 보인다** — 그래서 아래는 값을 넣고 잰다
   *   (바로 위 「맨 뒤로 민다」 시험이 값 행 없이 재서 이 자리를 못 봤다). */
  const 정본 = ['A', 'B', 'C', 'D'];
  const sh = 가짜시트(['A', 'X', 'C', 'D'], [['a', 'x', 'c', 'd']]);
  const 맞추기 = 만들기([['값보존표', 정본]]);
  const r = 맞추기(가짜문서({ 값보존표: sh }), { 밀기: true });

  const 칸 = sh.칸(); const 행 = sh.행()[0];
  assert.deepStrictEqual(칸.slice(0, 4), 정본, '정본 넷이 제자리에 서야 한다');
  assert.strictEqual(행[0], 'a', 'A 의 값은 그대로다');
  assert.strictEqual(행[1], '', 'B 자리는 «비어» 있어야 한다 — 남의 값이 올라오면 그게 이 병이다');
  assert.strictEqual(행[2], 'c', 'C 의 값이 B 로 밀려 올라가면 안 된다');
  assert.strictEqual(행[3], 'd', 'D 의 값이 C 로 밀려 올라가면 안 된다');
  const 밖 = 칸.indexOf('X');
  assert.ok(밖 >= 4, '남의 열은 정본 범위 밖에 서야 한다');
  assert.strictEqual(행[밖], 'x', '남의 열의 값이 그 열을 따라가야 한다 — 잃으면 소급 불가다');
  assert.strictEqual(r.민열.length, 1);
  assert.strictEqual(r.건너뛴표.length, 0);
});

test('🔴 남의 열이 둘이어도 값이 안 섞인다 — 뒤에서 앞으로 두 번 미는 자리 (09-08)', () => {
  const 정본 = ['A', 'B', 'C'];
  const sh = 가짜시트(['A', 'X', 'Y'], [['a', 'x', 'y']]);
  const 맞추기 = 만들기([['둘민표', 정본]]);
  const r = 맞추기(가짜문서({ 둘민표: sh }), { 밀기: true });

  const 칸 = sh.칸(); const 행 = sh.행()[0];
  assert.deepStrictEqual(칸.slice(0, 3), 정본);
  assert.deepStrictEqual(행.slice(0, 3), ['a', '', ''], 'B·C 자리는 비어야 한다');
  for (const 짝 of [['X', 'x'], ['Y', 'y']]) {
    const at = 칸.indexOf(짝[0]);
    assert.ok(at >= 3, 짝[0] + ' 는 정본 밖에 서야 한다');
    assert.strictEqual(행[at], 짝[1], 짝[0] + ' 의 값이 그 열을 따라가야 한다');
  }
  assert.strictEqual(r.민열.length, 2);
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

/* ══════════ 「돌았나」를 물어볼 자리 — 2026-09-07 ══════════
 * 자가 아침마다 걸려 있어도 결과를 안 남기면 「나흘 동안 한 번이라도 돌았나」를 물어볼 데가 없다.
 * 실제로 그랬다: v9.309(09-03)부터 걸려 있었는데 라이브 hw_feedback 은 09-07 까지 12칸이었고,
 * 「안 돌았나 · 돌았는데 막혔나」를 가를 근거가 0이었다. */

test('🔴 기록이 «손 안 댄 표»를 담는다 — 안 담으면 아무도 모른다', () => {
  const 담김 = {};
  const 기록 = 기록만들기(담김);
  기록({}, { 맞춘표: ['a(4칸)'], 민열: [], 건너뛴표: [], 보류표: ['hw_feedback: 12열 「🔒 Row ID」'], 더한칸: 2, 밀기: false });

  const 적힌것 = 담김['시트칸맞추기_마지막'];
  assert.ok(적힌것, 'app_state 에 한 줄이 적혀야 한다');
  const j = JSON.parse(적힌것);
  assert.ok(j.때, '«언제» 돌았나가 없으면 「돌았나」를 못 잰다');
  assert.strictEqual(j.밀기, false, '스위치가 켜져 있었나도 함께 남아야 한다');
  assert.deepStrictEqual(j.보류표, ['hw_feedback: 12열 「🔒 Row ID」'], '손 안 댄 표가 그대로 실려야 한다');
  assert.strictEqual(j.맞춘표, 1);
  assert.strictEqual(j.더한칸, 2);
});

test('기록이 실패해도 아침 배치는 안 죽는다 — 기록은 곁이지 일이 아니다', () => {
  const 터지는기록 = new Function(
    'ensureSheet', 'setState', 'Logger',
    기록소스 + '\nreturn 시트칸맞추기기록_;'
  )(
    () => { throw new Error('app_state 를 못 열었다'); },
    () => {},
    { log() {} }
  );
  assert.doesNotThrow(() => 터지는기록({}, { 맞춘표: [], 민열: [], 건너뛴표: [], 보류표: [], 더한칸: 0, 밀기: false }));
});

test('아침 배치가 결과를 «남긴다» — 안 남기면 도는지 아무도 모른다', () => {
  const i = 셋업.indexOf('function morningJobs()');
  const 몸 = 셋업.slice(i, 셋업.indexOf('\n}', i));
  const 칸블록 = 몸.slice(몸.indexOf("safeRun('시트칸맞추기'"), 몸.indexOf("safeRun('학생ID발급'"));
  assert.ok(칸블록.includes('시트칸맞추기기록_('), '아침 배치가 결과를 버리면 09-07 구멍이 그대로다');
  assert.ok(칸블록.includes('시트칸정본맞추기_('), '자를 부르는 줄이 그대로 있어야 한다');
});

test('스위치 이름이 코드와 안내문에서 같다 — 갈리면 켜는 법이 틀려진다', () => {
  const 스위치 = 떼어오기(셋업, 'function 열밀기켜졌나_(');
  assert.ok(스위치.includes("'SHEET_COL_PUSH'"), '스위치를 읽는 이름');
  const 맞추기 = 떼어오기(셋업, 'function 시트칸정본맞추기_(');
  assert.ok(맞추기.includes('SHEET_COL_PUSH'), '보류 안내가 같은 이름을 말해야 한다');
});
