// What the day screen may acknowledge, counted only in frames the renderer vouches it painted: the cafe
// reaction plan's ACK, a result's DAY_OBSERVED · BAZAAR_OBSERVED · LIFE_ACK and a life contact's LIFE_ACK.
// It sends nothing — each check returns at most one effect, day-app signs and sends it, and settle() says
// whether the host took it (a refused one may be asked again).
export const PLAN_ACK_MS = 2400, PLAN_HOLD_MS = 1200, RESULT_SEEN_MS = 1200, CONTACT_SEEN_MS = 300, FRAME_LIMIT_MS = 100;

/** Visible time toward one acknowledgement per id: only good frames count, each at most FRAME_LIMIT_MS. */
function dwell(needMs) {
  let id = null, ms = 0, last = null, asking = false;
  return {
    get id() { return id; },
    frame(next, good, now) {
      if (next !== id) { id = next || null; ms = 0; last = null; asking = false; }
      if (good && last !== null) ms += Math.min(FRAME_LIMIT_MS, Math.max(0, now - last)); last = good ? now : null;
      if (!good || ms < needMs || asking) return false;
      asking = true; return true;
    },
    release() { asking = false; },
  };
}

export function createDayObservation({ loom }) {
  let plan = null, sample = null, planMs = 0, planLast = null, completeAt = null, wasComplete = false, acking = false, applied = new Set(), shown = null;
  const result = dwell(RESULT_SEEN_MS), contact = dwell(CONTACT_SEEN_MS);
  function resetPlan() { plan = null; sample = null; planMs = 0; planLast = null; completeAt = null; wasComplete = false; acking = false; applied = new Set(); shown = null; }
  return {
    /** The reaction plan being shown and its sample at the plan's visible time (both null without a plan). */
    get plan() { return plan; }, get sample() { return sample; },
    resetPlan,
    /** The plan the host sent for the cafe (null elsewhere): a new id or revision starts its visible time over. */
    configurePlan(raw) {
      if (!raw) { if (plan) resetPlan(); return; }
      if (plan?.id === raw.id && plan.revision === raw.revision) return;
      resetPlan(); plan = loom().createPlan(raw);
    },
    /** One frame of the plan. painted(serial) is the renderer's evidence that the scene drawn with that serial
     * reached the screen — only then do the steps it showed count as applied. Visible time moves only while the
     * frame is good. draw() renders the new sample and returns the serial it asked for. */
    planFrame({ now, good, passiveReady, ctx, requested, painted }, draw) {
      const actualPaint = painted(shown?.serial ?? requested);
      if (good && shown && actualPaint) {
        for (const id of shown.ids) applied.add(id);
        if (shown.complete && completeAt === null) completeAt = planMs;
      }
      if (good && planLast != null) planMs += Math.min(FRAME_LIMIT_MS, Math.max(0, now - planLast)); planLast = good ? now : null;
      sample = loom().sample(plan, planMs, ctx);
      const serial = draw();
      shown = good && sample.status === 'ready' ? { serial, ids: sample.visualStepIds, complete: sample.visualComplete } : null;
      // Complete in two frames in a row: then one ACK, until the host refuses it.
      const complete = passiveReady && good && planMs >= PLAN_ACK_MS && completeAt !== null && planMs - completeAt >= PLAN_HOLD_MS
        && loom().canAcknowledge(plan, { ...ctx, visible: true, hidden: false, paused: false, assetsReady: true, appliedStepIds: [...applied] });
      const ask = complete && wasComplete && !acking;
      wasComplete = complete;
      if (!ask) return null;
      acking = true;
      return Object.freeze({ kind: 'plan', appliedStepIds: [...applied] });
    },
    /** One frame of the result on show (target: { id, type } or null). */
    resultFrame({ now, target, good }) {
      return result.frame(target?.id, good, now) ? Object.freeze({ kind: 'result', type: target.type, resultId: target.id }) : null;
    },
    /** One frame of the life contact issued to this window (id or undefined). */
    contactFrame({ now, id, good }) {
      return contact.frame(id, good, now) ? Object.freeze({ kind: 'contact', contactId: contact.id }) : null;
    },
    settle(effect, ok) {
      if (ok) return;
      if (effect.kind === 'plan') acking = false;
      else (effect.kind === 'result' ? result : contact).release();
    },
  };
}
