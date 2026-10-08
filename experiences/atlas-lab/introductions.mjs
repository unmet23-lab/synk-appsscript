// Product consent to start an introduction. It never means consent to a date.
// Hosts authenticate actors and retain this ledger across replacement pair IDs.
const VERSION = 'introductions-1', WINDOW = 72 * 3600000, RETRY = 7 * 86400000;
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const copy = value => JSON.parse(JSON.stringify(value));
const token = value => typeof value === 'string' && /^[A-Za-z0-9_.:@-]{1,160}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const fail = (code, status = 400) => { throw Object.assign(new TypeError(code), { code, status }); };
const check = (value, code = 'invalid-introduction') => { if (!value) fail(code); };
const time = value => { check(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value); return Date.parse(value); };
const canonical = value => JSON.stringify(value, (_key, entry) => plain(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
const shapes = { send: ['pairId'], respond: ['introductionId', 'value'], withdraw: ['introductionId'], reopen: [], close: [] };
function normalized(input) {
  check(plain(input) && Object.hasOwn(shapes, input.kind) && exact(input, ['kind', 'actor', 'requestId', 'expectedRevision', 'at', ...shapes[input.kind]])
    && token(input.actor) && token(input.requestId) && Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0);
  time(input.at);
  if (input.kind === 'send') check(token(input.pairId));
  if (['respond', 'withdraw'].includes(input.kind)) check(token(input.introductionId));
  if (input.kind === 'respond') check(['accept', 'decline'].includes(input.value));
  return copy(input);
}
const signature = input => canonical(Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'at')));

export function createIntroductionsAdapter() {
  function create({ people, at }) {
    check(Array.isArray(people) && people.length === 2 && people.every(token) && people[0] !== people[1]); time(at);
    return { version: VERSION, people: [...people].sort(), createdAt: at, revision: 0, events: [] };
  }
  function replay(state, at) {
    const now = time(at);
    check(exact(state, ['version', 'people', 'createdAt', 'revision', 'events']) && state.version === VERSION && Array.isArray(state.people)
      && state.people.length === 2 && state.people.every(token) && state.people[0] < state.people[1]
      && Array.isArray(state.events) && state.events.length <= 2000 && state.revision === state.events.length);
    let lastAt = time(state.createdAt), current = null, nextRequestAt = null;
    check(now >= lastAt);
    const closed = new Set(), ids = new Set(), reopened = new Set();
    function expire(t) { if (current?.status === 'pending' && time(current.expiresAt) <= t) current.status = 'expired'; }
    function apply(event) {
      const e = normalized(event), instant = time(e.at);
      check(state.people.includes(e.actor) && instant >= lastAt && instant <= now && e.expectedRevision === ids.size && !ids.has(`${e.actor}:${e.requestId}`));
      expire(instant);
      const peer = state.people.find(person => person !== e.actor);
      if (e.kind === 'send') {
        if (closed.size || ['pending', 'accepted'].includes(current?.status)) fail('introduction-unavailable', 403);
        if (nextRequestAt && instant < time(nextRequestAt)) fail('introduction-cooldown', 429);
        current = { id: e.requestId, pairId: e.pairId, from: e.actor, to: peer, status: 'pending', sentAt: e.at, expiresAt: new Date(instant + WINDOW).toISOString(), respondedAt: null };
        reopened.clear();
        nextRequestAt = new Date(instant + RETRY).toISOString();
      } else if (e.kind === 'respond') {
        if (!current || current.id !== e.introductionId || current.status !== 'pending' || current.to !== e.actor) fail('introduction-response-unavailable', 403);
        current.status = e.value === 'accept' ? 'accepted' : 'declined'; current.respondedAt = e.at;
        if (e.value === 'decline') closed.add(e.actor);
      } else if (e.kind === 'withdraw') {
        if (!current || current.id !== e.introductionId || !['pending', 'accepted'].includes(current.status)
          || current.status === 'pending' && current.from !== e.actor) fail('introduction-withdraw-unavailable', 403);
        current.status = 'withdrawn'; closed.add(e.actor);
      } else if (e.kind === 'close') {
        closed.add(e.actor);
        if (current && ['pending', 'accepted'].includes(current.status)) current.status = 'withdrawn';
      } else {
        if (!closed.has(e.actor) && !(current?.to === e.actor && current.status === 'expired' && !reopened.has(e.actor))) fail('introduction-reopen-unavailable', 403);
        closed.delete(e.actor); reopened.add(e.actor);
        // Only the previous recipient can explicitly invite a fresh request sooner.
        if (current?.to === e.actor) nextRequestAt = e.at;
      }
      ids.add(`${e.actor}:${e.requestId}`); lastAt = instant;
    }
    for (const event of state.events) apply(event);
    expire(now);
    return { current, closed, nextRequestAt, reopened };
  }
  function record(state, input) {
    const event = normalized(input), prior = state.events?.find(row => row.actor === event.actor && row.requestId === event.requestId);
    if (prior) { replay(state, event.at); if (signature(prior) !== signature(event)) fail('introduction-idempotency-conflict', 409); return copy(state); }
    replay(state, event.at);
    if (state.revision !== event.expectedRevision) fail('introduction-revision-conflict', 409);
    const result = { ...copy(state), revision: state.revision + 1, events: [...copy(state.events), event] }; replay(result, event.at); return result;
  }
  function inspect(state, { viewer, at, pairId } = {}) {
    check(state?.people?.includes(viewer));
    const result = replay(state, at), current = result.current, bound = !pairId || current?.pairId === pairId;
    const visible = bound ? current : null;
    return { revision: state.revision, current: visible ? copy(visible) : null,
      accepted: !!(visible?.status === 'accepted'),
      canRespond: !!(visible?.status === 'pending' && visible.to === viewer),
      canWithdraw: !!(visible && (visible.status === 'accepted' || visible.status === 'pending' && visible.from === viewer)),
      canReopen: result.closed.has(viewer) || !!(current?.status === 'expired' && current.to === viewer && !result.reopened.has(viewer)),
      canSend: !result.closed.size && !['pending', 'accepted'].includes(current?.status) && (!result.nextRequestAt || time(at) >= time(result.nextRequestAt)),
      nextRequestAt: result.nextRequestAt, expiryHours: WINDOW / 3600000, retryDays: RETRY / 86400000 };
  }
  return Object.freeze({ create, record, inspect });
}
