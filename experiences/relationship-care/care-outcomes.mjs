import * as module from '../../atlas/temper-outcomes.js';
const Temper = module.default || globalThis.SynkTemperOutcomes;

/** The app passes only the currently opened account (or guest) state. */
export function preparationSummary(state, now = new Date()) {
  const scope = { domain: 'SHIFT', workspace: 'relationship-care', purpose: 'my-preparation-history' };
  const subject = 'self';
  const asOf = new Date(now).toISOString(), cutoff = Date.parse(asOf);
  // A backup may come from a device whose clock is ahead. Keep those records in
  // storage and report exclusion; optional statistics must not prevent opening it.
  const admitted = (state.preparations || []).filter(row => [row.shownAt, row.selectedAt, row.satisfactionAt].filter(Boolean).every(at => Date.parse(at) <= cutoff));
  const records = admitted.map(row => ({ id: row.id, scope, subject, shownAt: row.shownAt,
    selectedAt: row.selectedAt, elapsedSeconds: row.elapsedSeconds, satisfaction: row.satisfaction, satisfactionAt: row.satisfactionAt }));
  return { ...Temper.summarizePreparation({ scope, subject, records, asOf }), excludedFuture: (state.preparations || []).length - admitted.length };
}
