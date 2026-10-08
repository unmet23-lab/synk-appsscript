import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEETING_REGION_VERSION, MAX_MEETING_REGIONS, MEETING_REGION_OPTIONS, MEETING_REGION_NOTE,
  validateMeetingRegions, compareMeetingRegions, formatMeetingRegions,
} from '../experiences/atlas-lab/meeting-regions.mjs';

test('meeting-area vocabulary is immutable, bounded and has no implicit any/nearby choice', () => {
  assert.equal(MEETING_REGION_VERSION, 'meeting-regions-1');
  assert.equal(MAX_MEETING_REGIONS, 6);
  assert.equal(MEETING_REGION_OPTIONS.length, 21);
  assert.equal(new Set(MEETING_REGION_OPTIONS.map(item => item.id)).size, 21);
  assert.ok(Object.isFrozen(MEETING_REGION_OPTIONS));
  for (const item of MEETING_REGION_OPTIONS) {
    assert.ok(Object.isFrozen(item));
    assert.equal(item.id, item.value);
    assert.match(item.id, /^[a-z][a-z-]*$/);
    assert.ok(item.label.trim());
  }
  assert.ok(!MEETING_REGION_OPTIONS.some(item => ['any', 'nearby', 'overseas', 'seoul'].includes(item.id)));
  assert.match(MEETING_REGION_NOTE, /이동 거리·시간/);
  assert.match(MEETING_REGION_NOTE, /자동으로 변환하지 않아요/);
});

test('answers are copied and ordered by the vocabulary without modifying the declared set', () => {
  const source = ['jeju', 'seoul-southeast', 'busan'], before = structuredClone(source);
  const canonical = validateMeetingRegions(source);
  assert.deepEqual(canonical, ['seoul-southeast', 'busan', 'jeju']);
  assert.deepEqual(source, before);
  canonical.push('incheon');
  assert.deepEqual(source, before);
  assert.deepEqual(validateMeetingRegions(Object.freeze(source)), before.slice().sort((a, b) =>
    MEETING_REGION_OPTIONS.findIndex(item => item.id === a) - MEETING_REGION_OPTIONS.findIndex(item => item.id === b)));
});

test('the selected regions must be between one and six distinct known values', () => {
  const six = MEETING_REGION_OPTIONS.slice(0, 6).map(item => item.id);
  assert.deepEqual(validateMeetingRegions(six), six);
  for (const invalid of [[], [...six, 'daegu'], ['busan', 'busan'], ['BUSAN'], [' busan'], ['busan '],
    ['서울 동남권'], ['seoul'], ['busan', 'unknown-region'], ['__proto__'], ['constructor'], ['any']]) {
    assert.throws(() => validateMeetingRegions(invalid), /Meeting regions/);
  }
});

test('region text, residence, coordinates and raw scalars cannot silently become an answer', () => {
  const noCoercion = { toString() { throw new Error('must not interpret text'); } };
  for (const invalid of [undefined, null, 'busan', '서울 강남에서 살아요', 1, false,
    new Set(['busan']), { region: 'busan' }, { lat: 37.5, lng: 127.0 }, { 0: 'busan', length: 1 }, [noCoercion]]) {
    assert.throws(() => validateMeetingRegions(invalid), /Meeting regions/);
  }
});

test('sparse, extended or executable arrays are rejected without reading a getter', () => {
  const sparse = new Array(1), extended = ['busan']; extended.region = 'jeju';
  const symbol = ['busan']; symbol[Symbol('private')] = 'not a region';
  const accessor = ['busan']; Object.defineProperty(accessor, '0', { get() { throw new Error('getter must remain unread'); } });
  for (const invalid of [sparse, extended, symbol, accessor]) {
    assert.throws(() => validateMeetingRegions(invalid), /Meeting regions/);
  }
});

test('intersection is exact and symmetric regardless of source ordering', () => {
  const a = ['busan', 'seoul-southeast', 'jeju'], b = ['jeju', 'incheon', 'busan'];
  const expected = { status: 'overlap', shared: ['busan', 'jeju'] };
  assert.deepEqual(compareMeetingRegions(a, b), expected);
  assert.deepEqual(compareMeetingRegions(b, a), expected);
  assert.deepEqual(compareMeetingRegions(a.slice().reverse(), b), expected);
});

test('different selected areas do not gain a geographic proximity or same-city allowance', () => {
  assert.deepEqual(compareMeetingRegions(['seoul-southeast'], ['seoul-southwest']), { status: 'disjoint', shared: [] });
  assert.deepEqual(compareMeetingRegions(['seoul-southeast'], ['gyeonggi']), { status: 'disjoint', shared: [] });
  assert.deepEqual(compareMeetingRegions(['incheon'], ['gyeonggi']), { status: 'disjoint', shared: [] });
  assert.deepEqual(compareMeetingRegions(['jeju'], ['busan']), { status: 'disjoint', shared: [] });
});

test('missing public information is unknown, distinct from a confirmed disjoint set', () => {
  for (const missing of [null, undefined]) {
    assert.deepEqual(compareMeetingRegions(missing, ['busan']), { status: 'unknown', shared: [] });
    assert.deepEqual(compareMeetingRegions(['busan'], missing), { status: 'unknown', shared: [] });
    assert.deepEqual(compareMeetingRegions(missing, missing), { status: 'unknown', shared: [] });
  }
  assert.throws(() => compareMeetingRegions([], ['busan']), /Meeting regions/);
  assert.throws(() => compareMeetingRegions(null, ['unlisted']), /Meeting regions/);
  assert.throws(() => compareMeetingRegions(['unlisted'], null), /Meeting regions/);
});

test('current private actual areas and confirmed public actual areas stay separate', () => {
  const ownPublic = ['seoul-southeast', 'busan'], ownCurrentPrivate = ['busan'];
  const otherPublic = ['seoul-southeast'], otherPrivate = ['jeju'];
  const allBefore = structuredClone([ownPublic, ownCurrentPrivate, otherPublic, otherPrivate]);
  assert.deepEqual(compareMeetingRegions(ownPublic, otherPublic), { status: 'overlap', shared: ['seoul-southeast'] });
  assert.deepEqual(compareMeetingRegions(ownCurrentPrivate, otherPublic), { status: 'disjoint', shared: [] });
  assert.deepEqual([ownPublic, ownCurrentPrivate, otherPublic, otherPrivate], allBefore);
  const output = compareMeetingRegions(ownCurrentPrivate, otherPublic);
  assert.deepEqual(Object.keys(output).sort(), ['shared', 'status']);
  assert.equal(JSON.stringify(output).includes('jeju'), false);
});

test('formatted areas use validated labels in stable order and preserve unknown', () => {
  assert.equal(formatMeetingRegions(['jeju', 'busan', 'seoul-southeast']), '서울 동남권 · 부산 · 제주');
  assert.equal(formatMeetingRegions(undefined), '미확인'); assert.equal(formatMeetingRegions(null), '미확인');
  for (const invalid of [[], ['unknown'], '서울 강남', ['<script>'], ['busan', 'busan']]) {
    assert.throws(() => formatMeetingRegions(invalid), /Meeting regions/);
  }
});

test('returned intersections cannot mutate either source or subsequent comparisons', () => {
  const left = ['busan', 'jeju'], right = ['jeju', 'busan'];
  const output = compareMeetingRegions(left, right); output.shared.length = 0; output.status = 'unknown';
  assert.deepEqual(left, ['busan', 'jeju']); assert.deepEqual(right, ['jeju', 'busan']);
  assert.deepEqual(compareMeetingRegions(left, right), { status: 'overlap', shared: ['busan', 'jeju'] });
});
