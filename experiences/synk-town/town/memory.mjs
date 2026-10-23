/** "Please forget this" (vertical slice design §20-5): the player can take a thing done together out of
 * one resident's memory. Forgetting is "not used", never deleting (구현:789·:790): the event stays in
 * the branch and world results such as things stay, but the resident no longer knows it — reaction
 * choice reads that resident's knowledge without it (the index projection), on every device and in any
 * later settlement, because the world keeps the list. What can be forgotten is what the notebook's
 * 「주민이 아는 나」 lists: the things done together — the FT10/FT51 goals and the living modules'
 * results — never a fact the current scene runs on (a served tea, a placed seat), so a scene never
 * waits for a reaction nobody may give. Shape: [{ npc, target }]. Plain module, no imports.
 */
export const MEMORY_FACT = /^(?:FT10\.(?:inside|outside)\.completed|FT51\.completed|cafe\.C1\.[a-z]+\.executed|day\.[a-z]+\.[a-z]+\.executed|bazaar\.[A-Za-z]+\.[a-z]+\.completed)$/;
export const memoryFact = factType => typeof factType === 'string' && MEMORY_FACT.test(factType);

const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
const knows = (index, npc, target) => Object.hasOwn(index.facts, target) && index.facts[target][1].includes(npc);

export const isForgotten = (forgotten, npc, target) => forgotten.some(item => item.npc === npc && item.target === target);
/** The targets one resident has forgotten — what the projection leaves out of that resident's knowledge. */
export const forgottenBy = (forgotten, npc) => new Set(forgotten.filter(item => item.npc === npc).map(item => item.target));

/** Whether a resident can be asked to forget this: a thing done together that the resident knows. */
export function forgettable(index, npc, target) {
  return id(npc) && id(target) && knows(index, npc, target) && memoryFact(index.facts[target][0]);
}
/** Forget once; asking again for the same thing changes nothing. */
export function forget(forgotten, { npc, target }) {
  if (isForgotten(forgotten, npc, target)) return { forgotten, added: false };
  return { forgotten: [...forgotten, { npc, target }], added: true };
}
/** What a resident knows of the things done together, without what was forgotten (newest last). */
export function memoriesOf(index, forgotten, npc) {
  const gone = forgottenBy(forgotten, npc);
  return Object.entries(index.facts).filter(([target, [type, knownBy]]) => knownBy.includes(npc) && memoryFact(type) && !gone.has(target))
    .map(([target, [type]]) => ({ id: target, type }));
}
/** A forgotten fact the index has folded away can never be read again (ids are never reused): its entry goes. */
export const pruneForgotten = (forgotten, index) => forgotten.filter(item => Object.hasOwn(index.facts, item.target));
export function validForgotten(forgotten) {
  const pairs = new Set();
  return Array.isArray(forgotten) && forgotten.every(item => {
    const key = `${item?.npc}|${item?.target}`;
    if (!id(item?.npc) || !id(item.target) || Object.keys(item).length !== 2 || pairs.has(key)) return false;
    pairs.add(key); return true;
  });
}
