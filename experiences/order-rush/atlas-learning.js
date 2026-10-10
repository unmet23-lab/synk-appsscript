// Generated from atlas/ and strata/. Change canonical sources; run tools/build-game-learning.js.
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
      var KINDS = ["skill", "grammar_point", "expression", "situation", "letter", "syllable"];
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
        return true;
      }
      function createMap(input) {
        validateMap(input);
        const data = freeze(copy(input));
        const nodes = new Map(data.nodes.map((node) => [node.id, node]));
        const tags = new Map(data.links.tags.map((link) => [link.tag, link]));
        function getNode(id) {
          return nodes.get(id) || null;
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
          prerequisites,
          candidates,
          allNodes: () => Object.freeze([...nodes.values()])
        });
      }
      module.exports = { createMap, validateMap };
    }
  });

  // strata/maps/topik-i.json
  var require_topik_i = __commonJS({
    "strata/maps/topik-i.json"(exports, module) {
      module.exports = {
        map_ver: "topik-i-practice-1-8923b769ed24",
        subject: "ko",
        sources: {
          "practice-taxonomy": {
            path: "strata/topik-i.skills.json",
            sha256: "8923b769ed247dd6628df276fdd5e8ddf421d863b012f42aa34bce4e324c1513"
          }
        },
        nodes: [
          {
            id: "ko.listening.word",
            kind: "skill",
            label_ko: "낱말 듣기",
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
            label_ko: "듣고 세부 정보 찾기",
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
            label_ko: "듣고 부정·변경 이해하기",
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
            label_ko: "듣고 순서 이해하기",
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
            label_ko: "듣고 이유 이해하기",
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
            label_ko: "듣고 조건 이해하기",
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
            label_ko: "듣고 핵심 이해하기",
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
            label_ko: "낱말 뜻 읽기",
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
            label_ko: "조사·문형 읽기",
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
            label_ko: "읽고 세부 정보 찾기",
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
            label_ko: "읽고 부정·변경 이해하기",
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
            label_ko: "읽고 순서 이해하기",
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
            label_ko: "읽고 이유 이해하기",
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
            label_ko: "읽고 조건 이해하기",
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
            label_ko: "읽고 핵심 이해하기",
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
          }
        ],
        edges: [],
        tag_vocabulary: [],
        links: {
          tags: []
        }
      };
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
        const OPTIONAL = { "practice.presented": ["measure"], "practice.attempted": ["reason"] };
        const VERDICTS = ["correct", "incorrect", "unassessed", "skipped"];
        const copy = (value) => JSON.parse(JSON.stringify(value));
        const id = (value) => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
        const time = (value) => {
          const n = Date.parse(value);
          if (typeof value !== "string" || !Number.isFinite(n)) throw new TypeError("Trail: invalid time");
          return n;
        };
        const key = (scope) => {
          if (!scope || typeof scope !== "object" || Object.keys(scope).some((k) => !["domain", "workspace", "subject"].includes(k)) || !["LAB", "SHIFT", "PATH"].includes(scope.domain) || !id(scope.workspace) || !id(scope.subject)) throw new TypeError("Trail: invalid practice scope");
          return `${scope.domain}/${scope.workspace}/${scope.subject}`;
        };
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
              if (Object.keys(m).some((k) => !keys.includes(k) && k !== "responseFormat") || keys.some((k) => !Object.hasOwn(m, k)) || !id(m.skillId) || !event.conceptIds.includes(m.skillId) || !id(m.familyKey) || !["listening", "reading"].includes(m.modality) || ![1, 2, 3].includes(m.difficulty) || Object.hasOwn(m, "responseFormat") && !["binary-choice", "single-choice", "cup-compose", "action", "unknown"].includes(m.responseFormat) || typeof m.audioRequired !== "boolean" || typeof m.confounded !== "boolean") throw new TypeError("Trail: invalid measurement contract");
            }
          } else if (event.type === TYPES[1]) {
            if (![event.presentationId, event.helpId, event.contentRef].every(id) || !["cue", "explanation", "answer"].includes(event.level)) throw new TypeError("Trail: invalid help");
          } else if (event.type === TYPES[3]) {
            if (!id(event.presentationId) || !["pending", "completed", "failed"].includes(event.audio)) throw new TypeError("Trail: invalid audio delivery");
          } else if (!id(event.presentationId) || !Number.isInteger(event.attemptNo) || event.attemptNo < 1 || !VERDICTS.includes(event.verdict) || !uniqueList(event.errorTags, tag, 24) || event.reason != null && !["motor", "audio", "unanswered", "demo", "visual", "storage"].includes(event.reason)) throw new TypeError("Trail: invalid attempt");
          return event;
        }
        function checkLink(events, event) {
          validate(event);
          const prior = events.find((e) => e.id === event.id);
          if (prior) {
            if (JSON.stringify(prior) !== JSON.stringify(event)) throw new Error("Trail: conflicting event id");
            return event;
          }
          const presented = event.type === TYPES[0];
          const parent = events.find((e) => e.id === (presented ? event.decisionId : event.presentationId));
          if (!parent || parent.type !== (presented ? "decision.made" : TYPES[0]) || key(parent.scope) !== key(event.scope) || time(parent.at) > time(event.at) || time(parent.recordedAt) > time(event.recordedAt)) throw new Error("Trail: practice requires a prior parent in the same scope");
          if (event.type === TYPES[2]) {
            const attempts = events.filter((e) => e.type === TYPES[2] && e.presentationId === event.presentationId);
            if (event.attemptNo !== attempts.length + 1 || attempts.some((e) => time(e.at) > time(event.at))) throw new Error("Trail: attempt sequence must be consecutive");
          }
          return event;
        }
        function summarize(events, { scope, asOf, recordedAsOf = asOf, decisions = null } = {}) {
          const scopeId = key(scope), cutoff = time(asOf), recordedCutoff = time(recordedAsOf);
          if (!Array.isArray(events)) throw new TypeError("Trail: log must be an array");
          if (decisions !== null && (!Array.isArray(decisions) || !decisions.every(id))) throw new TypeError("Trail: invalid decision filter");
          const reported = (decisionId) => decisions === null || decisions.includes(decisionId);
          const all = [], seen = /* @__PURE__ */ new Map();
          for (const event of events) {
            if (!event || !event.scope || `${event.scope.domain}/${event.scope.workspace}/${event.scope.subject}` !== scopeId) continue;
            if (seen.has(event.id)) {
              if (JSON.stringify(seen.get(event.id)) !== JSON.stringify(event)) throw new Error("Trail: conflicting event id");
              continue;
            }
            if (TYPES.includes(event.type)) checkLink(all, event);
            seen.set(event.id, event);
            all.push(event);
          }
          const visible = all.filter((e) => time(e.at) <= cutoff && time(e.recordedAt) <= recordedCutoff);
          const excluded = new Set(visible.filter((e) => e.type === "record.excluded").map((e) => e.targetId));
          const arms = new Map(visible.filter((e) => e.type === "decision.made").map((e) => [e.id, e.arm ?? null]));
          const provenance = /* @__PURE__ */ new Map(), traces = /* @__PURE__ */ new Map();
          const traceKeys = (p) => [`item:${p.itemKey}`, ...p.measure ? [`family:${p.measure.familyKey}`] : []];
          visible.forEach((event, index) => {
            if (event.type === TYPES[0]) provenance.set(event.id, event);
            const p = provenance.get(event.presentationId);
            if (event.type !== TYPES[1] && event.type !== TYPES[2] || !p) return;
            for (const traceKey of traceKeys(p)) {
              if (!traces.has(traceKey)) traces.set(traceKey, []);
              traces.get(traceKey).push({ index, at: time(event.at), kind: event.type === TYPES[2] ? "attempt" : event.level === "answer" ? "answer" : "help" });
            }
          });
          const presentations = [], help = [], attempts = [], met = /* @__PURE__ */ new Map();
          const meet = (p, at, verdict) => {
            if (!met.has(p.itemKey)) met.set(p.itemKey, { itemKey: p.itemKey, conceptIds: [...p.conceptIds], at, verdict });
          };
          let excludedAttempts = 0;
          visible.forEach((event, index) => {
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
                ...event.measure ? { measure: { ...copy(event.measure), responseFormat: event.measure.responseFormat || "unknown" } } : {}
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
            const at = time(event.at);
            const before = traceKeys(p).flatMap((traceKey) => traces.get(traceKey) || []).filter((t) => t.index !== index && (t.index < index || t.at < at));
            const assisted = before.some((t) => t.kind !== "attempt") ? true : p.firstExposure === true ? false : null;
            const exposure = before.some((t) => t.kind !== "help") || p.firstExposure === false ? "repeat" : p.firstExposure === true ? "new" : "unknown";
            const audio = visible.slice(0, index).filter((e) => e.type === TYPES[3] && e.presentationId === p.id).at(-1)?.audio || "pending";
            const usableDelivery = !p.measure || !p.measure.confounded && (!p.measure.audioRequired || audio === "completed");
            meet(p, event.at, omitted ? null : event.verdict);
            if (!reported(p.decisionId)) return;
            if (omitted) {
              excludedAttempts += 1;
              return;
            }
            attempts.push({
              eventId: event.id,
              at: event.at,
              recordedAt: event.recordedAt,
              presentationId: p.id,
              decisionId: p.decisionId,
              arm: arms.get(p.decisionId) ?? null,
              taskId: p.taskId,
              taskVersion: p.taskVersion,
              itemKey: p.itemKey,
              conceptIds: [...p.conceptIds],
              attemptNo: event.attemptNo,
              verdict: event.verdict,
              errorTags: [...event.errorTags],
              assisted,
              exposure,
              ...p.measure ? { measure: { ...copy(p.measure), responseFormat: p.measure.responseFormat || "unknown" }, audio, exclusionReason: event.reason || (p.measure.confounded ? "visual" : !usableDelivery ? "audio" : null) } : {},
              independent: usableDelivery && assisted === false && exposure === "new" && ["correct", "incorrect"].includes(event.verdict)
            });
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
        return Object.freeze({ VERSION, TYPES, validate, checkLink, summarize, openHistory, remember, growth });
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
        const VERSION = "atlas-2.2.0";
        const POLICIES = ["atlas-1.0.0", "atlas-2.0.0", "atlas-2.1.0", VERSION];
        const trail = () => {
          const module2 = getTrail();
          if (!module2 || typeof module2.validate !== "function" || typeof module2.checkLink !== "function" || typeof module2.summarize !== "function") throw new Error("Atlas: Trail practice module unavailable");
          return module2;
        };
        const isPractice = (event) => typeof event?.type === "string" && event.type.startsWith("practice.");
        const DOMAINS = ["LAB", "SHIFT", "PULSE", "PATH"];
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
        function admit(events, event) {
          validate(event);
          const previous = events.find((e) => e.id === event.id);
          if (previous) {
            if (JSON.stringify(previous) !== JSON.stringify(event)) throw new Error("Atlas: conflicting event id");
            return false;
          }
          if (isPractice(event)) trail().checkLink(events, event);
          if (event.type === "feedback.given") {
            const completion = events.find((e) => e.id === event.completionId && e.type === "experience.completed");
            if (!completion || scopeKey(completion.scope) !== scopeKey(event.scope) || ms(completion.at) > ms(event.at)) throw new Error("Atlas: feedback requires a prior completion in the same scope");
          }
          if (event.type === "experience.completed") {
            const decision = events.find((e) => e.type === "decision.made" && e.id === event.decisionId);
            if (!decision || scopeKey(decision.scope) !== scopeKey(event.scope) || decision.variant !== event.variant || decision.experienceId !== event.experienceId || ms(decision.at) > ms(event.at)) throw new Error("Atlas: completion requires the delivered decision");
          }
          if (event.type === "outcome.observed") {
            const decision = events.find((e) => e.type === "decision.made" && e.id === event.decisionId);
            if (!decision || scopeKey(decision.scope) !== scopeKey(event.scope) || ms(decision.at) > ms(event.at)) throw new Error("Atlas: outcome requires a prior decision in the same scope");
            if (event.attemptId != null) {
              const attempt = events.find((e) => e.type === "practice.attempted" && e.id === event.attemptId);
              if (!attempt || scopeKey(attempt.scope) !== scopeKey(event.scope) || ms(attempt.at) > ms(event.at) || ms(attempt.recordedAt) > ms(event.recordedAt)) throw new Error("Atlas: outcome proof requires a prior attempt in the same scope");
            }
          }
          if (event.type === "record.excluded") {
            const target = events.find((e) => e.id === event.targetId);
            if (!target || target.type === "record.excluded" || scopeKey(target.scope) !== scopeKey(event.scope)) throw new Error("Atlas: invalid exclusion target");
          }
          return true;
        }
        function append(events, event) {
          return admit(events, event) ? [...copy(events), copy(event)] : copy(events);
        }
        function read(events, scope, asOf, recordedAsOf = asOf) {
          const key = scopeKey(scope), cutoff = ms(asOf), recordedCutoff = ms(recordedAsOf);
          const ordered = events.map(validate).filter((e) => scopeKey(e.scope) === key && ms(e.at) <= cutoff && ms(e.recordedAt) <= recordedCutoff).sort((a, b) => ms(a.at) - ms(b.at) || ms(a.recordedAt) - ms(b.recordedAt));
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
          const completed = new Map(ordered.filter((e) => e.type === "experience.completed" && !excluded.has(e.id)).map((e) => [e.id, e]));
          const responses = /* @__PURE__ */ new Map();
          if (personal) for (const event of ordered) {
            if (event.type !== "feedback.given" || !completed.has(event.completionId)) continue;
            if (cutoff - ms(event.at) > RECENT) continue;
            const completion = completed.get(event.completionId);
            if (ms(completion.at) <= ms(event.at)) responses.set(event.completionId, copy({ ...event, experienceId: completion.experienceId, variant: completion.variant }));
          }
          const decisions = new Map(ordered.filter((e) => e.type === "decision.made" && !excluded.has(e.id)).map((e) => [e.id, e]));
          const latestOutcome = /* @__PURE__ */ new Map();
          if (personal) for (const event of ordered) {
            if (event.type === "outcome.observed" && !excluded.has(event.id) && decisions.has(event.decisionId)) latestOutcome.set(`${event.decisionId}|${event.measure}|${event.window}|${event.targetLine ?? ""}`, event);
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
            outcomes: [...latestOutcome.values()].map(copy),
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
          const feasible = (item) => !(c.audio === "off" && item.requiresAudio) && !(c.time === "short" && item.minutes > 5);
          const eligible = candidates.filter((item) => {
            if (!validId(item.id) || ids.has(item.id) || !Number.isFinite(item.minutes) || item.minutes <= 0 || !["short", "standard", "deep"].includes(item.pace)) throw new TypeError("Atlas: invalid candidate");
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
          const attempts = state.outcomes.some((o) => o.attemptId) ? new Map(trail().summarize(events, { scope, asOf: at, recordedAsOf: recordedAt }).attempts.map((item) => [item.eventId, item])) : /* @__PURE__ */ new Map();
          const improved = (leverId, optionId, line) => state.outcomes.find((o) => {
            if (o.value == null || o.value < 0.8 || o.assisted !== false || o.measure !== "independent" || o.targetLine !== line.key || view.cutoff - ms(o.at) > RECENT || ms(o.at) < ms(line.at) || picked(view.decisions.get(o.decisionId), leverId) !== optionId) return false;
            const attempt = attempts.get(o.attemptId);
            const concept = line.key.replace(/^(need|due):/, "").replace(/^(skill|node)\./, "");
            return attempt && attempt.decisionId === o.decisionId && attempt.exposure === "new" && attempt.independent === true && attempt.assisted === false && attempt.verdict === "correct" && attempt.conceptIds.includes(concept) && ms(attempt.at) >= ms(line.at) && ms(attempt.at) <= ms(o.at) && ms(attempt.recordedAt) <= ms(o.recordedAt) && view.cutoff - ms(attempt.at) <= RECENT;
          });
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
                const refs = [result.id, result.attemptId, attempts.get(result.attemptId).presentationId, ...line.evidence];
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
          const scored = eligible.map((item) => {
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
              if (!answer) s += 0.25;
              else if (answer.value === "helpful") {
                s += 1;
                helped += 1;
                proof.push(answer.id, done.id);
              } else if (answer.value === "not_fit") {
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
          let log = [];
          for (const event of events) {
            if (scopeKey(event.scope) !== scopeKey(scope)) throw new Error("Atlas: scope mismatch");
            if (admit(log, event)) log.push(copy(event));
          }
          let sequence = 0;
          const nextId = id || (() => `a${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
          const record = (body) => {
            const at = clock(), event = { ...body, schema: 1, scope: copy(scope), id: nextId(), at, recordedAt: at };
            if (admit(log, event)) log.push(copy(event));
            return copy(event);
          };
          return {
            events: () => copy(log),
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
              const existing = log.find((e) => e.type === "experience.completed" && e.decisionId === decision.id);
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
          submit(response, { skipped = false, reason = null } = {}) {
            if (broken) throw new Error("Core: practice record incomplete");
            const result = diagnose({ map, task, assessment: skipped ? { verdict: "skipped", errorTags: [] } : assess(response) });
            const event = guarded(() => session.practice("attempted", {
              presentationId: presentation.id,
              attemptNo: attempts + 1,
              verdict: result.verdict,
              errorTags: result.errorTags,
              ...reason ? { reason } : {}
            }));
            attempts += 1;
            if (!met) met = { itemKey: task.itemKey, conceptIds, at: event.at, verdict: result.verdict };
            return { ...result, eventId: event.id, attemptNo: attempts };
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
      function learningReason({ status, label }) {
        const reasons = {
          unseen: `${label}는 아직 기록이 적어요. 짧게 확인해 봐요.`,
          checking: `${label}를 조금 더 확인해 봐요.`,
          practice: `최근 놓친 ${label}를 조금 더 연습해 봐요.`,
          supported: `${label}를 도움과 함께 해냈어요. 이어서 살펴봐요.`,
          "recent-independent": `${label}를 최근 혼자 해냈어요. 가볍게 이어가요.`,
          review: `${label}를 다시 살펴볼 때예요.`
        };
        if (!Object.hasOwn(reasons, status) || typeof label !== "string") throw new TypeError("Vellum: invalid learning reason");
        return reasons[status];
      }
      module.exports = { SUPPORTS, STUCK, reviewOpen, offerCue, learningReason };
    }
  });

  // atlas/learning.js
  var require_learning = __commonJS({
    "atlas/learning.js"(exports, module) {
      "use strict";
      var POLICY = Object.freeze({ version: "learning-priority-2", recentDays: 30, reviewDays: 7, sample: 4, stableRatio: 0.8 });
      var RESPONSE_FORMATS = Object.freeze(["binary-choice", "single-choice", "cup-compose", "action", "unknown"]);
      var { learningReason } = require_vellum();
      var DAY = 864e5;
      function formatEvidence(rows, { now, complete, difficulty, responseFormat }) {
        const unique = /* @__PURE__ */ new Map();
        for (const a of rows) if (complete && a.independent && !unique.has(a.measure.familyKey)) unique.set(a.measure.familyKey, a);
        const valid = [...unique.values()].filter((a) => Date.parse(a.at) <= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
        const recent = valid.filter((a) => now - Date.parse(a.at) <= POLICY.recentDays * DAY).slice(-12);
        const n = recent.length, correct = recent.filter((a) => a.verdict === "correct").length, incorrect = n - correct;
        const lastAt = valid.at(-1)?.at || null;
        const helped = rows.filter((a) => a.assisted === true && a.verdict === "correct" && Date.parse(a.at) <= now && now - Date.parse(a.at) <= POLICY.recentDays * DAY);
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
          unassessed: rows.filter((a) => a.verdict === "unassessed" || a.verdict === "skipped").length
        };
      }
      function summarizeLearning({ summary, map, complete = true }) {
        const now = Date.parse(summary.asOf);
        const skills = map.allNodes().filter((n) => n.kind === "skill").map((node) => {
          const all = summary.attempts.filter((a) => a.measure?.skillId === node.id);
          const levels = {};
          for (const difficulty of [1, 2, 3]) {
            const rows = all.filter((a) => a.measure.difficulty === difficulty);
            const formats = Object.fromEntries(RESPONSE_FORMATS.map((responseFormat) => [
              responseFormat,
              formatEvidence(rows.filter((a) => (a.measure.responseFormat || "unknown") === responseFormat), { now, complete, difficulty, responseFormat })
            ]));
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
      function recommend({ profile, candidates, presentations = [], audioAvailable = true, excludeIds = [] }) {
        if (!Array.isArray(candidates)) throw new TypeError("Core: candidates must be an array");
        const ids = /* @__PURE__ */ new Set(), skills = new Map(profile.skills.map((s) => [s.id, s]));
        const ranked = [];
        for (const candidate of candidates) {
          if (!candidate || typeof candidate.id !== "string" || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(candidate.id) || ids.has(candidate.id) || !Array.isArray(candidate.skillIds) || !candidate.skillIds.length || !candidate.skillIds.every((id) => skills.has(id)) || ![1, 2, 3].includes(candidate.difficulty) || !["listening", "reading"].includes(candidate.modality) || !RESPONSE_FORMATS.includes(candidate.responseFormat ?? "unknown") || candidate.skillIds.some((id) => skills.get(id).domain !== candidate.modality)) throw new TypeError("Core: invalid learning candidate");
          ids.add(candidate.id);
          if (excludeIds.includes(candidate.id) || !audioAvailable && candidate.modality === "listening") continue;
          const responseFormat = candidate.responseFormat ?? "unknown";
          const states = candidate.skillIds.map((id) => ({ ...skills.get(id).levels[candidate.difficulty].formats[responseFormat], skill: skills.get(id) }));
          const focus = states.sort((a, b) => b.priority - a.priority)[0];
          const previous = presentations.filter((p) => p.taskId === candidate.id || candidate.itemKey && p.itemKey === candidate.itemKey);
          const recent = presentations.slice(-4), immediate = recent.some((p) => p.taskId === candidate.id || candidate.itemKey && p.itemKey === candidate.itemKey);
          const readyForHarder = candidate.difficulty === 1 || candidate.skillIds.every((id) => skills.get(id).levels[candidate.difficulty - 1].formats[responseFormat].status === "recent-independent");
          const score = focus.priority - (immediate ? 0.45 : 0) - (previous.length ? 0.1 : 0) - (!readyForHarder ? 0.25 * (candidate.difficulty - 1) : 0);
          ranked.push({ candidate, focus, score, count: previous.length });
        }
        ranked.sort((a, b) => b.score - a.score || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));
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
      module.exports = { POLICY, RESPONSE_FORMATS, summarizeLearning, recommend };
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
        const taskKey = (p) => JSON.stringify([p.taskId, p.taskVersion, p.itemKey, [...p.conceptIds].sort()]);
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
              if (!(a.independent === true && a.assisted === false && a.exposure === "new" && ["correct", "incorrect"].includes(a.verdict))) continue;
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
        return Object.freeze({ VERSION, measure, compare });
      });
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
      var FATAL = /* @__PURE__ */ new Set(["REVISION_CONFLICT", "LEARNING_DISABLED", "EVENT_CONFLICT", "INVALID_EVENTS", "INVALID_RESPONSE", "STORAGE_ERROR", "UNAUTHORIZED"]);
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
        let state = { version: 1, accountKey, revision, cursor: 0, complete: false, acknowledged: [], pending: [] };
        let phase = "idle", code = null, message = null, stopped = false, started = false, generation = 0, running = null, timer = null;
        const controllers = /* @__PURE__ */ new Set();
        const status = () => ({
          phase,
          code,
          message,
          revision,
          cursor: state.cursor,
          queued: state.pending.length,
          complete: state.complete && phase !== "blocked" && phase !== "stopped",
          accountKey,
          durable: code !== "STORAGE_ERROR"
        });
        const publish = () => {
          try {
            onStatus(status());
          } catch {
          }
        };
        const block = (error) => {
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
            const stored = JSON.parse(raw);
            if (!stored || stored.version !== 1 || stored.accountKey !== accountKey || !Number.isSafeInteger(stored.cursor) || stored.cursor < 0 || typeof stored.complete !== "boolean" || !Array.isArray(stored.acknowledged) || !stored.acknowledged.every(id) || !Array.isArray(stored.pending) || stored.pending.some((e) => !id(e?.id)) || stored.pending.length + stored.acknowledged.length > 4e4) throw failure("STORAGE_ERROR", "Atlas sync: unreadable outbox; preserved without replacement");
            if (stored.revision !== revision) throw failure("REVISION_CONFLICT", "Atlas sync: a new consent revision requires a fresh account store");
            state = stored;
          }
          port.markComplete(state.complete);
        } catch (error) {
          block(error?.code ? error : failure("STORAGE_ERROR", "Atlas sync: unreadable outbox; preserved without replacement"));
        }
        const collect = () => {
          const known = new Map(state.pending.map((event) => [event.id, event])), acknowledged = new Set(state.acknowledged);
          const local = port.events(), localById = new Map(local.map((event) => [event.id, event]));
          if (state.pending.some((event) => !localById.has(event.id) || !sameEvent(localById.get(event.id), event))) throw failure("STORAGE_ERROR", "Atlas sync: queued history does not match its account log");
          for (const event of local) {
            if (known.has(event.id) && !sameEvent(known.get(event.id), event)) throw failure("EVENT_CONFLICT", "Atlas sync: conflicting queued event");
            if (!known.has(event.id) && !acknowledged.has(event.id)) {
              known.set(event.id, event);
              state.pending.push(clone(event));
            }
          }
          save();
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
            try {
              port.importEvents(response.events);
            } catch (error) {
              throw failure(error?.code || "INVALID_EVENTS", error.message);
            }
            const remote = new Set(state.acknowledged);
            for (const event of response.events) remote.add(event.id);
            state.acknowledged = [...remote];
            state.pending = state.pending.filter((event) => !remote.has(event.id));
            state.cursor = response.cursor;
            if (!response.hasMore) state.complete = true;
            save();
            port.markComplete(state.complete);
            publish();
            if (!response.hasMore) return;
          }
          throw failure("INVALID_RESPONSE", "Atlas sync: page limit exceeded");
        };
        const flushQueue = async (token) => {
          let emptyAcks = 0;
          for (let batch = 0; batch < maxPages; batch++) {
            collect();
            if (!state.pending.length) return;
            const events = state.pending.slice(0, batchSize).map(clone), sent = new Set(events.map((event) => event.id));
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
            state.pending = state.pending.filter((event) => !accepted.has(event.id));
            save();
            publish();
          }
          throw failure("NETWORK_ERROR", "Atlas sync: batch limit reached; remaining events stay queued");
        };
        function run(pullOnly = false) {
          if (running) return running;
          if (stopped || phase === "blocked") return Promise.resolve(status());
          const token = generation;
          phase = "syncing";
          code = null;
          message = null;
          publish();
          running = (async () => {
            try {
              await pullPages(token);
              if (active(token) && !pullOnly) await flushQueue(token);
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
        accountKey = null
      } = {}) {
        if (!identifier(gameId) || !identifier(learnerKey) || typeof map?.allNodes !== "function") throw new TypeError("Atlas: game, local scope and Strata map required");
        if (!["device", "account"].includes(storageScope) || storageScope === "account" && (!identifier(accountKey) || learnerKey !== "device")) throw new TypeError("Atlas: account identity and isolated host storage required");
        const scope = { domain: "LAB", workspace: "learning", subject: learnerKey };
        const key = `${KEY}.${learnerKey}`;
        let epoch = null, session, readable = true, writable = !!storage, complete = historyComplete, warning = null;
        const UNCHANGED = /* @__PURE__ */ Symbol("unchanged-history");
        let lastStoredRaw = /* @__PURE__ */ Symbol("unread-history");
        let lastTime = 0;
        const active = /* @__PURE__ */ new Map();
        const listeners = /* @__PURE__ */ new Set();
        const notify = (kind) => {
          for (const listener of listeners) {
            try {
              listener({ kind });
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
        const newSession = (events) => {
          lastTime = Math.max(lastTime, ...events.map((e) => Date.parse(e.at)).filter(Number.isFinite));
          return Atlas.createSession({ scope, events, clock: monotonicClock });
        };
        const decode = (raw) => {
          if (raw == null) return null;
          const value = JSON.parse(raw);
          if (!value || value.version !== 1 || !identifier(value.epoch) || !Array.isArray(value.events) || value.events.length > 2e4 || Object.keys(value).some((k) => !["version", "epoch", "events", "owner"].includes(k))) throw new Error("Atlas: unreadable history");
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
            return null;
          }
        }
        const initial = readStored();
        epoch = initial?.epoch || uid();
        session = newSession(initial?.events || []);
        function refresh() {
          if (!readable || !storage) return;
          const stored = readStored();
          if (!stored || stored === UNCHANGED) return;
          if (stored.epoch !== epoch) {
            epoch = stored.epoch;
            session = newSession(stored.events);
            active.clear();
            return;
          }
          const combined = session.events(), known = new Map(combined.map((e) => [e.id, e]));
          for (const e of stored.events) {
            if (known.has(e.id)) {
              if (!sameEvent(known.get(e.id), e)) {
                readable = false;
                complete = false;
                throw new Error("Atlas: conflicting stored event");
              }
            } else {
              known.set(e.id, e);
              combined.push(e);
            }
          }
          session = newSession(combined);
        }
        function persist(kind = "append") {
          if (!storage || !readable) {
            complete = false;
            return false;
          }
          try {
            const events = session.events();
            if (events.length > 2e4) throw new Error("Atlas: local history limit");
            const raw = JSON.stringify({ version: 1, epoch, events, ...storageScope === "account" ? { owner: accountKey } : {} });
            storage.setItem(key, raw);
            lastStoredRaw = raw;
            writable = true;
            notify(kind);
            return true;
          } catch {
            writable = false;
            complete = false;
            warning = "기록을 저장하지 못했어요. 이번 연습은 다음 접속에 이어지지 않을 수 있어요.";
            return false;
          }
        }
        if (!initial && readable && storage) persist();
        const practiceSession = { practice: (...args) => session.practice(...args) };
        function view() {
          const events = session.events(), state = session.state();
          return Trail.summarize(events, { scope, asOf: state.asOf });
        }
        function summary() {
          refresh();
          const observed = view();
          return {
            ...Learning.summarizeLearning({ summary: observed, map, complete: complete && readable && writable }),
            storage: { available: readable && writable, scope: storageScope, warning },
            counts: Temper.measure(observed)
          };
        }
        function requireActive(pid) {
          refresh();
          const item = active.get(pid);
          if (!item) throw new Error("Atlas: presentation ended or local record reset");
          return item;
        }
        return {
          syncPort: Object.freeze({
            scope: storageScope,
            accountKey,
            events() {
              refresh();
              return session.events();
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
              if (!Array.isArray(incoming)) throw new TypeError("Atlas: imported events must be an array");
              const combined = session.events(), previousLength = combined.length, known = new Map(combined.map((event) => [event.id, event]));
              for (const event of incoming) {
                if (known.has(event?.id)) {
                  if (!sameEvent(known.get(event.id), event)) throw Object.assign(new Error("Atlas: conflicting imported event"), { code: "EVENT_CONFLICT" });
                } else {
                  known.set(event?.id, event);
                  combined.push(event);
                }
              }
              const imported = newSession(combined);
              session = imported;
              if (!persist("import")) throw Object.assign(new Error("Atlas: imported history could not be saved"), { code: "STORAGE_ERROR" });
              return { added: combined.length - previousLength };
            }
          }),
          summary,
          recommend(candidates, options = {}) {
            const profile = summary();
            return { ...Learning.recommend({ profile, candidates, presentations: view().presentations, ...options }), storage: profile.storage };
          },
          present(item) {
            refresh();
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
            const raw = session.events(), presented = new Map(raw.filter((e) => e.type === "practice.presented").map((e) => [e.id, e]));
            const seen = raw.some((e) => {
              const p = presented.get(e.presentationId);
              return p && (p.itemKey === item.itemKey || p.measure?.familyKey === measure.familyKey) && (e.type === "practice.attempted" || e.type === "practice.helped" && e.level === "answer");
            });
            const profile = Learning.summarizeLearning({ summary: view(), map, complete: complete && readable && writable });
            const basis = profile.skills.find((s) => s.id === item.skillId).levels[item.difficulty].formats[measure.responseFormat];
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
              }
            }]);
            const task = { id: item.id, version: map.map_ver, itemKey: item.itemKey, concepts: [item.skillId], tags: [], measure };
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
            const attemptNo = result.attemptNo ?? 1;
            if (!Number.isInteger(attemptNo) || attemptNo < 1 || attemptNo > p.results.length + 1) throw new TypeError("Atlas: attempts must be consecutive");
            if (p.results[attemptNo - 1]) return { ...p.results[attemptNo - 1] };
            const reason = p.measure.confounded ? result.reason || "visual" : p.measure.audioRequired && p.audio !== "completed" ? "audio" : !readable || !writable ? "storage" : result.reason;
            const assessable = result.assessable && !p.measure.confounded && (!p.measure.audioRequired || p.audio === "completed") && readable && writable;
            const attempt = p.practice.submit({ ...result, assessable }, { reason: reason || null });
            session.complete(p.decision);
            persist();
            const actual = view().attempts.find((a) => a.eventId === attempt.eventId);
            const recorded = { ...attempt, independent: !!actual?.independent && complete && writable, reason: reason || null };
            p.results.push(recorded);
            return { ...recorded };
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
          reset() {
            if (storageScope === "account") throw Object.assign(new Error("Atlas: account deletion requires the host consent/reset API; local reset cannot delete server records"), { code: "ACCOUNT_RESET_REQUIRED" });
            epoch = uid();
            session = newSession([]);
            active.clear();
            readable = true;
            writable = !!storage;
            complete = historyComplete;
            warning = null;
            persist();
            return summary();
          }
        };
      }
      module.exports = { createGame, createLearningSync, summarizeLearning: Learning.summarizeLearning, recommend: Learning.recommend, POLICY: Learning.POLICY, RESPONSE_FORMATS: Learning.RESPONSE_FORMATS, KEY };
    }
  });

  // atlas/game-browser.js
  var require_game_browser = __commonJS({
    "atlas/game-browser.js"(exports, module) {
      var { createMap } = require_strata();
      var curriculum = require_topik_i();
      var learning = require_game_learning();
      var map = createMap(curriculum);
      module.exports = { ...learning, SKILLS: map.allNodes(), createGame: (options) => learning.createGame({ ...options, map }) };
    }
  });
  return require_game_browser();
})();
