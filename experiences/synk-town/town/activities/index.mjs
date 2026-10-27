/** The life activities the town takes in one slot each (vertical slice design §20-7 ②): one module per activity,
 * the tea order first (W8), gathering next (W8b). The runtime (core.mjs) keeps each one's world slot
 * (state.activities[id]), sends it the commands it names, asks it whom it holds, what it finished with the player and
 * what ends with a visit, and writes the events it returns — so an activity never repeats scope, holds, events or
 * the card take. */
import teaOrder from './tea-order.mjs';

export const ACTIVITIES = Object.freeze([teaOrder]);
export const ACTIVITY_BY_ID = Object.freeze(Object.fromEntries(ACTIVITIES.map(a => [a.id, a])));
const BY_COMMAND = new Map(ACTIVITIES.flatMap(a => Object.keys(a.commands).map(type => [type, a])));
/** The activity a command belongs to, or null. */
export const activityOfCommand = type => BY_COMMAND.get(type) ?? null;
/** Every activity command with its scope (town/scope.mjs reads it, so a new command cannot be left out). */
export const ACTIVITY_COMMANDS = Object.freeze(Object.fromEntries(ACTIVITIES.flatMap(a => Object.entries(a.commands))));

export const initialActivities = () => Object.fromEntries(ACTIVITIES.map(a => [a.id, a.initial()]));
/** An old world (or one that never met an activity) reads each slot at its start value — added fields, no migration. */
export const restoreActivities = raw => Object.fromEntries(ACTIVITIES.map(a => [a.id, a.restore(raw?.[a.id])]));
export const validActivities = slots => !!slots && typeof slots === 'object'
  && Object.keys(slots).every(id => Object.hasOwn(ACTIVITY_BY_ID, id)) && ACTIVITIES.every(a => a.valid(slots[a.id]));
