'use strict';
// Core: operational practice priorities, NOT calibrated proficiency or TOPIK grades.
// Receives Trail provenance and Strata nodes; owns neither identity nor storage.
const POLICY = Object.freeze({ version: 'learning-priority-3', recentDays: 30, reviewDays: 7, sample: 4, stableRatio: .8 });
const RESPONSE_FORMATS = Object.freeze(['binary-choice', 'single-choice', 'cup-compose', 'action', 'unknown']);
const { learningReason, activityReason, SUPPORTS } = require('./vellum');
const Ledger = require('./learning-ledger');
const DAY = 86400000;
// `base` holds the rows of entries folded into a ledger (Ledger.rows): they are read with the log's.
function formatEvidence(rows, { now, complete, difficulty, responseFormat, base = null }) {
  if (base) rows = [...base.rows, ...rows];
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
  // Keep the actual source even when an old item is due outside the recent window, or
  // a supported success has no independent attempt. A reason must not lose its provenance.
  const reasonEvidence = status === 'supported' ? helped.slice(-12) : status === 'review' && !recent.length ? valid.slice(-1) : recent;
  return { difficulty, responseFormat, status, priority, n, correct, incorrect, lastAt,
    assisted: helped.length, evidence: recent.map(a => a.eventId), reasonEvidence: reasonEvidence.map(a => a.eventId),
    unassessed: rows.filter(a => a.verdict === 'unassessed' || a.verdict === 'skipped').length + (base?.unassessed || 0) };
}
function summarizeLearning({ summary, map, complete = true, prior = null }) {
  const now = Date.parse(summary.asOf);
  const skills = map.allNodes().filter(n => n.kind === 'skill').map(node => {
    const all = summary.attempts.filter(a => a.measure?.skillId === node.id);
    const levels = {};
    for (const difficulty of [1, 2, 3]) {
      const rows = all.filter(a => a.measure.difficulty === difficulty);
      const formats = Object.fromEntries(RESPONSE_FORMATS.map(responseFormat => {
        const cell = Ledger.cellOf(prior, `${node.id}|${difficulty}|${responseFormat}`);
        return [responseFormat, formatEvidence(rows.filter(a => (a.measure.responseFormat || 'unknown') === responseFormat),
          { now, complete, difficulty, responseFormat, base: cell ? Ledger.rows(cell) : null })];
      }));
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
// Missed or due content (a word, a grammar point) puts a candidate a little ahead of those its
// ability's own state ranks alike; it never moves one ability, level or history past another.
const CONTENT_LIFT = Object.freeze({ practice: 0.2, review: 0.1, supported: 0.05 });
function rankLearning({ profile, candidates, presentations = [], audioAvailable = true, excludeIds = [], prior = null }) {
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
  // Presentations folded into a ledger are history too (counted, never "just shown").
  const weight = new Map();
  for (const [i, [task, item, family, n]] of (prior?.presented || []).entries()) {
    const ref = `folded:${i}`; weight.set(ref, n);
    for (const [kind, key] of [['task', task], ['item', item], ['family', family]]) {
      if (!key) continue;
      if (!history[kind].has(key)) history[kind].set(key, []);
      history[kind].get(key).push(ref);
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
    const immediate = [...previous].some(index => typeof index === 'number' && index >= presentations.length - 4);
    const count = [...previous].reduce((n, index) => n + (weight.get(index) || 1), 0);
    // Explicit authored difficulty is a language-complexity bucket, never a TOPIK band.
    // Sparse evidence starts with simpler candidates, while supported needs can still be revisited.
    const readyForHarder = candidate.difficulty === 1 || candidate.skillIds.every(id => skills.get(id).levels[candidate.difficulty - 1].formats[responseFormat].status === 'recent-independent');
    if (candidate.conceptIds != null && (!Array.isArray(candidate.conceptIds) || candidate.conceptIds.some(id => typeof id !== 'string'))) throw new TypeError('Core: invalid learning candidate');
    if (candidate.familyKeys != null && (!Array.isArray(candidate.familyKeys) || !candidate.familyKeys.length || candidate.familyKeys.length > 500
      || candidate.familyKeys.some(key => typeof key !== 'string'))) throw new TypeError('Core: invalid learning candidate');
    const lift = Math.max(0, ...(candidate.conceptIds || []).map(id => CONTENT_LIFT[content.get(id)] || 0));
    // A candidate whose every item family was already presented can give no new first try:
    // it goes behind those that still can, and stays available when nothing else is.
    const exhausted = !!candidate.familyKeys && candidate.familyKeys.every(key => history.family.has(key));
    const score = focus.priority - (immediate ? .45 : 0) - (previous.size ? .10 : 0) - (!readyForHarder ? .25 * (candidate.difficulty - 1) : 0)
      - (exhausted ? .5 : 0);
    ranked.push({ candidate, focus, score, lift, count, exhausted });
  }
  ranked.sort((a, b) => b.score - a.score || b.lift - a.lift || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));
  return ranked;
}
function recommend(input) {
  const ranked = rankLearning(input);
  if (!ranked.length) return { status: 'unavailable', selected: null, reason: '지금 조건에 맞는 연습이 없어요.', alternatives: [] };
  const best = ranked[0], label = best.focus.skill.label;
  return { status: 'ready', selected: best.candidate, reason: learningReason({ status: best.focus.status, label }), focusSkillId: best.focus.skill.id,
    state: best.focus.status, responseFormat: best.focus.responseFormat, policy: POLICY.version, evidence: best.focus.evidence,
    alternatives: ranked.slice(1).map(r => r.candidate) };
}

// Choose between activities supplied by a product, using the same practice evidence as an
// individual item. Activity ids, routes, goals and review schedules belong to that product.
// A declared goal changes the choice among equally urgent needs; it never hides an observed
// need or a due review. A schedule is not an assessment, and a missing target is not a weakness.
const ACTIVITY_POLICY = 'learning-activity-1';
const activityToken = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const activityTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const activityList = value => Array.isArray(value) && value.every(activityToken) && new Set(value).size === value.length;
function recommendActivities({ profile, candidates, settings = {}, at = profile?.asOf, presentations = [], prior = null } = {}) {
  if (!profile || !Array.isArray(profile.skills) || typeof profile.evidenceComplete !== 'boolean'
    || !activityTime(at) || !Array.isArray(candidates) || candidates.length > 500
    || !settings || typeof settings !== 'object' || Array.isArray(settings)
    || Object.keys(settings).some(key => !['goals', 'minutes', 'support', 'audioAvailable'].includes(key))
    || (settings.goals != null && !activityList(settings.goals))
    || (settings.minutes != null && (!Number.isFinite(settings.minutes) || settings.minutes <= 0))
    || (settings.support != null && !SUPPORTS.includes(settings.support))
    || (settings.audioAvailable != null && typeof settings.audioAvailable !== 'boolean')) throw new TypeError('Core: invalid activity recommendation');
  // An incomplete history cannot establish a need or an easy start. Known presentations still
  // avoid repetition, but every ability and concept remains unassessed until the host completes it.
  const usable = profile.evidenceComplete ? profile : { ...profile, concepts: [], skills: profile.skills.map(skill => ({ ...skill,
    levels: Object.fromEntries([1, 2, 3].map(difficulty => [difficulty, { formats: Object.fromEntries(RESPONSE_FORMATS.map(responseFormat => [responseFormat,
      { difficulty, responseFormat, status: 'unseen', priority: .65, n: 0, correct: 0, incorrect: 0, assisted: 0, evidence: [] }])) }])) })) };
  const goals = new Set(settings.goals || []), ids = new Set(), ranked = [], excluded = [];
  for (const candidate of candidates) {
    if (!candidate || !activityToken(candidate.id) || ids.has(candidate.id)
      || !Number.isFinite(candidate.minutes) || candidate.minutes <= 0
      || !Array.isArray(candidate.targets) || candidate.targets.length > 500
      || (candidate.goals != null && !activityList(candidate.goals))
      || (candidate.supports != null && (!Array.isArray(candidate.supports) || !candidate.supports.length
        || candidate.supports.some(support => !SUPPORTS.includes(support)) || new Set(candidate.supports).size !== candidate.supports.length))
      || (candidate.audioRequired != null && typeof candidate.audioRequired !== 'boolean')
      || (candidate.available != null && typeof candidate.available !== 'boolean')
      || (candidate.reviewAt != null && !activityTime(candidate.reviewAt))
      || (candidate.practiceNeed != null && (!['retry', 'assisted'].includes(candidate.practiceNeed.kind)
        || Object.keys(candidate.practiceNeed).some(key => !['kind', 'at', 'evidenceRefs'].includes(key))
        || !activityTime(candidate.practiceNeed.at) || Date.parse(candidate.practiceNeed.at) > Date.parse(at)
        || !activityList(candidate.practiceNeed.evidenceRefs) || !candidate.practiceNeed.evidenceRefs.length))) throw new TypeError('Core: invalid learning activity');
    ids.add(candidate.id);
    // Validate every target, including targets on an unavailable activity. The established
    // item policy owns domain, difficulty, format and exposure; a product cannot bypass it.
    const targets = rankLearning({ profile: usable, candidates: candidate.targets, presentations, prior,
      audioAvailable: settings.audioAvailable !== false });
    const blocked = [];
    if (candidate.available === false) blocked.push('activity.unavailable');
    if (settings.minutes != null && candidate.minutes > settings.minutes) blocked.push('time.limit');
    if (settings.audioAvailable === false && (candidate.audioRequired || (candidate.targets.length && !targets.length))) blocked.push('audio.unavailable');
    if (settings.support && settings.support !== 'choose' && candidate.supports && !candidate.supports.includes(settings.support)) blocked.push('support.mismatch');
    if (blocked.length) { excluded.push({ id: candidate.id, reasons: blocked }); continue; }
    // An item whose every family was already presented gives no new first try. When all of an
    // activity's items are like that (spent), their state, often a 7-day 'review', cannot make the
    // activity urgent: it would win every time and starve a host's due review. It stays available,
    // behind the activities that still can teach something new.
    const fresh = targets.filter(row => !row.exhausted), spent = targets.length > 0 && !fresh.length;
    const target = fresh[0] || targets[0] || null, state = target?.focus.status || 'unseen';
    const due = candidate.reviewAt != null && Date.parse(candidate.reviewAt) <= Date.parse(at);
    // A host may have its own assessed activity (for example a language's letter practice).
    // Keep that recent first-response/help fact separate from Trail skill evidence. The host
    // withdraws it when corrected; Core neither persists it nor manufactures a skill mapping.
    const hostNeed = candidate.practiceNeed && Date.parse(at) - Date.parse(candidate.practiceNeed.at) <= POLICY.recentDays * DAY
      ? candidate.practiceNeed : null;
    const urgent = due || hostNeed || (!spent && ['practice', 'supported', 'review'].includes(state));
    const tier = urgent ? 0 : spent || state === 'recent-independent' ? 2 : 1;
    const matchedGoals = (candidate.goals || []).filter(goal => goals.has(goal));
    const reasons = [...(due ? ['review.due'] : []), ...(hostNeed ? [`activity.${hostNeed.kind}`] : []),
      ...(spent ? ['practice.spent'] : target && state !== 'unseen' ? [`practice.${state}`] : []),
      ...(matchedGoals.length ? ['goal.declared'] : []), ...(!profile.evidenceComplete ? ['history.incomplete'] : []),
      ...(!due && !hostNeed && !spent && state === 'unseen' && !matchedGoals.length ? ['practice.unseen'] : [])];
    ranked.push({ candidate, target, state, tier, matchedGoals, due, hostNeed, reasons, spent });
  }
  ranked.sort((a, b) => a.tier - b.tier || b.matchedGoals.length - a.matchedGoals.length
    || Number(b.due) - Number(a.due) || (b.target?.score ?? .65) - (a.target?.score ?? .65)
    || (b.target?.lift ?? 0) - (a.target?.lift ?? 0) || (a.target?.count ?? 0) - (b.target?.count ?? 0)
    || a.candidate.minutes - b.candidate.minutes || a.candidate.id.localeCompare(b.candidate.id));
  const best = ranked[0];
  const common = { policy: ACTIVITY_POLICY, asOf: at, evidenceComplete: profile.evidenceComplete, excluded,
    learningEffectClaim: false, abilityClaim: false, grade: null };
  if (!best) return { ...common, status: 'unavailable', selected: null, alternatives: [], reasons: ['activity.none'],
    reason: activityReason({ reasons: ['activity.none'] }), evidence: [], focusSkillId: null, state: null, matchedGoals: [] };
  const detail = row => ({ id: row.candidate.id, reasons: [...row.reasons], state: row.state,
    focusSkillId: row.target?.focus.skill.id || null, matchedGoals: [...row.matchedGoals],
    evidence: [...(row.target?.focus.reasonEvidence || row.target?.focus.evidence || [])], ...(row.due ? { reviewAt: row.candidate.reviewAt, reviewSource: 'host-schedule' } : {}),
    ...(row.hostNeed ? { hostEvidence: { kind: row.hostNeed.kind, at: row.hostNeed.at, evidenceRefs: [...row.hostNeed.evidenceRefs], source: 'host-practice' } } : {}) });
  return { ...common, status: 'ready', selected: best.candidate, alternatives: ranked.slice(1).map(row => row.candidate),
    ...detail(best), reason: activityReason({ reasons: best.reasons, state: best.state, label: best.target?.focus.skill.label }),
    basis: best.due ? 'review-schedule' : best.hostNeed ? 'host-practice' : best.target && best.state !== 'unseen' ? 'practice' : best.matchedGoals.length ? 'declared' : 'cold-start',
    assessments: ranked.map(detail) };
}
// Content an item uses (words, grammar), read by the same evidence rules as abilities and
// kept per response format. Only content with observations is listed: a word never met
// is not a weakness, and nothing here is a mastery or TOPIK grade.
const CONTENT = Object.freeze(['word', 'grammar_point']);
function summarizeConcepts({ summary, map, complete = true, prior = null }) {
  const now = Date.parse(summary.asOf), rows = new Map();
  // Content met only in folded entries is still listed, from the ledger.
  for (const key of Object.keys(prior?.content || {})) {
    const id = key.slice(0, key.lastIndexOf('|')), node = map.getNode(id);
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
      const own = list.filter(a => (a.measure.responseFormat || 'unknown') === responseFormat);
      const cell = Ledger.contentOf(prior, `${node.id}|${responseFormat}`);
      if (own.length || cell) formats[responseFormat] = formatEvidence(own, { now, complete, difficulty: null, responseFormat, base: cell ? Ledger.rows(cell) : null });
    }
    const focus = Object.values(formats).sort((a, b) => b.priority - a.priority)[0];
    return { id: node.id, kind: node.kind, label: node.label_ko, status: focus.status, priority: focus.priority, formats };
  }).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}
module.exports = { POLICY, ACTIVITY_POLICY, RESPONSE_FORMATS, CONTENT, summarizeLearning, summarizeConcepts, recommend, recommendActivities, formatEvidence };
