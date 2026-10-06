import test from 'node:test';
import assert from 'node:assert/strict';
import { CANDIDATES, CATALOG_META, AREAS, quoteTransportation } from '../experiences/path-travel/catalog.mjs';

test('서울 자료는 실제 공급처 검증으로 오인할 값 없이 명시적인 가상 후보만 제공한다', () => {
  assert.equal(CATALOG_META.isFixture, true);
  assert.equal(CATALOG_META.checkedAt, null);
  assert.deepEqual(CATALOG_META.party, { adults: 1, rooms: 1, nights: 1 });
  assert.equal(new Set(CANDIDATES.map(({ id }) => id)).size, CANDIDATES.length);
  for (const type of ['hotel', 'lunch', 'activity', 'dinner', 'night']) {
    assert.ok(CANDIDATES.filter((item) => item.type === type).length >= 3, type);
  }
  for (const item of CANDIDATES) {
    assert.equal(item.sourceKind, 'fixture', item.id);
    assert.equal(item.isFixture, true, item.id);
    assert.equal(item.checkedAt, null, item.id);
    assert.match(item.sourceNotice, /가상.*실제 업체가 아니/);
    assert.match(item.name, /[A-Z]$/);
    assert.ok(AREAS.some(({ id }) => id === item.areaId));
    assert.ok(Number.isInteger(item.price) && item.price >= 0, item.id);
    assert.equal(item.currency, 'KRW');
    assert.equal(item.taxesAndFeesIncluded, true);
    for (const { start, end } of item.openWindows) {
      assert.ok(start >= 0 && start < end && end <= 1800, item.id);
      assert.ok(end - start >= item.durationMinutes, item.id);
    }
    for (const value of Object.values(item.features)) {
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, item.id);
    }
  }
});

test('비·음주 제외·밤 휴식 선택을 구분할 후보가 있고 자정 이후 시간을 손실 없이 보존한다', () => {
  for (const type of ['hotel', 'lunch', 'activity', 'dinner', 'night']) {
    assert.ok(CANDIDATES.some((item) => item.type === type && item.indoor && !item.requiresAlcohol), type);
  }
  const club = CANDIDATES.find((item) => item.nightStyle === 'club');
  assert.equal(club.requiresAlcohol, true);
  assert.ok(club.openWindows.some(({ end }) => end > 1440));
  assert.ok(CANDIDATES.some((item) => item.type === 'activity' && !item.indoor));
  const rests = CANDIDATES.filter((item) => item.nightStyle === 'none');
  for (const rest of rests) {
    const hotel = CANDIDATES.find(({ id }) => id === rest.restHotelId);
    assert.ok(hotel && hotel.type === 'hotel');
    assert.equal(rest.price, 0);
    assert.equal(rest.durationMinutes, 0);
    assert.deepEqual(rest.location, hotel.location);
    assert.equal(quoteTransportation(rest, hotel).cost, 0);
    assert.equal(quoteTransportation(rest, hotel).minutes, 0);
  }
});

test('교통 adapter는 편도 비용과 실제 도보 부담을 분리하고 모르는 입력을 거부한다', () => {
  for (const from of ['station', ...AREAS.map(({ id }) => id)]) {
    for (const to of ['station', ...AREAS.map(({ id }) => id)]) {
      for (const mode of ['walk', 'transit', 'taxi']) {
        const quote = quoteTransportation(from, to, mode);
        const reverse = quoteTransportation(to, from, mode);
        assert.equal(quote.minutes, reverse.minutes);
        assert.equal(quote.cost, reverse.cost);
        assert.ok(quote.walkMinutes <= quote.minutes);
        assert.equal(quote.isFixture, true);
        assert.equal(quote.checkedAt, null);
        if (mode === 'walk') {
          assert.equal(quote.cost, 0);
          assert.equal(quote.walkMinutes, quote.minutes);
        }
      }
    }
  }
  assert.ok(quoteTransportation('jongno', 'jongno').minutes > 0, '같은 권역도 다른 장소라면 이동이 생긴다');
  assert.throws(() => quoteTransportation('station', 'busan'), RangeError);
  assert.throws(() => quoteTransportation('station', 'jongno', 'flight'), RangeError);
});

test('세부 특성은 해당 도메인의 단위·범위를 지키고 숫자 누락과 삼중상태를 구분한다', () => {
  const fieldsByDomain = {
    hotel: { noiseLevel: [0, 1], centrality: [0, 1], cleanliness: [0, 1] },
    food: { spiceLevel: [0, 2], vegetarian: 'tri', novelty: [0, 1], waitMinutes: [0, 120] },
    activity: { indoor: 'tri', crowdLevel: [0, 1], walkMinutes: [0, 180] },
    night: { energy: [0, 1], music: 'music', conversationFriendly: 'tri', alcoholFreeOption: 'tri' },
  };
  for (const item of CANDIDATES) {
    const domain = ['lunch', 'dinner'].includes(item.type) ? 'food' : item.type;
    assert.deepEqual(Object.keys(item.traits), [domain]);
    const values = item.traits[domain];
    assert.deepEqual(Object.keys(values).sort(), Object.keys(fieldsByDomain[domain]).sort());
    assert.ok(Object.isFrozen(item.traits) && Object.isFrozen(values));
    for (const [key, rule] of Object.entries(fieldsByDomain[domain])) {
      const value = values[key];
      const label = `${item.id}.${key}`;
      if (rule === 'tri') {
        assert.ok([true, false, 'unknown'].includes(value), label);
      } else if (rule === 'music') {
        assert.ok(['none', 'background', 'live', 'dance', 'unknown'].includes(value), label);
      } else {
        assert.ok(value === null || (Number.isFinite(value) && value >= rule[0] && value <= rule[1]), label);
      }
    }
    if (domain === 'food') {
      assert.ok(values.spiceLevel === null || Number.isInteger(values.spiceLevel));
      assert.ok(values.waitMinutes === null || values.waitMinutes <= item.durationMinutes);
    }
    if (domain === 'activity') {
      assert.equal(values.indoor, item.indoor, '기존 실내 조건과 세부 조건이 충돌하지 않는다');
      assert.ok(values.walkMinutes === null || values.walkMinutes <= item.durationMinutes);
    }
    if (domain === 'night' && item.requiresAlcohol) {
      assert.equal(values.alcoholFreeOption, false, '주류 포함 상품을 무알코올 상품으로 표시하지 않는다');
    }
  }
});

test('숙소·음식 자료가 가격과 취향의 상충 및 확인 전 보류를 실제로 시험할 수 있다', () => {
  const hotels = CANDIDATES.filter(({ type }) => type === 'hotel').sort((a, b) => a.price - b.price);
  const [cheap, calm, premium] = hotels;
  assert.ok(cheap.traits.hotel.noiseLevel > calm.traits.hotel.noiseLevel);
  assert.ok(cheap.traits.hotel.centrality > calm.traits.hotel.centrality);
  assert.ok(calm.traits.hotel.cleanliness > cheap.traits.hotel.cleanliness);
  assert.equal(premium.traits.hotel.cleanliness, null, '비싸다는 이유로 청결 자료를 보충하지 않는다');

  for (const type of ['lunch', 'dinner']) {
    const meals = CANDIDATES.filter((item) => item.type === type);
    for (const state of [true, false, 'unknown']) {
      assert.ok(meals.some((item) => item.traits.food.vegetarian === state), `${type} 채식 ${state}`);
    }
    assert.ok(meals.some((item) => item.traits.food.waitMinutes === null), `${type} 대기 미확인`);
    const mildVegetarian = meals.filter((item) => item.traits.food.vegetarian === true && item.traits.food.spiceLevel === 0);
    assert.ok(mildVegetarian.length > 0);
    assert.ok(mildVegetarian.every((item) => item.traits.food.waitMinutes > 10), '순한 채식과 대기 10분 제한이 상충한다');
  }
});

test('직렬화 뒤에도 미확인·불충족·수치 0의 의미가 합쳐지지 않는다', () => {
  const restored = JSON.parse(JSON.stringify(CANDIDATES));
  const byId = new Map(restored.map((item) => [item.id, item]));
  const quickMeal = byId.get('lunch-jongno-a').traits.food;
  const unknownMeal = byId.get('lunch-seongsu-d').traits.food;
  const unconfirmedVegetarian = byId.get('lunch-itaewon-c').traits.food;
  assert.equal(quickMeal.waitMinutes, 0);
  assert.equal(unknownMeal.waitMinutes, null);
  assert.notEqual(unknownMeal.waitMinutes, quickMeal.waitMinutes);
  assert.equal(quickMeal.vegetarian, false);
  assert.equal(unconfirmedVegetarian.vegetarian, 'unknown');
  assert.equal(byId.get('hotel-itaewon-c').traits.hotel.cleanliness, null);
  assert.equal(byId.get('activity-itaewon-c').traits.activity.crowdLevel, null);
  assert.equal(byId.get('night-jongno-rest').traits.night.conversationFriendly, 'unknown');
  assert.equal(byId.get('night-jongno-rest').traits.night.energy, 0);
});
