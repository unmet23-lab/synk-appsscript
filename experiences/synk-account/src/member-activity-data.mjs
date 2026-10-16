// Optional non-learning app-use metadata only. Never accept notes, customer
// content, URLs, account selectors, learning answers, or inferred traits here.
export const MEMBER_ACTIVITY_APP_IDS = Object.freeze(['world', 'messenger', 'path', 'pulse']);
export const MEMBER_ACTIVITY_LIMITS = Object.freeze({ events: 2000, days: 90, maxBytes: 256 * 1024 });
const RETENTION_MS = MEMBER_ACTIVITY_LIMITS.days * 86400000;
const invalid = () => { throw Object.assign(new TypeError('성향에 사용할 앱 이용 기록의 형식을 확인해 주세요.'), { code: 'INVALID_PERSONAL_STATE' }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => object(value) && Reflect.ownKeys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key) && Object.getOwnPropertyDescriptor(value, key).enumerable
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
const list = (value, max) => Array.isArray(value) && value.length <= max && Object.keys(value).length === value.length;
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function clock(value) {
  if (iso(value)) return Date.parse(value);
  if (Number.isSafeInteger(value) && Math.abs(value) <= 8640000000000000) return value;
  invalid();
}
export function emptyMemberActivity() { return { version: 1, consent: false, enabledAt: null, events: [], favorites: [] }; }

// Loading an old document remains possible. Enforce the clock/90-day window on
// writes; prune on the client before saving. Turning consent off clears all data.
export function validateMemberActivity(value, { now = Date.now(), enforceRetention = false } = {}) {
  if (!exact(value, ['version', 'consent', 'enabledAt', 'events', 'favorites']) || value.version !== 1
    || typeof value.consent !== 'boolean' || !(value.enabledAt === null || iso(value.enabledAt))
    || value.consent && value.enabledAt === null || !list(value.events, MEMBER_ACTIVITY_LIMITS.events)
    || !list(value.favorites, MEMBER_ACTIVITY_APP_IDS.length)) invalid();
  const eventIds = new Set(), favoriteIds = new Set();
  for (const event of value.events) {
    if (!exact(event, ['id', 'appId', 'at']) || !uuid(event.id) || !MEMBER_ACTIVITY_APP_IDS.includes(event.appId)
      || !iso(event.at) || eventIds.has(event.id.toLowerCase())
      || value.consent && Date.parse(event.at) < Date.parse(value.enabledAt)) invalid();
    eventIds.add(event.id.toLowerCase());
  }
  for (const id of value.favorites) {
    if (!MEMBER_ACTIVITY_APP_IDS.includes(id) || favoriteIds.has(id)) invalid();
    favoriteIds.add(id);
  }
  if (!value.consent) return emptyMemberActivity();
  if (enforceRetention) {
    const at = clock(now);
    if (Date.parse(value.enabledAt) > at || value.events.some(event => Date.parse(event.at) > at || Date.parse(event.at) < at - RETENTION_MS)) invalid();
  }
  return { version: 1, consent: true, enabledAt: value.enabledAt,
    events: value.events.map(event => ({ id: event.id.toLowerCase(), appId: event.appId, at: event.at })), favorites: [...value.favorites] };
}

export function pruneMemberActivity(value, now = Date.now()) {
  const next = validateMemberActivity(value), at = clock(now);
  if (!next.consent) return next;
  if (Date.parse(next.enabledAt) > at) invalid();
  next.events = next.events.filter(event => Date.parse(event.at) >= at - RETENTION_MS && Date.parse(event.at) <= at)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
  return next;
}

export function updateMemberActivity(value, action, now = Date.now()) {
  if (!object(action)) invalid();
  let next = validateMemberActivity(value);
  if (action.type === 'consent') {
    if (!exact(action, ['type', 'value']) || typeof action.value !== 'boolean') invalid();
    if (!action.value) return emptyMemberActivity();
    if (!next.consent) { next.consent = true; next.enabledAt = new Date(clock(now)).toISOString(); }
    return pruneMemberActivity(next, now);
  }
  if (!next.consent) throw Object.assign(new Error('앱 이용 기록을 성향에 사용하는 데 동의한 뒤 연결해 주세요.'), { code: 'INSIGHT_CONSENT_REQUIRED' });
  next = pruneMemberActivity(next, now);
  const at = new Date(clock(now)).toISOString();
  if (action.type === 'launch') {
    if (!exact(action, ['type', 'id', 'appId']) || !uuid(action.id) || !MEMBER_ACTIVITY_APP_IDS.includes(action.appId)) invalid();
    const id = action.id.toLowerCase(), existing = next.events.find(event => event.id === id);
    // A host retains this UUID across CAS/network retries. It must never count
    // the same launch twice or repurpose the ID for a different app.
    if (existing) { if (existing.appId !== action.appId) invalid(); return next; }
    next.events.push({ id, appId: action.appId, at });
    next.events = next.events.slice(-MEMBER_ACTIVITY_LIMITS.events);
  } else if (action.type === 'favorites') {
    if (!exact(action, ['type', 'value'])) invalid();
    next.favorites = action.value;
  } else if (action.type === 'favorite') {
    if (!exact(action, ['type', 'appId']) || !MEMBER_ACTIVITY_APP_IDS.includes(action.appId)) invalid();
    next.favorites = next.favorites.includes(action.appId) ? next.favorites.filter(id => id !== action.appId) : [...next.favorites, action.appId];
  } else invalid();
  return validateMemberActivity(next, { now, enforceRetention: true });
}
