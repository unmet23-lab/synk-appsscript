import * as DomainModule from '../../atlas/domain.js';
import * as AskModule from '../../atlas/ask.js';
import * as TravelModule from '../../atlas/travel.js';
import { CANDIDATES, CATALOG_META, quoteTransportation } from './catalog.mjs';
import { DEFAULT_PROFILE, DETAIL_FIELDS, PREFERENCE_CONTRACT, DOMAIN_SCOPE, INTERPRETATION_VERSION, createPersonalization, resolvePersonalization, summarizePersonalization, setPreference, valueLabel } from './profile.mjs';
export { DEFAULT_PROFILE } from './profile.mjs';

const Domain = DomainModule.default ?? globalThis.SynkAtlasDomain;
const Ask = AskModule.default ?? globalThis.SynkAsk;
const Travel = TravelModule.default ?? globalThis.SynkAtlasTravel;
export const VERSION = 'path-travel-local-3';
export const PRESETS = Object.freeze([
  { id: 'food', label: '음식에 더 쓰기', description: '숙소는 실속 있게, 저녁은 특별하게.', profile: { ...DEFAULT_PROFILE, priority: 'food', food: 'fine', night: 'none', hotel: 'central' } },
  { id: 'rest', label: '숙면이 먼저', description: '조용한 숙소와 여유 있는 하루.', profile: { ...DEFAULT_PROFILE, priority: 'hotel', food: 'local', night: 'quiet', hotel: 'quiet', transport: 'taxi' } },
  { id: 'night', label: '밤까지 즐기기', description: '클럽을 즐기고 숙소까지 편하게.', profile: { ...DEFAULT_PROFILE, priority: 'balanced', food: 'local', night: 'club', pace: 'full', transport: 'taxi' } },
  { id: 'light', label: '가볍게 다녀오기', description: '부담 없는 식사, 술 없이 쉬는 저녁.', profile: { ...DEFAULT_PROFILE, budget: 160000, priority: 'balanced', food: 'local', night: 'none', alcohol: false } },
]);
const ENUMS = {
  priority: ['hotel', 'food', 'balanced'], food: ['any', 'local', 'fine', 'cafe'],
  night: ['any', 'none', 'quiet', 'live', 'club'], pace: ['easy', 'full'],
  transport: ['walk', 'transit', 'taxi'], hotel: ['any', 'quiet', 'central'],
};
const AT = '2026-10-06T00:00:00.000Z';
const FIXTURE_SOURCE = Object.freeze({ kind: 'fixture', checkedAt: AT, validUntil: '2036-10-06T00:00:00.000Z' });
const scope = DOMAIN_SCOPE;
const clone = value => JSON.parse(JSON.stringify(value));
const bounded = value => Math.min(1, Math.max(0, value));
const kinds = { hotel: '숙소', lunch: '점심', activity: '오후', dinner: '저녁', night: '밤', transfer: '이동', rest: '휴식' };

export function normalizeProfile(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('여행 조건을 다시 확인해 주세요.');
  if (Object.keys(input).some(key => !Object.hasOwn(DEFAULT_PROFILE, key))) throw new TypeError('지원하지 않는 여행 조건이 있어요.');
  const result = { ...DEFAULT_PROFILE, ...input };
  if (!Number.isSafeInteger(result.budget) || result.budget < 30000 || result.budget > 1000000) throw new TypeError('총예산은 3만~100만 원 사이의 정수로 입력해 주세요.');
  if (![9, 11].includes(result.dayStart)) throw new TypeError('출발은 오전 9시 또는 11시로 골라 주세요.');
  for (const [key, options] of Object.entries(ENUMS)) if (!options.includes(result[key])) throw new TypeError(`여행 조건을 확인해 주세요: ${key}`);
  for (const key of ['rain', 'alcohol']) if (typeof result[key] !== 'boolean') throw new TypeError('날씨와 음주 선택을 확인해 주세요.');
  return result;
}

export const formatMoney = amount => new Intl.NumberFormat('ko-KR').format(amount) + '원';
export function formatTime(minutes) {
  return (minutes >= 1440 ? '다음 날 ' : '') + String(Math.floor(minutes / 60) % 24).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

function fitWindow(windows, earliest, duration) {
  for (const window of [...windows].sort((a, b) => a.start - b.start)) {
    const start = Math.max(earliest, window.start);
    if (start + duration <= window.end) return start;
  }
  return null;
}

function schedule(profile, venues) {
  const { hotel, lunch, activity, dinner, night } = venues;
  const chosen = [lunch, activity, dinner, ...(night ? [night] : []), hotel];
  const items = [], stops = [];
  let cursor = profile.dayStart * 60, from = 'station', transfers = 0;
  const earliest = { lunch: 11 * 60 + 30, activity: 13 * 60, dinner: 17 * 60 + 30, night: 19 * 60, hotel: 15 * 60 };
  const add = (item, stop) => { items.push(item); stops.push(stop); };
  const restUntil = until => {
    if (until <= cursor) return;
    const id = `rest-${items.length}`, duration = until - cursor;
    add({ id, kind: 'rest', start: cursor, end: until, cost: { amount: 0, currency: 'KRW', status: 'known' }, walkMinutes: 0, requirements: {}, source: FIXTURE_SOURCE },
      { id, name: '자유시간 · 쉬어 가기', kind: 'rest', area: typeof from === 'object' ? from.area : '서울 도심', start: cursor, end: until, time: formatTime(cursor), cost: 0, duration, reason: '다음 일정 전까지 비워 둔 시간이에요. 추가 소비는 계산에 포함하지 않았어요.', walkMinutes: 0 });
    cursor = until;
  };
  for (const venue of chosen) {
    const route = quoteTransportation(from, venue, profile.transport);
    const transferId = `transfer-${transfers++}`;
    const walkMinutes = route.walkMinutes ?? (profile.transport === 'walk' ? route.minutes : profile.transport === 'taxi' ? 2 : 8);
    add({ id: transferId, kind: 'transfer', start: cursor, end: cursor + route.minutes, cost: { amount: route.cost, currency: 'KRW', status: 'known' }, walkMinutes, requirements: {}, source: FIXTURE_SOURCE },
      { id: transferId, name: profile.transport === 'walk' ? '걸어서 이동' : profile.transport === 'taxi' ? '택시로 이동' : '대중교통으로 이동', kind: 'transfer', area: `${typeof from === 'object' ? from.area : '서울역 출발'} → ${venue.area}`, start: cursor, end: cursor + route.minutes, time: formatTime(cursor), cost: route.cost, duration: route.minutes, reason: '시험용 이동시간과 요금이에요. 실제 길안내가 아니에요.', walkMinutes });
    cursor += route.minutes;
    const slot = fitWindow(venue.openWindows, Math.max(cursor, earliest[venue.type] ?? cursor), venue.durationMinutes);
    if (slot === null) return null;
    from = venue;
    restUntil(slot);
    const intrinsicWalk = venue.type === 'activity' ? venue.traits.activity.walkMinutes : 0;
    if (!Number.isFinite(intrinsicWalk)) return null;
    add({ id: venue.id, kind: venue.type, start: cursor, end: cursor + venue.durationMinutes,
      cost: { amount: venue.price, currency: 'KRW', status: Number.isSafeInteger(venue.price) ? 'known' : 'unknown' },
      walkMinutes: intrinsicWalk, requirements: { indoor: venue.indoor, noAlcohol: !venue.requiresAlcohol }, source: FIXTURE_SOURCE },
    { id: venue.id, name: venue.name, kind: venue.type, area: venue.area, start: cursor, end: cursor + venue.durationMinutes,
      time: formatTime(cursor), cost: venue.price, duration: venue.durationMinutes, reason: venue.description, walkMinutes: intrinsicWalk });
    cursor += venue.durationMinutes;
    if (venue.type === 'activity' && profile.pace === 'easy') restUntil(cursor + 40);
  }
  return { id: chosen.map(item => item.id).join('.'), items, stops, venues };
}

function constructBundles(profile) {
  const byType = type => CANDIDATES.filter(venue => venue.type === type);
  const bundles = [];
  const nights = [null, ...byType('night').filter(venue => venue.nightStyle !== 'none')];
  for (const hotel of byType('hotel')) for (const lunch of byType('lunch'))
    for (const activity of byType('activity')) for (const dinner of byType('dinner')) for (const night of nights) {
      const bundle = schedule(profile, { hotel, lunch, activity, dinner, night });
      if (bundle) bundles.push(bundle);
    }
  return bundles;
}

function policy(profile, summary) {
  const active = summary.entries.filter(entry => entry.status === 'declared' && entry.mode !== 'ignore' && !(entry.field === 'vegetarian' && entry.value === false));
  const details = new Map(DETAIL_FIELDS.map(field => [field.id, field]));
  const baseFeatures = new Set(['food','hotel','night','priority','budget']);
  const criteria = active.filter(entry => details.has(entry.field) || baseFeatures.has(entry.field)).map(entry => ({
    id: entry.field, field: entry.field, feature: entry.field, weight: entry.importance * (details.has(entry.field) ? 3 : 2),
    required: entry.mode === 'require', prefer: details.get(entry.field)?.comparison ?? (entry.field === 'budget' ? 'at-most' : 'match'),
  }));
  const has = field => active.some(entry => entry.field === field);
  // Defaults and example presets are product settings, never declarations about a person.
  const weights = {
    policyHotel: has('hotel') ? 0 : profile.priority === 'hotel' ? 8 : 3,
    policyFood: has('food') ? 0 : profile.priority === 'food' ? 8 : 3,
    policyNight: has('night') || profile.night === 'any' ? 0 : 10,
    policyValue: profile.priority === 'balanced' ? 3 : 1,
    policyConvenience: profile.pace === 'easy' ? 3 : 1,
  };
  return { ...PREFERENCE_CONTRACT, criteria, objectives: Object.entries(weights).map(([feature,weight])=>({id:feature,feature,range:[0,1],weight,prefer:'higher'})) };
}

function detailActuals(bundle, evaluation) {
  const {hotel,lunch,dinner,activity,night}=bundle.venues;
  const both = key => [lunch.traits.food[key],dinner.traits.food[key]];
  const numeric = (values,reduce) => values.every(value=>typeof value==='number'&&Number.isFinite(value)) ? reduce(values) : undefined;
  const foodMax = key => numeric(both(key), values=>Math.max(...values));
  const veg=both('vegetarian');
  const facts={
    hotelNoise:hotel.traits.hotel.noiseLevel, hotelCleanliness:hotel.traits.hotel.cleanliness,hotelCentrality:hotel.traits.hotel.centrality,hotelMaxPrice:hotel.price,
    spice:foodMax('spiceLevel'),vegetarian:veg.includes(false)?false:veg.every(value=>value===true)?true:undefined,
    foodNovelty:numeric(both('novelty'),values=>values.reduce((a,b)=>a+b,0)/values.length),maxWait:foodMax('waitMinutes'),
    mealMaxPrice:Math.max(lunch.price,dinner.price),crowd:activity.traits.activity.crowdLevel,activityIndoor:activity.indoor,
    nightEnergy:night?night.traits.night.energy:0,nightMusic:night?night.traits.night.music:'none',
    conversation:night?night.traits.night.conversationFriendly:undefined,
    walkLimit:evaluation.walkMinutes,returnBy:bundle.items.at(-1).end,
  };
  return Object.fromEntries(Object.entries(facts).filter(([,value])=>value!==null&&value!==undefined&&value!=='unknown'));
}

function features(bundle, evaluation, profile) {
  const {hotel,lunch,dinner,night}=bundle.venues;
  const best = (keys,score) => [...keys].sort((a,b)=>score(b)-score(a))[0];
  const foodFeature=profile.food==='any'?'balanced':profile.food;
  const hotelFeature=profile.hotel==='any'?(profile.priority==='hotel'?'quiet':'balanced'):profile.hotel;
  const ratio=(lunch.price+dinner.price)/evaluation.total;
  return {...detailActuals(bundle,evaluation),
    budget:evaluation.total, dayStart:bundle.items[0].start/60, transport:profile.transport, pace:profile.pace,
    rain:profile.rain, alcohol:profile.alcohol, food:best(['local','fine','cafe'],key=>(lunch.features[key]+dinner.features[key])/2),
    hotel:best(['quiet','central'],key=>hotel.features[key]),night:night?.nightStyle??'none',
    priority:ratio>0.35?'food':hotel.price/evaluation.total>0.7?'hotel':'balanced',
    policyHotel:hotel.features[hotelFeature]??0,policyFood:((lunch.features[foodFeature]??0)+(dinner.features[foodFeature]??0))/2,
    policyNight:Number(profile.night===(night?.nightStyle??'none')),policyValue:bounded(1-evaluation.total/profile.budget),
    policyConvenience:bounded(1-evaluation.walkMinutes/(profile.pace==='easy'?100:220)),
  };
}

function fitFor(entry, actual) {
  if(actual===undefined)return 'unknown';
  const spec=DETAIL_FIELDS.find(field=>field.id===entry.field);
  const compare=spec?.comparison??(entry.field==='budget'?'at-most':'match');
  const passes=compare==='at-most'?actual<=entry.value:compare==='at-least'?actual>=entry.value:typeof actual==='number'?Math.abs(actual-entry.value)<=0.15:actual===entry.value;
  return passes?'met':'tradeoff';
}

function attachEvidence(plan, ranked, summary, candidateFeatures, understanding) {
  const reasons=new Map(ranked.reasons.map(reason=>[reason.field,reason]));
  plan.fitDetails=summary.entries.filter(entry=>entry.status==='declared'&&entry.mode!=='ignore'&& !(entry.field==='vegetarian'&&entry.value===false)).map(entry=>{
    const actual=candidateFeatures[entry.field];const reason=reasons.get(entry.field);
    return {field:entry.field,label:entry.label,wanted:entry.labelValue,actual:actual===undefined?'자료 미확인':valueLabel(entry.field,actual),
      fit:fitFor(entry,actual),mode:entry.mode,importance:entry.importance,evidence:reason?.evidence??understanding.fields.find(field=>field.id===entry.field)?.evidence??[],
      source:entry.source,duration:entry.duration,eventId:entry.eventId,contribution:reason?.contribution??0,
      origin:entry.origin,until:entry.until,...(entry.sourceQuotes?.length?{sourceQuotes:clone(entry.sourceQuotes),reviewId:entry.reviewId,proposalId:entry.proposalId,reviewAction:entry.reviewAction}:{}),
      appliedBy:reason?'Core Domain':'PATH 일정 구성 / Core Travel 제약 검사'};
  });
  const factual=plan.fitDetails.filter(item=>item.fit==='met').sort((a,b)=>b.importance-a.importance);
  plan.reasons=[...factual.slice(0,3).map(item=>`${item.label}: ${item.wanted} 조건을 반영했어요. (${item.duration==='ongoing'?'평소 취향':'이번 여행'})`),
    `${formatMoney(plan.budgetLimit)} 안에서 ${formatMoney(plan.totalCost)}으로 구성했어요.`,
    ...(factual.length?[]:[summary.entries.some(entry=>entry.status==='declared'&&entry.mode!=='ignore')?'직접 알려준 조건 중 현재 자료로 맞출 수 있는 정도를 비교했어요.':'아직 직접 알려준 취향이 없어 기본·시연 설정으로 비교했어요.'])];
  plan.tradeoffs.unshift(...plan.fitDetails.filter(item=>item.fit!=='met').slice(0,4).map(item=>`${item.label}: ${item.fit==='unknown'?'자료가 없어 충족 여부를 확인하지 못했어요.':`원한 조건(${item.wanted})과 차이가 있어요.`}`));
  return plan;
}

function describe(bundle, evaluation, profile, previousPlan, label = null) {
  const { hotel, lunch, dinner, night, activity } = bundle.venues;
  const categoryCosts = kind => bundle.items.filter(item => item.kind === kind).reduce((sum, item) => sum + (item.cost.amount ?? 0), 0);
  const hotelReason = profile.hotel === 'quiet' ? '숙면과 조용함을 중요하게 고른 조건을 반영했어요.' : profile.hotel === 'central' ? '중심지 접근성 선호를 반영했어요.' : '전체 예산과 이동 부담을 함께 비교한 숙소예요.';
  const reasons = [profile.priority === 'food' ? '숙박비와 전체 예산을 함께 비교하면서 식사 취향에 더 큰 비중을 뒀어요.'
    : profile.priority === 'hotel' ? '음식과 활동보다 숙소 취향에 더 큰 비중을 뒀어요.' : '취향을 맞추면서 남는 예산과 이동 부담을 함께 비교했어요.',
    `${formatMoney(profile.budget)} 안에서 숙소·두 끼·활동·이동을 ${formatMoney(evaluation.total)}으로 구성했어요.`,
    profile.rain ? '비 오는 날에 맞춰 오후 활동을 실내로 골랐어요.' : `걷는 시간 ${evaluation.walkMinutes}분을 포함한 가상 동선이에요.`];
  const tradeoffs = ['가상 업체·가격·운영시간으로 만든 비교예요. 실제 예약이나 길안내에 사용할 수 없어요.', '항공·서울 도착/출발 교통·다음 날 식사·자유시간 추가 소비는 제외했어요.'];
  if (profile.night !== 'any' && profile.night !== (night?.nightStyle ?? 'none')) tradeoffs.unshift('원한 밤 활동은 이 예산·동선에서 반영되지 않았어요. 아래 조건을 바꾸어 비교해 보세요.');
  if (profile.hotel !== 'any' && (hotel.features[profile.hotel] ?? 0) < 0.7) tradeoffs.unshift('숙소 선호를 충분히 맞추지 못해 비용·이동 조건과 타협했어요.');
  if (!profile.alcohol) reasons.push('음주를 전제로 한 밤 활동을 제외했어요.');
  const changes = [];
  if (previousPlan) {
    const oldStops = previousPlan.stops ?? [];
    for (const kind of ['hotel', 'lunch', 'activity', 'dinner', 'night']) {
      const old = oldStops.find(stop => stop.kind === kind), next = bundle.stops.find(stop => stop.kind === kind);
      if (old?.id !== next?.id) changes.push(`${kinds[kind]}: ${old?.name ?? '없음'} → ${next?.name ?? '숙소에서 쉬기'}`);
    }
    const costDifference = evaluation.total - previousPlan.totalCost;
    if (costDifference !== 0) changes.push(`총비용 ${formatMoney(Math.abs(costDifference))} ${costDifference > 0 ? '증가' : '절약'}`);
    if (evaluation.walkMinutes !== previousPlan.walkingMinutes) changes.push(`걷는 시간 ${previousPlan.walkingMinutes}분 → ${evaluation.walkMinutes}분`);
    if (!changes.length) changes.push('지금 조건에서는 같은 여행안이 가장 잘 맞아요.');
  }
  return { id: bundle.id, title: label ?? (profile.priority === 'food' ? '잘 먹고, 가볍게 머무는 서울' : profile.priority === 'hotel' ? '편하게 머물고, 천천히 보는 서울' : night ? '낮부터 밤까지, 내 속도의 서울' : '여백이 있는 서울 하루'),
    summary: `${activity.area}의 오후, ${night ? night.area + '의 밤' : '숙소에서 쉬는 저녁'}.`, totalCost: evaluation.total, budgetLimit: profile.budget,
    stops: bundle.stops, hotel: { id: hotel.id, name: hotel.name, area: hotel.area, cost: hotel.price, reason: hotelReason },
    reasons, tradeoffs, walkingMinutes: evaluation.walkMinutes, changes,
    budget: [{ id: 'hotel', label: '숙소 1박 · 객실 1개', amount: categoryCosts('hotel') },
      { id: 'food', label: '점심 + 저녁', amount: categoryCosts('lunch') + categoryCosts('dinner') },
      { id: 'experience', label: '오후 + 밤 활동', amount: categoryCosts('activity') + categoryCosts('night') },
      { id: 'transport', label: '일정 안 이동', amount: categoryCosts('transfer') }], isFixture: true };
}

function recommendations(input, { lockedHotelId = null, previousPlan = null, personalization = createPersonalization(), at = new Date().toISOString(), cache = new Map() } = {}) {
  const resolved=resolvePersonalization(personalization,{at});
  const summary=summarizePersonalization(personalization,{at});
  const profile={...input};
  for(const field of Object.keys(DEFAULT_PROFILE)) {
    const entry=summary.entries.find(entry=>entry.field===field);
    if(personalization.events.some(event=>event.field===field))profile[field]=DEFAULT_PROFILE[field];
    if(entry && (entry.status==='declared'&&entry.mode!=='ignore'||entry.status==='unknown'&&entry.value==='any'))profile[field]=entry.value;
  }
  normalizeProfile(profile);
  if (lockedHotelId !== null && !CANDIDATES.some(candidate => candidate.id === lockedHotelId && candidate.type === 'hotel')) throw new TypeError('잠근 숙소를 찾을 수 없어요. 숙소 잠금을 해제해 주세요.');
  const cacheKey=JSON.stringify(profile);
  if(!cache.has(cacheKey))cache.set(cacheKey,constructBundles(profile));
  const bundles = cache.get(cacheKey);
  const requirements = [];
  if (profile.rain) requirements.push({ id: 'indoor', kind: 'activity' });
  if (!profile.alcohol) requirements.push({ id: 'noAlcohol', kind: 'night' });
  // A no-night plan satisfies no-alcohol without inventing a phantom required venue.
  const adjusted = bundles.map(bundle => ({ id: bundle.id, items: bundle.items }));
  const evaluationKey=`evaluated:${cacheKey}:${lockedHotelId??''}`;
  if(!cache.has(evaluationKey))cache.set(evaluationKey,Travel.evaluateBundles({ bundles: adjusted, budget: profile.budget, currency: 'KRW',
    dayStart: profile.dayStart * 60, dayEnd: profile.pace === 'easy' ? 23 * 60 : 25 * 60,
    maxWalkMinutes: profile.pace === 'easy' ? 70 : 180, requirements: requirements.filter(requirement => requirement.id !== 'noAlcohol'),
    lockedIds: lockedHotelId ? [lockedHotelId] : [], excludedIds: !profile.alcohol ? CANDIDATES.filter(candidate => candidate.requiresAlcohol).map(candidate => candidate.id) : [],
    at: AT, allowFixtures: true }));
  const evaluations=cache.get(evaluationKey);
  const byId = new Map(bundles.map(bundle => [bundle.id, bundle]));
  const feasible = new Map(evaluations.feasible.map(evaluation => [evaluation.id, evaluation]));
  const contract=policy(profile,summary), observations=resolved.observations;
  const featureMap=new Map(evaluations.feasible.map(evaluation=>[evaluation.id,features(byId.get(evaluation.id),evaluation,profile)]));
  const allowed=new Set([...contract.criteria.map(criterion=>criterion.feature),...contract.objectives.map(objective=>objective.feature)]);
  const choice=Domain.decide({contract,scope,observations,at,candidates:evaluations.feasible.map(evaluation=>({id:evaluation.id,
    features:Object.fromEntries(Object.entries(featureMap.get(evaluation.id)).filter(([key])=>allowed.has(key)))}))});
  const blocked=new Map();
  for(const row of choice.excluded)for(const reason of row.reasons){const [kind,field]=reason.split(':');if(!field)continue;const key=`${kind}:${field}`;
    const entry=summary.entries.find(entry=>entry.field===field);const previous=blocked.get(key);
    blocked.set(key,{field,label:entry?.label??field,reason:kind==='unknown'?'필수조건의 자료가 미확인입니다.':'필수조건을 충족하지 못합니다.',count:(previous?.count??0)+1});}
  const blockers=[...blocked.values()].sort((a,b)=>b.count-a.count);
  const decorate=(bundle,evaluation,ranked,label,previous=previousPlan)=>attachEvidence(describe(bundle,evaluation,profile,previous,label),ranked,summary,featureMap.get(bundle.id),choice.understanding);
  const issues = [];
  if (!choice.selected) {
    if (lockedHotelId) issues.push('잠근 숙소를 포함해 조건을 만족하는 안이 없어요. 예산·이동·날씨 조건을 바꾸거나 숙소 잠금을 풀어 주세요.');
    else if(blockers.length)issues.push(...blockers.slice(0,5).map(item=>`${item.label}: ${item.reason}`));
    else issues.push('현재 예산·걷는 양·활동 조건을 모두 만족하는 안이 없어요. 예산을 늘리거나 이동수단·활동량을 바꿔 주세요.');
  }
  const selected = choice.selected ? byId.get(choice.selected.id) : null;
  const primary = selected ? decorate(selected, feasible.get(selected.id), choice.selected) : null;
  const alternatives = [];
  if (selected) {
    const other = choice.ranked.filter(candidate => candidate.id !== selected.id);
    const cheaper = other.filter(candidate => feasible.get(candidate.id).total < primary.totalCost)
      .sort((a, b) => feasible.get(a.id).total - feasible.get(b.id).total || b.score - a.score)[0];
    if (cheaper) alternatives.push(decorate(byId.get(cheaper.id), feasible.get(cheaper.id), cheaper, '비용을 줄인 안', primary));
    const distinct = other.find(candidate => candidate.id !== cheaper?.id && byId.get(candidate.id).venues.hotel.id !== selected.venues.hotel.id);
    const next = distinct ?? other.find(candidate => candidate.id !== cheaper?.id);
    if (next) alternatives.push(decorate(byId.get(next.id), feasible.get(next.id), next, '다른 선택도 비교하기', primary));
  }
  return { status: primary ? 'ready' : 'unavailable', primary, alternatives, profile,
    diagnostics: { candidateCount: bundles.length, structurallyFeasibleCount: evaluations.feasible.length, feasibleCount: choice.ranked.length,
      pendingCount: evaluations.pending.length + choice.excluded.filter(row=>row.reasons.every(reason=>reason.startsWith('unknown:'))).length,
      rejectedCount: evaluations.rejected.length + choice.excluded.filter(row=>row.reasons.some(reason=>!reason.startsWith('unknown:'))).length, blockers, issues },
    personalization:summary, engineAudit:{ domainVersion:choice.version, preferenceVersion:resolved.layers.effective.version, travelVersion:evaluations.version, declaredFields:summary.entries.filter(entry=>entry.status==='declared').map(entry=>entry.field), observations:clone(observations), unknownMasks:resolved.masks, understanding:choice.understanding, decisionReasons:choice.selected?.reasons??[], policyReasons:choice.selected?.policyReasons??[], selectedId:choice.selected?.id??null, calibrated:false,
      source:summary.entries.some(entry=>entry.origin==='conversation')?'local-reviewed-text-and-choices':'local-structured-choices',
      ...(summary.entries.some(entry=>entry.origin==='conversation')?{interpretationVersion:INTERPRETATION_VERSION,interpretationLineage:clone(resolved.lineage.filter(row=>row.origin==='conversation'))}: {}) },
    notice: CATALOG_META.sourceNotice, question: null };
}

const QUESTIONS = [
  { id: 'food', about: 'food', prompt: '식사에서는 무엇이 더 끌리나요?', why: '같은 예산 안에서 식당과 숙박비 배분을 다시 비교할 수 있어요.', options: [
    { id: 'local', label: '동네 음식과 시장', value: 'local' }, { id: 'fine', label: '특별한 코스 요리', value: 'fine' }, { id: 'cafe', label: '카페와 가벼운 식사', value: 'cafe' }] },
  { id: 'hotel', about: 'hotel', prompt: '숙소에서는 무엇을 더 챙길까요?', why: '숙면과 중심지 접근성 중 숙소 선택을 바꾸는 조건이에요.', options: [
    { id: 'quiet', label: '조용하게 푹 자기', value: 'quiet' }, { id: 'central', label: '가까운 곳부터 편하게', value: 'central' }] },
  { id: 'night', about: 'night', prompt: '서울의 밤은 어떻게 보낼까요?', why: '밤 일정을 더하면 비용·귀가 시간·숙소 동선도 함께 바뀌어요.', options: [
    { id: 'none', label: '숙소에서 쉬기', value: 'none' }, { id: 'quiet', label: '차를 마시며 조용히', value: 'quiet' }, { id: 'live', label: '라이브 공연', value: 'live' }, { id: 'club', label: '클럽', value: 'club' }] },
];
export function buildRecommendations(input = {}, options = {}) {
  const profile=normalizeProfile(input), at=options.at??new Date().toISOString();
  const personalization=options.personalization??createPersonalization(), cache=new Map();
  const settings={...options,personalization,at,cache};
  const result=recommendations(profile,settings);
  if(options.includeQuestion===false)return result;
  const known=new Set(result.personalization.entries.filter(entry=>['declared','unknown'].includes(entry.status)).map(entry=>entry.field));
  const baseQuestions=QUESTIONS.filter(question=>result.profile[question.about]==='any'&&!known.has(question.about)).map(question=>({...question,
    options:question.options.filter(option=>result.profile.alcohol||question.id!=='night'||option.value==='none'||CANDIDATES.some(candidate=>candidate.type==='night'&&candidate.nightStyle===option.value&&!candidate.requiresAlcohol))}));
  // Try the details that distinguish the current candidate set; every trial uses a copy.
  const detailQuestions=DETAIL_FIELDS.filter(field=>!known.has(field.id)).map(field=>({id:field.id,about:field.id,prompt:`${field.label}, 어떻게 맞출까요?`,why:field.help,
    options:field.options.map((option,index)=>({id:`answer-${index}`,field:field.id,...option}))}));
  const questions=[...baseQuestions,...detailQuestions];
  if(questions.length){
    const outcomes=new Map();
    const decide=answers=>{
      const entries=Object.entries(answers);if(!entries.length)return result.primary?.id??'unavailable';
      let virtual=personalization;
      for(const [field,value]of entries)virtual=setPreference(virtual,{field,value,duration:'once',at});
      const trial=recommendations(profile,{...settings,personalization:virtual,previousPlan:null});
      const id=trial.primary?.id??'unavailable';outcomes.set(JSON.stringify(answers),trial.primary);return id;
    };
    const ranking=Ask.rank({questions,denied:options.deniedQuestions??[],decide});
    const useful=ranking.find(entry=>!entry.skippable&&entry.impact>0);
    const question=questions.find(question=>question.id===useful?.id);
    if(question)result.question={...clone(question),impact:useful.impact,options:question.options.map(option=>{
      const changed=outcomes.get(JSON.stringify({[question.about]:option.value}));
      return {...option,field:question.about,preview:changed?`${changed.hotel.name} · ${formatMoney(changed.totalCost)}`:'조건 조정이 필요해요'};
    })};
    result.engineAudit.questionRanking=ranking.map(({id,impact,skippable,reason})=>({id,impact,skippable,reason}));
  }
  return result;
}
