import { beginOAuth } from './core.mjs';
import { PATH_INTERVIEW_URL } from './applications.mjs';
import { platformPublicEntry } from './platform-entry.mjs';
import { platformRoute } from './platform-home.mjs';
import { solioLegacyHash } from './platform-solio.mjs';
import { normalizePurposeOnboarding } from './platform-account.mjs';
import { createCompanyEntryTransport } from './company-entry-web.mjs';
import {
  PLATFORM_ALLOWED_HASHES,
  PLATFORM_LOGIN_INTENT,
  PLATFORM_LOGIN_METHODS,
  PLATFORM_LOGIN_NOTICE,
  PLATFORM_RESUME_METHOD,
  rememberPlatformLogin,
  clearPlatformLoginIntent,
  takePlatformLoginNotice,
  hasPlatformAutoLoginAttempt,
  markPlatformAutoLoginAttempt,
  isPlatformAutoLoginPaused,
  pausePlatformAutoLogin,
} from './platform-login-return.mjs';
import {
  mountPortalEntry,
  isPortalActive,
  PORTAL_SHIFT_URL,
  PORTAL_WORKSPACE_ITEMS,
  PORTAL_WORKSPACE_STATUSES,
  normalizePortalWorkspaceDestination,
  normalizePortalWorkspaceState,
  validatePortalInviteInput,
} from '../../../desktop/renderer/portal-entry.mjs';

export {
  isPortalActive,
  PORTAL_SHIFT_URL,
  PORTAL_WORKSPACE_ITEMS,
  PORTAL_WORKSPACE_STATUSES,
  normalizePortalWorkspaceDestination,
  normalizePortalWorkspaceState,
  validatePortalInviteInput,
};

export const PORTAL_COMPLETION_WAIT_MS = 350;

const SESSION_KEY = 'synk.oauth.session.platform';
const PENDING_OAUTH_KEY = 'synk.oauth.pending.platform';
const ALLOWED_HASH_SET = new Set(PLATFORM_ALLOWED_HASHES);
const TIME_LIMIT_SENTINEL = Symbol('portal-completion-wait-limit');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIXED_UUID_PATTERN = /^[a-z0-9._-]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const CANONICAL_PREFIXED_UUID_PATTERN = /^(?:synk|account):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const FOCUSABLE_IN_PORTAL = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisibleElement(node) {
  if (!node || node.hidden) return false;
  let cursor = node;
  while (cursor && cursor.nodeType === 1) {
    if (cursor.hidden || cursor.getAttribute?.('aria-hidden') === 'true') return false;
    cursor = cursor.parentElement;
  }
  return true;
}

function isEditablePortalField(node, root) {
  if (!node || !root?.contains?.(node)) return false;
  const tag = typeof node.tagName === 'string' ? node.tagName.toUpperCase() : '';
  return Boolean(node.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
}

function staleAuthIntentError() {
  return Object.assign(new Error('로그인 요청이 취소되었거나 새 요청으로 바뀌었어요.'), {
    code: 'STALE_AUTH_INTENT',
  });
}

export function isExplicitPlatformRouteHash(rawHash = '') {
  if (typeof rawHash !== 'string') return false;
  const trimmed = rawHash.trim();
  if (!trimmed || trimmed === '#' || trimmed === '#home') return false;
  const legacy = solioLegacyHash(trimmed);
  const candidate = legacy || (trimmed.startsWith('#') ? trimmed : `#${trimmed}`);
  const parsed = platformRoute(candidate);
  return parsed.page !== 'home' || Boolean(parsed.query);
}

export function normalizePortalReturnHash(rawHash = '') {
  if (typeof rawHash !== 'string') return '#home';
  const trimmed = rawHash.trim();
  if (!trimmed || trimmed === '#') return '#home';
  const legacy = solioLegacyHash(trimmed);
  if (legacy && ALLOWED_HASH_SET.has(legacy)) return legacy;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const [withoutQuery = '#home'] = withHash.split(/[?]/, 1);
  const [singleHash = ''] = withoutQuery.slice(1).split('#', 1);
  if (!singleHash) return '#home';
  const candidate = `#${singleHash}`;
  if (ALLOWED_HASH_SET.has(candidate)) return candidate;
  const parsed = platformRoute(candidate);
  const pageHash = `#${parsed.page}`;
  return ALLOWED_HASH_SET.has(pageHash) ? pageHash : '#home';
}

export function resolveWebPurposeTarget(purposeId, { identity = null } = {}) {
  if (purposeId === 'shift') {
    return {
      id: 'shift',
      kind: 'new-tab',
      external: true,
      href: PORTAL_SHIFT_URL,
      trackAppId: null,
    };
  }
  if (purposeId === 'world') {
    const verifiedIdentity = identity?.signedIn === true && identity.status === 'signed-in' ? identity : null;
    return {
      id: 'world',
      kind: 'new-tab',
      external: true,
      href: platformPublicEntry('world', verifiedIdentity),
      trackAppId: 'world',
    };
  }
  if (purposeId === 'path') {
    return {
      id: 'path',
      kind: 'same-tab',
      external: false,
      href: PATH_INTERVIEW_URL,
      trackAppId: 'path',
    };
  }
  if (purposeId === 'solio') {
    return {
      id: 'solio',
      kind: 'hash',
      external: false,
      hash: '#solio',
      trackAppId: null,
    };
  }
  if (purposeId === 'home') {
    return {
      id: 'home',
      kind: 'hash',
      external: false,
      hash: '#home',
      trackAppId: null,
    };
  }
  return null;
}

export function normalizeWebPortalAuth(identity, { startupState = null, generation = 1, reducedMotion } = {}) {
  const motionField = typeof reducedMotion === 'boolean' ? { reducedMotion } : {};
  const source = identity && typeof identity === 'object' ? identity : null;
  const fallback = startupState && typeof startupState === 'object' ? startupState : null;

  const rawStatus = source?.status || fallback?.status || 'restoring';
  const verifiedAccountId = source?.signedIn === true
    && source.status === 'signed-in'
    && typeof source.accountId === 'string'
    && source.accountId.trim()
    ? source.accountId.trim()
    : null;
  const boundAccountKey = typeof source?.accountKey === 'string' && source.accountKey.trim()
    ? source.accountKey.trim()
    : null;

  if (rawStatus === 'unconfigured') {
    return {
      status: 'unconfigured',
      generation,
      accountKey: null,
      onboarding: { purpose: 'none' },
      errorMessage: fallback?.message || '이 화면에는 로그인 설정이 아직 없어요. 앱과 혜택은 로그인 없이 볼 수 있어요.',
      retryable: false,
      ...motionField,
    };
  }

  if (rawStatus === 'signed-in') {
    if (!verifiedAccountId) {
      return {
        status: 'error',
        generation,
        accountKey: null,
        onboarding: { purpose: 'none' },
        errorMessage: '계정 식별 정보를 확인하지 못했어요. 다시 시도해 주세요.',
        retryable: true,
        ...motionField,
      };
    }
    return {
      status: 'signed-in',
      generation,
      accountKey: verifiedAccountId,
      onboarding: {
        purpose: normalizePurposeOnboarding(source?.onboarding),
      },
      ...motionField,
    };
  }

  if (rawStatus === 'restoring' || rawStatus === 'loading') {
    return {
      status: 'restoring',
      generation,
      ...(boundAccountKey ? { accountKey: boundAccountKey } : {}),
      onboarding: { purpose: 'none' },
      ...motionField,
    };
  }

  if (rawStatus === 'signing-in') {
    return {
      status: 'signing-in',
      generation,
      ...(boundAccountKey ? { accountKey: boundAccountKey } : {}),
      onboarding: { purpose: 'none' },
      ...motionField,
    };
  }

  if (rawStatus === 'error') {
    const errorMessage = source?.error?.message
      || fallback?.message
      || '계정 서버에 닿지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    const retryable = source?.error ? source.error.retryable !== false : true;
    return {
      status: 'error',
      generation,
      ...(boundAccountKey ? { accountKey: boundAccountKey } : retryable ? {} : { accountKey: null }),
      onboarding: { purpose: 'none' },
      errorMessage,
      retryable,
      ...motionField,
    };
  }

  return {
    status: 'signed-out',
    generation,
    accountKey: null,
    onboarding: { purpose: 'none' },
    errorMessage: '',
    retryable: false,
    ...motionField,
  };
}

function extractUuidString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (UUID_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const prefixed = PREFIXED_UUID_PATTERN.exec(trimmed);
  if (prefixed) {
    return prefixed[1].toLowerCase();
  }
  return null;
}

function decodeBase64UrlUtf8(segment) {
  if (typeof segment !== 'string' || !segment) return null;
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  try {
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      if (typeof TextDecoder === 'function') {
        return new TextDecoder().decode(bytes);
      }
      return binary;
    }
    if (typeof globalThis.Buffer?.from === 'function') {
      return globalThis.Buffer.from(padded, 'base64').toString('utf8');
    }
  } catch {
    return null;
  }
  return null;
}

function decodeJwtSubUuid(rawToken) {
  if (typeof rawToken !== 'string') return null;
  const parts = rawToken.trim().split('.');
  if (parts.length !== 3) return null;
  const jsonText = decodeBase64UrlUtf8(parts[1]);
  if (!jsonText) return null;
  try {
    const payload = JSON.parse(jsonText);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return extractUuidString(payload.sub);
  } catch {
    return null;
  }
}

function extractCanonicalUuidString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (UUID_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const prefixed = CANONICAL_PREFIXED_UUID_PATTERN.exec(trimmed);
  if (prefixed) {
    return prefixed[1].toLowerCase();
  }
  return null;
}

function collectConsistentUuid(candidates) {
  let found = null;
  for (const item of candidates) {
    const parsed = extractUuidString(item);
    if (!parsed) continue;
    if (found === null) {
      found = parsed;
    } else if (found !== parsed) {
      return { uuid: null, conflict: true };
    }
  }
  return { uuid: found, conflict: false };
}

function collectCanonicalSynkIdentity(candidates) {
  let token = null;
  let uuid = null;
  for (const item of candidates) {
    if (item === null || item === undefined) continue;
    if (typeof item !== 'string') {
      return { token: null, uuid: null, conflict: true };
    }
    const trimmed = item.trim();
    if (!trimmed) continue;
    const parsedUuid = extractCanonicalUuidString(trimmed);
    const normalizedToken = parsedUuid || trimmed;
    if (token === null) {
      token = normalizedToken;
      uuid = parsedUuid;
    } else if (token !== normalizedToken) {
      return { token: null, uuid: null, conflict: true };
    }
  }
  return { token, uuid, conflict: false };
}

function extractNormalizedEmail(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : '';
}

function hasNonEmptyTokenString(record, keys) {
  if (!isPlainBindingRecord(record)) return false;
  return keys.some(key => typeof record[key] === 'string' && record[key].trim().length > 0);
}

function hasMalformedExplicitAccessToken(record) {
  if (!isPlainBindingRecord(record)) return false;
  for (const key of ['access_token', 'accessToken']) {
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined) {
      if (typeof record[key] !== 'string' || !record[key].trim()) {
        return true;
      }
    }
  }
  return false;
}

function hasValidStoredSessionShape(
  parsedSession,
  { hasCanonicalToken = false, hasAuthUuid = false } = {},
) {
  if (!isPlainBindingRecord(parsedSession)) return false;
  if (
    parsedSession.session !== undefined
    && parsedSession.session !== null
    && !isPlainBindingRecord(parsedSession.session)
  ) {
    return false;
  }
  if (
    parsedSession.user !== undefined
    && parsedSession.user !== null
    && !isPlainBindingRecord(parsedSession.user)
  ) {
    return false;
  }
  if (
    parsedSession.session?.user !== undefined
    && parsedSession.session?.user !== null
    && !isPlainBindingRecord(parsedSession.session.user)
  ) {
    return false;
  }
  if (
    hasMalformedExplicitAccessToken(parsedSession)
    || hasMalformedExplicitAccessToken(parsedSession.session)
  ) {
    return false;
  }
  const tokenKeys = ['access_token', 'accessToken', 'id_token', 'idToken'];
  const hasToken =
    hasNonEmptyTokenString(parsedSession, tokenKeys)
    || hasNonEmptyTokenString(parsedSession.session, tokenKeys);
  return hasToken || hasCanonicalToken || hasAuthUuid;
}

export function extractVerifiedSynkId({
  identity,
  rawSessionString = null,
  account = null,
  isAccountBound = null,
  storageError = false,
} = {}) {
  if (storageError === true) {
    return { synkId: null, mismatch: true };
  }
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    return { synkId: null, mismatch: false };
  }
  if (identity.signedIn !== true || identity.status !== 'signed-in') {
    return { synkId: null, mismatch: false };
  }
  if (
    (identity.user !== undefined && identity.user !== null && !isPlainBindingRecord(identity.user))
    || (identity.account !== undefined && identity.account !== null && !isPlainBindingRecord(identity.account))
  ) {
    return { synkId: null, mismatch: true };
  }
  if (
    isAccountBound === false
    || (
      account !== null
      && account !== undefined
      && (
        typeof account !== 'object'
        || (
          account.isAccountBound !== undefined
          && account.isAccountBound !== null
          && typeof account.isAccountBound !== 'function'
        )
      )
    )
  ) {
    return { synkId: null, mismatch: true };
  }

  const identityCanonical = collectCanonicalSynkIdentity([
    identity.synkId,
    identity.synk_user_id,
    identity.accountId,
    identity.accountKey,
    identity.user?.synkId,
    identity.user?.synk_user_id,
    identity.user?.accountId,
    identity.account?.synk_user_id,
    identity.account?.synkId,
    identity.account?.accountId,
  ]);
  if (
    identityCanonical.conflict
    || !identityCanonical.token
    || identityCanonical.token === 'anonymous-local'
  ) {
    return { synkId: null, mismatch: true };
  }

  const boundCheckFn = typeof isAccountBound === 'function'
    ? isAccountBound
    : typeof account?.isAccountBound === 'function'
      ? id => account.isAccountBound(id)
      : null;

  let isProvenBound = false;
  if (boundCheckFn) {
    const rawAccountId = typeof identity.accountId === 'string' && identity.accountId.trim()
      ? identity.accountId.trim()
      : identityCanonical.token;
    let boundOk = false;
    try {
      boundOk = boundCheckFn(rawAccountId) === true;
    } catch {
      boundOk = false;
    }
    if (!boundOk) {
      return { synkId: null, mismatch: true };
    }
    isProvenBound = true;
  }

  const identityAuthScan = collectConsistentUuid([
    identity.userId,
    identity.sub,
    identity.user?.id,
    identity.user?.sub,
  ]);
  if (identityAuthScan.conflict) {
    return { synkId: null, mismatch: true };
  }
  if (
    !isProvenBound
    && identityAuthScan.uuid
    && (!identityCanonical.uuid || identityAuthScan.uuid !== identityCanonical.uuid)
  ) {
    return { synkId: null, mismatch: true };
  }

  if (rawSessionString === null || rawSessionString === undefined) {
    return { synkId: identityCanonical.uuid, mismatch: false };
  }

  if (typeof rawSessionString !== 'string' || !rawSessionString.trim()) {
    return { synkId: null, mismatch: true };
  }

  let parsedSession = null;
  try {
    parsedSession = JSON.parse(rawSessionString);
  } catch {
    return { synkId: null, mismatch: true };
  }

  if (!isPlainBindingRecord(parsedSession)) {
    return { synkId: null, mismatch: true };
  }

  const sessionCanonical = collectCanonicalSynkIdentity([
    parsedSession.synkId,
    parsedSession.synk_user_id,
    parsedSession.accountId,
    parsedSession.accountKey,
    parsedSession.user?.synkId,
    parsedSession.user?.synk_user_id,
    parsedSession.user?.accountId,
    parsedSession.session?.synkId,
    parsedSession.session?.synk_user_id,
    parsedSession.session?.accountId,
    parsedSession.session?.accountKey,
  ]);
  if (sessionCanonical.conflict) {
    return { synkId: null, mismatch: true };
  }
  if (sessionCanonical.token && sessionCanonical.token !== identityCanonical.token) {
    return { synkId: null, mismatch: true };
  }

  const sessionAuthScan = collectConsistentUuid([
    parsedSession.userId,
    parsedSession.sub,
    parsedSession.user?.id,
    parsedSession.user?.sub,
    parsedSession.session?.userId,
    parsedSession.session?.sub,
    parsedSession.session?.user?.id,
    parsedSession.session?.user?.sub,
    decodeJwtSubUuid(parsedSession.idToken),
    decodeJwtSubUuid(parsedSession.id_token),
    decodeJwtSubUuid(parsedSession.accessToken),
    decodeJwtSubUuid(parsedSession.access_token),
    decodeJwtSubUuid(parsedSession.session?.idToken),
    decodeJwtSubUuid(parsedSession.session?.id_token),
    decodeJwtSubUuid(parsedSession.session?.accessToken),
    decodeJwtSubUuid(parsedSession.session?.access_token),
  ]);
  if (sessionAuthScan.conflict) {
    return { synkId: null, mismatch: true };
  }
  if (
    identityAuthScan.uuid
    && sessionAuthScan.uuid
    && identityAuthScan.uuid !== sessionAuthScan.uuid
  ) {
    return { synkId: null, mismatch: true };
  }

  if (!hasValidStoredSessionShape(parsedSession, {
    hasCanonicalToken: Boolean(sessionCanonical.token),
    hasAuthUuid: Boolean(sessionAuthScan.uuid),
  })) {
    return { synkId: null, mismatch: true };
  }

  if (!isProvenBound) {
    if (
      sessionAuthScan.uuid
      && (!identityCanonical.uuid || sessionAuthScan.uuid !== identityCanonical.uuid)
    ) {
      return { synkId: null, mismatch: true };
    }

    const sessionEmail = extractNormalizedEmail(
      parsedSession.user?.email ?? parsedSession.email ?? parsedSession.session?.user?.email,
    );
    const liveEmail = extractNormalizedEmail(identity.email ?? identity.user?.email);
    if (sessionEmail && liveEmail && sessionEmail !== liveEmail) {
      return { synkId: null, mismatch: true };
    }

    if (!sessionCanonical.token && !sessionAuthScan.uuid) {
      return { synkId: null, mismatch: true };
    }
  }

  return {
    synkId: identityCanonical.uuid,
    mismatch: false,
  };
}

function generateMemoryUuid(cryptoRef) {
  const targetCrypto = cryptoRef || globalThis.crypto;
  if (targetCrypto && typeof targetCrypto.randomUUID === 'function') {
    const generated = targetCrypto.randomUUID();
    if (typeof generated === 'string' && UUID_PATTERN.test(generated)) {
      return generated.toLowerCase();
    }
  }
  if (targetCrypto && typeof targetCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    targetCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('암호화 난수 생성기를 사용할 수 없어요.');
}

function mapCompanyInviteErrorMessage(code) {
  switch (code) {
    case 'HANDOFF_UNCONFIRMED':
      return '초대 전달 완료 여부를 아직 확인하지 못했어요. 이미 열린 작업 공간 창에 초대가 반영되었는지 먼저 확인해 주세요.';
    case 'INVALID_INPUT':
      return '초대코드 형식이 올바르지 않아요. 전달받은 코드나 링크를 다시 확인해 주세요.';
    case 'INVITE_REJECTED':
      return '유효하지 않거나 만료된 초대코드예요. 전달받은 코드와 링크를 다시 확인해 주세요.';
    case 'HANDOFF_UNAVAILABLE':
      return '새 창 열기가 차단되어 초대 확인 창을 열지 못했어요. 브라우저에서 새 창을 허용한 뒤 다시 눌러 주세요.';
    case 'HANDOFF_TIMEOUT':
      return '작업 공간 응답 시간이 지났어요. 네트워크 연결을 확인한 뒤 다시 입력해 주세요.';
    case 'TEMPORARY_UNAVAILABLE':
      return '지금은 작업 공간 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    case 'RATE_LIMITED':
      return '초대 확인 요청이 잠시 몰렸어요. 조금 기다린 뒤 다시 입력해 주세요.';
    case 'ACCOUNT_CHANGED':
      return '진행 중 로그인 계정이 바뀌어 초대를 중단했어요. 계정을 확인한 뒤 다시 입력해 주세요.';
    case 'ACCOUNT_MISMATCH':
      return '열린 작업 공간의 계정과 지금 로그인한 계정이 달라요. 계정을 맞춘 뒤 다시 시도해 주세요.';
    case 'LOGIN_REQUIRED':
      return '작업 공간에서 로그인 확인이 필요해요. 열린 창에서 로그인을 마친 뒤 다시 시도해 주세요.';
    case 'CLIENT_FORBIDDEN':
      return '지금은 작업 공간 초대를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    case 'BUSY':
      return '이미 확인 중인 요청이 있어요. 잠시 뒤 다시 눌러 주세요.';
    case 'CANCELLED':
      return '열려 있던 초대 확인 창이 닫혀 진행을 멈췄어요. 코드를 확인한 뒤 다시 눌러 주세요.';
    default:
      return '초대코드를 확인하지 못했어요. 잠시 뒤 다시 입력해 주세요.';
  }
}

function sanitizeHostInviteMessage(candidateMessage, rawInput, normalizedInput, fallbackCode) {
  const fallback = mapCompanyInviteErrorMessage(fallbackCode);
  if (typeof candidateMessage !== 'string') {
    return fallback;
  }
  const trimmed = candidateMessage.trim();
  if (!trimmed) {
    return fallback;
  }
  const rawTrimmed = typeof rawInput === 'string' ? rawInput.trim() : '';
  if (rawTrimmed && trimmed.includes(rawTrimmed)) {
    return fallback;
  }
  if (typeof normalizedInput === 'string' && normalizedInput && trimmed.includes(normalizedInput)) {
    return fallback;
  }
  const marker = '#invite=';
  const markerIndex = typeof normalizedInput === 'string' ? normalizedInput.indexOf(marker) : -1;
  if (markerIndex >= 0) {
    const tokenPart = normalizedInput.slice(markerIndex + marker.length);
    if (tokenPart && trimmed.includes(tokenPart)) {
      return fallback;
    }
  }
  return trimmed;
}

function mapCompanyResolveErrorToWorkspace(
  code,
  { interactiveRecovery = false, previousStatus = null } = {},
) {
  if (code === 'LOGIN_REQUIRED') {
    return {
      status: 'login_required',
      destinations: [],
      unavailable: [],
      message: interactiveRecovery
        ? ''
        : '회사 작업 공간을 확인하려면 로그인이 필요해요. 아래 작업 공간 다시 확인을 눌러 로그인 창을 열어 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'ACCOUNT_MISMATCH') {
    return {
      status: 'account_mismatch',
      destinations: [],
      unavailable: [],
      message: interactiveRecovery
        ? ''
        : '작업 공간에 연결된 계정이 지금 로그인한 계정과 달라요. 아래 작업 공간 다시 확인을 눌러 계정을 맞춰 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'HANDOFF_UNAVAILABLE' && interactiveRecovery) {
    return {
      status: 'popup_blocked',
      destinations: [],
      unavailable: [],
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'CANCELLED') {
    if (
      interactiveRecovery
      && (previousStatus === 'login_required' || previousStatus === 'account_mismatch')
    ) {
      return {
        status: previousStatus,
        destinations: [],
        unavailable: [],
        message: '열려 있던 회사 공간 창이 닫혔어요. 아래 작업 공간 다시 확인을 눌러 창을 새로 열어 주세요.',
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: interactiveRecovery
        ? '확인 중이던 작업 공간 창이 닫혔어요. 아래 단추를 눌러 다시 확인해 주세요.'
        : '작업 공간 확인이 중단됐어요. 아래 단추를 눌러 다시 확인해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'HANDOFF_TIMEOUT') {
    if (
      interactiveRecovery
      && (previousStatus === 'login_required' || previousStatus === 'account_mismatch')
    ) {
      return {
        status: previousStatus,
        destinations: [],
        unavailable: [],
        message: '로그인 대기 시간이 지났어요. 아래 작업 공간 다시 확인을 눌러 다시 시도해 주세요.',
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: '작업 공간 응답 시간이 지났어요. 아래 단추를 눌러 다시 확인해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  if (code === 'RATE_LIMITED') {
    return {
      status: 'unavailable',
      destinations: [],
      unavailable: [],
      message: '확인 요청이 잠시 몰렸어요. 조금 기다린 뒤 다시 확인해 주세요.',
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }
  return {
    status: 'unavailable',
    destinations: [],
    unavailable: [],
    message: '지금은 작업 공간 연결을 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.',
    canSwitchAccount: true,
    canContinuePersonal: true,
  };
}

function extractInviteLinkPayload(href) {
  const checked = validatePortalInviteInput(href);
  if (!checked.ok || checked.kind !== 'link') {
    return { ok: false, checked };
  }
  const marker = '#invite=';
  const markerIndex = checked.value.indexOf(marker);
  const token = markerIndex >= 0 ? checked.value.slice(markerIndex + marker.length) : '';
  const expectedKind = checked.pathname === '/'
    ? 'employee'
    : checked.pathname === '/pulse-app/'
      ? 'customer'
      : null;
  if (!token || !expectedKind) {
    return { ok: false, checked };
  }
  return {
    ok: true,
    checked,
    token,
    expectedKind,
  };
}

function isPlainBindingRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function adaptWebCompanyBinding(rawBinding) {
  if (!isPlainBindingRecord(rawBinding)) {
    return null;
  }
  if (rawBinding.mismatch === true || rawBinding.disposed === true) {
    return null;
  }

  const hasExpected =
    Object.prototype.hasOwnProperty.call(rawBinding, 'expectedAccountId')
    && rawBinding.expectedAccountId !== undefined;
  const hasAccount =
    Object.prototype.hasOwnProperty.call(rawBinding, 'accountId')
    && rawBinding.accountId !== undefined;

  if (!hasExpected && !hasAccount) {
    return null;
  }
  if (hasExpected && hasAccount && rawBinding.expectedAccountId !== rawBinding.accountId) {
    return null;
  }

  const expectedAccountId = hasExpected ? rawBinding.expectedAccountId : rawBinding.accountId;
  if (rawBinding.validSignedIn === true && expectedAccountId === null) {
    return null;
  }

  const { accountGeneration } = rawBinding;
  if (typeof accountGeneration !== 'string' || !UUID_PATTERN.test(accountGeneration)) {
    return null;
  }
  if (
    expectedAccountId !== null
    && (typeof expectedAccountId !== 'string' || !UUID_PATTERN.test(expectedAccountId))
  ) {
    return null;
  }

  return {
    accountGeneration,
    expectedAccountId,
  };
}

export function createDefaultWebCompanyBoundaries({
  windowRef,
  cryptoRef,
  timers,
  pollIntervalMs,
  fetch: customFetch,
  location: customLocation,
  fetchTimeoutMs,
  getBinding,
  transport: injectedTransport = null,
} = {}) {
  let standaloneGeneration = null;
  const rawGetBinding = typeof getBinding === 'function'
    ? getBinding
    : () => {
      if (!standaloneGeneration) {
        standaloneGeneration = generateMemoryUuid(cryptoRef);
      }
      return {
        accountGeneration: standaloneGeneration,
        expectedAccountId: null,
      };
    };

  const readTransportBinding = () => {
    try {
      return adaptWebCompanyBinding(rawGetBinding());
    } catch {
      return null;
    }
  };

  function resolveCallBindingArgs({ accountGeneration, expectedAccountId, accountId } = {}) {
    const liveBinding = readTransportBinding();
    const targetGeneration = accountGeneration !== undefined
      ? accountGeneration
      : (liveBinding ? liveBinding.accountGeneration : null);

    let targetAccountId;
    if (expectedAccountId !== undefined && accountId !== undefined && expectedAccountId !== accountId) {
      targetAccountId = undefined;
    } else if (expectedAccountId !== undefined) {
      targetAccountId = expectedAccountId;
    } else if (accountId !== undefined) {
      targetAccountId = accountId;
    } else if (liveBinding) {
      targetAccountId = liveBinding.expectedAccountId;
    } else {
      targetAccountId = null;
    }

    return {
      accountGeneration: targetGeneration,
      expectedAccountId: targetAccountId,
    };
  }

  const transport = injectedTransport || createCompanyEntryTransport({
    windowRef,
    cryptoRef,
    timers,
    pollIntervalMs,
    ...(customFetch !== undefined ? { fetch: customFetch } : {}),
    ...(customLocation !== undefined ? { location: customLocation } : {}),
    ...(fetchTimeoutMs !== undefined ? { fetchTimeoutMs } : {}),
    getBinding: readTransportBinding,
  });

  return {
    handoffInviteLink({ href, accountGeneration, expectedAccountId, accountId, signal } = {}) {
      const parsed = extractInviteLinkPayload(href);
      if (!parsed.ok) {
        const invalidCode = parsed.checked?.ok ? 'INVALID_INPUT' : parsed.checked?.code || 'INVALID_INPUT';
        return Promise.resolve({
          ok: false,
          code: invalidCode,
          retryable: false,
          message: parsed.checked?.ok
            ? '허용된 SYNK 초대 링크만 사용할 수 있어요.'
            : parsed.checked?.message || mapCompanyInviteErrorMessage('INVALID_INPUT'),
        });
      }

      const resolvedArgs = resolveCallBindingArgs({
        accountGeneration,
        expectedAccountId,
        accountId,
      });

      const pending = transport.startInvite({
        token: parsed.token,
        expectedKind: parsed.expectedKind,
        accountGeneration: resolvedArgs.accountGeneration,
        expectedAccountId: resolvedArgs.expectedAccountId,
        signal,
      });

      return Promise.resolve(pending).then(res => {
        if (
          res?.ok === true
          && res.state === 'received'
          && (res.destination === '/' || res.destination === '/pulse-app/')
        ) {
          return {
            ok: true,
            requestId: res.requestId,
            accountGeneration: res.accountGeneration,
            state: 'received',
            kind: res.kind,
            pathname: parsed.checked.pathname,
            destination: res.destination,
            keepOpen: true,
            statusMessage: '열린 작업 공간 창에서 초대 입장을 이어서 진행해 주세요.',
          };
        }
        const failCode = res?.code || 'HANDOFF_UNAVAILABLE';
        return {
          ok: false,
          code: failCode,
          retryable: failCode === 'HANDOFF_UNCONFIRMED' ? false : Boolean(res?.retryable),
          message: mapCompanyInviteErrorMessage(failCode),
        };
      });
    },

    resolveBareInviteCode({ code, accountGeneration, expectedAccountId, accountId, signal } = {}) {
      const checked = validatePortalInviteInput(code);
      if (!checked.ok || checked.kind !== 'code') {
        return Promise.resolve({
          ok: false,
          code: checked.ok ? 'INVALID_INPUT' : checked.code,
          retryable: false,
          message: checked.ok
            ? mapCompanyInviteErrorMessage('INVALID_INPUT')
            : checked.message,
        });
      }

      const resolvedArgs = resolveCallBindingArgs({
        accountGeneration,
        expectedAccountId,
        accountId,
      });

      const pending = transport.startInvite({
        token: checked.value,
        expectedKind: null,
        accountGeneration: resolvedArgs.accountGeneration,
        expectedAccountId: resolvedArgs.expectedAccountId,
        signal,
      });

      return Promise.resolve(pending).then(res => {
        if (
          res?.ok === true
          && res.state === 'received'
          && (res.destination === '/' || res.destination === '/pulse-app/')
        ) {
          return {
            ok: true,
            requestId: res.requestId,
            accountGeneration: res.accountGeneration,
            state: 'received',
            kind: res.kind,
            destination: res.destination,
            keepOpen: true,
            statusMessage: '열린 작업 공간 창에서 초대 입장을 이어서 진행해 주세요.',
          };
        }
        const failCode = res?.code || 'HANDOFF_UNAVAILABLE';
        return {
          ok: false,
          code: failCode,
          retryable: failCode === 'HANDOFF_UNCONFIRMED' ? false : Boolean(res?.retryable),
          message: mapCompanyInviteErrorMessage(failCode),
        };
      });
    },

    resolveAssignedDestination({
      accountGeneration,
      expectedAccountId,
      accountId,
      interactiveRecovery = false,
      signal,
      onAssignmentUpdate,
    } = {}) {
      const resolvedArgs = resolveCallBindingArgs({
        accountGeneration,
        expectedAccountId,
        accountId,
      });

      const pending = transport.resolveAssignments({
        accountGeneration: resolvedArgs.accountGeneration,
        expectedAccountId: resolvedArgs.expectedAccountId,
        interactiveRecovery: interactiveRecovery === true,
        signal,
        onAssignmentUpdate,
      });
      return Promise.resolve(pending);
    },

    openAssignedDestination(destination) {
      return transport.openDestination(destination);
    },

    cancelCompanyEntry(options) {
      if (options && typeof options === 'object' && options.preserveVerifiedResolution === true) {
        transport.cancel({ preserveVerifiedResolution: true });
        return;
      }
      transport.cancel();
    },

    disposeCompanyEntry() {
      transport.dispose();
    },
  };
}

export function mountWebPortalHost({
  root,
  hostElements,
  bypass = false,
  getConfig = () => null,
  ensureConfigReady = null,
  getAccount = () => null,
  getStartupState = () => null,
  getSessionStorage,
  getLocalStorage,
  getReducedMotion,
  cryptoRef: customCryptoRef = null,
  beginOAuthFn = beginOAuth,
  rememberLoginFn = rememberPlatformLogin,
  clearLoginIntentFn = clearPlatformLoginIntent,
  takeLoginNoticeFn = takePlatformLoginNotice,
  nowFn = () => Date.now(),
  completionWaitMs = PORTAL_COMPLETION_WAIT_MS,
  onRetryAuth,
  onSwitchAccount,
  onNavigateExternal,
  onReplaceExternal,
  onNavigateHash,
  onOpenNewTab,
  onTrackAppLaunch,
  onEnsureEnteredRoute,
  onActiveChange,
  companyTransport = null,
  companyBoundaries: customBoundaries = null,
} = {}) {
  if (!root) {
    return {
      getState: () => ({ phase: 'entered', active: false, blockShortcuts: false }),
      isActive: () => false,
      shouldBlockShortcuts: () => false,
      syncAccountState() {},
      openAuth: () => false,
      canAutoResumeCentralSession: () => false,
      resumeCentralSession: () => Promise.resolve({ ok: false, code: 'BYPASS' }),
      openPurposePicker: () => false,
      closePurposePicker: () => Promise.resolve(false),
      handlePageShow() {},
      dispose() {},
    };
  }

  const doc = root.ownerDocument || globalThis.document;
  const win = doc?.defaultView || globalThis.window || globalThis;
  const hostCrypto = customCryptoRef || win?.crypto || globalThis.crypto;

  function resolveSessionStorage() {
    if (typeof getSessionStorage === 'function') {
      try {
        return getSessionStorage();
      } catch {
        return null;
      }
    }
    try {
      return win?.sessionStorage || globalThis.sessionStorage || null;
    } catch {
      return null;
    }
  }

  function resolveLocalStorage() {
    if (typeof getLocalStorage === 'function') {
      try {
        return getLocalStorage();
      } catch {
        return null;
      }
    }
    try {
      return win?.localStorage || globalThis.localStorage || null;
    } catch {
      return null;
    }
  }

  const navigateExternal = typeof onNavigateExternal === 'function'
    ? onNavigateExternal
    : href => {
      win?.location?.assign?.(href);
    };

  const replaceExternal = typeof onReplaceExternal === 'function'
    ? onReplaceExternal
    : typeof onNavigateExternal === 'function'
      ? onNavigateExternal
      : href => {
        if (typeof win?.location?.replace === 'function') {
          win.location.replace(href);
        } else {
          win?.location?.assign?.(href);
        }
      };

  const navigateHash = typeof onNavigateHash === 'function'
    ? onNavigateHash
    : nextHash => {
      if (win?.location) {
        if (win.location.hash !== nextHash) {
          win.location.hash = nextHash;
        } else {
          onEnsureEnteredRoute?.();
        }
      }
    };

  const openNewTab = typeof onOpenNewTab === 'function'
    ? onOpenNewTab
    : href => {
      const popup = win?.open?.('about:blank', '_blank');
      if (!popup) {
        return {
          ok: false,
          code: 'POPUP_BLOCKED',
          message: '새 창이 차단됐어요. 브라우저에서 새 창을 허용한 뒤 다시 눌러 주세요.',
        };
      }
      try {
        popup.opener = null;
        popup.location.replace(href);
        return { ok: true };
      } catch {
        try {
          popup.close?.();
        } catch {
          // 차단된 팝업 닫기 실패는 무시한다.
        }
        return {
          ok: false,
          code: 'POPUP_FAILED',
          message: '선택한 화면을 열지 못했어요. 다시 시도해 주세요.',
        };
      }
    };

  let disposed = false;
  let hostGeneration = 1;
  let lastAccountInstance = null;
  let lastAccountGeneration = 0;
  let lastVerifiedKey = null;
  let observedPendingAccountId = null;
  let authIntentSeq = 0;
  let portalUserInteracted = false;
  let hasCompletedPortalEntry = bypass === true;
  let lastSubmittedInviteRaw = '';
  let inviteCallbackInFlight = false;
  let authTriggerEl = null;

  let companyBinding = null;
  let syncedBindingGeneration = null;
  let syncedBoundAuthKey = null;
  let bindingHasSettledOnce = false;
  let lastCancelledGeneration = null;
  let entrySeq = 0;
  let cancelledEntrySeq = 0;
  let hasPreservedCompanyResolution = false;
  let pendingWorkspaceReturnRefresh = null;
  let pendingNavigationHold = false;
  let cancellingCompanyEntry = false;

  function readPlatformSessionSnapshot() {
    let storage = null;
    if (typeof getSessionStorage === 'function') {
      try {
        storage = getSessionStorage();
      } catch {
        return { raw: null, error: true };
      }
    } else {
      try {
        storage = win?.sessionStorage ?? globalThis.sessionStorage ?? null;
      } catch {
        return { raw: null, error: true };
      }
    }

    if (storage === null || storage === undefined) {
      return { raw: null, error: false };
    }
    if (typeof storage !== 'object' || typeof storage.getItem !== 'function') {
      return { raw: null, error: true };
    }

    try {
      return { raw: storage.getItem(SESSION_KEY), error: false };
    } catch {
      return { raw: null, error: true };
    }
  }

  function isInvalidationBindingKey(authKey) {
    if (typeof authKey !== 'string' || !authKey) return false;
    return (
      authKey === '__invalid_signed_in__'
      || authKey === '__unbound__'
      || authKey === '__session_mismatch__'
      || authKey === '__switching_account__'
      || authKey.startsWith('__signing_in__:')
      || authKey.startsWith('__non_signed__:error:')
      || authKey.startsWith('__bound_error__:')
    );
  }

  function isSettledOrInvalidatedBindingKey(authKey) {
    if (typeof authKey !== 'string' || !authKey) return false;
    if (
      authKey.startsWith('__non_signed__:restoring:')
      || authKey.startsWith('__non_signed__:loading:')
    ) {
      return false;
    }
    return true;
  }

  function isAccountScopedPendingKey(authKey) {
    return typeof authKey === 'string' && authKey.startsWith('__restoring_account__:');
  }

  function canHoldBoundCompanySession(authKey) {
    if (typeof authKey !== 'string' || !authKey) return false;
    return (
      authKey.startsWith('__signed_out__:')
      || authKey.startsWith('__unconfigured__:')
      || authKey.startsWith('signed-in:')
    );
  }

  function computeNormalizedCompanyBindingSpec() {
    const account = getAccount?.() || null;
    const identity = account?.identity?.() || null;
    const rawStatus = identity?.status || getStartupState?.()?.status || 'restoring';
    const explicitIdentityGen = Number.isInteger(identity?.accountGeneration)
      ? identity.accountGeneration
      : 0;

    if (rawStatus === 'signed-in') {
      if (
        identity?.signedIn !== true
        || typeof identity.accountId !== 'string'
        || !identity.accountId.trim()
      ) {
        return {
          boundAuthKey: '__invalid_signed_in__',
          boundVerifiedAccountKey: null,
          accountId: null,
          validSignedIn: false,
          mismatch: true,
        };
      }

      const verifiedAccountKey = identity.accountId.trim();
      if (
        account?.isAccountBound !== undefined
        && account?.isAccountBound !== null
        && typeof account.isAccountBound !== 'function'
      ) {
        return {
          boundAuthKey: '__unbound__',
          boundVerifiedAccountKey: null,
          accountId: null,
          validSignedIn: false,
          mismatch: true,
        };
      }
      const hasAccountBoundFn = typeof account?.isAccountBound === 'function';
      let boundVerified = true;
      if (hasAccountBoundFn) {
        try {
          boundVerified = account.isAccountBound(verifiedAccountKey) === true;
        } catch {
          boundVerified = false;
        }
      }
      if (hasAccountBoundFn && !boundVerified) {
        return {
          boundAuthKey: '__unbound__',
          boundVerifiedAccountKey: null,
          accountId: null,
          validSignedIn: false,
          mismatch: true,
        };
      }

      const sessionSnapshot = readPlatformSessionSnapshot();
      const extracted = extractVerifiedSynkId({
        identity,
        rawSessionString: sessionSnapshot.raw,
        account,
        storageError: sessionSnapshot.error,
      });
      if (extracted.mismatch) {
        return {
          boundAuthKey: '__session_mismatch__',
          boundVerifiedAccountKey: null,
          accountId: null,
          validSignedIn: false,
          mismatch: true,
        };
      }

      const nextAccountId = extracted.synkId;
      return {
        boundAuthKey: `signed-in:${verifiedAccountKey}:${nextAccountId || 'no-synk-uuid'}:${explicitIdentityGen}`,
        boundVerifiedAccountKey: verifiedAccountKey,
        identityGeneration: explicitIdentityGen,
        accountId: nextAccountId,
        validSignedIn: true,
        mismatch: false,
      };
    }

    if (rawStatus === 'restoring' || rawStatus === 'loading') {
      const refreshingKey = typeof identity?.accountKey === 'string' && identity.accountKey.trim()
        ? identity.accountKey.trim()
        : null;
      if (refreshingKey) {
        if (
          companyBinding
          && companyBinding.validSignedIn === true
          && !companyBinding.mismatch
          && companyBinding.boundVerifiedAccountKey === refreshingKey
          && companyBinding.boundIdentityGeneration === explicitIdentityGen
        ) {
          return {
            boundAuthKey: companyBinding.boundAuthKey,
            boundVerifiedAccountKey: companyBinding.boundVerifiedAccountKey,
            identityGeneration: companyBinding.boundIdentityGeneration,
            accountId: companyBinding.accountId,
            validSignedIn: true,
            mismatch: false,
          };
        }
        return {
          boundAuthKey: `__restoring_account__:${refreshingKey}:${explicitIdentityGen}`,
          boundVerifiedAccountKey: null,
          accountId: null,
          validSignedIn: false,
          mismatch: true,
        };
      }
      if (
        companyBinding
        && companyBinding.validSignedIn === false
        && !companyBinding.mismatch
        && companyBinding.boundVerifiedAccountKey === null
        && companyBinding.accountId === null
        && (
          companyBinding.boundAuthKey === `__signed_out__:${explicitIdentityGen}`
          || companyBinding.boundAuthKey === `__unconfigured__:${explicitIdentityGen}`
        )
      ) {
        return {
          boundAuthKey: companyBinding.boundAuthKey,
          boundVerifiedAccountKey: null,
          accountId: null,
          validSignedIn: false,
          mismatch: false,
        };
      }
      return {
        boundAuthKey: `__non_signed__:${rawStatus}:${explicitIdentityGen}`,
        boundVerifiedAccountKey: null,
        accountId: null,
        validSignedIn: false,
        mismatch: false,
      };
    }

    if (rawStatus === 'signing-in') {
      return {
        boundAuthKey: `__signing_in__:${explicitIdentityGen}`,
        boundVerifiedAccountKey: null,
        accountId: null,
        validSignedIn: false,
        mismatch: true,
      };
    }

    if (rawStatus === 'error') {
      const boundErrorKey = typeof identity?.accountKey === 'string' && identity.accountKey.trim()
        ? identity.accountKey.trim()
        : null;
      if (boundErrorKey) {
        return {
          boundAuthKey: `__bound_error__:${boundErrorKey}:${explicitIdentityGen}`,
          boundVerifiedAccountKey: null,
          accountId: null,
          validSignedIn: false,
          mismatch: true,
        };
      }
      return {
        boundAuthKey: `__non_signed__:error:${explicitIdentityGen}`,
        boundVerifiedAccountKey: null,
        accountId: null,
        validSignedIn: false,
        mismatch: false,
      };
    }

    if (rawStatus === 'unconfigured') {
      return {
        boundAuthKey: `__unconfigured__:${explicitIdentityGen}`,
        boundVerifiedAccountKey: null,
        accountId: null,
        validSignedIn: false,
        mismatch: false,
      };
    }

    return {
      boundAuthKey: `__signed_out__:${explicitIdentityGen}`,
      boundVerifiedAccountKey: null,
      accountId: null,
      validSignedIn: false,
      mismatch: false,
    };
  }

  function resolveCurrentCompanyBinding({ forceNewGeneration = false } = {}) {
    if (disposed) {
      return {
        accountGeneration: companyBinding?.accountGeneration || generateMemoryUuid(hostCrypto),
        accountId: null,
        validSignedIn: false,
        mismatch: true,
        disposed: true,
      };
    }

    const nextSpec = computeNormalizedCompanyBindingSpec();
    if (
      forceNewGeneration
      || companyBinding === null
      || companyBinding.boundAuthKey !== nextSpec.boundAuthKey
    ) {
      companyBinding = {
        accountGeneration: generateMemoryUuid(hostCrypto),
        boundAuthKey: nextSpec.boundAuthKey,
        boundVerifiedAccountKey: nextSpec.boundVerifiedAccountKey,
        boundIdentityGeneration: nextSpec.identityGeneration ?? null,
        accountId: nextSpec.accountId,
        validSignedIn: nextSpec.validSignedIn,
        mismatch: nextSpec.mismatch,
      };
    }

    return {
      accountGeneration: companyBinding.accountGeneration,
      accountId: companyBinding.accountId,
      validSignedIn: companyBinding.validSignedIn,
      mismatch: companyBinding.mismatch,
    };
  }

  let boundaries = null;

  function requestCancelCompanyEntry({
    reasonGeneration = null,
    preserveVerifiedResolution = false,
  } = {}) {
    if (disposed || cancellingCompanyEntry) return false;
    const preserve = preserveVerifiedResolution === true && reasonGeneration === null;
    const hasActiveEntry = entrySeq > cancelledEntrySeq;

    if (preserve) {
      if (!hasActiveEntry && !hasPreservedCompanyResolution) {
        return false;
      }
      cancelledEntrySeq = entrySeq;
      hasPreservedCompanyResolution = true;
      cancellingCompanyEntry = true;
      try {
        boundaries?.cancelCompanyEntry?.({ preserveVerifiedResolution: true });
        return true;
      } finally {
        cancellingCompanyEntry = false;
      }
    }

    pendingWorkspaceReturnRefresh = null;
    const hasPendingOrPreserved = hasActiveEntry || hasPreservedCompanyResolution;
    if (reasonGeneration !== null) {
      if (lastCancelledGeneration === reasonGeneration && !hasPendingOrPreserved) {
        return false;
      }
      lastCancelledGeneration = reasonGeneration;
    } else if (!hasPendingOrPreserved) {
      return false;
    }
    cancelledEntrySeq = entrySeq;
    hasPreservedCompanyResolution = false;
    cancellingCompanyEntry = true;
    try {
      boundaries?.cancelCompanyEntry?.();
      return true;
    } finally {
      cancellingCompanyEntry = false;
    }
  }

  function syncBindingCancellationIfNeeded({ isInitialMount = false } = {}) {
    resolveCurrentCompanyBinding();
    if (isInitialMount) {
      syncedBindingGeneration = companyBinding.accountGeneration;
      syncedBoundAuthKey = companyBinding.boundAuthKey;
      bindingHasSettledOnce = isSettledOrInvalidatedBindingKey(companyBinding.boundAuthKey);
      return false;
    }
    if (companyBinding.accountGeneration === syncedBindingGeneration) {
      return false;
    }
    const prevGen = syncedBindingGeneration;
    const prevKey = syncedBoundAuthKey;
    const nextKey = companyBinding.boundAuthKey;
    const hasActiveEntry = entrySeq > cancelledEntrySeq;
    const shouldCancel =
      hasActiveEntry
      || hasPreservedCompanyResolution
      || canHoldBoundCompanySession(prevKey)
      || (bindingHasSettledOnce && isInvalidationBindingKey(nextKey))
      || isAccountScopedPendingKey(prevKey);
    syncedBindingGeneration = companyBinding.accountGeneration;
    syncedBoundAuthKey = nextKey;
    bindingHasSettledOnce = bindingHasSettledOnce || isSettledOrInvalidatedBindingKey(nextKey);
    if (shouldCancel) {
      requestCancelCompanyEntry({ reasonGeneration: prevGen });
      return true;
    }
    return false;
  }

  function invalidateCompanyBinding({ cancelActive = true, markPendingSwitch = false } = {}) {
    if (disposed) return;
    const prevGen = syncedBindingGeneration ?? companyBinding?.accountGeneration ?? null;
    if (markPendingSwitch) {
      observedPendingAccountId = null;
      companyBinding = {
        accountGeneration: generateMemoryUuid(hostCrypto),
        boundAuthKey: '__switching_account__',
        boundVerifiedAccountKey: null,
        boundIdentityGeneration: null,
        accountId: null,
        validSignedIn: false,
        mismatch: true,
      };
    } else {
      resolveCurrentCompanyBinding({ forceNewGeneration: true });
    }
    syncedBindingGeneration = companyBinding.accountGeneration;
    syncedBoundAuthKey = companyBinding.boundAuthKey;
    bindingHasSettledOnce = isSettledOrInvalidatedBindingKey(companyBinding.boundAuthKey);
    if (cancelActive) {
      requestCancelCompanyEntry({ reasonGeneration: prevGen });
    }
  }

  boundaries = {
    ...createDefaultWebCompanyBoundaries({
      windowRef: win,
      cryptoRef: hostCrypto,
      transport: companyTransport,
      getBinding() {
        return adaptWebCompanyBinding(resolveCurrentCompanyBinding());
      },
    }),
    ...(customBoundaries && typeof customBoundaries === 'object' ? customBoundaries : {}),
  };

  function readCurrentHash() {
    return typeof win?.location?.hash === 'string' ? win.location.hash : '';
  }

  function extractIdentityTrackingKey(identity) {
    if (typeof identity?.accountKey === 'string' && identity.accountKey.trim()) {
      return identity.accountKey.trim();
    }
    if (
      identity?.signedIn === true
      && identity.status === 'signed-in'
      && typeof identity.accountId === 'string'
      && identity.accountId.trim()
    ) {
      return identity.accountId.trim();
    }
    return null;
  }

  function advanceGenerationForAccount(account, identity, { bindingInvalidated = false } = {}) {
    const accountGen = Number.isInteger(identity?.accountGeneration) ? identity.accountGeneration : 0;
    const verifiedKey = extractIdentityTrackingKey(identity);

    if (account !== lastAccountInstance) {
      if (lastAccountInstance !== null) {
        observedPendingAccountId = null;
        if (verifiedKey !== lastVerifiedKey || accountGen !== lastAccountGeneration || bindingInvalidated) {
          hostGeneration += 1;
        }
      }
      lastAccountInstance = account;
      lastAccountGeneration = accountGen;
      lastVerifiedKey = verifiedKey;
      return hostGeneration;
    }

    if (accountGen !== lastAccountGeneration || verifiedKey !== lastVerifiedKey || bindingInvalidated) {
      hostGeneration += 1;
      lastAccountGeneration = accountGen;
      lastVerifiedKey = verifiedKey;
    }
    return hostGeneration;
  }

  function buildNormalizedAuth({ cancelOnBindingChange = false, isInitialMount = false } = {}) {
    const account = getAccount?.() || null;
    const identity = account?.identity?.() || null;
    resolveCurrentCompanyBinding();
    let bindingInvalidated = false;
    if (isInitialMount) {
      syncBindingCancellationIfNeeded({ isInitialMount: true });
    } else if (cancelOnBindingChange) {
      bindingInvalidated = syncBindingCancellationIfNeeded();
    }
    const generation = advanceGenerationForAccount(account, identity, { bindingInvalidated });
    syncObservedPendingOnboarding(identity);
    return normalizeWebPortalAuth(identity, {
      startupState: getStartupState?.() || null,
      generation,
      ...(typeof getReducedMotion === 'function' ? { reducedMotion: Boolean(getReducedMotion()) } : {}),
    });
  }

  function clearNoticeKindAttr() {
    const feedbackEl = root.querySelector?.('[data-portal-auth-feedback]');
    if (feedbackEl?.dataset) {
      delete feedbackEl.dataset.noticeKind;
    }
  }

  function showAuthNotice(noticeObj) {
    if (disposed || !noticeObj || typeof noticeObj.message !== 'string' || !noticeObj.message.trim()) {
      return false;
    }
    const feedbackEl = root.querySelector?.('[data-portal-auth-feedback]');
    if (!feedbackEl) return false;
    feedbackEl.textContent = noticeObj.message.trim();
    if (feedbackEl.dataset && typeof noticeObj.kind === 'string') {
      feedbackEl.dataset.noticeKind = noticeObj.kind;
    }
    feedbackEl.hidden = false;
    return true;
  }

  function readOneTimeLoginNotice() {
    const storage = resolveSessionStorage();
    if (!storage) return null;
    try {
      return takeLoginNoticeFn(storage, { now: nowFn() });
    } catch {
      return null;
    }
  }

  function clearPendingWebOAuthState() {
    const storage = resolveSessionStorage();
    if (!storage) return;
    try {
      storage.removeItem?.(PENDING_OAUTH_KEY);
    } catch {
      // 저장소 접근 실패는 무시한다.
    }
    try {
      clearLoginIntentFn(storage);
    } catch {
      // 저장소 접근 실패는 무시한다.
    }
  }

  function createGuardedStorage(rawStorage, expectedSeq) {
    const assertCurrent = () => {
      if (disposed || expectedSeq !== authIntentSeq) {
        throw staleAuthIntentError();
      }
    };
    return {
      getItem(key) {
        return rawStorage.getItem(key);
      },
      setItem(key, value) {
        assertCurrent();
        return rawStorage.setItem(key, value);
      },
      removeItem(key) {
        assertCurrent();
        return rawStorage.removeItem(key);
      },
    };
  }

  async function startWebOAuth(method) {
    if (!PLATFORM_LOGIN_METHODS.includes(method)) {
      return { ok: false, code: 'UNSUPPORTED_AUTH_METHOD', message: '지원하지 않는 로그인 방식이에요.' };
    }
    portalUserInteracted = true;
    const mySeq = ++authIntentSeq;
    clearNoticeKindAttr();

    let currentConfig = getConfig?.();
    if (!currentConfig?.configured && typeof ensureConfigReady === 'function') {
      try {
        await ensureConfigReady();
      } catch {
        // 설정 재확인이 실패하면 아래 설정 검증에서 안내한다.
      }
      if (disposed || mySeq !== authIntentSeq) {
        return { ok: false, code: 'AUTH_CANCELLED' };
      }
      currentConfig = getConfig?.();
    }

    const platformClient = currentConfig?.clients?.platform;
    if (!currentConfig?.configured || !platformClient?.clientId || !platformClient.redirectUri) {
      return {
        ok: false,
        code: 'AUTH_UNCONFIGURED',
        message: '이 화면의 로그인 설정이 아직 없어요.',
      };
    }

    const rawStorage = resolveSessionStorage();
    if (
      !rawStorage
      || typeof rawStorage.getItem !== 'function'
      || typeof rawStorage.setItem !== 'function'
      || typeof rawStorage.removeItem !== 'function'
    ) {
      return {
        ok: false,
        code: 'AUTH_STORAGE_UNAVAILABLE',
        message: '브라우저 저장 공간을 사용할 수 없어요. 사이트 데이터 저장을 허용한 뒤 다시 시도해 주세요.',
      };
    }

    const guardedStorage = createGuardedStorage(rawStorage, mySeq);
    const startedAt = nowFn();
    const returnHash = normalizePortalReturnHash(readCurrentHash());

    try {
      const authorizeUrl = await beginOAuthFn({
        config: currentConfig,
        product: 'platform',
        storage: guardedStorage,
        now: startedAt,
      });
      if (disposed || mySeq !== authIntentSeq) {
        return { ok: false, code: 'AUTH_CANCELLED' };
      }
      rememberLoginFn(guardedStorage, {
        config: currentConfig,
        method,
        returnHash,
        now: startedAt,
      });
      if (disposed || mySeq !== authIntentSeq) {
        return { ok: false, code: 'AUTH_CANCELLED' };
      }
      invalidateCompanyBinding({ cancelActive: true });
      navigateExternal(authorizeUrl);
      return { ok: true, method, returnHash, authorizeUrl };
    } catch (error) {
      if (disposed || mySeq !== authIntentSeq || error?.code === 'STALE_AUTH_INTENT') {
        return { ok: false, code: 'AUTH_CANCELLED' };
      }
      return {
        ok: false,
        code: 'AUTH_START_FAILED',
        message: typeof error?.message === 'string' && error.message.trim()
          ? error.message.trim()
          : '로그인을 시작하지 못했어요. 다시 시도해 주세요.',
      };
    }
  }

  function verifyBoundAccount(expectedAccountId) {
    if (typeof expectedAccountId !== 'string') return null;
    const trimmed = expectedAccountId.trim();
    if (!trimmed) return null;
    const account = getAccount?.();
    if (!account || typeof account !== 'object') return null;
    if (account.isAccountBound !== undefined && account.isAccountBound !== null) {
      if (typeof account.isAccountBound !== 'function') return null;
      try {
        return account.isAccountBound(trimmed) === true ? account : null;
      } catch {
        return null;
      }
    }
    const live = account.identity?.();
    return live?.signedIn === true && live.status === 'signed-in' && live.accountId === trimmed
      ? account
      : null;
  }

  function syncObservedPendingOnboarding(identity) {
    if (!identity || typeof identity !== 'object') return;
    if (
      identity.signedIn === true
      && identity.status === 'signed-in'
      && typeof identity.accountId === 'string'
      && identity.accountId.trim()
    ) {
      const key = identity.accountId.trim();
      if (normalizePurposeOnboarding(identity.onboarding) === 'pending') {
        observedPendingAccountId = key;
      } else if (observedPendingAccountId === key) {
        observedPendingAccountId = null;
      }
      return;
    }
    if (
      identity.status === 'signed-out'
      || identity.status === 'unconfigured'
      || identity.status === 'signing-in'
    ) {
      observedPendingAccountId = null;
      return;
    }
    const trackingKey = extractIdentityTrackingKey(identity);
    if (trackingKey && observedPendingAccountId && trackingKey !== observedPendingAccountId) {
      observedPendingAccountId = null;
    }
  }

  function isPurposeOnboardingPending(boundAccount, expectedAccountId) {
    if (typeof expectedAccountId !== 'string' || !expectedAccountId.trim()) return false;
    const trimmed = expectedAccountId.trim();
    const live = boundAccount?.identity?.() || null;
    if (live?.signedIn === true && live.status === 'signed-in' && live.accountId === trimmed) {
      const pending = normalizePurposeOnboarding(live.onboarding) === 'pending';
      if (pending) {
        observedPendingAccountId = trimmed;
      } else if (observedPendingAccountId === trimmed) {
        observedPendingAccountId = null;
      }
      return pending;
    }
    return observedPendingAccountId === trimmed;
  }

  function resolveEnteringPurposeMode(boundAccount, expectedAccountId) {
    return isPurposeOnboardingPending(boundAccount, expectedAccountId)
      ? 'onboarding'
      : 'existing';
  }

  async function settlePurposeOnboarding(account, outcome, expectedAccountId, { bounded = false } = {}) {
    const trimmedExpected = typeof expectedAccountId === 'string' ? expectedAccountId.trim() : '';
    if (typeof account?.completePurposeOnboarding !== 'function') {
      if (!verifyBoundAccount(expectedAccountId)) {
        return { ok: false, code: 'ACCOUNT_CHANGED', message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.' };
      }
      if (trimmedExpected && observedPendingAccountId === trimmedExpected) {
        observedPendingAccountId = null;
      }
      return { ok: true, persisted: false };
    }

    const completionTask = account.completePurposeOnboarding(outcome, {
      accountId: expectedAccountId,
      keepalive: true,
    });

    if (!bounded || !(Number.isFinite(completionWaitMs) && completionWaitMs >= 0)) {
      const directResult = await completionTask;
      if (directResult?.ok !== false && trimmedExpected && observedPendingAccountId === trimmedExpected) {
        observedPendingAccountId = null;
      }
      return directResult;
    }

    let timerId = null;
    const raced = await Promise.race([
      completionTask,
      new Promise(resolve => {
        timerId = setTimeout(() => resolve(TIME_LIMIT_SENTINEL), completionWaitMs);
      }),
    ]).finally(() => {
      if (timerId !== null) clearTimeout(timerId);
    });

    if (raced === TIME_LIMIT_SENTINEL) {
      if (!verifyBoundAccount(expectedAccountId)) {
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
      if (trimmedExpected && observedPendingAccountId === trimmedExpected) {
        observedPendingAccountId = null;
      }
      return { ok: true, deferred: true };
    }

    if (raced?.ok !== false && trimmedExpected && observedPendingAccountId === trimmedExpected) {
      observedPendingAccountId = null;
    }
    return raced;
  }

  function restoreInviteInputValue(fallbackValue = '') {
    if (disposed) return;
    const inviteInput = root.querySelector?.('#portal-invite-input');
    if (!inviteInput) return;
    const preserved = lastSubmittedInviteRaw.trim() ? lastSubmittedInviteRaw : fallbackValue;
    if (preserved && root.dataset?.portalState === 'invite') {
      inviteInput.value = preserved;
    }
  }

  function clearPreservedInviteInput() {
    lastSubmittedInviteRaw = '';
    const inviteInput = root.querySelector?.('#portal-invite-input');
    if (inviteInput && inviteInput.value !== '') {
      inviteInput.value = '';
    }
  }

  const initialAuth = buildNormalizedAuth({ isInitialMount: true });
  let portal = null;

  function mapAssignmentResultToWorkspace(res, { interactiveRecovery = false } = {}) {
    const destinations = Array.isArray(res?.destinations) ? [...res.destinations] : [];
    const unavailable = Array.isArray(res?.unavailable) ? [...res.unavailable] : [];

    if (
      res?.status === 'resolved'
      && Array.isArray(res.destinations)
      && Array.isArray(res.unavailable)
      && unavailable.length === 0
    ) {
      return {
        status: 'resolved',
        destinations,
        unavailable: [],
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }

    if (res?.status === 'partial' || (res?.status === 'resolved' && unavailable.length > 0)) {
      return {
        status: 'partial',
        destinations,
        unavailable,
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }

    if (res?.status === 'login_required') {
      return {
        status: 'login_required',
        destinations: [],
        unavailable,
        message: interactiveRecovery
          ? ''
          : '회사 작업 공간을 확인하려면 로그인이 필요해요. 아래 작업 공간 다시 확인을 눌러 로그인 창을 열어 주세요.',
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }

    if (res?.status === 'account_mismatch') {
      return {
        status: 'account_mismatch',
        destinations: [],
        unavailable,
        message: interactiveRecovery
          ? ''
          : '작업 공간에 연결된 계정이 지금 로그인한 계정과 달라요. 아래 작업 공간 다시 확인을 눌러 계정을 맞춰 주세요.',
        canSwitchAccount: true,
        canContinuePersonal: true,
      };
    }

    return {
      status: 'unavailable',
      destinations: [],
      unavailable,
      canSwitchAccount: true,
      canContinuePersonal: true,
    };
  }

  function handleAsyncAssignmentUpdate({ accountKey, expectedGen, entryToken = null, outcome }) {
    if (disposed || !portal) return;
    if (Number.isInteger(entryToken) && entryToken <= cancelledEntrySeq) return;
    const liveBinding = resolveCurrentCompanyBinding();
    if (liveBinding.mismatch || liveBinding.accountGeneration !== expectedGen) return;
    const boundAccount = verifyBoundAccount(accountKey);
    if (!boundAccount) return;
    const portalSnap = portal.getState();
    if (portalSnap.phase !== 'workspace' || portalSnap.accountKey !== accountKey) return;

    if (!outcome || outcome.ok === false) {
      if (outcome?.code === 'ACCOUNT_CHANGED') return;
      if (outcome?.code === 'ACCOUNT_MISMATCH') {
        portal.setWorkspaceState(
          {
            status: 'account_mismatch',
            destinations: [],
            unavailable: [],
            canSwitchAccount: true,
            canContinuePersonal: true,
          },
          { accountKey },
        );
        return;
      }
      const timeoutOrClosedMessage = outcome?.code === 'HANDOFF_TIMEOUT'
        ? '로그인 대기 시간이 지났어요. 회사 공간 로그인을 마쳤다면 아래 작업 공간 다시 확인을 눌러 주세요.'
        : outcome?.code === 'CANCELLED'
          ? '열려 있던 회사 공간 창이 닫혔어요. 아래 작업 공간 다시 확인을 눌러 창을 새로 열어 주세요.'
          : '회사 공간 확인이 중단됐어요. 아래 작업 공간 다시 확인을 눌러 다시 시도해 주세요.';
      portal.setWorkspaceState(
        {
          status: 'login_required',
          destinations: [],
          unavailable: [],
          message: timeoutOrClosedMessage,
          canSwitchAccount: true,
          canContinuePersonal: true,
        },
        { accountKey },
      );
      return;
    }

    const res = outcome.result;
    if (
      res?.status === 'resolved'
      && Array.isArray(res.destinations)
      && Array.isArray(res.unavailable)
      && res.unavailable.length === 0
    ) {
      if (res.destinations.length === 0) {
        requestCancelCompanyEntry();
        syncObservedPendingOnboarding(boundAccount.identity?.());
        const purposeMode = resolveEnteringPurposeMode(boundAccount, accountKey);
        const completed = portal.completeWorkspaceEntry({
          action: 'purpose',
          purposeMode,
          accountKey,
        });
        if (purposeMode !== 'existing' && completed?.ok && completed.state?.phase === 'entered') {
          onEnsureEnteredRoute?.();
        }
        return;
      }

      if (res.destinations.length === 1) {
        const targetDest = res.destinations[0];
        const finalizeOpened = resolvedOpen => {
          if (disposed || !portal) return;
          const latestBinding = resolveCurrentCompanyBinding();
          if (latestBinding.mismatch || latestBinding.accountGeneration !== expectedGen) return;
          const latestAccount = verifyBoundAccount(accountKey);
          if (!latestAccount) return;
          if (resolvedOpen && resolvedOpen.ok !== false) {
            if (isPurposeOnboardingPending(latestAccount, accountKey)) {
              void settlePurposeOnboarding(latestAccount, 'not-asked', accountKey, { bounded: true });
            }
            const navigationRequested = resolvedOpen.navigationRequested === true;
            if (!navigationRequested) {
              onEnsureEnteredRoute?.();
            }
            portal.completeWorkspaceEntry({
              action: 'entered',
              accountKey,
              navigationRequested,
            });
            return;
          }
          portal.setWorkspaceState(
            {
              status: 'unavailable',
              destinations: [],
              unavailable: [],
              message: '배정된 작업 공간으로 이동하지 못했어요. 아래 단추를 눌러 다시 확인해 주세요.',
              canSwitchAccount: true,
              canContinuePersonal: true,
            },
            { accountKey },
          );
        };
        const opened = boundaries.openAssignedDestination?.(targetDest);
        if (opened && typeof opened.then === 'function') {
          void opened.then(finalizeOpened, () => finalizeOpened({ ok: false }));
        } else {
          finalizeOpened(opened);
        }
        return;
      }
    }

    portal.setWorkspaceState(mapAssignmentResultToWorkspace(res, { interactiveRecovery: true }), { accountKey });
  }

  function executeAssignmentResolution({
    accountKey,
    generation,
    interactiveRecovery = false,
    previousWorkspaceStatus = null,
  }) {
    const useInteractiveRecovery = interactiveRecovery === true;
    const boundAccount = verifyBoundAccount(accountKey);
    const liveIdentity = boundAccount?.identity?.();
    if (
      !boundAccount
      || liveIdentity?.signedIn !== true
      || liveIdentity.status !== 'signed-in'
      || liveIdentity.accountId !== accountKey
    ) {
      return Promise.resolve({
        ok: false,
        code: 'ACCOUNT_CHANGED',
        message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
      });
    }
    syncObservedPendingOnboarding(liveIdentity);

    if (!disposed) {
      syncBindingCancellationIfNeeded();
    }
    const liveBinding = resolveCurrentCompanyBinding();
    if (liveBinding.mismatch) {
      return Promise.resolve({
        ok: true,
        action: 'workspace',
        workspace: {
          status: 'account_mismatch',
          destinations: [],
          unavailable: [],
          canSwitchAccount: true,
          canContinuePersonal: true,
        },
      });
    }

    const hasCustomResolver = typeof customBoundaries?.resolveAssignedDestination === 'function';
    if (!hasCustomResolver && !liveBinding.accountId) {
      return Promise.resolve({
        ok: true,
        action: 'workspace',
        workspace: {
          status: 'unavailable',
          destinations: [],
          unavailable: [],
          message: '계정의 작업 공간 식별 정보를 확인하지 못했어요. 다시 확인하거나 다른 계정으로 로그인해 주세요.',
          canSwitchAccount: true,
          canContinuePersonal: true,
        },
      });
    }

    const expectedGen = liveBinding.accountGeneration;
    const expectedSynkId = liveBinding.accountId;

    // 수동 로그인 복구(interactiveRecovery)에서는 첫 await 전에 동기적으로 창을 열고,
    // 저장 세션 자동 진입과 일반 오류 재확인은 팝업 없이 fetch로 조회한다.
    const myEntrySeq = ++entrySeq;
    const pendingAssigned = boundaries.resolveAssignedDestination({
      identity: liveIdentity,
      accountKey,
      generation,
      accountGeneration: expectedGen,
      expectedAccountId: expectedSynkId,
      interactiveRecovery: useInteractiveRecovery,
      onAssignmentUpdate: outcome => handleAsyncAssignmentUpdate({
        accountKey,
        expectedGen,
        entryToken: myEntrySeq,
        outcome,
      }),
    });

    return (async () => {
      const assigned = await pendingAssigned;
      if (disposed || myEntrySeq <= cancelledEntrySeq) {
        return {
          ok: false,
          code: 'CANCELLED',
          message: '작업 공간 확인이 중단됐어요.',
        };
      }
      const verifiedAfter = verifyBoundAccount(accountKey);
      const afterBinding = resolveCurrentCompanyBinding();
      if (!verifiedAfter || afterBinding.mismatch || afterBinding.accountGeneration !== expectedGen) {
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }

      const afterIdentity = verifiedAfter.identity?.() || liveIdentity;
      syncObservedPendingOnboarding(afterIdentity);

      // 주입된 테스트 경계의 기존 반환 형식도 함께 지원한다.
      if (assigned && assigned.kind === 'none') {
        return {
          ok: true,
          action: 'purpose',
          purposeMode: resolveEnteringPurposeMode(verifiedAfter, accountKey),
        };
      }

      if (assigned && assigned.kind === 'destination' && typeof assigned.open === 'function') {
        const opened = await assigned.open();
        if (disposed || myEntrySeq <= cancelledEntrySeq) {
          return {
            ok: false,
            code: 'CANCELLED',
            message: '작업 공간 확인이 중단됐어요.',
          };
        }
        const latestAccount = verifyBoundAccount(accountKey);
        const latestBinding = resolveCurrentCompanyBinding();
        if (!latestAccount || latestBinding.mismatch || latestBinding.accountGeneration !== expectedGen) {
          return {
            ok: false,
            code: 'ACCOUNT_CHANGED',
            message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
          };
        }
        if (opened?.ok === false) {
          return {
            ok: false,
            code: opened.code || 'ASSIGNED_OPEN_FAILED',
            message: opened.message || '배정된 작업 공간을 불러오지 못했어요. 다시 시도해 주세요.',
          };
        }
        if (isPurposeOnboardingPending(latestAccount, accountKey)) {
          const marked = await settlePurposeOnboarding(latestAccount, 'not-asked', accountKey, { bounded: true });
          if (marked?.ok === false) return marked;
        }
        const navigationRequested = opened?.navigationRequested === true;
        if (!navigationRequested) {
          onEnsureEnteredRoute?.();
        }
        return navigationRequested ? { ok: true, navigationRequested: true } : { ok: true };
      }

      if (!assigned || assigned.ok === false) {
        if (assigned?.code === 'ACCOUNT_CHANGED') {
          return {
            ok: false,
            code: 'ACCOUNT_CHANGED',
            message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
          };
        }
        return {
          ok: true,
          action: 'workspace',
          workspace: mapCompanyResolveErrorToWorkspace(assigned?.code, {
            interactiveRecovery: useInteractiveRecovery,
            previousStatus: previousWorkspaceStatus,
          }),
        };
      }

      const res = assigned.result;
      if (!res || typeof res !== 'object') {
        return {
          ok: true,
          action: 'workspace',
          workspace: mapCompanyResolveErrorToWorkspace('TEMPORARY_UNAVAILABLE', {
            interactiveRecovery: useInteractiveRecovery,
            previousStatus: previousWorkspaceStatus,
          }),
        };
      }

      if (
        res.status === 'resolved'
        && Array.isArray(res.destinations)
        && Array.isArray(res.unavailable)
        && res.unavailable.length === 0
      ) {
        if (res.destinations.length === 0) {
          requestCancelCompanyEntry();
          return {
            ok: true,
            action: 'purpose',
            purposeMode: resolveEnteringPurposeMode(verifiedAfter, accountKey),
          };
        }

        if (res.destinations.length === 1) {
          const targetDest = res.destinations[0];
          const opened = await Promise.resolve(boundaries.openAssignedDestination?.(targetDest));
          if (disposed || myEntrySeq <= cancelledEntrySeq) {
            return {
              ok: false,
              code: 'CANCELLED',
              message: '작업 공간 확인이 중단됐어요.',
            };
          }
          const latestAccount = verifyBoundAccount(accountKey);
          const latestBinding = resolveCurrentCompanyBinding();
          if (!latestAccount || latestBinding.mismatch || latestBinding.accountGeneration !== expectedGen) {
            return {
              ok: false,
              code: 'ACCOUNT_CHANGED',
              message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
            };
          }
          if (!opened || opened.ok === false) {
            if (opened?.code === 'ACCOUNT_CHANGED') {
              return {
                ok: false,
                code: 'ACCOUNT_CHANGED',
                message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
              };
            }
            return {
              ok: true,
              action: 'workspace',
              workspace: {
                status: 'unavailable',
                destinations: [],
                unavailable: [],
                message: '배정된 작업 공간으로 이동하지 못했어요. 아래 단추를 눌러 다시 확인해 주세요.',
                canSwitchAccount: true,
                canContinuePersonal: true,
              },
            };
          }

          if (isPurposeOnboardingPending(latestAccount, accountKey)) {
            const marked = await settlePurposeOnboarding(latestAccount, 'not-asked', accountKey, { bounded: true });
            if (marked?.ok === false) return marked;
          }
          const navigationRequested = opened.navigationRequested === true;
          if (!navigationRequested) {
            onEnsureEnteredRoute?.();
          }
          return {
            ok: true,
            destination: targetDest,
            navigationRequested,
          };
        }
      }

      return {
        ok: true,
        action: 'workspace',
        workspace: mapAssignmentResultToWorkspace(res, { interactiveRecovery: useInteractiveRecovery }),
      };
    })();
  }

  async function refreshWorkspaceAfterReturn({
    accountKey,
    generation,
    expectedGen,
    expectedSynkId,
  }) {
    const boundAccount = verifyBoundAccount(accountKey);
    const liveIdentity = boundAccount?.identity?.();
    if (
      !boundAccount
      || liveIdentity?.signedIn !== true
      || liveIdentity.status !== 'signed-in'
      || liveIdentity.accountId !== accountKey
    ) {
      return;
    }

    const myEntrySeq = ++entrySeq;
    const pendingAssigned = boundaries.resolveAssignedDestination({
      identity: liveIdentity,
      accountKey,
      generation,
      accountGeneration: expectedGen,
      expectedAccountId: expectedSynkId,
      interactiveRecovery: false,
      onAssignmentUpdate: outcome => handleAsyncAssignmentUpdate({
        accountKey,
        expectedGen,
        entryToken: myEntrySeq,
        outcome,
      }),
    });

    const assigned = await pendingAssigned;
    if (disposed || !portal || myEntrySeq <= cancelledEntrySeq) return;
    const verifiedAfter = verifyBoundAccount(accountKey);
    const afterBinding = resolveCurrentCompanyBinding();
    if (!verifiedAfter || afterBinding.mismatch || afterBinding.accountGeneration !== expectedGen) {
      return;
    }
    const portalSnap = portal.getState();
    if (portalSnap.phase !== 'workspace' || portalSnap.accountKey !== accountKey) {
      return;
    }

    syncObservedPendingOnboarding(verifiedAfter.identity?.() || liveIdentity);

    if (assigned && assigned.kind === 'none') {
      requestCancelCompanyEntry();
      const purposeMode = resolveEnteringPurposeMode(verifiedAfter, accountKey);
      const completed = portal.completeWorkspaceEntry({
        action: 'purpose',
        purposeMode,
        accountKey,
      });
      if (purposeMode !== 'existing' && completed?.ok && completed.state?.phase === 'entered') {
        onEnsureEnteredRoute?.();
      }
      return;
    }

    if (assigned && assigned.kind === 'destination' && typeof assigned.open === 'function') {
      const opened = await assigned.open();
      if (disposed || !portal || myEntrySeq <= cancelledEntrySeq) return;
      const latestAccount = verifyBoundAccount(accountKey);
      const latestBinding = resolveCurrentCompanyBinding();
      if (!latestAccount || latestBinding.mismatch || latestBinding.accountGeneration !== expectedGen) return;
      if (opened?.ok === false) {
        portal.setWorkspaceState(
          {
            status: 'unavailable',
            destinations: [],
            unavailable: [],
            message: opened.message || '배정된 작업 공간을 불러오지 못했어요. 다시 시도해 주세요.',
            canSwitchAccount: true,
            canContinuePersonal: true,
          },
          { accountKey },
        );
        return;
      }
      if (isPurposeOnboardingPending(latestAccount, accountKey)) {
        const marked = await settlePurposeOnboarding(latestAccount, 'not-asked', accountKey, { bounded: true });
        if (marked?.ok === false) return;
      }
      const navigationRequested = opened?.navigationRequested === true;
      if (!navigationRequested) {
        onEnsureEnteredRoute?.();
      }
      portal.completeWorkspaceEntry({
        action: 'entered',
        accountKey,
        navigationRequested,
      });
      return;
    }

    if (!assigned || assigned.ok === false) {
      if (assigned?.code === 'ACCOUNT_CHANGED' || assigned?.code === 'CANCELLED') {
        return;
      }
      portal.setWorkspaceState(
        mapCompanyResolveErrorToWorkspace(assigned?.code, { interactiveRecovery: false }),
        { accountKey },
      );
      return;
    }

    const res = assigned.result;
    if (!res || typeof res !== 'object') {
      portal.setWorkspaceState(
        mapCompanyResolveErrorToWorkspace('TEMPORARY_UNAVAILABLE', { interactiveRecovery: false }),
        { accountKey },
      );
      return;
    }

    if (
      res.status === 'resolved'
      && Array.isArray(res.destinations)
      && Array.isArray(res.unavailable)
      && res.unavailable.length === 0
    ) {
      if (res.destinations.length === 0) {
        requestCancelCompanyEntry();
        const purposeMode = resolveEnteringPurposeMode(verifiedAfter, accountKey);
        const completed = portal.completeWorkspaceEntry({
          action: 'purpose',
          purposeMode,
          accountKey,
        });
        if (purposeMode !== 'existing' && completed?.ok && completed.state?.phase === 'entered') {
          onEnsureEnteredRoute?.();
        }
        return;
      }

      if (res.destinations.length === 1) {
        const targetDest = res.destinations[0];
        const opened = await Promise.resolve(boundaries.openAssignedDestination?.(targetDest));
        if (disposed || !portal || myEntrySeq <= cancelledEntrySeq) return;
        const latestAccount = verifyBoundAccount(accountKey);
        const latestBinding = resolveCurrentCompanyBinding();
        if (!latestAccount || latestBinding.mismatch || latestBinding.accountGeneration !== expectedGen) return;
        if (opened && opened.ok !== false) {
          if (isPurposeOnboardingPending(latestAccount, accountKey)) {
            const marked = await settlePurposeOnboarding(latestAccount, 'not-asked', accountKey, { bounded: true });
            if (marked?.ok === false) return;
          }
          const navigationRequested = opened.navigationRequested === true;
          if (!navigationRequested) {
            onEnsureEnteredRoute?.();
          }
          portal.completeWorkspaceEntry({
            action: 'entered',
            accountKey,
            navigationRequested,
          });
          return;
        }
        if (opened?.code === 'ACCOUNT_CHANGED') return;
        portal.setWorkspaceState(
          {
            status: 'unavailable',
            destinations: [],
            unavailable: [],
            message: '배정된 작업 공간으로 이동하지 못했어요. 아래 단추를 눌러 다시 확인해 주세요.',
            canSwitchAccount: true,
            canContinuePersonal: true,
          },
          { accountKey },
        );
        return;
      }
    }

    portal.setWorkspaceState(
      mapAssignmentResultToWorkspace(res, { interactiveRecovery: false }),
      { accountKey },
    );
  }

  function performWorkspaceReturnRefreshIfNeeded() {
    const pending = pendingWorkspaceReturnRefresh;
    if (!pending || disposed || !portal) return false;
    const snap = portal.getState();
    if (snap.phase !== 'workspace') return false;
    pendingWorkspaceReturnRefresh = null;

    const { accountKey, expectedGen, fallbackCode } = pending;
    if (snap.accountKey !== accountKey) return true;
    const boundAccount = verifyBoundAccount(accountKey);
    if (!boundAccount) return true;
    const hasCustomResolver = typeof customBoundaries?.resolveAssignedDestination === 'function';
    const liveBinding = resolveCurrentCompanyBinding();
    if (liveBinding.accountGeneration !== expectedGen) return true;

    if (fallbackCode === 'LOGIN_REQUIRED' || fallbackCode === 'ACCOUNT_MISMATCH') {
      portal.setWorkspaceState(
        mapCompanyResolveErrorToWorkspace(fallbackCode, { interactiveRecovery: false }),
        { accountKey },
      );
    }

    if (liveBinding.mismatch || (!hasCustomResolver && !liveBinding.accountId)) {
      return true;
    }

    void refreshWorkspaceAfterReturn({
      accountKey,
      generation: snap.generation,
      expectedGen: liveBinding.accountGeneration,
      expectedSynkId: liveBinding.accountId,
    });
    return true;
  }

  function scheduleWorkspaceReturnRefresh() {
    let hops = 0;
    const check = () => {
      if (disposed || !pendingWorkspaceReturnRefresh || !portal) return;
      const phase = portal.getState()?.phase;
      if (phase === 'workspace') {
        performWorkspaceReturnRefreshIfNeeded();
        return;
      }
      if (phase === 'purpose' && hops < 6) {
        hops += 1;
        queueMicrotask(check);
        return;
      }
      pendingWorkspaceReturnRefresh = null;
    };
    queueMicrotask(check);
  }

  portal = mountPortalEntry(root, {
    ...(Array.isArray(hostElements) && hostElements.length > 0 ? { hostElements } : {}),
    managePageShow: true,
    initialState: {
      status: initialAuth.status,
      generation: initialAuth.generation,
      ...(Object.hasOwn(initialAuth, 'accountKey') ? { accountKey: initialAuth.accountKey } : {}),
      errorMessage: initialAuth.errorMessage,
      retryable: initialAuth.retryable,
      bypass: bypass === true,
    },
    ...(typeof getReducedMotion === 'function' ? { getReducedMotion: () => Boolean(getReducedMotion()) } : {}),
    signingInMessage: '열린 SYNK ID 화면에서 로그인을 마쳐 주세요.',

    onActiveChange(active, detail) {
      if (!active || detail?.phase !== 'invite') {
        lastSubmittedInviteRaw = '';
      }
      if (!active || detail?.phase === 'entered') {
        hasCompletedPortalEntry = true;
        if (hasPreservedCompanyResolution || pendingWorkspaceReturnRefresh) {
          requestCancelCompanyEntry();
        }
      } else if (detail?.phase === 'workspace' && pendingWorkspaceReturnRefresh) {
        performWorkspaceReturnRefreshIfNeeded();
      } else if (
        (detail?.phase === 'welcome' || detail?.phase === 'auth' || detail?.phase === 'signing-in')
        && (hasPreservedCompanyResolution || pendingWorkspaceReturnRefresh)
      ) {
        requestCancelCompanyEntry();
      }
      if (active && detail?.phase === 'entered') {
        pendingNavigationHold = true;
      } else if (!active) {
        const shouldEnsureEnteredRoute = pendingNavigationHold && detail?.phase === 'entered';
        pendingNavigationHold = false;
        if (shouldEnsureEnteredRoute) {
          onEnsureEnteredRoute?.();
        }
      } else {
        pendingNavigationHold = false;
      }
      onActiveChange?.(active, detail);
      if (!active && authTriggerEl) {
        const restoreTarget = authTriggerEl;
        authTriggerEl = null;
        if (restoreTarget.isConnected && isVisibleElement(restoreTarget)) {
          restoreTarget.focus?.({ preventScroll: true });
        }
      }
    },

    onGoogleSignIn: () => startWebOAuth('google'),
    onEmailSignIn: () => startWebOAuth('email'),
    onSignUp: () => startWebOAuth('signup'),

    async onCancelSignIn() {
      authIntentSeq += 1;
      invalidateCompanyBinding({ cancelActive: true });
      clearPendingWebOAuthState();
      return { ok: true };
    },

    async onRetry() {
      authIntentSeq += 1;
      if (typeof onRetryAuth === 'function') {
        await onRetryAuth();
      } else {
        await getAccount?.()?.refresh?.();
      }
      const next = buildNormalizedAuth({ cancelOnBindingChange: true });
      if (next.status === 'error') {
        return { ok: false, message: next.errorMessage };
      }
      return { ok: true };
    },

    async onSwitchAccount() {
      portalUserInteracted = true;
      authIntentSeq += 1;
      pausePlatformAutoLogin(resolveLocalStorage());
      invalidateCompanyBinding({ cancelActive: true, markPendingSwitch: true });
      clearPendingWebOAuthState();
      try {
        if (typeof onSwitchAccount === 'function') {
          await onSwitchAccount();
          return;
        }
        const storage = resolveSessionStorage();
        try {
          storage?.removeItem?.(SESSION_KEY);
        } catch {
          // 저장소 삭제 실패 시 아래 refresh가 상태를 다시 읽는다.
        }
        await getAccount?.()?.refresh?.();
      } finally {
        if (!disposed) {
          syncBindingCancellationIfNeeded();
        }
      }
    },

    async onBrowse() {
      portalUserInteracted = true;
      clearNoticeKindAttr();
      requestCancelCompanyEntry();
      if (hasCompletedPortalEntry || isExplicitPlatformRouteHash(readCurrentHash())) {
        onEnsureEnteredRoute?.();
        return { ok: true };
      }
      return { ok: true, action: 'purpose' };
    },

    onEnter({ generation, accountKey }) {
      requestCancelCompanyEntry();
      return executeAssignmentResolution({
        accountKey,
        generation,
        interactiveRecovery: false,
      });
    },

    onRetryWorkspace(context) {
      const currentStatus =
        context?.workspace?.status
        || portal?.getState?.()?.workspace?.status
        || null;
      const interactiveRecovery =
        currentStatus === 'login_required'
        || currentStatus === 'account_mismatch'
        || currentStatus === 'popup_blocked';
      requestCancelCompanyEntry();
      return executeAssignmentResolution({
        accountKey: context?.accountKey,
        generation: context?.generation,
        interactiveRecovery,
        previousWorkspaceStatus: currentStatus,
      });
    },

    onSelectWorkspace(destination, context) {
      const accountKey = context?.accountKey;
      const boundAccount = verifyBoundAccount(accountKey);
      if (!boundAccount) {
        return Promise.resolve({
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        });
      }

      const liveBinding = resolveCurrentCompanyBinding();
      if (liveBinding.mismatch) {
        return Promise.resolve({
          ok: false,
          code: 'ACCOUNT_MISMATCH',
          message: '로그인 계정 정보가 바뀌었어요. 계정을 다시 확인해 주세요.',
          workspace: {
            status: 'account_mismatch',
            destinations: [],
            unavailable: [],
            canSwitchAccount: true,
            canContinuePersonal: true,
          },
        });
      }
      const expectedGen = liveBinding.accountGeneration;

      const normalizedDest = normalizePortalWorkspaceDestination(destination);
      if (!normalizedDest) {
        return Promise.resolve({
          ok: false,
          code: 'INVALID_INPUT',
          message: '선택한 작업 공간을 찾지 못했어요. 다시 선택해 주세요.',
        });
      }

      // 직전 확정 결과에 포함된 고정 목적지로 같은 탭 이동을 요청한다.
      const pendingOpen = boundaries.openAssignedDestination?.(normalizedDest);

      return (async () => {
        const opened = await Promise.resolve(pendingOpen);
        if (!opened || opened.ok === false) {
          if (opened?.code === 'ACCOUNT_CHANGED') {
            return {
              ok: false,
              code: 'ACCOUNT_CHANGED',
              message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
            };
          }
          return {
            ok: false,
            code: opened?.code || 'HANDOFF_UNAVAILABLE',
            message: '선택한 작업 공간으로 이동하지 못했어요. 아래 작업 공간 다시 확인을 눌러 다시 시도해 주세요.',
          };
        }

        const verifiedAfter = verifyBoundAccount(accountKey);
        const afterBinding = resolveCurrentCompanyBinding();
        if (!verifiedAfter || afterBinding.mismatch || afterBinding.accountGeneration !== expectedGen) {
          return {
            ok: false,
            code: 'ACCOUNT_CHANGED',
            message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
          };
        }

        if (isPurposeOnboardingPending(verifiedAfter, accountKey)) {
          const marked = await settlePurposeOnboarding(verifiedAfter, 'not-asked', accountKey, { bounded: true });
          if (marked?.ok === false) return marked;
        }

        const navigationRequested = opened.navigationRequested === true;
        if (!navigationRequested) {
          onEnsureEnteredRoute?.();
        }
        return {
          ok: true,
          destination: normalizedDest,
          navigationRequested,
        };
      })();
    },

    async onContinuePersonal(context) {
      if (!disposed) {
        syncBindingCancellationIfNeeded();
      }
      const accountKey = context?.accountKey;
      const boundAccount = verifyBoundAccount(accountKey);
      if (!boundAccount) {
        requestCancelCompanyEntry();
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }

      const trimmedAccountKey = typeof accountKey === 'string' ? accountKey.trim() : '';
      const liveBinding = resolveCurrentCompanyBinding();
      const hasCustomResolver = typeof customBoundaries?.resolveAssignedDestination === 'function';
      const snap = portal?.getState?.() || null;
      const currentWorkspace = snap?.phase === 'workspace' && snap?.accountKey === accountKey
        ? snap.workspace
        : context?.workspace || null;
      const canPreserveVerified =
        !liveBinding.mismatch
        && liveBinding.validSignedIn === true
        && (Boolean(liveBinding.accountId) || hasCustomResolver)
        && companyBinding?.boundVerifiedAccountKey === trimmedAccountKey
        && (currentWorkspace?.status === 'resolved' || currentWorkspace?.status === 'partial')
        && Array.isArray(currentWorkspace.destinations)
        && currentWorkspace.destinations.length > 0;

      if (canPreserveVerified) {
        pendingWorkspaceReturnRefresh = null;
        requestCancelCompanyEntry({ preserveVerifiedResolution: true });
      } else {
        requestCancelCompanyEntry();
      }

      syncObservedPendingOnboarding(boundAccount.identity?.());
      const purposeMode = resolveEnteringPurposeMode(boundAccount, accountKey);

      if (!canPreserveVerified && purposeMode === 'existing') {
        const unverifiedStatus = currentWorkspace?.status || null;
        if (unverifiedStatus === 'login_required' || unverifiedStatus === 'account_mismatch') {
          const fallbackCode = unverifiedStatus === 'login_required'
            ? 'LOGIN_REQUIRED'
            : 'ACCOUNT_MISMATCH';
          if (snap?.phase === 'workspace' && snap?.accountKey === accountKey) {
            portal.setWorkspaceState(
              mapCompanyResolveErrorToWorkspace(fallbackCode, { interactiveRecovery: false }),
              { accountKey },
            );
          }
          if (!liveBinding.mismatch && (Boolean(liveBinding.accountId) || hasCustomResolver)) {
            pendingWorkspaceReturnRefresh = {
              accountKey,
              expectedGen: liveBinding.accountGeneration,
              fallbackCode,
            };
          }
        }
      }

      return {
        ok: true,
        action: 'purpose',
        purposeMode,
      };
    },

    onCancelInvite() {
      requestCancelCompanyEntry();
    },

    async onSelectPurpose(purposeId, context) {
      const isEntering = context?.origin === 'entering';
      const isExistingEntering = isEntering && context?.purposeMode === 'existing';
      const boundAccount = isEntering ? verifyBoundAccount(context.accountKey) : null;
      if (isEntering && !boundAccount) {
        requestCancelCompanyEntry();
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
      if (isExistingEntering && purposeId === 'home') {
        return {
          ok: false,
          code: 'UNKNOWN_PURPOSE',
          message: '선택한 화면을 찾지 못했어요. 다시 선택해 주세요.',
        };
      }

      const currentIdentity = isEntering
        ? boundAccount.identity?.()
        : getAccount?.()?.identity?.();
      const target = resolveWebPurposeTarget(purposeId, { identity: currentIdentity });
      if (!target) {
        return {
          ok: false,
          code: 'UNKNOWN_PURPOSE',
          message: '선택한 화면을 찾지 못했어요. 다시 선택해 주세요.',
        };
      }

      if (target.kind === 'new-tab') {
        const opened = openNewTab(target.href);
        if (!opened || opened.ok === false) {
          return {
            ok: false,
            code: opened?.code || 'POPUP_BLOCKED',
            message: opened?.message || '새 창이 차단됐어요. 브라우저에서 새 창을 허용한 뒤 다시 눌러 주세요.',
          };
        }
        if (target.trackAppId) {
          onTrackAppLaunch?.(target.trackAppId);
        }
        if (isEntering) {
          if (!isExistingEntering && isPurposeOnboardingPending(boundAccount, context.accountKey)) {
            const completed = await settlePurposeOnboarding(boundAccount, 'chosen', context.accountKey, { bounded: false });
            if (completed?.ok === false) return completed;
          } else if (!verifyBoundAccount(context.accountKey)) {
            requestCancelCompanyEntry();
            return {
              ok: false,
              code: 'ACCOUNT_CHANGED',
              message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
            };
          }
        }
        requestCancelCompanyEntry();
        onEnsureEnteredRoute?.();
        return { ok: true, destination: target.href };
      }

      if (isEntering) {
        if (!isExistingEntering && isPurposeOnboardingPending(boundAccount, context.accountKey)) {
          const completed = await settlePurposeOnboarding(boundAccount, 'chosen', context.accountKey, { bounded: true });
          if (completed?.ok === false) return completed;
        }
        if (!verifyBoundAccount(context.accountKey)) {
          requestCancelCompanyEntry();
          return {
            ok: false,
            code: 'ACCOUNT_CHANGED',
            message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
          };
        }
      }

      requestCancelCompanyEntry();
      if (target.trackAppId) {
        onTrackAppLaunch?.(target.trackAppId);
      }

      if (target.kind === 'same-tab') {
        navigateExternal(target.href);
        return { ok: true, destination: target.href };
      }

      authTriggerEl = null;
      navigateHash(target.hash);
      return { ok: true, destination: target.hash };
    },

    async onDismissPurpose(context) {
      if (context?.origin !== 'entering') {
        return { ok: true };
      }
      const boundAccount = verifyBoundAccount(context.accountKey);
      if (!boundAccount) {
        requestCancelCompanyEntry();
        return {
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
        };
      }
      if (context?.purposeMode === 'existing') {
        if (
          pendingWorkspaceReturnRefresh
          && pendingWorkspaceReturnRefresh.accountKey === context.accountKey
        ) {
          scheduleWorkspaceReturnRefresh();
        } else {
          pendingWorkspaceReturnRefresh = null;
        }
        return { ok: true, action: 'return' };
      }
      requestCancelCompanyEntry();
      if (isPurposeOnboardingPending(boundAccount, context.accountKey)) {
        const completed = await settlePurposeOnboarding(boundAccount, 'skipped', context.accountKey, { bounded: true });
        if (completed?.ok === false) return completed;
        if (!verifyBoundAccount(context.accountKey)) {
          return {
            ok: false,
            code: 'ACCOUNT_CHANGED',
            message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.',
          };
        }
      }
      onEnsureEnteredRoute?.();
      return { ok: true };
    },

    onInvite(validatedValue, meta) {
      portalUserInteracted = true;
      inviteCallbackInFlight = true;
      const submittedSnapshot = lastSubmittedInviteRaw;
      const checked = validatePortalInviteInput(validatedValue);
      if (!checked.ok) {
        inviteCallbackInFlight = false;
        restoreInviteInputValue(validatedValue);
        lastSubmittedInviteRaw = '';
        return Promise.resolve({
          ok: false,
          code: checked.code,
          message: checked.message,
        });
      }

      if (!disposed) {
        syncBindingCancellationIfNeeded();
      }
      if (hasPreservedCompanyResolution || pendingWorkspaceReturnRefresh) {
        requestCancelCompanyEntry();
      }
      const liveBinding = resolveCurrentCompanyBinding();
      if (liveBinding.mismatch) {
        inviteCallbackInFlight = false;
        restoreInviteInputValue(validatedValue);
        lastSubmittedInviteRaw = '';
        return Promise.resolve({
          ok: false,
          code: 'ACCOUNT_CHANGED',
          message: mapCompanyInviteErrorMessage('ACCOUNT_CHANGED'),
        });
      }

      const expectedGen = liveBinding.accountGeneration;
      const expectedSynkId = liveBinding.accountId;

      const surfaceUnconfirmedInviteNotice = safeMessage => {
        if (disposed) return;
        const currentPhase = portal?.getState?.()?.phase;
        if (currentPhase === 'auth') {
          showAuthNotice({
            kind: 'invite-unconfirmed',
            message: safeMessage,
          });
          return;
        }
        queueMicrotask(() => {
          if (disposed) return;
          const phaseAfterSettle = portal?.getState?.()?.phase;
          if (phaseAfterSettle === 'auth') {
            showAuthNotice({
              kind: 'invite-unconfirmed',
              message: safeMessage,
            });
            return;
          }
          if (phaseAfterSettle === 'invite') {
            const inviteErrorEl = root.querySelector?.('#portal-invite-error');
            if (inviteErrorEl && !inviteErrorEl.textContent?.trim()) {
              inviteErrorEl.textContent = safeMessage;
            }
          }
        });
      };

      if (checked.kind === 'link' || meta?.kind === 'link') {
        const hasCustomLinkHandoff = typeof customBoundaries?.handoffInviteLink === 'function';
        if (!hasCustomLinkHandoff && liveBinding.validSignedIn && !expectedSynkId) {
          inviteCallbackInFlight = false;
          restoreInviteInputValue(validatedValue);
          lastSubmittedInviteRaw = '';
          return Promise.resolve({
            ok: false,
            code: 'ACCOUNT_MISMATCH',
            message: '계정의 작업 공간 식별 정보를 확인하지 못했어요. 계정을 다시 확인해 주세요.',
          });
        }
        // 사용자 submit 안에서 await 전에 popup이 동기적으로 열리게 한다.
        const myEntrySeq = ++entrySeq;
        const pendingHandoff = boundaries.handoffInviteLink({
          href: checked.value,
          pathname: checked.pathname,
          accountGeneration: expectedGen,
          expectedAccountId: expectedSynkId,
        });

        return (async () => {
          try {
            const handoff = await pendingHandoff;
            const accepted = handoff?.ok === true && (
              handoff.state === 'received'
              || (hasCustomLinkHandoff && handoff.state === undefined)
            );
            if (!accepted) {
              const failCode = handoff?.code || 'INVITE_HANDOFF_FAILED';
              const safeMessage = failCode === 'HANDOFF_UNCONFIRMED'
                ? mapCompanyInviteErrorMessage('HANDOFF_UNCONFIRMED')
                : sanitizeHostInviteMessage(
                  handoff?.message,
                  submittedSnapshot,
                  checked.value,
                  failCode,
                );
              restoreInviteInputValue(lastSubmittedInviteRaw || validatedValue);
              if (failCode === 'HANDOFF_UNCONFIRMED') {
                surfaceUnconfirmedInviteNotice(safeMessage);
              }
              return {
                ok: false,
                code: failCode,
                retryable: failCode === 'HANDOFF_UNCONFIRMED' ? false : Boolean(handoff?.retryable),
                message: safeMessage,
              };
            }
            clearPreservedInviteInput();
            return {
              ok: true,
              state: 'received',
              kind: handoff.kind || 'link',
              pathname: checked.pathname,
              destination: handoff.destination === '/' || handoff.destination === '/pulse-app/'
                ? handoff.destination
                : checked.pathname,
              keepOpen: handoff.keepOpen !== false,
              statusMessage: handoff.statusMessage || '열린 작업 공간 창에서 초대 입장을 이어서 진행해 주세요.',
            };
          } finally {
            inviteCallbackInFlight = false;
            lastSubmittedInviteRaw = '';
            if (entrySeq === myEntrySeq) {
              cancelledEntrySeq = myEntrySeq;
            }
          }
        })();
      }

      const hasCustomBareResolver = typeof customBoundaries?.resolveBareInviteCode === 'function';
      if (!hasCustomBareResolver && liveBinding.validSignedIn && !expectedSynkId) {
        inviteCallbackInFlight = false;
        restoreInviteInputValue(validatedValue);
        lastSubmittedInviteRaw = '';
        return Promise.resolve({
          ok: false,
          code: 'ACCOUNT_MISMATCH',
          message: '계정의 작업 공간 식별 정보를 확인하지 못했어요. 계정을 다시 확인해 주세요.',
        });
      }
      const myEntrySeq = ++entrySeq;
      const pendingBare = boundaries.resolveBareInviteCode({
        code: checked.value,
        accountGeneration: expectedGen,
        expectedAccountId: expectedSynkId,
      });

      return (async () => {
        try {
          const inspected = await pendingBare;
          const validDest = inspected?.destination === '/' || inspected?.destination === '/pulse-app/';
          const accepted = inspected?.ok === true && (
            (inspected.state === 'received' && validDest)
            || (hasCustomBareResolver && validDest && inspected.state === undefined)
          );
          if (accepted) {
            clearPreservedInviteInput();
            return {
              ok: true,
              state: 'received',
              kind: inspected.kind || 'code',
              destination: inspected.destination,
              keepOpen: inspected.keepOpen !== false,
              statusMessage: inspected.statusMessage || '열린 작업 공간 창에서 초대 입장을 이어서 진행해 주세요.',
            };
          }

          const failCode = inspected?.code || 'HANDOFF_UNAVAILABLE';
          const safeMessage = failCode === 'HANDOFF_UNCONFIRMED'
            ? mapCompanyInviteErrorMessage('HANDOFF_UNCONFIRMED')
            : sanitizeHostInviteMessage(
              inspected?.message,
              submittedSnapshot,
              checked.value,
              failCode,
            );
          restoreInviteInputValue(lastSubmittedInviteRaw || validatedValue);
          if (failCode === 'HANDOFF_UNCONFIRMED') {
            surfaceUnconfirmedInviteNotice(safeMessage);
          }
          return {
            ok: false,
            code: failCode,
            retryable: failCode === 'HANDOFF_UNCONFIRMED' ? false : Boolean(inspected?.retryable),
            message: safeMessage,
          };
        } finally {
          inviteCallbackInFlight = false;
          lastSubmittedInviteRaw = '';
          if (entrySeq === myEntrySeq) {
            cancelledEntrySeq = myEntrySeq;
          }
        }
      })();
    },
  });

  if (!bypass) {
    const initialNotice = readOneTimeLoginNotice();
    if (initialNotice && initialAuth.status !== 'signed-in') {
      const reopenStatus = initialAuth.status === 'unconfigured' ? 'unconfigured' : 'signed-out';
      portal.reopenAuth({
        status: reopenStatus,
        generation: hostGeneration,
      });
      showAuthNotice(initialNotice);
    }
  }

  const onRootSubmitCapture = event => {
    if (disposed) return;
    portalUserInteracted = true;
    const form = event.target?.closest?.('[data-portal-pane="invite"]');
    if (!form || !root.contains(form)) return;
    const inviteInput = root.querySelector?.('#portal-invite-input');
    lastSubmittedInviteRaw = inviteInput ? inviteInput.value : '';
    queueMicrotask(() => {
      if (disposed || inviteCallbackInFlight) return;
      if (portal.getState().phase !== 'invite') {
        lastSubmittedInviteRaw = '';
        return;
      }
      const inviteError = root.querySelector?.('#portal-invite-error');
      if (lastSubmittedInviteRaw.trim() && inviteError?.textContent?.trim()) {
        restoreInviteInputValue();
      }
      lastSubmittedInviteRaw = '';
    });
  };

  const onRootClickCapture = event => {
    if (disposed) return;
    if (event.target && root.contains?.(event.target)) {
      portalUserInteracted = true;
    }
    const actionBtn = event.target?.closest?.('[data-portal-action]');
    if (!actionBtn || !root.contains(actionBtn)) return;
    if (actionBtn.dataset.portalAction === 'close-invite') {
      lastSubmittedInviteRaw = '';
    }
    clearNoticeKindAttr();
  };

  const onWindowKeyDownCapture = event => {
    if (disposed || !portal.shouldBlockShortcuts()) return;
    if (event.isComposing || event.keyCode === 229) return;
    if ((event.key === 'Enter' || event.key === ' ') && event.target && root.contains?.(event.target)) {
      portalUserInteracted = true;
    }

    const mod = event.ctrlKey || event.metaKey;
    const lowerKey = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    if (mod && !event.altKey && !event.shiftKey && lowerKey === 'k') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (
      event.key === '/'
      && !mod
      && !event.altKey
      && !isEditablePortalField(event.target, root)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const targetInsidePortal = Boolean(event.target && root.contains?.(event.target));
    if (targetInsidePortal) return;

    if (event.key === 'Tab') {
      const items = [...root.querySelectorAll(FOCUSABLE_IN_PORTAL)].filter(isVisibleElement);
      event.preventDefault();
      event.stopImmediatePropagation();
      if (items.length > 0) {
        (event.shiftKey ? items[items.length - 1] : items[0]).focus?.({ preventScroll: true });
      }
      return;
    }

    if (event.key === 'Escape') {
      event.stopImmediatePropagation();
      const snap = portal.getState();
      if (snap.phase === 'invite') {
        const closeInviteBtn = root.querySelector?.('[data-portal-action="close-invite"]');
        if (closeInviteBtn && !closeInviteBtn.disabled) {
          event.preventDefault();
          lastSubmittedInviteRaw = '';
          closeInviteBtn.click();
        }
      } else if (snap.phase === 'workspace' && snap.workspace?.canContinuePersonal !== false) {
        const continueBtn = root.querySelector?.('[data-portal-action="continue-personal"]');
        if (continueBtn && !continueBtn.hidden && !continueBtn.disabled) {
          event.preventDefault();
          continueBtn.click();
        }
      } else if (snap.phase === 'purpose') {
        event.preventDefault();
        void portal.closePurposePicker();
      } else if (snap.phase === 'auth' && !snap.enteredOnce && snap.authStatus !== 'signing-in') {
        const backBtn = root.querySelector?.('[data-portal-action="back-welcome"]');
        if (backBtn && !backBtn.disabled) {
          event.preventDefault();
          clearNoticeKindAttr();
          backBtn.click();
        }
      }
    }
  };

  const onPageHide = () => {
    clearPreservedInviteInput();
    invalidateCompanyBinding({ cancelActive: true });
  };

  root.addEventListener?.('submit', onRootSubmitCapture, true);
  root.addEventListener?.('click', onRootClickCapture, true);
  win?.addEventListener?.('keydown', onWindowKeyDownCapture, true);
  win?.addEventListener?.('pagehide', onPageHide);

  function syncAccountState() {
    if (disposed || bypass) return portal.getState();
    const normalized = buildNormalizedAuth({ cancelOnBindingChange: true });
    return portal.setState(normalized);
  }

  function canAutoResumeCentralSession() {
    if (disposed || bypass || portalUserInteracted || authIntentSeq !== 0 || hasCompletedPortalEntry) {
      return false;
    }
    const snap = portal.getState();
    if (
      !snap
      || snap.phase !== 'welcome'
      || snap.enteredOnce
      || snap.authStatus === 'signed-in'
      || snap.authStatus === 'signing-in'
    ) {
      return false;
    }
    const rawStorage = resolveSessionStorage();
    if (
      !rawStorage
      || typeof rawStorage.getItem !== 'function'
      || typeof rawStorage.setItem !== 'function'
      || typeof rawStorage.removeItem !== 'function'
    ) {
      return false;
    }
    try {
      if (
        rawStorage.getItem(SESSION_KEY) !== null
        || rawStorage.getItem(PENDING_OAUTH_KEY) !== null
        || rawStorage.getItem(PLATFORM_LOGIN_INTENT) !== null
        || rawStorage.getItem(PLATFORM_LOGIN_NOTICE) !== null
        || hasPlatformAutoLoginAttempt(rawStorage)
      ) {
        return false;
      }
    } catch {
      return false;
    }
    const rawLocalStorage = resolveLocalStorage();
    if (rawLocalStorage && isPlatformAutoLoginPaused(rawLocalStorage)) {
      return false;
    }
    return true;
  }

  async function resumeCentralSession({ subject } = {}) {
    const normalizedSubject = typeof subject === 'string' ? subject.trim() : '';
    if (!normalizedSubject || !canAutoResumeCentralSession()) {
      return { ok: false, code: 'AUTO_RESUME_SKIPPED' };
    }

    const currentConfig = getConfig?.();
    const platformClient = currentConfig?.clients?.platform;
    if (!currentConfig?.configured || !platformClient?.clientId || !platformClient.redirectUri) {
      return { ok: false, code: 'AUTH_UNCONFIGURED' };
    }

    const rawStorage = resolveSessionStorage();
    if (
      !rawStorage
      || typeof rawStorage.getItem !== 'function'
      || typeof rawStorage.setItem !== 'function'
      || typeof rawStorage.removeItem !== 'function'
    ) {
      return { ok: false, code: 'AUTH_STORAGE_UNAVAILABLE' };
    }

    const startedAt = nowFn();
    if (!markPlatformAutoLoginAttempt(rawStorage, { now: startedAt })) {
      return { ok: false, code: 'AUTH_STORAGE_UNAVAILABLE' };
    }

    const mySeq = ++authIntentSeq;
    const guardedStorage = createGuardedStorage(rawStorage, mySeq);
    const returnHash = normalizePortalReturnHash(readCurrentHash());

    try {
      const authorizeUrl = await beginOAuthFn({
        config: currentConfig,
        product: 'platform',
        storage: guardedStorage,
        now: startedAt,
      });
      if (mySeq !== authIntentSeq) {
        return { ok: false, code: 'AUTH_CANCELLED' };
      }
      if (
        disposed
        || portalUserInteracted
        || portal.getState().phase !== 'welcome'
      ) {
        clearPendingWebOAuthState();
        return { ok: false, code: 'AUTH_CANCELLED' };
      }
      rememberLoginFn(guardedStorage, {
        config: currentConfig,
        method: PLATFORM_RESUME_METHOD,
        subject: normalizedSubject,
        returnHash,
        now: startedAt,
      });
      if (mySeq !== authIntentSeq) {
        return { ok: false, code: 'AUTH_CANCELLED' };
      }
      if (
        disposed
        || portalUserInteracted
        || portal.getState().phase !== 'welcome'
      ) {
        clearPendingWebOAuthState();
        return { ok: false, code: 'AUTH_CANCELLED' };
      }
      invalidateCompanyBinding({ cancelActive: true });
      replaceExternal(authorizeUrl);
      return { ok: true, method: PLATFORM_RESUME_METHOD, returnHash, authorizeUrl };
    } catch (error) {
      if (mySeq === authIntentSeq && error?.code !== 'STALE_AUTH_INTENT') {
        clearPendingWebOAuthState();
      }
      return { ok: false, code: mySeq !== authIntentSeq || error?.code === 'STALE_AUTH_INTENT' ? 'AUTH_CANCELLED' : 'AUTO_RESUME_FAILED' };
    }
  }

  function openAuth(triggerElement = doc?.activeElement) {
    if (disposed || bypass) return false;
    portalUserInteracted = true;
    const normalized = buildNormalizedAuth({ cancelOnBindingChange: false });
    if (normalized.status === 'signed-in') {
      syncBindingCancellationIfNeeded();
      return false;
    }
    authIntentSeq += 1;
    hostGeneration += 1;
    syncBindingCancellationIfNeeded();
    requestCancelCompanyEntry();
    authTriggerEl = triggerElement && triggerElement !== doc?.body && !root.contains?.(triggerElement)
      ? triggerElement
      : null;
    clearNoticeKindAttr();
    const reopenStatus = normalized.status === 'unconfigured'
      ? 'unconfigured'
      : normalized.status === 'error'
        ? 'error'
        : 'signed-out';
    portal.reopenAuth({
      status: reopenStatus,
      generation: hostGeneration,
    });
    return true;
  }

  function handlePageShow(event) {
    if (disposed || bypass) return;
    const noticeObj = readOneTimeLoginNotice();
    const isOrdinaryInitialPageShow = event?.persisted === false && !noticeObj;
    if (!isOrdinaryInitialPageShow) {
      authIntentSeq += 1;
    }
    if (event?.persisted === true) {
      portal.releaseNavigationHold?.();
    }
    const normalized = buildNormalizedAuth({ cancelOnBindingChange: false });
    const currentSnap = portal.getState();

    if (normalized.status !== 'signed-in') {
      if (isOrdinaryInitialPageShow) {
        syncBindingCancellationIfNeeded();
        if (currentSnap.phase !== 'signing-in') {
          portal.setState(normalized);
        }
        return;
      }
      if (event?.persisted || currentSnap.phase === 'signing-in' || noticeObj) {
        clearPendingWebOAuthState();
      }
      if (noticeObj || currentSnap.phase === 'signing-in') {
        hostGeneration += 1;
        invalidateCompanyBinding({ cancelActive: true });
        const reopenStatus = normalized.status === 'unconfigured' ? 'unconfigured' : 'signed-out';
        portal.reopenAuth({
          status: reopenStatus,
          generation: hostGeneration,
        });
        if (noticeObj) {
          showAuthNotice(noticeObj);
        }
        return;
      }
    }

    syncBindingCancellationIfNeeded();
    portal.setState(normalized);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    authIntentSeq += 1;
    authTriggerEl = null;
    clearPreservedInviteInput();
    boundaries.disposeCompanyEntry?.();
    root.removeEventListener?.('submit', onRootSubmitCapture, true);
    root.removeEventListener?.('click', onRootClickCapture, true);
    win?.removeEventListener?.('keydown', onWindowKeyDownCapture, true);
    win?.removeEventListener?.('pagehide', onPageHide);
    portal.dispose();
  }

  return Object.freeze({
    getState: () => portal.getState(),
    isActive: () => portal.isActive(),
    shouldBlockShortcuts: () => portal.shouldBlockShortcuts(),
    syncAccountState,
    openAuth,
    canAutoResumeCentralSession,
    resumeCentralSession,
    openPurposePicker: trigger => {
      portalUserInteracted = true;
      return portal.openPurposePicker(trigger);
    },
    closePurposePicker: () => portal.closePurposePicker(),
    handlePageShow,
    dispose,
  });
}
