import '../../atlas/engine.js';
import * as DomainModule from '../../atlas/domain.js';
import * as PersonalizationModule from '../../atlas/personalization.js';
import * as InterpretationModule from '../../atlas/interpretation.js';

const Domain = DomainModule.default ?? globalThis.SynkAtlasDomain;
const Personalization = PersonalizationModule.default ?? globalThis.SynkAtlasPersonalization;
const Interpretation = InterpretationModule.default ?? globalThis.SynkAtlasInterpretation;
export const INTERPRETATION_VERSION = Interpretation.VERSION;
export const PREFERENCE_API = Personalization.preferences;
export const PERSONAL_VERSION = 'path-travel-personal-v2';
export const PERSONAL_SCOPE = Object.freeze({ personId: 'local-visitor', productId: 'path-travel', contextId: 'seoul', domain: 'PATH' });
export const DOMAIN_SCOPE = Object.freeze({ domain: 'PATH', workspace: 'path-travel-seoul', subject: 'local-visitor' });
export const DEFAULT_PROFILE = Object.freeze({ budget: 250000, dayStart: 9, priority: 'balanced', food: 'any', night: 'any', pace: 'easy', transport: 'transit', hotel: 'any', rain: false, alcohol: true });
export const EXECUTION_FIELDS = Object.freeze(['budget', 'dayStart', 'pace', 'transport', 'rain', 'alcohol']);
const opts = pairs => pairs.map(([value, label]) => ({ value, label }));
const detail = (id, label, group, kind, options, help, comparison = 'match', range) => ({ id, label, group, kind, options: opts(options), help, comparison, ...(range ? { range } : {}) });
export const DETAIL_FIELDS = Object.freeze([
  detail('hotelNoise', '숙소 소음 허용', '숙소', 'number', [[0.2,'아주 조용해야 해요'],[0.5,'생활 소음 정도는 괜찮아요'],[0.8,'활기찬 곳도 괜찮아요']], '낮을수록 조용한 숙소를 찾습니다. 방음 자료가 없으면 충족으로 단정하지 않아요.', 'at-most', [0,1]),
  detail('hotelCleanliness', '숙소 청결 기준', '숙소', 'number', [[0.6,'기본적인 청결'],[0.85,'꼼꼼한 청결'],[0.95,'매우 높은 청결 기준']], '가상 청결 지표를 비교합니다. 실제 위생이나 등급 검증은 아닙니다.', 'at-least', [0,1]),
  detail('hotelCentrality', '숙소 접근성', '숙소', 'number', [[0.4,'이동해도 괜찮아요'],[0.7,'주요 동선에 가까이'],[0.9,'중심지 가까이']], '숙면·가격과 함께 따져 볼 위치 조건입니다.', 'at-least', [0,1]),
  detail('hotelMaxPrice', '숙박에 쓸 상한', '숙소', 'number', [[80000,'8만 원'],[150000,'15만 원'],[250000,'25만 원']], '1객실 1박 기준. 총예산과 분야별 상한을 함께 지킵니다.', 'at-most', [0,1000000]),
  detail('spice', '먹을 수 있는 매운맛', '음식', 'number', [[0,'맵지 않게'],[1,'약간 매워도 괜찮아요'],[2,'매운 음식도 좋아요']], '먹을 수 있는 상한입니다. 높은 값을 고른다고 모든 음식이 매워야 한다고 해석하지 않아요.', 'at-most', [0,2]),
  detail('vegetarian', '채식 메뉴', '음식', 'boolean', [[true,'채식 메뉴가 필요해요'],[false,'채식 여부는 제한하지 않아요']], '필수로 고르면 점심과 저녁 모두 명시된 채식 메뉴가 있어야 합니다. 알레르기 안전 검증과는 달라요.'),
  detail('foodNovelty', '새로운 음식 탐색', '음식', 'number', [[0.2,'익숙한 음식 중심'],[0.5,'익숙함과 새로움 반반'],[0.9,'새로운 음식에 도전']], '두 끼의 탐색 정도를 비교합니다.', 'match', [0,1]),
  detail('maxWait', '식당 대기 허용', '음식', 'number', [[10,'10분까지'],[30,'30분까지'],[60,'60분까지']], '가상 예상 대기를 일정 시간에 포함합니다. 두 식당 중 긴 대기도 이 기준을 넘지 않아야 해요.', 'at-most', [0,120]),
  detail('mealMaxPrice', '한 끼 지출 상한', '음식', 'number', [[15000,'1만 5천 원'],[30000,'3만 원'],[60000,'6만 원'],[90000,'9만 원']], '두 끼 평균으로 비싼 한 끼를 숨기지 않습니다.', 'at-most', [0,150000]),
  detail('crowd', '붐비는 곳 허용', '활동', 'number', [[0.2,'한적한 곳'],[0.5,'보통 수준'],[0.9,'북적여도 괜찮아요']], '오후 활동의 가상 혼잡도를 비교합니다.', 'at-most', [0,1]),
  detail('activityIndoor', '실내·야외 활동', '활동', 'boolean', [[true,'실내가 좋아요'],[false,'야외가 좋아요']], '비 오는 날 실내 조건과 야외 필수가 충돌하면 먼저 알려 드립니다.'),
  detail('nightEnergy', '밤 활동의 에너지', '밤 문화', 'number', [[0.1,'차분하게'],[0.5,'적당히 활기차게'],[1,'신나게 즐기기']], '쉬기·차·라이브·클럽 안에서 분위기를 세밀하게 비교합니다.', 'match', [0,1]),
  detail('nightMusic', '밤에 듣고 싶은 음악', '밤 문화', 'enum', [['none','음악 없이 조용히'],['background','잔잔한 배경음악'],['live','라이브 음악'],['dance','댄스 음악']], '음악과 술·대화 취향은 따로 다룹니다.'),
  detail('conversation', '대화하기 좋은 밤', '밤 문화', 'boolean', [[true,'대화가 잘 들려야 해요'],[false,'대화보다 음악과 분위기']], '필수 대화 조건과 큰 음악이 있는 활동을 구분합니다.'),
  detail('walkLimit', '하루 걷는 시간 상한', '이동과 리듬', 'number', [[30,'30분'],[60,'1시간'],[120,'2시간']], '이동과 활동 안에서 걷는 시간까지 합칩니다.', 'at-most', [0,240]),
  detail('returnBy', '숙소에 돌아갈 시각', '이동과 리듬', 'number', [[1260,'밤 9시'],[1380,'밤 11시'],[1500,'다음 날 새벽 1시']], '숙소 도착과 체크인까지 포함합니다. 늦은 활동과 함께 비교해요.', 'at-most', [720,1800]),
]);
export const BASE_FIELDS = [
  {id:'budget',label:'총예산',kind:'number',range:[30000,1000000]}, {id:'dayStart',label:'시작 시간',kind:'number',range:[9,11]},
  ...Object.entries({priority:['hotel','food','balanced'],food:['any','local','fine','cafe'],night:['any','none','quiet','live','club'],pace:['easy','full'],transport:['walk','transit','taxi'],hotel:['any','quiet','central']}).map(([id,values])=>({id,label:({priority:'지출 우선순위',food:'식사 취향',night:'밤 활동',pace:'일정 속도',transport:'이동수단',hotel:'숙소 선호'})[id],kind:'enum',values})),
  {id:'rain',label:'우천 조건',kind:'boolean'}, {id:'alcohol',label:'술 중심 장소 허용',kind:'boolean'},
];
export const ALL_FIELDS = [...BASE_FIELDS, ...DETAIL_FIELDS];
const fieldMap = new Map(ALL_FIELDS.map(field=>[field.id,field]));
export const PREFERENCE_CONTRACT = Object.freeze({ id:'path-travel-person',version:'2',purpose:'seoul-day-stay', fields: ALL_FIELDS.flatMap(field=>[
  {id:field.id,kind:field.kind,...(field.range?{range:field.range}:{}),...(field.kind==='enum'?{values:field.values??field.options.map(option=>option.value)}:{}),...(field.kind==='number'&&field.comparison==='match'?{tolerance:0.15}:{}),maxAgeDays:30},
  {id:`${field.id}.mode`,kind:'enum',values:['prefer','require','ignore'],maxAgeDays:30},
  {id:`${field.id}.importance`,kind:'number',range:[1,5],maxAgeDays:30},
]),criteria:[] });
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => plain(value) && Object.keys(value).length===keys.length && keys.every(key=>Object.hasOwn(value,key));
const canonical = value => JSON.stringify(value, (_key,item)=>plain(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const date = value => { const text=value??new Date().toISOString(); if(typeof text!=='string'||!Number.isFinite(Date.parse(text)))throw new TypeError('조건의 확인 시각을 확인해 주세요.');return text; };
const context = (state, at) => ({contract:PREFERENCE_CONTRACT,scope:PERSONAL_SCOPE,events:state.events,encounterId:state.encounterId,at});
export function createPersonalization() { return {version:PERSONAL_VERSION,scope:clone(PERSONAL_SCOPE),encounterId:'seoul-trip-1',trip:1,serial:0,events:[]}; }

// This ledger belongs to PATH, not to Core's explicit preference event schema.
// Each accepted proposal has its own immutable packet so that an ongoing
// choice and a once-only override retain independent source lifetimes.
function interpretationLinks(state, at) {
  const archives=state.interpretations??[];
  const fail=()=>{throw new TypeError('문장으로 확인한 취향의 근거 기록을 확인해 주세요.');};
  if(!Array.isArray(archives)||archives.length>100)fail();
  const links=new Map(), archiveIds=new Set(), reviewIds=new Set(), sources=new Map();
  const events=new Map(state.events.map(event=>[event.id,event]));
  for(const archive of archives){
    if(!exact(archive,['id','encounterId','packet','reviews','bindings'])||typeof archive.id!=='string'||!/^path-text-travel-\d+$/.test(archive.id)||archiveIds.has(archive.id)
      ||!/^seoul-trip-[1-9]\d*$/.test(archive.encounterId)||Number(archive.encounterId.slice(11))>state.trip
      ||!exact(archive.packet,['contract','scope','sources','proposals'])||canonical(archive.packet.contract)!==canonical(PREFERENCE_CONTRACT)||canonical(archive.packet.scope)!==canonical(DOMAIN_SCOPE)
      ||!Array.isArray(archive.reviews)||archive.reviews.length!==1||!['confirm','correct'].includes(archive.reviews[0]?.action)
      ||!Array.isArray(archive.bindings)||archive.bindings.length!==1||!Array.isArray(archive.packet.proposals)||archive.packet.proposals.length!==1)fail();
    const review=archive.reviews[0], proposal=archive.packet.proposals[0], binding=archive.bindings[0];
    if(reviewIds.has(review.id)||!fieldMap.has(proposal.field)||!exact(binding,['field','reviewId','eventId','modeEventId','importanceEventId','duration'])
      ||binding.field!==proposal.field||binding.reviewId!==review.id||review.proposalId!==proposal.id||!['once','ongoing'].includes(binding.duration)
      ||archive.id!==`path-text-${binding.eventId}`)fail();
    const resolved=Interpretation.resolve({...archive.packet,reviews:archive.reviews,at});
    const observation=resolved.observations[0], lineage=resolved.lineage[0];
    if(!observation||!lineage||resolved.observations.length!==1)fail();
    const sourceIds=[...new Set(proposal.evidence.map(evidence=>evidence.sourceId))];
    if(archive.packet.sources.length!==sourceIds.length||archive.packet.sources.some(source=>!sourceIds.includes(source.id)))fail();
    for(const source of archive.packet.sources){
      if(sources.has(source.id)&&canonical(sources.get(source.id))!==canonical(source))fail();
      sources.set(source.id,source);
    }
    const until=observation.until??new Date(Date.parse(review.at)+30*86400000).toISOString();
    const info={origin:'conversation',reviewId:review.id,proposalId:proposal.id,reviewAction:review.action,
      sourceQuotes:clone(proposal.evidence),until,excluded:lineage.excluded,withdrawn:lineage.withdrawn};
    const expectedValue=review.action==='correct'?review.value:proposal.value;
    for(const [key,field] of [['eventId',binding.field],['modeEventId',`${binding.field}.mode`],['importanceEventId',`${binding.field}.importance`]]){
      const event=events.get(binding[key]);
      if(!event||links.has(event.id)||event.kind!=='set'||event.field!==field||event.source!=='explicit'||event.duration!==binding.duration
        ||event.encounterId!==archive.encounterId||event.at!==review.at||key==='eventId'&&event.value!==expectedValue)fail();
      links.set(event.id,{...info,eventId:event.id,field,value:lineage.excluded||lineage.withdrawn?null:event.value});
    }
    archiveIds.add(archive.id);reviewIds.add(review.id);
  }
  if(sources.size>32||[...sources.values()].reduce((sum,source)=>sum+source.text.length,0)>64000)fail();
  return links;
}
export function validatePersonalization(state, {at}={}) {
  if(!state||state.version!==PERSONAL_VERSION||JSON.stringify(state.scope)!==JSON.stringify(PERSONAL_SCOPE)||!Number.isSafeInteger(state.trip)||state.trip<1||state.encounterId!==`seoul-trip-${state.trip}`||!Number.isSafeInteger(state.serial)||state.serial<0||!Array.isArray(state.events)||state.events.length>6000)throw new TypeError('여행 취향 기록을 확인해 주세요.');
  const now=date(at);
  PREFERENCE_API.layers(context(state,now));interpretationLinks(state,now);return clone(state);
}
function append(state, action, at) {
  const next={...state,serial:state.serial+1};
  next.events=PREFERENCE_API.record({...context(state,at),id:`travel-${next.serial}`,...action});return next;
}
export function setPreference(state,{field,value,mode='prefer',importance=3,duration='once',at}={}) {
  const now=date(at);let next=validatePersonalization(state,{at:now});
  if(!fieldMap.has(field)||!['prefer','require','ignore'].includes(mode)||!Number.isInteger(importance)||importance<1||importance>5||!['once','ongoing'].includes(duration))throw new TypeError('취향의 조건·중요도·기간을 확인해 주세요.');
  if(EXECUTION_FIELDS.includes(field)){mode='require';importance=3;}
  if(value==='any')mode='ignore';
  for(const [key,val] of [[field,value],[`${field}.mode`,mode],[`${field}.importance`,importance]])next=append(next,{kind:'set',field:key,value:val,duration},now);
  return next;
}
export function removePreference(state,{field,duration='once',at}={}) {
  const now=date(at);let next=validatePersonalization(state,{at:now});if(!fieldMap.has(field))throw new TypeError('지울 조건을 확인해 주세요.');
  for(const key of [field,`${field}.mode`,`${field}.importance`])next=append(next,{kind:'withdraw',field:key,duration},now);return next;
}
export function startNewTrip(state,{at}={}) {
  const now=date(at);let next=append(validatePersonalization(state,{at:now}),{kind:'close'},now);
  next.trip+=1;next.encounterId=`seoul-trip-${next.trip}`;return next;
}
const names={hotel:'편안한 숙소',food:'좋은 음식',balanced:'균형 있게',any:'아직 모름',local:'동네 음식',fine:'코스 요리',cafe:'카페',none:'숙소에서 쉬기',quiet:'조용하게',live:'라이브',club:'클럽',easy:'여유 있게',full:'알차게',transit:'대중교통',taxi:'택시',walk:'도보',central:'중심지'};
export function valueLabel(field,value){
  const spec=fieldMap.get(field), option=spec?.options?.find(option=>option.value===value);if(option)return option.label;
  if(['hotelMaxPrice','mealMaxPrice','budget'].includes(field))return new Intl.NumberFormat('ko-KR').format(value)+'원';
  if(['maxWait','walkLimit'].includes(field))return `${value}분`;
  if(field==='returnBy')return `${value>=1440?'다음 날 ':''}${String(Math.floor(value/60)%24).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  if(field==='hotelNoise')return value<=0.2?'아주 조용한 편':value<=0.5?'생활 소음이 있는 편':'주변 소음이 있는 편';
  if(field==='hotelCleanliness')return value>=0.9?'높은 청결 지표':value>=0.7?'보통 청결 지표':'기본 청결 지표';
  if(field==='hotelCentrality')return value>=0.8?'중심지에 가까움':value>=0.6?'주요 동선 접근 가능':'이동이 필요한 위치';
  if(field==='foodNovelty')return value<0.35?'익숙한 음식 중심':value<0.7?'익숙함과 새로움 혼합':'새로운 음식 중심';
  if(field==='crowd')return value<=0.25?'한적한 편':value<0.6?'보통 혼잡':'붐비는 편';
  if(field==='nightEnergy')return value<=0.25?'차분한 분위기':value<0.8?'활기 있는 분위기':'에너지 높은 분위기';
  return typeof value==='boolean'?(value?'예':'아니요'):names[value]??String(value);
}
export function resolvePersonalization(state,{at}={}) {
  const now=date(at);validatePersonalization(state,{at:now});
  const resolved=PREFERENCE_API.toDomain({...context(state,now),domainScope:DOMAIN_SCOPE});
  const links=interpretationLinks(state,now);
  const masks=Object.entries(resolved.layers.effective.values).filter(([field,value])=>fieldMap.has(field)&&value==='any').map(([field])=>({field,...resolved.layers.effective.provenance[field]}));
  const masked=new Set(masks.flatMap(mask=>[mask.field,`${mask.field}.mode`,`${mask.field}.importance`]));
  const observations=resolved.observations.filter(row=>!masked.has(row.field)).map(row=>{
    const link=links.get(row.id);if(!link)return row;
    return {...row,value:link.value,until:link.until,refs:[...new Set([...row.refs,link.reviewId,link.proposalId,...link.sourceQuotes.map(evidence=>evidence.sourceId)])]};
  });
  const lineage=resolved.lineage.map(row=>links.has(row.eventId)?{...row,...links.get(row.eventId)}:row);
  return {...resolved,observations,lineage,masks,understanding:Domain.understand({contract:PREFERENCE_CONTRACT,scope:DOMAIN_SCOPE,observations,at:now})};
}
export function summarizePersonalization(state,{at}={}) {
  const now=date(at), resolved=resolvePersonalization(state,{at:now}), links=interpretationLinks(state,now);
  const facts=new Map(resolved.understanding.fields.map(field=>[field.id,field]));
  const read=layer=>Object.entries(layer.values).filter(([field])=>fieldMap.has(field)).map(([field,value])=>{
    const provenance=layer.provenance[field], spec=fieldMap.get(field), link=links.get(provenance.eventId);
    const until=link?.until??new Date(Date.parse(provenance.at)+30*86400000).toISOString();
    return {field,label:spec.label,value,labelValue:valueLabel(field,value),mode:layer.values[`${field}.mode`]??'prefer',importance:layer.values[`${field}.importance`]??3,duration:provenance.duration,source:provenance.source,eventId:provenance.eventId,at:provenance.at,until,
      origin:link?'conversation':'manual',...(link?{reviewId:link.reviewId,proposalId:link.proposalId,reviewAction:link.reviewAction,sourceQuotes:clone(link.sourceQuotes)}:{}),
      status:link&&(link.excluded||link.withdrawn)?'withdrawn':Date.parse(now)>=Date.parse(until)?'expired':value==='any'?'unknown':facts.get(field)?.status??'unknown'};
  });
  return {entries:read(resolved.layers.effective),baseline:read(resolved.layers.baseline),trip:read(resolved.layers.context)};
}
