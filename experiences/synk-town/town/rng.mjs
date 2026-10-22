/** Deterministic randomness for the town runtime (design §2-4).
 * Only 32-bit integer arithmetic and string hashing, so the browser, Node and
 * the talk runtime draw the same numbers. Never use Math.random in town code.
 */

const SEP = '\u001f';

/** Stable key from parts. Numbers print the same in every engine. */
export function seedKey(...parts) {
  return parts.map(part => {
    if (typeof part === 'string') return part;
    if (Number.isSafeInteger(part)) return String(part);
    throw new TypeError('seed parts are strings or safe integers');
  }).join(SEP);
}

/** xmur3 string hash: returns a generator of 32-bit seeds. */
function xmur3(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function hashString(text) {
  if (typeof text !== 'string') throw new TypeError('hashString takes a string');
  return xmur3(text)();
}

/** Integer-only pick: the slot of ⌊u × total / 2³²⌋ in the cumulative sum (§6-4).
 * Weights are non-negative safe integers. Returns -1 when every weight is 0. */
export function pickByWeight(u, weights) {
  if (!Number.isSafeInteger(u) || u < 0 || u > 0xffffffff) throw new RangeError('u is a 32-bit unsigned integer');
  let total = 0;
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) throw new RangeError('weights are non-negative integers');
    total += weight;
  }
  if (total === 0) return -1;
  // u < 2³² and total ≤ 2²¹ keep u × total below 2⁵³, so plain numbers are exact; beyond that use BigInt.
  const target = total <= 0x1fffff ? Math.floor(u * total / 4294967296) : Number((BigInt(u) * BigInt(total)) >> 32n);
  let running = 0;
  for (let i = 0; i < weights.length; i++) {
    running += weights[i];
    if (target < running) return i;
  }
  return weights.length - 1;
}

/** sfc32 generator seeded from the parts' hash. */
export function createRng(...parts) {
  const next32 = xmur3(seedKey(...parts));
  let a = next32(), b = next32(), c = next32(), d = next32();
  const next = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  // Warm up so related seeds do not start with related numbers.
  for (let i = 0; i < 12; i++) next();
  return {
    next,
    /** Integer in [0, n). */
    below(n) {
      if (!Number.isSafeInteger(n) || n <= 0 || n > 0xffffffff) throw new RangeError('below takes 1..2^32');
      return n <= 0x1fffff ? Math.floor(next() * n / 4294967296) : Number((BigInt(next()) * BigInt(n)) >> 32n);
    },
    /** Integer in [lo, hi], both ends included. */
    between(lo, hi) {
      if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || hi < lo) throw new RangeError('between takes lo ≤ hi');
      return lo + this.below(hi - lo + 1);
    },
    /** True with probability perMille / 1000. */
    chance(perMille) {
      if (!Number.isSafeInteger(perMille) || perMille < 0 || perMille > 1000) throw new RangeError('chance takes 0..1000');
      return this.below(1000) < perMille;
    },
    pick(list) {
      if (!Array.isArray(list) || !list.length) throw new RangeError('pick takes a non-empty list');
      return list[this.below(list.length)];
    },
  };
}
