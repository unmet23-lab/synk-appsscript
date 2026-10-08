// One optional, authored coordination prompt for the next first meeting. Hosts
// authenticate the pair and supply only currently disclosed profile fields.
import { createHash } from 'node:crypto';
const VERSION = 'meeting-alignment-1';
const plain = x => !!x && Object.getPrototypeOf(x) === Object.prototype;
const exact = (x, keys) => plain(x) && Object.keys(x).every(key => keys.includes(key));
const copy = x => JSON.parse(JSON.stringify(x));
const id = x => typeof x === 'string' && /^[A-Za-z0-9_.:@-]{1,160}$/.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
const fail = (code, status = 400) => { throw Object.assign(new TypeError(code), { code, status }); };
const check = (value, code = 'invalid-alignment') => { if (!value) fail(code); };
const time = at => { check(typeof at === 'string' && Number.isFinite(Date.parse(at)) && new Date(at).toISOString() === at); return Date.parse(at); };
const canonical = value => JSON.stringify(value, (_key, item) => plain(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const prompts = [
  { field: 'self.plan', title: '약속을 정하는 방식', labels: { planned: '미리 계획하는 편', spontaneous: '그때 흐름에 맞추는 편' },
    options: [
      { id: 'baseline', label: '시간과 장소만 미리 정하기', suggestion: '이번 첫 만남은 시간과 장소만 미리 정하고, 만나서는 편한 흐름으로 조율해 볼까요?' },
      { id: 'full-plan', label: '만남의 순서도 미리 정하기', suggestion: '이번 첫 만남은 시간과 장소, 함께 할 일의 순서까지 미리 정해 볼까요?' },
      { id: 'on-day', label: '시간과 장소는 미리, 할 일은 당일 함께 고르기', suggestion: '이번 첫 만남은 시간과 장소를 미리 정하고, 함께 할 일은 당일 둘이 확인해서 골라 볼까요?' },
    ] },
  { field: 'self.pace', title: '대화를 시작하는 방식', labels: { lead: '먼저 이야기를 꺼내는 편', listen: '먼저 듣는 편' },
    options: [
      { id: 'baseline', label: '번갈아 이야기 꺼내기', suggestion: '이번 첫 만남에서는 번갈아 이야기를 꺼내고, 서로 듣기 편한 속도로 대화해 볼까요?' },
      { id: 'lead-first', label: '먼저 이야기하는 편인 사람이 시작하기', suggestion: '이번 첫 만남은 먼저 이야기를 꺼내는 편인 사람이 첫 주제를 시작하고, 이후에는 서로 편하게 이어 가 볼까요?' },
      { id: 'free-start', label: '그날 편한 사람이 먼저 시작하기', suggestion: '이번 첫 만남은 먼저 이야기할 사람을 정해 두지 않고, 그날 편한 사람이 시작해 볼까요?' },
    ] },
  { field: 'self.notice', title: '연락이 늦어질 때 알리는 방식', labels: { advance: '바빠지기 전에 알리는 편', 'when-free': '여유가 생기면 알리는 편', flexible: '상황에 맞춰 조율하는 편' },
    options: [
      { id: 'baseline', label: '늦어질 때 짧게 알려주기', suggestion: '이번 만남의 연락이 늦어질 것 같으면 짧게 알려주고, 여유가 생기면 이어서 이야기해 볼까요?' },
      { id: 'when-free', label: '여유가 생겼을 때 이어서 연락하기', suggestion: '이번 만남의 연락은 미리 늦어진다고 알리지 않아도 괜찮고, 여유가 생겼을 때 이어서 이야기해 볼까요?' },
      { id: 'agree-window', label: '서로 연락하기 편한 시간 확인하기', suggestion: '이번 만남을 준비하는 동안 서로 연락하기 편한 시간을 먼저 확인하고, 그 시간에 이야기해 볼까요?' },
    ] },
];
const proposalKey = (contextKey, proposal) => digest({ version: VERSION, contextKey, proposalVersion: proposal.version, optionId: proposal.optionId });
function contextOf(input, at) {
  check(exact(input, ['pairId', 'introduction', 'people', 'available', 'firstMeetingStarted']) && id(input.pairId)
    && typeof input.available === 'boolean' && typeof input.firstMeetingStarted === 'boolean'
    && exact(input.introduction, ['id', 'sentAt', 'accepted']) && (input.introduction.id === null || id(input.introduction.id))
    && typeof input.introduction.accepted === 'boolean' && (input.introduction.sentAt === null || time(input.introduction.sentAt) <= time(at))
    && Array.isArray(input.people) && input.people.length === 2 && new Set(input.people.map(person => person.id)).size === 2);
  for (const person of input.people) {
    check(exact(person, ['id', 'label', 'generation', 'values']) && id(person.id) && typeof person.label === 'string' && person.label.length <= 80
      && Number.isSafeInteger(person.generation) && person.generation >= 0 && exact(person.values, prompts.map(prompt => prompt.field)));
    for (const [field, value] of Object.entries(person.values)) check(Object.hasOwn(prompts.find(prompt => prompt.field === field).labels, value));
  }
  return input;
}
export function createMeetingAlignment() {
  function create({ revision = 0 } = {}) {
    check(Number.isSafeInteger(revision) && revision >= 0); return { version: VERSION, revision, key: null, people: [], responses: [] };
  }
  function validate(state, at) {
    check(exact(state, ['version', 'revision', 'key', 'people', 'responses', 'contextKey', 'proposal']) && state.version === VERSION
      && Number.isSafeInteger(state.revision) && state.revision >= 0 && (state.key === null || /^[a-f0-9]{64}$/.test(state.key))
      && Array.isArray(state.people) && (state.key === null ? state.people.length === 0 : state.people.length === 2 && state.people.every(id) && state.people[0] < state.people[1])
      && Array.isArray(state.responses) && state.responses.length <= 2 && new Set(state.responses.map(response => response.personId)).size === state.responses.length);
    const extended = Object.hasOwn(state, 'contextKey') || Object.hasOwn(state, 'proposal');
    if (extended) check(/^[a-f0-9]{64}$/.test(state.contextKey) && exact(state.proposal, ['version', 'optionId', 'proposedBy', 'at'])
      && Number.isSafeInteger(state.proposal.version) && state.proposal.version > 0
      && prompts.some(prompt => prompt.options.some(option => option.id === state.proposal.optionId))
      && state.people.includes(state.proposal.proposedBy) && time(state.proposal.at) <= time(at)
      && state.key === proposalKey(state.contextKey, state.proposal));
    for (const response of state.responses) check(exact(response, ['personId', 'value', 'at']) && state.people.includes(response.personId)
      && ['yes', 'different'].includes(response.value) && time(response.at) <= time(at)
      && (!extended || time(response.at) >= time(state.proposal.at)));
  }
  function question(context, at) {
    contextOf(context, at);
    if (!context.available) return { reason: 'pair-unavailable' };
    if (!context.introduction.accepted || !context.introduction.id || !context.introduction.sentAt) return { reason: 'introduction-required' };
    if (context.firstMeetingStarted) return { reason: 'first-meeting-started' };
    const people = [...context.people].sort((a, b) => a.id.localeCompare(b.id));
    const prompt = prompts.find(item => people.every(person => Object.hasOwn(person.values, item.field) && person.values[item.field] !== 'flexible')
      && people[0].values[item.field] !== people[1].values[item.field]);
    if (!prompt) return { reason: 'no-public-difference' };
    const key = digest({ version: VERSION, pairId: context.pairId, introduction: context.introduction,
      people: people.map(person => ({ id: person.id, generation: person.generation, value: person.values[prompt.field] })), field: prompt.field });
    return { key, field: prompt.field, title: prompt.title, options: copy(prompt.options),
      basis: people.map(person => ({ personId: person.id, label: person.label, valueLabel: prompt.labels[person.values[prompt.field]] })) };
  }
  function inspect(state, context, { viewer, at }) {
    validate(state, at); contextOf(context, at); check(context.people.some(person => person.id === viewer));
    const offer = question(context, at), extended = Object.hasOwn(state, 'proposal');
    const shared = !!offer.key && offer.key === (extended ? state.contextKey : state.key);
    const selectedOptionId = shared && extended ? state.proposal.optionId : 'baseline';
    const selected = offer.options?.find(option => option.id === selectedOptionId);
    if (offer.key) check(!!selected);
    const me = shared ? state.responses.find(response => response.personId === viewer)?.value || null : null;
    const partner = shared ? state.responses.find(response => response.personId !== viewer)?.value || null : null;
    return { scope: 'next-first-meeting', revision: state.revision, ...offer,
      ...(offer.key ? { contextKey: offer.key, key: shared && extended ? state.key : offer.key, selectedOptionId,
        suggestion: selected.suggestion, proposalVersion: shared && extended ? state.proposal.version : 0,
        proposal: shared && extended && selectedOptionId !== 'baseline' ? { byMe: state.proposal.proposedBy === viewer,
          label: context.people.find(person => person.id === state.proposal.proposedBy).label, at: state.proposal.at } : null } : {}),
      status: !offer.key ? 'unavailable' : me === 'yes' && partner === 'yes' ? 'agreed' : me === 'different' || partner === 'different' ? 'different' : me || partner ? 'waiting' : 'optional',
      me: { value: me }, partner: { value: partner }, canRespond: !!offer.key, canWithdraw: !!me,
      canProposeOption: !!offer.key, canCancelOption: !!offer.key && shared && extended && selectedOptionId !== 'baseline' && state.proposal.proposedBy === viewer,
      notice: '선택적으로 맞춰 보는 한 가지예요. 양쪽이 동의해도 소개·일정 수락을 대신하지 않고, 다음 첫 만남 이후에는 이어 쓰지 않아요.' };
  }
  function record(state, context, input) {
    const kind = input?.kind || 'respond';
    const fields = kind === 'respond' ? ['actor', 'key', 'value', 'expectedRevision', 'at']
      : kind === 'propose-option' ? ['actor', 'key', 'kind', 'optionId', 'expectedRevision', 'at']
      : kind === 'cancel-option' ? ['actor', 'key', 'kind', 'expectedRevision', 'at'] : [];
    check(exact(input, fields) && Object.keys(input).length === fields.length && id(input.actor)
      && /^[a-f0-9]{64}$/.test(input.key) && Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0);
    if (kind === 'respond') check(['yes', 'different', null].includes(input.value));
    validate(state, input.at); const view = inspect(state, context, { viewer: input.actor, at: input.at });
    if (state.revision !== input.expectedRevision) fail('alignment-revision-conflict', 409);
    if (!view.canRespond || input.key !== view.key) fail('alignment-stale', 409);
    if (kind !== 'respond') {
      const optionId = kind === 'cancel-option' ? 'baseline' : input.optionId;
      check(view.options.some(option => option.id === optionId) && optionId !== view.selectedOptionId);
      if (kind === 'cancel-option' && !view.canCancelOption) fail('alignment-cancel-forbidden', 403);
      const proposal = { version: view.proposalVersion + 1, optionId, proposedBy: input.actor, at: input.at };
      const next = { version: VERSION, revision: state.revision + 1, key: proposalKey(view.contextKey, proposal),
        contextKey: view.contextKey, proposal, people: context.people.map(person => person.id).sort(), responses: [] };
      validate(next, input.at); return next;
    }
    const responses = (state.key === view.key ? state.responses : []).filter(response => response.personId !== input.actor);
    const own = state.key === view.key && state.responses.find(response => response.personId === input.actor);
    if (input.value !== null) responses.push(own?.value === input.value ? copy(own) : { personId: input.actor, value: input.value, at: input.at });
    const next = { version: VERSION, revision: state.revision + 1, key: view.key, people: context.people.map(person => person.id).sort(), responses,
      ...(Object.hasOwn(state, 'proposal') && state.contextKey === view.contextKey ? { contextKey: state.contextKey, proposal: copy(state.proposal) } : {}) };
    validate(next, input.at); return next;
  }
  return Object.freeze({ create, inspect, record });
}
