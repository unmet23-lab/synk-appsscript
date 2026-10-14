import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, importBackup, recordCareAction } from '../model.mjs';
import { addWish, updateWish, removeWish, recordGift, giftNotes, checkGiftOverlap, giftSimilarity } from '../care-gift.mjs';

const NOW = '2026-10-14T10:00:00+09:00';
const base = () => importBackup({ ...emptyState(), people: [makePerson({ id: 'p', name: '민지' }), makePerson({ id: 'q', name: '준호' })] });

test('「갖고 싶다고 말한 것」을 더하고 고치고 지운다. 같은 글은 두 번 쌓지 않는다', () => {
  let state = addWish(base(), { personId: 'p', text: '캠핑 의자' }, NOW);
  const wish = state.people[0].wishes[0];
  assert.deepEqual([wish.text, wish.notedOn, wish.given], ['캠핑 의자', '2026-10-14', false]);
  assert.match(wish.id, /^wish_/);
  assert.equal(addWish(state, { personId: 'p', text: ' 캠핑의자 ' }, NOW).people[0].wishes.length, 1, '띄어쓰기만 다르면 같은 글');
  state = addWish(state, { personId: 'p', text: '향수 샘플', notedOn: '2026-09-30' }, NOW);
  state = updateWish(state, { personId: 'p', wishId: wish.id, given: true });
  assert.equal(state.people[0].wishes[0].given, true);
  state = removeWish(state, { personId: 'p', wishId: wish.id });
  assert.deepEqual(state.people[0].wishes.map(item => item.text), ['향수 샘플']);
  assert.equal(Object.hasOwn(state.people[1], 'wishes'), false, '메모가 없는 사람은 칸을 만들지 않는다');
  assert.deepEqual(importBackup(JSON.parse(JSON.stringify(state))).people[0].wishes, state.people[0].wishes, '백업 왕복에서 유지');
  assert.throws(() => addWish(state, { personId: 'p', text: '' }, NOW), /적어 주세요/);
  assert.throws(() => addWish(state, { personId: 'p', text: '책', notedOn: '2026-12-01' }, NOW), /오늘보다 뒤/);
  assert.throws(() => updateWish(state, { personId: 'p', wishId: 'wish_none', given: true }), /지워졌거나/);
  assert.throws(() => updateWish(state, { personId: 'p', wishId: state.people[0].wishes[0].id, color: 'red' }), /고칠 항목/);
  assert.throws(() => makePerson({ name: 'x', wishes: Array.from({ length: 51 }, (_, index) => ({ id: `w${index}`, text: `선물${index}` })) }), /최대 50개/);
});

test('선물을 기록하면서 그 「갖고 싶다고 말한 것」을 드린 것으로 표시한다', () => {
  let state = addWish(base(), { personId: 'p', text: '블루투스 이어폰' }, NOW);
  const wishId = state.people[0].wishes[0].id;
  state = recordGift(state, { personId: 'p', item: '무선 이어폰', amountWon: 89000, occasion: 'birthday', wishId }, NOW);
  const gift = state.activities.at(-1);
  assert.deepEqual([gift.kind, gift.direction, gift.item, gift.amountWon, gift.occasion, gift.occurredOn], ['gift', 'sent', '무선 이어폰', 89000, 'birthday', '2026-10-14']);
  assert.equal(state.people[0].wishes[0].given, true);
  state = recordGift(state, { personId: 'p', direction: 'received', item: '수제 쿠키', occurredOn: '2026-10-01' }, NOW);
  assert.throws(() => recordGift(state, { personId: 'p', direction: 'received', item: '꽃', wishId }, NOW), /받은 선물/);
  assert.throws(() => recordGift(state, { personId: 'p', item: '' }, NOW), /어떤 선물/);
  assert.throws(() => recordGift(state, { personId: 'p', item: '책', kind: 'money' }, NOW), /항목/);
  const notes = giftNotes(state, 'p');
  assert.deepEqual([notes.sent.length, notes.received.length, notes.wishes.open.length, notes.wishes.given.length], [1, 1, 0, 1]);
  assert.equal(notes.lastSent.item, '무선 이어폰');
});

test('고르려는 선물이 이미 준 선물과 같거나 비슷하면 알려 주고, 받은 선물·갖고 싶은 것과의 일치도 따로 보여 준다', () => {
  let state = base();
  state = recordGift(state, { personId: 'p', item: '스타벅스 텀블러', occurredOn: '2025-12-24' }, NOW);
  state = recordCareAction(state, { personId: 'p', kind: 'gift', direction: 'sent', occurredOn: '2024-05-05', note: '향초' }, NOW); // 물품 칸 없는 옛 기록
  state = recordGift(state, { personId: 'p', direction: 'received', item: '텀블러 세트', occurredOn: '2026-01-02' }, NOW);
  state = addWish(state, { personId: 'p', text: '보온 텀블러' }, NOW);
  const tumbler = checkGiftOverlap(state, { personId: 'p', item: '텀블러', now: NOW });
  assert.deepEqual(tumbler.overlaps.map(row => [row.date, row.how]), [['2025-12-24', 'similar']]);
  assert.equal(tumbler.receivedMatches.length, 1);
  assert.equal(tumbler.wishMatches.length, 1);
  assert.equal(tumbler.message, '12월 24일(2025년)에 비슷해 보이는 선물(스타벅스 텀블러)을 드렸어요. 다시 드려도 괜찮은지 살펴봐 주세요.');
  const candle = checkGiftOverlap(state, { personId: 'p', item: '향초', now: NOW });
  assert.equal(candle.overlaps[0].how, 'same', '물품 칸이 없는 옛 기록은 메모로 비교한다');
  const fresh = checkGiftOverlap(state, { personId: 'p', item: '보온 텀블러', now: NOW });
  assert.equal(fresh.overlaps.length, 1);
  const none = checkGiftOverlap(state, { personId: 'q', item: '텀블러', now: NOW });
  assert.deepEqual([none.overlaps.length, none.message], [0, ''], '다른 사람의 선물과는 비교하지 않는다');
  assert.equal(checkGiftOverlap(state, { personId: 'p', item: '꽃다발', now: NOW }).message, '');
  assert.throws(() => checkGiftOverlap(state, { personId: 'p', item: ' ' }), /선물 이름/);
});

test('선물 이름 비교: 같음·포함·같은 낱말, 한 글자나 흔한 낱말만 같으면 겹침으로 보지 않는다', () => {
  assert.equal(giftSimilarity('핸드크림', '핸드 크림'), 'same');
  assert.equal(giftSimilarity('록시땅 핸드크림', '핸드크림'), 'similar');
  assert.equal(giftSimilarity('블루투스 이어폰', '무선 이어폰'), 'similar');
  assert.equal(giftSimilarity('꽃', '꽃다발'), null);
  assert.equal(giftSimilarity('과일 선물 세트', '한우 선물 세트'), null);
  assert.equal(giftSimilarity('', '책'), null);
});
