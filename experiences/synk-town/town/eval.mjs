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
import { EVAL_CONSENT } from './data.gen.mjs';

// The consent's state is the world's, so the authority reads it from town/consent.mjs and never this module.
export { CONSENT_VER, CONSENT_STATES, initialConsents, changeConsent, mayWrite, validConsents } from './consent.mjs';
/** Each field of the visit line pairs with one item of the consent wording (§20-4 「칸과 동의 문구는 짝이다」): the table is
 * the consent contract file's (계약/마을평가신호_선택응답_계약.json — the talk copy holds the same bytes), read through the
 * generated data, so a field the wording does not name cannot be written (tests/town-eval.test.js). */
export const CONSENT_ITEMS = EVAL_CONSENT.items;
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
/** How long a visit has been, roughly, from its play time (U — never a clock reading). */
// The buckets' edges in play milliseconds: ten minutes, half an hour, an hour (the names say the same).
const LENGTH_EDGES = Object.freeze([600000, 1800000, 3600000]);
export function lengthBucket(playMs) {
  const at = LENGTH_EDGES.findIndex(edge => Math.max(0, playMs) < edge);
  return LENGTHS[at < 0 ? LENGTHS.length - 1 : at];
}
const SEEN_PREFIX = key => String(key).split(':')[0];
const add = (tally, key, n = 1) => (n ? { ...(tally || {}), [key]: ((tally || {})[key] || 0) + n } : tally);
const tallyOf = keys => keys.reduce((out, key) => add(out, SEEN_PREFIX(key)), undefined);
/** A visit's line after one request (§20-4, W6). The line carries its own tallies from request to request, so the
 * world the town computes from keeps nothing of it (G11): previous is the line already written for this visit (null
 * for its first), before and after the world around the request, command the command (null for a boundary), added the
 * seen keys this request added and seen the seen ledger now. Returns the fields, or null when the visit has no version
 * or band yet. What each command counts: a card done with the player (did card.<ID>), one closed before it was done
 * (stoppedScenes), a response (feedback by value), "less often" set (lessOften), "something else today" (todayOther),
 * the asks pressed in a scene by kind (help — the consent's 다시 · 천천히 · 무슨 뜻이에요; reopening a folded note is not
 * one) and the widening offer (ladderOffer — none once the mascot's widening question is drawn, then the answer) (W9). The
 * question is drawn when the screen reports it beside a boundary, or when it is closed unanswered (ASK_CLOSE counts it
 * drawn first); an answer before the report goes straight to its value (W9 design review 5). */
const HELP_KINDS = Object.freeze(['repeat', 'slower', 'meaning']);
function widenDrawn(before, after, command) {
  const was = before?.asks?.open;
  if (was?.kind !== 'widen' || was.delivered) return false;
  const now = after?.asks?.open;
  return now?.key === was.key && now.delivered === true || command?.type === 'ASK_CLOSE' && command.payload?.key === was.key;
}
export function visitSummary(previous, { before, after, command = null, added = [], seen = {} }) {
  const visit = after?.townVisit, policy = after?.policy;
  if (!visit || visit.lifeDay === undefined || !policy || !after.life) return null;
  const same = previous && previous.id === policy.visitId ? previous : null;
  const fields = { id: policy.visitId, lifeDay: visit.lifeDay, band: visit.band, lengthBucket: lengthBucket(after.life.uMs - after.life.visitStartU),
    paramsVer: policy.paramsVer, arm: policy.arm, consentVer: CONSENT_VER };
  let did = same?.did, feedback = same?.feedback, lessOften = same?.lessOften ?? 0, todayOther = same?.todayOther ?? 0, stopped = same?.stoppedScenes ?? 0;
  const take = (before?.village?.takes || []).find(t => t.open) ?? null;
  if (command?.type === 'CARD_CONFIRM' && take) did = add(did, `card.${take.card}`);
  if (command?.type === 'CARD_CLOSE' && take?.status === 'with') stopped += 1;
  if (command?.type === 'FEEDBACK_GIVE') feedback = add(feedback, command.payload.value);
  if (command?.type === 'PREF_LESS_OFTEN' && command.payload.on === true) lessOften += 1;
  if (command?.type === 'PREF_TODAY_OTHER') todayOther += 1;
  // A scene's asks: one a press (C4 · the tea order), or — from a tea screen before W9 or a tea without the town's language —
  // the increments its next command carries, by guest slot as the order adds them (tea-order addAsks; talk review GA1).
  let help = same?.help, ladderOffer = same?.ladderOffer;
  if (['CARD_HELP', 'TEA_HELP'].includes(command?.type) && HELP_KINDS.includes(command.payload?.kind)) help = add(help, command.payload.kind);
  if (/^TEA_(SERVE|OWNER|CLOSE)$/.test(command?.type || '') && command.payload?.asks)
    for (const counts of Object.values(command.payload.asks)) for (const kind of HELP_KINDS) help = add(help, kind, Number.isSafeInteger(counts?.[kind]) ? counts[kind] : 0);
  if (command?.type === 'LANGUAGE_ANSWER' && ['accepted', 'declined'].includes(command.payload?.choice)) ladderOffer = command.payload.choice;
  else if (widenDrawn(before, after, command)) ladderOffer = 'none';
  const fresh = tallyOf(added), newSeenBy = Object.entries(fresh || {}).reduce((out, [key, n]) => add(out, key, n), same?.newSeenBy);
  const seenTotalBy = Object.entries(seen).reduce((out, [key, n]) => add(out, SEEN_PREFIX(key), n), undefined);
  return { ...fields, ...(did ? { did } : {}), ...(newSeenBy ? { newSeenBy } : {}), ...(seenTotalBy ? { seenTotalBy } : {}),
    ...(feedback ? { feedback } : {}), lessOften, todayOther, stoppedScenes: stopped, ...(help ? { help } : {}), ...(ladderOffer ? { ladderOffer } : {}) };
}
/** Write (overwrite by visit id) only under consent; otherwise nothing is kept. */
export const writeVisit = (lines, consents, fields) => mayWrite(consents) ? [...lines.filter(line => line.id !== fields.id), visitLine(fields)] : lines;
/** Lines past the keeping period go. */
export const retainVisits = (lines, lifeDay, params = paramsFor()) => lines.filter(line => lifeDay - line.lifeDay < params.eval.retainLifeDays);
/** Aggregates compare only groups of at least the minimum size. */
export const comparable = (groupSize, params = paramsFor()) => groupSize >= params.eval.minGroup;
