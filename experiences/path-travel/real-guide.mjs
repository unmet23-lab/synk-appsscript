import { REAL_PLACES, REAL_META, REAL_CONDITION_CALENDAR } from './real-places.mjs?v=20261019-hours';
import { normalizeRealQuery, evaluateRealConditions } from './real-conditions.mjs?v=20261019-hours';
import * as DomainModule from '../../atlas/domain.js';

const Domain = DomainModule.default ?? globalThis.SynkAtlasDomain;
export const REAL_STORAGE_KEY = 'synk-path-real-places-v1';
export const REAL_STORAGE_MAX_BYTES = 16384;
export const CATEGORIES = Object.freeze([
  { id: 'food', label: '한식 한 끼' },
  { id: 'tea', label: '차와 카페' },
  { id: 'culture', label: '전시와 문화' },
  { id: 'stay', label: '하룻밤 숙소' },
]);
export const REACTION_OPTIONS = Object.freeze([
  { value: 'interested', label: '관심 있어요' }, { value: 'less', label: '덜 보고 싶어요' },
]);
export const VISIT_OPTIONS = Object.freeze([
  { value: 'liked', label: '좋았어요' }, { value: 'disliked', label: '아쉬웠어요' },
]);
export const VISIT_REASONS = Object.freeze([
  { id: 'experience', label: '즐긴 경험' }, { id: 'atmosphere', label: '분위기' },
  { id: 'value', label: '비용 대비 만족' }, { id: 'access', label: '이동·접근' },
  { id: 'wait', label: '대기·혼잡' },
]);
export const CATEGORY_PREFERENCE_OPTIONS = Object.freeze([
  { value: 'more', label: '이 분야를 더 보고 싶어요' }, { value: 'less', label: '이 분야를 덜 보고 싶어요' },
]);
const categories = new Set(CATEGORIES.map(item => item.id));
const places = new Map(REAL_PLACES.map(item => [item.id, item]));
const reasonIds = new Set(VISIT_REASONS.map(item => item.id));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const safeObject = value => plain(value) && Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key));
const exact = (value, keys) => safeObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const clock = value => {
  const at = value ?? new Date().toISOString();
  if (!iso(at)) throw new TypeError('기록 시각을 확인해 주세요.');
  return at;
};
const list = (input, allowed) => [...new Set(Array.isArray(input) ? input.filter(id => typeof id === 'string' && allowed.has(id)) : [])];
const validList = (input, allowed) => Array.isArray(input) && input.length <= allowed.size && new Set(input).size === input.length
  && input.every(id => typeof id === 'string' && allowed.has(id));
const recordValid = (record, options, at, visit = false) => exact(record, visit ? ['value', 'reasons', 'at'] : ['value', 'at'])
  && options.some(option => option.value === record.value) && iso(record.at) && Date.parse(record.at) <= Date.parse(at)
  && (!visit || validList(record.reasons, reasonIds));
function records(input, allowed, options, at, visit = false) {
  if (!safeObject(input)) return {};
  return Object.fromEntries(Object.entries(input).filter(([id, record]) => allowed.has(id) && recordValid(record, options, at, visit))
    .map(([id, record]) => [id, { value: record.value, ...(visit ? { reasons: [...record.reasons] } : {}), at: record.at }]));
}
export function normalizeRealState(input = {}, { now } = {}) {
  const at = clock(now), safe = safeObject(input) ? input : {};
  const legacy = safe.version === 1;
  return {
    version: 2,
    interests: list(safe.interests, categories),
    selected: list(safe.selected, places),
    reactions: legacy ? {} : records(safe.reactions, places, REACTION_OPTIONS, at),
    visits: legacy ? {} : records(safe.visits, places, VISIT_OPTIONS, at, true),
    categoryPreferences: legacy ? {} : records(safe.categoryPreferences, categories, CATEGORY_PREFERENCE_OPTIONS, at),
    feedbackConsent: !legacy && safe.feedbackConsent === true,
  };
}

// Product records are the person's own opinions, never measured venue features.
// Core receives only place/category identity plus these explicit declarations.
const scope = Object.freeze({ domain: 'PATH', workspace: 'path-real-jongno', subject: 'local-visitor' });
const fieldSpecs = [
  ...REAL_PLACES.map(place => ({ id: `reaction.${place.id}`, weight: 2 })),
  ...REAL_PLACES.map(place => ({ id: `visit.${place.id}`, weight: 3 })),
  ...CATEGORIES.map(category => ({ id: `category.${category.id}`, weight: 1 })),
];
const contract = Object.freeze({ id: 'path-real-opinions', version: '1', purpose: 'order-real-places',
  fields: fieldSpecs.map(({ id }) => ({ id, kind: 'boolean' })),
  criteria: fieldSpecs.map(({ id, weight }) => ({ id, field: id, feature: id, weight, prefer: 'match' })),
});
function opinionRows(state) {
  return [
    ...Object.entries(state.reactions).map(([id, record]) => ({ field: `reaction.${id}`, record, positive: record.value === 'interested' })),
    ...Object.entries(state.visits).map(([id, record]) => ({ field: `visit.${id}`, record, positive: record.value === 'liked' })),
    ...Object.entries(state.categoryPreferences).map(([id, record]) => ({ field: `category.${id}`, record, positive: record.value === 'more' })),
  ];
}
export function rankRealPlaces(input = {}, { now, query = {}, order = 'personalized' } = {}) {
  const at = clock(now), state = normalizeRealState(input, { now: at });
  const checkedQuery = normalizeRealQuery(query);
  const filtered = REAL_PLACES.filter(place => !state.interests.length || state.interests.includes(place.category));
  const result = Domain.decide({ contract, scope, at,
    observations: opinionRows(state).map(({ field, record, positive }) => ({
      id: field, field, scope, contract: { id: contract.id, version: contract.version, purpose: contract.purpose },
      value: positive, source: 'declared', at: record.at,
      // Explicit opinions remain until changed or removed; no silent 30-day expiry.
      until: '9999-12-31T23:59:59.999Z', refs: [field],
    })),
    candidates: filtered.map(place => ({ id: place.id, features: Object.fromEntries(fieldSpecs.map(({ id }) => [id,
      id.startsWith('category.') ? id === `category.${place.category}` : id.endsWith(`.${place.id}`),
    ])) })),
  });
  const scores = new Map(result.ranked.map(item => [item.id, item.score]));
  return filtered.map((place, index) => {
    const reasons = [];
    const reaction = state.reactions[place.id], visit = state.visits[place.id], category = state.categoryPreferences[place.category];
    if (reaction) reasons.push({ kind: 'reaction', at: reaction.at,
      label: `이 장소에 ‘${REACTION_OPTIONS.find(option => option.value === reaction.value).label}’를 남겼어요.` });
    if (visit) reasons.push({ kind: 'visit', at: visit.at,
      label: `방문 후 ‘${VISIT_OPTIONS.find(option => option.value === visit.value).label}’를 남겼어요.` });
    if (category) reasons.push({ kind: 'category', at: category.at,
      label: `‘${CATEGORIES.find(item => item.id === place.category).label}’ 분야를 ${category.value === 'more' ? '더' : '덜'} 보고 싶다고 했어요.` });
    const condition = evaluateRealConditions(place, checkedQuery, { now: at, calendar: REAL_CONDITION_CALENDAR });
    return { place, score: scores.get(place.id), reasons, condition, index };
  }).sort((a, b) => {
    const priority = { none: 0, matched: 0, unknown: 1, unmatched: 2 };
    return priority[a.condition.status] - priority[b.condition.status]
      || (order === 'original' ? 0 : b.score - a.score) || a.index - b.index;
  }).map(({ index, ...row }) => row);
}
export function findRealPlaces(input = {}, options = {}) {
  return rankRealPlaces(input, options).map(row => row.place);
}
function updateRecord(input, { key, id, allowed, options, value, reasons, now, visit = false }) {
  const at = clock(now), state = normalizeRealState(input, { now: at });
  if (!allowed.has(id) || (value !== null && !options.some(option => option.value === value))) throw new TypeError('기록할 장소·분야와 응답을 확인해 주세요.');
  if (value === null) delete state[key][id];
  else {
    if (visit && !validList(reasons, reasonIds)) throw new TypeError('방문 의견의 이유를 확인해 주세요.');
    const prior = state[key][id];
    if (prior?.value === value && (!visit || JSON.stringify(prior.reasons) === JSON.stringify(reasons))) return state;
    state[key][id] = { value, ...(visit ? { reasons: [...reasons] } : {}), at };
  }
  return state;
}
export function setRealReaction(input, { placeId, value, now } = {}) {
  return updateRecord(input, { key: 'reactions', id: placeId, allowed: places, options: REACTION_OPTIONS, value, now });
}
export function setRealVisit(input, { placeId, value, reasons = [], now } = {}) {
  return updateRecord(input, { key: 'visits', id: placeId, allowed: places, options: VISIT_OPTIONS, value, reasons, now, visit: true });
}
export function setRealCategoryPreference(input, { category, value, now } = {}) {
  return updateRecord(input, { key: 'categoryPreferences', id: category, allowed: categories, options: CATEGORY_PREFERENCE_OPTIONS, value, now });
}
export function clearRealFeedback(input, { now } = {}) {
  return { ...normalizeRealState(input, { now }), reactions: {}, visits: {}, categoryPreferences: {}, feedbackConsent: false };
}
export function readRealState(raw, { now } = {}) {
  if (typeof raw !== 'string' || raw.length > REAL_STORAGE_MAX_BYTES || new TextEncoder().encode(raw).byteLength > REAL_STORAGE_MAX_BYTES) return null;
  try {
    const parsed = JSON.parse(raw), at = clock(now);
    if (!safeObject(parsed) || parsed.consent !== true) return null;
    if (parsed.version === 1) {
      if (!exact(parsed, ['version', 'interests', 'selected', 'consent']) || !validList(parsed.interests, categories) || !validList(parsed.selected, places)) return null;
      return normalizeRealState(parsed, { now: at });
    }
    if (!exact(parsed, ['version', 'interests', 'selected', 'reactions', 'visits', 'categoryPreferences', 'feedbackConsent', 'consent'])
      || parsed.version !== 2 || typeof parsed.feedbackConsent !== 'boolean' || !validList(parsed.interests, categories) || !validList(parsed.selected, places)) return null;
    for (const [key, allowed, options, visit] of [['reactions', places, REACTION_OPTIONS, false], ['visits', places, VISIT_OPTIONS, true], ['categoryPreferences', categories, CATEGORY_PREFERENCE_OPTIONS, false]]) {
      if (!safeObject(parsed[key]) || Object.entries(parsed[key]).some(([id, record]) => !allowed.has(id) || !recordValid(record, options, at, visit))) return null;
      if (!parsed.feedbackConsent && Object.keys(parsed[key]).length) return null;
    }
    return normalizeRealState(parsed, { now: at });
  } catch { return null; }
}
export function serializeRealState(input, { now } = {}) {
  const state = normalizeRealState(input, { now });
  if (!state.feedbackConsent) { state.reactions = {}; state.visits = {}; state.categoryPreferences = {}; }
  const raw = JSON.stringify({ ...state, consent: true });
  if (new TextEncoder().encode(raw).byteLength > REAL_STORAGE_MAX_BYTES) throw new TypeError('저장할 기록이 너무 큽니다.');
  return raw;
}
export function mapLink(place) {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${place.name} ${place.address}`);
  return url.href;
}
export function formatRealQuery(input = {}) {
  const query = normalizeRealQuery(input);
  return `${query.date || '날짜 미정'} · ${query.time ? query.time + ' 도착 (서울 시간)' : '시간 미정'} · ${query.budget === null ? '예산 미정' : '한 곳 성인 1인 ' + query.budget.toLocaleString('ko-KR') + '원'}`;
}
export function exportRealMemo(input, { now, query = {} } = {}) {
  const at = clock(now), state = normalizeRealState(input, { now: at });
  const checkedQuery = normalizeRealQuery(query);
  const hasQuery = Boolean(checkedQuery.date || checkedQuery.time || checkedQuery.budget !== null);
  const chosen = state.selected.map(id => places.get(id));
  const koreaTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));
  return [
    'SYNK PATH · 종로에서 고른 장소',
    `메모 만든 시각 (한국): ${koreaTime}`,
    `공식 안내 확인일: ${REAL_META.checkedAt}`,
    '직접 담은 순서의 방문 후보입니다. 이동 경로·시간·총예산이나 예약을 확정한 일정이 아닙니다.',
    '영업·휴관·메뉴 가격·객실 요금은 방문일에 공식 안내에서 다시 확인해 주세요.',
    '',
    `관심 분야: ${CATEGORIES.filter(item => state.interests.includes(item.id)).map(item => item.label).join(', ') || '전체 둘러보기'}`,
    ...(hasQuery ? [`이번에 비교한 조건: ${formatRealQuery(checkedQuery)}`, '각 장소의 도착 시각과 먹거리·일반 관람 표시 금액을 비교한 결과입니다. 숙박·교통·추가 주문과 총여행비는 제외합니다.', '정기 안내와 확인일을 기준으로 비교하며, 미확인·오래된 자료는 확인 필요로 남깁니다. 조건은 브라우저 저장 기록에 포함하지 않습니다.'] : []),
    '',
    ...chosen.flatMap((place, index) => {
      const condition = hasQuery ? evaluateRealConditions(place, checkedQuery, { now: at, calendar: REAL_CONDITION_CALENDAR }) : null;
      const priceSource = condition?.checks.budget.sourceUrl || place.conditions?.price?.sourceUrl;
      const visitSource = condition?.checks.schedule.sourceUrl || place.visitSourceUrl;
      return [
      `${index + 1}. ${place.name}`, place.description, `주소: ${place.address}`,
      `비용: ${place.costNote}`, `방문 전 확인: ${place.visitNote}`,
      ...(condition ? [`조건 비교: ${condition.label}`, ...condition.reasons.map(reason => `- ${reason}`)] : []),
      ...(priceSource ? [`가격 공식 출처: ${priceSource}`] : []),
      ...(place.openingNote ? [`운영·휴관 안내: ${place.openingNote}`] : []),
      ...(visitSource ? [`운영·방문 공식 출처: ${visitSource}`] : []),
      ...(place.visitNoticeSourceUrl && place.visitNoticeSourceUrl !== visitSource ? [`기간별 운영 공식 공지: ${place.visitNoticeSourceUrl}`] : []),
      ...(place.accessNote ? [`찾아가기: ${place.accessNote}`] : []),
      ...(place.accessSourceUrl ? [`찾아가기 공식 출처: ${place.accessSourceUrl}`] : []),
      `안내 확인일: ${place.verifiedAt ?? place.checkedAt}`,
      `공식 안내 (${place.sourceLabel}): ${place.sourceUrl}`, `지도 검색: ${mapLink(place)}`, '',
      ];
    }),
    '이 목록은 공식 안내를 확인해 모은 일부 후보이며 업체 제휴·예약·실시간 영업 확인을 뜻하지 않습니다.',
  ].join('\n');
}
