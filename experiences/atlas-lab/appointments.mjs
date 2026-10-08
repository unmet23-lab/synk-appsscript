// Product-owned dated appointments and an in-app inbox. Hosts authenticate actors,
// authorize the pair, persist raw state and deliver only inspect(viewer) results.
// No identity service, network, email, push, calendar booking or inferred intent.
const VERSION = 'appointments-1', WINDOW = 72 * 60 * 60 * 1000;
const copy = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.hasOwn(value, key);
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const fail = message => { throw new TypeError(`Appointments: ${message}`); };
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:@-]{1,160}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const canonical = value => JSON.stringify(value, (_key, entry) => plain(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
function time(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) fail('an ISO instant with an explicit offset is required');
  const [, y, m, d, h, min, sec, fraction = '', offset] = match;
  const parts = [y, m, d, h, min, sec].map(Number), milliseconds = Number(fraction.padEnd(3, '0'));
  if (parts[0] < 2000 || parts[0] > 9999 || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) fail('invalid calendar instant');
  const wall = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], milliseconds), date = new Date(wall);
  if ([date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].some((part, index) => part !== parts[index])) fail('invalid calendar instant');
  let shift = 0;
  if (offset !== 'Z') {
    const hour = Number(offset.slice(1, 3)), minute = Number(offset.slice(4));
    if (hour > 14 || minute > 59 || hour === 14 && minute !== 0) fail('invalid UTC offset');
    shift = (hour * 60 + minute) * 60000 * (offset[0] === '+' ? 1 : -1);
  }
  return wall - shift;
}
const iso = value => new Date(time(value)).toISOString();
function text(value, limit, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > limit || !optional && !value.trim()) fail('invalid text');
  return value.trim();
}
function schedule(value) {
  if (!exact(value, ['startsAt', 'endsAt', 'timeZone', 'place', 'note'])) fail('invalid schedule fields');
  const startsAt = iso(value.startsAt), endsAt = iso(value.endsAt);
  if (time(endsAt) <= time(startsAt)) fail('appointment must end after it starts');
  if (typeof value.timeZone !== 'string' || value.timeZone.length > 100) fail('invalid time zone');
  let timeZone;
  try { timeZone = new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).resolvedOptions().timeZone; } catch { fail('invalid time zone'); }
  return { startsAt, endsAt, timeZone, place: text(value.place, 180), note: text(value.note, 280, true) };
}
const fields = {
  propose: ['schedule', 'expiresAt'], revise: ['appointmentId', 'schedule', 'expiresAt'],
  respond: ['appointmentId', 'proposalVersion', 'value'], cancel: ['appointmentId'], complete: ['appointmentId'],
  reflect: ['appointmentId', 'value', 'note'], read: ['notificationId'], notifications: ['enabled'],
  reopen: ['appointmentId', 'proposalVersion'],
  'apply-suggestion': ['suggestionId', 'suggestionRevision'], 'dismiss-suggestion': ['suggestionId', 'suggestionRevision'],
  'undo-suggestion': ['suggestionId', 'suggestionRevision']
};
const common = ['actor', 'kind', 'requestId', 'expectedRevision', 'at'];
function normalize(input) {
  if (!input || !own(fields, input.kind) || !exact(input, [...common, ...fields[input.kind]]) || !token(input.actor)
    || !token(input.requestId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) fail('invalid action envelope');
  const result = copy(input);
  if (own(input, 'at')) result.at = iso(input.at);
  if (['propose', 'revise'].includes(input.kind)) {
    result.schedule = schedule(input.schedule);
    if (own(input, 'expiresAt')) result.expiresAt = iso(input.expiresAt);
  }
  if (fields[input.kind].includes('appointmentId') && !token(input.appointmentId)) fail('invalid appointment id');
  if (['respond', 'reopen'].includes(input.kind) && (!Number.isSafeInteger(input.proposalVersion) || input.proposalVersion < 1)) fail('invalid proposal version');
  if (input.kind === 'respond' && !['accept', 'busy', 'decline'].includes(input.value)) fail('invalid response');
  if (input.kind.endsWith('-suggestion') && (!token(input.suggestionId) || !Number.isSafeInteger(input.suggestionRevision) || input.suggestionRevision < 1)) fail('invalid private suggestion reference');
  if (input.kind === 'reflect') {
    if (!['good', 'too-long', 'change-activity'].includes(input.value)) fail('invalid personal reflection');
    result.note = text(input.note, 500, true);
  }
  if (input.kind === 'read' && !token(input.notificationId)) fail('invalid notification id');
  if (input.kind === 'notifications' && typeof input.enabled !== 'boolean') fail('explicit notification preference required');
  return result;
}
const signature = action => canonical(Object.fromEntries(Object.entries(action).filter(([key]) => !['id', 'at', 'pairBinding', 'policyVersion'].includes(key))));
const noticeLabels = {
  proposed: ['새 일정 제안', '상대가 구체적인 만남 일정을 제안했어요.'],
  revised: ['일정 변경 제안', '새 일정판을 확인하고 다시 응답해 주세요. 이전 수락은 이어지지 않아요.'],
  accepted: ['일정 수락', '상대가 이 일정판을 수락했어요. 두 사람의 수락이 모두 필요해요.'],
  declined: ['만남 제안 종료', '상대가 만남을 원하지 않는다고 답했어요. 상대가 직접 다시 열기 전에는 새 제안을 보내지 않아요.'],
  'legacy-declined': ['이전 일정 제안 종료', '이전 기록에서 이 일정이 어렵다는 답을 남겼어요. 사람에 대한 거절로 다시 해석하지 않으며 새 제안은 상대가 직접 다시 연 뒤 보내요.'],
  busy: ['이번 시간은 어려워요', '이번 일정은 어렵다는 답이에요. 만남 거절로 기록하지 않으며 다른 일정을 제안할 수 있어요.'],
  cancelled: ['약속 취소', '이 약속을 취소했어요. 이전 수락으로 다시 진행하지 않아요.'],
  completed: ['본인 완료 확인', '상대가 만남을 마쳤다고 확인했어요. 상대의 개인 회고는 공개하지 않아요.'],
  expired: ['응답 기한 종료', '이 일정판의 응답 기한이 지났어요. 무응답을 거절로 기록하지 않아요.']
};

export function createAppointmentsAdapter({ clock = () => new Date().toISOString() } = {}) {
  if (typeof clock !== 'function') fail('clock must be a function');
  const clockAt = () => { const value = clock(); return iso(value instanceof Date ? value.toISOString() : value); };
  function create({ pairId, people, at = clockAt() } = {}) {
    const state = { version: VERSION, pairId, people: copy(people), createdAt: iso(at), revision: 0, events: [] };
    replay(state, state.createdAt); return state;
  }
  function replay(state, at) {
    const now = time(at);
    if (!exact(state, ['version', 'pairId', 'people', 'createdAt', 'revision', 'events']) || state.version !== VERSION || !token(state.pairId)
      || !Array.isArray(state.people) || state.people.length !== 2 || new Set(state.people.map(person => person.id)).size !== 2
      || state.people.some(person => !exact(person, ['id', 'label']) || !token(person.id) || typeof person.label !== 'string' || !person.label.trim() || person.label.length > 100)
      || !Array.isArray(state.events) || state.events.length > 2000 || state.revision !== state.events.length
      || iso(state.createdAt) !== state.createdAt || time(state.createdAt) > now) fail('invalid or cross-pair state');
    const people = copy(state.people), ids = people.map(person => person.id), binding = canonical([state.pairId, people, state.createdAt]);
    const runtime = { people, appointments: [], inbox: [], reads: Object.fromEntries(ids.map(id => [id, new Set()])),
      preferences: Object.fromEntries(ids.map(id => [id, true])), reflections: Object.fromEntries(ids.map(id => [id, []])),
      receiving: Object.fromEntries(ids.map(id => [id, { state: 'open', appointmentId: null, proposalVersion: null }])),
      suggestions: Object.fromEntries(ids.map(id => [id, []])), nextForm: Object.fromEntries(ids.map(id => [id, null])) };
    const requests = new Set(); let previous = time(state.createdAt), policyStarted = false;
    const receivingOpen = () => ids.every(id => runtime.receiving[id].state === 'open');
    const hold = (actor, reason, appointment) => {
      runtime.receiving[actor] = { state: reason, appointmentId: appointment.id, proposalVersion: appointment.proposals.at(-1).version };
    };
    const emit = (kind, appointment, source, recipients, when, actor) => {
      for (const recipient of recipients) runtime.inbox.push({ id: `notice-${source}-${ids.indexOf(recipient)}`, recipient, kind,
        appointmentId: appointment.id, proposalVersion: appointment.proposals.at(-1).version, actor, at: when,
        notify: runtime.preferences[recipient], title: noticeLabels[kind][0], text: noticeLabels[kind][1] });
    };
    const expire = when => {
      for (const appointment of runtime.appointments) {
        const proposal = appointment.proposals.at(-1);
        if (appointment.status === 'pending' && time(proposal.expiresAt) <= time(when)) {
          appointment.status = proposal.status = 'expired'; appointment.closedAt = proposal.expiresAt;
          const recipient = ids.find(id => id !== proposal.proposedBy);
          if (!own(proposal.responses, recipient)) hold(recipient, 'expired', appointment);
          emit('expired', appointment, `expiry-${appointment.id}-${proposal.version}`, ids, proposal.expiresAt, null);
        }
      }
    };
    const hasOpenSlot = when => runtime.appointments.some(appointment => appointment.status === 'pending'
      || appointment.status === 'confirmed' && time(appointment.proposals.at(-1).schedule.endsAt) > time(when));
    for (const [index, event] of state.events.entries()) {
      if (!event || !own(fields, event.kind) || !exact(event, [...common, ...fields[event.kind], 'id', 'pairBinding', 'policyVersion'])
        || event.id !== `appointment-event-${index + 1}` || event.pairBinding !== binding || !ids.includes(event.actor)
        || event.expectedRevision !== index || iso(event.at) !== event.at || time(event.at) < previous || time(event.at) > now) fail('invalid, stale or cross-pair event');
      if (own(event, 'policyVersion') && event.policyVersion !== 2 || policyStarted && event.policyVersion !== 2) fail('invalid appointment policy version');
      if (event.policyVersion === 2) policyStarted = true;
      const input = Object.fromEntries(Object.entries(event).filter(([key]) => !['id', 'pairBinding', 'policyVersion'].includes(key)));
      if (canonical(normalize(input)) !== canonical(input)) fail('noncanonical action');
      const key = `${event.actor}\n${event.requestId}`;
      if (requests.has(key)) fail('duplicate stored request'); requests.add(key);
      previous = time(event.at); expire(event.at);
      const actor = event.actor, partner = ids.find(id => id !== actor);
      let appointment = event.appointmentId ? runtime.appointments.find(item => item.id === event.appointmentId) : null;
      if (own(event, 'appointmentId') && !appointment) fail('unknown appointment');
      if (event.kind === 'propose' || event.kind === 'revise') {
        if (event.policyVersion === 2 && !receivingOpen()) fail('the recipient must reopen before a new proposal');
        // Older records allowed another proposal after a decline. Preserve what
        // happened then; every newly recorded event uses the stricter policy.
        if (event.policyVersion === undefined) for (const id of ids) runtime.receiving[id] = { state: 'open', appointmentId: null, proposalVersion: null };
        if (time(event.schedule.startsAt) <= time(event.at) || !own(event, 'expiresAt') || time(event.expiresAt) <= time(event.at)
          || time(event.expiresAt) > time(event.schedule.startsAt) || time(event.expiresAt) > time(event.at) + WINDOW) fail('invalid future schedule or response deadline');
        if (event.kind === 'propose') {
          if (hasOpenSlot(event.at)) fail('an upcoming appointment is already open');
          appointment = { id: `appointment-${index + 1}`, status: 'pending', proposals: [], completed: {}, closedAt: null, cancelledBy: null };
          runtime.appointments.push(appointment);
        } else {
          const old = appointment.proposals.at(-1);
          if (!['pending', 'confirmed'].includes(appointment.status) || time(old.schedule.startsAt) <= time(event.at) || Object.keys(appointment.completed).length) fail('appointment cannot be revised');
          if (event.policyVersion === 2 && canonical(old.schedule) === canonical(event.schedule)) fail('a changed schedule is required');
          old.status = 'superseded'; old.supersededAt = event.at; appointment.status = 'pending';
        }
        appointment.proposals.push({ version: appointment.proposals.length + 1, proposedBy: actor, proposedAt: event.at,
          schedule: copy(event.schedule), expiresAt: event.expiresAt, status: 'pending', responses: {} });
        if (event.kind === 'propose' && runtime.nextForm[actor]) {
          const suggestion = runtime.suggestions[actor].find(item => item.id === runtime.nextForm[actor].suggestionId);
          if (suggestion) suggestion.status = 'consumed';
          runtime.nextForm[actor] = null;
        }
        emit(event.kind === 'propose' ? 'proposed' : 'revised', appointment, event.id, [partner], event.at, actor);
      } else if (event.kind === 'respond') {
        const proposal = appointment.proposals.at(-1);
        if (appointment.status !== 'pending' || event.proposalVersion !== proposal.version || own(proposal.responses, actor)) fail('closed, stale or already answered proposal');
        proposal.responses[actor] = { value: event.value, at: event.at,
          declineMeaning: event.value === 'decline' ? event.policyVersion === 2 ? 'meeting-intent' : 'legacy-schedule' : null };
        if (event.value === 'decline' || event.value === 'busy') {
          appointment.status = proposal.status = event.value === 'decline' ? 'declined' : 'busy'; appointment.closedAt = event.at;
          if (event.value === 'decline') hold(actor, event.policyVersion === 2 ? 'declined' : 'legacy-declined', appointment);
        }
        else if (ids.every(id => proposal.responses[id]?.value === 'accept')) appointment.status = proposal.status = 'confirmed';
        emit(event.value === 'accept' ? 'accepted' : event.value === 'busy' ? 'busy' : event.policyVersion === 2 ? 'declined' : 'legacy-declined', appointment, event.id, [partner], event.at, actor);
      } else if (event.kind === 'cancel') {
        if (!['pending', 'confirmed'].includes(appointment.status) || Object.keys(appointment.completed).length) fail('appointment cannot be cancelled');
        const proposal = appointment.proposals.at(-1), recipient = ids.find(id => id !== proposal.proposedBy);
        if (appointment.status === 'pending' && actor === proposal.proposedBy && !own(proposal.responses, recipient)) hold(recipient, 'cancelled', appointment);
        appointment.status = appointment.proposals.at(-1).status = 'cancelled'; appointment.closedAt = event.at; appointment.cancelledBy = actor;
        emit('cancelled', appointment, event.id, [partner], event.at, actor);
      } else if (event.kind === 'complete') {
        const proposal = appointment.proposals.at(-1);
        if (appointment.status !== 'confirmed' || time(proposal.schedule.endsAt) > time(event.at) || own(appointment.completed, actor)) fail('complete only your own confirmed, finished appointment');
        appointment.completed[actor] = event.at;
        if (ids.every(id => own(appointment.completed, id))) appointment.status = proposal.status = 'completed';
        emit('completed', appointment, event.id, [partner], event.at, actor);
      } else if (event.kind === 'reflect') {
        if (!own(appointment.completed, actor)) fail('personal reflection needs your own completion');
        const proposal = appointment.proposals.at(-1);
        const row = { appointmentId: appointment.id, proposalVersion: proposal.version, value: event.value, note: event.note, at: event.at };
        runtime.reflections[actor] = [...runtime.reflections[actor].filter(item => item.appointmentId !== appointment.id), row];
        for (const suggestion of runtime.suggestions[actor]) if (suggestion.source.appointmentId === appointment.id) {
          suggestion.status = 'invalidated';
          if (runtime.nextForm[actor]?.suggestionId === suggestion.id) runtime.nextForm[actor] = null;
        }
        const originalMinutes = (time(proposal.schedule.endsAt) - time(proposal.schedule.startsAt)) / 60000;
        if (event.value === 'change-activity' || event.value === 'too-long' && originalMinutes > 15) {
          // Product suggestion: two thirds of the prior duration, rounded down
          // to five minutes, with a fifteen-minute floor. No inferred preference.
          const minutes = event.value === 'too-long' ? Math.max(15, Math.floor(originalMinutes * 2 / 3 / 5) * 5) : null;
          runtime.suggestions[actor].push({ id: `suggestion-${event.id}`, revision: index + 1,
            source: { appointmentId: appointment.id, proposalVersion: proposal.version, reflectionEventId: event.id },
            kind: minutes === null ? 'change-activity' : 'shorter-duration', status: 'pending', minutes, originalMinutes,
            text: minutes === null ? '다음 일정에서는 장소나 활동을 직접 바꿔 볼 수 있어요. 특정 활동을 정하거나 상대에게 회고를 보내지는 않아요.'
              : `지난 ${originalMinutes}분이 길게 느껴졌다면, 다음 약속은 ${minutes}분으로 준비해 볼까요? 적용해도 아직 상대에게 보내지 않아요.` });
        }
      } else if (event.kind === 'reopen') {
        const gate = runtime.receiving[actor];
        if (gate.state === 'open' || gate.appointmentId !== event.appointmentId || gate.proposalVersion !== event.proposalVersion) fail('only your current closed receiving can be reopened');
        runtime.receiving[actor] = { state: 'open', appointmentId: null, proposalVersion: null };
      } else if (event.kind.endsWith('-suggestion')) {
        const suggestion = runtime.suggestions[actor].find(item => item.id === event.suggestionId && item.revision === event.suggestionRevision);
        if (!suggestion || ['invalidated', 'consumed'].includes(suggestion.status)) fail('stale or foreign private suggestion');
        if (event.kind === 'apply-suggestion') {
          if (suggestion.kind !== 'shorter-duration' || !['pending', 'undone'].includes(suggestion.status)) fail('suggestion cannot be applied');
          const previousSuggestion = runtime.suggestions[actor].find(item => item.id === runtime.nextForm[actor]?.suggestionId);
          if (previousSuggestion) previousSuggestion.status = 'undone';
          suggestion.status = 'applied'; runtime.nextForm[actor] = { durationMinutes: suggestion.minutes, suggestionId: suggestion.id, suggestionRevision: suggestion.revision };
        } else if (event.kind === 'dismiss-suggestion') {
          if (!['pending', 'undone'].includes(suggestion.status)) fail('suggestion cannot be dismissed');
          suggestion.status = 'dismissed';
        } else {
          if (suggestion.status !== 'applied' || runtime.nextForm[actor]?.suggestionId !== suggestion.id) fail('only the current form suggestion can be undone');
          suggestion.status = 'undone'; runtime.nextForm[actor] = null;
        }
      } else if (event.kind === 'read') {
        if (!runtime.inbox.some(item => item.id === event.notificationId && item.recipient === actor)) fail('unknown own inbox item');
        runtime.reads[actor].add(event.notificationId);
      } else if (event.kind === 'notifications') runtime.preferences[actor] = event.enabled;
    }
    expire(at); runtime.hasOpenSlot = hasOpenSlot(at); runtime.receivingOpen = receivingOpen(); return runtime;
  }
  function record(state, raw) {
    const input = normalize(raw), last = state?.events?.at(-1)?.at || state?.createdAt;
    replay(state, last);
    if (!state.people.some(person => person.id === input.actor)) fail('unknown actor');
    const prior = state.events.find(event => event.actor === input.actor && event.requestId === input.requestId);
    if (prior) {
      const retry = { ...input, ...(['propose', 'revise'].includes(input.kind) && !own(input, 'expiresAt') ? { expiresAt: prior.expiresAt } : {}) };
      if (signature(prior) !== signature(retry)) fail('request id reused with different action');
      return copy(state);
    }
    if (input.expectedRevision !== state.revision) fail('revision conflict');
    const at = input.at || clockAt(), event = { ...input, id: `appointment-event-${state.events.length + 1}`, at, policyVersion: 2,
      pairBinding: canonical([state.pairId, state.people, state.createdAt]) };
    if (['propose', 'revise'].includes(event.kind) && !own(event, 'expiresAt')) event.expiresAt = new Date(Math.min(time(at) + WINDOW, time(event.schedule.startsAt))).toISOString();
    const next = { ...copy(state), revision: state.revision + 1, events: [...copy(state.events), event] };
    replay(next, at); return next;
  }
  function inspect(state, { viewer, at = clockAt() } = {}) {
    const runtime = replay(state, at), person = state.people.find(item => item.id === viewer);
    if (!person) fail('unknown viewer');
    const appointments = runtime.appointments.map(appointment => {
      const proposal = appointment.proposals.at(-1), completedCount = Object.keys(appointment.completed).length;
      const status = appointment.status === 'confirmed' && completedCount ? 'partially-completed'
        : appointment.status === 'confirmed' && time(proposal.schedule.endsAt) <= time(at) ? 'awaiting-completion' : appointment.status;
      const people = state.people.map(row => ({ ...row, response: proposal.responses[row.id]?.value || 'unanswered',
        respondedAt: proposal.responses[row.id]?.at || null, completedAt: appointment.completed[row.id] || null }));
      const previousProposal = appointment.proposals.at(-2);
      const changes = previousProposal ? ['startsAt', 'endsAt', 'timeZone', 'place', 'note'].filter(field => previousProposal.schedule[field] !== proposal.schedule[field])
        .map(field => ({ field, before: previousProposal.schedule[field], after: proposal.schedule[field] })) : [];
      return { id: appointment.id, status, proposal: { version: proposal.version, proposedBy: proposal.proposedBy, proposedAt: proposal.proposedAt,
        schedule: copy(proposal.schedule), expiresAt: proposal.expiresAt, changes,
        declineMeaning: Object.values(proposal.responses).find(response => response.value === 'decline')?.declineMeaning || null }, people, closedAt: appointment.closedAt, cancelledBy: appointment.cancelledBy,
        history: appointment.proposals.slice(0, -1).map(version => ({ version: version.version, proposedBy: version.proposedBy, proposedAt: version.proposedAt,
          schedule: copy(version.schedule), expiresAt: version.expiresAt, status: version.status, supersededAt: version.supersededAt,
          people: state.people.map(row => ({ ...row, response: version.responses[row.id]?.value || 'unanswered', respondedAt: version.responses[row.id]?.at || null })) })),
        canRespond: appointment.status === 'pending' && !own(proposal.responses, viewer),
        canRevise: runtime.receivingOpen && ['pending', 'confirmed'].includes(appointment.status) && time(proposal.schedule.startsAt) > time(at) && !completedCount,
        canCancel: ['pending', 'confirmed'].includes(appointment.status) && !completedCount,
        canComplete: appointment.status === 'confirmed' && time(proposal.schedule.endsAt) <= time(at) && !own(appointment.completed, viewer),
        canReflect: own(appointment.completed, viewer) };
    });
    const inbox = runtime.inbox.filter(item => item.recipient === viewer).map(({ recipient, ...item }) => ({ ...item,
      read: runtime.reads[viewer].has(item.id), notify: item.notify && runtime.preferences[viewer] })).reverse();
    return { version: VERSION, pairId: state.pairId, revision: state.revision, at: iso(at), people: copy(state.people),
      me: { ...copy(person), notificationsEnabled: runtime.preferences[viewer], reflections: copy(runtime.reflections[viewer]),
        receiving: { ...copy(runtime.receiving[viewer]), canReopen: runtime.receiving[viewer].state !== 'open' },
        suggestions: runtime.suggestions[viewer].filter(item => item.status !== 'invalidated').map(item => ({ ...copy(item),
          canApply: item.kind === 'shorter-duration' && ['pending', 'undone'].includes(item.status), canDismiss: ['pending', 'undone'].includes(item.status),
          canUndo: item.status === 'applied' && runtime.nextForm[viewer]?.suggestionId === item.id })),
        nextForm: copy(runtime.nextForm[viewer]) },
      canPropose: runtime.receivingOpen && !runtime.hasOpenSlot,
      proposalAvailability: { allowed: runtime.receivingOpen && !runtime.hasOpenSlot,
        reason: runtime.receiving[viewer].state !== 'open' ? 'reopen-required' : !runtime.receivingOpen ? 'partner-unavailable' : runtime.hasOpenSlot ? 'appointment-open' : null },
      currentId: appointments.findLast(item => ['pending', 'confirmed', 'awaiting-completion', 'partially-completed'].includes(item.status))?.id || null,
      appointments, inbox, unreadCount: inbox.filter(item => !item.read).length };
  }
  return Object.freeze({ create, record, inspect });
}

export const createAppointmentAdapter = createAppointmentsAdapter;
