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

/** The lease (vertical slice §14-2·§14-3, W2 plan D1·D2): which window holds the town, and how
 * much effective play time (U) the account has had. A pulse reads and writes only this — never
 * the world. spans keep the context each stretch of U was played under (the owner after the pulse
 * that brought it, as the old pulse gave it); breaks keep the U where a 30-minute rest ended a
 * visit. Both drop what the world has already settled, and keep at most 16 entries. */
export const LEASE_ENTRIES = 16;
export const initialLease = ({ uMs = 0, presence = initialPresence(), lastForegroundAt = null } = {}) =>
  ({ presence, uMs, walkClock: null, spans: [], breaks: [], lastForegroundAt, boundaryAt: null });

const sameSpan = (a, b) => !!a && a.surfaceId === b.surfaceId && a.fence === b.fence && a.surface === b.surface && a.canRun === b.canRun;
/** Spans and breaks the world has not settled yet (the span the settled U falls in stays). */
export function pruneLease(lease, settledU) {
  const spans = lease.spans.filter((span, i) => span.u > settledU || !(lease.spans[i + 1]?.u <= settledU));
  return { ...lease, spans, breaks: lease.breaks.filter(u => u > settledU) };
}

export function pulseLease(previous, input, now, { away = false, settledU = 0 } = {}) {
  const pulse = updatePresence(previous.presence, { ...input, foreground: input.foreground === true && !away }, now);
  const before = previous.presence, base = pruneLease(previous, settledU);
  const next = { ...base, presence: pulse.next, uMs: previous.uMs + pulse.elapsedMs };
  const span = { u: previous.uMs, surfaceId: pulse.context.surfaceId, fence: pulse.context.fence,
    surface: pulse.context.surface, canRun: pulse.context.canRun };
  const last = next.spans.at(-1);
  if (last?.u === span.u) next.spans = [...next.spans.slice(0, -1), span];
  else if (!sameSpan(last, span)) next.spans = [...next.spans, span].slice(-LEASE_ENTRIES);
  // A visit that ended in a long rest ends at this U: the time this pulse brought comes first.
  if (pulse.visitEnded) next.breaks = [...next.breaks, next.uMs].slice(-LEASE_ENTRIES);
  if (input.foreground === true && !away) next.lastForegroundAt = pulse.next.at;
  // A walk is timed only while the same window keeps holding the town without a gap.
  const previousOwner = before.surfaces[before.owner];
  if (pulse.next.owner !== before.owner || pulse.next.fence !== before.fence || !pulse.context.canRun
    || previousOwner && pulse.next.at - previousOwner.at >= PRESENCE_LEASE_MS) next.walkClock = null;
  return { lease: next, receipt: pulse.receipt, context: pulse.context, elapsedMs: pulse.elapsedMs, visitEnded: pulse.visitEnded };
}

/** Whether the window asking may open a safe boundary now: it holds the town with the current
 * fence, and every other foreground window last said it was at a safe point. */
export function boundaryPresence(presence, payload, now) {
  const surface = presence.surfaces[payload?.surfaceId];
  if (!surface?.foreground || now - surface.at >= PRESENCE_LEASE_MS || payload.fence !== presence.fence
    || presence.owner !== payload.surfaceId) return null;
  const others = Object.entries(presence.surfaces).filter(([id, item]) => id !== payload.surfaceId && item.foreground);
  return { surfaceId: payload.surfaceId, fence: presence.fence, surface: surface.surface || 'classic',
    canContact: others.every(([, item]) => item.safe) };
}

export function commandPresence(presence, payload, now) {
  const surface = presence.surfaces[payload?.surfaceId];
  if (!surface?.foreground || now - surface.at >= PRESENCE_LEASE_MS || payload.fence !== presence.fence) return null;
  return { enabled: true, elapsedMs: 0, surfaceId: payload.surfaceId, fence: presence.fence,
    nowMs: now, surface: surface.surface || 'classic',
    canRun: true, canContact: false };
}
