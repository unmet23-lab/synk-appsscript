/** Lazy settlement of the old living modules (vertical slice §14-3·§14-4, W2 plan D1·D2·D5).
 * A pulse only moves the lease's U; the world catches up here, on a boundary, a read or a command.
 * The unsettled stretch [settledU, lease.uMs) is walked from settledU in steps of at most a
 * second — each step is the chain one old pulse ran, under the context that stretch was played
 * in (the lease's spans) — so pulses a second or less apart leave the same world as before at
 * every command boundary. A 30-minute rest (a lease break) ends the visit once, after the steps
 * up to it — also a break at exactly the settled U (a rest that brought no play time); the store
 * drops the breaks a saved settlement has applied (presence.mjs settledLease), so none ends a visit
 * twice. settledU always moves to the lease's U, even when no module took the time (F2).
 * Contacts are issued only where canContact is given: in the last step, as the old safe pulse did.
 * Two differences are rules, not drift: the ≤3-second tail of a pulse that ended a visit now
 * reaches every module before the visit ends (the old life module dropped it), and a stretch
 * walked in one settlement may group two timers that old pulses split differently (§D1).
 * The step and the check come from the authority (core's stepLiving and assertState), so this
 * module imports nothing and travels with the rest of the runtime layer.
 */
export const STEP_MS = 1000;

/** The span a U was played under; before any pulse, nobody held the town. */
export function spanAt(lease, u) {
  let found = null;
  for (const span of lease.spans) { if (span.u <= u) found = span; else break; }
  return found || { u: 0, surfaceId: null, fence: lease.presence.fence, surface: 'classic', canRun: false };
}

/** The steps that walk a world from its settled U to the lease's U. touch runs one step even when
 * no time is unsettled, as every old pulse did (it lets wall-clock work such as a prepared job land). */
export function settleSteps(settledU, lease, { canContact = false, touch = false } = {}) {
  if (!Number.isSafeInteger(lease.uMs) || lease.uMs < settledU) throw new RangeError('the lease is behind the world');
  const steps = [];
  let u = settledU;
  const walkTo = target => {
    while (u < target) {
      const span = spanAt(lease, u), next = lease.spans.find(item => item.u > u)?.u ?? Infinity;
      const elapsedMs = Math.min(STEP_MS, target - u, next - u);
      steps.push({ u, elapsedMs, span });
      u += elapsedMs;
    }
  };
  for (const end of [...new Set(lease.breaks)].filter(b => b >= settledU && b <= lease.uMs).sort((a, b) => a - b)) {
    walkTo(end);
    steps.push({ u, elapsedMs: 0, span: spanAt(lease, u), visitEnded: true, endedAt: lease.breakAts?.[end] ?? null });
  }
  walkTo(lease.uMs);
  if ((canContact || touch) && !steps.length) steps.push({ u, elapsedMs: 0, span: spanAt(lease, u) });
  if (canContact && !steps.at(-1).visitEnded) steps.at(-1).canContact = true;
  return steps;
}

/** settle(world, lease, { step, check, close }) → { state, changed }. The state is checked once, after
 * the walk. close(state, nowMs), when given, runs after the steps on every settlement — the village's
 * bands follow the wall clock, not U, so they close even when no play time is unsettled (W3). */
export function settle(previous, lease, { step: stepWorld, check, close, nowMs, canContact = false, touch = false } = {}) {
  if (typeof stepWorld !== 'function' || typeof check !== 'function') throw new TypeError('settle needs the step and the check');
  const steps = settleSteps(previous.settledU ?? 0, lease, { canContact, touch });
  if (!steps.length && !close) return { state: previous, changed: false };
  const state = structuredClone(previous);
  for (const step of steps) {
    stepWorld(state, { enabled: true, elapsedMs: step.elapsedMs, nowMs, surfaceId: step.span.surfaceId,
      fence: step.span.fence, surface: step.span.surface, canRun: step.span.canRun,
      canContact: step.canContact === true, visitEnded: step.visitEnded === true, visitEndedAt: step.endedAt ?? null });
  }
  state.settledU = lease.uMs;
  if (close) close(state, nowMs);
  check(state);
  const changed = state.settledU !== previous.settledU || JSON.stringify(state) !== JSON.stringify(previous);
  return { state, changed };
}
