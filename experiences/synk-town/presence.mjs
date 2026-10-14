// A local synthetic account has one clock, regardless of the number of tabs.
// Leases are process-local: a restart never replays time spent offline.
export const PRESENCE_LEASE_MS = 3000;
const VISIT_IDLE_MS = 30 * 60 * 1000;
export const initialPresence = () => ({ at: null, surfaces: {}, owner: null, fence: 0,
  lastActiveAt: null, idleClosed: false });

export function updatePresence(previous, input, now) {
  if (!input || typeof input.surfaceId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.surfaceId)
    || ['__proto__', 'constructor', 'prototype'].includes(input.surfaceId)
    || typeof input.foreground !== 'boolean' || typeof input.safe !== 'boolean'
    || input.surface !== undefined && !['classic', 'day'].includes(input.surface)) throw new TypeError('invalid-presence');
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('invalid-host-clock');
  const next = structuredClone(previous);
  now = Math.max(now, next.at ?? now);
  const active = Object.values(next.surfaces).filter(item => item.foreground);
  const coveredUntil = active.length ? Math.max(...active.map(item => item.at + PRESENCE_LEASE_MS)) : next.at;
  const elapsedMs = next.at === null ? 0 : Math.max(0, Math.min(now, coveredUntil ?? now) - next.at);
  if (elapsedMs) next.lastActiveAt = Math.min(now, coveredUntil);
  const visitEnded = next.lastActiveAt !== null && now - next.lastActiveAt >= VISIT_IDLE_MS && !next.idleClosed;
  if (visitEnded) next.idleClosed = true;
  for (const [id, item] of Object.entries(next.surfaces)) if (now - item.at >= PRESENCE_LEASE_MS) delete next.surfaces[id];
  if (!Object.hasOwn(next.surfaces, input.surfaceId) && Object.keys(next.surfaces).length >= 16) throw new TypeError('too-many-surfaces');
  next.surfaces[input.surfaceId] = { at: now, foreground: input.foreground, safe: input.safe, surface: input.surface || 'classic' };
  const foreground = Object.keys(next.surfaces).filter(id => next.surfaces[id].foreground);
  const owner = foreground.includes(next.owner) ? next.owner : foreground[0] || null;
  if (owner !== next.owner) { next.owner = owner; next.fence++; }
  if (foreground.length) { next.lastActiveAt = now; next.idleClosed = false; }
  next.at = now;
  return { next, elapsedMs, visitEnded, context: {
    enabled: true, elapsedMs, nowMs: now, visitEnded, surfaceId: next.owner, fence: next.fence,
    surface: next.surfaces[owner]?.surface || 'classic',
    canRun: foreground.length > 0,
    canContact: !!owner && foreground.every(id => next.surfaces[id].safe),
  }, receipt: { surfaceId: input.surfaceId, fence: next.fence, owner: owner === input.surfaceId } };
}

export function commandPresence(presence, payload, now) {
  const surface = presence.surfaces[payload?.surfaceId];
  if (!surface?.foreground || now - surface.at >= PRESENCE_LEASE_MS || payload.fence !== presence.fence) return null;
  return { enabled: true, elapsedMs: 0, surfaceId: payload.surfaceId, fence: presence.fence,
    nowMs: now, surface: surface.surface || 'classic',
    canRun: true, canContact: false };
}
