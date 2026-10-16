'use strict';
// Trail projection after the full log has applied exclusion/exposure rules.
// Taxonomy membership is evidence of content encountered, never of liking it.
const Periods = require('./trail-periods');
const MODES = ['listening', 'reading'];
const FORMATS = ['binary-choice', 'single-choice', 'cup-compose', 'action'];
const KINDS = ['situation', 'topic', 'word', 'grammar_point', 'skill', 'concept'];
function memberPracticeObservations({ attempts, map, asOf }) {
  const period = Periods.bounds(asOf).recent;
  const rows = attempts.map(row => ({ ...row, at: new Date(row.at).toISOString() }))
    .filter(row => Periods.within(row.at, period) && ['correct', 'incorrect'].includes(row.verdict) && !row.exclusionReason);
  const aggregate = (id, own, extra = {}) => ({ id, ...extra, count: own.length, activeDays: Periods.activeDays(own),
    lastAt: own.reduce((latest, row) => !latest || row.at > latest ? row.at : latest, null) });
  const sort = (a, b) => b.activeDays - a.activeDays || b.count - a.count || b.lastAt.localeCompare(a.lastAt) || a.id.localeCompare(b.id);
  const ids = [...new Set(rows.flatMap(row => row.conceptIds))];
  const topics = ids.map(id => {
    const node = map.getNode(id);
    return node && KINDS.includes(node.kind) ? aggregate(id, rows.filter(row => row.conceptIds.includes(id)), { kind: node.kind, label: node.label_ko }) : null;
  }).filter(Boolean).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || sort(a, b)).slice(0, 12);
  const groups = (ids, key) => ids.map(id => aggregate(id, rows.filter(row => row.measure?.[key] === id))).filter(row => row.count).sort(sort);
  return { ...period, total: rows.length, topics, modes: groups(MODES, 'modality'), formats: groups(FORMATS, 'responseFormat') };
}
module.exports = { memberPracticeObservations };
