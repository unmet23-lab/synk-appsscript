'use strict';
/* 환불 비율의 «분모» 회귀 — 2026-09-08 (심문 2회차 B8 · 유호 확정 09-08)
 *
 * 무엇을 지키나: **환불 비율의 분모가 «실제 결제자»인가.**
 *   실물: 명품 마케팅 LAB-4 의 분모가 「결제 16」(= 정원)으로 못박혀 있었다.
 *   8명이 결제하고 1명이 신청하면 1/8 인데 문서대로면 1/16 이 되어,
 *   판매 판정이 좋아 보이는 방향으로 조용히 틀어진다.
 *   그리고 `leads` 의 「등록」 칸도 분모가 아니다 — 등록하고 결제를 안 한 사람이 거기 남는다.
 *
 * 🔴 **이 시험은 «소스의 그 코드»를 실제로 돌린다** — 09-08 첫 판은 셈을 시험 파일에 «복사»해
 *   돌렸고, 배포 검수가 그것을 잡았다(키 5a0cd71f810f): 소스의 분모를 정원으로 되돌리는 변이
 *   셋을 넣어도 시험 6/6 이 그대로 통과했다. 복사본을 재면 그 복사본만 초록이 된다
 *   (기억 `test-guards-the-defect` 의 그 무늬 · 내가 머리말에 그 경고를 적어 놓고 밟았다).
 *   ⇒ 아래 `세기()` 는 엔진 소스에서 셈 블록을 «떼어 내» 가짜 시트 하나만 물려 실행한다.
 *      소스가 바뀌면 이 시험이 따라 움직이고, 셈을 되돌리면 빨개진다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 소스 = fs.readFileSync(path.join(REPO, '엔진_셋업확장.js'), 'utf8');

/* 엔진 소스에서 «환불 비율 셈» 블록만 떼어 낸다.
 * 시작 = `let refundPct` 선언 · 끝 = 그 if 블록을 닫는 줄(들여쓰기 두 칸의 `}`). */
function 셈블록뽑기() {
  const 시작 = 소스.indexOf('let refundPct = null');
  assert.ok(시작 > 0, '엔진 소스에 환불 비율 셈이 없다 — 계기판 행만 있고 셈이 없으면 화면이 죽는다');
  const 끝 = 소스.indexOf('\n  }', 소스.indexOf('if (payerN > 0) refundPct', 시작));
  assert.ok(끝 > 시작, '셈 블록의 끝을 못 찾았다 — 소스 모양이 바뀌었으면 이 뽑기도 함께 고친다');
  return 소스.slice(시작, 끝 + 4);
}

/* 뽑아낸 블록을 가짜 시트 하나만 물려 실제로 돌린다(시트도 API 도 안 만든다). */
function 세기(rows) {
  const 블록 = 셈블록뽑기();
  const sh = {
    pay: {
      getLastRow: () => rows.length + 1,          // 머리줄 한 칸을 더한 꼴
      getRange: () => ({ getValues: () => rows }),
    },
  };
  const f = new Function('sh', 블록 + '\nreturn { payerN, refundN, pct: refundPct };');
  return f(sh);
}

test('[v9.331] ① 셈이 엔진 소스에 서 있고, 계기판과 주간 리포트 «둘 다»에 실린다', () => {
  assert.ok(소스.includes('let refundPct = null, payerN = 0, refundN = 0;'), '세는 층이 없다');
  assert.ok(/⑦ 환불 비율\(누적\)/.test(소스), '계기판에 ⑦ 환불 비율 행이 없다');
  assert.ok(/'⑦ 환불 비율: '/.test(소스),
    '주간 리포트 반환문에 없다 — 시트에만 넣으면 weeklyJobs 의 메일과 AI 해설에서 빠진다(검수 P1 416906b)');
  assert.ok(소스.includes('sh.pay.getRange'), '분모를 payments 시트에서 읽지 않는다');
});

test('[v9.331] ② 분모는 정원이 아니라 실제 결제자다 (심문 B8 의 그 자리)', () => {
  const rows = [];
  for (let i = 1; i <= 8; i++) rows.push(['s' + i, '학생' + i, 30, '2026-11-03', '계좌', '']);
  rows.push(['s3', '학생3', -11.25, '2026-11-20', '계좌', '중도 환불']);
  const r = 세기(rows);
  assert.strictEqual(r.payerN, 8, '분모가 8이어야 한다(정원 16이 아니다)');
  assert.strictEqual(r.refundN, 1);
  assert.strictEqual(r.pct, 12.5, '1/8 = 12.5% 여야 한다 — 1/16 = 6.3% 가 되면 판정이 좋아 보이게 틀어진다');
});

test('[v9.331] ③ 사람 단위로 센다 — 같은 사람이 두 번 내도 분모는 1', () => {
  const r = 세기([['s1', '가', 15, '2026-11-03', '', ''], ['s1', '가', 15, '2026-11-10', '', '']]);
  assert.strictEqual(r.payerN, 1, '납부 건수가 아니라 사람 수여야 한다');
});

test('[v9.331] ④ 환불을 두 꼴로 잡는다 — 금액 음수 · 금액 없는 줄의 방법·비고 「환불」', () => {
  assert.strictEqual(세기([['s1', '가', 30, '2026-11-03', '', ''], ['s1', '가', -30, '2026-11-20', '계좌', '']]).refundN, 1, '금액 음수를 못 잡았다');
  assert.strictEqual(세기([['s1', '가', 30, '2026-11-03', '', ''], ['s1', '가', 0, '', '환불', '']]).refundN, 1, '방법 칸의 「환불」을 못 잡았다');
  assert.strictEqual(세기([['s1', '가', 30, '2026-11-03', '', ''], ['s1', '가', 0, '', '', '중도 환불 처리']]).refundN, 1, '비고의 「환불」을 못 잡았다');
});

test('[v9.331] ⑤ 환불자는 «결제자 안»에서만 센다 — 비율이 100%를 못 넘는다 (검수 P1 bec533a)', () => {
  /* 양수 납부자 한 사람 + 남의 음수 행 둘. 교집합을 안 내면 2/1명 = 200% 가 나온다. */
  const r = 세기([
    ['s1', '가', 30, '2026-11-03', '계좌', ''],
    ['s2', '나', -30, '2026-11-20', '계좌', '환불'],
    ['s3', '다', -30, '2026-11-20', '계좌', '환불'],
  ]);
  assert.strictEqual(r.payerN, 1);
  assert.strictEqual(r.refundN, 0, '결제 기록이 없는 사람의 환불 행은 세지 않는다');
  assert.ok(r.pct <= 100, '환불 비율이 100% 를 넘으면 정의가 깨진 것이다 (나온 값: ' + r.pct + ')');
});

test('[v9.331] ⑥ 값이 없으면 0% 가 아니라 «축적 중»이다', () => {
  const r = 세기([]);
  assert.strictEqual(r.payerN, 0);
  assert.strictEqual(r.pct, null, '분모가 0인데 0% 를 내면 「환불이 없다」는 거짓 초록이 된다');
  assert.ok(/결제 기입 전/.test(소스), '계기판이 분모 0 을 「— (결제 기입 전)」으로 내지 않는다');
});

test('[v9.331] ⑦ student_id 가 빈 줄은 세지 않는다', () => {
  const r = 세기([['', '무명', 30, '2026-11-03', '', ''], ['s1', '가', 30, '2026-11-03', '', '']]);
  assert.strictEqual(r.payerN, 1, '사람을 못 가르는 줄이 분모를 부풀리면 안 된다');
});

test('[v9.331] ⑧ 납부일이 안 찍힌 줄은 결제자가 아니다 (검수 P1 84f88c9a · P3 53a19d32)', () => {
  /* 확정 문서 `docs/명품마케팅_회사별_v1.md` §㉣ = 「1기 기간에 납부일이 찍힌 사람」.
   *   금액만 먼저 적어 둔 행(약속·견적)까지 세면 분모가 부풀어 비율이 «좋아 보이게» 틀어진다. */
  const rows = [];
  for (let i = 1; i <= 8; i++) rows.push(['s' + i, '학생' + i, 30, i <= 2 ? '2026-11-03' : '', '계좌', '']);
  rows.push(['s1', '학생1', -30, '2026-11-20', '계좌', '환불']);
  const r = 세기(rows);
  assert.strictEqual(r.payerN, 2, '납부일이 찍힌 둘만 결제자다');
  assert.strictEqual(r.refundN, 1);
  assert.strictEqual(r.pct, 50, '1/2 = 50% 여야 한다 — 1/8 = 12.5% 가 나오면 분모가 부푼 것이다');
});

test('[v9.331] ⑨ 비고의 「환불 없음」을 환불로 세지 않는다 (검수 P1 94aab534)', () => {
  /* 돈이 «들어온» 줄(금액 양수)은 환불 줄이 아니다 — 글자만 보면 1/1명 = 100% 가 나온다. */
  const r = 세기([['s1', '가', 30, '2026-11-03', '계좌', '환불 없음']]);
  assert.strictEqual(r.payerN, 1);
  assert.strictEqual(r.refundN, 0, '들어온 돈 줄의 「환불」 글자를 세면 100% 라는 거짓 경보가 뜬다');
  assert.strictEqual(r.pct, 0);
});
