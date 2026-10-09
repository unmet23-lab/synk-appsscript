var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
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

// experiences/synk-account/src/generated/account-client.cjs
var require_account_client = __commonJS({
  "experiences/synk-account/src/generated/account-client.cjs"(exports, module) {
    "use strict";
    function fault(code, message, retryable = false, extra = {}) {
      return Object.assign(new Error(message), { code, retryable, ...extra });
    }
    var messages = {
      FEATURE_DISABLED: "\uAE30\uB85D \uC5F0\uACB0\uC740 \uC544\uC9C1 \uC900\uBE44 \uC911\uC774\uC5D0\uC694. \uAE30\uBCF8 \uC5F0\uC2B5\uC740 \uACC4\uC18D \uC774\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694.",
      REVISION_CONFLICT: "\uB2E4\uB978 \uAE30\uAE30\uC5D0\uC11C \uC5F0\uACB0 \uC124\uC815\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694. \uACC4\uC815\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
      PROFILE_CONFLICT: "\uB2E4\uB978 \uAE30\uAE30\uC5D0\uC11C \uD504\uB85C\uD544\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694. \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
      LEARNING_DISABLED: "\uD559\uC2B5 \uAE30\uB85D \uC5F0\uACB0\uC774 \uAEBC\uC838 \uC788\uC5B4\uC694. \uB0B4 SYNK \uACC4\uC815\uC5D0\uC11C \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
      HISTORY_CAPACITY: "\uAE30\uB85D \uBCF4\uAD00 \uD55C\uB3C4\uC5D0 \uB3C4\uB2EC\uD588\uC5B4\uC694. \uAE30\uC874 \uAE30\uB85D\uC740 \uBCF4\uC874\uB418\uC5B4 \uC788\uC73C\uB2C8 \uACE0\uAC1D \uC9C0\uC6D0\uC5D0 \uBB38\uC758\uD574 \uC8FC\uC138\uC694.",
      SESSION_REVOKED: "\uAE30\uAE30 \uC5F0\uACB0\uC774 \uD574\uC81C\uB410\uC5B4\uC694. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.",
      AUTH_REQUIRED: "\uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.",
      AUTH_SESSION_MISSING: "\uB85C\uADF8\uC778 \uC815\uBCF4\uB97C \uC0C8\uB85C \uD655\uC778\uD574\uC57C \uD574\uC694. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.",
      EVENT_CONFLICT: "\uD559\uC2B5 \uAE30\uB85D\uC744 \uB300\uC870\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uAE30\uC874 \uAE30\uB85D\uC740 \uBCF4\uC874\uD558\uACE0 \uC5F0\uACB0\uC744 \uC911\uB2E8\uD588\uC5B4\uC694.",
      INVALID_REASONS: "\uBC30\uC6B0\uB294 \uC774\uC720\uB294 1~3\uAC1C\uAE4C\uC9C0 \uACE0\uB97C \uC218 \uC788\uC5B4\uC694. \uB2E4\uC2DC \uACE8\uB77C \uC8FC\uC138\uC694.",
      INVALID_EVALUATION: "\uB2F5\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uBCF4\uAE30\uC5D0\uC11C \uB2E4\uC2DC \uACE8\uB77C \uC8FC\uC138\uC694.",
      EVALUATION_NOT_ASKED: "\uD559\uC6D0\uC5D0 \uC18C\uC18D\uB41C \uACC4\uC815\uC5D0\uB294 \uC774 \uC9C8\uBB38\uC744 \uD558\uC9C0 \uC54A\uC544\uC694.",
      ACCOUNT_UNAVAILABLE: "\uACC4\uC815 \uC0AD\uC81C\uB97C \uC694\uCCAD\uD55C \uC0C1\uD0DC\uB77C \uC800\uC7A5\uD560 \uC218 \uC5C6\uC5B4\uC694. \uC694\uCCAD\uC744 \uCDE8\uC18C\uD558\uBA74 \uB2E4\uC2DC \uC4F8 \uC218 \uC788\uC5B4\uC694.",
      REQUEST_NOT_FOUND: "\uCDE8\uC18C\uD560 \uC0AD\uC81C \uC694\uCCAD\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694. \uACC4\uC815\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
      DELETION_NOT_CANCELLABLE: "\uC0AD\uC81C\uB97C \uC774\uBBF8 \uCC98\uB9AC\uD558\uACE0 \uC788\uC5B4\uC11C \uCDE8\uC18C\uD560 \uC218 \uC5C6\uC5B4\uC694. hello@synk.im\uC73C\uB85C \uBB38\uC758\uD574 \uC8FC\uC138\uC694.",
      MY_INFO_UNAVAILABLE: "\uB0B4 \uC815\uBCF4\uB294 \uC544\uC9C1 \uC900\uBE44 \uC911\uC774\uC5D0\uC694. \uC5F0\uC2B5\uC740 \uADF8\uB300\uB85C \uC774\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694.",
      MEMORY_UNAVAILABLE: "\uACE0\uB978 \uC124\uC815\uC744 \uACC4\uC815\uC5D0 \uC800\uC7A5\uD558\uB294 \uAE30\uB2A5\uC740 \uC544\uC9C1 \uC900\uBE44 \uC911\uC774\uC5D0\uC694. \uC774 \uAE30\uAE30\uC5D0\uB294 \uADF8\uB300\uB85C \uB0A8\uC544\uC694.",
      MEMORY_CAPACITY: "\uACC4\uC815\uC5D0 \uC800\uC7A5\uD560 \uC218 \uC788\uB294 \uB9DE\uCDA4 \uAE30\uB85D\uC774 \uAC00\uB4DD \uCC3C\uC5B4\uC694. \uC774 \uAE30\uAE30\uC5D0\uB294 \uADF8\uB300\uB85C \uB0A8\uC544\uC694.",
      INVALID_MEMORY: "\uB9DE\uCDA4 \uAE30\uB85D\uC744 \uACC4\uC815\uC5D0 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC774 \uAE30\uAE30\uC5D0\uB294 \uADF8\uB300\uB85C \uB0A8\uC544\uC694.",
      SUMMARY_UNAVAILABLE: "\uC544\uD2C0\uB77C\uC2A4 \uC694\uC57D\uC740 \uC544\uC9C1 \uC900\uBE44 \uC911\uC774\uC5D0\uC694."
    };
    function createAccountClient({
      url,
      anonKey,
      product,
      appVersion = "0.2.0",
      getAccessToken,
      refresh,
      guard,
      fetch: fetcher = globalThis.fetch,
      timeoutMs = 12e3
    }) {
      if (!["world", "platform"].includes(product) || typeof guard !== "function" || typeof getAccessToken !== "function") throw new TypeError("An authenticated product host is required");
      const configured = !!url && !!anonKey;
      async function request(path, body, { signal } = {}) {
        const checkCancelled = () => {
          if (signal?.aborted) throw fault("NETWORK", "\uC694\uCCAD\uC744 \uC911\uB2E8\uD588\uC5B4\uC694.", true);
        };
        guard();
        checkCancelled();
        if (!configured) throw fault("CONFIG", "\uACC4\uC815 \uC5F0\uACB0 \uC124\uC815\uC774 \uC544\uC9C1 \uC900\uBE44\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694.");
        const send = async (token2) => {
          guard();
          checkCancelled();
          if (!token2) throw fault("AUTH_REQUIRED", "\uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.");
          const abort = new AbortController();
          const cancel = () => abort.abort();
          if (signal?.aborted) cancel();
          signal?.addEventListener("abort", cancel, { once: true });
          const timer = setTimeout(cancel, timeoutMs);
          try {
            const response2 = await fetcher(`${url.replace(/\/$/, "")}/functions/v1/${path}`, {
              method: body === void 0 ? "GET" : "POST",
              signal: abort.signal,
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${token2}`,
                "X-SYNK-Product": product,
                "X-SYNK-Contract": "1",
                "X-SYNK-App-Version": appVersion,
                ...body === void 0 ? {} : { "Content-Type": "application/json" }
              },
              ...body === void 0 ? {} : { body: JSON.stringify(body) }
            });
            const data2 = await response2.json().catch(() => null);
            guard();
            checkCancelled();
            if (abort.signal.aborted) throw fault("NETWORK", "\uC5F0\uACB0\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", true);
            return { response: response2, data: data2 };
          } catch (error) {
            guard();
            if (error.code) throw error;
            throw fault("NETWORK", "\uC5F0\uACB0\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uAE30\uB85D\uC740 \uC774 \uAE30\uAE30\uC5D0 \uB0A8\uACA8 \uB450\uACE0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC694.", true);
          } finally {
            clearTimeout(timer);
            signal?.removeEventListener("abort", cancel);
          }
        };
        const token = getAccessToken();
        let result = await send(token);
        if (result.response.status === 401 && typeof refresh === "function") {
          const renewed = await refresh(token);
          guard();
          if (renewed) result = await send(renewed);
        }
        const { response, data } = result;
        if (!response.ok || data?.ok !== true) {
          const code = data?.error?.code || (response.status === 401 ? "AUTH_REQUIRED" : response.status === 429 || response.status >= 500 ? "SERVICE_UNAVAILABLE" : "ACCOUNT_UNAVAILABLE");
          throw fault(
            code,
            messages[code] || data?.error?.message !== code && data?.error?.message || "\uACC4\uC815 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
            response.status === 429 || response.status >= 500,
            { status: response.status, revision: data?.revision }
          );
        }
        return data;
      }
      const action = (action2, values = {}, options) => request("synk-account", { action: action2, ...values }, options);
      const play = async (body) => {
        if (product !== "world") throw fault("PRODUCT_FORBIDDEN", "WORLD \uACC4\uC815\uC73C\uB85C \uAC8C\uC784 \uAE30\uB85D\uC744 \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
        const data = await request("synk-play", body);
        if (data.scope !== "synk-play" || typeof data.accountId !== "string" || !data.accountId || !Number.isSafeInteger(data.revision) || data.revision < 0 || !data.state || typeof data.state !== "object" || !data.state.wallet || typeof data.state.wallet !== "object" || !data.state.records || typeof data.state.records !== "object" || typeof data.state.imported !== "boolean") throw fault("INVALID_RESPONSE", "\uAC8C\uC784 \uACC4\uC815 \uAE30\uB85D\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
        return {
          ok: true,
          scope: data.scope,
          accountId: data.accountId,
          revision: data.revision,
          state: data.state,
          ...Object.hasOwn(data, "result") ? { result: data.result } : {},
          ...data.duplicate === true ? { duplicate: true } : {}
        };
      };
      return Object.freeze({
        configured,
        product,
        play: Object.freeze({ load: () => play(), mutate: (body) => {
          if (!body || typeof body !== "object" || Array.isArray(body)) return Promise.reject(fault("INVALID_REQUEST", "\uAC8C\uC784 \uC800\uC7A5 \uC694\uCCAD\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."));
          return play(body);
        } }),
        load: () => request("synk-account"),
        wardrobeLoad: () => request("synk-wardrobe"),
        wardrobeSave: (values) => request("synk-wardrobe", { action: "save", ...values }),
        platformLoad: () => request("synk-personal?resource=platform-library"),
        platformSave: ({ state, expected_revision }) => request("synk-personal", { resource: "platform-library", action: "save", state, expected_revision }),
        platformDelete: ({ expected_revision }) => request("synk-personal", { resource: "platform-library", action: "delete", expected_revision }),
        release: () => request(`release-policy?app_version=${encodeURIComponent(appVersion)}`),
        setLearning: (enabled, expected_revision) => action("learning-consent", { enabled, expected_revision }),
        updateProfile: (profile, expected_profile_revision) => action("profile-update", { profile, expected_profile_revision }),
        revokeSession: (session_id, options) => action("revoke-session", { session_id }, options),
        revokeAll: () => action("revoke-all-sessions"),
        requestDeletion: (request_id) => action("delete-request", { request_id }),
        // 7일 취소 유예 동안(요청이 아직 처리 전일 때) 같은 요청 번호로 취소한다.
        cancelDeletion: (request_id) => action("delete-cancel", { request_id }),
        // 「나 > 내 정보」 — 배우는 이유(덧붙이기)와 평가 전용 선택 응답(맞춤의 입력이 아니다).
        saveReasons: (reasons, other = null) => action("learn-reasons", { reasons, other }),
        skipReasons: () => action("learn-reasons-skip"),
        answerEvaluation: ({ age_band, gender, consent_version }) => action("evaluation-answer", { age_band, gender, consent_version }),
        skipEvaluation: () => action("evaluation-skip"),
        deleteEvaluation: () => action("evaluation-delete"),
        exportPage: ({ after = 0, until } = {}) => request(`synk-account?view=export&after=${encodeURIComponent(after)}${until == null ? "" : `&until=${encodeURIComponent(until)}`}`),
        // Core's summary of this account for any SYNK product: chosen settings, declared reasons and
        // the stored practice (only while learning storage is on). Never evaluation answers.
        atlasSummary: (options) => request("synk-account?view=atlas", void 0, options),
        exportAiPage: ({ after = 0, until } = {}) => request(`synk-account?view=ai-export&after=${encodeURIComponent(after)}${until == null ? "" : `&until=${encodeURIComponent(until)}`}`),
        learning: Object.freeze({
          get: ({ after, revision, signal }) => request(`synk-learning?after=${encodeURIComponent(after)}&revision=${encodeURIComponent(revision)}`, void 0, { signal }),
          post: ({ revision, events, signal }) => request("synk-learning", { revision, events }, { signal })
        }),
        // Core memory (lib/atlas/memory-sync.js): chosen presentation, content memories, declined offers.
        memory: Object.freeze({
          get: ({ revision, signal }) => request(`synk-learning?view=memory&revision=${encodeURIComponent(revision)}`, void 0, { signal }),
          post: ({ revision, entries, signal }) => request("synk-learning", { revision, memory: entries }, { signal })
        })
      });
    }
    module.exports = { createAccountClient };
  }
});

// experiences/synk-account/src/core.mjs
var PRODUCTS = Object.freeze({ platform: "SYNK \uD50C\uB7AB\uD3FC", world: "SYNK WORLD", messenger: "SYNK Workspace", care: "SYNK \uD50C\uB808\uC800", path: "SYNK PATH", "path-travel": "SYNK PATH \uC5EC\uD589", rehearsal: "\uC911\uC694\uD55C \uB300\uD654 \uB9AC\uD5C8\uC124", "family-album": "\uAC00\uC871 \uC774\uC57C\uAE30 \uC568\uBC94" });
var nativeSchemes = /* @__PURE__ */ new Set(["synktalk:", "im.synk.platform:", "im.synk.world:", "im.synk.messenger:", "im.synk.care:"]);
function callbackUrl(value) {
  const url = new URL(value);
  if (!nativeSchemes.has(url.protocol)) publicUrl(value);
  if (url.username || url.password || url.hash || [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1) || ["code", "state", "error", "error_description", "access_token", "refresh_token"].some((key) => url.searchParams.has(key))) throw new Error("\uB85C\uADF8\uC778 \uB3C4\uCC29 \uC8FC\uC18C\uC758 \uD615\uC2DD\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  return url;
}
function callbackMatches(actual, expected) {
  if (actual.username || actual.password || actual.hash || actual.protocol !== expected.protocol || actual.host !== expected.host || actual.pathname !== expected.pathname) return false;
  const allowed = /* @__PURE__ */ new Set([...expected.searchParams.keys(), "code", "state", "error", "error_description"]);
  return [...actual.searchParams.keys()].every((key) => allowed.has(key) && actual.searchParams.getAll(key).length === 1) && [...expected.searchParams].every(([key, value]) => actual.searchParams.get(key) === value) && !(actual.searchParams.has("code") && actual.searchParams.has("error"));
}
var isLoopback = (hostname) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
function publicUrl(value, { relative = false, base } = {}) {
  const url = relative ? new URL(value, base) : new URL(value);
  if (url.username || url.password || !["https:", "http:"].includes(url.protocol) || url.protocol === "http:" && !isLoopback(url.hostname)) throw new Error("HTTPS \uB610\uB294 \uB85C\uCEEC \uAC1C\uBC1C \uC8FC\uC18C\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694.");
  return url;
}
function readConfig(value, base) {
  const allowed = ["version", "supabaseUrl", "supabasePublishableKey", "accountApiUrl", "portalUrl", "learningUrl", "messengerUrl", "clients", "authorizationClients"];
  if (!value || value.version !== 1 || Object.keys(value).some((key2) => !allowed.includes(key2))) throw new Error("\uACF5\uAC1C \uC124\uC815 \uD30C\uC77C\uC758 \uD615\uC2DD\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  const key = value.supabasePublishableKey || "";
  if (typeof key !== "string" || key.startsWith("sb_secret_")) throw new Error("\uC11C\uBC84 \uBE44\uBC00 \uD0A4\uB97C \uBE0C\uB77C\uC6B0\uC800 \uC124\uC815\uC5D0 \uB123\uC744 \uC218 \uC5C6\uC5B4\uC694.");
  if (key.split(".").length === 3) {
    try {
      if (JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role !== "anon") throw new Error("role");
    } catch {
      throw new Error("\uBE0C\uB77C\uC6B0\uC800\uC5D0\uB294 \uACF5\uAC1C publishable \uB610\uB294 anon \uD0A4\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694.");
    }
  }
  const config = { ...value, clients: {}, configured: !!value.supabaseUrl && !!key && !!value.portalUrl };
  for (const field of ["supabaseUrl", "accountApiUrl", "portalUrl"]) if (value[field]) publicUrl(value[field]);
  for (const product of Object.keys(PRODUCTS)) {
    const client = value.clients?.[product] || {};
    if (Object.keys(client).some((key2) => !["clientId", "redirectUri"].includes(key2))) throw new Error("\uACF5\uAC1C OAuth \uD074\uB77C\uC774\uC5B8\uD2B8\uC5D0\uB294 \uBE44\uBC00 \uD0A4\uB97C \uB123\uC9C0 \uC54A\uC544\uC694.");
    if (client.redirectUri) {
      publicUrl(client.redirectUri);
      callbackUrl(client.redirectUri);
    }
    config.clients[product] = { clientId: client.clientId || "", redirectUri: client.redirectUri || "" };
  }
  config.authorizationClients = (value.authorizationClients || []).map((client) => {
    if (!PRODUCTS[client.product] || typeof client.clientId !== "string" || !Array.isArray(client.redirectUris) || Object.keys(client).some((key2) => !["product", "clientId", "redirectUris"].includes(key2))) throw new Error("\uC81C\uD488\uBCC4 \uB85C\uADF8\uC778 \uB3C4\uCC29 \uC8FC\uC18C \uC124\uC815\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    for (const value2 of client.redirectUris) callbackUrl(value2);
    return { ...client };
  });
  config.accountApiUrl ||= config.supabaseUrl;
  config.learningUrl = publicUrl(value.learningUrl || "../learning-hub/", { relative: true, base }).href;
  return config;
}
var base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function createPKCE(cryptoAPI = globalThis.crypto) {
  const verifier = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const state = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await cryptoAPI.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, state, challenge };
}
async function beginOAuth({ config, product, storage, now = Date.now(), cryptoAPI }) {
  const client = config.clients[product];
  if (!config.configured || !client?.clientId || !client.redirectUri) throw new Error("\uC774 \uC81C\uD488\uC758 SSO \uC5F0\uACB0 \uC124\uC815\uC774 \uC544\uC9C1 \uC900\uBE44\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694.");
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
  if (!raw) throw new Error("\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC2DC\uC791\uD55C \uB85C\uADF8\uC778 \uC694\uCCAD\uC774 \uC544\uB2C8\uC5D0\uC694. \uB2E4\uC2DC \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.");
  const pending = JSON.parse(raw), client = config.clients[product];
  if (!pending || pending.product !== product || pending.clientId !== client?.clientId || pending.redirectUri !== client?.redirectUri || params.get("state") !== pending.state || now - pending.createdAt > 6e5 || now < pending.createdAt) throw new Error("\uB85C\uADF8\uC778 \uC694\uCCAD\uC774 \uB9CC\uB8CC\uB418\uC5C8\uAC70\uB098 \uC0C1\uD0DC\uAC00 \uB2EC\uB77C\uC84C\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.");
  const actual = new URL(url), expected = new URL(client.redirectUri);
  if (!callbackMatches(actual, expected)) throw new Error("\uB4F1\uB85D\uD55C \uB85C\uADF8\uC778 \uB3C4\uCC29 \uC8FC\uC18C\uC640 \uB2EC\uB77C\uC694.");
  storage.removeItem(key);
  if (params.has("error")) throw new Error(params.get("error") === "access_denied" ? "\uC81C\uD488 \uC5F0\uACB0\uC744 \uCDE8\uC18C\uD588\uC5B4\uC694." : "\uB85C\uADF8\uC778\uC744 \uB9C8\uCE58\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.");
  const code = params.get("code");
  if (!code) throw new Error("\uB85C\uADF8\uC778 \uCF54\uB4DC\uAC00 \uC5C6\uC5B4\uC694.");
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
      throw Object.assign(new Error("\uB85C\uADF8\uC778 \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC5F0\uACB0\uC774 \uB3CC\uC544\uC624\uBA74 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "NETWORK", retryable: true });
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (response.ok && error?.name !== "SyntaxError") throw Object.assign(new Error("\uB85C\uADF8\uC778 \uC751\uB2F5\uC744 \uB05D\uAE4C\uC9C0 \uBC1B\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC5F0\uACB0\uC774 \uB3CC\uC544\uC624\uBA74 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "NETWORK", retryable: true });
      data = null;
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw Object.assign(new Error(retryable ? "\uB85C\uADF8\uC778 \uC11C\uBC84\uAC00 \uC7A0\uC2DC \uC751\uB2F5\uD558\uC9C0 \uC54A\uC544\uC694. \uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694." : "\uB85C\uADF8\uC778 \uC5F0\uACB0\uC744 \uB9C8\uCE58\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694."), { code: retryable ? "AUTH_UNAVAILABLE" : "AUTH_REQUIRED", status: response.status, retryable });
    }
    if (!data || typeof data.access_token !== "string" || !data.access_token) throw Object.assign(new Error("\uB85C\uADF8\uC778 \uC751\uB2F5\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694."), { code: "INVALID_RESPONSE" });
    return { access_token: data.access_token, refresh_token: data.refresh_token || null, expires_at: Date.now() + Number(data.expires_in || 3600) * 1e3 };
  } finally {
    clearTimeout(timer);
  }
}

// experiences/synk-account/src/platform-entry.mjs
var PARAM = "synk-platform-account";
var CANCEL = "synk-platform-cancelled";
var validId = (value) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
var mismatch = () => Object.assign(new Error("\uD50C\uB7AB\uD3FC\uC5D0\uC11C \uC120\uD0DD\uD55C SYNK ID\uC640 \uB85C\uADF8\uC778 \uACC4\uC815\uC774 \uB2EC\uB77C\uC694. \uD50C\uB7AB\uD3FC \uACC4\uC815\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uC5F4\uC5B4 \uC8FC\uC138\uC694."), { code: "PLATFORM_ACCOUNT_MISMATCH" });
function createPlatformEntry({ clientKey, getUrl, replaceUrl }) {
  const key = `synk.platform.entry.${clientKey}`;
  let captured = false, restored = false, invalid = false, cancelled = false, intent = null, storage;
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
      throw Object.assign(new Error("\uD50C\uB7AB\uD3FC\uC758 \uACC4\uC815 \uC5F0\uACB0\uC744 \uC774 \uD0ED\uC5D0 \uBCF4\uAD00\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uBE0C\uB77C\uC6B0\uC800 \uC800\uC7A5 \uC124\uC815\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."), { code: "PLATFORM_ENTRY_STORAGE", retryable: true });
    }
    intent = next;
    invalid = next.invalid === true;
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
      if (invalid) throw mismatch();
      if (restored) return;
      storage = value;
      const text = storage.getItem(key);
      if (text) {
        try {
          if (text.length > 1024) throw mismatch();
          intent = JSON.parse(text);
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
        throw Object.assign(new Error("\uD654\uBA74\uC758 \uB85C\uADF8\uC778\uC740 \uC885\uB8CC\uD588\uC9C0\uB9CC \uC790\uB3D9 \uC5F0\uACB0 \uCDE8\uC18C\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC774 \uCC3D\uC744 \uB2EB\uC544 \uC8FC\uC138\uC694."), { code: "PLATFORM_ENTRY_STORAGE", retryable: false });
      }
    }
  };
}
var PUBLIC = Object.freeze({ world: "https://synk.im/account/client.html?product=world&play=learning-hub", care: "https://synk.im/care/", fortune: "https://synk.im/fortune/", rehearsal: "https://synk.im/rehearsal/" });

// experiences/synk-world-app/world-account.mjs
var import_account_client = __toESM(require_account_client(), 1);

// experiences/synk-world-app/operating-mode.mjs
function publicWorldConfig(value, base) {
  if (!value || !["rehearsal", "account"].includes(value.mode)) throw new TypeError("WORLD connection mode is required");
  const basePath = value.basePath || "/";
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath)) throw new TypeError("Invalid WORLD base path");
  if (value.mode === "rehearsal") return { mode: "rehearsal", basePath };
  const account = readConfig(value.account, base);
  if (!account.configured || !account.clients.world.clientId || !account.clients.world.redirectUri) throw new TypeError("Configured public WORLD account is required");
  const { configured, ...publicAccount } = account;
  return { mode: "account", basePath, account: publicAccount };
}
async function loadWorldConfig({ value = globalThis.__SYNK_WORLD_CONFIG__, base = globalThis.location.href, fetcher = (...args) => globalThis.fetch(...args) } = {}) {
  if (value) return publicWorldConfig(value, base);
  const response = await fetcher(new URL("./world-config.json", base).href, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error("WORLD \uACC4\uC815 \uC5F0\uACB0 \uC124\uC815\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694.");
  return publicWorldConfig(await response.json(), base);
}

// experiences/synk-world-app/world-account.mjs
var changed = () => Object.assign(Error("\uACC4\uC815 \uC5F0\uACB0\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694."), { code: "ACCOUNT_CHANGED" });
var authErrors = /* @__PURE__ */ new Set(["AUTH_REQUIRED", "AUTH_SESSION_MISSING", "SESSION_REVOKED"]);
var routes = /* @__PURE__ */ new Map([["bootstrap", "GET"], ["play/start", "POST"], ["play/complete", "POST"], ["avatar/outfit", "PUT"], ["wardrobe/looks", "PUT"], ["town/entry", "GET"], ["town/state", "GET"], ["town/sharing", "POST"], ["town/command", "POST"], ["town/presence", "POST"], ["enrollment/preview", "POST"], ["enrollment/claim", "POST"]]);
function createWorldAccount({
  config: raw,
  storage = globalThis.sessionStorage,
  fetcher = (...args) => globalThis.fetch(...args),
  getUrl = () => location.href,
  replaceUrl = (url) => history.replaceState(null, "", url),
  navigate = (url) => location.assign(url),
  onInvalidate = () => {
  },
  accountFactory = import_account_client.default.createAccountClient,
  requestToken = tokenRequest,
  now = Date.now
} = {}) {
  const config = readConfig(raw, getUrl()), key = "synk.oauth.session.world";
  const binding = [config.supabaseUrl, config.accountApiUrl, config.clients.world.clientId, config.clients.world.redirectUri].join("|");
  const entry = createPlatformEntry({ clientKey: "world", getUrl, replaceUrl });
  let session = null, rawSession = null, owner = null, currentSessionId = null, currentAccount = null, epoch = 0, closed = false, refreshing = null, pendingExchange = null, townBinding = null, townStateRevision = -1;
  const controllers = /* @__PURE__ */ new Set();
  const guard = (expected) => {
    if (closed || expected !== epoch) throw changed();
    if (session && storage.getItem(key) !== rawSession) {
      clear();
      throw changed();
    }
  };
  function clear() {
    epoch++;
    session = null;
    owner = null;
    currentSessionId = null;
    currentAccount = null;
    townBinding = null;
    townStateRevision = -1;
    for (const c of controllers) c.abort();
    onInvalidate();
  }
  function save(value) {
    session = value;
    rawSession = JSON.stringify({ ...value, configKey: binding });
    storage.setItem(key, rawSession);
  }
  async function renew(expected) {
    guard(expected);
    if (refreshing) return refreshing;
    if (!session?.refresh_token) return null;
    const old = session, promise = (async () => {
      const next = await requestToken(config, { grant_type: "refresh_token", client_id: config.clients.world.clientId, refresh_token: old.refresh_token }, fetcher);
      guard(expected);
      save({ ...next, refresh_token: next.refresh_token || old.refresh_token });
      return session.access_token;
    })();
    refreshing = promise;
    try {
      return await promise;
    } finally {
      if (refreshing === promise) refreshing = null;
    }
  }
  async function verify(expected) {
    guard(expected);
    if (!session) return false;
    if (session.expires_at <= now() + 3e4) {
      await renew(expected);
      guard(expected);
    }
    const client = accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product: "world", getAccessToken: () => session?.access_token, refresh: () => renew(expected), guard: () => guard(expected), fetch: fetcher });
    const data = await client.load();
    guard(expected);
    const id = data.account?.synk_user_id;
    if (data.ok !== true || typeof id !== "string" || !id || data.account.status !== "active") throw Object.assign(Error("\uD65C\uC131\uD654\uB41C SYNK ID\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "ACCOUNT_UNAVAILABLE" });
    entry.assertAccount(id);
    if (owner && id !== owner) throw changed();
    owner = id;
    currentSessionId = data.sessions?.find((s) => s.current && !s.revoked)?.id || null;
    currentAccount = data;
    return true;
  }
  async function restore() {
    const expected = epoch;
    entry.capture(storage);
    entry.restore(storage);
    guard(expected);
    if (entry.isCancelled()) return false;
    if (!config.configured || !config.clients.world.clientId || !config.clients.world.redirectUri) throw Object.assign(Error("\uC774 WORLD\uC758 SYNK ID \uACF5\uAC1C \uC5F0\uACB0 \uC124\uC815\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "AUTH_CONFIG" });
    const url = new URL(getUrl());
    if (url.searchParams.has("code") || url.searchParams.has("error")) {
      try {
        pendingExchange = consumeCallback({ config, product: "world", url: url.href, storage, now: now() });
      } finally {
        for (const p of ["code", "state", "error", "error_description"]) url.searchParams.delete(p);
        replaceUrl(url.href);
      }
    }
    if (pendingExchange) {
      const next = await requestToken(config, pendingExchange, fetcher);
      guard(expected);
      pendingExchange = null;
      save(next);
    } else if (!session) {
      rawSession = storage.getItem(key);
      let value;
      try {
        if (rawSession?.length > 65536) throw Error();
        value = JSON.parse(rawSession || "null");
      } catch {
        value = null;
      }
      if (value && (value.configKey !== void 0 && value.configKey !== binding || typeof value.access_token !== "string" || !value.access_token || value.access_token.length > 16384 || !Number.isFinite(value.expires_at) || value.refresh_token !== null && typeof value.refresh_token !== "string")) {
        storage.removeItem(key);
        rawSession = null;
        value = null;
      }
      session = value;
    }
    if (!session) return false;
    try {
      return await verify(expected);
    } catch (error) {
      if (authErrors.has(error.code)) {
        clear();
        storage.removeItem(key);
      }
      throw error;
    }
  }
  async function signIn() {
    clear();
    entry.resume();
    entry.stop();
    const expected = epoch;
    const url = await beginOAuth({ config, product: "world", storage, now: now() });
    guard(expected);
    navigate(url);
  }
  async function request(path, options = {}) {
    if (!routes.has(path) || (options.method || "GET") !== routes.get(path)) throw new TypeError("Unsupported WORLD request");
    const expected = epoch;
    guard(expected);
    if (!owner || !session) throw Object.assign(Error("SYNK ID\uB85C \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694."), { code: "AUTH_REQUIRED", status: 401 });
    if (path === "town/state") await verify(expected);
    if (path === "town/entry") {
      townBinding = null;
      townStateRevision = -1;
    }
    if (path === "town/sharing" && !townBinding?.classId) throw Object.assign(Error("CLASSROOM_FORBIDDEN"), { code: "CLASSROOM_FORBIDDEN", status: 403 });
    const endpoint = path === "town/sharing" || path.startsWith("enrollment/") ? "synk-classroom" : path.startsWith("town/") ? "synk-town" : "synk-world-v1", suffix = path === "town/sharing" ? "api/world/town/sharing" : path.startsWith("enrollment/") ? `api/${path}` : path.startsWith("town/") ? path.slice(5) : path;
    const url = new URL(config.accountApiUrl);
    url.pathname = url.pathname.replace(/\/$/, "").replace(/\/functions\/v1(?:\/synk-(?:account|world-v1|town))?$/, "") + `/functions/v1/${endpoint}/${suffix}`;
    url.search = "";
    url.hash = "";
    if (path.startsWith("town/") && path !== "town/entry" && townBinding?.classId) url.searchParams.set("classId", townBinding.classId);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12e3);
    controllers.add(controller);
    try {
      if (session.expires_at <= now() + 3e4) await renew(expected);
      guard(expected);
      for (let attempt = 0; attempt < 2; attempt++) {
        const token = session.access_token;
        const response = await fetcher(url.href, {
          method: options.method || "GET",
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
          headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${token}`, "X-SYNK-Product": "world", "X-SYNK-Contract": "1", "X-SYNK-App-Version": "1.0.0", ...options.body ? { "Content-Type": "application/json" } : {} },
          ...options.body ? { body: options.body } : {}
        });
        guard(expected);
        if (response.status === 401 && attempt === 0 && session.refresh_token) {
          await renew(expected);
          guard(expected);
          continue;
        }
        const data = await response.json();
        guard(expected);
        if (response.status === 401 || authErrors.has(data?.error?.code)) {
          clear();
          storage.removeItem(key);
        }
        if (response.ok && path !== "town/sharing" && !path.startsWith("enrollment/") && data?.accountId !== owner) throw Object.assign(Error("\uB2E4\uB978 \uACC4\uC815\uC758 \uC751\uB2F5\uC744 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694."), { code: "ACCOUNT_MISMATCH" });
        if (response.ok && data.binding) {
          const next = data.binding;
          if (townBinding && (next.classId !== townBinding.classId || Number(next.sharing?.revision) < Number(townBinding.sharing?.revision) || Number(next.membershipRevision) < Number(townBinding.membershipRevision) || next.sharing?.revision === townBinding.sharing?.revision && townBinding.sharing?.enabled === false && next.sharing?.enabled === true)) throw Object.assign(Error("TOWN_SNAPSHOT_CHANGED"), { code: "TOWN_SNAPSHOT_CHANGED" });
          townBinding = next;
        }
        if (response.ok && path.startsWith("town/") && Number.isSafeInteger(data.state?.revision)) {
          if (data.state.revision < townStateRevision) throw Object.assign(Error("TOWN_SNAPSHOT_CHANGED"), { code: "TOWN_SNAPSHOT_CHANGED" });
          townStateRevision = data.state.revision;
        }
        return { ok: response.ok, status: response.status, json: async () => {
          guard(expected);
          return data;
        } };
      }
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }
  async function logout() {
    const captured = session, id = currentSessionId;
    clear();
    entry.cancel();
    storage.removeItem(key);
    rawSession = null;
    if (!captured) return { serverRevoked: true };
    let serverRevoked = false;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12e3);
    try {
      const revokeFetch = (url, options) => fetcher(url, { ...options, signal: controller.signal });
      if (id) {
        const client = accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product: "world", getAccessToken: () => captured.access_token, guard: () => {
        }, fetch: revokeFetch });
        const result = await client.revokeSession(id);
        serverRevoked = result.refreshRevoked === true;
      }
      const response = await revokeFetch(new URL("/auth/v1/logout?scope=local", config.supabaseUrl).href, { method: "POST", credentials: "omit", cache: "no-store", headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${captured.access_token}` } });
      serverRevoked = response.ok && serverRevoked;
    } catch {
    } finally {
      clearTimeout(timer);
    }
    return { serverRevoked };
  }
  return Object.freeze({
    mode: "account",
    restore,
    signIn,
    request,
    logout,
    identity: () => ({ accountId: owner, generation: epoch }),
    assertActive() {
      guard(epoch);
      if (!owner) throw changed();
    },
    preferences() {
      const learning = currentAccount?.learning;
      return learning && typeof learning.enabled === "boolean" && Number.isSafeInteger(learning.revision) ? { enabled: learning.enabled, revision: learning.revision } : null;
    },
    async setLearning(enabled, expectedRevision) {
      const expected = epoch;
      guard(expected);
      if (!owner || typeof enabled !== "boolean" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new TypeError("Invalid account learning preference");
      const client = accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product: "world", getAccessToken: () => session?.access_token, refresh: () => renew(expected), guard: () => guard(expected), fetch: fetcher });
      try {
        await client.setLearning(enabled, expectedRevision);
        guard(expected);
        await verify(expected);
        guard(expected);
        return this.preferences();
      } catch (error) {
        if (authErrors.has(error.code)) {
          clear();
          storage.removeItem(key);
        }
        throw error;
      }
    },
    async enrollmentRequest(operation, body) {
      if (!["preview", "claim"].includes(operation)) throw new TypeError("Unknown enrollment operation");
      const response = await request(`enrollment/${operation}`, { method: "POST", body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw Object.assign(Error(data.error?.message || "\uAD50\uC2E4 \uC5F0\uACB0\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694."), { code: data.error?.code || "ENROLLMENT_UNAVAILABLE", status: response.status });
      return data;
    },
    stop() {
      clear();
      closed = true;
    }
  });
}
export {
  createWorldAccount,
  loadWorldConfig,
  publicWorldConfig
};
