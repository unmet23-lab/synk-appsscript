import { normalizePlannerInput, assessPlannerRequirements, matchesPlannerInputFingerprint } from './planner.mjs';
import { TRAVEL_PLACES } from './places-v2.mjs';
import { readRealState } from './real-guide.mjs';
import { TRAVEL_SCOPE, TRAVEL_PREFERENCE_KEYS, TRAVEL_VISIT_REASONS, isTravelTime,
  validateTravelJournal, confirmTravelPreference, recordVisit } from './planner-feedback.mjs';

export const TRAVEL_STORAGE_KEY = 'synk-path-travel-planner-v4';
export const TRAVEL_FORMAT = 'synk-path-travel';
export const TRAVEL_MAX_BYTES = 512 * 1024;
const transferFormat = 'synk-path-travel-transfer';
const encoder = new TextEncoder();
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields, optional = []) => object(value) && fields.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => fields.includes(key) || optional.includes(key));
const fail = (message = '여행 파일의 형식이 맞지 않아요. 현재 기록은 유지했어요.') => { throw new TypeError(message); };
const timestamp = now => { const value = now ?? new Date().toISOString(); if (!isTravelTime(value)) fail('기록 시각을 확인해 주세요.'); return value; };
const places = new Set(TRAVEL_PLACES.map(place => place.id));
const placeById = new Map(TRAVEL_PLACES.map(place => [place.id, place]));
const dayPlaces = new Set(TRAVEL_PLACES.filter(place => place.dayPlannerEligible !== false && ['food', 'tea', 'culture'].includes(place.category)).map(place => place.id));

// Export/import never accepts executable objects, prototypes or silently lost values.
function jsonCopy(value) {
  let nodes = 0;
  const ancestors = new Set();
  const visit = (entry, depth) => {
    if (++nodes > 80000 || depth > 24) fail('여행 기록이 너무 복잡해 불러오지 않았어요.');
    if (entry === null || typeof entry === 'boolean') return;
    if (typeof entry === 'number') { if (!Number.isFinite(entry)) fail(); return; }
    if (typeof entry === 'string') { if (entry.length > 20000 || /\u0000/.test(entry)) fail(); return; }
    if (typeof entry !== 'object' || ancestors.has(entry)) fail();
    if (!Array.isArray(entry) && ![Object.prototype, null].includes(Object.getPrototypeOf(entry))) fail();
    ancestors.add(entry);
    for (const key of Reflect.ownKeys(entry)) {
      if (Array.isArray(entry) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)
        || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || Array.isArray(entry) && !/^(0|[1-9]\d*)$/.test(key)) fail();
      visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(entry) && Object.keys(entry).length !== entry.length) fail();
    ancestors.delete(entry);
  };
  visit(value, 0);
  const raw = JSON.stringify(value);
  if (encoder.encode(raw).byteLength > TRAVEL_MAX_BYTES) fail('여행 기록은 512 KB까지 불러올 수 있어요.');
  return JSON.parse(raw);
}

const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value, max = 2000) => typeof value === 'string' && value.length <= max;
const texts = (value, max = 100) => Array.isArray(value) && value.length <= max && value.every(entry => text(entry));
const time = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const amount = value => integer(value, 0, 10000000);
const uniqueIds = (value, allowed, max = 5) => Array.isArray(value) && value.length <= max
  && value.every(id => token(id) && allowed.has(id)) && new Set(value).size === value.length;
const publicUrl = value => {
  if (!text(value, 2048)) return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};
const coordinate = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
  && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
const sameCoordinate = (a, b) => coordinate(a) && coordinate(b) && a.every((value, index) => Math.abs(value - b[index]) <= 1e-8);

function validateStoredLeg(leg) {
  if (!exact(leg, ['fromId', 'toId', 'distanceMeters', 'minMinutes', 'maxMinutes', 'coordinates', 'source', 'estimated', 'label', 'departureTime', 'arrivalTime'],
    ['sourceAt', 'unknownAccess', 'steps', 'connectorMeters', 'notice', 'assumptions', 'stepFreeVerified'])
    || !token(leg.fromId) || !token(leg.toId)
    || !Number.isFinite(leg.distanceMeters) || leg.distanceMeters < 0 || leg.distanceMeters > 10000000
    || !integer(leg.minMinutes, 0, 1440) || !integer(leg.maxMinutes, leg.minMinutes, 1440)
    || !Array.isArray(leg.coordinates) || leg.coordinates.length < 2 || leg.coordinates.length > 8192 || !leg.coordinates.every(coordinate)
    || !text(leg.source, 160) || !leg.source.length || leg.estimated !== true || !text(leg.label, 500)
    || !time(leg.departureTime) || !time(leg.arrivalTime) || minute(leg.arrivalTime) - minute(leg.departureTime) !== leg.maxMinutes) fail('저장된 이동 경로·시각·좌표를 확인해 주세요.');
  for (const key of ['unknownAccess', 'steps', 'stepFreeVerified']) if (Object.hasOwn(leg, key) && typeof leg[key] !== 'boolean') fail('저장된 이동 조건을 확인해 주세요.');
  for (const key of ['notice', 'assumptions']) if (Object.hasOwn(leg, key) && !text(leg[key])) fail('저장된 이동 안내를 확인해 주세요.');
  if (Object.hasOwn(leg, 'sourceAt') && (!text(leg.sourceAt, 40) || !Number.isFinite(Date.parse(leg.sourceAt)))) fail('지도 자료 확인 시각을 확인해 주세요.');
  if (Object.hasOwn(leg, 'connectorMeters') && (!Number.isFinite(leg.connectorMeters) || leg.connectorMeters < 0 || leg.connectorMeters > 10000000)) fail('지도 연결 구간의 거리를 확인해 주세요.');
}

/** Validate an archived plan's safe renderable shape and internal arithmetic.
 * This is not today's feasibility check: past dates and past estimates are retained.
 */
function validatePlan(plan, query) {
  if (plan === null) return null;
  if (!exact(plan, ['id', 'status', 'stops', 'legs', 'walking', 'cost', 'startTime', 'endTime', 'reasons', 'checks', 'lockedIds', 'inputFingerprint'], ['score', 'label', 'destination', 'returnLeg'])
    || !token(plan.id) || !['ready', 'partial'].includes(plan.status) || !token(plan.inputFingerprint)
    || !time(plan.startTime) || !time(plan.endTime) || minute(plan.startTime) >= minute(plan.endTime)
    || plan.startTime !== query.startTime || minute(plan.endTime) > minute(query.endTime)
    || !texts(plan.reasons) || !Array.isArray(plan.stops) || plan.stops.length < (query.planningMode === 'remaining' ? 1 : 2) || plan.stops.length > query.stopCount
    || !Array.isArray(plan.legs) || plan.legs.length !== plan.stops.length
    || Object.hasOwn(plan, 'score') && !Number.isFinite(plan.score)
    || Object.hasOwn(plan, 'label') && !text(plan.label, 160)) fail('저장된 여행안의 구조를 확인하지 못했어요. 현재 기록은 유지했어요.');
  const stopIds = new Set();
  for (const stop of plan.stops) {
    if (!exact(stop, ['placeId', 'place', 'arrivalTime', 'departureTime', 'stayMinutes', 'waitMinutes', 'schedule', 'cost', 'reasons'], ['stayProvenance', 'pauses', 'preStartPause'])
      || !places.has(stop.placeId) || stopIds.has(stop.placeId) || !object(stop.place) || stop.place.id !== stop.placeId
      || !time(stop.arrivalTime) || !time(stop.departureTime) || !integer(stop.stayMinutes, 1, 1440)
      || !integer(stop.waitMinutes, 0, 1440) || minute(stop.departureTime) - minute(stop.arrivalTime) !== stop.stayMinutes
      || Object.hasOwn(stop, 'stayProvenance') && stop.stayProvenance !== 'estimated' || !texts(stop.reasons)) fail('저장된 장소의 방문 시각·체류시간을 확인해 주세요.');
    if (Object.hasOwn(stop, 'pauses')) {
      if (!Array.isArray(stop.pauses) || stop.pauses.length > 288) fail('저장된 쉬는 시간의 목록을 확인해 주세요.');
      let previousEnd = minute(stop.arrivalTime), totalPause = 0;
      for (const pause of stop.pauses) {
        if (!exact(pause, ['startTime', 'endTime', 'durationMinutes', 'kind', 'locationStatus'])
          || !time(pause.startTime) || !time(pause.endTime) || !integer(pause.durationMinutes, 5, 30)
          || minute(pause.endTime) - minute(pause.startTime) !== pause.durationMinutes
          || minute(pause.startTime) < previousEnd || minute(pause.endTime) > minute(stop.departureTime)
          || pause.kind !== 'planned-rest' || pause.locationStatus !== 'unverified') fail('저장된 쉬는 시간·순서·장소 확인 상태를 확인해 주세요.');
        previousEnd = minute(pause.endTime); totalPause += pause.durationMinutes;
      }
      if (totalPause >= stop.stayMinutes) fail('쉬는 시간 외에 장소를 방문할 시간이 남아 있어야 해요.');
    }
    const place = placeById.get(stop.placeId);
    if (!object(place.coordinates) || !coordinate([place.coordinates.lon, place.coordinates.lat])) fail('현재 위치 자료가 없는 장소가 들어 있어 여행 지도를 열 수 없어요.');
    stopIds.add(stop.placeId);
    const schedule = stop.schedule;
    if (!exact(schedule, ['status', 'label', 'reason'], ['sourceUrl']) || !['matched', 'unknown'].includes(schedule.status)
      || !text(schedule.label, 160) || !text(schedule.reason) || Object.hasOwn(schedule, 'sourceUrl') && !publicUrl(schedule.sourceUrl)) fail('저장된 운영 안내의 형식을 확인해 주세요.');
    const cost = stop.cost;
    if (!exact(cost, ['knownAmount', 'status', 'unknowns', 'items']) || !amount(cost.knownAmount)
      || !['matched', 'unknown'].includes(cost.status) || !texts(cost.unknowns) || !Array.isArray(cost.items) || cost.items.length > 40
      || (cost.status === 'matched' ? cost.unknowns.length !== 0 : cost.unknowns.length === 0)) fail('저장된 장소의 비용 안내를 확인해 주세요.');
    for (const item of cost.items) {
      if (!exact(item, ['label', 'quantity', 'unitAmount', 'amount', 'basis', 'sourceUrl']) || !text(item.label, 500)
        || !integer(item.quantity, 1, 40) || !amount(item.unitAmount) || !amount(item.amount) || item.quantity * item.unitAmount !== item.amount
        || !['suggested-menu', 'adult-admission', 'child-admission'].includes(item.basis) || !publicUrl(item.sourceUrl)) fail('저장된 비용 항목의 인원·금액·출처를 확인해 주세요.');
      if (item.quantity !== (item.basis === 'child-admission' ? query.party.children : query.party.adults)) fail('저장된 비용 항목의 인원과 여행 인원이 맞지 않아요.');
    }
    const adultItems = cost.items.filter(item => item.basis !== 'child-admission'), childItems = cost.items.filter(item => item.basis === 'child-admission');
    if (adultItems.length > 1 || childItems.length > 1 || cost.status === 'matched'
      && (adultItems.length !== 1 || query.party.children > 0 && childItems.length !== 1)) fail('저장된 인원별 비용의 확인 상태가 맞지 않아요.');
    if (cost.items.reduce((sum, item) => sum + item.amount, 0) !== cost.knownAmount) fail('저장된 장소 비용의 합계가 맞지 않아요.');
    // An archive supplies old estimates, not new public venue descriptions or URLs.
    stop.place = jsonCopy(place);
  }
  if (!uniqueIds(plan.lockedIds, stopIds) || plan.lockedIds.length !== query.lockedIds.length
    || query.lockedIds.some(id => !stopIds.has(id) || !plan.lockedIds.includes(id))) fail('저장된 유지 장소와 여행 조건이 맞지 않아요.');
  if (query.excludedIds.some(id => stopIds.has(id))) fail('제외한 장소가 저장된 일정에 포함되어 있어요.');
  if (query.requiredCategories.some(category => !plan.stops.some(stop => stop.place.category === category))) fail('필수 포함 분야와 저장된 일정이 맞지 않아요.');
  for (const [index, leg] of plan.legs.entries()) {
    validateStoredLeg(leg);
    if (leg.toId !== plan.stops[index].placeId || leg.fromId !== (index ? plan.stops[index - 1].placeId : query.origin.id)
      || !sameCoordinate(leg.coordinates[0], index ? plan.legs[index - 1].coordinates.at(-1) : [query.origin.lon, query.origin.lat])
      || leg.departureTime !== (index ? plan.stops[index - 1].departureTime : plan.startTime)
      || minute(plan.stops[index].arrivalTime) - minute(leg.arrivalTime) !== plan.stops[index].waitMinutes) fail('저장된 이동 경로·시각·좌표를 확인해 주세요.');
    const stop = plan.stops[index];
    if (Object.hasOwn(stop, 'preStartPause')) {
      const pause = stop.preStartPause;
      if (!exact(pause, ['startTime', 'endTime', 'durationMinutes', 'kind', 'locationStatus'])
        || !time(pause.startTime) || !time(pause.endTime) || !integer(pause.durationMinutes, 5, 30)
        || minute(pause.endTime) - minute(pause.startTime) !== pause.durationMinutes
        || pause.startTime !== leg.arrivalTime || minute(pause.endTime) > minute(stop.arrivalTime)
        || pause.durationMinutes > stop.waitMinutes || query.restEveryMinutes === null || pause.durationMinutes !== query.restDurationMinutes
        || !query.appointments.some(row => row.placeId === stop.placeId) && !(query.meal.mode === 'window' && stop.place.category === 'food')
        || pause.kind !== 'planned-rest' || pause.locationStatus !== 'unverified') fail('방문 시작 전 쉬는 시간은 도착 뒤 대기 시간 안에 있어야 해요.');
    }
  }
  const lastStop = plan.stops.at(-1), allLegs = [...plan.legs];
  if (query.destination !== null) {
    const destination = plan.destination;
    if (!exact(destination, ['id', 'name', 'lat', 'lon'])
      || ['id', 'name', 'lat', 'lon'].some(key => destination[key] !== query.destination[key])) fail('저장된 마지막 도착지와 여행 조건이 맞지 않아요.');
    validateStoredLeg(plan.returnLeg);
    const leg = plan.returnLeg;
    if (leg.fromId !== lastStop.placeId || leg.toId !== destination.id || leg.departureTime !== lastStop.departureTime
      || leg.arrivalTime !== plan.endTime || !sameCoordinate(leg.coordinates[0], plan.legs.at(-1).coordinates.at(-1))
      || !sameCoordinate(leg.coordinates.at(-1), [destination.lon, destination.lat])) fail('마지막 도착지까지의 이동 경로·시각·좌표가 맞지 않아요.');
    allLegs.push(leg);
  } else if (plan.destination != null || plan.returnLeg != null || plan.endTime !== lastStop.departureTime) {
    fail('저장된 마지막 도착지와 일정 종료 시각을 확인해 주세요.');
  }
  // Reuse the planner's requirement scope with canonical venue facts above.
  // An imported check/reason is not evidence, and this does not rerun past dates.
  const requiredChecks = assessPlannerRequirements(plan.stops, query, { legs: plan.legs, returnLeg: plan.returnLeg ?? null });
  if (requiredChecks.some(check => check.status !== 'matched')) fail('저장된 일정의 필수 조건을 현재 장소·이동 자료로 확인하지 못했어요. 파일과 현재 기록은 바꾸지 않았어요. 조건과 장소 자료를 확인해 주세요.');
  if (query.appointments.some(appointment => !plan.stops.some(stop => stop.placeId === appointment.placeId && stop.arrivalTime === appointment.time))) fail('저장된 일정이 예약 장소·시각과 맞지 않아요.');
  const meals = plan.stops.filter(stop => stop.place.category === 'food');
  if (query.meal.mode === 'none' && meals.length || query.meal.mode === 'window'
    && (!meals.length || meals.some(stop => stop.arrivalTime < query.meal.startTime || stop.arrivalTime > query.meal.endTime))) fail('저장된 일정이 식사 조건과 맞지 않아요.');
  const walking = plan.walking, cost = plan.cost;
  if (!exact(walking, ['minMinutes', 'maxMinutes', 'scope', 'label']) || !integer(walking.minMinutes, 0, 1440)
    || !integer(walking.maxMinutes, walking.minMinutes, 1440) || walking.scope !== 'between-places' || !text(walking.label, 500)
    || walking.minMinutes !== allLegs.reduce((sum, leg) => sum + leg.minMinutes, 0)
    || walking.maxMinutes !== allLegs.reduce((sum, leg) => sum + leg.maxMinutes, 0)
    || walking.maxMinutes > query.maxWalkMinutes || query.maxLegWalkMinutes !== null && allLegs.some(leg => leg.maxMinutes > query.maxLegWalkMinutes)) fail('저장된 도보 합계·상한이 맞지 않아요.');
  if (!exact(cost, ['knownAmount', 'unknownPlaceIds', 'status', 'notes']) || !amount(cost.knownAmount)
    || !uniqueIds(cost.unknownPlaceIds, stopIds) || !['matched', 'unknown'].includes(cost.status) || !texts(cost.notes)
    || cost.knownAmount !== plan.stops.reduce((sum, stop) => sum + stop.cost.knownAmount, 0)
    || cost.status !== (cost.unknownPlaceIds.length ? 'unknown' : 'matched')
    || JSON.stringify(cost.unknownPlaceIds) !== JSON.stringify(plan.stops.filter(stop => stop.cost.status === 'unknown').map(stop => stop.placeId))) fail('저장된 여행 비용의 합계를 확인해 주세요.');
  if (cost.knownAmount > query.budget || query.budget === 0 && cost.status !== 'matched') fail('저장된 여행 비용이 예산 조건과 맞지 않아요. 0원 예산은 무료로 확인된 장소만 가능해요.');
  if (!Array.isArray(plan.checks) || plan.checks.length > 200 || plan.checks.some(check => !exact(check, ['kind', 'status', 'reason'], ['placeId'])
    || !token(check.kind) || !['matched', 'unknown'].includes(check.status) || !text(check.reason)
    || Object.hasOwn(check, 'placeId') && !(stopIds.has(check.placeId) || /^transfer-[0-4]$/.test(check.placeId) || plan.returnLeg && check.placeId === 'return-transfer'))) fail('저장된 확인 항목의 형식을 확인해 주세요.');
  if (plan.stops.some(stop => (stop.preStartPause || stop.pauses?.length) && !plan.checks.some(check => check.kind === 'rest-place'
    && check.status === 'unknown' && check.placeId === stop.placeId))) fail('쉬는 장소의 미확인 안내가 빠져 있어요.');
  if (plan.status === 'ready'
    && (plan.checks.some(check => check.status === 'unknown') || cost.status === 'unknown' || plan.stops.some(stop => stop.schedule.status === 'unknown'))) fail('저장된 일정의 완료 조건이 일치하지 않아요.');
  if (!matchesPlannerInputFingerprint(query, plan.inputFingerprint)) fail('저장된 일정과 날짜·여행 조건이 맞지 않아요. 조건을 바꾸려면 새 일정을 만들어 주세요.');
  return plan;
}

/** Progress is an explicit itinerary update, never a review or a preference. */
function validateProgress(progress, memory) {
  if (!exact(progress, ['date', 'currentTime', 'completed', 'skippedIds', 'requiredCategories', 'finished', 'updatedAt'])
    || memory.query.planningMode !== 'remaining' || progress.date !== memory.query.date || !Array.isArray(progress.completed) || progress.completed.length > dayPlaces.size
    || !uniqueIds(progress.skippedIds, dayPlaces, dayPlaces.size) || progress.completed.length + progress.skippedIds.length > dayPlaces.size
    || !time(progress.currentTime) || !uniqueIds(progress.requiredCategories, new Set(['food', 'tea', 'culture']), 3)
    || typeof progress.finished !== 'boolean' || !isTravelTime(progress.updatedAt)
    || !progress.finished && minute(progress.currentTime) > minute(memory.query.startTime)
    || Date.parse(progress.updatedAt) > Date.parse(memory.updatedAt)) fail('여행 진행 기록의 날짜·형식·기록 시각을 확인해 주세요.');
  const completedIds = new Set();
  for (const entry of progress.completed) {
    if (!exact(entry, ['placeId', 'completedTime']) || !dayPlaces.has(entry.placeId) || completedIds.has(entry.placeId)
      || progress.skippedIds.includes(entry.placeId) || !time(entry.completedTime)
      || minute(entry.completedTime) > minute(progress.currentTime)) fail('완료한 장소와 완료 시각을 확인해 주세요.');
    completedIds.add(entry.placeId);
  }
  const removedIds = new Set([...completedIds, ...progress.skippedIds]);
  if ([...removedIds].some(id => !memory.query.excludedIds.includes(id))
    || memory.plan?.stops.some(stop => removedIds.has(stop.placeId))
    || memory.plan && memory.plan.startTime !== memory.query.startTime
    || progress.finished && memory.plan !== null) fail('완료·건너뛴 장소와 남은 일정이 맞지 않아요.');
  return progress;
}

export function defaultTravelQuery({ now } = {}) {
  const at = timestamp(now);
  return { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at)),
    startTime: '11:00', endTime: '17:00', origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 },
    party: { adults: 1, children: 0 }, budget: 60000, maxWalkMinutes: 45,
    maxLegWalkMinutes: null, restEveryMinutes: null, restDurationMinutes: 10, stopCount: 3,
    preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [] };
}

export function createTravelMemory({ query, plan = null, progress } = {}, { now } = {}) {
  const input = normalizePlannerInput(query ?? defaultTravelQuery({ now }), { places: TRAVEL_PLACES });
  const memory = { format: TRAVEL_FORMAT, version: 1, consent: false, query: input, plan: validatePlan(jsonCopy(plan), input),
    confirmedPreferences: [], visits: [], journal: { trail: [], decisions: [], exposures: [], outcomes: [] }, updatedAt: timestamp(now) };
  if (progress !== undefined) memory.progress = validateProgress(jsonCopy(progress), memory);
  return memory;
}

export function validateTravelMemory(value, { now } = {}) {
  const memory = jsonCopy(value); timestamp(now);
  if (!exact(memory, ['format', 'version', 'consent', 'query', 'plan', 'confirmedPreferences', 'visits', 'journal', 'updatedAt'], ['progress'])
    || memory.format !== TRAVEL_FORMAT || memory.version !== 1 || typeof memory.consent !== 'boolean'
    || !isTravelTime(memory.updatedAt)) fail();
  // A different device/server clock cannot invalidate a saved document. CAS
  // revisions control account writes; timestamps only order this document's facts.
  memory.query = normalizePlannerInput(memory.query, { places: TRAVEL_PLACES });
  memory.plan = validatePlan(memory.plan, memory.query);
  if (Object.hasOwn(memory, 'progress')) memory.progress = validateProgress(memory.progress, memory);
  const validTime = value => isTravelTime(value) && Date.parse(value) <= Date.parse(memory.updatedAt);
  if (!Array.isArray(memory.visits) || memory.visits.length > 150 || !Array.isArray(memory.confirmedPreferences)
    || memory.confirmedPreferences.length > TRAVEL_PREFERENCE_KEYS.length) fail();
  const visitIds = new Set();
  for (const visit of memory.visits) {
    if (!exact(visit, ['id', 'placeId', 'planId', 'decisionId', 'rating', 'reasons', 'at', 'source'])
      || !token(visit.id) || visitIds.has(visit.id) || !places.has(visit.placeId)
      || visit.planId !== null && !token(visit.planId) || visit.decisionId !== null && !token(visit.decisionId)
      || !Number.isInteger(visit.rating) || visit.rating < 1 || visit.rating > 5 || !validTime(visit.at)
      || visit.source !== 'self-reported' || !Array.isArray(visit.reasons) || new Set(visit.reasons).size !== visit.reasons.length
      || visit.reasons.some(reason => !TRAVEL_VISIT_REASONS.some(option => option.id === reason))) fail();
    visitIds.add(visit.id);
  }
  const keys = new Set();
  for (const preference of memory.confirmedPreferences) {
    if (!exact(preference, ['id', 'key', 'value', 'status', 'confirmedAt', 'source']) || !token(preference.id)
      || !TRAVEL_PREFERENCE_KEYS.includes(preference.key) || keys.has(preference.key) || typeof preference.value !== 'boolean'
      || preference.status !== 'confirmed' || !validTime(preference.confirmedAt)
      || !exact(preference.source, ['kind'], ['feedbackId']) || preference.source.kind !== 'user-confirmation'
      || Object.hasOwn(preference.source, 'feedbackId') && (!token(preference.source.feedbackId) || !visitIds.has(preference.source.feedbackId))) fail();
    keys.add(preference.key);
  }
  validateTravelJournal(memory.journal, { now: memory.updatedAt });
  const facts = new Map(memory.journal.trail.filter(row => row.type === 'life.fact').map(row => [row.id, row]));
  const corrected = new Set(memory.journal.trail.filter(row => row.type === 'life.corrected').map(row => row.targetId));
  for (const visit of memory.visits) {
    const fact = facts.get(visit.id);
    if (!fact || fact.factType !== 'travel.visit' || corrected.has(visit.id)) fail();
    if (visit.decisionId) {
      const exposure = memory.journal.exposures.find(row => row.decisionId === visit.decisionId);
      if (!exposure || exposure.candidateId !== visit.planId || !fact.causes.includes(exposure.id) || Date.parse(visit.at) < Date.parse(exposure.at)) fail();
    }
  }
  for (const preference of memory.confirmedPreferences) {
    const fact = facts.get(preference.id);
    if (!fact || fact.factType !== 'travel.preference' || corrected.has(preference.id)
      || preference.source.feedbackId && !fact.causes.includes(preference.source.feedbackId)) fail();
  }
  for (const outcome of memory.journal.outcomes) {
    const fact = facts.get(outcome.id), exposure = memory.journal.exposures.find(row => row.id === outcome.exposureId);
    if (!fact.causes.some(id => memory.visits.some(visit => visit.id === id && visit.decisionId === exposure.decisionId
      && Date.parse(visit.at) <= Date.parse(outcome.at)))) fail('전체 여행 평가의 방문 근거가 없어요.');
  }
  return memory;
}

export function setTravelConsent(memory, consent, { now } = {}) {
  if (typeof consent !== 'boolean') fail();
  const at = timestamp(now), checked = validateTravelMemory(memory, { now: at });
  return validateTravelMemory({ ...checked, consent, updatedAt: checked.updatedAt > at ? checked.updatedAt : at }, { now: at });
}
export function saveTravelMemory(memory, storage = globalThis.localStorage, options = {}) {
  const checked = validateTravelMemory(memory, options);
  if (!checked.consent) fail('이 기기에 보관하기를 선택한 뒤 저장해 주세요.');
  storage.setItem(TRAVEL_STORAGE_KEY, JSON.stringify(checked));
  return checked;
}
export function loadTravelMemory(storage = globalThis.localStorage, options = {}) {
  const raw = storage.getItem(TRAVEL_STORAGE_KEY);
  if (raw === null) return null;
  if (typeof raw !== 'string' || encoder.encode(raw).byteLength > TRAVEL_MAX_BYTES) fail();
  let value;
  try { value = JSON.parse(raw); } catch { fail('이 기기의 여행 기록을 읽지 못했어요. 원본은 그대로 두었어요.'); }
  const memory = validateTravelMemory(value, options);
  if (!memory.consent) fail('저장 동의를 확인할 수 없어 기록을 열지 않았어요.');
  return memory;
}
export function clearTravelMemory(storage = globalThis.localStorage) { storage.removeItem(TRAVEL_STORAGE_KEY); }

/** Explicit file export is independent of permission to persist in this browser. */
export function exportTravelMemory(memory, { now } = {}) {
  const at = timestamp(now), checked = validateTravelMemory(memory, { now: at });
  delete checked.consent;
  const raw = JSON.stringify({ format: transferFormat, version: 1, exportedAt: at, memory: checked });
  if (encoder.encode(raw).byteLength > TRAVEL_MAX_BYTES) fail('옮길 여행 기록이 512 KB를 넘었어요. 기록을 나눠 주세요.');
  return raw;
}
export function importTravelMemory(raw, { now } = {}) {
  if (typeof raw !== 'string' || encoder.encode(raw).byteLength > TRAVEL_MAX_BYTES) fail('여행 파일은 512 KB까지 불러올 수 있어요.');
  let data;
  try { data = JSON.parse(raw); } catch { fail('JSON 여행 파일을 읽지 못했어요. 현재 기록은 유지했어요.'); }
  data = jsonCopy(data);
  const at = timestamp(now);
  if (!exact(data, ['format', 'version', 'exportedAt', 'memory']) || data.format !== transferFormat || data.version !== 1
    || !isTravelTime(data.exportedAt)
    || !object(data.memory) || Object.hasOwn(data.memory, 'consent')) fail();
  // Import does not transfer the old device's storage permission.
  return validateTravelMemory({ ...data.memory, consent: false }, { now: at });
}

/** Old place opinions are brought in only by this explicit user action. */
export function migrateLegacyTravel(raw, { confirmed = false, query, now } = {}) {
  if (confirmed !== true) fail('이전 기록을 가져오겠다고 선택한 뒤 옮길 수 있어요.');
  const at = timestamp(now), prior = readRealState(raw, { now: at });
  if (!prior) fail('가져올 이전 여행 기록을 읽지 못했어요.');
  let memory = createTravelMemory({ query }, { now: at });
  // Prior selected venues are requests to retain, not a verified current route.
  memory.query.lockedIds = prior.selected.filter(id => places.has(id) && placeById.get(id).category !== 'stay').slice(0, memory.query.stopCount);
  memory.query.preferences = { ...memory.query.preferences, ...Object.fromEntries(prior.interests.filter(key => TRAVEL_PREFERENCE_KEYS.includes(key)).map(key => [key, true])) };
  for (const [placeId, visit] of Object.entries(prior.visits)) {
    memory = recordVisit(memory, { placeId, rating: visit.value === 'liked' ? 5 : 2,
      reasons: visit.reasons.map(reason => reason === 'wait' ? 'crowds' : reason), now: visit.at });
  }
  for (const [key, preference] of Object.entries(prior.categoryPreferences)) {
    if (TRAVEL_PREFERENCE_KEYS.includes(key)) memory = confirmTravelPreference(memory, { key, value: preference.value === 'more', now: at });
  }
  memory.updatedAt = at;
  return validateTravelMemory(memory, { now: at });
}
