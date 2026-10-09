import * as TrailModule from '../../atlas/trail-life.js';
import * as TemperModule from '../../atlas/temper-outcomes.js';

const Trail = TrailModule.default ?? globalThis.SynkTrailLife;
const Temper = TemperModule.default ?? globalThis.SynkTemperOutcomes;
export const TRAVEL_SCOPE = Object.freeze({ domain: 'PATH', workspace: 'path-travel-v4', subject: 'local-visitor' });
const outcomeScope = Object.freeze({ domain: 'PATH', workspace: 'path-travel-v4', purpose: 'own-trip-review' });
export const TRAVEL_OUTCOME_CONTRACT = Object.freeze({ id: 'path-trip-self-report', version: '1', scope: outcomeScope,
  outcome: { id: 'visit-satisfaction', kind: 'numeric', direction: 'higher', range: [1, 5], windowMs: 31 * 86400000 } });
const contractRef = { id: TRAVEL_OUTCOME_CONTRACT.id, version: TRAVEL_OUTCOME_CONTRACT.version };
const policies = [{ id: 'path-real-guide', version: '3' }, { id: 'path-travel', version: '4' }];
export const TRAVEL_PREFERENCE_KEYS = Object.freeze(['indoor', 'outdoor', 'food', 'tea', 'culture', 'history', 'art', 'walk', 'quiet', 'vegetarian', 'stepFree',
  'noodles', 'dumplings', 'soup', 'templeFood', 'marketFood', 'coffee', 'bakery', 'traditionalTea']);
export const TRAVEL_VISIT_REASONS = Object.freeze([
  { id: 'experience', label: '즐긴 경험' }, { id: 'atmosphere', label: '분위기' },
  { id: 'value', label: '가격 대비 만족' }, { id: 'walking', label: '걷는 양' },
  { id: 'crowds', label: '대기·혼잡' }, { id: 'access', label: '이동·접근' },
]);
const clone = value => JSON.parse(JSON.stringify(value));
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
export const isTravelTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const fail = message => { throw new TypeError(message); };
function atTime(now) { const at = now ?? new Date().toISOString(); if (!isTravelTime(at)) fail('기록 시각을 확인해 주세요.'); return at; }
function nextId(memory, kind) { return `${kind}-${memory.journal.trail.length + 1}`; }
function addFact(memory, kind, causes, id) {
  memory.journal.trail = Trail.append(memory.journal.trail, { schema: 1, id, scope: { ...TRAVEL_SCOPE },
    seq: memory.journal.trail.length + 1, type: 'life.fact', factType: kind, causes, revisions: {}, knownBy: [] });
}
function touch(memory, at) { memory.updatedAt = at; return memory; }
const base = (id, at) => ({ id, subject: TRAVEL_SCOPE.subject, scope: { ...outcomeScope }, at, contract: { ...contractRef } });

export function validateTravelJournal(journal, { now = new Date().toISOString() } = {}) {
  if (!journal || Object.keys(journal).sort().join(',') !== 'decisions,exposures,outcomes,trail'
    || Object.values(journal).some(rows => !Array.isArray(rows) || rows.length > 600)) fail('여행 기록의 연결 형식을 확인해 주세요.');
  const summary = Trail.summarize(journal.trail, { scope: TRAVEL_SCOPE });
  const validFacts = new Map(summary.facts.map(fact => [fact.id, fact]));
  for (const [rows, type] of [[journal.decisions, 'travel.decision'], [journal.exposures, 'travel.exposure'], [journal.outcomes, 'travel.outcome']]) {
    for (const row of rows) {
      const fact = validFacts.get(row.id);
      if (!fact || fact.factType !== type) fail('선택·노출·방문 기록의 출처가 이어지지 않아요.');
      const parent = row.decisionId ?? row.exposureId;
      if (parent && !fact.causes.includes(parent)) fail('여행 기록의 앞선 사건을 확인해 주세요.');
    }
  }
  Temper.evaluateOutcomes({ contract: TRAVEL_OUTCOME_CONTRACT, ...journal, policies, subjects: [TRAVEL_SCOPE.subject], asOf: atTime(now), strictProvenance: true });
  return clone(journal);
}

/** Called at the decision boundary. It is not an assertion that a screen was shown. */
export function recordPlanDecision(input, { planId, candidateIds = [planId], now } = {}) {
  const memory = clone(input), at = atTime(now);
  if (!token(planId) || !Array.isArray(candidateIds) || !candidateIds.length || candidateIds.length > 64
    || !candidateIds.every(token) || !candidateIds.includes(planId) || new Set(candidateIds).size !== candidateIds.length) fail('선택할 여행안을 확인해 주세요.');
  const id = nextId(memory, 'decision');
  memory.journal.decisions.push({ ...base(id, at), policy: { ...policies[1] }, candidateIds: [...candidateIds], selectedId: planId });
  addFact(memory, 'travel.decision', [], id);
  return touch(memory, at);
}

/** The UI calls this after the selected itinerary is actually visible. */
export function recordPlanExposure(input, { decisionId, now } = {}) {
  const memory = clone(input), at = atTime(now);
  const decision = memory.journal.decisions.find(row => row.id === decisionId);
  if (!decision || Date.parse(at) < Date.parse(decision.at)) fail('먼저 선택한 여행안을 확인해 주세요.');
  if (memory.journal.exposures.some(row => row.decisionId === decisionId)) return memory;
  const id = nextId(memory, 'exposure');
  memory.journal.exposures.push({ ...base(id, at), decisionId, candidateId: decision.selectedId });
  addFact(memory, 'travel.exposure', [decisionId], id);
  return touch(memory, at);
}

/** A self-report about one visit. Reasons are never converted into venue facts. */
export function recordVisit(input, { placeId, planId = null, decisionId = null, rating, reasons = [], now } = {}) {
  const memory = clone(input), at = atTime(now);
  if (!token(placeId) || planId !== null && !token(planId) || !Number.isInteger(rating) || rating < 1 || rating > 5
    || !Array.isArray(reasons) || new Set(reasons).size !== reasons.length
    || reasons.some(id => !TRAVEL_VISIT_REASONS.some(item => item.id === id))) fail('방문한 장소와 평가를 확인해 주세요.');
  const exposure = decisionId && memory.journal.exposures.find(row => row.decisionId === decisionId);
  if (decisionId && (!exposure || planId !== exposure.candidateId || Date.parse(at) < Date.parse(exposure.at))) fail('화면에서 확인한 여행안의 방문만 연결할 수 있어요.');
  const id = nextId(memory, 'visit');
  memory.visits.push({ id, placeId, planId, decisionId, rating, reasons: [...reasons], at, source: 'self-reported' });
  addFact(memory, 'travel.visit', exposure ? [exposure.id] : [], id);
  // Individual venue ratings remain venue self-reports. They are not itinerary satisfaction.
  return touch(memory, at);
}

/** Explicit overall itinerary review, separate from a single venue's rating. */
export function recordTripOutcome(input, { decisionId, rating, now } = {}) {
  const memory = clone(input), at = atTime(now);
  const exposure = memory.journal.exposures.find(row => row.decisionId === decisionId);
  if (!exposure || !Number.isInteger(rating) || rating < 1 || rating > 5 || Date.parse(at) < Date.parse(exposure.at)
    || memory.journal.outcomes.some(row => row.exposureId === exposure.id)) fail('이미 평가했거나 화면에서 확인하지 않은 여행안이에요.');
  const linkedVisits = memory.visits.filter(row => row.decisionId === decisionId);
  if (!linkedVisits.length) fail('여행한 장소를 기록한 뒤 전체 여행을 평가해 주세요.');
  if (linkedVisits.length > 63 || linkedVisits.some(row => Date.parse(row.at) > Date.parse(at))) fail('전체 여행 평가에 연결할 방문 기록을 확인해 주세요.');
  const id = nextId(memory, 'outcome');
  memory.journal.outcomes.push({ ...base(id, at), exposureId: exposure.id, value: rating });
  addFact(memory, 'travel.outcome', [exposure.id, ...linkedVisits.map(row => row.id)], id);
  return touch(memory, at);
}

export function proposeVisitPreference(visit) {
  if (!visit || !Array.isArray(visit.reasons) || !Number.isInteger(visit.rating)) return [];
  const ideas = [];
  if (visit.rating <= 2 && visit.reasons.includes('walking')) ideas.push({ key: 'walk', value: false, label: '앞으로도 걷는 일정이 적은 편을 더 좋아하시나요?' });
  if (visit.rating <= 2 && visit.reasons.includes('crowds')) ideas.push({ key: 'quiet', value: true, label: '앞으로도 조용한 분위기를 더 중요하게 볼까요?' });
  return ideas.map(idea => ({ ...idea, feedbackId: visit.id, status: 'suggested' }));
}

export function confirmTravelPreference(input, { key, value, feedbackId = null, now } = {}) {
  const memory = clone(input), at = atTime(now);
  if (!TRAVEL_PREFERENCE_KEYS.includes(key) || typeof value !== 'boolean'
    || feedbackId !== null && !memory.visits.some(visit => visit.id === feedbackId)) fail('확인할 취향과 근거를 다시 골라 주세요.');
  const previous = memory.confirmedPreferences.find(row => row.key === key);
  if (previous) invalidateFact(memory, previous.id);
  const id = nextId(memory, 'preference');
  memory.confirmedPreferences = memory.confirmedPreferences.filter(row => row.key !== key);
  memory.confirmedPreferences.push({ id, key, value, status: 'confirmed', confirmedAt: at, source: { kind: 'user-confirmation', ...(feedbackId ? { feedbackId } : {}) } });
  addFact(memory, 'travel.preference', feedbackId ? [feedbackId] : [], id);
  return touch(memory, at);
}
function invalidateFact(memory, targetId) {
  memory.journal.trail = Trail.append(memory.journal.trail, { schema: 1, id: nextId(memory, 'withdrawal'), scope: { ...TRAVEL_SCOPE },
    seq: memory.journal.trail.length + 1, type: 'life.corrected', targetId });
}
export function removeTravelPreference(input, key, { now } = {}) {
  const memory = clone(input), at = atTime(now), previous = memory.confirmedPreferences.find(row => row.key === key);
  if (previous) invalidateFact(memory, previous.id);
  memory.confirmedPreferences = memory.confirmedPreferences.filter(row => row.key !== key);
  return touch(memory, at);
}

/** Delete a self-report and every inference/result whose source was that report.
 * Trail retains only content-free correction identifiers; rating/reasons are erased.
 */
export function removeTravelVisit(input, visitId, { now } = {}) {
  const memory = clone(input), at = atTime(now), visit = memory.visits.find(row => row.id === visitId);
  if (!visit) return memory;
  invalidateFact(memory, visit.id);
  const active = new Set(Trail.summarize(memory.journal.trail, { scope: TRAVEL_SCOPE }).facts.map(row => row.id));
  memory.visits = memory.visits.filter(row => active.has(row.id));
  memory.confirmedPreferences = memory.confirmedPreferences.filter(row => active.has(row.id));
  memory.journal.outcomes = memory.journal.outcomes.filter(row => active.has(row.id));
  return touch(memory, at);
}

export function editTravelVisit(input, visitId, { rating, reasons = [], now } = {}) {
  const prior = input.visits.find(row => row.id === visitId);
  if (!prior) fail('수정할 방문 기록을 찾지 못했어요.');
  const memory = removeTravelVisit(input, visitId, { now });
  return recordVisit(memory, { placeId: prior.placeId, planId: prior.planId, decisionId: prior.decisionId, rating, reasons, now });
}

export function clearTravelHistory(input, { now } = {}) {
  const memory = clone(input);
  memory.visits = []; memory.confirmedPreferences = [];
  memory.journal = { trail: [], decisions: [], exposures: [], outcomes: [] };
  return touch(memory, atTime(now));
}

export function summarizeTravelMemory(memory, { now } = {}) {
  const at = atTime(now);
  validateTravelJournal(memory.journal, { now: at });
  const result = Temper.evaluateOutcomes({ contract: TRAVEL_OUTCOME_CONTRACT, ...memory.journal,
    policies, subjects: [TRAVEL_SCOPE.subject], asOf: at, strictProvenance: true });
  return { trail: Trail.summarize(memory.journal.trail, { scope: TRAVEL_SCOPE }), temper: result,
    visits: memory.visits.length, confirmedPreferences: memory.confirmedPreferences.length,
    effectEstablished: false, label: '내가 남긴 방문 의견이에요. 추천 만족도 향상은 아직 검증하지 않았어요.' };
}
