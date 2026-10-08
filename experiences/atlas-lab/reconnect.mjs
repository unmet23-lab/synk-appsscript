// Product-owned, two-person invitation state. No network, storage or inferred intent.
// Hosts authenticate person and authorize delivery; inspect is the only public projection.
const VERSION = 'reconnect-1', START = '2026-10-06T10:00:00.000Z', WINDOW = 72 * 60 * 60 * 1000;
const copy = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.hasOwn(value, key);
const fail = message => { throw new TypeError(`Reconnect: ${message}`); };
const exact = (value, keys) => !!value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).every(key => keys.includes(key));
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const instant = value => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? Date.parse(value) : fail('invalid time');
const iso = value => new Date(instant(value)).toISOString();
const kinds = { met: ['encounterId'], intent: ['encounterId', 'value'], send: ['encounterId', 'to', 'message', 'expiresAt'],
  respond: ['invitationId', 'value'], withdraw: ['invitationId'], prepare: ['invitationId'], advance: ['encounterId'], 'close-invitations': [], reopen: [], pause: [], resume: [], block: [], unblock: [] };
const signature = value => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => !['at', 'id', 'requestId', 'expectedRevision', 'pairBinding'].includes(key)).sort(([a], [b]) => a.localeCompare(b))));

export function createReconnectAdapter() {
  function create({ pairId, people }) {
    const state = { version: VERSION, pairId, people: copy(people), events: [] };
    replay(state, START); return state;
  }
  function replay(state, at) {
    instant(at);
    if (!exact(state, ['version', 'pairId', 'people', 'events']) || state.version !== VERSION || !token(state.pairId)
      || !Array.isArray(state.people) || state.people.length !== 2 || new Set(state.people.map(p => p.id)).size !== 2
      || state.people.some(p => !exact(p, ['id', 'label']) || !token(p.id) || typeof p.label !== 'string' || !p.label.trim() || p.label.length > 100)
      || !Array.isArray(state.events) || state.events.length > 1000) fail('invalid state');
    const binding = JSON.stringify([state.pairId, state.people]), ids = state.people.map(p => p.id);
    const runtime = { people: copy(state.people), met: {}, intents: {}, paused: {}, blocking: {}, receiving: {}, invitations: [] };
    for (const id of ids) { runtime.met[id] = []; runtime.intents[id] = {}; runtime.paused[id] = false; runtime.blocking[id] = false; runtime.receiving[id] = true; }
    let previous = instant(START) - 1, invitationSequence = 0;
    const requests = new Set();
    const expire = time => { for (const invite of runtime.invitations) if (invite.status === 'pending' && instant(invite.expiresAt) <= instant(time)) { invite.status = 'expired'; invite.closedAt = invite.expiresAt; } };
    for (const [index, event] of state.events.entries()) {
      if (!event || !own(kinds, event.kind) || !exact(event, ['id', 'at', 'person', 'kind', 'pairBinding', 'requestId', ...kinds[event.kind]])
        || event.id !== `reconnect-${index + 1}` || event.pairBinding !== binding || !ids.includes(event.person)
        || iso(event.at) !== event.at || instant(event.at) <= previous || instant(event.at) > instant(at)
        || (own(event, 'requestId') && (!token(event.requestId) || requests.has(event.requestId)))) fail('invalid, stale or cross-pair event');
      previous = instant(event.at); if (event.requestId) requests.add(event.requestId); expire(event.at);
      // Maintenance added by the meeting wrapper must not renumber invitation
      // IDs already referenced by saved outer events. Advance replaces the old
      // prepare event only when it actually consumes an accepted invitation.
      if (!['advance', 'close-invitations'].includes(event.kind)) invitationSequence++;
      const person = event.person, partner = ids.find(id => id !== person), inaccessible = ids.some(id => runtime.blocking[id]);
      if (event.kind === 'met') {
        if (!token(event.encounterId) || runtime.met[person].includes(event.encounterId)) fail('invalid or repeated own attendance');
        runtime.met[person].push(event.encounterId);
        for (const invitation of runtime.invitations) if (invitation.status === 'accepted' && invitation.encounterId !== event.encounterId) {
          invitation.status = 'completed'; invitation.closedAt = event.at;
        }
      } else if (event.kind === 'intent') {
        if (!runtime.met[person].includes(event.encounterId) || ![null, 'yes', 'no', 'unsure', 'not-now'].includes(event.value)) fail('intent needs your own attendance');
        if (event.value === null) delete runtime.intents[person][event.encounterId];
        else runtime.intents[person][event.encounterId] = { encounterId: event.encounterId, value: event.value, at: event.at };
      } else if (event.kind === 'send') {
        if (inaccessible || runtime.paused[person] || runtime.paused[partner] || !runtime.receiving[partner]) fail('new invitation unavailable');
        if (event.to !== partner || runtime.met[person].at(-1) !== event.encounterId
          || typeof event.message !== 'string' || !event.message.trim() || event.message !== event.message.trim() || event.message.length > 280
          || iso(event.expiresAt) !== event.expiresAt || instant(event.expiresAt) <= instant(event.at) || instant(event.expiresAt) > instant(event.at) + WINDOW) fail('invalid explicit invitation');
        if (runtime.invitations.some(invitation => ['pending', 'accepted'].includes(invitation.status))) fail('one active invitation per pair');
        runtime.invitations.push({ id: `reconnect-${invitationSequence}`, from: person, to: partner, encounterId: event.encounterId, message: event.message,
          sentAt: event.at, expiresAt: event.expiresAt, status: 'pending', response: null, respondedAt: null, closedAt: null, preparedAt: null });
      } else if (event.kind === 'prepare') {
        const invitation = runtime.invitations.find(item => item.id === event.invitationId);
        if (inaccessible || ids.some(id => runtime.paused[id]) || !invitation || invitation.status !== 'accepted' || invitation.preparedAt) fail('no new accepted invitation to prepare');
        invitation.preparedAt = event.at;
      } else if (event.kind === 'advance') {
        if (!token(event.encounterId) || inaccessible || ids.some(id => runtime.paused[id])) fail('cannot advance this encounter');
        for (const invitation of runtime.invitations) {
          if (invitation.status === 'accepted' && !invitation.preparedAt && invitation.encounterId === event.encounterId) { invitation.preparedAt = event.at; invitationSequence++; }
          else if (['pending', 'accepted'].includes(invitation.status)) { invitation.status = 'closed'; invitation.closedAt = event.at; }
        }
      } else if (event.kind === 'close-invitations') {
        for (const invitation of runtime.invitations) if (['pending', 'accepted'].includes(invitation.status)) { invitation.status = 'closed'; invitation.closedAt = event.at; }
      } else if (event.kind === 'respond' || event.kind === 'withdraw') {
        const invitation = runtime.invitations.find(item => item.id === event.invitationId);
        if (inaccessible || !invitation || !['pending', 'accepted'].includes(invitation.status)) fail('invitation is no longer available');
        if (event.kind === 'withdraw') {
          if (invitation.from !== person || invitation.preparedAt) fail('only sender can withdraw before preparing the next meeting');
          invitation.status = 'withdrawn'; invitation.closedAt = event.at;
        } else {
          if (invitation.to !== person || invitation.status !== 'pending' || !['accept', 'busy', 'decline'].includes(event.value)) fail('only recipient can answer once');
          invitation.response = event.value; invitation.respondedAt = event.at;
          invitation.status = { accept: 'accepted', busy: 'deferred', decline: 'declined' }[event.value];
          if (event.value !== 'accept') { invitation.closedAt = event.at; runtime.receiving[person] = false; }
        }
      } else if (event.kind === 'pause') runtime.paused[person] = true;
      else if (event.kind === 'resume') runtime.paused[person] = false;
      else if (event.kind === 'reopen') { if (runtime.blocking[person]) fail('unblock before reopening'); runtime.receiving[person] = true; }
      else if (event.kind === 'block') {
        runtime.blocking[person] = true; runtime.receiving[person] = false;
        for (const invitation of runtime.invitations) if (['pending', 'accepted'].includes(invitation.status)) { invitation.status = 'closed'; invitation.closedAt = event.at; }
      } else if (event.kind === 'unblock') runtime.blocking[person] = false;
    }
    expire(at); return runtime;
  }
  function record(state, input) {
    if (!input || !own(kinds, input.kind) || !exact(input, ['kind', 'person', 'at', 'requestId', 'expectedRevision', ...kinds[input.kind]])) fail('invalid action');
    const last = state?.events?.at(-1)?.at || START;
    replay(state, last);
    // A retry preserves the original deadline and result even after another event.
    if (input.requestId) {
      if (!token(input.requestId)) fail('invalid request id');
      const prior = state.events.find(event => event.requestId === input.requestId);
      if (prior) {
        const check = { ...input, ...(input.kind === 'send' && !own(input, 'expiresAt') ? { expiresAt: prior.expiresAt } : {}) };
        if (signature(prior) !== signature(check)) fail('request id reused with different action');
        return copy(state);
      }
    }
    if (own(input, 'expectedRevision') && input.expectedRevision !== state.events.length) fail('stale revision');
    const at = input.at === undefined ? new Date(instant(last) + 1000).toISOString() : iso(input.at);
    const { expectedRevision, ...action } = copy(input);
    const event = { ...action, id: `reconnect-${state.events.length + 1}`, at, pairBinding: JSON.stringify([state.pairId, state.people]) };
    if (event.kind === 'send' && !own(event, 'expiresAt')) event.expiresAt = new Date(instant(at) + WINDOW).toISOString();
    const result = { ...copy(state), events: [...copy(state.events), event] }; replay(result, at); return result;
  }
  function inspect(state, { viewer, at = state?.events?.at(-1)?.at || START, encounterId } = {}) {
    const runtime = replay(state, at);
    if (!runtime.people.some(person => person.id === viewer)) fail('unknown viewer');
    const partner = runtime.people.find(person => person.id !== viewer), current = encounterId || runtime.met[viewer].at(-1) || null;
    const unavailable = runtime.people.some(person => runtime.blocking[person.id]), intent = runtime.intents[viewer][current] || null;
    const active = runtime.invitations.find(invitation => ['pending', 'accepted'].includes(invitation.status));
    const canSend = !unavailable && !runtime.paused[viewer] && !runtime.paused[partner.id] && runtime.receiving[partner.id]
      && runtime.met[viewer].at(-1) === current && !active;
    const invitation = unavailable ? null : copy(active || runtime.invitations.at(-1) || null);
    return { version: VERSION, revision: state.events.length, pairId: state.pairId, access: unavailable ? 'unavailable' : 'available',
      me: { id: viewer, intent: copy(intent), paused: runtime.paused[viewer], blocking: runtime.blocking[viewer], receiving: runtime.receiving[viewer],
        canReflect: runtime.met[viewer].includes(current), encounterId: current },
      invitation, history: unavailable ? [] : copy(runtime.invitations), canSend,
      canStartPlan: !unavailable && !runtime.paused[viewer] && !runtime.paused[partner.id],
      canSuggest: canSend && !['no', 'not-now'].includes(intent?.value),
      canRespond: !!invitation && invitation.status === 'pending' && invitation.to === viewer,
      canWithdraw: !!invitation && ['pending', 'accepted'].includes(invitation.status) && !invitation.preparedAt && invitation.from === viewer,
      canPrepare: !!invitation && invitation.status === 'accepted' && !invitation.preparedAt && !runtime.paused[viewer] && !runtime.paused[partner.id],
      description: '초대 수락은 다음 만남을 준비하겠다는 답이에요. 구체적인 일정과 방식은 양쪽이 새로 확인해야 해요.' };
  }
  return Object.freeze({ create, record, inspect });
}
