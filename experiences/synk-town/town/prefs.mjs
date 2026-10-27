/** Feedback, "less often", "something else today" and observe → ask once → confirm (vertical slice
 * design §20-3). Only what the player said moves an order: an observation turns into one question,
 * never into a ranking by itself. Feedback uses Atlas's four words and lives in the town's own
 * ledger, not the learning record. Declared settings (less often, the family shown first, not being
 * approached first) hold in both arms; ranking from observation and feedback, and the taste question,
 * run in the adapted arm only (§20-6). Uses are counted, never timed (G3). All values come from the
 * parameter version by name.
 */
import { paramsFor, adaptedOn } from './params.mjs';
import { FEEDBACK, FAMILIES } from './events.mjs';

export const initialPrefs = () => ({ preferredFamily: null, lessOften: [], approachOptOut: [],
  todayOther: { visitId: null, items: [] }, observed: null, denied: [], feedback: [] });
export const initialAsks = () => ({ lastLifeDay: null, asked: {} });
/** The mascot's questions share one budget a life day; when two stand on the same day, this order wins. */
export const ASK_ORDER = Object.freeze(['widen', 'taste', 'consent']);

const day = value => Number.isSafeInteger(value) && value >= 0;
const unit = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value);
const toggle = (list, value, on) => on ? [...new Set([...list, value])] : list.filter(item => item !== value);

/** The last answer for a result replaces the one before. */
export function giveFeedback(prefs, { completionId, value, canonicalActivityId, lifeDay }) {
  if (!unit(completionId) || !FEEDBACK.includes(value) || !unit(canonicalActivityId) || !day(lifeDay)) throw new TypeError('feedback names a result, one of the four words, its activity and the life day');
  return { ...prefs, feedback: [...prefs.feedback.filter(item => item.completionId !== completionId), { completionId, value, canonicalActivityId, lifeDay }] };
}
export const removeFeedback = (prefs, completionId) => ({ ...prefs, feedback: prefs.feedback.filter(item => item.completionId !== completionId) });
/** Responses older than the version's limit are no longer used. */
export const activeFeedback = (prefs, lifeDay, params = paramsFor()) => prefs.feedback.filter(item => lifeDay - item.lifeDay < params.prefs.feedbackLifeDays);
export const setLessOften = (prefs, activity, on) => { if (!unit(activity)) throw new TypeError('less often names a card or an activity'); return { ...prefs, lessOften: toggle(prefs.lessOften, activity, on) }; };
export const setApproach = (prefs, activity, optOut) => { if (!unit(activity)) throw new TypeError('an activity'); return { ...prefs, approachOptOut: toggle(prefs.approachOptOut, activity, optOut) }; };
/** "Something else today" holds for this visit only. */
export function setTodayOther(prefs, visitId, activity) {
  if (!unit(visitId) || !unit(activity)) throw new TypeError('a visit and an activity');
  const items = prefs.todayOther.visitId === visitId ? prefs.todayOther.items : [];
  return { ...prefs, todayOther: { visitId, items: [...new Set([...items, activity])] } };
}
export const todayOther = (prefs, visitId, activity) => prefs.todayOther.visitId === visitId && prefs.todayOther.items.includes(activity);
/** The answer to "show this family first?": yes makes it the family shown first; no is never asked
 * again for that family (only another family's new evidence starts a question); clear lets it go. */
export function answerFamily(prefs, family, answer) {
  if (!FAMILIES.includes(family) || !['yes', 'no', 'clear'].includes(answer)) throw new TypeError('a family and yes, no or clear');
  if (answer === 'yes') return { ...prefs, preferredFamily: family, observed: null, denied: prefs.denied.filter(item => item !== family) };
  if (answer === 'no') return { ...prefs, observed: null, denied: [...new Set([...prefs.denied, family])],
    preferredFamily: prefs.preferredFamily === family ? null : prefs.preferredFamily };
  return { ...prefs, preferredFamily: prefs.preferredFamily === family ? null : prefs.preferredFamily };
}

/** Keep the newest uses (counted, not timed); direct says the player opened it themself. */
export function recordUse(uses, use, params = paramsFor()) {
  if (!unit(use?.useId) || !unit(use.canonicalActivityId) || !FAMILIES.includes(use.storyFamily) || typeof use.direct !== 'boolean') throw new TypeError('a use');
  return [...uses.filter(item => item.useId !== use.useId), { ...use }].slice(-params.observe.recentUses);
}
/** A family the player keeps opening themself: enough of the newest direct uses share it. It is a
 * candidate for one question, never a ranking. A family already first, already preferred or once
 * answered no is not asked about. */
export function observedFamily(uses, prefs, { policy, firstFamily = null } = {}, params = paramsFor()) {
  if (!adaptedOn(policy)) return null;
  const recent = uses.filter(use => use.direct).slice(-params.observe.window);
  const counts = new Map();
  for (const use of recent) counts.set(use.storyFamily, (counts.get(use.storyFamily) || 0) + 1);
  // A family that is never asked about steps aside first, so it cannot hide another that qualifies.
  const asked = [...counts].filter(([family]) => family !== prefs.preferredFamily && family !== firstFamily && !prefs.denied.includes(family));
  const [family, n] = asked.sort((a, b) => b[1] - a[1])[0] || [];
  return family && n >= params.observe.needed ? family : null;
}
/** "I only did that then": the family's uses leave the observation and the candidate goes. */
export const correctObserved = (uses, prefs, family) => ({ uses: uses.filter(use => use.storyFamily !== family),
  prefs: { ...prefs, observed: prefs.observed === family ? null : prefs.observed } });

/** Whether the mascot may ask now: one question a life day, the same question not again too soon,
 * not in the first seconds of a visit. */
export function mayAsk(asks, { lifeDay, key, secondsIntoVisit }, params = paramsFor()) {
  if (!day(lifeDay) || typeof key !== 'string') throw new TypeError('a life day and a question key');
  if (asks.lastLifeDay === lifeDay || secondsIntoVisit < params.asks.quietAfterVisitSeconds) return false;
  const last = asks.asked[key];
  return last === undefined || lifeDay - last >= params.asks.sameQuestionLifeDays;
}
export const recordAsk = (asks, { lifeDay, key }) => ({ lastLifeDay: lifeDay, asked: { ...asks.asked, [key]: lifeDay } });
/** Of the questions that stand today, the one that goes first. */
export const firstAsk = kinds => ASK_ORDER.find(kind => kinds.includes(kind)) || null;

/** How strongly to put an activity forward, per mille, and whether it wins a tie. A declared "less
 * often" holds in both arms; "did not fit" and "helpful" count in the adapted arm only. Opening it
 * directly is never blocked. */
export function suggestionWeight(prefs, { activity, card = null, lifeDay, policy }, params = paramsFor()) {
  let weight = 1000;
  // Less often set on the activity or on the card offering it counts once.
  if (prefs.lessOften.includes(activity) || card !== null && prefs.lessOften.includes(card)) weight = weight * params.prefs.lessOftenMultiplier / 1000;
  const last = adaptedOn(policy) ? activeFeedback(prefs, lifeDay, params).filter(item => item.canonicalActivityId === activity).at(-1) : null;
  if (last?.value === 'not_fit') weight = weight * params.prefs.notFitMultiplier / 1000;
  return { weight: Math.round(weight), ahead: last?.value === 'helpful' };
}

/** "Clear all my personalisation" (§20-5): observations, responses and the uses behind them go;
 * what the player declared (less often, the family first, no approach, a no) stays. */
export const clearPersonal = ({ prefs, uses }) => ({ prefs: { ...prefs, observed: null, feedback: [] }, uses: [] });

/** The question waiting to be drawn or answered (W6): its key, kind, family for a taste question, its life day and
 * whether the screen drew it. */
const validOpen = open => !!open && typeof open === 'object' && ASK_ORDER.includes(open.kind) && unit(open.key) && day(open.lifeDay)
  && typeof open.delivered === 'boolean' && (open.kind === 'taste' ? FAMILIES.includes(open.family) && open.key === `taste:${open.family}` : open.family === undefined)
  && Object.keys(open).every(key => ['kind', 'key', 'family', 'lifeDay', 'delivered'].includes(key));
/** Whether a stored question budget is whole: life days only, no clock. */
export const validAsks = asks => !!asks && (asks.lastLifeDay === null || day(asks.lastLifeDay)) && !!asks.asked
  && typeof asks.asked === 'object' && !Array.isArray(asks.asked) && Object.values(asks.asked).every(day)
  && (asks.open === undefined || validOpen(asks.open)) && Object.keys(asks).every(key => ['lastLifeDay', 'asked', 'open'].includes(key));
/** Whether stored uses are whole: the newest few, counted and never timed. */
export const validUses = (uses, params = paramsFor()) => Array.isArray(uses) && uses.length <= params.observe.recentUses
  && uses.every(use => unit(use?.useId) && unit(use.canonicalActivityId) && FAMILIES.includes(use.storyFamily) && typeof use.direct === 'boolean');
/** Whether stored preferences are whole. */
export function validPrefs(prefs) {
  return !!prefs && (prefs.preferredFamily === null || FAMILIES.includes(prefs.preferredFamily))
    && ['lessOften', 'approachOptOut'].every(key => Array.isArray(prefs[key]) && prefs[key].every(unit))
    && Array.isArray(prefs.denied) && prefs.denied.every(family => FAMILIES.includes(family))
    && (prefs.observed === null || FAMILIES.includes(prefs.observed))
    && !!prefs.todayOther && (prefs.todayOther.visitId === null || unit(prefs.todayOther.visitId)) && Array.isArray(prefs.todayOther.items)
    && Array.isArray(prefs.feedback) && prefs.feedback.every(item => unit(item.completionId) && FEEDBACK.includes(item.value) && unit(item.canonicalActivityId) && day(item.lifeDay));
}
