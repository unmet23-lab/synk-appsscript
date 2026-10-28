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

// atlas/ask.js
var require_ask = __commonJS({
  "atlas/ask.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.SynkAsk = factory();
    })(typeof globalThis !== "undefined" ? globalThis : exports, function() {
      "use strict";
      const VERSION2 = "ask-1.1";
      const MAX_OPTIONS = 64;
      const KINDS3 = ["setting", "confirm", "choice", "refresh", "follow_up"];
      const DAY2 = 864e5;
      const id2 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      const canonical = (value) => JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);
      const time = (value) => {
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
          if (!q || !id2(q.id) || ids.has(q.id) || !KINDS3.includes(q.kind ?? "setting") || !id2(q.about ?? q.id) || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > MAX_OPTIONS) throw new TypeError(`Ask: invalid question ${q && q.id}`);
          ids.add(q.id);
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
          if (Object.hasOwn(asked, q.id) && now !== null && time(now) - time(asked[q.id]) < quietDays * DAY2) {
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
        if (usedToday >= budget) return { version: VERSION2, status: "none", reason: "budget", ranked };
        const valued = typeof input.evaluate === "function";
        const best = ranked.find((entry) => !entry.skippable && (valued ? entry.value > 0 : entry.impact > 0));
        if (!best) return { version: VERSION2, status: "none", reason: valued ? "no-question-has-positive-decision-value" : "no-question-changes-the-decision", ranked };
        return {
          version: VERSION2,
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
      return Object.freeze({ VERSION: VERSION2, MAX_OPTIONS, KINDS: KINDS3, rank, choose, fromAtlas });
    });
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
      const VERSION2 = "trail-practice-2";
      const TYPES = ["practice.presented", "practice.helped", "practice.attempted", "practice.delivery"];
      const BASE = ["schema", "id", "scope", "at", "recordedAt", "type"];
      const FIELDS = {
        "practice.presented": ["decisionId", "taskId", "taskVersion", "itemKey", "conceptIds", "firstExposure"],
        "practice.helped": ["presentationId", "helpId", "level", "contentRef"],
        "practice.attempted": ["presentationId", "attemptNo", "verdict", "errorTags"],
        "practice.delivery": ["presentationId", "audio"]
      };
      const OPTIONAL = { "practice.presented": ["measure"], "practice.attempted": ["reason", "choice"] };
      const VERDICTS2 = ["correct", "incorrect", "unassessed", "skipped"];
      const copy = (value) => JSON.parse(JSON.stringify(value));
      const canonical = (value) => JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key2) => [key2, entry[key2]])) : entry);
      const id2 = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
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
        if (!scope || typeof scope !== "object" || Object.keys(scope).some((k) => !["domain", "workspace", "subject"].includes(k)) || !["LAB", "SHIFT", "PATH"].includes(scope.domain) || !id2(scope.workspace) || !id2(scope.subject)) throw new TypeError("Trail: invalid practice scope");
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
      function validate(event2) {
        if (!event2 || !TYPES.includes(event2.type) || event2.schema !== 1 || !id2(event2.id)) throw new TypeError("Trail: invalid practice event");
        const fields = [...BASE, ...FIELDS[event2.type]];
        if (Object.keys(event2).some((k) => !fields.includes(k) && !(OPTIONAL[event2.type] || []).includes(k)) || fields.some((k) => !Object.hasOwn(event2, k))) throw new TypeError("Trail: unexpected or missing practice field");
        key(event2.scope);
        if (time(event2.recordedAt) < time(event2.at)) throw new TypeError("Trail: recorded before occurrence");
        if (event2.type === TYPES[0]) {
          if (![event2.decisionId, event2.taskId, event2.taskVersion, event2.itemKey].every(id2) || !uniqueList(event2.conceptIds, id2, 32) || ![true, false, null].includes(event2.firstExposure)) throw new TypeError("Trail: invalid presentation");
          if (event2.measure != null) {
            const m = event2.measure, keys = ["skillId", "modality", "difficulty", "familyKey", "audioRequired", "confounded"];
            if (Object.keys(m).some((k) => !keys.includes(k) && k !== "responseFormat") || keys.some((k) => !Object.hasOwn(m, k)) || !id2(m.skillId) || !event2.conceptIds.includes(m.skillId) || !id2(m.familyKey) || typeof m.modality !== "string" || !/^[a-z][a-z0-9_-]{0,40}$/.test(m.modality) || ![1, 2, 3].includes(m.difficulty) || Object.hasOwn(m, "responseFormat") && !["binary-choice", "single-choice", "cup-compose", "action", "unknown"].includes(m.responseFormat) || typeof m.audioRequired !== "boolean" || typeof m.confounded !== "boolean") throw new TypeError("Trail: invalid measurement contract");
          }
        } else if (event2.type === TYPES[1]) {
          if (![event2.presentationId, event2.helpId, event2.contentRef].every(id2) || !["cue", "explanation", "answer"].includes(event2.level)) throw new TypeError("Trail: invalid help");
        } else if (event2.type === TYPES[3]) {
          if (!id2(event2.presentationId) || !["pending", "completed", "failed"].includes(event2.audio)) throw new TypeError("Trail: invalid audio delivery");
        } else if (!id2(event2.presentationId) || !Number.isInteger(event2.attemptNo) || event2.attemptNo < 1 || !VERDICTS2.includes(event2.verdict) || !uniqueList(event2.errorTags, tag, 24) || event2.reason != null && !["motor", "audio", "unanswered", "demo", "visual", "storage"].includes(event2.reason)) throw new TypeError("Trail: invalid attempt");
        if (event2.type === TYPES[2] && Object.hasOwn(event2, "choice")) choiceRecord(event2.choice);
        return event2;
      }
      function linked(event2, prior, parent, attempts) {
        if (!vouched.has(event2)) validate(event2);
        if (prior) {
          if (canonical(prior) !== canonical(event2)) throw new Error("Trail: conflicting event id");
          return event2;
        }
        const presented = event2.type === TYPES[0];
        if (!parent || parent.type !== (presented ? "decision.made" : TYPES[0]) || scopeOf(parent) !== scopeOf(event2) || atOf(parent) > atOf(event2) || recordedOf(parent) > recordedOf(event2)) throw new Error("Trail: practice requires a prior parent in the same scope");
        if (event2.type === TYPES[2]) {
          if (event2.attemptNo !== attempts.count + 1 || attempts.latest > atOf(event2)) throw new Error("Trail: attempt sequence must be consecutive");
        }
        return event2;
      }
      const link = (event2, parent, attempts) => linked(event2, null, parent, attempts);
      function vouch(event2) {
        if (TYPES.includes(event2?.type)) validate(event2);
        else if (!event2?.scope || ![event2.scope.domain, event2.scope.workspace, event2.scope.subject].every((v) => typeof v === "string")) throw new TypeError("Trail: invalid log entry");
        freeze(event2);
        vouched.set(event2, { scope: `${event2.scope.domain}/${event2.scope.workspace}/${event2.scope.subject}`, at: time(event2.at), recordedAt: time(event2.recordedAt) });
        return event2;
      }
      function checkLink(events, event2) {
        const attempts = { count: 0, latest: -Infinity };
        for (const earlier of events) if (earlier.type === TYPES[2] && earlier.presentationId === event2.presentationId) {
          attempts.count += 1;
          attempts.latest = Math.max(attempts.latest, time(earlier.at));
        }
        return linked(
          event2,
          events.find((e) => e.id === event2.id),
          events.find((e) => e.id === (event2.type === TYPES[0] ? event2.decisionId : event2.presentationId)),
          attempts
        );
      }
      function judge(event2, p, prior, audio) {
        const assisted = prior(["help", "answer"]) ? true : p.firstExposure === true ? false : null;
        const exposure = prior(["attempt", "answer"]) || p.firstExposure === false ? "repeat" : p.firstExposure === true ? "new" : "unknown";
        const usableDelivery = !p.measure || !p.measure.confounded && (!p.measure.audioRequired || audio === "completed");
        const exclusionReason = event2.reason || (p.measure?.confounded ? "visual" : !usableDelivery ? "audio" : null);
        return {
          assisted,
          exposure,
          usableDelivery,
          exclusionReason,
          independent: !exclusionReason && usableDelivery && assisted === false && exposure === "new" && ["correct", "incorrect"].includes(event2.verdict)
        };
      }
      const attemptRow = (event2, p, arm, audio, j) => ({
        eventId: event2.id,
        at: event2.at,
        recordedAt: event2.recordedAt,
        presentationId: p.id,
        decisionId: p.decisionId,
        arm,
        taskId: p.taskId,
        taskVersion: p.taskVersion,
        itemKey: p.itemKey,
        conceptIds: [...p.conceptIds],
        attemptNo: event2.attemptNo,
        verdict: event2.verdict,
        errorTags: [...event2.errorTags],
        assisted: j.assisted,
        exposure: j.exposure,
        ...Object.hasOwn(event2, "choice") ? { choice: choiceRecord(event2.choice) } : {},
        ...p.measure ? { measure: { ...p.measure, responseFormat: p.measure.responseFormat || "unknown" }, audio, exclusionReason: j.exclusionReason } : j.exclusionReason ? { exclusionReason: j.exclusionReason } : {},
        independent: j.independent
      });
      const traceKeys = (p) => [`item:${p.itemKey}`, ...p.measure ? [`family:${p.measure.familyKey}`] : []];
      const BITS = Object.freeze({ attempt: 1, answer: 2, help: 4 });
      const foldedBefore = (prior, traceKey, kind) => !!prior && Object.prototype.hasOwnProperty.call(prior.keys, traceKey) && (prior.keys[traceKey] & BITS[kind]) !== 0;
      function summarize(events, { scope, asOf, recordedAsOf = asOf, decisions = null, prior = null } = {}) {
        const scopeId = key(scope), cutoff = time(asOf), recordedCutoff = time(recordedAsOf);
        if (!Array.isArray(events)) throw new TypeError("Trail: log must be an array");
        if (decisions !== null && (!Array.isArray(decisions) || !decisions.every(id2))) throw new TypeError("Trail: invalid decision filter");
        const reported = (decisionId) => decisions === null || decisions.includes(decisionId);
        const all = [], seen = /* @__PURE__ */ new Map(), attemptOrder = /* @__PURE__ */ new Map();
        for (const event2 of events) {
          if (!event2 || !event2.scope || (vouched.get(event2)?.scope ?? `${event2.scope.domain}/${event2.scope.workspace}/${event2.scope.subject}`) !== scopeId) continue;
          if (seen.has(event2.id)) {
            if (canonical(seen.get(event2.id)) !== canonical(event2)) throw new Error("Trail: conflicting event id");
            continue;
          }
          if (TYPES.includes(event2.type)) linked(
            event2,
            null,
            seen.get(event2.type === TYPES[0] ? event2.decisionId : event2.presentationId),
            attemptOrder.get(event2.presentationId) || { count: 0, latest: -Infinity }
          );
          if (event2.type === TYPES[2]) {
            const earlier = attemptOrder.get(event2.presentationId) || { count: 0, latest: -Infinity };
            attemptOrder.set(event2.presentationId, { count: earlier.count + 1, latest: Math.max(earlier.latest, atOf(event2)) });
          }
          seen.set(event2.id, event2);
          all.push(event2);
        }
        const visible = all.filter((e) => atOf(e) <= cutoff && recordedOf(e) <= recordedCutoff);
        const excluded = new Set(visible.filter((e) => e.type === "record.excluded").map((e) => e.targetId));
        const arms = new Map(visible.filter((e) => e.type === "decision.made").map((e) => [e.id, e.arm ?? null]));
        const provenance = /* @__PURE__ */ new Map(), traces = /* @__PURE__ */ new Map();
        visible.forEach((event2, index) => {
          if (event2.type === TYPES[0]) provenance.set(event2.id, event2);
          const p = provenance.get(event2.presentationId);
          if (event2.type !== TYPES[1] && event2.type !== TYPES[2] || !p) return;
          for (const traceKey of traceKeys(p)) {
            if (!traces.has(traceKey)) traces.set(traceKey, /* @__PURE__ */ new Map());
            const trace = traces.get(traceKey), kind = event2.type === TYPES[2] ? "attempt" : event2.level === "answer" ? "answer" : "help";
            const earlier = trace.get(kind);
            trace.set(kind, { index: Math.min(earlier?.index ?? Infinity, index), at: Math.min(earlier?.at ?? Infinity, atOf(event2)) });
          }
        });
        const presentations = [], help = [], attempts = [], met = /* @__PURE__ */ new Map(), audioByPresentation = /* @__PURE__ */ new Map();
        const meet = (p, at, verdict) => {
          if (!met.has(p.itemKey)) met.set(p.itemKey, { itemKey: p.itemKey, conceptIds: [...p.conceptIds], at, verdict });
        };
        let excludedAttempts = 0;
        visible.forEach((event2, index) => {
          if (event2.type === TYPES[3]) {
            audioByPresentation.set(event2.presentationId, excluded.has(event2.id) ? "pending" : event2.audio);
            return;
          }
          if (event2.type === TYPES[0]) {
            if (reported(event2.decisionId) && !excluded.has(event2.id) && !excluded.has(event2.decisionId)) presentations.push({
              eventId: event2.id,
              at: event2.at,
              recordedAt: event2.recordedAt,
              decisionId: event2.decisionId,
              taskId: event2.taskId,
              taskVersion: event2.taskVersion,
              itemKey: event2.itemKey,
              conceptIds: [...event2.conceptIds],
              firstExposure: event2.firstExposure,
              ...event2.measure ? { measure: { ...event2.measure, responseFormat: event2.measure.responseFormat || "unknown" } } : {}
            });
            return;
          }
          const p = provenance.get(event2.presentationId);
          if (event2.type !== TYPES[1] && event2.type !== TYPES[2] || !p) return;
          const omitted = excluded.has(event2.id) || excluded.has(p.id) || excluded.has(p.decisionId);
          const shown = reported(p.decisionId) && !omitted;
          if (event2.type === TYPES[1]) {
            if (event2.level === "answer") meet(p, event2.at, null);
            if (shown) help.push({
              eventId: event2.id,
              at: event2.at,
              recordedAt: event2.recordedAt,
              presentationId: p.id,
              helpId: event2.helpId,
              level: event2.level,
              contentRef: event2.contentRef
            });
            return;
          }
          const at = atOf(event2);
          const earlier = (kinds) => traceKeys(p).some((traceKey) => kinds.some((kind) => {
            if (foldedBefore(prior, traceKey, kind)) return true;
            const first = traces.get(traceKey)?.get(kind);
            return first && (first.index < index || first.at < at);
          }));
          const audio = audioByPresentation.get(p.id) || "pending", j = judge(event2, p, earlier, audio);
          meet(p, event2.at, omitted || j.exclusionReason ? null : event2.verdict);
          if (!reported(p.decisionId)) return;
          if (omitted) {
            excludedAttempts += 1;
            return;
          }
          attempts.push(attemptRow(event2, p, arms.get(p.decisionId) ?? null, audio, j));
        });
        return {
          version: VERSION2,
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
        function add(event2) {
          if (!event2 || !event2.scope || (vouched.get(event2)?.scope ?? `${event2.scope.domain}/${event2.scope.workspace}/${event2.scope.subject}`) !== scopeId) return null;
          const at = atOf(event2);
          if (at < lastAt) exact = false;
          lastAt = Math.max(lastAt, at, recordedOf(event2));
          if (event2.type === "decision.made") {
            arms.set(event2.id, event2.arm ?? null);
            return null;
          }
          if (event2.type === "record.excluded") {
            excluded.add(event2.targetId);
            for (const row2 of covering.get(event2.targetId) || []) row2.omitted = true;
            const current = audio.get(deliveries.get(event2.targetId));
            if (current?.id === event2.targetId) current.value = "pending";
            for (const row2 of audioCover.get(event2.targetId) || []) {
              row2.audio = "pending";
              if (row2.measure.audioRequired) {
                row2.independent = false;
                row2.exclusionReason ||= "audio";
              }
            }
            return null;
          }
          if (event2.type === TYPES[0]) {
            presentations.set(event2.id, event2);
            return null;
          }
          if (event2.type === TYPES[3]) {
            deliveries.set(event2.id, event2.presentationId);
            audio.set(event2.presentationId, { id: event2.id, value: excluded.has(event2.id) ? "pending" : event2.audio });
            return null;
          }
          if (event2.type !== TYPES[1] && event2.type !== TYPES[2]) return null;
          const p = presentations.get(event2.presentationId);
          if (!p) return null;
          const keys = traceKeys(p);
          if (event2.type === TYPES[1]) {
            for (const k of keys) {
              helped.add(`help|${k}`);
              if (event2.level === "answer") {
                helped.add(`answer|${k}`);
                seen.add(k);
              }
            }
            return null;
          }
          const prior2 = (kinds) => keys.some((k) => kinds.some((kind) => kind === "attempt" ? seen.has(`attempt|${k}`) : helped.has(`${kind}|${k}`)));
          const proof = audio.get(p.id), delivered = proof?.value || "pending";
          const row = attemptRow(event2, p, arms.get(p.decisionId) ?? null, delivered, judge(event2, p, prior2, delivered));
          if (proof && row.measure) {
            if (!audioCover.has(proof.id)) audioCover.set(proof.id, []);
            audioCover.get(proof.id).push(row);
          }
          row.omitted = excluded.has(event2.id) || excluded.has(p.id) || excluded.has(p.decisionId);
          for (const k of keys) {
            seen.add(`attempt|${k}`);
            seen.add(k);
          }
          for (const target of [event2.id, p.id, p.decisionId]) cover(target, row);
          rows.set(event2.id, row);
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
      const record = (r) => !!r && typeof r === "object" && Object.keys(r).length === RECORD.length && RECORD.every((k) => Object.hasOwn(r, k)) && id2(r.itemKey) && uniqueList(r.conceptIds, id2, 32) && typeof r.at === "string" && Number.isFinite(Date.parse(r.at)) && (r.verdict === null || VERDICTS2.includes(r.verdict));
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
          firstExposure: (itemKey) => !readable || !id2(itemKey) ? null : index.has(itemKey) ? false : partial ? null : true
        });
      }
      const opened = (history) => !!history && typeof history.firstExposure === "function" && typeof history.readable === "boolean" && Array.isArray(history.records) && typeof history.partial === "boolean" && history.records.every(record);
      function remember(history, summary) {
        if (!opened(history)) throw new TypeError("Trail: open the history first");
        if (!summary || summary.version !== VERSION2 || !Array.isArray(summary.met)) throw new TypeError("Trail: use a practice summary");
        if (!history.readable) return null;
        const known = new Set(history.records.map((r) => r.itemKey));
        const added = summary.met.filter((r) => record(r) && !known.has(r.itemKey));
        return { records: [...history.records, ...added].map(copy), partial: history.partial };
      }
      function createPracticeOutcomeIndex(summary) {
        if (!summary || summary.version !== VERSION2 || !Array.isArray(summary.attempts)) throw new TypeError("Trail: use a practice summary");
        const owner = key(summary.scope), cutoff = time(summary.asOf), recordedCutoff = time(summary.recordedAsOf ?? summary.asOf);
        const attempts = /* @__PURE__ */ new Map();
        for (const item of summary.attempts) {
          if (!id2(item.eventId) || !id2(item.presentationId) || !id2(item.decisionId) || !Array.isArray(item.conceptIds) || item.conceptIds.some((value) => !id2(value)) || attempts.has(item.eventId)) throw new TypeError("Trail: invalid practice outcome evidence");
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
          if (!outcome || outcome.type !== "outcome.observed" || !id2(outcome.id) || key(outcome.scope) !== owner || typeof targetLine !== "string" || !/^(need|due|trait):[a-zA-Z0-9_.:-]{1,120}$/.test(targetLine) || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new TypeError("Trail: invalid practice outcome query");
          const start = time(since), at = time(outcome.at), recordedAt = time(outcome.recordedAt);
          if (at > cutoff || recordedAt > recordedCutoff || recordedAt < at || at < start || cutoff - at > maxAgeMs || outcome.measure !== "independent" || outcome.assisted !== false || outcome.targetLine !== targetLine) return null;
          const attempt = attempts.get(outcome.attemptId);
          const concept = targetLine.replace(/^(need|due):/, "").replace(/^(skill|node)\./, "");
          if (!attempt?.qualified || attempt.decisionId !== outcome.decisionId || !attempt.conceptIds.includes(concept) || attempt.at < start || attempt.at > at || attempt.recordedAt > recordedAt || cutoff - attempt.at > maxAgeMs) return null;
          return { evidence: [outcome.id, attempt.eventId, attempt.presentationId] };
        } });
      }
      function growth(summary, history) {
        if (!summary || summary.version !== VERSION2 || !Array.isArray(summary.attempts)) throw new TypeError("Trail: use a practice summary");
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
      return Object.freeze({ VERSION: VERSION2, TYPES, BITS, traceKeys, choiceRecord, validate, checkLink, link, vouch, summarize, createIndex, createPracticeOutcomeIndex, openHistory, remember, growth });
    });
  }
});

// experiences/korean-study/src/tutor.mjs
var import_ask = __toESM(require_ask(), 1);
var import_trail = __toESM(require_trail(), 1);

// experiences/synk-world-app/world-writing-check.mjs
var plain = (text2) => String(text2 ?? "").replace(/\r\n?/g, "\n").normalize("NFC");
var CLOSERS = /[\s.?!…~"'”’)\]」』〉》>]+$/u;
function endingOf(sentence) {
  const tail = String(sentence).replace(CLOSERS, "");
  if (!tail) return "none";
  if (/(시오|읍시다)$/.test(tail) || /(니다|니까|시다)$/.test(tail) && hasBieup(tail.at(-3) ?? "")) return "formal";
  if (/(요|죠)$/.test(tail)) return "polite";
  if (/(했음|됐음|였음|었음|았음|있음|없음|겠음|많음|적음|좋음|높음|낮음|같음|함|됨|임)$/.test(tail)) return "noun";
  if (/(다|까|가|냐|자|라)$/.test(tail)) return "plain";
  return "other";
}
function sentencesOf(text2) {
  const value = plain(text2), out = [];
  let start = 0;
  const push = (end) => {
    const raw = value.slice(start, end), lead = raw.length - raw.trimStart().length, body = raw.trim();
    if (body) out.push({ start: start + lead, end: start + lead + body.length, text: body });
  };
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "\n") {
      push(i);
      start = i + 1;
      continue;
    }
    if (".?!".includes(ch) && (i + 1 >= value.length || /[\s가-힣]/.test(value[i + 1]) || /[가-힣]/.test(value[i - 1] ?? "") && /[0-9A-Za-z]/.test(value[i + 1]))) {
      let j = i + 1;
      while (j < value.length && CLOSERS.test(value[j]) && value[j] !== "\n") j++;
      push(j);
      start = j;
      i = j - 1;
    }
  }
  push(value.length);
  return out;
}
var hasBieup = (syllable) => {
  const code = syllable.charCodeAt(0) - 44032;
  return code >= 0 && code < 11172 && code % 28 === 17;
};

// experiences/synk-world-app/world-writing-focus.mjs
var FOCUS_ID = "ending-53";
var FOCUS_TYPE = 53;
var FOCUS_LOG_MAX = 20;
var DRILL_SIZE = 6;
var BINS = Object.freeze(["formal", "polite", "plain"]);
var KINDS = Object.freeze(["found", "retry", "helped", "independent"]);
var validAt = (at) => typeof at === "string" && Number.isFinite(Date.parse(at));
var validId = (id2) => typeof id2 === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id2);
var cardKey = (card) => card.key || `${card.itemId}:${card.text}`;
function passageSentences(item) {
  const out = [];
  for (const line of item.passage || []) {
    const text2 = line.map((part) => typeof part === "string" ? part : "\0").join("");
    for (const s of sentencesOf(text2)) if (!s.text.includes("\0")) out.push(s.text);
  }
  return out;
}
function drillPool(open = []) {
  const pool = [];
  for (const item of open) {
    if (item?.review?.status !== "passed" || ![51, 52].includes(item.type) || !BINS.includes(item.style)) continue;
    for (const [i, text2] of passageSentences(item).entries()) if (endingOf(text2) === item.style && [...text2].length >= 8) pool.push({ key: `${item.id}:${i}`, text: text2, bin: item.style, itemId: item.id });
  }
  return pool;
}
var mix = (list, seed) => {
  let s = Number(seed) >>> 0 || 1;
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
function drillWeights(focus, { now = Date.now() } = {}) {
  const f = readFocus(focus), latest = f.events.filter((e) => Date.parse(e.at) <= now && ["found", "retry"].includes(e.kind)).at(-1);
  return Object.fromEntries(BINS.map((bin) => {
    const picks = f.practice[bin].filter((p) => Date.parse(p.at) <= now && (!latest || Date.parse(p.at) >= Date.parse(latest.at)));
    if (picks.length) {
      let wrong = 0, total = 0;
      picks.forEach((p, i) => {
        const weight = i + 1;
        total += weight;
        if (!p.correct) wrong += weight;
      });
      return [bin, wrong / total];
    }
    const off = latest?.errors || {}, sum = (off.formal || 0) + (off.polite || 0);
    return [bin, sum ? (off[bin] || 0) / sum : 0];
  }));
}
function drillDeck(pool, { seed = 1, size = DRILL_SIZE, focus = null, now = Date.now() } = {}) {
  const f = readFocus(focus), weights = drillWeights(f, { now }), recent = new Set(f.recentCards), seen = /* @__PURE__ */ new Set();
  const unique = pool.filter((c) => BINS.includes(c.bin) && !seen.has(c.text) && seen.add(c.text));
  const by = Object.fromEntries(BINS.map((bin, i) => {
    const shuffled = mix(unique.filter((c) => c.bin === bin), seed + i + 1);
    return [bin, [...shuffled.filter((c) => !recent.has(cardKey(c))), ...shuffled.filter((c) => recent.has(cardKey(c)))]];
  }));
  const priority = [...BINS].sort((a, b) => weights[b] - weights[a]), extra = Object.fromEntries(BINS.map((bin) => [bin, 0])), deck = [];
  for (const bin of priority) {
    if (deck.length >= size) break;
    const card = by[bin].shift();
    if (card) deck.push(card);
  }
  while (deck.length < size) {
    const available = priority.filter((bin2) => by[bin2].length);
    if (!available.length) break;
    const bin = available.sort((a, b) => weights[b] / (extra[b] + 1) - weights[a] / (extra[a] + 1) || extra[a] - extra[b])[0];
    deck.push(by[bin].shift());
    extra[bin]++;
  }
  if (!priority.some((bin) => weights[bin] > 0)) return mix(deck, seed);
  const first = deck.shift();
  return first ? [first, ...mix(deck, seed)] : [];
}
function compactEvents(events) {
  if (events.length <= FOCUS_LOG_MAX) return events;
  const kinds = events.map((e) => e.kind), lastAlone = kinds.lastIndexOf("independent"), prevAlone = lastAlone > 0 ? kinds.lastIndexOf("independent", lastAlone - 1) : -1;
  const keep = new Set([lastAlone, prevAlone].filter((i) => i >= 0));
  for (const [start, end] of [[prevAlone + 1, lastAlone], [lastAlone + 1, events.length]]) {
    const ids = events.map((e, i) => i >= start && i < end && ["found", "retry"].includes(e.kind) ? i : -1).filter((i) => i >= 0);
    if (ids.length) {
      keep.add(ids[0]);
      keep.add(ids.at(-1));
    }
    for (let i = end - 1; i >= start; i--) if (events[i].kind === "helped") {
      keep.add(i);
      break;
    }
  }
  for (let i = events.length - 1; i >= 0 && keep.size < FOCUS_LOG_MAX; i--) keep.add(i);
  return [...keep].sort((a, b) => a - b).map((i) => events[i]);
}
function readFocus(value, { history = [] } = {}) {
  const v = value && typeof value === "object" && value.id === FOCUS_ID ? value : {};
  const all = (Array.isArray(v.events) ? v.events : []).filter((e) => e && KINDS.includes(e.kind) && validId(e.itemId) && validAt(e.at)).map((e) => ({
    at: e.at,
    itemId: e.itemId,
    kind: e.kind,
    ...Object.fromEntries(["plain", "off", "total"].map((k) => [k, Number.isInteger(e[k]) && e[k] >= 0 ? e[k] : 0])),
    ...e.errors ? { errors: Object.fromEntries(["formal", "polite"].map((bin) => [bin, Number.isInteger(e.errors[bin]) && e.errors[bin] >= 0 ? e.errors[bin] : 0])) } : {}
  }));
  const exposed = new Map(Object.entries(v.exposed && typeof v.exposed === "object" ? v.exposed : {}).filter(([id2, at]) => validId(id2) && validAt(at)));
  const expose = (id2, at) => {
    if (validId(id2) && validAt(at) && (!exposed.has(id2) || Date.parse(at) < Date.parse(exposed.get(id2)))) exposed.set(id2, at);
  };
  for (const e of all) if (e.kind !== "independent") expose(e.itemId, e.at);
  for (const e of Array.isArray(history) ? history : []) if (e?.source === "rule-check" && e.type === FOCUS_TYPE && Array.isArray(e.checks) && e.checks.includes("style")) expose(e.itemId, e.at);
  const practice = Object.fromEntries(BINS.map((bin) => [bin, (Array.isArray(v.practice?.[bin]) ? v.practice[bin] : []).filter((p) => validAt(p?.at) && typeof p.correct === "boolean").slice(-6).map((p) => ({ at: p.at, correct: p.correct }))]));
  const recentCards = (Array.isArray(v.recentCards) ? v.recentCards : []).filter((k) => typeof k === "string" && /^[a-zA-Z0-9_-]{1,100}:\d+$/.test(k)).slice(-12);
  const drill = v.drill && validAt(v.drill.at) && Number.isInteger(v.drill.right) && Number.isInteger(v.drill.total) && v.drill.right >= 0 && v.drill.total > 0 && v.drill.right <= v.drill.total ? { at: v.drill.at, right: v.drill.right, total: v.drill.total } : null;
  return { id: FOCUS_ID, events: compactEvents(all), drill, exposed: Object.fromEntries(exposed), practice, recentCards };
}
var endsPlain = (text2) => {
  const value = String(text2 || "").trim(), sentences = sentencesOf(value);
  return sentences.length === 1 && !/[?？]/.test(value) && endingOf(value) === "plain" && /[가-힣]다[.!。！\s"'”’」』)]*$/.test(value);
};

// experiences/korean-study/src/tutor.mjs
var VERSION = 2;
var OBS_MAX = 240;
var TRAIL_MAX = 1200;
var STALE_DAYS = 14;
var HISTORY_DAYS = 60;
var MIN_SENTENCES = 3;
var PROBE_CARDS = 3;
var PROBE_FORMS = 2;
var LEARN_FORMS = 4;
var KC = "study.ko2.ending-plain";
var SCOPE = Object.freeze({ domain: "LAB", workspace: "study", subject: "device" });
var SITTING_GAP = 2 * 36e5;
var SITTING_WRITES = 3;
var SITTING_FRESH = 2;
var RECHECK_DAYS = [7, 14, 30];
var DAY = 864e5;
var BINS2 = ["formal", "polite", "plain"];
var AXES = ["verb", "adj", "noun", "past"];
var METHODS = ["apply", "forms", "contrast"];
var KINDS2 = ["write", "sort", "form", "find", "change", "method", "probe", "cycle", "semantic"];
var VERDICTS = ["correct", "incorrect", "unassessed"];
var slot = (owner) => typeof owner === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(owner) ? owner : "guest";
var storeKey = (owner) => `synk.study.v2:${slot(owner)}`;
var legacyKey = (owner) => `synk.study.v1:${slot(owner)}`;
var okAt = (at) => typeof at === "string" && Number.isFinite(Date.parse(at));
var id = (v) => typeof v === "string" && /^[a-zA-Z0-9_:-]{1,120}$/.test(v);
var nat = (v) => Number.isInteger(v) && v >= 0 && v <= 500;
var iso = (now) => new Date(now).toISOString();
function cleanObs(o) {
  if (!o || typeof o !== "object" || !KINDS2.includes(o.kind) || !okAt(o.at)) return null;
  const base = { at: o.at, kind: o.kind, n: Number.isInteger(o.n) && o.n > 0 ? o.n : 0, ...id(o.ev) ? { ev: o.ev } : {} };
  if (o.kind === "write") return id(o.itemId) && [0, 1, 2].includes(o.support) && ["plain", "off", "total", "formal", "polite"].every((k) => nat(o[k])) ? {
    ...base,
    itemId: o.itemId,
    support: o.support,
    same: o.same === true,
    plain: o.plain,
    off: o.off,
    total: o.total,
    formal: o.formal,
    polite: o.polite,
    flags: nat(o.flags) ? o.flags : 0,
    axes: Array.isArray(o.axes) ? AXES.filter((a) => o.axes.includes(a)) : [],
    verdict: VERDICTS.includes(o.verdict) ? o.verdict : "unassessed",
    unknown: nat(o.unknown) ? o.unknown : 0,
    linked: o.linked !== false,
    first: o.first === true,
    mode: o.mode === "revise" ? "revise" : "new",
    pasted: o.pasted === true,
    ...o.source === "legacy" ? { source: "legacy" } : {}
  } : null;
  if (o.kind === "sort") return id(o.card) && BINS2.includes(o.bin) && typeof o.ok === "boolean" ? { ...base, card: o.card, bin: o.bin, ok: o.ok, use: o.use === "check" ? "check" : "learn" } : null;
  if (o.kind === "form") return id(o.id) && AXES.includes(o.axis) && ["learn", "check"].includes(o.use) && (typeof o.ok === "boolean" || o.ok === null) ? { ...base, id: o.id, axis: o.axis, use: o.use, ok: o.ok } : null;
  if (o.kind === "find") return id(o.id) && typeof o.ok === "boolean" ? { ...base, id: o.id, ok: o.ok } : null;
  if (o.kind === "change") return typeof o.ok === "boolean" ? { ...base, ok: o.ok } : null;
  if (o.kind === "method") return METHODS.includes(o.method) ? { ...base, method: o.method } : null;
  if (o.kind === "probe") return ["distinguish", "form"].includes(o.probe) ? { ...base, probe: o.probe } : null;
  if (o.kind === "cycle") return base;
  if (o.kind === "semantic") return ["analysis", "check", "practice"].includes(o.stage) && typeof o.skill === "string" && o.skill.length < 50 ? { ...base, stage: o.stage, skill: o.skill, source: "ai-reference", result: ["focus", "clear", "insufficient", "selected-right", "selected-other"].includes(o.result) ? o.result : "insufficient" } : null;
  return null;
}
var cleanDrafts = (v) => Object.fromEntries(Object.entries(v && typeof v === "object" ? v : {}).filter(([k, d]) => id(k) && d && typeof d.text === "string" && d.text.length <= 4e3).map(([k, d]) => [k, { text: d.text, updatedAt: okAt(d.updatedAt) ? d.updatedAt : null, checkedAt: okAt(d.checkedAt) ? d.checkedAt : null, ...Number.isInteger(d.pasted) && d.pasted > 0 && d.pasted <= 1e5 ? { pasted: d.pasted } : {} }]));
var cleanSeen = (v) => Object.fromEntries(Object.entries(v && typeof v === "object" ? v : {}).filter(([k, at]) => id(k) && okAt(at)));
var ordered = (obs) => {
  let n = 0;
  return obs.map((o) => {
    n = Math.max(n + 1, o.n || 0);
    return { ...o, n };
  });
};
var seqOf = (e) => Number(/(\d+)(-\d+)?$/.exec(e.id)?.[1] || 0);
function readState(raw, { now = Date.now() } = {}) {
  const v = raw && typeof raw === "object" && raw.v === VERSION ? raw : {};
  const obs = capObs(ordered((Array.isArray(v.obs) ? v.obs : []).map(cleanObs).filter(Boolean)));
  const trail = cleanTrail(v.trail);
  const seq = Math.max(Number.isInteger(v.seq) ? v.seq : 0, obs.at(-1)?.n || 0, ...trail.map(seqOf));
  const recentCards = (Array.isArray(v.recentCards) ? v.recentCards : []).filter(id).slice(-12);
  const scene = v.scene && typeof v.scene === "object" && typeof v.scene.id === "string" ? v.scene : null;
  return { v: VERSION, seq, obs, trail, drafts: cleanDrafts(v.drafts), seen: cleanSeen(v.seen), recentCards, scene };
}
function cleanTrail(list) {
  const groups = [];
  for (const e of Array.isArray(list) ? list : []) {
    if (!e || typeof e !== "object") continue;
    if (e.type === "decision.made" || !groups.length) groups.push([e]);
    else groups.at(-1).push(e);
  }
  const ids = /* @__PURE__ */ new Set(), out = [];
  for (const g of groups) {
    const d = g[0], pres = /* @__PURE__ */ new Map();
    let last = Date.parse(d.at), ok = d.type === "decision.made" && id(d.id) && okAt(d.at) && d.scope?.domain === SCOPE.domain && d.scope?.workspace === SCOPE.workspace && d.scope?.subject === SCOPE.subject && !ids.has(d.id);
    for (const e of g.slice(1)) {
      if (!ok) break;
      try {
        import_trail.default.validate(e);
      } catch {
        ok = false;
        break;
      }
      const t = Date.parse(e.at);
      if (t < last || ids.has(e.id) || e.scope.subject !== SCOPE.subject || e.scope.workspace !== SCOPE.workspace) {
        ok = false;
        break;
      }
      last = t;
      if (e.type === "practice.presented") {
        if (e.decisionId !== d.id) {
          ok = false;
          break;
        }
        pres.set(e.id, 0);
      } else {
        if (!pres.has(e.presentationId)) {
          ok = false;
          break;
        }
        if (e.type === "practice.attempted") {
          const n = pres.get(e.presentationId) + 1;
          if (e.attemptNo !== n) {
            ok = false;
            break;
          }
          pres.set(e.presentationId, n);
        }
      }
    }
    if (ok) {
      g.forEach((e) => ids.add(e.id));
      out.push(...g);
    }
  }
  return out;
}
var bump = (state) => {
  const seq = state.seq + 1;
  return [{ ...state, seq }, seq];
};
var capObs = (obs) => {
  if (obs.length <= OBS_MAX) return obs;
  const out = [...obs];
  while (out.length > OBS_MAX) {
    const i = out.findIndex((o) => o.kind !== "write");
    out.splice(i >= 0 && i < out.length - 1 ? i : 0, 1);
  }
  return out;
};
var addObs = (state, o, { now = Date.now() } = {}) => {
  const [s, n] = bump(state), c = cleanObs({ ...o, n, at: o.at || iso(now) });
  return c ? { ...s, obs: capObs([...s.obs, c]) } : state;
};
var markSeen = (state, ids, { now = Date.now() } = {}) => ({ ...state, seen: { ...Object.fromEntries(ids.filter(id).map((i) => [i, iso(now)])), ...state.seen } });
var event = (type, eid, at, fields) => ({ ...type.startsWith("practice.") ? { schema: 1 } : {}, id: eid, type, scope: { ...SCOPE }, at, recordedAt: at, ...fields });
function recordDecision(state, plan, { now = Date.now() } = {}) {
  const [s, n] = bump(state), did = `d${n}`, at = iso(Math.max(now, ...s.trail.slice(-1).map((e) => Date.parse(e.at))));
  const clean = Object.fromEntries(Object.entries(plan || {}).filter(([, v]) => typeof v === "string" && v.length <= 80 || Number.isFinite(v)));
  return { state: trim({ ...s, trail: [...s.trail, event("decision.made", did, at, { plan: clean })] }), did };
}
function recordAnswer(state, { did, itemKey, concept, helps = [], verdict, errorTags = [], choice = null, reveal = null, taskId = "study-ending" }, { now = Date.now() } = {}) {
  let s = state;
  if (!did || !s.trail.some((e) => e.id === did && e.type === "decision.made")) {
    const r = recordDecision(s, { scene: "resume" }, { now });
    s = r.state;
    did = r.did;
  }
  const at = iso(Math.max(now, ...s.trail.slice(-1).map((e) => Date.parse(e.at)))), first = !s.seen[itemKey];
  const [s1, n] = bump(s), pid = `p${n}`, ev = `a${n}`;
  const out = [event("practice.presented", pid, at, { decisionId: did, taskId, taskVersion: "1", itemKey, conceptIds: [concept], firstExposure: first })];
  helps.forEach((h, i) => out.push(event("practice.helped", `h${n}-${i}`, at, { presentationId: pid, helpId: h.id, level: h.level, contentRef: h.id })));
  out.push(event("practice.attempted", ev, at, { presentationId: pid, attemptNo: 1, verdict, errorTags: [...new Set(errorTags)].slice(0, 24), ...choice ? { choice } : {} }));
  if (reveal) out.push(event("practice.helped", `r${n}`, at, { presentationId: pid, helpId: reveal, level: "answer", contentRef: reveal }));
  try {
    out.forEach((e) => import_trail.default.validate(e));
  } catch {
    return { state: markSeen(s1, [itemKey], { now }), ev: null, first };
  }
  return { state: trim(markSeen({ ...s1, trail: [...s1.trail, ...out] }, [itemKey], { now })), ev, first };
}
function recordWrite(state, { did, item = null, itemId = item?.id, text: text2, support = 0, mode = "new", pasted = false }, { now = Date.now() } = {}) {
  const o = observeWrite(text2, item);
  if (!o) return { state, o: null };
  const verdict = pasted ? "unassessed" : o.verdict;
  const helps = support === 2 ? [{ id: "forms-table", level: "cue" }] : support === 1 ? [{ id: "self-check", level: "cue" }] : [];
  const r = recordAnswer(state, { did, itemKey: itemId, concept: KC, helps, verdict, errorTags: [...o.errorTags, ...pasted ? ["input.pasted"] : []] }, { now });
  const next2 = addObs(r.state, { kind: "write", itemId, support, plain: o.plain, off: o.off, total: o.total, formal: o.formal, polite: o.polite, flags: o.flags, axes: o.axes, verdict: o.verdict, unknown: o.unknown.length, linked: o.linked, first: r.first, mode, pasted, ev: r.ev }, { now });
  return { state: next2, o, ev: r.ev, first: r.first, verdict };
}
function recordSort(state, { did, card, pick, learn = false }, { now = Date.now() } = {}) {
  const ok = card.bin === pick;
  const r = recordAnswer(state, { did, itemKey: `card:${card.key}`, concept: `${KC}.distinguish`, helps: learn ? [{ id: "method-contrast", level: "explanation" }] : [], verdict: ok ? "correct" : "incorrect", errorTags: ok ? [] : [`bin.${pick}`], choice: { selectedId: pick, correctId: card.bin } }, { now });
  return { state: addObs(r.state, { kind: "sort", card: card.key, bin: card.bin, ok, use: learn ? "learn" : "check", ev: r.ev }, { now }), ok };
}
function recordForm(state, { did, form, grade, learn = form.use === "learn" }, { now = Date.now() } = {}) {
  const verdict = grade === true ? "correct" : grade === false ? "incorrect" : "unassessed";
  const r = recordAnswer(state, { did, itemKey: form.id, concept: `${KC}.${form.axis}`, helps: learn ? [{ id: "method-forms", level: "explanation" }] : [], verdict, errorTags: grade === "typo" ? ["input.typo"] : [], reveal: learn ? `answer-${form.id}` : null }, { now });
  return { state: addObs(r.state, { kind: "form", id: form.id, axis: form.axis, use: form.use, ok: grade === true ? true : grade === false ? false : null, ev: r.ev }, { now }), verdict };
}
function trim(state) {
  const groups = [];
  for (const e of state.trail) {
    if (e.type === "decision.made" || !groups.length) groups.push([e]);
    else groups.at(-1).push(e);
  }
  const latest = Date.parse(state.trail.at(-1)?.at || 0);
  let keep = groups.filter((g) => latest - Date.parse(g[0].at) <= HISTORY_DAYS * DAY), count = keep.flat().length;
  while (count > TRAIL_MAX && keep.length > 1) {
    const i = keep.findIndex((g) => g[0].plan?.scene !== "write" && !g.some((e) => e.conceptIds?.[0] === KC));
    const at = i >= 0 && i < keep.length - 1 ? i : 0;
    count -= keep[at].length;
    keep = keep.filter((_, j) => j !== at);
  }
  return keep.length === groups.length ? state : { ...state, trail: keep.flat() };
}
function trailRows(state, now) {
  try {
    return new Map(import_trail.default.summarize(state.trail, { scope: SCOPE, asOf: iso(now) }).attempts.map((a) => [a.eventId, a]));
  } catch {
    return /* @__PURE__ */ new Map();
  }
}
function migrate(raw, { now = Date.now(), pool = [] } = {}) {
  if (!raw || typeof raw !== "object" || raw.v !== 1) return readState(null, { now });
  let s = readState({ v: VERSION, drafts: raw.drafts, recentCards: raw.recentCards }, { now });
  const old = (Array.isArray(raw.obs) ? raw.obs : []).map(cleanObs).filter(Boolean).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const shown = old.some((o) => o.kind === "method" && o.method === "contrast") ? BINS2.flatMap((b) => pool.filter((c) => c.bin === b).slice(0, 2).map((c) => `card:${c.key}`)) : [];
  if (old.length) s = markSeen(s, shown, { now: Date.parse(old[0].at) });
  for (const o of old) {
    const t = Date.parse(o.at), write = o.kind === "write", legacyVerdict = write ? o.off > 0 || o.flags > 0 ? "incorrect" : "unassessed" : null;
    let ev = null;
    if (write || o.kind === "sort" || o.kind === "form") {
      const d = recordDecision(s, { scene: "legacy" }, { now: t });
      s = d.state;
      const itemKey = write ? o.itemId : o.kind === "sort" ? `card:${o.card}` : o.id;
      if (write ? o.same : o.use !== "check") s = markSeen(s, [itemKey], { now: t });
      const verdict = write ? legacyVerdict : o.ok === true ? "correct" : o.ok === false ? "incorrect" : "unassessed";
      const helps = write ? o.support > 0 ? [{ id: "legacy-support", level: "cue" }] : [] : o.use === "learn" ? [{ id: "legacy-method", level: "explanation" }] : [];
      const r = recordAnswer(s, { did: d.did, itemKey, concept: write ? KC : o.kind === "sort" ? `${KC}.distinguish` : `${KC}.${o.axis}`, helps, verdict, errorTags: ["source.legacy"] }, { now: t });
      s = r.state;
      ev = r.ev;
    }
    s = addObs(s, { ...o, ...ev ? { ev } : {}, ...write ? { verdict: legacyVerdict, source: "legacy", first: !o.same } : {} }, { now: t });
  }
  return markSeen({ ...s, seen: { ...s.seen, ...cleanSeen(raw.seen) } }, [...shown, ...(raw.recentCards || []).filter(id).map((k) => `card:${k}`)], { now });
}
function observeWrite(text2, item = null) {
  const sentences = sentencesOf(String(text2 || "")).filter((s) => s.text.replace(/[\s.!?]/g, ""));
  if (sentences.length < MIN_SENTENCES) return null;
  const distinct = new Set(sentences.filter((s) => s.text.trim().split(/\s+/).length >= 2).map((s) => s.text.replace(/[\s.!?。！？]+/g, "")));
  if (distinct.size < MIN_SENTENCES) return null;
  const source = item ? compact([item.instruction, item.prompt, ...item.questions || [], item.label].filter((v) => typeof v === "string").join("")) : "";
  const copied = (t) => {
    const c = compact(t);
    if (!source || c.length < 10) return false;
    for (let i = 0; i + 10 <= c.length; i++) if (source.includes(c.slice(i, i + 10))) return true;
    return false;
  };
  const ends = sentences.map((s) => endingOf(s.text)), checks = sentences.map((s) => copied(s.text) ? { v: "unknown", why: "copied" } : endCheck(s.text));
  const formal = ends.filter((e) => e === "formal").length, polite = ends.filter((e) => e === "polite").length, plain2 = sentences.filter((s) => endsPlain(s.text)).length;
  const offSentences = sentences.filter((s, i) => ends[i] === "formal" || ends[i] === "polite").map((s) => s.text);
  const flagged = sentences.filter((s, i) => checks[i].v === "wrong" && checks[i].why !== "ending").map((s) => s.text);
  const unknown = sentences.filter((s, i) => checks[i].v === "unknown").map((s) => s.text), ok = checks.filter((c) => c.v === "ok").length;
  const linked = item ? linkedTo(item, text2) : true, wrong = formal + polite + flagged.length;
  const verdict = wrong ? "incorrect" : ok >= MIN_SENTENCES && unknown.length <= 1 && linked ? "correct" : "unassessed";
  const errorTags = [...new Set(checks.filter((c) => c.v === "wrong").map((c) => c.why === "ending" ? "ending.off" : `form.${c.why}`)), ...linked ? [] : ["task.unlinked"]];
  return { plain: plain2, off: formal + polite, total: sentences.length, formal, polite, flags: flagged.length, axes: offAxes(offSentences), offSentences, flagged, unknown, ok, linked, verdict, errorTags: [...errorTags, ...checks.some((c) => c.why === "copied") ? ["input.copied"] : []], task: "unassessed" };
}
var compact = (t) => String(t || "").replace(/[\s.,!?·「」『』"'()\-~]/g, "");
var STOP = /* @__PURE__ */ new Set(["단위", "조사", "기관", "대상", "결과", "다음", "내용", "자료", "관한", "대한", "있는", "없는", "하는", "위한", "그리고"]);
function linkedTo(item, text2) {
  const src = [item.label, ...(item.data?.tables || []).flatMap((t) => [t.caption, ...t.columns || [], ...(t.rows || []).flat()]), ...(item.data?.lists || []).flatMap((l) => [l.caption, ...l.items || []]), item.prompt, ...item.questions || []].filter((v) => typeof v === "string").join(" ");
  const body = String(text2 || "").replace(/,/g, ""), nums = new Set(src.replace(/,/g, "").match(/\d{2,}/g) || []);
  const words = [...new Set((src.match(/[가-힣]{2,}/g) || []).filter((w) => !STOP.has(w)))].filter((w) => body.includes(w) || w.length >= 3 && body.includes(w.slice(0, -1)));
  return words.length >= 1 && (words.length >= 2 || [...nums].some((n) => body.includes(n)));
}
function offAxes(sentences = []) {
  const out = /* @__PURE__ */ new Set();
  for (const s of sentences) {
    const t = s.replace(/[\s.!?"'」』)]+$/, "");
    if (/(았|었|였|했)(습니다|어요)$/.test(t)) out.add("past");
    else if (/(입니다|이에요|예요)$/.test(t)) out.add("noun");
    else {
      out.add("verb");
      out.add("adj");
    }
  }
  return AXES.filter((a) => out.has(a));
}
var jong = (ch) => {
  const c = (ch || "").charCodeAt(0) - 44032;
  return c >= 0 && c < 11172 ? c % 28 : -1;
};
var jung = (ch) => {
  const c = (ch || "").charCodeAt(0) - 44032;
  return c >= 0 && c < 11172 ? Math.floor(c / 28) % 21 : -1;
};
var ADJ_NEUN = /(많|높|낮|좋|싫|작|넓|좁|짧|같|깊|괜찮)는다$/;
var ADJ_N = /((중요|필요|간단|다양|편리|복잡|충분|부족|가능|유명|일정|분명|확실|적당|위험|안전|건강|행복|불편|비슷|깨끗|조용|유사|동일|심각|활발|풍부|저렴)한|(비싼|빠른|느린|다른|예쁜|바쁜|아픈|기쁜|나쁜|슬픈)|(쉬|어려|가까|무거|가벼|즐거|새로|귀여)운)다$/;
var DICT_VERB = /(증가|감소|차지|변화|사용|이용|참가|참여|발생|선택|조사|응답|공부|생활|운동|이동|거주|방문|구입|구매|판매|생각|준비|시작|노력|설명|진행|결정|활동|성장|확대|상승|하락)하다$|(늘어나|줄어들|오르|내리|떨어지)다$|(?<![가-힣])(늘|줄)다$/;
var ADJ_OK = /((중요|필요|간단|다양|편리|복잡|충분|부족|가능|유명|일정|분명|확실|적당|위험|안전|건강|행복|불편|편|비슷|깨끗|조용|유사|동일|심각|활발|풍부|저렴)하|많|적|높|낮|크|작|좋|싫|넓|좁|짧|길|같|다르|빠르|느리|비싸|싸|쉽|어렵|가깝|멀|새롭|힘들|즐겁|귀엽|예쁘|바쁘|아프|나쁘|기쁘|슬프)다$/;
var VERB_IDA = /(줄|높|보|늘|붙|먹|속|녹|끓|숙)이다$/;
function endCheck(sentence) {
  const raw = String(sentence || "").trim();
  if (!raw) return null;
  const e = endingOf(raw);
  if (e === "formal" || e === "polite") return { v: "wrong", why: "ending" };
  if (!endsPlain(raw)) return { v: "unknown", why: "shape" };
  const t = raw.replace(/[\s.!。！"'”’」』)]+$/, ""), pre = t.at(-2) || "", before = t.at(-3) || "";
  if (t.endsWith("는다")) {
    if (/(았|었|였|했|겠|없)는다$/.test(t)) return { v: "wrong", why: "past-neun" };
    if (t.endsWith("있는다")) return { v: "unknown", why: "pos" };
    return jong(before) <= 0 || jong(before) === 8 ? { v: "wrong", why: "neun-vowel" } : ADJ_NEUN.test(t) ? { v: "wrong", why: "adj-neun" } : { v: "ok", why: "verb" };
  }
  if (t.endsWith("은다")) return { v: "wrong", why: "adj-neun" };
  if (jong(pre) === 4) return ADJ_N.test(t) ? { v: "wrong", why: "adj-neun" } : { v: "ok", why: "verb" };
  if (jong(pre) === 20 || jong(pre) === 18) return { v: "ok", why: "past" };
  if (DICT_VERB.test(t) || /[가-힣]되다$/.test(t)) return { v: "wrong", why: "dict" };
  if (pre === "지" && jong(before) === 0 && [0, 1, 4, 6, 9, 14].includes(jung(before))) return { v: "wrong", why: "aux-dict" };
  if (t.endsWith("이다") && !VERB_IDA.test(t)) return { v: "ok", why: "copula" };
  if (ADJ_OK.test(t)) return { v: "ok", why: "adj" };
  return { v: "unknown", why: "pos" };
}
function checkChange(text2) {
  const c = endCheck(text2);
  if (!c) return null;
  return c.v === "ok" ? { ok: true, why: null } : c.v === "wrong" ? { ok: false, why: c.why === "ending" ? "ending" : c.why === "dict" || c.why === "aux-dict" ? "dict" : c.why === "past-neun" || c.why === "neun-vowel" ? "neun" : "adj-neun" } : c.why === "shape" ? { ok: false, why: "ending" } : { ok: null, why: "unsure" };
}
var norm = (s) => String(s || "").normalize("NFC").trim().replace(/[.。!]+$/, "").replace(/\s+/g, " ");
var jamo = (s) => [...s].flatMap((ch) => {
  const c = ch.charCodeAt(0) - 44032;
  return c >= 0 && c < 11172 ? [`a${Math.floor(c / 588)}`, `b${Math.floor(c / 28) % 21}`, ...c % 28 ? [`c${c % 28}`] : []] : [ch];
});
function jamoDistance(a, b) {
  const x = jamo(a), y = jamo(b);
  let row = y.map((_, j) => j + 1);
  row.unshift(0);
  for (let i = 1; i <= x.length; i++) {
    const next2 = [i];
    for (let j = 1; j <= y.length; j++) next2[j] = Math.min(row[j] + 1, next2[j - 1] + 1, row[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    row = next2;
  }
  return row[y.length];
}
function gradeForm(item, input) {
  const v = norm(input);
  if (!v) return null;
  const accept = item.accept.map(norm);
  if (accept.includes(v)) return true;
  if (accept.some((a) => a.replace(/\s/g, "") === v.replace(/\s/g, ""))) return true;
  const near = accept.filter((a) => jamoDistance(a, v) <= 2), c = endCheck(v);
  return near.some((a) => a.slice(-2) === v.slice(-2)) || near.length && c?.v === "unknown" ? "typo" : false;
}
var gradeFind = (item, picks) => {
  const a = [...new Set(picks)].sort(), b = [...item.off].sort();
  return a.length === b.length && a.every((x, i) => x === b[i]);
};
var hash = (s) => [...String(s)].reduce((h, c) => h * 31 + c.charCodeAt(0) >>> 0, 7);
var checkCard = (c) => hash(c.key) % 3 === 0;
var after = (obs, o) => o ? obs.filter((x) => x.n > o.n) : obs;
function evidence(state, { now = Date.now() } = {}) {
  const rows = trailRows(state, now), row = (o) => o.ev ? rows.get(o.ev) : null;
  const past = state.obs.filter((o) => Date.parse(o.at) <= now), last = past.at(-1);
  const stale = !!last && now - Date.parse(last.at) > STALE_DAYS * DAY, obs = !last || stale ? [] : past.filter((o) => now - Date.parse(o.at) <= STALE_DAYS * DAY);
  const history = past.filter((o) => now - Date.parse(o.at) <= HISTORY_DAYS * DAY);
  const indep = (o) => row(o)?.independent === true, verdict = (o) => o.pasted && o.verdict === "correct" ? "unassessed" : o.verdict ?? "unassessed";
  const writesAll = history.filter((o) => o.kind === "write").map((w) => ({ ...w, indep: indep(w), verdict: verdict(w) }));
  const independent = writesAll.filter((w) => w.indep), alone = independent.filter((w) => w.verdict === "correct");
  const lastAlone = alone.at(-1) || null, writes = writesAll.filter((w) => obs.includes(history.find((o) => o.n === w.n)));
  const cycle = obs.filter((o) => o.kind === "cycle").at(-1), start = [lastAlone, cycle].filter(Boolean).sort((a, b) => a.n - b.n).at(-1) || null, round = after(obs, start);
  const sorts = round.filter((o) => o.kind === "sort" && indep(o)), checks = round.filter((o) => o.kind === "form" && indep(o) && o.ok !== null);
  const distinguish = sorts.length >= PROBE_CARDS ? sorts.filter((o) => o.ok).length / sorts.length >= 2 / 3 ? "ok" : "miss" : null;
  const form = checks.some((o) => !o.ok) ? "miss" : checks.length >= PROBE_FORMS ? "ok" : null;
  const wrongAxes = AXES.filter((a) => round.some((o) => o.kind === "form" && o.axis === a && o.ok === false));
  const methods = round.filter((o) => o.kind === "method");
  const isHelp = (o) => o.kind === "semantic" && (o.stage !== "analysis" || o.result === "focus") || o.kind === "method" || o.kind === "write" && (o.support > 0 || o.mode === "revise") || (o.kind === "sort" || o.kind === "form") && o.use === "learn";
  const helpAt = history.filter(isHelp).map((o) => Date.parse(o.at));
  const lastHelp = helpAt.length ? Math.max(...helpAt) : null, delayed = (w) => lastHelp == null || Date.parse(w.at) - lastHelp >= DAY;
  const lastMiss = [...independent].reverse().find((w) => w.verdict === "incorrect"), helpObs = history.filter(isHelp).at(-1);
  const cut = Math.max(lastMiss?.n || 0, helpObs?.n || 0), since = alone.filter((w) => w.n > cut);
  const days = since.map((w) => Date.parse(w.at)), items = [...new Set(since.map((w) => w.itemId))];
  const done = items.length >= 2 && Math.max(...days) - Math.min(...days) >= DAY && independent.at(-1)?.verdict === "correct" && since.some(delayed);
  const lastFresh = writesAll.filter((w) => w.first).at(-1) || null;
  return { obs, stale, writes, writesAll, lastWrite: writes.at(-1) || null, independent, alone, lastAlone, lastFresh, round, distinguish, form, wrongAxes, methods, done, aloneItems: items };
}
function decideMethod(answers, prior) {
  const d = answers.distinguish ?? prior.distinguish, f = answers.form ?? prior.form;
  return d === "miss" ? "contrast" : f === "miss" ? "forms" : "apply";
}
function priorOf(write) {
  return write && write.plain > 0 ? { distinguish: "ok", form: "ok" } : { distinguish: "miss", form: "ok" };
}
var canDo = (m, bank) => m === "contrast" ? bank.pool.filter((c) => !checkCard(c)).length >= 6 : m === "forms" ? bank.forms.some((f) => f.use === "learn") : true;
function next(state, bank, { now = Date.now(), seed = 1 } = {}) {
  const s = readState(state, { now }), e = evidence(s, { now });
  const fresh = [...bank.open53, ...bank.open54 || []].filter((it) => !s.seen[it.id] && !s.drafts[it.id]?.checkedAt);
  const past = s.obs.filter((o) => Date.parse(o.at) <= now);
  let k = past.length;
  while (k > 0 && (k === past.length ? now : Date.parse(past[k].at)) - Date.parse(past[k - 1].at) <= SITTING_GAP) k--;
  const here = past.slice(k), sitting = here.filter((o) => o.kind === "write"), sitFresh = sitting.filter((o) => o.first).length;
  const enough = sitting.length >= SITTING_WRITES;
  const check = (why) => enough ? { scene: "rest", why: "enough" } : sitFresh >= SITTING_FRESH ? { scene: "rest", why: "later" } : fresh[0] ? { scene: "write", itemId: fresh[0].id, support: 0, mode: "new", why } : { scene: "rest", why: "no-items" };
  const lw = e.lastWrite;
  if (e.done) return !fresh.length ? { scene: "rest", why: "no-items" } : due(e, now) ? check("delayed") : { scene: "rest", why: "done" };
  if (!lw) return check(e.stale ? "stale" : "start");
  if (lw.indep && lw.verdict === "correct") {
    if (now - Date.parse(lw.at) >= DAY) return check("recheck");
    return { scene: "rest", why: "alone-once" };
  }
  const lastMethod = e.methods.at(-1) || null, writesAfterMethod = lastMethod ? after(e.writes, lastMethod) : [];
  const roundWrites = e.writes.filter((w) => e.round.some((o) => o.n === w.n)), failed = [...roundWrites].reverse().find((w) => w.verdict !== "correct") || lw;
  const revise = (support, why) => enough ? { scene: "rest", why: "enough" } : { scene: "write", itemId: failed.itemId, support, mode: "revise", why };
  if (lw.verdict === "correct") return check("check-now");
  if (lastMethod) {
    const fails = writesAfterMethod.filter((w) => w.verdict !== "correct");
    if (!fails.length) return revise(lastMethod.method === "apply" ? 1 : 2, "after-method");
    if (fails.length === 1) return revise(Math.min(2, fails[0].support + 1), "retry-more-help");
    const tried = new Set(e.methods.map((m) => m.method));
    const want2 = [e.distinguish === "miss" ? "contrast" : null, e.form === "miss" ? "forms" : null, "apply", "forms", "contrast"].filter(Boolean);
    const nextMethod = want2.find((m) => !tried.has(m) && canDo(m, bank));
    if (nextMethod) return methodScene(nextMethod, "switch", s, bank, e, { seed });
    return here.includes(lastMethod) ? { scene: "rest", why: "tried-all" } : check("restart");
  }
  const checksLeft = bank.forms.filter((f) => f.use === "check" && !s.seen[f.id]);
  const cardsLeft = bank.pool.filter((c) => checkCard(c) && !s.seen[`card:${c.key}`]);
  const probes = after(e.obs, lw).filter((o) => o.kind === "probe");
  if (lw.verdict === "unassessed") {
    if (lw.linked === false && lw.unknown <= 1 && !lw.pasted) return here.some((o) => o.n === lw.n) ? { scene: "rest", why: "later" } : check("again");
    if (e.form === "miss") return methodScene("forms", "decided", s, bank, e, { seed });
    if (!e.form && !probes.length && checksLeft.length >= PROBE_FORMS) return probeScene("form", s, bank, lw, { seed });
    if (!here.some((o) => o.n === lw.n)) return check("again");
    return lw.mode === "revise" ? { scene: "rest", why: "later" } : revise(1, "unassessed");
  }
  const prior = priorOf(lw), answers = { ...e.distinguish ? { distinguish: e.distinguish } : {}, ...lw.flags ? { form: "miss" } : e.form ? { form: e.form } : {} };
  const questions = [...cardsLeft.length >= PROBE_CARDS ? [{ id: "distinguish", kind: "follow_up", options: [{ id: "ok" }, { id: "miss" }] }] : [], ...checksLeft.length >= PROBE_FORMS ? [{ id: "form", kind: "follow_up", options: [{ id: "ok" }, { id: "miss" }] }] : []];
  if (lw.plain > 0) questions.reverse();
  {
    const found = Object.values(answers).includes("miss");
    const choice = import_ask.default.choose({ questions, decide: (a) => decideMethod(a, prior), answers, budget: 2, usedToday: found ? 2 : probes.length });
    if (choice.status === "ask") return probeScene(choice.question.id, s, bank, lw, { seed });
  }
  const want = decideMethod(answers, prior);
  return methodScene(canDo(want, bank) ? want : METHODS.find((m) => canDo(m, bank)), "decided", s, bank, e, { seed });
}
function due(e, now) {
  const k = Math.max(0, e.alone.length - 2), from = Math.max(Date.parse(e.lastAlone.at), e.lastFresh ? Date.parse(e.lastFresh.at) : 0);
  return now - from >= RECHECK_DAYS[Math.min(k, RECHECK_DAYS.length - 1)] * DAY;
}
function probeScene(probe, s, bank, lw, { seed }) {
  if (probe === "distinguish") {
    const left2 = bank.pool.filter((c) => checkCard(c) && !s.seen[`card:${c.key}`]);
    const deck = drillDeck(left2, { seed, size: PROBE_CARDS, focus: { id: "ending-53", recentCards: s.recentCards } });
    return { scene: "probe", probe, cards: deck.map((c) => c.key), why: "unknown-cause" };
  }
  const axes = lw.axes || [], left = bank.forms.filter((f) => f.use === "check" && !s.seen[f.id]);
  const pick = [...left.filter((f) => axes.includes(f.axis)), ...left.filter((f) => !axes.includes(f.axis))];
  const chosen = [];
  for (const f of pick) {
    if (chosen.length >= PROBE_FORMS) break;
    if (!chosen.some((c) => c.axis === f.axis) || pick.length <= PROBE_FORMS) chosen.push(f);
  }
  for (const f of pick) {
    if (chosen.length >= PROBE_FORMS) break;
    if (!chosen.includes(f)) chosen.push(f);
  }
  return { scene: "probe", probe, forms: chosen.map((f) => f.id), why: lw.verdict === "unassessed" ? "unassessed" : "unknown-cause" };
}
function methodScene(method, why, s, bank, e, { seed }) {
  if (method === "contrast") {
    const learn = bank.pool.filter((c) => !checkCard(c));
    return { scene: "method", method, why, cards: drillDeck(learn, { seed, size: 6, focus: { id: "ending-53", recentCards: s.recentCards, practice: practiceOf(e) } }).map((c) => c.key) };
  }
  if (method === "forms") {
    const learn = bank.forms.filter((f) => f.use === "learn"), weak = e.wrongAxes.length ? e.wrongAxes : AXES;
    const order = [...learn].sort((a, b) => weak.includes(b.axis) - weak.includes(a.axis) || (s.seen[a.id] ? 1 : 0) - (s.seen[b.id] ? 1 : 0));
    const chosen = [], quota = Math.ceil(LEARN_FORMS / weak.length);
    for (const ax of weak) for (const f of order) {
      if (chosen.filter((c) => c.axis === ax).length >= quota) break;
      if (f.axis === ax && !chosen.includes(f)) chosen.push(f);
    }
    for (const f of order) {
      if (chosen.length >= LEARN_FORMS) break;
      if (!chosen.includes(f)) chosen.push(f);
    }
    return { scene: "method", method, why, forms: chosen.slice(0, LEARN_FORMS).map((f) => f.id), axes: weak };
  }
  const finds = bank.finds.filter((f) => f.use === "learn"), find = finds.find((f) => !s.seen[f.id]) || finds[0] || null;
  return { scene: "method", method, why, find: find?.id || null, mineFrom: e.lastWrite?.itemId || null };
}
function practiceOf(e) {
  return Object.fromEntries(BINS2.map((bin) => [bin, e.round.filter((o) => o.kind === "sort" && o.bin === bin).slice(-6).map((o) => ({ at: o.at, correct: o.ok }))]));
}

// experiences/korean-study/src/copy-reused.mjs
var copy_reused_default = {
  "writing.loading": {
    "ko": "문항을 불러오는 중이에요.",
    "en": "Loading the questions…",
    "mn": "Даалгаврыг ачаалж байна…"
  },
  "writing.loadError": {
    "ko": "문항을 불러오지 못했어요. 다시 열어 주세요.",
    "en": "Couldn’t load the questions. Please open it again.",
    "mn": "Даалгаврыг ачаалж чадсангүй. Дахин нээнэ үү."
  },
  "writing.countNote": {
    "ko": "띄어쓰기를 넣고 줄바꿈은 빼고 세요. 원고지 칸 수와 조금 다를 수 있어요.",
    "en": "Spaces count; line breaks don’t. This can differ a little from squares on manuscript paper.",
    "mn": "Зай тооцно, мөр шилжилт тооцохгүй. Цаасан хүснэгтийн нүдний тооноос бага зэрэг өөр байж болно."
  },
  "writing.focus.found": {
    "ko": "문장 {total}개 가운데 {off}개가 「-습니다/-아요」로 끝났어요.",
    "en": "{off} of your {total} sentences use the formal or polite style.",
    "mn": "Таны {total} өгүүлбэрийн {off} нь албан ёсны эсвэл эелдэг ярианы төгсгөлтэй байна."
  },
  "writing.focus.counts": {
    "ko": "「-다」로 끝난 문장 {plain}개 / 전체 {total}개",
    "en": "Sentences in the plain style: {plain} of {total}",
    "mn": "Бичгийн хэлний төгсгөлтэй өгүүлбэр: {plain} / нийт {total}"
  },
  "writing.focus.independent": {
    "ko": "도움 없이 쓴 글에서 「-습니다/-아요」로 끝난 문장이 없었어요.",
    "en": "In the response you wrote without help, none of your sentences used the formal or polite style.",
    "mn": "Тусламжгүй бичсэн бичвэрт тань албан ёсны эсвэл эелдэг ярианы төгсгөлтэй өгүүлбэр байсангүй."
  },
  "writing.focus.limit": {
    "ko": "문장 끝 꼴만 본 결과예요. 내용과 문법 전체를 평가한 것은 아니에요.",
    "en": "This only checks how your sentences end. It is not an assessment of your content or grammar as a whole.",
    "mn": "Энэ нь зөвхөн өгүүлбэрийн төгсгөлийг харсан үр дүн. Агуулга, дүрмийг бүхэлд нь үнэлээгүй."
  },
  "writing.focus.method.step1": {
    "ko": "글을 다 쓰면 문장 끝만 위에서 아래로 읽어요.",
    "en": "When you finish, read only the end of each sentence, from top to bottom.",
    "mn": "Бичиж дуусаад өгүүлбэр бүрийн зөвхөн төгсгөлийг дээрээс доош уншаарай."
  },
  "writing.focus.method.step2": {
    "ko": "「-습니다」나 「-아요」가 보이면 「-다」로 바꿔요.",
    "en": "If you see the formal or polite style, change it to the plain written style.",
    "mn": "Албан ёсны эсвэл эелдэг ярианы төгсгөл байвал бичгийн хэлний төгсгөл болгож солиорой."
  },
  "writing.focus.method.verb": {
    "ko": "움직임(동사)",
    "en": "Actions (verbs)",
    "mn": "Үйл хөдлөл (үйл үг)"
  },
  "writing.focus.method.adj": {
    "ko": "상태(형용사)",
    "en": "States (adjectives)",
    "mn": "Байдал (тэмдэг нэр)"
  },
  "writing.focus.method.noun": {
    "ko": "명사",
    "en": "Nouns",
    "mn": "Нэр үг"
  },
  "writing.focus.method.past": {
    "ko": "지난 일",
    "en": "Past events",
    "mn": "Өнгөрсөн үйл"
  },
  "writing.focus.method.watch": {
    "ko": "이렇게 끝내지 않아요:",
    "en": "Don’t end like this:",
    "mn": "Ингэж төгсгөхгүй:"
  },
  "writing.focus.drill.lead": {
    "ko": "문장의 끝을 보고 어울리는 글을 골라요.",
    "en": "Look at how the sentence ends and choose the kind of writing it fits.",
    "mn": "Өгүүлбэрийн төгсгөлийг хараад тохирох бичвэрийн төрлийг сонгоорой."
  },
  "writing.focus.bin.formal": {
    "ko": "안내문·메일",
    "en": "Notice or email",
    "mn": "Мэдэгдэл, цахим шуудан"
  },
  "writing.focus.bin.polite": {
    "ko": "친구에게",
    "en": "To a friend",
    "mn": "Найздаа"
  },
  "writing.focus.bin.plain": {
    "ko": "53·54번 글",
    "en": "Questions 53 and 54",
    "mn": "53, 54 дугаар бичвэр"
  },
  "writing.focus.drill.count": {
    "ko": "{n} / {total}",
    "en": "{n} of {total}",
    "mn": "{n} / {total}"
  },
  "writing.focus.drill.right": {
    "ko": "맞아요.",
    "en": "That’s right.",
    "mn": "Зөв байна."
  },
  "writing.focus.drill.wrong": {
    "ko": "이 문장은 「{bin}」에 어울려요.",
    "en": "This sentence fits “{bin}”.",
    "mn": "Энэ өгүүлбэр «{bin}» гэсэн төрөлд тохирно."
  },
  "writing.focus.mine.title": {
    "ko": "③ 내 문장 바꿔 보기",
    "en": "③ Change your own sentences",
    "mn": "③ Өөрийн өгүүлбэрээ өөрчилж үзэх"
  },
  "writing.focus.mine.lead": {
    "ko": "방금 글에서 「-습니다/-아요」로 끝난 문장이에요. 끝을 「-다」로 바꿔 쳐 보세요. 글은 직접 고쳐요.",
    "en": "These sentences from your response use the formal or polite style. Retype each one in the plain style, then fix your response yourself.",
    "mn": "Эдгээр нь таны бичвэрийн албан ёсны эсвэл эелдэг ярианы төгсгөлтэй өгүүлбэрүүд. Бичгийн хэлний төгсгөлтэй болгож дахин бичиж үзээрэй. Бичвэрээ өөрөө засаарай."
  },
  "writing.focus.mine.label": {
    "ko": "{n}번 문장 바꿔 쓰기",
    "en": "Rewrite sentence {n}",
    "mn": "{n} дэх өгүүлбэрийг дахин бичих"
  },
  "writing.focus.mine.ok": {
    "ko": "끝이 「-다」 꼴이에요.",
    "en": "This now uses the plain style.",
    "mn": "Төгсгөл нь бичгийн хэлний хэлбэртэй боллоо."
  },
  "writing.focus.mine.not": {
    "ko": "아직 끝이 「-다」 꼴이 아니에요.",
    "en": "This doesn’t use the plain style yet.",
    "mn": "Төгсгөл нь бичгийн хэлний хэлбэрт хараахан ороогүй байна."
  }
};

// experiences/korean-study/src/copy.mjs
var LANGS = ["ko", "en", "mn"];
var LANG_NAMES = { ko: "한국어", en: "English", mn: "Монгол" };
var LANG_KEY = "synk.world.lang";
var COPY = {
  "study.title": { ko: "한국어 공부", en: "Korean study", mn: "Солонгос хэлний хичээл" },
  "study.lead": { ko: "TOPIK II 쓰기를 한 가지씩 같이 고쳐 가요. 점수나 급수는 매기지 않아요.", en: "We work on TOPIK II writing one point at a time. There are no scores or levels.", mn: "TOPIK II бичих даалгаврын алдааг нэг нэгээр нь хамт засна. Оноо, түвшин тогтоохгүй." },
  "study.device": { ko: "공부 기록은 이 기기에 저장돼요. 다른 기기로는 아직 이어지지 않아요.", en: "Study records stay on this device. They do not sync to other devices yet.", mn: "Хичээлийн явц энэ төхөөрөмжид хадгалагдана. Бусад төхөөрөмжтэй хараахан холбогдохгүй." },
  "ai.connect": { ko: "AI 튜터와 공부하기", en: "Study with the AI tutor", mn: "AI багштай хичээллэх" },
  "ai.connectNote": { ko: "SYNK ID로 연결하면 글의 내용까지 함께 읽고 연습을 이어 가요.", en: "Connect with SYNK ID to get feedback on meaning and a short practice.", mn: "SYNK ID-гаар холбогдож, бичвэрийн утгын зөвлөгөө авч, богино дасгал хийгээрэй." },
  "ai.connected": { ko: "AI 튜터와 연결됐어요.", en: "Your AI tutor is connected.", mn: "AI багштай холбогдлоо." },
  "ai.notReady": { ko: "지금은 내용 피드백을 받을 수 없어요. 문장 끝 연습은 계속할 수 있어요.", en: "Feedback on meaning is unavailable now. You can still practise sentence endings.", mn: "Одоогоор утгын зөвлөгөө авах боломжгүй. Өгүүлбэрийн төгсгөлийг үргэлжлүүлэн давтаж болно." },
  "ai.disconnect": { ko: "이 탭에서 연결 닫기", en: "Disconnect in this tab", mn: "Энэ цонхны холболтыг хаах" },
  "ai.read": { ko: "함께 읽어 주세요", en: "Read it with me", mn: "Хамт уншаарай" },
  "ai.consent": { ko: "아래 버튼을 누르면 이 글을 AI에 보내 내용과 표현을 함께 살펴봐요. 서버에 글을 저장하지 않아요.", en: "Pressing the button sends this draft to the AI to review meaning and expression. Your draft is not saved on the server.", mn: "Доорх товчийг дарахад утга, хэллэгийг нь шалгуулахаар энэ бичвэрийг AI-д илгээнэ. Серверт бичвэрийг хадгалахгүй." },
  "ai.reading": { ko: "글을 읽고 있어요. 지금 도움이 될 한 가지를 찾아볼게요.", en: "Reading your draft and looking for one useful next step.", mn: "Бичвэрийг уншиж байна. Одоо хэрэг болох нэг алхмыг олъё." },
  "ai.reference": { ko: "피드백은 AI의 해석이에요. 시험 점수나 실력 판정은 아니에요.", en: "This feedback is an AI interpretation, not an exam result or a measure of mastery.", mn: "Энэ зөвлөгөө нь AI-ийн тайлбар юм. Шалгалтын дүн, чадварын үнэлгээ биш." },
  "ai.check": { ko: "이 부분만 같이 볼까요?", en: "Let’s look at this part.", mn: "Энэ хэсгийг хамт харъя." },
  "ai.help": { ko: "이렇게 생각해 볼까요?", en: "Here is one way to approach it.", mn: "Ингэж бодож үзье." },
  "ai.practice": { ko: "이번에는 직접 골라 봐요.", en: "Now try one yourself.", mn: "Одоо өөрөө сонгоод үзээрэй." },
  "ai.try": { ko: "직접 해볼게요", en: "Let me try", mn: "Өөрөө хийгээд үзье" },
  "ai.revise": { ko: "내 글에 옮겨 볼게요", en: "Use it in my draft", mn: "Бичвэртээ хэрэглээд үзье" },
  "ai.next": { ko: "다른 자료로 해볼게요", en: "Try another task", mn: "Өөр даалгавар хийж үзье" },
  "ai.source": { ko: "자료에서 다시 볼 부분", en: "Look back at the task", mn: "Даалгавраас дахин харах хэсэг" },
  "ai.failed": { ko: "이번 글의 내용은 확인하지 못했어요. 글은 그대로 두고 문장 끝부터 살펴볼 수 있어요.", en: "I could not review the meaning this time. Your draft is kept, and you can check the endings.", mn: "Энэ удаа утгыг шалгаж чадсангүй. Бичвэр хэвээр байгаа тул төгсгөлүүдийг шалгаж болно." },
  "ai.limit": { ko: "오늘 사용할 수 있는 AI 피드백을 다 썼어요. 글은 저장했고 문장 끝 연습은 계속할 수 있어요.", en: "Today’s AI feedback allowance is used up. Your draft is saved; ending practice is still available.", mn: "Өнөөдрийн AI зөвлөгөөний эрх дууслаа. Бичвэр хадгалагдсан бөгөөд төгсгөлийн дасгалыг үргэлжлүүлж болно." },
  "ai.local": { ko: "문장 끝부터 살펴보기", en: "Check the sentence endings", mn: "Өгүүлбэрийн төгсгөлийг шалгах" },
  "ai.loginError": { ko: "연결을 마치지 못했어요. 잠시 뒤 다시 연결해 주세요.", en: "Could not connect. Please try connecting again shortly.", mn: "Холбогдож чадсангүй. Түр хүлээгээд дахин холбогдоорой." },
  "ai.expired": { ko: "연결이 끊겼어요. 다시 로그인하면 이 기기에 저장된 글을 이어서 볼 수 있어요.", en: "Connection ended. Sign in again to continue a draft saved on this device.", mn: "Холболт тасарлаа. Дахин нэвтэрч, энэ төхөөрөмжид хадгалсан бичвэрээ үргэлжлүүлээрэй." },
  "ai.cancelled": { ko: "AI 확인을 멈췄어요. 이 기기에서 할 수 있는 문장 끝 연습으로 이어 갈게요.", en: "The AI check was stopped. Continue with sentence-ending practice on this device.", mn: "AI шалгалтыг зогсоолоо. Энэ төхөөрөмж дээр өгүүлбэрийн төгсгөлийн дасгалыг үргэлжлүүлье." },
  "study.lang": { ko: "화면 언어", en: "Language", mn: "Хэл" },
  "study.stop": { ko: "오늘은 그만", en: "Stop for today", mn: "Өнөөдөртөө болих" },
  "study.stopped": { ko: "여기까지 저장했어요. 다시 열면 이 자리부터 이어서 해요.", en: "Saved up to here. When you come back, you will continue from this point.", mn: "Энд хүртэл хадгаллаа. Дахин нээхэд эндээс үргэлжилнэ." },
  "study.resumeHere": { ko: "이어서 하기", en: "Continue", mn: "Үргэлжлүүлэх" },
  "study.saveFail": { ko: "이 기기에 저장하지 못했어요. 이 화면을 닫으면 기록이 남지 않아요.", en: "Could not save on this device. If you close this page, the record will not be kept.", mn: "Энэ төхөөрөмжид хадгалж чадсангүй. Энэ хуудсыг хаавал явц хадгалагдахгүй." },
  "resume.title": { ko: "이 기기에 이어서 할 공부가 있어요.", en: "There is an unfinished study session on this device.", mn: "Энэ төхөөрөмжид дуусаагүй хичээл байна." },
  "resume.note": { ko: "다른 사람이 이 기기로 공부했다면 처음부터 시작해 주세요. 앞 사람의 기록은 지우지 않고 따로 둬요.", en: "If someone else studied on this device, please start over. Their record is kept separately and not deleted.", mn: "Энэ төхөөрөмжөөр өөр хүн хичээллэсэн бол шинээр эхэлнэ үү. Өмнөх хүний явцыг устгахгүй, тусад нь хадгална." },
  "resume.fresh": { ko: "처음부터 하기", en: "Start over", mn: "Шинээр эхлэх" },
  "write.task": { ko: "이 자료를 세 문장 이상으로 설명해 보세요. 시험에서는 200~300자로 써요.", en: "Describe this data in three or more sentences. In the exam you write 200–300 characters.", mn: "Энэ мэдээллийг дор хаяж гурван өгүүлбэрээр тайлбарлаарай. Шалгалтад 200–300 тэмдэгтээр бичдэг." },
  "write.label": { ko: "내 글", en: "My writing", mn: "Миний бичвэр" },
  "write.done": { ko: "다 썼어요", en: "I am done", mn: "Бичиж дууслаа" },
  "write.short": { ko: "세 문장 이상 써 보세요. 질문이나 끝나지 않은 문장, 같은 문장 반복은 세지 않아요.", en: "Write three or more sentences. Questions, unfinished sentences and repeated sentences are not counted.", mn: "Дор хаяж гурван өгүүлбэр бичээрэй. Асуулт, дуусаагүй өгүүлбэр, давтагдсан өгүүлбэрийг тоолохгүй." },
  "write.forms": { ko: "53·54번 글의 문장 끝", en: "Sentence endings for questions 53 and 54", mn: "53, 54-р даалгаврын өгүүлбэрийн төгсгөл" },
  "self.q": { ko: "문장 끝만 위에서 아래로 다시 읽어 봤나요? 고칠 곳이 있으면 지금 고쳐도 돼요.", en: "Did you check just the sentence endings again, from top to bottom? You can still fix them now.", mn: "Өгүүлбэрийн төгсгөлийг л дээрээс доош дахин уншсан уу? Засах зүйл байвал одоо засаж болно." },
  "self.go": { ko: "점검하기", en: "Check", mn: "Шалгах" },
  "seen.title": { ko: "방금 쓴 글", en: "What you just wrote", mn: "Саяхан бичсэн бичвэр" },
  "seen.helpedOk": { ko: "「-습니다/-아요」로 끝난 문장이 없어요. 도움을 보며 쓴 글로 남겨요.", en: "No sentence ends in 「-습니다/-아요」. This will be recorded as completed with help.", mn: "「-습니다/-아요」-аар төгссөн өгүүлбэр алга. Энэ бичвэрийг тусламж харж бичсэн гэж тэмдэглэнэ." },
  "seen.flags": { ko: "끝은 「-다」지만 확인해 볼 꼴이 {n}개 있어요(「많는다」, 「증가하다.」처럼).", en: "The endings are 「-다」, but {n} forms need checking (like 「많는다」 or 「증가하다.」).", mn: "Төгсгөл нь 「-다」 боловч шалгах хэлбэр {n} байна (「많는다」, 「증가하다.」 гэх мэт)." },
  "next.probe": { ko: "짧게 확인하기", en: "Quick check", mn: "Товч шалгах" },
  "next.method": { ko: "연습하기", en: "Practise", mn: "Дадлага хийх" },
  "next.write": { ko: "다른 자료로 쓰기", en: "Write about other data", mn: "Өөр мэдээллээр бичих" },
  "next.rest": { ko: "마치기", en: "Finish", mn: "Дуусгах" },
  "probe.formLead": { ko: "표시한 말을 53번 글에 맞게 「-다」 꼴로 바꿔 써 보세요.", en: "Rewrite the marked word in the 「-다」 form used in question 53.", mn: "Тэмдэглэсэн үгийг 53-р даалгаварт тохирох 「-다」 хэлбэрээр дахин бичээрэй." },
  "probe.formMiss": { ko: "검수된 답과 달라요. 바로 이어서 함께 연습해요.", en: "This is different from the correct answer. We will practise it next.", mn: "Зөв хариултаас өөр байна. Одоо шууд хамт дадлага хийе." },
  "form.input": { ko: "바꿔 쓰기", en: "Your answer", mn: "Хариулт" },
  "form.check": { ko: "확인", en: "Check", mn: "Шалгах" },
  "form.answer": { ko: "이렇게 써요:", en: "Write it like this:", mn: "Ингэж бичнэ:" },
  "form.why": { ko: "설명", en: "Why", mn: "Тайлбар" },
  "method.contrast": { ko: "글의 종류마다 문장 끝이 달라요. 문장 끝을 보고 어떤 글에 어울리는지 골라 봐요.", en: "Each kind of text has its own sentence ending. Look at the ending and choose the text it fits.", mn: "Бичвэрийн төрөл бүрт өгүүлбэрийн төгсгөл өөр өөр байдаг. Төгсгөлийг нь хараад аль төрлийн бичвэрт тохирохыг сонгоорой." },
  "method.examples": { ko: "바구니마다 이런 문장이 들어가요.", en: "Each basket takes sentences like these.", mn: "Төрөл бүрт ийм өгүүлбэр орно." },
  "method.forms": { ko: "53번 글에서는 말의 종류에 따라 「-다」 꼴이 달라요. 꼴을 보고 직접 써 봐요.", en: "In question 53 the 「-다」 form depends on the kind of word. Look at the forms and write them yourself.", mn: "53-р даалгаварт 「-다」 хэлбэр нь үгийн төрлөөс хамаарч өөр байдаг. Хэлбэрийг нь хараад өөрөө бичиж үзээрэй." },
  "method.apply": { ko: "이번에는 쓴 글에서 문장 끝만 다시 찾아보는 연습을 해요.", en: "This time, practise finding just the sentence endings again in a finished text.", mn: "Энэ удаад бичсэн бичвэрээс зөвхөн өгүүлбэрийн төгсгөлийг дахин нягтлах дадлага хийе." },
  "find.lead": { ko: "끝맺음이 다른 문장을 모두 고르세요.", en: "Choose every sentence with a different ending.", mn: "Төгсгөл нь өөр бүх өгүүлбэрийг сонгоорой." },
  "find.right": { ko: "다 찾았어요.", en: "You found them all.", mn: "Бүгдийг нь оллоо." },
  "find.wrong": { ko: "표시한 문장이 끝맺음이 다른 문장이에요.", en: "The marked sentences are the ones with a different ending.", mn: "Тэмдэглэсэн өгүүлбэрүүдийн төгсгөл бусдаас өөр байна." },
  "mine.lead": { ko: "방금 글에서 확인해 볼 문장이에요. 끝을 「-다」 꼴로 바꿔 쳐 보세요.", en: "These are sentences to check from what you just wrote. Try retyping them with a 「-다」 ending.", mn: "Таны сая бичсэн бичвэрээс шалгах өгүүлбэрүүд энэ байна. Төгсгөлийг нь 「-다」 хэлбэрт оруулж дахин шивээрэй." },
  "find.tag": { ko: "끝맺음이 다름", en: "Different ending", mn: "Төгсгөл нь өөр" },
  "change.adj": { ko: "「많다」처럼 상태를 나타내는 말에는 「-는다」를 붙이지 않아요.", en: "Words for states, like 「많다」, do not take 「-는다」.", mn: "「많다」 шиг төлөв байдал заасан үгэнд 「-는다」 залгадаггүй." },
  "change.dict": { ko: "「-하다」·「-다」 그대로는 사전에 실린 꼴이에요. 움직임이면 「-한다」·「-ㄴ다」로 써요.", en: "Plain 「-하다」 or 「-다」 is the dictionary form. For actions, write 「-한다」 or 「-ㄴ다」.", mn: "「-하다」, 「-다」 хэвээр нь бол толь бичгийн хэлбэр юм. Үйл хөдлөл заасан бол 「-한다」, 「-ㄴ다」 гэж бичнэ." },
  "next.continue": { ko: "계속", en: "Continue", mn: "Үргэлжлүүлэх" },
  "rest.alone": { ko: "다음에 오면 다른 자료로 한 번 더 써 봐요.", en: "Next time, try once more with different data.", mn: "Дараа ирэхдээ өөр мэдээллээр дахин нэг удаа бичиж үзээрэй." },
  "rest.done": { ko: "이 한 가지는 처음 보는 자료 두 개에서 도움 없이 맞았어요. 며칠 뒤에 새 자료로 한 번 더 확인해요. 다음 주제는 아직 준비 중이에요.", en: "You got this point right without help on two sets of new material. In a few days we will check it once more with new material. The next topic is not ready yet.", mn: "Үүнийг анх үзсэн хоёр даалгаварт тусламжгүй зөв хийлээ. Хэдэн өдрийн дараа шинэ даалгавраар дахин нэг удаа шалгана. Дараагийн сэдэв хараахан бэлэн болоогүй байна." },
  "rest.noItems": { ko: "처음 보는 자료를 다 써서 지금은 혼자 해내는지 새로 확인할 수 없어요. 새 자료가 준비되면 이어서 해요.", en: "You have used all the new material, so we cannot check again right now whether you can do it on your own. We will continue when new material is ready.", mn: "Анх удаа үзэх шинэ даалгавар үлдээгүй тул одоогоор бие даан хийж чадаж байгаа эсэхийг шинээр шалгах боломжгүй. Шинэ даалгавар бэлэн болохоор үргэлжлүүлнэ." },
  "rest.triedAll": { ko: "오늘은 여기까지 해요. 다음에 오면 다시 써 보면서 이어 가요.", en: "Let's stop here for today. Next time, we will pick up with writing again.", mn: "Өнөөдөр ингээд болъё. Дараа ирэхдээ дахин бичиж үргэлжлүүлнэ." },
  "write.task54": { ko: "이 주제로 글의 첫 부분을 세 문장 이상 써 보세요. 시험에서는 600~700자로 써요.", en: "Write the opening of an essay on this topic in three or more sentences. In the exam you write 600–700 characters.", mn: "Энэ сэдвээр бичвэрийн эхний хэсгийг дор хаяж гурван өгүүлбэрээр бичээрэй. Шалгалтад 600–700 тэмдэгтээр бичдэг." },
  "write.revise": { ko: "방금 쓴 글을 고쳐 써 보세요. 표시한 문장의 끝을 「-다」 꼴로 바꿔요.", en: "Revise what you just wrote. Change the endings of the marked sentences to the 「-다」 form.", mn: "Саяхан бичсэн бичвэрээ засаж бичээрэй. Тэмдэглэсэн өгүүлбэрүүдийн төгсгөлийг 「-다」 хэлбэрт оруулаарай." },
  "next.revise": { ko: "고쳐 쓰기", en: "Revise", mn: "Засаж бичих" },
  "seen.unknown": { ko: "「-습니다/-아요」로 끝난 문장은 없어요. 아래 문장은 끝 꼴을 이번에 확인하지 못했어요.", en: "No sentence ends in 「-습니다/-아요」. The ending form of the sentences below could not be checked this time.", mn: "「-습니다/-아요」 хэлбэрээр төгссөн өгүүлбэр алга. Доорх өгүүлбэрүүдийн төгсгөлийн хэлбэрийг энэ удаад шалгаж чадсангүй." },
  "seen.unlinked": { ko: "이번 글이 이 문제와 이어지는지는 확인하지 못했어요.", en: "We could not confirm that this text is related to the task.", mn: "Энэ бичвэр даалгавартай холбоотой эсэхийг шалгаж чадсангүй." },
  "seen.pasted": { ko: "「-습니다/-아요」로 끝난 문장은 없어요. 붙여 넣은 글이라 혼자 쓴 기록에는 넣지 않아요.", en: "No sentence ends in 「-습니다/-아요」. Because this text was pasted in, it is not counted as writing done on your own.", mn: "「-습니다/-아요」 хэлбэрээр төгссөн өгүүлбэр алга. Энэ бичвэрийг хуулж буулгасан тул бие даан бичсэнд тооцохгүй." },
  "probe.formUnsure": { ko: "입력한 꼴을 확인하지 못했어요. 다음으로 넘어가요.", en: "We could not check the form you typed. Let us move on.", mn: "Таны бичсэн хэлбэрийг шалгаж чадсангүй. Дараагийнх руу шилжье." },
  "change.unsure": { ko: "끝은 「-다」예요. 이 꼴이 맞는지는 이번에 확인하지 못했어요.", en: "It ends in 「-다」. Whether this form is correct could not be checked this time.", mn: "Төгсгөл нь 「-다」 байна. Энэ хэлбэр зөв эсэхийг энэ удаад шалгаж чадсангүй." },
  "change.neun": { ko: "「-는다」는 받침이 있는 움직임 말에만 붙여요. 받침이 없거나 ㄹ 받침이면 「-ㄴ다」, 지난 일이면 「-었다」로 써요.", en: "「-는다」 only follows action words that end in a consonant. After a vowel or ㄹ, use 「-ㄴ다」; for past events, use 「-었다」.", mn: "「-는다」 нь зөвхөн гийгүүлэгчээр төгссөн үйл үгэнд залгагдана. Эгшиг эсвэл 「ㄹ」 үсгээр төгссөн бол 「-ㄴ다」, өнгөрсөн үйл явдал бол 「-었다」 гэж бичнэ." }
};
function makeT(lang) {
  const pick = (entry) => entry?.[lang] ?? entry?.ko;
  return (key, vars = {}) => {
    const entry = COPY[key] || copy_reused_default[key];
    if (!entry) return key;
    return String(pick(entry)).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  };
}
function chooseLang({ search = globalThis.location?.search || "", storage = globalThis.localStorage, languages = globalThis.navigator?.languages || [globalThis.navigator?.language].filter(Boolean) } = {}) {
  try {
    const q = new URLSearchParams(search).get("lang");
    if (LANGS.includes(q)) return q;
  } catch {
  }
  try {
    const s = storage?.getItem(LANG_KEY);
    if (LANGS.includes(s)) return s;
  } catch {
  }
  for (const raw of languages || []) {
    const tag = String(raw).toLowerCase();
    if (/^mn(-|$)/.test(tag) && !/mong|-cn/.test(tag)) return "mn";
    const base = tag.split("-")[0];
    if (base === "ko" || base === "en") return base;
  }
  return "ko";
}

// experiences/synk-account/src/core.mjs
var PRODUCTS = Object.freeze({ platform: "SYNK 플랫폼", world: "SYNK WORLD", messenger: "SYNK Workspace", care: "SYNK 플레저", path: "SYNK PATH", "path-travel": "SYNK PATH 여행" });
var nativeSchemes = /* @__PURE__ */ new Set(["synktalk:", "im.synk.platform:", "im.synk.world:", "im.synk.messenger:", "im.synk.care:"]);
function callbackUrl(value) {
  const url = new URL(value);
  if (!nativeSchemes.has(url.protocol)) publicUrl(value);
  if (url.username || url.password || url.hash || [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1) || ["code", "state", "error", "error_description", "access_token", "refresh_token"].some((key) => url.searchParams.has(key))) throw new Error("로그인 도착 주소의 형식을 확인해 주세요.");
  return url;
}
var isLoopback = (hostname) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
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
var base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function createPKCE(cryptoAPI = globalThis.crypto) {
  const verifier = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const state = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await cryptoAPI.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, state, challenge };
}
async function beginOAuth({ config, product, storage, now = Date.now(), cryptoAPI }) {
  const client = config.clients[product];
  if (!config.configured || !client?.clientId || !client.redirectUri) throw new Error("이 화면의 로그인 설정이 아직 없어요.");
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
      throw Object.assign(new Error("인터넷 연결이 끊겨 로그인 서버에 닿지 못했어요. 연결되면 다시 시도해 주세요."), { code: "NETWORK", retryable: true });
    }
    let data;
    try {
      data = await response.json();
    } catch (error2) {
      if (response.ok && error2?.name !== "SyntaxError") throw Object.assign(new Error("로그인 응답을 끝까지 받지 못했어요. 연결되면 다시 시도해 주세요."), { code: "NETWORK", retryable: true });
      data = null;
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw Object.assign(new Error(retryable ? "로그인 서버가 잠시 응답하지 않아요. 잠시 뒤 다시 시도해 주세요." : "로그인 연결을 마치지 못했어요. 다시 로그인해 주세요."), { code: retryable ? "AUTH_UNAVAILABLE" : "AUTH_REQUIRED", status: response.status, retryable });
    }
    if (!data || typeof data.access_token !== "string" || !data.access_token) throw Object.assign(new Error("로그인 응답을 확인하지 못했어요. 다시 로그인해 주세요."), { code: "INVALID_RESPONSE" });
    return { access_token: data.access_token, refresh_token: data.refresh_token || null, expires_at: Date.now() + Number(data.expires_in || 3600) * 1e3 };
  } finally {
    clearTimeout(timer);
  }
}

// experiences/synk-account/src/study-login.mjs
var STUDY_INTENT = "synk.study.login.intent";
var STUDY_SESSION = "synk.oauth.session.study";
var age = (at, now) => Number.isFinite(at) && at <= now && now - at <= 6e5;
function rememberStudyLogin(storage, { now = Date.now() } = {}) {
  const p = JSON.parse(storage.getItem("synk.oauth.pending.world") || "null");
  if (!p || typeof p.state !== "string" || p.state.length < 32 || !age(p.createdAt, now)) throw Error("로그인을 다시 시작해 주세요.");
  const intent = { v: 1, state: p.state, createdAt: p.createdAt, redirectUri: p.redirectUri, clientId: p.clientId };
  storage.setItem(STUDY_INTENT, JSON.stringify(intent));
  return intent;
}

// experiences/korean-study/src/feedback-client.mjs
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var error = (code) => Object.assign(new Error(code), { code });
function createFeedbackClient({
  storage = globalThis.sessionStorage,
  fetcher = (...a) => fetch(...a),
  base = globalThis.location?.href,
  navigate = (url) => globalThis.location.assign(url),
  now = Date.now,
  cryptoAPI = globalThis.crypto
} = {}) {
  let config = null, credentials = null, identity = null, capability = null, epoch = 0, refreshing = null, active = null, requestPending = null;
  const current = (rev) => {
    if (rev !== epoch) throw error("ACCOUNT_CHANGED");
  };
  const load = () => {
    try {
      const c = JSON.parse(storage.getItem(STUDY_SESSION) || "null");
      return typeof c?.access_token === "string" && c.access_token ? c : null;
    } catch {
      return null;
    }
  };
  async function configuration() {
    if (config) return config;
    const response = await fetcher(new URL("/account/config.json", base), { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(1e4) });
    if (!response.ok) throw error("CONFIG_UNAVAILABLE");
    const candidate = readConfig(await response.json(), base);
    const callback = new URL(candidate.clients.world.redirectUri), site = new URL(base);
    if (callback.origin !== site.origin || callback.pathname !== "/account/client.html" || callback.search !== "?product=world") throw error("STUDY_LOGIN_NOT_CONFIGURED");
    config = candidate;
    return config;
  }
  function forgetConnection(erase = false) {
    epoch++;
    active?.abort();
    active = null;
    identity = null;
    capability = null;
    credentials = null;
    refreshing = null;
    if (erase) try {
      storage.removeItem(STUDY_SESSION);
      storage.removeItem(STUDY_INTENT);
    } catch {
      throw error("STORAGE");
    }
  }
  const disconnect = () => forgetConnection(true);
  function cancel() {
    if (!requestPending) return;
    requestPending.cancelled = true;
    requestPending = null;
    active?.abort();
    active = null;
  }
  async function token(rev) {
    current(rev);
    const live = load();
    if (!live || credentials && live.access_token !== credentials.access_token) throw error("ACCOUNT_CHANGED");
    credentials = live;
    if (Number.isFinite(credentials.expires_at) && credentials.expires_at > now() + 3e4) return credentials.access_token;
    if (!credentials.refresh_token) throw error("AUTH_REQUIRED");
    refreshing ||= (async () => {
      const old = credentials;
      const next2 = await tokenRequest(config, { grant_type: "refresh_token", client_id: config.clients.world.clientId, refresh_token: old.refresh_token }, fetcher);
      current(rev);
      if (load()?.access_token !== old.access_token) throw error("ACCOUNT_CHANGED");
      credentials = { ...next2, refresh_token: next2.refresh_token || old.refresh_token };
      storage.setItem(STUDY_SESSION, JSON.stringify(credentials));
      return credentials.access_token;
    })().finally(() => {
      if (rev === epoch) refreshing = null;
    });
    return refreshing;
  }
  async function post(payload, { timeout = 9e4, cancelled = () => false } = {}) {
    const rev = epoch;
    let controller, timer;
    const check = () => {
      current(rev);
      if (cancelled()) throw error("CANCELLED");
    };
    try {
      await configuration();
      check();
      const access = await token(rev);
      check();
      controller = new AbortController();
      active = controller;
      timer = setTimeout(() => controller.abort(), timeout);
      const r = await fetcher(new URL("/functions/v1/world-writing", config.accountApiUrl), {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", authorization: `Bearer ${access}`, apikey: config.supabasePublishableKey, "X-SYNK-Contract": "1", "X-SYNK-Product": "world" },
        body: JSON.stringify(payload)
      });
      check();
      if (load()?.access_token !== credentials?.access_token) throw error("ACCOUNT_CHANGED");
      const data = await r.json();
      check();
      if (load()?.access_token !== credentials?.access_token) throw error("ACCOUNT_CHANGED");
      if (!r.ok || !data?.ok) {
        if (r.status === 401 || r.status === 403) disconnect();
        throw error(data?.code || "UNAVAILABLE");
      }
      if (!UUID.test(data.accountId || "")) throw error("INVALID_RESPONSE");
      if (identity && data.accountId !== identity) throw error("ACCOUNT_CHANGED");
      return data;
    } catch (e) {
      if (rev === epoch && ["ACCOUNT_CHANGED", "AUTH_REQUIRED", "AUTH_SESSION_MISSING", "SESSION_REVOKED"].includes(e.code)) forgetConnection(e.code !== "ACCOUNT_CHANGED");
      throw e;
    } finally {
      clearTimeout(timer);
      if (active === controller) active = null;
    }
  }
  return {
    owner: () => identity ? `user-${identity}` : null,
    status: () => ({ ...capability, connected: !!identity }),
    async init() {
      const rev = epoch;
      credentials = load();
      if (!credentials) return null;
      try {
        const data = await post({ action: "status" }, { timeout: 15e3 });
        current(rev);
        identity = data.accountId;
        capability = data;
        return data;
      } catch (e) {
        if (rev === epoch) capability = { error: e.code || "UNAVAILABLE" };
        return null;
      }
    },
    async login() {
      epoch++;
      active?.abort();
      identity = null;
      capability = null;
      const rev = epoch;
      await configuration();
      current(rev);
      const url = await beginOAuth({ config, product: "world", storage, now: now(), cryptoAPI });
      current(rev);
      rememberStudyLogin(storage, { now: now() });
      navigate(url);
    },
    disconnect,
    cancel,
    async request({ itemId, bankHash, answer, lang, stage = "initial", focusSkill = null, consent }) {
      if (consent !== "send-once") throw error("CONSENT_REQUIRED");
      if (!identity || !capability?.enabled || capability.studyVersion !== 1) throw error("STUDY_UNAVAILABLE");
      if (bankHash !== capability.bankHash) throw error("ITEM_CHANGED");
      if (active || requestPending) throw error("BUSY");
      const pending = {};
      requestPending = pending;
      try {
        return await post({ action: "feedback", mode: "study", request_id: cryptoAPI.randomUUID(), consent, item_id: itemId, bank_hash: bankHash, answer, lang, study: { stage, focusSkill } }, { cancelled: () => pending.cancelled === true });
      } finally {
        if (requestPending === pending) requestPending = null;
      }
    }
  };
}

// experiences/korean-study/src/semantic.mjs
var SEMANTIC_SKILLS = ["data.accuracy", "task.coverage", "structure.connection", "language.expression", "language.ending"];
var fail = () => {
  throw Error("INVALID_STUDY_FEEDBACK");
};
var text = (v, max, empty = false) => {
  if (typeof v !== "string" || !empty && !v.trim() || [...v].length > max) fail();
  return v;
};
var question = (q) => {
  if (!q || !Array.isArray(q.options) || q.options.length !== 2 || !["a", "b"].includes(q.correct)) fail();
  const options = ["a", "b"].map((id2) => {
    const rows = q.options.filter((o) => o?.id === id2);
    if (rows.length !== 1) fail();
    return { id: id2, text: text(rows[0].text, 110) };
  });
  if (options[0].text === options[1].text) fail();
  return { prompt: text(q.prompt, 220), why: text(q.why, 280), correct: q.correct, options };
};
function readSemantic(raw, answer) {
  if (!raw || raw.version !== 1 || raw.kind !== "study" || raw.source !== "ai-reference" || !["focus", "clear", "insufficient"].includes(raw.status)) fail();
  const f = { version: 1, kind: "study", source: "ai-reference", status: raw.status, summary: text(raw.summary, 200), good: text(raw.good, 200, true), rewrite: text(raw.rewrite, 200) };
  if (raw.status !== "focus") return { ...f, focus: null, check: null, help: null, practice: null };
  const r = raw.focus;
  if (!r || !SEMANTIC_SKILLS.includes(r.skill) || !["read-data", "understand-task", "organize", "form", "apply", "uncertain"].includes(r.cause) || r.certainty !== "hypothesis") fail();
  const quote = text(r.quote, 180, r.skill === "task.coverage");
  if (quote && !String(answer).normalize("NFC").includes(quote)) fail();
  return {
    ...f,
    focus: { skill: r.skill, quote, taskQuote: text(r.taskQuote, 180), observation: text(r.observation, 280), cause: r.cause, certainty: "hypothesis" },
    check: question(raw.check),
    practice: question(raw.practice),
    help: { explanation: text(raw.help?.explanation, 280), example: text(raw.help?.example, 160) }
  };
}
function recordSemantic(state, { feedback, stage = "analysis", pick = null, itemId }, { now = Date.now() } = {}) {
  const skill = feedback.focus?.skill || "none", d = recordDecision(state, { scene: "semantic", source: "ai-reference", skill, stage, hypothesis: feedback.focus?.cause || "uncertain" }, { now });
  let s = d.state, ev = null, result = feedback.status;
  if (stage !== "analysis") {
    const q = stage === "check" ? feedback.check : feedback.practice;
    if (!q || !["a", "b"].includes(pick)) return state;
    const r = recordAnswer(s, {
      did: d.did,
      taskId: "study-writing-semantic",
      itemKey: `ai:${itemId}:${stage}:${d.did}`,
      concept: `study.ko2.${skill}`,
      helps: [{ id: "ai-reference", level: "explanation" }],
      verdict: "unassessed",
      errorTags: ["source.ai-reference"],
      choice: { selectedId: pick, correctId: q.correct }
    }, { now });
    s = r.state;
    ev = r.ev;
    result = pick === q.correct ? "selected-right" : "selected-other";
  }
  return addObs(s, { kind: "semantic", stage, skill, result, ...ev ? { ev } : {} }, { now });
}
function semanticNext(state, bank, { itemId, revise = false, focusSkill = null, now = Date.now() } = {}) {
  const past = state.obs.filter((o) => Date.parse(o.at) <= now);
  let start = past.length;
  while (start > 0 && (start === past.length ? now : Date.parse(past[start].at)) - Date.parse(past[start - 1].at) <= SITTING_GAP) start--;
  const writes = past.slice(start).filter((o) => o.kind === "write");
  if (writes.length >= SITTING_WRITES) return { id: "rest", why: "enough" };
  if (revise) return { id: "write", itemId, mode: "revise", support: 1, phase: "edit", why: "semantic", semantic: true, focusSkill };
  const fresh = [...bank.open53, ...bank.open54].find((i) => !state.seen[i.id]);
  if (!fresh) return { id: "rest", why: "no-items" };
  if (writes.filter((o) => o.mode === "new").length >= SITTING_FRESH) return { id: "rest", why: "later" };
  return { id: "write", itemId: fresh.id, mode: "new", support: 0, phase: "edit", why: "semantic-transfer", semantic: true, focusSkill };
}

// experiences/korean-study/src/app.mjs
var TOKEN = true ? "7512daf78440" : "dev";
var esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var FORM_ROWS = [["verb", "증가한다 · 늘어난다"], ["adj", "많다"], ["noun", "-이다"], ["past", "조사했다 · 증가했다"]];
var BIN_FORM = { formal: "-습니다", polite: "-아요", plain: "-다" };
var SLOT_KEY = "synk.study.slot";
var deviceSlot = (storage = globalThis.localStorage) => {
  try {
    const v = storage?.getItem(SLOT_KEY);
    return v && /^guest(-[a-z0-9]{1,16})?$/.test(v) ? v : "guest";
  } catch {
    return "guest";
  }
};
var draftKey = (sc) => sc.mode === "revise" ? `r:${sc.itemId}` : sc.itemId;
function createStudy({ root, storage = globalThis.localStorage, session = globalThis.sessionStorage, fetcher = (...a) => globalThis.fetch(...a), now = Date.now, owner = () => deviceSlot(storage), confirm = (m) => globalThis.confirm?.(m) ?? true, base = new URL("./", import.meta.url), feedback } = {}) {
  if (feedback === void 0) feedback = createFeedbackClient({ storage: session, fetcher, base, now });
  const getOwner = () => {
    const account = feedback?.owner?.();
    if (!account) return owner();
    try {
      const v = storage.getItem(`${SLOT_KEY}.${account}`);
      return v?.startsWith(`${account}-`) && /^[a-zA-Z0-9_-]{1,80}$/.test(v) ? v : account;
    } catch {
      return account;
    }
  };
  let lang = chooseLang({ storage }), t = makeT(lang), bank = null, who = getOwner(), legacy = null, state = load(), saveFailed = false, ui = {}, semanticSeq = 0;
  const aiReady = () => {
    const s = feedback?.status?.();
    return s?.connected && s.enabled && s.studyVersion === 1 && s.bankHash === bank?.sourceHash;
  };
  function load() {
    legacy = null;
    let raw = null;
    try {
      raw = storage.getItem(storeKey(who));
    } catch {
    }
    if (raw != null) {
      try {
        return readState(JSON.parse(raw), { now: now() });
      } catch {
        return readState(null);
      }
    }
    try {
      const old = JSON.parse(storage.getItem(legacyKey(who)) || "null");
      if (old && old.v === 1) legacy = old;
    } catch {
    }
    return readState(null);
  }
  function save() {
    try {
      storage.setItem(storeKey(who), JSON.stringify(state));
      saveFailed = false;
    } catch {
      saveFailed = true;
    }
  }
  const iso2 = () => new Date(now()).toISOString();
  const record = (o) => {
    state = addObs(state, o, { now: now() });
  };
  const setScene = (scene) => {
    state = { ...state, scene };
    ui = {};
    save();
    paint();
  };
  const items = () => [...bank.open53, ...bank.open54];
  const item = (id2) => items().find((i) => i.id === id2) || null, form = (id2) => bank.forms.find((f) => f.id === id2), find = (id2) => bank.finds.find((f) => f.id === id2), card = (key) => bank.pool.find((c) => c.key === key);
  function syncOwner() {
    const n = getOwner();
    if (n !== who) {
      semanticSeq++;
      who = n;
      state = load();
      if (legacy && bank) {
        state = migrate(legacy, { now: now(), pool: bank.pool });
        legacy = null;
      }
      ui = { resume: !!(state.obs.length || Object.values(state.drafts).some((d) => d.text.trim())) };
    }
  }
  const decide = () => next(state, bank, { now: now(), seed: Math.floor(now() / 6e4) });
  const ids = (list, has) => Array.isArray(list) && list.length > 0 && list.every((k) => typeof k === "string" && has(k));
  function sceneValid(sc) {
    if (!sc || typeof sc !== "object") return false;
    const i = sc.i ?? 0;
    if (!Number.isInteger(i) || i < 0) return false;
    if (sc.id === "write") return !!item(sc.itemId) && [0, 1, 2].includes(sc.support) && ["edit", "self"].includes(sc.phase) && ["new", "revise"].includes(sc.mode ?? "new");
    if (sc.id === "seen") return !!item(sc.itemId) && !!sc.facts && Number.isInteger(sc.facts.total);
    if (sc.id === "probe") return sc.probe === "distinguish" ? ids(sc.cards, card) && i < sc.cards.length : sc.probe === "form" ? ids(sc.forms, form) && i < sc.forms.length : false;
    if (sc.id === "method") {
      if (sc.method === "contrast") return ids(sc.cards, card) && i < sc.cards.length;
      if (sc.method === "forms") return ids(sc.forms, form) && i < sc.forms.length;
      return sc.method === "apply" && (sc.find == null || !!find(sc.find)) && [0, 1].includes(sc.step ?? 0);
    }
    if (sc.id === "semantic") {
      try {
        if (!item(sc.itemId) || sc.bankHash !== bank.sourceHash || !["check", "help", "practice", "result"].includes(sc.phase) || state.drafts[sc.draft]?.checkedAt !== sc.checkedAt) return false;
        const f = readSemantic(sc.feedback, state.drafts[sc.draft]?.text);
        if (f.status === "focus" === (sc.phase === "result")) return false;
        return sc.pick == null || ["check", "practice"].includes(sc.phase) && ["a", "b"].includes(sc.pick);
      } catch {
        return false;
      }
    }
    return sc.id === "rest";
  }
  const toScene = (n) => n.scene === "write" ? { id: "write", itemId: n.itemId, support: n.support, mode: n.mode || "new", why: n.why, phase: "edit" } : n.scene === "probe" ? { id: "probe", probe: n.probe, cards: n.cards || [], forms: n.forms || [], i: 0 } : n.scene === "method" ? { id: "method", method: n.method, cards: n.cards || [], forms: n.forms || [], find: n.find || null, mineFrom: n.mineFrom || null, step: 0, i: 0 } : { id: "rest", why: n.why };
  const examples = (sc) => ["formal", "polite", "plain"].map((b) => bank.pool.find((c) => c.bin === b && !checkCard(c) && !sc.cards.includes(c.key))).filter(Boolean);
  function shell(body) {
    return `<header class="st-top"><p class="st-brand">SYNK</p><h1>${esc(t("study.title"))}</h1><label class="st-lang"><span>${esc(t("study.lang"))}</span><select data-st-lang>${LANGS.map((l) => `<option value="${l}" ${l === lang ? "selected" : ""}>${esc(LANG_NAMES[l])}</option>`).join("")}</select></label></header>` + (saveFailed ? `<p class="st-alert" role="alert">${esc(t("study.saveFail"))}</p>` : "") + `<div class="st-ai-connect"><p class="st-note">${esc(t(feedback?.status?.().connected ? aiReady() ? "ai.connected" : "ai.notReady" : "ai.connectNote"))}</p><button class="st-quiet" ${feedback?.status?.().connected ? "data-st-disconnect" : "data-st-connect"}>${esc(t(feedback?.status?.().connected ? "ai.disconnect" : "ai.connect"))}</button></div>` + (ui.loginError ? `<p class="st-alert" role="alert">${esc(t("ai.loginError"))}</p>` : "") + (ui.authLost ? `<p class="st-alert" role="alert">${esc(t("ai.expired"))}</p>` : "") + `<section class="st-scene" aria-live="polite" ${ui.reading ? 'aria-busy="true"' : ""}>${body}</section><footer class="st-foot"><p>${esc(t("study.lead"))}</p><p>${esc(t("study.device"))}</p></footer>`;
  }
  const actions = (main, { stop = true } = {}) => `<div class="st-actions">${main}${stop ? `<button class="st-quiet" data-st-stop>${esc(t("study.stop"))}</button>` : ""}</div>`;
  const dataHtml = (data) => `<div class="st-data" lang="ko">${data.source ? `<p class="st-source">${esc(data.source)}</p>` : ""}${(data.tables || []).map((tb) => `<table><caption>${esc(tb.caption)}</caption><thead><tr>${tb.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${tb.rows.map((r) => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join("")}</tr>`).join("")}</tbody></table>`).join("")}${(data.lists || []).map((l) => `<div class="st-list"><strong>${esc(l.caption)}</strong><ul>${l.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  const promptHtml = (it) => `<div class="st-data" lang="ko"><p>${esc(it.prompt)}</p>${(it.questions || []).length ? `<ul>${it.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}</div>`;
  const formsTable = () => `<dl class="st-forms">${FORM_ROWS.map(([k, ko]) => `<div><dt>${esc(t(`writing.focus.method.${k}`))}</dt><dd lang="ko">${esc(ko)}</dd></div>`).join("")}</dl><p class="st-note">${esc(t("writing.focus.method.watch"))} <span lang="ko">많는다 · 증가하다.</span></p>`;
  const lastText = (id2) => {
    const r = state.drafts[`r:${id2}`], o = state.drafts[id2];
    return (r?.checkedAt && (!o?.checkedAt || r.checkedAt >= o.checkedAt) ? r.text : o?.text) || "";
  };
  const marksOf = (text2, it) => {
    const o = observeWrite(text2, it);
    return o ? [...o.offSentences, ...o.flagged].length ? [...o.offSentences, ...o.flagged] : o.unknown : sentencesOf(text2).filter((s) => ["formal", "polite"].includes(endingOf(s.text))).map((s) => s.text);
  };
  function writeHtml(sc) {
    const it = item(sc.itemId);
    if (!it) return restHtml({ why: "no-items" });
    const key = draftKey(sc), text2 = state.drafts[key]?.text || "", marks = sc.semantic ? sc.quote && text2.includes(sc.quote) ? [sc.quote] : [] : sc.mode === "revise" ? marksOf(text2, it).slice(0, 6) : [];
    return `<h2 class="st-h">${esc(sc.semantic && sc.rewrite ? sc.rewrite : t(sc.mode === "revise" && marks.length && !sc.semantic ? "write.revise" : it.type === 54 ? "write.task54" : "write.task"))}</h2>` + (sc.support === 2 ? `<div class="st-help"><p class="st-help-title">${esc(t("write.forms"))}</p>${formsTable()}</div>` : "") + (marks.length ? `<ul class="st-marks" lang="ko">${marks.map((s) => `<li><mark>${esc(s)}</mark></li>`).join("")}</ul>` : "") + `<div class="st-question" lang="ko"><p class="st-instruction"><b>${it.type}.</b> ${esc(it.type === 54 ? it.label : it.instruction)}</p>${it.type === 54 ? promptHtml(it) : dataHtml(it.data)}</div><label class="st-label" for="st-text">${esc(t("write.label"))}</label><textarea id="st-text" lang="ko" rows="8" maxlength="${aiReady() ? it.type === 53 ? 600 : 1400 : 4e3}" spellcheck="false" data-st-text>${esc(text2)}</textarea><p class="st-note">${esc(t("writing.countNote"))}</p>` + (aiReady() ? `<p class="st-note" data-ai-consent>${esc(t("ai.consent"))}</p>` : "") + (ui.short ? `<p class="st-alert" role="status">${esc(t("write.short"))}</p>` : "") + (sc.phase === "self" ? `<div class="st-help" data-st-self><p>${esc(t("self.q"))}</p></div>` + actions(`<button class="st-main" data-st-check>${esc(t("self.go"))}</button>`) : actions(`<button class="st-main" data-st-done>${esc(t(aiReady() ? "ai.read" : "write.done"))}</button>`));
  }
  function seenHtml(sc) {
    if (ui.reading) return `<p class="st-fact" role="status">${esc(t("ai.reading"))}</p><button class="st-quiet" data-st-stop>${esc(t("study.stop"))}</button>`;
    const w = sc.facts, it = item(sc.itemId), text2 = state.drafts[sc.draft || sc.itemId]?.text || "", n = decide(), o = observeWrite(text2, it);
    const off = sentencesOf(text2).filter((s) => ["formal", "polite"].includes(endingOf(s.text))).map((s) => s.text);
    const label = { probe: "next.probe", method: "next.method", write: n.mode === "revise" ? "next.revise" : "next.write", rest: "next.rest" }[n.scene];
    const flagged = o?.flagged || [], unknown = sc.verdict === "unassessed" && !w.off && !w.flags ? o?.unknown || [] : [];
    const line = w.off && w.flags ? `${t("writing.focus.found", { total: w.total, off: w.off })} ${t("seen.flags", { n: w.flags })}` : w.off ? t("writing.focus.found", { total: w.total, off: w.off }) : w.flags ? t("seen.flags", { n: w.flags }) : sc.pasted ? t("seen.pasted") : sc.verdict === "correct" ? sc.indep ? t("writing.focus.independent") : t("seen.helpedOk") : sc.linked === false ? t("seen.unlinked") : t("seen.unknown");
    return (ui.aiError ? `<p class="st-alert" role="status">${esc(t(ui.aiError === "cancelled" ? "ai.cancelled" : ["limit", "budget"].includes(ui.aiError) ? "ai.limit" : "ai.failed"))}</p>` : "") + `<h2 class="st-h">${esc(t("seen.title"))}</h2>${it ? `<p class="st-sub" lang="ko">${esc(it.label)}</p>` : ""}<p class="st-fact">${esc(line)}</p><p class="st-count">${esc(t("writing.focus.counts", { plain: w.plain, total: w.total }))}</p>` + ([...off, ...flagged, ...unknown].length ? `<ul class="st-marks" lang="ko">${[...off, ...flagged, ...unknown].slice(0, 6).map((s) => `<li><mark>${esc(s)}</mark></li>`).join("")}</ul>` : "") + `<p class="st-note">${esc(t("writing.focus.limit"))}</p>` + actions(`<button class="st-main" data-st-next>${esc(t(label))} <span aria-hidden="true">→</span></button>`, { stop: n.scene !== "rest" });
  }
  function semanticHtml(sc) {
    const f = sc.feedback, question2 = sc.phase === "check" ? f.check : f.practice;
    const note = `<p class="st-note">${esc(t("ai.reference"))}</p>`;
    if (sc.phase === "result") return `<h2 class="st-h">${esc(f.summary)}</h2>${f.good ? `<p>${esc(f.good)}</p>` : ""}<p>${esc(f.rewrite)}</p>${note}` + actions(`<button class="st-main" data-ai-finish>${esc(t(f.status === "insufficient" ? "ai.revise" : "ai.next"))}</button>`);
    if (sc.phase === "help") return `<h2 class="st-h">${esc(t("ai.help"))}</h2><p class="st-explain">${esc(f.help.explanation)}</p><blockquote class="st-sentence" lang="ko">${esc(f.help.example)}</blockquote>${note}` + actions(`<button class="st-main" data-ai-advance>${esc(t("ai.try"))}</button>`);
    const picked = sc.pick, ok = picked === question2.correct;
    return `<h2 class="st-h">${esc(t(sc.phase === "check" ? "ai.check" : "ai.practice"))}</h2>` + (sc.phase === "check" ? `<p>${esc(f.focus.observation)}</p>${f.focus.quote ? `<blockquote class="st-sentence" lang="ko"><mark>${esc(f.focus.quote)}</mark></blockquote>` : ""}<details class="st-note"><summary>${esc(t("ai.source"))}</summary><p lang="ko">${esc(f.focus.taskQuote)}</p></details>` : "") + `<p class="st-fact">${esc(question2.prompt)}</p><div class="st-ai-choices">${question2.options.map((o) => `<button class="st-bin" lang="ko" data-ai-choice="${o.id}" ${picked ? "disabled" : ""} ${picked && o.id === question2.correct ? 'data-answer="true"' : ""}>${esc(o.text)}</button>`).join("")}</div>` + (picked ? `<p class="st-explain" data-ai-result data-ok="${ok}">${esc(question2.why)}</p>` + actions(`<button class="st-main" data-ai-advance>${esc(t(sc.phase === "practice" ? "ai.revise" : ok ? "ai.try" : "next.continue"))}</button>`) : `<button class="st-quiet" data-st-stop>${esc(t("study.stop"))}</button>`) + note;
  }
  function sortHtml(sc, list, { lead }) {
    const key = list[sc.i], c = card(key);
    if (!c) return "";
    const picked = sc.pick, ok = picked === c.bin, words = c.text.split(" "), last = words.pop();
    return `<p class="st-note">${esc(lead)}</p><p class="st-progress">${esc(t("writing.focus.drill.count", { n: sc.i + 1, total: list.length }))}</p><p class="st-sentence" lang="ko">${picked ? `${esc(words.join(" "))} <mark>${esc(last)}</mark>` : esc(c.text)}</p><div class="st-bins" role="group">${["formal", "polite", "plain"].map((b) => `<button class="st-bin" data-st-bin="${b}" ${picked ? "disabled" : ""} ${picked && b === c.bin ? 'data-answer="true"' : ""} ${picked && b === picked && !ok ? 'data-wrong="true"' : ""}><span>${esc(t(`writing.focus.bin.${b}`))}</span> <span lang="ko">${esc(BIN_FORM[b])}</span></button>`).join("")}</div>` + (picked ? `<p class="st-result" data-ok="${ok}" role="status">${esc(ok ? t("writing.focus.drill.right") : t("writing.focus.drill.wrong", { bin: t(`writing.focus.bin.${c.bin}`) }))}</p>` + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`) : "");
  }
  function formHtml(sc, list, { lead, reveal = true }) {
    const f = form(list[sc.i]);
    if (!f) return "";
    const done = sc.graded != null, right = sc.graded === true, [before, after2] = f.stem.split(f.target);
    const probeLine = right ? t("writing.focus.drill.right") : sc.graded === "typo" ? t("probe.formUnsure") : t("probe.formMiss");
    return `<p class="st-note">${esc(lead)}</p><p class="st-progress">${esc(t("writing.focus.drill.count", { n: sc.i + 1, total: list.length }))}</p><p class="st-sentence" lang="ko">${esc(before)}<u>${esc(f.target)}</u>${esc(after2 ?? "")}</p><label class="st-label" for="st-form">${esc(t("form.input"))}</label><input id="st-form" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="40" data-st-form value="${esc(done ? sc.input : ui.input || "")}" ${done ? "readonly" : ""}>` + (done && !reveal ? `<p class="st-result" data-ok="${right}" role="status">${esc(probeLine)}</p>` + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`) : done ? `<p class="st-result" data-ok="${right}" role="status">${esc(right ? t("writing.focus.drill.right") : t("form.answer"))} ${right ? "" : `<span lang="ko">${esc(f.answer)}</span>`}</p><p class="st-explain"><small>${esc(t("form.why"))}</small> <span lang="ko">${esc(f.explain)}</span></p>` + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`) : actions(`<button class="st-main" data-st-grade>${esc(t("form.check"))}</button>`));
  }
  function findHtml(f, sc) {
    const done = sc.found != null, picks = done ? sc.picks : ui.picks || [];
    return `<p class="st-note">${esc(t("find.lead"))}</p><ol class="st-find" lang="ko">${f.sentences.map((s, i) => `<li><button class="st-pickline" data-st-line="${i}" aria-pressed="${picks.includes(i)}" ${done ? "disabled" : ""} ${done && f.off.includes(i) ? 'data-answer="true"' : ""}>${esc(s)}${done && f.off.includes(i) ? ` <span class="st-tag" lang="${lang}">${esc(t("find.tag"))}</span>` : ""}</button></li>`).join("")}</ol>` + (done ? `<p class="st-result" data-ok="${sc.found}" role="status">${esc(t(sc.found ? "find.right" : "find.wrong"))}</p><p class="st-explain" lang="ko">${esc(f.explain)}</p>` + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`) : actions(`<button class="st-main" data-st-findcheck ${picks.length ? "" : "disabled"}>${esc(t("form.check"))}</button>`));
  }
  function mineHtml(sc) {
    const text2 = lastText(sc.mineFrom), list = marksOf(text2, item(sc.mineFrom)).slice(0, 3);
    if (!list.length) return null;
    return `<h2 class="st-h">${esc(t("writing.focus.mine.title").replace(/^[①-⑨]\s*/, ""))}</h2><p class="st-note">${esc(t("mine.lead"))}</p>` + list.map((s, i) => {
      const v = ui.mine?.[i] || "", r = checkChange(v);
      return `<div class="st-mine"><p lang="ko"><mark>${esc(s)}</mark></p><label class="st-label" for="st-mine-${i}">${esc(t("writing.focus.mine.label", { n: i + 1 }))}</label><input id="st-mine-${i}" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="200" data-st-mine="${i}" value="${esc(v)}"><p class="st-mine-state" data-st-mine-state="${i}" data-ok="${r && r.ok != null ? String(r.ok) : ""}">${r ? esc(mineMsg(r)) : ""}</p></div>`;
    }).join("") + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`);
  }
  const mineMsg = (r) => r.ok === true ? t("writing.focus.mine.ok") : r.ok === null ? t("change.unsure") : r.why === "adj-neun" ? t("change.adj") : r.why === "dict" ? t("change.dict") : r.why === "neun" ? t("change.neun") : t("writing.focus.mine.not");
  function probeHtml(sc) {
    return sc.probe === "distinguish" ? sortHtml(sc, sc.cards, { lead: t("writing.focus.drill.lead") }) : formHtml(sc, sc.forms, { lead: t("probe.formLead"), reveal: false });
  }
  function methodHtml(sc) {
    if (sc.method === "contrast") {
      const intro = sc.i === 0 && !sc.pick ? `<p class="st-lead">${esc(t("method.contrast"))}</p><p class="st-note">${esc(t("method.examples"))}</p><dl class="st-examples">${examples(sc).map((c) => `<div><dt>${esc(t(`writing.focus.bin.${c.bin}`))}</dt><dd lang="ko">${esc(c.text)}</dd></div>`).join("")}</dl>` : "";
      return intro + sortHtml(sc, sc.cards, { lead: t("writing.focus.drill.lead") });
    }
    if (sc.method === "forms") {
      const intro = sc.i === 0 && sc.graded == null ? `<p class="st-lead">${esc(t("method.forms"))}</p>${formsTable()}` : "";
      return intro + formHtml(sc, sc.forms, { lead: t("probe.formLead") });
    }
    if (sc.step === 0 && sc.find && find(sc.find)) return `<p class="st-lead">${esc(t("method.apply"))}</p><ol class="st-steps"><li>${esc(t("writing.focus.method.step1"))}</li><li>${esc(t("writing.focus.method.step2"))}</li></ol>` + findHtml(find(sc.find), sc);
    return mineHtml(sc) ?? actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`);
  }
  function restHtml(sc) {
    const key = { done: "rest.done", "no-items": "rest.noItems", "tried-all": "rest.triedAll", enough: "rest.triedAll", "alone-once": "rest.alone", later: "rest.alone" }[sc.why] || "study.stopped";
    return `<p class="st-fact">${esc(t(key))}</p>`;
  }
  function resumeHtml() {
    return `<h2 class="st-h">${esc(t("resume.title"))}</h2><p class="st-note">${esc(t("resume.note"))}</p>` + actions(`<button class="st-main" data-st-resume>${esc(t("study.resumeHere"))} <span aria-hidden="true">→</span></button><button class="st-plain" data-st-fresh>${esc(t("resume.fresh"))}</button>`, { stop: false });
  }
  function paint(focus = true) {
    syncOwner();
    if (bank && !sceneValid(state.scene)) {
      const keep = ui;
      go();
      ui = keep;
      paint(focus);
      return;
    }
    const sc = state.scene;
    let body;
    if (ui.stopped) body = `<p class="st-fact">${esc(t("study.stopped"))}</p>` + actions(`<button class="st-main" data-st-unstop>${esc(t("study.resumeHere"))} <span aria-hidden="true">→</span></button>`, { stop: false });
    else if (ui.resume) body = resumeHtml();
    else body = sc.id === "semantic" ? semanticHtml(sc) : sc.id === "write" ? writeHtml(sc) : sc.id === "seen" ? seenHtml(sc) : sc.id === "probe" ? probeHtml(sc) : sc.id === "method" ? methodHtml(sc) : restHtml(sc);
    root.innerHTML = shell(body);
    root.lang = lang;
    if (focus) root.querySelector("[data-st-text]:not([readonly]), [data-st-form]:not([readonly]), .st-scene .st-main, .st-scene button")?.focus({ preventScroll: true });
  }
  function finishProbe(sc) {
    record({ kind: "probe", probe: sc.probe });
    go();
  }
  function finishMethod(sc) {
    record({ kind: "method", method: sc.method });
    go();
  }
  function go() {
    const n = decide(), d = recordDecision(state, { scene: n.scene, why: n.why, ...n.method ? { method: n.method } : {}, ...n.probe ? { probe: n.probe } : {}, ...n.itemId ? { itemId: n.itemId, support: n.support, mode: n.mode } : {} }, { now: now() });
    state = d.state;
    let sc = { ...toScene(n), did: d.did };
    if (sc.id === "write" && sc.mode === "revise") {
      const k = draftKey(sc), prev = state.drafts[k]?.text || state.drafts[sc.itemId]?.text || "";
      state = { ...state, drafts: { ...state.drafts, [k]: { text: prev, updatedAt: iso2(), checkedAt: null } } };
    }
    if (sc.id === "method" && sc.method === "contrast") state = markSeen(state, examples(sc).map((c) => `card:${c.key}`), { now: now() });
    setScene(sc);
  }
  function advance() {
    const sc = state.scene;
    if (sc.id === "probe" && sc.probe === "form" && sc.graded === false) return finishProbe(sc);
    if (sc.id === "probe" || sc.id === "method" && sc.method !== "apply") {
      const list = sc.probe === "distinguish" || sc.method === "contrast" ? sc.cards : sc.forms;
      if (sc.i + 1 < list.length) {
        const { pick, graded, input, ...rest } = sc;
        state = { ...state, scene: { ...rest, i: sc.i + 1 } };
        ui = {};
        save();
        paint();
        return;
      }
      return sc.id === "probe" ? finishProbe(sc) : finishMethod(sc);
    }
    if (sc.id === "method" && sc.method === "apply") {
      if (sc.step === 0 && sc.find) {
        const { found, picks, ...rest } = sc;
        state = { ...state, scene: { ...rest, step: 1 } };
        ui = {};
        save();
        paint();
        return;
      }
      return finishMethod(sc);
    }
  }
  function checkWrite() {
    const sc = state.scene, key = draftKey(sc), d = state.drafts[key] || { text: "" }, it = item(sc.itemId);
    if (!observeWrite(d.text, it)) {
      ui.short = true;
      paint(false);
      root.querySelector("[data-st-text]")?.focus();
      return;
    }
    const pasted = (d.pasted || 0) * 2 >= d.text.length && d.pasted > 0;
    if (sc.why === "restart") record({ kind: "cycle" });
    const r = recordWrite(state, { did: sc.did, item: it, itemId: sc.itemId, text: d.text, support: sc.support, mode: sc.mode || "new", pasted }, { now: now() });
    const indep = !!r.ev && trailRows(r.state, now()).get(r.ev)?.independent === true;
    state = { ...r.state, drafts: { ...r.state.drafts, [key]: { text: d.text, updatedAt: d.updatedAt, checkedAt: iso2() } } };
    setScene({ id: "seen", itemId: sc.itemId, draft: key, support: sc.support, verdict: r.o.verdict, indep, linked: r.o.linked, pasted, facts: { plain: r.o.plain, off: r.o.off, total: r.o.total, flags: r.o.flags } });
    if (aiReady()) void askMeaning(sc, key, d.text);
  }
  async function askMeaning(sc, key, answer) {
    const sequence = ++semanticSeq, expected = who, checkedAt = state.drafts[key]?.checkedAt;
    ui = { reading: true };
    paint();
    try {
      const result = await feedback.request({ itemId: sc.itemId, bankHash: bank.sourceHash, answer, lang, stage: sc.mode === "revise" ? "revision" : sc.why === "semantic-transfer" ? "transfer" : "initial", focusSkill: sc.focusSkill || null, consent: "send-once" });
      if (sequence !== semanticSeq || expected !== getOwner() || state.drafts[key]?.checkedAt !== checkedAt) return;
      if (result.status !== "ok") throw Object.assign(Error("AI_UNAVAILABLE"), { code: result.status });
      const f = readSemantic(result.feedback, answer);
      state = recordSemantic(state, { feedback: f, itemId: sc.itemId }, { now: now() });
      setScene({ id: "semantic", phase: f.status === "focus" ? "check" : "result", itemId: sc.itemId, draft: key, checkedAt, bankHash: bank.sourceHash, feedback: f });
    } catch (e) {
      if (sequence !== semanticSeq) return;
      if (expected !== getOwner()) {
        syncOwner();
        go();
        ui = { ...ui, authLost: true };
        paint();
        return;
      }
      ui = { aiError: e.code || "unavailable" };
      paint();
    }
  }
  function semanticWrite(sc, revise) {
    const f = sc.feedback, n = semanticNext(state, bank, { itemId: sc.itemId, revise, focusSkill: f.focus?.skill || null, now: now() }), d = recordDecision(state, { scene: n.id, why: n.why, source: "ai-reference", skill: f.focus?.skill || "none" }, { now: now() });
    state = d.state;
    if (n.id === "write" && revise) {
      const k = draftKey(n);
      state = { ...state, drafts: { ...state.drafts, [k]: { text: state.drafts[sc.draft]?.text || "", updatedAt: iso2(), checkedAt: null } } };
      n.rewrite = f.rewrite;
      n.quote = f.focus?.quote || "";
    }
    setScene({ ...n, did: d.did });
  }
  function onClick(ev) {
    const b = ev.target.closest("button");
    if (!b || !root.contains(b) || b.disabled) return;
    const sc = state.scene;
    if (b.hasAttribute("data-st-connect")) {
      b.disabled = true;
      void feedback?.login().catch(() => {
        ui.loginError = true;
        paint(false);
      });
      return;
    }
    if (b.hasAttribute("data-st-disconnect")) {
      semanticSeq++;
      try {
        feedback?.disconnect();
      } catch {
        ui.loginError = true;
      }
      syncOwner();
      const keep = ui;
      go();
      ui = keep;
      paint();
      return;
    }
    if (b.hasAttribute("data-st-stop")) {
      semanticSeq++;
      const cancelled = !!ui.reading;
      if (cancelled) feedback?.cancel?.();
      save();
      ui = { stopped: true, cancelled };
      paint();
      return;
    }
    if (b.dataset.aiChoice && sc.id === "semantic" && !sc.pick && ["check", "practice"].includes(sc.phase)) {
      state = recordSemantic(state, { feedback: sc.feedback, itemId: sc.itemId, stage: sc.phase, pick: b.dataset.aiChoice }, { now: now() });
      setScene({ ...sc, pick: b.dataset.aiChoice });
      return;
    }
    if (b.hasAttribute("data-ai-advance") && sc.id === "semantic") {
      if (sc.phase === "practice") {
        semanticWrite(sc, true);
        return;
      }
      const phase = sc.phase === "help" || sc.pick === sc.feedback.check.correct ? "practice" : "help";
      setScene({ ...sc, phase, pick: null });
      return;
    }
    if (b.hasAttribute("data-ai-finish") && sc.id === "semantic") {
      semanticWrite(sc, sc.feedback.status === "insufficient");
      return;
    }
    if (b.hasAttribute("data-st-unstop")) {
      ui = ui.cancelled ? { aiError: "cancelled" } : {};
      paint();
      return;
    }
    if (b.hasAttribute("data-st-resume")) {
      try {
        session?.setItem("synk.study.resumed", who);
      } catch {
      }
      ui = {};
      paint();
      return;
    }
    if (b.hasAttribute("data-st-fresh")) {
      const account = feedback?.owner?.(), pointer = account ? `${SLOT_KEY}.${account}` : SLOT_KEY;
      let slot2 = null;
      try {
        for (let n = 0; n < 20 && !slot2; n++) {
          const c = `${account || "guest"}-${(now() + n).toString(36)}`;
          if (storage.getItem(storeKey(c)) == null && storage.getItem(legacyKey(c)) == null) slot2 = c;
        }
        if (slot2) {
          storage.setItem(pointer, slot2);
          if (storage.getItem(pointer) !== slot2) slot2 = null;
        }
      } catch {
        slot2 = null;
      }
      if (!slot2 || getOwner() !== slot2) {
        saveFailed = true;
        ui = { resume: true };
        paint();
        return;
      }
      who = slot2;
      legacy = null;
      state = readState(null);
      try {
        session?.setItem("synk.study.resumed", who);
      } catch {
      }
      ui = {};
      go();
      return;
    }
    if (b.hasAttribute("data-st-done")) {
      const d = state.drafts[draftKey(sc)];
      if (!observeWrite(d?.text || "", item(sc.itemId))) {
        ui.short = true;
        paint(false);
        root.querySelector("[data-st-text]")?.focus();
        return;
      }
      if (sc.support === 1 && !sc.semantic) {
        state = { ...state, scene: { ...sc, phase: "self" } };
        ui = {};
        save();
        paint(false);
        root.querySelector("[data-st-check]")?.focus();
        return;
      }
      checkWrite();
      return;
    }
    if (b.hasAttribute("data-st-check")) {
      checkWrite();
      return;
    }
    if (b.hasAttribute("data-st-next")) {
      go();
      return;
    }
    if (b.hasAttribute("data-st-advance")) {
      advance();
      return;
    }
    if (b.dataset.stBin && !sc.pick) {
      const c = card(sc.cards[sc.i]);
      if (!c) return;
      const pick = b.dataset.stBin;
      const r = recordSort(state, { did: sc.did, card: c, pick, learn: sc.id === "method" }, { now: now() });
      state = { ...r.state, scene: { ...sc, pick }, recentCards: [...r.state.recentCards, c.key].slice(-12) };
      save();
      paint();
      return;
    }
    if (b.hasAttribute("data-st-grade") && sc.graded == null) {
      const f = form(sc.forms[sc.i]), g = f ? gradeForm(f, ui.input) : null;
      if (g == null) {
        root.querySelector("[data-st-form]")?.focus();
        return;
      }
      const r = recordForm(state, { did: sc.did, form: f, grade: g, learn: sc.id === "method" }, { now: now() });
      state = { ...r.state, scene: { ...sc, graded: g, input: String(ui.input).slice(0, 40) } };
      save();
      paint();
      return;
    }
    if (b.dataset.stLine != null && sc.found == null) {
      const i = Number(b.dataset.stLine), p = new Set(ui.picks || []);
      p.has(i) ? p.delete(i) : p.add(i);
      ui.picks = [...p];
      paint(false);
      root.querySelector(`[data-st-line="${i}"]`)?.focus();
      return;
    }
    if (b.hasAttribute("data-st-findcheck") && sc.found == null) {
      const f = find(sc.find), picks = ui.picks || [], found = gradeFind(f, picks);
      if (!state.seen[f.id]) record({ kind: "find", id: f.id, ok: found });
      state = { ...markSeen(state, [f.id], { now: now() }), scene: { ...sc, found, picks } };
      save();
      paint();
      return;
    }
  }
  function onInput(ev) {
    const el = ev.target, sc = state.scene;
    if (el.matches("[data-st-text]")) {
      const k = draftKey(sc), { pasted, ...d } = state.drafts[k] || { checkedAt: null };
      const text2 = el.value.slice(0, 4e3);
      state = { ...state, drafts: { ...state.drafts, [k]: { ...d, ...text2.trim() && pasted ? { pasted: Math.min(pasted, text2.length) } : {}, text: text2, updatedAt: iso2() } } };
      if (ui.short) {
        ui.short = false;
        root.querySelector(".st-alert[role=status]")?.remove();
      }
      save();
      return;
    }
    if (el.matches("[data-st-form]")) {
      ui.input = el.value;
      return;
    }
    if (el.matches("[data-st-mine]")) {
      const i = el.dataset.stMine;
      ui.mine = { ...ui.mine || {}, [i]: el.value };
      const r = checkChange(el.value), out = root.querySelector(`[data-st-mine-state="${i}"]`);
      if (out) {
        out.dataset.ok = r && r.ok != null ? String(r.ok) : "";
        out.textContent = r ? mineMsg(r) : "";
      }
      return;
    }
  }
  function onPaste(ev) {
    if (!ev.target.matches?.("[data-st-text]")) return;
    const sc = state.scene, k = draftKey(sc), n = String(ev.clipboardData?.getData("text") || "").length;
    if (!n) return;
    const d = state.drafts[k] || { text: "", checkedAt: null };
    state = { ...state, drafts: { ...state.drafts, [k]: { ...d, pasted: (d.pasted || 0) + n } } };
  }
  function onChange(ev) {
    if (ev.target.matches("[data-st-lang]")) {
      lang = LANGS.includes(ev.target.value) ? ev.target.value : "ko";
      t = makeT(lang);
      try {
        storage.setItem(LANG_KEY, lang);
      } catch {
      }
      document.title = `${t("study.title")} · SYNK`;
      paint(false);
      root.querySelector("[data-st-lang]")?.focus();
    }
  }
  function onKey(ev) {
    if (ev.key === "Enter" && ev.target.matches("[data-st-form]")) {
      ev.preventDefault();
      root.querySelector("[data-st-grade]")?.click();
    }
  }
  async function start() {
    root.innerHTML = shell(`<p class="st-note" role="status">${esc(t("writing.loading"))}</p>`);
    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKey);
    root.addEventListener("paste", onPaste);
    await feedback?.init();
    syncOwner();
    try {
      const get = async (name) => {
        const r = await fetcher(new URL(`${name}?v=${TOKEN}`, base), { cache: "no-cache" });
        if (!r.ok) throw Error(name);
        return r.json();
      };
      const [items2, study] = await Promise.all([get("items.json"), get("study.json")]);
      const open = (items2.items || []).filter((i) => i?.review?.status === "passed"), content = (study.items || []).filter((i) => i?.review?.status === "passed");
      bank = { sourceHash: items2.sourceHash, open53: open.filter((i) => i.type === 53), open54: open.filter((i) => i.type === 54 && typeof i.prompt === "string"), pool: drillPool(open), forms: content.filter((i) => i.type === "study-form"), finds: content.filter((i) => i.type === "study-find") };
      if (!bank.open53.length) throw Error("EMPTY");
    } catch {
      root.querySelector(".st-scene").innerHTML = `<p class="st-alert" role="alert">${esc(t("writing.loadError"))}</p>`;
      return;
    }
    document.title = `${t("study.title")} · SYNK`;
    if (legacy) {
      state = migrate(legacy, { now: now(), pool: bank.pool });
      legacy = null;
      save();
    }
    let resumed = null;
    try {
      resumed = session?.getItem("synk.study.resumed");
    } catch {
    }
    const has = state.obs.length || Object.values(state.drafts).some((d) => d.text.trim());
    if (has && resumed !== who) ui = { resume: true };
    else if (!has) {
      try {
        session?.setItem("synk.study.resumed", who);
      } catch {
      }
    }
    const sc = state.scene, valid = sceneValid(sc);
    if (!valid || sc.id === "rest") {
      const keep = ui;
      go();
      ui = keep;
      paint();
      return;
    }
    paint();
  }
  return { start, state: () => state };
}
if (globalThis.document && document.querySelector("[data-study-root]")) createStudy({ root: document.querySelector("[data-study-root]") }).start();
export {
  createStudy,
  deviceSlot
};
