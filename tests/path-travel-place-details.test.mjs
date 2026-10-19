import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRAVEL_PLACES, PERSONALIZATION_TAGS, findPlace } from '../experiences/path-travel/places-v2.mjs';
import { REAL_CONDITION_CALENDAR } from '../experiences/path-travel/real-places.mjs';
import { evaluateRealConditions } from '../experiences/path-travel/real-conditions.mjs';
import { planTravel } from '../experiences/path-travel/planner.mjs';

const now = '2026-10-09T03:00:00.000Z';
const foodTags = ['noodles', 'dumplings', 'soup', 'templeFood', 'marketFood'];
const teaTags = ['coffee', 'bakery', 'traditionalTea'];
const foodPlaces = TRAVEL_PLACES.filter(place => ['food', 'tea'].includes(place.category));
const check = (id, input) => evaluateRealConditions(findPlace(id), input, { now, calendar: REAL_CONDITION_CALENDAR });

test('모든 세부 취향 값은 true/false/null이며 모름을 false로 대체하지 않는다', () => {
  assert.deepEqual(PERSONALIZATION_TAGS, [...foodTags, ...teaTags]);
  for (const place of TRAVEL_PLACES) {
    for (const key of PERSONALIZATION_TAGS) {
      const value = place.features[key];
      const evidence = place.provenance.featuresByKey[key];
      assert.ok(value === true || value === false || value === null, `${place.id}:${key}`);
      assert.ok(evidence);
      if (value === null) {
        assert.equal(evidence.kind, 'unknown');
        assert.equal(evidence.sourceUrl, null);
        assert.equal(evidence.verifiedAt, null);
      } else {
        assert.equal(evidence.kind, 'fact');
        assert.match(evidence.sourceUrl, /^https?:\/\//);
        assert.equal(evidence.verifiedAt, '2026-10-09');
        assert.ok(evidence.scope);
      }
      if ((foodTags.includes(key) && place.category !== 'food') || (teaTags.includes(key) && place.category !== 'tea')) assert.equal(value, null, `${place.id}:${key} category scope`);
    }
    for (const key of ['quiet', 'stepFree', 'spicy', 'waitMinutes', 'vegetarian']) assert.equal(Object.hasOwn(place.features, key), false);
  }
});

test('메뉴의 존재는 확인하되 다른 음식의 부재와 계절 코스 포함을 일반화하지 않는다', () => {
  const confirmed = {
    'gaeseong-mandu-koong':['noodles','dumplings','soup'],
    'balwoo-gongyang':['templeFood'],
    'kyungin-traditional-teahouse':['traditionalTea'],
    'osulloc-bukchon':['bakery'],
    hwangsaengga:['noodles','dumplings','soup'], tosokchon:['soup'],
    'tongin-market':['marketFood'], 'fritz-wonseo':['coffee','bakery'],
  };
  for (const [id, keys] of Object.entries(confirmed)) {
    assert.deepEqual(PERSONALIZATION_TAGS.filter(key => findPlace(id).features[key] === true).sort(), keys.sort());
    for (const key of PERSONALIZATION_TAGS.filter(key => !keys.includes(key))) assert.equal(findPlace(id).features[key], null);
  }
  assert.equal(findPlace('balwoo-gongyang').features.noodles, null);
  assert.equal(findPlace('fritz-wonseo').provenance.featuresByKey.bakery.sourcePublishedAt, '2023-05');
  assert.match(findPlace('fritz-wonseo').provenance.featuresByKey.bakery.freshnessNote, /당일/);
});

test('표시 메뉴 가격은 주문 단위·세금·제공 조건을 보존하며 미확인을 0원으로 만들지 않는다', () => {
  assert.equal(foodPlaces.length, 12);
  assert.equal(foodPlaces.flatMap(place => place.menuItems).length, 32);
  for (const place of foodPlaces) {
    assert.ok(place.menuItems.length);
    for (const item of place.menuItems) {
      assert.ok(item.name && item.availabilityNote && item.sourceUrl);
      assert.equal(item.currency, 'KRW');
      assert.equal(item.verifiedAt, '2026-10-09');
      assert.ok(['menu-item','course-menu','exchange-unit'].includes(item.unit));
      assert.ok(item.amount === null || (Number.isInteger(item.amount) && item.amount > 0));
      assert.equal(item.servings, null);
    }
  }
  assert.equal(findPlace('gaeseong-mandu-koong').menuItems[0].amount, 15000);
  assert.equal(findPlace('balwoo-gongyang').menuItems[0].amount, 36000);
  assert.equal(findPlace('balwoo-gongyang').menuItems[0].taxStatus, 'included');
  assert.match(findPlace('balwoo-gongyang').menuItems[0].availabilityNote, /평일 점심/);
  assert.equal(findPlace('balwoo-gongyang').conditions.price.kind, 'unknown');
  assert.equal(findPlace('osulloc-bukchon').menuItems[0].amount, 39000);
  assert.equal(findPlace('osulloc-bukchon').conditions.price.kind, 'unknown');
  assert.equal(findPlace('fritz-wonseo').conditions.price.kind, 'unknown');
  assert.equal(findPlace('tongin-market').menuItems[0].amount, null);
  for (const id of ['balwoo-gongyang','osulloc-bukchon','tongin-market','fritz-wonseo']) assert.equal(check(id, {date:'2026-10-10',budget:50000}).checks.budget.status, 'unknown');
});

test('서로 다른 공식 운영시간·휴무 표기가 있으면 토요일과 월요일 모두 시간 확정을 막는다', () => {
  for (const id of ['gaeseong-mandu-koong','balwoo-gongyang','kyungin-traditional-teahouse','tongin-market']) {
    for (const date of ['2026-10-10','2026-10-12']) assert.equal(check(id, {date,time:'12:00'}).checks.schedule.status, 'unknown', `${id}:${date}`);
  }
  assert.match(findPlace('kyungin-traditional-teahouse').visitInfo.hoursNote, /10:00~22:50/);
  assert.match(findPlace('kyungin-traditional-teahouse').visitInfo.hoursNote, /11:00~21:20/);
  assert.equal(check('osulloc-bukchon',{date:'2026-10-10',time:'20:30'}).checks.schedule.status,'matched');
  assert.equal(check('osulloc-bukchon',{date:'2026-10-12',time:'20:30'}).checks.schedule.status,'unmatched');
});

test('예약 불가·공식 예약 입구·출입구 미확인을 실제 방문 안내에 구별한다', () => {
  for (const place of foodPlaces) {
    const visit = place.visitInfo;
    assert.ok(visit.hoursNote && visit.reservationNote && visit.entranceNote);
    assert.equal(visit.verifiedAt, '2026-10-09');
    assert.ok(visit.sourceUrls.length);
    for (const url of visit.sourceUrls) assert.match(url, /^https?:\/\//);
  }
  assert.match(findPlace('gaeseong-mandu-koong').visitInfo.reservationNote, /모두 예약 불가/);
  assert.equal(findPlace('osulloc-bukchon').bookingUrl, 'https://app.catchtable.co.kr/ct/shop/osullocteahouse_bukchon');
  assert.match(findPlace('fritz-wonseo').visitInfo.reservationNote, /0원/);
});

test('2명과 아이가 있는 일정에서 코스 메뉴 표시가격을 인당 확정비로 더하지 않는다', () => {
  const result = planTravel({date:'2026-10-10',startTime:'11:00',endTime:'17:00',origin:{id:'anguk',name:'안국역',lat:37.5765,lon:126.9855},party:{adults:2,children:1},budget:250000,maxWalkMinutes:100,stopCount:2,preferences:{},requiredCategories:[],lockedIds:['balwoo-gongyang','osulloc-bukchon'],excludedIds:[]},{places:TRAVEL_PLACES,now,ask:false});
  assert.ok(result.primary);
  for (const stop of result.primary.stops) {
    assert.equal(stop.cost.status,'unknown');
    assert.equal(stop.cost.knownAmount,0);
    assert.ok(stop.cost.unknowns.some(reason=>/아이 1명/.test(reason)));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(TRAVEL_PLACES)),TRAVEL_PLACES);
});

test('데이터에 쓰인 식음료 근거와 조사 제외 사유를 별도 대장에 보존한다', async () => {
  const ledger = JSON.parse(await readFile(new URL('../experiences/path-travel/qa/personalization-20261009/sources.json',import.meta.url),'utf8'));
  assert.equal(ledger.checkedAt,'2026-10-09');
  assert.equal(ledger.places.length,8);
  for (const record of ledger.places) {
    const place=findPlace(record.id);
    assert.ok(record);
    assert.deepEqual(record.menuItems,place.menuItems);
    assert.deepEqual(record.visitInfo,place.visitInfo);
    assert.deepEqual(record.featuresByKey,place.provenance.featuresByKey);
    for (const url of [...place.menuItems.map(item=>item.sourceUrl),...place.visitInfo.sourceUrls]) assert.ok(ledger.sources.some(source=>source.url===url),url);
  }
  for (const id of ['balwoo-gongyang','kyungin-traditional-teahouse','tongin-market','fritz-wonseo']) assert.ok(ledger.exclusions.some(record=>record.placeId===id));
});
