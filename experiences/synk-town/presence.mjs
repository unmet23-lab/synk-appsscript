// A local synthetic account has one clock, regardless of the number of tabs.
// Leases are process-local: a restart never replays time spent offline.
export const PRESENCE_LEASE_MS = 3000;
export const VISIT_IDLE_MS = 30 * 60 * 1000;
export const initialPresence = () => ({ at: null, surfaces: {}, owner: null, fence: 0,
  lastActiveAt: null, idleClosed: false });
/** When the visit in progress began (W6), or null: a presence from before W6 has no such field. */
export const visitStartOf = presence => (Number.isSafeInteger(presence?.visitStartAt) ? presence.visitStartAt : null);

/** The wall time the current visit ends at if nothing comes back (W3, review P1-1): 30 minutes after
 * the last stretch of play the presence covers — a foreground window counts to its lease's end. The
 * pulse that notices the end and every settlement use this one definition, so a visit ends at the
 * same time however late either looks. null once the visit already ended (idleClosed) or never began. */
export function visitEndAt(presence) {
  if (!presence || presence.idleClosed) return null;
  const active = Object.values(presence.surfaces || {}).filter(item => item.foreground);
  const last = active.length ? Math.max(...active.map(item => item.at + PRESENCE_LEASE_MS)) : presence.lastActiveAt;
  return last === null || last === undefined ? null : last + VISIT_IDLE_MS;
}

export function updatePresence(previous, input, now) {
  if (!input || typeof input.surfaceId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.surfaceId)
    || ['__proto__', 'constructor', 'prototype'].includes(input.surfaceId)
    || typeof input.foreground !== 'boolean' || typeof input.safe !== 'boolean'
    || input.surface !== undefined && !['classic', 'day'].includes(input.surface)) throw new TypeError('invalid-presence');
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('invalid-host-clock');
  const next = structuredClone(previous);
  now = Math.max(now, next.at ?? now);
  const endAt = visitEndAt(previous);
  const active = Object.values(next.surfaces).filter(item => item.foreground);
  const coveredUntil = active.length ? Math.max(...active.map(item => item.at + PRESENCE_LEASE_MS)) : next.at;
  const elapsedMs = next.at === null ? 0 : Math.max(0, Math.min(now, coveredUntil ?? now) - next.at);
  if (elapsedMs) next.lastActiveAt = Math.min(now, coveredUntil);
  // The same wall time a settlement reads (visitEndAt): a pulse only notices it.
  const visitEnded = endAt !== null && now >= endAt;
  if (visitEnded) next.idleClosed = true;
  for (const [id, item] of Object.entries(next.surfaces)) if (now - item.at >= PRESENCE_LEASE_MS) delete next.surfaces[id];
  if (!Object.hasOwn(next.surfaces, input.surfaceId) && Object.keys(next.surfaces).length >= 16) throw new TypeError('too-many-surfaces');
  next.surfaces[input.surfaceId] = { at: now, foreground: input.foreground, safe: input.safe, surface: input.surface || 'classic' };
  const foreground = Object.keys(next.surfaces).filter(id => next.surfaces[id].foreground);
  const owner = foreground.includes(next.owner) ? next.owner : foreground[0] || null;
  if (owner !== next.owner) { next.owner = owner; next.fence++; }
  // A foreground window that opens a new visit (the last one ended, or none began) marks when it began (W6): only a
  // pulse sees that moment, so the visit's band never turns on when the world is next settled or read (§15-3).
  if (foreground.length && (visitEnded || previous.idleClosed || previous.lastActiveAt === null || previous.lastActiveAt === undefined)) next.visitStartAt = now;
  if (foreground.length) { next.lastActiveAt = now; next.idleClosed = false; }
  next.at = now;
  return { next, elapsedMs, visitEnded, endedAt: visitEnded ? endAt : null, context: {
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
 * visit. A pulse never drops what the world has not settled: once a lease holds more than 16
 * spans or breaks (leaseFull), the store settles before it keeps the lease. */
export const LEASE_ENTRIES = 16;
export const initialLease = ({ uMs = 0, presence = initialPresence(), lastForegroundAt = null } = {}) =>
  ({ presence, uMs, walkClock: null, spans: [], breaks: [], breakAts: {}, lastForegroundAt, boundaryAt: null });

const sameSpan = (a, b) => !!a && a.surfaceId === b.surfaceId && a.fence === b.fence && a.surface === b.surface && a.canRun === b.canRun;
const settledSpans = (lease, settledU) => lease.spans.filter((span, i) => span.u > settledU || !(lease.spans[i + 1]?.u <= settledU));
/** Spans and breaks the world has not settled yet (the span the settled U falls in stays). A break
 * at exactly the settled U is still to come: a rest that brought no play time ends the visit at the
 * U the world already stands on, and the next settlement ends it there. */
export function pruneLease(lease, settledU) {
  return { ...lease, spans: settledSpans(lease, settledU), breaks: lease.breaks.filter(u => u >= settledU), breakAts: breakAtsWhere(lease, u => u >= settledU),
    ...(lease.startAts ? { startAts: startAtsWhere(lease, u => u >= settledU) } : {}) };
}
/** startAts keeps, by the U a visit's play begins at, the wall time a pulse saw it begin (W6, GPT A1) — so visits settled
 * together each open with their own start. Those the world has walked past go once settled. */
const startAtsWhere = (lease, keep) => Object.fromEntries(Object.entries(lease.startAts || {}).filter(([u]) => keep(Number(u))));
/** The wall time the visit a step at u belongs to began, from the lease (null: no start recorded at or before u). */
export function visitStartFor(lease, u) {
  let found = null, at = -1;
  for (const [key, ms] of Object.entries(lease?.startAts || {})) if (Number(key) <= u && Number(key) > at) { at = Number(key); found = ms; }
  return found;
}
/** breakAts keeps, by the break's U, the wall time that visit ended at (W3) — beside breaks, never in it. */
const breakAtsWhere = (lease, keep) => Object.fromEntries(Object.entries(lease.breakAts || {}).filter(([u]) => keep(Number(u))));
/** The lease after the world settled to settledU and that settlement was saved: every break up to it
 * has ended its visit, so none is applied twice (a command at that U may open the next visit). */
export function settledLease(lease, settledU) {
  return { ...lease, spans: settledSpans(lease, settledU), breaks: lease.breaks.filter(u => u > settledU), breakAts: breakAtsWhere(lease, u => u > settledU),
    ...(lease.startAts ? { startAts: startAtsWhere(lease, u => u >= settledU) } : {}) };
}
/** More spans or breaks than a lease keeps: the store settles now instead of dropping unsettled play. */
export const leaseFull = lease => lease.spans.length > LEASE_ENTRIES || lease.breaks.length > LEASE_ENTRIES
  || Object.keys(lease.startAts || {}).length > LEASE_ENTRIES;

export function pulseLease(previous, input, now, { away = false, settledU = 0 } = {}) {
  const pulse = updatePresence(previous.presence, { ...input, foreground: input.foreground === true && !away }, now);
  const before = previous.presence, base = pruneLease(previous, settledU);
  const next = { ...base, presence: pulse.next, uMs: previous.uMs + pulse.elapsedMs };
  const span = { u: previous.uMs, surfaceId: pulse.context.surfaceId, fence: pulse.context.fence,
    surface: pulse.context.surface, canRun: pulse.context.canRun };
  const last = next.spans.at(-1);
  if (last?.u === span.u) next.spans = [...next.spans.slice(0, -1), span];
  else if (!sameSpan(last, span)) next.spans = [...next.spans, span];
  // A visit that ended in a long rest ends at this U: the time this pulse brought comes first.
  // Two visit ends at one U (no play between them) keep the first one's wall time: the holds the first visit
  // opened end there, as they would had the world settled right after it.
  if (pulse.visitEnded && !next.breaks.includes(next.uMs)) { next.breaks = [...next.breaks, next.uMs]; next.breakAts = { ...next.breakAts, [next.uMs]: pulse.endedAt }; }
  // A pulse that opened a visit marks where its play begins (W6, GPT A1): the U after this pulse, beside the break it may have made.
  if (Number.isSafeInteger(pulse.next.visitStartAt) && pulse.next.visitStartAt !== before.visitStartAt) next.startAts = { ...(base.startAts || {}), [next.uMs]: pulse.next.visitStartAt };
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
