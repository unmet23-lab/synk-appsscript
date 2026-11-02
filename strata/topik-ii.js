'use strict';
// Opt-in TOPIK II unit curriculum. The existing ability-only map and learning store stay intact.
// The builder supplies source hashes; this module has no I/O, learner state or grading.
const { validateMap } = require('./index');
const CONTAINERS = Object.freeze(['drama', 'cafe', 'club', 'reading', 'listening', 'writing']);
const SOURCE = Object.freeze({ units: 'unit-curriculum', grammar: 'unit-grammar', types: 'unit-exam-types' });
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' && value.trim().length > 0;
const fail = message => { throw new TypeError(`Strata units: ${message}`); };
const unitNodeId = id => `ko2.unit.${id}`;
const taskNodeId = (id, container) => `ko2.task.${id}.${container}`;
const wordNodeId = word => `ko2.word.${word.level}.${word.no}`;
const ref = (source, selector) => ({ source, selector });

function buildUnitMap({ base, grammar, units, types, sources }) {
  validateMap(base);
  if (!text(units?.version) || !Array.isArray(units.units) || !units.units.length
    || units.status !== 'ai_draft' || units.reviewed !== false) fail('expected an unreviewed unit source');
  if (!Array.isArray(grammar?.points) || !/^[a-f0-9]{64}$/.test(grammar.standard?.sha256)
    || !Array.isArray(types?.types)) fail('invalid grammar or exam source');
  if (!sources || Object.keys(sources).length !== Object.keys(SOURCE).length
    || Object.values(SOURCE).some(key => !sources[key] || Object.hasOwn(base.sources, key))) fail('missing or colliding sources');
  const points = new Map();
  for (const row of grammar.points) {
    const [id, form, related, level] = row;
    if (!/^S[34]\d{2}$/.test(id) || points.has(id) || !text(form) || !Array.isArray(related)
      || related.some(value => !text(value)) || level !== Number(id[1])) fail(`invalid grammar ${id}`);
    points.set(id, row);
  }
  const abilities = new Set(base.nodes.filter(node => node.kind === 'skill').map(node => node.id));
  const examTypes = new Set(types.types.filter(type => type.exam === 'topik-ii').map(type => type.id));
  const state = { confidence: units.status, reviewed: units.reviewed };
  const nodes = [], grammarNodes = new Map(), wordNodes = new Map(), goals = [];
  const seenUnits = new Set(), seenGrammar = new Set();
  let previous = 0;
  for (const unit of units.units) {
    if (!/^U\d{2}$/.test(unit.id) || seenUnits.has(unit.id) || Number(unit.id.slice(1)) <= previous
      || !text(unit.title) || !Number.isInteger(unit.level) || unit.level < 3 || unit.level > 4) fail(`invalid unit ${unit.id}`);
    seenUnits.add(unit.id); previous = Number(unit.id.slice(1));
    const uniqueList = (list, allowed, name) => {
      if (!Array.isArray(list) || !list.length || new Set(list).size !== list.length || list.some(id => !allowed.has(id))) fail(`invalid ${name} in ${unit.id}`);
    };
    uniqueList(unit.skills, abilities, 'skills');
    uniqueList(unit.topik_types, examTypes, 'exam types');
    if (!Array.isArray(unit.grammar) || !unit.grammar.length || !Array.isArray(unit.words) || !unit.words.length
      || !text(unit.measure?.B) || !text(unit.measure?.C)) fail(`missing material in ${unit.id}`);
    if (!unit.containers || Object.keys(unit.containers).length !== CONTAINERS.length
      || CONTAINERS.some(key => unit.containers[key] !== null && !text(unit.containers[key]))) fail(`invalid containers in ${unit.id}`);
    const unitRefs = [ref(SOURCE.units, `units.${unit.id}`)];
    const ownGrammar = new Set(), ownWords = new Set();
    for (const item of unit.grammar) {
      const row = points.get(item.id);
      if (!row || row[1] !== item.form || ownGrammar.has(item.id) || !text(item.use)
        || (item.review ? row[3] >= unit.level : row[3] !== unit.level)
        || Boolean(item.again) !== (!item.review && seenGrammar.has(item.id))) fail(`invalid grammar reference ${unit.id}/${item.id}`);
      ownGrammar.add(item.id);
      if (!grammarNodes.has(item.id)) {
        const [id, label_ko, related, level, category, meaning, bank] = row;
        grammarNodes.set(id, { id, kind: 'grammar_point', label_ko, forms: [label_ko, ...related],
          level: { intro: level, basis: 'standard_curriculum' }, category, meaning, bank, ...state,
          source_refs: [ref(SOURCE.grammar, id)] });
      }
    }
    for (const id of ownGrammar) seenGrammar.add(id);
    for (const word of unit.words) {
      if (!text(word.word) || !/^[1-4]$/.test(word.level) || Number(word.level) > unit.level
        || !Number.isSafeInteger(word.no) || word.no < 1 || Boolean(word.review) !== (Number(word.level) < 3)) fail(`invalid word in ${unit.id}`);
      const id = wordNodeId(word), existing = wordNodes.get(id);
      if (ownWords.has(id) || existing && existing.label_ko !== word.word) fail(`conflicting word ${id}`);
      ownWords.add(id);
      const sourceRef = ref(SOURCE.units, `units.${unit.id}.words.${word.level}.${word.no}`);
      if (existing) existing.source_refs.push(sourceRef);
      else wordNodes.set(id, { id, kind: 'word', label_ko: word.word,
        level: { intro: Number(word.level), basis: 'standard_curriculum' }, standard_no: word.no, ...state, source_refs: [sourceRef] });
    }
    const tasks = CONTAINERS.filter(key => unit.containers[key] !== null).map(container => ({
      id: taskNodeId(unit.id, container), kind: 'task', label_ko: unit.containers[container],
      level: { intro: unit.level, basis: 'unit_draft' }, ...state, source_refs: unitRefs,
      material: { unit_id: unit.id, container, brief: unit.containers[container] },
    }));
    if (!tasks.length) fail(`no tasks in ${unit.id}`);
    nodes.push({ id: unitNodeId(unit.id), kind: 'topic', label_ko: unit.title,
      level: { intro: unit.level, basis: 'unit_draft' }, ...state, source_refs: unitRefs,
      material: { ...clone(unit), word_ids: [...ownWords], task_ids: tasks.map(task => task.id) } }, ...tasks);
    goals.push({ goal: unit.id, nodes: tasks.map(task => task.id), ...state, source_refs: unitRefs });
  }
  for (const level of [...new Set(units.units.map(unit => unit.level))]) {
    const selected = units.units.filter(unit => unit.level === level);
    goals.push({ goal: `topik-${level}`, nodes: selected.map(unit => unitNodeId(unit.id)), ...state,
      source_refs: selected.map(unit => ref(SOURCE.units, `units.${unit.id}`)) });
  }
  // Membership is in material/goal links. part_of still means grammar -> skill, and no draft
  // unit order becomes a prerequisite. In particular, a speaking brief does not acquire a reading skill.
  const result = clone({ ...base, map_ver: units.version,
    sources: { ...base.sources, ...sources },
    nodes: [...base.nodes, ...grammarNodes.values(), ...wordNodes.values(), ...nodes],
    links: { ...base.links, goals: [...(base.links.goals || []), ...goals] } });
  validateMap(result);
  return result;
}

// Use the same createMap result for this lookup and Game.createGame({map}). A task is a brief;
// its primary skill and actually tested grammar/words must still be authored on each practice item.
function unitPath(map, id) {
  if (typeof map?.getNode !== 'function' || typeof map.forGoal !== 'function') fail('a map is required');
  if (typeof id !== 'string' || !/^U\d{2}$/.test(id)) return null;
  const unit = map.getNode(unitNodeId(id));
  if (unit?.kind !== 'topic' || unit.material?.id !== id) return null;
  const resolve = (ids, kind) => Object.freeze(ids.map(nodeId => {
    const node = map.getNode(nodeId);
    if (node?.kind !== kind) fail(`missing ${kind} ${nodeId}`);
    return node;
  }));
  return Object.freeze({ unit, tasks: resolve(unit.material.task_ids, 'task'),
    grammar: resolve(unit.material.grammar.map(item => item.id), 'grammar_point'),
    words: resolve(unit.material.word_ids, 'word'), skills: resolve(unit.material.skills, 'skill') });
}

module.exports = { buildUnitMap, unitPath, CONTAINERS };
