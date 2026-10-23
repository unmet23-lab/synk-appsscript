/** Evaluation-only signals and their consent (vertical slice design §20-4). One summary line per
 * visit, overwritten by visit id, kept apart from personalisation, and written only while the
 * separate consent town-eval-signals-1 is granted. Nothing in the town reads them (G11): the
 * planner, settlement, line choice, recommendation, the ladder, resident knowledge and "what changed
 * meanwhile" never import this module — only the server's write does (tests/town-eval.test.js).
 * Academy-linked accounts are never asked and cannot turn it on; withdrawing is always accepted and
 * deletes that account's lines at once.
 */
import { paramsFor } from './params.mjs';
import { CONSENT_VER, mayWrite } from './consent.mjs';

// The consent's state is the world's, so the authority reads it from town/consent.mjs and never this module.
export { CONSENT_VER, CONSENT_STATES, initialConsents, changeConsent, mayWrite, validConsents } from './consent.mjs';
/** Each field of the visit line pairs with one item of the consent wording (§20-4 「칸과 동의 문구는
 * 짝이다」); W6 moves this table into the consent contract file and the check reads it there. */
export const CONSENT_ITEMS = Object.freeze({
  '날과 때': ['lifeDay', 'band'],
  '머문 시간': ['lengthBucket'],
  '한 일': ['did', 'newSeenBy', 'seenTotalBy', 'stoppedScenes'],
  '남긴 응답': ['feedback', 'lessOften', 'todayOther', 'ladderOffer', 'help'],
  '마을 설정의 이름': ['paramsVer', 'arm', 'consentVer'],
});
export const VISIT_FIELDS = Object.freeze(['id', ...Object.values(CONSENT_ITEMS).flat()]);
const BANDS = ['morning', 'day', 'evening', 'night'], LENGTHS = ['under-10m', '10-30m', '30m-1h', 'over-1h'];
const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value);
const n = value => Number.isSafeInteger(value) && value >= 0;
const tally = value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([key, count]) => id(key) && n(count));

/** One visit's summary, checked: only the consented fields, no names, words or clock readings. */
export function visitLine(fields) {
  const extra = Object.keys(fields).filter(key => !VISIT_FIELDS.includes(key));
  if (extra.length) throw new TypeError(`not in the consent: ${extra.join(', ')}`);
  const valid = id(fields.id) && n(fields.lifeDay) && BANDS.includes(fields.band) && LENGTHS.includes(fields.lengthBucket)
    && id(fields.paramsVer) && ['adapted', 'baseline'].includes(fields.arm) && fields.consentVer === CONSENT_VER
    && ['did', 'newSeenBy', 'seenTotalBy', 'feedback', 'help'].every(key => fields[key] === undefined || tally(fields[key]))
    && ['lessOften', 'todayOther', 'stoppedScenes'].every(key => fields[key] === undefined || n(fields[key]))
    && (fields.ladderOffer === undefined || ['none', 'accepted', 'declined'].includes(fields.ladderOffer));
  if (!valid) throw new TypeError('a visit line');
  return { ...fields };
}
/** Write (overwrite by visit id) only under consent; otherwise nothing is kept. */
export const writeVisit = (lines, consents, fields) => mayWrite(consents) ? [...lines.filter(line => line.id !== fields.id), visitLine(fields)] : lines;
/** Lines past the keeping period go. */
export const retainVisits = (lines, lifeDay, params = paramsFor()) => lines.filter(line => lifeDay - line.lifeDay < params.eval.retainLifeDays);
/** Aggregates compare only groups of at least the minimum size. */
export const comparable = (groupSize, params = paramsFor()) => groupSize >= params.eval.minGroup;
