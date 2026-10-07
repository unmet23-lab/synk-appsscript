/* Travel specialist bundle feasibility, separate from Core's common decision policy.
 * This legacy atlas/ path, global name and version remain compatibility identifiers;
 * the module is a reusable travel capability, not a ninth Atlas engine.
 * The product supplies scoped requirements,
 * already extended prices, local absolute minutes and source evidence.
 * This pure validator does not rank, fetch, route, reserve or authenticate.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkAtlasTravel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'core-travel-feasibility-1';
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value)
    && !['__proto__', 'prototype', 'constructor'].includes(value);
  const fail = message => { throw new TypeError(`Core travel: ${message}`); };
  const keys = (value, required, optional = []) => plain(value)
    && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => [...required, ...optional].includes(key));
  const whole = value => Number.isSafeInteger(value) && value >= 0;
  const minute = value => whole(value) && value <= 1800;
  function instant(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      || !Number.isFinite(Date.parse(value))) fail('time must be an ISO timestamp with timezone');
    const [year, month, day, hour, minutes, seconds] = value.slice(0, 19).split(/[-T:]/).map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minutes > 59 || seconds > 59) fail('invalid timestamp calendar value');
    return Date.parse(value);
  }
  function identifiers(value, label) {
    if (!Array.isArray(value) || value.length > 1000 || !value.every(token)
      || new Set(value).size !== value.length) fail(`invalid ${label}`);
    return value;
  }
  function add(total, value) {
    if (!Number.isSafeInteger(total + value)) fail('total exceeds safe integer range');
    return total + value;
  }
  function checkItem(item) {
    if (!keys(item, ['id', 'kind', 'start', 'end', 'cost', 'walkMinutes', 'requirements', 'source'])
      || !token(item.id) || !token(item.kind) || !minute(item.start) || !minute(item.end)
      || item.end <= item.start || !whole(item.walkMinutes) || item.walkMinutes > item.end - item.start) fail('invalid item or duration');
    if (!keys(item.cost, ['amount', 'currency', 'status']) || !/^[A-Z]{3}$/.test(item.cost.currency)
      || !['known', 'unknown'].includes(item.cost.status)
      || (item.cost.status === 'known' ? !whole(item.cost.amount) : item.cost.amount !== null)) fail('invalid cost; unknown amount must be null');
    if (!plain(item.requirements) || Object.entries(item.requirements).some(([key, value]) => !token(key)
      || ![true, false, null].includes(value))) fail('invalid item requirements');
    if (!keys(item.source, ['kind', 'checkedAt', 'validUntil']) || !['fixture', 'verified'].includes(item.source.kind)) fail('invalid source');
    const checked = instant(item.source.checkedAt), until = instant(item.source.validUntil);
    if (checked >= until) fail('source validity must end after its check');
    return { checked, until };
  }
  // A requirement string applies to every item; {id, kind} applies only to
  // that kind. Every target needs explicit true; missing/null stays unknown.
  // amount is the complete scoped cost, not a per-person/per-night unit rate.
  // Explicit known zero means free. Unknown money is always null, never zero.
  // Gaps are not inferred travel: the product must include travel intervals.
  // lockedIds preserves identity; the host must keep locked item facts fixed.
  function evaluateBundles(input = {}) {
    if (!keys(input, ['bundles', 'budget', 'currency', 'dayStart', 'dayEnd', 'maxWalkMinutes', 'at'],
      ['requirements', 'lockedIds', 'excludedIds', 'allowFixtures'])) fail('invalid input fields');
    const { bundles, budget, currency, dayStart, dayEnd, maxWalkMinutes,
      requirements = [], lockedIds = [], excludedIds = [], allowFixtures = false } = input;
    if (!Array.isArray(bundles) || bundles.length > 1000 || !whole(budget) || currency !== 'KRW'
      || !minute(dayStart) || !minute(dayEnd) || dayEnd <= dayStart || !whole(maxWalkMinutes)
      || typeof allowFixtures !== 'boolean') fail('invalid evaluation bounds');
    const now = instant(input.at), locks = identifiers(lockedIds, 'locked ids'), excluded = new Set(identifiers(excludedIds, 'excluded ids'));
    if (!Array.isArray(requirements) || requirements.length > 100) fail('invalid requirements');
    const needed = requirements.map(requirement => {
      if (typeof requirement === 'string' && token(requirement)) return { id: requirement };
      if (!keys(requirement, ['id', 'kind']) || !token(requirement.id) || !token(requirement.kind)) fail('invalid required condition');
      return { id: requirement.id, kind: requirement.kind };
    });
    if (new Set(needed.map(row => JSON.stringify(row))).size !== needed.length) fail('duplicate required condition');
    const bundleIds = new Set(), result = { version: VERSION, feasible: [], pending: [], rejected: [] };
    for (const bundle of bundles) {
      if (!keys(bundle, ['id', 'items']) || !token(bundle.id) || bundleIds.has(bundle.id)
        || !Array.isArray(bundle.items) || bundle.items.length < 1 || bundle.items.length > 1000) fail('invalid bundle');
      bundleIds.add(bundle.id);
      const itemIds = new Set(), reasons = [];
      let knownTotal = 0, walkMinutes = 0, unknownCost = false, demo = false;
      let blocked = false, pending = false;
      const reason = (code, severity, details = {}) => {
        reasons.push({ code, ...details });
        if (severity === 'rejected') blocked = true;
        else pending = true;
      };
      for (const item of bundle.items) {
        const validity = checkItem(item);
        if (itemIds.has(item.id)) fail('duplicate item id within bundle');
        itemIds.add(item.id);
        const detail = { itemId: item.id };
        if (item.start < dayStart || item.end > dayEnd) reason('time.outside-day', 'rejected', detail);
        if (excluded.has(item.id)) reason('item.excluded', 'rejected', detail);
        walkMinutes = add(walkMinutes, item.walkMinutes);
        if (item.cost.currency !== currency) {
          unknownCost = true;
          reason('cost.currency-unconverted', 'pending', { ...detail, currency: item.cost.currency });
        } else if (item.cost.status === 'unknown') {
          unknownCost = true;
          reason('cost.unknown', 'pending', detail);
        } else knownTotal = add(knownTotal, item.cost.amount);
        if (item.source.kind === 'fixture') {
          demo = true;
          if (!allowFixtures) reason('source.fixture-not-allowed', 'pending', detail);
        }
        if (validity.checked > now) reason('source.not-yet-checked', 'pending', detail);
        else if (validity.until <= now) reason('source.expired', 'pending', detail);
      }
      for (const id of locks) if (!itemIds.has(id)) reason('lock.missing', 'rejected', { itemId: id });
      const chronological = [...bundle.items].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
      let latest = null;
      for (const item of chronological) {
        if (latest && item.start < latest.end) reason('time.overlap', 'rejected', { itemId: item.id, withItemId: latest.id });
        if (!latest || item.end > latest.end) latest = item;
      }
      for (const required of needed) {
        const targets = bundle.items.filter(item => !required.kind || item.kind === required.kind);
        if (!targets.length) reason('requirement.no-target', 'pending', { requirement: required.id, kind: required.kind });
        for (const item of targets) {
          const value = Object.hasOwn(item.requirements, required.id) ? item.requirements[required.id] : null;
          if (value !== true) reason(value === false ? 'requirement.failed' : 'requirement.unknown',
            value === false ? 'rejected' : 'pending', { itemId: item.id, requirement: required.id });
        }
      }
      if (knownTotal > budget) reason('budget.exceeded', 'rejected', { amount: knownTotal, limit: budget });
      if (walkMinutes > maxWalkMinutes) reason('walking.exceeded', 'rejected', { minutes: walkMinutes, limit: maxWalkMinutes });
      const status = blocked ? 'rejected' : pending ? 'pending' : 'feasible';
      result[status].push({ id: bundle.id, status, total: unknownCost ? null : knownTotal, knownTotal,
        currency, walkMinutes, reasons, demo });
    }
    return result;
  }
  return Object.freeze({ VERSION, evaluateBundles });
});
