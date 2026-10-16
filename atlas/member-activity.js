'use strict';
// Core's member-facing projection of a host-authorized app-opening record.
// Trail keeps the occurrence/consent boundaries; Vellum explains the evidence.
// The host owns authentication, consent persistence, deletion and launch proof.
// No app contents, company/client data, personal notes or account IDs are inputs.
const Periods = require('./trail-periods');
const { memberActivityReason, periodComparisonReason } = require('./vellum');
const VERSION = 1;
const MAX_EVENTS = 2000;
const APPS = Object.freeze({
  world: Object.freeze({ label: 'WORLD', activity: 'WORLD 열기' }),
  messenger: Object.freeze({ label: '워크스페이스', activity: '워크스페이스 열기' }),
  path: Object.freeze({ label: 'PATH', activity: 'PATH 열기' }),
  pulse: Object.freeze({ label: 'PULSE', activity: 'PULSE 열기' }),
});
const appIds = Object.keys(APPS);
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, fields) => plain(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const fail = () => { throw new TypeError('Member activity: invalid authorized document'); };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function summarizeMemberActivity({ document, asOf } = {}) {
  const periods = Periods.bounds(asOf);
  if (!exact(document, ['version', 'consent', 'enabledAt', 'events', 'favorites']) || document.version !== VERSION || typeof document.consent !== 'boolean') fail();
  // A disabled generation never discloses stale observations or favorites.
  if (!document.consent) return { version: VERSION, availability: 'disabled', enabledAt: null,
    periods: { ...periods, recent: { ...periods.recent, observations: 0, activeDays: 0 }, previous: { ...periods.previous, observations: 0, activeDays: 0 },
      sufficient: false, reason: periodComparisonReason({ source: 'activity', state: 'disabled' }), delta: null }, interests: [], activities: [] };
  const enabledAt = Periods.instant(document.enabledAt), cutoff = Periods.instant(asOf);
  if (enabledAt > cutoff || !Array.isArray(document.events) || document.events.length > MAX_EVENTS || !Array.isArray(document.favorites)
    || document.favorites.length > appIds.length || new Set(document.favorites).size !== document.favorites.length || document.favorites.some(id => !Object.hasOwn(APPS, id))) fail();
  const unique = new Map();
  for (const event of document.events) {
    if (!exact(event, ['id', 'appId', 'at']) || !uuid(event.id) || !Object.hasOwn(APPS, event.appId)) fail();
    const at = Periods.instant(event.at), id = event.id.toLowerCase(), previous = unique.get(id);
    if (previous && (previous.appId !== event.appId || previous.at !== event.at)) fail();
    unique.set(id, { id, appId: event.appId, at: event.at, time: at });
  }
  const events = [...unique.values()].filter(event => event.time >= enabledAt && event.time <= cutoff);
  const recentEvents = events.filter(event => Periods.within(event.at, periods.recent));
  const previousEvents = events.filter(event => Periods.within(event.at, periods.previous));
  const recent = { ...periods.recent, observations: recentEvents.length, activeDays: Periods.activeDays(recentEvents) };
  const previous = { ...periods.previous, observations: previousEvents.length, activeDays: Periods.activeDays(previousEvents) };
  // The host retains the latest 2,000 openings. At that cap, an oldest retained
  // event inside the comparison window may mean earlier events were trimmed.
  const oldest = events.reduce((at, event) => Math.min(at, event.time), Infinity);
  const truncatedWindow = document.events.length >= MAX_EVENTS && oldest > Date.parse(periods.previous.from);
  const covered = enabledAt <= Date.parse(periods.previous.from) && !truncatedWindow;
  const sufficient = covered && recent.observations > 0 && previous.observations > 0;
  const state = !covered ? 'partial' : sufficient ? 'ready' : 'empty';
  const rows = appIds.map(appId => {
    const own = events.filter(event => event.appId === appId && Periods.within(event.at, { from: previous.from, to: recent.to }));
    const favorite = document.favorites.includes(appId);
    return { id: appId, label: APPS[appId].label, kind: favorite ? 'favorite' : 'opened',
      recentCount: recentEvents.filter(event => event.appId === appId).length,
      recentActiveDays: Periods.activeDays(recentEvents.filter(event => event.appId === appId)),
      previousCount: previousEvents.filter(event => event.appId === appId).length,
      lastAt: own.length ? own.reduce((latest, event) => event.time > Date.parse(latest) ? event.at : latest, own[0].at) : null,
      detail: memberActivityReason({ kind: favorite ? 'favorite' : 'opened' }) };
  }).filter(row => row.kind === 'favorite' || row.lastAt !== null)
    .sort((a, b) => Number(b.kind === 'favorite') - Number(a.kind === 'favorite') || b.recentCount - a.recentCount || b.previousCount - a.previousCount || appIds.indexOf(a.id) - appIds.indexOf(b.id));
  return { version: VERSION, availability: rows.length ? 'ready' : 'empty', enabledAt: document.enabledAt,
    periods: { days: periods.days, recent, previous, sufficient, reason: periodComparisonReason({ source: 'activity', state }),
      delta: sufficient ? { observations: recent.observations - previous.observations, activeDays: recent.activeDays - previous.activeDays } : null },
    interests: rows,
    activities: rows.slice(0, 3).map(row => ({ id: `open-${row.id}`, targetId: row.id, label: APPS[row.id].activity,
      reason: memberActivityReason({ kind: row.kind, action: true }), basis: row.kind === 'favorite' ? 'self-declared' : 'observed' })),
  };
}
module.exports = { VERSION, APPS, summarizeMemberActivity };
