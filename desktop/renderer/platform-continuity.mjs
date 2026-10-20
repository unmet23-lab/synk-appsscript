var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// experiences/synk-account/src/core.mjs
var core_exports = {};
__export(core_exports, {
  PRODUCTS: () => PRODUCTS,
  authorizationProduct: () => authorizationProduct,
  base64url: () => base64url,
  beginOAuth: () => beginOAuth,
  consumeCallback: () => consumeCallback,
  createPKCE: () => createPKCE,
  firstPartyAuthorization: () => firstPartyAuthorization,
  isLoopback: () => isLoopback,
  publicUrl: () => publicUrl,
  readConfig: () => readConfig,
  scopedStorage: () => scopedStorage,
  tokenRequest: () => tokenRequest,
  trustedConsentRedirect: () => trustedConsentRedirect
});
function callbackUrl(value) {
  const url = new URL(value);
  if (!nativeSchemes.has(url.protocol)) publicUrl(value);
  if (url.username || url.password || url.hash || [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1) || ["code", "state", "error", "error_description", "access_token", "refresh_token"].some((key) => url.searchParams.has(key))) throw new Error("로그인 도착 주소의 형식을 확인해 주세요.");
  return url;
}
function callbackMatches(actual, expected) {
  if (actual.username || actual.password || actual.hash || actual.protocol !== expected.protocol || actual.host !== expected.host || actual.pathname !== expected.pathname) return false;
  const allowed = /* @__PURE__ */ new Set([...expected.searchParams.keys(), "code", "state", "error", "error_description"]);
  return [...actual.searchParams.keys()].every((key) => allowed.has(key) && actual.searchParams.getAll(key).length === 1) && [...expected.searchParams].every(([key, value]) => actual.searchParams.get(key) === value) && !(actual.searchParams.has("code") && actual.searchParams.has("error"));
}
function publicUrl(value, { relative = false, base } = {}) {
  const url = relative ? new URL(value, base) : new URL(value);
  if (url.username || url.password || !["https:", "http:"].includes(url.protocol) || url.protocol === "http:" && !isLoopback(url.hostname)) throw new Error("HTTPS 또는 로컬 개발 주소만 사용할 수 있어요.");
  return url;
}
function readConfig(value, base) {
  const allowed = ["version", "supabaseUrl", "supabasePublishableKey", "accountApiUrl", "portalUrl", "learningUrl", "messengerUrl", "clients", "authorizationClients"];
  if (!value || value.version !== 1 || Object.keys(value).some((key2) => !allowed.includes(key2))) throw new Error("공개 설정 파일의 형식을 확인해 주세요.");
  const key = value.supabasePublishableKey || "";
  if (typeof key !== "string" || key.startsWith("sb_secret_")) throw new Error("서버 비밀 키를 브라우저 설정에 넣을 수 없어요.");
  if (key.split(".").length === 3) {
    try {
      if (JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role !== "anon") throw new Error("role");
    } catch {
      throw new Error("브라우저에는 공개 publishable 또는 anon 키만 사용할 수 있어요.");
    }
  }
  const config = { ...value, clients: {}, configured: !!value.supabaseUrl && !!key && !!value.portalUrl };
  for (const field of ["supabaseUrl", "accountApiUrl", "portalUrl"]) if (value[field]) publicUrl(value[field]);
  for (const product of Object.keys(PRODUCTS)) {
    const client = value.clients?.[product] || {};
    if (Object.keys(client).some((key2) => !["clientId", "redirectUri"].includes(key2))) throw new Error("공개 OAuth 클라이언트에는 비밀 키를 넣지 않아요.");
    if (client.redirectUri) {
      publicUrl(client.redirectUri);
      callbackUrl(client.redirectUri);
    }
    config.clients[product] = { clientId: client.clientId || "", redirectUri: client.redirectUri || "" };
  }
  config.authorizationClients = (value.authorizationClients || []).map((client) => {
    if (!PRODUCTS[client.product] || typeof client.clientId !== "string" || !Array.isArray(client.redirectUris) || Object.keys(client).some((key2) => !["product", "clientId", "redirectUris"].includes(key2))) throw new Error("제품별 로그인 도착 주소 설정을 확인해 주세요.");
    for (const value2 of client.redirectUris) callbackUrl(value2);
    return { ...client };
  });
  config.accountApiUrl ||= config.supabaseUrl;
  config.learningUrl = publicUrl(value.learningUrl || "../learning-hub/", { relative: true, base }).href;
  return config;
}
async function createPKCE(cryptoAPI = globalThis.crypto) {
  const verifier = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const state = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await cryptoAPI.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, state, challenge };
}
async function beginOAuth({ config, product, storage, now = Date.now(), cryptoAPI }) {
  const client = config.clients[product];
  if (!config.configured || !client?.clientId || !client.redirectUri) throw new Error("이 제품의 SSO 연결 설정이 아직 준비되지 않았어요.");
  const pkce = await createPKCE(cryptoAPI), transaction = { ...pkce, product, clientId: client.clientId, redirectUri: client.redirectUri, createdAt: now };
  storage.setItem(`synk.oauth.pending.${product}`, JSON.stringify(transaction));
  const url = new URL("/auth/v1/oauth/authorize", config.supabaseUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    state: pkce.state,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    scope: "openid email profile"
  });
  return url.href;
}
function consumeCallback({ config, product, url, storage, now = Date.now() }) {
  const params = new URL(url).searchParams, key = `synk.oauth.pending.${product}`, raw = storage.getItem(key);
  if (!raw) throw new Error("이 브라우저에서 시작한 로그인 요청이 아니에요. 다시 시작해 주세요.");
  const pending = JSON.parse(raw), client = config.clients[product];
  if (!pending || pending.product !== product || pending.clientId !== client?.clientId || pending.redirectUri !== client?.redirectUri || params.get("state") !== pending.state || now - pending.createdAt > 6e5 || now < pending.createdAt) throw new Error("로그인 요청이 만료되었거나 상태가 달라졌어요. 다시 시작해 주세요.");
  const actual = new URL(url), expected = new URL(client.redirectUri);
  if (!callbackMatches(actual, expected)) throw new Error("등록한 로그인 도착 주소와 달라요.");
  storage.removeItem(key);
  if (params.has("error")) throw new Error(params.get("error") === "access_denied" ? "제품 연결을 취소했어요." : "로그인을 마치지 못했어요. 다시 시작해 주세요.");
  const code = params.get("code");
  if (!code) throw new Error("로그인 코드가 없어요.");
  return { grant_type: "authorization_code", client_id: client.clientId, redirect_uri: client.redirectUri, code, code_verifier: pending.verifier };
}
async function tokenRequest(config, fields, fetcher = fetch) {
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12e3);
  try {
    let response;
    try {
      response = await fetcher(new URL("/auth/v1/oauth/token", config.supabaseUrl), {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields),
        credentials: "omit",
        cache: "no-store"
      });
    } catch {
      throw Object.assign(new Error("로그인 서버에 연결하지 못했어요. 연결이 돌아오면 다시 확인해 주세요."), { code: "NETWORK", retryable: true });
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (response.ok && error?.name !== "SyntaxError") throw Object.assign(new Error("로그인 응답을 끝까지 받지 못했어요. 연결이 돌아오면 다시 확인해 주세요."), { code: "NETWORK", retryable: true });
      data = null;
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw Object.assign(new Error(retryable ? "로그인 서버가 잠시 응답하지 않아요. 잠시 뒤 다시 확인해 주세요." : "로그인 연결을 마치지 못했어요. 다시 로그인해 주세요."), { code: retryable ? "AUTH_UNAVAILABLE" : "AUTH_REQUIRED", status: response.status, retryable });
    }
    if (!data || typeof data.access_token !== "string" || !data.access_token) throw Object.assign(new Error("로그인 응답을 확인하지 못했어요. 다시 로그인해 주세요."), { code: "INVALID_RESPONSE" });
    return { access_token: data.access_token, refresh_token: data.refresh_token || null, expires_at: Date.now() + Number(data.expires_in || 3600) * 1e3 };
  } finally {
    clearTimeout(timer);
  }
}
function trustedConsentRedirect(value, config, clientId) {
  const target = new URL(value);
  if (target.username || target.password || target.hash) throw new Error("등록한 SYNK 제품의 도착 주소를 확인하지 못했어요.");
  const matchesClient = (c) => c.clientId && (!clientId || c.clientId === clientId);
  const redirects = [...Object.values(config.clients).filter(matchesClient).map((c) => c.redirectUri), ...config.authorizationClients.filter(matchesClient).flatMap((c) => c.redirectUris)];
  const match = redirects.some((uri) => {
    if (!uri) return false;
    const allowed = new URL(uri);
    return callbackMatches(target, allowed);
  });
  if (!match) throw new Error("등록한 SYNK 제품의 도착 주소를 확인하지 못했어요.");
  return target.href;
}
function authorizationProduct(clientId, config) {
  return Object.entries(config.clients).find(([, client]) => client.clientId && client.clientId === clientId)?.[0] || config.authorizationClients.find((client) => client.clientId && client.clientId === clientId)?.product || null;
}
function firstPartyAuthorization(details, config) {
  const clientId = details?.client?.id;
  const product = typeof clientId === "string" && clientId ? authorizationProduct(clientId, config) : null;
  if (!product) throw new Error("등록된 SYNK 서비스의 로그인 요청인지 확인하지 못했어요.");
  const destination = trustedConsentRedirect(details.redirect_uri, config, clientId);
  const clients = [...Object.values(config.clients), ...config.authorizationClients].filter((client) => client.clientId === clientId);
  if (!clients.some((client) => [client.redirectUri, ...client.redirectUris || []].filter(Boolean).some((uri) => new URL(uri).href === destination)))
    throw new Error("등록한 SYNK 서비스의 로그인 도착 주소와 달라요.");
  const scopes = typeof details.scope === "string" ? details.scope.trim().split(/\s+/) : [];
  if (!scopes.includes("openid") || new Set(scopes).size !== scopes.length || scopes.some((scope) => !["openid", "email", "profile"].includes(scope)))
    throw new Error("SYNK 로그인에 필요한 기본 계정 정보만 연결할 수 있어요.");
  return Object.freeze({ clientId, product, destination, scopes: Object.freeze(scopes) });
}
function scopedStorage(storage, accountKey, revision, guard) {
  const prefix = `synk.account.${accountKey}.r${revision}.`;
  return Object.freeze(Object.fromEntries(["getItem", "setItem", "removeItem"].map((method) => [method, (key, ...args) => {
    guard();
    return storage[method](prefix + key, ...args);
  }])));
}
var PRODUCTS, nativeSchemes, isLoopback, base64url;
var init_core = __esm({
  "experiences/synk-account/src/core.mjs"() {
    PRODUCTS = Object.freeze({ platform: "SYNK 플랫폼", world: "SYNK WORLD", messenger: "SYNK Workspace", care: "SYNK 플레저", path: "SYNK PATH", "path-travel": "SYNK PATH 여행" });
    nativeSchemes = /* @__PURE__ */ new Set(["synktalk:", "im.synk.platform:", "im.synk.world:", "im.synk.messenger:", "im.synk.care:"]);
    isLoopback = (hostname) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
    base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
});

// experiences/synk-account/src/platform-entry.mjs
var PARAM = "synk-platform-account";
var CANCEL = "synk-platform-cancelled";
var validId = (value) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
var mismatch = () => Object.assign(new Error("플랫폼에서 선택한 SYNK ID와 로그인 계정이 달라요. 플랫폼 계정을 확인한 뒤 다시 열어 주세요."), { code: "PLATFORM_ACCOUNT_MISMATCH" });
function createPlatformEntry({ clientKey, getUrl, replaceUrl }) {
  const key = `synk.platform.entry.${clientKey}`;
  let captured = false, restored = false, invalid3 = false, cancelled = false, intent = null, storage;
  function capture(value) {
    if (captured) return;
    const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
    if (params.get(CANCEL) === clientKey) {
      cancelled = true;
      captured = true;
      return;
    }
    if (!params.has(PARAM)) {
      captured = true;
      return;
    }
    const values = params.getAll(PARAM), next = values.length === 1 && validId(values[0]) ? { version: 1, accountId: values[0], attempted: false } : { version: 1, invalid: true };
    try {
      storage = typeof value === "function" ? value() : value;
      storage.setItem(key, JSON.stringify(next));
    } catch {
      throw Object.assign(new Error("플랫폼의 계정 연결을 이 탭에 보관하지 못했어요. 브라우저 저장 설정을 확인한 뒤 다시 시도해 주세요."), { code: "PLATFORM_ENTRY_STORAGE", retryable: true });
    }
    intent = next;
    invalid3 = next.invalid === true;
    params.delete(PARAM);
    url.hash = params.toString();
    replaceUrl(url.href);
    captured = true;
  }
  function persist() {
    storage.setItem(key, JSON.stringify(intent));
  }
  return {
    capture,
    restore(value) {
      if (invalid3) throw mismatch();
      if (restored) return;
      storage = value;
      const text2 = storage.getItem(key);
      if (text2) {
        try {
          if (text2.length > 1024) throw mismatch();
          intent = JSON.parse(text2);
        } catch {
          throw mismatch();
        }
        if (intent?.version !== 1 || !validId(intent.accountId) && !(intent.cancelled === true && intent.accountId === void 0) || typeof intent.attempted !== "boolean" || intent.cancelled !== void 0 && typeof intent.cancelled !== "boolean") throw mismatch();
        cancelled ||= intent.cancelled === true;
      }
      restored = true;
    },
    accountId: () => intent?.accountId || null,
    assertAccount(id) {
      if (intent?.accountId && id !== intent.accountId) throw mismatch();
    },
    isCancelled: () => cancelled,
    resume() {
      if (!cancelled) return;
      if (intent?.accountId) {
        intent.cancelled = false;
        intent.attempted = true;
        persist();
      } else {
        storage.removeItem(key);
        if (storage.getItem(key) !== null) throw mismatch();
        intent = null;
      }
      const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
      params.delete(CANCEL);
      url.hash = params.toString();
      replaceUrl(url.href);
      cancelled = false;
    },
    beginAttempt() {
      if (cancelled || !intent || intent.attempted) return false;
      intent.attempted = true;
      persist();
      return true;
    },
    stop() {
      if (intent) {
        intent.attempted = true;
        persist();
      }
    },
    cancel() {
      if (!intent && !cancelled && !new URLSearchParams(new URL(getUrl()).hash.slice(1)).has(PARAM)) return;
      cancelled = true;
      let durable = false;
      try {
        intent ||= { version: 1, attempted: true };
        intent.cancelled = true;
        intent.attempted = true;
        persist();
        durable = true;
      } catch {
      }
      if (!durable) {
        try {
          storage.removeItem(key);
          if (storage.getItem(key) !== null) throw mismatch();
        } catch {
        }
      }
      const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
      params.delete(PARAM);
      if (!durable) params.set(CANCEL, clientKey);
      url.hash = params.toString();
      try {
        if (url.href !== getUrl()) replaceUrl(url.href);
      } catch {
        throw Object.assign(new Error("화면의 로그인은 종료했지만 자동 연결 취소를 저장하지 못했어요. 이 창을 닫아 주세요."), { code: "PLATFORM_ENTRY_STORAGE", retryable: false });
      }
    }
  };
}
var PUBLIC = Object.freeze({ world: "https://synk.im/account/client.html?product=world&play=learning-hub", care: "https://synk.im/care/", fortune: "https://synk.im/fortune/" });

// experiences/synk-account/src/product-account.mjs
var AUTH_ERRORS = /* @__PURE__ */ new Set(["AUTH_REQUIRED", "AUTH_SESSION_MISSING", "SESSION_REVOKED"]);
var fault = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
var missingAsset = (error) => ["ASSET_NOT_FOUND", "ASSET_NOT_CONFIRMED"].includes(error?.code) && typeof error?.assetId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(error.assetId) ? { assetId: error.assetId } : {};
var publicError = (error) => ({ code: error.code || "ACCOUNT_UNAVAILABLE", message: error.message || "계정 연결을 확인하지 못했어요.", retryable: error.retryable === true, ...error.status ? { status: error.status } : {}, ...missingAsset(error) });
function createProductAccount({
  clientKey,
  endpoint,
  scope,
  validateState,
  resource = null,
  operations: operations2 = { load: "careLoad", save: "careSave", delete: "careDelete" },
  onStatus = () => {
  },
  bridge,
  fetcher = globalThis.fetch,
  storage = globalThis.sessionStorage,
  getUrl = () => globalThis.location.href,
  configUrl = "/api/account-config",
  replaceUrl = (url) => globalThis.history.replaceState(null, "", url),
  navigate = (url) => globalThis.location.assign(url),
  loadCore = () => Promise.resolve().then(() => (init_core(), core_exports)),
  now = Date.now,
  cryptoAPI
} = {}) {
  if (!["care", "path", "path-travel"].includes(clientKey) || !["synk-care", "synk-personal"].includes(endpoint) || typeof validateState !== "function") throw new TypeError("제품 계정 계약을 확인해 주세요.");
  const LIMIT = 4 * 1024 * 1024 + 32768;
  const SESSION_KEY = `synk.oauth.session.${clientKey}`;
  const OPERATIONS = new Set(Object.values(operations2));
  const bridgeRequest = bridge?.accountRequest || bridge?.request;
  const native = typeof bridgeRequest === "function" && typeof bridge?.authStatus === "function";
  const platformEntry = native ? null : createPlatformEntry({ clientKey, getUrl, replaceUrl });
  let automaticNavigations = 0;
  let snapshot = { configured: false, signedIn: false, status: "unconfigured", accountId: null, account: null, sessionGeneration: 0, error: null };
  let config, core, session = null, pendingExchange = null, epoch = 0, loginIntent = 0, disposed = false, starting, started = false, refreshing, unsubscribe, nativeIdentity = null, nativeLoad = null, nativeGeneration = -1;
  const controllers = /* @__PURE__ */ new Set();
  const status = () => ({ ...snapshot, account: snapshot.account ? { ...snapshot.account } : null, error: snapshot.error ? { ...snapshot.error } : null });
  const emit = (patch) => {
    snapshot = { ...snapshot, ...patch, sessionGeneration: epoch };
    if (!disposed) onStatus(status());
    return status();
  };
  const guard = (expected) => {
    if (disposed || expected !== epoch) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
  };
  const binding = () => [config.supabaseUrl, config.accountApiUrl, config.clients[clientKey].clientId, config.clients[clientKey].redirectUri].join("|");
  function stopRequests() {
    for (const controller of controllers) controller.abort();
  }
  function clearSession(error, nextStatus = "signed-out") {
    epoch++;
    session = null;
    pendingExchange = null;
    nativeIdentity = null;
    nativeLoad = null;
    stopRequests();
    if (!native) {
      try {
        storage?.removeItem(SESSION_KEY);
      } catch {
        error ||= fault("STORAGE", "화면의 로그인은 종료했지만 저장을 지우지 못했어요. 이 창을 닫아 주세요.");
      }
    }
    return emit({ signedIn: false, status: snapshot.configured ? nextStatus : "unconfigured", accountId: null, account: null, error: error ? publicError(error) : null });
  }
  function saveSession(next) {
    session = next;
    try {
      storage.setItem(SESSION_KEY, JSON.stringify({ ...next, configKey: binding() }));
    } catch {
      throw fault("STORAGE", "이 탭에 로그인을 보관하지 못했어요. 브라우저 저장 설정을 확인해 주세요.");
    }
  }
  async function responseJson(response) {
    if (!response.body?.getReader) {
      const text3 = await response.text();
      if (new TextEncoder().encode(text3).byteLength > LIMIT) throw fault("INVALID_RESPONSE", "계정 자료의 크기를 확인하지 못했어요.");
      try {
        return JSON.parse(text3);
      } catch {
        return null;
      }
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text2 = "";
    try {
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > LIMIT) {
          await reader.cancel();
          throw fault("INVALID_RESPONSE", "계정 자료의 크기를 확인하지 못했어요.");
        }
        text2 += decoder.decode(value, { stream: true });
      }
      text2 += decoder.decode();
      try {
        return JSON.parse(text2);
      } catch {
        return null;
      }
    } finally {
      reader.releaseLock();
    }
  }
  async function send(url, token, body, { logout = false } = {}) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12e3);
    controllers.add(abort);
    try {
      const response = await fetcher(url, {
        method: body === void 0 ? "GET" : "POST",
        signal: abort.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${token}`, "X-SYNK-Product": "platform", "X-SYNK-Contract": "1", ...body === void 0 ? {} : { "Content-Type": "application/json" } },
        ...body === void 0 ? {} : { body: JSON.stringify(body) }
      });
      const data = logout && response.status === 204 ? null : await responseJson(response);
      return { response, data };
    } catch (error) {
      if (error.code) throw error;
      throw fault("NETWORK", "계정 서버에 연결하지 못했어요. 현재 자료를 유지하고 다시 시도해 주세요.", { retryable: true });
    } finally {
      clearTimeout(timer);
      controllers.delete(abort);
    }
  }
  async function refresh(expected) {
    if (refreshing) return refreshing;
    const old = session;
    if (!old?.refresh_token) throw fault("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
    const promise = (async () => {
      const next = await core.tokenRequest(config, { grant_type: "refresh_token", client_id: config.clients[clientKey].clientId, refresh_token: old.refresh_token }, fetcher);
      guard(expected);
      saveSession({ ...next, refresh_token: next.refresh_token || old.refresh_token });
      return session.access_token;
    })();
    refreshing = promise;
    try {
      return await promise;
    } finally {
      if (refreshing === promise) refreshing = null;
    }
  }
  function requestBody(operation, values = {}) {
    if (!OPERATIONS.has(operation) || !values || typeof values !== "object" || Array.isArray(values)) throw fault("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const careLibrarySave = clientKey === "care" && endpoint === "synk-care" && resource === null && operation === operations2.save;
    const allowed = operation === operations2.load ? [] : operation === operations2.save ? ["expected_revision", "state", ...careLibrarySave ? ["messageLibraryVersion", "checkinPreferenceVersion"] : []] : ["expected_revision"];
    if (Object.keys(values).some((key) => !allowed.includes(key))) throw fault("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    if (Object.hasOwn(values, "messageLibraryVersion") && (!careLibrarySave || values.messageLibraryVersion !== 1)) throw fault("INVALID_REQUEST", "문구 보관함의 저장 계약을 확인해 주세요.");
    if (Object.hasOwn(values, "checkinPreferenceVersion") && (!careLibrarySave || values.checkinPreferenceVersion !== 1)) throw fault("INVALID_REQUEST", "안부 설정의 저장 계약을 확인해 주세요.");
    if (operation === operations2.load) return void 0;
    if (!Number.isSafeInteger(values.expected_revision) || values.expected_revision < 0) throw fault("INVALID_REQUEST", "저장할 자료의 버전을 확인해 주세요.");
    return { action: operation === operations2.save ? "save" : "delete", expected_revision: values.expected_revision, ...operation === operations2.save ? { state: validateState(values.state) } : {}, ...Object.hasOwn(values, "messageLibraryVersion") ? { messageLibraryVersion: 1 } : {}, ...Object.hasOwn(values, "checkinPreferenceVersion") ? { checkinPreferenceVersion: 1 } : {} };
  }
  function validateResponse(data, ownerId) {
    if (data?.ok !== true) throw fault(data?.error?.code || "ACCOUNT_UNAVAILABLE", data?.error?.message || "계정 자료를 확인하지 못했어요.", { retryable: data?.error?.retryable === true, status: data?.error?.status, revision: data?.revision, ...missingAsset(data?.error) });
    if (data.scope !== scope || resource && data.resource !== resource || typeof data.accountId !== "string" || !data.accountId || data.accountId.length > 100 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Object.hasOwn(data, "state")) throw fault("INVALID_RESPONSE", "계정 자료의 형식을 확인하지 못했어요. 현재 자료를 유지해 주세요.");
    if (ownerId && data.accountId !== ownerId) throw fault("ACCOUNT_CHANGED", "다른 계정의 응답이 도착해 자료를 적용하지 않았어요.");
    return { ok: true, scope, ...resource ? { resource } : {}, accountId: data.accountId, revision: data.revision, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null, state: data.state === null ? null : validateState(data.state) };
  }
  async function dispatch(operation, values, expected, ownerId) {
    const body = requestBody(operation, values);
    guard(expected);
    let data;
    if (native) {
      const params = operation === operations2.load ? {} : operation === operations2.save ? { expected_revision: body.expected_revision, state: body.state, ...Object.hasOwn(body, "messageLibraryVersion") ? { messageLibraryVersion: body.messageLibraryVersion } : {}, ...Object.hasOwn(body, "checkinPreferenceVersion") ? { checkinPreferenceVersion: body.checkinPreferenceVersion } : {} } : { expected_revision: body.expected_revision };
      data = await bridgeRequest.call(bridge, operation, params);
      guard(expected);
    } else {
      if (!session?.access_token) throw fault("AUTH_REQUIRED", "SYNK ID로 로그인해 주세요.");
      let token = session.access_token;
      if (session.expires_at <= now() + 3e4) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/${endpoint}${resource && body === void 0 ? `?resource=${encodeURIComponent(resource)}` : ""}`;
      let result = await send(url, token, body === void 0 || !resource ? body : { ...body, resource });
      guard(expected);
      if (result.response.status === 401 && session?.refresh_token) {
        token = session.access_token !== token ? session.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token, body === void 0 || !resource ? body : { ...body, resource });
        guard(expected);
      }
      if (!result.response.ok || result.data?.ok !== true) {
        const code = result.data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "ACCOUNT_UNAVAILABLE");
        throw fault(code, code === "REVISION_CONFLICT" ? "다른 기기에서 자료가 바뀌었어요. 계정 자료를 다시 확인해 주세요." : "계정 요청을 완료하지 못했어요. 현재 자료는 그대로 유지해 주세요.", { status: result.response.status, revision: result.data?.revision, retryable: result.response.status === 429 || result.response.status >= 500, ...missingAsset(result.data?.error) });
      }
      data = result.data;
    }
    guard(expected);
    return validateResponse(data, ownerId);
  }
  async function nativeStatus(source) {
    if (disposed) return status();
    const identity = source?.account?.synk_user_id, generation = source?.sessionGeneration ?? 0;
    if (!Number.isSafeInteger(generation) || generation < nativeGeneration) return status();
    nativeGeneration = generation;
    if (source?.status === "restoring" && nativeIdentity && nativeIdentity.endsWith(`:${generation}`)) return emit({ signedIn: false, status: "restoring", error: null });
    if (!source?.signedIn || !identity) {
      snapshot.configured = source?.configured === true;
      return clearSession(source?.error ? Object.assign(new Error(source.error.message), source.error) : null, source?.status || "signed-out");
    }
    const key = `${identity}:${generation}`;
    if (key === nativeIdentity && snapshot.accountId) return emit({ configured: true, signedIn: true, status: "signed-in", error: null });
    if (key === nativeIdentity && nativeLoad) return nativeLoad;
    epoch++;
    nativeIdentity = key;
    const expected = epoch;
    emit({ configured: true, signedIn: false, status: "restoring", accountId: null, account: null, error: null });
    const promise = (async () => {
      try {
        const data = await dispatch(operations2.load, {}, expected, identity);
        guard(expected);
        return emit({ configured: true, signedIn: true, status: "signed-in", accountId: data.accountId, account: { synk_user_id: data.accountId, display_name: source.account.display_name || "" }, error: null });
      } catch (error) {
        if (expected === epoch && !disposed) return clearSession(error, "error");
        return status();
      }
    })();
    nativeLoad = promise;
    try {
      return await promise;
    } finally {
      if (nativeLoad === promise) nativeLoad = null;
    }
  }
  async function begin() {
    const expected = epoch;
    platformEntry?.capture(storage);
    if (native) {
      const environment = await bridge.getEnvironment();
      guard(expected);
      if (environment?.clientId !== clientKey) throw fault("INVALID_BRIDGE", "제품 앱의 로그인 연결을 확인해 주세요.");
      if (disposed) return status();
      unsubscribe?.();
      unsubscribe = bridge.onAuthChanged((source2) => {
        void nativeStatus(source2).catch(() => {
        });
      });
      const source = await bridge.authStatus();
      guard(expected);
      return nativeStatus(source);
    }
    try {
      core = await loadCore();
    } catch {
      throw fault("NETWORK", "로그인 연결을 불러오지 못했어요. 연결이 돌아오면 다시 확인해 주세요.", { retryable: true });
    }
    guard(expected);
    let raw;
    const configEndpoint = new URL(configUrl, getUrl());
    if (configEndpoint.origin !== new URL(getUrl()).origin || configEndpoint.username || configEndpoint.password || configEndpoint.hash) throw fault("AUTH_CONFIG", "이 앱의 계정 설정 주소를 확인해 주세요.");
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8e3);
    controllers.add(abort);
    try {
      const response = await fetcher(configEndpoint.href, { cache: "no-store", credentials: "omit", signal: abort.signal, redirect: "error" });
      if (response.ok) raw = await response.json();
      else if (response.status !== 404) throw fault("AUTH_CONFIG", "계정 연결 설정을 불러오지 못했어요. 다시 확인해 주세요.", { status: response.status, retryable: response.status === 429 || response.status >= 500 });
    } catch (error) {
      if (error.code) throw error;
      throw fault("NETWORK", "계정 연결 설정을 불러오지 못했어요. 연결이 돌아오면 다시 확인해 주세요.", { retryable: true });
    } finally {
      clearTimeout(timer);
      controllers.delete(abort);
    }
    guard(expected);
    config = core.readConfig(raw || { version: 1 }, getUrl());
    const configured = !!(config.configured && config.clients[clientKey]?.clientId && config.clients[clientKey]?.redirectUri);
    if (!configured) {
      pendingExchange = null;
      return emit({ configured: false, status: "unconfigured", error: null });
    }
    emit({ configured: true, status: "restoring", error: null });
    platformEntry.restore(storage);
    if (platformEntry.isCancelled()) {
      session = null;
      pendingExchange = null;
      return emit({ signedIn: false, status: "signed-out", accountId: null, account: null, error: null });
    }
    const url = new URL(getUrl());
    if (url.searchParams.has("code") || url.searchParams.has("error")) {
      platformEntry.stop();
      try {
        pendingExchange = { fields: core.consumeCallback({ config, product: clientKey, url: url.href, storage, now: now() }), configKey: binding() };
      } finally {
        for (const key of ["code", "state", "error", "error_description"]) url.searchParams.delete(key);
        replaceUrl(url.href);
      }
    }
    if (pendingExchange) {
      if (pendingExchange.configKey !== binding()) throw fault("AUTH_REQUIRED", "로그인 연결 설정이 바뀌었어요. SYNK ID로 다시 로그인해 주세요.");
      const next = await core.tokenRequest(config, pendingExchange.fields, fetcher);
      guard(expected);
      pendingExchange = null;
      saveSession(next);
    } else {
      try {
        const text2 = storage.getItem(SESSION_KEY);
        if (text2 && text2.length > 65536) throw Error("INVALID_SESSION");
        const value = JSON.parse(text2 || "null");
        if (value) {
          if (value.configKey !== binding() || typeof value.access_token !== "string" || !value.access_token || value.access_token.length > 16384 || value.refresh_token !== null && typeof value.refresh_token !== "string" || !Number.isFinite(value.expires_at)) throw Error("INVALID_SESSION");
          session = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: value.expires_at };
        }
      } catch {
        storage.removeItem(SESSION_KEY);
        session = null;
      }
    }
    if (!session) return await automaticSignIn(expected) || emit({ signedIn: false, status: "signed-out", accountId: null, account: null, error: null });
    emit({ status: "restoring" });
    let data;
    try {
      data = await dispatch(operations2.load, {}, expected, platformEntry.accountId());
      guard(expected);
    } catch (error) {
      guard(expected);
      if (!platformEntry.accountId() || ![...AUTH_ERRORS, "ACCOUNT_CHANGED"].includes(error.code)) throw error;
      session = null;
      storage.removeItem(SESSION_KEY);
      const redirected = await automaticSignIn(expected);
      if (redirected) return redirected;
      platformEntry.assertAccount(null);
      throw error;
    }
    platformEntry.assertAccount(data.accountId);
    platformEntry.stop();
    return emit({ signedIn: true, status: "signed-in", accountId: data.accountId, account: { synk_user_id: data.accountId, display_name: "" }, error: null });
  }
  async function automaticSignIn(expected) {
    if (!platformEntry.beginAttempt()) return null;
    emit({ signedIn: false, accountId: null, account: null, status: "signing-in", error: null });
    const url = await core.beginOAuth({ config, product: clientKey, storage, now: now(), cryptoAPI });
    guard(expected);
    automaticNavigations++;
    navigate(url);
    return status();
  }
  async function start() {
    if (disposed) throw fault("ACCOUNT_CHANGED", "계정 연결이 종료됐어요.");
    if (starting) return starting;
    if (started && !snapshot.error?.retryable) return status();
    started = true;
    const expected = epoch;
    emit({ status: "restoring", error: null });
    const operation = begin().catch((error) => {
      if (disposed || expected !== epoch) return status();
      if (!native && error.retryable === true && !AUTH_ERRORS.has(error.code) && error.code !== "ACCOUNT_CHANGED")
        return emit({ signedIn: false, accountId: null, account: null, status: "error", error: publicError(error) });
      return clearSession(error, "error");
    });
    starting = operation;
    try {
      return await operation;
    } finally {
      if (starting === operation) starting = null;
    }
  }
  async function signIn() {
    const intent = ++loginIntent;
    const before = automaticNavigations;
    await start();
    if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
    if (snapshot.signedIn || automaticNavigations !== before) return status();
    if (native && snapshot.error?.retryable) {
      let result;
      try {
        result = await bridgeRequest.call(bridge, "load", {});
      } catch {
        result = { ok: false, error: { code: "NETWORK", message: "계정 연결을 다시 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.", retryable: true } };
      }
      if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      const source = await bridge.authStatus();
      if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      await nativeStatus(source);
      if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      if (snapshot.signedIn) return status();
      const error = snapshot.error || result?.error || { code: "AUTH_REQUIRED", message: "저장된 로그인을 확인하지 못했어요. SYNK ID로 다시 로그인해 주세요.", retryable: false };
      if (!snapshot.error) emit({ signedIn: false, accountId: null, account: null, status: "error", error: publicError(error) });
      throw Object.assign(new Error(error.message), error);
    }
    if (snapshot.error?.retryable) throw Object.assign(new Error(snapshot.error.message), snapshot.error);
    if (!snapshot.configured) throw fault("AUTH_CONFIG", "SYNK ID 연결 설정을 준비하고 있어요. 지금은 이 기기의 수첩을 사용할 수 있어요.");
    if (native) {
      const result = await bridge.authSignIn();
      if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      if (result?.ok === false) throw Object.assign(new Error(result.error?.message), result.error);
      return nativeStatus(result);
    }
    const expected = epoch;
    platformEntry.resume();
    const url = await core.beginOAuth({ config, product: clientKey, storage, now: now(), cryptoAPI });
    guard(expected);
    if (intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
    emit({ status: "signing-in", error: null });
    navigate(url);
    return status();
  }
  async function signOut() {
    loginIntent++;
    let entryError;
    try {
      platformEntry?.cancel();
    } catch (error) {
      entryError = error;
    }
    const old = session;
    clearSession(entryError);
    if (native) {
      const result = await bridge.authSignOut();
      await nativeStatus(await bridge.authStatus());
      return result;
    }
    let serverSessionRevoked = !old, refreshRevoked = !old;
    if (old?.access_token && config) {
      const accountUrl = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/synk-account`;
      try {
        const loaded = await send(accountUrl, old.access_token);
        const current = loaded.data?.sessions?.find((item) => item.current && !item.revoked);
        if (current?.id) {
          const revoked = await send(accountUrl, old.access_token, { action: "revoke-session", session_id: current.id });
          serverSessionRevoked = revoked.response.ok && revoked.data?.ok === true;
          refreshRevoked = serverSessionRevoked && revoked.data.current === true && revoked.data.refreshRevoked === true;
        }
      } catch {
      }
      if (!refreshRevoked) {
        try {
          const result = await send(new URL("/auth/v1/logout?scope=local", config.supabaseUrl).href, old.access_token, {}, { logout: true });
          refreshRevoked = result.response.ok || result.response.status === 404 || serverSessionRevoked && result.response.status === 401;
        } catch {
        }
      }
    }
    return { ok: !snapshot.error, status: status(), serverRevoked: serverSessionRevoked && refreshRevoked, serverSessionRevoked, refreshRevoked };
  }
  async function request(operation, values = {}) {
    if (!snapshot.signedIn || !snapshot.accountId) throw fault("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 계정 자료를 확인해 주세요.");
    const expected = epoch, ownerId = snapshot.accountId;
    try {
      return await dispatch(operation, values, expected, ownerId);
    } catch (error) {
      if (expected === epoch && (AUTH_ERRORS.has(error.code) || error.code === "ACCOUNT_CHANGED")) clearSession(error);
      throw error;
    }
  }
  async function requestPush(action, values = {}) {
    if (clientKey !== "care" || endpoint !== "synk-care" || native) throw fault("PUSH_UNSUPPORTED", "예약 알림은 플레저 웹에서 설정해 주세요.");
    if (!snapshot.signedIn || !snapshot.accountId) throw fault("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 알림을 설정해 주세요.");
    const allowed = { status: ["endpoint"], subscribe: ["subscription", "hour", "minute"], update: ["endpoint", "hour", "minute"], unsubscribe: ["endpoint"] };
    if (!Object.hasOwn(allowed, action) || !values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).some((key) => !allowed[action].includes(key))) throw fault("INVALID_REQUEST", "알림 설정을 확인해 주세요.");
    if (["subscribe", "update"].includes(action) && (!Number.isInteger(values.hour) || values.hour < 0 || values.hour > 23 || !Number.isInteger(values.minute) || values.minute < 0 || values.minute > 59)) throw fault("INVALID_REQUEST", "알림 시간을 확인해 주세요.");
    if ((action === "update" || action === "unsubscribe" || Object.hasOwn(values, "endpoint")) && (typeof values.endpoint !== "string" || values.endpoint.length > 2048 || !values.endpoint.startsWith("https://"))) throw fault("INVALID_REQUEST", "이 기기의 알림 연결을 확인해 주세요.");
    if (action === "subscribe" && (!values.subscription || typeof values.subscription !== "object" || Array.isArray(values.subscription))) throw fault("INVALID_REQUEST", "이 기기의 알림 연결을 확인해 주세요.");
    const body = { action, ...values };
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 8192) throw fault("INVALID_REQUEST", "알림 설정의 크기를 확인해 주세요.");
    const expected = epoch, ownerId = snapshot.accountId;
    try {
      guard(expected);
      let token = session?.access_token;
      if (!token) throw fault("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
      if (session.expires_at <= now() + 3e4) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/synk-care-push`;
      let result = await send(url, token, body);
      guard(expected);
      if (result.response.status === 401 && session?.refresh_token) {
        token = session.access_token !== token ? session.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token, body);
        guard(expected);
      }
      const data = result.data;
      if (!result.response.ok || data?.ok !== true) throw fault(data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "PUSH_UNAVAILABLE"), "예약 알림을 설정하지 못했어요. 잠시 뒤 다시 시도해 주세요.", { status: result.response.status, retryable: result.response.status === 429 || result.response.status >= 500 });
      if (data.accountId !== ownerId) throw fault("ACCOUNT_CHANGED", "계정이 바뀌어 알림 설정을 적용하지 않았어요.");
      if (data.scope !== "synk-care-push" || typeof data.enabled !== "boolean" || data.timeZone !== "Asia/Seoul" || !Number.isInteger(data.hour) || data.hour < 0 || data.hour > 23 || !Number.isInteger(data.minute) || data.minute < 0 || data.minute > 59 || typeof data.publicKey !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(data.publicKey)) throw fault("INVALID_RESPONSE", "알림 서버의 응답을 확인하지 못했어요.");
      return { ok: true, scope: data.scope, accountId: ownerId, enabled: data.enabled, hour: data.hour, minute: data.minute, timeZone: data.timeZone, publicKey: data.publicKey, ...typeof data.deviceId === "string" ? { deviceId: data.deviceId } : {} };
    } catch (error) {
      if (expected === epoch && (AUTH_ERRORS.has(error.code) || error.code === "ACCOUNT_CHANGED")) clearSession(error);
      throw error;
    }
  }
  function dispose() {
    disposed = true;
    epoch++;
    loginIntent++;
    session = null;
    pendingExchange = null;
    nativeIdentity = null;
    unsubscribe?.();
    stopRequests();
  }
  return Object.freeze({ start, status, signIn, signOut, request, requestPush, dispose });
}

// experiences/synk-account/src/document-sync.mjs
var validRevision = (value) => Number.isSafeInteger(value) && value >= 0;
var failure = (code, revision) => Object.assign(new Error(code), { code, ...validRevision(revision) ? { revision } : {} });
var messages = {
  CARE_CLIENT_UPDATE_REQUIRED: "더 새로운 앱에서 저장한 문구 보관함이나 안부 설정이 있어요. 현재 자료를 백업한 뒤 새로고침해 주세요.",
  CARE_LIBRARY_RECOVERY_REVIEW: "계정 보관함의 이전 문구·즐겨찾기 또는 안부 주기 설정이 이 임시기록에는 없어요. 임시기록을 복구 파일로 백업한 뒤 계정 수첩을 선택해 주세요.",
  REVISION_CONFLICT: "다른 기기에서 기록이 바뀌었어요. 어느 기록을 사용할지 골라 주세요.",
  LOCAL_CHANGED_DURING_REFRESH: "가져오는 동안 새로 수정한 내용이 있어요. 기록을 다시 골라 주세요.",
  AUTH_REQUIRED: "SYNK 계정에 다시 로그인해 주세요.",
  SESSION_REVOKED: "로그인이 종료되었어요. 다시 로그인해 주세요.",
  ACCOUNT_UNAVAILABLE: "지금은 이 계정의 기록을 사용할 수 없어요.",
  PRODUCT_FORBIDDEN: "이 로그인으로는 플레저 기록에 접근할 수 없어요.",
  CARE_ACCOUNT_MISMATCH: "로그인 계정과 기록의 계정이 달라요. 다시 로그인해 주세요.",
  INVALID_CARE_RESPONSE: "계정에서 받은 기록을 확인하지 못했어요. 다시 불러와 주세요.",
  INVALID_CARE_STATE: "저장할 기록을 확인하지 못했어요. 현재 자료를 내보내 주세요.",
  INVALID_LOCAL_CACHE: "읽지 못한 기기 임시 기록의 원본을 그대로 보존했어요. 로그인한 계정의 기록으로 확인된 원본만 복구 파일로 내보내거나 직접 지울 수 있어요.",
  LOCAL_DRAFT_CONFLICT: "이 계정의 미저장 기록이 기기에 남아 있어요. 다른 탭에서 편집 중일 수도 있으니 이어서 사용할 기록을 직접 골라 주세요. 고르지 않은 기록도 보존해요.",
  LOCAL_STORAGE_UNAVAILABLE: "이 기기의 임시 기록을 보관하거나 지우지 못했어요. 저장 결과를 확인하고 현재 자료를 내보내 주세요.",
  LOCAL_CACHE_IN_USE: "현재 변경을 저장하거나 계정 저장본으로 전환한 뒤 이 계정의 임시기록을 지울 수 있어요. 진행 중인 저장·조회도 먼저 마쳐 주세요.",
  LOCAL_RECOVERY_AUTH_REQUIRED: "임시기록을 남긴 SYNK 계정으로 로그인해야 복구 파일 내보내기와 삭제를 할 수 있어요.",
  PAYLOAD_TOO_LARGE: "저장할 기록이 계정 보관 크기를 넘었어요. 먼저 내보낸 뒤 내용을 줄여 저장해 주세요.",
  INVALID_PERSONAL_STATE: "저장할 기록 형식을 확인하지 못했어요. 현재 자료를 내보내 보관해 주세요.",
  PERSONAL_DATA_TOO_LARGE: "저장할 기록이 계정 보관 크기를 넘었어요. 먼저 내보낸 뒤 내용을 줄여 저장해 주세요.",
  REVISION_CAPACITY: "이 기록의 저장 횟수 한도에 도달했어요. 현재 자료를 내보내 보관하고 지원을 요청해 주세요.",
  ASSET_NOT_FOUND: "앨범 원본을 찾지 못했어요. 현재 화면에 원본이 있다면 저장 다시 시도로 다시 올려 주세요.",
  ASSET_NOT_CONFIRMED: "앨범 원본의 보관을 확인하지 못했어요. 저장 다시 시도로 원본을 다시 올려 주세요.",
  MEDIA_QUOTA_EXCEEDED: "사진·음성 보관 공간 20MiB 또는 파일 수 한도에 도달했어요. 기존 사진·음성을 제거하고 저장을 마친 뒤 새 파일을 추가해 주세요.",
  CARE_UNAVAILABLE: "계정 저장 연결이 아직 준비되지 않았어요. 현재 기록은 이 기기에서 보관해요.",
  AUTH_UNAVAILABLE: "로그인 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요."
};
var documentSyncErrorMessage = (error) => messages[error?.code] || error?.message || "계정에 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.";
function createDocumentSync({ transport, storage, onState = () => {
}, onStatus = () => {
}, onSaved = () => {
}, onRemoved = () => {
}, validateState, emptyState, requiresConflictReview = () => false, preferRemoteOnOpen = false, scope, resource = null, cachePrefix, operations: operations2 = { load: "careLoad", save: "careSave", delete: "careDelete" } }) {
  if (typeof validateState !== "function" || typeof emptyState !== "function" || typeof requiresConflictReview !== "function" || !scope || !cachePrefix) throw new TypeError("제품 기록 계약이 필요해요.");
  const clone = (value) => validateState(value);
  const PREFIX = cachePrefix;
  if (typeof transport !== "function") throw new TypeError("계정 저장 통로가 필요해요.");
  let active = null, generation = 0, localError = null;
  const records = /* @__PURE__ */ new Map(), knownKeys = /* @__PURE__ */ new Set();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const localSummary = () => {
    const all = [...records.values()], own = active ? all.filter((value) => value.accountId === active.accountId) : [];
    return {
      count: active ? own.length : all.length,
      pending: own.filter((value) => value.pending).length,
      corrupt: own.filter((value) => value.corrupt).length,
      exportable: own.length,
      unknown: all.filter((value) => !value.accountId).length,
      error: localError
    };
  };
  function recordOwner(key, cached) {
    if (typeof cached?.accountId !== "string" || !cached.accountId || cached.accountId.length > 120 || /[\x00-\x20]/.test(cached.accountId)) return null;
    const base = PREFIX + encodeURIComponent(cached.accountId);
    return key === base && cached.draftId === void 0 || UUID.test(cached.draftId || "") && key === base + ":draft:" + cached.draftId ? cached.accountId : null;
  }
  function cacheRecord(key, raw) {
    let accountId = null;
    try {
      if (new TextEncoder().encode(raw).byteLength > 4 * 1024 * 1024 + 32768) throw failure("INVALID_LOCAL_CACHE");
      const cached = JSON.parse(raw);
      accountId = recordOwner(key, cached);
      const base = PREFIX + encodeURIComponent(cached?.accountId);
      const draft = typeof cached?.draftId === "string" && UUID.test(cached.draftId);
      if (cached?.version !== 1 || typeof cached.accountId !== "string" || !(draft ? key === base + ":draft:" + cached.draftId : cached.draftId === void 0 && key === base) || draft && (typeof cached.createdAt !== "string" || !Number.isFinite(Date.parse(cached.createdAt))) || typeof cached.pending !== "boolean" || cached.baseRevision !== null && !validRevision(cached.baseRevision)) throw failure("INVALID_LOCAL_CACHE");
      const state = clone(cached.state);
      return { accountId, pending: cached.pending, corrupt: false, cached: { ...cached, state } };
    } catch {
      return { accountId, pending: false, corrupt: true };
    }
  }
  function localEntries() {
    const keys = new Set(knownKeys);
    if (typeof storage?.key !== "function" || !Number.isSafeInteger(storage.length) || storage.length < 0) throw failure("LOCAL_STORAGE_UNAVAILABLE");
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (typeof key === "string" && key.startsWith(PREFIX)) keys.add(key);
    }
    if (!storage?.getItem) throw failure("LOCAL_STORAGE_UNAVAILABLE");
    return [...keys].sort().flatMap((key) => {
      const raw = storage.getItem(key);
      return raw === null || raw === void 0 ? [] : [{ key, raw }];
    });
  }
  function erase(key, expectedRaw) {
    if (!storage?.removeItem) throw failure("LOCAL_STORAGE_UNAVAILABLE");
    if (expectedRaw !== void 0 && storage.getItem(key) !== expectedRaw) return false;
    storage.removeItem(key);
    records.delete(key);
    knownKeys.delete(key);
    return true;
  }
  function localRecords() {
    try {
      const entries = localEntries();
      records.clear();
      localError = null;
      for (const { key, raw } of entries) {
        knownKeys.add(key);
        const record = cacheRecord(key, raw);
        records.set(key, { ...record, key, raw });
        if (active && record.accountId === active.accountId && !record.pending && !record.corrupt) try {
          erase(key, raw);
        } catch {
          localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
        }
      }
    } catch {
      localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
    }
    return localSummary();
  }
  function exportLocalRecords() {
    if (!active) throw failure("LOCAL_RECOVERY_AUTH_REQUIRED");
    try {
      return { format: "synk-account-local-recovery", version: 1, scope, resource, accountId: active.accountId, entries: localEntries().filter(({ key, raw }) => cacheRecord(key, raw).accountId === active.accountId) };
    } catch {
      localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
      if (active) emit(active, "storage-error", failure("LOCAL_STORAGE_UNAVAILABLE"));
      else emitClosed();
      throw failure("LOCAL_STORAGE_UNAVAILABLE");
    }
  }
  function emitClosed() {
    const local = localSummary(), error = localError || (local.corrupt ? { code: "INVALID_LOCAL_CACHE", message: messages.INVALID_LOCAL_CACHE } : null);
    onStatus({ status: "closed", revision: null, accountId: null, error, pending: false, pendingStored: true, localPersistenceError: !!localError, localRecords: local, localDrafts: [] });
  }
  function clearLocalRecords() {
    const context = active;
    if (!context) {
      emitClosed();
      return false;
    }
    if (context.pending || context.busy || context.deleting) {
      emit(context, "error", failure("LOCAL_CACHE_IN_USE"));
      return false;
    }
    try {
      for (const { key, raw } of localEntries()) if (cacheRecord(key, raw).accountId === context.accountId) erase(key, raw);
      localRecords();
      localError = null;
      context.storageError = false;
      context.invalidCache = false;
      context.localChoice = false;
      emit(context, "synced");
      return true;
    } catch {
      context.storageError = true;
      localRecords();
      localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
      emit(context, "storage-error", failure("LOCAL_STORAGE_UNAVAILABLE"));
      return false;
    }
  }
  localRecords();
  const isCurrent = (context) => active === context && context.generation === generation;
  const emitState = (context) => {
    if (isCurrent(context)) onState(clone(context.state));
  };
  function draftGroups(context, all = false) {
    localRecords();
    const groups = /* @__PURE__ */ new Map(), excluded = all ? /* @__PURE__ */ new Set() : /* @__PURE__ */ new Set([...context.owned.keys(), ...context.recovery.keys()]);
    for (const record of records.values()) {
      if (!record.pending || record.corrupt || record.cached.accountId !== context.accountId || excluded.has(record.key)) continue;
      const signature = JSON.stringify({ baseRevision: record.cached.baseRevision, state: record.cached.state });
      let group = groups.get(signature);
      if (!group) {
        group = {
          id: record.cached.draftId || "legacy",
          createdAt: record.cached.createdAt || null,
          baseRevision: record.cached.baseRevision,
          state: record.cached.state,
          entries: /* @__PURE__ */ new Map(),
          itemCount: Object.values(record.cached.state).reduce((n, value) => n + (Array.isArray(value) ? value.length : 0), 0)
        };
        groups.set(signature, group);
      }
      group.entries.set(record.key, record.raw);
    }
    return [...groups.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || a.id.localeCompare(b.id));
  }
  const publicDrafts = (groups) => groups.map(({ id, createdAt, baseRevision, itemCount, entries }) => ({ id, createdAt, baseRevision, itemCount, copies: entries.size }));
  const emit = (context, status, error = null) => {
    if (!isCurrent(context)) return;
    context.choices = draftGroups(context);
    if (context.localChoice && !context.choices.length && !localError) context.localChoice = false;
    context.invalidCache = [...records.values()].some((record) => record.corrupt && record.accountId === context.accountId);
    const currentSignature = JSON.stringify(context.state);
    const pendingStored = !context.pending || !localError && [...records.values()].some((record) => record.pending && !record.corrupt && record.cached.accountId === context.accountId && JSON.stringify(record.cached.state) === currentSignature);
    const warning = context.invalidCache ? { code: "INVALID_LOCAL_CACHE", message: messages.INVALID_LOCAL_CACHE } : context.storageError || localError ? { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE } : null;
    const choiceError = context.localChoice ? { code: "LOCAL_DRAFT_CONFLICT", message: messages.LOCAL_DRAFT_CONFLICT } : null;
    const notification = {
      status: choiceError ? "local-conflict" : !error && warning ? warning.code === "INVALID_LOCAL_CACHE" ? "error" : "storage-error" : status,
      revision: context.revision,
      accountId: context.accountId,
      pending: context.pending,
      pendingStored,
      localPersistenceError: !!(context.storageError || localError),
      localRecords: localSummary(),
      localDrafts: publicDrafts(context.choices),
      warning,
      error: error ? { code: error.code || "CARE_SYNC_FAILED", message: documentSyncErrorMessage(error), ...typeof error.assetId === "string" && UUID.test(error.assetId) ? { assetId: error.assetId } : {} } : choiceError || warning
    };
    context.lastNotification = notification;
    onStatus(notification);
  };
  function removeEntries(context, entries) {
    let ok = true;
    for (const [key, raw] of entries) try {
      erase(key, raw);
      context.owned.delete(key);
      context.recovery.delete(key);
    } catch {
      context.storageError = true;
      ok = false;
    }
    return ok;
  }
  function detachDraft(context) {
    context.owned = /* @__PURE__ */ new Map();
    context.recovery = /* @__PURE__ */ new Map();
    context.currentDraft = null;
  }
  function persist(context) {
    if (!isCurrent(context)) return false;
    try {
      if (context.pending) {
        if (!storage?.setItem) throw failure("LOCAL_STORAGE_UNAVAILABLE");
        const signature = JSON.stringify({ baseRevision: context.baseRevision, state: context.state });
        if (context.currentDraft?.signature === signature && storage.getItem(context.currentDraft.key) === context.currentDraft.raw) {
          if (!removeEntries(context, new Map([...context.owned].filter(([key2]) => key2 !== context.currentDraft.key)))) return false;
          context.storageError = false;
          return true;
        }
        const draftId = globalThis.crypto.randomUUID(), key = context.key + ":draft:" + draftId;
        const raw = JSON.stringify({
          version: 1,
          accountId: context.accountId,
          draftId,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          baseRevision: context.baseRevision,
          state: context.state,
          pending: true
        });
        storage.setItem(key, raw);
        const previous = new Map(context.owned);
        context.owned.set(key, raw);
        context.currentDraft = { key, raw, signature };
        knownKeys.add(key);
        records.set(key, { ...cacheRecord(key, raw), key, raw });
        if (!removeEntries(context, previous)) return false;
      } else if (!removeEntries(context, new Map([...context.recovery, ...context.owned]))) return false;
      if (context.storageError && localError?.code === "LOCAL_STORAGE_UNAVAILABLE") localError = null;
      context.storageError = false;
      return true;
    } catch {
      context.storageError = true;
      return false;
    }
  }
  function stopTimer(context) {
    if (context?.timer) clearTimeout(context.timer);
    if (context) context.timer = null;
  }
  function schedule(context) {
    stopTimer(context);
    if (!isCurrent(context) || context.conflict || context.localChoice || context.deleting) return;
    context.timer = setTimeout(() => {
      context.timer = null;
      void flush();
    }, 400);
    context.timer.unref?.();
  }
  function reportFailure(context, error) {
    if (!isCurrent(context)) return false;
    if (["REVISION_CONFLICT", "LOCAL_CHANGED_DURING_REFRESH"].includes(error?.code)) {
      context.conflict = true;
      if (validRevision(error.revision)) context.revision = error.revision;
      persist(context);
      emit(context, "conflict", error);
    } else {
      const hard = ["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_UNAVAILABLE", "PRODUCT_FORBIDDEN", "CARE_ACCOUNT_MISMATCH", "INVALID_CARE_RESPONSE", "INVALID_CARE_STATE", "CARE_CLIENT_UPDATE_REQUIRED", "PAYLOAD_TOO_LARGE", "INVALID_PERSONAL_STATE", "PERSONAL_DATA_TOO_LARGE", "REVISION_CAPACITY", "ASSET_NOT_FOUND", "ASSET_NOT_CONFIRMED", "MEDIA_QUOTA_EXCEEDED"].includes(error?.code);
      emit(context, hard ? "error" : "offline", error);
    }
    return false;
  }
  function enqueue(context, operation) {
    if (!context || !isCurrent(context)) return Promise.resolve(false);
    context.busy++;
    const result = context.chain.catch(() => {
    }).then(async () => {
      try {
        return isCurrent(context) ? await operation() : false;
      } catch (error) {
        return reportFailure(context, error);
      } finally {
        context.busy--;
      }
    });
    context.chain = result;
    return result;
  }
  async function request(context, action, body) {
    const reply = await transport(action, body);
    if (!isCurrent(context)) throw failure("CARE_SESSION_ENDED");
    if (reply?.ok === false) throw Object.assign(failure(reply.error?.code || reply.code || "CARE_SYNC_FAILED", reply.revision), typeof reply.error?.assetId === "string" && UUID.test(reply.error.assetId) ? { assetId: reply.error.assetId } : {});
    if (!reply || reply.ok !== true || reply.scope !== scope || resource && reply.resource !== resource || !validRevision(reply.revision) || !Object.hasOwn(reply, "state")) throw failure("INVALID_CARE_RESPONSE");
    if (reply.accountId !== context.accountId) throw failure("CARE_ACCOUNT_MISMATCH");
    let state;
    try {
      state = reply.state === null ? emptyState() : clone(reply.state);
    } catch {
      throw failure("INVALID_CARE_RESPONSE");
    }
    return { ...reply, state, empty: reply.state === null };
  }
  async function load(context, mode = "refresh") {
    const before = context.sequence;
    emit(context, "loading");
    const remote = await request(context, operations2.load);
    if (mode === "remote" && before !== context.sequence) {
      context.conflict = true;
      persist(context);
      emit(context, "conflict", failure("LOCAL_CHANGED_DURING_REFRESH"));
      return false;
    }
    if (mode === "remote" && context.pending && !persist(context)) {
      emit(context, "storage-error", failure("LOCAL_STORAGE_UNAVAILABLE"));
      return false;
    }
    context.known = true;
    context.revision = remote.revision;
    if (context.localChoice && mode !== "remote") {
      context.state = remote.state;
      context.baseRevision = remote.revision;
      emitState(context);
      emit(context, "local-conflict");
      return false;
    }
    if (mode === "local") {
      context.baseRevision = remote.revision;
      context.pending = true;
      context.conflict = false;
      persist(context);
      return true;
    }
    if (mode !== "remote" && context.pending) {
      if (context.baseRevision === null && remote.empty && remote.revision === 0) context.baseRevision = 0;
      const conflictCode = context.baseRevision !== remote.revision ? "REVISION_CONFLICT" : requiresConflictReview(context.state, remote.state) ? "CARE_LIBRARY_RECOVERY_REVIEW" : null;
      if (conflictCode) {
        context.conflict = true;
        persist(context);
        emit(context, "conflict", failure(conflictCode, remote.revision));
        return false;
      }
      context.conflict = false;
      persist(context);
      emit(context, "idle");
      return true;
    }
    const changed = JSON.stringify(context.state) !== JSON.stringify(remote.state);
    if (mode === "remote") {
      detachDraft(context);
      context.localChoice = false;
    }
    context.state = remote.state;
    context.baseRevision = remote.revision;
    context.pending = false;
    context.conflict = false;
    persist(context);
    if (changed || mode === "remote") emitState(context);
    emit(context, "synced");
    return true;
  }
  async function drain(context) {
    if (context.localChoice) {
      emit(context, "local-conflict");
      if (!context.localChoice) return load(context);
    }
    if (context.localChoice) {
      emit(context, "local-conflict");
      return false;
    }
    if (!context.known && !await load(context)) return false;
    if (!isCurrent(context) || context.conflict || context.deleting) return false;
    while (context.pending && isCurrent(context) && !context.conflict && !context.deleting) {
      const sequence = context.sequence, sent = clone(context.state), expected = context.baseRevision;
      const acknowledged = new Map([...context.recovery, ...context.owned]);
      emit(context, "saving");
      const remote = await request(context, operations2.save, { expected_revision: expected, state: sent });
      if (remote.revision !== expected + 1 || remote.empty) throw failure("INVALID_CARE_RESPONSE");
      onSaved(clone(remote.state));
      context.revision = remote.revision;
      context.baseRevision = remote.revision;
      if (context.sequence === sequence) {
        context.state = remote.state;
        context.pending = false;
      }
      removeEntries(context, acknowledged);
      if (!context.pending) context.currentDraft = null;
      persist(context);
      emit(context, context.pending ? "idle" : "synced");
    }
    return !context.pending;
  }
  function close() {
    if (active?.storageListener) globalThis.removeEventListener?.("storage", active.storageListener);
    stopTimer(active);
    if (active && !active.pending) persist(active);
    const cleanupError = active?.storageError;
    generation += 1;
    active = null;
    localRecords();
    if (cleanupError) localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
    onState(emptyState());
    emitClosed();
  }
  async function open(accountId) {
    if (typeof accountId !== "string" || !accountId || accountId.length > 120 || /[\x00-\x20]/.test(accountId)) throw failure("INVALID_ACCOUNT_ID");
    close();
    const context = {
      accountId,
      key: PREFIX + encodeURIComponent(accountId),
      generation,
      chain: Promise.resolve(),
      state: emptyState(),
      revision: null,
      baseRevision: null,
      pending: false,
      known: false,
      conflict: false,
      deleting: false,
      sequence: 0,
      storageError: false,
      invalidCache: false,
      timer: null,
      busy: 0
    };
    Object.assign(context, { owned: /* @__PURE__ */ new Map(), recovery: /* @__PURE__ */ new Map(), currentDraft: null, choices: [], localChoice: false });
    active = context;
    knownKeys.add(context.key);
    try {
      const choices = draftGroups(context, true);
      context.invalidCache = [...records.values()].some((record) => record.corrupt && record.accountId === accountId);
      if (choices.length && !preferRemoteOnOpen) context.localChoice = true;
    } catch {
      context.storageError = true;
      emit(context, "storage-error");
    }
    emitState(context);
    context.storageListener = (event) => {
      if (!isCurrent(context) || event.key !== null && !(event.key === context.key || event.key?.startsWith(context.key + ":draft:"))) return;
      const choosing = context.localChoice, previous = context.lastNotification;
      emit(context, choosing ? "synced" : previous?.status || (context.pending ? "idle" : "synced"), choosing ? null : previous?.error);
      if (choosing && !context.localChoice && !context.pending) void refresh();
    };
    globalThis.addEventListener?.("storage", context.storageListener);
    return enqueue(context, async () => {
      const loaded = await load(context);
      if (loaded && context.pending) schedule(context);
      return loaded;
    });
  }
  function change(state) {
    const context = active;
    if (!context) throw failure("CARE_ACCOUNT_REQUIRED");
    if (context.deleting) throw failure("CARE_DELETE_IN_PROGRESS");
    if (context.localChoice) {
      emit(context, "local-conflict");
      if (context.localChoice) throw failure("LOCAL_DRAFT_CONFLICT");
    }
    const normalized = clone(state);
    if (JSON.stringify(normalized) === JSON.stringify(context.state)) return false;
    context.state = normalized;
    context.pending = true;
    context.sequence += 1;
    persist(context);
    emit(context, context.conflict ? "conflict" : "idle");
    schedule(context);
    return true;
  }
  function flush() {
    const context = active;
    stopTimer(context);
    return enqueue(context, () => drain(context));
  }
  function refresh() {
    const context = active;
    stopTimer(context);
    return enqueue(context, async () => {
      const loaded = await load(context);
      if (loaded && context.pending) schedule(context);
      return loaded;
    });
  }
  function resolveRemote() {
    const context = active;
    stopTimer(context);
    return enqueue(context, () => {
      if (context.pending && !persist(context)) {
        emit(context, "storage-error", failure("LOCAL_STORAGE_UNAVAILABLE"));
        return false;
      }
      return load(context, "remote");
    });
  }
  function resolveLocal() {
    const context = active;
    stopTimer(context);
    return enqueue(context, async () => {
      if (!await load(context, "local")) return false;
      return drain(context);
    });
  }
  function selectLocalDraft(id) {
    const context = active;
    stopTimer(context);
    return enqueue(context, async () => {
      if (context.pending && !persist(context)) {
        emit(context, "storage-error");
        return false;
      }
      const selected = draftGroups(context).find((group) => group.id === id);
      if (!selected) {
        emit(context, "synced");
        if (!context.localChoice && !context.pending) await load(context);
        return false;
      }
      detachDraft(context);
      context.recovery = new Map(selected.entries);
      context.state = clone(selected.state);
      context.baseRevision = selected.baseRevision;
      context.pending = true;
      context.known = false;
      context.conflict = false;
      context.localChoice = false;
      context.sequence++;
      emitState(context);
      try {
        const loaded = await load(context);
        if (loaded && context.pending) schedule(context);
      } catch (error) {
        reportFailure(context, error);
      }
      return true;
    });
  }
  function remove() {
    const context = active;
    stopTimer(context);
    if (!context) return Promise.resolve(false);
    context.deleting = true;
    return enqueue(context, async () => {
      try {
        if (!context.known && !await load(context)) return false;
        if (context.conflict) {
          emit(context, "conflict", failure("REVISION_CONFLICT", context.revision));
          return false;
        }
        emit(context, "saving");
        const expected = context.baseRevision;
        const remote = await request(context, operations2.delete, { expected_revision: expected });
        if (remote.revision !== expected + 1 || !remote.empty) throw failure("INVALID_CARE_RESPONSE");
        onRemoved();
        context.state = emptyState();
        context.revision = remote.revision;
        context.baseRevision = remote.revision;
        context.pending = false;
        context.conflict = false;
        context.localChoice = false;
        context.sequence += 1;
        removeEntries(context, new Map([...context.recovery, ...context.owned]));
        context.currentDraft = null;
        persist(context);
        emitState(context);
        emit(context, "synced");
        return true;
      } finally {
        context.deleting = false;
      }
    });
  }
  return { open, change, flush, refresh, resolveRemote, resolveLocal, selectLocalDraft, remove, close, localRecords, exportLocalRecords, clearLocalRecords };
}

// experiences/synk-account/src/account-notebook.mjs
var operations = Object.freeze({ load: "personalLoad", save: "personalSave", delete: "personalDelete" });
var copy = (value) => structuredClone(value);
var labels = { loading: "계정 기록 불러오는 중", saving: "계정에 저장하고 있어요", synced: "계정에 저장했어요", idle: "계정 저장 대기 중", conflict: "다른 기기의 변경을 확인해 주세요", "local-conflict": "이 기기의 미저장 기록을 골라 주세요", offline: "연결을 기다리고 있어요", error: "계정 기록 확인 필요", "storage-error": "기기 임시 저장 확인 필요" };
function createAccountNotebook({
  resource,
  validateState,
  mount,
  content,
  description,
  getState,
  applyState,
  emptyDocument,
  toDocument = (value) => value,
  fromDocument = (value) => value,
  onMode = () => {
  },
  beforeNavigate = () => true,
  prepareRetry = () => false,
  onDocumentSaved = () => {
  },
  onDocumentRemoved = () => {
  },
  onStatusChange = () => {
  },
  pendingDescription = "",
  deleteLabel = "",
  signOutLabel = "로그아웃",
  deleteConfirmation = "이 계정의 앨범 전체와 보관한 사진·음성 원본을 삭제할까요? 다른 기기에서도 다시 불러올 수 없어요. 보관할 앨범은 먼저 파일로 내보내 주세요.",
  bridge = globalThis.synkPersonalAccount,
  accountFactory = createProductAccount,
  syncFactory = createDocumentSync,
  preferRemoteOnOpen = false,
  storage = { getItem: (key) => globalThis.localStorage.getItem(key), setItem: (key, value) => globalThis.localStorage.setItem(key, value), removeItem: (key) => globalThis.localStorage.removeItem(key), key: (index) => globalThis.localStorage.key(index), get length() {
    return globalThis.localStorage.length;
  } }
} = {}) {
  if (!mount || !getState || !applyState || !emptyDocument || typeof validateState !== "function") throw new TypeError("계정 기록 화면 계약이 필요해요.");
  let account, sync, owner = null, ownerAccountId = null, generation = 0, stateVersion = 0, conversionVersion = 0, deletionVersion = 0, guest = null, authPaused = false, reading = null;
  let auth = { status: "unconfigured", configured: false }, saved = { status: "closed", pending: false };
  let closed = false, switching = false, hydrating = false, converting = false, deleting = false, unsent = null, problem = "", suspended = false, hydrationFailure = null, incomingDocument = null;
  let pageSuspended = false, reconnecting = false, resumePromise = null, resumeVersion = 0, resumeMessage = "", contentWasHidden = false, contentConcealed = false;
  mount.classList.add("account-notebook");
  mount.innerHTML = '<div class="notebook-heading"><div><p class="notebook-eyebrow">SYNK ID</p><h2>내 계정으로 이어가기</h2></div><strong data-notebook-status role="status" aria-live="polite"></strong></div><p data-notebook-detail></p><p class="notebook-description"></p><div class="notebook-actions"><button type="button" data-notebook="signin">SYNK ID로 로그인</button><button type="button" data-notebook="refresh" hidden>다시 불러오기</button><button type="button" data-notebook="retry" hidden>저장 다시 시도</button><button type="button" data-notebook="import" hidden>기기 기록을 계정으로 옮기기</button><button type="button" data-notebook="signout" hidden>로그아웃</button></div><div class="notebook-conflict" hidden><p>서로 다른 기록을 자동으로 합치지 않아요. 사용할 기록을 직접 골라 주세요.</p><button type="button" data-notebook="remote">계정의 기록 사용</button><button type="button" data-notebook="local">이 화면의 기록으로 저장</button></div>';
  mount.querySelector(".notebook-description").textContent = description;
  mount.querySelector('[data-notebook="signout"]').textContent = signOutLabel;
  if (preferRemoteOnOpen) mount.querySelector('[data-notebook="remote"]').textContent = "미저장 기록 남기고 계정 기록 열기";
  const pendingNote = document.createElement("p");
  pendingNote.className = "notebook-description";
  pendingNote.dataset.notebookPending = "";
  pendingNote.textContent = pendingDescription;
  pendingNote.hidden = true;
  mount.append(pendingNote);
  const recoveryButton = document.createElement("button");
  recoveryButton.type = "button";
  recoveryButton.dataset.notebook = "recover";
  recoveryButton.textContent = "미저장 기록 남기고 저장본 열기";
  recoveryButton.hidden = true;
  mount.querySelector(".notebook-actions").append(recoveryButton);
  const localNote = document.createElement("p");
  localNote.dataset.notebookLocal = "";
  localNote.setAttribute("role", "status");
  mount.append(localNote);
  for (const [action, label] of [["export-local", "계정 임시기록 복구 파일 내보내기"], ["clear-local", "이 기기의 계정 임시기록 지우기"], ["delete", deleteLabel]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.notebook = action;
    button.textContent = label;
    button.hidden = true;
    mount.querySelector(".notebook-actions").append(button);
  }
  const draftChoices = document.createElement("div");
  draftChoices.className = "notebook-drafts";
  draftChoices.dataset.notebookDrafts = "";
  draftChoices.hidden = true;
  mount.append(draftChoices);
  const element = (name) => mount.querySelector(`[data-notebook="${name}"]`);
  const isReading = () => saved.status === "loading" || reading?.generation === generation;
  function paint() {
    const active = !!owner, pending = saved.pending || converting || !!unsent, authPending = active && !auth.signedIn;
    const saveInProgress = active && pending && !authPending && !suspended && !problem && !hydrationFailure && !saved.error && (converting || ["idle", "saving"].includes(saved.status));
    const local = saved.localRecords || { count: 0, pending: 0, corrupt: 0 };
    const missingPendingMedia = hydrationFailure && saved.pending && ["ASSET_NOT_FOUND", "ASSET_NOT_CONFIRMED"].includes(hydrationFailure.code);
    const loading = active && !suspended && isReading();
    const working = deleting || hydrating || switching || reconnecting || loading;
    if (content) {
      content.inert = pageSuspended || working || suspended || saved.status === "local-conflict";
      content.setAttribute("aria-busy", String(working));
      const conceal = pageSuspended || authPaused;
      if (conceal && !contentConcealed) contentWasHidden = !!content.hidden;
      if (conceal) content.hidden = true;
      else if (contentConcealed) content.hidden = contentWasHidden;
      contentConcealed = conceal;
    }
    mount.querySelector("[data-notebook-status]").textContent = deleting ? "계정 기록 삭제 중" : authPending ? "로그인 다시 확인 필요" : suspended ? problem ? "기록을 다시 불러와 주세요" : "로그인 다시 확인 중" : converting ? "원본을 계정에 보관 중" : hydrating ? "보관한 원본을 불러오는 중" : active ? loading ? labels.loading : problem ? labels.error : saveInProgress ? labels.saving : labels[saved.status] || "계정 기록 연결 중" : auth.status === "unconfigured" ? "이 기기에서 사용 중" : ["restoring", "signing-in"].includes(auth.status) ? "로그인 확인 중" : "로그인 전";
    mount.querySelector("[data-notebook-detail]").textContent = problem || auth.error?.message || saved.error?.message || (active ? loading ? "계정 기록을 불러오고 있어요. 잠시만 기다려 주세요." : saveInProgress ? "계정에 저장하고 있어요. 저장이 끝나면 알려 드려요." : pending ? "아직 계정 저장을 마치지 못했어요. 연결이 돌아오면 다시 시도할 수 있어요." : "로그인한 계정에 저장해요. 다른 기기에서는 다시 불러오기로 최신 기록을 확인하세요." : auth.status === "unconfigured" ? "이 실행 환경의 계정 연결 설정을 준비하고 있어요. 기기 기록은 계속 사용할 수 있어요." : "SYNK ID 하나로 로그인해요. 로그인 전의 기기 기록은 직접 옮길 때만 계정에 저장해요.");
    if (missingPendingMedia) mount.querySelector("[data-notebook-detail]").textContent = "미저장 앨범에 필요한 원본을 찾지 못했어요. 파일이 있는 기기나 내보낸 앨범에서 다시 저장하거나, 미저장 기록을 기기에 남기고 마지막 계정 저장본을 열 수 있어요.";
    if (deleting) mount.querySelector("[data-notebook-detail]").textContent = "계정의 삭제 결과를 확인하고 있어요. 결과가 확인될 때까지 새 기록을 입력할 수 없어요.";
    if (authPending) mount.querySelector("[data-notebook-detail]").textContent = auth.error?.message || "현재 기록을 유지하고 있어요. 계정 연결을 다시 확인해 주세요.";
    pendingNote.hidden = !active || !pending || !pendingDescription;
    const localNoticeCode = saved.warning?.code || (local.corrupt ? "INVALID_LOCAL_CACHE" : null);
    localNote.hidden = !local.count && !local.unknown && !saved.warning || !local.unknown && !!localNoticeCode && saved.error?.code === localNoticeCode;
    localNote.textContent = (saved.warning?.message || (local.corrupt ? "읽지 못한 이 계정의 임시기록 원본을 보존했어요. 복구 파일로 내보낸 뒤 직접 지울 수 있어요." : active ? preferRemoteOnOpen && !pending && saved.localDrafts?.length ? "계정 기록을 열었어요. 이전 미저장 기록은 이 기기에 따로 보관했으며 필요할 때 아래에서 열 수 있어요." : "계정에 보내지 못한 변경만 이 기기에 임시 보관해요. 저장이 끝나면 기기 사본을 지워요." : `미저장 계정 임시기록 ${local.count}개가 이 기기에 남아 있어요. 기록을 남긴 계정으로 로그인하면 이어 사용할 기록을 고르거나 복구 파일로 내보내고 지울 수 있어요.`)) + (local.unknown ? " 계정을 확인할 수 없는 손상 원본은 그대로 보존하며 이 화면에서 내보내거나 지우지 않아요." : "");
    element("export-local").hidden = !active || authPending || !local.exportable;
    element("export-local").disabled = !active || authPending || pageSuspended;
    element("clear-local").hidden = !active || !local.exportable;
    element("clear-local").disabled = pending || working || authPending || saved.status === "saving";
    element("delete").hidden = !active || !deleteLabel;
    element("delete").disabled = working || converting || authPending;
    recoveryButton.hidden = !missingPendingMedia;
    recoveryButton.disabled = working || converting || authPending;
    element("signin").hidden = active && !authPending && (!suspended || !!problem);
    const retryConnection = !auth.signedIn && auth.error?.retryable === true;
    element("signin").textContent = retryConnection ? "계정 연결 다시 확인" : "SYNK ID로 로그인";
    element("signin").disabled = !auth.configured && !retryConnection || ["restoring", "signing-in"].includes(auth.status);
    for (const action of ["refresh", "import", "signout"]) element(action).hidden = !active;
    element("retry").hidden = !active || saveInProgress || !pending && !hydrationFailure && !["offline", "error", "storage-error"].includes(saved.status);
    element("import").disabled = working || converting || authPending || !guest;
    element("refresh").disabled = working || converting || authPending;
    element("retry").disabled = working || converting || authPending;
    mount.querySelector(".notebook-conflict").hidden = !["conflict", "local-conflict"].includes(saved.status);
    element("local").hidden = saved.status === "local-conflict";
    for (const action of ["remote", "local"]) element(action).disabled = working || converting || authPending;
    draftChoices.hidden = !active || !(saved.localDrafts?.length > 0 || saved.status === "local-conflict");
    draftChoices.replaceChildren();
    if (!draftChoices.hidden) {
      const note2 = document.createElement("p");
      note2.textContent = preferRemoteOnOpen ? "별도로 보관한 미저장 기록이에요. 필요할 때만 열어 보세요. 지금 계정 기록은 계속 사용할 수 있어요." : "여러 탭이나 이전 사용의 미저장 기록이 있어요. 열 기록을 골라 주세요. 선택하지 않은 기록은 보존돼요.";
      draftChoices.append(note2);
      for (const [index, draft] of (saved.localDrafts || []).entries()) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.notebook = "select-draft";
        button.dataset.draftId = draft.id;
        const created = draft.createdAt && !Number.isNaN(Date.parse(draft.createdAt)) ? new Date(draft.createdAt).toLocaleString("ko-KR") : "작성 시각을 모르는 이전 기록";
        button.textContent = `기록 ${index + 1} · ${created} 열기`;
        button.disabled = working || converting || authPending;
        draftChoices.append(button);
      }
    }
    if (pageSuspended) {
      mount.querySelector("[data-notebook-status]").textContent = reconnecting ? "계정 연결 다시 확인 중" : "계정 연결 확인 필요";
      mount.querySelector("[data-notebook-detail]").textContent = resumeMessage || "이전에 작성하던 화면을 보관하고 있어요. 같은 계정을 확인한 뒤 이어서 보여 드려요.";
      pendingNote.hidden = true;
      localNote.hidden = true;
      draftChoices.hidden = true;
      mount.querySelector(".notebook-conflict").hidden = true;
      for (const name of ["refresh", "import", "delete", "recover", "export-local", "clear-local"]) element(name).disabled = true;
      element("export-local").hidden = true;
      element("retry").hidden = false;
      element("retry").disabled = reconnecting;
      element("retry").textContent = "계정 연결 다시 확인";
      element("signin").hidden = !auth.signedIn ? false : auth.accountId === ownerAccountId;
      element("signin").disabled ||= reconnecting;
      if (auth.signedIn) element("signin").textContent = "현재 로그인 계정으로 전환";
    } else element("retry").textContent = "저장 다시 시도";
    onStatusChange();
  }
  function preserveInterruptedRead() {
    if (hydrating && incomingDocument && !unsent) {
      hydrationFailure = { code: "AUTH_RESTORING", document: incomingDocument };
      problem = "로그인 연결을 다시 확인하는 동안 기록 읽기가 멈췄어요. 저장 다시 시도로 보관한 기록을 다시 열어 주세요.";
    }
    incomingDocument = null;
  }
  function onAuth(next) {
    auth = next;
    if (pageSuspended) {
      paint();
      return;
    }
    const nextOwner = next.signedIn && next.accountId ? `${next.accountId}:${next.sessionGeneration}` : null;
    if (!nextOwner && owner && ["restoring", "signing-in", "error"].includes(next.status)) {
      if (!authPaused) {
        preserveInterruptedRead();
        generation++;
        stateVersion++;
        conversionVersion++;
        hydrating = false;
        converting = false;
      }
      authPaused = true;
      suspended = true;
      paint();
      return;
    }
    suspended = !!hydrationFailure;
    if (nextOwner && ownerAccountId === next.accountId && (authPaused || nextOwner !== owner)) {
      preserveInterruptedRead();
      generation++;
      stateVersion++;
      conversionVersion++;
      hydrating = false;
      converting = false;
      owner = nextOwner;
      authPaused = false;
      suspended = !!hydrationFailure;
      if (unsent) problem = "같은 계정으로 다시 연결했어요. 보내지 못한 원본과 기록을 유지하고 있으니 저장 다시 시도로 이어가 주세요.";
      paint();
      return;
    }
    if (nextOwner === owner) {
      paint();
      return;
    }
    generation++;
    stateVersion++;
    conversionVersion++;
    deletionVersion++;
    hydrating = false;
    converting = false;
    deleting = false;
    unsent = null;
    problem = "";
    hydrationFailure = null;
    incomingDocument = null;
    suspended = false;
    switching = true;
    const wasActive = !!owner;
    if (!owner && nextOwner) guest = copy(getState());
    owner = nextOwner;
    ownerAccountId = nextOwner ? next.accountId : null;
    authPaused = false;
    sync.close();
    if (owner) {
      onMode(true, { wasActive });
      switching = false;
      void sync.open(next.accountId);
    } else {
      onMode(false);
      if (guest) {
        applyState(copy(guest), { guest: true });
        guest = null;
      }
      switching = false;
    }
    paint();
  }
  function guardedAccount(expected) {
    const guard = () => {
      if (expected !== generation || !owner || closed || authPaused || pageSuspended) throw Object.assign(new Error("계정 연결이 바뀌어 이전 파일 작업을 멈췄어요."), { code: "ACCOUNT_CHANGED" });
    };
    return { async request(operation, values) {
      guard();
      const result = await account.request(operation, values);
      guard();
      return result;
    } };
  }
  async function receive(document2) {
    if (switching || !owner || authPaused || pageSuspended || closed) return;
    const expected = generation, version = ++stateVersion;
    hydrating = true;
    incomingDocument = copy(document2);
    problem = "";
    paint();
    try {
      const state = await fromDocument(document2, guardedAccount(expected));
      if (expected !== generation || version !== stateVersion || !owner || closed) return;
      hydrationFailure = null;
      suspended = false;
      unsent = null;
      applyState(state, { guest: false });
    } catch (error) {
      if (expected === generation && version === stateVersion) {
        problem = error.message;
        suspended = true;
        hydrationFailure = { code: error.code, document: copy(document2) };
      }
    } finally {
      if (expected === generation && version === stateVersion) {
        hydrating = false;
        incomingDocument = null;
        paint();
      }
    }
  }
  account = accountFactory({ clientKey: resource, endpoint: "synk-personal", scope: "synk-personal", resource, validateState, operations, bridge, onStatus: onAuth });
  sync = syncFactory({
    validateState,
    emptyState: emptyDocument,
    scope: "synk-personal",
    resource,
    preferRemoteOnOpen,
    cachePrefix: `synk.personal.${resource}.v1.`,
    operations,
    transport: async (operation, values) => {
      if (pageSuspended || authPaused || !auth.signedIn) throw Object.assign(new Error("계정 연결을 다시 확인한 뒤 기록을 저장해 주세요. 현재 기록은 유지하고 있어요."), { code: "AUTH_RESTORING" });
      const expected = generation, inputVersion = conversionVersion, read = operation === operations.load ? { generation: expected } : null;
      if (read) {
        reading = read;
        paint();
      }
      try {
        const response = await account.request(operation, values);
        if (expected !== generation) throw Object.assign(new Error("로그인 연결이 바뀌어 이전 요청 결과를 적용하지 않았어요. 다시 시도해 주세요."), { code: "AUTH_RESTORING" });
        if (operation === operations.load && inputVersion !== conversionVersion) throw Object.assign(new Error("가져오는 동안 새로 수정한 내용이 있어요. 현재 입력을 유지하고 기록을 다시 골라 주세요."), { code: "LOCAL_CHANGED_DURING_REFRESH" });
        return response;
      } finally {
        if (read && reading === read) {
          reading = null;
          paint();
        }
      }
    },
    storage,
    onState: receive,
    onSaved: (document2) => {
      if (owner && !closed) onDocumentSaved(document2);
    },
    onRemoved: () => {
      if (owner && !closed) onDocumentRemoved();
    },
    onStatus: (next) => {
      saved = next;
      paint();
    }
  });
  saved.localRecords = sync.localRecords();
  if (saved.localRecords.error) saved.error = saved.localRecords.error;
  async function change(value) {
    if (!owner || pageSuspended || suspended || deleting || closed) return false;
    stateVersion++;
    hydrating = false;
    hydrationFailure = null;
    incomingDocument = null;
    const expected = generation, version = ++conversionVersion;
    const snapshot = copy(value);
    unsent = snapshot;
    converting = true;
    problem = "";
    paint();
    try {
      const document2 = await toDocument(snapshot, guardedAccount(expected));
      if (expected !== generation || version !== conversionVersion || !owner || closed) return false;
      sync.change(document2);
      unsent = null;
      return true;
    } catch (error) {
      if (expected === generation && version === conversionVersion) problem = documentSyncErrorMessage(error);
      return false;
    } finally {
      if (expected === generation && version === conversionVersion) {
        converting = false;
        paint();
      }
    }
  }
  async function retry() {
    if (pageSuspended) return resume();
    if (deleting || authPaused) return false;
    if (hydrationFailure) {
      await receive(hydrationFailure.document);
      return suspended ? false : sync.flush();
    }
    const expected = generation, rebuild = await prepareRetry({ error: saved.error, pending: saved.pending });
    if (expected !== generation || !owner || closed) return false;
    if (rebuild && !await change(getState())) return false;
    if (!rebuild && unsent && !await change(unsent)) return false;
    return sync.flush();
  }
  async function signOutWithNotice() {
    const operation = account.signOut(), expected = generation;
    const current = () => !closed && !owner && expected === generation && !["restoring", "signing-in"].includes(auth.status);
    try {
      const result = await operation;
      if (!current()) return;
      const warnings = [];
      if (result?.ok === false) warnings.push("이 기기의 로그인 정보 삭제를 확인하지 못했어요. 공유 기기라면 브라우저나 앱의 저장 정보를 확인해 주세요.");
      if (result?.serverRevoked === false) warnings.push("서버의 세션 종료는 확인하지 못했어요. 연결이 돌아오면 SYNK ID의 로그인 기기에서 이 세션을 종료해 주세요.");
      if (warnings.length) problem = warnings.join(" ");
    } catch (error) {
      if (current()) problem = documentSyncErrorMessage(error);
    }
  }
  async function act(action, target) {
    if (pageSuspended && !["signin", "signout", "retry"].includes(action)) return;
    if (deleting && !["signout", "export-local"].includes(action) || !pageSuspended && authPaused && !["signin", "signout"].includes(action)) return;
    const expected = generation;
    problem = "";
    try {
      if (action === "signin") {
        if (pageSuspended && auth.signedIn && auth.accountId !== ownerAccountId) {
          if (beforeNavigate() && globalThis.confirm("현재 로그인 계정으로 전환할까요? 현재 창에서 기기에 보관하지 못한 입력은 사라져요.")) {
            leaveSuspension();
            onAuth(auth);
          }
        } else if (beforeNavigate() && (!pageSuspended || !(unsent || saved.pending && saved.pendingStored === false) || globalThis.confirm("이 창을 벗어나 로그인하면 아직 보관하지 못한 원본이나 입력이 사라질 수 있어요. 다시 로그인할까요?"))) {
          const next = await account.signIn();
          if (pageSuspended && next?.signedIn && next.accountId === ownerAccountId) await resume();
          else if (!pageSuspended && next) onAuth(next);
        }
      } else if (action === "signout") {
        if (beforeNavigate() && (!(converting || unsent || saved.pending && saved.pendingStored === false) || globalThis.confirm("아직 원본이나 기록을 계정에 저장하지 못했고 기기 임시보관도 확인하지 못했어요. 현재 기록을 내보내지 않고 로그아웃할까요?"))) {
          leaveSuspension();
          await signOutWithNotice();
        }
      } else if (action === "refresh") {
        if (unsent || converting) problem = "아직 계정에 보내지 못한 원본과 기록이 있어요. 저장 다시 시도를 먼저 하거나 현재 기록을 파일로 내보내 주세요. 다시 불러오기로 이 기록을 바꾸지 않았어요.";
        else if (beforeNavigate()) {
          if (hydrationFailure) await receive(hydrationFailure.document);
          else {
            suspended = false;
            await sync.refresh();
          }
        }
      } else if (action === "retry") await retry();
      else if (action === "select-draft" && beforeNavigate() && (!(saved.pending || unsent) || globalThis.confirm("현재 화면 대신 선택한 미저장 기록을 열까요? 기기에 보관한 다른 미저장 기록은 그대로 남아요. 보관하지 못한 입력은 먼저 내보내 주세요."))) {
        await sync.selectLocalDraft(target.dataset.draftId);
      } else if (action === "export-local") {
        const file = new Blob([JSON.stringify(sync.exportLocalRecords(), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(file), link = document.createElement("a");
        link.href = url;
        link.download = `synk-${resource}-local-recovery.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1e3);
      } else if (action === "clear-local" && owner && !saved.pending && !converting && !unsent && !hydrating && globalThis.confirm("로그인한 이 계정이 이 앱에 남긴 임시기록을 지울까요? 미저장 변경과 읽지 못한 원본은 복구할 수 없어요. 다른 계정의 임시기록, 계정 서버 자료, 로그인 전 기기 기록은 그대로예요. 필요한 복구 파일을 실제로 저장했는지 먼저 확인해 주세요.")) sync.clearLocalRecords();
      else if (action === "delete" && owner && beforeNavigate() && globalThis.confirm(deleteConfirmation)) await remove();
      else if (action === "import" && guest && beforeNavigate() && globalThis.confirm("로그인 전 이 기기의 기록으로 현재 계정 기록을 바꿀까요? 보관할 계정 기록은 먼저 내보내 주세요.")) {
        applyState(copy(guest), { guest: false });
        await change(guest);
      } else if (action === "remote") {
        if (preferRemoteOnOpen && (unsent || converting)) problem = "아직 기기에 보관하지 못한 입력이 있어 계정 기록으로 바꾸지 않았어요. 저장 다시 시도 후 열어 주세요.";
        else if (beforeNavigate() && (preferRemoteOnOpen || globalThis.confirm("이 화면의 미저장 변경을 버리고 계정 기록을 불러올까요?"))) await sync.resolveRemote();
      } else if (action === "recover" && hydrationFailure && saved.pending && ["ASSET_NOT_FOUND", "ASSET_NOT_CONFIRMED"].includes(hydrationFailure.code) && globalThis.confirm("미저장 기록은 복구용으로 이 기기에 남겨 두고 마지막 계정 저장본을 열까요? 현재 화면은 저장본으로 바뀌어요. 남긴 기록은 이 계정으로 로그인한 상태에서 직접 지울 수 있어요.")) {
        hydrationFailure = null;
        unsent = null;
        suspended = false;
        await sync.resolveRemote();
      } else if (action === "local" && globalThis.confirm("이 화면의 기록으로 계정 기록을 바꿀까요? 다른 기기의 변경 내용은 덮어써요.")) {
        if (!unsent || await change(unsent)) await sync.resolveLocal();
      }
    } catch (error) {
      if (!closed && expected === generation) problem = documentSyncErrorMessage(error);
    }
    paint();
  }
  mount.addEventListener("click", (event) => {
    const target = event.target.closest("[data-notebook]");
    if (target) void act(target.dataset.notebook, target);
  });
  const beforeUnload = (event) => {
    if (owner && (saved.pending || unsent || converting)) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  globalThis.addEventListener("beforeunload", beforeUnload);
  async function remove() {
    if (!owner || closed || pageSuspended || authPaused || deleting || converting || hydrating) return false;
    const expected = generation, deletion = ++deletionVersion;
    deleting = true;
    paint();
    try {
      const removed = await sync.remove();
      if (removed && expected === generation) {
        unsent = null;
        conversionVersion++;
        problem = "";
      }
      return removed;
    } finally {
      if (deletion === deletionVersion) {
        deleting = false;
        paint();
      }
    }
  }
  function leaveSuspension() {
    pageSuspended = false;
    reconnecting = false;
    resumeMessage = "";
    resumeVersion++;
    resumePromise = null;
  }
  function suspend() {
    if (closed) return;
    pageSuspended = true;
    resumeVersion++;
    resumePromise = null;
    reconnecting = false;
    preserveInterruptedRead();
    generation++;
    stateVersion++;
    conversionVersion++;
    hydrating = false;
    converting = false;
    paint();
  }
  function resume() {
    if (closed) return Promise.resolve(false);
    if (!pageSuspended) return Promise.resolve(true);
    if (resumePromise) return resumePromise;
    if (!owner) {
      if (auth.signedIn) {
        resumeMessage = "로그인 확인이 끝났어요. 현재 창의 입력을 보관하고 있으니 계정 기록으로 전환할 때 직접 선택해 주세요.";
        paint();
        return Promise.resolve(false);
      }
      leaveSuspension();
      paint();
      return Promise.resolve(true);
    }
    const expected = resumeVersion, identity = ownerAccountId;
    reconnecting = true;
    resumeMessage = "";
    paint();
    const operation = (async () => {
      try {
        const response = await account.request(operations.load);
        if (closed || expected !== resumeVersion) return false;
        if (!auth.signedIn || auth.accountId !== identity || response?.accountId !== identity)
          throw new Error("이전에 작성하던 계정과 연결이 달라졌어요. 같은 계정으로 로그인하거나 현재 계정으로 직접 전환해 주세요.");
        leaveSuspension();
        onAuth(auth);
        paint();
        return true;
      } catch (error) {
        if (!closed && expected === resumeVersion) resumeMessage = "작성 중인 화면은 숨긴 채 보관하고 있어요. " + documentSyncErrorMessage(error);
        return false;
      } finally {
        if (!closed && expected === resumeVersion) {
          reconnecting = false;
          resumePromise = null;
          paint();
        }
      }
    })();
    resumePromise = operation;
    return operation;
  }
  paint();
  return {
    start: () => account.start(),
    change,
    retry,
    remove,
    suspend,
    resume,
    // A guest device write can finish after login. Its acknowledged snapshot
    // belongs to the guest; only explicit import may copy it into the account.
    updateGuestState(value) {
      if (!owner || !guest || closed) return false;
      guest = copy(value);
      return true;
    },
    get active() {
      return !!owner;
    },
    get pending() {
      return !!owner && (saved.pending || !!unsent || converting);
    },
    // App-owned dialogs can live outside content. They must honor the same
    // account lock before replacing their own in-memory document.
    get canEdit() {
      return !!owner && !closed && !authPaused && !pageSuspended && !suspended && !deleting && !hydrating && !switching && !reconnecting && !isReading() && saved.status !== "local-conflict";
    },
    get status() {
      return { ...saved, status: isReading() ? "loading" : saved.status, active: !!owner, hydrating, converting, deleting, error: problem };
    },
    dispose() {
      closed = true;
      generation++;
      deletionVersion++;
      resumeVersion++;
      switching = true;
      sync.close();
      account.dispose();
      globalThis.removeEventListener("beforeunload", beforeUnload);
    }
  };
}

// experiences/synk-account/src/platform-library-data.mjs
var PLATFORM_APP_IDS = Object.freeze(["world", "messenger", "teacher", "path", "pulse", "partners", "care", "fortune", "rehearsal", "family-album"]);
var RETIRED_PLATFORM_APP_IDS = /* @__PURE__ */ new Set(["rehearsal", "family-album"]);
var ACTIVE_PLATFORM_APP_IDS = Object.freeze(PLATFORM_APP_IDS.filter((id) => id !== "partners" && !RETIRED_PLATFORM_APP_IDS.has(id)));
var platformAppId = (id) => id === "partners" ? "pulse" : id;
var platformDisplayAppId = (id, appIds = ACTIVE_PLATFORM_APP_IDS) => platformAppId(id) === "teacher" && appIds.includes("teacher") && appIds.includes("messenger") ? "messenger" : platformAppId(id);
var platformDisplayAppIds = (appIds = ACTIVE_PLATFORM_APP_IDS) => [...new Set(appIds.filter((id) => ACTIVE_PLATFORM_APP_IDS.includes(id)).map((id) => platformDisplayAppId(id, appIds)))];
var PLATFORM_NOTE_LIMIT = 60;
var PLATFORM_LIBRARY_LIMITS = Object.freeze({ maxBytes: 64 * 1024 });
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
var invalid = () => {
  throw Object.assign(new TypeError("플랫폼 기록 형식을 확인해 주세요."), { code: "INVALID_PERSONAL_STATE" });
};
var noteLimit = () => {
  throw Object.assign(new Error("메모는 최대 " + PLATFORM_NOTE_LIMIT + "개까지 보관할 수 있어요. 필요 없는 메모를 삭제한 뒤 다시 시도해 주세요."), { code: "NOTE_LIMIT" });
};
var exact = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => Object.hasOwn(value, key));
var stamp = (value) => Number.isSafeInteger(value) && value > 0 && value <= 864e13;
var text = (value, limit) => typeof value === "string" && value.trim().length > 0 && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);
var ids = (value) => Array.isArray(value) && value.length <= PLATFORM_APP_IDS.length && new Set(value).size === value.length && value.every((id) => PLATFORM_APP_IDS.includes(id));
var note = (row) => exact(row, ["id", "appId", "title", "done", "createdAt"]) && text(row.id, 80) && /^[a-zA-Z0-9-]+$/.test(row.id) && PLATFORM_APP_IDS.includes(row.appId) && text(row.title, 240) && typeof row.done === "boolean" && stamp(row.createdAt);
function emptyPlatformLibrary() {
  return { version: 1, consent: false, favorites: [], recent: [], rememberRecent: true, notes: [] };
}
function validatePlatformLibrary(value) {
  if (!exact(value, ["version", "consent", "favorites", "recent", "rememberRecent", "notes"]) || value.version !== 1 || typeof value.consent !== "boolean" || !ids(value.favorites) || typeof value.rememberRecent !== "boolean" || !Array.isArray(value.recent) || value.recent.length > PLATFORM_APP_IDS.length || !Array.isArray(value.notes) || value.notes.length > PLATFORM_NOTE_LIMIT) invalid();
  if (!value.consent && (value.favorites.length || value.recent.length || value.notes.length) || !value.rememberRecent && value.recent.length) invalid();
  const seen = /* @__PURE__ */ new Set();
  for (const row of value.recent) {
    if (!exact(row, ["id", "at", "mode"]) || !PLATFORM_APP_IDS.includes(row.id) || !stamp(row.at) || !["web", "client"].includes(row.mode) || seen.has(row.id)) invalid();
    seen.add(row.id);
  }
  seen.clear();
  for (const row of value.notes) {
    if (!note(row) || seen.has(row.id)) invalid();
    seen.add(row.id);
  }
  return structuredClone(value);
}
function projectPlatformLibrary(value, { appIds = ACTIVE_PLATFORM_APP_IDS } = {}) {
  const next = validatePlatformLibrary(value);
  next.favorites = [...new Set(next.favorites.filter((id) => !RETIRED_PLATFORM_APP_IDS.has(id)).map((id) => platformDisplayAppId(id, appIds)))];
  const recent = /* @__PURE__ */ new Map();
  for (const row of next.recent) {
    if (RETIRED_PLATFORM_APP_IDS.has(row.id)) continue;
    const id = platformDisplayAppId(row.id, appIds), previous = recent.get(id);
    if (!previous || row.at > previous.at) recent.set(id, { ...row, id, ...row.id === "teacher" && id !== row.id ? { entryId: "teacher" } : {} });
  }
  next.recent = [...recent.values()].sort((a, b) => b.at - a.at);
  return next;
}
function updatePlatformLibrary(value, action, now = Date.now(), appIds = ACTIVE_PLATFORM_APP_IDS) {
  const next = validatePlatformLibrary(value);
  if (action.type === "consent") {
    if (action.value !== true) return emptyPlatformLibrary();
    next.consent = true;
    return next;
  }
  if (!next.consent) throw new Error("계정에 저장할 항목을 확인하고 연결을 켜 주세요.");
  if (["favorite", "launch", "note"].includes(action.type) && !ACTIVE_PLATFORM_APP_IDS.includes(action.id)) invalid();
  if (action.type === "favorite") next.favorites = next.favorites.some((id) => platformDisplayAppId(id, appIds) === platformDisplayAppId(action.id, appIds)) ? next.favorites.filter((id) => platformDisplayAppId(id, appIds) !== platformDisplayAppId(action.id, appIds)) : [...next.favorites, action.id];
  else if (action.type === "move-favorite") {
    if (!ACTIVE_PLATFORM_APP_IDS.includes(action.id) || ![-1, 1].includes(action.direction)) invalid();
    const groups = /* @__PURE__ */ new Map();
    for (const id of next.favorites) {
      const visible2 = platformDisplayAppId(id, appIds);
      if (!groups.has(visible2)) groups.set(visible2, []);
      groups.get(visible2).push(id);
    }
    const order = [...groups.keys()], visible = platformDisplayAppIds(appIds), from = order.indexOf(platformDisplayAppId(action.id, appIds));
    if (from < 0 || !visible.includes(order[from])) invalid();
    let to = from + action.direction;
    while (to >= 0 && to < order.length && !visible.includes(order[to])) to += action.direction;
    if (to >= 0 && to < order.length) {
      [order[from], order[to]] = [order[to], order[from]];
      next.favorites = order.flatMap((id) => groups.get(id));
    }
  } else if (action.type === "launch" && next.rememberRecent) next.recent = [{ id: action.id, at: now, mode: action.mode }, ...next.recent.filter((row) => platformDisplayAppId(row.id, appIds) !== platformDisplayAppId(action.id, appIds))];
  else if (action.type === "remember") {
    next.rememberRecent = action.value;
    if (!action.value) next.recent = [];
  } else if (action.type === "clear-recent") next.recent = [];
  else if (action.type === "note") {
    if (next.notes.length >= PLATFORM_NOTE_LIMIT) noteLimit();
    next.notes.unshift({ id: globalThis.crypto.randomUUID(), appId: action.id, title: String(action.title || "").trim(), done: false, createdAt: now });
  } else if (action.type === "edit-note") {
    const row = next.notes.find((row2) => row2.id === action.noteId);
    if (!row || !text(action.title, 240) || !ACTIVE_PLATFORM_APP_IDS.includes(action.id) && !(action.id === "partners" && row.appId === "partners")) invalid();
    row.title = action.title.trim();
    row.appId = action.id;
  } else if (action.type === "restore-note") {
    if (!note(action.note) || !Number.isSafeInteger(action.index) || action.index < 0 || action.index > next.notes.length || next.notes.some((row) => row.id === action.note.id)) invalid();
    if (next.notes.length >= PLATFORM_NOTE_LIMIT) noteLimit();
    next.notes.splice(action.index, 0, structuredClone(action.note));
  } else if (action.type === "toggle-note") {
    const row = next.notes.find((row2) => row2.id === action.noteId);
    if (!row) invalid();
    row.done = !row.done;
  } else if (action.type === "remove-note") next.notes = next.notes.filter((row) => row.id !== action.noteId);
  else if (!["favorite", "launch", "remember", "clear-recent"].includes(action.type)) invalid();
  return validatePlatformLibrary(next);
}

// experiences/synk-account/src/personal-state.mjs
var fail = (code, message) => {
  throw Object.assign(new TypeError(message), { code });
};
var invalid2 = () => fail("PERSONAL_DATA_INVALID", "저장할 개인 기록의 형식을 확인해 주세요.");
var encoder = new TextEncoder();
function jsonCopy(value, maxBytes) {
  const ancestors = /* @__PURE__ */ new Set();
  let nodes = 0;
  function visit(item, depth) {
    if (++nodes > 2e5 || depth > 32) invalid2();
    if (typeof item === "string") {
      if (/\u0000|[\uD800-\uDFFF]/u.test(item)) invalid2();
      return;
    }
    if (item === null || typeof item === "boolean") return;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) invalid2();
      return;
    }
    if (typeof item !== "object" || ancestors.has(item)) invalid2();
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) invalid2();
    ancestors.add(item);
    for (const key of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== "string" || /\u0000|[\uD800-\uDFFF]/u.test(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) invalid2();
      if (Array.isArray(item) && !/^(0|[1-9]\d*)$/.test(key)) invalid2();
      visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(item) && Object.keys(item).length !== item.length) invalid2();
    ancestors.delete(item);
  }
  visit(value, 0);
  const serialized = JSON.stringify(value);
  if (encoder.encode(serialized).length > maxBytes) fail("PERSONAL_DATA_TOO_LARGE", "저장할 개인 기록이 허용 크기를 넘었어요.");
  return JSON.parse(serialized);
}
function checkPersonalState(value, maxBytes, validate) {
  const copy2 = jsonCopy(value, maxBytes);
  try {
    return validate(copy2);
  } catch (error) {
    if (error.code) throw error;
    invalid2();
  }
}

// experiences/synk-account/src/platform-library-state.mjs
function validatePlatformLibraryState(value) {
  return checkPersonalState(value, PLATFORM_LIBRARY_LIMITS.maxBytes, validatePlatformLibrary);
}

// experiences/synk-account/src/platform-library-account.mjs
function platformLibraryAccount({ host, native = false, onLogin = () => {
}, onManage = () => {
}, onStatus = () => {
} }) {
  let current = { signedIn: false, configured: false, status: "unconfigured", accountId: null, sessionGeneration: 0 }, closed = false, unsubscribe = null, epoch = 0, notification = 0, nativeRetry = null;
  const receive = (source) => {
    if (closed) return current;
    if (Number.isSafeInteger(source?.sessionGeneration) && Number.isSafeInteger(current.sessionGeneration) && source.sessionGeneration < current.sessionGeneration) return { ...current };
    notification++;
    const accountId = native ? source?.account?.synk_user_id : source?.accountId;
    current = { ...source, accountId: source?.signedIn === true && typeof accountId === "string" ? accountId : null };
    current.signedIn = !!current.accountId;
    onStatus({ ...current });
    return { ...current };
  };
  async function nativeAction(action, recheck = false) {
    const attempt = ++epoch, observed = notification, result = await action();
    if (closed || attempt !== epoch) return { ...current };
    const readObserved = recheck ? notification : observed;
    if (recheck || observed === notification) {
      const value = await host.authStatus();
      if (!closed && attempt === epoch && readObserved === notification) receive(value);
    }
    if (closed || attempt !== epoch) return { ...current };
    return { ...current, ...result?.ok === false ? { ok: false } : {}, ...typeof result?.serverRevoked === "boolean" ? { serverRevoked: result.serverRevoked } : {} };
  }
  async function retryNativeIdentity() {
    if (closed) return { ...current };
    if (nativeRetry) return nativeRetry;
    if (typeof host.accountRequest !== "function") throw Object.assign(new Error("저장된 계정 연결을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요."), { code: "AUTH_REQUEST_UNAVAILABLE", retryable: true });
    const task = nativeAction(() => host.accountRequest("load", {}), true);
    nativeRetry = task;
    try {
      return await task;
    } finally {
      if (nativeRetry === task) nativeRetry = null;
    }
  }
  async function retryWebIdentity() {
    const attempt = ++epoch, observed = notification;
    await host.refresh();
    if (closed || attempt !== epoch) return { ...current };
    return observed === notification ? receive(host.identity()) : { ...current };
  }
  return {
    async start() {
      const attempt = ++epoch;
      unsubscribe?.();
      unsubscribe = native ? host.onAuthChanged(receive) : host.subscribe(receive);
      const observed = notification;
      const value = native ? await host.authStatus() : (await host.refresh(), host.identity());
      if (!closed && attempt === epoch && (!native || observed === notification)) return receive(value);
      return { ...current };
    },
    status: () => ({ ...current }),
    async request(operation, params) {
      const mapped = { personalLoad: "platformLoad", personalSave: "platformSave", personalDelete: "platformDelete" }[operation];
      if (!mapped || closed || !current.signedIn) throw Object.assign(new Error("플랫폼 계정 연결을 다시 확인해 주세요."), { code: "AUTH_REQUIRED" });
      const owner = current.accountId, generation = current.sessionGeneration;
      const result = await (native ? host.accountRequest(mapped, params) : host.request(mapped, params));
      if (closed || !current.signedIn || owner !== current.accountId || generation !== current.sessionGeneration) throw Object.assign(new Error("계정 연결이 바뀌었어요."), { code: "ACCOUNT_CHANGED" });
      if (result?.ok === false) throw Object.assign(new Error(result.error?.message || "계정 연결을 확인해 주세요."), result.error || {}, Number.isSafeInteger(result.revision) ? { revision: result.revision } : {});
      return result?.data || result;
    },
    async signIn() {
      if (native) return !current.signedIn && current.error?.retryable === true ? retryNativeIdentity() : nativeAction(() => host.authSignIn());
      if (closed) return { ...current };
      if (current.status !== "signed-out" || current.signedIn || current.error?.retryable) return retryWebIdentity();
      onLogin();
      return { ...current };
    },
    async retryConnection() {
      if (!native || closed || current.signedIn || current.error?.retryable !== true) return { ...current };
      return retryNativeIdentity();
    },
    async signOut() {
      if (native) return nativeAction(() => host.authSignOut());
      onManage();
      return { ok: false, message: "계정 관리에서 로그아웃을 완료해 주세요." };
    },
    dispose() {
      closed = true;
      epoch++;
      unsubscribe?.();
    }
  };
}

// experiences/synk-account/src/platform-library-recovery.mjs
function libraryDraft(value) {
  const draft = (row) => row && PLATFORM_APP_IDS.includes(row.appId) && typeof row.title === "string" && row.title.length <= 240;
  if (!value || !draft(value.draft) || value.parkedDraft !== null && !draft(value.parkedDraft)) return null;
  const edit = value.editing;
  if (edit !== null && (!draft(edit) || typeof edit.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(edit.id) || typeof edit.done !== "boolean" || !Number.isSafeInteger(edit.createdAt) || edit.createdAt <= 0)) return null;
  return { draft: { appId: value.draft.appId, title: value.draft.title }, editing: edit ? { id: edit.id, appId: edit.appId, title: edit.title, done: edit.done, createdAt: edit.createdAt } : null, parkedDraft: value.parkedDraft ? { appId: value.parkedDraft.appId, title: value.parkedDraft.title } : null };
}
function createLibraryRecovery({ getHost, getOwner, canUse, getPayload, onChange = () => {
} }) {
  let status = null, candidate = null, checkedOwner = null, timer = null, epoch = 0, closed = false, unsubscribe = null, hostBound = null, write = Promise.resolve(), error = "", removalFailed = false;
  const owner = () => !closed && canUse() ? getOwner() : null;
  const present = (payload) => !!payload?.draft.title.trim() || !!payload?.parkedDraft?.title.trim();
  const current = (expected, account) => !closed && epoch === expected && getOwner() === account;
  function state() {
    return { enabled: status?.enabled === true, candidate, error, removalFailed };
  }
  function changed() {
    if (!closed) onChange(state());
  }
  function reset() {
    epoch++;
    clearTimeout(timer);
    timer = null;
    checkedOwner = null;
    status = null;
    candidate = null;
    error = "";
    removalFailed = false;
  }
  async function refresh(force = false) {
    const host = getHost(), account = owner();
    if (!account || typeof host?.draftRecoveryStatus !== "function") return;
    if (host !== hostBound) {
      unsubscribe?.();
      hostBound = host;
      unsubscribe = host.onDraftRecoveryChanged?.(() => {
        reset();
        void refresh(true);
      });
    }
    if (!force && checkedOwner === account) return;
    checkedOwner = account;
    const expected = epoch;
    try {
      const next = await host.draftRecoveryStatus(account);
      if (!current(expected, account) || !canUse()) return;
      if (next.ok !== true) throw new Error("status");
      status = next;
      if (!next.enabled || !next.available) {
        candidate = null;
        error = "";
        changed();
        return;
      }
      const loaded = await host.draftRecoveryLoad("platform-library", account);
      if (!current(expected, account) || !canUse()) return;
      if (loaded.ok !== true) throw new Error("load");
      const saved = libraryDraft(loaded.draft);
      candidate = present(saved) && !present(getPayload()) ? saved : null;
      error = "";
      changed();
      if (!candidate && present(getPayload())) schedule();
    } catch {
      if (current(expected, account)) {
        status = null;
        error = "기기의 초안 복구 상태를 확인하지 못했어요. 현재 입력은 이 화면에 유지돼요.";
        changed();
      }
    }
  }
  function persist() {
    clearTimeout(timer);
    timer = null;
    const account = owner(), expected = epoch, payload = libraryDraft(getPayload()), host = getHost();
    if (!account || !status?.enabled || !status?.available || candidate || !payload) return write;
    write = write.catch(() => {
    }).then(async () => {
      if (!current(expected, account)) return;
      try {
        const result = present(payload) ? await host.draftRecoverySave("platform-library", payload, account) : await host.draftRecoveryClear("platform-library", account);
        if (!current(expected, account)) return;
        if (result.ok !== true) throw new Error("save");
        if (error) {
          error = "";
          changed();
        }
      } catch {
        if (current(expected, account)) {
          error = "기기에 초안을 보관하지 못했어요. 창을 닫기 전에 계정에 메모를 저장해 주세요.";
          changed();
        }
      }
    });
    return write;
  }
  function schedule() {
    clearTimeout(timer);
    if (!closed) timer = setTimeout(() => {
      void persist();
    }, 350);
  }
  function take() {
    const saved = candidate;
    epoch++;
    clearTimeout(timer);
    timer = null;
    checkedOwner = getOwner();
    candidate = null;
    error = "";
    removalFailed = false;
    changed();
    return saved;
  }
  async function discard() {
    const cleared = await clear();
    if (cleared && present(getPayload())) schedule();
    return cleared;
  }
  async function clear() {
    const host = getHost(), account = getOwner(), expected = ++epoch;
    candidate = null;
    error = "";
    removalFailed = false;
    clearTimeout(timer);
    timer = null;
    checkedOwner = account;
    changed();
    if (!account || status?.enabled === false || typeof host?.draftRecoveryClear !== "function") return true;
    write = write.catch(() => {
    }).then(async () => {
      if (!current(expected, account)) return true;
      try {
        const result = await host.draftRecoveryClear("platform-library", account);
        if (!current(expected, account)) return true;
        if (result?.ok !== true) throw new Error("clear");
        if (typeof result.enabled === "boolean") status = result;
        return true;
      } catch {
        if (current(expected, account)) {
          removalFailed = true;
          error = "기기에 보관한 초안을 지우지 못했어요. 창을 열어 둔 채 다시 시도해 주세요.";
          changed();
        }
        return false;
      }
    });
    return write;
  }
  return { state, refresh, reset, schedule, persist, take, discard, clear, dispose() {
    clearTimeout(timer);
    closed = true;
    epoch++;
    unsubscribe?.();
  } };
}

// experiences/synk-account/src/platform-library-view.mjs
var names = { world: "WORLD", messenger: "워크스페이스", teacher: "워크스페이스 · 내 수업", path: "PATH", pulse: "PULSE", partners: "PULSE · 이전 Partners 기록", care: "플레저", fortune: "운세" };
var esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
var librarySequence = 0;
function mountPlatformLibrary(root, { getHost, ensureReady = async () => {
}, native = false, getDevice = () => ({}), getAppIds = () => ACTIVE_PLATFORM_APP_IDS, onChange = () => {
}, onFavoritesChanged = () => {
}, onOpen = () => {
}, onLogin = () => {
}, onManage = onLogin, storage = globalThis.localStorage } = {}) {
  let notebook = null, doc = emptyPlatformLibrary(), draft = { appId: "world", title: "" }, message = "", modeVersion = 0, submitting = false, pageSuspended = false, connecting = false, disposed = false, resumeId = null, initialExpansionPending = false, connectOnResume = false;
  let editing = null, parkedDraft = null, deletedNotes = [], completedExpanded = false, noteQuery = "", noteFilter = "all";
  let recoveryOwner = null;
  let accountAdapter = null, nativeVerification = null, nativeVerificationNotice = null;
  let documentOwner = null, documentReady = false;
  let favoriteIntent = null;
  const favoriteSignature = (value) => JSON.stringify(projectPlatformLibrary(value, { appIds: entryIds() }).favorites);
  const readyWaiters = /* @__PURE__ */ new Set();
  function readiness() {
    if (disposed || pageSuspended) return false;
    const status = notebook?.status;
    if (connecting || status?.status === "loading" || status?.hydrating || notebook?.active && status?.status === "closed") return null;
    if (!notebook?.active) return true;
    return documentReady && Number.isSafeInteger(status.revision) && status.accountId === documentOwner && notebook.canEdit;
  }
  function notifyReady() {
    const value = readiness();
    if (value === null) return;
    for (const resolve of readyWaiters) resolve(value);
    readyWaiters.clear();
  }
  function ready() {
    const value = readiness();
    return value === null ? new Promise((resolve) => readyWaiters.add(resolve)) : Promise.resolve(value);
  }
  const panelId = "synk-library-panel-" + ++librarySequence;
  root.classList.add("platform-continuity");
  root.innerHTML = '<header class="continuity-overview"><div class="continuity-preview"><p class="continuity-eyebrow">MY LIBRARY</p><h2 data-library-title>계정으로 이어가기</h2><p data-library-detail>즐겨찾기와 다음에 할 일을 같은 SYNK ID로 이어가세요.</p><span class="continuity-status" data-library-status></span></div><div class="continuity-overview-actions"><span data-connect><button type="button" data-connect-button>계정 라이브러리 연결</button></span><button type="button" data-resume hidden>이어서 열기</button><button type="button" data-panel-toggle hidden aria-expanded="false" aria-controls="' + panelId + '">메모·계정 설정</button></div></header><div id="' + panelId + '" data-library-panel hidden><section data-notebook-mount hidden></section><section data-cloud-content hidden></section></div>';
  const mount = root.querySelector("[data-notebook-mount]"), content = root.querySelector("[data-cloud-content]"), panel = root.querySelector("[data-library-panel]"), toggle = root.querySelector("[data-panel-toggle]"), connect = root.querySelector("[data-connect-button]"), resumeButton = root.querySelector("[data-resume]");
  function verifyNativeConnection(event) {
    const target = event.target?.closest?.('button[data-notebook="signin"]'), identity = accountAdapter?.status();
    if (!native || disposed || !target || !nativeVerification && (identity?.signedIn || identity?.error?.retryable !== true)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (nativeVerification) return;
    const expected = modeVersion;
    message = "";
    target.disabled = true;
    target.setAttribute("aria-busy", "true");
    const task = (async () => {
      try {
        await accountAdapter.retryConnection();
        const verified = accountAdapter.status();
        const sameIdentity = Number.isSafeInteger(identity.sessionGeneration) && verified.sessionGeneration === identity.sessionGeneration && verified.accountId === identity.accountId;
        if (!disposed && (expected === modeVersion || sameIdentity) && !verified.signedIn && verified.error?.code === "SUITE_UNAVAILABLE") {
          message = "연결 복구로 재로그인이 필요하다는 안내라면 플랫폼 상단 계정 메뉴의 “새로 로그인”을 선택하세요. 기기 저장 문제라면 저장된 로그인을 유지하고 PC 저장공간·접근 권한을 확인한 뒤 재확인해 주세요.";
          nativeVerificationNotice = { text: message, accountId: verified.accountId, generation: verified.sessionGeneration };
        }
      } catch (error) {
        if (!disposed && expected === modeVersion) message = error.message || "계정 연결을 다시 확인하지 못했어요.";
      } finally {
        if (nativeVerification === task) nativeVerification = null;
        if (!disposed) {
          const button = mount.querySelector('button[data-notebook="signin"]'), latest = accountAdapter.status();
          button?.setAttribute("aria-busy", "false");
          if (button && !latest.signedIn && latest.error?.retryable === true) button.disabled = false;
          render();
        }
      }
    })();
    nativeVerification = task;
  }
  if (native) mount.addEventListener("click", verifyNativeConnection, true);
  const recovery = createLibraryRecovery({ getHost, getOwner: () => recoveryOwner, canUse: () => native && !pageSuspended && !disposed && !!notebook?.active && notebook.canEdit && doc.consent, getPayload: () => {
    capture();
    return { draft, editing, parkedDraft };
  }, onChange: () => render() });
  const entryIds = () => getAppIds().filter((id2) => ACTIVE_PLATFORM_APP_IDS.includes(id2));
  const displayIds = () => platformDisplayAppIds(entryIds());
  function expand(value) {
    panel.hidden = !value;
    toggle.setAttribute("aria-expanded", String(value));
    toggle.textContent = value ? "접어두기" : "메모·계정 설정";
  }
  function summary() {
    const available = !pageSuspended && !disposed && !!notebook?.active && notebook.canEdit && doc.consent;
    const note2 = available ? doc.notes.find((row) => !row.done && ACTIVE_PLATFORM_APP_IDS.includes(platformAppId(row.appId))) : null, recent = available ? projectPlatformLibrary(doc, { appIds: entryIds() }).recent[0] : null, hasDraft = available && (!!draft.title.trim() || !!parkedDraft?.title.trim());
    resumeId = note2?.appId || recent?.entryId || recent?.id || null;
    root.querySelector("[data-library-title]").textContent = hasDraft ? editing ? "수정 중인 메모가 있어요" : "작성 중인 메모가 있어요" : note2?.title || (recent ? "다시 " + names[recent.id] + "에서" : "계정으로 이어가기");
    root.querySelector("[data-library-detail]").textContent = message || (hasDraft ? "접어두어도 이 화면의 입력은 유지돼요." : note2 ? (names[note2.appId] || "이전 앱의 메모") + " · 남겨 둔 다음 할 일" : recent ? "최근 열었던 공간을 바로 열 수 있어요." : available ? "다음에 할 일을 남겨 두면 여기서 바로 이어갈 수 있어요." : "즐겨찾기와 다음에 할 일을 같은 SYNK ID로 이어가세요.");
    root.querySelector("[data-library-status]").textContent = connecting ? "연결 준비 중…" : hasDraft && notebook.status.status === "synced" && !notebook.status.error && !notebook.pending ? "메모는 아직 계정에 저장하지 않았어요" : mount.querySelector("[data-notebook-status]")?.textContent || "";
    resumeButton.hidden = !available || !resumeId && !hasDraft;
    resumeButton.textContent = hasDraft ? "계속 작성" : "이어서 열기";
    toggle.hidden = !notebook;
  }
  function capture() {
    const field = content.querySelector("[name=title]");
    if (field) draft = { appId: content.querySelector("[name=appId]").value, title: field.value };
  }
  function hasUnsavedDraft() {
    capture();
    return !!draft.title.trim() || !!parkedDraft?.title.trim();
  }
  function clearNoteSession() {
    editing = null;
    parkedDraft = null;
    deletedNotes = [];
    completedExpanded = false;
    noteQuery = "";
    noteFilter = "all";
  }
  function discardDraft() {
    capture();
    const previous = { draft: { ...draft }, editing, parkedDraft }, expected = modeVersion;
    clearNoteSession();
    draft.title = "";
    render({ captureDraft: false });
    return recovery.clear().then((cleared) => {
      if (!cleared && !disposed && modeVersion === expected && !draft.title.trim() && !parkedDraft?.title.trim()) {
        draft = previous.draft;
        editing = previous.editing;
        parkedDraft = previous.parkedDraft;
        render({ captureDraft: false });
      }
      return cleared;
    });
  }
  function focusDraft() {
    expand(true);
    content.querySelector("[name=title]")?.focus?.();
  }
  function editorOptions(selected) {
    let ids3 = displayIds();
    if (selected === "teacher" && entryIds().includes("teacher")) ids3 = ids3.filter((id2) => id2 !== "messenger").concat("teacher");
    if (editing?.appId === "partners") ids3 = ids3.concat("partners");
    return ids3.map((id2) => '<option value="' + id2 + '" ' + (selected === id2 ? "selected" : "") + ">" + names[id2] + "</option>").join("");
  }
  function favoriteSelected(id2) {
    return projectPlatformLibrary(doc, { appIds: entryIds() }).favorites.includes(id2);
  }
  function setEditorDraft(value) {
    draft = { ...value };
    const field = content.querySelector("[name=title]"), select = content.querySelector("[name=appId]");
    if (field) field.value = draft.title;
    if (select) {
      select.innerHTML = editorOptions(draft.appId);
      select.value = draft.appId;
    }
    recovery.schedule();
  }
  function finishEditing() {
    const next = parkedDraft || { appId: "world", title: "" };
    editing = null;
    parkedDraft = null;
    setEditorDraft(next);
  }
  function beginEditing(id2) {
    const row = doc.notes.find((note2) => note2.id === id2);
    if (!row || !notebook?.canEdit) return;
    capture();
    if (editing?.id === id2) {
      focusDraft();
      return;
    }
    if (editing && (draft.title !== editing.title || draft.appId !== editing.appId) && !globalThis.confirm("수정 중인 내용을 취소하고 다른 메모를 수정할까요?")) return;
    if (!editing) parkedDraft = { ...draft };
    editing = { ...row };
    setEditorDraft({ appId: row.appId, title: row.title });
    message = "";
    render();
    focusDraft();
  }
  function noteCard(row) {
    return '<article tabindex="-1" data-note-id="' + esc(row.id) + '"><strong>' + esc(row.title) + "</strong><p>" + (names[row.appId] || "이전 앱의 메모") + '</p><div class="continuity-note-actions">' + (ACTIVE_PLATFORM_APP_IDS.includes(platformAppId(row.appId)) ? '<button type="button" data-cloud="open" data-id="' + row.appId + '">이어가기</button>' : "") + '<button type="button" data-cloud="edit-note" data-id="' + esc(row.id) + '" aria-label="' + esc(row.title) + ' 수정">수정</button><button type="button" data-cloud="toggle-note" data-id="' + esc(row.id) + '" aria-pressed="' + row.done + '">' + (row.done ? "완료됨 · 다시 열기" : "완료 표시") + '</button><button type="button" data-cloud="remove-note" data-id="' + esc(row.id) + '" aria-label="' + esc(row.title) + ' 삭제">메모 삭제</button></div></article>';
  }
  function matchingNotes(query = "", filter = "all") {
    const terms = String(query).normalize("NFKC").toLocaleLowerCase("ko-KR").trim().split(/\s+/).filter(Boolean);
    return doc.notes.filter((row) => (filter === "all" || row.done === (filter === "done")) && terms.every((term) => (row.title + " " + (names[row.appId] || "이전 앱의 메모")).normalize("NFKC").toLocaleLowerCase("ko-KR").includes(term)));
  }
  function favoritesMarkup() {
    const favorites = projectPlatformLibrary(doc, { appIds: entryIds() }).favorites.filter((id) => displayIds().includes(id));
    return favorites.length > 1 ? '<h3>즐겨찾기 순서</h3><ol class="continuity-favorite-order">' + favorites.map((id, index) => "<li><span>" + names[id] + '</span><div><button type="button" data-cloud="favorite-up" data-id="' + id + '" aria-label="' + names[id] + ' 즐겨찾기 위로"' + (index === 0 ? " data-order-edge disabled" : "") + '>위로</button><button type="button" data-cloud="favorite-down" data-id="' + id + '" aria-label="' + names[id] + ' 즐겨찾기 아래로"' + (index === favorites.length - 1 ? " data-order-edge disabled" : "") + ">아래로</button></div></li>").join("") + "</ol>" : "";
  }
  function notesMarkup() {
    const matched = matchingNotes(noteQuery, noteFilter), pending = matched.filter((row) => !row.done), completed = matched.filter((row) => row.done);
    if (noteQuery.trim() || noteFilter !== "all") return '<section aria-label="메모 검색 결과"><h3>검색 결과 <span role="status">' + matched.length + "개</span></h3>" + (matched.length ? '<div class="continuity-note-grid">' + [...pending, ...completed].map(noteCard).join("") + "</div>" : '<p class="continuity-empty">조건에 맞는 메모가 없어요. 검색어나 상태를 바꿔 보세요.</p>') + "</section>";
    const emptyText = completed.length ? "남겨 둔 할 일을 모두 마쳤어요. 다음에 할 일을 메모로 남겨 보세요." : "아직 남겨 둔 할 일이 없어요. 다음에 할 일을 메모로 남겨 보세요.";
    return '<section aria-label="다음에 할 일"><h3>다음에 할 일 <span>' + pending.length + "개</span></h3>" + (pending.length ? '<div class="continuity-note-grid">' + pending.map(noteCard).join("") + "</div>" : '<p class="continuity-empty">' + emptyText + "</p>") + "</section>" + (completed.length ? '<section class="continuity-completed"><button type="button" data-cloud="show-completed" aria-expanded="' + completedExpanded + '" aria-controls="' + panelId + '-completed">완료한 메모 ' + completed.length + "개 " + (completedExpanded ? "접기" : "보기") + '</button><div id="' + panelId + '-completed" data-completed-notes class="continuity-note-grid" ' + (completedExpanded ? "" : "hidden") + ">" + completed.map(noteCard).join("") + "</div></section>" : "");
  }
  function recoveryControls() {
    const banner = content.querySelector("[data-note-recovery]");
    if (!banner) return;
    const state = recovery.state();
    banner.hidden = !state.candidate && !state.error;
    banner.querySelector("[data-recovery-detail]").textContent = state.error || "이 기기에 보관한 작성 중 메모가 있어요. 복구하면 내용을 확인한 뒤 계정에 저장할 수 있어요.";
    banner.querySelector('[data-cloud="recover-draft"]').hidden = !state.candidate;
    const discard = banner.querySelector('[data-cloud="discard-recovery"]');
    discard.hidden = !state.candidate && !state.removalFailed;
    discard.textContent = state.removalFailed ? "초안 삭제 다시 시도" : "보관한 초안 버리기";
  }
  function noteControls(editable) {
    const submit = content.querySelector("[data-note-submit]");
    if (!submit) return;
    const full = doc.notes.length >= PLATFORM_NOTE_LIMIT, last = deletedNotes.at(-1);
    content.querySelector("[data-editor-heading]").textContent = editing ? "메모 수정" : "새 메모";
    content.querySelector("[data-edit-detail]").hidden = !editing;
    content.querySelector("[data-edit-detail]").textContent = parkedDraft?.title.trim() ? "새로 작성하던 메모는 보관 중이에요. 수정을 마치거나 취소하면 돌아와요." : "수정을 취소하면 기존 메모가 그대로 남아요.";
    content.querySelector("[data-note-capacity]").textContent = "메모 " + doc.notes.length + "/" + PLATFORM_NOTE_LIMIT + "개 · " + (full ? "보관함이 가득 찼어요. 필요 없는 메모를 삭제하면 새로 남길 수 있어요." : PLATFORM_NOTE_LIMIT - doc.notes.length + "개 더 남길 수 있어요.");
    submit.textContent = editing ? "수정 저장" : "계정에 메모 남기기";
    submit.disabled = !editable || submitting || full && !editing;
    content.querySelector('[data-cloud="cancel-edit"]').hidden = !editing;
    const undo = content.querySelector("[data-note-undo]");
    undo.hidden = !last;
    content.querySelector("[data-note-undo-message]").textContent = last ? "“" + last.note.title + "” 메모를 삭제했어요. 이 화면에서 최근 삭제한 " + deletedNotes.length + "개를 되돌릴 수 있어요." : "";
    const undoButton = content.querySelector('[data-cloud="undo-note"]');
    undoButton.disabled = !editable || !last || full;
    content.querySelector("[data-note-undo-detail]").textContent = full ? "보관함이 가득 차 지금은 되돌릴 수 없어요. 다른 저장 기록을 불러오기 전까지 삭제한 메모를 보관해요." : "화면을 닫거나 계정을 바꾸거나 다른 저장 기록을 불러오면 되돌리기가 끝나요.";
  }
  let renderedNotes = "", renderedCatalog = "", renderedFavorites = "";
  function render({ captureDraft = true } = {}) {
    notifyReady();
    if (pageSuspended || disposed) return;
    if (captureDraft) capture();
    const active = !!notebook?.active, editable = !!notebook?.canEdit;
    if (initialExpansionPending && notebook && (editable && notebook.status.status === "synced" || notebook.status.error || ["error", "offline", "storage-error", "conflict", "local-conflict"].includes(notebook.status.status))) {
      initialExpansionPending = false;
      expand(!editable || !doc.consent);
    }
    const nextNotes = notesMarkup(), nextFavorites = favoritesMarkup(), catalog = displayIds().join(",");
    if (active && doc.consent && captureDraft && content.querySelector("[data-note-form]") && catalog === renderedCatalog) {
      content.querySelector("[data-cloud-message]").textContent = message;
      content.querySelector('[data-cloud="remember"]').checked = doc.rememberRecent;
      for (const button of content.querySelectorAll('[data-cloud="favorite"]')) {
        const selected = favoriteSelected(button.dataset.id);
        button.setAttribute("aria-pressed", String(selected));
        button.textContent = (selected ? "★ " : "☆ ") + names[button.dataset.id];
      }
      if (nextNotes !== renderedNotes) content.querySelector(".continuity-notes").innerHTML = nextNotes;
      if (nextFavorites !== renderedFavorites) content.querySelector("[data-favorite-order]").innerHTML = nextFavorites;
    } else {
      content.innerHTML = active ? '<h2>내 계정의 이어쓰기</h2><p role="status" data-cloud-message>' + esc(message) + "</p>" + (!doc.consent ? '<p>계정 연결을 켜면 지금부터 선택한 즐겨찾기와 최근 열기를 계정에 저장해요. 기존 기기 목록은 위의 옮기기 버튼으로 직접 가져올 수 있어요.</p><button data-cloud="enable">계정 저장 켜기</button>' : '<label><input type="checkbox" data-cloud="remember" ' + (doc.rememberRecent ? "checked" : "") + '> 최근 열기 시각도 계정에 보관</label><div class="continuity-apps">' + displayIds().map((id2) => '<button type="button" data-cloud="favorite" data-id="' + id2 + '" aria-pressed="' + favoriteSelected(id2) + '">' + (favoriteSelected(id2) ? "★ " : "☆ ") + names[id2] + "</button>").join("") + "</div><section data-favorite-order>" + nextFavorites + '</section><section data-note-recovery class="continuity-undo" hidden><p data-recovery-detail role="status"></p><button type="button" data-cloud="recover-draft">초안 복구</button><button type="button" data-cloud="discard-recovery">보관한 초안 버리기</button></section><form data-note-form><h3 data-editor-heading>새 메모</h3><p data-edit-detail hidden></p><p id="' + panelId + '-capacity" data-note-capacity role="status"></p><label>이어 쓸 공간<select name="appId">' + editorOptions(draft.appId) + '</select></label><label>다음에 할 일<input name="title" maxlength="240" required aria-describedby="' + panelId + '-capacity" value="' + esc(draft.title) + '" placeholder="예: 다음 학습에서 확인할 내용 정리하기"></label><button type="submit" data-note-submit>계정에 메모 남기기</button><button type="button" data-cloud="cancel-edit" hidden>수정 취소</button></form><div class="continuity-undo" data-note-undo hidden><p role="status" data-note-undo-message></p><button type="button" data-cloud="undo-note">삭제 되돌리기</button><p data-note-undo-detail></p></div><div class="continuity-note-tools"><label>메모 검색<input type="search" data-note-search placeholder="메모 내용이나 공간 이름" aria-label="메모 검색"></label><label>메모 상태<select data-note-filter><option value="all">모두</option><option value="pending">미완료</option><option value="done">완료</option></select></label></div><div class="continuity-notes">' + nextNotes + "</div><p>최근 열기는 실제 작업 완료나 학습 성과를 뜻하지 않아요.</p>") : "<p>계정에 로그인한 뒤 라이브러리를 연결할 수 있어요. 기기의 바로가기는 그대로 유지됩니다.</p>";
    }
    renderedNotes = nextNotes;
    renderedCatalog = catalog;
    renderedFavorites = nextFavorites;
    for (const el of content.querySelectorAll("button,input,select")) el.disabled = !editable;
    for (const el of content.querySelectorAll("[data-order-edge]")) el.disabled = true;
    const search = content.querySelector("[data-note-search]"), filter = content.querySelector("[data-note-filter]");
    if (search) search.value = noteQuery;
    if (filter) filter.value = noteFilter;
    noteControls(editable);
    recoveryControls();
    summary();
    onChange();
    void recovery.refresh();
  }
  async function change(action) {
    if (!notebook?.canEdit) throw new Error("계정 연결과 저장 상태를 먼저 확인해 주세요.");
    const expected = modeVersion, next = updatePlatformLibrary(doc, action, Date.now(), entryIds());
    const favoriteChange = ["favorite", "move-favorite"].includes(action.type) && favoriteSignature(next) !== favoriteSignature(doc) ? { version: expected, owner: documentOwner, signature: favoriteSignature(next) } : null;
    if (favoriteChange) favoriteIntent = favoriteChange;
    doc = next;
    message = "";
    const result = notebook.change(next);
    render();
    if (!await result) {
      if (favoriteIntent === favoriteChange) favoriteIntent = null;
      if (expected !== modeVersion) return false;
      throw new Error("변경을 보관하지 못했어요. 저장 상태를 확인해 주세요.");
    }
    return true;
  }
  async function connectLibrary() {
    if (notebook || connecting || disposed) return;
    connecting = true;
    message = "";
    connect.disabled = true;
    connect.setAttribute("aria-busy", "true");
    connect.textContent = "연결 준비 중…";
    summary();
    try {
      await ensureReady();
      if (disposed) return;
      if (pageSuspended) {
        connectOnResume = true;
        return;
      }
      const host = getHost();
      if (!host || !native && !host.identity()?.configured) throw new Error("계정 연결 설정을 불러오지 못했어요. 다시 연결을 눌러 주세요.");
      const device = getDevice(), favorites = (device.favorites || []).filter((id2) => PLATFORM_APP_IDS.includes(id2));
      doc = validatePlatformLibrary({ ...emptyPlatformLibrary(), consent: true, favorites: [...new Set(favorites)], recent: (device.recent || []).filter((row) => PLATFORM_APP_IDS.includes(row.id)), rememberRecent: device.rememberRecent !== false });
      mount.hidden = false;
      content.hidden = false;
      root.querySelector("[data-connect]").hidden = true;
      initialExpansionPending = true;
      notebook = createAccountNotebook({
        resource: "platform-library",
        validateState: validatePlatformLibraryState,
        preferRemoteOnOpen: true,
        mount,
        content,
        description: "즐겨찾기·최근 열기·직접 적은 메모만 연결합니다. 앱 원문과 이용 권한은 각 앱에서 확인해요.",
        getState: () => doc,
        applyState: (value, { guest = false } = {}) => {
          favoriteIntent = null;
          doc = validatePlatformLibrary(value);
          documentReady = !guest;
          clearNoteSession();
          draft = { appId: "world", title: "" };
          render({ captureDraft: false });
        },
        emptyDocument: emptyPlatformLibrary,
        storage,
        signOutLabel: native ? "로그아웃" : "계정 관리로 이동",
        deleteLabel: "계정 라이브러리 삭제·저장 끄기",
        deleteConfirmation: "이 계정의 즐겨찾기·최근 열기·이어쓰기 메모를 삭제하고 저장을 끌까요? 다른 기기에서도 이 목록을 다시 불러올 수 없어요. 각 앱의 원본 기록은 유지돼요.",
        onStatusChange: () => queueMicrotask(render),
        // change() only queues the edit. Observe the validated server ACK, and
        // only the latest still-visible choice in the same account generation.
        onDocumentSaved: (value) => {
          const intent = favoriteIntent;
          if (!intent || disposed || pageSuspended || intent.version !== modeVersion || intent.owner !== documentOwner || favoriteSignature(value) !== intent.signature || favoriteSignature(doc) !== intent.signature) return;
          favoriteIntent = null;
          void Promise.resolve().then(() => {
            if (!disposed && !pageSuspended && intent.version === modeVersion && intent.owner === documentOwner) return onFavoritesChanged();
          }).catch(() => {
          });
        },
        onDocumentRemoved: () => {
          favoriteIntent = null;
          void recovery.clear();
        },
        beforeNavigate: () => {
          if (!hasUnsavedDraft()) return true;
          if (!globalThis.confirm("작성 중인 이어쓰기 메모를 닫을까요?")) return false;
          discardDraft();
          return true;
        },
        accountFactory: (options) => accountAdapter = platformLibraryAccount({ host, native, onLogin, onManage, onStatus: (value) => {
          if (nativeVerificationNotice && (value.signedIn || value.error?.code !== "SUITE_UNAVAILABLE" || value.accountId !== nativeVerificationNotice.accountId || value.sessionGeneration !== nativeVerificationNotice.generation)) {
            if (message === nativeVerificationNotice.text) message = "";
            nativeVerificationNotice = null;
          }
          const nextOwner = value.signedIn ? value.accountId : null;
          if (nextOwner !== documentOwner && (nextOwner || !["restoring", "signing-in", "error"].includes(value.status))) {
            documentOwner = nextOwner;
            documentReady = false;
          }
          if (recoveryOwner !== nextOwner) {
            recoveryOwner = nextOwner;
            recovery.reset();
          }
          modeVersion++;
          options.onStatus(value);
          queueMicrotask(render);
        } }),
        onMode: () => queueMicrotask(render)
      });
      await notebook.start();
      if (!notebook.active) {
        initialExpansionPending = false;
        expand(true);
      }
      render();
    } catch (error) {
      if (!disposed) {
        message = error.message || "계정 연결을 마치지 못했어요. 다시 연결해 주세요.";
        summary();
      }
    } finally {
      connecting = false;
      notifyReady();
      if (!disposed) {
        connect.disabled = false;
        connect.setAttribute("aria-busy", "false");
        connect.textContent = "계정 라이브러리 연결";
        summary();
      }
    }
  }
  connect.onclick = connectLibrary;
  toggle.onclick = () => {
    capture();
    initialExpansionPending = false;
    expand(panel.hidden);
    summary();
  };
  resumeButton.onclick = () => {
    capture();
    if (draft.title.trim() || parkedDraft?.title.trim()) {
      focusDraft();
      return;
    }
    if (resumeId) onOpen(platformAppId(resumeId));
  };
  content.addEventListener("input", (event) => {
    if (event.target.matches("[data-note-search]")) {
      if (event.isComposing) return;
      noteQuery = event.target.value;
      render();
      return;
    }
    capture();
    summary();
    recovery.schedule();
  });
  content.addEventListener("compositionend", (event) => {
    if (event.target.matches("[data-note-search]")) {
      noteQuery = event.target.value;
      render();
    }
  });
  content.addEventListener("change", (event) => {
    if (event.target.matches("[data-note-filter]")) {
      noteFilter = ["all", "pending", "done"].includes(event.target.value) ? event.target.value : "all";
      render();
      return;
    }
    if (event.target.matches("[name=appId]")) {
      capture();
      recovery.schedule();
    }
    if (event.target.dataset.cloud === "remember") void change({ type: "remember", value: event.target.checked }).catch((error) => {
      message = error.message;
      render();
    });
  });
  content.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-cloud]");
    if (!button || button.disabled) return;
    const action = button.dataset.cloud, id2 = button.dataset.id;
    if (action === "open") {
      if (hasUnsavedDraft() && !globalThis.confirm("작성 중인 이어쓰기 메모를 닫고 이동할까요?")) return;
      onOpen(platformAppId(id2));
      return;
    }
    if (!notebook?.canEdit) return;
    if (action === "recover-draft") {
      if (hasUnsavedDraft() && !globalThis.confirm("현재 작성 중인 내용을 닫고 기기에 보관한 초안을 열까요?")) return;
      const saved = recovery.take();
      if (!saved) return;
      const original = saved.editing && doc.notes.find((row) => row.id === saved.editing.id);
      editing = original && original.title === saved.editing.title && original.appId === saved.editing.appId ? { ...original } : null;
      parkedDraft = saved.parkedDraft;
      setEditorDraft(saved.draft);
      message = saved.editing && !editing ? "원래 메모가 바뀌어 복구한 내용을 새 메모로 열었어요. 확인한 뒤 저장해 주세요." : "작성 중이던 메모를 복구했어요. 확인한 뒤 계정에 저장해 주세요.";
      render();
      focusDraft();
      void recovery.persist();
      return;
    }
    if (action === "discard-recovery") {
      void recovery.discard();
      return;
    }
    if (action === "show-completed") {
      completedExpanded = !completedExpanded;
      render();
      content.querySelector('[data-cloud="show-completed"]')?.focus?.();
      return;
    }
    if (action === "edit-note") {
      beginEditing(id2);
      return;
    }
    if (action === "cancel-edit") {
      finishEditing();
      message = "";
      render();
      focusDraft();
      return;
    }
    let operation;
    if (action === "remove-note") {
      const index = doc.notes.findIndex((row) => row.id === id2);
      if (index < 0) return;
      if (editing?.id === id2) {
        capture();
        if ((draft.title !== editing.title || draft.appId !== editing.appId) && !globalThis.confirm("수정 중인 내용을 취소하고 이 메모를 삭제할까요?")) return;
        finishEditing();
      }
      const entry = { note: structuredClone(doc.notes[index]), index };
      operation = change({ type: action, noteId: id2 });
      if (!doc.notes.some((row) => row.id === id2)) {
        deletedNotes.push(entry);
        deletedNotes = deletedNotes.slice(-PLATFORM_NOTE_LIMIT);
        render();
        content.querySelector('[data-cloud="undo-note"]')?.focus?.();
      }
    } else if (action === "undo-note") {
      const entry = deletedNotes.at(-1);
      if (!entry) return;
      operation = change({ type: "restore-note", note: entry.note, index: Math.min(entry.index, doc.notes.length) });
      if (doc.notes.some((row) => row.id === entry.note.id)) {
        deletedNotes.pop();
        if (entry.note.done) completedExpanded = true;
        render();
      }
    } else if (action === "favorite-up" || action === "favorite-down") {
      operation = change({ type: "move-favorite", id: id2, direction: action === "favorite-up" ? -1 : 1 });
      const focus = content.querySelector('[data-cloud="' + action + '"][data-id="' + id2 + '"]');
      if (focus?.disabled) content.querySelector('[data-cloud="' + (action === "favorite-up" ? "favorite-down" : "favorite-up") + '"][data-id="' + id2 + '"]')?.focus?.();
      else focus?.focus?.();
    } else operation = change(action === "enable" ? { type: "consent", value: true } : action === "favorite" ? { type: "favorite", id: id2 } : { type: action, noteId: id2 });
    const expected = modeVersion;
    void operation.catch((error) => {
      if (expected !== modeVersion || disposed) return;
      message = error.message;
      render();
    });
  });
  content.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-note-form]")) return;
    event.preventDefault();
    if (submitting || !notebook?.canEdit) return;
    capture();
    const expected = modeVersion;
    submitting = true;
    void change(editing ? { type: "edit-note", noteId: editing.id, id: draft.appId, title: draft.title } : { type: "note", id: draft.appId, title: draft.title }).then(() => {
      if (expected !== modeVersion || disposed) return;
      if (editing) finishEditing();
      else {
        const next = parkedDraft || { ...draft, title: "" };
        parkedDraft = null;
        setEditorDraft(next);
      }
      render();
    }).catch((error) => {
      if (expected !== modeVersion || disposed) return;
      message = error.message;
      render();
    }).finally(() => {
      submitting = false;
      if (!disposed) render();
    });
  });
  const suspend = () => {
    capture();
    void recovery.persist();
    pageSuspended = true;
    notifyReady();
    notebook?.suspend();
    summary();
  }, resume = () => {
    pageSuspended = false;
    notebook?.resume();
    render();
    if (connectOnResume) {
      connectOnResume = false;
      void connectLibrary();
    }
  };
  const beforeUnload = (event) => {
    void recovery.persist();
    if (hasUnsavedDraft()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  globalThis.addEventListener("pagehide", suspend);
  globalThis.addEventListener("pageshow", resume);
  globalThis.addEventListener("beforeunload", beforeUnload);
  return {
    connect: connectLibrary,
    ready,
    connected: () => !!notebook?.active && doc.consent,
    projection() {
      return notebook?.active && notebook.canEdit && doc.consent ? projectPlatformLibrary(doc, { appIds: entryIds() }) : null;
    },
    async dispatch(action) {
      if (!notebook?.active || !doc.consent) return false;
      return change(action);
    },
    hasPending: () => !!notebook?.pending,
    hasUnsavedDraft,
    discardDraft,
    flushDraft: () => recovery.persist(),
    focusDraft,
    searchNotes(query = "", { limit = 8 } = {}) {
      if (pageSuspended || disposed || !notebook?.active || !notebook.canEdit || !doc.consent) return [];
      return matchingNotes(query).sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt).slice(0, Math.max(0, Math.min(60, Number.isInteger(limit) ? limit : 8))).map((row) => ({ ...row }));
    },
    openNote(id) {
      if (pageSuspended || disposed || !notebook?.active || !notebook.canEdit || !doc.consent || !doc.notes.some((row) => row.id === id)) return false;
      noteQuery = "";
      noteFilter = "all";
      if (doc.notes.find((row) => row.id === id).done) completedExpanded = true;
      expand(true);
      render();
      const card = content.querySelector('[data-note-id="' + id + '"]');
      card?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
      card?.focus?.({ preventScroll: true });
      return true;
    },
    dispose() {
      disposed = true;
      notifyReady();
      if (native) mount.removeEventListener?.("click", verifyNativeConnection, true);
      recovery.dispose();
      notebook?.dispose();
      globalThis.removeEventListener("pagehide", suspend);
      globalThis.removeEventListener("pageshow", resume);
      globalThis.removeEventListener("beforeunload", beforeUnload);
    },
    render
  };
}
export {
  mountPlatformLibrary
};
