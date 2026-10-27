/** The time the player usually comes (vertical slice design §10-3, W6): a ring of the last few life days, each holding
 * only the band its first visit began in — no clock reading, no date beside the last life day written, a fixed size
 * (G7). A band holds when it is most of the ring's visits and enough of them; only the night and the morning fill
 * more spots (the day and the evening already have the three residents), so a habit of the day or the evening is no
 * habit at all — a village visited every noon plans exactly as one left alone (§15-2). A life day reads only the life
 * days before it, so a band's plan, made as it opens, never turns on when that day's first visit came (§14-4).
 * Turning it off empties the ring and keeps nothing more; turning it on starts from an empty ring. Nothing that
 * chooses lines, learning, relationships, rewards, questions or evaluation reads this (G4·G11). Plain module; every
 * 〔초기값〕 comes from the parameter version's visitBands section.
 */
import { paramsFor } from './params.mjs';
import { BAND_IDS } from './clock.mjs';

const V = params => (params ?? paramsFor()).visitBands;
/** The bands whose spots a habit fills (§10-3 쓰임). */
export const HABIT_BANDS = Object.freeze(['night', 'morning']);
/** The life days a settlement may still plan behind the one it writes (the seven-day absence limit, and that day itself):
 * the ring keeps them beside the thirty it judges by, so writing today never drops a day a band still being opened
 * counts (backend review A2). */
const CATCH_UP_DAYS = 8;
const sizeOf = params => V(params).ringLifeDays + CATCH_UP_DAYS;
export const initialVisitBands = params => ({ ring: Array(sizeOf(params)).fill(null), day: null, off: false });

const lifeDayOk = value => Number.isSafeInteger(value) && value >= 0;
const cell = (lifeDay, size) => ((lifeDay % size) + size) % size;

/** The first visit of a life day writes its band; the life days between had none. Off, or a life day behind the last
 * one written (life days never go back, §15-3), leaves the ring as it is. */
export function writeBand(visitBands, lifeDay, band, params) {
  const size = sizeOf(params);
  if (visitBands.off || !BAND_IDS.includes(band) || !lifeDayOk(lifeDay) || visitBands.day !== null && lifeDay < visitBands.day) return visitBands;
  if (visitBands.day === lifeDay && visitBands.ring[cell(lifeDay, size)] !== null) return visitBands;
  const ring = [...visitBands.ring];
  if (visitBands.day === null || lifeDay - visitBands.day >= size) ring.fill(null);
  else for (let d = visitBands.day + 1; d < lifeDay; d++) ring[cell(d, size)] = null;
  ring[cell(lifeDay, size)] = band;
  return { ...visitBands, ring, day: lifeDay };
}

/** The habit a life day plans with: of the life days before it still in the ring, one band holding at least the least
 * count and the share of them — null otherwise, when off, or when it is the day or the evening. */
export function habitOf(visitBands, lifeDay, params) {
  const { ringLifeDays: window, least, sharePerMille } = V(params), size = sizeOf(params);
  if (!visitBands || visitBands.off || visitBands.day === null || !lifeDayOk(lifeDay)) return null;
  const counts = new Map();
  let total = 0;
  for (let d = Math.max(visitBands.day - size + 1, lifeDay - window); d <= Math.min(visitBands.day, lifeDay - 1); d++) {
    const band = visitBands.ring[cell(d, size)];
    if (band) { counts.set(band, (counts.get(band) || 0) + 1); total++; }
  }
  const [band, count] = [...counts].sort((a, b) => b[1] - a[1])[0] || [];
  return band && count >= least && count * 1000 >= total * sharePerMille && HABIT_BANDS.includes(band) ? band : null;
}

/** Off empties the ring and writes nothing more; on starts again from an empty ring — and the setting it already has
 * changes nothing (a repeated on keeps the ring, design review F13). */
export const setVisitBands = (visitBands, on, params) => (visitBands.off === (on !== true) ? visitBands : { ...initialVisitBands(params), off: on !== true });
/** "Clear all my personalisation" (§20-5) empties the ring; the player's own setting (off) stays. */
export const clearVisitBands = (visitBands, params) => ({ ...initialVisitBands(params), off: visitBands.off });

/** Whether a stored ring is whole: its size, band names only, the one life day, the setting. */
export function validVisitBands(visitBands, params) {
  return !!visitBands && Array.isArray(visitBands.ring) && visitBands.ring.length === sizeOf(params)
    && visitBands.ring.every(band => band === null || BAND_IDS.includes(band))
    && (visitBands.day === null || lifeDayOk(visitBands.day)) && typeof visitBands.off === 'boolean'
    && Object.keys(visitBands).length === 3;
}
