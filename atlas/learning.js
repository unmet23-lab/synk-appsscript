'use strict';
// Core: operational practice priorities, NOT calibrated proficiency or TOPIK grades.
// Receives Trail provenance and Strata nodes; owns neither identity nor storage.
const POLICY = Object.freeze({ version: 'learning-priority-3', recentDays: 30, reviewDays: 7, sample: 4, stableRatio: .8 });
const RESPONSE_FORMATS = Object.freeze(['binary-choice', 'single-choice', 'cup-compose', 'action', 'unknown']);
const { learningReason } = require('./vellum');
const DAY = 86400000;
function formatEvidence(rows, { now, complete, difficulty, responseFormat }) {
  const unique = new Map();
  for (const a of rows) if (complete && a.independent && !unique.has(a.measure.familyKey)) unique.set(a.measure.familyKey, a);
  const valid = [...unique.values()].filter(a => Date.parse(a.at) <= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const recent = valid.filter(a => now - Date.parse(a.at) <= POLICY.recentDays * DAY).slice(-12);
  const n = recent.length, correct = recent.filter(a => a.verdict === 'correct').length, incorrect = n - correct;
  const lastAt = valid.at(-1)?.at || null;
  const helped = rows.filter(a => !a.exclusionReason && a.assisted === true && a.verdict === 'correct' && Date.parse(a.at) <= now && now - Date.parse(a.at) <= POLICY.recentDays * DAY);
  let status = 'unseen', priority = .65;
  if (lastAt && now - Date.parse(lastAt) > POLICY.reviewDays * DAY) { status = 'review'; priority = .8; }
  else if (n >= POLICY.sample && correct / n >= POLICY.stableRatio) { status = 'recent-independent'; priority = .15; }
  else if (n >= 3 && incorrect >= 2) { status = 'practice'; priority = 1; }
  else if (n) { status = 'checking'; priority = incorrect ? .85 : .55; }
  else if (helped.length) { status = 'supported'; priority = .9; }
  return { difficulty, responseFormat, status, priority, n, correct, incorrect, lastAt,
    assisted: helped.length, evidence: recent.map(a => a.eventId), unassessed: rows.filter(a => a.verdict === 'unassessed' || a.verdict === 'skipped').length };
}
function summarizeLearning({ summary, map, complete = true }) {
  const now = Date.parse(summary.asOf);
  const skills = map.allNodes().filter(n => n.kind === 'skill').map(node => {
    const all = summary.attempts.filter(a => a.measure?.skillId === node.id);
    const levels = {};
    for (const difficulty of [1, 2, 3]) {
      const rows = all.filter(a => a.measure.difficulty === difficulty);
      const formats = Object.fromEntries(RESPONSE_FORMATS.map(responseFormat => [responseFormat,
        formatEvidence(rows.filter(a => (a.measure.responseFormat || 'unknown') === responseFormat), { now, complete, difficulty, responseFormat })]));
      const observed = Object.values(formats).filter(f => f.lastAt || f.assisted);
      const focus = observed.sort((a, b) => b.priority - a.priority)[0] || Object.values(formats).find(f => f.unassessed) || formats.unknown;
      // The compatibility fields describe ONE observed format, never a pooled
      // correctness rate. Selection below always reads the exact format bucket.
      levels[difficulty] = { ...focus, formats };
    }
    const observed = Object.values(levels).filter(l => l.lastAt || l.assisted);
    const focus = observed.sort((a, b) => b.priority - a.priority || a.difficulty - b.difficulty)[0] || Object.values(levels).find(l => l.unassessed) || levels[1];
    return { id: node.id, label: node.label_ko, domain: node.domain, ...focus, levels };
  });
  return { policy: POLICY.version, skills, evidenceComplete: complete, asOf: summary.asOf,
    independent: skills.reduce((n, s) => n + Object.values(s.levels).reduce((m, l) => m + Object.values(l.formats).reduce((sum, f) => sum + f.n, 0), 0), 0),
    learningEffectClaim: false, grade: null };
}
// Missed or due content (a word, a grammar point) lifts a candidate a little; the ability's
// own state still decides first.
const CONTENT_LIFT = Object.freeze({ practice: 0.2, review: 0.1, supported: 0.05 });
function recommend({ profile, candidates, presentations = [], audioAvailable = true, excludeIds = [] }) {
  if (!Array.isArray(candidates)) throw new TypeError('Core: candidates must be an array');
  const ids = new Set(), skills = new Map(profile.skills.map(s => [s.id, s]));
  const content = new Map((profile.concepts || []).map(c => [c.id, c.status]));
  // Index history once. A changed choice/item ID is still the same content when
  // it belongs to a seen family; overlapping keys count one presentation.
  const history = { task: new Map(), item: new Map(), family: new Map() };
  for (const [index, presentation] of presentations.entries()) {
    for (const [kind, key] of [['task', presentation.taskId], ['item', presentation.itemKey],
      ['family', presentation.measure?.familyKey || presentation.itemKey]]) {
      if (!key) continue;
      if (!history[kind].has(key)) history[kind].set(key, []);
      history[kind].get(key).push(index);
    }
  }
  const ranked = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(candidate.id) || ids.has(candidate.id)
      || !Array.isArray(candidate.skillIds) || !candidate.skillIds.length || !candidate.skillIds.every(id => skills.has(id))
      || ![1, 2, 3].includes(candidate.difficulty) || typeof candidate.modality !== 'string' || !/^[a-z][a-z0-9_-]{0,40}$/.test(candidate.modality)
      || !RESPONSE_FORMATS.includes(candidate.responseFormat ?? 'unknown')
      || candidate.skillIds.some(id => skills.get(id).domain !== candidate.modality)) throw new TypeError('Core: invalid learning candidate');
    ids.add(candidate.id);
    // Any subject's modality (Strata node domain) is accepted; sound needs are explicit or listening.
    if (excludeIds.includes(candidate.id) || (!audioAvailable && (candidate.audioRequired ?? candidate.modality === 'listening'))) continue;
    const responseFormat = candidate.responseFormat ?? 'unknown';
    const states = candidate.skillIds.map(id => ({ ...skills.get(id).levels[candidate.difficulty].formats[responseFormat], skill: skills.get(id) }));
    const focus = states.sort((a, b) => b.priority - a.priority)[0];
    const previous = new Set([...(history.task.get(candidate.id) || []), ...(history.item.get(candidate.itemKey) || []),
      ...(history.family.get(candidate.familyKey || candidate.itemKey) || [])]);
    const immediate = [...previous].some(index => index >= presentations.length - 4);
    // Explicit authored difficulty is a language-complexity bucket, never a TOPIK band.
    // Sparse evidence starts with simpler candidates, while supported needs can still be revisited.
    const readyForHarder = candidate.difficulty === 1 || candidate.skillIds.every(id => skills.get(id).levels[candidate.difficulty - 1].formats[responseFormat].status === 'recent-independent');
    if (candidate.conceptIds != null && (!Array.isArray(candidate.conceptIds) || candidate.conceptIds.some(id => typeof id !== 'string'))) throw new TypeError('Core: invalid learning candidate');
    const lift = Math.max(0, ...(candidate.conceptIds || []).map(id => CONTENT_LIFT[content.get(id)] || 0));
    const score = focus.priority + lift - (immediate ? .45 : 0) - (previous.size ? .10 : 0) - (!readyForHarder ? .25 * (candidate.difficulty - 1) : 0);
    ranked.push({ candidate, focus, score, count: previous.size });
  }
  ranked.sort((a, b) => b.score - a.score || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));
  if (!ranked.length) return { status: 'unavailable', selected: null, reason: '지금 조건에 맞는 연습이 없어요.', alternatives: [] };
  const best = ranked[0], label = best.focus.skill.label;
  return { status: 'ready', selected: best.candidate, reason: learningReason({ status: best.focus.status, label }), focusSkillId: best.focus.skill.id,
    state: best.focus.status, responseFormat: best.focus.responseFormat, policy: POLICY.version, evidence: best.focus.evidence,
    alternatives: ranked.slice(1).map(r => r.candidate) };
}
// Content an item uses (words, grammar), read by the same evidence rules as abilities and
// kept per response format. Only content with observations is listed: a word never met
// is not a weakness, and nothing here is a mastery or TOPIK grade.
const CONTENT = Object.freeze(['word', 'grammar_point']);
function summarizeConcepts({ summary, map, complete = true }) {
  const now = Date.parse(summary.asOf), rows = new Map();
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
      const own = list.filter(a => (a.measure.responseFormat || 'unknown') === responseFormat);
      if (own.length) formats[responseFormat] = formatEvidence(own, { now, complete, difficulty: null, responseFormat });
    }
    const focus = Object.values(formats).sort((a, b) => b.priority - a.priority)[0];
    return { id: node.id, kind: node.kind, label: node.label_ko, status: focus.status, priority: focus.priority, formats };
  }).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}
module.exports = { POLICY, RESPONSE_FORMATS, CONTENT, summarizeLearning, summarizeConcepts, recommend, formatEvidence };
