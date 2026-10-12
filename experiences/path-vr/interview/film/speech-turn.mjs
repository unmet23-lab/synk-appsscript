/** Local turn endpoint detection. Silence alone never counts as an answer.
 * The recognizer supplies text; microphone level only prevents cutting a pause.
 * All inputs and timing are ephemeral, with no recorder or network request. */
export function createSpeechTurn({ silenceMs = 5500, minimumTurnMs = 10000, levelThreshold = .045, now = () => performance.now() } = {}) {
  let active = false, startedAt = 0, lastActivityAt = 0, text = '', submitted = false;
  function reset() { active = false; startedAt = 0; lastActivityAt = 0; text = ''; submitted = false; }
  function start() { reset(); active = true; startedAt = lastActivityAt = now(); }
  function level(value) { if (active && Number.isFinite(value) && value >= levelThreshold) lastActivityAt = now(); }
  function transcript(value) {
    if (!active) return;
    const next = String(value || '').trim();
    if (next && next !== text) { text = next; lastActivityAt = now(); }
  }
  function poll() {
    const elapsed = now() - startedAt, quiet = now() - lastActivityAt;
    const hasAnswer = text.replace(/[\s.!?,]/gu, '').length >= 2;
    const ready = active && !submitted && hasAnswer && elapsed >= minimumTurnMs && quiet >= silenceMs;
    if (ready) submitted = true;
    return { submit: ready, hasAnswer, silenceRemainingMs: active && hasAnswer ? Math.max(0, silenceMs - quiet) : null };
  }
  return Object.freeze({ start, level, transcript, poll, reset });
}
