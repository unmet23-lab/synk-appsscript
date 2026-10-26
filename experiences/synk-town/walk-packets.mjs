import { movePoint } from './walk.mjs';

// The walk this window predicts ahead of the host: the input the host has not receipted yet (pending, then
// the packet in flight) and the pose replayed over every correction. It sends nothing — day-app takes a
// packet, signs it with its lease and revision, and reports back how the host answered.
export const WALK_FRAME_MS = 50, WALK_WINDOW_MS = 240, WALK_PARTS = 32, WALK_SEND_MS = 150;

export function createWalkPackets() {
  let point = null, heading = 0, moving = false, inputActive = false, frameAt = null;
  let pending = [], inflight = null, sentAt = 0, backpressured = false, correction = 0, maxCorrection = 0;
  const origins = new WeakMap();
  const pendingMs = () => pending.reduce((n, s) => n + s.durationMs, 0);
  return {
    get point() { return point; }, get heading() { return heading; }, get moving() { return moving; }, get inputActive() { return inputActive; },
    get pendingParts() { return pending.length; }, get pendingMs() { return pendingMs(); }, get backpressured() { return backpressured; },
    get correction() { return correction; }, get maxCorrection() { return maxCorrection; },
    /** The packet the host has not answered yet, or null. */
    get inflight() { return inflight; },
    pose() { return { ...point, heading, moving }; },
    /** The host's walk arrived: replay the packet in flight and the pending input over it. */
    reconcile(walk) {
      const predicted = point;
      heading = Math.atan2(walk.headingX || 0, walk.headingZ ?? 1);
      point = { x: walk.x, z: walk.z };
      for (const segment of [...(inflight || []), ...pending]) {
        origins.set(segment, point);
        point = movePoint(point, segment, segment.durationMs / 1000);
        if (segment.durationMs > 0 && (segment.x || segment.z)) heading = Math.atan2(segment.x, segment.z);
      }
      correction = predicted ? Math.hypot(point.x - predicted.x, point.z - predicted.z) : 0;
      maxCorrection = Math.max(maxCorrection, correction);
      return point;
    },
    /** One display frame of input at time now. Returns whether the pending input should go to the host now.
     * warm is false between standing up from a seat and the zero step's receipt (W7b): the input is read, nothing steps. */
    step(now, input, warm = true) {
      // Keep sub-millisecond frame time: rounding each 60/120 Hz frame changes
      // walking speed and causes the host's time-limited receipt to pull us back.
      const dt = frameAt == null ? 0 : Math.min(WALK_FRAME_MS, Math.max(0, now - frameAt)); frameAt = now;
      inputActive = !!(input.x || input.z); moving = false;
      const queuedMs = pendingMs(), last = pending.at(-1);
      const sameDirection = last && last.x === input.x && last.z === input.z;
      // Preserve the authority's bounded prediction window and 32-part contract.
      // Use the remaining budget instead of discarding a whole final frame, and
      // merge identical input so high-refresh displays do not fragment packets.
      let stepMs = inputActive && warm ? Math.min(dt, Math.max(0, WALK_WINDOW_MS - queuedMs)) : 0;
      const next = stepMs > 0 ? movePoint(point, input, stepMs / 1000) : point;
      const origin = sameDirection && origins.get(last);
      const combined = origin && stepMs > 0 ? movePoint(origin, input, (last.durationMs + stepMs) / 1000) : null;
      // Collision substeps are not associative near a wall or curved planter.
      // Compact only when replay preserves the endpoint, so a receipt cannot
      // introduce a new correction simply because two inputs were merged.
      const canMerge = combined && Math.hypot(combined.x - next.x, combined.z - next.z) < .000000001;
      if (!canMerge && pending.length >= WALK_PARTS) stepMs = 0;
      backpressured = inputActive && stepMs + .0001 < dt;
      if (stepMs > 0) {
        heading = Math.atan2(input.x, input.z);
        const previous = point; point = next;
        moving = Math.hypot(point.x - previous.x, point.z - previous.z) > .0000001;
        if (canMerge) last.durationMs += stepMs;
        else {
          const segment = { x: input.x, z: input.z, durationMs: stepMs };
          origins.set(segment, previous); pending.push(segment);
        }
      }
      return pending.length > 0 && (now - sentAt >= WALK_SEND_MS || !inputActive || pending.length >= WALK_PARTS || queuedMs + stepMs >= WALK_WINDOW_MS);
    },
    /** No frame stepped (not walking, or no pose yet): the next frame starts from zero elapsed time. */
    idle() { frameAt = null; },
    /** Input stopped (hidden, blurred, signed out): unsent input is dropped; the packet in flight stays. */
    halt() { pending = []; moving = inputActive = backpressured = false; frameAt = null; },
    /** Standing up from a seat (W7b): one zero step starts the host's walk clock again before the first real step. */
    zeroStep() { pending.push({ x: 0, z: 0, durationMs: 0 }); },
    /** The pending input becomes the packet in flight. */
    take(now) { inflight = pending; pending = []; sentAt = now; return inflight; },
    /** The host answered the packet in flight; its walk comes with the answer. */
    settle() { inflight = null; },
    /** A refused send, or a fresh load: nothing unreceipted survives. */
    discard() { inflight = null; pending = []; },
  };
}
