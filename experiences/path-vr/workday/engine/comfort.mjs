/** Comfort and turn-taking rules that must hold whatever the page does — kept pure so they are tested.
 * Design 4-8: one headset visit stays inside ten minutes, and a first visit is one scene only. */
export const QUEST_LIMIT_MINUTES = 10;

/** Asked before a scene starts. `insideMs` is the time already spent in the headset on this
 * visit; `sceneMinutes` is the scene table's own estimate. A scene that would cross the limit
 * is not opened in the headset at all — the only thing offered is taking it off. */
export function questScenePlan({ insideMs = 0, sceneMinutes = 0, firstVisit = false, scenesThisVisit = 0, limitMinutes = QUEST_LIMIT_MINUTES } = {}) {
  if (firstVisit && scenesThisVisit >= 1) return { open: false, reason: 'first-visit' };
  if (Math.max(0, insideMs) / 60000 + Math.max(0, sceneMinutes) > limitMinutes) return { open: false, reason: 'time' };
  return { open: true, reason: '' };
}

/** End of a spoken turn from loudness alone (no recognised text needed): speech has been heard
 * for at least `minSpeechMs`, then stayed quiet for `quietMs`. A hard cap ends a turn that never
 * goes quiet. Feed it one loudness sample per animation frame or timer tick. */
export function createSilenceGate({ threshold = 0.02, minSpeechMs = 400, quietMs = 1800, maxMs = 30000 } = {}) {
  let startedAt = null, speechMs = 0, lastLoudAt = null, lastAt = null;
  return {
    /** @returns {'waiting'|'speaking'|'done'} */
    push(level, now) {
      if (startedAt === null) startedAt = now;
      const step = lastAt === null ? 0 : Math.max(0, Math.min(250, now - lastAt));
      lastAt = now;
      if (level >= threshold) { speechMs += step; lastLoudAt = now; }
      if (now - startedAt >= maxMs) return 'done';
      if (speechMs < minSpeechMs || lastLoudAt === null) return 'waiting';
      return now - lastLoudAt >= quietMs ? 'done' : 'speaking';
    },
    heardSpeech: () => speechMs >= minSpeechMs,
    reset() { startedAt = null; speechMs = 0; lastLoudAt = null; lastAt = null; },
  };
}

/** A clip may stand in for the photograph in a headset only if its background holds still.
 * `outside` is the mean absolute difference (0~255) outside the place's live rectangle between
 * the still and the clip's first, last and in-between frames; `shift` is the largest whole-frame
 * offset in pixels at 1280 wide. The numbers come from the production check, not the browser. */
export function clipHoldsStill({ outside = Infinity, shift = Infinity } = {}, { maxOutside = 6, maxShift = 2 } = {}) {
  return Number.isFinite(outside) && Number.isFinite(shift) && outside <= maxOutside && shift <= maxShift;
}
