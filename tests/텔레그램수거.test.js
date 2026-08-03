// telegram-answers-poll 회귀 — 수거 필터는 보안 경계다(메신저 텍스트=명령).
// 지키는 것: ①남의 글은 기록하지 않는다 ②걸러도 offset은 전진한다(재수신 차단)
// ③원문 무손실 append ④KST 스탬프.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { collect, renderEntries, kstStamp } = require('../tools/telegram-answers-poll.js');

const YUHO = 6017495834;
const msg = (updateId, fromId, chatId, text, extra = {}) => ({
  update_id: updateId,
  message: {
    from: { id: fromId },
    chat: { id: chatId, type: 'private' },
    date: 1770163200, // 2026-02-04 00:00 UTC → KST 09:00
    text,
    ...extra,
  },
});

test('유호님 private 텍스트만 수거한다', () => {
  const r = collect([msg(10, YUHO, YUHO, '1번은 A로 간다')], YUHO);
  assert.strictEqual(r.entries.length, 1);
  assert.strictEqual(r.entries[0].text, '1번은 A로 간다');
});

test('남이 보낸 메시지는 기록하지 않는다 — 단 offset은 전진한다', () => {
  const r = collect([msg(11, 999, 999, '무시할 것'), msg(12, YUHO, YUHO, '진짜 답')], YUHO);
  assert.strictEqual(r.entries.length, 1);
  assert.strictEqual(r.entries[0].text, '진짜 답');
  assert.strictEqual(r.maxUpdateId, 12); // 스팸이 큐를 막으면 안 된다
});

test('그룹 챗은 ID가 맞아도 거른다(private만)', () => {
  const u = msg(13, YUHO, YUHO, '그룹에서 한 말');
  u.message.chat.type = 'group';
  const r = collect([u], YUHO);
  assert.strictEqual(r.entries.length, 0);
  assert.strictEqual(r.maxUpdateId, 13);
});

test('텍스트 없는 업데이트(사진·스티커·edited)는 건너뛰되 offset은 전진', () => {
  const r = collect([{ update_id: 14, message: { from: { id: YUHO }, chat: { id: YUHO, type: 'private' }, date: 1 } }], YUHO);
  assert.strictEqual(r.entries.length, 0);
  assert.strictEqual(r.maxUpdateId, 14);
});

test('빈 배열이면 offset 변화 없음(null) — 파일을 덮지 않는다', () => {
  const r = collect([], YUHO);
  assert.strictEqual(r.entries.length, 0);
  assert.strictEqual(r.maxUpdateId, null);
});

test('append 형식 = 원문 무손실 + KST 스탬프', () => {
  const r = collect([msg(15, YUHO, YUHO, '여러 줄\n답변도\n그대로')], YUHO);
  const out = renderEntries(r.entries);
  assert.ok(out.includes('여러 줄\n답변도\n그대로'), '원문이 변형됐다');
  assert.ok(out.startsWith('## 2026-02-04 09:00 (KST)'), `KST 변환 오류: ${out.split('\n')[0]}`);
});

test('kstStamp는 UTC+9 고정(서버 타임존 무관)', () => {
  assert.strictEqual(kstStamp(0), '1970-01-01 09:00');
});
