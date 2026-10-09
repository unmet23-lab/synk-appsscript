var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// experiences/synk-account/src/platform-entry.mjs
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
      const text4 = storage.getItem(key);
      if (text4) {
        try {
          if (text4.length > 1024) throw mismatch();
          intent = JSON.parse(text4);
        } catch {
          throw mismatch();
        }
        if (intent?.version !== 1 || !validId(intent.accountId) && !(intent.cancelled === true && intent.accountId === void 0) || typeof intent.attempted !== "boolean" || intent.cancelled !== void 0 && typeof intent.cancelled !== "boolean") throw mismatch();
        cancelled ||= intent.cancelled === true;
      }
      restored = true;
    },
    accountId: () => intent?.accountId || null,
    assertAccount(id2) {
      if (intent?.accountId && id2 !== intent.accountId) throw mismatch();
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
var PARAM, CANCEL, validId, mismatch, PUBLIC;
var init_platform_entry = __esm({
  "experiences/synk-account/src/platform-entry.mjs"() {
    PARAM = "synk-platform-account";
    CANCEL = "synk-platform-cancelled";
    validId = (value) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
    mismatch = () => Object.assign(new Error("플랫폼에서 선택한 SYNK ID와 로그인 계정이 달라요. 플랫폼 계정을 확인한 뒤 다시 열어 주세요."), { code: "PLATFORM_ACCOUNT_MISMATCH" });
    PUBLIC = Object.freeze({ world: "https://synk.im/account/client.html?product=world&play=learning-hub", care: "https://synk.im/care/", fortune: "https://synk.im/fortune/", rehearsal: "https://synk.im/rehearsal/" });
  }
});

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
async function tokenRequest(config, fields2, fetcher = fetch) {
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12e3);
  try {
    let response;
    try {
      response = await fetcher(new URL("/auth/v1/oauth/token", config.supabaseUrl), {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields2),
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
  if (!scopes.includes("openid") || new Set(scopes).size !== scopes.length || scopes.some((scope3) => !["openid", "email", "profile"].includes(scope3)))
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
    PRODUCTS = Object.freeze({ platform: "SYNK 플랫폼", world: "SYNK WORLD", messenger: "SYNK Workspace", care: "SYNK 플레저", path: "SYNK PATH", "path-travel": "SYNK PATH 여행", rehearsal: "중요한 대화 리허설", "family-album": "가족 이야기 앨범" });
    nativeSchemes = /* @__PURE__ */ new Set(["synktalk:", "im.synk.platform:", "im.synk.world:", "im.synk.messenger:", "im.synk.care:"]);
    isLoopback = (hostname) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
    base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
});

// experiences/path-vr/model.mjs
function validateState(value) {
  if (!value || Object.keys(value).some((k) => !["version", "consent", "prefsConfirmed", "prefs", "zone", "cursor", "answers"].includes(k)) || value.version !== 1 || value.consent !== true || typeof value.prefsConfirmed !== "boolean" || !validPrefs(value.prefs) || !ZONES.some((z) => z.id === value.zone) || !Array.isArray(value.answers) || value.answers.length > 60) throw Error("invalid progress");
  const c = value.cursor;
  if (!c || Object.keys(c).length !== 4 || ![0, 1].includes(c.step) || ![null, 0, 1, 2].includes(c.choice) || typeof c.helped !== "boolean" || typeof c.showResults !== "boolean" || c.showResults && (c.step !== 1 || c.choice === null)) throw Error("invalid cursor");
  for (const a of value.answers) {
    const z = ZONES.find((z2) => z2.id === a.zone);
    if (!z || Object.keys(a).length !== 5 || !Number.isInteger(a.step) || !z.steps[a.step] || !Number.isInteger(a.choice) || !z.steps[a.step].choices[a.choice] || typeof a.helped !== "boolean" || typeof a.at !== "string" || !Number.isFinite(Date.parse(a.at))) throw Error("invalid answer");
  }
  return structuredClone(value);
}
var SCOPE, ZONES, DEFAULT_PREFS, validPrefs;
var init_model = __esm({
  "experiences/path-vr/model.mjs"() {
    SCOPE = Object.freeze({ personId: "local-visitor", productId: "path", contextId: "campus-rehearsal", domain: "PATH" });
    ZONES = Object.freeze([
      {
        id: "welcome",
        label: "안내 데스크",
        short: "도착",
        subtitle: "모르는 장소를 확인하기",
        minutes: 3,
        color: 14858851,
        goals: ["prepare", "study"],
        pace: "short",
        position: [-6, 0, 0],
        steps: [
          { prompt: "첫 수업을 찾고 있어요. 안내문에는 “첫 만남 · 2층 204호 · 오후 2시”라고 적혀 있어요. 먼저 무엇을 확인할까요?", hint: "장소와 시간을 함께 확인하면 이동 전에 혼란을 줄일 수 있어요.", choices: ["“204호가 어디인가요? 오후 2시 수업이 맞나요?”", "“수업이 있나요?”", "아무 교실에 들어가서 기다린다"], best: 0, check: "교실 위치와 시작 시간을 함께 확인했어요.", retry: "다음에는 장소와 시간을 함께 넣어 질문해 보세요." },
          { prompt: "직원이 “계단 옆 엘리베이터로 2층에 가세요”라고 말했어요. 아직 길이 헷갈려요.", hint: "이해하지 못한 부분을 구체적으로 다시 물어도 괜찮아요.", choices: ["아는 척하고 출발한다", "“계단 옆 엘리베이터가 저쪽인가요?”", "수업을 포기한다"], best: 1, check: "확실하지 않은 방향을 다시 확인했어요.", retry: "헷갈리는 방향을 한 번 더 확인하는 연습이 필요해요." }
        ]
      },
      {
        id: "seminar",
        label: "수업 준비실",
        short: "수업",
        subtitle: "도움을 요청하고 일정 정하기",
        minutes: 6,
        color: 9285536,
        goals: ["study", "clarity"],
        pace: "standard",
        position: [0, 0, -6],
        steps: [
          { prompt: "첫 모임에서 자기소개를 부탁받았어요. 지금 연습에 알맞은 시작을 골라 보세요.", hint: "이름은 가명을 써도 돼요. 관심 있는 것과 배우고 싶은 것을 간단히 연결해 보세요.", choices: ["개인 연락처부터 모두 말한다", "“저는 가온이에요. 한국 문화를 배우고 싶어요.”", "아무 말 없이 자리를 떠난다"], best: 1, check: "공개해도 되는 소개와 학습 목적을 연결했어요.", retry: "가명과 배우고 싶은 것 한 가지로 소개를 시작해 보세요." },
          { prompt: "모임 준비물은 “노트 한 권”, 다음 모임은 “목요일 오전 10시”예요. 친구에게 어떻게 확인할까요?", hint: "준비물·요일·시간 중 빠진 것이 없는지 확인해 보세요.", choices: ["“다음에 보면 되죠?”", "“준비물이 많이 필요하죠?”", "“목요일 오전 10시에 노트 한 권을 가져오면 되나요?”"], best: 2, check: "다음 일정과 준비물을 구체적으로 확인했어요.", retry: "요일·시간·준비물을 함께 확인하는 문장을 연습해 보세요." }
        ]
      },
      {
        id: "career",
        label: "진로 상담실",
        short: "진로",
        subtitle: "막연한 관심을 질문으로 바꾸기",
        minutes: 6,
        color: 7705798,
        goals: ["work", "prepare"],
        pace: "standard",
        position: [6, 0, 0],
        steps: [
          { prompt: "가상의 진로 상담이에요. 아직 하고 싶은 일이 분명하지 않아요. 어떤 말로 시작할까요?", hint: "모른다는 사실도 출발점이에요. 해 보고 싶은 활동을 하나 말해 보세요.", choices: ["“사람을 돕는 활동을 좋아해요. 어떤 경험부터 해 보면 좋을까요?”", "“무조건 취업시켜 주세요.”", "준비되지 않았으니 질문하지 않는다"], best: 0, check: "관심 있는 활동을 구체적인 상담 질문으로 바꿨어요.", retry: "관심 있는 활동 하나와 궁금한 점 하나를 연결해 보세요." },
          { prompt: "상담사가 다음 만남 전 “관심 직무 하나를 골라 필요한 경험을 찾아보자”고 제안했어요. 어떤 다음 행동이 좋을까요?", hint: "지금 할 수 있는 작은 행동과 확인할 대상을 정해 보세요.", choices: ["정보를 확인하지 않고 지원한다", "“관심 직무의 실제 채용 공고 하나를 찾아 필요한 경험을 적어 올게요.”", "모든 직업을 한 번에 조사한다"], best: 1, check: "실제 자료를 확인하는 작은 다음 행동을 정했어요.", retry: "확인할 자료 하나와 적어 볼 항목을 정해 보세요." }
        ]
      }
    ]);
    DEFAULT_PREFS = Object.freeze({ goal: "study", minutes: 6, support: "step" });
    validPrefs = (p) => p && Object.keys(p).length === 3 && ["study", "work", "prepare"].includes(p.goal) && [3, 6, 12].includes(p.minutes) && ["step", "independent"].includes(p.support);
  }
});

// experiences/conversation-rehearsal/domain.mjs
function validPractice(scenario, practice) {
  return practice && typeof practice === "object" && !Array.isArray(practice) && Object.keys(practice).length === 2 && Object.keys(practice).every((key) => ["counterpart", "goal"].includes(key)) && Object.hasOwn(PRACTICES[scenario].counterparts, practice.counterpart) && Object.hasOwn(PRACTICES[scenario].goals, practice.goal);
}
function validateArchive(value) {
  const invalid3 = () => {
    throw new TypeError("리허설 기록 형식이 올바르지 않아요. 이 앱에서 내보낸 JSON 파일을 선택해 주세요.");
  };
  if (!keys(value, ["schema", "savedAt", "sessions"]) || value.schema !== SCHEMA || !bounded(value.savedAt, 40, false) || !Number.isFinite(Date.parse(value.savedAt)) || !Array.isArray(value.sessions) || value.sessions.length > MAX_SESSIONS) invalid3();
  const ids3 = /* @__PURE__ */ new Set();
  for (const s of value.sessions) {
    if (!keys(s, ["id", "at", "scenario", "counterpart", "goal", "practice", "focus", "turns", "firstSentence", "takeaway"]) || !bounded(s.id, 80, false) || ids3.has(s.id) || !bounded(s.at, 40, false) || !Number.isFinite(Date.parse(s.at)) || !Object.hasOwn(SCENARIOS, s.scenario) || !Object.hasOwn(DIRECTIONS, s.focus) || !bounded(s.counterpart, 80, false) || !bounded(s.goal, 240, false) || !bounded(s.firstSentence, 600) || !bounded(s.takeaway, 600) || !Array.isArray(s.turns) || s.turns.length !== 3 || Object.hasOwn(s, "practice") && !validPractice(s.scenario, s.practice)) invalid3();
    ids3.add(s.id);
    for (const [index, turn] of s.turns.entries()) {
      const expected = index === 0 ? "opening" : index === 1 ? s.focus : "close";
      if (!keys(turn, ["id", "answer", "review", "retry", "retryReview"]) || turn.id !== expected || !bounded(turn.answer, 2e3, false) || !Object.hasOwn(REVIEWS, turn.review) || !bounded(turn.retry, 2e3) || (turn.retry ? !Object.hasOwn(REVIEWS, turn.retryReview) : turn.retryReview !== null)) invalid3();
    }
  }
  return JSON.parse(JSON.stringify(value));
}
var SCHEMA, MAX_SESSIONS, MAX_IMPORT_BYTES, REVIEWS, SCENARIOS, DIRECTIONS, PRACTICES, record, keys, safeCharacters, bounded;
var init_domain = __esm({
  "experiences/conversation-rehearsal/domain.mjs"() {
    SCHEMA = 1;
    MAX_SESSIONS = 10;
    MAX_IMPORT_BYTES = 5e5;
    REVIEWS = Object.freeze({ easy: "말할 수 있었어요", unsure: "조금 망설였어요", stuck: "말이 막혔어요" });
    SCENARIOS = Object.freeze({
      interview: {
        name: "면접에서 나를 소개할 때",
        short: "면접",
        note: "내 경험을 근거로, 짧고 분명하게.",
        counterpart: "면접관",
        goal: "내 경험이 이 역할에 어떻게 도움이 되는지 전하기",
        opening: "이 역할에 지원한 이유를 들려주시겠어요?",
        turns: {
          opening: { title: "첫 인상보다, 첫 문장", prompt: "이 역할에 지원한 이유를 들려주시겠어요?", hint: "관심 있는 일 한 가지와 연결되는 내 경험 한 가지를 적어 보세요." },
          specific: { title: "경험을 하나만 꺼내기", prompt: "그 경험에서 본인이 직접 한 일은 무엇이었나요?", hint: "상황 → 내가 한 행동 → 실제로 일어난 결과. 없는 성과를 만들 필요는 없어요." },
          concise: { title: "핵심부터 말하기", prompt: "시간이 많지 않아서요. 가장 전하고 싶은 내용을 두 문장으로 정리해 주시겠어요?", hint: "먼저 결론 한 문장. 그다음 그 결론을 뒷받침하는 실제 경험 한 문장." },
          pressure: { title: "예상 밖의 질문", prompt: "그 경험이 우리 팀의 일에도 도움이 된다고 생각하는 이유는 무엇인가요?", hint: "상대의 상황을 모르면, 먼저 확인하고 싶은 점을 질문해도 좋아요." },
          close: { title: "대화를 이어 갈 한마디", prompt: "마지막으로 저희에게 물어보고 싶은 것이 있나요?", hint: "역할에 관해 정말 알고 싶은 점 한 가지로 마무리해 보세요." }
        },
        starter: "제가 이 역할에 관심을 가진 이유는…",
        check: "실제로 내가 한 행동을 한 가지 말했나요?"
      },
      request: {
        name: "부탁을 꺼내야 할 때",
        short: "부탁",
        note: "필요한 도움과 가능한 범위를 함께.",
        counterpart: "함께 일하는 동료",
        goal: "상대의 상황을 확인하며 필요한 도움을 구하기",
        turns: {
          opening: { title: "조심스럽게 시작하기", prompt: "무슨 일이에요? 지금 잠깐 이야기할 수 있어요.", hint: "대화를 나눌 수 있는지 확인하고, 부탁하고 싶은 일을 한 가지로 말해 보세요." },
          specific: { title: "부탁의 크기를 분명하게", prompt: "제가 정확히 무엇을, 언제까지 도와드리면 될까요?", hint: "필요한 작업과 기한을 나누어 적고, 조정 가능한 부분도 말해 보세요." },
          concise: { title: "짧게 핵심 전하기", prompt: "지금은 시간이 별로 없어요. 필요한 것부터 짧게 말해 줄래요?", hint: "“○○를 부탁드리고 싶어요. ○○까지 가능하실까요?”처럼 시작할 수 있어요." },
          pressure: { title: "부담스럽다는 말에 답하기", prompt: "저도 일정이 꽉 차 있어서 전부 도와드리기는 어려울 것 같아요.", hint: "상대의 상황을 인정하고, 부탁을 줄이거나 다른 시점을 제안해 보세요." },
          close: { title: "서로 같은 뜻인지 확인하기", prompt: "그럼 제가 가능한 범위에서 해 볼게요. 어떻게 진행하면 좋을까요?", hint: "합의한 범위와 다음 확인 시점을 정리해 보세요. 아직 합의되지 않은 일은 묻는 표현으로요." }
        },
        starter: "잠깐 이야기 나눌 수 있을까요? 부탁드리고 싶은 일이 있어요.",
        check: "무엇을 언제까지 부탁하는지, 조정 가능한 범위를 말했나요?"
      },
      refusal: {
        name: "관계를 지키며 거절할 때",
        short: "거절",
        note: "미안함에 묻히지 않게, 내 범위까지.",
        counterpart: "가까운 지인",
        goal: "할 수 없는 범위를 분명히 전하면서 관계를 존중하기",
        turns: {
          opening: { title: "내 범위를 말하는 시작", prompt: "이번에도 부탁 좀 해도 될까요? 꼭 해 줬으면 좋겠어요.", hint: "상대의 마음을 짧게 받아 준 뒤, 내가 할 수 없는 부분을 분명하게 말해 보세요." },
          specific: { title: "이유와 범위를 나누기", prompt: "어떤 부분이 어려운 건지 알려 줄 수 있어요?", hint: "공유하고 싶은 만큼만 이유를 말해도 괜찮아요. 할 수 있는 범위가 있다면 따로 말해 보세요." },
          concise: { title: "짧고 분명한 거절", prompt: "그래서, 이번에는 가능하다는 건가요? 어렵다는 건가요?", hint: "결정을 한 문장으로 먼저 말하고, 필요하면 설명을 덧붙이세요." },
          pressure: { title: "한 번 더 부탁할 때", prompt: "딱 이번 한 번만 안 될까요? 다른 부탁은 안 할게요.", hint: "새로운 이유를 계속 만들기보다, 결정한 범위를 차분하게 반복해 보세요." },
          close: { title: "관계를 남기는 마무리", prompt: "알겠어요. 조금 아쉽기는 하네요.", hint: "아쉬움을 인정하면서 마무리해 보세요. 할 수 없는 대안을 약속하지 않아도 괜찮아요." }
        },
        starter: "부탁한 마음은 이해해요. 다만 이번에는 제가…",
        check: "내가 할 수 없는 범위를 모호하지 않게 말했나요?"
      }
    });
    DIRECTIONS = Object.freeze({ specific: "내용을 구체적으로", concise: "짧고 분명하게", pressure: "부담스러운 반응에 답하기" });
    PRACTICES = Object.freeze({
      interview: {
        counterparts: {
          recruiter: { label: "채용 담당자", opening: "지원 내용을 함께 살펴볼게요.", pressure: "채용 기준에 맞는지 확인하고 싶어요.", hint: "직무 용어만 나열하지 말고, 처음 듣는 사람도 이해할 수 있게 설명해 보세요." },
          lead: { label: "실무 팀장", opening: "함께 일할 장면을 생각하며 여쭤볼게요.", pressure: "우리 팀은 바로 함께 일할 사람을 찾고 있어요.", hint: "내가 맡은 일과 함께 일한 사람의 일을 구분해 보세요." }
        },
        goals: {
          experience: { label: "경험으로 강점 전하기", goal: "내가 직접 한 일과 그 경험의 쓰임을 전하기", starter: "제가 직접 맡았던 일은…", check: "내 행동과 실제 결과를 구분하고, 지원 역할과 연결했나요?", turns: {
            opening: { title: "내가 한 일로 시작하기", prompt: "이 역할과 연결되는 경험을 하나 소개해 주시겠어요?", hint: "상황 한 문장 뒤에 내가 직접 한 일을 붙여 보세요." },
            specific: { title: "내 행동과 결과 나누기", prompt: "그때 본인이 선택한 방법과 실제로 달라진 점은 무엇인가요?", hint: "내 선택 → 행동 → 확인한 결과를 적으세요. 수치가 없으면 관찰한 변화를 말해도 좋아요." },
            concise: { title: "경험을 두 문장으로", prompt: "그 경험에서 드러난 강점을 두 문장으로 들려주시겠어요?", hint: "강점 한 문장, 그 근거가 되는 내 행동 한 문장으로 줄여 보세요." },
            pressure: { title: "경험의 쓰임 설명하기", prompt: "같은 방법이 통하지 않는 상황이라면 어떻게 하시겠어요?", hint: "바로 성과를 약속하기보다, 먼저 확인할 조건과 바꿔 볼 행동을 나누세요." },
            close: { title: "역할을 확인하는 질문", prompt: "그 강점을 쓸 수 있을지 판단하려면 저희에게 무엇을 확인하고 싶으세요?", hint: "실제 맡을 일이나 협업 방식에 대한 질문 한 가지로 마무리하세요." }
          } },
          transition: { label: "새 역할에 도전하는 이유", goal: "부족한 경험을 인정하고 옮겨 쓸 역량과 준비를 전하기", starter: "이 역할은 새롭지만, 제가 옮겨 쓸 수 있는 경험은…", check: "아직 해 보지 않은 일과 이미 준비한 행동을 구분했나요?", turns: {
            opening: { title: "새 역할을 택한 이유", prompt: "이전과 다른 역할에 도전하려는 이유는 무엇인가요?", hint: "떠나고 싶은 이유보다, 새 역할에서 해 보고 싶은 일과 연결되는 경험을 말해 보세요." },
            specific: { title: "준비를 행동으로 보여 주기", prompt: "새 역할을 이해하기 위해 지금까지 직접 해 본 일은 무엇인가요?", hint: "실제로 해 본 공부·작은 작업·관찰 중 하나와 거기서 알게 된 점을 적으세요." },
            concise: { title: "전환 이유를 짧게", prompt: "왜 이 역할인지, 어떤 준비가 되었는지 두 문장으로 정리해 주세요.", hint: "도전 이유 한 문장과 준비한 행동 한 문장을 남겨 보세요." },
            pressure: { title: "경험 부족에 답하기", prompt: "직접 해 본 경험이 부족한데, 처음 맡는 일은 어떻게 시작하시겠어요?", hint: "모르는 점을 인정한 뒤, 확인할 기준·도움을 구할 시점·첫 작업을 구체적으로 말하세요." },
            close: { title: "첫걸음의 기준 확인하기", prompt: "입사 초기에 무엇을 배우거나 확인하고 싶으세요?", hint: "첫 업무의 성공 기준이나 적응 과정에 관한 질문 하나를 준비해 보세요." }
          } }
        }
      },
      request: {
        counterparts: {
          colleague: { label: "함께 일하는 동료", opening: "지금 잠깐 이야기할 수 있어요.", pressure: "저도 맡은 일이 남아 있어요.", hint: "동료가 선택할 수 있도록 필요한 도움과 조정 가능한 범위를 함께 말하세요." },
          manager: { label: "일정을 결정하는 상사", opening: "어떤 조정이 필요한지 말씀해 주세요.", pressure: "다른 업무 일정에도 영향이 생길 수 있어요.", hint: "현재 상태와 필요한 결정을 나누고, 내가 할 수 있는 대응도 제시하세요." }
        },
        goals: {
          help: { label: "작은 도움 구하기", goal: "필요한 작업과 기한을 정해 도움을 요청하기", starter: "지금 ○○까지 했는데, ○○ 부분을 부탁드려도 될까요?", check: "도움의 크기·기한·상대가 거절하거나 줄일 여지를 말했나요?", turns: {
            opening: { title: "필요한 도움 하나 꺼내기", prompt: "어떤 도움이 필요한가요?", hint: "현재까지 한 일 뒤에, 부탁할 작업 하나와 필요한 시점을 붙이세요." },
            specific: { title: "부탁의 끝을 정하기", prompt: "어디까지 도와드리면 되고, 언제까지 필요한가요?", hint: "작업의 시작과 끝, 필요한 기한, 전달 방법을 구체적으로 정해 보세요." },
            concise: { title: "한 번에 이해할 부탁", prompt: "핵심 요청과 기한부터 짧게 말해 줄래요?", hint: "“○○를 ○○까지 부탁드릴 수 있을까요?” 다음에 이유를 한 문장만 붙이세요." },
            pressure: { title: "도움을 줄일 수 있을 때", prompt: "전부 맡기는 어려운데, 가장 필요한 부분만 정할 수 있을까요?", hint: "상황을 인정하고 최소한의 도움 하나로 줄이거나 다른 시점을 물어보세요." },
            close: { title: "가능한 범위를 확인하기", prompt: "가능한 범위와 전달 방법을 같이 정해 볼까요?", hint: "아직 합의하지 않은 도움을 확정하지 말고, 범위·기한·확인 방법을 질문으로 확인하세요." }
          } },
          deadline: { label: "일정 조정 부탁하기", goal: "현재 진행 상황을 알리고 가능한 새 일정을 상의하기", starter: "현재 ○○까지 진행했고, ○○ 때문에 일정 조정을 상의드리고 싶어요.", check: "현재 상태·영향·가능한 대안·확인할 시점을 함께 전했나요?", turns: {
            opening: { title: "일정 문제를 먼저 알리기", prompt: "지금 진행 상황과 조정이 필요한 일정을 알려 주세요.", hint: "끝난 일과 남은 일을 나누고, 바꾸고 싶은 시점을 구체적으로 말하세요." },
            specific: { title: "새 일정의 근거 세우기", prompt: "얼마나 더 필요하고, 그때까지 무엇을 마칠 수 있나요?", hint: "막연히 늦추지 말고, 남은 작업·가능한 날짜·중간 확인 시점을 제안하세요." },
            concise: { title: "변경 요청을 짧게", prompt: "기존 일정과 제안하는 일정, 이유를 짧게 정리해 주세요.", hint: "“○○를 ○○로 조정할 수 있을까요? 현재 ○○가 남았습니다.”처럼 말해 보세요." },
            pressure: { title: "마감이 고정돼 있을 때", prompt: "마감 자체를 바꾸기 어렵다면 어떤 방법이 있을까요?", hint: "그대로 가능하다고 약속하지 말고, 범위·우선순위·도움 중 조정할 수 있는 것을 상의하세요." },
            close: { title: "조정안을 확정하기 전에", prompt: "그럼 변경 범위와 다음 확인 시점을 어떻게 정하면 될까요?", hint: "누가 무엇을 언제까지 하는지 제안하고, 상대가 동의하는지 확인하세요." }
          } }
        }
      },
      refusal: {
        counterparts: {
          colleague: { label: "업무를 부탁하는 동료", opening: "업무와 관련해 부탁이 있어요.", pressure: "함께 일하는 사이인데 조금만 더 도와주시면 안 될까요?", hint: "상대에 대한 평가 대신, 현재 맡은 일과 가능한 범위를 말하세요." },
          friend: { label: "가까운 친구", opening: "함께하고 싶은 일이 있어요.", pressure: "우리 사이인데 이번 한 번만 안 될까요?", hint: "친구의 마음을 인정해도 결정한 범위를 바꿀 필요는 없어요." }
        },
        goals: {
          scope: { label: "맡기 어려운 일 거절하기", goal: "이번에 맡을 수 없는 범위를 분명하게 전하기", starter: "부탁한 마음은 이해해요. 다만 이번 일은 제가 맡기 어려워요.", check: "거절의 뜻이 분명하고, 할 수 없는 대안을 약속하지 않았나요?", turns: {
            opening: { title: "맡을 수 없는 범위 말하기", prompt: "이번 일을 맡아 줄 수 있을까요?", hint: "부탁을 받아 준 마음 한 문장과, 맡기 어려운 범위 한 문장을 나누세요." },
            specific: { title: "어디까지 어려운지", prompt: "일부만이라도 맡을 수 있는지 알려 주세요.", hint: "전부 어려우면 그렇게 말해도 괜찮아요. 가능한 범위가 있을 때만 따로 제안하세요." },
            concise: { title: "모호한 기대 남기지 않기", prompt: "그래서 이번 일은 맡을 수 있다는 뜻인가요?", hint: "“이번 일은 맡기 어렵습니다.”처럼 결정을 먼저 전하고 설명은 짧게 덧붙이세요." },
            pressure: { title: "다시 부탁해도 내 범위 유지하기", prompt: "다른 사람을 구하기 어려워요. 조금만 맡아 줄 수 없나요?", hint: "상황이 어려운 점을 인정하되, 새 핑계를 만들지 말고 결정한 범위를 반복하세요." },
            close: { title: "존중하며 끝맺기", prompt: "알겠어요. 다른 방법을 찾아볼게요.", hint: "들어 준 것에 고마움을 전하세요. 관계를 위해 불가능한 대안을 덧붙일 필요는 없어요." }
          } },
          schedule: { label: "약속·시간 제안 거절하기", goal: "어려운 시간을 분명히 말하고 가능한 경우에만 다른 때를 제안하기", starter: "그 시간에는 함께하기 어려워요. 제 일정을 먼저 말씀드릴게요.", check: "어려운 시간을 분명히 말하고, 대안은 실제 가능할 때만 제안했나요?", turns: {
            opening: { title: "그 시간은 어렵다고 말하기", prompt: "이번에 제안한 시간에 함께할 수 있나요?", hint: "가능 여부를 먼저 말하세요. 개인 일정을 자세히 설명할 의무는 없어요." },
            specific: { title: "가능한 시간과 불가능한 시간", prompt: "그 시간이 안 되면 가능한 다른 때가 있을까요?", hint: "가능한 때가 있으면 제안하고, 아직 모르겠으면 확인 전 약속하지 마세요." },
            concise: { title: "가능 여부부터 짧게", prompt: "일정을 잡아야 해서요. 이번에는 참석할 수 있나요?", hint: "가능 여부 한 문장과, 필요하면 대안 한 문장으로 정리하세요." },
            pressure: { title: "잠깐만 오라는 말에 답하기", prompt: "잠깐만 시간을 내면 안 될까요? 이미 기대하고 있어요.", hint: "기대하는 마음을 인정하고, 어렵다는 결정을 차분히 반복해 보세요." },
            close: { title: "다음 약속을 강요하지 않고", prompt: "알겠어요. 다음 일정을 정할 때 어떻게 하면 좋을까요?", hint: "다음 연락 방법을 정하거나, 일정 확인 뒤 답하겠다고 말하세요. 날짜를 억지로 약속하지 않아도 돼요." }
          } }
        }
      }
    });
    record = (value) => value && typeof value === "object" && !Array.isArray(value);
    keys = (value, names2) => record(value) && Object.keys(value).every((key) => names2.includes(key));
    safeCharacters = (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(value);
    bounded = (value, max, allowEmpty = true) => typeof value === "string" && value.length <= max && safeCharacters(value) && (allowEmpty || value.trim().length > 0);
  }
});

// experiences/family-album/model.mjs
function validateRecipe(recipe, at) {
  if (!ownKeys(recipe, ["servings", "learnedFrom", "ingredients", "steps", "attempts", "revisedAt"]) || !Array.isArray(recipe.attempts) || recipe.attempts.length > LIMITS.attempts || !stamp(recipe.revisedAt ?? at)) fail("손맛 기록을 확인해 주세요. 만들어 본 기록은 20번까지 남길 수 있어요.");
  const ids3 = /* @__PURE__ */ new Set();
  const attempts = recipe.attempts.map((a) => {
    if (!ownKeys(a, ["id", "date", "note", "createdAt"]) || !id(a.id) || ids3.has(a.id) || !validDate(a.date, true) || !stamp(a.createdAt)) fail("만들어 본 날짜와 기록을 확인해 주세요.");
    ids3.add(a.id);
    return { id: a.id, date: a.date, note: text(a.note, 2e3, true), createdAt: a.createdAt };
  });
  return { servings: text(recipe.servings, 120), learnedFrom: text(recipe.learnedFrom, 120, true), ingredients: text(recipe.ingredients, 6e3, true), steps: text(recipe.steps, 1e4, true), attempts, revisedAt: recipe.revisedAt ?? at };
}
function mediaBytes(media, kind) {
  if (media === null) return 0;
  if (!ownKeys(media, ["name", "type", "data"]) || typeof media.name !== "string" || media.name.length > 180 || typeof media.type !== "string" || typeof media.data !== "string") fail("파일 정보가 올바르지 않아요.");
  const allowed = kind === "photo" ? ["image/jpeg", "image/png", "image/webp"] : ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"];
  if (!allowed.includes(media.type)) fail("지원하는 사진 또는 음성 파일을 골라 주세요.");
  const prefix = `data:${media.type};base64,`;
  if (!media.data.startsWith(prefix)) fail("파일 형식이 맞지 않아요.");
  const b64 = media.data.slice(prefix.length);
  if (!b64.length || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) fail("파일 내용이 올바르지 않아요.");
  const count = b64.length / 4 * 3 - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (count > LIMITS[kind]) fail(kind === "photo" ? "사진은 한 장에 6 MB까지 담을 수 있어요." : "음성은 한 개에 8 MB까지 담을 수 있어요.");
  const header = atob(b64.slice(0, 64));
  const byte = (n) => header.charCodeAt(n);
  const valid = media.type === "image/jpeg" ? byte(0) === 255 && byte(1) === 216 && byte(2) === 255 : media.type === "image/png" ? header.slice(1, 4) === "PNG" && byte(0) === 137 : media.type === "image/webp" ? header.slice(0, 4) === "RIFF" && header.slice(8, 12) === "WEBP" : media.type === "audio/wav" ? header.slice(0, 4) === "RIFF" && header.slice(8, 12) === "WAVE" : media.type === "audio/ogg" ? header.slice(0, 4) === "OggS" : media.type === "audio/webm" ? byte(0) === 26 && byte(1) === 69 && byte(2) === 223 && byte(3) === 163 : media.type === "audio/mp4" ? header.slice(4, 8) === "ftyp" : header.slice(0, 3) === "ID3" || byte(0) === 255 && (byte(1) & 224) === 224;
  if (!valid) fail("확장자와 실제 파일 내용이 달라요. 다른 파일을 골라 주세요.");
  return count;
}
function validateAlbum(input) {
  if (!ownKeys(input, ["format", "version", "pages"]) || input.format !== "synk-family-album" || input.version !== 1 || !Array.isArray(input.pages) || input.pages.length > LIMITS.pages) fail("가족 이야기 앨범 파일이 아니거나 페이지가 너무 많아요.");
  let bytes = 0;
  const ids3 = /* @__PURE__ */ new Set();
  const pages = input.pages.map((p) => {
    if (!ownKeys(p, ["id", "title", "date", "person", "author", "story", "photo", "audio", "details", "skipped", "contributions", "createdAt", "updatedAt", "recipe"]) || !id(p.id) || ids3.has(p.id) || !stamp(p.createdAt) || !stamp(p.updatedAt)) fail("페이지 정보가 올바르지 않아요.");
    ids3.add(p.id);
    if (!validDate(p.date)) fail("날짜를 확인해 주세요.");
    const recipe = Object.hasOwn(p, "recipe") ? validateRecipe(p.recipe, p.createdAt) : null;
    const questions = recipe ? [...QUESTIONS, ...RECIPE_QUESTIONS] : QUESTIONS;
    if (!ownKeys(p.details, questions.map((q) => q.id)) || !Array.isArray(p.skipped) || p.skipped.some((v) => !questions.some((q) => q.id === v)) || new Set(p.skipped).size !== p.skipped.length) fail("질문 기록을 확인해 주세요.");
    const details = Object.fromEntries(Object.entries(p.details).map(([k, v]) => [k, text(v, 1e3, true)]));
    if (!Array.isArray(p.contributions) || p.contributions.length > LIMITS.contributions) fail("덧붙인 기억은 페이지마다 40개까지 담을 수 있어요.");
    const contributionIds = /* @__PURE__ */ new Set();
    const contributions = p.contributions.map((c) => {
      if (!ownKeys(c, ["id", "name", "text", "createdAt"]) || !id(c.id) || contributionIds.has(c.id) || !stamp(c.createdAt)) fail("덧붙인 기억의 출처를 확인해 주세요.");
      contributionIds.add(c.id);
      return { id: c.id, name: text(c.name, 60, true), text: text(c.text, 2e3, true), createdAt: c.createdAt };
    });
    bytes += mediaBytes(p.photo, "photo") + mediaBytes(p.audio, "audio");
    return { id: p.id, title: text(p.title, 100, true), date: p.date, person: text(p.person, 100), author: text(p.author, 60, true), story: text(p.story, 1e4, true), photo: p.photo ? { ...p.photo } : null, audio: p.audio ? { ...p.audio } : null, details, skipped: [...p.skipped], contributions, createdAt: p.createdAt, updatedAt: p.updatedAt, ...recipe ? { recipe } : {} };
  });
  if (bytes > LIMITS.total) fail("앨범의 사진과 음성은 모두 합쳐 20 MB까지 담을 수 있어요. 기존 파일을 줄여 주세요.");
  const result = { format: input.format, version: 1, pages };
  if (new TextEncoder().encode(JSON.stringify(result)).length > LIMITS.export) fail("사진·음성·글을 합친 앨범 파일은 32 MB까지 담을 수 있어요. 일부 내용을 나눠 보관해 주세요.");
  return result;
}
var LIMITS, QUESTIONS, RECIPE_QUESTIONS, fail, text, id, stamp, validDate, ownKeys;
var init_model2 = __esm({
  "experiences/family-album/model.mjs"() {
    LIMITS = Object.freeze({ photo: 6 * 1024 * 1024, audio: 8 * 1024 * 1024, total: 20 * 1024 * 1024, export: 32 * 1024 * 1024, pages: 30, contributions: 40, attempts: 20 });
    QUESTIONS = Object.freeze([
      { id: "place", label: "장소", prompt: () => "함께한 그날, 어디에 있었나요?" },
      { id: "occasion", label: "그날의 계기", prompt: (p) => `「${p.title}」의 날, 함께 모인 계기가 있었나요?` },
      { id: "quote", label: "기억나는 한마디", prompt: () => "그날 나눈 말 중 지금도 떠오르는 한마디가 있나요?" },
      { id: "feeling", label: "남은 마음", prompt: () => "이 이야기를 지금 다시 보면 어떤 마음이 드나요?" }
    ]);
    RECIPE_QUESTIONS = Object.freeze([
      { id: "amount", label: "직접 확인한 양", prompt: () => "“적당히”라고 배운 재료가 있나요? 실제로 넣어 본 양을 남겨 주세요." },
      { id: "heat", label: "불 세기와 시간", prompt: () => "어떤 불 세기로 얼마나 익혔나요? 사용한 냄비나 도구도 함께 적어 주세요." },
      { id: "doneness", label: "완성의 기준", prompt: () => "다 익었다는 걸 어떻게 확인했나요? 맛이나 모양으로 알게 된 기준이 있나요?" }
    ]);
    fail = (message) => {
      throw new Error(message);
    };
    text = (v, max, required = false) => {
      if (typeof v !== "string" || v.length > max || required && !v.trim()) fail("글의 길이나 필수 항목을 확인해 주세요.");
      return v.trim();
    };
    id = (v) => typeof v === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(v);
    stamp = (v) => typeof v === "string" && Number.isFinite(Date.parse(v));
    validDate = (v, required = false) => typeof v === "string" && (!v ? !required : /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
    ownKeys = (v, allowed) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every((k) => allowed.includes(k));
  }
});

// experiences/synk-account/src/platform-library-data.mjs
function emptyPlatformLibrary() {
  return { version: 1, consent: false, favorites: [], recent: [], rememberRecent: true, notes: [] };
}
function validatePlatformLibrary(value) {
  if (!exact(value, ["version", "consent", "favorites", "recent", "rememberRecent", "notes"]) || value.version !== 1 || typeof value.consent !== "boolean" || !ids(value.favorites) || typeof value.rememberRecent !== "boolean" || !Array.isArray(value.recent) || value.recent.length > PLATFORM_APP_IDS.length || !Array.isArray(value.notes) || value.notes.length > PLATFORM_NOTE_LIMIT) invalid();
  if (!value.consent && (value.favorites.length || value.recent.length || value.notes.length) || !value.rememberRecent && value.recent.length) invalid();
  const seen = /* @__PURE__ */ new Set();
  for (const row of value.recent) {
    if (!exact(row, ["id", "at", "mode"]) || !PLATFORM_APP_IDS.includes(row.id) || !stamp2(row.at) || !["web", "client"].includes(row.mode) || seen.has(row.id)) invalid();
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
  next.favorites = [...new Set(next.favorites.map((id2) => platformDisplayAppId(id2, appIds)))];
  const recent = /* @__PURE__ */ new Map();
  for (const row of next.recent) {
    const id2 = platformDisplayAppId(row.id, appIds), previous = recent.get(id2);
    if (!previous || row.at > previous.at) recent.set(id2, { ...row, id: id2, ...row.id === "teacher" && id2 !== row.id ? { entryId: "teacher" } : {} });
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
  if (action.type === "favorite") next.favorites = next.favorites.some((id2) => platformDisplayAppId(id2, appIds) === platformDisplayAppId(action.id, appIds)) ? next.favorites.filter((id2) => platformDisplayAppId(id2, appIds) !== platformDisplayAppId(action.id, appIds)) : [...next.favorites, action.id];
  else if (action.type === "move-favorite") {
    if (!ACTIVE_PLATFORM_APP_IDS.includes(action.id) || ![-1, 1].includes(action.direction)) invalid();
    const groups = /* @__PURE__ */ new Map();
    for (const id2 of next.favorites) {
      const visible2 = platformDisplayAppId(id2, appIds);
      if (!groups.has(visible2)) groups.set(visible2, []);
      groups.get(visible2).push(id2);
    }
    const order = [...groups.keys()], visible = platformDisplayAppIds(appIds), from = order.indexOf(platformDisplayAppId(action.id, appIds));
    if (from < 0 || !visible.includes(order[from])) invalid();
    let to = from + action.direction;
    while (to >= 0 && to < order.length && !visible.includes(order[to])) to += action.direction;
    if (to >= 0 && to < order.length) {
      [order[from], order[to]] = [order[to], order[from]];
      next.favorites = order.flatMap((id2) => groups.get(id2));
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
    if (!row || !text2(action.title, 240) || !ACTIVE_PLATFORM_APP_IDS.includes(action.id) && !(action.id === "partners" && row.appId === "partners")) invalid();
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
var PLATFORM_APP_IDS, ACTIVE_PLATFORM_APP_IDS, platformAppId, platformDisplayAppId, platformDisplayAppIds, PLATFORM_NOTE_LIMIT, object, invalid, noteLimit, exact, stamp2, text2, ids, note;
var init_platform_library_data = __esm({
  "experiences/synk-account/src/platform-library-data.mjs"() {
    PLATFORM_APP_IDS = Object.freeze(["world", "messenger", "teacher", "path", "pulse", "partners", "care", "fortune", "rehearsal", "family-album"]);
    ACTIVE_PLATFORM_APP_IDS = Object.freeze(PLATFORM_APP_IDS.filter((id2) => id2 !== "partners"));
    platformAppId = (id2) => id2 === "partners" ? "pulse" : id2;
    platformDisplayAppId = (id2, appIds = ACTIVE_PLATFORM_APP_IDS) => platformAppId(id2) === "teacher" && appIds.includes("teacher") && appIds.includes("messenger") ? "messenger" : platformAppId(id2);
    platformDisplayAppIds = (appIds = ACTIVE_PLATFORM_APP_IDS) => [...new Set(appIds.filter((id2) => ACTIVE_PLATFORM_APP_IDS.includes(id2)).map((id2) => platformDisplayAppId(id2, appIds)))];
    PLATFORM_NOTE_LIMIT = 60;
    object = (value) => value && typeof value === "object" && !Array.isArray(value);
    invalid = () => {
      throw Object.assign(new TypeError("플랫폼 기록 형식을 확인해 주세요."), { code: "INVALID_PERSONAL_STATE" });
    };
    noteLimit = () => {
      throw Object.assign(new Error("메모는 최대 " + PLATFORM_NOTE_LIMIT + "개까지 보관할 수 있어요. 필요 없는 메모를 삭제한 뒤 다시 시도해 주세요."), { code: "NOTE_LIMIT" });
    };
    exact = (value, keys2) => object(value) && Object.keys(value).every((key) => keys2.includes(key)) && keys2.every((key) => Object.hasOwn(value, key));
    stamp2 = (value) => Number.isSafeInteger(value) && value > 0 && value <= 864e13;
    text2 = (value, limit) => typeof value === "string" && value.trim().length > 0 && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);
    ids = (value) => Array.isArray(value) && value.length <= PLATFORM_APP_IDS.length && new Set(value).size === value.length && value.every((id2) => PLATFORM_APP_IDS.includes(id2));
    note = (row) => exact(row, ["id", "appId", "title", "done", "createdAt"]) && text2(row.id, 80) && /^[a-zA-Z0-9-]+$/.test(row.id) && PLATFORM_APP_IDS.includes(row.appId) && text2(row.title, 240) && typeof row.done === "boolean" && stamp2(row.createdAt);
  }
});

// experiences/path-travel/real-places.mjs
var REAL_META, REAL_CONDITION_CALENDAR, REAL_PLACES;
var init_real_places = __esm({
  "experiences/path-travel/real-places.mjs"() {
    REAL_META = Object.freeze({
      "version": 2,
      "area": "서울 종로·안국·인사동·북촌",
      "checkedAt": "2026-10-07",
      "sourceKind": "official-web-notices",
      "liveAvailability": false
    });
    REAL_CONDITION_CALENDAR = Object.freeze({
      "from": "2026-09-07",
      "through": "2026-11-06",
      "holidays": [
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-10-03",
        "2026-10-05",
        "2026-10-09"
      ],
      "sourceUrl": "https://www.kasi.re.kr/kor/post/newsMaterial/32031",
      "verifiedAt": "2026-10-07",
      "note": "우주항공청 2026년 월력요항(한국천문연구원 게시). 일요일은 주간시간표로 처리하며 이 배열에는 별도 공휴일만 수록"
    });
    REAL_PLACES = Object.freeze([
      {
        "id": "gaeseong-mandu-koong",
        "name": "개성만두 궁",
        "category": "food",
        "address": "서울특별시 종로구 인사동10길 11-3",
        "description": "개성만두와 사골 국물 요리를 소개하는 한식당.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울관광재단 Visit Seoul",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B6%81/KOP011155",
        "costNote": "공식 식사류 예시: 개성 만둣국 15,000원 · 매장 최저비용이 아니며 세금·주문 단위 확인 필요",
        "visitNote": "영업시간·쉬는 시간·휴무일을 확인해 주세요.",
        "openingNote": "일·월·화 11:30~20:00. 수~토 마감은 매장 공식 21:30, 서울 관광 안내 21:00으로 서로 달라요. 평일 쉬는 시간·요일별 마지막 주문은 방문 전 확인해 주세요. 신정·설·추석 당일과 별도 여름휴가 휴무 안내가 있어요.",
        "accessNote": "3호선 안국역 5번 출구에서 인사동10길로 이동해요.",
        "accessSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B6%81/KOP011155",
        "visitSourceUrl": "https://www.koong.co.kr/2020/storeinfo/headoffice.php",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://www.koong.co.kr/2020/storeinfo/headoffice.php",
            "weekly": {},
            "scope": "partial",
            "holidayPolicy": "unknown",
            "note": "공식 매장과 관광 안내의 마감시간이 다르고, 매장 표의 주문마감과 일부 요일 폐점시간도 맞지 않아 시간 조건은 미확인"
          },
          "price": {
            "kind": "sample",
            "label": "개성 만둣국",
            "scope": "menu-item",
            "taxStatus": "not-stated",
            "sourceUrl": "https://www.koong.co.kr/2020/menuinfo/meals.php",
            "verifiedAt": "2026-10-07",
            "amount": 15e3,
            "note": "식사류 메뉴 한 항목의 표시가격. 인분·세금 별도 문구는 없으며 다른 메뉴나 매장 최저비용을 뜻하지 않음"
          }
        }
      },
      {
        "id": "balwoo-gongyang",
        "name": "발우공양",
        "category": "food",
        "address": "서울특별시 종로구 우정국로 56 템플스테이 통합정보센터 5층",
        "description": "한국불교문화사업단이 직접 운영하며 사찰음식 조리법을 소개하는 레스토랑.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울관광재단 Visit Seoul",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "costNote": "메뉴별 가격은 공식 안내에서 확인",
        "visitNote": "예약·운영시간과 원하는 메뉴의 제공 조건을 확인해 주세요.",
        "openingNote": "서울 공식 관광 안내는 11:30~21:00, 쉬는 시간 15:00~18:00, 마지막 주문 19:40으로 소개해요. 정기휴무는 공식 본문에서 확인하지 못했어요. 방문 전 매장 확인이 필요해요.",
        "accessNote": "1호선 종각역 3-1번 출구 또는 3호선 안국역 6번 출구. 템플스테이 통합정보센터 5층이에요.",
        "accessSourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "visitSourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
            "weekly": {},
            "scope": "partial",
            "holidayPolicy": "unknown",
            "note": "정기휴무·요일별 적용 미확인. 안내 시간과 실제 예약 가능 여부는 별도 확인"
          },
          "price": {
            "kind": "unknown",
            "label": "메뉴 제공 요일·시간·주문 단위 확인 필요",
            "scope": "menu-item",
            "taxStatus": "not-stated",
            "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
            "verifiedAt": "2026-10-07",
            "note": "서울 관광 안내에 선식 36,000원(평일 점심 한정), 원식 50,000원이 있으나 상품 이용 조건과 인분·세금을 확인하지 못해 예산 확정에 사용하지 않음"
          }
        }
      },
      {
        "id": "kyungin-traditional-teahouse",
        "name": "경인미술관 전통다원",
        "category": "tea",
        "address": "서울특별시 종로구 인사동10길 11-4 경인미술관",
        "description": "경인미술관의 한옥·정원 공간에서 전통차와 한식 다과를 소개하는 찻집.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울관광재단 Visit Seoul",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "costNote": "메뉴별 가격은 공식 안내에서 확인",
        "visitNote": "영업시간·쉬는 시간·휴무일을 확인해 주세요.",
        "openingNote": "매일 11:00~21:20. 신정·설·추석 휴무 안내가 있어요. 미술관 전시 관람시간과는 별개예요.",
        "accessNote": "3호선 안국역 5번 출구. 인사동10길 경인미술관 안에 있어요.",
        "accessSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "visitSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
            "weekly": {
              "0": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "1": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "2": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "3": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "4": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "5": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "6": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "unknown",
            "note": "명절 휴무 범위는 미확인. 공휴일 날짜는 별도 확인"
          },
          "price": {
            "kind": "unknown",
            "label": "개별 메뉴 가격 미확인",
            "scope": "menu-item",
            "taxStatus": "not-stated",
            "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
            "verifiedAt": "2026-10-07"
          }
        }
      },
      {
        "id": "osulloc-bukchon",
        "name": "오설록 티하우스 북촌점",
        "category": "tea",
        "address": "서울특별시 종로구 북촌로 45",
        "description": "차와 북촌점 티푸드, 논알코올 티 칵테일을 소개하는 오설록 티하우스.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "오설록",
        "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "costNote": "메뉴별 가격은 공식 안내에서 확인",
        "visitNote": "시즌별 메뉴와 티코스 예약 조건을 확인해 주세요.",
        "openingNote": "월~목 11:00~20:00, 금~일 11:00~21:00. 정기휴무는 공식 매장 본문에 따로 안내되어 있지 않아 확인이 필요해요.",
        "accessNote": "북촌로 45. 공식 매장 소개의 지도보기를 확인해 주세요. 역·출구 안내는 해당 본문에서 확인하지 못했어요.",
        "accessSourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "visitSourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
            "weekly": {
              "0": [
                {
                  "open": "11:00",
                  "close": "21:00"
                }
              ],
              "1": [
                {
                  "open": "11:00",
                  "close": "20:00"
                }
              ],
              "2": [
                {
                  "open": "11:00",
                  "close": "20:00"
                }
              ],
              "3": [
                {
                  "open": "11:00",
                  "close": "20:00"
                }
              ],
              "4": [
                {
                  "open": "11:00",
                  "close": "20:00"
                }
              ],
              "5": [
                {
                  "open": "11:00",
                  "close": "21:00"
                }
              ],
              "6": [
                {
                  "open": "11:00",
                  "close": "21:00"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "unknown",
            "note": "요일별 공식 안내이며 정기휴무·공휴일 예외는 미확인"
          },
          "price": {
            "kind": "unknown",
            "label": "선택 메뉴·티코스 조건 확인 필요",
            "scope": "menu-item",
            "taxStatus": "not-stated",
            "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
            "verifiedAt": "2026-10-07",
            "note": "북촌 시즈널 티코스 39,000원 안내는 있으나 1인 단위·세금·예약 조건을 확정하지 못해 매장 예산으로 사용하지 않음"
          }
        }
      },
      {
        "id": "nine-tree-insadong",
        "name": "나인트리 바이 파르나스 서울 인사동",
        "category": "stay",
        "address": "서울특별시 종로구 인사동길 49",
        "description": "인사동길에 있는 호텔. 객실 유형과 이용 조건을 공식 예약 화면에서 비교할 수 있어요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "나인트리 바이 파르나스",
        "sourceUrl": "https://www.ninetreehotels.com/ko/insadong",
        "costNote": "날짜·객실·인원별 요금 확인 · 세금·취소 조건 별도 확인",
        "visitNote": "객실 구성·투숙 인원·예약 가능 여부를 확인해 주세요.",
        "openingNote": "공식 객실 안내 기준 체크인 15:00, 체크아웃 12:00. 예약 상품의 별도 이용 조건을 확인해 주세요.",
        "accessNote": "3호선 안국역 6번 출구. 공식 호텔찾기에서 서울 인사동 지점을 확인해 주세요.",
        "accessSourceUrl": "https://www.ninetreehotels.com/ko/hub/hotel-find",
        "visitSourceUrl": "https://www.ninetreehotels.com/ko/insadong/room/standard-double",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://www.ninetreehotels.com/ko/insadong/room/standard-double",
            "weekly": {},
            "scope": "partial",
            "holidayPolicy": "unknown",
            "note": "체크인·체크아웃은 방문 영업시간이나 당일 입실 가능 여부를 뜻하지 않음"
          },
          "price": {
            "kind": "unknown",
            "label": "날짜·객실·인원별 예약 요금 확인",
            "scope": "room",
            "taxStatus": "not-stated",
            "sourceUrl": "https://www.ninetreehotels.com/ko/insadong",
            "verifiedAt": "2026-10-07",
            "note": "객실 요금을 일반 성인 1인 입장·메뉴 예산으로 비교하지 않음"
          }
        }
      },
      {
        "id": "orakai-insadong-suites",
        "name": "오라카이 인사동 스위츠",
        "category": "stay",
        "address": "서울특별시 종로구 인사동4길 18",
        "description": "주방 시설과 여러 객실 유형을 안내하는 레지던스 호텔. 필요한 객실 구성과 투숙 인원을 먼저 확인해 보세요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "오라카이 인사동 스위츠",
        "sourceUrl": "https://insa.orakaihotels.com/kr/default.asp",
        "costNote": "날짜·객실·인원별 요금 확인 · 세금·취소 조건 별도 확인",
        "visitNote": "객실 구성·투숙 인원·예약 가능 여부를 확인해 주세요.",
        "openingNote": "체크인 16:00부터, 체크아웃 11:00까지. 이른 입실·늦은 퇴실은 객실 상황과 추가 요금 조건을 따로 확인해 주세요.",
        "accessNote": "1·3·5호선 종로3가역 5번 출구. 공식 교통 안내는 짐이 많을 때 4번 출구 에스컬레이터도 안내해요.",
        "accessSourceUrl": "https://insa.orakaihotels.com/kr/about/location.asp",
        "visitSourceUrl": "https://insa.orakaihotels.com/kr/about/guest_info.asp?mCode=1",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://insa.orakaihotels.com/kr/about/guest_info.asp?mCode=1",
            "weekly": {},
            "scope": "partial",
            "holidayPolicy": "unknown",
            "note": "체크인·체크아웃은 방문 영업시간이나 당일 입실 가능 여부를 뜻하지 않음"
          },
          "price": {
            "kind": "unknown",
            "label": "날짜·객실·인원별 예약 요금 확인",
            "scope": "room",
            "taxStatus": "not-stated",
            "sourceUrl": "https://insa.orakaihotels.com/kr/default.asp",
            "verifiedAt": "2026-10-07",
            "note": "객실 요금을 일반 성인 1인 입장·메뉴 예산으로 비교하지 않음"
          }
        }
      },
      {
        "id": "seoul-museum-craft-art",
        "name": "서울공예박물관",
        "category": "culture",
        "address": "서울특별시 종로구 율곡로3길 4",
        "description": "전통과 현대 공예 전시를 둘러볼 수 있는 박물관. 관람할 전시동과 휴관 공지를 먼저 확인해 보세요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울공예박물관",
        "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
        "costNote": "일반 관람 무료 · 대관전시 유료 가능",
        "visitNote": "전시동별 운영시간·부분 휴관 공지를 확인해 주세요. 어린이박물관은 예약 안내를 확인해 주세요. 2026.10.13~10.25에는 전시1동 1층 로비 휴관·통행 제한 공지가 있어요.",
        "openingNote": "전시실 기본 10:00~18:00, 입장마감은 종료 30분 전. 월요일·1월 1일 휴관(공휴일인 월요일은 일반 전시 운영, 어린이박물관은 모든 월요일 휴관). 2026.9.15~11.30 화·수·금·토·일에는 전시실 가운데 전시1동 1~2층만 21:00까지 연장해요. 2026.10.13~10.25에는 전시1동 1층 로비 휴관·통행 제한이 있어요.",
        "accessNote": "3호선 안국역 1번 출구. 일반 관람객용 주차장은 운영하지 않아요.",
        "accessSourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
        "visitSourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000444",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
            "weekly": {
              "0": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "1": [],
              "2": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "3": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "4": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "5": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "6": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "same",
            "validFrom": "2026-10-07",
            "validThrough": "2026-11-06",
            "exceptions": {
              "2026-10-05": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "full",
                "note": "공휴일인 월요일 일반 전시 운영; 어린이박물관 제외"
              },
              "2026-10-13": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-14": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-15": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-16": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-17": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-18": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-20": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-21": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-22": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-23": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-24": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-25": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              }
            },
            "partialExtensions": [
              {
                "from": "2026-09-15",
                "through": "2026-11-30",
                "weekdays": [
                  0,
                  2,
                  3,
                  5,
                  6
                ],
                "slots": [
                  {
                    "open": "17:30",
                    "close": "21:00",
                    "lastEntry": "20:30"
                  }
                ],
                "note": "17:30 이후 일반 전시 입장은 마감되지만 전시1동 1~2층은 연장 운영해요. 대상 공간과 입장 조건을 확인해 주세요.",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000444"
              }
            ]
          },
          "price": {
            "kind": "free",
            "label": "일반 전시 관람",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
            "verifiedAt": "2026-10-07",
            "amount": 0,
            "note": "대관전시 및 예약 프로그램은 별도"
          }
        },
        "visitNoticeSourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
      },
      {
        "id": "unhyeongung",
        "name": "운현궁",
        "category": "culture",
        "address": "서울특별시 종로구 삼일대로 464",
        "description": "흥선대원군의 사가였던 역사 공간. 일반 관람과 행사·야간 운영 공지를 구분해 살펴보세요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울 공식 관광정보 Visit Seoul",
        "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "costNote": "일반 관람 무료",
        "visitNote": "휴관일과 계절별·특별 운영시간을 확인해 주세요. 유료 행사는 별도입니다.",
        "openingNote": "확인일 기준 일반 09:00~19:00(입장마감 18:30). 월요일 휴관, 공휴일인 월요일은 개장 안내예요. 2026.9.1~11.29 화·수·금·토·일에는 21:00까지(입장마감 20:30) 야간 개방해요. 동절기 시간은 별도 확인해 주세요.",
        "accessNote": "3호선 안국역 4번 출구. 삼일대로 464의 운현궁 입구를 지도에서 확인해 주세요.",
        "accessSourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "visitSourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
            "weekly": {
              "0": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ],
              "1": [],
              "2": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ],
              "3": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ],
              "4": [
                {
                  "open": "09:00",
                  "close": "19:00",
                  "lastEntry": "18:30"
                }
              ],
              "5": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ],
              "6": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "unknown",
            "validFrom": "2026-10-07",
            "validThrough": "2026-10-31",
            "exceptions": {
              "2026-10-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "19:00",
                    "lastEntry": "18:30"
                  }
                ],
                "scope": "full",
                "note": "공휴일인 월요일 정상 개장 일반 안내"
              }
            },
            "note": "야간기간은11/29까지이나 11월 일반 동절기 운영범위는 추가 확인 필요"
          },
          "price": {
            "kind": "free",
            "label": "일반 관람",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
            "verifiedAt": "2026-10-07",
            "amount": 0,
            "note": "유료 행사·체험 제외"
          }
        }
      },
      {
        "id": "gyeongbokgung",
        "name": "경복궁",
        "category": "culture",
        "address": "서울특별시 종로구 사직로 161",
        "description": "조선의 법궁에서 전각과 궁궐 마당을 둘러보는 일반 관람. 별도 예약 행사는 구분해 확인해요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "국가유산청 궁능유적본부",
        "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=gbg",
        "costNote": "일반 개인 대인 3,000원 · 내국인 만25~64세·외국인 만19~64세 기준 · 무료일·감면 별도",
        "visitNote": "2026.9.2~10.31 근정전 월대 출입 제한. 특별·야간 행사, 한복·연령별 무료 조건은 별도 확인해 주세요.",
        "openingNote": "화요일 휴궁. 10월 09:00~18:00(입장마감 17:00), 11월 09:00~17:00(입장마감 16:00). 공휴일과 정기휴궁일이 겹치면 다음 첫 비공휴일에 쉬어요.",
        "accessNote": "3호선 경복궁역 5번 출구 또는 5호선 광화문역 2번 출구에서 궁 입구로 이동해요.",
        "accessSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R707000000.do?schGroupCode=gbg",
        "visitSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930144202825885&schM=view",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=gbg",
            "weekly": {
              "0": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "1": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "2": [],
              "3": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "4": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "5": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "6": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ]
            },
            "scope": "partial",
            "holidayPolicy": "same",
            "validFrom": "2026-10-07",
            "validThrough": "2026-11-06",
            "exceptions": {
              "2026-10-06": {
                "closed": true,
                "note": "전체 궁능 대체 휴관일"
              },
              "2026-11-01": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              },
              "2026-11-02": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              },
              "2026-11-03": {
                "closed": true
              },
              "2026-11-04": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              },
              "2026-11-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              },
              "2026-11-06": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              }
            },
            "note": "10월은 근정전 월대 출입제한으로 부분 관람 안내; 일반 주간 관람만 대상"
          },
          "price": {
            "kind": "exact",
            "label": "일반 개인 대인 입장",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R703000000.do",
            "verifiedAt": "2026-10-07",
            "amount": 3e3,
            "exceptions": {
              "2026-10-29": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-30": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-31": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-01": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-02": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-03": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-04": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-05": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-06": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-28": {
                "kind": "free",
                "amount": 0,
                "label": "매월 마지막 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260528151556017843&schM=view"
              }
            },
            "note": "내국인 만25~64세·외국인 만19~64세 일반 기준. 증빙 감면·한복·별도 특별관람 제외"
          }
        }
      },
      {
        "id": "changgyeonggung",
        "name": "창경궁",
        "category": "culture",
        "address": "서울특별시 종로구 창경궁로 185",
        "description": "궁궐 전각과 정원을 둘러보는 종로의 역사 공간. 주간과 야간의 공개 구역이 달라요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "국가유산청 궁능유적본부",
        "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
        "costNote": "일반 개인 대인 1,000원 · 내국인 만25~64세·외국인 만19~64세 기준 · 2026.10.7부터 수요일 무료",
        "visitNote": "10월은 18시, 11월은 17:30부터 야간개방구역으로 이동해요. 물빛연화 등 별도 예약 행사와 일반 입장은 구분해 주세요.",
        "openingNote": "월요일 휴궁. 일반 09:00~21:00(입장마감 20:00). 공휴일과 정기휴궁일이 겹치면 다음 첫 비공휴일에 쉬어요. 야간에는 공개 구역이 제한돼요.",
        "accessNote": "4호선 혜화역 4번 출구에서 성균관대 방면을 거쳐 창경궁·종로 방향으로 이동해요. 공식 안내상 2026년 말까지 주차장 잠정 폐쇄예요.",
        "accessSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R707000000.do?schGroupCode=cgg",
        "visitSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
            "weekly": {
              "0": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "1": [],
              "2": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "3": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "4": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "5": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "6": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "same",
            "validFrom": "2026-10-07",
            "validThrough": "2026-11-06",
            "exceptions": {
              "2026-10-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "18:00"
                  }
                ],
                "scope": "full",
                "note": "대체공휴일 정상 개방"
              },
              "2026-10-06": {
                "closed": true,
                "note": "대체공휴일 다음 날 전체 궁능 휴관"
              },
              "2026-11-01": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              },
              "2026-11-02": {
                "closed": true
              },
              "2026-11-03": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              },
              "2026-11-04": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              },
              "2026-11-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              },
              "2026-11-06": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              }
            },
            "partialExtensions": [
              {
                "from": "2026-10-07",
                "through": "2026-10-31",
                "weekdays": [
                  0,
                  2,
                  3,
                  4,
                  5,
                  6
                ],
                "slots": [
                  {
                    "open": "18:00",
                    "close": "21:00",
                    "lastEntry": "20:00"
                  }
                ],
                "note": "야간개방구역만 관람 가능; 별도 예약 행사 제외"
              },
              {
                "from": "2026-11-01",
                "through": "2026-11-06",
                "weekdays": [
                  0,
                  2,
                  3,
                  4,
                  5,
                  6
                ],
                "slots": [
                  {
                    "open": "17:30",
                    "close": "21:00",
                    "lastEntry": "20:00"
                  }
                ],
                "note": "야간개방구역만 관람 가능"
              }
            ]
          },
          "price": {
            "kind": "exact",
            "label": "일반 개인 대인 입장",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R703000000.do",
            "verifiedAt": "2026-10-07",
            "amount": 1e3,
            "exceptions": {
              "2026-10-29": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-30": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-31": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-01": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-02": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-03": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-04": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              },
              "2026-11-05": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-06": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-07": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              },
              "2026-10-14": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              },
              "2026-10-21": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              },
              "2026-10-28": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              }
            },
            "note": "내국인 만25~64세·외국인 만19~64세 기준. 별도 예약 행사·증빙 감면 제외"
          }
        }
      },
      {
        "id": "national-folk-museum",
        "name": "국립민속박물관 본관",
        "category": "culture",
        "address": "서울특별시 종로구 삼청로 37",
        "description": "한국인의 생활문화와 민속을 살펴보는 무료 박물관. 경복궁 입장과는 별개예요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "국립민속박물관",
        "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
        "costNote": "본관 일반 관람 무료 · 경복궁 관람은 별도 유료",
        "visitNote": "상설전시관1은 2026.9.30~12.21(예정) 휴관. 주말·공휴일은 옥외전시장 내부 관람 제한. 10.13 14:00~14:10 소방훈련 안내가 있어요.",
        "openingNote": "3~10월 09:00~18:00, 수요일 20:00까지. 11~2월 09:00~17:00(야간연장 없음). 입장마감은 종료 1시간 전. 1월 1일·설·추석 당일 휴관.",
        "accessNote": "삼청로 37 본관 입구를 확인해 주세요. 무료 박물관 관람과 경복궁 유료 관람 동선을 구분해요.",
        "accessSourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
        "visitSourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
            "weekly": {
              "0": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "1": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "2": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "3": [
                {
                  "open": "09:00",
                  "close": "20:00",
                  "lastEntry": "19:00"
                }
              ],
              "4": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "5": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "6": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ]
            },
            "scope": "partial",
            "holidayPolicy": "same",
            "validFrom": "2026-10-07",
            "validThrough": "2026-11-06",
            "exceptions": {
              "2026-11-01": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-02": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-03": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-04": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-06": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              }
            },
            "note": "상설전시관1 휴관 기간으로 전체 관람 가능 여부는 미확인. 주말·공휴일 옥외전시장 내부도 제한"
          },
          "price": {
            "kind": "free",
            "label": "본관 일반 관람",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
            "verifiedAt": "2026-10-07",
            "amount": 0,
            "note": "경복궁 입장료 및 별도 상품·프로그램 제외"
          }
        }
      }
    ].map((place) => Object.freeze(place)));
  }
});

// experiences/path-travel/places-v2.mjs
function enrich(place, properties = {}) {
  const source = byId[place.id];
  const url = source?.url || place.sourceUrl;
  const isNew = Boolean(place.weekly);
  const details = PLACE_DETAILS[place.id];
  const visitor = VISITOR_DETAILS[place.id];
  const featuresByKey = Object.fromEntries(PERSONALIZATION_TAGS.map((key) => [key, details?.featuresByKey[key] || { kind: "unknown", sourceUrl: null, verifiedAt: null, scope: "공식 자료에서 해당 세부 취향의 제공·미제공을 확인하지 못함" }]));
  const features = { ...properties.features || place.features || {}, ...Object.fromEntries(PERSONALIZATION_TAGS.map((key) => [key, featuresByKey[key].kind === "fact" ? true : null])) };
  const conditions = isNew ? {
    hours: { weekly: place.weekly, scope: Object.keys(place.weekly).length ? "full" : "partial", holidayPolicy: "unknown", verifiedAt: checkedAt, sourceUrl: url, note: place.openingNote, ...place.hours || {} },
    price: { kind: "unknown", label: place.costNote, scope: place.category === "food" || place.category === "tea" ? "menu-item" : "adult-one", taxStatus: "not-stated", ...place.price || {}, verifiedAt: checkedAt, sourceUrl: place.price?.sourceUrl || url },
    ...place.childPrice ? { childPrice: place.childPrice } : {}
  } : place.conditions;
  return Object.freeze({
    ...place,
    ...properties,
    dayPlannerEligible: place.category !== "stay",
    sourceLabel: place.sourceLabel || "공식 관광·매장 안내",
    sourceUrl: place.sourceUrl || url,
    officialUrl: place.sourceUrl || url,
    bookingUrl: details?.bookingUrl || place.sourceUrl || url,
    checkedAt: place.checkedAt || checkedAt,
    verifiedAt: place.verifiedAt || checkedAt,
    conditions: { ...details ? { ...conditions, hours: { ...conditions.hours, ...details.hoursOverride, verifiedAt: detailCheckedAt }, price: { ...conditions.price, ...details.priceOverride, verifiedAt: detailCheckedAt } } : conditions, ...visitor?.childPrice ? { childPrice: visitor.childPrice } : {} },
    ...details ? { menuItems: details.menuItems, visitInfo: details.visitInfo } : {},
    ...visitor ? { visitInfo: visitor.visitInfo } : {},
    coordinates: source?.coordinates ? { ...source.coordinates, sourceUrl: source.coordinateSourceUrl || url, verifiedAt: checkedAt, accuracy: "approximate", note: "공식 안내 지도에 표시된 장소 대표 좌표. 입구·보행 경로의 실측 좌표가 아닙니다." } : null,
    photo: photoById[place.id] ? { ...photoById[place.id], alt: place.name + "의 장소 참고 사진", caption: "장소 참고 사진 · 현재 모습·혼잡·운영 상태와 다를 수 있어요." } : null,
    features,
    planningStayProvenance: "estimated",
    planningStayLabel: "계획을 위한 체류 제안 · 대기시간 제외",
    unknowns: place.unknowns || ["현재 영업·예약 가능 여부", "혼잡·실제 대기시간", "조용함", "계단 없는 전체 동선"],
    provenance: { identity: { kind: "fact", sourceUrl: url, verifiedAt: source?.checkedAt || place.checkedAt }, features: { kind: "fact", scope: "공식 소개의 주요 활동·공간 유형. 품질·혼잡·무장애 보장이 아님", sourceUrl: url }, featuresByKey, coordinates: { kind: source?.coordinates ? "fact" : "unknown", scope: "approximate-place-point", sourceUrl: url }, planningStayMinutes: { kind: "estimated", source: "SYNK PATH 제품 제안", note: "실측 체류·대기시간 아님" }, quiet: { kind: "unknown" }, wait: { kind: "unknown" }, accessibility: { kind: "unknown" }, liveAvailability: { kind: "unknown" } }
  });
}
var SOURCES, PHOTO_CREDITS, BASE_PROPERTIES, EXTRA_PLACES, PERSONALIZATION_TAGS, detailCheckedAt, detailUrls, knownFeature, menuItem, visitInfo, PLACE_DETAILS, VISITOR_DETAILS, byId, photoById, checkedAt, TRAVEL_PLACES, TRAVEL_META;
var init_places_v2 = __esm({
  "experiences/path-travel/places-v2.mjs"() {
    init_real_places();
    SOURCES = Object.freeze([
      {
        "id": "osulloc-bukchon",
        "url": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.5809985877276,
          "lon": 126.984600900483
        },
        "details": [
          [
            "주소",
            "서울 종로구 북촌로 45"
          ],
          [
            "운영시간",
            "월~목 11:00~20:00, 금~일 11:00~21:00"
          ]
        ],
        "coordinateSourceUrl": "https://japanese.visitseoul.net/restaurants/osulloc-teahouse-bukchon/JPPvzz06x",
        "coordinateEvidence": "서울관광재단 일문 북촌점 안내의 지도 좌표. 브랜드 공식 매장 주소와 일치 확인"
      },
      {
        "id": "balwoo-gongyang",
        "url": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.5739364016111,
          "lon": 126.983185979719
        },
        "details": [
          [
            "이용시간",
            "11:30-21:00 (브레이크타임 15:00-18:00, 라스트오더 19:40)"
          ],
          [
            "이것만은 꼭!",
            "주류 판매 Ⓧ 무슬림 조리사 Ⓧ"
          ],
          [
            "대표메뉴",
            "선식(평일점심한정) ₩36,000 원식 ₩50,000"
          ],
          [
            "주소",
            "03145 서울 종로구 우정국로 56 (견지동) 템플스테이 통합정보센터 5층"
          ]
        ]
      },
      {
        "id": "kyungin-traditional-teahouse",
        "url": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.574513,
          "lon": 126.985597
        },
        "details": [
          [
            "이용시간",
            "매일 11:00 ~ 21:20"
          ],
          [
            "휴무일",
            "신정, 구정, 추석"
          ],
          [
            "대표메뉴",
            "전통차, 잎차, 건강차, 미용차"
          ],
          [
            "가격대",
            "1만원대"
          ],
          [
            "주소",
            "03146 서울특별시 종로구 인사동10길 11-4 (관훈동) 경인미술관"
          ]
        ]
      },
      {
        "id": "gaeseong-mandu-koong",
        "url": "https://korean.visitseoul.net/restaurants/%EA%B6%81/KOP011155",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.57423,
          "lon": 126.985393
        },
        "details": [
          [
            "이용시간",
            "일,월,화 11:30~20:00 / 수,목,금,토 11:30~21:00 (월~금 브레이크 타임 15:00~16:00)"
          ],
          [
            "휴무일",
            "명절 휴무"
          ],
          [
            "운영 요일",
            "월화수목금토일"
          ],
          [
            "대표메뉴",
            "만두"
          ],
          [
            "가격대",
            "1만원대"
          ],
          [
            "주소",
            "03146 서울특별시 종로구 인사동10길 11-3 (관훈동)"
          ]
        ]
      },
      {
        "id": "orakai-insadong-suites",
        "url": "https://insa.orakaihotels.com/kr/default.asp",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": null,
        "details": []
      },
      {
        "id": "unhyeongung",
        "url": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.57612550316581,
          "lon": 126.98712636763388
        },
        "details": [
          [
            "이용시간",
            "09:00 ~ 19:00 (입장마감 18:30) 야간 개방(2026. 9. 1~11.29): 매주 화·수·금·토·일요일 09:00~21:00( 입장 마감 20:30 )"
          ],
          [
            "휴무일",
            "월요일 (공휴일이 월요일일 경우 정상 개장)"
          ],
          [
            "운영 요일",
            "화요일~일요일"
          ],
          [
            "이것만은 꼭!",
            "운현궁 양관 : 본래 흥선대원군의 손자인 이준용을 위해 지은 건물로 양관이라고 불립니다. 프렌치 르네상스 풍의 석재를 혼용한 벽돌 2층 저택에 16개의 천장 문양이 모두 다릅니다. 1948년 덕성여자대학교에 매각되어 한때 교사로 쓰였고 지금도 평생교육원으로 쓰입니다. 인기 드라마 의 촬영 장소로 사용되기도 했습니다. - 운현궁에서 진행되는 다양한 프로그램(전시,체험,교육,이벤트)은 홈페이지에서 확인해보세요."
          ],
          [
            "이용요금",
            "무료"
          ],
          [
            "주소",
            "03131 서울 종로구 삼일대로 464 (운현궁)"
          ]
        ]
      },
      {
        "id": "seoul-museum-craft-art",
        "url": "https://korean.visitseoul.net/palace/%EC%84%9C%EC%9A%B8%EA%B3%B5%EC%98%88%EB%B0%95%EB%AC%BC%EA%B4%80/KOP038092",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.5766481740232,
          "lon": 126.983533363501
        },
        "details": [
          [
            "이용시간",
            "10:00 ~ 18:00 (17:30 입장 마감) 2026.9.15.(화)~11.30.(월) 목요일 제외한 화~일 21:00까지 야간개관합니다."
          ],
          [
            "휴무일",
            "월요일 (공휴일인 경우 운영) , 1월 1일"
          ],
          [
            "운영 요일",
            "화요일 ~ 일요일"
          ],
          [
            "이것만은 꼭!",
            "개인 자유관람. 단, 어린이박물관은 인터넷 사전예약 후 관람 가능 아카이브실, 보이는수장고, 보존과학실은 평일(화~금)에만 운영"
          ],
          [
            "이용요금",
            "무료"
          ],
          [
            "주소",
            "03061 서울 종로구 율곡로3길 4 (안국동, 서울공예박물관)"
          ]
        ]
      },
      {
        "id": "nine-tree-insadong",
        "url": "https://www.ninetreehotels.com/ko/insadong",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": { "lat": 37.574721, "lon": 126.983216 },
        "coordinateSourceUrl": "https://www.ninetreehotels.com/ko/hub/hotel-find",
        "coordinateEvidence": "호텔찾기 공식 화면의 인사동 호텔 marker 설정(pointer). 지도 중심이나 다른 지점 좌표가 아님. 입구 실측은 미확인",
        "details": [["주소", "서울 종로구 인사동길 49"]]
      },
      {
        "id": "changgyeonggung",
        "url": "https://english.visitseoul.net/attractions/Changgyeonggung%20Palace/ENP000297",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.57762529910132,
          "lon": 126.9938415437186
        },
        "details": [],
        "note": "Coordinate from official Seoul Tourism map. Existing Korean Royal Palaces operating and fee conditions retained."
      },
      {
        "id": "national-folk-museum",
        "url": "https://korean.visitseoul.net/attractions/%EA%B5%AD%EB%A6%BD%EB%AF%BC%EC%86%8D%EB%B0%95%EB%AC%BC%EA%B4%80_/1647",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.57948320107131,
          "lon": 126.97876185479451
        },
        "details": [
          [
            "이용시간",
            "3-10월 9:00 ~ 18:00 (17:00까지 입장) 11-2월 9:00 ~ 17:00 (16:00 까지 입장) 야간연장개관 3~10월 매주 수요일 09:00~20:00 (11월~2월 야간연장 미운영)"
          ],
          [
            "휴무일",
            "- 매년 1월1일 - 설, 추석 당일"
          ],
          [
            "운영 요일",
            "월~일"
          ],
          [
            "이것만은 꼭!",
            "우리민속한마당 매주 토요일과 일요일 박물관 대강당이나 앞마당에 가면 전통 무용에서 굿, 국악, 풍물, 택견, 탈놀이 등 전통에 기반을 둔 공연이 펼쳐진다."
          ],
          [
            "이용요금",
            "무료"
          ],
          [
            "주소",
            "03045 서울 종로구 삼청로 37 (세종로, 국립민속박물관)"
          ]
        ]
      },
      {
        "id": "gyeongbokgung",
        "url": "https://korean.visitseoul.net/attractions/%EA%B2%BD%EB%B3%B5%EA%B6%81/KOP000072",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.579617,
          "lon": 126.977041
        },
        "details": [
          [
            "경복궁의 휴무일은 언제인가요?",
            "경복궁의 정기 휴궁일은 매주 화요일입니다. 공휴일과 휴궁일이 겹칠 경우 개방하며, 이 경우 개방한 공휴일의 다음 첫 번째 비공휴일을 휴궁으로 합니다. (2026년 기준)"
          ],
          [
            "이용시간",
            "1월 ~ 2월 : 09:00~17:00(입장마감 16:00) 3월 ~ 5월 : 09:00~18:00(입장마감 17:00) 6월 ~ 8월 : 09:00~18:30(입장마감 17:30) 9월 ~ 10월 : 09:00~18:00(입장마감 17:00) 11월 ~ 12월 : 09:00~17:00(입장마감 16:00) ※ 기관 사정에 따라 관람시간 단축 및 조정이 있을 수 있습니다."
          ],
          [
            "휴무일",
            "화요일"
          ],
          [
            "운영 요일",
            "수~월"
          ],
          [
            "이용요금",
            "대인, 외국인 대인 : 3,000원 만 24세 이하, 만 65세 이상, 장애인, 유공자 무료 ※ 단체 가격 및 상세 할인혜택은 공식 홈페이지를 참고해주세요."
          ],
          [
            "주소",
            "03045 서울 종로구 사직로 161 (세종로, 경복궁)"
          ]
        ]
      },
      {
        "id": "hwangsaengga",
        "url": "https://korean.visitseoul.net/restaurants/%ED%99%A9%EC%83%9D%EA%B0%80%EC%B9%BC%EA%B5%AD%EC%88%98/KOP003496",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.580078184627475,
          "lon": 126.98066815278152
        },
        "details": [
          [
            "이용시간",
            "11:00 ~ 21:30 (20:30 라스트오더)"
          ],
          [
            "휴무일",
            "연중무휴"
          ],
          [
            "운영 요일",
            "매일"
          ],
          [
            "대표메뉴",
            "사골칼국수, 버섯전골, 왕만두국, 왕만두"
          ],
          [
            "가격대",
            "1만원대"
          ],
          [
            "주소",
            "03053 서울 종로구 북촌로5길 78 (소격동)"
          ]
        ]
      },
      {
        "id": "fritz-wonseo",
        "url": "https://www.fritz.co.kr/store/detail.html?cate_no=125&display_group=1&product_no=2242",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.577669,
          "lon": 126.988491
        },
        "details": [
          [
            "이용시간",
            "월~일 09:00–19:30"
          ],
          [
            "주소",
            "서울시 종로구 율곡로 83"
          ]
        ],
        "coordinateEvidence": "Official store page links Naver map with lng=126.988491&lat=37.577669"
      },
      {
        "id": "mmca-seoul",
        "url": "https://korean.visitseoul.net/area/%EA%B5%AD%EB%A6%BD%ED%98%84%EB%8C%80%EB%AF%B8%EC%88%A0%EA%B4%80-%EC%84%9C%EC%9A%B8%EA%B4%80/KOP011658",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.57862929003526,
          "lon": 126.98008890019835
        },
        "details": [
          [
            "이용시간",
            "월요일, 화요일, 목요일, 금요일, 일요일 : 10:00 ~ 18:00 수요일, 토요일 : 10:00 ~ 21:00 (18:00 ~ 21:00 야간개장) * 발권시간 : 관람종료 1시간 전까지 가능"
          ],
          [
            "휴무일",
            "1월1일, 설날, 추석"
          ],
          [
            "운영 요일",
            "월요일~일요일"
          ],
          [
            "이용요금",
            "관람권 변동 통합관람권 10,000원"
          ],
          [
            "주소",
            "03062 서울 종로구 삼청로 30 (소격동)"
          ]
        ]
      },
      {
        "id": "tosokchon",
        "url": "https://korean.visitseoul.net/restaurants/TosokchonSamgyetang/KOPywjsmm",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.57760304027,
          "lon": 126.971632166657
        },
        "details": [
          [
            "이용시간",
            "10:00-22:00"
          ],
          [
            "운영 요일",
            "매일"
          ],
          [
            "이것만은 꼭!",
            "영어,일본어,중국어 메뉴판 제공"
          ],
          [
            "주소",
            "03041 서울 종로구 자하문로5길 5 (체부동, 토속촌)"
          ]
        ]
      },
      {
        "id": "tongin-market",
        "url": "https://korean.visitseoul.net/attractions/%ED%86%B5%EC%9D%B8%EC%8B%9C%EC%9E%A5/KOP000281",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.58076790578016,
          "lon": 126.9699490933066
        },
        "details": [
          [
            "이용시간",
            "통인시장 영업시간 : 07:00 ~ 21:00 ※ 상점에 따라 상이하며, 정확한 개점, 폐점 시간은 없음 도시락 카페 영업시간 수~월 11:00 ~ 15:00, 토,일 11:00 ~ 16:00"
          ],
          [
            "휴무일",
            "통인시장 휴무일 : 점포별 상이 도시락 카페 휴무일 : 매주 월요일, 매월 셋째주 일요일"
          ],
          [
            "주소",
            "03036 서울 종로구 자하문로15길 18"
          ]
        ]
      },
      {
        "id": "jogyesa",
        "url": "https://korean.visitseoul.net/attractions1/%EC%A1%B0%EA%B3%84%EC%82%AC/KOP002586",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.573878,
          "lon": 126.982295
        },
        "details": [
          [
            "이용시간",
            "법회, 기도 불공 등 사찰 일정에 따라 이용 시간에 차이가 있음"
          ],
          [
            "이것만은 꼭!",
            "연등축제 매년 석가탄신일을 기념하여 조계사와 종로 인근에서 성대하게 펼쳐지는 연등축제는 일반인과 외국인 관광객에게 좋은 볼거리가 되고 있습니다. 다양한 연등축제 행사와 퍼레이드를 놓치지 마세요."
          ],
          [
            "주소",
            "03144 서울특별시 종로구 우정국로 55 (조계사)"
          ]
        ]
      },
      {
        "id": "gyeonghuigung",
        "url": "https://korean.visitseoul.net/attractions/%EA%B2%BD%ED%9D%AC%EA%B6%81/KOP001159",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.572175511252766,
          "lon": 126.96800100114343
        },
        "details": [
          [
            "이용시간",
            "09:00 - 18:00"
          ],
          [
            "휴무일",
            "월요일, 1월 1일"
          ],
          [
            "운영 요일",
            "화요일 ~ 일요일"
          ],
          [
            "이것만은 꼭!",
            "[경희궁 해설안내] - 금요일(오후 2시, 3시), 토요일(오후 1시, 2시, 3시) (한국의재발견 우리궁궐지킴이, 02-723-4206, www.rekor.or.kr) - 일요일(오후 1시, 1시30분, 2시, 2시30분, 3시) (우리문화숨결 궁궐길라잡이, 02-735-5733, www.palaceguide.or.kr)"
          ],
          [
            "이용요금",
            "무료"
          ],
          [
            "주소",
            "03177 서울 종로구 새문안로 45 (경희궁)"
          ]
        ]
      },
      {
        "id": "seoul-history-museum",
        "url": "https://korean.visitseoul.net/attractions/%EC%84%9C%EC%9A%B8%EC%97%AD%EC%82%AC%EB%B0%95%EB%AC%BC%EA%B4%80/KOP002722",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.5705002796,
          "lon": 126.9703743087
        },
        "details": [
          [
            "이용시간",
            "09:00~18:00 (입장마감 17:30) 매주 금요일 21시까지 연장 운영 화, 수, 금, 토, 일 9:00 ~ 21:00 (입장마감 : 20:30) 2026. 9. 15.(화) 부터 11. 30.(월) 까지 야간 개방 확대 운영 * 자세한 사항은 홈페이지를 참고해 주세요."
          ],
          [
            "휴무일",
            "-월요일 -1월 1일"
          ],
          [
            "운영 요일",
            "화요일~일요일"
          ],
          [
            "이용요금",
            "무료"
          ],
          [
            "주소",
            "03177 서울 종로구 새문안로 55 (신문로2가, 서울역사박물관)"
          ]
        ],
        "conditionEvidence": {
          "url": "https://museum.seoul.go.kr/www/guide/vis/infomation.jsp?sso=ok",
          "checkedAt": "2026-10-09",
          "facts": [
            "2026.9.15~11.30 화·수·금·토·일09:00~21:00, 입장20:30",
            "목요일09:00~18:00, 입장17:30",
            "월요일·1월1일 휴관. 월요일이 공휴일이면 개관",
            "관람료 무료: 별도 연령 제한 없음"
          ]
        }
      },
      {
        "id": "bukchon-hanok",
        "url": "https://korean.visitseoul.net/attractions/%EB%B6%81%EC%B4%8C%ED%95%9C%EC%98%A5%EB%A7%88%EC%9D%84/KOP000261",
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinates": {
          "lat": 37.57906987420643,
          "lon": 126.98642849263337
        },
        "details": [
          [
            "이용시간",
            "10:00 ~ 17:00 (제한시간 17:00 ~ 익일 10:00, 제한시간 내 제한구역의 관광객 방문 금지) (한옥 마을은 관광지이기에 앞서 지역 주민들의 거주 공간 입니다.)"
          ],
          [
            "휴무일",
            "연중무휴"
          ],
          [
            "운영 요일",
            "매일"
          ],
          [
            "주소",
            "03059 서울 종로구 계동길 37 북촌문화센터 일대 (계동)"
          ]
        ]
      },
      {
        "id": "gyeonghuigung-last-entry",
        "url": "https://data.visitkorea.or.kr/linkedview/1604784",
        "checkedAt": "2026-10-09",
        "facts": [
          "일반 관람 09:00~18:00 · 입장마감 17:30"
        ]
      },
      {
        "id": "jogyesa-fee",
        "url": "https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=b434467f-d98b-49be-9cae-c7c1cec29f8c",
        "checkedAt": "2026-10-09",
        "facts": [
          "경내 방문 무료 안내. 프로그램 별도."
        ]
      },
      {
        "id": "imun-seolnongtang",
        "url": "https://big5chinese.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=99780",
        "coordinates": {
          "lat": 37.57276066579764,
          "lon": 126.98389816796981
        },
        "details": [
          [
            "주소",
            "서울 종로구 우정국로 38-13"
          ],
          [
            "운영",
            "월~토 08:00~21:00, 일 08:00~20:00; 매일 15:00~16:30 휴식; 점심 주문14:30, 저녁 월~토20:30/일19:30; 재료 소진 시 조기마감"
          ],
          [
            "대표 메뉴",
            "설농탕·도가니탕·머리탕·수육. 공식 표시가격 미확인"
          ]
        ],
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinateEvidence": "한국관광공사 장소 안내 HTML의 GeoCoordinates 및 지도 lat/lot. 장소 대표점으로 입구 실측 아님"
      },
      {
        "id": "gwanghwamun-mijin",
        "url": "https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=82484",
        "coordinates": {
          "lat": 37.57084452357933,
          "lon": 126.97992365586322
        },
        "details": [
          [
            "주소",
            "서울 종로구 종로 19"
          ],
          [
            "운영",
            "10:30~21:00, 마지막 주문20:30; 연중무휴 안내"
          ],
          [
            "대표 메뉴",
            "냉메밀·메밀전병·보쌈정식·돌우동. 공식 표시가격 미확인"
          ]
        ],
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinateEvidence": "한국관광공사 장소 안내 HTML의 GeoCoordinates 및 지도 lat/lot. 장소 대표점으로 입구 실측 아님"
      },
      {
        "id": "onion-anguk",
        "url": "https://chinese.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=191233",
        "coordinates": {
          "lat": 37.5775179548045,
          "lon": 126.986675890193
        },
        "details": [
          [
            "주소",
            "서울 종로구 계동길 5"
          ],
          [
            "운영",
            "평일07:00~22:00, 주말09:00~22:00; 연중무휴 안내"
          ],
          [
            "대표 메뉴",
            "바닐라빈 라테·판도로·소금빵·아메리카노. 공식 표시가격 미확인"
          ]
        ],
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinateEvidence": "한국관광공사 장소 안내 HTML의 GeoCoordinates 및 지도 lat/lot. 장소 대표점으로 입구 실측 아님"
      },
      {
        "id": "beautiful-tea-museum",
        "url": "https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=104043",
        "coordinates": {
          "lat": 37.5723102414532,
          "lon": 126.985842786834
        },
        "details": [
          [
            "주소",
            "서울 종로구 인사동길 19-11"
          ],
          [
            "운영",
            "관광공사 박물관 안내11:30~20:00/연중무휴와 별도 다원 안내10:30~21:50/명절휴무가 다름; 다원 시간 판정은 미확인"
          ],
          [
            "요금",
            "박물관 입장 무료와 다원 주문비는 별개; 카페 이용은 1인1메뉴 주문. 차 가격 미확인"
          ]
        ],
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinateEvidence": "한국관광공사 장소 안내 HTML의 GeoCoordinates 및 지도 lat/lot. 장소 대표점으로 입구 실측 아님"
      },
      {
        "id": "national-museum-contemporary-history",
        "url": "https://www.much.go.kr/MUCH/contents/M01020100000.do",
        "coordinateSourceUrl": "https://korean.visitseoul.net/attractions/대한민국역사박물관/KOP006667",
        "coordinates": {
          "lat": 37.573834870218086,
          "lon": 126.97769503939544
        },
        "details": [
          [
            "주소",
            "서울 종로구 세종대로 198"
          ],
          [
            "운영",
            "월·화·목·금·일10:00~18:00, 수·토10:00~21:00; 입장마감30분전; 1월1일·설날당일·추석당일휴관"
          ],
          [
            "요금",
            "일반관람 무료. 연령 제한 없음"
          ],
          [
            "편의시설",
            "1층 안내데스크에서 신분증 보관 후 유모차·휠체어 무료 대여; 유모차36개월이하 증빙 필요; 실내사용 한정"
          ]
        ],
        "httpStatus": 200,
        "checkedAt": "2026-10-09",
        "coordinateEvidence": "서울관광재단 장소 안내 HTML 지도 lat/lng. 공식 박물관 주소와 일치"
      }
    ]);
    PHOTO_CREDITS = Object.freeze([
      {
        "id": "gyeongbokgung",
        "title": "File:Gyeonghoeru (Royal Banquet Hall) at Gyeongbokgung Palace, Seoul.jpg",
        "src": "./assets/places/gyeongbokgung.jpg",
        "alt": "Royal Banquet Hall Gyeonghoeru (경회루) at Gyeongbokgung Palace (경복궁), Seoul",
        "author": "Frank Schulenburg",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Gyeonghoeru_(Royal_Banquet_Hall)_at_Gyeongbokgung_Palace,_Seoul.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/5/5d/Gyeonghoeru_%28Royal_Banquet_Hall%29_at_Gyeongbokgung_Palace%2C_Seoul.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Gyeonghoeru_%28Royal_Banquet_Hall%29_at_Gyeongbokgung_Palace%2C_Seoul.jpg/960px-Gyeonghoeru_%28Royal_Banquet_Hall%29_at_Gyeongbokgung_Palace%2C_Seoul.jpg",
        "photographedAt": "Taken on 5 November 2018, 12:59:48",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 155689,
        "sha256": "e7f309e5a7ce61c540bc21d9e26ecf01bb9167ce2bde047f90fe244e5317f50b",
        "visuallyReviewed": true
      },
      {
        "id": "seoul-museum-craft-art",
        "title": "File:Seoul Museum of Craft Art.jpg",
        "src": "./assets/places/seoul-museum-craft-art.jpg",
        "alt": "서울공예박물관",
        "author": "*Youngjin",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Seoul_Museum_of_Craft_Art.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Seoul_Museum_of_Craft_Art.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Seoul_Museum_of_Craft_Art.jpg/960px-Seoul_Museum_of_Craft_Art.jpg",
        "photographedAt": "2024-11-22 13:15:40",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 160983,
        "sha256": "144bb04a4d19f9b0f7741b8043c24dccab6a0c4804408d70fc4af77288ccda2f",
        "visuallyReviewed": true
      },
      {
        "id": "national-folk-museum",
        "title": "File:Folk Museum of Korea.jpg",
        "src": "./assets/places/national-folk-museum.jpg",
        "alt": "On the Kyongbokkung palace grounds",
        "author": "Julian Fong",
        "license": "CC BY-SA 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Folk_Museum_of_Korea.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/b/bf/Folk_Museum_of_Korea.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Folk_Museum_of_Korea.jpg/960px-Folk_Museum_of_Korea.jpg",
        "photographedAt": "2001-05-18 18:23",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 218228,
        "sha256": "afca304799d99a1e13eaeff21c1fb38dda5e4d61841b8b3f87dd07fdc3893821",
        "visuallyReviewed": true
      },
      {
        "id": "unhyeongung",
        "title": "File:Iro-dang, Unhyeongung - Seoul, Korea.JPG",
        "src": "./assets/places/unhyeongung.jpg",
        "alt": "Iro-dang, Unhyeongung - Seoul, Korea.",
        "author": "Daderot.",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Iro-dang,_Unhyeongung_-_Seoul,_Korea.JPG",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Iro-dang%2C_Unhyeongung_-_Seoul%2C_Korea.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Iro-dang%2C_Unhyeongung_-_Seoul%2C_Korea.JPG/960px-Iro-dang%2C_Unhyeongung_-_Seoul%2C_Korea.JPG",
        "photographedAt": "2006-08-30",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 223755,
        "sha256": "5bf5fd84df6cccc3bb22f35a0e2fa659c46342ab3fd72b5838f7a2f8e8e23800",
        "visuallyReviewed": true
      },
      {
        "id": "changgyeonggung",
        "title": "File:Changgyeonggung Palace, Seoul (48732816383).jpg",
        "src": "./assets/places/changgyeonggung.jpg",
        "alt": "Changgyeonggung Palace, Seoul",
        "author": "Matt Kieffer from London, United Kingdom",
        "license": "CC BY-SA 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Changgyeonggung_Palace,_Seoul_(48732816383).jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Changgyeonggung_Palace%2C_Seoul_%2848732816383%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Changgyeonggung_Palace%2C_Seoul_%2848732816383%29.jpg/960px-Changgyeonggung_Palace%2C_Seoul_%2848732816383%29.jpg",
        "photographedAt": "2019-04-12 14:45",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 565666,
        "sha256": "9c1f4e2159d131220eba029f08688745e52cf598cd8e916dfb6be62d7e31bbf7",
        "visuallyReviewed": true
      },
      {
        "id": "seoul-history-museum",
        "title": "File:서울역사박물관.jpg",
        "src": "./assets/places/seoul-history-museum.jpg",
        "alt": "This is a front view photo of 'Seoul Museum of History', pictured by the Seoul Institute in March 2020.",
        "author": "서울연구원",
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:%EC%84%9C%EC%9A%B8%EC%97%AD%EC%82%AC%EB%B0%95%EB%AC%BC%EA%B4%80.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/7/78/%EC%84%9C%EC%9A%B8%EC%97%AD%EC%82%AC%EB%B0%95%EB%AC%BC%EA%B4%80.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/%EC%84%9C%EC%9A%B8%EC%97%AD%EC%82%AC%EB%B0%95%EB%AC%BC%EA%B4%80.jpg/960px-%EC%84%9C%EC%9A%B8%EC%97%AD%EC%82%AC%EB%B0%95%EB%AC%BC%EA%B4%80.jpg",
        "photographedAt": "2020-03-11 12:46:43",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 212237,
        "sha256": "ad2c07ede7d3ae903a4410a7ad23944d28c767f052f85ffca5be5ad50397a0bd",
        "visuallyReviewed": true
      },
      {
        "id": "mmca-seoul",
        "title": "File:MMCA Seoul.jpg",
        "src": "./assets/places/mmca-seoul.jpg",
        "alt": "A photo showing front facade view of 'National Museum of Modern and Contemporary Art, Korea' (MMCA) Seoul branch",
        "author": "서울연구원",
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:MMCA_Seoul.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/a/a9/MMCA_Seoul.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/MMCA_Seoul.jpg/960px-MMCA_Seoul.jpg",
        "photographedAt": "2020-02-18 17:15:02",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 191686,
        "sha256": "951e5c50a4e7071c3613b6c35b08d01685bc7d2d4487adf8f8a420b816201d96",
        "visuallyReviewed": true
      },
      {
        "id": "gyeonghuigung",
        "title": "File:Korea-Gyeonghuigung-01.jpg",
        "src": "./assets/places/gyeonghuigung.jpg",
        "alt": "경희궁 숭정문",
        "author": "Jtm71",
        "license": "CC BY 2.0 KR",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/kr/",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Korea-Gyeonghuigung-01.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Korea-Gyeonghuigung-01.jpg",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/Korea-Gyeonghuigung-01.jpg/960px-Korea-Gyeonghuigung-01.jpg",
        "photographedAt": "2005-08-16",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 103353,
        "sha256": "1fb3e27718b1d307f927156dc964c9c9db9b83efb46fea4c4da89972f4754258",
        "visuallyReviewed": true
      },
      {
        "id": "jogyesa",
        "title": "File:Jogyesa Temple (1509839597).jpg",
        "src": "./assets/places/jogyesa.jpg",
        "alt": "Jogyesa Temple",
        "author": "Francisco Anzola",
        "license": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jogyesa_Temple_(1509839597).jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Jogyesa_Temple_%281509839597%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Jogyesa_Temple_%281509839597%29.jpg/960px-Jogyesa_Temple_%281509839597%29.jpg",
        "photographedAt": "2007-08-29 00:59",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 292570,
        "sha256": "7a7d486dbc4ff200b7f95cf89dcab6d9f568e63c8037fa2fdf1e342c3d543ebd",
        "visuallyReviewed": true
      },
      {
        "id": "bukchon-hanok",
        "title": "File:Traditional hanok houses at golden hour in Bukchon Hanok Village in Seoul.jpg",
        "src": "./assets/places/bukchon-hanok.jpg",
        "alt": "Traditional hanok houses, showing Korean architecture under a blue sky at golden hour in the morning, in Bukchon Hanok Village, Seoul, South Korea.",
        "author": "Basile Morin",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Traditional_hanok_houses_at_golden_hour_in_Bukchon_Hanok_Village_in_Seoul.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Traditional_hanok_houses_at_golden_hour_in_Bukchon_Hanok_Village_in_Seoul.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Traditional_hanok_houses_at_golden_hour_in_Bukchon_Hanok_Village_in_Seoul.jpg/960px-Traditional_hanok_houses_at_golden_hour_in_Bukchon_Hanok_Village_in_Seoul.jpg",
        "photographedAt": "2024-06-04 06:21:18",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 152053,
        "sha256": "71dd8eb49bc16ebd485214516dc0ce27cd1fd4393dd9dc08717e1104e23cfd29",
        "visuallyReviewed": true
      },
      {
        "id": "tongin-market",
        "title": "File:Lunch cafe in Tongin Market.jpg",
        "src": "./assets/places/tongin-market.jpg",
        "alt": "Lunch cafe",
        "author": "Luvepoli",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Lunch_cafe_in_Tongin_Market.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/9/95/Lunch_cafe_in_Tongin_Market.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        "downloadUrl": "https://upload.wikimedia.org/wikipedia/commons/9/95/Lunch_cafe_in_Tongin_Market.jpg",
        "photographedAt": "2015-12-14",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 238104,
        "sha256": "91131c22d36a49f97a01b3650f28f884c69fdc6df5e930a31dbba8b7d578da59",
        "visuallyReviewed": true
      },
      {
        "id": "imun-seolnongtang",
        "title": "File:Imun Seolnongtang 01.jpg",
        "src": "./assets/places/imun-seolnongtang.jpg",
        "alt": "이문설농탕 건물 입구와 간판",
        "author": "Seefooddiet",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:Imun_Seolnongtang_01.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/0/07/Imun_Seolnongtang_01.jpg",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Imun_Seolnongtang_01.jpg/960px-Imun_Seolnongtang_01.jpg",
        "photographedAt": "2024-07-16 18:43:47",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 281812,
        "sha256": "3c1b608414cd6b9ef6a526ee8f2ac174b348e4ad8b0be203f5e58af36c8ae67a",
        "visuallyReviewed": true
      },
      {
        "id": "national-museum-contemporary-history",
        "title": "File:20240413 National Museum of Korean Contemporary History.jpg",
        "src": "./assets/places/national-museum-contemporary-history.jpg",
        "alt": "대한민국역사박물관 건물 외관",
        "author": "Jjw",
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:20240413_National_Museum_of_Korean_Contemporary_History.jpg",
        "originalUrl": "https://upload.wikimedia.org/wikipedia/commons/3/3e/20240413_National_Museum_of_Korean_Contemporary_History.jpg",
        "downloadUrl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/20240413_National_Museum_of_Korean_Contemporary_History.jpg/960px-20240413_National_Museum_of_Korean_Contemporary_History.jpg",
        "photographedAt": "2024-04-13 13:49:31",
        "checkedAt": "2026-10-09",
        "modifications": "Wikimedia 960px thumbnail; otherwise unmodified",
        "bytes": 206986,
        "sha256": "296d3ce00474d4c7042a37ae442e21199262ae2c2269ab8cd6e322641674737b",
        "visuallyReviewed": true
      }
    ]);
    BASE_PROPERTIES = {
      "gaeseong-mandu-koong": {
        "area": "인사동",
        "features": {
          "indoor": true,
          "food": true,
          "koreanFood": true,
          "dumplings": true
        },
        "planningStayMinutes": 60
      },
      "balwoo-gongyang": {
        "area": "인사동",
        "features": {
          "indoor": true,
          "food": true,
          "templeFood": true,
          "koreanFood": true
        },
        "planningStayMinutes": 90
      },
      "kyungin-traditional-teahouse": {
        "area": "인사동",
        "features": {
          "tea": true,
          "traditionalTea": true,
          "hanok": true
        },
        "planningStayMinutes": 45
      },
      "osulloc-bukchon": {
        "area": "북촌",
        "features": {
          "indoor": true,
          "tea": true,
          "teaTasting": true
        },
        "planningStayMinutes": 45
      },
      "seoul-museum-craft-art": {
        "area": "안국",
        "features": {
          "indoor": true,
          "culture": true,
          "art": true,
          "craft": true,
          "museum": true
        },
        "planningStayMinutes": 75
      },
      "unhyeongung": {
        "area": "안국",
        "features": {
          "outdoor": true,
          "indoor": false,
          "culture": true,
          "history": true,
          "palace": true,
          "walk": true
        },
        "planningStayMinutes": 45
      },
      "gyeongbokgung": {
        "area": "광화문",
        "features": {
          "outdoor": true,
          "indoor": false,
          "culture": true,
          "history": true,
          "palace": true,
          "walk": true
        },
        "planningStayMinutes": 90
      },
      "changgyeonggung": {
        "area": "창경궁",
        "features": {
          "outdoor": true,
          "culture": true,
          "history": true,
          "palace": true,
          "walk": true
        },
        "planningStayMinutes": 75
      },
      "national-folk-museum": {
        "area": "삼청",
        "features": {
          "indoor": true,
          "culture": true,
          "history": true,
          "museum": true
        },
        "planningStayMinutes": 75
      },
      "nine-tree-insadong": {
        "area": "인사동",
        "features": {
          "indoor": true,
          "hotel": true
        },
        "planningStayMinutes": 0
      },
      "orakai-insadong-suites": {
        "area": "인사동",
        "features": {
          "indoor": true,
          "hotel": true
        },
        "planningStayMinutes": 0
      }
    };
    EXTRA_PLACES = [
      {
        "id": "hwangsaengga",
        "name": "황생가칼국수",
        "category": "food",
        "area": "삼청·북촌",
        "address": "서울 종로구 북촌로5길 78",
        "description": "사골칼국수와 왕만두를 고를 수 있는 한식당. 국립현대미술관 서울관 옆 식사 후보예요.",
        "features": {
          "indoor": true,
          "food": true,
          "noodles": true,
          "koreanFood": true
        },
        "planningStayMinutes": 60,
        "weekly": {
          "0": [
            {
              "open": "11:00",
              "close": "21:30",
              "lastEntry": "20:30"
            }
          ],
          "1": [
            {
              "open": "11:00",
              "close": "21:30",
              "lastEntry": "20:30"
            }
          ],
          "2": [
            {
              "open": "11:00",
              "close": "21:30",
              "lastEntry": "20:30"
            }
          ],
          "3": [
            {
              "open": "11:00",
              "close": "21:30",
              "lastEntry": "20:30"
            }
          ],
          "4": [
            {
              "open": "11:00",
              "close": "21:30",
              "lastEntry": "20:30"
            }
          ],
          "5": [
            {
              "open": "11:00",
              "close": "21:30",
              "lastEntry": "20:30"
            }
          ],
          "6": [
            {
              "open": "11:00",
              "close": "21:30",
              "lastEntry": "20:30"
            }
          ]
        },
        "openingNote": "매일 11:00~21:30 · 마지막 주문 20:30",
        "costNote": "공식 관광 안내는 1만원대. 메뉴별 현재 가격은 확인이 필요해요.",
        "unknowns": [
          "메뉴별 현재 가격",
          "실제 대기시간",
          "식이·알레르기 충족",
          "계단 없는 전체 동선"
        ]
      },
      {
        "id": "tosokchon",
        "name": "토속촌삼계탕",
        "category": "food",
        "area": "서촌",
        "address": "서울 종로구 자하문로5길 5",
        "description": "경복궁 서쪽의 한옥 삼계탕 전문점. 삼계탕 중심의 식사를 원하는 날 비교할 수 있어요.",
        "features": {
          "indoor": true,
          "food": true,
          "koreanFood": true,
          "chicken": true
        },
        "planningStayMinutes": 60,
        "weekly": {
          "0": [
            {
              "open": "10:00",
              "close": "22:00"
            }
          ],
          "1": [
            {
              "open": "10:00",
              "close": "22:00"
            }
          ],
          "2": [
            {
              "open": "10:00",
              "close": "22:00"
            }
          ],
          "3": [
            {
              "open": "10:00",
              "close": "22:00"
            }
          ],
          "4": [
            {
              "open": "10:00",
              "close": "22:00"
            }
          ],
          "5": [
            {
              "open": "10:00",
              "close": "22:00"
            }
          ],
          "6": [
            {
              "open": "10:00",
              "close": "22:00"
            }
          ]
        },
        "openingNote": "매일 10:00~22:00 · 주문 마감은 확인 필요",
        "costNote": "메뉴별 현재 가격 확인 필요",
        "unknowns": [
          "현재 메뉴 가격",
          "마지막 주문시간",
          "실제 대기시간",
          "식이·알레르기 충족"
        ]
      },
      {
        "id": "tongin-market",
        "name": "통인시장",
        "category": "food",
        "area": "서촌",
        "address": "서울 종로구 자하문로15길 18",
        "description": "여러 점포의 음식을 직접 골라 보는 전통시장. 도시락 카페의 이용일과 참여 점포는 방문 전에 확인해 주세요.",
        "features": {
          "food": true,
          "market": true,
          "koreanFood": true
        },
        "planningStayMinutes": 60,
        "weekly": {},
        "openingNote": "시장 안내 07:00~21:00, 점포별 상이. 도시락 카페 요일 안내에 상충이 있어 방문 전 확인이 필요해요.",
        "costNote": "고른 음식·점포에 따라 달라요. 시장 입장과 식사비는 별개예요.",
        "unknowns": [
          "방문일의 개별 점포 운영",
          "도시락 카페 휴무 안내 상충",
          "식사 전체 금액",
          "실제 대기시간"
        ]
      },
      {
        "id": "fritz-wonseo",
        "name": "프릳츠 원서",
        "category": "tea",
        "area": "안국·원서",
        "address": "서울 종로구 율곡로 83",
        "description": "원서동에서 커피와 빵을 고르는 쉬는 구간. 매장 공식 안내의 주소·운영시간으로 연결해요.",
        "features": {
          "indoor": true,
          "tea": true,
          "coffee": true,
          "bakery": true
        },
        "planningStayMinutes": 45,
        "weekly": {
          "0": [
            {
              "open": "09:00",
              "close": "19:30"
            }
          ],
          "1": [
            {
              "open": "09:00",
              "close": "19:30"
            }
          ],
          "2": [
            {
              "open": "09:00",
              "close": "19:30"
            }
          ],
          "3": [
            {
              "open": "09:00",
              "close": "19:30"
            }
          ],
          "4": [
            {
              "open": "09:00",
              "close": "19:30"
            }
          ],
          "5": [
            {
              "open": "09:00",
              "close": "19:30"
            }
          ],
          "6": [
            {
              "open": "09:00",
              "close": "19:30"
            }
          ]
        },
        "openingNote": "월~일 09:00~19:30",
        "costNote": "음료·빵의 현재 매장 가격 확인 필요",
        "unknowns": [
          "현재 메뉴 가격",
          "좌석 여유",
          "계단 없는 전체 동선"
        ]
      },
      {
        "id": "mmca-seoul",
        "name": "국립현대미술관 서울",
        "category": "culture",
        "area": "삼청·북촌",
        "address": "서울 종로구 삼청로 30",
        "description": "현대미술 전시를 중심에 두고 싶은 날의 선택. 전시마다 관람권과 운영 조건이 달라질 수 있어요.",
        "features": {
          "indoor": true,
          "culture": true,
          "art": true,
          "museum": true
        },
        "planningStayMinutes": 90,
        "weekly": {
          "0": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "1": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "2": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "3": [
            {
              "open": "10:00",
              "close": "21:00",
              "lastEntry": "20:00"
            }
          ],
          "4": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "5": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:00"
            }
          ],
          "6": [
            {
              "open": "10:00",
              "close": "21:00",
              "lastEntry": "20:00"
            }
          ]
        },
        "openingNote": "월·화·목·금·일 10:00~18:00, 수·토 10:00~21:00 · 발권은 종료 1시간 전까지. 1월 1일·설·추석 휴관.",
        "costNote": "공식 관광 안내 통합관람권 10,000원. 전시별 권종·무료 대상 확인 필요",
        "unknowns": [
          "선택 전시의 관람권 범위",
          "무료·할인 자격",
          "당일 예약 가능 여부"
        ],
        "price": {
          "kind": "sample",
          "amount": 1e4,
          "label": "통합관람권 표시금액",
          "scope": "adult-one",
          "taxStatus": "not-stated",
          "note": "전시별 관람권이 변동될 수 있어 공식 예매에서 선택 전시를 확인해야 함"
        }
      },
      {
        "id": "seoul-history-museum",
        "name": "서울역사박물관",
        "category": "culture",
        "area": "광화문·서촌",
        "address": "서울 종로구 새문안로 55",
        "description": "서울의 도시 역사와 생활의 변화를 실내 전시로 보는 박물관. 경희궁과 함께 비교하기 좋아요.",
        "features": {
          "indoor": true,
          "culture": true,
          "history": true,
          "museum": true
        },
        "planningStayMinutes": 75,
        "weekly": {
          "0": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "1": [],
          "2": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "3": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "4": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "5": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "6": [
            {
              "open": "09:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ]
        },
        "openingNote": "2026.9.15~11.30 화·수·금·토·일 09:00~21:00(입장20:30), 목요일09:00~18:00(입장17:30). 월요일·1월1일 휴관, 공휴일인 월요일은 정상 개관하므로 공휴일 방문은 별도 확인.",
        "costNote": "일반 관람 무료 · 별도 프로그램은 확인 필요",
        "unknowns": [
          "방문일의 특별 프로그램 예약",
          "전시별 일부 공간 운영"
        ],
        "price": {
          "kind": "free",
          "amount": 0,
          "label": "일반 관람",
          "scope": "adult-one",
          "taxStatus": "included",
          "note": "일반 관람 무료. 별도 체험·유료 프로그램은 포함하지 않음",
          "sourceUrl": "https://museum.seoul.go.kr/www/guide/vis/infomation.jsp?sso=ok"
        },
        "hours": {
          "validFrom": "2026-09-15",
          "validThrough": "2026-11-30",
          "sourceUrl": "https://museum.seoul.go.kr/www/guide/vis/infomation.jsp?sso=ok"
        },
        "childPrice": {
          "allChildren": true,
          "kind": "free",
          "amount": 0,
          "label": "일반 관람",
          "scope": "child-one",
          "taxStatus": "included",
          "sourceUrl": "https://museum.seoul.go.kr/www/guide/vis/infomation.jsp?sso=ok",
          "verifiedAt": "2026-10-09",
          "note": "공식 관람료 무료 안내에 연령 제한 없음. 별도 체험·유료 프로그램 제외"
        }
      },
      {
        "id": "gyeonghuigung",
        "name": "경희궁",
        "category": "culture",
        "area": "광화문·서촌",
        "address": "서울 종로구 새문안로 45",
        "description": "숭정전과 복원된 궁궐 전각을 따라 걷는 야외 역사 공간. 비와 더위에 따라 체류를 조절해 주세요.",
        "features": {
          "outdoor": true,
          "indoor": false,
          "culture": true,
          "history": true,
          "walk": true,
          "palace": true
        },
        "planningStayMinutes": 50,
        "weekly": {
          "0": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "1": [],
          "2": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "3": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "4": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "5": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "6": [
            {
              "open": "09:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ]
        },
        "openingNote": "화~일 09:00~18:00 · 입장마감 17:30 · 월요일·1월 1일 휴관",
        "costNote": "일반 관람 무료",
        "unknowns": [
          "행사·공사에 따른 부분 출입",
          "계단 없는 전체 동선"
        ],
        "price": {
          "kind": "free",
          "amount": 0,
          "label": "일반 관람",
          "scope": "adult-one",
          "taxStatus": "included",
          "note": "일반 관람 무료"
        }
      },
      {
        "id": "jogyesa",
        "name": "조계사",
        "category": "culture",
        "area": "인사동",
        "address": "서울 종로구 우정국로 55",
        "description": "도심 사찰의 경내와 대웅전을 살펴보는 구간. 예불·법회 중에는 참배와 방문 동선의 안내를 따라 주세요.",
        "features": {
          "outdoor": true,
          "culture": true,
          "history": true,
          "temple": true
        },
        "planningStayMinutes": 35,
        "weekly": {},
        "openingNote": "법회·기도 등 사찰 일정에 따라 이용시간이 달라요.",
        "costNote": "경내 방문 무료 안내 · 체험·템플스테이는 별도",
        "unknowns": [
          "당일 사찰행사와 개방 범위",
          "체험 예약·비용",
          "혼잡과 소음"
        ],
        "price": {
          "kind": "free",
          "amount": 0,
          "label": "경내 방문",
          "scope": "adult-one",
          "taxStatus": "included",
          "sourceUrl": "https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=b434467f-d98b-49be-9cae-c7c1cec29f8c",
          "note": "경내 방문 범위. 체험·템플스테이·기부는 포함하지 않음"
        }
      },
      {
        "id": "bukchon-hanok",
        "name": "북촌 한옥마을",
        "category": "culture",
        "area": "북촌",
        "address": "서울 종로구 계동길 37 북촌문화센터 일대",
        "description": "한옥과 골목을 걸으며 보는 주거지역. 주민의 생활공간이므로 낮 시간에 조용히 방문해 주세요.",
        "features": {
          "outdoor": true,
          "indoor": false,
          "culture": true,
          "history": true,
          "walk": true,
          "hanok": true
        },
        "planningStayMinutes": 50,
        "weekly": {
          "0": [
            {
              "open": "10:00",
              "close": "17:00"
            }
          ],
          "1": [
            {
              "open": "10:00",
              "close": "17:00"
            }
          ],
          "2": [
            {
              "open": "10:00",
              "close": "17:00"
            }
          ],
          "3": [
            {
              "open": "10:00",
              "close": "17:00"
            }
          ],
          "4": [
            {
              "open": "10:00",
              "close": "17:00"
            }
          ],
          "5": [
            {
              "open": "10:00",
              "close": "17:00"
            }
          ],
          "6": [
            {
              "open": "10:00",
              "close": "17:00"
            }
          ]
        },
        "openingNote": "관광객 방문 제한구역은 10:00~17:00만 방문 가능. 제한시간 17:00~다음날 10:00에는 방문하지 않아요.",
        "costNote": "골목 산책에 별도 입장권을 포함하지 않아요. 실내 체험·상점은 별도 확인.",
        "unknowns": [
          "실제 골목별 경사·보행 난이도",
          "방문일 제한구역 변경",
          "실내 체험 이용료"
        ]
      },
      {
        "id": "imun-seolnongtang",
        "name": "이문설농탕",
        "category": "food",
        "area": "인사동·종각",
        "address": "서울 종로구 우정국로 38-13",
        "description": "설농탕과 도가니탕을 안내하는 국물 식사 후보예요. 오후 준비시간을 피해 방문 계획을 세울 수 있어요.",
        "features": {
          "indoor": true,
          "food": true,
          "koreanFood": true
        },
        "planningStayMinutes": 55,
        "weekly": {
          "0": [
            {
              "open": "08:00",
              "close": "15:00",
              "lastEntry": "14:30"
            },
            {
              "open": "16:30",
              "close": "20:00",
              "lastEntry": "19:30"
            }
          ],
          "1": [
            {
              "open": "08:00",
              "close": "15:00",
              "lastEntry": "14:30"
            },
            {
              "open": "16:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "2": [
            {
              "open": "08:00",
              "close": "15:00",
              "lastEntry": "14:30"
            },
            {
              "open": "16:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "3": [
            {
              "open": "08:00",
              "close": "15:00",
              "lastEntry": "14:30"
            },
            {
              "open": "16:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "4": [
            {
              "open": "08:00",
              "close": "15:00",
              "lastEntry": "14:30"
            },
            {
              "open": "16:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "5": [
            {
              "open": "08:00",
              "close": "15:00",
              "lastEntry": "14:30"
            },
            {
              "open": "16:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "6": [
            {
              "open": "08:00",
              "close": "15:00",
              "lastEntry": "14:30"
            },
            {
              "open": "16:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ]
        },
        "openingNote": "매일15:00~16:30 준비시간. 재료소진 조기마감은 실시간 확인 불가",
        "costNote": "메뉴별 현재 가격 미확인"
      },
      {
        "id": "gwanghwamun-mijin",
        "name": "광화문 미진",
        "category": "food",
        "area": "광화문·종각",
        "address": "서울 종로구 종로 19",
        "description": "한국식 냉메밀과 메밀전병을 소개하는 식당이에요. 궁궐 남쪽에서 면 요리를 고를 때의 대안이에요.",
        "features": {
          "indoor": true,
          "food": true,
          "koreanFood": true
        },
        "planningStayMinutes": 55,
        "weekly": {
          "0": [
            {
              "open": "10:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "1": [
            {
              "open": "10:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "2": [
            {
              "open": "10:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "3": [
            {
              "open": "10:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "4": [
            {
              "open": "10:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "5": [
            {
              "open": "10:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "6": [
            {
              "open": "10:30",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ]
        },
        "openingNote": "10:30~21:00·주문마감20:30. 당일 변경 별도 확인",
        "costNote": "메뉴별 현재 가격 미확인"
      },
      {
        "id": "onion-anguk",
        "name": "어니언 안국",
        "category": "tea",
        "area": "북촌·안국",
        "address": "서울 종로구 계동길 5",
        "description": "한옥 공간에서 커피와 판도로·소금빵을 소개하는 카페예요. 빵의 당일 종류와 재고는 확인이 필요해요.",
        "features": {
          "indoor": true,
          "tea": true
        },
        "planningStayMinutes": 50,
        "weekly": {
          "0": [
            {
              "open": "09:00",
              "close": "22:00"
            }
          ],
          "1": [
            {
              "open": "07:00",
              "close": "22:00"
            }
          ],
          "2": [
            {
              "open": "07:00",
              "close": "22:00"
            }
          ],
          "3": [
            {
              "open": "07:00",
              "close": "22:00"
            }
          ],
          "4": [
            {
              "open": "07:00",
              "close": "22:00"
            }
          ],
          "5": [
            {
              "open": "07:00",
              "close": "22:00"
            }
          ],
          "6": [
            {
              "open": "09:00",
              "close": "22:00"
            }
          ]
        },
        "openingNote": "평일07:00~22:00·주말09:00~22:00. 주문마감 미확인",
        "costNote": "음료·베이커리 가격 및 추가주문 금액 미확인"
      },
      {
        "id": "beautiful-tea-museum",
        "name": "아름다운 차박물관 다원",
        "category": "tea",
        "area": "인사동",
        "address": "서울 종로구 인사동길 19-11",
        "description": "차 관련 전시와 함께 전통차를 소개하는 다원이에요. 이 일정은 차 주문을 포함하는 다원 방문으로, 무료 입장과 별도로 비용을 확인해요.",
        "features": {
          "indoor": true,
          "tea": true
        },
        "planningStayMinutes": 50,
        "weekly": {},
        "openingNote": "박물관과 별도 다원 안내의 운영시간·명절휴무 표기가 달라 방문일 확인 필요",
        "costNote": "박물관 입장 무료와 별개로 다원은 1인1메뉴. 메뉴가격 미확인"
      },
      {
        "id": "national-museum-contemporary-history",
        "name": "대한민국역사박물관",
        "category": "culture",
        "area": "광화문",
        "address": "서울 종로구 세종대로 198",
        "description": "한국 근현대사 전시를 볼 수 있는 무료 박물관이에요. 수요일과 토요일은 야간 관람 시간도 안내돼 있어요.",
        "features": {
          "indoor": true,
          "culture": true,
          "museum": true,
          "history": true
        },
        "planningStayMinutes": 75,
        "weekly": {
          "0": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "1": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "2": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "3": [
            {
              "open": "10:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ],
          "4": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "5": [
            {
              "open": "10:00",
              "close": "18:00",
              "lastEntry": "17:30"
            }
          ],
          "6": [
            {
              "open": "10:00",
              "close": "21:00",
              "lastEntry": "20:30"
            }
          ]
        },
        "openingNote": "수·토21:00, 그 외18:00 폐관·입장30분전마감. 1월1일·설날당일·추석당일휴관. 공휴일 예외 별도 확인",
        "costNote": "일반 관람 무료",
        "price": {
          "kind": "free",
          "label": "일반 관람",
          "scope": "adult-one",
          "amount": 0,
          "taxStatus": "included",
          "note": "별도 프로그램·구매·대관 비용 제외"
        },
        "childPrice": {
          "allChildren": true,
          "kind": "free",
          "amount": 0,
          "label": "일반 관람",
          "scope": "child-one",
          "taxStatus": "included",
          "sourceUrl": "https://www.much.go.kr/MUCH/contents/M01020100000.do",
          "verifiedAt": "2026-10-09",
          "note": "일반관람 무료 안내에 연령제한 없음. 별도 예약 프로그램 제외"
        }
      }
    ];
    PERSONALIZATION_TAGS = Object.freeze(["noodles", "dumplings", "soup", "templeFood", "marketFood", "coffee", "bakery", "traditionalTea"]);
    detailCheckedAt = "2026-10-09";
    detailUrls = {
      koongMenu: "https://www.koong.co.kr/2020/menuinfo/meals.php",
      koongVisit: "https://www.koong.co.kr/2020/storeinfo/headoffice.php",
      balwoo: "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
      balwooVisit: "http://balwoo.or.kr/responsible_start.php",
      balwooMenu: "http://balwoo.or.kr/responsible_foodmenu_fall.php",
      balwooEntrance: "http://balwoo.or.kr/responsible_contact.php",
      kyungin: "https://english.visitseoul.net/eat/Gyeongin-Misulgwan-Jeontong-Dawon/ENP010878",
      kyunginVisit: "http://www.kyunginart.co.kr/kor/",
      kyunginTea: "http://www.kyunginart.co.kr/kor/blue/sub01.asp",
      osulloc: "https://www.osulloc.com/kr/ko/store-introduction/312",
      osullocFood: "https://www.osulloc.com/kr/ko/life/event/bukchon/tealounge",
      osullocBooking: "https://app.catchtable.co.kr/ct/shop/osullocteahouse_bukchon",
      hwang: "https://korean.visitseoul.net/restaurants/%ED%99%A9%EC%83%9D%EA%B0%80%EC%B9%BC%EA%B5%AD%EC%88%98/KOP003496",
      hwangMenu: "https://xn--o39a20aq04bcfbdy7a0gl.com/bbs/board.php?bo_table=menu_webzine&sca=%EB%B3%B8%EC%A0%90%EB%A9%94%EB%89%B4",
      tosokchon: "https://korean.visitseoul.net/restaurants/TosokchonSamgyetang/KOPywjsmm",
      tongin: "https://korean.visitseoul.net/attractions/%ED%86%B5%EC%9D%B8%EC%8B%9C%EC%9E%A5/KOP000281",
      fritz: "https://www.fritz.co.kr/store/detail.html?cate_no=125&display_group=1&product_no=2242",
      fritzMenu: "https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=b0916d55-37b5-4fdc-afd9-65dcc1d5858b",
      imun: "https://big5chinese.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=99780",
      mijin: "https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=82484",
      onion: "https://chinese.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=191233",
      teaMuseum: "https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=104043",
      teaMuseumCafe: "https://chinese.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=99946",
      teaMuseumMenu: "https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=49c4c224-5ff4-442d-b8b7-cf94b2c8d1f7",
      modernHistory: "https://www.much.go.kr/MUCH/contents/M01020100000.do",
      craftVisit: "https://craftmuseum.seoul.go.kr/preview/visit",
      craftFacilities: "https://craftmuseum.seoul.go.kr/preview/facilities",
      craftFloors: "https://craftmuseum.seoul.go.kr/preview/floor_guide",
      seoulHistoryVisit: "https://museum.seoul.go.kr/www/guide/vis/infomation.jsp?sso=ok",
      seoulHistoryFacilities: "https://museum.seoul.go.kr/www/guide/fac/convenientFacilities.jsp?sso=ok"
    };
    knownFeature = (sourceUrl, scope3, extra = {}) => ({ kind: "fact", sourceUrl, verifiedAt: detailCheckedAt, scope: scope3, ...extra });
    menuItem = (name, amount2, sourceUrl, availabilityNote, extra = {}) => ({ name, amount: amount2, currency: "KRW", unit: "menu-item", taxStatus: "not-stated", availabilityNote, sourceUrl, verifiedAt: detailCheckedAt, servings: null, ...extra });
    visitInfo = (hoursNote, reservationNote, entranceNote, sourceUrls) => ({ hoursNote, reservationNote, entranceNote, sourceUrls, verifiedAt: detailCheckedAt });
    PLACE_DETAILS = {
      "imun-seolnongtang": {
        featuresByKey: { soup: knownFeature(detailUrls.imun, "한국관광공사 대표 메뉴 설농탕·도가니탕·머리탕") },
        menuItems: ["설농탕", "도가니탕", "머리탕", "수육"].map((name) => menuItem(name, null, detailUrls.imun, "공식 관광 안내의 메뉴 이름 · 현재 가격·주문 인분·추가 주문비 미확인")),
        visitInfo: visitInfo("월~토 08:00~21:00, 일요일 08:00~20:00. 매일 15:00~16:30 준비시간이며 점심 주문은 14:30, 저녁은 월~토 20:30·일요일 19:30에 마감합니다. 재료 소진 시 일찍 마감될 수 있습니다.", "예약 가능 여부는 공식 자료에서 확인하지 못했습니다. 방문일 운영은 02-733-6526으로 확인해 주세요.", "우정국로 38-13. 주소의 골목 안 점포이며 출입구 단차·식탁 접근성은 확인하지 못했습니다.", [detailUrls.imun])
      },
      "gwanghwamun-mijin": {
        featuresByKey: { noodles: knownFeature(detailUrls.mijin, "한국관광공사 대표 메뉴 냉메밀과 돌우동") },
        menuItems: ["냉메밀", "메밀전병", "보쌈정식", "돌우동"].map((name) => menuItem(name, null, detailUrls.mijin, "공식 관광 안내의 메뉴 이름 · 현재 가격·주문 인분·추가 주문비 미확인")),
        visitInfo: visitInfo("10:30~21:00, 주문마감 20:30, 연중무휴로 안내합니다. 임시 휴무와 공휴일 당일 변경은 확인하지 못했습니다.", "공식 관광 안내에서 예약 가능 여부는 확인하지 못했습니다. 문의 02-730-6198.", "종로 19의 광화문 미진입니다. 다른 지점의 운영시간·가격을 합치지 않았으며 출입구 단차는 미확인입니다.", [detailUrls.mijin])
      },
      "onion-anguk": {
        featuresByKey: { coffee: knownFeature(detailUrls.onion, "한국관광공사 안국점 메뉴의 바닐라빈 라테·아메리카노"), bakery: knownFeature(detailUrls.onion, "한국관광공사 안국점 메뉴의 판도로·소금빵") },
        menuItems: ["바닐라빈 라테", "아메리카노", "판도로", "소금빵"].map((name) => menuItem(name, null, detailUrls.onion, "공식 관광 안내의 메뉴 이름 · 현재 가격·당일 재고·주문 인분 미확인")),
        visitInfo: visitInfo("평일 07:00~22:00, 주말 09:00~22:00, 연중무휴로 안내합니다. 주문마감·당일 재고·임시 변경은 미확인입니다.", "예약 가능 여부는 공식 자료에서 확인하지 못했습니다. 안국점 문의 070-7543-2123.", "계동길 5의 한옥 매장입니다. 공식 소개는 마루와 마당을 안내하지만 좌석 선택·단차·휠체어 이동은 확인하지 못했습니다.", [detailUrls.onion])
      },
      "beautiful-tea-museum": {
        featuresByKey: { traditionalTea: knownFeature(detailUrls.teaMuseumMenu, "한국관광공사 다원 안내에서 전통차 제공을 명시") },
        menuItems: [menuItem("전통차", null, detailUrls.teaMuseumMenu, "카페는 1인1메뉴 주문. 무료 박물관 입장을 음료 0원으로 계산하지 않음")],
        visitInfo: visitInfo("박물관 안내는 11:30~20:00·연중무휴, 별도 다원 안내는 10:30~21:50·명절휴무를 표시합니다. 방문일 다원 운영은 확인이 필요해요.", "차 주문은 1인1메뉴로 안내하며 정확한 가격과 예약 가능 여부는 미확인입니다. 문의 02-735-6678.", "인사동길 19-11. 박물관 전시와 다원 주문은 별개입니다. 출입구 단차와 실내 전체 동선은 확인하지 못했습니다.", [detailUrls.teaMuseum, detailUrls.teaMuseumCafe, detailUrls.teaMuseumMenu])
      },
      "gaeseong-mandu-koong": {
        featuresByKey: {
          noodles: knownFeature(detailUrls.koongMenu, "본점 식사 메뉴에 깍뚝칼국수·서리태콩국수 안내"),
          dumplings: knownFeature(detailUrls.koongMenu, "본점 식사 메뉴에 개성만둣국·김치만둣국 안내"),
          soup: knownFeature(detailUrls.koongMenu, "본점 만둣국 메뉴 안내")
        },
        menuItems: [
          menuItem("개성만둣국", 15e3, detailUrls.koongMenu, "메뉴 한 항목 표시가격 · 인분·추가 주문·세금 별도 표기 미확인"),
          menuItem("깍뚝칼국수", 16e3, detailUrls.koongMenu, "메뉴 한 항목 표시가격 · 당일 제공 여부는 매장 확인"),
          menuItem("김치만둣국", 19e3, detailUrls.koongMenu, "메뉴 한 항목 표시가격 · 당일 제공 여부는 매장 확인"),
          menuItem("서리태콩국수", 17e3, detailUrls.koongMenu, "메뉴 한 항목 표시가격 · 계절·당일 제공 여부는 매장 확인")
        ],
        visitInfo: visitInfo("공식 표에 11:30 개점, 일·월·화 20:00 / 수~토 21:30 폐점이 있으나 주문마감 20:50과 일부 요일이 충돌해 운영 조건은 미확인입니다. 신정·설·추석 당일 및 별도 공지 여름휴가 안내가 있습니다.", "본점 공식 표는 평일·주말·공휴일 점심과 저녁 모두 예약 불가로 안내합니다. 방문 당일 운영은 02-733-9240으로 확인해 주세요.", "인사동10길 11-3. 공식 안내는 안국역 6번·종로3가역 5번 또는 1번 출구를 제시합니다. 출입구의 계단·단차는 확인하지 못했습니다.", [detailUrls.koongVisit, detailUrls.koongMenu])
      },
      "balwoo-gongyang": {
        featuresByKey: { templeFood: knownFeature(detailUrls.balwoo, "한국불교문화사업단이 운영하는 사찰음식 전문점") },
        menuItems: [
          menuItem("선식 코스", 36e3, detailUrls.balwooMenu, "가을 메뉴 · 평일 점심 한정 · 주문 인원 단위는 별도 확인", { unit: "course-menu", taxStatus: "included" }),
          menuItem("원식 코스", 5e4, detailUrls.balwooMenu, "가을 메뉴 · 구성은 계절에 따라 변경 · 주문 인원 단위는 별도 확인", { unit: "course-menu", taxStatus: "included" }),
          menuItem("마음식 코스", 7e4, detailUrls.balwooMenu, "가을 메뉴 · 주문 인원 단위는 별도 확인", { unit: "course-menu", taxStatus: "included" }),
          menuItem("희식 코스", 12e4, detailUrls.balwooMenu, "가을 메뉴 · 3일 전 예약, 4~8명, 선입금 50% 안내 · 실제 예약 가능 여부와 주문 단위 확인 필요", { unit: "course-menu", taxStatus: "included" })
        ],
        visitInfo: visitInfo("업주 안내는 월~토 점심 11:30~13:20 / 13:30~14:50, 저녁 18:00~20:20, 일요일 휴무입니다. 서울관광 안내의 21:00 폐점·19:40 주문마감과 달라 자동 시간 판정은 미확인으로 둡니다.", "희식은 공식 가을 메뉴에 사전예약 조건이 있습니다. 일반 코스 예약 가능 여부·인원 단위는 02-733-2081로 확인해 주세요.", "우정국로 56 템플스테이 통합정보센터 5층, 조계사 맞은편 건물입니다. 엘리베이터·계단 없는 전체 동선은 확인하지 못했습니다.", [detailUrls.balwooVisit, detailUrls.balwoo, detailUrls.balwooMenu, detailUrls.balwooEntrance]),
        hoursOverride: { weekly: {}, scope: "partial", note: "업주와 서울관광의 마감·주문마감 시간이 충돌함. 업주는 일요일 휴무와 점심 2부제를 안내하나 방문일 운영·예약은 별도 확인" },
        priceOverride: { kind: "unknown", label: "코스 표시가격은 있으나 인원별 주문 단위 확인 필요", taxStatus: "not-stated", note: "공식 가을 메뉴는 선식 36,000원·원식 50,000원 등 세금 포함 가격을 표시함. 코스의 인원 단위·계절 적용·예약·추가 주문을 확인하지 못해 총예산 계산에는 사용하지 않음" }
      },
      "kyungin-traditional-teahouse": {
        featuresByKey: { traditionalTea: knownFeature(detailUrls.kyunginTea, "업주 전통다원 소개에서 한국 전통차 15종 안내") },
        menuItems: [menuItem("한국 전통차", null, detailUrls.kyunginTea, "전통차 15종 소개 · 개별 메뉴 이름·가격·인분 미확인")],
        visitInfo: visitInfo("업주 홈페이지는 전통다원 10:00~22:50, 서울관광은 11:00~21:20을 안내해 시간이 충돌합니다. 미술관 10:00~18:00·무료 관람을 다원의 영업시간·음료 가격으로 사용하지 않습니다.", "서울관광은 신정·설·추석 당일 휴무를 안내합니다. 다원 예약 및 방문일 운영은 0507-1339-6305로 확인해 주세요.", "인사동10길 11-4 경인미술관 내 전통다원입니다. 정원·실내 좌석 선택과 출입구 단차는 미확인입니다.", [detailUrls.kyunginVisit, detailUrls.kyungin, detailUrls.kyunginTea]),
        hoursOverride: { weekly: {}, scope: "partial", note: "업주 전통다원 10:00~22:50과 서울관광 11:00~21:20이 충돌하여 자동 시간 판정은 미확인. 미술관 관람시간과 구별 필요" }
      },
      "osulloc-bukchon": {
        featuresByKey: { bakery: knownFeature(detailUrls.osullocFood, "북촌점 공식 찻마루 소개의 구움과자·티 팔미까레·녹차 찰 와플") },
        menuItems: [
          menuItem("북촌 시즈널 티코스", 39e3, detailUrls.osulloc, "공식 매장 표시가격 · 인원 단위·세금·선택 시간의 예약 조건 확인 필요", { unit: "course-menu" }),
          menuItem("티 팔미까레", null, detailUrls.osullocFood, "북촌점 공식 소개 메뉴 · 현재 가격·재고 미확인"),
          menuItem("녹차 찰 와플 플레이트", null, detailUrls.osullocFood, "북촌점 공식 소개 메뉴 · 현재 가격·재고 미확인")
        ],
        visitInfo: visitInfo("월~목 11:00~20:00, 금~일 11:00~21:00으로 안내합니다. 공휴일 예외·임시 휴무·주문마감은 미확인입니다.", "공식 매장에서 연결한 캐치테이블에서 티코스의 날짜·인원·가격·예약 가능 여부를 확인할 수 있습니다. 여기서는 예약을 확정하지 않습니다.", "북촌로 45. 1층 차향의 방, 2층 찻마루, 3층 바설록·티룸으로 안내합니다. 층간 무장애 이동은 확인하지 못했습니다.", [detailUrls.osulloc, detailUrls.osullocFood]),
        bookingUrl: detailUrls.osullocBooking
      },
      hwangsaengga: {
        featuresByKey: {
          noodles: knownFeature(detailUrls.hwangMenu, "황생가 본점 메뉴의 사골칼국수"),
          dumplings: knownFeature(detailUrls.hwangMenu, "황생가 본점 메뉴의 왕만두·왕만두국"),
          soup: knownFeature(detailUrls.hwangMenu, "황생가 본점 메뉴의 왕만두국")
        },
        menuItems: ["사골칼국수", "왕만두국", "왕만두"].map((name) => menuItem(name, null, detailUrls.hwangMenu, "본점 공식 메뉴 · 정확한 표시가격은 확인하지 못함")),
        visitInfo: visitInfo("서울관광은 매일 11:00~21:30, 주문마감 20:30, 연중무휴로 안내합니다. 방문일 임시 변경은 별도 확인해 주세요.", "예약 가능 여부는 공식 자료에서 확인하지 못했습니다. 본점 문의 02-739-6334.", "북촌로5길 78 본점입니다. 프랜차이즈 본사나 다른 지점의 메뉴·가격·업무시간과 구분했습니다. 입구 단차는 미확인입니다.", [detailUrls.hwang, detailUrls.hwangMenu])
      },
      tosokchon: {
        featuresByKey: { soup: knownFeature(detailUrls.tosokchon, "공식 관광 소개의 삼계탕 전문점과 대표 메뉴") },
        menuItems: [menuItem("삼계탕", null, detailUrls.tosokchon, "대표 메뉴 안내 · 현재 공식 표시가격은 확인하지 못함")],
        visitInfo: visitInfo("서울관광은 매일 10:00~22:00을 안내합니다. 주문마감·공휴일 예외·임시 휴무는 미확인입니다.", "예약 가능 여부는 공식 자료에서 확인하지 못했습니다. 문의 02-737-7444.", "자하문로5길 5. 서울관광은 경복궁역 2번 출구를 안내합니다. 출입구 계단·좌석 방식은 확인하지 못했습니다.", [detailUrls.tosokchon])
      },
      "tongin-market": {
        featuresByKey: { marketFood: knownFeature(detailUrls.tongin, "엽전으로 참여 점포의 음식을 골라 담는 시장 도시락 체험") },
        menuItems: [menuItem("엽전 도시락", null, detailUrls.tongin, "선택한 점포·음식·엽전 수에 따라 비용이 달라짐 · 교환 금액을 1인 완성 식사비로 간주하지 않음", { unit: "exchange-unit" })],
        visitInfo: visitInfo("시장 점포와 도시락카페의 운영시간이 다릅니다. 서울관광 페이지의 카페 수~월 운영과 월요일 휴무 표기가 충돌해 자동 시간 판정은 미확인입니다.", "도시락카페·엽전 판매·참여 점포의 당일 운영은 0507-1378-0940으로 확인해 주세요. 예약 가능 여부는 미확인입니다.", "자하문로15길 18 통인시장입니다. 엽전 참여 표시가 있는 점포를 확인해 주세요. 입구와 카페 층간 접근성은 미확인입니다.", [detailUrls.tongin])
      },
      "fritz-wonseo": {
        featuresByKey: {
          coffee: knownFeature(detailUrls.fritzMenu, "한국관광공사 원서점 안내의 아메리카노", { sourcePublishedAt: "2023-05", freshnessNote: "2023년 작성 안내이며 현재 매장 운영은 브랜드 공식 원서점 페이지에서 별도 확인" }),
          bakery: knownFeature(detailUrls.fritzMenu, "한국관광공사 원서점 안내의 크로아상", { sourcePublishedAt: "2023-05", freshnessNote: "2023년 작성 안내. 당일 베이커리 종류·재고는 확인하지 못함" })
        },
        menuItems: [
          menuItem("아메리카노", null, detailUrls.fritzMenu, "관광공사 2023년 원서점 메뉴 소개 · 현재 가격·제공 여부 별도 확인", { sourcePublishedAt: "2023-05" }),
          menuItem("크로아상", null, detailUrls.fritzMenu, "관광공사 2023년 원서점 메뉴 소개 · 당일 종류·재고·가격 미확인", { sourcePublishedAt: "2023-05" })
        ],
        visitInfo: visitInfo("브랜드 공식 원서점 페이지는 월~일 09:00~19:30으로 안내합니다. 공휴일 예외·임시 휴무는 미확인입니다.", "예약 가능 여부는 공식 자료에서 확인하지 못했습니다. 문의 02-747-8101. 매장 소개의 쇼핑몰 0원·품절 표시는 음료 가격·매장 운영 여부에 사용하지 않습니다.", "율곡로 83 아라리오뮤지엄 공간의 원서점입니다. 미술관 입장권과 카페 이용을 같은 비용으로 계산하지 않습니다. 입구 단차는 미확인입니다.", [detailUrls.fritz, detailUrls.fritzMenu])
      }
    };
    VISITOR_DETAILS = {
      "national-museum-contemporary-history": {
        visitInfo: visitInfo("월·화·목·금·일 10:00~18:00, 수·토 10:00~21:00. 입장마감은 폐관 30분 전이며 1월1일·설날·추석 당일은 휴관합니다.", "일반관람 무료. 단체관람·해설·교육은 별도 신청 안내를 확인해 주세요. 프로그램 예약을 포함한 추천이 아닙니다.", "세종대로 198. 1층 안내데스크에서 신분증을 맡기고 휠체어·유모차를 무료 대여할 수 있습니다. 유모차는 36개월 이하 증빙이 필요하며 대여품은 실내에서만 사용 가능합니다. 전체 무장애 동선은 미확인입니다.", [detailUrls.modernHistory])
      },
      "seoul-museum-craft-art": {
        childPrice: { allChildren: true, kind: "free", amount: 0, label: "일반 전시 관람", scope: "child-one", taxStatus: "included", sourceUrl: detailUrls.craftVisit, verifiedAt: detailCheckedAt, note: "연령 제한 없는 일반전시 무료 안내. 어린이박물관 사전예약·대관전시·별도 프로그램은 포함하지 않음" },
        visitInfo: visitInfo("일반 전시는 10:00~18:00·입장 17:30 마감입니다. 가을 야간개관은 일부 전시동만 적용되며 10월13~25일 전시1동 로비 제한 등 기존 날짜별 조건을 확인해 주세요.", "개인 일반전시는 자유 관람입니다. 어린이박물관은 사전예약 확인 후 입장하며 대관전시는 유료일 수 있습니다.", "안국역 1번 출구 안내. 안내데스크에서 신분증을 맡기고 유모차·휠체어를 무료 대여할 수 있으며 전시동별 승강기·장애인화장실 위치가 공식 지도에 표시됩니다. 외부부터 모든 전시실까지의 무장애 경로는 미확인입니다.", [detailUrls.craftVisit, detailUrls.craftFacilities, detailUrls.craftFloors])
      },
      "seoul-history-museum": {
        visitInfo: visitInfo("2026년9월15일~11월30일 화·수·금·토·일 09:00~21:00, 목요일 18:00까지입니다. 입장은 폐관30분 전 마감, 월요일·1월1일 휴관이며 공휴일 월요일은 개관합니다.", "일반관람 무료·개인 자유 관람. 교육·체험·별도 프로그램은 신청 조건을 따로 확인해 주세요.", "정문으로 들어와 왼쪽 화장실 앞에 엘리베이터가 있습니다. 유아24개월 미만·노약자를 위한 유모차·휠체어 이용 안내와 1층 아기쉼터가 있습니다. 외부에서 이어지는 전체 무장애 동선은 미확인입니다.", [detailUrls.seoulHistoryVisit, detailUrls.seoulHistoryFacilities])
      }
    };
    byId = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
    photoById = Object.fromEntries(PHOTO_CREDITS.map((s) => [s.id, s]));
    checkedAt = "2026-10-09";
    TRAVEL_PLACES = Object.freeze([...REAL_PLACES.map((p) => enrich(p, BASE_PROPERTIES[p.id])), ...EXTRA_PLACES.map((p) => enrich(p))]);
    TRAVEL_META = Object.freeze({ version: 2, checkedAt, area: "서울 종로·북촌·서촌", liveAvailability: false, sourceRefresh: "manual", routeKind: "estimated", placeCount: TRAVEL_PLACES.length, photoPolicy: "원문에서 재사용 권한을 확인한 실제 장소 사진만 사용" });
  }
});

// experiences/path-travel/real-conditions.mjs
var REAL_CONDITION_LABELS;
var init_real_conditions = __esm({
  "experiences/path-travel/real-conditions.mjs"() {
    REAL_CONDITION_LABELS = Object.freeze({
      none: "조건 없음",
      matched: "안내상 조건 맞음",
      unknown: "확인 필요",
      unmatched: "조건과 다름"
    });
  }
});

// atlas/domain.js
var require_domain = __commonJS({
  "atlas/domain.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkAtlasDomain = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const VERSION = "core-domain-1";
      const DAY = 864e5;
      const DOMAINS = ["LAB", "SHIFT", "PATH", "PULSE", "SYNK"];
      const SOURCES2 = ["declared", "observed", "inferred"];
      const own2 = (o, k) => Object.hasOwn(o, k);
      const plain2 = (o) => o !== null && typeof o === "object" && !Array.isArray(o) && [Object.prototype, null].includes(Object.getPrototypeOf(o));
      const token3 = (s) => typeof s === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(s) && !["__proto__", "prototype", "constructor"].includes(s);
      const fail6 = (message) => {
        throw new TypeError(`Core domain: ${message}`);
      };
      const copy2 = (value) => JSON.parse(JSON.stringify(value));
      const canonical = (value) => JSON.stringify(value, (_key, v) => plain2(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
      const time2 = (value) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : fail6("invalid time");
      const finite = (n) => typeof n === "number" && Number.isFinite(n);
      const keys2 = (value, allowed) => plain2(value) && Object.keys(value).every((k) => allowed.includes(k));
      const scopeKey = (scope3) => {
        if (!keys2(scope3, ["domain", "workspace", "subject"]) || Object.keys(scope3).length !== 3 || !DOMAINS.includes(scope3.domain) || !token3(scope3.workspace) || !token3(scope3.subject)) fail6("invalid scope");
        return canonical(scope3);
      };
      function validValue(field, value) {
        if (field.kind === "enum") return field.values.includes(value);
        if (field.kind === "boolean") return typeof value === "boolean";
        return finite(value) && value >= field.range[0] && value <= field.range[1];
      }
      function validateContract(contract2) {
        if (!keys2(contract2, ["id", "version", "purpose", "fields", "criteria", "objectives"]) || !token3(contract2.id) || !token3(contract2.version) || !token3(contract2.purpose) || !Array.isArray(contract2.fields) || !contract2.fields.length || contract2.fields.length > 100 || !Array.isArray(contract2.criteria) || contract2.criteria.length > 100) fail6("invalid contract");
        const fields2 = /* @__PURE__ */ new Map(), criteria = /* @__PURE__ */ new Set();
        for (const field of contract2.fields) {
          if (!keys2(field, ["id", "kind", "values", "range", "maxAgeDays", "minIndependent", "minAgreement", "tolerance"]) || !token3(field.id) || fields2.has(field.id) || !["enum", "boolean", "number"].includes(field.kind)) fail6("invalid field");
          if (field.kind === "enum" && (!Array.isArray(field.values) || field.values.length < 2 || field.values.length > 100 || new Set(field.values).size !== field.values.length || field.values.some((v) => !token3(v)))) fail6("invalid enum values");
          if (field.kind !== "enum" && field.values != null) fail6("values belong to an enum");
          if (field.kind === "number" && (!Array.isArray(field.range) || field.range.length !== 2 || !field.range.every(finite) || field.range[0] >= field.range[1] || !finite(field.range[1] - field.range[0]))) fail6("invalid numeric range");
          if (field.kind !== "number" && (field.range != null || field.tolerance != null)) fail6("range/tolerance belong to a number");
          if (field.maxAgeDays != null && (!finite(field.maxAgeDays) || field.maxAgeDays <= 0 || field.maxAgeDays > 36500)) fail6("invalid evidence lifetime");
          if (field.minIndependent != null && (!Number.isInteger(field.minIndependent) || field.minIndependent < 1 || field.minIndependent > 1e4)) fail6("invalid minimum evidence");
          if (field.minAgreement != null && (!finite(field.minAgreement) || field.minAgreement <= 0.5 || field.minAgreement > 1)) fail6("invalid agreement threshold");
          if (field.tolerance != null && (!finite(field.tolerance) || field.tolerance < 0 || field.tolerance > field.range[1] - field.range[0])) fail6("invalid numeric tolerance");
          fields2.set(field.id, field);
        }
        for (const criterion of contract2.criteria) {
          if (!keys2(criterion, ["id", "field", "feature", "weight", "required", "prefer"]) || !token3(criterion.id) || criteria.has(criterion.id) || !fields2.has(criterion.field) || !token3(criterion.feature) || !finite(criterion.weight) || criterion.weight < 0 || criterion.required != null && typeof criterion.required !== "boolean" || !["match", "different", "at-least", "at-most"].includes(criterion.prefer || "match")) fail6("invalid criterion");
          if (["at-least", "at-most"].includes(criterion.prefer) && fields2.get(criterion.field).kind !== "number") fail6("numeric comparison requires a number");
          criteria.add(criterion.id);
        }
        if (own2(contract2, "objectives")) {
          if (!Array.isArray(contract2.objectives) || contract2.objectives.length > 100) fail6("invalid objectives");
          const objectives = /* @__PURE__ */ new Set();
          for (const objective of contract2.objectives) {
            if (!keys2(objective, ["id", "feature", "range", "weight", "prefer"]) || !token3(objective.id) || objectives.has(objective.id) || !token3(objective.feature) || !Array.isArray(objective.range) || objective.range.length !== 2 || !objective.range.every(finite) || objective.range[0] >= objective.range[1] || !finite(objective.range[1] - objective.range[0]) || !finite(objective.weight) || objective.weight < 0 || !["higher", "lower"].includes(objective.prefer)) fail6("invalid objective");
            objectives.add(objective.id);
          }
        }
        return fields2;
      }
      function project(contract2, scope3, observations, at) {
        const fields2 = validateContract(contract2), owner = scopeKey(scope3), cutoff = time2(at);
        if (!Array.isArray(observations) || observations.length > 1e4) fail6("invalid observations");
        const byId2 = /* @__PURE__ */ new Map(), rows = [], replaced = /* @__PURE__ */ new Set();
        for (const row of observations) {
          if (!keys2(row, ["id", "scope", "contract", "field", "value", "source", "independentKey", "at", "recordedAt", "until", "refs", "quality", "supersedes"]) || !token3(row.id) || scopeKey(row.scope) !== owner || !fields2.has(row.field) || !SOURCES2.includes(row.source)) fail6("invalid or foreign observation");
          if (!keys2(row.contract, ["id", "version", "purpose"]) || row.contract.id !== contract2.id || row.contract.version !== contract2.version || row.contract.purpose !== contract2.purpose) fail6("observation belongs to another contract or purpose");
          if (scope3.domain === "PULSE" && row.source !== "declared") fail6("PULSE does not derive a personal behavioral profile");
          if (row.value !== null && !validValue(fields2.get(row.field), row.value)) fail6("observation value is outside its field");
          if (row.value === null && row.source !== "declared") fail6("only a declaration can withdraw a field");
          if (row.source === "observed" && !token3(row.independentKey)) fail6("observations need an independence key");
          if (row.independentKey != null && !token3(row.independentKey)) fail6("invalid independence key");
          if (row.quality != null && !["usable", "confounded", "unassessed"].includes(row.quality)) fail6("invalid evidence quality");
          if (row.source === "declared" && row.quality != null && row.quality !== "usable") fail6("a declaration is not a measured outcome");
          const happened = time2(row.at), recorded = time2(row.recordedAt ?? row.at);
          if (recorded < happened || row.until != null && time2(row.until) <= happened) fail6("invalid observation chronology");
          if (row.refs != null && (!Array.isArray(row.refs) || row.refs.length > 100 || row.refs.some((r) => !token3(r)) || new Set(row.refs).size !== row.refs.length)) fail6("invalid evidence references");
          if (row.source === "inferred" && !row.refs?.length) fail6("an inferred proposal needs source references");
          if (row.supersedes != null && !token3(row.supersedes)) fail6("invalid correction reference");
          if (byId2.has(row.id)) {
            if (canonical(byId2.get(row.id)) !== canonical(row)) fail6("conflicting observation id");
            continue;
          }
          byId2.set(row.id, row);
          if (happened <= cutoff && recorded <= cutoff) rows.push(row);
        }
        for (const row of rows) {
          for (const ref of row.source === "inferred" ? row.refs : []) {
            const source = byId2.get(ref);
            if (!source || source.id === row.id || source.source === "inferred" || time2(source.recordedAt ?? source.at) > time2(row.recordedAt ?? row.at) || time2(source.at) > time2(row.at)) fail6("invalid proposal source");
          }
          if (row.supersedes) {
            const prior = byId2.get(row.supersedes);
            if (!prior || prior.id === row.id || prior.field !== row.field || prior.source !== row.source || time2(prior.at) > time2(row.at) || time2(prior.recordedAt ?? prior.at) > time2(row.recordedAt ?? row.at)) fail6("invalid correction");
            replaced.add(prior.id);
          }
        }
        const checked = /* @__PURE__ */ new Set();
        for (const start of rows) {
          let row = start;
          const path = /* @__PURE__ */ new Set();
          while (row && !checked.has(row.id)) {
            if (path.has(row.id)) fail6("correction cycle");
            path.add(row.id);
            row = row.supersedes ? byId2.get(row.supersedes) : null;
          }
          for (const id2 of path) checked.add(id2);
        }
        rows.sort((a, b) => time2(a.at) - time2(b.at) || time2(a.recordedAt ?? a.at) - time2(b.recordedAt ?? b.at));
        const byField = /* @__PURE__ */ new Map(), orderedKeys = /* @__PURE__ */ new Map(), latestDeclarations = /* @__PURE__ */ new Map(), latestIndependent = /* @__PURE__ */ new Map();
        for (const row of rows) if (!replaced.has(row.id)) {
          if (row.source !== "inferred") {
            const key = canonical([row.field, row.source, row.source === "observed" ? row.independentKey : "", time2(row.at), time2(row.recordedAt ?? row.at)]);
            const previous = orderedKeys.get(key);
            if (previous && (previous.value !== row.value || (previous.quality ?? "usable") !== (row.quality ?? "usable") || previous.until !== row.until)) fail6("ambiguous observation order");
            orderedKeys.set(key, row);
          }
          if (!byField.has(row.field)) byField.set(row.field, []);
          byField.get(row.field).push(row);
          if (row.source === "declared") latestDeclarations.set(row.field, row);
          if (row.source === "observed") latestIndependent.set(canonical([row.field, row.independentKey]), row);
        }
        const sourceUsable = (id2) => {
          const row = byId2.get(id2);
          if (!row || replaced.has(id2) || row.value === null || row.quality && row.quality !== "usable") return false;
          const field = fields2.get(row.field);
          if (cutoff >= (row.until ? time2(row.until) : time2(row.at) + (field.maxAgeDays ?? 30) * DAY)) return false;
          const declared = latestDeclarations.get(row.field);
          if (declared && (declared.value === null || row.source === "declared" && declared.id !== row.id)) return false;
          if (row.source === "observed" && latestIndependent.get(canonical([row.field, row.independentKey]))?.id !== row.id) return false;
          return true;
        };
        const result = [];
        for (const field of fields2.values()) {
          const all = byField.get(field.id) || [];
          const fresh = (row) => cutoff < (row.until ? time2(row.until) : time2(row.at) + (field.maxAgeDays ?? 30) * DAY);
          const base = { id: field.id, status: "unknown", value: null, usable: false, evidence: [], independent: 0, agreement: null, alternatives: [], proposals: [], excluded: [] };
          const declaration = all.filter((r) => r.source === "declared").at(-1);
          if (declaration) {
            result.push({
              ...base,
              status: declaration.value === null ? "withdrawn" : !fresh(declaration) ? "expired" : "declared",
              value: declaration.value !== null && fresh(declaration) ? declaration.value : null,
              usable: declaration.value !== null && fresh(declaration),
              evidence: [declaration.id]
            });
            continue;
          }
          const independent = /* @__PURE__ */ new Map();
          for (const row of all) {
            if (row.source === "inferred") {
              if (fresh(row) && (!row.quality || row.quality === "usable") && row.refs.every(sourceUsable)) base.proposals.push({ id: row.id, value: row.value, evidence: row.refs });
              else base.excluded.push(row.id);
              continue;
            }
            if (row.source === "observed") independent.set(row.independentKey, row);
          }
          const sample = [...independent.values()].filter((row) => {
            if (fresh(row) && (!row.quality || row.quality === "usable")) return true;
            base.excluded.push(row.id);
            return false;
          });
          base.independent = sample.length;
          base.evidence = sample.map((r) => r.id);
          if (!sample.length) {
            base.status = base.proposals.length ? "unconfirmed" : all.some(fresh) ? "unusable" : all.length ? "expired" : "unknown";
            result.push(base);
            continue;
          }
          let value, support;
          if (field.kind === "number") {
            const values = sample.map((r) => r.value).sort((a, b) => a - b), middle = Math.floor(values.length / 2);
            value = values.length % 2 ? values[middle] : values[middle - 1] + (values[middle] - values[middle - 1]) / 2;
            support = sample.filter((r) => Math.abs(r.value - value) <= (field.tolerance ?? 0)).length;
            const counts = /* @__PURE__ */ new Map();
            for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
            base.alternatives = [...counts].map(([v, count]) => ({ value: v, count }));
          } else {
            const counts = /* @__PURE__ */ new Map();
            for (const row of sample) counts.set(row.value, (counts.get(row.value) || 0) + 1);
            base.alternatives = [...counts].map(([v, count]) => ({ value: v, count })).sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
            value = base.alternatives[0].value;
            support = base.alternatives[0].count;
          }
          base.agreement = support / sample.length;
          base.status = base.agreement < (field.minAgreement ?? 0.67) ? "conflicted" : sample.length < (field.minIndependent ?? 2) ? "insufficient" : "supported";
          base.usable = base.status === "supported";
          base.value = base.usable ? value : null;
          result.push(base);
        }
        return {
          version: VERSION,
          contract: { id: contract2.id, version: contract2.version, purpose: contract2.purpose },
          scope: copy2(scope3),
          at,
          fields: result,
          needsCheck: result.filter((f) => ["conflicted", "insufficient", "unconfirmed", "unusable"].includes(f.status)).map((f) => f.id),
          calibrated: false
        };
      }
      function understand(input = {}) {
        return copy2(project(input.contract, input.scope, input.observations ?? [], input.at));
      }
      function decide({ contract: contract2, scope: scope3, observations = [], at, candidates } = {}) {
        const understanding = project(contract2, scope3, observations, at), specs = new Map(contract2.fields.map((f) => [f.id, f]));
        const objectives = contract2.objectives ?? [];
        const facts = new Map(understanding.fields.map((f) => [f.id, f]));
        const allowed = new Set([...contract2.criteria, ...objectives].map((c) => c.feature));
        if (!Array.isArray(candidates) || candidates.length > 1e4) fail6("invalid candidates");
        const ids3 = /* @__PURE__ */ new Set(), ranked = [], excluded = [];
        for (const candidate of candidates) {
          if (!keys2(candidate, ["id", "features", "eligible", "exclusions"]) || !token3(candidate.id) || ids3.has(candidate.id) || !plain2(candidate.features) || Object.keys(candidate.features).some((k) => !allowed.has(k)) || candidate.eligible != null && typeof candidate.eligible !== "boolean" || candidate.exclusions != null && (!Array.isArray(candidate.exclusions) || candidate.exclusions.some((r) => !token3(r)))) fail6("invalid candidate");
          ids3.add(candidate.id);
          for (const c of contract2.criteria) if (own2(candidate.features, c.feature) && !validValue(specs.get(c.field), candidate.features[c.feature])) fail6("invalid candidate feature");
          for (const objective of objectives) if (own2(candidate.features, objective.feature)) {
            const value = candidate.features[objective.feature];
            if (!finite(value) || value < objective.range[0] || value > objective.range[1]) fail6("invalid objective feature");
          }
          if (candidate.eligible === false || candidate.exclusions?.length) {
            excluded.push({ id: candidate.id, reasons: candidate.exclusions?.length ? candidate.exclusions : ["ineligible"] });
            continue;
          }
          let score = 0;
          const reasons = [], policyReasons = [], blocked = [];
          for (const c of contract2.criteria) {
            const fact = facts.get(c.field), field = specs.get(c.field), has = own2(candidate.features, c.feature), v = candidate.features[c.feature];
            if (!fact.usable || !has) {
              if (c.required) blocked.push(`unknown:${c.id}`);
              continue;
            }
            const prefer = c.prefer || "match";
            let fit = field.kind === "number" ? Math.max(0, 1 - Math.abs(fact.value - v) / (field.range[1] - field.range[0])) : Number(fact.value === v);
            if (prefer === "different") fit = 1 - fit;
            if (prefer === "at-least") fit = Number(v >= fact.value);
            if (prefer === "at-most") fit = Number(v <= fact.value);
            const passes = field.kind === "number" && ["match", "different"].includes(prefer) ? prefer === "match" ? Math.abs(fact.value - v) <= (field.tolerance ?? 0) : Math.abs(fact.value - v) > (field.tolerance ?? 0) : fit === 1;
            if (c.required && !passes) {
              blocked.push(`constraint:${c.id}`);
              continue;
            }
            const contribution = fit * c.weight;
            score += contribution;
            if (!finite(score)) fail6("policy utility overflow");
            reasons.push({ criterion: c.id, field: c.field, value: fact.value, candidateValue: v, contribution, evidence: fact.evidence, status: fact.status });
          }
          for (const objective of objectives) {
            if (!own2(candidate.features, objective.feature)) continue;
            const candidateValue = candidate.features[objective.feature];
            const fraction = (candidateValue - objective.range[0]) / (objective.range[1] - objective.range[0]);
            const contribution = (objective.prefer === "higher" ? fraction : 1 - fraction) * objective.weight;
            score += contribution;
            if (!finite(score)) fail6("policy utility overflow");
            policyReasons.push({ objective: objective.id, feature: objective.feature, candidateValue, contribution });
          }
          if (blocked.length) excluded.push({ id: candidate.id, reasons: blocked });
          else ranked.push({ id: candidate.id, score, reasons, ...own2(contract2, "objectives") ? { policyReasons } : {} });
        }
        ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        return copy2({
          version: VERSION,
          contract: understanding.contract,
          scope: scope3,
          at,
          status: ranked.length ? "ready" : "unavailable",
          selected: ranked[0] || null,
          ranked,
          excluded,
          understanding,
          snapshot: { candidates, contract: contract2, observations: observations.map((row) => row.id) },
          calibrated: false
        });
      }
      return Object.freeze({ VERSION, validateContract, understand, decide });
    });
  }
});

// atlas/travel.js
var require_travel = __commonJS({
  "atlas/travel.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkAtlasTravel = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const VERSION = "core-travel-feasibility-1";
      const plain2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
      const token3 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value) && !["__proto__", "prototype", "constructor"].includes(value);
      const fail6 = (message) => {
        throw new TypeError(`Core travel: ${message}`);
      };
      const keys2 = (value, required, optional = []) => plain2(value) && required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => [...required, ...optional].includes(key));
      const whole = (value) => Number.isSafeInteger(value) && value >= 0;
      const minute2 = (value) => whole(value) && value <= 1800;
      function instant(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail6("time must be an ISO timestamp with timezone");
        const [year, month, day, hour, minutes2, seconds] = value.slice(0, 19).split(/[-T:]/).map(Number);
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minutes2 > 59 || seconds > 59) fail6("invalid timestamp calendar value");
        return Date.parse(value);
      }
      function identifiers(value, label) {
        if (!Array.isArray(value) || value.length > 1e3 || !value.every(token3) || new Set(value).size !== value.length) fail6(`invalid ${label}`);
        return value;
      }
      function add(total, value) {
        if (!Number.isSafeInteger(total + value)) fail6("total exceeds safe integer range");
        return total + value;
      }
      function checkItem(item) {
        if (!keys2(item, ["id", "kind", "start", "end", "cost", "walkMinutes", "requirements", "source"]) || !token3(item.id) || !token3(item.kind) || !minute2(item.start) || !minute2(item.end) || item.end <= item.start || !whole(item.walkMinutes) || item.walkMinutes > item.end - item.start) fail6("invalid item or duration");
        if (!keys2(item.cost, ["amount", "currency", "status"]) || !/^[A-Z]{3}$/.test(item.cost.currency) || !["known", "unknown"].includes(item.cost.status) || (item.cost.status === "known" ? !whole(item.cost.amount) : item.cost.amount !== null)) fail6("invalid cost; unknown amount must be null");
        if (!plain2(item.requirements) || Object.entries(item.requirements).some(([key, value]) => !token3(key) || ![true, false, null].includes(value))) fail6("invalid item requirements");
        if (!keys2(item.source, ["kind", "checkedAt", "validUntil"]) || !["fixture", "verified"].includes(item.source.kind)) fail6("invalid source");
        const checked = instant(item.source.checkedAt), until = instant(item.source.validUntil);
        if (checked >= until) fail6("source validity must end after its check");
        return { checked, until };
      }
      function evaluateBundles(input = {}) {
        if (!keys2(
          input,
          ["bundles", "budget", "currency", "dayStart", "dayEnd", "maxWalkMinutes", "at"],
          ["requirements", "lockedIds", "excludedIds", "allowFixtures"]
        )) fail6("invalid input fields");
        const {
          bundles,
          budget,
          currency,
          dayStart,
          dayEnd,
          maxWalkMinutes,
          requirements = [],
          lockedIds = [],
          excludedIds = [],
          allowFixtures = false
        } = input;
        if (!Array.isArray(bundles) || bundles.length > 1e3 || !whole(budget) || currency !== "KRW" || !minute2(dayStart) || !minute2(dayEnd) || dayEnd <= dayStart || !whole(maxWalkMinutes) || typeof allowFixtures !== "boolean") fail6("invalid evaluation bounds");
        const now = instant(input.at), locks = identifiers(lockedIds, "locked ids"), excluded = new Set(identifiers(excludedIds, "excluded ids"));
        if (!Array.isArray(requirements) || requirements.length > 100) fail6("invalid requirements");
        const needed = requirements.map((requirement) => {
          if (typeof requirement === "string" && token3(requirement)) return { id: requirement };
          if (!keys2(requirement, ["id", "kind"]) || !token3(requirement.id) || !token3(requirement.kind)) fail6("invalid required condition");
          return { id: requirement.id, kind: requirement.kind };
        });
        if (new Set(needed.map((row) => JSON.stringify(row))).size !== needed.length) fail6("duplicate required condition");
        const bundleIds = /* @__PURE__ */ new Set(), result = { version: VERSION, feasible: [], pending: [], rejected: [] };
        for (const bundle of bundles) {
          if (!keys2(bundle, ["id", "items"]) || !token3(bundle.id) || bundleIds.has(bundle.id) || !Array.isArray(bundle.items) || bundle.items.length < 1 || bundle.items.length > 1e3) fail6("invalid bundle");
          bundleIds.add(bundle.id);
          const itemIds = /* @__PURE__ */ new Set(), reasons = [];
          let knownTotal = 0, walkMinutes = 0, unknownCost = false, demo = false;
          let blocked = false, pending = false;
          const reason = (code, severity, details = {}) => {
            reasons.push({ code, ...details });
            if (severity === "rejected") blocked = true;
            else pending = true;
          };
          for (const item of bundle.items) {
            const validity = checkItem(item);
            if (itemIds.has(item.id)) fail6("duplicate item id within bundle");
            itemIds.add(item.id);
            const detail = { itemId: item.id };
            if (item.start < dayStart || item.end > dayEnd) reason("time.outside-day", "rejected", detail);
            if (excluded.has(item.id)) reason("item.excluded", "rejected", detail);
            walkMinutes = add(walkMinutes, item.walkMinutes);
            if (item.cost.currency !== currency) {
              unknownCost = true;
              reason("cost.currency-unconverted", "pending", { ...detail, currency: item.cost.currency });
            } else if (item.cost.status === "unknown") {
              unknownCost = true;
              reason("cost.unknown", "pending", detail);
            } else knownTotal = add(knownTotal, item.cost.amount);
            if (item.source.kind === "fixture") {
              demo = true;
              if (!allowFixtures) reason("source.fixture-not-allowed", "pending", detail);
            }
            if (validity.checked > now) reason("source.not-yet-checked", "pending", detail);
            else if (validity.until <= now) reason("source.expired", "pending", detail);
          }
          for (const id2 of locks) if (!itemIds.has(id2)) reason("lock.missing", "rejected", { itemId: id2 });
          const chronological = [...bundle.items].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
          let latest = null;
          for (const item of chronological) {
            if (latest && item.start < latest.end) reason("time.overlap", "rejected", { itemId: item.id, withItemId: latest.id });
            if (!latest || item.end > latest.end) latest = item;
          }
          for (const required of needed) {
            const targets = bundle.items.filter((item) => !required.kind || item.kind === required.kind);
            if (!targets.length) reason("requirement.no-target", "pending", { requirement: required.id, kind: required.kind });
            for (const item of targets) {
              const value = Object.hasOwn(item.requirements, required.id) ? item.requirements[required.id] : null;
              if (value !== true) reason(
                value === false ? "requirement.failed" : "requirement.unknown",
                value === false ? "rejected" : "pending",
                { itemId: item.id, requirement: required.id }
              );
            }
          }
          if (knownTotal > budget) reason("budget.exceeded", "rejected", { amount: knownTotal, limit: budget });
          if (walkMinutes > maxWalkMinutes) reason("walking.exceeded", "rejected", { minutes: walkMinutes, limit: maxWalkMinutes });
          const status = blocked ? "rejected" : pending ? "pending" : "feasible";
          result[status].push({
            id: bundle.id,
            status,
            total: unknownCost ? null : knownTotal,
            knownTotal,
            currency,
            walkMinutes,
            reasons,
            demo
          });
        }
        return result;
      }
      return Object.freeze({ VERSION, evaluateBundles });
    });
  }
});

// atlas/ask.js
var require_ask = __commonJS({
  "atlas/ask.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkAsk = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const VERSION = "ask-1.1";
      const MAX_OPTIONS = 64;
      const KINDS = ["setting", "confirm", "choice", "refresh", "follow_up"];
      const DAY = 864e5;
      const id2 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      const canonical = (value) => JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);
      const time2 = (value) => {
        const n = Date.parse(value);
        if (typeof value !== "string" || !Number.isFinite(n)) throw new TypeError("Ask: invalid time");
        return n;
      };
      const finite = (value) => typeof value === "number" && Number.isFinite(value);
      const owns = (value, key) => Object.hasOwn(value, key);
      function probabilities(q) {
        const supplied = q.options.filter((option) => owns(option, "p")).length;
        if (!supplied) return q.options.map(() => 1 / q.options.length);
        if (supplied !== q.options.length || q.options.some((option) => !finite(option.p) || option.p < 0 || option.p > 1)) throw new TypeError(`Ask: invalid probabilities in ${q.id}`);
        const total = q.options.reduce((sum, option) => sum + option.p, 0);
        if (Math.abs(total - 1) > 1e-9) throw new TypeError(`Ask: probabilities must sum to one in ${q.id}`);
        return q.options.map((option) => option.p / total);
      }
      function validate(questions) {
        if (!Array.isArray(questions)) throw new TypeError("Ask: questions must be an array");
        const ids3 = /* @__PURE__ */ new Set();
        for (const q of questions) {
          if (!q || !id2(q.id) || ids3.has(q.id) || !KINDS.includes(q.kind ?? "setting") || !id2(q.about ?? q.id) || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > MAX_OPTIONS) throw new TypeError(`Ask: invalid question ${q && q.id}`);
          ids3.add(q.id);
          const options = /* @__PURE__ */ new Set();
          for (const option of q.options) {
            if (!option || !id2(option.id) || options.has(option.id)) throw new TypeError(`Ask: invalid option in ${q.id}`);
            options.add(option.id);
          }
          probabilities(q);
          if (owns(q, "cost") && (!finite(q.cost) || q.cost < 0)) throw new TypeError(`Ask: invalid question cost in ${q.id}`);
          if (owns(q, "responseProbability") && (!finite(q.responseProbability) || q.responseProbability < 0 || q.responseProbability > 1)) throw new TypeError(`Ask: invalid response probability in ${q.id}`);
        }
        return questions;
      }
      function difference(a, b) {
        if (a && b && typeof a === "object" && typeof b === "object" && ("content" in a || "shape" in a)) {
          return (canonical(a.content) !== canonical(b.content) ? 2 : 0) + (canonical(a.shape) !== canonical(b.shape) ? 1 : 0);
        }
        return canonical(a) === canonical(b) ? 0 : 1;
      }
      function decisionValue(evaluate, context) {
        const value = evaluate(context);
        if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["utility", "loss"].includes(key)) || !owns(value, "utility") && !owns(value, "loss") || owns(value, "utility") && !finite(value.utility) || owns(value, "loss") && (!finite(value.loss) || value.loss < 0)) throw new TypeError("Ask: evaluate must return finite utility and/or nonnegative loss");
        const result = (value.utility ?? 0) - (value.loss ?? 0);
        if (!finite(result)) throw new TypeError("Ask: nonfinite decision value");
        return result;
      }
      function rank({ questions, decide, answers = {}, denied = [], asked = {}, now = null, quietDays = 7, evaluate } = {}) {
        validate(questions);
        if (typeof decide !== "function" || !answers || typeof answers !== "object" || !Array.isArray(denied) || !asked || typeof asked !== "object") throw new TypeError("Ask: invalid input");
        if (evaluate !== void 0 && typeof evaluate !== "function") throw new TypeError("Ask: evaluate must be a function");
        const valued = typeof evaluate === "function";
        if (!valued && questions.some((q) => owns(q, "cost") || owns(q, "responseProbability"))) throw new TypeError("Ask: question cost and response probability require evaluate");
        const current = decide({ ...answers });
        const result = [];
        for (const q of questions) {
          const about = q.about ?? q.id;
          if (Object.hasOwn(answers, about)) continue;
          if (denied.includes(q.id)) {
            result.push({ id: q.id, kind: q.kind ?? "setting", about, impact: 0, skippable: true, reason: "denied" });
            continue;
          }
          if (Object.hasOwn(asked, q.id) && now !== null && time2(now) - time2(asked[q.id]) < quietDays * DAY) {
            result.push({ id: q.id, kind: q.kind ?? "setting", about, impact: 0, skippable: true, reason: "asked-recently" });
            continue;
          }
          const chances = probabilities(q);
          const outcomes = /* @__PURE__ */ Object.create(null);
          let impact = 0, expectedGain = 0;
          q.options.forEach((option, index) => {
            const scenario = { ...answers, [about]: owns(option, "value") ? option.value : option.id };
            const decided = decide({ ...scenario });
            outcomes[option.id] = decided;
            impact += chances[index] * difference(current, decided);
            if (valued && chances[index] > 0) {
              const context = { answers: scenario, question: q, option };
              const gain = decisionValue(evaluate, { ...context, decision: decided }) - decisionValue(evaluate, { ...context, decision: current });
              if (!finite(gain)) throw new TypeError("Ask: nonfinite decision gain");
              expectedGain += chances[index] * gain;
            }
          });
          const distinct = new Set(Object.values(outcomes).map(canonical)).size;
          const cost = q.cost ?? 0, responseProbability = q.responseProbability ?? 1, value = responseProbability * expectedGain - cost;
          if (valued && (!finite(expectedGain) || !finite(value))) throw new TypeError("Ask: nonfinite expected decision value");
          const skippable = impact === 0 || valued && value <= 0;
          result.push({
            id: q.id,
            kind: q.kind ?? "setting",
            about,
            impact: Math.round(impact * 1e3) / 1e3,
            distinct,
            skippable,
            reason: impact === 0 ? "no-change" : valued ? value > 0 ? "positive-decision-value" : "no-positive-decision-value" : "changes-decision",
            outcomes,
            ...valued ? { basis: "declared-decision-value", expectedGain, responseProbability, cost, value } : {}
          });
        }
        const score = (entry) => valued ? entry.value ?? 0 : entry.impact;
        return result.map((entry, order) => ({ ...entry, order })).sort((a, b) => score(b) - score(a) || a.order - b.order).map(({ order, ...entry }) => entry);
      }
      function choose({ budget = 1, usedToday = 0, ...input } = {}) {
        if (!Number.isInteger(budget) || budget < 0 || !Number.isInteger(usedToday) || usedToday < 0) throw new TypeError("Ask: invalid budget");
        const ranked = rank(input);
        if (usedToday >= budget) return { version: VERSION, status: "none", reason: "budget", ranked };
        const valued = typeof input.evaluate === "function";
        const best = ranked.find((entry) => !entry.skippable && (valued ? entry.value > 0 : entry.impact > 0));
        if (!best) return { version: VERSION, status: "none", reason: valued ? "no-question-has-positive-decision-value" : "no-question-changes-the-decision", ranked };
        return {
          version: VERSION,
          status: "ask",
          question: input.questions.find((q) => q.id === best.id),
          impact: best.impact,
          reason: best.reason,
          ranked,
          ...valued ? { value: best.value, basis: best.basis } : {}
        };
      }
      function fromAtlas({ engine, events = [], scope: scope3, at, experienceId, candidates, levers = [], questions, ...rest } = {}) {
        if (!engine || typeof engine.decide !== "function") throw new TypeError("Ask: Core engine required");
        validate(questions);
        const byAbout = new Map(questions.map((q) => [q.about ?? q.id, q]));
        const decide = (answers) => {
          const extra = [];
          for (const [about, value] of Object.entries(answers)) {
            const q = byAbout.get(about);
            if (!q) continue;
            const base = { schema: 1, id: `ask-virtual-${q.id}`, scope: scope3, at, recordedAt: at };
            if (q.kind === "confirm") extra.push({ ...base, type: "estimate.responded", line: q.line, value });
            else extra.push({ ...base, type: "context.set", field: q.field ?? about, value, until: null });
          }
          const plan = engine.decide({ events: [...events, ...extra], scope: scope3, at, experienceId, candidates, levers });
          if (plan.status !== "ready") return { content: "unavailable", shape: null };
          const classes = Object.fromEntries(levers.map((lever) => [lever.id, lever.class]));
          const content = [plan.selected.id], shape = [];
          for (const [lever, pick] of Object.entries(plan.bundle)) if (lever !== "mode") (classes[lever] === "content" ? content : shape).push(`${lever}=${pick.option}`);
          return { content, shape };
        };
        return choose({ ...rest, questions, decide });
      }
      return Object.freeze({ VERSION, MAX_OPTIONS, KINDS, rank, choose, fromAtlas });
    });
  }
});

// experiences/path-travel/planner.mjs
function fail2(field, message) {
  const error = new TypeError(message);
  error.field = field;
  throw error;
}
function boolMap(value, field) {
  if (!plain(value) || Object.entries(value).some(([key, entry]) => !SEMANTIC_KEYS.includes(key) || typeof entry !== "boolean")) fail2(field, "취향과 필수 조건을 확인해 주세요.");
  return Object.fromEntries(SEMANTIC_KEYS.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));
}
function normalizeCompanions(value, partySize = 6) {
  if (!Array.isArray(value) || value.length > 6 || value.length > partySize) fail2("companions", "동행 취향은 일행 수 안에서 최대 6명까지 입력해 주세요.");
  const result = value.map((row) => {
    if (!plain(row) || Object.keys(row).length !== 4 || Object.keys(row).some((key) => !["id", "label", "preferences", "requiredFeatures"].includes(key)) || !token(row.id) || typeof row.label !== "string" || !row.label.trim() || row.label.trim().length > 24) fail2("companions", "동행의 별칭은 1~24자로 입력하고 취향·필수 조건을 확인해 주세요.");
    const preferences = boolMap(row.preferences, "companions"), requiredFeatures = boolMap(row.requiredFeatures, "companions");
    if (!Object.keys(preferences).length && !Object.keys(requiredFeatures).length) fail2("companions", `${row.label.trim()}의 취향이나 필수 조건을 한 가지 이상 골라 주세요.`);
    return { id: row.id, label: row.label.trim(), preferences, requiredFeatures };
  });
  if (new Set(result.map((row) => row.id)).size !== result.length) fail2("companions", "같은 동행의 취향을 두 번 넣을 수 없어요.");
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
function combinedRequiredFeatures(requiredFeatures, companions) {
  const combined = { ...requiredFeatures }, owners = new Map(Object.keys(requiredFeatures).map((key) => [key, "공통 필수 조건"]));
  for (const person of companions) for (const [key, value] of Object.entries(person.requiredFeatures)) {
    if (Object.hasOwn(combined, key) && combined[key] !== value) fail2("companions", `${owners.get(key)}과 ${person.label}의 ${PREFERENCE_LABELS[key]} 필수 조건이 서로 반대예요. 직접 조정해 주세요.`);
    combined[key] = value;
    owners.set(key, owners.has(key) ? `${owners.get(key)}·${person.label}` : person.label);
  }
  return combined;
}
function ids2(value, field) {
  if (!Array.isArray(value) || value.length > 80 || value.some((id2) => !token(id2)) || new Set(value).size !== value.length) fail2(field, "장소 목록을 확인해 주세요.");
  return [...value];
}
function point(value, field) {
  if (!plain(value) || !Number.isFinite(value.lat) || !Number.isFinite(value.lon) || Math.abs(value.lat) > 90 || Math.abs(value.lon) > 180) fail2(field, "출발점의 위치를 확인해 주세요.");
  return { lat: value.lat, lon: value.lon };
}
function namedPoint(value, field) {
  if (!plain(value) || !token(value.id) || typeof value.name !== "string" || !value.name.trim() || value.name.length > 160) fail2(field, field === "destination" ? "마지막 도착지를 골라 주세요." : "출발점을 골라 주세요.");
  return { id: value.id, name: value.name, ...point(value, field) };
}
function normalizePlannerInput(value, { places: places3 } = {}) {
  if (!plain(value)) fail2("input", "여행 조건을 입력해 주세요.");
  if (!dateValid(value.date)) fail2("date", "방문 날짜를 입력해 주세요.");
  if (!timeValid(value.startTime) || !timeValid(value.endTime) || minutes(value.endTime) <= minutes(value.startTime)) fail2("endTime", "같은 날의 시작·종료 시간을 확인해 주세요.");
  const origin = namedPoint(value.origin, "origin");
  const destination = value.destination == null ? null : namedPoint(value.destination, "destination");
  if (!plain(value.party) || !integer(value.party.adults, 1, 20) || !integer(value.party.children, 0, 20)) fail2("party", "성인 1~20명, 아이 0~20명으로 입력해 주세요.");
  if (!integer(value.budget, 0, 1e7)) fail2("budget", "일행의 표시 비용 예산을 0~1천만 원으로 입력해 주세요.");
  if (!integer(value.maxWalkMinutes, 0, 360)) fail2("maxWalkMinutes", "장소 사이 걷기 상한을 0~360분으로 입력해 주세요.");
  const maxLegWalkMinutes = value.maxLegWalkMinutes ?? null, restEveryMinutes = value.restEveryMinutes ?? null, restDurationMinutes = value.restDurationMinutes === void 0 ? 10 : value.restDurationMinutes;
  if (maxLegWalkMinutes !== null && !integer(maxLegWalkMinutes, 0, 360)) fail2("maxLegWalkMinutes", "한 번에 걷는 상한은 0~360분으로 입력해 주세요.");
  if (restEveryMinutes !== null && !integer(restEveryMinutes, 30, 180)) fail2("restEveryMinutes", "쉬는 여유를 넣을 간격은 30~180분으로 입력해 주세요.");
  if (!integer(restDurationMinutes, 5, 30)) fail2("restDurationMinutes", "한 번 쉬는 시간은 5~30분으로 입력해 주세요.");
  const planningMode = value.planningMode === void 0 ? "day" : value.planningMode;
  if (!["day", "remaining"].includes(planningMode)) fail2("planningMode", "하루 일정 또는 남은 일정 중 계획 범위를 확인해 주세요.");
  const minimumStops = planningMode === "remaining" ? 1 : 2, stopCount = value.stopCount ?? 3;
  if (!integer(stopCount, minimumStops, 5)) fail2("stopCount", `희망 방문 수는 ${minimumStops}~5곳으로 골라 주세요.`);
  const preferences = boolMap(value.preferences ?? {}, "preferences");
  const requiredFeatures = boolMap(value.requiredFeatures ?? {}, "requiredFeatures");
  const companions = normalizeCompanions(value.companions === void 0 ? [] : value.companions, value.party.adults + value.party.children);
  combinedRequiredFeatures(requiredFeatures, companions);
  const requiredCategories = value.requiredCategories ?? [];
  if (!Array.isArray(requiredCategories) || new Set(requiredCategories).size !== requiredCategories.length || requiredCategories.some((category) => !CATEGORIES.includes(category))) fail2("requiredCategories", "꼭 포함할 분야를 확인해 주세요.");
  const lockedIds = ids2(value.lockedIds ?? [], "lockedIds"), excludedIds = ids2(value.excludedIds ?? [], "excludedIds");
  if (lockedIds.some((id2) => excludedIds.includes(id2))) fail2("lockedIds", "같은 장소를 유지하면서 제외할 수는 없어요.");
  const rawMeal = value.meal === void 0 ? { mode: "any", startTime: "12:00", endTime: "13:00" } : value.meal;
  if (!plain(rawMeal) || !["any", "none", "window"].includes(rawMeal.mode)) fail2("meal", "식사 없음·시간 자유·식사 시작 시간대 중 골라 주세요.");
  const meal = { mode: rawMeal.mode, startTime: rawMeal.startTime ?? "12:00", endTime: rawMeal.endTime ?? "13:00" };
  if (!timeValid(meal.startTime) || !timeValid(meal.endTime) || meal.startTime > meal.endTime) fail2("meal", "같은 날의 식사 시작 허용 시간대를 확인해 주세요.");
  const rawAppointments = value.appointments === void 0 ? [] : value.appointments;
  if (!Array.isArray(rawAppointments) || rawAppointments.length > 3 || rawAppointments.some((row) => !plain(row) || !token(row.placeId) || !timeValid(row.time))) fail2("appointments", "예약 장소와 정확한 시각을 최대 3개까지 입력해 주세요.");
  const appointments = rawAppointments.map((row) => ({ placeId: row.placeId, time: row.time })).sort((a, b) => a.time.localeCompare(b.time) || a.placeId.localeCompare(b.placeId));
  if (new Set(appointments.map((row) => row.placeId)).size !== appointments.length) fail2("appointments", "같은 장소를 두 번 예약 일정에 넣을 수 없어요.");
  if (new Set(appointments.map((row) => row.time)).size !== appointments.length) fail2("appointments", "서로 다른 두 장소에 같은 시각으로 예약할 수 없어요.");
  if (appointments.some((row) => row.time < value.startTime || row.time >= value.endTime)) fail2("appointments", "예약 시각은 여행 시작 이후, 여행 종료 이전이어야 해요.");
  if (appointments.some((row) => excludedIds.includes(row.placeId))) fail2("appointments", "예약한 장소를 동시에 제외할 수는 없어요. 예약이나 제외를 직접 바꿔 주세요.");
  if ((/* @__PURE__ */ new Set([...lockedIds, ...appointments.map((row) => row.placeId)])).size > stopCount) fail2("appointments", "예약과 유지한 장소 수가 희망 방문 수보다 많아요. 방문 수를 늘리거나 직접 설정을 바꿔 주세요.");
  if (meal.mode === "none" && requiredCategories.includes("food")) fail2("meal", "식사를 생략하면서 식사 필수 포함을 동시에 선택할 수 없어요.");
  const catalogue = places3 ?? TRAVEL_PLACES, byId2 = new Map(catalogue.map((place) => [place.id, place]));
  if (appointments.some((row) => !byId2.has(row.placeId) || byId2.get(row.placeId).dayPlannerEligible === false || !CATEGORIES.includes(byId2.get(row.placeId).category))) fail2("appointments", "예약은 현재 당일 여행 장소 중에서 골라 주세요.");
  if (meal.mode === "none" && [...lockedIds, ...appointments.map((row) => row.placeId)].some((id2) => byId2.get(id2)?.category === "food")) fail2("meal", "식사를 생략하면서 식당 예약·유지를 함께 선택할 수 없어요.");
  if (meal.mode === "window" && appointments.some((row) => byId2.get(row.placeId).category === "food" && (row.time < meal.startTime || row.time > meal.endTime))) fail2("meal", "식당 예약 시각이 정한 식사 시작 시간대 밖이에요. 둘 중 하나를 직접 조정해 주세요.");
  if (places3) {
    const allowed = new Set(places3.map((place) => place.id));
    if ([...lockedIds, ...excludedIds].some((id2) => !allowed.has(id2))) fail2("lockedIds", "현재 장소 목록에 없는 곳이 있어요.");
  }
  return {
    date: value.date,
    startTime: value.startTime,
    endTime: value.endTime,
    origin,
    destination,
    appointments,
    meal,
    party: { adults: value.party.adults, children: value.party.children },
    budget: value.budget,
    maxWalkMinutes: value.maxWalkMinutes,
    maxLegWalkMinutes,
    restEveryMinutes,
    restDurationMinutes,
    planningMode,
    stopCount,
    preferences,
    requiredFeatures,
    companions,
    requiredCategories: [...requiredCategories],
    lockedIds,
    excludedIds
  };
}
function fingerprint(value) {
  const text4 = typeof value === "string" ? value : JSON.stringify(value);
  let a = 2166136261, b = 5381;
  for (const char of text4) {
    a = Math.imul(a ^ char.charCodeAt(0), 16777619) >>> 0;
    b = (b * 33 ^ char.charCodeAt(0)) >>> 0;
  }
  return `${a.toString(36)}-${b.toString(36)}`;
}
function matchesPlannerInputFingerprint(value, expected) {
  const input = normalizePlannerInput(value);
  if (expected === fingerprint(input)) return true;
  if (input.companions.length) return false;
  const schedule = { ...input };
  delete schedule.companions;
  if (expected === fingerprint(schedule)) return true;
  if (input.destination !== null || input.appointments.length || input.meal.mode !== "any" || input.meal.startTime !== "12:00" || input.meal.endTime !== "13:00" || input.maxLegWalkMinutes !== null || input.restEveryMinutes !== null || input.restDurationMinutes !== 10 || input.planningMode !== "day") return false;
  const early = { ...schedule };
  for (const key of ["destination", "appointments", "meal", "maxLegWalkMinutes", "restEveryMinutes", "restDurationMinutes", "planningMode"]) delete early[key];
  return expected === fingerprint(early);
}
function semanticFeature(place, key) {
  if (CATEGORIES.includes(key)) return place.category === key;
  return typeof place.features?.[key] === "boolean" ? place.features[key] : null;
}
function relevantStops(stops, key) {
  const category = DETAIL_PREFERENCE_CATEGORIES[key] ?? (key === "vegetarian" ? "food" : null);
  return category ? stops.filter((stop) => stop.place.category === category) : stops;
}
function requiredChecks(place, required) {
  return Object.entries(required).filter(([key]) => relevantStops([{ place }], key).length).map(([key, value]) => {
    const feature = semanticFeature(place, key);
    return check(
      `required.${key}`,
      feature === null ? "unknown" : feature === value ? "matched" : "unmatched",
      feature === null ? `${PREFERENCE_LABELS[key]} 필수 조건을 확인할 자료가 없어요.` : feature === value ? `${PREFERENCE_LABELS[key]} 조건을 반영했어요.` : `${PREFERENCE_LABELS[key]} 필수 조건과 달라요.`,
      { placeId: place.id }
    );
  });
}
function requiredPlaceChecks(place, required, companions) {
  return requiredChecks(place, required).map((row) => {
    const owners = companions.filter((person) => Object.hasOwn(person.requiredFeatures, row.kind.slice("required.".length))).map((person) => person.label);
    return owners.length ? { ...row, reason: `${owners.join("·")}의 필수 조건: ${row.reason}` } : row;
  });
}
function requiredWalkingCheck(leg, placeId, returning = false) {
  const matched = leg?.stepFreeVerified === true;
  return check(returning ? "required.stepFree.return" : "required.stepFree.route", matched ? "matched" : "unknown", matched ? "이동 경로의 무계단 조건을 확인했어요." : returning ? "마지막 도착지까지의 계단·단차 정보가 확인되지 않아 제외했어요." : "장소의 무계단 접근과 별개로 이동 경로의 계단·단차 정보가 확인되지 않아 제외했어요.", { placeId });
}
function assessPlannerRequirements(stops, input, { legs = [], returnLeg = null } = {}) {
  if (!plain(input) || !Array.isArray(stops) || stops.length > 5 || stops.some((stop) => !plain(stop) || !token(stop.placeId) || !plain(stop.place)) || !Array.isArray(legs)) fail2("requirements", "필수 조건을 확인할 여행 장소와 이동 정보를 확인해 주세요.");
  const companions = normalizeCompanions(input.companions === void 0 ? [] : input.companions);
  const required = combinedRequiredFeatures(boolMap(input.requiredFeatures ?? {}, "requiredFeatures"), companions);
  const checks = stops.flatMap((stop) => requiredPlaceChecks(stop.place, required, companions));
  if (required.stepFree === true) {
    stops.forEach((stop, index) => checks.push(requiredWalkingCheck(legs[index], stop.placeId)));
    if (input.destination) checks.push(requiredWalkingCheck(returnLeg, stops.at(-1)?.placeId, true));
  }
  return checks;
}
var DomainModule, TravelModule, AskModule, Domain, Travel, Ask, SEMANTIC_KEYS, PREFERENCE_LABELS, DETAIL_PREFERENCE_CATEGORIES, CATEGORIES, plain, token, integer, timeValid, minutes, dateValid, check, scope;
var init_planner = __esm({
  "experiences/path-travel/planner.mjs"() {
    init_places_v2();
    init_real_places();
    init_real_conditions();
    DomainModule = __toESM(require_domain(), 1);
    TravelModule = __toESM(require_travel(), 1);
    AskModule = __toESM(require_ask(), 1);
    Domain = DomainModule.default ?? globalThis.SynkAtlasDomain;
    Travel = TravelModule.default ?? globalThis.SynkAtlasTravel;
    Ask = AskModule.default ?? globalThis.SynkAsk;
    SEMANTIC_KEYS = Object.freeze(["indoor", "outdoor", "food", "tea", "culture", "history", "art", "walk", "quiet", "vegetarian", "stepFree", "noodles", "dumplings", "soup", "templeFood", "marketFood", "coffee", "bakery", "traditionalTea"]);
    PREFERENCE_LABELS = Object.freeze({ indoor: "실내", outdoor: "야외", food: "식사", tea: "차와 카페", culture: "문화 관람", history: "역사", art: "미술·공예", walk: "산책", quiet: "조용한 곳", vegetarian: "채식", stepFree: "계단 없는 접근", noodles: "면 요리", dumplings: "만두", soup: "국물 요리", templeFood: "사찰 음식", marketFood: "시장 음식", coffee: "커피", bakery: "베이커리", traditionalTea: "전통차" });
    DETAIL_PREFERENCE_CATEGORIES = Object.freeze({ noodles: "food", dumplings: "food", soup: "food", templeFood: "food", marketFood: "food", coffee: "tea", bakery: "tea", traditionalTea: "tea" });
    CATEGORIES = ["food", "tea", "culture"];
    plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Object.keys(value).every((key) => !["__proto__", "prototype", "constructor"].includes(key));
    token = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value) && !["__proto__", "prototype", "constructor"].includes(value);
    integer = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
    timeValid = (value) => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    dateValid = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith("0000") && Number.isFinite(Date.parse(value + "T00:00:00.000Z")) && (/* @__PURE__ */ new Date(value + "T00:00:00.000Z")).toISOString().slice(0, 10) === value;
    check = (kind, status, reason, extra = {}) => ({ kind, status, reason, ...extra });
    scope = Object.freeze({ domain: "PATH", workspace: "path-real-planner", subject: "local-visitor" });
  }
});

// experiences/path-travel/real-places.mjs?v=20261007-halfday1
var REAL_META2, REAL_CONDITION_CALENDAR2, REAL_PLACES2;
var init_real_places2 = __esm({
  "experiences/path-travel/real-places.mjs?v=20261007-halfday1"() {
    REAL_META2 = Object.freeze({
      "version": 2,
      "area": "서울 종로·안국·인사동·북촌",
      "checkedAt": "2026-10-07",
      "sourceKind": "official-web-notices",
      "liveAvailability": false
    });
    REAL_CONDITION_CALENDAR2 = Object.freeze({
      "from": "2026-09-07",
      "through": "2026-11-06",
      "holidays": [
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-10-03",
        "2026-10-05",
        "2026-10-09"
      ],
      "sourceUrl": "https://www.kasi.re.kr/kor/post/newsMaterial/32031",
      "verifiedAt": "2026-10-07",
      "note": "우주항공청 2026년 월력요항(한국천문연구원 게시). 일요일은 주간시간표로 처리하며 이 배열에는 별도 공휴일만 수록"
    });
    REAL_PLACES2 = Object.freeze([
      {
        "id": "gaeseong-mandu-koong",
        "name": "개성만두 궁",
        "category": "food",
        "address": "서울특별시 종로구 인사동10길 11-3",
        "description": "개성만두와 사골 국물 요리를 소개하는 한식당.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울관광재단 Visit Seoul",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B6%81/KOP011155",
        "costNote": "공식 식사류 예시: 개성 만둣국 15,000원 · 매장 최저비용이 아니며 세금·주문 단위 확인 필요",
        "visitNote": "영업시간·쉬는 시간·휴무일을 확인해 주세요.",
        "openingNote": "일·월·화 11:30~20:00. 수~토 마감은 매장 공식 21:30, 서울 관광 안내 21:00으로 서로 달라요. 평일 쉬는 시간·요일별 마지막 주문은 방문 전 확인해 주세요. 신정·설·추석 당일과 별도 여름휴가 휴무 안내가 있어요.",
        "accessNote": "3호선 안국역 5번 출구에서 인사동10길로 이동해요.",
        "accessSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B6%81/KOP011155",
        "visitSourceUrl": "https://www.koong.co.kr/2020/storeinfo/headoffice.php",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://www.koong.co.kr/2020/storeinfo/headoffice.php",
            "weekly": {},
            "scope": "partial",
            "holidayPolicy": "unknown",
            "note": "공식 매장과 관광 안내의 마감시간이 다르고, 매장 표의 주문마감과 일부 요일 폐점시간도 맞지 않아 시간 조건은 미확인"
          },
          "price": {
            "kind": "sample",
            "label": "개성 만둣국",
            "scope": "menu-item",
            "taxStatus": "not-stated",
            "sourceUrl": "https://www.koong.co.kr/2020/menuinfo/meals.php",
            "verifiedAt": "2026-10-07",
            "amount": 15e3,
            "note": "식사류 메뉴 한 항목의 표시가격. 인분·세금 별도 문구는 없으며 다른 메뉴나 매장 최저비용을 뜻하지 않음"
          }
        }
      },
      {
        "id": "balwoo-gongyang",
        "name": "발우공양",
        "category": "food",
        "address": "서울특별시 종로구 우정국로 56 템플스테이 통합정보센터 5층",
        "description": "한국불교문화사업단이 직접 운영하며 사찰음식 조리법을 소개하는 레스토랑.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울관광재단 Visit Seoul",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "costNote": "메뉴별 가격은 공식 안내에서 확인",
        "visitNote": "예약·운영시간과 원하는 메뉴의 제공 조건을 확인해 주세요.",
        "openingNote": "서울 공식 관광 안내는 11:30~21:00, 쉬는 시간 15:00~18:00, 마지막 주문 19:40으로 소개해요. 정기휴무는 공식 본문에서 확인하지 못했어요. 방문 전 매장 확인이 필요해요.",
        "accessNote": "1호선 종각역 3-1번 출구 또는 3호선 안국역 6번 출구. 템플스테이 통합정보센터 5층이에요.",
        "accessSourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "visitSourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
            "weekly": {},
            "scope": "partial",
            "holidayPolicy": "unknown",
            "note": "정기휴무·요일별 적용 미확인. 안내 시간과 실제 예약 가능 여부는 별도 확인"
          },
          "price": {
            "kind": "unknown",
            "label": "메뉴 제공 요일·시간·주문 단위 확인 필요",
            "scope": "menu-item",
            "taxStatus": "not-stated",
            "sourceUrl": "https://korean.visitseoul.net/restaurants/BalwooGongyang/KOP4vpx7k",
            "verifiedAt": "2026-10-07",
            "note": "서울 관광 안내에 선식 36,000원(평일 점심 한정), 원식 50,000원이 있으나 상품 이용 조건과 인분·세금을 확인하지 못해 예산 확정에 사용하지 않음"
          }
        }
      },
      {
        "id": "kyungin-traditional-teahouse",
        "name": "경인미술관 전통다원",
        "category": "tea",
        "address": "서울특별시 종로구 인사동10길 11-4 경인미술관",
        "description": "경인미술관의 한옥·정원 공간에서 전통차와 한식 다과를 소개하는 찻집.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울관광재단 Visit Seoul",
        "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "costNote": "메뉴별 가격은 공식 안내에서 확인",
        "visitNote": "영업시간·쉬는 시간·휴무일을 확인해 주세요.",
        "openingNote": "매일 11:00~21:20. 신정·설·추석 휴무 안내가 있어요. 미술관 전시 관람시간과는 별개예요.",
        "accessNote": "3호선 안국역 5번 출구. 인사동10길 경인미술관 안에 있어요.",
        "accessSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "visitSourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
            "weekly": {
              "0": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "1": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "2": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "3": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "4": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "5": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ],
              "6": [
                {
                  "open": "11:00",
                  "close": "21:20"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "unknown",
            "note": "명절 휴무 범위는 미확인. 공휴일 날짜는 별도 확인"
          },
          "price": {
            "kind": "unknown",
            "label": "개별 메뉴 가격 미확인",
            "scope": "menu-item",
            "taxStatus": "not-stated",
            "sourceUrl": "https://korean.visitseoul.net/restaurants/%EA%B2%BD%EC%9D%B8%EB%AF%B8%EC%88%A0%EA%B4%80%EC%A0%84%ED%86%B5%EB%8B%A4%EC%9B%90/KOP010878",
            "verifiedAt": "2026-10-07"
          }
        }
      },
      {
        "id": "osulloc-bukchon",
        "name": "오설록 티하우스 북촌점",
        "category": "tea",
        "address": "서울특별시 종로구 북촌로 45",
        "description": "차와 북촌점 티푸드, 논알코올 티 칵테일을 소개하는 오설록 티하우스.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "오설록",
        "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "costNote": "메뉴별 가격은 공식 안내에서 확인",
        "visitNote": "시즌별 메뉴와 티코스 예약 조건을 확인해 주세요.",
        "openingNote": "월~목 11:00~20:00, 금~일 11:00~21:00. 정기휴무는 공식 매장 본문에 따로 안내되어 있지 않아 확인이 필요해요.",
        "accessNote": "북촌로 45. 공식 매장 소개의 지도보기를 확인해 주세요. 역·출구 안내는 해당 본문에서 확인하지 못했어요.",
        "accessSourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "visitSourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
            "weekly": {
              "0": [
                {
                  "open": "11:00",
                  "close": "21:00"
                }
              ],
              "1": [
                {
                  "open": "11:00",
                  "close": "20:00"
                }
              ],
              "2": [
                {
                  "open": "11:00",
                  "close": "20:00"
                }
              ],
              "3": [
                {
                  "open": "11:00",
                  "close": "20:00"
                }
              ],
              "4": [
                {
                  "open": "11:00",
                  "close": "20:00"
                }
              ],
              "5": [
                {
                  "open": "11:00",
                  "close": "21:00"
                }
              ],
              "6": [
                {
                  "open": "11:00",
                  "close": "21:00"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "unknown",
            "note": "요일별 공식 안내이며 정기휴무·공휴일 예외는 미확인"
          },
          "price": {
            "kind": "unknown",
            "label": "선택 메뉴·티코스 조건 확인 필요",
            "scope": "menu-item",
            "taxStatus": "not-stated",
            "sourceUrl": "https://www.osulloc.com/kr/ko/store-introduction/312",
            "verifiedAt": "2026-10-07",
            "note": "북촌 시즈널 티코스 39,000원 안내는 있으나 1인 단위·세금·예약 조건을 확정하지 못해 매장 예산으로 사용하지 않음"
          }
        }
      },
      {
        "id": "nine-tree-insadong",
        "name": "나인트리 바이 파르나스 서울 인사동",
        "category": "stay",
        "address": "서울특별시 종로구 인사동길 49",
        "description": "인사동길에 있는 호텔. 객실 유형과 이용 조건을 공식 예약 화면에서 비교할 수 있어요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "나인트리 바이 파르나스",
        "sourceUrl": "https://www.ninetreehotels.com/ko/insadong",
        "costNote": "날짜·객실·인원별 요금 확인 · 세금·취소 조건 별도 확인",
        "visitNote": "객실 구성·투숙 인원·예약 가능 여부를 확인해 주세요.",
        "openingNote": "공식 객실 안내 기준 체크인 15:00, 체크아웃 12:00. 예약 상품의 별도 이용 조건을 확인해 주세요.",
        "accessNote": "3호선 안국역 6번 출구. 공식 호텔찾기에서 서울 인사동 지점을 확인해 주세요.",
        "accessSourceUrl": "https://www.ninetreehotels.com/ko/hub/hotel-find",
        "visitSourceUrl": "https://www.ninetreehotels.com/ko/insadong/room/standard-double",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://www.ninetreehotels.com/ko/insadong/room/standard-double",
            "weekly": {},
            "scope": "partial",
            "holidayPolicy": "unknown",
            "note": "체크인·체크아웃은 방문 영업시간이나 당일 입실 가능 여부를 뜻하지 않음"
          },
          "price": {
            "kind": "unknown",
            "label": "날짜·객실·인원별 예약 요금 확인",
            "scope": "room",
            "taxStatus": "not-stated",
            "sourceUrl": "https://www.ninetreehotels.com/ko/insadong",
            "verifiedAt": "2026-10-07",
            "note": "객실 요금을 일반 성인 1인 입장·메뉴 예산으로 비교하지 않음"
          }
        }
      },
      {
        "id": "orakai-insadong-suites",
        "name": "오라카이 인사동 스위츠",
        "category": "stay",
        "address": "서울특별시 종로구 인사동4길 18",
        "description": "주방 시설과 여러 객실 유형을 안내하는 레지던스 호텔. 필요한 객실 구성과 투숙 인원을 먼저 확인해 보세요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "오라카이 인사동 스위츠",
        "sourceUrl": "https://insa.orakaihotels.com/kr/default.asp",
        "costNote": "날짜·객실·인원별 요금 확인 · 세금·취소 조건 별도 확인",
        "visitNote": "객실 구성·투숙 인원·예약 가능 여부를 확인해 주세요.",
        "openingNote": "체크인 16:00부터, 체크아웃 11:00까지. 이른 입실·늦은 퇴실은 객실 상황과 추가 요금 조건을 따로 확인해 주세요.",
        "accessNote": "1·3·5호선 종로3가역 5번 출구. 공식 교통 안내는 짐이 많을 때 4번 출구 에스컬레이터도 안내해요.",
        "accessSourceUrl": "https://insa.orakaihotels.com/kr/about/location.asp",
        "visitSourceUrl": "https://insa.orakaihotels.com/kr/about/guest_info.asp?mCode=1",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://insa.orakaihotels.com/kr/about/guest_info.asp?mCode=1",
            "weekly": {},
            "scope": "partial",
            "holidayPolicy": "unknown",
            "note": "체크인·체크아웃은 방문 영업시간이나 당일 입실 가능 여부를 뜻하지 않음"
          },
          "price": {
            "kind": "unknown",
            "label": "날짜·객실·인원별 예약 요금 확인",
            "scope": "room",
            "taxStatus": "not-stated",
            "sourceUrl": "https://insa.orakaihotels.com/kr/default.asp",
            "verifiedAt": "2026-10-07",
            "note": "객실 요금을 일반 성인 1인 입장·메뉴 예산으로 비교하지 않음"
          }
        }
      },
      {
        "id": "seoul-museum-craft-art",
        "name": "서울공예박물관",
        "category": "culture",
        "address": "서울특별시 종로구 율곡로3길 4",
        "description": "전통과 현대 공예 전시를 둘러볼 수 있는 박물관. 관람할 전시동과 휴관 공지를 먼저 확인해 보세요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울공예박물관",
        "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
        "costNote": "일반 관람 무료 · 대관전시 유료 가능",
        "visitNote": "전시동별 운영시간·부분 휴관 공지를 확인해 주세요. 어린이박물관은 예약 안내를 확인해 주세요. 2026.10.13~10.25에는 전시1동 1층 로비 휴관·통행 제한 공지가 있어요.",
        "openingNote": "전시실 기본 10:00~18:00, 입장마감은 종료 30분 전. 월요일·1월 1일 휴관(공휴일인 월요일은 일반 전시 운영, 어린이박물관은 모든 월요일 휴관). 2026.9.15~11.30 화·수·금·토·일에는 전시실 가운데 전시1동 1~2층만 21:00까지 연장해요. 2026.10.13~10.25에는 전시1동 1층 로비 휴관·통행 제한이 있어요.",
        "accessNote": "3호선 안국역 1번 출구. 일반 관람객용 주차장은 운영하지 않아요.",
        "accessSourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
        "visitSourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000444",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
            "weekly": {
              "0": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "1": [],
              "2": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "3": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "4": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "5": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ],
              "6": [
                {
                  "open": "10:00",
                  "close": "18:00",
                  "lastEntry": "17:30"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "same",
            "validFrom": "2026-10-07",
            "validThrough": "2026-11-06",
            "exceptions": {
              "2026-10-05": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "full",
                "note": "공휴일인 월요일 일반 전시 운영; 어린이박물관 제외"
              },
              "2026-10-13": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-14": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-15": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-16": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-17": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-18": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-20": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-21": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-22": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-23": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-24": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              },
              "2026-10-25": {
                "slots": [
                  {
                    "open": "10:00",
                    "close": "18:00",
                    "lastEntry": "17:30"
                  }
                ],
                "scope": "partial",
                "note": "전시1동 1층 로비 휴관·통행 제한; 다른 공간은 별도 확인",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
              }
            },
            "partialExtensions": [
              {
                "from": "2026-09-15",
                "through": "2026-11-30",
                "weekdays": [
                  0,
                  2,
                  3,
                  5,
                  6
                ],
                "slots": [
                  {
                    "open": "17:30",
                    "close": "21:00",
                    "lastEntry": "20:30"
                  }
                ],
                "note": "17:30 이후 일반 전시 입장은 마감되지만 전시1동 1~2층은 연장 운영해요. 대상 공간과 입장 조건을 확인해 주세요.",
                "sourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000444"
              }
            ]
          },
          "price": {
            "kind": "free",
            "label": "일반 전시 관람",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://craftmuseum.seoul.go.kr/preview/visit",
            "verifiedAt": "2026-10-07",
            "amount": 0,
            "note": "대관전시 및 예약 프로그램은 별도"
          }
        },
        "visitNoticeSourceUrl": "https://craftmuseum.seoul.go.kr/introduce/news_view/NTT_0000000452"
      },
      {
        "id": "unhyeongung",
        "name": "운현궁",
        "category": "culture",
        "address": "서울특별시 종로구 삼일대로 464",
        "description": "흥선대원군의 사가였던 역사 공간. 일반 관람과 행사·야간 운영 공지를 구분해 살펴보세요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "서울 공식 관광정보 Visit Seoul",
        "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "costNote": "일반 관람 무료",
        "visitNote": "휴관일과 계절별·특별 운영시간을 확인해 주세요. 유료 행사는 별도입니다.",
        "openingNote": "확인일 기준 일반 09:00~19:00(입장마감 18:30). 월요일 휴관, 공휴일인 월요일은 개장 안내예요. 2026.9.1~11.29 화·수·금·토·일에는 21:00까지(입장마감 20:30) 야간 개방해요. 동절기 시간은 별도 확인해 주세요.",
        "accessNote": "3호선 안국역 4번 출구. 삼일대로 464의 운현궁 입구를 지도에서 확인해 주세요.",
        "accessSourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "visitSourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
            "weekly": {
              "0": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ],
              "1": [],
              "2": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ],
              "3": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ],
              "4": [
                {
                  "open": "09:00",
                  "close": "19:00",
                  "lastEntry": "18:30"
                }
              ],
              "5": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ],
              "6": [
                {
                  "open": "09:00",
                  "close": "21:00",
                  "lastEntry": "20:30"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "unknown",
            "validFrom": "2026-10-07",
            "validThrough": "2026-10-31",
            "exceptions": {
              "2026-10-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "19:00",
                    "lastEntry": "18:30"
                  }
                ],
                "scope": "full",
                "note": "공휴일인 월요일 정상 개장 일반 안내"
              }
            },
            "note": "야간기간은11/29까지이나 11월 일반 동절기 운영범위는 추가 확인 필요"
          },
          "price": {
            "kind": "free",
            "label": "일반 관람",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://korean.visitseoul.net/attractions/%EC%9A%B4%ED%98%84%EA%B6%81_/471",
            "verifiedAt": "2026-10-07",
            "amount": 0,
            "note": "유료 행사·체험 제외"
          }
        }
      },
      {
        "id": "gyeongbokgung",
        "name": "경복궁",
        "category": "culture",
        "address": "서울특별시 종로구 사직로 161",
        "description": "조선의 법궁에서 전각과 궁궐 마당을 둘러보는 일반 관람. 별도 예약 행사는 구분해 확인해요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "국가유산청 궁능유적본부",
        "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=gbg",
        "costNote": "일반 개인 대인 3,000원 · 내국인 만25~64세·외국인 만19~64세 기준 · 무료일·감면 별도",
        "visitNote": "2026.9.2~10.31 근정전 월대 출입 제한. 특별·야간 행사, 한복·연령별 무료 조건은 별도 확인해 주세요.",
        "openingNote": "화요일 휴궁. 10월 09:00~18:00(입장마감 17:00), 11월 09:00~17:00(입장마감 16:00). 공휴일과 정기휴궁일이 겹치면 다음 첫 비공휴일에 쉬어요.",
        "accessNote": "3호선 경복궁역 5번 출구 또는 5호선 광화문역 2번 출구에서 궁 입구로 이동해요.",
        "accessSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R707000000.do?schGroupCode=gbg",
        "visitSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930144202825885&schM=view",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=gbg",
            "weekly": {
              "0": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "1": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "2": [],
              "3": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "4": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "5": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "6": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ]
            },
            "scope": "partial",
            "holidayPolicy": "same",
            "validFrom": "2026-10-07",
            "validThrough": "2026-11-06",
            "exceptions": {
              "2026-10-06": {
                "closed": true,
                "note": "전체 궁능 대체 휴관일"
              },
              "2026-11-01": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              },
              "2026-11-02": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              },
              "2026-11-03": {
                "closed": true
              },
              "2026-11-04": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              },
              "2026-11-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              },
              "2026-11-06": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "full",
                "note": "11월 일반 관람 시간"
              }
            },
            "note": "10월은 근정전 월대 출입제한으로 부분 관람 안내; 일반 주간 관람만 대상"
          },
          "price": {
            "kind": "exact",
            "label": "일반 개인 대인 입장",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R703000000.do",
            "verifiedAt": "2026-10-07",
            "amount": 3e3,
            "exceptions": {
              "2026-10-29": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-30": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-31": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-01": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-02": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-03": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-04": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-05": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-06": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-28": {
                "kind": "free",
                "amount": 0,
                "label": "매월 마지막 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260528151556017843&schM=view"
              }
            },
            "note": "내국인 만25~64세·외국인 만19~64세 일반 기준. 증빙 감면·한복·별도 특별관람 제외"
          }
        }
      },
      {
        "id": "changgyeonggung",
        "name": "창경궁",
        "category": "culture",
        "address": "서울특별시 종로구 창경궁로 185",
        "description": "궁궐 전각과 정원을 둘러보는 종로의 역사 공간. 주간과 야간의 공개 구역이 달라요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "국가유산청 궁능유적본부",
        "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
        "costNote": "일반 개인 대인 1,000원 · 내국인 만25~64세·외국인 만19~64세 기준 · 2026.10.7부터 수요일 무료",
        "visitNote": "10월은 18시, 11월은 17:30부터 야간개방구역으로 이동해요. 물빛연화 등 별도 예약 행사와 일반 입장은 구분해 주세요.",
        "openingNote": "월요일 휴궁. 일반 09:00~21:00(입장마감 20:00). 공휴일과 정기휴궁일이 겹치면 다음 첫 비공휴일에 쉬어요. 야간에는 공개 구역이 제한돼요.",
        "accessNote": "4호선 혜화역 4번 출구에서 성균관대 방면을 거쳐 창경궁·종로 방향으로 이동해요. 공식 안내상 2026년 말까지 주차장 잠정 폐쇄예요.",
        "accessSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R707000000.do?schGroupCode=cgg",
        "visitSourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R702000000.do?schGroupCode=cgg",
            "weekly": {
              "0": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "1": [],
              "2": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "3": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "4": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "5": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ],
              "6": [
                {
                  "open": "09:00",
                  "close": "18:00"
                }
              ]
            },
            "scope": "full",
            "holidayPolicy": "same",
            "validFrom": "2026-10-07",
            "validThrough": "2026-11-06",
            "exceptions": {
              "2026-10-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "18:00"
                  }
                ],
                "scope": "full",
                "note": "대체공휴일 정상 개방"
              },
              "2026-10-06": {
                "closed": true,
                "note": "대체공휴일 다음 날 전체 궁능 휴관"
              },
              "2026-11-01": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              },
              "2026-11-02": {
                "closed": true
              },
              "2026-11-03": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              },
              "2026-11-04": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              },
              "2026-11-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              },
              "2026-11-06": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:30"
                  }
                ],
                "scope": "full",
                "note": "11월은17:30부터 야간개방구역만 관람"
              }
            },
            "partialExtensions": [
              {
                "from": "2026-10-07",
                "through": "2026-10-31",
                "weekdays": [
                  0,
                  2,
                  3,
                  4,
                  5,
                  6
                ],
                "slots": [
                  {
                    "open": "18:00",
                    "close": "21:00",
                    "lastEntry": "20:00"
                  }
                ],
                "note": "야간개방구역만 관람 가능; 별도 예약 행사 제외"
              },
              {
                "from": "2026-11-01",
                "through": "2026-11-06",
                "weekdays": [
                  0,
                  2,
                  3,
                  4,
                  5,
                  6
                ],
                "slots": [
                  {
                    "open": "17:30",
                    "close": "21:00",
                    "lastEntry": "20:00"
                  }
                ],
                "note": "야간개방구역만 관람 가능"
              }
            ]
          },
          "price": {
            "kind": "exact",
            "label": "일반 개인 대인 입장",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R703000000.do",
            "verifiedAt": "2026-10-07",
            "amount": 1e3,
            "exceptions": {
              "2026-10-29": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-30": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-31": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-01": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-02": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-03": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-04": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              },
              "2026-11-05": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-11-06": {
                "kind": "free",
                "amount": 0,
                "label": "코리아 그랜드 페스티벌 일반 관람(휴궁일 제외)",
                "scope": "adult-one",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20260930093346212667&schM=view"
              },
              "2026-10-07": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              },
              "2026-10-14": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              },
              "2026-10-21": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              },
              "2026-10-28": {
                "kind": "free",
                "amount": 0,
                "label": "매주 수요일 일반 관람",
                "sourceUrl": "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20261007095901706396&schM=view"
              }
            },
            "note": "내국인 만25~64세·외국인 만19~64세 기준. 별도 예약 행사·증빙 감면 제외"
          }
        }
      },
      {
        "id": "national-folk-museum",
        "name": "국립민속박물관 본관",
        "category": "culture",
        "address": "서울특별시 종로구 삼청로 37",
        "description": "한국인의 생활문화와 민속을 살펴보는 무료 박물관. 경복궁 입장과는 별개예요.",
        "checkedAt": "2026-10-07",
        "sourceLabel": "국립민속박물관",
        "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
        "costNote": "본관 일반 관람 무료 · 경복궁 관람은 별도 유료",
        "visitNote": "상설전시관1은 2026.9.30~12.21(예정) 휴관. 주말·공휴일은 옥외전시장 내부 관람 제한. 10.13 14:00~14:10 소방훈련 안내가 있어요.",
        "openingNote": "3~10월 09:00~18:00, 수요일 20:00까지. 11~2월 09:00~17:00(야간연장 없음). 입장마감은 종료 1시간 전. 1월 1일·설·추석 당일 휴관.",
        "accessNote": "삼청로 37 본관 입구를 확인해 주세요. 무료 박물관 관람과 경복궁 유료 관람 동선을 구분해요.",
        "accessSourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
        "visitSourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
        "verifiedAt": "2026-10-07",
        "conditions": {
          "hours": {
            "verifiedAt": "2026-10-07",
            "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
            "weekly": {
              "0": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "1": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "2": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "3": [
                {
                  "open": "09:00",
                  "close": "20:00",
                  "lastEntry": "19:00"
                }
              ],
              "4": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "5": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ],
              "6": [
                {
                  "open": "09:00",
                  "close": "18:00",
                  "lastEntry": "17:00"
                }
              ]
            },
            "scope": "partial",
            "holidayPolicy": "same",
            "validFrom": "2026-10-07",
            "validThrough": "2026-11-06",
            "exceptions": {
              "2026-11-01": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-02": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-03": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-04": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-05": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              },
              "2026-11-06": {
                "slots": [
                  {
                    "open": "09:00",
                    "close": "17:00",
                    "lastEntry": "16:00"
                  }
                ],
                "scope": "partial",
                "note": "11월 동절기 시간, 상설전시관1 휴관 중"
              }
            },
            "note": "상설전시관1 휴관 기간으로 전체 관람 가능 여부는 미확인. 주말·공휴일 옥외전시장 내부도 제한"
          },
          "price": {
            "kind": "free",
            "label": "본관 일반 관람",
            "scope": "adult-one",
            "taxStatus": "not-stated",
            "sourceUrl": "https://nfm.go.kr/home/subIndex/1239.do",
            "verifiedAt": "2026-10-07",
            "amount": 0,
            "note": "경복궁 입장료 및 별도 상품·프로그램 제외"
          }
        }
      }
    ].map((place) => Object.freeze(place)));
  }
});

// experiences/path-travel/real-conditions.mjs?v=20261007-halfday1
var REAL_CONDITION_LABELS2;
var init_real_conditions2 = __esm({
  "experiences/path-travel/real-conditions.mjs?v=20261007-halfday1"() {
    REAL_CONDITION_LABELS2 = Object.freeze({
      none: "조건 없음",
      matched: "안내상 조건 맞음",
      unknown: "확인 필요",
      unmatched: "조건과 다름"
    });
  }
});

// experiences/path-travel/real-guide.mjs
var DomainModule2, Domain2, CATEGORIES2, REACTION_OPTIONS, VISIT_OPTIONS, VISIT_REASONS, CATEGORY_PREFERENCE_OPTIONS, categories, places, reasonIds, scope2, fieldSpecs, contract;
var init_real_guide = __esm({
  "experiences/path-travel/real-guide.mjs"() {
    init_real_places2();
    init_real_conditions2();
    DomainModule2 = __toESM(require_domain(), 1);
    Domain2 = DomainModule2.default ?? globalThis.SynkAtlasDomain;
    CATEGORIES2 = Object.freeze([
      { id: "food", label: "한식 한 끼" },
      { id: "tea", label: "차와 카페" },
      { id: "culture", label: "전시와 문화" },
      { id: "stay", label: "하룻밤 숙소" }
    ]);
    REACTION_OPTIONS = Object.freeze([
      { value: "interested", label: "관심 있어요" },
      { value: "less", label: "덜 보고 싶어요" }
    ]);
    VISIT_OPTIONS = Object.freeze([
      { value: "liked", label: "좋았어요" },
      { value: "disliked", label: "아쉬웠어요" }
    ]);
    VISIT_REASONS = Object.freeze([
      { id: "experience", label: "즐긴 경험" },
      { id: "atmosphere", label: "분위기" },
      { id: "value", label: "비용 대비 만족" },
      { id: "access", label: "이동·접근" },
      { id: "wait", label: "대기·혼잡" }
    ]);
    CATEGORY_PREFERENCE_OPTIONS = Object.freeze([
      { value: "more", label: "이 분야를 더 보고 싶어요" },
      { value: "less", label: "이 분야를 덜 보고 싶어요" }
    ]);
    categories = new Set(CATEGORIES2.map((item) => item.id));
    places = new Map(REAL_PLACES2.map((item) => [item.id, item]));
    reasonIds = new Set(VISIT_REASONS.map((item) => item.id));
    scope2 = Object.freeze({ domain: "PATH", workspace: "path-real-jongno", subject: "local-visitor" });
    fieldSpecs = [
      ...REAL_PLACES2.map((place) => ({ id: `reaction.${place.id}`, weight: 2 })),
      ...REAL_PLACES2.map((place) => ({ id: `visit.${place.id}`, weight: 3 })),
      ...CATEGORIES2.map((category) => ({ id: `category.${category.id}`, weight: 1 }))
    ];
    contract = Object.freeze({
      id: "path-real-opinions",
      version: "1",
      purpose: "order-real-places",
      fields: fieldSpecs.map(({ id: id2 }) => ({ id: id2, kind: "boolean" })),
      criteria: fieldSpecs.map(({ id: id2, weight }) => ({ id: id2, field: id2, feature: id2, weight, prefer: "match" }))
    });
  }
});

// atlas/trail-life.js
var require_trail_life = __commonJS({
  "atlas/trail-life.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkTrailLife = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const VERSION = "trail-life-1";
      const TYPES = ["life.fact", "life.corrected", "life.knowledge", "life.delivered"];
      const BASE = ["schema", "id", "scope", "seq", "type"];
      const FIELDS = {
        "life.fact": ["factType", "causes", "revisions", "knownBy"],
        "life.corrected": ["targetId"],
        "life.knowledge": ["factId", "npcId", "allowed", "viaId"],
        "life.delivered": ["reactionId", "deliveryId", "npcId", "semanticKey", "sourceIds", "revisions", "contentVersion", "mode"]
      };
      const copy2 = (value) => JSON.parse(JSON.stringify(value));
      const object3 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
      const id2 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      const integer3 = (value) => Number.isSafeInteger(value) && value >= 0;
      const list = (value, min = 0) => Array.isArray(value) && value.length >= min && value.length <= 64 && value.every(id2) && new Set(value).size === value.length;
      const exact3 = (value, keys2) => object3(value) && Object.keys(value).length === keys2.length && keys2.every((key) => Object.hasOwn(value, key));
      const revisions = (value) => object3(value) && Object.entries(value).length <= 64 && Object.entries(value).every(([key, revision]) => id2(key) && integer3(revision));
      const canonical = (value) => JSON.stringify(value, (_key, entry) => object3(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);
      function scopeKey(scope3) {
        if (!exact3(scope3, ["domain", "workspace", "subject"]) || !["LAB", "SHIFT", "PATH"].includes(scope3.domain) || !id2(scope3.workspace) || !id2(scope3.subject)) throw new TypeError("Trail Life: invalid scope");
        return JSON.stringify([scope3.domain, scope3.workspace, scope3.subject]);
      }
      function validate(event) {
        if (!object3(event) || !TYPES.includes(event.type) || !exact3(event, [...BASE, ...FIELDS[event.type]]) || event.schema !== 1 || !id2(event.id) || !integer3(event.seq) || event.seq < 1) throw new TypeError("Trail Life: invalid event fields");
        scopeKey(event.scope);
        if (event.type === "life.fact" && (!id2(event.factType) || !list(event.causes) || !revisions(event.revisions) || !list(event.knownBy))) {
          throw new TypeError("Trail Life: invalid fact");
        }
        if (event.type === "life.corrected" && !id2(event.targetId)) throw new TypeError("Trail Life: invalid correction");
        if (event.type === "life.knowledge" && (!id2(event.factId) || !id2(event.npcId) || typeof event.allowed !== "boolean" || (event.allowed ? !id2(event.viaId) : event.viaId !== null))) throw new TypeError("Trail Life: invalid knowledge");
        if (event.type === "life.delivered" && (![event.reactionId, event.deliveryId, event.npcId, event.semanticKey, event.contentVersion].every(id2) || !list(event.sourceIds, 1) || !revisions(event.revisions) || !["motion", "static", "text"].includes(event.mode))) {
          throw new TypeError("Trail Life: invalid delivery");
        }
        return event;
      }
      function read(events, scope3) {
        if (!Array.isArray(events)) throw new TypeError("Trail Life: log must be an array");
        const key = scopeKey(scope3), seen = /* @__PURE__ */ new Map(), facts = /* @__PURE__ */ new Map(), knowledge = /* @__PURE__ */ new Map(), deliveries = /* @__PURE__ */ new Map(), log = [];
        let sequence = 0;
        const know = (npcId, factId, value) => {
          if (!knowledge.has(npcId)) knowledge.set(npcId, /* @__PURE__ */ new Map());
          knowledge.get(npcId).set(factId, value);
        };
        const active = (factId) => facts.get(factId)?.active === true;
        const derivesFrom = (sourceId, targetId) => {
          const stack = [sourceId], visited = /* @__PURE__ */ new Set();
          while (stack.length) {
            const id3 = stack.pop();
            if (id3 === targetId) return true;
            if (visited.has(id3)) continue;
            visited.add(id3);
            stack.push(...facts.get(id3)?.event.causes || []);
          }
          return false;
        };
        const permitted = (npcId, factId, visited = /* @__PURE__ */ new Set()) => {
          const grant = knowledge.get(npcId)?.get(factId);
          if (!active(factId) || grant?.allowed !== true || visited.has(factId)) return false;
          if (grant.viaId === null) return true;
          if (grant.viaId === factId) return facts.get(factId).event.knownBy.includes(npcId);
          return permitted(npcId, grant.viaId, /* @__PURE__ */ new Set([...visited, factId]));
        };
        for (const event of events) {
          validate(event);
          if (scopeKey(event.scope) !== key) throw new Error("Trail Life: scope mismatch");
          if (seen.has(event.id)) {
            if (canonical(seen.get(event.id)) !== canonical(event)) throw new Error("Trail Life: conflicting event id");
            continue;
          }
          if (event.seq <= sequence) throw new Error("Trail Life: sequence must increase");
          if (event.type === "life.fact") {
            if (event.causes.some((cause) => !active(cause))) throw new Error("Trail Life: fact requires prior valid causes");
            facts.set(event.id, { event, active: true });
            for (const npc of event.knownBy) know(npc, event.id, { allowed: true, viaId: null });
          } else if (event.type === "life.corrected") {
            if (!facts.has(event.targetId)) throw new Error("Trail Life: correction requires a prior fact");
            facts.get(event.targetId).active = false;
            for (const fact of facts.values()) if (fact.event.causes.some((cause) => !active(cause))) fact.active = false;
          } else if (event.type === "life.knowledge") {
            if (!facts.has(event.factId)) throw new Error("Trail Life: knowledge requires a prior fact");
            if (event.allowed && (!active(event.factId) || !active(event.viaId) || !derivesFrom(event.viaId, event.factId) || !(permitted(event.npcId, event.viaId) || event.viaId === event.factId && facts.get(event.factId).event.knownBy.includes(event.npcId)))) {
              throw new Error("Trail Life: knowledge requires a witnessed source");
            }
            const own2 = knowledge.get(event.npcId)?.get(event.factId);
            if (!(event.allowed && own2?.allowed === true && own2.viaId === null)) know(event.npcId, event.factId, { allowed: event.allowed, viaId: event.viaId });
          } else {
            if (event.sourceIds.some((source) => !permitted(event.npcId, source))) throw new Error("Trail Life: delivery requires permitted facts");
            if (deliveries.has(event.deliveryId)) throw new Error("Trail Life: duplicate delivery id");
            deliveries.set(event.deliveryId, event);
          }
          seen.set(event.id, event);
          log.push(event);
          sequence = event.seq;
        }
        return { log, seen, facts, knowledge, deliveries, sequence, permitted };
      }
      function append(events, event, { currentRevisions } = {}) {
        validate(event);
        const prior = read(events, event.scope);
        if (prior.seen.has(event.id)) {
          if (canonical(prior.seen.get(event.id)) !== canonical(event)) throw new Error("Trail Life: conflicting event id");
          return copy2(prior.log);
        }
        if (event.type === "life.delivered") {
          const previous = prior.deliveries.get(event.deliveryId);
          if (previous) {
            const receipt = (value) => {
              const { id: ignoredId, seq: ignoredSeq, ...body } = value;
              return body;
            };
            if (canonical(receipt(previous)) !== canonical(receipt(event))) throw new Error("Trail Life: conflicting delivery id");
            return copy2(prior.log);
          }
          if (!revisions(currentRevisions) || Object.entries(event.revisions).some(([key, revision]) => !Object.hasOwn(currentRevisions, key) || currentRevisions[key] !== revision)) throw new Error("Trail Life: delivery revision mismatch");
        }
        return copy2(read([...prior.log, event], event.scope).log);
      }
      function summarize(events, { scope: scope3, complete = true } = {}) {
        if (typeof complete !== "boolean") throw new TypeError("Trail Life: invalid completeness");
        const state = read(events, scope3);
        const result = {
          version: VERSION,
          status: complete ? "ready" : "unknown",
          scope: copy2(scope3),
          sequence: state.sequence,
          facts: [],
          knowledge: {},
          deliveries: [],
          invalidated: [],
          learningEffectClaim: false
        };
        if (!complete) return result;
        result.facts = [...state.facts.values()].filter((f) => f.active).map((f) => copy2(f.event));
        result.invalidated = [...state.facts.values()].filter((f) => !f.active).map((f) => f.event.id);
        result.knowledge = Object.fromEntries([...state.knowledge].map(([npc, known]) => [npc, [...known.keys()].filter((factId) => state.permitted(npc, factId))]));
        result.deliveries = [...state.deliveries.values()].map(copy2);
        return result;
      }
      return Object.freeze({ VERSION, TYPES: Object.freeze([...TYPES]), scopeKey, validate, append, summarize });
    });
  }
});

// atlas/temper-outcomes.js
var require_temper_outcomes = __commonJS({
  "atlas/temper-outcomes.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkTemperOutcomes = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const OUTCOMES_VERSION = "temper-outcomes-1";
      function evaluateOutcomes({
        contract: contract2,
        decisions = [],
        exposures = [],
        outcomes = [],
        revisions = [],
        policies: policies2,
        subjects,
        asOf,
        minimumSubjects = 5,
        strictProvenance = false
      } = {}) {
        const fail6 = (message) => {
          throw new TypeError(`Temper outcomes: ${message}`);
        };
        const object3 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
        const token3 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
        const exact3 = (value, required, optional = []) => object3(value) && required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
        const number = (value) => typeof value === "number" && Number.isFinite(value);
        const instant = (value) => {
          const time2 = typeof value === "string" && value.length <= 40 ? Date.parse(value) : NaN;
          if (!Number.isFinite(time2)) fail6("invalid timestamp");
          return time2;
        };
        const canonical = (value) => JSON.stringify(value, (_key, entry) => object3(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);
        const scopeKey = (scope3) => {
          if (!exact3(scope3, ["domain", "workspace", "purpose"]) || !Object.values(scope3).every(token3)) fail6("invalid scope");
          if (scope3.domain === "PULSE") fail6("PULSE does not keep personal behavioral observations");
          return JSON.stringify([scope3.domain, scope3.workspace, scope3.purpose]);
        };
        const policyKey = (policy) => {
          if (!exact3(policy, ["id", "version"]) || !token3(policy.id) || !token3(policy.version)) fail6("invalid policy");
          return JSON.stringify([policy.id, policy.version]);
        };
        if (!exact3(contract2, ["id", "version", "scope", "outcome"]) || !token3(contract2.id) || !token3(contract2.version)) fail6("invalid contract");
        const sameContract = (ref) => exact3(ref, ["id", "version"]) && ref.id === contract2.id && ref.version === contract2.version;
        if (typeof strictProvenance !== "boolean" || !Array.isArray(revisions)) fail6("invalid provenance options");
        const trace = strictProvenance || revisions.length > 0;
        const boundary = scopeKey(contract2.scope), target = contract2.outcome;
        if (!exact3(target, ["id", "kind", "direction", "windowMs"], ["allowedValues", "range"]) || !token3(target.id) || !["binary", "numeric"].includes(target.kind) || !["higher", "lower"].includes(target.direction) || !Number.isSafeInteger(target.windowMs) || target.windowMs < 0) fail6("invalid outcome definition");
        if (target.kind === "binary") {
          if (Object.hasOwn(target, "range") || !Array.isArray(target.allowedValues) || target.allowedValues.length !== 2 || !target.allowedValues.includes(0) || !target.allowedValues.includes(1)) fail6("binary outcomes require allowedValues [0, 1]");
        } else if (Object.hasOwn(target, "allowedValues") || !Array.isArray(target.range) || target.range.length !== 2 || !target.range.every(number) || target.range[0] >= target.range[1] || !Number.isFinite(target.range[1] - target.range[0])) fail6("numeric outcomes require a finite increasing range");
        const valueOk = (value) => number(value) && (target.kind === "binary" ? target.allowedValues.includes(value) : value >= target.range[0] && value <= target.range[1]);
        if (!Array.isArray(subjects) || !subjects.every(token3) || new Set(subjects).size !== subjects.length) fail6("authorized subjects are required");
        if (!Array.isArray(policies2) || policies2.length !== 2 || new Set(policies2.map(policyKey)).size !== 2) fail6("two distinct policies are required");
        if (!Number.isSafeInteger(minimumSubjects) || minimumSubjects < 1) fail6("invalid minimum subjects");
        const cutoff = instant(asOf), allowed = new Set(subjects), keys2 = policies2.map(policyKey);
        const duplicateCounts = { decisions: 0, exposures: 0, outcomes: 0 };
        const records = (input, kind, required, optional = []) => {
          if (!Array.isArray(input)) fail6(`${kind} must be an array`);
          const found = /* @__PURE__ */ new Map();
          for (const row of input) {
            if (!exact3(row, ["id", "subject", "scope", "at", ...required], ["recordedAt", ...optional]) || !token3(row.id) || !token3(row.subject)) fail6(`invalid ${kind} record`);
            if (scopeKey(row.scope) !== boundary || !allowed.has(row.subject)) fail6("record outside authorized subject, workspace or purpose");
            const happened = instant(row.at), recorded = instant(row.recordedAt ?? row.at);
            if (recorded < happened) fail6("recorded before occurrence");
            if (happened > cutoff || recorded > cutoff) fail6("record occurs or arrives after evaluation time");
            if (found.has(row.id)) {
              if (canonical(found.get(row.id)) !== canonical(row)) fail6(`conflicting ${kind} id`);
              duplicateCounts[kind] += 1;
            } else found.set(row.id, row);
          }
          return found;
        };
        const ds = records(decisions, "decisions", ["contract", "policy", "candidateIds", "selectedId"], ["cost", "latencyMs"]);
        const es = records(exposures, "exposures", ["decisionId", "candidateId"], ["contract"]);
        const os = records(outcomes, "outcomes", ["exposureId", "value"], ["contract"]);
        if (trace) duplicateCounts.revisions = 0;
        const rs = records(revisions, "revisions", ["contract", "targetId", "action", "sourceRef"], ["value"]);
        const costUnits = /* @__PURE__ */ new Set(), delivered = /* @__PURE__ */ new Map(), observed = /* @__PURE__ */ new Map(), originalOutcomes = /* @__PURE__ */ new Map();
        const sameParent = (row, parent) => parent && row.subject === parent.subject && scopeKey(row.scope) === scopeKey(parent.scope) && instant(row.at) >= instant(parent.at) && instant(row.recordedAt ?? row.at) >= instant(parent.recordedAt ?? parent.at);
        for (const row of ds.values()) {
          if (!sameContract(row.contract)) fail6("decision outcome contract mismatch");
          if (!keys2.includes(policyKey(row.policy))) fail6("decision uses an unrequested policy");
          if (!Array.isArray(row.candidateIds) || !row.candidateIds.every(token3) || new Set(row.candidateIds).size !== row.candidateIds.length || !(row.selectedId === null || token3(row.selectedId) && row.candidateIds.includes(row.selectedId))) fail6("invalid decision candidates or selection");
          if (Object.hasOwn(row, "latencyMs") && (!number(row.latencyMs) || row.latencyMs < 0)) fail6("invalid latency");
          if (Object.hasOwn(row, "cost")) {
            if (!exact3(row.cost, ["value", "unit"]) || !number(row.cost.value) || row.cost.value < 0 || !token3(row.cost.unit)) fail6("invalid normalized cost");
            costUnits.add(row.cost.unit);
          }
        }
        if (costUnits.size > 1) fail6("incompatible cost units");
        for (const row of es.values()) {
          if ((trace || Object.hasOwn(row, "contract")) && !sameContract(row.contract)) fail6("exposure outcome contract mismatch");
          const parent = ds.get(row.decisionId);
          if (!token3(row.decisionId) || !token3(row.candidateId) || !sameParent(row, parent) || row.candidateId !== parent.selectedId) fail6("exposure requires the selected candidate and prior decision in the same scope and subject");
          if (delivered.has(parent.id)) fail6("multiple exposures for one decision");
          delivered.set(parent.id, row);
        }
        for (const row of os.values()) {
          if ((trace || Object.hasOwn(row, "contract")) && !sameContract(row.contract)) fail6("outcome contract mismatch");
          const parent = es.get(row.exposureId);
          if (!token3(row.exposureId) || !sameParent(row, parent) || !valueOk(row.value)) fail6("outcome requires valid value and prior exposure in the same scope and subject");
          if (observed.has(parent.id)) fail6("multiple outcomes for one exposure");
          observed.set(parent.id, row);
          originalOutcomes.set(parent.id, row);
        }
        const successor = /* @__PURE__ */ new Map();
        for (const row of rs.values()) {
          if (os.has(row.id)) fail6("revision id conflicts with an outcome");
          if (!sameContract(row.contract)) fail6("revision outcome contract mismatch");
          if (!token3(row.targetId) || !token3(row.sourceRef) || !["correct", "withdraw"].includes(row.action) || (row.action === "correct" ? !valueOk(row.value) : Object.hasOwn(row, "value"))) fail6("invalid revision");
          const parent = os.get(row.targetId) || rs.get(row.targetId);
          if (!sameParent(row, parent)) fail6("revision requires a prior outcome or revision in the same scope and subject");
          if (parent.action === "withdraw") fail6("withdrawn outcomes cannot be restored");
          if (successor.has(parent.id)) fail6("multiple revisions for one target");
          successor.set(parent.id, row);
        }
        const checked = /* @__PURE__ */ new Set();
        for (const row of rs.values()) {
          const path = /* @__PURE__ */ new Set();
          let current = row;
          while (current && !checked.has(current.id)) {
            if (path.has(current.id)) fail6("revision cycle");
            path.add(current.id);
            current = rs.get(current.targetId);
          }
          for (const id2 of path) checked.add(id2);
        }
        const histories = /* @__PURE__ */ new Map();
        for (const original of os.values()) {
          const history = [];
          let current = original;
          while (successor.has(current.id)) {
            current = successor.get(current.id);
            history.push(current);
          }
          histories.set(original.id, history);
          if (current.action === "withdraw") observed.delete(original.exposureId);
          else if (current !== original) observed.set(original.exposureId, { ...original, value: current.value });
        }
        const sum = (values) => {
          const total = values.reduce((accumulated, value) => accumulated + value, 0);
          if (!Number.isFinite(total)) fail6("metric total exceeds supported range");
          return total;
        };
        const mean = (values) => values.length ? [...values].sort((a, b) => a - b).reduce((average, value, index) => average + (value - average) / (index + 1), 0) : null;
        const byPolicy = policies2.map((policy) => {
          const rows = [...ds.values()].filter((row) => policyKey(row.policy) === policyKey(policy));
          const people = /* @__PURE__ */ new Map(), costs = [], latencies = [];
          const counts = {
            decisions: rows.length,
            abstained: 0,
            delivered: 0,
            undelivered: 0,
            pending: 0,
            matured: 0,
            observed: 0,
            missing: 0,
            late: 0
          };
          for (const row of rows) {
            if (row.cost) costs.push(row.cost.value);
            if (row.latencyMs != null) latencies.push(row.latencyMs);
            if (row.selectedId === null) {
              counts.abstained += 1;
              continue;
            }
            const exposure = delivered.get(row.id);
            if (!exposure) {
              counts.undelivered += 1;
              continue;
            }
            counts.delivered += 1;
            const end = instant(exposure.at) + target.windowMs, result = observed.get(exposure.id);
            if (!Number.isSafeInteger(end)) fail6("observation window exceeds supported time");
            if (end > cutoff) {
              counts.pending += 1;
              continue;
            }
            counts.matured += 1;
            if (!result || instant(result.at) > end) {
              counts.missing += 1;
              if (result) counts.late += 1;
              continue;
            }
            counts.observed += 1;
            if (!people.has(row.subject)) people.set(row.subject, []);
            people.get(row.subject).push(result.value);
          }
          const subjectMeans = [...people.values()].map(mean), subjectCount = people.size;
          return {
            policy: { ...policy },
            counts,
            subjects: { decided: new Set(rows.map((row) => row.subject)).size, observed: subjectCount },
            status: !subjectCount ? "no_sample" : subjectCount < minimumSubjects ? "insufficient_evidence" : "measured",
            mean: mean(subjectMeans),
            measurementCompletion: counts.matured ? counts.observed / counts.matured : null,
            cost: {
              unit: [...costUnits][0] || null,
              recorded: costs.length,
              missing: rows.length - costs.length,
              total: costs.length ? sum(costs) : null,
              mean: mean(costs)
            },
            latencyMs: {
              recorded: latencies.length,
              missing: rows.length - latencies.length,
              mean: mean(latencies),
              max: latencies.length ? latencies.reduce((max, value) => Math.max(max, value), 0) : null
            }
          };
        });
        const [baseline, candidate] = byPolicy;
        const comparable = byPolicy.every((row) => row.status === "measured");
        const difference = comparable ? candidate.mean - baseline.mean : null;
        const directedDifference = difference === null ? null : difference * (target.direction === "higher" ? 1 : -1);
        return {
          version: OUTCOMES_VERSION,
          contract: { id: contract2.id, version: contract2.version, scope: { ...contract2.scope }, outcome: JSON.parse(JSON.stringify(target)) },
          asOf,
          minimumSubjects,
          byPolicy,
          duplicates: duplicateCounts,
          ...trace ? { provenance: { version: "temper-outcome-provenance-1", chains: [...ds.values()].sort((a, b) => a.id.localeCompare(b.id)).map((decision) => {
            const exposure = delivered.get(decision.id), original = exposure && originalOutcomes.get(exposure.id);
            const history = original ? histories.get(original.id) : [], latest = history.at(-1);
            return {
              decisionId: decision.id,
              exposureId: exposure?.id || null,
              outcomeId: original?.id || null,
              status: decision.selectedId === null ? "abstained" : !exposure ? "undelivered" : !original ? "unobserved" : latest?.action === "withdraw" ? "withdrawn" : latest ? "corrected" : "observed",
              effectiveOutcomeId: original && latest?.action !== "withdraw" ? latest?.id || original.id : null,
              revisions: history.map((row) => ({
                id: row.id,
                targetId: row.targetId,
                action: row.action,
                sourceRef: row.sourceRef,
                at: row.at,
                recordedAt: row.recordedAt ?? row.at,
                ...row.action === "correct" ? { value: row.value } : {}
              }))
            };
          }) } } : {},
          comparison: {
            status: comparable ? "measured" : "insufficient_evidence",
            difference,
            directedDifference,
            direction: directedDifference === null ? "unknown" : directedDifference < 0 ? "worse" : directedDifference > 0 ? "better" : "unchanged",
            unit: "subject-mean-of-observed-matured-outcomes"
          },
          causalClaim: false,
          significanceTested: false,
          calibrated: false,
          policyPromotion: false,
          limitations: [
            "The host authorizes subjects and purpose; this function does not authenticate or grant consent.",
            "Observed outcomes describe the supplied records; missing responses are unknown, not failures.",
            "Selection, nonresponse and different people can bias policy means; this is not a causal or significance test."
          ]
        };
      }
      function summarizePreparation({ scope: scope3, subject, records = [], asOf } = {}) {
        const object3 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
        const token3 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
        const fail6 = (message) => {
          throw new TypeError(`Temper preparation: ${message}`);
        };
        if (!object3(scope3) || Object.keys(scope3).sort().join(",") !== "domain,purpose,workspace" || !Object.values(scope3).every(token3) || scope3.domain === "PULSE" || !token3(subject)) fail6("invalid boundary");
        const time2 = (value) => {
          const at = typeof value === "string" ? Date.parse(value) : NaN;
          if (!Number.isFinite(at)) fail6("invalid time");
          return at;
        };
        const cutoff = time2(asOf), seen = /* @__PURE__ */ new Set(), durations = [], ratings = [];
        let selected = 0;
        if (!Array.isArray(records) || records.length > 1e4) fail6("invalid records");
        for (const row of records) {
          if (!object3(row) || Object.keys(row).some((key) => !["id", "scope", "subject", "shownAt", "selectedAt", "elapsedSeconds", "satisfaction", "satisfactionAt"].includes(key)) || !token3(row.id) || row.subject !== subject || !object3(row.scope) || Object.keys(row.scope).length !== 3 || Object.keys(scope3).some((key) => row.scope[key] !== scope3[key])) fail6("foreign or invalid record");
          if (seen.has(row.id)) fail6("duplicate record");
          seen.add(row.id);
          const shown = time2(row.shownAt), chosen = row.selectedAt == null ? null : time2(row.selectedAt);
          if (shown > cutoff || chosen !== null && (chosen < shown || chosen > cutoff)) fail6("invalid selection chronology");
          if (chosen !== null) selected += 1;
          if (row.elapsedSeconds != null) {
            if (chosen === null || !Number.isSafeInteger(row.elapsedSeconds) || row.elapsedSeconds < 0 || row.elapsedSeconds > 86400 || row.elapsedSeconds > Math.floor((chosen - shown) / 1e3)) fail6("invalid preparation duration");
            durations.push(row.elapsedSeconds);
          }
          if (row.satisfaction == null !== (row.satisfactionAt == null)) fail6("incomplete self-report");
          if (row.satisfaction != null) {
            const rated = time2(row.satisfactionAt);
            if (chosen === null || rated < chosen || rated > cutoff || !Number.isInteger(row.satisfaction) || row.satisfaction < 1 || row.satisfaction > 5) fail6("invalid self-report");
            ratings.push(row.satisfaction);
          }
        }
        const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
        return {
          version: "temper-preparation-1",
          shown: records.length,
          selected,
          unselected: records.length - selected,
          timed: durations.length,
          averageSeconds: mean(durations),
          rated: ratings.length,
          unrated: selected - ratings.length,
          averageSatisfaction: mean(ratings),
          causalClaim: false,
          relationshipQuality: null
        };
      }
      return Object.freeze({ OUTCOMES_VERSION, evaluateOutcomes, summarizePreparation });
    });
  }
});

// experiences/path-travel/planner-feedback.mjs
function atTime(now) {
  const at = now ?? (/* @__PURE__ */ new Date()).toISOString();
  if (!isTravelTime(at)) fail3("기록 시각을 확인해 주세요.");
  return at;
}
function validateTravelJournal(journal, { now = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  if (!journal || Object.keys(journal).sort().join(",") !== "decisions,exposures,outcomes,trail" || Object.values(journal).some((rows) => !Array.isArray(rows) || rows.length > 600)) fail3("여행 기록의 연결 형식을 확인해 주세요.");
  const summary = Trail.summarize(journal.trail, { scope: TRAVEL_SCOPE });
  const validFacts = new Map(summary.facts.map((fact) => [fact.id, fact]));
  for (const [rows, type] of [[journal.decisions, "travel.decision"], [journal.exposures, "travel.exposure"], [journal.outcomes, "travel.outcome"]]) {
    for (const row of rows) {
      const fact = validFacts.get(row.id);
      if (!fact || fact.factType !== type) fail3("선택·노출·방문 기록의 출처가 이어지지 않아요.");
      const parent = row.decisionId ?? row.exposureId;
      if (parent && !fact.causes.includes(parent)) fail3("여행 기록의 앞선 사건을 확인해 주세요.");
    }
  }
  Temper.evaluateOutcomes({ contract: TRAVEL_OUTCOME_CONTRACT, ...journal, policies, subjects: [TRAVEL_SCOPE.subject], asOf: atTime(now), strictProvenance: true });
  return clone(journal);
}
var TrailModule, TemperModule, Trail, Temper, TRAVEL_SCOPE, outcomeScope, TRAVEL_OUTCOME_CONTRACT, contractRef, policies, TRAVEL_PREFERENCE_KEYS, TRAVEL_VISIT_REASONS, clone, isTravelTime, fail3;
var init_planner_feedback = __esm({
  "experiences/path-travel/planner-feedback.mjs"() {
    TrailModule = __toESM(require_trail_life(), 1);
    TemperModule = __toESM(require_temper_outcomes(), 1);
    Trail = TrailModule.default ?? globalThis.SynkTrailLife;
    Temper = TemperModule.default ?? globalThis.SynkTemperOutcomes;
    TRAVEL_SCOPE = Object.freeze({ domain: "PATH", workspace: "path-travel-v4", subject: "local-visitor" });
    outcomeScope = Object.freeze({ domain: "PATH", workspace: "path-travel-v4", purpose: "own-trip-review" });
    TRAVEL_OUTCOME_CONTRACT = Object.freeze({
      id: "path-trip-self-report",
      version: "1",
      scope: outcomeScope,
      outcome: { id: "visit-satisfaction", kind: "numeric", direction: "higher", range: [1, 5], windowMs: 31 * 864e5 }
    });
    contractRef = { id: TRAVEL_OUTCOME_CONTRACT.id, version: TRAVEL_OUTCOME_CONTRACT.version };
    policies = [{ id: "path-real-guide", version: "3" }, { id: "path-travel", version: "4" }];
    TRAVEL_PREFERENCE_KEYS = Object.freeze([
      "indoor",
      "outdoor",
      "food",
      "tea",
      "culture",
      "history",
      "art",
      "walk",
      "quiet",
      "vegetarian",
      "stepFree",
      "noodles",
      "dumplings",
      "soup",
      "templeFood",
      "marketFood",
      "coffee",
      "bakery",
      "traditionalTea"
    ]);
    TRAVEL_VISIT_REASONS = Object.freeze([
      { id: "experience", label: "즐긴 경험" },
      { id: "atmosphere", label: "분위기" },
      { id: "value", label: "가격 대비 만족" },
      { id: "walking", label: "걷는 양" },
      { id: "crowds", label: "대기·혼잡" },
      { id: "access", label: "이동·접근" }
    ]);
    clone = (value) => JSON.parse(JSON.stringify(value));
    isTravelTime = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
    fail3 = (message) => {
      throw new TypeError(message);
    };
  }
});

// experiences/path-travel/planner-storage.mjs
function jsonCopy(value) {
  let nodes = 0;
  const ancestors = /* @__PURE__ */ new Set();
  const visit = (entry, depth) => {
    if (++nodes > 8e4 || depth > 24) fail4("여행 기록이 너무 복잡해 불러오지 않았어요.");
    if (entry === null || typeof entry === "boolean") return;
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) fail4();
      return;
    }
    if (typeof entry === "string") {
      if (entry.length > 2e4 || /\u0000/.test(entry)) fail4();
      return;
    }
    if (typeof entry !== "object" || ancestors.has(entry)) fail4();
    if (!Array.isArray(entry) && ![Object.prototype, null].includes(Object.getPrototypeOf(entry))) fail4();
    ancestors.add(entry);
    for (const key of Reflect.ownKeys(entry)) {
      if (Array.isArray(entry) && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, "value") || Array.isArray(entry) && !/^(0|[1-9]\d*)$/.test(key)) fail4();
      visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(entry) && Object.keys(entry).length !== entry.length) fail4();
    ancestors.delete(entry);
  };
  visit(value, 0);
  const raw = JSON.stringify(value);
  if (encoder.encode(raw).byteLength > TRAVEL_MAX_BYTES) fail4("여행 기록은 512 KB까지 불러올 수 있어요.");
  return JSON.parse(raw);
}
function validateStoredLeg(leg) {
  if (!exact2(
    leg,
    ["fromId", "toId", "distanceMeters", "minMinutes", "maxMinutes", "coordinates", "source", "estimated", "label", "departureTime", "arrivalTime"],
    ["sourceAt", "unknownAccess", "steps", "connectorMeters", "notice", "assumptions", "stepFreeVerified"]
  ) || !token2(leg.fromId) || !token2(leg.toId) || !Number.isFinite(leg.distanceMeters) || leg.distanceMeters < 0 || leg.distanceMeters > 1e7 || !integer2(leg.minMinutes, 0, 1440) || !integer2(leg.maxMinutes, leg.minMinutes, 1440) || !Array.isArray(leg.coordinates) || leg.coordinates.length < 2 || leg.coordinates.length > 8192 || !leg.coordinates.every(coordinate) || !text3(leg.source, 160) || !leg.source.length || leg.estimated !== true || !text3(leg.label, 500) || !time(leg.departureTime) || !time(leg.arrivalTime) || minute(leg.arrivalTime) - minute(leg.departureTime) !== leg.maxMinutes) fail4("저장된 이동 경로·시각·좌표를 확인해 주세요.");
  for (const key of ["unknownAccess", "steps", "stepFreeVerified"]) if (Object.hasOwn(leg, key) && typeof leg[key] !== "boolean") fail4("저장된 이동 조건을 확인해 주세요.");
  for (const key of ["notice", "assumptions"]) if (Object.hasOwn(leg, key) && !text3(leg[key])) fail4("저장된 이동 안내를 확인해 주세요.");
  if (Object.hasOwn(leg, "sourceAt") && (!text3(leg.sourceAt, 40) || !Number.isFinite(Date.parse(leg.sourceAt)))) fail4("지도 자료 확인 시각을 확인해 주세요.");
  if (Object.hasOwn(leg, "connectorMeters") && (!Number.isFinite(leg.connectorMeters) || leg.connectorMeters < 0 || leg.connectorMeters > 1e7)) fail4("지도 연결 구간의 거리를 확인해 주세요.");
}
function validatePlan(plan, query) {
  if (plan === null) return null;
  if (!exact2(plan, ["id", "status", "stops", "legs", "walking", "cost", "startTime", "endTime", "reasons", "checks", "lockedIds", "inputFingerprint"], ["score", "label", "destination", "returnLeg"]) || !token2(plan.id) || !["ready", "partial"].includes(plan.status) || !token2(plan.inputFingerprint) || !time(plan.startTime) || !time(plan.endTime) || minute(plan.startTime) >= minute(plan.endTime) || plan.startTime !== query.startTime || minute(plan.endTime) > minute(query.endTime) || !texts(plan.reasons) || !Array.isArray(plan.stops) || plan.stops.length < (query.planningMode === "remaining" ? 1 : 2) || plan.stops.length > query.stopCount || !Array.isArray(plan.legs) || plan.legs.length !== plan.stops.length || Object.hasOwn(plan, "score") && !Number.isFinite(plan.score) || Object.hasOwn(plan, "label") && !text3(plan.label, 160)) fail4("저장된 여행안의 구조를 확인하지 못했어요. 현재 기록은 유지했어요.");
  const stopIds = /* @__PURE__ */ new Set();
  for (const stop of plan.stops) {
    if (!exact2(stop, ["placeId", "place", "arrivalTime", "departureTime", "stayMinutes", "waitMinutes", "schedule", "cost", "reasons"], ["stayProvenance", "pauses", "preStartPause"]) || !places2.has(stop.placeId) || stopIds.has(stop.placeId) || !object2(stop.place) || stop.place.id !== stop.placeId || !time(stop.arrivalTime) || !time(stop.departureTime) || !integer2(stop.stayMinutes, 1, 1440) || !integer2(stop.waitMinutes, 0, 1440) || minute(stop.departureTime) - minute(stop.arrivalTime) !== stop.stayMinutes || Object.hasOwn(stop, "stayProvenance") && stop.stayProvenance !== "estimated" || !texts(stop.reasons)) fail4("저장된 장소의 방문 시각·체류시간을 확인해 주세요.");
    if (Object.hasOwn(stop, "pauses")) {
      if (!Array.isArray(stop.pauses) || stop.pauses.length > 288) fail4("저장된 쉬는 시간의 목록을 확인해 주세요.");
      let previousEnd = minute(stop.arrivalTime), totalPause = 0;
      for (const pause of stop.pauses) {
        if (!exact2(pause, ["startTime", "endTime", "durationMinutes", "kind", "locationStatus"]) || !time(pause.startTime) || !time(pause.endTime) || !integer2(pause.durationMinutes, 5, 30) || minute(pause.endTime) - minute(pause.startTime) !== pause.durationMinutes || minute(pause.startTime) < previousEnd || minute(pause.endTime) > minute(stop.departureTime) || pause.kind !== "planned-rest" || pause.locationStatus !== "unverified") fail4("저장된 쉬는 시간·순서·장소 확인 상태를 확인해 주세요.");
        previousEnd = minute(pause.endTime);
        totalPause += pause.durationMinutes;
      }
      if (totalPause >= stop.stayMinutes) fail4("쉬는 시간 외에 장소를 방문할 시간이 남아 있어야 해요.");
    }
    const place = placeById.get(stop.placeId);
    if (!object2(place.coordinates) || !coordinate([place.coordinates.lon, place.coordinates.lat])) fail4("현재 위치 자료가 없는 장소가 들어 있어 여행 지도를 열 수 없어요.");
    stopIds.add(stop.placeId);
    const schedule = stop.schedule;
    if (!exact2(schedule, ["status", "label", "reason"], ["sourceUrl"]) || !["matched", "unknown"].includes(schedule.status) || !text3(schedule.label, 160) || !text3(schedule.reason) || Object.hasOwn(schedule, "sourceUrl") && !publicUrl2(schedule.sourceUrl)) fail4("저장된 운영 안내의 형식을 확인해 주세요.");
    const cost2 = stop.cost;
    if (!exact2(cost2, ["knownAmount", "status", "unknowns", "items"]) || !amount(cost2.knownAmount) || !["matched", "unknown"].includes(cost2.status) || !texts(cost2.unknowns) || !Array.isArray(cost2.items) || cost2.items.length > 40 || (cost2.status === "matched" ? cost2.unknowns.length !== 0 : cost2.unknowns.length === 0)) fail4("저장된 장소의 비용 안내를 확인해 주세요.");
    for (const item of cost2.items) {
      if (!exact2(item, ["label", "quantity", "unitAmount", "amount", "basis", "sourceUrl"]) || !text3(item.label, 500) || !integer2(item.quantity, 1, 40) || !amount(item.unitAmount) || !amount(item.amount) || item.quantity * item.unitAmount !== item.amount || !["suggested-menu", "adult-admission", "child-admission"].includes(item.basis) || !publicUrl2(item.sourceUrl)) fail4("저장된 비용 항목의 인원·금액·출처를 확인해 주세요.");
      if (item.quantity !== (item.basis === "child-admission" ? query.party.children : query.party.adults)) fail4("저장된 비용 항목의 인원과 여행 인원이 맞지 않아요.");
    }
    const adultItems = cost2.items.filter((item) => item.basis !== "child-admission"), childItems = cost2.items.filter((item) => item.basis === "child-admission");
    if (adultItems.length > 1 || childItems.length > 1 || cost2.status === "matched" && (adultItems.length !== 1 || query.party.children > 0 && childItems.length !== 1)) fail4("저장된 인원별 비용의 확인 상태가 맞지 않아요.");
    if (cost2.items.reduce((sum, item) => sum + item.amount, 0) !== cost2.knownAmount) fail4("저장된 장소 비용의 합계가 맞지 않아요.");
    stop.place = jsonCopy(place);
  }
  if (!uniqueIds(plan.lockedIds, stopIds) || plan.lockedIds.length !== query.lockedIds.length || query.lockedIds.some((id2) => !stopIds.has(id2) || !plan.lockedIds.includes(id2))) fail4("저장된 유지 장소와 여행 조건이 맞지 않아요.");
  if (query.excludedIds.some((id2) => stopIds.has(id2))) fail4("제외한 장소가 저장된 일정에 포함되어 있어요.");
  if (query.requiredCategories.some((category) => !plan.stops.some((stop) => stop.place.category === category))) fail4("필수 포함 분야와 저장된 일정이 맞지 않아요.");
  for (const [index, leg] of plan.legs.entries()) {
    validateStoredLeg(leg);
    if (leg.toId !== plan.stops[index].placeId || leg.fromId !== (index ? plan.stops[index - 1].placeId : query.origin.id) || !sameCoordinate(leg.coordinates[0], index ? plan.legs[index - 1].coordinates.at(-1) : [query.origin.lon, query.origin.lat]) || leg.departureTime !== (index ? plan.stops[index - 1].departureTime : plan.startTime) || minute(plan.stops[index].arrivalTime) - minute(leg.arrivalTime) !== plan.stops[index].waitMinutes) fail4("저장된 이동 경로·시각·좌표를 확인해 주세요.");
    const stop = plan.stops[index];
    if (Object.hasOwn(stop, "preStartPause")) {
      const pause = stop.preStartPause;
      if (!exact2(pause, ["startTime", "endTime", "durationMinutes", "kind", "locationStatus"]) || !time(pause.startTime) || !time(pause.endTime) || !integer2(pause.durationMinutes, 5, 30) || minute(pause.endTime) - minute(pause.startTime) !== pause.durationMinutes || pause.startTime !== leg.arrivalTime || minute(pause.endTime) > minute(stop.arrivalTime) || pause.durationMinutes > stop.waitMinutes || query.restEveryMinutes === null || pause.durationMinutes !== query.restDurationMinutes || !query.appointments.some((row) => row.placeId === stop.placeId) && !(query.meal.mode === "window" && stop.place.category === "food") || pause.kind !== "planned-rest" || pause.locationStatus !== "unverified") fail4("방문 시작 전 쉬는 시간은 도착 뒤 대기 시간 안에 있어야 해요.");
    }
  }
  const lastStop = plan.stops.at(-1), allLegs = [...plan.legs];
  if (query.destination !== null) {
    const destination = plan.destination;
    if (!exact2(destination, ["id", "name", "lat", "lon"]) || ["id", "name", "lat", "lon"].some((key) => destination[key] !== query.destination[key])) fail4("저장된 마지막 도착지와 여행 조건이 맞지 않아요.");
    validateStoredLeg(plan.returnLeg);
    const leg = plan.returnLeg;
    if (leg.fromId !== lastStop.placeId || leg.toId !== destination.id || leg.departureTime !== lastStop.departureTime || leg.arrivalTime !== plan.endTime || !sameCoordinate(leg.coordinates[0], plan.legs.at(-1).coordinates.at(-1)) || !sameCoordinate(leg.coordinates.at(-1), [destination.lon, destination.lat])) fail4("마지막 도착지까지의 이동 경로·시각·좌표가 맞지 않아요.");
    allLegs.push(leg);
  } else if (plan.destination != null || plan.returnLeg != null || plan.endTime !== lastStop.departureTime) {
    fail4("저장된 마지막 도착지와 일정 종료 시각을 확인해 주세요.");
  }
  const requiredChecks2 = assessPlannerRequirements(plan.stops, query, { legs: plan.legs, returnLeg: plan.returnLeg ?? null });
  if (requiredChecks2.some((check2) => check2.status !== "matched")) fail4("저장된 일정의 필수 조건을 현재 장소·이동 자료로 확인하지 못했어요. 파일과 현재 기록은 바꾸지 않았어요. 조건과 장소 자료를 확인해 주세요.");
  if (query.appointments.some((appointment) => !plan.stops.some((stop) => stop.placeId === appointment.placeId && stop.arrivalTime === appointment.time))) fail4("저장된 일정이 예약 장소·시각과 맞지 않아요.");
  const meals = plan.stops.filter((stop) => stop.place.category === "food");
  if (query.meal.mode === "none" && meals.length || query.meal.mode === "window" && (!meals.length || meals.some((stop) => stop.arrivalTime < query.meal.startTime || stop.arrivalTime > query.meal.endTime))) fail4("저장된 일정이 식사 조건과 맞지 않아요.");
  const walking = plan.walking, cost = plan.cost;
  if (!exact2(walking, ["minMinutes", "maxMinutes", "scope", "label"]) || !integer2(walking.minMinutes, 0, 1440) || !integer2(walking.maxMinutes, walking.minMinutes, 1440) || walking.scope !== "between-places" || !text3(walking.label, 500) || walking.minMinutes !== allLegs.reduce((sum, leg) => sum + leg.minMinutes, 0) || walking.maxMinutes !== allLegs.reduce((sum, leg) => sum + leg.maxMinutes, 0) || walking.maxMinutes > query.maxWalkMinutes || query.maxLegWalkMinutes !== null && allLegs.some((leg) => leg.maxMinutes > query.maxLegWalkMinutes)) fail4("저장된 도보 합계·상한이 맞지 않아요.");
  if (!exact2(cost, ["knownAmount", "unknownPlaceIds", "status", "notes"]) || !amount(cost.knownAmount) || !uniqueIds(cost.unknownPlaceIds, stopIds) || !["matched", "unknown"].includes(cost.status) || !texts(cost.notes) || cost.knownAmount !== plan.stops.reduce((sum, stop) => sum + stop.cost.knownAmount, 0) || cost.status !== (cost.unknownPlaceIds.length ? "unknown" : "matched") || JSON.stringify(cost.unknownPlaceIds) !== JSON.stringify(plan.stops.filter((stop) => stop.cost.status === "unknown").map((stop) => stop.placeId))) fail4("저장된 여행 비용의 합계를 확인해 주세요.");
  if (cost.knownAmount > query.budget || query.budget === 0 && cost.status !== "matched") fail4("저장된 여행 비용이 예산 조건과 맞지 않아요. 0원 예산은 무료로 확인된 장소만 가능해요.");
  if (!Array.isArray(plan.checks) || plan.checks.length > 200 || plan.checks.some((check2) => !exact2(check2, ["kind", "status", "reason"], ["placeId"]) || !token2(check2.kind) || !["matched", "unknown"].includes(check2.status) || !text3(check2.reason) || Object.hasOwn(check2, "placeId") && !(stopIds.has(check2.placeId) || /^transfer-[0-4]$/.test(check2.placeId) || plan.returnLeg && check2.placeId === "return-transfer"))) fail4("저장된 확인 항목의 형식을 확인해 주세요.");
  if (plan.stops.some((stop) => (stop.preStartPause || stop.pauses?.length) && !plan.checks.some((check2) => check2.kind === "rest-place" && check2.status === "unknown" && check2.placeId === stop.placeId))) fail4("쉬는 장소의 미확인 안내가 빠져 있어요.");
  if (plan.status === "ready" && (plan.checks.some((check2) => check2.status === "unknown") || cost.status === "unknown" || plan.stops.some((stop) => stop.schedule.status === "unknown"))) fail4("저장된 일정의 완료 조건이 일치하지 않아요.");
  if (!matchesPlannerInputFingerprint(query, plan.inputFingerprint)) fail4("저장된 일정과 날짜·여행 조건이 맞지 않아요. 조건을 바꾸려면 새 일정을 만들어 주세요.");
  return plan;
}
function validateProgress(progress, memory) {
  if (!exact2(progress, ["date", "currentTime", "completed", "skippedIds", "requiredCategories", "finished", "updatedAt"]) || memory.query.planningMode !== "remaining" || progress.date !== memory.query.date || !Array.isArray(progress.completed) || progress.completed.length > dayPlaces.size || !uniqueIds(progress.skippedIds, dayPlaces, dayPlaces.size) || progress.completed.length + progress.skippedIds.length > dayPlaces.size || !time(progress.currentTime) || !uniqueIds(progress.requiredCategories, /* @__PURE__ */ new Set(["food", "tea", "culture"]), 3) || typeof progress.finished !== "boolean" || !isTravelTime(progress.updatedAt) || !progress.finished && minute(progress.currentTime) > minute(memory.query.startTime) || Date.parse(progress.updatedAt) > Date.parse(memory.updatedAt)) fail4("여행 진행 기록의 날짜·형식·기록 시각을 확인해 주세요.");
  const completedIds = /* @__PURE__ */ new Set();
  for (const entry of progress.completed) {
    if (!exact2(entry, ["placeId", "completedTime"]) || !dayPlaces.has(entry.placeId) || completedIds.has(entry.placeId) || progress.skippedIds.includes(entry.placeId) || !time(entry.completedTime) || minute(entry.completedTime) > minute(progress.currentTime)) fail4("완료한 장소와 완료 시각을 확인해 주세요.");
    completedIds.add(entry.placeId);
  }
  const removedIds = /* @__PURE__ */ new Set([...completedIds, ...progress.skippedIds]);
  if ([...removedIds].some((id2) => !memory.query.excludedIds.includes(id2)) || memory.plan?.stops.some((stop) => removedIds.has(stop.placeId)) || memory.plan && memory.plan.startTime !== memory.query.startTime || progress.finished && memory.plan !== null) fail4("완료·건너뛴 장소와 남은 일정이 맞지 않아요.");
  return progress;
}
function validateTravelMemory(value, { now } = {}) {
  const memory = jsonCopy(value);
  timestamp(now);
  if (!exact2(memory, ["format", "version", "consent", "query", "plan", "confirmedPreferences", "visits", "journal", "updatedAt"], ["progress"]) || memory.format !== TRAVEL_FORMAT || memory.version !== 1 || typeof memory.consent !== "boolean" || !isTravelTime(memory.updatedAt)) fail4();
  memory.query = normalizePlannerInput(memory.query, { places: TRAVEL_PLACES });
  memory.plan = validatePlan(memory.plan, memory.query);
  if (Object.hasOwn(memory, "progress")) memory.progress = validateProgress(memory.progress, memory);
  const validTime = (value2) => isTravelTime(value2) && Date.parse(value2) <= Date.parse(memory.updatedAt);
  if (!Array.isArray(memory.visits) || memory.visits.length > 150 || !Array.isArray(memory.confirmedPreferences) || memory.confirmedPreferences.length > TRAVEL_PREFERENCE_KEYS.length) fail4();
  const visitIds = /* @__PURE__ */ new Set();
  for (const visit of memory.visits) {
    if (!exact2(visit, ["id", "placeId", "planId", "decisionId", "rating", "reasons", "at", "source"]) || !token2(visit.id) || visitIds.has(visit.id) || !places2.has(visit.placeId) || visit.planId !== null && !token2(visit.planId) || visit.decisionId !== null && !token2(visit.decisionId) || !Number.isInteger(visit.rating) || visit.rating < 1 || visit.rating > 5 || !validTime(visit.at) || visit.source !== "self-reported" || !Array.isArray(visit.reasons) || new Set(visit.reasons).size !== visit.reasons.length || visit.reasons.some((reason) => !TRAVEL_VISIT_REASONS.some((option) => option.id === reason))) fail4();
    visitIds.add(visit.id);
  }
  const keys2 = /* @__PURE__ */ new Set();
  for (const preference of memory.confirmedPreferences) {
    if (!exact2(preference, ["id", "key", "value", "status", "confirmedAt", "source"]) || !token2(preference.id) || !TRAVEL_PREFERENCE_KEYS.includes(preference.key) || keys2.has(preference.key) || typeof preference.value !== "boolean" || preference.status !== "confirmed" || !validTime(preference.confirmedAt) || !exact2(preference.source, ["kind"], ["feedbackId"]) || preference.source.kind !== "user-confirmation" || Object.hasOwn(preference.source, "feedbackId") && (!token2(preference.source.feedbackId) || !visitIds.has(preference.source.feedbackId))) fail4();
    keys2.add(preference.key);
  }
  validateTravelJournal(memory.journal, { now: memory.updatedAt });
  const facts = new Map(memory.journal.trail.filter((row) => row.type === "life.fact").map((row) => [row.id, row]));
  const corrected = new Set(memory.journal.trail.filter((row) => row.type === "life.corrected").map((row) => row.targetId));
  for (const visit of memory.visits) {
    const fact = facts.get(visit.id);
    if (!fact || fact.factType !== "travel.visit" || corrected.has(visit.id)) fail4();
    if (visit.decisionId) {
      const exposure = memory.journal.exposures.find((row) => row.decisionId === visit.decisionId);
      if (!exposure || exposure.candidateId !== visit.planId || !fact.causes.includes(exposure.id) || Date.parse(visit.at) < Date.parse(exposure.at)) fail4();
    }
  }
  for (const preference of memory.confirmedPreferences) {
    const fact = facts.get(preference.id);
    if (!fact || fact.factType !== "travel.preference" || corrected.has(preference.id) || preference.source.feedbackId && !fact.causes.includes(preference.source.feedbackId)) fail4();
  }
  for (const outcome of memory.journal.outcomes) {
    const fact = facts.get(outcome.id), exposure = memory.journal.exposures.find((row) => row.id === outcome.exposureId);
    if (!fact.causes.some((id2) => memory.visits.some((visit) => visit.id === id2 && visit.decisionId === exposure.decisionId && Date.parse(visit.at) <= Date.parse(outcome.at)))) fail4("전체 여행 평가의 방문 근거가 없어요.");
  }
  return memory;
}
var TRAVEL_FORMAT, TRAVEL_MAX_BYTES, encoder, token2, object2, exact2, fail4, timestamp, places2, placeById, dayPlaces, integer2, text3, texts, time, minute, amount, uniqueIds, publicUrl2, coordinate, sameCoordinate;
var init_planner_storage = __esm({
  "experiences/path-travel/planner-storage.mjs"() {
    init_planner();
    init_places_v2();
    init_real_guide();
    init_planner_feedback();
    TRAVEL_FORMAT = "synk-path-travel";
    TRAVEL_MAX_BYTES = 512 * 1024;
    encoder = new TextEncoder();
    token2 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
    object2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    exact2 = (value, fields2, optional = []) => object2(value) && fields2.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => fields2.includes(key) || optional.includes(key));
    fail4 = (message = "여행 파일의 형식이 맞지 않아요. 현재 기록은 유지했어요.") => {
      throw new TypeError(message);
    };
    timestamp = (now) => {
      const value = now ?? (/* @__PURE__ */ new Date()).toISOString();
      if (!isTravelTime(value)) fail4("기록 시각을 확인해 주세요.");
      return value;
    };
    places2 = new Set(TRAVEL_PLACES.map((place) => place.id));
    placeById = new Map(TRAVEL_PLACES.map((place) => [place.id, place]));
    dayPlaces = new Set(TRAVEL_PLACES.filter((place) => place.dayPlannerEligible !== false && ["food", "tea", "culture"].includes(place.category)).map((place) => place.id));
    integer2 = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
    text3 = (value, max = 2e3) => typeof value === "string" && value.length <= max;
    texts = (value, max = 100) => Array.isArray(value) && value.length <= max && value.every((entry) => text3(entry));
    time = (value) => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    minute = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    amount = (value) => integer2(value, 0, 1e7);
    uniqueIds = (value, allowed, max = 5) => Array.isArray(value) && value.length <= max && value.every((id2) => token2(id2) && allowed.has(id2)) && new Set(value).size === value.length;
    publicUrl2 = (value) => {
      if (!text3(value, 2048)) return false;
      try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
      } catch {
        return false;
      }
    };
    coordinate = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
    sameCoordinate = (a, b) => coordinate(a) && coordinate(b) && a.every((value, index) => Math.abs(value - b[index]) <= 1e-8);
  }
});

// experiences/path-travel/planner-account.mjs
function travelAccountDocument(deviceState, options) {
  const value = validateTravelMemory(deviceState, options);
  delete value.consent;
  return value;
}
function travelDeviceState(accountState, { consent = false, now } = {}) {
  if (!accountState || Object.hasOwn(accountState, "consent") || typeof consent !== "boolean") throw new TypeError("여행 계정 기록을 확인해 주세요.");
  return validateTravelMemory({ ...accountState, consent }, { now });
}
function validateTravelAccountDocument(value, options) {
  return travelAccountDocument(travelDeviceState(value, options), options);
}
var TRAVEL_ACCOUNT_CONTRACT, TRAVEL_ACCOUNT_EXTENSION_POINTS;
var init_planner_account = __esm({
  "experiences/path-travel/planner-account.mjs"() {
    init_planner_storage();
    TRAVEL_ACCOUNT_CONTRACT = Object.freeze({
      resource: "path-travel",
      clientKey: "path-travel",
      scope: "synk-personal",
      endpoint: "synk-personal",
      maxBytes: TRAVEL_MAX_BYTES,
      version: 1,
      available: true,
      locallyImplemented: true,
      productionRegistered: true,
      reason: "SYNK ID로 여행을 보관하고 다른 기기에서 이어가세요. 로그인 없이 여행 파일로도 이어갈 수 있어요."
    });
    TRAVEL_ACCOUNT_EXTENSION_POINTS = Object.freeze([
      { file: "experiences/synk-account/src/core.mjs", change: "PRODUCTS에 path-travel 표시명과 별도 OAuth client 등록" },
      { file: "experiences/synk-account/src/product-account.mjs", change: "clientKey allowlist에 path-travel 추가; 기존 세션 키 분리 유지" },
      { file: "experiences/synk-account/src/personal-data.mjs", change: "PERSONAL_LIMITS 및 validatePersonalState에 path-travel 전용 validator 추가" },
      { file: "experiences/synk-account/server-shared.mjs", change: "여행 계약과 종속 모듈의 정확한 allowlist 추가" },
      { file: "tools/synk-id/personal-public-provision.cjs", change: "여행 전용 OAuth callback·client 계약 등록, 기존 path 등록 재사용 금지" },
      { file: "../SYNK-talk/lib/synk-personal-server.js", change: "PERSONAL_RESOURCES와 여행 전용 validator를 사용한 소유권·revision 검사 유지" },
      { file: "../SYNK-talk/supabase/migrations/20261007010000_synk_personal_c16.sql", change: "기존 migration 수정 대신 신규 migration으로 synk_personal_resource_c16 체크에 path-travel 추가" },
      { file: "../SYNK-talk/tools/synk-personal-build.js", change: "추가한 여행 validator를 계정 runtime에 동봉하고 합성 계정 왕복 검사 뒤 서버 배포" }
    ]);
  }
});

// experiences/synk-account/src/personal-data.mjs
function resourceLimit(resource) {
  if (!Object.hasOwn(PERSONAL_LIMITS, resource)) invalid2();
  return PERSONAL_LIMITS[resource];
}
function jsonCopy2(value, maxBytes) {
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
  if (encoder2.encode(serialized).length > maxBytes) fail5("PERSONAL_DATA_TOO_LARGE", "저장할 개인 기록이 허용 크기를 넘었어요.");
  return JSON.parse(serialized);
}
function pathDocument(value) {
  if (!fields(value, ["version", "prefsConfirmed", "prefs", "zone", "cursor", "answers"])) invalid2();
  const checked = validateState({ ...value, consent: true });
  if (checked.answers.some((answer) => answer.at.length > 40)) invalid2();
  delete checked.consent;
  return checked;
}
function validatePersonalState(resource, value) {
  const limit = resourceLimit(resource), copy2 = jsonCopy2(value, limit);
  try {
    return resource === "path-travel" ? validateTravelAccountDocument(copy2) : resource === "platform-library" ? validatePlatformLibrary(copy2) : resource === "path" ? pathDocument(copy2) : resource === "rehearsal" ? validateArchive(copy2) : familyManifest(copy2);
  } catch (error) {
    if (error.code) throw error;
    invalid2();
  }
}
function validatePersonalMediaRef(value, { kind } = {}) {
  const copy2 = jsonCopy2(value, 2048);
  if (!fields(copy2, ["assetId", "sha256", "mime", "size", "kind"]) || typeof copy2.assetId !== "string" || !uuid.test(copy2.assetId) || typeof copy2.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(copy2.sha256) || !Object.hasOwn(mediaTypes, copy2.kind) || !mediaTypes[copy2.kind].includes(copy2.mime) || !Number.isSafeInteger(copy2.size) || copy2.size <= 0 || copy2.size > PERSONAL_MEDIA_LIMITS[copy2.kind] || kind !== void 0 && copy2.kind !== kind) invalid2();
  return copy2;
}
function familyManifest(value) {
  if (!fields(value, ["format", "version", "pages"]) || value.format !== FAMILY_MANIFEST_FORMAT || value.version !== 1 || !Array.isArray(value.pages) || value.pages.length > LIMITS.pages) invalid2();
  let totalBytes = 0, encodedBytes = 0;
  const assets = /* @__PURE__ */ new Map();
  const pages = value.pages.map((page) => {
    if (!record2(page)) invalid2();
    const next = { ...page };
    for (const slot of ["photo", "audio"]) {
      const media = page[slot];
      if (media !== null) {
        if (!fields(media, ["name", "mediaRef"]) || typeof media.name !== "string" || media.name.length > 180) invalid2();
        const ref = validatePersonalMediaRef(media.mediaRef, { kind: mediaKind(slot) });
        const prior = assets.get(ref.assetId);
        if (prior && ["sha256", "mime", "size", "kind"].some((key) => prior[key] !== ref[key])) invalid2();
        assets.set(ref.assetId, ref);
        totalBytes += ref.size;
        encodedBytes += 4 * Math.ceil(ref.size / 3);
      }
      next[slot] = null;
    }
    return next;
  });
  if (totalBytes > LIMITS.total) fail5("PERSONAL_MEDIA_TOO_LARGE", "앨범의 사진과 음성은 모두 합쳐 20 MB까지 담을 수 있어요.");
  const textAlbum = validateAlbum({ format: "synk-family-album", version: 1, pages });
  const exportShell = { ...textAlbum, pages: textAlbum.pages.map((page, index) => {
    const next = { ...page };
    for (const slot of ["photo", "audio"]) {
      const media = value.pages[index][slot];
      next[slot] = media === null ? null : { name: media.name, type: media.mediaRef.mime, data: `data:${media.mediaRef.mime};base64,` };
    }
    return next;
  }) };
  if (encoder2.encode(JSON.stringify(exportShell)).length + encodedBytes > LIMITS.export) fail5("PERSONAL_DATA_TOO_LARGE", "원본을 포함한 앨범 내보내기가 32 MB를 넘어요. 앨범을 나눠 보관해 주세요.");
  return { format: FAMILY_MANIFEST_FORMAT, version: 1, pages: textAlbum.pages.map((page, index) => ({ ...page, photo: value.pages[index].photo, audio: value.pages[index].audio })) };
}
var PERSONAL_LIMITS, PERSONAL_RESOURCES, FAMILY_MANIFEST_FORMAT, PERSONAL_MEDIA_LIMITS, encoder2, fail5, invalid2, record2, fields, uuid, mediaTypes, mediaKind;
var init_personal_data = __esm({
  "experiences/synk-account/src/personal-data.mjs"() {
    init_model();
    init_domain();
    init_model2();
    init_platform_library_data();
    init_planner_account();
    PERSONAL_LIMITS = Object.freeze({ path: 64 * 1024, "path-travel": TRAVEL_ACCOUNT_CONTRACT.maxBytes, rehearsal: MAX_IMPORT_BYTES, "family-album": LIMITS.export, "platform-library": 64 * 1024 });
    PERSONAL_RESOURCES = Object.freeze(Object.keys(PERSONAL_LIMITS));
    FAMILY_MANIFEST_FORMAT = "synk-family-album-manifest";
    PERSONAL_MEDIA_LIMITS = Object.freeze({ image: LIMITS.photo, audio: LIMITS.audio, total: LIMITS.total });
    encoder2 = new TextEncoder();
    fail5 = (code, message) => {
      throw Object.assign(new TypeError(message), { code });
    };
    invalid2 = () => fail5("PERSONAL_DATA_INVALID", "저장할 개인 기록의 형식을 확인해 주세요.");
    record2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    fields = (value, names2) => record2(value) && Object.keys(value).every((key) => names2.includes(key));
    uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    mediaTypes = Object.freeze({ image: ["image/jpeg", "image/png", "image/webp"], audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"] });
    mediaKind = (slot) => slot === "photo" ? "image" : "audio";
  }
});

// experiences/synk-account/src/personal-media.mjs
var personal_media_exports = {};
__export(personal_media_exports, {
  requestPersonalMedia: () => requestPersonalMedia,
  validateMediaRequest: () => validateMediaRequest,
  validateMediaResponse: () => validateMediaResponse
});
function validateMediaRequest(operation, values) {
  if (!["assetUpload", "assetRead", "assetDelete"].includes(operation) || !values || typeof values !== "object" || Array.isArray(values)) throw fault("INVALID_REQUEST");
  if (operation === "assetUpload") {
    const bytes = buffer(values.bytes);
    if (Object.keys(values).some((key) => !["kind", "mime", "bytes"].includes(key)) || !Object.hasOwn(types, values.kind) || !types[values.kind].includes(values.mime) || !bytes || !bytes.length || bytes.length > PERSONAL_MEDIA_LIMITS[values.kind]) throw fault("INVALID_REQUEST");
  } else if (Object.keys(values).some((key) => key !== "assetId") || !uuid2(values.assetId)) throw fault("INVALID_REQUEST");
}
function own(data, ownerId) {
  if (data?.ok !== true) throw Object.assign(fault(data?.error?.code || "MEDIA_TRANSFER_FAILED"), ["ASSET_NOT_FOUND", "ASSET_NOT_CONFIRMED"].includes(data?.error?.code) && uuid2(data?.error?.assetId) ? { assetId: data.error.assetId } : {});
  if (data.scope !== "synk-personal" || data.resource !== "family-album" || data.accountId !== ownerId) throw fault("ACCOUNT_CHANGED");
  return data;
}
function validateMediaResponse(data, { operation, values, ownerId }) {
  own(data, ownerId);
  const base = { ok: true, scope: "synk-personal", resource: "family-album", accountId: ownerId };
  if (operation === "assetDelete") {
    if (data.deleted !== true) throw fault();
    return { ...base, deleted: true };
  }
  const ref = validatePersonalMediaRef(data.mediaRef);
  if (operation === "assetRead" && ref.assetId !== values.assetId || operation === "assetUpload" && (ref.kind !== values.kind || ref.mime !== values.mime || ref.size !== values.bytes.byteLength)) throw fault();
  if (operation === "assetRead") {
    const bytes = buffer(data.bytes);
    if (!bytes || bytes.length !== ref.size) throw fault();
    return { ...base, mediaRef: ref, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }
  return { ...base, mediaRef: ref };
}
function signedUrl(value, { origin, ownerId, assetId, upload }) {
  let url, host;
  try {
    url = new URL(value);
    host = new URL(origin);
  } catch {
    throw fault();
  }
  const path = `/storage/v1/object/${upload ? "upload/sign" : "sign"}/personal-media/${upload ? "staging" : "objects"}/${ownerId}/${assetId}`;
  if (url.origin !== host.origin || !["https:", "http:"].includes(url.protocol) || url.protocol === "http:" && url.hostname !== "127.0.0.1" || url.username || url.password || url.hash || url.pathname !== path || !url.searchParams.get("token") || [...url.searchParams.keys()].some((key) => key !== "token" || url.searchParams.getAll(key).length !== 1)) throw fault();
  return url.href;
}
async function requestPersonalMedia({ operation, values, ownerId, api, fetcher, guard, cryptoAPI, controllers, origin }) {
  validateMediaRequest(operation, values);
  guard();
  const hash = async (bytes2) => {
    const value = await cryptoAPI.subtle.digest("SHA-256", bytes2);
    guard();
    return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const invoke = async (body) => {
    const result = await api(body);
    guard();
    return own(result, ownerId);
  };
  async function transfer(url, { bytes: bytes2, mime, size }) {
    guard();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 3e4);
    controllers.add(controller);
    try {
      const response = await fetcher(url, { method: bytes2 ? "PUT" : "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal, ...bytes2 ? { headers: { "Content-Type": mime, "x-upsert": "false" }, body: bytes2 } : {} });
      guard();
      if (!response.ok) {
        await response.body?.cancel?.();
        throw fault("MEDIA_TRANSFER_FAILED");
      }
      if (bytes2) {
        await response.body?.cancel?.();
        return null;
      }
      const length = response.headers.get("content-length"), type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (length !== null && Number(length) !== size || type !== mime || !response.body?.getReader) {
        await response.body?.cancel?.();
        throw fault();
      }
      const reader = response.body.getReader(), result = new Uint8Array(size);
      let offset = 0;
      try {
        for (; ; ) {
          const { done, value } = await reader.read();
          guard();
          if (done) break;
          if (offset + value.byteLength > size) {
            await reader.cancel();
            throw fault();
          }
          result.set(value, offset);
          offset += value.byteLength;
        }
      } finally {
        reader.releaseLock();
      }
      if (offset !== size) throw fault();
      return result;
    } catch (error) {
      guard();
      throw error.code ? error : fault("MEDIA_TRANSFER_FAILED");
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }
  if (operation === "assetUpload") {
    const bytes2 = buffer(values.bytes).slice(), sha256 = await hash(bytes2);
    const prepared = await invoke({ action: "media-upload", kind: values.kind, mime: values.mime, size: bytes2.length, sha256 });
    if (!uuid2(prepared.assetId)) throw fault();
    await transfer(signedUrl(prepared.uploadUrl, { origin, ownerId, assetId: prepared.assetId, upload: true }), { bytes: bytes2, mime: values.mime, size: bytes2.length });
    const confirmed = await invoke({ action: "media-confirm", assetId: prepared.assetId });
    const result = validateMediaResponse(confirmed, { operation, values, ownerId });
    if (result.mediaRef.assetId !== prepared.assetId || result.mediaRef.sha256 !== sha256) throw fault();
    return result;
  }
  if (operation === "assetDelete") return validateMediaResponse(await invoke({ action: "media-delete", assetId: values.assetId }), { operation, values, ownerId });
  const data = await invoke({ action: "media-read", assetId: values.assetId }), ref = validatePersonalMediaRef(data.mediaRef);
  if (ref.assetId !== values.assetId) throw fault();
  const bytes = await transfer(signedUrl(data.url, { origin, ownerId, assetId: ref.assetId, upload: false }), { mime: ref.mime, size: ref.size });
  if (await hash(bytes) !== ref.sha256) throw fault();
  guard();
  return validateMediaResponse({ ...data, bytes }, { operation, values, ownerId });
}
var uuid2, fault, types, buffer;
var init_personal_media = __esm({
  "experiences/synk-account/src/personal-media.mjs"() {
    init_personal_data();
    uuid2 = (value) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
    fault = (code = "INVALID_RESPONSE") => Object.assign(new Error("앨범 원본 파일을 확인하지 못했어요. 현재 앨범을 유지하고 다시 시도해 주세요."), { code });
    types = { image: ["image/jpeg", "image/png", "image/webp"], audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"] };
    buffer = (value) => value instanceof ArrayBuffer ? new Uint8Array(value) : ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null;
  }
});

// experiences/synk-account/src/product-account.mjs
function createProductAccount({
  clientKey,
  endpoint,
  scope: scope3,
  validateState: validateState2,
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
  if (!["care", "path", "path-travel", "rehearsal", "family-album"].includes(clientKey) || !["synk-care", "synk-personal"].includes(endpoint) || typeof validateState2 !== "function") throw new TypeError("제품 계정 계약을 확인해 주세요.");
  const LIMIT = (resource === "family-album" ? 32 : 4) * 1024 * 1024 + 32768;
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
    if (disposed || expected !== epoch) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
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
        error ||= fault2("STORAGE", "화면의 로그인은 종료했지만 저장을 지우지 못했어요. 이 창을 닫아 주세요.");
      }
    }
    return emit({ signedIn: false, status: snapshot.configured ? nextStatus : "unconfigured", accountId: null, account: null, error: error ? publicError(error) : null });
  }
  function saveSession(next) {
    session = next;
    try {
      storage.setItem(SESSION_KEY, JSON.stringify({ ...next, configKey: binding() }));
    } catch {
      throw fault2("STORAGE", "이 탭에 로그인을 보관하지 못했어요. 브라우저 저장 설정을 확인해 주세요.");
    }
  }
  async function responseJson(response) {
    if (!response.body?.getReader) {
      const text5 = await response.text();
      if (new TextEncoder().encode(text5).byteLength > LIMIT) throw fault2("INVALID_RESPONSE", "계정 자료의 크기를 확인하지 못했어요.");
      try {
        return JSON.parse(text5);
      } catch {
        return null;
      }
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text4 = "";
    try {
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > LIMIT) {
          await reader.cancel();
          throw fault2("INVALID_RESPONSE", "계정 자료의 크기를 확인하지 못했어요.");
        }
        text4 += decoder.decode(value, { stream: true });
      }
      text4 += decoder.decode();
      try {
        return JSON.parse(text4);
      } catch {
        return null;
      }
    } finally {
      reader.releaseLock();
    }
  }
  async function send(url, token3, body, { logout = false } = {}) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12e3);
    controllers.add(abort);
    try {
      const response = await fetcher(url, {
        method: body === void 0 ? "GET" : "POST",
        signal: abort.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${token3}`, "X-SYNK-Product": "platform", "X-SYNK-Contract": "1", ...body === void 0 ? {} : { "Content-Type": "application/json" } },
        ...body === void 0 ? {} : { body: JSON.stringify(body) }
      });
      const data = logout && response.status === 204 ? null : await responseJson(response);
      return { response, data };
    } catch (error) {
      if (error.code) throw error;
      throw fault2("NETWORK", "계정 서버에 연결하지 못했어요. 현재 자료를 유지하고 다시 시도해 주세요.", { retryable: true });
    } finally {
      clearTimeout(timer);
      controllers.delete(abort);
    }
  }
  async function refresh(expected) {
    if (refreshing) return refreshing;
    const old = session;
    if (!old?.refresh_token) throw fault2("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
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
    if (!OPERATIONS.has(operation) || !values || typeof values !== "object" || Array.isArray(values)) throw fault2("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const careLibrarySave = clientKey === "care" && endpoint === "synk-care" && resource === null && operation === operations2.save;
    const allowed = operation === operations2.load ? [] : operation === operations2.save ? ["expected_revision", "state", ...careLibrarySave ? ["messageLibraryVersion", "checkinPreferenceVersion"] : []] : ["expected_revision"];
    if (Object.keys(values).some((key) => !allowed.includes(key))) throw fault2("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    if (Object.hasOwn(values, "messageLibraryVersion") && (!careLibrarySave || values.messageLibraryVersion !== 1)) throw fault2("INVALID_REQUEST", "문구 보관함의 저장 계약을 확인해 주세요.");
    if (Object.hasOwn(values, "checkinPreferenceVersion") && (!careLibrarySave || values.checkinPreferenceVersion !== 1)) throw fault2("INVALID_REQUEST", "안부 설정의 저장 계약을 확인해 주세요.");
    if (operation === operations2.load) return void 0;
    if (!Number.isSafeInteger(values.expected_revision) || values.expected_revision < 0) throw fault2("INVALID_REQUEST", "저장할 자료의 버전을 확인해 주세요.");
    return { action: operation === operations2.save ? "save" : "delete", expected_revision: values.expected_revision, ...operation === operations2.save ? { state: validateState2(values.state) } : {}, ...Object.hasOwn(values, "messageLibraryVersion") ? { messageLibraryVersion: 1 } : {}, ...Object.hasOwn(values, "checkinPreferenceVersion") ? { checkinPreferenceVersion: 1 } : {} };
  }
  function validateResponse(data, ownerId) {
    if (data?.ok !== true) throw fault2(data?.error?.code || "ACCOUNT_UNAVAILABLE", data?.error?.message || "계정 자료를 확인하지 못했어요.", { retryable: data?.error?.retryable === true, status: data?.error?.status, revision: data?.revision, ...missingAsset(data?.error) });
    if (data.scope !== scope3 || resource && data.resource !== resource || typeof data.accountId !== "string" || !data.accountId || data.accountId.length > 100 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Object.hasOwn(data, "state")) throw fault2("INVALID_RESPONSE", "계정 자료의 형식을 확인하지 못했어요. 현재 자료를 유지해 주세요.");
    if (ownerId && data.accountId !== ownerId) throw fault2("ACCOUNT_CHANGED", "다른 계정의 응답이 도착해 자료를 적용하지 않았어요.");
    return { ok: true, scope: scope3, ...resource ? { resource } : {}, accountId: data.accountId, revision: data.revision, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null, state: data.state === null ? null : validateState2(data.state) };
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
      if (!session?.access_token) throw fault2("AUTH_REQUIRED", "SYNK ID로 로그인해 주세요.");
      let token3 = session.access_token;
      if (session.expires_at <= now() + 3e4) token3 = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/${endpoint}${resource && body === void 0 ? `?resource=${encodeURIComponent(resource)}` : ""}`;
      let result = await send(url, token3, body === void 0 || !resource ? body : { ...body, resource });
      guard(expected);
      if (result.response.status === 401 && session?.refresh_token) {
        token3 = session.access_token !== token3 ? session.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token3, body === void 0 || !resource ? body : { ...body, resource });
        guard(expected);
      }
      if (!result.response.ok || result.data?.ok !== true) {
        const code = result.data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "ACCOUNT_UNAVAILABLE");
        throw fault2(code, code === "REVISION_CONFLICT" ? "다른 기기에서 자료가 바뀌었어요. 계정 자료를 다시 확인해 주세요." : "계정 요청을 완료하지 못했어요. 현재 자료는 그대로 유지해 주세요.", { status: result.response.status, revision: result.data?.revision, retryable: result.response.status === 429 || result.response.status >= 500, ...missingAsset(result.data?.error) });
      }
      data = result.data;
    }
    guard(expected);
    return validateResponse(data, ownerId);
  }
  async function mediaRequest(operation, values, expected, ownerId) {
    if (resource !== "family-album" || endpoint !== "synk-personal") throw fault2("INVALID_REQUEST", "이 제품에는 원본 파일을 보관할 수 없어요.");
    const media = await Promise.resolve().then(() => (init_personal_media(), personal_media_exports));
    guard(expected);
    if (native) {
      media.validateMediaRequest(operation, values);
      const result = await bridgeRequest.call(bridge, operation, values);
      guard(expected);
      return media.validateMediaResponse(result, { operation, values, ownerId });
    }
    const api = async (body) => {
      guard(expected);
      let token3 = session.access_token;
      if (session.expires_at <= now() + 3e4) token3 = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/synk-personal`;
      let result = await send(url, token3, { ...body, resource });
      guard(expected);
      if (result.response.status === 401 && session?.refresh_token) {
        token3 = session.access_token !== token3 ? session.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token3, { ...body, resource });
        guard(expected);
      }
      if (!result.response.ok) throw fault2(result.data?.error?.code || "MEDIA_TRANSFER_FAILED", "원본 파일을 계정에 보관하지 못했어요.", { status: result.response.status, ...missingAsset(result.data?.error) });
      return result.data;
    };
    return media.requestPersonalMedia({ operation, values, ownerId, api, fetcher, guard: () => guard(expected), cryptoAPI: cryptoAPI || globalThis.crypto, controllers, origin: config.supabaseUrl });
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
      if (environment?.clientId !== clientKey) throw fault2("INVALID_BRIDGE", "제품 앱의 로그인 연결을 확인해 주세요.");
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
      throw fault2("NETWORK", "로그인 연결을 불러오지 못했어요. 연결이 돌아오면 다시 확인해 주세요.", { retryable: true });
    }
    guard(expected);
    let raw;
    const configEndpoint = new URL(configUrl, getUrl());
    if (configEndpoint.origin !== new URL(getUrl()).origin || configEndpoint.username || configEndpoint.password || configEndpoint.hash) throw fault2("AUTH_CONFIG", "이 앱의 계정 설정 주소를 확인해 주세요.");
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8e3);
    controllers.add(abort);
    try {
      const response = await fetcher(configEndpoint.href, { cache: "no-store", credentials: "omit", signal: abort.signal, redirect: "error" });
      if (response.ok) raw = await response.json();
      else if (response.status !== 404) throw fault2("AUTH_CONFIG", "계정 연결 설정을 불러오지 못했어요. 다시 확인해 주세요.", { status: response.status, retryable: response.status === 429 || response.status >= 500 });
    } catch (error) {
      if (error.code) throw error;
      throw fault2("NETWORK", "계정 연결 설정을 불러오지 못했어요. 연결이 돌아오면 다시 확인해 주세요.", { retryable: true });
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
      if (pendingExchange.configKey !== binding()) throw fault2("AUTH_REQUIRED", "로그인 연결 설정이 바뀌었어요. SYNK ID로 다시 로그인해 주세요.");
      const next = await core.tokenRequest(config, pendingExchange.fields, fetcher);
      guard(expected);
      pendingExchange = null;
      saveSession(next);
    } else {
      try {
        const text4 = storage.getItem(SESSION_KEY);
        if (text4 && text4.length > 65536) throw Error("INVALID_SESSION");
        const value = JSON.parse(text4 || "null");
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
    if (disposed) throw fault2("ACCOUNT_CHANGED", "계정 연결이 종료됐어요.");
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
    if (disposed || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
    if (snapshot.signedIn || automaticNavigations !== before) return status();
    if (native && snapshot.error?.retryable) {
      let result;
      try {
        result = await bridgeRequest.call(bridge, "load", {});
      } catch {
        result = { ok: false, error: { code: "NETWORK", message: "계정 연결을 다시 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.", retryable: true } };
      }
      if (disposed || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      const source = await bridge.authStatus();
      if (disposed || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      await nativeStatus(source);
      if (disposed || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      if (snapshot.signedIn) return status();
      const error = snapshot.error || result?.error || { code: "AUTH_REQUIRED", message: "저장된 로그인을 확인하지 못했어요. SYNK ID로 다시 로그인해 주세요.", retryable: false };
      if (!snapshot.error) emit({ signedIn: false, accountId: null, account: null, status: "error", error: publicError(error) });
      throw Object.assign(new Error(error.message), error);
    }
    if (snapshot.error?.retryable) throw Object.assign(new Error(snapshot.error.message), snapshot.error);
    if (!snapshot.configured) throw fault2("AUTH_CONFIG", "SYNK ID 연결 설정을 준비하고 있어요. 지금은 이 기기의 수첩을 사용할 수 있어요.");
    if (native) {
      const result = await bridge.authSignIn();
      if (disposed || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      if (result?.ok === false) throw Object.assign(new Error(result.error?.message), result.error);
      return nativeStatus(result);
    }
    const expected = epoch;
    platformEntry.resume();
    const url = await core.beginOAuth({ config, product: clientKey, storage, now: now(), cryptoAPI });
    guard(expected);
    if (intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
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
    if (!snapshot.signedIn || !snapshot.accountId) throw fault2("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 계정 자료를 확인해 주세요.");
    const expected = epoch, ownerId = snapshot.accountId;
    try {
      return await (operation.startsWith("asset") ? mediaRequest(operation, values, expected, ownerId) : dispatch(operation, values, expected, ownerId));
    } catch (error) {
      if (expected === epoch && (AUTH_ERRORS.has(error.code) || error.code === "ACCOUNT_CHANGED")) clearSession(error);
      throw error;
    }
  }
  async function requestPush(action, values = {}) {
    if (clientKey !== "care" || endpoint !== "synk-care" || native) throw fault2("PUSH_UNSUPPORTED", "예약 알림은 플레저 웹에서 설정해 주세요.");
    if (!snapshot.signedIn || !snapshot.accountId) throw fault2("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 알림을 설정해 주세요.");
    const allowed = { status: ["endpoint"], subscribe: ["subscription", "hour", "minute"], update: ["endpoint", "hour", "minute"], unsubscribe: ["endpoint"] };
    if (!Object.hasOwn(allowed, action) || !values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).some((key) => !allowed[action].includes(key))) throw fault2("INVALID_REQUEST", "알림 설정을 확인해 주세요.");
    if (["subscribe", "update"].includes(action) && (!Number.isInteger(values.hour) || values.hour < 0 || values.hour > 23 || !Number.isInteger(values.minute) || values.minute < 0 || values.minute > 59)) throw fault2("INVALID_REQUEST", "알림 시간을 확인해 주세요.");
    if ((action === "update" || action === "unsubscribe" || Object.hasOwn(values, "endpoint")) && (typeof values.endpoint !== "string" || values.endpoint.length > 2048 || !values.endpoint.startsWith("https://"))) throw fault2("INVALID_REQUEST", "이 기기의 알림 연결을 확인해 주세요.");
    if (action === "subscribe" && (!values.subscription || typeof values.subscription !== "object" || Array.isArray(values.subscription))) throw fault2("INVALID_REQUEST", "이 기기의 알림 연결을 확인해 주세요.");
    const body = { action, ...values };
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 8192) throw fault2("INVALID_REQUEST", "알림 설정의 크기를 확인해 주세요.");
    const expected = epoch, ownerId = snapshot.accountId;
    try {
      guard(expected);
      let token3 = session?.access_token;
      if (!token3) throw fault2("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
      if (session.expires_at <= now() + 3e4) token3 = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/synk-care-push`;
      let result = await send(url, token3, body);
      guard(expected);
      if (result.response.status === 401 && session?.refresh_token) {
        token3 = session.access_token !== token3 ? session.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token3, body);
        guard(expected);
      }
      const data = result.data;
      if (!result.response.ok || data?.ok !== true) throw fault2(data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "PUSH_UNAVAILABLE"), "예약 알림을 설정하지 못했어요. 잠시 뒤 다시 시도해 주세요.", { status: result.response.status, retryable: result.response.status === 429 || result.response.status >= 500 });
      if (data.accountId !== ownerId) throw fault2("ACCOUNT_CHANGED", "계정이 바뀌어 알림 설정을 적용하지 않았어요.");
      if (data.scope !== "synk-care-push" || typeof data.enabled !== "boolean" || data.timeZone !== "Asia/Seoul" || !Number.isInteger(data.hour) || data.hour < 0 || data.hour > 23 || !Number.isInteger(data.minute) || data.minute < 0 || data.minute > 59 || typeof data.publicKey !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(data.publicKey)) throw fault2("INVALID_RESPONSE", "알림 서버의 응답을 확인하지 못했어요.");
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
var AUTH_ERRORS, fault2, missingAsset, publicError;
var init_product_account = __esm({
  "experiences/synk-account/src/product-account.mjs"() {
    init_platform_entry();
    AUTH_ERRORS = /* @__PURE__ */ new Set(["AUTH_REQUIRED", "AUTH_SESSION_MISSING", "SESSION_REVOKED"]);
    fault2 = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
    missingAsset = (error) => ["ASSET_NOT_FOUND", "ASSET_NOT_CONFIRMED"].includes(error?.code) && typeof error?.assetId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(error.assetId) ? { assetId: error.assetId } : {};
    publicError = (error) => ({ code: error.code || "ACCOUNT_UNAVAILABLE", message: error.message || "계정 연결을 확인하지 못했어요.", retryable: error.retryable === true, ...error.status ? { status: error.status } : {}, ...missingAsset(error) });
  }
});

// experiences/synk-account/src/document-sync.mjs
function createDocumentSync({ transport, storage, onState = () => {
}, onStatus = () => {
}, onSaved = () => {
}, onRemoved = () => {
}, validateState: validateState2, emptyState, requiresConflictReview = () => false, preferRemoteOnOpen = false, scope: scope3, resource = null, cachePrefix, operations: operations2 = { load: "careLoad", save: "careSave", delete: "careDelete" } }) {
  if (typeof validateState2 !== "function" || typeof emptyState !== "function" || typeof requiresConflictReview !== "function" || !scope3 || !cachePrefix) throw new TypeError("제품 기록 계약이 필요해요.");
  const clone2 = (value) => validateState2(value);
  const PREFIX = cachePrefix;
  if (typeof transport !== "function") throw new TypeError("계정 저장 통로가 필요해요.");
  let active = null, generation = 0, localError = null;
  const records = /* @__PURE__ */ new Map(), knownKeys = /* @__PURE__ */ new Set();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const localSummary = () => {
    const all = [...records.values()], own2 = active ? all.filter((value) => value.accountId === active.accountId) : [];
    return {
      count: active ? own2.length : all.length,
      pending: own2.filter((value) => value.pending).length,
      corrupt: own2.filter((value) => value.corrupt).length,
      exportable: own2.length,
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
      if (new TextEncoder().encode(raw).byteLength > (resource === "family-album" ? 32 : 4) * 1024 * 1024 + 32768) throw failure("INVALID_LOCAL_CACHE");
      const cached = JSON.parse(raw);
      accountId = recordOwner(key, cached);
      const base = PREFIX + encodeURIComponent(cached?.accountId);
      const draft = typeof cached?.draftId === "string" && UUID.test(cached.draftId);
      if (cached?.version !== 1 || typeof cached.accountId !== "string" || !(draft ? key === base + ":draft:" + cached.draftId : cached.draftId === void 0 && key === base) || draft && (typeof cached.createdAt !== "string" || !Number.isFinite(Date.parse(cached.createdAt))) || typeof cached.pending !== "boolean" || cached.baseRevision !== null && !validRevision(cached.baseRevision)) throw failure("INVALID_LOCAL_CACHE");
      const state = clone2(cached.state);
      return { accountId, pending: cached.pending, corrupt: false, cached: { ...cached, state } };
    } catch {
      return { accountId, pending: false, corrupt: true };
    }
  }
  function localEntries() {
    const keys2 = new Set(knownKeys);
    if (typeof storage?.key !== "function" || !Number.isSafeInteger(storage.length) || storage.length < 0) throw failure("LOCAL_STORAGE_UNAVAILABLE");
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (typeof key === "string" && key.startsWith(PREFIX)) keys2.add(key);
    }
    if (!storage?.getItem) throw failure("LOCAL_STORAGE_UNAVAILABLE");
    return [...keys2].sort().flatMap((key) => {
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
        const record3 = cacheRecord(key, raw);
        records.set(key, { ...record3, key, raw });
        if (active && record3.accountId === active.accountId && !record3.pending && !record3.corrupt) try {
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
      return { format: "synk-account-local-recovery", version: 1, scope: scope3, resource, accountId: active.accountId, entries: localEntries().filter(({ key, raw }) => cacheRecord(key, raw).accountId === active.accountId) };
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
    if (isCurrent(context)) onState(clone2(context.state));
  };
  function draftGroups(context, all = false) {
    localRecords();
    const groups = /* @__PURE__ */ new Map(), excluded = all ? /* @__PURE__ */ new Set() : /* @__PURE__ */ new Set([...context.owned.keys(), ...context.recovery.keys()]);
    for (const record3 of records.values()) {
      if (!record3.pending || record3.corrupt || record3.cached.accountId !== context.accountId || excluded.has(record3.key)) continue;
      const signature = JSON.stringify({ baseRevision: record3.cached.baseRevision, state: record3.cached.state });
      let group = groups.get(signature);
      if (!group) {
        group = {
          id: record3.cached.draftId || "legacy",
          createdAt: record3.cached.createdAt || null,
          baseRevision: record3.cached.baseRevision,
          state: record3.cached.state,
          entries: /* @__PURE__ */ new Map(),
          itemCount: Object.values(record3.cached.state).reduce((n, value) => n + (Array.isArray(value) ? value.length : 0), 0)
        };
        groups.set(signature, group);
      }
      group.entries.set(record3.key, record3.raw);
    }
    return [...groups.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || a.id.localeCompare(b.id));
  }
  const publicDrafts = (groups) => groups.map(({ id: id2, createdAt, baseRevision, itemCount, entries }) => ({ id: id2, createdAt, baseRevision, itemCount, copies: entries.size }));
  const emit = (context, status, error = null) => {
    if (!isCurrent(context)) return;
    context.choices = draftGroups(context);
    if (context.localChoice && !context.choices.length && !localError) context.localChoice = false;
    context.invalidCache = [...records.values()].some((record3) => record3.corrupt && record3.accountId === context.accountId);
    const currentSignature = JSON.stringify(context.state);
    const pendingStored = !context.pending || !localError && [...records.values()].some((record3) => record3.pending && !record3.corrupt && record3.cached.accountId === context.accountId && JSON.stringify(record3.cached.state) === currentSignature);
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
    if (!reply || reply.ok !== true || reply.scope !== scope3 || resource && reply.resource !== resource || !validRevision(reply.revision) || !Object.hasOwn(reply, "state")) throw failure("INVALID_CARE_RESPONSE");
    if (reply.accountId !== context.accountId) throw failure("CARE_ACCOUNT_MISMATCH");
    let state;
    try {
      state = reply.state === null ? emptyState() : clone2(reply.state);
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
      const sequence = context.sequence, sent = clone2(context.state), expected = context.baseRevision;
      const acknowledged = new Map([...context.recovery, ...context.owned]);
      emit(context, "saving");
      const remote = await request(context, operations2.save, { expected_revision: expected, state: sent });
      if (remote.revision !== expected + 1 || remote.empty) throw failure("INVALID_CARE_RESPONSE");
      onSaved(clone2(remote.state));
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
      context.invalidCache = [...records.values()].some((record3) => record3.corrupt && record3.accountId === accountId);
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
    const normalized = clone2(state);
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
  function selectLocalDraft(id2) {
    const context = active;
    stopTimer(context);
    return enqueue(context, async () => {
      if (context.pending && !persist(context)) {
        emit(context, "storage-error");
        return false;
      }
      const selected = draftGroups(context).find((group) => group.id === id2);
      if (!selected) {
        emit(context, "synced");
        if (!context.localChoice && !context.pending) await load(context);
        return false;
      }
      detachDraft(context);
      context.recovery = new Map(selected.entries);
      context.state = clone2(selected.state);
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
var validRevision, failure, messages, documentSyncErrorMessage;
var init_document_sync = __esm({
  "experiences/synk-account/src/document-sync.mjs"() {
    validRevision = (value) => Number.isSafeInteger(value) && value >= 0;
    failure = (code, revision) => Object.assign(new Error(code), { code, ...validRevision(revision) ? { revision } : {} });
    messages = {
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
    documentSyncErrorMessage = (error) => messages[error?.code] || error?.message || "계정에 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.";
  }
});

// experiences/synk-account/src/account-notebook.mjs
function createAccountNotebook({
  resource,
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
  if (!mount || !getState || !applyState || !emptyDocument) throw new TypeError("계정 기록 화면 계약이 필요해요.");
  const validateState2 = (value) => validatePersonalState(resource, value);
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
  account = accountFactory({ clientKey: resource, endpoint: "synk-personal", scope: "synk-personal", resource, validateState: validateState2, operations, bridge, onStatus: onAuth });
  sync = syncFactory({
    validateState: validateState2,
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
var operations, copy, labels;
var init_account_notebook = __esm({
  "experiences/synk-account/src/account-notebook.mjs"() {
    init_product_account();
    init_document_sync();
    init_personal_data();
    operations = Object.freeze({ load: "personalLoad", save: "personalSave", delete: "personalDelete" });
    copy = (value) => structuredClone(value);
    labels = { loading: "계정 기록 불러오는 중", saving: "계정에 저장하고 있어요", synced: "계정에 저장했어요", idle: "계정 저장 대기 중", conflict: "다른 기기의 변경을 확인해 주세요", "local-conflict": "이 기기의 미저장 기록을 골라 주세요", offline: "연결을 기다리고 있어요", error: "계정 기록 확인 필요", "storage-error": "기기 임시 저장 확인 필요" };
  }
});

// experiences/synk-account/src/platform-library-view.mjs
init_account_notebook();
init_platform_library_data();

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
init_platform_library_data();
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
var names = { world: "WORLD", messenger: "워크스페이스", teacher: "워크스페이스 · 내 수업", path: "PATH", pulse: "PULSE", partners: "PULSE · 이전 Partners 기록", care: "플레저", fortune: "운세", rehearsal: "대화 리허설", "family-album": "가족 앨범" };
var esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
var librarySequence = 0;
function mountPlatformLibrary(root, { getHost, ensureReady = async () => {
}, native = false, getDevice = () => ({}), getAppIds = () => ACTIVE_PLATFORM_APP_IDS, onChange = () => {
}, onOpen = () => {
}, onLogin = () => {
}, onManage = onLogin, storage = globalThis.localStorage } = {}) {
  let notebook = null, doc = emptyPlatformLibrary(), draft = { appId: "world", title: "" }, message = "", modeVersion = 0, submitting = false, pageSuspended = false, connecting = false, disposed = false, resumeId = null, initialExpansionPending = false, connectOnResume = false;
  let editing = null, parkedDraft = null, deletedNotes = [], completedExpanded = false, noteQuery = "", noteFilter = "all";
  let recoveryOwner = null;
  let accountAdapter = null, nativeVerification = null, nativeVerificationNotice = null;
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
    const note2 = available ? doc.notes.find((row) => !row.done) : null, recent = available ? projectPlatformLibrary(doc, { appIds: entryIds() }).recent[0] : null, hasDraft = available && (!!draft.title.trim() || !!parkedDraft?.title.trim());
    resumeId = note2?.appId || recent?.entryId || recent?.id || null;
    root.querySelector("[data-library-title]").textContent = hasDraft ? editing ? "수정 중인 메모가 있어요" : "작성 중인 메모가 있어요" : note2?.title || (recent ? "다시 " + names[recent.id] + "에서" : "계정으로 이어가기");
    root.querySelector("[data-library-detail]").textContent = message || (hasDraft ? "접어두어도 이 화면의 입력은 유지돼요." : note2 ? names[note2.appId] + " · 남겨 둔 다음 할 일" : recent ? "최근 열었던 공간을 바로 열 수 있어요." : available ? "다음에 할 일을 남겨 두면 여기서 바로 이어갈 수 있어요." : "즐겨찾기와 다음에 할 일을 같은 SYNK ID로 이어가세요.");
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
    return '<article tabindex="-1" data-note-id="' + esc(row.id) + '"><strong>' + esc(row.title) + "</strong><p>" + names[row.appId] + '</p><div class="continuity-note-actions"><button type="button" data-cloud="open" data-id="' + row.appId + '">이어가기</button><button type="button" data-cloud="edit-note" data-id="' + esc(row.id) + '" aria-label="' + esc(row.title) + ' 수정">수정</button><button type="button" data-cloud="toggle-note" data-id="' + esc(row.id) + '" aria-pressed="' + row.done + '">' + (row.done ? "완료됨 · 다시 열기" : "완료 표시") + '</button><button type="button" data-cloud="remove-note" data-id="' + esc(row.id) + '" aria-label="' + esc(row.title) + ' 삭제">메모 삭제</button></div></article>';
  }
  function matchingNotes(query = "", filter = "all") {
    const terms = String(query).normalize("NFKC").toLocaleLowerCase("ko-KR").trim().split(/\s+/).filter(Boolean);
    return doc.notes.filter((row) => (filter === "all" || row.done === (filter === "done")) && terms.every((term) => (row.title + " " + names[row.appId]).normalize("NFKC").toLocaleLowerCase("ko-KR").includes(term)));
  }
  function favoritesMarkup() {
    const favorites = projectPlatformLibrary(doc, { appIds: entryIds() }).favorites.filter((id2) => displayIds().includes(id2));
    return favorites.length > 1 ? '<h3>즐겨찾기 순서</h3><ol class="continuity-favorite-order">' + favorites.map((id2, index) => "<li><span>" + names[id2] + '</span><div><button type="button" data-cloud="favorite-up" data-id="' + id2 + '" aria-label="' + names[id2] + ' 즐겨찾기 위로"' + (index === 0 ? " data-order-edge disabled" : "") + '>위로</button><button type="button" data-cloud="favorite-down" data-id="' + id2 + '" aria-label="' + names[id2] + ' 즐겨찾기 아래로"' + (index === favorites.length - 1 ? " data-order-edge disabled" : "") + ">아래로</button></div></li>").join("") + "</ol>" : "";
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
      content.innerHTML = active ? '<h2>내 계정의 이어쓰기</h2><p role="status" data-cloud-message>' + esc(message) + "</p>" + (!doc.consent ? '<p>계정 연결을 켜면 지금부터 선택한 즐겨찾기와 최근 열기를 계정에 저장해요. 기존 기기 목록은 위의 옮기기 버튼으로 직접 가져올 수 있어요.</p><button data-cloud="enable">계정 저장 켜기</button>' : '<label><input type="checkbox" data-cloud="remember" ' + (doc.rememberRecent ? "checked" : "") + '> 최근 열기 시각도 계정에 보관</label><div class="continuity-apps">' + displayIds().map((id2) => '<button type="button" data-cloud="favorite" data-id="' + id2 + '" aria-pressed="' + favoriteSelected(id2) + '">' + (favoriteSelected(id2) ? "★ " : "☆ ") + names[id2] + "</button>").join("") + "</div><section data-favorite-order>" + nextFavorites + '</section><section data-note-recovery class="continuity-undo" hidden><p data-recovery-detail role="status"></p><button type="button" data-cloud="recover-draft">초안 복구</button><button type="button" data-cloud="discard-recovery">보관한 초안 버리기</button></section><form data-note-form><h3 data-editor-heading>새 메모</h3><p data-edit-detail hidden></p><p id="' + panelId + '-capacity" data-note-capacity role="status"></p><label>이어 쓸 공간<select name="appId">' + editorOptions(draft.appId) + '</select></label><label>다음에 할 일<input name="title" maxlength="240" required aria-describedby="' + panelId + '-capacity" value="' + esc(draft.title) + '" placeholder="예: 다음 부탁 대화의 첫 문장 다듬기"></label><button type="submit" data-note-submit>계정에 메모 남기기</button><button type="button" data-cloud="cancel-edit" hidden>수정 취소</button></form><div class="continuity-undo" data-note-undo hidden><p role="status" data-note-undo-message></p><button type="button" data-cloud="undo-note">삭제 되돌리기</button><p data-note-undo-detail></p></div><div class="continuity-note-tools"><label>메모 검색<input type="search" data-note-search placeholder="메모 내용이나 공간 이름" aria-label="메모 검색"></label><label>메모 상태<select data-note-filter><option value="all">모두</option><option value="pending">미완료</option><option value="done">완료</option></select></label></div><div class="continuity-notes">' + nextNotes + "</div><p>최근 열기는 실제 작업 완료나 학습 성과를 뜻하지 않아요.</p>") : "<p>계정에 로그인한 뒤 라이브러리를 연결할 수 있어요. 기기의 바로가기는 그대로 유지됩니다.</p>";
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
    doc = next;
    message = "";
    const result = notebook.change(next);
    render();
    if (!await result) {
      if (expected !== modeVersion) return false;
      throw new Error("변경을 보관하지 못했어요. 저장 상태를 확인해 주세요.");
    }
    return true;
  }
  connect.onclick = async () => {
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
        preferRemoteOnOpen: true,
        mount,
        content,
        description: "즐겨찾기·최근 열기·직접 적은 메모만 연결합니다. 앱 원문과 이용 권한은 각 앱에서 확인해요.",
        getState: () => doc,
        applyState: (value) => {
          doc = validatePlatformLibrary(value);
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
        onDocumentRemoved: () => {
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
      if (!disposed) {
        connect.disabled = false;
        connect.setAttribute("aria-busy", "false");
        connect.textContent = "계정 라이브러리 연결";
        summary();
      }
    }
  };
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
    notebook?.suspend();
    summary();
  }, resume = () => {
    pageSuspended = false;
    notebook?.resume();
    render();
    if (connectOnResume) {
      connectOnResume = false;
      void connect.onclick();
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
    openNote(id2) {
      if (pageSuspended || disposed || !notebook?.active || !notebook.canEdit || !doc.consent || !doc.notes.some((row) => row.id === id2)) return false;
      noteQuery = "";
      noteFilter = "all";
      if (doc.notes.find((row) => row.id === id2).done) completedExpanded = true;
      expand(true);
      render();
      const card = content.querySelector('[data-note-id="' + id2 + '"]');
      card?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
      card?.focus?.({ preventScroll: true });
      return true;
    },
    dispose() {
      disposed = true;
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
