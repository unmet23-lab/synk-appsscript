import { classifyAnswer } from '../dialogue.mjs';
import { planAnswerFollowup } from './answer-followup.mjs';

export const CLIPS = Object.freeze({
  question: 'strict-question', listening: 'strict-listening',
  experience: 'strict-followup-experience', plan: 'strict-followup-plan',
});
export const QUESTIONS = Object.freeze({
  question: '요양보호사로 지원한 이유를 말씀해 주세요.',
  experience: '그 경험에서 직접 맡았던 일과 그 결과를 구체적으로 말씀해 주세요.',
  plan: '현장에 투입되기 전에 무엇을 어떻게 준비하실 겁니까.',
});
// The desk display must expose the whole transcript before confirmation, even
// for a long answer. Splitting never rewrites or drops a recognized character.
export function transcriptReviewPages(text) {
  const chars = Array.from(String(text || ''));
  return chars.length ? Array.from({ length: Math.ceil(chars.length / 90) }, (_, index) => chars.slice(index * 90, (index + 1) * 90).join('')) : [''];
}
export const SAFE_EXIT_WINDOWS = Object.freeze([[0, .35], [5.4, 5.8], [7.5, 9.95]]);
const MEDIA_FIELDS = ['src', 'width', 'height', 'fps', 'sha256', 'durationSeconds'];
export function rehearsalMediaQualities(manifest) {
  const required = new Set([...Object.values(CLIPS), ...(manifest?.clips || []).filter((clip) => clip.status === 'ready').map((clip) => clip.id)]);
  return ['4k', '720p'].filter((quality) => [...required].every((id) => {
    const media = manifest?.clips?.find((clip) => clip.id === id)?.variants?.[quality];
    return media && typeof media.src === 'string' && media.src.length > 0 && Number.isFinite(media.width) && media.width > 0 && Number.isFinite(media.height) && media.height > 0 && Number.isFinite(media.durationSeconds) && media.durationSeconds > 0 && (typeof media.fps === 'string' || Number.isFinite(media.fps)) && /^[a-f0-9]{64}$/i.test(media.sha256 || '');
  }));
}

/** Variants change media only. Reviewed dialogue, speech cues, safe exits and
 * transitions belong to the same generated performance in both resolutions. */
export function selectRehearsalMedia(manifest, quality = '4k') {
  const available = rehearsalMediaQualities(manifest);
  if (!available.length && manifest.clips.some((clip) => clip.variants && Object.keys(clip.variants).length)) throw new RangeError('모든 장면이 같은 화질로 준비되어야 합니다.');
  if (available.length && !available.includes(quality)) throw new RangeError('준비된 영상 화질을 선택해 주세요.');
  return { ...manifest, clips: manifest.clips.map((clip) => {
    const media = available.length ? clip.variants?.[quality] : null;
    return media ? { ...clip, ...Object.fromEntries(MEDIA_FIELDS.map((key) => [key, media[key]])) } : { ...clip };
  }) };
}
export const REHEARSAL_DURATION_PROFILES = Object.freeze({
  quest: Object.freeze({
    answerLimitsMs: Object.freeze([30000, 25000]),
    leadInMs: 2000, closingMs: 1500,
    targetRangeMs: Object.freeze([60000, 90000]),
  }),
  sample: Object.freeze({
    answerLimitsMs: Object.freeze([20000, 15000]),
    leadInMs: 0, closingMs: 0,
    targetRangeMs: null,
  }),
});

function durationOptions(durationProfile, limits) {
  const profile = REHEARSAL_DURATION_PROFILES[durationProfile];
  if (!profile) throw new RangeError('지원하는 면접 시간 프로필이 필요합니다.');
  const answerLimitsMs = limits ?? profile.answerLimitsMs;
  if (!Array.isArray(answerLimitsMs) || answerLimitsMs.length !== 2 || answerLimitsMs.some((n) => !Number.isFinite(n) || n < 1000 || n > 120000)) throw new RangeError('답변 시간 두 개가 필요합니다. 각 시간은 1~120초여야 합니다.');
  return { profile, answerLimitsMs: [...answerLimitsMs] };
}

/** A timing budget, not a measured completion duration or minimum-time gate.
 * Speech cues and safe exits come from the selected, reviewed manifest.
 * Without a manifest, preserve the original 480p pilot's timing budget.
 * The UI owns the lead-in/closing; it may omit them for a quick retry.
 * Pauses, repeated questions, recognition/answer repairs, loading and microphone
 * finalization add unbounded time. Early answers remove unused answer time. */
export function rehearsalDurationBudget({ durationProfile = 'quest', limits, followup = 'experience', manifest } = {}) {
  const { profile, answerLimitsMs } = durationOptions(durationProfile, limits);
  if (!['experience', 'plan'].includes(followup)) throw new RangeError('실제 후속 질문 분기가 필요합니다.');
  const questionClips = [CLIPS.question, CLIPS[followup]].map((id) => manifest?.clips?.find((clip) => clip.id === id));
  const legacyCues = [3.75, followup === 'experience' ? 4.85 : 4.8];
  const speechCuesMs = questionClips.map((clip, index) => (clip?.answerStartSeconds ?? legacyCues[index]) * 1000);
  if (speechCuesMs.some((cue) => !Number.isFinite(cue) || cue < 0)) throw new RangeError('검수한 질문 종료 시간이 필요합니다.');
  const dissolveMs = 150 * 2;
  const minimumFullAnswerMs = profile.leadInMs + profile.closingMs + speechCuesMs.reduce((sum, value) => sum + value, 0) + answerLimitsMs.reduce((sum, value) => sum + value, 0) + dissolveMs;
  const listeningClips = manifest?.clips?.filter((clip) => clip.id === CLIPS.listening || clip.kind === 'listening' && clip.status === 'ready') || [];
  const listeningWaitMs = listeningClips.length ? Math.max(...listeningClips.map((clip) => maximumExitWaitMs(clip.safeExitWindowsSeconds ?? SAFE_EXIT_WINDOWS, clip.durationSeconds ?? 10))) : maximumExitWaitMs(SAFE_EXIT_WINDOWS, 10);
  // An early answer may finish while the original question's silent tail is
  // still playing. Include that tail as well as the listening loop's notes.
  const maximumSafeExitWaitMs = questionClips.reduce((sum, clip, index) => sum + Math.max(listeningWaitMs, maximumExitWaitMs(clip?.safeExitWindowsSeconds ?? [[8, clip?.durationSeconds ?? 10]], clip?.durationSeconds ?? 10, speechCuesMs[index] / 1000)), 0);
  return Object.freeze({
    durationProfile, answerLimitsMs: Object.freeze(answerLimitsMs),
    leadInMs: profile.leadInMs, closingMs: profile.closingMs,
    targetRangeMs: profile.targetRangeMs,
    fullAnswerEstimateMs: Object.freeze([minimumFullAnswerMs, minimumFullAnswerMs + maximumSafeExitWaitMs]),
    earlyCompletionAllowed: true,
    extraTimeReasons: Object.freeze(['pause', 'repeat', 'answer-repair', 'recognition-repair', 'loading', 'microphone-finalization']),
  });
}

/** Safe exits are reviewed for each performance, including a speaking clip's
 * silent tail. At clip end, its neutral final frame is also safe to leave. */
function checkedExitWindows(windows, duration) {
  if (!Array.isArray(windows)) throw new RangeError('검수한 장면 전환 구간이 필요합니다.');
  let previous = -Infinity;
  for (const pair of windows) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(Number.isFinite) || pair[0] < 0 || pair[1] < pair[0] || pair[0] < previous || pair[1] > duration + .1) throw new RangeError('장면 전환 구간은 영상 길이 안에서 순서대로 지정해야 합니다.');
    previous = pair[1];
  }
  return windows;
}
function maximumExitWaitMs(windows, duration, from = 0) {
  let cursor = from, longest = 0;
  for (const [start, end] of checkedExitWindows(windows, duration)) {
    if (end < cursor) continue;
    longest = Math.max(longest, start - cursor); cursor = Math.max(cursor, end);
  }
  return Math.max(longest, duration - .05 - cursor, 0) * 1000;
}
export function safeExitWaitMs(time, duration = 10, windows = SAFE_EXIT_WINDOWS) {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return null;
  checkedExitWindows(windows, duration);
  if (time >= duration - .05) return 0;
  const normalized = Math.max(0, time);
  for (const [start, end] of windows) {
    if (normalized >= start && normalized <= end) return 0;
    if (normalized < start) return (start - normalized) * 1000;
  }
  return Math.max(0, (duration - normalized) * 1000);
}

const repairMessages = Object.freeze({
  empty: '답변이 확인되지 않았습니다. 직접 입력하거나 다시 답변해 주세요.',
  recognition: '음성을 정확히 확인하지 못했습니다. 내용을 직접 입력하거나 다시 답변해 주세요.',
  repeat: '질문을 다시 들으려면 ‘질문 다시 듣기’를 선택해 주세요.',
  uncertain: '답변을 이어서 준비하거나 질문을 다시 들을 수 있습니다.',
  length: '답변은 2,000자 이내로 입력해 주세요.',
  'off-topic': '지원 이유나 직접 해 본 일, 준비 중인 내용을 말씀해 주세요.',
  detail: '직접 해 본 일이나 준비할 일을 한 가지 더 구체적으로 말씀해 주세요.',
  media: '이 답변에 이어질 질문 영상을 준비하지 못했습니다. 처음부터 다시 시작해 주세요.',
});

/** Session data exists only in memory. This router selects one of two prepared
 * follow-ups; it is not a hiring score, factual verifier or unrestricted AI. */
export function createRehearsalSession({ durationProfile = 'quest', limits: customLimits } = {}) {
  const { answerLimitsMs: limits } = durationOptions(durationProfile, customLimits);
  const initial = () => ({ phase: 'idle', turn: 1, branch: null, question: QUESTIONS.question, clip: CLIPS.question, durationProfile, answerLimitsMs: [...limits], remainingMs: limits[0], paused: false, repair: null, answers: [], pendingClip: null, transcriptDraft: '', error: '' });
  let state = initial();
  const snapshot = () => structuredClone(state);
  function start() {
    if (!['idle', 'complete', 'error'].includes(state.phase)) return snapshot();
    state = initial(); state.phase = 'preparing'; return snapshot();
  }
  function prepared() { if (state.phase === 'preparing') state.phase = 'question'; return snapshot(); }
  function clipEnded(id) {
    if (state.paused || !['question', 'followup'].includes(state.phase) || id !== state.clip) return snapshot();
    state.phase = 'listening'; state.remainingMs = limits[state.turn - 1]; state.repair = null; return snapshot();
  }
  function tick(elapsedMs) {
    if (state.phase === 'listening' && !state.paused && Number.isFinite(elapsedMs) && elapsedMs > 0) state.remainingMs = Math.max(0, state.remainingMs - elapsedMs);
    return snapshot();
  }
  function submit(text, options = {}) {
    if (state.phase !== 'listening' || state.paused) return snapshot();
    // Only these two spoken performances are ready. Planned scripts must never
    // become the question shown to a user before the matching video exists.
    const meaning = state.turn === 1 ? planAnswerFollowup(text, { ...options, availableClipIds: [CLIPS.experience, CLIPS.plan] }) : classifyAnswer(text, options);
    if (meaning.kind === 'repair') {
      state.phase = 'repair'; state.repair = { reason: meaning.reason, message: repairMessages[meaning.reason] || repairMessages.recognition }; return snapshot();
    }
    state.answers.push({ text, category: meaning.category, turn: state.turn });
    if (state.turn === 1) {
      state.branch = { id: meaning.id, clip: meaning.clip, question: meaning.question, category: meaning.category, evidence: meaning.evidence, reason: meaning.reason, ruleId: meaning.ruleId, desiredId: meaning.desiredId, fallback: meaning.fallback };
      state.pendingClip = meaning.clip;
    } else state.pendingClip = null;
    state.phase = 'reviewing'; return snapshot();
  }
  function finishReview() {
    if (state.phase !== 'reviewing' || state.paused) return snapshot();
    if (state.turn === 2) { state.phase = 'complete'; return snapshot(); }
    state.turn = 2; state.phase = 'followup'; state.clip = state.pendingClip; state.pendingClip = null; state.question = state.branch.question; return snapshot();
  }
  function reviewTranscript(text) {
    if (state.phase !== 'listening' || state.paused) return snapshot();
    if (!String(text || '').trim()) return submit('', { recognitionError: true });
    state.transcriptDraft = String(text); state.phase = 'confirming';
    return snapshot();
  }
  function confirmTranscript(text) {
    if (state.phase !== 'confirming' || state.paused) return snapshot();
    // Explicitly reviewed/edited words are the answer. ASR scores must not
    // override the user's correction; semantic validation still runs below.
    state.phase = 'listening'; state.transcriptDraft = '';
    return submit(text);
  }
  function retry() {
    if (['repair', 'confirming'].includes(state.phase) && !state.paused) { state.phase = 'listening'; state.repair = null; state.transcriptDraft = ''; state.remainingMs = limits[state.turn - 1]; }
    return snapshot();
  }
  function repeat() {
    if (['listening', 'repair'].includes(state.phase) && !state.paused) { state.phase = state.turn === 1 ? 'question' : 'followup'; state.repair = null; state.remainingMs = limits[state.turn - 1]; }
    return snapshot();
  }
  function pause() { if (!['idle', 'complete', 'error', 'disposed'].includes(state.phase)) state.paused = true; return snapshot(); }
  function resume() { state.paused = false; return snapshot(); }
  function fail(message) { state.phase = 'error'; state.error = message; state.paused = false; return snapshot(); }
  function reset() { state = initial(); return snapshot(); }
  function dispose() { state = initial(); state.phase = 'disposed'; }
  return Object.freeze({ snapshot, start, prepared, clipEnded, tick, submit, reviewTranscript, confirmTranscript, finishReview, retry, repeat, pause, resume, fail, reset, dispose });
}
