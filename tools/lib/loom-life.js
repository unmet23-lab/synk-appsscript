/**
 * Loom presentation plans for an already selected, game-authorized life scene.
 * Coordinates belong to the host. Times are milliseconds of visible scene time;
 * use LoomMotion.stepClock for pause/hidden/resume handling. This module does not
 * choose NPC actions, validate paths, execute game facts, write delivery or learn.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoomLife = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'loom-life-1.0.0';
  const plans = new WeakSet();
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function name(value, field) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`LoomLife: ${field} is required`);
    return value;
  }
  function point(value, field) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
      throw new TypeError(`LoomLife: ${field} requires finite x/y`);
    }
    return Object.freeze({ x: value.x, y: value.y });
  }
  function requirePlan(plan) {
    if (!plans.has(plan)) throw new TypeError('LoomLife: use createPlan to prepare a plan');
  }

  /** Build an immutable sequential view plan. The game supplies validated paths
   * as separate steps; adjacent steps for one actor must meet at the same point.
   * revision identifies the target layout, not an incrementing render/log count.
   */
  function createPlan(input) {
    if (!input || !Array.isArray(input.steps) || !input.steps.length) {
      throw new TypeError('LoomLife: a nonempty steps array is required');
    }
    const revision = input.revision;
    if (!(typeof revision === 'string' && revision.trim())
      && !(Number.isSafeInteger(revision) && revision >= 0)) {
      throw new TypeError('LoomLife: revision must be a nonempty string or nonnegative integer');
    }
    const initialActors = Object.create(null), finalPose = Object.create(null);
    const endpoints = Object.create(null), ids = new Set();
    let time = 0;
    const steps = input.steps.map((source) => {
      if (!source) throw new TypeError('LoomLife: each step must be an object');
      const id = name(source.id, 'step.id'), actor = name(source.actor, 'step.actor');
      if (ids.has(id)) throw new TypeError(`LoomLife: duplicate step ${id}`);
      ids.add(id);
      const from = point(source.from, 'step.from'), to = point(source.to, 'step.to');
      const durationMs = source.durationMs;
      if (!Number.isFinite(durationMs) || durationMs < 0) {
        throw new RangeError('LoomLife: durationMs must be finite and nonnegative');
      }
      const pose = name(source.pose, 'step.pose');
      const endPose = source.endPose === undefined ? pose : name(source.endPose, 'step.endPose');
      const easing = source.easing === undefined ? 'smooth' : source.easing;
      if (!['smooth', 'linear'].includes(easing)) throw new TypeError('LoomLife: unknown easing');
      if (own(endpoints, actor) && (endpoints[actor].x !== from.x || endpoints[actor].y !== from.y)) {
        throw new RangeError(`LoomLife: disconnected path for ${actor}`);
      }
      const initialPose = own(initialActors, actor) ? undefined
        : source.initialPose === undefined ? 'idle' : name(source.initialPose, 'step.initialPose');
      if (initialPose !== undefined) initialActors[actor] = Object.freeze({ ...from, pose: initialPose });
      endpoints[actor] = to;
      finalPose[actor] = Object.freeze({ ...to, pose: endPose });
      const startMs = time;
      time += durationMs;
      if (!Number.isFinite(time)) throw new RangeError('LoomLife: total duration overflow');
      // The browser prepares the JSON plan again; keep first-appearance state
      // on its step so hidden props do not reappear as idle before their turn.
      return Object.freeze({ id, actor, from, to, durationMs, startMs, endMs: time, pose, endPose, easing,
        ...(initialPose !== undefined ? { initialPose } : {}) });
    });
    const plan = Object.freeze({ version: VERSION, id: name(input.id, 'id'), revision,
      steps: Object.freeze(steps), initialActors: Object.freeze(initialActors),
      finalPose: Object.freeze(finalPose), totalMs: time });
    plans.add(plan);
    return plan;
  }

  function invalidReason(plan, context) {
    if (context.cancelled) return 'cancelled';
    if (context.currentRevision !== plan.revision) return 'stale-revision';
    if (context.currentPlanId !== undefined && context.currentPlanId !== plan.id) return 'replaced-plan';
    return null;
  }
  function ids(values) {
    return new Set(Array.isArray(values) ? values : []);
  }

  /** A sample is a view only. visualStepIds/visualComplete NEVER certify actions.
   * Reduced motion shows the endpoint of the contiguous game-confirmed prefix;
   * it cannot display a future sitting/serving pose just by skipping animation.
   */
  function sample(plan, elapsedMs, context = {}) {
    requirePlan(plan);
    const reason = invalidReason(plan, context);
    if (reason) return { status: 'cancelled', reason, presentation: 'none', actors: {},
      activeStepId: null, visualStepIds: [], visualComplete: false };
    const actors = Object.create(null);
    for (const [actor, value] of Object.entries(plan.initialActors)) actors[actor] = { ...value };
    const visualStepIds = [], committed = ids(context.committedStepIds);
    const time = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(elapsedMs, plan.totalMs)) : 0;
    let activeStepId = null;
    for (const step of plan.steps) {
      const finished = context.reducedMotion ? committed.has(step.id) : time >= step.endMs;
      if (finished) {
        actors[step.actor] = { ...step.to, pose: step.endPose };
        visualStepIds.push(step.id);
        continue;
      }
      activeStepId = step.id;
      if (!context.reducedMotion) {
        const raw = step.durationMs ? Math.max(0, Math.min(1, (time - step.startMs) / step.durationMs)) : 1;
        const progress = step.easing === 'linear' ? raw : raw * raw * (3 - 2 * raw);
        actors[step.actor] = { x: step.from.x + (step.to.x - step.from.x) * progress,
          y: step.from.y + (step.to.y - step.from.y) * progress, pose: step.pose };
      }
      break;
    }
    return { status: 'ready', reason: null, presentation: context.reducedMotion ? 'static' : 'motion',
      actors, activeStepId, visualStepIds, visualComplete: visualStepIds.length === plan.steps.length };
  }

  /** Preflight only, not a render acknowledgement. The host must attest which
   * essential steps it actually applied in a visible, asset-ready frame, and the
   * game must separately attest their committed facts. The game/server owns the
   * authenticated delivery ID, ordering, current permissions and once-only ack.
   */
  function canAcknowledge(plan, context = {}) {
    requirePlan(plan);
    if (invalidReason(plan, context) || context.paused || context.hidden
      || context.visible !== true || context.assetsReady !== true) return false;
    const committed = ids(context.committedStepIds), applied = ids(context.appliedStepIds);
    return plan.steps.every(step => committed.has(step.id) && applied.has(step.id));
  }

  return Object.freeze({ VERSION, createPlan, sample, canAcknowledge });
});
