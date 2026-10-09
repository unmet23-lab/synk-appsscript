import {validateTownMembership} from './town-sharing.mjs';

// Only opening the actual account-scoped Town frame creates this client-reported
// visit. Server-accepted life commands are recorded by the classroom service.
export function createClassroomTownHost({client, classId, learnerId, guard, makeId = () => crypto.randomUUID()}) {
  const eventId = makeId(); let visited = false, pending = null;
  async function visit() {
    if (visited) return;
    if (pending) return pending;
    pending = (async () => {
      guard();
      const membership = validateTownMembership(await client.townMembership(), {classId, learnerId}); guard();
      if (!membership.townSharing.enabled || membership.townSharing.blockedByLearningSharing) return;
      await client.townActivity({eventId, revision:membership.townSharing.revision,
        townId:membership.town.id, kind:'visit', activity:'town-opened'});
      guard(); visited = true;
    })();
    try {await pending;} finally {pending = null;}
  }
  return Object.freeze({
    async read() {
      guard(); const result = await client.townRead(); guard();
      try {await visit();} catch (error) {
        guard();
        // An optional summary outage must not destroy a successfully loaded
        // personal Town. Authorization failures still invalidate this host.
        if (['FORBIDDEN','AUTH_REQUIRED','SESSION_REVOKED','ACCOUNT_CHANGED','LEARNING_DISABLED','INVALID_RESPONSE'].includes(error.code)) throw error;
      }
      guard(); return result;
    },
    async command(payload) {guard(); const result = await client.townCommand(payload); guard(); return result;},
  });
}
