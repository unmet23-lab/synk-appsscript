// Messenger screen state and its owners. One state object is shared by the
// renderer, but every field belongs to exactly one owner: the session (login,
// company link, transfers), the conversation (rooms, messages, navigation,
// composing) or the personal panel (my work, notifications). Owners hold the
// initial values, the resets and the late-response checks; none reads the DOM.

const DEFAULT_FILE_BYTES = 104857600;
const categoryFilters = () => ({ personal: 'all', team: 'all', all: 'all' });

export const sessionFields = () => ({ user: null, workspace: { name: 'SYNK' }, storage: { provider: 'local' }, integrated: null, needsSetup: false, fileBytes: DEFAULT_FILE_BYTES, events: null, connected: false });
export const transferFields = () => ({ queues: new Map(), sending: false, transferSession: 0, sendAttempts: new Map(), transferFocusRevision: 0 });
export const conversationFields = () => ({
  channels: [], members: [], teams: [], channelId: null, messages: [], hasMore: false, mode: 'chat', drawer: null,
  loadSeq: 0, searchSeq: 0, refreshSeq: 0, channelsSeq: 0, navigationSeq: 0, threadSeq: 0, pinsSeq: 0, filesSeq: 0,
  navFilter: 'all', roomQuery: '', chatCategory: 'personal', categoryFilters: categoryFilters(), categoryChannels: {},
  replyTarget: null, thread: null, pins: [], fileQuery: '', fileType: 'all', fileScope: 'channel', fileOffset: 0, sharedFiles: [],
  directoryQuery: '', directoryTeam: 'all', searchMessages: [], searchOffset: 0,
  unavailableChannels: new Set(), deletingChannels: new Set(), leavingChannels: new Set(), restoringChannels: new Set(),
});
export const composeFields = () => ({ mentionIds: [], workspaceLink: null, ackRequired: false, mentionPicker: null, shareSeq: 0 });
export const personalFields = () => ({
  personalTab: 'workday', savedView: 'saved', taskFilter: 'all', taskScope: 'mine', personalSeq: 0, personalItems: [], notificationCount: 0,
  decisionQuery: '', decisionCurrent: true, decisionKind: 'all', customerWork: [], catchUp: null,
  scheduledNotifications: { enabled: null }, workNotificationSession: 0, workNotificationRevision: 0, deadlineSettings: undefined, deadlineSettingsUser: null,
  publicationWork: [], workdaySnapshot: null, workdayBody: null, workdayCount: null,
});
export const STATE_OWNERS = Object.freeze({ session: sessionFields, transfer: transferFields, conversation: conversationFields, compose: composeFields, personal: personalFields });

export function createMessengerState() {
  return Object.assign({}, ...Object.values(STATE_OWNERS).map(fields => fields()));
}

// Entering a workspace replaces the session and the conversation for the new
// login. View settings that are not listed (file filters, search pages,
// personal tabs) keep their values, as they always did.
export function enterWorkspaceState(state, data) {
  Object.assign(state, {
    platformUrl: data.platformUrl || null, user: data.user, workspace: data.workspace, storage: data.storage || { provider: 'local' }, integrated: data.integrated || null,
    fileBytes: data.limits?.fileBytes || DEFAULT_FILE_BYTES, needsSetup: false,
    sendRecovery: { messages: data.sendRecovery?.messages === true, uploads: data.sendRecovery?.uploads === true },
    channels: data.channels, members: data.members, teams: data.teams || [], channelId: null, mode: 'chat', messages: [], drawer: null,
    navFilter: 'all', roomQuery: '', replyTarget: null, thread: null, pins: [], sharedFiles: [], directoryQuery: '', directoryTeam: 'all',
    chatCategory: 'personal', categoryFilters: categoryFilters(), categoryChannels: {}, navigationSeq: state.navigationSeq + 1,
    unavailableChannels: new Set(), deletingChannels: new Set(), leavingChannels: new Set(), restoringChannels: new Set(),
  });
}

// Login identity, company session and the transfer session that uploads and
// sends are bound to. A request captured under one identity is stale once the
// messenger user, the company link object or its CSRF token changes.
export function createSessionOwner(state) {
  const identity = () => ({ userId: state.user?.id, integrated: state.integrated, csrf: state.integrated?.csrfToken, session: state.transferSession });
  const identityCurrent = snapshot => snapshot.userId === state.user?.id && snapshot.integrated === state.integrated && snapshot.csrf === state.integrated?.csrfToken && snapshot.session === state.transferSession;
  const transferContext = () => ({ userId: state.user?.id, session: state.transferSession });
  const transferCurrent = context => Boolean(context.userId && context.userId === state.user?.id && context.session === state.transferSession);
  function resetTransfers() {
    state.transferSession++; state.sending = false; state.sendAttempts.clear();
    for (const uploads of state.queues.values()) for (const upload of uploads) { upload.cancelled = true; upload.rawFile = null; upload.xhr?.abort(); }
    state.queues.clear();
  }
  // The messenger's own login expired (401): stop live updates and uploads.
  function expire() {
    state.events?.close(); state.user = null;
    state.queues.forEach(queue => queue.forEach(upload => upload.xhr?.abort())); state.queues.clear();
  }
  // Leaving for the company login: transfers end with the session.
  function leave() { resetTransfers(); state.events?.close(); state.user = null; }
  // A refreshed bootstrap for the same company account and CSRF updates the
  // link in place so pending reads stay valid; a different account or token
  // replaces it so they are rejected.
  function adoptBootstrap(data) {
    if (data.integrated) {
      if (state.integrated && state.integrated.companyUserId === data.integrated.companyUserId && state.integrated.csrfToken === data.integrated.csrfToken) Object.assign(state.integrated, data.integrated);
      else state.integrated = data.integrated;
    }
    if (data.user) state.user = data.user;
  }
  return Object.freeze({ identity, identityCurrent, transferContext, transferCurrent, resetTransfers, expire, leave, adoptBootstrap });
}

// Unconfirmed message sends, persisted per user and room so a reload can ask
// the server whether the message arrived instead of sending it twice.
export function createSendAttemptStore(state, { storage, transferCurrent }) {
  const key = (channelId, userId = state.user?.id) => `synk-messenger:send:${userId}:${channelId}`;
  function get(channelId = state.channelId) {
    if (!channelId || !state.user || state.unavailableChannels.has(channelId)) return null;
    const name = key(channelId); if (state.sendAttempts.has(name)) return state.sendAttempts.get(name);
    let attempt = null;
    try {
      const saved = JSON.parse(storage.getItem(name) || 'null');
      if (saved?.userId === state.user.id && saved.channelId === channelId && typeof saved.clientMessageId === 'string' && /^[0-9a-f-]{36}$/i.test(saved.clientMessageId) && typeof saved.payload?.body === 'string' && Array.isArray(saved.payload.fileIds)) attempt = { ...saved, busy: false, status: 'unknown' };
    } catch {}
    state.sendAttempts.set(name, attempt); return attempt;
  }
  function persist(attempt) {
    const { busy, status, ...saved } = attempt;
    try { storage.setItem(key(attempt.channelId, attempt.userId), JSON.stringify(saved)); return true; }
    catch { return false; }
  }
  function remember(attempt) { state.sendAttempts.set(key(attempt.channelId), attempt); }
  function forget(attempt) {
    const name = key(attempt.channelId, attempt.userId);
    if (state.sendAttempts.get(name) === attempt) state.sendAttempts.set(name, null);
    try { const saved = JSON.parse(storage.getItem(name) || 'null'); if (saved?.clientMessageId === attempt.clientMessageId) storage.removeItem(name); } catch {}
  }
  const current = (attempt, context) => transferCurrent(context) && !state.unavailableChannels.has(attempt.channelId) && state.sendAttempts.get(key(attempt.channelId, attempt.userId)) === attempt;
  return Object.freeze({ key, get, persist, remember, forget, current });
}

// My-work panel state: work notification status, the per-login session that
// panel reads are bound to, and the background workday refresh timer.
export function createPersonalPanelOwner(state, { cancelRefresh, setNotificationStatus, showReminderStatus, setTimer, clearTimer }) {
  let timer = null, timerVersion = 0;
  function applyNotificationStatus(enabled, { invalidatePending = false } = {}) {
    if (invalidatePending) state.workNotificationRevision++;
    state.scheduledNotifications = { enabled: typeof enabled === 'boolean' ? enabled : null };
    showReminderStatus();
  }
  function reset() {
    cancelRefresh(); state.personalSeq++; state.workNotificationSession++;
    setNotificationStatus(null, { invalidatePending: true });
    Object.assign(state, { deadlineSettings: undefined, deadlineSettingsUser: null, publicationWork: [], customerWork: [], clientRechecks: {}, clientRecheckToday: null, customerGroupIdentity: null, workdaySnapshot: null, workdayBody: null, workdayCount: null });
  }
  // A ticket names the login and panel session a read started under; revise
  // also claims the notification status so an older read cannot overwrite it.
  const ticket = ({ revise = false } = {}) => ({ userId: state.user?.id, session: state.workNotificationSession, revision: revise ? ++state.workNotificationRevision : state.workNotificationRevision });
  const sameAccount = value => Boolean(value.userId) && value.userId === state.user?.id && value.session === state.workNotificationSession;
  const revisionCurrent = value => value.revision === state.workNotificationRevision;
  const matches = value => value.userId === state.user?.id && value.session === state.workNotificationSession && revisionCurrent(value);
  const current = value => sameAccount(value) && revisionCurrent(value);
  function stopRefresh() { clearTimer(timer); timer = null; timerVersion++; }
  function startRefresh(delay, run) {
    const version = timerVersion, userId = state.user.id, session = state.workNotificationSession;
    timer = setTimer(() => {
      if (version !== timerVersion || userId !== state.user?.id || session !== state.workNotificationSession) return;
      timer = null; run();
    }, delay);
  }
  return Object.freeze({ applyNotificationStatus, reset, ticket, sameAccount, revisionCurrent, matches, current, stopRefresh, startRefresh });
}

export const SynkMessengerState = Object.freeze({ STATE_OWNERS, createMessengerState, enterWorkspaceState, createSessionOwner, createSendAttemptStore, createPersonalPanelOwner });
// Exposed for app.js, which tests also evaluate as a classic script.
if (typeof window !== 'undefined') window.SynkMessengerState = SynkMessengerState;
