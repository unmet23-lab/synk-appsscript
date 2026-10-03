'use strict';

// Pure curriculum lookup. This module owns no learner memory, I/O, grading or AI calls.
const CONFIDENCE = ['authored', 'measured', 'ai_draft'];
// Language kinds plus subject-neutral ones, so a map can describe any content (work, money, health...).
const KINDS = ['skill', 'grammar_point', 'expression', 'situation', 'letter', 'syllable', 'concept', 'topic', 'task', 'word'];
const TYPES = ['part_of', 'prerequisite', 'contrasts_with'];
const copy = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new TypeError(`Strata: ${message}`); };
const text = value => typeof value === 'string' && value.length > 0;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function validateMap(data) {
  if (!data || !text(data.map_ver) || !text(data.subject) || !Array.isArray(data.nodes)
    || !Array.isArray(data.edges) || !Array.isArray(data.links?.tags)
    || !Array.isArray(data.tag_vocabulary) || !data.sources || typeof data.sources !== 'object') fail('invalid map envelope');
  const ids = new Map();
  const refs = item => {
    if (!Array.isArray(item.source_refs) || !item.source_refs.length) fail('source references required');
    for (const ref of item.source_refs) {
      if (!ref || !Object.hasOwn(data.sources, ref.source) || !text(ref.selector)) fail('unknown source reference');
    }
  };
  const confidence = item => {
    if (!CONFIDENCE.includes(item.confidence) || typeof item.reviewed !== 'boolean') fail('invalid evidence status');
    refs(item);
  };
  for (const [key, source] of Object.entries(data.sources)) {
    if (!text(key) || !text(source.path) || !/^[a-f0-9]{64}$/.test(source.sha256)) fail('invalid source hash');
  }
  for (const node of data.nodes) {
    if (!text(node.id) || ids.has(node.id) || !KINDS.includes(node.kind) || !text(node.label_ko)) fail('invalid or duplicate node');
    if (node.level !== null && (!Number.isInteger(node.level?.intro) || node.level.intro < 1 || node.level.intro > 6 || !text(node.level.basis))) fail('invalid level');
    // A situation may carry the words Vellum's reason line uses for it ("주문할 때").
    if (node.when_ko !== undefined && (node.kind !== 'situation' || !text(node.when_ko))) fail('invalid situation words');
    refs(node);
    ids.set(node.id, node);
  }
  const uniqueEdges = new Set(), next = new Map();
  for (const edge of data.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || !TYPES.includes(edge.type)) fail('invalid edge endpoint or type');
    confidence(edge);
    const key = `${edge.type}\0${edge.from}\0${edge.to}`;
    if (uniqueEdges.has(key)) fail('duplicate edge');
    uniqueEdges.add(key);
    if (edge.type === 'part_of' && (ids.get(edge.from).kind !== 'grammar_point' || ids.get(edge.to).kind !== 'skill')) fail('invalid grammar membership');
    if (edge.type === 'prerequisite') {
      const before = ids.get(edge.from).level?.intro, after = ids.get(edge.to).level?.intro;
      if (before != null && after != null && before > after) fail('prerequisite level inversion');
      if (!next.has(edge.from)) next.set(edge.from, []);
      next.get(edge.from).push(edge.to);
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) fail('prerequisite cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    (next.get(id) || []).forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids.keys()) visit(id);
  const tags = new Set();
  if (new Set(data.tag_vocabulary).size !== data.tag_vocabulary.length || data.tag_vocabulary.some(tag => !text(tag))) fail('invalid tag vocabulary');
  for (const link of data.links.tags) {
    if (!data.tag_vocabulary.includes(link.tag) || tags.has(link.tag)) fail('invalid or duplicate tag');
    if (!['full', 'none'].includes(link.fit) || (link.fit === 'none' ? link.node !== null : !ids.has(link.node))) fail('tag must be exactly mapped or explicitly missing');
    if (link.fit === 'full' && ids.get(link.node).kind !== 'skill') fail('tag must reference a skill');
    confidence(link);
    tags.add(link.tag);
  }
  if (tags.size !== data.tag_vocabulary.length) fail('incomplete tag partition');
  // A declared goal (a learner's reason) leads to the situations practised for it. Optional: a map
  // without goal links has none, and an unknown goal leads nowhere.
  if (data.links.goals !== undefined) {
    if (!Array.isArray(data.links.goals)) fail('invalid goal links');
    const goals = new Set();
    for (const link of data.links.goals) {
      if (!text(link?.goal) || goals.has(link.goal)) fail('invalid or duplicate goal');
      if (!Array.isArray(link.nodes) || !link.nodes.length || new Set(link.nodes).size !== link.nodes.length
        || link.nodes.some(id => !ids.has(id))) fail('goal must lead to known nodes');
      confidence(link);
      goals.add(link.goal);
    }
  }
  return true;
}

function createMap(input) {
  validateMap(input);
  const data = freeze(copy(input));
  const nodes = new Map(data.nodes.map(node => [node.id, node]));
  const tags = new Map(data.links.tags.map(link => [link.tag, link]));
  const goals = new Map((data.links.goals || []).map(link => [link.goal, link]));
  function getNode(id) { return nodes.get(id) || null; }
  // The nodes on the way to a declared goal, in the order the map gives them. It does not judge the
  // goal; an unknown goal or one without links gives an empty list, never a similar goal's nodes.
  function forGoal(goal) {
    const link = goals.get(goal);
    return freeze(link ? link.nodes.map(getNode) : []);
  }
  function forTag(tag) {
    const link = tags.get(tag);
    return freeze({ status: !link ? 'unknown' : link.fit === 'full' ? 'exact' : 'missing', tag,
      node: link?.node ? getNode(link.node) : null, source_refs: link?.source_refs || [] });
  }
  function forSkill(id) {
    const skill = getNode(id);
    if (skill?.kind !== 'skill') return null;
    const edges = data.edges.filter(edge => edge.type === 'part_of' && edge.to === id);
    const grammar = edges.map(edge => getNode(edge.from));
    const refs = [...skill.source_refs, ...grammar.flatMap(node => node.source_refs), ...edges.flatMap(edge => edge.source_refs)];
    const sources = [...new Map(refs.map(ref => [`${ref.source}\0${ref.selector}`, ref])).values()];
    return freeze({ skill, grammar, level: skill.level, sources });
  }
  function prerequisites(id) {
    if (!nodes.has(id)) return [];
    return freeze(data.edges.filter(edge => edge.type === 'prerequisite' && edge.to === id)
      .sort((a, b) => compare(a.from, b.from)).map(edge => ({ node: getNode(edge.from),
        confidence: edge.confidence, reviewed: edge.reviewed,
        blocking: edge.confidence !== 'ai_draft' || edge.reviewed, source_refs: edge.source_refs })));
  }
  // Accept only already-qualified Atlas summary lines. Unknown, denied, estimated,
  // or unqualified observations cannot silently become curriculum recommendations.
  function candidates(state = { lines: [] }, { limit = 10 } = {}) {
    if (!Array.isArray(state.lines) || !Number.isInteger(limit) || limit < 0 || limit > 100) fail('invalid candidate input');
    if (state.mastered != null && (!Array.isArray(state.mastered) || state.mastered.some(id => !text(id)))) fail('invalid mastered nodes');
    const mastered = new Set(state.mastered || []), selected = new Map();
    for (const line of state.lines) {
      if (!line || line.usable !== true || line.status === 'denied' || line.source === 'estimated') continue;
      const match = /^(need|due):(node|skill|tag)\.(.+)$/.exec(line.key || '');
      if (!match) continue;
      const node = match[2] === 'tag' ? forTag(match[3]).node : getNode(match[3]);
      if (!node || (match[2] === 'skill' && node.kind !== 'skill')) continue;
      if (!selected.has(node.id)) selected.set(node.id, { id: node.id, targets: [], prerequisites: prerequisites(node.id), reasons: [] });
      const result = selected.get(node.id);
      if (!result.targets.includes(line.key)) result.targets.push(line.key);
      if (!result.reasons.includes(match[1])) result.reasons.push(match[1]);
    }
    return freeze([...selected.values()].sort((a, b) => compare(a.id, b.id)).map(result => ({ ...result,
      targets: result.targets.sort(compare), reasons: result.reasons.sort(compare),
      blocked_by: result.prerequisites.filter(item => item.blocking && !mastered.has(item.node.id)).map(item => item.node.id),
      advisory: result.prerequisites.filter(item => !item.blocking && !mastered.has(item.node.id)).map(item => item.node.id),
    })).slice(0, limit));
  }
  return Object.freeze({ map_ver: data.map_ver, getNode, forTag, forSkill, forGoal, prerequisites, candidates,
    allNodes: () => Object.freeze([...nodes.values()]) });
}

module.exports = { createMap, validateMap };
