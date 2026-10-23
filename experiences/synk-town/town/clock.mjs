/** Town clock (vertical slice design §4): three times, four bands, two weathers.
 * - My time (the user's offset) drives light and resident routines.
 * - The life day runs from my 05:00 to the next 05:00 and its number never goes down.
 * - The Korean date (UTC+9, no daylight saving) drives seasons and weather, so
 *   one village sees one sky at one instant.
 * Everything is integer arithmetic on epoch milliseconds: no Date, no Intl.
 */
import { createRng, pickByWeight } from './rng.mjs';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const KST_OFFSET_MIN = 540;
const LIFE_DAY_START = 5 * HOUR;

/** Bands in my time, as minutes after the life day starts at 05:00 (§4-2). */
export const BANDS = Object.freeze([
  Object.freeze({ id: 'morning', from: 0, to: 6 * 60 }),
  Object.freeze({ id: 'day', from: 6 * 60, to: 12 * 60 }),
  Object.freeze({ id: 'evening', from: 12 * 60, to: 16 * 60 }),
  Object.freeze({ id: 'night', from: 16 * 60, to: 24 * 60 }),
]);
export const BAND_IDS = Object.freeze(BANDS.map(band => band.id));

/** Light anchors in my time (minutes after midnight), the baked-light correction keys (§2-2, §4-2). */
export const LIGHT_KEYS = Object.freeze([
  Object.freeze({ id: 'deep-night', at: 0 }),
  Object.freeze({ id: 'dawn-mist', at: 5 * 60 }),
  Object.freeze({ id: 'morning', at: 8 * 60 }),
  Object.freeze({ id: 'noon', at: 12 * 60 }),
  Object.freeze({ id: 'sunset', at: 17 * 60 + 30 }),
  Object.freeze({ id: 'blue-evening', at: 19 * 60 + 30 }),
  Object.freeze({ id: 'lantern-night', at: 21 * 60 }),
]);

/** Day shapes in Korean hours: [fromHour, toHour) rain windows (§4-4). */
export const WEATHER_DAYS = Object.freeze({
  'clear-day': Object.freeze([]),
  'rain-day': Object.freeze([Object.freeze([0, 24])]),
  'pm-rain': Object.freeze([Object.freeze([13, 20])]),
  'am-rain-clearing': Object.freeze([Object.freeze([0, 10])]),
  'evening-shower': Object.freeze([Object.freeze([17, 19])]),
});
const WEATHER_ORDER = Object.freeze(['clear-day', 'rain-day', 'pm-rain', 'am-rain-clearing', 'evening-shower']);
/** Per-mille weights by season, in WEATHER_ORDER 〔initial values〕. */
export const WEATHER_WEIGHTS = Object.freeze({
  spring: Object.freeze([600, 100, 120, 100, 80]),
  summer: Object.freeze([450, 200, 120, 100, 130]),
  autumn: Object.freeze([650, 90, 100, 100, 60]),
  winter: Object.freeze([800, 60, 50, 60, 30]),
});

const floorDiv = (a, b) => Math.floor(a / b);
const mod = (a, b) => ((a % b) + b) % b;
const pad2 = n => (n < 10 ? `0${n}` : String(n));
const ensureTime = ms => { if (!Number.isSafeInteger(ms)) throw new RangeError('times are epoch milliseconds (safe integers)'); return ms; };

/** Civil date of a day number (days since 1970-01-01), Hinnant's algorithm. */
export function civilFromDays(days) {
  const z = days + 719468;
  const era = floorDiv(z, 146097);
  const doe = z - era * 146097;
  const yoe = floorDiv(doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096), 365);
  const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100));
  const mp = floorDiv(5 * doy + 2, 153);
  const d = doy - floorDiv(153 * mp + 2, 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (m <= 2 ? 1 : 0), month: m, day: d };
}
export function dateOfDays(days) {
  const { year, month, day } = civilFromDays(days);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}
/** 0 = Monday … 6 = Sunday. 1970-01-01 was a Thursday. */
export const weekdayOf = days => mod(days + 3, 7);

export function seasonOfMonth(month) {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// ── time zones (§4-6) ──────────────────────────────────────────────────────────

/** Offsets are −12:00…+14:00 in 15-minute steps. */
export const validOffset = offsetMin => Number.isSafeInteger(offsetMin) && offsetMin >= -720 && offsetMin <= 840 && offsetMin % 15 === 0;

/** Normalize a clock record: { tz: [{ fromMs, offsetMin }] } sorted, or a fixed offset. */
function zones(tz) {
  if (typeof tz === 'number') {
    if (!validOffset(tz)) throw new RangeError('offset must be −720…840 minutes in 15-minute steps');
    return [{ fromMs: Number.MIN_SAFE_INTEGER, offsetMin: tz }];
  }
  if (!Array.isArray(tz) || !tz.length) throw new RangeError('tz is an offset or a non-empty history');
  let last = -Infinity;
  for (const zone of tz) {
    if (!zone || !Number.isSafeInteger(zone.fromMs) || !validOffset(zone.offsetMin) || zone.fromMs <= last) throw new RangeError('tz history entries are { fromMs, offsetMin } in time order');
    last = zone.fromMs;
  }
  return tz;
}
const zoneIndexAt = (list, ms) => { let i = 0; while (i + 1 < list.length && list[i + 1].fromMs <= ms) i++; return i; };

export function offsetAt(tz, ms) {
  const list = zones(tz);
  return list[zoneIndexAt(list, ensureTime(ms))].offsetMin;
}

const rawLifeDay = (ms, offsetMin) => floorDiv(ms + offsetMin * MINUTE - LIFE_DAY_START, DAY);

/** The life day number at ms. After a westward offset change the number holds
 * until my time passes the end of the day it would otherwise repeat. */
export function lifeDayAt(tz, ms) {
  const list = zones(tz);
  ensureTime(ms);
  const index = zoneIndexAt(list, ms);
  let held = Number.MIN_SAFE_INTEGER;
  for (let i = 1; i <= index; i++) held = Math.max(held, rawLifeDay(list[i].fromMs - 1, list[i - 1].offsetMin));
  return Math.max(held, rawLifeDay(ms, list[index].offsetMin));
}

/** The band window that contains ms: its id and absolute start/end.
 * A time zone change cuts a window at the change. */
export function bandAt(tz, ms) {
  const list = zones(tz);
  ensureTime(ms);
  const index = zoneIndexAt(list, ms), offsetMin = list[index].offsetMin;
  const sinceStart = mod(ms + offsetMin * MINUTE - LIFE_DAY_START, DAY);
  const dayStartMs = ms - sinceStart;
  const minute = floorDiv(sinceStart, MINUTE);
  const band = BANDS.find(b => minute >= b.from && minute < b.to);
  let startMs = dayStartMs + band.from * MINUTE, endMs = dayStartMs + band.to * MINUTE;
  if (index > 0 && list[index].fromMs > startMs) startMs = list[index].fromMs;
  if (index + 1 < list.length && list[index + 1].fromMs < endMs) endMs = list[index + 1].fromMs;
  return { band: band.id, startMs, endMs, lifeDay: lifeDayAt(list, ms) };
}

/** When the life day holding ms began (my 05:00 in the offset at ms) — the planner's dayStartMs. */
export function lifeDayStartAt(tz, ms) {
  const list = zones(tz);
  ensureTime(ms);
  return ms - mod(ms + list[zoneIndexAt(list, ms)].offsetMin * MINUTE - LIFE_DAY_START, DAY);
}

/** Band windows that overlap [fromMs, toMs), in order. */
export function bandsBetween(tz, fromMs, toMs) {
  ensureTime(fromMs); ensureTime(toMs);
  const out = [];
  for (let ms = fromMs; ms < toMs;) {
    const window = bandAt(tz, ms);
    out.push(window);
    ms = window.endMs;
  }
  return out;
}

/** A new device offset takes effect at the next band boundary in the old offset.
 * Settled time is never rewritten and only the last four records are kept. */
export function recordOffset(tzHistory, nowMs, offsetMin) {
  ensureTime(nowMs);
  if (!validOffset(offsetMin)) throw new RangeError('offset must be −720…840 minutes in 15-minute steps');
  const list = zones(tzHistory);
  const current = list[zoneIndexAt(list, nowMs)];
  const pending = list.at(-1).fromMs > nowMs;
  if (!pending && current.offsetMin === offsetMin) return list;
  const base = pending ? list.slice(0, -1) : list;
  if (base.at(-1).offsetMin === offsetMin) return base;
  const fromMs = bandAt(base, nowMs).endMs;
  return [...base, { fromMs, offsetMin }].slice(-4);
}

// ── weather (§4-4) ─────────────────────────────────────────────────────────────

const kstDays = ms => floorDiv(ms + KST_OFFSET_MIN * MINUTE, DAY);

// A pure function's memo: the planner asks about the same day many times.
const weatherMemo = new Map();

/** The day shape of a village on a Korean date (days since 1970-01-01). */
export function weatherDayOf(villageSeed, kstDayNumber) {
  if (typeof villageSeed !== 'string' || !villageSeed) throw new TypeError('villageSeed is a non-empty string');
  const key = `${villageSeed}\u001f${kstDayNumber}`;
  const known = weatherMemo.get(key);
  if (known) return known;
  const { month } = civilFromDays(kstDayNumber);
  const rng = createRng('weather', villageSeed, dateOfDays(kstDayNumber));
  const shape = WEATHER_ORDER[pickByWeight(rng.next(), WEATHER_WEIGHTS[seasonOfMonth(month)])];
  if (weatherMemo.size >= 4096) weatherMemo.clear();
  weatherMemo.set(key, shape);
  return shape;
}

/** Rain windows as absolute [startMs, endMs) for one Korean date. */
function rainWindows(villageSeed, kstDayNumber) {
  const start = kstDayNumber * DAY - KST_OFFSET_MIN * MINUTE;
  return WEATHER_DAYS[weatherDayOf(villageSeed, kstDayNumber)].map(([from, to]) => [start + from * HOUR, start + to * HOUR]);
}

export function weatherAt(villageSeed, ms) {
  ensureTime(ms);
  return rainWindows(villageSeed, kstDays(ms)).some(([from, to]) => ms >= from && ms < to) ? 'rain' : 'clear';
}

/** Does it rain anywhere in [fromMs, toMs)? */
export function rainBetween(villageSeed, fromMs, toMs) {
  ensureTime(fromMs); ensureTime(toMs);
  for (let day = kstDays(fromMs); day <= kstDays(toMs - 1); day++) {
    if (rainWindows(villageSeed, day).some(([from, to]) => from < toMs && to > fromMs)) return true;
  }
  return false;
}

/** The instants inside [fromMs, toMs) where the weather changes, in order. */
export function weatherChangesBetween(villageSeed, fromMs, toMs) {
  ensureTime(fromMs); ensureTime(toMs);
  const out = [];
  for (let day = kstDays(fromMs); day <= kstDays(toMs - 1) + 1; day++) {
    for (const [from, to] of rainWindows(villageSeed, day)) for (const edge of [from, to]) {
      if (edge > fromMs && edge < toMs && weatherAt(villageSeed, edge - 1) !== weatherAt(villageSeed, edge)) out.push({ atMs: edge, to: weatherAt(villageSeed, edge) });
    }
  }
  return out.sort((a, b) => a.atMs - b.atMs).filter((change, i, list) => i === 0 || change.atMs !== list[i - 1].atMs);
}

// ── the whole clock (§4-7) ─────────────────────────────────────────────────────

function lightKeyAt(minuteOfDay) {
  let i = LIGHT_KEYS.length - 1;
  while (i > 0 && LIGHT_KEYS[i].at > minuteOfDay) i--;
  const from = LIGHT_KEYS[i], to = LIGHT_KEYS[(i + 1) % LIGHT_KEYS.length];
  const span = (to.at > from.at ? to.at : to.at + 24 * 60) - from.at;
  return { from: from.id, to: to.id, t: (minuteOfDay - from.at) / span };
}

/** A resident's day kind: an off day comes before the weekend (§4-3). */
export function dayKindOf(lifeDay, offWeekday = null) {
  const weekday = weekdayOf(lifeDay);
  if (offWeekday !== null && weekday === offWeekday) return 'off';
  return weekday >= 5 ? 'weekend' : 'weekday';
}

/** Everything a screen or planner needs about now, from the server clock only. */
export function clockAt({ villageSeed, hostNowMs, tz }) {
  ensureTime(hostNowMs);
  const offsetMin = offsetAt(tz, hostNowMs);
  const kstDay = kstDays(hostNowMs);
  const { month } = civilFromDays(kstDay);
  const window = bandAt(tz, hostNowMs);
  const localMinute = floorDiv(mod(hostNowMs + offsetMin * MINUTE, DAY), MINUTE);
  const tomorrowStart = hostNowMs - mod(hostNowMs + offsetMin * MINUTE - LIFE_DAY_START, DAY) + DAY;
  return {
    kstDate: dateOfDays(kstDay),
    kstHour: floorDiv(mod(hostNowMs + KST_OFFSET_MIN * MINUTE, DAY), HOUR),
    season: seasonOfMonth(month),
    lifeDay: window.lifeDay,
    lifeDate: dateOfDays(window.lifeDay),
    localTime: `${pad2(floorDiv(localMinute, 60))}:${pad2(localMinute % 60)}`,
    dayKind: dayKindOf(window.lifeDay),
    band: window.band,
    bandStartMs: window.startMs,
    bandEndMs: window.endMs,
    weatherNow: weatherAt(villageSeed, hostNowMs),
    weatherDay: weatherDayOf(villageSeed, kstDay),
    // Tomorrow for a resident means my next life day while people are up (05:00–21:00).
    weatherTomorrow: rainBetween(villageSeed, tomorrowStart, tomorrowStart + 16 * HOUR) ? 'rain' : 'clear',
    lightKey: lightKeyAt(localMinute),
  };
}
