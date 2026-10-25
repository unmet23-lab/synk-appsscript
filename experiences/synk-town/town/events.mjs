/** The town's event contract (vertical slice design §14-2, §20-1). An event is one confirmed line of
 * the event branch. An event the player took part in (actors include "player") carries the fields a
 * relationship can be computed again from — the player's role, who helped whom, the segments that
 * were actually shown, and the activity and its family; residents' own events never do. No event
 * holds raw words, a name or a learning answer (§13-3). Whether a result was actually seen is its
 * own event, reaction.delivered. Plain module: the caller gives ids and the clock.
 */
export const ROLES = Object.freeze(['choose', 'make', 'deliver', 'delegate', 'watch']);
export const FAMILIES = Object.freeze(['cafe-life', 'workshop-life', 'greenhouse-life', 'gather']);
/** Atlas's own feedback words (engine.js:81), never new ones. */
export const FEEDBACK = Object.freeze(['helpful', 'not_fit', 'too_much', 'want_more']);
export const RELATION = Object.freeze(['participantRole', 'help', 'deliveredSegmentIds', 'canonicalActivityId', 'storyFamily']);
// Keys no event may carry: words, names and answers stay out of the record.
const RAW = Object.freeze(['text', 'line', 'lines', 'message', 'name', 'displayName', 'answer', 'input', 'transcript', 'utterance', 'email']);

const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
const actor = value => value === 'player' || id(value);
const ids = (value, min = 0) => Array.isArray(value) && value.length >= min && value.every(id) && new Set(value).size === value.length;
const count = value => Number.isSafeInteger(value) && value > 0;

/** The new kinds of §20 and the fields each must hold. */
export const KINDS = Object.freeze({
  'reaction.delivered': { source: id },
  'feedback.given': { completionId: id, value: v => FEEDBACK.includes(v), canonicalActivityId: id },
  'feedback.removed': { completionId: id },
  'memory.forgotten': { npc: id, target: id },
  'consent.changed': { consent: v => v === 'evalSignals', state: v => ['granted', 'declined', 'withdrawn'].includes(v), ver: id },
  'item.granted': { grantId: id, itemId: id, qty: count, source: id, cause: id },
  'item.transferred': { itemId: id, qty: count, from: id, to: id },
  'item.consumed': { itemId: id, qty: count, source: id, cause: id },
  // A resident finished sitting at a habit spot (§6-5): a residents-only line, never a Trail fact.
  'habit.used': { npc: id, spot: id, archetype: id, lifeDay: Number.isSafeInteger, band: id },
  // A small need card solved (§8, W5): its reference (band and card), the path, and whether the village may hear of it —
  // alone or by two it is public; with the player only those in it know (§9-2, G6).
  'card.resolved': { ref: id, card: v => /^[CWR][1-6]$/.test(v), path: v => ['self', 'pair', 'player'].includes(v), public: v => typeof v === 'boolean' },
});

/** The relationship fields of an event the player took part in, checked (§20-1). */
export function relation({ participantRole, help, deliveredSegmentIds = [], canonicalActivityId, storyFamily }) {
  if (!Array.isArray(participantRole) || !participantRole.length || participantRole.length > 2
    || new Set(participantRole).size !== participantRole.length || !participantRole.every(role => ROLES.includes(role))) throw new TypeError('participantRole is one or two of choose, make, deliver, delegate, watch');
  if (help !== undefined && !(help && actor(help.by) && Array.isArray(help.to) && help.to.length && help.to.every(actor)
    && new Set(help.to).size === help.to.length && !help.to.includes(help.by))) throw new TypeError('help is { by, to[] }');
  if (!ids(deliveredSegmentIds)) throw new TypeError('deliveredSegmentIds lists the segments actually shown');
  if (!id(canonicalActivityId) || !FAMILIES.includes(storyFamily)) throw new TypeError('an activity and its family');
  return { participantRole: [...participantRole], ...(help ? { help: { by: help.by, to: [...help.to] } } : {}),
    deliveredSegmentIds: [...deliveredSegmentIds], canonicalActivityId, storyFamily };
}

/** Segments shown up to where the player stopped a scene ("그만할래요" keeps only what was seen). */
export const shownUpTo = (segmentIds, lastShown) => {
  const at = segmentIds.indexOf(lastShown);
  return at < 0 ? [] : segmentIds.slice(0, at + 1);
};

/** Whether a line may join the branch: its kind's fields hold, relation fields appear exactly when the
 * player took part, and nothing raw is in it. Returns the reason it may not, or null. */
export function eventProblem(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return 'not an event';
  if (!id(event.id) || typeof event.kind !== 'string' || !/^[a-z]+(?:\.[a-z-]+)+$/.test(event.kind)) return 'id and kind';
  const raw = key => RAW.includes(key);
  const walk = value => Array.isArray(value) ? value.some(walk) : value && typeof value === 'object' ? Object.entries(value).some(([key, inner]) => raw(key) || walk(inner)) : false;
  if (walk(event)) return 'raw words';
  const fields = KINDS[event.kind];
  if (fields && !Object.entries(fields).every(([key, valid]) => valid(event[key]))) return `${event.kind} fields`;
  // Ledger, feedback and consent lines name no actors; the rule below is about scenes and cards.
  if (event.actors === undefined) return null;
  if (!(Array.isArray(event.actors) && event.actors.length && event.actors.every(actor))) return 'actors';
  const withPlayer = event.actors.includes('player');
  const present = RELATION.filter(key => event[key] !== undefined);
  if (!withPlayer) return present.length ? 'relation fields on a residents-only event' : null;
  try { relation(event); } catch (error) { return error.message; }
  return null;
}
export const validEvent = event => eventProblem(event) === null;

/** An event the player took part in: the base fields plus its relationship fields. */
export function playerEvent(base, fields) {
  const actors = [...new Set([...(base.actors || []), 'player'])];
  const event = { ...base, actors, ...relation(fields) };
  const problem = eventProblem(event);
  if (problem) throw new TypeError(problem);
  return event;
}

/** The moment a result was really seen on the player's screen (§20-1, relationship:63). */
export const reactionDelivered = (eventId, sourceId) => ({ id: eventId, kind: 'reaction.delivered', source: sourceId });
