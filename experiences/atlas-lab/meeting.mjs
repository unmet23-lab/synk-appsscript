// A finite, fictional first-meeting product. Core interprets explicit preferences;
// Ask selects missing confirmations. The host still owns identity, sharing and consent.
// No model, network, storage, inferred traits or relationship-success probability.
import { createReconnectAdapter } from './reconnect.mjs';
const VERSION = 'meeting-demo-1', START = '2026-10-06T10:00:00.000Z';
const PEOPLE = [{ id: 'person-a', label: '가상 인물 A' }, { id: 'person-b', label: '가상 인물 B' }];
const copy = x => JSON.parse(JSON.stringify(x));
const fail = text => { throw new TypeError(`Meeting demo: ${text}`); };
const own = (x, key) => Object.hasOwn(x, key);
const exact = (x, keys) => !!x && Object.getPrototypeOf(x) === Object.prototype && Object.keys(x).every(k => keys.includes(k));
const instant = at => typeof at === 'string' && at.length <= 40 && Number.isFinite(Date.parse(at)) ? Date.parse(at) : fail('invalid time');
const canonicalTime = at => new Date(instant(at)).toISOString();
const options = pairs => pairs.map(([value, label]) => Object.freeze({ id: String(value), value, label }));
export const MEETING_FIELDS = Object.freeze([
  { id: 'availability', label: '만날 수 있는 시간', options: options([['weekend', '주말'], ['weekday', '평일 저녁'], ['any', '둘 다 가능해요']]) },
  { id: 'consent', label: '이 만남 제안을 받아 볼까요?', options: options([[true, '제안을 받아 볼게요'], [false, '지금은 제안을 받지 않을게요']]) },
  { id: 'atmosphere', label: '원하는 분위기', options: options([['quiet', '조용하게 대화'], ['lively', '활기 있게 대화'], ['any', '어느 쪽도 좋아요']]) },
  { id: 'duration', label: '원하는 첫 만남 길이', options: options([['40', '가볍게 40분'], ['90', '여유 있게 90분'], ['any', '어느 쪽도 좋아요']]) },
  { id: 'activity', label: '함께 하고 싶은 활동', options: options([['cafe', '카페에서 대화'], ['walk', '가볍게 산책'], ['any', '어느 쪽도 좋아요']]) },
].map(field => Object.freeze({ ...field, options: Object.freeze(field.options) })));
export const MEETING_SCENARIOS = Object.freeze([
  { id: 'first', title: '내가 원하는 만남부터', description: 'A의 바람은 아직 몰라요. B는 주말에 조용한 카페에서 90분 대화하고 싶다고 밝혔어요.' },
  { id: 'ready', title: '90분 카페 만남 준비', description: '두 사람이 주말·조용한 카페·90분을 골랐어요. 각자 제안을 보고 수락해야 해요.' },
  { id: 'boundary', title: '가능한 시간이 달라요', description: 'A는 평일 저녁, B는 주말만 가능해요. 원하는 시간이나 필수조건을 몰래 바꾸지 않아요.' },
].map(Object.freeze));
const PLANS = [];
for (const availability of ['weekend', 'weekday']) for (const activity of ['cafe', 'walk']) for (const atmosphere of ['quiet', 'lively']) for (const duration of ['40', '90']) {
  const location = activity === 'cafe' ? '가상의 동네 카페' : '가상의 공원 산책길';
  PLANS.push({ id: `${availability}.${activity}.${atmosphere}.${duration}`, availability, activity, atmosphere, duration, minutes: Number(duration), location,
    title: `${availability === 'weekend' ? '주말' : '평일 저녁'} · ${atmosphere === 'quiet' ? '조용한' : '활기 있는'} ${activity === 'cafe' ? '카페 대화' : '산책'} · ${duration}분`,
    steps: [`${location}에서 인사하기`, activity === 'cafe' ? '최근 즐거웠던 일부터 대화하기' : '편한 속도로 걸으며 대화하기', `${duration}분 뒤 계속할지 각자 의사 확인하기`] });
}
export const MEETING_PLANS = Object.freeze(PLANS.map(plan => Object.freeze({ ...plan, steps: Object.freeze(plan.steps) })));
const CONTRACT = { id: 'meeting.wanted', version: '1', purpose: 'first-meeting-plan',
  fields: MEETING_FIELDS.map(field => ({ id: field.id, kind: field.id === 'consent' ? 'boolean' : 'enum', ...(field.id === 'consent' ? {} : { values: field.options.map(o => o.value) }), maxAgeDays: 36500 })), criteria: [] };
const REFERENCE = { id: CONTRACT.id, version: CONTRACT.version, purpose: CONTRACT.purpose };
const prefScope = (runtime, personId) => ({ personId, productId: 'meeting-demo', contextId: runtime.contextId, domain: 'SYNK' });
const domainScope = (runtime, person) => ({ domain: 'SYNK', workspace: `meeting.${runtime.contextId}`, subject: person });
const labelFor = (field, value) => MEETING_FIELDS.find(f => f.id === field)?.options.find(o => o.value === value)?.label || '미확인';
const feedbackLabels = { 'too-long': '만남 시간이 길었어요', 'activity-change': '다른 활동도 해 보고 싶어요', 'felt-good': '이번 만남 방식은 괜찮았어요' };
const encounterId = index => `meeting-${index}`;
const hasMet = round => !!round && PEOPLE.every(p => round.met[p.id]);
const hasStarted = round => !!round && Object.values(round.met).some(Boolean);
const ended = round => !!round && (round.accessClosed || Object.values(round.responses).some(r => ['busy', 'decline', 'withdraw'].includes(r.value)));
function selectionSeed(seed) {
  const keys = ['version', 'key', 'candidateId', 'sourceRevision', 'people'];
  if (!exact(seed, keys) || keys.some(key => !own(seed, key)) || seed.version !== 'discovery-meeting-seed-1'
    || typeof seed.key !== 'string' || !/^[a-zA-Z0-9_.-]{1,48}$/.test(seed.key) || ['fictional-pair', '__proto__', 'prototype', 'constructor'].includes(seed.key)
    || typeof seed.candidateId !== 'string' || !/^candidate-[1-5]$/.test(seed.candidateId) || !Number.isSafeInteger(seed.sourceRevision) || seed.sourceRevision < 0
    || !Array.isArray(seed.people) || seed.people.length !== 2) fail('invalid discovery meeting seed');
  const labels = ['나 · 가상 역할', `가상 성인 ${seed.candidateId.slice(-1)}`];
  const people = seed.people.map((person, index) => {
    if (!exact(person, ['id', 'label', 'availability']) || Object.keys(person).length !== 3 || person.id !== PEOPLE[index].id
      || person.label !== labels[index] || !['weekend', 'weekday', 'any'].includes(person.availability)) fail('invalid discovery meeting people');
    return { id: person.id, label: person.label, availability: person.availability };
  });
  return { version: seed.version, key: seed.key, candidateId: seed.candidateId, sourceRevision: seed.sourceRevision, people };
}

export function createMeetingAdapter({ Domain, Ask, Personalization } = {}) {
  if (!Domain?.decide || !Ask?.choose || !Personalization?.preferences?.record || !Personalization.preferences.project) fail('Core domain, Ask and scoped preferences are required');
  Domain.validateContract(CONTRACT);
  const P = Personalization.preferences;
  const Reconnect = createReconnectAdapter();
  function project(runtime, person, encounter, at) {
    // Once either person records the encounter, later settings concern the next
    // encounter. Even an ongoing edit must not rewrite this encounter's facts.
    const events = runtime.round?.startedAt && runtime.round.encounterId === encounter
      ? runtime.preferences[person].filter(event => instant(event.at) <= instant(runtime.round.startedAt)) : runtime.preferences[person];
    return P.project({ contract: CONTRACT, scope: prefScope(runtime, person), events, encounterId: encounter, at });
  }
  function effective(runtime, person, encounter, at) {
    const projected = project(runtime, person, encounter, at);
    const fields = MEETING_FIELDS.map(field => {
      const source = projected.provenance[field.id], metadata = source ? runtime.metadata[source.eventId] : null;
      return { id: field.id, label: field.label, value: own(projected.values, field.id) ? projected.values[field.id] : null,
        valueLabel: labelFor(field.id, projected.values[field.id]), state: own(projected.values, field.id) ? 'known' : 'unknown',
        share: metadata?.share === true, required: ['availability', 'consent'].includes(field.id) || metadata?.required === true,
        source: source?.source || 'missing', provenance: source || null };
    });
    return { fields, projected };
  }
  function recommend(runtime, viewer, encounter, at, overrides = {}, selectedPlanId = null) {
    const profiles = runtime.people.map(person => ({ ...person, ...effective(runtime, person.id, encounter, at) }));
    for (const [key, value] of Object.entries(overrides)) {
      const [person, field] = key.split(':'), target = profiles.find(p => p.id === person)?.fields.find(f => f.id === field);
      if (!target) fail('invalid hypothetical question');
      Object.assign(target, { value, valueLabel: labelFor(field, value), state: 'known', share: true, source: 'explicit', provenance: { eventId: `hypothetical.${person}.${field}`, at } });
    }
    const missing = [], visible = profiles.map(person => ({ ...person, fields: person.fields.filter(field => person.id === viewer || field.share || ['availability', 'consent'].includes(field.id)) }));
    let stopped = false;
    for (const person of visible) for (const id of ['availability', 'consent']) {
      const field = person.fields.find(f => f.id === id);
      if (field.state !== 'known') missing.push({ person: person.id, field: id });
      if (id === 'consent' && field.value === false) stopped = true;
    }
    const decisions = visible.map(person => {
      const known = person.fields.filter(f => f.state === 'known'), criteria = person.fields.filter(f => f.value !== 'any').map(f => ({ id: f.id, field: f.id, feature: f.id, weight: person.id === viewer ? 2 : 1, required: f.required }));
      const observations = known.map(f => ({ id: f.provenance.eventId, scope: domainScope(runtime, person.id), contract: REFERENCE,
        field: f.id, value: f.value, source: 'declared', at: f.provenance.at }));
      return Domain.decide({ contract: { ...CONTRACT, criteria }, scope: domainScope(runtime, person.id), observations, at,
        candidates: PLANS.map(plan => ({ id: plan.id, features: Object.fromEntries(criteria.map(c => [c.id, c.id === 'consent' ? true : plan[c.id]])) })) });
    });
    const ranked = PLANS.flatMap(plan => {
      const rows = decisions.map(d => d.ranked.find(r => r.id === plan.id));
      return rows.every(Boolean) ? [{ plan, score: rows.reduce((sum, row) => sum + row.score, 0) }] : [];
    }).sort((a, b) => b.score - a.score || PLANS.indexOf(a.plan) - PLANS.indexOf(b.plan));
    const status = stopped ? 'blocked' : missing.length ? 'needs-confirmation' : ranked.length ? 'ready' : 'blocked';
    const plan = selectedPlanId ? PLANS.find(p => p.id === selectedPlanId) : status === 'ready' ? ranked[0].plan : null;
    const facts = profiles.flatMap(person => MEETING_FIELDS.filter(f => f.id !== 'consent').map(spec => {
      const field = person.fields.find(f => f.id === spec.id), shared = person.id === viewer || field.share;
      const known = shared && field.state === 'known', fit = known && (field.value === 'any' || plan?.[field.id] === field.value);
      return { person: person.id, field: spec.id, status: !known || !plan ? 'unknown' : fit ? 'fit' : 'difference',
        text: !known ? `${person.label} · ${spec.label}: 아직 공유되지 않았어요.` : field.value === 'any' ? `${person.label} · ${spec.label}: 어느 쪽도 괜찮다고 밝혔어요.`
          : `${person.label} · ${spec.label}: ‘${field.valueLabel}’${field.required ? ' (필수)' : ''}${plan ? fit ? '. 제안에 반영했어요.' : '. 이번 제안과 차이가 있어요.' : '.'}` };
    }));
    const ownFields = profiles.find(p => p.id === viewer).fields;
    const reasons = [status === 'needs-confirmation' ? '가능한 시간과 제안 수신 동의부터 직접 확인해야 해요.' : status === 'blocked' ? '명시한 필수조건과 동의를 모두 지키는 제안이 없어요. 조건을 자동으로 완화하지 않아요.' : '내가 고른 조건과 상대가 공유한 조건을 함께 살펴봤어요.'];
    for (const field of ownFields.filter(f => f.source === 'feedback-confirmed')) reasons.push(plan?.[field.id] === field.value || field.value === 'any'
      ? `직접 승인한 지난 만남 피드백을 반영해 ‘${field.valueLabel}’으로 제안했어요.`
      : `직접 승인한 지난 만남 피드백은 ‘${field.valueLabel}’이에요. 표시한 제안과는 차이가 있어요.`);
    return { status, plan: plan ? copy(plan) : null, alternatives: status === 'ready' ? ranked.map(r => copy(r.plan)) : [], facts, reasons, missing };
  }
  function participantCanAccept(runtime, person, plan, encounter, at) {
    return effective(runtime, person, encounter, at).fields.filter(f => f.required).every(f => f.state === 'known'
      && (f.id === 'consent' ? f.value === true : f.value === 'any' || f.value === plan[f.id]));
  }
  function invitationConsent(runtime, at) {
    const target = encounterId(runtime.index + (hasStarted(runtime.round) ? 1 : 0));
    return runtime.people.every(person => effective(runtime, person.id, target, at).projected.values.consent === true);
  }
  function reconnectView(runtime, viewer, at, reflectedEncounter) {
    const value = Reconnect.inspect(runtime.reconnect, { viewer, at, encounterId: reflectedEncounter });
    if (!invitationConsent(runtime, at)) for (const key of ['canSend', 'canSuggest', 'canRespond', 'canPrepare']) value[key] = false;
    if (value.invitation?.encounterId !== encounterId(runtime.index)) value.canPrepare = false;
    return value;
  }
  function replay(state, at) {
    if (!exact(state, ['version', 'scenarioId', 'events', 'seed']) || state.version !== VERSION || !MEETING_SCENARIOS.some(s => s.id === state.scenarioId)
      || !Array.isArray(state.events) || state.events.length > 500) fail('invalid state');
    const seed = own(state, 'seed') ? selectionSeed(state.seed) : null;
    if (seed && state.scenarioId !== 'first') fail('a discovery connection must start with unknown meeting preferences');
    const people = seed ? seed.people.map(({ id, label }) => ({ id, label })) : copy(PEOPLE);
    const runtime = { index: 1, people, contextId: seed?.key || 'fictional-pair', seedBinding: seed ? JSON.stringify(seed) : null,
      connection: seed ? { key: seed.key, candidateId: seed.candidateId, sourceRevision: seed.sourceRevision, label: people[1].label } : null,
      preferences: Object.fromEntries(people.map(p => [p.id, []])), metadata: {}, feedback: [], skipped: [], round: null, rounds: [] };
    runtime.reconnect = Reconnect.create({ pairId: runtime.contextId, people });
    let previousAt = instant(START) - 1;
    const preference = (event, target, kind, extra = {}) => {
      const id = `${event.id}.preference`;
      runtime.preferences[event.person] = P.record({ contract: CONTRACT, scope: prefScope(runtime, event.person), events: runtime.preferences[event.person], encounterId: target, at: event.at, id, kind, ...extra });
      return id;
    };
    for (const [index, event] of state.events.entries()) {
      if (!exact(event, ['id', 'at', 'kind', 'person', 'field', 'value', 'duration', 'share', 'required', 'planId', 'proposalId', 'binding', 'seedBinding', 'action', 'encounterId']) || event.id !== `event-${index + 1}`) fail('invalid event');
      if (seed ? event.seedBinding !== runtime.seedBinding : own(event, 'seedBinding')) fail('event belongs to another discovery connection');
      if (canonicalTime(event.at) !== event.at || instant(event.at) <= previousAt || instant(event.at) > instant(at)) fail('noncanonical or unordered event time'); previousAt = instant(event.at);
      const current = encounterId(runtime.index), next = encounterId(runtime.index + 1), round = runtime.round;
      const allowed = { set: ['person', 'field', 'value', 'duration', 'share', 'required'], 'withdraw-setting': ['person', 'field', 'duration'],
        propose: ['person', 'planId'], edit: ['person', 'planId', 'binding'], view: ['person', 'binding'], respond: ['person', 'value', 'binding'],
        met: ['person', 'binding'], feedback: ['person', 'value', 'binding', 'encounterId'], apply: ['person', 'proposalId', 'duration'], dismiss: ['person', 'proposalId'], 'skip-question': ['person', 'field'], next: [], reconnect: ['person', 'action'] };
      if (!own(allowed, event.kind) || Object.keys(event).some(k => !['id', 'at', 'kind', ...(seed ? ['seedBinding'] : []), ...allowed[event.kind]].includes(k))
        || event.kind !== 'next' && !runtime.people.some(p => p.id === event.person)) fail('invalid action actor or fields');
      if (event.kind === 'reconnect') {
        if (!event.action || ['met', 'prepare', 'advance', 'close-invitations'].includes(event.action.kind) || ['person', 'at', 'id', 'pairBinding'].some(key => own(event.action, key))) fail('invalid nested reconnect actor');
        if (event.action.kind === 'send' && !invitationConsent(runtime, event.at)) fail('new invitation requires current mutual consent');
        runtime.reconnect = Reconnect.record(runtime.reconnect, { ...event.action, person: event.person, at: event.at });
        // Removing access ends an unfinished agreement; unblocking cannot revive
        // old acceptances. Attendance already recorded remains historical fact.
        if (event.action.kind === 'block' && round && !hasMet(round)) { round.valid = false; round.accessClosed = true; }
        continue;
      }
      const contact = Reconnect.inspect(runtime.reconnect, { viewer: event.person || people[0].id, at: event.at, encounterId: current });
      if (contact.access !== 'available' && ['propose', 'edit', 'view', 'respond', 'met', 'next'].includes(event.kind)) fail('pair access unavailable');
      if (['propose', 'edit', 'next'].includes(event.kind) && !contact.canStartPlan) fail('new meeting preparation is paused');
      if (event.kind === 'set' || event.kind === 'withdraw-setting') {
        if (!MEETING_FIELDS.some(f => f.id === event.field) || !['once', 'ongoing'].includes(event.duration)) fail('invalid setting');
        const target = hasStarted(round) ? next : current;
        if (event.kind === 'set') {
          if (typeof event.share !== 'boolean' || typeof event.required !== 'boolean') fail('explicit sharing and requirement flags required');
          const id = preference(event, target, 'set', { field: event.field, value: event.value, duration: event.duration });
          runtime.metadata[id] = { share: ['consent', 'availability'].includes(event.field) || event.share, required: ['consent', 'availability'].includes(event.field) || event.required };
        } else preference(event, target, 'withdraw', { field: event.field, duration: event.duration });
        if (round && !hasStarted(round)) round.valid = false;
        if (event.field === 'consent' && effective(runtime, event.person, target, event.at).projected.values.consent !== true)
          runtime.reconnect = Reconnect.record(runtime.reconnect, { kind: 'close-invitations', person: event.person, at: event.at });
        continue;
      }
      if (event.kind === 'skip-question') {
        if (!['atmosphere', 'duration', 'activity'].includes(event.field)
          || effective(runtime, event.person, current, event.at).fields.find(f => f.id === event.field).state !== 'unknown') fail('only an unknown optional preference can be skipped');
        runtime.skipped.push({ person: event.person, field: event.field, encounterId: current }); continue;
      }
      if (event.kind === 'propose' || event.kind === 'edit') {
        if (round && (hasMet(round) || Object.values(round.met).some(Boolean))) fail('a meeting already happened; start a new encounter');
        if (event.kind === 'edit' && (!round || event.binding !== `${round.id}:${round.revision}`)) fail('stale proposal edit');
        const recommendation = recommend(runtime, event.person, current, event.at);
        const plan = recommendation.alternatives.find(p => p.id === event.planId);
        if (!plan) fail('plan does not meet visible required conditions and consent');
        const created = { id: event.id, revision: (round?.revision || 0) + 1, encounterId: current, plan, valid: true, seen: {}, responses: {}, met: {} };
        runtime.round = created; runtime.rounds.push(created); continue;
      }
      if (event.kind === 'apply' || event.kind === 'dismiss') {
        const pending = [next, ...(!hasStarted(round) ? [current] : [])].flatMap(target => project(runtime, event.person, target, event.at).pendingProposals).find(p => p.id === event.proposalId);
        if (!pending) fail('no own pending proposal for this or the next encounter');
        const previous = effective(runtime, event.person, pending.encounterId, event.at).fields.find(f => f.id === pending.field);
        const id = preference(event, pending.encounterId, event.kind, { proposalId: event.proposalId, ...(event.kind === 'apply' ? { duration: event.duration } : {}) });
        if (event.kind === 'apply') runtime.metadata[id] = { share: false, required: previous.required };
        if (event.kind === 'apply' && pending.encounterId === current && round) round.valid = false;
        continue;
      }
      if (event.kind === 'next') {
        if (!hasMet(round) && !ended(round) && !(contact.canPrepare && contact.invitation.encounterId === current && invitationConsent(runtime, event.at))) fail('unanswered introductions are not automatically ended');
        runtime.reconnect = Reconnect.record(runtime.reconnect, { kind: 'advance', person: people[0].id, encounterId: current, at: event.at });
        for (const person of runtime.people) preference({ ...event, person: person.id, id: `${event.id}.${person.id}` }, current, 'close');
        runtime.index += 1; runtime.round = null; continue;
      }
      if (event.kind === 'feedback') {
        const reflected = own(event, 'encounterId') ? runtime.rounds.findLast(item => item.encounterId === event.encounterId) : round;
        if (!reflected || event.binding !== `${reflected.id}:${reflected.revision}`) fail('event refers to an old proposal');
        if (!reflected.met[event.person] || !own(feedbackLabels, event.value)) fail('feedback requires your own meeting confirmation');
        if (runtime.feedback.some(item => item.person === event.person && item.encounterId === reflected.encounterId)) fail('feedback already recorded for this encounter');
        const row = { id: event.id, person: event.person, encounterId: reflected.encounterId, value: event.value, label: feedbackLabels[event.value] };
        runtime.feedback.push(row);
        const field = event.value === 'too-long' ? 'duration' : event.value === 'activity-change' ? 'activity' : null;
        const value = field === 'duration' ? '40' : field === 'activity' ? reflected.plan.activity === 'cafe' ? 'walk' : 'cafe' : null;
        const target = reflected.encounterId === current || hasStarted(round) ? next : current;
        if (field && value !== reflected.plan[field]) preference(event, target, 'propose', { field, value, feedbackId: event.id });
        continue;
      }
      if (!round || event.binding !== `${round.id}:${round.revision}`) fail('event refers to an old proposal');
      if (!round.valid) fail('proposal changed or was withdrawn');
      if (event.kind === 'view') { round.seen[event.person] = true; continue; }
      if (event.kind === 'respond') {
        if (!round.seen[event.person] || !['accept', 'busy', 'decline', 'withdraw'].includes(event.value)) fail('respond only after viewing this proposal');
        if (Object.values(round.met).some(Boolean)) fail('do not rewrite an already recorded meeting');
        if (event.value === 'accept' && !participantCanAccept(runtime, event.person, round.plan, current, event.at)) fail('your mandatory conditions are not met');
        if (event.value === 'withdraw' && !round.responses[event.person]) fail('no response to withdraw');
        round.responses[event.person] = { value: event.value, at: event.at };
        if (event.value === 'withdraw') round.valid = false;
        continue;
      }
      if (event.kind === 'met') {
        if (!runtime.people.every(p => round.seen[p.id] && round.responses[p.id]?.value === 'accept') || round.met[event.person]) fail('meeting confirmation requires current mutual acceptance');
        round.met[event.person] = true; round.startedAt ||= event.at;
        runtime.reconnect = Reconnect.record(runtime.reconnect, { kind: 'met', person: event.person, encounterId: current, at: event.at });
        continue;
      }
    }
    return runtime;
  }
  function record(state, input) {
    if (!exact(input, ['kind', 'person', 'field', 'value', 'duration', 'share', 'required', 'planId', 'proposalId', 'at', 'action', 'encounterId'])) fail('invalid action');
    const last = state?.events?.at(-1)?.at || START, runtime = replay(state, last);
    const at = input.at === undefined ? new Date(instant(last) + 1000).toISOString() : canonicalTime(input.at);
    const event = { id: `event-${state.events.length + 1}`, ...copy(input), at };
    if (runtime.seedBinding) event.seedBinding = runtime.seedBinding;
    if (['edit', 'view', 'respond', 'met', 'feedback'].includes(input.kind)) {
      const bound = input.kind === 'feedback' && own(input, 'encounterId') ? runtime.rounds.findLast(item => item.encounterId === input.encounterId) : runtime.round;
      event.binding = bound ? `${bound.id}:${bound.revision}` : null;
    }
    if (input.kind === 'propose' && input.planId === undefined) event.planId = recommend(runtime, input.person, encounterId(runtime.index), at).plan?.id;
    const result = { ...copy(state), events: [...copy(state.events), event] }; replay(result, at); return result;
  }
  function inspect(state, { viewer = 'person-a', at = state?.events?.at(-1)?.at || START } = {}) {
    const runtime = replay(state, at), current = encounterId(runtime.index), next = encounterId(runtime.index + 1), round = runtime.round;
    if (!runtime.people.some(p => p.id === viewer)) fail('invalid viewer');
    const mine = effective(runtime, viewer, current, at), partner = runtime.people.find(p => p.id !== viewer), theirs = effective(runtime, partner.id, current, at);
    const recommendation = recommend(runtime, viewer, current, at);
    const missingSelf = recommendation.missing.filter(q => q.person === viewer);
    const requiredQuestions = (missingSelf.length ? missingSelf : recommendation.missing.filter(q => q.person === partner.id))
      .sort((a, b) => Number(b.field === 'consent') - Number(a.field === 'consent')).map(q => ({ id: `${q.person}:${q.field}`, about: `${q.person}:${q.field}`, person: q.person, field: q.field,
      label: MEETING_FIELDS.find(f => f.id === q.field).label, kind: 'confirm', options: copy(MEETING_FIELDS.find(f => f.id === q.field).options) }));
    const optionalQuestions = recommendation.status === 'ready' && !hasStarted(round) ? mine.fields.filter(f => f.state === 'unknown' && !f.required
      && !runtime.skipped.some(q => q.encounterId === current && q.person === viewer && q.field === f.id)).map(f => ({
      id: `${viewer}:${f.id}`, about: `${viewer}:${f.id}`, person: viewer, field: f.id, label: f.label, kind: 'choice', optional: true,
      options: copy(MEETING_FIELDS.find(spec => spec.id === f.id).options) })) : [];
    const choice = requiredQuestions.length ? Ask.choose({ questions: requiredQuestions, decide: answers => {
      const rec = recommend(runtime, viewer, current, at, answers); return { status: rec.status, missing: rec.status === 'blocked' ? [] : rec.missing };
    }, evaluate: ({ decision }) => ({ loss: decision.missing.length }) }) : Ask.choose({ questions: optionalQuestions,
      decide: answers => ({ plan: recommend(runtime, viewer, current, at, answers).plan }),
      evaluate: ({ decision, question, option }) => ({ loss: option.value === 'any' || decision.plan?.[question.field] === option.value ? 0 : 1 }) });
    const completed = hasMet(round), status = !round ? null : completed ? 'met' : !round.valid ? 'withdrawn-or-changed'
      : Object.values(round.responses).some(r => r.value === 'decline') ? 'declined' : Object.values(round.responses).some(r => r.value === 'busy') ? 'busy'
        : runtime.people.every(p => round.responses[p.id]?.value === 'accept') ? 'mutual' : 'awaiting';
    const labels = { met: '가상 만남을 마쳤다고 각각 확인했어요.', 'withdrawn-or-changed': '제안이 바뀌거나 의향을 철회했어요. 이전 수락은 다시 쓰지 않아요.',
      declined: '이번 제안을 명시적으로 거절했어요.', busy: '이번 일정이 어려워요. 상대를 싫어한다는 뜻으로 바꾸지 않아요.', mutual: '두 사람이 이 구체적 제안을 수락했어요.', awaiting: '아직 각자 확인·응답할 단계예요. 무응답은 거절이 아니에요.' };
    const cleanFields = fields => fields.map(({ provenance, ...field }) => field);
    const pendingProposals = [next, ...(!hasStarted(round) ? [current] : [])].flatMap(target => project(runtime, viewer, target, at).pendingProposals).map(p => ({ ...p, targetEncounterId: p.encounterId, valueLabel: labelFor(p.field, p.value),
      label: `${MEETING_FIELDS.find(f => f.id === p.field).label}: 다음 제안에 ‘${labelFor(p.field, p.value)}’을 반영할까요?` }));
    const evaluation = round ? recommend(runtime, viewer, current, at, {}, round.plan.id) : null;
    const reflected = runtime.rounds.findLast(item => item.met[viewer]);
    const reflection = { encounterId: reflected?.encounterId || null, canReflect: !!reflected,
      answered: !!reflected && runtime.feedback.some(item => item.person === viewer && item.encounterId === reflected.encounterId) };
    const reconnect = reconnectView(runtime, viewer, at, reflected?.encounterId || current);
    const accessible = reconnect.access === 'available';
    const safePeople = runtime.people.map(person => person.id === viewer || accessible ? person : { id: person.id, label: '상대' });
    const unavailableRecommendation = { status: 'blocked', plan: null, alternatives: [], facts: [], reasons: ['지금은 이 연결을 이용할 수 없어요.'], missing: [] };
    return { version: VERSION, synthetic: true, viewer, scenario: runtime.connection
      ? { id: 'first', title: '선택한 후보와의 첫 만남', description: '탐색에서 선택한 가상 후보의 일정만 가져왔어요. 만남 제안 동의와 원하는 방식은 새로 확인해요.' }
      : copy(MEETING_SCENARIOS.find(s => s.id === state.scenarioId)), encounter: { id: current, index: runtime.index, completed, selfCompleted: !!round?.met[viewer], started: hasStarted(round) },
      access: { allowed: accessible }, reconnect,
      connection: runtime.connection ? { ...copy(runtime.connection), ...(accessible ? {} : { label: '상대' }) } : null, people: copy(safePeople), settingsTargetEncounterId: hasStarted(round) ? next : current,
      me: { ...runtime.people.find(p => p.id === viewer), fields: cleanFields(mine.fields), feedback: runtime.feedback.filter(f => f.person === viewer).map(copy), pendingProposals, reflection,
        nextPreview: { encounterId: next, recommendation: accessible ? recommend(runtime, viewer, next, at) : unavailableRecommendation } },
      partner: { ...safePeople.find(person => person.id === partner.id), sharedFields: accessible ? theirs.fields.filter(f => f.share && f.state === 'known').map(({ id, label, value, valueLabel, required }) => ({ id, label, value, valueLabel, required })) : [] },
      recommendation: accessible ? recommendation : unavailableRecommendation, proposal: accessible && round ? { id: round.id, revision: round.revision, plan: copy(round.plan), valid: round.valid, status, label: labels[status], evaluation: { facts: evaluation.facts, reasons: evaluation.reasons },
        people: runtime.people.map(p => ({ ...p, seen: !!round.seen[p.id], response: round.responses[p.id]?.value || 'unanswered', met: !!round.met[p.id] })),
        canEdit: reconnect.canStartPlan && !Object.values(round.met).some(Boolean), canMeet: round.valid && runtime.people.every(p => round.responses[p.id]?.value === 'accept'),
        selfCanAccept: round.valid && !!round.seen[viewer] && participantCanAccept(runtime, viewer, round.plan, current, at) } : null,
      nextQuestion: accessible && choice.status === 'ask' ? { ...copy(choice.question), value: choice.value, basis: choice.basis } : null,
      canPropose: reconnect.canStartPlan && recommendation.status === 'ready' && (!round || !Object.values(round.met).some(Boolean)), canNext: reconnect.canStartPlan && (completed || ended(round) || reconnect.canPrepare),
      limitations: ['가상 두 사람과 가상 장소의 흐름이에요. 실제 사람의 관계 적합성·만남 성과를 검증하지 않았어요.',
        '본인 선호와 상대가 공유한 조건으로 제안해요. 공유되지 않은 선호는 모른다고 표시하며 수락 전에 본인의 필수조건을 다시 확인해요.',
        '피드백은 개인에게만 보이는 변경 제안이에요. 직접 승인하기 전에는 선호를 바꾸지 않아요. 실제 인증·접근 통제·동의·보관은 호스트의 책임이에요.'] };
  }
  function create(scenarioId = 'first') {
    if (!MEETING_SCENARIOS.some(s => s.id === scenarioId)) fail('unknown scenario');
    let state = { version: VERSION, scenarioId, events: [] };
    for (const person of PEOPLE) {
      if (scenarioId === 'first' && person.id === 'person-a') continue;
      const values = { availability: scenarioId === 'boundary' && person.id === 'person-a' ? 'weekday' : 'weekend', consent: true, atmosphere: 'quiet', duration: '90', activity: 'cafe' };
      for (const [field, value] of Object.entries(values)) state = record(state, { kind: 'set', person: person.id, field, value, duration: 'ongoing', share: true, required: false });
    }
    return state;
  }
  function createFromSelection(input) {
    const seed = selectionSeed(input);
    let state = { version: VERSION, scenarioId: 'first', seed, events: [] };
    for (const person of seed.people) state = record(state, { kind: 'set', person: person.id, field: 'availability', value: person.availability,
      duration: 'ongoing', share: true, required: true });
    return state;
  }
  return Object.freeze({ create, createFromSelection, record, inspect });
}
