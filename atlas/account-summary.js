'use strict';
// Core's summary of one account for the other SYNK products (synk-account ?view=atlas): the
// presentation the person chose, the reasons they declared, and what their practice shows, read by
// the same rules the games use (learning.js) and said in Vellum's words. Pure: the host passes the
// account's whole learning log, the Strata map and the time, and decides what the person agreed to
// share. It describes practice; it is never an ability, a grade, a level or a personality.
const Trail = require('./trail');
const Learning = require('./learning');
const { learningReason } = require('./vellum');
const VERSION = 'atlas-account-summary-1';
// The account log's scope (game-learning.js account store, synk-learning).
const SCOPE = Object.freeze({ domain: 'LAB', workspace: 'learning', subject: 'device' });
const SHOWN = 12;
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const latest = (a, b) => (!a || (b && Date.parse(b) > Date.parse(a)) ? b : a);

function summarizeAccount({ events, map, asOf, presentation = null, reasons = null } = {}) {
  if (!Array.isArray(events) || typeof map?.allNodes !== 'function' || !time(asOf)) throw new TypeError('Atlas summary: the log, a map and the time are required');
  if (reasons !== null && (!Array.isArray(reasons) || reasons.some(r => typeof r !== 'string'))) throw new TypeError('Atlas summary: invalid reasons');
  const observed = Trail.summarize(events, { scope: SCOPE, asOf });
  const profile = Learning.summarizeLearning({ summary: observed, map, complete: true });
  const concepts = Learning.summarizeConcepts({ summary: observed, map, complete: true });
  // Abilities with anything observed, the ones that most want practice first.
  const practiced = profile.skills.filter(s => s.lastAt || s.assisted || s.unassessed)
    .sort((a, b) => b.priority - a.priority || (Date.parse(b.lastAt || 0) - Date.parse(a.lastAt || 0)) || a.id.localeCompare(b.id));
  const lastAt = observed.attempts.reduce((at, a) => latest(at, a.at), null);
  const answered = observed.attempts.filter(a => a.verdict === 'correct' || a.verdict === 'incorrect');
  return {
    version: VERSION, asOf,
    presentation: presentation && { ...presentation },
    reasons: reasons && [...reasons],
    practice: {
      answered: answered.length,
      independent: answered.filter(a => a.independent).length,
      assisted: answered.filter(a => a.assisted).length,
      lastAt,
      skills: practiced.slice(0, SHOWN).map(s => ({ id: s.id, label: s.label, domain: s.domain, status: s.status,
        recent: s.n, correct: s.correct, assisted: s.assisted, lastAt: s.lastAt, line: learningReason({ status: s.status, label: s.label }) })),
      content: concepts.filter(c => c.status === 'practice' || c.status === 'review').slice(0, SHOWN)
        .map(c => ({ id: c.id, kind: c.kind, label: c.label, status: c.status })),
    },
    basis: observed.attempts.length ? 'practice' : presentation || (reasons && reasons.length) ? 'self-declared' : 'cold-start',
    abilityClaim: false, learningEffectClaim: false, grade: null,
  };
}
module.exports = { VERSION, SCOPE, summarizeAccount };
