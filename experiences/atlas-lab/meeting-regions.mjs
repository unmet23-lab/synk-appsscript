// Dating product vocabulary for voluntarily chosen meeting areas.
// These are broad choices, not residence, GPS, travel-time or adjacency facts.
// The host owns current explicit confirmation, publication and withdrawal.
export const MEETING_REGION_VERSION = 'meeting-regions-1';
export const MAX_MEETING_REGIONS = 6;
const region = (id, label, detail = '') => Object.freeze({ id, value: id, label, detail });
export const MEETING_REGION_OPTIONS = Object.freeze([
  region('seoul-center', '서울 도심', '종로·중구·용산'),
  region('seoul-northeast', '서울 동북권', '성동·광진·동대문·중랑·성북·강북·도봉·노원'),
  region('seoul-northwest', '서울 서북권', '은평·서대문·마포'),
  region('seoul-southwest', '서울 서남권', '양천·강서·구로·금천·영등포·동작·관악'),
  region('seoul-southeast', '서울 동남권', '서초·강남·송파·강동'),
  region('busan', '부산'), region('daegu', '대구'), region('incheon', '인천'),
  region('gwangju', '광주'), region('daejeon', '대전'), region('ulsan', '울산'),
  region('sejong', '세종'), region('gyeonggi', '경기'), region('gangwon', '강원'),
  region('chungbuk', '충북'), region('chungnam', '충남'), region('jeonbuk', '전북'),
  region('jeonnam', '전남'), region('gyeongbuk', '경북'), region('gyeongnam', '경남'),
  region('jeju', '제주'),
]);
export const MEETING_REGION_NOTE = '직접 만나기 가능한 넓은 지역을 골라요. 같은 지역이어도 이동 거리·시간은 다를 수 있어, 구체적인 장소는 서로 정해요. 목록에 없는 해외 지역이나 소개 글은 자동으로 변환하지 않아요.';
const ids = new Set(MEETING_REGION_OPTIONS.map(item => item.id));
const fail = () => { throw new TypeError('Meeting regions: choose one to six distinct known region IDs'); };

/** Validate an explicitly answered set. Missing values are not answers. */
export function validateMeetingRegions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MEETING_REGIONS
    || Reflect.ownKeys(value).length !== value.length + 1) fail();
  const selected = new Set();
  for (let index = 0; index < value.length; index += 1) {
    // Accept stored JSON values, not executable accessors or array-like objects.
    const slot = Object.getOwnPropertyDescriptor(value, String(index));
    if (!slot || !Object.hasOwn(slot, 'value') || typeof slot.value !== 'string'
      || !ids.has(slot.value) || selected.has(slot.value)) fail();
    selected.add(slot.value);
  }
  return MEETING_REGION_OPTIONS.filter(item => selected.has(item.id)).map(item => item.id);
}

/**
 * Exact intersection of two current, authorized sets supplied by the host.
 * Keep the owner's current private choice and confirmed public choice separate;
 * the function does not read profiles or publish either party's private values.
 * Unknown is not disjoint and never expands to every region.
 */
export function compareMeetingRegions(left, right) {
  const a = left == null ? null : validateMeetingRegions(left);
  const b = right == null ? null : validateMeetingRegions(right);
  if (a === null || b === null) return { status: 'unknown', shared: [] };
  const accepted = new Set(b), shared = a.filter(id => accepted.has(id));
  return { status: shared.length ? 'overlap' : 'disjoint', shared };
}

/** Display only validated choices; free-form profile text is never mapped. */
export function formatMeetingRegions(value) {
  if (value == null) return '미확인';
  const selected = new Set(validateMeetingRegions(value));
  return MEETING_REGION_OPTIONS.filter(item => selected.has(item.id)).map(item => item.label).join(' · ');
}
