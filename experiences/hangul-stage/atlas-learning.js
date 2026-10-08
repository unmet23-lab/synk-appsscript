// Generated from atlas/, strata/ and experiences/hangul-stage/learning-entry.cjs. Change those sources; run tools/build-hangul-stage.js.
"use strict";
var SynkLearning = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // strata/index.js
  var require_strata = __commonJS({
    "strata/index.js"(exports, module) {
      "use strict";
      var CONFIDENCE = ["authored", "measured", "ai_draft"];
      var KINDS = ["skill", "grammar_point", "expression", "situation", "letter", "syllable", "concept", "topic", "task", "word"];
      var TYPES = ["part_of", "prerequisite", "contrasts_with"];
      var copy = (value) => JSON.parse(JSON.stringify(value));
      var fail = (message) => {
        throw new TypeError(`Strata: ${message}`);
      };
      var text = (value) => typeof value === "string" && value.length > 0;
      var compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
      function freeze(value) {
        if (value && typeof value === "object") {
          Object.values(value).forEach(freeze);
          Object.freeze(value);
        }
        return value;
      }
      function validateMap(data) {
        if (!data || !text(data.map_ver) || !text(data.subject) || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.links?.tags) || !Array.isArray(data.tag_vocabulary) || !data.sources || typeof data.sources !== "object") fail("invalid map envelope");
        const ids = /* @__PURE__ */ new Map();
        const refs = (item) => {
          if (!Array.isArray(item.source_refs) || !item.source_refs.length) fail("source references required");
          for (const ref of item.source_refs) {
            if (!ref || !Object.hasOwn(data.sources, ref.source) || !text(ref.selector)) fail("unknown source reference");
          }
        };
        const confidence = (item) => {
          if (!CONFIDENCE.includes(item.confidence) || typeof item.reviewed !== "boolean") fail("invalid evidence status");
          refs(item);
        };
        for (const [key, source] of Object.entries(data.sources)) {
          if (!text(key) || !text(source.path) || !/^[a-f0-9]{64}$/.test(source.sha256)) fail("invalid source hash");
        }
        for (const node of data.nodes) {
          if (!text(node.id) || ids.has(node.id) || !KINDS.includes(node.kind) || !text(node.label_ko)) fail("invalid or duplicate node");
          if (node.level !== null && (!Number.isInteger(node.level?.intro) || node.level.intro < 1 || node.level.intro > 6 || !text(node.level.basis))) fail("invalid level");
          if (node.when_ko !== void 0 && (node.kind !== "situation" || !text(node.when_ko))) fail("invalid situation words");
          refs(node);
          ids.set(node.id, node);
        }
        const uniqueEdges = /* @__PURE__ */ new Set(), next = /* @__PURE__ */ new Map();
        for (const edge of data.edges) {
          if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || !TYPES.includes(edge.type)) fail("invalid edge endpoint or type");
          confidence(edge);
          const key = `${edge.type}\0${edge.from}\0${edge.to}`;
          if (uniqueEdges.has(key)) fail("duplicate edge");
          uniqueEdges.add(key);
          if (edge.type === "part_of" && (ids.get(edge.from).kind !== "grammar_point" || ids.get(edge.to).kind !== "skill")) fail("invalid grammar membership");
          if (edge.type === "prerequisite") {
            const before = ids.get(edge.from).level?.intro, after = ids.get(edge.to).level?.intro;
            if (before != null && after != null && before > after) fail("prerequisite level inversion");
            if (!next.has(edge.from)) next.set(edge.from, []);
            next.get(edge.from).push(edge.to);
          }
        }
        const visiting = /* @__PURE__ */ new Set(), visited = /* @__PURE__ */ new Set();
        function visit(id) {
          if (visiting.has(id)) fail("prerequisite cycle");
          if (visited.has(id)) return;
          visiting.add(id);
          (next.get(id) || []).forEach(visit);
          visiting.delete(id);
          visited.add(id);
        }
        for (const id of ids.keys()) visit(id);
        const tags = /* @__PURE__ */ new Set();
        if (new Set(data.tag_vocabulary).size !== data.tag_vocabulary.length || data.tag_vocabulary.some((tag) => !text(tag))) fail("invalid tag vocabulary");
        for (const link of data.links.tags) {
          if (!data.tag_vocabulary.includes(link.tag) || tags.has(link.tag)) fail("invalid or duplicate tag");
          if (!["full", "none"].includes(link.fit) || (link.fit === "none" ? link.node !== null : !ids.has(link.node))) fail("tag must be exactly mapped or explicitly missing");
          if (link.fit === "full" && ids.get(link.node).kind !== "skill") fail("tag must reference a skill");
          confidence(link);
          tags.add(link.tag);
        }
        if (tags.size !== data.tag_vocabulary.length) fail("incomplete tag partition");
        if (data.links.goals !== void 0) {
          if (!Array.isArray(data.links.goals)) fail("invalid goal links");
          const goals = /* @__PURE__ */ new Set();
          for (const link of data.links.goals) {
            if (!text(link?.goal) || goals.has(link.goal)) fail("invalid or duplicate goal");
            if (!Array.isArray(link.nodes) || !link.nodes.length || new Set(link.nodes).size !== link.nodes.length || link.nodes.some((id) => !ids.has(id))) fail("goal must lead to known nodes");
            confidence(link);
            goals.add(link.goal);
          }
        }
        return true;
      }
      function createMap(input) {
        validateMap(input);
        const data = freeze(copy(input));
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
          const skill = getNode(id);
          if (skill?.kind !== "skill") return null;
          const edges = data.edges.filter((edge) => edge.type === "part_of" && edge.to === id);
          const grammar = edges.map((edge) => getNode(edge.from));
          const refs = [...skill.source_refs, ...grammar.flatMap((node) => node.source_refs), ...edges.flatMap((edge) => edge.source_refs)];
          const sources = [...new Map(refs.map((ref) => [`${ref.source}\0${ref.selector}`, ref])).values()];
          return freeze({ skill, grammar, level: skill.level, sources });
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
          if (!Array.isArray(state.lines) || !Number.isInteger(limit) || limit < 0 || limit > 100) fail("invalid candidate input");
          if (state.mastered != null && (!Array.isArray(state.mastered) || state.mastered.some((id) => !text(id)))) fail("invalid mastered nodes");
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
          } catch (error) {
            broken = true;
            throw error;
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
        const topic = `${label}${particle(label, "은", "는")}`, object = `${label}${particle(label, "을", "를")}`;
        const reasons = {
          unseen: `${topic} 아직 기록이 적어요. 짧게 확인해 봐요.`,
          checking: `${object} 조금 더 확인해 봐요.`,
          practice: `최근 놓친 ${object} 조금 더 연습해 봐요.`,
          supported: `${object} 도움과 함께 해냈어요. 이어서 살펴봐요.`,
          "recent-independent": `${object} 최근 혼자 해냈어요. 가볍게 이어가요.`,
          review: `${object} 다시 살펴볼 때예요.`
        };
        if (!Object.hasOwn(reasons, status)) throw new TypeError("Vellum: invalid learning reason");
        return reasons[status];
      }
      function situationLine({ when }) {
        if (typeof when !== "string" || !when.trim()) throw new TypeError("Vellum: invalid situation line");
        return `${when} 쓰는 말이라 골랐어요.`;
      }
      module.exports = { SUPPORTS, STUCK, reviewOpen, offerCue, learningReason, situationLine };
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
          const rows = Array.isArray(input) ? input : [input];
          const seen = /* @__PURE__ */ new Set();
          for (const row of rows) {
            if (!row || row.version !== TRAIL || !row.scope || !Array.isArray(row.attempts) || !Array.isArray(row.presentations) || !Array.isArray(row.help)) throw new TypeError("Temper: use a Trail practice summary");
            const key = scopeKey(row.scope);
            if (seen.has(key)) throw new TypeError("Temper: duplicate scope would double-count evidence");
            seen.add(key);
          }
          return rows;
        }
        const bucket = () => ({ evaluated: 0, correct: 0, incorrect: 0, accuracy: null });
        const close = (b) => {
          if (b.evaluated) b.accuracy = b.correct / b.evaluated;
          return b;
        };
        const counted = (a) => a.independent === true && !a.exclusionReason && a.assisted === false && a.exposure === "new" && ["correct", "incorrect"].includes(a.verdict) && (!a.measure || !a.measure.confounded && (!a.measure.audioRequired || a.audio === "completed"));
        function measure(input) {
          const rows = summaries(input);
          const result = {
            scopes: rows.length,
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
          for (const row of rows) {
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
          const tasks = (rows) => new Map(rows.map((row) => [scopeKey(row.scope), row.presentations.map(taskKey).sort()]));
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
        function groups({ rows, labels, arms, minimum = MINIMUM_PER_CELL, tolerance = 0 } = {}) {
          const input = summaries(rows);
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
      var own = (table, key) => Object.prototype.hasOwnProperty.call(table, key);
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
        const bits = ledger && own(ledger.keys, traceKey) ? ledger.keys[traceKey] : 0;
        return kinds.some((kind) => bits & BITS[kind]);
      };
      var helpedAt = (h) => Array.isArray(h) ? h[1] : h;
      function rows(cell) {
        if (!cell) return { rows: [], unassessed: 0 };
        const iso = (ms) => new Date(ms).toISOString();
        return { unassessed: cell.unassessed, rows: [
          ...cell.ind.map(([eventId, at, verdict, familyKey]) => ({ eventId, at: iso(at), verdict, independent: true, assisted: false, exclusionReason: null, measure: { familyKey } })),
          ...cell.helped.map((h) => ({ eventId: Array.isArray(h) ? h[0] : null, at: iso(helpedAt(h)), verdict: "correct", independent: false, assisted: true, exclusionReason: null, measure: { familyKey: null } }))
        ] };
      }
      var cellOf = (ledger, key) => ledger && own(ledger.cells, key) ? ledger.cells[key] : null;
      var contentOf = (ledger, key) => ledger && own(ledger.content, key) ? ledger.content[key] : null;
      function fold(previous, events, { scope, log = events, local = false }) {
        const base = previous || empty();
        const ledger = { ...base, keys: { ...base.keys }, cells: { ...base.cells }, content: { ...base.content } };
        if (!events.length) return ledger;
        const time = (e) => Math.max(Date.parse(e.at), Date.parse(e.recordedAt));
        const latest = log.reduce((max, e) => Math.max(max, time(e)), -Infinity);
        const decisions = events.filter((e) => e.type === "decision.made").map((e) => e.id);
        const summary = Trail.summarize(log, { scope, asOf: new Date(latest).toISOString(), prior: previous, decisions });
        const presented = new Map(events.filter((e) => e.type === "practice.presented").map((e) => [e.id, e]));
        for (const e of events) {
          if (e.type !== "practice.helped" && e.type !== "practice.attempted") continue;
          const p = presented.get(e.presentationId);
          if (!p) continue;
          const bit = e.type === "practice.attempted" ? BITS.attempt : e.level === "answer" ? BITS.answer : BITS.help;
          for (const k of Trail.traceKeys(p)) ledger.keys[k] = (own(ledger.keys, k) ? ledger.keys[k] : 0) | bit;
        }
        const shown = new Map(ledger.presented.map(([task, item, family, n]) => [JSON.stringify([task, item, family]), n]));
        for (const p of summary.presentations) {
          const key = JSON.stringify([p.taskId, p.itemKey, p.measure?.familyKey || p.itemKey]);
          shown.set(key, (shown.get(key) || 0) + 1);
        }
        ledger.presented = [...shown].map(([key, n]) => [...JSON.parse(key), n]).sort((a, b) => a.join("\0") < b.join("\0") ? -1 : 1);
        const touched = /* @__PURE__ */ new Set();
        const add = (table, key, a) => {
          const cell = own(table, key) ? touched.has(table[key]) ? table[key] : { ind: [...table[key].ind], helped: [...table[key].helped], unassessed: table[key].unassessed } : { ind: [], helped: [], unassessed: 0 };
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
        ledger.cutoff = Math.max(ledger.cutoff ?? -Infinity, events.reduce((max, e) => Math.max(max, time(e)), -Infinity));
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
      module.exports = { VERSION, BITS, FOLDABLE, empty, validate, before, rows, cellOf, contentOf, fold, plan, folded, stray, compare, demote };
    }
  });

  // atlas/learning.js
  var require_learning = __commonJS({
    "atlas/learning.js"(exports, module) {
      "use strict";
      var POLICY = Object.freeze({ version: "learning-priority-3", recentDays: 30, reviewDays: 7, sample: 4, stableRatio: 0.8 });
      var RESPONSE_FORMATS = Object.freeze(["binary-choice", "single-choice", "cup-compose", "action", "unknown"]);
      var { learningReason } = require_vellum();
      var Ledger = require_learning_ledger();
      var DAY = 864e5;
      function formatEvidence(rows, { now, complete, difficulty, responseFormat, base = null }) {
        if (base) rows = [...base.rows, ...rows];
        const unique = /* @__PURE__ */ new Map();
        for (const a of rows) if (complete && a.independent && !unique.has(a.measure.familyKey)) unique.set(a.measure.familyKey, a);
        const valid = [...unique.values()].filter((a) => Date.parse(a.at) <= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
        const recent = valid.filter((a) => now - Date.parse(a.at) <= POLICY.recentDays * DAY).slice(-12);
        const n = recent.length, correct = recent.filter((a) => a.verdict === "correct").length, incorrect = n - correct;
        const lastAt = valid.at(-1)?.at || null;
        const helped = rows.filter((a) => !a.exclusionReason && a.assisted === true && a.verdict === "correct" && Date.parse(a.at) <= now && now - Date.parse(a.at) <= POLICY.recentDays * DAY);
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
          unassessed: rows.filter((a) => a.verdict === "unassessed" || a.verdict === "skipped").length + (base?.unassessed || 0)
        };
      }
      function summarizeLearning({ summary, map, complete = true, prior = null }) {
        const now = Date.parse(summary.asOf);
        const skills = map.allNodes().filter((n) => n.kind === "skill").map((node) => {
          const all = summary.attempts.filter((a) => a.measure?.skillId === node.id);
          const levels = {};
          for (const difficulty of [1, 2, 3]) {
            const rows = all.filter((a) => a.measure.difficulty === difficulty);
            const formats = Object.fromEntries(RESPONSE_FORMATS.map((responseFormat) => {
              const cell = Ledger.cellOf(prior, `${node.id}|${difficulty}|${responseFormat}`);
              return [responseFormat, formatEvidence(
                rows.filter((a) => (a.measure.responseFormat || "unknown") === responseFormat),
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
      function recommend({ profile, candidates, presentations = [], audioAvailable = true, excludeIds = [], prior = null }) {
        if (!Array.isArray(candidates)) throw new TypeError("Core: candidates must be an array");
        const ids = /* @__PURE__ */ new Set(), skills = new Map(profile.skills.map((s) => [s.id, s]));
        const content = new Map((profile.concepts || []).map((c) => [c.id, c.status]));
        const history = { task: /* @__PURE__ */ new Map(), item: /* @__PURE__ */ new Map(), family: /* @__PURE__ */ new Map() };
        for (const [index, presentation] of presentations.entries()) {
          for (const [kind, key] of [
            ["task", presentation.taskId],
            ["item", presentation.itemKey],
            ["family", presentation.measure?.familyKey || presentation.itemKey]
          ]) {
            if (!key) continue;
            if (!history[kind].has(key)) history[kind].set(key, []);
            history[kind].get(key).push(index);
          }
        }
        const weight = /* @__PURE__ */ new Map();
        for (const [i, [task, item, family, n]] of (prior?.presented || []).entries()) {
          const ref = `folded:${i}`;
          weight.set(ref, n);
          for (const [kind, key] of [["task", task], ["item", item], ["family", family]]) {
            if (!key) continue;
            if (!history[kind].has(key)) history[kind].set(key, []);
            history[kind].get(key).push(ref);
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
            ...history.task.get(candidate.id) || [],
            ...history.item.get(candidate.itemKey) || [],
            ...history.family.get(candidate.familyKey || candidate.itemKey) || []
          ]);
          const immediate = [...previous].some((index) => typeof index === "number" && index >= presentations.length - 4);
          const count = [...previous].reduce((n, index) => n + (weight.get(index) || 1), 0);
          const readyForHarder = candidate.difficulty === 1 || candidate.skillIds.every((id) => skills.get(id).levels[candidate.difficulty - 1].formats[responseFormat].status === "recent-independent");
          if (candidate.conceptIds != null && (!Array.isArray(candidate.conceptIds) || candidate.conceptIds.some((id) => typeof id !== "string"))) throw new TypeError("Core: invalid learning candidate");
          if (candidate.familyKeys != null && (!Array.isArray(candidate.familyKeys) || !candidate.familyKeys.length || candidate.familyKeys.length > 500 || candidate.familyKeys.some((key) => typeof key !== "string"))) throw new TypeError("Core: invalid learning candidate");
          const lift = Math.max(0, ...(candidate.conceptIds || []).map((id) => CONTENT_LIFT[content.get(id)] || 0));
          const exhausted = !!candidate.familyKeys && candidate.familyKeys.every((key) => history.family.has(key));
          const score = focus.priority - (immediate ? 0.45 : 0) - (previous.size ? 0.1 : 0) - (!readyForHarder ? 0.25 * (candidate.difficulty - 1) : 0) - (exhausted ? 0.5 : 0);
          ranked.push({ candidate, focus, score, lift, count });
        }
        ranked.sort((a, b) => b.score - a.score || b.lift - a.lift || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));
        if (!ranked.length) return { status: "unavailable", selected: null, reason: "지금 조건에 맞는 연습이 없어요.", alternatives: [] };
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
      var CONTENT = Object.freeze(["word", "grammar_point"]);
      function summarizeConcepts({ summary, map, complete = true, prior = null }) {
        const now = Date.parse(summary.asOf), rows = /* @__PURE__ */ new Map();
        for (const key of Object.keys(prior?.content || {})) {
          const id = key.slice(0, key.lastIndexOf("|")), node = map.getNode(id);
          if (node && CONTENT.includes(node.kind) && !rows.has(id)) rows.set(id, { node, list: [] });
        }
        for (const a of summary.attempts) {
          if (!a.measure) continue;
          for (const id of a.conceptIds) {
            if (id === a.measure.skillId) continue;
            const node = map.getNode(id);
            if (!node || !CONTENT.includes(node.kind)) continue;
            if (!rows.has(id)) rows.set(id, { node, list: [] });
            rows.get(id).list.push(a);
          }
        }
        return [...rows.values()].map(({ node, list }) => {
          const formats = {};
          for (const responseFormat of RESPONSE_FORMATS) {
            const own = list.filter((a) => (a.measure.responseFormat || "unknown") === responseFormat);
            const cell = Ledger.contentOf(prior, `${node.id}|${responseFormat}`);
            if (own.length || cell) formats[responseFormat] = formatEvidence(own, { now, complete, difficulty: null, responseFormat, base: cell ? Ledger.rows(cell) : null });
          }
          const focus = Object.values(formats).sort((a, b) => b.priority - a.priority)[0];
          return { id: node.id, kind: node.kind, label: node.label_ko, status: focus.status, priority: focus.priority, formats };
        }).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
      }
      module.exports = { POLICY, RESPONSE_FORMATS, CONTENT, summarizeLearning, summarizeConcepts, recommend, formatEvidence };
    }
  });

  // atlas/learning-sync.js
  var require_learning_sync = __commonJS({
    "atlas/learning-sync.js"(exports, module) {
      "use strict";
      var SYNC_KEY = "synk.atlas.learning-sync.v1";
      var id = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
      var clone = (value) => JSON.parse(JSON.stringify(value));
      var canonical = (value) => JSON.stringify(value, function(_key, entry) {
        return entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry;
      });
      var sameEvent = (a, b) => canonical(a) === canonical(b);
      var failure = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
      var errorCode = (error) => error?.code || error?.error?.code || error?.body?.error?.code || "NETWORK_ERROR";
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
        const block = (error) => {
          generation++;
          clearTimeout(timer);
          timer = null;
          for (const controller of controllers) controller.abort();
          phase = "blocked";
          code = errorCode(error);
          message = error?.message || code;
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
        } catch (error) {
          block(error?.code ? error : failure("STORAGE_ERROR", "Atlas sync: unreadable outbox; preserved without replacement"));
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
          } catch (error) {
            block(error);
          }
        });
        if (phase !== "blocked") {
          try {
            collect();
          } catch (error) {
            block(error);
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
            } catch (error) {
              last = error;
              if (!active(token) || FATAL.has(errorCode(error))) throw error;
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
            } catch (error) {
              throw failure(error?.code || "INVALID_EVENTS", error.message);
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
              } catch (error) {
                throw failure(error?.code || "INVALID_EVENTS", error.message);
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
            const events = state.pending.slice(0, batchSize).map((eventId) => clone(local.get(eventId))), sent = new Set(events.map((event) => event.id));
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
            } catch (error) {
              if (active(token)) {
                if (FATAL.has(errorCode(error))) block(error);
                else {
                  phase = "offline";
                  code = errorCode(error);
                  message = error?.message || code;
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
      var object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
      var instant = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
      var failure = (code, message) => Object.assign(new Error(message), { code });
      var errorCode = (error) => error?.code || error?.error?.code || error?.body?.error?.code || "NETWORK_ERROR";
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
        if (object(state?.presentation)) out.push({ kind: "presentation", key: "chosen", value: state.presentation.value ?? null, at: state.presentation.at });
        for (const [key, memory] of Object.entries(object(state?.flow) ? state.flow : {})) out.push({ kind: "flow", key, value: memory, at: memory?.at });
        for (const [key, at] of Object.entries(object(state?.declined) ? state.declined : {})) out.push({ kind: "declined", key, value: null, at });
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
        if (entry.kind === "presentation") return entry.key === "chosen" && (entry.value === null || object(entry.value));
        if (entry.kind === "declined") return entry.value === null;
        return object(entry.value) && entry.value.content === entry.key && Date.parse(entry.value.at) === Date.parse(entry.at) && JSON.stringify(entry.value).length <= MAX_BYTES;
      }
      var received = (entry) => object(entry) && KINDS.includes(entry.kind) && ID.test(entry.key || "") && instant(entry.at) && (entry.kind === "flow" ? object(entry.value) : entry.kind === "declined" ? entry.value === null : entry.value === null || object(entry.value));
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
            } catch (error) {
              if (active(token)) {
                code = errorCode(error);
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
        function check({ spec, knob, from, to, step, phase = "response", history = [], frozen = false } = {}) {
          if (frozen) return { ok: false, rail: "hold" };
          const k = spec?.knobs?.find((x) => x.id === knob);
          if (!k) return { ok: false, rail: "unknown-knob" };
          if (!Number.isInteger(from) || !Number.isInteger(to) || Math.abs(to - from) !== 1) return { ok: false, rail: "one-step" };
          if (to < 0 || to >= k.values.length) return { ok: false, rail: "bounds" };
          if (k.follows === "declared") return { ok: false, rail: "declared-only" };
          if (!["opening", "response", "accepted"].includes(phase) || !Number.isInteger(step) || !Array.isArray(history)) return { ok: false, rail: "invalid" };
          if (phase !== "opening") {
            const live = history.filter((c) => c.phase !== "opening");
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
          { id: "new-careful", label: "처음이라 천천히, 그러나 정확하게", content: -0.3, speed: -1.4, slip: 0.03, growth: 0.03, assist: 0.2 },
          { id: "quick-slips", label: "빠르지만 실수가 잦은", content: 0, speed: 1.6, slip: 0.12, growth: 0.02, assist: 0.05 },
          { id: "experienced", label: "이미 익숙한", content: 2.2, speed: 1.2, slip: 0.03, growth: 0.01, assist: 0 },
          { id: "steady-growth", label: "하면서 빠르게 느는", content: -1.5, speed: -0.2, slip: 0.05, growth: 0.08, assist: 0.2 },
          { id: "knows-but-rushed", label: "내용은 알지만 시간에 쫓기는", content: 1.4, speed: -1.8, slip: 0.03, growth: 0.01, assist: 0.05 },
          { id: "returning", label: "오랜만에 다시 온", content: 1, speed: 0.4, slip: 0.05, growth: 0.02, assist: 0.1, pause: { at: 30, days: 30, forget: 1 } },
          { id: "struggling", label: "지금은 많이 어려운", content: -2.4, speed: -0.8, slip: 0.06, growth: 0.03, assist: 0.5 }
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
          const rows = [];
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
            rows.push({ step, outcome, assisted, truth: chance.success, indices: before.indices, change });
            if (success && !assisted) {
              self.content += self.growth;
              self.speed += self.growth / 2;
            }
            at += 2e4;
          }
          return { rows, final: flow.settings() };
        }
        function metrics(spec, rows, target) {
          const half = rows.slice(Math.floor(rows.length / 2));
          const off = (row) => Math.abs(row.truth - target);
          const adjustable = spec.knobs.filter((knob) => knob.follows !== "declared");
          const dimensions = [adjustable.filter((k) => k.kind !== "pace"), adjustable.filter((k) => k.kind === "pace")].filter((list) => list.length);
          const atFloor = (row) => dimensions.some((list) => list.every((k) => row.indices[k.id] === 0));
          const runLength = (test) => {
            let best = 0, current = 0;
            for (const row of rows) {
              current = test(row) ? current + 1 : 0;
              best = Math.max(best, current);
            }
            return best;
          };
          let settleAt = null;
          for (let i = 0; i + 5 < rows.length && settleAt === null; i += 1) if (rows.slice(i, i + 6).every((row) => off(row) <= 0.2)) settleAt = rows[i].step;
          const changes = rows.map((row) => row.change).filter(Boolean);
          let bounces = 0, undone = 0;
          for (let i = 2; i < rows.length; i += 1) {
            const a = rows[i - 2].change, b = rows[i].change || rows[i - 1].change;
            if (a && b && a !== b && a.knob === b.knob && a.direction === -b.direction) bounces += 1;
          }
          rows.forEach((row, i) => {
            const c = row.change;
            if (c && c.direction < 0 && row.outcome === "success" && rows.slice(Math.max(0, i - 2), i).some((r) => r.change?.knob === c.knob && r.change.direction > 0)) undone += 1;
          });
          return {
            inBand: Math.round(half.filter((row) => off(row) <= 0.15).length / half.length * 100) / 100,
            meanError: Math.round(half.reduce((sum, row) => sum + off(row), 0) / half.length * 1e3) / 1e3,
            successRate: Math.round(rows.filter((row) => row.outcome === "success").length / rows.length * 100) / 100,
            timeouts: rows.filter((row) => row.outcome === "timeout").length,
            settleAt,
            changes: changes.length,
            bounces,
            undone,
            maxJump: changes.reduce((max, c) => Math.max(max, Math.abs(c.to - c.from)), 0),
            helpRaises: rows.filter((row) => row.assisted && row.outcome === "success" && row.change?.direction > 0).length,
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
            note: "가상 사람으로 구현과 규칙을 확인한 결과다. 실제 사람의 학습 효과·만족·성과의 증거가 아니다."
          };
        }
        return Object.freeze({ VERSION, FLIP_WINDOW, COOL_DOWN, PERSONAS, check, truth, simulate });
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
        const copy = (value) => JSON.parse(JSON.stringify(value));
        const id = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
        const scalar = (value) => ["number", "string", "boolean"].includes(typeof value) && (typeof value !== "number" || Number.isFinite(value));
        const within = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
        const sigmoid = (x) => 1 / (1 + Math.exp(-x));
        const logit = (p) => Math.log(p / (1 - p));
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
        const time = (value) => {
          const n = Date.parse(value);
          if (typeof value !== "string" || !Number.isFinite(n)) throw new TypeError("Flow: invalid time");
          return n;
        };
        const fail = (message) => {
          throw new TypeError(`Flow: ${message}`);
        };
        const dimensionOf = (knob) => knob.kind === "pace" ? "pace" : "content";
        const defined = /* @__PURE__ */ new WeakSet();
        function defineContent(input) {
          if (defined.has(input)) return input;
          if (!input || typeof input !== "object" || Array.isArray(input)) fail("content spec required");
          if (Object.keys(input).some((key) => !["id", "version", "target", "scale", "knobs", "items"].includes(key))) fail("unknown spec field");
          const spec = { id: input.id, version: input.version ?? 1, target: input.target ?? 0.75, scale: input.scale ?? 0.5, knobs: [], items: null };
          if (!id(spec.id) || !Number.isInteger(spec.version) || spec.version < 1) fail("invalid content id or version");
          if (!within(spec.target, 0.55, 0.9) || !within(spec.scale, 0.2, 1.5)) fail("target must be 0.55-0.9 and scale 0.2-1.5");
          const knobs = input.knobs ?? [];
          if (!Array.isArray(knobs) || knobs.length > 8 || !knobs.length && !input.items) fail("one to eight knobs required");
          const seen = /* @__PURE__ */ new Set([ITEM]);
          if (input.items != null) {
            const items = input.items;
            if (!items || typeof items !== "object" || Object.keys(items).some((key) => !["levels", "weight", "start"].includes(key))) fail("invalid item levels");
            const levels = items.levels ?? [1, 2, 3], start2 = items.start ?? 0, weight = items.weight ?? 2;
            if (!Array.isArray(levels) || levels.length < 2 || levels.length > 6 || !levels.every((level, index) => Number.isInteger(level) && (index === 0 || level > levels[index - 1])) || !Number.isInteger(start2) || start2 < 0 || start2 >= levels.length || !within(weight, 0.25, 4)) fail("invalid item levels");
            spec.items = { levels: [...levels], weight, start: start2 };
            spec.knobs.push({ id: ITEM, values: [...levels], start: start2, weight, kind: "content", follows: null, label: "item difficulty" });
          }
          for (const knob of knobs) {
            const keys = ["id", "values", "start", "weight", "kind", "follows", "label"];
            if (!knob || typeof knob !== "object" || Object.keys(knob).some((key) => !keys.includes(key))) fail("invalid knob");
            const value = { id: knob.id, values: knob.values, start: knob.start ?? 0, weight: knob.weight ?? 1, kind: knob.kind ?? "content", follows: knob.follows ?? null, label: knob.label ?? knob.id };
            if (!id(value.id) || seen.has(value.id) || !Array.isArray(value.values) || value.values.length < 2 || value.values.length > 12 || !value.values.every(scalar) || !Number.isInteger(value.start) || value.start < 0 || value.start >= value.values.length || !within(value.weight, 0.25, 4) || !KINDS.includes(value.kind) || ![null, "declared"].includes(value.follows) || typeof value.label !== "string" || value.label.length > 60) fail(`invalid knob ${knob && knob.id}`);
            seen.add(value.id);
            spec.knobs.push(value);
          }
          const result = Object.freeze(copy(spec));
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
          return { estimates: copy(memory.estimates), at: memory.at, indices, latencies: [...memory.latencies] };
        }
        function priorFromSummary(input, summary, skillIds = []) {
          const spec = defineContent(input);
          if (!spec.items || !summary || !Array.isArray(summary.skills) || !Array.isArray(skillIds) || !skillIds.length) return null;
          const skills = skillIds.map((skill) => summary.skills.find((s) => s.id === skill));
          if (skills.some((skill) => !skill)) return null;
          let level = spec.items.start;
          for (let index = spec.items.start; index < spec.items.levels.length - 1; index += 1) {
            const authored = spec.items.levels[index];
            const steady = skills.every((skill) => {
              const formats = skill.levels?.[authored]?.formats;
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
          if (!presentation || typeof presentation !== "object" || Array.isArray(presentation) || Object.keys(presentation).some((key) => !Object.hasOwn(PRESENTATION, key))) fail(`presentation accepts only ${Object.keys(PRESENTATION).join(", ")}`);
          for (const [key, value] of Object.entries(presentation)) if (value != null && !PRESENTATION[key].includes(value)) fail(`invalid presentation ${key}`);
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
          if (!options || typeof options !== "object" || Object.keys(options).some((key) => !START.includes(key))) fail(`start accepts only ${START.join(", ")}`);
          const { spec: input, memory = null, prior = null, declared = {}, condition = null, arm = "adapted", now } = options;
          const spec = defineContent(input), guard = getGuard();
          if (!guard || typeof guard.check !== "function") throw new Error("Flow: Temper guard unavailable");
          if (!declared || typeof declared !== "object" || Array.isArray(declared) || Object.keys(declared).some((key) => !["mode", "knobs"].includes(key))) fail("declared must be { mode, knobs }");
          const mode = declared.mode ?? "auto", locks = { ...declared.knobs ?? {} };
          if (!MODES.includes(mode)) fail("invalid declared mode");
          for (const [knobId, index] of Object.entries(locks)) {
            const knob = spec.knobs.find((k) => k.id === knobId);
            if (!knob || !Number.isInteger(index) || index < 0 || index >= knob.values.length) fail(`invalid declared knob ${knobId}`);
          }
          if (condition !== null && !CONDITIONS.includes(condition)) fail("invalid condition");
          if (!["adapted", "baseline"].includes(arm)) fail("invalid arm");
          if (prior !== null && (typeof prior !== "object" || !within(prior.content, -20, 20))) fail("invalid prior");
          const startedAt = time(now), remembered = validMemory(spec, memory);
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
          const returning = !!remembered && startedAt - time(remembered.at) > RETURN_AFTER;
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
            intro: () => ({ code: `start.${intro}`, opening: copy(opening) }),
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
              if (!OUTCOMES.includes(outcome) || typeof assisted !== "boolean" || typeof repeat !== "boolean" || pressure !== null && !within(pressure, 0, 1.5) || latencyMs !== null && !within(latencyMs, 0, 6e5)) fail("invalid observation");
              if (level !== null && (!spec.items || !spec.items.levels.includes(level))) fail("invalid item level");
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
                change: change && copy(change)
              });
              return { change: change && copy(change), settings: settings(), evidence };
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
              return copy(change);
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
            trace: () => copy(trace),
            changes: () => copy(changes),
            last: () => last && { ...last },
            // What the host stores for next time: per content, no identity, no answers, no text.
            // The estimates learn in every round; the place kept is only where adapted play reached,
            // without the opening steps taken for today's choice alone.
            memory: (at) => ({
              v: 2,
              content: spec.id,
              specVersion: spec.version,
              policy: VERSION,
              at: new Date(time(at)).toISOString(),
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
        const time = (value) => {
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
          if (declinedAt !== null && time(now) - time(declinedAt) < quietDays * DAY) return { offer: false, reason: "declined-recently" };
          return { offer: true, from: at, to: at + 1, reason: streak >= need ? "quiet-streak" : "steady-with-help" };
        }
        const WORDS = Object.freeze({
          easy: {
            "raise.pace": "조금 빨라져요.",
            "raise.content": "조금 어려워져요.",
            "ease.pace": "시간이 더 있어요.",
            "ease.content": "조금 쉬워져요.",
            "ease.support": "힌트가 먼저 나와요.",
            "accepted-less-help": "힌트가 조금 늦게 나와요.",
            "start.memory": "지난번에 이어서 해요.",
            "start.prior": "지난 연습에 맞춰 시작해요.",
            "start.returning": "가볍게 시작해요.",
            "start.tired": "오늘은 안 어려워져요.",
            "start.fixed": "정한 방식 그대로 해요.",
            "start.baseline": "이번에는 기본으로 해요."
          },
          standard: {
            "raise.pace": "조금 더 빠르게 해 볼게요.",
            "raise.content": "조금 더 어려운 것도 해 볼게요.",
            "ease.pace": "시간을 조금 더 넉넉하게 드릴게요.",
            "ease.content": "조금 더 쉬운 것부터 다시 해요.",
            "ease.support": "도움을 조금 더 일찍 보여 드릴게요.",
            "accepted-less-help": "말씀하신 대로 도움을 조금 늦게 보여 드릴게요.",
            "start.memory": "지난번에 하던 데서 이어 갈게요.",
            "start.prior": "다른 연습 기록에 맞춰 시작할게요.",
            "start.returning": "가볍게 다시 시작할게요.",
            "start.tired": "오늘은 더 어렵게 하지 않을게요.",
            "start.fixed": "정해 둔 방식 그대로 진행해요.",
            "start.baseline": "이번 판은 기본 구성으로 진행해요."
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
          const text = Object.hasOwn(words, key) ? words[key] : WORDS[level][key];
          return typeof text === "string" && text ? { key, text } : null;
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
      var localDay = (iso) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      var SEEN = Object.freeze(["practice", "supported", "checking", "review"]);
      var object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
      var presentationOf = (value) => object(value) && Object.keys(value).length > 0 && Object.entries(value).every(([key, choice]) => Object.hasOwn(Flow.PRESENTATION, key) && (choice === null || Flow.PRESENTATION[key].includes(choice)));
      function createFlowPort({ storage, key, clock, epoch = () => null }) {
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
          return value && value.v === 1 && (value.epoch ?? null) === current && object(value.contents) && object(value.declined) ? value : { v: 1, epoch: current, contents: {}, declined: {} };
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
            return value && value.day === localDay(clock()) && Flow.CONDITIONS.includes(value.condition) ? value.condition : null;
          },
          setToday(condition) {
            if (condition !== null && !Flow.CONDITIONS.includes(condition)) throw new TypeError("Atlas: invalid condition");
            return write(TODAY, condition === null ? null : { day: localDay(clock()), condition });
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
            const done = write(PRESENT, { v: 1, presentation: presentation === null ? null : { ...presentation }, at: clock() });
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
            if (!object(remote)) throw new TypeError("Atlas: invalid memory");
            let changed = false;
            const present = remote.presentation;
            if (object(present) && instant(present.at) && (present.value === null || presentationOf(present.value)) && later(present.at, chosen()?.at) && write(PRESENT, { v: 1, presentation: present.value && { ...present.value }, at: present.at })) changed = true;
            const all = memories();
            let touched = false;
            for (const [id, memory] of Object.entries(object(remote.flow) ? remote.flow : {})) {
              if (!object(memory) || memory.content !== id || !instant(memory.at) || !later(memory.at, all.contents[id]?.at)) continue;
              all.contents[id] = JSON.parse(JSON.stringify(memory));
              touched = true;
            }
            for (const [id, at] of Object.entries(object(remote.declined) ? remote.declined : {})) {
              if (!instant(at) || !later(at, all.declined[id])) continue;
              all.declined[id] = at;
              touched = true;
            }
            if (touched && write(FLOW, all)) changed = true;
            if (changed) notify({ kind: "import" });
            return changed;
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
      function createLive({ coach, port, clock }) {
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
          const run = Flow.start({ spec, memory, prior, declared, condition: condition === void 0 ? port.today() : condition, arm, now: clock() });
          const say = (event) => VellumFlow.line(event, { level, words });
          const save = () => port.save(spec.id, run.memory(clock()), since);
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
              const own = chosen === recommendation.selected ? recommendation : coach.recommend([chosen], rest);
              return { ...own, selected: chosen, alternatives: [recommendation.selected, ...recommendation.alternatives].filter((c) => c !== chosen), flowLevel: wanted };
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
                now: clock()
              });
              return step.offer && !run.lessHelpAllowed() ? { offer: false, reason: "not-now" } : step;
            },
            acceptLessHelp() {
              const change = run.acceptLessHelp();
              save();
              return change && { ...change, line: say(change) };
            },
            declineLessHelp() {
              return port.decline(spec.id, clock(), since);
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
        clock = () => (/* @__PURE__ */ new Date()).toISOString(),
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
          const value = Date.parse(clock());
          if (!Number.isFinite(value)) throw new TypeError("Atlas: invalid clock");
          lastTime = Math.max(value, lastTime);
          return new Date(lastTime).toISOString();
        };
        const AHEAD_MS = 5 * 6e4;
        const newSession = (events) => {
          const own = Date.parse(clock());
          for (const e of events) {
            const at = Date.parse(e.at);
            if (Number.isFinite(at) && (!Number.isFinite(own) || at <= own + AHEAD_MS) && at > lastTime) lastTime = at;
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
            warning = "기록을 읽지 못해 기본 연습으로 진행해요.";
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
                warning = "기록 내용이 서로 달라 연결을 중단했어요. 기존 기록은 보존해요.";
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
          } catch (error) {
            writable = false;
            complete = false;
            warning = "기록을 저장하지 못했어요. 이번 연습은 다음 접속에 이어지지 않을 수 있어요.";
            notify("storage-error", error.code === "HISTORY_CAPACITY" ? "HISTORY_CAPACITY" : "STORAGE_ERROR");
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
          const rows = (known.buckets.get(key2) || []).filter((row) => !row.omitted);
          return Learning.formatEvidence(rows, {
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
            const unavailable = (reason) => ({ ...result, status: "unavailable", line: "새 문항 확인 결과를 판단할 기록이 충분하지 않아요.", reason });
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
              "independent-correct": "다른 새 문항은 도움 없이 맞혔어요.",
              "independent-incorrect": "다른 새 문항은 도움 없이 풀었지만 틀렸어요.",
              "assisted-correct": "다른 새 문항은 도움을 보고 맞혔어요.",
              "assisted-incorrect": "다른 새 문항은 도움을 보고 풀었지만 틀렸어요."
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
      module.exports = { createGame, createLearningSync, createMemorySync, summarizeLearning: Learning.summarizeLearning, recommend: Learning.recommend, POLICY: Learning.POLICY, RESPONSE_FORMATS: Learning.RESPONSE_FORMATS, KEY };
    }
  });

  // strata/hangul.json
  var require_hangul = __commonJS({
    "strata/hangul.json"(exports, module) {
      module.exports = {
        version: "hangul-4",
        note: "한글 단계의 글자 층(docs/한글단계_설계.md §3). 단원 순서 U1~U4는 체험 2주 수업 순서, U5(거센소리 ㅋㅌㅍㅊ, 2026-10-05)는 글자 만든 원리대로 획을 더한 순서(ㄱ→ㅋ, ㄷ→ㅌ, ㅂ→ㅍ, ㅈ→ㅊ), U6·U7(받침)은 설계 둘째 판이다. U8(된소리 ㄲㄸㅃㅆㅉ — 같은 글자를 둘 쓴 모양)·U9(겹모음 ㅘㅝㅟㅢㅚㅙㅞㅖㅒ — 모음 둘을 합친 모양, 2026-10-06)는 받침 뒤에 이어지고 core:false다: 졸업 조건(설계 §8 「U7까지의 핵심 마디」)에 들지 않고 졸업 앞뒤로 이어서 만난다. 헷갈리는 짝과 닮은 모양은 출발값이며 교사의 앎과 실측으로 고친다. by_ear:false인 짝은 소리로 묻지 않는다 — ㅐ/ㅔ, ㅒ/ㅖ, ㅚ/ㅙ/ㅞ(지금의 한국어에서 소리가 같다)와, 받침에서 [ㄷ]으로 같이 소리 나는 ㄷ·ㅅ·ㅈ. 글자 번호(jamo)는 유니코드 한글 음절 조합의 초성·중성·종성 순번이다. 받침은 role final이다.",
        skills: [
          ["ko.hangul.sound", "listening", "소리 듣고 글자 찾기"],
          ["ko.hangul.read", "reading", "글자 보고 소리 알기"]
        ],
        units: [
          { id: "U1", label: "기본 모음", letters: ["v-a", "v-eo", "v-o", "v-u", "v-eu", "v-i"] },
          { id: "U2", label: "자음 하나", letters: ["c-g", "c-n", "c-d", "c-r", "c-m"] },
          { id: "U3", label: "자음 둘", letters: ["c-b", "c-s", "c-ng", "c-j", "c-h"] },
          { id: "U4", label: "모음 더하기", letters: ["v-ya", "v-yeo", "v-yo", "v-yu", "v-ae", "v-e"] },
          { id: "U5", label: "거센소리", letters: ["c-k", "c-t", "c-p", "c-ch"] },
          { id: "U6", label: "받침 하나", letters: ["f-n", "f-r", "f-m", "f-ng"] },
          { id: "U7", label: "받침 둘", letters: ["f-g", "f-d", "f-b", "f-s", "f-j"] },
          { id: "U8", label: "된소리", letters: ["c-kk", "c-tt", "c-pp", "c-ss", "c-jj"], core: false },
          { id: "U9", label: "겹모음", letters: ["v-wa", "v-wo", "v-wi", "v-ui", "v-oe", "v-wae", "v-we", "v-ye", "v-yae"], core: false }
        ],
        later: [
          { id: "U10", label: "첫 문장", preview: "저는" }
        ],
        letters: [
          ["v-a", "ㅏ", "vowel", 0],
          ["v-eo", "ㅓ", "vowel", 4],
          ["v-o", "ㅗ", "vowel", 8],
          ["v-u", "ㅜ", "vowel", 13],
          ["v-eu", "ㅡ", "vowel", 18],
          ["v-i", "ㅣ", "vowel", 20],
          ["c-g", "ㄱ", "consonant", 0],
          ["c-n", "ㄴ", "consonant", 2],
          ["c-d", "ㄷ", "consonant", 3],
          ["c-r", "ㄹ", "consonant", 5],
          ["c-m", "ㅁ", "consonant", 6],
          ["c-b", "ㅂ", "consonant", 7],
          ["c-s", "ㅅ", "consonant", 9],
          ["c-ng", "ㅇ", "consonant", 11],
          ["c-j", "ㅈ", "consonant", 12],
          ["c-h", "ㅎ", "consonant", 18],
          ["v-ya", "ㅑ", "vowel", 2],
          ["v-yeo", "ㅕ", "vowel", 6],
          ["v-yo", "ㅛ", "vowel", 12],
          ["v-yu", "ㅠ", "vowel", 17],
          ["v-ae", "ㅐ", "vowel", 1],
          ["v-e", "ㅔ", "vowel", 5],
          ["c-k", "ㅋ", "consonant", 15],
          ["c-t", "ㅌ", "consonant", 16],
          ["c-p", "ㅍ", "consonant", 17],
          ["c-ch", "ㅊ", "consonant", 14],
          ["f-n", "ㄴ", "final", 4],
          ["f-r", "ㄹ", "final", 8],
          ["f-m", "ㅁ", "final", 16],
          ["f-ng", "ㅇ", "final", 21],
          ["f-g", "ㄱ", "final", 1],
          ["f-d", "ㄷ", "final", 7],
          ["f-b", "ㅂ", "final", 17],
          ["f-s", "ㅅ", "final", 19],
          ["f-j", "ㅈ", "final", 22],
          ["c-kk", "ㄲ", "consonant", 1],
          ["c-tt", "ㄸ", "consonant", 4],
          ["c-pp", "ㅃ", "consonant", 8],
          ["c-ss", "ㅆ", "consonant", 10],
          ["c-jj", "ㅉ", "consonant", 13],
          ["v-wa", "ㅘ", "vowel", 9],
          ["v-wo", "ㅝ", "vowel", 14],
          ["v-wi", "ㅟ", "vowel", 16],
          ["v-ui", "ㅢ", "vowel", 19],
          ["v-oe", "ㅚ", "vowel", 11],
          ["v-wae", "ㅙ", "vowel", 10],
          ["v-we", "ㅞ", "vowel", 15],
          ["v-ye", "ㅖ", "vowel", 7],
          ["v-yae", "ㅒ", "vowel", 3]
        ],
        pairs: [
          { letters: ["v-eo", "v-o"], by_ear: true },
          { letters: ["v-o", "v-u"], by_ear: true },
          { letters: ["v-u", "v-eu"], by_ear: true },
          { letters: ["v-yeo", "v-yo"], by_ear: true },
          { letters: ["c-d", "c-r"], by_ear: true },
          { letters: ["v-ae", "v-e"], by_ear: false },
          { letters: ["c-g", "c-k"], by_ear: true },
          { letters: ["c-d", "c-t"], by_ear: true },
          { letters: ["c-b", "c-p"], by_ear: true },
          { letters: ["c-j", "c-ch"], by_ear: true },
          { letters: ["f-n", "f-ng"], by_ear: true },
          { letters: ["f-n", "f-m"], by_ear: true },
          { letters: ["f-m", "f-ng"], by_ear: true },
          { letters: ["f-g", "f-d"], by_ear: true },
          { letters: ["f-d", "f-b"], by_ear: true },
          { letters: ["f-d", "f-s"], by_ear: false },
          { letters: ["f-d", "f-j"], by_ear: false },
          { letters: ["f-s", "f-j"], by_ear: false },
          { letters: ["c-g", "c-kk"], by_ear: true },
          { letters: ["c-k", "c-kk"], by_ear: true },
          { letters: ["c-d", "c-tt"], by_ear: true },
          { letters: ["c-t", "c-tt"], by_ear: true },
          { letters: ["c-b", "c-pp"], by_ear: true },
          { letters: ["c-p", "c-pp"], by_ear: true },
          { letters: ["c-s", "c-ss"], by_ear: true },
          { letters: ["c-j", "c-jj"], by_ear: true },
          { letters: ["c-ch", "c-jj"], by_ear: true },
          { letters: ["v-wa", "v-wo"], by_ear: true },
          { letters: ["v-wi", "v-ui"], by_ear: true },
          { letters: ["v-eu", "v-ui"], by_ear: true },
          { letters: ["v-yeo", "v-ye"], by_ear: true },
          { letters: ["v-oe", "v-wae"], by_ear: false },
          { letters: ["v-oe", "v-we"], by_ear: false },
          { letters: ["v-wae", "v-we"], by_ear: false },
          { letters: ["v-yae", "v-ye"], by_ear: false }
        ],
        shapes: [
          ["v-a", "v-eo"],
          ["v-o", "v-u"],
          ["v-ya", "v-yeo"],
          ["v-yo", "v-yu"],
          ["v-a", "v-ya"],
          ["v-eo", "v-yeo"],
          ["v-o", "v-yo"],
          ["v-u", "v-yu"],
          ["v-eu", "v-i"],
          ["c-g", "c-n"],
          ["c-n", "c-d"],
          ["c-d", "c-r"],
          ["c-m", "c-b"],
          ["c-s", "c-j"],
          ["c-ng", "c-h"],
          ["c-g", "c-k"],
          ["c-d", "c-t"],
          ["c-j", "c-ch"],
          ["c-ch", "c-h"],
          ["f-n", "f-d"],
          ["f-d", "f-r"],
          ["f-m", "f-b"],
          ["f-s", "f-j"],
          ["f-g", "f-n"],
          ["c-g", "c-kk"],
          ["c-d", "c-tt"],
          ["c-b", "c-pp"],
          ["c-s", "c-ss"],
          ["c-j", "c-jj"],
          ["v-oe", "v-wi"],
          ["v-wi", "v-ui"],
          ["v-wa", "v-wae"],
          ["v-wo", "v-we"],
          ["v-yae", "v-ye"],
          ["v-ae", "v-yae"],
          ["v-e", "v-ye"]
        ]
      };
    }
  });

  // strata/maps/hangul.json
  var require_hangul2 = __commonJS({
    "strata/maps/hangul.json"(exports, module) {
      module.exports = {
        map_ver: "hangul-4-a2d24bbbec6c",
        subject: "ko",
        sources: {
          "hangul-layer": {
            path: "strata/hangul.json",
            sha256: "a2d24bbbec6cbee7bf708670b9f325c89c0788d14c15ef891b288ac9ab3a0ebf"
          }
        },
        nodes: [
          {
            id: "ko.hangul.sound",
            kind: "skill",
            label_ko: "소리 듣고 글자 찾기",
            domain: "listening",
            level: null,
            difficulty: {
              authored: null,
              measured: null,
              n: 0
            },
            source_refs: [
              {
                source: "hangul-layer",
                selector: "skills"
              }
            ]
          },
          {
            id: "ko.hangul.read",
            kind: "skill",
            label_ko: "글자 보고 소리 알기",
            domain: "reading",
            level: null,
            difficulty: {
              authored: null,
              measured: null,
              n: 0
            },
            source_refs: [
              {
                source: "hangul-layer",
                selector: "skills"
              }
            ]
          },
          {
            id: "hangul.v-a",
            kind: "letter",
            label_ko: "ㅏ",
            role: "vowel",
            jamo: 0,
            unit: "U1",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-a"
              }
            ]
          },
          {
            id: "hangul.v-eo",
            kind: "letter",
            label_ko: "ㅓ",
            role: "vowel",
            jamo: 4,
            unit: "U1",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-eo"
              }
            ]
          },
          {
            id: "hangul.v-o",
            kind: "letter",
            label_ko: "ㅗ",
            role: "vowel",
            jamo: 8,
            unit: "U1",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-o"
              }
            ]
          },
          {
            id: "hangul.v-u",
            kind: "letter",
            label_ko: "ㅜ",
            role: "vowel",
            jamo: 13,
            unit: "U1",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-u"
              }
            ]
          },
          {
            id: "hangul.v-eu",
            kind: "letter",
            label_ko: "ㅡ",
            role: "vowel",
            jamo: 18,
            unit: "U1",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-eu"
              }
            ]
          },
          {
            id: "hangul.v-i",
            kind: "letter",
            label_ko: "ㅣ",
            role: "vowel",
            jamo: 20,
            unit: "U1",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-i"
              }
            ]
          },
          {
            id: "hangul.c-g",
            kind: "letter",
            label_ko: "ㄱ",
            role: "consonant",
            jamo: 0,
            unit: "U2",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-g"
              }
            ]
          },
          {
            id: "hangul.c-n",
            kind: "letter",
            label_ko: "ㄴ",
            role: "consonant",
            jamo: 2,
            unit: "U2",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-n"
              }
            ]
          },
          {
            id: "hangul.c-d",
            kind: "letter",
            label_ko: "ㄷ",
            role: "consonant",
            jamo: 3,
            unit: "U2",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-d"
              }
            ]
          },
          {
            id: "hangul.c-r",
            kind: "letter",
            label_ko: "ㄹ",
            role: "consonant",
            jamo: 5,
            unit: "U2",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-r"
              }
            ]
          },
          {
            id: "hangul.c-m",
            kind: "letter",
            label_ko: "ㅁ",
            role: "consonant",
            jamo: 6,
            unit: "U2",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-m"
              }
            ]
          },
          {
            id: "hangul.c-b",
            kind: "letter",
            label_ko: "ㅂ",
            role: "consonant",
            jamo: 7,
            unit: "U3",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-b"
              }
            ]
          },
          {
            id: "hangul.c-s",
            kind: "letter",
            label_ko: "ㅅ",
            role: "consonant",
            jamo: 9,
            unit: "U3",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-s"
              }
            ]
          },
          {
            id: "hangul.c-ng",
            kind: "letter",
            label_ko: "ㅇ",
            role: "consonant",
            jamo: 11,
            unit: "U3",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-ng"
              }
            ]
          },
          {
            id: "hangul.c-j",
            kind: "letter",
            label_ko: "ㅈ",
            role: "consonant",
            jamo: 12,
            unit: "U3",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-j"
              }
            ]
          },
          {
            id: "hangul.c-h",
            kind: "letter",
            label_ko: "ㅎ",
            role: "consonant",
            jamo: 18,
            unit: "U3",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-h"
              }
            ]
          },
          {
            id: "hangul.v-ya",
            kind: "letter",
            label_ko: "ㅑ",
            role: "vowel",
            jamo: 2,
            unit: "U4",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-ya"
              }
            ]
          },
          {
            id: "hangul.v-yeo",
            kind: "letter",
            label_ko: "ㅕ",
            role: "vowel",
            jamo: 6,
            unit: "U4",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-yeo"
              }
            ]
          },
          {
            id: "hangul.v-yo",
            kind: "letter",
            label_ko: "ㅛ",
            role: "vowel",
            jamo: 12,
            unit: "U4",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-yo"
              }
            ]
          },
          {
            id: "hangul.v-yu",
            kind: "letter",
            label_ko: "ㅠ",
            role: "vowel",
            jamo: 17,
            unit: "U4",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-yu"
              }
            ]
          },
          {
            id: "hangul.v-ae",
            kind: "letter",
            label_ko: "ㅐ",
            role: "vowel",
            jamo: 1,
            unit: "U4",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-ae"
              }
            ]
          },
          {
            id: "hangul.v-e",
            kind: "letter",
            label_ko: "ㅔ",
            role: "vowel",
            jamo: 5,
            unit: "U4",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-e"
              }
            ]
          },
          {
            id: "hangul.c-k",
            kind: "letter",
            label_ko: "ㅋ",
            role: "consonant",
            jamo: 15,
            unit: "U5",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-k"
              }
            ]
          },
          {
            id: "hangul.c-t",
            kind: "letter",
            label_ko: "ㅌ",
            role: "consonant",
            jamo: 16,
            unit: "U5",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-t"
              }
            ]
          },
          {
            id: "hangul.c-p",
            kind: "letter",
            label_ko: "ㅍ",
            role: "consonant",
            jamo: 17,
            unit: "U5",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-p"
              }
            ]
          },
          {
            id: "hangul.c-ch",
            kind: "letter",
            label_ko: "ㅊ",
            role: "consonant",
            jamo: 14,
            unit: "U5",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-ch"
              }
            ]
          },
          {
            id: "hangul.f-n",
            kind: "letter",
            label_ko: "받침 ㄴ",
            role: "final",
            jamo: 4,
            unit: "U6",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-n"
              }
            ]
          },
          {
            id: "hangul.f-r",
            kind: "letter",
            label_ko: "받침 ㄹ",
            role: "final",
            jamo: 8,
            unit: "U6",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-r"
              }
            ]
          },
          {
            id: "hangul.f-m",
            kind: "letter",
            label_ko: "받침 ㅁ",
            role: "final",
            jamo: 16,
            unit: "U6",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-m"
              }
            ]
          },
          {
            id: "hangul.f-ng",
            kind: "letter",
            label_ko: "받침 ㅇ",
            role: "final",
            jamo: 21,
            unit: "U6",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-ng"
              }
            ]
          },
          {
            id: "hangul.f-g",
            kind: "letter",
            label_ko: "받침 ㄱ",
            role: "final",
            jamo: 1,
            unit: "U7",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-g"
              }
            ]
          },
          {
            id: "hangul.f-d",
            kind: "letter",
            label_ko: "받침 ㄷ",
            role: "final",
            jamo: 7,
            unit: "U7",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-d"
              }
            ]
          },
          {
            id: "hangul.f-b",
            kind: "letter",
            label_ko: "받침 ㅂ",
            role: "final",
            jamo: 17,
            unit: "U7",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-b"
              }
            ]
          },
          {
            id: "hangul.f-s",
            kind: "letter",
            label_ko: "받침 ㅅ",
            role: "final",
            jamo: 19,
            unit: "U7",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-s"
              }
            ]
          },
          {
            id: "hangul.f-j",
            kind: "letter",
            label_ko: "받침 ㅈ",
            role: "final",
            jamo: 22,
            unit: "U7",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "f-j"
              }
            ]
          },
          {
            id: "hangul.c-kk",
            kind: "letter",
            label_ko: "ㄲ",
            role: "consonant",
            jamo: 1,
            unit: "U8",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-kk"
              }
            ]
          },
          {
            id: "hangul.c-tt",
            kind: "letter",
            label_ko: "ㄸ",
            role: "consonant",
            jamo: 4,
            unit: "U8",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-tt"
              }
            ]
          },
          {
            id: "hangul.c-pp",
            kind: "letter",
            label_ko: "ㅃ",
            role: "consonant",
            jamo: 8,
            unit: "U8",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-pp"
              }
            ]
          },
          {
            id: "hangul.c-ss",
            kind: "letter",
            label_ko: "ㅆ",
            role: "consonant",
            jamo: 10,
            unit: "U8",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-ss"
              }
            ]
          },
          {
            id: "hangul.c-jj",
            kind: "letter",
            label_ko: "ㅉ",
            role: "consonant",
            jamo: 13,
            unit: "U8",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "c-jj"
              }
            ]
          },
          {
            id: "hangul.v-wa",
            kind: "letter",
            label_ko: "ㅘ",
            role: "vowel",
            jamo: 9,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-wa"
              }
            ]
          },
          {
            id: "hangul.v-wo",
            kind: "letter",
            label_ko: "ㅝ",
            role: "vowel",
            jamo: 14,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-wo"
              }
            ]
          },
          {
            id: "hangul.v-wi",
            kind: "letter",
            label_ko: "ㅟ",
            role: "vowel",
            jamo: 16,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-wi"
              }
            ]
          },
          {
            id: "hangul.v-ui",
            kind: "letter",
            label_ko: "ㅢ",
            role: "vowel",
            jamo: 19,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-ui"
              }
            ]
          },
          {
            id: "hangul.v-oe",
            kind: "letter",
            label_ko: "ㅚ",
            role: "vowel",
            jamo: 11,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-oe"
              }
            ]
          },
          {
            id: "hangul.v-wae",
            kind: "letter",
            label_ko: "ㅙ",
            role: "vowel",
            jamo: 10,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-wae"
              }
            ]
          },
          {
            id: "hangul.v-we",
            kind: "letter",
            label_ko: "ㅞ",
            role: "vowel",
            jamo: 15,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-we"
              }
            ]
          },
          {
            id: "hangul.v-ye",
            kind: "letter",
            label_ko: "ㅖ",
            role: "vowel",
            jamo: 7,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-ye"
              }
            ]
          },
          {
            id: "hangul.v-yae",
            kind: "letter",
            label_ko: "ㅒ",
            role: "vowel",
            jamo: 3,
            unit: "U9",
            level: null,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "v-yae"
              }
            ]
          }
        ],
        edges: [
          {
            from: "hangul.v-a",
            to: "hangul.c-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-a",
            to: "hangul.c-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-a",
            to: "hangul.c-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-a",
            to: "hangul.c-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-a",
            to: "hangul.c-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eo",
            to: "hangul.c-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eo",
            to: "hangul.c-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eo",
            to: "hangul.c-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eo",
            to: "hangul.c-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eo",
            to: "hangul.c-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-o",
            to: "hangul.c-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-o",
            to: "hangul.c-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-o",
            to: "hangul.c-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-o",
            to: "hangul.c-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-o",
            to: "hangul.c-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-u",
            to: "hangul.c-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-u",
            to: "hangul.c-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-u",
            to: "hangul.c-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-u",
            to: "hangul.c-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-u",
            to: "hangul.c-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eu",
            to: "hangul.c-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eu",
            to: "hangul.c-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eu",
            to: "hangul.c-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eu",
            to: "hangul.c-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-eu",
            to: "hangul.c-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-i",
            to: "hangul.c-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-i",
            to: "hangul.c-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-i",
            to: "hangul.c-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-i",
            to: "hangul.c-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.v-i",
            to: "hangul.c-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U2"
              }
            ]
          },
          {
            from: "hangul.c-g",
            to: "hangul.c-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-g",
            to: "hangul.c-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-g",
            to: "hangul.c-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-g",
            to: "hangul.c-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-g",
            to: "hangul.c-h",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-n",
            to: "hangul.c-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-n",
            to: "hangul.c-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-n",
            to: "hangul.c-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-n",
            to: "hangul.c-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-n",
            to: "hangul.c-h",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-h",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-r",
            to: "hangul.c-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-r",
            to: "hangul.c-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-r",
            to: "hangul.c-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-r",
            to: "hangul.c-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-r",
            to: "hangul.c-h",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-m",
            to: "hangul.c-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-m",
            to: "hangul.c-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-m",
            to: "hangul.c-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-m",
            to: "hangul.c-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-m",
            to: "hangul.c-h",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U3"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.v-ya",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.v-yeo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.v-yo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.v-yu",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.v-ae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.v-e",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-s",
            to: "hangul.v-ya",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-s",
            to: "hangul.v-yeo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-s",
            to: "hangul.v-yo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-s",
            to: "hangul.v-yu",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-s",
            to: "hangul.v-ae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-s",
            to: "hangul.v-e",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-ng",
            to: "hangul.v-ya",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-ng",
            to: "hangul.v-yeo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-ng",
            to: "hangul.v-yo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-ng",
            to: "hangul.v-yu",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-ng",
            to: "hangul.v-ae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-ng",
            to: "hangul.v-e",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-j",
            to: "hangul.v-ya",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-j",
            to: "hangul.v-yeo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-j",
            to: "hangul.v-yo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-j",
            to: "hangul.v-yu",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-j",
            to: "hangul.v-ae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-j",
            to: "hangul.v-e",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-h",
            to: "hangul.v-ya",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-h",
            to: "hangul.v-yeo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-h",
            to: "hangul.v-yo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-h",
            to: "hangul.v-yu",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-h",
            to: "hangul.v-ae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.c-h",
            to: "hangul.v-e",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U4"
              }
            ]
          },
          {
            from: "hangul.v-ya",
            to: "hangul.c-k",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-ya",
            to: "hangul.c-t",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-ya",
            to: "hangul.c-p",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-ya",
            to: "hangul.c-ch",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yeo",
            to: "hangul.c-k",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yeo",
            to: "hangul.c-t",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yeo",
            to: "hangul.c-p",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yeo",
            to: "hangul.c-ch",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yo",
            to: "hangul.c-k",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yo",
            to: "hangul.c-t",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yo",
            to: "hangul.c-p",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yo",
            to: "hangul.c-ch",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yu",
            to: "hangul.c-k",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yu",
            to: "hangul.c-t",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yu",
            to: "hangul.c-p",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-yu",
            to: "hangul.c-ch",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-ae",
            to: "hangul.c-k",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-ae",
            to: "hangul.c-t",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-ae",
            to: "hangul.c-p",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-ae",
            to: "hangul.c-ch",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-e",
            to: "hangul.c-k",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-e",
            to: "hangul.c-t",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-e",
            to: "hangul.c-p",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.v-e",
            to: "hangul.c-ch",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U5"
              }
            ]
          },
          {
            from: "hangul.c-k",
            to: "hangul.f-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-k",
            to: "hangul.f-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-k",
            to: "hangul.f-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-k",
            to: "hangul.f-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-t",
            to: "hangul.f-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-t",
            to: "hangul.f-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-t",
            to: "hangul.f-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-t",
            to: "hangul.f-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-p",
            to: "hangul.f-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-p",
            to: "hangul.f-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-p",
            to: "hangul.f-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-p",
            to: "hangul.f-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-ch",
            to: "hangul.f-n",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-ch",
            to: "hangul.f-r",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-ch",
            to: "hangul.f-m",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.c-ch",
            to: "hangul.f-ng",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U6"
              }
            ]
          },
          {
            from: "hangul.f-n",
            to: "hangul.f-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-n",
            to: "hangul.f-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-n",
            to: "hangul.f-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-n",
            to: "hangul.f-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-n",
            to: "hangul.f-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-r",
            to: "hangul.f-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-r",
            to: "hangul.f-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-r",
            to: "hangul.f-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-r",
            to: "hangul.f-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-r",
            to: "hangul.f-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-m",
            to: "hangul.f-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-m",
            to: "hangul.f-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-m",
            to: "hangul.f-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-m",
            to: "hangul.f-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-m",
            to: "hangul.f-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-ng",
            to: "hangul.f-g",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-ng",
            to: "hangul.f-d",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-ng",
            to: "hangul.f-b",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-ng",
            to: "hangul.f-s",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-ng",
            to: "hangul.f-j",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U7"
              }
            ]
          },
          {
            from: "hangul.f-g",
            to: "hangul.c-kk",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-g",
            to: "hangul.c-tt",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-g",
            to: "hangul.c-pp",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-g",
            to: "hangul.c-ss",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-g",
            to: "hangul.c-jj",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.c-kk",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.c-tt",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.c-pp",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.c-ss",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.c-jj",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-b",
            to: "hangul.c-kk",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-b",
            to: "hangul.c-tt",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-b",
            to: "hangul.c-pp",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-b",
            to: "hangul.c-ss",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-b",
            to: "hangul.c-jj",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-s",
            to: "hangul.c-kk",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-s",
            to: "hangul.c-tt",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-s",
            to: "hangul.c-pp",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-s",
            to: "hangul.c-ss",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-s",
            to: "hangul.c-jj",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-j",
            to: "hangul.c-kk",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-j",
            to: "hangul.c-tt",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-j",
            to: "hangul.c-pp",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-j",
            to: "hangul.c-ss",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.f-j",
            to: "hangul.c-jj",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U8"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-wa",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-wo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-wi",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-ui",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-oe",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-wae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-we",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-ye",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-kk",
            to: "hangul.v-yae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-wa",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-wo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-wi",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-ui",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-oe",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-wae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-we",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-ye",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-tt",
            to: "hangul.v-yae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-wa",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-wo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-wi",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-ui",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-oe",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-wae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-we",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-ye",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-pp",
            to: "hangul.v-yae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-wa",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-wo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-wi",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-ui",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-oe",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-wae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-we",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-ye",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-ss",
            to: "hangul.v-yae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-wa",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-wo",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-wi",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-ui",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-oe",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-wae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-we",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-ye",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-jj",
            to: "hangul.v-yae",
            type: "prerequisite",
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "units.U9"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.c-m",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.c-b|c-m"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.c-p",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-b|c-p"
              }
            ]
          },
          {
            from: "hangul.c-b",
            to: "hangul.c-pp",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-b|c-pp"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-b|c-pp"
              }
            ]
          },
          {
            from: "hangul.c-ch",
            to: "hangul.c-h",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.c-ch|c-h"
              }
            ]
          },
          {
            from: "hangul.c-ch",
            to: "hangul.c-j",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-ch|c-j"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-ch|c-j"
              }
            ]
          },
          {
            from: "hangul.c-ch",
            to: "hangul.c-jj",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-ch|c-jj"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-n",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.c-d|c-n"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-r",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-d|c-r"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-d|c-r"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-t",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-d|c-t"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-d|c-t"
              }
            ]
          },
          {
            from: "hangul.c-d",
            to: "hangul.c-tt",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-d|c-tt"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-d|c-tt"
              }
            ]
          },
          {
            from: "hangul.c-g",
            to: "hangul.c-k",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-g|c-k"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-g|c-k"
              }
            ]
          },
          {
            from: "hangul.c-g",
            to: "hangul.c-kk",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-g|c-kk"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-g|c-kk"
              }
            ]
          },
          {
            from: "hangul.c-g",
            to: "hangul.c-n",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.c-g|c-n"
              }
            ]
          },
          {
            from: "hangul.c-h",
            to: "hangul.c-ng",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.c-h|c-ng"
              }
            ]
          },
          {
            from: "hangul.c-j",
            to: "hangul.c-jj",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-j|c-jj"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-j|c-jj"
              }
            ]
          },
          {
            from: "hangul.c-j",
            to: "hangul.c-s",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.c-j|c-s"
              }
            ]
          },
          {
            from: "hangul.c-k",
            to: "hangul.c-kk",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-k|c-kk"
              }
            ]
          },
          {
            from: "hangul.c-p",
            to: "hangul.c-pp",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-p|c-pp"
              }
            ]
          },
          {
            from: "hangul.c-s",
            to: "hangul.c-ss",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-s|c-ss"
              },
              {
                source: "hangul-layer",
                selector: "shapes.c-s|c-ss"
              }
            ]
          },
          {
            from: "hangul.c-t",
            to: "hangul.c-tt",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.c-t|c-tt"
              }
            ]
          },
          {
            from: "hangul.f-b",
            to: "hangul.f-d",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.f-b|f-d"
              }
            ]
          },
          {
            from: "hangul.f-b",
            to: "hangul.f-m",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.f-b|f-m"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.f-g",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.f-d|f-g"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.f-j",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: false,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.f-d|f-j"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.f-n",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.f-d|f-n"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.f-r",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.f-d|f-r"
              }
            ]
          },
          {
            from: "hangul.f-d",
            to: "hangul.f-s",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: false,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.f-d|f-s"
              }
            ]
          },
          {
            from: "hangul.f-g",
            to: "hangul.f-n",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.f-g|f-n"
              }
            ]
          },
          {
            from: "hangul.f-j",
            to: "hangul.f-s",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: false,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.f-j|f-s"
              },
              {
                source: "hangul-layer",
                selector: "shapes.f-j|f-s"
              }
            ]
          },
          {
            from: "hangul.f-m",
            to: "hangul.f-n",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.f-m|f-n"
              }
            ]
          },
          {
            from: "hangul.f-m",
            to: "hangul.f-ng",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.f-m|f-ng"
              }
            ]
          },
          {
            from: "hangul.f-n",
            to: "hangul.f-ng",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.f-n|f-ng"
              }
            ]
          },
          {
            from: "hangul.v-ae",
            to: "hangul.v-e",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: false,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-ae|v-e"
              }
            ]
          },
          {
            from: "hangul.v-ae",
            to: "hangul.v-yae",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-ae|v-yae"
              }
            ]
          },
          {
            from: "hangul.v-a",
            to: "hangul.v-eo",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-a|v-eo"
              }
            ]
          },
          {
            from: "hangul.v-a",
            to: "hangul.v-ya",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-a|v-ya"
              }
            ]
          },
          {
            from: "hangul.v-e",
            to: "hangul.v-ye",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-e|v-ye"
              }
            ]
          },
          {
            from: "hangul.v-eo",
            to: "hangul.v-o",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-eo|v-o"
              }
            ]
          },
          {
            from: "hangul.v-eo",
            to: "hangul.v-yeo",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-eo|v-yeo"
              }
            ]
          },
          {
            from: "hangul.v-eu",
            to: "hangul.v-i",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-eu|v-i"
              }
            ]
          },
          {
            from: "hangul.v-eu",
            to: "hangul.v-u",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-eu|v-u"
              }
            ]
          },
          {
            from: "hangul.v-eu",
            to: "hangul.v-ui",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-eu|v-ui"
              }
            ]
          },
          {
            from: "hangul.v-oe",
            to: "hangul.v-wae",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: false,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-oe|v-wae"
              }
            ]
          },
          {
            from: "hangul.v-oe",
            to: "hangul.v-we",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: false,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-oe|v-we"
              }
            ]
          },
          {
            from: "hangul.v-oe",
            to: "hangul.v-wi",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-oe|v-wi"
              }
            ]
          },
          {
            from: "hangul.v-o",
            to: "hangul.v-u",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-o|v-u"
              },
              {
                source: "hangul-layer",
                selector: "shapes.v-o|v-u"
              }
            ]
          },
          {
            from: "hangul.v-o",
            to: "hangul.v-yo",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-o|v-yo"
              }
            ]
          },
          {
            from: "hangul.v-u",
            to: "hangul.v-yu",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-u|v-yu"
              }
            ]
          },
          {
            from: "hangul.v-ui",
            to: "hangul.v-wi",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-ui|v-wi"
              },
              {
                source: "hangul-layer",
                selector: "shapes.v-ui|v-wi"
              }
            ]
          },
          {
            from: "hangul.v-wae",
            to: "hangul.v-we",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: false,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-wae|v-we"
              }
            ]
          },
          {
            from: "hangul.v-wa",
            to: "hangul.v-wae",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-wa|v-wae"
              }
            ]
          },
          {
            from: "hangul.v-wa",
            to: "hangul.v-wo",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-wa|v-wo"
              }
            ]
          },
          {
            from: "hangul.v-we",
            to: "hangul.v-wo",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-we|v-wo"
              }
            ]
          },
          {
            from: "hangul.v-yae",
            to: "hangul.v-ye",
            type: "contrasts_with",
            bases: [
              "sound",
              "shape"
            ],
            by_ear: false,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-yae|v-ye"
              },
              {
                source: "hangul-layer",
                selector: "shapes.v-yae|v-ye"
              }
            ]
          },
          {
            from: "hangul.v-ya",
            to: "hangul.v-yeo",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-ya|v-yeo"
              }
            ]
          },
          {
            from: "hangul.v-ye",
            to: "hangul.v-yeo",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-ye|v-yeo"
              }
            ]
          },
          {
            from: "hangul.v-yeo",
            to: "hangul.v-yo",
            type: "contrasts_with",
            bases: [
              "sound"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "sounds.v-yeo|v-yo"
              }
            ]
          },
          {
            from: "hangul.v-yo",
            to: "hangul.v-yu",
            type: "contrasts_with",
            bases: [
              "shape"
            ],
            by_ear: true,
            confidence: "authored",
            reviewed: false,
            source_refs: [
              {
                source: "hangul-layer",
                selector: "shapes.v-yo|v-yu"
              }
            ]
          }
        ],
        tag_vocabulary: [],
        links: {
          tags: []
        }
      };
    }
  });

  // experiences/hangul-stage/learning-entry.cjs
  var require_learning_entry = __commonJS({
    "experiences/hangul-stage/learning-entry.cjs"(exports, module) {
      var { createMap } = require_strata();
      var learning = require_game_learning();
      var layer = require_hangul();
      var map = createMap(require_hangul2());
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
        layer,
        mapVersion: map.map_ver,
        SKILLS: map.allNodes().filter((node) => node.kind === "skill"),
        RESPONSE_FORMATS: learning.RESPONSE_FORMATS,
        createGame: (options) => {
          const owner = host();
          const game = owner ? owner.createGame(options, factory, learning.createLearningSync) : factory(options);
          games.add(game);
          return game;
        }
      };
    }
  });
  return require_learning_entry();
})();
