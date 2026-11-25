// 「대학 입학 면접 연습」의 진행. 창 · DOM · 저장소 · 네트워크를 쓰지 않는 순수 상태다.
// 정한 질문 셋과 꼬리 질문 셋, 모두 여섯 차례다. 답과 질문은 이 화면의 메모리에만 둔다.
import { TRACKS, cleanAnswer, fixedFollowup, followupOk } from '../../../path-app/interview-shape.mjs';

export const STEPS = TRACKS.length * 2;
/** 말로 답할 때 한 차례의 길이. 조용하면 먼저 끝난다. 글로 답할 때는 시간을 재지 않는다. */
export const ANSWER_LIMIT_MS = 60000;

export function createStudyInterview({ seed = 0 } = {}) {
  let state = fresh();
  function fresh() {
    return { phase: 'idle', step: 0, question: '', answers: [], asked: [], sources: [], draft: '', remainingMs: ANSWER_LIMIT_MS, paused: false, note: '', review: null, reviewState: 'none' };
  }
  const trackIndex = () => Math.floor(state.step / 2);
  const isFollow = () => state.step % 2 === 1;
  const snapshot = () => ({ ...state, answers: [...state.answers], asked: [...state.asked], sources: [...state.sources], review: state.review ? { ...state.review } : null,
    track: TRACKS[Math.min(trackIndex(), TRACKS.length - 1)].id, trackName: TRACKS[Math.min(trackIndex(), TRACKS.length - 1)].name,
    follow: isFollow(), turn: Math.min(state.step + 1, STEPS), total: STEPS, remainingSeconds: Math.ceil(state.remainingMs / 1000) });
  function ask(question, source) {
    state.question = question; state.asked[state.step] = question; state.sources[state.step] = source;
    state.phase = isFollow() ? 'followup' : 'question'; state.draft = ''; state.note = ''; state.remainingMs = ANSWER_LIMIT_MS;
  }
  function advance(answer) {
    state.answers[state.step] = answer; state.draft = '';
    const done = state.step === STEPS - 1;
    // 첫 질문 뒤에는 꼬리 질문을, 마지막 답 뒤에는 평가를 기다린다.
    if (!isFollow() || done) { state.phase = 'reviewing'; state.reviewState = done ? 'waiting' : 'none'; return; }
    state.step++;
    ask(TRACKS[trackIndex()].main, 'fixed');
  }
  return {
    snapshot,
    start() { state = fresh(); ask(TRACKS[0].main, 'fixed'); return snapshot(); },
    /** 질문을 다 읽었다(들었다). 답을 받는다. */
    listen() { if (['question', 'followup'].includes(state.phase)) { state.phase = 'listening'; state.remainingMs = ANSWER_LIMIT_MS; } return snapshot(); },
    tick(ms) { if (state.phase === 'listening' && !state.paused) state.remainingMs = Math.max(0, state.remainingMs - Math.max(0, ms)); return snapshot(); },
    /** 답 하나. spoken이면 「들린 말」을 먼저 확인한다. 빈 답은 받지 않고 알린다. */
    submit(text, { spoken = false } = {}) {
      if (!['listening', 'confirming'].includes(state.phase)) return snapshot();
      const answer = cleanAnswer(text);
      // 들린 말을 고치다 다 지웠으면 그 자리에서 다시 쓰게 둔다(다시 말하기는 따로 누른다).
      if (!answer && state.phase === 'confirming') { state.note = 'empty'; return snapshot(); }
      if (!answer) { state.phase = 'listening'; state.note = spoken ? 'not-heard' : 'empty'; state.draft = ''; state.remainingMs = ANSWER_LIMIT_MS; return snapshot(); }
      state.note = '';
      if (spoken && state.phase === 'listening') { state.phase = 'confirming'; state.draft = answer; return snapshot(); }
      advance(answer); return snapshot();
    },
    /** 들린 말이 틀렸다. 같은 질문에 다시 말한다. */
    retry() { if (state.phase === 'confirming') { state.phase = 'listening'; state.draft = ''; state.note = ''; state.remainingMs = ANSWER_LIMIT_MS; } return snapshot(); },
    repeat() { if (['listening', 'confirming'].includes(state.phase)) { state.phase = isFollow() ? 'followup' : 'question'; state.draft = ''; state.note = ''; } return snapshot(); },
    /** 꼬리 질문을 받는다. AI 질문이 없거나 꼴이 어긋나면 정해 둔 꼬리 질문을 쓴다. */
    followup(question) {
      if (state.phase !== 'reviewing' || state.reviewState !== 'none') return snapshot();
      const id = TRACKS[trackIndex()].id, ai = followupOk(question);
      state.step++;
      ask(ai ? question : fixedFollowup(id, seed), ai ? 'ai' : 'fixed');
      return snapshot();
    },
    /** 끝 평가를 받는다(없으면 null). */
    complete(review) {
      if (state.phase !== 'reviewing' || state.reviewState !== 'waiting') return snapshot();
      state.phase = 'complete'; state.review = review ? { good: review.good, next: review.next } : null; state.reviewState = review ? 'done' : 'none';
      return snapshot();
    },
    /** 답을 쓰기 시작하면 앞의 알림을 거둔다. */
    clearNote() { state.note = ''; return snapshot(); },
    pause() { if (!['idle', 'complete'].includes(state.phase)) state.paused = true; return snapshot(); },
    resume() { state.paused = false; return snapshot(); },
    reset() { state = fresh(); return snapshot(); },
    /** 평가 요청에 실을 답. 갈래마다 { track, main, follow, asked }다. */
    reviewAnswers() { return TRACKS.map((t, i) => ({ track: t.id, main: state.answers[i * 2], follow: state.answers[i * 2 + 1], asked: state.asked[i * 2 + 1] })); }
  };
}
