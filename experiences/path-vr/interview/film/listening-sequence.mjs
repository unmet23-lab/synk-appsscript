/** Existing performances only. Keep the interview's note history across answers;
 * preparation does not count as playback. No reverse/speed change or new motion. */
export const LISTENING_VARIANTS = Object.freeze([
  Object.freeze({ id: 'strict-listening', sourceClipId: 'strict-listening', durationSeconds: 10.08, note: true }),
  Object.freeze({ id: 'strict-listen-question-tail', sourceClipId: 'strict-question', durationSeconds: 6, note: true }),
  Object.freeze({ id: 'strict-listen-plan-tail', sourceClipId: 'strict-followup-plan', durationSeconds: 2.5, note: false }),
  Object.freeze({ id: 'strict-listen-experience-tail', sourceClipId: 'strict-followup-experience', durationSeconds: 2.25, note: false }),
]);
export const LISTENING_CLIP_IDS = Object.freeze(LISTENING_VARIANTS.map(({ id }) => id));
const itemOf = (id) => LISTENING_VARIANTS.find((item) => item.id === id);
const sourceOf = (id) => itemOf(id)?.sourceClipId || id || null;
const QUIET_BEFORE_NOTE_SECONDS = 4.5;

/** A normal answer gets at most one added writing performance, after a quiet
 * interval. The question's own note is not replayed during that first answer.
 * Leave room to finish a note before the answer timer runs out. Neutral clips
 * may recur: two existing short quiet performances cannot create infinite
 * original motion. Preserve the last writing choice across question turns. */
export function createListeningSequence({ availableClipIds = LISTENING_CLIP_IDS } = {}) {
  if (!Array.isArray(availableClipIds) || availableClipIds.some((id) => typeof id !== 'string')) throw new TypeError('사용 가능한 경청 영상 ID 배열이 필요합니다.');
  const available = LISTENING_VARIANTS.filter(({ id }) => availableClipIds.includes(id));
  let round = -1, roundSource = null, quietSeconds = 0, notePlayed = false, lastNoteId = null, lastPlaybackId = null, lastId = null, history = [];
  function resetSession() { round = -1; roundSource = null; quietSeconds = 0; notePlayed = false; lastNoteId = null; lastPlaybackId = null; lastId = null; history = []; }
  function reset(sourceClipId) {
    round++; roundSource = sourceOf(sourceClipId); quietSeconds = 0; notePlayed = false;
    // The initial speaking clip already contains the same writing action as
    // its silent derivative. Do not count it as newly available acting.
    if (roundSource === 'strict-question') lastNoteId = 'strict-listen-question-tail';
  }
  function observe(record) {
    if (!record || record.playbackId === lastPlaybackId) return;
    const item = itemOf(record.id);
    if (!item) return;
    lastPlaybackId = record.playbackId; lastId = item.id;
    history.push(item.id); if (history.length > 24) history.shift();
    if (item.note) { notePlayed = true; lastNoteId = item.id; quietSeconds = 0; }
    else quietSeconds += item.durationSeconds;
  }
  function next({ sourceClipId, remainingMs = Infinity, currentRemainingMs = 0 } = {}) {
    if (round < 0) reset(sourceClipId);
    if (!available.length) return null;
    const outgoingSource = sourceOf(sourceClipId || lastId);
    const afterCurrentSeconds = (Math.max(0, remainingMs) - Math.max(0, currentRemainingMs)) / 1000;
    const quiet = available.filter((item) => !item.note);
    const notes = available.filter((item) => item.note && item.sourceClipId !== outgoingSource && !(roundSource === 'strict-question' && item.sourceClipId === roundSource));
    if (!notePlayed && quietSeconds >= QUIET_BEFORE_NOTE_SECONDS) {
      const eligible = notes.filter((item) => afterCurrentSeconds >= item.durationSeconds + .15);
      const chosen = eligible.find((item) => item.id !== lastNoteId) || eligible[0];
      if (chosen) return chosen.id;
    }
    const preferredQuiet = round % 2 === 0 ? quiet : [...quiet].reverse();
    const neutral = preferredQuiet.find((item) => item.sourceClipId !== outgoingSource) || preferredQuiet[0];
    if (neutral) return neutral.id;
    // Old/reduced manifests must keep a real moving performance, never a fake
    // still or an absent file. Their one-clip repetition cannot be removed.
    return (notes.find((item) => item.id !== lastNoteId) || notes[0] || available.find((item) => item.id !== lastId) || available[0]).id;
  }
  function snapshot() { return Object.freeze({ round, roundSource, quietSeconds, notePlayed, lastNoteId, lastId, history: Object.freeze([...history]), availableClipIds: Object.freeze(available.map(({ id }) => id)) }); }
  return Object.freeze({ next, observe, reset, resetSession, snapshot });
}
