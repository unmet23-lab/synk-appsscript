import { createPlatformEntry } from './platform-entry.mjs';
const AUTH_ERRORS = new Set(['AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_REVOKED']);
const fault = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const missingAsset = error => ['ASSET_NOT_FOUND','ASSET_NOT_CONFIRMED'].includes(error?.code) && typeof error?.assetId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(error.assetId) ? { assetId:error.assetId } : {};
const publicError = error => ({ code: error.code || 'ACCOUNT_UNAVAILABLE', message: error.message || '계정 연결을 확인하지 못했어요.', retryable: error.retryable === true, ...(error.status ? { status: error.status } : {}), ...missingAsset(error) });

/**
 * Native: 기존 SYNK PKCE/OS 보관함을 쓰는 고정 IPC만 호출한다. 토큰을 받지 않는다.
 * Browser: 공용 account core의 PKCE·콜백·토큰 교환을 재사용한다. 로그인 토큰은
 * 탭의 sessionStorage에만 두며 이 API의 status나 콜백에 노출하지 않는다.
 */
export function createProductAccount({
  clientKey, endpoint, scope, validateState, resource = null,
  operations = { load: 'careLoad', save: 'careSave', delete: 'careDelete' },
  onStatus = () => {}, bridge,
  fetcher = globalThis.fetch, storage = globalThis.sessionStorage,
  getUrl = () => globalThis.location.href,
  configUrl = '/api/account-config',
  replaceUrl = url => globalThis.history.replaceState(null, '', url),
  navigate = url => globalThis.location.assign(url),
  loadCore = () => import('./core.mjs'), now = Date.now, cryptoAPI,
} = {}) {
  if (!['care', 'path', 'path-travel', 'rehearsal', 'family-album'].includes(clientKey) || !['synk-care', 'synk-personal'].includes(endpoint) || typeof validateState !== 'function') throw new TypeError('제품 계정 계약을 확인해 주세요.');
  const LIMIT = (resource === 'family-album' ? 32 : 4) * 1024 * 1024 + 32768;
  const SESSION_KEY = `synk.oauth.session.${clientKey}`;
  const OPERATIONS = new Set(Object.values(operations));
  const bridgeRequest = bridge?.accountRequest || bridge?.request;
  const native = typeof bridgeRequest === 'function' && typeof bridge?.authStatus === 'function';
  const platformEntry = native ? null : createPlatformEntry({ clientKey, getUrl, replaceUrl });
  let automaticNavigations = 0;
  let snapshot = { configured: false, signedIn: false, status: 'unconfigured', accountId: null, account: null, sessionGeneration: 0, error: null };
  let config, core, session = null, pendingExchange = null, epoch = 0, loginIntent = 0, disposed = false, starting, started = false, refreshing, unsubscribe, nativeIdentity = null, nativeLoad = null, nativeGeneration = -1;
  const controllers = new Set();
  const status = () => ({ ...snapshot, account: snapshot.account ? { ...snapshot.account } : null, error: snapshot.error ? { ...snapshot.error } : null });
  const emit = patch => { snapshot = { ...snapshot, ...patch, sessionGeneration: epoch }; if (!disposed) onStatus(status()); return status(); };
  const guard = expected => { if (disposed || expected !== epoch) throw fault('ACCOUNT_CHANGED', '계정 연결이 바뀌었어요.'); };
  const binding = () => [config.supabaseUrl, config.accountApiUrl, config.clients[clientKey].clientId, config.clients[clientKey].redirectUri].join('|');
  function stopRequests() { for (const controller of controllers) controller.abort(); }
  function clearSession(error, nextStatus = 'signed-out') {
    epoch++; session = null; pendingExchange = null; nativeIdentity = null; nativeLoad = null; stopRequests();
    if (!native) { try { storage?.removeItem(SESSION_KEY); } catch { error ||= fault('STORAGE', '화면의 로그인은 종료했지만 저장을 지우지 못했어요. 이 창을 닫아 주세요.'); } }
    return emit({ signedIn: false, status: snapshot.configured ? nextStatus : 'unconfigured', accountId: null, account: null, error: error ? publicError(error) : null });
  }
  function saveSession(next) {
    session = next;
    try { storage.setItem(SESSION_KEY, JSON.stringify({ ...next, configKey: binding() })); }
    catch { throw fault('STORAGE', '이 탭에 로그인을 보관하지 못했어요. 브라우저 저장 설정을 확인해 주세요.'); }
  }
  async function responseJson(response) {
    if (!response.body?.getReader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > LIMIT) throw fault('INVALID_RESPONSE', '계정 자료의 크기를 확인하지 못했어요.');
      try { return JSON.parse(text); } catch { return null; }
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text = '';
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > LIMIT) { await reader.cancel(); throw fault('INVALID_RESPONSE', '계정 자료의 크기를 확인하지 못했어요.'); } text += decoder.decode(value, { stream: true }); }
      text += decoder.decode();
      try { return JSON.parse(text); } catch { return null; }
    } finally { reader.releaseLock(); }
  }
  async function send(url, token, body, { logout = false } = {}) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12000); controllers.add(abort);
    try {
      const response = await fetcher(url, { method: body === undefined ? 'GET' : 'POST', signal: abort.signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${token}`, 'X-SYNK-Product': 'platform', 'X-SYNK-Contract': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const data = logout && response.status === 204 ? null : await responseJson(response);
      return { response, data };
    } catch (error) { if (error.code) throw error; throw fault('NETWORK', '계정 서버에 연결하지 못했어요. 현재 자료를 유지하고 다시 시도해 주세요.', { retryable: true }); }
    finally { clearTimeout(timer); controllers.delete(abort); }
  }
  async function refresh(expected) {
    if (refreshing) return refreshing;
    const old = session;
    if (!old?.refresh_token) throw fault('AUTH_REQUIRED', 'SYNK ID로 다시 로그인해 주세요.');
    const promise = (async () => {
      const next = await core.tokenRequest(config, { grant_type: 'refresh_token', client_id: config.clients[clientKey].clientId, refresh_token: old.refresh_token }, fetcher);
      guard(expected); saveSession({ ...next, refresh_token: next.refresh_token || old.refresh_token }); return session.access_token;
    })();
    refreshing = promise;
    try { return await promise; } finally { if (refreshing === promise) refreshing = null; }
  }
  function requestBody(operation, values = {}) {
    if (!OPERATIONS.has(operation) || !values || typeof values !== 'object' || Array.isArray(values)) throw fault('INVALID_REQUEST', '제품 계정 요청을 확인해 주세요.');
    const careLibrarySave = clientKey === 'care' && endpoint === 'synk-care' && resource === null && operation === operations.save;
    const allowed = operation === operations.load ? [] : operation === operations.save ? ['expected_revision', 'state', ...(careLibrarySave ? ['messageLibraryVersion', 'checkinPreferenceVersion'] : [])] : ['expected_revision'];
    if (Object.keys(values).some(key => !allowed.includes(key))) throw fault('INVALID_REQUEST', '제품 계정 요청을 확인해 주세요.');
    if (Object.hasOwn(values, 'messageLibraryVersion') && (!careLibrarySave || values.messageLibraryVersion !== 1)) throw fault('INVALID_REQUEST', '문구 보관함의 저장 계약을 확인해 주세요.');
    if (Object.hasOwn(values, 'checkinPreferenceVersion') && (!careLibrarySave || values.checkinPreferenceVersion !== 1)) throw fault('INVALID_REQUEST', '안부 설정의 저장 계약을 확인해 주세요.');
    if (operation === operations.load) return undefined;
    if (!Number.isSafeInteger(values.expected_revision) || values.expected_revision < 0) throw fault('INVALID_REQUEST', '저장할 자료의 버전을 확인해 주세요.');
    return { action: operation === operations.save ? 'save' : 'delete', expected_revision: values.expected_revision, ...(operation === operations.save ? { state: validateState(values.state) } : {}), ...(Object.hasOwn(values, 'messageLibraryVersion') ? { messageLibraryVersion: 1 } : {}), ...(Object.hasOwn(values, 'checkinPreferenceVersion') ? { checkinPreferenceVersion: 1 } : {}) };
  }
  function validateResponse(data, ownerId) {
    if (data?.ok !== true) throw fault(data?.error?.code || 'ACCOUNT_UNAVAILABLE', data?.error?.message || '계정 자료를 확인하지 못했어요.', { retryable: data?.error?.retryable === true, status: data?.error?.status, revision: data?.revision, ...missingAsset(data?.error) });
    if (data.scope !== scope || resource && data.resource !== resource || typeof data.accountId !== 'string' || !data.accountId || data.accountId.length > 100 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Object.hasOwn(data, 'state')) throw fault('INVALID_RESPONSE', '계정 자료의 형식을 확인하지 못했어요. 현재 자료를 유지해 주세요.');
    if (ownerId && data.accountId !== ownerId) throw fault('ACCOUNT_CHANGED', '다른 계정의 응답이 도착해 자료를 적용하지 않았어요.');
    return { ok: true, scope, ...(resource ? { resource } : {}), accountId: data.accountId, revision: data.revision, updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null, state: data.state === null ? null : validateState(data.state) };
  }
  async function dispatch(operation, values, expected, ownerId) {
    const body = requestBody(operation, values); guard(expected);
    let data;
    if (native) {
      const params = operation === operations.load ? {} : operation === operations.save ? { expected_revision: body.expected_revision, state: body.state, ...(Object.hasOwn(body, 'messageLibraryVersion') ? { messageLibraryVersion: body.messageLibraryVersion } : {}), ...(Object.hasOwn(body, 'checkinPreferenceVersion') ? { checkinPreferenceVersion: body.checkinPreferenceVersion } : {}) } : { expected_revision: body.expected_revision };
      data = await bridgeRequest.call(bridge, operation, params); guard(expected);
    } else {
      if (!session?.access_token) throw fault('AUTH_REQUIRED', 'SYNK ID로 로그인해 주세요.');
      let token = session.access_token;
      if (session.expires_at <= now() + 30000) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, '')}/functions/v1/${endpoint}${resource && body === undefined ? `?resource=${encodeURIComponent(resource)}` : ''}`;
      let result = await send(url, token, body === undefined || !resource ? body : { ...body, resource }); guard(expected);
      if (result.response.status === 401 && session?.refresh_token) {
        token = session.access_token !== token ? session.access_token : await refresh(expected); guard(expected);
        result = await send(url, token, body === undefined || !resource ? body : { ...body, resource }); guard(expected);
      }
      if (!result.response.ok || result.data?.ok !== true) {
        const code = result.data?.error?.code || (result.response.status === 401 ? 'AUTH_REQUIRED' : 'ACCOUNT_UNAVAILABLE');
        throw fault(code, code === 'REVISION_CONFLICT' ? '다른 기기에서 자료가 바뀌었어요. 계정 자료를 다시 확인해 주세요.' : '계정 요청을 완료하지 못했어요. 현재 자료는 그대로 유지해 주세요.', { status: result.response.status, revision: result.data?.revision, retryable: result.response.status === 429 || result.response.status >= 500, ...missingAsset(result.data?.error) });
      }
      data = result.data;
    }
    guard(expected); return validateResponse(data, ownerId);
  }
  async function mediaRequest(operation, values, expected, ownerId) {
    if (resource !== 'family-album' || endpoint !== 'synk-personal') throw fault('INVALID_REQUEST', '이 제품에는 원본 파일을 보관할 수 없어요.');
    const media = await import('./personal-media.mjs'); guard(expected);
    if (native) {
      media.validateMediaRequest(operation, values);
      const result = await bridgeRequest.call(bridge, operation, values); guard(expected);
      return media.validateMediaResponse(result, { operation, values, ownerId });
    }
    const api = async body => {
      guard(expected);
      let token = session.access_token;
      if (session.expires_at <= now() + 30000) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, '')}/functions/v1/synk-personal`;
      let result = await send(url, token, { ...body, resource }); guard(expected);
      if (result.response.status === 401 && session?.refresh_token) {
        token = session.access_token !== token ? session.access_token : await refresh(expected); guard(expected);
        result = await send(url, token, { ...body, resource }); guard(expected);
      }
      if (!result.response.ok) throw fault(result.data?.error?.code || 'MEDIA_TRANSFER_FAILED', '원본 파일을 계정에 보관하지 못했어요.', { status: result.response.status, ...missingAsset(result.data?.error) });
      return result.data;
    };
    return media.requestPersonalMedia({ operation, values, ownerId, api, fetcher, guard: () => guard(expected), cryptoAPI: cryptoAPI || globalThis.crypto, controllers, origin: config.supabaseUrl });
  }
  async function nativeStatus(source) {
    if (disposed) return status();
    const identity = source?.account?.synk_user_id, generation = source?.sessionGeneration ?? 0;
    if (!Number.isSafeInteger(generation) || generation < nativeGeneration) return status();
    nativeGeneration = generation;
    if (source?.status === 'restoring' && nativeIdentity && nativeIdentity.endsWith(`:${generation}`)) return emit({ signedIn: false, status: 'restoring', error: null });
    if (!source?.signedIn || !identity) {
      snapshot.configured = source?.configured === true;
      return clearSession(source?.error ? Object.assign(new Error(source.error.message), source.error) : null, source?.status || 'signed-out');
    }
    const key = `${identity}:${generation}`;
    if (key === nativeIdentity && snapshot.accountId) return emit({ configured: true, signedIn: true, status: 'signed-in', error: null });
    if (key === nativeIdentity && nativeLoad) return nativeLoad;
    epoch++; nativeIdentity = key;
    const expected = epoch;
    emit({ configured: true, signedIn: false, status: 'restoring', accountId: null, account: null, error: null });
    const promise = (async () => {
      try {
        const data = await dispatch(operations.load, {}, expected, identity); guard(expected);
        return emit({ configured: true, signedIn: true, status: 'signed-in', accountId: data.accountId, account: { synk_user_id: data.accountId, display_name: source.account.display_name || '' }, error: null });
      } catch (error) { if (expected === epoch && !disposed) return clearSession(error, 'error'); return status(); }
    })();
    nativeLoad = promise;
    try { return await promise; } finally { if (nativeLoad === promise) nativeLoad = null; }
  }
  async function begin() {
    const expected = epoch;
    platformEntry?.capture(storage);
    if (native) {
      const environment = await bridge.getEnvironment();
      guard(expected);
      if (environment?.clientId !== clientKey) throw fault('INVALID_BRIDGE', '제품 앱의 로그인 연결을 확인해 주세요.');
      if (disposed) return status();
      unsubscribe?.();
      unsubscribe = bridge.onAuthChanged(source => { void nativeStatus(source).catch(() => {}); });
      const source = await bridge.authStatus(); guard(expected);
      return nativeStatus(source);
    }
    try { core = await loadCore(); }
    catch { throw fault('NETWORK', '로그인 연결을 불러오지 못했어요. 연결이 돌아오면 다시 확인해 주세요.', { retryable: true }); }
    guard(expected);
    let raw;
    const configEndpoint = new URL(configUrl, getUrl());
    if (configEndpoint.origin !== new URL(getUrl()).origin || configEndpoint.username || configEndpoint.password || configEndpoint.hash) throw fault('AUTH_CONFIG', '이 앱의 계정 설정 주소를 확인해 주세요.');
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8000); controllers.add(abort);
    try {
      const response = await fetcher(configEndpoint.href, { cache: 'no-store', credentials: 'omit', signal: abort.signal, redirect: 'error' });
      if (response.ok) raw = await response.json();
      else if (response.status !== 404) throw fault('AUTH_CONFIG', '계정 연결 설정을 불러오지 못했어요. 다시 확인해 주세요.', { status: response.status, retryable: response.status === 429 || response.status >= 500 });
    }
    catch (error) { if (error.code) throw error; throw fault('NETWORK', '계정 연결 설정을 불러오지 못했어요. 연결이 돌아오면 다시 확인해 주세요.', { retryable: true }); }
    finally { clearTimeout(timer); controllers.delete(abort); }
    guard(expected); config = core.readConfig(raw || { version: 1 }, getUrl());
    const configured = !!(config.configured && config.clients[clientKey]?.clientId && config.clients[clientKey]?.redirectUri);
    if (!configured) { pendingExchange = null; return emit({ configured: false, status: 'unconfigured', error: null }); }
    // A saved session or callback is still being checked. Consumers must not
    // discard their account drafts as if the user explicitly signed out.
    emit({ configured: true, status: 'restoring', error: null });
    platformEntry.restore(storage);
    if (platformEntry.isCancelled()) { session = null;pendingExchange = null;return emit({ signedIn: false, status: 'signed-out', accountId: null, account: null, error: null }); }
    const url = new URL(getUrl());
    if (url.searchParams.has('code') || url.searchParams.has('error')) {
      platformEntry.stop();
      try { pendingExchange = { fields: core.consumeCallback({ config, product: clientKey, url: url.href, storage, now: now() }), configKey: binding() }; }
      finally { for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key); replaceUrl(url.href); }
    }
    if (pendingExchange) {
      // consumeCallback has already removed the URL and one-time PKCE record.
      // Retain only this verified request in memory across a temporary outage.
      if (pendingExchange.configKey !== binding()) throw fault('AUTH_REQUIRED', '로그인 연결 설정이 바뀌었어요. SYNK ID로 다시 로그인해 주세요.');
      const next = await core.tokenRequest(config, pendingExchange.fields, fetcher); guard(expected);
      pendingExchange = null; saveSession(next);
    } else {
      try {
        const text = storage.getItem(SESSION_KEY);
        if (text && text.length > 65536) throw Error('INVALID_SESSION');
        const value = JSON.parse(text || 'null');
        if (value) {
          if (value.configKey !== binding() || typeof value.access_token !== 'string' || !value.access_token || value.access_token.length > 16384 || value.refresh_token !== null && typeof value.refresh_token !== 'string' || !Number.isFinite(value.expires_at)) throw Error('INVALID_SESSION');
          session = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: value.expires_at };
        }
      } catch { storage.removeItem(SESSION_KEY); session = null; }
    }
    if (!session) return await automaticSignIn(expected) || emit({ signedIn: false, status: 'signed-out', accountId: null, account: null, error: null });
    emit({ status: 'restoring' });
    let data;
    try { data = await dispatch(operations.load, {}, expected, platformEntry.accountId());guard(expected); }
    catch (error) {
      guard(expected);
      if (!platformEntry.accountId() || ![...AUTH_ERRORS, 'ACCOUNT_CHANGED'].includes(error.code)) throw error;
      session = null;storage.removeItem(SESSION_KEY);
      const redirected = await automaticSignIn(expected);if (redirected) return redirected;
      platformEntry.assertAccount(null);throw error;
    }
    platformEntry.assertAccount(data.accountId);platformEntry.stop();
    return emit({ signedIn: true, status: 'signed-in', accountId: data.accountId, account: { synk_user_id: data.accountId, display_name: '' }, error: null });
  }
  async function automaticSignIn(expected) {
    if (!platformEntry.beginAttempt()) return null;
    emit({ signedIn: false, accountId: null, account: null, status: 'signing-in', error: null });
    const url = await core.beginOAuth({ config, product: clientKey, storage, now: now(), cryptoAPI });guard(expected);
    automaticNavigations++;navigate(url);return status();
  }
  async function start() {
    if (disposed) throw fault('ACCOUNT_CHANGED', '계정 연결이 종료됐어요.');
    if (starting) return starting;
    if (started && !snapshot.error?.retryable) return status();
    started = true;
    const expected = epoch;
    emit({ status: 'restoring', error: null });
    const operation = begin().catch(error => {
      if (disposed || expected !== epoch) return status();
      // A temporary read failure does not revoke a valid login. Keep credentials
      // private, but publish no identity or write capability before verification.
      if (!native && error.retryable === true && !AUTH_ERRORS.has(error.code) && error.code !== 'ACCOUNT_CHANGED')
        return emit({ signedIn: false, accountId: null, account: null, status: 'error', error: publicError(error) });
      return clearSession(error, 'error');
    });
    starting = operation;
    try { return await operation; } finally { if (starting === operation) starting = null; }
  }
  async function signIn() {
    const intent = ++loginIntent;
    const before = automaticNavigations;
    await start();
    if (disposed || intent !== loginIntent) throw fault('ACCOUNT_CHANGED', '계정 연결이 바뀌었어요.');
    if (snapshot.signedIn || automaticNavigations !== before) return status();
    if (native && snapshot.error?.retryable) {
      // authStatus is read-only; load asks main to retry its private saved token.
      // authSignIn would discard that token and start a new OAuth transaction.
      let result;
      try { result = await bridgeRequest.call(bridge, 'load', {}); }
      catch { result = { ok: false, error: { code: 'NETWORK', message: '계정 연결을 다시 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.', retryable: true } }; }
      if (disposed || intent !== loginIntent) throw fault('ACCOUNT_CHANGED', '계정 연결이 바뀌었어요.');
      const source = await bridge.authStatus();
      if (disposed || intent !== loginIntent) throw fault('ACCOUNT_CHANGED', '계정 연결이 바뀌었어요.');
      await nativeStatus(source);
      if (disposed || intent !== loginIntent) throw fault('ACCOUNT_CHANGED', '계정 연결이 바뀌었어요.');
      if (snapshot.signedIn) return status();
      const error = snapshot.error || result?.error || { code: 'AUTH_REQUIRED', message: '저장된 로그인을 확인하지 못했어요. SYNK ID로 다시 로그인해 주세요.', retryable: false };
      if (!snapshot.error) emit({ signedIn: false, accountId: null, account: null, status: 'error', error: publicError(error) });
      throw Object.assign(new Error(error.message), error);
    }
    if (snapshot.error?.retryable) throw Object.assign(new Error(snapshot.error.message), snapshot.error);
    if (!snapshot.configured) throw fault('AUTH_CONFIG', 'SYNK ID 연결 설정을 준비하고 있어요. 지금은 이 기기의 수첩을 사용할 수 있어요.');
    if (native) { const result = await bridge.authSignIn(); if (disposed || intent !== loginIntent) throw fault('ACCOUNT_CHANGED', '계정 연결이 바뀌었어요.'); if (result?.ok === false) throw Object.assign(new Error(result.error?.message), result.error); return nativeStatus(result); }
    const expected = epoch;
    platformEntry.resume();
    const url = await core.beginOAuth({ config, product: clientKey, storage, now: now(), cryptoAPI }); guard(expected);
    if (intent !== loginIntent) throw fault('ACCOUNT_CHANGED', '계정 연결이 바뀌었어요.');
    emit({ status: 'signing-in', error: null }); navigate(url); return status();
  }
  async function signOut() {
    loginIntent++;
    let entryError;try { platformEntry?.cancel(); } catch (error) { entryError = error; }
    const old = session; clearSession(entryError);
    if (native) { const result = await bridge.authSignOut(); await nativeStatus(await bridge.authStatus()); return result; }
    let serverSessionRevoked = !old, refreshRevoked = !old;
    if (old?.access_token && config) {
      const accountUrl = `${config.accountApiUrl.replace(/\/$/, '')}/functions/v1/synk-account`;
      try {
        const loaded = await send(accountUrl, old.access_token);
        const current = loaded.data?.sessions?.find(item => item.current && !item.revoked);
        if (current?.id) {
          const revoked = await send(accountUrl, old.access_token, { action: 'revoke-session', session_id: current.id });
          serverSessionRevoked = revoked.response.ok && revoked.data?.ok === true;
          // The central service may already revoke this provider session.
          // Keep its explicit current-session confirmation instead of logging out twice.
          refreshRevoked = serverSessionRevoked && revoked.data.current === true && revoked.data.refreshRevoked === true;
        }
      } catch { /* 로컬 로그인은 먼저 종료했다. 서버 종료 상태는 반환값으로 구분한다. */ }
      if (!refreshRevoked) {
        try { const result = await send(new URL('/auth/v1/logout?scope=local', config.supabaseUrl).href, old.access_token, {}, { logout: true }); refreshRevoked = result.response.ok || result.response.status === 404 || serverSessionRevoked && result.response.status === 401; } catch {}
      }
    }
    return { ok: !snapshot.error, status: status(), serverRevoked: serverSessionRevoked && refreshRevoked, serverSessionRevoked, refreshRevoked };
  }
  async function request(operation, values = {}) {
    if (!snapshot.signedIn || !snapshot.accountId) throw fault('AUTH_REQUIRED', 'SYNK ID로 로그인한 뒤 계정 자료를 확인해 주세요.');
    const expected = epoch, ownerId = snapshot.accountId;
    try { return await (operation.startsWith('asset') ? mediaRequest(operation, values, expected, ownerId) : dispatch(operation, values, expected, ownerId)); }
    catch (error) { if (expected === epoch && (AUTH_ERRORS.has(error.code) || error.code === 'ACCOUNT_CHANGED')) clearSession(error); throw error; }
  }
  // A fixed Care-only capability. The browser never receives credentials or chooses an API URL.
  async function requestPush(action, values = {}) {
    if (clientKey !== 'care' || endpoint !== 'synk-care' || native) throw fault('PUSH_UNSUPPORTED', '예약 알림은 플레저 웹에서 설정해 주세요.');
    if (!snapshot.signedIn || !snapshot.accountId) throw fault('AUTH_REQUIRED', 'SYNK ID로 로그인한 뒤 알림을 설정해 주세요.');
    const allowed = { status: ['endpoint'], subscribe: ['subscription', 'hour', 'minute'], update: ['endpoint', 'hour', 'minute'], unsubscribe: ['endpoint'] };
    if (!Object.hasOwn(allowed, action) || !values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(key => !allowed[action].includes(key))) throw fault('INVALID_REQUEST', '알림 설정을 확인해 주세요.');
    if (['subscribe', 'update'].includes(action) && (!Number.isInteger(values.hour) || values.hour < 0 || values.hour > 23 || !Number.isInteger(values.minute) || values.minute < 0 || values.minute > 59)) throw fault('INVALID_REQUEST', '알림 시간을 확인해 주세요.');
    if ((action === 'update' || action === 'unsubscribe' || Object.hasOwn(values, 'endpoint')) && (typeof values.endpoint !== 'string' || values.endpoint.length > 2048 || !values.endpoint.startsWith('https://'))) throw fault('INVALID_REQUEST', '이 기기의 알림 연결을 확인해 주세요.');
    if (action === 'subscribe' && (!values.subscription || typeof values.subscription !== 'object' || Array.isArray(values.subscription))) throw fault('INVALID_REQUEST', '이 기기의 알림 연결을 확인해 주세요.');
    const body = { action, ...values };
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 8192) throw fault('INVALID_REQUEST', '알림 설정의 크기를 확인해 주세요.');
    const expected = epoch, ownerId = snapshot.accountId;
    try {
      guard(expected);
      let token = session?.access_token;
      if (!token) throw fault('AUTH_REQUIRED', 'SYNK ID로 다시 로그인해 주세요.');
      if (session.expires_at <= now() + 30000) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, '')}/functions/v1/synk-care-push`;
      let result = await send(url, token, body); guard(expected);
      if (result.response.status === 401 && session?.refresh_token) {
        token = session.access_token !== token ? session.access_token : await refresh(expected); guard(expected);
        result = await send(url, token, body); guard(expected);
      }
      const data = result.data;
      if (!result.response.ok || data?.ok !== true) throw fault(data?.error?.code || (result.response.status === 401 ? 'AUTH_REQUIRED' : 'PUSH_UNAVAILABLE'), '예약 알림을 설정하지 못했어요. 잠시 뒤 다시 시도해 주세요.', { status: result.response.status, retryable: result.response.status === 429 || result.response.status >= 500 });
      if (data.accountId !== ownerId) throw fault('ACCOUNT_CHANGED', '계정이 바뀌어 알림 설정을 적용하지 않았어요.');
      if (data.scope !== 'synk-care-push' || typeof data.enabled !== 'boolean' || data.timeZone !== 'Asia/Seoul' || !Number.isInteger(data.hour) || data.hour < 0 || data.hour > 23 || !Number.isInteger(data.minute) || data.minute < 0 || data.minute > 59 || typeof data.publicKey !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(data.publicKey)) throw fault('INVALID_RESPONSE', '알림 서버의 응답을 확인하지 못했어요.');
      return { ok: true, scope: data.scope, accountId: ownerId, enabled: data.enabled, hour: data.hour, minute: data.minute, timeZone: data.timeZone, publicKey: data.publicKey, ...(typeof data.deviceId === 'string' ? { deviceId: data.deviceId } : {}) };
    } catch (error) { if (expected === epoch && (AUTH_ERRORS.has(error.code) || error.code === 'ACCOUNT_CHANGED')) clearSession(error); throw error; }
  }
  function dispose() { disposed = true; epoch++; loginIntent++; session = null; pendingExchange = null; nativeIdentity = null; unsubscribe?.(); stopRequests(); }
  return Object.freeze({ start, status, signIn, signOut, request, requestPush, dispose });
}
