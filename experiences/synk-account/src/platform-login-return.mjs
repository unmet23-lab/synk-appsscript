// 웹 플랫폼 첫 화면에서 시작한 SYNK ID OAuth 요청과 복귀 경로를 같은 탭의 PKCE 상태에 묶는다.
// 네트워크 요청과 토큰 교환, 세션 저장은 기존 core/client 경로만 담당하며 이 모듈은 의도 결속과 소비만 맡는다.

import { publicUrl } from './core.mjs';
import { APPLICATIONS } from './applications.mjs';
import { SOLIO_SECTIONS, SOLIO_LEGACY_BENEFITS } from '../../../desktop/renderer/solio.mjs';
import { MEMBER_BENEFITS, MEMBER_INSIGHT } from '../../../desktop/renderer/benefits.mjs';

export const PLATFORM_LOGIN_INTENT = 'synk.platform.login.intent';
export const PLATFORM_LOGIN_NOTICE = 'synk.platform.login.notice';
export const PLATFORM_RESUME_SUBJECT_KEY = 'synk.platform.login.resume';
export const PLATFORM_AUTO_LOGIN_ATTEMPT_KEY = 'synk.platform.auto-login.attempt.v1';
export const PLATFORM_AUTO_LOGIN_PAUSE_KEY = 'synk.platform.auto-login.pause.v1';
export const PLATFORM_LOGIN_TTL_MS = 600000;
export const PLATFORM_PORTAL_HINT_WINDOW_MS = 120000;
export const PLATFORM_LOGIN_METHODS = Object.freeze(['google', 'email', 'signup']);
export const PLATFORM_RESUME_METHOD = 'resume';
export const PLATFORM_RETURN_ENTRY = './platform.html';

const PLATFORM_PRODUCT = 'platform';
const PLATFORM_PENDING_KEY = 'synk.oauth.pending.platform';
const FOREIGN_PENDING_PRODUCTS = Object.freeze(['world', 'messenger', 'care', 'path', 'path-travel', 'path-app']);
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,200}$/;
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007F]/;
const FORBIDDEN_REDIRECT_PARAMS = Object.freeze([
  'code',
  'state',
  'error',
  'error_description',
  'access_token',
  'refresh_token',
]);
const ALLOWED_ERROR_CALLBACK_EXTRAS = Object.freeze([
  'error_description',
  'error_uri',
  'error_code',
]);
const PORTAL_CALLBACK_OR_ERROR_PARAMS = Object.freeze([
  'code',
  'error',
  'error_code',
  'error_description',
  'google_flow',
  'sb_flow_id',
  'token_hash',
  'message',
  'access_token',
  'refresh_token',
]);
const INTENT_KEYS = Object.freeze([
  'v',
  'product',
  'state',
  'clientId',
  'redirectUri',
  'createdAt',
  'method',
  'route',
]);
const NOTICE_KEYS = Object.freeze(['v', 'kind', 'createdAt']);
const STATIC_LOGIN_NOTICES = Object.freeze({
  cancelled: Object.freeze({
    kind: 'cancelled',
    message: '로그인을 취소했어요. 다시 시작하려면 로그인 방법을 골라 주세요.',
  }),
  failed: Object.freeze({
    kind: 'failed',
    message: '로그인을 마치지 못했어요. 다시 시도해 주세요.',
  }),
});

// 현재 플랫폼 정본에서 검증 가능한 정적 허용 라우트만 상수 테이블로 구성한다.
// 사용자 입력 문자열을 그대로 목적지에 이어 붙이지 않고 항상 이 맵의 동결 상수만 꺼내 쓴다.
const ALLOWED_ROUTE_MAP = (() => {
  const entries = new Map([
    ['home', '#home'],
    ['solio', '#solio'],
    ['benefits', '#benefits'],
    ['account', '#account'],
    ['discover', '#discover'],
    ['library', '#library'],
    ['updates', '#updates'],
    ['downloads', '#downloads'],
    ['settings', '#settings'],
    ['help', '#help'],
  ]);

  if (MEMBER_INSIGHT?.id === 'insight') {
    entries.set('account/insight', '#account/insight');
  }

  for (const [sectionId] of SOLIO_SECTIONS) {
    if (sectionId === 'home') entries.set('solio/home', '#solio');
    else if (sectionId === 'subscriptions') entries.set('solio/subscriptions', '#solio/subscriptions');
    else if (sectionId === 'backup') entries.set('solio/backup', '#solio/backup');
  }

  for (const benefit of MEMBER_BENEFITS) {
    if (benefit?.id === 'care') {
      entries.set('benefits/care', '#benefits/care');
    }
  }

  for (const [legacyId, target] of Object.entries(SOLIO_LEGACY_BENEFITS)) {
    if (legacyId === 'insight' && target?.hash === '#account/insight') {
      entries.set('benefits/insight', '#account/insight');
    } else if (legacyId === 'subscriptions' && target?.hash === '#solio/subscriptions') {
      entries.set('benefits/subscriptions', '#solio/subscriptions');
    }
  }

  for (const app of APPLICATIONS) {
    if (app?.id === 'world') entries.set('app/world', '#app/world');
    else if (app?.id === 'messenger') entries.set('app/messenger', '#app/messenger');
    else if (app?.id === 'path') entries.set('app/path', '#app/path');
  }

  return entries;
})();

export const PLATFORM_ALLOWED_HASHES = Object.freeze([...new Set(ALLOWED_ROUTE_MAP.values())]);
const CANONICAL_HASH_MAP = new Map(PLATFORM_ALLOWED_HASHES.map(hash => [hash, hash]));

function isValidTimestamp(createdAt, now) {
  return Number.isFinite(now)
    && Number.isFinite(createdAt)
    && createdAt > 0
    && createdAt <= now
    && now - createdAt <= PLATFORM_LOGIN_TTL_MS;
}

function hasExactKeys(record, expectedKeys) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const keys = Object.keys(record);
  return keys.length === expectedKeys.length && keys.every(key => expectedKeys.includes(key));
}

function parseRegisteredPlatformRedirect(value) {
  if (typeof value !== 'string' || !value || value.includes('#')) return null;
  let parsed;
  try {
    parsed = publicUrl(value);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password || parsed.hash) return null;
  const keys = [...parsed.searchParams.keys()];
  if (keys.some(key => !key || parsed.searchParams.getAll(key).length !== 1)) return null;
  if (FORBIDDEN_REDIRECT_PARAMS.some(key => parsed.searchParams.has(key))) return null;
  if (parsed.searchParams.has('product') && parsed.searchParams.get('product') !== PLATFORM_PRODUCT) {
    return null;
  }
  return parsed;
}

function readValidPlatformClient(config) {
  if (!config || config.configured !== true) return null;
  const client = config.clients?.[PLATFORM_PRODUCT];
  if (!client || typeof client.clientId !== 'string' || !client.clientId) return null;
  if (typeof client.redirectUri !== 'string' || !client.redirectUri) return null;
  const expectedUrl = parseRegisteredPlatformRedirect(client.redirectUri);
  if (!expectedUrl) return null;
  return {
    clientId: client.clientId,
    redirectUri: client.redirectUri,
    expectedUrl,
  };
}

// 해시 입력에서 조회·검색 문자열과 인증값을 모두 버리고 정본 정적 허용 해시 상수만 반환한다.
// 플랫폼 외부 URL이나 비해시 임의 경로는 null로 거부한다.
function normalizePlatformReturnHash(returnHash) {
  if (returnHash === undefined || returnHash === null || returnHash === '') {
    return '#home';
  }
  if (typeof returnHash !== 'string') {
    return null;
  }
  if (!returnHash.startsWith('#')) {
    if (ALLOWED_ROUTE_MAP.has(returnHash)) {
      return ALLOWED_ROUTE_MAP.get(returnHash);
    }
    return null;
  }
  const withoutHash = returnHash.slice(1);
  const [rawPath = ''] = withoutHash.split(/[?#]/, 1);
  if (!rawPath || rawPath.includes('=') || CONTROL_OR_SPACE.test(rawPath)) {
    return '#home';
  }
  return ALLOWED_ROUTE_MAP.get(rawPath) || '#home';
}

function validatePendingTransaction(pending, client, now) {
  if (!pending || typeof pending !== 'object' || Array.isArray(pending)) return false;
  if (pending.product !== PLATFORM_PRODUCT) return false;
  if (typeof pending.state !== 'string' || !STATE_PATTERN.test(pending.state)) return false;
  if (typeof pending.verifier !== 'string' || pending.verifier.length < 32 || CONTROL_OR_SPACE.test(pending.verifier)) {
    return false;
  }
  if (pending.clientId !== client.clientId || pending.redirectUri !== client.redirectUri) return false;
  if (!isValidTimestamp(pending.createdAt, now)) return false;
  return true;
}

function isValidResumeSubject(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 200
    && !CONTROL_OR_SPACE.test(value);
}

function validateIntentRecord(record, now) {
  if (!hasExactKeys(record, INTENT_KEYS)) return null;
  if (record.v !== 1 || record.product !== PLATFORM_PRODUCT) return null;
  if (!PLATFORM_LOGIN_METHODS.includes(record.method) && record.method !== PLATFORM_RESUME_METHOD) return null;
  if (typeof record.state !== 'string' || !STATE_PATTERN.test(record.state)) return null;
  if (typeof record.clientId !== 'string' || !record.clientId || CONTROL_OR_SPACE.test(record.clientId)) return null;
  if (!parseRegisteredPlatformRedirect(record.redirectUri)) return null;
  if (!isValidTimestamp(record.createdAt, now)) return null;
  const canonicalRoute = normalizePlatformReturnHash(record.route);
  if (!canonicalRoute || typeof record.route !== 'string' || !record.route.startsWith('#')) {
    return null;
  }
  return Object.freeze({
    v: 1,
    product: PLATFORM_PRODUCT,
    state: record.state,
    clientId: record.clientId,
    redirectUri: record.redirectUri,
    createdAt: record.createdAt,
    method: record.method,
    route: canonicalRoute,
  });
}

function validateResumeSubjectRecord(record, intent, now) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const keys = Object.keys(record);
  const allowedKeys = ['v', 'state', 'subject', 'createdAt', 'switchRequested'];
  if (
    keys.length < 4
    || keys.length > 5
    || !keys.includes('v')
    || !keys.includes('state')
    || !keys.includes('subject')
    || !keys.includes('createdAt')
    || !keys.every(key => allowedKeys.includes(key))
  ) {
    return null;
  }
  if (
    record.v !== 1
    || record.state !== intent.state
    || record.createdAt !== intent.createdAt
    || !isValidTimestamp(record.createdAt, now)
    || !isValidResumeSubject(record.subject)
  ) {
    return null;
  }
  if (keys.includes('switchRequested') && typeof record.switchRequested !== 'boolean') {
    return null;
  }
  return Object.freeze({
    v: 1,
    state: record.state,
    subject: record.subject,
    createdAt: record.createdAt,
    switchRequested: record.switchRequested === true,
  });
}

function callbackUrlMatchesPlatform(rawUrl, expectedUrl, expectedState) {
  if (typeof rawUrl !== 'string' && !(rawUrl instanceof URL)) return false;
  const urlText = typeof rawUrl === 'string' ? rawUrl : rawUrl.href;
  if (!urlText || urlText.includes('#')) return false;

  let actual;
  try {
    actual = new URL(urlText);
  } catch {
    return false;
  }

  if (
    actual.username
    || actual.password
    || actual.hash
    || actual.protocol !== expectedUrl.protocol
    || actual.origin !== expectedUrl.origin
    || actual.host !== expectedUrl.host
    || actual.pathname !== expectedUrl.pathname
  ) {
    return false;
  }

  const rawSearch = actual.search.startsWith('?') ? actual.search.slice(1) : '';
  if (!rawSearch) return false;
  const rawSegments = rawSearch.split('&');
  if (rawSegments.some(segment => !segment || segment.startsWith('='))) return false;

  if (actual.searchParams.has('error') || actual.searchParams.has('error_description')) {
    return false;
  }

  const allowedKeys = new Set([...expectedUrl.searchParams.keys(), 'code', 'state']);
  const actualKeys = [...actual.searchParams.keys()];
  if (actualKeys.some(key => !allowedKeys.has(key) || actual.searchParams.getAll(key).length !== 1)) {
    return false;
  }
  if ([...expectedUrl.searchParams.entries()].some(([key, value]) => actual.searchParams.get(key) !== value)) {
    return false;
  }
  if (actual.searchParams.has('product') && actual.searchParams.get('product') !== PLATFORM_PRODUCT) {
    return false;
  }

  const codes = actual.searchParams.getAll('code');
  const states = actual.searchParams.getAll('state');
  if (codes.length !== 1 || states.length !== 1) return false;

  const code = codes[0];
  const state = states[0];
  if (!code || CONTROL_OR_SPACE.test(code)) return false;
  if (state !== expectedState) return false;

  return true;
}

function hasRegisteredPlatformProductQuery(expectedUrl) {
  return Boolean(expectedUrl)
    && expectedUrl.searchParams.getAll('product').length === 1
    && expectedUrl.searchParams.get('product') === PLATFORM_PRODUCT;
}

function isSuccessCodeCandidateWithoutError(rawUrl) {
  if (typeof rawUrl !== 'string' && !(rawUrl instanceof URL)) return false;
  const urlText = typeof rawUrl === 'string' ? rawUrl : rawUrl.href;
  if (!urlText) return false;
  let actual;
  try {
    actual = new URL(urlText);
  } catch {
    return false;
  }
  if (!actual.searchParams.has('code')) return false;
  if (actual.searchParams.has('error')) return false;
  if (ALLOWED_ERROR_CALLBACK_EXTRAS.some(key => actual.searchParams.has(key))) return false;
  return true;
}

function errorCallbackUrlMatchesPlatform(rawUrl, expectedUrl, expectedState) {
  if (!hasRegisteredPlatformProductQuery(expectedUrl)) return null;
  if (typeof rawUrl !== 'string' && !(rawUrl instanceof URL)) return null;
  const urlText = typeof rawUrl === 'string' ? rawUrl : rawUrl.href;
  if (!urlText || urlText.includes('#')) return null;

  let actual;
  try {
    actual = new URL(urlText);
  } catch {
    return null;
  }

  if (
    actual.username
    || actual.password
    || actual.hash
    || actual.protocol !== expectedUrl.protocol
    || actual.origin !== expectedUrl.origin
    || actual.host !== expectedUrl.host
    || actual.pathname !== expectedUrl.pathname
  ) {
    return null;
  }

  const rawSearch = actual.search.startsWith('?') ? actual.search.slice(1) : '';
  if (!rawSearch) return null;
  const rawSegments = rawSearch.split('&');
  if (rawSegments.some(segment => !segment || segment.startsWith('='))) return null;

  if (actual.searchParams.has('code')) {
    return null;
  }

  const allowedKeys = new Set([
    ...expectedUrl.searchParams.keys(),
    'error',
    'state',
    ...ALLOWED_ERROR_CALLBACK_EXTRAS,
  ]);
  const actualKeys = [...actual.searchParams.keys()];
  if (actualKeys.some(key => !allowedKeys.has(key) || actual.searchParams.getAll(key).length !== 1)) {
    return null;
  }
  if ([...expectedUrl.searchParams.entries()].some(([key, value]) => actual.searchParams.get(key) !== value)) {
    return null;
  }
  if (actual.searchParams.getAll('product').length !== 1 || actual.searchParams.get('product') !== PLATFORM_PRODUCT) {
    return null;
  }

  const errors = actual.searchParams.getAll('error');
  const states = actual.searchParams.getAll('state');
  if (errors.length !== 1 || states.length !== 1) return null;

  const errorCode = errors[0];
  const state = states[0];
  if (!errorCode || CONTROL_OR_SPACE.test(errorCode)) return null;
  if (state !== expectedState) return null;

  return errorCode === 'access_denied' ? 'cancelled' : 'failed';
}

function isForeignOrStaleCallbackUrl(rawUrl, activeState) {
  if (typeof rawUrl !== 'string' && !(rawUrl instanceof URL)) return false;
  const urlText = typeof rawUrl === 'string' ? rawUrl : rawUrl.href;
  if (!urlText) return false;

  let actual;
  try {
    actual = new URL(urlText);
  } catch {
    return false;
  }

  const states = actual.searchParams.getAll('state');
  if (states.includes(activeState)) {
    return false;
  }

  if (actual.searchParams.has('product') && actual.searchParams.get('product') !== PLATFORM_PRODUCT) {
    return true;
  }

  if (states.length >= 1 && states.every(Boolean)) {
    return true;
  }
  return false;
}

export function clearPlatformLoginIntent(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  let removed = false;
  try {
    storage.removeItem(PLATFORM_LOGIN_INTENT);
    removed = true;
  } catch {
    return false;
  }
  try {
    storage.removeItem(PLATFORM_RESUME_SUBJECT_KEY);
  } catch {
    // 보조 자동 복귀 결속 정보 정리는 최선 노력으로 수행한다.
  }
  return removed;
}

export function hasPlatformAutoLoginAttempt(storage) {
  if (!storage || typeof storage.getItem !== 'function') return false;
  try {
    const raw = storage.getItem(PLATFORM_AUTO_LOGIN_ATTEMPT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed.v === 1 && Number.isFinite(parsed.at));
  } catch {
    return true;
  }
}

export function markPlatformAutoLoginAttempt(storage, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { now = Date.now() } = opts;
  if (!storage || typeof storage.setItem !== 'function') return false;
  const at = Number.isFinite(now) ? now : Date.now();
  try {
    storage.setItem(PLATFORM_AUTO_LOGIN_ATTEMPT_KEY, JSON.stringify({ v: 1, at }));
    return true;
  } catch {
    return false;
  }
}

export function clearPlatformAutoLoginAttempt(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(PLATFORM_AUTO_LOGIN_ATTEMPT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isPlatformAutoLoginPaused(storage) {
  if (!storage || typeof storage.getItem !== 'function') return false;
  try {
    const raw = storage.getItem(PLATFORM_AUTO_LOGIN_PAUSE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed.v === 1 && parsed.paused === true);
  } catch {
    return false;
  }
}

export function pausePlatformAutoLogin(storage) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(PLATFORM_AUTO_LOGIN_PAUSE_KEY, JSON.stringify({ v: 1, paused: true }));
    return true;
  } catch {
    return false;
  }
}

export function clearPlatformAutoLoginPause(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(PLATFORM_AUTO_LOGIN_PAUSE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function markPlatformResumeAccountSwitch(storage, expectedState, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { now = Date.now() } = opts;
  if (
    !storage
    || typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
    || typeof expectedState !== 'string'
    || !STATE_PATTERN.test(expectedState)
  ) {
    return false;
  }
  try {
    const rawIntent = storage.getItem(PLATFORM_LOGIN_INTENT);
    const rawResume = storage.getItem(PLATFORM_RESUME_SUBJECT_KEY);
    if (!rawIntent || !rawResume) return false;
    const validIntent = validateIntentRecord(JSON.parse(rawIntent), now);
    if (!validIntent || validIntent.method !== PLATFORM_RESUME_METHOD || validIntent.state !== expectedState) {
      return false;
    }
    const validResume = validateResumeSubjectRecord(JSON.parse(rawResume), validIntent, now);
    if (!validResume) return false;
    storage.setItem(PLATFORM_RESUME_SUBJECT_KEY, JSON.stringify({
      v: 1,
      state: validResume.state,
      subject: validResume.subject,
      createdAt: validResume.createdAt,
      switchRequested: true,
    }));
    return true;
  } catch {
    return false;
  }
}

export function rememberPlatformLogin(storage, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { config, method, subject = null, returnHash = '', now = Date.now() } = opts;

  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new Error('브라우저 저장 공간을 사용할 수 없어요. 다시 로그인해 주세요.');
  }

  clearPlatformLoginIntent(storage);
  try {
    storage.removeItem(PLATFORM_LOGIN_NOTICE);
  } catch {
    // 이전 안내 표지 정리는 최선 노력으로 수행한다.
  }

  if (!Number.isFinite(now)) {
    throw new Error('로그인 시작 시각을 확인하지 못했어요. 다시 시작해 주세요.');
  }
  const isResume = method === PLATFORM_RESUME_METHOD;
  if (!PLATFORM_LOGIN_METHODS.includes(method) && !isResume) {
    throw new Error('지원하지 않는 로그인 방식이에요.');
  }
  if (isResume && !isValidResumeSubject(subject)) {
    throw new Error('확인된 계정 정보가 없어 자동 연결을 시작하지 못했어요.');
  }

  const canonicalRoute = normalizePlatformReturnHash(returnHash);
  if (!canonicalRoute) {
    throw new Error('플랫폼 화면 안의 경로만 돌아갈 수 있어요.');
  }

  const client = readValidPlatformClient(config);
  if (!client) {
    throw new Error('이 화면의 로그인 설정이 아직 없어요.');
  }

  let pending;
  try {
    const rawPending = storage.getItem(PLATFORM_PENDING_KEY);
    pending = rawPending ? JSON.parse(rawPending) : null;
  } catch {
    throw new Error('로그인을 다시 시작해 주세요.');
  }

  if (!validatePendingTransaction(pending, client, now)) {
    throw new Error('로그인을 다시 시작해 주세요.');
  }

  const intent = Object.freeze({
    v: 1,
    product: PLATFORM_PRODUCT,
    state: pending.state,
    clientId: client.clientId,
    redirectUri: client.redirectUri,
    createdAt: pending.createdAt,
    method,
    route: canonicalRoute,
  });

  try {
    storage.setItem(PLATFORM_LOGIN_INTENT, JSON.stringify(intent));
    if (isResume) {
      storage.setItem(PLATFORM_RESUME_SUBJECT_KEY, JSON.stringify({
        v: 1,
        state: pending.state,
        subject,
        createdAt: pending.createdAt,
      }));
    }
  } catch {
    clearPlatformLoginIntent(storage);
    throw new Error('브라우저가 저장 공간을 막아 로그인 준비를 마치지 못했어요.');
  }

  return intent;
}

export function platformCallbackIntent(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { storage, url, product, config, now = Date.now() } = opts;

  if (!storage || typeof storage.getItem !== 'function' || typeof storage.removeItem !== 'function') {
    return null;
  }

  let rawIntent;
  try {
    rawIntent = storage.getItem(PLATFORM_LOGIN_INTENT);
  } catch {
    clearPlatformLoginIntent(storage);
    return null;
  }

  if (!rawIntent) return null;

  const clearAndNull = () => {
    clearPlatformLoginIntent(storage);
    return null;
  };

  if (!Number.isFinite(now)) {
    return null;
  }

  let parsedIntent;
  try {
    parsedIntent = JSON.parse(rawIntent);
  } catch {
    return clearAndNull();
  }

  const validIntent = validateIntentRecord(parsedIntent, now);
  if (!validIntent) {
    return clearAndNull();
  }

  // 다른 제품의 콜백은 현재 유효한 플랫폼 진행 중 의도를 지우지 않고 무시한다.
  if (product !== PLATFORM_PRODUCT) {
    return null;
  }

  const client = readValidPlatformClient(config);
  if (!client) {
    return clearAndNull();
  }

  let pending;
  try {
    const rawPending = storage.getItem(PLATFORM_PENDING_KEY);
    pending = rawPending ? JSON.parse(rawPending) : null;
  } catch {
    return clearAndNull();
  }

  if (!validatePendingTransaction(pending, client, now)) {
    return clearAndNull();
  }

  if (
    validIntent.state !== pending.state
    || validIntent.clientId !== pending.clientId
    || validIntent.clientId !== client.clientId
    || validIntent.redirectUri !== pending.redirectUri
    || validIntent.redirectUri !== client.redirectUri
    || validIntent.createdAt !== pending.createdAt
  ) {
    return clearAndNull();
  }

  // 현재 유효한 요청과 다른 과거 요청의 state이거나 다른 제품 쿼리이면 새 의도와 pending을 보존한다.
  if (isForeignOrStaleCallbackUrl(url, pending.state)) {
    return null;
  }

  if (!callbackUrlMatchesPlatform(url, client.expectedUrl, pending.state)) {
    return clearAndNull();
  }

  return validIntent;
}

export function finishPlatformLogin(storage, intent, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { now = Date.now() } = opts;

  if (!storage || typeof storage.getItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new Error('브라우저 저장 공간을 확인하지 못했어요. 다시 로그인해 주세요.');
  }

  let rawLive;
  try {
    rawLive = storage.getItem(PLATFORM_LOGIN_INTENT);
  } catch {
    throw new Error('로그인 연결 정보를 읽지 못했어요. 다시 시작해 주세요.');
  }

  if (!rawLive) {
    throw new Error('로그인 연결이 바뀌었어요. 다시 시작해 주세요.');
  }

  let parsedLive;
  try {
    parsedLive = JSON.parse(rawLive);
  } catch {
    clearPlatformLoginIntent(storage);
    throw new Error('로그인 연결이 바뀌었어요. 다시 시작해 주세요.');
  }

  const validLive = validateIntentRecord(parsedLive, now);
  if (!validLive) {
    clearPlatformLoginIntent(storage);
    throw new Error('로그인 연결이 만료되었거나 바뀌었어요. 다시 시작해 주세요.');
  }

  const capturedState = intent && typeof intent === 'object' && typeof intent.state === 'string'
    ? intent.state
    : null;

  // 저장된 의도가 새로 시작된 다른 요청 소유이면 새 의도를 지우지 않고 이전 복귀만 거절한다.
  if (capturedState !== validLive.state) {
    throw new Error('로그인 연결이 바뀌었어요. 다시 시작해 주세요.');
  }

  const validCaptured = validateIntentRecord(intent, now);
  if (
    !validCaptured
    || validLive.v !== validCaptured.v
    || validLive.product !== validCaptured.product
    || validLive.state !== validCaptured.state
    || validLive.clientId !== validCaptured.clientId
    || validLive.redirectUri !== validCaptured.redirectUri
    || validLive.createdAt !== validCaptured.createdAt
    || validLive.method !== validCaptured.method
    || validLive.route !== validCaptured.route
  ) {
    clearPlatformLoginIntent(storage);
    throw new Error('로그인 연결이 만료되었거나 바뀌었어요. 다시 시작해 주세요.');
  }

  // 토큰 교환 사이에 새 OAuth pending이 먼저 기록된 경우에도 이전 복귀를 거절한다.
  let rawPending = null;
  try {
    rawPending = storage.getItem(PLATFORM_PENDING_KEY);
  } catch {
    throw new Error('로그인 연결 정보를 확인하지 못했어요. 다시 시작해 주세요.');
  }
  if (rawPending) {
    let latestPending = null;
    try {
      latestPending = JSON.parse(rawPending);
    } catch {
      latestPending = null;
    }
    if (!latestPending || latestPending.state !== validCaptured.state) {
      clearPlatformLoginIntent(storage);
      throw new Error('로그인 연결이 바뀌었어요. 다시 시작해 주세요.');
    }
  }

  const removed = clearPlatformLoginIntent(storage);
  if (!removed) {
    throw new Error('로그인 상태를 정리하지 못했어요. 다시 시작해 주세요.');
  }

  const canonicalHash = CANONICAL_HASH_MAP.get(validLive.route);
  if (!canonicalHash) {
    throw new Error('돌아갈 플랫폼 경로를 확인하지 못했어요.');
  }

  return `${PLATFORM_RETURN_ENTRY}${canonicalHash}`;
}

export function platformErrorCallbackIntent(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { storage, url, product, config, now = Date.now() } = opts;

  if (!storage || typeof storage.getItem !== 'function' || typeof storage.removeItem !== 'function') {
    return null;
  }

  let rawIntent;
  try {
    rawIntent = storage.getItem(PLATFORM_LOGIN_INTENT);
  } catch {
    clearPlatformLoginIntent(storage);
    return null;
  }

  if (!rawIntent) return null;

  const clearAndNull = () => {
    clearPlatformLoginIntent(storage);
    return null;
  };

  if (!Number.isFinite(now)) {
    return null;
  }

  let parsedIntent;
  try {
    parsedIntent = JSON.parse(rawIntent);
  } catch {
    return clearAndNull();
  }

  const validIntent = validateIntentRecord(parsedIntent, now);
  if (!validIntent) {
    return clearAndNull();
  }

  if (product !== PLATFORM_PRODUCT) {
    return null;
  }

  const client = readValidPlatformClient(config);
  if (!client || !hasRegisteredPlatformProductQuery(client.expectedUrl)) {
    return clearAndNull();
  }

  let pending;
  try {
    const rawPending = storage.getItem(PLATFORM_PENDING_KEY);
    pending = rawPending ? JSON.parse(rawPending) : null;
  } catch {
    return clearAndNull();
  }

  if (!validatePendingTransaction(pending, client, now)) {
    return clearAndNull();
  }

  if (
    validIntent.state !== pending.state
    || validIntent.clientId !== pending.clientId
    || validIntent.clientId !== client.clientId
    || validIntent.redirectUri !== pending.redirectUri
    || validIntent.redirectUri !== client.redirectUri
    || validIntent.createdAt !== pending.createdAt
  ) {
    return clearAndNull();
  }

  if (isForeignOrStaleCallbackUrl(url, pending.state)) {
    return null;
  }

  if (isSuccessCodeCandidateWithoutError(url)) {
    return null;
  }

  const kind = errorCallbackUrlMatchesPlatform(url, client.expectedUrl, pending.state);
  if (!kind) {
    return clearAndNull();
  }

  const canonicalHash = CANONICAL_HASH_MAP.get(validIntent.route);
  if (!canonicalHash) {
    return clearAndNull();
  }

  return Object.freeze({
    kind,
    state: validIntent.state,
    route: canonicalHash,
    destination: `${PLATFORM_RETURN_ENTRY}${canonicalHash}`,
  });
}

export function finishPlatformErrorReturn(storage, errorIntent, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { now = Date.now() } = opts;

  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new Error('브라우저 저장 공간을 확인하지 못했어요. 다시 로그인해 주세요.');
  }
  if (!Number.isFinite(now)) {
    throw new Error('로그인 연결 시각을 확인하지 못했어요. 다시 시작해 주세요.');
  }
  if (
    !errorIntent
    || typeof errorIntent !== 'object'
    || !Object.prototype.hasOwnProperty.call(STATIC_LOGIN_NOTICES, errorIntent.kind)
    || typeof errorIntent.state !== 'string'
    || !STATE_PATTERN.test(errorIntent.state)
  ) {
    throw new Error('로그인 연결 정보를 확인하지 못했어요. 다시 시작해 주세요.');
  }

  const canonicalHash = CANONICAL_HASH_MAP.get(errorIntent.route);
  if (!canonicalHash) {
    throw new Error('돌아갈 플랫폼 경로를 확인하지 못했어요.');
  }

  let rawLive;
  let rawPending;
  try {
    rawLive = storage.getItem(PLATFORM_LOGIN_INTENT);
    rawPending = storage.getItem(PLATFORM_PENDING_KEY);
  } catch {
    throw new Error('로그인 연결 정보를 읽지 못했어요. 다시 시작해 주세요.');
  }

  if (!rawLive || !rawPending) {
    throw new Error('로그인 연결이 바뀌었어요. 다시 시작해 주세요.');
  }

  let parsedLive;
  let parsedPending;
  try {
    parsedLive = JSON.parse(rawLive);
    parsedPending = JSON.parse(rawPending);
  } catch {
    throw new Error('로그인 연결이 바뀌었어요. 다시 시작해 주세요.');
  }

  if (
    parsedLive?.state !== errorIntent.state
    || parsedPending?.state !== errorIntent.state
  ) {
    // 그사이에 새 요청이 먼저 기록된 경우 새 의도와 새 pending을 보존하고 이전 취소만 거절한다.
    throw new Error('로그인 연결이 바뀌었어요. 다시 시작해 주세요.');
  }

  const validLive = validateIntentRecord(parsedLive, now);
  if (!validLive || validLive.route !== canonicalHash) {
    clearPlatformLoginIntent(storage);
    throw new Error('로그인 연결이 만료되었거나 바뀌었어요. 다시 시작해 주세요.');
  }

  let shouldRecordNotice = validLive.method !== PLATFORM_RESUME_METHOD;
  if (validLive.method === PLATFORM_RESUME_METHOD) {
    try {
      const rawResume = storage.getItem(PLATFORM_RESUME_SUBJECT_KEY);
      const parsedResume = rawResume ? JSON.parse(rawResume) : null;
      const validResume = validateResumeSubjectRecord(parsedResume, validLive, now);
      shouldRecordNotice = validResume?.switchRequested === true;
    } catch {
      shouldRecordNotice = false;
    }
  }

  try {
    storage.removeItem(PLATFORM_LOGIN_INTENT);
    storage.removeItem(PLATFORM_RESUME_SUBJECT_KEY);
    storage.removeItem(PLATFORM_PENDING_KEY);
    if (storage.getItem(PLATFORM_LOGIN_INTENT) !== null || storage.getItem(PLATFORM_PENDING_KEY) !== null) {
      throw new Error('cleanup');
    }
  } catch {
    throw new Error('로그인 상태를 정리하지 못했어요. 다시 시작해 주세요.');
  }

  if (shouldRecordNotice) {
    const noticeRecord = { v: 1, kind: errorIntent.kind, createdAt: now };
    try {
      storage.setItem(PLATFORM_LOGIN_NOTICE, JSON.stringify(noticeRecord));
    } catch {
      // 복귀 안내 표지 기록이 막혀도 정적 경로 복귀는 진행한다.
    }
  }

  return `${PLATFORM_RETURN_ENTRY}${canonicalHash}`;
}

export function takePlatformLoginNotice(storage = globalThis.sessionStorage, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { now = Date.now() } = opts;

  if (!storage || typeof storage.getItem !== 'function' || typeof storage.removeItem !== 'function') {
    return null;
  }

  let raw;
  try {
    raw = storage.getItem(PLATFORM_LOGIN_NOTICE);
    storage.removeItem(PLATFORM_LOGIN_NOTICE);
  } catch {
    try {
      storage.removeItem(PLATFORM_LOGIN_NOTICE);
    } catch {
      // 저장소 접근이 막힌 경우 정적 null로 닫는다.
    }
    return null;
  }

  if (!raw || !Number.isFinite(now)) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !hasExactKeys(parsed, NOTICE_KEYS)
    || parsed.v !== 1
    || !Object.prototype.hasOwnProperty.call(STATIC_LOGIN_NOTICES, parsed.kind)
    || !isValidTimestamp(parsed.createdAt, now)
  ) {
    return null;
  }

  return STATIC_LOGIN_NOTICES[parsed.kind];
}

export function readBoundPlatformLoginIntent(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { storage, config, now = Date.now() } = opts;

  if (!storage || typeof storage.getItem !== 'function' || !Number.isFinite(now)) {
    return null;
  }

  const client = readValidPlatformClient(config);
  if (!client || !hasRegisteredPlatformProductQuery(client.expectedUrl)) {
    return null;
  }

  let parsedIntent;
  let pending;
  try {
    const rawIntent = storage.getItem(PLATFORM_LOGIN_INTENT);
    const rawPending = storage.getItem(PLATFORM_PENDING_KEY);
    if (!rawIntent || !rawPending) return null;
    parsedIntent = JSON.parse(rawIntent);
    pending = JSON.parse(rawPending);
  } catch {
    return null;
  }

  const validIntent = validateIntentRecord(parsedIntent, now);
  if (!validIntent || !validatePendingTransaction(pending, client, now)) {
    return null;
  }

  if (
    validIntent.state !== pending.state
    || validIntent.clientId !== pending.clientId
    || validIntent.clientId !== client.clientId
    || validIntent.redirectUri !== pending.redirectUri
    || validIntent.redirectUri !== client.redirectUri
    || validIntent.createdAt !== pending.createdAt
  ) {
    return null;
  }

  let resumeSubject = null;
  if (validIntent.method === PLATFORM_RESUME_METHOD) {
    try {
      const rawResume = storage.getItem(PLATFORM_RESUME_SUBJECT_KEY);
      if (!rawResume) return null;
      const validResume = validateResumeSubjectRecord(JSON.parse(rawResume), validIntent, now);
      if (!validResume) return null;
      resumeSubject = validResume.subject;
    } catch {
      return null;
    }
  }

  return Object.freeze({ intent: validIntent, client, resumeSubject });
}

export function buildPlatformCancelUrl(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { config, state } = opts;

  if (typeof state !== 'string' || !STATE_PATTERN.test(state)) {
    return null;
  }
  const client = readValidPlatformClient(config);
  if (!client || !hasRegisteredPlatformProductQuery(client.expectedUrl)) {
    return null;
  }

  const cancel = new URL(client.expectedUrl.href);
  cancel.searchParams.set('error', 'access_denied');
  cancel.searchParams.set('state', state);
  return cancel.href;
}

export function matchPlatformPreauthorizedRedirect(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { targetUrl, storage, config, now = Date.now() } = opts;

  const bound = readBoundPlatformLoginIntent({ storage, config, now });
  if (!bound) return null;

  if (!callbackUrlMatchesPlatform(targetUrl, bound.client.expectedUrl, bound.intent.state)) {
    return null;
  }

  const cancelUrl = buildPlatformCancelUrl({ config, state: bound.intent.state });
  if (!cancelUrl) return null;

  const approveUrl = new URL(typeof targetUrl === 'string' ? targetUrl : targetUrl.href).href;
  return Object.freeze({
    intent: bound.intent,
    resumeSubject: bound.resumeSubject,
    approveUrl,
    cancelUrl,
    shownDestination: bound.client.expectedUrl.href,
    expiresAt: bound.intent.createdAt + PLATFORM_LOGIN_TTL_MS,
  });
}

export function matchPlatformAuthorizationDetails(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const { details, storage, config, now = Date.now() } = opts;

  const bound = readBoundPlatformLoginIntent({ storage, config, now });
  if (!bound || !details || typeof details !== 'object') return null;

  const nestedClientId = typeof details.client?.id === 'string' ? details.client.id : null;
  const flatClientId = typeof details.client_id === 'string' ? details.client_id : null;
  if (nestedClientId !== null && flatClientId !== null && nestedClientId !== flatClientId) {
    return null;
  }
  const detailClientId = nestedClientId ?? flatClientId;
  if (!detailClientId || detailClientId !== bound.intent.clientId || detailClientId !== bound.client.clientId) {
    return null;
  }

  if (typeof details.redirect_uri !== 'string' || !details.redirect_uri || details.redirect_uri.includes('#')) {
    return null;
  }
  const parsedRedirect = parseRegisteredPlatformRedirect(details.redirect_uri);
  if (!parsedRedirect || !hasRegisteredPlatformProductQuery(parsedRedirect)) {
    return null;
  }
  if (details.redirect_uri !== bound.intent.redirectUri || parsedRedirect.href !== bound.client.expectedUrl.href) {
    return null;
  }

  const cancelUrl = buildPlatformCancelUrl({ config, state: bound.intent.state });
  if (!cancelUrl) return null;

  return Object.freeze({
    intent: bound.intent,
    resumeSubject: bound.resumeSubject,
    cancelUrl,
    shownDestination: bound.client.expectedUrl.href,
    expiresAt: bound.intent.createdAt + PLATFORM_LOGIN_TTL_MS,
  });
}

function hasNewerForeignPending(storage, intentCreatedAt) {
  const candidateKeys = new Set(FOREIGN_PENDING_PRODUCTS.map(product => `synk.oauth.pending.${product}`));
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    try {
      const count = storage.length;
      for (let i = 0; i < count; i++) {
        const key = storage.key(i);
        if (typeof key === 'string' && key.startsWith('synk.oauth.pending.') && key !== PLATFORM_PENDING_KEY) {
          candidateKeys.add(key);
        }
      }
    } catch {
      // 열거가 막힌 저장소에서는 등록 제품 키 목록으로 확인한다.
    }
  }

  for (const key of candidateKeys) {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch {
      continue;
    }
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!Number.isFinite(parsed?.createdAt) || parsed.createdAt >= intentCreatedAt) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

export function resolvePlatformPortalEntryHint(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const {
    storage,
    config,
    authorizationId,
    requestSeen,
    hadCallback = false,
    url = '',
    now = Date.now(),
  } = opts;

  if (hadCallback) return null;
  if (typeof authorizationId !== 'string' || !authorizationId || CONTROL_OR_SPACE.test(authorizationId)) {
    return null;
  }

  if (url) {
    let parsedUrl;
    try {
      parsedUrl = typeof url === 'string' ? new URL(url) : url;
    } catch {
      return null;
    }
    const requestedView = parsedUrl.searchParams.get('view');
    if (requestedView && ['reset', 'recover', 'security'].includes(requestedView)) {
      return null;
    }
    const fragmentParams = new URLSearchParams(parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash);
    if (PORTAL_CALLBACK_OR_ERROR_PARAMS.some(param => parsedUrl.searchParams.has(param) || fragmentParams.has(param))) {
      return null;
    }
  }

  const bound = readBoundPlatformLoginIntent({ storage, config, now });
  if (!bound) return null;

  if (
    !Number.isFinite(requestSeen)
    || requestSeen < bound.intent.createdAt
    || requestSeen > now
    || requestSeen - bound.intent.createdAt > PLATFORM_PORTAL_HINT_WINDOW_MS
    || now - bound.intent.createdAt > PLATFORM_PORTAL_HINT_WINDOW_MS
  ) {
    return null;
  }

  if (hasNewerForeignPending(storage, bound.intent.createdAt)) {
    return null;
  }

  return Object.freeze({
    method: bound.intent.method,
    state: bound.intent.state,
    authorizationId,
    createdAt: bound.intent.createdAt,
  });
}
