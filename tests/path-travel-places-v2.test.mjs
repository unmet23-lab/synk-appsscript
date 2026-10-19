import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { TRAVEL_PLACES, SOURCES, PHOTO_CREDITS, TRAVEL_META, findPlace } from '../experiences/path-travel/places-v2.mjs';
import { REAL_PLACES, REAL_CONDITION_CALENDAR } from '../experiences/path-travel/real-places.mjs';
import { evaluateRealConditions, evaluateRealStay } from '../experiences/path-travel/real-conditions.mjs';
import { planTravel } from '../experiences/path-travel/planner.mjs';

const now = '2026-10-09T03:00:00.000Z';
const options = { now, calendar: REAL_CONDITION_CALENDAR };
const schedule = (id, date = '2026-10-10', time = '12:00', settings = options) => evaluateRealConditions(findPlace(id), { date, time }, settings).checks.schedule;
const stay = (id, time, stayMinutes, date = '2026-10-10') => evaluateRealStay(findPlace(id), { date, time, stayMinutes }, options);
const budget = (id, amount) => evaluateRealConditions(findPlace(id), { date: '2026-10-10', budget: amount }, options).checks.budget;
const isHttps = value => { assert.equal(new URL(value).protocol, 'https:'); };
const originalIds = new Set(REAL_PLACES.map(place => place.id));
const additions = TRAVEL_PLACES.filter(place => !originalIds.has(place.id));

test('실제 장소 25곳은 보강 범위 외 기존 조건을 보존하고 숙박 2곳을 당일 추천에서 제외한다', () => {
  assert.equal(TRAVEL_PLACES.length, 25);
  assert.equal(new Set(TRAVEL_PLACES.map(p => p.id)).size, 25);
  assert.equal(additions.length, 14);
  assert.equal(TRAVEL_META.placeCount, 25);
  assert.deepEqual(JSON.parse(JSON.stringify(TRAVEL_PLACES)), TRAVEL_PLACES);
  for (const original of REAL_PLACES.filter(place => !['food', 'tea'].includes(place.category))) {
    const { childPrice, ...conditions } = findPlace(original.id).conditions;
    assert.deepEqual(conditions, original.conditions);
    if (childPrice) assert.equal(original.id, 'seoul-museum-craft-art');
  }
  // Enrichment must not mutate the legacy catalogue used by the preserved app.
  assert.equal(REAL_PLACES.find(place => place.id === 'kyungin-traditional-teahouse').conditions.hours.scope, 'full');
  assert.equal(TRAVEL_PLACES.filter(p => p.dayPlannerEligible).length, 23);
  for (const place of TRAVEL_PLACES) {
    assert.equal(place.dayPlannerEligible, place.category !== 'stay');
    assert.ok(place.address && place.name);
    isHttps(place.officialUrl); isHttps(place.bookingUrl);
    if (place.dayPlannerEligible) {
      assert.ok(place.coordinates.lat > 37.5 && place.coordinates.lat < 37.7);
      assert.ok(place.coordinates.lon > 126.9 && place.coordinates.lon < 127.1);
      assert.equal(place.coordinates.accuracy, 'approximate');
      isHttps(place.coordinates.sourceUrl);
    }
  }
  assert.equal(findPlace('not-a-place'), null);
});

test('사진·분위기로 조용함·무장애·채식을 단정하지 않고 체류 제안은 추정으로 구분한다', () => {
  for (const place of TRAVEL_PLACES) {
    for (const field of ['quiet', 'stepFree', 'vegetarian', 'waitMinutes']) assert.equal(Object.hasOwn(place.features, field), false, place.id + ':' + field);
    for (const field of ['quiet', 'wait', 'accessibility', 'liveAvailability']) assert.equal(place.provenance[field].kind, 'unknown');
    assert.equal(place.provenance.planningStayMinutes.kind, 'estimated');
    assert.equal(place.planningStayProvenance, 'estimated');
    if (place.dayPlannerEligible) assert.ok(Number.isInteger(place.planningStayMinutes) && place.planningStayMinutes > 0);
    else assert.equal(place.planningStayMinutes, 0);
  }
});

test('신규 요일 키·시간·출처는 real-conditions 계약에 맞고 불명 운영은 빈 주간표로 남긴다', () => {
  for (const place of additions) {
    const { hours, price } = place.conditions;
    isHttps(hours.sourceUrl); isHttps(price.sourceUrl);
    assert.match(hours.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(hours.holidayPolicy, 'unknown');
    for (const [weekday, slots] of Object.entries(hours.weekly)) {
      assert.match(weekday, /^[0-6]$/);
      for (const slot of slots) {
        for (const value of [slot.open, slot.close, ...(slot.lastEntry ? [slot.lastEntry] : [])]) assert.match(value, /^(?:[01]\d|2[0-3]):[0-5]\d$/);
        assert.ok(slot.open < slot.close);
        if (slot.lastEntry) assert.ok(slot.open <= slot.lastEntry && slot.lastEntry <= slot.close);
      }
    }
  }
  for (const id of ['tongin-market', 'jogyesa']) {
    assert.equal(findPlace(id).conditions.hours.scope, 'partial');
    assert.equal(schedule(id).status, 'unknown');
  }
});

test('10월 10일 정오 전체 25곳은 시간 충돌을 제외한 15곳만 운영 조건이 맞는다', () => {
  const statuses = Object.fromEntries(TRAVEL_PLACES.map(p => [p.id, schedule(p.id).status]));
  assert.deepEqual(Object.keys(statuses).filter(id => statuses[id] === 'matched').sort(), [
    'bukchon-hanok', 'changgyeonggung', 'fritz-wonseo', 'gyeonghuigung', 'hwangsaengga',
    'mmca-seoul', 'osulloc-bukchon', 'seoul-history-museum',
    'seoul-museum-craft-art', 'tosokchon', 'unhyeongung',
    'imun-seolnongtang', 'gwanghwamun-mijin', 'onion-anguk', 'national-museum-contemporary-history',
  ].sort());
  assert.equal(Object.values(statuses).filter(status => status === 'unknown').length, 10);
  assert.equal(Object.values(statuses).includes('unmatched'), false);
});

test('월요일 박물관·고궁 휴관을 유지하고 매일 운영 장소와 구별한다', () => {
  for (const id of ['seoul-museum-craft-art', 'unhyeongung', 'changgyeonggung', 'seoul-history-museum', 'gyeonghuigung']) assert.equal(schedule(id, '2026-10-12').status, 'unmatched', id);
  for (const id of ['hwangsaengga', 'tosokchon', 'fritz-wonseo', 'mmca-seoul', 'bukchon-hanok']) assert.equal(schedule(id, '2026-10-12').status, 'matched', id);
});

test('한글날 운영을 일반 요일로 단정하지 않으며 달력 없는 판정도 미확인이다', () => {
  for (const place of additions) assert.equal(schedule(place.id, '2026-10-09').status, 'unknown', place.id);
  assert.equal(schedule('seoul-museum-craft-art', '2026-10-09').status, 'matched');
  assert.equal(schedule('hwangsaengga', '2026-10-10', '12:00', { now }).status, 'unknown');
  assert.equal(schedule('hwangsaengga', '2026-11-07', '12:00').status, 'unknown');
});

test('서울역사박물관 가을 야간 운영·목요일 단축·입장 마감을 실제 시간표에 적용한다', () => {
  assert.equal(schedule('seoul-history-museum', '2026-10-10', '19:00').status, 'matched');
  assert.equal(schedule('seoul-history-museum', '2026-10-13', '19:00').status, 'matched');
  assert.equal(schedule('seoul-history-museum', '2026-10-15', '19:00').status, 'unmatched');
  assert.equal(stay('seoul-history-museum', '20:29', 31).status, 'matched');
  assert.equal(stay('seoul-history-museum', '20:30', 1).status, 'unmatched');
  assert.equal(stay('seoul-history-museum', '20:00', 61).status, 'unmatched');
  assert.equal(stay('seoul-history-museum', '17:00', 180).status, 'matched');
  // Even if a later source refresh preserves the old weekly slots, a seasonal
  // schedule must not silently become an all-year opening promise.
  const expired = structuredClone(findPlace('seoul-history-museum'));
  expired.conditions.hours.verifiedAt = '2026-12-01';
  const result = evaluateRealConditions(expired, { date: '2026-12-01', time: '19:00' }, { now: '2026-12-01T03:00:00.000Z', calendar: { ...REAL_CONDITION_CALENDAR, from: '2026-12-01', through: '2026-12-02', holidays: [], verifiedAt: '2026-12-01' } });
  assert.equal(result.checks.schedule.status, 'unknown');
  assert.match(result.checks.schedule.reason, /운영기간/);
});

test('긴 체류는 폐관·주문마감·북촌 방문 제한을 넘을 수 없다', () => {
  assert.equal(stay('fritz-wonseo', '17:00', 150).status, 'matched');
  assert.equal(stay('fritz-wonseo', '17:00', 151).status, 'unmatched');
  assert.equal(stay('gyeonghuigung', '17:00', 60).status, 'matched');
  assert.equal(stay('gyeonghuigung', '17:00', 61).status, 'unmatched');
  assert.equal(stay('bukchon-hanok', '16:00', 60).status, 'matched');
  assert.equal(stay('bukchon-hanok', '16:00', 61).status, 'unmatched');
  assert.equal(stay('hwangsaengga', '20:30', 30).status, 'unmatched');
});

test('공식 무료 입장과 가격 미확인·전시별 표시가격을 다르게 판정한다', () => {
  for (const id of ['seoul-history-museum', 'gyeonghuigung', 'jogyesa']) {
    assert.equal(findPlace(id).conditions.price.kind, 'free');
    assert.equal(budget(id, 0).status, 'matched');
  }
  for (const id of ['hwangsaengga', 'tosokchon', 'tongin-market', 'fritz-wonseo', 'bukchon-hanok', 'mmca-seoul']) assert.equal(budget(id, 0).status, 'unknown', id);
  assert.equal(budget('gyeongbokgung', 0).status, 'unmatched');
  assert.equal(findPlace('mmca-seoul').conditions.price.kind, 'sample');
});

test('아동 비용은 출처가 확인된 무료 일반관람만 계산하고 미확인 장소에는 성인 요금을 대입하지 않는다', () => {
  const input = { date: '2026-10-10', startTime: '10:00', endTime: '18:00', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9855 }, party: { adults: 2, children: 1 }, budget: 70000, maxWalkMinutes: 100, stopCount: 2, preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: ['seoul-history-museum', 'gyeonghuigung'], excludedIds: [] };
  const result = planTravel(input, { now, places: TRAVEL_PLACES, ask: false });
  assert.ok(result.primary);
  const history = result.primary.stops.find(stop => stop.placeId === 'seoul-history-museum').cost;
  assert.equal(history.status, 'matched');
  assert.equal(history.knownAmount, 0);
  assert.equal(history.items.find(item => item.basis === 'child-admission').quantity, 1);
  const palace = result.primary.stops.find(stop => stop.placeId === 'gyeonghuigung').cost;
  assert.equal(palace.status, 'unknown');
  assert.ok(palace.unknowns.some(reason => /아이 1명/.test(reason)));
  assert.equal(palace.items.some(item => item.basis === 'child-admission'), false);
});

test('실제 장소 사진 13개는 로컬 파일·저작자·라이선스·원본 URL·해시가 출처 대장과 일치한다', async () => {
  const ledger = JSON.parse(await readFile(new URL('../experiences/path-travel/qa/redesign-20261009/sources.json', import.meta.url), 'utf8'));
  const expansion = JSON.parse(await readFile(new URL('../experiences/path-travel/qa/expansion-20261009/sources.json', import.meta.url), 'utf8'));
  assert.deepEqual([...ledger.records.map(record => expansion.sourceUpdates.find(update => update.id === record.id) || record), ...expansion.records], SOURCES);
  assert.deepEqual([...ledger.photos, ...expansion.photos], PHOTO_CREDITS);
  assert.equal(PHOTO_CREDITS.length, 13);
  assert.equal(TRAVEL_PLACES.filter(place => place.photo).length, 13);
  for (const photo of PHOTO_CREDITS) {
    assert.match(photo.src, /^\.\/assets\/places\/[a-z0-9-]+\.jpg$/);
    for (const key of ['sourceUrl', 'licenseUrl', 'originalUrl', 'downloadUrl']) isHttps(photo[key]);
    assert.ok(photo.author && photo.license && photo.photographedAt && photo.modifications);
    assert.equal(photo.visuallyReviewed, true);
    const bytes = await readFile(new URL('../experiences/path-travel/' + photo.src.slice(2), import.meta.url));
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8);
    assert.equal(bytes.length, photo.bytes);
    assert.ok(bytes.length < 1024 * 1024, photo.id + ' exceeds 1 MiB');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), photo.sha256);
    assert.equal(findPlace(photo.id).photo.src, photo.src);
  }
});
