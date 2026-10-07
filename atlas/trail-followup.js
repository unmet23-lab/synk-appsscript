/* Trail's optional explicit follow-up timeline. Hosts own identities, records
 * and storage. Due dates are user-confirmed plans, never predicted need or care. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkTrailFollowup = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'trail-followup-1', DAY = 86400000;
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31') throw new TypeError('Trail Followup: invalid date');
    const number = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(number) || new Date(number).toISOString().slice(0, 10) !== value) throw new TypeError('Trail Followup: invalid date');
    return number;
  }
  function validate(item) {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.title !== 'string' || !item.title.trim() || !['pending', 'done', 'dismissed'].includes(item.status)) throw new TypeError('Trail Followup: invalid item');
    date(item.dueOn); return item;
  }
  function summarize({ items, today } = {}) {
    const current = date(today); if (!Array.isArray(items) || items.length > 2000) throw new TypeError('Trail Followup: invalid items');
    const ids = new Set(), rows = items.map(item => {
      validate(item); if (ids.has(item.id)) throw new TypeError('Trail Followup: duplicate item'); ids.add(item.id);
      const daysUntil = Math.round((date(item.dueOn) - current) / DAY);
      return { id: item.id, title: item.title, dueOn: item.dueOn, status: item.status, daysUntil,
        phase: item.status !== 'pending' ? item.status : daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : 'upcoming' };
    }).sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id));
    return { version: VERSION, today, pending: rows.filter(row => row.status === 'pending'), completed: rows.filter(row => row.status === 'done'), dismissed: rows.filter(row => row.status === 'dismissed') };
  }
  function planAction(item, { action, today, dueOn } = {}) {
    validate(item); date(today);
    if (item.status !== 'pending') throw new TypeError('Trail Followup: closed follow-up');
    if (action === 'now') return { version: VERSION, action, intent: 'prepare-contact', patch: null, completed: false };
    if (action === 'later') { date(dueOn); if (dueOn <= today) throw new TypeError('Trail Followup: choose a future date'); return { version: VERSION, action, patch: { dueOn, status: 'pending' }, completed: false }; }
    if (action === 'done') return { version: VERSION, action, patch: { status: 'done' }, completed: true };
    if (action === 'dismiss') return { version: VERSION, action, patch: { status: 'dismissed' }, completed: false };
    throw new TypeError('Trail Followup: invalid action');
  }
  return Object.freeze({ VERSION, date, summarize, planAction });
});
