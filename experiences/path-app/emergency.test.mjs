import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTACTS, URGENT_TEXT, urgentText, MN_REVIEWED, EMERGENCY_CHECKED, EMERGENCY_RECHECK_DAYS } from './emergency.mjs';

test('긴급 연락처: 두 나라의 경찰 · 구급이 있고, 모든 번호에 공식 출처가 있다', () => {
  const has = (country, number) => CONTACTS.some((c) => c.country === country && c.number === number);
  for (const [c, n] of [['MN', '102'], ['MN', '103'], ['KR', '112'], ['KR', '119']]) assert.ok(has(c, n), `${c} ${n}`);
  for (const c of CONTACTS) {
    assert.match(c.source, /^https:\/\/[^\s]+\.(gov\.mn|go\.kr|korea\.net|korea\.kr)\//, c.number);
    assert.ok(c.label.ko && c.label.en && c.label.mn && c.what.ko && c.what.en, c.number);
    assert.match(c.number, /^\d{3,4}$/);
  }
  assert.equal(new Set(CONTACTS.map((c) => c.country + c.number)).size, CONTACTS.length);
});

test('긴급 연락처는 석 달마다 다시 확인한다', () => {
  assert.match(EMERGENCY_CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(EMERGENCY_RECHECK_DAYS, 90);
});

test('급함 문안: 세 말이 있고, 몽골어는 검수 전이면 영어로 낸다', () => {
  for (const l of ['ko', 'en', 'mn']) assert.ok(URGENT_TEXT[l].length > 20, l);
  assert.equal(urgentText('ko'), URGENT_TEXT.ko);
  assert.equal(urgentText('mn'), MN_REVIEWED ? URGENT_TEXT.mn : URGENT_TEXT.en);
  assert.equal(urgentText('xx'), URGENT_TEXT.en);
});
