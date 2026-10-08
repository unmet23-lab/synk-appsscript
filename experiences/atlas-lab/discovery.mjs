// Product-only fictional candidate discovery. Reuses Core; no model, network or storage.
// All declarations are synthetic adults' explicit choices, not inferred traits or liking.
import { MEETING_REGION_OPTIONS, validateMeetingRegions, compareMeetingRegions, formatMeetingRegions } from './meeting-regions.mjs';
const VERSION = 'discovery-demo-1', START = '2026-10-06T12:00:00.000Z', ME = 'discovery-me';
const ENCOUNTER = 'current-discovery'; // Legacy records remain the first discovery context.
const copy = value => JSON.parse(JSON.stringify(value));
const canonical = value => JSON.stringify(value, (_key, item) => item && Object.getPrototypeOf(item) === Object.prototype
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const PREVIEW_VERSION = 'discovery-preview-1', SEED_VERSION = 'discovery-meeting-seed-1';
const baseKey = state => `${PREVIEW_VERSION}:${canonical(state)}`;
// Compact local identity, not an authentication/signature mechanism. Preview
// validation below compares the complete canonical state and result, not this hash.
function fingerprint(value) {
  let a = 2166136261, b = 2246822507;
  for (const char of canonical(value)) {
    const n = char.charCodeAt(0); a = Math.imul(a ^ n, 16777619) >>> 0; b = Math.imul(b ^ n, 3266489909) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
const fail = message => { throw new TypeError(`Discovery demo: ${message}`); };
const own = (value, key) => Object.hasOwn(value, key);
const exact = (value, keys) => !!value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).every(key => keys.includes(key));
const instant = at => typeof at === 'string' && at.length <= 40 && Number.isFinite(Date.parse(at)) ? Date.parse(at) : fail('invalid time');
const utc = at => new Date(instant(at)).toISOString();
const option = (value, label) => Object.freeze({ id: String(value), value, label });
const ANY = option('any', '어느 쪽도 괜찮아요');
const AXES = ['pace', 'plan', 'relationshipGoal', 'relationshipSpeed', 'contact', 'rhythm', 'notice'];
const AXIS_LABELS = { pace: '대화 방식', plan: '약속 방식', relationshipGoal: '관계의 목적', relationshipSpeed: '알아가는 속도', contact: '연락 빈도', rhythm: '생활 리듬', notice: '사전 예고 방식' };
const DAY = 86400000, OPTIONAL_BUDGET = { brief: 2, thorough: 5 };
// Product policy units reuse the declared fit weights below (ordinary own match
// 2, priority match 4, reciprocal match 1). One optional answer costs 1/8 unit;
// resolving a mandatory unknown outranks every possible soft-fit difference.
// These are reviewable policy choices, never learned answer/relationship odds.
const QUESTION_COST = 0.125, REQUIRED_UNKNOWN_LOSS = AXES.length * 5 + 1;
// Authored comparisons vary one declared preference; a reaction is not a trait.
const SCENES = [
  { id: 'contact-frequency', field: 'wants.contact', title: '연락하는 간격', intro: '서로 바쁜 정도와 말투는 같고, 연락하는 간격만 달라요.',
    a: { value: 'daily', text: '하루에 한 번, 서로의 하루 이야기를 나눠요.' }, b: { value: 'few-days', text: '며칠에 한 번, 서로의 하루 이야기를 나눠요.' } },
  { id: 'advance-notice', field: 'wants.notice', title: '바쁠 때 알려주는 시점', intro: '같은 일로 같은 시간 동안 연락이 어렵고, 알려주는 시점만 달라요.',
    a: { value: 'advance', text: '바빠지기 전에 “오늘은 일이 길어져요. 끝나면 연락할게요.”라고 알려줘요.' }, b: { value: 'when-free', text: '일이 끝난 뒤 “오늘은 일이 길어졌어요. 이제 연락해요.”라고 알려줘요.' } },
  { id: 'making-plans', field: 'wants.plan', title: '약속을 정하는 시점', intro: '만나는 사람·날짜·장소는 같고, 정하는 시점만 달라요.',
    a: { value: 'planned', text: '며칠 전에 만날 시간과 장소를 함께 정해요.' }, b: { value: 'spontaneous', text: '만나는 날에 시간과 장소를 함께 정해요.' } },
  { id: 'relationship-goal', field: 'wants.relationshipGoal', title: '상대도 어떤 관계를 생각하면 편할까요?',
    intro: '둘 다 시간에 여유를 두고 알아가며, 연락 간격과 이번 약속은 같아요. 상대가 시작하고 싶은 관계의 목적만 달라요.',
    a: { value: 'committed', text: '“진지한 관계로 이어질 가능성을 생각하면서 알아가고 싶어요.”라고 말해요.' },
    b: { value: 'exploring', text: '“좋은 대화와 교류부터 시작하면서 알아가고 싶어요.”라고 말해요.' } },
  { id: 'relationship-goal-open', field: 'wants.relationshipGoal', title: '관계의 목적을 알아가면서 정한다면?',
    intro: '둘 다 시간에 여유를 두고 알아가며, 연락 간격과 이번 약속은 같아요. 상대가 관계의 목적을 지금 정했는지만 달라요.',
    a: { value: 'committed', text: '“지금은 진지한 관계를 시작할 생각으로 알아가고 싶어요.”라고 말해요.' },
    b: { value: 'open', text: '“관계의 목적은 아직 정하지 않았고, 알아가면서 정하고 싶어요.”라고 말해요.' } },
  { id: 'relationship-speed', field: 'wants.relationshipSpeed', title: '진지한 관계라도 알아가는 속도는 다를 수 있어요',
    intro: '둘 다 진지한 관계를 생각하고 더 알아가고 싶은 마음이 있어요. 연락 간격과 이번 약속은 같고, 이후 알아가는 속도만 달라요.',
    a: { value: 'gradual', text: '“시간에 여유를 두고 천천히 알아가고 싶어요.”라고 말해요.' },
    b: { value: 'steady', text: '“마음이 맞으면 만남을 자주 이어가며 알아가고 싶어요.”라고 말해요.' } },
  { id: 'relationship-speed-flexible', field: 'wants.relationshipSpeed', title: '알아가는 속도를 서로 조율한다면?',
    intro: '둘 다 진지한 관계를 생각하고 더 알아가고 싶은 마음이 있어요. 연락 간격과 이번 약속은 같고, 이후 알아가는 속도만 달라요.',
    a: { value: 'gradual', text: '“시간에 여유를 두고 천천히 알아가고 싶어요.”라고 말해요.' },
    b: { value: 'flexible', text: '“정해 둔 속도보다 서로 편한 속도를 함께 조율하고 싶어요.”라고 말해요.' } },
];
const sceneSpec = id => SCENES.find(scene => scene.id === id);
const questionDay = at => new Date(instant(at) + 9 * 3600000).toISOString().slice(0, 10);
const NOTICE = [option('advance', '바쁠 때 미리 알려요'), option('when-free', '여유가 생기면 알려요'), option('flexible', '상황에 맞춰 조율해요')];
const PURPOSE = [option('gradual', '천천히 알아가고 싶어요'), option('committed', '진지한 관계를 생각해요'), option('open', '대화하면서 정하고 싶어요')];
const RELATIONSHIP_GOAL = [option('committed', '진지한 관계를 생각해요'), option('exploring', '좋은 대화·교류부터 시작하고 싶어요'), option('open', '알아가면서 정하고 싶어요')];
const RELATIONSHIP_SPEED = [option('gradual', '시간을 두고 천천히 알아가요'), option('steady', '마음이 맞으면 자주 알아가요'), option('flexible', '서로 편한 속도를 조율해요')];
const CONTACT = [option('daily', '하루에 한 번쯤 연락해요'), option('few-days', '며칠에 한 번 여유 있게 연락해요'), option('flexible', '상황에 맞춰 조율해요')];
const RHYTHM = [option('early', '이른 시간에 활동하는 편이에요'), option('late', '늦은 시간에 활동하는 편이에요'), option('variable', '활동 시간이 자주 달라요')];
export const DISCOVERY_FEEDBACK_REASONS = Object.freeze([
  { id: 'condition', label: '원하는 조건과 달라요' }, { id: 'context', label: '지금 상황과 맞지 않아요' },
  { id: 'no-attraction', label: '이 후보에게는 마음이 가지 않아요' }, { id: 'unknown', label: '아직 잘 모르겠어요' },
].map(Object.freeze));
export const DISCOVERY_FIELDS = Object.freeze([
  { id: 'consent', label: '후보 살펴보기 동의', question: '서로 공개한 조건으로 가상 후보를 살펴볼까요?', kind: 'required', options: [option(true, '살펴볼게요'), option(false, '지금은 살펴보지 않을게요')] },
  { id: 'availability', label: '가능한 일정', question: '가상 첫 만남은 언제 가능한가요?', kind: 'required', options: [option('weekend', '주말'), option('weekday', '평일 저녁'), option('any', '둘 다 가능해요')] },
  { id: 'self.pace', label: '내 대화 방식', question: '처음 이야기를 나눌 때 나는 주로 어떻게 하나요?', kind: 'self', options: [option('lead', '먼저 대화를 열어요'), option('listen', '듣고 답해요')] },
  { id: 'self.plan', label: '내 약속 방식', question: '나는 약속을 어떻게 준비하는 편인가요?', kind: 'self', options: [option('planned', '미리 계획해요'), option('spontaneous', '그때그때 정해요')] },
  { id: 'wants.pace', label: '상대에게 바라는 대화 방식', question: '두근거리는 첫 대화, 어떤 사람이면 편할까요?', kind: 'wants', options: [option('lead', '질문하며 대화를 이끌어 주는 사람'), option('listen', '차분히 듣고 응답하는 사람'), ANY] },
  { id: 'wants.plan', label: '상대에게 바라는 약속 방식', question: '다음 약속을 잡을 때 상대가 어떻게 해 주면 좋을까요?', kind: 'wants', options: [option('planned', '미리 계획을 정하는 사람'), option('spontaneous', '즉흥적으로 정하는 사람'), ANY] },
  { id: 'self.purpose', label: '예전에 함께 고른 목적·속도', question: '예전에 함께 고른 목적·속도', kind: 'self', legacy: true, options: PURPOSE },
  { id: 'wants.purpose', label: '예전에 함께 고른 상대의 목적·속도', question: '예전에 함께 고른 상대의 목적·속도', kind: 'wants', legacy: true, options: [...PURPOSE, ANY] },
  { id: 'self.relationshipGoal', label: '내가 원하는 관계의 목적', question: '지금 어떤 관계를 시작하고 싶나요?', kind: 'self', options: RELATIONSHIP_GOAL },
  { id: 'wants.relationshipGoal', label: '상대에게 바라는 관계의 목적', question: '상대도 어떤 관계를 생각하면 좋을까요?', kind: 'wants', options: [...RELATIONSHIP_GOAL, ANY] },
  { id: 'self.relationshipSpeed', label: '내가 편한 알아가는 속도', question: '관계의 목적과 별개로, 어느 속도로 알아가는 게 편한가요?', kind: 'self', options: RELATIONSHIP_SPEED },
  { id: 'wants.relationshipSpeed', label: '상대에게 바라는 알아가는 속도', question: '상대와 어느 속도로 알아가면 편할까요?', kind: 'wants', options: [...RELATIONSHIP_SPEED, ANY] },
  { id: 'self.meetingRegions', label: '실제로 만날 수 있는 지역', question: '직접 만나기 가능한 지역은 어디인가요?', kind: 'regions', options: MEETING_REGION_OPTIONS },
  { id: 'self.contact', label: '내가 편한 연락 빈도', question: '알아가는 동안 나는 어느 정도 연락하는 게 편한가요?', kind: 'self', options: CONTACT },
  { id: 'wants.contact', label: '상대에게 바라는 연락 빈도', question: '상대는 어느 정도 연락해 주면 편할까요?', kind: 'wants', options: [...CONTACT, ANY] },
  { id: 'self.rhythm', label: '내 생활 리듬', question: '요즘 나는 주로 언제 활동하나요?', kind: 'self', options: RHYTHM },
  { id: 'wants.rhythm', label: '상대에게 바라는 생활 리듬', question: '상대의 활동 시간은 어떤 쪽이면 편할까요?', kind: 'wants', options: [...RHYTHM, ANY] },
  { id: 'self.notice', label: '내 사전 예고 방식', question: '연락하기 어려울 때 나는 어떻게 알리는 편인가요?', kind: 'self', options: NOTICE },
  { id: 'wants.notice', label: '상대에게 바라는 사전 예고', question: '상대가 연락하기 어려울 때 어떻게 알려 주면 편할까요?', kind: 'wants', options: [...NOTICE, ANY] },
].map(field => Object.freeze({ ...field, options: Object.freeze(field.options) })));
export const DISCOVERY_SCENARIOS = Object.freeze([
  { id: 'first', title: '내 방식과 바람부터' },
  { id: 'ready', title: '다섯 가상 후보 비교' },
  { id: 'boundary', title: '지금 조건으로는 추천 보류' },
].map(Object.freeze));
const CONTRACT = { id: 'discovery.explicit', version: '1', purpose: 'fictional-candidate-discovery', criteria: [],
  fields: DISCOVERY_FIELDS.filter(field => field.kind !== 'regions').map(field => ({ id: field.id, kind: field.id === 'consent' ? 'boolean' : 'enum',
    ...(field.id === 'consent' ? {} : { values: field.options.map(item => item.value) }), maxAgeDays: 36500 })) };
const REFERENCE = { id: CONTRACT.id, version: CONTRACT.version, purpose: CONTRACT.purpose };
const DECISION_CONTRACT = { ...CONTRACT, fields: [...CONTRACT.fields,
  ...CONTRACT.fields.filter(field => field.id.startsWith('wants.')).map(field => ({ ...field, id: field.id.replace('wants.', 'required.') }))] };
const prefScope = personId => ({ personId, productId: 'discovery-demo', contextId: 'fictional-adult-pool', domain: 'SYNK' });
const domainScope = subject => ({ domain: 'SYNK', workspace: 'fictional-adult-pool', subject });
const spec = id => DISCOVERY_FIELDS.find(field => field.id === id);
const labelValue = (field, value) => spec(field)?.kind === 'regions' ? formatMeetingRegions(value) : spec(field)?.options.find(option => option.value === value)?.label || '미확인';
const profiles = [
  { id: 'candidate-1', label: '가상 성인 1', tagline: '먼저 말을 걸고 약속을 미리 정한다고 밝혔어요.', values: { consent: true, availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned', 'wants.pace': 'any', 'wants.plan': 'planned' }, required: [] },
  { id: 'candidate-2', label: '가상 성인 2', tagline: '차분히 듣고 약속을 미리 정한다고 밝혔어요.', values: { consent: true, availability: 'weekend', 'self.pace': 'listen', 'self.plan': 'planned', 'wants.pace': 'listen', 'wants.plan': 'planned' }, required: [] },
  { id: 'candidate-3', label: '가상 성인 3', tagline: '먼저 말을 걸고 약속은 즉흥적으로 정한다고 밝혔어요.', values: { consent: true, availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'spontaneous', 'wants.pace': 'any', 'wants.plan': 'planned' }, required: [] },
  { id: 'candidate-4', label: '가상 성인 4', tagline: '서로 먼저 말을 꺼내는 대화를 꼭 원한다고 밝혔어요.', values: { consent: true, availability: 'weekend', 'self.pace': 'lead', 'self.plan': 'planned', 'wants.pace': 'lead', 'wants.plan': 'any' }, required: ['wants.pace'] },
  { id: 'candidate-5', label: '가상 성인 5', tagline: '차분히 듣고 미리 계획하지만 가능한 일정은 아직 밝히지 않았어요.', values: { consent: true, 'self.pace': 'listen', 'self.plan': 'planned', 'wants.pace': 'any', 'wants.plan': 'any' }, required: [] },
  // Internal privacy fixture: must never enter candidate decisions, questions or public output.
  { id: 'hidden-no-consent', label: '비공개 가상 성인', tagline: '공개하지 않은 내용', values: { consent: false, availability: 'any', 'self.pace': 'lead', 'self.plan': 'planned', 'wants.pace': 'any', 'wants.plan': 'any' }, required: [] },
];
// Authored fictional declarations. Existing user records do not receive these values.
const extraProfiles = [['gradual', 'few-days', 'early'], ['committed', 'daily', 'late'], ['open', 'flexible', 'variable'], ['committed', 'few-days', 'early'], ['gradual', 'daily', 'late']];
profiles.slice(0, 5).forEach((person, index) => {
  for (const [axis, value] of ['purpose', 'contact', 'rhythm'].map((axis, i) => [axis, extraProfiles[index][i]])) {
    person.values[`self.${axis}`] = value; person.values[`wants.${axis}`] = 'any';
  }
  person.values['self.notice'] = ['when-free', 'advance', 'flexible', 'advance', 'when-free'][index];
  person.values['wants.notice'] = 'any';
  // New independent fictional declarations, never migrated from purpose answers.
  person.values['self.relationshipGoal'] = ['exploring', 'committed', 'open', 'committed', 'exploring'][index];
  person.values['self.relationshipSpeed'] = ['gradual', 'gradual', 'steady', 'flexible', 'steady'][index];
  person.values['wants.relationshipGoal'] = 'any'; person.values['wants.relationshipSpeed'] = 'any';
});

export function createDiscoveryAdapter({ Domain, Ask, Personalization, ConditionalPreference = globalThis.SynkAtlasConditionalPreference, candidates, ownerId, contextId, synthetic = true } = {}) {
  if (!Domain?.decide || !Domain?.validateContract || !Ask?.choose || !Personalization?.preferences?.record || !Personalization.preferences.project || !Personalization.preferences.layers) fail('Core domain, Ask and scoped preference layers are required');
  Domain.validateContract(CONTRACT);
  const P = Personalization.preferences;
  const accountId = id => typeof id === 'string' && /^[A-Za-z0-9_.:@-]{1,160}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
  if (typeof synthetic !== 'boolean' || synthetic && (candidates !== undefined || ownerId !== undefined || contextId !== undefined)) fail('external candidates require an explicit non-synthetic account scope');
  if (!synthetic && (!accountId(ownerId) || typeof contextId !== 'string' || !/^[A-Za-z0-9_.-]{1,48}$/.test(contextId)
    || !Array.isArray(candidates) || candidates.length > 100)) fail('invalid external candidate scope or pool');
  // Host authorizes and projects public adult profiles. Core only receives valid
  // explicit fields from that projection; these tokens are identities, not auth.
  const ME = synthetic ? 'discovery-me' : `owner-${fingerprint(ownerId)}`;
  const internalId = id => synthetic ? id : `person-${fingerprint(id)}`;
  const prefScope = personId => ({ personId, productId: synthetic ? 'discovery-demo' : 'dating', contextId: synthetic ? 'fictional-adult-pool' : contextId, domain: 'SYNK' });
  const domainScope = subject => ({ domain: 'SYNK', workspace: synthetic ? 'fictional-adult-pool' : `dating-${fingerprint([ownerId, contextId])}`, subject: internalId(subject) });
  const external = (candidates || []).map(person => {
    if (!exact(person, ['id', 'label', 'tagline', 'region', 'values', 'required']) || !accountId(person.id) || person.id === ownerId
      || typeof person.label !== 'string' || !person.label.trim() || person.label.length > 80
      || person.tagline !== undefined && (typeof person.tagline !== 'string' || person.tagline.length > 400)
      || person.region !== undefined && (typeof person.region !== 'string' || person.region.length > 80)
      || !exact(person.values, DISCOVERY_FIELDS.map(field => field.id)) || !Array.isArray(person.required)
      || new Set(person.required).size !== person.required.length || person.required.some(field => spec(field)?.kind !== 'wants')) fail('invalid public candidate');
    for (const [field, value] of Object.entries(person.values)) {
      if (spec(field).kind === 'regions') validateMeetingRegions(value);
      else if (!spec(field).options.some(option => option.value === value)) fail('invalid public candidate value');
    }
    const result = { ...copy(person), tagline: person.tagline || '', ...(person.region !== undefined ? { region: person.region } : {}) };
    if (own(result.values, 'self.meetingRegions')) result.values['self.meetingRegions'] = validateMeetingRegions(result.values['self.meetingRegions']);
    return result;
  });
  if (new Set(external.map(person => person.id)).size !== external.length) fail('duplicate public candidate');
  // Consent is checked before even constructing the public pool or Ask scenarios.
  const pool = (synthetic ? profiles : external).filter(person => person.values.consent === true).map(copy);
  const poolKey = synthetic ? null : fingerprint(pool);
  const previewKey = state => synthetic ? baseKey(state) : baseKey({ state, poolKey });
  const publicField = field => synthetic ? field : { ...field, question: field.question.replaceAll('가상 후보', '공개 후보').replaceAll('가상 첫 만남', '첫 만남') };
  const conditionalSource = source => source && source.source === 'explicit' ? { eventId: source.eventId, source: 'explicit', duration: source.duration,
    encounterId: source.encounterId, at: source.at, ...(source.until ? { until: source.until } : {}) } : null;
  const conditionalInput = (me, entry, at) => ({ contract: CONTRACT, scope: prefScope(ME), rule: entry.rule,
    preference: { value: me.values['wants.contact'] ?? null, source: conditionalSource(me.provenance['wants.contact']),
      usable: own(me.values, 'wants.contact'), required: me.required.includes('wants.contact') },
    encounterId: me.contextId, at, invalidated: !!entry.invalidated });
  function conditionalLayer(me, entry, at) {
    if (!entry) return { status: 'none', reason: null, rule: null };
    const assessment = ConditionalPreference.assess(conditionalInput(me, entry, at));
    return { status: assessment.status === 'inactive' ? 'inactive' : 'active', reason: assessment.status === 'inactive' ? assessment.reason : null, rule: copy(entry.rule) };
  }
  function conditionalState(me, at) {
    const baseline = conditionalLayer(me, me.conditional.baseline, at), context = conditionalLayer(me, me.conditional.context, at);
    const target = context.status === 'active' ? 'context' : baseline.status === 'active' ? 'baseline'
      : context.status === 'inactive' ? 'context' : baseline.status === 'inactive' ? 'baseline' : null;
    return { baseline, context, target, effective: target ? (target === 'context' ? context : baseline) : { status: 'none', reason: null, rule: null } };
  }
  function conditionalAssessment(me, candidate, at) {
    if (!ConditionalPreference || !me.conditional) return null;
    const current = conditionalState(me, at); if (!current.target) return null;
    const entry = me.conditional[current.target], facts = {};
    for (const field of [entry.rule.feature, entry.rule.when.field]) if (own(candidate.values, field)) facts[field] = { value: candidate.values[field], usable: true,
      ...(candidate.provenance?.[field]?.until ? { until: candidate.provenance[field].until } : {}) };
    return ConditionalPreference.assess({ ...conditionalInput(me, entry, at), facts });
  }
  function conditionalKey(me, at) {
    return me.conditional && (me.conditional.baseline || me.conditional.context) ? fingerprint(conditionalState(me, at)) : null;
  }
  function project(runtime, at) {
    const layers = P.layers({ contract: CONTRACT, scope: prefScope(ME), encounterId: runtime.context.id, events: runtime.preferences, at });
    // Product set declarations retain the same source/lifetime semantics as Core
    // enum layers. A set comparison is not a fabricated scalar personal fact.
    for (const target of ['baseline', 'context']) {
      const declaration = runtime.regions[target]; if (!declaration) continue;
      if (declaration.until && instant(at) >= instant(declaration.until)) {
        (layers[target].expired ||= []).push({ field: 'self.meetingRegions', value: copy(declaration.value), ...copy(declaration.provenance) });
      } else {
        layers[target].values['self.meetingRegions'] = copy(declaration.value);
        layers[target].provenance['self.meetingRegions'] = copy(declaration.provenance);
      }
    }
    for (const target of ['baseline', 'context']) {
      if (own(layers[target].values, 'self.meetingRegions')) {
        layers.effective.values['self.meetingRegions'] = copy(layers[target].values['self.meetingRegions']);
        layers.effective.provenance['self.meetingRegions'] = copy(layers[target].provenance['self.meetingRegions']);
      }
      const expired = layers[target].expired?.filter(item => item.field === 'self.meetingRegions') || [];
      if (expired.length) (layers.effective.expired ||= []).push(...copy(expired));
    }
    const result = copy(layers.effective), hardValues = {};
    for (const field of Object.keys(runtime.requirements)) if (runtime.requirements[field] && own(layers.baseline.values, field)) hardValues[field] = layers.baseline.values[field];
    for (const field of runtime.unknown.keys()) { delete result.values[field]; delete result.provenance[field]; delete hardValues[field]; }
    if (result.expired) {
      result.expired = result.expired.filter(item => !runtime.unknown.has(item.field));
      if (!result.expired.length) delete result.expired;
    }
    const conflicts = Object.keys(hardValues).filter(field => field.startsWith('wants.') && own(layers.context.values, field)
      && hardValues[field] !== 'any' && layers.context.values[field] !== 'any' && hardValues[field] !== layers.context.values[field]);
    const priorityLayer = target => runtime.priorityDeadlines[target] && instant(at) >= instant(runtime.priorityDeadlines[target]) ? target === 'context' ? null : [] : runtime.priorities[target];
    return { id: ME, label: '나', values: result.values, provenance: result.provenance, ...(result.expired ? { expired: result.expired } : {}), layers, hardValues, conflicts, closed: runtime.context.closed,
      priorities: priorityLayer('context') ?? priorityLayer('baseline'),
      excluded: runtime.excluded, exposures: runtime.exposures, snoozes: runtime.snoozes,
      required: Object.entries(runtime.requirements).filter(([, required]) => required === true).map(([field]) => field),
      ...(ConditionalPreference ? { contextId: runtime.context.id, conditional: copy(runtime.conditional) } : {}) };
  }
  const considering = (me, at) => pool.filter(person => !me.excluded.has(person.id)
    && !(me.snoozes.has(person.id) && instant(at) < instant(me.snoozes.get(person.id).until)));
  function observation(person, field, at) {
    const source = person.provenance?.[field];
    return { id: source?.eventId || `${internalId(person.id)}.${field}`, scope: domainScope(person.id), contract: REFERENCE,
      field, value: person.values[field], source: 'declared', at: source?.at || at, ...(source?.until ? { until: source.until } : {}) };
  }
  function direction(owner, candidate, at) {
    const values = { ...owner.values }, provenance = { ...owner.provenance };
    const criteria = [{ id: 'availability', field: 'availability', feature: 'availability', weight: 0, required: true },
      { id: 'consent', field: 'consent', feature: 'consent', weight: 0, required: true }];
    for (const axis of AXES) {
      const field = `wants.${axis}`;
      // Only explicit any removes a condition; a missing required answer stays required.
      if (owner.values[field] !== 'any') criteria.push({ id: field, field, feature: `self.${axis}`, weight: owner.id === ME ? owner.priorities?.includes(field) ? 4 : 2 : 1, required: false });
      if (owner.required.includes(field)) {
        const hard = owner.id === ME ? owner.hardValues[field] : owner.values[field], requiredField = `required.${axis}`;
        if (hard !== 'any') {
          criteria.push({ id: requiredField, field: requiredField, feature: `self.${axis}`, weight: 0, required: true });
          if (hard !== undefined) {
            values[requiredField] = hard;
            const original = owner.id === ME ? owner.layers.baseline.provenance[field] : owner.provenance?.[field];
            if (original) provenance[requiredField] = { ...original, eventId: `${original.eventId}.required` };
          }
        }
      }
    }
    // The historical combined answer is not evidence for either new axis.
    // An old must-have remains an unresolved guard until explicitly retired.
    if (owner.required.includes('wants.purpose') && (owner.id === ME ? owner.hardValues['wants.purpose'] : owner.values['wants.purpose']) !== 'any')
      criteria.push({ id: 'required.purpose', field: 'required.purpose', feature: 'legacy.relationship-unconfirmed', weight: 0, required: true });
    const features = {};
    for (const criterion of criteria) {
      if (!own(candidate.values, criterion.feature)) continue;
      features[criterion.feature] = criterion.field === 'availability'
        && own(owner.values, 'availability') && (owner.values.availability === 'any' || candidate.values.availability === 'any')
        ? owner.values.availability : candidate.values[criterion.feature];
    }
    const conditional = owner.id === ME ? conditionalAssessment(owner, candidate, at) : null;
    // Conditional fit is a separate, disclosed product policy objective. Never
    // rewrite the original fact or pretend a derived comparison is a declaration.
    const objectives = conditional?.status === 'conditional' ? [{ id: 'conditional.contact', feature: 'conditional.contact', range: [0, 1],
      weight: (owner.priorities?.includes('wants.contact') ? 4 : 2) / 2, prefer: 'higher' }] : [];
    if (objectives.length) features['conditional.contact'] = 1;
    const result = Domain.decide({ contract: { ...DECISION_CONTRACT, criteria, ...(objectives.length ? { objectives } : {}) }, scope: domainScope(owner.id), at,
      observations: Object.keys(values).filter(field => spec(field)?.kind !== 'regions').map(field => observation({ ...owner, values, provenance }, field, at)), candidates: [{ id: internalId(candidate.id), features }] });
    return { criteria, features, result, conditional };
  }
  function evaluate(me, at) {
    if (me.closed) return { status: 'blocked', rows: [], top: null, tied: false };
    if (me.values.consent !== true) return { status: me.values.consent === false ? 'blocked' : 'needs-confirmation', rows: [], top: null, tied: false };
    const rows = pool.map(candidate => {
      const outbound = direction(me, candidate, at), inbound = direction(candidate, me, at);
      const blocked = [...outbound.result.excluded, ...inbound.result.excluded].flatMap(item => item.reasons);
      const skipped = me.excluded.has(candidate.id), snooze = me.snoozes.get(candidate.id), snoozed = !!snooze && instant(at) < instant(snooze.until);
      const ownRegions = me.values['self.meetingRegions'], publicRegions = candidate.values['self.meetingRegions'];
      const regional = ownRegions === undefined && publicRegions === undefined ? { status: 'inactive', shared: [] } : compareMeetingRegions(ownRegions, publicRegions);
      const status = snoozed || skipped || blocked.some(reason => reason.startsWith('constraint:')) || regional.status === 'disjoint' ? 'excluded'
        : blocked.length || me.conflicts.length || regional.status === 'unknown' ? 'pending' : 'eligible';
      const matched = [], differences = [], unknown = [], reciprocal = [], reasonDetails = [];
      const detail = (field, owner, text, required = false, comparison = 'unknown') => {
        const editable = owner === 'self', hardBaseline = required && editable && field.startsWith('wants.'), sourceField = hardBaseline ? me.layers.baseline : editable ? me : candidate;
        const provenance = sourceField.provenance?.[field], hasValue = own(sourceField.values, field);
        reasonDetails.push({ field, label: spec(field).label, text, owner, editable, comparison,
          source: !hasValue ? 'missing' : editable && !hardBaseline && own(me.layers.context.values, field) ? 'context' : 'baseline',
          value: hasValue ? sourceField.values[field] : null, at: provenance?.at || null,
          until: provenance?.until || null, required, priority: editable && me.priorities.includes(field) });
      };
      if (!own(me.values, 'availability') || !own(candidate.values, 'availability')) unknown.push('서로 가능한 일정을 모두 확인해야 해요.');
      else if (me.values.availability === 'any' || candidate.values.availability === 'any' || me.values.availability === candidate.values.availability) matched.push('서로 가능한 일정이 겹쳐요.');
      else differences.push('서로 가능한 일정이 겹치지 않아요. 일정은 필수조건이에요.');
      detail('availability', 'self', [...matched, ...differences, ...unknown][0], true,
        unknown.length ? 'unknown' : me.values.availability === 'any' || candidate.values.availability === 'any' ? 'any' : matched.length ? 'match' : 'different');
      if (regional.status !== 'inactive') {
        const text = regional.status === 'overlap' ? '직접 만나기 가능하다고 고른 지역이 겹쳐요. 구체적인 이동 거리·시간은 서로 확인해요.'
          : regional.status === 'disjoint' ? '직접 만나기 가능하다고 고른 지역이 겹치지 않아요. 지역을 자동으로 넓히지 않아요.'
            : ownRegions === undefined ? '직접 만나기 가능한 내 지역을 골라야 공개된 지역과 비교할 수 있어요.' : '상대의 만나기 가능한 공개 지역이 미확인이에요. 내 지역을 바꾸지 않고 공개 정보를 기다려요.';
        (regional.status === 'overlap' ? matched : regional.status === 'disjoint' ? differences : unknown).push(text);
        detail('self.meetingRegions', 'self', text, true, regional.status === 'overlap' ? 'match' : regional.status === 'disjoint' ? 'different' : 'unknown');
      }
      for (const owner of [me, candidate]) if (owner.required.includes('wants.purpose') && (owner.id === ME ? owner.hardValues['wants.purpose'] : owner.values['wants.purpose']) !== 'any') {
        const text = owner.id === ME ? '예전에 함께 고른 목적·속도의 필수기준은 그대로 보류해요. 직접 이 기준을 정리한 뒤 목적과 속도를 따로 골라 주세요.' : '예전에 함께 고른 필수기준을 현재 분리된 관계 정보로 확인할 수 없어 추천을 보류해요.';
        unknown.push(text); detail('wants.purpose', owner.id === ME ? 'self' : 'partner', text, true, 'unknown');
      }
      for (const [owner, other, reverse] of [[me, candidate, false], [candidate, me, true]]) for (const axis of AXES) {
        const field = `wants.${axis}`, actual = `self.${axis}`, label = AXIS_LABELS[axis], required = owner.required.includes(field);
        const desired = required && owner.id === ME ? owner.hardValues[field] : owner.values[field], value = other.values[actual];
        if (desired === 'any') {
          const text = `${label}: ${reverse ? '상대는' : '나는'} 어느 쪽도 괜찮다고 밝혔어요.`;
          if (reverse) reciprocal.push(text); detail(field, reverse ? 'partner' : 'self', text, required, 'any'); continue;
        }
        if (desired === undefined || value === undefined) {
          const text = reverse ? `${label}: 상대의 바람과 내 방식을 비교하려면 ${desired === undefined ? '상대의 바람' : '내 방식'} 확인이 필요해요.` : `${label}: 내 바람과 상대를 비교할 답이 아직 없어요.`;
          unknown.push(text); detail(field, reverse ? 'partner' : 'self', text, required);
          if (reverse && value === undefined) detail(actual, 'self', text); continue;
        }
        const condition = !reverse && field === 'wants.contact' ? outbound.conditional : null;
        const conditional = condition?.status === 'conditional', match = desired === value;
        const text = reverse ? `상대가 ${required ? '꼭 ' : ''}바라는 ${label}: ‘${labelValue(field, desired)}’. 내가 밝힌 방식과 ${match ? '맞아요' : '달라요'}.`
          : conditional ? `연락 빈도: 나는 하루에 한 번쯤을 선호해요. 상대가 바쁠 때 미리 알린다고 공개해 며칠 간격도 내가 직접 허용한 범위에 들어요. 기본 선호와 같은 일치는 아니에요.`
            : `내가 ${required ? '꼭 ' : ''}바라는 ${label}: ‘${labelValue(field, desired)}’. 상대가 밝힌 방식과 ${match ? '맞아요' : '달라요'}.${condition?.conditionStatus === 'unknown' ? ' 며칠 간격을 허용할 사전 예고 답은 아직 확인되지 않았어요.' : condition?.conditionStatus === 'different' ? ' 상대의 사전 예고 방식이 내가 정한 허용 조건과 달라요.' : ''}`;
        if (reverse) reciprocal.push(text);
        detail(field, reverse ? 'partner' : 'self', text, required, conditional ? 'conditional' : match ? 'match' : 'different');
        if (condition) Object.assign(reasonDetails.at(-1), { conditionStatus: condition.conditionStatus, conditionalRuleId: condition.ruleId });
        if (reverse) detail(actual, 'self', text, false, match ? 'match' : 'different');
        if (!match && !conditional) differences.push(text);
        else if (!reverse) matched.push(text);
      }
      return { id: candidate.id, label: candidate.label, tagline: candidate.tagline, ...(candidate.region !== undefined ? { region: candidate.region } : {}), status,
        ...(snoozed ? { reasonCode: 'snoozed', snoozedUntil: snooze.until } : {}),
        reason: snoozed ? '내가 정한 기간 동안 다시 보지 않기로 한 후보예요. 회차를 바꿔도 숨김은 유지돼요.' : skipped ? '내가 이번 추천에서만 넘긴 후보예요. 일반 취향이나 상대의 마음을 판단한 것은 아니에요.' : me.conflicts.length ? '이번 선택과 평소 필수조건이 달라 추천을 보류했어요. 필수조건은 따로 고쳐야 해요.' : status === 'excluded' ? '한쪽 이상의 필수조건을 충족하지 않아 추천에서 제외했어요.' : status === 'pending' ? '필수 확인이 남아 추천을 보류했어요.' : '서로 밝힌 필수조건을 충족해 비교할 수 있어요. 상대의 호감이나 수락을 뜻하지 않아요.',
        matched, differences, unknown, reciprocal, reasonDetails,
        score: status === 'eligible' ? outbound.result.ranked[0].score + inbound.result.ranked[0].score : null };
    });
    rows.sort((a, b) => ({ eligible: 0, pending: 1, excluded: 2 }[a.status] - { eligible: 0, pending: 1, excluded: 2 }[b.status])
      || (b.score ?? 0) - (a.score ?? 0)
      || (a.status === 'eligible' ? (me.exposures.get(a.id)?.count || 0) - (me.exposures.get(b.id)?.count || 0) : 0) || a.id.localeCompare(b.id));
    const eligible = rows.filter(row => row.status === 'eligible'), top = eligible[0] || null;
    return { status: me.conflicts.length ? 'blocked' : !own(me.values, 'availability') ? 'needs-confirmation' : top ? 'ready' : rows.some(row => row.status === 'pending') ? 'needs-confirmation' : 'blocked',
      rows, top, tied: !!top && eligible.filter(row => row.score === top.score).length > 1 };
  }
  // These are product comparison keys, not authorization or signatures. Historical
  // counterpart profiles are never copied into the explanation basis.
  function shownKey(me, result, at) {
    return fingerprint({ values: me.values, hardValues: me.hardValues, required: [...me.required].sort(), priorities: [...me.priorities].sort(),
      pool: [...pool].sort((a, b) => a.id.localeCompare(b.id)), status: result.status,
      candidates: result.rows.map(row => ({ id: row.id, status: row.status, reasonCode: row.reasonCode || null })).sort((a, b) => a.id.localeCompare(b.id)),
      leaders: result.top ? result.rows.filter(row => row.status === 'eligible' && row.score === result.top.score).map(row => row.id).sort() : [],
      ...(conditionalKey(me, at) ? { conditionalKey: conditionalKey(me, at) } : {}) });
  }
  function shownBasis(runtime, me, at) {
    return { version: 1, contextId: runtime.context.id,
      fields: DISCOVERY_FIELDS.map(field => {
        const source = runtime.unknown.get(field.id) || me.provenance[field.id];
        return { id: field.id, key: fingerprint({ state: runtime.unknown.has(field.id) ? 'explicit-unknown' : own(me.values, field.id) ? 'known' : 'missing',
          value: own(me.values, field.id) ? me.values[field.id] : null, hardValue: own(me.hardValues, field.id) ? me.hardValues[field.id] : null,
          required: field.kind === 'required' || me.required.includes(field.id) }),
        sourceId: source?.eventId || null, until: source?.until || null, duration: source?.duration || null };
      }), priorities: [...me.priorities].sort(), ...(conditionalKey(me, at) ? { conditionalKey: conditionalKey(me, at) } : {}),
      poolKey: fingerprint([...pool].sort((a, b) => a.id.localeCompare(b.id))),
      visibilityKey: fingerprint({ skipped: [...runtime.comparisonSkips].sort(), hidden: [...runtime.snoozes.values()]
        .filter(item => instant(at) < instant(item.until)).map(item => ({ id: item.id, until: item.until })).sort((a, b) => a.id.localeCompare(b.id)) }) };
  }
  function repetitionView(runtime, me, result, at) {
    if (me.closed || me.values.consent !== true || !runtime.lastShown) return { status: 'not-shown', lastShownAt: null, reasons: [], summary: '직접 살펴본 추천과 비교할 기록이 아직 없어요.' };
    const same = runtime.lastShown.key === shownKey(me, result, at);
    const before = runtime.lastShown.basis, after = before ? shownBasis(runtime, me, at) : null, reasons = [];
    if (before) {
      const differentContext = before.contextId !== after.contextId;
      const expired = [...(me.layers.baseline.expired || []), ...(me.layers.context.expired || [])];
      for (const field of before.fields) {
        const current = after.fields.find(item => item.id === field.id);
        // A later replacement may itself have a deadline; it must not make an old
        // declaration look as though expiry caused the observed change.
        if (field.until && instant(at) >= instant(field.until) && expired.some(item => item.field === field.id && item.eventId === field.sourceId)
          && !runtime.changes.some(change => change.field === field.id && instant(change.at) > instant(runtime.lastShown.at)))
          reasons.push({ kind: 'answer-expired', field: field.id, text: `‘${spec(field.id).label}’ 답에 직접 정한 사용 기한이 지났어요.` });
        else if ((field.key !== current.key || field.until !== current.until || field.duration !== current.duration)
          && !(differentContext && field.duration === 'once' && field.sourceId !== current.sourceId))
          reasons.push({ kind: 'answers-changed', field: field.id, text: `비교에 사용하는 내 ‘${spec(field.id).label}’ 답이나 필수조건·사용 범위가 달라졌어요.` });
      }
      if (canonical(before.priorities) !== canonical(after.priorities)) reasons.push({ kind: 'priorities-changed', text: '더 중요하게 비교하기로 한 내 기준이 달라졌어요.' });
      if ((before.conditionalKey || null) !== (after.conditionalKey || null)) reasons.push({ kind: 'conditional-preference-changed', field: 'wants.contact', text: '내가 직접 정한 연락 간격의 허용 조건이나 그 적용 상태가 달라졌어요.' });
      if (before.poolKey !== after.poolKey) reasons.push({ kind: 'public-candidates-changed', text: '현재 비교할 수 있는 공개 후보 또는 공개 정보의 구성이 달라졌어요.' });
      if (differentContext) reasons.push({ kind: 'context-changed', text: '새 추천 회차로 바뀌었어요. 이전 회차에만 적용한 선택은 이어 쓰지 않아요.' });
      if (before.visibilityKey !== after.visibilityKey) reasons.push({ kind: 'visibility-choice-changed', text: '후보를 숨기거나 이번에 넘긴 내 선택, 또는 숨김 기간의 적용 상태가 달라졌어요.' });
    }
    return { status: same ? 'unchanged' : 'changed', lastShownAt: runtime.lastShown.at, reasons,
      summary: same && reasons.length ? '아래 조건에는 변화가 있지만, 현재 비교 결과는 마지막으로 살펴본 때와 같아요.'
        : same ? '마지막으로 살펴본 때와 내 조건과 공개 후보 구성이 같아요. 회차를 바꾸는 것만으로 새 후보가 생기지는 않아요.'
        : '마지막으로 살펴본 뒤 내 조건, 공개 후보 정보 또는 먼저 비교할 후보 묶음이 달라졌어요. 지금 확인된 내용으로 다시 비교했어요.' };
  }
  function fieldSnapshot(runtime, me, field) {
    const read = layer => ({ state: own(layer.values, field) ? 'known' : layer.expired?.some(item => item.field === field) ? 'expired' : 'unknown', value: own(layer.values, field) ? layer.values[field] : null,
      ...(layer.provenance[field]?.until ? { until: layer.provenance[field].until } : {}) });
    return { baseline: read(me.layers.baseline),
      context: runtime.unknown.has(field) ? { state: 'unknown', value: null } : own(me.layers.context.values, field) || me.layers.context.expired?.some(item => item.field === field) ? read(me.layers.context) : { state: 'inherit', value: null },
      effective: read(me), required: spec(field).kind === 'required' || me.required.includes(field) };
  }
  const sceneBasis = (runtime, me, field) => canonical({ value: fieldSnapshot(runtime, me, field),
    baselineEvent: me.layers.baseline.provenance[field]?.eventId || null,
    contextEvent: me.layers.context.provenance[field]?.eventId || null,
    unknownEvent: runtime.unknown.get(field)?.eventId || null });
  function replay(state, at, strictEventId = null, declarationOnly = false) {
    if (!exact(state, synthetic ? ['version', 'scenarioId', 'events'] : ['version', 'scenarioId', 'events', 'ownerId', 'contextId'])
      || !synthetic && (state.ownerId !== ownerId || state.contextId !== contextId || state.scenarioId !== 'first')
      || state.version !== VERSION || !DISCOVERY_SCENARIOS.some(s => s.id === state.scenarioId)
      || !Array.isArray(state.events) || state.events.length > 500) fail('invalid state');
    const runtime = { preferences: [], requirements: {}, skipped: new Set(), unknown: new Map(), selection: null, selectionEvent: null, selectionBasis: null, revision: 0, change: null,
      changes: [], feedback: [], excluded: new Set(), exclusionSources: new Map(), comparisonSkips: new Set(), exposures: new Map(), snoozes: new Map(), lastShown: null, questionsPaused: false,
      priorities: { baseline: [], context: null }, priorityDeadlines: { baseline: null, context: null }, regions: { baseline: null, context: null }, priorityChanges: [], questionMode: null, questionUses: [], deferred: new Map(), reasons: new Map(), sceneResponses: new Map(), sceneSources: new Map(),
      conditional: { baseline: null, context: null }, contextNumber: 1, context: { id: ENCOUNTER, closed: false, expiresAt: null, endedReason: null } };
    const writeRegions = (kind, target, value, id, when, until) => {
      if (kind !== 'set') { runtime.regions[target] = null; return; }
      if (until !== undefined && (utc(until) !== until || instant(until) <= instant(when))) fail('region deadline must be after its declaration');
      const provenance = { eventId: id, source: 'explicit', duration: target === 'baseline' ? 'ongoing' : 'once', encounterId: runtime.context.id, at: when, ...(until ? { until } : {}) };
      runtime.regions[target] = { value: validateMeetingRegions(value), provenance, ...(until ? { until } : {}) };
      if (target === 'baseline') runtime.regions.context = null;
    };
    // A private declaration read never ranks peers or asks hypothetical answers.
    // The ordinary write/recommendation path still performs full candidate checks.
    const replayEvaluation = declarationOnly ? () => ({ status: 'unavailable', rows: [], top: null, tied: false }) : evaluate;
    const preferenceBasis = (me, when) => canonical({ values: me.values, provenance: me.provenance, hardValues: me.hardValues, priorities: me.priorities,
      ...(conditionalKey(me, when) ? { conditionalKey: conditionalKey(me, when) } : {}) });
    const invalidate = () => { runtime.selection = null; runtime.selectionEvent = null; runtime.selectionBasis = null; runtime.revision++; };
    const closeContext = (id, when, reason) => {
      runtime.preferences = P.record({ contract: CONTRACT, scope: prefScope(ME), encounterId: runtime.context.id,
        events: runtime.preferences, at: when, id, kind: 'close' });
      runtime.context.closed = true; runtime.context.endedReason = reason; runtime.unknown.clear(); runtime.skipped.clear(); invalidate();
      runtime.priorities.context = null;
      runtime.priorityDeadlines.context = null; runtime.regions.context = null;
      runtime.conditional.context = null;
      runtime.sceneResponses.clear();
      runtime.change = null;
    };
    const expire = when => {
      if (!runtime.context.closed && runtime.context.expiresAt && instant(when) >= instant(runtime.context.expiresAt))
        closeContext(`expiry-${runtime.contextNumber}`, runtime.context.expiresAt, 'expired');
    };
    // START is a reproducible fixture clock, not the earliest legal product date.
    let priorAt = -Infinity;
    for (const [index, event] of state.events.entries()) {
      const allowed = { set: ['field', 'value', 'required', 'target', 'until', 'optionalUse', 'sceneResponseId'], clear: ['field', 'target', 'required'], 'mark-unknown': ['field', 'optionalUse'], 'revert-context': ['field'],
        'close-context': [], 'start-context': ['expiresAt'], skip: ['field', 'optionalUse'], select: synthetic ? ['candidateId'] : ['candidateId', 'candidateKey'], unselect: [],
        feedback: ['candidateId', 'reason', 'decision'], 'restore-candidate': ['candidateId', 'feedbackId'], expose: ['candidateIds', 'shownKey', 'shownBasis'], 'stop-questions': [], 'continue-questions': [], 'undo-field': ['field', 'changeId'],
        priorities: ['fields', 'target', 'until'], 'undo-priorities': ['changeId'], 'question-mode': ['mode'], 'defer-question': ['field', 'optionalUse'], reason: ['field', 'value'],
        'scene-respond': ['sceneId', 'choice'], 'scene-withdraw': ['sceneId'], 'hide-candidate': ['candidateId', 'days'], 'unhide-candidate': ['candidateId'],
        'conditional-set': ['ruleId', 'target', 'until', 'rule'], 'conditional-clear': ['target'] };
      if (!event || !own(allowed, event.kind) || !exact(event, ['id', 'at', 'kind', ...allowed[event.kind]]) || event.id !== `event-${index + 1}`
        || utc(event.at) !== event.at || instant(event.at) <= priorAt || instant(event.at) > instant(at)) fail('invalid or unordered event');
      priorAt = instant(event.at);
      expire(event.at);
      if (event.kind === 'conditional-set' || event.kind === 'conditional-clear') {
        if (!ConditionalPreference?.validateRule || !ConditionalPreference?.assess) fail('Core conditional preference support is required');
        const me = project(runtime, event.at);
        if (runtime.context.closed || me.values.consent !== true || !['baseline', 'context'].includes(event.target)) fail('current consent, context and explicit rule target required');
        const before = replayEvaluation(me, event.at);
        if (event.kind === 'conditional-clear') {
          if (!runtime.conditional[event.target]) fail('no saved conditional preference to clear');
          runtime.conditional[event.target] = null;
        } else {
          if (event.ruleId !== 'contact-with-notice' || me.required.includes('wants.contact') || me.values['wants.contact'] !== 'daily'
            || !conditionalSource(me.provenance['wants.contact'])) fail('an optional explicit daily contact preference is required');
          const source = conditionalSource(me.provenance['wants.contact']);
          const expected = { version: ConditionalPreference.VERSION, id: event.ruleId, scope: prefScope(ME), field: 'wants.contact', feature: 'self.contact',
            primary: 'daily', alternative: 'few-days', when: { field: 'self.notice', value: 'advance' }, target: event.target,
            encounterId: runtime.context.id, at: event.at, until: event.until ?? null, source };
          ConditionalPreference.validateRule({ contract: CONTRACT, scope: prefScope(ME), rule: expected });
          if (canonical(event.rule) !== canonical(expected)) fail('conditional rule must bind the current explicit source');
          if (event.target === 'context' && runtime.context.expiresAt && event.until && instant(event.until) > instant(runtime.context.expiresAt)) fail('conditional rule outlives current context');
          runtime.conditional[event.target] = { rule: copy(expected), invalidated: false };
          if (event.target === 'baseline') runtime.conditional.context = null;
        }
        invalidate();
        const after = replayEvaluation(project(runtime, event.at), event.at);
        runtime.change = { beforeId: before.top?.id || null, beforeLabel: before.top?.label || null, afterId: after.top?.id || null, afterLabel: after.top?.label || null,
          reason: event.kind === 'conditional-clear' ? '직접 정한 연락 간격의 허용 조건을 철회했어요. 기본 선호와 필수조건은 그대로예요.'
            : '바쁠 때 미리 알린다고 공개한 상대에게만 며칠 간격을 허용해요. 기본 선호와 필수조건은 그대로예요.' };
        continue;
      }
      if (event.kind === 'hide-candidate' || event.kind === 'unhide-candidate') {
        const me = project(runtime, event.at), person = pool.find(candidate => candidate.id === event.candidateId);
        if (!accountId(event.candidateId) || event.kind === 'hide-candidate' && ![7, 30].includes(event.days)) fail('invalid candidate hiding period');
        if (event.id === strictEventId && (!person || me.values.consent !== true || me.closed)) fail('only a currently authorized candidate can be hidden or restored');
        if (event.kind === 'unhide-candidate') {
          if (!runtime.snoozes.has(event.candidateId)) fail('no candidate hiding choice to withdraw');
          runtime.snoozes.delete(event.candidateId);
        } else {
          const end = instant(event.at) + event.days * DAY;
          if (!Number.isSafeInteger(end) || Math.abs(end) > 8640000000000000) fail('candidate hiding deadline is outside the supported time range');
          runtime.snoozes.set(event.candidateId, { id: event.candidateId, at: event.at, until: new Date(end).toISOString() });
        }
        invalidate(); continue;
      }
      if (event.kind === 'scene-respond' || event.kind === 'scene-withdraw') {
        const scene = sceneSpec(event.sceneId), me = project(runtime, event.at);
        if (!scene || runtime.context.closed || me.values.consent !== true) fail('a current consented scene is required');
        if (event.kind === 'scene-withdraw') {
          const old = runtime.sceneResponses.get(scene.id);
          if (!old) fail('no current scene response to withdraw');
          // A separately approved setting is an explicit declaration. Removing
          // this private reaction only withdraws its unapproved suggestion.
          runtime.sceneResponses.delete(scene.id); continue;
        }
        if (!['a', 'b', 'neither', 'depends'].includes(event.choice)) fail('invalid scene response');
        if (event.id === strictEventId && sceneBlock(runtime, me, scene, event.at)) fail('scene question is paused, deferred or over its daily budget');
        runtime.sceneResponses.set(scene.id, { id: event.id, sceneId: scene.id, field: scene.field, choice: event.choice, at: event.at,
          contextId: runtime.context.id, basis: sceneBasis(runtime, me, scene.field) });
        runtime.questionUses.push({ field: scene.field, at: event.at }); continue;
      }
      if (own(event, 'optionalUse')) {
        if (event.optionalUse !== true || runtime.questionMode === null || !spec(event.field)) fail('invalid optional question use');
        if (event.id === strictEventId) {
          const selected = question(runtime, project(runtime, event.at), event.at);
          if (!selected?.optional || selected.field !== event.field) fail('only the selected optional question counts toward its budget');
        }
        runtime.questionUses.push({ field: event.field, at: event.at });
      }
      if (event.kind === 'question-mode') {
        if (!own(OPTIONAL_BUDGET, event.mode)) fail('invalid question mode');
        runtime.questionMode = event.mode; continue;
      }
      if (event.kind === 'defer-question') {
        if (runtime.context.closed || !spec(event.field) || spec(event.field).kind === 'required' || runtime.requirements[event.field]) fail('only an optional question can be deferred');
        if (event.id === strictEventId) {
          // Budget use has already been recorded; inspect the pre-charge choice.
          const beforeCharge = { ...runtime, questionUses: own(event, 'optionalUse') ? runtime.questionUses.slice(0, -1) : runtime.questionUses };
          const selected = question(beforeCharge, project(beforeCharge, event.at), event.at);
          if (!selected?.optional || selected.field !== event.field) fail('only the selected optional question can be deferred');
        }
        runtime.deferred.set(event.field, { field: event.field, at: event.at, until: new Date(instant(event.at) + 7 * DAY).toISOString() }); continue;
      }
      if (event.kind === 'reason') {
        if (event.field !== 'wants.contact' || !['conversation', 'predictability', 'temporary', 'unsure'].includes(event.value)) fail('invalid private choice reason');
        runtime.reasons.set(event.field, { id: event.id, field: event.field, value: event.value, at: event.at }); continue;
      }
      if (event.kind === 'undo-priorities') {
        const source = runtime.priorityChanges.find(change => change.id === event.changeId);
        if (runtime.context.closed || !source || source.kind !== 'priorities' || source.contextId !== runtime.context.id
          || runtime.priorityChanges.filter(change => change.target === source.target).at(-1)?.id !== source.id)
          fail('only the latest current-context priority change can be undone');
        const before = copy(runtime.priorities[source.target]), beforeUntil = runtime.priorityDeadlines[source.target];
        const expired = source.beforeUntil && instant(event.at) >= instant(source.beforeUntil);
        runtime.priorities[source.target] = expired ? source.target === 'context' ? null : [] : copy(source.before);
        runtime.priorityDeadlines[source.target] = expired ? null : source.beforeUntil || null; invalidate();
        runtime.priorityChanges.push({ id: event.id, kind: event.kind, contextId: runtime.context.id, at: event.at, target: source.target,
          before, after: copy(runtime.priorities[source.target]), ...(beforeUntil ? { beforeUntil } : {}), ...(runtime.priorityDeadlines[source.target] ? { afterUntil: runtime.priorityDeadlines[source.target] } : {}) });
        runtime.change = null; continue;
      }
      if (event.kind === 'priorities') {
        if (!['baseline', 'context'].includes(event.target) || !Array.isArray(event.fields) || event.fields.length > 2 || new Set(event.fields).size !== event.fields.length
          || event.fields.some(field => spec(field)?.kind !== 'wants' || spec(field)?.legacy && event.id === strictEventId)) fail('choose at most two wants priorities');
        if (event.target === 'context' && runtime.context.closed) fail('context is closed; start a new context');
        const person = project(runtime, event.at), before = replayEvaluation(person, event.at);
        if (own(event, 'until')) {
          if (utc(event.until) !== event.until || instant(event.until) <= instant(event.at)) fail('priority deadline must be in the future');
          const deadlines = [...event.fields.map(field => (event.target === 'baseline' ? person.layers.baseline : person).provenance[field]?.until),
            ...(event.target === 'context' ? [runtime.context.expiresAt] : [])].filter(Boolean);
          if (deadlines.some(until => instant(event.until) > instant(until))) fail('priority deadline exceeds its answer or context');
        }
        const beforeFields = copy(runtime.priorities[event.target]);
        const beforeUntil = runtime.priorityDeadlines[event.target];
        runtime.priorities[event.target] = [...event.fields]; invalidate();
        runtime.priorityDeadlines[event.target] = event.until || null;
        runtime.priorityChanges.push({ id: event.id, kind: event.kind, contextId: runtime.context.id, at: event.at, target: event.target,
          before: beforeFields, after: [...event.fields], ...(beforeUntil ? { beforeUntil } : {}), ...(event.until ? { afterUntil: event.until } : {}) });
        const after = replayEvaluation(project(runtime, event.at), event.at);
        runtime.change = { beforeId: before.top?.id || null, beforeLabel: before.top?.label || null, afterId: after.top?.id || null, afterLabel: after.top?.label || null,
          reason: `더 중요하게 볼 항목을 ${event.target === 'context' ? '이번 추천에' : '평소 기준에'} 반영했어요. 필수조건은 그대로예요.${before.top?.id === after.top?.id ? ' 먼저 살펴볼 후보는 그대로예요.' : ' 먼저 살펴볼 후보가 달라졌어요.'}` }; continue;
      }
      if (event.kind === 'close-context') {
        if (runtime.context.closed) fail('context is already closed');
        closeContext(event.id, event.at, 'closed'); continue;
      }
      if (event.kind === 'start-context') {
        if (own(event, 'expiresAt') && (utc(event.expiresAt) !== event.expiresAt || instant(event.expiresAt) <= instant(event.at))) fail('context expiry must be in the future');
        if (!runtime.context.closed) closeContext(`${event.id}.close`, event.at, 'replaced');
        runtime.contextNumber++;
        runtime.context = { id: `discovery-context-${runtime.contextNumber}`, closed: false, expiresAt: event.expiresAt || null, endedReason: null };
        runtime.unknown.clear(); runtime.skipped.clear(); runtime.excluded.clear(); runtime.exclusionSources.clear(); runtime.comparisonSkips.clear(); runtime.questionsPaused = false;
        for (const exposure of runtime.exposures.values()) exposure.currentCount = 0;
        invalidate(); runtime.change = null; continue;
      }
      if (event.kind === 'stop-questions' || event.kind === 'continue-questions') { runtime.questionsPaused = event.kind === 'stop-questions'; continue; }
      if (event.kind === 'restore-candidate') {
        const me = project(runtime, event.at), source = runtime.exclusionSources.get(event.candidateId);
        if (!accountId(event.candidateId) || typeof event.feedbackId !== 'string' || !/^event-[1-9][0-9]*$/.test(event.feedbackId)) fail('invalid candidate exclusion source');
        if (runtime.context.closed || me.values.consent !== true || !source || source.id !== event.feedbackId || source.contextId !== runtime.context.id)
          fail('only the latest current-context candidate exclusion can be restored');
        // Historical restoration still replays if its person later withdraws
        // public disclosure. A new write must use the currently authorized pool.
        if (event.id === strictEventId && !pool.some(person => person.id === event.candidateId)) fail('only a currently authorized candidate exclusion can be restored');
        runtime.exclusionSources.delete(event.candidateId); runtime.excluded.delete(event.candidateId); runtime.comparisonSkips.delete(event.candidateId);
        const feedback = runtime.feedback.find(item => item.id === source.id);
        if (feedback) { feedback.restoredAt = event.at; feedback.restorationId = event.id; }
        invalidate(); runtime.change = null; continue;
      }
      if (event.kind === 'feedback' || event.kind === 'expose') {
        const me = project(runtime, event.at), visible = replayEvaluation(me, event.at);
        if (runtime.context.closed || me.values.consent !== true) fail('current consent and an active context are required');
        if (event.kind === 'feedback') {
          const candidate = declarationOnly ? pool.find(person => person.id === event.candidateId) : visible.rows.find(row => row.id === event.candidateId);
          if (!accountId(event.candidateId) || !DISCOVERY_FEEDBACK_REASONS.some(reason => reason.id === event.reason) || !['record-only', 'skip-current'].includes(event.decision)) fail('invalid candidate feedback');
          if (event.decision === 'skip-current') {
            runtime.comparisonSkips.add(event.candidateId);
            runtime.exclusionSources.set(event.candidateId, { id: event.id, at: event.at, contextId: runtime.context.id, candidateId: event.candidateId });
          }
          if (!candidate) { if (!synthetic && strictEventId !== event.id) continue; fail('invalid candidate feedback'); }
          runtime.feedback.push({ id: event.id, at: event.at, contextId: runtime.context.id, candidateId: candidate.id, label: candidate.label, reason: event.reason, decision: event.decision });
          if (event.decision === 'skip-current') { runtime.excluded.add(candidate.id); invalidate(); }
        } else {
          if (!Array.isArray(event.candidateIds) || event.candidateIds.length > 100 || new Set(event.candidateIds).size !== event.candidateIds.length
            || event.candidateIds.some(id => !accountId(id))
            || !declarationOnly && (strictEventId === event.id || synthetic && !(me.required.includes('wants.purpose') && me.hardValues['wants.purpose'] !== 'any')) && (!event.candidateIds.length && visible.rows.some(row => row.status === 'eligible')
              || event.candidateIds.some(id => !visible.rows.some(row => row.id === id && row.status === 'eligible')))) fail('only currently eligible displayed candidates can be exposed');
          if (own(event, 'shownKey')) {
            if (!/^[a-f0-9]{16}$/.test(event.shownKey) || event.id === strictEventId && event.shownKey !== shownKey(me, visible, event.at)) fail('invalid displayed recommendation basis');
            if (own(event, 'shownBasis')) {
              const expected = shownBasis(runtime, me, event.at);
              const historicalIds = DISCOVERY_FIELDS.filter(field => field.legacy || !field.id.includes('relationship') && field.kind !== 'regions').map(field => field.id);
              const historical = event.id !== strictEventId && Array.isArray(event.shownBasis.fields)
                && canonical(event.shownBasis.fields.map(field => field.id)) === canonical(historicalIds);
              const compatible = historical ? { ...expected, fields: expected.fields.filter(field => historicalIds.includes(field.id)) } : expected;
              if (!exact(event.shownBasis, Object.keys(expected)) || !/^[a-f0-9]{16}$/.test(event.shownBasis.poolKey)
                || canonical({ ...event.shownBasis, poolKey: expected.poolKey }) !== canonical(compatible)
                || event.id === strictEventId && event.shownBasis.poolKey !== expected.poolKey) fail('invalid displayed explanation basis');
            }
            runtime.lastShown = { key: event.shownKey, at: event.at, ...(event.shownBasis ? { basis: copy(event.shownBasis) } : {}) };
          } else runtime.lastShown = null; // Legacy exposure did not retain its historical comparison basis.
          for (const id of event.candidateIds.filter(id => pool.some(person => person.id === id))) {
            const old = runtime.exposures.get(id) || { candidateId: id, count: 0, currentCount: 0 };
            runtime.exposures.set(id, { ...old, count: old.count + 1, currentCount: old.currentCount + 1, lastAt: event.at });
          }
        }
        continue;
      }
      if (event.kind === 'undo-field') {
        const lastChange = runtime.changes.filter(change => change.field === event.field).at(-1);
        if (runtime.context.closed || event.field === 'consent' || !lastChange || lastChange.id !== event.changeId || lastChange.kind === 'undo-field' || lastChange.contextId !== runtime.context.id) fail('only the latest current-context field change can be undone; consent requires a direct answer');
        const before = fieldSnapshot(runtime, project(runtime, event.at), event.field), target = lastChange.before;
        const write = (suffix, duration, layer) => {
          const kind = layer.state === 'known' && (!layer.until || instant(layer.until) > instant(event.at)) ? 'set' : 'withdraw';
          if (spec(event.field)?.kind === 'regions') { writeRegions(kind, duration === 'ongoing' ? 'baseline' : 'context', layer.value, `${event.id}.${suffix}`, event.at, layer.until); return; }
          runtime.preferences = P.record({ contract: CONTRACT, scope: prefScope(ME), encounterId: runtime.context.id,
            events: runtime.preferences, at: event.at, id: `${event.id}.${suffix}`, kind, field: event.field, duration,
            ...(kind === 'set' ? { value: layer.value, ...(layer.until ? { until: layer.until } : {}) } : {}) }); };
        write('baseline', 'ongoing', target.baseline);
        write('context', 'once', target.context);
        runtime.requirements[event.field] = target.required; runtime.unknown.delete(event.field); runtime.skipped.delete(event.field);
        if (target.context.state === 'unknown') {
          runtime.unknown.set(event.field, { eventId: event.id, at: event.at, source: 'explicit', duration: 'once', encounterId: runtime.context.id });
          if (!target.required) runtime.skipped.add(event.field);
        }
        if (event.field === 'wants.contact') for (const entry of Object.values(runtime.conditional)) if (entry) entry.invalidated = true;
        invalidate();
        runtime.changes.push({ id: event.id, kind: event.kind, field: event.field, label: spec(event.field).label, at: event.at, contextId: runtime.context.id,
          before, after: fieldSnapshot(runtime, project(runtime, event.at), event.field) });
        runtime.change = null; continue;
      }
      if (['set', 'clear', 'mark-unknown', 'revert-context'].includes(event.kind)) {
        const field = spec(event.field); if (!field) fail('unknown field');
        if (own(event, 'target') && !['baseline', 'context'].includes(event.target)) fail('invalid preference target');
        const target = ['mark-unknown', 'revert-context'].includes(event.kind) ? 'context' : event.target || 'baseline';
        if (!['baseline', 'context'].includes(target)) fail('invalid preference target');
        if (target === 'context' && (field.kind === 'self' || field.id === 'consent')) fail('only wants and explicit availability (or meeting regions) support a context choice');
        if (target === 'context' && runtime.context.closed) fail('context is closed; start a new context');
        if (event.kind === 'set' && (typeof event.required !== 'boolean' || field.kind !== 'wants' && event.required !== (field.kind === 'required'))) fail('invalid requirement flag');
        if (event.kind === 'clear' && own(event, 'required')
          && !(event.field === 'wants.purpose' && target === 'baseline' && event.required === false && runtime.requirements[event.field] === true))
          fail('only an explicit legacy baseline retirement can clear a requirement flag');
        if (target === 'context' && event.kind === 'set' && field.kind === 'wants' && event.required !== (runtime.requirements[field.id] === true)) fail('context choice cannot change a hard requirement');
        const beforePerson = project(runtime, event.at), beforeField = fieldSnapshot(runtime, beforePerson, event.field), before = replayEvaluation(beforePerson, event.at);
        if (field.legacy && event.kind === 'set' && event.id === strictEventId
          && !(event.field === 'wants.purpose' && runtime.requirements[event.field] === true && target === 'baseline' && event.required === false
            && event.value === beforePerson.layers.baseline.values[event.field] && !own(event, 'until') && !own(event, 'sceneResponseId')))
          fail('legacy relationship answers are history-only; choose goal and speed separately');
        let sceneResponse = null;
        if (own(event, 'sceneResponseId')) {
          sceneResponse = [...runtime.sceneResponses.values()].find(response => response.id === event.sceneResponseId);
          const suggestion = sceneResponse && sceneSuggestion(runtime, beforePerson, sceneResponse);
          if (!suggestion || event.field !== suggestion.field || event.value !== suggestion.value || target !== 'context'
            || event.until !== suggestion.until) fail('stale or changed scene suggestion');
        }
        if (field.kind === 'regions') writeRegions(event.kind, target, event.value, event.id, event.at, event.until);
        else runtime.preferences = P.record({ contract: CONTRACT, scope: prefScope(ME), encounterId: target === 'baseline' && runtime.context.closed ? 'discovery-profile' : runtime.context.id, events: runtime.preferences, at: event.at,
          id: event.id, kind: event.kind === 'set' ? 'set' : 'withdraw', field: event.field, duration: target === 'context' ? 'once' : 'ongoing', ...(event.kind === 'set' ? { value: event.value, ...(own(event, 'until') ? { until: event.until } : {}) } : {}) });
        // An explicit edit/unknown/undo requires a new allowance confirmation.
        // Returning to the same enum later cannot revive an old allowance.
        if (event.field === 'wants.contact') for (const entry of Object.values(runtime.conditional)) if (entry) entry.invalidated = true;
        if (event.kind === 'set' && target === 'baseline') runtime.requirements[event.field] = event.required;
        if (event.kind === 'clear' && own(event, 'required')) runtime.requirements[event.field] = false;
        if (sceneResponse) {
          sceneResponse.appliedEventId = event.id;
          runtime.sceneSources.set(event.id, { sceneId: sceneResponse.sceneId, responseId: sceneResponse.id });
        }
        if (event.kind === 'mark-unknown') runtime.unknown.set(event.field, { eventId: event.id, at: event.at, source: 'explicit', duration: 'once', encounterId: runtime.context.id });
        else if (!(event.kind === 'clear' && target === 'baseline')) runtime.unknown.delete(event.field);
        runtime.skipped.delete(event.field); invalidate();
        if (event.field === 'consent' && (event.kind !== 'set' || event.value !== true)) { runtime.sceneResponses.clear(); runtime.lastShown = null; }
        if (runtime.unknown.has(event.field) && field.kind === 'wants' && !runtime.requirements[event.field]) runtime.skipped.add(event.field);
        const after = replayEvaluation(project(runtime, event.at), event.at);
        const phrase = event.kind === 'mark-unknown' ? '이번에는 아직 모르는 항목으로 남겼어요. 평소 답으로 채우지 않아요.'
          : event.kind === 'revert-context' || event.kind === 'clear' && target === 'context' ? '이번 선택을 취소하고 유효한 평소 답으로 돌아갔어요.'
            : event.kind === 'clear' ? '평소 답을 지워 미확인으로 바꿨어요.'
              : `‘${labelValue(field.id, event.value)}’${field.kind === 'wants' && event.required ? '(필수조건 유지)' : ''}을 ${target === 'context' ? '이번 추천에서만' : '앞으로도'} 적용해요.`;
        runtime.change = { beforeId: before.top?.id || null, beforeLabel: before.top?.label || null, afterId: after.top?.id || null, afterLabel: after.top?.label || null,
          reason: `${field.label}: ${phrase} 쌍방 조건을 다시 살펴봤어요.${before.top?.id === after.top?.id ? ' 먼저 살펴볼 후보는 그대로예요.' : ' 먼저 살펴볼 후보가 달라졌어요.'}` };
        runtime.changes.push({ id: event.id, kind: event.kind, field: event.field, label: field.label, at: event.at, contextId: runtime.context.id,
          before: beforeField, after: fieldSnapshot(runtime, project(runtime, event.at), event.field) });
        continue;
      }
      const me = project(runtime, event.at);
      if (event.kind === 'skip') {
        if (runtime.context.closed) fail('context is closed');
        if (!spec(event.field) || spec(event.field).kind === 'required' || own(me.values, event.field) || me.required.includes(event.field)
          || considering(me, event.at).some(person => person.required.includes(event.field.replace('self.', 'wants.')) && event.field.startsWith('self.'))) fail('only an unknown optional question can be skipped');
        runtime.skipped.add(event.field); continue;
      }
      if (event.kind === 'unselect') { runtime.selection = null; runtime.selectionEvent = null; continue; }
      if (!synthetic && (!accountId(event.candidateId) || !/^[a-f0-9]{16}$/.test(event.candidateKey))) fail('invalid external candidate selection');
      const candidate = declarationOnly ? pool.find(person => person.id === event.candidateId) : evaluate(me, event.at).rows.find(row => row.id === event.candidateId && row.status === 'eligible');
      if (!candidate || !synthetic && event.candidateKey !== fingerprint(pool.find(person => person.id === event.candidateId))) {
        if (event.id !== strictEventId && me.required.includes('wants.purpose') && me.hardValues['wants.purpose'] !== 'any') {
          runtime.selection = null; runtime.selectionEvent = null; continue;
        }
        if (!synthetic && strictEventId !== event.id) { runtime.selection = null; runtime.selectionEvent = null; continue; }
        fail('candidate is not currently eligible');
      }
      runtime.selection = { candidateId: candidate.id, label: candidate.label, revision: runtime.revision };
      runtime.selectionEvent = event;
        runtime.selectionBasis = preferenceBasis(me, event.at);
    }
    expire(at);
    if (runtime.selection && runtime.selectionBasis !== preferenceBasis(project(runtime, at), at)) {
      runtime.selection = null; runtime.selectionEvent = null; runtime.selectionBasis = null;
    }
    return runtime;
  }
  function appendRecord(state, input, allowSceneSource = false) {
    if (!exact(input, ['kind', 'field', 'value', 'required', 'candidateId', 'candidateIds', 'reason', 'decision', 'changeId', 'target', 'expiresAt', 'until', 'fields', 'mode', 'at', 'sceneId', 'choice', 'sceneResponseId', 'days', 'ruleId', 'feedbackId'])) fail('invalid action');
    if (own(input, 'sceneResponseId') && !allowSceneSource) fail('a scene suggestion needs preview and explicit application');
    if (input.kind === 'set' && spec(input.field)?.kind === 'regions') validateMeetingRegions(input.value);
    if (['conditional-set', 'conditional-clear'].includes(input.kind) && !allowSceneSource) fail('conditional preferences need preview and explicit application');
    const last = state?.events?.at(-1)?.at || START, runtime = replay(state, last);
    const event = { ...copy(input), id: `event-${state.events.length + 1}`, at: input.at === undefined ? new Date(instant(last) + 1000).toISOString() : utc(input.at) };
    if (event.kind === 'set' && spec(event.field)?.kind === 'regions') event.value = validateMeetingRegions(event.value);
    if (!synthetic && event.kind === 'select') {
      const candidate = pool.find(person => person.id === event.candidateId);
      if (!candidate) fail('candidate is not currently eligible');
      event.candidateKey = fingerprint(candidate);
    }
    if (event.kind === 'expose') {
      const current = replay(state, event.at), me = project(current, event.at);
      event.shownKey = shownKey(me, evaluate(me, event.at), event.at);
      event.shownBasis = shownBasis(current, me, event.at);
    }
    if (event.kind === 'conditional-set') {
      if (!ConditionalPreference?.validateRule) fail('Core conditional preference support is required');
      const current = replay(state, event.at), me = project(current, event.at);
      event.rule = { version: ConditionalPreference.VERSION, id: event.ruleId, scope: prefScope(ME), field: 'wants.contact', feature: 'self.contact',
        primary: 'daily', alternative: 'few-days', when: { field: 'self.notice', value: 'advance' }, target: event.target,
        encounterId: current.context.id, at: event.at, until: event.until ?? null, source: conditionalSource(me.provenance['wants.contact']) };
    }
    if (event.kind === 'set' && !own(event, 'required')) event.required = spec(event.field)?.kind === 'required' || runtime.requirements[event.field] === true;
    if (!own(event, 'sceneResponseId') && runtime.questionMode !== null && ['set', 'mark-unknown', 'skip', 'defer-question'].includes(event.kind)) {
      const currentRuntime = replay(state, event.at), selected = question(currentRuntime, project(currentRuntime, event.at), event.at);
      if (selected?.optional && selected.field === event.field) event.optionalUse = true;
    }
    const result = { ...copy(state), events: [...copy(state.events), event] }; replay(result, event.at, event.id); return result;
  }
  function record(state, input) { return appendRecord(state, input); }
  function sceneBlock(runtime, me, scene, at, currentQuestion) {
    if (me.closed || me.values.consent !== true) return '먼저 현재 추천과 후보 살펴보기 동의를 확인해 주세요.';
    if (runtime.questionsPaused) return '선택 질문을 쉬고 있어요. 질문을 계속하기로 고른 뒤 살펴볼 수 있어요.';
    if (runtime.deferred.has(scene.field) && instant(at) < instant(runtime.deferred.get(scene.field).until)) return '이 항목은 잠시 묻지 않기로 했어요. 쉬는 기간이 끝난 뒤 살펴볼 수 있어요.';
    if (runtime.questionUses.filter(item => questionDay(item.at) === questionDay(at)).length >= (runtime.questionMode === null ? 1 : OPTIONAL_BUDGET[runtime.questionMode])) return '오늘 고른 선택 질문 수를 채웠어요. 다음 날 다시 살펴볼 수 있어요.';
    if ((currentQuestion === undefined ? question(runtime, me, at) : currentQuestion)?.optional === false) return '필수 확인을 먼저 마친 뒤 장면을 비교할 수 있어요.';
    return null;
  }
  function sceneSuggestion(runtime, me, response) {
    const scene = sceneSpec(response.sceneId);
    if (!scene || response.contextId !== runtime.context.id || me.closed || me.values.consent !== true || response.appliedEventId
      || !['a', 'b'].includes(response.choice) || response.basis !== sceneBasis(runtime, me, scene.field)) return null;
    return { responseId: response.id, field: scene.field, value: scene[response.choice].value, target: 'context',
      ...(me.provenance[scene.field]?.until ? { until: me.provenance[scene.field].until } : {}) };
  }
  function sceneViews(runtime, me, at, currentQuestion) {
    if (me.closed || me.values.consent !== true) return [];
    return SCENES.map(scene => {
      const response = runtime.sceneResponses.get(scene.id), blockedReason = sceneBlock(runtime, me, scene, at, currentQuestion);
      return { id: scene.id, field: scene.field, title: scene.title, intro: scene.intro,
        options: [{ id: 'a', label: '첫 번째가 더 편해요', text: scene.a.text }, { id: 'b', label: '두 번째가 더 편해요', text: scene.b.text },
          { id: 'neither', label: '둘 다 내 답은 아니에요', text: '일반 선호는 바꾸지 않아요.' }, { id: 'depends', label: '상황에 따라 달라요', text: '일반 선호는 바꾸지 않아요.' }],
        response: response ? { id: response.id, choice: response.choice, at: response.at, applied: !!response.appliedEventId } : null,
        suggestion: response ? sceneSuggestion(runtime, me, response) : null, canRespond: blockedReason === null, blockedReason };
    });
  }
  function question(runtime, me, at) { return questionAnalysis(runtime, me, at).question; }
  function questionAnalysis(runtime, me, at) {
    if (me.closed || me.values.consent === false) return { question: null, ranked: [], reason: 'unavailable' };
    const requiredByCandidate = new Set(considering(me, at).flatMap(person => person.required.map(field => field.replace('wants.', 'self.'))));
    const isMandatory = field => field.kind === 'required' || me.required.includes(field.id) || requiredByCandidate.has(field.id);
    if (me.required.includes('wants.purpose') && me.hardValues['wants.purpose'] !== 'any' && me.values.consent === true && own(me.values, 'availability'))
      return { question: null, ranked: [], reason: 'legacy-required-confirmation' };
    let missing = DISCOVERY_FIELDS.filter(field => !field.legacy && field.kind !== 'regions' && (!own(me.values, field.id) || field.kind === 'wants' && me.required.includes(field.id) && !own(me.hardValues, field.id))
      && (!runtime.skipped.has(field.id) || isMandatory(field)));
    if (!own(me.values, 'consent')) missing = missing.filter(field => field.id === 'consent');
    else if (!own(me.values, 'availability')) missing = missing.filter(field => field.id === 'availability');
    const questions = missing.map(field => ({ id: field.id, about: field.id, field: field.id, kind: field.kind === 'required' ? 'confirm' : 'choice',
      label: publicField(field).question, optional: !isMandatory(field), cost: isMandatory(field) ? 0 : QUESTION_COST, options: copy(field.options) }));
    // Local to this analysis only: Ask evaluates the same hypothetical answer
    // against the old and new decision. Do not rerun Domain for each comparison.
    const scenarios = new Map();
    const scenario = answers => {
      const key = canonical(answers);
      if (scenarios.has(key)) return scenarios.get(key);
      const proposed = { ...me, values: { ...me.values, ...answers }, provenance: { ...me.provenance }, hardValues: { ...me.hardValues }, layers: copy(me.layers) };
      for (const field of Object.keys(answers)) proposed.provenance[field] = { eventId: `hypothetical.${field}`, at };
      for (const field of Object.keys(answers)) if (me.required.includes(field) && field.startsWith('wants.')) {
        proposed.hardValues[field] = answers[field]; proposed.layers.baseline.provenance[field] = proposed.provenance[field];
      }
      const result = evaluate(proposed, at), value = { proposed, result };
      scenarios.set(key, value); return value;
    };
    const decide = answers => {
      const { proposed, result } = scenario(answers);
      return { status: result.status, missing: questions.filter(q => !q.optional && (!own(proposed.values, q.field)
        || q.field.startsWith('wants.') && me.required.includes(q.field) && !own(proposed.hardValues, q.field))).map(q => q.field),
        eligible: result.rows.filter(row => row.status === 'eligible').map(row => row.id), pending: result.rows.filter(row => row.status === 'pending').map(row => row.id),
        leaders: result.top ? result.rows.filter(row => row.status === 'eligible' && row.score === result.top.score).map(row => row.id).sort() : [] };
    };
    const decisionValue = ({ decision, answers }) => {
      const truth = scenario(answers).result;
      // Joint leaders are treated conservatively: check their lowest fit under
      // this SAME declared answer, rather than inventing which person is liked.
      const utility = decision.leaders.length ? Math.min(...decision.leaders.map(id => {
        const row = truth.rows.find(candidate => candidate.id === id);
        return row?.status === 'eligible' ? row.score : -REQUIRED_UNKNOWN_LOSS;
      })) : 0;
      return { utility, loss: decision.missing.length * REQUIRED_UNKNOWN_LOSS };
    };
    const mandatory = questions.filter(q => !q.optional);
    const controls = mandatory.length ? {} : { budget: runtime.questionMode === null ? 1 : OPTIONAL_BUDGET[runtime.questionMode],
      usedToday: runtime.questionUses.filter(item => questionDay(item.at) === questionDay(at)).length,
      denied: runtime.questionsPaused ? questions.map(q => q.id) : [],
      asked: Object.fromEntries([...runtime.deferred].map(([field, item]) => [field, item.at])), now: at, quietDays: 7 };
    const choice = Ask.choose({ questions: mandatory.length ? mandatory : questions, decide, evaluate: decisionValue, ...controls });
    const ranked = choice.ranked;
    if (choice.status !== 'ask') return { question: null, ranked: choice.reason === 'budget' ? [] : ranked, reason: choice.reason };
    return { ranked, reason: choice.reason, question: { field: choice.question.field, label: choice.question.label, optional: choice.question.optional, options: copy(choice.question.options),
      target: me.required.includes(choice.question.field) ? 'baseline' : spec(choice.question.field).kind === 'wants' ? 'context' : 'baseline',
      valueBasis: 'declared-decision-value',
      valueReason: !choice.question.optional ? '서로의 필수조건을 비교하는 데 필요한 내 답을 먼저 확인해요.'
        : me.priorities.includes(choice.question.field) ? '내가 중요하게 고른 기준에서 후보를 비교하는 데 도움이 되는 답을 먼저 확인해요.'
          : '현재 후보 중 내 기준에 맞는 선택을 구분하는 데 도움이 되는 답을 먼저 확인해요.',
      why: spec(choice.question.field).kind === 'required' ? '동의와 가능한 일정은 후보를 살펴보기 전에 직접 확인해요.' : spec(choice.question.field).kind === 'self'
        ? '내 방식은 상대가 밝힌 바람과 비교해요. 상대에게 바라는 방식과 따로 기록해요.' : me.required.includes(choice.question.field)
          ? '꼭 지켜야 한다고 고른 조건이에요. 답을 다시 확인해야 추천할 수 있어요.' : '이 상황에서 원하는 답에 따라 후보 순서나 추천 가능 여부가 달라져요. 답하지 않아도 진행할 수 있어요.' } };
  }
  function whatIfView(runtime, me, result, at) {
    const unavailable = (reason, summary) => ({ status: 'unavailable', reason, summary, options: [] });
    if (me.closed) return unavailable('context-ended', '이번 추천이 끝났어요. 새 회차에서 일정을 다시 살펴볼 수 있어요.');
    if (me.values.consent !== true) return unavailable('consent-required', '후보를 살펴볼지 먼저 직접 확인해 주세요.');
    if (result.top) return unavailable('candidates-available', '지금 조건으로 비교할 후보가 있어요.');
    if (me.conflicts.length) return unavailable('context-conflict', '이번 선택과 필수조건이 달라요. 충돌한 내 답부터 확인해 주세요.');
    if (!own(me.values, 'availability')) return unavailable('own-schedule-unknown', '가능한 일정을 먼저 직접 골라 주세요.');
    if (me.required.some(field => field.startsWith('wants.') && !own(me.hardValues, field))) return unavailable('required-answer-unknown', '아직 모르는 필수조건의 답부터 확인해 주세요.');
    if (!pool.length) return unavailable('public-pool-empty', '현재 비교할 공개 후보가 없어 일정 하나를 바꾼 결과도 비교할 수 없어요.');
    const visible = considering(me, at);
    if (!visible.length) return unavailable('candidates-hidden-or-skipped', '직접 숨기거나 이번에 넘긴 후보만 있어요. 일정을 바꿔도 그 선택은 유지해요.');
    if (visible.some(person => person.required.some(field => !own(me.values, field.replace('wants.', 'self.')))))
      return unavailable('reciprocal-answer-unknown', '상대가 공개한 필수조건과 비교할 내 답부터 확인해 주세요.');
    if (visible.every(person => !own(person.values, 'availability')))
      return unavailable('public-schedule-unknown', '비교할 후보의 공개 일정이 미확인이에요. 내 일정을 바꿔도 상대의 일정을 대신 채우지 않아요.');
    const field = spec('availability'), before = canonical(result.rows.map(row => [row.id, row.status]));
    const options = field.options.filter(option => option.value !== me.values.availability).map(option => {
      const after = evaluate({ ...me, values: { ...me.values, availability: option.value } }, at);
      const eligible = after.rows.filter(row => row.status === 'eligible'), changesResult = before !== canonical(after.rows.map(row => [row.id, row.status]));
      const deadlines = [me.provenance.availability?.until, runtime.context.expiresAt].filter(Boolean);
      const action = { kind: 'set', field: field.id, value: option.value, target: 'context',
        ...(deadlines.length ? { until: new Date(Math.min(...deadlines.map(instant))).toISOString() } : {}) };
      return { id: `availability-${option.id}`, field: field.id, label: field.label, value: option.value, valueLabel: option.label, action,
        result: { status: after.status, eligibleCount: eligible.length, topCandidateId: after.top?.id || null, topLabel: after.top?.label || null }, changesResult,
        summary: eligible.length ? `이번 회차에 내 일정이 ‘${option.label}’이면 서로의 필수조건을 충족하는 후보 ${eligible.length}명을 비교할 수 있어요.`
          : changesResult ? `이번 회차에 내 일정이 ‘${option.label}’이어도 다른 필수 확인이나 조건 때문에 추천 가능한 후보는 없어요.`
            : `이번 회차에 내 일정이 ‘${option.label}’이어도 후보의 가능·보류 상태는 같아요.` };
    });
    return { status: 'available', summary: '정말 가능한 일정이 달라졌을 때만 골라 보세요. 이번 회차의 주말·평일 저녁 구분 하나만 비교하며, 평소 답과 다른 필수조건·숨김은 유지해요. 아직 답을 바꾸지 않았어요.', options };
  }
  function insightView(me, result, analysis) {
    const missingFields = DISCOVERY_FIELDS.filter(field => !own(me.values, field.id)
      || field.kind === 'wants' && me.required.includes(field.id) && !own(me.hardValues, field.id)).map(field => field.id);
    const coverage = { known: DISCOVERY_FIELDS.length - missingFields.length, total: DISCOVERY_FIELDS.length, missingFields,
      basis: 'my-explicit-answers', summary: '전체 항목 중 확인한 내 답의 수예요. 상대의 미확인 답이나 추천 정확도를 뜻하지 않아요.' };
    const leaders = result.top ? result.rows.filter(row => row.status === 'eligible' && row.score === result.top.score).map(row => row.id).sort() : [];
    if (me.closed || me.values.consent !== true || !leaders.length) return { coverage, stability: { status: 'unavailable', checkedFields: [], changes: [], summary: '현재 추천이 준비된 뒤에 비교할 수 있어요.' } };
    const checked = analysis.ranked.filter(entry => entry.outcomes), changes = [];
    for (const entry of checked) {
      const leadingSets = Object.entries(entry.outcomes).map(([optionId, outcome]) => ({ optionId,
        label: spec(entry.about).options.find(option => option.id === optionId)?.label || optionId, candidateIds: [...outcome.leaders] }));
      if (leadingSets.some(item => canonical(item.candidateIds) !== canonical(leaders))) changes.push({ field: entry.about, label: spec(entry.about).label, leadingSets });
    }
    const status = changes.length ? 'sensitive' : checked.length ? 'stable-within-checked' : 'not-checked';
    return { coverage, stability: { status, checkedFields: checked.map(entry => entry.about), changes,
      summary: status === 'sensitive' ? '살펴본 미확인 내 답 하나에 따라 먼저 볼 후보나 공동 선두가 달라질 수 있어요.'
        : status === 'stable-within-checked' ? '이번에 비교한 내 답 하나의 변화에서는 먼저 볼 후보 묶음이 같아요. 나머지 조건이나 실제 관계는 확인하지 않았어요.'
          : '지금은 추가 답을 비교하지 않았어요. 질문 중단·쉬는 기간·오늘 질문 수를 그대로 지켜요.' } };
  }
  function conditionalView(runtime, me, at) {
    const state = conditionalState(me, at), source = conditionalSource(me.provenance['wants.contact']);
    const blockReason = me.closed ? '이번 추천이 끝났어요. 새 추천에서 확인해 주세요.' : me.values.consent !== true ? '후보 살펴보기 동의를 먼저 확인해 주세요.'
      : me.required.includes('wants.contact') ? '연락 빈도가 필수조건이에요. 필수조건을 그대로 유지하므로 이 허용 조건은 적용하지 않아요.'
        : me.values['wants.contact'] !== 'daily' || !source ? '상대에게 바라는 연락 빈도를 하루에 한 번쯤으로 직접 정했을 때 선택할 수 있어요.' : null;
    const summary = state.effective.status === 'active' ? '하루에 한 번쯤이라는 기본 선호는 유지해요. 바쁠 때 미리 알린다고 공개한 상대에게만 며칠 간격도 허용해요.'
      : state.effective.status === 'inactive' ? state.effective.reason === 'rule-expired' || state.effective.reason === 'source-expired'
        ? '직접 정한 허용 조건이나 원래 답의 기한이 지나 적용하지 않아요.' : '원래 답이나 사용 범위가 달라져 이전 허용 조건을 적용하지 않아요. 같은 답으로 돌아와도 다시 확인해야 해요.'
        : '기본 선호는 그대로 두고, 내가 직접 정한 경우에만 조건에 맞는 다른 연락 간격도 비교해요.';
    return { id: 'contact-with-notice', field: 'wants.contact', title: '바쁠 때 미리 알려주면 연락 간격도 괜찮아요',
      description: '하루에 한 번쯤을 선호하지만, 상대가 바쁠 때 미리 알린다고 공개하면 며칠에 한 번도 괜찮다는 선택이에요. 상대의 미확인 답으로는 허용하지 않아요.',
      available: blockReason === null, availableTargets: blockReason ? [] : source.duration === 'ongoing' ? ['context', 'baseline'] : ['context'],
      blockReason, ...state, summary };
  }
  function inspect(state, { at = state?.events?.at(-1)?.at || START } = {}) {
    const runtime = replay(state, at), me = project(runtime, at), result = evaluate(me, at);
    const analysis = questionAnalysis(runtime, me, at);
    const noWants = AXES.every(axis => !own(me.values, `wants.${axis}`) || me.values[`wants.${axis}`] === 'any');
    let summary = me.closed ? runtime.context.endedReason === 'expired' ? '확인한 종료 시점이 지났어요. 이번 선택은 끝났고 평소 기준만 남아요. 새 추천을 시작해 주세요.' : '이번 추천을 끝냈어요. 이번 선택은 끝났고 평소 기준만 남아요. 새 추천을 시작하면 다시 비교해요.'
      : me.conflicts.length ? '이번 선택과 평소 필수조건이 달라 추천을 보류했어요. 이번 선택을 취소하거나 필수조건을 따로 고쳐 주세요.'
        : me.values.consent === false ? '후보 살펴보기를 중단했어요. 후보와 이전 선택을 표시하지 않아요.' : me.values.consent !== true ? '내 동의를 먼저 확인해요. 아직 후보를 표시하지 않아요.'
      : result.status === 'ready' ? `서로의 필수조건을 충족하는 ${synthetic ? '가상' : '공개'} 후보를 비교했어요.` : result.status === 'needs-confirmation' ? '필수 확인이 남아 있어 지금 추천할 수 없는 후보가 있어요.' : '지금 밝힌 필수조건을 모두 충족하는 후보가 없어요. 조건을 몰래 바꾸지 않아요.';
    if (result.top && noWants) summary += ' 상대에게 바라는 방식을 아직 특정하지 않았어요. 먼저 표시된 후보가 내 취향에 가장 맞는다는 뜻은 아니에요.';
    if (result.tied) summary += ' 같은 기준에서 우선순위가 같은 후보가 있어요. 표시 순서는 우열을 뜻하지 않아요.';
    const selection = me.values.consent === true && result.rows.some(row => row.id === runtime.selection?.candidateId && row.status === 'eligible') ? runtime.selection : null;
    const layerField = (layer, id) => ({ state: own(layer.values, id) ? 'known' : layer.expired?.some(item => item.field === id) ? 'expired' : 'unknown', value: own(layer.values, id) ? layer.values[id] : null,
      valueLabel: labelValue(id, layer.values[id]), provenance: layer.provenance[id] ? copy(layer.provenance[id]) : null,
      ...(layer.expired?.some(item => item.field === id) ? { expired: copy(layer.expired.filter(item => item.field === id)) } : {}) });
    const usedToday = runtime.questionUses.filter(item => questionDay(item.at) === questionDay(at)).length, optionalBudget = runtime.questionMode === null ? null : OPTIONAL_BUDGET[runtime.questionMode];
    const contactReason = runtime.reasons.get('wants.contact');
    return { version: VERSION, synthetic, scenario: synthetic ? copy(DISCOVERY_SCENARIOS.find(s => s.id === state.scenarioId)) : { id: 'first', title: '내 조건과 공개 후보 비교' },
      context: { ...copy(runtime.context), revision: runtime.revision, conflicts: [...me.conflicts] },
      fields: DISCOVERY_FIELDS.map(field => ({ id: field.id, label: field.label, kind: field.kind, question: publicField(field).question, options: copy(field.options), value: own(me.values, field.id) ? me.values[field.id] : null,
        ...(field.legacy ? { legacy: true, comparisonUse: me.required.includes(field.id) && me.hardValues[field.id] !== 'any' ? 'confirmation-required' : 'history-only' } : {}),
        valueLabel: labelValue(field.id, me.values[field.id]), state: layerField(me, field.id).state, required: field.kind === 'required' || me.required.includes(field.id),
        baseline: layerField(me.layers.baseline, field.id),
        context: runtime.unknown.has(field.id) ? { state: 'unknown', value: null, valueLabel: '이번에는 아직 모르겠어요', provenance: copy(runtime.unknown.get(field.id)) }
          : own(me.layers.context.values, field.id) || me.layers.context.expired?.some(item => item.field === field.id) ? layerField(me.layers.context, field.id) : { state: 'inherit', value: null, valueLabel: '평소 기준을 따름', provenance: null },
        effective: layerField(me, field.id), source: runtime.unknown.has(field.id) ? 'explicit-unknown' : own(me.layers.context.values, field.id) ? 'context' : own(me.values, field.id) ? 'baseline' : 'missing',
        ...(runtime.sceneSources.has(me.provenance[field.id]?.eventId) ? { sceneSource: copy(runtime.sceneSources.get(me.provenance[field.id].eventId)) } : {}),
        requiredValue: field.kind === 'wants' && me.required.includes(field.id) ? me.layers.baseline.values[field.id] ?? null : null })),
      question: analysis.question, insights: insightView(me, result, analysis), scenes: sceneViews(runtime, me, at, analysis.question), whatIf: whatIfView(runtime, me, result, at), status: result.status, summary, topCandidateId: result.top?.id || null,
      questionsPaused: runtime.questionsPaused,
      priorities: { ...copy(runtime.priorities), effective: [...me.priorities], ...(Object.values(runtime.priorityDeadlines).some(Boolean) ? { deadlines: copy(runtime.priorityDeadlines),
        expired: Object.fromEntries(['baseline', 'context'].map(target => [target, !!runtime.priorityDeadlines[target] && instant(at) >= instant(runtime.priorityDeadlines[target])])) } : {}) },
      legacyRelationship: { status: ['self.purpose', 'wants.purpose'].some(field => own(me.values, field) || me.required.includes(field)) ? 'needs-confirmation' : 'none',
        fields: ['self.purpose', 'wants.purpose'].filter(field => own(me.values, field) || me.required.includes(field)), required: me.required.includes('wants.purpose') && me.hardValues['wants.purpose'] !== 'any',
        message: '예전에는 목적과 속도를 함께 골랐어요. 이전 답은 기록으로 보존하고 새 두 항목으로 해석하지 않아요. 필요한 항목을 직접 따로 확인해 주세요.' },
      meetingRegions: { status: own(me.values, 'self.meetingRegions') || pool.some(person => own(person.values, 'self.meetingRegions')) ? 'active' : 'inactive',
        needsOwnAnswer: !own(me.values, 'self.meetingRegions') && considering(me, at).some(person => own(person.values, 'self.meetingRegions')), comparisonBasis: 'explicit-current-region-intersection' },
      ...(ConditionalPreference ? { conditionalPreference: conditionalView(runtime, me, at) } : {}),
      priorityChanges: runtime.priorityChanges.map(change => ({ ...copy(change), canUndo: !me.closed && change.kind === 'priorities'
        && change.contextId === runtime.context.id && runtime.priorityChanges.filter(item => item.target === change.target).at(-1)?.id === change.id })),
      questionControl: { mode: runtime.questionMode, optionalBudget, usedToday, remaining: optionalBudget === null ? null : Math.max(0, optionalBudget - usedToday),
        timeZone: 'Asia/Seoul', day: questionDay(at), deferred: copy([...runtime.deferred.values()].filter(item => instant(at) < instant(item.until))) },
      reasons: copy([...runtime.reasons.values()]),
      snoozedCandidates: me.values.consent === true && !me.closed ? [...runtime.snoozes.values()].filter(item => instant(at) < instant(item.until)
        && pool.some(person => person.id === item.id)).map(item => ({ id: item.id, label: pool.find(person => person.id === item.id).label, until: item.until })) : [],
      excludedCandidates: me.values.consent === true && !me.closed ? [...runtime.exclusionSources.values()].filter(item => item.contextId === runtime.context.id
        && runtime.excluded.has(item.candidateId) && pool.some(person => person.id === item.candidateId)).map(item => ({ id: item.candidateId,
          label: pool.find(person => person.id === item.candidateId).label, feedbackId: item.id, at: item.at, status: 'excluded', reason: '이번 추천에서 직접 제외한 후보예요.' })) : [],
      repetition: repetitionView(runtime, me, result, at),
      noticeSuggestion: contactReason?.value === 'predictability' && !me.closed && me.values['wants.notice'] === undefined
        ? { id: `${contactReason.id}.notice`, sourceReasonId: contactReason.id, field: 'wants.notice', value: 'advance', target: 'context',
          text: '연락 횟수보다 미리 알 수 있는지가 중요하다면, 이번에는 바쁠 때 미리 알려 주는 방식을 선택해 볼까요? 확인하기 전에는 추천에 반영하지 않아요.' } : null,
      reasonGuidance: contactReason?.value === 'temporary' ? '지금 상황 때문에 바라는 답이라면 이번 추천에만 적용할 수 있어요. 평소 기준은 별도로 고를 때만 바뀌어요.' : null,
      topTierIds: result.top ? result.rows.filter(row => row.status === 'eligible' && row.score === result.top.score).map(row => row.id) : [],
      tieNotice: result.tied ? '명시한 조건에서 같은 우선순위예요. 덜 표시한 후보를 먼저 살펴보도록 순서를 나눴어요.' : null,
      feedback: me.values.consent === true && !me.closed ? copy(runtime.feedback) : [],
      exclusions: me.values.consent === true && !me.closed ? [...runtime.excluded] : [],
      exposure: me.values.consent === true && !me.closed ? copy([...runtime.exposures.values()]) : [],
      changes: runtime.changes.map(change => ({ ...copy(change), canUndo: !me.closed && change.field !== 'consent' && change.kind !== 'undo-field'
        && change.contextId === runtime.context.id && runtime.changes.filter(item => item.field === change.field).at(-1).id === change.id })),
      candidates: result.rows.map(({ score, ...row }) => ({ ...row, selected: selection?.candidateId === row.id })), selection: selection ? copy(selection) : null,
      change: me.values.consent === true && runtime.change ? copy(runtime.change) : null, canReset: state.events.length > 0 };
  }
  function create(scenarioId = 'first', { at } = {}) {
    if (!DISCOVERY_SCENARIOS.some(scenario => scenario.id === scenarioId)) fail('unknown scenario');
    if (!synthetic && scenarioId !== 'first') fail('external accounts must start without synthetic answers');
    const liveAt = at === undefined ? null : instant(utc(at));
    let state = { version: VERSION, scenarioId, events: [], ...(!synthetic ? { ownerId, contextId } : {}) };
    if (scenarioId !== 'first') {
      const values = { consent: true, availability: scenarioId === 'boundary' ? 'weekday' : 'weekend', 'self.pace': 'listen', 'self.plan': 'planned', 'wants.pace': 'lead', 'wants.plan': 'planned' };
      for (const [field, value] of Object.entries(values)) state = record(state, { kind: 'set', field, value,
        ...(liveAt === null ? {} : { at: new Date(liveAt + state.events.length).toISOString() }),
        ...(scenarioId === 'boundary' && field === 'wants.pace' ? { required: true } : {}) });
    }
    return state;
  }
  function contextTransition(beforeRuntime, before, afterRuntime, after, beforeAt, afterAt) {
    const ended = [], retained = [];
    const answer = (runtime, me, field) => runtime.unknown.has(field) ? '이번에는 아직 모르겠어요'
      : own(me.values, field) ? labelValue(field, me.values[field])
        : me.expired?.some(item => item.field === field) ? '기한이 지나 미확인' : '미확인';
    for (const field of DISCOVERY_FIELDS) {
      const temporary = beforeRuntime.unknown.has(field.id) || own(before.layers.context.values, field.id)
        || before.layers.context.expired?.some(item => item.field === field.id);
      if (temporary) ended.push({ kind: field.kind === 'regions' ? 'meeting-regions' : 'answer', field: field.id, label: field.label,
        before: answer(beforeRuntime, before, field.id), after: answer(afterRuntime, after, field.id) });
      if (field.kind === 'required' || after.required.includes(field.id)) retained.push({ kind: 'required', field: field.id, label: field.label,
        before: own(before.layers.baseline.values, field.id) ? labelValue(field.id, before.layers.baseline.values[field.id]) : '미확인 · 필수 확인 유지',
        after: own(after.layers.baseline.values, field.id) ? labelValue(field.id, after.layers.baseline.values[field.id]) : '미확인 · 필수 확인 유지' });
      else if (!temporary && own(after.layers.baseline.values, field.id)) retained.push({ kind: 'answer', field: field.id, label: field.label,
        before: answer(beforeRuntime, before, field.id), after: answer(afterRuntime, after, field.id) });
    }
    const priorities = fields => fields.map(field => spec(field).label).join(' · ') || '별도로 더 중요하게 정한 기준 없음';
    if (beforeRuntime.priorities.context !== null) ended.push({ kind: 'priorities', label: '이번에 더 중요하게 본 기준',
      before: priorities(before.priorities), after: priorities(after.priorities) });
    if (after.priorities.length && beforeRuntime.priorities.context === null) retained.push({ kind: 'priorities', label: '평소 더 중요하게 본 기준',
      before: priorities(before.priorities), after: priorities(after.priorities) });
    const condition = (me, at) => { const state = conditionalState(me, at);
      return state.effective.status === 'active' ? '바쁠 때 미리 알려주면 며칠 간격도 허용'
        : state.effective.status === 'inactive' ? '저장한 허용 조건은 현재 적용하지 않음' : '별도 허용 조건 없음'; };
    if (beforeRuntime.conditional.context) ended.push({ kind: 'conditional-allowance', field: 'wants.contact', label: '이번 연락 간격의 허용 조건',
      before: condition(before, beforeAt), after: condition(after, afterAt) });
    else if (afterRuntime.conditional.baseline) retained.push({ kind: 'conditional-allowance', field: 'wants.contact', label: '평소 연락 간격의 허용 조건',
      before: condition(before, beforeAt), after: condition(after, afterAt) });
    if (beforeRuntime.excluded.size) ended.push({ kind: 'current-exclusions', label: '이번 추천에서만 제외한 선택',
      before: `${beforeRuntime.excluded.size}명 이번 제외`, after: '이번 제외를 끝냄 · 필수조건과 기간 숨김은 유지' });
    const hidden = [...afterRuntime.snoozes.values()].filter(item => instant(afterAt) < instant(item.until) && pool.some(person => person.id === item.id));
    if (hidden.length) { const caption = `${hidden.length}명 · 직접 정한 숨김 기한 ${hidden.map(item => item.until).sort().join(' · ')}`;
      retained.push({ kind: 'candidate-hiding', label: '기간을 정한 후보 숨김', before: caption, after: caption }); }
    return { ended, retained };
  }
  function startContextBasis(state, action, at) {
    const beforeRuntime = replay(state, at), before = project(beforeRuntime, at);
    const next = appendRecord(state, { ...action, at: new Date(Math.max(instant(at), instant(state.events.at(-1)?.at || START) + 1)).toISOString() }, true);
    const afterAt = next.events.at(-1).at, afterRuntime = replay(next, afterAt), after = project(afterRuntime, afterAt);
    return { context: beforeRuntime.context,
      transition: contextTransition(beforeRuntime, before, afterRuntime, after, at, afterAt),
      returned: { values: after.values, provenance: after.provenance, hardValues: after.hardValues, priorities: after.priorities,
        ...(conditionalKey(after, afterAt) ? { conditionalKey: conditionalKey(after, afterAt) } : {}) },
      candidates: evaluate(after, afterAt) };
  }
  function preview(state, action, { at: checkedAt } = {}) {
    if (!action || !['set', 'clear', 'mark-unknown', 'revert-context', 'priorities', 'undo-field', 'undo-priorities', 'conditional-set', 'conditional-clear', 'start-context'].includes(action.kind)
      || !exact(action, action.kind === 'set' ? ['kind', 'field', 'value', 'required', 'target', 'until', 'at', 'sceneResponseId']
        : action.kind === 'start-context' ? ['kind', 'expiresAt', 'at']
        : action.kind === 'conditional-set' ? ['kind', 'ruleId', 'target', 'until', 'at'] : action.kind === 'conditional-clear' ? ['kind', 'target', 'at']
        : action.kind === 'priorities' ? ['kind', 'fields', 'target', 'until', 'at'] : action.kind === 'undo-field' ? ['kind', 'field', 'changeId', 'at']
          : action.kind === 'undo-priorities' ? ['kind', 'changeId', 'at'] : action.kind === 'clear' ? ['kind', 'field', 'target', 'required', 'at'] : ['kind', 'field', 'target', 'at'])) fail('preview only supports setting, clearing, prioritizing or undoing fields');
    if (action.field === 'consent') fail('consent changes require direct confirmation, not a preview');
    const at = checkedAt || state?.events?.at(-1)?.at || START, beforeRuntime = replay(state, at), me = project(beforeRuntime, at);
    if (me.closed && action.kind !== 'start-context') fail('context is closed; start a new context');
    if (me.values.consent !== true) fail('current consent is required before previewing candidates');
    const before = evaluate(me, at);
    if (checkedAt && action.at !== undefined && instant(action.at) < instant(checkedAt)) fail('preview action predates current time');
    const proposed = appendRecord(state, checkedAt && action.at === undefined ? { ...action, at: new Date(Math.max(instant(at), instant(state.events.at(-1)?.at || START) + 1)).toISOString() } : action, true);
    const afterAt = proposed.events.at(-1).at, afterRuntime = replay(proposed, afterAt), afterMe = project(afterRuntime, afterAt), after = evaluate(afterMe, afterAt);
    const eligible = result => result.rows.filter(row => row.status === 'eligible');
    const beforeRows = eligible(before), afterRows = eligible(after);
    const summarize = (result, rows) => ({ topCandidateId: result.top?.id || null, topLabel: result.top?.label || null, eligibleIds: rows.map(row => row.id) });
    const selectLabel = row => ({ id: row.id, label: row.label });
    const summary = !after.top ? after.status === 'needs-confirmation'
      ? '적용하면 필수 확인이 남아 추천을 보류해요.' : '적용하면 필수조건을 모두 충족하는 후보가 없어 추천을 보류해요.'
      : !before.top ? `적용하면 ${after.top.label}부터 살펴볼 수 있어요.`
        : before.top.id === after.top.id ? `적용해도 ${after.top.label}부터 살펴보는 순서는 같아요.`
          : `적용하면 먼저 살펴볼 후보가 달라져요: ${before.top.label} → ${after.top.label}.`;
    return { version: PREVIEW_VERSION, baseKey: previewKey(state), evaluatedAt: utc(at), action: checkedAt ? { ...copy(action), at: afterAt } : copy(action),
      before: summarize(before, beforeRows), after: { ...summarize(after, afterRows), status: after.status },
      entered: afterRows.filter(row => !beforeRows.some(old => old.id === row.id)).map(selectLabel),
      left: beforeRows.filter(row => !afterRows.some(next => next.id === row.id)).map(selectLabel),
      held: after.rows.filter(row => row.status !== 'eligible').map(({ id, label, status, reason }) => ({ id, label, status, reason })),
      selectionWillClear: beforeRuntime.selection !== null,
      summary, ...(action.kind === 'start-context' ? { contextTransition: contextTransition(beforeRuntime, me, afterRuntime, afterMe, at, afterAt) } : {}) };
  }
  function applyPreview(state, proposed, options = {}) {
    const keys = ['version', 'baseKey', 'evaluatedAt', 'action', 'before', 'after', 'entered', 'left', 'held', 'selectionWillClear', 'summary', 'contextTransition'];
    if (!exact(proposed, keys) || proposed.version !== PREVIEW_VERSION || utc(proposed.evaluatedAt) !== proposed.evaluatedAt) fail('invalid preview');
    replay(state, state?.events?.at(-1)?.at || START);
    if (proposed.baseKey !== previewKey(state)) fail('stale preview; review the current conditions again');
    const currentAt = options.at || state?.events?.at(-1)?.at || START;
    if (replay(state, currentAt).context.closed && proposed.action?.kind !== 'start-context') fail('context is closed; preview expired');
    // A preview can outlive a preference deadline without any new event. Its
    // prior comparison is then stale even if the eventual top candidate matches.
    const previewAt = proposed.evaluatedAt;
    const basis = at => { const runtime = replay(state, at), me = project(runtime, at); return { values: me.values, hardValues: me.hardValues, priorities: me.priorities, provenance: me.provenance,
      ...(conditionalKey(me, at) ? { conditionalKey: conditionalKey(me, at) } : {}) }; };
    if (canonical(basis(previewAt)) !== canonical(basis(currentAt))) fail('stale preview; a preference deadline changed the current conditions');
    if (proposed.action?.kind === 'start-context'
      && canonical(startContextBasis(state, proposed.action, previewAt)) !== canonical(startContextBasis(state, proposed.action, currentAt)))
      fail('stale preview; the next context conditions or retained choices changed');
    if (proposed.action?.kind === 'undo-field') {
      // An inactive prior answer can expire while its replacement stays live.
      // Compare that restoration basis too, rather than showing an old value
      // and silently withdrawing it when the user applies the preview later.
      const source = replay(state, previewAt).changes.find(change => change.id === proposed.action.changeId);
      const restorable = at => ['baseline', 'context'].map(layer => {
        const old = source?.before[layer]; return !!old && old.state === 'known' && (!old.until || instant(at) < instant(old.until));
      });
      if (canonical(restorable(previewAt)) !== canonical(restorable(currentAt))) fail('stale preview; the prior answer to restore has expired');
    }
    if (proposed.action?.kind === 'undo-priorities') {
      const source = replay(state, previewAt).priorityChanges.find(change => change.id === proposed.action.changeId);
      const restorable = at => !source?.beforeUntil || instant(at) < instant(source.beforeUntil);
      if (restorable(previewAt) !== restorable(currentAt)) fail('stale preview; the prior priority scope has expired');
    }
    const expected = preview(state, proposed.action, proposed.action.at ? { at: proposed.evaluatedAt } : {});
    if (canonical(proposed) !== canonical(expected)) fail('preview content does not match the proposed action');
    return appendRecord(state, options.at && instant(options.at) > instant(expected.action.at || currentAt) ? { ...expected.action, at: options.at } : expected.action, true);
  }
  function handoff(state, { at = state?.events?.at(-1)?.at || START } = {}) {
    const runtime = replay(state, at), me = project(runtime, at);
    if (!synthetic) return null; // Real host connections require their own explicit authorization.
    if (!runtime.selection || !runtime.selectionEvent || me.values.consent !== true) return null;
    const result = evaluate(me, at), candidate = pool.find(person => person.id === runtime.selection.candidateId);
    if (!candidate || !result.rows.some(row => row.id === candidate.id && row.status === 'eligible')
      || !own(me.values, 'availability') || !own(candidate.values, 'availability')) return null;
    const basis = { version: VERSION, scenarioId: state.scenarioId, contextId: runtime.context.id,
      conditions: state.events.filter(event => ['set', 'clear', 'mark-unknown', 'revert-context', 'start-context', 'close-context', 'undo-field', 'priorities', 'undo-priorities', 'conditional-set', 'conditional-clear'].includes(event.kind)
        || event.kind === 'feedback' && event.decision === 'skip-current' || ['restore-candidate', 'hide-candidate', 'unhide-candidate'].includes(event.kind)), selection: runtime.selectionEvent, candidate };
    return { version: SEED_VERSION, key: `discovery-${fingerprint(basis)}-${runtime.selectionEvent.id.slice(6)}`,
      candidateId: candidate.id, sourceRevision: runtime.revision,
      people: [{ id: 'person-a', label: '나 · 가상 역할', availability: me.values.availability },
        { id: 'person-b', label: candidate.label, availability: candidate.values.availability }] };
  }
  function meetingRegionDeclaration(state, { at = state?.events?.at(-1)?.at || START } = {}) {
    const runtime = replay(state, at, null, true), me = project(runtime, at);
    return me.closed || me.values.consent !== true || !own(me.values, 'self.meetingRegions') ? null : copy(me.values['self.meetingRegions']);
  }
  return Object.freeze({ create, record, inspect, preview, applyPreview, handoff, meetingRegionDeclaration });
}
