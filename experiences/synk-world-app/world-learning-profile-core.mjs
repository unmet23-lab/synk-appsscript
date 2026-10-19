var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

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
      const copy = (value) => JSON.parse(JSON.stringify(value));
      const canonical = (value) => JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key2) => [key2, entry[key2]])) : entry);
      const id = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      function choiceRecord(value) {
        const optionId = (entry) => typeof entry === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(entry) && !["constructor", "prototype", "__proto__"].includes(entry);
        if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.keys(value).length !== 2 || !Object.hasOwn(value, "selectedId") || !Object.hasOwn(value, "correctId") || !optionId(value.selectedId) || !optionId(value.correctId)) throw new TypeError("Trail: invalid choice IDs");
        return { selectedId: value.selectedId, correctId: value.correctId };
      }
      const time = (value) => {
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
      const atOf = (e) => vouched.get(e)?.at ?? time(e.at);
      const recordedOf = (e) => vouched.get(e)?.recordedAt ?? time(e.recordedAt);
      const uniqueList = (values, valid, max) => Array.isArray(values) && values.length <= max && values.every(valid) && new Set(values).size === values.length;
      const tag = (v) => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= 120 && !/[\r\n]/.test(v);
      function validate(event) {
        if (!event || !TYPES.includes(event.type) || event.schema !== 1 || !id(event.id)) throw new TypeError("Trail: invalid practice event");
        const fields = [...BASE, ...FIELDS[event.type]];
        if (Object.keys(event).some((k) => !fields.includes(k) && !(OPTIONAL[event.type] || []).includes(k)) || fields.some((k) => !Object.hasOwn(event, k))) throw new TypeError("Trail: unexpected or missing practice field");
        key(event.scope);
        if (time(event.recordedAt) < time(event.at)) throw new TypeError("Trail: recorded before occurrence");
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
        vouched.set(event, { scope: `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}`, at: time(event.at), recordedAt: time(event.recordedAt) });
        return event;
      }
      function checkLink(events, event) {
        const attempts = { count: 0, latest: -Infinity };
        for (const earlier of events) if (earlier.type === TYPES[2] && earlier.presentationId === event.presentationId) {
          attempts.count += 1;
          attempts.latest = Math.max(attempts.latest, time(earlier.at));
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
        const scopeId = key(scope), cutoff = time(asOf), recordedCutoff = time(recordedAsOf);
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
          scope: copy(scope),
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
        const helped = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set(), rows = /* @__PURE__ */ new Map(), covering = /* @__PURE__ */ new Map();
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
          rows.set(event.id, row);
          return row;
        }
        return {
          add,
          get exact() {
            return exact;
          },
          attempt: (eventId) => rows.get(eventId) || null,
          met: (itemKey, familyKey) => seen.has(`item:${itemKey}`) || familyKey != null && seen.has(`family:${familyKey}`)
        };
      }
      const RECORD = ["itemKey", "conceptIds", "at", "verdict"];
      const record = (r) => !!r && typeof r === "object" && Object.keys(r).length === RECORD.length && RECORD.every((k) => Object.hasOwn(r, k)) && id(r.itemKey) && uniqueList(r.conceptIds, id, 32) && typeof r.at === "string" && Number.isFinite(Date.parse(r.at)) && (r.verdict === null || VERDICTS.includes(r.verdict));
      const frozen = (r) => Object.freeze({ ...copy(r), conceptIds: Object.freeze([...r.conceptIds]) });
      function openHistory(stored, pending = []) {
        const readable = !!stored && typeof stored === "object" && Array.isArray(stored.records) && typeof stored.partial === "boolean" && stored.records.every(record) && new Set(stored.records.map((r) => r.itemKey)).size === stored.records.length;
        const pendingOk = Array.isArray(pending) && pending.every(record);
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
      const opened = (history) => !!history && typeof history.firstExposure === "function" && typeof history.readable === "boolean" && Array.isArray(history.records) && typeof history.partial === "boolean" && history.records.every(record);
      function remember(history, summary) {
        if (!opened(history)) throw new TypeError("Trail: open the history first");
        if (!summary || summary.version !== VERSION || !Array.isArray(summary.met)) throw new TypeError("Trail: use a practice summary");
        if (!history.readable) return null;
        const known = new Set(history.records.map((r) => r.itemKey));
        const added = summary.met.filter((r) => record(r) && !known.has(r.itemKey));
        return { records: [...history.records, ...added].map(copy), partial: history.partial };
      }
      function createPracticeOutcomeIndex(summary) {
        if (!summary || summary.version !== VERSION || !Array.isArray(summary.attempts)) throw new TypeError("Trail: use a practice summary");
        const owner = key(summary.scope), cutoff = time(summary.asOf), recordedCutoff = time(summary.recordedAsOf ?? summary.asOf);
        const attempts = /* @__PURE__ */ new Map();
        for (const item of summary.attempts) {
          if (!id(item.eventId) || !id(item.presentationId) || !id(item.decisionId) || !Array.isArray(item.conceptIds) || item.conceptIds.some((value) => !id(value)) || attempts.has(item.eventId)) throw new TypeError("Trail: invalid practice outcome evidence");
          const at = time(item.at), recordedAt = time(item.recordedAt);
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
          const start = time(since), at = time(outcome.at), recordedAt = time(outcome.recordedAt);
          if (at > cutoff || recordedAt > recordedCutoff || recordedAt < at || at < start || cutoff - at > maxAgeMs || outcome.measure !== "independent" || outcome.assisted !== false || outcome.targetLine !== targetLine) return null;
          const attempt = attempts.get(outcome.attemptId);
          const concept = targetLine.replace(/^(need|due):/, "").replace(/^(skill|node)\./, "");
          if (!attempt?.qualified || attempt.decisionId !== outcome.decisionId || !attempt.conceptIds.includes(concept) || attempt.at < start || attempt.at > at || attempt.recordedAt > recordedAt || cutoff - attempt.at > maxAgeMs) return null;
          return { evidence: [outcome.id, attempt.eventId, attempt.presentationId] };
        } });
      }
      function growth(summary, history) {
        if (!summary || summary.version !== VERSION || !Array.isArray(summary.attempts)) throw new TypeError("Trail: use a practice summary");
        if (!opened(history)) throw new TypeError("Trail: open the history first");
        const earlier = history.records, known = new Set(earlier.map((r) => r.itemKey));
        const facts = [], told = /* @__PURE__ */ new Set();
        for (const now of summary.attempts) {
          const concept = now.conceptIds[0];
          if (!now.independent || now.verdict !== "correct" || !concept || told.has(concept) || known.has(now.itemKey)) continue;
          const before = earlier.filter((p) => p.verdict === "incorrect" && p.itemKey !== now.itemKey && p.conceptIds[0] === concept && Date.parse(p.at) < time(now.at)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
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
      const copy = (value) => JSON.parse(JSON.stringify(value));
      const canonical = (value) => JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);
      const freeze = (value) => {
        if (value && typeof value === "object" && !Object.isFrozen(value)) {
          Object.freeze(value);
          for (const k of Object.keys(value)) freeze(value[k]);
        }
        return value;
      };
      const validId = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      const unit = (value) => typeof value === "number" && value >= 0 && value <= 1;
      const flag = (value) => value == null || typeof value === "boolean";
      const ms = (value) => {
        const n = Date.parse(value);
        if (!Number.isFinite(n)) throw new TypeError("Atlas: invalid time");
        return n;
      };
      const scopeKey = (scope) => {
        if (!scope || !DOMAINS.includes(scope.domain) || !validId(scope.subject) || !validId(scope.workspace)) throw new TypeError("Atlas: invalid scope");
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
        if (!event || event.schema !== 1 || !validId(event.id)) throw new TypeError("Atlas: invalid event");
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
          if (!validId(event.experienceId) || !validId(event.variant) || !POLICIES.includes(event.policy) || !Array.isArray(event.evidence) || !event.evidence.every(validId)) throw new TypeError("Atlas: invalid decision record");
          if (event.arm != null && !ARMS.includes(event.arm)) throw new TypeError("Atlas: invalid decision record");
          if (event.bundle != null && (typeof event.bundle !== "object" || Array.isArray(event.bundle) || !Object.entries(event.bundle).every(([lever, pick]) => validId(lever) && pick && (pick.option === null || validId(pick.option))))) throw new TypeError("Atlas: invalid decision record");
        } else if (event.type === "experience.completed") {
          if (!validId(event.decisionId) || !validId(event.experienceId) || !validId(event.variant)) throw new TypeError("Atlas: invalid completion");
        } else if (event.type === "feedback.given") {
          if (!validId(event.completionId) || !["helpful", "too_much", "want_more", "not_fit"].includes(event.value)) throw new TypeError("Atlas: invalid feedback");
        } else if (event.type === "signal.observed") {
          if (!SIGNALS.includes(event.kind) || !validId(event.key) || !unit(event.strength) || !Number.isInteger(event.n) || event.n < 0 || !flag(event.assisted)) throw new TypeError("Atlas: invalid signal");
          if (event.until != null && ms(event.until) <= ms(event.at)) throw new TypeError("Atlas: invalid expiry");
          if (event.refs != null && !(Array.isArray(event.refs) && event.refs.length <= 20 && event.refs.every(validId))) throw new TypeError("Atlas: invalid signal");
        } else if (event.type === "estimate.responded") {
          if (!validId(event.line) || !ANSWERS.includes(event.value)) throw new TypeError("Atlas: invalid estimate response");
        } else if (event.type === "outcome.observed") {
          if (!validId(event.decisionId) || !validId(event.measure) || !WINDOWS.includes(event.window) || !flag(event.assisted)) throw new TypeError("Atlas: invalid outcome");
          if ((event.attemptId != null || event.targetLine != null) && (!validId(event.attemptId) || !validId(event.targetLine) || !/^(need|due):/.test(event.targetLine))) throw new TypeError("Atlas: outcome proof needs an attempt and target line");
          if (!(unit(event.value) && event.reason == null) && !(event.value === null && UNMEASURED.includes(event.reason))) throw new TypeError("Atlas: outcome needs a value or a reason");
        } else if (event.type === "record.excluded") {
          if (!validId(event.targetId)) throw new TypeError("Atlas: invalid exclusion");
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
        return admit(events, event) ? [...copy(events), copy(event)] : copy(events);
      }
      function validationNeeds(events) {
        if (!Array.isArray(events)) throw new TypeError("Atlas: invalid events");
        const ids = /* @__PURE__ */ new Set(), presentations = /* @__PURE__ */ new Set();
        for (const event of events) {
          validate(event);
          ids.add(event.id);
          if (isPractice(event)) {
            ids.add(event.type === "practice.presented" ? event.decisionId : event.presentationId);
            if (event.type === "practice.attempted") presentations.add(event.presentationId);
          }
          if (event.type === "experience.completed" || event.type === "outcome.observed") ids.add(event.decisionId);
          if (event.type === "outcome.observed" && event.attemptId != null) ids.add(event.attemptId);
          if (event.type === "feedback.given") ids.add(event.completionId);
          if (event.type === "record.excluded") ids.add(event.targetId);
        }
        return { ids: [...ids], presentations: [...presentations] };
      }
      function validateIncrement({ events, scope, references = [], attempts = [] }) {
        const key = scopeKey(scope), needs = validationNeeds(events);
        const wanted = new Set(needs.ids), parents = /* @__PURE__ */ new Map(), stats = /* @__PURE__ */ new Map();
        for (const event of references) {
          validate(event);
          if (!wanted.has(event.id) || parents.has(event.id)) throw new TypeError("Atlas: invalid reference lookup");
          parents.set(event.id, event);
        }
        for (const event of attempts) {
          validate(event);
          if (event.type !== "practice.attempted" || !needs.presentations.includes(event.presentationId) || stats.has(event.presentationId) || scopeKey(event.scope) !== key) throw new TypeError("Atlas: invalid attempt lookup");
          stats.set(event.presentationId, { count: event.attemptNo, latest: ms(event.at) });
        }
        if (typeof trail().link !== "function") throw new Error("Atlas: indexed Trail validation unavailable");
        const fresh = /* @__PURE__ */ new Map(), lookup = {
          byId: (id) => fresh.get(id) || parents.get(id),
          attempts: (id) => stats.get(id) || { count: 0, latest: -Infinity }
        };
        for (const event of events) {
          if (scopeKey(event.scope) !== key) throw new TypeError("Atlas: event outside session scope");
          if (!admitWith(lookup, event)) continue;
          fresh.set(event.id, event);
          if (event.type === "practice.attempted") stats.set(event.presentationId, { count: event.attemptNo, latest: ms(event.at) });
        }
        return [...fresh.values()];
      }
      function read(events, scope, asOf, recordedAsOf = asOf) {
        const key = scopeKey(scope), cutoff = ms(asOf), recordedCutoff = ms(recordedAsOf);
        const rows = [];
        let sorted = true, last = null;
        for (const e of events) {
          const known = admitted.get(e);
          if (!known) validate(e);
          const row = known || { key: scopeKey(e.scope), at: ms(e.at), recordedAt: ms(e.recordedAt) };
          if (row.key !== key || row.at > cutoff || row.recordedAt > recordedCutoff) continue;
          if (last && (row.at < last.at || row.at === last.at && row.recordedAt < last.recordedAt)) sorted = false;
          rows.push({ e, at: row.at, recordedAt: row.recordedAt });
          last = row;
        }
        if (!sorted) rows.sort((a, b) => a.at - b.at || a.recordedAt - b.recordedAt);
        const ordered = rows.map((row) => row.e);
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
            responses.set(event.completionId, copy({ ...event, experienceId: completion.experienceId, variant: completion.variant }));
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
          scope: copy(scope),
          asOf,
          recordedAsOf,
          context,
          evidence,
          expired,
          feedback: [...responses.values()].filter((e) => !excluded.has(e.id)),
          excluded: [...excluded],
          lines,
          outcomes: [...latestOutcome.values()].filter((e) => !excluded.has(e.id)).map(copy),
          rounds
        };
        return { state, cutoff, personal, decisions, completed };
      }
      function understand(events, scope, asOf, recordedAsOf = asOf) {
        return read(events, scope, asOf, recordedAsOf).state;
      }
      function checkLever(lever, seen) {
        const ids = /* @__PURE__ */ new Set();
        if (!lever || !validId(lever.id) || seen.has(lever.id) || lever.id === "mode" || !LEVER_CLASSES.includes(lever.class) || !Array.isArray(lever.options) || !lever.options.length) throw new TypeError("Atlas: invalid lever");
        for (const option of lever.options) {
          if (!option || !validId(option.id) || ids.has(option.id)) throw new TypeError("Atlas: invalid lever");
          ids.add(option.id);
        }
        if (lever.default != null && !ids.has(lever.default)) throw new TypeError("Atlas: invalid lever");
        if (lever.follows != null && !Object.hasOwn(CONTEXT, lever.follows)) throw new TypeError("Atlas: invalid lever");
        if (lever.learn && (lever.class !== "shape" || lever.default == null)) throw new TypeError("Atlas: invalid lever");
        seen.add(lever.id);
      }
      const picked = (decision, leverId) => decision.bundle?.[leverId]?.option ?? (leverId === "mode" ? decision.variant : void 0);
      function decide({ events = [], scope, at, recordedAt = at, experienceId, candidates, levers = [], explore = 0 }) {
        if (!validId(experienceId) || !Array.isArray(candidates) || !candidates.length) throw new TypeError("Atlas: candidates required");
        if (!Array.isArray(levers) || typeof explore !== "number" || !(explore >= 0 && explore <= 0.5)) throw new TypeError("Atlas: invalid decision input");
        const seen = /* @__PURE__ */ new Set();
        for (const lever of levers) checkLever(lever, seen);
        const view = read(events, scope, at, recordedAt), state = view.state, c = state.context;
        const round = state.rounds[experienceId] || 0, seed = `${scopeKey(scope)}|${experienceId}|${round}`;
        const share = view.personal ? explore : 0, arm = random(seed)() < share ? "baseline" : "adapted", adapted = arm === "adapted";
        const ids = /* @__PURE__ */ new Set();
        const feasible = (item) => !(c.audio === "off" && item.requiresAudio) && !(c.time === "short" && item.minutes > 5) && !(c.support && item.supports && !item.supports.includes(c.support));
        const eligible = candidates.filter((item) => {
          if (!validId(item.id) || ids.has(item.id) || !Number.isFinite(item.minutes) || item.minutes <= 0 || !["short", "standard", "deep"].includes(item.pace) || item.supports != null && (!Array.isArray(item.supports) || !item.supports.length || item.supports.some((value) => !CONTEXT.support.includes(value)))) throw new TypeError("Atlas: invalid candidate");
          ids.add(item.id);
          return feasible(item);
        });
        const reasons = [], evidence = Object.values(state.evidence);
        if (c.time === "short") reasons.push("time.short");
        if (c.audio === "off") reasons.push("audio.off");
        if (c.goal) reasons.push(`goal.${c.goal}`);
        if (c.support) reasons.push(`support.${c.support}`);
        if (!adapted) reasons.push("arm.baseline");
        if (!eligible.length) return { version: VERSION, status: "unavailable", scope: copy(scope), experienceId, at, reasons: [...reasons, "no.feasible.experience"], evidence, alternatives: [], selected: null };
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
          scope: copy(scope),
          experienceId,
          at,
          selected: copy(scored[0].item),
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
      function createSession({ scope, events = [], clock = () => (/* @__PURE__ */ new Date()).toISOString(), id, explore = 0 } = {}) {
        scopeKey(scope);
        scope = copy(scope);
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
          const entry = copy(event);
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
        const record = (body) => {
          const at = clock(), event = { ...body, schema: 1, scope: copy(scope), id: nextId(), at, recordedAt: at };
          if (admitWith(lookup, event)) store(event);
          return copy(event);
        };
        return {
          events: () => copy(log),
          snapshot: () => frozen || (frozen = Object.freeze(log.slice())),
          set: (field, value, until = null) => record({ type: "context.set", field, value, until }),
          observe: (signal) => record({ type: "signal.observed", kind: signal?.kind, key: signal?.key, strength: signal?.strength, n: signal?.n, assisted: signal?.assisted ?? null, until: signal?.until ?? null, refs: signal?.refs ?? [] }),
          respond: (line, value) => record({ type: "estimate.responded", line, value }),
          plan: (experienceId, candidates, options = {}) => {
            const levers = options.levers || [];
            const decision = decide({ events: log, scope, at: clock(), experienceId, candidates, levers, explore });
            if (decision.status !== "ready") return decision;
            const recorded = record({
              type: "decision.made",
              experienceId,
              variant: decision.selected.id,
              policy: VERSION,
              evidence: decision.evidence,
              reasons: decision.reasons,
              alternatives: decision.alternatives,
              support: decision.support,
              focus: decision.focus,
              candidateSnapshot: copy(candidates),
              arm: decision.arm,
              round: decision.round,
              seed: decision.seed,
              explore: decision.explore,
              bundle: copy(decision.bundle),
              leverSnapshot: copy(levers)
            });
            return { ...decision, id: recorded.id };
          },
          complete: (decision) => {
            if (!decision || decision.status !== "ready" || scopeKey(decision.scope) !== scopeKey(scope)) throw new Error("Atlas: invalid decision");
            const existing = completions.get(decision.id);
            return existing ? copy(existing) : record({ type: "experience.completed", decisionId: decision.id, experienceId: decision.experienceId, variant: decision.selected.id });
          },
          feedback: (completionId, value) => record({ type: "feedback.given", completionId, value }),
          practice: (kind, fields) => {
            if (!fields || typeof fields !== "object" || Array.isArray(fields) || typeof kind !== "string") throw new TypeError("Atlas: invalid practice fields");
            return record({ ...fields, type: kind.startsWith("practice.") ? kind : `practice.${kind}` });
          },
          outcome: (decisionId, result) => record({
            type: "outcome.observed",
            decisionId,
            measure: result?.measure,
            window: result?.window,
            value: result?.value ?? null,
            reason: result?.reason ?? null,
            assisted: result?.assisted ?? null,
            ...result?.attemptId != null || result?.targetLine != null ? { attemptId: result?.attemptId, targetLine: result?.targetLine } : {}
          }),
          exclude: (targetId) => record({ type: "record.excluded", targetId }),
          clear: () => {
            log = [];
            frozen = null;
            byId.clear();
            attemptStats.clear();
            completions.clear();
          },
          state: () => understand(log, scope, clock()),
          lines: () => understand(log, scope, clock()).lines
        };
      }
      return Object.freeze({ VERSION, POLICIES, CONTEXT, validate, append, validationNeeds, validateIncrement, understand, decide, choice, createSession });
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
      const SOURCES = ["declared", "observed", "inferred"];
      const own = (o, k) => Object.hasOwn(o, k);
      const plain = (o) => o !== null && typeof o === "object" && !Array.isArray(o) && [Object.prototype, null].includes(Object.getPrototypeOf(o));
      const token = (s) => typeof s === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(s) && !["__proto__", "prototype", "constructor"].includes(s);
      const fail = (message) => {
        throw new TypeError(`Core domain: ${message}`);
      };
      const copy = (value) => JSON.parse(JSON.stringify(value));
      const canonical = (value) => JSON.stringify(value, (_key, v) => plain(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
      const time = (value) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : fail("invalid time");
      const finite = (n) => typeof n === "number" && Number.isFinite(n);
      const keys = (value, allowed) => plain(value) && Object.keys(value).every((k) => allowed.includes(k));
      const scopeKey = (scope) => {
        if (!keys(scope, ["domain", "workspace", "subject"]) || Object.keys(scope).length !== 3 || !DOMAINS.includes(scope.domain) || !token(scope.workspace) || !token(scope.subject)) fail("invalid scope");
        return canonical(scope);
      };
      function validValue(field, value) {
        if (field.kind === "enum") return field.values.includes(value);
        if (field.kind === "boolean") return typeof value === "boolean";
        return finite(value) && value >= field.range[0] && value <= field.range[1];
      }
      function validateContract(contract) {
        if (!keys(contract, ["id", "version", "purpose", "fields", "criteria", "objectives"]) || !token(contract.id) || !token(contract.version) || !token(contract.purpose) || !Array.isArray(contract.fields) || !contract.fields.length || contract.fields.length > 100 || !Array.isArray(contract.criteria) || contract.criteria.length > 100) fail("invalid contract");
        const fields = /* @__PURE__ */ new Map(), criteria = /* @__PURE__ */ new Set();
        for (const field of contract.fields) {
          if (!keys(field, ["id", "kind", "values", "range", "maxAgeDays", "minIndependent", "minAgreement", "tolerance"]) || !token(field.id) || fields.has(field.id) || !["enum", "boolean", "number"].includes(field.kind)) fail("invalid field");
          if (field.kind === "enum" && (!Array.isArray(field.values) || field.values.length < 2 || field.values.length > 100 || new Set(field.values).size !== field.values.length || field.values.some((v) => !token(v)))) fail("invalid enum values");
          if (field.kind !== "enum" && field.values != null) fail("values belong to an enum");
          if (field.kind === "number" && (!Array.isArray(field.range) || field.range.length !== 2 || !field.range.every(finite) || field.range[0] >= field.range[1] || !finite(field.range[1] - field.range[0]))) fail("invalid numeric range");
          if (field.kind !== "number" && (field.range != null || field.tolerance != null)) fail("range/tolerance belong to a number");
          if (field.maxAgeDays != null && (!finite(field.maxAgeDays) || field.maxAgeDays <= 0 || field.maxAgeDays > 36500)) fail("invalid evidence lifetime");
          if (field.minIndependent != null && (!Number.isInteger(field.minIndependent) || field.minIndependent < 1 || field.minIndependent > 1e4)) fail("invalid minimum evidence");
          if (field.minAgreement != null && (!finite(field.minAgreement) || field.minAgreement <= 0.5 || field.minAgreement > 1)) fail("invalid agreement threshold");
          if (field.tolerance != null && (!finite(field.tolerance) || field.tolerance < 0 || field.tolerance > field.range[1] - field.range[0])) fail("invalid numeric tolerance");
          fields.set(field.id, field);
        }
        for (const criterion of contract.criteria) {
          if (!keys(criterion, ["id", "field", "feature", "weight", "required", "prefer"]) || !token(criterion.id) || criteria.has(criterion.id) || !fields.has(criterion.field) || !token(criterion.feature) || !finite(criterion.weight) || criterion.weight < 0 || criterion.required != null && typeof criterion.required !== "boolean" || !["match", "different", "at-least", "at-most"].includes(criterion.prefer || "match")) fail("invalid criterion");
          if (["at-least", "at-most"].includes(criterion.prefer) && fields.get(criterion.field).kind !== "number") fail("numeric comparison requires a number");
          criteria.add(criterion.id);
        }
        if (own(contract, "objectives")) {
          if (!Array.isArray(contract.objectives) || contract.objectives.length > 100) fail("invalid objectives");
          const objectives = /* @__PURE__ */ new Set();
          for (const objective of contract.objectives) {
            if (!keys(objective, ["id", "feature", "range", "weight", "prefer"]) || !token(objective.id) || objectives.has(objective.id) || !token(objective.feature) || !Array.isArray(objective.range) || objective.range.length !== 2 || !objective.range.every(finite) || objective.range[0] >= objective.range[1] || !finite(objective.range[1] - objective.range[0]) || !finite(objective.weight) || objective.weight < 0 || !["higher", "lower"].includes(objective.prefer)) fail("invalid objective");
            objectives.add(objective.id);
          }
        }
        return fields;
      }
      function project(contract, scope, observations, at) {
        const fields = validateContract(contract), owner = scopeKey(scope), cutoff = time(at);
        if (!Array.isArray(observations) || observations.length > 1e4) fail("invalid observations");
        const byId = /* @__PURE__ */ new Map(), rows = [], replaced = /* @__PURE__ */ new Set();
        for (const row of observations) {
          if (!keys(row, ["id", "scope", "contract", "field", "value", "source", "independentKey", "at", "recordedAt", "until", "refs", "quality", "supersedes"]) || !token(row.id) || scopeKey(row.scope) !== owner || !fields.has(row.field) || !SOURCES.includes(row.source)) fail("invalid or foreign observation");
          if (!keys(row.contract, ["id", "version", "purpose"]) || row.contract.id !== contract.id || row.contract.version !== contract.version || row.contract.purpose !== contract.purpose) fail("observation belongs to another contract or purpose");
          if (scope.domain === "PULSE" && row.source !== "declared") fail("PULSE does not derive a personal behavioral profile");
          if (row.value !== null && !validValue(fields.get(row.field), row.value)) fail("observation value is outside its field");
          if (row.value === null && row.source !== "declared") fail("only a declaration can withdraw a field");
          if (row.source === "observed" && !token(row.independentKey)) fail("observations need an independence key");
          if (row.independentKey != null && !token(row.independentKey)) fail("invalid independence key");
          if (row.quality != null && !["usable", "confounded", "unassessed"].includes(row.quality)) fail("invalid evidence quality");
          if (row.source === "declared" && row.quality != null && row.quality !== "usable") fail("a declaration is not a measured outcome");
          const happened = time(row.at), recorded = time(row.recordedAt ?? row.at);
          if (recorded < happened || row.until != null && time(row.until) <= happened) fail("invalid observation chronology");
          if (row.refs != null && (!Array.isArray(row.refs) || row.refs.length > 100 || row.refs.some((r) => !token(r)) || new Set(row.refs).size !== row.refs.length)) fail("invalid evidence references");
          if (row.source === "inferred" && !row.refs?.length) fail("an inferred proposal needs source references");
          if (row.supersedes != null && !token(row.supersedes)) fail("invalid correction reference");
          if (byId.has(row.id)) {
            if (canonical(byId.get(row.id)) !== canonical(row)) fail("conflicting observation id");
            continue;
          }
          byId.set(row.id, row);
          if (happened <= cutoff && recorded <= cutoff) rows.push(row);
        }
        for (const row of rows) {
          for (const ref of row.source === "inferred" ? row.refs : []) {
            const source = byId.get(ref);
            if (!source || source.id === row.id || source.source === "inferred" || time(source.recordedAt ?? source.at) > time(row.recordedAt ?? row.at) || time(source.at) > time(row.at)) fail("invalid proposal source");
          }
          if (row.supersedes) {
            const prior = byId.get(row.supersedes);
            if (!prior || prior.id === row.id || prior.field !== row.field || prior.source !== row.source || time(prior.at) > time(row.at) || time(prior.recordedAt ?? prior.at) > time(row.recordedAt ?? row.at)) fail("invalid correction");
            replaced.add(prior.id);
          }
        }
        const checked = /* @__PURE__ */ new Set();
        for (const start of rows) {
          let row = start;
          const path = /* @__PURE__ */ new Set();
          while (row && !checked.has(row.id)) {
            if (path.has(row.id)) fail("correction cycle");
            path.add(row.id);
            row = row.supersedes ? byId.get(row.supersedes) : null;
          }
          for (const id of path) checked.add(id);
        }
        rows.sort((a, b) => time(a.at) - time(b.at) || time(a.recordedAt ?? a.at) - time(b.recordedAt ?? b.at));
        const byField = /* @__PURE__ */ new Map(), orderedKeys = /* @__PURE__ */ new Map(), latestDeclarations = /* @__PURE__ */ new Map(), latestIndependent = /* @__PURE__ */ new Map();
        for (const row of rows) if (!replaced.has(row.id)) {
          if (row.source !== "inferred") {
            const key = canonical([row.field, row.source, row.source === "observed" ? row.independentKey : "", time(row.at), time(row.recordedAt ?? row.at)]);
            const previous = orderedKeys.get(key);
            if (previous && (previous.value !== row.value || (previous.quality ?? "usable") !== (row.quality ?? "usable") || previous.until !== row.until)) fail("ambiguous observation order");
            orderedKeys.set(key, row);
          }
          if (!byField.has(row.field)) byField.set(row.field, []);
          byField.get(row.field).push(row);
          if (row.source === "declared") latestDeclarations.set(row.field, row);
          if (row.source === "observed") latestIndependent.set(canonical([row.field, row.independentKey]), row);
        }
        const sourceUsable = (id) => {
          const row = byId.get(id);
          if (!row || replaced.has(id) || row.value === null || row.quality && row.quality !== "usable") return false;
          const field = fields.get(row.field);
          if (cutoff >= (row.until ? time(row.until) : time(row.at) + (field.maxAgeDays ?? 30) * DAY)) return false;
          const declared = latestDeclarations.get(row.field);
          if (declared && (declared.value === null || row.source === "declared" && declared.id !== row.id)) return false;
          if (row.source === "observed" && latestIndependent.get(canonical([row.field, row.independentKey]))?.id !== row.id) return false;
          return true;
        };
        const result = [];
        for (const field of fields.values()) {
          const all = byField.get(field.id) || [];
          const fresh = (row) => cutoff < (row.until ? time(row.until) : time(row.at) + (field.maxAgeDays ?? 30) * DAY);
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
          contract: { id: contract.id, version: contract.version, purpose: contract.purpose },
          scope: copy(scope),
          at,
          fields: result,
          needsCheck: result.filter((f) => ["conflicted", "insufficient", "unconfirmed", "unusable"].includes(f.status)).map((f) => f.id),
          calibrated: false
        };
      }
      function understand(input = {}) {
        return copy(project(input.contract, input.scope, input.observations ?? [], input.at));
      }
      function decide({ contract, scope, observations = [], at, candidates } = {}) {
        const understanding = project(contract, scope, observations, at), specs = new Map(contract.fields.map((f) => [f.id, f]));
        const objectives = contract.objectives ?? [];
        const facts = new Map(understanding.fields.map((f) => [f.id, f]));
        const allowed = new Set([...contract.criteria, ...objectives].map((c) => c.feature));
        if (!Array.isArray(candidates) || candidates.length > 1e4) fail("invalid candidates");
        const ids = /* @__PURE__ */ new Set(), ranked = [], excluded = [];
        for (const candidate of candidates) {
          if (!keys(candidate, ["id", "features", "eligible", "exclusions"]) || !token(candidate.id) || ids.has(candidate.id) || !plain(candidate.features) || Object.keys(candidate.features).some((k) => !allowed.has(k)) || candidate.eligible != null && typeof candidate.eligible !== "boolean" || candidate.exclusions != null && (!Array.isArray(candidate.exclusions) || candidate.exclusions.some((r) => !token(r)))) fail("invalid candidate");
          ids.add(candidate.id);
          for (const c of contract.criteria) if (own(candidate.features, c.feature) && !validValue(specs.get(c.field), candidate.features[c.feature])) fail("invalid candidate feature");
          for (const objective of objectives) if (own(candidate.features, objective.feature)) {
            const value = candidate.features[objective.feature];
            if (!finite(value) || value < objective.range[0] || value > objective.range[1]) fail("invalid objective feature");
          }
          if (candidate.eligible === false || candidate.exclusions?.length) {
            excluded.push({ id: candidate.id, reasons: candidate.exclusions?.length ? candidate.exclusions : ["ineligible"] });
            continue;
          }
          let score = 0;
          const reasons = [], policyReasons = [], blocked = [];
          for (const c of contract.criteria) {
            const fact = facts.get(c.field), field = specs.get(c.field), has = own(candidate.features, c.feature), v = candidate.features[c.feature];
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
            if (!finite(score)) fail("policy utility overflow");
            reasons.push({ criterion: c.id, field: c.field, value: fact.value, candidateValue: v, contribution, evidence: fact.evidence, status: fact.status });
          }
          for (const objective of objectives) {
            if (!own(candidate.features, objective.feature)) continue;
            const candidateValue = candidate.features[objective.feature];
            const fraction = (candidateValue - objective.range[0]) / (objective.range[1] - objective.range[0]);
            const contribution = (objective.prefer === "higher" ? fraction : 1 - fraction) * objective.weight;
            score += contribution;
            if (!finite(score)) fail("policy utility overflow");
            policyReasons.push({ objective: objective.id, feature: objective.feature, candidateValue, contribution });
          }
          if (blocked.length) excluded.push({ id: candidate.id, reasons: blocked });
          else ranked.push({ id: candidate.id, score, reasons, ...own(contract, "objectives") ? { policyReasons } : {} });
        }
        ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        return copy({
          version: VERSION,
          contract: understanding.contract,
          scope,
          at,
          status: ranked.length ? "ready" : "unavailable",
          selected: ranked[0] || null,
          ranked,
          excluded,
          understanding,
          snapshot: { candidates, contract, observations: observations.map((row) => row.id) },
          calibrated: false
        });
      }
      return Object.freeze({ VERSION, validateContract, understand, decide });
    });
  }
});

// atlas/personalization.js
var require_personalization = __commonJS({
  "atlas/personalization.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory(require_engine(), () => require_domain());
      else root.SynkAtlasPersonalization = factory(root.SynkAtlas, () => root.SynkAtlasDomain);
    })(typeof globalThis !== "undefined" ? globalThis : exports, function(Core, getDomain) {
      "use strict";
      if (!Core?.createSession) throw new TypeError("Personalization: load Core first");
      const VERSION = "core-personalization-1";
      const OPTIONS = Object.freeze({
        goal: Object.freeze(["explore", "study", "work", "clarity", "expression", "prepare"]),
        experience: Object.freeze(["new", "familiar", "practiced"]),
        support: Object.freeze(["choose", "step", "independent"]),
        audio: Object.freeze(["off", "available"]),
        textSize: Object.freeze(["standard", "large"]),
        explanation: Object.freeze(["brief", "standard", "detailed"]),
        motion: Object.freeze(["full", "reduced"])
      });
      const DEFAULT_PRESENTATION = Object.freeze({ textSize: "standard", explanation: "standard", motion: "full", support: "choose", audio: "available" });
      const REASON_GOAL = Object.freeze({
        culture: "explore",
        travel: "expression",
        people: "expression",
        life: "expression",
        study: "study",
        work: "work",
        career: "work",
        exam: "prepare",
        hobby: "explore",
        other: null
      });
      const REASONS = Object.freeze(Object.keys(REASON_GOAL));
      const MAX_REASONS = 3;
      const FIELDS = Object.freeze([...Object.keys(OPTIONS), "minutes", "reasons", "primaryReason"]);
      const copy = (value) => JSON.parse(JSON.stringify(value));
      const fail = (message) => {
        throw new TypeError(`Personalization: ${message}`);
      };
      const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
      const exact = (value, keys) => record(value) && Object.keys(value).every((key) => keys.includes(key));
      const token = (value, max = 48) => typeof value === "string" && new RegExp(`^[a-zA-Z0-9_.-]{1,${max}}$`).test(value);
      function instant(at) {
        if (typeof at !== "string" || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) fail("use an explicit ISO UTC time");
        return Date.parse(at);
      }
      function checkScope(scope) {
        if (!exact(scope, ["personId", "productId", "contextId", "domain"]) || Object.keys(scope).length !== 4 || !token(scope.personId, 120) || !token(scope.productId) || !token(scope.contextId) || !["LAB", "SHIFT", "PATH", "PULSE", "SYNK"].includes(scope.domain)) fail("invalid person/product/context scope");
        return scope;
      }
      const scopeKey = (scope) => JSON.stringify([scope.personId, scope.productId, scope.contextId, scope.domain]);
      function checkValues(values, patch = false) {
        if (!exact(values, FIELDS)) fail("unsupported setting (identity, age and gender are not personalization inputs)");
        for (const [field, value] of Object.entries(values)) {
          if (patch && value === null) continue;
          if (field === "reasons") {
            if (!Array.isArray(value) || !value.length || value.length > MAX_REASONS || new Set(value).size !== value.length || value.some((reason) => !REASONS.includes(reason))) fail("invalid reasons (choose one to three known reasons)");
          } else if (field === "primaryReason") {
            if (!REASONS.includes(value)) fail("invalid primaryReason");
          } else if (field === "minutes" ? !Number.isInteger(value) || value < 1 || value > 240 : !OPTIONS[field].includes(value)) fail(`invalid ${field}`);
        }
        return values;
      }
      const canonicalReasons = (reasons) => REASONS.filter((reason) => reasons.includes(reason));
      function reasonGoals(values) {
        return [...new Set((values.reasons || []).map((reason) => REASON_GOAL[reason]).filter(Boolean))];
      }
      function declaredGoal(values) {
        if (values.goal) return values.goal;
        if (values.primaryReason) return REASON_GOAL[values.primaryReason];
        const goals = reasonGoals(values);
        return goals.length === 1 ? goals[0] : null;
      }
      function checkProfile(profile) {
        const keys = ["version", "scope", "revision", "generation", "status", "consent", "values", "provenance", "createdAt", "updatedAt"];
        if (!exact(profile, keys) || keys.some((key) => !Object.hasOwn(profile, key)) || profile.version !== VERSION || !Number.isSafeInteger(profile.revision) || profile.revision < 0 || !Number.isSafeInteger(profile.generation) || profile.generation < 0 || profile.generation > 999999999 || !["new", "active", "skipped", "disabled", "deleted"].includes(profile.status) || typeof profile.consent !== "boolean" || profile.status === "active" !== profile.consent) fail("invalid profile");
        checkScope(profile.scope);
        checkValues(profile.values);
        if (Object.hasOwn(profile.values, "primaryReason") && !(profile.values.reasons || []).includes(profile.values.primaryReason)) fail("primary reason must be one of the declared reasons");
        if (instant(profile.updatedAt) < instant(profile.createdAt)) fail("profile time reversal");
        if (!exact(profile.provenance, Object.keys(profile.values)) || Object.keys(profile.values).some((key) => !Object.hasOwn(profile.provenance, key))) fail("invalid provenance");
        for (const source of Object.values(profile.provenance)) {
          if (!exact(source, ["source", "confidence", "at", "revision"]) || Object.keys(source).length !== 4 || source.source !== "self-declared" || source.confidence !== "declared" || !Number.isSafeInteger(source.revision) || source.revision < 1 || source.revision > profile.revision || instant(source.at) < instant(profile.createdAt) || instant(source.at) > instant(profile.updatedAt)) fail("invalid declared source");
        }
        if (!profile.consent && Object.keys(profile.values).length) fail("unconsented stored settings");
        return profile;
      }
      function atOrAfter(profile, at) {
        if (instant(at) < instant(profile.updatedAt)) fail("stale update time");
      }
      function createProfile({ scope, at } = {}) {
        checkScope(scope);
        instant(at);
        return {
          version: VERSION,
          scope: copy(scope),
          revision: 0,
          generation: 0,
          status: "new",
          consent: false,
          values: {},
          provenance: {},
          createdAt: at,
          updatedAt: at
        };
      }
      function updateProfile(profile, patch, at) {
        checkProfile(profile);
        atOrAfter(profile, at);
        if (!exact(patch, ["values", "consent", "expectedRevision"]) || !Object.hasOwn(patch, "values") || Object.hasOwn(patch, "consent") && typeof patch.consent !== "boolean" || Object.hasOwn(patch, "expectedRevision") && !Number.isSafeInteger(patch.expectedRevision)) fail("invalid update");
        if (Object.hasOwn(patch, "expectedRevision") && patch.expectedRevision !== profile.revision) {
          throw Object.assign(new Error("Personalization: the profile changed since this edit began"), { code: "PROFILE_CONFLICT" });
        }
        checkValues(patch.values, true);
        if (patch.consent === false) return clearProfile(profile, { mode: "disable", at });
        if (!(patch.consent === true || profile.consent)) fail("explicit consent required before remembering settings");
        const next = copy(profile);
        next.revision += 1;
        next.updatedAt = at;
        if (!next.consent || Object.entries(patch.values).some(([field, value]) => value === null && Object.hasOwn(next.values, field))) next.generation += 1;
        next.status = "active";
        next.consent = true;
        for (const [field, value] of Object.entries(patch.values)) {
          if (value === null) {
            delete next.values[field];
            delete next.provenance[field];
          } else {
            next.values[field] = field === "reasons" ? canonicalReasons(value) : value;
            next.provenance[field] = { source: "self-declared", confidence: "declared", at, revision: next.revision };
          }
        }
        if (Object.hasOwn(next.values, "primaryReason") && !(next.values.reasons || []).includes(next.values.primaryReason)) {
          if (patch.values.primaryReason != null) fail("primary reason must be one of the declared reasons");
          delete next.values.primaryReason;
          delete next.provenance.primaryReason;
          if (next.generation === profile.generation) next.generation += 1;
        }
        return copy(checkProfile(next));
      }
      function clearProfile(profile, { mode = "delete", at } = {}) {
        checkProfile(profile);
        atOrAfter(profile, at);
        const statuses = { skip: "skipped", disable: "disabled", delete: "deleted" };
        if (!Object.hasOwn(statuses, mode)) fail("invalid clear mode");
        return checkProfile({
          ...copy(profile),
          revision: profile.revision + 1,
          generation: profile.generation + 1,
          status: statuses[mode],
          consent: false,
          values: {},
          provenance: {},
          updatedAt: at
        });
      }
      function coreScope(profile) {
        const { scope, generation } = checkProfile(profile);
        return { domain: scope.domain, subject: scope.personId, workspace: `p.${scope.productId}:c.${scope.contextId}:g.${generation}` };
      }
      function owned(profile, scope) {
        checkProfile(profile);
        checkScope(scope);
        if (scopeKey(profile.scope) !== scopeKey(scope)) fail("profile belongs to another person, product or context");
      }
      function history(profile, scope, events, at) {
        owned(profile, scope);
        atOrAfter(profile, at);
        if (!Array.isArray(events) || events.length > 1e4) fail("invalid event history");
        const expected = coreScope(profile), prefix = `p.${scope.productId}:c.${scope.contextId}:g.`;
        for (const event of events) {
          Core.validate(event);
          if (event.scope.domain !== expected.domain || event.scope.subject !== expected.subject || !event.scope.workspace.startsWith(prefix) || !/^\d+$/.test(event.scope.workspace.slice(prefix.length))) fail("foreign event history");
          if (instant(event.at) > instant(at) || instant(event.recordedAt) > instant(at)) fail("future event history");
          if (!["context.set", "decision.made", "experience.completed", "feedback.given", "record.excluded"].includes(event.type)) fail("use the owning practice adapter for observations");
        }
        return profile.consent ? copy(events.filter((event) => event.scope.workspace === expected.workspace)) : [];
      }
      function session(profile, events, at) {
        let sequence = events.length;
        const ids = new Set(events.map((event) => event.id));
        return Core.createSession({ scope: coreScope(profile), events, clock: () => at, id: () => {
          let value;
          do {
            value = `p${profile.generation}-${instant(at).toString(36)}-${++sequence}`;
          } while (ids.has(value));
          ids.add(value);
          return value;
        } });
      }
      function presentationFor(values) {
        return {
          ...DEFAULT_PRESENTATION,
          support: values.experience === "new" ? "step" : "choose",
          ...Object.fromEntries(Object.entries(values).filter(([key]) => Object.hasOwn(DEFAULT_PRESENTATION, key)))
        };
      }
      function checkCandidates(candidates) {
        if (!Array.isArray(candidates) || !candidates.length || candidates.length > 500) fail("candidates required");
        const seen = /* @__PURE__ */ new Set();
        for (const item of candidates) {
          if (!exact(item, ["id", "minutes", "pace", "goals", "requiresAudio", "experiences", "supports"]) || !token(item.id, 120) || seen.has(item.id) || !Number.isFinite(item.minutes) || item.minutes <= 0 || !["short", "standard", "deep"].includes(item.pace) || item.goals != null && (!Array.isArray(item.goals) || item.goals.some((goal) => !OPTIONS.goal.includes(goal))) || item.requiresAudio != null && typeof item.requiresAudio !== "boolean" || item.supports != null && (!Array.isArray(item.supports) || !item.supports.length || item.supports.some((value) => !OPTIONS.support.includes(value))) || item.experiences != null && (!Array.isArray(item.experiences) || !item.experiences.length || item.experiences.some((value) => !OPTIONS.experience.includes(value)))) fail("invalid candidate");
          seen.add(item.id);
        }
      }
      function selectPersonalization({ profile, scope, candidates, experienceId, events = [], at } = {}) {
        const prior = history(profile, scope, events, at);
        checkCandidates(candidates);
        if (!token(experienceId, 120)) fail("invalid experience id");
        const values = profile.consent ? copy(profile.values) : {}, presentation = presentationFor(values), current = session(profile, prior, at);
        const settings = {
          goal: declaredGoal(values),
          time: values.minutes == null ? null : values.minutes <= 5 ? "short" : "standard",
          support: values.support ?? null,
          audio: values.audio ?? null
        };
        const apply = (target, wanted) => {
          const previous = target.state().context;
          for (const [field, value] of Object.entries(wanted)) if ((previous[field] ?? null) !== value) target.set(field, value);
        };
        apply(current, settings);
        const mixedGoals = settings.goal == null ? reasonGoals(values) : [];
        let eligible = candidates.filter((item) => (values.minutes == null || item.minutes <= values.minutes) && (!values.experience || !item.experiences || item.experiences.includes(values.experience)));
        if (values.support == null && presentation.support !== "choose") {
          const fitting = eligible.filter((item) => !item.supports || item.supports.includes(presentation.support));
          if (fitting.length) eligible = fitting;
        }
        const constraints = [];
        if (values.minutes != null) constraints.push("time.limit");
        if (values.experience != null) constraints.push("experience.declared");
        if (values.reasons) constraints.push("reasons.declared");
        if (mixedGoals.length > 1) constraints.push("reasons.mixed");
        let ask = null;
        if (mixedGoals.length > 1 && eligible.length) {
          const outcomes = new Set(mixedGoals.map((goal) => {
            const trial = session(profile, copy(prior), at);
            apply(trial, { ...settings, goal });
            return trial.plan(experienceId, copy(eligible)).selected?.id ?? null;
          }));
          if (outcomes.size > 1) ask = {
            id: "reasons.primary",
            kind: "choice",
            about: "primaryReason",
            options: values.reasons.filter((reason) => REASON_GOAL[reason]).map((reason) => ({ id: reason }))
          };
        }
        const plan = eligible.length ? current.plan(experienceId, copy(eligible)) : {
          version: Core.VERSION,
          status: "unavailable",
          scope: coreScope(profile),
          experienceId,
          at,
          selected: null,
          alternatives: [],
          reasons: ["no.feasible.experience"],
          evidence: []
        };
        const reasons = [.../* @__PURE__ */ new Set([...plan.reasons, ...constraints])];
        const chosen = plan.selected?.supports;
        if (chosen && !chosen.includes(presentation.support)) presentation.support = chosen.includes("choose") ? "choose" : chosen[0];
        const returned = profile.consent ? current.events() : [];
        const basis = plan.outcomeBasis === "self_report" ? "self-reported-feedback" : Object.keys(values).length ? "self-declared" : "cold-start";
        return {
          version: VERSION,
          profile: copy(profile),
          values,
          presentation,
          plan: copy(plan),
          events: returned,
          reasons,
          ask,
          provenance: copy(profile.provenance),
          explanation: {
            basis,
            confidence: basis === "cold-start" ? "unknown" : "declared",
            learningEffectClaim: false,
            abilityClaim: false,
            reasons,
            evidence: copy(plan.evidence),
            revision: profile.revision
          },
          persistence: profile.consent ? "consented-product-context" : "none"
        };
      }
      function feedbackSession(options) {
        const { profile, scope, events = [], at } = options;
        const prior = history(profile, scope, events, at);
        if (!profile.consent) fail("feedback memory requires consent");
        if (scope.domain === "PULSE") fail("PULSE does not learn a personal behavioral profile");
        return session(profile, prior, at);
      }
      function recordCompletion(options = {}) {
        const current = feedbackSession(options);
        const decision = current.events().find((event) => event.type === "decision.made" && event.id === options.decisionId);
        if (!decision) fail("unknown decision");
        current.complete({ ...decision, status: "ready", selected: { id: decision.variant } });
        return current.events();
      }
      function recordFeedback(options = {}) {
        const current = feedbackSession(options);
        const completed = current.events().find((event) => event.type === "experience.completed" && event.id === options.completionId);
        if (!completed) fail("use a completed recommendation before feedback");
        if (!["helpful", "not_fit", "too_much", "want_more"].includes(options.value)) fail("invalid feedback");
        current.feedback(completed.id, options.value);
        return current.events();
      }
      const PREFERENCE_VERSION = "core-preference-context-1";
      const preferenceToken = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value) && !["__proto__", "prototype", "constructor"].includes(value);
      const canonical = (value) => JSON.stringify(value, (_key, item) => record(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
      const PREFERENCE_KEYS = Object.freeze({
        set: ["field", "value", "duration"],
        withdraw: ["field", "duration"],
        reset: [],
        close: [],
        propose: ["field", "value", "feedbackId"],
        apply: ["proposalId", "duration"],
        dismiss: ["proposalId"]
      });
      const preferenceOptional = (kind) => ["set", "apply"].includes(kind) ? ["until"] : [];
      const preferenceBase = ["version", "id", "scope", "contract", "encounterId", "at", "kind", "source"];
      function preferenceReplay({ contract, scope, events = [], encounterId, at } = {}) {
        checkScope(scope);
        instant(at);
        if (!preferenceToken(encounterId)) fail("invalid preference encounter");
        const domain = getDomain();
        if (!domain?.validateContract) fail("load Core domain capability first");
        const fields = domain.validateContract(contract), reference = { id: contract.id, version: contract.version, purpose: contract.purpose };
        if (!Array.isArray(events) || events.length > 1e4) fail("invalid preference history");
        const ongoing = /* @__PURE__ */ new Map(), once = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Map(), closed = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Map(), unique = [];
        let previousAt = -Infinity;
        const clearPendingField = (field) => {
          for (const [id, event] of pending) if (event.field === field) pending.delete(id);
        };
        const onceFor = (id) => {
          if (!once.has(id)) once.set(id, /* @__PURE__ */ new Map());
          return once.get(id);
        };
        const isValue = (field, value) => field.kind === "enum" ? field.values.includes(value) : field.kind === "boolean" ? typeof value === "boolean" : typeof value === "number" && Number.isFinite(value) && value >= field.range[0] && value <= field.range[1];
        for (const event of events) {
          if (!record(event) || !Object.hasOwn(PREFERENCE_KEYS, event.kind)) fail("invalid preference event kind");
          const keys = [...preferenceBase, ...PREFERENCE_KEYS[event.kind]];
          if (!exact(event, [...keys, ...preferenceOptional(event.kind)]) || keys.some((key) => !Object.hasOwn(event, key)) || event.version !== PREFERENCE_VERSION || !preferenceToken(event.id) || !preferenceToken(event.encounterId)) fail("invalid preference event");
          checkScope(event.scope);
          if (scopeKey(event.scope) !== scopeKey(scope) || canonical(event.contract) !== canonical(reference)) fail("foreign preference scope or contract");
          if (event.source !== (event.kind === "apply" ? "feedback-confirmed" : "explicit")) fail("invalid preference source");
          if (scope.domain === "PULSE" && ["propose", "apply"].includes(event.kind)) fail("PULSE does not learn a personal behavioral profile");
          const eventAt = instant(event.at);
          if (Object.hasOwn(event, "until") && instant(event.until) <= eventAt) fail("preference deadline must be after its declaration");
          if (eventAt > instant(at)) fail("future preference event");
          if (seen.has(event.id)) {
            if (canonical(seen.get(event.id)) !== canonical(event)) fail("conflicting preference event id");
            continue;
          }
          if (eventAt < previousAt) fail("preference event time reversal");
          previousAt = eventAt;
          if (Object.hasOwn(event, "field") && !fields.has(event.field)) fail("unknown preference field");
          if (Object.hasOwn(event, "value") && !isValue(fields.get(event.field), event.value)) fail("invalid preference value");
          if (Object.hasOwn(event, "duration") && !["once", "ongoing"].includes(event.duration)) fail("invalid preference duration");
          for (const key of ["proposalId", "feedbackId"]) if (Object.hasOwn(event, key) && !preferenceToken(event[key])) fail(`invalid ${key}`);
          if (closed.has(event.encounterId) && ["set", "propose", "apply"].includes(event.kind)) fail("preference encounter is closed");
          if (event.kind === "propose") pending.set(event.id, event);
          else if (event.kind === "apply" || event.kind === "dismiss") {
            const proposal = pending.get(event.proposalId);
            if (!proposal || proposal.encounterId !== event.encounterId) fail("preference proposal is not pending in this encounter");
            pending.delete(proposal.id);
            if (event.kind === "apply") {
              const applied = { ...event, field: proposal.field, value: proposal.value, feedbackId: proposal.feedbackId };
              (event.duration === "ongoing" ? ongoing : onceFor(event.encounterId)).set(proposal.field, applied);
              if (event.duration === "ongoing") onceFor(event.encounterId).delete(proposal.field);
              clearPendingField(proposal.field);
            }
          } else if (event.kind === "set") {
            (event.duration === "ongoing" ? ongoing : onceFor(event.encounterId)).set(event.field, event);
            if (event.duration === "ongoing") onceFor(event.encounterId).delete(event.field);
            clearPendingField(event.field);
          } else if (event.kind === "withdraw") {
            (event.duration === "ongoing" ? ongoing : onceFor(event.encounterId)).delete(event.field);
            clearPendingField(event.field);
          } else if (event.kind === "reset") {
            ongoing.clear();
            once.clear();
            pending.clear();
          } else if (event.kind === "close") {
            closed.add(event.encounterId);
            once.delete(event.encounterId);
            for (const [id, proposal] of pending) if (proposal.encounterId === event.encounterId) pending.delete(id);
          }
          seen.set(event.id, event);
          unique.push(event);
        }
        const origin = (event) => ({
          eventId: event.id,
          source: event.source,
          duration: event.duration,
          encounterId: event.encounterId,
          at: event.at,
          ...Object.hasOwn(event, "until") ? { until: event.until } : {},
          ...event.proposalId ? { proposalId: event.proposalId, feedbackId: event.feedbackId } : {}
        });
        const expiredAt = (event) => Object.hasOwn(event, "until") && instant(at) >= instant(event.until);
        const readLayer = (selected) => {
          const values = {}, provenance = {}, expired2 = [];
          for (const [field, event] of selected) {
            if (expiredAt(event)) {
              expired2.push({ field, value: event.value, ...origin(event) });
              continue;
            }
            values[field] = event.value;
            provenance[field] = origin(event);
          }
          return { values, provenance, ...expired2.length ? { expired: expired2 } : {} };
        };
        const baseline = readLayer(ongoing), context = readLayer(once.get(encounterId) || []);
        const effective = { values: { ...baseline.values, ...context.values }, provenance: { ...baseline.provenance, ...context.provenance } };
        const expired = [...baseline.expired || [], ...context.expired || []];
        if (expired.length) effective.expired = expired;
        const projection = {
          version: PREFERENCE_VERSION,
          ...effective,
          closed: closed.has(encounterId),
          pendingProposals: [...pending.values()].filter((event) => event.encounterId === encounterId).map((event) => ({
            id: event.id,
            field: event.field,
            value: event.value,
            feedbackId: event.feedbackId,
            encounterId: event.encounterId,
            at: event.at
          }))
        };
        return { projection, layers: {
          version: "core-preference-layers-1",
          baseline,
          context: { encounterId, ...context, closed: closed.has(encounterId) },
          effective: projection
        }, events: unique };
      }
      function projectPreferences(input = {}) {
        return copy(preferenceReplay(input).projection);
      }
      function preferenceLayers(input = {}) {
        return copy(preferenceReplay(input).layers);
      }
      function preferencesToDomain(input = {}) {
        if (!exact(input, ["contract", "scope", "events", "encounterId", "at", "domainScope"])) fail("unsupported preference bridge input");
        const { contract, scope, events = [], encounterId, at, domainScope } = input;
        checkScope(scope);
        if (!record(domainScope) || domainScope.subject !== scope.personId || domainScope.domain !== scope.domain) fail("foreign preference bridge subject or domain");
        const domain = getDomain();
        if (!domain?.understand) fail("load Core domain capability first");
        domain.understand({ contract, scope: domainScope, observations: [], at });
        const layers = preferenceLayers({ contract, scope, events, encounterId, at });
        const fields = new Map(contract.fields.map((field) => [field.id, field]));
        const reference = { id: contract.id, version: contract.version, purpose: contract.purpose };
        const observations = [], lineage = [];
        const selected = new Map(Object.entries(layers.effective.values).map(([field, value]) => [field, { value, origin: layers.effective.provenance[field] }]));
        for (const expired of layers.effective.expired || []) if (!Object.hasOwn(layers.effective.values, expired.field)) {
          const { field, value, ...origin } = expired;
          selected.set(field, { value, origin });
        }
        for (const [field, { value, origin }] of selected) {
          const began = instant(origin.at), contractExpiry = began + (fields.get(field).maxAgeDays ?? 30) * 864e5;
          const expires = origin.until ? Math.min(contractExpiry, instant(origin.until)) : contractExpiry;
          if (!Number.isFinite(expires) || Math.abs(expires) > 864e13 || Math.trunc(expires) <= began) fail("invalid preference bridge lifetime");
          const until = new Date(expires).toISOString();
          const refs = [...new Set([origin.eventId, origin.proposalId, origin.feedbackId].filter(Boolean))];
          observations.push({
            id: origin.eventId,
            scope: copy(domainScope),
            contract: copy(reference),
            field,
            value,
            source: "declared",
            at: origin.at,
            until,
            refs
          });
          lineage.push({
            field,
            eventId: origin.eventId,
            source: origin.source,
            duration: origin.duration,
            encounterId: origin.encounterId,
            at: origin.at,
            until
          });
        }
        const understanding = domain.understand({ contract, scope: domainScope, observations, at });
        return copy({ observations, layers, understanding, lineage });
      }
      function recordPreference(input = {}) {
        if (!record(input) || !Object.hasOwn(PREFERENCE_KEYS, input.kind)) fail("invalid preference action");
        const { contract, scope, encounterId, at, id, kind, events = [] } = input;
        const extraKeys = PREFERENCE_KEYS[kind], optionalKeys = preferenceOptional(kind), keys = ["contract", "scope", "events", "encounterId", "at", "id", "kind", ...extraKeys, ...optionalKeys];
        if (!exact(input, keys)) fail("unsupported preference action input");
        const prior = preferenceReplay({ contract, scope, events, encounterId, at }).events;
        const event = {
          version: PREFERENCE_VERSION,
          id,
          scope: copy(scope),
          contract: { id: contract.id, version: contract.version, purpose: contract.purpose },
          encounterId,
          at,
          kind,
          source: kind === "apply" ? "feedback-confirmed" : "explicit"
        };
        for (const key of extraKeys) {
          if (!Object.hasOwn(input, key)) fail(`missing preference ${key}`);
          event[key] = input[key];
        }
        for (const key of optionalKeys) if (Object.hasOwn(input, key)) event[key] = input[key];
        return copy(preferenceReplay({ contract, scope, events: [...prior, event], encounterId, at }).events);
      }
      const preferences = Object.freeze({ project: projectPreferences, record: recordPreference, layers: preferenceLayers, toDomain: preferencesToDomain });
      return Object.freeze({
        VERSION,
        PREFERENCE_VERSION,
        preferences,
        OPTIONS,
        FIELDS,
        REASONS,
        REASON_GOAL,
        MAX_REASONS,
        DEFAULT_PRESENTATION,
        createProfile,
        updateProfile,
        clearProfile,
        selectPersonalization,
        recordCompletion,
        recordFeedback,
        coreScope,
        validateProfile: checkProfile,
        // Optional Core capability: products that need field-based decisions load it.
        get domain() {
          const domain = getDomain();
          if (!domain?.decide) fail("load Core domain capability first");
          return domain;
        }
      });
    });
  }
});
export default require_personalization();
