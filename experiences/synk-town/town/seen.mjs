/** The "seen" ledger (vertical slice design §20-2): the keys of what the player actually went through
 * and how many times, and nothing else — no date or time field, because when someone came is not
 * this ledger's business (G3). A device reports the keys a screen really showed with a boundary or
 * a command; the server adds only keys the content data knows, at most a request's worth at once,
 * and stops each count at its cap. It is a delivery receipt, not a world result: a wrong claim only
 * changes that person's own marks. It never feeds relationships, rewards, card triggers or resident
 * state; line choice reads it only to pick the less seen of equal variants.
 */
import { paramsFor } from './params.mjs';

export const SEEN_KINDS = Object.freeze(['line', 'card', 'pair', 'scene', 'tea', 'gather']);
const SHAPES = Object.freeze({
  line: /^line:[A-Za-z0-9_.-]{1,80}$/,
  card: /^card:[CWR][1-6]:(?:self|pair|player)$/,
  pair: /^pair:[A-Za-z0-9_-]{1,40}:[A-Za-z0-9_-]{1,20}$/,
  scene: /^scene:[A-Za-z0-9_.-]{1,60}:[A-Za-z0-9_.-]{1,40}$/,
  tea: /^tea:[A-Za-z0-9_.-]{1,60}$/,
  gather: /^gather:[a-z][a-z0-9-]{1,40}$/,
});
/** The cards of this slice (§8): C1~C6, W1~W6, R1~R6. */
export const CARD_IDS = Object.freeze(['C', 'W', 'R'].flatMap(letter => Array.from({ length: 6 }, (_, i) => `${letter}${i + 1}`)));

export const seenKind = key => typeof key === 'string' && SEEN_KINDS.find(kind => key.startsWith(`${kind}:`) && SHAPES[kind].test(key)) || null;

/** Which keys the content knows: lines, pair steps, scene results and tea frames come with their
 * content data (W4~W9); cards and gathered items are known now. */
export function contentCatalog({ cards = CARD_IDS, items = [], lines = [], pairs = [], scenes = [], teaFrames = [] } = {}) {
  const keys = new Set([
    ...cards.flatMap(card => ['self', 'pair', 'player'].map(path => `card:${card}:${path}`)),
    ...items.map(item => `gather:${item}`), ...lines.map(line => `line:${line}`),
    ...pairs.map(([pair, step]) => `pair:${pair}:${step}`), ...scenes.map(([scene, result]) => `scene:${scene}:${result}`),
    ...teaFrames.map(frame => `tea:${frame}`)]);
  return key => keys.has(key) && seenKind(key) !== null;
}

/** Add one report: each known key once, up to a request's worth; counts stop at the cap. */
export function recordSeen(seen, keys, { known, params = paramsFor() } = {}) {
  if (typeof known !== 'function') throw new TypeError('recordSeen needs the content catalog');
  const { countMax, perRequest } = params.seen;
  const next = { ...seen }, added = [];
  for (const key of [...new Set(Array.isArray(keys) ? keys : [])].slice(0, perRequest)) {
    if (!known(key)) continue;
    next[key] = Math.min(countMax, (next[key] || 0) + 1);
    added.push(key);
  }
  return { seen: next, added };
}

export const seenCount = (seen, key) => seen[key] || 0;
/** A card or a pair-scene line, counted whatever path or step it took. */
export const familyCount = (seen, prefix) => Object.entries(seen).reduce((sum, [key, n]) => sum + (key.startsWith(prefix) ? n : 0), 0);
/** "Familiar life" (G8): the player has been through it more than familiarAfter times. */
export function familiar(seen, { card, pair }, params = paramsFor()) {
  const prefix = card ? `card:${card}:` : `pair:${pair}:`;
  return familyCount(seen, prefix) > params.seen.familiarAfter;
}
/** A "new story" mark: the key is not in the ledger at all. */
export const isNewStory = (seen, key) => !Object.hasOwn(seen, key);
/** Of equal variants, the one seen least (the first of them on a tie) — read from the device's copy. */
export const leastSeen = (variants, seen) => variants.reduce((best, key) => seenCount(seen, key) < seenCount(seen, best) ? key : best, variants[0]);
/** Clearing the ledger brings every story back as new. */
export const clearSeen = () => ({});
/** Whether a stored ledger is whole: keys of the six shapes, counts within the cap, no other field. */
export function validSeen(seen, params = paramsFor()) {
  return !!seen && typeof seen === 'object' && !Array.isArray(seen) && Object.entries(seen).every(([key, n]) => seenKind(key) !== null
    && Number.isSafeInteger(n) && n > 0 && n <= params.seen.countMax);
}
