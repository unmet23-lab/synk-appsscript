'use strict';
/* 환불 비율의 «분모» 회귀 — 2026-09-08 (심문 2회차 B8 · 유호 확정 09-08)
 *
 * 무엇을 지키나: **환불 비율의 분모가 «실제 결제자»인가.**
 *   실물: 명품 마케팅 LAB-4 의 분모가 「결제 16」(= 정원)으로 못박혀 있었다.
 *   8명이 결제하고 1명이 신청하면 1/8 인데 문서대로면 1/16 이 되어,
 *   판매 판정이 좋아 보이는 방향으로 조용히 틀어진다.
 *   그리고 `leads` 의 「등록」 칸도 분모가 아니다 — 등록하고 결제를 안 한 사람이 거기 남는다.
 *
 * 🔴 이 자는 «셈»을 잰다. 시트를 안 만들고 소스에서 셈 층을 떼어 돌린다 —
 *   가짜 시트를 지어 재면 그 가짜가 초록을 보증할 뿐이다([[test-guards-the-defect]]).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 소스 = fs.readFileSync(path.join(REPO, '엔진_셋업확장.js'), 'utf8');

/* 소스에 실제로 서 있는 셈을 그대로 옮겨 온다(글자가 아니라 셈을 재려고).
 * 소스가 바뀌면 아래 ①이 먼저 깨져서 이 옮김이 낡았다는 것을 알린다. */
function 세기(rows) {
  const 낸사람 = {}, 돌려받은사람 = {};
  rows.forEach((r) => {
    const sid = String(r[0] || '').trim();
    if (!sid) return;
    const amt = Number(r[2]) || 0;
    const 말 = String(r[4] || '') + ' ' + String(r[5] || '');
    if (amt > 0) 낸사람[sid] = 1;
    if (amt < 0 || 말.indexOf('환불') >= 0) 돌려받은사람[sid] = 1;
  });
  const payerN = Object.keys(낸사람).length;
  const refundN = Object.keys(돌려받은사람).length;
  return { payerN, refundN, pct: payerN > 0 ? Math.round(refundN / payerN * 1000) / 10 : null };
}

test('[v9.331] ① 환불 비율 셈이 엔진 소스에 서 있다', () => {
  assert.ok(소스.includes('let refundPct = null, payerN = 0, refundN = 0;'),
    '세는 층이 없다 — 계기판 행만 있고 셈이 없으면 화면이 죽는다');
  assert.ok(/⑦ 환불 비율\(누적\)/.test(소스), '계기판에 ⑦ 환불 비율 행이 없다');
  assert.ok(소스.includes('sh.pay.getRange'), '분모를 payments 시트에서 읽지 않는다');
});

test('[v9.331] ② 분모는 정원이 아니라 실제 결제자다 (심문 B8 의 그 자리)', () => {
  const rows = [];
  for (let i = 1; i <= 8; i++) rows.push(['s' + i, '학생' + i, 30, '', '계좌', '']);
  rows.push(['s3', '학생3', -11.25, '', '계좌', '중도 환불']);
  const r = 세기(rows);
  assert.strictEqual(r.payerN, 8, '분모가 8이어야 한다(정원 16이 아니다)');
  assert.strictEqual(r.refundN, 1);
  assert.strictEqual(r.pct, 12.5, '1/8 = 12.5% 여야 한다 — 1/16 = 6.3% 가 되면 판정이 좋아 보이게 틀어진다');
});

test('[v9.331] ③ 사람 단위로 센다 — 같은 사람이 두 번 내도 분모는 1', () => {
  const r = 세기([['s1', '가', 15, '', '', ''], ['s1', '가', 15, '', '', '']]);
  assert.strictEqual(r.payerN, 1, '납부 건수가 아니라 사람 수여야 한다');
});

test('[v9.331] ④ 환불을 두 꼴로 잡는다 — 금액 음수 · 방법·비고의 「환불」', () => {
  assert.strictEqual(세기([['s1', '가', 30, '', '', ''], ['s1', '가', -30, '', '계좌', '']]).refundN, 1, '금액 음수를 못 잡았다');
  assert.strictEqual(세기([['s1', '가', 30, '', '', ''], ['s1', '가', 0, '', '환불', '']]).refundN, 1, '방법 칸의 「환불」을 못 잡았다');
  assert.strictEqual(세기([['s1', '가', 30, '', '', ''], ['s1', '가', 0, '', '', '중도 환불 처리']]).refundN, 1, '비고의 「환불」을 못 잡았다');
});

test('[v9.331] ⑤ 값이 없으면 0% 가 아니라 «축적 중»이다', () => {
  const r = 세기([]);
  assert.strictEqual(r.payerN, 0);
  assert.strictEqual(r.pct, null, '분모가 0인데 0% 를 내면 「환불이 없다」는 거짓 초록이 된다');
  assert.ok(/결제 기입 전/.test(소스), '계기판이 분모 0 을 「— (결제 기입 전)」으로 내지 않는다');
});

test('[v9.331] ⑥ student_id 가 빈 줄은 세지 않는다', () => {
  const r = 세기([['', '무명', 30, '', '', ''], ['s1', '가', 30, '', '', '']]);
  assert.strictEqual(r.payerN, 1, '사람을 못 가르는 줄이 분모를 부풀리면 안 된다');
});
