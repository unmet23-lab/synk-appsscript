'use strict';
// Trail: equal observation windows from actual occurrence times. This does not
// infer missing history, success, preference, or a person's ability.
const DAY = 86400000;
const DAYS = 30;
const instant = value => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new TypeError('Trail periods: explicit ISO UTC time required');
  return Date.parse(value);
};
function bounds(asOf) {
  const end = instant(asOf), iso = value => new Date(value).toISOString();
  return { days: DAYS, recent: { from: iso(end - DAYS * DAY), to: iso(end) }, previous: { from: iso(end - 2 * DAYS * DAY), to: iso(end - DAYS * DAY) } };
}
// Both windows are (from, to], matching the existing Trail asOf boundary.
const within = (at, period) => instant(at) > Date.parse(period.from) && instant(at) <= Date.parse(period.to);
// Product dates are Korean calendar dates, independent of the host's timezone.
const activeDays = rows => new Set(rows.map(row => new Date(instant(row.at) + 9 * 3600000).toISOString().slice(0, 10))).size;
function practicePeriods(attempts, asOf) {
  const periods = bounds(asOf);
  // Existing Trail accepts valid offset/no-millisecond timestamps. Normalize
  // its already-validated evidence here without narrowing that older contract.
  const normalized = attempts.map(row => ({ ...row, at: new Date(row.at).toISOString() }));
  const summarize = period => {
    const rows = normalized.filter(row => within(row.at, period) && ['correct', 'incorrect'].includes(row.verdict));
    return { ...period, answered: rows.length, independent: rows.filter(row => row.independent === true).length,
      assisted: rows.filter(row => row.assisted === true).length, activeDays: activeDays(rows) };
  };
  const recent = summarize(periods.recent), previous = summarize(periods.previous);
  const sufficient = recent.answered > 0 && previous.answered > 0;
  const delta = sufficient ? Object.fromEntries(['answered', 'independent', 'assisted', 'activeDays'].map(key => [key, recent[key] - previous[key]])) : null;
  return { days: DAYS, recent, previous, sufficient, delta };
}
module.exports = { DAYS, instant, bounds, within, activeDays, practicePeriods };
