import { REAL_PLACES, REAL_CONDITION_CALENDAR } from './real-places.mjs?v=20261007-halfday1';
import { normalizeRealQuery, evaluateRealConditions, evaluateRealStay, REAL_CONDITION_LABELS } from './real-conditions.mjs?v=20261007-halfday1';
import { rankRealPlaces, mapLink } from './real-guide.mjs?v=20261007-halfday1';
import { REAL_COURSE_OFFERINGS } from './real-course-data.mjs?v=20261007-halfday1';

// This is an editable timetable, not measured routing or a saved taste record.
export const REAL_COURSE_LIMITS = Object.freeze({ minStops: 2, maxStops: 3, minStay: 10, maxStay: 180, minTransfer: 0, maxTransfer: 180 });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
  && Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key));
const keys = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));
const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const time = value => value === null ? null : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000-')
  && Number.isFinite(Date.parse(value + 'T00:00:00.000Z')) && new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value;
const won = value => value.toLocaleString('ko-KR') + '원';
const https = value => { try { const url = new URL(value); return typeof value === 'string' && url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
const check = (status, reason, extra = {}) => ({ status, label: REAL_CONDITION_LABELS[status], reason, ...extra });
function invalid(field, message) { const error = new TypeError(message); error.field = field; throw error; }
function catalogMap(catalog) {
  if (!Array.isArray(catalog) || catalog.some(place => !plain(place) || typeof place.id !== 'string' || !place.id || ['__proto__', 'prototype', 'constructor'].includes(place.id))
    || new Set(catalog.map(place => place.id)).size !== catalog.length) invalid('catalog', '장소 자료를 확인해 주세요.');
  return new Map(catalog.map(place => [place.id, place]));
}
function clock(now) {
  const at = now ?? new Date().toISOString();
  // Keep the existing condition clock contract, even for incomplete drafts.
  evaluateRealConditions(null, {}, { now: at });
  return at;
}
export function normalizeRealCourse(input, { catalog = REAL_PLACES } = {}) {
  if (!keys(input, ['date', 'startTime', 'totalBudget', 'stops', 'transfers'])) invalid('course', '반나절 일정 입력을 확인해 주세요.');
  let query;
  try { query = normalizeRealQuery({ date: input.date ?? '', time: input.startTime ?? '', budget: input.totalBudget ?? null }); }
  catch (error) { if (error.field === 'time') error.field = 'startTime'; if (error.field === 'budget') invalid('totalBudget', '표시 비용 예산은 0~1,000,000원 정수로 입력해 주세요.'); throw error; }
  if (input.date === null) invalid('date', '날짜는 빈 값 또는 YYYY-MM-DD로 입력해 주세요.');
  if (input.startTime === null) invalid('startTime', '시작 시각은 빈 값 또는 HH:mm으로 입력해 주세요.');
  const places = catalogMap(catalog);
  if (!Array.isArray(input.stops) || input.stops.length < 2 || input.stops.length > 3) invalid('stops', '숙박을 제외한 장소 2~3곳을 골라 주세요.');
  const seen = new Set();
  const stops = Array.from(input.stops).map((stop, index) => {
    if (!keys(stop, ['placeId', 'stayMinutes', 'useOffering'])) invalid(`stops.${index}.placeId`, '일정 장소 입력을 확인해 주세요.');
    const place = places.get(stop.placeId);
    if (!place || !['food', 'tea', 'culture'].includes(place.category) || seen.has(stop.placeId)) invalid(`stops.${index}.placeId`, '숙박을 제외한 서로 다른 장소를 골라 주세요.');
    seen.add(stop.placeId);
    const stayMinutes = stop.stayMinutes === undefined ? null : stop.stayMinutes;
    if (stayMinutes !== null && (!Number.isSafeInteger(stayMinutes) || stayMinutes < 10 || stayMinutes > 180)) invalid(`stops.${index}.stayMinutes`, '체류는 10~180분 정수로 입력해 주세요.');
    const useOffering = stop.useOffering === undefined ? false : stop.useOffering;
    if (typeof useOffering !== 'boolean' || useOffering && place.category === 'culture') invalid(`stops.${index}.useOffering`, '먹거리 표시 메뉴 포함 여부를 확인해 주세요.');
    return { placeId: stop.placeId, stayMinutes, useOffering };
  });
  if (!Array.isArray(input.transfers) || input.transfers.length !== stops.length - 1) invalid('transfers', '장소 사이마다 이동 여유를 입력해 주세요.');
  const transfers = Array.from(input.transfers).map((value, index) => {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 180)) invalid(`transfers.${index}`, '이동 여유는 0~180분 정수 또는 빈 값으로 입력해 주세요.');
    return value === 0 ? 0 : value;
  });
  return { date: query.date, startTime: query.time, totalBudget: query.budget, stops, transfers };
}
export function createRealCourseFromSelection(ids, { catalog = REAL_PLACES } = {}) {
  const places = catalogMap(catalog);
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !places.has(id))) invalid('selection', '담은 장소 목록을 확인해 주세요.');
  const chosen = ids.filter(id => places.get(id).category !== 'stay');
  if (chosen.length < 2 || chosen.length > 3) invalid('selection', '숙박을 제외하고 2~3곳을 담아 주세요. 4곳 이상은 자동으로 고르지 않아요.');
  return normalizeRealCourse({ date: '', startTime: '', totalBudget: null,
    stops: chosen.map(placeId => ({ placeId, stayMinutes: null, useOffering: false })), transfers: chosen.slice(1).map(() => null) }, { catalog });
}
export function createRealCourseExample() {
  return normalizeRealCourse({ date: '', startTime: '11:30', totalBudget: null,
    stops: [
      { placeId: 'gaeseong-mandu-koong', stayMinutes: 60, useOffering: true },
      { placeId: 'seoul-museum-craft-art', stayMinutes: 75, useOffering: false },
      { placeId: 'osulloc-bukchon', stayMinutes: 45, useOffering: false },
    ], transfers: [15, 15] });
}
const costUnknown = (reason, sourceUrl) => ({ ...check('unknown', reason, sourceUrl ? { sourceUrl } : {}), amount: null });
function displayedCost(place, stop, date, { now, calendar, offerings }) {
  const offering = plain(offerings) && Object.hasOwn(offerings, place.id) ? offerings[place.id] : null;
  if (stop.useOffering) {
    if (!plain(offering) || offering.kind !== 'sample' || offering.unit !== 'menu-item' || offering.currency !== 'KRW'
      || typeof offering.label !== 'string' || !offering.label.trim() || !Number.isSafeInteger(offering.amount) || offering.amount < 0
      || !['included', 'not-stated'].includes(offering.taxStatus)) return costUnknown('합계에 넣을 공식 표시 메뉴를 확인해 주세요.');
    if ((offering.validFrom !== undefined && (!validDate(offering.validFrom) || !date || date < offering.validFrom))
      || (offering.validThrough !== undefined && (!validDate(offering.validThrough) || !date || date > offering.validThrough))) return costUnknown('이 날짜에 해당 메뉴를 제공하는지 확인해 주세요.');
    // Reuse source/date/amount validation. The selected item is not a venue minimum.
    const verified = evaluateRealConditions({ category: place.category, conditions: { price: {
      kind: 'exact', amount: offering.amount, label: offering.label, scope: 'adult-one', taxStatus: offering.taxStatus,
      sourceUrl: offering.sourceUrl, verifiedAt: offering.verifiedAt,
    } } }, { date, budget: 1000000 }, { now, calendar }).checks.budget;
    if (!['matched', 'unmatched'].includes(verified.status)) return costUnknown(verified.reason, verified.sourceUrl ?? (https(offering.sourceUrl) ? offering.sourceUrl : undefined));
    return { ...check('matched', `${offering.label} 한 항목의 표시금액을 넣었어요. 매장 최소 비용이나 식사 전체 비용은 아니에요. ${offering.availabilityNote ?? ''}`.trim(), { sourceUrl: offering.sourceUrl }),
      amount: offering.amount, itemLabel: offering.label, basis: 'selected-offering' };
  }
  const verified = evaluateRealConditions(place, { date, budget: 1000000 }, { now, calendar }).checks.budget;
  if (!['matched', 'unmatched'].includes(verified.status)) return costUnknown(verified.reason, verified.sourceUrl ?? (https(place.conditions?.price?.sourceUrl) ? place.conditions.price.sourceUrl : undefined));
  const base = place.conditions?.price;
  const price = { ...base, ...(date && base?.exceptions?.[date] || {}) };
  if (price.scope !== 'adult-one' || !['free', 'exact'].includes(price.kind)) return costUnknown('먹거리 비용은 미확인이에요. 공식 표시 메뉴를 직접 포함한 경우에만 합계에 넣어요.', verified.sourceUrl);
  const amount = price.kind === 'free' ? 0 : price.amount;
  if (!Number.isSafeInteger(amount) || amount < 0) return costUnknown('성인 1명 일반 관람 표시금액을 확인해 주세요.', verified.sourceUrl);
  return { ...check('matched', `${price.label} 성인 1명 ${amount === 0 ? '무료' : won(amount)} 안내 기준이에요. 추가 이용은 제외해요.`, { sourceUrl: verified.sourceUrl }),
    amount, itemLabel: price.label, basis: 'adult-admission' };
}
export function evaluateRealCourse(input, { now, calendar = REAL_CONDITION_CALENDAR, catalog = REAL_PLACES, offerings = REAL_COURSE_OFFERINGS } = {}) {
  const course = normalizeRealCourse(input, { catalog }), at = clock(now), places = catalogMap(catalog);
  const incompleteFields = [], warnings = ['이동 여유는 사용자가 넣은 값이며 실제 도보·교통 소요시간이 아니에요. 지도에서 경로와 이동시간을 확인해 주세요.', '표시 비용은 성인 1명의 일반 관람과 선택한 메뉴 항목만 합산해요. 교통·추가 주문·세금 차이 등 전체 여행비를 보장하지 않아요.'];
  if (!course.date) incompleteFields.push('date');
  if (!course.startTime) incompleteFields.push('startTime');
  if (course.totalBudget === null) incompleteFields.push('totalBudget');
  let cursor = course.startTime ? minute(course.startTime) : null, crossedMidnight = false;
  const stops = course.stops.map((stop, index) => {
    const place = places.get(stop.placeId), arrival = cursor;
    if (stop.stayMinutes === null) incompleteFields.push(`stops.${index}.stayMinutes`);
    let departure = arrival !== null && stop.stayMinutes !== null ? arrival + stop.stayMinutes : null;
    const overflow = departure !== null && departure > 1440;
    if (overflow) { crossedMidnight = true; departure = null; }
    const arrivalTime = time(arrival), departureTime = time(departure);
    let schedule = evaluateRealStay(place, { date: course.date, time: arrivalTime ?? '', stayMinutes: stop.stayMinutes }, { now: at, calendar });
    if (overflow && schedule.status !== 'unmatched') schedule = check('unknown', '체류가 자정을 넘어 당일 코스로 계산하지 않았어요.', schedule.sourceUrl ? { sourceUrl: schedule.sourceUrl } : {});
    if (crossedMidnight && arrival === null) schedule = check('unknown', '앞 구간이 자정을 넘어 이 장소의 방문 날짜·시각을 연결하지 않았어요. 다음 날 운영을 추정하지 않아요.');
    const operatingSource = schedule.sourceUrl ?? place.conditions?.hours?.sourceUrl ?? place.visitSourceUrl;
    if (https(operatingSource)) schedule = { ...schedule, sourceUrl: operatingSource };
    const cost = crossedMidnight && arrival === null
      ? costUnknown('앞 구간이 자정을 넘어 방문 날짜가 미정이에요. 원래 날짜의 요금을 적용하지 않았어요.')
      : displayedCost(place, stop, course.date, { now: at, calendar, offerings });
    cursor = departure;
    if (index < course.transfers.length) {
      const transfer = course.transfers[index];
      if (transfer === null) incompleteFields.push(`transfers.${index}`);
      cursor = cursor !== null && transfer !== null ? cursor + transfer : null;
      if (cursor !== null && cursor >= 1440) { cursor = null; crossedMidnight = true; }
    }
    return { place, arrivalTime, departureTime, schedule, cost };
  });
  if (crossedMidnight) warnings.push('자정을 넘는 구간 이후는 도착·종료 미정이에요. 이 도구는 출발일 안의 일정만 비교해요.');
  const knownSubtotal = stops.reduce((sum, stop) => sum + (stop.cost.amount ?? 0), 0);
  const unknownCostIds = stops.filter(stop => stop.cost.amount === null).map(stop => stop.place.id);
  const budget = course.totalBudget === null ? check('none', '표시 비용 예산을 입력하면 알려진 항목 합계와 비교해요.')
    : knownSubtotal > course.totalBudget ? check('unmatched', `알려진 표시 비용 ${won(knownSubtotal)}만으로 표시 비용 예산 ${won(course.totalBudget)}을 넘어요.`)
    : unknownCostIds.length ? check('unknown', `알려진 표시 비용은 ${won(knownSubtotal)}이며 ${unknownCostIds.length}곳의 비용이 미확인이어서 표시 비용 예산 안이라고 확정할 수 없어요.`)
    : check('matched', `포함한 표시 비용 ${won(knownSubtotal)}은 표시 비용 예산 ${won(course.totalBudget)} 안이에요. 교통·추가 주문 등은 별도예요.`);
  return { course, stops, endTime: stops.at(-1).departureTime, knownSubtotal, unknownCostIds, budget, incompleteFields, warnings };
}
export function replaceRealCourseStop(input, index, placeId, { catalog = REAL_PLACES, useOffering = false } = {}) {
  const course = normalizeRealCourse(input, { catalog }), places = catalogMap(catalog);
  if (!Number.isInteger(index) || index < 0 || index >= course.stops.length) invalid('index', '교체할 순서를 확인해 주세요.');
  if (places.get(placeId)?.category !== places.get(course.stops[index].placeId).category) invalid(`stops.${index}.placeId`, '같은 분야의 대안 장소를 골라 주세요.');
  if (course.stops.some((stop, position) => position !== index && stop.placeId === placeId)) invalid(`stops.${index}.placeId`, '이미 일정에 있는 장소와 중복되지 않게 골라 주세요.');
  if (placeId !== course.stops[index].placeId) {
    if (index > 0) course.transfers[index - 1] = null;
    if (index < course.transfers.length) course.transfers[index] = null;
  }
  course.stops[index] = { ...course.stops[index], placeId, useOffering };
  return normalizeRealCourse(course, { catalog });
}
export function suggestRealCourseAlternatives(input, index, options = {}) {
  const { now, calendar = REAL_CONDITION_CALENDAR, catalog = REAL_PLACES, offerings = REAL_COURSE_OFFERINGS, state = {} } = options;
  const at = clock(now), settings = { now: at, calendar, catalog, offerings }, current = evaluateRealCourse(input, settings);
  if (!Number.isInteger(index) || index < 0 || index >= current.stops.length) invalid('index', '대안을 볼 순서를 확인해 주세요.');
  const row = current.stops[index], chosen = new Set(current.course.stops.map(stop => stop.placeId));
  if (row.schedule.status !== 'unmatched' && current.budget.status !== 'unmatched') return [];
  // Reuse Core's existing declared-opinion order. Unknown fixture IDs keep catalog order.
  const ranked = rankRealPlaces({ ...state, interests: [row.place.category] }, { now: at });
  const priority = new Map(ranked.map((item, order) => [item.place.id, order]));
  return catalog.filter(place => place.category === row.place.category && !chosen.has(place.id))
    .map((place, order) => {
      const useOffering = current.course.stops[index].useOffering && plain(offerings) && Object.hasOwn(offerings, place.id);
      const course = replaceRealCourseStop(current.course, index, place.id, { catalog, useOffering });
      const evaluation = evaluateRealCourse(course, settings), candidate = evaluation.stops[index];
      const schedule = evaluateRealStay(place, { date: current.course.date, time: row.arrivalTime ?? '', stayMinutes: current.course.stops[index].stayMinutes }, { now: at, calendar });
      if (schedule.status !== 'matched') return null;
      if (current.budget.status === 'unmatched' && (candidate.cost.amount === null || evaluation.knownSubtotal >= current.knownSubtotal || evaluation.budget.status === 'unmatched')) return null;
      return { place, course, evaluation, schedule, cost: candidate.cost,
        reasons: [schedule.reason, candidate.cost.amount === null ? '대안 장소의 표시 비용은 미확인이에요.' : `대안 장소의 표시 비용은 ${won(candidate.cost.amount)}이에요.`, evaluation.budget.reason, '기존 도착 시각을 가정한 비교예요. 교체 후 바뀐 구간의 이동 여유를 다시 입력하고 전체 일정을 비교해 주세요.'], order };
    }).filter(Boolean).sort((a, b) => (priority.get(a.place.id) ?? ranked.length + a.order) - (priority.get(b.place.id) ?? ranked.length + b.order))
    .map(({ order, ...row }) => row);
}
export function exportRealCourseMemo(input, options = {}) {
  const at = clock(options.now), result = evaluateRealCourse(input, { ...options, now: at });
  const { course } = result;
  const koreaTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));
  return [
    'SYNK PATH · 직접 조정한 종로 반나절 일정', `메모 만든 시각 (한국): ${koreaTime}`,
    `방문 날짜: ${course.date || '미정'} · 시작: ${course.startTime || '미정'} · 종료: ${result.endTime || '미정'} (서울 시간)`,
    `표시 비용 예산: ${course.totalBudget === null ? '미정' : won(course.totalBudget)} · 알려진 표시 비용: ${won(result.knownSubtotal)} · 비용 미확인: ${result.unknownCostIds.length}곳`,
    `예산 비교: ${result.budget.label} — ${result.budget.reason}`, ...result.warnings,
    '체류와 이동 여유는 편집한 계획값입니다. 실측 동선·예약·입장·실시간 운영이나 일정 전체의 실행 가능성을 보장하지 않습니다.',
    '현재 탭의 일정만 내보냈으며 기존 담은 목록과 개인 취향 기록은 변경하지 않았습니다.', '',
    ...result.stops.flatMap((row, index) => [
      `${index + 1}. ${row.place.name}`, `도착 ${row.arrivalTime || '미정'} → 종료 ${row.departureTime || '미정'} · 체류 ${course.stops[index].stayMinutes === null ? '미정' : course.stops[index].stayMinutes + '분'}`,
      `운영 비교: ${row.schedule.label} — ${row.schedule.reason}`,
      `비용: ${row.cost.amount === null ? '미확인' : won(row.cost.amount)} — ${row.cost.reason}`,
      ...(row.schedule.sourceUrl ? [`운영 공식 출처: ${row.schedule.sourceUrl}`] : []),
      ...(row.cost.sourceUrl ? [`가격 공식 출처: ${row.cost.sourceUrl}`] : []),
      `주소: ${row.place.address || '공식 안내 확인'}`, `지도 검색: ${mapLink(row.place)}`,
      ...(index < course.transfers.length ? [`다음 장소까지 입력한 이동 여유: ${course.transfers[index] === null ? '미정' : course.transfers[index] + '분'} (실측 이동시간 아님)`] : []), '',
    ]),
  ].join('\n');
}
