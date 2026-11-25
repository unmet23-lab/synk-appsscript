// PATH 「대학 입학 면접 연습」의 자료와 꼴. 순수 자료와 함수만 둔다:
// 브라우저(면접 쪽)와 서버 번들(SYNK-talk synk-path)이 같은 바이트로 질문 · 요청 몸 · 모델 출력 · 답을 쓴다.
// 정한 질문 셋 + AI 꼬리 질문 셋이다. 서버는 앞 대화를 받지 않는다(방금 답 하나만 받는다). 글과 답은 저장하지 않는다.

export const INTERVIEW_PROMPT_VERSION = 'path-interview-v2';
/** 동의 문장의 판. 화면의 면접 동의 문장을 바꾸면 올린다. */
export const INTERVIEW_CONSENT_VERSION = 1;
export const INTERVIEW_LANGS = Object.freeze(['ko', 'en', 'mn']);
export const INTERVIEW_STATUSES = Object.freeze(['done', 'refused', 'limit', 'busy', 'unavailable', 'done_before']);
export const MAX_ANSWER_CHARS = 600;
export const MAX_FOLLOWUP_CHARS = 70;
export const MAX_REVIEW_CHARS = 120;

/** 면접이 있는 과정. 이름은 study-data.mjs와 같고, 근거는 그 과정의 요강(서류와 면접 총점, 또는 면접 동영상)이다. */
export const INTERVIEW_PROGRAMS = Object.freeze({ 'jbnu-ug': '전북대학교', 'wku-ug': '원광대학교', 'jj-ug': '전주대학교' });
const track = (id, name, main, followups, about) => Object.freeze({ id, name, main, followups: Object.freeze(followups), about });
/** 갈래 셋. main은 첫 질문, followups는 AI가 쉬거나 14~17세일 때 쓰는 정해 둔 꼬리 질문, about은 모델에게 주는 설명이다. */
export const TRACKS = Object.freeze([
  track('motive', '지원한 이유', '우리 학교에 지원한 이유를 말씀해 주세요.',
    ['그렇게 생각하게 된 계기를 한 가지 이야기해 주세요.', '다른 나라가 아니라 한국을 고른 이유는 무엇입니까?'], 'why the applicant wants to study at this Korean university'),
  track('study', '공부할 계획', '입학하면 무엇을 어떻게 공부하고 싶습니까?',
    ['그 공부를 위해 지금 준비하고 있는 것은 무엇입니까?', '수업을 듣다가 모르는 것이 있으면 어떻게 하겠습니까?'], 'what the applicant wants to study after admission and how'),
  track('life', '한국 생활', '한국에서 혼자 생활할 때 가장 신경 쓸 것은 무엇입니까?',
    ['그 일을 위해 어떤 준비를 하겠습니까?', '힘든 일이 생기면 누구와 어떻게 이야기하겠습니까?'], 'how the applicant will manage daily life and adapt in Korea')
]);
export const TRACK_IDS = Object.freeze(TRACKS.map((t) => t.id));
export const trackOf = (id) => TRACKS.find((t) => t.id === id) || null;
/** 정해 둔 꼬리 질문. 갈래마다 둘을 면접 회차(seed)에 따라 번갈아 쓴다. */
export const fixedFollowup = (id, seed = 0) => { const t = trackOf(id); return t.followups[Math.abs(Math.trunc(seed)) % t.followups.length]; };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HIDDEN_RE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/;
const fault = (code) => Object.assign(new Error(code), { code });
const plain = (v) => { if (v === null || typeof v !== 'object' || Array.isArray(v)) return false; const p = Object.getPrototypeOf(v); return p === null || Object.getPrototypeOf(p) === null; };
const exactKeys = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const chars = (s) => [...s].length;
const hangulShare = (s) => { const letters = s.match(/\p{L}/gu) || []; return letters.length ? (s.match(/[가-힣]/gu) || []).length / letters.length : 0; };

/** 보낼 답. 줄바꿈과 숨은 글자를 빈칸으로 바꾸고 다듬는다. 한도를 넘으면 앞에서 자른다(화면이 먼저 알린다). */
export function cleanAnswer(text) {
  const s = String(text ?? '').normalize('NFC').replace(new RegExp(HIDDEN_RE.source, 'g'), ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, MAX_ANSWER_CHARS).join('').trim();
}
function answerOk(a) { return typeof a === 'string' && a !== '' && a === a.trim() && a === a.normalize('NFC') && chars(a) <= MAX_ANSWER_CHARS && !HIDDEN_RE.test(a) && !/\s{2,}/.test(a); }
function consentOk(c) { return exactKeys(c, ['v', 'age', 'lang']) && c.v === INTERVIEW_CONSENT_VERSION && c.age === 'adult' && INTERVIEW_LANGS.includes(c.lang); }
function headOk(body, action, keys) {
  return exactKeys(body, ['action', 'request_id', 'session_id', 'program', 'topik', 'consent', ...keys]) && body.action === action
    && typeof body.request_id === 'string' && UUID_RE.test(body.request_id) && typeof body.session_id === 'string' && UUID_RE.test(body.session_id)
    && typeof body.program === 'string' && Object.hasOwn(INTERVIEW_PROGRAMS, body.program)
    && Number.isInteger(body.topik) && body.topik >= 0 && body.topik <= 6 && consentOk(body.consent);
}
const headCopy = (body) => ({ action: body.action, request_id: body.request_id.toLowerCase(), session_id: body.session_id.toLowerCase(), program: body.program, topik: body.topik,
  consent: { v: body.consent.v, age: body.consent.age, lang: body.consent.lang } });

/* ── 요청 몸 ── AI는 만 18세 이상만 쓴다(consent.age는 adult뿐이다). */
export function validateTurnRequest(body) {
  if (!headOk(body, 'interview_turn', ['track', 'answer']) || !TRACK_IDS.includes(body.track) || !answerOk(body.answer)) throw fault('INVALID_INTERVIEW_REQUEST');
  return { ...headCopy(body), track: body.track, answer: body.answer };
}
export function validateReviewRequest(body) {
  if (!headOk(body, 'interview_review', ['answers'])) throw fault('INVALID_INTERVIEW_REQUEST');
  const a = body.answers;
  if (!Array.isArray(a) || a.length !== TRACKS.length) throw fault('INVALID_INTERVIEW_REQUEST');
  const answers = a.map((row, i) => {
    if (!exactKeys(row, ['track', 'main', 'follow', 'asked']) || row.track !== TRACK_IDS[i] || !answerOk(row.main) || !answerOk(row.follow) || !followupOk(row.asked)) throw fault('INVALID_INTERVIEW_REQUEST');
    return { track: row.track, main: row.main, follow: row.follow, asked: row.asked };
  });
  return { ...headCopy(body), answers };
}

/* ── 모델 출력 ── 여기서는 꼴만 본다: 길이, 한글, 한 문장, 숨은 글자. 캐묻는 말과 점수 · 결과의 말은 서버의 가림 검사(모델)가 뜻으로 가린다.
 * 낱말로 막는 것은 뜻이 하나뿐인 것뿐이다(소비자는 비자가 아니다). 걸리면 앱은 정해 둔 꼬리 질문(평가는 없음)으로 이어 간다. */
const BLOCKED = /(합격|점수|(?<![가-힣])만점|(?<![가-힣])비자)/u;
export function followupOk(q) {
  return typeof q === 'string' && q === q.trim() && q !== '' && chars(q) <= MAX_FOLLOWUP_CHARS && !HIDDEN_RE.test(q) && !/\s{2,}/.test(q)
    && hangulShare(q) >= 0.8 && /[?.]$/.test(q) && !/[?.!。！？].*[?.!。！？]/.test(q) && !BLOCKED.test(q) && !/[<>{}[\]"“”]/.test(q);
}
export function checkTurnOutput(out) {
  if (!exactKeys(out, ['question']) || typeof out.question !== 'string') return null;
  const q = out.question.replace(/\s+/g, ' ').trim();
  return followupOk(q) ? q : null;
}
// 평가의 칸은 저마다 한 문장이다.
function reviewOk(s) { return typeof s === 'string' && s === s.trim() && s !== '' && chars(s) <= MAX_REVIEW_CHARS && !HIDDEN_RE.test(s) && hangulShare(s) >= 0.6 && /^[^.!?。！？]+[.!?]$/.test(s) && !BLOCKED.test(s) && !/[<>{}[\]]/.test(s); }
export function checkReviewOutput(out) {
  if (!exactKeys(out, ['good', 'next']) || typeof out.good !== 'string' || typeof out.next !== 'string') return null;
  const good = out.good.replace(/\s+/g, ' ').trim(), next = out.next.replace(/\s+/g, ' ').trim();
  return reviewOk(good) && reviewOk(next) ? { good, next } : null;
}

/* ── 답 ── 앱이 받은 뒤에 본다. status가 done이 아니면 question · good · next는 null이다. */
function replyHead(data, action) {
  if (!plain(data) || data.ok !== true || data.scope !== 'synk-path' || data.action !== action || typeof data.prompt !== 'string' || !INTERVIEW_STATUSES.includes(data.status)
    || !(data.remaining === null || (Number.isSafeInteger(data.remaining) && data.remaining >= 0))) throw fault('INVALID_INTERVIEW_REPLY');
}
export function validateTurnReply(data) {
  replyHead(data, 'interview_turn');
  if (data.status === 'done' ? !followupOk(data.question) : data.question !== null) throw fault('INVALID_INTERVIEW_REPLY');
  return { status: data.status, remaining: data.remaining, question: data.question };
}
export function validateReviewReply(data) {
  replyHead(data, 'interview_review');
  if (data.status === 'done' ? !(reviewOk(data.good) && reviewOk(data.next)) : data.good !== null || data.next !== null) throw fault('INVALID_INTERVIEW_REPLY');
  return { status: data.status, remaining: data.remaining, good: data.good, next: data.next };
}
