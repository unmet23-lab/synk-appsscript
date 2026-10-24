// Messenger requests and company-session recovery. Every dependency is passed
// in, so the transport can be exercised without a page: the session owner
// decides whether a late response still belongs to the current login.

const stopped = () => new Error('로그인이 바뀌어 하던 요청을 멈췄어요.');
const aborted = signal => signal.reason || Object.assign(new Error('취소한 요청이에요.'), { name: 'AbortError' });

// The embedded messenger asks the desktop app's workspace page to refresh the
// company session first. A recovery for another account, another link object
// or another transfer session is refused instead of applied.
export function createCompanySessionRecovery({ state, session, embedded, parent, origin, reconnectEvents }) {
  return function companySessionRecovery() {
    if (!embedded()) return null;
    let host;
    try { host = parent(); if (host.location?.origin !== origin() || typeof host.ensureNativeSynkCompanySession !== 'function') return null; } catch { return null; }
    const owner = state.integrated?.companyUserId, context = state.user ? session.transferContext() : null, initial = state.integrated;
    const recovery = host.ensureNativeSynkCompanySession(); if (!recovery) return null;
    return Promise.resolve(recovery).then(next => {
      if (!next) return;
      if (initial !== state.integrated || context && !session.transferCurrent(context) || owner && owner !== next.companyUserId || typeof next.csrfToken !== 'string') throw stopped();
      if (state.integrated) { const changed = state.integrated.csrfToken !== next.csrfToken; state.integrated.csrfToken = next.csrfToken; if (changed && state.events) reconnectEvents(); }
    });
  };
}

export function createApiClient({ state, session, fetch, moduleUrl, sessionRecovery, companyHosted, abortController, setTimer, clearTimer, onCompanyLoginExpired, onLoginExpired }) {
  return async function api(path, options = {}) {
    const recovery = sessionRecovery(); if (recovery) await recovery;
    if (options.signal?.aborted) throw aborted(options.signal);
    const identity = session.identity();
    const opts = { ...options, credentials: 'same-origin', headers: { ...options.headers } };
    const recoveryContext = opts.recoveryContext; delete opts.recoveryContext;
    if (options.body !== undefined && typeof options.body !== 'string') { opts.body = JSON.stringify(options.body); opts.headers['Content-Type'] = 'application/json'; }
    if (state.integrated?.csrfToken && opts.method && opts.method !== 'GET') opts.headers['X-CSRF-Token'] = state.integrated.csrfToken;
    const controller = recoveryContext ? abortController() : null;
    if (controller) opts.signal = controller.signal; const timeout = controller ? setTimer(() => controller.abort(), 30000) : null;
    let response, data;
    try { response = await fetch(moduleUrl(path), opts); data = await response.json().catch(() => ({})); } finally { if (controller) clearTimer(timeout); }
    if (opts.signal?.aborted) throw aborted(opts.signal);
    if (!session.identityCurrent(identity)) throw stopped();
    if (recoveryContext && !session.transferCurrent(recoveryContext)) throw stopped();
    if (!response.ok) {
      if (response.status === 401 && companyHosted()) { onCompanyLoginExpired(); throw new Error('회사 계정으로 다시 로그인해 주세요.'); }
      if (response.status === 401 && state.user) onLoginExpired();
      const error = new Error(data.error || `요청을 처리하지 못했어요. (${response.status})`); error.status = response.status; error.code = data.code; throw error;
    }
    return data;
  };
}

// The SSE bootstrap refresh: same-login updates keep pending reads valid; a
// different messenger user in the reply is ignored; changed write permission
// redraws the composer and the open detail views.
export function createBootstrapRefresh({ state, session, personal, api, canWrite, setNotificationStatus, updateStorage, applyPermissions, refreshDetails }) {
  return async function refreshBootstrap() {
    const ticket = personal.ticket({ revise: true }), data = await api('/api/bootstrap');
    if (!personal.sameAccount(ticket) || (data.user && data.user.id !== ticket.userId)) return;
    const previousWrite = canWrite(), previousScheduler = state.scheduledNotifications.enabled;
    session.adoptBootstrap(data);
    if (personal.revisionCurrent(ticket)) setNotificationStatus(data.scheduledNotifications?.enabled);
    if (data.storage) updateStorage(data.storage.provider);
    const permissionsChanged = previousWrite !== canWrite();
    if (permissionsChanged) applyPermissions();
    if (permissionsChanged || previousScheduler !== state.scheduledNotifications.enabled) await refreshDetails();
  };
}

export const SynkMessengerSession = Object.freeze({ createCompanySessionRecovery, createApiClient, createBootstrapRefresh });
// Exposed for app.js, which tests also evaluate as a classic script.
if (typeof window !== 'undefined') window.SynkMessengerSession = SynkMessengerSession;
