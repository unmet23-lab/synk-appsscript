// Synthetic product adapter, not a relationship predictor or an additional engine.
// A real host must authenticate each actor and authorize the purpose before recording.
// No storage, network, personal data, sensitive inference or popularity ranking.
const VERSION = 'matching-demo-1';
const START = '2026-10-06T00:00:00.000Z', DAY = 86400000;
const WORKSPACE = 'synthetic-matching', PURPOSE = 'explicit-introduction';
const PEOPLE = [{ id: 'person-a', label: '가상 인물 A' }, { id: 'person-b', label: '가상 인물 B' }];
const TIME = [{ id: 'weekday-evening', label: '평일 저녁' }, { id: 'weekend', label: '주말' }];
const PACE = [{ id: 'slow', label: '천천히 대화해요' }, { id: 'lively', label: '활발하게 대화해요' }];
const ANY = { id: 'any', label: '상대에게 필수로 요구하지 않아요' };
const copy = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new TypeError(`Matching demo: ${message}`); };
const instant = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? Date.parse(value) : fail('invalid time');
const exact = (value, allowed) => value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).every(key => allowed.includes(key));
const FIELDS = [
  { id: 'self.meetingTime', label: '내가 가능한 만남 시간', options: TIME },
  { id: 'requires.meetingTime', label: '상대에게 필수로 요구하는 만남 시간', options: [...TIME, ANY] },
  { id: 'self.conversationPace', label: '내가 밝힌 대화 속도', options: PACE },
  { id: 'requires.conversationPace', label: '상대에게 필수로 요구하는 대화 속도', options: [...PACE, ANY] },
];
export const MATCHING_FIELDS = Object.freeze(FIELDS.map(field => Object.freeze({ ...field, options: Object.freeze(field.options.map(option => Object.freeze({ ...option, value: option.id }))) })));
export const MATCHING_SCENARIOS = Object.freeze([
  { id: 'ready', title: '조건 충족, 아직 소개 전', description: '두 사람이 밝힌 필수조건과 소개 동의가 있어요. 실제 소개 전달과 수락은 따로 확인해요.' },
  { id: 'mismatch', title: '한쪽 필수조건 불일치', description: 'A가 원하는 조건은 B가 충족하지만, B가 원하는 시간은 A가 충족하지 않아요.' },
  { id: 'unknown', title: '필수조건의 답이 없음', description: 'B의 가능한 시간을 몰라요. 빈 답을 A가 원하는 주말로 채우지 않아요.' },
  { id: 'no-consent', title: '한쪽 소개 동의 미확인', description: '조건이 맞아도 B의 소개 동의가 없으면 소개하지 않아요.' },
  { id: 'withdrawn', title: '상호 수락 뒤 의향 철회', description: 'B가 의향을 철회했어요. 과거 수락이나 이미 전달한 결과가 현재 의향을 대신하지 않아요.' },
].map(Object.freeze));
const CONTRACT = { id: 'matching.explicit', version: '1', purpose: PURPOSE,
  fields: [...FIELDS.map(field => ({ id: field.id, kind: 'enum', values: field.options.map(option => option.id), maxAgeDays: 30 })),
    { id: 'consent', kind: 'boolean', maxAgeDays: 1 }], criteria: [] };
const POLICY = { id: 'mutual-required', version: '1' };
const OUTCOME_SCOPE = { domain: 'SYNK', workspace: WORKSPACE, purpose: PURPOSE };
const OUTCOME_CONTRACT = { id: 'matching.mutual-intent', version: '1', scope: OUTCOME_SCOPE,
  outcome: { id: 'explicit-mutual-intent', kind: 'binary', direction: 'higher', allowedValues: [0, 1], windowMs: 30 * 60 * 1000 } };
const ref = { id: CONTRACT.id, version: CONTRACT.version, purpose: CONTRACT.purpose };
const scope = subject => ({ domain: 'SYNK', workspace: WORKSPACE, subject });
const axes = ['meetingTime', 'conversationPace'];
const consentOptions = [{ id: 'yes', label: '이 소개에 동의해요', value: true }, { id: 'no', label: '소개에 동의하지 않아요', value: false }];
const emptyIntent = () => ({ value: 'unanswered', at: null });

export function createMatchingAdapter({ Domain, Ask, TemperOutcomes } = {}) {
  if (typeof Domain?.understand !== 'function' || typeof Domain?.decide !== 'function' || typeof Ask?.choose !== 'function'
    || typeof TemperOutcomes?.evaluateOutcomes !== 'function') fail('Core domain, Ask and Temper outcomes are required');
  Domain.validateContract(CONTRACT);
  function peopleAt(observations, at) {
    return PEOPLE.map(person => ({ ...person, understanding: Domain.understand({ contract: CONTRACT, scope: scope(person.id), observations: observations[person.id], at }) }));
  }
  const fact = (person, field) => person.understanding.fields.find(item => item.id === field);
  function conditions(people) {
    const checks = [], directions = [], pending = new Set();
    let noConsent = false, missingConsent = false;
    for (const person of people) {
      const consent = fact(person, 'consent');
      if (consent.usable && consent.value === false || consent.status === 'withdrawn') noConsent = true;
      else if (!consent.usable) { missingConsent = true; pending.add(`${person.id}:consent`); }
      const other = people.find(item => item.id !== person.id);
      // "Any" is an explicit removal of a requirement; an absent requirement
      // remains a required unknown in Core, rather than silently becoming any.
      const criteria = axes.filter(axis => fact(person, `requires.${axis}`).value !== 'any').map(axis => ({
        id: axis, field: `requires.${axis}`, feature: axis, required: true, weight: 0,
      }));
      const features = Object.fromEntries(criteria.flatMap(c => { const v = fact(other, `self.${c.id}`); return v.usable ? [[c.id, v.value]] : []; }));
      const decision = Domain.decide({ contract: { ...CONTRACT, criteria }, scope: scope(person.id), observations: person.observations, at: person.at,
        candidates: [{ id: other.id, features }] });
      directions.push({ person: person.id, other: other.id, decision });
      for (const axis of axes) {
        const required = fact(person, `requires.${axis}`), actual = fact(other, `self.${axis}`);
        const status = !required.usable ? 'unknown' : required.value === 'any' ? 'pass' : !actual.usable ? 'unknown' : required.value === actual.value ? 'pass' : 'fail';
        if (status === 'unknown') pending.add(!required.usable ? `${person.id}:requires.${axis}` : `${other.id}:self.${axis}`);
        checks.push({ owner: person.id, other: other.id, field: `requires.${axis}`, label: FIELDS.find(f => f.id === `requires.${axis}`).label,
          requiredValue: required.value, actualValue: actual.value, status,
          reason: !required.usable ? '필수 요구를 아직 확인하지 않았어요.' : required.value === 'any' ? '이 항목은 상대에게 필수로 요구하지 않아요.'
            : !actual.usable ? '상대가 밝힌 답이 없어 확인이 필요해요.' : status === 'pass' ? '명시한 조건을 충족해요.' : '명시한 필수조건을 충족하지 않아요.' });
      }
    }
    const mismatch = checks.some(check => check.status === 'fail');
    const status = noConsent ? 'no-consent' : mismatch ? 'ineligible' : missingConsent || directions.some(d => d.decision.status !== 'ready') ? 'needs-confirmation' : 'eligible';
    const label = { 'no-consent': '소개에 동의하지 않거나 동의를 철회했어요.', ineligible: '한쪽 이상의 필수조건을 충족하지 않아요.',
      'needs-confirmation': '소개 전에 직접 확인할 항목이 있어요.', eligible: '명시한 쌍방 조건과 소개 동의를 확인했어요.' }[status];
    return { status, label, checks, directions, pendingChecks: ['ineligible', 'no-consent'].includes(status) ? [] : [...pending] };
  }
  function evaluateConditions(observations, at) {
    const people = peopleAt(observations, at).map(person => ({ ...person, observations: observations[person.id], at }));
    return { people, eligibility: conditions(people) };
  }
  function replay(state, asOf) {
    if (!exact(state, ['version', 'scenarioId', 'events']) || state.version !== VERSION || !MATCHING_SCENARIOS.some(s => s.id === state.scenarioId)
      || !Array.isArray(state.events) || state.events.length > 500) fail('invalid state');
    const cutoff = instant(asOf), observations = Object.fromEntries(PEOPLE.map(p => [p.id, []]));
    let round = null, previousAt = instant(START) - 1;
    const rounds = [], lastValues = new Map();
    for (const [index, event] of state.events.entries()) {
      if (!exact(event, ['id', 'kind', 'person', 'field', 'value', 'at', 'roundId']) || event.id !== `event-${index + 1}` || !['declare', 'consent', 'introduce', 'deliver', 'intent', 'result-delivered'].includes(event.kind)) fail('invalid event');
      const at = instant(event.at);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.at) || new Date(at).toISOString() !== event.at) fail('event time must be canonical UTC');
      if (at < previousAt || at > cutoff) fail('event time outside replay'); previousAt = at;
      if (event.kind === 'declare' || event.kind === 'consent') {
        if (!PEOPLE.some(p => p.id === event.person) || event.roundId !== undefined || event.kind === 'consent' && event.field !== undefined) fail('invalid declaration actor');
        const field = event.kind === 'consent' ? 'consent' : event.field, spec = CONTRACT.fields.find(f => f.id === field);
        if (!spec || event.kind === 'declare' && field === 'consent' || event.value !== null && (spec.kind === 'boolean' ? typeof event.value !== 'boolean' : !spec.values.includes(event.value))) fail('invalid declared value');
        const key = `${event.person}:${field}`, previous = lastValues.get(key);
        if (previous?.at === event.at && previous.value !== event.value) fail('ambiguous same-time declaration');
        lastValues.set(key, event);
        observations[event.person].push({ id: event.id, scope: scope(event.person), contract: ref, field, value: event.value, source: 'declared', at: event.at });
        if (round && !round.invalidatedBy) round.invalidatedBy = event.id;
        continue;
      }
      if (event.kind === 'introduce') {
        if (event.person !== undefined || event.field !== undefined || event.value !== undefined || event.roundId !== event.id) fail('invalid introduction');
        if (round && !round.invalidatedBy && at < instant(round.at) + DAY) fail('introduction already active');
        const { eligibility } = evaluateConditions(observations, event.at);
        if (eligibility.status !== 'eligible') fail('both conditions and consent are required');
        round = { id: event.id, at: event.at, invalidatedBy: null, delivered: {}, intents: {}, lastIntents: {}, results: {}, resultHistory: [] }; rounds.push(round); continue;
      }
      if (!round || event.roundId !== round.id || round.invalidatedBy || at >= instant(round.at) + DAY || !PEOPLE.some(p => p.id === event.person)
        || event.field !== undefined) fail('event has no current introduction');
      const { eligibility } = evaluateConditions(observations, event.at);
      if (eligibility.status !== 'eligible') fail('current introduction is no longer eligible');
      if (event.kind === 'deliver') {
        if (event.value !== undefined || round.delivered[event.person]) fail('duplicate or invalid delivery');
        round.delivered[event.person] = event; continue;
      }
      if (event.kind === 'intent') {
        if (!round.delivered[event.person] || !['accept', 'decline', 'withdraw'].includes(event.value)) fail('intent requires prior delivery and explicit choice');
        const previous = round.intents[event.person];
        const latest = round.lastIntents[event.person];
        if (latest?.at === event.at && latest.value !== event.value) fail('ambiguous same-time intent');
        if (event.value === 'withdraw' && !previous) fail('there is no intent to withdraw');
        round.lastIntents[event.person] = event;
        if (previous?.value === event.value) continue; // Repeated clicks do not move the effective response time.
        round.intents[event.person] = event;
        round.results = {}; // A changed intention needs a newly delivered result.
        if (event.value === 'withdraw') round.invalidatedBy = event.id;
        continue;
      }
      if (event.value !== undefined || !PEOPLE.every(p => round.intents[p.id]?.value === 'accept') || round.results[event.person]) fail('result delivery requires current mutual acceptance');
      round.results[event.person] = event; round.resultHistory.push(event);
    }
    const { people, eligibility } = evaluateConditions(observations, asOf);
    const active = !!round && !round.invalidatedBy && cutoff < instant(round.at) + DAY && eligibility.status === 'eligible';
    return { observations, people, eligibility, round, rounds, active };
  }
  function record(state, input) {
    if (!exact(input, ['kind', 'person', 'field', 'value', 'at'])) fail('invalid action');
    const last = state?.events?.at(-1)?.at || START;
    replay(state, last);
    const at = new Date(input.at === undefined ? instant(last) + 1000 : instant(input.at)).toISOString();
    const id = `event-${state.events.length + 1}`, event = { id, ...copy(input), at };
    if (input.kind === 'introduce') event.roundId = id;
    else if (['deliver', 'intent', 'result-delivered'].includes(input.kind)) event.roundId = [...state.events].reverse().find(e => e.kind === 'introduce')?.id;
    const result = { ...copy(state), events: [...copy(state.events), event] };
    replay(result, at); return result;
  }
  function nextQuestion(state, current, at) {
    if (!current.eligibility.pendingChecks.length) return null;
    const questions = current.eligibility.pendingChecks.map(key => {
      const [person, field] = key.split(':'), spec = FIELDS.find(f => f.id === field);
      return { id: key, about: key, person, field, label: `${PEOPLE.find(p => p.id === person).label}: ${spec?.label || '이 소개에 동의하나요?'}`,
        kind: 'confirm', options: copy(field === 'consent' ? consentOptions : MATCHING_FIELDS.find(f => f.id === field).options) };
    });
    const decide = answers => {
      const observations = copy(current.observations);
      for (const [key, value] of Object.entries(answers)) {
        const [person, field] = key.split(':'), prior = observations[person].filter(row => row.field === field).at(-1);
        observations[person].push({ id: `hypothetical.${person}.${field}`, scope: scope(person), contract: ref, field, value, source: 'declared', at,
          ...(prior ? { supersedes: prior.id } : {}) });
      }
      const eligibility = evaluateConditions(observations, at).eligibility;
      return { action: eligibility.status === 'eligible' ? 'introduce' : ['ineligible', 'no-consent'].includes(eligibility.status) ? 'stop' : 'hold', pendingChecks: eligibility.pendingChecks };
    };
    // One unit is a still-needed confirmation in this product's workflow. Equal
    // answer assumptions and zero burden are defaults, not learned probabilities.
    const chosen = Ask.choose({ questions, decide, evaluate: ({ decision }) => ({ loss: decision.pendingChecks.length }) });
    return chosen.status === 'ask' ? { ...chosen.question, value: chosen.value, basis: chosen.basis,
      assumption: '균등한 답 가정 · 확인이 필요한 항목 수를 줄이는 제품 규칙이며 관계 성공 확률이 아니에요.' } : null;
  }
  function inspect(state, { at = state?.events?.at(-1)?.at || START } = {}) {
    const current = replay(state, at), { round, active, eligibility } = current;
    const latestWithdrawal = round && round.invalidatedBy && state.events.find(e => e.id === round.invalidatedBy)?.value === 'withdraw';
    const values = active ? PEOPLE.map(p => round.intents[p.id]?.value || 'unanswered') : [];
    const mutualStatus = !round ? 'not-introduced' : latestWithdrawal ? 'withdrawn' : !active ? 'invalidated'
      : values.includes('decline') ? 'declined' : PEOPLE.some(p => !round.delivered[p.id]) ? 'awaiting-delivery'
        : values.every(value => value === 'accept') ? 'mutual' : 'awaiting-response';
    const labels = { 'not-introduced': '아직 소개하지 않았어요.', withdrawn: '만남 의향을 철회했어요. 이전 수락은 다시 쓰지 않아요.', invalidated: '조건·동의가 바뀌거나 소개가 만료되어 새 소개가 필요해요.',
      declined: '명시적으로 거절한 사람이 있어요.', 'awaiting-delivery': '소개를 아직 받지 않은 사람이 있어요.', mutual: '두 사람 모두 이 소개를 수락했어요.', 'awaiting-response': '아직 응답하지 않은 사람이 있어요. 거절로 기록하지 않아요.' };
    const participants = current.people.map(person => {
      const consent = fact(person, 'consent');
      return { id: person.id, label: person.label, consent: { value: consent.value, status: consent.status }, facts: FIELDS.map(field => {
        const value = fact(person, field.id); return { field: field.id, label: field.label, value: value.value, valueLabel: field.options.find(o => o.id === value.value)?.label || '미확인', status: value.status, usable: value.usable };
      }), delivered: active && !!round.delivered[person.id], intent: active ? copy(round.intents[person.id] ? { value: round.intents[person.id].value, at: round.intents[person.id].at } : emptyIntent())
        : latestWithdrawal && round.intents[person.id]?.value === 'withdraw' ? { value: 'withdraw', at: round.intents[person.id].at } : emptyIntent(),
      resultDelivered: active && mutualStatus === 'mutual' && !!round.results[person.id] };
    });
    const decisions = [], exposures = [], outcomes = [];
    // Account only the current, still authorized introduction. Invalidated history
    // remains in the explicit event log, never silently reused as current evidence.
    if (active) for (const person of PEOPLE) {
      const other = PEOPLE.find(p => p.id !== person.id), decisionId = `${round.id}.${person.id}`, delivered = round.delivered[person.id];
      decisions.push({ id: decisionId, subject: person.id, scope: OUTCOME_SCOPE, at: round.at, contract: { id: OUTCOME_CONTRACT.id, version: OUTCOME_CONTRACT.version }, policy: POLICY, candidateIds: [other.id], selectedId: other.id });
      if (delivered) exposures.push({ id: delivered.id, subject: person.id, scope: OUTCOME_SCOPE, at: delivered.at, decisionId, candidateId: other.id });
      if (delivered && PEOPLE.every(p => round.delivered[p.id]) && ['mutual', 'declined'].includes(mutualStatus)) {
        const lastIntentAt = Object.values(round.intents).map(e => e.at).sort().at(-1);
        outcomes.push({ id: `outcome.${person.id}`, subject: person.id, scope: OUTCOME_SCOPE, at: lastIntentAt > delivered.at ? lastIntentAt : delivered.at, exposureId: delivered.id, value: mutualStatus === 'mutual' ? 1 : 0 });
      }
    }
    const tracking = { decisions, exposures, outcomes, resultDeliveries: active && mutualStatus === 'mutual' ? Object.values(round.results).map(copy) : [],
      historicalResultDeliveries: current.rounds.flatMap(r => r.resultHistory.map(event => ({ ...copy(event), introductionInvalidated: !active || r.id !== round.id, currentResult: active && r.id === round.id && round.results[event.person]?.id === event.id }))) };
    const measurement = TemperOutcomes.evaluateOutcomes({ contract: OUTCOME_CONTRACT, ...tracking, policies: [POLICY, { id: 'reference-not-run', version: '1' }], subjects: PEOPLE.map(p => p.id), asOf: at, minimumSubjects: 5 });
    return { version: VERSION, synthetic: true, scenario: copy(MATCHING_SCENARIOS.find(s => s.id === state.scenarioId)), participants,
      eligibility: { ...eligibility, canIntroduce: eligibility.status === 'eligible' && !active }, round: round ? { id: round.id, active, at: round.at, invalidatedBy: round.invalidatedBy } : null,
      mutual: { status: mutualStatus, label: labels[mutualStatus] }, nextQuestion: nextQuestion(state, current, at), tracking, measurement,
      limitations: ['합성 두 사람의 명시 조건·동의·전달 연결만 확인해요. 실제 관계 적합성이나 매칭 효과는 검증하지 않았어요.',
        '현재 유효한 소개만 집계해요. 서로 연결된 두 사람의 의향을 독립적인 효과 표본으로 해석하지 않아요.',
        'Temper의 합성 관측창은 소개 전달 뒤 30분이에요. 미응답과 늦은 답을 실패로 채우지 않아요.',
        '참고 정책은 실행하지 않았어요. Temper의 비교·정책 승격 근거가 없어요. 실제 인증·동의 확인·전송·보관은 제품 호스트의 책임이에요.'] };
  }
  function create(scenarioId = 'ready') {
    if (!MATCHING_SCENARIOS.some(s => s.id === scenarioId)) fail('unknown scenario');
    let state = { version: VERSION, scenarioId, events: [] };
    for (const person of PEOPLE) {
      const declarations = { 'self.meetingTime': scenarioId === 'mismatch' && person.id === 'person-a' ? 'weekday-evening' : 'weekend', 'requires.meetingTime': 'weekend', 'self.conversationPace': 'slow', 'requires.conversationPace': 'slow' };
      for (const [field, value] of Object.entries(declarations)) if (!(scenarioId === 'unknown' && person.id === 'person-b' && field === 'self.meetingTime')) state = record(state, { kind: 'declare', person: person.id, field, value });
      if (!(scenarioId === 'no-consent' && person.id === 'person-b')) state = record(state, { kind: 'consent', person: person.id, value: true });
    }
    if (scenarioId === 'withdrawn') {
      state = record(state, { kind: 'introduce' });
      for (const person of PEOPLE) { state = record(state, { kind: 'deliver', person: person.id }); state = record(state, { kind: 'intent', person: person.id, value: 'accept' }); }
      state = record(state, { kind: 'result-delivered', person: 'person-a' });
      state = record(state, { kind: 'intent', person: 'person-b', value: 'withdraw' });
    }
    return state;
  }
  return Object.freeze({ create, record, inspect });
}
