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

// experiences/korean-study/src/tutor.mjs
var import_ask = __toESM(require_ask(), 1);

// experiences/synk-world-app/world-writing-check.mjs
var plain = (text) => String(text ?? "").replace(/\r\n?/g, "\n").normalize("NFC");
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
function sentencesOf(text) {
  const value = plain(text), out = [];
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
    const text = line.map((part) => typeof part === "string" ? part : "\0").join("");
    for (const s of sentencesOf(text)) if (!s.text.includes("\0")) out.push(s.text);
  }
  return out;
}
function drillPool(open = []) {
  const pool = [];
  for (const item of open) {
    if (item?.review?.status !== "passed" || ![51, 52].includes(item.type) || !BINS.includes(item.style)) continue;
    for (const [i, text] of passageSentences(item).entries()) if (endingOf(text) === item.style && [...text].length >= 8) pool.push({ key: `${item.id}:${i}`, text, bin: item.style, itemId: item.id });
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
var endsPlain = (text) => {
  const value = String(text || "").trim(), sentences = sentencesOf(value);
  return sentences.length === 1 && !/[?？]/.test(value) && endingOf(value) === "plain" && /[가-힣]다[.!。！\s"'”’」』)]*$/.test(value);
};

// experiences/korean-study/src/tutor.mjs
var VERSION = 1;
var OBS_MAX = 80;
var STALE_DAYS = 14;
var MIN_SENTENCES = 3;
var PROBE_CARDS = 3;
var PROBE_FORMS = 2;
var LEARN_FORMS = 4;
var DAY = 864e5;
var BINS2 = ["formal", "polite", "plain"];
var AXES = ["verb", "adj", "noun", "past"];
var METHODS = ["apply", "forms", "contrast"];
var KINDS2 = ["write", "sort", "form", "find", "change", "method", "probe"];
var storeKey = (owner) => `synk.study.v1:${typeof owner === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(owner) ? owner : "guest"}`;
var validAt2 = (at, now) => typeof at === "string" && Number.isFinite(Date.parse(at)) && Date.parse(at) <= now;
var id = (v) => typeof v === "string" && /^[a-zA-Z0-9_:-]{1,120}$/.test(v);
var nat = (v) => Number.isInteger(v) && v >= 0 && v <= 500;
function cleanObs(o, now) {
  if (!o || typeof o !== "object" || !KINDS2.includes(o.kind) || !validAt2(o.at, now)) return null;
  const base = { at: o.at, kind: o.kind };
  if (o.kind === "write") return id(o.itemId) && [0, 1, 2].includes(o.support) && ["plain", "off", "total", "formal", "polite"].every((k) => nat(o[k])) ? { ...base, itemId: o.itemId, support: o.support, same: o.same === true, plain: o.plain, off: o.off, total: o.total, formal: o.formal, polite: o.polite, flags: nat(o.flags) ? o.flags : 0, axes: Array.isArray(o.axes) ? AXES.filter((a) => o.axes.includes(a)) : [] } : null;
  if (o.kind === "sort") return id(o.card) && BINS2.includes(o.bin) && typeof o.ok === "boolean" ? { ...base, card: o.card, bin: o.bin, ok: o.ok, use: o.use === "check" ? "check" : "learn" } : null;
  if (o.kind === "form") return id(o.id) && AXES.includes(o.axis) && ["learn", "check"].includes(o.use) && typeof o.ok === "boolean" ? { ...base, id: o.id, axis: o.axis, use: o.use, ok: o.ok } : null;
  if (o.kind === "find") return id(o.id) && typeof o.ok === "boolean" ? { ...base, id: o.id, ok: o.ok } : null;
  if (o.kind === "change") return typeof o.ok === "boolean" ? { ...base, ok: o.ok } : null;
  if (o.kind === "method") return METHODS.includes(o.method) ? { ...base, method: o.method } : null;
  if (o.kind === "probe") return ["distinguish", "form"].includes(o.probe) ? { ...base, probe: o.probe } : null;
  return null;
}
function readState(raw, { now = Date.now() } = {}) {
  const v = raw && typeof raw === "object" && raw.v === VERSION ? raw : {};
  const obs = (Array.isArray(v.obs) ? v.obs : []).map((o) => cleanObs(o, now)).filter(Boolean).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-OBS_MAX);
  const drafts = Object.fromEntries(Object.entries(v.drafts && typeof v.drafts === "object" ? v.drafts : {}).filter(([k, d]) => id(k) && d && typeof d.text === "string" && d.text.length <= 4e3).map(([k, d]) => [k, { text: d.text, updatedAt: validAt2(d.updatedAt, now) ? d.updatedAt : null, checkedAt: validAt2(d.checkedAt, now) ? d.checkedAt : null }]));
  const seen = Object.fromEntries(Object.entries(v.seen && typeof v.seen === "object" ? v.seen : {}).filter(([k, at]) => id(k) && validAt2(at, now)));
  const recentCards = (Array.isArray(v.recentCards) ? v.recentCards : []).filter(id).slice(-12);
  const scene = v.scene && typeof v.scene === "object" && typeof v.scene.id === "string" ? v.scene : null;
  return { v: VERSION, obs, drafts, seen, recentCards, scene };
}
var addObs = (state, o, { now = Date.now() } = {}) => {
  const c = cleanObs({ ...o, at: o.at || new Date(now).toISOString() }, now);
  return c ? { ...state, obs: [...state.obs, c].slice(-OBS_MAX) } : state;
};
var markSeen = (state, ids, { now = Date.now() } = {}) => ({ ...state, seen: { ...Object.fromEntries(ids.filter(id).map((i) => [i, new Date(now).toISOString()])), ...state.seen } });
function observeWrite(text) {
  const sentences = sentencesOf(String(text || "")).filter((s) => s.text.replace(/[\s.!?]/g, ""));
  if (sentences.length < MIN_SENTENCES) return null;
  const distinct = new Set(sentences.filter((s) => s.text.trim().split(/\s+/).length >= 2).map((s) => s.text.replace(/[\s.!?。！？]+/g, "")));
  if (distinct.size < MIN_SENTENCES) return null;
  const ends = sentences.map((s) => endingOf(s.text));
  const formal = ends.filter((e) => e === "formal").length, polite = ends.filter((e) => e === "polite").length, plain2 = sentences.filter((s) => endsPlain(s.text)).length;
  if (plain2 + formal + polite < sentences.length) return null;
  const offSentences = sentences.filter((s, i) => ends[i] === "formal" || ends[i] === "polite").map((s) => s.text);
  const flagged = sentences.filter((s) => endsPlain(s.text) && checkChange(s.text)?.ok === false).map((s) => s.text);
  return { plain: plain2, off: formal + polite, total: sentences.length, formal, polite, flags: flagged.length, axes: offAxes(offSentences), offSentences, flagged };
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
var ADJ_NEUN = /(많|높|낮|좋|싫|작|넓|좁|짧)는다[.!]?\s*$/;
var DICT_VERB = /(증가|감소|차지|변화|사용|이용|참가|참여|발생|선택|조사|응답|공부|생활|운동|이동|거주|방문|구입|구매|판매|생각|준비|시작|노력|설명|진행|결정|활동|성장|확대|상승|하락)하다[.!]?\s*$|(늘어나|줄어들|오르|내리|떨어지)다[.!]?\s*$|(?<![가-힣])(늘|줄)다[.!]?\s*$/;
function checkChange(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  if (!endsPlain(value)) return { ok: false, why: "ending" };
  if (ADJ_NEUN.test(value)) return { ok: false, why: "adj-neun" };
  if (DICT_VERB.test(value)) return { ok: false, why: "dict" };
  return { ok: true, why: null };
}
var norm = (s) => String(s || "").normalize("NFC").trim().replace(/[.。!]+$/, "").replace(/\s+/g, " ");
var gradeForm = (item, input) => {
  const v = norm(input);
  return v ? item.accept.some((a) => norm(a) === v) : null;
};
var gradeFind = (item, picks) => {
  const a = [...new Set(picks)].sort(), b = [...item.off].sort();
  return a.length === b.length && a.every((x, i) => x === b[i]);
};
function window(state, now) {
  const obs = state.obs.filter((o) => Date.parse(o.at) <= now);
  const last = obs.at(-1);
  if (!last || now - Date.parse(last.at) > STALE_DAYS * DAY) return { obs: [], stale: !!last };
  return { obs: obs.filter((o) => now - Date.parse(o.at) <= STALE_DAYS * DAY), stale: false };
}
var after = (obs, o) => o ? obs.filter((x) => Date.parse(x.at) > Date.parse(o.at) || x.at === o.at && obs.indexOf(x) > obs.indexOf(o)) : obs;
function evidence(state, { now = Date.now() } = {}) {
  const { obs, stale } = window(state, now), writes = obs.filter((o) => o.kind === "write");
  const unaided = (w) => w.support === 0 && !w.same;
  const ok = (w) => w.off === 0 && !w.flags, alone = writes.filter((w) => unaided(w) && ok(w));
  const lastAlone = alone.at(-1) || null, round = after(obs, lastAlone);
  const sorts = round.filter((o) => o.kind === "sort" && o.use === "check"), checks = round.filter((o) => o.kind === "form" && o.use === "check");
  const distinguish = sorts.length >= PROBE_CARDS ? sorts.filter((o) => o.ok).length / sorts.length >= 2 / 3 ? "ok" : "miss" : null;
  const form = checks.some((o) => !o.ok) ? "miss" : checks.length >= PROBE_FORMS ? "ok" : null;
  const wrongAxes = AXES.filter((a) => round.some((o) => o.kind === "form" && o.axis === a && !o.ok));
  const methods = round.filter((o) => o.kind === "method");
  return {
    obs,
    stale,
    writes,
    lastWrite: writes.at(-1) || null,
    alone,
    lastAlone,
    round,
    distinguish,
    form,
    wrongAxes,
    methods,
    aloneItems: [...new Set(alone.map((w) => w.itemId))]
  };
}
function decideMethod(answers, prior) {
  const d = answers.distinguish ?? prior.distinguish, f = answers.form ?? prior.form;
  return d === "miss" ? "contrast" : f === "miss" ? "forms" : "apply";
}
function priorOf(write) {
  return write && write.plain > 0 ? { distinguish: "ok", form: "ok" } : { distinguish: "miss", form: "ok" };
}
function next(state, bank, { now = Date.now(), seed = 1 } = {}) {
  const s = readState(state, { now }), e = evidence(s, { now });
  const fresh = bank.open53.filter((it) => !s.drafts[it.id]?.checkedAt && !e.writes.some((w) => w.itemId === it.id) && !s.obs.some((o) => o.kind === "write" && o.itemId === it.id));
  const write = (support, why) => fresh[0] ? { scene: "write", itemId: fresh[0].id, support, why } : { scene: "rest", why: "no-items" };
  if (!e.lastWrite) return write(0, e.stale ? "stale" : "start");
  const lw = e.lastWrite;
  if (lw.support === 0 && !lw.same && lw.off === 0 && !lw.flags) {
    const days = e.alone.map((w) => Date.parse(w.at));
    if (e.aloneItems.length >= 2 && Math.max(...days) - Math.min(...days) >= DAY) return { scene: "rest", why: "done" };
    if (now - Date.parse(lw.at) >= DAY) return write(0, "recheck");
    return { scene: "rest", why: "alone-once" };
  }
  const methods = e.methods, lastMethod = methods.at(-1) || null;
  const writesAfterMethod = lastMethod ? after(e.writes, lastMethod) : [];
  if (lw.off === 0 && !lw.flags) return write(Math.max(0, (lw.same ? 2 : lw.support) - 1), "fade");
  if (lastMethod) {
    const fails = writesAfterMethod.filter((w) => w.off > 0 || w.flags > 0).length;
    if (fails === 0) return write(lastMethod.method === "apply" ? 1 : 2, "after-method");
    if (fails === 1) return write(Math.min(2, lw.support + 1), "retry-more-help");
    const tried = new Set(methods.map((m) => m.method)), order = ["apply", "forms", "contrast", "apply", "forms"];
    const nextMethod = order.slice(order.indexOf(lastMethod.method) + 1).find((m) => !tried.has(m));
    return nextMethod ? methodScene(nextMethod, "switch", s, bank, e, { seed }) : { scene: "rest", why: "tried-all" };
  }
  const prior = priorOf(lw), answers = { ...e.distinguish ? { distinguish: e.distinguish } : {}, ...lw.flags ? { form: "miss" } : e.form ? { form: e.form } : {} };
  const probes = after(e.obs, lw).filter((o) => o.kind === "probe").length;
  const checksLeft = bank.forms.filter((f) => f.use === "check" && !s.seen[f.id]);
  const questions = [{ id: "distinguish", kind: "follow_up", options: [{ id: "ok" }, { id: "miss" }] }, ...checksLeft.length >= PROBE_FORMS ? [{ id: "form", kind: "follow_up", options: [{ id: "ok" }, { id: "miss" }] }] : []];
  if (lw.plain > 0) questions.reverse();
  {
    const found = Object.values(answers).includes("miss");
    const choice = import_ask.default.choose({ questions, decide: (a) => decideMethod(a, prior), answers, budget: 2, usedToday: found ? 2 : probes });
    if (choice.status === "ask") return probeScene(choice.question.id, s, bank, lw, { seed });
  }
  return methodScene(decideMethod(answers, prior), "decided", s, bank, e, { seed });
}
function probeScene(probe, s, bank, lw, { seed }) {
  if (probe === "distinguish") {
    const deck = drillDeck(bank.pool, { seed, size: PROBE_CARDS, focus: { id: "ending-53", recentCards: s.recentCards } });
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
  return { scene: "probe", probe, forms: chosen.map((f) => f.id), why: "unknown-cause" };
}
var canDo = (m, bank) => m === "contrast" ? bank.pool.length >= 6 : m === "forms" ? bank.forms.some((f) => f.use === "learn") : true;
function methodScene(want, why, s, bank, e, { seed }) {
  const method = canDo(want, bank) ? want : ["apply", "forms", "contrast"].find((m) => canDo(m, bank));
  if (method === "contrast") return { scene: "method", method, why, cards: drillDeck(bank.pool, { seed, size: 6, focus: { id: "ending-53", recentCards: s.recentCards, practice: practiceOf(e) } }).map((c) => c.key) };
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
  "study.device": { ko: "공부 기록은 이 기기에만 저장돼요. 계정 연결은 아직 없어요.", en: "Your study record is saved only on this device. Account sign-in is not connected yet.", mn: "Хичээлийн явц зөвхөн энэ төхөөрөмжид хадгалагдана. Бүртгэлтэй холбох боломж одоогоор байхгүй." },
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
  "write.forms": { ko: "53번 글의 문장 끝", en: "Sentence endings for question 53", mn: "53-р даалгаврын өгүүлбэрийн төгсгөл" },
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
  "rest.done": { ko: "이 한 가지는 처음 보는 자료 두 개에서 도움 없이 맞았어요. 다음 주제는 아직 준비 중이에요.", en: "You got this point right without help on two new sets of data. The next topic is not ready yet.", mn: "Анх удаа үзсэн хоёр мэдээллийг тайлбарлахдаа өгүүлбэрийн төгсгөлийг тусламжгүйгээр зөв бичлээ. Дараагийн сэдэв одоогоор бэлтгэгдэж байна." },
  "rest.noItems": { ko: "처음 보는 53번 자료를 다 썼어요. 새 자료가 준비되면 이어서 해요.", en: "You have used all the new data for question 53. We will continue when new data is ready.", mn: "53-р даалгаврын шинэ мэдээллийг бүгдийг нь ашиглаж дууслаа. Шинэ мэдээлэл бэлэн болохоор үргэлжлүүлнэ." },
  "rest.triedAll": { ko: "오늘은 여기까지 해요. 다음에 오면 다시 써 보면서 이어 가요.", en: "Let's stop here for today. Next time, we will pick up with writing again.", mn: "Өнөөдөр ингээд болъё. Дараа ирэхдээ дахин бичиж үргэлжлүүлнэ." }
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

// experiences/korean-study/src/app.mjs
var TOKEN = true ? "48340b144bcd" : "dev";
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
function createStudy({ root, storage = globalThis.localStorage, session = globalThis.sessionStorage, fetcher = (...a) => globalThis.fetch(...a), now = Date.now, owner = () => deviceSlot(storage), confirm = (m) => globalThis.confirm?.(m) ?? true, base = new URL("./", import.meta.url) } = {}) {
  let lang = chooseLang({ storage }), t = makeT(lang), bank = null, who = owner(), state = load(), saveFailed = false, ui = {};
  function load() {
    try {
      return readState(JSON.parse(storage.getItem(storeKey(who)) || "null"), { now: now() });
    } catch {
      return readState(null);
    }
  }
  function save() {
    try {
      storage.setItem(storeKey(who), JSON.stringify(state));
      saveFailed = false;
    } catch {
      saveFailed = true;
    }
  }
  const iso = () => new Date(now()).toISOString();
  const record = (o) => {
    state = addObs(state, o, { now: now() });
  };
  const setScene = (scene) => {
    state = { ...state, scene };
    ui = {};
    save();
    paint();
  };
  const item53 = (id2) => bank.open53.find((i) => i.id === id2) || null, form = (id2) => bank.forms.find((f) => f.id === id2), find = (id2) => bank.finds.find((f) => f.id === id2), card = (key) => bank.pool.find((c) => c.key === key);
  function syncOwner() {
    const n = owner();
    if (n !== who) {
      who = n;
      state = load();
      ui = {};
    }
  }
  const decide = () => next(state, bank, { now: now(), seed: Math.floor(now() / 6e4) });
  const ids = (list, has) => Array.isArray(list) && list.length > 0 && list.every((k) => typeof k === "string" && has(k));
  function sceneValid(sc) {
    if (!sc || typeof sc !== "object") return false;
    const i = sc.i ?? 0;
    if (!Number.isInteger(i) || i < 0) return false;
    if (sc.id === "write") return !!item53(sc.itemId) && [0, 1, 2].includes(sc.support) && ["edit", "self"].includes(sc.phase);
    if (sc.id === "seen") return !!item53(sc.itemId) && !!sc.facts && Number.isInteger(sc.facts.total);
    if (sc.id === "probe") return sc.probe === "distinguish" ? ids(sc.cards, card) && i < sc.cards.length : sc.probe === "form" ? ids(sc.forms, form) && i < sc.forms.length : false;
    if (sc.id === "method") {
      if (sc.method === "contrast") return ids(sc.cards, card) && i < sc.cards.length;
      if (sc.method === "forms") return ids(sc.forms, form) && i < sc.forms.length;
      return sc.method === "apply" && (sc.find == null || !!find(sc.find)) && [0, 1].includes(sc.step ?? 0);
    }
    return sc.id === "rest";
  }
  const toScene = (n) => n.scene === "write" ? { id: "write", itemId: n.itemId, support: n.support, phase: "edit" } : n.scene === "probe" ? { id: "probe", probe: n.probe, cards: n.cards || [], forms: n.forms || [], i: 0 } : n.scene === "method" ? { id: "method", method: n.method, cards: n.cards || [], forms: n.forms || [], find: n.find || null, mineFrom: n.mineFrom || null, step: 0, i: 0 } : { id: "rest", why: n.why };
  function shell(body) {
    return `<header class="st-top"><p class="st-brand">SYNK</p><h1>${esc(t("study.title"))}</h1><label class="st-lang"><span>${esc(t("study.lang"))}</span><select data-st-lang>${LANGS.map((l) => `<option value="${l}" ${l === lang ? "selected" : ""}>${esc(LANG_NAMES[l])}</option>`).join("")}</select></label></header>` + (saveFailed ? `<p class="st-alert" role="alert">${esc(t("study.saveFail"))}</p>` : "") + `<section class="st-scene" aria-live="polite">${body}</section><footer class="st-foot"><p>${esc(t("study.lead"))}</p><p>${esc(t("study.device"))}</p></footer>`;
  }
  const actions = (main, { stop = true } = {}) => `<div class="st-actions">${main}${stop ? `<button class="st-quiet" data-st-stop>${esc(t("study.stop"))}</button>` : ""}</div>`;
  const dataHtml = (data) => `<div class="st-data" lang="ko">${data.source ? `<p class="st-source">${esc(data.source)}</p>` : ""}${(data.tables || []).map((tb) => `<table><caption>${esc(tb.caption)}</caption><thead><tr>${tb.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${tb.rows.map((r) => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join("")}</tr>`).join("")}</tbody></table>`).join("")}${(data.lists || []).map((l) => `<div class="st-list"><strong>${esc(l.caption)}</strong><ul>${l.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  const formsTable = () => `<dl class="st-forms">${FORM_ROWS.map(([k, ko]) => `<div><dt>${esc(t(`writing.focus.method.${k}`))}</dt><dd lang="ko">${esc(ko)}</dd></div>`).join("")}</dl><p class="st-note">${esc(t("writing.focus.method.watch"))} <span lang="ko">많는다 · 증가하다.</span></p>`;
  function writeHtml(sc) {
    const it = item53(sc.itemId);
    if (!it) return restHtml({ why: "no-items" });
    const text = state.drafts[it.id]?.text || "";
    return `<h2 class="st-h">${esc(t("write.task"))}</h2>` + (sc.support === 2 ? `<div class="st-help"><p class="st-help-title">${esc(t("write.forms"))}</p>${formsTable()}</div>` : "") + `<div class="st-question" lang="ko"><p class="st-instruction"><b>53.</b> ${esc(it.instruction)}</p>${dataHtml(it.data)}</div><label class="st-label" for="st-text">${esc(t("write.label"))}</label><textarea id="st-text" lang="ko" rows="8" spellcheck="false" data-st-text>${esc(text)}</textarea><p class="st-note">${esc(t("writing.countNote"))}</p>` + (ui.short ? `<p class="st-alert" role="status">${esc(t("write.short"))}</p>` : "") + (sc.phase === "self" ? `<div class="st-help" data-st-self><p>${esc(t("self.q"))}</p></div>` + actions(`<button class="st-main" data-st-check>${esc(t("self.go"))}</button>`) : actions(`<button class="st-main" data-st-done>${esc(t("write.done"))}</button>`));
  }
  function seenHtml(sc) {
    const w = sc.facts, it = item53(sc.itemId), text = state.drafts[sc.itemId]?.text || "", n = decide();
    const off = sentencesOf(text).filter((s) => ["formal", "polite"].includes(endingOf(s.text))).map((s) => s.text);
    const label = { probe: "next.probe", method: "next.method", write: "next.write", rest: "next.rest" }[n.scene];
    const flagged = observeWrite(text)?.flagged || [];
    const line = w.off && w.flags ? `${t("writing.focus.found", { total: w.total, off: w.off })} ${t("seen.flags", { n: w.flags })}` : w.off ? t("writing.focus.found", { total: w.total, off: w.off }) : w.flags ? t("seen.flags", { n: w.flags }) : sc.support === 0 && !sc.same ? t("writing.focus.independent") : t("seen.helpedOk");
    return `<h2 class="st-h">${esc(t("seen.title"))}</h2>${it ? `<p class="st-sub" lang="ko">${esc(it.label)}</p>` : ""}<p class="st-fact">${esc(line)}</p><p class="st-count">${esc(t("writing.focus.counts", { plain: w.plain, total: w.total }))}</p>` + ([...off, ...flagged].length ? `<ul class="st-marks" lang="ko">${[...off, ...flagged].slice(0, 6).map((s) => `<li><mark>${esc(s)}</mark></li>`).join("")}</ul>` : "") + `<p class="st-note">${esc(t("writing.focus.limit"))}</p>` + actions(`<button class="st-main" data-st-next>${esc(t(label))} <span aria-hidden="true">→</span></button>`, { stop: n.scene !== "rest" });
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
    const done = sc.graded != null, [before, after2] = f.stem.split(f.target);
    return `<p class="st-note">${esc(lead)}</p><p class="st-progress">${esc(t("writing.focus.drill.count", { n: sc.i + 1, total: list.length }))}</p><p class="st-sentence" lang="ko">${esc(before)}<u>${esc(f.target)}</u>${esc(after2 ?? "")}</p><label class="st-label" for="st-form">${esc(t("form.input"))}</label><input id="st-form" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="40" data-st-form value="${esc(done ? sc.input : ui.input || "")}" ${done ? "readonly" : ""}>` + (done && !reveal ? `<p class="st-result" data-ok="${sc.graded}" role="status">${esc(t(sc.graded ? "writing.focus.drill.right" : "probe.formMiss"))}</p>` + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`) : done ? `<p class="st-result" data-ok="${sc.graded}" role="status">${esc(sc.graded ? t("writing.focus.drill.right") : t("form.answer"))} ${sc.graded ? "" : `<span lang="ko">${esc(f.answer)}</span>`}</p><p class="st-explain"><small>${esc(t("form.why"))}</small> <span lang="ko">${esc(f.explain)}</span></p>` + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`) : actions(`<button class="st-main" data-st-grade>${esc(t("form.check"))}</button>`));
  }
  function findHtml(f, sc) {
    const done = sc.found != null, picks = done ? sc.picks : ui.picks || [];
    return `<p class="st-note">${esc(t("find.lead"))}</p><ol class="st-find" lang="ko">${f.sentences.map((s, i) => `<li><button class="st-pickline" data-st-line="${i}" aria-pressed="${picks.includes(i)}" ${done ? "disabled" : ""} ${done && f.off.includes(i) ? 'data-answer="true"' : ""}>${esc(s)}${done && f.off.includes(i) ? ` <span class="st-tag" lang="${lang}">${esc(t("find.tag"))}</span>` : ""}</button></li>`).join("")}</ol>` + (done ? `<p class="st-result" data-ok="${sc.found}" role="status">${esc(t(sc.found ? "find.right" : "find.wrong"))}</p><p class="st-explain" lang="ko">${esc(f.explain)}</p>` + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`) : actions(`<button class="st-main" data-st-findcheck ${picks.length ? "" : "disabled"}>${esc(t("form.check"))}</button>`));
  }
  function mineHtml(sc) {
    const text = state.drafts[sc.mineFrom]?.text || "", o = observeWrite(text), list = [...o?.offSentences || sentencesOf(text).filter((s) => ["formal", "polite"].includes(endingOf(s.text))).map((s) => s.text), ...o?.flagged || []].slice(0, 3);
    if (!list.length) return null;
    return `<h2 class="st-h">${esc(t("writing.focus.mine.title").replace(/^[①-⑨]\s*/, ""))}</h2><p class="st-note">${esc(t("mine.lead"))}</p>` + list.map((s, i) => {
      const v = ui.mine?.[i] || "", r = checkChange(v);
      return `<div class="st-mine"><p lang="ko"><mark>${esc(s)}</mark></p><label class="st-label" for="st-mine-${i}">${esc(t("writing.focus.mine.label", { n: i + 1 }))}</label><input id="st-mine-${i}" lang="ko" type="text" autocomplete="off" spellcheck="false" maxlength="200" data-st-mine="${i}" value="${esc(v)}"><p class="st-mine-state" data-st-mine-state="${i}" data-ok="${r ? String(r.ok) : ""}">${r ? esc(mineMsg(r)) : ""}</p></div>`;
    }).join("") + actions(`<button class="st-main" data-st-advance>${esc(t("next.continue"))} <span aria-hidden="true">→</span></button>`);
  }
  const mineMsg = (r) => r.ok ? t("writing.focus.mine.ok") : r.why === "adj-neun" ? t("change.adj") : r.why === "dict" ? t("change.dict") : t("writing.focus.mine.not");
  function probeHtml(sc) {
    return sc.probe === "distinguish" ? sortHtml(sc, sc.cards, { lead: t("writing.focus.drill.lead") }) : formHtml(sc, sc.forms, { lead: t("probe.formLead"), reveal: false });
  }
  function methodHtml(sc) {
    if (sc.method === "contrast") {
      const ex = ["formal", "polite", "plain"].map((b) => bank.pool.find((c) => c.bin === b && !sc.cards.includes(c.key))).filter(Boolean);
      const intro = sc.i === 0 && !sc.pick ? `<p class="st-lead">${esc(t("method.contrast"))}</p><p class="st-note">${esc(t("method.examples"))}</p><dl class="st-examples">${ex.map((c) => `<div><dt>${esc(t(`writing.focus.bin.${c.bin}`))}</dt><dd lang="ko">${esc(c.text)}</dd></div>`).join("")}</dl>` : "";
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
    const key = { done: "rest.done", "no-items": "rest.noItems", "tried-all": "rest.triedAll", "alone-once": "rest.alone" }[sc.why] || "study.stopped";
    return `<p class="st-fact">${esc(t(key))}</p>`;
  }
  function resumeHtml() {
    return `<h2 class="st-h">${esc(t("resume.title"))}</h2><p class="st-note">${esc(t("resume.note"))}</p>` + actions(`<button class="st-main" data-st-resume>${esc(t("study.resumeHere"))} <span aria-hidden="true">→</span></button><button class="st-plain" data-st-fresh>${esc(t("resume.fresh"))}</button>`, { stop: false });
  }
  function paint(focus = true) {
    syncOwner();
    const sc = state.scene;
    let body;
    if (ui.stopped) body = `<p class="st-fact">${esc(t("study.stopped"))}</p>` + actions(`<button class="st-main" data-st-unstop>${esc(t("study.resumeHere"))} <span aria-hidden="true">→</span></button>`, { stop: false });
    else if (ui.resume) body = resumeHtml();
    else body = sc.id === "write" ? writeHtml(sc) : sc.id === "seen" ? seenHtml(sc) : sc.id === "probe" ? probeHtml(sc) : sc.id === "method" ? methodHtml(sc) : restHtml(sc);
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
    setScene(toScene(decide()));
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
    const sc = state.scene, d = state.drafts[sc.itemId] || { text: "" }, o = observeWrite(d.text);
    if (!o) {
      ui.short = true;
      paint(false);
      root.querySelector("[data-st-text]")?.focus();
      return;
    }
    const same = !!d.checkedAt;
    record({ kind: "write", itemId: sc.itemId, support: sc.support, same, plain: o.plain, off: o.off, total: o.total, formal: o.formal, polite: o.polite, flags: o.flags, axes: o.axes });
    state = { ...markSeen(state, [sc.itemId], { now: now() }), drafts: { ...state.drafts, [sc.itemId]: { ...d, checkedAt: iso() } } };
    setScene({ id: "seen", itemId: sc.itemId, support: sc.support, same, facts: { plain: o.plain, off: o.off, total: o.total, flags: o.flags } });
  }
  function onClick(ev) {
    const b = ev.target.closest("button");
    if (!b || !root.contains(b) || b.disabled) return;
    const sc = state.scene;
    if (b.hasAttribute("data-st-stop")) {
      save();
      ui = { stopped: true };
      paint();
      return;
    }
    if (b.hasAttribute("data-st-unstop")) {
      ui = {};
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
      let slot = null;
      try {
        for (let n = 0; n < 20 && !slot; n++) {
          const c = `guest-${(now() + n).toString(36)}`;
          if (storage.getItem(storeKey(c)) == null) slot = c;
        }
        if (slot) {
          storage.setItem(SLOT_KEY, slot);
          if (storage.getItem(SLOT_KEY) !== slot) slot = null;
        }
      } catch {
        slot = null;
      }
      if (!slot || deviceSlot(storage) !== slot) {
        saveFailed = true;
        ui = { resume: true };
        paint();
        return;
      }
      who = slot;
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
      const d = state.drafts[sc.itemId];
      if (!observeWrite(d?.text || "")) {
        ui.short = true;
        paint(false);
        root.querySelector("[data-st-text]")?.focus();
        return;
      }
      if (sc.support === 1) {
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
      record({ kind: "sort", card: c.key, bin: c.bin, ok: c.bin === pick, use: sc.id === "probe" ? "check" : "learn" });
      state = { ...state, scene: { ...sc, pick }, recentCards: [...state.recentCards, c.key].slice(-12) };
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
      record({ kind: "form", id: f.id, axis: f.axis, use: f.use, ok: g });
      state = { ...markSeen(state, [f.id], { now: now() }), scene: { ...sc, graded: g, input: String(ui.input).slice(0, 40) } };
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
      state = { ...state, drafts: { ...state.drafts, [sc.itemId]: { ...state.drafts[sc.itemId] || { checkedAt: null }, text: el.value.slice(0, 4e3), updatedAt: iso() } } };
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
        out.dataset.ok = r ? String(r.ok) : "";
        out.textContent = r ? mineMsg(r) : "";
      }
      return;
    }
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
    try {
      const get = async (name) => {
        const r = await fetcher(new URL(`${name}?v=${TOKEN}`, base), { cache: "no-cache" });
        if (!r.ok) throw Error(name);
        return r.json();
      };
      const [items, study] = await Promise.all([get("items.json"), get("study.json")]);
      const open = (items.items || []).filter((i) => i?.review?.status === "passed"), content = (study.items || []).filter((i) => i?.review?.status === "passed");
      bank = { open53: open.filter((i) => i.type === 53), pool: drillPool(open), forms: content.filter((i) => i.type === "study-form"), finds: content.filter((i) => i.type === "study-find") };
      if (!bank.open53.length) throw Error("EMPTY");
    } catch {
      root.querySelector(".st-scene").innerHTML = `<p class="st-alert" role="alert">${esc(t("writing.loadError"))}</p>`;
      return;
    }
    document.title = `${t("study.title")} · SYNK`;
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
      state = { ...state, scene: toScene(decide()) };
      save();
      ui = keep;
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
