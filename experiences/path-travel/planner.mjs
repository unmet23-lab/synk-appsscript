import { TRAVEL_PLACES } from './places-v2.mjs';
import { REAL_CONDITION_CALENDAR } from './real-places.mjs';
import { evaluateRealConditions, evaluateRealStay } from './real-conditions.mjs';
import * as DomainModule from '../../atlas/domain.js';
import * as TravelModule from '../../atlas/travel.js';
import * as AskModule from '../../atlas/ask.js';

const Domain = DomainModule.default ?? globalThis.SynkAtlasDomain;
const Travel = TravelModule.default ?? globalThis.SynkAtlasTravel;
const Ask = AskModule.default ?? globalThis.SynkAsk;
export const PLANNER_VERSION = 'path-real-planner-4';
export const SEMANTIC_KEYS = Object.freeze(['indoor', 'outdoor', 'food', 'tea', 'culture', 'history', 'art', 'walk', 'quiet', 'vegetarian', 'stepFree', 'noodles', 'dumplings', 'soup', 'templeFood', 'marketFood', 'coffee', 'bakery', 'traditionalTea']);
export const PREFERENCE_LABELS = Object.freeze({ indoor: '실내', outdoor: '야외', food: '식사', tea: '차와 카페', culture: '문화 관람', history: '역사', art: '미술·공예', walk: '산책', quiet: '조용한 곳', vegetarian: '채식', stepFree: '계단 없는 접근', noodles: '면 요리', dumplings: '만두', soup: '국물 요리', templeFood: '사찰 음식', marketFood: '시장 음식', coffee: '커피', bakery: '베이커리', traditionalTea: '전통차' });
export const DETAIL_PREFERENCE_CATEGORIES = Object.freeze({ noodles: 'food', dumplings: 'food', soup: 'food', templeFood: 'food', marketFood: 'food', coffee: 'tea', bakery: 'tea', traditionalTea: 'tea' });
const CATEGORIES = ['food', 'tea', 'culture'];
const BEAM_WIDTH = 160;
const DAY = 86400000;
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
  && Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key));
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
const integer = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
const timeValid = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const time = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000')
  && Number.isFinite(Date.parse(value + 'T00:00:00.000Z')) && new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value;
function fail(field, message) { const error = new TypeError(message); error.field = field; throw error; }
function boolMap(value, field) {
  if (!plain(value) || Object.entries(value).some(([key, entry]) => !SEMANTIC_KEYS.includes(key) || typeof entry !== 'boolean')) fail(field, '취향과 필수 조건을 확인해 주세요.');
  return Object.fromEntries(SEMANTIC_KEYS.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
}
function normalizeCompanions(value, partySize = 6) {
  if (!Array.isArray(value) || value.length > 6 || value.length > partySize) fail('companions', '동행 취향은 일행 수 안에서 최대 6명까지 입력해 주세요.');
  const result = value.map(row => {
    if (!plain(row) || Object.keys(row).length !== 4 || Object.keys(row).some(key => !['id', 'label', 'preferences', 'requiredFeatures'].includes(key))
      || !token(row.id) || typeof row.label !== 'string' || !row.label.trim() || row.label.trim().length > 24) fail('companions', '동행의 별칭은 1~24자로 입력하고 취향·필수 조건을 확인해 주세요.');
    const preferences = boolMap(row.preferences, 'companions'), requiredFeatures = boolMap(row.requiredFeatures, 'companions');
    if (!Object.keys(preferences).length && !Object.keys(requiredFeatures).length) fail('companions', `${row.label.trim()}의 취향이나 필수 조건을 한 가지 이상 골라 주세요.`);
    return { id: row.id, label: row.label.trim(), preferences, requiredFeatures };
  });
  if (new Set(result.map(row => row.id)).size !== result.length) fail('companions', '같은 동행의 취향을 두 번 넣을 수 없어요.');
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
function combinedRequiredFeatures(requiredFeatures, companions) {
  const combined = { ...requiredFeatures }, owners = new Map(Object.keys(requiredFeatures).map(key => [key, '공통 필수 조건']));
  for (const person of companions) for (const [key, value] of Object.entries(person.requiredFeatures)) {
    if (Object.hasOwn(combined, key) && combined[key] !== value) fail('companions', `${owners.get(key)}과 ${person.label}의 ${PREFERENCE_LABELS[key]} 필수 조건이 서로 반대예요. 직접 조정해 주세요.`);
    combined[key] = value;
    owners.set(key, owners.has(key) ? `${owners.get(key)}·${person.label}` : person.label);
  }
  return combined;
}
function ids(value, field) {
  if (!Array.isArray(value) || value.length > 80 || value.some(id => !token(id)) || new Set(value).size !== value.length) fail(field, '장소 목록을 확인해 주세요.');
  return [...value];
}
function point(value, field) {
  if (!plain(value) || !Number.isFinite(value.lat) || !Number.isFinite(value.lon) || Math.abs(value.lat) > 90 || Math.abs(value.lon) > 180) fail(field, '출발점의 위치를 확인해 주세요.');
  return { lat: value.lat, lon: value.lon };
}
function namedPoint(value, field) {
  if (!plain(value) || !token(value.id) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 160) fail(field, field === 'destination' ? '마지막 도착지를 골라 주세요.' : '출발점을 골라 주세요.');
  return { id: value.id, name: value.name, ...point(value, field) };
}
export function normalizePlannerInput(value, { places } = {}) {
  if (!plain(value)) fail('input', '여행 조건을 입력해 주세요.');
  if (!dateValid(value.date)) fail('date', '방문 날짜를 입력해 주세요.');
  if (!timeValid(value.startTime) || !timeValid(value.endTime) || minutes(value.endTime) <= minutes(value.startTime)) fail('endTime', '같은 날의 시작·종료 시간을 확인해 주세요.');
  const origin = namedPoint(value.origin, 'origin');
  const destination = value.destination == null ? null : namedPoint(value.destination, 'destination');
  if (!plain(value.party) || !integer(value.party.adults, 1, 20) || !integer(value.party.children, 0, 20)) fail('party', '성인 1~20명, 아이 0~20명으로 입력해 주세요.');
  if (!integer(value.budget, 0, 10000000)) fail('budget', '일행의 표시 비용 예산을 0~1천만 원으로 입력해 주세요.');
  if (!integer(value.maxWalkMinutes, 0, 360)) fail('maxWalkMinutes', '장소 사이 걷기 상한을 0~360분으로 입력해 주세요.');
  const maxLegWalkMinutes = value.maxLegWalkMinutes ?? null, restEveryMinutes = value.restEveryMinutes ?? null, restDurationMinutes = value.restDurationMinutes === undefined ? 10 : value.restDurationMinutes;
  if (maxLegWalkMinutes !== null && !integer(maxLegWalkMinutes, 0, 360)) fail('maxLegWalkMinutes', '한 번에 걷는 상한은 0~360분으로 입력해 주세요.');
  if (restEveryMinutes !== null && !integer(restEveryMinutes, 30, 180)) fail('restEveryMinutes', '쉬는 여유를 넣을 간격은 30~180분으로 입력해 주세요.');
  if (!integer(restDurationMinutes, 5, 30)) fail('restDurationMinutes', '한 번 쉬는 시간은 5~30분으로 입력해 주세요.');
  const planningMode = value.planningMode === undefined ? 'day' : value.planningMode;
  if (!['day', 'remaining'].includes(planningMode)) fail('planningMode', '하루 일정 또는 남은 일정 중 계획 범위를 확인해 주세요.');
  const minimumStops = planningMode === 'remaining' ? 1 : 2, stopCount = value.stopCount ?? 3;
  if (!integer(stopCount, minimumStops, 5)) fail('stopCount', `희망 방문 수는 ${minimumStops}~5곳으로 골라 주세요.`);
  const preferences = boolMap(value.preferences ?? {}, 'preferences');
  const requiredFeatures = boolMap(value.requiredFeatures ?? {}, 'requiredFeatures');
  const companions = normalizeCompanions(value.companions === undefined ? [] : value.companions, value.party.adults + value.party.children);
  combinedRequiredFeatures(requiredFeatures, companions);
  const requiredCategories = value.requiredCategories ?? [];
  if (!Array.isArray(requiredCategories) || new Set(requiredCategories).size !== requiredCategories.length || requiredCategories.some(category => !CATEGORIES.includes(category))) fail('requiredCategories', '꼭 포함할 분야를 확인해 주세요.');
  const lockedIds = ids(value.lockedIds ?? [], 'lockedIds'), excludedIds = ids(value.excludedIds ?? [], 'excludedIds');
  if (lockedIds.some(id => excludedIds.includes(id))) fail('lockedIds', '같은 장소를 유지하면서 제외할 수는 없어요.');
  const rawMeal = value.meal === undefined ? { mode: 'any', startTime: '12:00', endTime: '13:00' } : value.meal;
  if (!plain(rawMeal) || !['any', 'none', 'window'].includes(rawMeal.mode)) fail('meal', '식사 없음·시간 자유·식사 시작 시간대 중 골라 주세요.');
  const meal = { mode: rawMeal.mode, startTime: rawMeal.startTime ?? '12:00', endTime: rawMeal.endTime ?? '13:00' };
  if (!timeValid(meal.startTime) || !timeValid(meal.endTime) || meal.startTime > meal.endTime) fail('meal', '같은 날의 식사 시작 허용 시간대를 확인해 주세요.');
  const rawAppointments = value.appointments === undefined ? [] : value.appointments;
  if (!Array.isArray(rawAppointments) || rawAppointments.length > 3 || rawAppointments.some(row => !plain(row) || !token(row.placeId) || !timeValid(row.time))) fail('appointments', '예약 장소와 정확한 시각을 최대 3개까지 입력해 주세요.');
  const appointments = rawAppointments.map(row => ({ placeId: row.placeId, time: row.time })).sort((a, b) => a.time.localeCompare(b.time) || a.placeId.localeCompare(b.placeId));
  if (new Set(appointments.map(row => row.placeId)).size !== appointments.length) fail('appointments', '같은 장소를 두 번 예약 일정에 넣을 수 없어요.');
  if (new Set(appointments.map(row => row.time)).size !== appointments.length) fail('appointments', '서로 다른 두 장소에 같은 시각으로 예약할 수 없어요.');
  if (appointments.some(row => row.time < value.startTime || row.time >= value.endTime)) fail('appointments', '예약 시각은 여행 시작 이후, 여행 종료 이전이어야 해요.');
  if (appointments.some(row => excludedIds.includes(row.placeId))) fail('appointments', '예약한 장소를 동시에 제외할 수는 없어요. 예약이나 제외를 직접 바꿔 주세요.');
  if (new Set([...lockedIds, ...appointments.map(row => row.placeId)]).size > stopCount) fail('appointments', '예약과 유지한 장소 수가 희망 방문 수보다 많아요. 방문 수를 늘리거나 직접 설정을 바꿔 주세요.');
  if (meal.mode === 'none' && requiredCategories.includes('food')) fail('meal', '식사를 생략하면서 식사 필수 포함을 동시에 선택할 수 없어요.');
  const catalogue = places ?? TRAVEL_PLACES, byId = new Map(catalogue.map(place => [place.id, place]));
  if (appointments.some(row => !byId.has(row.placeId) || byId.get(row.placeId).dayPlannerEligible === false || !CATEGORIES.includes(byId.get(row.placeId).category))) fail('appointments', '예약은 현재 당일 여행 장소 중에서 골라 주세요.');
  if (meal.mode === 'none' && [...lockedIds, ...appointments.map(row => row.placeId)].some(id => byId.get(id)?.category === 'food')) fail('meal', '식사를 생략하면서 식당 예약·유지를 함께 선택할 수 없어요.');
  if (meal.mode === 'window' && appointments.some(row => byId.get(row.placeId).category === 'food' && (row.time < meal.startTime || row.time > meal.endTime))) fail('meal', '식당 예약 시각이 정한 식사 시작 시간대 밖이에요. 둘 중 하나를 직접 조정해 주세요.');
  if (places) {
    const allowed = new Set(places.map(place => place.id));
    if ([...lockedIds, ...excludedIds].some(id => !allowed.has(id))) fail('lockedIds', '현재 장소 목록에 없는 곳이 있어요.');
  }
  return { date: value.date, startTime: value.startTime, endTime: value.endTime, origin, destination, appointments, meal,
    party: { adults: value.party.adults, children: value.party.children }, budget: value.budget, maxWalkMinutes: value.maxWalkMinutes,
    maxLegWalkMinutes, restEveryMinutes, restDurationMinutes,
    planningMode, stopCount, preferences, requiredFeatures, companions, requiredCategories: [...requiredCategories], lockedIds, excludedIds };
}
const check = (kind, status, reason, extra = {}) => ({ kind, status, reason, ...extra });
function clock(now) {
  const at = now ?? new Date().toISOString();
  if (typeof at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at) || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) fail('now', '검사 시각을 확인해 주세요.');
  return at;
}
function fingerprint(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let a = 2166136261, b = 5381;
  for (const char of text) { a = Math.imul(a ^ char.charCodeAt(0), 16777619) >>> 0; b = ((b * 33) ^ char.charCodeAt(0)) >>> 0; }
  return `${a.toString(36)}-${b.toString(36)}`;
}
/** Bind an itinerary to its normalized trip inputs, including its date.
 * This consistency marker is not a signature or an authorization token. */
export function plannerInputFingerprint(value) { return fingerprint(normalizePlannerInput(value)); }

/** Only the two recorded pre-companion v4 input shapes are accepted as archives.
 * Missing features must retain neutral defaults; they cannot hide active inputs.
 * Source shapes: qa/redesign-20261009/past-trip-test.json and
 * qa/schedule-20261009/browser-export.json. No old feasibility is rerun here. */
export function matchesPlannerInputFingerprint(value, expected) {
  const input = normalizePlannerInput(value);
  if (expected === fingerprint(input)) return true;
  if (input.companions.length) return false;
  const schedule = { ...input }; delete schedule.companions;
  if (expected === fingerprint(schedule)) return true;
  if (input.destination !== null || input.appointments.length || input.meal.mode !== 'any'
    || input.meal.startTime !== '12:00' || input.meal.endTime !== '13:00'
    || input.maxLegWalkMinutes !== null || input.restEveryMinutes !== null
    || input.restDurationMinutes !== 10 || input.planningMode !== 'day') return false;
  const early = { ...schedule };
  for (const key of ['destination', 'appointments', 'meal', 'maxLegWalkMinutes', 'restEveryMinutes', 'restDurationMinutes', 'planningMode']) delete early[key];
  return expected === fingerprint(early);
}
function distance(a, b) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function estimateWalkingLeg(from, to, { routeLeg, stepFree = false } = {}) {
  const a = point(from.coordinates ?? from, 'origin'), b = point(to.coordinates ?? to, 'place');
  const supplied = routeLeg?.({ ...from, ...a }, { ...to, ...b }, { stepFree });
  if (supplied != null) {
    if (!plain(supplied) || !Number.isFinite(supplied.distanceMeters) || supplied.distanceMeters < 0
      || !integer(supplied.minMinutes, 0, 1440) || !integer(supplied.maxMinutes, supplied.minMinutes, 1440)
      || typeof supplied.source !== 'string' || !Array.isArray(supplied.coordinates) || supplied.coordinates.length < 2
      || supplied.coordinates.some(row => !Array.isArray(row) || row.length !== 2 || !Number.isFinite(row[0]) || Math.abs(row[0]) > 180 || !Number.isFinite(row[1]) || Math.abs(row[1]) > 90)) fail('routeLeg', '지도 경로 계산 결과를 확인해 주세요.');
    return { ...clone(supplied), fromId: from.id, toId: to.id, estimated: true,
      label: '지도 길망으로 계산한 예상 도보 범위 · 신호·공사·경사·현장 접근성은 별도 확인' };
  }
  const direct = distance(a, b);
  return { fromId: from.id, toId: to.id, distanceMeters: Math.round(direct), minMinutes: direct < 1 ? 0 : Math.max(1, Math.ceil(direct * 1.15 / 75)),
    maxMinutes: direct < 1 ? 0 : Math.max(1, Math.ceil(direct * 1.65 / 50)), coordinates: [[a.lon, a.lat], [b.lon, b.lat]],
    source: 'coordinate-distance-estimate', estimated: true,
    label: '직선거리 기반 추정 · 실제 길이 아님',
    assumptions: '직선거리의 1.15~1.65배, 분당 50~75m라는 계획 가정. 도로 연결·계단·횡단 가능 여부는 미확인.' };
}
function semanticFeature(place, key) {
  // Categories describe a planned stop's role, not unverified menu or venue qualities.
  if (CATEGORIES.includes(key)) return place.category === key;
  return typeof place.features?.[key] === 'boolean' ? place.features[key] : null;
}
function relevantStops(stops, key) {
  const category = DETAIL_PREFERENCE_CATEGORIES[key] ?? (key === 'vegetarian' ? 'food' : null);
  return category ? stops.filter(stop => stop.place.category === category) : stops;
}
function companionAssessment(stops, companions) {
  return companions.map(person => ({ id: person.id, label: person.label, preferences: Object.entries(person.preferences).map(([key, value]) => {
    const relevant = relevantStops(stops, key), matchedPlaceIds = [], unknownPlaceIds = [], conflictPlaceIds = [];
    for (const stop of relevant) {
      const feature = semanticFeature(stop.place, key);
      if (feature === null) unknownPlaceIds.push(stop.placeId);
      else if (feature === value) matchedPlaceIds.push(stop.placeId);
      else if (value === false) conflictPlaceIds.push(stop.placeId);
    }
    // Choosing no venue in the relevant field is an itinerary omission, not
    // evidence that an unknown menu/venue lacks the avoided characteristic.
    const status = value ? matchedPlaceIds.length ? 'reflected' : unknownPlaceIds.length ? 'unknown' : 'unmet'
      : conflictPlaceIds.length ? 'conflict' : unknownPlaceIds.length ? 'unknown' : 'reflected';
    return { key, value, status, matchedPlaceIds, unknownPlaceIds, conflictPlaceIds };
  }) }));
}
/** Explain each declared preference using venue evidence, not satisfaction odds.
 * An avoidance reflected with no matchedPlaceIds means that field was not visited.
 * Companion preferences are trip inputs; this function never creates memories. */
export function assessCompanionFit(stops, companions = []) {
  if (!Array.isArray(stops) || stops.length > 5 || stops.some(stop => !plain(stop) || !token(stop.placeId) || !plain(stop.place))) fail('stops', '동행 취향을 비교할 여행 장소를 확인해 주세요.');
  return companionAssessment(stops, normalizeCompanions(companions));
}
function companionUtility(stops, companions) {
  const values = companionAssessment(stops, companions).filter(person => person.preferences.length).map(person =>
    person.preferences.reduce((sum, row) => sum + Number(row.status === 'reflected') - Number(row.status === 'conflict'), 0) / person.preferences.length);
  return values.length ? { minimum: Math.min(...values), average: values.reduce((sum, value) => sum + value, 0) / values.length } : null;
}
function preferenceFeature(stops, key) {
  const values = relevantStops(stops, key).map(stop => semanticFeature(stop.place, key));
  if (!values.length) return null;
  if (Object.hasOwn(DETAIL_PREFERENCE_CATEGORIES, key)) {
    // Presence may be evidenced by one venue. Absence requires every relevant
    // venue to say false explicitly; null must never become a successful avoidance.
    if (values.includes(true)) return 1;
    return values.every(value => value === false) ? 0 : null;
  }
  if (values.some(value => value === null)) return null;
  return ['food', 'tea'].includes(key) ? Number(values.some(Boolean)) : values.reduce((n, value) => n + Number(value), 0) / values.length;
}
function walkingChecks(leg, placeId) {
  const reasons = [];
  if (leg.source === 'coordinate-distance-estimate') reasons.push('연결된 보행 길을 확인하지 못해 직선거리로 추정했어요. 실제 통행 가능한 경로를 확인해 주세요.');
  if (leg.unknownAccess === true) reasons.push('지도에 보행 접근 정보가 부족한 구간이 있어요. 보도·횡단·출입 가능 여부를 확인해 주세요.');
  if (Number.isFinite(leg.connectorMeters) && leg.connectorMeters > 0) reasons.push(`출발·도착 지점과 길망 사이 약 ${leg.connectorMeters}m 연결은 지도 추정이에요. 실제 출입구 동선은 확인이 필요해요.`);
  return reasons.length ? [check('route', 'unknown', reasons.join(' '), { placeId })] : [];
}
function requiredChecks(place, required) {
  return Object.entries(required).filter(([key]) => relevantStops([{ place }], key).length).map(([key, value]) => {
    const feature = semanticFeature(place, key);
    return check(`required.${key}`, feature === null ? 'unknown' : feature === value ? 'matched' : 'unmatched',
      feature === null ? `${PREFERENCE_LABELS[key]} 필수 조건을 확인할 자료가 없어요.` : feature === value ? `${PREFERENCE_LABELS[key]} 조건을 반영했어요.` : `${PREFERENCE_LABELS[key]} 필수 조건과 달라요.`, { placeId: place.id });
  });
}
function requiredPlaceChecks(place, required, companions) {
  return requiredChecks(place, required).map(row => {
    const owners = companions.filter(person => Object.hasOwn(person.requiredFeatures, row.kind.slice('required.'.length))).map(person => person.label);
    return owners.length ? { ...row, reason: `${owners.join('·')}의 필수 조건: ${row.reason}` } : row;
  });
}
function requiredWalkingCheck(leg, placeId, returning = false) {
  const matched = leg?.stepFreeVerified === true;
  return check(returning ? 'required.stepFree.return' : 'required.stepFree.route', matched ? 'matched' : 'unknown', matched
    ? '이동 경로의 무계단 조건을 확인했어요.'
    : returning ? '마지막 도착지까지의 계단·단차 정보가 확인되지 않아 제외했어요.'
      : '장소의 무계단 접근과 별개로 이동 경로의 계단·단차 정보가 확인되지 않아 제외했어요.', { placeId });
}
/** Reassess hard conditions against trusted current venue records and supplied
 * route evidence. Storage calls this after restoring canonical places. This
 * neither replans an archived date nor reevaluates its opening hours or prices. */
export function assessPlannerRequirements(stops, input, { legs = [], returnLeg = null } = {}) {
  if (!plain(input) || !Array.isArray(stops) || stops.length > 5 || stops.some(stop => !plain(stop) || !token(stop.placeId) || !plain(stop.place)) || !Array.isArray(legs)) fail('requirements', '필수 조건을 확인할 여행 장소와 이동 정보를 확인해 주세요.');
  const companions = normalizeCompanions(input.companions === undefined ? [] : input.companions);
  const required = combinedRequiredFeatures(boolMap(input.requiredFeatures ?? {}, 'requiredFeatures'), companions);
  const checks = stops.flatMap(stop => requiredPlaceChecks(stop.place, required, companions));
  if (required.stepFree === true) {
    stops.forEach((stop, index) => checks.push(requiredWalkingCheck(legs[index], stop.placeId)));
    if (input.destination) checks.push(requiredWalkingCheck(returnLeg, stops.at(-1)?.placeId, true));
  }
  return checks;
}
function partyCost(place, input, at, calendar) {
  const reviewed = evaluateRealConditions(place, { date: input.date, budget: 1000000 }, { now: at, calendar }).checks.budget;
  const original = place.conditions?.price;
  const price = { ...original, ...(original?.exceptions?.[input.date] ?? {}) };
  let knownAmount = 0;
  const items = [], unknowns = [];
  if (!['matched', 'unmatched'].includes(reviewed.status) || !['free', 'exact', 'sample'].includes(price.kind)) unknowns.push(reviewed.reason);
  else {
    const amount = price.kind === 'free' ? 0 : price.amount;
    if (!integer(amount, 0, 1000000)) unknowns.push('방문 비용의 금액을 확인해 주세요.');
    else {
      knownAmount += amount * input.party.adults;
      items.push({ label: price.label, quantity: input.party.adults, unitAmount: amount, amount: amount * input.party.adults,
        basis: price.kind === 'sample' || price.scope === 'menu-item' ? 'suggested-menu' : 'adult-admission', sourceUrl: price.sourceUrl });
      if (price.kind === 'sample' || price.scope === 'menu-item') unknowns.push(`성인마다 '${price.label}' 한 항목을 고르는 제안이에요. 다른 메뉴·추가 주문은 미확인이에요.`);
      if (price.taxStatus === 'not-stated' && amount > 0) unknowns.push('세금·추가 비용 포함 여부를 확인해 주세요.');
    }
  }
  if (input.party.children) {
    const child = place.conditions?.childPrice;
    const childResult = child ? evaluateRealConditions({ ...place, conditions: { price: { ...child, scope: 'adult-one' } } }, { date: input.date, budget: 1000000 }, { now: at, calendar }).checks.budget : null;
    // Without the children's ages, only an explicitly all-children rate applies.
    if (child?.allChildren === true && ['matched', 'unmatched'].includes(childResult?.status) && ['free', 'exact'].includes(child.kind)) {
      const unitAmount = child.kind === 'free' ? 0 : child.amount;
      knownAmount += unitAmount * input.party.children;
      items.push({ label: child.label, quantity: input.party.children, unitAmount, amount: unitAmount * input.party.children, basis: 'child-admission', sourceUrl: child.sourceUrl });
    } else unknowns.push(`아이 ${input.party.children}명의 연령별 관람·식사 비용은 확인되지 않았어요. 성인 요금으로 대신 계산하지 않았어요.`);
  }
  return { knownAmount, status: unknowns.length ? 'unknown' : 'matched', unknowns, items };
}
function sourceFor(place) {
  const date = [place.verifiedAt, place.checkedAt, place.conditions?.hours?.verifiedAt].find(dateValid) ?? '1970-01-01';
  return { kind: 'verified', checkedAt: date + 'T00:00:00.000Z', validUntil: new Date(Date.parse(date + 'T00:00:00.000Z') + 30 * DAY).toISOString() };
}
function effectivePreferences(input, feedback, at) {
  const selected = new Map();
  for (const row of Array.isArray(feedback) ? feedback : []) {
    if (!plain(row) || row.status !== 'confirmed' || row.source?.kind !== 'user-confirmation' || !SEMANTIC_KEYS.includes(row.key)
      || typeof row.value !== 'boolean' || typeof row.confirmedAt !== 'string' || !Number.isFinite(Date.parse(row.confirmedAt)) || Date.parse(row.confirmedAt) > Date.parse(at)) continue;
    const prior = selected.get(row.key);
    if (!prior || Date.parse(prior.at) < Date.parse(row.confirmedAt)) selected.set(row.key, { field: row.key, value: row.value,
      importance: integer(row.importance, 1, 5) ? row.importance : 3, at: row.confirmedAt, origin: 'confirmed-feedback', sourceId: token(row.id) ? row.id : `feedback-${row.key}` });
  }
  for (const [field, value] of Object.entries(input.preferences)) selected.set(field, { field, value, importance: 3, at, origin: 'this-trip', sourceId: `trip-${field}` });
  return SEMANTIC_KEYS.filter(key => selected.has(key)).map(key => selected.get(key));
}
const scope = Object.freeze({ domain: 'PATH', workspace: 'path-real-planner', subject: 'local-visitor' });
function policy(preferences) {
  return { id: 'path-real-semantic', version: '2', purpose: 'choose-real-route',
    fields: SEMANTIC_KEYS.map(id => ({ id, kind: 'number', range: [0, 1] })),
    criteria: preferences.map(row => ({ id: row.field, field: row.field, feature: row.field, weight: row.importance, prefer: 'match' })),
    objectives: [
      { id: 'short-walk', feature: 'walkRatio', range: [0, 1], weight: 0.65, prefer: 'lower' },
      { id: 'requested-stops', feature: 'stopRatio', range: [0, 1], weight: 0.8, prefer: 'higher' },
      { id: 'less-wait', feature: 'waitRatio', range: [0, 1], weight: 0.3, prefer: 'lower' },
      { id: 'known-details', feature: 'knownRatio', range: [0, 1], weight: 0.3, prefer: 'higher' },
      { id: 'avoid-repeated-meals', feature: 'repeatedMeals', range: [0, 1], weight: 1.4, prefer: 'lower' },
      { id: 'avoid-adjacent-meals', feature: 'adjacentMeals', range: [0, 1], weight: 1.2, prefer: 'lower' },
      ...preferences.filter(row => row.value === false && Object.hasOwn(DETAIL_PREFERENCE_CATEGORIES, row.field)).map(row => ({
        id: `avoid-known-${row.field}`, feature: `knownUnwanted-${row.field}`, range: [0, 1], weight: row.importance, prefer: 'lower',
      })),
    ] };
}
function routeFeatures(route, input, preferences) {
  const features = { walkRatio: Math.min(1, route.walking.maxMinutes / Math.max(1, input.maxWalkMinutes)), stopRatio: route.stops.length / input.stopCount,
    waitRatio: Math.min(1, route.stops.reduce((n, stop) => n + stop.waitMinutes, 0) / 120), knownRatio: route.checks.filter(row => row.status === 'matched').length / Math.max(1, route.checks.length),
    repeatedMeals: Math.min(1, Math.max(0, route.stops.filter(stop => stop.place.category === 'food').length - 1) / 2),
    adjacentMeals: Number(route.stops.some((stop, i) => i > 0 && stop.place.category === 'food' && route.stops[i - 1].place.category === 'food')) };
  for (const row of preferences) {
    const value = preferenceFeature(route.stops, row.field);
    if (value !== null) features[row.field] = value;
    if (row.value === false && Object.hasOwn(DETAIL_PREFERENCE_CATEGORIES, row.field)) {
      // This policy counts confirmed unwanted venues. Zero is an absence of
      // confirmed conflicts, never a claim that unknown menus exclude the food.
      features[`knownUnwanted-${row.field}`] = Number(relevantStops(route.stops, row.field).some(stop => semanticFeature(stop.place, row.field) === true));
    }
  }
  return features;
}
function rankRoutes(routes, input, preferences, at) {
  const contract = policy(preferences);
  const candidates = routes.map(route => ({ id: route.id, features: routeFeatures(route, input, preferences) }));
  const utilities = routes.map(route => companionUtility(route.stops, input.companions));
  if (utilities.some(Boolean)) {
    // Rank distinct utility levels, rather than guess a large constant weight.
    // One minimum level outweighs every average/base contribution; one average
    // level outweighs every base contribution. This is lexicographic only among
    // the bounded search's candidates, never a claim of global optimality.
    const levels = key => [...new Set(utilities.map(value => Number(value[key].toFixed(12))))].sort((a, b) => a - b);
    const minimum = levels('minimum'), average = levels('average');
    const baseWeight = [...contract.criteria, ...contract.objectives].reduce((sum, row) => sum + row.weight, 0);
    const averageWeight = (baseWeight + 1) * Math.max(1, average.length - 1);
    const minimumWeight = (baseWeight + averageWeight + 1) * Math.max(1, minimum.length - 1);
    contract.objectives.push(
      { id: 'companion-least-reflected', feature: 'companionMinimum', range: [0, 1], weight: minimumWeight, prefer: 'higher' },
      { id: 'companion-average-reflected', feature: 'companionAverage', range: [0, 1], weight: averageWeight, prefer: 'higher' });
    candidates.forEach((candidate, i) => {
      candidate.features.companionMinimum = minimum.indexOf(Number(utilities[i].minimum.toFixed(12))) / Math.max(1, minimum.length - 1);
      candidate.features.companionAverage = average.indexOf(Number(utilities[i].average.toFixed(12))) / Math.max(1, average.length - 1);
    });
  }
  return Domain.decide({ contract, scope, at,
    observations: preferences.map(row => ({ id: `preference-${row.field}`, field: row.field, value: Number(row.value), source: 'declared', at: row.at,
      until: '9999-12-31T23:59:59.999Z', scope, contract: { id: contract.id, version: contract.version, purpose: contract.purpose }, refs: [row.sourceId] })),
    candidates });
}
function chooseDiverse(ranked, byId, primary, used, mode) {
  const maxMeals = Math.max(1, primary.stops.filter(stop => stop.place.category === 'food').length);
  const candidates = ranked.filter(row => !used.has(row.id)).map(row => byId.get(row.id))
    .filter(route => route.stops.filter(stop => stop.place.category === 'food').length <= maxMeals);
  const primaryIds = new Set(primary.stops.map(stop => stop.placeId));
  const distinct = candidates.filter(route => route.stops.some(stop => !primaryIds.has(stop.placeId)) || route.stops.length !== primary.stops.length);
  const pool = distinct.length ? distinct : candidates;
  if (mode === 'walking') return pool.filter(route => route.walking.maxMinutes < primary.walking.maxMinutes).sort((a, b) => a.walking.maxMinutes - b.walking.maxMinutes || b.score - a.score)[0];
  if (mode === 'cost') return pool.filter(route => route.cost.status === 'matched' && (primary.cost.status !== 'matched' || route.cost.knownAmount < primary.cost.knownAmount)).sort((a, b) => a.cost.knownAmount - b.cost.knownAmount || b.score - a.score)[0];
  return pool[0];
}

function planStay(arrival, visitMinutes, activeSincePause, input) {
  const pauses = [];
  let elapsed = 0, remaining = visitMinutes, active = activeSincePause;
  while (remaining > 0) {
    const untilPause = input.restEveryMinutes === null ? remaining : Math.max(0, input.restEveryMinutes - active);
    const activity = Math.min(remaining, untilPause);
    elapsed += activity; active += activity; remaining -= activity;
    if (remaining > 0) {
      pauses.push({ startTime: time(arrival + elapsed), endTime: time(arrival + elapsed + input.restDurationMinutes),
        durationMinutes: input.restDurationMinutes, kind: 'planned-rest', locationStatus: 'unverified' });
      elapsed += input.restDurationMinutes; active = 0;
    }
  }
  return { duration: elapsed, pauses, activeSincePause: active };
}

function questionDecision(plan) {
  return plan ? { content: plan.stops.map(stop => stop.placeId),
    shape: [plan.stops.map(stop => [stop.arrivalTime, stop.departureTime]), plan.walking.minMinutes, plan.walking.maxMinutes, plan.cost.knownAmount, plan.cost.status] }
    : { content: null, shape: null };
}
function questionPreview(plan, before) {
  const ids = plan.stops.map(stop => stop.placeId), beforeIds = before.stops.map(stop => stop.placeId);
  return { planId: plan.id, status: plan.status, stops: plan.stops.map(stop => ({ placeId: stop.placeId, name: stop.place.name, arrivalTime: stop.arrivalTime, departureTime: stop.departureTime })),
    knownAmount: plan.cost.knownAmount, costStatus: plan.cost.status, walking: { minMinutes: plan.walking.minMinutes, maxMinutes: plan.walking.maxMinutes }, endTime: plan.endTime,
    changes: { addedIds: ids.filter(id => !beforeIds.includes(id)), removedIds: beforeIds.filter(id => !ids.includes(id)),
      knownAmountDelta: plan.cost.knownAmount - before.cost.knownAmount, walkMaxDelta: plan.walking.maxMinutes - before.walking.maxMinutes } };
}
function usefulQuestion({ primary, plans, input, preferences, eligible, at, settings }) {
  if (!primary || plans.length < 2) return null;
  const fields = [...Object.keys(DETAIL_PREFERENCE_CATEGORIES), 'art', 'history', 'indoor', 'food', 'tea', 'culture'];
  const questions = fields.filter(field => {
    if (preferences.some(row => row.field === field) || Object.hasOwn(input.requiredFeatures, field) || input.companions.some(person => Object.hasOwn(person.requiredFeatures, field))) return false;
    const category = DETAIL_PREFERENCE_CATEGORIES[field];
    if (category && !primary.stops.some(stop => stop.place.category === category) && !input.requiredCategories.includes(category) && input.preferences[category] !== true) return false;
    const values = relevantStops(eligible.map(place => ({ place })), field).map(stop => semanticFeature(stop.place, field));
    return values.includes(true) && values.some(value => value !== true);
  }).map(field => ({ id: `refine-${field}`, about: field, kind: 'choice', label: `${PREFERENCE_LABELS[field]} 선호에 따라 어느 일정이 더 맞나요?`, options: [
    { id: 'yes', value: true, label: `${PREFERENCE_LABELS[field]} 쪽으로` }, { id: 'no', value: false, label: `${PREFERENCE_LABELS[field]} 피하는 쪽으로` },
  ] }));
  // First use existing Core Ask to screen the available routes. Unlike a route
  // ID, this decision excludes the input fingerprint: a changed answer alone
  // must not be mistaken for a changed itinerary.
  const byId = new Map(plans.map(plan => [plan.id, plan]));
  const screened = Ask.rank({ questions, decide: answers => {
    if (!Object.keys(answers).length) return questionDecision(primary);
    const hypothetical = [...preferences, ...Object.entries(answers).map(([field, value]) => ({ field, value, importance: 3, at, sourceId: `hypothesis-${field}` }))];
    return questionDecision(byId.get(rankRoutes(plans, input, hypothetical, at).selected?.id));
  } });
  // Search pruning depends on preferences. Recompute both answer branches for
  // the displayed question so a preview is the exact plan applying that answer
  // will produce, rather than merely a reranking of an old candidate pool.
  for (const entry of screened.filter(row => !row.skippable).slice(0, 4)) {
    const question = questions.find(row => row.id === entry.id), outcomes = new Map();
    for (const option of question.options) outcomes.set(option.value, planTravel({ ...input, preferences: { ...input.preferences, [question.about]: option.value } }, { ...settings, now: at, ask: false }).primary);
    const yes = outcomes.get(true), no = outcomes.get(false);
    if (!yes || !no || JSON.stringify(questionDecision(yes)) === JSON.stringify(questionDecision(no))) continue;
    const selected = Ask.choose({ questions: [question], decide: answers => questionDecision(Object.hasOwn(answers, question.about) ? outcomes.get(answers[question.about]) : primary) });
    if (selected.status !== 'ask') continue;
    return { ...question, impact: selected.impact, before: questionPreview(primary, primary),
      options: question.options.map(option => ({ ...option, preview: questionPreview(outcomes.get(option.value), primary) })),
      caveat: '같은 날짜·필수 조건에서 다시 계산한 안이에요. 알려진 표시 비용의 차이이며 미확인 비용·대기·좌석을 보장하지 않아요.' };
  }
  return null;
}

/** Pure, bounded planning when `now` and the synchronous route dependency are supplied.
 * No model calls, network, storage, reservation or fabricated venue attributes.
 * The bounded beam is a product search policy, not a globally optimal route claim.
 */
export function planTravel(raw, { places = TRAVEL_PLACES, now, feedback = [], routeLeg, calendar = REAL_CONDITION_CALENDAR, ask = true } = {}) {
  if (!Array.isArray(places) || places.length > 80 || places.some(place => !plain(place) || !token(place.id)) || new Set(places.map(place => place.id)).size !== places.length) fail('places', '장소 자료를 확인해 주세요.');
  const input = normalizePlannerInput(raw, { places }), at = clock(now), preferences = effectivePreferences(input, feedback, at);
  const requiredFeatures = combinedRequiredFeatures(input.requiredFeatures, input.companions);
  const today = new Date(Date.parse(at) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (input.date < today) fail('date', '지난 날짜로 새 여행 일정을 만들 수 없어요. 오늘 이후 날짜를 골라 주세요.');
  const starts = minutes(input.startTime), ends = minutes(input.endTime), minimumStops = input.planningMode === 'remaining' ? 1 : 2, rejected = new Map(), unknown = new Map();
  const appointmentTimes = new Map(input.appointments.map(row => [row.placeId, minutes(row.time)]));
  const mandatoryIds = [...new Set([...input.lockedIds, ...appointmentTimes.keys()])];
  const record = (row, target = rejected) => { const key = `${row.kind}:${row.placeId ?? ''}:${row.reason}`; const previous = target.get(key); target.set(key, { ...row, count: (previous?.count ?? 0) + 1 }); };
  const eligible = [], placeInfo = new Map(), legs = new Map(), scheduleCache = new Map();
  for (const place of places) {
    if (place.dayPlannerEligible === false || !CATEGORIES.includes(place.category) || input.excludedIds.includes(place.id)) continue;
    if (input.meal.mode === 'none' && place.category === 'food') continue;
    const checks = requiredPlaceChecks(place, requiredFeatures, input.companions);
    if (checks.some(row => row.status === 'unmatched')) { checks.filter(row => row.status === 'unmatched').forEach(row => record(row)); continue; }
    if (checks.some(row => row.status === 'unknown')) { checks.filter(row => row.status === 'unknown').forEach(row => record(row, unknown)); continue; }
    try { point(place.coordinates, 'coordinates'); } catch { record(check('coordinates', 'unknown', '위치 근거가 없어 자동 동선을 만들지 않았어요.', { placeId: place.id }), unknown); continue; }
    const duration = integer(place.planningStayMinutes, 10, 240) ? place.planningStayMinutes : ({ food: 60, tea: 40, culture: 60 }[place.category]);
    const cost = partyCost(place, input, at, calendar);
    if (input.budget === 0 && (cost.status !== 'matched' || cost.knownAmount !== 0)) {
      record(check('budget.free-only', cost.status === 'matched' ? 'unmatched' : 'unknown', '0원 예산에서는 일행 전원의 비용이 무료로 확인된 장소만 추천해요.', { placeId: place.id }), cost.status === 'matched' ? rejected : unknown); continue;
    }
    placeInfo.set(place.id, { checks, duration, cost }); eligible.push(place);
  }
  eligible.sort((a, b) => a.id.localeCompare(b.id));
  for (const id of mandatoryIds) if (!eligible.some(place => place.id === id)) record(check(appointmentTimes.has(id) ? 'appointment' : 'locked', 'unmatched', '예약·유지한 장소가 이번 필수 조건·위치 자료로는 일정에 들어갈 수 없어요.', { placeId: id }));
  const walkingLeg = (from, to) => {
    const a = from.coordinates ?? from, b = to.coordinates ?? to;
    const key = JSON.stringify([from.id, a.lat, a.lon, to.id, b.lat, b.lon]);
    if (!legs.has(key)) legs.set(key, estimateWalkingLeg(from, to, { routeLeg, stepFree: requiredFeatures.stepFree === true }));
    return legs.get(key);
  };
  const schedule = (place, arrival, duration) => {
    const key = `${place.id}:${arrival}:${duration}`;
    if (!scheduleCache.has(key)) scheduleCache.set(key, evaluateRealStay(place, { date: input.date, time: time(arrival), stayMinutes: duration }, { now: at, calendar }));
    return scheduleCache.get(key);
  };
  const finalRoutes = [];
  const finishRoute = row => {
    if (!input.destination) return { ...row, returnLeg: null };
    const from = row.stops.at(-1).place, leg = walkingLeg(from, input.destination);
    if (requiredFeatures.stepFree === true && leg.stepFreeVerified !== true) {
      record(requiredWalkingCheck(leg, from.id, true), unknown); return null;
    }
    const walkMin = row.walkMin + leg.minMinutes, walkMax = row.walkMax + leg.maxMinutes;
    if (walkMax > input.maxWalkMinutes || input.maxLegWalkMinutes !== null && leg.maxMinutes > input.maxLegWalkMinutes) {
      const uncertain = walkMin <= input.maxWalkMinutes && (input.maxLegWalkMinutes === null || leg.minMinutes <= input.maxLegWalkMinutes);
      record(check('walking.return', uncertain ? 'unknown' : 'unmatched', '마지막 도착지까지 이동하면 전체 또는 한 구간 걷기 상한을 넘어요.', { placeId: from.id }), uncertain ? unknown : rejected); return null;
    }
    const cursor = row.cursor + leg.maxMinutes;
    if (cursor > ends) { record(check('destination.time', 'unmatched', '마지막 도착지까지 이동하면 여행 종료 시각을 넘어요.', { placeId: from.id })); return null; }
    return { ...row, cursor, walkMin, walkMax,
      returnLeg: { ...leg, departureTime: time(row.cursor), arrivalTime: time(cursor) },
      checks: [...row.checks, ...walkingChecks(leg, from.id).map(row => ({ ...row, kind: 'route.return', reason: `마지막 도착지까지: ${row.reason}` }))] };
  };
  let explored = 0, walkingUncertainCandidates = 0;
  let beam = [{ stops: [], legs: [], checks: [], cursor: starts, knownAmount: 0, walkMin: 0, walkMax: 0, activeSincePause: 0 }];
  for (let depth = 1; depth <= input.stopCount; depth++) {
    const next = [];
    for (const partial of beam) for (const place of eligible) {
      if (partial.stops.some(stop => stop.placeId === place.id)) continue;
      explored++;
      const info = placeInfo.get(place.id), from = partial.stops.at(-1)?.place ?? input.origin;
      const leg = walkingLeg(from, place), walkMin = partial.walkMin + leg.minMinutes, walkMax = partial.walkMax + leg.maxMinutes;
      if (requiredFeatures.stepFree === true && leg.stepFreeVerified !== true) {
        record(requiredWalkingCheck(leg, place.id), unknown); continue;
      }
      if (walkMax > input.maxWalkMinutes) {
        const uncertain = walkMin <= input.maxWalkMinutes;
        if (uncertain) walkingUncertainCandidates++;
        record(check('walking', uncertain ? 'unknown' : 'unmatched', uncertain ? '도보 추정 상단이 걷기 상한을 넘어서 추천에서 뺐어요. 더 짧은 길을 확인해야 해요.' : '도보 추정 하단도 걷기 상한을 넘어요.'), uncertain ? unknown : rejected); continue;
      }
      if (input.maxLegWalkMinutes !== null && leg.maxMinutes > input.maxLegWalkMinutes) {
        const uncertain = leg.minMinutes <= input.maxLegWalkMinutes;
        record(check('walking.leg', uncertain ? 'unknown' : 'unmatched', `한 구간 예상 도보 ${leg.minMinutes}~${leg.maxMinutes}분이 한 번에 걷는 상한 ${input.maxLegWalkMinutes}분을 넘어서 제외했어요.`, { placeId: place.id }), uncertain ? unknown : rejected); continue;
      }
      let arrival = partial.cursor + leg.maxMinutes;
      const firstArrival = arrival;
      const appointment = appointmentTimes.get(place.id), mealWindow = place.category === 'food' && input.meal.mode === 'window';
      const latestStart = mealWindow ? Math.min(ends, minutes(input.meal.endTime)) : ends;
      let activeOnVisit = partial.activeSincePause + leg.maxMinutes, preStartPause;
      // A fixed visit/meal start is an activity start, not the start of a rest.
      // Explicitly put an already-due pause in the early-arrival waiting time;
      // ordinary waiting never silently counts as a confirmed place to rest.
      if ((appointment !== undefined || mealWindow) && input.restEveryMinutes !== null && activeOnVisit >= input.restEveryMinutes) {
        preStartPause = { startTime: time(arrival), endTime: time(arrival + input.restDurationMinutes),
          durationMinutes: input.restDurationMinutes, kind: 'planned-rest', locationStatus: 'unverified' };
        arrival += input.restDurationMinutes; activeOnVisit = 0;
      }
      if (appointment !== undefined) {
        if (arrival > appointment) { record(check('appointment.late', 'unmatched', preStartPause
          ? `${place.name}에 도착한 뒤 필요한 휴식을 넣으면 ${time(appointment)} 예약 시각에 시작할 수 없어요.`
          : `${place.name}의 ${time(appointment)} 예약 시각에 도착할 수 없어요.`, { placeId: place.id })); continue; }
        arrival = appointment;
      } else if (mealWindow) arrival = Math.max(arrival, minutes(input.meal.startTime));
      if (arrival > latestStart) { record(check('meal.time', 'unmatched', preStartPause
        ? '도착 후 필요한 휴식을 마치면 식사를 시작할 수 있는 시간대를 지나서 이 식당을 넣지 않았어요.'
        : '식사를 시작할 수 있는 시간대를 지나서 이 식당을 넣지 않았어요.', { placeId: place.id })); continue; }
      let stay = planStay(arrival, info.duration, activeOnVisit, input);
      if (arrival + stay.duration > ends) { record(check('time', 'unmatched', '이동과 머무를 시간·쉬는 여유를 넣으면 종료 시각을 넘어요.')); continue; }
      let operating = schedule(place, arrival, stay.duration);
      if (operating.status === 'unmatched' && appointment === undefined) {
        // Wait only for a sourced operating window; unknown schedules are never invented.
        for (let later = arrival + 1; later <= Math.min(mealWindow ? latestStart : arrival + 120, ends - stay.duration); later += 1) {
          const checked = schedule(place, later, stay.duration);
          if (checked.status === 'matched') { arrival = later; operating = checked; break; }
        }
      }
      if (operating.status === 'unmatched') { record(check('schedule', 'unmatched', operating.reason, { placeId: place.id })); continue; }
      const knownAmount = partial.knownAmount + info.cost.knownAmount;
      if (knownAmount > input.budget) { record(check('budget', 'unmatched', '표시 메뉴·일반 관람의 알려진 비용만으로 일행 예산을 넘어요.')); continue; }
      const checks = [...partial.checks, ...info.checks, ...walkingChecks(leg, place.id), check('schedule', operating.status, operating.reason, { placeId: place.id }),
        check('cost', info.cost.status, info.cost.unknowns.join(' ') || '일행의 일반 관람 표시 비용을 확인했어요.', { placeId: place.id })];
      stay = planStay(arrival, info.duration, activeOnVisit, input);
      if (preStartPause || stay.pauses.length) checks.push(check('rest-place', 'unknown', preStartPause
        ? '도착 후 방문을 시작하기 전에 쉬는 시간을 따로 넣었어요. 대기 중 쉴 장소·좌석과 이용 가능 여부는 미확인이며, 방문 중 쉬는 시간도 별도로 표시해요.'
        : '시설 안에서 쉴 여유를 일정에 더했어요. 좌석·쉼터·앉을 수 있는지는 미확인이며, 걷는 중 쉬는 간격을 넘으면 다음 장소에 도착한 뒤 쉬어요.', { placeId: place.id }));
      const stop = { placeId: place.id, place, arrivalTime: time(arrival), departureTime: time(arrival + stay.duration), stayMinutes: stay.duration,
        stayProvenance: 'estimated', waitMinutes: arrival - firstArrival, schedule: operating, cost: info.cost, reasons: [],
        ...(preStartPause ? { preStartPause } : {}), ...(stay.pauses.length ? { pauses: stay.pauses } : {}) };
      const row = { stops: [...partial.stops, stop], legs: [...partial.legs, { ...leg, departureTime: time(partial.cursor), arrivalTime: time(firstArrival) }],
        checks, cursor: arrival + stay.duration, knownAmount, walkMin, walkMax, activeSincePause: stay.activeSincePause };
      const missingLocks = mandatoryIds.filter(id => !row.stops.some(stop => stop.placeId === id));
      if (missingLocks.length > input.stopCount - depth) continue;
      if (missingLocks.some(id => appointmentTimes.has(id) && appointmentTimes.get(id) < row.cursor)) {
        record(check('appointment.conflict', 'unmatched', '앞 장소의 체류를 마치면 다음 예약 시각을 넘어요. 예약 시각은 자동으로 옮기지 않았어요.')); continue;
      }
      const fulfilled = input.requiredCategories.filter(category => row.stops.some(stop => stop.place.category === category)).length;
      const preferenceFit = preferences.reduce((n, pref) => {
        const value = preferenceFeature(row.stops, pref.field);
        const fit = value === null ? 0 : 1 - Math.abs(Number(pref.value) - value);
        const knownConflict = pref.value === false && Object.hasOwn(DETAIL_PREFERENCE_CATEGORIES, pref.field)
          && relevantStops(row.stops, pref.field).some(stop => semanticFeature(stop.place, pref.field) === true);
        return n + (fit - Number(knownConflict)) * pref.importance;
      }, 0);
      const repeatedMeals = Math.max(0, row.stops.filter(stop => stop.place.category === 'food').length - 1);
      const adjacentMeal = row.stops.length > 1 && place.category === 'food' && row.stops.at(-2).place.category === 'food';
      row.companionUtility = companionUtility(row.stops, input.companions);
      row.searchScore = preferenceFit + fulfilled + (mandatoryIds.length - missingLocks.length) * 2 - walkMax / 360 - (row.cursor - starts) / 1440 - repeatedMeals * 0.7 - Number(adjacentMeal) * 0.8;
      next.push(row);
      if (depth >= minimumStops && !missingLocks.length && input.requiredCategories.every(category => row.stops.some(stop => stop.place.category === category))
        && (input.meal.mode !== 'window' || row.stops.some(stop => stop.place.category === 'food'))) {
        const finished = finishRoute(row);
        if (finished) finalRoutes.push(finished);
      }
    }
    next.sort((a, b) => (b.companionUtility?.minimum ?? 0) - (a.companionUtility?.minimum ?? 0)
      || (b.companionUtility?.average ?? 0) - (a.companionUtility?.average ?? 0)
      || b.searchScore - a.searchScore || a.cursor - b.cursor || a.stops.map(stop => stop.placeId).join('|').localeCompare(b.stops.map(stop => stop.placeId).join('|')));
    beam = next.slice(0, BEAM_WIDTH);
    if (!beam.length) break;
  }
  // Final candidates from each depth are bounded too, independently of catalogue order.
  finalRoutes.sort((a, b) => (b.companionUtility?.minimum ?? 0) - (a.companionUtility?.minimum ?? 0)
    || (b.companionUtility?.average ?? 0) - (a.companionUtility?.average ?? 0) || b.searchScore - a.searchScore || a.cursor - b.cursor);
  const unique = new Map();
  // Reserve capacity for every length so cheap two-stop prefixes cannot crowd
  // all four/five-stop candidates out before Core evaluates the full plans.
  for (let length = minimumStops; length <= input.stopCount; length++) {
    let kept = 0;
    for (const row of finalRoutes.filter(row => row.stops.length === length)) {
      const id = `route-${fingerprint([input, row.stops.map(stop => [stop.placeId, stop.arrivalTime])])}`;
      if (unique.has(id)) continue;
      unique.set(id, { id, ...row });
      if (++kept >= 225) break;
    }
  }
  const routes = [...unique.values()];
  const bundles = routes.map(route => ({ id: route.id, items: route.stops.flatMap((stop, i) => {
    const leg = route.legs[i], source = sourceFor(stop.place), items = [];
    if (minutes(leg.arrivalTime) > minutes(leg.departureTime)) items.push({ id: `transfer-${i}`, kind: 'transfer', start: minutes(leg.departureTime), end: minutes(leg.arrivalTime),
      walkMinutes: leg.maxMinutes, requirements: {}, cost: { amount: 0, currency: 'KRW', status: 'known' }, source });
    items.push({ id: stop.placeId, kind: stop.place.category, start: minutes(stop.arrivalTime), end: minutes(stop.departureTime), walkMinutes: 0, requirements: {},
      cost: { amount: stop.cost.status === 'matched' ? stop.cost.knownAmount : null, currency: 'KRW', status: stop.cost.status === 'matched' ? 'known' : 'unknown' }, source });
    return items;
  }).concat(route.returnLeg && route.returnLeg.maxMinutes > 0 ? [{ id: 'return-transfer', kind: 'transfer',
    start: minutes(route.returnLeg.departureTime), end: minutes(route.returnLeg.arrivalTime), walkMinutes: route.returnLeg.maxMinutes,
    requirements: {}, cost: { amount: 0, currency: 'KRW', status: 'known' }, source: sourceFor(route.stops.at(-1).place) }] : []) }));
  const feasibility = Travel.evaluateBundles({ bundles, budget: input.budget, currency: 'KRW', dayStart: starts, dayEnd: ends,
    maxWalkMinutes: input.maxWalkMinutes, at, lockedIds: input.lockedIds, excludedIds: input.excludedIds });
  const permitted = new Map([...feasibility.feasible, ...feasibility.pending].map(row => [row.id, row]));
  const plans = routes.filter(row => permitted.has(row.id)).map(row => {
    const assessment = permitted.get(row.id), checks = [...row.checks];
    for (const reason of assessment.reasons.filter(reason => reason.code !== 'cost.unknown')) checks.push(check(reason.code, 'unknown', '안내의 확인 시점·유효 범위를 다시 확인해 주세요.', { placeId: reason.itemId }));
    const unknownPlaceIds = row.stops.filter(stop => stop.cost.status !== 'matched').map(stop => stop.placeId);
    return { id: row.id, status: checks.some(row => row.status === 'unknown') ? 'partial' : 'ready', stops: row.stops, legs: row.legs, checks,
      returnLeg: row.returnLeg, destination: input.destination ? { ...input.destination } : null,
      walking: { minMinutes: row.walkMin, maxMinutes: row.walkMax, scope: 'between-places', label: input.destination ? '출발점부터 마지막 도착지까지 예상 도보 합계 · 시설 안 걷기는 별도' : '출발점부터 장소 사이 예상 도보 합계 · 시설 안 걷기는 별도' },
      cost: { knownAmount: row.knownAmount, unknownPlaceIds, status: unknownPlaceIds.length ? 'unknown' : 'matched',
        notes: ['성인·아이 인원에 따른 일반 관람과 표시 메뉴만 비교해요. 교통·추가 주문·할인·예약 비용은 별도예요.'] },
      startTime: input.startTime, endTime: time(row.cursor), reasons: [], lockedIds: [...input.lockedIds], inputFingerprint: fingerprint(input) };
  });
  const choice = rankRoutes(plans, input, preferences, at), byId = new Map(plans.map(route => [route.id, route]));
  for (const ranked of choice.ranked) {
    const route = byId.get(ranked.id); route.score = ranked.score;
    route.reasons = ranked.reasons.filter(reason => reason.contribution > 0).map(reason => `${PREFERENCE_LABELS[reason.field]} ${reason.value === 1 ? '선호' : '피하기'}를 확인된 장소 특성과 비교했어요.`);
    if (route.stops.length < input.stopCount) route.reasons.push(`희망 ${input.stopCount}곳보다 짧은 ${route.stops.length}곳 안이에요. 시간·예산·걷기와 취향을 함께 비교했어요.`);
    if (input.companions.some(person => Object.keys(person.preferences).length)) route.reasons.push('계산한 후보 안에서 입력한 동행별 취향을 같은 비중으로 비교하고, 가장 덜 반영된 사람의 취향부터 살폈어요. 실제 만족도를 보장하는 점수는 아니에요.');
    if (route.status === 'partial') route.reasons.push('확인할 조건이 남은 초안이에요. 각 장소의 미확인 항목을 확인한 뒤 방문해 주세요.');
    route.stops.forEach(stop => {
      stop.reasons = preferences.filter(pref => relevantStops([stop], pref.field).length && semanticFeature(stop.place, pref.field) === pref.value).map(pref => `${PREFERENCE_LABELS[pref.field]} ${pref.value ? '선호' : '피하기'} 반영`);
      if (appointmentTimes.has(stop.placeId)) stop.reasons.unshift(`${time(appointmentTimes.get(stop.placeId))} 예약 시각을 유지했어요.`);
      if (stop.place.category === 'food' && input.meal.mode === 'window') stop.reasons.push(`식사 시작 ${input.meal.startTime}~${input.meal.endTime} 안에 맞췄어요.`);
    });
  }
  const primary = choice.selected ? byId.get(choice.selected.id) : null, alternatives = [];
  if (primary) {
    primary.label = input.planningMode === 'remaining' ? '지금부터 남은 일정' : '나에게 맞춘 일정';
    const used = new Set([primary.id]);
    for (const [mode, label] of [['walking', '이동을 줄인 안'], ['cost', '확인된 표시 비용을 줄인 안'], ['different', '다른 장소로 즐기는 안']]) {
      const selected = chooseDiverse(choice.ranked, byId, primary, used, mode);
      if (selected) { selected.label = label; alternatives.push(selected); used.add(selected.id); }
      if (alternatives.length === 3) break;
    }
  }
  const question = ask ? usefulQuestion({ primary, plans, input, preferences, eligible, at, settings: { places, feedback, routeLeg, calendar } }) : null;
  if (!primary && !rejected.size && !unknown.size) record(check('combination', 'unmatched', `유지한 장소·필수 분야를 포함하는 ${minimumStops}곳 이상의 일정을 만들 수 없어요. 조건을 조정해 주세요.`));
  return { version: PLANNER_VERSION, status: primary?.status ?? 'unavailable', input, primary, alternatives, question,
    blocked: [...rejected.values()], unknowns: [...unknown.values()],
    diagnostics: { explored, evaluated: routes.length, viable: plans.length, eligiblePlaces: eligible.length, walkingUncertainCandidates, search: 'bounded-beam', beamWidth: BEAM_WIDTH },
    engineAudit: { domainVersion: Domain.VERSION, travelVersion: Travel.VERSION, askVersion: Ask.VERSION, semanticPreferences: preferences,
      companionPolicy: { order: 'least-then-average-then-group-and-route', profiles: input.companions.length, rankedProfiles: input.companions.filter(person => Object.keys(person.preferences).length).length,
        normalization: 'one-person-one-normalized-utility', scope: 'bounded-search-candidates', calibration: false },
      selectedId: primary?.id ?? null, decisionReasons: choice.selected?.reasons ?? [], calibrated: false, externalCalls: 0,
      reused: ['Core Domain', 'Core travel feasibility', 'Ask'], scope: 'Confirmed user preferences and sourced venue features; travel times are planning estimates.' } };
}

export function replanTravel(raw, options = {}) {
  const { lockedIds = raw.lockedIds ?? [], excludedIds = raw.excludedIds ?? [], replace, ...settings } = options;
  let locked = [...lockedIds], excluded = [...excludedIds];
  if (replace) {
    if (!plain(replace) || !token(replace.fromId) || !token(replace.toId) || replace.fromId === replace.toId) fail('replace', '서로 다른 교체 장소를 골라 주세요.');
    locked = [...new Set([...locked.filter(id => id !== replace.fromId), replace.toId])];
    excluded = [...new Set([...excluded.filter(id => id !== replace.toId), replace.fromId])];
  }
  return planTravel({ ...raw, lockedIds: locked, excludedIds: excluded }, settings);
}

/** Compare explicit, bounded changes only after the original query has failed.
 * Every suggestion carries a real recalculation; nothing is applied here.
 * Required features/categories, exclusions, party, origin and preferences stay fixed. */
export function suggestTravelRecovery(raw, options = {}) {
  const settings = { ...options, ask: false }, original = planTravel(raw, settings), input = original.input;
  const suggestions = []; let attempts = 1;
  if (original.primary) return { input, suggestions, attempts };
  function attempt(patch, label) {
    const changes = Object.entries(patch).filter(([field, value]) => JSON.stringify(input[field]) !== JSON.stringify(value)).map(([field, to]) => ({field, from: input[field], to}));
    if (!changes.length) return;
    const result = planTravel({ ...input, ...patch }, settings); attempts++;
    if (result.primary) suggestions.push({id: 'recovery-' + suggestions.length, label, changes, result});
    return !!result.primary;
  }
  const families = [
    ['time', [30, 60].filter(n => minutes(input.endTime) + n < 1440).map(n => [{endTime: time(minutes(input.endTime) + n)}, `마칠 시각을 ${n}분 늦추기`])],
    ['walking', [10, 20].filter(n => input.maxWalkMinutes + n <= 360).map(n => [{maxWalkMinutes: input.maxWalkMinutes + n}, `걷기 상한을 ${n}분 늘리기`])],
    ['budget', [5000, 10000].filter(n => input.budget + n <= 10000000).map(n => [{budget: input.budget + n}, `일행 예산을 ${n.toLocaleString('ko-KR')}원 늘리기`])],
  ];
  for (const [, variants] of families) {
    for (const [patch, label] of variants) if (attempt(patch, label)) break;
    if (suggestions.length >= 3) break;
  }
  // Offer a two-condition change only when single-condition choices cannot help.
  if (!suggestions.length && minutes(input.endTime) + 30 < 1440 && input.maxWalkMinutes + 10 <= 360) {
    attempt({endTime: time(minutes(input.endTime) + 30), maxWalkMinutes: input.maxWalkMinutes + 10}, '종료 30분 연장 + 걷기 상한 10분 늘리기');
  }
  // Unlocking is its own visible choice; never an implicit side effect of recovery.
  if (suggestions.length < 3) for (const id of input.lockedIds.slice(0, 6)) {
    const name = (options.places ?? TRAVEL_PLACES).find(p => p.id === id)?.name ?? id;
    attempt({lockedIds: input.lockedIds.filter(value => value !== id)}, `${name} 유지 설정 해제하기`);
    if (suggestions.length >= 3) break;
  }
  return { input, suggestions, attempts };
}

/** Rebuild only what remains, using the visitor's explicit current position,
 * time and remaining spending/walking budgets. A planned subtotal is never
 * interpreted as money already spent. Completion is self-reported, not inferred
 * from exposure, feedback or clock time. No day rollover or automatic finish. */
export function replanRemainingTravel(raw, options = {}) {
  if (!plain(options)) fail('progress', '여행의 현재 상태를 확인해 주세요.');
  if (!plain(raw)) fail('input', '여행 조건을 입력해 주세요.');
  const { completedIds = [], skippedIds = [], currentTime, origin, remainingBudget, maxWalkMinutes, stopCount,
    places = TRAVEL_PLACES, ...settings } = options;
  if (!Array.isArray(places) || places.length > 80 || places.some(place => !plain(place) || !token(place.id)) || new Set(places.map(place => place.id)).size !== places.length) fail('places', '장소 자료를 확인해 주세요.');
  const completed = ids(completedIds, 'completedIds'), skipped = ids(skippedIds, 'skippedIds');
  if (completed.some(id => skipped.includes(id))) fail('completedIds', '방문 완료한 장소를 동시에 건너뛴 장소로 기록할 수 없어요.');
  const byId = new Map(places.map(place => [place.id, place]));
  if ([...completed, ...skipped].some(id => !byId.has(id))) fail('completedIds', '현재 장소 목록에 없는 방문 기록이 있어요.');
  const done = new Set([...completed, ...skipped]), completedCategories = new Set(completed.map(id => byId.get(id).category));
  // Apply explicit completion before validating the remaining intent. Otherwise
  // "I finished lunch; no more meals" would conflict with the old required meal
  // or a restaurant appointment that the same report has already completed.
  const input = normalizePlannerInput({ ...raw,
    lockedIds: Array.isArray(raw.lockedIds) ? raw.lockedIds.filter(id => !done.has(id)) : raw.lockedIds,
    appointments: Array.isArray(raw.appointments) ? raw.appointments.filter(row => !done.has(row?.placeId)) : raw.appointments,
    requiredCategories: Array.isArray(raw.requiredCategories) ? raw.requiredCategories.filter(category => !completedCategories.has(category)) : raw.requiredCategories,
  }, { places });
  if (!timeValid(currentTime) || minutes(currentTime) < minutes(input.startTime) || minutes(currentTime) >= minutes(input.endTime)) fail('currentTime', '현재 시각은 기존 시작 이후, 같은 날의 여행 종료 이전으로 입력해 주세요.');
  if (!integer(stopCount, 1, 5)) fail('stopCount', '앞으로 방문할 수는 1~5곳으로 골라 주세요.');
  return planTravel({ ...input, planningMode: 'remaining', startTime: currentTime, origin, budget: remainingBudget, maxWalkMinutes, stopCount,
    lockedIds: input.lockedIds.filter(id => !done.has(id)), excludedIds: [...new Set([...input.excludedIds, ...done])],
    appointments: input.appointments.filter(row => !done.has(row.placeId)),
    requiredCategories: input.requiredCategories.filter(category => !completedCategories.has(category)),
  }, { ...settings, places });
}
