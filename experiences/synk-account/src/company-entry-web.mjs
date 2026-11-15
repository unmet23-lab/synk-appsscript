export const COMPANY_ENTRY_URL = 'https://workspace.synk.im/entry/';
export const COMPANY_DESTINATIONS_URL = 'https://workspace.synk.im/api/customer/entry/destinations';
export const COMPANY_ENTRY_ORIGIN = 'https://workspace.synk.im';
export const COMPANY_ENTRY_CHANNEL = 'synk.company.entry';
export const COMPANY_ENTRY_VERSION = 1;

const FETCH_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 65_536;
const STEP_TIMEOUT_MS = 15_000;
const TOTAL_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 250;

const UTF8_ENCODER = typeof TextEncoder === 'function' ? new TextEncoder() : null;
const UTF8_DECODER = typeof TextDecoder === 'function' ? new TextDecoder('utf-8') : null;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

const ALLOWED_DESTINATIONS = new Set(['/', '/pulse-app/']);
const ALLOWED_UNAVAILABLE_TARGETS = new Set(['workspace', 'pulse']);
const ALLOWED_DOCUMENT_ROLES = new Set(['receiver', 'employee', 'customer']);
const ALLOWED_PHASES = new Set(['classify', 'deliver', 'resolve']);
const ALLOWED_KINDS = new Set(['employee', 'customer']);
const ALLOWED_ASSIGNMENT_STATUSES = new Set([
  'resolved',
  'partial',
  'login_required',
  'account_mismatch',
  'unavailable',
]);
const ALLOWED_HTTP_WORKSPACE_STATES = new Set(['assigned', 'unassigned']);
const ALLOWED_HTTP_PULSE_STATES = new Set(['assigned', 'unassigned', 'unavailable']);

const WIRE_ERROR_CODES = Object.freeze([
  'INVALID_INPUT',
  'INVITE_REJECTED',
  'LOGIN_REQUIRED',
  'CLIENT_FORBIDDEN',
  'TEMPORARY_UNAVAILABLE',
  'RATE_LIMITED',
  'ACCOUNT_CHANGED',
  'ACCOUNT_MISMATCH',
  'BUSY',
  'CANCELLED',
  'HANDOFF_TIMEOUT',
  'HANDOFF_UNAVAILABLE',
]);

export const COMPANY_ENTRY_ERROR_CODES = Object.freeze([
  ...WIRE_ERROR_CODES,
  'HANDOFF_UNCONFIRMED',
]);

const ALLOWED_ERROR_CODE_SET = new Set(WIRE_ERROR_CODES);

const PROVEN_DELIVER_NON_RECEIPT_ERROR_CODES = new Set([
  'INVALID_INPUT',
  'INVITE_REJECTED',
  'LOGIN_REQUIRED',
  'CLIENT_FORBIDDEN',
  'TEMPORARY_UNAVAILABLE',
  'RATE_LIMITED',
  'ACCOUNT_CHANGED',
  'ACCOUNT_MISMATCH',
  'BUSY',
  'CANCELLED',
  'HANDOFF_UNAVAILABLE',
]);

const KEYS_HTTP_SUCCESS = Object.freeze(['version', 'accountMatch', 'workspace', 'pulse']);
const KEYS_HTTP_TARGET = Object.freeze(['state', 'destination']);
const KEYS_HTTP_ERROR_WRAPPER = Object.freeze(['error']);
const KEYS_HTTP_ERROR_BODY = Object.freeze(['code', 'retryable']);

const KEYS_READY = Object.freeze(['channel', 'version', 'type', 'documentId', 'documentRole']);
const KEYS_BOUND = Object.freeze([
  'channel',
  'version',
  'type',
  'requestId',
  'accountGeneration',
  'documentId',
  'phase',
]);
const KEYS_CLASSIFIED = Object.freeze([
  'channel',
  'version',
  'type',
  'requestId',
  'accountGeneration',
  'documentId',
  'kind',
  'destination',
]);
const KEYS_RECEIVED = Object.freeze([
  'channel',
  'version',
  'type',
  'requestId',
  'accountGeneration',
  'documentId',
  'kind',
  'destination',
  'state',
]);
const KEYS_ASSIGNMENT = Object.freeze([
  'channel',
  'version',
  'type',
  'requestId',
  'accountGeneration',
  'documentId',
  'result',
]);
const KEYS_ASSIGNMENT_RESULT = Object.freeze(['status', 'destinations', 'unavailable']);
const KEYS_ERROR = Object.freeze([
  'channel',
  'version',
  'type',
  'requestId',
  'accountGeneration',
  'documentId',
  'code',
  'retryable',
]);

function isPlainObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasExactKeys(obj, expectedKeys) {
  if (!isPlainObject(obj)) {
    return false;
  }
  if (Reflect.ownKeys(obj).length !== expectedKeys.length) {
    return false;
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return false;
    }
  }
  return true;
}

function parseDestinationsHttpSuccess(data) {
  if (
    !hasExactKeys(data, KEYS_HTTP_SUCCESS) ||
    data.version !== COMPANY_ENTRY_VERSION ||
    data.accountMatch !== true
  ) {
    return null;
  }
  const { workspace, pulse } = data;
  if (
    !hasExactKeys(workspace, KEYS_HTTP_TARGET) ||
    workspace.destination !== '/' ||
    !ALLOWED_HTTP_WORKSPACE_STATES.has(workspace.state)
  ) {
    return null;
  }
  if (
    !hasExactKeys(pulse, KEYS_HTTP_TARGET) ||
    pulse.destination !== '/pulse-app/' ||
    !ALLOWED_HTTP_PULSE_STATES.has(pulse.state)
  ) {
    return null;
  }

  const destinations = [];
  if (workspace.state === 'assigned') {
    destinations.push('/');
  }
  if (pulse.state === 'assigned') {
    destinations.push('/pulse-app/');
  }
  const unavailable = pulse.state === 'unavailable' ? ['pulse'] : [];
  return {
    status: unavailable.length > 0 ? 'partial' : 'resolved',
    destinations,
    unavailable,
  };
}

function parseDestinationsHttpError(status, data) {
  const defaultRetryable = status === 429 || status >= 500;
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    return { code: 'TEMPORARY_UNAVAILABLE', retryable: false };
  }
  if (
    !hasExactKeys(data, KEYS_HTTP_ERROR_WRAPPER) ||
    !hasExactKeys(data.error, KEYS_HTTP_ERROR_BODY)
  ) {
    return { code: 'TEMPORARY_UNAVAILABLE', retryable: defaultRetryable };
  }
  const { code, retryable } = data.error;
  if (typeof code !== 'string' || typeof retryable !== 'boolean') {
    return { code: 'TEMPORARY_UNAVAILABLE', retryable: defaultRetryable };
  }

  switch (code) {
    case 'LOGIN_REQUIRED':
    case 'AUTH_REQUIRED':
    case 'ACCOUNT_UNAVAILABLE':
      if (status === 401 || status === 403) {
        return { code: 'LOGIN_REQUIRED', retryable: false };
      }
      break;
    case 'ACCOUNT_MISMATCH':
      if (status === 409 || status === 403) {
        return { code: 'ACCOUNT_MISMATCH', retryable: false };
      }
      break;
    case 'INVALID_INPUT':
      if (status === 400) {
        return { code: 'INVALID_INPUT', retryable: false };
      }
      break;
    case 'CLIENT_FORBIDDEN':
    case 'ORIGIN_FORBIDDEN':
      if (status === 403) {
        return { code: 'CLIENT_FORBIDDEN', retryable: false };
      }
      break;
    case 'RATE_LIMITED':
      if (status === 429) {
        return { code: 'RATE_LIMITED', retryable: true };
      }
      break;
    case 'TEMPORARY_UNAVAILABLE':
      if (status >= 500) {
        return { code: 'TEMPORARY_UNAVAILABLE', retryable };
      }
      break;
    default:
      break;
  }

  return { code: 'TEMPORARY_UNAVAILABLE', retryable: defaultRetryable };
}

async function readBoundedResponseText(response, maxBytes) {
  if (response.headers && typeof response.headers.get === 'function') {
    const rawLength = response.headers.get('content-length');
    if (typeof rawLength === 'string' && rawLength.trim() !== '') {
      const declaredLength = Number(rawLength);
      if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > maxBytes) {
        if (response.body && typeof response.body.cancel === 'function') {
          void Promise.resolve(response.body.cancel()).catch(() => {});
        }
        throw new Error('RESPONSE_TOO_LARGE');
      }
    }
  }

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value === undefined || value === null) {
          continue;
        }
        let bytes;
        if (value instanceof Uint8Array) {
          bytes = value;
        } else if (ArrayBuffer.isView(value)) {
          bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        } else if (value instanceof ArrayBuffer) {
          bytes = new Uint8Array(value);
        } else if (typeof value === 'string' && UTF8_ENCODER) {
          bytes = UTF8_ENCODER.encode(value);
        } else {
          throw new Error('INVALID_BODY_CHUNK');
        }
        totalBytes += bytes.byteLength;
        if (totalBytes > maxBytes) {
          await Promise.resolve(reader.cancel()).catch(() => {});
          throw new Error('RESPONSE_TOO_LARGE');
        }
        chunks.push(bytes);
      }
    } finally {
      try {
        reader.releaseLock?.();
      } catch {
        // Ignore reader lock release errors during teardown.
      }
    }

    if (chunks.length === 0) {
      return '';
    }
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (!UTF8_DECODER) {
      throw new Error('TEXT_DECODER_UNAVAILABLE');
    }
    return UTF8_DECODER.decode(merged);
  }

  if (typeof response.text === 'function') {
    const text = await response.text();
    if (typeof text !== 'string') {
      throw new Error('INVALID_BODY_TEXT');
    }
    const byteLength = UTF8_ENCODER ? UTF8_ENCODER.encode(text).byteLength : text.length;
    if (byteLength > maxBytes) {
      throw new Error('RESPONSE_TOO_LARGE');
    }
    return text;
  }

  if (typeof response.json === 'function') {
    const parsed = await response.json();
    const serialized = JSON.stringify(parsed);
    if (typeof serialized !== 'string') {
      throw new Error('INVALID_BODY_JSON');
    }
    const byteLength = UTF8_ENCODER
      ? UTF8_ENCODER.encode(serialized).byteLength
      : serialized.length;
    if (byteLength > maxBytes) {
      throw new Error('RESPONSE_TOO_LARGE');
    }
    return serialized;
  }

  if (response.body === null || response.body === undefined) {
    return '';
  }

  throw new Error('UNSUPPORTED_RESPONSE_BODY');
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isValidKindDestinationPair(kind, destination) {
  return (
    (kind === 'employee' && destination === '/') ||
    (kind === 'customer' && destination === '/pulse-app/')
  );
}

function isUniqueAllowedStringArray(value, allowedSet) {
  if (!Array.isArray(value)) {
    return false;
  }
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || !allowedSet.has(item) || seen.has(item)) {
      return false;
    }
    seen.add(item);
  }
  return true;
}

function isAbortSignalLike(signal) {
  return (
    typeof signal === 'object' &&
    signal !== null &&
    typeof signal.aborted === 'boolean' &&
    typeof signal.addEventListener === 'function' &&
    typeof signal.removeEventListener === 'function'
  );
}

function makeErrorResult(code, retryable) {
  return {
    ok: false,
    code,
    retryable: Boolean(retryable),
  };
}

function resolvePositiveMs(candidate, fallback) {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
    ? candidate
    : fallback;
}

function unrefTimerHandle(handle) {
  if (handle && typeof handle === 'object' && typeof handle.unref === 'function') {
    handle.unref();
  }
  return handle;
}

function parseIncomingMessage(data) {
  if (!isPlainObject(data)) {
    return null;
  }
  if (data.channel !== COMPANY_ENTRY_CHANNEL || data.version !== COMPANY_ENTRY_VERSION) {
    return null;
  }
  if (typeof data.type !== 'string') {
    return null;
  }

  switch (data.type) {
    case 'ready': {
      if (!hasExactKeys(data, KEYS_READY)) {
        return null;
      }
      if (!isUuid(data.documentId) || !ALLOWED_DOCUMENT_ROLES.has(data.documentRole)) {
        return null;
      }
      return data;
    }

    case 'bound': {
      if (!hasExactKeys(data, KEYS_BOUND)) {
        return null;
      }
      if (
        !isUuid(data.requestId) ||
        !isUuid(data.accountGeneration) ||
        !isUuid(data.documentId) ||
        !ALLOWED_PHASES.has(data.phase)
      ) {
        return null;
      }
      return data;
    }

    case 'classified': {
      if (!hasExactKeys(data, KEYS_CLASSIFIED)) {
        return null;
      }
      if (
        !isUuid(data.requestId) ||
        !isUuid(data.accountGeneration) ||
        !isUuid(data.documentId) ||
        !ALLOWED_KINDS.has(data.kind) ||
        !ALLOWED_DESTINATIONS.has(data.destination) ||
        !isValidKindDestinationPair(data.kind, data.destination)
      ) {
        return null;
      }
      return data;
    }

    case 'received': {
      if (!hasExactKeys(data, KEYS_RECEIVED)) {
        return null;
      }
      if (
        !isUuid(data.requestId) ||
        !isUuid(data.accountGeneration) ||
        !isUuid(data.documentId) ||
        !ALLOWED_KINDS.has(data.kind) ||
        !ALLOWED_DESTINATIONS.has(data.destination) ||
        !isValidKindDestinationPair(data.kind, data.destination) ||
        data.state !== 'queued'
      ) {
        return null;
      }
      return data;
    }

    case 'assignment': {
      if (!hasExactKeys(data, KEYS_ASSIGNMENT)) {
        return null;
      }
      if (
        !isUuid(data.requestId) ||
        !isUuid(data.accountGeneration) ||
        !isUuid(data.documentId) ||
        !hasExactKeys(data.result, KEYS_ASSIGNMENT_RESULT)
      ) {
        return null;
      }
      const { status, destinations, unavailable } = data.result;
      if (
        !ALLOWED_ASSIGNMENT_STATUSES.has(status) ||
        !isUniqueAllowedStringArray(destinations, ALLOWED_DESTINATIONS) ||
        !isUniqueAllowedStringArray(unavailable, ALLOWED_UNAVAILABLE_TARGETS)
      ) {
        return null;
      }
      if (status === 'resolved' && unavailable.length > 0) {
        return null;
      }
      return data;
    }

    case 'error': {
      if (!hasExactKeys(data, KEYS_ERROR)) {
        return null;
      }
      if (
        !isUuid(data.requestId) ||
        !isUuid(data.accountGeneration) ||
        !isUuid(data.documentId) ||
        !ALLOWED_ERROR_CODE_SET.has(data.code) ||
        typeof data.retryable !== 'boolean'
      ) {
        return null;
      }
      return data;
    }

    default:
      return null;
  }
}

export function createCompanyEntryTransport(options = {}) {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('options must be an object');
  }
  const { getBinding } = options;
  if (typeof getBinding !== 'function') {
    throw new TypeError('getBinding must be a function');
  }

  const fetchTimeoutMs = resolvePositiveMs(options.fetchTimeoutMs, FETCH_TIMEOUT_MS);
  const stepTimeoutMs = resolvePositiveMs(options.stepTimeoutMs, STEP_TIMEOUT_MS);
  const totalTimeoutMs = resolvePositiveMs(options.totalTimeoutMs, TOTAL_TIMEOUT_MS);
  const pollIntervalMs = resolvePositiveMs(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS);

  const transportUpdateHandler =
    typeof options.onAssignmentUpdate === 'function'
      ? options.onAssignmentUpdate
      : typeof options.onStateChange === 'function'
        ? options.onStateChange
        : typeof options.onUpdate === 'function'
          ? options.onUpdate
          : null;

  let activeSession = null;
  let verifiedResolution = null;
  let disposed = false;
  const pastRequestIds = new Set();
  const pastDocumentIds = new Set();

  function getWindowTarget() {
    if (options.windowRef !== undefined) {
      return options.windowRef;
    }
    if (options.window !== undefined) {
      return options.window;
    }
    if (typeof globalThis.window !== 'undefined') {
      return globalThis.window;
    }
    return null;
  }

  function resolveFetch(win) {
    if (options.fetch === null) {
      return null;
    }
    if (typeof options.fetch === 'function') {
      return (url, init) => options.fetch(url, init);
    }
    if (win && win.fetch === null) {
      return null;
    }
    if (win && typeof win.fetch === 'function') {
      return (url, init) => win.fetch(url, init);
    }
    if (typeof globalThis.fetch === 'function') {
      return (url, init) => globalThis.fetch(url, init);
    }
    return null;
  }

  function resolveLocation(win) {
    if (options.locationRef !== undefined) {
      return options.locationRef;
    }
    if (options.location !== undefined) {
      return options.location;
    }
    return win?.location ?? null;
  }

  function createRequestId(win) {
    if (typeof options.randomUUID === 'function') {
      const id = options.randomUUID();
      return isUuid(id) ? id : null;
    }
    const cryptoTarget =
      options.cryptoRef ?? options.crypto ?? win?.crypto ?? globalThis.crypto ?? null;
    if (!cryptoTarget || typeof cryptoTarget.randomUUID !== 'function') {
      return null;
    }
    try {
      const id = cryptoTarget.randomUUID();
      return isUuid(id) ? id : null;
    } catch {
      return null;
    }
  }

  function resolveTimers(win) {
    const timerBag = options.timers ?? options.timer ?? null;

    const setTimeoutFn =
      options.setTimeout ??
      (timerBag && typeof timerBag.setTimeout === 'function'
        ? (fn, ms) => timerBag.setTimeout(fn, ms)
        : null) ??
      (win && typeof win.setTimeout === 'function' ? (fn, ms) => win.setTimeout(fn, ms) : null) ??
      ((fn, ms) => globalThis.setTimeout(fn, ms));

    const clearTimeoutFn =
      options.clearTimeout ??
      (timerBag && typeof timerBag.clearTimeout === 'function'
        ? (id) => timerBag.clearTimeout(id)
        : null) ??
      (win && typeof win.clearTimeout === 'function' ? (id) => win.clearTimeout(id) : null) ??
      ((id) => globalThis.clearTimeout(id));

    const setIntervalFn =
      options.setInterval ??
      (timerBag && typeof timerBag.setInterval === 'function'
        ? (fn, ms) => timerBag.setInterval(fn, ms)
        : null) ??
      (win && typeof win.setInterval === 'function' ? (fn, ms) => win.setInterval(fn, ms) : null) ??
      ((fn, ms) => unrefTimerHandle(globalThis.setInterval(fn, ms)));

    const clearIntervalFn =
      options.clearInterval ??
      (timerBag && typeof timerBag.clearInterval === 'function'
        ? (id) => timerBag.clearInterval(id)
        : null) ??
      (win && typeof win.clearInterval === 'function'
        ? (id) => win.clearInterval(id)
        : null) ??
      ((id) => globalThis.clearInterval(id));

    return {
      setTimeout: setTimeoutFn,
      clearTimeout: clearTimeoutFn,
      setInterval: setIntervalFn,
      clearInterval: clearIntervalFn,
    };
  }

  function readCurrentBinding() {
    let raw;
    try {
      raw = getBinding();
    } catch {
      return null;
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return null;
    }
    const { accountGeneration, expectedAccountId } = raw;
    if (!isUuid(accountGeneration)) {
      return null;
    }
    if (expectedAccountId !== null && !isUuid(expectedAccountId)) {
      return null;
    }
    return { accountGeneration, expectedAccountId };
  }

  function matchesBinding(accountGeneration, expectedAccountId) {
    const current = readCurrentBinding();
    if (!current) {
      return false;
    }
    return (
      current.accountGeneration === accountGeneration &&
      current.expectedAccountId === expectedAccountId
    );
  }

  function notifyUpdateListeners(session, payload) {
    const callbacks = [];
    if (typeof session.onUpdate === 'function') {
      callbacks.push(session.onUpdate);
    }
    if (transportUpdateHandler && transportUpdateHandler !== session.onUpdate) {
      callbacks.push(transportUpdateHandler);
    }
    for (const cb of callbacks) {
      try {
        cb(payload);
      } catch {
        // Ignore host callback errors so transport cleanup stays deterministic.
      }
    }
  }

  function sendCancelMessage(session) {
    const targetDocId = session?.currentDocumentId ?? session?.lastDocumentId ?? null;
    if (!session || !targetDocId || !session.popup || session.popup.closed) {
      return;
    }
    try {
      session.popup.postMessage(
        {
          channel: COMPANY_ENTRY_CHANNEL,
          version: COMPANY_ENTRY_VERSION,
          type: 'cancel',
          requestId: session.requestId,
          accountGeneration: session.accountGeneration,
          documentId: targetDocId,
        },
        COMPANY_ENTRY_ORIGIN,
      );
    } catch {
      // Ignore cross-window teardown errors while cleaning up.
    }
  }

  function sendToPopup(session, payload, { markDeliverOfferSent = false } = {}) {
    if (!session.popup || session.popup.closed) {
      finishSessionWithError(session, 'CANCELLED', false, false);
      return false;
    }
    if (markDeliverOfferSent) {
      session.deliverOfferSent = true;
    }
    try {
      session.popup.postMessage(payload, COMPANY_ENTRY_ORIGIN);
      return true;
    } catch {
      if (markDeliverOfferSent) {
        session.deliverOfferSent = false;
      }
      const closedNow = Boolean(session.popup.closed);
      finishSessionWithError(
        session,
        closedNow ? 'CANCELLED' : 'HANDOFF_UNAVAILABLE',
        !closedNow,
        false,
      );
      return false;
    }
  }

  function cleanupSessionResources(session) {
    session.token = null;

    if (session.stepTimer !== null) {
      session.timers.clearTimeout(session.stepTimer);
      session.stepTimer = null;
    }
    if (session.totalTimer !== null) {
      session.timers.clearTimeout(session.totalTimer);
      session.totalTimer = null;
    }
    if (session.pollTimer !== null) {
      session.timers.clearInterval(session.pollTimer);
      session.pollTimer = null;
    }
    if (session.fetchTimer !== null && session.fetchTimer !== undefined) {
      session.timers.clearTimeout(session.fetchTimer);
      session.fetchTimer = null;
    }
    if (session.fetchController) {
      try {
        session.fetchController.abort();
      } catch {
        // Ignore AbortController teardown errors.
      }
      session.fetchController = null;
    }
    if (session.onMessage) {
      try {
        session.win.removeEventListener('message', session.onMessage);
      } catch {
        // Ignore listener removal errors during teardown.
      }
      session.onMessage = null;
    }
    if (session.signal && session.onAbort) {
      try {
        session.signal.removeEventListener('abort', session.onAbort);
      } catch {
        // Ignore abort listener removal errors during teardown.
      }
      session.onAbort = null;
    }
  }

  function rememberSessionHistory(session) {
    if (session.requestId) {
      pastRequestIds.add(session.requestId);
    }
    for (const docId of session.seenDocumentIds) {
      pastDocumentIds.add(docId);
    }
  }

  function finalizeSession(session, outcome, shouldSendCancel, { silentUpdate = false } = {}) {
    if (session.finished) {
      return;
    }
    session.finished = true;
    rememberSessionHistory(session);
    if (activeSession === session) {
      activeSession = null;
    }
    if (shouldSendCancel) {
      sendCancelMessage(session);
    }
    cleanupSessionResources(session);

    if (!session.initialSettled) {
      session.initialSettled = true;
      session.resolve(outcome);
      return;
    }

    if (!silentUpdate) {
      notifyUpdateListeners(session, outcome);
    }
  }

  function finishSessionWithError(session, code, retryable, shouldSendCancel, optionsArg = {}) {
    const unconfirmedAfterDeliverOffer =
      session.mode === 'invite' &&
      session.deliverOfferSent === true &&
      optionsArg?.provenNonReceipt !== true;
    const effectiveCode = unconfirmedAfterDeliverOffer ? 'HANDOFF_UNCONFIRMED' : code;
    const effectiveRetryable = unconfirmedAfterDeliverOffer ? false : retryable;
    const effectiveShouldSendCancel =
      session.deliverOfferSent === true ? false : shouldSendCancel;

    finalizeSession(
      session,
      {
        ...makeErrorResult(effectiveCode, effectiveRetryable),
        ...(session.initialSettled ? { accountGeneration: session.accountGeneration } : {}),
      },
      effectiveShouldSendCancel,
      optionsArg,
    );
  }

  function clearStepTimer(session) {
    if (session.stepTimer !== null) {
      session.timers.clearTimeout(session.stepTimer);
      session.stepTimer = null;
    }
  }

  function resetStepTimer(session) {
    if (session.finished) {
      return;
    }
    clearStepTimer(session);
    session.stepTimer = session.timers.setTimeout(() => {
      finishSessionWithError(session, 'HANDOFF_TIMEOUT', true, true);
    }, stepTimeoutMs);
  }

  function recordVerifiedResolution(session, normalizedResult) {
    const canOpenKnownDestinations =
      ((normalizedResult.status === 'resolved' && normalizedResult.unavailable.length === 0) ||
        normalizedResult.status === 'partial') &&
      normalizedResult.destinations.length > 0;

    if (canOpenKnownDestinations) {
      verifiedResolution = {
        popup: session.popup,
        requestId: session.requestId,
        accountGeneration: session.accountGeneration,
        expectedAccountId: session.expectedAccountId,
        status: normalizedResult.status,
        destinations: [...normalizedResult.destinations],
      };
    } else {
      verifiedResolution = null;
    }
  }

  function handleInviteMessage(session, msg) {
    if (msg.type === 'error') {
      const provenNonReceipt =
        !session.deliverOfferSent ||
        PROVEN_DELIVER_NON_RECEIPT_ERROR_CODES.has(msg.code);
      finishSessionWithError(session, msg.code, msg.retryable, false, {
        provenNonReceipt,
      });
      return;
    }

    switch (session.stage) {
      case 'await_classify_ready': {
        if (msg.type !== 'ready' || msg.documentRole !== 'receiver') {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        session.seenDocumentIds.add(msg.documentId);
        session.currentDocumentId = msg.documentId;
        session.lastDocumentId = msg.documentId;
        session.stage = 'await_classify_bound';
        resetStepTimer(session);
        sendToPopup(session, {
          channel: COMPANY_ENTRY_CHANNEL,
          version: COMPANY_ENTRY_VERSION,
          type: 'bind',
          requestId: session.requestId,
          accountGeneration: session.accountGeneration,
          documentId: session.currentDocumentId,
          phase: 'classify',
          expectedAccountId: session.expectedAccountId,
        });
        return;
      }

      case 'await_classify_bound': {
        if (msg.type !== 'bound' || msg.phase !== 'classify') {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        session.stage = 'await_classified';
        resetStepTimer(session);
        sendToPopup(session, {
          channel: COMPANY_ENTRY_CHANNEL,
          version: COMPANY_ENTRY_VERSION,
          type: 'offer',
          requestId: session.requestId,
          accountGeneration: session.accountGeneration,
          documentId: session.currentDocumentId,
          token: session.token,
        });
        return;
      }

      case 'await_classified': {
        if (msg.type !== 'classified') {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        if (session.expectedKind !== null && msg.kind !== session.expectedKind) {
          finishSessionWithError(session, 'INVITE_REJECTED', false, true);
          return;
        }
        session.classifiedKind = msg.kind;
        session.classifiedDestination = msg.destination;
        session.lastDocumentId = session.currentDocumentId;
        session.currentDocumentId = null;
        session.stage = 'await_deliver_ready';
        resetStepTimer(session);
        return;
      }

      case 'await_deliver_ready': {
        if (msg.type !== 'ready' || msg.documentRole !== session.classifiedKind) {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        session.seenDocumentIds.add(msg.documentId);
        session.currentDocumentId = msg.documentId;
        session.lastDocumentId = msg.documentId;
        session.stage = 'await_deliver_bound';
        resetStepTimer(session);
        sendToPopup(session, {
          channel: COMPANY_ENTRY_CHANNEL,
          version: COMPANY_ENTRY_VERSION,
          type: 'bind',
          requestId: session.requestId,
          accountGeneration: session.accountGeneration,
          documentId: session.currentDocumentId,
          phase: 'deliver',
          expectedAccountId: session.expectedAccountId,
        });
        return;
      }

      case 'await_deliver_bound': {
        if (msg.type !== 'bound' || msg.phase !== 'deliver') {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        const tokenToDeliver = session.token;
        session.token = null;
        session.stage = 'await_received';
        resetStepTimer(session);
        sendToPopup(
          session,
          {
            channel: COMPANY_ENTRY_CHANNEL,
            version: COMPANY_ENTRY_VERSION,
            type: 'offer',
            requestId: session.requestId,
            accountGeneration: session.accountGeneration,
            documentId: session.currentDocumentId,
            token: tokenToDeliver,
          },
          { markDeliverOfferSent: true },
        );
        return;
      }

      case 'await_received': {
        if (
          msg.type !== 'received' ||
          msg.kind !== session.classifiedKind ||
          msg.destination !== session.classifiedDestination ||
          msg.state !== 'queued'
        ) {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        finalizeSession(
          session,
          {
            ok: true,
            requestId: session.requestId,
            accountGeneration: session.accountGeneration,
            state: 'received',
            destination: session.classifiedDestination,
          },
          false,
        );
        return;
      }

      default:
        finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
    }
  }

  function handleResolveMessage(session, msg) {
    if (msg.type === 'error') {
      finishSessionWithError(session, msg.code, msg.retryable, false);
      return;
    }

    switch (session.stage) {
      case 'await_resolve_ready': {
        if (
          msg.type !== 'ready' ||
          (msg.documentRole !== 'receiver' && msg.documentRole !== 'customer')
        ) {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        session.seenDocumentIds.add(msg.documentId);
        session.currentDocumentId = msg.documentId;
        session.lastDocumentId = msg.documentId;
        session.stage = 'await_resolve_bound';
        resetStepTimer(session);
        sendToPopup(session, {
          channel: COMPANY_ENTRY_CHANNEL,
          version: COMPANY_ENTRY_VERSION,
          type: 'bind',
          requestId: session.requestId,
          accountGeneration: session.accountGeneration,
          documentId: session.currentDocumentId,
          phase: 'resolve',
          expectedAccountId: session.expectedAccountId,
        });
        return;
      }

      case 'await_rebind_ready': {
        if (
          msg.type !== 'ready' ||
          (msg.documentRole !== 'receiver' && msg.documentRole !== 'customer')
        ) {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        const nextRequestId = createRequestId(session.win);
        if (!nextRequestId) {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', true, false);
          return;
        }
        pastRequestIds.add(session.requestId);
        session.requestId = nextRequestId;
        session.seenDocumentIds.add(msg.documentId);
        session.currentDocumentId = msg.documentId;
        session.lastDocumentId = msg.documentId;
        session.stage = 'await_resolve_bound';
        resetStepTimer(session);
        sendToPopup(session, {
          channel: COMPANY_ENTRY_CHANNEL,
          version: COMPANY_ENTRY_VERSION,
          type: 'bind',
          requestId: session.requestId,
          accountGeneration: session.accountGeneration,
          documentId: session.currentDocumentId,
          phase: 'resolve',
          expectedAccountId: session.expectedAccountId,
        });
        return;
      }

      case 'await_resolve_bound': {
        if (msg.type !== 'bound' || msg.phase !== 'resolve') {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }
        session.stage = 'await_assignment';
        resetStepTimer(session);
        return;
      }

      case 'await_assignment': {
        if (msg.type !== 'assignment') {
          finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
          return;
        }

        const normalizedResult = {
          status: msg.result.status,
          destinations: [...msg.result.destinations],
          unavailable: [...msg.result.unavailable],
        };

        recordVerifiedResolution(session, normalizedResult);

        const outcome = {
          ok: true,
          requestId: session.requestId,
          accountGeneration: session.accountGeneration,
          result: normalizedResult,
        };

        if (normalizedResult.status === 'login_required') {
          pastRequestIds.add(session.requestId);
          session.lastDocumentId = session.currentDocumentId;
          session.currentDocumentId = null;
          session.stage = 'await_rebind_ready';
          clearStepTimer(session);
          unrefTimerHandle(session.totalTimer);

          if (!session.initialSettled) {
            session.initialSettled = true;
            session.resolve(outcome);
          } else {
            notifyUpdateListeners(session, outcome);
          }
          return;
        }

        finalizeSession(session, outcome, false);
        return;
      }

      default:
        finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
    }
  }

  function routeIncomingEvent(session, raw) {
    if (!isPlainObject(raw)) {
      finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
      return;
    }
    if (
      raw.channel !== COMPANY_ENTRY_CHANNEL ||
      raw.version !== COMPANY_ENTRY_VERSION ||
      typeof raw.type !== 'string'
    ) {
      if (
        raw.requestId !== undefined &&
        raw.requestId !== session.requestId
      ) {
        return;
      }
      if (
        raw.documentId !== undefined &&
        session.currentDocumentId !== null &&
        raw.documentId !== session.currentDocumentId
      ) {
        return;
      }
      finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
      return;
    }

    if (raw.type === 'ready') {
      if (isUuid(raw.documentId)) {
        if (pastDocumentIds.has(raw.documentId)) {
          return;
        }
        if (session.seenDocumentIds.has(raw.documentId)) {
          if (
            session.mode === 'invite' &&
            session.stage === 'await_deliver_ready' &&
            raw.documentRole === session.classifiedKind
          ) {
            finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
            return;
          }
          return;
        }
        if (
          session.mode === 'invite' &&
          session.stage === 'await_deliver_ready' &&
          raw.documentRole === 'receiver' &&
          hasExactKeys(raw, KEYS_READY)
        ) {
          return;
        }
      }

      const parsedReady = parseIncomingMessage(raw);
      if (!parsedReady) {
        finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
        return;
      }

      if (session.mode === 'invite') {
        handleInviteMessage(session, parsedReady);
      } else {
        handleResolveMessage(session, parsedReady);
      }
      return;
    }

    if (raw.requestId !== session.requestId) {
      if (isUuid(raw.requestId)) {
        return;
      }
      finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
      return;
    }

    if (raw.accountGeneration !== session.accountGeneration) {
      if (isUuid(raw.accountGeneration)) {
        return;
      }
      finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
      return;
    }

    const matchesActiveDeliverErrorDoc =
      raw.type === 'error' &&
      session.mode === 'invite' &&
      session.stage === 'await_deliver_ready' &&
      session.currentDocumentId === null &&
      session.lastDocumentId !== null &&
      raw.documentId === session.lastDocumentId;

    if (!matchesActiveDeliverErrorDoc) {
      if (session.currentDocumentId === null || raw.documentId !== session.currentDocumentId) {
        if (isUuid(raw.documentId)) {
          return;
        }
        finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
        return;
      }
    }

    const parsed = parseIncomingMessage(raw);
    if (!parsed) {
      finishSessionWithError(session, 'HANDOFF_UNAVAILABLE', false, true);
      return;
    }

    if (session.mode === 'invite') {
      handleInviteMessage(session, parsed);
    } else {
      handleResolveMessage(session, parsed);
    }
  }

  function finishFetchWithError(session, code, retryable) {
    finalizeSession(
      session,
      {
        ...makeErrorResult(code, retryable),
        requestId: session.requestId,
        accountGeneration: session.accountGeneration,
      },
      false,
      { silentUpdate: true },
    );
  }

  function releaseIdleOrStaleSessionIfNeeded() {
    if (
      activeSession !== null &&
      activeSession.initialSettled &&
      activeSession.stage === 'await_rebind_ready'
    ) {
      finishSessionWithError(activeSession, 'CANCELLED', false, true, { silentUpdate: true });
    }
    if (
      activeSession !== null &&
      !matchesBinding(activeSession.accountGeneration, activeSession.expectedAccountId)
    ) {
      if (activeSession.mode === 'resolve-fetch') {
        finishFetchWithError(activeSession, 'ACCOUNT_CHANGED', false);
      } else {
        finishSessionWithError(activeSession, 'ACCOUNT_CHANGED', false, true);
      }
    }
  }

  function beginFetchResolution({ accountGeneration, expectedAccountId, signal }) {
    const win = getWindowTarget();
    const fetchFn = resolveFetch(win);
    if (!fetchFn) {
      return Promise.resolve(makeErrorResult('TEMPORARY_UNAVAILABLE', true));
    }

    const requestId = createRequestId(win);
    if (!requestId || pastRequestIds.has(requestId)) {
      return Promise.resolve(makeErrorResult('TEMPORARY_UNAVAILABLE', true));
    }

    verifiedResolution = null;
    const timers = resolveTimers(win);
    const fetchController = typeof AbortController === 'function' ? new AbortController() : null;

    return new Promise((resolve) => {
      const session = {
        mode: 'resolve-fetch',
        win,
        popup: null,
        timers,
        requestId,
        accountGeneration,
        expectedAccountId,
        token: null,
        expectedKind: null,
        signal,
        onUpdate: null,
        stage: 'await_http_destinations',
        currentDocumentId: null,
        lastDocumentId: null,
        classifiedKind: null,
        classifiedDestination: null,
        deliverOfferSent: false,
        seenDocumentIds: new Set(),
        stepTimer: null,
        totalTimer: null,
        pollTimer: null,
        fetchTimer: null,
        fetchController,
        timedOut: false,
        onMessage: null,
        onAbort: null,
        initialSettled: false,
        finished: false,
        resolve,
      };

      activeSession = session;

      if (signal) {
        const onAbort = () => {
          finishFetchWithError(session, 'CANCELLED', false);
        };
        session.onAbort = onAbort;
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) {
          finishFetchWithError(session, 'CANCELLED', false);
          return;
        }
      }

      session.fetchTimer = unrefTimerHandle(
        timers.setTimeout(() => {
          session.timedOut = true;
          finishFetchWithError(session, 'HANDOFF_TIMEOUT', true);
        }, fetchTimeoutMs),
      );

      session.pollTimer = unrefTimerHandle(
        timers.setInterval(() => {
          if (session.finished) {
            return;
          }
          if (disposed) {
            finishFetchWithError(session, 'CANCELLED', false);
            return;
          }
          if (!matchesBinding(session.accountGeneration, session.expectedAccountId)) {
            finishFetchWithError(session, 'ACCOUNT_CHANGED', false);
          }
        }, pollIntervalMs),
      );

      void (async () => {
        let response;
        try {
          response = await fetchFn(COMPANY_DESTINATIONS_URL, {
            method: 'POST',
            credentials: 'include',
            redirect: 'error',
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expectedAccountId }),
            ...(fetchController ? { signal: fetchController.signal } : {}),
          });
        } catch {
          if (session.finished) {
            return;
          }
          if (disposed) {
            finishFetchWithError(session, 'CANCELLED', false);
            return;
          }
          if (!matchesBinding(session.accountGeneration, session.expectedAccountId)) {
            finishFetchWithError(session, 'ACCOUNT_CHANGED', false);
            return;
          }
          finishFetchWithError(
            session,
            session.timedOut ? 'HANDOFF_TIMEOUT' : 'TEMPORARY_UNAVAILABLE',
            true,
          );
          return;
        }

        if (session.finished) {
          if (response?.body && typeof response.body.cancel === 'function') {
            void Promise.resolve(response.body.cancel()).catch(() => {});
          }
          return;
        }
        if (disposed) {
          finishFetchWithError(session, 'CANCELLED', false);
          return;
        }
        if (!matchesBinding(session.accountGeneration, session.expectedAccountId)) {
          finishFetchWithError(session, 'ACCOUNT_CHANGED', false);
          return;
        }
        if (
          !response ||
          typeof response !== 'object' ||
          response.redirected === true ||
          response.type === 'opaqueredirect' ||
          !Number.isInteger(response.status)
        ) {
          finishFetchWithError(session, 'TEMPORARY_UNAVAILABLE', false);
          return;
        }

        let rawText;
        try {
          rawText = await readBoundedResponseText(response, MAX_RESPONSE_BYTES);
        } catch (readErr) {
          if (session.finished) {
            return;
          }
          if (disposed) {
            finishFetchWithError(session, 'CANCELLED', false);
            return;
          }
          if (!matchesBinding(session.accountGeneration, session.expectedAccountId)) {
            finishFetchWithError(session, 'ACCOUNT_CHANGED', false);
            return;
          }
          if (session.timedOut) {
            finishFetchWithError(session, 'HANDOFF_TIMEOUT', true);
            return;
          }
          const tooLarge = readErr?.message === 'RESPONSE_TOO_LARGE';
          finishFetchWithError(session, 'TEMPORARY_UNAVAILABLE', !tooLarge);
          return;
        }

        if (session.finished) {
          return;
        }
        if (disposed) {
          finishFetchWithError(session, 'CANCELLED', false);
          return;
        }
        if (!matchesBinding(session.accountGeneration, session.expectedAccountId)) {
          finishFetchWithError(session, 'ACCOUNT_CHANGED', false);
          return;
        }

        let parsedJson;
        let jsonValid = false;
        if (typeof rawText === 'string' && rawText.trim() !== '') {
          try {
            parsedJson = JSON.parse(rawText);
            jsonValid = true;
          } catch {
            jsonValid = false;
          }
        }

        if (response.status === 200) {
          const normalizedResult = jsonValid ? parseDestinationsHttpSuccess(parsedJson) : null;
          if (!normalizedResult) {
            verifiedResolution = null;
            finishFetchWithError(session, 'TEMPORARY_UNAVAILABLE', true);
            return;
          }
          if (!matchesBinding(session.accountGeneration, session.expectedAccountId)) {
            verifiedResolution = null;
            finishFetchWithError(session, 'ACCOUNT_CHANGED', false);
            return;
          }
          recordVerifiedResolution(session, normalizedResult);
          finalizeSession(
            session,
            {
              ok: true,
              requestId: session.requestId,
              accountGeneration: session.accountGeneration,
              result: normalizedResult,
            },
            false,
          );
          return;
        }

        verifiedResolution = null;
        const mappedError = parseDestinationsHttpError(
          response.status,
          jsonValid ? parsedJson : undefined,
        );
        finishFetchWithError(session, mappedError.code, mappedError.retryable);
      })();
    });
  }

  function beginSession({
    mode,
    token,
    expectedKind,
    accountGeneration,
    expectedAccountId,
    signal,
    onUpdate,
  }) {
    const win = getWindowTarget();
    if (
      !win ||
      typeof win.open !== 'function' ||
      typeof win.addEventListener !== 'function' ||
      typeof win.removeEventListener !== 'function'
    ) {
      return Promise.resolve(makeErrorResult('HANDOFF_UNAVAILABLE', true));
    }

    const requestId = createRequestId(win);
    if (!requestId || pastRequestIds.has(requestId)) {
      return Promise.resolve(makeErrorResult('HANDOFF_UNAVAILABLE', true));
    }

    verifiedResolution = null;

    let popup = null;
    try {
      popup = win.open(COMPANY_ENTRY_URL, '_blank');
    } catch {
      popup = null;
    }

    if (!popup || popup.closed === true) {
      return Promise.resolve(makeErrorResult('HANDOFF_UNAVAILABLE', true));
    }

    const timers = resolveTimers(win);

    return new Promise((resolve) => {
      const session = {
        mode,
        win,
        popup,
        timers,
        requestId,
        accountGeneration,
        expectedAccountId,
        token: mode === 'invite' ? token : null,
        expectedKind: mode === 'invite' ? expectedKind : null,
        signal,
        onUpdate: typeof onUpdate === 'function' ? onUpdate : null,
        stage: mode === 'invite' ? 'await_classify_ready' : 'await_resolve_ready',
        currentDocumentId: null,
        lastDocumentId: null,
        classifiedKind: null,
        classifiedDestination: null,
        deliverOfferSent: false,
        seenDocumentIds: new Set(),
        stepTimer: null,
        totalTimer: null,
        pollTimer: null,
        fetchTimer: null,
        fetchController: null,
        timedOut: false,
        onMessage: null,
        onAbort: null,
        initialSettled: false,
        finished: false,
        resolve,
      };

      activeSession = session;

      const onMessage = (event) => {
        if (session.finished) {
          return;
        }
        if (!matchesBinding(session.accountGeneration, session.expectedAccountId)) {
          finishSessionWithError(session, 'ACCOUNT_CHANGED', false, true);
          return;
        }
        if (session.popup.closed === true) {
          finishSessionWithError(session, 'CANCELLED', false, false);
          return;
        }
        if (!event || event.source !== session.popup || event.origin !== COMPANY_ENTRY_ORIGIN) {
          return;
        }
        routeIncomingEvent(session, event.data);
      };

      session.onMessage = onMessage;
      win.addEventListener('message', onMessage);

      if (signal) {
        const onAbort = () => {
          finishSessionWithError(session, 'CANCELLED', false, true);
        };
        session.onAbort = onAbort;
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) {
          finishSessionWithError(session, 'CANCELLED', false, true);
          return;
        }
      }

      session.totalTimer = timers.setTimeout(() => {
        finishSessionWithError(session, 'HANDOFF_TIMEOUT', true, true);
      }, totalTimeoutMs);

      resetStepTimer(session);

      session.pollTimer = timers.setInterval(() => {
        if (session.finished) {
          return;
        }
        if (!matchesBinding(session.accountGeneration, session.expectedAccountId)) {
          finishSessionWithError(session, 'ACCOUNT_CHANGED', false, true);
          return;
        }
        if (session.popup.closed === true) {
          finishSessionWithError(session, 'CANCELLED', false, false);
        }
      }, pollIntervalMs);
    });
  }

  function startInvite(params) {
    verifiedResolution = null;
    if (disposed) {
      return Promise.resolve(makeErrorResult('CANCELLED', false));
    }
    releaseIdleOrStaleSessionIfNeeded();
    if (activeSession !== null) {
      return Promise.resolve(makeErrorResult('BUSY', false));
    }
    if (typeof params !== 'object' || params === null || Array.isArray(params)) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }

    const { token, expectedKind, accountGeneration, expectedAccountId, signal } = params;

    if (typeof token !== 'string' || !INVITE_TOKEN_PATTERN.test(token)) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }
    if (
      expectedKind !== undefined &&
      expectedKind !== null &&
      !ALLOWED_KINDS.has(expectedKind)
    ) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }
    if (!isUuid(accountGeneration)) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }
    if (expectedAccountId !== null && !isUuid(expectedAccountId)) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }
    if (signal !== undefined && signal !== null && !isAbortSignalLike(signal)) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }
    if (signal?.aborted) {
      return Promise.resolve(makeErrorResult('CANCELLED', false));
    }
    if (!matchesBinding(accountGeneration, expectedAccountId)) {
      return Promise.resolve(makeErrorResult('ACCOUNT_CHANGED', false));
    }

    return beginSession({
      mode: 'invite',
      token,
      expectedKind: expectedKind ?? null,
      accountGeneration,
      expectedAccountId,
      signal: signal ?? null,
      onUpdate: null,
    });
  }

  function resolveAssignments(params) {
    verifiedResolution = null;
    if (disposed) {
      return Promise.resolve(makeErrorResult('CANCELLED', false));
    }
    releaseIdleOrStaleSessionIfNeeded();
    if (activeSession !== null) {
      return Promise.resolve(makeErrorResult('BUSY', false));
    }
    if (typeof params !== 'object' || params === null || Array.isArray(params)) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }

    const {
      accountGeneration,
      expectedAccountId,
      interactiveRecovery,
      signal,
      onUpdate,
      onAssignmentUpdate,
      onStateChange,
    } = params;

    if (!isUuid(accountGeneration) || !isUuid(expectedAccountId)) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }
    if (interactiveRecovery !== undefined && typeof interactiveRecovery !== 'boolean') {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }
    if (signal !== undefined && signal !== null && !isAbortSignalLike(signal)) {
      return Promise.resolve(makeErrorResult('INVALID_INPUT', false));
    }
    if (signal?.aborted) {
      return Promise.resolve(makeErrorResult('CANCELLED', false));
    }
    if (!matchesBinding(accountGeneration, expectedAccountId)) {
      return Promise.resolve(makeErrorResult('ACCOUNT_CHANGED', false));
    }

    if (interactiveRecovery === true) {
      const updateCallback =
        typeof onUpdate === 'function'
          ? onUpdate
          : typeof onAssignmentUpdate === 'function'
            ? onAssignmentUpdate
            : typeof onStateChange === 'function'
              ? onStateChange
              : null;

      return beginSession({
        mode: 'resolve',
        token: null,
        expectedKind: null,
        accountGeneration,
        expectedAccountId,
        signal: signal ?? null,
        onUpdate: updateCallback,
      });
    }

    return beginFetchResolution({
      accountGeneration,
      expectedAccountId,
      signal: signal ?? null,
    });
  }

  function openDestination(destination) {
    if (disposed) {
      return makeErrorResult('CANCELLED', false);
    }
    if (activeSession !== null && !activeSession.initialSettled) {
      return makeErrorResult('BUSY', false);
    }
    if (typeof destination !== 'string' || !ALLOWED_DESTINATIONS.has(destination)) {
      return makeErrorResult('INVALID_INPUT', false);
    }
    if (!verifiedResolution) {
      return makeErrorResult('HANDOFF_UNAVAILABLE', false);
    }
    if (
      !matchesBinding(
        verifiedResolution.accountGeneration,
        verifiedResolution.expectedAccountId,
      )
    ) {
      verifiedResolution = null;
      return makeErrorResult('ACCOUNT_CHANGED', false);
    }
    if (!verifiedResolution.destinations.includes(destination)) {
      return makeErrorResult('INVALID_INPUT', false);
    }

    const targetUrl =
      destination === '/'
        ? `${COMPANY_ENTRY_ORIGIN}/`
        : destination === '/pulse-app/'
          ? `${COMPANY_ENTRY_ORIGIN}/pulse-app/`
          : null;
    if (!targetUrl) {
      return makeErrorResult('INVALID_INPUT', false);
    }

    const win = getWindowTarget();
    const locationTarget = resolveLocation(win);
    if (!locationTarget || typeof locationTarget !== 'object') {
      return makeErrorResult('HANDOFF_UNAVAILABLE', true);
    }

    try {
      if (typeof locationTarget.assign === 'function') {
        locationTarget.assign(targetUrl);
      } else if (typeof locationTarget.replace === 'function') {
        locationTarget.replace(targetUrl);
      } else {
        return makeErrorResult('HANDOFF_UNAVAILABLE', true);
      }
    } catch {
      return makeErrorResult('HANDOFF_UNAVAILABLE', true);
    }

    const helperPopup = verifiedResolution.popup;
    if (helperPopup && helperPopup.closed !== true) {
      try {
        helperPopup.close?.();
      } catch {
        // Ignore helper popup teardown errors after same-tab navigation starts.
      }
    }

    return {
      ok: true,
      requestId: verifiedResolution.requestId,
      accountGeneration: verifiedResolution.accountGeneration,
      destination,
      state: 'navigationRequested',
      navigationRequested: true,
    };
  }

  function cancel(optionsArg = {}) {
    const preserveVerified =
      !disposed &&
      isPlainObject(optionsArg) &&
      optionsArg.preserveVerifiedResolution === true &&
      verifiedResolution !== null &&
      Array.isArray(verifiedResolution.destinations) &&
      verifiedResolution.destinations.length > 0 &&
      matchesBinding(
        verifiedResolution.accountGeneration,
        verifiedResolution.expectedAccountId,
      );
    if (!preserveVerified) {
      verifiedResolution = null;
    }
    if (activeSession !== null) {
      finishSessionWithError(activeSession, 'CANCELLED', false, true, { silentUpdate: true });
    }
  }

  function dispose() {
    disposed = true;
    verifiedResolution = null;
    if (activeSession !== null) {
      finishSessionWithError(activeSession, 'CANCELLED', false, true, { silentUpdate: true });
    }
  }

  return {
    startInvite,
    resolveAssignments,
    openDestination,
    cancel,
    dispose,
  };
}
