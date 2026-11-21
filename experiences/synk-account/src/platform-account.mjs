import { createAccountClient } from './generated/account-client.cjs';
import { tokenRequest } from './core.mjs';
import { requestCompanySpaces } from './company-spaces.mjs';

const SESSION_KEY = 'synk.oauth.session.platform';
const AUTH_ERRORS = new Set(['AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_REVOKED']);
const changed = () => Object.assign(new Error('계정 연결이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' });

export const PURPOSE_ONBOARDING_OUTCOMES = Object.freeze(['chosen', 'skipped', 'not-asked']);

export function normalizePurposeOnboarding(onboarding) {
  return onboarding?.purpose === 'pending' ? 'pending' : 'none';
}

// Reuse the platform client's existing tab session. Tokens remain private.
export function createPlatformAccount({ config, storage, onStatus = () => {},
  accountFactory = createAccountClient, requestToken = tokenRequest, fetcher = globalThis.fetch } = {}) {
  let generation = 0, accountGeneration = 0, disposed = false, controller = null, inFlight = null;
  // learningSync: the account's release policy for writing learning memory (capabilities.learningSync).
  let accountId = null, authenticatedClient = null, learningSync = false;
  // Private verified account binding: preserved across ordinary refreshes of the same stored session,
  // and revoked immediately on logout, session replacement, auth errors, or verified account switch.
  let binding = null;
  const completedPurposeAccounts = new Set();
  const listeners = new Set();

  function readRawSession() {
    if (!storage || typeof storage.getItem !== 'function') return { ok: false, raw: null };
    try {
      return { ok: true, raw: storage.getItem(SESSION_KEY) };
    } catch {
      return { ok: false, raw: null };
    }
  }

  function revokeBinding(target = binding) {
    if (!target || target.revoked) return false;
    target.revoked = true;
    target.renewPromise = null;
    target.completionPromise = null;
    if (binding === target) {
      binding = null;
      accountGeneration++;
    }
    return true;
  }

  function isBindingStillValid(target = binding) {
    if (disposed || !target || target.revoked || binding !== target) return false;
    const stored = readRawSession();
    if (!stored.ok || !stored.raw || stored.raw !== target.rawSession) {
      revokeBinding(target);
      return false;
    }
    return true;
  }

  function syncStoredSessionBinding() {
    if (!binding) return;
    isBindingStillValid(binding);
  }

  const identity = () => {
    syncStoredSessionBinding();
    const boundValid = Boolean(binding && !binding.revoked);
    const isSignedIn = snapshot.status === 'signed-in'
      && typeof accountId === 'string'
      && !!accountId
      && boundValid
      && binding.accountId === accountId;
    const normalizedStatus = snapshot.status === 'loading'
      ? 'restoring'
      : (snapshot.status === 'signed-in' && !isSignedIn ? 'signed-out' : snapshot.status);
    const verifiedKey = (normalizedStatus === 'signed-out' || normalizedStatus === 'unconfigured')
      ? null
      : (isSignedIn ? accountId : (boundValid ? binding.accountId : null));
    const purpose = isSignedIn ? binding.onboardingPurpose : 'none';
    return {
      configured: !!config?.configured,
      signedIn: isSignedIn,
      status: normalizedStatus,
      accountId: isSignedIn ? accountId : null,
      accountKey: verifiedKey,
      sessionGeneration: generation,
      accountGeneration,
      learningSync: isSignedIn && learningSync,
      onboarding: { purpose },
      error: snapshot.status === 'error' ? { message: snapshot.message, retryable: true } : null,
    };
  };

  let snapshot = { status: 'loading', displayName: '', message: '로그인 상태를 확인하고 있어요.' };
  const status = () => ({ ...snapshot });
  const notifyIdentityListeners = () => {
    if (!disposed) for (const listener of listeners) listener(identity());
  };
  const emit = (phase, message = '', displayName = '') => {
    snapshot = { status: phase, displayName, message };
    if (!disposed) onStatus(status());
    notifyIdentityListeners();
    return status();
  };

  function terminateSignedOutSession(target = binding) {
    revokeBinding(target);
    generation++;
    controller?.abort();
    controller = null;
    accountId = null;
    authenticatedClient = null;
    learningSync = false;
    if (!disposed) emit('signed-out', '로그인이 끝났어요. 다시 로그인해 주세요.');
  }

  function isCurrentExpiredBinding(targetBinding) {
    if (disposed || !targetBinding?.authExpired || binding !== null) return false;
    const stored = readRawSession();
    return Boolean(stored.ok && stored.raw && stored.raw === targetBinding.rawSession);
  }

  function expireAuthForBinding(targetBinding) {
    if (!targetBinding) return false;
    if (targetBinding.authExpired) return isCurrentExpiredBinding(targetBinding);
    if (!isBindingStillValid(targetBinding)) return false;
    targetBinding.authExpired = true;
    terminateSignedOutSession(targetBinding);
    return true;
  }

  async function renewBoundSession(targetBinding, failedToken) {
    if (!isBindingStillValid(targetBinding)) throw changed();
    if (targetBinding.renewPromise) {
      const sharedToken = await targetBinding.renewPromise;
      if (!isBindingStillValid(targetBinding)) throw changed();
      return sharedToken;
    }
    if (typeof failedToken === 'string' && failedToken && targetBinding.accessToken && targetBinding.accessToken !== failedToken) {
      return targetBinding.accessToken;
    }
    if (!targetBinding.refreshToken) return null;

    const clientId = config?.clients?.platform?.clientId;
    if (!clientId) throw changed();
    const refreshTokenAtStart = targetBinding.refreshToken;
    const rawAtStart = targetBinding.rawSession;

    const task = (async () => {
      try {
        const result = await requestToken(
          config,
          { grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshTokenAtStart },
          fetcher,
        );
        if (disposed || targetBinding.revoked || binding !== targetBinding) throw changed();
        const stored = readRawSession();
        if (!stored.ok || stored.raw !== rawAtStart) {
          revokeBinding(targetBinding);
          throw changed();
        }
        if (typeof result?.access_token !== 'string' || !result.access_token) {
          throw new Error('Invalid token response');
        }
        const nextSession = {
          ...result,
          refresh_token: result.refresh_token || refreshTokenAtStart,
        };
        const nextRaw = JSON.stringify(nextSession);
        storage.setItem(SESSION_KEY, nextRaw);
        targetBinding.rawSession = nextRaw;
        targetBinding.accessToken = nextSession.access_token;
        targetBinding.refreshToken = nextSession.refresh_token || null;
        return nextSession.access_token;
      } catch (error) {
        if (AUTH_ERRORS.has(error?.code)) {
          expireAuthForBinding(targetBinding);
        }
        throw error;
      } finally {
        if (targetBinding.renewPromise === task) {
          targetBinding.renewPromise = null;
        }
      }
    })();

    targetBinding.renewPromise = task;
    return task;
  }

  function invalidate() {
    generation++;
    controller?.abort();
    controller = null;
    accountId = null;
    authenticatedClient = null;
    learningSync = false;
    syncStoredSessionBinding();
    if (!disposed) emit('loading', '로그인 상태를 확인하고 있어요.');
  }

  async function load() {
    if (disposed) return status();
    invalidate();
    const expected = generation;
    if (!config?.configured || !config.clients?.platform?.clientId || !config.clients.platform.redirectUri) {
      revokeBinding();
      return emit('unconfigured', '이 화면에는 로그인 설정이 아직 없어요. 앱과 혜택은 로그인 없이 볼 수 있어요.');
    }
    const stored = readRawSession();
    if (!stored.ok) {
      revokeBinding();
      return emit('error', '브라우저가 저장 공간을 막아 로그인 정보를 못 읽었어요. 사이트 데이터 저장을 허용한 뒤 다시 시도해 주세요.');
    }
    let raw = stored.raw, session;
    try {
      session = JSON.parse(raw || 'null');
    } catch {
      revokeBinding();
      return emit('error', '브라우저가 저장 공간을 막아 로그인 정보를 못 읽었어요. 사이트 데이터 저장을 허용한 뒤 다시 시도해 주세요.');
    }
    if (!session?.access_token || typeof session.access_token !== 'string') {
      revokeBinding();
      return emit('signed-out', '로그인하면 즐겨찾기를 계정에 저장하고 내 성향 요약도 볼 수 있어요.');
    }
    if (binding && raw !== binding.rawSession) {
      revokeBinding();
    }
    let activeBinding = binding && !binding.revoked && binding.rawSession === raw ? binding : null;
    let initialRenewPromise = null;
    const abort = controller = new AbortController();
    const isActiveBindingValid = () => Boolean(activeBinding && !activeBinding.revoked && binding === activeBinding);
    const syncFromBound = () => {
      if (isActiveBindingValid() && raw !== activeBinding.rawSession) {
        raw = activeBinding.rawSession;
        session = {
          ...session,
          access_token: activeBinding.accessToken,
          refresh_token: activeBinding.refreshToken,
        };
      }
    };
    const guard = () => {
      syncFromBound();
      if (disposed || expected !== generation) throw changed();
      if (activeBinding && !isActiveBindingValid()) throw changed();
      const latest = readRawSession();
      if (!latest.ok || latest.raw !== raw) {
        if (isActiveBindingValid() && latest.ok && latest.raw === activeBinding.rawSession) {
          syncFromBound();
          return;
        }
        if (activeBinding) revokeBinding(activeBinding);
        throw changed();
      }
    };
    const guardedFetch = (url, options = {}) => {
      guard();
      return fetcher(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, abort.signal]) : abort.signal });
    };
    const renew = async failedToken => {
      guard();
      if (isActiveBindingValid()) {
        const renewedToken = await renewBoundSession(activeBinding, failedToken);
        syncFromBound();
        guard();
        return renewedToken;
      }
      if (activeBinding) throw changed();
      if (initialRenewPromise) {
        const sharedToken = await initialRenewPromise;
        guard();
        return sharedToken;
      }
      if (typeof failedToken === 'string' && failedToken && session.access_token && session.access_token !== failedToken) {
        return session.access_token;
      }
      if (!session.refresh_token) return null;
      const task = (async () => {
        try {
          const result = await requestToken(config, { grant_type: 'refresh_token', client_id: config.clients.platform.clientId, refresh_token: session.refresh_token }, guardedFetch);
          guard();
          if (typeof result?.access_token !== 'string' || !result.access_token) throw new Error('Invalid token response');
          const next = { ...result, refresh_token: result.refresh_token || session.refresh_token }, nextRaw = JSON.stringify(next);
          storage.setItem(SESSION_KEY, nextRaw);
          raw = nextRaw;
          session = next;
          return session.access_token;
        } finally {
          if (initialRenewPromise === task) initialRenewPromise = null;
        }
      })();
      initialRenewPromise = task;
      return task;
    };
    let client = null;
    try {
      client = accountFactory({
        url: config.accountApiUrl,
        anonKey: config.supabasePublishableKey,
        product: 'platform',
        guard,
        getAccessToken: () => {
          guard();
          return session.access_token;
        },
        refresh: renew,
        fetch: guardedFetch,
      });
      const result = await client.load();
      guard();
      if (result?.ok !== true || typeof result.account?.synk_user_id !== 'string' || !result.account.synk_user_id) {
        throw new Error('Invalid account response');
      }
      const verifiedId = result.account.synk_user_id;
      const normalizedPurpose = completedPurposeAccounts.has(verifiedId)
        ? 'none'
        : normalizePurposeOnboarding(result.onboarding);
      if (binding && !binding.revoked && binding.accountId === verifiedId) {
        binding.accessToken = session.access_token;
        binding.refreshToken = session.refresh_token || binding.refreshToken;
        binding.rawSession = raw;
        binding.onboardingPurpose = normalizedPurpose;
      } else {
        if (binding) binding.revoked = true;
        accountGeneration++;
        binding = {
          accountId: verifiedId,
          generation: accountGeneration,
          accessToken: session.access_token,
          refreshToken: session.refresh_token || null,
          rawSession: raw,
          onboardingPurpose: normalizedPurpose,
          renewPromise: null,
          completionPromise: null,
          authExpired: false,
          revoked: false,
        };
      }
      activeBinding = binding;
      const name = result.account.profile?.display_name;
      accountId = verifiedId;
      authenticatedClient = client;
      learningSync = result.capabilities?.learningSync === true;
      return emit('signed-in', '「학습 기록 연결」은 「내 계정 관리」에서 켜고 꺼요.', typeof name === 'string' ? name.trim().slice(0, 80) : '');
    } catch (error) {
      if (disposed || expected !== generation) return status();
      // A logout or replacement in the same tab always wins over a late reply.
      if (error?.code === 'ACCOUNT_CHANGED') return load();
      if (AUTH_ERRORS.has(error?.code)) {
        const latest = readRawSession();
        if (latest.ok && latest.raw && latest.raw !== raw) return load();
        terminateSignedOutSession();
        return status();
      }
      // A failed read does not revoke or erase the existing session unless storage changed.
      syncStoredSessionBinding();
      return emit('error', '계정 서버에 닿지 못했어요. 로그인은 그대로이니 잠시 뒤 「다시 시도」를 눌러 주세요.');
    } finally {
      if (controller === abort && authenticatedClient !== client) controller = null;
    }
  }

  function refresh() {
    if (disposed) return Promise.resolve(status());
    if (inFlight?.generation === generation) return inFlight.promise;
    const promise = load(), current = { generation, promise };
    inFlight = current;
    void promise.finally(() => { if (inFlight === current) inFlight = null; });
    return promise;
  }

  function isAccountBound(expectedAccountId) {
    if (typeof expectedAccountId !== 'string') return false;
    const trimmed = expectedAccountId.trim();
    if (!trimmed) return false;
    return isBindingStillValid(binding) && binding.accountId === trimmed;
  }

  async function completePurposeOnboarding(outcome, { accountId: expectedAccountId, keepalive = true, signal } = {}) {
    if (!PURPOSE_ONBOARDING_OUTCOMES.includes(outcome)) {
      return { ok: false, code: 'INVALID_OUTCOME', message: '방문 목적 완료 요청 형식을 확인해 주세요.' };
    }
    const targetAccountId = typeof expectedAccountId === 'string'
      ? expectedAccountId.trim()
      : (snapshot.status === 'signed-in' && typeof accountId === 'string' ? accountId : '');
    const bindingRef = binding;
    if (!targetAccountId || !bindingRef || bindingRef.accountId !== targetAccountId || !isBindingStillValid(bindingRef)) {
      return { ok: false, code: 'ACCOUNT_CHANGED', message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.' };
    }
    if (completedPurposeAccounts.has(targetAccountId)) {
      bindingRef.onboardingPurpose = 'none';
      return { ok: true, persisted: true, onboarding: { purpose: 'none' } };
    }
    if (!config?.configured || !config.clients?.platform?.clientId || !config.clients.platform.redirectUri) {
      return { ok: false, code: 'ACCOUNT_CHANGED', message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.' };
    }

    if (bindingRef.completionPromise) {
      const sharedResult = await bindingRef.completionPromise;
      if (isCurrentExpiredBinding(bindingRef)) return sharedResult;
      if (!isBindingStillValid(bindingRef)) {
        return { ok: false, code: 'ACCOUNT_CHANGED', message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.' };
      }
      return sharedResult;
    }

    const ensureBound = () => {
      if (!isBindingStillValid(bindingRef)) throw changed();
    };

    const task = (async () => {
      try {
        const completionClient = accountFactory({
          url: config.accountApiUrl,
          anonKey: config.supabasePublishableKey,
          product: 'platform',
          guard: ensureBound,
          getAccessToken: () => {
            ensureBound();
            return bindingRef.accessToken;
          },
          refresh: failedToken => renewBoundSession(bindingRef, failedToken),
          fetch: fetcher,
        });
        await completionClient.completePurposeOnboarding(outcome, {
          keepalive: keepalive !== false,
          ...(signal ? { signal } : {}),
        });
        ensureBound();
        completedPurposeAccounts.add(targetAccountId);
        bindingRef.onboardingPurpose = 'none';
        notifyIdentityListeners();
        return { ok: true, persisted: true, onboarding: { purpose: 'none' } };
      } catch (error) {
        if (isCurrentExpiredBinding(bindingRef) || (AUTH_ERRORS.has(error?.code) && expireAuthForBinding(bindingRef))) {
          return { ok: false, code: 'ACCOUNT_CHANGED', message: '로그인이 끝났어요. 다시 로그인해 주세요.' };
        }
        if (!isBindingStillValid(bindingRef) || error?.code === 'ACCOUNT_CHANGED') {
          return { ok: false, code: 'ACCOUNT_CHANGED', message: '계정 연결이 바뀌었어요. 다시 확인해 주세요.' };
        }
        bindingRef.onboardingPurpose = 'none';
        notifyIdentityListeners();
        return { ok: true, persisted: false, onboarding: { purpose: 'none' } };
      } finally {
        if (bindingRef.completionPromise === task) {
          bindingRef.completionPromise = null;
        }
      }
    })();

    bindingRef.completionPromise = task;
    return task;
  }

  // synk.im 홈 「회사 공간」 칸(11-21): 회사 서버에 이 탭의 SYNK 플랫폼 로그인으로 자기 배정만 묻는다. 토큰은 이 모듈 밖으로 내지 않고,
  // 배정된 목적지('/' · '/pulse-app/')만 돌려준다. 로그인이 만료됐다는 답이면 한 번만 새로 받아 다시 묻는다. 확인하지 못하면 null이다.
  async function companySpaces(targetAccountId, { signal } = {}) {
    if (!isAccountBound(targetAccountId)) throw changed();
    const ref = binding;
    let token = ref.accessToken;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await requestCompanySpaces({ fetch: fetcher, token, expectedAccountId: ref.accountId, signal });
      if (!isBindingStillValid(ref)) throw changed();
      if (result.destinations) return result.destinations;
      if (result.code !== 'AUTH_REQUIRED' || attempt) return null;
      token = await renewBoundSession(ref, token);
      if (!isBindingStillValid(ref)) throw changed();
      if (typeof token !== 'string' || !token) return null;
    }
    return null;
  }

  return Object.freeze({
    status,
    identity,
    refresh,
    invalidate,
    isAccountBound,
    completePurposeOnboarding,
    companySpaces,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async request(operation, params) {
      if (!['platformLoad', 'platformSave', 'platformDelete', 'atlasSummary', 'insightLoad', 'insightSave', 'insightDelete', 'understandingLoad', 'understandingSave', 'understandingDelete', 'memoryGet', 'memoryPost'].includes(operation) || !authenticatedClient || snapshot.status !== 'signed-in' || !isAccountBound(accountId)) throw changed();
      if (operation === 'atlasSummary' && params && Object.keys(params).length) throw changed();
      // Learning memory (the chosen presentation 「내 성향」 saves): the same SDK routes WORLD uses.
      if (operation.startsWith('memory') && (!Number.isSafeInteger(params?.revision) || operation === 'memoryPost' && (!Array.isArray(params.entries) || !params.entries.length || params.entries.length > 100))) throw Object.assign(new Error('요청 형식이 맞지 않아요.'), { code: 'INVALID_REQUEST' });
      const expected = generation, owner = accountId, ownerBinding = binding;
      try {
        const result = await (operation === 'memoryGet' ? authenticatedClient.memory.get({ revision: params.revision }) : operation === 'memoryPost' ? authenticatedClient.memory.post({ revision: params.revision, entries: params.entries }) : authenticatedClient[operation](params));
        if (expected !== generation || disposed || accountId !== owner || !isAccountBound(owner)) throw changed();
        if (operation.startsWith('insight') && result?.ok === true && (result.scope !== 'synk-personal' || result.resource !== 'member-insight' || result.accountId !== owner)) { invalidate(); throw changed(); }
        if (operation.startsWith('understanding') && result?.ok === true && (result.scope !== 'synk-personal' || result.resource !== 'member-understanding' || result.accountId !== owner)) { invalidate(); throw changed(); }
        return result;
      } catch (error) {
        if (AUTH_ERRORS.has(error?.code)) {
          if (!expireAuthForBinding(ownerBinding)) {
            throw changed();
          }
          throw error;
        }
        if (disposed || expected !== generation) throw changed();
        throw error;
      }
    },
    stop() {
      disposed = true;
      generation++;
      revokeBinding();
      controller?.abort();
      controller = null;
      accountId = null;
      authenticatedClient = null;
      learningSync = false;
      listeners.clear();
      snapshot = { status: 'signed-out', displayName: '', message: '' };
    },
  });
}
