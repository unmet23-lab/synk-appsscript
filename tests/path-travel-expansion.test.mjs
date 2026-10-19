import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRAVEL_PLACES, SOURCES, PHOTO_CREDITS, PERSONALIZATION_TAGS, findPlace } from '../experiences/path-travel/places-v2.mjs';
import { REAL_CONDITION_CALENDAR } from '../experiences/path-travel/real-places.mjs';
import { evaluateRealConditions, evaluateRealStay } from '../experiences/path-travel/real-conditions.mjs';
import { planTravel } from '../experiences/path-travel/planner.mjs';

const ids = ['imun-seolnongtang', 'gwanghwamun-mijin', 'onion-anguk', 'beautiful-tea-museum', 'national-museum-contemporary-history'];
const now = '2026-10-09T03:00:00.000Z';
const options = { now, calendar: REAL_CONDITION_CALENDAR };
const schedule = (id, time, date='2026-10-10') => evaluateRealConditions(findPlace(id), {date,time}, options).checks.schedule.status;

test('추가 5곳과 나인트리 대표점은 근거가 있는 종로 길망 범위 안 좌표다', async () => {
  const { bbox:[south,west,north,east] } = JSON.parse(await readFile(new URL('../experiences/path-travel/assets/jongno-walking.json',import.meta.url),'utf8'));
  for (const id of [...ids,'nine-tree-insadong']) {
    const place=findPlace(id), source=SOURCES.find(source=>source.id===id);
    const {lat,lon}=place.coordinates;
    assert.ok(lat>=south && lat<=north && lon>=west && lon<=east,id);
    assert.ok(source.coordinateEvidence);
    assert.equal(place.coordinates.accuracy,'approximate');
    assert.equal(place.coordinates.sourceUrl,source.coordinateSourceUrl||source.url);
    assert.match(place.coordinates.note,/실측/);
  }
  assert.equal(findPlace('nine-tree-insadong').dayPlannerEligible,false);
  assert.equal(findPlace('orakai-insadong-suites').coordinates,null);
});

test('새 식당 준비시간과 주문마감·카페 주말 개점을 실제 조건 판정에 적용한다', () => {
  assert.equal(schedule('imun-seolnongtang','14:29'),'matched');
  assert.equal(schedule('imun-seolnongtang','14:30'),'unmatched');
  assert.equal(schedule('imun-seolnongtang','15:30'),'unmatched');
  assert.equal(schedule('imun-seolnongtang','16:30'),'matched');
  assert.equal(schedule('imun-seolnongtang','20:00','2026-10-11'),'unmatched');
  assert.equal(schedule('imun-seolnongtang','20:00','2026-10-12'),'matched');
  assert.equal(evaluateRealStay(findPlace('imun-seolnongtang'),{date:'2026-10-10',time:'14:20',stayMinutes:41},options).status,'unmatched');
  assert.equal(schedule('gwanghwamun-mijin','20:30'),'unmatched');
  assert.equal(schedule('onion-anguk','08:00'),'unmatched');
  assert.equal(schedule('onion-anguk','08:00','2026-10-12'),'matched');
});

test('무료 박물관의 월요일 운영·수토 야간 운영과 입장 마감을 구별한다', () => {
  const id='national-museum-contemporary-history';
  assert.equal(schedule(id,'12:00','2026-10-12'),'matched');
  assert.equal(schedule(id,'20:00'),'matched');
  assert.equal(schedule(id,'20:00','2026-10-14'),'matched');
  assert.equal(schedule(id,'20:00','2026-10-13'),'unmatched');
  assert.equal(schedule(id,'20:30'),'unmatched');
  assert.equal(evaluateRealStay(findPlace(id),{date:'2026-10-10',time:'20:00',stayMinutes:61},options).status,'unmatched');
  assert.equal(schedule(id,'12:00','2026-10-09'),'unknown');
});

test('다원 입장 무료를 차 주문비로 사용하지 않고 새 메뉴의 미확인 금액과 취향 부재를 보존한다', () => {
  const confirmed={
    'imun-seolnongtang':['soup'], 'gwanghwamun-mijin':['noodles'],
    'onion-anguk':['coffee','bakery'], 'beautiful-tea-museum':['traditionalTea'],
  };
  for (const [id,tags] of Object.entries(confirmed)) {
    const place=findPlace(id);
    assert.deepEqual(PERSONALIZATION_TAGS.filter(key=>place.features[key]===true).sort(),tags.sort());
    for (const key of PERSONALIZATION_TAGS.filter(key=>!tags.includes(key))) assert.equal(place.features[key],null);
    assert.equal(place.conditions.price.kind,'unknown');
    assert.equal(evaluateRealConditions(place,{date:'2026-10-10',budget:1000000},options).checks.budget.status,'unknown');
    for (const menu of place.menuItems) {
      assert.equal(menu.amount,null);
      assert.equal(menu.servings,null);
    }
  }
  const tea=findPlace('beautiful-tea-museum');
  assert.equal(schedule(tea.id,'12:00'),'unknown');
  assert.equal(tea.conditions.hours.scope,'partial');
  assert.match(tea.visitInfo.reservationNote,/1인1메뉴/);
});

test('새 무료 일반관람은 성인과 아이 모두 0원이며 편의시설로 전체 무장애를 보장하지 않는다', () => {
  const result=planTravel({date:'2026-10-10',startTime:'10:00',endTime:'18:00',origin:{id:'anguk',name:'안국역',lat:37.5765,lon:126.9855},party:{adults:2,children:1},budget:70000,maxWalkMinutes:100,stopCount:2,preferences:{},requiredCategories:[],lockedIds:['national-museum-contemporary-history','seoul-museum-craft-art'],excludedIds:[]},{places:TRAVEL_PLACES,now,ask:false});
  assert.ok(result.primary);
  for (const stop of result.primary.stops) {
    assert.equal(stop.cost.status,'matched');
    assert.equal(stop.cost.knownAmount,0);
    assert.equal(stop.cost.items.find(item=>item.basis==='child-admission').quantity,1);
    assert.equal(Object.hasOwn(stop.place.features,'stepFree'),false);
    assert.equal(stop.place.provenance.accessibility.kind,'unknown');
    assert.match(stop.place.visitInfo.entranceNote,/휠체어/);
    assert.match(stop.place.visitInfo.entranceNote,/미확인/);
  }
  assert.match(findPlace('seoul-museum-craft-art').conditions.childPrice.note,/어린이박물관/);
});

test('확장 대장은 새 자료·메뉴·사진과 수정한 기존 방문 조건을 그대로 기록한다', async () => {
  const ledger=JSON.parse(await readFile(new URL('../experiences/path-travel/qa/expansion-20261009/sources.json',import.meta.url),'utf8'));
  assert.deepEqual(ledger.records,SOURCES.filter(source=>ids.includes(source.id)));
  assert.deepEqual(ledger.photos,PHOTO_CREDITS.filter(photo=>ids.includes(photo.id)));
  assert.equal(ledger.coverage.after.dayPlaces,TRAVEL_PLACES.filter(place=>place.dayPlannerEligible).length);
  for (const record of ledger.places) {
    const place=findPlace(record.id);
    assert.deepEqual(record.conditions,place.conditions);
    assert.deepEqual(record.menuItems,place.menuItems||[]);
    assert.deepEqual(record.visitInfo,place.visitInfo);
    assert.deepEqual(record.featuresByKey,place.provenance.featuresByKey);
    for (const url of place.visitInfo.sourceUrls) assert.ok(ledger.sources.some(source=>source.url===url));
  }
  for (const record of ledger.existingPlaceUpdates) {
    const place=findPlace(record.id);
    assert.deepEqual(record.coordinates,place.coordinates);
    assert.deepEqual(record.childPrice,place.conditions.childPrice||null);
    assert.deepEqual(record.visitInfo,place.visitInfo||null);
  }
  for (const rights of ledger.photoRightsReview) assert.equal(rights.ownWork,true);
  assert.equal(ledger.photos.reduce((sum,photo)=>sum+photo.bytes,0),488798);
  assert.equal(ledger.exclusions.some(record=>record.placeId==='orakai-insadong-suites'),true);
});
