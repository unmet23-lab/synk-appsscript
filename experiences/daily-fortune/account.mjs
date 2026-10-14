import { readConfig, beginOAuth, consumeCallback, tokenRequest } from '../synk-account/src/core.mjs';
import { emptyState, validateState } from './account-state.mjs';
import { createPlatformEntry } from '../synk-account/src/platform-entry.mjs';

const changed = () => Object.assign(new Error('로그인 계정이 바뀌었어요. 다시 불러와 주세요.'), { code: 'ACCOUNT_CHANGED' });
const networkFailure = () => Object.assign(new Error('계정 서버에 연결하지 못했어요. 연결이 돌아오면 다시 확인해 주세요.'), { code: 'NETWORK', retryable: true });
const messages = {
  REVISION_CONFLICT: '다른 화면에서 저장한 변경이 있어요. 최신 기록을 다시 불러온 뒤 저장해 주세요.',
  AUTH_REQUIRED: 'SYNK ID로 다시 로그인해 주세요.', SESSION_REVOKED: '로그인이 종료됐어요. 다시 연결해 주세요.',
  ACCOUNT_DELETION_PENDING: '삭제 요청 중인 계정에는 새 기록을 저장할 수 없어요.',
  FORTUNE_UNAVAILABLE: '운세 계정 저장 서비스가 아직 준비되지 않았어요. 연결 후 다시 불러와 주세요.',
};
export function createFortuneAccount({ native = globalThis.window?.synkFortuneAccount, fetcher = globalThis.fetch,
  storage, location = globalThis.location, replaceURL = value => history.replaceState(null, '', value),
  onState = () => {}, onReset = () => {} } = {}) {
  let config, session, account, document = emptyState(), revision = null, epoch = 0, refreshPromise, unsubscribe, disposed = false, loading, nativeAuthenticated = false, nativeGeneration = -1, starting = null, pendingExchange = null;
  let state = { status: 'loading', configured: false, account: null, ready: false, retryable: false, message: '계정 연결을 확인하고 있어요.' };
  const key = 'synk.oauth.session.fortune';
  const platformEntry = native ? null : createPlatformEntry({ clientKey: 'fortune', getUrl: () => location.href, replaceUrl: replaceURL });
  let automaticNavigations = 0;
  const emit = patch => { state = { ...state, ...patch };onState({ ...state }); };
  const guard = expected => { if (disposed || expected !== epoch) throw changed(); };
  const binding = () => [config.supabaseUrl, config.accountApiUrl, config.clients.platform.clientId, config.clients.platform.redirectUri].join('|');
  const reset = () => { epoch++;loading = null;account = null;revision = null;document = emptyState();onReset(); };
  function expire(message = '로그인 연결이 바뀌었어요. SYNK ID로 다시 연결해 주세요.') {
    nativeAuthenticated = false;session = null;pendingExchange = null;
    if (!native) { try { storage?.removeItem(key); } catch {} }
    reset();emit({ status: 'signed-out', account: null, ready: false, retryable: false, message });
  }
  const errorFor = (data, status) => Object.assign(new Error(
    data?.error?.code === 'ACCOUNT_UNAVAILABLE' && status === 403
      ? '이 계정 상태에서는 운세 정보를 이용할 수 없어요. SYNK 계정 화면에서 삭제 요청 등 계정 상태를 확인한 뒤 다시 불러와 주세요.'
      : messages[data?.error?.code] || (status === 404 ? '운세 계정 저장 서비스가 아직 연결되지 않았어요.' : '계정 저장을 완료하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')),
  { code: data?.error?.code || (status === 404 ? 'SERVICE_UNAVAILABLE' : 'ACCOUNT_UNAVAILABLE'), status, retryable: data?.error?.retryable === true || status === 429 || status >= 500 });
  async function refresh() {
    if (refreshPromise) return refreshPromise;
    const expected = epoch;
    refreshPromise = (async () => {
      if (!session?.refresh_token) throw errorFor({ error: { code: 'AUTH_REQUIRED' } }, 401);
      const renewed = await tokenRequest(config, { grant_type: 'refresh_token', client_id: config.clients.platform.clientId, refresh_token: session.refresh_token }, fetcher);
      guard(expected);session = { ...renewed, refresh_token: renewed.refresh_token || session.refresh_token };
      storage.setItem(key, JSON.stringify(session));
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  async function request(path, body, retry = true) {
    const expected = epoch;
    if (!session?.access_token) throw errorFor({ error: { code: 'AUTH_REQUIRED' } }, 401);
    if (session.expires_at <= Date.now() + 30000) await refresh();
    guard(expected);
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12000);
    try {
      let response;
      try { response = await fetcher(new URL(`/functions/v1/${path}`, config.accountApiUrl), {
        method: body === undefined ? 'GET' : 'POST', signal: abort.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${session.access_token}`, 'X-SYNK-Product': 'platform', 'X-SYNK-Contract': '1', 'X-SYNK-App-Version': '0.1.0', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }); } catch { throw networkFailure(); }
      guard(expected);
      if (response.status === 401 && retry && session.refresh_token) { await refresh();guard(expected);return request(path, body, false); }
      let text;try { text = await response.text(); } catch { throw networkFailure(); }guard(expected);
      if (text.length > 262144) throw new Error('계정 응답의 크기를 확인하지 못했어요.');
      let data;try { data = JSON.parse(text); } catch { throw errorFor(null, response.status); }
      if (!response.ok || data.ok !== true) throw errorFor(data, response.status);
      return data;
    } finally { clearTimeout(timer); }
  }
  async function invoke(operation, params = {}) {
    const expected = epoch;
    if (native && !nativeAuthenticated) throw errorFor({ error: { code: 'AUTH_REQUIRED' } }, 401);
    try {
      const data = native ? await native.request(operation, params) : await request(operation === 'load' ? 'synk-account' : 'synk-fortune', operation === 'fortunePut' ? { action: 'save', ...params } : operation === 'fortuneDelete' ? { action: 'delete', ...params } : undefined);
      guard(expected);
      if (!data?.ok) throw errorFor(data, data?.error?.status);
      return data;
    } catch (error) {
      // Rejected requests need the same account boundary as successful replies.
      // Otherwise an old transport failure can become the new account's notice.
      guard(expected);
      if (expected === epoch && (error.status === 401 || ['AUTH_REQUIRED', 'SESSION_REVOKED', 'AUTH_SESSION_MISSING'].includes(error.code)) && !(platformEntry?.accountId() && !account)) expire(error.message);
      else if (expected === epoch && error.code === 'ACCOUNT_UNAVAILABLE' && error.status === 403) {
        revision = null;emit({ ready: false, message: error.message });
      }
      throw error;
    }
  }
  function accept(data) {
    if (!account || data.account?.synk_user_id !== account.synk_user_id) { expire();throw changed(); }
    if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('계정 기록의 버전을 확인하지 못했어요.');
    document = validateState(data.state);revision = data.revision;
    emit({ status: 'signed-in', ready: true, account, retryable: false, message: 'SYNK 계정에서 운세 정보를 불러왔어요.' });
    return snapshot();
  }
  const snapshot = () => ({ account: account ? { ...account } : null, revision, state: structuredClone(document), ready: revision !== null });
  async function loadInternal() {
    const expected = epoch;
    if (native && !nativeAuthenticated) throw errorFor({ error: { code: 'AUTH_REQUIRED' } }, 401);
    revision = null;
    emit({ ready: false, message: '계정의 최신 기록을 불러오고 있어요.' });
    try {
      const identity = await invoke('load');guard(expected);
      if (typeof identity.account?.synk_user_id !== 'string') throw changed();
      platformEntry?.assertAccount(identity.account.synk_user_id);
      if (account && account.synk_user_id !== identity.account.synk_user_id) { expire();throw changed(); }
      account = { synk_user_id: identity.account.synk_user_id, display_name: identity.account.profile?.display_name || identity.account.display_name || 'SYNK 회원' };
      emit({ status: 'signed-in', account });
      return accept(await invoke('fortuneGet'));
    } catch (error) {
      if (expected === epoch) emit({ ready: false, message: error.message });
      throw error;
    }
  }
  function load() {
    if (loading?.epoch === epoch) return loading.promise;
    const current = { epoch, promise: null };
    current.promise = Promise.resolve().then(loadInternal).finally(() => { if (loading === current) loading = null; });
    loading = current;return current.promise;
  }
  async function nativeState(next) {
    if (next?.ok === false) throw errorFor(next, next.error?.status);
    if (!next || typeof next.configured !== 'boolean') throw new Error('앱의 로그인 상태를 확인하지 못했어요.');
    const nextGeneration = next.sessionGeneration ?? 0;
    if (!Number.isSafeInteger(nextGeneration) || nextGeneration < 0) throw new Error('앱의 로그인 순서를 확인하지 못했어요.');
    if (nextGeneration < nativeGeneration) return;
    nativeGeneration = nextGeneration;
    if (next.status === 'restoring' && !next.error && account && nextGeneration === state.sessionGeneration) return;
    const different = state.account?.synk_user_id !== next.account?.synk_user_id || state.sessionGeneration !== nextGeneration;
    const sameAccount = account && account.synk_user_id === next.account?.synk_user_id;
    nativeAuthenticated = next.signedIn === true;
    if (!next.signedIn || different && !sameAccount) reset();
    else if (different) {
      // A replacement token invalidates old requests, but not this person's
      // unsaved form. Keep onReset for sign-out or a different account only.
      epoch++;loading = null;revision = null;
    }
    emit({ configured: next.configured, status: next.signedIn ? 'signed-in' : next.status, account: next.account, sessionGeneration: nextGeneration, ready: revision !== null, retryable: false,
      message: next.signedIn ? 'SYNK 계정에 연결됐어요.' : next.configured ? '로그인하면 내 정보와 보관함을 이어갈 수 있어요.' : '계정 연결 설정 전이에요. 운세는 바로 볼 수 있어요.' });
    if (next.signedIn && (different || revision === null)) await load();
  }
  async function begin() {
    const expected = epoch;
    platformEntry?.capture(() => (storage ||= globalThis.sessionStorage));
    if (!native && state.status === 'signing-in') return snapshot();
    if (native) {
      unsubscribe?.();
      unsubscribe = native.onAuthChanged(next => { void nativeState(next).catch(error => { if (error.code !== 'ACCOUNT_CHANGED') emit({ message: error.message }); }); });
      const initial = await native.authStatus();guard(expected);await nativeState(initial);return snapshot();
    }
    let raw;
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8000);
    try {
      let response;try { response = await fetcher('./account-config.json', { cache: 'no-store', signal: abort.signal }); } catch { throw networkFailure(); }
      if (response.ok) { try { raw = await response.json(); } catch (error) { if (error?.name !== 'SyntaxError') throw networkFailure();throw error; } }
      else if (response.status !== 404) throw errorFor({ error: { code: 'AUTH_CONFIG' } }, response.status);
    } finally { clearTimeout(timer); }
    guard(expected);
    config = readConfig(raw || { version: 1 }, location.href);
    const client = config.clients.platform;
    if (!config.configured || !client.clientId || !client.redirectUri) { pendingExchange = null;emit({ status: 'unconfigured', configured: false, retryable: false, message: '계정 연결 설정 전이에요. 운세는 바로 볼 수 있어요.' });return snapshot(); }
    try { storage ||= globalThis.sessionStorage;if (!storage) throw new Error(); } catch { throw new Error('브라우저의 로그인 저장을 사용할 수 없어요. 저장 권한을 확인해 주세요.'); }
    const callback = new URL(client.redirectUri), here = new URL(location.href);
    const directory = new URL('./', here).pathname;
    if (callback.origin !== here.origin || ![directory, directory + 'index.html'].includes(callback.pathname) || callback.search || callback.hash) throw new Error('이 운세 화면에 등록된 로그인 도착 주소가 필요해요.');
    platformEntry.restore(storage);
    emit({ configured: true });
    if (platformEntry.isCancelled()) { session = null;pendingExchange = null;emit({ status: 'signed-out', account: null, ready: false, retryable: false, message: '이 화면에서 로그아웃했어요.' });return snapshot(); }
    const params = here.searchParams;
    if (params.has('code') || params.has('error')) {
      platformEntry.stop();
      try { pendingExchange = { fields: consumeCallback({ config, product: 'platform', url: location.href, storage }), binding: binding() }; }
      finally { for (const name of ['code', 'state', 'error', 'error_description']) here.searchParams.delete(name);replaceURL(here.href); }
    }
    if (pendingExchange) {
      // Retain only a validated exchange in this instance after the one-time
      // PKCE record and URL have been consumed. Never reuse it for new settings.
      if (pendingExchange.binding !== binding()) throw Object.assign(new Error('계정 연결 설정이 바뀌었어요. 다시 로그인해 주세요.'), { code: 'AUTH_REQUIRED' });
      const tokens = await tokenRequest(config, pendingExchange.fields, fetcher);guard(expected);pendingExchange = null;session = tokens;storage.setItem(key, JSON.stringify(session));
    } else if (!session) { try { session = JSON.parse(storage.getItem(key) || 'null'); } catch { storage.removeItem(key); } }
    if (!session?.access_token) { session = null;if (await automaticSignIn(expected)) return snapshot();emit({ status: 'signed-out', retryable: false, message: '로그인하면 내 정보와 보관함을 이어갈 수 있어요.' });return snapshot(); }
    try { const result = await load();guard(expected);platformEntry.stop();return result; }
    catch (error) {
      guard(expected);
      if (!platformEntry.accountId() || !(error.status === 401 || ['AUTH_REQUIRED', 'SESSION_REVOKED', 'AUTH_SESSION_MISSING', 'PLATFORM_ACCOUNT_MISMATCH'].includes(error.code))) throw error;
      session = null;storage.removeItem(key);
      if (await automaticSignIn(expected)) return snapshot();
      platformEntry.assertAccount(null);throw error;
    }
  }
  async function automaticSignIn(expected) {
    if (!platformEntry.beginAttempt()) return false;
    emit({ status: 'signing-in', account: null, ready: false, retryable: false, message: '플랫폼의 SYNK ID로 연결하고 있어요.' });
    const destination = await beginOAuth({ config, product: 'platform', storage });guard(expected);automaticNavigations++;location.assign(destination);return true;
  }
  function start() {
    if (disposed) return Promise.reject(changed());
    if (starting?.epoch === epoch) return starting.promise;
    const current = { epoch, promise: null };
    current.promise = Promise.resolve().then(() => { guard(current.epoch);return begin(); }).catch(error => {
      if (!disposed && current.epoch === epoch) {
        if (!error.retryable) pendingExchange = null;
        emit({ status: account ? 'signed-in' : 'error', ready: revision !== null, retryable: error.retryable === true, message: error.message });
      }
      throw error;
    }).finally(() => { if (starting === current) starting = null; });
    starting = current;return current.promise;
  }
  async function signIn() {
    const expected = epoch;
    const before = automaticNavigations;
    if (native) { const next = await native.authSignIn();guard(expected);return nativeState(next); }
    if (!config || state.retryable || pendingExchange) { await start();guard(expected);if (account) return snapshot(); }
    if (automaticNavigations !== before) return snapshot();
    platformEntry.resume();
    if (session?.access_token) return load();
    const destination = await beginOAuth({ config, product: 'platform', storage });guard(expected);location.assign(destination);
  }
  async function signOut() {
    let entryError;try { platformEntry?.cancel(); } catch (error) { entryError = error; }
    const previous = session;nativeAuthenticated = false;reset();session = null;pendingExchange = null;
    emit({ status: 'signed-out', account: null, ready: false, retryable: false, message: entryError?.message || '이 화면에서 로그아웃했어요.' });
    if (native) {
      const result = await native.authSignOut();
      if (!account && (result?.ok === false || result?.serverRevoked === false)) emit({ message: '이 화면에서 로그아웃했어요. 기기 저장과 서버의 로그인 종료는 다시 확인해 주세요.' });
      return result;
    }
    try { storage.removeItem(key); } catch { emit({ message: '브라우저의 로그인 저장을 지우지 못했어요. 이 창을 닫아 주세요.' }); }
    if (previous?.access_token) {
      try {
        const response = await fetcher(new URL('/auth/v1/logout?scope=local', config.supabaseUrl), { method: 'POST', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(12000), headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${previous.access_token}` } });
        if (!response.ok) throw new Error();
      } catch { emit({ message: '이 화면에서 로그아웃했어요. 서버의 로그인 종료는 다시 확인해 주세요.' }); }
    }
    if (entryError) { emit({ message: entryError.message });return { ok: false, error: { code: entryError.code, message: entryError.message } }; }
  }
  async function save(value) {
    const expected = epoch;
    if (revision === null) throw new Error('계정의 최신 기록을 먼저 불러와 주세요.');
    const next = validateState(value);
    const data = await invoke('fortunePut', { expected_revision: revision, state: next });guard(expected);return accept(data);
  }
  async function remove() {
    const expected = epoch;
    if (revision === null) throw new Error('계정의 최신 기록을 먼저 불러와 주세요.');
    const data = await invoke('fortuneDelete', { expected_revision: revision });guard(expected);return accept(data);
  }
  return { start, signIn, signOut, load, save, remove, snapshot, cancel: () => native?.authCancelSignIn(),
    dispose() { disposed = true;session = null;pendingExchange = null;reset();unsubscribe?.(); } };
}
