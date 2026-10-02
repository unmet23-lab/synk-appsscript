/**
 * Loom motion primitives, independent of the DOM, renderer and frame scheduler.
 * Times are seconds, timestamps are milliseconds, velocities are units/second.
 * Unlike the authored garden in loom-scene.mjs, these helpers have no scene pose,
 * wind, character, asset or playback policy. Callers own targets and animation.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoomMotion = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const elapsed = dt => Number.isFinite(dt) && dt > 0 ? dt : 0;
  function finite(value, name) {
    if (!Number.isFinite(value)) throw new TypeError(`LoomMotion: ${name} must be finite`);
    return value;
  }
  function response(value) {
    finite(value, 'responseSeconds');
    if (value < 0) throw new RangeError('LoomMotion: responseSeconds must be nonnegative');
    return value;
  }
  function motionState(state) {
    if (!state || typeof state !== 'object') throw new TypeError('LoomMotion: a motion state is required');
    finite(state.value, 'value');
    finite(state.velocity, 'velocity');
  }

  /** Exact exponential approach. After responseSeconds, 1/e of the gap remains.
   * A zero response snaps on a positive step; a zero/invalid dt never advances.
   */
  function damp(value, target, responseSeconds, dtSeconds) {
    finite(value, 'value');
    finite(target, 'target');
    response(responseSeconds);
    const dt = elapsed(dtSeconds);
    if (!dt) return value;
    if (!responseSeconds) return target;
    return value + (target - value) * -Math.expm1(-dt / responseSeconds);
  }

  /** Analytic critically damped spring with angular frequency 2/responseSeconds.
   * A stationary start covers about 59% of the gap in one response interval.
   * Mutates and returns state. Exact for a target held constant over this step.
   */
  function advanceSpring(state, target, responseSeconds, dtSeconds) {
    motionState(state);
    finite(target, 'target');
    response(responseSeconds);
    const dt = elapsed(dtSeconds);
    if (!dt) return state;
    const omega = 2 / responseSeconds;
    const decay = Math.exp(-omega * dt);
    if (!responseSeconds || !decay) {
      state.value = target;
      state.velocity = 0;
      return state;
    }
    const offset = state.value - target;
    const term = (state.velocity + omega * offset) * dt;
    state.value = target + (offset + term) * decay;
    state.velocity = (state.velocity - omega * term) * decay;
    return state;
  }

  /** Exact integration of v' = -frictionPerSecond * v, with optional hard bounds.
   * Zero friction is constant velocity. A boundary cancels only outward speed.
   * Mutates and returns state; no movement or boundary changes at a zero dt.
   */
  function coast(state, frictionPerSecond, dtSeconds, min = -Infinity, max = Infinity) {
    motionState(state);
    finite(frictionPerSecond, 'frictionPerSecond');
    if (frictionPerSecond < 0) throw new RangeError('LoomMotion: friction must be nonnegative');
    if (typeof min !== 'number' || typeof max !== 'number' || Number.isNaN(min) || Number.isNaN(max)
      || min > max || min === Infinity || max === -Infinity) {
      throw new RangeError('LoomMotion: invalid coast bounds');
    }
    const dt = elapsed(dtSeconds);
    if (!dt) return state;
    state.value = Math.max(min, Math.min(max, state.value));
    if ((state.value <= min && state.velocity < 0) || (state.value >= max && state.velocity > 0)) state.velocity = 0;
    const decay = Math.exp(-frictionPerSecond * dt);
    const distance = frictionPerSecond ? -Math.expm1(-frictionPerSecond * dt) / frictionPerSecond : dt;
    state.value += state.velocity * distance;
    state.velocity *= decay;
    state.value = Math.max(min, Math.min(max, state.value));
    if ((state.value <= min && state.velocity < 0) || (state.value >= max && state.velocity > 0)) state.velocity = 0;
    return state;
  }

  function createClock() {
    return { lastTimestamp: null, time: 0, suspended: false };
  }

  /** Drop the timestamp baseline while retaining accumulated visual time.
   * Call when a caller stops requesting frames without reporting a frozen frame.
   */
  function resetClock(clock) {
    clock.lastTimestamp = null;
    clock.suspended = false;
    return clock;
  }

  /**
   * rawDt retains the real nonnegative interval for diagnostics, including gaps.
   * dt is visual time: at most 0.1s; zero while paused/hidden and on first/resume
   * frames. firstFrame identifies a fresh baseline (also after an invalid or
   * backwards timestamp), not an instruction to restart the rendered scene.
   * Explicitly report hidden/paused, or resetClock on returning from a stopped
   * frame loop. A long active frame alone is bounded, not inferred to be hidden.
   */
  function stepClock(clock, timestampMs, { paused = false, hidden = false } = {}) {
    const frozen = !!(paused || hidden);
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
      clock.lastTimestamp = null;
      clock.suspended = frozen;
      return { rawDt: 0, dt: 0, time: clock.time, firstFrame: true };
    }
    const previous = clock.lastTimestamp;
    const firstFrame = previous === null || clock.suspended || timestampMs < previous;
    const rawDt = previous === null ? 0 : Math.max(0, (timestampMs - previous) / 1000);
    clock.lastTimestamp = timestampMs;
    clock.suspended = frozen;
    const dt = frozen || firstFrame ? 0 : Math.min(rawDt, 0.1);
    clock.time += dt;
    return { rawDt, dt, time: clock.time, firstFrame };
  }

  return Object.freeze({ damp, advanceSpring, coast, createClock, resetClock, stepClock });
});
