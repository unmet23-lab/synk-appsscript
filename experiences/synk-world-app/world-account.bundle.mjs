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
          } catch (error2) {
            guard();
            if (error2.code) throw error2;
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

// experiences/synk-account/src/generated/world-learning-host.cjs
var require_world_learning_host = __commonJS({
  "experiences/synk-account/src/generated/world-learning-host.cjs"(exports, module) {
    "use strict";
    var OWNER = "synk.world.run-owner.v1";
    var OWNERS = "synk.world.run-owners.v1";
    var OWNER_GRACE_MS = 864e5;
    var identifier = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
    var failure = (message, code) => Object.assign(new Error(message), { code });
    function createWorldLearningHost({ accountKey, revision, storage, transport, memoryTransport = null, personalMemory = null, guard, connected = true, onStatus = () => {
    }, engine = null, clock: clock2 = Date.now }) {
      if (!accountKey || !Number.isSafeInteger(revision) || typeof guard !== "function") throw new TypeError("Verified WORLD account required");
      if (personalMemory && (!identifier(personalMemory.accountKey) || !Number.isSafeInteger(personalMemory.revision) || personalMemory.revision < 1 || typeof personalMemory.storage?.getItem !== "function" || typeof personalMemory.storage?.setItem !== "function" || typeof personalMemory.connected !== "boolean")) throw new TypeError("Verified personal WORLD memory required");
      let sync, primary, memory, memoryReady, personal, privacyBlocked = false, closed = false, run = null, generation = 0;
      const coaches = /* @__PURE__ */ new Set(), memoryListeners = /* @__PURE__ */ new Set();
      const check2 = () => {
        guard();
        if (closed || privacyBlocked) throw failure("WORLD account session ended", "MEMORY_SESSION_ENDED");
      };
      const shared = { getItem(key) {
        check2();
        return storage.getItem(key);
      }, setItem(key, value) {
        check2();
        storage.setItem(key, value);
      }, removeItem(key) {
        check2();
        storage.removeItem(key);
      } };
      const ownerKey = (eventId) => `${OWNER}.${eventId}`;
      function owners(ids, now) {
        const raw = shared.getItem(OWNERS);
        try {
          const rows2 = raw == null ? null : JSON.parse(raw);
          if (Array.isArray(rows2) && rows2.every((row) => Array.isArray(row) && row.length === 2 && identifier(row[0]) && Number.isSafeInteger(row[1]))) return rows2;
        } catch {
        }
        return ids.filter((id) => shared.getItem(ownerKey(id)) != null).map((id) => [id, now]);
      }
      function own2(ids, before, context) {
        const added = ids.filter((id) => !before.has(id));
        if (!added.length) return;
        for (const id of added) {
          const key = ownerKey(id), prior = shared.getItem(key);
          if (prior != null && prior !== context.id) throw new Error("Conflicting WORLD run ownership");
          shared.setItem(key, context.id);
        }
        const now = clock2(), kept = new Set(ids), rows2 = [];
        for (const [id, at] of owners(ids, now)) {
          if (kept.has(id) || now - at < OWNER_GRACE_MS) rows2.push([id, at]);
          else shared.removeItem(ownerKey(id));
        }
        const listed = new Set(rows2.map(([id]) => id));
        for (const id of added) if (!listed.has(id)) rows2.push([id, now]);
        shared.setItem(OWNERS, JSON.stringify(rows2));
      }
      const memoryAdapter = () => ({ memoryPort: Object.freeze({
        scope: "account",
        accountKey,
        state: () => primary.memoryPort.state(),
        merge: (value) => primary.memoryPort.merge(value),
        subscribe(listener) {
          const stop = primary.memoryPort.subscribe(listener);
          memoryListeners.add(listener);
          return () => {
            stop();
            memoryListeners.delete(listener);
          };
        }
      }) });
      const upload = transport && { get: (args) => transport.get(args), async post(args) {
        check2();
        const groups = [];
        for (const event of args.events) {
          const runId = shared.getItem(ownerKey(event.id)) ?? null;
          if (runId !== null && !identifier(runId)) throw failure("Unreadable WORLD run ownership", "STORAGE_ERROR");
          if (groups.length && groups.at(-1).runId === runId) groups.at(-1).events.push(event);
          else groups.push({ runId, events: [event] });
        }
        const accepted = [];
        for (const group of groups) {
          const result = await transport.post({ ...args, events: group.events, ...group.runId ? { runId: group.runId } : {} });
          check2();
          if (result?.ok === false || result?.revision !== revision) return result;
          const sent = new Set(group.events.map((event) => event.id));
          if (!Array.isArray(result.accepted) || result.accepted.some((id) => !sent.has(id))) throw failure("Invalid WORLD run acknowledgement", "INVALID_RESPONSE");
          accepted.push(...result.accepted);
        }
        return { ok: true, revision, accepted };
      } };
      function createGame(options, factory, createSync) {
        check2();
        const make = engine?.createGame && engine?.createLearningSync ? engine : { createGame: factory, createLearningSync: createSync };
        if (personalMemory && !personal) {
          const own3 = personalMemory, ownStorage = Object.fromEntries(["getItem", "setItem", "removeItem"].map((method) => [method, (...args) => {
            check2();
            return own3.storage[method]?.(...args);
          }]));
          personal = make.createGame({ gameId: "world-personal-memory", storage: ownStorage, learnerKey: "device", storageScope: "account", accountKey: own3.accountKey, historyComplete: !own3.connected, fold: { remote: true } });
          if (own3.connected && own3.transport && typeof engine?.createMemorySync === "function") {
            memory = engine.createMemorySync({
              adapter: personal,
              accountKey: own3.accountKey,
              revision: own3.revision,
              transport: own3.transport,
              onStatus: (state) => {
                if (state.phase === "blocked" && ["REVISION_CONFLICT", "LEARNING_DISABLED", "SESSION_REVOKED", "UNAUTHORIZED", "AUTH_REQUIRED", "AUTH_SESSION_MISSING", "MEMORY_SESSION_ENDED", "ACCOUNT_UNAVAILABLE"].includes(state.code)) {
                  privacyBlocked = true;
                  generation++;
                  sync?.stop();
                  onStatus({ phase: "blocked", code: state.code, complete: false, queued: 0 });
                }
              }
            });
            memoryReady = memory.start();
          }
        }
        const owned = { storage: shared, learnerKey: "device", storageScope: "account", accountKey, historyComplete: !connected, fold: connected ? { remote: true } : true, memoryOwner: personal?.memoryPort || null };
        if (connected && !sync) {
          primary = make.createGame({ gameId: "world-account", ...owned });
          sync = make.createLearningSync({
            adapter: primary,
            accountKey,
            revision,
            storage: shared,
            transport: upload,
            onStatus: (state) => {
              for (const coach2 of coaches) coach2.syncPort.markComplete(state.complete && state.phase !== "blocked");
              onStatus(state);
            }
          });
          void sync.start();
          if (!personalMemory && memoryTransport && typeof engine?.createMemorySync === "function" && primary.memoryPort) {
            memory = engine.createMemorySync({ adapter: memoryAdapter(), accountKey, revision, transport: memoryTransport });
            memoryReady = memory.start();
          }
        }
        const opened = generation, context = run && { ...run };
        if (context && options?.gameId !== context.gameId) throw new Error("WORLD game does not match its run");
        const coach = factory({ ...options, ...owned });
        coaches.add(coach);
        if (connected) coach.syncPort.markComplete(sync?.status().complete === true);
        const unsubscribe = coach.syncPort.subscribe((change) => {
          if (closed || !sync) return;
          if (change.kind === "storage-error") sync.invalidate(change.code);
          else if (change.kind === "append") queueMicrotask(() => {
            if (!closed) void sync.flush();
          });
        });
        const unsubscribeMemory = !personalMemory && typeof coach.memoryPort?.subscribe === "function" ? coach.memoryPort.subscribe((change) => {
          if (!closed) for (const listener of memoryListeners) listener(change);
        }) : () => {
        };
        const logIds = () => typeof coach.syncPort.ids === "function" ? coach.syncPort.ids() : coach.syncPort.events().map((event) => event.id);
        const record2 = (before) => {
          try {
            own2(logIds(), before, context);
          } catch (error2) {
            sync?.invalidate("STORAGE_ERROR");
            throw error2;
          }
        };
        const call = (method, args, closing = false) => {
          check2();
          if (opened !== generation && !closing) throw failure("WORLD game run ended", "RUN_ENDED");
          if (!context) return method(...args);
          const before = new Set(logIds());
          try {
            return method(...args);
          } finally {
            record2(before);
          }
        };
        const guarded = (value, closing) => typeof value === "function" ? (...args) => call(value, args, closing) : value;
        const live = (value) => (...args) => Object.freeze(Object.fromEntries(Object.entries(call(value, args)).map(([name, part]) => [name, guarded(part)])));
        return Object.freeze(Object.fromEntries(Object.entries(coach).filter(([name]) => name !== "syncPort" && name !== "memoryPort").map(([name, value]) => [
          name,
          name === "live" ? live(value) : guarded(value, name === "flush")
        ]).concat([
          // Each game sees the run's immutable task snapshot, without an account token.
          ["assignment", () => {
            check2();
            if (opened !== generation) throw failure("WORLD game run ended", "RUN_ENDED");
            return context?.target ? structuredClone(context.target) : null;
          }],
          ["disconnect", () => {
            unsubscribe();
            unsubscribeMemory();
            coaches.delete(coach);
          }]
        ])));
      }
      return Object.freeze({
        createGame,
        // Account preferences live beyond an individual game run. Expose only guarded choices,
        // never a storage/merge port; a late UI callback still checks the current account session.
        preferences() {
          check2();
          if (!personal && !primary) {
            if (typeof engine?.createGame !== "function") return null;
            createGame({ gameId: "world-preferences" }, engine.createGame, engine.createLearningSync);
          }
          const owner = personal || primary;
          if (!owner) return null;
          return Object.freeze({
            today: () => {
              check2();
              return owner.today();
            },
            setToday: (value) => {
              check2();
              return owner.setToday(value);
            },
            presentation: () => {
              check2();
              return owner.presentation();
            },
            setPresentation: (value) => {
              check2();
              return owner.setPresentation(value);
            },
            subscribe: (listener) => {
              check2();
              return owner.memoryPort.subscribe((change) => {
                try {
                  check2();
                  listener(change);
                } catch {
                }
              });
            }
          });
        },
        status: () => ({ accountKey, revision, ...sync?.status() || { phase: connected ? "idle" : "local", queued: 0 }, runId: run?.id || null, memory: memory ? memory.status() : null }),
        // A new game snapshots its flow settings once. Let its launcher wait for the first
        // bounded memory read so a slow response cannot silently start it at defaults.
        // Offline/unsupported memory still permits device-local practice; privacy changes do not.
        async ready() {
          check2();
          await memoryReady;
          check2();
        },
        // Back in front: retry the sync and read what other devices chose.
        retry: () => {
          check2();
          const remembered = memoryReady = memory?.retry(), learned = sync?.retry();
          return remembered && learned ? Promise.all([remembered, learned]).then(([, state]) => state) : learned || remembered;
        },
        // Going to the background or closing: send the changed memory now.
        flush: () => {
          check2();
          return memory?.flush();
        },
        // One run at a time, on a connected account. Opening or closing one ends the games of the last.
        beginRun(value) {
          check2();
          if (!connected || !identifier(value?.id) || !identifier(value?.gameId)) throw new TypeError("A connected WORLD run is required");
          generation += 1;
          run = { id: value.id, gameId: value.gameId, ...value.target ? { target: structuredClone(value.target) } : {} };
          return structuredClone(run);
        },
        closeRun() {
          check2();
          generation += 1;
          run = null;
        },
        stop() {
          closed = true;
          generation += 1;
          run = null;
          sync?.stop();
          memory?.stop();
          coaches.clear();
          memoryListeners.clear();
        }
      });
    }
    module.exports = { createWorldLearningHost };
  }
});

// strata/index.js
var require_strata = __commonJS({
  "strata/index.js"(exports, module) {
    "use strict";
    var CONFIDENCE = ["authored", "measured", "ai_draft"];
    var KINDS = ["skill", "grammar_point", "expression", "situation", "letter", "syllable", "concept", "topic", "task", "word"];
    var TYPES = ["part_of", "prerequisite", "contrasts_with"];
    var copy2 = (value) => JSON.parse(JSON.stringify(value));
    var fail2 = (message) => {
      throw new TypeError(`Strata: ${message}`);
    };
    var text2 = (value) => typeof value === "string" && value.length > 0;
    var compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    function freeze(value) {
      if (value && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
      return value;
    }
    function validateMap(data) {
      if (!data || !text2(data.map_ver) || !text2(data.subject) || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.links?.tags) || !Array.isArray(data.tag_vocabulary) || !data.sources || typeof data.sources !== "object") fail2("invalid map envelope");
      const ids = /* @__PURE__ */ new Map();
      const refs = (item) => {
        if (!Array.isArray(item.source_refs) || !item.source_refs.length) fail2("source references required");
        for (const ref of item.source_refs) {
          if (!ref || !Object.hasOwn(data.sources, ref.source) || !text2(ref.selector)) fail2("unknown source reference");
        }
      };
      const confidence = (item) => {
        if (!CONFIDENCE.includes(item.confidence) || typeof item.reviewed !== "boolean") fail2("invalid evidence status");
        refs(item);
      };
      for (const [key, source] of Object.entries(data.sources)) {
        if (!text2(key) || !text2(source.path) || !/^[a-f0-9]{64}$/.test(source.sha256)) fail2("invalid source hash");
      }
      for (const node of data.nodes) {
        if (!text2(node.id) || ids.has(node.id) || !KINDS.includes(node.kind) || !text2(node.label_ko)) fail2("invalid or duplicate node");
        if (node.level !== null && (!Number.isInteger(node.level?.intro) || node.level.intro < 1 || node.level.intro > 6 || !text2(node.level.basis))) fail2("invalid level");
        if (node.when_ko !== void 0 && (node.kind !== "situation" || !text2(node.when_ko))) fail2("invalid situation words");
        refs(node);
        ids.set(node.id, node);
      }
      const uniqueEdges = /* @__PURE__ */ new Set(), next = /* @__PURE__ */ new Map();
      for (const edge of data.edges) {
        if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || !TYPES.includes(edge.type)) fail2("invalid edge endpoint or type");
        confidence(edge);
        const key = `${edge.type}\0${edge.from}\0${edge.to}`;
        if (uniqueEdges.has(key)) fail2("duplicate edge");
        uniqueEdges.add(key);
        if (edge.type === "part_of" && (ids.get(edge.from).kind !== "grammar_point" || ids.get(edge.to).kind !== "skill")) fail2("invalid grammar membership");
        if (edge.type === "prerequisite") {
          const before = ids.get(edge.from).level?.intro, after = ids.get(edge.to).level?.intro;
          if (before != null && after != null && before > after) fail2("prerequisite level inversion");
          if (!next.has(edge.from)) next.set(edge.from, []);
          next.get(edge.from).push(edge.to);
        }
      }
      const visiting = /* @__PURE__ */ new Set(), visited = /* @__PURE__ */ new Set();
      function visit(id) {
        if (visiting.has(id)) fail2("prerequisite cycle");
        if (visited.has(id)) return;
        visiting.add(id);
        (next.get(id) || []).forEach(visit);
        visiting.delete(id);
        visited.add(id);
      }
      for (const id of ids.keys()) visit(id);
      const tags = /* @__PURE__ */ new Set();
      if (new Set(data.tag_vocabulary).size !== data.tag_vocabulary.length || data.tag_vocabulary.some((tag) => !text2(tag))) fail2("invalid tag vocabulary");
      for (const link of data.links.tags) {
        if (!data.tag_vocabulary.includes(link.tag) || tags.has(link.tag)) fail2("invalid or duplicate tag");
        if (!["full", "none"].includes(link.fit) || (link.fit === "none" ? link.node !== null : !ids.has(link.node))) fail2("tag must be exactly mapped or explicitly missing");
        if (link.fit === "full" && ids.get(link.node).kind !== "skill") fail2("tag must reference a skill");
        confidence(link);
        tags.add(link.tag);
      }
      if (tags.size !== data.tag_vocabulary.length) fail2("incomplete tag partition");
      if (data.links.goals !== void 0) {
        if (!Array.isArray(data.links.goals)) fail2("invalid goal links");
        const goals = /* @__PURE__ */ new Set();
        for (const link of data.links.goals) {
          if (!text2(link?.goal) || goals.has(link.goal)) fail2("invalid or duplicate goal");
          if (!Array.isArray(link.nodes) || !link.nodes.length || new Set(link.nodes).size !== link.nodes.length || link.nodes.some((id) => !ids.has(id))) fail2("goal must lead to known nodes");
          confidence(link);
          goals.add(link.goal);
        }
      }
      return true;
    }
    function createMap(input) {
      validateMap(input);
      const data = freeze(copy2(input));
      const nodes = new Map(data.nodes.map((node) => [node.id, node]));
      const tags = new Map(data.links.tags.map((link) => [link.tag, link]));
      const goals = new Map((data.links.goals || []).map((link) => [link.goal, link]));
      function getNode(id) {
        return nodes.get(id) || null;
      }
      function forGoal(goal) {
        const link = goals.get(goal);
        return freeze(link ? link.nodes.map(getNode) : []);
      }
      function forTag(tag) {
        const link = tags.get(tag);
        return freeze({
          status: !link ? "unknown" : link.fit === "full" ? "exact" : "missing",
          tag,
          node: link?.node ? getNode(link.node) : null,
          source_refs: link?.source_refs || []
        });
      }
      function forSkill(id) {
        const skill2 = getNode(id);
        if (skill2?.kind !== "skill") return null;
        const edges = data.edges.filter((edge) => edge.type === "part_of" && edge.to === id);
        const grammar = edges.map((edge) => getNode(edge.from));
        const refs = [...skill2.source_refs, ...grammar.flatMap((node) => node.source_refs), ...edges.flatMap((edge) => edge.source_refs)];
        const sources = [...new Map(refs.map((ref) => [`${ref.source}\0${ref.selector}`, ref])).values()];
        return freeze({ skill: skill2, grammar, level: skill2.level, sources });
      }
      function prerequisites(id) {
        if (!nodes.has(id)) return [];
        return freeze(data.edges.filter((edge) => edge.type === "prerequisite" && edge.to === id).sort((a, b) => compare(a.from, b.from)).map((edge) => ({
          node: getNode(edge.from),
          confidence: edge.confidence,
          reviewed: edge.reviewed,
          blocking: edge.confidence !== "ai_draft" || edge.reviewed,
          source_refs: edge.source_refs
        })));
      }
      function candidates(state = { lines: [] }, { limit = 10 } = {}) {
        if (!Array.isArray(state.lines) || !Number.isInteger(limit) || limit < 0 || limit > 100) fail2("invalid candidate input");
        if (state.mastered != null && (!Array.isArray(state.mastered) || state.mastered.some((id) => !text2(id)))) fail2("invalid mastered nodes");
        const mastered = new Set(state.mastered || []), selected = /* @__PURE__ */ new Map();
        for (const line of state.lines) {
          if (!line || line.usable !== true || line.status === "denied" || line.source === "estimated") continue;
          const match = /^(need|due):(node|skill|tag)\.(.+)$/.exec(line.key || "");
          if (!match) continue;
          const node = match[2] === "tag" ? forTag(match[3]).node : getNode(match[3]);
          if (!node || match[2] === "skill" && node.kind !== "skill") continue;
          if (!selected.has(node.id)) selected.set(node.id, { id: node.id, targets: [], prerequisites: prerequisites(node.id), reasons: [] });
          const result = selected.get(node.id);
          if (!result.targets.includes(line.key)) result.targets.push(line.key);
          if (!result.reasons.includes(match[1])) result.reasons.push(match[1]);
        }
        return freeze([...selected.values()].sort((a, b) => compare(a.id, b.id)).map((result) => ({
          ...result,
          targets: result.targets.sort(compare),
          reasons: result.reasons.sort(compare),
          blocked_by: result.prerequisites.filter((item) => item.blocking && !mastered.has(item.node.id)).map((item) => item.node.id),
          advisory: result.prerequisites.filter((item) => !item.blocking && !mastered.has(item.node.id)).map((item) => item.node.id)
        })).slice(0, limit));
      }
      return Object.freeze({
        map_ver: data.map_ver,
        getNode,
        forTag,
        forSkill,
        forGoal,
        prerequisites,
        candidates,
        allNodes: () => Object.freeze([...nodes.values()])
      });
    }
    module.exports = { createMap, validateMap };
  }
});

// strata/topik-i.words.json
var require_topik_i_words = __commonJS({
  "strata/topik-i.words.json"(exports, module) {
    module.exports = {
      version: "topik-i-words-1",
      note: "\uAE30\uCD08 \uC5B4\uD718 \uCE35(\uC81C\uC791\uC6A9). \uAD6D\uB9BD\uAD6D\uC5B4\uC6D0 \u300C\uD55C\uAD6D\uC5B4 \uD559\uC2B5\uC6A9 \uC5B4\uD718 \uBAA9\uB85D\u300D(2003)\uC758 A/B \uD56D\uBAA9\uC5D0\uC11C \uACE0\uB978 2,000\uAC1C. A/B\uB294 \uC6D0\uBB38\uC758 \uB4F1\uAE09\uC774\uBA70 TOPIK \uAE09\uC218 \uB300\uC751\uC774 \uC544\uB2C8\uB2E4. \uACF5\uACF5\uB204\uB9AC \uC81C1\uC720\uD615(\uCD9C\uCC98 \uD45C\uC2DC).",
      source: { title: "\uAD6D\uB9BD\uAD6D\uC5B4\uC6D0 \uD55C\uAD6D\uC5B4 \uD559\uC2B5\uC6A9 \uC5B4\uD718 \uBAA9\uB85D(2003)", url: "https://www.korean.go.kr/front/etcData/etcDataView.do?etc_seq=70&mn_id=46", license: "KOGL-1", selection: "experiences/korean-racing/scripts/build-curriculum.py" },
      fields: ["id", "word", "pos", "band", "entry"],
      words: [
        ["w0001", "\uC0AC\uACFC", "\uBA85", "A", "\uC0AC\uACFC05"],
        ["w0002", "\uBC14\uB098\uB098", "\uBA85", "A", "\uBC14\uB098\uB098"],
        ["w0003", "\uD3EC\uB3C4", "\uBA85", "A", "\uD3EC\uB3C406"],
        ["w0004", "\uB538\uAE30", "\uBA85", "A", "\uB538\uAE30"],
        ["w0005", "\uC218\uBC15", "\uBA85", "A", "\uC218\uBC1501"],
        ["w0006", "\uBC25", "\uBA85", "A", "\uBC2501"],
        ["w0007", "\uAD6D", "\uBA85", "B", "\uAD6D01"],
        ["w0008", "\uBE75", "\uBA85", "A", "\uBE7501"],
        ["w0009", "\uACE0\uAE30", "\uBA85", "A", "\uACE0\uAE3001"],
        ["w0010", "\uC0DD\uC120", "\uBA85", "A", "\uC0DD\uC120"],
        ["w0011", "\uBB3C", "\uBA85", "A", "\uBB3C01"],
        ["w0012", "\uC6B0\uC720", "\uBA85", "A", "\uC6B0\uC72002"],
        ["w0013", "\uCEE4\uD53C", "\uBA85", "A", "\uCEE4\uD53C"],
        ["w0014", "\uCC28", "\uBA85", "A", "\uCC2806"],
        ["w0015", "\uC8FC\uC2A4", "\uBA85", "A", "\uC8FC\uC2A4"],
        ["w0016", "\uAC10\uC790", "\uBA85", "B", "\uAC10\uC79001"],
        ["w0017", "\uACE0\uAD6C\uB9C8", "\uBA85", "B", "\uACE0\uAD6C\uB9C8"],
        ["w0018", "\uB2F9\uADFC", "\uBA85", "B", "\uB2F9\uADFC"],
        ["w0019", "\uC624\uC774", "\uBA85", "B", "\uC624\uC77401"],
        ["w0020", "\uC591\uD30C", "\uBA85", "B", "\uC591\uD30C"],
        ["w0021", "\uCC45", "\uBA85", "A", "\uCC4501"],
        ["w0022", "\uC5F0\uD544", "\uBA85", "A", "\uC5F0\uD544"],
        ["w0023", "\uAC00\uBC29", "\uBA85", "A", "\uAC00\uBC2901"],
        ["w0024", "\uC2DC\uACC4", "\uBA85", "A", "\uC2DC\uACC401"],
        ["w0025", "\uC6B0\uC0B0", "\uBA85", "A", "\uC6B0\uC0B001"],
        ["w0026", "\uC637", "\uBA85", "A", "\uC63701"],
        ["w0027", "\uC2E0\uBC1C", "\uBA85", "A", "\uC2E0\uBC1C"],
        ["w0028", "\uBAA8\uC790", "\uBA85", "A", "\uBAA8\uC79008"],
        ["w0029", "\uC548\uACBD", "\uBA85", "A", "\uC548\uACBD03"],
        ["w0030", "\uC591\uB9D0", "\uBA85", "A", "\uC591\uB9D001"],
        ["w0031", "\uBC84\uC2A4", "\uBA85", "A", "\uBC84\uC2A402"],
        ["w0032", "\uD0DD\uC2DC", "\uBA85", "A", "\uD0DD\uC2DC"],
        ["w0033", "\uAE30\uCC28", "\uBA85", "A", "\uAE30\uCC2801"],
        ["w0034", "\uC9C0\uD558\uCCA0", "\uBA85", "A", "\uC9C0\uD558\uCCA0"],
        ["w0035", "\uC790\uC804\uAC70", "\uBA85", "A", "\uC790\uC804\uAC70"],
        ["w0036", "\uC9D1", "\uBA85", "A", "\uC9D101"],
        ["w0037", "\uD559\uAD50", "\uBA85", "A", "\uD559\uAD50"],
        ["w0038", "\uBCD1\uC6D0", "\uBA85", "A", "\uBCD1\uC6D002"],
        ["w0039", "\uC740\uD589", "\uBA85", "A", "\uC740\uD58902"],
        ["w0040", "\uC6B0\uCCB4\uAD6D", "\uBA85", "A", "\uC6B0\uCCB4\uAD6D"],
        ["w0041", "\uAC1C", "\uC758", "A", "\uAC1C10"],
        ["w0042", "\uACE0\uC591\uC774", "\uBA85", "A", "\uACE0\uC591\uC774"],
        ["w0043", "\uC0C8", "\uAD00", "A", "\uC0C806"],
        ["w0044", "\uBB3C\uACE0\uAE30", "\uBA85", "B", "\uBB3C\uACE0\uAE30"],
        ["w0045", "\uB9D0", "\uBA85", "A", "\uB9D001"],
        ["w0046", "\uBC14\uB2E4", "\uBA85", "A", "\uBC14\uB2E4"],
        ["w0047", "\uC0B0", "\uBA85", "A", "\uC0B001"],
        ["w0048", "\uAC15", "\uBA85", "A", "\uAC1501"],
        ["w0049", "\uAF43", "\uBA85", "A", "\uAF4301"],
        ["w0050", "\uB098\uBB34", "\uBA85", "A", "\uB098\uBB3401"],
        ["w0051", "\uBE44", "\uBA85", "A", "\uBE4401"],
        ["w0052", "\uB208", "\uBA85", "A", "\uB20801"],
        ["w0053", "\uBC14\uB78C", "\uBA85", "A", "\uBC14\uB78C01"],
        ["w0054", "\uAD6C\uB984", "\uBA85", "A", "\uAD6C\uB98401"],
        ["w0055", "\uD574", "\uBA85", "A", "\uD57401"],
        ["w0056", "\uC758\uC790", "\uBA85", "A", "\uC758\uC79003"],
        ["w0057", "\uCE68\uB300", "\uBA85", "A", "\uCE68\uB30002"],
        ["w0058", "\uBB38", "\uBA85", "A", "\uBB3805"],
        ["w0059", "\uCC3D\uBB38", "\uBA85", "A", "\uCC3D\uBB38"],
        ["w0060", "\uC804\uD654", "\uBA85", "A", "\uC804\uD65407"],
        ["w0061", "\uCD95\uAD6C", "\uBA85", "A", "\uCD95\uAD6C04"],
        ["w0062", "\uB18D\uAD6C", "\uBA85", "B", "\uB18D\uAD6C07"],
        ["w0063", "\uC57C\uAD6C", "\uBA85", "A", "\uC57C\uAD6C02"],
        ["w0064", "\uC218\uC601", "\uBA85", "A", "\uC218\uC60102"],
        ["w0065", "\uD14C\uB2C8\uC2A4", "\uBA85", "A", "\uD14C\uB2C8\uC2A4"],
        ["w0066", "\uC544\uCE68", "\uBA85", "A", "\uC544\uCE68"],
        ["w0067", "\uC810\uC2EC", "\uBA85", "A", "\uC810\uC2EC"],
        ["w0068", "\uC800\uB141", "\uBA85", "A", "\uC800\uB141"],
        ["w0069", "\uC624\uB298", "\uBA85", "A", "\uC624\uB298"],
        ["w0070", "\uB0B4\uC77C", "\uBA85", "A", "\uB0B4\uC77C"],
        ["w0071", "\uC5B4\uBA38\uB2C8", "\uBA85", "A", "\uC5B4\uBA38\uB2C801"],
        ["w0072", "\uC544\uBC84\uC9C0", "\uBA85", "A", "\uC544\uBC84\uC9C0"],
        ["w0073", "\uD615", "\uBA85", "A", "\uD61501"],
        ["w0074", "\uB204\uB098", "\uBA85", "A", "\uB204\uB09801"],
        ["w0075", "\uB3D9\uC0DD", "\uBA85", "A", "\uB3D9\uC0DD01"],
        ["w0076", "\uBA38\uB9AC", "\uBA85", "A", "\uBA38\uB9AC01"],
        ["w0077", "\uCF54", "\uBA85", "A", "\uCF5401"],
        ["w0078", "\uC785", "\uBA85", "A", "\uC785"],
        ["w0079", "\uADC0", "\uBA85", "A", "\uADC001"],
        ["w0080", "\uC190", "\uBA85", "A", "\uC19001"],
        ["w0081", "\uAC00\uB2E4", "\uB3D9", "A", "\uAC00\uB2E401"],
        ["w0082", "\uC624\uB2E4", "\uB3D9", "A", "\uC624\uB2E401"],
        ["w0083", "\uBA39\uB2E4", "\uB3D9", "A", "\uBA39\uB2E402"],
        ["w0084", "\uB9C8\uC2DC\uB2E4", "\uB3D9", "A", "\uB9C8\uC2DC\uB2E4"],
        ["w0085", "\uC790\uB2E4", "\uB3D9", "A", "\uC790\uB2E401"],
        ["w0086", "\uD06C\uB2E4", "\uD615", "A", "\uD06C\uB2E401"],
        ["w0087", "\uC791\uB2E4", "\uD615", "A", "\uC791\uB2E401"],
        ["w0088", "\uAE38\uB2E4", "\uD615", "A", "\uAE38\uB2E402"],
        ["w0089", "\uC9E7\uB2E4", "\uD615", "A", "\uC9E7\uB2E4"],
        ["w0090", "\uB9CE\uB2E4", "\uD615", "A", "\uB9CE\uB2E4"],
        ["w0091", "\uD559\uC0DD", "\uBA85", "A", "\uD559\uC0DD"],
        ["w0092", "\uC120\uC0DD\uB2D8", "\uBA85", "A", "\uC120\uC0DD\uB2D8"],
        ["w0093", "\uACF5\uBD80", "\uBA85", "A", "\uACF5\uBD8001"],
        ["w0094", "\uC219\uC81C", "\uBA85", "A", "\uC219\uC81C03"],
        ["w0095", "\uC2DC\uD5D8", "\uBA85", "A", "\uC2DC\uD5D803"],
        ["w0096", "\uAC00\uAC8C", "\uBA85", "A", "\uAC00\uAC8C"],
        ["w0097", "\uC2DC\uC7A5", "\uBA85", "A", "\uC2DC\uC7A504"],
        ["w0098", "\uB3C8", "\uBA85", "A", "\uB3C801"],
        ["w0099", "\uAC00\uACA9", "\uBA85", "B", "\uAC00\uACA903"],
        ["w0100", "\uC0AC\uB2E4", "\uB3D9", "A", "\uC0AC\uB2E4"],
        ["w0101", "\uCE5C\uAD6C", "\uBA85", "A", "\uCE5C\uAD6C02"],
        ["w0102", "\uB9CC\uB098\uB2E4", "\uB3D9", "A", "\uB9CC\uB098\uB2E4"],
        ["w0103", "\uC57D\uC18D", "\uBA85", "A", "\uC57D\uC18D"],
        ["w0104", "\uC2DC\uAC04", "\uBA85", "A", "\uC2DC\uAC0404"],
        ["w0105", "\uAE30\uB2E4\uB9AC\uB2E4", "\uB3D9", "A", "\uAE30\uB2E4\uB9AC\uB2E4"],
        ["w0106", "\uC5EC\uD589", "\uBA85", "A", "\uC5EC\uD58902"],
        ["w0107", "\uACF5\uD56D", "\uBA85", "A", "\uACF5\uD56D02"],
        ["w0108", "\uD638\uD154", "\uBA85", "A", "\uD638\uD154"],
        ["w0109", "\uD45C", "\uBA85", "A", "\uD45C04"],
        ["w0110", "\uC9C0\uB3C4", "\uBA85", "A", "\uC9C0\uB3C403"],
        ["w0111", "\uC88B\uB2E4", "\uD615", "A", "\uC88B\uB2E401"],
        ["w0112", "\uC2EB\uB2E4", "\uD615", "A", "\uC2EB\uB2E401"],
        ["w0113", "\uAE30\uC058\uB2E4", "\uD615", "B", "\uAE30\uC058\uB2E4"],
        ["w0114", "\uC2AC\uD504\uB2E4", "\uD615", "A", "\uC2AC\uD504\uB2E4"],
        ["w0115", "\uD53C\uACE4\uD558\uB2E4", "\uD615", "A", "\uD53C\uACE4\uD558\uB2E4"],
        ["w0116", "\uC8FC\uB2E4", "\uBCF4", "A", "\uC8FC\uB2E401"],
        ["w0117", "\uBC1B\uB2E4", "\uB3D9", "A", "\uBC1B\uB2E401"],
        ["w0118", "\uB3C4\uC640\uC8FC\uB2E4", "\uB3D9", "A", "\uB3C4\uC640\uC8FC\uB2E4"],
        ["w0119", "\uBE4C\uB9AC\uB2E4", "\uB3D9", "B", "\uBE4C\uB9AC\uB2E4"],
        ["w0120", "\uBD80\uD0C1", "\uBA85", "B", "\uBD80\uD0C1"],
        ["w0121", "\uAC83", "\uC758", "A", "\uAC8301"],
        ["w0122", "\uD558\uB2E4", "\uB3D9", "A", "\uD558\uB2E401"],
        ["w0123", "\uC788\uB2E4", "\uBCF4", "A", "\uC788\uB2E401"],
        ["w0124", "\uB418\uB2E4", "\uB3D9", "A", "\uB418\uB2E401"],
        ["w0125", "\uC218", "\uC758", "A", "\uC21802"],
        ["w0126", "\uB098", "\uB300", "A", "\uB09803"],
        ["w0127", "\uADF8", "\uAD00", "A", "\uADF801"],
        ["w0128", "\uC5C6\uB2E4", "\uD615", "A", "\uC5C6\uB2E401"],
        ["w0129", "\uC54A\uB2E4", "\uBCF4", "A", "\uC54A\uB2E4"],
        ["w0130", "\uC0AC\uB78C", "\uBA85", "A", "\uC0AC\uB78C"],
        ["w0131", "\uC6B0\uB9AC", "\uB300", "A", "\uC6B0\uB9AC03"],
        ["w0132", "\uC774", "\uAD00", "A", "\uC77405"],
        ["w0133", "\uC544\uB2C8\uB2E4", "\uD615", "A", "\uC544\uB2C8\uB2E4"],
        ["w0134", "\uBCF4\uB2E4", "\uB3D9", "A", "\uBCF4\uB2E401"],
        ["w0135", "\uB54C", "\uBA85", "A", "\uB54C01"],
        ["w0136", "\uAC70", "\uC758", "A", "\uAC7001"],
        ["w0137", "\uAC19\uB2E4", "\uD615", "A", "\uAC19\uB2E4"],
        ["w0138", "\uB144", "\uC758", "A", "\uB14402"],
        ["w0139", "\uD55C", "\uAD00", "A", "\uD55C01"],
        ["w0140", "\uC77C", "\uBA85", "A", "\uC77C01"],
        ["w0141", "\uB54C\uBB38", "\uC758", "A", "\uB54C\uBB38"],
        ["w0142", "\uB9D0\uD558\uB2E4", "\uB3D9", "A", "\uB9D0\uD558\uB2E4"],
        ["w0143", "\uADF8\uB7EC\uB098", "\uBD80", "A", "\uADF8\uB7EC\uB098"],
        ["w0144", "\uC54C\uB2E4", "\uB3D9", "A", "\uC54C\uB2E4"],
        ["w0145", "\uC528", "\uC758", "A", "\uC52807"],
        ["w0146", "\uADF8\uB807\uB2E4", "\uD615", "A", "\uADF8\uB807\uB2E4"],
        ["w0147", "\uB610", "\uBD80", "A", "\uB610"],
        ["w0148", "\uC548", "\uBD80", "A", "\uC54802"],
        ["w0149", "\uB354", "\uBD80", "A", "\uB35401"],
        ["w0150", "\uADF8\uAC83", "\uB300", "A", "\uADF8\uAC83"],
        ["w0151", "\uB098\uC624\uB2E4", "\uB3D9", "A", "\uB098\uC624\uB2E4"],
        ["w0152", "\uADF8\uB9AC\uACE0", "\uBD80", "A", "\uADF8\uB9AC\uACE0"],
        ["w0153", "\uBB38\uC81C", "\uBA85", "A", "\uBB38\uC81C06"],
        ["w0154", "\uC0B4\uB2E4", "\uB3D9", "A", "\uC0B4\uB2E401"],
        ["w0155", "\uC800", "\uB300", "A", "\uC80003"],
        ["w0156", "\uBABB\uD558\uB2E4", "\uBCF4", "A", "\uBABB\uD558\uB2E4"],
        ["w0157", "\uC0DD\uAC01\uD558\uB2E4", "\uB3D9", "A", "\uC0DD\uAC01\uD558\uB2E4"],
        ["w0158", "\uBAA8\uB974\uB2E4", "\uB3D9", "A", "\uBAA8\uB974\uB2E4"],
        ["w0159", "\uC18D", "\uBA85", "A", "\uC18D01"],
        ["w0160", "\uB9CC\uB4E4\uB2E4", "\uB3D9", "A", "\uB9CC\uB4E4\uB2E4"],
        ["w0161", "\uB450", "\uAD00", "A", "\uB45001"],
        ["w0162", "\uC55E", "\uBA85", "A", "\uC55E"],
        ["w0163", "\uC5B4\uB5A4", "\uAD00", "A", "\uC5B4\uB5A4"],
        ["w0164", "\uC798", "\uBD80", "A", "\uC79802"],
        ["w0165", "\uC6D0", "\uC758", "A", "\uC6D001"],
        ["w0166", "\uC0DD\uAC01", "\uBA85", "A", "\uC0DD\uAC0101"],
        ["w0167", "\uC5B4\uB5BB\uB2E4", "\uD615", "A", "\uC5B4\uB5BB\uB2E4"],
        ["w0168", "\uBA85", "\uC758", "A", "\uBA8503"],
        ["w0169", "\uB2E4\uC2DC", "\uBD80", "A", "\uB2E4\uC2DC01"],
        ["w0170", "\uB2E4\uB978", "\uAD00", "A", "\uB2E4\uB978"],
        ["w0171", "\uC774\uB7F0", "\uAD00", "A", "\uC774\uB7F001"],
        ["w0172", "\uC5EC\uC790", "\uBA85", "A", "\uC5EC\uC79002"],
        ["w0173", "\uB4A4", "\uBA85", "A", "\uB4A401"],
        ["w0174", "\uB4E3\uB2E4", "\uB3D9", "A", "\uB4E3\uB2E401"],
        ["w0175", "\uB2E4", "\uBD80", "A", "\uB2E403"],
        ["w0176", "\uC880", "\uBD80", "A", "\uC88002"],
        ["w0177", "\uB4E4\uB2E4", "\uB3D9", "A", "\uB4E4\uB2E401"],
        ["w0178", "\uC2F6\uB2E4", "\uBCF4", "A", "\uC2F6\uB2E4"],
        ["w0179", "\uAC00\uC9C0\uB2E4", "\uB3D9", "A", "\uAC00\uC9C0\uB2E4"],
        ["w0180", "\uD568\uAED8", "\uBD80", "A", "\uD568\uAED8"],
        ["w0181", "\uC544\uC774", "\uBA85", "A", "\uC544\uC77401"],
        ["w0182", "\uB9CE\uC774", "\uBD80", "A", "\uB9CE\uC774"],
        ["w0183", "\uB108", "\uB300", "A", "\uB10801"],
        ["w0184", "\uB098\uB2E4", "\uB3D9", "A", "\uB098\uB2E401"],
        ["w0185", "\uC774\uB807\uB2E4", "\uD615", "A", "\uC774\uB807\uB2E4"],
        ["w0186", "\uBB50", "\uB300", "A", "\uBB50"],
        ["w0187", "\uB2E4\uC74C", "\uBA85", "A", "\uB2E4\uC74C01"],
        ["w0188", "\uB204\uAD6C", "\uB300", "A", "\uB204\uAD6C"],
        ["w0189", "\uC804", "\uBA85", "A", "\uC80408"],
        ["w0190", "\uACF3", "\uBA85", "A", "\uACF301"],
        ["w0191", "\uC5EC\uB7EC", "\uAD00", "A", "\uC5EC\uB7EC"],
        ["w0192", "\uD558\uB098", "\uC218", "A", "\uD558\uB098"],
        ["w0193", "\uBC84\uB9AC\uB2E4", "\uBCF4", "A", "\uBC84\uB9AC\uB2E401"],
        ["w0194", "\uC704", "\uBA85", "A", "\uC70401"],
        ["w0195", "\uC6B4\uB3D9", "\uBA85", "A", "\uC6B4\uB3D902"],
        ["w0196", "\uD37C\uC13C\uD2B8", "\uC758", "A", "\uD37C\uC13C\uD2B8"],
        ["w0197", "\uAC00\uC7A5", "\uBD80", "A", "\uAC00\uC7A501"],
        ["w0198", "\uC2DC\uC791\uD558\uB2E4", "\uB3D9", "A", "\uC2DC\uC791\uD558\uB2E401"],
        ["w0199", "\uBC14\uB85C", "\uBD80", "A", "\uBC14\uB85C02"],
        ["w0200", "\uC5B4\uB290", "\uAD00", "A", "\uC5B4\uB29001"],
        ["w0201", "\uADF8\uB798\uC11C", "\uBD80", "A", "\uADF8\uB798\uC11C"],
        ["w0202", "\uBB34\uC5C7", "\uB300", "A", "\uBB34\uC5C7"],
        ["w0203", "\uBAA8\uB4E0", "\uAD00", "A", "\uBAA8\uB4E0"],
        ["w0204", "\uBC88", "\uC758", "A", "\uBC8804"],
        ["w0205", "\uADF8\uAC70", "\uB300", "A", "\uADF8\uAC70"],
        ["w0206", "\uADF8\uB7F0\uB370", "\uBD80", "A", "\uADF8\uB7F0\uB370"],
        ["w0207", "\uB0A0", "\uBA85", "A", "\uB0A001"],
        ["w0208", "\uC5EC\uAE30", "\uB300", "A", "\uC5EC\uAE3001"],
        ["w0209", "\uBAA8\uB450", "\uBD80", "A", "\uBAA8\uB45001"],
        ["w0210", "\uB9C8\uC74C", "\uBA85", "A", "\uB9C8\uC74C01"],
        ["w0211", "\uD6C4", "\uBA85", "A", "\uD6C408"],
        ["w0212", "\uB193\uB2E4", "\uBCF4", "A", "\uB193\uB2E401"],
        ["w0213", "\uB0A8\uC790", "\uBA85", "A", "\uB0A8\uC79002"],
        ["w0214", "\uC5B4\uB514", "\uB300", "A", "\uC5B4\uB51401"],
        ["w0215", "\uBAB8", "\uBA85", "A", "\uBAB801"],
        ["w0216", "\uC5BC\uAD74", "\uBA85", "A", "\uC5BC\uAD7401"],
        ["w0217", "\uB4E4\uC5B4\uAC00\uB2E4", "\uB3D9", "A", "\uB4E4\uC5B4\uAC00\uB2E401"],
        ["w0218", "\uC65C", "\uBD80", "A", "\uC65C02"],
        ["w0219", "\uB9D0\uB2E4", "\uBCF4", "A", "\uB9D0\uB2E403"],
        ["w0220", "\uB2E4\uB974\uB2E4", "\uD615", "A", "\uB2E4\uB974\uB2E401"],
        ["w0221", "\uB0B4\uB2E4", "\uB3D9", "A", "\uB0B4\uB2E402"],
        ["w0222", "\uC4F0\uB2E4", "\uB3D9", "A", "\uC4F0\uB2E401"],
        ["w0223", "\uC774\uAC83", "\uB300", "A", "\uC774\uAC83"],
        ["w0224", "\uC774\uBC88", "\uBA85", "A", "\uC774\uBC8801"],
        ["w0225", "\uAE38", "\uBA85", "A", "\uAE3801"],
        ["w0226", "\uC0DD\uD65C", "\uBA85", "A", "\uC0DD\uD65C"],
        ["w0227", "\uC9C0\uAE08", "\uBA85", "A", "\uC9C0\uAE0803"],
        ["w0228", "\uC0AC\uC774", "\uBA85", "A", "\uC0AC\uC77401"],
        ["w0229", "\uC6B0\uB9AC\uB098\uB77C", "\uBA85", "A", "\uC6B0\uB9AC\uB098\uB77C"],
        ["w0230", "\uC549\uB2E4", "\uB3D9", "A", "\uC549\uB2E4"],
        ["w0231", "\uCC98\uC74C", "\uBA85", "A", "\uCC98\uC74C"],
        ["w0232", "\uBA87", "\uAD00", "A", "\uBA87"],
        ["w0233", "\uADF8\uB54C", "\uBA85", "A", "\uADF8\uB54C"],
        ["w0234", "\uCC3E\uB2E4", "\uB3D9", "A", "\uCC3E\uB2E4"],
        ["w0235", "\uC2DC", "\uC758", "A", "\uC2DC10"],
        ["w0236", "\uB098\uAC00\uB2E4", "\uB3D9", "A", "\uB098\uAC00\uB2E4"],
        ["w0237", "\uC774\uC57C\uAE30", "\uBA85", "A", "\uC774\uC57C\uAE30"],
        ["w0238", "\uC544\uC9C1", "\uBD80", "A", "\uC544\uC9C101"],
        ["w0239", "\uC7A1\uB2E4", "\uB3D9", "A", "\uC7A1\uB2E401"],
        ["w0240", "\uAC19\uC774", "\uBD80", "A", "\uAC19\uC774"],
        ["w0241", "\uC11C\uB2E4", "\uB3D9", "A", "\uC11C\uB2E401"],
        ["w0242", "\uBABB", "\uBD80", "A", "\uBABB04"],
        ["w0243", "\uC5ED\uC0AC", "\uBA85", "A", "\uC5ED\uC0AC04"],
        ["w0244", "\uC77D\uB2E4", "\uB3D9", "A", "\uC77D\uB2E4"],
        ["w0245", "\uC774\uC81C", "\uBD80", "A", "\uC774\uC81C01"],
        ["w0246", "\uBB3C\uB860", "\uBD80", "A", "\uBB3C\uB86001"],
        ["w0247", "\uB3D9\uC548", "\uBA85", "A", "\uB3D9\uC54801"],
        ["w0248", "\uC77C\uC5B4\uB098\uB2E4", "\uB3D9", "A", "\uC77C\uC5B4\uB098\uB2E4"],
        ["w0249", "\uB123\uB2E4", "\uB3D9", "A", "\uB123\uB2E4"],
        ["w0250", "\uC911\uC694\uD558\uB2E4", "\uD615", "A", "\uC911\uC694\uD558\uB2E402"],
        ["w0251", "\uBB34\uC2A8", "\uAD00", "A", "\uBB34\uC2A8"],
        ["w0252", "\uC5B4\uB835\uB2E4", "\uD615", "A", "\uC5B4\uB835\uB2E4"],
        ["w0253", "\uD798", "\uBA85", "A", "\uD79801"],
        ["w0254", "\uB108\uBB34", "\uBD80", "A", "\uB108\uBB3401"],
        ["w0255", "\uB098\uB77C", "\uBA85", "A", "\uB098\uB77C01"],
        ["w0256", "\uBD80\uB974\uB2E4", "\uB3D9", "A", "\uBD80\uB974\uB2E401"],
        ["w0257", "\uC790\uB9AC", "\uBA85", "A", "\uC790\uB9AC01"],
        ["w0258", "\uC8FD\uB2E4", "\uB3D9", "A", "\uC8FD\uB2E401"],
        ["w0259", "\uCABD", "\uC758", "A", "\uCABD05"],
        ["w0260", "\uC598\uAE30", "\uBA85", "A", "\uC598\uAE30"],
        ["w0261", "\uC5C4\uB9C8", "\uBA85", "A", "\uC5C4\uB9C8"],
        ["w0262", "\uC774\uB984", "\uBA85", "A", "\uC774\uB984"],
        ["w0263", "\uB0B4\uB9AC\uB2E4", "\uB3D9", "A", "\uB0B4\uB9AC\uB2E401"],
        ["w0264", "\uC27D\uB2E4", "\uD615", "A", "\uC27D\uB2E4"],
        ["w0265", "\uD544\uC694\uD558\uB2E4", "\uD615", "A", "\uD544\uC694\uD558\uB2E4"],
        ["w0266", "\uC0DD\uAE30\uB2E4", "\uB3D9", "A", "\uC0DD\uAE30\uB2E4"],
        ["w0267", "\uC0AC\uC6A9\uD558\uB2E4", "\uB3D9", "A", "\uC0AC\uC6A9\uD558\uB2E403"],
        ["w0268", "\uB0A8\uD3B8", "\uBA85", "A", "\uB0A8\uD3B801"],
        ["w0269", "\uB4E4\uC5B4\uC624\uB2E4", "\uB3D9", "A", "\uB4E4\uC5B4\uC624\uB2E4"],
        ["w0270", "\uBC16", "\uBA85", "A", "\uBC16"],
        ["w0271", "\uD0C0\uB2E4", "\uB3D9", "A", "\uD0C0\uB2E402"],
        ["w0272", "\uB300\uD559", "\uBA85", "A", "\uB300\uD55901"],
        ["w0273", "\uAC00\uC6B4\uB370", "\uBA85", "A", "\uAC00\uC6B4\uB370"],
        ["w0274", "\uBCF4\uB0B4\uB2E4", "\uB3D9", "A", "\uBCF4\uB0B4\uB2E4"],
        ["w0275", "\uC544\uC8FC", "\uBD80", "A", "\uC544\uC8FC01"],
        ["w0276", "\uBC24", "\uBA85", "A", "\uBC2401"],
        ["w0277", "\uB192\uB2E4", "\uD615", "A", "\uB192\uB2E4"],
        ["w0278", "\uCEF4\uD4E8\uD130", "\uBA85", "A", "\uCEF4\uD4E8\uD130"],
        ["w0279", "\uBA3C\uC800", "\uBD80", "A", "\uBA3C\uC800"],
        ["w0280", "\uB2E4\uB2C8\uB2E4", "\uB3D9", "A", "\uB2E4\uB2C8\uB2E4"],
        ["w0281", "\uC5BC\uB9C8\uB098", "\uBD80", "A", "\uC5BC\uB9C8\uB098"],
        ["w0282", "\uC5F4\uB2E4", "\uB3D9", "A", "\uC5F4\uB2E402"],
        ["w0283", "\uBB3B\uB2E4", "\uB3D9", "A", "\uBB3B\uB2E403"],
        ["w0284", "\uAC70\uAE30", "\uB300", "A", "\uAC70\uAE3001"],
        ["w0285", "\uC544\uB4E4", "\uBA85", "A", "\uC544\uB4E4"],
        ["w0286", "\uC544", "\uAC10", "A", "\uC54402"],
        ["w0287", "\uBD84", "\uC758", "A", "\uBD8408"],
        ["w0288", "\uACE7", "\uBD80", "A", "\uACE701"],
        ["w0289", "\uC11C\uB85C", "\uBD80", "A", "\uC11C\uB85C01"],
        ["w0290", "\uC774\uAC70", "\uB300", "A", "\uC774\uAC7001"],
        ["w0291", "\uBC29", "\uBA85", "A", "\uBC2907"],
        ["w0292", "\uC6C3\uB2E4", "\uB3D9", "A", "\uC6C3\uB2E4"],
        ["w0293", "\uB5A0\uB098\uB2E4", "\uB3D9", "A", "\uB5A0\uB098\uB2E4"],
        ["w0294", "\uADF8\uB798", "\uAC10", "A", "\uADF8\uB79801"],
        ["w0295", "\uC544\uB984\uB2F5\uB2E4", "\uD615", "A", "\uC544\uB984\uB2F5\uB2E4"],
        ["w0296", "\uB05D", "\uBA85", "A", "\uB05D01"],
        ["w0297", "\uC601\uD654", "\uBA85", "A", "\uC601\uD65401"],
        ["w0298", "\uD544\uC694", "\uBA85", "A", "\uD544\uC694"],
        ["w0299", "\uD558\uB298", "\uBA85", "A", "\uD558\uB29801"],
        ["w0300", "\uC815\uB9D0", "\uBD80", "A", "\uC815\uB9D001"],
        ["w0301", "\uC785\uB2E4", "\uB3D9", "A", "\uC785\uB2E401"],
        ["w0302", "\uB124", "\uAC10", "A", "\uB12403"],
        ["w0303", "\uADF8\uB9BC", "\uBA85", "A", "\uADF8\uB9BC01"],
        ["w0304", "\uCE58\uB2E4", "\uB3D9", "A", "\uCE58\uB2E402"],
        ["w0305", "\uD63C\uC790", "\uBA85", "A", "\uD63C\uC79001"],
        ["w0306", "\uAD50\uC218", "\uBA85", "A", "\uAD50\uC21806"],
        ["w0307", "\uC220", "\uBA85", "A", "\uC22001"],
        ["w0308", "\uC0AC\uB791", "\uBA85", "A", "\uC0AC\uB79101"],
        ["w0309", "\uB05D\uB098\uB2E4", "\uB3D9", "A", "\uB05D\uB098\uB2E4"],
        ["w0310", "\uB3CC\uC544\uC624\uB2E4", "\uB3D9", "A", "\uB3CC\uC544\uC624\uB2E4"],
        ["w0311", "\uC544\uBE60", "\uBA85", "A", "\uC544\uBE60"],
        ["w0312", "\uD55C\uBC88", "\uBA85", "A", "\uD55C\uBC88"],
        ["w0313", "\uAC00\uC2B4", "\uBA85", "A", "\uAC00\uC2B401"],
        ["w0314", "\uD68C\uC0AC", "\uBA85", "A", "\uD68C\uC0AC04"],
        ["w0315", "\uB9DB", "\uBA85", "A", "\uB9DB01"],
        ["w0316", "\uB9E4\uC6B0", "\uBD80", "A", "\uB9E4\uC6B001"],
        ["w0317", "\uC624\uB974\uB2E4", "\uB3D9", "A", "\uC624\uB974\uB2E4"],
        ["w0318", "\uC74C\uC2DD", "\uBA85", "A", "\uC74C\uC2DD"],
        ["w0319", "\uAF2D", "\uBD80", "A", "\uAF2D03"],
        ["w0320", "\uC694\uC998", "\uBA85", "A", "\uC694\uC998"],
        ["w0321", "\uACC4\uD68D", "\uBA85", "A", "\uACC4\uD68D01"],
        ["w0322", "\uC5BC\uB9C8", "\uBA85", "A", "\uC5BC\uB9C8"],
        ["w0323", "\uACC4\uC18D", "\uBD80", "A", "\uACC4\uC18D04"],
        ["w0324", "\uC544\uB0B4", "\uBA85", "A", "\uC544\uB0B401"],
        ["w0325", "\uAC00\uC871", "\uBA85", "A", "\uAC00\uC87101"],
        ["w0326", "\uC138", "\uAD00", "A", "\uC13801"],
        ["w0327", "\uB180\uB2E4", "\uB3D9", "A", "\uB180\uB2E401"],
        ["w0328", "\uB3C4\uC2DC", "\uBA85", "A", "\uB3C4\uC2DC03"],
        ["w0329", "\uB098\uC774", "\uBA85", "A", "\uB098\uC77401"],
        ["w0330", "\uBC14\uAFB8\uB2E4", "\uB3D9", "A", "\uBC14\uAFB8\uB2E4"],
        ["w0331", "\uC88B\uC544\uD558\uB2E4", "\uB3D9", "A", "\uC88B\uC544\uD558\uB2E4"],
        ["w0332", "\uADF8\uB9AC\uB2E4", "\uB3D9", "A", "\uADF8\uB9AC\uB2E402"],
        ["w0333", "\uBC30\uC6B0\uB2E4", "\uB3D9", "A", "\uBC30\uC6B0\uB2E401"],
        ["w0334", "\uC606", "\uBA85", "A", "\uC606"],
        ["w0335", "\uC5B4", "\uAC10", "A", "\uC5B402"],
        ["w0336", "\uC544\uB798", "\uBA85", "A", "\uC544\uB79801"],
        ["w0337", "\uADF8\uB7FC", "\uBD80", "A", "\uADF8\uB7FC01"],
        ["w0338", "\uBC30", "\uBA85", "A", "\uBC3002"],
        ["w0339", "\uD558\uC9C0\uB9CC", "\uBD80", "A", "\uD558\uC9C0\uB9CC"],
        ["w0340", "\uADF8\uB3D9\uC548", "\uBA85", "A", "\uADF8\uB3D9\uC548"],
        ["w0341", "\uAC11\uC790\uAE30", "\uBD80", "A", "\uAC11\uC790\uAE30"],
        ["w0342", "\uC798\uD558\uB2E4", "\uB3D9", "A", "\uC798\uD558\uB2E4"],
        ["w0343", "\uB178\uB798", "\uBA85", "A", "\uB178\uB79801"],
        ["w0344", "\uD798\uB4E4\uB2E4", "\uD615", "A", "\uD798\uB4E4\uB2E4"],
        ["w0345", "\uC5B8\uB2C8", "\uBA85", "A", "\uC5B8\uB2C8"],
        ["w0346", "\uBD88", "\uBA85", "A", "\uBD8801"],
        ["w0347", "\uD559\uB144", "\uBA85", "A", "\uD559\uB144"],
        ["w0348", "\uC2E0\uBB38", "\uBA85", "A", "\uC2E0\uBB3810"],
        ["w0349", "\uC774\uD574\uD558\uB2E4", "\uB3D9", "A", "\uC774\uD574\uD558\uB2E402"],
        ["w0350", "\uC120\uC0DD", "\uBA85", "A", "\uC120\uC0DD01"],
        ["w0351", "\uB3CC\uC544\uAC00\uB2E4", "\uB3D9", "A", "\uB3CC\uC544\uAC00\uB2E4"],
        ["w0352", "\uAE30\uBD84", "\uBA85", "A", "\uAE30\uBD8401"],
        ["w0353", "\uAFC8", "\uBA85", "A", "\uAFC801"],
        ["w0354", "\uD560\uBA38\uB2C8", "\uBA85", "A", "\uD560\uBA38\uB2C8"],
        ["w0355", "\uD68C\uC758", "\uBA85", "A", "\uD68C\uC75804"],
        ["w0356", "\uC774\uC57C\uAE30\uD558\uB2E4", "\uB3D9", "A", "\uC774\uC57C\uAE30\uD558\uB2E4"],
        ["w0357", "\uAC77\uB2E4", "\uB3D9", "A", "\uAC77\uB2E402"],
        ["w0358", "\uC774\uB54C", "\uBA85", "A", "\uC774\uB54C"],
        ["w0359", "\uBB3C\uAC74", "\uBA85", "A", "\uBB3C\uAC74"],
        ["w0360", "\uBC1C", "\uBA85", "A", "\uBC1C01"],
        ["w0361", "\uBE68\uB9AC", "\uBD80", "A", "\uBE68\uB9AC"],
        ["w0362", "\uC2DC\uC791\uB418\uB2E4", "\uB3D9", "A", "\uC2DC\uC791\uB418\uB2E401"],
        ["w0363", "\uB458", "\uC218", "A", "\uB45801"],
        ["w0364", "\uC124\uBA85\uD558\uB2E4", "\uB3D9", "A", "\uC124\uBA85\uD558\uB2E4"],
        ["w0365", "\uC0B4", "\uC758", "A", "\uC0B404"],
        ["w0366", "\uC74C\uC545", "\uBA85", "A", "\uC74C\uC54501"],
        ["w0367", "\uC544\uD504\uB2E4", "\uD615", "A", "\uC544\uD504\uB2E4"],
        ["w0368", "\uC801\uB2E4", "\uD615", "A", "\uC801\uB2E402"],
        ["w0369", "\uACE0\uD5A5", "\uBA85", "A", "\uACE0\uD5A502"],
        ["w0370", "\uB180\uB77C\uB2E4", "\uB3D9", "A", "\uB180\uB77C\uB2E4"],
        ["w0371", "\uC6B8\uB2E4", "\uB3D9", "A", "\uC6B8\uB2E401"],
        ["w0372", "\uC9C0\uB0B4\uB2E4", "\uB3D9", "A", "\uC9C0\uB0B4\uB2E401"],
        ["w0373", "\uACB0\uD63C", "\uBA85", "A", "\uACB0\uD63C"],
        ["w0374", "\uC608", "\uAC10", "A", "\uC60806"],
        ["w0375", "\uC624\uD6C4", "\uBA85", "A", "\uC624\uD6C402"],
        ["w0376", "\uBE60\uB974\uB2E4", "\uD615", "A", "\uBE60\uB974\uB2E4"],
        ["w0377", "\uC544\uAE30", "\uBA85", "A", "\uC544\uAE3001"],
        ["w0378", "\uC544\uC800\uC528", "\uBA85", "A", "\uC544\uC800\uC528"],
        ["w0379", "\uC61B\uB0A0", "\uBA85", "A", "\uC61B\uB0A0"],
        ["w0380", "\uB2EC", "\uC758", "A", "\uB2EC05"],
        ["w0381", "\uCC38", "\uBD80", "A", "\uCC3801"],
        ["w0382", "\uC774\uACF3", "\uB300", "A", "\uC774\uACF3"],
        ["w0383", "\uB538", "\uBA85", "A", "\uB53801"],
        ["w0384", "\uB9C8\uC9C0\uB9C9", "\uBA85", "A", "\uB9C8\uC9C0\uB9C9"],
        ["w0385", "\uACBD\uCC30", "\uBA85", "A", "\uACBD\uCC3004"],
        ["w0386", "\uADF8\uB7EC\uBA74", "\uBD80", "A", "\uADF8\uB7EC\uBA74"],
        ["w0387", "\uB113\uB2E4", "\uD615", "A", "\uB113\uB2E4"],
        ["w0388", "\uC7A0", "\uBA85", "A", "\uC7A001"],
        ["w0389", "\uAC74\uAC15", "\uBA85", "A", "\uAC74\uAC1503"],
        ["w0390", "\uAC00\uAE5D\uB2E4", "\uD615", "A", "\uAC00\uAE5D\uB2E4"],
        ["w0391", "\uAC74\uBB3C", "\uBA85", "A", "\uAC74\uBB3C03"],
        ["w0392", "\uC678\uAD6D", "\uBA85", "A", "\uC678\uAD6D02"],
        ["w0393", "\uBC11", "\uBA85", "A", "\uBC1101"],
        ["w0394", "\uC5B4\uB978", "\uBA85", "A", "\uC5B4\uB97801"],
        ["w0395", "\uD314\uB2E4", "\uB3D9", "A", "\uD314\uB2E4"],
        ["w0396", "\uC5F4\uC2EC\uD788", "\uBD80", "A", "\uC5F4\uC2EC\uD788"],
        ["w0397", "\uC77C\uD558\uB2E4", "\uB3D9", "A", "\uC77C\uD558\uB2E4"],
        ["w0398", "\uC870\uAE08", "\uBA85", "A", "\uC870\uAE0801"],
        ["w0399", "\uD300", "\uBA85", "A", "\uD30001"],
        ["w0400", "\uBD80\uBAA8", "\uBA85", "A", "\uBD80\uBAA801"],
        ["w0401", "\uC62C\uB77C\uAC00\uB2E4", "\uB3D9", "A", "\uC62C\uB77C\uAC00\uB2E4"],
        ["w0402", "\uADF8\uB0A0", "\uBA85", "A", "\uADF8\uB0A0"],
        ["w0403", "\uC790\uC8FC", "\uBD80", "A", "\uC790\uC8FC01"],
        ["w0404", "\uB2F4\uBC30", "\uBA85", "A", "\uB2F4\uBC30"],
        ["w0405", "\uD560\uC544\uBC84\uC9C0", "\uBA85", "A", "\uD560\uC544\uBC84\uC9C0"],
        ["w0406", "\uD0DC\uC5B4\uB098\uB2E4", "\uB3D9", "A", "\uD0DC\uC5B4\uB098\uB2E4"],
        ["w0407", "\uBC8C\uC368", "\uBD80", "A", "\uBC8C\uC368"],
        ["w0408", "\uD658\uC790", "\uBA85", "A", "\uD658\uC79003"],
        ["w0409", "\uC7AC\uBBF8\uC788\uB2E4", "\uD615", "A", "\uC7AC\uBBF8\uC788\uB2E4"],
        ["w0410", "\uAC00\uB974\uCE58\uB2E4", "\uB3D9", "A", "\uAC00\uB974\uCE58\uB2E401"],
        ["w0411", "\uB300\uD654", "\uBA85", "A", "\uB300\uD65406"],
        ["w0412", "\uC62C\uD574", "\uBA85", "A", "\uC62C\uD574"],
        ["w0413", "\uAC78\uB2E4", "\uB3D9", "A", "\uAC78\uB2E402"],
        ["w0414", "\uBA40\uB2E4", "\uD615", "A", "\uBA40\uB2E402"],
        ["w0415", "\uC7A0\uC2DC", "\uBD80", "A", "\uC7A0\uC2DC"],
        ["w0416", "\uC0AC\uC9C4", "\uBA85", "A", "\uC0AC\uC9C407"],
        ["w0417", "\uC81C\uC77C", "\uBA85", "A", "\uC81C\uC77C04"],
        ["w0418", "\uC544\uB9C8", "\uBD80", "A", "\uC544\uB9C801"],
        ["w0419", "\uC598\uAE30\uD558\uB2E4", "\uB3D9", "A", "\uC598\uAE30\uD558\uB2E4"],
        ["w0420", "\uB2E4\uB9AC", "\uBA85", "A", "\uB2E4\uB9AC01"],
        ["w0421", "\uC544\uBB34", "\uAD00", "A", "\uC544\uBB3401"],
        ["w0422", "\uD56D\uC0C1", "\uBD80", "A", "\uD56D\uC0C1"],
        ["w0423", "\uC783\uB2E4", "\uB3D9", "A", "\uC783\uB2E4"],
        ["w0424", "\uBE44\uC2B7\uD558\uB2E4", "\uD615", "A", "\uBE44\uC2B7\uD558\uB2E402"],
        ["w0425", "\uB2EC\uB7EC", "\uC758", "A", "\uB2EC\uB7EC"],
        ["w0426", "\uC0AC\uB791\uD558\uB2E4", "\uB3D9", "A", "\uC0AC\uB791\uD558\uB2E4"],
        ["w0427", "\uC5EC\uB984", "\uBA85", "A", "\uC5EC\uB98401"],
        ["w0428", "\uADF8\uB7EC\uB2C8\uAE4C", "\uBD80", "A", "\uADF8\uB7EC\uB2C8\uAE4C"],
        ["w0429", "\uAC12", "\uBA85", "A", "\uAC12"],
        ["w0430", "\uC5B8\uC81C\uB098", "\uBD80", "A", "\uC5B8\uC81C\uB098"],
        ["w0431", "\uC790\uB3D9\uCC28", "\uBA85", "A", "\uC790\uB3D9\uCC28"],
        ["w0432", "\uAC1C\uC6D4", "\uC758", "A", "\uAC1C\uC6D4"],
        ["w0433", "\uC5B4\uB9B0\uC774", "\uBA85", "A", "\uC5B4\uB9B0\uC77401"],
        ["w0434", "\uACF5\uBD80\uD558\uB2E4", "\uB3D9", "A", "\uACF5\uBD80\uD558\uB2E4"],
        ["w0435", "\uB2E6\uB2E4", "\uB3D9", "A", "\uB2E6\uB2E401"],
        ["w0436", "\uB9D0\uC500", "\uBA85", "A", "\uB9D0\uC500"],
        ["w0437", "\uAD1C\uCC2E\uB2E4", "\uD615", "A", "\uAD1C\uCC2E\uB2E4"],
        ["w0438", "\uB208\uBB3C", "\uBA85", "A", "\uB208\uBB3C01"],
        ["w0439", "\uC544\uB2C8", "\uBD80", "A", "\uC544\uB2C801"],
        ["w0440", "\uC8FC\uC778", "\uBA85", "A", "\uC8FC\uC77801"],
        ["w0441", "\uB4DC\uB9AC\uB2E4", "\uBCF4", "A", "\uB4DC\uB9AC\uB2E401"],
        ["w0442", "\uBC18", "\uBA85", "A", "\uBC1807"],
        ["w0443", "\uBBF8\uD130", "\uC758", "A", "\uBBF8\uD13002"],
        ["w0444", "\uC5B4\uB5A0\uD558\uB2E4", "\uD615", "A", "\uC5B4\uB5A0\uD558\uB2E4"],
        ["w0445", "\uC544\uD30C\uD2B8", "\uBA85", "A", "\uC544\uD30C\uD2B8"],
        ["w0446", "\uAC00\uB054", "\uBD80", "A", "\uAC00\uB054"],
        ["w0447", "\uACE0\uB9D9\uB2E4", "\uD615", "A", "\uACE0\uB9D9\uB2E401"],
        ["w0448", "\uADF8\uACF3", "\uB300", "A", "\uADF8\uACF3"],
        ["w0449", "\uBC14\uC058\uB2E4", "\uD615", "A", "\uBC14\uC058\uB2E4"],
        ["w0450", "\uB098\uC058\uB2E4", "\uD615", "A", "\uB098\uC058\uB2E401"],
        ["w0451", "\uAC8C\uC784", "\uBA85", "A", "\uAC8C\uC784"],
        ["w0452", "\uC794", "\uBA85", "A", "\uC79403"],
        ["w0453", "\uC5B8\uC81C", "\uBD80", "A", "\uC5B8\uC81C01"],
        ["w0454", "\uB0B4\uB824\uC624\uB2E4", "\uB3D9", "A", "\uB0B4\uB824\uC624\uB2E4"],
        ["w0455", "\uC190\uB2D8", "\uBA85", "A", "\uC190\uB2D8"],
        ["w0456", "\uB274\uC2A4", "\uBA85", "A", "\uB274\uC2A4"],
        ["w0457", "\uC218\uC5C5", "\uBA85", "A", "\uC218\uC5C504"],
        ["w0458", "\uACA8\uC6B8", "\uBA85", "A", "\uACA8\uC6B8"],
        ["w0459", "\uCE35", "\uBA85", "A", "\uCE3502"],
        ["w0460", "\uC7A5", "\uC758", "A", "\uC7A522"],
        ["w0461", "\uC2DD\uC0AC", "\uBA85", "A", "\uC2DD\uC0AC03"],
        ["w0462", "\uC548\uB2E4", "\uB3D9", "A", "\uC548\uB2E401"],
        ["w0463", "\uC78A\uB2E4", "\uB3D9", "A", "\uC78A\uB2E401"],
        ["w0464", "\uD154\uB808\uBE44\uC804", "\uBA85", "A", "\uD154\uB808\uBE44\uC804"],
        ["w0465", "\uC53B\uB2E4", "\uB3D9", "A", "\uC53B\uB2E4"],
        ["w0466", "\uB2A6\uB2E4", "\uD615", "A", "\uB2A6\uB2E4"],
        ["w0467", "\uD3B8\uC9C0", "\uBA85", "A", "\uD3B8\uC9C002"],
        ["w0468", "\uC13C\uD2F0\uBBF8\uD130", "\uC758", "A", "\uC13C\uD2F0\uBBF8\uD130"],
        ["w0469", "\uD314", "\uBA85", "A", "\uD31401"],
        ["w0470", "\uC124\uBA85", "\uBA85", "A", "\uC124\uBA85"],
        ["w0471", "\uD2F0\uBE0C\uC774", "\uBA85", "A", "\uD2F0\uBE0C\uC774"],
        ["w0472", "\uBD04", "\uBA85", "A", "\uBD0401"],
        ["w0473", "\uB0AE\uB2E4", "\uD615", "A", "\uB0AE\uB2E4"],
        ["w0474", "\uC5B4\uAE68", "\uBA85", "A", "\uC5B4\uAE6801"],
        ["w0475", "\uBD80\uBD80", "\uBA85", "A", "\uBD80\uBD8003"],
        ["w0476", "\uC624\uB798", "\uBD80", "A", "\uC624\uB79802"],
        ["w0477", "\uACF5", "\uBA85", "A", "\uACF501"],
        ["w0478", "\uC624\uC6D4", "\uBA85", "A", "\uC624\uC6D401"],
        ["w0479", "\uC26C\uB2E4", "\uB3D9", "A", "\uC26C\uB2E403"],
        ["w0480", "\uACFC", "\uBA85", "A", "\uACFC10"],
        ["w0481", "\uC624\uBE60", "\uBA85", "A", "\uC624\uBE60"],
        ["w0482", "\uC990\uAC81\uB2E4", "\uD615", "A", "\uC990\uAC81\uB2E4"],
        ["w0483", "\uC0AC\uC6D4", "\uBA85", "A", "\uC0AC\uC6D402"],
        ["w0484", "\uC2F8\uC6B0\uB2E4", "\uB3D9", "A", "\uC2F8\uC6B0\uB2E4"],
        ["w0485", "\uC608\uC058\uB2E4", "\uD615", "A", "\uC608\uC058\uB2E4"],
        ["w0486", "\uB098\uC911", "\uBA85", "A", "\uB098\uC91101"],
        ["w0487", "\uB9DB\uC788\uB2E4", "\uD615", "A", "\uB9DB\uC788\uB2E4"],
        ["w0488", "\uBA70\uCE60", "\uBA85", "A", "\uBA70\uCE60"],
        ["w0489", "\uC791\uB144", "\uBA85", "A", "\uC791\uB144"],
        ["w0490", "\uB0B4\uB824\uAC00\uB2E4", "\uB3D9", "A", "\uB0B4\uB824\uAC00\uB2E4"],
        ["w0491", "\uC4F0\uB808\uAE30", "\uBA85", "A", "\uC4F0\uB808\uAE30"],
        ["w0492", "\uAC00\uC838\uC624\uB2E4", "\uB3D9", "A", "\uAC00\uC838\uC624\uB2E4"],
        ["w0493", "\uB0A8\uB140", "\uBA85", "A", "\uB0A8\uB140"],
        ["w0494", "\uC900\uBE44", "\uBA85", "A", "\uC900\uBE44"],
        ["w0495", "\uAD6C\uC6D4", "\uBA85", "A", "\uAD6C\uC6D402"],
        ["w0496", "\uB9D1\uB2E4", "\uD615", "A", "\uB9D1\uB2E401"],
        ["w0497", "\uC720\uC6D4", "\uBA85", "A", "\uC720\uC6D401"],
        ["w0498", "\uD5C8\uB9AC", "\uBA85", "A", "\uD5C8\uB9AC01"],
        ["w0499", "\uC601\uC5B4", "\uBA85", "A", "\uC601\uC5B402"],
        ["w0500", "\uB300\uB2F5\uD558\uB2E4", "\uB3D9", "A", "\uB300\uB2F5\uD558\uB2E4"],
        ["w0501", "\uBC97\uB2E4", "\uB3D9", "A", "\uBC97\uB2E4"],
        ["w0502", "\uC900\uBE44\uD558\uB2E4", "\uB3D9", "A", "\uC900\uBE44\uD558\uB2E4"],
        ["w0503", "\uB3D5\uB2E4", "\uB3D9", "A", "\uB3D5\uB2E4"],
        ["w0504", "\uC0AC\uC7A5", "\uBA85", "A", "\uC0AC\uC7A515"],
        ["w0505", "\uC0BC\uC6D4", "\uBA85", "A", "\uC0BC\uC6D4"],
        ["w0506", "\uADF8\uB807\uC9C0\uB9CC", "\uBD80", "A", "\uADF8\uB807\uC9C0\uB9CC"],
        ["w0507", "\uD0A4", "\uBA85", "A", "\uD0A401"],
        ["w0508", "\uAC71\uC815", "\uBA85", "A", "\uAC71\uC815"],
        ["w0509", "\uACB0\uD63C\uD558\uB2E4", "\uB3D9", "A", "\uACB0\uD63C\uD558\uB2E4"],
        ["w0510", "\uC9C8\uBB38", "\uBA85", "A", "\uC9C8\uBB38"],
        ["w0511", "\uADFC\uCC98", "\uBA85", "A", "\uADFC\uCC98"],
        ["w0512", "\uBD80\uBAA8\uB2D8", "\uBA85", "A", "\uBD80\uBAA8\uB2D8"],
        ["w0513", "\uACC4\uC2DC\uB2E4", "\uB3D9", "A", "\uACC4\uC2DC\uB2E4"],
        ["w0514", "\uB9C8\uB9AC", "\uC758", "A", "\uB9C8\uB9AC01"],
        ["w0515", "\uBE44\uD589\uAE30", "\uBA85", "A", "\uBE44\uD589\uAE30"],
        ["w0516", "\uB728\uAC81\uB2E4", "\uD615", "A", "\uB728\uAC81\uB2E4"],
        ["w0517", "\uB0AE", "\uBA85", "A", "\uB0AE"],
        ["w0518", "\uC77C\uCC0D", "\uBD80", "A", "\uC77C\uCC0D"],
        ["w0519", "\uCC0D\uB2E4", "\uB3D9", "A", "\uCC0D\uB2E402"],
        ["w0520", "\uAC00\uBCCD\uB2E4", "\uD615", "A", "\uAC00\uBCCD\uB2E4"],
        ["w0521", "\uC624\uC804", "\uBA85", "A", "\uC624\uC80402"],
        ["w0522", "\uC778\uC0AC", "\uBA85", "A", "\uC778\uC0AC02"],
        ["w0523", "\uC18C\uAE08", "\uBA85", "A", "\uC18C\uAE0801"],
        ["w0524", "\uBAA9", "\uBA85", "A", "\uBAA901"],
        ["w0525", "\uD53C\uC6B0\uB2E4", "\uB3D9", "A", "\uD53C\uC6B0\uB2E401"],
        ["w0526", "\uAD50\uD1B5", "\uBA85", "A", "\uAD50\uD1B501"],
        ["w0527", "\uAC70\uB9AC", "\uBA85", "A", "\uAC70\uB9AC01"],
        ["w0528", "\uBD88\uB2E4", "\uB3D9", "A", "\uBD88\uB2E401"],
        ["w0529", "\uD55C\uAE00", "\uBA85", "A", "\uD55C\uAE0001"],
        ["w0530", "\uAC00\uC744", "\uBA85", "A", "\uAC00\uC74401"],
        ["w0531", "\uB9E4\uC77C", "\uBD80", "A", "\uB9E4\uC77C"],
        ["w0532", "\uC190\uAC00\uB77D", "\uBA85", "A", "\uC190\uAC00\uB77D"],
        ["w0533", "\uAE09", "\uBA85", "A", "\uAE0904"],
        ["w0534", "\uB0A0\uC528", "\uBA85", "A", "\uB0A0\uC52801"],
        ["w0535", "\uB3D9\uBB3C", "\uBA85", "A", "\uB3D9\uBB3C"],
        ["w0536", "\uC758\uC0AC", "\uBA85", "A", "\uC758\uC0AC12"],
        ["w0537", "\uAC74\uAC15\uD558\uB2E4", "\uD615", "A", "\uAC74\uAC15\uD558\uB2E402"],
        ["w0538", "\uC5EC\uB7EC\uBD84", "\uB300", "A", "\uC5EC\uB7EC\uBD84"],
        ["w0539", "\uC65C\uB0D0\uD558\uBA74", "\uBD80", "A", "\uC65C\uB0D0\uD558\uBA74"],
        ["w0540", "\uB3C4\uCC29\uD558\uB2E4", "\uB3D9", "A", "\uB3C4\uCC29\uD558\uB2E401"],
        ["w0541", "\uBCD1", "\uBA85", "A", "\uBCD104"],
        ["w0542", "\uB530\uB73B\uD558\uB2E4", "\uD615", "A", "\uB530\uB73B\uD558\uB2E4"],
        ["w0543", "\uBC1D\uB2E4", "\uD615", "A", "\uBC1D\uB2E4"],
        ["w0544", "\uC7A5\uC18C", "\uBA85", "A", "\uC7A5\uC18C05"],
        ["w0545", "\uACE0\uB4F1\uD559\uAD50", "\uBA85", "A", "\uACE0\uB4F1\uD559\uAD50"],
        ["w0546", "\uAD50\uC2E4", "\uBA85", "A", "\uAD50\uC2E4"],
        ["w0547", "\uBCC4", "\uBA85", "A", "\uBCC401"],
        ["w0548", "\uBCF5\uC7A1\uD558\uB2E4", "\uD615", "A", "\uBCF5\uC7A1\uD558\uB2E4"],
        ["w0549", "\uC0C9", "\uBA85", "A", "\uC0C903"],
        ["w0550", "\uB611\uAC19\uB2E4", "\uD615", "A", "\uB611\uAC19\uB2E4"],
        ["w0551", "\uB9D0\uC500\uD558\uB2E4", "\uB3D9", "A", "\uB9D0\uC500\uD558\uB2E4"],
        ["w0552", "\uBCF4\uD1B5", "\uBA85", "A", "\uBCF4\uD1B5"],
        ["w0553", "\uC2DD\uB2F9", "\uBA85", "A", "\uC2DD\uB2F9"],
        ["w0554", "\uC18C\uAC1C\uD558\uB2E4", "\uB3D9", "A", "\uC18C\uAC1C\uD558\uB2E401"],
        ["w0555", "\uCE60\uC6D4", "\uBA85", "A", "\uCE60\uC6D4"],
        ["w0556", "\uC2ED\uC774\uC6D4", "\uBA85", "A", "\uC2ED\uC774\uC6D4"],
        ["w0557", "\uCEF5", "\uBA85", "A", "\uCEF5"],
        ["w0558", "\uC885\uC774", "\uBA85", "A", "\uC885\uC77401"],
        ["w0559", "\uC7AC\uBBF8", "\uBA85", "A", "\uC7AC\uBBF801"],
        ["w0560", "\uB5A1", "\uBA85", "A", "\uB5A101"],
        ["w0561", "\uB05D\uB0B4\uB2E4", "\uB3D9", "A", "\uB05D\uB0B4\uB2E4"],
        ["w0562", "\uB300\uB2F5", "\uBA85", "A", "\uB300\uB2F5"],
        ["w0563", "\uC2DC\uC791", "\uBA85", "A", "\uC2DC\uC79101"],
        ["w0564", "\uC77C\uC8FC\uC77C", "\uBA85", "A", "\uC77C\uC8FC\uC77C"],
        ["w0565", "\uCDA4", "\uBA85", "A", "\uCDA401"],
        ["w0566", "\uAE68\uB057\uD558\uB2E4", "\uD615", "A", "\uAE68\uB057\uD558\uB2E4"],
        ["w0567", "\uBB3C\uC5B4\uBCF4\uB2E4", "\uB3D9", "A", "\uBB3C\uC5B4\uBCF4\uB2E4"],
        ["w0568", "\uBBF8\uC548\uD558\uB2E4", "\uD615", "A", "\uBBF8\uC548\uD558\uB2E4"],
        ["w0569", "\uC2A4\uD2B8\uB808\uC2A4", "\uBA85", "A", "\uC2A4\uD2B8\uB808\uC2A4"],
        ["w0570", "\uACFC\uC77C", "\uBA85", "A", "\uACFC\uC77C01"],
        ["w0571", "\uC2DC\uC6D4", "\uBA85", "A", "\uC2DC\uC6D401"],
        ["w0572", "\uBC15\uBB3C\uAD00", "\uBA85", "A", "\uBC15\uBB3C\uAD00"],
        ["w0573", "\uC5B4\uC11C", "\uBD80", "A", "\uC5B4\uC11C01"],
        ["w0574", "\uD314\uC6D4", "\uBA85", "A", "\uD314\uC6D4"],
        ["w0575", "\uD638", "\uC758", "A", "\uD63814"],
        ["w0576", "\uADF8\uB987", "\uBA85", "A", "\uADF8\uB98701"],
        ["w0577", "\uB77C\uB514\uC624", "\uBA85", "A", "\uB77C\uB514\uC624"],
        ["w0578", "\uBC29\uD559", "\uBA85", "A", "\uBC29\uD559"],
        ["w0579", "\uB0A8\uCABD", "\uBA85", "A", "\uB0A8\uCABD"],
        ["w0580", "\uC0C9\uAE54", "\uBA85", "A", "\uC0C9\uAE54"],
        ["w0581", "\uC694\uB9AC", "\uBA85", "A", "\uC694\uB9AC05"],
        ["w0582", "\uC720\uBA85\uD558\uB2E4", "\uD615", "A", "\uC720\uBA85\uD558\uB2E401"],
        ["w0583", "\uC678\uAD6D\uC778", "\uBA85", "A", "\uC678\uAD6D\uC778"],
        ["w0584", "\uBD80\uC778", "\uBA85", "A", "\uBD80\uC77801"],
        ["w0585", "\uB6F0\uB2E4", "\uB3D9", "A", "\uB6F0\uB2E402"],
        ["w0586", "\uC9C0\uB09C\uB2EC", "\uBA85", "A", "\uC9C0\uB09C\uB2EC"],
        ["w0587", "\uCC45\uC0C1", "\uBA85", "A", "\uCC45\uC0C101"],
        ["w0588", "\uCDA5\uB2E4", "\uD615", "A", "\uCDA5\uB2E4"],
        ["w0589", "\uB458\uC9F8", "\uC218", "A", "\uB458\uC9F8"],
        ["w0590", "\uBB34\uAC81\uB2E4", "\uD615", "A", "\uBB34\uAC81\uB2E4"],
        ["w0591", "\uAD8C", "\uC758", "A", "\uAD8C01"],
        ["w0592", "\uC78E", "\uBA85", "A", "\uC78E01"],
        ["w0593", "\uCC9C\uCC9C\uD788", "\uBD80", "A", "\uCC9C\uCC9C\uD788"],
        ["w0594", "\uC2A4\uD3EC\uCE20", "\uBA85", "A", "\uC2A4\uD3EC\uCE20"],
        ["w0595", "\uC800\uAE30", "\uB300", "A", "\uC800\uAE3001"],
        ["w0596", "\uAD50\uD68C", "\uBA85", "A", "\uAD50\uD68C02"],
        ["w0597", "\uD654", "\uBA85", "A", "\uD65406"],
        ["w0598", "\uC77C\uC6D4", "\uBA85", "A", "\uC77C\uC6D401"],
        ["w0599", "\uCCAB\uC9F8", "\uC218", "A", "\uCCAB\uC9F8"],
        ["w0600", "\uB3C4\uC11C\uAD00", "\uBA85", "A", "\uB3C4\uC11C\uAD00"],
        ["w0601", "\uC120\uBB3C", "\uBA85", "A", "\uC120\uBB3C03"],
        ["w0602", "\uC544\uC8FC\uBA38\uB2C8", "\uBA85", "A", "\uC544\uC8FC\uBA38\uB2C8"],
        ["w0603", "\uC704\uD5D8", "\uBA85", "A", "\uC704\uD5D8"],
        ["w0604", "\uC9C0\uD558", "\uBA85", "A", "\uC9C0\uD558"],
        ["w0605", "\uC0AC\uBB34\uC2E4", "\uBA85", "A", "\uC0AC\uBB34\uC2E4"],
        ["w0606", "\uC774\uC6D4", "\uBA85", "A", "\uC774\uC6D401"],
        ["w0607", "\uC77C\uC694\uC77C", "\uBA85", "A", "\uC77C\uC694\uC77C"],
        ["w0608", "\uBE44\uC2F8\uB2E4", "\uD615", "A", "\uBE44\uC2F8\uB2E4"],
        ["w0609", "\uC67C\uCABD", "\uBA85", "A", "\uC67C\uCABD"],
        ["w0610", "\uC2DC\uC6D0\uD558\uB2E4", "\uD615", "A", "\uC2DC\uC6D0\uD558\uB2E4"],
        ["w0611", "\uC7A1\uC9C0", "\uBA85", "A", "\uC7A1\uC9C0"],
        ["w0612", "\uB301", "\uBA85", "A", "\uB30101"],
        ["w0613", "\uBC18\uAC11\uB2E4", "\uD615", "A", "\uBC18\uAC11\uB2E4"],
        ["w0614", "\uB2E4\uB140\uC624\uB2E4", "\uB3D9", "A", "\uB2E4\uB140\uC624\uB2E4"],
        ["w0615", "\uBE44\uB514\uC624", "\uBA85", "A", "\uBE44\uB514\uC624"],
        ["w0616", "\uC774\uCABD", "\uB300", "A", "\uC774\uCABD02"],
        ["w0617", "\uC5F0\uC2B5", "\uBA85", "A", "\uC5F0\uC2B503"],
        ["w0618", "\uC624\uB978\uCABD", "\uBA85", "A", "\uC624\uB978\uCABD"],
        ["w0619", "\uD654\uC7A5\uC2E4", "\uBA85", "A", "\uD654\uC7A5\uC2E4"],
        ["w0620", "\uC8FC\uB9D0", "\uBA85", "A", "\uC8FC\uB9D002"],
        ["w0621", "\uB0B4\uB144", "\uBA85", "A", "\uB0B4\uB144"],
        ["w0622", "\uB300\uD559\uC0DD", "\uBA85", "A", "\uB300\uD559\uC0DD"],
        ["w0623", "\uB2EB\uB2E4", "\uB3D9", "A", "\uB2EB\uB2E402"],
        ["w0624", "\uC0DD\uC77C", "\uBA85", "A", "\uC0DD\uC77C02"],
        ["w0625", "\uAC78\uC5B4\uAC00\uB2E4", "\uB3D9", "A", "\uAC78\uC5B4\uAC00\uB2E4"],
        ["w0626", "\uBC31\uD654\uC810", "\uBA85", "A", "\uBC31\uD654\uC810"],
        ["w0627", "\uC548\uB155\uD558\uB2E4", "\uD615", "A", "\uC548\uB155\uD558\uB2E4"],
        ["w0628", "\uCD9C\uBC1C\uD558\uB2E4", "\uB3D9", "A", "\uCD9C\uBC1C\uD558\uB2E4"],
        ["w0629", "\uC911\uD559\uAD50", "\uBA85", "A", "\uC911\uD559\uAD50"],
        ["w0630", "\uD770\uC0C9", "\uBA85", "A", "\uD770\uC0C9"],
        ["w0631", "\uAC00\uC218", "\uBA85", "A", "\uAC00\uC21811"],
        ["w0632", "\uC57D", "\uBA85", "A", "\uC57D07"],
        ["w0633", "\uC800\uCABD", "\uB300", "A", "\uC800\uCABD"],
        ["w0634", "\uC2ED\uC77C\uC6D4", "\uBA85", "A", "\uC2ED\uC77C\uC6D4"],
        ["w0635", "\uAC70\uC6B8", "\uBA85", "A", "\uAC70\uC6B801"],
        ["w0636", "\uC5B4\uC81C", "\uBD80", "A", "\uC5B4\uC81C01"],
        ["w0637", "\uC704\uD5D8\uD558\uB2E4", "\uD615", "A", "\uC704\uD5D8\uD558\uB2E4"],
        ["w0638", "\uC878\uC5C5\uD558\uB2E4", "\uB3D9", "A", "\uC878\uC5C5\uD558\uB2E4"],
        ["w0639", "\uBD80\uC5CC", "\uBA85", "A", "\uBD80\uC5CC"],
        ["w0640", "\uBD81\uCABD", "\uBA85", "A", "\uBD81\uCABD"],
        ["w0641", "\uC1E0\uACE0\uAE30", "\uBA85", "A", "\uC1E0\uACE0\uAE30"],
        ["w0642", "\uC8FC", "\uBA85", "A", "\uC8FC26"],
        ["w0643", "\uCE74\uB4DC", "\uBA85", "A", "\uCE74\uB4DC"],
        ["w0644", "\uB2E8\uC5B4", "\uBA85", "A", "\uB2E8\uC5B4"],
        ["w0645", "\uAE40\uCE58", "\uBA85", "A", "\uAE40\uCE5801"],
        ["w0646", "\uB0A0\uB2E4", "\uB3D9", "A", "\uB0A0\uB2E401"],
        ["w0647", "\uC124\uD0D5", "\uBA85", "A", "\uC124\uD0D5"],
        ["w0648", "\uC2F8\uB2E4", "\uD615", "A", "\uC2F8\uB2E405"],
        ["w0649", "\uCE7C", "\uBA85", "A", "\uCE7C01"],
        ["w0650", "\uCE74\uBA54\uB77C", "\uBA85", "A", "\uCE74\uBA54\uB77C"],
        ["w0651", "\uD1A0\uC694\uC77C", "\uBA85", "A", "\uD1A0\uC694\uC77C"],
        ["w0652", "\uACBD\uCC30\uAD00", "\uBA85", "A", "\uACBD\uCC30\uAD00"],
        ["w0653", "\uADF9\uC7A5", "\uBA85", "A", "\uADF9\uC7A5"],
        ["w0654", "\uC624\uB79C\uB9CC", "\uBA85", "A", "\uC624\uB79C\uB9CC"],
        ["w0655", "\uBC31", "\uAD00", "A", "\uBC3105"],
        ["w0656", "\uC544\uC90C\uB9C8", "\uBA85", "A", "\uC544\uC90C\uB9C8"],
        ["w0657", "\uCD94\uB2E4", "\uB3D9", "A", "\uCD94\uB2E402"],
        ["w0658", "\uCF1C\uB2E4", "\uB3D9", "A", "\uCF1C\uB2E401"],
        ["w0659", "\uAD70\uC778", "\uBA85", "A", "\uAD70\uC778"],
        ["w0660", "\uC544\uB2C8\uC694", "\uAC10", "A", "\uC544\uB2C8\uC694"],
        ["w0661", "\uCE58\uB9C8", "\uBA85", "A", "\uCE58\uB9C801"],
        ["w0662", "\uAE4E\uB2E4", "\uB3D9", "A", "\uAE4E\uB2E4"],
        ["w0663", "\uCCAD\uC18C", "\uBA85", "A", "\uCCAD\uC18C06"],
        ["w0664", "\uAC71\uC815\uD558\uB2E4", "\uB3D9", "A", "\uAC71\uC815\uD558\uB2E4"],
        ["w0665", "\uB044\uB2E4", "\uB3D9", "A", "\uB044\uB2E401"],
        ["w0666", "\uACC4\uC808", "\uBA85", "A", "\uACC4\uC80801"],
        ["w0667", "\uC6B4\uB3D9\uC7A5", "\uBA85", "A", "\uC6B4\uB3D9\uC7A5"],
        ["w0668", "\uB3D9\uCABD", "\uBA85", "A", "\uB3D9\uCABD"],
        ["w0669", "\uC7A0\uAE50", "\uBA85", "A", "\uC7A0\uAE50"],
        ["w0670", "\uC694\uC988\uC74C", "\uBA85", "A", "\uC694\uC988\uC74C"],
        ["w0671", "\uC783\uC5B4\uBC84\uB9AC\uB2E4", "\uB3D9", "A", "\uC783\uC5B4\uBC84\uB9AC\uB2E4"],
        ["w0672", "\uC870\uC6A9\uD558\uB2E4", "\uD615", "A", "\uC870\uC6A9\uD558\uB2E401"],
        ["w0673", "\uD55C\uBCF5", "\uBA85", "A", "\uD55C\uBCF5"],
        ["w0674", "\uB77C\uBA74", "\uBA85", "A", "\uB77C\uBA7401"],
        ["w0675", "\uBC14\uC9C0", "\uBA85", "A", "\uBC14\uC9C001"],
        ["w0676", "\uC2EB\uC5B4\uD558\uB2E4", "\uB3D9", "A", "\uC2EB\uC5B4\uD558\uB2E4"],
        ["w0677", "\uD14C\uC774\uBE14", "\uBA85", "A", "\uD14C\uC774\uBE14"],
        ["w0678", "\uD55C\uAD6D\uC5B4", "\uBA85", "A", "\uD55C\uAD6D\uC5B4"],
        ["w0679", "\uD55C\uC790", "\uBA85", "A", "\uD55C\uC79002"],
        ["w0680", "\uC57D\uC18D\uD558\uB2E4", "\uB3D9", "A", "\uC57D\uC18D\uD558\uB2E4"],
        ["w0681", "\uCDE8\uBBF8", "\uBA85", "A", "\uCDE8\uBBF804"],
        ["w0682", "\uB365\uB2E4", "\uD615", "A", "\uB365\uB2E401"],
        ["w0683", "\uAD6C\uACBD", "\uBA85", "A", "\uAD6C\uACBD01"],
        ["w0684", "\uADF8\uBD84", "\uB300", "A", "\uADF8\uBD84"],
        ["w0685", "\uC2E0\uB2E4", "\uB3D9", "A", "\uC2E0\uB2E4"],
        ["w0686", "\uC8C4\uC1A1\uD558\uB2E4", "\uD615", "A", "\uC8C4\uC1A1\uD558\uB2E4"],
        ["w0687", "\uC14B", "\uC218", "A", "\uC14B"],
        ["w0688", "\uC9C0\uC6B0\uB2E4", "\uB3D9", "A", "\uC9C0\uC6B0\uB2E401"],
        ["w0689", "\uC14B\uC9F8", "\uC218", "A", "\uC14B\uC9F8"],
        ["w0690", "\uC878\uC5C5", "\uBA85", "A", "\uC878\uC5C5"],
        ["w0691", "\uB2ED", "\uBA85", "A", "\uB2ED"],
        ["w0692", "\uB9E5\uC8FC", "\uBA85", "A", "\uB9E5\uC8FC"],
        ["w0693", "\uAD50\uACFC\uC11C", "\uBA85", "A", "\uAD50\uACFC\uC11C"],
        ["w0694", "\uB3FC\uC9C0", "\uBA85", "A", "\uB3FC\uC9C0"],
        ["w0695", "\uC78A\uC5B4\uBC84\uB9AC\uB2E4", "\uB3D9", "A", "\uC78A\uC5B4\uBC84\uB9AC\uB2E4"],
        ["w0696", "\uC2DD\uD0C1", "\uBA85", "A", "\uC2DD\uD0C1"],
        ["w0697", "\uACF5\uC6D0", "\uBA85", "A", "\uACF5\uC6D003"],
        ["w0698", "\uC548\uB418\uB2E4", "\uB3D9", "A", "\uC548\uB418\uB2E401"],
        ["w0699", "\uB0A0\uC9DC", "\uBA85", "A", "\uB0A0\uC9DC01"],
        ["w0700", "\uC0CC\uB4DC\uC704\uCE58", "\uBA85", "A", "\uC0CC\uB4DC\uC704\uCE58"],
        ["w0701", "\uADF8\uCABD", "\uB300", "A", "\uADF8\uCABD"],
        ["w0702", "\uAC80\uC740\uC0C9", "\uBA85", "A", "\uAC80\uC740\uC0C9"],
        ["w0703", "\uC5EC\uBCF4\uC138\uC694", "\uAC10", "A", "\uC5EC\uBCF4\uC138\uC694"],
        ["w0704", "\uCC9C", "\uAD00", "A", "\uCC9C03"],
        ["w0705", "\uC11C\uCABD", "\uBA85", "A", "\uC11C\uCABD"],
        ["w0706", "\uACBD\uCC30\uC11C", "\uBA85", "A", "\uACBD\uCC30\uC11C"],
        ["w0707", "\uAD6C\uB450", "\uBA85", "A", "\uAD6C\uB45001"],
        ["w0708", "\uC5EC\uD559\uC0DD", "\uBA85", "A", "\uC5EC\uD559\uC0DD"],
        ["w0709", "\uB0C9\uC7A5\uACE0", "\uBA85", "A", "\uB0C9\uC7A5\uACE0"],
        ["w0710", "\uAC10\uAE30", "\uBA85", "A", "\uAC10\uAE3004"],
        ["w0711", "\uACB0\uD63C\uC2DD", "\uBA85", "A", "\uACB0\uD63C\uC2DD"],
        ["w0712", "\uB178\uB798\uD558\uB2E4", "\uB3D9", "A", "\uB178\uB798\uD558\uB2E4"],
        ["w0713", "\uC6B4\uC804", "\uBA85", "A", "\uC6B4\uC80402"],
        ["w0714", "\uBD88\uACE0\uAE30", "\uBA85", "A", "\uBD88\uACE0\uAE30"],
        ["w0715", "\uBAA9\uC695", "\uBA85", "A", "\uBAA9\uC695"],
        ["w0716", "\uC804\uD654\uBC88\uD638", "\uBA85", "A", "\uC804\uD654\uBC88\uD638"],
        ["w0717", "\uAC10\uC0AC\uD558\uB2E4", "\uD615", "A", "\uAC10\uC0AC\uD558\uB2E405"],
        ["w0718", "\uB9CC", "\uAD00", "A", "\uB9CC06"],
        ["w0719", "\uC9C0\uAC11", "\uBA85", "A", "\uC9C0\uAC1103"],
        ["w0720", "\uCE5C\uC808\uD558\uB2E4", "\uD615", "A", "\uCE5C\uC808\uD558\uB2E4"],
        ["w0721", "\uC800\uAC70", "\uB300", "A", "\uC800\uAC7001"],
        ["w0722", "\uAC78\uC5B4\uC624\uB2E4", "\uB3D9", "A", "\uAC78\uC5B4\uC624\uB2E401"],
        ["w0723", "\uC18C\uD30C", "\uBA85", "A", "\uC18C\uD30C06"],
        ["w0724", "\uC2A4\uBB34", "\uAD00", "A", "\uC2A4\uBB34"],
        ["w0725", "\uC5ED", "\uBA85", "A", "\uC5ED14"],
        ["w0726", "\uC778\uC0AC\uD558\uB2E4", "\uB3D9", "A", "\uC778\uC0AC\uD558\uB2E4"],
        ["w0727", "\uC5EC\uAD8C", "\uBA85", "A", "\uC5EC\uAD8C02"],
        ["w0728", "\uC5F4\uC1E0", "\uBA85", "A", "\uC5F4\uC1E0"],
        ["w0729", "\uC624\uB80C\uC9C0", "\uBA85", "A", "\uC624\uB80C\uC9C0"],
        ["w0730", "\uBC88\uD638", "\uBA85", "A", "\uBC88\uD63802"],
        ["w0731", "\uC800\uAC83", "\uB300", "A", "\uC800\uAC83"],
        ["w0732", "\uACFC\uC790", "\uBA85", "A", "\uACFC\uC79002"],
        ["w0733", "\uB300\uD559\uAD50", "\uBA85", "A", "\uB300\uD559\uAD50"],
        ["w0734", "\uB3FC\uC9C0\uACE0\uAE30", "\uBA85", "A", "\uB3FC\uC9C0\uACE0\uAE30"],
        ["w0735", "\uC548\uB155\uD788", "\uBD80", "A", "\uC548\uB155\uD788"],
        ["w0736", "\uC804\uD654\uD558\uB2E4", "\uB3D9", "A", "\uC804\uD654\uD558\uB2E402"],
        ["w0737", "\uC218\uAC74", "\uBA85", "A", "\uC218\uAC74"],
        ["w0738", "\uC591\uBCF5", "\uBA85", "A", "\uC591\uBCF501"],
        ["w0739", "\uC7A0\uC790\uB2E4", "\uB3D9", "A", "\uC7A0\uC790\uB2E4"],
        ["w0740", "\uC813\uAC00\uB77D", "\uBA85", "A", "\uC813\uAC00\uB77D"],
        ["w0741", "\uD53C\uC544\uB178", "\uBA85", "A", "\uD53C\uC544\uB17801"],
        ["w0742", "\uCD95\uD558\uD558\uB2E4", "\uB3D9", "A", "\uCD95\uD558\uD558\uB2E4"],
        ["w0743", "\uAE30\uC219\uC0AC", "\uBA85", "A", "\uAE30\uC219\uC0AC"],
        ["w0744", "\uC0B0\uCC45", "\uBA85", "A", "\uC0B0\uCC45"],
        ["w0745", "\uC6B4\uB3D9\uD558\uB2E4", "\uB3D9", "A", "\uC6B4\uB3D9\uD558\uB2E4"],
        ["w0746", "\uC6D4\uC694\uC77C", "\uBA85", "A", "\uC6D4\uC694\uC77C"],
        ["w0747", "\uC8FC\uC18C", "\uBA85", "A", "\uC8FC\uC18C01"],
        ["w0748", "\uD30C\uD2F0", "\uBA85", "A", "\uD30C\uD2F0"],
        ["w0749", "\uB2EC\uB2E4", "\uD615", "A", "\uB2EC\uB2E407"],
        ["w0750", "\uCCAD\uC18C\uD558\uB2E4", "\uB3D9", "A", "\uCCAD\uC18C\uD558\uB2E403"],
        ["w0751", "\uB4F1\uC0B0", "\uBA85", "A", "\uB4F1\uC0B0"],
        ["w0752", "\uBA54\uB274", "\uBA85", "A", "\uBA54\uB274"],
        ["w0753", "\uC678\uAD6D\uC5B4", "\uBA85", "A", "\uC678\uAD6D\uC5B4"],
        ["w0754", "\uC790\uC7A5\uBA74", "\uBA85", "A", "\uC790\uC7A5\uBA74"],
        ["w0755", "\uC911\uD559\uC0DD", "\uBA85", "A", "\uC911\uD559\uC0DD"],
        ["w0756", "\uD734\uC77C", "\uBA85", "A", "\uD734\uC77C"],
        ["w0757", "\uB2EC\uB825", "\uBA85", "A", "\uB2EC\uB825"],
        ["w0758", "\uC18C\uD48D", "\uBA85", "A", "\uC18C\uD48D02"],
        ["w0759", "\uCDA4\uCD94\uB2E4", "\uB3D9", "A", "\uCDA4\uCD94\uB2E4"],
        ["w0760", "\uACF5\uCC45", "\uBA85", "A", "\uACF5\uCC4501"],
        ["w0761", "\uB611\uBC14\uB85C", "\uBD80", "A", "\uB611\uBC14\uB85C"],
        ["w0762", "\uC11C\uC810", "\uBA85", "A", "\uC11C\uC81003"],
        ["w0763", "\uCD08\uB300\uD558\uB2E4", "\uB3D9", "A", "\uCD08\uB300\uD558\uB2E402"],
        ["w0764", "\uC5F0\uC2B5\uD558\uB2E4", "\uB3D9", "A", "\uC5F0\uC2B5\uD558\uB2E403"],
        ["w0765", "\uACBD\uCE58", "\uBA85", "A", "\uACBD\uCE5802"],
        ["w0766", "\uBC1C\uC74C", "\uBA85", "A", "\uBC1C\uC74C01"],
        ["w0767", "\uC7AC\uBBF8\uC5C6\uB2E4", "\uD615", "A", "\uC7AC\uBBF8\uC5C6\uB2E4"],
        ["w0768", "\uCF5C\uB77C", "\uBA85", "A", "\uCF5C\uB77C"],
        ["w0769", "\uB0A8\uD559\uC0DD", "\uBA85", "A", "\uB0A8\uD559\uC0DD"],
        ["w0770", "\uC2DD\uC0AC\uD558\uB2E4", "\uB3D9", "A", "\uC2DD\uC0AC\uD558\uB2E402"],
        ["w0771", "\uACE0\uD504\uB2E4", "\uD615", "A", "\uACE0\uD504\uB2E4"],
        ["w0772", "\uB300\uC0AC\uAD00", "\uBA85", "A", "\uB300\uC0AC\uAD00"],
        ["w0773", "\uBC30\uACE0\uD504\uB2E4", "\uD615", "A", "\uBC30\uACE0\uD504\uB2E4"],
        ["w0774", "\uC0BC", "\uC218", "A", "\uC0BC06"],
        ["w0775", "\uC5EC\uD589\uD558\uB2E4", "\uB3D9", "A", "\uC5EC\uD589\uD558\uB2E401"],
        ["w0776", "\uC815\uB958\uC7A5", "\uBA85", "A", "\uC815\uB958\uC7A5"],
        ["w0777", "\uB9F5\uB2E4", "\uD615", "A", "\uB9F5\uB2E4"],
        ["w0778", "\uC5EC\uB3D9\uC0DD", "\uBA85", "A", "\uC5EC\uB3D9\uC0DD"],
        ["w0779", "\uC624\uB798\uAC04\uB9CC", "\uBA85", "A", "\uC624\uB798\uAC04\uB9CC"],
        ["w0780", "\uC810\uC2EC\uC2DC\uAC04", "\uBA85", "A", "\uC810\uC2EC\uC2DC\uAC04"],
        ["w0781", "\uD734\uC9C0", "\uBA85", "A", "\uD734\uC9C002"],
        ["w0782", "\uB137\uC9F8", "\uC218", "A", "\uB137\uC9F8"],
        ["w0783", "\uD0DC\uAD8C\uB3C4", "\uBA85", "A", "\uD0DC\uAD8C\uB3C4"],
        ["w0784", "\uD584\uBC84\uAC70", "\uBA85", "A", "\uD584\uBC84\uAC70"],
        ["w0785", "\uAC10\uC0AC", "\uBA85", "A", "\uAC10\uC0AC08"],
        ["w0786", "\uC288\uD37C\uB9C8\uCF13", "\uBA85", "A", "\uC288\uD37C\uB9C8\uCF13"],
        ["w0787", "\uBE44\uB204", "\uBA85", "A", "\uBE44\uB204"],
        ["w0788", "\uC138\uC218", "\uBA85", "A", "\uC138\uC21804"],
        ["w0789", "\uCC0C\uAC1C", "\uBA85", "A", "\uCC0C\uAC1C01"],
        ["w0790", "\uB125\uD0C0\uC774", "\uBA85", "A", "\uB125\uD0C0\uC774"],
        ["w0791", "\uC6D4", "\uC758", "A", "\uC6D402"],
        ["w0792", "\uC7A1\uC218\uC2DC\uB2E4", "\uB3D9", "A", "\uC7A1\uC218\uC2DC\uB2E4"],
        ["w0793", "\uD55C\uAD6D\uB9D0", "\uBA85", "A", "\uD55C\uAD6D\uB9D0"],
        ["w0794", "\uACC4\uB780", "\uBA85", "A", "\uACC4\uB780"],
        ["w0795", "\uB137", "\uC218", "A", "\uB13701"],
        ["w0796", "\uC5D0\uC5B4\uCEE8", "\uBA85", "A", "\uC5D0\uC5B4\uCEE8"],
        ["w0797", "\uCD08\uB300", "\uBA85", "A", "\uCD08\uB30006"],
        ["w0798", "\uC0AC\uC804", "\uBA85", "A", "\uC0AC\uC80422"],
        ["w0799", "\uC2E4\uB840", "\uBA85", "A", "\uC2E4\uB84001"],
        ["w0800", "\uC548\uB155", "\uAC10", "A", "\uC548\uB155"],
        ["w0801", "\uC57D\uAD6D", "\uBA85", "A", "\uC57D\uAD6D02"],
        ["w0802", "\uC9C0\uB09C\uC8FC", "\uBA85", "A", "\uC9C0\uB09C\uC8FC"],
        ["w0803", "\uAC04\uD638\uC0AC", "\uBA85", "A", "\uAC04\uD638\uC0AC"],
        ["w0804", "\uACE0\uB4F1\uD559\uC0DD", "\uBA85", "A", "\uACE0\uB4F1\uD559\uC0DD"],
        ["w0805", "\uB2E4\uC12F", "\uC218", "A", "\uB2E4\uC12F"],
        ["w0806", "\uB2ED\uACE0\uAE30", "\uBA85", "A", "\uB2ED\uACE0\uAE30"],
        ["w0807", "\uC21F\uAC00\uB77D", "\uBA85", "A", "\uC21F\uAC00\uB77D"],
        ["w0808", "\uC694\uC77C", "\uBA85", "A", "\uC694\uC77C"],
        ["w0809", "\uC9C8\uBB38\uD558\uB2E4", "\uB3D9", "A", "\uC9C8\uBB38\uD558\uB2E4"],
        ["w0810", "\uCE58\uC57D", "\uBA85", "A", "\uCE58\uC57D"],
        ["w0811", "\uAE08\uC694\uC77C", "\uBA85", "A", "\uAE08\uC694\uC77C"],
        ["w0812", "\uAE40\uBC25", "\uBA85", "A", "\uAE40\uBC25"],
        ["w0813", "\uC218\uC694\uC77C", "\uBA85", "A", "\uC218\uC694\uC77C"],
        ["w0814", "\uC6B4\uC804\uD558\uB2E4", "\uB3D9", "A", "\uC6B4\uC804\uD558\uB2E4"],
        ["w0815", "\uB178\uD2B8", "\uBA85", "A", "\uB178\uD2B802"],
        ["w0816", "\uCD08\uCF5C\uB9BF", "\uBA85", "A", "\uCD08\uCF5C\uB9BF"],
        ["w0817", "\uD53C\uC790", "\uBA85", "A", "\uD53C\uC790"],
        ["w0818", "\uB178\uB780\uC0C9", "\uBA85", "A", "\uB178\uB780\uC0C9"],
        ["w0819", "\uC774\uBD84", "\uB300", "A", "\uC774\uBD8401"],
        ["w0820", "\uCE6B\uC194", "\uBA85", "A", "\uCE6B\uC194"],
        ["w0821", "\uACF5\uC911\uC804\uD654", "\uBA85", "A", "\uACF5\uC911\uC804\uD654"],
        ["w0822", "\uBC30\uBD80\uB974\uB2E4", "\uD615", "A", "\uBC30\uBD80\uB974\uB2E4"],
        ["w0823", "\uC0E4\uC6CC", "\uBA85", "A", "\uC0E4\uC6CC"],
        ["w0824", "\uC138\uD0C1\uAE30", "\uBA85", "A", "\uC138\uD0C1\uAE30"],
        ["w0825", "\uB0A8\uB3D9\uC0DD", "\uBA85", "A", "\uB0A8\uB3D9\uC0DD"],
        ["w0826", "\uB3C4\uCC29", "\uBA85", "A", "\uB3C4\uCC2901"],
        ["w0827", "\uC1FC\uD551", "\uBA85", "A", "\uC1FC\uD551"],
        ["w0828", "\uC2A4\uD0A4", "\uBA85", "A", "\uC2A4\uD0A4"],
        ["w0829", "\uC5F4", "\uC218", "A", "\uC5F403"],
        ["w0830", "\uC6B4\uB3D9\uD654", "\uBA85", "A", "\uC6B4\uB3D9\uD654"],
        ["w0831", "\uC9DC\uB2E4", "\uD615", "A", "\uC9DC\uB2E403"],
        ["w0832", "\uCD08\uB4F1\uD559\uAD50", "\uBA85", "A", "\uCD08\uB4F1\uD559\uAD50"],
        ["w0833", "\uACF5\uD734\uC77C", "\uBA85", "A", "\uACF5\uD734\uC77C"],
        ["w0834", "\uB9C8\uD754", "\uC218", "A", "\uB9C8\uD754"],
        ["w0835", "\uBCFC\uD39C", "\uBA85", "A", "\uBCFC\uD39C02"],
        ["w0836", "\uBE68\uAC04\uC0C9", "\uBA85", "A", "\uBE68\uAC04\uC0C9"],
        ["w0837", "\uC2A4\uBB3C", "\uC218", "A", "\uC2A4\uBB3C"],
        ["w0838", "\uCCAD\uBC14\uC9C0", "\uBA85", "A", "\uCCAD\uBC14\uC9C0"],
        ["w0839", "\uD578\uB4DC\uD3F0", "\uBA85", "A", "\uD578\uB4DC\uD3F0"],
        ["w0840", "\uD734\uC9C0\uD1B5", "\uBA85", "A", "\uD734\uC9C0\uD1B5"],
        ["w0841", "\uCE60\uD310", "\uBA85", "A", "\uCE60\uD310"],
        ["w0842", "\uD06C\uB9AC\uC2A4\uB9C8\uC2A4", "\uBA85", "A", "\uD06C\uB9AC\uC2A4\uB9C8\uC2A4"],
        ["w0843", "\uAD6C", "\uC218", "A", "\uAD6C01"],
        ["w0844", "\uBAA9\uC694\uC77C", "\uBA85", "A", "\uBAA9\uC694\uC77C"],
        ["w0845", "\uC9C0\uC6B0\uAC1C", "\uBA85", "A", "\uC9C0\uC6B0\uAC1C"],
        ["w0846", "\uC0AC", "\uC218", "A", "\uC0AC11"],
        ["w0847", "\uC218\uC601\uC7A5", "\uBA85", "A", "\uC218\uC601\uC7A5"],
        ["w0848", "\uC77C\uBCF8\uC5B4", "\uBA85", "A", "\uC77C\uBCF8\uC5B4"],
        ["w0849", "\uAC08\uBE44", "\uBA85", "A", "\uAC08\uBE4401"],
        ["w0850", "\uC11C\uB978", "\uC218", "A", "\uC11C\uB978"],
        ["w0851", "\uC544\uD649", "\uC218", "A", "\uC544\uD649"],
        ["w0852", "\uC7A5\uBBF8", "\uBA85", "A", "\uC7A5\uBBF805"],
        ["w0853", "\uD30C\uB780\uC0C9", "\uBA85", "A", "\uD30C\uB780\uC0C9"],
        ["w0854", "\uB0C9\uBA74", "\uBA85", "A", "\uB0C9\uBA74"],
        ["w0855", "\uBE44\uBE54\uBC25", "\uBA85", "A", "\uBE44\uBE54\uBC25"],
        ["w0856", "\uC5EC\uB4E0", "\uC218", "A", "\uC5EC\uB4E0"],
        ["w0857", "\uC77C\uD754", "\uC218", "A", "\uC77C\uD754"],
        ["w0858", "\uD654\uC694\uC77C", "\uBA85", "A", "\uD654\uC694\uC77C"],
        ["w0859", "\uC120\uBB3C\uD558\uB2E4", "\uB3D9", "A", "\uC120\uBB3C\uD558\uB2E4"],
        ["w0860", "\uC544\uC774\uC2A4\uD06C\uB9BC", "\uBA85", "A", "\uC544\uC774\uC2A4\uD06C\uB9BC"],
        ["w0861", "\uC694\uB9AC\uD558\uB2E4", "\uB3D9", "A", "\uC694\uB9AC\uD558\uB2E402"],
        ["w0862", "\uCE60", "\uC218", "A", "\uCE6001"],
        ["w0863", "\uB2E4\uC12F\uC9F8", "\uC218", "A", "\uB2E4\uC12F\uC9F8"],
        ["w0864", "\uB9DB\uC5C6\uB2E4", "\uD615", "A", "\uB9DB\uC5C6\uB2E4"],
        ["w0865", "\uC0AC\uC2ED", "\uC218", "A", "\uC0AC\uC2ED"],
        ["w0866", "\uC2E4\uB840\uD558\uB2E4", "\uB3D9", "A", "\uC2E4\uB840\uD558\uB2E4"],
        ["w0867", "\uC5EC\uC12F", "\uC218", "A", "\uC5EC\uC12F"],
        ["w0868", "\uC721", "\uC218", "A", "\uC72102"],
        ["w0869", "\uC77C\uACF1", "\uC218", "A", "\uC77C\uACF1"],
        ["w0870", "\uC0BC\uC2ED", "\uC218", "A", "\uC0BC\uC2ED"],
        ["w0871", "\uC624\uC2ED", "\uC218", "A", "\uC624\uC2ED"],
        ["w0872", "\uC911\uAD6D\uC5B4", "\uBA85", "A", "\uC911\uAD6D\uC5B4"],
        ["w0873", "\uCE60\uC2ED", "\uC218", "A", "\uCE60\uC2ED"],
        ["w0874", "\uC0AC\uD0D5", "\uBA85", "A", "\uC0AC\uD0D502"],
        ["w0875", "\uC608\uC21C", "\uC218", "A", "\uC608\uC21C"],
        ["w0876", "\uC624", "\uC218", "A", "\uC62404"],
        ["w0877", "\uC2ED", "\uC218", "A", "\uC2ED"],
        ["w0878", "\uC270", "\uC218", "A", "\uC270"],
        ["w0879", "\uC721\uC2ED", "\uC218", "A", "\uC721\uC2ED"],
        ["w0880", "\uD314\uC2ED", "\uC218", "A", "\uD314\uC2ED"],
        ["w0881", "\uC5EC\uB35F", "\uC218", "A", "\uC5EC\uB35F"],
        ["w0882", "\uC544\uD754", "\uC218", "A", "\uC544\uD754"],
        ["w0883", "\uC774\uC2ED", "\uC218", "A", "\uC774\uC2ED"],
        ["w0884", "\uC800\uACF3", "\uB300", "A", "\uC800\uACF3"],
        ["w0885", "\uACBD\uBCF5\uAD81", "\uACE0", "A", "\uACBD\uBCF5\uAD81"],
        ["w0886", "\uACBD\uC8FC", "\uACE0", "A", "\uACBD\uC8FC"],
        ["w0887", "\uAD6C\uC2ED", "\uC218", "A", "\uAD6C\uC2ED"],
        ["w0888", "\uB0A8\uB300\uBB38", "\uACE0", "A", "\uB0A8\uB300\uBB38"],
        ["w0889", "\uB0A8\uB300\uBB38\uC2DC\uC7A5", "\uACE0", "A", "\uB0A8\uB300\uBB38\uC2DC\uC7A5"],
        ["w0890", "\uB3C5\uC77C", "\uACE0", "A", "\uB3C5\uC77C"],
        ["w0891", "\uB7EC\uC2DC\uC544", "\uACE0", "A", "\uB7EC\uC2DC\uC544"],
        ["w0892", "\uBBF8\uAD6D", "\uACE0", "A", "\uBBF8\uAD6D"],
        ["w0893", "\uBD80\uC0B0", "\uACE0", "A", "\uBD80\uC0B0"],
        ["w0894", "\uC11C\uC6B8", "\uACE0", "A", "\uC11C\uC6B8"],
        ["w0895", "\uC11C\uC6B8\uC5ED", "\uACE0", "A", "\uC11C\uC6B8\uC5ED"],
        ["w0896", "\uC124\uC545\uC0B0", "\uACE0", "A", "\uC124\uC545\uC0B0"],
        ["w0897", "\uC601\uAD6D", "\uACE0", "A", "\uC601\uAD6D"],
        ["w0898", "\uC778\uCC9C", "\uACE0", "A", "\uC778\uCC9C"],
        ["w0899", "\uC77C\uBCF8", "\uACE0", "A", "\uC77C\uBCF8"],
        ["w0900", "\uC81C\uC8FC\uB3C4", "\uACE0", "A", "\uC81C\uC8FC\uB3C4"],
        ["w0901", "\uC911\uAD6D", "\uACE0", "A", "\uC911\uAD6D"],
        ["w0902", "\uCE90\uB098\uB2E4", "\uACE0", "A", "\uCE90\uB098\uB2E4"],
        ["w0903", "\uD504\uB791\uC2A4", "\uACE0", "A", "\uD504\uB791\uC2A4"],
        ["w0904", "\uD55C\uAC15", "\uACE0", "A", "\uD55C\uAC15"],
        ["w0905", "\uD55C\uAD6D", "\uACE0", "A", "\uD55C\uAD6D"],
        ["w0906", "\uD638\uC8FC", "\uACE0", "A", "\uD638\uC8FC"],
        ["w0907", "\uB4F1", "\uC758", "B", "\uB4F105"],
        ["w0908", "\uB300\uD558\uB2E4", "\uB3D9", "B", "\uB300\uD558\uB2E402"],
        ["w0909", "\uC704\uD558\uB2E4", "\uB3D9", "B", "\uC704\uD558\uB2E401"],
        ["w0910", "\uC0AC\uD68C", "\uBA85", "B", "\uC0AC\uD68C07"],
        ["w0911", "\uB530\uB974\uB2E4", "\uB3D9", "B", "\uB530\uB974\uB2E401"],
        ["w0912", "\uADF8\uB7F0", "\uAD00", "B", "\uADF8\uB7F001"],
        ["w0913", "\uB370", "\uC758", "B", "\uB37001"],
        ["w0914", "\uACBD\uC6B0", "\uBA85", "B", "\uACBD\uC6B003"],
        ["w0915", "\uC911", "\uC758", "B", "\uC91104"],
        ["w0916", "\uC790\uC2E0", "\uBA85", "B", "\uC790\uC2E001"],
        ["w0917", "\uBB38\uD654", "\uBA85", "B", "\uBB38\uD65401"],
        ["w0918", "\uD1B5\uD558\uB2E4", "\uB3D9", "B", "\uD1B5\uD558\uB2E4"],
        ["w0919", "\uC18C\uB9AC", "\uBA85", "B", "\uC18C\uB9AC01"],
        ["w0920", "\uC815\uB3C4", "\uBA85", "B", "\uC815\uB3C411"],
        ["w0921", "\uBCF4\uC774\uB2E4", "\uB3D9", "B", "\uBCF4\uC774\uB2E401"],
        ["w0922", "\uC9C0\uB098\uB2E4", "\uB3D9", "B", "\uC9C0\uB098\uB2E4"],
        ["w0923", "\uC778\uAC04", "\uBA85", "B", "\uC778\uAC0401"],
        ["w0924", "\uC0AC\uC2E4", "\uBA85", "B", "\uC0AC\uC2E404"],
        ["w0925", "\uC810", "\uBA85", "B", "\uC81010"],
        ["w0926", "\uC758\uD558\uB2E4", "\uB3D9", "B", "\uC758\uD558\uB2E401"],
        ["w0927", "\uC2DC\uB300", "\uBA85", "B", "\uC2DC\uB30002"],
        ["w0928", "\uC774\uB7EC\uD558\uB2E4", "\uD615", "B", "\uC774\uB7EC\uD558\uB2E4"],
        ["w0929", "\uC138\uACC4", "\uBA85", "B", "\uC138\uACC402"],
        ["w0930", "\uC790\uAE30", "\uB300", "B", "\uC790\uAE3004"],
        ["w0931", "\uB300\uD1B5\uB839", "\uBA85", "B", "\uB300\uD1B5\uB839"],
        ["w0932", "\uAC00\uC9C0", "\uC758", "B", "\uAC00\uC9C004"],
        ["w0933", "\uAD6D\uAC00", "\uBA85", "B", "\uAD6D\uAC0001"],
        ["w0934", "\uC5EC\uC131", "\uBA85", "B", "\uC5EC\uC13101"],
        ["w0935", "\uAD00\uACC4", "\uBA85", "B", "\uAD00\uACC405"],
        ["w0936", "\uB098\uD0C0\uB098\uB2E4", "\uB3D9", "B", "\uB098\uD0C0\uB098\uB2E4"],
        ["w0937", "\uC9C0\uC5ED", "\uBA85", "B", "\uC9C0\uC5ED03"],
        ["w0938", "\uBAA8\uC2B5", "\uBA85", "B", "\uBAA8\uC2B501"],
        ["w0939", "\uC5C6\uC774", "\uBD80", "B", "\uC5C6\uC774"],
        ["w0940", "\uBFD0", "\uC758", "B", "\uBFD001"],
        ["w0941", "\uBC29\uBC95", "\uBA85", "B", "\uBC29\uBC95"],
        ["w0942", "\uAC16\uB2E4", "\uB3D9", "B", "\uAC16\uB2E401"],
        ["w0943", "\uD2B9\uD788", "\uBD80", "B", "\uD2B9\uD788"],
        ["w0944", "\uC774\uC0C1", "\uBA85", "B", "\uC774\uC0C105"],
        ["w0945", "\uAD50\uC721", "\uBA85", "B", "\uAD50\uC721"],
        ["w0946", "\uACBD\uC81C", "\uBA85", "B", "\uACBD\uC81C04"],
        ["w0947", "\uC608\uC220", "\uBA85", "B", "\uC608\uC220"],
        ["w0948", "\uACB0\uACFC", "\uBA85", "B", "\uACB0\uACFC02"],
        ["w0949", "\uB0B4\uC6A9", "\uBA85", "B", "\uB0B4\uC6A902"],
        ["w0950", "\uB2F9\uC2E0", "\uB300", "B", "\uB2F9\uC2E002"],
        ["w0951", "\uB290\uB07C\uB2E4", "\uB3D9", "B", "\uB290\uB07C\uB2E402"],
        ["w0952", "\uC758\uBBF8", "\uBA85", "B", "\uC758\uBBF802"],
        ["w0953", "\uBC1D\uD788\uB2E4", "\uB3D9", "B", "\uBC1D\uD788\uB2E4"],
        ["w0954", "\uC774\uBBF8", "\uBD80", "B", "\uC774\uBBF801"],
        ["w0955", "\uC815\uCE58", "\uBA85", "B", "\uC815\uCE5803"],
        ["w0956", "\uAD6D\uBBFC", "\uBA85", "B", "\uAD6D\uBBFC"],
        ["w0957", "\uC5F0\uAD6C", "\uBA85", "B", "\uC5F0\uAD6C03"],
        ["w0958", "\uBC0F", "\uBD80", "B", "\uBC0F"],
        ["w0959", "\uC9D3\uB2E4", "\uB3D9", "B", "\uC9D3\uB2E401"],
        ["w0960", "\uB610\uD55C", "\uBD80", "B", "\uB610\uD55C"],
        ["w0961", "\uC774\uC720", "\uBA85", "B", "\uC774\uC72004"],
        ["w0962", "\uB610\uB294", "\uBD80", "B", "\uB610\uB294"],
        ["w0963", "\uAE00", "\uBA85", "B", "\uAE00"],
        ["w0964", "\uC138\uC0C1", "\uBA85", "B", "\uC138\uC0C101"],
        ["w0965", "\uB450\uB2E4", "\uB3D9", "B", "\uB450\uB2E401"],
        ["w0966", "\uC989", "\uBD80", "B", "\uC98901"],
        ["w0967", "\uC774\uD6C4", "\uBA85", "B", "\uC774\uD6C402"],
        ["w0968", "\uBB38\uD559", "\uBA85", "B", "\uBB38\uD55901"],
        ["w0969", "\uC9C0\uBC29", "\uBA85", "B", "\uC9C0\uBC2905"],
        ["w0970", "\uCD5C\uADFC", "\uBA85", "B", "\uCD5C\uADFC"],
        ["w0971", "\uD658\uACBD", "\uBA85", "B", "\uD658\uACBD02"],
        ["w0972", "\uC790\uCCB4", "\uBA85", "B", "\uC790\uCCB402"],
        ["w0973", "\uB0A8\uB2E4", "\uB3D9", "B", "\uB0A8\uB2E401"],
        ["w0974", "\uBD80\uBD84", "\uBA85", "B", "\uBD80\uBD8401"],
        ["w0975", "\uBCC0\uD654", "\uBA85", "B", "\uBCC0\uD654"],
        ["w0976", "\uB73B", "\uBA85", "B", "\uB73B"],
        ["w0977", "\uB5A8\uC5B4\uC9C0\uB2E4", "\uB3D9", "B", "\uB5A8\uC5B4\uC9C0\uB2E4"],
        ["w0978", "\uAD00\uD558\uB2E4", "\uB3D9", "B", "\uAD00\uD558\uB2E402"],
        ["w0979", "\uADF8\uB0E5", "\uBD80", "B", "\uADF8\uB0E5"],
        ["w0980", "\uB098\uB204\uB2E4", "\uB3D9", "B", "\uB098\uB204\uB2E4"],
        ["w0981", "\uC774\uC6A9\uD558\uB2E4", "\uB3D9", "B", "\uC774\uC6A9\uD558\uB2E401"],
        ["w0982", "\uAC70\uC758", "\uBD80", "B", "\uAC70\uC75801"],
        ["w0983", "\uC911\uC2EC", "\uBA85", "B", "\uC911\uC2EC01"],
        ["w0984", "\uD65C\uB3D9", "\uBA85", "B", "\uD65C\uB3D902"],
        ["w0985", "\uAD00\uC2EC", "\uBA85", "B", "\uAD00\uC2EC01"],
        ["w0986", "\uC5ED\uC2DC", "\uBD80", "B", "\uC5ED\uC2DC01"],
        ["w0987", "\uC560", "\uBA85", "B", "\uC56002"],
        ["w0988", "\uAD11\uACE0", "\uBA85", "B", "\uAD11\uACE002"],
        ["w0989", "\uC815\uC2E0", "\uBA85", "B", "\uC815\uC2E012"],
        ["w0990", "\uC774\uB974\uB2E4", "\uB3D9", "B", "\uC774\uB974\uB2E401"],
        ["w0991", "\uB545", "\uBA85", "B", "\uB54501"],
        ["w0992", "\uC774\uB8E8\uB2E4", "\uB3D9", "B", "\uC774\uB8E8\uB2E401"],
        ["w0993", "\uAE30\uC220", "\uBA85", "B", "\uAE30\uC22001"],
        ["w0994", "\uC804\uCCB4", "\uBA85", "B", "\uC804\uCCB401"],
        ["w0995", "\uC5BB\uB2E4", "\uB3D9", "B", "\uC5BB\uB2E401"],
        ["w0996", "\uBBFC\uC871", "\uBA85", "B", "\uBBFC\uC871"],
        ["w0997", "\uAC04", "\uC758", "B", "\uAC0410"],
        ["w0998", "\uC870\uC0AC", "\uBA85", "B", "\uC870\uC0AC30"],
        ["w0999", "\uADF8\uB300\uB85C", "\uBD80", "B", "\uADF8\uB300\uB85C"],
        ["w1000", "\uC904", "\uC758", "B", "\uC90404"],
        ["w1001", "\uB144\uB300", "\uC758", "B", "\uB144\uB300"],
        ["w1002", "\uACFC\uD559", "\uBA85", "B", "\uACFC\uD559"],
        ["w1003", "\uC790\uC5F0", "\uBA85", "B", "\uC790\uC5F001"],
        ["w1004", "\uACB0\uAD6D", "\uBA85", "B", "\uACB0\uAD6D"],
        ["w1005", "\uD504\uB85C\uADF8\uB7A8", "\uBA85", "B", "\uD504\uB85C\uADF8\uB7A8"],
        ["w1006", "\uC774\uB8E8\uC5B4\uC9C0\uB2E4", "\uB3D9", "B", "\uC774\uB8E8\uC5B4\uC9C0\uB2E4"],
        ["w1007", "\uD558\uB8E8", "\uBA85", "B", "\uD558\uB8E801"],
        ["w1008", "\uC801", "\uC758", "B", "\uC80103"],
        ["w1009", "\uD130", "\uC758", "B", "\uD13002"],
        ["w1010", "\uB9DE\uB2E4", "\uB3D9", "B", "\uB9DE\uB2E401"],
        ["w1011", "\uAC78\uB9AC\uB2E4", "\uB3D9", "B", "\uAC78\uB9AC\uB2E401"],
        ["w1012", "\uC9C0\uD0A4\uB2E4", "\uB3D9", "B", "\uC9C0\uD0A4\uB2E401"],
        ["w1013", "\uBC14\uB77C\uBCF4\uB2E4", "\uB3D9", "B", "\uBC14\uB77C\uBCF4\uB2E4"],
        ["w1014", "\uB300\uBD80\uBD84", "\uBA85", "B", "\uB300\uBD80\uBD84"],
        ["w1015", "\uD45C\uC815", "\uBA85", "B", "\uD45C\uC81503"],
        ["w1016", "\uC77C\uBD80", "\uBA85", "B", "\uC77C\uBD8002"],
        ["w1017", "\uB290\uB08C", "\uBA85", "B", "\uB290\uB08C"],
        ["w1018", "\uACE0\uAC1C", "\uBA85", "B", "\uACE0\uAC1C01"],
        ["w1019", "\uC131\uACA9", "\uBA85", "B", "\uC131\uACA902"],
        ["w1020", "\uC138\uAE30", "\uBA85", "B", "\uC138\uAE3003"],
        ["w1021", "\uC138\uC6B0\uB2E4", "\uB3D9", "B", "\uC138\uC6B0\uB2E401"],
        ["w1022", "\uD604\uC7AC", "\uBD80", "B", "\uD604\uC7AC02"],
        ["w1023", "\uBC1C\uC804", "\uBA85", "B", "\uBC1C\uC80401"],
        ["w1024", "\uD5A5\uD558\uB2E4", "\uB3D9", "B", "\uD5A5\uD558\uB2E4"],
        ["w1025", "\uAD00\uB828", "\uBA85", "B", "\uAD00\uB828"],
        ["w1026", "\uAC01", "\uAD00", "B", "\uAC0101"],
        ["w1027", "\uBD84\uC704\uAE30", "\uBA85", "B", "\uBD84\uC704\uAE30"],
        ["w1028", "\uADF8\uB7EC\uD558\uB2E4", "\uD615", "B", "\uADF8\uB7EC\uD558\uB2E4"],
        ["w1029", "\uC6B0\uC120", "\uBD80", "B", "\uC6B0\uC12002"],
        ["w1030", "\uBBFF\uB2E4", "\uB3D9", "B", "\uBBFF\uB2E4"],
        ["w1031", "\uB0B3\uB2E4", "\uB3D9", "B", "\uB0B3\uB2E401"],
        ["w1032", "\uC815\uBCF4", "\uBA85", "B", "\uC815\uBCF406"],
        ["w1033", "\uC5F4\uB9AC\uB2E4", "\uB3D9", "B", "\uC5F4\uB9AC\uB2E402"],
        ["w1034", "\uB9CC\uD07C", "\uC758", "B", "\uB9CC\uD07C"],
        ["w1035", "\uC5ED\uD560", "\uBA85", "B", "\uC5ED\uD560"],
        ["w1036", "\uD589\uB3D9", "\uBA85", "B", "\uD589\uB3D9"],
        ["w1037", "\uAD6D\uB0B4", "\uBA85", "B", "\uAD6D\uB0B402"],
        ["w1038", "\uB098\uC11C\uB2E4", "\uB3D9", "B", "\uB098\uC11C\uB2E4"],
        ["w1039", "\uD750\uB974\uB2E4", "\uB3D9", "B", "\uD750\uB974\uB2E401"],
        ["w1040", "\uAE4A\uB2E4", "\uD615", "B", "\uAE4A\uB2E4"],
        ["w1041", "\uBAA8\uC591", "\uBA85", "B", "\uBAA8\uC59102"],
        ["w1042", "\uC870\uAC74", "\uBA85", "B", "\uC870\uAC7402"],
        ["w1043", "\uB118\uB2E4", "\uB3D9", "B", "\uB118\uB2E401"],
        ["w1044", "\uB9C8\uC744", "\uBA85", "B", "\uB9C8\uC74401"],
        ["w1045", "\uC5B4\uB9AC\uB2E4", "\uD615", "B", "\uC5B4\uB9AC\uB2E403"],
        ["w1046", "\uB300\uD45C", "\uBA85", "B", "\uB300\uD45C"],
        ["w1047", "\uAC00\uB2A5\uC131", "\uBA85", "B", "\uAC00\uB2A5\uC131"],
        ["w1048", "\uBC29\uD5A5", "\uBA85", "B", "\uBC29\uD5A501"],
        ["w1049", "\uB300\uD68C", "\uBA85", "B", "\uB300\uD68C02"],
        ["w1050", "\uBAA9\uC18C\uB9AC", "\uBA85", "B", "\uBAA9\uC18C\uB9AC"],
        ["w1051", "\uC6C0\uC9C1\uC774\uB2E4", "\uB3D9", "B", "\uC6C0\uC9C1\uC774\uB2E4"],
        ["w1052", "\uB178\uB825", "\uBA85", "B", "\uB178\uB82501"],
        ["w1053", "\uC804\uD600", "\uBD80", "B", "\uC804\uD60001"],
        ["w1054", "\uB2E8\uCCB4", "\uBA85", "B", "\uB2E8\uCCB402"],
        ["w1055", "\uC54C\uB824\uC9C0\uB2E4", "\uB3D9", "B", "\uC54C\uB824\uC9C0\uB2E4"],
        ["w1056", "\uAC00\uB2A5\uD558\uB2E4", "\uD615", "B", "\uAC00\uB2A5\uD558\uB2E4"],
        ["w1057", "\uB2A5\uB825", "\uBA85", "B", "\uB2A5\uB82502"],
        ["w1058", "\uC8FC\uC7A5\uD558\uB2E4", "\uB3D9", "B", "\uC8FC\uC7A5\uD558\uB2E401"],
        ["w1059", "\uC790\uC2DD", "\uBA85", "B", "\uC790\uC2DD01"],
        ["w1060", "\uB3CC\uB9AC\uB2E4", "\uB3D9", "B", "\uB3CC\uB9AC\uB2E404"],
        ["w1061", "\uBAA8\uC73C\uB2E4", "\uB3D9", "B", "\uBAA8\uC73C\uB2E4"],
        ["w1062", "\uC790\uB8CC", "\uBA85", "B", "\uC790\uB8CC03"],
        ["w1063", "\uC81C\uD488", "\uBA85", "B", "\uC81C\uD48802"],
        ["w1064", "\uC0AC\uC5C5", "\uBA85", "B", "\uC0AC\uC5C504"],
        ["w1065", "\uC9C0\uB09C\uD574", "\uBA85", "B", "\uC9C0\uB09C\uD574"],
        ["w1066", "\uD45C\uD604", "\uBA85", "B", "\uD45C\uD604"],
        ["w1067", "\uC80A\uB2E4", "\uD615", "B", "\uC80A\uB2E4"],
        ["w1068", "\uB3D9\uC2DC", "\uBA85", "B", "\uB3D9\uC2DC02"],
        ["w1069", "\uC21C\uAC04", "\uBA85", "B", "\uC21C\uAC0403"],
        ["w1070", "\uC804\uC7C1", "\uBA85", "B", "\uC804\uC7C1"],
        ["w1071", "\uBC29\uC1A1", "\uBA85", "B", "\uBC29\uC1A101"],
        ["w1072", "\uB9C8\uCC2C\uAC00\uC9C0", "\uBA85", "B", "\uB9C8\uCC2C\uAC00\uC9C0"],
        ["w1073", "\uACFC\uAC70", "\uBA85", "B", "\uACFC\uAC7003"],
        ["w1074", "\uD604\uB300", "\uBA85", "B", "\uD604\uB30001"],
        ["w1075", "\uC0B4\uD3B4\uBCF4\uB2E4", "\uB3D9", "B", "\uC0B4\uD3B4\uBCF4\uB2E4"],
        ["w1076", "\uCC28\uC774", "\uBA85", "B", "\uCC28\uC774"],
        ["w1077", "\uD480\uB2E4", "\uB3D9", "B", "\uD480\uB2E4"],
        ["w1078", "\uC2DC\uC808", "\uBA85", "B", "\uC2DC\uC80801"],
        ["w1079", "\uC9C1\uC811", "\uBD80", "B", "\uC9C1\uC811"],
        ["w1080", "\uAC1C\uC778", "\uBA85", "B", "\uAC1C\uC77802"],
        ["w1081", "\uADFC\uB370", "\uBD80", "B", "\uADFC\uB37001"],
        ["w1082", "\uC791\uAC00", "\uBA85", "B", "\uC791\uAC0001"],
        ["w1083", "\uD6A8\uACFC", "\uBA85", "B", "\uD6A8\uACFC01"],
        ["w1084", "\uBD88\uAD50", "\uBA85", "B", "\uBD88\uAD50"],
        ["w1085", "\uB04C\uB2E4", "\uB3D9", "B", "\uB04C\uB2E4"],
        ["w1086", "\uB9C8\uCE58", "\uBD80", "B", "\uB9C8\uCE5803"],
        ["w1087", "\uBC14\uB77C\uB2E4", "\uB3D9", "B", "\uBC14\uB77C\uB2E401"],
        ["w1088", "\uAC15\uD558\uB2E4", "\uD615", "B", "\uAC15\uD558\uB2E402"],
        ["w1089", "\uACBD\uD5D8", "\uBA85", "B", "\uACBD\uD5D8"],
        ["w1090", "\uCD5C\uACE0", "\uBA85", "B", "\uCD5C\uACE002"],
        ["w1091", "\uB098\uD0C0\uB0B4\uB2E4", "\uB3D9", "B", "\uB098\uD0C0\uB0B4\uB2E4"],
        ["w1092", "\uB2E4\uC591\uD558\uB2E4", "\uD615", "B", "\uB2E4\uC591\uD558\uB2E401"],
        ["w1093", "\uBC95", "\uBA85", "B", "\uBC9501"],
        ["w1094", "\uC18C\uC124", "\uBA85", "B", "\uC18C\uC12403"],
        ["w1095", "\uC9C8\uC11C", "\uBA85", "B", "\uC9C8\uC11C03"],
        ["w1096", "\uB2F4\uB2E4", "\uB3D9", "B", "\uB2F4\uB2E401"],
        ["w1097", "\uBAA8\uC774\uB2E4", "\uB3D9", "B", "\uBAA8\uC774\uB2E401"],
        ["w1098", "\uC2DC\uBBFC", "\uBA85", "B", "\uC2DC\uBBFC"],
        ["w1099", "\uD68C\uC7A5", "\uBA85", "B", "\uD68C\uC7A507"],
        ["w1100", "\uC2A4\uC2A4\uB85C", "\uBD80", "B", "\uC2A4\uC2A4\uB85C"],
        ["w1101", "\uC774\uB0A0", "\uBA85", "B", "\uC774\uB0A0"],
        ["w1102", "\uC81C\uB300\uB85C", "\uBD80", "B", "\uC81C\uB300\uB85C"],
        ["w1103", "\uB358\uC9C0\uB2E4", "\uB3D9", "B", "\uB358\uC9C0\uB2E4"],
        ["w1104", "\uACF5\uAC04", "\uBA85", "B", "\uACF5\uAC0405"],
        ["w1105", "\uBC8C\uC774\uB2E4", "\uB3D9", "B", "\uBC8C\uC774\uB2E4"],
        ["w1106", "\uAC15\uC870\uD558\uB2E4", "\uB3D9", "B", "\uAC15\uC870\uD558\uB2E4"],
        ["w1107", "\uB9E1\uB2E4", "\uB3D9", "B", "\uB9E1\uB2E401"],
        ["w1108", "\uD55C\uD3B8", "\uBD80", "B", "\uD55C\uD3B8"],
        ["w1109", "\uAE30\uC790", "\uBA85", "B", "\uAE30\uC79005"],
        ["w1110", "\uC8FC\uB85C", "\uBD80", "B", "\uC8FC\uB85C01"],
        ["w1111", "\uD6E8\uC52C", "\uBD80", "B", "\uD6E8\uC52C"],
        ["w1112", "\uD1B5\uC77C", "\uBA85", "B", "\uD1B5\uC77C02"],
        ["w1113", "\uB4E4\uC5B4\uC11C\uB2E4", "\uB3D9", "B", "\uB4E4\uC5B4\uC11C\uB2E4"],
        ["w1114", "\uC2DC\uC124", "\uBA85", "B", "\uC2DC\uC12403"],
        ["w1115", "\uC8FC\uBCC0", "\uBA85", "B", "\uC8FC\uBCC004"],
        ["w1116", "\uB300\uC2E0", "\uBA85", "B", "\uB300\uC2E003"],
        ["w1117", "\uCC28\uB840", "\uBA85", "B", "\uCC28\uB84001"],
        ["w1118", "\uAD70", "\uBA85", "B", "\uAD7005"],
        ["w1119", "\uC7AC\uC0B0", "\uBA85", "B", "\uC7AC\uC0B0"],
        ["w1120", "\uC57D\uAC04", "\uBD80", "B", "\uC57D\uAC04"],
        ["w1121", "\uC694\uAD6C\uD558\uB2E4", "\uB3D9", "B", "\uC694\uAD6C\uD558\uB2E4"],
        ["w1122", "\uCCAB", "\uAD00", "B", "\uCCAB"],
        ["w1123", "\uAE30\uAC04", "\uBA85", "B", "\uAE30\uAC0407"],
        ["w1124", "\uC77C\uC73C\uD0A4\uB2E4", "\uB3D9", "B", "\uC77C\uC73C\uD0A4\uB2E4"],
        ["w1125", "\uACF5\uC7A5", "\uBA85", "B", "\uACF5\uC7A502"],
        ["w1126", "\uC990\uAE30\uB2E4", "\uB3D9", "B", "\uC990\uAE30\uB2E401"],
        ["w1127", "\uC9C0", "\uC758", "B", "\uC9C002"],
        ["w1128", "\uBCC0\uD558\uB2E4", "\uB3D9", "B", "\uBCC0\uD558\uB2E4"],
        ["w1129", "\uC0AC\uACE0", "\uBA85", "B", "\uC0AC\uACE012"],
        ["w1130", "\uADF8\uB798\uB3C4", "\uBD88", "B", "\uADF8\uB798\uB3C4"],
        ["w1131", "\uC544\uBB34\uB9AC", "\uBD80", "B", "\uC544\uBB34\uB9AC"],
        ["w1132", "\uB9DE\uCD94\uB2E4", "\uB3D9", "B", "\uB9DE\uCD94\uB2E401"],
        ["w1133", "\uC300", "\uBA85", "B", "\uC300"],
        ["w1134", "\uC77C\uBC18", "\uBA85", "B", "\uC77C\uBC1802"],
        ["w1135", "\uB9C9\uB2E4", "\uB3D9", "B", "\uB9C9\uB2E401"],
        ["w1136", "\uBD99\uC774\uB2E4", "\uB3D9", "B", "\uBD99\uC774\uB2E4"],
        ["w1137", "\uB298", "\uBD80", "B", "\uB298"],
        ["w1138", "\uC804\uAD6D", "\uBA85", "B", "\uC804\uAD6D03"],
        ["w1139", "\uB9C8\uCE58\uB2E4", "\uB3D9", "B", "\uB9C8\uCE58\uB2E402"],
        ["w1140", "\uB3C4\uC6C0", "\uBA85", "B", "\uB3C4\uC6C0"],
        ["w1141", "\uAC00\uC815", "\uBA85", "B", "\uAC00\uC81506"],
        ["w1142", "\uBE60\uC9C0\uB2E4", "\uB3D9", "B", "\uBE60\uC9C0\uB2E402"],
        ["w1143", "\uC624\uB298\uB0A0", "\uBA85", "B", "\uC624\uB298\uB0A0"],
        ["w1144", "\uB18D\uC5C5", "\uBA85", "B", "\uB18D\uC5C5"],
        ["w1145", "\uC2DD", "\uC758", "B", "\uC2DD04"],
        ["w1146", "\uC758\uACAC", "\uBA85", "B", "\uC758\uACAC01"],
        ["w1147", "\uD45C\uD604\uD558\uB2E4", "\uB3D9", "B", "\uD45C\uD604\uD558\uB2E4"],
        ["w1148", "\uC774\uC0C1\uD558\uB2E4", "\uD615", "B", "\uC774\uC0C1\uD558\uB2E4"],
        ["w1149", "\uBD99\uB2E4", "\uB3D9", "B", "\uBD99\uB2E4"],
        ["w1150", "\uACBD\uAE30", "\uBA85", "B", "\uACBD\uAE3011"],
        ["w1151", "\uBAA9\uC801", "\uBA85", "B", "\uBAA9\uC80103"],
        ["w1152", "\uD0DC\uB3C4", "\uBA85", "B", "\uD0DC\uB3C403"],
        ["w1153", "\uB0A8\uC131", "\uBA85", "B", "\uB0A8\uC13101"],
        ["w1154", "\uC8FC\uC704", "\uBA85", "B", "\uC8FC\uC70402"],
        ["w1155", "\uADF8\uB9CC", "\uBD80", "B", "\uADF8\uB9CC02"],
        ["w1156", "\uBC1C\uC0DD\uD558\uB2E4", "\uB3D9", "B", "\uBC1C\uC0DD\uD558\uB2E4"],
        ["w1157", "\uC5B4\uCA4C\uB2E4", "\uB3D9", "B", "\uC5B4\uCA4C\uB2E401"],
        ["w1158", "\uC7AC\uB8CC", "\uBA85", "B", "\uC7AC\uB8CC01"],
        ["w1159", "\uAC01\uAC01", "\uBD80", "B", "\uAC01\uAC0101"],
        ["w1160", "\uC62E\uAE30\uB2E4", "\uB3D9", "B", "\uC62E\uAE30\uB2E4"],
        ["w1161", "\uC790\uC720", "\uBA85", "B", "\uC790\uC72003"],
        ["w1162", "\uCC45\uC784", "\uBA85", "B", "\uCC45\uC784"],
        ["w1163", "\uBC14\uB00C\uB2E4", "\uB3D9", "B", "\uBC14\uB00C\uB2E4"],
        ["w1164", "\uC2EC\uD558\uB2E4", "\uD615", "B", "\uC2EC\uD558\uB2E4"],
        ["w1165", "\uC790\uB77C\uB2E4", "\uB3D9", "B", "\uC790\uB77C\uB2E401"],
        ["w1166", "\uAD6C\uCCB4\uC801", "\uBA85", "B", "\uAD6C\uCCB4\uC801"],
        ["w1167", "\uAE30\uD68C", "\uBA85", "B", "\uAE30\uD68C03"],
        ["w1168", "\uC9C0\uAD6C", "\uBA85", "B", "\uC9C0\uAD6C04"],
        ["w1169", "\uBC88\uC9F8", "\uC758", "B", "\uBC88\uC9F8"],
        ["w1170", "\uC18C\uBE44\uC790", "\uBA85", "B", "\uC18C\uBE44\uC790"],
        ["w1171", "\uAE30\uC900", "\uBA85", "B", "\uAE30\uC90003"],
        ["w1172", "\uBC18\uB4DC\uC2DC", "\uBD80", "B", "\uBC18\uB4DC\uC2DC"],
        ["w1173", "\uBC1B\uC544\uB4E4\uC774\uB2E4", "\uB3D9", "B", "\uBC1B\uC544\uB4E4\uC774\uB2E4"],
        ["w1174", "\uAEBC\uB0B4\uB2E4", "\uB3D9", "B", "\uAEBC\uB0B4\uB2E4"],
        ["w1175", "\uB178\uB3D9\uC790", "\uBA85", "B", "\uB178\uB3D9\uC790"],
        ["w1176", "\uB3D9\uB124", "\uBA85", "B", "\uB3D9\uB124"],
        ["w1177", "\uC644\uC804\uD788", "\uBD80", "B", "\uC644\uC804\uD788"],
        ["w1178", "\uC804\uD558\uB2E4", "\uB3D9", "B", "\uC804\uD558\uB2E4"],
        ["w1179", "\uBCC4\uB85C", "\uBD80", "B", "\uBCC4\uB85C01"],
        ["w1180", "\uC815\uD558\uB2E4", "\uB3D9", "B", "\uC815\uD558\uB2E403"],
        ["w1181", "\uB300\uC911", "\uBA85", "B", "\uB300\uC91102"],
        ["w1182", "\uB298\uC5B4\uB098\uB2E4", "\uB3D9", "B", "\uB298\uC5B4\uB098\uB2E4"],
        ["w1183", "\uAC01\uC885", "\uBA85", "B", "\uAC01\uC885"],
        ["w1184", "\uBE5B", "\uBA85", "B", "\uBE5B"],
        ["w1185", "\uC57C", "\uAC10", "B", "\uC57C04"],
        ["w1186", "\uBC1C\uACAC\uD558\uB2E4", "\uB3D9", "B", "\uBC1C\uACAC\uD558\uB2E401"],
        ["w1187", "\uD2B9\uC9D5", "\uBA85", "B", "\uD2B9\uC9D5"],
        ["w1188", "\uC120\uC218", "\uBA85", "B", "\uC120\uC21805"],
        ["w1189", "\uB9C8\uB828\uD558\uB2E4", "\uB3D9", "B", "\uB9C8\uB828\uD558\uB2E4"],
        ["w1190", "\uBC1C\uD45C\uD558\uB2E4", "\uB3D9", "B", "\uBC1C\uD45C\uD558\uB2E4"],
        ["w1191", "\uC8FC\uC81C", "\uBA85", "B", "\uC8FC\uC81C04"],
        ["w1192", "\uAE30\uBCF8", "\uBA85", "B", "\uAE30\uBCF8"],
        ["w1193", "\uC0AC\uB77C\uC9C0\uB2E4", "\uB3D9", "B", "\uC0AC\uB77C\uC9C0\uB2E4"],
        ["w1194", "\uAC10\uC815", "\uBA85", "B", "\uAC10\uC81506"],
        ["w1195", "\uAE30\uC5B5", "\uBA85", "B", "\uAE30\uC5B502"],
        ["w1196", "\uC778\uAE30", "\uBA85", "B", "\uC778\uAE3001"],
        ["w1197", "\uAD00\uB9AC", "\uBA85", "B", "\uAD00\uB9AC04"],
        ["w1198", "\uB4E4\uB9AC\uB2E4", "\uB3D9", "B", "\uB4E4\uB9AC\uB2E403"],
        ["w1199", "\uB2EC\uB9AC\uB2E4", "\uB3D9", "B", "\uB2EC\uB9AC\uB2E404"],
        ["w1200", "\uC774\uC804", "\uBA85", "B", "\uC774\uC80403"],
        ["w1201", "\uC2DC\uD0A4\uB2E4", "\uB3D9", "B", "\uC2DC\uD0A4\uB2E401"],
        ["w1202", "\uAD6D\uC81C", "\uBA85", "B", "\uAD6D\uC81C02"],
        ["w1203", "\uADF8\uB8F9", "\uBA85", "B", "\uADF8\uB8F901"],
        ["w1204", "\uC778\uC0DD", "\uBA85", "B", "\uC778\uC0DD01"],
        ["w1205", "\uC804\uD1B5", "\uBA85", "B", "\uC804\uD1B506"],
        ["w1206", "\uAE30\uB974\uB2E4", "\uB3D9", "B", "\uAE30\uB974\uB2E4"],
        ["w1207", "\uC870\uC0AC\uD558\uB2E4", "\uB3D9", "B", "\uC870\uC0AC\uD558\uB2E412"],
        ["w1208", "\uCEE4\uB2E4\uB797\uB2E4", "\uD615", "B", "\uCEE4\uB2E4\uB797\uB2E4"],
        ["w1209", "\uC2DC\uC778", "\uBA85", "B", "\uC2DC\uC77810"],
        ["w1210", "\uC678", "\uC758", "B", "\uC67804"],
        ["w1211", "\uC704\uCE58", "\uBA85", "B", "\uC704\uCE5801"],
        ["w1212", "\uC904\uC774\uB2E4", "\uB3D9", "B", "\uC904\uC774\uB2E4"],
        ["w1213", "\uB2EC\uB77C\uC9C0\uB2E4", "\uB3D9", "B", "\uB2EC\uB77C\uC9C0\uB2E4"],
        ["w1214", "\uC6D0\uD558\uB2E4", "\uB3D9", "B", "\uC6D0\uD558\uB2E402"],
        ["w1215", "\uD1B5\uC2E0", "\uBA85", "B", "\uD1B5\uC2E001"],
        ["w1216", "\uD655\uC778\uD558\uB2E4", "\uB3D9", "B", "\uD655\uC778\uD558\uB2E4"],
        ["w1217", "\uBAA8\uC784", "\uBA85", "B", "\uBAA8\uC78401"],
        ["w1218", "\uC6C3\uC74C", "\uBA85", "B", "\uC6C3\uC74C"],
        ["w1219", "\uAE30\uACC4", "\uBA85", "B", "\uAE30\uACC407"],
        ["w1220", "\uC544\uB098\uC6B4\uC11C", "\uBA85", "B", "\uC544\uB098\uC6B4\uC11C"],
        ["w1221", "\uD3B4\uB2E4", "\uB3D9", "B", "\uD3B4\uB2E4"],
        ["w1222", "\uC885\uAD50", "\uBA85", "B", "\uC885\uAD50"],
        ["w1223", "\uC790\uC5F0\uC2A4\uB7FD\uB2E4", "\uD615", "B", "\uC790\uC5F0\uC2A4\uB7FD\uB2E4"],
        ["w1224", "\uB3CC\uB2E4", "\uB3D9", "B", "\uB3CC\uB2E4"],
        ["w1225", "\uC774\uD574", "\uBA85", "B", "\uC774\uD57406"],
        ["w1226", "\uD639\uC740", "\uBD80", "B", "\uD639\uC740"],
        ["w1227", "\uD3B8", "\uC758", "B", "\uD3B809"],
        ["w1228", "\uB178\uB825\uD558\uB2E4", "\uB3D9", "B", "\uB178\uB825\uD558\uB2E401"],
        ["w1229", "\uBCF4\uD638", "\uBA85", "B", "\uBCF4\uD63801"],
        ["w1230", "\uC774\uC6C3", "\uBA85", "B", "\uC774\uC6C3"],
        ["w1231", "\uACF5\uB3D9", "\uBA85", "B", "\uACF5\uB3D902"],
        ["w1232", "\uAE4C\uB2ED", "\uBA85", "B", "\uAE4C\uB2ED"],
        ["w1233", "\uC18C\uB140", "\uBA85", "B", "\uC18C\uB14002"],
        ["w1234", "\uC9C0\uB098\uAC00\uB2E4", "\uB3D9", "B", "\uC9C0\uB098\uAC00\uB2E4"],
        ["w1235", "\uC0C1\uD488", "\uBA85", "B", "\uC0C1\uD48803"],
        ["w1236", "\uD6CC\uB96D\uD558\uB2E4", "\uD615", "B", "\uD6CC\uB96D\uD558\uB2E4"],
        ["w1237", "\uC0C8\uB85C", "\uBD80", "B", "\uC0C8\uB85C"],
        ["w1238", "\uC885\uB958", "\uBA85", "B", "\uC885\uB95802"],
        ["w1239", "\uD0A4\uC6B0\uB2E4", "\uB3D9", "B", "\uD0A4\uC6B0\uB2E4"],
        ["w1240", "\uB215\uB2E4", "\uB3D9", "B", "\uB215\uB2E401"],
        ["w1241", "\uBC1C\uB2EC\uD558\uB2E4", "\uB3D9", "B", "\uBC1C\uB2EC\uD558\uB2E4"],
        ["w1242", "\uBC1C\uC804\uD558\uB2E4", "\uB3D9", "B", "\uBC1C\uC804\uD558\uB2E401"],
        ["w1243", "\uC8FD\uC74C", "\uBA85", "B", "\uC8FD\uC74C01"],
        ["w1244", "\uACE0\uD1B5", "\uBA85", "B", "\uACE0\uD1B5"],
        ["w1245", "\uB4EF\uC774", "\uC758", "B", "\uB4EF\uC77401"],
        ["w1246", "\uC5B4\uC6B8\uB9AC\uB2E4", "\uB3D9", "B", "\uC5B4\uC6B8\uB9AC\uB2E4"],
        ["w1247", "\uC54C\uB9AC\uB2E4", "\uB3D9", "B", "\uC54C\uB9AC\uB2E4"],
        ["w1248", "\uBA40\uB9AC", "\uBD80", "B", "\uBA40\uB9AC01"],
        ["w1249", "\uBE7C\uB2E4", "\uB3D9", "B", "\uBE7C\uB2E401"],
        ["w1250", "\uC608\uC815", "\uBA85", "B", "\uC608\uC81502"],
        ["w1251", "\uD754\uD788", "\uBD80", "B", "\uD754\uD788"],
        ["w1252", "\uB290\uAEF4\uC9C0\uB2E4", "\uB3D9", "B", "\uB290\uAEF4\uC9C0\uB2E4"],
        ["w1253", "\uC804\uBB38", "\uBA85", "B", "\uC804\uBB3808"],
        ["w1254", "\uC815\uD655\uD558\uB2E4", "\uD615", "B", "\uC815\uD655\uD558\uB2E401"],
        ["w1255", "\uCC3E\uC544\uC624\uB2E4", "\uB3D9", "B", "\uCC3E\uC544\uC624\uB2E4"],
        ["w1256", "\uC0AC\uC6A9", "\uBA85", "B", "\uC0AC\uC6A904"],
        ["w1257", "\uACB0\uC815\uD558\uB2E4", "\uB3D9", "B", "\uACB0\uC815\uD558\uB2E401"],
        ["w1258", "\uACBD\uC601", "\uBA85", "B", "\uACBD\uC60102"],
        ["w1259", "\uBAA9\uD45C", "\uBA85", "B", "\uBAA9\uD45C"],
        ["w1260", "\uC232", "\uBA85", "B", "\uC23201"],
        ["w1261", "\uC5C6\uC5B4\uC9C0\uB2E4", "\uB3D9", "B", "\uC5C6\uC5B4\uC9C0\uB2E4"],
        ["w1262", "\uB5A0\uC624\uB974\uB2E4", "\uB3D9", "B", "\uB5A0\uC624\uB974\uB2E4"],
        ["w1263", "\uBBF8\uCE58\uB2E4", "\uB3D9", "B", "\uBBF8\uCE58\uB2E402"],
        ["w1264", "\uC0C8\uBCBD", "\uBA85", "B", "\uC0C8\uBCBD01"],
        ["w1265", "\uC5BC\uB978", "\uBD80", "B", "\uC5BC\uB97802"],
        ["w1266", "\uC784\uAE08", "\uBA85", "B", "\uC784\uAE0803"],
        ["w1267", "\uBB34\uC12D\uB2E4", "\uD615", "B", "\uBB34\uC12D\uB2E4"],
        ["w1268", "\uC9C1\uC7A5", "\uBA85", "B", "\uC9C1\uC7A505"],
        ["w1269", "\uCC38\uB2E4", "\uB3D9", "B", "\uCC38\uB2E4"],
        ["w1270", "\uD06C\uAE30", "\uBA85", "B", "\uD06C\uAE30"],
        ["w1271", "\uB0A8\uAE30\uB2E4", "\uB3D9", "B", "\uB0A8\uAE30\uB2E4"],
        ["w1272", "\uC11C\uC591", "\uBA85", "B", "\uC11C\uC591"],
        ["w1273", "\uC8FC\uC694", "\uBA85", "B", "\uC8FC\uC69401"],
        ["w1274", "\uC9C0\uB098\uCE58\uB2E4", "\uD615", "B", "\uC9C0\uB098\uCE58\uB2E4"],
        ["w1275", "\uB0C4\uC0C8", "\uBA85", "B", "\uB0C4\uC0C8"],
        ["w1276", "\uBD80\uB4DC\uB7FD\uB2E4", "\uD615", "B", "\uBD80\uB4DC\uB7FD\uB2E4"],
        ["w1277", "\uACF5\uC5F0", "\uBA85", "B", "\uACF5\uC5F002"],
        ["w1278", "\uB0B4\uB193\uB2E4", "\uB3D9", "B", "\uB0B4\uB193\uB2E4"],
        ["w1279", "\uB5BC\uB2E4", "\uB3D9", "B", "\uB5BC\uB2E401"],
        ["w1280", "\uB9CC\uB4E4\uC5B4\uC9C0\uB2E4", "\uB3D9", "B", "\uB9CC\uB4E4\uC5B4\uC9C0\uB2E4"],
        ["w1281", "\uC18D\uB3C4", "\uBA85", "B", "\uC18D\uB3C401"],
        ["w1282", "\uC2EC\uAC01\uD558\uB2E4", "\uD615", "B", "\uC2EC\uAC01\uD558\uB2E402"],
        ["w1283", "\uACC4\uC18D\uB418\uB2E4", "\uB3D9", "B", "\uACC4\uC18D\uB418\uB2E402"],
        ["w1284", "\uC18C\uB144", "\uBA85", "B", "\uC18C\uB14401"],
        ["w1285", "\uC18C\uC2DD", "\uBA85", "B", "\uC18C\uC2DD04"],
        ["w1286", "\uADF8\uC911", "\uBA85", "B", "\uADF8\uC911"],
        ["w1287", "\uB178\uC778", "\uBA85", "B", "\uB178\uC77801"],
        ["w1288", "\uBC8C\uB2E4", "\uB3D9", "B", "\uBC8C\uB2E402"],
        ["w1289", "\uC0B4\uB9AC\uB2E4", "\uB3D9", "B", "\uC0B4\uB9AC\uB2E4"],
        ["w1290", "\uACB0\uC815", "\uBA85", "B", "\uACB0\uC81501"],
        ["w1291", "\uC370\uB2E4", "\uB3D9", "B", "\uC370\uB2E401"],
        ["w1292", "\uC774\uBBF8\uC9C0", "\uBA85", "B", "\uC774\uBBF8\uC9C0"],
        ["w1293", "\uC5C5\uBB34", "\uBA85", "B", "\uC5C5\uBB3402"],
        ["w1294", "\uCCAD\uC18C\uB144", "\uBA85", "B", "\uCCAD\uC18C\uB144"],
        ["w1295", "\uC751", "\uAC10", "B", "\uC75101"],
        ["w1296", "\uC774\uAE30\uB2E4", "\uB3D9", "B", "\uC774\uAE30\uB2E401"],
        ["w1297", "\uCC3E\uC544\uBCF4\uB2E4", "\uB3D9", "B", "\uCC3E\uC544\uBCF4\uB2E4"],
        ["w1298", "\uCDE8\uD558\uB2E4", "\uB3D9", "B", "\uCDE8\uD558\uB2E401"],
        ["w1299", "\uC120\uBC30", "\uBA85", "B", "\uC120\uBC30"],
        ["w1300", "\uAD6C\uD558\uB2E4", "\uB3D9", "B", "\uAD6C\uD558\uB2E401"],
        ["w1301", "\uADF8\uB7EC\uBBC0\uB85C", "\uBD80", "B", "\uADF8\uB7EC\uBBC0\uB85C"],
        ["w1302", "\uD3EC\uD568\uD558\uB2E4", "\uB3D9", "B", "\uD3EC\uD568\uD558\uB2E402"],
        ["w1303", "\uB9CC\uC57D", "\uBA85", "B", "\uB9CC\uC57D"],
        ["w1304", "\uBC14\uB974\uB2E4", "\uD615", "B", "\uBC14\uB974\uB2E403"],
        ["w1305", "\uC228", "\uBA85", "B", "\uC22801"],
        ["w1306", "\uD589\uC0AC", "\uBA85", "B", "\uD589\uC0AC01"],
        ["w1307", "\uC655", "\uBA85", "B", "\uC65504"],
        ["w1308", "\uC810\uC810", "\uBD80", "B", "\uC810\uC81001"],
        ["w1309", "\uD2B9\uBCC4", "\uBA85", "B", "\uD2B9\uBCC4"],
        ["w1310", "\uD310\uB2E8", "\uBA85", "B", "\uD310\uB2E8"],
        ["w1311", "\uD574\uACB0\uD558\uB2E4", "\uB3D9", "B", "\uD574\uACB0\uD558\uB2E4"],
        ["w1312", "\uACC4\uC18D\uD558\uB2E4", "\uB3D9", "B", "\uACC4\uC18D\uD558\uB2E403"],
        ["w1313", "\uADF8\uCE58\uB2E4", "\uB3D9", "B", "\uADF8\uCE58\uB2E4"],
        ["w1314", "\uB108\uBB34\uB098", "\uBD80", "B", "\uB108\uBB34\uB098"],
        ["w1315", "\uB192\uC774\uB2E4", "\uB3D9", "B", "\uB192\uC774\uB2E4"],
        ["w1316", "\uB9C9", "\uBD80", "B", "\uB9C902"],
        ["w1317", "\uC218\uCD9C", "\uBA85", "B", "\uC218\uCD9C03"],
        ["w1318", "\uC790\uB974\uB2E4", "\uB3D9", "B", "\uC790\uB974\uB2E401"],
        ["w1319", "\uB370\uB9AC\uB2E4", "\uB3D9", "B", "\uB370\uB9AC\uB2E4"],
        ["w1320", "\uBB34\uCC99", "\uBD80", "B", "\uBB34\uCC9901"],
        ["w1321", "\uBE44\uC6A9", "\uBA85", "B", "\uBE44\uC6A903"],
        ["w1322", "\uC633\uB2E4", "\uD615", "B", "\uC633\uB2E401"],
        ["w1323", "\uC6D0\uB798", "\uBA85", "B", "\uC6D0\uB79801"],
        ["w1324", "\uCD5C\uCD08", "\uBA85", "B", "\uCD5C\uCD08"],
        ["w1325", "\uB180\uC774", "\uBA85", "B", "\uB180\uC77401"],
        ["w1326", "\uBFCC\uB9AC", "\uBA85", "B", "\uBFCC\uB9AC"],
        ["w1327", "\uC218\uC785", "\uBA85", "B", "\uC218\uC78502"],
        ["w1328", "\uCD08", "\uC758", "B", "\uCD0803"],
        ["w1329", "\uC9C1\uC6D0", "\uBA85", "B", "\uC9C1\uC6D003"],
        ["w1330", "\uC0C1\uB300", "\uBA85", "B", "\uC0C1\uB30004"],
        ["w1331", "\uD53C\uBD80", "\uBA85", "B", "\uD53C\uBD8002"],
        ["w1332", "\uAC00\uB4DD", "\uBD80", "B", "\uAC00\uB4DD01"],
        ["w1333", "\uBCBD", "\uBA85", "B", "\uBCBD06"],
        ["w1334", "\uC7A5\uAD70", "\uBA85", "B", "\uC7A5\uAD7004"],
        ["w1335", "\uBB34\uC5ED", "\uBA85", "B", "\uBB34\uC5ED02"],
        ["w1336", "\uCCD0\uB2E4\uBCF4\uB2E4", "\uB3D9", "B", "\uCCD0\uB2E4\uBCF4\uB2E4"],
        ["w1337", "\uCDA9\uBD84\uD788", "\uBD80", "B", "\uCDA9\uBD84\uD788"],
        ["w1338", "\uB300", "\uC758", "B", "\uB30015"],
        ["w1339", "\uC2E0\uCCB4", "\uBA85", "B", "\uC2E0\uCCB402"],
        ["w1340", "\uC5D0\uB108\uC9C0", "\uBA85", "B", "\uC5D0\uB108\uC9C0"],
        ["w1341", "\uC815\uB9AC\uD558\uB2E4", "\uB3D9", "B", "\uC815\uB9AC\uD558\uB2E4"],
        ["w1342", "\uC9D1\uC548", "\uBA85", "B", "\uC9D1\uC54801"],
        ["w1343", "\uBC30\uACBD", "\uBA85", "B", "\uBC30\uACBD01"],
        ["w1344", "\uC8FD\uC774\uB2E4", "\uB3D9", "B", "\uC8FD\uC774\uB2E401"],
        ["w1345", "\uB2E8\uC21C\uD558\uB2E4", "\uD615", "B", "\uB2E8\uC21C\uD558\uB2E4"],
        ["w1346", "\uBC18\uB300", "\uBA85", "B", "\uBC18\uB30003"],
        ["w1347", "\uD478\uB974\uB2E4", "\uD615", "B", "\uD478\uB974\uB2E4"],
        ["w1348", "\uAC54", "\uBD88", "B", "\uAC54"],
        ["w1349", "\uBC1C\uD45C", "\uBA85", "B", "\uBC1C\uD45C01"],
        ["w1350", "\uD754\uB4E4\uB2E4", "\uB3D9", "B", "\uD754\uB4E4\uB2E4"],
        ["w1351", "\uAE30\uCD08", "\uBA85", "B", "\uAE30\uCD0806"],
        ["w1352", "\uB4DC\uB77C\uB9C8", "\uBA85", "B", "\uB4DC\uB77C\uB9C8"],
        ["w1353", "\uBF51\uB2E4", "\uB3D9", "B", "\uBF51\uB2E4"],
        ["w1354", "\uBBF8\uB9AC", "\uBD80", "B", "\uBBF8\uB9AC01"],
        ["w1355", "\uBD80\uC871\uD558\uB2E4", "\uD615", "B", "\uBD80\uC871\uD558\uB2E4"],
        ["w1356", "\uC800\uD76C", "\uB300", "B", "\uC800\uD76C01"],
        ["w1357", "\uC9C4\uD589\uB418\uB2E4", "\uB3D9", "B", "\uC9C4\uD589\uB418\uB2E4"],
        ["w1358", "\uC624\uB79C", "\uAD00", "B", "\uC624\uB79C"],
        ["w1359", "\uC80A\uC740\uC774", "\uBA85", "B", "\uC80A\uC740\uC774"],
        ["w1360", "\uACFC\uC81C", "\uBA85", "B", "\uACFC\uC81C04"],
        ["w1361", "\uAE30\uB85D\uD558\uB2E4", "\uB3D9", "B", "\uAE30\uB85D\uD558\uB2E4"],
        ["w1362", "\uB2E4\uAC00\uC624\uB2E4", "\uB3D9", "B", "\uB2E4\uAC00\uC624\uB2E4"],
        ["w1363", "\uC885\uD569", "\uBA85", "B", "\uC885\uD569"],
        ["w1364", "\uAC1C\uBC1C\uD558\uB2E4", "\uB3D9", "B", "\uAC1C\uBC1C\uD558\uB2E4"],
        ["w1365", "\uB5A8\uB2E4", "\uB3D9", "B", "\uB5A8\uB2E401"],
        ["w1366", "\uC790", "\uAC10", "B", "\uC79004"],
        ["w1367", "\uC790\uC720\uB86D\uB2E4", "\uD615", "B", "\uC790\uC720\uB86D\uB2E4"],
        ["w1368", "\uC801\uADF9\uC801", "\uBA85", "B", "\uC801\uADF9\uC801"],
        ["w1369", "\uD310\uB9E4", "\uBA85", "B", "\uD310\uB9E4"],
        ["w1370", "\uAE38\uC774", "\uBA85", "B", "\uAE38\uC77401"],
        ["w1371", "\uC810\uCC28", "\uBD80", "B", "\uC810\uCC2802"],
        ["w1372", "\uD1A4", "\uC758", "B", "\uD1A401"],
        ["w1373", "\uAD00\uB828\uB418\uB2E4", "\uB3D9", "B", "\uAD00\uB828\uB418\uB2E4"],
        ["w1374", "\uB098\uBA38\uC9C0", "\uBA85", "B", "\uB098\uBA38\uC9C0"],
        ["w1375", "\uBBF8\uB798", "\uBA85", "B", "\uBBF8\uB79802"],
        ["w1376", "\uC778\uAD6C", "\uBA85", "B", "\uC778\uAD6C01"],
        ["w1377", "\uAE30\uB300\uD558\uB2E4", "\uB3D9", "B", "\uAE30\uB300\uD558\uB2E4"],
        ["w1378", "\uD758\uB9AC\uB2E4", "\uB3D9", "B", "\uD758\uB9AC\uB2E4"],
        ["w1379", "\uC8FC\uC778\uACF5", "\uBA85", "B", "\uC8FC\uC778\uACF5"],
        ["w1380", "\uB2F9\uC5F0\uD558\uB2E4", "\uD615", "B", "\uB2F9\uC5F0\uD558\uB2E401"],
        ["w1381", "\uB530\uB85C", "\uBD80", "B", "\uB530\uB85C"],
        ["w1382", "\uD615\uB2D8", "\uBA85", "B", "\uD615\uB2D8"],
        ["w1383", "\uB193\uC774\uB2E4", "\uB3D9", "B", "\uB193\uC774\uB2E4"],
        ["w1384", "\uB2F9\uC7A5", "\uBA85", "B", "\uB2F9\uC7A502"],
        ["w1385", "\uBB34\uB835", "\uC758", "B", "\uBB34\uB835"],
        ["w1386", "\uC0AC\uBB3C", "\uBA85", "B", "\uC0AC\uBB3C10"],
        ["w1387", "\uC77C\uBC18\uC801", "\uBA85", "B", "\uC77C\uBC18\uC801"],
        ["w1388", "\uACF1\uB2E4", "\uD615", "B", "\uACF1\uB2E402"],
        ["w1389", "\uBC14\uB2E5", "\uBA85", "B", "\uBC14\uB2E501"],
        ["w1390", "\uC0C8\uB07C", "\uBA85", "B", "\uC0C8\uB07C02"],
        ["w1391", "\uC0DD\uAC01\uB418\uB2E4", "\uB3D9", "B", "\uC0DD\uAC01\uB418\uB2E4"],
        ["w1392", "\uC11C\uBE44\uC2A4", "\uBA85", "B", "\uC11C\uBE44\uC2A4"],
        ["w1393", "\uC120\uD0DD\uD558\uB2E4", "\uB3D9", "B", "\uC120\uD0DD\uD558\uB2E4"],
        ["w1394", "\uC2EC\uB2E4", "\uB3D9", "B", "\uC2EC\uB2E401"],
        ["w1395", "\uAC04\uB2E8\uD558\uB2E4", "\uD615", "B", "\uAC04\uB2E8\uD558\uB2E402"],
        ["w1396", "\uACAC\uB514\uB2E4", "\uB3D9", "B", "\uACAC\uB514\uB2E4"],
        ["w1397", "\uAE30\uC0AC", "\uBA85", "B", "\uAE30\uC0AC10"],
        ["w1398", "\uB9C9\uD788\uB2E4", "\uB3D9", "B", "\uB9C9\uD788\uB2E4"],
        ["w1399", "\uBFCC\uB9AC\uB2E4", "\uB3D9", "B", "\uBFCC\uB9AC\uB2E4"],
        ["w1400", "\uC5B4\uCA4C\uBA74", "\uBD80", "B", "\uC5B4\uCA4C\uBA74"],
        ["w1401", "\uBE44\uBC00", "\uBA85", "B", "\uBE44\uBC00"],
        ["w1402", "\uC544\uAE4C", "\uBD80", "B", "\uC544\uAE4C"],
        ["w1403", "\uC54C\uB9DE\uB2E4", "\uD615", "B", "\uC54C\uB9DE\uB2E4"],
        ["w1404", "\uD76C\uB2E4", "\uD615", "B", "\uD76C\uB2E4"],
        ["w1405", "\uAC00\uB9AC\uD0A4\uB2E4", "\uB3D9", "B", "\uAC00\uB9AC\uD0A4\uB2E401"],
        ["w1406", "\uBAA8\uC2DC\uB2E4", "\uB3D9", "B", "\uBAA8\uC2DC\uB2E4"],
        ["w1407", "\uBC1C\uB2EC", "\uBA85", "B", "\uBC1C\uB2EC"],
        ["w1408", "\uC218\uB9CE\uB2E4", "\uD615", "B", "\uC218\uB9CE\uB2E4"],
        ["w1409", "\uC798\uBABB", "\uBA85", "B", "\uC798\uBABB"],
        ["w1410", "\uD3C9\uD654", "\uBA85", "B", "\uD3C9\uD65402"],
        ["w1411", "\uACF5\uC0AC", "\uBA85", "B", "\uACF5\uC0AC02"],
        ["w1412", "\uB3CC", "\uBA85", "B", "\uB3CC02"],
        ["w1413", "\uBC15\uC0AC", "\uBA85", "B", "\uBC15\uC0AC01"],
        ["w1414", "\uC804\uBB38\uAC00", "\uBA85", "B", "\uC804\uBB38\uAC00"],
        ["w1415", "\uB2E8\uC9C0", "\uBD80", "B", "\uB2E8\uC9C004"],
        ["w1416", "\uBB34\uC6A9", "\uBA85", "B", "\uBB34\uC6A903"],
        ["w1417", "\uBD88\uB9AC\uB2E4", "\uB3D9", "B", "\uBD88\uB9AC\uB2E404"],
        ["w1418", "\uC2F8\uC6C0", "\uBA85", "B", "\uC2F8\uC6C0"],
        ["w1419", "\uC790\uAFB8", "\uBD80", "B", "\uC790\uAFB801"],
        ["w1420", "\uCC28\uB9AC\uB2E4", "\uB3D9", "B", "\uCC28\uB9AC\uB2E4"],
        ["w1421", "\uD574\uC678", "\uBA85", "B", "\uD574\uC678"],
        ["w1422", "\uADF8\uB9AC", "\uBD80", "B", "\uADF8\uB9AC02"],
        ["w1423", "\uB728\uB2E4", "\uB3D9", "B", "\uB728\uB2E401"],
        ["w1424", "\uBBF8\uC18C", "\uBA85", "B", "\uBBF8\uC18C05"],
        ["w1425", "\uC758\uBBF8\uD558\uB2E4", "\uB3D9", "B", "\uC758\uBBF8\uD558\uB2E402"],
        ["w1426", "\uCCB4\uC721", "\uBA85", "B", "\uCCB4\uC721"],
        ["w1427", "\uB540", "\uBA85", "B", "\uB54001"],
        ["w1428", "\uC798\uB418\uB2E4", "\uB3D9", "B", "\uC798\uB418\uB2E4"],
        ["w1429", "\uC313\uC774\uB2E4", "\uB3D9", "B", "\uC313\uC774\uB2E4"],
        ["w1430", "\uC774\uC775", "\uBA85", "B", "\uC774\uC77502"],
        ["w1431", "\uC950\uB2E4", "\uB3D9", "B", "\uC950\uB2E401"],
        ["w1432", "\uAC8C\uB2E4\uAC00", "\uBD80", "B", "\uAC8C\uB2E4\uAC00"],
        ["w1433", "\uB053\uC774\uB2E4", "\uB3D9", "B", "\uB053\uC774\uB2E401"],
        ["w1434", "\uB17C\uBB38", "\uBA85", "B", "\uB17C\uBB38"],
        ["w1435", "\uBA48\uCD94\uB2E4", "\uB3D9", "B", "\uBA48\uCD94\uB2E4"],
        ["w1436", "\uC0AC\uC6A9\uB418\uB2E4", "\uB3D9", "B", "\uC0AC\uC6A9\uB418\uB2E4"],
        ["w1437", "\uC624\uB7AB\uB3D9\uC548", "\uBA85", "B", "\uC624\uB7AB\uB3D9\uC548"],
        ["w1438", "\uCC3E\uC544\uAC00\uB2E4", "\uB3D9", "B", "\uCC3E\uC544\uAC00\uB2E4"],
        ["w1439", "\uB298\uB2E4", "\uB3D9", "B", "\uB298\uB2E401"],
        ["w1440", "\uC591", "\uBA85", "B", "\uC59120"],
        ["w1441", "\uC9C4\uC9DC", "\uBD80", "B", "\uC9C4\uC9DC"],
        ["w1442", "\uACF5\uAE30", "\uBA85", "B", "\uACF5\uAE3006"],
        ["w1443", "\uB2FF\uB2E4", "\uB3D9", "B", "\uB2FF\uB2E401"],
        ["w1444", "\uC18D\uD558\uB2E4", "\uB3D9", "B", "\uC18D\uD558\uB2E402"],
        ["w1445", "\uC62C\uB9BC\uD53D", "\uBA85", "B", "\uC62C\uB9BC\uD53D"],
        ["w1446", "\uC774\uC678", "\uBA85", "B", "\uC774\uC67801"],
        ["w1447", "\uC81C\uACF5\uD558\uB2E4", "\uB3D9", "B", "\uC81C\uACF5\uD558\uB2E402"],
        ["w1448", "\uAE30\uB300", "\uBA85", "B", "\uAE30\uB30003"],
        ["w1449", "\uC2DD\uBB3C", "\uBA85", "B", "\uC2DD\uBB3C02"],
        ["w1450", "\uC61B", "\uAD00", "B", "\uC61B01"],
        ["w1451", "\uC801\uC5B4\uB3C4", "\uBD80", "B", "\uC801\uC5B4\uB3C4"],
        ["w1452", "\uD3B8\uD558\uB2E4", "\uD615", "B", "\uD3B8\uD558\uB2E4"],
        ["w1453", "\uC5B4\uB824\uC6C0", "\uBA85", "B", "\uC5B4\uB824\uC6C0"],
        ["w1454", "\uBD84\uBA85\uD788", "\uBD80", "B", "\uBD84\uBA85\uD788"],
        ["w1455", "\uC544\uBB34\uAC83", "\uBA85", "B", "\uC544\uBB34\uAC83"],
        ["w1456", "\uC628", "\uAD00", "B", "\uC62801"],
        ["w1457", "\uC816\uB2E4", "\uB3D9", "B", "\uC816\uB2E401"],
        ["w1458", "\uCD5C\uB300", "\uBA85", "B", "\uCD5C\uB300"],
        ["w1459", "\uD3C9\uC18C", "\uBA85", "B", "\uD3C9\uC18C"],
        ["w1460", "\uB18D\uC0AC", "\uBA85", "B", "\uB18D\uC0AC01"],
        ["w1461", "\uB354\uAD6C\uB098", "\uBD80", "B", "\uB354\uAD6C\uB09801"],
        ["w1462", "\uC5B4\uB460", "\uBA85", "B", "\uC5B4\uB460"],
        ["w1463", "\uC5B4\uB461\uB2E4", "\uD615", "B", "\uC5B4\uB461\uB2E4"],
        ["w1464", "\uC8FC\uD0DD", "\uBA85", "B", "\uC8FC\uD0DD"],
        ["w1465", "\uACE0\uC7A5", "\uBA85", "B", "\uACE0\uC7A501"],
        ["w1466", "\uAD00\uB828\uD558\uB2E4", "\uB3D9", "B", "\uAD00\uB828\uD558\uB2E4"],
        ["w1467", "\uBC00\uB2E4", "\uB3D9", "B", "\uBC00\uB2E401"],
        ["w1468", "\uC74C", "\uAC10", "B", "\uC74C01"],
        ["w1469", "\uACE0\uB824\uD558\uB2E4", "\uB3D9", "B", "\uACE0\uB824\uD558\uB2E401"],
        ["w1470", "\uB18D\uCD0C", "\uBA85", "B", "\uB18D\uCD0C"],
        ["w1471", "\uC62C\uB77C\uC624\uB2E4", "\uB3D9", "B", "\uC62C\uB77C\uC624\uB2E4"],
        ["w1472", "\uCC59\uAE30\uB2E4", "\uB3D9", "B", "\uCC59\uAE30\uB2E4"],
        ["w1473", "\uACE0\uB974\uB2E4", "\uB3D9", "B", "\uACE0\uB974\uB2E401"],
        ["w1474", "\uBC8C\uC5B4\uC9C0\uB2E4", "\uB3D9", "B", "\uBC8C\uC5B4\uC9C0\uB2E402"],
        ["w1475", "\uD3EC\uAE30\uD558\uB2E4", "\uB3D9", "B", "\uD3EC\uAE30\uD558\uB2E401"],
        ["w1476", "\uACE0\uCE58\uB2E4", "\uB3D9", "B", "\uACE0\uCE58\uB2E401"],
        ["w1477", "\uADF8\uB9BC\uC790", "\uBA85", "B", "\uADF8\uB9BC\uC790"],
        ["w1478", "\uB2E4\uD558\uB2E4", "\uB3D9", "B", "\uB2E4\uD558\uB2E4"],
        ["w1479", "\uB9C8\uCE68\uB0B4", "\uBD80", "B", "\uB9C8\uCE68\uB0B4"],
        ["w1480", "\uBE44\uAD50\uD558\uB2E4", "\uB3D9", "B", "\uBE44\uAD50\uD558\uB2E4"],
        ["w1481", "\uCEE4\uC9C0\uB2E4", "\uB3D9", "B", "\uCEE4\uC9C0\uB2E4"],
        ["w1482", "\uD55C\uCABD", "\uBA85", "B", "\uD55C\uCABD"],
        ["w1483", "\uAC80\uC0AC", "\uBA85", "B", "\uAC80\uC0AC03"],
        ["w1484", "\uB9E1\uAE30\uB2E4", "\uB3D9", "B", "\uB9E1\uAE30\uB2E4"],
        ["w1485", "\uC18C\uBB38", "\uBA85", "B", "\uC18C\uBB3802"],
        ["w1486", "\uC2E3\uB2E4", "\uB3D9", "B", "\uC2E3\uB2E401"],
        ["w1487", "\uC313\uB2E4", "\uB3D9", "B", "\uC313\uB2E4"],
        ["w1488", "\uC81C\uBAA9", "\uBA85", "B", "\uC81C\uBAA902"],
        ["w1489", "\uC9D3", "\uBA85", "B", "\uC9D301"],
        ["w1490", "\uD558\uC597\uB2E4", "\uD615", "B", "\uD558\uC597\uB2E4"],
        ["w1491", "\uD76C\uB9DD", "\uBA85", "B", "\uD76C\uB9DD"],
        ["w1492", "\uAD70\uB300", "\uBA85", "B", "\uAD70\uB30003"],
        ["w1493", "\uADF8\uB9CC\uD07C", "\uBD80", "B", "\uADF8\uB9CC\uD07C"],
        ["w1494", "\uBB34\uC5B4", "\uB300", "B", "\uBB34\uC5B401"],
        ["w1495", "\uC0C1\uB300\uBC29", "\uBA85", "B", "\uC0C1\uB300\uBC2902"],
        ["w1496", "\uC2DC\uACE8", "\uBA85", "B", "\uC2DC\uACE8"],
        ["w1497", "\uC2E4\uC218", "\uBA85", "B", "\uC2E4\uC21801"],
        ["w1498", "\uC798\uBABB\uB418\uB2E4", "\uB3D9", "B", "\uC798\uBABB\uB418\uB2E4"],
        ["w1499", "\uCE58\uB8CC", "\uBA85", "B", "\uCE58\uB8CC"],
        ["w1500", "\uD3ED", "\uBA85", "B", "\uD3ED06"],
        ["w1501", "\uB0B4\uBC00\uB2E4", "\uB3D9", "B", "\uB0B4\uBC00\uB2E4"],
        ["w1502", "\uC2DC\uB9AC\uC988", "\uBA85", "B", "\uC2DC\uB9AC\uC988"],
        ["w1503", "\uC784\uC2E0", "\uBA85", "B", "\uC784\uC2E002"],
        ["w1504", "\uC7A1\uD788\uB2E4", "\uB3D9", "B", "\uC7A1\uD788\uB2E402"],
        ["w1505", "\uADF8\uB7A8", "\uC758", "B", "\uADF8\uB7A8"],
        ["w1506", "\uBC2D", "\uBA85", "B", "\uBC2D01"],
        ["w1507", "\uBD84\uC11D\uD558\uB2E4", "\uB3D9", "B", "\uBD84\uC11D\uD558\uB2E402"],
        ["w1508", "\uC2DD\uAD6C", "\uBA85", "B", "\uC2DD\uAD6C01"],
        ["w1509", "\uC6B8\uB9AC\uB2E4", "\uB3D9", "B", "\uC6B8\uB9AC\uB2E401"],
        ["w1510", "\uD655\uC2E4\uD558\uB2E4", "\uD615", "B", "\uD655\uC2E4\uD558\uB2E4"],
        ["w1511", "\uAE00\uC790", "\uBA85", "B", "\uAE00\uC790"],
        ["w1512", "\uC5F0\uAD6C\uD558\uB2E4", "\uB3D9", "B", "\uC5F0\uAD6C\uD558\uB2E402"],
        ["w1513", "\uCC29\uD558\uB2E4", "\uD615", "B", "\uCC29\uD558\uB2E4"],
        ["w1514", "\uBD80\uB3D9\uC0B0", "\uBA85", "B", "\uBD80\uB3D9\uC0B0"],
        ["w1515", "\uC9C1\uC5C5", "\uBA85", "B", "\uC9C1\uC5C5"],
        ["w1516", "\uC870\uC0C1", "\uBA85", "B", "\uC870\uC0C107"],
        ["w1517", "\uAC80\uB2E4", "\uD615", "B", "\uAC80\uB2E402"],
        ["w1518", "\uACC1", "\uBA85", "B", "\uACC101"],
        ["w1519", "\uB108\uD76C", "\uB300", "B", "\uB108\uD76C"],
        ["w1520", "\uB530\uB2E4", "\uB3D9", "B", "\uB530\uB2E401"],
        ["w1521", "\uBB38\uC81C\uC810", "\uBA85", "B", "\uBB38\uC81C\uC810"],
        ["w1522", "\uBD88\uAC00\uB2A5\uD558\uB2E4", "\uD615", "B", "\uBD88\uAC00\uB2A5\uD558\uB2E4"],
        ["w1523", "\uC778\uC81C", "\uBD80", "B", "\uC778\uC81C01"],
        ["w1524", "\uCDA9\uACA9", "\uBA85", "B", "\uCDA9\uACA902"],
        ["w1525", "\uAE08\uBC29", "\uBD80", "B", "\uAE08\uBC2901"],
        ["w1526", "\uB204\uB974\uB2E4", "\uB3D9", "B", "\uB204\uB974\uB2E401"],
        ["w1527", "\uBBF8\uC220", "\uBA85", "B", "\uBBF8\uC220"],
        ["w1528", "\uAF64", "\uBD80", "B", "\uAF6401"],
        ["w1529", "\uD55C\uCC38", "\uBA85", "B", "\uD55C\uCC38"],
        ["w1530", "\uB04A\uB2E4", "\uB3D9", "B", "\uB04A\uB2E4"],
        ["w1531", "\uB118\uC5B4\uAC00\uB2E4", "\uB3D9", "B", "\uB118\uC5B4\uAC00\uB2E401"],
        ["w1532", "\uB2F4\uAE30\uB2E4", "\uB3D9", "B", "\uB2F4\uAE30\uB2E401"],
        ["w1533", "\uC11C\uB450\uB974\uB2E4", "\uB3D9", "B", "\uC11C\uB450\uB974\uB2E4"],
        ["w1534", "\uCDA9\uBD84\uD558\uB2E4", "\uD615", "B", "\uCDA9\uBD84\uD558\uB2E401"],
        ["w1535", "\uAE30\uC068", "\uBA85", "B", "\uAE30\uC068"],
        ["w1536", "\uAE4A\uC774", "\uBD80", "B", "\uAE4A\uC77402"],
        ["w1537", "\uAFB8\uBBF8\uB2E4", "\uB3D9", "B", "\uAFB8\uBBF8\uB2E4"],
        ["w1538", "\uB298\uB9AC\uB2E4", "\uB3D9", "B", "\uB298\uB9AC\uB2E4"],
        ["w1539", "\uBB34\uB98E", "\uBA85", "B", "\uBB34\uB98E"],
        ["w1540", "\uBC1C\uACAC\uB418\uB2E4", "\uB3D9", "B", "\uBC1C\uACAC\uB418\uB2E4"],
        ["w1541", "\uC774\uC6A9", "\uBA85", "B", "\uC774\uC6A901"],
        ["w1542", "\uC9C0\uB974\uB2E4", "\uB3D9", "B", "\uC9C0\uB974\uB2E403"],
        ["w1543", "\uAC78\uC74C", "\uBA85", "B", "\uAC78\uC74C"],
        ["w1544", "\uACA8\uC6B0", "\uBD80", "B", "\uACA8\uC6B0"],
        ["w1545", "\uB9C8\uB974\uB2E4", "\uB3D9", "B", "\uB9C8\uB974\uB2E401"],
        ["w1546", "\uBE44\uAD50\uC801", "\uBD80", "B", "\uBE44\uAD50\uC801"],
        ["w1547", "\uB192\uC544\uC9C0\uB2E4", "\uB3D9", "B", "\uB192\uC544\uC9C0\uB2E4"],
        ["w1548", "\uB299\uB2E4", "\uB3D9", "B", "\uB299\uB2E4"],
        ["w1549", "\uC0C1\uC0C1", "\uBA85", "B", "\uC0C1\uC0C107"],
        ["w1550", "\uC2A4\uD0C0", "\uBA85", "B", "\uC2A4\uD0C0"],
        ["w1551", "\uC785\uC220", "\uBA85", "B", "\uC785\uC220"],
        ["w1552", "\uC911\uAC04", "\uBA85", "B", "\uC911\uAC0401"],
        ["w1553", "\uBAB9\uC2DC", "\uBD80", "B", "\uBAB9\uC2DC"],
        ["w1554", "\uD2B9\uBCC4\uD558\uB2E4", "\uD615", "B", "\uD2B9\uBCC4\uD558\uB2E4"],
        ["w1555", "\uAC00\uAE4C\uC774", "\uBD80", "B", "\uAC00\uAE4C\uC774"],
        ["w1556", "\uB0AB\uB2E4", "\uD615", "B", "\uB0AB\uB2E402"],
        ["w1557", "\uB118\uC5B4\uC11C\uB2E4", "\uB3D9", "B", "\uB118\uC5B4\uC11C\uB2E4"],
        ["w1558", "\uBCF6\uB2E4", "\uB3D9", "B", "\uBCF6\uB2E4"],
        ["w1559", "\uC5B8\uC820\uAC00", "\uBD80", "B", "\uC5B8\uC820\uAC00"],
        ["w1560", "\uC608\uC220\uAC00", "\uBA85", "B", "\uC608\uC220\uAC00"],
        ["w1561", "\uAC00\uB9CC\uD788", "\uBD80", "B", "\uAC00\uB9CC\uD788"],
        ["w1562", "\uD55C\uB450", "\uAD00", "B", "\uD55C\uB450"],
        ["w1563", "\uD759", "\uBA85", "B", "\uD75901"],
        ["w1564", "\uAC00\uB09C\uD558\uB2E4", "\uD615", "B", "\uAC00\uB09C\uD558\uB2E4"],
        ["w1565", "\uACE0\uAC1D", "\uBA85", "B", "\uACE0\uAC1D04"],
        ["w1566", "\uACFC\uD559\uC790", "\uBA85", "B", "\uACFC\uD559\uC790"],
        ["w1567", "\uAD00\uAD11", "\uBA85", "B", "\uAD00\uAD1102"],
        ["w1568", "\uC218\uC220", "\uBA85", "B", "\uC218\uC22005"],
        ["w1569", "\uC2DD\uD488", "\uBA85", "B", "\uC2DD\uD48801"],
        ["w1570", "\uC5F0\uAE30", "\uBA85", "B", "\uC5F0\uAE3010"],
        ["w1571", "\uD68C\uC6D0", "\uBA85", "B", "\uD68C\uC6D0"],
        ["w1572", "\uB4E4\uB824\uC624\uB2E4", "\uB3D9", "B", "\uB4E4\uB824\uC624\uB2E4"],
        ["w1573", "\uC870\uAE08\uC529", "\uBD80", "B", "\uC870\uAE08\uC529"],
        ["w1574", "\uD480\uB9AC\uB2E4", "\uB3D9", "B", "\uD480\uB9AC\uB2E4"],
        ["w1575", "\uB4E4\uC5EC\uB2E4\uBCF4\uB2E4", "\uB3D9", "B", "\uB4E4\uC5EC\uB2E4\uBCF4\uB2E4"],
        ["w1576", "\uB9C8\uB298", "\uBA85", "B", "\uB9C8\uB298"],
        ["w1577", "\uC2B5\uAD00", "\uBA85", "B", "\uC2B5\uAD00"],
        ["w1578", "\uD65C\uC6A9\uD558\uB2E4", "\uB3D9", "B", "\uD65C\uC6A9\uD558\uB2E4"],
        ["w1579", "\uAC00\uAFB8\uB2E4", "\uB3D9", "B", "\uAC00\uAFB8\uB2E4"],
        ["w1580", "\uACE0\uBBFC", "\uBA85", "B", "\uACE0\uBBFC"],
        ["w1581", "\uB5A0\uC62C\uB9AC\uB2E4", "\uB3D9", "B", "\uB5A0\uC62C\uB9AC\uB2E4"],
        ["w1582", "\uB9E8", "\uAD00", "B", "\uB9E801"],
        ["w1583", "\uC0C1\uCC98", "\uBA85", "B", "\uC0C1\uCC9802"],
        ["w1584", "\uC881\uB2E4", "\uD615", "B", "\uC881\uB2E401"],
        ["w1585", "\uC9D1\uB2E4", "\uB3D9", "B", "\uC9D1\uB2E401"],
        ["w1586", "\uB300\uD45C\uC801", "\uBA85", "B", "\uB300\uD45C\uC801"],
        ["w1587", "\uB9CC\uC77C", "\uBA85", "B", "\uB9CC\uC77C01"],
        ["w1588", "\uC0AC\uD68C\uC801", "\uBA85", "B", "\uC0AC\uD68C\uC801"],
        ["w1589", "\uC0DD\uACA8\uB098\uB2E4", "\uB3D9", "B", "\uC0DD\uACA8\uB098\uB2E4"],
        ["w1590", "\uC8FC\uBD80", "\uBA85", "B", "\uC8FC\uBD8003"],
        ["w1591", "\uD0DC\uC591", "\uBA85", "B", "\uD0DC\uC59102"],
        ["w1592", "\uD2C0\uB9BC\uC5C6\uB2E4", "\uD615", "B", "\uD2C0\uB9BC\uC5C6\uB2E4"],
        ["w1593", "\uD504\uB85C", "\uBA85", "B", "\uD504\uB85C03"],
        ["w1594", "\uD53C\uB2E4", "\uB3D9", "B", "\uD53C\uB2E401"],
        ["w1595", "\uB3C4\uB85C", "\uBA85", "B", "\uB3C4\uB85C07"],
        ["w1596", "\uC9C0\uB2E4", "\uB3D9", "B", "\uC9C0\uB2E405"],
        ["w1597", "\uCC44\uC6B0\uB2E4", "\uB3D9", "B", "\uCC44\uC6B0\uB2E403"],
        ["w1598", "\uBD80\uC871", "\uBA85", "B", "\uBD80\uC87105"],
        ["w1599", "\uB354\uD558\uB2E4", "\uB3D9", "B", "\uB354\uD558\uB2E4"],
        ["w1600", "\uCD1D\uC7A5", "\uBA85", "B", "\uCD1D\uC7A501"],
        ["w1601", "\uB2E8\uC21C\uD788", "\uBD80", "B", "\uB2E8\uC21C\uD788"],
        ["w1602", "\uB2EC\uB824\uAC00\uB2E4", "\uB3D9", "B", "\uB2EC\uB824\uAC00\uB2E4"],
        ["w1603", "\uBC29\uBB38", "\uBA85", "B", "\uBC29\uBB3803"],
        ["w1604", "\uBD88\uB9CC", "\uBA85", "B", "\uBD88\uB9CC"],
        ["w1605", "\uBD88\uD3B8\uD558\uB2E4", "\uD615", "B", "\uBD88\uD3B8\uD558\uB2E401"],
        ["w1606", "\uC2E4\uC81C", "\uBA85", "B", "\uC2E4\uC81C02"],
        ["w1607", "\uC885", "\uBA85", "B", "\uC88509"],
        ["w1608", "\uD53C", "\uBA85", "B", "\uD53C02"],
        ["w1609", "\uAD00\uAC1D", "\uBA85", "B", "\uAD00\uAC1D"],
        ["w1610", "\uBC00\uB9AC\uBBF8\uD130", "\uC758", "B", "\uBC00\uB9AC\uBBF8\uD130"],
        ["w1611", "\uC22B\uC790", "\uBA85", "B", "\uC22B\uC790"],
        ["w1612", "\uACC4\uC0B0", "\uBA85", "B", "\uACC4\uC0B001"],
        ["w1613", "\uB180\uB78D\uB2E4", "\uD615", "B", "\uB180\uB78D\uB2E4"],
        ["w1614", "\uC608\uC804", "\uBA85", "B", "\uC608\uC80401"],
        ["w1615", "\uC804\uAE30", "\uBA85", "B", "\uC804\uAE3015"],
        ["w1616", "\uD2C0\uB9AC\uB2E4", "\uB3D9", "B", "\uD2C0\uB9AC\uB2E401"],
        ["w1617", "\uBAA8\uB378", "\uBA85", "B", "\uBAA8\uB378"],
        ["w1618", "\uBD93\uB2E4", "\uB3D9", "B", "\uBD93\uB2E402"],
        ["w1619", "\uACE0\uBAA8", "\uBA85", "B", "\uACE0\uBAA801"],
        ["w1620", "\uAD81\uAE08\uD558\uB2E4", "\uD615", "B", "\uAD81\uAE08\uD558\uB2E401"],
        ["w1621", "\uB531", "\uBD80", "B", "\uB53103"],
        ["w1622", "\uC57D\uD558\uB2E4", "\uD615", "B", "\uC57D\uD558\uB2E401"],
        ["w1623", "\uC798\uBABB\uD558\uB2E4", "\uB3D9", "B", "\uC798\uBABB\uD558\uB2E4"],
        ["w1624", "\uACF5\uBB34\uC6D0", "\uBA85", "B", "\uACF5\uBB34\uC6D0"],
        ["w1625", "\uADF8\uB9CC\uB450\uB2E4", "\uB3D9", "B", "\uADF8\uB9CC\uB450\uB2E4"],
        ["w1626", "\uD589\uBCF5\uD558\uB2E4", "\uD615", "B", "\uD589\uBCF5\uD558\uB2E4"],
        ["w1627", "\uAD7D\uB2E4", "\uB3D9", "B", "\uAD7D\uB2E401"],
        ["w1628", "\uAE30\uB984", "\uBA85", "B", "\uAE30\uB98401"],
        ["w1629", "\uC3DF\uC544\uC9C0\uB2E4", "\uB3D9", "B", "\uC3DF\uC544\uC9C0\uB2E4"],
        ["w1630", "\uAE30\uC5B5\uD558\uB2E4", "\uB3D9", "B", "\uAE30\uC5B5\uD558\uB2E402"],
        ["w1631", "\uD1A0\uB860", "\uBA85", "B", "\uD1A0\uB86001"],
        ["w1632", "\uACE0\uAE09", "\uBA85", "B", "\uACE0\uAE0902"],
        ["w1633", "\uACE0\uC0DD", "\uBA85", "B", "\uACE0\uC0DD"],
        ["w1634", "\uBC1F\uB2E4", "\uB3D9", "B", "\uBC1F\uB2E4"],
        ["w1635", "\uC11E\uB2E4", "\uB3D9", "B", "\uC11E\uB2E4"],
        ["w1636", "\uC5C6\uC560\uB2E4", "\uB3D9", "B", "\uC5C6\uC560\uB2E4"],
        ["w1637", "\uC774\uB904\uC9C0\uB2E4", "\uB3D9", "B", "\uC774\uB904\uC9C0\uB2E4"],
        ["w1638", "\uC815\uC0C1", "\uBA85", "B", "\uC815\uC0C111"],
        ["w1639", "\uD654\uC7A5\uD488", "\uBA85", "B", "\uD654\uC7A5\uD488"],
        ["w1640", "\uAD75\uB2E4", "\uD615", "B", "\uAD75\uB2E4"],
        ["w1641", "\uAE68\uB057\uC774", "\uBD80", "B", "\uAE68\uB057\uC774"],
        ["w1642", "\uB0A1\uB2E4", "\uD615", "B", "\uB0A1\uB2E401"],
        ["w1643", "\uB208\uC55E", "\uBA85", "B", "\uB208\uC55E"],
        ["w1644", "\uBC29\uBB38\uD558\uB2E4", "\uB3D9", "B", "\uBC29\uBB38\uD558\uB2E4"],
        ["w1645", "\uBD89\uB2E4", "\uD615", "B", "\uBD89\uB2E401"],
        ["w1646", "\uC21C\uC11C", "\uBA85", "B", "\uC21C\uC11C"],
        ["w1647", "\uC544\uBB34\uB798\uB3C4", "\uBD80", "B", "\uC544\uBB34\uB798\uB3C4"],
        ["w1648", "\uC5F0\uAD6C\uC18C", "\uBA85", "B", "\uC5F0\uAD6C\uC18C"],
        ["w1649", "\uC774\uC0AC", "\uBA85", "B", "\uC774\uC0AC14"],
        ["w1650", "\uB4E4\uB974\uB2E4", "\uB3D9", "B", "\uB4E4\uB974\uB2E4"],
        ["w1651", "\uC12C", "\uBA85", "B", "\uC12C03"],
        ["w1652", "\uC774\uD558", "\uBA85", "B", "\uC774\uD55802"],
        ["w1653", "\uCC38\uC11D\uD558\uB2E4", "\uB3D9", "B", "\uCC38\uC11D\uD558\uB2E4"],
        ["w1654", "\uD574\uACB0", "\uBA85", "B", "\uD574\uACB002"],
        ["w1655", "\uD589\uBCF5", "\uBA85", "B", "\uD589\uBCF502"],
        ["w1656", "\uADFC\uB85C\uC790", "\uBA85", "B", "\uADFC\uB85C\uC790"],
        ["w1657", "\uAE00\uC384", "\uAC10", "B", "\uAE00\uC38401"],
        ["w1658", "\uBCC0\uD654\uD558\uB2E4", "\uB3D9", "B", "\uBCC0\uD654\uD558\uB2E4"],
        ["w1659", "\uACB0\uC815\uB418\uB2E4", "\uB3D9", "B", "\uACB0\uC815\uB418\uB2E401"],
        ["w1660", "\uBD88\uC548", "\uBA85", "B", "\uBD88\uC54801"],
        ["w1661", "\uC5EC\uC720", "\uBA85", "B", "\uC5EC\uC720"],
        ["w1662", "\uD0AC\uB85C\uBBF8\uD130", "\uC758", "B", "\uD0AC\uB85C\uBBF8\uD130"],
        ["w1663", "\uD30C\uB3C4", "\uBA85", "B", "\uD30C\uB3C4"],
        ["w1664", "\uB2E8", "\uAD00", "B", "\uB2E809"],
        ["w1665", "\uBC29\uC1A1\uAD6D", "\uBA85", "B", "\uBC29\uC1A1\uAD6D"],
        ["w1666", "\uC228\uB2E4", "\uB3D9", "B", "\uC228\uB2E401"],
        ["w1667", "\uC608\uAE08", "\uBA85", "B", "\uC608\uAE0801"],
        ["w1668", "\uC785\uD559", "\uBA85", "B", "\uC785\uD559"],
        ["w1669", "\uBB3C\uB2E4", "\uB3D9", "B", "\uBB3C\uB2E402"],
        ["w1670", "\uC5B4\uB290\uC0C8", "\uBD80", "B", "\uC5B4\uB290\uC0C8"],
        ["w1671", "\uCE58\uC988", "\uBA85", "B", "\uCE58\uC988"],
        ["w1672", "\uBC18\uB300\uD558\uB2E4", "\uB3D9", "B", "\uBC18\uB300\uD558\uB2E401"],
        ["w1673", "\uC544\uC774\uACE0", "\uAC10", "B", "\uC544\uC774\uACE0"],
        ["w1674", "\uC870\uC6A9\uD788", "\uBD80", "B", "\uC870\uC6A9\uD788"],
        ["w1675", "\uAC00\uC2A4", "\uBA85", "B", "\uAC00\uC2A4"],
        ["w1676", "\uAD6C\uBA4D", "\uBA85", "B", "\uAD6C\uBA4D"],
        ["w1677", "\uB9CC\uD654", "\uBA85", "B", "\uB9CC\uD65410"],
        ["w1678", "\uBA39\uC774\uB2E4", "\uB3D9", "B", "\uBA39\uC774\uB2E4"],
        ["w1679", "\uBB34\uC2DC\uD558\uB2E4", "\uB3D9", "B", "\uBB34\uC2DC\uD558\uB2E4"],
        ["w1680", "\uC0B4\uC9DD", "\uBD80", "B", "\uC0B4\uC9DD01"],
        ["w1681", "\uC0DD\uAC01\uB098\uB2E4", "\uB3D9", "B", "\uC0DD\uAC01\uB098\uB2E4"],
        ["w1682", "\uCC28\uAC11\uB2E4", "\uD615", "B", "\uCC28\uAC11\uB2E4"],
        ["w1683", "\uAD00\uCC30\uD558\uB2E4", "\uB3D9", "B", "\uAD00\uCC30\uD558\uB2E4"],
        ["w1684", "\uAD1C\uD788", "\uBD80", "B", "\uAD1C\uD788"],
        ["w1685", "\uB07C\uB2E4", "\uB3D9", "B", "\uB07C\uB2E403"],
        ["w1686", "\uB0A0\uAC1C", "\uBA85", "B", "\uB0A0\uAC1C01"],
        ["w1687", "\uB140\uC11D", "\uC758", "B", "\uB140\uC11D"],
        ["w1688", "\uB208\uBE5B", "\uBA85", "B", "\uB208\uBE5B01"],
        ["w1689", "\uBB3C\uC18D", "\uBA85", "B", "\uBB3C\uC18D"],
        ["w1690", "\uC131\uACF5\uD558\uB2E4", "\uB3D9", "B", "\uC131\uACF5\uD558\uB2E4"],
        ["w1691", "\uC18C\uB098\uBB34", "\uBA85", "B", "\uC18C\uB098\uBB34"],
        ["w1692", "\uC5EC\uAE30\uC800\uAE30", "\uBA85", "B", "\uC5EC\uAE30\uC800\uAE30"],
        ["w1693", "\uBA38\uBB34\uB974\uB2E4", "\uB3D9", "B", "\uBA38\uBB34\uB974\uB2E4"],
        ["w1694", "\uD615\uC81C", "\uBA85", "B", "\uD615\uC81C01"],
        ["w1695", "\uD654\uB824\uD558\uB2E4", "\uD615", "B", "\uD654\uB824\uD558\uB2E4"],
        ["w1696", "\uB534", "\uAD00", "B", "\uB53403"],
        ["w1697", "\uBA87\uBA87", "\uAD00", "B", "\uBA87\uBA87"],
        ["w1698", "\uC138\uACC4\uC801", "\uBA85", "B", "\uC138\uACC4\uC801"],
        ["w1699", "\uC548\uC804", "\uBA85", "B", "\uC548\uC80403"],
        ["w1700", "\uCD2C\uC601", "\uBA85", "B", "\uCD2C\uC601"],
        ["w1701", "\uD2C0\uB2E4", "\uB3D9", "B", "\uD2C0\uB2E4"],
        ["w1702", "\uAC10\uB2E4", "\uB3D9", "B", "\uAC10\uB2E401"],
        ["w1703", "\uACE0\uCD94", "\uBA85", "B", "\uACE0\uCD9401"],
        ["w1704", "\uADDC\uCE59", "\uBA85", "B", "\uADDC\uCE5902"],
        ["w1705", "\uC544\uB9C8\uB3C4", "\uBD80", "B", "\uC544\uB9C8\uB3C4"],
        ["w1706", "\uC548\uBC29", "\uBA85", "B", "\uC548\uBC2902"],
        ["w1707", "\uC553\uB2E4", "\uB3D9", "B", "\uC553\uB2E4"],
        ["w1708", "\uC624\uC9C1", "\uBD80", "B", "\uC624\uC9C101"],
        ["w1709", "\uD3EC\uD568\uB418\uB2E4", "\uB3D9", "B", "\uD3EC\uD568\uB418\uB2E401"],
        ["w1710", "\uD638\uB791\uC774", "\uBA85", "B", "\uD638\uB791\uC774"],
        ["w1711", "\uB35C", "\uBD80", "B", "\uB35C01"],
        ["w1712", "\uB465\uAE00\uB2E4", "\uD615", "B", "\uB465\uAE00\uB2E401"],
        ["w1713", "\uBCF8\uB798", "\uBA85", "B", "\uBCF8\uB798"],
        ["w1714", "\uC138\uAE08", "\uBA85", "B", "\uC138\uAE0801"],
        ["w1715", "\uC785\uAD6C", "\uBA85", "B", "\uC785\uAD6C02"],
        ["w1716", "\uC794\uB729", "\uBD80", "B", "\uC794\uB729"],
        ["w1717", "\uC801\uADF9", "\uBA85", "B", "\uC801\uADF9"],
        ["w1718", "\uCD5C\uC18C\uD55C", "\uBA85", "B", "\uCD5C\uC18C\uD55C"],
        ["w1719", "\uD3BC\uCCD0\uC9C0\uB2E4", "\uB3D9", "B", "\uD3BC\uCCD0\uC9C0\uB2E4"],
        ["w1720", "\uACBD\uD5D8\uD558\uB2E4", "\uB3D9", "B", "\uACBD\uD5D8\uD558\uB2E4"],
        ["w1721", "\uB118\uCE58\uB2E4", "\uB3D9", "B", "\uB118\uCE58\uB2E4"],
        ["w1722", "\uB193\uCE58\uB2E4", "\uB3D9", "B", "\uB193\uCE58\uB2E4"],
        ["w1723", "\uB3CC\uC544\uBCF4\uB2E4", "\uB3D9", "B", "\uB3CC\uC544\uBCF4\uB2E4"],
        ["w1724", "\uB610\uB2E4\uC2DC", "\uBD80", "B", "\uB610\uB2E4\uC2DC"],
        ["w1725", "\uBA38\uB9BF\uC18D", "\uBA85", "B", "\uBA38\uB9BF\uC18D"],
        ["w1726", "\uBD88\uC548\uD558\uB2E4", "\uD615", "B", "\uBD88\uC548\uD558\uB2E4"],
        ["w1727", "\uC704\uBC18", "\uBA85", "B", "\uC704\uBC1803"],
        ["w1728", "\uD3C9\uC0DD", "\uBA85", "B", "\uD3C9\uC0DD"],
        ["w1729", "\uAD49\uC7A5\uD788", "\uBD80", "B", "\uAD49\uC7A5\uD788"],
        ["w1730", "\uB36E\uB2E4", "\uB3D9", "B", "\uB36E\uB2E4"],
        ["w1731", "\uBAB0\uB2E4", "\uB3D9", "B", "\uBAB0\uB2E401"],
        ["w1732", "\uBC30\uC6B0", "\uBA85", "B", "\uBC30\uC6B001"],
        ["w1733", "\uC54C", "\uBA85", "B", "\uC54C01"],
        ["w1734", "\uC55E\uC11C\uB2E4", "\uB3D9", "B", "\uC55E\uC11C\uB2E4"],
        ["w1735", "\uC624\uB798\uC804", "\uBA85", "B", "\uC624\uB798\uC804"],
        ["w1736", "\uC790\uACA9", "\uBA85", "B", "\uC790\uACA904"],
        ["w1737", "\uACC4\uB2E8", "\uBA85", "B", "\uACC4\uB2E804"],
        ["w1738", "\uB044\uB355\uC774\uB2E4", "\uB3D9", "B", "\uB044\uB355\uC774\uB2E4"],
        ["w1739", "\uB0AF\uC124\uB2E4", "\uD615", "B", "\uB0AF\uC124\uB2E4"],
        ["w1740", "\uB192\uC774", "\uBA85", "B", "\uB192\uC77401"],
        ["w1741", "\uB2EE\uB2E4", "\uB3D9", "B", "\uB2EE\uB2E4"],
        ["w1742", "\uB9C8\uC74C\uC18D", "\uBA85", "B", "\uB9C8\uC74C\uC18D"],
        ["w1743", "\uBF08", "\uBA85", "B", "\uBF08"],
        ["w1744", "\uC5F0\uACB0\uB418\uB2E4", "\uB3D9", "B", "\uC5F0\uACB0\uB418\uB2E4"],
        ["w1745", "\uC7A5\uC0AC", "\uBA85", "B", "\uC7A5\uC0AC01"],
        ["w1746", "\uC81C\uD55C", "\uBA85", "B", "\uC81C\uD55C01"],
        ["w1747", "\uCC28\uB2E4", "\uB3D9", "B", "\uCC28\uB2E402"],
        ["w1748", "\uCF69", "\uBA85", "B", "\uCF6901"],
        ["w1749", "\uD55C\uC228", "\uBA85", "B", "\uD55C\uC22802"],
        ["w1750", "\uD5E4\uC5B4\uC9C0\uB2E4", "\uB3D9", "B", "\uD5E4\uC5B4\uC9C0\uB2E4"],
        ["w1751", "\uB108\uBA38", "\uBA85", "B", "\uB108\uBA38"],
        ["w1752", "\uB3D9\uAE30", "\uBA85", "B", "\uB3D9\uAE3007"],
        ["w1753", "\uC21C\uC218\uD558\uB2E4", "\uD615", "B", "\uC21C\uC218\uD558\uB2E402"],
        ["w1754", "\uC2A4\uD0C0\uC77C", "\uBA85", "B", "\uC2A4\uD0C0\uC77C"],
        ["w1755", "\uC9D1\uC911", "\uBA85", "B", "\uC9D1\uC91102"],
        ["w1756", "\uD070\uC77C", "\uBA85", "B", "\uD070\uC77C01"],
        ["w1757", "\uAC70\uC9D3\uB9D0", "\uBA85", "B", "\uAC70\uC9D3\uB9D0"],
        ["w1758", "\uB300\uB2E8\uD558\uB2E4", "\uD615", "B", "\uB300\uB2E8\uD558\uB2E4"],
        ["w1759", "\uB300\uB2E8\uD788", "\uBD80", "B", "\uB300\uB2E8\uD788"],
        ["w1760", "\uB9C8\uC8FC", "\uBD80", "B", "\uB9C8\uC8FC01"],
        ["w1761", "\uC628\uD1B5", "\uBD80", "B", "\uC628\uD1B5"],
        ["w1762", "\uC790\uC138\uD788", "\uBD80", "B", "\uC790\uC138\uD788"],
        ["w1763", "\uC815\uD655\uD788", "\uBD80", "B", "\uC815\uD655\uD78801"],
        ["w1764", "\uC9C0\uCE58\uB2E4", "\uB3D9", "B", "\uC9C0\uCE58\uB2E401"],
        ["w1765", "\uCCAD\uB144", "\uBA85", "B", "\uCCAD\uB144"],
        ["w1766", "\uD600", "\uBA85", "B", "\uD60001"],
        ["w1767", "\uD655\uB300\uD558\uB2E4", "\uB3D9", "B", "\uD655\uB300\uD558\uB2E402"],
        ["w1768", "\uD6C4\uCDA7\uAC00\uB8E8", "\uBA85", "B", "\uD6C4\uCDA7\uAC00\uB8E8"],
        ["w1769", "\uB9C8\uCE68", "\uBD80", "B", "\uB9C8\uCE6802"],
        ["w1770", "\uC2E0\uC6A9", "\uBA85", "B", "\uC2E0\uC6A901"],
        ["w1771", "\uC628\uBAB8", "\uBA85", "B", "\uC628\uBAB8"],
        ["w1772", "\uC815", "\uBA85", "B", "\uC81520"],
        ["w1773", "\uC815\uC2E0\uC801", "\uBA85", "B", "\uC815\uC2E0\uC801"],
        ["w1774", "\uC99D\uC0C1", "\uBA85", "B", "\uC99D\uC0C101"],
        ["w1775", "\uCD9C\uC5F0\uD558\uB2E4", "\uB3D9", "B", "\uCD9C\uC5F0\uD558\uB2E402"],
        ["w1776", "\uD55C\uAEBC\uBC88\uC5D0", "\uBD80", "B", "\uD55C\uAEBC\uBC88\uC5D0"],
        ["w1777", "\uAC15\uC81C", "\uBA85", "B", "\uAC15\uC81C01"],
        ["w1778", "\uAC74\uB108\uB2E4", "\uB3D9", "B", "\uAC74\uB108\uB2E4"],
        ["w1779", "\uAE68\uB2E4", "\uB3D9", "B", "\uAE68\uB2E401"],
        ["w1780", "\uB09A\uC2DC", "\uBA85", "B", "\uB09A\uC2DC"],
        ["w1781", "\uB2E4\uAC00\uAC00\uB2E4", "\uB3D9", "B", "\uB2E4\uAC00\uAC00\uB2E4"],
        ["w1782", "\uB6F0\uC5B4\uB4E4\uB2E4", "\uB3D9", "B", "\uB6F0\uC5B4\uB4E4\uB2E4"],
        ["w1783", "\uC2E0\uBD80", "\uBA85", "B", "\uC2E0\uBD8010"],
        ["w1784", "\uC624\uC9D5\uC5B4", "\uBA85", "B", "\uC624\uC9D5\uC5B4"],
        ["w1785", "\uC694\uAE08", "\uBA85", "B", "\uC694\uAE0801"],
        ["w1786", "\uC6A9\uB3C8", "\uBA85", "B", "\uC6A9\uB3C8"],
        ["w1787", "\uC74C\uB8CC", "\uBA85", "B", "\uC74C\uB8CC"],
        ["w1788", "\uC804\uC790", "\uBA85", "B", "\uC804\uC79006"],
        ["w1789", "\uC804\uD574\uC9C0\uB2E4", "\uB3D9", "B", "\uC804\uD574\uC9C0\uB2E4"],
        ["w1790", "\uD3B8\uB9AC\uD558\uB2E4", "\uD615", "B", "\uD3B8\uB9AC\uD558\uB2E4"],
        ["w1791", "\uD604\uAE08", "\uBA85", "B", "\uD604\uAE0804"],
        ["w1792", "\uD65C\uBC1C\uD558\uB2E4", "\uD615", "B", "\uD65C\uBC1C\uD558\uB2E4"],
        ["w1793", "\uAC00\uB9AC\uB2E4", "\uB3D9", "B", "\uAC00\uB9AC\uB2E403"],
        ["w1794", "\uAECD\uC9C8", "\uBA85", "B", "\uAECD\uC9C8"],
        ["w1795", "\uBA85\uB839", "\uBA85", "B", "\uBA85\uB83901"],
        ["w1796", "\uBAB0\uB798", "\uBD80", "B", "\uBAB0\uB79801"],
        ["w1797", "\uBB34\uC870\uAC74", "\uBD80", "B", "\uBB34\uC870\uAC74"],
        ["w1798", "\uBC18\uC7A5", "\uBA85", "B", "\uBC18\uC7A508"],
        ["w1799", "\uBD80\uADFC", "\uBA85", "B", "\uBD80\uADFC03"],
        ["w1800", "\uC120\uD0DD", "\uBA85", "B", "\uC120\uD0DD"],
        ["w1801", "\uC5ED\uC0AC\uAC00", "\uBA85", "B", "\uC5ED\uC0AC\uAC00"],
        ["w1802", "\uC5F0\uAD6C\uC790", "\uBA85", "B", "\uC5F0\uAD6C\uC790"],
        ["w1803", "\uC815\uB9AC", "\uBA85", "B", "\uC815\uB9AC09"],
        ["w1804", "\uC870\uADF8\uB9E3\uB2E4", "\uD615", "B", "\uC870\uADF8\uB9E3\uB2E4"],
        ["w1805", "\uC904\uAE30", "\uBA85", "B", "\uC904\uAE3001"],
        ["w1806", "\uCC3E\uC544\uB0B4\uB2E4", "\uB3D9", "B", "\uCC3E\uC544\uB0B4\uB2E4"],
        ["w1807", "\uAD8C\uD558\uB2E4", "\uB3D9", "B", "\uAD8C\uD558\uB2E4"],
        ["w1808", "\uB05D\uB0B4", "\uBD80", "B", "\uB05D\uB0B4"],
        ["w1809", "\uB300\uBB38", "\uBA85", "B", "\uB300\uBB3803"],
        ["w1810", "\uC2DC\uB0B4", "\uBA85", "B", "\uC2DC\uB0B403"],
        ["w1811", "\uC2E0", "\uBA85", "B", "\uC2E002"],
        ["w1812", "\uC2E4\uB0B4", "\uBA85", "B", "\uC2E4\uB0B4"],
        ["w1813", "\uC3DF\uB2E4", "\uB3D9", "B", "\uC3DF\uB2E4"],
        ["w1814", "\uC5F0\uACB0\uD558\uB2E4", "\uB3D9", "B", "\uC5F0\uACB0\uD558\uB2E401"],
        ["w1815", "\uC678\uAD50", "\uBA85", "B", "\uC678\uAD5001"],
        ["w1816", "\uC8FC\uBA38\uB2C8", "\uBA85", "B", "\uC8FC\uBA38\uB2C8"],
        ["w1817", "\uACC4\uC57D", "\uBA85", "B", "\uACC4\uC57D"],
        ["w1818", "\uACFC\uC7A5", "\uBA85", "B", "\uACFC\uC7A507"],
        ["w1819", "\uBD80\uB044\uB7FD\uB2E4", "\uD615", "B", "\uBD80\uB044\uB7FD\uB2E4"],
        ["w1820", "\uC131\uACF5", "\uBA85", "B", "\uC131\uACF501"],
        ["w1821", "\uC2E0\uCCAD", "\uBA85", "B", "\uC2E0\uCCAD01"],
        ["w1822", "\uC544\uD514", "\uBA85", "B", "\uC544\uD514"],
        ["w1823", "\uC54C\uC544\uB4E3\uB2E4", "\uB3D9", "B", "\uC54C\uC544\uB4E3\uB2E4"],
        ["w1824", "\uC774\uB3D9", "\uBA85", "B", "\uC774\uB3D903"],
        ["w1825", "\uAE30\uC628", "\uBA85", "B", "\uAE30\uC628"],
        ["w1826", "\uB0A0\uC544\uAC00\uB2E4", "\uB3D9", "B", "\uB0A0\uC544\uAC00\uB2E4"],
        ["w1827", "\uB9CE\uC544\uC9C0\uB2E4", "\uB3D9", "B", "\uB9CE\uC544\uC9C0\uB2E4"],
        ["w1828", "\uBC14\uC704", "\uBA85", "B", "\uBC14\uC70401"],
        ["w1829", "\uBC84\uB987", "\uBA85", "B", "\uBC84\uB98701"],
        ["w1830", "\uBE44\uD310\uD558\uB2E4", "\uB3D9", "B", "\uBE44\uD310\uD558\uB2E4"],
        ["w1831", "\uBE68\uAC1B\uB2E4", "\uD615", "B", "\uBE68\uAC1B\uB2E4"],
        ["w1832", "\uC138\uC6CC\uC9C0\uB2E4", "\uB3D9", "B", "\uC138\uC6CC\uC9C0\uB2E4"],
        ["w1833", "\uC220\uC9D1", "\uBA85", "B", "\uC220\uC9D1"],
        ["w1834", "\uC804\uCCB4\uC801", "\uBA85", "B", "\uC804\uCCB4\uC801"],
        ["w1835", "\uC808\uBC18", "\uBA85", "B", "\uC808\uBC18"],
        ["w1836", "\uD3B8\uC548\uD558\uB2E4", "\uD615", "B", "\uD3B8\uC548\uD558\uB2E401"],
        ["w1837", "\uD48D\uACBD", "\uBA85", "B", "\uD48D\uACBD01"],
        ["w1838", "\uD655\uC2E4\uD788", "\uBD80", "B", "\uD655\uC2E4\uD788"],
        ["w1839", "\uAC08\uB2E4", "\uB3D9", "B", "\uAC08\uB2E402"],
        ["w1840", "\uAD50\uB958", "\uBA85", "B", "\uAD50\uB95801"],
        ["w1841", "\uAE00\uC4F0\uAE30", "\uBA85", "B", "\uAE00\uC4F0\uAE30"],
        ["w1842", "\uB0B4\uB0B4", "\uBD80", "B", "\uB0B4\uB0B401"],
        ["w1843", "\uB300\uAE30\uC5C5", "\uBA85", "B", "\uB300\uAE30\uC5C5"],
        ["w1844", "\uB3C4\uAD6C", "\uBA85", "B", "\uB3C4\uAD6C10"],
        ["w1845", "\uB9E4\uB825", "\uBA85", "B", "\uB9E4\uB825"],
        ["w1846", "\uBCF4\uD5D8", "\uBA85", "B", "\uBCF4\uD5D8"],
        ["w1847", "\uBD80\uB7FD\uB2E4", "\uD615", "B", "\uBD80\uB7FD\uB2E4"],
        ["w1848", "\uBD80\uC7A5", "\uBA85", "B", "\uBD80\uC7A507"],
        ["w1849", "\uC11E\uC774\uB2E4", "\uB3D9", "B", "\uC11E\uC774\uB2E4"],
        ["w1850", "\uC18C", "\uBA85", "B", "\uC18C03"],
        ["w1851", "\uC2EC\uB9AC", "\uBA85", "B", "\uC2EC\uB9AC01"],
        ["w1852", "\uC3D8\uB2E4", "\uB3D9", "B", "\uC3D8\uB2E401"],
        ["w1853", "\uC704\uCE58\uD558\uB2E4", "\uB3D9", "B", "\uC704\uCE58\uD558\uB2E4"],
        ["w1854", "\uC774\uD2C0", "\uBA85", "B", "\uC774\uD2C001"],
        ["w1855", "\uC804\uB2EC\uD558\uB2E4", "\uB3D9", "B", "\uC804\uB2EC\uD558\uB2E402"],
        ["w1856", "\uC815\uB9D0\uB85C", "\uBD80", "B", "\uC815\uB9D0\uB85C"],
        ["w1857", "\uCF54\uB108", "\uBA85", "B", "\uCF54\uB108"],
        ["w1858", "\uD589\uB3D9\uD558\uB2E4", "\uB3D9", "B", "\uD589\uB3D9\uD558\uB2E4"],
        ["w1859", "\uAC10\uB3D9", "\uBA85", "B", "\uAC10\uB3D902"],
        ["w1860", "\uAD73\uC774", "\uBD80", "B", "\uAD73\uC774"],
        ["w1861", "\uADF8\uB298", "\uBA85", "B", "\uADF8\uB298"],
        ["w1862", "\uAE09\uD558\uB2E4", "\uD615", "B", "\uAE09\uD558\uB2E4"],
        ["w1863", "\uB2EC\uAC40", "\uBA85", "B", "\uB2EC\uAC40"],
        ["w1864", "\uB300\uC911\uBB38\uD654", "\uBA85", "B", "\uB300\uC911\uBB38\uD654"],
        ["w1865", "\uB9C8\uB828\uB418\uB2E4", "\uB3D9", "B", "\uB9C8\uB828\uB418\uB2E4"],
        ["w1866", "\uB9C8\uB8E8", "\uBA85", "B", "\uB9C8\uB8E803"],
        ["w1867", "\uBB34\uAC8C", "\uBA85", "B", "\uBB34\uAC8C"],
        ["w1868", "\uC131\uC801", "\uBA85", "B", "\uC131\uC80104"],
        ["w1869", "\uC194\uC9C1\uD788", "\uBD80", "B", "\uC194\uC9C1\uD788"],
        ["w1870", "\uC2DC\uB3C4\uD558\uB2E4", "\uB3D9", "B", "\uC2DC\uB3C4\uD558\uB2E403"],
        ["w1871", "\uC608\uC808", "\uBA85", "B", "\uC608\uC808"],
        ["w1872", "\uC778\uC0C1", "\uBA85", "B", "\uC778\uC0C106"],
        ["w1873", "\uC778\uD130\uB137", "\uBA85", "B", "\uC778\uD130\uB137"],
        ["w1874", "\uC801\uC6A9\uD558\uB2E4", "\uB3D9", "B", "\uC801\uC6A9\uD558\uB2E4"],
        ["w1875", "\uC804\uD1B5\uC801", "\uBA85", "B", "\uC804\uD1B5\uC801"],
        ["w1876", "\uCC38\uAC00\uD558\uB2E4", "\uB3D9", "B", "\uCC38\uAC00\uD558\uB2E401"],
        ["w1877", "\uCE5C\uCC99", "\uBA85", "B", "\uCE5C\uCC99"],
        ["w1878", "\uADF8\uB2E4\uC9C0", "\uBD80", "B", "\uADF8\uB2E4\uC9C0"],
        ["w1879", "\uAE34\uC7A5", "\uBA85", "B", "\uAE34\uC7A5"],
        ["w1880", "\uB530\uB77C\uAC00\uB2E4", "\uB3D9", "B", "\uB530\uB77C\uAC00\uB2E4"],
        ["w1881", "\uBD80\uCC98", "\uBA85", "B", "\uBD80\uCC9804"],
        ["w1882", "\uC219\uC774\uB2E4", "\uB3D9", "B", "\uC219\uC774\uB2E4"],
        ["w1883", "\uC544\uAC00\uC528", "\uBA85", "B", "\uC544\uAC00\uC528"],
        ["w1884", "\uC628\uB3C4", "\uBA85", "B", "\uC628\uB3C4"],
        ["w1885", "\uC774\uB9C8", "\uBA85", "B", "\uC774\uB9C801"],
        ["w1886", "\uC808\uB300\uB85C", "\uBD80", "B", "\uC808\uB300\uB85C"],
        ["w1887", "\uC9C0\uBD95", "\uBA85", "B", "\uC9C0\uBD95"],
        ["w1888", "\uC9D9\uB2E4", "\uD615", "B", "\uC9D9\uB2E402"],
        ["w1889", "\uCC3D\uBC16", "\uBA85", "B", "\uCC3D\uBC16"],
        ["w1890", "\uD587\uC0B4", "\uBA85", "B", "\uD587\uC0B4"],
        ["w1891", "\uACBD\uC81C\uC801", "\uBA85", "B", "\uACBD\uC81C\uC801"],
        ["w1892", "\uB2F4\uB2F9\uD558\uB2E4", "\uB3D9", "B", "\uB2F4\uB2F9\uD558\uB2E4"],
        ["w1893", "\uBC97\uAE30\uB2E4", "\uB3D9", "B", "\uBC97\uAE30\uB2E402"],
        ["w1894", "\uBD88\uBE5B", "\uBA85", "B", "\uBD88\uBE5B"],
        ["w1895", "\uC2DC\uCCAD\uC790", "\uBA85", "B", "\uC2DC\uCCAD\uC790"],
        ["w1896", "\uC644\uBCBD\uD558\uB2E4", "\uD615", "B", "\uC644\uBCBD\uD558\uB2E4"],
        ["w1897", "\uC808", "\uBA85", "B", "\uC80801"],
        ["w1898", "\uC885\uC5C5\uC6D0", "\uBA85", "B", "\uC885\uC5C5\uC6D0"],
        ["w1899", "\uD559\uAE30", "\uBA85", "B", "\uD559\uAE3002"],
        ["w1900", "\uD55C\uB3D9\uC548", "\uBA85", "B", "\uD55C\uB3D9\uC548"],
        ["w1901", "\uB9CC\uC9C0\uB2E4", "\uB3D9", "B", "\uB9CC\uC9C0\uB2E4"],
        ["w1902", "\uBAA9\uC0AC", "\uBA85", "B", "\uBAA9\uC0AC05"],
        ["w1903", "\uBC14\uB298", "\uBA85", "B", "\uBC14\uB298"],
        ["w1904", "\uBD80", "\uC758", "B", "\uBD8015"],
        ["w1905", "\uC591\uCABD", "\uBA85", "B", "\uC591\uCABD"],
        ["w1906", "\uC9D0", "\uBA85", "B", "\uC9D001"],
        ["w1907", "\uD480", "\uBA85", "B", "\uD48002"],
        ["w1908", "\uD574\uB9C8\uB2E4", "\uBD80", "B", "\uD574\uB9C8\uB2E4"],
        ["w1909", "\uD6C4\uBC30", "\uBA85", "B", "\uD6C4\uBC3006"],
        ["w1910", "\uD734\uAC00", "\uBA85", "B", "\uD734\uAC0001"],
        ["w1911", "\uAD6D\uD68C\uC758\uC6D0", "\uBA85", "B", "\uAD6D\uD68C\uC758\uC6D0"],
        ["w1912", "\uBED7\uB2E4", "\uB3D9", "B", "\uBED7\uB2E4"],
        ["w1913", "\uC0DD\uD65C\uD558\uB2E4", "\uB3D9", "B", "\uC0DD\uD65C\uD558\uB2E4"],
        ["w1914", "\uC194\uC9C1\uD558\uB2E4", "\uD615", "B", "\uC194\uC9C1\uD558\uB2E4"],
        ["w1915", "\uC548\uD0C0\uAE5D\uB2E4", "\uD615", "B", "\uC548\uD0C0\uAE5D\uB2E4"],
        ["w1916", "\uC813\uB2E4", "\uB3D9", "B", "\uC813\uB2E401"],
        ["w1917", "\uCD95\uC81C", "\uBA85", "B", "\uCD95\uC81C01"],
        ["w1918", "\uD130\uB728\uB9AC\uB2E4", "\uB3D9", "B", "\uD130\uB728\uB9AC\uB2E4"],
        ["w1919", "\uD559\uC2B5", "\uBA85", "B", "\uD559\uC2B5"],
        ["w1920", "\uB2F9\uC5F0\uD788", "\uBD80", "B", "\uB2F9\uC5F0\uD78801"],
        ["w1921", "\uB5A8\uB9AC\uB2E4", "\uB3D9", "B", "\uB5A8\uB9AC\uB2E401"],
        ["w1922", "\uB9C8\uAD6C", "\uBD80", "B", "\uB9C8\uAD6C01"],
        ["w1923", "\uB9CC\uB0A8", "\uBA85", "B", "\uB9CC\uB0A8"],
        ["w1924", "\uBBF8\uB514\uC5B4", "\uBA85", "B", "\uBBF8\uB514\uC5B4"],
        ["w1925", "\uBCF5\uB3C4", "\uBA85", "B", "\uBCF5\uB3C404"],
        ["w1926", "\uC218\uC0C1", "\uBA85", "B", "\uC218\uC0C109"],
        ["w1927", "\uC790\uB791\uC2A4\uB7FD\uB2E4", "\uD615", "B", "\uC790\uB791\uC2A4\uB7FD\uB2E4"],
        ["w1928", "\uC801\uB2F9\uD558\uB2E4", "\uD615", "B", "\uC801\uB2F9\uD558\uB2E402"],
        ["w1929", "\uC9C4\uD589\uD558\uB2E4", "\uB3D9", "B", "\uC9C4\uD589\uD558\uB2E4"],
        ["w1930", "\uACF3\uACF3", "\uBA85", "B", "\uACF3\uACF3"],
        ["w1931", "\uAE08\uC9C0", "\uBA85", "B", "\uAE08\uC9C004"],
        ["w1932", "\uB0B4\uC9C0", "\uBD80", "B", "\uB0B4\uC9C001"],
        ["w1933", "\uB2EC\uB824\uC624\uB2E4", "\uB3D9", "B", "\uB2EC\uB824\uC624\uB2E4"],
        ["w1934", "\uB458\uB7EC\uBCF4\uB2E4", "\uB3D9", "B", "\uB458\uB7EC\uBCF4\uB2E4"],
        ["w1935", "\uBE44\uAD50", "\uBA85", "B", "\uBE44\uAD5001"],
        ["w1936", "\uC5ED\uC0AC\uC801", "\uBA85", "B", "\uC5ED\uC0AC\uC801"],
        ["w1937", "\uC5F4\uCC28", "\uBA85", "B", "\uC5F4\uCC2802"],
        ["w1938", "\uC720\uB09C\uD788", "\uBD80", "B", "\uC720\uB09C\uD788"],
        ["w1939", "\uC7A0\uB4E4\uB2E4", "\uB3D9", "B", "\uC7A0\uB4E4\uB2E4"],
        ["w1940", "\uC815\uC2DD", "\uBA85", "B", "\uC815\uC2DD01"],
        ["w1941", "\uC989\uC2DC", "\uBA85", "B", "\uC989\uC2DC"],
        ["w1942", "\uCD5C\uC120", "\uBA85", "B", "\uCD5C\uC12002"],
        ["w1943", "\uD0D1", "\uBA85", "B", "\uD0D102"],
        ["w1944", "\uD65C\uB3D9\uD558\uB2E4", "\uB3D9", "B", "\uD65C\uB3D9\uD558\uB2E401"],
        ["w1945", "\uAC74\uCD95", "\uBA85", "B", "\uAC74\uCD9501"],
        ["w1946", "\uADC0\uC5FD\uB2E4", "\uD615", "B", "\uADC0\uC5FD\uB2E4"],
        ["w1947", "\uB2F5\uB2F5\uD558\uB2E4", "\uD615", "B", "\uB2F5\uB2F5\uD558\uB2E4"],
        ["w1948", "\uB2F9\uD669\uD558\uB2E4", "\uB3D9", "B", "\uB2F9\uD669\uD558\uB2E4"],
        ["w1949", "\uB5A8\uC5B4\uB728\uB9AC\uB2E4", "\uB3D9", "B", "\uB5A8\uC5B4\uB728\uB9AC\uB2E4"],
        ["w1950", "\uB611\uAC19\uC774", "\uBD80", "B", "\uB611\uAC19\uC774"],
        ["w1951", "\uBC00\uAC00\uB8E8", "\uBA85", "B", "\uBC00\uAC00\uB8E8"],
        ["w1952", "\uBC14\uAE65", "\uBA85", "B", "\uBC14\uAE65"],
        ["w1953", "\uBC8C\uB9AC\uB2E4", "\uB3D9", "B", "\uBC8C\uB9AC\uB2E401"],
        ["w1954", "\uBCF4\uACE0\uC11C", "\uBA85", "B", "\uBCF4\uACE0\uC11C"],
        ["w1955", "\uBCF4\uAD00\uD558\uB2E4", "\uB3D9", "B", "\uBCF4\uAD00\uD558\uB2E4"],
        ["w1956", "\uBD80\uB52A\uCE58\uB2E4", "\uB3D9", "B", "\uBD80\uB52A\uCE58\uB2E4"],
        ["w1957", "\uBE68\uB798", "\uBA85", "B", "\uBE68\uB798"],
        ["w1958", "\uC0C1\uD558\uB2E4", "\uB3D9", "B", "\uC0C1\uD558\uB2E402"],
        ["w1959", "\uC2DD\uC6A9\uC720", "\uBA85", "B", "\uC2DD\uC6A9\uC720"],
        ["w1960", "\uAC81", "\uBA85", "B", "\uAC8105"],
        ["w1961", "\uC0B0\uC18C", "\uBA85", "B", "\uC0B0\uC18C03"],
        ["w1962", "\uC11D\uC720", "\uBA85", "B", "\uC11D\uC72001"],
        ["w1963", "\uC18C\uB9AC\uCE58\uB2E4", "\uB3D9", "B", "\uC18C\uB9AC\uCE58\uB2E4"],
        ["w1964", "\uC2E0\uC120\uD558\uB2E4", "\uD615", "B", "\uC2E0\uC120\uD558\uB2E403"],
        ["w1965", "\uC870\uC2EC\uD558\uB2E4", "\uB3D9", "B", "\uC870\uC2EC\uD558\uB2E402"],
        ["w1966", "\uC9C8", "\uBA85", "B", "\uC9C808"],
        ["w1967", "\uCC0C\uB974\uB2E4", "\uB3D9", "B", "\uCC0C\uB974\uB2E4"],
        ["w1968", "\uCC45\uC784\uC790", "\uBA85", "B", "\uCC45\uC784\uC790"],
        ["w1969", "\uD655\uB300\uB418\uB2E4", "\uB3D9", "B", "\uD655\uB300\uB418\uB2E402"],
        ["w1970", "\uAC70\uC2E4", "\uBA85", "B", "\uAC70\uC2E402"],
        ["w1971", "\uBC14\uBCF4", "\uBA85", "B", "\uBC14\uBCF4"],
        ["w1972", "\uBCF4\uB78C", "\uBA85", "B", "\uBCF4\uB78C"],
        ["w1973", "\uBD80\uC791\uC6A9", "\uBA85", "B", "\uBD80\uC791\uC6A9"],
        ["w1974", "\uC2E0\uACE0", "\uBA85", "B", "\uC2E0\uACE001"],
        ["w1975", "\uC5B4\uB5A1\uD558\uB2E4", "\uBD88", "B", "\uC5B4\uB5A1\uD558\uB2E4"],
        ["w1976", "\uC608\uC0C1", "\uBA85", "B", "\uC608\uC0C102"],
        ["w1977", "\uC8FC\uBA39", "\uBA85", "B", "\uC8FC\uBA39"],
        ["w1978", "\uD138\uB2E4", "\uB3D9", "B", "\uD138\uB2E4"],
        ["w1979", "\uACFC\uBAA9", "\uBA85", "B", "\uACFC\uBAA902"],
        ["w1980", "\uADFC\uBB34", "\uBA85", "B", "\uADFC\uBB34"],
        ["w1981", "\uB2EC\uC544\uB098\uB2E4", "\uB3D9", "B", "\uB2EC\uC544\uB098\uB2E4"],
        ["w1982", "\uBB36\uB2E4", "\uB3D9", "B", "\uBB36\uB2E4"],
        ["w1983", "\uC18C\uC2A4", "\uBA85", "B", "\uC18C\uC2A401"],
        ["w1984", "\uC6B0\uB9AC\uB9D0", "\uBA85", "B", "\uC6B0\uB9AC\uB9D0"],
        ["w1985", "\uC720\uAD50", "\uBA85", "B", "\uC720\uAD5002"],
        ["w1986", "\uC774\uBD88", "\uBA85", "B", "\uC774\uBD8801"],
        ["w1987", "\uC774\uC131", "\uBA85", "B", "\uC774\uC13108"],
        ["w1988", "\uC77C\uC0C1", "\uBA85", "B", "\uC77C\uC0C104"],
        ["w1989", "\uC790\uB3D9", "\uBA85", "B", "\uC790\uB3D901"],
        ["w1990", "\uC7A5\uB798", "\uBA85", "B", "\uC7A5\uB798"],
        ["w1991", "\uC911\uC694\uC131", "\uBA85", "B", "\uC911\uC694\uC131"],
        ["w1992", "\uD0E4\uB7F0\uD2B8", "\uBA85", "B", "\uD0E4\uB7F0\uD2B8"],
        ["w1993", "\uD2B9\uBCC4\uD788", "\uBD80", "B", "\uD2B9\uBCC4\uD788"],
        ["w1994", "\uACFC\uD559\uC801", "\uBA85", "B", "\uACFC\uD559\uC801"],
        ["w1995", "\uBD09\uD22C", "\uBA85", "B", "\uBD09\uD22C02"],
        ["w1996", "\uBD84\uBA85", "\uBD80", "B", "\uBD84\uBA8501"],
        ["w1997", "\uCD94\uC5B5", "\uBA85", "B", "\uCD94\uC5B5"],
        ["w1998", "\uD558\uC5EC\uD2BC", "\uBD80", "B", "\uD558\uC5EC\uD2BC"],
        ["w1999", "\uD568\uBD80\uB85C", "\uBD80", "B", "\uD568\uBD80\uB85C"],
        ["w2000", "\uD5A5\uAE30", "\uBA85", "B", "\uD5A5\uAE3001"]
      ]
    };
  }
});

// strata/maps/topik-i.json
var require_topik_i = __commonJS({
  "strata/maps/topik-i.json"(exports, module) {
    module.exports = {
      map_ver: "topik-i-practice-1-c6e2390a4b06",
      subject: "ko",
      sources: {
        "practice-taxonomy": {
          path: "strata/topik-i.skills.json",
          sha256: "8923b769ed247dd6628df276fdd5e8ddf421d863b012f42aa34bce4e324c1513"
        },
        "practice-grammar": {
          path: "strata/topik-i.grammar.json",
          sha256: "a5bb38207df2818f84136a3f4c5d1b8f3452aabf18f7e61de0f1e8f508d15266"
        },
        "practice-words": {
          path: "strata/topik-i.words.json",
          sha256: "3ff79fba027771bc8ccf12434a2c630f550df730eb79fe2f8b716bcb9f7b3347"
        },
        "practice-situations": {
          path: "strata/topik-i.situations.json",
          sha256: "38fed71d3ce08007714ffaa50ffdaa1a291b2948a235db4988ffe978c4163c0a"
        }
      },
      nodes: [
        {
          id: "ko.listening.word",
          kind: "skill",
          label_ko: "\uB0B1\uB9D0 \uB4E3\uAE30",
          domain: "listening",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.listening.detail",
          kind: "skill",
          label_ko: "\uB4E3\uACE0 \uC138\uBD80 \uC815\uBCF4 \uCC3E\uAE30",
          domain: "listening",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.listening.negation",
          kind: "skill",
          label_ko: "\uB4E3\uACE0 \uBD80\uC815\xB7\uBCC0\uACBD \uC774\uD574\uD558\uAE30",
          domain: "listening",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.listening.sequence",
          kind: "skill",
          label_ko: "\uB4E3\uACE0 \uC21C\uC11C \uC774\uD574\uD558\uAE30",
          domain: "listening",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.listening.reason",
          kind: "skill",
          label_ko: "\uB4E3\uACE0 \uC774\uC720 \uC774\uD574\uD558\uAE30",
          domain: "listening",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.listening.condition",
          kind: "skill",
          label_ko: "\uB4E3\uACE0 \uC870\uAC74 \uC774\uD574\uD558\uAE30",
          domain: "listening",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.listening.main",
          kind: "skill",
          label_ko: "\uB4E3\uACE0 \uD575\uC2EC \uC774\uD574\uD558\uAE30",
          domain: "listening",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.reading.vocabulary",
          kind: "skill",
          label_ko: "\uB0B1\uB9D0 \uB73B \uC77D\uAE30",
          domain: "reading",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.reading.grammar",
          kind: "skill",
          label_ko: "\uC870\uC0AC\xB7\uBB38\uD615 \uC77D\uAE30",
          domain: "reading",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.reading.detail",
          kind: "skill",
          label_ko: "\uC77D\uACE0 \uC138\uBD80 \uC815\uBCF4 \uCC3E\uAE30",
          domain: "reading",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.reading.negation",
          kind: "skill",
          label_ko: "\uC77D\uACE0 \uBD80\uC815\xB7\uBCC0\uACBD \uC774\uD574\uD558\uAE30",
          domain: "reading",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.reading.sequence",
          kind: "skill",
          label_ko: "\uC77D\uACE0 \uC21C\uC11C \uC774\uD574\uD558\uAE30",
          domain: "reading",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.reading.reason",
          kind: "skill",
          label_ko: "\uC77D\uACE0 \uC774\uC720 \uC774\uD574\uD558\uAE30",
          domain: "reading",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.reading.condition",
          kind: "skill",
          label_ko: "\uC77D\uACE0 \uC870\uAC74 \uC774\uD574\uD558\uAE30",
          domain: "reading",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "ko.reading.main",
          kind: "skill",
          label_ko: "\uC77D\uACE0 \uD575\uC2EC \uC774\uD574\uD558\uAE30",
          domain: "reading",
          level: null,
          difficulty: {
            authored: null,
            measured: null,
            n: 0
          },
          source_refs: [
            {
              source: "practice-taxonomy",
              selector: "skills"
            }
          ]
        },
        {
          id: "G201",
          kind: "grammar_point",
          label_ko: "\uC774/\uAC00",
          forms: [
            "\uC774/\uAC00"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G201"
            }
          ]
        },
        {
          id: "G202",
          kind: "grammar_point",
          label_ko: "\uC740/\uB294",
          forms: [
            "\uC740/\uB294"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G202"
            }
          ]
        },
        {
          id: "G203",
          kind: "grammar_point",
          label_ko: "\uC744/\uB97C",
          forms: [
            "\uC744/\uB97C"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G203"
            }
          ]
        },
        {
          id: "G204",
          kind: "grammar_point",
          label_ko: "-\uC774\uC5D0\uC694/\uC608\uC694",
          forms: [
            "-\uC774\uC5D0\uC694/\uC608\uC694"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G204"
            }
          ]
        },
        {
          id: "G205",
          kind: "grammar_point",
          label_ko: "-\uC544/\uC5B4\uC694",
          forms: [
            "-\uC544/\uC5B4\uC694"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G205"
            }
          ]
        },
        {
          id: "G206",
          kind: "grammar_point",
          label_ko: "\uC5D0",
          forms: [
            "\uC5D0"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G206"
            }
          ]
        },
        {
          id: "G207",
          kind: "grammar_point",
          label_ko: "\uC5D0\uC11C",
          forms: [
            "\uC5D0\uC11C"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G207"
            }
          ]
        },
        {
          id: "G208",
          kind: "grammar_point",
          label_ko: "-\uC558/\uC5C8\uC5B4\uC694",
          forms: [
            "-\uC558/\uC5C8\uC5B4\uC694"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G208"
            }
          ]
        },
        {
          id: "G209",
          kind: "grammar_point",
          label_ko: "\uC548 \uBD80\uC815",
          forms: [
            "\uC548 \uBD80\uC815"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G209"
            }
          ]
        },
        {
          id: "G210",
          kind: "grammar_point",
          label_ko: "\uD558\uACE0/\uC640/\uACFC",
          forms: [
            "\uD558\uACE0/\uC640/\uACFC"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G210"
            }
          ]
        },
        {
          id: "G211",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uC138\uC694",
          forms: [
            "-(\uC73C)\uC138\uC694"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G211"
            }
          ]
        },
        {
          id: "G212",
          kind: "grammar_point",
          label_ko: "\uC22B\uC790/\uC2DC\uAC04 \uD45C\uD604",
          forms: [
            "\uC22B\uC790/\uC2DC\uAC04 \uD45C\uD604"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G212"
            }
          ]
        },
        {
          id: "G301",
          kind: "grammar_point",
          label_ko: "-\uACE0 \uC2F6\uB2E4",
          forms: [
            "-\uACE0 \uC2F6\uB2E4"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G301"
            }
          ]
        },
        {
          id: "G302",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139 \uAC70\uC608\uC694",
          forms: [
            "-(\uC73C)\u3139 \uAC70\uC608\uC694"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G302"
            }
          ]
        },
        {
          id: "G303",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uB7EC \uAC00\uB2E4",
          forms: [
            "-(\uC73C)\uB7EC \uAC00\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G303"
            }
          ]
        },
        {
          id: "G304",
          kind: "grammar_point",
          label_ko: "-\uC9C0 \uC54A\uB2E4",
          forms: [
            "-\uC9C0 \uC54A\uB2E4"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G304"
            }
          ]
        },
        {
          id: "G305",
          kind: "grammar_point",
          label_ko: "\uBABB \uBD80\uC815",
          forms: [
            "\uBABB \uBD80\uC815"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G305"
            }
          ]
        },
        {
          id: "G306",
          kind: "grammar_point",
          label_ko: "-\uACE0",
          forms: [
            "-\uACE0"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G306"
            }
          ]
        },
        {
          id: "G307",
          kind: "grammar_point",
          label_ko: "-\uC9C0\uB9CC",
          forms: [
            "-\uC9C0\uB9CC"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G307"
            }
          ]
        },
        {
          id: "G308",
          kind: "grammar_point",
          label_ko: "-\uC544/\uC5B4\uC11C",
          forms: [
            "-\uC544/\uC5B4\uC11C"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G308"
            }
          ]
        },
        {
          id: "G309",
          kind: "grammar_point",
          label_ko: "(\uC73C)\uB85C",
          forms: [
            "(\uC73C)\uB85C"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G309"
            }
          ]
        },
        {
          id: "G310",
          kind: "grammar_point",
          label_ko: "\uC5D0\uAC8C/\uD55C\uD14C",
          forms: [
            "\uC5D0\uAC8C/\uD55C\uD14C"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G310"
            }
          ]
        },
        {
          id: "G311",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139\uAE4C\uC694?",
          forms: [
            "-(\uC73C)\u3139\uAE4C\uC694?"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G311"
            }
          ]
        },
        {
          id: "G312",
          kind: "grammar_point",
          label_ko: "\uBCF4\uB2E4",
          forms: [
            "\uBCF4\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G312"
            }
          ]
        },
        {
          id: "G313",
          kind: "grammar_point",
          label_ko: "-\uC9C0 \uBABB\uD558\uB2E4",
          forms: [
            "-\uC9C0 \uBABB\uD558\uB2E4"
          ],
          level: {
            intro: 1,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G313"
            }
          ]
        },
        {
          id: "G401",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uBA74",
          forms: [
            "-(\uC73C)\uBA74"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G401"
            }
          ]
        },
        {
          id: "G402",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139 \uC218 \uC788\uB2E4/\uC5C6\uB2E4",
          forms: [
            "-(\uC73C)\u3139 \uC218 \uC788\uB2E4/\uC5C6\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G402"
            }
          ]
        },
        {
          id: "G403",
          kind: "grammar_point",
          label_ko: "-\uC544/\uC5B4\uC57C \uD558\uB2E4/\uB418\uB2E4",
          forms: [
            "-\uC544/\uC5B4\uC57C \uD558\uB2E4",
            "-\uC544/\uC5B4\uC57C \uB418\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G403"
            }
          ]
        },
        {
          id: "G404",
          kind: "grammar_point",
          label_ko: "-\uC544/\uC5B4 \uC8FC\uC138\uC694",
          forms: [
            "-\uC544/\uC5B4 \uC8FC\uC138\uC694"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G404"
            }
          ]
        },
        {
          id: "G405",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uB824\uACE0 \uD558\uB2E4",
          forms: [
            "-(\uC73C)\uB824\uACE0 \uD558\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G405"
            }
          ]
        },
        {
          id: "G406",
          kind: "grammar_point",
          label_ko: "-\uAE30 \uC804\uC5D0/-(\uC73C)\u3134 \uD6C4\uC5D0",
          forms: [
            "-\uAE30 \uC804\uC5D0/-(\uC73C)\u3134 \uD6C4\uC5D0"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G406"
            }
          ]
        },
        {
          id: "G407",
          kind: "grammar_point",
          label_ko: "-\uB294 \uAC83",
          forms: [
            "-\uB294 \uAC83"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G407"
            }
          ]
        },
        {
          id: "G408",
          kind: "grammar_point",
          label_ko: "-\uC544/\uC5B4 \uBCF4\uB2E4",
          forms: [
            "-\uC544/\uC5B4 \uBCF4\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G408"
            }
          ]
        },
        {
          id: "G409",
          kind: "grammar_point",
          label_ko: "-\uACE0 \uC788\uB2E4",
          forms: [
            "-\uACE0 \uC788\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G409"
            }
          ]
        },
        {
          id: "G410",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uB2C8\uAE4C",
          forms: [
            "-(\uC73C)\uB2C8\uAE4C"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G410"
            }
          ]
        },
        {
          id: "G411",
          kind: "grammar_point",
          label_ko: "-\uB124\uC694",
          forms: [
            "-\uB124\uC694"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G411"
            }
          ]
        },
        {
          id: "G412",
          kind: "grammar_point",
          label_ko: "-\uC9C0\uC694?",
          forms: [
            "-\uC9C0\uC694?"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G412"
            }
          ]
        },
        {
          id: "G501",
          kind: "grammar_point",
          label_ko: "\uAD00\uD615\uD615 -(\uC73C)\u3134/\uB294/(\uC73C)\u3139",
          forms: [
            "\uAD00\uD615\uD615 -(\uC73C)\u3134/\uB294/(\uC73C)\u3139"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G501"
            }
          ]
        },
        {
          id: "G505",
          kind: "grammar_point",
          label_ko: "-\uC544/\uC5B4\uB3C4 \uB418\uB2E4",
          forms: [
            "-\uC544/\uC5B4\uB3C4 \uB418\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G505"
            }
          ]
        },
        {
          id: "G506",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uBA74 \uC548 \uB418\uB2E4",
          forms: [
            "-(\uC73C)\uBA74 \uC548 \uB418\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G506"
            }
          ]
        },
        {
          id: "G509",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3134 \uC801\uC774 \uC788\uB2E4",
          forms: [
            "-(\uC73C)\u3134 \uC801\uC774 \uC788\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G509"
            }
          ]
        },
        {
          id: "G603",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139 \uB54C",
          forms: [
            "-(\uC73C)\u3139 \uB54C"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G603"
            }
          ]
        },
        {
          id: "G608",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139 \uAC83 \uAC19\uB2E4",
          forms: [
            "-(\uC73C)\u3139 \uAC83 \uAC19\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G608"
            }
          ]
        },
        {
          id: "G610",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3134/\uB294\uB370",
          forms: [
            "-(\uC73C)\u3134/\uB294\uB370"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G610"
            }
          ]
        },
        {
          id: "G612",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139\uAC8C\uC694/-(\uC73C)\u3139\uB798\uC694",
          forms: [
            "-(\uC73C)\u3139\uAC8C\uC694/-(\uC73C)\u3139\uB798\uC694"
          ],
          level: {
            intro: 2,
            basis: "grammar_bank"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G612"
            }
          ]
        },
        {
          id: "S101",
          kind: "grammar_point",
          label_ko: "\uAED8\uC11C",
          forms: [
            "\uAED8\uC11C"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S101"
            }
          ]
        },
        {
          id: "S102",
          kind: "grammar_point",
          label_ko: "\uB3C4",
          forms: [
            "\uB3C4"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S102"
            }
          ]
        },
        {
          id: "S103",
          kind: "grammar_point",
          label_ko: "\uC774\uB791/\uB791",
          forms: [
            "\uC774\uB791/\uB791"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S103"
            }
          ]
        },
        {
          id: "S104",
          kind: "grammar_point",
          label_ko: "\uBD80\uD130",
          forms: [
            "\uBD80\uD130"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S104"
            }
          ]
        },
        {
          id: "S105",
          kind: "grammar_point",
          label_ko: "\uAE4C\uC9C0",
          forms: [
            "\uAE4C\uC9C0"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S105"
            }
          ]
        },
        {
          id: "S106",
          kind: "grammar_point",
          label_ko: "\uC758",
          forms: [
            "\uC758"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S106"
            }
          ]
        },
        {
          id: "S107",
          kind: "grammar_point",
          label_ko: "\uB9CC",
          forms: [
            "\uB9CC"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S107"
            }
          ]
        },
        {
          id: "S108",
          kind: "grammar_point",
          label_ko: "-\uACA0-",
          forms: [
            "-\uACA0-"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S108"
            }
          ]
        },
        {
          id: "S109",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uC2DC-",
          forms: [
            "-(\uC73C)\uC2DC-"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S109"
            }
          ]
        },
        {
          id: "S110",
          kind: "grammar_point",
          label_ko: "-\uC2B5\uB2C8\uAE4C/-\u3142\uB2C8\uAE4C",
          forms: [
            "-\uC2B5\uB2C8\uAE4C/-\u3142\uB2C8\uAE4C"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S110"
            }
          ]
        },
        {
          id: "S111",
          kind: "grammar_point",
          label_ko: "-\uC2B5\uB2C8\uB2E4/-\u3142\uB2C8\uB2E4",
          forms: [
            "-\uC2B5\uB2C8\uB2E4/-\u3142\uB2C8\uB2E4"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S111"
            }
          ]
        },
        {
          id: "S112",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3142\uC2DC\uB2E4",
          forms: [
            "-(\uC73C)\u3142\uC2DC\uB2E4"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S112"
            }
          ]
        },
        {
          id: "S113",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uC2ED\uC2DC\uC624",
          forms: [
            "-(\uC73C)\uC2ED\uC2DC\uC624"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S113"
            }
          ]
        },
        {
          id: "S114",
          kind: "grammar_point",
          label_ko: "-\uACE0\uC694",
          forms: [
            "-\uACE0\uC694"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S114"
            }
          ]
        },
        {
          id: "S115",
          kind: "grammar_point",
          label_ko: "\uC774/\uAC00 \uC544\uB2C8\uB2E4",
          forms: [
            "\uC774/\uAC00 \uC544\uB2C8\uB2E4"
          ],
          level: {
            intro: 1,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S115"
            }
          ]
        },
        {
          id: "S201",
          kind: "grammar_point",
          label_ko: "\uAED8",
          forms: [
            "\uAED8"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S201"
            }
          ]
        },
        {
          id: "S202",
          kind: "grammar_point",
          label_ko: "\uB9C8\uB2E4",
          forms: [
            "\uB9C8\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S202"
            }
          ]
        },
        {
          id: "S203",
          kind: "grammar_point",
          label_ko: "\uBC16\uC5D0",
          forms: [
            "\uBC16\uC5D0"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S203"
            }
          ]
        },
        {
          id: "S204",
          kind: "grammar_point",
          label_ko: "\uCC98\uB7FC",
          forms: [
            "\uCC98\uB7FC"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S204"
            }
          ]
        },
        {
          id: "S205",
          kind: "grammar_point",
          label_ko: "\uC5D0\uC11C\uBD80\uD130",
          forms: [
            "\uC5D0\uC11C\uBD80\uD130"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S205"
            }
          ]
        },
        {
          id: "S206",
          kind: "grammar_point",
          label_ko: "\uC5D0\uB2E4\uAC00",
          forms: [
            "\uC5D0\uB2E4\uAC00/\uC5D0\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S206"
            }
          ]
        },
        {
          id: "S207",
          kind: "grammar_point",
          label_ko: "\uC5D0\uAC8C\uB85C",
          forms: [
            "\uC5D0\uAC8C\uB85C"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S207"
            }
          ]
        },
        {
          id: "S208",
          kind: "grammar_point",
          label_ko: "\uC5D0\uAC8C\uC11C",
          forms: [
            "\uC5D0\uAC8C\uC11C"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S208"
            }
          ]
        },
        {
          id: "S209",
          kind: "grammar_point",
          label_ko: "\uD55C\uD14C\uC11C",
          forms: [
            "\uD55C\uD14C\uC11C"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S209"
            }
          ]
        },
        {
          id: "S210",
          kind: "grammar_point",
          label_ko: "(\uC774)\uB098",
          forms: [
            "\uC774\uB098/\uB098"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S210"
            }
          ]
        },
        {
          id: "S211",
          kind: "grammar_point",
          label_ko: "-\uAC70\uB098",
          forms: [
            "-\uAC70\uB098"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S211"
            }
          ]
        },
        {
          id: "S212",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\uBA74\uC11C",
          forms: [
            "-(\uC73C)\uBA74\uC11C"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S212"
            }
          ]
        },
        {
          id: "S213",
          kind: "grammar_point",
          label_ko: "-\uAC8C (\uBAA9\uC801)",
          forms: [
            "-\uAC8C"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S213"
            }
          ]
        },
        {
          id: "S214",
          kind: "grammar_point",
          label_ko: "-\uB2E4\uAC00",
          forms: [
            "-\uB2E4\uAC00"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S214"
            }
          ]
        },
        {
          id: "S215",
          kind: "grammar_point",
          label_ko: "-\uAE30 (\uBA85\uC0AC\uD615)",
          forms: [
            "-\uAE30"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S215"
            }
          ]
        },
        {
          id: "S216",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3141 (\uBA85\uC0AC\uD615)",
          forms: [
            "-(\uC73C)\u3141"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S216"
            }
          ]
        },
        {
          id: "S217",
          kind: "grammar_point",
          label_ko: "-\uB294\uAD70\uC694",
          forms: [
            "-\uB294\uAD70\uC694/-\uAD70\uC694"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S217"
            }
          ]
        },
        {
          id: "S218",
          kind: "grammar_point",
          label_ko: "-\uAC8C \uB418\uB2E4",
          forms: [
            "-\uAC8C \uB418\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S218"
            }
          ]
        },
        {
          id: "S219",
          kind: "grammar_point",
          label_ko: "-\uAE30 \uB54C\uBB38\uC5D0",
          forms: [
            "-\uAE30 \uB54C\uBB38\uC5D0"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S219"
            }
          ]
        },
        {
          id: "S220",
          kind: "grammar_point",
          label_ko: "-\uAE30\uB85C \uD558\uB2E4",
          forms: [
            "-\uAE30\uB85C \uD558\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S220"
            }
          ]
        },
        {
          id: "S221",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3134 \uC9C0",
          forms: [
            "-(\uC73C)\u3134 \uC9C0"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S221"
            }
          ]
        },
        {
          id: "S222",
          kind: "grammar_point",
          label_ko: "-\uB294 \uB3D9\uC548(\uC5D0)",
          forms: [
            "-\uB294 \uB3D9\uC548(\uC5D0)"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S222"
            }
          ]
        },
        {
          id: "S223",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139 \uAC83 (\uBA85\uB839\xB7\uC9C0\uC2DC)",
          forms: [
            "-(\uC73C)\u3139 \uAC83"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S223"
            }
          ]
        },
        {
          id: "S224",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139\uAE4C \uBCF4\uB2E4",
          forms: [
            "-(\uC73C)\u3139\uAE4C \uBCF4\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S224"
            }
          ]
        },
        {
          id: "S225",
          kind: "grammar_point",
          label_ko: "-\uC544/\uC5B4 \uC788\uB2E4",
          forms: [
            "-\uC544/\uC5B4 \uC788\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S225"
            }
          ]
        },
        {
          id: "S226",
          kind: "grammar_point",
          label_ko: "-\uC9C0 \uB9D0\uB2E4",
          forms: [
            "-\uC9C0 \uB9D0\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S226"
            }
          ]
        },
        {
          id: "S227",
          kind: "grammar_point",
          label_ko: "-(\uC73C)\u3139 \uC218\uBC16\uC5D0 \uC5C6\uB2E4",
          forms: [
            "-(\uC73C)\u3139 \uC218\uBC16\uC5D0 \uC5C6\uB2E4"
          ],
          level: {
            intro: 2,
            basis: "standard-curriculum-2017"
          },
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S227"
            }
          ]
        },
        {
          id: "sit-culture-speech-level",
          kind: "situation",
          label_ko: "\uB300\uC0AC\uC640 \uAC00\uC0AC\uC758 \uBC18\uB9D0\xB7\uC874\uB313\uB9D0",
          when_ko: "\uB300\uC0AC\uC640 \uAC00\uC0AC\uC5D0\uC11C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-culture-speech-level"
            }
          ]
        },
        {
          id: "sit-culture-abbreviation",
          kind: "situation",
          label_ko: "\uC904\uC784\uB9D0",
          when_ko: "\uCE5C\uAD6C\uB07C\uB9AC \uC904\uC5EC\uC11C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-culture-abbreviation"
            }
          ]
        },
        {
          id: "sit-culture-emotion",
          kind: "situation",
          label_ko: "\uAC10\uC815 \uD45C\uD604",
          when_ko: "\uAE30\uBD84\uC744 \uB9D0\uD560 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-culture-emotion"
            }
          ]
        },
        {
          id: "sit-travel-directions",
          kind: "situation",
          label_ko: "\uAE38 \uBB3B\uAE30",
          when_ko: "\uAE38\uC744 \uBB3C\uC744 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-travel-directions"
            }
          ]
        },
        {
          id: "sit-travel-order",
          kind: "situation",
          label_ko: "\uC8FC\uBB38",
          when_ko: "\uC8FC\uBB38\uD560 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-travel-order"
            }
          ]
        },
        {
          id: "sit-travel-transport",
          kind: "situation",
          label_ko: "\uAD50\uD1B5",
          when_ko: "\uBC84\uC2A4\uB098 \uC9C0\uD558\uCCA0\uC744 \uD0C8 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-travel-transport"
            }
          ]
        },
        {
          id: "sit-travel-lodging",
          kind: "situation",
          label_ko: "\uC219\uC18C",
          when_ko: "\uC219\uC18C\uC5D0\uC11C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-travel-lodging"
            }
          ]
        },
        {
          id: "sit-travel-shopping",
          kind: "situation",
          label_ko: "\uC1FC\uD551",
          when_ko: "\uBB3C\uAC74\uC744 \uC0B4 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-travel-shopping"
            }
          ]
        },
        {
          id: "sit-people-greeting",
          kind: "situation",
          label_ko: "\uC548\uBD80",
          when_ko: "\uC548\uBD80\uB97C \uBB3C\uC744 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-people-greeting"
            }
          ]
        },
        {
          id: "sit-people-address",
          kind: "situation",
          label_ko: "\uD638\uCE6D",
          when_ko: "\uC0AC\uB78C\uC744 \uBD80\uB97C \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-people-address"
            }
          ]
        },
        {
          id: "sit-people-honorific",
          kind: "situation",
          label_ko: "\uB192\uC784\uB9D0 \uACE0\uB974\uAE30",
          when_ko: "\uC717\uC0AC\uB78C\uACFC \uC774\uC57C\uAE30\uD560 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-people-honorific"
            }
          ]
        },
        {
          id: "sit-people-messenger",
          kind: "situation",
          label_ko: "\uC601\uC0C1\uD1B5\uD654\xB7\uBA54\uC2E0\uC800",
          when_ko: "\uC601\uC0C1\uD1B5\uD654\uB098 \uBA54\uC2E0\uC800\uC5D0\uC11C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-people-messenger"
            }
          ]
        },
        {
          id: "sit-life-office",
          kind: "situation",
          label_ko: "\uC8FC\uBBFC\uC13C\uD130\xB7\uBCD1\uC6D0\xB7\uC740\uD589",
          when_ko: "\uC8FC\uBBFC\uC13C\uD130\xB7\uBCD1\uC6D0\xB7\uC740\uD589\uC5D0\uC11C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-life-office"
            }
          ]
        },
        {
          id: "sit-life-notice",
          kind: "situation",
          label_ko: "\uACF5\uACF5 \uC548\uB0B4\uBB38 \uC77D\uAE30",
          when_ko: "\uC548\uB0B4\uBB38\uC744 \uC77D\uC744 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-life-notice"
            }
          ]
        },
        {
          id: "sit-study-lecture",
          kind: "situation",
          label_ko: "\uAC15\uC758 \uB4E3\uAE30",
          when_ko: "\uAC15\uC758\uB97C \uB4E4\uC744 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-study-lecture"
            }
          ]
        },
        {
          id: "sit-study-presentation",
          kind: "situation",
          label_ko: "\uBC1C\uD45C",
          when_ko: "\uBC1C\uD45C\uD560 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-study-presentation"
            }
          ]
        },
        {
          id: "sit-study-professor-email",
          kind: "situation",
          label_ko: "\uAD50\uC218\uB2D8\uAED8 \uBA54\uC77C",
          when_ko: "\uAD50\uC218\uB2D8\uAED8 \uBA54\uC77C\uC744 \uC4F8 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-study-professor-email"
            }
          ]
        },
        {
          id: "sit-study-assignment",
          kind: "situation",
          label_ko: "\uACFC\uC81C",
          when_ko: "\uACFC\uC81C\uB97C \uD560 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-study-assignment"
            }
          ]
        },
        {
          id: "sit-work-instructions",
          kind: "situation",
          label_ko: "\uC791\uC5C5 \uC9C0\uC2DC \uB4E3\uAE30",
          when_ko: "\uC791\uC5C5 \uC9C0\uC2DC\uB97C \uB4E4\uC744 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-work-instructions"
            }
          ]
        },
        {
          id: "sit-work-safety-sign",
          kind: "situation",
          label_ko: "\uC548\uC804 \uD45C\uC9C0",
          when_ko: "\uC548\uC804 \uD45C\uC9C0\uB97C \uC77D\uC744 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-work-safety-sign"
            }
          ]
        },
        {
          id: "sit-work-colleague",
          kind: "situation",
          label_ko: "\uB3D9\uB8CC\uC640 \uB300\uD654",
          when_ko: "\uB3D9\uB8CC\uC640 \uC774\uC57C\uAE30\uD560 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-work-colleague"
            }
          ]
        },
        {
          id: "sit-work-interview",
          kind: "situation",
          label_ko: "\uBA74\uC811",
          when_ko: "\uBA74\uC811\uC744 \uBCFC \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-work-interview"
            }
          ]
        },
        {
          id: "sit-career-email",
          kind: "situation",
          label_ko: "\uBA54\uC77C",
          when_ko: "\uC5C5\uBB34 \uBA54\uC77C\uC744 \uC4F8 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-career-email"
            }
          ]
        },
        {
          id: "sit-career-report",
          kind: "situation",
          label_ko: "\uD68C\uC758 \uBCF4\uACE0",
          when_ko: "\uD68C\uC758\uC5D0\uC11C \uBCF4\uACE0\uD560 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-career-report"
            }
          ]
        },
        {
          id: "sit-career-phone",
          kind: "situation",
          label_ko: "\uC804\uD654",
          when_ko: "\uC5C5\uBB34 \uC804\uD654\uB97C \uD560 \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-career-phone"
            }
          ]
        },
        {
          id: "sit-career-schedule",
          kind: "situation",
          label_ko: "\uC77C\uC815 \uC870\uC728",
          when_ko: "\uC77C\uC815\uC744 \uB9DE\uCD9C \uB54C",
          level: null,
          source_refs: [
            {
              source: "practice-situations",
              selector: "sit-career-schedule"
            }
          ]
        }
      ],
      edges: [
        {
          from: "G201",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G201"
            }
          ]
        },
        {
          from: "G202",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G202"
            }
          ]
        },
        {
          from: "G203",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G203"
            }
          ]
        },
        {
          from: "G204",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G204"
            }
          ]
        },
        {
          from: "G205",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G205"
            }
          ]
        },
        {
          from: "G206",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G206"
            }
          ]
        },
        {
          from: "G207",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G207"
            }
          ]
        },
        {
          from: "G208",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G208"
            }
          ]
        },
        {
          from: "G209",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G209"
            }
          ]
        },
        {
          from: "G209",
          to: "ko.listening.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G209"
            }
          ]
        },
        {
          from: "G209",
          to: "ko.reading.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G209"
            }
          ]
        },
        {
          from: "G210",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G210"
            }
          ]
        },
        {
          from: "G211",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G211"
            }
          ]
        },
        {
          from: "G212",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G212"
            }
          ]
        },
        {
          from: "G212",
          to: "ko.listening.detail",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G212"
            }
          ]
        },
        {
          from: "G212",
          to: "ko.reading.detail",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G212"
            }
          ]
        },
        {
          from: "G301",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G301"
            }
          ]
        },
        {
          from: "G302",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G302"
            }
          ]
        },
        {
          from: "G303",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G303"
            }
          ]
        },
        {
          from: "G304",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G304"
            }
          ]
        },
        {
          from: "G304",
          to: "ko.listening.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G304"
            }
          ]
        },
        {
          from: "G304",
          to: "ko.reading.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G304"
            }
          ]
        },
        {
          from: "G305",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G305"
            }
          ]
        },
        {
          from: "G305",
          to: "ko.listening.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G305"
            }
          ]
        },
        {
          from: "G305",
          to: "ko.reading.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G305"
            }
          ]
        },
        {
          from: "G306",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G306"
            }
          ]
        },
        {
          from: "G307",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G307"
            }
          ]
        },
        {
          from: "G308",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G308"
            }
          ]
        },
        {
          from: "G308",
          to: "ko.listening.reason",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G308"
            }
          ]
        },
        {
          from: "G308",
          to: "ko.reading.reason",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G308"
            }
          ]
        },
        {
          from: "G309",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G309"
            }
          ]
        },
        {
          from: "G310",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G310"
            }
          ]
        },
        {
          from: "G311",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G311"
            }
          ]
        },
        {
          from: "G312",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G312"
            }
          ]
        },
        {
          from: "G313",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G313"
            }
          ]
        },
        {
          from: "G313",
          to: "ko.listening.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G313"
            }
          ]
        },
        {
          from: "G313",
          to: "ko.reading.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G313"
            }
          ]
        },
        {
          from: "G401",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G401"
            }
          ]
        },
        {
          from: "G401",
          to: "ko.listening.condition",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G401"
            }
          ]
        },
        {
          from: "G401",
          to: "ko.reading.condition",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G401"
            }
          ]
        },
        {
          from: "G402",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G402"
            }
          ]
        },
        {
          from: "G403",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G403"
            }
          ]
        },
        {
          from: "G404",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G404"
            }
          ]
        },
        {
          from: "G405",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G405"
            }
          ]
        },
        {
          from: "G406",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G406"
            }
          ]
        },
        {
          from: "G406",
          to: "ko.listening.sequence",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G406"
            }
          ]
        },
        {
          from: "G406",
          to: "ko.reading.sequence",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G406"
            }
          ]
        },
        {
          from: "G407",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G407"
            }
          ]
        },
        {
          from: "G408",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G408"
            }
          ]
        },
        {
          from: "G409",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G409"
            }
          ]
        },
        {
          from: "G410",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G410"
            }
          ]
        },
        {
          from: "G410",
          to: "ko.listening.reason",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G410"
            }
          ]
        },
        {
          from: "G410",
          to: "ko.reading.reason",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G410"
            }
          ]
        },
        {
          from: "G411",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G411"
            }
          ]
        },
        {
          from: "G412",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G412"
            }
          ]
        },
        {
          from: "G501",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G501"
            }
          ]
        },
        {
          from: "G505",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G505"
            }
          ]
        },
        {
          from: "G506",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G506"
            }
          ]
        },
        {
          from: "G509",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G509"
            }
          ]
        },
        {
          from: "G603",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G603"
            }
          ]
        },
        {
          from: "G608",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G608"
            }
          ]
        },
        {
          from: "G610",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G610"
            }
          ]
        },
        {
          from: "G612",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "G612"
            }
          ]
        },
        {
          from: "S101",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S101"
            }
          ]
        },
        {
          from: "S102",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S102"
            }
          ]
        },
        {
          from: "S103",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S103"
            }
          ]
        },
        {
          from: "S104",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S104"
            }
          ]
        },
        {
          from: "S105",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S105"
            }
          ]
        },
        {
          from: "S106",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S106"
            }
          ]
        },
        {
          from: "S107",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S107"
            }
          ]
        },
        {
          from: "S108",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S108"
            }
          ]
        },
        {
          from: "S109",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S109"
            }
          ]
        },
        {
          from: "S110",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S110"
            }
          ]
        },
        {
          from: "S111",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S111"
            }
          ]
        },
        {
          from: "S112",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S112"
            }
          ]
        },
        {
          from: "S113",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S113"
            }
          ]
        },
        {
          from: "S114",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S114"
            }
          ]
        },
        {
          from: "S115",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S115"
            }
          ]
        },
        {
          from: "S115",
          to: "ko.listening.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S115"
            }
          ]
        },
        {
          from: "S115",
          to: "ko.reading.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S115"
            }
          ]
        },
        {
          from: "S201",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S201"
            }
          ]
        },
        {
          from: "S202",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S202"
            }
          ]
        },
        {
          from: "S203",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S203"
            }
          ]
        },
        {
          from: "S204",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S204"
            }
          ]
        },
        {
          from: "S205",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S205"
            }
          ]
        },
        {
          from: "S206",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S206"
            }
          ]
        },
        {
          from: "S207",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S207"
            }
          ]
        },
        {
          from: "S208",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S208"
            }
          ]
        },
        {
          from: "S209",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S209"
            }
          ]
        },
        {
          from: "S210",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S210"
            }
          ]
        },
        {
          from: "S211",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S211"
            }
          ]
        },
        {
          from: "S212",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S212"
            }
          ]
        },
        {
          from: "S213",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S213"
            }
          ]
        },
        {
          from: "S214",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S214"
            }
          ]
        },
        {
          from: "S214",
          to: "ko.listening.sequence",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S214"
            }
          ]
        },
        {
          from: "S214",
          to: "ko.reading.sequence",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S214"
            }
          ]
        },
        {
          from: "S215",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S215"
            }
          ]
        },
        {
          from: "S216",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S216"
            }
          ]
        },
        {
          from: "S217",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S217"
            }
          ]
        },
        {
          from: "S218",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S218"
            }
          ]
        },
        {
          from: "S219",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S219"
            }
          ]
        },
        {
          from: "S219",
          to: "ko.listening.reason",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S219"
            }
          ]
        },
        {
          from: "S219",
          to: "ko.reading.reason",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S219"
            }
          ]
        },
        {
          from: "S220",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S220"
            }
          ]
        },
        {
          from: "S221",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S221"
            }
          ]
        },
        {
          from: "S222",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S222"
            }
          ]
        },
        {
          from: "S223",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S223"
            }
          ]
        },
        {
          from: "S224",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S224"
            }
          ]
        },
        {
          from: "S225",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S225"
            }
          ]
        },
        {
          from: "S226",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S226"
            }
          ]
        },
        {
          from: "S226",
          to: "ko.listening.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S226"
            }
          ]
        },
        {
          from: "S226",
          to: "ko.reading.negation",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S226"
            }
          ]
        },
        {
          from: "S227",
          to: "ko.reading.grammar",
          type: "part_of",
          confidence: "ai_draft",
          reviewed: false,
          source_refs: [
            {
              source: "practice-grammar",
              selector: "S227"
            }
          ]
        }
      ],
      tag_vocabulary: [],
      links: {
        tags: [],
        goals: [
          {
            goal: "culture",
            nodes: [
              "sit-culture-speech-level",
              "sit-culture-abbreviation",
              "sit-culture-emotion"
            ],
            confidence: "authored",
            reviewed: true,
            source_refs: [
              {
                source: "practice-situations",
                selector: "culture"
              }
            ]
          },
          {
            goal: "travel",
            nodes: [
              "sit-travel-directions",
              "sit-travel-order",
              "sit-travel-transport",
              "sit-travel-lodging",
              "sit-travel-shopping"
            ],
            confidence: "authored",
            reviewed: true,
            source_refs: [
              {
                source: "practice-situations",
                selector: "travel"
              }
            ]
          },
          {
            goal: "people",
            nodes: [
              "sit-people-greeting",
              "sit-people-address",
              "sit-people-honorific",
              "sit-people-messenger"
            ],
            confidence: "authored",
            reviewed: true,
            source_refs: [
              {
                source: "practice-situations",
                selector: "people"
              }
            ]
          },
          {
            goal: "life",
            nodes: [
              "sit-life-office",
              "sit-life-notice"
            ],
            confidence: "authored",
            reviewed: true,
            source_refs: [
              {
                source: "practice-situations",
                selector: "life"
              }
            ]
          },
          {
            goal: "study",
            nodes: [
              "sit-study-lecture",
              "sit-study-presentation",
              "sit-study-professor-email",
              "sit-study-assignment"
            ],
            confidence: "authored",
            reviewed: true,
            source_refs: [
              {
                source: "practice-situations",
                selector: "study"
              }
            ]
          },
          {
            goal: "work",
            nodes: [
              "sit-work-instructions",
              "sit-work-safety-sign",
              "sit-work-colleague",
              "sit-work-interview"
            ],
            confidence: "authored",
            reviewed: true,
            source_refs: [
              {
                source: "practice-situations",
                selector: "work"
              }
            ]
          },
          {
            goal: "career",
            nodes: [
              "sit-career-email",
              "sit-career-report",
              "sit-career-phone",
              "sit-career-schedule"
            ],
            confidence: "authored",
            reviewed: true,
            source_refs: [
              {
                source: "practice-situations",
                selector: "career"
              }
            ]
          }
        ]
      }
    };
  }
});

// strata/topik-i.js
var require_topik_i2 = __commonJS({
  "strata/topik-i.js"(exports, module) {
    "use strict";
    var words = require_topik_i_words();
    var WORD_PREFIX = "ko.word.";
    var wordNodes = (rows2) => rows2.map(([id, word, pos, band]) => ({
      id: `${WORD_PREFIX}${id}`,
      kind: "word",
      label_ko: word,
      level: null,
      pos,
      band,
      source_refs: [{ source: "practice-words", selector: id }]
    }));
    function topikMap({ includeWords = true, base = require_topik_i() } = {}) {
      return includeWords ? { ...base, nodes: [...base.nodes, ...wordNodes(words.words)] } : base;
    }
    module.exports = { topikMap, wordNodes, WORD_PREFIX };
  }
});

// atlas/trail.js
var require_trail = __commonJS({
  "atlas/trail.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkTrail = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const VERSION = "trail-practice-2";
      const TYPES = ["practice.presented", "practice.helped", "practice.attempted", "practice.delivery"];
      const BASE = ["schema", "id", "scope", "at", "recordedAt", "type"];
      const FIELDS = {
        "practice.presented": ["decisionId", "taskId", "taskVersion", "itemKey", "conceptIds", "firstExposure"],
        "practice.helped": ["presentationId", "helpId", "level", "contentRef"],
        "practice.attempted": ["presentationId", "attemptNo", "verdict", "errorTags"],
        "practice.delivery": ["presentationId", "audio"]
      };
      const OPTIONAL = { "practice.presented": ["measure"], "practice.attempted": ["reason", "choice"] };
      const VERDICTS = ["correct", "incorrect", "unassessed", "skipped"];
      const copy2 = (value) => JSON.parse(JSON.stringify(value));
      const canonical = (value) => JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key2) => [key2, entry[key2]])) : entry);
      const id = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      function choiceRecord(value) {
        const optionId = (entry) => typeof entry === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(entry) && !["constructor", "prototype", "__proto__"].includes(entry);
        if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.keys(value).length !== 2 || !Object.hasOwn(value, "selectedId") || !Object.hasOwn(value, "correctId") || !optionId(value.selectedId) || !optionId(value.correctId)) throw new TypeError("Trail: invalid choice IDs");
        return { selectedId: value.selectedId, correctId: value.correctId };
      }
      const time2 = (value) => {
        const n = Date.parse(value);
        if (typeof value !== "string" || !Number.isFinite(n)) throw new TypeError("Trail: invalid time");
        return n;
      };
      const key = (scope) => {
        if (!scope || typeof scope !== "object" || Object.keys(scope).some((k) => !["domain", "workspace", "subject"].includes(k)) || !["LAB", "SHIFT", "PATH"].includes(scope.domain) || !id(scope.workspace) || !id(scope.subject)) throw new TypeError("Trail: invalid practice scope");
        return `${scope.domain}/${scope.workspace}/${scope.subject}`;
      };
      const vouched = /* @__PURE__ */ new WeakMap();
      const freeze = (value) => {
        if (value && typeof value === "object" && !Object.isFrozen(value)) {
          Object.freeze(value);
          for (const k of Object.keys(value)) freeze(value[k]);
        }
        return value;
      };
      const scopeOf = (e) => vouched.get(e)?.scope ?? key(e.scope);
      const atOf = (e) => vouched.get(e)?.at ?? time2(e.at);
      const recordedOf = (e) => vouched.get(e)?.recordedAt ?? time2(e.recordedAt);
      const uniqueList = (values, valid, max) => Array.isArray(values) && values.length <= max && values.every(valid) && new Set(values).size === values.length;
      const tag = (v) => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= 120 && !/[\r\n]/.test(v);
      function validate(event) {
        if (!event || !TYPES.includes(event.type) || event.schema !== 1 || !id(event.id)) throw new TypeError("Trail: invalid practice event");
        const fields = [...BASE, ...FIELDS[event.type]];
        if (Object.keys(event).some((k) => !fields.includes(k) && !(OPTIONAL[event.type] || []).includes(k)) || fields.some((k) => !Object.hasOwn(event, k))) throw new TypeError("Trail: unexpected or missing practice field");
        key(event.scope);
        if (time2(event.recordedAt) < time2(event.at)) throw new TypeError("Trail: recorded before occurrence");
        if (event.type === TYPES[0]) {
          if (![event.decisionId, event.taskId, event.taskVersion, event.itemKey].every(id) || !uniqueList(event.conceptIds, id, 32) || ![true, false, null].includes(event.firstExposure)) throw new TypeError("Trail: invalid presentation");
          if (event.measure != null) {
            const m = event.measure, keys = ["skillId", "modality", "difficulty", "familyKey", "audioRequired", "confounded"];
            if (Object.keys(m).some((k) => !keys.includes(k) && k !== "responseFormat") || keys.some((k) => !Object.hasOwn(m, k)) || !id(m.skillId) || !event.conceptIds.includes(m.skillId) || !id(m.familyKey) || typeof m.modality !== "string" || !/^[a-z][a-z0-9_-]{0,40}$/.test(m.modality) || ![1, 2, 3].includes(m.difficulty) || Object.hasOwn(m, "responseFormat") && !["binary-choice", "single-choice", "cup-compose", "action", "unknown"].includes(m.responseFormat) || typeof m.audioRequired !== "boolean" || typeof m.confounded !== "boolean") throw new TypeError("Trail: invalid measurement contract");
          }
        } else if (event.type === TYPES[1]) {
          if (![event.presentationId, event.helpId, event.contentRef].every(id) || !["cue", "explanation", "answer"].includes(event.level)) throw new TypeError("Trail: invalid help");
        } else if (event.type === TYPES[3]) {
          if (!id(event.presentationId) || !["pending", "completed", "failed"].includes(event.audio)) throw new TypeError("Trail: invalid audio delivery");
        } else if (!id(event.presentationId) || !Number.isInteger(event.attemptNo) || event.attemptNo < 1 || !VERDICTS.includes(event.verdict) || !uniqueList(event.errorTags, tag, 24) || event.reason != null && !["motor", "audio", "unanswered", "demo", "visual", "storage"].includes(event.reason)) throw new TypeError("Trail: invalid attempt");
        if (event.type === TYPES[2] && Object.hasOwn(event, "choice")) choiceRecord(event.choice);
        return event;
      }
      function linked(event, prior, parent, attempts) {
        if (!vouched.has(event)) validate(event);
        if (prior) {
          if (canonical(prior) !== canonical(event)) throw new Error("Trail: conflicting event id");
          return event;
        }
        const presented = event.type === TYPES[0];
        if (!parent || parent.type !== (presented ? "decision.made" : TYPES[0]) || scopeOf(parent) !== scopeOf(event) || atOf(parent) > atOf(event) || recordedOf(parent) > recordedOf(event)) throw new Error("Trail: practice requires a prior parent in the same scope");
        if (event.type === TYPES[2]) {
          if (event.attemptNo !== attempts.count + 1 || attempts.latest > atOf(event)) throw new Error("Trail: attempt sequence must be consecutive");
        }
        return event;
      }
      const link = (event, parent, attempts) => linked(event, null, parent, attempts);
      function vouch(event) {
        if (TYPES.includes(event?.type)) validate(event);
        else if (!event?.scope || ![event.scope.domain, event.scope.workspace, event.scope.subject].every((v) => typeof v === "string")) throw new TypeError("Trail: invalid log entry");
        freeze(event);
        vouched.set(event, { scope: `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}`, at: time2(event.at), recordedAt: time2(event.recordedAt) });
        return event;
      }
      function checkLink(events, event) {
        const attempts = { count: 0, latest: -Infinity };
        for (const earlier of events) if (earlier.type === TYPES[2] && earlier.presentationId === event.presentationId) {
          attempts.count += 1;
          attempts.latest = Math.max(attempts.latest, time2(earlier.at));
        }
        return linked(
          event,
          events.find((e) => e.id === event.id),
          events.find((e) => e.id === (event.type === TYPES[0] ? event.decisionId : event.presentationId)),
          attempts
        );
      }
      function judge(event, p, prior, audio) {
        const assisted = prior(["help", "answer"]) ? true : p.firstExposure === true ? false : null;
        const exposure = prior(["attempt", "answer"]) || p.firstExposure === false ? "repeat" : p.firstExposure === true ? "new" : "unknown";
        const usableDelivery = !p.measure || !p.measure.confounded && (!p.measure.audioRequired || audio === "completed");
        const exclusionReason = event.reason || (p.measure?.confounded ? "visual" : !usableDelivery ? "audio" : null);
        return {
          assisted,
          exposure,
          usableDelivery,
          exclusionReason,
          independent: !exclusionReason && usableDelivery && assisted === false && exposure === "new" && ["correct", "incorrect"].includes(event.verdict)
        };
      }
      const attemptRow = (event, p, arm, audio, j) => ({
        eventId: event.id,
        at: event.at,
        recordedAt: event.recordedAt,
        presentationId: p.id,
        decisionId: p.decisionId,
        arm,
        taskId: p.taskId,
        taskVersion: p.taskVersion,
        itemKey: p.itemKey,
        conceptIds: [...p.conceptIds],
        attemptNo: event.attemptNo,
        verdict: event.verdict,
        errorTags: [...event.errorTags],
        assisted: j.assisted,
        exposure: j.exposure,
        ...Object.hasOwn(event, "choice") ? { choice: choiceRecord(event.choice) } : {},
        ...p.measure ? { measure: { ...p.measure, responseFormat: p.measure.responseFormat || "unknown" }, audio, exclusionReason: j.exclusionReason } : j.exclusionReason ? { exclusionReason: j.exclusionReason } : {},
        independent: j.independent
      });
      const traceKeys = (p) => [`item:${p.itemKey}`, ...p.measure ? [`family:${p.measure.familyKey}`] : []];
      const BITS = Object.freeze({ attempt: 1, answer: 2, help: 4 });
      const foldedBefore = (prior, traceKey, kind) => !!prior && Object.prototype.hasOwnProperty.call(prior.keys, traceKey) && (prior.keys[traceKey] & BITS[kind]) !== 0;
      function summarize(events, { scope, asOf, recordedAsOf = asOf, decisions = null, prior = null } = {}) {
        const scopeId = key(scope), cutoff = time2(asOf), recordedCutoff = time2(recordedAsOf);
        if (!Array.isArray(events)) throw new TypeError("Trail: log must be an array");
        if (decisions !== null && (!Array.isArray(decisions) || !decisions.every(id))) throw new TypeError("Trail: invalid decision filter");
        const reported = (decisionId) => decisions === null || decisions.includes(decisionId);
        const all = [], seen = /* @__PURE__ */ new Map(), attemptOrder = /* @__PURE__ */ new Map();
        for (const event of events) {
          if (!event || !event.scope || (vouched.get(event)?.scope ?? `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}`) !== scopeId) continue;
          if (seen.has(event.id)) {
            if (canonical(seen.get(event.id)) !== canonical(event)) throw new Error("Trail: conflicting event id");
            continue;
          }
          if (TYPES.includes(event.type)) linked(
            event,
            null,
            seen.get(event.type === TYPES[0] ? event.decisionId : event.presentationId),
            attemptOrder.get(event.presentationId) || { count: 0, latest: -Infinity }
          );
          if (event.type === TYPES[2]) {
            const earlier = attemptOrder.get(event.presentationId) || { count: 0, latest: -Infinity };
            attemptOrder.set(event.presentationId, { count: earlier.count + 1, latest: Math.max(earlier.latest, atOf(event)) });
          }
          seen.set(event.id, event);
          all.push(event);
        }
        const visible = all.filter((e) => atOf(e) <= cutoff && recordedOf(e) <= recordedCutoff);
        const excluded = new Set(visible.filter((e) => e.type === "record.excluded").map((e) => e.targetId));
        const arms = new Map(visible.filter((e) => e.type === "decision.made").map((e) => [e.id, e.arm ?? null]));
        const provenance = /* @__PURE__ */ new Map(), traces = /* @__PURE__ */ new Map();
        visible.forEach((event, index) => {
          if (event.type === TYPES[0]) provenance.set(event.id, event);
          const p = provenance.get(event.presentationId);
          if (event.type !== TYPES[1] && event.type !== TYPES[2] || !p) return;
          for (const traceKey of traceKeys(p)) {
            if (!traces.has(traceKey)) traces.set(traceKey, /* @__PURE__ */ new Map());
            const trace = traces.get(traceKey), kind = event.type === TYPES[2] ? "attempt" : event.level === "answer" ? "answer" : "help";
            const earlier = trace.get(kind);
            trace.set(kind, { index: Math.min(earlier?.index ?? Infinity, index), at: Math.min(earlier?.at ?? Infinity, atOf(event)) });
          }
        });
        const presentations = [], help = [], attempts = [], met = /* @__PURE__ */ new Map(), audioByPresentation = /* @__PURE__ */ new Map();
        const meet = (p, at, verdict) => {
          if (!met.has(p.itemKey)) met.set(p.itemKey, { itemKey: p.itemKey, conceptIds: [...p.conceptIds], at, verdict });
        };
        let excludedAttempts = 0;
        visible.forEach((event, index) => {
          if (event.type === TYPES[3]) {
            audioByPresentation.set(event.presentationId, excluded.has(event.id) ? "pending" : event.audio);
            return;
          }
          if (event.type === TYPES[0]) {
            if (reported(event.decisionId) && !excluded.has(event.id) && !excluded.has(event.decisionId)) presentations.push({
              eventId: event.id,
              at: event.at,
              recordedAt: event.recordedAt,
              decisionId: event.decisionId,
              taskId: event.taskId,
              taskVersion: event.taskVersion,
              itemKey: event.itemKey,
              conceptIds: [...event.conceptIds],
              firstExposure: event.firstExposure,
              ...event.measure ? { measure: { ...event.measure, responseFormat: event.measure.responseFormat || "unknown" } } : {}
            });
            return;
          }
          const p = provenance.get(event.presentationId);
          if (event.type !== TYPES[1] && event.type !== TYPES[2] || !p) return;
          const omitted = excluded.has(event.id) || excluded.has(p.id) || excluded.has(p.decisionId);
          const shown = reported(p.decisionId) && !omitted;
          if (event.type === TYPES[1]) {
            if (event.level === "answer") meet(p, event.at, null);
            if (shown) help.push({
              eventId: event.id,
              at: event.at,
              recordedAt: event.recordedAt,
              presentationId: p.id,
              helpId: event.helpId,
              level: event.level,
              contentRef: event.contentRef
            });
            return;
          }
          const at = atOf(event);
          const earlier = (kinds) => traceKeys(p).some((traceKey) => kinds.some((kind) => {
            if (foldedBefore(prior, traceKey, kind)) return true;
            const first = traces.get(traceKey)?.get(kind);
            return first && (first.index < index || first.at < at);
          }));
          const audio = audioByPresentation.get(p.id) || "pending", j = judge(event, p, earlier, audio);
          meet(p, event.at, omitted || j.exclusionReason ? null : event.verdict);
          if (!reported(p.decisionId)) return;
          if (omitted) {
            excludedAttempts += 1;
            return;
          }
          attempts.push(attemptRow(event, p, arms.get(p.decisionId) ?? null, audio, j));
        });
        return {
          version: VERSION,
          scope: copy2(scope),
          asOf,
          recordedAsOf,
          decisions: decisions === null ? null : [...decisions],
          presentations,
          help,
          attempts,
          excludedAttempts,
          met: [...met.values()],
          persistence: "provided-log-only",
          learningEffectClaim: false
        };
      }
      function createIndex({ scope, prior = null }) {
        const scopeId = key(scope);
        const presentations = /* @__PURE__ */ new Map(), audio = /* @__PURE__ */ new Map(), deliveries = /* @__PURE__ */ new Map(), audioCover = /* @__PURE__ */ new Map(), arms = /* @__PURE__ */ new Map(), excluded = /* @__PURE__ */ new Set();
        const helped = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set(), rows2 = /* @__PURE__ */ new Map(), covering = /* @__PURE__ */ new Map();
        for (const [k, bits] of Object.entries(prior?.keys || {})) {
          if (bits & BITS.attempt) {
            seen.add(`attempt|${k}`);
            seen.add(k);
          }
          if (bits & BITS.answer) {
            helped.add(`answer|${k}`);
            seen.add(k);
          }
          if (bits & BITS.help) helped.add(`help|${k}`);
        }
        let lastAt = -Infinity, exact = true;
        const cover = (target, row) => {
          if (!covering.has(target)) covering.set(target, []);
          covering.get(target).push(row);
        };
        function add(event) {
          if (!event || !event.scope || (vouched.get(event)?.scope ?? `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}`) !== scopeId) return null;
          const at = atOf(event);
          if (at < lastAt) exact = false;
          lastAt = Math.max(lastAt, at, recordedOf(event));
          if (event.type === "decision.made") {
            arms.set(event.id, event.arm ?? null);
            return null;
          }
          if (event.type === "record.excluded") {
            excluded.add(event.targetId);
            for (const row2 of covering.get(event.targetId) || []) row2.omitted = true;
            const current = audio.get(deliveries.get(event.targetId));
            if (current?.id === event.targetId) current.value = "pending";
            for (const row2 of audioCover.get(event.targetId) || []) {
              row2.audio = "pending";
              if (row2.measure.audioRequired) {
                row2.independent = false;
                row2.exclusionReason ||= "audio";
              }
            }
            return null;
          }
          if (event.type === TYPES[0]) {
            presentations.set(event.id, event);
            return null;
          }
          if (event.type === TYPES[3]) {
            deliveries.set(event.id, event.presentationId);
            audio.set(event.presentationId, { id: event.id, value: excluded.has(event.id) ? "pending" : event.audio });
            return null;
          }
          if (event.type !== TYPES[1] && event.type !== TYPES[2]) return null;
          const p = presentations.get(event.presentationId);
          if (!p) return null;
          const keys = traceKeys(p);
          if (event.type === TYPES[1]) {
            for (const k of keys) {
              helped.add(`help|${k}`);
              if (event.level === "answer") {
                helped.add(`answer|${k}`);
                seen.add(k);
              }
            }
            return null;
          }
          const prior2 = (kinds) => keys.some((k) => kinds.some((kind) => kind === "attempt" ? seen.has(`attempt|${k}`) : helped.has(`${kind}|${k}`)));
          const proof = audio.get(p.id), delivered = proof?.value || "pending";
          const row = attemptRow(event, p, arms.get(p.decisionId) ?? null, delivered, judge(event, p, prior2, delivered));
          if (proof && row.measure) {
            if (!audioCover.has(proof.id)) audioCover.set(proof.id, []);
            audioCover.get(proof.id).push(row);
          }
          row.omitted = excluded.has(event.id) || excluded.has(p.id) || excluded.has(p.decisionId);
          for (const k of keys) {
            seen.add(`attempt|${k}`);
            seen.add(k);
          }
          for (const target of [event.id, p.id, p.decisionId]) cover(target, row);
          rows2.set(event.id, row);
          return row;
        }
        return {
          add,
          get exact() {
            return exact;
          },
          attempt: (eventId) => rows2.get(eventId) || null,
          met: (itemKey, familyKey) => seen.has(`item:${itemKey}`) || familyKey != null && seen.has(`family:${familyKey}`)
        };
      }
      const RECORD = ["itemKey", "conceptIds", "at", "verdict"];
      const record2 = (r) => !!r && typeof r === "object" && Object.keys(r).length === RECORD.length && RECORD.every((k) => Object.hasOwn(r, k)) && id(r.itemKey) && uniqueList(r.conceptIds, id, 32) && typeof r.at === "string" && Number.isFinite(Date.parse(r.at)) && (r.verdict === null || VERDICTS.includes(r.verdict));
      const frozen = (r) => Object.freeze({ ...copy2(r), conceptIds: Object.freeze([...r.conceptIds]) });
      function openHistory(stored, pending = []) {
        const readable = !!stored && typeof stored === "object" && Array.isArray(stored.records) && typeof stored.partial === "boolean" && stored.records.every(record2) && new Set(stored.records.map((r) => r.itemKey)).size === stored.records.length;
        const pendingOk = Array.isArray(pending) && pending.every(record2);
        const records = [], index = /* @__PURE__ */ new Set();
        if (readable) {
          for (const r of [...stored.records, ...pendingOk ? pending : []]) if (!index.has(r.itemKey)) {
            index.add(r.itemKey);
            records.push(frozen(r));
          }
        }
        const partial = readable ? stored.partial || !pendingOk : true;
        return Object.freeze({
          readable,
          partial,
          records: Object.freeze(records),
          firstExposure: (itemKey) => !readable || !id(itemKey) ? null : index.has(itemKey) ? false : partial ? null : true
        });
      }
      const opened = (history2) => !!history2 && typeof history2.firstExposure === "function" && typeof history2.readable === "boolean" && Array.isArray(history2.records) && typeof history2.partial === "boolean" && history2.records.every(record2);
      function remember(history2, summary) {
        if (!opened(history2)) throw new TypeError("Trail: open the history first");
        if (!summary || summary.version !== VERSION || !Array.isArray(summary.met)) throw new TypeError("Trail: use a practice summary");
        if (!history2.readable) return null;
        const known = new Set(history2.records.map((r) => r.itemKey));
        const added = summary.met.filter((r) => record2(r) && !known.has(r.itemKey));
        return { records: [...history2.records, ...added].map(copy2), partial: history2.partial };
      }
      function createPracticeOutcomeIndex(summary) {
        if (!summary || summary.version !== VERSION || !Array.isArray(summary.attempts)) throw new TypeError("Trail: use a practice summary");
        const owner = key(summary.scope), cutoff = time2(summary.asOf), recordedCutoff = time2(summary.recordedAsOf ?? summary.asOf);
        const attempts = /* @__PURE__ */ new Map();
        for (const item of summary.attempts) {
          if (!id(item.eventId) || !id(item.presentationId) || !id(item.decisionId) || !Array.isArray(item.conceptIds) || item.conceptIds.some((value) => !id(value)) || attempts.has(item.eventId)) throw new TypeError("Trail: invalid practice outcome evidence");
          const at = time2(item.at), recordedAt = time2(item.recordedAt);
          if (recordedAt < at || at > cutoff || recordedAt > recordedCutoff) throw new TypeError("Trail: practice evidence outside summary");
          attempts.set(item.eventId, {
            eventId: item.eventId,
            presentationId: item.presentationId,
            decisionId: item.decisionId,
            conceptIds: [...item.conceptIds],
            at,
            recordedAt,
            qualified: item.independent === true && item.assisted === false && item.exposure === "new" && item.verdict === "correct" && !item.exclusionReason
          });
        }
        return Object.freeze({ find(outcome, { targetLine, since, maxAgeMs } = {}) {
          if (!outcome || outcome.type !== "outcome.observed" || !id(outcome.id) || key(outcome.scope) !== owner || typeof targetLine !== "string" || !/^(need|due|trait):[a-zA-Z0-9_.:-]{1,120}$/.test(targetLine) || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new TypeError("Trail: invalid practice outcome query");
          const start = time2(since), at = time2(outcome.at), recordedAt = time2(outcome.recordedAt);
          if (at > cutoff || recordedAt > recordedCutoff || recordedAt < at || at < start || cutoff - at > maxAgeMs || outcome.measure !== "independent" || outcome.assisted !== false || outcome.targetLine !== targetLine) return null;
          const attempt = attempts.get(outcome.attemptId);
          const concept = targetLine.replace(/^(need|due):/, "").replace(/^(skill|node)\./, "");
          if (!attempt?.qualified || attempt.decisionId !== outcome.decisionId || !attempt.conceptIds.includes(concept) || attempt.at < start || attempt.at > at || attempt.recordedAt > recordedAt || cutoff - attempt.at > maxAgeMs) return null;
          return { evidence: [outcome.id, attempt.eventId, attempt.presentationId] };
        } });
      }
      function growth(summary, history2) {
        if (!summary || summary.version !== VERSION || !Array.isArray(summary.attempts)) throw new TypeError("Trail: use a practice summary");
        if (!opened(history2)) throw new TypeError("Trail: open the history first");
        const earlier = history2.records, known = new Set(earlier.map((r) => r.itemKey));
        const facts = [], told = /* @__PURE__ */ new Set();
        for (const now of summary.attempts) {
          const concept = now.conceptIds[0];
          if (!now.independent || now.verdict !== "correct" || !concept || told.has(concept) || known.has(now.itemKey)) continue;
          const before = earlier.filter((p) => p.verdict === "incorrect" && p.itemKey !== now.itemKey && p.conceptIds[0] === concept && Date.parse(p.at) < time2(now.at)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
          if (!before) continue;
          told.add(concept);
          facts.push({
            conceptId: concept,
            before: { itemKey: before.itemKey, at: before.at },
            now: { attemptId: now.eventId, itemKey: now.itemKey, at: now.at }
          });
        }
        return facts;
      }
      return Object.freeze({ VERSION, TYPES, BITS, traceKeys, choiceRecord, validate, checkLink, link, vouch, summarize, createIndex, createPracticeOutcomeIndex, openHistory, remember, growth });
    });
  }
});

// atlas/engine.js
var require_engine = __commonJS({
  "atlas/engine.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory(() => require_trail());
      else root.SynkAtlas = factory(() => root.SynkAtlasTrail || root.SynkTrail);
    })(typeof globalThis !== "undefined" ? globalThis : exports, function(getTrail) {
      "use strict";
      const VERSION = "atlas-2.4.0";
      const POLICIES = ["atlas-1.0.0", "atlas-2.0.0", "atlas-2.1.0", "atlas-2.2.0", "atlas-2.3.0", VERSION];
      const trail = () => {
        const module2 = getTrail();
        if (!module2 || typeof module2.validate !== "function" || typeof module2.checkLink !== "function" || typeof module2.summarize !== "function") throw new Error("Atlas: Trail practice module unavailable");
        return module2;
      };
      const isPractice = (event) => typeof event?.type === "string" && event.type.startsWith("practice.");
      const DOMAINS = ["LAB", "SHIFT", "PULSE", "PATH", "SYNK"];
      const CONTEXT = {
        goal: ["explore", "study", "work", "clarity", "expression", "prepare"],
        time: ["short", "standard", "unlimited"],
        support: ["choose", "step", "independent"],
        audio: ["off", "available"]
      };
      const SIGNALS = ["need", "due", "trait"];
      const ANSWERS = ["yes", "no", "unsure"];
      const WINDOWS = ["immediate", "d1", "d7", "d30"];
      const UNMEASURED = ["not_due", "no_sample", "unmeasurable"];
      const LEVER_CLASSES = ["shape", "content"];
      const ARMS = ["adapted", "baseline"];
      const DAY = 864e5, RECENT = 30 * DAY;
      const copy2 = (value) => JSON.parse(JSON.stringify(value));
      const canonical = (value) => JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);
      const freeze = (value) => {
        if (value && typeof value === "object" && !Object.isFrozen(value)) {
          Object.freeze(value);
          for (const k of Object.keys(value)) freeze(value[k]);
        }
        return value;
      };
      const validId2 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      const unit = (value) => typeof value === "number" && value >= 0 && value <= 1;
      const flag = (value) => value == null || typeof value === "boolean";
      const ms = (value) => {
        const n = Date.parse(value);
        if (!Number.isFinite(n)) throw new TypeError("Atlas: invalid time");
        return n;
      };
      const scopeKey = (scope) => {
        if (!scope || !DOMAINS.includes(scope.domain) || !validId2(scope.subject) || !validId2(scope.workspace)) throw new TypeError("Atlas: invalid scope");
        return `${scope.domain}/${scope.workspace}/${scope.subject}`;
      };
      const random = (seed) => {
        let h = 2166136261;
        for (let i = 0; i < seed.length; i += 1) {
          h ^= seed.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        let a = h >>> 0;
        return () => {
          a = a + 1831565813 >>> 0;
          let t = a;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      };
      function validate(event) {
        if (!event || event.schema !== 1 || !validId2(event.id)) throw new TypeError("Atlas: invalid event");
        scopeKey(event.scope);
        ms(event.at);
        ms(event.recordedAt);
        if (ms(event.recordedAt) < ms(event.at)) throw new TypeError("Atlas: recorded before occurrence");
        if (event.scope.domain === "PULSE" && (isPractice(event) || ["signal.observed", "estimate.responded", "outcome.observed"].includes(event.type))) throw new TypeError("Atlas: PULSE keeps no personal observations");
        if (isPractice(event)) return trail().validate(event);
        if (event.type === "context.set") {
          if (!Object.hasOwn(CONTEXT, event.field) || !(event.value === null || CONTEXT[event.field].includes(event.value))) throw new TypeError("Atlas: invalid context");
          if (event.until != null && ms(event.until) <= ms(event.at)) throw new TypeError("Atlas: invalid expiry");
        } else if (event.type === "decision.made") {
          if (!validId2(event.experienceId) || !validId2(event.variant) || !POLICIES.includes(event.policy) || !Array.isArray(event.evidence) || !event.evidence.every(validId2)) throw new TypeError("Atlas: invalid decision record");
          if (event.arm != null && !ARMS.includes(event.arm)) throw new TypeError("Atlas: invalid decision record");
          if (event.bundle != null && (typeof event.bundle !== "object" || Array.isArray(event.bundle) || !Object.entries(event.bundle).every(([lever, pick]) => validId2(lever) && pick && (pick.option === null || validId2(pick.option))))) throw new TypeError("Atlas: invalid decision record");
        } else if (event.type === "experience.completed") {
          if (!validId2(event.decisionId) || !validId2(event.experienceId) || !validId2(event.variant)) throw new TypeError("Atlas: invalid completion");
        } else if (event.type === "feedback.given") {
          if (!validId2(event.completionId) || !["helpful", "too_much", "want_more", "not_fit"].includes(event.value)) throw new TypeError("Atlas: invalid feedback");
        } else if (event.type === "signal.observed") {
          if (!SIGNALS.includes(event.kind) || !validId2(event.key) || !unit(event.strength) || !Number.isInteger(event.n) || event.n < 0 || !flag(event.assisted)) throw new TypeError("Atlas: invalid signal");
          if (event.until != null && ms(event.until) <= ms(event.at)) throw new TypeError("Atlas: invalid expiry");
          if (event.refs != null && !(Array.isArray(event.refs) && event.refs.length <= 20 && event.refs.every(validId2))) throw new TypeError("Atlas: invalid signal");
        } else if (event.type === "estimate.responded") {
          if (!validId2(event.line) || !ANSWERS.includes(event.value)) throw new TypeError("Atlas: invalid estimate response");
        } else if (event.type === "outcome.observed") {
          if (!validId2(event.decisionId) || !validId2(event.measure) || !WINDOWS.includes(event.window) || !flag(event.assisted)) throw new TypeError("Atlas: invalid outcome");
          if ((event.attemptId != null || event.targetLine != null) && (!validId2(event.attemptId) || !validId2(event.targetLine) || !/^(need|due):/.test(event.targetLine))) throw new TypeError("Atlas: outcome proof needs an attempt and target line");
          if (!(unit(event.value) && event.reason == null) && !(event.value === null && UNMEASURED.includes(event.reason))) throw new TypeError("Atlas: outcome needs a value or a reason");
        } else if (event.type === "record.excluded") {
          if (!validId2(event.targetId)) throw new TypeError("Atlas: invalid exclusion");
        } else throw new TypeError("Atlas: unknown event");
        return event;
      }
      const admitted = /* @__PURE__ */ new WeakMap();
      const scan = (events) => ({
        byId: (id) => events.find((e) => e.id === id),
        attempts: (presentationId) => {
          const stats = { count: 0, latest: -Infinity };
          for (const e of events) if (e.type === "practice.attempted" && e.presentationId === presentationId) {
            stats.count += 1;
            stats.latest = Math.max(stats.latest, ms(e.at));
          }
          return stats;
        },
        events
      });
      function admit(events, event) {
        return admitWith(scan(events), event);
      }
      function admitWith(lookup, event) {
        if (!admitted.has(event)) validate(event);
        const find = (id, type) => {
          const found = lookup.byId(id);
          return found && (!type || found.type === type) ? found : void 0;
        };
        const previous = lookup.byId(event.id);
        if (previous) {
          if (canonical(previous) !== canonical(event)) throw new Error("Atlas: conflicting event id");
          return false;
        }
        if (isPractice(event)) {
          const t = trail();
          if (typeof t.link === "function") t.link(event, lookup.byId(event.type === "practice.presented" ? event.decisionId : event.presentationId), lookup.attempts(event.presentationId));
          else t.checkLink(lookup.events, event);
        }
        if (event.type === "feedback.given") {
          const completion = find(event.completionId, "experience.completed");
          if (!completion || scopeKey(completion.scope) !== scopeKey(event.scope) || ms(completion.at) > ms(event.at)) throw new Error("Atlas: feedback requires a prior completion in the same scope");
        }
        if (event.type === "experience.completed") {
          const decision = find(event.decisionId, "decision.made");
          if (!decision || scopeKey(decision.scope) !== scopeKey(event.scope) || decision.variant !== event.variant || decision.experienceId !== event.experienceId || ms(decision.at) > ms(event.at)) throw new Error("Atlas: completion requires the delivered decision");
        }
        if (event.type === "outcome.observed") {
          const decision = find(event.decisionId, "decision.made");
          if (!decision || scopeKey(decision.scope) !== scopeKey(event.scope) || ms(decision.at) > ms(event.at)) throw new Error("Atlas: outcome requires a prior decision in the same scope");
          if (event.attemptId != null) {
            const attempt = find(event.attemptId, "practice.attempted");
            if (!attempt || scopeKey(attempt.scope) !== scopeKey(event.scope) || ms(attempt.at) > ms(event.at) || ms(attempt.recordedAt) > ms(event.recordedAt)) throw new Error("Atlas: outcome proof requires a prior attempt in the same scope");
          }
        }
        if (event.type === "record.excluded") {
          const target = find(event.targetId);
          if (!target || target.type === "record.excluded" || scopeKey(target.scope) !== scopeKey(event.scope)) throw new Error("Atlas: invalid exclusion target");
        }
        return true;
      }
      function append(events, event) {
        return admit(events, event) ? [...copy2(events), copy2(event)] : copy2(events);
      }
      function read(events, scope, asOf, recordedAsOf = asOf) {
        const key = scopeKey(scope), cutoff = ms(asOf), recordedCutoff = ms(recordedAsOf);
        const rows2 = [];
        let sorted = true, last = null;
        for (const e of events) {
          const known = admitted.get(e);
          if (!known) validate(e);
          const row = known || { key: scopeKey(e.scope), at: ms(e.at), recordedAt: ms(e.recordedAt) };
          if (row.key !== key || row.at > cutoff || row.recordedAt > recordedCutoff) continue;
          if (last && (row.at < last.at || row.at === last.at && row.recordedAt < last.recordedAt)) sorted = false;
          rows2.push({ e, at: row.at, recordedAt: row.recordedAt });
          last = row;
        }
        if (!sorted) rows2.sort((a, b) => a.at - b.at || a.recordedAt - b.recordedAt);
        const ordered = rows2.map((row) => row.e);
        const excluded = new Set(ordered.filter((e) => e.type === "record.excluded").map((e) => e.targetId));
        const context = {}, evidence = {}, expired = [], latest = {}, latestSignal = {}, latestAnswer = {}, lines = [];
        for (const event of ordered) {
          if (event.type === "context.set") latest[event.field] = event;
          if (event.type === "signal.observed") latestSignal[`${event.kind}:${event.key}`] = event;
          if (event.type === "estimate.responded") latestAnswer[event.line] = event;
        }
        for (const [field, event] of Object.entries(latest)) {
          if (excluded.has(event.id) || event.value === null) continue;
          if (event.until && ms(event.until) <= cutoff) {
            expired.push(field);
            continue;
          }
          context[field] = event.value;
          evidence[field] = event.id;
          lines.push({ key: `declared:${field}`, kind: "declared", source: "declared", value: event.value, at: event.at, until: event.until || null, evidence: [event.id], status: "confirmed", usable: true });
        }
        const personal = scope.domain !== "PULSE";
        if (personal) for (const [line, event] of Object.entries(latestSignal)) {
          if (excluded.has(event.id)) continue;
          const until = event.until || new Date(ms(event.at) + RECENT).toISOString();
          if (ms(until) <= cutoff) {
            expired.push(line);
            continue;
          }
          const answer = latestAnswer[line] && !excluded.has(latestAnswer[line].id) ? latestAnswer[line] : null;
          const denied = answer?.value === "no" && (event.kind === "trait" || ms(answer.at) >= ms(event.at));
          const status = denied ? "denied" : answer?.value === "yes" ? "confirmed" : "unconfirmed";
          const sufficiency = event.n >= 8 ? "solid" : event.n >= 3 ? "fair" : "thin";
          lines.push({
            key: line,
            kind: event.kind,
            source: "observed",
            strength: event.strength,
            n: event.n,
            sufficiency,
            assisted: event.assisted ?? null,
            at: event.at,
            until,
            evidence: [event.id, ...answer ? [answer.id] : []],
            status,
            usable: !denied && (sufficiency !== "thin" || status === "confirmed")
          });
        }
        const decisions = new Map(ordered.filter((e) => e.type === "decision.made" && !excluded.has(e.id)).map((e) => [e.id, e]));
        const completed = new Map(ordered.filter((e) => e.type === "experience.completed" && !excluded.has(e.id) && decisions.has(e.decisionId)).map((e) => [e.id, e]));
        const responses = /* @__PURE__ */ new Map();
        if (personal) for (const event of ordered) {
          if (event.type !== "feedback.given" || !completed.has(event.completionId)) continue;
          if (cutoff - ms(event.at) > RECENT) continue;
          const completion = completed.get(event.completionId);
          if (ms(completion.at) <= ms(event.at)) {
            responses.delete(event.completionId);
            responses.set(event.completionId, copy2({ ...event, experienceId: completion.experienceId, variant: completion.variant }));
          }
        }
        const latestOutcome = /* @__PURE__ */ new Map();
        if (personal) for (const event of ordered) {
          if (event.type === "outcome.observed" && decisions.has(event.decisionId)) latestOutcome.set(`${event.decisionId}|${event.measure}|${event.window}|${event.targetLine ?? ""}`, event);
        }
        const rounds = {};
        for (const event of ordered) if (event.type === "experience.completed") rounds[event.experienceId] = (rounds[event.experienceId] || 0) + 1;
        const state = {
          version: VERSION,
          scope: copy2(scope),
          asOf,
          recordedAsOf,
          context,
          evidence,
          expired,
          feedback: [...responses.values()].filter((e) => !excluded.has(e.id)),
          excluded: [...excluded],
          lines,
          outcomes: [...latestOutcome.values()].filter((e) => !excluded.has(e.id)).map(copy2),
          rounds
        };
        return { state, cutoff, personal, decisions, completed };
      }
      function understand(events, scope, asOf, recordedAsOf = asOf) {
        return read(events, scope, asOf, recordedAsOf).state;
      }
      function checkLever(lever, seen) {
        const ids = /* @__PURE__ */ new Set();
        if (!lever || !validId2(lever.id) || seen.has(lever.id) || lever.id === "mode" || !LEVER_CLASSES.includes(lever.class) || !Array.isArray(lever.options) || !lever.options.length) throw new TypeError("Atlas: invalid lever");
        for (const option of lever.options) {
          if (!option || !validId2(option.id) || ids.has(option.id)) throw new TypeError("Atlas: invalid lever");
          ids.add(option.id);
        }
        if (lever.default != null && !ids.has(lever.default)) throw new TypeError("Atlas: invalid lever");
        if (lever.follows != null && !Object.hasOwn(CONTEXT, lever.follows)) throw new TypeError("Atlas: invalid lever");
        if (lever.learn && (lever.class !== "shape" || lever.default == null)) throw new TypeError("Atlas: invalid lever");
        seen.add(lever.id);
      }
      const picked = (decision, leverId) => decision.bundle?.[leverId]?.option ?? (leverId === "mode" ? decision.variant : void 0);
      function decide({ events = [], scope, at, recordedAt = at, experienceId, candidates, levers = [], explore = 0 }) {
        if (!validId2(experienceId) || !Array.isArray(candidates) || !candidates.length) throw new TypeError("Atlas: candidates required");
        if (!Array.isArray(levers) || typeof explore !== "number" || !(explore >= 0 && explore <= 0.5)) throw new TypeError("Atlas: invalid decision input");
        const seen = /* @__PURE__ */ new Set();
        for (const lever of levers) checkLever(lever, seen);
        const view = read(events, scope, at, recordedAt), state = view.state, c = state.context;
        const round = state.rounds[experienceId] || 0, seed = `${scopeKey(scope)}|${experienceId}|${round}`;
        const share = view.personal ? explore : 0, arm = random(seed)() < share ? "baseline" : "adapted", adapted = arm === "adapted";
        const ids = /* @__PURE__ */ new Set();
        const feasible = (item) => !(c.audio === "off" && item.requiresAudio) && !(c.time === "short" && item.minutes > 5) && !(c.support && item.supports && !item.supports.includes(c.support));
        const eligible = candidates.filter((item) => {
          if (!validId2(item.id) || ids.has(item.id) || !Number.isFinite(item.minutes) || item.minutes <= 0 || !["short", "standard", "deep"].includes(item.pace) || item.supports != null && (!Array.isArray(item.supports) || !item.supports.length || item.supports.some((value) => !CONTEXT.support.includes(value)))) throw new TypeError("Atlas: invalid candidate");
          ids.add(item.id);
          return feasible(item);
        });
        const reasons = [], evidence = Object.values(state.evidence);
        if (c.time === "short") reasons.push("time.short");
        if (c.audio === "off") reasons.push("audio.off");
        if (c.goal) reasons.push(`goal.${c.goal}`);
        if (c.support) reasons.push(`support.${c.support}`);
        if (!adapted) reasons.push("arm.baseline");
        if (!eligible.length) return { version: VERSION, status: "unavailable", scope: copy2(scope), experienceId, at, reasons: [...reasons, "no.feasible.experience"], evidence, alternatives: [], selected: null };
        const usable = adapted ? state.lines.filter((line) => line.source === "observed" && line.usable) : [];
        const mine = [...view.completed.values()].filter((done) => done.experienceId === experienceId && view.decisions.has(done.decisionId));
        const last = mine.at(-1) ? view.decisions.get(mine.at(-1).decisionId) : null;
        let performance = false;
        const performanceProof = [];
        const outcomeEvidence = state.outcomes.some((o) => o.attemptId) ? trail().createPracticeOutcomeIndex(trail().summarize(events, { scope, asOf: at, recordedAsOf: recordedAt })) : null;
        const improved = (leverId, optionId, line) => {
          for (const outcome of state.outcomes) {
            if (outcome.value == null || outcome.value < 0.8 || picked(view.decisions.get(outcome.decisionId), leverId) !== optionId) continue;
            const proof = outcomeEvidence?.find(outcome, { targetLine: line.key, since: line.at, maxAgeMs: RECENT });
            if (proof) return proof;
          }
          return null;
        };
        const aim = (leverId, option, content, notes, proof) => {
          let total = 0, due = false;
          for (const line of usable) if (option.targets?.includes(line.key)) {
            let weight = line.kind === "due" ? 2 + 2 * line.strength : 4 * line.strength;
            if (line.kind === "due") due = true;
            const result = content ? improved(leverId, option.id, line) : null;
            if (result) {
              weight *= 0.5;
              performance = true;
              notes.push("outcome.improved");
              const refs = [...result.evidence, ...line.evidence];
              proof.push(...refs);
              performanceProof.push(...refs);
            }
            total += weight;
            notes.push(`line.${line.key}`);
            proof.push(...line.evidence);
          }
          return { total, due };
        };
        const feedback = adapted ? state.feedback.filter((f) => f.experienceId === experienceId) : [];
        const recent = feedback.at(-1);
        const targetPace = c.time === "short" ? "short" : recent?.value === "too_much" ? "short" : recent?.value === "want_more" && c.time !== "short" ? "deep" : "standard";
        const latest = new Map(feedback.map((f) => [f.variant, f.value]));
        const another = recent?.value === "not_fit" ? eligible.filter((item) => latest.get(item.id) !== "not_fit") : [];
        const fallback = recent?.value === "not_fit" && !another.length ? eligible.filter((item) => item.id !== recent.variant) : [];
        const selectable = another.length ? another : fallback.length ? fallback : eligible;
        if (recent?.value === "not_fit") reasons.push(another.length || fallback.length ? "feedback.alternative" : "feedback.no_alternative");
        const scored = selectable.map((item) => {
          const notes = [], proof = [];
          let score = item.pace === targetPace ? 4 : 0;
          if (c.goal && item.goals?.includes(c.goal)) score += 3;
          const same = feedback.filter((f) => f.variant === item.id).slice(-3);
          score += same.reduce((n, f) => n + (f.value === "helpful" ? 1 : f.value === "not_fit" ? -2 : 0), 0);
          score += aim("mode", item, false, notes, proof).total;
          return { item, score, notes, proof };
        }).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
        if (recent) {
          reasons.push(`feedback.${recent.value}`);
          evidence.push(recent.id, recent.completionId);
        }
        for (const f of feedback) if (["helpful", "not_fit"].includes(f.value)) evidence.push(f.id, f.completionId);
        evidence.push(...scored[0].proof);
        const bundle = { mode: { option: scored[0].item.id, basis: !adapted ? "baseline" : scored[0].notes.length ? "line" : recent ? "response" : "setting", reasons: scored[0].notes, evidence: scored[0].proof } };
        const tally = (leverId, optionId) => {
          let s = 0, f = 0, helped = 0;
          const proof = [];
          for (const done of mine) {
            if (view.cutoff - ms(done.at) > RECENT || picked(view.decisions.get(done.decisionId), leverId) !== optionId) continue;
            const answer = state.feedback.find((item) => item.completionId === done.id);
            if (answer?.value === "helpful") {
              s += 1;
              helped += 1;
              proof.push(answer.id, done.id);
            } else if (answer?.value === "not_fit") {
              f += 1;
              proof.push(answer.id, done.id);
            }
          }
          return { s, f, helped, proof };
        };
        for (const lever of [...levers].sort((a, b) => a.id.localeCompare(b.id))) {
          const options = lever.options.filter(feasible), content = lever.class === "content";
          if (!options.length) {
            bundle[lever.id] = { option: null, basis: "unavailable", reasons: ["no.feasible.option"], evidence: [] };
            continue;
          }
          const declared = lever.follows && c[lever.follows] != null ? options.find((option) => option.id === c[lever.follows]) : null;
          if (declared) {
            bundle[lever.id] = { option: declared.id, basis: "declared", reasons: [`declared.${lever.follows}`], evidence: [state.evidence[lever.follows]] };
            continue;
          }
          const turn = (index) => (index - round % options.length + options.length) % options.length;
          if (!adapted) {
            const option = content ? options.find((_, index) => turn(index) === 0) : options.find((item) => item.id === lever.default) || options[0];
            bundle[lever.id] = { option: option.id, basis: "baseline", reasons: ["arm.baseline"], evidence: [] };
            continue;
          }
          const before = last ? picked(last, lever.id) : void 0;
          const tallies = new Map(lever.learn ? options.map((option) => [option.id, tally(lever.id, option.id)]) : []);
          const ranked = options.map((option, index) => {
            const notes = [], proof = [];
            let score = 0, basis = null;
            if (c.goal && option.goals?.includes(c.goal)) {
              score += 3;
              notes.push(`goal.${c.goal}`);
              proof.push(state.evidence.goal);
              basis = "goal";
            }
            const aimed = aim(lever.id, option, content, notes, proof);
            if (aimed.total) {
              score += aimed.total;
              basis = "line";
            }
            if (content) {
              if (before === option.id && !aimed.due) {
                score -= 2;
                notes.push("spacing");
              }
            } else {
              if (option.id === lever.default) score += 0.5;
              if (lever.learn) {
                const t = tallies.get(option.id), a = (option.id === lever.default ? 2 : 1) + t.s, b = 1 + t.f;
                score += 3 * a / (a + b) + 1 / Math.sqrt(1 + t.s + t.f);
              }
            }
            return { option, score, notes, proof, basis, order: content ? turn(index) : index };
          }).sort((a, b) => b.score - a.score || a.order - b.order);
          const best = ranked[0], answered = [...tallies.values()].filter((t) => t.proof.length);
          if (answered.length && !best.basis) {
            const away = best.option.id !== lever.default && tallies.get(lever.default)?.f >= 1;
            best.basis = "learned";
            best.notes.push("learned", tallies.get(best.option.id).helped ? "learned.works" : away ? "learned.switch" : "learned.keep");
            for (const t of answered) best.proof.push(...t.proof);
          }
          bundle[lever.id] = { option: best.option.id, basis: best.basis || (content ? "rotation" : "default"), reasons: best.notes.length ? best.notes : [content ? "rotation" : "default"], evidence: [...new Set(best.proof)] };
          evidence.push(...best.proof);
        }
        const following = levers.find((lever) => lever.follows === "support");
        evidence.push(...performanceProof);
        return {
          version: VERSION,
          status: "ready",
          scope: copy2(scope),
          experienceId,
          at,
          selected: copy2(scored[0].item),
          support: following && bundle[following.id].option || c.support || "choose",
          focus: c.goal || "explore",
          reasons,
          evidence: [...new Set(evidence)],
          alternatives: scored.slice(1).map((s) => s.item.id),
          outcomeBasis: performance ? "performance" : recent ? "self_report" : "unobserved",
          arm,
          round,
          seed,
          explore: share,
          bundle
        };
      }
      const choice = (plan, leverId, fallback = null) => plan && plan.status === "ready" && plan.bundle?.[leverId]?.option || fallback;
      function createSession({ scope, events = [], clock: clock2 = () => (/* @__PURE__ */ new Date()).toISOString(), id, explore = 0 } = {}) {
        scopeKey(scope);
        scope = copy2(scope);
        let log = [], frozen = null;
        const byId = /* @__PURE__ */ new Map(), attemptStats = /* @__PURE__ */ new Map(), completions = /* @__PURE__ */ new Map();
        const lookup = {
          byId: (id2) => byId.get(id2),
          attempts: (presentationId) => attemptStats.get(presentationId) || { count: 0, latest: -Infinity },
          get events() {
            return log;
          }
        };
        const index = (entry) => {
          if (entry.type === "practice.attempted") {
            const stats = lookup.attempts(entry.presentationId);
            attemptStats.set(entry.presentationId, { count: stats.count + 1, latest: Math.max(stats.latest, admitted.get(entry)?.at ?? ms(entry.at)) });
          }
          if (entry.type === "experience.completed" && !completions.has(entry.decisionId)) completions.set(entry.decisionId, entry);
        };
        const store = (event) => {
          if (admitted.has(event)) {
            byId.set(event.id, event);
            index(event);
            log.push(event);
            frozen = null;
            return;
          }
          const entry = copy2(event);
          const t = getTrail();
          if (typeof t?.vouch === "function") t.vouch(entry);
          else freeze(entry);
          admitted.set(entry, { key: scopeKey(entry.scope), at: ms(entry.at), recordedAt: ms(entry.recordedAt) });
          byId.set(entry.id, entry);
          index(entry);
          log.push(entry);
          frozen = null;
        };
        for (const event of events) {
          if (scopeKey(event.scope) !== scopeKey(scope)) throw new Error("Atlas: scope mismatch");
          if (admitWith(lookup, event)) store(event);
        }
        let sequence = 0;
        const nextId = id || (() => `a${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
        const record2 = (body) => {
          const at = clock2(), event = { ...body, schema: 1, scope: copy2(scope), id: nextId(), at, recordedAt: at };
          if (admitWith(lookup, event)) store(event);
          return copy2(event);
        };
        return {
          events: () => copy2(log),
          snapshot: () => frozen || (frozen = Object.freeze(log.slice())),
          set: (field, value, until = null) => record2({ type: "context.set", field, value, until }),
          observe: (signal) => record2({ type: "signal.observed", kind: signal?.kind, key: signal?.key, strength: signal?.strength, n: signal?.n, assisted: signal?.assisted ?? null, until: signal?.until ?? null, refs: signal?.refs ?? [] }),
          respond: (line, value) => record2({ type: "estimate.responded", line, value }),
          plan: (experienceId, candidates, options = {}) => {
            const levers = options.levers || [];
            const decision = decide({ events: log, scope, at: clock2(), experienceId, candidates, levers, explore });
            if (decision.status !== "ready") return decision;
            const recorded = record2({
              type: "decision.made",
              experienceId,
              variant: decision.selected.id,
              policy: VERSION,
              evidence: decision.evidence,
              reasons: decision.reasons,
              alternatives: decision.alternatives,
              support: decision.support,
              focus: decision.focus,
              candidateSnapshot: copy2(candidates),
              arm: decision.arm,
              round: decision.round,
              seed: decision.seed,
              explore: decision.explore,
              bundle: copy2(decision.bundle),
              leverSnapshot: copy2(levers)
            });
            return { ...decision, id: recorded.id };
          },
          complete: (decision) => {
            if (!decision || decision.status !== "ready" || scopeKey(decision.scope) !== scopeKey(scope)) throw new Error("Atlas: invalid decision");
            const existing = completions.get(decision.id);
            return existing ? copy2(existing) : record2({ type: "experience.completed", decisionId: decision.id, experienceId: decision.experienceId, variant: decision.selected.id });
          },
          feedback: (completionId, value) => record2({ type: "feedback.given", completionId, value }),
          practice: (kind, fields) => {
            if (!fields || typeof fields !== "object" || Array.isArray(fields) || typeof kind !== "string") throw new TypeError("Atlas: invalid practice fields");
            return record2({ ...fields, type: kind.startsWith("practice.") ? kind : `practice.${kind}` });
          },
          outcome: (decisionId, result) => record2({
            type: "outcome.observed",
            decisionId,
            measure: result?.measure,
            window: result?.window,
            value: result?.value ?? null,
            reason: result?.reason ?? null,
            assisted: result?.assisted ?? null,
            ...result?.attemptId != null || result?.targetLine != null ? { attemptId: result?.attemptId, targetLine: result?.targetLine } : {}
          }),
          exclude: (targetId) => record2({ type: "record.excluded", targetId }),
          clear: () => {
            log = [];
            frozen = null;
            byId.clear();
            attemptStats.clear();
            completions.clear();
          },
          state: () => understand(log, scope, clock2()),
          lines: () => understand(log, scope, clock2()).lines
        };
      }
      return Object.freeze({ VERSION, POLICIES, CONTEXT, validate, append, understand, decide, choice, createSession });
    });
  }
});

// atlas/education.js
var require_education = __commonJS({
  "atlas/education.js"(exports, module) {
    "use strict";
    var VERDICTS = ["correct", "incorrect", "unassessed", "skipped"];
    var { choiceRecord } = require_trail();
    function conceptsFor(map, task) {
      const ids = [];
      for (const id of task.concepts || []) {
        if (!map.getNode(id)) throw new TypeError(`Core: unknown curriculum node ${id}`);
        ids.push(id);
      }
      for (const tag of task.tags) {
        const link = map.forTag(tag);
        if (link.status === "exact") ids.push(link.node.id);
      }
      return [...new Set(ids)];
    }
    function diagnose({ map, task, assessment }) {
      if (!task || !Array.isArray(task.tags) || !assessment || !VERDICTS.includes(assessment.verdict) || !Array.isArray(assessment.errorTags)) throw new TypeError("Core: invalid educational evidence");
      const conceptIds = conceptsFor(map, task);
      const observed = assessment.verdict === "incorrect" ? [...new Set(assessment.errorTags.filter((tag) => task.tags.includes(tag)))] : [];
      return {
        version: "core-education-2",
        mapVersion: map.map_ver,
        verdict: assessment.verdict,
        diagnosis: observed.length ? "observed-error" : assessment.verdict === "correct" ? "correct-on-this-item" : "not-diagnosed",
        errorTags: observed,
        conceptIds,
        curriculum: conceptIds.map((id) => {
          const node = map.getNode(id);
          return { id, kind: node.kind, label: node.label_ko };
        }),
        missingTags: task.tags.filter((tag) => map.forTag(tag).status !== "exact"),
        scope: "this-item-only",
        mastery: null
      };
    }
    function createPractice({ session, decision, map, task, assess, firstExposure = null }) {
      const conceptIds = conceptsFor(map, task);
      const presentation = session.practice("presented", {
        decisionId: decision.id,
        taskId: task.id,
        taskVersion: task.version,
        itemKey: task.itemKey,
        conceptIds,
        firstExposure,
        ...task.measure ? { measure: task.measure } : {}
      });
      let attempts = 0, broken = false, met = null;
      const shown = /* @__PURE__ */ new Set();
      const guarded = (work) => {
        try {
          return work();
        } catch (error2) {
          broken = true;
          throw error2;
        }
      };
      return {
        presentation,
        submit(response, { skipped = false, reason = null, choice } = {}) {
          if (broken) throw new Error("Core: practice record incomplete");
          const selected = choice === void 0 ? null : choiceRecord(choice);
          const result = diagnose({ map, task, assessment: skipped ? { verdict: "skipped", errorTags: [] } : assess(response) });
          const event = guarded(() => session.practice("attempted", {
            presentationId: presentation.id,
            attemptNo: attempts + 1,
            verdict: result.verdict,
            errorTags: result.errorTags,
            ...reason ? { reason } : {},
            ...selected ? { choice: selected } : {}
          }));
          attempts += 1;
          if (!met) met = { itemKey: task.itemKey, conceptIds, at: event.at, verdict: result.verdict };
          return { ...result, eventId: event.id, attemptNo: attempts, ...selected ? { choice: { ...selected } } : {} };
        },
        // Help counts once it is on screen. Repeated renders of the same help are one exposure.
        delivered(help) {
          return guarded(() => {
            if (!help || typeof help.id !== "string" || !["cue", "explanation", "answer"].includes(help.level) || typeof help.contentRef !== "string") throw new TypeError("Core: invalid delivered help");
            const key = `${help.id}|${help.level}|${help.contentRef}`;
            if (shown.has(key)) return null;
            const event = session.practice("helped", { presentationId: presentation.id, helpId: help.id, level: help.level, contentRef: help.contentRef });
            shown.add(key);
            if (help.level === "answer" && !met) met = { itemKey: task.itemKey, conceptIds, at: event.at, verdict: null };
            return event;
          });
        },
        // The record to append to the game's pending history once this item was answered
        // or its answer shown (see Trail.openHistory). Null until then.
        met() {
          return met && { ...met, conceptIds: [...met.conceptIds] };
        }
      };
    }
    module.exports = { conceptsFor, diagnose, createPractice };
  }
});

// atlas/vellum.js
var require_vellum = __commonJS({
  "atlas/vellum.js"(exports, module) {
    "use strict";
    var SUPPORTS = ["choose", "step", "independent"];
    var VERDICTS = ["correct", "incorrect", "unassessed", "skipped"];
    var STUCK = Object.freeze({ afterMs: 4e4, misses: 2 });
    function reviewOpen({ verdict, support = "choose", retried = false, hasCue = false, unsure = false }) {
      if (!VERDICTS.includes(verdict) || !SUPPORTS.includes(support)) throw new TypeError("Vellum: invalid review state");
      if (verdict === "correct") return unsure ? "answer" : null;
      if (verdict === "unassessed" || retried || support === "choose" || !hasCue) return "answer";
      return "cue";
    }
    function offerCue({ support = "choose", elapsedMs = 0, misses = 0, offered = false, declined = false, hasCue = false, stuck = STUCK }) {
      if (!SUPPORTS.includes(support)) throw new TypeError("Vellum: invalid support");
      if (offered || declined || !hasCue || support === "independent") return false;
      return elapsedMs >= stuck.afterMs || misses >= stuck.misses;
    }
    function particle(label, withFinal, without) {
      for (let i = label.length - 1; i >= 0; i -= 1) {
        const code = label.charCodeAt(i);
        if (code >= 44032 && code <= 55203) return (code - 44032) % 28 ? withFinal : without;
      }
      return without;
    }
    function learningReason({ status, label }) {
      if (typeof label !== "string") throw new TypeError("Vellum: invalid learning reason");
      const topic = `${label}${particle(label, "\uC740", "\uB294")}`, object3 = `${label}${particle(label, "\uC744", "\uB97C")}`;
      const reasons = {
        unseen: `${topic} \uC544\uC9C1 \uAE30\uB85D\uC774 \uC801\uC5B4\uC694. \uC9E7\uAC8C \uD655\uC778\uD574 \uBD10\uC694.`,
        checking: `${object3} \uC870\uAE08 \uB354 \uD655\uC778\uD574 \uBD10\uC694.`,
        practice: `\uCD5C\uADFC \uB193\uCE5C ${object3} \uC870\uAE08 \uB354 \uC5F0\uC2B5\uD574 \uBD10\uC694.`,
        supported: `${object3} \uB3C4\uC6C0\uACFC \uD568\uAED8 \uD574\uB0C8\uC5B4\uC694. \uC774\uC5B4\uC11C \uC0B4\uD3B4\uBD10\uC694.`,
        "recent-independent": `${object3} \uCD5C\uADFC \uD63C\uC790 \uD574\uB0C8\uC5B4\uC694. \uAC00\uBCCD\uAC8C \uC774\uC5B4\uAC00\uC694.`,
        review: `${object3} \uB2E4\uC2DC \uC0B4\uD3B4\uBCFC \uB54C\uC608\uC694.`
      };
      if (!Object.hasOwn(reasons, status)) throw new TypeError("Vellum: invalid learning reason");
      return reasons[status];
    }
    function situationLine({ when }) {
      if (typeof when !== "string" || !when.trim()) throw new TypeError("Vellum: invalid situation line");
      return `${when} \uC4F0\uB294 \uB9D0\uC774\uB77C \uACE8\uB790\uC5B4\uC694.`;
    }
    function activityReason({ reasons = [], state = "unseen", label } = {}) {
      if (!Array.isArray(reasons)) throw new TypeError("Vellum: invalid activity reason");
      if (reasons.includes("activity.none")) return "\uC9C0\uAE08 \uC870\uAC74\uC5D0 \uB9DE\uB294 \uD65C\uB3D9\uC774 \uC5C6\uC5B4\uC694. \uC2DC\uAC04\uC774\uB098 \uC18C\uB9AC \uC124\uC815\uC744 \uBC14\uAFD4 \uBCFC \uC218 \uC788\uC5B4\uC694.";
      if (reasons.includes("review.due")) return "\uBCF5\uC2B5\uD560 \uC2DC\uAC04\uC774 \uB41C \uB0B4\uC6A9\uC774 \uC788\uC5B4\uC694. \uC9E7\uAC8C \uB2E4\uC2DC \uB9CC\uB098 \uBD10\uC694.";
      const goal = reasons.includes("goal.declared");
      if (reasons.includes("activity.retry")) return `\uCC98\uC74C\uC5D0 \uB193\uCE5C \uBD80\uBD84\uC744 \uB2E4\uC2DC \uC5F0\uC2B5\uD574 \uBD10\uC694.${goal ? " \uACE0\uB978 \uBAA9\uD45C\uC640 \uC774\uC5B4\uC9C0\uB294 \uD65C\uB3D9\uC774\uC5D0\uC694." : ""}`;
      if (reasons.includes("activity.assisted")) return `\uB3C4\uC6C0\uACFC \uD568\uAED8 \uD574\uB0B8 \uBD80\uBD84\uC774\uC5D0\uC694. \uD55C \uBC88 \uB354 \uC0B4\uD3B4\uBD10\uC694.${goal ? " \uACE0\uB978 \uBAA9\uD45C\uC640 \uC774\uC5B4\uC9C0\uB294 \uD65C\uB3D9\uC774\uC5D0\uC694." : ""}`;
      if (label && state !== "unseen") return `${learningReason({ status: state, label })}${goal ? " \uACE0\uB978 \uBAA9\uD45C\uC640 \uC774\uC5B4\uC9C0\uB294 \uD65C\uB3D9\uC774\uC5D0\uC694." : ""}`;
      if (goal) return "\uC9C1\uC811 \uACE0\uB978 \uBAA9\uD45C\uC640 \uC774\uC5B4\uC9C0\uB294 \uD65C\uB3D9\uC774\uC5D0\uC694. \uC9E7\uAC8C \uC2DC\uC791\uD574 \uBD10\uC694.";
      if (reasons.includes("history.incomplete")) return "\uAE30\uB85D\uC744 \uBAA8\uB450 \uD655\uC778\uD558\uAE30 \uC804\uC774\uB77C \uAE30\uBCF8 \uD65C\uB3D9\uC73C\uB85C \uC2DC\uC791\uD574\uC694.";
      return "\uC544\uC9C1 \uC5F0\uC2B5 \uAE30\uB85D\uC774 \uC801\uC5B4\uC694. \uC9E7\uAC8C \uD574 \uBCF4\uBA70 \uB9DE\uCDB0 \uAC08\uAC8C\uC694.";
    }
    module.exports = { SUPPORTS, STUCK, reviewOpen, offerCue, learningReason, situationLine, activityReason };
  }
});

// atlas/temper.js
var require_temper = __commonJS({
  "atlas/temper.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkTemper = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const VERSION = "temper-practice-2";
      const TRAIL = "trail-practice-2";
      const scopeKey = (scope) => `${scope.domain}/${scope.workspace}/${scope.subject}`;
      const taskKey = (p) => JSON.stringify([
        p.taskId,
        p.taskVersion,
        p.itemKey,
        [...p.conceptIds].sort(),
        p.firstExposure,
        p.measure ? [
          p.measure.skillId,
          p.measure.modality,
          p.measure.difficulty,
          p.measure.familyKey,
          p.measure.audioRequired,
          p.measure.confounded,
          p.measure.responseFormat || "unknown"
        ] : null
      ]);
      function summaries(input) {
        const rows2 = Array.isArray(input) ? input : [input];
        const seen = /* @__PURE__ */ new Set();
        for (const row of rows2) {
          if (!row || row.version !== TRAIL || !row.scope || !Array.isArray(row.attempts) || !Array.isArray(row.presentations) || !Array.isArray(row.help)) throw new TypeError("Temper: use a Trail practice summary");
          const key = scopeKey(row.scope);
          if (seen.has(key)) throw new TypeError("Temper: duplicate scope would double-count evidence");
          seen.add(key);
        }
        return rows2;
      }
      const bucket = () => ({ evaluated: 0, correct: 0, incorrect: 0, accuracy: null });
      const close = (b) => {
        if (b.evaluated) b.accuracy = b.correct / b.evaluated;
        return b;
      };
      const counted = (a) => a.independent === true && !a.exclusionReason && a.assisted === false && a.exposure === "new" && ["correct", "incorrect"].includes(a.verdict) && (!a.measure || !a.measure.confounded && (!a.measure.audioRequired || a.audio === "completed"));
      function measure(input) {
        const rows2 = summaries(input);
        const result = {
          scopes: rows2.length,
          presented: 0,
          attempts: 0,
          independent: bucket(),
          byConcept: /* @__PURE__ */ Object.create(null),
          byArm: /* @__PURE__ */ Object.create(null),
          assisted: 0,
          unknownAssistance: 0,
          repeat: 0,
          unknownExposure: 0,
          unassessed: 0,
          skipped: 0,
          excludedAttempts: 0
        };
        for (const row of rows2) {
          result.presented += row.presentations.length;
          result.excludedAttempts += row.excludedAttempts || 0;
          const seen = /* @__PURE__ */ new Set();
          for (const a of row.attempts) {
            if (seen.has(a.eventId)) throw new TypeError("Temper: duplicate attempt");
            seen.add(a.eventId);
            result.attempts += 1;
            if (a.assisted === true) result.assisted += 1;
            else if (a.assisted === null) result.unknownAssistance += 1;
            if (a.exposure === "repeat") result.repeat += 1;
            else if (a.exposure === "unknown") result.unknownExposure += 1;
            if (a.verdict === "unassessed") result.unassessed += 1;
            if (a.verdict === "skipped") result.skipped += 1;
            if (!counted(a)) continue;
            const slot = (table, name) => table[name] || (table[name] = bucket());
            const targets = [result.independent, ...a.conceptIds.map((id) => slot(result.byConcept, id)), slot(result.byArm, a.arm || "unrecorded")];
            for (const b of targets) {
              b.evaluated += 1;
              b[a.verdict] += 1;
            }
          }
        }
        close(result.independent);
        Object.values(result.byConcept).forEach(close);
        Object.values(result.byArm).forEach(close);
        return { ...result, status: result.independent.evaluated ? "measured" : "no_sample", learningEffectClaim: false };
      }
      function combine(a, b) {
        if (!a) return b;
        if (!b) return a;
        const sum = (x, y) => close({ evaluated: x.evaluated + y.evaluated, correct: x.correct + y.correct, incorrect: x.incorrect + y.incorrect, accuracy: null });
        const table = (x, y) => {
          const out = /* @__PURE__ */ Object.create(null);
          for (const [k, v] of Object.entries(x || {})) out[k] = sum(v, bucket());
          for (const [k, v] of Object.entries(y || {})) out[k] = sum(out[k] || bucket(), v);
          return out;
        };
        const result = {
          scopes: Math.max(a.scopes, b.scopes),
          presented: a.presented + b.presented,
          attempts: a.attempts + b.attempts,
          independent: sum(a.independent, b.independent),
          byConcept: table(a.byConcept, b.byConcept),
          byArm: table(a.byArm, b.byArm),
          assisted: a.assisted + b.assisted,
          unknownAssistance: a.unknownAssistance + b.unknownAssistance,
          repeat: a.repeat + b.repeat,
          unknownExposure: a.unknownExposure + b.unknownExposure,
          unassessed: a.unassessed + b.unassessed,
          skipped: a.skipped + b.skipped,
          excludedAttempts: a.excludedAttempts + b.excludedAttempts
        };
        return { ...result, status: result.independent.evaluated ? "measured" : "no_sample", learningEffectClaim: false };
      }
      function compare({ before, after } = {}) {
        const left = summaries(before), right = summaries(after);
        const tasks = (rows2) => new Map(rows2.map((row) => [scopeKey(row.scope), row.presentations.map(taskKey).sort()]));
        const l = tasks(left), r = tasks(right), reasons = [];
        if (JSON.stringify([...l.keys()].sort()) !== JSON.stringify([...r.keys()].sort())) reasons.push("scope_mismatch");
        else for (const [scope, set] of l) if (JSON.stringify(set) !== JSON.stringify(r.get(scope))) {
          reasons.push("task_mismatch");
          break;
        }
        const b = measure(left), a = measure(right), comparable = reasons.length === 0;
        const measured = b.status === "measured" && a.status === "measured";
        return {
          version: VERSION,
          comparable,
          status: !comparable ? "not_comparable" : !measured ? "no_sample" : "measured",
          reasons,
          before: b,
          after: a,
          independentAccuracyDifference: comparable && measured ? a.independent.accuracy - b.independent.accuracy : null,
          comparisonUnit: "same-input-run",
          learningEffectClaim: false,
          causalClaim: false,
          limitations: [
            "Same inputs run twice: a check of the implementation, not of learning.",
            "Learning is read from new-item independent attempts per concept and per arm with measure()."
          ]
        };
      }
      const MINIMUM_PER_CELL = 30;
      const label = (value) => typeof value === "string" && /^[a-zA-Z0-9_.+-]{1,40}$/.test(value);
      function groups({ rows: rows2, labels, arms, minimum = MINIMUM_PER_CELL, tolerance = 0 } = {}) {
        const input = summaries(rows2);
        if (!labels || typeof labels !== "object" || Array.isArray(labels)) throw new TypeError("Temper: labels by scope are required");
        if (!Array.isArray(arms) || arms.length !== 2 || !arms.every(label) || arms[0] === arms[1]) throw new TypeError("Temper: name the baseline and candidate arms");
        if (!Number.isSafeInteger(minimum) || minimum < 1) throw new TypeError("Temper: minimum must be a positive integer");
        if (!(typeof tolerance === "number" && tolerance >= 0 && tolerance < 1)) throw new TypeError("Temper: tolerance must be within [0, 1)");
        const [baseline, candidate] = arms;
        const cells = /* @__PURE__ */ new Map();
        for (const row of input) {
          const given = Object.hasOwn(labels, scopeKey(row.scope)) ? labels[scopeKey(row.scope)] : null;
          if (!given) continue;
          if (typeof given !== "object" || Array.isArray(given)) throw new TypeError("Temper: labels must be {dimension: value}");
          const tally = { [baseline]: [0, 0], [candidate]: [0, 0] };
          for (const a of row.attempts) {
            const arm = a.arm || "unrecorded";
            if (!Object.hasOwn(tally, arm) || !counted(a)) continue;
            tally[arm][0] += 1;
            if (a.verdict === "correct") tally[arm][1] += 1;
          }
          if (!tally[baseline][0] && !tally[candidate][0]) continue;
          for (const [dimension, value] of Object.entries(given)) {
            if (value == null || value === "no_answer") continue;
            if (!label(dimension) || !label(value)) throw new TypeError("Temper: invalid group label");
            const key = `${dimension}=${value}`;
            if (!cells.has(key)) cells.set(key, { dimension, value, people: { [baseline]: [], [candidate]: [] } });
            for (const arm of arms) if (tally[arm][0]) cells.get(key).people[arm].push(tally[arm][1] / tally[arm][0]);
          }
        }
        const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
        const report = [...cells.keys()].sort().map((key) => {
          const cell = cells.get(key), before = cell.people[baseline], after = cell.people[candidate];
          if (before.length < minimum || after.length < minimum) return { dimension: cell.dimension, value: cell.value, status: "waiting" };
          const difference = mean(after) - mean(before);
          return {
            dimension: cell.dimension,
            value: cell.value,
            status: difference < -tolerance ? "worse" : "not_worse",
            people: { baseline: before.length, candidate: after.length },
            accuracy: { baseline: mean(before), candidate: mean(after) },
            difference
          };
        });
        const named = (status) => report.filter((cell) => cell.status === status).map((cell) => `${cell.dimension}=${cell.value}`);
        return {
          version: VERSION,
          arms: { baseline, candidate },
          minimum,
          tolerance,
          cells: report,
          worse: named("worse"),
          waiting: named("waiting"),
          unit: "person-mean-of-new-item-independent-accuracy",
          learningEffectClaim: false,
          causalClaim: false,
          significanceTested: false
        };
      }
      return Object.freeze({ VERSION, MINIMUM_PER_CELL, measure, combine, compare, groups });
    });
  }
});

// atlas/learning-ledger.js
var require_learning_ledger = __commonJS({
  "atlas/learning-ledger.js"(exports, module) {
    "use strict";
    var Trail = require_trail();
    var Temper = require_temper();
    var VERSION = "learning-ledger-1";
    var BITS = Trail.BITS;
    var KEEP = 12;
    var HELP_MS = 30 * 864e5;
    var FOLDABLE = Object.freeze([
      "decision.made",
      "experience.completed",
      "record.excluded",
      "practice.presented",
      "practice.helped",
      "practice.attempted",
      "practice.delivery"
    ]);
    var MAX_ENTRIES = 2e5;
    var own2 = (table, key) => Object.prototype.hasOwnProperty.call(table, key);
    var plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    function empty() {
      return { version: VERSION, cutoff: null, folded: 0, keys: {}, presented: [], cells: {}, content: {}, counts: null };
    }
    function validate(ledger) {
      const cellOk = (cell) => plain(cell) && Array.isArray(cell.ind) && cell.ind.length <= KEEP && cell.ind.every((r) => Array.isArray(r) && (r.length === 4 || r.length === 5 && typeof r[4] === "string") && typeof r[0] === "string" && Number.isFinite(r[1]) && ["correct", "incorrect"].includes(r[2]) && typeof r[3] === "string") && Array.isArray(cell.helped) && cell.helped.length <= MAX_ENTRIES && cell.helped.every((h) => Number.isFinite(h) || Array.isArray(h) && h.length === 2 && typeof h[0] === "string" && Number.isFinite(h[1])) && Number.isInteger(cell.unassessed) && cell.unassessed >= 0;
      if (!plain(ledger) || ledger.version !== VERSION || !Number.isInteger(ledger.folded) || ledger.folded < 0 || !(ledger.cutoff === null || Number.isFinite(ledger.cutoff)) || !plain(ledger.keys) || Object.keys(ledger.keys).length > MAX_ENTRIES || Object.values(ledger.keys).some((v) => !Number.isInteger(v) || v < 1 || v > 7) || !Array.isArray(ledger.presented) || ledger.presented.length > MAX_ENTRIES || ledger.presented.some((r) => !Array.isArray(r) || r.length !== 4 || r.slice(0, 3).some((v) => typeof v !== "string") || !Number.isInteger(r[3]) || r[3] < 1) || !plain(ledger.cells) || !Object.values(ledger.cells).every(cellOk) || !plain(ledger.content) || !Object.values(ledger.content).every(cellOk) || !(ledger.counts === null || plain(ledger.counts)) || !(ledger.adjusted === void 0 || Number.isInteger(ledger.adjusted) && ledger.adjusted >= 0) || !(ledger.local === void 0 || ledger.local === true)) throw new TypeError("Ledger: unreadable");
      return ledger;
    }
    var before = (ledger, traceKey, kinds) => {
      const bits = ledger && own2(ledger.keys, traceKey) ? ledger.keys[traceKey] : 0;
      return kinds.some((kind) => bits & BITS[kind]);
    };
    var helpedAt = (h) => Array.isArray(h) ? h[1] : h;
    function rows2(cell) {
      if (!cell) return { rows: [], unassessed: 0 };
      const iso2 = (ms) => new Date(ms).toISOString();
      return { unassessed: cell.unassessed, rows: [
        ...cell.ind.map(([eventId, at, verdict, familyKey]) => ({ eventId, at: iso2(at), verdict, independent: true, assisted: false, exclusionReason: null, measure: { familyKey } })),
        ...cell.helped.map((h) => ({ eventId: Array.isArray(h) ? h[0] : null, at: iso2(helpedAt(h)), verdict: "correct", independent: false, assisted: true, exclusionReason: null, measure: { familyKey: null } }))
      ] };
    }
    var cellOf = (ledger, key) => ledger && own2(ledger.cells, key) ? ledger.cells[key] : null;
    var contentOf = (ledger, key) => ledger && own2(ledger.content, key) ? ledger.content[key] : null;
    function fold(previous, events, { scope, log = events, local = false }) {
      const base = previous || empty();
      const ledger = { ...base, keys: { ...base.keys }, cells: { ...base.cells }, content: { ...base.content } };
      if (!events.length) return ledger;
      const time2 = (e) => Math.max(Date.parse(e.at), Date.parse(e.recordedAt));
      const latest = log.reduce((max, e) => Math.max(max, time2(e)), -Infinity);
      const decisions = events.filter((e) => e.type === "decision.made").map((e) => e.id);
      const summary = Trail.summarize(log, { scope, asOf: new Date(latest).toISOString(), prior: previous, decisions });
      const presented = new Map(events.filter((e) => e.type === "practice.presented").map((e) => [e.id, e]));
      for (const e of events) {
        if (e.type !== "practice.helped" && e.type !== "practice.attempted") continue;
        const p = presented.get(e.presentationId);
        if (!p) continue;
        const bit = e.type === "practice.attempted" ? BITS.attempt : e.level === "answer" ? BITS.answer : BITS.help;
        for (const k of Trail.traceKeys(p)) ledger.keys[k] = (own2(ledger.keys, k) ? ledger.keys[k] : 0) | bit;
      }
      const shown = new Map(ledger.presented.map(([task, item, family, n]) => [JSON.stringify([task, item, family]), n]));
      for (const p of summary.presentations) {
        const key = JSON.stringify([p.taskId, p.itemKey, p.measure?.familyKey || p.itemKey]);
        shown.set(key, (shown.get(key) || 0) + 1);
      }
      ledger.presented = [...shown].map(([key, n]) => [...JSON.parse(key), n]).sort((a, b) => a.join("\0") < b.join("\0") ? -1 : 1);
      const touched = /* @__PURE__ */ new Set();
      const add = (table, key, a) => {
        const cell = own2(table, key) ? touched.has(table[key]) ? table[key] : { ind: [...table[key].ind], helped: [...table[key].helped], unassessed: table[key].unassessed } : { ind: [], helped: [], unassessed: 0 };
        table[key] = cell;
        touched.add(cell);
        const at = Date.parse(a.at);
        if (a.independent) cell.ind.push([a.eventId, at, a.verdict, a.measure.familyKey, ...a.itemKey !== a.measure.familyKey ? [a.itemKey] : []]);
        if (!a.exclusionReason && a.assisted === true && a.verdict === "correct") cell.helped.push([a.eventId, at]);
        if (a.verdict === "unassessed" || a.verdict === "skipped") cell.unassessed += 1;
      };
      for (const a of summary.attempts) {
        if (!a.measure) continue;
        const format = a.measure.responseFormat || "unknown";
        add(ledger.cells, `${a.measure.skillId}|${a.measure.difficulty}|${format}`, a);
        for (const id of a.conceptIds) if (id !== a.measure.skillId) add(ledger.content, `${id}|${format}`, a);
      }
      for (const table of [ledger.cells, ledger.content]) for (const [key, cell] of Object.entries(table)) {
        const helped = cell.helped.filter((h) => helpedAt(h) > latest - HELP_MS);
        if (!touched.has(cell) && helped.length === cell.helped.length) continue;
        table[key] = { ind: [...cell.ind].sort((x, y) => x[1] - y[1]).slice(-KEEP), helped: helped.sort((x, y) => helpedAt(x) - helpedAt(y)), unassessed: cell.unassessed };
      }
      ledger.counts = ledger.counts ? Temper.combine(ledger.counts, Temper.measure(summary)) : Temper.measure(summary);
      ledger.cutoff = Math.max(ledger.cutoff ?? -Infinity, events.reduce((max, e) => Math.max(max, time2(e)), -Infinity));
      ledger.folded += events.length;
      if (local) ledger.local = true;
      return ledger;
    }
    function plan(events, { keep, olderThan, unfinishedBefore = olderThan, open = [] }) {
      if (events.length <= keep) return null;
      const groupOf = /* @__PURE__ */ new Map(), groups = /* @__PURE__ */ new Map();
      const join = (id, event) => {
        if (!groups.has(id)) groups.set(id, { id, events: [], max: -Infinity, open: false, done: false });
        const g = groups.get(id);
        g.events.push(event);
        g.max = Math.max(g.max, Date.parse(event.at), Date.parse(event.recordedAt));
        groupOf.set(event.id, id);
        if (event.type === "experience.completed") g.done = true;
      };
      const pinned = /* @__PURE__ */ new Set();
      for (const e of events) {
        if (e.type === "decision.made") {
          join(e.id, e);
          continue;
        }
        const parent = groupOf.get(reference(e));
        if (!FOLDABLE.includes(e.type)) {
          if (parent != null) pinned.add(parent);
          continue;
        }
        if (parent != null) join(parent, e);
      }
      for (const id of pinned) groups.get(id).open = true;
      for (const id of open) {
        const g = groups.get(groupOf.get(id));
        if (g) g.open = true;
      }
      const order = [...groups.values()].sort((a, b) => a.max - b.max);
      let remaining = events.length, cutoff = -Infinity;
      const folded2 = /* @__PURE__ */ new Set();
      for (const g of order) {
        if (remaining <= keep || g.max >= olderThan) break;
        if (g.open || !g.done && g.max >= unfinishedBefore) continue;
        for (const e of g.events) folded2.add(e.id);
        remaining -= g.events.length;
        cutoff = g.max;
      }
      if (!folded2.size) return null;
      return { cutoff, folded: events.filter((e) => folded2.has(e.id)), kept: events.filter((e) => !folded2.has(e.id)) };
    }
    var folded = (ledger, event) => !!ledger && ledger.cutoff !== null && FOLDABLE.includes(event.type) && Date.parse(event.at) <= ledger.cutoff;
    var reference = (e) => e?.type === "decision.made" ? void 0 : e?.decisionId ?? e?.presentationId ?? e?.targetId;
    var stray = (event, known) => {
      const ref = reference(event);
      return typeof ref === "string" && !known.has(ref);
    };
    function compare(a, b) {
      const fa = a?.folded || 0, fb = b?.folded || 0;
      if (fa !== fb) return fa > fb ? 1 : -1;
      const ca = a?.cutoff ?? -Infinity, cb = b?.cutoff ?? -Infinity;
      return ca === cb ? 0 : ca > cb ? 1 : -1;
    }
    function demote(ledger, { late = [], excluded = [], strays = 0 }, find) {
      const marks = [], gone = new Set(excluded);
      for (const e of late) {
        if (e.type !== "practice.attempted" && e.type !== "practice.helped") continue;
        const p = find(e.presentationId);
        if (p) marks.push({ keys: new Set(Trail.traceKeys(p)), at: Date.parse(e.at) });
      }
      if (!ledger || !late.length && !gone.size && !strays) return ledger;
      const after = ([eventId, at, , familyKey, itemKey = familyKey]) => gone.has(eventId) || marks.some((m) => (m.keys.has(`item:${itemKey}`) || m.keys.has(`family:${familyKey}`)) && at > m.at);
      const excludedHelp = (h) => Array.isArray(h) && gone.has(h[0]);
      const next = { ...ledger, cells: { ...ledger.cells }, content: { ...ledger.content }, adjusted: (ledger.adjusted || 0) + late.length + strays };
      for (const table of [next.cells, next.content]) for (const [key, cell] of Object.entries(table)) {
        if (cell.ind.some(after) || cell.helped.some(excludedHelp)) table[key] = { ...cell, ind: cell.ind.filter((row) => !after(row)), helped: cell.helped.filter((h) => !excludedHelp(h)) };
      }
      return next;
    }
    module.exports = { VERSION, BITS, FOLDABLE, empty, validate, before, rows: rows2, cellOf, contentOf, fold, plan, folded, stray, compare, demote };
  }
});

// atlas/learning.js
var require_learning = __commonJS({
  "atlas/learning.js"(exports, module) {
    "use strict";
    var POLICY = Object.freeze({ version: "learning-priority-3", recentDays: 30, reviewDays: 7, sample: 4, stableRatio: 0.8 });
    var RESPONSE_FORMATS = Object.freeze(["binary-choice", "single-choice", "cup-compose", "action", "unknown"]);
    var { learningReason, activityReason, SUPPORTS } = require_vellum();
    var Ledger = require_learning_ledger();
    var DAY = 864e5;
    function formatEvidence(rows2, { now, complete, difficulty, responseFormat, base = null }) {
      if (base) rows2 = [...base.rows, ...rows2];
      const unique = /* @__PURE__ */ new Map();
      for (const a of rows2) if (complete && a.independent && !unique.has(a.measure.familyKey)) unique.set(a.measure.familyKey, a);
      const valid = [...unique.values()].filter((a) => Date.parse(a.at) <= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      const recent = valid.filter((a) => now - Date.parse(a.at) <= POLICY.recentDays * DAY).slice(-12);
      const n = recent.length, correct = recent.filter((a) => a.verdict === "correct").length, incorrect = n - correct;
      const lastAt = valid.at(-1)?.at || null;
      const helped = rows2.filter((a) => !a.exclusionReason && a.assisted === true && a.verdict === "correct" && Date.parse(a.at) <= now && now - Date.parse(a.at) <= POLICY.recentDays * DAY);
      let status = "unseen", priority = 0.65;
      if (lastAt && now - Date.parse(lastAt) > POLICY.reviewDays * DAY) {
        status = "review";
        priority = 0.8;
      } else if (n >= POLICY.sample && correct / n >= POLICY.stableRatio) {
        status = "recent-independent";
        priority = 0.15;
      } else if (n >= 3 && incorrect >= 2) {
        status = "practice";
        priority = 1;
      } else if (n) {
        status = "checking";
        priority = incorrect ? 0.85 : 0.55;
      } else if (helped.length) {
        status = "supported";
        priority = 0.9;
      }
      const reasonEvidence = status === "supported" ? helped.slice(-12) : status === "review" && !recent.length ? valid.slice(-1) : recent;
      return {
        difficulty,
        responseFormat,
        status,
        priority,
        n,
        correct,
        incorrect,
        lastAt,
        assisted: helped.length,
        evidence: recent.map((a) => a.eventId),
        reasonEvidence: reasonEvidence.map((a) => a.eventId),
        unassessed: rows2.filter((a) => a.verdict === "unassessed" || a.verdict === "skipped").length + (base?.unassessed || 0)
      };
    }
    function summarizeLearning({ summary, map, complete = true, prior = null }) {
      const now = Date.parse(summary.asOf);
      const skills = map.allNodes().filter((n) => n.kind === "skill").map((node) => {
        const all = summary.attempts.filter((a) => a.measure?.skillId === node.id);
        const levels = {};
        for (const difficulty of [1, 2, 3]) {
          const rows2 = all.filter((a) => a.measure.difficulty === difficulty);
          const formats = Object.fromEntries(RESPONSE_FORMATS.map((responseFormat) => {
            const cell = Ledger.cellOf(prior, `${node.id}|${difficulty}|${responseFormat}`);
            return [responseFormat, formatEvidence(
              rows2.filter((a) => (a.measure.responseFormat || "unknown") === responseFormat),
              { now, complete, difficulty, responseFormat, base: cell ? Ledger.rows(cell) : null }
            )];
          }));
          const observed2 = Object.values(formats).filter((f) => f.lastAt || f.assisted);
          const focus2 = observed2.sort((a, b) => b.priority - a.priority)[0] || Object.values(formats).find((f) => f.unassessed) || formats.unknown;
          levels[difficulty] = { ...focus2, formats };
        }
        const observed = Object.values(levels).filter((l) => l.lastAt || l.assisted);
        const focus = observed.sort((a, b) => b.priority - a.priority || a.difficulty - b.difficulty)[0] || Object.values(levels).find((l) => l.unassessed) || levels[1];
        return { id: node.id, label: node.label_ko, domain: node.domain, ...focus, levels };
      });
      return {
        policy: POLICY.version,
        skills,
        evidenceComplete: complete,
        asOf: summary.asOf,
        independent: skills.reduce((n, s) => n + Object.values(s.levels).reduce((m, l) => m + Object.values(l.formats).reduce((sum, f) => sum + f.n, 0), 0), 0),
        learningEffectClaim: false,
        grade: null
      };
    }
    var CONTENT_LIFT = Object.freeze({ practice: 0.2, review: 0.1, supported: 0.05 });
    function rankLearning({ profile, candidates, presentations = [], audioAvailable = true, excludeIds = [], prior = null }) {
      if (!Array.isArray(candidates)) throw new TypeError("Core: candidates must be an array");
      const ids = /* @__PURE__ */ new Set(), skills = new Map(profile.skills.map((s) => [s.id, s]));
      const content = new Map((profile.concepts || []).map((c) => [c.id, c.status]));
      const history2 = { task: /* @__PURE__ */ new Map(), item: /* @__PURE__ */ new Map(), family: /* @__PURE__ */ new Map() };
      for (const [index, presentation] of presentations.entries()) {
        for (const [kind, key] of [
          ["task", presentation.taskId],
          ["item", presentation.itemKey],
          ["family", presentation.measure?.familyKey || presentation.itemKey]
        ]) {
          if (!key) continue;
          if (!history2[kind].has(key)) history2[kind].set(key, []);
          history2[kind].get(key).push(index);
        }
      }
      const weight = /* @__PURE__ */ new Map();
      for (const [i, [task, item, family, n]] of (prior?.presented || []).entries()) {
        const ref = `folded:${i}`;
        weight.set(ref, n);
        for (const [kind, key] of [["task", task], ["item", item], ["family", family]]) {
          if (!key) continue;
          if (!history2[kind].has(key)) history2[kind].set(key, []);
          history2[kind].get(key).push(ref);
        }
      }
      const ranked = [];
      for (const candidate of candidates) {
        if (!candidate || typeof candidate.id !== "string" || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(candidate.id) || ids.has(candidate.id) || !Array.isArray(candidate.skillIds) || !candidate.skillIds.length || !candidate.skillIds.every((id) => skills.has(id)) || ![1, 2, 3].includes(candidate.difficulty) || typeof candidate.modality !== "string" || !/^[a-z][a-z0-9_-]{0,40}$/.test(candidate.modality) || !RESPONSE_FORMATS.includes(candidate.responseFormat ?? "unknown") || candidate.skillIds.some((id) => skills.get(id).domain !== candidate.modality)) throw new TypeError("Core: invalid learning candidate");
        ids.add(candidate.id);
        if (excludeIds.includes(candidate.id) || !audioAvailable && (candidate.audioRequired ?? candidate.modality === "listening")) continue;
        const responseFormat = candidate.responseFormat ?? "unknown";
        const states = candidate.skillIds.map((id) => ({ ...skills.get(id).levels[candidate.difficulty].formats[responseFormat], skill: skills.get(id) }));
        const focus = states.sort((a, b) => b.priority - a.priority)[0];
        const previous = /* @__PURE__ */ new Set([
          ...history2.task.get(candidate.id) || [],
          ...history2.item.get(candidate.itemKey) || [],
          ...history2.family.get(candidate.familyKey || candidate.itemKey) || []
        ]);
        const immediate = [...previous].some((index) => typeof index === "number" && index >= presentations.length - 4);
        const count = [...previous].reduce((n, index) => n + (weight.get(index) || 1), 0);
        const readyForHarder = candidate.difficulty === 1 || candidate.skillIds.every((id) => skills.get(id).levels[candidate.difficulty - 1].formats[responseFormat].status === "recent-independent");
        if (candidate.conceptIds != null && (!Array.isArray(candidate.conceptIds) || candidate.conceptIds.some((id) => typeof id !== "string"))) throw new TypeError("Core: invalid learning candidate");
        if (candidate.familyKeys != null && (!Array.isArray(candidate.familyKeys) || !candidate.familyKeys.length || candidate.familyKeys.length > 500 || candidate.familyKeys.some((key) => typeof key !== "string"))) throw new TypeError("Core: invalid learning candidate");
        const lift = Math.max(0, ...(candidate.conceptIds || []).map((id) => CONTENT_LIFT[content.get(id)] || 0));
        const exhausted = !!candidate.familyKeys && candidate.familyKeys.every((key) => history2.family.has(key));
        const score = focus.priority - (immediate ? 0.45 : 0) - (previous.size ? 0.1 : 0) - (!readyForHarder ? 0.25 * (candidate.difficulty - 1) : 0) - (exhausted ? 0.5 : 0);
        ranked.push({ candidate, focus, score, lift, count });
      }
      ranked.sort((a, b) => b.score - a.score || b.lift - a.lift || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));
      return ranked;
    }
    function recommend(input) {
      const ranked = rankLearning(input);
      if (!ranked.length) return { status: "unavailable", selected: null, reason: "\uC9C0\uAE08 \uC870\uAC74\uC5D0 \uB9DE\uB294 \uC5F0\uC2B5\uC774 \uC5C6\uC5B4\uC694.", alternatives: [] };
      const best = ranked[0], label = best.focus.skill.label;
      return {
        status: "ready",
        selected: best.candidate,
        reason: learningReason({ status: best.focus.status, label }),
        focusSkillId: best.focus.skill.id,
        state: best.focus.status,
        responseFormat: best.focus.responseFormat,
        policy: POLICY.version,
        evidence: best.focus.evidence,
        alternatives: ranked.slice(1).map((r) => r.candidate)
      };
    }
    var ACTIVITY_POLICY = "learning-activity-1";
    var activityToken = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
    var activityTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
    var activityList = (value) => Array.isArray(value) && value.every(activityToken) && new Set(value).size === value.length;
    function recommendActivities({ profile, candidates, settings = {}, at = profile?.asOf, presentations = [], prior = null } = {}) {
      if (!profile || !Array.isArray(profile.skills) || typeof profile.evidenceComplete !== "boolean" || !activityTime(at) || !Array.isArray(candidates) || candidates.length > 500 || !settings || typeof settings !== "object" || Array.isArray(settings) || Object.keys(settings).some((key) => !["goals", "minutes", "support", "audioAvailable"].includes(key)) || settings.goals != null && !activityList(settings.goals) || settings.minutes != null && (!Number.isFinite(settings.minutes) || settings.minutes <= 0) || settings.support != null && !SUPPORTS.includes(settings.support) || settings.audioAvailable != null && typeof settings.audioAvailable !== "boolean") throw new TypeError("Core: invalid activity recommendation");
      const usable = profile.evidenceComplete ? profile : { ...profile, concepts: [], skills: profile.skills.map((skill2) => ({
        ...skill2,
        levels: Object.fromEntries([1, 2, 3].map((difficulty) => [difficulty, { formats: Object.fromEntries(RESPONSE_FORMATS.map((responseFormat) => [
          responseFormat,
          { difficulty, responseFormat, status: "unseen", priority: 0.65, n: 0, correct: 0, incorrect: 0, assisted: 0, evidence: [] }
        ])) }]))
      })) };
      const goals = new Set(settings.goals || []), ids = /* @__PURE__ */ new Set(), ranked = [], excluded = [];
      for (const candidate of candidates) {
        if (!candidate || !activityToken(candidate.id) || ids.has(candidate.id) || !Number.isFinite(candidate.minutes) || candidate.minutes <= 0 || !Array.isArray(candidate.targets) || candidate.targets.length > 500 || candidate.goals != null && !activityList(candidate.goals) || candidate.supports != null && (!Array.isArray(candidate.supports) || !candidate.supports.length || candidate.supports.some((support) => !SUPPORTS.includes(support)) || new Set(candidate.supports).size !== candidate.supports.length) || candidate.audioRequired != null && typeof candidate.audioRequired !== "boolean" || candidate.available != null && typeof candidate.available !== "boolean" || candidate.reviewAt != null && !activityTime(candidate.reviewAt) || candidate.practiceNeed != null && (!["retry", "assisted"].includes(candidate.practiceNeed.kind) || Object.keys(candidate.practiceNeed).some((key) => !["kind", "at", "evidenceRefs"].includes(key)) || !activityTime(candidate.practiceNeed.at) || Date.parse(candidate.practiceNeed.at) > Date.parse(at) || !activityList(candidate.practiceNeed.evidenceRefs) || !candidate.practiceNeed.evidenceRefs.length)) throw new TypeError("Core: invalid learning activity");
        ids.add(candidate.id);
        const targets = rankLearning({
          profile: usable,
          candidates: candidate.targets,
          presentations,
          prior,
          audioAvailable: settings.audioAvailable !== false
        });
        const blocked = [];
        if (candidate.available === false) blocked.push("activity.unavailable");
        if (settings.minutes != null && candidate.minutes > settings.minutes) blocked.push("time.limit");
        if (settings.audioAvailable === false && (candidate.audioRequired || candidate.targets.length && !targets.length)) blocked.push("audio.unavailable");
        if (settings.support && settings.support !== "choose" && candidate.supports && !candidate.supports.includes(settings.support)) blocked.push("support.mismatch");
        if (blocked.length) {
          excluded.push({ id: candidate.id, reasons: blocked });
          continue;
        }
        const target = targets[0] || null, state = target?.focus.status || "unseen";
        const due = candidate.reviewAt != null && Date.parse(candidate.reviewAt) <= Date.parse(at);
        const hostNeed = candidate.practiceNeed && Date.parse(at) - Date.parse(candidate.practiceNeed.at) <= POLICY.recentDays * DAY ? candidate.practiceNeed : null;
        const urgent = due || hostNeed || ["practice", "supported", "review"].includes(state);
        const tier = urgent ? 0 : state === "recent-independent" ? 2 : 1;
        const matchedGoals = (candidate.goals || []).filter((goal) => goals.has(goal));
        const reasons = [
          ...due ? ["review.due"] : [],
          ...hostNeed ? [`activity.${hostNeed.kind}`] : [],
          ...target && state !== "unseen" ? [`practice.${state}`] : [],
          ...matchedGoals.length ? ["goal.declared"] : [],
          ...!profile.evidenceComplete ? ["history.incomplete"] : [],
          ...!due && !hostNeed && state === "unseen" && !matchedGoals.length ? ["practice.unseen"] : []
        ];
        ranked.push({ candidate, target, state, tier, matchedGoals, due, hostNeed, reasons });
      }
      ranked.sort((a, b) => a.tier - b.tier || b.matchedGoals.length - a.matchedGoals.length || Number(b.due) - Number(a.due) || (b.target?.score ?? 0.65) - (a.target?.score ?? 0.65) || (b.target?.lift ?? 0) - (a.target?.lift ?? 0) || (a.target?.count ?? 0) - (b.target?.count ?? 0) || a.candidate.minutes - b.candidate.minutes || a.candidate.id.localeCompare(b.candidate.id));
      const best = ranked[0];
      const common = {
        policy: ACTIVITY_POLICY,
        asOf: at,
        evidenceComplete: profile.evidenceComplete,
        excluded,
        learningEffectClaim: false,
        abilityClaim: false,
        grade: null
      };
      if (!best) return {
        ...common,
        status: "unavailable",
        selected: null,
        alternatives: [],
        reasons: ["activity.none"],
        reason: activityReason({ reasons: ["activity.none"] }),
        evidence: [],
        focusSkillId: null,
        state: null,
        matchedGoals: []
      };
      const detail = (row) => ({
        id: row.candidate.id,
        reasons: [...row.reasons],
        state: row.state,
        focusSkillId: row.target?.focus.skill.id || null,
        matchedGoals: [...row.matchedGoals],
        evidence: [...row.target?.focus.reasonEvidence || row.target?.focus.evidence || []],
        ...row.due ? { reviewAt: row.candidate.reviewAt, reviewSource: "host-schedule" } : {},
        ...row.hostNeed ? { hostEvidence: { kind: row.hostNeed.kind, at: row.hostNeed.at, evidenceRefs: [...row.hostNeed.evidenceRefs], source: "host-practice" } } : {}
      });
      return {
        ...common,
        status: "ready",
        selected: best.candidate,
        alternatives: ranked.slice(1).map((row) => row.candidate),
        ...detail(best),
        reason: activityReason({ reasons: best.reasons, state: best.state, label: best.target?.focus.skill.label }),
        basis: best.due ? "review-schedule" : best.hostNeed ? "host-practice" : best.target && best.state !== "unseen" ? "practice" : best.matchedGoals.length ? "declared" : "cold-start",
        assessments: ranked.map(detail)
      };
    }
    var CONTENT = Object.freeze(["word", "grammar_point"]);
    function summarizeConcepts({ summary, map, complete = true, prior = null }) {
      const now = Date.parse(summary.asOf), rows2 = /* @__PURE__ */ new Map();
      for (const key of Object.keys(prior?.content || {})) {
        const id = key.slice(0, key.lastIndexOf("|")), node = map.getNode(id);
        if (node && CONTENT.includes(node.kind) && !rows2.has(id)) rows2.set(id, { node, list: [] });
      }
      for (const a of summary.attempts) {
        if (!a.measure) continue;
        for (const id of a.conceptIds) {
          if (id === a.measure.skillId) continue;
          const node = map.getNode(id);
          if (!node || !CONTENT.includes(node.kind)) continue;
          if (!rows2.has(id)) rows2.set(id, { node, list: [] });
          rows2.get(id).list.push(a);
        }
      }
      return [...rows2.values()].map(({ node, list }) => {
        const formats = {};
        for (const responseFormat of RESPONSE_FORMATS) {
          const own2 = list.filter((a) => (a.measure.responseFormat || "unknown") === responseFormat);
          const cell = Ledger.contentOf(prior, `${node.id}|${responseFormat}`);
          if (own2.length || cell) formats[responseFormat] = formatEvidence(own2, { now, complete, difficulty: null, responseFormat, base: cell ? Ledger.rows(cell) : null });
        }
        const focus = Object.values(formats).sort((a, b) => b.priority - a.priority)[0];
        return { id: node.id, kind: node.kind, label: node.label_ko, status: focus.status, priority: focus.priority, formats };
      }).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    }
    module.exports = { POLICY, ACTIVITY_POLICY, RESPONSE_FORMATS, CONTENT, summarizeLearning, summarizeConcepts, recommend, recommendActivities, formatEvidence };
  }
});

// atlas/learning-sync.js
var require_learning_sync = __commonJS({
  "atlas/learning-sync.js"(exports, module) {
    "use strict";
    var SYNC_KEY = "synk.atlas.learning-sync.v1";
    var id = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
    var clone2 = (value) => JSON.parse(JSON.stringify(value));
    var canonical = (value) => JSON.stringify(value, function(_key, entry) {
      return entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry;
    });
    var sameEvent = (a, b) => canonical(a) === canonical(b);
    var failure = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
    var errorCode = (error2) => error2?.code || error2?.error?.code || error2?.body?.error?.code || "NETWORK_ERROR";
    var FATAL = /* @__PURE__ */ new Set([
      "REVISION_CONFLICT",
      "LEARNING_DISABLED",
      "FEATURE_DISABLED",
      "HISTORY_CAPACITY",
      "HISTORY_FOLDED",
      "EVENT_CONFLICT",
      "INVALID_EVENTS",
      "INVALID_RESPONSE",
      "STORAGE_ERROR",
      "UNAUTHORIZED",
      "AUTH_REQUIRED",
      "AUTH_SESSION_MISSING",
      "SESSION_REVOKED",
      "MEMORY_SESSION_ENDED",
      "EVENT_RUN_CONFLICT",
      "EVENT_BEFORE_RUN",
      "WRONG_RUN_CONTENT",
      "FORBIDDEN"
    ]);
    function createLearningSync({
      adapter,
      accountKey,
      revision,
      storage,
      transport,
      onStatus = () => {
      },
      batchSize = 100,
      maxAttempts = 3,
      maxPages = 200,
      timeoutMs = 15e3,
      backoffMs = [500, 1500, 5e3],
      sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      auto = true
    } = {}) {
      const port = adapter?.syncPort;
      if (!id(accountKey) || !Number.isSafeInteger(revision) || revision < 1 || !port || port.scope !== "account" || port.accountKey !== accountKey || !storage?.getItem || !storage?.setItem || typeof transport?.get !== "function" || typeof transport?.post !== "function") throw new TypeError("Atlas sync: an authenticated account adapter, isolated durable store and transport are required");
      if (![batchSize, maxAttempts, maxPages, timeoutMs].every((n) => Number.isInteger(n) && n > 0) || batchSize > 500 || maxAttempts > 10 || !Array.isArray(backoffMs) || !backoffMs.length || backoffMs.some((ms) => !Number.isFinite(ms) || ms < 0)) throw new TypeError("Atlas sync: invalid retry bounds");
      const key = `${SYNC_KEY}.${accountKey}`;
      let state = { version: 2, accountKey, revision, cursor: 0, complete: false, acknowledged: [], pending: [], missing: [] };
      let phase = "idle", code = null, message = null, stopped = false, started = false, generation = 0, running = null, timer = null, flushRequested = false;
      const controllers = /* @__PURE__ */ new Set();
      const whole = () => state.complete && !state.missing.length;
      const status = () => ({
        phase,
        code,
        message,
        revision,
        cursor: state.cursor,
        queued: state.pending.length,
        complete: whole() && phase !== "blocked" && phase !== "stopped",
        accountKey,
        durable: !["STORAGE_ERROR", "HISTORY_CAPACITY"].includes(code)
      });
      const publish = () => {
        try {
          onStatus(status());
        } catch {
        }
      };
      const block = (error2) => {
        generation++;
        clearTimeout(timer);
        timer = null;
        for (const controller of controllers) controller.abort();
        phase = "blocked";
        code = errorCode(error2);
        message = error2?.message || code;
        port.markComplete(false);
        publish();
      };
      const save = () => {
        try {
          storage.setItem(key, JSON.stringify(state));
        } catch {
          throw failure("STORAGE_ERROR", "Atlas sync: the durable outbox could not be saved");
        }
      };
      try {
        const raw = storage.getItem(key);
        if (raw != null) {
          const stored = JSON.parse(raw), v1 = stored?.version === 1;
          if (!stored || ![1, 2].includes(stored.version) || stored.accountKey !== accountKey || !Number.isSafeInteger(stored.cursor) || stored.cursor < 0 || typeof stored.complete !== "boolean" || !Array.isArray(stored.acknowledged) || !stored.acknowledged.every(id) || !Array.isArray(stored.pending) || !stored.pending.every(v1 ? (e) => id(e?.id) : id) || !(stored.missing === void 0 || Array.isArray(stored.missing) && stored.missing.every(id)) || stored.pending.length + stored.acknowledged.length + (stored.missing?.length || 0) > 4e4) throw failure("STORAGE_ERROR", "Atlas sync: unreadable outbox; preserved without replacement");
          if (stored.revision !== revision) throw failure("REVISION_CONFLICT", "Atlas sync: a new consent revision requires a fresh account store");
          state = { ...stored, version: 2, pending: v1 ? stored.pending.map((e) => e.id) : stored.pending, missing: stored.missing || [] };
        }
        port.markComplete(whole());
      } catch (error2) {
        block(error2?.code ? error2 : failure("STORAGE_ERROR", "Atlas sync: unreadable outbox; preserved without replacement"));
      }
      const collect = () => {
        if (typeof port.partial === "function" && port.partial()) throw failure("HISTORY_FOLDED", "Atlas sync: this log summarised entries no server received; it cannot be sent");
        const local = port.events(), localIds = new Set(local.map((event) => event.id));
        if (state.pending.some((eventId) => !localIds.has(eventId))) throw failure("STORAGE_ERROR", "Atlas sync: queued history does not match its account log");
        const folded = new Set(typeof port.dropped === "function" ? port.dropped() : []);
        const lost = state.acknowledged.filter((eventId) => !localIds.has(eventId) && !folded.has(eventId));
        if (lost.length) {
          state.missing = [.../* @__PURE__ */ new Set([...state.missing, ...lost])];
          port.markComplete(false);
        }
        state.acknowledged = state.acknowledged.filter((eventId) => localIds.has(eventId));
        state.missing = state.missing.filter((eventId) => !localIds.has(eventId));
        const queued = new Set(state.pending), acknowledged = new Set(state.acknowledged);
        for (const event of local) if (!queued.has(event.id) && !acknowledged.has(event.id)) {
          queued.add(event.id);
          state.pending.push(event.id);
        }
        save();
        if (folded.size && typeof port.forget === "function") port.forget([...folded]);
      };
      const schedule = () => {
        if (!auto || !started || stopped || phase === "blocked" || phase === "offline" || timer) return;
        timer = setTimeout(() => {
          timer = null;
          void run();
        }, 0);
      };
      const unsubscribe = port.subscribe((change) => {
        if (stopped || phase === "blocked" || change.kind === "import") return;
        if (change.kind === "storage-error") {
          block(failure(change.code || "STORAGE_ERROR", "Atlas sync: local learning could not be saved"));
          return;
        }
        try {
          collect();
          publish();
          schedule();
        } catch (error2) {
          block(error2);
        }
      });
      if (phase !== "blocked") {
        try {
          collect();
        } catch (error2) {
          block(error2);
        }
      }
      const active = (token) => !stopped && token === generation;
      const request = async (method, body, token) => {
        let last;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (!active(token)) throw failure("STOPPED", "Atlas sync: stopped");
          const controller = new AbortController();
          controllers.add(controller);
          let deadline;
          try {
            const response = await Promise.race([
              Promise.resolve().then(() => transport[method]({ ...body, signal: controller.signal })),
              new Promise((_, reject) => {
                deadline = setTimeout(() => {
                  reject(failure("NETWORK_ERROR", "Atlas sync: request timed out"));
                  controller.abort();
                }, timeoutMs);
                controller.signal.addEventListener("abort", () => reject(failure("STOPPED", "Atlas sync: request cancelled")), { once: true });
              })
            ]);
            if (!active(token)) throw failure("STOPPED", "Atlas sync: stale request");
            if (response?.ok === false) throw failure(response.error?.code || "INVALID_RESPONSE", response.error?.message || "Atlas sync: rejected", { revision: response.revision });
            if (!response || response.revision !== revision) throw failure("REVISION_CONFLICT", "Atlas sync: server revision changed", { revision: response?.revision });
            return response;
          } catch (error2) {
            last = error2;
            if (!active(token) || FATAL.has(errorCode(error2))) throw error2;
          } finally {
            clearTimeout(deadline);
            controllers.delete(controller);
          }
          if (attempt + 1 < maxAttempts) await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)]);
        }
        throw last;
      };
      const pullPages = async (token) => {
        for (let page = 0; page < maxPages; page++) {
          const before = state.cursor, response = await request("get", { after: before, revision }, token);
          if (!Array.isArray(response.events) || !Number.isSafeInteger(response.cursor) || response.cursor < before || typeof response.hasMore !== "boolean" || response.hasMore && response.cursor <= before || response.events.length && response.cursor <= before) throw failure("INVALID_RESPONSE", "Atlas sync: invalid or stalled server cursor");
          if (!active(token)) return;
          let result;
          try {
            result = port.importEvents(response.events);
          } catch (error2) {
            throw failure(error2?.code || "INVALID_EVENTS", error2.message);
          }
          const skipped = new Set(result?.skipped || []), remote = new Set(state.acknowledged);
          for (const event of response.events) if (!skipped.has(event.id)) remote.add(event.id);
          state.acknowledged = [...remote];
          state.pending = state.pending.filter((eventId) => !remote.has(eventId));
          state.cursor = response.cursor;
          if (!response.hasMore) state.complete = true;
          save();
          port.markComplete(whole());
          publish();
          if (!response.hasMore) {
            if (typeof port.settle === "function") port.settle(state.acknowledged);
            return;
          }
        }
        throw failure("INVALID_RESPONSE", "Atlas sync: page limit exceeded");
      };
      const recover = async (token) => {
        let after = 0;
        for (let page = 0; page < maxPages && state.missing.length; page++) {
          const response = await request("get", { after, revision }, token);
          if (!Array.isArray(response.events) || !Number.isSafeInteger(response.cursor) || response.cursor < after || typeof response.hasMore !== "boolean" || response.hasMore && response.cursor <= after) throw failure("INVALID_RESPONSE", "Atlas sync: invalid or stalled server cursor");
          if (!active(token)) return;
          const wanted = new Set(state.missing), found = response.events.filter((event) => wanted.has(event.id));
          if (found.length) {
            let result;
            try {
              result = port.importEvents(found);
            } catch (error2) {
              throw failure(error2?.code || "INVALID_EVENTS", error2.message);
            }
            const skipped = new Set(result?.skipped || []), back = new Set(found.map((event) => event.id));
            state.acknowledged = [.../* @__PURE__ */ new Set([...state.acknowledged, ...[...back].filter((eventId) => !skipped.has(eventId))])];
            state.missing = state.missing.filter((eventId) => !back.has(eventId));
          }
          after = response.cursor;
          if (!response.hasMore || after >= state.cursor) {
            state.missing = [];
          }
          save();
          port.markComplete(whole());
          publish();
        }
      };
      const flushQueue = async (token) => {
        let emptyAcks = 0;
        for (let batch = 0; batch < maxPages; batch++) {
          collect();
          if (!state.pending.length) return;
          const local = new Map(port.events().map((event) => [event.id, event]));
          const events = state.pending.slice(0, batchSize).map((eventId) => clone2(local.get(eventId))), sent = new Set(events.map((event) => event.id));
          const response = await request("post", { revision, events }, token);
          if (!Array.isArray(response.accepted) || new Set(response.accepted).size !== response.accepted.length || response.accepted.some((eventId) => !sent.has(eventId))) throw failure("INVALID_RESPONSE", "Atlas sync: acknowledgement contains an unsent event");
          if (!active(token)) return;
          if (!response.accepted.length) {
            if (++emptyAcks >= maxAttempts) throw failure("NETWORK_ERROR", "Atlas sync: no acknowledged progress");
            await sleep(backoffMs[Math.min(emptyAcks - 1, backoffMs.length - 1)]);
            continue;
          }
          emptyAcks = 0;
          const accepted = new Set(response.accepted), acknowledged = new Set(state.acknowledged);
          for (const eventId of accepted) acknowledged.add(eventId);
          state.acknowledged = [...acknowledged];
          state.pending = state.pending.filter((eventId) => !accepted.has(eventId));
          save();
          publish();
        }
        throw failure("NETWORK_ERROR", "Atlas sync: batch limit reached; remaining events stay queued");
      };
      function run(pullOnly = false) {
        if (stopped || phase === "blocked") return Promise.resolve(status());
        if (running) {
          if (!pullOnly) flushRequested = true;
          return running;
        }
        flushRequested = !pullOnly;
        const token = generation;
        phase = "syncing";
        code = null;
        message = null;
        publish();
        running = (async () => {
          try {
            await pullPages(token);
            if (active(token) && state.missing.length) await recover(token);
            if (active(token) && flushRequested) await flushQueue(token);
            if (active(token)) {
              phase = "synced";
              code = null;
              message = null;
              publish();
            }
          } catch (error2) {
            if (active(token)) {
              if (FATAL.has(errorCode(error2))) block(error2);
              else {
                phase = "offline";
                code = errorCode(error2);
                message = error2?.message || code;
                publish();
              }
            }
          } finally {
            running = null;
          }
          return status();
        })();
        return running;
      }
      return Object.freeze({
        start() {
          started = true;
          return run();
        },
        pull: () => run(true),
        flush: () => run(),
        retry: () => run(),
        status,
        invalidate(code2 = "STORAGE_ERROR") {
          if (!stopped) block(failure(code2 === "HISTORY_CAPACITY" ? code2 : "STORAGE_ERROR", "Atlas sync: local learning could not be saved"));
          return status();
        },
        stop() {
          if (!stopped) {
            stopped = true;
            generation++;
            clearTimeout(timer);
            timer = null;
            unsubscribe();
            for (const controller of controllers) controller.abort();
            phase = "stopped";
            publish();
          }
          return status();
        }
      });
    }
    module.exports = { createLearningSync, sameEvent, SYNC_KEY };
  }
});

// atlas/memory-sync.js
var require_memory_sync = __commonJS({
  "atlas/memory-sync.js"(exports, module) {
    "use strict";
    var ID = /^[a-zA-Z0-9_.:-]{1,120}$/;
    var BATCH = 100;
    var ROUNDS = 50;
    var MAX_BYTES = 4096;
    var KINDS = Object.freeze(["presentation", "flow", "declined"]);
    var object3 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
    var instant = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
    var failure = (code, message) => Object.assign(new Error(message), { code });
    var errorCode = (error2) => error2?.code || error2?.error?.code || error2?.body?.error?.code || "NETWORK_ERROR";
    var FATAL = /* @__PURE__ */ new Set([
      "REVISION_CONFLICT",
      "LEARNING_DISABLED",
      "FEATURE_DISABLED",
      "MEMORY_UNAVAILABLE",
      "MEMORY_CAPACITY",
      "INVALID_MEMORY",
      "INVALID_RESPONSE",
      "UNAUTHORIZED",
      "AUTH_REQUIRED",
      "AUTH_SESSION_MISSING",
      "SESSION_REVOKED",
      "MEMORY_SESSION_ENDED",
      "PRODUCT_FORBIDDEN",
      "ACCOUNT_UNAVAILABLE"
    ]);
    var keyOf = (entry) => `${entry.kind}\0${entry.key}`;
    function entriesOf(state) {
      const out = [];
      if (object3(state?.presentation)) out.push({ kind: "presentation", key: "chosen", value: state.presentation.value ?? null, at: state.presentation.at });
      for (const [key, memory] of Object.entries(object3(state?.flow) ? state.flow : {})) out.push({ kind: "flow", key, value: memory, at: memory?.at });
      for (const [key, at] of Object.entries(object3(state?.declined) ? state.declined : {})) out.push({ kind: "declined", key, value: null, at });
      return out;
    }
    function stateOf(entries) {
      const state = { presentation: null, flow: {}, declined: {} };
      for (const entry of entries) {
        if (entry.kind === "presentation") state.presentation = { value: entry.value, at: entry.at };
        else if (entry.kind === "flow") state.flow[entry.key] = entry.value;
        else state.declined[entry.key] = entry.at;
      }
      return state;
    }
    function sendable(entry) {
      if (!KINDS.includes(entry.kind) || !ID.test(entry.key || "") || !instant(entry.at)) return false;
      if (entry.kind === "presentation") return entry.key === "chosen" && (entry.value === null || object3(entry.value));
      if (entry.kind === "declined") return entry.value === null;
      return object3(entry.value) && entry.value.content === entry.key && Date.parse(entry.value.at) === Date.parse(entry.at) && JSON.stringify(entry.value).length <= MAX_BYTES;
    }
    var received = (entry) => object3(entry) && KINDS.includes(entry.kind) && ID.test(entry.key || "") && instant(entry.at) && (entry.kind === "flow" ? object3(entry.value) : entry.kind === "declined" ? entry.value === null : entry.value === null || object3(entry.value));
    function createMemorySync({
      adapter,
      accountKey,
      revision,
      transport,
      onStatus = () => {
      },
      delayMs = 3e3,
      timeoutMs = 15e3,
      setTimer = (fn, ms) => setTimeout(fn, ms),
      clearTimer = (id) => clearTimeout(id)
    } = {}) {
      const port = adapter?.memoryPort;
      if (!ID.test(accountKey || "") || !Number.isSafeInteger(revision) || revision < 1 || !port || port.scope !== "account" || port.accountKey !== accountKey || typeof port.state !== "function" || typeof port.merge !== "function" || typeof port.subscribe !== "function" || typeof transport?.get !== "function" || typeof transport?.post !== "function") throw new TypeError("Atlas memory sync: an authenticated account adapter and transport are required");
      if (!Number.isFinite(delayMs) || delayMs < 0 || !Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError("Atlas memory sync: invalid timing");
      const remote = /* @__PURE__ */ new Map(), refused = /* @__PURE__ */ new Map();
      let phase = "idle", code = null, stopped = false, timer = null, running = null, again = false, pulled = false, generation = 0;
      const controllers = /* @__PURE__ */ new Set();
      const newer = (at, than) => than == null || Date.parse(at) > Date.parse(than);
      const pending = () => entriesOf(port.state()).filter((entry) => instant(entry.at) && newer(entry.at, remote.get(keyOf(entry))) && refused.get(keyOf(entry)) !== entry.at);
      const status = () => {
        let queued = 0;
        try {
          queued = pending().length;
        } catch {
        }
        return { phase, code, accountKey, revision, queued };
      };
      const publish = () => {
        try {
          onStatus(status());
        } catch {
        }
      };
      const active = (token) => !stopped && token === generation;
      const call = async (method, body, token) => {
        if (!active(token)) throw failure("STOPPED", "Atlas memory sync: stopped");
        const controller = new AbortController();
        controllers.add(controller);
        let deadline;
        try {
          const response = await Promise.race([
            Promise.resolve().then(() => transport[method]({ ...body, signal: controller.signal })),
            new Promise((_, reject) => {
              deadline = setTimeout(() => {
                reject(failure("NETWORK_ERROR", "Atlas memory sync: request timed out"));
                controller.abort();
              }, timeoutMs);
              controller.signal.addEventListener("abort", () => reject(failure("STOPPED", "Atlas memory sync: request cancelled")), { once: true });
            })
          ]);
          if (!active(token)) throw failure("STOPPED", "Atlas memory sync: stale request");
          if (response?.ok === false) throw failure(response.error?.code || "INVALID_RESPONSE", response.error?.message || "Atlas memory sync: rejected");
          if (!response || response.revision !== revision) throw failure("REVISION_CONFLICT", "Atlas memory sync: server revision changed");
          if (!Array.isArray(response.entries) || !response.entries.every(received)) throw failure("INVALID_RESPONSE", "Atlas memory sync: invalid entries");
          return response;
        } finally {
          clearTimeout(deadline);
          controllers.delete(controller);
        }
      };
      const accept = (entries) => {
        port.merge(stateOf(entries));
        for (const entry of entries) if (newer(entry.at, remote.get(keyOf(entry)))) remote.set(keyOf(entry), entry.at);
      };
      async function cycle(token) {
        if (!pulled) {
          accept((await call("get", { revision }, token)).entries);
          pulled = true;
        }
        for (let round = 0; round < ROUNDS; round++) {
          const all = pending();
          for (const entry of all) if (!sendable(entry)) refused.set(keyOf(entry), entry.at);
          const batch = all.filter(sendable).slice(0, BATCH);
          if (!batch.length) return;
          const response = await call("post", { revision, entries: batch }, token);
          if (!active(token)) return;
          accept(response.entries);
          for (const entry of batch) if (newer(entry.at, remote.get(keyOf(entry)))) remote.set(keyOf(entry), entry.at);
        }
        throw failure("NETWORK_ERROR", "Atlas memory sync: too many rounds; the rest waits for the next sync");
      }
      function run({ pull = false } = {}) {
        if (stopped || phase === "blocked") return Promise.resolve(status());
        if (pull) pulled = false;
        if (running) {
          again = true;
          return running;
        }
        const token = generation;
        phase = "syncing";
        code = null;
        publish();
        running = (async () => {
          try {
            do {
              again = false;
              await cycle(token);
            } while (again && active(token));
            if (active(token)) {
              phase = "synced";
              publish();
            }
          } catch (error2) {
            if (active(token)) {
              code = errorCode(error2);
              phase = FATAL.has(code) ? "blocked" : "offline";
              publish();
            }
          } finally {
            running = null;
          }
          return status();
        })();
        return running;
      }
      const schedule = () => {
        if (stopped || phase === "blocked" || timer != null) return;
        timer = setTimer(() => {
          timer = null;
          void run();
        }, delayMs);
      };
      const unsubscribe = port.subscribe((change) => {
        if (!stopped && change?.kind !== "import") schedule();
      });
      return Object.freeze({
        // Reads the server first, then sends what is newer here.
        start: () => run({ pull: true }),
        // Sends local changes now (before the app goes to the background or a page closes).
        flush() {
          if (timer != null) {
            clearTimer(timer);
            timer = null;
          }
          return run();
        },
        // Back in front: read the server again (another device may have changed something).
        retry: () => run({ pull: true }),
        status,
        stop() {
          if (!stopped) {
            stopped = true;
            generation++;
            if (timer != null) clearTimer(timer);
            timer = null;
            unsubscribe();
            for (const controller of controllers) controller.abort();
            phase = "stopped";
            publish();
          }
          return status();
        }
      });
    }
    module.exports = { createMemorySync, entriesOf, stateOf, MAX_BYTES };
  }
});

// atlas/temper-flow.js
var require_temper_flow = __commonJS({
  "atlas/temper-flow.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory(() => require_flow());
      else root.SynkTemperFlow = factory(() => root.SynkFlow);
    })(typeof globalThis !== "undefined" ? globalThis : exports, function(getFlow) {
      "use strict";
      const VERSION = "temper-flow-1";
      const FLIP_WINDOW = 2;
      const COOL_DOWN = 2;
      function check2({ spec, knob, from, to, step, phase = "response", history: history2 = [], frozen = false } = {}) {
        if (frozen) return { ok: false, rail: "hold" };
        const k = spec?.knobs?.find((x) => x.id === knob);
        if (!k) return { ok: false, rail: "unknown-knob" };
        if (!Number.isInteger(from) || !Number.isInteger(to) || Math.abs(to - from) !== 1) return { ok: false, rail: "one-step" };
        if (to < 0 || to >= k.values.length) return { ok: false, rail: "bounds" };
        if (k.follows === "declared") return { ok: false, rail: "declared-only" };
        if (!["opening", "response", "accepted"].includes(phase) || !Number.isInteger(step) || !Array.isArray(history2)) return { ok: false, rail: "invalid" };
        if (phase !== "opening") {
          const live = history2.filter((c) => c.phase !== "opening");
          if (live.some((c) => c.step === step)) return { ok: false, rail: "one-change-per-response" };
          const recent = live.filter((c) => c.knob === knob && step - c.step <= FLIP_WINDOW).at(-1);
          if (recent && to > from && recent.to < recent.from) return { ok: false, rail: "no-bounce" };
          if (to > from && live.some((c) => c.direction > 0 && step - c.step <= COOL_DOWN)) return { ok: false, rail: "cool-down" };
        }
        return { ok: true, rail: null };
      }
      const seeded = (seed) => {
        let h = 2166136261;
        for (let i = 0; i < seed.length; i += 1) {
          h ^= seed.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        let a = h >>> 0;
        return () => {
          a = a + 1831565813 >>> 0;
          let t = a;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      };
      const normal = (rng) => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
      const phi = (x) => {
        const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
        return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
      };
      const sigmoid = (x) => 1 / (1 + Math.exp(-x));
      const SPREAD = 0.35, PACE0 = 0.55, CONTENT0 = 1.6;
      const PERSONAS = Object.freeze([
        { id: "new-careful", label: "\uCC98\uC74C\uC774\uB77C \uCC9C\uCC9C\uD788, \uADF8\uB7EC\uB098 \uC815\uD655\uD558\uAC8C", content: -0.3, speed: -1.4, slip: 0.03, growth: 0.03, assist: 0.2 },
        { id: "quick-slips", label: "\uBE60\uB974\uC9C0\uB9CC \uC2E4\uC218\uAC00 \uC7A6\uC740", content: 0, speed: 1.6, slip: 0.12, growth: 0.02, assist: 0.05 },
        { id: "experienced", label: "\uC774\uBBF8 \uC775\uC219\uD55C", content: 2.2, speed: 1.2, slip: 0.03, growth: 0.01, assist: 0 },
        { id: "steady-growth", label: "\uD558\uBA74\uC11C \uBE60\uB974\uAC8C \uB290\uB294", content: -1.5, speed: -0.2, slip: 0.05, growth: 0.08, assist: 0.2 },
        { id: "knows-but-rushed", label: "\uB0B4\uC6A9\uC740 \uC54C\uC9C0\uB9CC \uC2DC\uAC04\uC5D0 \uCAD3\uAE30\uB294", content: 1.4, speed: -1.8, slip: 0.03, growth: 0.01, assist: 0.05 },
        { id: "returning", label: "\uC624\uB79C\uB9CC\uC5D0 \uB2E4\uC2DC \uC628", content: 1, speed: 0.4, slip: 0.05, growth: 0.02, assist: 0.1, pause: { at: 30, days: 30, forget: 1 } },
        { id: "struggling", label: "\uC9C0\uAE08\uC740 \uB9CE\uC774 \uC5B4\uB824\uC6B4", content: -2.4, speed: -0.8, slip: 0.06, growth: 0.03, assist: 0.5 }
      ].map(Object.freeze));
      const part = (spec, indices, kinds) => spec.scale * spec.knobs.reduce((sum, knob) => sum + (kinds.includes(knob.kind) ? knob.weight * (indices[knob.id] - knob.start) : 0), 0);
      function truth(spec, indices, person) {
        const content = part(spec, indices, ["content", "support"]), pace = part(spec, indices, ["pace"]);
        const timed = spec.knobs.some((knob) => knob.kind === "pace");
        const correct = (1 - person.slip) * sigmoid(CONTENT0 + person.content - content);
        const median = PACE0 * Math.exp(0.5 * (pace - person.speed));
        const inTime = timed ? phi(-Math.log(median) / SPREAD) : 1;
        return { correct, inTime, success: correct * inTime, median, timed };
      }
      function run(Flow, spec, person, { steps, seed, adaptive }) {
        const rng = seeded(`${seed}|${person.id}|${adaptive ? "adapted" : "fixed"}`);
        const self = { ...person };
        let at = Date.parse("2026-10-02T00:00:00.000Z");
        const stamp = () => new Date(at).toISOString();
        let flow = Flow.start({ spec, now: stamp(), declared: adaptive ? {} : { mode: "fixed" } });
        const rows2 = [];
        let offered = -Infinity;
        for (let step = 1; step <= steps; step += 1) {
          if (self.pause && step === self.pause.at) {
            const memory = flow.memory(stamp());
            at += self.pause.days * 864e5;
            self.content -= self.pause.forget;
            self.speed -= self.pause.forget / 2;
            flow = Flow.start({ spec, memory, now: stamp(), declared: adaptive ? {} : { mode: "fixed" } });
          }
          const before = flow.settings(), chance = truth(spec, before.indices, self);
          let correct = chance.correct, assisted = false;
          if (correct < 0.5 && rng() < (self.assist || 0)) {
            assisted = true;
            correct = Math.max(correct, 0.8);
          }
          const duration = chance.median * Math.exp(SPREAD * normal(rng));
          const timeout = chance.timed && duration > 1, success = !timeout && rng() < correct;
          const outcome = timeout ? "timeout" : success ? "success" : "fail";
          const result = flow.observe({ outcome, assisted, pressure: chance.timed ? Math.min(1, duration) : null, latencyMs: Math.round(duration * 1e4) });
          let change = result.change;
          if (adaptive && !change && flow.quietStreak() >= 3 && step - offered >= 10) {
            offered = step;
            if (rng() < (self.accepts ?? 0.6)) change = flow.acceptLessHelp();
          }
          rows2.push({ step, outcome, assisted, truth: chance.success, indices: before.indices, change });
          if (success && !assisted) {
            self.content += self.growth;
            self.speed += self.growth / 2;
          }
          at += 2e4;
        }
        return { rows: rows2, final: flow.settings() };
      }
      function metrics(spec, rows2, target) {
        const half = rows2.slice(Math.floor(rows2.length / 2));
        const off = (row) => Math.abs(row.truth - target);
        const adjustable = spec.knobs.filter((knob) => knob.follows !== "declared");
        const dimensions = [adjustable.filter((k) => k.kind !== "pace"), adjustable.filter((k) => k.kind === "pace")].filter((list) => list.length);
        const atFloor = (row) => dimensions.some((list) => list.every((k) => row.indices[k.id] === 0));
        const runLength = (test) => {
          let best = 0, current = 0;
          for (const row of rows2) {
            current = test(row) ? current + 1 : 0;
            best = Math.max(best, current);
          }
          return best;
        };
        let settleAt = null;
        for (let i = 0; i + 5 < rows2.length && settleAt === null; i += 1) if (rows2.slice(i, i + 6).every((row) => off(row) <= 0.2)) settleAt = rows2[i].step;
        const changes = rows2.map((row) => row.change).filter(Boolean);
        let bounces = 0, undone = 0;
        for (let i = 2; i < rows2.length; i += 1) {
          const a = rows2[i - 2].change, b = rows2[i].change || rows2[i - 1].change;
          if (a && b && a !== b && a.knob === b.knob && a.direction === -b.direction) bounces += 1;
        }
        rows2.forEach((row, i) => {
          const c = row.change;
          if (c && c.direction < 0 && row.outcome === "success" && rows2.slice(Math.max(0, i - 2), i).some((r) => r.change?.knob === c.knob && r.change.direction > 0)) undone += 1;
        });
        return {
          inBand: Math.round(half.filter((row) => off(row) <= 0.15).length / half.length * 100) / 100,
          meanError: Math.round(half.reduce((sum, row) => sum + off(row), 0) / half.length * 1e3) / 1e3,
          successRate: Math.round(rows2.filter((row) => row.outcome === "success").length / rows2.length * 100) / 100,
          timeouts: rows2.filter((row) => row.outcome === "timeout").length,
          settleAt,
          changes: changes.length,
          bounces,
          undone,
          maxJump: changes.reduce((max, c) => Math.max(max, Math.abs(c.to - c.from)), 0),
          helpRaises: rows2.filter((row) => row.assisted && row.outcome === "success" && row.change?.direction > 0).length,
          floorTooHard: runLength((row) => atFloor(row) && row.truth < target - 0.15),
          ceilingTooEasy: runLength((row) => adjustable.every((k) => row.indices[k.id] === k.values.length - 1) && row.truth > target + 0.15)
        };
      }
      function simulate({ spec: input, personas = PERSONAS, steps = 60, seed = "temper-flow", flow = null } = {}) {
        const Flow = flow || getFlow();
        if (!Flow || typeof Flow.start !== "function") throw new Error("Temper: Flow unavailable");
        const spec = Flow.defineContent(input);
        if (!Number.isInteger(steps) || steps < 12 || steps > 2e3 || typeof seed !== "string") throw new TypeError("Temper: invalid simulation size");
        const results = personas.map((person) => {
          const adapted = run(Flow, spec, person, { steps, seed, adaptive: true });
          const fixed = run(Flow, spec, person, { steps, seed, adaptive: false });
          return {
            id: person.id,
            label: person.label,
            adapted: metrics(spec, adapted.rows, spec.target),
            fixed: metrics(spec, fixed.rows, spec.target),
            final: adapted.final.values,
            path: adapted.rows.map((row) => Math.round(row.truth * 100) / 100),
            fixedPath: fixed.rows.map((row) => Math.round(row.truth * 100) / 100)
          };
        });
        const all = results.map((r) => r.adapted);
        return {
          version: VERSION,
          content: `${spec.id}@${spec.version}`,
          policy: Flow.VERSION,
          steps,
          seed,
          target: spec.target,
          personas: results,
          invariants: { maxJump: Math.max(0, ...all.map((m) => m.maxJump)), helpRaises: all.reduce((n, m) => n + m.helpRaises, 0) },
          learningEffectClaim: false,
          note: "\uAC00\uC0C1 \uC0AC\uB78C\uC73C\uB85C \uAD6C\uD604\uACFC \uADDC\uCE59\uC744 \uD655\uC778\uD55C \uACB0\uACFC\uB2E4. \uC2E4\uC81C \uC0AC\uB78C\uC758 \uD559\uC2B5 \uD6A8\uACFC\xB7\uB9CC\uC871\xB7\uC131\uACFC\uC758 \uC99D\uAC70\uAC00 \uC544\uB2C8\uB2E4."
        };
      }
      return Object.freeze({ VERSION, FLIP_WINDOW, COOL_DOWN, PERSONAS, check: check2, truth, simulate });
    });
  }
});

// atlas/flow.js
var require_flow = __commonJS({
  "atlas/flow.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory(() => require_temper_flow());
      else root.SynkFlow = factory(() => root.SynkTemperFlow);
    })(typeof globalThis !== "undefined" ? globalThis : exports, function(getGuard) {
      "use strict";
      const VERSION = "flow-1";
      const KINDS = ["content", "pace", "support"];
      const OUTCOMES = ["success", "fail", "timeout", "skip", "void"];
      const MODES = ["auto", "fixed", "easier", "harder"];
      const CONDITIONS = ["good", "okay", "tired", "no_time"];
      const DIMENSIONS = ["content", "pace"];
      const DAY = 864e5, RETURN_AFTER = 14 * DAY, LATENCIES = 20;
      const RATE = Object.freeze({ max: 1.2, half: 3, min: 0.3, recover: 4 });
      const STREAK = 4;
      const DEADBAND = 0.75;
      const PACE_TARGET = 0.9;
      const ITEM = "item.difficulty";
      const copy2 = (value) => JSON.parse(JSON.stringify(value));
      const id = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      const scalar = (value) => ["number", "string", "boolean"].includes(typeof value) && (typeof value !== "number" || Number.isFinite(value));
      const within = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
      const sigmoid = (x) => 1 / (1 + Math.exp(-x));
      const logit = (p) => Math.log(p / (1 - p));
      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
      const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
      const time2 = (value) => {
        const n = Date.parse(value);
        if (typeof value !== "string" || !Number.isFinite(n)) throw new TypeError("Flow: invalid time");
        return n;
      };
      const fail2 = (message) => {
        throw new TypeError(`Flow: ${message}`);
      };
      const dimensionOf = (knob) => knob.kind === "pace" ? "pace" : "content";
      const defined = /* @__PURE__ */ new WeakSet();
      function defineContent(input) {
        if (defined.has(input)) return input;
        if (!input || typeof input !== "object" || Array.isArray(input)) fail2("content spec required");
        if (Object.keys(input).some((key) => !["id", "version", "target", "scale", "knobs", "items"].includes(key))) fail2("unknown spec field");
        const spec = { id: input.id, version: input.version ?? 1, target: input.target ?? 0.75, scale: input.scale ?? 0.5, knobs: [], items: null };
        if (!id(spec.id) || !Number.isInteger(spec.version) || spec.version < 1) fail2("invalid content id or version");
        if (!within(spec.target, 0.55, 0.9) || !within(spec.scale, 0.2, 1.5)) fail2("target must be 0.55-0.9 and scale 0.2-1.5");
        const knobs = input.knobs ?? [];
        if (!Array.isArray(knobs) || knobs.length > 8 || !knobs.length && !input.items) fail2("one to eight knobs required");
        const seen = /* @__PURE__ */ new Set([ITEM]);
        if (input.items != null) {
          const items = input.items;
          if (!items || typeof items !== "object" || Object.keys(items).some((key) => !["levels", "weight", "start"].includes(key))) fail2("invalid item levels");
          const levels = items.levels ?? [1, 2, 3], start2 = items.start ?? 0, weight = items.weight ?? 2;
          if (!Array.isArray(levels) || levels.length < 2 || levels.length > 6 || !levels.every((level, index) => Number.isInteger(level) && (index === 0 || level > levels[index - 1])) || !Number.isInteger(start2) || start2 < 0 || start2 >= levels.length || !within(weight, 0.25, 4)) fail2("invalid item levels");
          spec.items = { levels: [...levels], weight, start: start2 };
          spec.knobs.push({ id: ITEM, values: [...levels], start: start2, weight, kind: "content", follows: null, label: "item difficulty" });
        }
        for (const knob of knobs) {
          const keys = ["id", "values", "start", "weight", "kind", "follows", "label"];
          if (!knob || typeof knob !== "object" || Object.keys(knob).some((key) => !keys.includes(key))) fail2("invalid knob");
          const value = { id: knob.id, values: knob.values, start: knob.start ?? 0, weight: knob.weight ?? 1, kind: knob.kind ?? "content", follows: knob.follows ?? null, label: knob.label ?? knob.id };
          if (!id(value.id) || seen.has(value.id) || !Array.isArray(value.values) || value.values.length < 2 || value.values.length > 12 || !value.values.every(scalar) || !Number.isInteger(value.start) || value.start < 0 || value.start >= value.values.length || !within(value.weight, 0.25, 4) || !KINDS.includes(value.kind) || ![null, "declared"].includes(value.follows) || typeof value.label !== "string" || value.label.length > 60) fail2(`invalid knob ${knob && knob.id}`);
          seen.add(value.id);
          spec.knobs.push(value);
        }
        const result = Object.freeze(copy2(spec));
        defined.add(result);
        return result;
      }
      const challenge = (spec, indices, dimension = null) => spec.scale * spec.knobs.reduce((sum, knob) => sum + (dimension === null || dimensionOf(knob) === dimension ? knob.weight * indices[knob.id] : 0), 0);
      const defaults = (spec) => Object.fromEntries(spec.knobs.map((knob) => [knob.id, knob.start]));
      const has = (spec, dimension) => spec.knobs.some((knob) => dimensionOf(knob) === dimension && knob.follows !== "declared");
      function targets(spec, overall) {
        const timed = has(spec, "pace"), contented = has(spec, "content");
        if (!(timed && contented)) return { content: contented ? overall : PACE_TARGET, pace: timed ? overall : PACE_TARGET };
        const pace = clamp(PACE_TARGET * Math.sqrt(overall / spec.target), 0.75, 0.97);
        return { content: clamp(overall / pace, 0.55, 0.95), pace };
      }
      function validMemory(spec, memory) {
        const estimate = (value) => value && typeof value === "object" && within(value.theta, -20, 20) && within(value.n, 0, 1e6) && within(value.reversals, 0, 1e6);
        if (memory == null || typeof memory !== "object" || memory.v !== 2 || memory.content !== spec.id || memory.specVersion !== spec.version || !estimate(memory.estimates?.content) || !estimate(memory.estimates?.pace) || typeof memory.at !== "string" || !Number.isFinite(Date.parse(memory.at)) || !memory.indices || typeof memory.indices !== "object" || !Array.isArray(memory.latencies) || memory.latencies.length > LATENCIES || !memory.latencies.every((ms) => within(ms, 0, 6e5))) return null;
        const indices = {};
        for (const knob of spec.knobs) {
          const index = memory.indices[knob.id];
          indices[knob.id] = Number.isInteger(index) && index >= 0 && index < knob.values.length ? index : knob.start;
        }
        return { estimates: copy2(memory.estimates), at: memory.at, indices, latencies: [...memory.latencies] };
      }
      function priorFromSummary(input, summary, skillIds = []) {
        const spec = defineContent(input);
        if (!spec.items || !summary || !Array.isArray(summary.skills) || !Array.isArray(skillIds) || !skillIds.length) return null;
        const skills = skillIds.map((skill2) => summary.skills.find((s) => s.id === skill2));
        if (skills.some((skill2) => !skill2)) return null;
        let level = spec.items.start;
        for (let index = spec.items.start; index < spec.items.levels.length - 1; index += 1) {
          const authored = spec.items.levels[index];
          const steady = skills.every((skill2) => {
            const formats = skill2.levels?.[authored]?.formats;
            return !!formats && Object.values(formats).some((f) => f.status === "recent-independent");
          });
          if (!steady) break;
          level = index + 1;
        }
        if (level === spec.items.start) return null;
        const indices = { ...defaults(spec), [ITEM]: level };
        return { content: challenge(spec, indices, "content") + logit(targets(spec, spec.target).content), level: spec.items.levels[level], basis: "practice-summary" };
      }
      const PRESENTATION = Object.freeze({
        support: Object.freeze(["choose", "step", "independent"]),
        textSize: Object.freeze(["standard", "large"]),
        explanation: Object.freeze(["brief", "standard", "detailed"]),
        motion: Object.freeze(["full", "reduced"]),
        audio: Object.freeze(["off", "available"])
      });
      const FOLLOWED = ["textSize", "motion", "explanation"];
      function declaredFrom(input, presentation) {
        const spec = defineContent(input);
        if (!presentation || typeof presentation !== "object" || Array.isArray(presentation) || Object.keys(presentation).some((key) => !Object.hasOwn(PRESENTATION, key))) fail2(`presentation accepts only ${Object.keys(PRESENTATION).join(", ")}`);
        for (const [key, value] of Object.entries(presentation)) if (value != null && !PRESENTATION[key].includes(value)) fail2(`invalid presentation ${key}`);
        const support = presentation.support ?? "choose", knobs = {};
        for (const knob of spec.knobs) {
          if (knob.follows === "declared") {
            const index = FOLLOWED.includes(knob.id) && presentation[knob.id] != null ? knob.values.indexOf(presentation[knob.id]) : -1;
            if (index >= 0) knobs[knob.id] = index;
          } else if (knob.kind === "support" && support !== "choose") knobs[knob.id] = support === "step" ? 0 : knob.values.length - 1;
        }
        return { knobs };
      }
      const START = ["spec", "memory", "prior", "declared", "condition", "arm", "now"];
      function start(options = {}) {
        if (!options || typeof options !== "object" || Object.keys(options).some((key) => !START.includes(key))) fail2(`start accepts only ${START.join(", ")}`);
        const { spec: input, memory = null, prior = null, declared = {}, condition = null, arm = "adapted", now } = options;
        const spec = defineContent(input), guard = getGuard();
        if (!guard || typeof guard.check !== "function") throw new Error("Flow: Temper guard unavailable");
        if (!declared || typeof declared !== "object" || Array.isArray(declared) || Object.keys(declared).some((key) => !["mode", "knobs"].includes(key))) fail2("declared must be { mode, knobs }");
        const mode = declared.mode ?? "auto", locks = { ...declared.knobs ?? {} };
        if (!MODES.includes(mode)) fail2("invalid declared mode");
        for (const [knobId, index] of Object.entries(locks)) {
          const knob = spec.knobs.find((k) => k.id === knobId);
          if (!knob || !Number.isInteger(index) || index < 0 || index >= knob.values.length) fail2(`invalid declared knob ${knobId}`);
        }
        if (condition !== null && !CONDITIONS.includes(condition)) fail2("invalid condition");
        if (!["adapted", "baseline"].includes(arm)) fail2("invalid arm");
        if (prior !== null && (typeof prior !== "object" || !within(prior.content, -20, 20))) fail2("invalid prior");
        const startedAt = time2(now), remembered = validMemory(spec, memory);
        let overall = spec.target + (mode === "easier" ? 0.1 : mode === "harder" ? -0.1 : 0) + (condition === "tired" ? 0.08 : 0);
        overall = clamp(overall, 0.55, 0.92);
        const aim = targets(spec, overall);
        const base = defaults(spec);
        const fresh = (dimension) => ({ theta: challenge(spec, base, dimension) + logit(targets(spec, spec.target)[dimension]), n: 0, reversals: 0, streak: 0, sign: 0 });
        const estimates = { content: fresh("content"), pace: fresh("pace") };
        let basis = "default", indices = { ...base };
        if (remembered) {
          for (const dimension of DIMENSIONS) Object.assign(estimates[dimension], remembered.estimates[dimension], { streak: 0, sign: 0 });
          indices = { ...remembered.indices };
          basis = "memory";
        } else if (prior) {
          estimates.content.theta = prior.content;
          basis = "prior";
        }
        const returning = !!remembered && startedAt - time2(remembered.at) > RETURN_AFTER;
        if (returning) for (const dimension of DIMENSIONS) estimates[dimension].reversals = Math.min(estimates[dimension].reversals, 1);
        const adaptive = arm === "adapted" && mode !== "fixed";
        const calm = condition === "tired";
        const locked = (knob) => Object.hasOwn(locks, knob.id) || knob.follows === "declared";
        const reached = { ...indices };
        for (const knob of spec.knobs) {
          if (Object.hasOwn(locks, knob.id)) indices[knob.id] = locks[knob.id];
          else if (!adaptive || knob.follows === "declared") indices[knob.id] = knob.start;
        }
        const latencies = remembered ? remembered.latencies : [];
        const changes = [], trace = [];
        let step = 0, responses = 0, quiet = 0, steady = 0, last = null;
        const TODAY_ONLY = ["tired", "declared-easier", "declared-harder"];
        const todayOnly = {};
        const gap = (dimension) => (estimates[dimension].theta - logit(aim[dimension]) - challenge(spec, indices, dimension)) / spec.scale;
        const chance = (dimension, at = indices) => sigmoid(estimates[dimension].theta - challenge(spec, at, dimension));
        const expected = (at = indices) => (has(spec, "content") ? chance("content", at) : 1) * (has(spec, "pace") ? chance("pace", at) : 1);
        const span = (dimension) => {
          const knobs = spec.knobs.filter((knob) => dimensionOf(knob) === dimension);
          const fixed = (knob) => knob.follows === "declared" ? indices[knob.id] : null;
          const low = spec.scale * knobs.reduce((sum, k) => sum + k.weight * (fixed(k) ?? 0), 0);
          const high = spec.scale * knobs.reduce((sum, k) => sum + k.weight * (fixed(k) ?? k.values.length - 1), 0);
          return [low + logit(aim[dimension]) - 2 * spec.scale, high + logit(aim[dimension]) + 2 * spec.scale];
        };
        const bound = (dimension) => {
          const [low, high] = span(dimension);
          estimates[dimension].theta = clamp(estimates[dimension].theta, low, high);
        };
        function learn(dimension, y, weight, ceiling = Infinity) {
          const e = estimates[dimension], p = chance(dimension), sign = Math.sign(y - p);
          if (sign && e.sign && sign !== e.sign) {
            e.reversals += 1;
            e.streak = 0;
          } else if (sign) {
            e.streak += 1;
            if (e.streak >= RATE.recover) {
              e.reversals = Math.max(0, e.reversals - 1);
              e.streak = 0;
            }
          }
          if (sign) e.sign = sign;
          const rate = Math.max(RATE.min, RATE.max / (1 + e.reversals / RATE.half));
          e.theta = clamp(e.theta + Math.min(ceiling, rate * weight * (y - p)), -20, 20);
          e.n += weight;
          bound(dimension);
        }
        function because(direction, knob, observed) {
          if (direction > 0) return knob.kind === "pace" ? "comfortable-success" : "steady-success";
          if (observed?.assisted && observed.outcome === "success") return "help-needed";
          if (knob.kind === "pace") return observed?.outcome === "timeout" ? "time-ran-out" : "time-pressure";
          if (knob.kind === "support") return "more-help";
          return "content-miss";
        }
        function settle(dimension, direction, observed, reason, phase = "response") {
          const pool = spec.knobs.filter((knob) => dimensionOf(knob) === dimension && !locked(knob) && (direction < 0 || knob.kind !== "support"));
          const byWeight = (list) => [...list].sort((a, b) => direction > 0 ? a.weight - b.weight : b.weight - a.weight);
          const ordered = [...byWeight(pool.filter((k) => k.kind !== "support")), ...byWeight(pool.filter((k) => k.kind === "support"))];
          for (const knob of ordered) {
            const from = indices[knob.id], to = from + direction;
            if (to < 0 || to >= knob.values.length) continue;
            if (direction > 0 && phase === "response" && reason !== "quiet-streak" && gap(dimension) - knob.weight <= -DEADBAND) continue;
            if (!guard.check({ spec, knob: knob.id, from, to, step, phase, history: changes, frozen: !adaptive }).ok) continue;
            indices[knob.id] = to;
            const change = { step, phase, knob: knob.id, kind: knob.kind, dimension, from, to, direction, because: reason || because(direction, knob, observed), value: knob.values[to] };
            changes.push(change);
            return change;
          }
          return null;
        }
        for (const dimension of DIMENSIONS) bound(dimension);
        const opening = [];
        if (adaptive && returning) {
          for (const dimension of DIMENSIONS) {
            const change = settle(dimension, -1, null, "returning", "opening");
            if (change) {
              opening.push(change);
              break;
            }
          }
          for (const dimension of DIMENSIONS) estimates[dimension].theta = Math.min(estimates[dimension].theta, logit(aim[dimension]) + challenge(spec, indices, dimension));
        } else if (adaptive) {
          const limit = basis === "memory" ? 2 : 12, easeOnly = basis === "memory" || calm;
          for (let moves = 0; moves < limit; moves += 1) {
            const dimension = DIMENSIONS.filter((d) => Math.abs(gap(d)) >= DEADBAND && (!easeOnly || gap(d) < 0)).sort((a, b) => Math.abs(gap(b)) - Math.abs(gap(a)))[0];
            if (!dimension) break;
            const direction = Math.sign(gap(dimension));
            const reason = direction > 0 ? mode === "harder" ? "declared-harder" : "prior" : condition === "tired" ? "tired" : mode === "easier" ? "declared-easier" : "prior";
            const change = settle(dimension, direction, null, reason, "opening");
            if (!change) break;
            opening.push(change);
            if (TODAY_ONLY.includes(change.because)) todayOnly[change.knob] = (todayOnly[change.knob] || 0) + change.direction;
          }
        }
        const intro = !adaptive ? arm === "baseline" ? "baseline" : "fixed" : returning ? "returning" : condition === "tired" ? "tired" : basis;
        const settings = () => ({
          content: spec.id,
          policy: VERSION,
          arm,
          mode,
          adaptive,
          values: Object.fromEntries(spec.knobs.map((knob) => [knob.id, knob.values[indices[knob.id]]])),
          indices: { ...indices },
          expected: round(expected(), 2),
          level: spec.items ? spec.items.levels[indices[ITEM]] : null
        });
        return {
          spec,
          settings,
          intro: () => ({ code: `start.${intro}`, opening: copy2(opening) }),
          // The item level the content should draw next, or the nearest level it actually has.
          level(available) {
            if (!spec.items) return null;
            const wanted = spec.items.levels[indices[ITEM]];
            if (!Array.isArray(available) || !available.length) return wanted;
            return [...new Set(available)].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b)[0];
          },
          /* After each response. `pressure` is the share of the allowed time used (0-1) when the
           * content knows it; `assisted` means help was on screen before the answer; `repeat` means the
           * item was met before; `level` is the item level actually answered. A skipped or void
           * response (audio failed, app hidden, wrong control) is not evidence and moves nothing. */
          observe({ outcome, assisted = false, repeat = false, pressure = null, latencyMs = null, level = null } = {}) {
            if (!OUTCOMES.includes(outcome) || typeof assisted !== "boolean" || typeof repeat !== "boolean" || pressure !== null && !within(pressure, 0, 1.5) || latencyMs !== null && !within(latencyMs, 0, 6e5)) fail2("invalid observation");
            if (level !== null && (!spec.items || !spec.items.levels.includes(level))) fail2("invalid item level");
            const aboutContent = outcome === "success" || outcome === "fail" && !(pressure !== null && pressure >= 1);
            const aboutPace = has(spec, "pace") && ["success", "fail", "timeout"].includes(outcome);
            const evidence = aboutContent || aboutPace;
            responses += 1;
            if (evidence) step += 1;
            const shown = { ...indices };
            if (level !== null) shown[ITEM] = spec.items.levels.indexOf(level);
            const before = expected(shown), saved = { ...indices };
            indices = shown;
            if (aboutContent) {
              if (outcome === "success") learn("content", assisted ? 0.5 : 1, repeat && !assisted ? 0.5 : 1, assisted ? 0 : Infinity);
              else learn("content", 0, 1);
            }
            if (aboutPace) {
              if (outcome === "timeout") learn("pace", 0, 1);
              else if (pressure !== null) learn("pace", 1 - 0.5 * clamp((pressure - 0.5) / 0.5, 0, 1), 1);
              else learn("pace", 1, 0.5);
            }
            indices = saved;
            if (outcome === "success" && !assisted && !repeat) {
              quiet += 1;
              if (latencyMs !== null) latencies.push(Math.round(latencyMs));
            } else if (evidence) quiet = 0;
            if (outcome === "success") steady += 1;
            else if (outcome === "fail" || outcome === "timeout") steady = 0;
            while (latencies.length > LATENCIES) latencies.shift();
            last = { outcome, assisted, repeat, pressure };
            let change = null;
            if (adaptive && evidence) {
              const lower = DIMENSIONS.filter((d) => gap(d) <= -DEADBAND).sort((a, b) => gap(a) - gap(b));
              const raise = !calm && outcome === "success" && !assisted ? DIMENSIONS.filter((d) => gap(d) >= DEADBAND && !(d === "pace" && pressure !== null && pressure >= 0.85)).sort((a, b) => gap(b) - gap(a)) : [];
              for (const dimension of lower) {
                change = settle(dimension, -1, last);
                if (change) break;
              }
              if (!change && !lower.length) for (const dimension of raise) {
                change = settle(dimension, 1, last);
                if (change) break;
              }
              if (!change && !lower.length && quiet >= STREAK && !calm) {
                const ready = DIMENSIONS.filter((d) => gap(d) >= 0 && !(d === "pace" && pressure !== null && pressure > 0.5)).sort((a, b) => gap(b) - gap(a) || (a === "content" ? -1 : 1));
                for (const dimension of ready) {
                  change = settle(dimension, 1, last, "quiet-streak");
                  if (change && chance(dimension) < aim[dimension] - 0.15) {
                    indices[change.knob] = change.from;
                    changes.pop();
                    change = null;
                    continue;
                  }
                  if (change) {
                    estimates[dimension].theta = Math.max(estimates[dimension].theta, logit(aim[dimension]) + challenge(spec, indices, dimension) - spec.scale / 2);
                    quiet = 0;
                    break;
                  }
                }
              }
            }
            if (change && change.kind === "support") steady = 0;
            trace.push({
              response: responses,
              step,
              outcome,
              assisted,
              repeat,
              pressure,
              expected: round(before, 3),
              content: round(estimates.content.theta, 3),
              pace: round(estimates.pace.theta, 3),
              change: change && copy2(change)
            });
            return { change: change && copy2(change), settings: settings(), evidence };
          },
          /* The person accepted an offer of less help (vellum-flow.supportStep). One support knob
           * moves one step toward less help; nothing else changes. Not in the same response as
           * another change, nor right after a raise, nor on a tired day; the offer can come again later. */
          lessHelpAllowed() {
            const knob = spec.knobs.find((k) => k.kind === "support" && !locked(k) && indices[k.id] < k.values.length - 1);
            return !!knob && adaptive && !calm && guard.check({ spec, knob: knob.id, from: indices[knob.id], to: indices[knob.id] + 1, step, phase: "accepted", history: changes, frozen: false }).ok;
          },
          acceptLessHelp() {
            const knob = spec.knobs.find((k) => k.kind === "support" && !locked(k) && indices[k.id] < k.values.length - 1);
            if (!knob || !adaptive || calm) return null;
            const from = indices[knob.id], to = from + 1;
            if (!guard.check({ spec, knob: knob.id, from, to, step, phase: "accepted", history: changes, frozen: false }).ok) return null;
            indices[knob.id] = to;
            estimates.content.theta = Math.max(estimates.content.theta, logit(aim.content) + challenge(spec, indices, "content") - spec.scale / 2);
            const change = { step, phase: "accepted", knob: knob.id, kind: knob.kind, dimension: "content", from, to, direction: 1, because: "accepted-less-help", value: knob.values[to] };
            steady = 0;
            changes.push(change);
            return copy2(change);
          },
          quietStreak: () => quiet,
          steadyStreak: () => steady,
          // Dimensions whose adjustable knobs are all at their easiest. When the person still struggles
          // there, the content itself has no easier step left: suggest an easier content instead.
          floor: () => DIMENSIONS.filter((d) => {
            const knobs = spec.knobs.filter((k) => dimensionOf(k) === d && !locked(k));
            return knobs.length > 0 && knobs.every((k) => indices[k.id] === 0);
          }),
          latencies: () => [...latencies],
          trace: () => copy2(trace),
          changes: () => copy2(changes),
          last: () => last && { ...last },
          // What the host stores for next time: per content, no identity, no answers, no text.
          // The estimates learn in every round; the place kept is only where adapted play reached,
          // without the opening steps taken for today's choice alone.
          memory: (at) => ({
            v: 2,
            content: spec.id,
            specVersion: spec.version,
            policy: VERSION,
            at: new Date(time2(at)).toISOString(),
            estimates: Object.fromEntries(DIMENSIONS.map((d) => [d, { theta: round(estimates[d].theta, 4), n: round(estimates[d].n, 2), reversals: estimates[d].reversals }])),
            indices: Object.fromEntries(spec.knobs.map((k) => [k.id, adaptive && !locked(k) ? clamp(indices[k.id] - (todayOnly[k.id] || 0), 0, k.values.length - 1) : reached[k.id]])),
            latencies: [...latencies]
          })
        };
      }
      return Object.freeze({ VERSION, KINDS, OUTCOMES, MODES, CONDITIONS, DIMENSIONS, ITEM, PRESENTATION, defineContent, priorFromSummary, declaredFrom, start, challenge, sigmoid, logit });
    });
  }
});

// atlas/vellum-flow.js
var require_vellum_flow = __commonJS({
  "atlas/vellum-flow.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkVellumFlow = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const VERSION = "vellum-flow-1";
      const DAY = 864e5;
      const STUCK = Object.freeze({ afterMs: 4e4, misses: 2 });
      const within = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
      const time2 = (value) => {
        const n = Date.parse(value);
        if (typeof value !== "string" || !Number.isFinite(n)) throw new TypeError("Vellum: invalid time");
        return n;
      };
      function stuckFor({ latencies = [], base = STUCK, factor = 2.5, floorMs = 8e3, ceilMs = 9e4, minSamples = 5 } = {}) {
        if (!Array.isArray(latencies) || !latencies.every((ms) => within(ms, 0, 6e5)) || !base || !within(base.afterMs, 1e3, 6e5) || !Number.isInteger(base.misses) || base.misses < 1 || !within(factor, 1, 10) || !within(floorMs, 1e3, ceilMs) || !within(ceilMs, floorMs, 6e5)) {
          throw new TypeError("Vellum: invalid stuck input");
        }
        if (latencies.length < minSamples) return { afterMs: base.afterMs, misses: base.misses, basis: "default", n: latencies.length };
        const sorted = [...latencies].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
        return { afterMs: Math.round(Math.min(ceilMs, Math.max(floorMs, factor * median))), misses: base.misses, basis: "personal", n: latencies.length };
      }
      function supportStep({ at, last, streak, steady = 0, declared = false, declinedAt = null, now, need = 3, quietDays = 14 } = {}) {
        if (!Number.isInteger(at) || !Number.isInteger(last) || at < 0 || at > last || !Number.isInteger(streak) || streak < 0 || !Number.isInteger(steady) || steady < 0 || typeof declared !== "boolean" || !Number.isInteger(need) || need < 1 || !within(quietDays, 0, 365)) throw new TypeError("Vellum: invalid support step input");
        if (declared) return { offer: false, reason: "declared" };
        if (at >= last) return { offer: false, reason: "least-help" };
        if (streak < need && steady < need + 1) return { offer: false, reason: "not-yet" };
        if (declinedAt !== null && time2(now) - time2(declinedAt) < quietDays * DAY) return { offer: false, reason: "declined-recently" };
        return { offer: true, from: at, to: at + 1, reason: streak >= need ? "quiet-streak" : "steady-with-help" };
      }
      const WORDS = Object.freeze({
        easy: {
          "raise.pace": "\uC870\uAE08 \uBE68\uB77C\uC838\uC694.",
          "raise.content": "\uC870\uAE08 \uC5B4\uB824\uC6CC\uC838\uC694.",
          "ease.pace": "\uC2DC\uAC04\uC774 \uB354 \uC788\uC5B4\uC694.",
          "ease.content": "\uC870\uAE08 \uC26C\uC6CC\uC838\uC694.",
          "ease.support": "\uD78C\uD2B8\uAC00 \uBA3C\uC800 \uB098\uC640\uC694.",
          "accepted-less-help": "\uD78C\uD2B8\uAC00 \uC870\uAE08 \uB2A6\uAC8C \uB098\uC640\uC694.",
          "start.memory": "\uC9C0\uB09C\uBC88\uC5D0 \uC774\uC5B4\uC11C \uD574\uC694.",
          "start.prior": "\uC9C0\uB09C \uC5F0\uC2B5\uC5D0 \uB9DE\uCDB0 \uC2DC\uC791\uD574\uC694.",
          "start.returning": "\uAC00\uBCCD\uAC8C \uC2DC\uC791\uD574\uC694.",
          "start.tired": "\uC624\uB298\uC740 \uC548 \uC5B4\uB824\uC6CC\uC838\uC694.",
          "start.fixed": "\uC815\uD55C \uBC29\uC2DD \uADF8\uB300\uB85C \uD574\uC694.",
          "start.baseline": "\uC774\uBC88\uC5D0\uB294 \uAE30\uBCF8\uC73C\uB85C \uD574\uC694."
        },
        standard: {
          "raise.pace": "\uC870\uAE08 \uB354 \uBE60\uB974\uAC8C \uD574 \uBCFC\uAC8C\uC694.",
          "raise.content": "\uC870\uAE08 \uB354 \uC5B4\uB824\uC6B4 \uAC83\uB3C4 \uD574 \uBCFC\uAC8C\uC694.",
          "ease.pace": "\uC2DC\uAC04\uC744 \uC870\uAE08 \uB354 \uB109\uB109\uD558\uAC8C \uB4DC\uB9B4\uAC8C\uC694.",
          "ease.content": "\uC870\uAE08 \uB354 \uC26C\uC6B4 \uAC83\uBD80\uD130 \uB2E4\uC2DC \uD574\uC694.",
          "ease.support": "\uB3C4\uC6C0\uC744 \uC870\uAE08 \uB354 \uC77C\uCC0D \uBCF4\uC5EC \uB4DC\uB9B4\uAC8C\uC694.",
          "accepted-less-help": "\uB9D0\uC500\uD558\uC2E0 \uB300\uB85C \uB3C4\uC6C0\uC744 \uC870\uAE08 \uB2A6\uAC8C \uBCF4\uC5EC \uB4DC\uB9B4\uAC8C\uC694.",
          "start.memory": "\uC9C0\uB09C\uBC88\uC5D0 \uD558\uB358 \uB370\uC11C \uC774\uC5B4 \uAC08\uAC8C\uC694.",
          "start.prior": "\uB2E4\uB978 \uC5F0\uC2B5 \uAE30\uB85D\uC5D0 \uB9DE\uCDB0 \uC2DC\uC791\uD560\uAC8C\uC694.",
          "start.returning": "\uAC00\uBCCD\uAC8C \uB2E4\uC2DC \uC2DC\uC791\uD560\uAC8C\uC694.",
          "start.tired": "\uC624\uB298\uC740 \uB354 \uC5B4\uB835\uAC8C \uD558\uC9C0 \uC54A\uC744\uAC8C\uC694.",
          "start.fixed": "\uC815\uD574 \uB454 \uBC29\uC2DD \uADF8\uB300\uB85C \uC9C4\uD589\uD574\uC694.",
          "start.baseline": "\uC774\uBC88 \uD310\uC740 \uAE30\uBCF8 \uAD6C\uC131\uC73C\uB85C \uC9C4\uD589\uD574\uC694."
        }
      });
      function keyOf(event) {
        if (!event || typeof event !== "object") return null;
        if (typeof event.code === "string") return event.code === "start.default" ? null : event.code;
        if (event.because === "accepted-less-help") return "accepted-less-help";
        if (event.direction > 0) return event.kind === "pace" ? "raise.pace" : "raise.content";
        if (event.direction < 0) return event.kind === "pace" ? "ease.pace" : event.kind === "support" ? "ease.support" : "ease.content";
        return null;
      }
      function line(event, { level = "standard", words = {} } = {}) {
        if (!Object.hasOwn(WORDS, level) || !words || typeof words !== "object") throw new TypeError("Vellum: invalid line options");
        const key = keyOf(event);
        if (!key) return null;
        const text2 = Object.hasOwn(words, key) ? words[key] : WORDS[level][key];
        return typeof text2 === "string" && text2 ? { key, text: text2 } : null;
      }
      return Object.freeze({ VERSION, STUCK, WORDS, stuckFor, supportStep, line });
    });
  }
});

// atlas/game-flow.js
var require_game_flow = __commonJS({
  "atlas/game-flow.js"(exports, module) {
    "use strict";
    var Flow = require_flow();
    var VellumFlow = require_vellum_flow();
    var localDay = (iso2) => {
      const d = new Date(iso2);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    var SEEN = Object.freeze(["practice", "supported", "checking", "review"]);
    var object3 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
    var presentationOf = (value) => object3(value) && Object.keys(value).length > 0 && Object.entries(value).every(([key, choice]) => Object.hasOwn(Flow.PRESENTATION, key) && (choice === null || Flow.PRESENTATION[key].includes(choice)));
    function createFlowPort({ storage, key, clock: clock2, epoch = () => null }) {
      const FLOW = `${key}.flow`, TODAY = `${key}.today`, PRESENT = `${key}.presentation`;
      const listeners = /* @__PURE__ */ new Set();
      const notify = (change) => {
        for (const listener of listeners) {
          try {
            listener(change);
          } catch {
          }
        }
      };
      const read = (name) => {
        try {
          const raw = storage?.getItem(name);
          return raw == null || raw === "" ? null : JSON.parse(raw);
        } catch {
          return null;
        }
      };
      const write = (name, value) => {
        try {
          if (!storage) return false;
          if (value == null) {
            if (typeof storage.removeItem === "function") storage.removeItem(name);
            else storage.setItem(name, "");
          } else storage.setItem(name, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      };
      const memories = (current = epoch()) => {
        const value = read(FLOW);
        return value && value.v === 1 && (value.epoch ?? null) === current && object3(value.contents) && object3(value.declined) ? value : { v: 1, epoch: current, contents: {}, declined: {} };
      };
      const update = (since, change) => {
        const current = epoch();
        if (since !== void 0 && since !== current) return false;
        const all = memories(current);
        change(all);
        return write(FLOW, all);
      };
      const instant = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
      const later = (at, than) => !instant(than) || Date.parse(at) > Date.parse(than);
      const chosen = () => {
        const value = read(PRESENT);
        return value && value.v === 1 && instant(value.at) && (value.presentation === null || presentationOf(value.presentation)) ? value : null;
      };
      return Object.freeze({
        today() {
          const value = read(TODAY);
          return value && value.day === localDay(clock2()) && Flow.CONDITIONS.includes(value.condition) ? value.condition : null;
        },
        setToday(condition) {
          if (condition !== null && !Flow.CONDITIONS.includes(condition)) throw new TypeError("Atlas: invalid condition");
          return write(TODAY, condition === null ? null : { day: localDay(clock2()), condition });
        },
        // Set only by the person's own choice (a hub or settings screen); a value that is not in the
        // vocabulary is never read back. null forgets it, and the forgetting keeps its time so another
        // device's older choice does not come back.
        presentation() {
          const value = chosen();
          return value?.presentation ? { ...value.presentation } : null;
        },
        setPresentation(presentation) {
          if (presentation !== null && !presentationOf(presentation)) throw new TypeError(`Atlas: presentation accepts only ${Object.keys(Flow.PRESENTATION).join(", ")}`);
          const done = write(PRESENT, { v: 1, presentation: presentation === null ? null : { ...presentation }, at: clock2() });
          if (done) notify({ kind: "presentation", key: "chosen" });
          return done;
        },
        epoch,
        memories: () => memories(),
        save(contentId, memory, since) {
          const done = update(since, (all) => {
            all.contents[contentId] = memory;
          });
          if (done) notify({ kind: "flow", key: contentId });
          return done;
        },
        decline(contentId, at, since) {
          const done = update(since, (all) => {
            all.declined[contentId] = at;
          });
          if (done) notify({ kind: "declined", key: contentId });
          return done;
        },
        // Everything a synchroniser exchanges, each with its own time: the chosen presentation,
        // each content's memory (memory.at) and each declined offer.
        state() {
          const all = memories(), present = chosen();
          return {
            presentation: present ? { value: present.presentation && { ...present.presentation }, at: present.at } : null,
            flow: JSON.parse(JSON.stringify(all.contents)),
            declined: { ...all.declined }
          };
        },
        // Takes another device's values where they are newer than this device's, entry by entry.
        // Subscribers hear it as 'import', so a synchroniser does not send it back.
        merge(remote) {
          if (!object3(remote)) throw new TypeError("Atlas: invalid memory");
          let changed2 = false;
          const present = remote.presentation;
          if (object3(present) && instant(present.at) && (present.value === null || presentationOf(present.value)) && later(present.at, chosen()?.at) && write(PRESENT, { v: 1, presentation: present.value && { ...present.value }, at: present.at })) changed2 = true;
          const all = memories();
          let touched = false;
          for (const [id, memory] of Object.entries(object3(remote.flow) ? remote.flow : {})) {
            if (!object3(memory) || memory.content !== id || !instant(memory.at) || !later(memory.at, all.contents[id]?.at)) continue;
            all.contents[id] = JSON.parse(JSON.stringify(memory));
            touched = true;
          }
          for (const [id, at] of Object.entries(object3(remote.declined) ? remote.declined : {})) {
            if (!instant(at) || !later(at, all.declined[id])) continue;
            all.declined[id] = at;
            touched = true;
          }
          if (touched && write(FLOW, all)) changed2 = true;
          if (changed2) notify({ kind: "import" });
          return changed2;
        },
        subscribe(listener) {
          if (typeof listener !== "function") throw new TypeError("Atlas: listener required");
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        clear() {
          write(FLOW, null);
          write(TODAY, null);
          write(PRESENT, null);
        }
      });
    }
    function createLive({ coach, port, clock: clock2 }) {
      return function live(input, { declared = {}, presentation, skillIds = [], arm = "adapted", condition, level = "standard", words = {} } = {}) {
        const spec = Flow.defineContent(input);
        if (presentation === void 0) presentation = typeof port.presentation === "function" ? port.presentation() : null;
        if (presentation != null) {
          const knobs = { ...Flow.declaredFrom(spec, presentation).knobs, ...declared && declared.knobs };
          if (Object.keys(knobs).length) declared = { ...declared, knobs };
        }
        const since = port.epoch();
        const memory = port.memories().contents[spec.id] || null;
        let prior = null;
        if (!memory && skillIds.length) {
          try {
            prior = Flow.priorFromSummary(spec, coach.summary(), skillIds);
          } catch {
            prior = null;
          }
        }
        const run = Flow.start({ spec, memory, prior, declared, condition: condition === void 0 ? port.today() : condition, arm, now: clock2() });
        const say = (event) => VellumFlow.line(event, { level, words });
        const save = () => port.save(spec.id, run.memory(clock2()), since);
        const shown = /* @__PURE__ */ new Map();
        const snapshot = () => {
          const s = run.settings();
          return { content: s.content, policy: s.policy, arm: s.arm, mode: s.mode, values: s.values, level: s.level };
        };
        const result = (observed) => ({ ...observed, line: observed.change ? say(observed.change) : null });
        return Object.freeze({
          spec,
          settings: run.settings,
          intro() {
            const intro = run.intro();
            return { ...intro, line: say(intro) };
          },
          level: run.level,
          // Core's learning priority decides what to practise; the flow level decides how hard,
          // among the leading choices only. When Core's first choice rests on what it saw (a miss to
          // practise, help, a check or a review that is due), the choice stays with that ability, and
          // only its level follows the flow: in a content whose levels are different kinds of item,
          // an easier level must not quietly put off the practice Core asked for.
          pick(candidates, options = {}) {
            const { within = 5, ...rest } = options;
            const recommendation = coach.recommend(candidates, rest);
            if (recommendation.status !== "ready" || !spec.items) return recommendation;
            const ranked = [recommendation.selected, ...recommendation.alternatives].slice(0, within);
            const focus = SEEN.includes(recommendation.state) && recommendation.focusSkillId;
            const leading = focus ? ranked.filter((candidate) => candidate.skillIds?.includes(focus)) : ranked;
            const wanted = run.level(leading.map((candidate) => candidate.difficulty));
            const chosen = leading.find((candidate) => candidate.difficulty === wanted) || recommendation.selected;
            const own2 = chosen === recommendation.selected ? recommendation : coach.recommend([chosen], rest);
            return { ...own2, selected: chosen, alternatives: [recommendation.selected, ...recommendation.alternatives].filter((c) => c !== chosen), flowLevel: wanted };
          },
          // The settings in force are kept with the decision, so the choice can be reviewed later.
          present(item) {
            const pid = coach.present(item, { flow: snapshot() });
            shown.set(pid, item.difficulty);
            return pid;
          },
          /* Learning evidence to Trail first; then the same response moves the challenge. `flow` may
           * name the outcome for the challenge (a missed order is a 'timeout' there, yet not a language
           * error) and pass the share of time used as `pressure`. Trail decides assisted and repeat. */
          answer(pid, response, flow = {}) {
            const recorded = coach.answer(pid, response);
            const outcome = flow.outcome ?? (response.correct === true ? "success" : response.correct === false ? "fail" : "void");
            const level2 = spec.items && spec.items.levels.includes(shown.get(pid)) ? shown.get(pid) : null;
            const observed = run.observe({
              outcome,
              assisted: flow.assisted ?? recorded.assisted === true,
              repeat: flow.repeat ?? recorded.exposure === "repeat",
              pressure: flow.pressure ?? null,
              latencyMs: flow.latencyMs ?? null,
              level: level2
            });
            save();
            return { recorded, ...result(observed) };
          },
          // A response that is not a Strata item (a game action, a missed customer).
          observe(input2) {
            const observed = run.observe(input2);
            save();
            return result(observed);
          },
          stuck: (base) => VellumFlow.stuckFor({ latencies: run.latencies(), ...base ? { base } : {} }),
          offerLessHelp() {
            const support = spec.knobs.find((knob) => knob.kind === "support" && knob.follows !== "declared");
            if (!support || !run.settings().adaptive) return { offer: false, reason: "not-available" };
            const step = VellumFlow.supportStep({
              at: run.settings().indices[support.id],
              last: support.values.length - 1,
              streak: run.quietStreak(),
              steady: run.steadyStreak(),
              declared: Object.hasOwn(declared.knobs || {}, support.id),
              declinedAt: port.memories().declined[spec.id] ?? null,
              now: clock2()
            });
            return step.offer && !run.lessHelpAllowed() ? { offer: false, reason: "not-now" } : step;
          },
          acceptLessHelp() {
            const change = run.acceptLessHelp();
            save();
            return change && { ...change, line: say(change) };
          },
          declineLessHelp() {
            return port.decline(spec.id, clock2(), since);
          },
          floor: run.floor,
          end() {
            save();
            return { settings: run.settings(), changes: run.changes(), floor: run.floor() };
          },
          trace: run.trace
        });
      };
    }
    module.exports = { createFlowPort, createLive, localDay };
  }
});

// atlas/game-learning.js
var require_game_learning = __commonJS({
  "atlas/game-learning.js"(exports, module) {
    "use strict";
    var Atlas = require_engine();
    var Core = require_education();
    var Trail = require_trail();
    var Learning = require_learning();
    var Temper = require_temper();
    var { createLearningSync, sameEvent } = require_learning_sync();
    var { createMemorySync } = require_memory_sync();
    var Ledger = require_learning_ledger();
    var { createFlowPort, createLive } = require_game_flow();
    var KEY = "synk.atlas.learning.v1";
    var identifier = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
    var uid = () => `l${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    function createGame({
      gameId,
      map,
      storage = null,
      learnerKey = "device",
      clock: clock2 = () => (/* @__PURE__ */ new Date()).toISOString(),
      historyComplete = true,
      storageScope = "device",
      accountKey = null,
      fold = null,
      memoryOwner = null
    } = {}) {
      if (!identifier(gameId) || !identifier(learnerKey) || typeof map?.allNodes !== "function") throw new TypeError("Atlas: game, local scope and Strata map required");
      if (!["device", "account"].includes(storageScope) || storageScope === "account" && (!identifier(accountKey) || learnerKey !== "device")) throw new TypeError("Atlas: account identity and isolated host storage required");
      if (memoryOwner != null && (storageScope !== "account" || memoryOwner.scope !== "account" || !identifier(memoryOwner.accountKey) || !memoryOwner.flow || ["today", "setToday", "presentation", "setPresentation", "epoch", "memories", "save", "decline", "state", "merge", "subscribe"].some((name) => typeof memoryOwner.flow[name] !== "function"))) throw new TypeError("Atlas: a verified personal memory owner is required");
      const scope = { domain: "LAB", workspace: "learning", subject: learnerKey };
      const key = `${KEY}.${learnerKey}`;
      let flowPort = null;
      let epoch = null, session, readable = true, writable = !!storage, complete = historyComplete, warning = null, ledger = null;
      const folding = fold === false || fold == null && storageScope !== "device" ? null : { max: 600, keep: 400, ageMs: fold?.remote ? 864e5 : 6e5, remote: false, ...fold && typeof fold === "object" ? fold : {} };
      const settled = /* @__PURE__ */ new Set();
      let settledVersion = 0;
      const dropped = /* @__PURE__ */ new Set();
      let droppedVersion = 0;
      const UNCHANGED = /* @__PURE__ */ Symbol("unchanged-history");
      let lastStoredRaw = /* @__PURE__ */ Symbol("unread-history");
      let lastTime = 0;
      const active = /* @__PURE__ */ new Map();
      const listeners = /* @__PURE__ */ new Set();
      const notify = (kind, code) => {
        for (const listener of listeners) {
          try {
            listener({ kind, ...code ? { code } : {} });
          } catch {
          }
        }
      };
      const monotonicClock = () => {
        const value = Date.parse(clock2());
        if (!Number.isFinite(value)) throw new TypeError("Atlas: invalid clock");
        lastTime = Math.max(value, lastTime);
        return new Date(lastTime).toISOString();
      };
      const AHEAD_MS = 5 * 6e4;
      const newSession = (events) => {
        const own2 = Date.parse(clock2());
        for (const e of events) {
          const at = Date.parse(e.at);
          if (Number.isFinite(at) && (!Number.isFinite(own2) || at <= own2 + AHEAD_MS) && at > lastTime) lastTime = at;
        }
        return Atlas.createSession({ scope, events, clock: monotonicClock });
      };
      const log = () => session.snapshot ? session.snapshot() : session.events();
      const decode = (raw) => {
        if (raw == null) return null;
        const value = JSON.parse(raw);
        if (!value || value.version !== 1 || !identifier(value.epoch) || !Array.isArray(value.events) || value.events.length > 2e4 || Object.keys(value).some((k) => !["version", "epoch", "events", "owner", "ledger", "settled", "dropped"].includes(k))) throw new Error("Atlas: unreadable history");
        if (value.ledger != null) Ledger.validate(value.ledger);
        for (const ids of [value.settled, value.dropped]) if (ids != null && (!Array.isArray(ids) || ids.length > 2e4 || !ids.every(identifier))) throw new Error("Atlas: unreadable history");
        if (storageScope === "account" ? value.owner !== accountKey : value.owner != null) throw new Error("Atlas: local history belongs to a different storage scope");
        newSession(value.events);
        return value;
      };
      function readStored() {
        if (!storage) return null;
        try {
          const raw = storage.getItem(key);
          if (raw === lastStoredRaw) return UNCHANGED;
          const stored = decode(raw);
          lastStoredRaw = raw;
          return stored;
        } catch {
          readable = false;
          complete = false;
          warning = "\uAE30\uB85D\uC744 \uC77D\uC9C0 \uBABB\uD574 \uAE30\uBCF8 \uC5F0\uC2B5\uC73C\uB85C \uC9C4\uD589\uD574\uC694.";
          notify("storage-error", "STORAGE_ERROR");
          return null;
        }
      }
      const initial = readStored();
      epoch = initial?.epoch || uid();
      ledger = initial?.ledger || null;
      session = newSession(initial?.events || []);
      const settle = (ids, known) => {
        const before = settled.size;
        for (const id of ids) if (known.has(id)) settled.add(id);
        for (const id of settled) if (!known.has(id)) settled.delete(id);
        if (settled.size !== before) settledVersion += 1;
      };
      if (initial?.settled) settle(initial.settled, new Set(initial.events.map((e) => e.id)));
      for (const id of initial?.dropped || []) dropped.add(id);
      const takeDropped = (ids, keepMine) => {
        const next = new Set(keepMine ? [...dropped, ...ids] : ids);
        if (next.size !== dropped.size || [...next].some((id) => !dropped.has(id))) {
          dropped.clear();
          for (const id of next) dropped.add(id);
          droppedVersion += 1;
        }
      };
      function refresh() {
        if (!readable || !storage) return;
        const stored = readStored();
        if (!stored || stored === UNCHANGED) return;
        if (stored.epoch !== epoch) {
          epoch = stored.epoch;
          ledger = stored.ledger || null;
          session = newSession(stored.events);
          active.clear();
          settled.clear();
          settledVersion += 1;
          settle(stored.settled || [], new Set(stored.events.map((e) => e.id)));
          takeDropped(stored.dropped || [], false);
          return;
        }
        const theirs = stored.ledger || null, order = Ledger.compare(ledger, theirs), mine = log();
        const storedIds = new Set(stored.events.map((e) => e.id)), mineIds = new Set(mine.map((e) => e.id));
        const combined = mine.filter((e) => order >= 0 || storedIds.has(e.id) || !Ledger.folded(theirs, e)), known = new Map(combined.map((e) => [e.id, e]));
        for (const e of stored.events) {
          if (order > 0 && !mineIds.has(e.id) && Ledger.folded(ledger, e)) continue;
          if (known.has(e.id)) {
            if (!sameEvent(known.get(e.id), e)) {
              readable = false;
              complete = false;
              warning = "\uAE30\uB85D \uB0B4\uC6A9\uC774 \uC11C\uB85C \uB2EC\uB77C \uC5F0\uACB0\uC744 \uC911\uB2E8\uD588\uC5B4\uC694. \uAE30\uC874 \uAE30\uB85D\uC740 \uBCF4\uC874\uD574\uC694.";
              notify("storage-error", "STORAGE_ERROR");
              throw Object.assign(new Error("Atlas: conflicting stored event"), { code: "STORAGE_ERROR" });
            }
          } else {
            known.set(e.id, e);
            combined.push(e);
          }
        }
        if (order < 0) ledger = theirs;
        settle([...settled, ...stored.settled || []], known);
        takeDropped(stored.dropped || [], order > 0);
        session = newSession(combined);
        for (const pid of active.keys()) if (!known.has(pid)) active.delete(pid);
      }
      const serialised = /* @__PURE__ */ new WeakMap();
      const entryJson = (e) => {
        let json = serialised.get(e);
        if (json === void 0) {
          json = JSON.stringify(e);
          if (Object.isFrozen(e)) serialised.set(e, json);
        }
        return json;
      };
      let body = null;
      const snapshot = (events) => {
        if (!(body && body.session === session && body.count <= events.length && (body.count === 0 || events[body.count - 1] === body.last))) body = { session, count: 0, last: null, text: "" };
        for (; body.count < events.length; body.count += 1) body.text += (body.count ? "," : "") + entryJson(events[body.count]);
        body.last = body.count ? events[body.count - 1] : null;
        if (ledgerJson?.ledger !== ledger) ledgerJson = { ledger, text: ledger ? `,"ledger":${JSON.stringify(ledger)}` : "" };
        if (settledJson?.version !== settledVersion) settledJson = { version: settledVersion, text: settled.size ? `,"settled":${JSON.stringify([...settled])}` : "" };
        if (droppedJson?.version !== droppedVersion) droppedJson = { version: droppedVersion, text: dropped.size ? `,"dropped":${JSON.stringify([...dropped])}` : "" };
        return `{"version":1,"epoch":${JSON.stringify(epoch)},"events":[${body.text}]${ledgerJson.text}${settledJson.text}${droppedJson.text}${storageScope === "account" ? `,"owner":${JSON.stringify(accountKey)}` : ""}}`;
      };
      let ledgerJson = null, settledJson = null, droppedJson = null, retryFold = null;
      function compact() {
        if (!folding) return;
        const events = log(), now = Date.parse(monotonicClock());
        if (events.length <= folding.max) return;
        if (retryFold && retryFold.settled === settledVersion && now < retryFold.at) return;
        const open = [...active].filter(([, item]) => !item.results.length).map(([pid]) => pid);
        if (folding.remote) {
          for (const e of events) if (!settled.has(e.id)) open.push(e.id);
        }
        const planned = Ledger.plan(events, {
          keep: folding.keep,
          olderThan: now - folding.ageMs,
          open,
          unfinishedBefore: folding.remote ? now - 30 * 864e5 : now - folding.ageMs
        });
        const batch = Math.max(1, Math.floor((folding.max - folding.keep) / 2));
        if (!planned || planned.folded.length < batch && events.length < 2 * folding.max) {
          retryFold = { settled: settledVersion, at: now + 6e4 };
          return;
        }
        retryFold = null;
        ledger = Ledger.fold(ledger, planned.folded, { scope, log: events, local: !folding.remote });
        session = newSession(planned.kept);
        for (const e of planned.folded) {
          if (e.type === "practice.presented") active.delete(e.id);
          settled.delete(e.id);
        }
        settledVersion += 1;
        if (folding.remote) {
          for (const e of planned.folded) dropped.add(e.id);
          droppedVersion += 1;
        }
      }
      function persist(kind = "append", { quiet = false } = {}) {
        if (!storage || !readable) {
          complete = false;
          notify("storage-error", "STORAGE_ERROR");
          return false;
        }
        try {
          compact();
          const events = log();
          if (events.length > 2e4) throw Object.assign(new Error("Atlas: local history limit"), { code: "HISTORY_CAPACITY" });
          const raw = snapshot(events);
          storage.setItem(key, raw);
          lastStoredRaw = raw;
          writable = true;
          if (!quiet) notify(kind);
          return true;
        } catch (error2) {
          writable = false;
          complete = false;
          warning = "\uAE30\uB85D\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC774\uBC88 \uC5F0\uC2B5\uC740 \uB2E4\uC74C \uC811\uC18D\uC5D0 \uC774\uC5B4\uC9C0\uC9C0 \uC54A\uC744 \uC218 \uC788\uC5B4\uC694.";
          notify("storage-error", error2.code === "HISTORY_CAPACITY" ? "HISTORY_CAPACITY" : "STORAGE_ERROR");
          return false;
        }
      }
      if (!initial && readable && storage) persist();
      const practiceSession = { practice: (...args) => session.practice(...args) };
      const VIEW_MS = 6e4;
      let cached = null, met = null;
      function view() {
        const events = log(), asOf = monotonicClock(), now = Date.parse(asOf);
        if (cached?.events === events && now - cached.now < VIEW_MS) return cached.summary;
        cached = { events, now, summary: Trail.summarize(events, { scope, asOf, prior: ledger }), profiles: /* @__PURE__ */ new Map(), counts: null };
        return cached.summary;
      }
      function profileOf(observed) {
        const ok = complete && readable && writable, flag = String(ok);
        if (cached?.summary === observed && cached.profiles.has(flag)) return cached.profiles.get(flag);
        const profile = {
          ...Learning.summarizeLearning({ summary: observed, map, complete: ok, prior: ledger }),
          concepts: Learning.summarizeConcepts({ summary: observed, map, complete: ok, prior: ledger })
        };
        if (cached?.summary === observed) cached.profiles.set(flag, profile);
        return profile;
      }
      function provenance() {
        const events = log();
        if (!met || met.session !== session) met = { session, done: 0, index: Trail.createIndex({ scope, prior: ledger }), buckets: /* @__PURE__ */ new Map() };
        for (; met.done < events.length; met.done += 1) {
          const row = met.index.add(events[met.done]);
          if (!row?.measure) continue;
          const bucket = `${row.measure.skillId}|${row.measure.difficulty}|${row.measure.responseFormat}`;
          if (!met.buckets.has(bucket)) met.buckets.set(bucket, []);
          met.buckets.get(bucket).push(row);
        }
        return met;
      }
      function basisOf(measure) {
        const known = provenance();
        if (!known.index.exact) return profileOf(view()).skills.find((s) => s.id === measure.skillId).levels[measure.difficulty].formats[measure.responseFormat];
        const key2 = `${measure.skillId}|${measure.difficulty}|${measure.responseFormat}`, cell = Ledger.cellOf(ledger, key2);
        const rows2 = (known.buckets.get(key2) || []).filter((row) => !row.omitted);
        return Learning.formatEvidence(rows2, {
          now: Date.parse(monotonicClock()),
          complete: complete && readable && writable,
          difficulty: measure.difficulty,
          responseFormat: measure.responseFormat,
          base: cell ? Ledger.rows(cell) : null
        });
      }
      function summary() {
        refresh();
        const observed = view();
        const measured = () => Temper.combine(ledger?.counts || null, Temper.measure(observed));
        if (cached?.summary === observed && !cached.counts) cached.counts = measured();
        return {
          ...profileOf(observed),
          storage: {
            available: readable && writable,
            scope: storageScope,
            warning,
            ...ledger ? { folded: ledger.folded, adjusted: ledger.adjusted || 0 } : {}
          },
          counts: cached?.summary === observed ? cached.counts : measured()
        };
      }
      function requireActive(pid) {
        refresh();
        const item = active.get(pid);
        if (!item) throw new Error("Atlas: presentation ended or local record reset");
        return item;
      }
      const api = {
        syncPort: Object.freeze({
          scope: storageScope,
          accountKey,
          // The kept entries. A synchronised store's folded entries are on the server; whether this
          // history can be sent at all is partial().
          events() {
            refresh();
            if (!readable || !writable) throw Object.assign(new Error("Atlas: local history is not durable"), { code: "STORAGE_ERROR" });
            return session.events();
          },
          // The kept entries' ids, without copying the entries: a WORLD host compares them around a
          // game call to find what the call added (account/world-learning-host.js).
          ids() {
            refresh();
            if (!readable || !writable) throw Object.assign(new Error("Atlas: local history is not durable"), { code: "STORAGE_ERROR" });
            return log().map((e) => e.id);
          },
          // True when this store folded entries no server has received (it was not synchronised then):
          // its history can never be sent whole, so a synchroniser must not send it.
          partial() {
            refresh();
            return !!ledger?.local;
          },
          // The sync calls this after a complete pull with every entry id the server has sent:
          // those entries may fold here. Saved quietly (it is not a new learning entry).
          settle(ids) {
            if (!folding?.remote || !Array.isArray(ids)) return false;
            refresh();
            if (!readable) return false;
            const version = settledVersion;
            settle([...settled, ...ids], new Set(log().map((e) => e.id)));
            return settledVersion === version || persist("settle", { quiet: true });
          },
          // Ids this store folded away since the synchroniser last took them (always on the server).
          dropped() {
            refresh();
            return [...dropped];
          },
          // The synchroniser has taken these (saved in its own outbox first).
          forget(ids) {
            refresh();
            if (!readable || !Array.isArray(ids)) return false;
            const version = droppedVersion;
            for (const id of ids) if (dropped.delete(id)) droppedVersion = version + 1;
            return droppedVersion === version || persist("forget", { quiet: true });
          },
          subscribe(listener) {
            if (typeof listener !== "function") throw new TypeError("Atlas: listener required");
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          markComplete(value) {
            complete = value === true;
          },
          importEvents(incoming) {
            refresh();
            if (!readable) throw Object.assign(new Error("Atlas: local history is unreadable"), { code: "STORAGE_ERROR" });
            if (ledger?.local) throw Object.assign(new Error("Atlas: a folded history is kept on this device only"), { code: "HISTORY_FOLDED" });
            if (!Array.isArray(incoming)) throw new TypeError("Atlas: imported events must be an array");
            const combined = log().slice(), previousLength = combined.length, known = new Map(combined.map((event) => [event.id, event])), late = [], gone = [], skipped = [];
            for (const event of incoming) {
              if (known.has(event?.id)) {
                if (!sameEvent(known.get(event.id), event)) throw Object.assign(new Error("Atlas: conflicting imported event"), { code: "EVENT_CONFLICT" });
              } else if (ledger && Ledger.stray(event, known)) {
                skipped.push(event.id);
                if (event.type === "record.excluded") gone.push(event.targetId);
                continue;
              } else {
                known.set(event?.id, event);
                combined.push(event);
                if (Ledger.folded(ledger, event)) late.push(event);
              }
            }
            if (combined.length === previousLength && !skipped.length && writable && snapshot(combined) === lastStoredRaw) return { added: 0, skipped };
            const imported = newSession(combined);
            session = imported;
            if (late.length || skipped.length) ledger = Ledger.demote(ledger, { late, excluded: gone, strays: skipped.length }, (id) => known.get(id));
            if (!persist("import")) throw Object.assign(new Error("Atlas: imported history could not be saved"), { code: "STORAGE_ERROR" });
            return { added: combined.length - previousLength, skipped };
          }
        }),
        summary,
        recommend(candidates, options = {}) {
          const profile = summary();
          return { ...Learning.recommend({ profile, candidates, presentations: view().presentations, prior: ledger, ...options }), storage: profile.storage };
        },
        recommendActivities(candidates, options = {}) {
          const profile = summary();
          return { ...Learning.recommendActivities({ ...options, profile, candidates, presentations: view().presentations, prior: ledger }), storage: profile.storage };
        },
        // Display exposure is stricter than independent-attempt qualification: an item
        // shown without an answer is still not a never-shown item. Both include folded history.
        exposure(item) {
          if (!identifier(item?.itemKey) || !identifier(item.familyKey || item.itemKey)) throw new TypeError("Atlas: invalid exposure item");
          refresh();
          const family = item.familyKey || item.itemKey;
          const shown = log().some((e) => e.type === "practice.presented" && (e.itemKey === item.itemKey || (e.measure?.familyKey || e.itemKey) === family)) || (ledger?.presented || []).some(([_task, priorItem, priorFamily]) => priorItem === item.itemKey || priorFamily === family);
          return { seen: shown || provenance().index.met(item.itemKey, family) ? true : complete && readable && writable ? false : null };
        },
        // A consumer supplies the two attempts it deliberately joined in this round.
        // This reads recent full events only: no durable lineage, profile update or causal claim.
        recheck(sourceAttemptId, targetAttemptId) {
          if (![sourceAttemptId, targetAttemptId].every(identifier)) throw new TypeError("Atlas: invalid recheck attempt IDs");
          const result = { sourceAttemptId, targetAttemptId, correctionObserved: false, correctionEventIds: [], learningEffectClaim: false };
          const unavailable = (reason) => ({ ...result, status: "unavailable", line: "\uC0C8 \uBB38\uD56D \uD655\uC778 \uACB0\uACFC\uB97C \uD310\uB2E8\uD560 \uAE30\uB85D\uC774 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC544\uC694.", reason });
          try {
            refresh();
          } catch {
            return unavailable("incomplete-history");
          }
          if (!complete || !readable || !writable || ledger?.adjusted) return unavailable("incomplete-history");
          const events = log(), positions = new Map(events.map((event, index) => [event.id, index]));
          const byId = new Map(events.map((event) => [event.id, event]));
          const sourceEvent = byId.get(sourceAttemptId), targetEvent = byId.get(targetAttemptId);
          if (sourceEvent?.type !== "practice.attempted" || targetEvent?.type !== "practice.attempted") return unavailable("missing-attempt");
          if (sourceEvent.attemptNo !== 1 || targetEvent.attemptNo !== 1) return unavailable("not-first-attempt");
          const sourcePresentation = byId.get(sourceEvent.presentationId), targetPresentation = byId.get(targetEvent.presentationId);
          const sourceDecision = byId.get(sourcePresentation?.decisionId), targetDecision = byId.get(targetPresentation?.decisionId);
          if (sourcePresentation?.type !== "practice.presented" || targetPresentation?.type !== "practice.presented" || sourceDecision?.type !== "decision.made" || targetDecision?.type !== "decision.made") return unavailable("missing-parent");
          const sourceCompletion = events.find((event) => event.type === "experience.completed" && event.decisionId === sourceDecision.id);
          const targetCompletion = events.find((event) => event.type === "experience.completed" && event.decisionId === targetDecision.id);
          if (!sourceCompletion || !targetCompletion) return unavailable("missing-completion");
          const now = Date.parse(monotonicClock());
          const visible = (event) => Date.parse(event.at) <= now && Date.parse(event.recordedAt) <= now;
          const before = (a2, b2) => positions.get(a2.id) < positions.get(b2.id) && Date.parse(a2.at) <= Date.parse(b2.at) && Date.parse(a2.recordedAt) <= Date.parse(b2.recordedAt);
          const required = [sourceDecision, sourcePresentation, sourceEvent, sourceCompletion, targetDecision, targetPresentation, targetEvent, targetCompletion];
          if (!required.every(visible) || !before(sourcePresentation, sourceEvent) || !before(sourceEvent, targetPresentation) || !before(targetPresentation, targetEvent) || !before(sourceEvent, sourceCompletion) || !before(targetEvent, targetCompletion)) return unavailable("invalid-order");
          const relevant = new Set(required.map((event) => event.id));
          for (const event of events) if (["practice.helped", "practice.delivery"].includes(event.type) && (event.presentationId === sourcePresentation.id && before(event, sourceEvent) || event.presentationId === targetPresentation.id && before(event, targetEvent))) relevant.add(event.id);
          if (events.some((event) => event.type === "record.excluded" && relevant.has(event.targetId))) return unavailable("excluded-evidence");
          if (sourceDecision.experienceId !== targetDecision.experienceId) return unavailable("different-game");
          const a = sourcePresentation.measure, b = targetPresentation.measure;
          if (!a || !b || !Learning.RESPONSE_FORMATS.includes(a.responseFormat) || a.responseFormat === "unknown" || ["skillId", "difficulty", "responseFormat", "modality", "audioRequired"].some((key2) => a[key2] !== b[key2]) || sourcePresentation.taskVersion !== targetPresentation.taskVersion) return unavailable("different-measurement");
          if (sourcePresentation.itemKey === targetPresentation.itemKey || a.familyKey === b.familyKey) return unavailable("same-family");
          const priorPresentation = events.some((event) => event.type === "practice.presented" && event.id !== targetPresentation.id && (positions.get(event.id) < positions.get(targetPresentation.id) || Date.parse(event.at) < Date.parse(targetPresentation.at)) && (event.itemKey === targetPresentation.itemKey || (event.measure?.familyKey || event.itemKey) === b.familyKey));
          if (priorPresentation || (ledger?.presented || []).some(([_task, item, family]) => item === targetPresentation.itemKey || family === b.familyKey)) return unavailable("previously-presented");
          const observed = view(), source = observed.attempts.find((row) => row.eventId === sourceAttemptId), target = observed.attempts.find((row) => row.eventId === targetAttemptId);
          if (!source || !target || source.exclusionReason || target.exclusionReason || !["correct", "incorrect"].includes(source.verdict) || !["correct", "incorrect"].includes(target.verdict)) return unavailable("unassessable");
          if (source.verdict === "correct" && source.assisted !== true) return unavailable("source-not-recheck");
          if (targetPresentation.firstExposure !== true || target.exposure !== "new" || ![true, false].includes(target.assisted) || target.assisted === false && !target.independent) return unavailable("unknown-provenance");
          const corrections = observed.help.filter((help) => help.presentationId === sourcePresentation.id && help.level === "answer" && before(sourceEvent, byId.get(help.eventId)) && before(byId.get(help.eventId), targetPresentation));
          const status = `${target.assisted ? "assisted" : "independent"}-${target.verdict}`;
          const lines = {
            "independent-correct": "\uB2E4\uB978 \uC0C8 \uBB38\uD56D\uC740 \uB3C4\uC6C0 \uC5C6\uC774 \uB9DE\uD614\uC5B4\uC694.",
            "independent-incorrect": "\uB2E4\uB978 \uC0C8 \uBB38\uD56D\uC740 \uB3C4\uC6C0 \uC5C6\uC774 \uD480\uC5C8\uC9C0\uB9CC \uD2C0\uB838\uC5B4\uC694.",
            "assisted-correct": "\uB2E4\uB978 \uC0C8 \uBB38\uD56D\uC740 \uB3C4\uC6C0\uC744 \uBCF4\uACE0 \uB9DE\uD614\uC5B4\uC694.",
            "assisted-incorrect": "\uB2E4\uB978 \uC0C8 \uBB38\uD56D\uC740 \uB3C4\uC6C0\uC744 \uBCF4\uACE0 \uD480\uC5C8\uC9C0\uB9CC \uD2C0\uB838\uC5B4\uC694."
          };
          return {
            ...result,
            status,
            line: lines[status],
            correctionObserved: corrections.length > 0,
            correctionEventIds: corrections.map((help) => help.eventId),
            source: { verdict: source.verdict, assisted: source.assisted, independent: source.independent },
            target: { verdict: target.verdict, assisted: target.assisted, independent: target.independent }
          };
        },
        present(item, context = {}) {
          refresh();
          if (!context || typeof context !== "object" || Object.keys(context).some((k) => k !== "flow") || context.flow != null && (typeof context.flow !== "object" || Array.isArray(context.flow))) throw new TypeError("Atlas: invalid presentation context");
          const node = map.getNode(item?.skillId);
          if (!node || node.domain !== item.modality || !identifier(item.id) || !identifier(item.itemKey) || !identifier(item.familyKey || item.itemKey) || ![1, 2, 3].includes(item.difficulty) || !Learning.RESPONSE_FORMATS.includes(item.responseFormat ?? "unknown")) throw new TypeError("Atlas: invalid measured item");
          const measure = {
            skillId: item.skillId,
            modality: item.modality,
            difficulty: item.difficulty,
            responseFormat: item.responseFormat ?? "unknown",
            familyKey: item.familyKey || item.itemKey,
            audioRequired: item.audioRequired ?? item.modality === "listening",
            confounded: !!item.confounded
          };
          const seen = provenance().index.met(item.itemKey, measure.familyKey);
          const basis = basisOf(measure);
          const decision = session.plan(gameId, [{
            id: item.id,
            minutes: 3,
            pace: "standard",
            learning: {
              policy: Learning.POLICY.version,
              skillId: item.skillId,
              difficulty: item.difficulty,
              responseFormat: measure.responseFormat,
              state: basis.status,
              evidence: basis.evidence
            },
            ...context.flow ? { flow: JSON.parse(JSON.stringify(context.flow)) } : {}
          }]);
          const content = item.conceptIds ?? [];
          if (!Array.isArray(content) || content.length > 31 || new Set(content).size !== content.length || content.some((id) => !identifier(id) || !Learning.CONTENT.includes(map.getNode(id)?.kind))) throw new TypeError("Atlas: invalid measured item");
          const task = { id: item.id, version: map.map_ver, itemKey: item.itemKey, concepts: [item.skillId, ...content], tags: [], measure };
          const practice = Core.createPractice({
            session: practiceSession,
            decision,
            map,
            task,
            assess: (result) => ({ verdict: result.assessable === false ? "unassessed" : result.correct == null ? "skipped" : result.correct ? "correct" : "incorrect", errorTags: [] }),
            firstExposure: seen ? false : complete && readable && writable ? true : null
          });
          active.set(practice.presentation.id, { practice, measure, decision, audio: "pending", results: [] });
          persist();
          return practice.presentation.id;
        },
        help(pid, kind) {
          const p = requireActive(pid);
          if (!["text", "hint", "answer", "replay"].includes(kind)) throw new TypeError("Atlas: invalid help kind");
          const result = p.practice.delivered({ id: kind, level: kind === "answer" ? "answer" : "cue", contentRef: `${gameId}.${kind}` });
          persist();
          return result;
        },
        delivery(pid, { audio }) {
          const p = requireActive(pid);
          p.audio = audio;
          const result = session.practice("delivery", { presentationId: pid, audio });
          persist();
          return result;
        },
        answer(pid, result) {
          const p = requireActive(pid);
          if (!result || ![true, false, null].includes(result.correct) || typeof result.assessable !== "boolean") throw new TypeError("Atlas: answer must identify assessability");
          const choice = Object.hasOwn(result, "choice") ? Trail.choiceRecord(result.choice) : null;
          const attemptNo = result.attemptNo ?? 1;
          if (!Number.isInteger(attemptNo) || attemptNo < 1 || attemptNo > p.results.length + 1) throw new TypeError("Atlas: attempts must be consecutive");
          if (p.results[attemptNo - 1]) {
            const saved = p.results[attemptNo - 1];
            return { ...saved, ...saved.choice ? { choice: { ...saved.choice } } : {} };
          }
          const reason = p.measure.confounded ? result.reason || "visual" : p.measure.audioRequired && p.audio !== "completed" ? "audio" : !readable || !writable ? "storage" : result.reason;
          const assessable = result.assessable && !p.measure.confounded && (!p.measure.audioRequired || p.audio === "completed") && readable && writable;
          const attempt = p.practice.submit({ ...result, assessable }, { reason: reason || null, ...choice ? { choice } : {} });
          session.complete(p.decision);
          persist();
          const known = provenance(), row = known.index.attempt(attempt.eventId);
          const actual = known.index.exact ? row && !row.omitted ? row : void 0 : view().attempts.find((a) => a.eventId === attempt.eventId);
          const recorded = {
            ...attempt,
            independent: !!actual?.independent && complete && writable,
            reason: reason || null,
            assisted: actual?.assisted ?? null,
            exposure: actual?.exposure ?? null
          };
          p.results.push(recorded);
          return { ...recorded, ...recorded.choice ? { choice: { ...recorded.choice } } : {} };
        },
        exclude(eventId) {
          refresh();
          const event = session.exclude(eventId);
          persist();
          return event;
        },
        events() {
          refresh();
          return session.events();
        },
        // Before a tab closes or hides: another tab may have written an older history over this
        // one's entries in the meantime (tabs see each other's writes late), so join and write again.
        flush() {
          refresh();
          if (!storage || !readable || !writable) return false;
          return snapshot(log()) === lastStoredRaw || persist("flush", { quiet: true });
        },
        reset() {
          if (storageScope === "account") throw Object.assign(new Error("Atlas: account deletion requires the host consent/reset API; local reset cannot delete server records"), { code: "ACCOUNT_RESET_REQUIRED" });
          epoch = uid();
          ledger = null;
          settled.clear();
          settledVersion += 1;
          takeDropped([], false);
          session = newSession([]);
          active.clear();
          readable = true;
          writable = !!storage;
          complete = historyComplete;
          warning = null;
          persist();
          flowPort.clear();
          return summary();
        }
      };
      flowPort = memoryOwner?.flow || createFlowPort({ storage, key, clock: monotonicClock, epoch: () => {
        try {
          refresh();
        } catch {
        }
        return epoch;
      } });
      api.today = flowPort.today;
      api.setToday = flowPort.setToday;
      api.presentation = flowPort.presentation;
      api.setPresentation = flowPort.setPresentation;
      api.memoryPort = Object.freeze({
        scope: memoryOwner?.scope || storageScope,
        accountKey: memoryOwner?.accountKey || accountKey,
        state: flowPort.state,
        merge: flowPort.merge,
        subscribe: flowPort.subscribe,
        flow: flowPort
      });
      api.live = createLive({ coach: api, port: flowPort, clock: monotonicClock });
      return api;
    }
    module.exports = {
      createGame,
      createLearningSync,
      createMemorySync,
      summarizeLearning: Learning.summarizeLearning,
      recommend: Learning.recommend,
      recommendActivities: Learning.recommendActivities,
      POLICY: Learning.POLICY,
      ACTIVITY_POLICY: Learning.ACTIVITY_POLICY,
      RESPONSE_FORMATS: Learning.RESPONSE_FORMATS,
      KEY
    };
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
      const id = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
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
        const ids = /* @__PURE__ */ new Set();
        for (const q of questions) {
          if (!q || !id(q.id) || ids.has(q.id) || !KINDS.includes(q.kind ?? "setting") || !id(q.about ?? q.id) || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > MAX_OPTIONS) throw new TypeError(`Ask: invalid question ${q && q.id}`);
          ids.add(q.id);
          const options = /* @__PURE__ */ new Set();
          for (const option of q.options) {
            if (!option || !id(option.id) || options.has(option.id)) throw new TypeError(`Ask: invalid option in ${q.id}`);
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
      function fromAtlas({ engine, events = [], scope, at, experienceId, candidates, levers = [], questions, ...rest } = {}) {
        if (!engine || typeof engine.decide !== "function") throw new TypeError("Ask: Core engine required");
        validate(questions);
        const byAbout = new Map(questions.map((q) => [q.about ?? q.id, q]));
        const decide = (answers) => {
          const extra = [];
          for (const [about, value] of Object.entries(answers)) {
            const q = byAbout.get(about);
            if (!q) continue;
            const base = { schema: 1, id: `ask-virtual-${q.id}`, scope, at, recordedAt: at };
            if (q.kind === "confirm") extra.push({ ...base, type: "estimate.responded", line: q.line, value });
            else extra.push({ ...base, type: "context.set", field: q.field ?? about, value, until: null });
          }
          const plan = engine.decide({ events: [...events, ...extra], scope, at, experienceId, candidates, levers });
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

// atlas/game-browser.js
var require_game_browser = __commonJS({
  "atlas/game-browser.js"(exports, module) {
    "use strict";
    var { createMap } = require_strata();
    var curriculum = require_topik_i2().topikMap();
    var learning = require_game_learning();
    var Flow = require_flow();
    var TemperFlow = require_temper_flow();
    var VellumFlow = require_vellum_flow();
    var Ask = require_ask();
    var map = createMap(curriculum);
    function host() {
      if (typeof window === "undefined") return null;
      if (window.SYNKLearningHost) return window.SYNKLearningHost;
      try {
        if (window.parent !== window && window.parent.location.origin === window.location.origin) return window.parent.SYNKLearningHost || null;
      } catch {
      }
      return null;
    }
    var factory = (config) => learning.createGame({ ...config, map });
    var games = /* @__PURE__ */ new Set();
    var flushAll = () => {
      for (const game of games) {
        try {
          game.flush?.();
        } catch {
        }
      }
    };
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("pagehide", flushAll);
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushAll();
      });
    }
    module.exports = {
      ...learning,
      Flow,
      TemperFlow,
      VellumFlow,
      Ask,
      SKILLS: map.allNodes(),
      engine: Object.freeze({ createGame: factory, createLearningSync: learning.createLearningSync, createMemorySync: learning.createMemorySync }),
      createGame: (options) => {
        const owner = host();
        const game = owner ? owner.createGame(options, factory, learning.createLearningSync) : factory(options);
        games.add(game);
        return game;
      }
    };
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
var base64url = (bytes2) => btoa(String.fromCharCode(...bytes2)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    } catch (error2) {
      if (response.ok && error2?.name !== "SyntaxError") throw Object.assign(new Error("\uB85C\uADF8\uC778 \uC751\uB2F5\uC744 \uB05D\uAE4C\uC9C0 \uBC1B\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC5F0\uACB0\uC774 \uB3CC\uC544\uC624\uBA74 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "NETWORK", retryable: true });
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
function scopedStorage(storage, accountKey, revision, guard) {
  const prefix = `synk.account.${accountKey}.r${revision}.`;
  return Object.freeze(Object.fromEntries(["getItem", "setItem", "removeItem"].map((method) => [method, (key, ...args) => {
    guard();
    return storage[method](prefix + key, ...args);
  }])));
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
        throw Object.assign(new Error("\uD654\uBA74\uC758 \uB85C\uADF8\uC778\uC740 \uC885\uB8CC\uD588\uC9C0\uB9CC \uC790\uB3D9 \uC5F0\uACB0 \uCDE8\uC18C\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC774 \uCC3D\uC744 \uB2EB\uC544 \uC8FC\uC138\uC694."), { code: "PLATFORM_ENTRY_STORAGE", retryable: false });
      }
    }
  };
}
var PUBLIC = Object.freeze({ world: "https://synk.im/account/client.html?product=world&play=learning-hub", care: "https://synk.im/care/", fortune: "https://synk.im/fortune/", rehearsal: "https://synk.im/rehearsal/" });

// experiences/synk-world-app/world-account.mjs
var import_account_client = __toESM(require_account_client(), 1);

// experiences/synk-account/src/desktop-account.mjs
function createDesktopAccountClient({ bridge, product, guard }) {
  if (!["platform", "world"].includes(product) || typeof guard !== "function" || typeof bridge?.accountRequest !== "function") throw new TypeError("Trusted desktop account bridge required");
  async function request(operation, params = {}, signal) {
    guard();
    if (signal?.aborted) throw Object.assign(new Error("\uC694\uCCAD\uC744 \uCDE8\uC18C\uD588\uC5B4\uC694."), { code: "ABORTED" });
    const result = await bridge.accountRequest(operation, params);
    guard();
    if (signal?.aborted) throw Object.assign(new Error("\uC694\uCCAD\uC744 \uCDE8\uC18C\uD588\uC5B4\uC694."), { code: "ABORTED" });
    if (result?.ok !== true) throw Object.assign(new Error(result?.error?.message || "\uACC4\uC815 \uC5F0\uACB0\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694."), {
      code: result?.error?.code || "ACCOUNT_UNAVAILABLE",
      retryable: result?.error?.retryable === true,
      status: result?.error?.status,
      revision: result?.revision
    });
    return result;
  }
  return Object.freeze({
    configured: true,
    product,
    play: Object.freeze({
      load: () => request("playLoad"),
      mutate: (body) => request("playMutate", body)
    }),
    load: () => request("load"),
    release: () => request("release"),
    atlasSummary: () => request("atlasSummary"),
    setLearning: (enabled, expected_revision) => request("setLearning", { enabled, expected_revision }),
    updateProfile: (profile, expected_profile_revision) => request("updateProfile", { profile, expected_profile_revision }),
    revokeSession: (session_id) => request("revokeSession", { session_id }),
    revokeAll: () => request("revokeAll"),
    requestDeletion: (request_id) => request("requestDeletion", { request_id }),
    exportPage: ({ after = 0, until } = {}) => request("exportPage", { after, ...until == null ? {} : { until } }),
    learning: Object.freeze({
      get: ({ after, revision, signal }) => request("learningGet", { after, revision }, signal),
      post: ({ revision, events, signal }) => request("learningPost", { revision, events }, signal)
    }),
    memory: Object.freeze({
      get: ({ revision, signal }) => request("memoryGet", { revision }, signal),
      post: ({ revision, entries, signal }) => request("memoryPost", { revision, entries }, signal)
    })
  });
}

// experiences/korean-racing/play-catalog.js
var PLAY_GAMES = Object.freeze([
  {
    "id": "racing",
    "name": "\uD55C\uAD6D\uC5B4 \uB808\uC774\uC2F1",
    "combo": 3,
    "comboLabel": "\uD55C \uB808\uC774\uC2A4\uC5D0\uC11C \uC815\uB2F5 \uAC8C\uC774\uD2B8 3\uAC1C \uC5F0\uC18D \uD1B5\uACFC",
    "titles": [
      "\uCCAB \uCD9C\uBC1C",
      "\uAE38\uC744 \uC77D\uB294 \uB4DC\uB77C\uC774\uBC84",
      "\uC815\uB2F5 \uC9C8\uC8FC",
      "\uCF54\uC2A4\uD2B8 \uB9C8\uC2A4\uD130"
    ]
  },
  {
    "id": "rhythm",
    "name": "\uB9D0\uC758 \uB9AC\uB4EC",
    "combo": 30,
    "comboLabel": "\uD55C \uACE1\uC5D0\uC11C \uB9AC\uB4EC \uB178\uD2B8 30\uCF64\uBCF4",
    "titles": [
      "\uCCAB \uBC15\uC790",
      "\uC18C\uB9AC\uB97C \uBAA8\uC73C\uB294 \uC0AC\uB78C",
      "\uB9AC\uB4EC\uC744 \uD0C0\uB294 \uADC0",
      "\uC644\uBCBD\uD55C \uC559\uCF54\uB974"
    ]
  },
  {
    "id": "runner",
    "name": "\uBC14\uB78C\uAE38",
    "combo": 3,
    "comboLabel": "\uD55C \uD310\uC5D0\uC11C \uBD80\uD0C1 3\uAC1C \uC5F0\uC18D \uC131\uACF5",
    "titles": [
      "\uCCAB \uBC14\uB78C",
      "\uBD80\uD0C1\uC744 \uBAA8\uC73C\uB294 \uC5EC\uD589\uC790",
      "\uBC14\uB78C\uC744 \uC787\uB294 \uBC1C\uAC78\uC74C",
      "\uB4F1\uBD88\uC758 \uAE38\uC7A1\uC774"
    ]
  },
  {
    "id": "order-rush",
    "name": "\uC8FC\uBB38 \uD3ED\uC8FC",
    "combo": 5,
    "comboLabel": "\uD55C \uC601\uC5C5\uC5D0\uC11C \uC8FC\uBB38 5\uAC1C \uC5F0\uC18D \uC131\uACF5",
    "titles": [
      "\uCCAB \uC601\uC5C5",
      "\uC8FC\uBB38\uC744 \uAE30\uC5B5\uD558\uB294 \uC190",
      "\uBE48\uD2C8\uC5C6\uB294 \uBC14\uB9AC\uC2A4\uD0C0",
      "\uC644\uBCBD\uD55C \uB9C8\uAC10"
    ]
  },
  {
    "id": "entry-check",
    "name": "\uC785\uC7A5 \uAC80\uC0AC",
    "combo": 5,
    "comboLabel": "\uD55C \uADFC\uBB34\uC5D0\uC11C \uCCAB \uB3C4\uC7A5 5\uAC1C \uC5F0\uC18D \uC815\uB2F5",
    "titles": [
      "\uCCAB \uADFC\uBB34",
      "\uCD08\uB300\uC7A5\uC744 \uC77D\uB294 \uB208",
      "\uC815\uD655\uD55C \uB3C4\uC7A5",
      "\uBBFF\uC74C\uC9C1\uD55C \uBB38\uC9C0\uAE30"
    ]
  },
  {
    "id": "story-classroom",
    "name": "\uC120\uC0DD\uB2D8\uC774 \uB3CC\uC544\uC654\uB2E4",
    "combo": 3,
    "comboLabel": "\uD55C \uC774\uC57C\uAE30\uC5D0\uC11C \uB3C4\uC6C0 \uC5C6\uC774 \uBD80\uD0C1 3\uAC1C \uC5F0\uC18D \uCCAB \uC2DC\uB3C4 \uC131\uACF5",
    "titles": [
      "\uCCAB \uC774\uC57C\uAE30",
      "\uAD50\uC2E4\uC758 \uD574\uACB0\uC0AC",
      "\uCC99\uCC99 \uC774\uC57C\uAE30\uAFBC",
      "\uC644\uBCBD\uD55C \uB9C8\uC9C0\uB9C9 \uC7A5"
    ]
  },
  {
    "id": "blank-slice",
    "name": "\uBE48\uCE78 \uBCA0\uAE30",
    "combo": 5,
    "comboLabel": "\uD55C \uD310\uC5D0\uC11C \uC815\uB2F5 5\uAC1C \uC5F0\uC18D \uBCA0\uAE30",
    "titles": [
      "\uCCAB \uBCA0\uAE30",
      "\uD45C\uD604\uC744 \uBAA8\uC73C\uB294 \uAC80\uAC1D",
      "\uB04A\uAE40 \uC5C6\uB294 \uAC80\uBB34",
      "\uBE48\uCE78\uC758 \uB2EC\uC778"
    ]
  }
]);
var PLAY_ACHIEVEMENTS = Object.freeze([
  {
    "key": "first",
    "name": "\uCCAB \uC644\uC8FC",
    "description": "\uD55C\uAD6D\uC5B4 \uB808\uC774\uC2F1 \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "metric": "rounds",
    "target": 1,
    "id": "racing-first",
    "game": "racing",
    "rewardId": "racing-title-first",
    "title": "\uCCAB \uCD9C\uBC1C"
  },
  {
    "key": "steady",
    "name": "\uCC28\uACE1\uCC28\uACE1 20",
    "description": "\uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "metric": "correct",
    "target": 20,
    "id": "racing-steady",
    "game": "racing",
    "rewardId": "racing-title-steady",
    "title": "\uAE38\uC744 \uC77D\uB294 \uB4DC\uB77C\uC774\uBC84"
  },
  {
    "key": "combo",
    "name": "\uD750\uB984\uC744 \uC787\uB2E4",
    "description": "\uD55C \uB808\uC774\uC2A4\uC5D0\uC11C \uC815\uB2F5 \uAC8C\uC774\uD2B8 3\uAC1C \uC5F0\uC18D \uD1B5\uACFC",
    "metric": "bestCombo",
    "target": 3,
    "id": "racing-combo",
    "game": "racing",
    "rewardId": "racing-title-combo",
    "title": "\uC815\uB2F5 \uC9C8\uC8FC"
  },
  {
    "key": "perfect",
    "name": "\uC138 \uBC88\uC758 \uC644\uBCBD\uD55C \uD310",
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "metric": "perfectRounds",
    "target": 3,
    "id": "racing-perfect",
    "game": "racing",
    "rewardId": "racing-title-perfect",
    "title": "\uCF54\uC2A4\uD2B8 \uB9C8\uC2A4\uD130"
  },
  {
    "key": "first",
    "name": "\uCCAB \uC644\uC8FC",
    "description": "\uB9D0\uC758 \uB9AC\uB4EC \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "metric": "rounds",
    "target": 1,
    "id": "rhythm-first",
    "game": "rhythm",
    "rewardId": "rhythm-title-first",
    "title": "\uCCAB \uBC15\uC790"
  },
  {
    "key": "steady",
    "name": "\uCC28\uACE1\uCC28\uACE1 20",
    "description": "\uB4E3\uAE30 \uBB38\uC81C \uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "metric": "correct",
    "target": 20,
    "id": "rhythm-steady",
    "game": "rhythm",
    "rewardId": "rhythm-title-steady",
    "title": "\uC18C\uB9AC\uB97C \uBAA8\uC73C\uB294 \uC0AC\uB78C"
  },
  {
    "key": "combo",
    "name": "\uD750\uB984\uC744 \uC787\uB2E4",
    "description": "\uD55C \uACE1\uC5D0\uC11C \uB9AC\uB4EC \uB178\uD2B8 30\uCF64\uBCF4",
    "metric": "bestCombo",
    "target": 30,
    "id": "rhythm-combo",
    "game": "rhythm",
    "rewardId": "rhythm-title-combo",
    "title": "\uB9AC\uB4EC\uC744 \uD0C0\uB294 \uADC0"
  },
  {
    "key": "perfect",
    "name": "\uC138 \uBC88\uC758 \uC644\uBCBD\uD55C \uD310",
    "description": "\uD55C \uACE1\uC758 \uB4E3\uAE30 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "metric": "perfectRounds",
    "target": 3,
    "id": "rhythm-perfect",
    "game": "rhythm",
    "rewardId": "rhythm-title-perfect",
    "title": "\uC644\uBCBD\uD55C \uC559\uCF54\uB974"
  },
  {
    "key": "first",
    "name": "\uCCAB \uC644\uC8FC",
    "description": "\uBC14\uB78C\uAE38 \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "metric": "rounds",
    "target": 1,
    "id": "runner-first",
    "game": "runner",
    "rewardId": "runner-title-first",
    "title": "\uCCAB \uBC14\uB78C"
  },
  {
    "key": "steady",
    "name": "\uCC28\uACE1\uCC28\uACE1 20",
    "description": "\uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "metric": "correct",
    "target": 20,
    "id": "runner-steady",
    "game": "runner",
    "rewardId": "runner-title-steady",
    "title": "\uBD80\uD0C1\uC744 \uBAA8\uC73C\uB294 \uC5EC\uD589\uC790"
  },
  {
    "key": "combo",
    "name": "\uD750\uB984\uC744 \uC787\uB2E4",
    "description": "\uD55C \uD310\uC5D0\uC11C \uBD80\uD0C1 3\uAC1C \uC5F0\uC18D \uC131\uACF5",
    "metric": "bestCombo",
    "target": 3,
    "id": "runner-combo",
    "game": "runner",
    "rewardId": "runner-title-combo",
    "title": "\uBC14\uB78C\uC744 \uC787\uB294 \uBC1C\uAC78\uC74C"
  },
  {
    "key": "perfect",
    "name": "\uC138 \uBC88\uC758 \uC644\uBCBD\uD55C \uD310",
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "metric": "perfectRounds",
    "target": 3,
    "id": "runner-perfect",
    "game": "runner",
    "rewardId": "runner-title-perfect",
    "title": "\uB4F1\uBD88\uC758 \uAE38\uC7A1\uC774"
  },
  {
    "key": "first",
    "name": "\uCCAB \uC644\uC8FC",
    "description": "\uC8FC\uBB38 \uD3ED\uC8FC \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "metric": "rounds",
    "target": 1,
    "id": "order-rush-first",
    "game": "order-rush",
    "rewardId": "order-rush-title-first",
    "title": "\uCCAB \uC601\uC5C5"
  },
  {
    "key": "steady",
    "name": "\uCC28\uACE1\uCC28\uACE1 20",
    "description": "\uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "metric": "correct",
    "target": 20,
    "id": "order-rush-steady",
    "game": "order-rush",
    "rewardId": "order-rush-title-steady",
    "title": "\uC8FC\uBB38\uC744 \uAE30\uC5B5\uD558\uB294 \uC190"
  },
  {
    "key": "combo",
    "name": "\uD750\uB984\uC744 \uC787\uB2E4",
    "description": "\uD55C \uC601\uC5C5\uC5D0\uC11C \uC8FC\uBB38 5\uAC1C \uC5F0\uC18D \uC131\uACF5",
    "metric": "bestCombo",
    "target": 5,
    "id": "order-rush-combo",
    "game": "order-rush",
    "rewardId": "order-rush-title-combo",
    "title": "\uBE48\uD2C8\uC5C6\uB294 \uBC14\uB9AC\uC2A4\uD0C0"
  },
  {
    "key": "perfect",
    "name": "\uC138 \uBC88\uC758 \uC644\uBCBD\uD55C \uD310",
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "metric": "perfectRounds",
    "target": 3,
    "id": "order-rush-perfect",
    "game": "order-rush",
    "rewardId": "order-rush-title-perfect",
    "title": "\uC644\uBCBD\uD55C \uB9C8\uAC10"
  },
  {
    "key": "first",
    "name": "\uCCAB \uC644\uC8FC",
    "description": "\uC785\uC7A5 \uAC80\uC0AC \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "metric": "rounds",
    "target": 1,
    "id": "entry-check-first",
    "game": "entry-check",
    "rewardId": "entry-check-title-first",
    "title": "\uCCAB \uADFC\uBB34"
  },
  {
    "key": "steady",
    "name": "\uCC28\uACE1\uCC28\uACE1 20",
    "description": "\uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "metric": "correct",
    "target": 20,
    "id": "entry-check-steady",
    "game": "entry-check",
    "rewardId": "entry-check-title-steady",
    "title": "\uCD08\uB300\uC7A5\uC744 \uC77D\uB294 \uB208"
  },
  {
    "key": "combo",
    "name": "\uD750\uB984\uC744 \uC787\uB2E4",
    "description": "\uD55C \uADFC\uBB34\uC5D0\uC11C \uCCAB \uB3C4\uC7A5 5\uAC1C \uC5F0\uC18D \uC815\uB2F5",
    "metric": "bestCombo",
    "target": 5,
    "id": "entry-check-combo",
    "game": "entry-check",
    "rewardId": "entry-check-title-combo",
    "title": "\uC815\uD655\uD55C \uB3C4\uC7A5"
  },
  {
    "key": "perfect",
    "name": "\uC138 \uBC88\uC758 \uC644\uBCBD\uD55C \uD310",
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "metric": "perfectRounds",
    "target": 3,
    "id": "entry-check-perfect",
    "game": "entry-check",
    "rewardId": "entry-check-title-perfect",
    "title": "\uBBFF\uC74C\uC9C1\uD55C \uBB38\uC9C0\uAE30"
  },
  {
    "key": "first",
    "name": "\uCCAB \uC644\uC8FC",
    "description": "\uC120\uC0DD\uB2D8\uC774 \uB3CC\uC544\uC654\uB2E4 \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "metric": "rounds",
    "target": 1,
    "id": "story-classroom-first",
    "game": "story-classroom",
    "rewardId": "story-classroom-title-first",
    "title": "\uCCAB \uC774\uC57C\uAE30"
  },
  {
    "key": "steady",
    "name": "\uCC28\uACE1\uCC28\uACE1 20",
    "description": "\uB3C4\uC6C0 \uC5C6\uC774 \uCCAB \uC2DC\uB3C4\uC5D0 \uC62E\uAE34 \uBD80\uD0C1 \uB204\uC801 20\uAC1C",
    "metric": "correct",
    "target": 20,
    "id": "story-classroom-steady",
    "game": "story-classroom",
    "rewardId": "story-classroom-title-steady",
    "title": "\uAD50\uC2E4\uC758 \uD574\uACB0\uC0AC"
  },
  {
    "key": "combo",
    "name": "\uD750\uB984\uC744 \uC787\uB2E4",
    "description": "\uD55C \uC774\uC57C\uAE30\uC5D0\uC11C \uB3C4\uC6C0 \uC5C6\uC774 \uBD80\uD0C1 3\uAC1C \uC5F0\uC18D \uCCAB \uC2DC\uB3C4 \uC131\uACF5",
    "metric": "bestCombo",
    "target": 3,
    "id": "story-classroom-combo",
    "game": "story-classroom",
    "rewardId": "story-classroom-title-combo",
    "title": "\uCC99\uCC99 \uC774\uC57C\uAE30\uAFBC"
  },
  {
    "key": "perfect",
    "name": "\uC138 \uBC88\uC758 \uC644\uBCBD\uD55C \uD310",
    "description": "\uBAA8\uB4E0 \uBD80\uD0C1\uC744 \uB3C4\uC6C0 \uC5C6\uC774 \uCCAB \uC2DC\uB3C4\uC5D0 \uC62E\uAE34 \uC774\uC57C\uAE30 3\uD68C",
    "metric": "perfectRounds",
    "target": 3,
    "id": "story-classroom-perfect",
    "game": "story-classroom",
    "rewardId": "story-classroom-title-perfect",
    "title": "\uC644\uBCBD\uD55C \uB9C8\uC9C0\uB9C9 \uC7A5"
  },
  {
    "key": "first",
    "name": "\uCCAB \uC644\uC8FC",
    "description": "\uBE48\uCE78 \uBCA0\uAE30 \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "metric": "rounds",
    "target": 1,
    "id": "blank-slice-first",
    "game": "blank-slice",
    "rewardId": "blank-slice-title-first",
    "title": "\uCCAB \uBCA0\uAE30"
  },
  {
    "key": "steady",
    "name": "\uCC28\uACE1\uCC28\uACE1 20",
    "description": "\uB204\uC801 \uC815\uB2F5 \uBCA0\uAE30 20\uAC1C",
    "metric": "correct",
    "target": 20,
    "id": "blank-slice-steady",
    "game": "blank-slice",
    "rewardId": "blank-slice-title-steady",
    "title": "\uD45C\uD604\uC744 \uBAA8\uC73C\uB294 \uAC80\uAC1D"
  },
  {
    "key": "combo",
    "name": "\uD750\uB984\uC744 \uC787\uB2E4",
    "description": "\uD55C \uD310\uC5D0\uC11C \uC815\uB2F5 5\uAC1C \uC5F0\uC18D \uBCA0\uAE30",
    "metric": "bestCombo",
    "target": 5,
    "id": "blank-slice-combo",
    "game": "blank-slice",
    "rewardId": "blank-slice-title-combo",
    "title": "\uB04A\uAE40 \uC5C6\uB294 \uAC80\uBB34"
  },
  {
    "key": "perfect",
    "name": "\uC138 \uBC88\uC758 \uC644\uBCBD\uD55C \uD310",
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "metric": "perfectRounds",
    "target": 3,
    "id": "blank-slice-perfect",
    "game": "blank-slice",
    "rewardId": "blank-slice-title-perfect",
    "title": "\uBE48\uCE78\uC758 \uB2EC\uC778"
  }
]);
var GAME_SHOP_ITEMS = Object.freeze([
  {
    "id": "racing-style-default",
    "kind": "game-style",
    "game": "racing",
    "slot": "style",
    "value": "default",
    "name": "\uAE30\uBCF8 \uAFB8\uBBF8\uAE30",
    "price": 0,
    "description": "\uCC98\uC74C \uD568\uAED8\uD55C \uAE30\uBCF8 \uBAA8\uC2B5\uC774\uC5D0\uC694.",
    "color": "#b7cdbb"
  },
  {
    "id": "racing-title-first",
    "kind": "game-title",
    "game": "racing",
    "slot": "title",
    "value": "first",
    "name": "\uCCAB \uCD9C\uBC1C",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C\uAD6D\uC5B4 \uB808\uC774\uC2F1 \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "color": "#d4b786",
    "achievementId": "racing-first"
  },
  {
    "id": "racing-title-steady",
    "kind": "game-title",
    "game": "racing",
    "slot": "title",
    "value": "steady",
    "name": "\uAE38\uC744 \uC77D\uB294 \uB4DC\uB77C\uC774\uBC84",
    "price": null,
    "unlockOnly": true,
    "description": "\uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "color": "#d4b786",
    "achievementId": "racing-steady"
  },
  {
    "id": "racing-title-combo",
    "kind": "game-title",
    "game": "racing",
    "slot": "title",
    "value": "combo",
    "name": "\uC815\uB2F5 \uC9C8\uC8FC",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uB808\uC774\uC2A4\uC5D0\uC11C \uC815\uB2F5 \uAC8C\uC774\uD2B8 3\uAC1C \uC5F0\uC18D \uD1B5\uACFC",
    "color": "#d4b786",
    "achievementId": "racing-combo"
  },
  {
    "id": "racing-title-perfect",
    "kind": "game-title",
    "game": "racing",
    "slot": "title",
    "value": "perfect",
    "name": "\uCF54\uC2A4\uD2B8 \uB9C8\uC2A4\uD130",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "color": "#d4b786",
    "achievementId": "racing-perfect"
  },
  {
    "id": "rhythm-style-default",
    "kind": "game-style",
    "game": "rhythm",
    "slot": "style",
    "value": "default",
    "name": "\uAE30\uBCF8 \uAFB8\uBBF8\uAE30",
    "price": 0,
    "description": "\uCC98\uC74C \uD568\uAED8\uD55C \uAE30\uBCF8 \uBAA8\uC2B5\uC774\uC5D0\uC694.",
    "color": "#b7cdbb"
  },
  {
    "id": "rhythm-style-aurora",
    "kind": "game-style",
    "game": "rhythm",
    "slot": "style",
    "value": "aurora",
    "name": "\uC624\uB85C\uB77C \uBE44\uD2B8",
    "price": 25,
    "description": "\uB178\uD2B8\uC640 \uD0C0\uACA9 \uBE5B\uC744 \uCCAD\uB85D\uBE5B \uC624\uB85C\uB77C\uB85C \uBC14\uAFD4\uC694.",
    "color": "#78d7c1"
  },
  {
    "id": "rhythm-style-sunset",
    "kind": "game-style",
    "game": "rhythm",
    "slot": "style",
    "value": "sunset",
    "name": "\uB178\uC744 \uC2A4\uD14C\uC774\uC9C0",
    "price": 60,
    "description": "\uB178\uD2B8\uC640 \uD0C0\uACA9 \uBE5B\uC744 \uB530\uB73B\uD55C \uB178\uC744\uBE5B\uC73C\uB85C \uBC14\uAFD4\uC694.",
    "color": "#efa177"
  },
  {
    "id": "rhythm-style-starlight",
    "kind": "game-style",
    "game": "rhythm",
    "slot": "style",
    "value": "starlight",
    "name": "\uBCC4\uBE5B \uC559\uCF54\uB974",
    "price": 100,
    "description": "\uB178\uD2B8\uC640 \uD0C0\uACA9 \uBE5B\uC744 \uBCF4\uB78F\uBE5B \uBCC4\uBB34\uB9AC\uB85C \uBC14\uAFD4\uC694.",
    "color": "#c2b7ef"
  },
  {
    "id": "rhythm-title-first",
    "kind": "game-title",
    "game": "rhythm",
    "slot": "title",
    "value": "first",
    "name": "\uCCAB \uBC15\uC790",
    "price": null,
    "unlockOnly": true,
    "description": "\uB9D0\uC758 \uB9AC\uB4EC \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "color": "#d4b786",
    "achievementId": "rhythm-first"
  },
  {
    "id": "rhythm-title-steady",
    "kind": "game-title",
    "game": "rhythm",
    "slot": "title",
    "value": "steady",
    "name": "\uC18C\uB9AC\uB97C \uBAA8\uC73C\uB294 \uC0AC\uB78C",
    "price": null,
    "unlockOnly": true,
    "description": "\uB4E3\uAE30 \uBB38\uC81C \uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "color": "#d4b786",
    "achievementId": "rhythm-steady"
  },
  {
    "id": "rhythm-title-combo",
    "kind": "game-title",
    "game": "rhythm",
    "slot": "title",
    "value": "combo",
    "name": "\uB9AC\uB4EC\uC744 \uD0C0\uB294 \uADC0",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uACE1\uC5D0\uC11C \uB9AC\uB4EC \uB178\uD2B8 30\uCF64\uBCF4",
    "color": "#d4b786",
    "achievementId": "rhythm-combo"
  },
  {
    "id": "rhythm-title-perfect",
    "kind": "game-title",
    "game": "rhythm",
    "slot": "title",
    "value": "perfect",
    "name": "\uC644\uBCBD\uD55C \uC559\uCF54\uB974",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uACE1\uC758 \uB4E3\uAE30 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "color": "#d4b786",
    "achievementId": "rhythm-perfect"
  },
  {
    "id": "runner-style-default",
    "kind": "game-style",
    "game": "runner",
    "slot": "style",
    "value": "default",
    "name": "\uAE30\uBCF8 \uAFB8\uBBF8\uAE30",
    "price": 0,
    "description": "\uCC98\uC74C \uD568\uAED8\uD55C \uAE30\uBCF8 \uBAA8\uC2B5\uC774\uC5D0\uC694.",
    "color": "#b7cdbb"
  },
  {
    "id": "runner-title-first",
    "kind": "game-title",
    "game": "runner",
    "slot": "title",
    "value": "first",
    "name": "\uCCAB \uBC14\uB78C",
    "price": null,
    "unlockOnly": true,
    "description": "\uBC14\uB78C\uAE38 \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "color": "#d4b786",
    "achievementId": "runner-first"
  },
  {
    "id": "runner-title-steady",
    "kind": "game-title",
    "game": "runner",
    "slot": "title",
    "value": "steady",
    "name": "\uBD80\uD0C1\uC744 \uBAA8\uC73C\uB294 \uC5EC\uD589\uC790",
    "price": null,
    "unlockOnly": true,
    "description": "\uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "color": "#d4b786",
    "achievementId": "runner-steady"
  },
  {
    "id": "runner-title-combo",
    "kind": "game-title",
    "game": "runner",
    "slot": "title",
    "value": "combo",
    "name": "\uBC14\uB78C\uC744 \uC787\uB294 \uBC1C\uAC78\uC74C",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uD310\uC5D0\uC11C \uBD80\uD0C1 3\uAC1C \uC5F0\uC18D \uC131\uACF5",
    "color": "#d4b786",
    "achievementId": "runner-combo"
  },
  {
    "id": "runner-title-perfect",
    "kind": "game-title",
    "game": "runner",
    "slot": "title",
    "value": "perfect",
    "name": "\uB4F1\uBD88\uC758 \uAE38\uC7A1\uC774",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "color": "#d4b786",
    "achievementId": "runner-perfect"
  },
  {
    "id": "order-rush-style-default",
    "kind": "game-style",
    "game": "order-rush",
    "slot": "style",
    "value": "default",
    "name": "\uAE30\uBCF8 \uAFB8\uBBF8\uAE30",
    "price": 0,
    "description": "\uCC98\uC74C \uD568\uAED8\uD55C \uAE30\uBCF8 \uBAA8\uC2B5\uC774\uC5D0\uC694.",
    "color": "#b7cdbb"
  },
  {
    "id": "order-rush-style-mint",
    "kind": "game-style",
    "game": "order-rush",
    "slot": "style",
    "value": "mint",
    "name": "\uBBFC\uD2B8 \uCE74\uD398",
    "price": 25,
    "description": "\uC791\uC5C5\uB300 \uC55E \uD3A0\uD2B8 \uD310\xB7\uB9E4\uD2B8\xB7\uCEF5 \uBC1B\uCE68\uC744 \uBBFC\uD2B8\uBE5B\uC73C\uB85C \uAFB8\uBA70\uC694.",
    "color": "#90cbbb"
  },
  {
    "id": "order-rush-style-coral",
    "kind": "game-style",
    "game": "order-rush",
    "slot": "style",
    "value": "coral",
    "name": "\uCF54\uB784 \uCE74\uD398",
    "price": 60,
    "description": "\uC791\uC5C5\uB300 \uC55E \uD3A0\uD2B8 \uD310\xB7\uB9E4\uD2B8\xB7\uCEF5 \uBC1B\uCE68\uC744 \uC0B0\uD638\uBE5B\uC73C\uB85C \uAFB8\uBA70\uC694.",
    "color": "#e3a498"
  },
  {
    "id": "order-rush-style-night",
    "kind": "game-style",
    "game": "order-rush",
    "slot": "style",
    "value": "night",
    "name": "\uBC24\uD558\uB298 \uCE74\uD398",
    "price": 100,
    "description": "\uC791\uC5C5\uB300 \uC55E \uD3A0\uD2B8 \uD310\xB7\uB9E4\uD2B8\xB7\uCEF5 \uBC1B\uCE68\uC744 \uBC24\uD558\uB298\uBE5B\uC73C\uB85C \uAFB8\uBA70\uC694.",
    "color": "#929bc5"
  },
  {
    "id": "order-rush-title-first",
    "kind": "game-title",
    "game": "order-rush",
    "slot": "title",
    "value": "first",
    "name": "\uCCAB \uC601\uC5C5",
    "price": null,
    "unlockOnly": true,
    "description": "\uC8FC\uBB38 \uD3ED\uC8FC \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "color": "#d4b786",
    "achievementId": "order-rush-first"
  },
  {
    "id": "order-rush-title-steady",
    "kind": "game-title",
    "game": "order-rush",
    "slot": "title",
    "value": "steady",
    "name": "\uC8FC\uBB38\uC744 \uAE30\uC5B5\uD558\uB294 \uC190",
    "price": null,
    "unlockOnly": true,
    "description": "\uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "color": "#d4b786",
    "achievementId": "order-rush-steady"
  },
  {
    "id": "order-rush-title-combo",
    "kind": "game-title",
    "game": "order-rush",
    "slot": "title",
    "value": "combo",
    "name": "\uBE48\uD2C8\uC5C6\uB294 \uBC14\uB9AC\uC2A4\uD0C0",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uC601\uC5C5\uC5D0\uC11C \uC8FC\uBB38 5\uAC1C \uC5F0\uC18D \uC131\uACF5",
    "color": "#d4b786",
    "achievementId": "order-rush-combo"
  },
  {
    "id": "order-rush-title-perfect",
    "kind": "game-title",
    "game": "order-rush",
    "slot": "title",
    "value": "perfect",
    "name": "\uC644\uBCBD\uD55C \uB9C8\uAC10",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "color": "#d4b786",
    "achievementId": "order-rush-perfect"
  },
  {
    "id": "entry-check-style-default",
    "kind": "game-style",
    "game": "entry-check",
    "slot": "style",
    "value": "default",
    "name": "\uAE30\uBCF8 \uAFB8\uBBF8\uAE30",
    "price": 0,
    "description": "\uCC98\uC74C \uD568\uAED8\uD55C \uAE30\uBCF8 \uBAA8\uC2B5\uC774\uC5D0\uC694.",
    "color": "#b7cdbb"
  },
  {
    "id": "entry-check-style-leaf",
    "kind": "game-style",
    "game": "entry-check",
    "slot": "style",
    "value": "leaf",
    "name": "\uC78E\uC0C8 \uB3C4\uC7A5",
    "price": 25,
    "description": "\uB3C4\uC7A5 \uB458\uB808\uC5D0 \uC78E\uC0C8 \uBB38\uC591\uC744 \uB354\uD574\uC694.",
    "color": "#8abf9d"
  },
  {
    "id": "entry-check-style-postmark",
    "kind": "game-style",
    "game": "entry-check",
    "slot": "style",
    "value": "postmark",
    "name": "\uC5EC\uD589 \uC18C\uC778",
    "price": 60,
    "description": "\uB3C4\uC7A5 \uB458\uB808\uB97C \uC5EC\uD589 \uC6B0\uD3B8 \uC18C\uC778\uCC98\uB7FC \uAFB8\uBA70\uC694.",
    "color": "#cd9f74"
  },
  {
    "id": "entry-check-style-star",
    "kind": "game-style",
    "game": "entry-check",
    "slot": "style",
    "value": "star",
    "name": "\uBCC4\uBB34\uB9AC \uB3C4\uC7A5",
    "price": 100,
    "description": "\uB3C4\uC7A5 \uB458\uB808\uC5D0 \uC791\uC740 \uBCC4 \uBB38\uC591\uC744 \uB354\uD574\uC694.",
    "color": "#c7b3e6"
  },
  {
    "id": "entry-check-title-first",
    "kind": "game-title",
    "game": "entry-check",
    "slot": "title",
    "value": "first",
    "name": "\uCCAB \uADFC\uBB34",
    "price": null,
    "unlockOnly": true,
    "description": "\uC785\uC7A5 \uAC80\uC0AC \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "color": "#d4b786",
    "achievementId": "entry-check-first"
  },
  {
    "id": "entry-check-title-steady",
    "kind": "game-title",
    "game": "entry-check",
    "slot": "title",
    "value": "steady",
    "name": "\uCD08\uB300\uC7A5\uC744 \uC77D\uB294 \uB208",
    "price": null,
    "unlockOnly": true,
    "description": "\uB204\uC801 \uC815\uB2F5 20\uAC1C",
    "color": "#d4b786",
    "achievementId": "entry-check-steady"
  },
  {
    "id": "entry-check-title-combo",
    "kind": "game-title",
    "game": "entry-check",
    "slot": "title",
    "value": "combo",
    "name": "\uC815\uD655\uD55C \uB3C4\uC7A5",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uADFC\uBB34\uC5D0\uC11C \uCCAB \uB3C4\uC7A5 5\uAC1C \uC5F0\uC18D \uC815\uB2F5",
    "color": "#d4b786",
    "achievementId": "entry-check-combo"
  },
  {
    "id": "entry-check-title-perfect",
    "kind": "game-title",
    "game": "entry-check",
    "slot": "title",
    "value": "perfect",
    "name": "\uBBFF\uC74C\uC9C1\uD55C \uBB38\uC9C0\uAE30",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "color": "#d4b786",
    "achievementId": "entry-check-perfect"
  },
  {
    "id": "story-classroom-style-default",
    "kind": "game-style",
    "game": "story-classroom",
    "slot": "style",
    "value": "default",
    "name": "\uAE30\uBCF8 \uAFB8\uBBF8\uAE30",
    "price": 0,
    "description": "\uCC98\uC74C \uD568\uAED8\uD55C \uAE30\uBCF8 \uBAA8\uC2B5\uC774\uC5D0\uC694.",
    "color": "#b7cdbb"
  },
  {
    "id": "story-classroom-style-coral",
    "kind": "game-style",
    "game": "story-classroom",
    "slot": "style",
    "value": "coral",
    "name": "\uCF54\uB784 \uAD50\uC2E4",
    "price": 25,
    "description": "\uC774\uC57C\uAE30 \uC218\uCCA9 \uD45C\uC9C0\uC640 \uAD50\uC2E4 \uC704\uCABD \uC7A5\uC2DD\uC744 \uB530\uB73B\uD55C \uCF54\uB784\uBE5B\uC73C\uB85C \uAFB8\uBA70\uC694.",
    "color": "#e6a79a"
  },
  {
    "id": "story-classroom-style-blue",
    "kind": "game-style",
    "game": "story-classroom",
    "slot": "style",
    "value": "blue",
    "name": "\uD558\uB298\uBE5B \uAD50\uC2E4",
    "price": 60,
    "description": "\uC774\uC57C\uAE30 \uC218\uCCA9 \uD45C\uC9C0\uC640 \uAD50\uC2E4 \uC704\uCABD \uC7A5\uC2DD\uC744 \uB9D1\uC740 \uD558\uB298\uBE5B\uC73C\uB85C \uAFB8\uBA70\uC694.",
    "color": "#99bfd8"
  },
  {
    "id": "story-classroom-style-party",
    "kind": "game-style",
    "game": "story-classroom",
    "slot": "style",
    "value": "party",
    "name": "\uC791\uC740 \uCD95\uC81C",
    "price": 100,
    "description": "\uC774\uC57C\uAE30 \uC218\uCCA9 \uD45C\uC9C0\uC640 \uAD50\uC2E4 \uC704\uCABD \uC7A5\uC2DD\uC744 \uCD95\uC81C \uC0C9\uC73C\uB85C \uAFB8\uBA70\uC694.",
    "color": "#c7b3e6"
  },
  {
    "id": "story-classroom-title-first",
    "kind": "game-title",
    "game": "story-classroom",
    "slot": "title",
    "value": "first",
    "name": "\uCCAB \uC774\uC57C\uAE30",
    "price": null,
    "unlockOnly": true,
    "description": "\uC120\uC0DD\uB2D8\uC774 \uB3CC\uC544\uC654\uB2E4 \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "color": "#d4b786",
    "achievementId": "story-classroom-first"
  },
  {
    "id": "story-classroom-title-steady",
    "kind": "game-title",
    "game": "story-classroom",
    "slot": "title",
    "value": "steady",
    "name": "\uAD50\uC2E4\uC758 \uD574\uACB0\uC0AC",
    "price": null,
    "unlockOnly": true,
    "description": "\uB3C4\uC6C0 \uC5C6\uC774 \uCCAB \uC2DC\uB3C4\uC5D0 \uC62E\uAE34 \uBD80\uD0C1 \uB204\uC801 20\uAC1C",
    "color": "#d4b786",
    "achievementId": "story-classroom-steady"
  },
  {
    "id": "story-classroom-title-combo",
    "kind": "game-title",
    "game": "story-classroom",
    "slot": "title",
    "value": "combo",
    "name": "\uCC99\uCC99 \uC774\uC57C\uAE30\uAFBC",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uC774\uC57C\uAE30\uC5D0\uC11C \uB3C4\uC6C0 \uC5C6\uC774 \uBD80\uD0C1 3\uAC1C \uC5F0\uC18D \uCCAB \uC2DC\uB3C4 \uC131\uACF5",
    "color": "#d4b786",
    "achievementId": "story-classroom-combo"
  },
  {
    "id": "story-classroom-title-perfect",
    "kind": "game-title",
    "game": "story-classroom",
    "slot": "title",
    "value": "perfect",
    "name": "\uC644\uBCBD\uD55C \uB9C8\uC9C0\uB9C9 \uC7A5",
    "price": null,
    "unlockOnly": true,
    "description": "\uBAA8\uB4E0 \uBD80\uD0C1\uC744 \uB3C4\uC6C0 \uC5C6\uC774 \uCCAB \uC2DC\uB3C4\uC5D0 \uC62E\uAE34 \uC774\uC57C\uAE30 3\uD68C",
    "color": "#d4b786",
    "achievementId": "story-classroom-perfect"
  },
  {
    "id": "blank-slice-style-default",
    "kind": "game-style",
    "game": "blank-slice",
    "slot": "style",
    "value": "default",
    "name": "\uAE30\uBCF8 \uAFB8\uBBF8\uAE30",
    "price": 0,
    "description": "\uCC98\uC74C \uD568\uAED8\uD55C \uAE30\uBCF8 \uBAA8\uC2B5\uC774\uC5D0\uC694.",
    "color": "#b7cdbb"
  },
  {
    "id": "blank-slice-style-blossom",
    "kind": "game-style",
    "game": "blank-slice",
    "slot": "style",
    "value": "blossom",
    "name": "\uBC9A\uAF43 \uAC80\uBB34",
    "price": 25,
    "description": "\uC815\uB2F5\uC744 \uAC00\uB974\uB294 \uCE7C\uC790\uAD6D\uC744 \uBC9A\uAF43\uBE5B\uC73C\uB85C \uBC14\uAFD4\uC694.",
    "color": "#e5a3b1"
  },
  {
    "id": "blank-slice-style-ocean",
    "kind": "game-style",
    "game": "blank-slice",
    "slot": "style",
    "value": "ocean",
    "name": "\uD30C\uB3C4 \uAC80\uBB34",
    "price": 60,
    "description": "\uC815\uB2F5\uC744 \uAC00\uB974\uB294 \uCE7C\uC790\uAD6D\uC744 \uBC14\uB2E4\uBE5B\uC73C\uB85C \uBC14\uAFD4\uC694.",
    "color": "#71bbd7"
  },
  {
    "id": "blank-slice-style-starlight",
    "kind": "game-style",
    "game": "blank-slice",
    "slot": "style",
    "value": "starlight",
    "name": "\uBCC4\uBE5B \uAC80\uBB34",
    "price": 100,
    "description": "\uC815\uB2F5\uC744 \uAC00\uB974\uB294 \uCE7C\uC790\uAD6D\uC744 \uBCC4\uBE5B\uC73C\uB85C \uBC14\uAFD4\uC694.",
    "color": "#c2b7ef"
  },
  {
    "id": "blank-slice-title-first",
    "kind": "game-title",
    "game": "blank-slice",
    "slot": "title",
    "value": "first",
    "name": "\uCCAB \uBCA0\uAE30",
    "price": null,
    "unlockOnly": true,
    "description": "\uBE48\uCE78 \uBCA0\uAE30 \uD55C \uD310 \uB05D\uAE4C\uC9C0 \uB9C8\uCE58\uAE30",
    "color": "#d4b786",
    "achievementId": "blank-slice-first"
  },
  {
    "id": "blank-slice-title-steady",
    "kind": "game-title",
    "game": "blank-slice",
    "slot": "title",
    "value": "steady",
    "name": "\uD45C\uD604\uC744 \uBAA8\uC73C\uB294 \uAC80\uAC1D",
    "price": null,
    "unlockOnly": true,
    "description": "\uB204\uC801 \uC815\uB2F5 \uBCA0\uAE30 20\uAC1C",
    "color": "#d4b786",
    "achievementId": "blank-slice-steady"
  },
  {
    "id": "blank-slice-title-combo",
    "kind": "game-title",
    "game": "blank-slice",
    "slot": "title",
    "value": "combo",
    "name": "\uB04A\uAE40 \uC5C6\uB294 \uAC80\uBB34",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uD310\uC5D0\uC11C \uC815\uB2F5 5\uAC1C \uC5F0\uC18D \uBCA0\uAE30",
    "color": "#d4b786",
    "achievementId": "blank-slice-combo"
  },
  {
    "id": "blank-slice-title-perfect",
    "kind": "game-title",
    "game": "blank-slice",
    "slot": "title",
    "value": "perfect",
    "name": "\uBE48\uCE78\uC758 \uB2EC\uC778",
    "price": null,
    "unlockOnly": true,
    "description": "\uD55C \uD310\uC758 \uBB38\uC81C\uB97C \uBAA8\uB450 \uB9DE\uD78C \uD310 3\uD68C",
    "color": "#d4b786",
    "achievementId": "blank-slice-perfect"
  }
]);

// experiences/korean-racing/beginner-catalog.js
var rows = [
  ["magic-scene", "word-magic", [
    ["default", "\uBAA8\uD5D8\uC758 \uBE5B", "Adventure light", 0, "#f5c445"],
    ["sunset", "\uB178\uC744 \uB9C8\uBC95", "Sunset magic", 15, "#e6a79a"],
    ["night", "\uBCC4\uBE5B \uB9C8\uBC95", "Starlight magic", 35, "#3d6bc9"]
  ]],
  ["magic-frame", "word-magic", [
    ["cream", "\uD06C\uB9BC \uC0AC\uC9C4\uD2C0", "Cream frame", 0, "#fff1c9"],
    ["coral", "\uCF54\uB784 \uC0AC\uC9C4\uD2C0", "Coral frame", 20, "#d63c2a"],
    ["lapis", "\uD30C\uB791 \uC0AC\uC9C4\uD2C0", "Blue frame", 40, "#3d6bc9"]
  ]],
  ["order-stall", "order-rush", [
    ["default", "\uCC98\uC74C \uAC00\uAC8C", "First shop", 0, "#fff1c9"],
    ["blush", "\uBD84\uD64D \uAC00\uAC8C", "Blush shop", 15, "#fbd3c6"],
    ["lapis", "\uD30C\uB791 \uAC00\uAC8C", "Blue shop", 35, "#3d6bc9"]
  ]],
  ["order-tray", "order-rush", [
    ["cream", "\uD06C\uB9BC \uC7C1\uBC18", "Cream tray", 0, "#fff1c9"],
    ["butter", "\uBC84\uD130 \uC7C1\uBC18", "Butter tray", 20, "#f5c445"],
    ["coral", "\uCF54\uB784 \uC7C1\uBC18", "Coral tray", 40, "#d63c2a"]
  ]],
  ["ship-sky", "spaceship-coop", [
    ["default", "\uCCAB \uC6B0\uC8FC", "First sky", 0, "#3d6bc9"],
    ["sunset", "\uB178\uC744 \uC6B0\uC8FC", "Sunset sky", 15, "#e6a79a"],
    ["night", "\uAE4A\uC740 \uC6B0\uC8FC", "Deep space", 35, "#333e5c"]
  ]],
  ["ship-badge", "spaceship-coop", [
    ["sparkle", "\uBC18\uC9DD\uC774\uB294 \uBCC4", "Sparkle", 0, "#f5c445"],
    ["ring", "\uD589\uC131 \uACE0\uB9AC", "Planet ring", 20, "#f5c445"],
    ["heart", "\uD558\uD2B8 \uC2E0\uD638", "Heart signal", 40, "#d63c2a"]
  ]],
  ["magic-toys", "word-magic", [
    ["default", "\uCCAB \uB9C8\uBC95 \uC18C\uD488", "First magic toys", 0, "#fff1c9"],
    ["picnic", "\uC18C\uD48D \uC2E4\uD5D8 \uC138\uD2B8", "Picnic experiment set", 20, "#f5c445"]
  ]]
];
var benefits = {
  "magic-scene": ["\uB0B4\uAC00 \uACE0\uB978 \uBE5B \uC18D\uC5D0\uC11C \uBC30\uC6B4 \uB9D0\uB85C \uC7A5\uBA74\uC744 \uB9CC\uB4E4\uACE0 \uC0AC\uC9C4\uC73C\uB85C \uB0A8\uACA8\uC694.", "Build a scene with your words in your favorite light, then keep a picture."],
  "magic-frame": ["\uBC30\uC6B4 \uB9D0\uB85C \uB9CC\uB4E0 \uB0B4 \uC7A5\uBA74\uC744 \uC0AC\uC9C4\uD2C0\uC5D0 \uB2F4\uC544 \uC800\uC7A5\uD574\uC694.", "Frame and save a scene you made with the words you learned."],
  "order-stall": ["\uB0B4 \uAC04\uD310\uC744 \uAC78\uACE0 \uC190\uB2D8\uC758 \uD55C\uAD6D\uC5B4 \uC8FC\uBB38\uC744 \uB4E4\uC5B4\uC694.", "Put up your own sign and listen to your customers\u2019 Korean orders."],
  "order-tray": ["\uB0B4\uAC00 \uACE0\uB978 \uC7C1\uBC18\uC5D0 \uC8FC\uBB38\uC744 \uB2F4\uC544 \uC190\uB2D8\uC5D0\uAC8C \uAC74\uB124\uC694.", "Fill your own tray with the order and serve your customer."],
  "ship-sky": ["\uB0B4\uAC00 \uACE0\uB978 \uC6B0\uC8FC\uC5D0\uC11C \uCE5C\uAD6C\uC640 \uB4E3\uACE0 \uB3C4\uC6B0\uBA70 \uD568\uAED8 \uC774\uB959\uD574\uC694.", "Listen, help, and launch together in your favorite sky."],
  "ship-badge": ["\uD568\uAED8 \uACE0\uCE58\uB294 \uC6B0\uC8FC\uC120\uC5D0 \uB098\uB97C \uB098\uD0C0\uB0B4\uB294 \uD45C\uC2DD\uC744 \uBD99\uC5EC\uC694.", "Give the ship you repair together your own personal emblem."],
  "magic-toys": ["\uACF0\xB7\uD29C\uBE0C\xB7\uAC04\uC2DD\xB7\uC0C1\uC790\uB97C \uBC30\uC6B4 \uB9D0\uB85C \uBC14\uAFB8\uACE0 \uB098\uB9CC\uC758 \uC18C\uD48D\uC744 \uB9CC\uB4E4\uC5B4\uC694.", "Change a bear, swim ring, snack, and chest with familiar words to make your own picnic."]
};
var playItems = [
  { id: "order-playset-picnic", kind: "order-playset", game: "order-rush", value: "picnic", name: "\uC18C\uD48D \uCE5C\uAD6C \uCD08\uB300 \uC138\uD2B8", nameEn: "Picnic with friends", price: 15, color: "#f5c445", ownershipOnly: true, description: "\uC138 \uCE5C\uAD6C\uC758 \uC8FC\uBB38\uC744 \uB4E3\uACE0 \uC74C\uC2DD\uC744 \uAC74\uB124 \uD568\uAED8\uD558\uB294 \uC18C\uD48D \uC7A5\uBA74\uC744 \uC644\uC131\uD574\uC694.", descriptionEn: "Listen to three friends, serve their orders, and complete a shared picnic.", useLabel: "\uCE5C\uAD6C 3\uBA85 \uCD08\uB300\uD558\uAE30", useLabelEn: "Invite three friends" },
  { id: "ship-keepsake-starbook", kind: "ship-keepsake", game: "spaceship-coop", value: "starbook", name: "\uC6B0\uB9AC\uC758 \uD0D0\uD5D8 \uBCC4\uC9C0\uB3C4", nameEn: "Our expedition starbook", price: 30, color: "#3d6bc9", ownershipOnly: true, description: "\uD568\uAED8 \uACE0\uCE5C \uC2E4\uC81C \uD0D0\uD5D8\uC744 \uBCC4\uC9C0\uB3C4\uB85C \uBAA8\uC73C\uACE0 \uAE30\uB150\uC0AC\uC9C4\uC73C\uB85C \uB0A8\uACA8\uC694.", descriptionEn: "Collect the expeditions you actually repaired together as star maps and save a keepsake.", useLabel: "\uB0B4 \uBCC4\uC9C0\uB3C4 \uC5F4\uAE30", useLabelEn: "Open my starbook" }
];
var BEGINNER_ITEMS = Object.freeze([...rows.flatMap(([kind, game, items]) => items.map(([value, name, nameEn, price, color]) => ({ id: `${kind}-${value}`, kind, game, value, name, nameEn, price, color, description: kind === "magic-toys" && value === "default" ? "\uD1A0\uB07C\xB7\uC0C1\uC790\xB7\uCC45\xB7\uC6B0\uC0B0\uC5D0 \uBC30\uC6B4 \uB9D0\uC744 \uC4F0\uACE0 \uB0B4 \uC7A5\uBA74\uC744 \uB9CC\uB4E4\uC5B4\uC694." : benefits[kind][0], descriptionEn: kind === "magic-toys" && value === "default" ? "Use familiar words on a rabbit, chest, book, and umbrella to create your own scene." : benefits[kind][1] }))), ...playItems]);
var BEGINNER_DEFAULTS = Object.freeze(Object.fromEntries(rows.map(([kind, , items]) => [kind, items[0][0]])));
var BEGINNER_GAMES = Object.freeze(["word-magic", "order-rush", "spaceship-coop"]);

// experiences/korean-racing/garage-core.js
var GARAGE_KEY = "SYNK_PLAY_COLLECTION_V1";
var VEHICLES = [
  { id: "coast", kind: "coast", name: "\uCF54\uC2A4\uD2B8 GT", price: 0, description: "\uCCAB \uBC14\uB2E4 \uC5EC\uD589\uC744 \uD568\uAED8\uD558\uB294 \uC2A4\uD3EC\uCE20\uCE74", color: "#8dc9bc" },
  { id: "open", kind: "open", name: "\uBE0C\uB9AC\uC988 \uB85C\uB4DC\uC2A4\uD130", price: 120, description: "\uC5F4\uB9B0 \uC9C0\uBD95\uC73C\uB85C \uBC14\uB78C\uC744 \uB9CC\uB098\uB294 \uB85C\uB4DC\uC2A4\uD130", color: "#e4b79a" },
  { id: "rally", kind: "rally", name: "\uD2B8\uB808\uC77C \uB7A0\uB9AC", price: 220, description: "\uB113\uC740 \uD39C\uB354\uC640 \uBCF4\uC870\uB4F1\uC744 \uAC16\uCD98 \uB7A0\uB9AC\uCE74", color: "#aebaca" },
  { id: "finale", kind: "open", name: "\uB9C8\uC2A4\uD130 \uB85C\uB4DC\uC2A4\uD130", price: null, unlockOnly: true, description: "\uC5EC\uC12F \uBC88\uC9F8 \uCC55\uD130 \uACB0\uC2B9\uC758 \uD2B9\uBCC4 \uC5D0\uB514\uC158", color: "#d6c6a2" }
];
var PAINTS = [
  { id: "mint", name: "\uBBFC\uD2B8", price: 0, color: "#8dc9bc" },
  { id: "coral", name: "\uCF54\uB784", price: 35, color: "#d78678" },
  { id: "pearl", name: "\uC9C4\uC8FC\uBE5B", price: 35, color: "#e9e5d9" },
  { id: "midnight", name: "\uBBF8\uB4DC\uB098\uC774\uD2B8", price: 50, color: "#333e5c" },
  { id: "aurora", name: "\uC624\uB85C\uB77C", price: null, unlockOnly: true, color: "#6cced2" },
  { id: "sunset", name: "\uB178\uC744", price: null, unlockOnly: true, color: "#d88b72" }
];
var WHEELS = [
  { id: "silver", name: "\uC2E4\uBC84", price: 0, color: "#c9ced3" },
  { id: "graphite", name: "\uADF8\uB798\uD30C\uC774\uD2B8", price: 45, color: "#4c515a" },
  { id: "gold", name: "\uC0F4\uD398\uC778 \uACE8\uB4DC", price: 70, color: "#c9ac72" },
  { id: "blossom", name: "\uBC9A\uAF43", price: null, unlockOnly: true, color: "#efd9cb" }
];
var TRAILS = [
  { id: "lime", name: "\uB77C\uC784 \uBD80\uC2A4\uD130", price: 0, color: "#d4ff8a" },
  { id: "ocean", name: "\uBC14\uB2E4 \uBD80\uC2A4\uD130", price: 45, color: "#66cae7" },
  { id: "sunset", name: "\uB178\uC744 \uBD80\uC2A4\uD130", price: 70, color: "#efa577" },
  { id: "starlight", name: "\uBCC4\uBE5B \uBD80\uC2A4\uD130", price: null, unlockOnly: true, color: "#ced2ff" }
];
var badge = { id: "badge-coast", kind: "badge", value: "coast", name: "\uCF54\uC2A4\uD2B8 \uCC54\uD53C\uC5B8", price: null, unlockOnly: true, color: "#d1e6da", description: "\uB124 \uBC88\uC9F8 \uCC55\uD130 \uACB0\uC2B9 \uAE30\uB150 \uBC30\uC9C0" };
var RACKETS = [
  { id: "coral", name: "\uCF54\uB784 \uB77C\uCF13", label: "\uCF54\uB784", price: 0, color: "#d63c2a" },
  { id: "butter", name: "\uBC84\uD130 \uB77C\uCF13", label: "\uBC84\uD130", price: 40, color: "#f5c445" },
  { id: "blush", name: "\uC5F0\uBD84\uD64D \uB77C\uCF13", label: "\uC5F0\uBD84\uD64D", price: 40, color: "#fbd3c6" },
  { id: "lapis", name: "\uB77C\uD53C\uC2A4 \uB77C\uCF13", label: "\uB77C\uD53C\uC2A4", price: 50, color: "#3d6bc9" }
];
var BALLS = [
  { id: "cream", name: "\uD06C\uB9BC \uACF5", label: "\uD06C\uB9BC", price: 0, color: "#fff1c9" },
  { id: "butter", name: "\uBC84\uD130 \uACF5", label: "\uBC84\uD130", price: 35, color: "#f5c445" },
  { id: "blush", name: "\uC5F0\uBD84\uD64D \uACF5", label: "\uC5F0\uBD84\uD64D", price: 35, color: "#fbd3c6" },
  { id: "lapis", name: "\uB77C\uD53C\uC2A4 \uACF5", label: "\uB77C\uD53C\uC2A4", price: 45, color: "#3d6bc9" }
];
var catalogue = (kind, items) => items.map((item) => ({ ...item, id: `${kind}-${item.id}`, kind, value: item.id }));
var SHOP_ITEMS = [
  ...catalogue("vehicle", VEHICLES),
  ...catalogue("paint", PAINTS),
  ...catalogue("wheels", WHEELS).map((item) => item.value === "blossom" ? { ...item, id: "wheel-blossom" } : item),
  ...catalogue("trail", TRAILS),
  badge,
  ...catalogue("racket", RACKETS),
  ...catalogue("ball", BALLS),
  ...GAME_SHOP_ITEMS,
  ...BEGINNER_ITEMS
];
var FINALE_REWARDS = Object.freeze({ 1: "paint-aurora", 2: "wheel-blossom", 3: "trail-starlight", 4: "badge-coast", 5: "paint-sunset", 6: "vehicle-finale" });
var BY_ID = Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item]));
var itemById = (id) => typeof id === "string" && Object.hasOwn(BY_ID, id) ? BY_ID[id] : null;
var FREE_ITEMS = SHOP_ITEMS.filter((item) => item.price === 0).map((item) => item.id);
var DEFAULT_EQUIPMENT = Object.freeze({ vehicle: "coast", paint: "mint", wheels: "silver", trail: "lime", badge: null, racket: "coral", ball: "cream", ...BEGINNER_DEFAULTS });
var REWARDS = Object.freeze({ finish: 15, correct: 2, firstClear: 10, correction: 5, mission: 15, dailyRaceLimit: 10, miniGameAccuracy: 10 });
var MINI_GAMES = Object.freeze(["rhythm", "runner", "blank-slice", "entry-check", "story-classroom", "talk-rally", "order-rush", "word-magic", "spaceship-coop"]);
var integer = (value, fallback = 0, max = 1e9) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;
var object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var safeKey = (key) => typeof key === "string" && key.length > 0 && key.length <= 180 && !["__proto__", "prototype", "constructor"].includes(key);
var boolRecord = (value) => Object.fromEntries(Object.entries(object(value)).filter(([key, flag]) => safeKey(key) && flag === true));
var knownItem = (kind, value) => SHOP_ITEMS.find((item) => item.kind === kind && item.value === value);
var emptyGarage = () => ({
  version: 1,
  coins: 0,
  totalEarned: 0,
  owned: [...FREE_ITEMS],
  equipped: { ...DEFAULT_EQUIPMENT },
  wish: "open",
  rewardedRounds: {},
  firstClears: {},
  corrections: {},
  dailyRaceCounts: {},
  missions: {},
  gameEquipment: Object.fromEntries(PLAY_GAMES.map((g) => [g.id, { style: "default", title: null }])),
  gameStats: Object.fromEntries(PLAY_GAMES.map((g) => [g.id, { rounds: 0, correct: 0, total: 0, perfectRounds: 0, bestCombo: 0 }])),
  achievements: {},
  gameWishes: {},
  beginnerWishes: {}
});
var text = (value, max) => typeof value === "string" && value.length <= max ? value : "";
function keepMission(day, m) {
  return {
    id: text(m.id, 240),
    date: day,
    kind: m.kind,
    target: m.target,
    collection: m.collection === "words" ? "words" : "campaign",
    title: text(m.title, 120),
    description: text(m.description, 400),
    reward: integer(m.reward, 0, 1e3),
    completed: m.completed === true,
    completedAt: integer(m.completedAt, 0, Number.MAX_SAFE_INTEGER)
  };
}
function normalizeGarage(saved, mission = keepMission) {
  const result = emptyGarage();
  if (!saved || typeof saved !== "object") return result;
  result.coins = integer(saved.coins);
  result.totalEarned = Math.max(result.coins, integer(saved.totalEarned));
  result.owned = [.../* @__PURE__ */ new Set([...FREE_ITEMS, ...(Array.isArray(saved.owned) ? saved.owned : []).filter((id) => itemById(id))])];
  const equipment = object(saved.equipped);
  for (const kind of Object.keys(DEFAULT_EQUIPMENT)) {
    const item = knownItem(kind, equipment[kind]);
    if (item && result.owned.includes(item.id)) result.equipped[kind] = item.value;
  }
  for (const game of PLAY_GAMES) {
    const equipped = object(object(saved.gameEquipment)[game.id]);
    for (const slot of ["style", "title"]) {
      const item = GAME_SHOP_ITEMS.find((i) => i.game === game.id && i.slot === slot && i.value === equipped[slot]);
      if (item && result.owned.includes(item.id)) result.gameEquipment[game.id][slot] = item.value;
    }
    const stats = object(object(saved.gameStats)[game.id]), target = result.gameStats[game.id];
    for (const key of Object.keys(target)) target[key] = integer(stats[key], 0, key === "bestCombo" ? 1e4 : 1e9);
    target.correct = Math.min(target.correct, target.total);
    target.perfectRounds = Math.min(target.perfectRounds, target.rounds);
    const wish = itemById(object(saved.gameWishes)[game.id]);
    if (wish?.game === game.id && wish.slot && !wish.unlockOnly && !result.owned.includes(wish.id)) result.gameWishes[game.id] = wish.id;
  }
  for (const game of BEGINNER_GAMES) {
    const wish = BEGINNER_ITEMS.find((i) => i.id === object(saved.beginnerWishes)[game] && i.game === game && i.price > 0);
    if (wish) result.beginnerWishes[game] = wish.id;
  }
  for (const badge2 of PLAY_ACHIEVEMENTS) if (object(saved.achievements)[badge2.id] === true && result.owned.includes(badge2.rewardId)) result.achievements[badge2.id] = true;
  result.wish = VEHICLES.some((v) => v.id === saved.wish && !v.unlockOnly) ? saved.wish : saved.wish === null ? null : "open";
  result.firstClears = boolRecord(saved.firstClears);
  result.corrections = boolRecord(saved.corrections);
  result.rewardedRounds = Object.fromEntries(Object.entries(object(saved.rewardedRounds)).filter(([key]) => safeKey(key)).map(([key, r]) => [key, {
    date: /^\d{4}-\d{2}-\d{2}$/.test(r?.date) ? r.date : "",
    coins: integer(r?.coins)
  }]));
  result.dailyRaceCounts = Object.fromEntries(Object.entries(object(saved.dailyRaceCounts)).filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day)).map(([day, count]) => [day, integer(count, 0, 1e6)]));
  for (const [day, m] of Object.entries(object(saved.missions))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !m || typeof m !== "object" || !["correction", "first-clear"].includes(m.kind) || !safeKey(m.target)) continue;
    const kept = mission(day, m);
    if (kept) result.missions[day] = kept;
  }
  return result;
}

// experiences/play-common/play-data.mjs
var PLAY_SCOPE = "synk-play";
var PLAY_WALLET_KEY = GARAGE_KEY;
var PLAY_MAX_BYTES = 2 * 1024 * 1024;
var PLAY_RECORD_KEYS = Object.freeze([
  "synk.word-magic.progress.v1",
  "synk.order-rush.beginner.v1",
  "synk.order-rush.picnic.v1",
  "SYNK_SHIP_STARBOOK_V1",
  "SYNK_LAB_PLAY_PROGRESS_V1",
  "SYNK_RACING_TUTORIAL_V1",
  "synk.talk-rally.daily.v1",
  "synk.order-rush.flow-mode",
  "synk.windrun.best",
  "synk.blank-slice.v1",
  "synk.entry-check.v1",
  "synk.talk-rally.v1",
  "synk.life-korean.progress.v1"
]);
var isPlayRecordKey = (key) => PLAY_RECORD_KEYS.includes(key) || typeof key === "string" && /^SYNK_SHIP_STARBOOK_V1:kept:[a-f0-9]{32}$/.test(key);
var fail = (code = "INVALID_PLAY_STATE") => {
  throw Object.assign(new Error(code), { code, status: code === "PLAY_DATA_TOO_LARGE" ? 413 : 400 });
};
var object2 = (x) => x !== null && typeof x === "object" && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
var bytes = (x) => new TextEncoder().encode(x).length;
function safe(value, depth = 0) {
  if (depth > 20) fail();
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail();
    return;
  }
  if (typeof value === "string") {
    if (value.length > 32e3) fail();
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 2e4) fail("PLAY_DATA_TOO_LARGE");
    for (const v of value) safe(v, depth + 1);
    return;
  }
  if (!object2(value)) fail();
  for (const [key, v] of Object.entries(value)) {
    if (key.length > 240 || ["__proto__", "prototype", "constructor"].includes(key) || /^(?:token|access_?token|refresh_?token|authorization|password|secret|bearer|roomCode|participantToken)$/i.test(key)) fail();
    safe(v, depth + 1);
  }
}
function validatePlayValue(key, value) {
  if (!isPlayRecordKey(key) || typeof value !== "string") fail();
  if (key === "synk.order-rush.flow-mode") {
    if (!["auto", "fixed"].includes(value)) fail();
    return value;
  }
  if (bytes(value) > 512 * 1024) fail("PLAY_DATA_TOO_LARGE");
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail();
  }
  safe(parsed);
  return value;
}
function validatePlayRecords(records) {
  if (!object2(records) || Object.keys(records).length > 1024) fail();
  const result = {};
  for (const [key, value] of Object.entries(records)) result[key] = validatePlayValue(key, value);
  if (bytes(JSON.stringify(result)) > PLAY_MAX_BYTES) fail("PLAY_DATA_TOO_LARGE");
  return result;
}
function validatePlayWallet(value) {
  if (!object2(value)) fail();
  safe(value);
  if (bytes(JSON.stringify(value)) > PLAY_MAX_BYTES) fail("PLAY_DATA_TOO_LARGE");
  return normalizeGarage(value);
}
function validatePlayState(value) {
  if (!object2(value) || Object.keys(value).some((k) => !["wallet", "records", "imported"].includes(k))) fail();
  const state = { wallet: validatePlayWallet(value.wallet), records: validatePlayRecords(value.records), imported: value.imported === true };
  if (bytes(JSON.stringify(state)) > PLAY_MAX_BYTES) fail("PLAY_DATA_TOO_LARGE");
  return state;
}
var emptyPlayState = () => ({ wallet: emptyGarage(), records: {}, imported: false });
function readLegacyPlay(storage) {
  const records = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (isPlayRecordKey(key)) {
      const value = storage.getItem(key);
      if (value !== null) records[key] = validatePlayValue(key, value);
    }
  }
  let wallet = emptyGarage();
  const raw = storage.getItem(GARAGE_KEY);
  if (raw !== null) wallet = validatePlayWallet(JSON.parse(raw));
  return validatePlayState({ wallet, records, imported: false });
}

// experiences/play-common/account-host.mjs
var error = (code, message) => Object.assign(new Error(message || code), { code });
var clone = (value) => JSON.parse(JSON.stringify(value));
var terminal = /* @__PURE__ */ new Set(["UNAUTHORIZED", "AUTH_REQUIRED", "AUTH_SESSION_MISSING", "SESSION_REVOKED", "ACCOUNT_UNAVAILABLE", "PRODUCT_FORBIDDEN", "PLAY_ACCOUNT_MISMATCH", "ACCOUNT_CHANGED", "PLAY_SESSION_ENDED"]);
var rejectedCommands = /* @__PURE__ */ new Set(["INVALID_PLAY_COMMAND", "INVALID_PLAY_REQUEST", "INVALID_JSON", "JSON_REQUIRED", "PAYLOAD_TOO_LARGE", "PLAY_DATA_TOO_LARGE", "COMMAND_ID_CONFLICT"]);
function createWorldPlayHost({ accountId, client, guard, onStatus = () => {
}, storage = globalThis.localStorage, locks = globalThis.navigator?.locks, uuid = () => crypto.randomUUID(), now = Date.now }) {
  if (typeof accountId !== "string" || !accountId || typeof guard !== "function" || typeof client?.load !== "function" || typeof client?.mutate !== "function") throw TypeError("Verified WORLD play account required");
  const prefix = `synk.play.account.v1:${encodeURIComponent(accountId)}:pending:`, rejectedPrefix = `synk.play.account.v1:${encodeURIComponent(accountId)}:rejected:`, listeners = /* @__PURE__ */ new Set(), waitingWallets = /* @__PURE__ */ new Map();
  let stopped = false, loaded = false, revision = 0, state = emptyPlayState(), phase = "loading", lastError = null, inflight = null, timer = null, initial = null;
  function check2() {
    guard();
    if (stopped) throw error("PLAY_SESSION_ENDED", "\uC774 \uACC4\uC815\uC758 \uAC8C\uC784 \uC5F0\uACB0\uC774 \uC885\uB8CC\uB410\uC5B4\uC694.");
  }
  function pending() {
    check2();
    const result = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      let value;
      try {
        value = JSON.parse(storage.getItem(key));
      } catch {
        throw error("PLAY_PENDING_UNREADABLE", "\uC804\uC1A1 \uB300\uAE30 \uAE30\uB85D\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC6D0\uBCF8\uC744 \uBCF4\uC874\uD588\uC5B4\uC694.");
      }
      if (value?.accountId !== accountId || key !== prefix + value?.body?.id || !Number.isSafeInteger(value.at)) throw error("PLAY_PENDING_UNREADABLE");
      result.push(value);
    }
    return result.sort((a, b) => a.at - b.at || a.body.id.localeCompare(b.body.id));
  }
  function legacy() {
    try {
      return readLegacyPlay(storage);
    } catch {
      return null;
    }
  }
  function hasLegacy() {
    const old = legacy();
    return !!old && (Object.keys(old.records).length > 0 || old.wallet.totalEarned > 0 || old.wallet.owned.length > emptyPlayState().wallet.owned.length);
  }
  function rejectionCount() {
    let count = 0;
    for (let i = 0; i < storage.length; i++) if (storage.key(i)?.startsWith(rejectedPrefix)) count++;
    return count;
  }
  function rejectedError(id) {
    const raw = storage.getItem(rejectedPrefix + id);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value.accountId !== accountId || value.entry?.body?.id !== id || !rejectedCommands.has(value.code)) throw error("PLAY_PENDING_UNREADABLE");
    return Object.assign(error(value.code, "\uC774 \uC694\uCCAD\uC740 \uACC4\uC815\uC5D0\uC11C \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC6D0\uBCF8\uC740 \uC774 \uAE30\uAE30\uC5D0 \uBCF4\uAD00\uD588\uACE0 \uB2E4\uB978 \uAC8C\uC784\uC740 \uACC4\uC18D\uD560 \uC218 \uC788\uC5B4\uC694."), { rejected: true });
  }
  function preserveRejected(entry, cause) {
    check2();
    const saved = { accountId, at: now(), code: cause.code, entry };
    try {
      storage.setItem(rejectedPrefix + entry.body.id, JSON.stringify(saved));
      storage.removeItem(prefix + entry.body.id);
    } catch {
      throw error("PLAY_STORAGE_UNAVAILABLE", "\uCC98\uB9AC\uD558\uC9C0 \uBABB\uD55C \uAE30\uB85D\uC758 \uC6D0\uBCF8\uC744 \uBCF4\uAD00\uD560 \uACF5\uAC04\uC774 \uC5C6\uC5B4\uC694. \uC804\uC1A1 \uB300\uAE30 \uAE30\uB85D\uC740 \uC720\uC9C0\uD588\uC5B4\uC694.");
    }
    const rejected = rejectedError(entry.body.id);
    if (waitingWallets.has(entry.body.id)) waitingWallets.set(entry.body.id, { rejected });
  }
  function status() {
    let count = 0, rejected = 0;
    try {
      count = pending().length;
      rejected = rejectionCount();
    } catch {
    }
    return { accountId, phase, pending: count, rejected, revision, canImport: loaded && revision === 0 && hasLegacy(), message: phase === "synced" ? rejected ? `\uACC4\uC815\uC5D0 \uC5F0\uACB0\uB410\uC5B4\uC694. \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD55C \uC694\uCCAD ${rejected}\uAC1C\uC758 \uC6D0\uBCF8\uC740 \uC774 \uAE30\uAE30\uC5D0 \uBCF4\uAD00\uD588\uC5B4\uC694. \uB2E4\uB978 \uAE30\uB85D\uC740 \uACC4\uC18D \uC800\uC7A5\uB3FC\uC694.` : "\uAC8C\uC784 \uAE30\uB85D\uACFC \uAD6C\uB9E4\uD488\uC774 SYNK \uACC4\uC815\uC5D0 \uC800\uC7A5\uB410\uC5B4\uC694." : phase === "loading" ? "\uACC4\uC815\uC758 \uAC8C\uC784 \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uACE0 \uC788\uC5B4\uC694." : phase === "saving" ? "\uACC4\uC815\uC5D0 \uAC8C\uC784 \uAE30\uB85D\uC744 \uC800\uC7A5\uD558\uACE0 \uC788\uC5B4\uC694." : phase === "conflict" ? "\uB2E4\uB978 \uAE30\uAE30\uC5D0\uC11C\uB3C4 \uC9C4\uB3C4\uAC00 \uBC14\uB00C\uC5C8\uC5B4\uC694. \uC0AC\uC6A9\uD560 \uC9C4\uB3C4\uB97C \uACE8\uB77C \uC8FC\uC138\uC694." : phase === "stopped" ? "\uACC4\uC815 \uC5F0\uACB0\uC774 \uC885\uB8CC\uB410\uC5B4\uC694." : lastError?.message || "\uC544\uC9C1 \uACC4\uC815\uC5D0 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC5F0\uACB0\uD558\uBA74 \uC7AC\uC2DC\uB3C4\uD574\uC694.", code: lastError?.code };
  }
  function emit(next, reason = null) {
    phase = next;
    lastError = reason;
    const value = status();
    onStatus(value);
    for (const fn of listeners) try {
      fn(value);
    } catch {
    }
    return value;
  }
  function accept(value) {
    check2();
    if (value?.ok !== true || value.scope !== PLAY_SCOPE || value.accountId !== accountId || !Number.isSafeInteger(value.revision) || value.revision < 0) throw error("PLAY_ACCOUNT_MISMATCH", "\uACC4\uC815\uC5D0\uC11C \uBC1B\uC740 \uAC8C\uC784 \uAE30\uB85D\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.");
    if (value.revision >= revision) {
      state = validatePlayState(value.state);
      revision = value.revision;
    }
    loaded = true;
    return value;
  }
  function reportFailure(cause) {
    if (stopped) return;
    const next = terminal.has(cause.code) ? "stopped" : ["REVISION_CONFLICT", "IMPORT_CONFLICT"].includes(cause.code) ? "conflict" : "offline";
    if (next === "stopped") {
      stopped = true;
      clearTimeout(timer);
    }
    if (phase !== next || lastError !== cause) emit(next, cause);
  }
  async function receive(request) {
    try {
      return accept(await request());
    } catch (cause) {
      reportFailure(cause);
      throw cause;
    }
  }
  function records() {
    const result = { ...state.records };
    for (const entry of pending()) if (entry.body.action === "progress") for (const change of entry.body.changes) {
      if (change.value === null) delete result[change.key];
      else result[change.key] = change.value;
    }
    return result;
  }
  function queue(body) {
    check2();
    try {
      const entry = { accountId, at: pending().reduce((at, x) => Math.max(at, x.at + 1), now()), body: { ...body, id: body.id || uuid() } };
      storage.setItem(prefix + entry.body.id, JSON.stringify(entry));
      return entry;
    } catch (cause) {
      emit("offline", error("PLAY_STORAGE_UNAVAILABLE", "\uC774 \uAE30\uAE30\uC5D0 \uC804\uC1A1 \uB300\uAE30 \uAE30\uB85D\uC744 \uBCF4\uAD00\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC800\uC7A5 \uACF5\uAC04\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."));
      throw cause;
    }
  }
  const serial = (task) => locks?.request ? locks.request(`synk-play-account:${accountId}`, task) : task();
  async function flush() {
    check2();
    if (inflight) return inflight;
    inflight = serial(async () => {
      check2();
      if (!loaded) await receive(() => client.load());
      check2();
      let last;
      while (pending().length) {
        const entry = pending()[0];
        check2();
        emit("saving");
        let response;
        try {
          response = await client.mutate(entry.body);
        } catch (cause) {
          check2();
          if (!rejectedCommands.has(cause.code)) throw cause;
          preserveRejected(entry, cause);
          continue;
        }
        last = accept(response);
        check2();
        if (waitingWallets.has(entry.body.id)) waitingWallets.set(entry.body.id, last);
        storage.removeItem(prefix + entry.body.id);
      }
      emit("synced");
      return last;
    }).catch((cause) => {
      reportFailure(cause);
      throw cause;
    }).finally(() => {
      inflight = null;
    });
    return inflight;
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void flush().catch(() => {
      });
    }, 250);
    emit("saving");
  }
  function createGameStorage() {
    const observed = /* @__PURE__ */ new Map();
    return Object.freeze({
      get length() {
        check2();
        if (!loaded) throw error("PLAY_NOT_READY");
        return Object.keys(records()).length + 1;
      },
      key(index) {
        check2();
        return [PLAY_WALLET_KEY, ...Object.keys(records())][index] ?? null;
      },
      getItem(key) {
        check2();
        if (!loaded) throw error("PLAY_NOT_READY");
        if (key === PLAY_WALLET_KEY) return JSON.stringify(state.wallet);
        if (!isPlayRecordKey(key)) throw error("INVALID_PLAY_KEY");
        const value = records()[key] ?? null;
        observed.set(key, value);
        return value;
      },
      setItem(key, value) {
        check2();
        if (!loaded) throw error("PLAY_NOT_READY");
        if (phase === "conflict") throw error("REVISION_CONFLICT");
        validatePlayValue(key, value);
        const previous = observed.has(key) ? observed.get(key) : records()[key] ?? null;
        if (previous === value) return;
        queue({ action: "progress", changes: [{ key, previous, value }] });
        observed.set(key, value);
        schedule();
      },
      removeItem(key) {
        check2();
        if (!loaded || !isPlayRecordKey(key)) throw error("INVALID_PLAY_KEY");
        if (phase === "conflict") throw error("REVISION_CONFLICT");
        const previous = observed.has(key) ? observed.get(key) : records()[key] ?? null;
        if (previous === null) return;
        queue({ action: "progress", changes: [{ key, previous, value: null }] });
        observed.set(key, null);
        schedule();
      }
    });
  }
  async function ready() {
    check2();
    if (phase === "conflict") throw error("REVISION_CONFLICT", status().message);
    if (loaded) return status();
    if (!initial) initial = retry().catch((cause) => {
      initial = null;
      throw cause;
    });
    return initial;
  }
  async function retry() {
    check2();
    clearTimeout(timer);
    await flush();
    check2();
    await receive(() => client.load());
    check2();
    emit(pending().length ? "saving" : "synced");
    return status();
  }
  async function wallet(method, args = []) {
    if (!loaded) await ready();
    check2();
    if (phase === "conflict") throw error("REVISION_CONFLICT", status().message);
    const entry = queue({ action: "wallet", method, args: clone(args) });
    waitingWallets.set(entry.body.id, null);
    emit("saving");
    try {
      try {
        await flush();
      } catch (cause) {
        if (!waitingWallets.get(entry.body.id)) throw cause;
      }
      check2();
      let response = waitingWallets.get(entry.body.id);
      if (response?.rejected) throw response.rejected;
      if (!response) {
        const rejected = rejectedError(entry.body.id);
        if (rejected) throw rejected;
        response = await receive(() => client.mutate(entry.body));
        check2();
        storage.removeItem(prefix + entry.body.id);
        emit(pending().length ? "saving" : "synced");
      }
      return { ...response.result, state: clone(state.wallet), saved: true };
    } catch (cause) {
      if (!rejectedCommands.has(cause.code) || !storage.getItem(rejectedPrefix + entry.body.id)) reportFailure(cause);
      throw cause;
    } finally {
      waitingWallets.delete(entry.body.id);
    }
  }
  async function importLegacy() {
    await ready();
    check2();
    if (revision !== 0) throw error("PLAY_IMPORT_EXISTS", "\uACC4\uC815\uC5D0 \uC774\uBBF8 \uAC8C\uC784 \uAE30\uB85D\uC774 \uC788\uC5B4\uC694. \uAE30\uC874 \uAE30\uB85D\uC740 \uD569\uCE58\uC9C0 \uC54A\uC558\uC5B4\uC694.");
    const old = legacy();
    if (!old) throw error("INVALID_PLAY_STATE");
    queue({ action: "import", expected_revision: 0, state: { wallet: old.wallet, records: old.records } });
    await flush();
    return status();
  }
  async function resolve(choice) {
    check2();
    if (!["remote", "local"].includes(choice)) throw error("INVALID_RESOLUTION");
    if (inflight) await inflight.catch(() => {
    });
    check2();
    const entries = pending(), desired = records();
    await receive(() => client.load());
    check2();
    const imports = entries.filter((x) => x.body.action === "import");
    if (imports.length && choice === "local") throw error("IMPORT_CONFLICT", "\uACC4\uC815\uC5D0 \uC774\uBBF8 \uAC8C\uC784 \uAE30\uB85D\uC774 \uC788\uC5B4\uC694. \uACC4\uC815 \uAE30\uB85D\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
    const drafts = entries.filter((x) => x.body.action === "progress" || x.body.action === "import");
    if (drafts.length) storage.setItem(`synk.play.account.v1:${encodeURIComponent(accountId)}:recovery:${uuid()}`, JSON.stringify({ accountId, at: now(), drafts }));
    for (const entry of drafts) storage.removeItem(prefix + entry.body.id);
    if (choice === "local") {
      const keys = new Set(drafts.flatMap((x) => x.body.changes.map((c) => c.key)));
      for (const key of keys) {
        const previous = state.records[key] ?? null, value = desired[key] ?? null;
        if (previous !== value) queue({ action: "progress", changes: [{ key, previous, value }] });
      }
    }
    await flush();
    return status();
  }
  const api = Object.freeze({ ready, retry, flush, wallet, importLegacy, resolve, hasLegacy, status, storage: () => {
    check2();
    return createGameStorage();
  }, subscribe(fn) {
    check2();
    listeners.add(fn);
    fn(status());
    return () => listeners.delete(fn);
  }, stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    emit("stopped");
    listeners.clear();
  }, snapshot() {
    check2();
    return { accountId, revision, state: clone({ ...state, records: records() }) };
  } });
  return api;
}

// experiences/synk-world-app/world-game-host.mjs
var import_world_learning_host = __toESM(require_world_learning_host(), 1);
var import_game_browser = __toESM(require_game_browser(), 1);
function createLocalWorldLearningHost({ owner, guard = () => {
}, target = globalThis, storage = globalThis.localStorage }) {
  const accountKey = `local:${owner}`, revision = 1;
  const host = import_world_learning_host.default.createWorldLearningHost({
    accountKey,
    revision,
    connected: false,
    guard,
    engine: import_game_browser.default.engine,
    storage: scopedStorage(storage, accountKey, revision, guard)
  });
  target.SYNKLearningHost = host;
  return { dispose() {
    if (target.SYNKLearningHost === host) delete target.SYNKLearningHost;
    host.stop();
  } };
}
function createWorldGameHost({
  accountId,
  revision,
  connected,
  play,
  learning,
  memory,
  guard,
  target = globalThis,
  storage = globalThis.localStorage,
  onStatus = () => {
  },
  engine = import_game_browser.default.engine
}) {
  let disposed = false, installed = false;
  const check2 = () => {
    guard();
    if (disposed) throw Object.assign(Error("\uAC8C\uC784 \uACC4\uC815 \uC5F0\uACB0\uC774 \uB05D\uB0AC\uC5B4\uC694."), { code: "ACCOUNT_CHANGED" });
  };
  const accountKey = connected ? accountId : `local:${accountId}`;
  const notify = () => {
    try {
      onStatus(status());
    } catch {
    }
  };
  const playHost = createWorldPlayHost({ accountId, client: play, guard: check2, storage, locks: target.navigator?.locks, onStatus: () => notify() });
  const learnHost = import_world_learning_host.default.createWorldLearningHost({
    accountKey,
    revision,
    connected,
    guard: check2,
    engine,
    storage: scopedStorage(storage, accountKey, revision, check2),
    transport: learning,
    personalMemory: { accountKey, revision, connected, storage: scopedStorage(storage, accountKey, revision, check2), transport: memory },
    onStatus: () => notify()
  });
  function status() {
    return { accountId, play: playHost.status(), learning: learnHost.status(), disposed };
  }
  const flush = async () => {
    check2();
    if (playHost.status().phase === "conflict") throw Object.assign(Error(playHost.status().message), { code: playHost.status().code || "REVISION_CONFLICT" });
    await Promise.all([playHost.flush(), learnHost.flush()]);
    check2();
  };
  const retry = () => {
    if (disposed || ["conflict", "stopped"].includes(playHost.status().phase)) return;
    void Promise.resolve().then(() => Promise.all([playHost.retry(), learnHost.retry()])).catch(() => {
    });
  };
  const visibility = () => {
    if (target.document?.visibilityState === "hidden") void flush().catch(() => {
    });
    else retry();
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    target.document?.removeEventListener?.("visibilitychange", visibility);
    target.removeEventListener?.("online", retry);
    if (target.SYNKPlayHost === playHost) delete target.SYNKPlayHost;
    if (target.SYNKLearningHost === learnHost) delete target.SYNKLearningHost;
    playHost.stop();
    learnHost.stop();
  }
  const publicHandle = Object.freeze({ status, flush, async resolve(choice) {
    check2();
    await playHost.resolve(choice);
    check2();
    return status();
  }, closeGame() {
    if (disposed) return;
    try {
      check2();
      learnHost.closeRun();
      void flush().catch(() => {
      });
    } catch {
    }
  }, dispose });
  return Object.freeze({ publicHandle, async ready() {
    check2();
    try {
      await playHost.ready();
    } catch (error2) {
      if (playHost.status().phase === "conflict") {
        check2();
        return;
      }
      throw error2;
    }
    check2();
    learnHost.preferences();
    await learnHost.ready();
    check2();
  }, install() {
    check2();
    if (playHost.status().phase === "conflict") return;
    target.SYNKPlayHost = playHost;
    target.SYNKLearningHost = learnHost;
    if (!installed) {
      installed = true;
      target.document?.addEventListener?.("visibilitychange", visibility);
      target.addEventListener?.("online", retry);
    }
  }, dispose });
}

// experiences/synk-world-app/world-account.mjs
var import_game_browser2 = __toESM(require_game_browser(), 1);

// experiences/synk-world-app/life-content.mjs
var choices = (texts) => texts.map((text2, index) => ({ id: ["a", "b", "c"][index], text: text2 }));
var scene = (speaker, text2) => ({ speaker, text: text2 });
var expression = (id, korean, meaning) => ({ id, korean, meaning });
var transfer = (prompt, context, texts, answerId, explanation) => ({
  prompt,
  context,
  choices: choices(texts),
  answerId,
  explanation
});
var question = (id, skillId, expressionId, prompt, context, texts, answerId, explanation, review) => ({
  id,
  skillId,
  expressionId,
  prompt,
  context,
  choices: choices(texts),
  answerId,
  explanation,
  review: { ...review, id: `${id}-transfer`, skillId, expressionId }
});
var skill = (id, title) => ({ id, title, domain: "reading" });
var lesson = (id, type, title, goal, expressions, scenes, questions) => ({
  id,
  type,
  title,
  goal,
  expressions,
  scenes,
  questions
});
var greetingExpressions = [
  expression("greet-hello", "\uC548\uB155\uD558\uC138\uC694.", "\uCC98\uC74C \uB9CC\uB098\uAC70\uB098 \uB9CC\uB09C \uC0AC\uB78C\uC5D0\uAC8C \uC815\uC911\uD558\uAC8C \uC778\uC0AC\uD574\uC694."),
  expression("greet-thanks", "\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uB3C4\uC6C0\uC744 \uBC1B\uC558\uC744 \uB54C \uC815\uC911\uD558\uAC8C \uACE0\uB9C8\uC6C0\uC744 \uC804\uD574\uC694."),
  expression("greet-name", "\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694.", "\uC790\uAE30 \uC774\uB984\uC744 \uC18C\uAC1C\uD574\uC694. \uC774\uB984 \uB05D\uC5D0 \uBC1B\uCE68\uC774 \uC788\uC73C\uBA74 \u2018\uC774\uC5D0\uC694\u2019\uB97C \uC368\uC694.")
];
var cafeExpressions = [
  expression("cafe-order", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uC74C\uB8CC\uC758 \uC885\uB958\xB7\uC628\uB3C4\xB7\uC218\uB97C \uD568\uAED8 \uB9D0\uD558\uBA70 \uC8FC\uBB38\uD574\uC694."),
  expression("cafe-here", "\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uACA0\uB2E4\uACE0 \uB9D0\uD574\uC694."),
  expression("cafe-takeout", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC74C\uB8CC\uB97C \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uACA0\uB2E4\uACE0 \uB9D0\uD574\uC694.")
];
var cafeTasteExpressions = [
  expression("cafe-preference", "\uB530\uB73B\uD55C \uCC28\uB97C \uB9C8\uC2DC\uACE0 \uC2F6\uC5B4\uC694.", "\uCE5C\uAD6C\uAC00 \uC6D0\uD558\uB294 \uC74C\uB8CC\uC758 \uC885\uB958\uC640 \uC628\uB3C4\uB97C \uC54C\uC544\uBD10\uC694."),
  ...cafeExpressions.filter((item) => ["cafe-order", "cafe-here"].includes(item.id))
];
var cafeSoldoutExpressions = [
  expression("cafe-soldout", "\uC8FC\uC2A4\uB294 \uD488\uC808\uC774\uC5D0\uC694.", "\uD488\uC808\uC740 \uC624\uB298 \uB354 \uC8FC\uBB38\uD560 \uC218 \uC5C6\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694. \uAC00\uB2A5\uD55C \uB2E4\uB978 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694."),
  ...cafeExpressions.filter((item) => ["cafe-order", "cafe-takeout"].includes(item.id))
];
var cafeChangeExpressions = [
  expression("cafe-change", "\uC8FC\uC2A4 \uB300\uC2E0 \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", "\uC774\uBBF8 \uC8FC\uBB38\uD55C \uC74C\uB8CC\uB97C \uB2E4\uB978 \uC74C\uB8CC\uB85C \uBC14\uAFB8\uC5B4 \uB2EC\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694."),
  expression("cafe-add", "\uD55C \uC794 \uB354 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uD55C \uC218\uB7C9\uC5D0 \uD55C \uC794\uC744 \uCD94\uAC00\uD574\uC694."),
  ...cafeExpressions.filter((item) => item.id === "cafe-takeout")
];
var cafeComposeExpressions = [
  expression("cafe-compose", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC794 \uC218\uB97C \uC9C1\uC811 \uACE8\uB77C \uD55C \uBB38\uC7A5\uC73C\uB85C \uC8FC\uBB38\uD574\uC694."),
  ...cafeExpressions.filter((item) => ["cafe-order", "cafe-here"].includes(item.id))
];
var storeExpressions = [
  expression("store-price", "\uC774\uAC70 \uC5BC\uB9C8\uC608\uC694?", "\uBB3C\uAC74\uC758 \uAC00\uACA9\uC744 \uBB3C\uC5B4\uC694."),
  expression("store-bag", "\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694.", "\uC0B0 \uBB3C\uAC74\uC744 \uB2F4\uC744 \uBD09\uD22C\uB97C \uBD80\uD0C1\uD574\uC694."),
  expression("store-card", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uCE74\uB4DC\uB85C \uAC12\uC744 \uB0B4\uACA0\uB2E4\uACE0 \uB9D0\uD574\uC694.")
];
var directionExpressions = [
  expression("directions-where", "\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uAC00\uB824\uB294 \uC7A5\uC18C\uC758 \uC704\uCE58\uB97C \uBB3C\uC5B4\uC694."),
  expression("directions-right", "\uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694.", "\uC624\uB978\uCABD \uBC29\uD5A5\uC73C\uB85C \uC774\uB3D9\uD558\uB77C\uB294 \uC548\uB0B4\uC608\uC694."),
  expression("directions-beside", "\uC740\uD589 \uC606\uC5D0 \uC788\uC5B4\uC694.", "\uC740\uD589 \uBC14\uB85C \uC606\uC5D0 \uC788\uB294 \uC7A5\uC18C\uB97C \uC124\uBA85\uD574\uC694.")
];
var transitExpressions = [
  expression("transit-destination", "\uC774 \uBC84\uC2A4\uB294 \uACF5\uC6D0\uC5D0 \uAC00\uC694?", "\uD0C0\uB824\uB294 \uBC84\uC2A4\uAC00 \uBAA9\uC801\uC9C0\uB85C \uAC00\uB294\uC9C0 \uD655\uC778\uD574\uC694."),
  expression("transit-alight", "\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uC9C0\uAE08 \uC815\uB958\uC7A5\uC774 \uC544\uB2C8\uB77C \uADF8\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694."),
  expression("transit-card", "\uAD50\uD1B5\uCE74\uB4DC\uB97C \uCC0D\uC73C\uC138\uC694.", "\uBC84\uC2A4\uC758 \uCE74\uB4DC \uB2E8\uB9D0\uAE30\uC5D0 \uAD50\uD1B5\uCE74\uB4DC\uB97C \uB300\uB77C\uB294 \uC548\uB0B4\uC608\uC694.")
];
var planExpressions = [
  expression("plans-time", "\uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC\uC5D0 \uB9CC\uB098\uC694.", "\uB9CC\uB0A0 \uB0A0\uC9DC\uC640 \uC2DC\uAC04\uC744 \uC815\uD574\uC694."),
  expression("plans-place", "\uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0A0\uAE4C\uC694?", "\uB9CC\uB0A0 \uC7A5\uC18C\uB97C \uD568\uAED8 \uC815\uD558\uB824\uACE0 \uBB3C\uC5B4\uC694."),
  expression("plans-delay", "\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uAC8C \uB3C4\uCC29\uD560 \uAC83 \uAC19\uB2E4\uACE0 \uC54C\uB824\uC694.")
];
var PACKS = [
  {
    id: "greetings",
    title: "\uCC98\uC74C \uB9CC\uB09C \uB0A0",
    subtitle: "\uC778\uC0AC\uD558\uACE0 \uC774\uB984\uC744 \uB098\uB220\uC694",
    icon: "greeting",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("greet-response", "\uC0C1\uD669\uC5D0 \uB9DE\uAC8C \uC778\uC0AC\uD558\uAE30"), skill("greet-gratitude", "\uACE0\uB9C8\uC6C0 \uC804\uD558\uAE30"), skill("greet-introduction", "\uC774\uB984 \uC18C\uAC1C \uC774\uD574\uD558\uAE30")],
    lessons: [
      lesson("greetings-expressions", "expressions", "\uCCAB \uC778\uC0AC \uC138 \uB9C8\uB514", "\uB9CC\uB0A8\xB7\uAC10\uC0AC\xB7\uC18C\uAC1C\uC5D0 \uB9DE\uB294 \uD45C\uD604\uC744 \uACE8\uB77C\uC694.", greetingExpressions, [
        scene("mongle", "\uC6B0\uC640! \uCC98\uC74C \uB9CC\uB09C \uCE5C\uAD6C\uC57C! \uAC19\uC774 \uC778\uC0AC\uD574 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uC774\uB984\uB9CC \uB9D0\uD574\uB3C4 \uB2E4 \uC54C\uC544\uBCF4\uC9C0. \u2026\uCC98\uC74C\uC774\uBA74 \uC778\uC0AC\uBD80\uD130 \uD558\uB294 \uAC70\uC57C."),
        scene("marine", "\uCCAB \uB9CC\uB0A8 \uD655\uC778. \uC778\uC0AC, \uC774\uB984, \uACE0\uB9C8\uC6C0. \uC900\uBE44 \uC644\uB8CC.")
      ], [
        question("greetings-expressions-hello", "greet-response", "greet-hello", "\uCC98\uC74C \uB9CC\uB09C \uC120\uC0DD\uB2D8\uC5D0\uAC8C \uC5B4\uB5A4 \uC778\uC0AC\uB97C \uD560\uAE4C\uC694?", "\uAD50\uC2E4\uC5D0 \uB4E4\uC5B4\uAC00 \uC120\uC0DD\uB2D8\uC744 \uCC98\uC74C \uB9CC\uB0AC\uC5B4\uC694.", ["\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uB2E4\uB140\uC654\uC5B4\uC694."], "a", "\uC0C8\uB85C \uB9CC\uB09C \uC0AC\uB78C\uC5D0\uAC8C\uB294 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uB77C\uACE0 \uC778\uC0AC\uD574\uC694.", transfer("\uD559\uAD50\uC5D0\uC11C \uCC98\uC74C \uB9CC\uB09C \uC9C1\uC6D0\uC5D0\uAC8C \uC778\uC0AC\uD574\uC694.", "\uC544\uC9C1 \uB3C4\uC6C0\uC744 \uBC1B\uAC70\uB098 \uD5E4\uC5B4\uC9C0\uB294 \uC0C1\uD669\uC740 \uC544\uB2C8\uC5D0\uC694.", ["\uB2E4\uB140\uC654\uC5B4\uC694.", "\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "b", "\uCC98\uC74C \uB9CC\uB09C \uC9C1\uC6D0\uC5D0\uAC8C \uC815\uC911\uD558\uAC8C \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uB77C\uACE0 \uD574\uC694.")),
        question("greetings-expressions-thanks", "greet-gratitude", "greet-thanks", "\uB3C4\uC6C0\uC744 \uBC1B\uC558\uC5B4\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "\uCE5C\uAD6C\uAC00 \uB5A8\uC5B4\uC9C4 \uCC45\uC744 \uC8FC\uC6CC \uC92C\uC5B4\uC694.", ["\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694.", "\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "c", "\uB3C4\uC6C0\uC744 \uBC1B\uC740 \uB4A4\uC5D0\uB294 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB85C \uACE0\uB9C8\uC6C0\uC744 \uC804\uD574\uC694.", transfer("\uC9C1\uC6D0\uC774 \uC783\uC5B4\uBC84\uB9B0 \uC6B0\uC0B0\uC744 \uCC3E\uC544 \uC92C\uC5B4\uC694.", "\uB3C4\uC6C0\uC744 \uC900 \uC9C1\uC6D0\uC5D0\uAC8C \uACE0\uB9C8\uC6C0\uC744 \uC804\uD558\uB824\uACE0 \uD574\uC694.", ["\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uCC98\uC74C \uBD59\uACA0\uC2B5\uB2C8\uB2E4.", "\uC800\uB294 \uB9C8\uB9B0\uC774\uC5D0\uC694."], "a", "\uC6B0\uC0B0\uC744 \uCC3E\uC544 \uC900 \uB3C4\uC6C0\uC5D0 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB77C\uACE0 \uB9D0\uD574\uC694.")),
        question("greetings-expressions-name", "greet-introduction", "greet-name", "\uC790\uAE30 \uC774\uB984\uC744 \uC18C\uAC1C\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uB0B4 \uC774\uB984\uC740 \uBABD\uAE00\uC774\uC5D0\uC694.", ["\uC800\uB294 \uD559\uAD50\uC5D0 \uAC00\uC694.", "\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694.", "\uBABD\uAE00\uC740 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?"], "b", "\u2018\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694\u2019\uB294 \uB0B4\uAC00 \uBABD\uAE00\uC774\uB77C\uB294 \uC18C\uAC1C\uC608\uC694.", transfer("\uC790\uAE30 \uC774\uB984\uC744 \uC18C\uAC1C\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uB0B4 \uC774\uB984\uC740 \uB9C8\uB9B0\uC774\uC5D0\uC694.", ["\uB9C8\uB9B0\uC740 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uC800\uB294 \uB9C8\uB9B0\uC774\uC5D0\uC694.", "\uB9C8\uB9B0\uC740 \uD559\uAD50\uC5D0 \uAC00\uC694."], "b", "\u2018\uC800\uB294 \uB9C8\uB9B0\uC774\uC5D0\uC694\u2019\uB294 \uC790\uAE30 \uC774\uB984\uC744 \uB9D0\uD558\uB294 \uC18C\uAC1C\uC608\uC694."))
      ]),
      lesson("greetings-story", "story", "\uC774\uB984\uD45C\uB97C \uCC3E\uC544\uC11C", "\uC774\uC57C\uAE30\uB97C \uC77D\uACE0 \uC778\uC0AC\uC640 \uC18C\uAC1C\uC758 \uB73B\uC744 \uD655\uC778\uD574\uC694.", greetingExpressions, [
        scene("narrator", "\uD55C\uAC15 \uB9C8\uB8E8\uC758 \uCCAB \uBAA8\uC784 \uB0A0\uC774\uC5D0\uC694. \uC785\uAD6C\uC5D0\uB294 \uC774\uB984\uD45C \uC138 \uC7A5\uC774 \uB193\uC5EC \uC788\uC5B4\uC694."),
        scene("mongle", "\uC6B0\uC640! \uC6B0\uB9AC \uC774\uB984\uC774 \uC788\uB124! \uAC19\uC774 \uC778\uC0AC\uBD80\uD130 \uD560\uAE4C?"),
        scene("mongle", "\uC548\uB155\uD558\uC138\uC694! \uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694!"),
        scene("kkamong", "\uC774 \uBAB8\uC758 \uC774\uB984\uD45C\uB294 \uB2F9\uC5F0\uD788 \uC81C\uC77C \uD070\u2026 \uC5B4, \uB0B4 \uC774\uB984\uD45C \uC5B4\uB514 \uAC14\uC9C0."),
        scene("narrator", "\uAE4C\uBABD\uC758 \uC774\uB984\uD45C\uAC00 \uAE4C\uBABD\uC758 \uB4A4\uC5D0 \uBD99\uC5B4 \uC788\uC5B4\uC694. \uB9C8\uB9B0\uC774 \uC870\uC2EC\uD788 \uB5BC\uC5B4 \uC918\uC694."),
        scene("marine", "\uC774\uB984\uD45C \uBC1C\uACAC. \uAE4C\uBABD. \uD655\uC778 \uC644\uB8CC."),
        scene("kkamong", "\uB0B4\uAC00 \uB4A4\uAE4C\uC9C0 \uBCFC \uC218 \uC788\uAC8C \uBD99\uC778 \uAC70\uC9C0. \u2026\uADF8\uB798\uB3C4 \uAC10\uC0AC\uD569\uB2C8\uB2E4."),
        scene("mongle", "\uC6B0\uC640! \uC774\uC81C \uC138 \uC774\uB984\uC774 \uB2E4 \uBCF4\uC5EC! \uAC19\uC774 \uC549\uC790!"),
        scene("marine", "\uC804\uC6D0 \uD655\uC778. \uC790\uB9AC, \uC14B. \u2026\uB124 \uC790\uB9AC\uB3C4 \uC5EC\uAE30\uB2E4.")
      ], [
        question("greetings-story-name", "greet-introduction", "greet-name", "\uCC98\uC74C\uC5D0 \u2018\uC800\uB294 \uBABD\uAE00\uC774\uC5D0\uC694\u2019\uB77C\uACE0 \uC18C\uAC1C\uD55C \uCE5C\uAD6C\uB294 \uB204\uAD6C\uC608\uC694?", "", ["\uAE4C\uBABD", "\uBABD\uAE00", "\uB9C8\uB9B0"], "b", "\uBABD\uAE00\uC774 \uC790\uAE30 \uC774\uB984\uC744 \uB9D0\uD558\uBA70 \uC778\uC0AC\uD588\uC5B4\uC694.", transfer("\u2018\uC800\uB294 \uAE4C\uBABD\uC774\uC5D0\uC694.\u2019\uB77C\uACE0 \uC4F4 \uC774\uB984\uD45C\uC758 \uC8FC\uC778\uC740 \uB204\uAD6C\uC608\uC694?", "\uC0C8 \uBAA8\uC784\uC758 \uC774\uB984\uD45C\uB97C \uC77D\uACE0 \uC788\uC5B4\uC694.", ["\uB9C8\uB9B0", "\uBABD\uAE00", "\uAE4C\uBABD"], "c", "\u2018\uC800\uB294 \uAE4C\uBABD\uC774\uC5D0\uC694\u2019\uC5D0\uC11C \uC18C\uAC1C\uD55C \uC774\uB984\uC740 \uAE4C\uBABD\uC774\uC5D0\uC694.")),
        question("greetings-story-thanks", "greet-gratitude", "greet-thanks", "\uAE4C\uBABD\uC774 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB77C\uACE0 \uD55C \uC774\uC720\uB294 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uB9C8\uB9B0\uC774 \uC774\uB984\uD45C\uB97C \uCC3E\uC544 \uC92C\uC5B4\uC694.", "\uBABD\uAE00\uC774 \uBA3C\uC800 \uC9D1\uC5D0 \uAC14\uC5B4\uC694.", "\uAE4C\uBABD\uC774 \uC790\uAE30 \uC774\uB984\uC744 \uC78A\uC5C8\uC5B4\uC694."], "a", "\uB9C8\uB9B0\uC774 \uB4A4\uC5D0 \uBD99\uC740 \uC774\uB984\uD45C\uB97C \uB5BC\uC5B4 \uC900 \uB3C4\uC6C0\uC5D0 \uACE0\uB9C8\uC6C0\uC744 \uC804\uD588\uC5B4\uC694.", transfer("\uBABD\uAE00\uC774 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB77C\uACE0 \uD588\uC5B4\uC694. \uC5B4\uB5A4 \uC77C\uC774 \uC788\uC5C8\uC744\uAE4C\uC694?", "\uB9C8\uB9B0\uC774 \uBABD\uAE00\uC5D0\uAC8C \uB5A8\uC5B4\uC9C4 \uC774\uB984\uD45C\uB97C \uAC74\uB124\uC92C\uC5B4\uC694.", ["\uB9C8\uB9B0\uC774 \uC774\uB984\uD45C\uB97C \uCC3E\uC544 \uC92C\uC5B4\uC694.", "\uB9C8\uB9B0\uC774 \uC790\uAE30 \uC774\uB984\uC744 \uC18C\uAC1C\uD588\uC5B4\uC694.", "\uB9C8\uB9B0\uC774 \uBAA8\uC784 \uC2DC\uAC04\uC744 \uBB3C\uC5C8\uC5B4\uC694."], "a", "\uC774\uB984\uD45C\uB97C \uAC74\uB124\uC900 \uB3C4\uC6C0\uC744 \uBC1B\uC544\uC11C \uACE0\uB9C8\uC6C0\uC744 \uC804\uD588\uC5B4\uC694.")),
        question("greetings-story-hello", "greet-response", "greet-hello", "\uBAA8\uC784\uC5D0\uC11C \uCC98\uC74C \uB9CC\uB09C \uC0AC\uB78C\uC5D0\uAC8C \uBA3C\uC800 \uD560 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uC798 \uBA39\uACA0\uC2B5\uB2C8\uB2E4.", "\uB2E4\uB140\uC654\uC2B5\uB2C8\uB2E4.", "\uC548\uB155\uD558\uC138\uC694."], "c", "\uBAA8\uC784\uC5D0\uC11C \uCC98\uC74C \uB9CC\uB09C \uC0AC\uB78C\uC5D0\uAC8C\uB294 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uB77C\uACE0 \uC778\uC0AC\uD574\uC694.", transfer("\uC0C8 \uB3D9\uC544\uB9AC\uC5D0\uC11C \uCC98\uC74C \uB9CC\uB09C \uCE5C\uAD6C\uC5D0\uAC8C \uC815\uC911\uD558\uAC8C \uC778\uC0AC\uD574\uC694.", "\uC9C0\uAE08\uC740 \uC2DD\uC0AC\uD558\uAC70\uB098 \uC678\uCD9C\uD588\uB2E4 \uB3CC\uC544\uC628 \uC0C1\uD669\uC774 \uC544\uB2C8\uC5D0\uC694.", ["\uC548\uB155\uD558\uC138\uC694.", "\uC798 \uBA39\uACA0\uC2B5\uB2C8\uB2E4.", "\uB2E4\uB140\uC654\uC2B5\uB2C8\uB2E4."], "a", "\uCC98\uC74C \uB9CC\uB09C \uC790\uB9AC\uC758 \uC778\uC0AC\uB294 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uC608\uC694."))
      ]),
      lesson("greetings-apply", "apply", "\uB0B4 \uCCAB \uBAA8\uC784", "\uC0C8\uB85C\uC6B4 \uB9CC\uB0A8\uC5D0\uC11C \uD544\uC694\uD55C \uB9D0\uC744 \uC9C1\uC811 \uACE8\uB77C\uC694.", greetingExpressions, [
        scene("mongle", "\uC624! \uC774\uBC88\uC5D0\uB294 \uB124 \uCC28\uB840\uC57C! \uAC19\uC774 \uCCAB \uC778\uC0AC \uD574 \uBCFC\uAE4C?"),
        scene("kkamong", "\uB0B4 \uCCAB \uBAA8\uC784\uC740 \uC644\uBCBD\uD588\uC9C0. \uC774\uB984\uD45C\uAC00 \uB4A4\uC5D0 \uBD99\uC740 \uAC83\uB9CC \uBE7C\uBA74."),
        scene("marine", "\uC0C1\uD669 \uD655\uC778. \uC0C1\uB300\uC5D0\uAC8C \uC804\uD560 \uB9D0\uC744 \uC120\uD0DD\uD558\uB77C.")
      ], [
        question("greetings-apply-introduction", "greet-introduction", "greet-name", "\uC774\uB984\uC744 \uBB3B\uB294 \uB9D0\uC5D0 \uB2F5\uD574\uC694.", "\u201C\uC774\uB984\uC774 \uBB50\uC608\uC694?\u201D \uB0B4 \uC774\uB984\uC740 \uC218\uC9C4\uC774\uC5D0\uC694.", ["\uD559\uAD50\uC5D0 \uC788\uC5B4\uC694.", "\uC800\uB294 \uC218\uC9C4\uC774\uC5D0\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "b", "\uC774\uB984\uC744 \uBB3C\uC5C8\uC73C\uBBC0\uB85C \u2018\uC800\uB294 \uC218\uC9C4\uC774\uC5D0\uC694\u2019\uB77C\uACE0 \uC18C\uAC1C\uD574\uC694.", transfer("\uC774\uB984\uC744 \uBB3B\uB294 \uB9D0\uC5D0 \uB2F5\uD574\uC694.", "\u201C\uC131\uD568\uC774 \uC5B4\uB5BB\uAC8C \uB418\uC138\uC694?\u201D \uB0B4 \uC774\uB984\uC740 \uC9C0\uD6C8\uC774\uC5D0\uC694.", ["\uC800\uB294 \uC9C0\uD6C8\uC774\uC5D0\uC694.", "\uC9C0\uD6C8\uC740 \uC9D1\uC5D0 \uC788\uC5B4\uC694.", "\uC548\uB155\uD558\uC138\uC694."], "a", "\u2018\uC131\uD568\u2019\uC740 \uC774\uB984\uC744 \uB192\uC5EC \uB9D0\uD55C \uD45C\uD604\uC774\uC5D0\uC694. \uC790\uAE30 \uC774\uB984\uC744 \uB2F5\uD574\uC694.")),
        question("greetings-apply-thanks", "greet-gratitude", "greet-thanks", "\uD544\uC694\uD55C \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uCC98\uC74C \uC628 \uD559\uAD50\uC5D0\uC11C \uC9C1\uC6D0\uC774 \uAD50\uC2E4 \uC704\uCE58\uB97C \uC54C\uB824 \uC92C\uC5B4\uC694. \uACE0\uB9C8\uC6C0\uC744 \uC804\uD558\uB824\uACE0 \uD574\uC694.", ["\uC800\uB294 \uD559\uC0DD\uC774\uC5D0\uC694.", "\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "c", "\uC704\uCE58\uB97C \uC54C\uB824 \uC900 \uB3C4\uC6C0\uC5D0 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uB77C\uACE0 \uD574\uC694.", transfer("\uC9C0\uAE08 \uD544\uC694\uD55C \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uCE74\uD398 \uC9C1\uC6D0\uC774 \uB450\uACE0 \uC628 \uAC00\uBC29\uC744 \uCC3E\uC544 \uC92C\uC5B4\uC694. \uB3C4\uC6C0\uC5D0 \uACE0\uB9C8\uC6C0\uC744 \uC804\uD558\uB824\uACE0 \uD574\uC694.", ["\uC548\uB155\uD558\uC138\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uC800\uB294 \uB9C8\uB9B0\uC774\uC5D0\uC694."], "b", "\uAC00\uBC29\uC744 \uCC3E\uC544 \uC900 \uB3C4\uC6C0\uC5D0 \uACE0\uB9C8\uC6C0\uC744 \uC804\uD558\uB294 \uB9D0\uC740 \u2018\uAC10\uC0AC\uD569\uB2C8\uB2E4\u2019\uC608\uC694.")),
        question("greetings-apply-hello", "greet-response", "greet-hello", "\uAD50\uC2E4 \uBB38\uC744 \uC5F4\uACE0 \uCC98\uC74C \uB9CC\uB09C \uC120\uC0DD\uB2D8\uC5D0\uAC8C \uB9D0\uD574\uC694.", "\uC544\uC9C1 \uB300\uD654\uB97C \uC2DC\uC791\uD558\uAE30 \uC804\uC774\uC5D0\uC694.", ["\uC548\uB155\uD558\uC138\uC694.", "\uC800\uB294 \uC2DD\uC0AC\uD588\uC5B4\uC694.", "\uAC10\uC0AC\uD569\uB2C8\uB2E4."], "a", "\uB300\uD654\uB97C \uC2DC\uC791\uD558\uAE30 \uC804\uC5D0 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uB85C \uC815\uC911\uD558\uAC8C \uC778\uC0AC\uD574\uC694.", transfer("\uCC98\uC74C \uBC29\uBB38\uD55C \uAC00\uAC8C\uC758 \uC9C1\uC6D0\uC5D0\uAC8C \uB9D0\uC744 \uC2DC\uC791\uD574\uC694.", "\uC544\uC9C1 \uC0C1\uD488\uC744 \uACE0\uB974\uAC70\uB098 \uB3C4\uC6C0\uC744 \uBC1B\uAE30 \uC804\uC774\uC5D0\uC694.", ["\uAC10\uC0AC\uD569\uB2C8\uB2E4.", "\uC798 \uBA39\uACA0\uC2B5\uB2C8\uB2E4.", "\uC548\uB155\uD558\uC138\uC694."], "c", "\uCC98\uC74C \uB300\uD654\uB97C \uC2DC\uC791\uD560 \uB54C \uC815\uC911\uD55C \uC778\uC0AC\uB294 \u2018\uC548\uB155\uD558\uC138\uC694\u2019\uC608\uC694."))
      ])
    ]
  },
  {
    id: "cafe",
    title: "\uAD6C\uB984 \uD55C \uC794, \uCE74\uD398",
    subtitle: "\uC8FC\uBB38\uD558\uACE0 \uB9C8\uC2E4 \uACF3\uC744 \uC815\uD574\uC694",
    icon: "cafe",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("cafe-order-detail", "\uC74C\uB8CC\uC640 \uC218\uB7C9 \uC774\uD574\uD558\uAE30"), skill("cafe-place", "\uB9C8\uC2E4 \uC7A5\uC18C \uAD6C\uBD84\uD558\uAE30"), skill("cafe-takeout-request", "\uD3EC\uC7A5 \uC694\uCCAD\uD558\uAE30"), skill("cafe-preference-reading", "\uCE5C\uAD6C\uC758 \uCDE8\uD5A5 \uC774\uD574\uD558\uAE30"), skill("cafe-availability", "\uD488\uC808\uACFC \uC8FC\uBB38 \uAC00\uB2A5 \uC548\uB0B4 \uC77D\uAE30"), skill("cafe-order-change", "\uC8FC\uBB38 \uBCC0\uACBD \uC774\uD574\uD558\uAE30"), skill("cafe-compose-order", "\uC8FC\uBB38 \uBB38\uC7A5 \uAD6C\uC131\uD558\uAE30")],
    lessons: [
      lesson("cafe-expressions", "expressions", "\uCE74\uD398\uC5D0\uC11C \uD558\uB294 \uB9D0", "\uC8FC\uBB38\xB7\uB9E4\uC7A5 \uC774\uC6A9\xB7\uD3EC\uC7A5 \uD45C\uD604\uC744 \uAD6C\uBD84\uD574\uC694.", cafeExpressions, [
        scene("mongle", "\uC6B0\uC640! \uCC28 \uC704\uC5D0 \uC791\uC740 \uAD6C\uB984\uC774 \uC788\uC5B4! \uAC19\uC774 \uC8FC\uBB38\uD574 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uCC28\uC758 \uC628\uB3C4\uB3C4 \uC815\uD558\uC9C0. \uB728\uAC81\u2026 \uC544\uB2C8, \uB530\uB73B\uD55C \uAC78\uB85C."),
        scene("marine", "\uC8FC\uBB38 \uC900\uBE44. \uC74C\uB8CC, \uC218\uB7C9, \uB9C8\uC2E4 \uC7A5\uC18C \uD655\uC778.")
      ], [
        question("cafe-expressions-order", "cafe-order-detail", "cafe-order", "\uC8FC\uBB38\uC5D0 \uB9DE\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\u201C\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.\u201D", ["\uCC28\uAC00\uC6B4 \uCC28 \uB450 \uC794", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794", "\uB530\uB73B\uD55C \uBB3C \uC138 \uC794"], "b", "\u2018\uB530\uB73B\uD55C \uCC28\u2019\uAC00 \uC885\uB958\uC640 \uC628\uB3C4\uC774\uACE0 \u2018\uD55C \uC794\u2019\uC774 \uC218\uB7C9\uC774\uC5D0\uC694.", transfer("\uC8FC\uBB38\uC5D0 \uB9DE\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\u201C\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794 \uC8FC\uC138\uC694.\u201D", ["\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794", "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794", "\uCC28\uAC00\uC6B4 \uCC28 \uD55C \uC794"], "a", "\uC8FC\uC2A4\xB7\uCC28\uAC00\uC6B4 \uC628\uB3C4\xB7\uB450 \uC794\uC744 \uBAA8\uB450 \uD655\uC778\uD574\uC694.")),
        question("cafe-expressions-here", "cafe-place", "cafe-here", "\u2018\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694\u2019\uB294 \uBB34\uC2A8 \uB73B\uC774\uC5D0\uC694?", "\uCE74\uD398 \uC9C1\uC6D0\uC774 \uB9C8\uC2E4 \uC7A5\uC18C\uB97C \uBB3C\uC5C8\uC5B4\uC694.", ["\uBC16\uC73C\uB85C \uAC00\uC838\uAC08\uAC8C\uC694.", "\uC74C\uB8CC\uB97C \uC8FC\uBB38\uD558\uC9C0 \uC54A\uC744\uAC8C\uC694.", "\uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "c", "\uCE74\uD398\uC5D0\uC11C \uB9D0\uD55C \u2018\uC5EC\uAE30\uC11C\u2019\uB294 \uADF8 \uCE74\uD398 \uC548\uC744 \uAC00\uB9AC\uCF1C\uC694.", transfer("\u2018\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694\u2019\uB294 \uBB34\uC2A8 \uB73B\uC774\uC5D0\uC694?", "\uC9C1\uC6D0\uC774 \uD3EC\uC7A5\uD560\uC9C0 \uBB3C\uC5C8\uC5B4\uC694.", ["\uC9D1\uC73C\uB85C \uAC00\uC838\uAC08\uAC8C\uC694.", "\uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCEF5\uC744 \uB3CC\uB824\uB4DC\uB9B4\uAC8C\uC694."], "b", "\u2018\uB9E4\uC7A5\uC5D0\uC11C\u2019\uB294 \uAC00\uAC8C \uC548\uC5D0\uC11C \uC774\uC6A9\uD558\uACA0\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.")),
        question("cafe-expressions-takeout", "cafe-takeout-request", "cafe-takeout", "\uC74C\uB8CC\uB97C \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uACE0 \uC2F6\uC5B4\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uB530\uB73B\uD558\uAC8C \uB9C8\uC2E4\uAC8C\uC694."], "a", "\uC74C\uB8CC\uB97C \uAC00\uC838\uAC08 \uB54C\uB294 \u2018\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694\u2019\uB77C\uACE0 \uC694\uCCAD\uD574\uC694.", transfer("\uC8FC\uC2A4\uB97C \uC9D1\uC5D0 \uAC00\uC838\uAC00\uB824\uACE0 \uD574\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC798 \uB9C8\uC168\uC2B5\uB2C8\uB2E4.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694."], "c", "\uC9D1\uC5D0 \uAC00\uC838\uAC00\uB824\uBA74 \uD3EC\uC7A5\uC744 \uC694\uCCAD\uD574\uC694."))
      ]),
      lesson("cafe-story", "story", "\uAD6C\uB984\uC744 \uAC00\uC838\uAC08 \uC218 \uC788\uC744\uAE4C?", "\uC138 \uCE5C\uAD6C\uC758 \uC8FC\uBB38\uACFC \uC7A5\uC18C \uBCC0\uACBD\uC744 \uC774\uD574\uD574\uC694.", cafeExpressions, [
        scene("narrator", "\uC138 \uCE5C\uAD6C\uAC00 \uAC15\uAC00\uC758 \uCE74\uD398\uC5D0 \uB4E4\uC5B4\uC654\uC5B4\uC694. \uCC3D\uAC00\uC5D0\uB294 \uC791\uC740 \uD654\uBD84\uC774 \uC788\uC5B4\uC694."),
        scene("mongle", "\uC6B0\uC640! \uCEF5\uC5D0\uC11C \uAD6C\uB984\uC774 \uB098\uC640! \uAC19\uC774 \uB530\uB73B\uD55C \uCC28 \uB9C8\uC2E4\uAE4C?"),
        scene("kkamong", "\uCC28 \uC8FC\uBB38\uC740 \uC774 \uBAB8\uC5D0\uAC8C \uB9E1\uACA8. \u2018\uB530\uB73B\uD55C \uCC28 \uC138 \uC794 \uC8FC\uC138\uC694.\u2019"),
        scene("marine", "\uC218\uB7C9 \uD655\uC778. \uC14B, \uC138 \uC794. \uCC3D\uAC00 \uC790\uB9AC \uD655\uC778."),
        scene("narrator", "\uCC98\uC74C\uC5D0\uB294 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694. \uC8FC\uBB38\uD45C\uC5D0\uB294 \u2018\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694\u2019\uB77C\uACE0 \uC801\uC5B4\uC694."),
        scene("mongle", "\uC5B4? \uBC16\uC5D0 \uC791\uC740 \uC0C8\uAC00 \uC788\uB124! \uAC19\uC774 \uAC15\uAC00 \uBCA4\uCE58\uB85C \uAC08\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uB3C4 \uC6D0\uB798 \uBC16\uC5D0\uC11C \uB9C8\uC2DC\uB824\uB358 \uAC70\uC9C0. \uC0C8\uB97C \uBCF4\uB7EC \uAC00\uB294 \uAC74\u2026 \uC870\uAE08\uB9CC."),
        scene("narrator", "\uCE5C\uAD6C\uB4E4\uC740 \uCC28\uB97C \uAC00\uC838\uAC00\uAE30\uB85C \uBC14\uAFD4\uC694. \uC9C1\uC6D0\uC5D0\uAC8C \u2018\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694\u2019\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694."),
        scene("marine", "\uC7A5\uC18C \uBCC0\uACBD \uD655\uC778. \uBCA4\uCE58, \uC138 \uC790\uB9AC. \u2026\uB124 \uCEF5\uC740 \uC5EC\uAE30\uB2E4."),
        scene("mongle", "\uC624! \uCEF5\uC740 \uAC00\uC838\uC654\uB294\uB370 \uAD6C\uB984\uC740 \uC704\uB85C \uAC00\uB124! \uAC19\uC774 \uCC9C\uCC9C\uD788 \uB9C8\uC2DC\uC790!")
      ], [
        question("cafe-story-order", "cafe-order-detail", "cafe-order", "\uAE4C\uBABD\uC774 \uC8FC\uBB38\uD55C \uAC83\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uB530\uB73B\uD55C \uCC28 \uC138 \uC794", "\uCC28\uAC00\uC6B4 \uBB3C \uC138 \uC794", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794"], "a", "\uC774\uC57C\uAE30\uC5D0\uC11C \uAE4C\uBABD\uC740 \uCE5C\uAD6C \uC14B\uC774 \uB9C8\uC2E4 \uB530\uB73B\uD55C \uCC28 \uC138 \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694.", transfer("\uC8FC\uBB38\uD45C\uC5D0 \uB9DE\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\uC0C8 \uC8FC\uBB38\uD45C: \u201C\uB530\uB73B\uD55C \uC6B0\uC720 \uB450 \uC794 \uC8FC\uC138\uC694.\u201D", ["\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uB450 \uC794", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794", "\uB530\uB73B\uD55C \uC6B0\uC720 \uB450 \uC794"], "c", "\uC6B0\uC720\xB7\uB530\uB73B\uD55C \uC628\uB3C4\xB7\uB450 \uC794\uC744 \uBAA8\uB450 \uC77D\uC5B4\uC57C \uD574\uC694.")),
        question("cafe-story-here", "cafe-place", "cafe-here", "\u2018\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694\u2019\uB77C\uACE0 \uC801\uC5C8\uC744 \uB54C\uB294 \uC5B4\uB514\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD588\uC5B4\uC694?", "", ["\uAC15\uAC00 \uBCA4\uCE58", "\uCE74\uD398 \uC548", "\uCE5C\uAD6C\uC758 \uC9D1"], "b", "\uCC98\uC74C \uC8FC\uBB38\uD45C\uC758 \u2018\uC5EC\uAE30\uC11C\u2019\uB294 \uCE74\uD398 \uC548\uC744 \uB73B\uD574\uC694.", transfer("\uC8FC\uBB38\uD45C\uB97C \uC77D\uACE0 \uB9C8\uC2E4 \uC7A5\uC18C\uB97C \uACE8\uB77C\uC694.", "\u201C\uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694. \uCC3D\uAC00\uC5D0 \uC549\uC744\uAC8C\uC694.\u201D", ["\uCE74\uD398 \uCC3D\uAC00", "\uAC15\uAC00 \uBCA4\uCE58", "\uC9D1\uC758 \uCC3D\uAC00"], "a", "\u2018\uCE74\uD398 \uC548\u2019\uACFC \u2018\uCC3D\uAC00\u2019\uB97C \uD568\uAED8 \uD655\uC778\uD574\uC694.")),
        question("cafe-story-takeout", "cafe-takeout-request", "cafe-takeout", "\uBC16\uC758 \uBCA4\uCE58\uB85C \uAC00\uAE30 \uC804\uC5D0 \uC9C1\uC6D0\uC5D0\uAC8C \uBD80\uD0C1\uD55C \uB9D0\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCC28\uB294 \uC548 \uB9C8\uC2E4\uAC8C\uC694.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694."], "c", "\uCE5C\uAD6C\uB4E4\uC740 \uCC28\uB97C \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uAE30 \uC704\uD574 \uD3EC\uC7A5\uC744 \uC694\uCCAD\uD588\uC5B4\uC694.", transfer("\uC0C8 \uC7A5\uBA74\uC5D0\uC11C \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "\uBE44\uAC00 \uADF8\uCCE4\uC5B4\uC694. \uC74C\uB8CC\uB97C \uAC00\uC9C0\uACE0 \uACF5\uC6D0\uC73C\uB85C \uAC00\uB824\uACE0 \uD574\uC694.", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCEF5\uC744 \uBE44\uC6CC \uC8FC\uC138\uC694."], "a", "\uC74C\uB8CC\uB97C \uBC16\uC758 \uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC00\uB824\uBA74 \uD3EC\uC7A5\uC744 \uC694\uCCAD\uD574\uC694."))
      ]),
      lesson("cafe-apply", "apply", "\uB0B4 \uC74C\uB8CC\uB97C \uC8FC\uBB38\uD574\uC694", "\uB2E4\uB978 \uC74C\uB8CC\uC640 \uC7A5\uC18C\uC5D0\uC11C\uB3C4 \uBC30\uC6B4 \uD45C\uD604\uC744 \uC0AC\uC6A9\uD574\uC694.", cafeExpressions, [
        scene("mongle", "\uC624! \uC774\uBC88\uC5D0\uB294 \uC5B4\uB5A4 \uC74C\uB8CC\uC57C? \uAC19\uC774 \uC8FC\uBB38\uD574 \uBCF4\uC790!"),
        scene("kkamong", "\uB0B4\uAC00 \uC54C\uB824 \uC900 \uC8FC\uBB38\uBC95\uC774\uC57C. \uC628\uB3C4\uB791 \uC218\uB97C \uB193\uCE58\uBA74 \uB0B4 \uCEF5\uC774 \uB450 \uAC1C\uAC00 \uB418\uC9C0."),
        scene("marine", "\uC8FC\uBB38 \uD655\uC778. \uD544\uC694\uD55C \uC815\uBCF4\uBD80\uD130 \uC120\uD0DD\uD558\uB77C.")
      ], [
        question("cafe-apply-order", "cafe-order-detail", "cafe-order", "\uC6D0\uD558\uB294 \uC8FC\uBB38\uC744 \uACE8\uB77C\uC694.", "\uCE5C\uAD6C\uC640 \uB458\uC774 \uB9C8\uC2E4 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB97C \uD55C \uC794\uC529 \uC8FC\uBB38\uD574\uC694.", ["\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uB450 \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794 \uC8FC\uC138\uC694."], "b", "\uB458\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uBBC0\uB85C \uB450 \uC794\uC774\uACE0, \uC6D0\uD558\uB294 \uC628\uB3C4\uB294 \uCC28\uAC00\uC6B4 \uC628\uB3C4\uC608\uC694.", transfer("\uC6D0\uD558\uB294 \uC8FC\uBB38\uC744 \uACE8\uB77C\uC694.", "\uD63C\uC790 \uB9C8\uC2E4 \uB530\uB73B\uD55C \uC6B0\uC720 \uD55C \uC794\uC744 \uC8FC\uBB38\uD574\uC694.", ["\uB530\uB73B\uD55C \uC6B0\uC720 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694."], "a", "\uC6B0\uC720\xB7\uB530\uB73B\uD55C \uC628\uB3C4\xB7\uD55C \uC794\uC5D0 \uB9DE\uB294 \uC8FC\uBB38\uC744 \uC120\uD0DD\uD574\uC694.")),
        question("cafe-apply-here", "cafe-place", "cafe-here", "\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\u201C\uAC00\uC838\uAC00\uC2E4 \uAC74\uAC00\uC694?\u201D \uCE74\uD398 \uC548\uC758 \uD14C\uC774\uBE14\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC544\uC9C1 \uC548 \uB9C8\uC168\uC5B4\uC694.", "\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "c", "\uD14C\uC774\uBE14\uC5D0\uC11C \uB9C8\uC2DC\uBBC0\uB85C \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E0\uB2E4\uACE0 \uB2F5\uD574\uC694.", transfer("\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\u201C\uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2DC\uB098\uC694?\u201D \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.", ["\uC544\uB2C8\uC694, \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uB124, \uC9D1\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "b", "\u2018\uB9E4\uC7A5\uC5D0\uC11C\u2019\uB77C\uB294 \uC9C8\uBB38\uC5D0 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2E0\uB2E4\uACE0 \uB2F5\uD574\uC694.")),
        question("cafe-apply-takeout", "cafe-takeout-request", "cafe-takeout", "\uC0C1\uD669\uC5D0 \uB9DE\uB294 \uBD80\uD0C1\uC744 \uACE8\uB77C\uC694.", "\uC8FC\uBB38\uD55C \uCC28\uB97C \uAC00\uC9C0\uACE0 \uD559\uAD50\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694.", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "a", "\uCC28\uB97C \uB2E4\uB978 \uC7A5\uC18C\uB85C \uAC00\uC838\uAC00\uBBC0\uB85C \uD3EC\uC7A5\uC744 \uC694\uCCAD\uD574\uC694.", transfer("\uC0C1\uD669\uC5D0 \uB9DE\uB294 \uBD80\uD0C1\uC744 \uACE8\uB77C\uC694.", "\uCE5C\uAD6C \uC9D1\uC5D0\uC11C \uD568\uAED8 \uB9C8\uC2E4 \uC8FC\uC2A4\uB97C \uCE74\uD398\uC5D0\uC11C \uC0C0\uC5B4\uC694.", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uCEF5\uC740 \uD544\uC694 \uC5C6\uC5B4\uC694.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694."], "c", "\uCE5C\uAD6C \uC9D1\uC73C\uB85C \uAC00\uC838\uAC08 \uC8FC\uC2A4\uC774\uBBC0\uB85C \uD3EC\uC7A5\uC774 \uD544\uC694\uD574\uC694."))
      ]),
      lesson("cafe-visit-taste", "visit", "\uAE4C\uBABD\uC758 \uB530\uB73B\uD55C \uD55C \uC794", "\uCE5C\uAD6C\uC758 \uCDE8\uD5A5\uC744 \uC77D\uACE0 \uD568\uAED8 \uB9C8\uC2E4 \uC74C\uB8CC\uB97C \uC8FC\uBB38\uD574\uC694.", cafeTasteExpressions, [
        scene("narrator", "\uBE44 \uC624\uB294 \uC544\uCE68, \uC138 \uCE5C\uAD6C\uAC00 \uCE74\uD398\uC5D0 \uB2E4\uC2DC \uC654\uC5B4\uC694."),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBE44\uBC14\uB78C\uB3C4 \uB044\uB5A1\uC5C6\uC9C0. \u2026\uC624\uB298\uC740 \uB530\uB73B\uD55C \uCC28\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uAD70."),
        scene("mongle", "\uC624! \uC624\uB298\uC740 \uAE4C\uBABD\uC774 \uC88B\uC544\uD558\uB294 \uAC78\uB85C \uAC19\uC774 \uB9C8\uC154 \uBCFC\uAE4C?"),
        scene("marine", "\uCDE8\uD5A5 \uD655\uC778. \uB530\uB73B\uD55C \uCC28. \uD568\uAED8 \uB9C8\uC2E4 \uC0AC\uB78C, \uB458.")
      ], [
        question("cafe-visit-taste-drink", "cafe-preference-reading", "cafe-preference", "\uAE4C\uBABD\uC774 \uC6D0\uD558\uB294 \uC74C\uB8CC\uB97C \uC8FC\uBB38\uD574\uC694.", "\uAE4C\uBABD: \u201C\uB530\uB73B\uD55C \uCC28\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uAD70.\u201D", ["\uB530\uB73B\uD55C \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694."], "b", "\uAE4C\uBABD\uC774 \uC6D0\uD558\uB294 \uC885\uB958\uB294 \uCC28\uC774\uACE0 \uC628\uB3C4\uB294 \uB530\uB73B\uD55C \uC628\uB3C4\uC608\uC694. \uC8FC\uC2A4\uB098 \uCC28\uAC00\uC6B4 \uC74C\uB8CC\uC640 \uAD6C\uBD84\uD574\uC694.", transfer("\uBABD\uAE00\uC774 \uC6D0\uD558\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\uBABD\uAE00: \u201C\uC624\uB298\uC740 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uAC00 \uB9C8\uC2DC\uACE0 \uC2F6\uC5B4!\u201D", ["\uB530\uB73B\uD55C \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694."], "c", "\uBABD\uAE00\uC758 \uC0C8 \uCDE8\uD5A5\uC740 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uC608\uC694. \uC6D0\uD558\uB294 \uC885\uB958\uC640 \uC628\uB3C4\uB97C \uD568\uAED8 \uC77D\uC5B4\uC694.")),
        question("cafe-visit-taste-count", "cafe-order-detail", "cafe-order", "\uB458\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uB824\uBA74 \uC5B4\uB5BB\uAC8C \uB9D0\uD560\uAE4C\uC694?", "\uAE4C\uBABD\uACFC \uB0B4\uAC00 \uB530\uB73B\uD55C \uCC28\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694.", ["\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uC138 \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694."], "c", "\uAE4C\uBABD \uD55C \uC794\uACFC \uB0B4 \uD55C \uC794\uC744 \uD569\uD558\uBA74 \uB450 \uC794\uC774\uC5D0\uC694.", transfer("\uD568\uAED8 \uB9C8\uC2E4 \uC218\uB7C9\uC744 \uC8FC\uBB38\uD574\uC694.", "\uBABD\uAE00\xB7\uAE4C\uBABD\xB7\uB9C8\uB9B0\uC774 \uCC28\uAC00\uC6B4 \uC6B0\uC720\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694.", ["\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uB450 \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uC138 \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uC6B0\uC720 \uC138 \uC794 \uC8FC\uC138\uC694."], "b", "\uC138 \uC0AC\uB78C\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uBA74 \uC138 \uC794\uC774\uACE0 \uC6D0\uD558\uB294 \uC74C\uB8CC\uB294 \uCC28\uAC00\uC6B4 \uC6B0\uC720\uC608\uC694.")),
        question("cafe-visit-taste-place", "cafe-place", "cafe-here", "\uC9C1\uC6D0\uC5D0\uAC8C \uB9C8\uC2E4 \uACF3\uC744 \uC54C\uB824 \uC8FC\uC138\uC694.", "\uBE44\uAC00 \uADF8\uCE60 \uB54C\uAE4C\uC9C0 \uCE74\uD398 \uC548\uC5D0\uC11C \uB530\uB73B\uD55C \uCC28\uB97C \uB9C8\uC2DC\uBA70 \uC26C\uC5B4\uC694.", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "a", "\uCE74\uD398 \uC548\uC5D0\uC11C \uC26C\uBA74\uC11C \uB9C8\uC2DC\uBBC0\uB85C \uB9E4\uC7A5 \uC774\uC6A9\uC744 \uB9D0\uD574\uC694.", transfer("\uC774\uBC88\uC5D0\uB294 \uC5B4\uB514\uC5D0\uC11C \uB9C8\uC2E4\uAE4C\uC694?", "\uBABD\uAE00\uC774 \uC8FC\uC2A4\uB97C \uAC00\uC9C0\uACE0 \uC9D1\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694. \uC9C1\uC6D0: \u201C\uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2DC\uB098\uC694?\u201D", ["\uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC544\uB2C8\uC694, \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uB124, \uCC3D\uAC00\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "b", "\uC0C8 \uC7A5\uBA74\uC740 \uC9D1\uC5D0 \uAC00\uC838\uAC00\uB294 \uC8FC\uBB38\uC774\uC5D0\uC694. \uB9E4\uC7A5 \uC774\uC6A9 \uB300\uC2E0 \uD3EC\uC7A5\uC744 \uBD80\uD0C1\uD574\uC694."))
      ]),
      lesson("cafe-visit-soldout", "visit", "\uC8FC\uC2A4\uAC00 \uC5C6\uB294 \uB0A0", "\uD488\uC808 \uC548\uB0B4\uB97C \uC77D\uACE0 \uAC00\uB2A5\uD55C \uC74C\uB8CC\uB85C \uC8FC\uBB38\uC744 \uC774\uC5B4\uAC00\uC694.", cafeSoldoutExpressions, [
        scene("narrator", "\uCE74\uD398\uC758 \uC791\uC740 \uC548\uB0B4\uD310: \u201C\uC624\uB298 \uC8FC\uC2A4 \uD488\uC808. \uB530\uB73B\uD55C \uCC28\uB294 \uC8FC\uBB38\uD560 \uC218 \uC788\uC5B4\uC694.\u201D"),
        scene("mongle", "\uC5B4? \uC8FC\uC2A4\uAC00 \uB2E4 \uB098\uAC14\uB124! \uAC19\uC774 \uB2E4\uB978 \uC74C\uB8CC\uB97C \uCC3E\uC544\uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uCC28\uB3C4 \uC798 \uACE0\uB974\uC9C0. \uC6D0\uB798 \uCC28\uB97C \uB9C8\uC2E4 \uC0DD\uAC01\uB3C4\u2026 \uC788\uC5C8\uC5B4."),
        scene("marine", "\uC8FC\uBB38 \uAC00\uB2A5 \uD655\uC778. \uB530\uB73B\uD55C \uCC28. \uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC08 \uD55C \uC794.")
      ], [
        question("cafe-visit-soldout-menu", "cafe-availability", "cafe-soldout", "\uC9C0\uAE08 \uC8FC\uBB38\uD560 \uC218 \uC788\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\uC624\uB298 \uC8FC\uC2A4 \uD488\uC808. \uB530\uB73B\uD55C \uCC28\uB294 \uC8FC\uBB38\uD560 \uC218 \uC788\uC5B4\uC694.", ["\uB530\uB73B\uD55C \uCC28 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694."], "a", "\uC8FC\uC2A4\uB294 \uD488\uC808\uC774\uB77C \uC628\uB3C4\uB97C \uBC14\uAFB8\uC5B4\uB3C4 \uC8FC\uBB38\uD560 \uC218 \uC5C6\uC5B4\uC694. \uAC00\uB2A5\uD55C \uC74C\uB8CC\uB294 \uB530\uB73B\uD55C \uCC28\uC608\uC694.", transfer("\uC0C8 \uC548\uB0B4\uD310\uC5D0\uC11C \uC8FC\uBB38\uD560 \uC218 \uC788\uB294 \uC74C\uB8CC\uB97C \uACE8\uB77C\uC694.", "\uC624\uB298 \uC6B0\uC720 \uD488\uC808. \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB294 \uC8FC\uBB38\uD560 \uC218 \uC788\uC5B4\uC694.", ["\uB530\uB73B\uD55C \uC6B0\uC720 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC6B0\uC720 \uD55C \uC794 \uC8FC\uC138\uC694."], "b", "\uC774\uBC88\uC5D0\uB294 \uC6B0\uC720\uAC00 \uD488\uC808\uC774\uACE0 \uC8FC\uC2A4\uB294 \uC8FC\uBB38\uD560 \uC218 \uC788\uC5B4\uC694. \uC0C8 \uC548\uB0B4\uB97C \uC77D\uACE0 \uACE8\uB77C\uC694.")),
        question("cafe-visit-soldout-count", "cafe-order-detail", "cafe-order", "\uC9C1\uC6D0\uC774 \uC218\uB7C9\uC744 \uB2E4\uC2DC \uBB3C\uC5B4\uC694. \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\uD63C\uC790 \uB9C8\uC2E4 \uD55C \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uC9C1\uC6D0: \u201C\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uB9DE\uC73C\uC2DC\uC8E0?\u201D", ["\uC138 \uC794 \uC8FC\uC138\uC694.", "\uB124, \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uD55C \uC794 \uC8FC\uC138\uC694."], "c", "\uD544\uC694\uD55C \uAC83\uC740 \uD55C \uC794\uC774\uC5D0\uC694. \uC9C1\uC6D0\uC758 \uB450 \uC794 \uD655\uC778\uC5D0 \uC544\uB2C8\uC694\uB77C\uACE0 \uB2F5\uD558\uACE0 \uD55C \uC794\uC744 \uB9D0\uD574\uC694.", transfer("\uC0C8 \uC8FC\uBB38\uC758 \uC218\uB7C9\uC744 \uB2E4\uC2DC \uC54C\uB824 \uC8FC\uC138\uC694.", "\uCE5C\uAD6C\uC640 \uB458\uC774 \uD55C \uC794\uC529 \uB9C8\uC154\uC694. \uC9C1\uC6D0: \u201C\uC8FC\uC2A4 \uD55C \uC794 \uB9DE\uC73C\uC2DC\uC8E0?\u201D", ["\uB124, \uD55C \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uC138 \uC794 \uC8FC\uC138\uC694."], "b", "\uC774\uBC88 \uC8FC\uBB38\uC740 \uB450 \uC0AC\uB78C\uC774 \uD55C \uC794\uC529 \uB9C8\uC2E4 \uB450 \uC794\uC774\uC5D0\uC694. \uD55C \uC794\uC774\uB77C\uB294 \uD655\uC778\uC744 \uACE0\uCCD0\uC694.")),
        question("cafe-visit-soldout-takeout", "cafe-takeout-request", "cafe-takeout", "\uACF5\uC6D0\uC73C\uB85C \uAC00\uC838\uAC00\uB824\uBA74 \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "\uB530\uB73B\uD55C \uCC28\uB97C \uAC00\uC9C0\uACE0 \uACF5\uC6D0 \uBCA4\uCE58\uB85C \uAC00\uB824\uACE0 \uD574\uC694.", ["\uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "b", "\uCE74\uD398 \uBC16\uC758 \uACF5\uC6D0\uC5D0 \uAC00\uC838\uAC08 \uCC28\uC774\uBBC0\uB85C \uD3EC\uC7A5\uC744 \uBD80\uD0C1\uD574\uC694.", transfer("\uC0C8 \uC7A5\uBA74\uC5D0\uC11C \uB9C8\uC2E4 \uACF3\uC744 \uC54C\uB824 \uC8FC\uC138\uC694.", "\uBE44\uAC00 \uB9CE\uC774 \uC640\uC11C \uCE74\uD398 \uC548\uC758 \uD14C\uC774\uBE14\uC5D0\uC11C \uC8FC\uC2A4\uB97C \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.", ["\uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uCDE8\uC18C\uD574 \uC8FC\uC138\uC694.", "\uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694."], "c", "\uC774\uBC88\uC5D0\uB294 \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uC9C0 \uC54A\uACE0 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uBBC0\uB85C \uB9E4\uC7A5 \uC774\uC6A9\uC744 \uB9D0\uD574\uC694."))
      ]),
      lesson("cafe-visit-change", "visit", "\uAE4C\uBABD\uC758 \uB9C8\uC74C\uC774 \uBC14\uB00C\uC5C8\uC5B4\uC694", "\uC74C\uB8CC\xB7\uC218\uB7C9\xB7\uD3EC\uC7A5\uC744 \uBC14\uAFD4 \uB2EC\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694.", cafeChangeExpressions, [
        scene("narrator", "\uC8FC\uBB38\uD45C\uC5D0\uB294 \uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794\uC774 \uC801\uD600 \uC788\uC5B4\uC694. \uC544\uC9C1 \uC74C\uB8CC\uB97C \uB9CC\uB4E4\uAE30 \uC804\uC774\uC5D0\uC694."),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uB530\uB73B\uD55C \uCC28\uAC00 \uB354 \uB04C\uB9AC\uB294\uAD70. \u2026\uC9C0\uAE08 \uBC14\uAFC0 \uC218 \uC788\uACA0\uC9C0."),
        scene("mongle", "\uC624! \uB9C8\uB9B0\uB3C4 \uAC19\uC774 \uB9C8\uC2E0\uB300! \uD55C \uC794 \uB354 \uCC59\uACA8\uC11C \uACF5\uC6D0\uC73C\uB85C \uAC08\uAE4C?"),
        scene("marine", "\uBCC0\uACBD \uC900\uBE44. \uCC28\uB85C \uAD50\uCCB4, \uD55C \uC794 \uCD94\uAC00, \uC804\uC6D0 \uACF5\uC6D0\uC73C\uB85C \uC774\uB3D9.")
      ], [
        question("cafe-visit-change-drink", "cafe-order-change", "cafe-change", "\uC8FC\uC2A4\uB97C \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFB8\uC5B4 \uB2EC\uB77C\uACE0 \uB9D0\uD574\uC694.", "\uC544\uC9C1 \uB9CC\uB4E4\uAE30 \uC804\uC778 \uB530\uB73B\uD55C \uC8FC\uC2A4 \uB450 \uC794\uC744 \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC73C\uB85C \uBC14\uAFB8\uB824\uACE0 \uD574\uC694.", ["\uC8FC\uC2A4 \uB300\uC2E0 \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", "\uB530\uB73B\uD55C \uC8FC\uC2A4\uB85C \uC900\uBE44\uD574 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694."], "a", "\uC8FC\uC2A4 \uB300\uC2E0\uC774\uB77C\uB294 \uB9D0\uB85C \uC774\uC804 \uC74C\uB8CC\uB97C \uC9DA\uACE0 \uB530\uB73B\uD55C \uCC28\uB85C \uBC14\uAFD4 \uB2EC\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694.", transfer("\uC774\uBC88\uC5D0\uB294 \uCC28\uB97C \uC8FC\uC2A4\uB85C \uBC14\uAFB8\uACE0 \uC2F6\uC5B4\uC694.", "\uC544\uC9C1 \uB9CC\uB4E4\uAE30 \uC804\uC778 \uB530\uB73B\uD55C \uCC28 \uD55C \uC794\uC744 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uD55C \uC794\uC73C\uB85C \uBC14\uAFB8\uB824\uACE0 \uD574\uC694.", ["\uB530\uB73B\uD55C \uCC28\uB85C \uC900\uBE44\uD574 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uCC28\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", "\uCC28 \uB300\uC2E0 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694."], "c", "\uC0C8 \uC8FC\uBB38\uC740 \uB530\uB73B\uD55C \uCC28\uC5D0\uC11C \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB85C \uBCC0\uACBD\uD558\uB294 \uAC83\uC774\uC5D0\uC694. \uBC14\uAFC0 \uC885\uB958\uC640 \uC628\uB3C4\uB97C \uD655\uC778\uD574\uC694.")),
        question("cafe-visit-change-count", "cafe-order-detail", "cafe-add", "\uB9C8\uB9B0\uC758 \uCEF5 \uD55C \uC794\uC744 \uCD94\uAC00\uD574\uC694.", "\uD604\uC7AC \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uC138 \uCE5C\uAD6C\uAC00 \uD55C \uC794\uC529 \uB9C8\uC2E4 \uC138 \uC794\uC774 \uD544\uC694\uD574\uC694.", ["\uD55C \uC794 \uBE7C \uC8FC\uC138\uC694.", "\uD55C \uC794 \uB354 \uC8FC\uC138\uC694.", "\uADF8\uB300\uB85C \uB450 \uC794 \uC8FC\uC138\uC694."], "b", "\uB450 \uC794\uC5D0 \uD55C \uC794 \uB354 \uCD94\uAC00\uD558\uBA74 \uC138 \uC794\uC774\uC5D0\uC694. \uB354\uB294 \uC218\uB7C9\uC744 \uB298\uB9AC\uB294 \uB9D0\uC774\uC5D0\uC694.", transfer("\uC0C8 \uC8FC\uBB38\uC5D0 \uCE5C\uAD6C\uC758 \uCEF5\uC744 \uCD94\uAC00\uD574\uC694.", "\uD604\uC7AC \uC8FC\uC2A4 \uD55C \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uCE5C\uAD6C\uC640 \uB458\uC774 \uD55C \uC794\uC529 \uB9C8\uC2DC\uB824\uBA74 \uB450 \uC794\uC774 \uD544\uC694\uD574\uC694.", ["\uD55C \uC794 \uBE7C \uC8FC\uC138\uC694.", "\uD55C \uC794 \uB354 \uC8FC\uC138\uC694.", "\uADF8\uB300\uB85C \uD55C \uC794 \uC8FC\uC138\uC694."], "b", "\uD55C \uC794\uC5D0 \uD55C \uC794\uC744 \uB354\uD558\uBA74 \uB450 \uC794\uC774\uC5D0\uC694. \uC0C8 \uC2DC\uC791 \uC218\uB7C9\uC744 \uC77D\uACE0 \uCD94\uAC00\uD574\uC694.")),
        question("cafe-visit-change-place", "cafe-takeout-request", "cafe-takeout", "\uB9E4\uC7A5 \uC774\uC6A9\uC744 \uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFB8\uC5B4\uC694.", "\uCC98\uC74C\uC5D0\uB294 \uCE74\uD398 \uC548\uC5D0\uC11C \uB9C8\uC2DC\uAE30\uB85C \uD588\uC9C0\uB9CC, \uC774\uC81C \uC74C\uB8CC\uB97C \uAC00\uC9C0\uACE0 \uACF5\uC6D0\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694.", ["\uADF8\uB300\uB85C \uB9E4\uC7A5\uC5D0\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694.", "\uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694."], "c", "\uC74C\uB8CC\uB294 \uC720\uC9C0\uD558\uACE0 \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uBBC0\uB85C \uB9E4\uC7A5 \uC774\uC6A9\uC5D0\uC11C \uD3EC\uC7A5\uC73C\uB85C \uBC14\uAFD4 \uB2EC\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694.", transfer("\uC774\uBC88\uC5D0\uB294 \uD3EC\uC7A5\uC744 \uB9E4\uC7A5 \uC774\uC6A9\uC73C\uB85C \uBC14\uAFB8\uC5B4\uC694.", "\uC8FC\uC2A4\uB97C \uC9D1\uC5D0 \uAC00\uC838\uAC00\uAE30\uB85C \uD588\uC9C0\uB9CC, \uCE5C\uAD6C\uB97C \uB9CC\uB098 \uCE74\uD398 \uC548\uC5D0\uC11C \uD568\uAED8 \uB9C8\uC2DC\uB824\uACE0 \uD574\uC694.", ["\uB9E4\uC7A5 \uC774\uC6A9\uC73C\uB85C \uBC14\uAFD4 \uC8FC\uC138\uC694.", "\uADF8\uB300\uB85C \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "a", "\uC774\uBC88 \uBCC0\uACBD \uBC29\uD5A5\uC740 \uD3EC\uC7A5\uC5D0\uC11C \uB9E4\uC7A5 \uC774\uC6A9\uC774\uC5D0\uC694. \uC0C8\uB85C \uB9C8\uC2E4 \uC7A5\uC18C\uC5D0 \uB9DE\uAC8C \uB9D0\uD574\uC694."))
      ]),
      lesson("cafe-compose", "compose", "\uB0B4 \uB9D0\uB85C \uC8FC\uBB38\uD574\uC694", "\uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC218\uB7C9\uC744 \uACE8\uB77C \uC8FC\uBB38 \uBB38\uC7A5\uC744 \uC644\uC131\uD574\uC694.", cafeComposeExpressions, [
        scene("narrator", "\uC774\uC81C \uC8FC\uBB38 \uBB38\uC7A5\uC744 \uC9C1\uC811 \uB9CC\uB4E4\uC5B4 \uBCFC \uC2DC\uAC04\uC774\uC5D0\uC694. \uAE4C\uBABD\uACFC \uB458\uC774 \uB530\uB73B\uD55C \uCC28\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694."),
        scene("mongle", "\uC624! \uB2E8\uC5B4\uB97C \uACE8\uB790\uB354\uB2C8 \uB124 \uC8FC\uBB38\uC774 \uB418\uB124! \uAC19\uC774 \uB9CC\uB4E4\uC5B4 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8 \uCEF5\uB3C4 \uCC59\uACA8 \uC918. \u2026\uB530\uB73B\uD55C \uCC28, \uD55C \uC794\uC774\uBA74 \uB3FC."),
        scene("marine", "\uC8FC\uBB38 \uC815\uBCF4 \uD655\uC778. \uCC28, \uB530\uB73B\uD55C \uC628\uB3C4, \uB450 \uC794.")
      ], [
        { ...question("cafe-compose-order", "cafe-compose-order", "cafe-compose", "\uAE4C\uBABD\uACFC \uB9C8\uC2E4 \uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uC8FC\uBB38\uD574\uC694.", "\uAE4C\uBABD\uACFC \uB0B4\uAC00 \uB530\uB73B\uD55C \uCC28\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694. \uC74C\uB8CC\xB7\uC628\uB3C4\xB7\uC794 \uC218\uB97C \uC9C1\uC811 \uACE8\uB77C \uC8FC\uC138\uC694.", ["\uC8FC\uBB38 \uC870\uAC74\uC744 \uBAA8\uB450 \uB9DE\uCDC4\uC5B4\uC694.", "\uD544\uC694\uD55C \uC218\uB7C9\uACFC \uB2EC\uB77C\uC694.", "\uC74C\uB8CC\uB098 \uC628\uB3C4\uAC00 \uB2EC\uB77C\uC694."], "a", "\uC74C\uB8CC\uB294 \uCC28, \uC628\uB3C4\uB294 \uB530\uB73B\uD558\uAC8C, \uC218\uB7C9\uC740 \uB450 \uC794\uC774\uC5D0\uC694. \uC138 \uC815\uBCF4\uB97C \uC5F0\uACB0\uD558\uBA74 \uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694\uAC00 \uB3FC\uC694.", transfer("\uC644\uC131\uD560 \uC8FC\uBB38 \uBB38\uC7A5\uC744 \uACE8\uB77C\uC694.", "\uBABD\uAE00\xB7\uAE4C\uBABD\xB7\uB9C8\uB9B0\uC774 \uCC28\uAC00\uC6B4 \uC8FC\uC2A4\uB97C \uD55C \uC794\uC529 \uB9C8\uC154\uC694.", ["\uB530\uB73B\uD55C \uC8FC\uC2A4 \uC138 \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uCC28 \uB450 \uC794 \uC8FC\uC138\uC694.", "\uCC28\uAC00\uC6B4 \uC8FC\uC2A4 \uC138 \uC794 \uC8FC\uC138\uC694."], "c", "\uC8FC\uC2A4\xB7\uCC28\uAC00\uC6B4 \uC628\uB3C4\xB7\uC138 \uC794\uC744 \uBAA8\uB450 \uB2F4\uC544\uC57C \uC0C8 \uC8FC\uBB38\uC5D0 \uB9DE\uC544\uC694.")), kind: "compose", orderGoal: { drink: "tea", temperature: "warm", count: 2 } },
        question("cafe-compose-count", "cafe-order-detail", "cafe-order", "\uC9C1\uC6D0\uC758 \uC218\uB7C9 \uD655\uC778\uC5D0 \uB2F5\uD574\uC694.", "\uB530\uB73B\uD55C \uCC28 \uB450 \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uC9C1\uC6D0: \u201C\uB530\uB73B\uD55C \uCC28 \uB450 \uC794 \uB9DE\uC73C\uC2DC\uC8E0?\u201D", ["\uC544\uB2C8\uC694, \uD55C \uC794 \uC8FC\uC138\uC694.", "\uB124, \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uC138 \uC794 \uC8FC\uC138\uC694."], "b", "\uC6D0\uD558\uB294 \uC218\uB7C9\uACFC \uC9C1\uC6D0\uC774 \uD655\uC778\uD55C \uC218\uB7C9\uC774 \uBAA8\uB450 \uB450 \uC794\uC774\uC5D0\uC694. \uB124\uB77C\uACE0 \uB2F5\uD558\uACE0 \uB450 \uC794\uC744 \uD655\uC778\uD574\uC694.", transfer("\uC0C8 \uC8FC\uBB38\uC758 \uC218\uB7C9\uC744 \uD655\uC778\uD574\uC694.", "\uD63C\uC790 \uB9C8\uC2E4 \uCC28\uAC00\uC6B4 \uCC28 \uD55C \uC794\uC744 \uC8FC\uBB38\uD588\uC5B4\uC694. \uC9C1\uC6D0: \u201C\uB450 \uC794 \uB9DE\uC73C\uC2DC\uC8E0?\u201D", ["\uB124, \uB450 \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uD55C \uC794 \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uC138 \uC794 \uC8FC\uC138\uC694."], "b", "\uC774\uBC88\uC5D0\uB294 \uD55C \uC794\uC774 \uD544\uC694\uD558\uBBC0\uB85C \uB450 \uC794\uC774\uB77C\uB294 \uD655\uC778\uC744 \uD55C \uC794\uC73C\uB85C \uACE0\uCCD0\uC694.")),
        question("cafe-compose-place", "cafe-place", "cafe-here", "\uD568\uAED8 \uB9C8\uC2E4 \uC790\uB9AC\uB97C \uC815\uD574\uC694.", "\uAE4C\uBABD\uACFC \uCE74\uD398 \uC548\uC5D0\uC11C \uB530\uB73B\uD55C \uCC28\uB97C \uB9C8\uC2DC\uBA70 \uC26C\uB824\uACE0 \uD574\uC694.", ["\uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC544\uB2C8\uC694, \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694."], "a", "\uCE74\uD398 \uC548\uC5D0\uC11C \uD568\uAED8 \uB9C8\uC2DC\uB824\uBA74 \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694\uB85C \uB9E4\uC7A5 \uC774\uC6A9\uC744 \uB9D0\uD574\uC694.", transfer("\uC0C8 \uC7A5\uBA74\uC5D0\uC11C \uB9C8\uC2E4 \uACF3\uC744 \uC54C\uB824\uC694.", "\uB9C8\uB9B0\uC774 \uCC28\uB97C \uAC00\uC9C0\uACE0 \uD559\uAD50\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694. \uC9C1\uC6D0: \u201C\uB9E4\uC7A5\uC5D0\uC11C \uB4DC\uC2DC\uB098\uC694?\u201D", ["\uB124, \uC5EC\uAE30\uC11C \uB9C8\uC2E4\uAC8C\uC694.", "\uC8FC\uBB38\uC744 \uCDE8\uC18C\uD560\uAC8C\uC694.", "\uC544\uB2C8\uC694, \uD3EC\uC7A5\uD574 \uC8FC\uC138\uC694."], "c", "\uC774\uBC88\uC5D0\uB294 \uD559\uAD50\uB85C \uAC00\uC838\uAC00\uBBC0\uB85C \uB9E4\uC7A5 \uC774\uC6A9 \uB300\uC2E0 \uD3EC\uC7A5\uC744 \uBD80\uD0C1\uD574\uC694."))
      ])
    ]
  },
  {
    id: "store",
    title: "\uAE4C\uBABD\uC758 \uD3B8\uC758\uC810 \uC791\uC804",
    subtitle: "\uAC00\uACA9\uC744 \uBB3B\uACE0 \uBB3C\uAC74\uC744 \uC0AC\uC694",
    icon: "store",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("store-price-reading", "\uAC00\uACA9 \uC9C8\uBB38\uACFC \uD45C\uC2DC \uC77D\uAE30"), skill("store-bag-request", "\uBD09\uD22C \uC694\uCCAD\uD558\uAE30"), skill("store-payment", "\uACB0\uC81C \uBC29\uBC95 \uC774\uD574\uD558\uAE30")],
    lessons: [
      lesson("store-expressions", "expressions", "\uACC4\uC0B0\uB300 \uC55E \uC138 \uB9C8\uB514", "\uAC00\uACA9\xB7\uBD09\uD22C\xB7\uCE74\uB4DC \uACB0\uC81C\uB97C \uAD6C\uBD84\uD574\uC694.", storeExpressions, [
        scene("mongle", "\uC6B0\uC640! \uC791\uC740 \uAC00\uAC8C\uC5D0 \uBB3C\uAC74\uC774 \uAC00\uB4DD\uD574! \uAC19\uC774 \uACE8\uB77C \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uAC00\uACA9\uB3C4 \uC54C\uC544\uBCF4\uC9C0. \uC22B\uC790\uAC00 \uC791\u2026 \uC544\uB2C8, \uAC00\uAE4C\uC774\uC11C \uC77D\uB294 \uAC70\uC57C."),
        scene("marine", "\uAD6C\uB9E4 \uC900\uBE44. \uAC00\uACA9, \uBD09\uD22C, \uACB0\uC81C \uBC29\uBC95 \uD655\uC778.")
      ], [
        question("store-expressions-price", "store-price-reading", "store-price", "\uBB3C\uAC74\uC758 \uAC00\uACA9\uC744 \uC54C\uACE0 \uC2F6\uC5B4\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uC774\uAC70 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uC774\uAC70 \uBA87 \uAC1C\uC608\uC694?", "\uC774\uAC70 \uC5BC\uB9C8\uC608\uC694?"], "c", "\uAC00\uACA9\uC744 \uBB3C\uC744 \uB54C\uB294 \u2018\uC5BC\uB9C8\uC608\uC694\u2019\uB97C \uC0AC\uC6A9\uD574\uC694.", transfer("\uC774 \uC0CC\uB4DC\uC704\uCE58\uC758 \uAC12\uC744 \uBB3C\uC5B4\uBCF4\uB824\uACE0 \uD574\uC694.", "", ["\uC774\uAC70 \uC5BC\uB9C8\uC608\uC694?", "\uC774\uAC70 \uC5B8\uC81C \uBA39\uC5B4\uC694?", "\uC774\uAC70 \uB204\uAD6C \uAC70\uC608\uC694?"], "a", "\uBB3C\uAC74\uC758 \uAC12\uC740 \u2018\uC5BC\uB9C8\uC608\uC694\u2019\uB85C \uBB3C\uC5B4\uC694.")),
        question("store-expressions-bag", "store-bag-request", "store-bag", "\u2018\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694\u2019\uB294 \uBB34\uC5C7\uC744 \uBD80\uD0C1\uD558\uB294 \uB9D0\uC774\uC5D0\uC694?", "\uC0B0 \uBB3C\uAC74\uC744 \uBC16\uC73C\uB85C \uAC00\uC838\uAC00\uB824\uACE0 \uD574\uC694.", ["\uBB3C\uAC74\uC758 \uAC00\uACA9", "\uBB3C\uAC74\uC744 \uB2F4\uC744 \uBD09\uD22C", "\uD604\uAE08\uC73C\uB85C \uACB0\uC81C\uD558\uAE30"], "b", "\u2018\uBD09\uD22C\u2019\uB294 \uC0B0 \uBB3C\uAC74\uC744 \uB2F4\uC544 \uAC00\uC838\uAC00\uB294 \uB370 \uC0AC\uC6A9\uD574\uC694.", transfer("\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "\uC6B0\uC720\uC640 \uBE75\uC744 \uD55C\uAEBC\uBC88\uC5D0 \uB2F4\uC544 \uAC00\uC838\uAC08 \uBD09\uD22C\uAC00 \uD544\uC694\uD574\uC694.", ["\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694.", "\uC6B0\uC720 \uD558\uB098 \uB354 \uC8FC\uC138\uC694.", "\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694."], "a", "\uBB3C\uAC74\uC744 \uB2F4\uC744 \uBD09\uD22C\uAC00 \uD544\uC694\uD558\uBBC0\uB85C \uBD09\uD22C\uB97C \uC694\uCCAD\uD574\uC694.")),
        question("store-expressions-card", "store-payment", "store-card", "\u2018\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uB294 \uC5B4\uB5BB\uAC8C \uAC12\uC744 \uB0B4\uACA0\uB2E4\uB294 \uB9D0\uC774\uC5D0\uC694?", "", ["\uCE74\uB4DC\uB85C \uB0B4\uC694.", "\uD604\uAE08\uC73C\uB85C \uB0B4\uC694.", "\uB2E4\uC74C\uC5D0 \uB0B4\uC694."], "a", "\u2018\uCE74\uB4DC\uB85C\u2019\uB294 \uCE74\uB4DC\uB77C\uB294 \uBC29\uBC95\uC744 \uC774\uC6A9\uD55C\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.", transfer("\u2018\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uB294 \uC5B4\uB5BB\uAC8C \uAC12\uC744 \uB0B4\uACA0\uB2E4\uB294 \uB9D0\uC774\uC5D0\uC694?", "", ["\uCE74\uB4DC\uB85C \uB0B4\uC694.", "\uB0B4\uC77C \uB0B4\uC694.", "\uD604\uAE08\uC73C\uB85C \uB0B4\uC694."], "c", "\uC9C0\uD3D0\uB098 \uB3D9\uC804\uC73C\uB85C \uC9C1\uC811 \uAC12\uC744 \uB0B4\uB294 \uBC29\uBC95\uC740 \uD604\uAE08 \uACB0\uC81C\uC608\uC694."))
      ]),
      lesson("store-story", "story", "\uBB3C\uC740 \uC6D0\uB798 \uC900\uBE44\uD558\uB294 \uAC70\uC57C", "\uAC00\uACA9\uD45C\uC640 \uC138 \uCE5C\uAD6C\uC758 \uAD6C\uB9E4\uB97C \uC77D\uACE0 \uC774\uD574\uD574\uC694.", storeExpressions, [
        scene("narrator", "\uC138 \uCE5C\uAD6C\uAC00 \uD3B8\uC758\uC810\uC5D0\uC11C \uAC04\uC2DD\uC744 \uACE8\uB77C\uC694. \uBB3C \uD55C \uBCD1\uC758 \uAC00\uACA9\uD45C\uC5D0\uB294 1,000\uC6D0\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694."),
        scene("mongle", "\uC6B0\uC640! \uB77C\uBA74 \uBD09\uC9C0\uAC00 \uBE68\uAC1C! \uAC19\uC774 \uC800 \uADF8\uB9BC \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uB9E4\uC6B4 \uB77C\uBA74\uB3C4 \uC798 \uBA39\uC9C0. \uBB3C\uC740\u2026 \uB098 \uB9D0\uACE0 \uB108\uD76C\uAC00 \uB9C8\uC2DC\uB77C\uACE0."),
        scene("marine", "\uBCF4\uAE09 \uD655\uC778. \uBB3C \uD55C \uBCD1, \uCC9C \uC6D0. \u2026\uB9E4\uC6B8 \uB54C \uB9C8\uC154\uB77C."),
        scene("narrator", "\uB9C8\uB9B0\uC740 \uB77C\uBA74\uACFC \uBB3C\uC744 \uB2F4\uC73C\uB824\uACE0 \uC9C1\uC6D0\uC5D0\uAC8C \u2018\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694\u2019\uB77C\uACE0 \uBD80\uD0C1\uD574\uC694."),
        scene("mongle", "\uC624! \uBB3C\uC774 \uB118\uC5B4\uC9C0\uC9C0 \uC54A\uAC8C \uC138\uC6CC \uC92C\uB124! \uAC19\uC774 \uAC00\uC838\uAC00\uC790!"),
        scene("kkamong", "\uACC4\uC0B0\uC740 \uC774 \uBAB8\uC774 \uD558\uC9C0. \u2018\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.\u2019"),
        scene("narrator", "\uAE4C\uBABD\uC740 \uCE74\uB4DC\uB85C \uACC4\uC0B0\uD558\uACE0 \uBD09\uD22C\uB97C \uCC59\uACA8\uC694. \uB9C8\uB8E8\uC5D0 \uB3CC\uC544\uC640 \uB77C\uBA74\uC744 \uD55C\uC785 \uBA39\uC5B4\uC694."),
        scene("kkamong", "\uB0B4\uAC00 \uC6D0\uB798 \uBB3C\uB3C4 \uC88B\uC544\uD558\uAC70\uB4E0. \u2026\uD55C \uBAA8\uAE08\uB9CC."),
        scene("marine", "\uBCF4\uAE09 \uC644\uB8CC. \uBB3C, \uC5EC\uAE30. \uC804\uC6D0 \uAC04\uC2DD \uD655\uC778.")
      ], [
        question("store-story-price", "store-price-reading", "store-price", "\uC774\uC57C\uAE30 \uC18D \uBB3C \uD55C \uBCD1\uC740 \uC5BC\uB9C8\uC608\uC694?", "", ["2,000\uC6D0", "1,000\uC6D0", "3,000\uC6D0"], "b", "\uBB3C \uD55C \uBCD1\uC758 \uAC00\uACA9\uD45C\uC5D0 1,000\uC6D0\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694.", transfer("\uC0C8 \uAC00\uACA9\uD45C\uB97C \uC77D\uC5B4\uC694. \uC6B0\uC720 \uD55C \uAC1C\uB294 \uC5BC\uB9C8\uC608\uC694?", "\uC6B0\uC720 \uD55C \uAC1C 1,500\uC6D0 / \uBE75 \uD55C \uAC1C 2,000\uC6D0", ["2,000\uC6D0", "3,500\uC6D0", "1,500\uC6D0"], "c", "\uC6B0\uC720 \uAC00\uACA9\uC740 1,500\uC6D0\uC774\uC5D0\uC694. \uB2E4\uB978 \uBB3C\uAC74\uC774\uB098 \uD569\uACC4\uC640 \uAD6C\uBD84\uD574\uC694.")),
        question("store-story-bag", "store-bag-request", "store-bag", "\uB9C8\uB9B0\uC774 \uBD09\uD22C\uB97C \uBD80\uD0C1\uD55C \uC774\uC720\uB294 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uB77C\uBA74\uACFC \uBB3C\uC744 \uB2F4\uC73C\uB824\uACE0\uC694.", "\uAC00\uACA9\uC744 \uBC14\uAFB8\uB824\uACE0\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD558\uB824\uACE0\uC694."], "a", "\uB9C8\uB9B0\uC740 \uC0B0 \uB77C\uBA74\uACFC \uBB3C\uC744 \uD568\uAED8 \uB2F4\uC544 \uAC00\uC838\uAC00\uB824\uACE0 \uBD09\uD22C\uB97C \uBD80\uD0C1\uD588\uC5B4\uC694.", transfer("\uBD09\uD22C\uB97C \uC694\uCCAD\uD558\uB294 \uC7A5\uBA74\uC744 \uACE8\uB77C\uC694.", "\uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694.", ["\uAC00\uACA9\uD45C\uB97C \uB2E4\uC2DC \uC77D\uC5B4\uC694.", "\uC0B0 \uBE75\uACFC \uC6B0\uC720\uB97C \uB2F4\uC544\uC694.", "\uAD50\uD1B5\uCE74\uB4DC\uB97C \uCDA9\uC804\uD574\uC694."], "b", "\uBD09\uD22C\uB294 \uC0B0 \uBE75\uACFC \uC6B0\uC720\uB97C \uB2F4\uC544 \uAC00\uC838\uAC08 \uB54C \uD544\uC694\uD574\uC694.")),
        question("store-story-card", "store-payment", "store-card", "\uAE4C\uBABD\uC740 \uC5B4\uB5A4 \uBC29\uBC95\uC73C\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694?", "", ["\uB2E4\uC74C \uB0A0 \uACC4\uC0B0\uD588\uC5B4\uC694.", "\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694."], "c", "\uAE4C\uBABD\uC740 \u2018\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uB77C\uACE0 \uB9D0\uD558\uACE0 \uCE74\uB4DC\uB97C \uC0AC\uC6A9\uD588\uC5B4\uC694.", transfer("\uC0C8 \uACC4\uC0B0 \uC7A5\uBA74\uC744 \uC77D\uACE0 \uBC29\uBC95\uC744 \uACE8\uB77C\uC694.", "\uBABD\uAE00: \u201C\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.\u201D \uBABD\uAE00\uC774 \uC9C0\uD3D0\uB97C \uAC74\uB138\uC5B4\uC694.", ["\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD588\uC5B4\uC694.", "\uC544\uC9C1 \uACC4\uC0B0\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694."], "a", "\uC9C0\uD3D0\uB97C \uC0AC\uC6A9\uD55C \uACB0\uC81C\uB294 \uD604\uAE08 \uACB0\uC81C\uC608\uC694."))
      ]),
      lesson("store-apply", "apply", "\uB0B4 \uAC04\uC2DD\uC744 \uC0AC\uC694", "\uB2E4\uB978 \uBB3C\uAC74\uC744 \uC0B4 \uB54C \uD544\uC694\uD55C \uB9D0\uC744 \uACE8\uB77C\uC694.", storeExpressions, [
        scene("mongle", "\uC624! \uB124 \uAC04\uC2DD\uC740 \uBB50\uC57C? \uAC19\uC774 \uACC4\uC0B0\uB300\uC5D0 \uAC00 \uBCF4\uC790!"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBB3C\uAE4C\uC9C0 \uC900\uBE44\uD588\uC9C0. \uC900\uBE44 \uC798\uD558\uB294 \uC6A9\uC774\uAC70\uB4E0."),
        scene("marine", "\uACC4\uC0B0\uB300 \uB3C4\uCC29. \uD544\uC694\uD55C \uBD80\uD0C1\uBD80\uD130 \uD655\uC778.")
      ], [
        question("store-apply-price", "store-price-reading", "store-price", "\uAC00\uACA9\uC744 \uBB3C\uC744 \uBB38\uC7A5\uC744 \uACE8\uB77C\uC694.", "\uB3C4\uC2DC\uB77D\uC5D0 \uAC00\uACA9\uD45C\uAC00 \uC5C6\uC5B4\uC694. \uC9C1\uC6D0\uC5D0\uAC8C \uAC12\uC744 \uBB3C\uC5B4\uBCF4\uB824\uACE0 \uD574\uC694.", ["\uC774 \uB3C4\uC2DC\uB77D\uC740 \uC5BC\uB9C8\uC608\uC694?", "\uC774 \uB3C4\uC2DC\uB77D\uC740 \uC5B4\uB514\uC5D0\uC11C \uB9CC\uB4E4\uC5B4\uC694?", "\uC774 \uB3C4\uC2DC\uB77D\uC740 \uB204\uAC00 \uB9CC\uB4E4\uC5B4\uC694?"], "a", "\uAC00\uACA9\uD45C\uAC00 \uC5C6\uC744 \uB54C \u2018\uC5BC\uB9C8\uC608\uC694\u2019\uB85C \uAC12\uC744 \uBB3C\uC5B4\uC694.", transfer("\uAC00\uACA9\uC744 \uBB3C\uC744 \uBB38\uC7A5\uC744 \uACE8\uB77C\uC694.", "\uC6B0\uC0B0\uC758 \uAC12\uC744 \uC54C\uACE0 \uC2F6\uC5B4\uC694.", ["\uC6B0\uC0B0\uC740 \uB204\uAC00 \uC0C0\uC5B4\uC694?", "\uC6B0\uC0B0\uC740 \uC5BC\uB9C8\uC608\uC694?", "\uC6B0\uC0B0\uC740 \uC5B8\uC81C \uC368\uC694?"], "b", "\uC6B0\uC0B0\uC758 \uAC12\uC740 \u2018\uC5BC\uB9C8\uC608\uC694\u2019\uB85C \uBB3C\uC5B4\uC694.")),
        question("store-apply-bag", "store-bag-request", "store-bag", "\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\u201C\uBD09\uD22C \uD544\uC694\uD558\uC138\uC694?\u201D \uC0B0 \uBB3C\uAC74\uC774 \uB9CE\uC544\uC11C \uB2F4\uC744 \uBD09\uD22C\uAC00 \uD544\uC694\uD574\uC694.", ["\uC544\uB2C8\uC694, \uAD1C\uCC2E\uC544\uC694.", "\uAC00\uACA9\uC740 \uC5BC\uB9C8\uC608\uC694?", "\uB124, \uBD09\uD22C \uD558\uB098 \uC8FC\uC138\uC694."], "c", "\uBD09\uD22C\uAC00 \uD544\uC694\uD558\uBBC0\uB85C \u2018\uB124\u2019\uB77C\uACE0 \uB2F5\uD558\uACE0 \uD558\uB098\uB97C \uBD80\uD0C1\uD574\uC694.", transfer("\uC9C1\uC6D0\uC5D0\uAC8C \uC5B4\uB5BB\uAC8C \uB2F5\uD560\uAE4C\uC694?", "\u201C\uBD09\uD22C \uB4DC\uB9B4\uAE4C\uC694?\u201D \uB0B4 \uAC00\uBC29\uC5D0 \uBB3C\uAC74\uC744 \uB2F4\uC744 \uAC70\uC608\uC694. \uBD09\uD22C\uB294 \uD544\uC694 \uC5C6\uC5B4\uC694.", ["\uB124, \uBD09\uD22C \uB450 \uAC1C \uC8FC\uC138\uC694.", "\uC544\uB2C8\uC694, \uAD1C\uCC2E\uC544\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694."], "b", "\uBD09\uD22C\uAC00 \uD544\uC694 \uC5C6\uC73C\uBBC0\uB85C \uC815\uC911\uD558\uAC8C \u2018\uC544\uB2C8\uC694, \uAD1C\uCC2E\uC544\uC694\u2019\uB77C\uACE0 \uB2F5\uD574\uC694.")),
        question("store-apply-card", "store-payment", "store-card", "\uCE74\uB4DC\uB85C \uAC12\uC744 \uB0B4\uB824\uACE0 \uD574\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uB098\uC911\uC5D0 \uACC4\uC0B0\uD560\uAC8C\uC694."], "b", "\uCE74\uB4DC\uB97C \uC0AC\uC6A9\uD560 \uB54C\uB294 \u2018\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uB77C\uACE0 \uD574\uC694.", transfer("\uD604\uAE08\uC73C\uB85C \uAC12\uC744 \uB0B4\uB824\uACE0 \uD574\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uCE74\uB4DC\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694.", "\uAC00\uACA9\uD45C\uB97C \uBD99\uC5EC \uC8FC\uC138\uC694."], "a", "\uD604\uAE08\uC744 \uC0AC\uC6A9\uD558\uBBC0\uB85C \u2018\uD604\uAE08\uC73C\uB85C \uACC4\uC0B0\uD560\uAC8C\uC694\u2019\uAC00 \uC0C1\uD669\uC5D0 \uB9DE\uC544\uC694."))
      ])
    ]
  },
  {
    id: "directions",
    title: "\uAC70\uAFB8\uB85C \uB4E0 \uC9C0\uB3C4",
    subtitle: "\uC704\uCE58\uB97C \uBB3B\uACE0 \uAE38\uC744 \uCC3E\uC544\uC694",
    icon: "map",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("directions-location-question", "\uC7A5\uC18C\uC758 \uC704\uCE58 \uBB3B\uAE30"), skill("directions-turn", "\uC774\uB3D9 \uBC29\uD5A5 \uC774\uD574\uD558\uAE30"), skill("directions-landmark", "\uC8FC\uBCC0 \uC7A5\uC18C\uB85C \uC704\uCE58 \uCC3E\uAE30")],
    lessons: [
      lesson("directions-expressions", "expressions", "\uC5B4\uB514\uB85C \uAC00\uBA74 \uB420\uAE4C\uC694?", "\uC704\uCE58 \uC9C8\uBB38\xB7\uC774\uB3D9 \uBC29\uD5A5\xB7\uC8FC\uBCC0 \uC7A5\uC18C\uB97C \uC77D\uC5B4\uC694.", directionExpressions, [
        scene("mongle", "\uC6B0\uC640! \uC9C0\uB3C4\uC5D0\uB3C4 \uC791\uC740 \uB098\uBB34\uAC00 \uC788\uB124! \uAC19\uC774 \uACF5\uC6D0 \uCC3E\uC744\uAE4C?"),
        scene("kkamong", "\uAE38\uC740 \uC774 \uBAB8\uC774 \uC548\uB0B4\uD558\uC9C0. \uB0B4 \uC9C0\uB3C4\uB9CC \uC81C\uB300\uB85C \uD3B4\uBA74 \uB418\uB294 \uAC70\uC57C."),
        scene("marine", "\uACBD\uB85C \uD655\uC778. \uBAA9\uC801\uC9C0\uC640 \uBC29\uD5A5\uC744 \uB530\uB85C \uC77D\uC5B4\uB77C.")
      ], [
        question("directions-expressions-where", "directions-location-question", "directions-where", "\uACF5\uC6D0\uC758 \uC704\uCE58\uB97C \uC54C\uACE0 \uC2F6\uC5B4\uC694. \uC5B4\uB5A4 \uB9D0\uC744 \uD560\uAE4C\uC694?", "", ["\uACF5\uC6D0\uC740 \uBA87 \uC2DC\uC5D0 \uC5F4\uC5B4\uC694?", "\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uACF5\uC6D0\uC5D0\uB294 \uB098\uBB34\uAC00 \uB9CE\uC544\uC694?"], "b", "\uC7A5\uC18C\uC758 \uC704\uCE58\uB294 \u2018\uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694\u2019\uB85C \uBB3C\uC5B4\uC694.", transfer("\uD654\uC7A5\uC2E4\uC758 \uC704\uCE58\uB97C \uBB3B\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uD654\uC7A5\uC2E4\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uD654\uC7A5\uC2E4\uC740 \uCCAD\uC18C \uC911\uC774\uC5D0\uC694?", "\uD654\uC7A5\uC2E4\uC740 \uAE68\uB057\uD574\uC694?"], "a", "\u2018\uC5B4\uB514\uC5D0\u2019\uB294 \uC7A5\uC18C\uC758 \uC704\uCE58\uB97C \uBB3B\uB294 \uD45C\uD604\uC774\uC5D0\uC694.")),
        question("directions-expressions-right", "directions-turn", "directions-right", "\u2018\uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694\u2019\uB77C\uB294 \uC548\uB0B4\uC5D0 \uB9DE\uB294 \uBC29\uD5A5\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "\uAE38\uC744 \uB530\uB77C \uAC77\uB2E4\uAC00 \uAC08\uB9BC\uAE38\uC5D0 \uB3C4\uCC29\uD588\uC5B4\uC694.", ["\uC67C\uCABD", "\uB4A4\uCABD", "\uC624\uB978\uCABD"], "c", "\u2018\uC624\uB978\uCABD\uC73C\uB85C\u2019\uB294 \uC624\uB978\uCABD \uBC29\uD5A5\uC73C\uB85C \uC6C0\uC9C1\uC774\uB77C\uB294 \uB73B\uC774\uC5D0\uC694.", transfer("\uAC08\uB9BC\uAE38\uC5D0\uC11C \u2018\uC67C\uCABD\uC73C\uB85C \uAC00\uC138\uC694\u2019\uB77C\uB294 \uC548\uB0B4\uB97C \uC77D\uC5C8\uC5B4\uC694.", "\uC5B4\uB290 \uBC29\uD5A5\uC73C\uB85C \uAC00\uC57C \uD574\uC694?", ["\uC624\uB978\uCABD", "\uC67C\uCABD", "\uB4A4\uCABD"], "b", "\uC0C8 \uC548\uB0B4\uC758 \uBC29\uD5A5\uC740 \uC67C\uCABD\uC774\uC5D0\uC694. \uC774\uC804 \uBB38\uC81C\uC758 \uBC29\uD5A5\uC744 \uADF8\uB300\uB85C \uACE0\uB974\uC9C0 \uC54A\uC544\uC694.")),
        question("directions-expressions-beside", "directions-landmark", "directions-beside", "\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\u201C\uACF5\uC6D0\uC740 \uC740\uD589 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uC740\uD589 \uC606", "\uC740\uD589 \uC548", "\uD559\uAD50 \uB4A4"], "a", "\u2018\uC740\uD589 \uC606\u2019\uC740 \uC740\uD589 \uAC00\uAE4C\uC774 \uB098\uB780\uD788 \uC788\uB294 \uC704\uCE58\uC608\uC694.", transfer("\uB3C4\uC11C\uAD00\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\u201C\uB3C4\uC11C\uAD00\uC740 \uD559\uAD50 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uD559\uAD50 \uC548", "\uC740\uD589 \uC55E", "\uD559\uAD50 \uC606"], "c", "\uAE30\uC900 \uC7A5\uC18C\uAC00 \uD559\uAD50\uC774\uACE0 \uC704\uCE58\uB294 \uADF8 \uC606\uC774\uC5D0\uC694."))
      ]),
      lesson("directions-story", "story", "\uC9C0\uB3C4\uB97C \uB4A4\uC9D1\uC73C\uBA74", "\uC138 \uCE5C\uAD6C\uAC00 \uACF5\uC6D0\uAE4C\uC9C0 \uAC00\uB294 \uAE38\uC744 \uC774\uD574\uD574\uC694.", directionExpressions, [
        scene("narrator", "\uACF5\uC6D0\uC5D0\uC11C \uAF43\uC744 \uBCF4\uB824\uACE0 \uC138 \uCE5C\uAD6C\uAC00 \uAE38\uC744 \uB098\uC130\uC5B4\uC694. \uAE4C\uBABD\uC774 \uC9C0\uB3C4\uB97C \uD3BC\uCCD0\uC694."),
        scene("mongle", "\uC5B4? \uC9C0\uB3C4 \uAE00\uC790\uAC00 \uAC70\uAFB8\uB85C\uB124! \uAC19\uC774 \uB3CC\uB824 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBC18\uB300\uCABD\uC5D0\uC11C\uB3C4 \uC77D\u2026 \uC544\uB2C8, \uBC14\uB78C \uB54C\uBB38\uC5D0 \uB3CC\uC544\uAC04 \uAC70\uC57C."),
        scene("narrator", "\uC785\uAD6C\uC758 \uC548\uB0B4\uD310\uC5D0\uB294 \u2018\uACF5\uC6D0: \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC624\uB978\uCABD. \uC740\uD589 \uC606.\u2019\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694."),
        scene("marine", "\uC9C0\uB3C4 \uBC29\uD5A5 \uC218\uC815. \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC624\uB978\uCABD. \uC740\uD589 \uC606. \uD655\uC778."),
        scene("mongle", "\uC6B0\uC640! \uC740\uD589 \uC606\uC5D0 \uAF43\uC774 \uBCF4\uC5EC! \uAC19\uC774 \uC800\uAE30\uB85C \uAC00\uC790!"),
        scene("kkamong", "\uB0B4\uAC00 \uCC98\uC74C\uBD80\uD130 \uAF43 \uCABD\uC73C\uB85C \uAC00\uB824\uACE0 \uD588\uC9C0. \u2026\uB9C8\uB9B0\uB3C4 \uBCF4\uACE0 \uC788\uC5C8\uAD70."),
        scene("narrator", "\uCE5C\uAD6C\uB4E4\uC740 \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC11C \uC740\uD589 \uC606\uC758 \uACF5\uC6D0\uC5D0 \uB3C4\uCC29\uD574\uC694."),
        scene("marine", "\uB3C4\uCC29 \uD655\uC778. \uAF43, \uC5EC\uC12F \uC1A1\uC774. \u2026\uD55C \uC1A1\uC774\uB294 \uC544\uC9C1 \uD53C\uB294 \uC911\uC774\uB2E4.")
      ], [
        question("directions-story-where", "directions-location-question", "directions-where", "\uC138 \uCE5C\uAD6C\uAC00 \uCC3E\uB358 \uC7A5\uC18C\uC758 \uC704\uCE58\uB97C \uBB3B\uB294 \uB9D0\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "", ["\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uD559\uAD50\uAC00 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uCE74\uD398\uAC00 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?"], "a", "\uC138 \uCE5C\uAD6C\uC758 \uBAA9\uC801\uC9C0\uB294 \uAF43\uC744 \uBCFC \uACF5\uC6D0\uC774\uBBC0\uB85C \uACF5\uC6D0\uC758 \uC704\uCE58\uB97C \uBB3C\uC5B4\uC694.", transfer("\uC0C8 \uBAA9\uC801\uC9C0\uC758 \uC704\uCE58\uB97C \uBB3B\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "\uC138 \uCE5C\uAD6C\uAC00 \uCC45\uC744 \uBE4C\uB9AC\uB824\uACE0 \uB3C4\uC11C\uAD00\uC744 \uCC3E\uACE0 \uC788\uC5B4\uC694.", ["\uC740\uD589\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uB3C4\uC11C\uAD00\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uACF5\uC6D0\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?"], "b", "\uCC45\uC744 \uBE4C\uB9B4 \uBAA9\uC801\uC9C0\uB294 \uB3C4\uC11C\uAD00\uC774\uC5D0\uC694. \uD574\uB2F9 \uC7A5\uC18C\uC758 \uC704\uCE58\uB97C \uBB3C\uC5B4\uC694.")),
        question("directions-story-turn", "directions-turn", "directions-right", "\uC138 \uCE5C\uAD6C\uB294 \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC5B4\uB290 \uCABD\uC73C\uB85C \uAC14\uC5B4\uC694?", "", ["\uC67C\uCABD", "\uC624\uB978\uCABD", "\uC654\uB358 \uAE38"], "b", "\uC548\uB0B4\uD310\uC5D0 \uC801\uD78C \uB300\uB85C \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC624\uB978\uCABD\uC73C\uB85C \uAC14\uC5B4\uC694.", transfer("\uC0C8 \uC548\uB0B4\uB97C \uC77D\uACE0 \uAC08 \uBC29\uD5A5\uC744 \uACE8\uB77C\uC694.", "\u201C\uB3C4\uC11C\uAD00\uC5D0 \uAC00\uB824\uBA74 \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC67C\uCABD\uC73C\uB85C \uAC00\uC138\uC694.\u201D", ["\uC624\uB978\uCABD", "\uC654\uB358 \uAE38", "\uC67C\uCABD"], "c", "\uC0C8 \uC548\uB0B4\uC758 \uAC08\uB9BC\uAE38 \uBC29\uD5A5\uC740 \uC67C\uCABD\uC774\uC5D0\uC694.")),
        question("directions-story-landmark", "directions-landmark", "directions-beside", "\uC774\uC57C\uAE30 \uC18D \uACF5\uC6D0\uC740 \uC5B4\uB290 \uAC74\uBB3C \uC606\uC5D0 \uC788\uC5B4\uC694?", "", ["\uD559\uAD50", "\uB3C4\uC11C\uAD00", "\uC740\uD589"], "c", "\uC548\uB0B4\uD310\uACFC \uB3C4\uCC29 \uC7A5\uBA74 \uBAA8\uB450 \uACF5\uC6D0\uC774 \uC740\uD589 \uC606\uC5D0 \uC788\uB2E4\uACE0 \uC54C\uB824 \uC918\uC694.", transfer("\uC0C8 \uC548\uB0B4\uB97C \uC77D\uACE0 \uAE30\uC900 \uAC74\uBB3C\uC744 \uACE8\uB77C\uC694.", "\u201C\uC57D\uAD6D\uC740 \uBCD1\uC6D0 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uBCD1\uC6D0", "\uC740\uD589", "\uD559\uAD50"], "a", "\uC57D\uAD6D\uC758 \uC704\uCE58\uB97C \uC54C\uB824 \uC8FC\uB294 \uAE30\uC900 \uAC74\uBB3C\uC740 \uBCD1\uC6D0\uC774\uC5D0\uC694."))
      ]),
      lesson("directions-apply", "apply", "\uB0B4\uAC00 \uAE38\uC744 \uBB3C\uC5B4\uC694", "\uC0C8 \uC7A5\uC18C\uC758 \uC704\uCE58\uC640 \uBC29\uD5A5\uC744 \uC77D\uACE0 \uACE8\uB77C\uC694.", directionExpressions, [
        scene("mongle", "\uC624! \uC774\uBC88\uC5D0\uB294 \uB2E4\uB978 \uACF3\uC774\uB124! \uAC19\uC774 \uAE38 \uCC3E\uC544\uBCFC\uAE4C?"),
        scene("kkamong", "\uB0B4 \uC9C0\uB3C4\uB294 \uC774\uC81C \uB611\uBC14\uB85C\uC57C. \uC774 \uBAB8\uC758 \uC548\uB0B4\uB3C4 \uB611\uBC14\uB974\uC9C0."),
        scene("marine", "\uC774\uB3D9 \uC900\uBE44. \uBAA9\uC801\uC9C0, \uBC29\uD5A5, \uAE30\uC900 \uC7A5\uC18C \uD655\uC778.")
      ], [
        question("directions-apply-where", "directions-location-question", "directions-where", "\uC9C1\uC6D0\uC5D0\uAC8C \uBB34\uC5C7\uC744 \uBB3C\uC744\uAE4C\uC694?", "\uCC98\uC74C \uC628 \uB3D9\uB124\uC5D0\uC11C \uC57D\uAD6D\uC744 \uCC3E\uACE0 \uC788\uC5B4\uC694.", ["\uC57D\uAD6D\uC740 \uBA87 \uC2DC\uC5D0 \uB2EB\uC544\uC694?", "\uC57D\uAD6D\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?", "\uC57D\uAD6D\uC5D0\uC11C \uC57D\uC744 \uC0C0\uC5B4\uC694?"], "b", "\uCC3E\uB294 \uC57D\uAD6D\uC758 \uC704\uCE58\uB97C \u2018\uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694\u2019\uB85C \uBB3C\uC5B4\uC694.", transfer("\uC9C0\uD558\uCCA0\uC5ED\uC744 \uCC3E\uACE0 \uC788\uC5B4\uC694. \uBB34\uC5C7\uC744 \uBB3C\uC744\uAE4C\uC694?", "\uCC98\uC74C \uC628 \uAC70\uB9AC\uB77C \uC704\uCE58\uB97C \uBAB0\uB77C\uC694.", ["\uC9C0\uD558\uCCA0\uC740 \uBA87 \uC2DC\uC5D0 \uC640\uC694?", "\uC9C0\uD558\uCCA0 \uD45C\uB294 \uC5BC\uB9C8\uC608\uC694?", "\uC9C0\uD558\uCCA0\uC5ED\uC774 \uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694?"], "c", "\uAC00\uB824\uB294 \uC7A5\uC18C\uAC00 \uC9C0\uD558\uCCA0\uC5ED\uC73C\uB85C \uBC14\uB00C\uC5B4\uB3C4 \uC704\uCE58 \uC9C8\uBB38\uC740 \u2018\uC5B4\uB514\uC5D0 \uC788\uC5B4\uC694\u2019\uC608\uC694.")),
        question("directions-apply-turn", "directions-turn", "directions-right", "\uC548\uB0B4\uC5D0 \uB530\uB77C \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC5B4\uB290 \uCABD\uC73C\uB85C \uAC08\uAE4C\uC694?", "\u201C\uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694. \uD3B8\uC758\uC810\uC774 \uBCF4\uC774\uBA74 \uBA48\uCD94\uC138\uC694.\u201D", ["\uC624\uB978\uCABD", "\uC67C\uCABD", "\uB4A4\uCABD"], "a", "\uBA3C\uC800 \uAC08 \uBC29\uD5A5\uC740 \uC624\uB978\uCABD\uC774\uACE0 \uD3B8\uC758\uC810\uC740 \uBA48\uCD9C \uAE30\uC900\uC774\uC5D0\uC694.", transfer("\uC548\uB0B4\uC5D0 \uB530\uB77C \uAC08\uB9BC\uAE38\uC5D0\uC11C \uC5B4\uB290 \uCABD\uC73C\uB85C \uAC08\uAE4C\uC694?", "\u201C\uC67C\uCABD\uC73C\uB85C \uAC00\uC138\uC694. \uC6B0\uCCB4\uAD6D \uC55E\uC5D0\uC11C \uAE30\uB2E4\uB9AC\uC138\uC694.\u201D", ["\uB4A4\uCABD", "\uC67C\uCABD", "\uC624\uB978\uCABD"], "b", "\uAC08 \uBC29\uD5A5\uC740 \uC67C\uCABD\uC774\uC5D0\uC694. \uAE30\uB2E4\uB9B4 \uC7A5\uC18C\uC640 \uC774\uB3D9 \uBC29\uD5A5\uC744 \uB098\uB204\uC5B4 \uC77D\uC5B4\uC694.")),
        question("directions-apply-landmark", "directions-landmark", "directions-beside", "\uC57D\uAD6D\uC758 \uC704\uCE58\uC5D0 \uB9DE\uB294 \uC124\uBA85\uC744 \uACE8\uB77C\uC694.", "\u201C\uC57D\uAD6D\uC740 \uBCD1\uC6D0 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uBCD1\uC6D0 \uC548\uC5D0 \uC788\uC5B4\uC694.", "\uD559\uAD50 \uB4A4\uC5D0 \uC788\uC5B4\uC694.", "\uBCD1\uC6D0 \uC606\uC5D0 \uC788\uC5B4\uC694."], "c", "\u2018\uC606\u2019\uACFC \u2018\uC548\u2019\uC740 \uB2E4\uB978 \uC704\uCE58\uC608\uC694. \uBCD1\uC6D0 \uC606\uC774 \uB9DE\uC544\uC694.", transfer("\uC6B0\uCCB4\uAD6D\uC758 \uC704\uCE58\uC5D0 \uB9DE\uB294 \uC124\uBA85\uC744 \uACE8\uB77C\uC694.", "\u201C\uC6B0\uCCB4\uAD6D\uC740 \uD559\uAD50 \uC606\uC5D0 \uC788\uC5B4\uC694.\u201D", ["\uD559\uAD50 \uC606\uC5D0 \uC788\uC5B4\uC694.", "\uD559\uAD50 \uC548\uC5D0 \uC788\uC5B4\uC694.", "\uC740\uD589 \uB4A4\uC5D0 \uC788\uC5B4\uC694."], "a", "\uC0C8 \uAE30\uC900 \uC7A5\uC18C\uB294 \uD559\uAD50\uC774\uACE0 \uC6B0\uCCB4\uAD6D\uC740 \uD559\uAD50 \uC606\uC5D0 \uC788\uC5B4\uC694."))
      ])
    ]
  },
  {
    id: "transit",
    title: "\uBC84\uC2A4\uB85C \uAF43\uAE38\uAE4C\uC9C0",
    subtitle: "\uBAA9\uC801\uC9C0\uC640 \uB0B4\uB9B4 \uACF3\uC744 \uD655\uC778\uD574\uC694",
    icon: "transit",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("transit-route", "\uBAA9\uC801\uC9C0 \uD655\uC778\uD558\uAE30"), skill("transit-alighting", "\uB0B4\uB9B4 \uC21C\uC11C \uC774\uD574\uD558\uAE30"), skill("transit-instruction", "\uC2B9\uCC28 \uC548\uB0B4 \uC774\uD574\uD558\uAE30")],
    lessons: [
      lesson("transit-expressions", "expressions", "\uBC84\uC2A4 \uD0C0\uAE30 \uC804\uD6C4", "\uBAA9\uC801\uC9C0\xB7\uB0B4\uB9B4 \uB54C\xB7\uAD50\uD1B5\uCE74\uB4DC \uC548\uB0B4\uB97C \uC77D\uC5B4\uC694.", transitExpressions, [
        scene("mongle", "\uC6B0\uC640! \uBC84\uC2A4 \uCC3D\uBB38\uC774 \uCEE4! \uAC19\uC774 \uACF5\uC6D0\uC5D0 \uAC00 \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBC84\uC2A4\uB3C4 \uC798 \uD0C0\uC9C0. \uB0B4\uB9B4 \uACF3\uB9CC \uBA3C\uC800 \uBCF4\uBA74 \uB418\uB294 \uAC70\uC57C."),
        scene("marine", "\uD0D1\uC2B9 \uC900\uBE44. \uBAA9\uC801\uC9C0, \uCE74\uB4DC, \uC815\uB958\uC7A5 \uD655\uC778.")
      ], [
        question("transit-expressions-route", "transit-route", "transit-destination", "\uBC84\uC2A4\uAC00 \uACF5\uC6D0\uC73C\uB85C \uAC00\uB294\uC9C0 \uD655\uC778\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uACF5\uC6D0\uC740 \uBA87 \uC2DC\uC5D0 \uB2EB\uC544\uC694?", "\uC774 \uBC84\uC2A4\uB294 \uACF5\uC6D0\uC5D0 \uAC00\uC694?", "\uACF5\uC6D0\uC5D0 \uAF43\uC774 \uB9CE\uC544\uC694?"], "b", "\uBC84\uC2A4\uC758 \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD558\uB824\uBA74 \uADF8 \uBC84\uC2A4\uAC00 \uACF5\uC6D0\uC5D0 \uAC00\uB294\uC9C0 \uBB3C\uC5B4\uC694.", transfer("\uBC84\uC2A4\uAC00 \uB3C4\uC11C\uAD00\uC73C\uB85C \uAC00\uB294\uC9C0 \uD655\uC778\uD574\uC694.", "", ["\uC774 \uBC84\uC2A4\uB294 \uB3C4\uC11C\uAD00\uC5D0 \uAC00\uC694?", "\uB3C4\uC11C\uAD00\uC5D0 \uCC45\uC774 \uB9CE\uC544\uC694?", "\uB3C4\uC11C\uAD00\uC740 \uBA87 \uC2DC\uC5D0 \uC5F4\uC5B4\uC694?"], "a", "\uAC00\uB824\uB294 \uC7A5\uC18C\uB97C \uB3C4\uC11C\uAD00\uC73C\uB85C \uBC14\uAFD4 \uAC19\uC740 \uBC29\uC2DD\uC73C\uB85C \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD574\uC694.")),
        question("transit-expressions-alight", "transit-alighting", "transit-alight", "\u2018\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694\u2019\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "\uBC84\uC2A4\uAC00 \uC9C0\uAE08 \uC815\uB958\uC7A5\uC5D0 \uBA48\uCDC4\uC5B4\uC694.", ["\uC9C0\uAE08 \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uC544\uC9C1 \uBC84\uC2A4\uB97C \uD0C0\uC9C0 \uC54A\uC544\uC694.", "\uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC11C \uB0B4\uB824\uC694."], "c", "\u2018\uB2E4\uC74C\u2019\uC740 \uC9C0\uAE08 \uB4A4\uC5D0 \uC624\uB294 \uC815\uB958\uC7A5\uC774\uC5D0\uC694. \uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC694.", transfer("\u2018\uC774\uBC88 \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694\u2019\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "\uBC84\uC2A4\uAC00 \uC774\uBC88 \uC815\uB958\uC7A5\uC5D0 \uBA48\uCDC4\uC5B4\uC694.", ["\uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC694.", "\uC9C0\uAE08 \uB0B4\uB824\uC694.", "\uBC84\uC2A4\uB97C \uB2E4\uC2DC \uD0C0\uC694."], "b", "\u2018\uC774\uBC88\u2019\uACFC \u2018\uB2E4\uC74C\u2019\uC740 \uB2EC\uB77C\uC694. \uC774\uBC88 \uC815\uB958\uC7A5\uC740 \uC9C0\uAE08 \uBA48\uCD98 \uACF3\uC774\uC5D0\uC694.")),
        question("transit-expressions-card", "transit-instruction", "transit-card", "\u2018\uAD50\uD1B5\uCE74\uB4DC\uB97C \uCC0D\uC73C\uC138\uC694\u2019\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC740 \uBB34\uC5C7\uC774\uC5D0\uC694?", "\uBC84\uC2A4\uC5D0 \uC62C\uB77C \uCE74\uB4DC \uB2E8\uB9D0\uAE30\uB97C \uBD24\uC5B4\uC694.", ["\uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC694.", "\uAD50\uD1B5\uCE74\uB4DC \uC0AC\uC9C4\uC744 \uCC0D\uC5B4\uC694.", "\uAD50\uD1B5\uCE74\uB4DC\uB97C \uC758\uC790\uC5D0 \uB194\uC694."], "a", "\uBC84\uC2A4\uC5D0\uC11C \u2018\uCE74\uB4DC\uB97C \uCC0D\uB2E4\u2019\uB294 \uB2E8\uB9D0\uAE30\uC5D0 \uCE74\uB4DC\uB97C \uB300\uB294 \uB73B\uC774\uC5D0\uC694.", transfer("\u2018\uB0B4\uB9B4 \uB54C\uB3C4 \uAD50\uD1B5\uCE74\uB4DC\uB97C \uCC0D\uC73C\uC138\uC694\u2019\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", "\uC774 \uBC84\uC2A4\uC5D0\uB294 \uB0B4\uB9B4 \uB54C \uCE74\uB4DC\uB97C \uCC0D\uC73C\uB77C\uB294 \uC548\uB0B4\uAC00 \uC788\uC5B4\uC694.", ["\uCE74\uB4DC\uB97C \uC9D1\uC5D0 \uB450\uACE0 \uB0B4\uB824\uC694.", "\uCE74\uB4DC \uC0AC\uC9C4\uC744 \uCC0D\uC5B4\uC694.", "\uB0B4\uB9AC\uAE30 \uC804\uC5D0 \uB2E8\uB9D0\uAE30\uC5D0 \uCE74\uB4DC\uB97C \uB300\uC694."], "c", "\uC774 \uBB38\uC81C\uC758 \uC548\uB0B4\uB294 \uB0B4\uB9B4 \uB54C \uB2E8\uB9D0\uAE30\uC5D0 \uCE74\uB4DC\uB97C \uB300\uB77C\uB294 \uB73B\uC774\uC5D0\uC694."))
      ]),
      lesson("transit-story", "story", "\uB0B4\uB9B4 \uACF3\uC740 \uB2E4\uC74C\uC774\uC57C", "\uC774\uC57C\uAE30 \uC18D \uBC84\uC2A4 \uB178\uC120\uACFC \uB0B4\uB9B4 \uC21C\uC11C\uB97C \uC774\uD574\uD574\uC694.", transitExpressions, [
        scene("narrator", "\uC774\uC57C\uAE30 \uC18D \uB9C8\uB8E8 \uBC84\uC2A4 \uB178\uC120\uC774\uC5D0\uC694. \uB3C4\uC11C\uAD00 \uB2E4\uC74C \uC815\uB958\uC7A5\uC740 \uAF43\uAE38 \uACF5\uC6D0\uC774\uC5D0\uC694."),
        scene("mongle", "\uC6B0\uC640! \uACF5\uC6D0\uAE4C\uC9C0 \uAC19\uC774 \uBC84\uC2A4 \uD0C0\uACE0 \uAC08\uAE4C? \uCC3D\uBC16 \uAF43\uB3C4 \uBCF4\uC790!"),
        scene("kkamong", "\uBC84\uC2A4 \uACE0\uB974\uAE30\uB294 \uC774 \uBAB8\uC758 \uD2B9\uAE30\uC9C0. \u2018\uC774 \uBC84\uC2A4\uB294 \uACF5\uC6D0\uC5D0 \uAC00\uC694?\u2019"),
        scene("narrator", "\uC548\uB0B4\uD45C\uC5D0 \u2018\uAF43\uAE38 \uACF5\uC6D0\uD589\u2019\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694. \uC138 \uCE5C\uAD6C\uB294 \uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uACE0 \uD0C0\uC694."),
        scene("marine", "\uD0D1\uC2B9 \uD655\uC778. \uC804\uC6D0, \uC14B. \uAD50\uD1B5\uCE74\uB4DC \uC0AC\uC6A9 \uC644\uB8CC."),
        scene("narrator", "\uBC84\uC2A4\uAC00 \uB3C4\uC11C\uAD00\uC5D0 \uBA48\uCDB0\uC694. \uC548\uB0B4\uBB38\uC5D0\uB294 \u2018\uB2E4\uC74C \uC815\uB958\uC7A5: \uAF43\uAE38 \uACF5\uC6D0\u2019\uC774\uB77C\uACE0 \uB098\uC640\uC694."),
        scene("kkamong", "\uB0B4\uAC00 \uBC8C\uC368 \uC77C\uC5B4\uC120 \uAC74 \uB2E4\uB9AC\uB97C \uD3B4\uB824\uACE0\uC9C0. \uC544\uC9C1 \uB0B4\uB9B4 \uB54C\uB294 \uC544\uB2C8\uC57C."),
        scene("mongle", "\uC5B4? \uB2E4\uC74C\uC774 \uACF5\uC6D0\uC774\uB124! \uAC19\uC774 \uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC790!"),
        scene("marine", "\uD558\uCC28 \uC21C\uC11C \uD655\uC778. \uB3C4\uC11C\uAD00 \uB2E4\uC74C, \uAF43\uAE38 \uACF5\uC6D0."),
        scene("narrator", "\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0 \uB3C4\uCC29\uD558\uC790 \uCE5C\uAD6C\uB4E4\uC774 \uB0B4\uB824\uC694. \uB9C8\uB9B0\uC774 \uC791\uC740 \uAF43\uC744 \uBCF4\uACE0 \uC7A0\uAE50 \uBA48\uCDB0\uC694."),
        scene("marine", "\uB3C4\uCC29 \uC644\uB8CC. \uC791\uC740 \uAF43, \uD558\uB098. \u2026\uC774\uB3D9\uC740 \uC7A0\uC2DC \uBA48\uCD98\uB2E4.")
      ], [
        question("transit-story-route", "transit-route", "transit-destination", "\uC138 \uCE5C\uAD6C\uAC00 \uD0C4 \uBC84\uC2A4\uC758 \uBAA9\uC801\uC9C0\uB294 \uC5B4\uB514\uC608\uC694?", "", ["\uD559\uAD50", "\uD3B8\uC758\uC810", "\uAF43\uAE38 \uACF5\uC6D0"], "c", "\uC548\uB0B4\uD45C\uC5D0\uB294 \u2018\uAF43\uAE38 \uACF5\uC6D0\uD589\u2019\uC774\uB77C\uACE0 \uC801\uD600 \uC788\uC5B4\uC694.", transfer("\uC0C8 \uBC84\uC2A4 \uC548\uB0B4\uD45C\uB97C \uC77D\uACE0 \uBAA9\uC801\uC9C0\uB97C \uACE8\uB77C\uC694.", "\uC548\uB0B4\uD45C: \u201C\uB9C8\uB8E8 \uB3C4\uC11C\uAD00\uD589\u201D", ["\uAF43\uAE38 \uACF5\uC6D0", "\uB9C8\uB8E8 \uB3C4\uC11C\uAD00", "\uB9C8\uB8E8 \uCE74\uD398"], "b", "\u2018\uB3C4\uC11C\uAD00\uD589\u2019\uC740 \uB3C4\uC11C\uAD00 \uCABD\uC73C\uB85C \uAC00\uB294 \uBC84\uC2A4\uB77C\uB294 \uB73B\uC774\uC5D0\uC694.")),
        question("transit-story-alight", "transit-alighting", "transit-alight", "\uB3C4\uC11C\uAD00\uC5D0 \uBA48\uCDC4\uC744 \uB54C \uC138 \uCE5C\uAD6C\uB294 \uC5B4\uB5BB\uAC8C \uD588\uC5B4\uC694?", "", ["\uD55C \uC815\uB958\uC7A5 \uB354 \uAC14\uC5B4\uC694.", "\uBC14\uB85C \uB0B4\uB838\uC5B4\uC694.", "\uCC98\uC74C \uC815\uB958\uC7A5\uC73C\uB85C \uB3CC\uC544\uAC14\uC5B4\uC694."], "a", "\uAF43\uAE38 \uACF5\uC6D0\uC774 \uB2E4\uC74C \uC815\uB958\uC7A5\uC774\uBBC0\uB85C \uD55C \uC815\uB958\uC7A5 \uB354 \uAC14\uC5B4\uC694.", transfer("\uC0C8 \uB178\uC120\uC5D0\uC11C \uC5B8\uC81C \uB0B4\uB9B4\uAE4C\uC694?", "\uD604\uC7AC \uC815\uB958\uC7A5: \uD559\uAD50 / \uB2E4\uC74C \uC815\uB958\uC7A5: \uB9C8\uB8E8 \uB3C4\uC11C\uAD00. \uBAA9\uC801\uC9C0\uB294 \uB9C8\uB8E8 \uB3C4\uC11C\uAD00\uC774\uC5D0\uC694.", ["\uD559\uAD50\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uBC84\uC2A4\uB97C \uD0C0\uC9C0 \uC54A\uC544\uC694.", "\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694."], "c", "\uBAA9\uC801\uC9C0\uAC00 \uB2E4\uC74C \uC815\uB958\uC7A5\uC774\uBBC0\uB85C \uD55C \uC815\uB958\uC7A5 \uB354 \uAC04 \uB4A4 \uB0B4\uB824\uC694.")),
        question("transit-story-card", "transit-instruction", "transit-card", "\uCE5C\uAD6C\uB4E4\uC740 \uBC84\uC2A4\uB97C \uD0C8 \uB54C \uAD50\uD1B5\uCE74\uB4DC\uB97C \uC5B4\uB514\uC5D0 \uB314\uC5B4\uC694?", "", ["\uCC3D\uBB38", "\uCE74\uB4DC \uB2E8\uB9D0\uAE30", "\uC88C\uC11D"], "b", "\uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uACE0 \uBC84\uC2A4\uC5D0 \uD0D4\uC5B4\uC694.", transfer("\uC0C8 \uC2B9\uCC28 \uC548\uB0B4\uB97C \uC77D\uACE0 \uD544\uC694\uD55C \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", "\u201C\uBC84\uC2A4\uB97C \uD0C8 \uB54C \uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC138\uC694.\u201D", ["\uCE74\uB4DC \uC0AC\uC9C4\uC744 \uCC0D\uC5B4\uC694.", "\uCE74\uB4DC\uB97C \uC88C\uC11D\uC5D0 \uB194\uC694.", "\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC694."], "c", "\uC548\uB0B4\uC5D0 \uB530\uB77C \uCE74\uB4DC\uB97C \uCE74\uB4DC \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC694."))
      ]),
      lesson("transit-apply", "apply", "\uB0B4\uB9B4 \uACF3\uC744 \uB193\uCE58\uC9C0 \uC54A\uC544\uC694", "\uC0C8 \uBC84\uC2A4 \uC548\uB0B4\uB97C \uC77D\uACE0 \uD544\uC694\uD55C \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", transitExpressions, [
        scene("mongle", "\uC624! \uC774\uBC88\uC5D0\uB294 \uB124 \uBAA9\uC801\uC9C0\uC57C! \uAC19\uC774 \uC548\uB0B4\uD45C\uB97C \uBCFC\uAE4C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBC8C\uB5A1 \uC77C\uC5B4\uB098\uC9C0 \uC54A\uC9C0. \uB0B4\uB9B4 \uACF3\uBD80\uD130 \uD655\uC778\uD558\uB294 \uAC70\uC57C."),
        scene("marine", "\uC774\uB3D9 \uD655\uC778. \uC774 \uBB38\uC81C\uC758 \uC548\uB0B4\uC5D0 \uB530\uB77C \uC120\uD0DD\uD558\uB77C.")
      ], [
        question("transit-apply-route", "transit-route", "transit-destination", "\uBCD1\uC6D0\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694. \uBC84\uC2A4 \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uC774 \uBC84\uC2A4\uB294 \uBCD1\uC6D0\uC5D0 \uAC00\uC694?", "\uBCD1\uC6D0\uC740 \uBA87 \uC2DC\uC5D0 \uB2EB\uC544\uC694?", "\uBCD1\uC6D0 \uC606\uC5D0 \uC740\uD589\uC774 \uC788\uC5B4\uC694?"], "a", "\uAC00\uB824\uB294 \uC7A5\uC18C\uAC00 \uBCD1\uC6D0\uC778\uC9C0\uB97C \uBC84\uC2A4\uC5D0 \uB300\uD574 \uBB3C\uC5B4\uC694.", transfer("\uD559\uAD50\uC5D0 \uAC00\uB824\uACE0 \uD574\uC694. \uBC84\uC2A4 \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD558\uB294 \uB9D0\uC744 \uACE8\uB77C\uC694.", "", ["\uD559\uAD50\uC5D0\uC11C \uC810\uC2EC\uC744 \uBA39\uC5B4\uC694?", "\uC774 \uBC84\uC2A4\uB294 \uD559\uAD50\uC5D0 \uAC00\uC694?", "\uD559\uAD50\uAC00 \uC0C8\uB85C \uC0DD\uACBC\uC5B4\uC694?"], "b", "\uAC00\uB824\uB294 \uC7A5\uC18C\uB97C \uD559\uAD50\uB85C \uBC14\uAFD4 \uBC84\uC2A4 \uBAA9\uC801\uC9C0\uB97C \uD655\uC778\uD574\uC694.")),
        question("transit-apply-alight", "transit-alighting", "transit-alight", "\uC9C0\uAE08 \uC5B4\uB5BB\uAC8C \uD560\uAE4C\uC694?", "\uBAA9\uC801\uC9C0\uB294 \uBCD1\uC6D0\uC774\uC5D0\uC694. \uC548\uB0B4\uBB38: \u201C\uC774\uBC88 \uC815\uB958\uC7A5\uC740 \uBCD1\uC6D0\uC785\uB2C8\uB2E4.\u201D", ["\uD55C \uC815\uB958\uC7A5 \uB354 \uAC00\uC694.", "\uBC84\uC2A4\uB97C \uB2E4\uC2DC \uD0C0\uC694.", "\uC774\uBC88 \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694."], "c", "\uC774\uBC88 \uC815\uB958\uC7A5\uC774 \uBAA9\uC801\uC9C0\uC778 \uBCD1\uC6D0\uC774\uBBC0\uB85C \uC9C0\uAE08 \uB0B4\uB824\uC694.", transfer("\uC9C0\uAE08 \uC5B4\uB5BB\uAC8C \uD560\uAE4C\uC694?", "\uBAA9\uC801\uC9C0\uB294 \uD559\uAD50\uC608\uC694. \uC548\uB0B4\uBB38: \u201C\uC774\uBC88 \uC815\uB958\uC7A5\uC740 \uC2DC\uC7A5\uC785\uB2C8\uB2E4. \uB2E4\uC74C \uC815\uB958\uC7A5\uC740 \uD559\uAD50\uC785\uB2C8\uB2E4.\u201D", ["\uB2E4\uC74C \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uC774\uBC88 \uC815\uB958\uC7A5\uC5D0\uC11C \uB0B4\uB824\uC694.", "\uC2DC\uC7A5\uC5D0\uC11C \uAE30\uB2E4\uB824\uC694."], "a", "\uC9C0\uAE08\uC740 \uC2DC\uC7A5\uC774\uC5D0\uC694. \uBAA9\uC801\uC9C0\uC778 \uD559\uAD50\uB294 \uB2E4\uC74C \uC815\uB958\uC7A5\uC774\uC5D0\uC694.")),
        question("transit-apply-card", "transit-instruction", "transit-card", "\uC2B9\uCC28 \uC548\uB0B4\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", "\u201C\uAD50\uD1B5\uCE74\uB4DC\uB97C \uCC0D\uACE0 \uBC84\uC2A4 \uC548\uC73C\uB85C \uB4E4\uC5B4\uAC00\uC138\uC694.\u201D", ["\uCE74\uB4DC \uC0AC\uC9C4\uC744 \uCC0D\uACE0 \uB4E4\uC5B4\uAC00\uC694.", "\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uACE0 \uB4E4\uC5B4\uAC00\uC694.", "\uCE74\uB4DC\uB97C \uC88C\uC11D\uC5D0 \uB193\uACE0 \uB4E4\uC5B4\uAC00\uC694."], "b", "\uC774 \uC0C1\uD669\uC5D0\uC11C \u2018\uCE74\uB4DC\uB97C \uCC0D\uB2E4\u2019\uB294 \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uB77C\uB294 \uB73B\uC774\uC5D0\uC694.", transfer("\uC774 \uBC84\uC2A4\uC758 \uD558\uCC28 \uC548\uB0B4\uC5D0 \uB9DE\uB294 \uD589\uB3D9\uC744 \uACE8\uB77C\uC694.", "\u201C\uB0B4\uB9AC\uAE30 \uC804\uC5D0 \uAD50\uD1B5\uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC138\uC694.\u201D", ["\uBC84\uC2A4\uB97C \uD0C4 \uB4A4 \uC0AC\uC9C4\uC744 \uCC0D\uC5B4\uC694.", "\uCE74\uB4DC\uB97C \uC758\uC790\uC5D0 \uB450\uACE0 \uB0B4\uB824\uC694.", "\uB0B4\uB9AC\uAE30 \uC804\uC5D0 \uCE74\uB4DC\uB97C \uB2E8\uB9D0\uAE30\uC5D0 \uB300\uC694."], "c", "\uC548\uB0B4\uAC00 \uC9C0\uC815\uD55C \uB54C\uB294 \uB0B4\uB9AC\uAE30 \uC804\uC774\uACE0, \uD589\uB3D9\uC740 \uB2E8\uB9D0\uAE30\uC5D0 \uCE74\uB4DC\uB97C \uB300\uB294 \uAC83\uC774\uC5D0\uC694."))
      ])
    ]
  },
  {
    id: "plans",
    title: "\uC6B0\uB9AC\uC758 \uB0B4\uC77C \uC57D\uC18D",
    subtitle: "\uC2DC\uAC04\xB7\uC7A5\uC18C\uB97C \uC815\uD558\uACE0 \uB2A6\uC73C\uBA74 \uC54C\uB824\uC694",
    icon: "calendar",
    level: "\uAE30\uCD08 \uC0DD\uD65C \uD55C\uAD6D\uC5B4",
    skills: [skill("plans-time-reading", "\uC57D\uC18D \uB0A0\uC9DC\uC640 \uC2DC\uAC04 \uC77D\uAE30"), skill("plans-location", "\uB9CC\uB0A0 \uC7A5\uC18C \uD655\uC778\uD558\uAE30"), skill("plans-delay-message", "\uB2A6\uB294\uB2E4\uB294 \uC5F0\uB77D \uC774\uD574\uD558\uAE30")],
    lessons: [
      lesson("plans-expressions", "expressions", "\uC5B8\uC81C, \uC5B4\uB514\uC11C \uB9CC\uB0A0\uAE4C\uC694?", "\uC57D\uC18D\uC758 \uC2DC\uAC04\xB7\uC7A5\uC18C\xB7\uB2A6\uB294 \uC5F0\uB77D\uC744 \uAD6C\uBD84\uD574\uC694.", planExpressions, [
        scene("mongle", "\uC6B0\uC640! \uB0B4\uC77C\uB3C4 \uAC19\uC774 \uB180 \uC218 \uC788\uB124! \uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0A0\uAE4C?"),
        scene("kkamong", "\uC57D\uC18D\uC740 \uC774 \uBAB8\uB3C4 \uC9C0\uD0A4\uC9C0. \uB0B4 \uC2DC\uACC4\uBD80\uD130 \uB9DE\uCDB0 \uB450\uB294 \uAC70\uC57C."),
        scene("marine", "\uC57D\uC18D \uC900\uBE44. \uB0A0\uC9DC, \uC2DC\uAC04, \uC7A5\uC18C \uD655\uC778.")
      ], [
        question("plans-expressions-time", "plans-time-reading", "plans-time", "\uC5B8\uC81C \uB9CC\uB098\uB294 \uC57D\uC18D\uC774\uC5D0\uC694?", "\u201C\uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC\uC5D0 \uB9CC\uB098\uC694.\u201D", ["\uC624\uB298 \uC624\uD6C4 \uC138 \uC2DC", "\uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC", "\uB0B4\uC77C \uC624\uC804 \uC138 \uC2DC"], "b", "\u2018\uB0B4\uC77C\u2019\uC774\uB77C\uB294 \uB0A0\uC9DC\uC640 \u2018\uC624\uD6C4 \uC138 \uC2DC\u2019\uB77C\uB294 \uC2DC\uAC04\uC744 \uD568\uAED8 \uC77D\uC5B4\uC694.", transfer("\uC5B8\uC81C \uB9CC\uB098\uB294 \uC57D\uC18D\uC774\uC5D0\uC694?", "\u201C\uC624\uB298 \uC624\uC804 \uC5F4 \uC2DC\uC5D0 \uB9CC\uB098\uC694.\u201D", ["\uB0B4\uC77C \uC624\uC804 \uC5F4 \uC2DC", "\uC624\uB298 \uC624\uD6C4 \uC5F4 \uC2DC", "\uC624\uB298 \uC624\uC804 \uC5F4 \uC2DC"], "c", "\uC0C8 \uC57D\uC18D\uC740 \uC624\uB298\uC774\uACE0 \uC2DC\uAC04\uC740 \uC624\uC804 \uC5F4 \uC2DC\uC608\uC694.")),
        question("plans-expressions-place", "plans-location", "plans-place", "\u2018\uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0A0\uAE4C\uC694?\u2019\uB294 \uBB34\uC5C7\uC744 \uC815\uD558\uB824\uB294 \uB9D0\uC774\uC5D0\uC694?", "", ["\uB9CC\uB0A0 \uC7A5\uC18C", "\uB9CC\uB0A0 \uB0A0\uC9DC", "\uC0B4 \uBB3C\uAC74\uC758 \uAC00\uACA9"], "a", "\u2018\uC5B4\uB514\uC5D0\uC11C\u2019\uB294 \uB9CC\uB098\uB294 \uC7A5\uC18C\uB97C \uBB3B\uB294 \uB9D0\uC774\uC5D0\uC694.", transfer("\uB9CC\uB0A0 \uC7A5\uC18C\uB97C \uBB3C\uC5C8\uC5B4\uC694. \uC54C\uB9DE\uC740 \uB2F5\uC744 \uACE8\uB77C\uC694.", "\u201C\uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0A0\uAE4C\uC694?\u201D", ["\uB0B4\uC77C \uB9CC\uB098\uC694.", "\uD559\uAD50 \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.", "\uC624\uD6C4 \uB450 \uC2DC\uC5D0 \uB9CC\uB098\uC694."], "b", "\uC7A5\uC18C\uB97C \uBB3C\uC5C8\uC73C\uBBC0\uB85C \u2018\uD559\uAD50 \uC55E\u2019\uC774\uB77C\uB294 \uC7A5\uC18C\uB97C \uB2F5\uD574\uC694.")),
        question("plans-expressions-delay", "plans-delay-message", "plans-delay", "\u2018\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694\u2019\uB294 \uC5B4\uB5A4 \uC5F0\uB77D\uC774\uC5D0\uC694?", "\uCE5C\uAD6C\uC640 \uB9CC\uB098\uAE30\uB85C \uD55C \uB0A0\uC5D0 \uBCF4\uB0B8 \uBA54\uC2DC\uC9C0\uC608\uC694.", ["\uC57D\uC18D\uC744 \uC815\uD558\uC9C0 \uC54A\uACA0\uB2E4\uB294 \uC5F0\uB77D", "\uC77C\uCC0D \uB3C4\uCC29\uD588\uB2E4\uB294 \uC5F0\uB77D", "\uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uC744 \uAC83 \uAC19\uB2E4\uB294 \uC5F0\uB77D"], "c", "\uC544\uC9C1 \uB3C4\uCC29\uD558\uAE30 \uC804\uC774\uBA70 \uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uC744 \uAC00\uB2A5\uC131\uC744 \uC54C\uB9AC\uB294 \uB9D0\uC774\uC5D0\uC694.", transfer("\uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uAC8C \uB3C4\uCC29\uD560 \uAC83 \uAC19\uC544\uC694. \uC5B4\uB5A4 \uC5F0\uB77D\uC744 \uD560\uAE4C\uC694?", "", ["\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uBC8C\uC368 \uB3C4\uCC29\uD588\uC5B4\uC694.", "\uC77C\uCC0D \uC654\uC5B4\uC694."], "a", "\uB2A6\uC744 \uAC83 \uAC19\uC744 \uB54C \uC0C1\uD669\uC744 \uBBF8\uB9AC \uC54C\uB824 \uC8FC\uB294 \uD45C\uD604\uC774\uC5D0\uC694."))
      ]),
      lesson("plans-story", "story", "\uC138 \uC2DC, \uB3C4\uC11C\uAD00 \uC55E", "\uC57D\uC18D \uBA54\uC2DC\uC9C0\uC640 \uAE4C\uBABD\uC758 \uB2A6\uB294 \uC5F0\uB77D\uC744 \uC774\uD574\uD574\uC694.", planExpressions, [
        scene("narrator", "\uBABD\uAE00\uC740 \uB2E4\uC74C \uB0A0 \uC138 \uCE5C\uAD6C\uAC00 \uB2E4\uC2DC \uB9CC\uB0A0 \uC57D\uC18D \uCE74\uB4DC\uB97C \uB9CC\uB4E4\uC5B4\uC694."),
        scene("mongle", "\uC6B0\uC640! \uB0B4\uC77C\uB3C4 \uAC19\uC774 \uB9CC\uB098\uC790! \uC624\uD6C4 \uC138 \uC2DC \uC5B4\uB54C?"),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uC57D\uC18D \uC804\uC5D0 \uB3C4\uCC29\uD558\uC9C0. \uB3C4\uC11C\uAD00 \uC55E \uBCA4\uCE58\uAC00 \uB531\uC774\uC57C."),
        scene("marine", "\uC57D\uC18D \uAE30\uB85D. \uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC. \uB3C4\uC11C\uAD00 \uC55E \uBCA4\uCE58."),
        scene("narrator", "\uB2E4\uC74C \uB0A0, \uBABD\uAE00\uACFC \uB9C8\uB9B0\uC774 \uBCA4\uCE58\uC5D0 \uC640 \uC788\uC5B4\uC694. \uAE4C\uBABD\uC774 \uBA54\uC2DC\uC9C0\uB97C \uBCF4\uB0B4\uC694."),
        scene("kkamong", "\uB0B4\uAC00 \uAF43\uC744 \uC870\uAE08 \uACE8\uB790\uAC70\uB4E0. \u2018\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.\u2019 \u2026\uC870\uAE08\uB9CC."),
        scene("mongle", "\uC624! \uAF43\uB3C4 \uAC19\uC774 \uC624\uB294\uAD6C\uB098! \uC5EC\uAE30\uC11C \uAE30\uB2E4\uB9B4\uAE4C?"),
        scene("marine", "\uC5F0\uB77D \uD655\uC778. \uB3C4\uC11C\uAD00 \uC55E\uC5D0\uC11C \uB300\uAE30. \u2026\uAE4C\uBABD \uC790\uB9AC \uD655\uBCF4."),
        scene("narrator", "\uAE4C\uBABD\uC774 \uC791\uC740 \uAF43 \uC138 \uC1A1\uC774\uB97C \uAC00\uC9C0\uACE0 \uC640\uC694. \uCE5C\uAD6C\uB9C8\uB2E4 \uD55C \uC1A1\uC774\uC529 \uAC74\uB124\uC918\uC694."),
        scene("kkamong", "\uC774 \uBAB8\uC740 \uBE48\uC790\uB9AC\uB3C4 \uAF43\uC73C\uB85C \uCC44\uC6B0\uC9C0. \u2026\uB108\uD76C \uBAAB\uC774\uC57C."),
        scene("marine", "\uC804\uC6D0 \uB3C4\uCC29. \uAF43, \uC14B. \uC57D\uC18D \uC644\uB8CC. \u2026\uAE30\uB2E4\uB9BC\uB3C4 \uB098\uC058\uC9C0 \uC54A\uB2E4.")
      ], [
        question("plans-story-time", "plans-time-reading", "plans-time", "\uCC98\uC74C \uC57D\uC18D \uCE74\uB4DC\uC5D0 \uC801\uC740 \uC2DC\uAC04\uC740 \uC5B8\uC81C\uC608\uC694?", "", ["\uB0B4\uC77C \uC624\uC804 \uC138 \uC2DC", "\uC624\uB298 \uC624\uD6C4 \uC138 \uC2DC", "\uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC"], "c", "\uCC98\uC74C \uCE74\uB4DC\uB97C \uB9CC\uB4E4 \uB54C \uC815\uD55C \uC57D\uC18D\uC740 \uB0B4\uC77C \uC624\uD6C4 \uC138 \uC2DC\uC608\uC694.", transfer("\uC0C8 \uC57D\uC18D \uCE74\uB4DC\uC5D0 \uC801\uD78C \uC2DC\uAC04\uC744 \uACE8\uB77C\uC694.", "\uC57D\uC18D \uCE74\uB4DC: \u201C\uD1A0\uC694\uC77C \uC624\uC804 \uC5F4\uD55C \uC2DC\u201D", ["\uD1A0\uC694\uC77C \uC624\uD6C4 \uC5F4\uD55C \uC2DC", "\uD1A0\uC694\uC77C \uC624\uC804 \uC5F4\uD55C \uC2DC", "\uC77C\uC694\uC77C \uC624\uC804 \uC5F4\uD55C \uC2DC"], "b", "\uC694\uC77C\xB7\uC624\uC804\xB7\uC5F4\uD55C \uC2DC\uB97C \uBAA8\uB450 \uD655\uC778\uD574\uC694.")),
        question("plans-story-place", "plans-location", "plans-place", "\uC138 \uCE5C\uAD6C\uB294 \uC5B4\uB514\uC5D0\uC11C \uB9CC\uB0AC\uC5B4\uC694?", "", ["\uB3C4\uC11C\uAD00 \uC55E \uBCA4\uCE58", "\uB3C4\uC11C\uAD00 \uC548 \uAD50\uC2E4", "\uCE74\uD398 \uCC3D\uAC00"], "a", "\uC57D\uC18D \uAE30\uB85D\uACFC \uAE30\uB2E4\uB9AC\uB294 \uC7A5\uBA74\uC758 \uC7A5\uC18C\uB294 \uB3C4\uC11C\uAD00 \uC55E \uBCA4\uCE58\uC608\uC694.", transfer("\uC0C8 \uBA54\uC2DC\uC9C0\uB97C \uC77D\uACE0 \uB9CC\uB0A0 \uC7A5\uC18C\uB97C \uACE8\uB77C\uC694.", "\u201C\uACF5\uC6D0 \uC785\uAD6C\uC5D0\uC11C \uB9CC\uB098\uC694. \uC548\uC758 \uBCA4\uCE58\uAC00 \uC544\uB2C8\uB77C \uC785\uAD6C\uC608\uC694.\u201D", ["\uACF5\uC6D0 \uC548 \uBCA4\uCE58", "\uB3C4\uC11C\uAD00 \uC785\uAD6C", "\uACF5\uC6D0 \uC785\uAD6C"], "c", "\u2018\uC785\uAD6C\u2019\uB77C\uB294 \uC7A5\uC18C\uC640 \u2018\uC548\uC758 \uBCA4\uCE58\uAC00 \uC544\uB2C8\uB77C\u2019\uB77C\uB294 \uD655\uC778\uC744 \uD568\uAED8 \uC77D\uC5B4\uC694.")),
        question("plans-story-delay", "plans-delay-message", "plans-delay", "\uAE4C\uBABD\uC758 \u2018\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694\u2019\uB77C\uB294 \uC5F0\uB77D \uB4A4 \uCE5C\uAD6C\uB4E4\uC740 \uBB34\uC5C7\uC744 \uD588\uC5B4\uC694?", "", ["\uC57D\uC18D\uC744 \uBAA8\uB450 \uCDE8\uC18C\uD588\uC5B4\uC694.", "\uB3C4\uC11C\uAD00 \uC55E\uC5D0\uC11C \uAE30\uB2E4\uB838\uC5B4\uC694.", "\uBC14\uB85C \uC9D1\uC73C\uB85C \uB3CC\uC544\uAC14\uC5B4\uC694."], "b", "\uBABD\uAE00\uACFC \uB9C8\uB9B0\uC740 \uB2A6\uB294 \uC5F0\uB77D\uC744 \uD655\uC778\uD558\uACE0 \uC57D\uC18D \uC7A5\uC18C\uC5D0\uC11C \uAE30\uB2E4\uB838\uC5B4\uC694.", transfer("\uC0C8 \uBA54\uC2DC\uC9C0\uB97C \uC77D\uACE0 \uB3C4\uCC29 \uC0C1\uD0DC\uB97C \uACE8\uB77C\uC694.", "\u201C\uBC84\uC2A4\uB97C \uB193\uCCE4\uC5B4\uC694. \uC2ED \uBD84 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.\u201D", ["\uC544\uC9C1 \uB3C4\uCC29 \uC804\uC774\uACE0 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uBC8C\uC368 \uC57D\uC18D \uC7A5\uC18C\uC5D0 \uB3C4\uCC29\uD588\uC5B4\uC694.", "\uC57D\uC18D\uC774 \uCDE8\uC18C\uB410\uC5B4\uC694."], "a", "\uBC84\uC2A4\uB97C \uB193\uCCD0 \uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uC744 \uAC83 \uAC19\uB2E4\uB294 \uC5F0\uB77D\uC774\uC5D0\uC694. \uCDE8\uC18C\uB77C\uB294 \uB9D0\uC740 \uC5C6\uC5B4\uC694."))
      ]),
      lesson("plans-apply", "apply", "\uB0B4 \uC57D\uC18D \uBA54\uC2DC\uC9C0", "\uC0C8 \uC57D\uC18D\uC758 \uC2DC\uAC04\uACFC \uC7A5\uC18C\uB97C \uD655\uC778\uD558\uACE0 \uD544\uC694\uD55C \uC5F0\uB77D\uC744 \uACE8\uB77C\uC694.", planExpressions, [
        scene("mongle", "\uC624! \uB124 \uC57D\uC18D\uC740 \uC5B8\uC81C\uC57C? \uAC19\uC774 \uBA54\uC2DC\uC9C0 \uC77D\uC5B4 \uBCFC\uAE4C?"),
        scene("kkamong", "\uB0B4 \uAF43\uC740 \uC138 \uC1A1\uC774\uC600\uC9C0. \uB2E4\uC74C\uC5D4 \uB0B4\uAC00 \uC2DC\uAC04\uB3C4 \uB531 \uB9DE\uCDB0 \uC624\uC9C0."),
        scene("marine", "\uBA54\uC2DC\uC9C0 \uD655\uC778. \uC2DC\uAC04\uACFC \uC7A5\uC18C\uB97C \uBD84\uB9AC\uD574 \uC77D\uC5B4\uB77C.")
      ], [
        question("plans-apply-time", "plans-time-reading", "plans-time", "\uC5B8\uC81C \uAC00\uC57C \uD574\uC694?", "\uCE5C\uAD6C\uC758 \uBA54\uC2DC\uC9C0: \u201C\uB0B4\uC77C \uC624\uD6C4 \uB450 \uC2DC\uC5D0 \uD559\uAD50 \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.\u201D", ["\uB0B4\uC77C \uC624\uD6C4 \uB450 \uC2DC", "\uC624\uB298 \uC624\uD6C4 \uB450 \uC2DC", "\uB0B4\uC77C \uC624\uC804 \uB450 \uC2DC"], "a", "\uB0A0\uC9DC\uB294 \uB0B4\uC77C, \uC2DC\uAC04\uC740 \uC624\uD6C4 \uB450 \uC2DC\uC608\uC694.", transfer("\uC5B8\uC81C \uAC00\uC57C \uD574\uC694?", "\uCE5C\uAD6C\uC758 \uBA54\uC2DC\uC9C0: \u201C\uC624\uB298 \uC624\uD6C4 \uB2E4\uC12F \uC2DC\uC5D0 \uCE74\uD398 \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.\u201D", ["\uB0B4\uC77C \uC624\uD6C4 \uB2E4\uC12F \uC2DC", "\uC624\uB298 \uC624\uC804 \uB2E4\uC12F \uC2DC", "\uC624\uB298 \uC624\uD6C4 \uB2E4\uC12F \uC2DC"], "c", "\uC0C8 \uC57D\uC18D\uC740 \uC624\uB298 \uC624\uD6C4 \uB2E4\uC12F \uC2DC\uC608\uC694. \uC7A5\uC18C\uC640 \uC2DC\uAC04\uC744 \uB098\uB204\uC5B4 \uC77D\uC5B4\uC694.")),
        question("plans-apply-place", "plans-location", "plans-place", "\uC5B4\uB514\uC5D0\uC11C \uAE30\uB2E4\uB9B4\uAE4C\uC694?", "\u201C\uC5ED \uC548\uC774 \uC544\uB2C8\uB77C \uC5ED \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.\u201D", ["\uC5ED \uC548", "\uC5ED \uB4A4", "\uC5ED \uC55E"], "c", "\uBA54\uC2DC\uC9C0\uB294 \u2018\uC5ED \uC548\u2019\uC774 \uC544\uB2C8\uB77C \u2018\uC5ED \uC55E\u2019\uC774\uB77C\uACE0 \uD655\uC778\uD574 \uC918\uC694.", transfer("\uC5B4\uB514\uC5D0\uC11C \uAE30\uB2E4\uB9B4\uAE4C\uC694?", "\u201C\uD559\uAD50 \uC548\uC774 \uC544\uB2C8\uB77C \uD559\uAD50 \uC55E\uC5D0\uC11C \uB9CC\uB098\uC694.\u201D", ["\uD559\uAD50 \uC548", "\uD559\uAD50 \uC55E", "\uD559\uAD50 \uB4A4"], "b", "\u2018\uD559\uAD50 \uC548\u2019\uC740 \uC81C\uC678\uD558\uACE0 \u2018\uD559\uAD50 \uC55E\u2019\uC5D0\uC11C \uB9CC\uB098\uC694.")),
        question("plans-apply-delay", "plans-delay-message", "plans-delay", "\uCE5C\uAD6C\uC5D0\uAC8C \uBCF4\uB0BC \uC5F0\uB77D\uC744 \uACE8\uB77C\uC694.", "\uC57D\uC18D \uC7A5\uC18C\uC5D0 \uAC00\uB294 \uBC84\uC2A4\uB97C \uB193\uCCE4\uC5B4\uC694. \uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uB2A6\uAC8C \uB3C4\uCC29\uD560 \uAC83 \uAC19\uC544\uC694.", ["\uBC8C\uC368 \uB3C4\uCC29\uD588\uC5B4\uC694.", "\uC870\uAE08 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uC77C\uCC0D \uB3C4\uCC29\uD588\uC5B4\uC694."], "b", "\uC544\uC9C1 \uB3C4\uCC29\uD558\uC9C0 \uC54A\uC558\uACE0 \uB2A6\uC744 \uAC83 \uAC19\uC73C\uBBC0\uB85C \uBBF8\uB9AC \uC5F0\uB77D\uD574\uC694.", transfer("\uCE5C\uAD6C\uC5D0\uAC8C \uBCF4\uB0BC \uC5F0\uB77D\uC744 \uACE8\uB77C\uC694.", "\uAE38\uC774 \uB9C9\uD600 \uC57D\uC18D \uC2DC\uAC04\uBCF4\uB2E4 \uC2ED \uBD84 \uB2A6\uAC8C \uB3C4\uCC29\uD560 \uAC83 \uAC19\uC544\uC694.", ["\uC2ED \uBD84 \uB2A6\uC744 \uAC83 \uAC19\uC544\uC694.", "\uC2ED \uBD84 \uC77C\uCC0D \uC654\uC5B4\uC694.", "\uC9C0\uAE08 \uB3C4\uCC29\uD588\uC5B4\uC694."], "a", "\uB2A6\uC744 \uC608\uC0C1 \uC2DC\uAC04\uC744 \uD568\uAED8 \uC54C\uB824 \uC8FC\uBA74 \uCE5C\uAD6C\uAC00 \uAE30\uB2E4\uB9AC\uB294 \uB370 \uB3C4\uC6C0\uC774 \uB3FC\uC694."))
      ])
    ]
  }
];
var LESSONS = PACKS.flatMap((pack) => pack.lessons.map((item) => ({ ...item, packId: pack.id })));

// experiences/korean-runner/learning.mjs
function instructionMetadata(item) {
  const skill2 = item.steps.length > 1 ? "sequence" : item.skill.includes("\uBD80\uC815") ? "negation" : "detail";
  return {
    id: `korean-runner.${item.id}`,
    itemKey: `korean-runner.${item.id}.v4`,
    familyKey: `korean-runner.${item.id}.v4`,
    skillId: `ko.listening.${skill2}`,
    difficulty: item.steps.length > 1 ? 2 : 1,
    modality: "listening",
    responseFormat: "action",
    audioRequired: true,
    confounded: true
  };
}

// experiences/korean-runner/listening-check.mjs
var lane = (target) => ({ action: "lane", target });
var jump = () => ({ action: "jump" });
var slide = () => ({ action: "slide" });
var stay = () => ({ action: "stay" });
var LISTENING_CHECKS = Object.freeze([
  {
    id: "check-star-middle",
    text: "\uAC00\uC6B4\uB370 \uAE38\uC5D0 \uBCC4\uC774 \uC788\uC5B4\uC694. \uBCC4\uC774 \uC788\uB294 \uAE38\uB85C \uAC00\uC138\uC694.",
    skill: "\uBC29\uD5A5",
    explanation: "\uBCC4\uC774 \uC788\uB294 \uAE38\uC740 \uAC00\uC6B4\uB370\uC608\uC694.",
    steps: [lane(1)],
    choices: ["\uAC00\uC6B4\uB370 \uAE38\uB85C \uAC00\uAE30", "\uC67C\uCABD \uAE38\uB85C \uAC00\uAE30", "\uC624\uB978\uCABD \uAE38\uB85C \uAC00\uAE30"],
    correct: 0
  },
  {
    id: "check-wide-left",
    text: "\uC67C\uCABD \uAE38\uC774 \uB113\uC5B4\uC694. \uB113\uC740 \uAE38\uB85C \uAC00\uC138\uC694.",
    skill: "\uBC29\uD5A5",
    explanation: "\uB113\uC740 \uAE38\uC740 \uC67C\uCABD\uC774\uC5D0\uC694.",
    steps: [lane(0)],
    choices: ["\uC624\uB978\uCABD \uAE38\uB85C \uAC00\uAE30", "\uAC00\uC6B4\uB370 \uAE38\uB85C \uAC00\uAE30", "\uC67C\uCABD \uAE38\uB85C \uAC00\uAE30"],
    correct: 2
  },
  {
    id: "check-fence-jump",
    text: "\uC55E\uC5D0 \uB0AE\uC740 \uC6B8\uD0C0\uB9AC\uAC00 \uC788\uC5B4\uC694. \uC6B8\uD0C0\uB9AC\uB97C \uB118\uC5B4\uAC00\uC138\uC694.",
    skill: "\uB3D9\uC791",
    explanation: "\uC6B8\uD0C0\uB9AC\uB97C \uB118\uC5B4\uAC00\uB824\uBA74 \uB6F0\uC5B4\uB118\uC5B4\uC694.",
    steps: [jump()],
    choices: ["\uBAB8\uC744 \uC219\uC774\uAE30", "\uC6B8\uD0C0\uB9AC\uB97C \uB6F0\uC5B4\uB118\uAE30", "\uC624\uB978\uCABD \uAE38\uB85C \uAC00\uAE30"],
    correct: 1
  },
  {
    id: "check-sign-duck",
    text: "\uC55E\uC5D0 \uB0AE\uC740 \uD45C\uC9C0\uD310\uC774 \uC788\uC5B4\uC694. \uBA38\uB9AC\uB97C \uC219\uC774\uACE0 \uC9C0\uB098\uAC00\uC138\uC694.",
    skill: "\uC704\uCE58 \xB7 \uB3D9\uC791",
    explanation: "\uBA38\uB9AC\uB97C \uC219\uC774\uBA74 \uB0AE\uC740 \uD45C\uC9C0\uD310 \uC544\uB798\uB85C \uC9C0\uB098\uAC08 \uC218 \uC788\uC5B4\uC694.",
    steps: [slide()],
    choices: ["\uBAB8\uC744 \uC219\uC5EC \uC9C0\uB098\uAC00\uAE30", "\uB6F0\uC5B4\uB118\uAE30", "\uADF8\uB300\uB85C \uB2EC\uB9AC\uAE30"],
    correct: 0
  },
  {
    id: "check-not-middle",
    text: "\uAC00\uC6B4\uB370\uB85C \uAC00\uC9C0 \uB9D0\uACE0 \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694.",
    skill: "\uBD80\uC815 \xB7 \uBC29\uD5A5",
    explanation: "\uAC00\uC6B4\uB370\uB294 \uAC00\uC9C0 \uB9D0\uB77C\uACE0 \uD588\uC5B4\uC694. \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC694.",
    steps: [lane(2)],
    choices: ["\uAC00\uC6B4\uB370\uB85C \uAC00\uAE30", "\uC67C\uCABD\uC73C\uB85C \uAC00\uAE30", "\uC624\uB978\uCABD\uC73C\uB85C \uAC00\uAE30"],
    correct: 2
  },
  {
    id: "check-no-fence",
    text: "\uC6B8\uD0C0\uB9AC\uAC00 \uC5C6\uC73C\uB2C8\uAE4C \uB6F0\uC9C0 \uC54A\uC544\uB3C4 \uB3FC\uC694.",
    skill: "\uBD80\uC815 \uC9C0\uC2DC",
    explanation: "\uC6B8\uD0C0\uB9AC\uAC00 \uC5C6\uC5B4\uC11C \uB6F8 \uD544\uC694\uAC00 \uC5C6\uC5B4\uC694. \uADF8\uB0E5 \uB2EC\uB824\uC694.",
    steps: [stay()],
    choices: ["\uB6F0\uC9C0 \uC54A\uACE0 \uADF8\uB0E5 \uB2EC\uB9AC\uAE30", "\uC6B8\uD0C0\uB9AC\uB97C \uB6F0\uC5B4\uB118\uAE30", "\uBAB8\uC744 \uC219\uC774\uAE30"],
    correct: 0
  },
  {
    id: "check-high-sign",
    text: "\uD45C\uC9C0\uD310\uC774 \uB192\uC544\uC11C \uC219\uC774\uC9C0 \uC54A\uC544\uB3C4 \uB3FC\uC694.",
    skill: "\uBD80\uC815 \uC9C0\uC2DC",
    explanation: "\uD45C\uC9C0\uD310\uC774 \uB192\uC73C\uB2C8\uAE4C \uADF8\uB300\uB85C \uC9C0\uB098\uAC00\uB3C4 \uB3FC\uC694.",
    steps: [stay()],
    choices: ["\uBAB8\uC744 \uC219\uC5EC \uC9C0\uB098\uAC00\uAE30", "\uC219\uC774\uC9C0 \uC54A\uACE0 \uADF8\uB300\uB85C \uC9C0\uB098\uAC00\uAE30", "\uB6F0\uC5B4\uB118\uAE30"],
    correct: 1
  },
  {
    id: "check-not-left",
    text: "\uC67C\uCABD\uC73C\uB85C \uAC00\uC9C0 \uB9C8\uC138\uC694. \uC624\uB978\uCABD \uAE38\uC774 \uC88B\uC544\uC694.",
    skill: "\uBD80\uC815 \xB7 \uBC29\uD5A5",
    explanation: "\uC67C\uCABD\uC740 \uAC00\uC9C0 \uB9D0\uB77C\uACE0 \uD588\uC5B4\uC694. \uC88B\uC740 \uAE38\uC740 \uC624\uB978\uCABD\uC774\uC5D0\uC694.",
    steps: [lane(2)],
    choices: ["\uC67C\uCABD \uAE38\uB85C \uAC00\uAE30", "\uAC00\uC6B4\uB370 \uAE38\uC5D0\uC11C \uC219\uC774\uAE30", "\uC624\uB978\uCABD \uAE38\uB85C \uAC00\uAE30"],
    correct: 2
  },
  {
    id: "check-duck-jump",
    text: "\uBA3C\uC800 \uBAB8\uC744 \uC219\uC774\uACE0, \uADF8\uB2E4\uC74C\uC5D0 \uC6B8\uD0C0\uB9AC\uB97C \uB6F0\uC5B4\uB118\uC73C\uC138\uC694.",
    skill: "\uC21C\uC11C",
    explanation: "\uBA3C\uC800 \uC219\uC774\uACE0, \uADF8\uB2E4\uC74C\uC5D0 \uB6F0\uC5B4\uB118\uC5B4\uC694.",
    steps: [slide(), jump()],
    choices: ["\uBAB8\uC744 \uC219\uC778 \uB4A4 \uB6F0\uC5B4\uB118\uAE30", "\uB6F0\uC5B4\uB118\uC740 \uB4A4 \uBAB8\uC744 \uC219\uC774\uAE30", "\uBAB8\uC744 \uC219\uC774\uAE30\uB9CC \uD558\uAE30"],
    correct: 0
  },
  {
    id: "check-middle-left",
    text: "\uAC00\uC6B4\uB370\uB85C \uAC04 \uB2E4\uC74C, \uC67C\uCABD\uC73C\uB85C \uAC00\uC138\uC694.",
    skill: "\uC21C\uC11C \xB7 \uBC29\uD5A5",
    explanation: "\uBA3C\uC800 \uAC00\uC6B4\uB370\uB85C \uAC00\uACE0, \uADF8\uB2E4\uC74C\uC5D0 \uC67C\uCABD\uC73C\uB85C \uAC00\uC694.",
    steps: [lane(1), lane(0)],
    choices: ["\uC67C\uCABD\uC73C\uB85C \uAC04 \uB4A4 \uAC00\uC6B4\uB370\uB85C \uAC00\uAE30", "\uAC00\uC6B4\uB370\uB85C\uB9CC \uAC00\uAE30", "\uAC00\uC6B4\uB370\uB85C \uAC04 \uB4A4 \uC67C\uCABD\uC73C\uB85C \uAC00\uAE30"],
    correct: 2
  },
  {
    id: "check-right-before-jump",
    text: "\uB6F0\uC5B4\uB118\uAE30 \uC804\uC5D0 \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694.",
    skill: "\uC21C\uC11C",
    explanation: "\u2018\uB6F0\uC5B4\uB118\uAE30 \uC804\uC5D0\u2019\uB77C\uACE0 \uD588\uC73C\uB2C8\uAE4C \uC624\uB978\uCABD\uC73C\uB85C \uBA3C\uC800 \uAC00\uC694.",
    steps: [lane(2), jump()],
    choices: ["\uB6F0\uC5B4\uB118\uC740 \uB4A4 \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uAE30", "\uC624\uB978\uCABD\uC73C\uB85C \uAC04 \uB4A4 \uB6F0\uC5B4\uB118\uAE30", "\uC624\uB978\uCABD\uC73C\uB85C \uAC04 \uB4A4 \uBAB8\uC744 \uC219\uC774\uAE30"],
    correct: 1
  },
  {
    id: "check-left-run",
    text: "\uC67C\uCABD\uC73C\uB85C \uAC04 \uB2E4\uC74C, \uADF8\uB0E5 \uB2EC\uB9AC\uC138\uC694.",
    skill: "\uC21C\uC11C \xB7 \uBC29\uD5A5",
    explanation: "\uBA3C\uC800 \uC67C\uCABD\uC73C\uB85C \uAC00\uACE0, \uADF8\uB2E4\uC74C\uC5D0\uB294 \uADF8\uB0E5 \uB2EC\uB824\uC694.",
    steps: [lane(0), stay()],
    choices: ["\uADF8\uB0E5 \uB2EC\uB9B0 \uB4A4 \uC67C\uCABD\uC73C\uB85C \uAC00\uAE30", "\uC67C\uCABD\uC73C\uB85C \uAC04 \uB4A4 \uADF8\uB0E5 \uB2EC\uB9AC\uAE30", "\uC67C\uCABD\uC73C\uB85C \uAC04 \uB4A4 \uB6F0\uC5B4\uB118\uAE30"],
    correct: 1
  }
].map((check2) => Object.freeze({
  ...check2,
  steps: Object.freeze(check2.steps),
  choices: Object.freeze(check2.choices),
  choiceIds: Object.freeze(check2.choices.map((_choice, index) => `runner-${check2.id}-option-${index + 1}`))
})));
var CORRECTIONS = Object.freeze({
  "check-star-middle": [null, "\uC67C\uCABD\uC774 \uC544\uB2C8\uB77C \uBCC4\uC774 \uC788\uB294 \uAC00\uC6B4\uB370 \uAE38\uC774\uC5D0\uC694.", "\uC624\uB978\uCABD\uC774 \uC544\uB2C8\uB77C \uBCC4\uC774 \uC788\uB294 \uAC00\uC6B4\uB370 \uAE38\uC774\uC5D0\uC694."],
  "check-wide-left": ["\uC624\uB978\uCABD\uC774 \uC544\uB2C8\uB77C \uB113\uB2E4\uACE0 \uD55C \uC67C\uCABD \uAE38\uC774\uC5D0\uC694.", "\uAC00\uC6B4\uB370\uAC00 \uC544\uB2C8\uB77C \uB113\uB2E4\uACE0 \uD55C \uC67C\uCABD \uAE38\uC774\uC5D0\uC694.", null],
  "check-fence-jump": ["\uBAB8\uC744 \uC219\uC774\uBA74 \uC6B8\uD0C0\uB9AC\uB97C \uB118\uC744 \uC218 \uC5C6\uC5B4\uC694. \uC6B8\uD0C0\uB9AC\uB294 \uB6F0\uC5B4\uB118\uC5B4\uC694.", null, "\uAE38\uC744 \uBC14\uAFB8\uB77C\uB294 \uBD80\uD0C1\uC774 \uC544\uB2C8\uB77C \uC6B8\uD0C0\uB9AC\uB97C \uB118\uC5B4\uAC00\uB77C\uB294 \uBD80\uD0C1\uC774\uC5D0\uC694."],
  "check-sign-duck": [null, "\uB6F0\uBA74 \uBA38\uB9AC\uAC00 \uB354 \uB192\uC544\uC838\uC694. \uB0AE\uC740 \uD45C\uC9C0\uD310 \uC544\uB798\uC5D0\uC11C\uB294 \uBA38\uB9AC\uB97C \uC219\uC5EC\uC694.", "\uADF8\uB300\uB85C \uB2EC\uB9AC\uC9C0 \uB9D0\uACE0 \uBA38\uB9AC\uB97C \uC219\uC774\uACE0 \uC9C0\uB098\uAC00\uC138\uC694."],
  "check-not-middle": ["\uAC00\uC6B4\uB370\uB85C \uAC00\uC9C0 \uB9D0\uB77C\uACE0 \uD588\uC5B4\uC694. \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694.", "\uC67C\uCABD\uC774 \uC544\uB2C8\uB77C \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uB77C\uACE0 \uD588\uC5B4\uC694.", null],
  "check-no-fence": [null, "\u2018\uB6F0\uC9C0 \uC54A\uC544\uB3C4 \uB3FC\uC694\u2019\uB294 \uB6F8 \uD544\uC694\uAC00 \uC5C6\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.", "\uC219\uC774\uB77C\uB294 \uBD80\uD0C1\uC740 \uC5C6\uC5B4\uC694. \uB6F0\uC9C0 \uC54A\uACE0 \uADF8\uB0E5 \uB2EC\uB824\uB3C4 \uB3FC\uC694."],
  "check-high-sign": ["\u2018\uC219\uC774\uC9C0 \uC54A\uC544\uB3C4 \uB3FC\uC694\u2019\uB294 \uC219\uC77C \uD544\uC694\uAC00 \uC5C6\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.", null, "\uB6F0\uB77C\uB294 \uBD80\uD0C1\uC740 \uC5C6\uC5B4\uC694. \uB192\uC740 \uD45C\uC9C0\uD310 \uC544\uB798\uB85C \uADF8\uB300\uB85C \uC9C0\uB098\uAC00\uB3C4 \uB3FC\uC694."],
  "check-not-left": ["\u2018\uC67C\uCABD\uC73C\uB85C \uAC00\uC9C0 \uB9C8\uC138\uC694\u2019\uB77C\uACE0 \uD588\uC5B4\uC694. \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694.", "\uAC00\uC6B4\uB370\uB85C \uAC00\uAC70\uB098 \uC219\uC774\uB77C\uB294 \uBD80\uD0C1\uC740 \uC5C6\uC5B4\uC694. \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC138\uC694.", null],
  "check-duck-jump": [null, "\uBA3C\uC800 \uC219\uC774\uACE0 \uADF8\uB2E4\uC74C\uC5D0 \uB6F0\uC5B4\uC694. \uACE0\uB978 \uB2F5\uC740 \uC21C\uC11C\uAC00 \uBC18\uB300\uC608\uC694.", "\uC219\uC778 \uB2E4\uC74C\uC5D0 \uB6F0\uC5B4\uB118\uB294 \uB450 \uBC88\uC9F8 \uB3D9\uC791\uB3C4 \uD544\uC694\uD574\uC694."],
  "check-middle-left": ["\uBA3C\uC800 \uAC00\uC6B4\uB370\uB85C \uAC00\uACE0 \uADF8\uB2E4\uC74C\uC5D0 \uC67C\uCABD\uC73C\uB85C \uAC00\uC694. \uACE0\uB978 \uB2F5\uC740 \uC21C\uC11C\uAC00 \uBC18\uB300\uC608\uC694.", "\uAC00\uC6B4\uB370\uB85C \uAC04 \uB2E4\uC74C\uC5D0 \uC67C\uCABD\uC73C\uB85C \uAC00\uB294 \uB450 \uBC88\uC9F8 \uB3D9\uC791\uB3C4 \uD544\uC694\uD574\uC694.", null],
  "check-right-before-jump": ["\uB6F0\uAE30 \uC804\uC5D0 \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uC694. \uC624\uB978\uCABD\uC73C\uB85C \uAC00\uB294 \uAC83\uC774 \uBA3C\uC800\uC608\uC694.", null, "\uC624\uB978\uCABD\uC73C\uB85C \uAC04 \uB2E4\uC74C\uC5D0\uB294 \uC219\uC774\uB294 \uAC83\uC774 \uC544\uB2C8\uB77C \uB6F0\uC5B4\uB118\uC5B4\uC694."],
  "check-left-run": ["\uBA3C\uC800 \uC67C\uCABD\uC73C\uB85C \uAC00\uACE0 \uADF8\uB2E4\uC74C\uC5D0 \uADF8\uB0E5 \uB2EC\uB824\uC694. \uACE0\uB978 \uB2F5\uC740 \uC21C\uC11C\uAC00 \uBC18\uB300\uC608\uC694.", null, "\uC67C\uCABD\uC73C\uB85C \uAC04 \uB2E4\uC74C\uC5D0\uB294 \uB6F0\uC9C0 \uC54A\uACE0 \uADF8\uB0E5 \uB2EC\uB824\uC694."]
});
var CHECK_GRAMMAR = Object.freeze({ "check-star-middle": ["G211"], "check-wide-left": ["G211"], "check-fence-jump": ["G211"], "check-sign-duck": ["G211"], "check-not-middle": ["S226", "G211"], "check-no-fence": ["G410", "G304", "G505"], "check-high-sign": ["G304", "G505"], "check-not-left": ["S226", "G211"], "check-duck-jump": ["G211"], "check-middle-left": ["G406", "G211"], "check-right-before-jump": ["G406", "G211"], "check-left-run": ["G406", "G211"] });
function checkMetadata(item) {
  const key = `korean-runner.listening-check.${item.id}.v1`;
  return {
    ...instructionMetadata(item),
    id: `korean-runner.listening-check.${item.id}`,
    itemKey: key,
    familyKey: key,
    responseFormat: "single-choice",
    confounded: false,
    conceptIds: [...CHECK_GRAMMAR[item.id] || []]
  };
}

// experiences/korean-rhythm/suno-tracks.mjs
var SUNO_RECORDINGS = [{ "sourceId": "94e8eeb8-fcba-4434-a0ba-cd1490d8c6d3", "title": "\uCD08\uB85D", "audioUrl": "assets/music/blue-signal.mp3", "duration": 202.68, "bpm": 111.096, "beatOffset": 0.045, "beatTimes": [0.04644, 0.58507, 1.08408, 1.63283, 2.18159, 2.73034, 3.26912, 3.80789, 4.34667, 4.89542, 5.4342, 5.98295, 6.51175, 7.0605, 7.59927, 8.13805, 8.67683, 9.22558, 9.75438, 10.30313, 10.83193, 11.39066, 11.91946, 12.46821, 12.99701, 13.54576, 14.07456, 14.62331, 15.16209, 15.70086, 16.23964, 16.77841, 17.31719, 17.86594, 18.39474, 18.94349, 19.49224, 20.02104, 20.55982, 21.09859, 21.63737, 22.17615, 22.71492, 23.26367, 23.80245, 24.3512, 24.88, 25.42875, 25.95755, 26.5063, 27.0351, 27.58385, 28.12263, 28.67138, 29.20018, 29.74893, 30.28771, 30.82649, 31.36526, 31.90404, 32.44281, 32.99156, 33.52036, 34.06912, 34.60789, 35.14667, 35.68544, 36.22422, 36.77297, 37.31175, 37.85052, 38.3893, 38.92807, 39.47683, 40.00562, 40.55438, 41.09315, 41.6419, 42.1707, 42.70948, 43.24825, 43.79701, 44.33578, 44.87456, 45.42331, 45.95211, 46.49088, 47.03964, 47.56844, 48.11719, 48.65596, 49.20472, 49.73351, 50.28227, 50.82104, 51.35982, 51.88862, 52.42739, 52.96617, 53.51492, 54.0537, 54.60245, 55.13125, 55.68, 56.2088, 56.75755, 57.29633, 57.8351, 58.37388, 58.92263, 59.45143, 60.00018, 60.53896, 61.07773, 61.61651, 62.16526, 62.69406, 63.23283, 63.77161, 64.32036, 64.85914, 65.39791, 65.93669, 66.47546, 67.01424, 67.56299, 68.08181, 68.59066, 69.16934, 69.7181, 70.25687, 70.79565, 71.33442, 71.87477, 72.41197, 72.96073, 73.48952, 74.03828, 74.56707, 75.10585, 75.6546, 76.19338, 76.72218, 77.27093, 77.80971, 78.3385, 78.87728, 79.42603, 79.96481, 80.50358, 81.04236, 81.58113, 82.11991, 82.66866, 83.19746, 83.73624, 84.27501, 84.78385, 85.35256, 85.90132, 86.44009, 86.98884, 87.51764, 88.05642, 88.59519, 89.13397, 89.67274, 90.21152, 90.76027, 91.30902, 91.82785, 92.3766, 92.9054, 93.45415, 94.0029, 94.5317, 95.07048, 95.60925, 96.14803, 96.69678, 97.22558, 97.76435, 98.30313, 98.85188, 99.39066, 99.91946, 100.45823, 101.00698, 101.53578, 102.07456, 102.62331, 103.16209, 103.69088, 104.23964, 104.76844, 105.31719, 105.84599, 106.38476, 106.93351, 107.47229, 108.01107, 108.54984, 109.08862, 109.62739, 110.16617, 110.71492, 111.2537, 111.79247, 112.33125, 112.87002, 113.4088, 113.94757, 114.48635, 115.0351, 115.57388, 116.11265, 116.65143, 117.1902, 117.72898, 118.26776, 118.80653, 119.40123, 119.94131, 120.53261, 121.02145, 121.56153, 122.1016, 122.64167, 123.18175, 123.72182, 124.26189, 124.85279, 125.34204, 125.88211, 126.46912, 127.00789, 127.54667, 128.04241, 128.6342, 129.16299, 129.66263, 130.2027, 130.74277, 131.3181, 131.82292, 132.363, 132.90307, 133.48317, 134.02195, 134.52329, 135.06336, 135.61832, 136.14351, 136.71583, 137.2546, 137.77342, 138.3038, 138.86095, 139.39973, 139.92853, 140.4641, 141.00417, 141.54424, 142.08363, 142.62439, 143.16446, 143.70454, 144.25868, 144.77751, 145.32476, 145.86483, 146.4049, 146.94498, 147.48505, 148.02513, 148.5652, 149.10527, 149.64535, 150.2351, 150.72549, 151.26557, 151.80564, 152.34571, 152.88579, 153.42586, 153.96593, 154.45551, 155.04608, 155.58615, 156.12623, 156.72036, 157.25914, 157.78794, 158.28652, 158.77569, 159.41424, 159.95302, 160.44681, 161.02059, 161.53941, 162.06703, 162.64689, 163.17569, 163.68454, 164.25324, 164.802, 165.33079, 165.86957, 166.38839, 166.94712, 167.47592, 168.00472, 168.55347, 169.09224, 169.63102, 170.17977, 170.71855, 171.24735, 171.78612, 172.3249, 172.8537, 173.39247, 173.93125, 174.47002, 174.97887, 175.5376, 176.07637, 176.61515, 177.14395, 177.68272, 178.2215, 178.76027, 179.29905, 179.83782, 180.3766, 180.91537, 181.5639, 182.04975, 182.58983, 183.1299, 183.62921, 184.25778, 184.75012, 185.33533, 185.83027, 186.42286, 186.91041, 187.50041, 187.99056, 188.558, 189.09678, 189.64553, 190.15085, 190.70313, 191.231, 191.79066, 192.33941, 192.84825, 193.38703, 193.94576, 194.47144, 195.00336, 195.55159, 196.09088, 196.63174, 197.15846, 197.68726, 198.23601, 198.79203, 199.3321, 199.84236, 200.38113, 200.92989, 201.4924, 202.03247] }, { "sourceId": "c2835bc7-6963-4503-95bd-781b55e20b88", "title": "\uD574\uC548\uC120", "audioUrl": "assets/music/one-hour-to-sea.mp3", "duration": 231.6, "bpm": 112.058, "beatOffset": 0.205, "beatTimes": [0.205, 0.79474, 1.32354, 1.81131, 2.34675, 2.88219, 3.41762, 3.95306, 4.43646, 4.97524, 5.51401, 6.04281, 6.63024, 7.12036, 7.65914, 8.18794, 8.72671, 9.30743, 9.79429, 10.33306, 10.87184, 11.40063, 11.94939, 12.47819, 13.01696, 13.56571, 14.10449, 14.64327, 15.17206, 15.71084, 16.25959, 16.78839, 17.33714, 17.8859, 18.41469, 18.94349, 19.50222, 20.02104, 20.55982, 21.08862, 21.64735, 22.1961, 22.71492, 23.26367, 23.80245, 24.34122, 24.87002, 25.4088, 25.91764, 26.38658, 27.02512, 27.55392, 28.10268, 28.63147, 29.17025, 29.59927, 30.21787, 30.7766, 31.3054, 31.79578, 32.38295, 32.86666, 33.40209, 33.90948, 34.50812, 34.9571, 35.54384, 36.07928, 36.61472, 37.18204, 37.68559, 38.22103, 38.75646, 39.2919, 39.82734, 40.36278, 40.89821, 41.43365, 41.96909, 42.50993, 43.03996, 43.5754, 44.11083, 44.64627, 45.18171, 45.71715, 46.25258, 46.80018, 47.32346, 47.85889, 48.39433, 48.95528, 49.4652, 50.00064, 50.53608, 51.11039, 51.60695, 52.14239, 52.67783, 53.25551, 53.7487, 54.28414, 54.81957, 55.35501, 55.89045, 56.42589, 56.96132, 57.5258, 58.0322, 58.56763, 59.15211, 59.68091, 60.17394, 60.70938, 61.24482, 61.78026, 62.31569, 62.85113, 63.38657, 63.97116, 64.45744, 64.99882, 65.52831, 66.06375, 66.59919, 67.13463, 67.67006, 68.2055, 68.74094, 69.27637, 69.8478, 70.34725, 70.88268, 71.41812, 71.90313, 72.489, 72.9707, 73.50948, 74.04825, 74.57705, 75.11583, 75.6546, 76.1834, 76.72218, 77.26095, 77.78975, 78.32853, 78.8673, 79.3961, 79.93488, 80.47365, 81.00245, 81.60109, 82.08, 82.6088, 83.14757, 83.68635, 84.21515, 84.75392, 85.2927, 85.83147, 86.37025, 86.89905, 87.43782, 87.98658, 88.5054, 89.05415, 89.58295, 90.1317, 90.6605, 91.19927, 91.72807, 92.25687, 92.80562, 93.3444, 93.8732, 94.43193, 94.95075, 95.4995, 96.0283, 96.5571, 97.09587, 97.63465, 98.16345, 98.70222, 99.241, 99.77977, 100.30857, 100.84735, 101.38612, 101.9249, 102.4537, 102.99247, 103.53125, 104.07002, 104.6088, 105.1376, 105.67637, 106.21515, 106.75392, 107.28272, 107.8215, 108.36027, 108.88907, 109.42785, 109.96662, 110.5054, 111.0342, 111.57297, 112.10177, 112.64054, 113.17932, 113.7181, 114.24689, 114.78567, 115.32444, 115.86322, 116.39202, 116.93079, 117.45959, 117.99837, 118.53714, 119.07592, 119.60472, 120.13351, 120.66231, 121.21107, 121.73986, 122.27864, 122.81741, 123.35619, 123.88499, 124.43374, 124.95256, 125.50132, 126.03011, 126.56889, 127.09769, 127.64644, 128.17524, 128.71401, 129.24281, 129.79156, 130.32036, 130.85914, 131.38794, 131.93669, 132.45551, 133.00426, 133.52308, 134.07184, 134.60063, 135.13941, 135.66821, 136.21696, 136.73578, 137.28454, 137.81333, 138.36209, 138.88091, 139.42966, 139.95846, 140.49723, 141.02603, 141.57478, 142.10358, 142.64236, 143.17116, 143.71991, 144.23873, 144.78748, 145.32626, 145.86503, 146.37388, 146.92263, 147.45143, 147.9902, 148.519, 149.07773, 149.59655, 150.14531, 150.66413, 151.21288, 151.7317, 152.27048, 152.80925, 153.34803, 153.87683, 154.42558, 154.9444, 155.49315, 156.02195, 156.56073, 157.08952, 157.6283, 158.1571, 158.70585, 159.23465, 159.77342, 160.30222, 160.841, 161.3698, 161.91855, 162.43737, 162.9961, 163.51492, 164.0537, 164.58249, 165.14122, 165.65007, 166.19882, 166.72762, 167.28635, 167.78522, 168.33397, 168.86277, 169.41152, 169.94032, 170.47909, 170.99791, 171.54667, 172.07546, 172.62422, 173.15302, 173.69179, 174.22059, 174.75937, 175.27819, 175.83692, 176.35574, 176.90449, 177.42331, 177.98204, 178.51084, 179.04961, 179.57841, 180.12717, 180.64727, 181.17478, 181.71356, 182.25358, 182.78113, 183.32446, 183.84871, 184.36753, 184.91628, 185.45506, 185.99383, 186.53708, 187.05143, 187.5902, 188.12898, 188.65778, 189.19655, 189.73533, 190.26413, 190.8029, 191.3317, 191.88045, 192.39927, 192.94803, 193.47683, 194.0156, 194.5444, 195.08317, 195.61197, 196.15075, 196.67955, 197.21832, 197.74712, 198.29587, 198.81469, 199.35347, 199.88227, 200.43102, 200.95982, 201.49859, 202.01741, 202.56617, 203.09497, 203.64372, 204.16254, 204.74194, 205.24009, 205.77887, 206.30766, 206.83646, 207.37524, 207.91401, 208.44281, 208.98159, 209.51039, 210.04916, 210.57796, 211.11673, 211.65551, 212.18431, 212.72308, 213.26186, 213.79066, 214.32943, 214.86821, 215.39701, 215.93578, 216.47456, 217.00336, 217.54213, 218.08091, 218.60971, 219.14848, 219.68726, 220.21605, 220.75483, 221.34048, 221.8224, 222.36118, 222.89995, 223.42875, 224.01767, 224.55311, 225.0351, 225.62398, 226.15942, 226.69485, 227.23029, 227.76573, 228.30116, 228.8366, 229.37204, 229.90748, 230.44291, 230.97835] }, { "sourceId": "ed3ac4b9-0386-4f47-8c1f-eb61cbd11f52", "title": "\uB124 \uC2DC", "audioUrl": "assets/music/four-pm-promise.mp3", "duration": 222.8, "bpm": 106.991, "beatOffset": 0.5, "beatTimes": [0.52535, 1.08408, 1.64281, 2.18238, 2.7902, 3.30397, 3.86477, 4.42556, 4.98636, 5.54715, 6.10795, 6.66874, 7.22954, 7.79033, 8.29769, 8.91192, 9.42512, 9.98385, 10.54259, 11.1551, 11.67002, 12.22875, 12.78748, 13.35619, 13.91492, 14.47365, 15.03238, 15.60109, 16.15982, 16.72853, 17.28726, 17.85596, 18.41469, 18.99338, 19.54213, 20.10086, 20.66957, 21.2283, 21.78703, 22.34576, 22.90449, 23.4732, 24.03193, 24.60063, 25.14939, 25.7181, 26.27683, 26.84553, 27.40426, 27.97297, 28.52172, 29.09043, 29.64916, 30.21787, 30.7766, 31.33533, 31.89406, 32.46277, 33.0215, 33.58023, 34.13896, 34.70766, 35.26639, 35.82512, 36.38385, 36.95256, 37.51129, 38.07002, 38.62875, 39.14757, 39.75619, 40.31643, 40.87365, 41.44236, 42.00109, 42.57977, 43.11855, 43.68726, 44.23601, 44.80279, 45.36345, 45.92438, 46.51084, 47.04597, 47.60834, 48.16707, 48.72836, 49.28454, 49.85324, 50.41197, 50.98068, 51.53941, 52.09814, 52.66685, 53.2156, 53.78431, 54.34304, 54.91175, 55.47048, 56.02921, 56.58794, 57.15664, 57.7054, 58.2741, 58.83283, 59.39156, 59.95029, 60.519, 61.06776, 61.63646, 62.19519, 62.7639, 63.31265, 63.88136, 64.44009, 65.0088, 65.55755, 66.12626, 66.67501, 67.24372, 67.80245, 68.37116, 68.91991, 69.48862, 70.03737, 70.59935, 71.16481, 71.72354, 72.28227, 72.85098, 73.40971, 73.97841, 74.52717, 75.09587, 75.64651, 76.2073, 76.77206, 77.34077, 77.8995, 78.45823, 79.01696, 79.57569, 80.13442, 80.70313, 81.26186, 81.83057, 82.37932, 82.94803, 83.49678, 84.06549, 84.62422, 85.18295, 85.74168, 86.31039, 86.85914, 87.42785, 87.98658, 88.55528, 89.10404, 89.67274, 90.23147, 90.7902, 91.34893, 91.91764, 92.46639, 93.0351, 93.59383, 94.16254, 94.71129, 95.28, 95.82875, 96.40744, 96.95619, 97.5249, 98.07365, 98.64236, 99.20109, 99.7698, 100.31855, 100.88228, 101.44599, 102.00472, 102.55347, 103.12545, 103.69088, 104.24961, 104.80834, 105.36707, 105.93578, 106.49022, 107.05324, 107.61197, 108.1707, 108.72943, 109.2942, 109.85687, 110.40562, 110.97433, 111.53306, 112.10177, 112.65052, 113.21923, 113.76798, 114.33669, 114.89542, 115.46413, 116.0029, 116.58159, 117.13034, 117.69905, 118.2478, 118.81651, 119.36526, 119.94395, 120.4927, 121.06141, 121.61016, 122.17887, 122.72762, 123.29633, 123.85506, 124.42376, 124.97252, 125.54122, 126.08998, 126.66866, 127.21741, 127.78612, 128.33488, 128.90358, 129.45234, 130.03102, 130.57977, 131.14848, 131.69723, 132.25596, 132.81469, 133.3834, 133.93215, 134.50086, 135.04961, 135.64825, 136.21235, 136.77314, 137.28454, 137.85324, 138.41197, 138.98068, 139.52943, 140.09814, 140.64689, 141.22558, 141.77433, 142.34304, 142.89179, 143.4605, 144.00925, 144.57796, 145.13669, 145.69542, 146.25415, 146.81288, 147.38159, 147.94032, 148.49905, 149.11063, 149.61651, 150.18522, 150.74395, 151.30268, 151.86141, 152.43011, 152.98884, 153.59699, 154.1063, 154.66503, 155.27937, 155.84017, 156.3512, 156.96176, 157.46866, 158.08335, 158.62603, 159.20494, 159.71356, 160.32653, 160.841, 161.44812, 161.96844, 162.56971, 163.0859, 163.6913, 164.20336, 164.81289, 165.37368, 165.93448, 166.49527, 167.05607, 167.61686, 168.17766, 168.73845, 169.29924, 169.86004, 170.42083, 170.98163, 171.54242, 172.10322, 172.66401, 173.26277, 173.7856, 174.3464, 174.90719, 175.46799, 176.02878, 176.60517, 177.15037, 177.73261, 178.24145, 178.83276, 179.39355, 179.95435, 180.51514, 181.07501, 181.63673, 182.19753, 182.75832, 183.31991, 183.87991, 184.40744, 185.0015, 185.54485, 186.12309, 186.68388, 187.24468, 187.77977, 188.36627, 188.93714, 189.48786, 190.01469, 190.66322, 191.22195, 191.73104, 192.23964, 192.85263, 193.46685, 194.02558, 194.58431, 195.14304, 195.70177, 196.27048, 196.81923, 197.36798, 197.92671, 198.46058, 199.05415, 199.58217, 200.14296, 200.70376, 201.26455, 201.82785, 202.38614, 202.95528, 203.52399, 204.07274, 204.63147, 205.1902, 205.74893, 206.30766, 206.86639, 207.41515, 207.97388, 208.53261, 209.08136, 209.64009, 210.19882, 210.74757, 211.31628, 211.86503, 212.43374, 212.99247, 213.5512, 214.10993, 214.66866, 215.28442, 215.84522, 216.40601, 216.96681, 217.58204, 218.0884, 218.64919, 219.20998, 219.77078, 220.33157, 220.89237, 221.45316, 222.01396, 222.57475] }];

// experiences/korean-rhythm/listening.mjs
var check = (category, prompt, yes, no, explanation, recallPrompt, recallClaim, recallAnswer) => ({ category, prompt, claims: [{ question: yes, answer: "O" }, { question: no, answer: "X" }], explanation, recall: { prompt: recallPrompt, question: recallClaim, answer: recallAnswer } });
var LISTENING = [
  [
    check("\uC2DC\uAC04", "\uC624\uB298\uC740 \uBC14\uBE60\uC11C \uB0B4\uC77C \uB3C4\uC11C\uAD00\uC5D0 \uAC08 \uAC70\uC608\uC694.", "\uB3C4\uC11C\uAD00\uC5D0\uB294 \uB0B4\uC77C \uAC00\uB098\uC694?", "\uB3C4\uC11C\uAD00\uC5D0\uB294 \uC624\uB298 \uAC00\uB098\uC694?", "\uB3C4\uC11C\uAD00\uC5D0 \uAC00\uB294 \uB0A0\uC740 \uC624\uB298\uC774 \uC544\uB2C8\uB77C \uB0B4\uC77C\uC774\uC5D0\uC694.", "\uB0B4\uC77C\uC740 \uBC14\uBE60\uC11C \uC624\uB298 \uB3C4\uC11C\uAD00\uC5D0 \uAC00\uC694.", "\uB3C4\uC11C\uAD00\uC5D0\uB294 \uC624\uB298 \uAC00\uB098\uC694?", "O"),
    check("\uC7A5\uC18C", "\uCE74\uD398\uC5D0\uC11C \uCE5C\uAD6C\uB97C \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC5B4\uC694.", "\uC9C0\uAE08 \uCE74\uD398\uC5D0 \uC788\uB098\uC694?", "\uC9C0\uAE08 \uD559\uAD50\uC5D0 \uC788\uB098\uC694?", "\uCE74\uD398\uC5D0\uC11C \uCE5C\uAD6C\uB97C \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC5B4\uC694.", "\uCE5C\uAD6C\uB97C \uB9CC\uB098\uAE30 \uC804\uC5D0 \uB3C4\uC11C\uAD00\uC5D0\uC11C \uCC45\uC744 \uBE4C\uB9AC\uACE0 \uC788\uC5B4\uC694.", "\uC9C0\uAE08 \uCE74\uD398\uC5D0 \uC788\uB098\uC694?", "X"),
    check("\uB300\uC870", "\uC544\uCE68\uC5D0\uB294 \uBE44\uAC00 \uC654\uC9C0\uB9CC \uC9C0\uAE08\uC740 \uB9D1\uC544\uC694.", "\uC9C0\uAE08 \uB0A0\uC528\uB294 \uB9D1\uC740\uAC00\uC694?", "\uC9C0\uAE08\uB3C4 \uBE44\uAC00 \uC624\uB098\uC694?", "\u2018-\uC9C0\uB9CC\u2019 \uB4A4\uC5D0\uC11C \uC9C0\uAE08\uC740 \uB9D1\uB2E4\uACE0 \uD588\uC5B4\uC694.", "\uC544\uCE68\uC5D0\uB294 \uB9D1\uC558\uC9C0\uB9CC \uC9C0\uAE08\uC740 \uBE44\uAC00 \uC640\uC694.", "\uC9C0\uAE08 \uB0A0\uC528\uB294 \uB9D1\uC740\uAC00\uC694?", "X"),
    check("\uB300\uC2E0", "\uC800\uB294 \uCEE4\uD53C \uB300\uC2E0 \uCC28\uB97C \uC8FC\uBB38\uD588\uC5B4\uC694.", "\uCC28\uB97C \uC8FC\uBB38\uD588\uB098\uC694?", "\uCEE4\uD53C\uB97C \uC8FC\uBB38\uD588\uB098\uC694?", "\uCEE4\uD53C \uB300\uC2E0 \uACE0\uB978 \uAC83\uC740 \uCC28\uC608\uC694.", "\uC800\uB294 \uCC28 \uB300\uC2E0 \uC8FC\uC2A4\uB97C \uC8FC\uBB38\uD588\uC5B4\uC694.", "\uC8FC\uC2A4\uB97C \uC8FC\uBB38\uD588\uB098\uC694?", "O"),
    check("\uBCC0\uACBD\uB41C \uC2DC\uAC04", "\uD68C\uC758\uAC00 \uB450 \uC2DC\uC5D0\uC11C \uC138 \uC2DC\uB85C \uBC14\uB00C\uC5C8\uC5B4\uC694.", "\uD68C\uC758\uB294 \uC138 \uC2DC\uC5D0 \uC2DC\uC791\uD558\uB098\uC694?", "\uD68C\uC758\uB294 \uB450 \uC2DC\uC5D0 \uC2DC\uC791\uD558\uB098\uC694?", "\uCC98\uC74C\uC5D0\uB294 \uB450 \uC2DC\uC600\uACE0, \uBC14\uB010 \uC2DC\uAC04\uC740 \uC138 \uC2DC\uC608\uC694.", "\uD68C\uC758\uAC00 \uC138 \uC2DC\uC5D0\uC11C \uB124 \uC2DC\uB85C \uBC14\uB00C\uC5C8\uC5B4\uC694.", "\uD68C\uC758\uB294 \uC138 \uC2DC\uC5D0 \uC2DC\uC791\uD558\uB098\uC694?", "X")
  ],
  [
    check("\uC6D0\uC778\uACFC \uACB0\uACFC", "\uBE44\uAC00 \uB9CE\uC774 \uC654\uC5B4\uC694. \uADF8\uB798\uC11C \uC18C\uD48D\uC744 \uCDE8\uC18C\uD588\uC5B4\uC694.", "\uBE44 \uB54C\uBB38\uC5D0 \uC18C\uD48D\uC744 \uCDE8\uC18C\uD588\uB098\uC694?", "\uC18C\uD48D\uC744 \uB2E4\uB140\uC654\uB098\uC694?", "\uBE44\uAC00 \uC628 \uAC83\uC774 \uC6D0\uC778\uC774\uACE0 \uC18C\uD48D\uC744 \uCDE8\uC18C\uD55C \uAC83\uC774 \uACB0\uACFC\uC608\uC694.", "\uBC84\uC2A4\uB97C \uB193\uCCE4\uC5B4\uC694. \uADF8\uB798\uC11C \uD0DD\uC2DC\uB97C \uD0D4\uC5B4\uC694.", "\uBC84\uC2A4\uB97C \uD0C0\uACE0 \uAC14\uB098\uC694?", "X"),
    check("\uB300\uC870", "\uC774 \uAC00\uBC29\uC740 \uBE44\uC2F8\uC9C0\uB9CC \uC624\uB798 \uC4F8 \uC218 \uC788\uC5B4\uC694.", "\uAC00\uACA9\uC740 \uBE44\uC2F8\uB3C4 \uC624\uB798 \uC4F8 \uC218 \uC788\uB098\uC694?", "\uAC00\uACA9\uC774 \uC2FC \uAC00\uBC29\uC778\uAC00\uC694?", "\uAC00\uACA9\uC740 \uBE44\uC2F8\uC9C0\uB9CC \uC624\uB798 \uC4F8 \uC218 \uC788\uB2E4\uB294 \uC88B\uC740 \uC810\uC774 \uC788\uC5B4\uC694.", "\uC774 \uC9D1\uC740 \uC791\uC9C0\uB9CC \uAD50\uD1B5\uC774 \uD3B8\uB9AC\uD574\uC694.", "\uAD50\uD1B5\uC774 \uBD88\uD3B8\uD55C \uC9D1\uC778\uAC00\uC694?", "X"),
    check("\uBAA9\uC801", "\uCE5C\uAD6C\uB97C \uB9CC\uB098\uB824\uACE0 \uCE74\uD398\uC5D0 \uAC14\uC5B4\uC694.", "\uCE5C\uAD6C\uB97C \uB9CC\uB098\uB7EC \uAC14\uB098\uC694?", "\uCC45\uC744 \uC0AC\uB7EC \uAC14\uB098\uC694?", "\uCE74\uD398\uC5D0 \uAC04 \uBAA9\uC801\uC740 \uCE5C\uAD6C\uB97C \uB9CC\uB098\uB294 \uAC83\uC774\uC5D0\uC694.", "\uD55C\uAD6D\uC5B4\uB97C \uBC30\uC6B0\uB824\uACE0 \uD559\uC6D0\uC5D0 \uB4F1\uB85D\uD588\uC5B4\uC694.", "\uD55C\uAD6D\uC5B4\uB97C \uBC30\uC6B0\uB824\uACE0 \uB4F1\uB85D\uD588\uB098\uC694?", "O"),
    check("\uC9C4\uD589", "\uC9C0\uAE08 \uC74C\uC545\uC744 \uB4E3\uACE0 \uC788\uC5B4\uC694.", "\uC9C0\uAE08 \uC74C\uC545\uC744 \uB4E3\uB294 \uC911\uC778\uAC00\uC694?", "\uC5B4\uC81C \uB4E4\uC740 \uC74C\uC545 \uC774\uC57C\uAE30\uC778\uAC00\uC694?", "\u2018\uB4E3\uACE0 \uC788\uC5B4\uC694\u2019\uB294 \uC9C0\uAE08 \uD558\uACE0 \uC788\uB294 \uC77C\uC744 \uB9D0\uD574\uC694.", "\uC5B4\uC81C \uC74C\uC545\uC744 \uB4E4\uC5C8\uC5B4\uC694.", "\uC9C0\uAE08 \uC74C\uC545\uC744 \uB4E3\uB294 \uC911\uC778\uAC00\uC694?", "X"),
    check("\uC774\uC720", "\uB0A0\uC528\uAC00 \uCD94\uC6B0\uB2C8\uAE4C \uCC3D\uBB38\uC744 \uB2EB\uC73C\uC138\uC694.", "\uCD94\uC6CC\uC11C \uCC3D\uBB38\uC744 \uB2EB\uC73C\uB77C\uACE0 \uD588\uB098\uC694?", "\uB354\uC6CC\uC11C \uCC3D\uBB38\uC744 \uB2EB\uC73C\uB77C\uACE0 \uD588\uB098\uC694?", "\uCC3D\uBB38\uC744 \uB2EB\uC73C\uB77C\uACE0 \uD55C \uC774\uC720\uB294 \uB0A0\uC528\uAC00 \uCDA5\uAE30 \uB54C\uBB38\uC774\uC5D0\uC694.", "\uBC16\uC774 \uC2DC\uB044\uB7EC\uC6B0\uB2C8\uAE4C \uCC3D\uBB38\uC744 \uB2EB\uC73C\uC138\uC694.", "\uC2DC\uB044\uB7EC\uC6CC\uC11C \uCC3D\uBB38\uC744 \uB2EB\uC73C\uB77C\uACE0 \uD588\uB098\uC694?", "O")
  ],
  [
    check("\uC870\uAC74", "\uC774 \uC2DD\uB2F9\uC740 \uC608\uC57D\uD574\uC57C \uC774\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694.", "\uC774\uC6A9\uD558\uB824\uBA74 \uBBF8\uB9AC \uC608\uC57D\uD574\uC57C \uD558\uB098\uC694?", "\uC608\uC57D \uC5C6\uC774 \uC774\uC6A9\uD560 \uC218 \uC788\uB098\uC694?", "\uC608\uC57D\uD574\uC57C \uD55C\uB2E4\uB294 \uC870\uAC74\uC774 \uC788\uC5B4\uC694.", "\uC774 \uC2DD\uB2F9\uC740 \uC608\uC57D\uD558\uC9C0 \uC54A\uC544\uB3C4 \uC774\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694.", "\uC608\uC57D \uC5C6\uC774 \uC774\uC6A9\uD560 \uC218 \uC788\uB098\uC694?", "O"),
    check("\uBE44\uAD50", "\uC0C1\uD488\uC758 \uAC00\uACA9\uC774 \uC9C0\uB09C\uD574\uBCF4\uB2E4 \uC62C\uB790\uC5B4\uC694.", "\uC9C0\uB09C\uD574\uBCF4\uB2E4 \uB354 \uBE44\uC2F8\uC84C\uB098\uC694?", "\uC9C0\uB09C\uD574\uBCF4\uB2E4 \uB354 \uC2F8\uC84C\uB098\uC694?", "\uAC00\uACA9\uC774 \uC62C\uB790\uB2E4\uB294 \uAC83\uC740 \uB354 \uBE44\uC2F8\uC84C\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.", "\uC0C1\uD488\uC758 \uAC00\uACA9\uC774 \uC9C0\uB09C\uD574\uBCF4\uB2E4 \uB0B4\uB838\uC5B4\uC694.", "\uC9C0\uB09C\uD574\uBCF4\uB2E4 \uB354 \uBE44\uC2F8\uC84C\uB098\uC694?", "X"),
    check("\uC758\uACAC", "\uC9C1\uC6D0\uB4E4\uC740 \uC0C8\uB85C\uC6B4 \uBC29\uBC95\uC5D0 \uCC2C\uC131\uD588\uC5B4\uC694.", "\uC9C1\uC6D0\uB4E4\uC740 \uADF8 \uBC29\uBC95\uC5D0 \uB3D9\uC758\uD558\uB098\uC694?", "\uC9C1\uC6D0\uB4E4\uC740 \uADF8 \uBC29\uBC95\uC5D0 \uBC18\uB300\uD558\uB098\uC694?", "\uCC2C\uC131\uC740 \uC81C\uC548\uC774\uB098 \uC758\uACAC\uC5D0 \uB3D9\uC758\uD55C\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.", "\uC9C1\uC6D0\uB4E4\uC740 \uC0C8\uB85C\uC6B4 \uBC29\uBC95\uC5D0 \uBC18\uB300\uD588\uC5B4\uC694.", "\uC9C1\uC6D0\uB4E4\uC740 \uADF8 \uBC29\uBC95\uC5D0 \uB3D9\uC758\uD558\uB098\uC694?", "X"),
    check("\uC77C\uC815", "\uC77C\uC815\uC744 \uBCC0\uACBD\uD558\uAE30 \uC5B4\uB824\uC6CC\uC694.", "\uB0A0\uC9DC\uB97C \uBC14\uAFB8\uAE30 \uD798\uB4E0\uAC00\uC694?", "\uC774\uBBF8 \uB0A0\uC9DC\uB97C \uBC14\uAFE8\uB098\uC694?", "\uBCC0\uACBD\uD558\uAE30 \uC5B4\uB835\uB2E4\uB294 \uB9D0\uC740 \uBC14\uAFB8\uAE30 \uD798\uB4E4\uB2E4\uB294 \uB73B\uC774\uC5D0\uC694.", "\uC77C\uC815\uC744 \uBCC0\uACBD\uD588\uC5B4\uC694.", "\uB0A0\uC9DC\uB97C \uBC14\uAFE8\uB098\uC694?", "O"),
    check("\uC0DD\uD65C", "\uAD50\uD1B5\uC774 \uD3B8\uB9AC\uD55C \uACF3\uC73C\uB85C \uC774\uC0AC\uD588\uC5B4\uC694.", "\uC774\uB3D9\uD558\uAE30 \uC88B\uC740 \uACF3\uC73C\uB85C \uC9D1\uC744 \uC62E\uACBC\uB098\uC694?", "\uC9D1\uC744 \uC62E\uAE30\uC9C0 \uC54A\uACE0 \uACE0\uCCE4\uB098\uC694?", "\uAD50\uD1B5\uC774 \uD3B8\uB9AC\uD55C \uACF3\uC73C\uB85C \uC9D1\uC744 \uC62E\uACBC\uC5B4\uC694.", "\uAD50\uD1B5\uC774 \uBD88\uD3B8\uD55C \uACF3\uC5D0\uC11C \uC0B4\uACE0 \uC788\uC5B4\uC694.", "\uC774\uB3D9\uD558\uAE30 \uC88B\uC740 \uACF3\uC5D0 \uC0B4\uACE0 \uC788\uB098\uC694?", "X")
  ]
];

// experiences/korean-rhythm/core.mjs
var TRACKS = SUNO_RECORDINGS.map((recording, id) => ({
  id,
  ...recording,
  subtitle: ["\uD55C\uAD6D\uC5B4 \uC2DC\uD2F0\uD31D \xB7 \uC2DC\uAC04\uACFC \uC7A5\uC18C \uB4E3\uAE30", "\uD55C\uAD6D\uC5B4 \uC2DC\uD2F0\uD31D \xB7 \uBB38\uC7A5 \uC5F0\uACB0 \uB4E3\uAE30", "\uD55C\uAD6D\uC5B4 \uC2DC\uD2F0\uD31D \xB7 \uAC19\uC740 \uB73B \uC54C\uC544\uB4E3\uAE30"][id],
  tag: ["\uB4E3\uAE30 \xB7 \uC77C\uC0C1 \uD45C\uD604", "\uB4E3\uAE30 \xB7 \uBB38\uC7A5 \uC5F0\uACB0", "\uB4E3\uAE30 \xB7 \uB73B \uC774\uD574"][id],
  color: ["#f36f63", "#86aaf4", "#ffe07a"][id],
  questions: LISTENING[id]
}));

// experiences/korean-rhythm/personalization.mjs
var SKILLS = [["detail", "detail", "negation", "negation", "detail"], ["reason", "negation", "reason", "detail", "reason"], ["condition", "detail", "main", "detail", "main"]];
var RHYTHM_GRAMMAR = [[[["G302"], []], [["G409"], ["G406", "G409"]], [["G307"], ["G307"]], [["G208"], ["G208"]], [["G208"], ["G208"]]], [[["G208"], ["G208"]], [["G307", "G402"], ["G307"]], [["G208"], ["G208"]], [["G409"], ["G208"]], [["G410", "G211"], ["G410", "G211"]]], [[["G402"], ["G304", "G402"]], [["G208"], ["G208"]], [["G208"], ["G208"]], [[], ["G208"]], [["G208"], ["G409"]]]];
var ITEM_VERSION = Object.freeze({ t1q2r: 2 });
var RHYTHM_CANDIDATES = TRACKS.map((track) => ({
  id: `track-${track.id}`,
  trackId: track.id,
  label: track.title,
  skillIds: [...new Set(SKILLS[track.id].map((s) => `ko.listening.${s}`))],
  difficulty: track.id + 1,
  modality: "listening",
  responseFormat: "binary-choice",
  familyKeys: track.questions.map((_, i) => `korean-rhythm:t${track.id}q${i}:v1`),
  conceptIds: [...new Set((RHYTHM_GRAMMAR[track.id] || []).flatMap(([passage]) => passage))]
}));

// experiences/synk-world-app/world-learning-plan.mjs
var PACK_GOALS = {
  greetings: ["life", "people", "expression"],
  cafe: ["life", "travel", "culture", "expression"],
  store: ["life", "travel", "expression"],
  directions: ["life", "travel", "expression"],
  transit: ["travel", "study", "expression"],
  plans: ["people", "study", "work", "career", "expression"]
};
var REASONS = ["culture", "travel", "people", "life", "study", "work", "career", "exam", "hobby", "other"];
var BROAD_GOALS = ["explore", "study", "work", "clarity", "expression", "prepare"];
var supports = ["choose", "step", "independent"];
var own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var time = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
var copy = (value) => JSON.parse(JSON.stringify(value));
var knownLessons = new Map(LESSONS.map((lesson2) => [lesson2.id, lesson2]));
var iso = (value) => new Date(value).toISOString();
function clock(value) {
  const at = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : value;
  if (!time(at)) throw TypeError("WORLD learning plan needs a valid time");
  return at;
}
function worldLearningSettings(settings = {}) {
  const value = record(settings) ? settings : {};
  const reasons = Array.isArray(value.reasons) ? [...new Set(value.reasons.filter((reason) => REASONS.includes(reason)))] : [];
  const goals = value.primaryReason && reasons.includes(value.primaryReason) ? [value.primaryReason] : reasons;
  if (BROAD_GOALS.includes(value.goal) && !goals.includes(value.goal)) goals.push(value.goal);
  return {
    goals,
    ...Number.isInteger(value.minutes) && value.minutes > 0 && value.minutes <= 240 ? { minutes: value.minutes } : {},
    support: supports.includes(value.support) ? value.support : value.experience === "new" ? "step" : "choose",
    audioAvailable: value.audio !== "off"
  };
}
function presentationFor(settings) {
  const normalized = worldLearningSettings(settings);
  return {
    support: normalized.support,
    explanation: ["brief", "standard", "detailed"].includes(settings?.explanation) ? settings.explanation : "standard",
    audio: normalized.audioAvailable ? "available" : "off",
    textSize: settings?.textSize === "large" ? "large" : "standard",
    motion: settings?.motion === "reduced" ? "reduced" : "full"
  };
}
var lessonMinutes = (lesson2) => lesson2.id === "cafe-compose" ? 4 : lesson2.type === "story" ? 3 : 2;
function lessonCandidate(lesson2, index, settings) {
  const cafe = lesson2.id === "cafe-apply" || lesson2.id.startsWith("cafe-visit-") || lesson2.id === "cafe-compose";
  return {
    id: `world.life.${String(index + 1).padStart(2, "0")}.${lesson2.packId}`,
    label: lesson2.title,
    route: "lesson",
    lessonId: lesson2.id,
    packId: lesson2.packId,
    minutes: lessonMinutes(lesson2),
    minutesEstimated: true,
    targets: [],
    goals: [...PACK_GOALS[lesson2.packId]],
    supports: [...supports],
    audioRequired: false,
    modality: "reading",
    presentation: presentationFor(settings),
    ...cafe ? { inputMode: settings?.audio === "off" ? "read" : "choice", canReadWithoutAudio: true } : {}
  };
}
function verifiedReviews(progress) {
  return Object.values(record(progress?.reviews) ? progress.reviews : {}).flatMap((review) => {
    const lesson2 = knownLessons.get(review?.lessonId), question2 = lesson2?.questions.find((q) => q.id === review.questionId && q.review.id === review.id);
    if (!question2 || review.packId !== lesson2.packId || review.skillId !== question2.skillId || !time(review.dueAt) || !time(review.lastAt)) return [];
    return [{ ...review, lesson: lesson2, question: question2 }];
  });
}
function practiceNeed(review, progress, now) {
  if (!(review.lapses > 0 && review.streak === 0)) return null;
  const observations = [];
  const answer = progress.lessons?.[review.lessonId]?.answers?.[review.questionId];
  if (answer && typeof answer.correct === "boolean" && typeof answer.helped === "boolean") observations.push({ at: answer.at, kind: answer.correct ? answer.helped ? "assisted" : "independent" : "retry" });
  const repeated = progress.activeReview?.answers?.[review.id];
  if (repeated && typeof repeated.correct === "boolean" && typeof repeated.helped === "boolean") observations.push({ at: repeated.at, kind: repeated.correct ? repeated.helped ? "assisted" : "independent" : "retry" });
  for (const day of Object.values(progress.daily?.days || {})) {
    const item = day?.items?.[review.questionId];
    if (item?.lessonId === review.lessonId && ["retry", "assisted", "independent"].includes(item.outcome)) observations.push({ at: item.observedAt, kind: item.outcome });
  }
  const latest = observations.filter((value) => time(value.at) && value.at <= now).sort((a, b) => b.at - a.at)[0];
  if (!latest || latest.at < review.lastAt || !["retry", "assisted"].includes(latest.kind)) return null;
  return { kind: latest.kind, at: iso(latest.at), evidenceRefs: [`life.${review.lessonId}.${review.questionId}`] };
}
function buildWorldLearningCandidates({ progress = {}, settings = {}, now = Date.now() } = {}) {
  const at = clock(now), source = record(progress) ? progress : {}, candidates = [];
  PACKS.forEach((pack, index) => {
    const next = pack.lessons.find((lesson2) => !time(source.lessons?.[lesson2.id]?.completedAt));
    if (next) candidates.push(lessonCandidate(knownLessons.get(next.id), index, settings));
  });
  const reviews = verifiedReviews(source).filter((review) => review.dueAt <= at && review.lastAt <= at);
  const groups = /* @__PURE__ */ new Map();
  for (const review of reviews) {
    if (!groups.has(review.lessonId)) groups.set(review.lessonId, []);
    groups.get(review.lessonId).push(review);
  }
  for (const [lessonId, rows2] of groups) {
    rows2.sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
    const need = rows2.map((review) => practiceNeed(review, source, at)).filter(Boolean).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    candidates.push({
      id: `world.review.${lessonId}`,
      label: `${rows2[0].lesson.title} \xB7 \uC0C8 \uC0C1\uD669 \uBCF5\uC2B5`,
      route: "review",
      lessonId,
      packId: rows2[0].packId,
      minutes: Math.max(1, Math.ceil(rows2.length / 3)),
      minutesEstimated: true,
      targets: [],
      goals: [...PACK_GOALS[rows2[0].packId]],
      supports: [...supports],
      audioRequired: false,
      modality: "reading",
      reviewIds: rows2.map((review) => review.id),
      reviewAt: iso(rows2[0].dueAt),
      presentation: presentationFor(settings),
      ...need ? { practiceNeed: need } : {}
    });
  }
  const runnerTargets = LISTENING_CHECKS.map((item) => {
    const target = checkMetadata(item);
    return {
      id: target.id,
      skillIds: [target.skillId],
      difficulty: target.difficulty,
      modality: target.modality,
      responseFormat: target.responseFormat,
      familyKeys: [target.familyKey],
      itemKey: target.itemKey,
      conceptIds: [...target.conceptIds]
    };
  });
  candidates.push(
    {
      id: "world.play.runner",
      label: "\uBC14\uB78C\uAE38 \xB7 \uC9E7\uC740 \uC9C0\uC2DC \uB4E3\uAE30",
      route: "game",
      gameId: "runner",
      minutes: 3,
      minutesEstimated: true,
      targets: runnerTargets,
      goals: ["exam", "prepare", "listening", "travel"],
      audioRequired: true,
      modality: "listening",
      presentation: presentationFor(settings)
    },
    {
      id: "world.play.rhythm",
      label: "\uB9D0\uC758 \uB9AC\uB4EC \xB7 \uB4E3\uACE0 \uB0B4\uC6A9 \uD655\uC778",
      route: "game",
      gameId: "rhythm",
      minutes: 4,
      minutesEstimated: true,
      targets: copy(RHYTHM_CANDIDATES),
      goals: ["exam", "prepare", "listening", "culture", "hobby", "explore"],
      audioRequired: true,
      modality: "listening",
      presentation: presentationFor(settings)
    },
    {
      id: "world.play.hangul",
      label: "\uD55C\uAE00 \uB9CC\uB098\uAE30 \xB7 \uC18C\uB9AC\uC640 \uAE00\uC790",
      route: "game",
      gameId: "hangul",
      minutes: 5,
      minutesEstimated: true,
      targets: [],
      goals: ["study", "culture", "hobby", "explore"],
      audioRequired: true,
      modality: "listening",
      presentation: presentationFor(settings)
    }
  );
  return candidates;
}
function resumeCandidates(progress, settings, now) {
  const result = [];
  const lesson2 = knownLessons.get(progress?.activeLessonId), saved = lesson2 && progress.lessons?.[lesson2.id];
  if (lesson2 && saved && time(saved.startedAt) && saved.startedAt <= now) {
    const index = PACKS.findIndex((pack) => pack.id === lesson2.packId);
    result.push({ ...lessonCandidate(lesson2, index, settings), id: `world.resume.lesson.${lesson2.id}`, resume: true, label: `${lesson2.title} \xB7 \uC774\uC5B4 \uD558\uAE30` });
  }
  const session = progress?.activeReview;
  if (!session || !Array.isArray(session.ids) || !time(session.startedAt) || session.startedAt > now) return result;
  const pending = session.ids.filter((id) => !own(session.answers, id)), reviews = verifiedReviews(progress), first = reviews.find((review) => review.id === pending[0]);
  if (!first) return result;
  result.push({
    id: "world.resume.review",
    label: "\uD558\uB358 \uC0C8 \uC0C1\uD669 \uBCF5\uC2B5 \xB7 \uC774\uC5B4 \uD558\uAE30",
    route: "review",
    lessonId: first.lessonId,
    packId: first.packId,
    resume: true,
    reviewIds: pending.filter((id) => reviews.some((review) => review.id === id)),
    minutes: Math.max(1, Math.ceil(pending.length / 3)),
    minutesEstimated: true,
    targets: [],
    goals: [...PACK_GOALS[first.packId]],
    supports: [...supports],
    audioRequired: false,
    modality: "reading",
    reviewAt: iso(session.startedAt),
    presentation: presentationFor(settings)
  });
  return result;
}
function createWorldLearningPlan({ summary = null, progress = {}, settings = {}, now = Date.now(), recommendActivities } = {}) {
  if (typeof recommendActivities !== "function") throw TypeError("WORLD learning plan needs Core recommendActivities");
  const at = clock(now), source = record(progress) ? progress : {}, normalized = worldLearningSettings(settings);
  const profile = record(summary) && Array.isArray(summary.skills) && typeof summary.evidenceComplete === "boolean" ? summary : { skills: [], evidenceComplete: false, asOf: iso(at) };
  const skills = new Set(profile.skills.map((skill2) => skill2.id));
  const resumes = resumeCandidates(source, settings, at), resumingReview = resumes.some((candidate) => candidate.route === "review");
  const candidates = [...resumes, ...buildWorldLearningCandidates({ progress: source, settings, now: at }).filter((candidate) => !(resumingReview && candidate.route === "review") && !resumes.some((resume) => candidate.route === "lesson" && resume.route === "lesson" && resume.lessonId === candidate.lessonId))];
  const ready = candidates.map((candidate) => ({ ...candidate, targets: candidate.targets.filter((target) => target.skillIds.every((id) => skills.has(id))) }));
  const ranked = recommendActivities({ profile, candidates: ready, settings: normalized, at: iso(at) });
  const excluded = new Set((ranked.excluded || []).map((item) => item.id));
  const offered = resumes.find((resume) => !excluded.has(resume.id) && [ranked.selected, ...ranked.alternatives || []].some((item) => item?.id === resume.id)) || null;
  const result = offered ? {
    ...ranked,
    status: "ready",
    selected: offered,
    alternatives: [ranked.selected, ...ranked.alternatives || []].filter((item) => item && item.id !== offered.id),
    reason: "\uD558\uB358 \uD559\uC2B5\uC758 \uAC19\uC740 \uC790\uB9AC\uC5D0\uC11C \uC774\uC5B4\uAC00\uC694. \uB2E4\uB978 \uD65C\uB3D9\uC744 \uACE8\uB77C\uB3C4 \uC9C0\uAE08 \uC9C4\uB3C4\uB294 \uB0A8\uC544 \uC788\uC5B4\uC694.",
    reasons: ["progress.resume"],
    basis: "host-progress",
    id: offered.id,
    evidence: [],
    hostEvidence: null,
    reviewAt: offered.reviewAt || null,
    reviewSource: offered.reviewAt ? "host-schedule" : null,
    focusSkillId: null,
    state: null,
    matchedGoals: offered.goals.filter((goal) => normalized.goals.includes(goal))
  } : ranked;
  return {
    ...result,
    candidates: ready,
    resume: offered,
    presentation: presentationFor(settings),
    settings: normalized,
    learningEffectClaim: false,
    abilityClaim: false,
    grade: null
  };
}

// experiences/synk-world-app/life-progress-port.mjs
var LIFE_PROGRESS_KEY = "synk.life-korean.progress.v1";
async function createLifeProgressPort({ accountId: id, client, guard, storage: cache = globalThis.localStorage, onStatus = () => {
}, target = globalThis, onDispose = () => {
} } = {}) {
  if (typeof id !== "string" || !id || typeof guard !== "function") throw TypeError("Verified life progress owner required");
  let disposed = false;
  const check2 = () => {
    guard();
    if (disposed) throw Object.assign(Error("\uC774 \uACC4\uC815\uC758 \uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC5F0\uACB0\uC774 \uB05D\uB0AC\uC5B4\uC694."), { code: "ACCOUNT_CHANGED" });
  };
  const resolvedKey = `${LIFE_PROGRESS_KEY}:resolved:${encodeURIComponent(id)}`;
  function recoveredEntries() {
    check2();
    const prefix = `synk.play.account.v1:${encodeURIComponent(id)}:rejected:`, entries = [];
    let resolved = [];
    try {
      resolved = JSON.parse(cache.getItem(resolvedKey) || "[]");
      if (!Array.isArray(resolved)) throw Error();
    } catch {
      throw Object.assign(Error("\uC9C4\uB3C4 \uBCF5\uAD6C \uC120\uD0DD\uC744 \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC6D0\uBCF8\uC740 \uBCF4\uC874\uD588\uC5B4\uC694."), { code: "LIFE_PROGRESS_UNREADABLE" });
    }
    for (let index = 0; index < cache.length; index++) {
      const recordKey = cache.key(index);
      if (!recordKey?.startsWith(prefix)) continue;
      let record2;
      try {
        record2 = JSON.parse(cache.getItem(recordKey));
      } catch {
        throw Object.assign(Error("\uC0DD\uD65C \uC9C4\uB3C4 \uC6D0\uBCF8\uC744 \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694."), { code: "LIFE_PROGRESS_UNREADABLE" });
      }
      if (record2.accountId !== id || recordKey !== prefix + record2.entry?.body?.id) throw Object.assign(Error("\uC0DD\uD65C \uC9C4\uB3C4 \uC6D0\uBCF8\uC758 \uACC4\uC815\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694."), { code: "LIFE_PROGRESS_UNREADABLE" });
      if (resolved.includes(record2.entry.body.id)) continue;
      const change = record2.entry.body.action === "progress" && record2.entry.body.changes.find((change2) => change2.key === LIFE_PROGRESS_KEY);
      if (change) entries.push({ ...record2, change });
    }
    return entries.sort((a, b) => a.entry.at - b.entry.at || a.entry.body.id.localeCompare(b.entry.body.id));
  }
  function lifeStatus() {
    const value = host.status(), prefix = `synk.play.account.v1:${encodeURIComponent(id)}:`;
    let pending = 0, rejected = 0, code;
    if (disposed) return { ...value, phase: "stopped", pending: 0, rejected: 0, message: "\uC774 \uACC4\uC815\uC758 \uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC5F0\uACB0\uC774 \uB05D\uB0AC\uC5B4\uC694." };
    for (let index = 0; index < cache.length; index++) {
      const recordKey = cache.key(index);
      if (!recordKey?.startsWith(prefix)) continue;
      try {
        const record2 = JSON.parse(cache.getItem(recordKey)), body = record2.entry?.body || record2.body;
        if (body?.action !== "progress" || !body.changes?.some((change) => change.key === LIFE_PROGRESS_KEY)) continue;
        if (recordKey.startsWith(prefix + "pending:")) pending++;
      } catch {
      }
    }
    try {
      const entries = recoveredEntries(), current = host.snapshot().state.records[LIFE_PROGRESS_KEY] ?? null;
      if (entries.length && entries.at(-1).change.value !== current) {
        rejected = entries.length;
        code = entries.at(-1).code;
      }
    } catch (error2) {
      code = error2.code;
      return { ...value, pending, rejected: 1, phase: "unreadable", code, message: "\uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC9C4\uB3C4 \uC6D0\uBCF8\uC744 \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694. \uAE30\uC874 \uAE30\uB85D\uC740 \uBCF4\uC874\uD588\uC5B4\uC694." };
    }
    return { ...value, pending, rejected, ...rejected ? { phase: "unsaved", code, message: "\uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC9C4\uB3C4\uB294 \uC544\uC9C1 SYNK \uACC4\uC815\uC5D0 \uC800\uC7A5\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694. \uC6D0\uBCF8\uC744 \uC774 \uAE30\uAE30\uC5D0 \uBCF4\uAD00\uD588\uC5B4\uC694." } : value.phase === "synced" ? { message: "\uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC9C4\uB3C4\uAC00 SYNK \uACC4\uC815\uC5D0 \uC800\uC7A5\uB410\uC5B4\uC694." } : {} };
  }
  const host = createWorldPlayHost({
    accountId: id,
    client,
    guard: check2,
    storage: cache,
    locks: target.navigator?.locks,
    onStatus: () => {
      try {
        onStatus(lifeStatus());
      } catch {
      }
    }
  });
  const gameStorage = host.storage();
  const onlyLife = (key) => {
    check2();
    if (key !== LIFE_PROGRESS_KEY) throw new TypeError("Only life-Korean progress is available");
  };
  const port = Object.freeze({
    accountId: id,
    guard: check2,
    storage: Object.freeze({ getItem(key) {
      onlyLife(key);
      const value = gameStorage.getItem(key), entries = recoveredEntries();
      if (entries.length && entries.at(-1).change.value !== value) throw Object.assign(Error("\uC774 \uAE30\uAE30\uC5D0 \uBCF4\uC874\uB41C \uC0DD\uD65C \uC9C4\uB3C4\uAC00 \uC788\uC5B4\uC694. \uC0AC\uC6A9\uD560 \uAE30\uB85D\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."), { code: "LIFE_PROGRESS_REJECTED" });
      return value;
    }, setItem(key, value) {
      onlyLife(key);
      gameStorage.setItem(key, value);
    }, removeItem(key) {
      onlyLife(key);
      gameStorage.removeItem(key);
    } }),
    status: lifeStatus,
    async flush() {
      check2();
      await host.flush();
      check2();
      return lifeStatus();
    },
    async retry() {
      check2();
      await host.retry();
      check2();
      return lifeStatus();
    },
    recoverySnapshot() {
      check2();
      const value = recoveredEntries().at(-1)?.change.value;
      if (value === void 0 || value === null) return null;
      try {
        return JSON.parse(value);
      } catch {
        throw Object.assign(Error("\uC0DD\uD65C \uC9C4\uB3C4 \uC6D0\uBCF8\uC744 \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694."), { code: "LIFE_PROGRESS_UNREADABLE" });
      }
    },
    async resolve(choice) {
      check2();
      if (!["local", "remote"].includes(choice)) throw new TypeError("Invalid life progress choice");
      if (host.status().phase === "conflict") {
        await host.resolve(choice);
        check2();
        return lifeStatus();
      }
      const entries = recoveredEntries();
      if (!entries.length) return lifeStatus();
      if (choice === "local") {
        gameStorage.getItem(LIFE_PROGRESS_KEY);
        const value = entries.at(-1).change.value;
        value === null ? gameStorage.removeItem(LIFE_PROGRESS_KEY) : gameStorage.setItem(LIFE_PROGRESS_KEY, value);
        await host.flush();
        check2();
        if (lifeStatus().rejected) return lifeStatus();
      }
      const resolved = JSON.parse(cache.getItem(resolvedKey) || "[]");
      cache.setItem(resolvedKey, JSON.stringify([.../* @__PURE__ */ new Set([...resolved, ...entries.map((record2) => record2.entry.body.id)])]));
      return lifeStatus();
    },
    subscribe: (fn) => host.subscribe(() => fn(lifeStatus())),
    dispose() {
      if (disposed) return;
      disposed = true;
      host.stop();
      onDispose(port);
    }
  });
  try {
    await host.ready();
    check2();
    return port;
  } catch (error2) {
    if (error2.code === "REVISION_CONFLICT") {
      check2();
      return port;
    }
    port.dispose();
    throw error2;
  }
}

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
var authErrors = /* @__PURE__ */ new Set(["AUTH_REQUIRED", "AUTH_SESSION_MISSING", "SESSION_REVOKED", "UNAUTHORIZED", "ACCOUNT_UNAVAILABLE", "PRODUCT_FORBIDDEN", "PLATFORM_ACCOUNT_MISMATCH"]);
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
  onConnect = () => {
  },
  bridge = globalThis.synkDesktop,
  accountFactory = import_account_client.default.createAccountClient,
  requestToken = tokenRequest,
  now = Date.now
} = {}) {
  const native = typeof bridge?.accountRequest === "function" && typeof bridge?.authStatus === "function";
  const config = readConfig(raw, getUrl()), key = "synk.oauth.session.world";
  const binding = [config.supabaseUrl, config.accountApiUrl, config.clients.world.clientId, config.clients.world.redirectUri].join("|");
  const entry = createPlatformEntry({ clientKey: "world", getUrl, replaceUrl });
  let session = null, rawSession = null, owner = null, currentSessionId = null, currentAccount = null, epoch = 0, closed = false, refreshing = null, pendingExchange = null, townBinding = null, townStateRevision = -1, verifiedClient = null, gameHost = null, gameLaunch = 0, lifeHost = null, lifeLaunch = 0, verification = 0;
  let nativeIdentity = null, nativeAccountId = null, nativeGeneration = -1, signedOutGeneration = -1, nativeEvents = 0, nativeReady = null, unsubscribe = null;
  const controllers = /* @__PURE__ */ new Set();
  const guard = (expected) => {
    if (closed || expected !== epoch) throw changed();
    if (!native && session && storage.getItem(key) !== rawSession) {
      clear();
      throw changed();
    }
  };
  const forgetSession = () => {
    if (!native) storage.removeItem(key);
  };
  const clientFor = (expected) => native ? createDesktopAccountClient({ bridge, product: "world", guard: () => guard(expected) }) : accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product: "world", getAccessToken: () => session?.access_token, refresh: () => renew(expected), guard: () => guard(expected), fetch: fetcher });
  const gameBinding = (data) => JSON.stringify([data?.account?.synk_user_id, data?.account?.status, data?.learning?.enabled, data?.learning?.revision, data?.capabilities?.learningSync]);
  function stopGames() {
    gameHost?.dispose();
    gameHost = null;
  }
  function clear() {
    epoch++;
    gameLaunch++;
    lifeLaunch++;
    verification++;
    stopGames();
    lifeHost?.dispose();
    lifeHost = null;
    session = null;
    owner = null;
    currentSessionId = null;
    currentAccount = null;
    verifiedClient = null;
    townBinding = null;
    townStateRevision = -1;
    nativeIdentity = null;
    nativeAccountId = null;
    for (const c of controllers) c.abort();
    onInvalidate();
  }
  function nativeStatus(state) {
    if (closed) return false;
    const generation = state?.sessionGeneration, id = state?.account?.synk_user_id;
    if (!Number.isSafeInteger(generation) || generation < nativeGeneration) return !!session;
    nativeGeneration = generation;
    if (state.status === "restoring" && !state.error && nativeIdentity && nativeIdentity === `${nativeAccountId}:${generation}`) return true;
    if (state.signedIn === true && typeof id === "string" && id && generation > signedOutGeneration) {
      const identity = `${id}:${generation}`;
      if (identity !== nativeIdentity) {
        clear();
        nativeIdentity = identity;
        nativeAccountId = id;
        session = { native: true };
      }
      return true;
    }
    if (session || owner) clear();
    return false;
  }
  async function prepareNative() {
    if (nativeReady) return nativeReady;
    const expected = epoch;
    const pending = (async () => {
      if (typeof bridge.getEnvironment !== "function" || typeof bridge.onAuthChanged !== "function" || typeof bridge.authSignIn !== "function" || typeof bridge.authSignOut !== "function") throw Object.assign(Error("WORLD \uC571\uC758 \uACC4\uC815 \uC5F0\uACB0\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "INVALID_BRIDGE" });
      const environment = await bridge.getEnvironment();
      guard(expected);
      if (environment?.clientId !== "world") throw Object.assign(Error("WORLD \uC571\uC758 \uACC4\uC815 \uC5F0\uACB0\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "INVALID_BRIDGE" });
      unsubscribe = bridge.onAuthChanged((state) => {
        const before = nativeIdentity;
        nativeEvents++;
        if (nativeStatus(state) && nativeIdentity !== before) {
          const identity = nativeIdentity;
          queueMicrotask(() => {
            if (!closed && nativeIdentity === identity) onConnect();
          });
        }
      });
    })();
    nativeReady = pending;
    try {
      await pending;
    } catch (error2) {
      if (nativeReady === pending) nativeReady = null;
      throw error2;
    }
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
    const read = ++verification;
    if (!native && session.expires_at <= now() + 3e4) {
      await renew(expected);
      guard(expected);
    }
    const client = clientFor(expected);
    const data = await client.load();
    guard(expected);
    if (read !== verification) throw changed();
    const id = data.account?.synk_user_id;
    if (data.ok !== true || typeof id !== "string" || !id || data.account.status !== "active") throw Object.assign(Error("\uD65C\uC131\uD654\uB41C SYNK ID\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "ACCOUNT_UNAVAILABLE" });
    if (!native) entry.assertAccount(id);
    if (owner && id !== owner || native && id !== nativeAccountId) {
      clear();
      throw changed();
    }
    owner = id;
    if (currentAccount && gameBinding(currentAccount) !== gameBinding(data)) stopGames();
    currentSessionId = data.sessions?.find((s) => s.current && !s.revoked)?.id || null;
    currentAccount = data;
    verifiedClient = client;
    return true;
  }
  async function restore() {
    if (native) {
      await prepareNative();
      guard(epoch);
      const observed = nativeEvents, state = await bridge.authStatus();
      guard(epoch);
      if (observed === nativeEvents) nativeStatus(state);
      if (!session) return false;
      const expected2 = epoch;
      try {
        return await verify(expected2);
      } catch (error2) {
        if (expected2 === epoch && authErrors.has(error2.code)) clear();
        throw error2;
      }
    }
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
    } catch (error2) {
      if (authErrors.has(error2.code)) {
        clear();
        forgetSession();
      }
      throw error2;
    }
  }
  async function signIn() {
    if (native) {
      await prepareNative();
      guard(epoch);
      clear();
      const result = await bridge.authSignIn();
      if (result?.ok === false) throw Object.assign(Error(result.error?.message || "SYNK ID \uB85C\uADF8\uC778\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694."), { code: result.error?.code || "AUTH_REQUIRED" });
      return;
    }
    clear();
    entry.resume();
    entry.stop();
    const expected = epoch;
    const url = await beginOAuth({ config, product: "world", storage, now: now() });
    guard(expected);
    navigate(url);
  }
  async function prepareGame(options = {}) {
    const expected = epoch, launch = ++gameLaunch;
    guard(expected);
    if (!owner || !session) throw Object.assign(Error("SYNK ID\uB85C \uB85C\uADF8\uC778\uD55C \uB4A4 \uB180\uC774\uB97C \uC774\uC5B4\uAC00\uC694."), { code: "AUTH_REQUIRED", status: 401 });
    stopGames();
    try {
      await verify(expected);
      guard(expected);
      if (launch !== gameLaunch) throw changed();
      const id = owner, bound = gameBinding(currentAccount), client = verifiedClient, prefs = currentAccount.learning;
      if (!client?.play || !prefs || typeof prefs.enabled !== "boolean" || !Number.isSafeInteger(prefs.revision) || prefs.revision < 1) throw Object.assign(Error("\uACC4\uC815\uC758 \uAC8C\uC784 \uC800\uC7A5\uACFC \uD559\uC2B5 \uC124\uC815\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "PLAY_NOT_READY" });
      const check2 = () => {
        guard(expected);
        if (launch !== gameLaunch || owner !== id || gameBinding(currentAccount) !== bound) throw changed();
      };
      const wrap = (port) => port && Object.freeze(Object.fromEntries(Object.entries(port).filter(([, fn]) => typeof fn === "function").map(([name, fn]) => [name, async (...args) => {
        check2();
        try {
          const value = await fn(...args);
          check2();
          return value;
        } catch (error2) {
          if (expected === epoch && authErrors.has(error2.code)) {
            clear();
            forgetSession();
          }
          throw error2;
        }
      }])));
      const current = createWorldGameHost({
        ...options,
        accountId: id,
        revision: prefs.revision,
        connected: prefs.enabled && currentAccount.capabilities?.learningSync === true,
        play: wrap(client.play),
        learning: wrap(client.learning),
        memory: wrap(client.memory),
        guard: check2
      });
      gameHost = current;
      try {
        await current.ready();
        check2();
        current.install();
        return current.publicHandle;
      } catch (error2) {
        current.dispose();
        if (gameHost === current) gameHost = null;
        throw error2;
      }
    } catch (error2) {
      if (expected === epoch && authErrors.has(error2.code)) {
        clear();
        forgetSession();
      }
      throw error2;
    }
  }
  async function prepareLifeProgress({ storage: cache = globalThis.localStorage, onStatus = () => {
  }, target = globalThis } = {}) {
    const expected = epoch, launch = ++lifeLaunch;
    guard(expected);
    if (!owner || !session) throw Object.assign(Error("SYNK ID\uB85C \uB85C\uADF8\uC778\uD55C \uB4A4 \uC0DD\uD65C \uD55C\uAD6D\uC5B4\uB97C \uC774\uC5B4\uAC00\uC694."), { code: "AUTH_REQUIRED", status: 401 });
    lifeHost?.dispose();
    lifeHost = null;
    try {
      await verify(expected);
      guard(expected);
      if (launch !== lifeLaunch) throw changed();
    } catch (error2) {
      if (expected === epoch && authErrors.has(error2.code)) {
        clear();
        forgetSession();
      }
      throw error2;
    }
    const id = owner, client = verifiedClient;
    if (typeof client?.play?.load !== "function" || typeof client?.play?.mutate !== "function") throw Object.assign(Error("\uACC4\uC815\uC758 \uC0DD\uD65C \uD55C\uAD6D\uC5B4 \uC800\uC7A5 \uC5F0\uACB0\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."), { code: "PLAY_NOT_READY" });
    const check2 = () => {
      guard(expected);
      if (launch !== lifeLaunch || owner !== id) throw changed();
    };
    const wrap = (fn) => async (...args) => {
      check2();
      try {
        const value = await fn(...args);
        check2();
        return value;
      } catch (error2) {
        if (expected === epoch && authErrors.has(error2.code)) {
          clear();
          forgetSession();
        }
        throw error2;
      }
    };
    const port = await createLifeProgressPort({
      accountId: id,
      client: { load: wrap(() => client.play.load()), mutate: wrap((body) => client.play.mutate(body)) },
      guard: check2,
      storage: cache,
      target,
      onStatus,
      onDispose: (value) => {
        if (lifeHost === value) lifeHost = null;
      }
    });
    check2();
    lifeHost = port;
    return port;
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
    const accept = (data, ok, status) => {
      guard(expected);
      if (status === 401 || authErrors.has(data?.error?.code)) {
        clear();
        forgetSession();
      }
      if (ok && path !== "town/sharing" && !path.startsWith("enrollment/") && data?.accountId !== owner) throw Object.assign(Error("\uB2E4\uB978 \uACC4\uC815\uC758 \uC751\uB2F5\uC744 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC558\uC5B4\uC694."), { code: "ACCOUNT_MISMATCH" });
      if (ok && data.binding) {
        const next = data.binding;
        if (townBinding && (next.classId !== townBinding.classId || Number(next.sharing?.revision) < Number(townBinding.sharing?.revision) || Number(next.membershipRevision) < Number(townBinding.membershipRevision) || next.sharing?.revision === townBinding.sharing?.revision && townBinding.sharing?.enabled === false && next.sharing?.enabled === true)) throw Object.assign(Error("TOWN_SNAPSHOT_CHANGED"), { code: "TOWN_SNAPSHOT_CHANGED" });
        townBinding = next;
      }
      if (ok && path.startsWith("town/") && Number.isSafeInteger(data.state?.revision)) {
        if (data.state.revision < townStateRevision) throw Object.assign(Error("TOWN_SNAPSHOT_CHANGED"), { code: "TOWN_SNAPSHOT_CHANGED" });
        townStateRevision = data.state.revision;
      }
      return { ok, status, json: async () => {
        guard(expected);
        return data;
      } };
    };
    if (native) {
      const body = options.body === void 0 ? void 0 : JSON.parse(options.body);
      if (body !== void 0 && (!body || typeof body !== "object" || Array.isArray(body))) throw new TypeError("Invalid WORLD request body");
      const data = await bridge.accountRequest("worldRequest", { route: path, ...body === void 0 ? {} : { body }, ...path.startsWith("town/") && path !== "town/entry" && townBinding?.classId ? { classId: townBinding.classId } : {} });
      return accept(data, data?.ok === true, data?.ok === true ? 200 : data?.error?.status || 503);
    }
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
        return accept(data, response.ok, response.status);
      }
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }
  async function logout() {
    if (native) {
      signedOutGeneration = Math.max(signedOutGeneration, nativeGeneration);
      clear();
      const result = await bridge.authSignOut();
      return { serverRevoked: result?.ok === true && result.serverRevoked === true };
    }
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
    prepareGame,
    prepareLifeProgress,
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
      const client = clientFor(expected);
      try {
        await client.setLearning(enabled, expectedRevision);
        guard(expected);
        await verify(expected);
        guard(expected);
        return this.preferences();
      } catch (error2) {
        if (authErrors.has(error2.code)) {
          clear();
          forgetSession();
        }
        throw error2;
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
      unsubscribe?.();
      unsubscribe = null;
    }
  });
}
var export_worldLearning = import_game_browser2.default;
export {
  createLifeProgressPort,
  createLocalWorldLearningHost,
  createWorldAccount,
  createWorldLearningPlan,
  loadWorldConfig,
  publicWorldConfig,
  export_worldLearning as worldLearning
};
