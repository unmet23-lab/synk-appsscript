// Same-origin product client only. Authentication, spending authorization,
// provider calls and idempotency belong to the existing company host.
export function createComputerModelHost({ disabled = false, fetchImpl = globalThis.fetch?.bind(globalThis), uuid = () => globalThis.crypto.randomUUID(), timeoutMs = 45000 } = {}) {
  let csrfToken = null;
  let connection = { available: false, state: disabled ? 'disabled' : 'idle', reason: disabled ? 'share-disabled' : 'not-checked' };
  let privacy = { canDelete: false, state: disabled ? 'disabled' : 'idle', reason: disabled ? 'share-disabled' : 'not-checked' }, privacyRevision = 0;
  const copy = value => JSON.parse(JSON.stringify(value));
  const failure = (code, message) => Object.assign(new Error(message), { code });
  const label = value => typeof value === 'string' && value.trim() && value.length <= 100;
  async function json(url, options = {}) {
    const response = await fetchImpl(url, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', ...options });
    if (!response.ok) throw failure(response.status === 401 || response.status === 403 ? 'session-required' : response.status === 404 ? 'host-unavailable' : response.status === 410 ? 'response-removed' : 'host-error', `Host request failed (${response.status})`);
    const raw = await response.text();
    if (raw.length > 1024 * 1024) throw failure('invalid-response', 'Host response too large');
    try { return JSON.parse(raw); } catch { throw failure('invalid-response', 'Invalid host JSON'); }
  }
  function privacyResult(result, deletion = false) {
    const count = value => Number.isSafeInteger(value) && value >= 0;
    if (result?.retentionHours !== 24 || result.canDelete !== true || !count(result.storedResponses) || !count(result.pendingResponses)
      || !(result.nextExpiryAt === null || typeof result.nextExpiryAt === 'string' && result.nextExpiryAt.length <= 40 && Number.isFinite(Date.parse(result.nextExpiryAt)))
      || deletion && (!count(result.deletedResponses) || !count(result.cancelledPendingResponses))) throw failure('invalid-response', 'Invalid privacy response');
    return { state: 'available', canDelete: true, retentionHours: result.retentionHours, storedResponses: result.storedResponses,
      pendingResponses: result.pendingResponses, nextExpiryAt: result.nextExpiryAt,
      ...(deletion ? { deletedResponses: result.deletedResponses, cancelledPendingResponses: result.cancelledPendingResponses } : {}) };
  }
  function forgetSession() {
    csrfToken = null; connection = { ...connection, available: false, state: 'unavailable', reason: 'session-required' };
    privacy = { canDelete: false, state: 'unavailable', reason: 'session-required' };
  }
  async function refreshPrivacy() {
    if (disabled) return copy(privacy);
    if (!csrfToken) { privacy = { canDelete: false, state: 'unavailable', reason: 'session-required' }; return copy(privacy); }
    const revision = ++privacyRevision, controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 10000));
    try {
      const result = privacyResult(await json('/api/computer-interpretation/privacy', { signal: controller.signal }));
      if (revision === privacyRevision) privacy = result;
    } catch (error) {
      if (revision === privacyRevision) {
        if (error.code === 'session-required') forgetSession();
        else privacy = { canDelete: false, state: 'unavailable', reason: error.code || 'host-unavailable' };
      }
    } finally { clearTimeout(timer); }
    return copy(privacy);
  }
  async function deleteResponses() {
    if (disabled || !csrfToken || !privacy.canDelete) throw failure('session-required', 'Authenticated privacy access required');
    ++privacyRevision;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 10000));
    try {
      // Account scope comes only from the host session. No user ID or request ID is sent.
      const result = privacyResult(await json('/api/computer-interpretation/delete', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: '{}' }), true);
      privacy = result; return copy(result);
    } catch (error) { if (error.code === 'session-required') forgetSession(); throw error; }
    finally { clearTimeout(timer); }
  }
  async function connect() {
    if (disabled) return copy(connection);
    csrfToken = null; connection = { available: false, state: 'checking', reason: 'checking' };
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 10000));
    try {
      const status = await json('/api/computer-interpretation', { signal: controller.signal });
      if (typeof status?.available !== 'boolean') throw failure('invalid-response', 'Invalid host status');
      const session = await json('/api/me', { signal: controller.signal });
      const authenticated = !!session?.user && typeof session.csrfToken === 'string' && !!session.csrfToken && session.csrfToken.length <= 512;
      if (authenticated) csrfToken = session.csrfToken;
      if (status?.available !== true) {
        connection = { available: false, state: 'unavailable', hostDetected: true, reason: typeof status?.reason === 'string' && status.reason.length <= 100 ? status.reason : 'host-unavailable' };
      } else {
        if (!authenticated) throw failure('session-required', 'Authenticated host session required');
        if (!label(status.providerLabel) || !label(status.modelLabel)) throw failure('invalid-response', 'Host identity unavailable');
        csrfToken = session.csrfToken;
        connection = { available: true, state: 'available', hostDetected: true, providerLabel: status.providerLabel, modelLabel: status.modelLabel };
      }
    } catch (error) { connection = { available: false, state: 'unavailable', reason: controller.signal.aborted ? 'connection-timeout' : error.code || 'host-unavailable' }; }
    finally { clearTimeout(timer); }
    if (connection.hostDetected) await refreshPrivacy();
    else privacy = { canDelete: false, state: 'unavailable', reason: connection.reason };
    return copy(connection);
  }
  function prepare(request) {
    if (disabled || !connection.available || !csrfToken) throw failure('host-unavailable', 'AI host is not connected');
    const source = request?.sources?.[0];
    if (!request || typeof request.id !== 'string' || !Number.isInteger(request.revision) || request.sources.length !== 1
      || typeof source?.id !== 'string' || typeof source.text !== 'string' || !source.text.trim() || source.text.length > 4000) throw failure('invalid-request', 'Invalid source request');
    return { id: uuid(), requestId: request.id, revision: request.revision, sourceId: source.id, text: source.text };
  }
  async function extract(packet, { signal } = {}) {
    if (disabled || !connection.available || !csrfToken) throw failure('host-unavailable', 'AI host is not connected');
    if (!packet || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packet.id)
      || typeof packet.requestId !== 'string' || !Number.isInteger(packet.revision) || typeof packet.sourceId !== 'string'
      || typeof packet.text !== 'string' || !packet.text.trim() || packet.text.length > 4000) throw failure('invalid-request', 'Invalid host request');
    const controller = new AbortController(), abort = () => controller.abort();
    if (signal?.aborted) throw failure('cancelled', 'Cancelled before sending');
    signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      // Explicitly select the wire fields: never send catalog, reviews, user
      // identity, declarations or a browser-supplied system instruction.
      const { id, requestId, revision, sourceId, text } = packet;
      const response = await json('/api/computer-interpretation', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ id, requestId, revision, sourceId, text }) });
      if (controller.signal.aborted) throw failure(timedOut ? 'timeout' : 'cancelled', 'Response no longer wanted');
      if (response?.requestId !== requestId || response?.revision !== revision || !Array.isArray(response.proposals) || !Array.isArray(response.held)
        || typeof response.extractor !== 'string') throw failure('invalid-response', 'Host response does not match request');
      return response;
    } catch (error) {
      if (controller.signal.aborted) throw failure(timedOut ? 'timeout' : 'cancelled', 'Host request stopped');
      if (error.code === 'session-required') forgetSession();
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  return Object.freeze({ connect, prepare, extract, refreshPrivacy, deleteResponses, state: () => copy(connection), privacyState: () => copy(privacy) });
}
