/** Parameter versions, arms and the brake (vertical slice design §20-6).
 * Every 〔초기값〕 is read by name from one version of town/data/params.json; code never
 * writes those numbers. A version that has run never changes — a new value is a new version.
 * The server keeps one operating line { active, previous, baselineShare, stop }. A visit's
 * version and arm are decided once when the visit opens and stay for the whole visit; stop
 * sends every account to the baseline arm on the first version. The town reads only this line,
 * never the evaluation signals (G11).
 */
import { PARAMS } from './data.gen.mjs';
import { seedKey, hashString } from './rng.mjs';

export const PARAMS_BY_VER = Object.freeze(Object.fromEntries(PARAMS.map(version => [version.paramsVer, version])));
export const FIRST_PARAMS_VER = PARAMS[0].paramsVer;
/** Same words as Atlas (engine.js:299). */
export const ARMS = Object.freeze(['adapted', 'baseline']);
export const DEFAULT_OPS = Object.freeze({ active: FIRST_PARAMS_VER, previous: null, baselineShare: 0, stop: false });

export function paramsFor(paramsVer = FIRST_PARAMS_VER) {
  if (!Object.hasOwn(PARAMS_BY_VER, paramsVer)) throw new RangeError(`unknown params version: ${paramsVer}`);
  return PARAMS_BY_VER[paramsVer];
}

/** The operating line, checked: known versions, a per-mille baseline share. */
export function validateOps(ops = DEFAULT_OPS) {
  const out = { ...DEFAULT_OPS, ...ops };
  if (Object.keys(out).length !== 4) throw new TypeError('ops has active, previous, baselineShare and stop');
  paramsFor(out.active);
  if (out.previous !== null) paramsFor(out.previous);
  if (!Number.isSafeInteger(out.baselineShare) || out.baselineShare < 0 || out.baselineShare > 1000) throw new RangeError('baselineShare is per-mille');
  if (typeof out.stop !== 'boolean') throw new TypeError('stop is a boolean');
  return Object.freeze(out);
}

/** The arm of one visit, from the village seed and the visit id — never from who the player is. */
export function armFor(villageSeed, visitId, ops = DEFAULT_OPS) {
  const line = validateOps(ops);
  if (line.stop) return 'baseline';
  if (line.baselineShare === 0) return 'adapted';
  const slot = Math.floor(hashString(seedKey(villageSeed, 'arm', visitId)) * 1000 / 4294967296);
  return slot < line.baselineShare ? 'baseline' : 'adapted';
}

/** What a visit runs on, fixed when it opens (§20-6). */
export function policyFor({ villageSeed, visitId, ops = DEFAULT_OPS }) {
  if (typeof visitId !== 'string' || !visitId) throw new TypeError('policyFor needs a visit id');
  const line = validateOps(ops);
  return Object.freeze({ visitId, paramsVer: line.stop ? FIRST_PARAMS_VER : line.active, arm: armFor(villageSeed, visitId, line) });
}

/** Marks an event carries (§20-6): a decision or its result inside a visit names the version and
 * the arm; what settlement produced outside any visit names the version only. */
export function eventMarks(policy, { inVisit }) {
  if (!policy) return {};
  return inVisit ? { paramsVer: policy.paramsVer, arm: policy.arm } : { paramsVer: policy.paramsVer };
}

/** Knobs the baseline arm turns off (§20-6): widening offers, ranking from observation and
 * feedback with the taste question, and habit spots. Declared settings, step-downs, absence
 * not shown and consent stay on in both arms. */
export function adaptedOn(policy) {
  return !policy || policy.arm !== 'baseline';
}
