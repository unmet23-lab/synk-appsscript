/** The Trail index a world keeps (vertical slice §14-2·§14-3, W2 plan D7). Appending a fact or a
 * delivery is checked against it in constant time and reaction choice reads it, so no request
 * re-reads the life log. It follows atlas/trail-life.js for the two kinds the game writes — facts
 * and deliveries. The game writes no corrections or relayed knowledge, so the residents who know a
 * fact are its knownBy; the index refuses the other two kinds (F6). The sequence goes on across a
 * reset, so an event id is never reused (F7). Plain module, no imports: the caller validates each
 * event with Trail first.
 * Shape: { seq, facts: { id: [factType, knownBy] }, deliveries: { deliveryId: { npcId, semanticKey,
 *   sourceIds, sig } }, npcs: [every resident a fact ever named], lastSeatPlaced }
 */
export const emptyIndex = (seq = 0) => ({ seq, facts: {}, deliveries: {}, npcs: [], lastSeatPlaced: null });

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
export function indexLog(events, { seq = 0 } = {}) {
  const index = emptyIndex();
  for (const event of events) record(index, event);
  index.seq = Math.max(index.seq, seq);
  return index;
}

/** The part of a Trail summary Vellum reads, for one resident and the candidates' sources — the
 * same answers Trail.summarize gives for them, without building the whole summary. */
export function projection(index, { version, scope, npcId, sourceIds }) {
  const sources = [...new Set(sourceIds)];
  return { version, status: 'ready', scope, sequence: index.seq,
    facts: sources.filter(id => Object.hasOwn(index.facts, id)).map(id => ({ id })),
    knowledge: index.npcs.includes(npcId) ? { [npcId]: sources.filter(id => permitted(index, npcId, id)) } : {},
    deliveries: Object.values(index.deliveries).filter(item => item.npcId === npcId)
      .map(item => ({ npcId: item.npcId, semanticKey: item.semanticKey, sourceIds: [...item.sourceIds] })),
    invalidated: [], learningEffectClaim: false };
}
