import { readConfig, beginOAuth, consumeCallback, tokenRequest } from '../synk-account/src/core.mjs';
import { emptyState, validateState } from './account-state.mjs';

const changed = () => Object.assign(new Error('로그인 계정이 바뀌었어요. 다시 불러와 주세요.'), { code: 'ACCOUNT_CHANGED' });
const messages = {
  REVISION_CONFLICT: '다른 화면에서 저장한 변경이 있어요. 최신 기록을 다시 불러온 뒤 저장해 주세요.',
  AUTH_REQUIRED: 'SYNK ID로 다시 로그인해 주세요.', SESSION_REVOKED: '로그인이 종료됐어요. 다시 연결해 주세요.',
  ACCOUNT_DELETION_PENDING: '삭제 요청 중인 계정에는 새 기록을 저장할 수 없어요.',
  FORTUNE_UNAVAILABLE: '운세 계정 저장 서비스가 아직 준비되지 않았어요. 연결 후 다시 불러와 주세요.',
};
export function createFortuneAccount({ native = globalThis.window?.synkFortuneAccount, fetcher = globalThis.fetch,
  storage, location = globalThis.location, replaceURL = value => history.replaceState(null, '', value),
  onState = () => {}, onReset = () => {} } = {}) {
  let config, session, account, document = emptyState(), revision = null, epoch = 0, refreshPromise, unsubscribe, disposed = false, loading, nativeAuthenticated = false;
  let state = { status: 'loading', configured: false, account: null, ready: false, message: '계정 연결을 확인하고 있어요.' };
  const key = 'synk.oauth.session.fortune';
  const emit = patch => { state = { ...state, ...patch };onState({ ...state }); };
  const guard = expected => { if (disposed || expected !== epoch) throw changed(); };
  const reset = () => { epoch++;loading = null;account = null;revision = null;document = emptyState();onReset(); };
  function expire(message = '로그인 연결이 바뀌었어요. SYNK ID로 다시 연결해 주세요.') {
    nativeAuthenticated = false;session = null;
    if (!native) { try { storage?.removeItem(key); } catch {} }
    reset();emit({ status: 'signed-out', account: null, ready: false, message });
  }
  const errorFor = (data, status) => Object.assign(new Error(
    data?.error?.code === 'ACCOUNT_UNAVAILABLE' && status === 403
      ? '이 계정 상태에서는 운세 정보를 이용할 수 없어요. SYNK 계정 화면에서 삭제 요청 등 계정 상태를 확인한 뒤 다시 불러와 주세요.'
      : messages[data?.error?.code] || (status === 404 ? '운세 계정 저장 서비스가 아직 연결되지 않았어요.' : '계정 저장을 완료하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')),
  { code: data?.error?.code || (status === 404 ? 'SERVICE_UNAVAILABLE' : 'ACCOUNT_UNAVAILABLE'), status });
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
      const response = await fetcher(new URL(`/functions/v1/${path}`, config.accountApiUrl), {
        method: body === undefined ? 'GET' : 'POST', signal: abort.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${session.access_token}`, 'X-SYNK-Product': 'platform', 'X-SYNK-Contract': '1', 'X-SYNK-App-Version': '0.1.0', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      guard(expected);
      if (response.status === 401 && retry && session.refresh_token) { await refresh();guard(expected);return request(path, body, false); }
      const text = await response.text();guard(expected);
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
      if (expected === epoch && (error.status === 401 || ['AUTH_REQUIRED', 'SESSION_REVOKED', 'AUTH_SESSION_MISSING'].includes(error.code))) expire(error.message);
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
    emit({ status: 'signed-in', ready: true, account, message: 'SYNK 계정에서 운세 정보를 불러왔어요.' });
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
    if (next.status === 'restoring' && !next.error && account && next.sessionGeneration === state.sessionGeneration) return;
    const different = state.account?.synk_user_id !== next.account?.synk_user_id || state.sessionGeneration !== next.sessionGeneration;
    nativeAuthenticated = next.signedIn === true;
    if (!next.signedIn || different) reset();
    emit({ configured: next.configured, status: next.signedIn ? 'signed-in' : next.status, account: next.account, sessionGeneration: next.sessionGeneration, ready: revision !== null,
      message: next.signedIn ? 'SYNK 계정에 연결됐어요.' : next.configured ? '로그인하면 내 정보와 보관함을 이어갈 수 있어요.' : '계정 연결 설정 전이에요. 운세는 바로 볼 수 있어요.' });
    if (next.signedIn && (different || revision === null)) await load();
  }
  async function start() {
    const expected = epoch;
    if (native) {
      unsubscribe = native.onAuthChanged(next => { void nativeState(next).catch(error => { if (error.code !== 'ACCOUNT_CHANGED') emit({ message: error.message }); }); });
      const initial = await native.authStatus();guard(expected);await nativeState(initial);return snapshot();
    }
    let raw;
    try { const response = await fetcher('./account-config.json', { cache: 'no-store' });if (response.ok) raw = await response.json(); } catch {}
    guard(expected);
    config = readConfig(raw || { version: 1 }, location.href);
    const client = config.clients.platform;
    if (!config.configured || !client.clientId || !client.redirectUri) { emit({ status: 'unconfigured', configured: false, message: '계정 연결 설정 전이에요. 운세는 바로 볼 수 있어요.' });return snapshot(); }
    try { storage ||= globalThis.sessionStorage;if (!storage) throw new Error(); } catch { throw new Error('브라우저의 로그인 저장을 사용할 수 없어요. 저장 권한을 확인해 주세요.'); }
    const callback = new URL(client.redirectUri), here = new URL(location.href);
    if (callback.origin !== here.origin || !['/', '/index.html'].includes(callback.pathname) || callback.search) throw new Error('이 운세 화면에 등록된 로그인 도착 주소가 필요해요.');
    emit({ configured: true });
    const params = here.searchParams;
    if (params.has('code') || params.has('error')) {
      let fields;
      try { fields = consumeCallback({ config, product: 'platform', url: location.href, storage }); }
      finally { for (const name of ['code', 'state', 'error', 'error_description']) here.searchParams.delete(name);replaceURL(here.href); }
      const tokens = await tokenRequest(config, fields, fetcher);guard(expected);session = tokens;storage.setItem(key, JSON.stringify(session));
    } else { try { session = JSON.parse(storage.getItem(key) || 'null'); } catch { storage.removeItem(key); } }
    if (!session?.access_token) { session = null;emit({ status: 'signed-out', message: '로그인하면 내 정보와 보관함을 이어갈 수 있어요.' });return snapshot(); }
    return load();
  }
  async function signIn() {
    const expected = epoch;
    if (native) { const next = await native.authSignIn();guard(expected);return nativeState(next); }
    const destination = await beginOAuth({ config, product: 'platform', storage });guard(expected);location.assign(destination);
  }
  async function signOut() {
    const previous = session;nativeAuthenticated = false;reset();session = null;
    emit({ status: 'signed-out', account: null, ready: false, message: '이 화면에서 로그아웃했어요.' });
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
    dispose() { disposed = true;reset();unsubscribe?.(); } };
}
