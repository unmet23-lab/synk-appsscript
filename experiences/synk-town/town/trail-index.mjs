/** The Trail index a world keeps (vertical slice §14-2·§14-3, W2 plan D7). Appending a fact or a
 * delivery is checked against it in constant time and reaction choice reads it, so no request
 * re-reads the life log. It follows atlas/trail-life.js for the two kinds the game writes — facts
 * and deliveries. The game writes no corrections or relayed knowledge, so the residents who know a
 * fact are its knownBy; the index refuses the other two kinds (F6). The sequence goes on across a
 * reset, so an event id is never reused (F7). Plain module, no imports: the caller validates each
 * event with Trail first.
 * Shape: { seq, archivedBelow, facts: { id: [factType, knownBy] }, deliveries: { deliveryId: { npcId,
 *   semanticKey, sourceIds, sig } }, npcs: [every resident a fact ever named], lastSeatPlaced,
 *   folded: { factType: count } }
 * archivedBelow is where the world's epoch began (a reset archives everything at or below it).
 * The world keeps only the facts its state can still point to (W2 plan D7·F9): foldIndex counts the
 * rest by type, and the whole lines stay in the event branch.
 */
export const emptyIndex = (seq = 0) => ({ seq, archivedBelow: seq, facts: {}, deliveries: {}, npcs: [], lastSeatPlaced: null, folded: {} });

const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const canonical = value => JSON.stringify(value, (_key, entry) => object(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
/** A delivery's receipt: everything but its place in the log (Trail's idempotence rule). */
const receipt = event => { const { id: _id, seq: _seq, ...body } = event; return body; };

export const isFact = (index, id, types) => Object.hasOwn(index.facts, id) && (!types || types.includes(index.facts[id][0]));
const permitted = (index, npcId, factId) => Object.hasOwn(index.facts, factId) && index.facts[factId][1].includes(npcId);

/** Whether an event may join the log: 'append', or 'same' for an exact repeat of a delivery. Throws
 * the errors Trail.append would. */
export function admit(index, event, { currentRevisions } = {}) {
  if (event.seq <= index.seq) throw new Error('Trail Life: sequence must increase');
  if (event.type === 'life.fact') {
    if (event.causes.some(cause => !Object.hasOwn(index.facts, cause))) throw new Error('Trail Life: fact requires prior valid causes');
    return 'append';
  }
  if (event.type !== 'life.delivered') throw new Error('Trail Life: the game writes facts and deliveries only');
  const previous = index.deliveries[event.deliveryId];
  if (previous) {
    if (previous.sig !== canonical(receipt(event))) throw new Error('Trail Life: conflicting delivery id');
    return 'same';
  }
  if (!object(currentRevisions) || Object.entries(event.revisions).some(([key, revision]) =>
    !Object.hasOwn(currentRevisions, key) || currentRevisions[key] !== revision)) throw new Error('Trail Life: delivery revision mismatch');
  if (event.sourceIds.some(source => !permitted(index, event.npcId, source))) throw new Error('Trail Life: delivery requires permitted facts');
  return 'append';
}

/** Record an admitted event, in place. */
export function record(index, event) {
  index.seq = event.seq;
  if (event.type === 'life.fact') {
    index.facts[event.id] = [event.factType, [...event.knownBy]];
    for (const npc of event.knownBy) if (!index.npcs.includes(npc)) index.npcs.push(npc);
    if (event.factType === 'seat.placed') index.lastSeatPlaced = event.id;
  } else {
    index.deliveries[event.deliveryId] = { npcId: event.npcId, semanticKey: event.semanticKey,
      sourceIds: [...event.sourceIds], sig: canonical(receipt(event)) };
  }
  return index;
}

/** The index of a whole log Trail has already validated (a restore reads the log once). */
export function indexLog(events, { seq = 0, archivedBelow = 0 } = {}) {
  const index = emptyIndex(archivedBelow);
  for (const event of events) record(index, event);
  index.seq = Math.max(index.seq, seq);
  return index;
}

const count = value => Number.isSafeInteger(value) && value >= 0;
const names = value => Array.isArray(value) && value.every(item => typeof item === 'string');
/** Whether a stored index is whole enough to trust without its log. */
export function validIndex(index) {
  if (!object(index) || !count(index.seq) || !count(index.archivedBelow ?? 0) || (index.archivedBelow ?? 0) > index.seq
    || !object(index.facts) || !object(index.deliveries) || !names(index.npcs) || new Set(index.npcs).size !== index.npcs.length
    || !(index.folded === undefined || object(index.folded) && Object.values(index.folded).every(count))) return false;
  for (const [id, entry] of Object.entries(index.facts)) {
    const n = Number(id.slice(5));
    if (!id.startsWith('life:') || !Number.isSafeInteger(n) || n <= (index.archivedBelow ?? 0) || n > index.seq
      || !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !names(entry[1])) return false;
  }
  return Object.values(index.deliveries).every(item => object(item) && typeof item.npcId === 'string'
    && typeof item.semanticKey === 'string' && names(item.sourceIds) && typeof item.sig === 'string')
    && (index.lastSeatPlaced === null || isFact(index, index.lastSeatPlaced, ['seat.placed']));
}

/** Fold the index to the facts the world can still point to (live), in place: the rest are counted
 * by type. A delivery stays while all its sources are live — Vellum's once rule reads only those —
 * and one per (resident, meaning, sources) is enough, keeping the current receipt so the same
 * acknowledgement stays an exact repeat (F9). */
export function foldIndex(index, live, { current = [] } = {}) {
  const fold = type => { index.folded[type] = (index.folded[type] || 0) + 1; };
  index.folded ||= {};
  for (const [id, [factType]] of Object.entries(index.facts)) if (!live.has(id)) { delete index.facts[id]; fold(factType); }
  const kept = new Map();
  for (const [deliveryId, item] of Object.entries(index.deliveries)) {
    const key = canonical([item.npcId, item.semanticKey, [...item.sourceIds].sort()]);
    const earlier = kept.get(key);
    if (!item.sourceIds.every(id => Object.hasOwn(index.facts, id))) { delete index.deliveries[deliveryId]; fold('life.delivered'); continue; }
    if (earlier === undefined) { kept.set(key, deliveryId); continue; }
    const drop = current.includes(earlier) && !current.includes(deliveryId) ? deliveryId : earlier;
    delete index.deliveries[drop]; fold('life.delivered');
    kept.set(key, drop === earlier ? deliveryId : earlier);
  }
  return index;
}

/** The part of a Trail summary Vellum reads, for one resident and the candidates' sources — the
 * same answers Trail.summarize gives for them, without building the whole summary. What that resident
 * was asked to forget (forgotten, a Set of fact ids — town/memory.mjs) is not in their knowledge. */
export function projection(index, { version, scope, npcId, sourceIds, forgotten = new Set() }) {
  const sources = [...new Set(sourceIds)];
  return { version, status: 'ready', scope, sequence: index.seq,
    facts: sources.filter(id => Object.hasOwn(index.facts, id)).map(id => ({ id })),
    knowledge: index.npcs.includes(npcId) ? { [npcId]: sources.filter(id => permitted(index, npcId, id) && !forgotten.has(id)) } : {},
    deliveries: Object.values(index.deliveries).filter(item => item.npcId === npcId)
      .map(item => ({ npcId: item.npcId, semanticKey: item.semanticKey, sourceIds: [...item.sourceIds] })),
    invalidated: [], learningEffectClaim: false };
}
