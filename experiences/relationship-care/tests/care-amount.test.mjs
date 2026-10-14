import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestAmounts, amountOccasionFromEvent, AMOUNT_OCCASIONS, AMOUNT_RELATIONS, AMOUNT_VENUES, SURVEY } from '../care-amount.mjs';

const amounts = result => result.candidates.map(item => item.amountWon);
const NOW = '2026-10-14T10:00:00+09:00';

test('모든 자리·관계 조합에서 후보는 2~3개, 5만 원 단위, 첫 후보만 추천 표시이며 참고라고 밝힌다', () => {
  for (const occasion of Object.keys(AMOUNT_OCCASIONS)) for (const relation of Object.keys(AMOUNT_RELATIONS)) for (const attending of [true, false]) for (const venue of Object.keys(AMOUNT_VENUES)) {
    const result = suggestAmounts({ occasion, relation, attending, venue, now: NOW });
    assert.ok(result.candidates.length >= 2 && result.candidates.length <= 3, `${occasion}/${relation}`);
    assert.equal(new Set(amounts(result)).size, result.candidates.length, '같은 금액을 두 번 내지 않는다');
    assert.ok(amounts(result).every(value => value % 50000 === 0 && value >= 50000));
    assert.deepEqual(result.candidates.map(item => item.recommended), result.candidates.map((_, index) => index === 0));
    assert.ok(result.candidates.every(item => item.reason.endsWith('요.')));
    assert.match(result.cautions[0], /참고용이에요/);
    assert.equal(result.sourceNote, SURVEY.source);
    assert.match(result.basis.at(-1), /SYNK가 정한 참고 기준/);
  }
});

test('직장 동료 결혼식 참석은 10만 원을 먼저 보여 주고, 조사 문구를 그대로 근거로 붙인다', () => {
  const result = suggestAmounts({ occasion: 'wedding', relation: 'coworker', attending: true, venue: 'hall', now: NOW });
  assert.deepEqual(amounts(result), [100000, 50000, 150000]);
  assert.equal(result.candidates[0].label, '10만 원');
  assert.equal(result.candidates[0].reason, '직장 동료 결혼식에 참석할 때 많이 하는 금액이에요.');
  assert.equal(result.basis[0], '2026년 5월 성인 1,500명 조사에서 축의금 평균 97,900원, 10만 원이 65.3%');
  assert.equal(result.basis[1], '같은 조사에서 65.8%가 장소·식사가 금액에 영향을 준다고 답함');
  assert.equal(result.sourceUrl, 'https://v.daum.net/v/20260516003319431');
});

test('호텔은 한 단계 올리고, 불참은 한 단계 내리며, 식사 없음은 낮추는 이유를 함께 보여 준다', () => {
  const hotel = suggestAmounts({ occasion: 'wedding', relation: 'close-friend', venue: 'hotel', now: NOW });
  assert.equal(hotel.candidates[0].amountWon, 200000); assert.match(hotel.candidates[0].reason, /호텔은 식대가 높아/);
  const absent = suggestAmounts({ occasion: 'wedding', relation: 'acquaintance', attending: false, now: NOW });
  assert.deepEqual(amounts(absent), [50000, 100000]); assert.match(absent.candidates[0].reason, /가지 못하고 마음만/);
  const noMeal = suggestAmounts({ occasion: 'wedding', relation: 'acquaintance', venue: 'none', now: NOW });
  assert.deepEqual(amounts(noMeal), [100000, 50000, 150000]); assert.match(noMeal.candidates[1].reason, /식사를 하지 않는다면/);
  const firstBirthday = suggestAmounts({ occasion: 'first-birthday', relation: 'close-friend', venue: 'hotel', now: NOW });
  assert.equal(firstBirthday.candidates[0].amountWon, 150000);
  assert.equal(firstBirthday.basis[0],'2026년 5월 성인 1,500명 조사에서 65.8%가 장소·식사가 금액에 영향을 준다고 답함');
});

test('지난번 받은 금액이 있으면 「같은 금액으로 돌려드리는 경우가 많아요」를 가장 먼저 낸다', () => {
  const result = suggestAmounts({ occasion: 'wedding', relation: 'coworker', receivedWon: 70000, now: NOW });
  assert.equal(result.headline, '같은 금액으로 돌려드리는 경우가 많아요');
  assert.deepEqual(amounts(result), [70000, 100000]);
  assert.equal(result.candidates[0].kind, 'returned');
  assert.equal(result.candidates[0].label, '7만 원');
  assert.match(result.candidates[0].reason, /지난번 받은 금액\(7만 원\)과 같아요\. 같은 금액으로 돌려드리는 경우가 많아요\./);
  const old = suggestAmounts({ occasion: 'funeral', relation: 'boss', receivedWon: 100000, receivedOn: '2021-03-02', now: NOW });
  assert.deepEqual(old.candidates.map(item => [item.amountWon, item.kind]), [[100000, 'returned'], [150000, 'returned-plus']]);
  assert.match(old.candidates[1].reason, /받은 지 5년이 지났다면/);
  const odd = suggestAmounts({ occasion: 'funeral', relation: 'acquaintance', receivedWon: 30000, now: NOW });
  assert.deepEqual(amounts(odd), [30000, 50000]);
  assert.equal(odd.candidates[0].label, '3만 원');
});

test('조문은 조의금 조사 수치와 홀수 관습을 알리고, 참석 여부로 금액을 바꾸지 않는다', () => {
  const going = suggestAmounts({ occasion: 'funeral', relation: 'acquaintance', attending: true, now: NOW });
  const notGoing = suggestAmounts({ occasion: 'funeral', relation: 'acquaintance', attending: false, now: NOW });
  assert.deepEqual(amounts(going), amounts(notGoing));
  assert.equal(going.basis[0], '2026년 5월 성인 1,500명 조사에서 조의금 평균 95,300원');
  assert.match(going.basis[1], /홀수/);
  assert.equal(going.basis.some(line => line.includes('축의금')), false);
  const family = suggestAmounts({ occasion: 'milestone-birthday', relation: 'family', now: NOW });
  assert.ok(family.basis.some(line => /집안에서 정한 기준/.test(line)));
  assert.match(suggestAmounts({ occasion: 'housewarming', relation: 'acquaintance', now: NOW }).basis.join(' '), /물건이나 화분/);
});

test('입력 검사와 일정 종류 연결', () => {
  assert.throws(() => suggestAmounts({ occasion: 'party', relation: 'coworker' }), /어떤 자리/);
  assert.throws(() => suggestAmounts({ occasion: 'wedding', relation: 'pet' }), /어떤 사이/);
  assert.throws(() => suggestAmounts({ occasion: 'wedding', relation: 'coworker', attending: 'yes' }), /참석 여부/);
  assert.throws(() => suggestAmounts({ occasion: 'wedding', relation: 'coworker', venue: 'beach' }), /장소/);
  assert.throws(() => suggestAmounts({ occasion: 'wedding', relation: 'coworker', receivedWon: -1 }), /받은 금액/);
  assert.throws(() => suggestAmounts({ occasion: 'wedding', relation: 'coworker', receivedWon: 50000, receivedOn: '2027-01-01', now: NOW }), /받은 날짜/);
  assert.equal(amountOccasionFromEvent('wedding'), 'wedding');
  assert.equal(amountOccasionFromEvent('condolence'), 'funeral');
  assert.equal(amountOccasionFromEvent('birthday'), null);
});
