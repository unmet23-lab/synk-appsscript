import test from 'node:test';
import assert from 'node:assert/strict';
import { CANDIDATES } from '../experiences/path-travel/catalog.mjs';
import { REAL_META, REAL_PLACES } from '../experiences/path-travel/real-places.mjs';
import {
  CATEGORIES, normalizeRealState, findRealPlaces, readRealState,
  serializeRealState, mapLink, exportRealMemo,
} from '../experiences/path-travel/real-guide.mjs';

test('관심 분야의 모든 조합은 선택한 분야만 보여주며 담은 방문 목록은 유지한다', () => {
  const picked = REAL_PLACES.slice(-2).map(place => place.id);
  for (let mask = 0; mask < 2 ** CATEGORIES.length; mask++) {
    const interests = CATEGORIES.filter((_, index) => mask & (1 << index)).map(item => item.id);
    const state = { interests, selected: picked };
    const before = structuredClone(state);
    const found = findRealPlaces(state);
    assert.deepEqual(state, before, '검색이 관심 분야나 방문 순서를 변경하지 않는다');
    const shownCategories = new Set(found.map(place => place.category));
    assert.deepEqual(shownCategories, new Set(interests.length ? interests : CATEGORIES.map(item => item.id)));
    for (const place of found) assert.deepEqual(place, REAL_PLACES.find(row => row.id === place.id));
    assert.equal(new Set(found.map(place => place.id)).size, found.length);
  }
  assert.deepEqual(findRealPlaces(), REAL_PLACES);
});

test('모르는 ID와 중복은 제거하고 사용자가 직접 담은 순서는 보존한다', () => {
  const first = REAL_PLACES[0].id, last = REAL_PLACES.at(-1).id;
  const input = {
    interests: ['tea', 'unknown-interest', 'food', 'tea', null, 1],
    selected: [last, 'unknown-place', first, last, null, 1],
    privateNote: '저장 대상이 아닌 값',
  };
  const before = structuredClone(input);
  assert.deepEqual(normalizeRealState(input), {
    version: 2, interests: ['tea', 'food'], selected: [last, first],
    reactions: {}, visits: {}, categoryPreferences: {}, feedbackConsent: false,
  });
  assert.deepEqual(input, before);
  assert.deepEqual(normalizeRealState({ interests: 'food', selected: {} }), {
    version: 2, interests: [], selected: [],
    reactions: {}, visits: {}, categoryPreferences: {}, feedbackConsent: false,
  });
});

test('저장 동의가 없는 기록과 손상되거나 지원하지 않는 기록은 복원하지 않는다', () => {
  const state = { version: 1, interests: ['tea'], selected: [REAL_PLACES[0].id] };
  for (const raw of [
    null, undefined, 1, '', '{', 'null', '[]', JSON.stringify(state),
    JSON.stringify({ ...state, consent: false }),
    JSON.stringify({ ...state, consent: 'true' }),
    JSON.stringify({ ...state, consent: true, version: 2 }),
    ' '.repeat(4097),
  ]) assert.equal(readRealState(raw), null);

  const serialized = serializeRealState({ ...state, selected: [...state.selected, 'unknown-place'], extra: '제외' });
  assert.equal(JSON.parse(serialized).consent, true);
  assert.deepEqual(readRealState(serialized), normalizeRealState(state));
  assert.equal(Object.hasOwn(JSON.parse(serialized), 'extra'), false);
});

test('실제 장소 메모는 담은 순서와 출처를 보존하고 확정된 일정으로 표현하지 않는다', () => {
  const chosen = [REAL_PLACES.at(-1), REAL_PLACES[0], REAL_PLACES[2]];
  const memo = exportRealMemo({ interests: ['food', 'tea'], selected: chosen.map(place => place.id) });
  const headings = memo.split('\n').filter(line => /^\d+\. /.test(line));
  assert.deepEqual(headings, chosen.map((place, index) => `${index + 1}. ${place.name}`));
  assert.ok(memo.includes(`공식 안내 확인일: ${REAL_META.checkedAt}`));
  for (const place of chosen) {
    assert.ok(memo.includes(`주소: ${place.address}`));
    assert.ok(memo.includes(`공식 안내 (${place.sourceLabel}): ${place.sourceUrl}`));
    assert.ok(memo.includes(`지도 검색: ${mapLink(place)}`));
    assert.ok(memo.includes(`운영·휴관 안내: ${place.openingNote}`));
    assert.ok(memo.includes(`운영·방문 공식 출처: ${place.visitSourceUrl}`));
    assert.ok(memo.includes(`찾아가기: ${place.accessNote}`));
    assert.ok(memo.includes(`찾아가기 공식 출처: ${place.accessSourceUrl}`));
    assert.ok(memo.includes(`안내 확인일: ${place.verifiedAt}`));
  }
  assert.match(memo, /이동 경로·시간·총예산이나 예약을 확정한 일정이 아닙니다/);
  assert.match(memo, /실시간 영업 확인을 뜻하지 않습니다/);
});

test('모든 실제 장소는 공식 출처와 확인일·주소를 갖고 지도 검색에도 주소를 전달한다', () => {
  const officialHosts = new Set([
    'korean.visitseoul.net', 'www.osulloc.com', 'www.ninetreehotels.com',
    'insa.orakaihotels.com', 'craftmuseum.seoul.go.kr',
    'royal.khs.go.kr', 'nfm.go.kr', 'www.koong.co.kr',
  ]);
  assert.equal(REAL_META.sourceKind, 'official-web-notices');
  assert.equal(REAL_META.liveAvailability, false);
  assert.match(REAL_META.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(REAL_PLACES.map(place => place.id)).size, REAL_PLACES.length);
  for (const place of REAL_PLACES) {
    assert.ok(place.sourceLabel && place.address && place.visitNote, place.id);
    assert.match(place.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(Date.parse(place.checkedAt)), place.id);
    const source = new URL(place.sourceUrl);
    assert.equal(source.protocol, 'https:');
    assert.ok(officialHosts.has(source.hostname), `공식 출처를 다시 검토할 도메인: ${source.hostname}`);
    const map = new URL(mapLink(place));
    assert.equal(map.origin, 'https://www.google.com');
    assert.equal(map.pathname, '/maps/search/');
    assert.equal(map.searchParams.get('api'), '1');
    assert.equal(map.searchParams.get('query'), `${place.name} ${place.address}`);
  }
});

test('숙소에는 임의의 고정 요금 대신 날짜·객실·인원별 확인 조건을 보여준다', () => {
  const stays = findRealPlaces({ interests: ['stay'] });
  const hotelHomeHosts = new Set(['www.ninetreehotels.com', 'insa.orakaihotels.com']);
  assert.ok(stays.length > 0);
  for (const place of stays) {
    assert.match(place.costNote, /날짜.*객실.*인원/);
    assert.match(place.costNote, /요금 확인/);
    assert.doesNotMatch(place.costNote, /\d[\d,]*\s*원/);
    for (const key of ['price', 'rate', 'totalCost', 'nightlyPrice']) assert.equal(Object.hasOwn(place, key), false);
    const hotelHome = new URL(place.sourceUrl);
    assert.equal(Object.hasOwn(place, 'bookingUrl'), false);
    assert.equal(hotelHome.protocol, 'https:');
    assert.ok(hotelHomeHosts.has(hotelHome.hostname), '객실·예약 안내는 검증한 호텔 공식 홈페이지로 연결한다');
  }
});

test('가상 업체 ID는 실제 장소 선택·저장 복원·내보내기에 섞이지 않는다', () => {
  const fixtureIds = CANDIDATES.map(place => place.id);
  const realIds = new Set(REAL_PLACES.map(place => place.id));
  assert.ok(fixtureIds.every(id => !realIds.has(id)));
  const real = REAL_PLACES[0];
  const mixed = { interests: [], selected: [fixtureIds[0], real.id, ...fixtureIds] };
  const normalized = normalizeRealState(mixed);
  assert.deepEqual(normalized.selected, [real.id]);
  assert.deepEqual(readRealState(serializeRealState(mixed)).selected, [real.id]);
  const memo = exportRealMemo(mixed);
  assert.deepEqual(memo.split('\n').filter(line => /^\d+\. /.test(line)), [`1. ${real.name}`]);
  assert.ok(CANDIDATES.every(place => !memo.includes(place.name)));
});
