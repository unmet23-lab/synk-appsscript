import { createClient } from '@supabase/supabase-js';
import {
  PLATFORM_LOGIN_INTENT,
  PLATFORM_LOGIN_NOTICE,
  hasPlatformAutoLoginAttempt,
  isPlatformAutoLoginPaused,
} from './platform-login-return.mjs';

const PLATFORM_SESSION_KEY = 'synk.oauth.session.platform';
const PLATFORM_PENDING_KEY = 'synk.oauth.pending.platform';
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007F]/;
const DEFAULT_PROBE_TIMEOUT_MS = 5000;

function isUsableStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function') return false;
  try {
    storage.getItem(PLATFORM_AUTO_LOGIN_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

const PLATFORM_AUTO_LOGIN_PROBE_KEY = 'synk.platform.auto-login.pause.v1';

function isValidSubject(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 200
    && !CONTROL_OR_SPACE.test(value);
}

function hasGoogleIdentity(user) {
  if (!Array.isArray(user?.identities)) return false;
  return user.identities.some(identity => identity?.provider === 'google');
}

function withTimeout(promise, timeoutMs) {
  let timer = null;
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_PROBE_TIMEOUT_MS;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('timeout');
        error.code = 'PROBE_TIMEOUT';
        reject(error);
      }, ms);
    }),
  ]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  });
}

async function verifyGoogleOnboardingComplete({ config, accessToken, fetchFn, timeoutMs }) {
  const baseUrl = config?.accountApiUrl || config?.supabaseUrl;
  if (typeof baseUrl !== 'string' || !baseUrl) return false;

  let endpoint;
  try {
    endpoint = new URL('/functions/v1/synk-account?view=registration', baseUrl).href;
  } catch {
    return false;
  }

  const abort = new AbortController();
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_PROBE_TIMEOUT_MS;
  const timer = setTimeout(() => abort.abort(), ms);
  try {
    const response = await fetchFn(endpoint, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: abort.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabasePublishableKey,
        'x-synk-contract': '1',
        'x-synk-product': 'platform',
        'x-synk-app-version': '0.2.0',
      },
    });
    if (!response?.ok) return false;
    const payload = await response.json();
    return payload?.ok === true && payload?.registration?.required === false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// 같은 출처 중앙 SYNK ID(/id/)의 공식 Supabase 세션을 확인해 유효한 계정의 식별자만 돌려준다.
// 토큰은 저장하거나 내보내지 않고, 오프라인·오류·가입 미완료·명시적 로그아웃 상태에서는 조용히 건너뛴다.
export async function probeCentralPlatformSession(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const {
    config,
    sessionStorageRef = (() => {
      try { return globalThis.sessionStorage || null; } catch { return null; }
    })(),
    localStorageRef = (() => {
      try { return globalThis.localStorage || null; } catch { return null; }
    })(),
    createSdk = createClient,
    fetchFn = globalThis.fetch,
    timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  } = opts;

  const platformClient = config?.clients?.platform;
  if (
    !config?.configured
    || typeof config.supabaseUrl !== 'string'
    || !config.supabaseUrl
    || typeof config.supabasePublishableKey !== 'string'
    || !config.supabasePublishableKey
    || typeof platformClient?.clientId !== 'string'
    || !platformClient.clientId
    || typeof platformClient?.redirectUri !== 'string'
    || !platformClient.redirectUri
  ) {
    return Object.freeze({ ok: false, reason: 'unconfigured' });
  }

  if (!isUsableStorage(sessionStorageRef) || !isUsableStorage(localStorageRef)) {
    return Object.freeze({ ok: false, reason: 'storage-unavailable' });
  }

  try {
    if (
      sessionStorageRef.getItem(PLATFORM_SESSION_KEY) !== null
      || sessionStorageRef.getItem(PLATFORM_PENDING_KEY) !== null
      || sessionStorageRef.getItem(PLATFORM_LOGIN_INTENT) !== null
      || sessionStorageRef.getItem(PLATFORM_LOGIN_NOTICE) !== null
      || hasPlatformAutoLoginAttempt(sessionStorageRef)
    ) {
      return Object.freeze({ ok: false, reason: 'already-handled' });
    }
  } catch {
    return Object.freeze({ ok: false, reason: 'storage-unavailable' });
  }

  if (isPlatformAutoLoginPaused(localStorageRef)) {
    return Object.freeze({ ok: false, reason: 'paused' });
  }

  let sdk;
  try {
    sdk = createSdk(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: false,
        storage: localStorageRef,
      },
    });
  } catch {
    return Object.freeze({ ok: false, reason: 'sdk-unavailable' });
  }

  let currentSession = null;
  try {
    const stored = await withTimeout(Promise.resolve(sdk.auth.getSession()), timeoutMs);
    if (stored?.error) {
      return Object.freeze({ ok: false, reason: 'signed-out' });
    }
    currentSession = stored?.data?.session || null;
  } catch {
    return Object.freeze({ ok: false, reason: 'signed-out' });
  }

  if (
    !currentSession
    || typeof currentSession.access_token !== 'string'
    || !currentSession.access_token
    || !isValidSubject(currentSession.user?.id)
  ) {
    return Object.freeze({ ok: false, reason: 'signed-out' });
  }

  let activeSession = currentSession;
  let verifiedUser = null;

  try {
    const checked = await withTimeout(Promise.resolve(sdk.auth.getUser()), timeoutMs);
    if (
      !checked?.error
      && isValidSubject(checked?.data?.user?.id)
      && checked.data.user.id === activeSession.user.id
    ) {
      verifiedUser = checked.data.user;
    } else if (
      typeof activeSession.refresh_token === 'string'
      && activeSession.refresh_token
      && typeof sdk.auth.refreshSession === 'function'
    ) {
      const refreshed = await withTimeout(Promise.resolve(sdk.auth.refreshSession()), timeoutMs);
      const nextSession = refreshed?.data?.session || null;
      if (
        !refreshed?.error
        && nextSession
        && typeof nextSession.access_token === 'string'
        && nextSession.access_token
        && isValidSubject(nextSession.user?.id)
      ) {
        activeSession = nextSession;
        const rechecked = await withTimeout(Promise.resolve(sdk.auth.getUser()), timeoutMs);
        if (
          !rechecked?.error
          && isValidSubject(rechecked?.data?.user?.id)
          && rechecked.data.user.id === activeSession.user.id
        ) {
          verifiedUser = rechecked.data.user;
        }
      }
    }
  } catch {
    return Object.freeze({ ok: false, reason: 'unverified' });
  }

  if (!verifiedUser || !isValidSubject(verifiedUser.id)) {
    return Object.freeze({ ok: false, reason: 'unverified' });
  }

  if (hasGoogleIdentity(verifiedUser)) {
    if (typeof fetchFn !== 'function') {
      return Object.freeze({ ok: false, reason: 'registration-unverified' });
    }
    const onboardingDone = await verifyGoogleOnboardingComplete({
      config,
      accessToken: activeSession.access_token,
      fetchFn,
      timeoutMs,
    });
    if (!onboardingDone) {
      return Object.freeze({ ok: false, reason: 'registration-incomplete' });
    }
  }

  return Object.freeze({
    ok: true,
    subject: verifiedUser.id,
  });
}
