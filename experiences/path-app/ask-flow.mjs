// PATH 「물어보기」와 「사람 연결」의 앱 쪽 흐름. 순수 함수와 작은 저장소 감싸개만 둔다(창 · DOM · 네트워크를 쓰지 않는다).
// 요청 몸과 답의 꼴 검사는 ask-shape.mjs(SYNK-talk · Workspace와 같은 바이트)를 그대로 쓴다. 여기서는 그 함수에 넣을 값을 짓고, 받은 답을 화면 상태로 옮긴다.
// 설계: docs/디자인/PATH_유학앱_20261120/AI상담_설계.md.
import {
  validateAskRequest, validateBriefRequest, validateBriefEditRequest, validateCaseRequest, validateAskReply, checkBriefOutput, checkTicket, checkEdits,
  maskAsk, cleanText, looksUrgent, ASK_CONSENT_VERSION, ASK_LANGS, HANDOFF_KINDS, TEEN_KINDS, KINDS, ANSWER_TYPES,
  HISTORY_TURNS, MAX_HISTORY_CHARS, BRIEF_TURNS, MAX_BRIEF_CHARS, MAX_QUESTION_CHARS, MAX_ANSWER_CHARS, MAX_NOTE_CHARS,
  MAX_BRIEF_LINE, MAX_EDITS, MAX_CITES, TICKET_TTL_MS, CASE_CONSENT_VERSION
} from './ask-shape.mjs';

/** Workspace(회사 서버) 출처. 공개 묶음에 들어가는 상수 하나다. CSP connect-src에도 이 값을 더한다(tools/prepare-path-app-public.mjs). */
export const WORKSPACE_ORIGIN = 'https://workspace.synk.im';
export const WORKSPACE_STATUS_PATH = '/api/path-student/status';
export const WORKSPACE_CASES_PATH = '/api/path-student/cases';
export const HELP_MAIL = 'hello@synk.im';
/** 이 탭의 대화(가린 글과 서명된 AI 차례)를 두는 sessionStorage 열쇠. */
export const ASK_STORE_KEY = 'synk-path-ask-v1';
export const ASK_AGES = Object.freeze(['adult', 'teen', 'under14']);
/** 요약을 받은 뒤 이만큼 지나면 다시 받게 한다(증표가 10분을 살고, 보내는 동안의 여유 30초). */
export const BRIEF_FRESH_MS = TICKET_TTL_MS - 30 * 1000;
export const CASE_STATUSES = Object.freeze(['new', 'reviewing', 'answered', 'closed']);

const chars = (s) => [...String(s ?? '')].length;
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 학생이 쓴 글: 다듬고 번호를 가린다. 화면 · 저장 · 보내기 모두 이 글만 쓴다. */
export const maskedQuestion = (text) => maskAsk(cleanText(text));

/* ── AI 차례 ── 서버가 준 turn을 한 글자도 바꾸지 않고 둔다(서명이 그 글 위에 있다). cites · kind는 화면용으로 곁에 둔다. */
function aiTurnOk(turn) {
  try { validateAskReply({ status: 'done', turn, cites: [], kind: turn?.kind }); return turn.role === 'ai'; } catch { return false; }
}
/** 서명 꼴 v2 전의 AI 차례(kind 칸이 없음). 이런 차례가 하나라도 있으면 서명이 맞지 않으므로 대화를 비운다. */
const oldTurn = (e) => plain(e) && e.role === 'ai' && !(plain(e.turn) && Object.hasOwn(e.turn, 'kind'));
function entryOk(e) {
  if (!plain(e)) return false;
  if (e.role === 'student') return Object.keys(e).length === 2 && typeof e.text === 'string' && e.text.length > 0 && chars(e.text) <= MAX_QUESTION_CHARS && e.text === maskAsk(e.text);
  return e.role === 'ai' && aiTurnOk(e.turn) && Array.isArray(e.cites) && e.cites.length <= MAX_CITES && e.cites.every((c) => typeof c === 'string' && c.length <= 120) && KINDS.includes(e.kind) && e.kind === e.turn.kind;
}

/**
 * 이 탭의 대화 저장소. 계정마다 하나만 둔다: 다른 계정의 기록은 읽는 순간 지운다.
 * 저장하는 것: 나이 고름, 동의 판, 답 받을 말, 「내 조건도 함께 보내기」, 대화(학생 글은 가린 글, AI 글은 서명된 차례).
 */
export function createAskStore(storage) {
  const get = () => { try { return storage?.getItem(ASK_STORE_KEY) ?? null; } catch { return null; } };
  const remove = () => { try { storage?.removeItem(ASK_STORE_KEY); return true; } catch { return false; } };
  return Object.freeze({
    load(owner) {
      const raw = get();
      if (raw === null || !owner) return null;
      let v;
      try { v = JSON.parse(raw); } catch { remove(); return null; }
      if (!plain(v) || v.owner !== owner) { remove(); return null; }
      return {
        age: ASK_AGES.includes(v.age) ? v.age : null,
        consent: v.consent === ASK_CONSENT_VERSION,
        lang: ASK_LANGS.includes(v.lang) ? v.lang : null,
        withProfile: v.withProfile !== false,
        turns: Array.isArray(v.turns) && !v.turns.some(oldTurn) ? v.turns.filter(entryOk).slice(-BRIEF_TURNS * 2) : []
      };
    },
    save(owner, rec) {
      if (!owner) return false;
      const turns = rec.turns.filter(entryOk).slice(-BRIEF_TURNS * 2);
      try {
        storage?.setItem(ASK_STORE_KEY, JSON.stringify({ owner, age: rec.age, consent: rec.consent ? ASK_CONSENT_VERSION : null, lang: rec.lang, withProfile: rec.withProfile !== false, turns }));
        return true;
      } catch { return false; }
    },
    clear: remove
  });
}

/* ── 대화 기록 ── 최근 차례부터 거꾸로 세어 maxTurns 차례 · maxChars 자 안으로. 학생 차례는 { role, text }, AI 차례는 받은 turn 그대로. */
export function askHistory(entries, maxTurns = HISTORY_TURNS, maxChars = MAX_HISTORY_CHARS) {
  let out = entries.map((e) => (e.role === 'student' ? { role: 'student', text: e.text } : e.turn)).slice(-maxTurns * 2);
  while (out.length && out.reduce((n, t) => n + chars(t.text), 0) > maxChars) out = out.slice(1);
  return out;
}

/** 「내 조건도 함께 보내기」로 보내는 사본. 값이 있는 칸만 싣는다. 하나도 없으면 null. */
export function askProfile(p) {
  if (!p) return null;
  const out = {};
  for (const k of ['topik', 'gradePct', 'fundsWon']) if (Number.isInteger(p[k])) out[k] = p[k];
  if (typeof p.education === 'string' && p.education) out.education = p.education;
  if (typeof p.target === 'string' && ID_RE.test(p.target)) out.target = p.target;
  const docs = (p.docs || []).map((d) => (typeof d === 'string' ? d : d?.id)).filter((d) => typeof d === 'string' && ID_RE.test(d));
  if (docs.length) out.docs = [...new Set(docs)].slice(0, 60);
  return Object.keys(out).length ? out : null;
}

/** 물어보기 요청 몸(synk-path action 'ask'). 꼴은 validateAskRequest가 본다. 틀리면 code를 단 오류를 던진다. */
export function askBody({ requestId, lang, question, entries, profile = null, topic = null }) {
  const body = validateAskRequest({ request_id: requestId, lang, age: 'adult', consent: ASK_CONSENT_VERSION, question: maskedQuestion(question),
    history: askHistory(entries), ...(profile ? { profile } : {}), ...(topic ? { topic } : {}) });
  return { action: 'ask', ...body };
}

/**
 * 물어보기 답을 화면 상태로 옮긴다.
 * @returns { entry: 대화에 더할 AI 차례 | null, keep: 학생 글을 대화에 남길지, notice: 안내 열쇠 | null, openCard: 고정 카드를 열지, off: 물어보기를 공식 안내 입구로 둘지, remaining }
 * 급함은 모델 답과 상관없이 마지막 안전망으로 본다: 답을 받지 못했고 학생 글에 위험 낱말이 보이면 고정 카드를 연다.
 */
export function askOutcome(reply, failed, question) {
  const danger = looksUrgent(question);
  const remaining = reply && Number.isInteger(reply.remaining) && reply.remaining >= 0 ? reply.remaining : null;
  if (failed) {
    const code = failed.code || '';
    const notice = code === 'AUTH_REQUIRED' || code === 'AUTH_SESSION_MISSING' || code === 'SESSION_REVOKED' ? 'signin'
      : code === 'NETWORK' || /^INVALID_/.test(code) || code === 'TIMEOUT' ? 'lost' : 'failed';
    return { entry: null, keep: false, notice, openCard: danger, off: false, remaining: null };
  }
  let data;
  // 급함 답은 차례의 꼴이 틀려도 카드는 연다(대화에는 남기지 않는다).
  try { data = validateAskReply(reply); } catch { return { entry: null, keep: false, notice: reply?.status === 'urgent' ? null : 'lost', openCard: danger || reply?.status === 'urgent', off: false, remaining: null }; }
  if (data.status === 'done' || data.status === 'urgent') {
    const cites = data.status === 'done' ? data.cites.filter((c) => typeof c === 'string') : [];
    // 서버의 turn(서명 · kind 포함)을 한 글자도 바꾸지 않고 둔다. kind는 그 turn의 kind다.
    return { entry: { role: 'ai', turn: data.turn, cites, kind: data.turn.kind }, keep: true, notice: null, openCard: data.turn.kind === 'urgent', off: false, remaining,
      reopensAt: null };
  }
  return { entry: null, keep: false, notice: data.status, openCard: danger, off: data.status === 'unavailable', remaining, reopensAt: data.status === 'limit' || data.status === 'paused' ? data.reopens_at : null };
}

/* ── 넘김 요약 ── */
/** 넘김 요약 요청 몸(action 'handoff_brief'). 이 탭의 서명된 대화 전체(40차례, 20,000자까지). kind는 연결을 권한 그 답의 kind다(대화에 그 kind의 AI 차례가 없으면 BRIEF_NOT_OFFERED). */
export function briefBody({ requestId, lang, kind, entries, profile = null, topic = null }) {
  const body = validateBriefRequest({ request_id: requestId, lang, age: 'adult', consent: ASK_CONSENT_VERSION, kind,
    history: askHistory(entries, BRIEF_TURNS, MAX_BRIEF_CHARS), ...(profile ? { profile } : {}), ...(topic ? { topic } : {}) });
  return { action: 'handoff_brief', ...body };
}

const briefDates = (b) => [b?.deadline, ...[b?.student, b?.ko].flatMap((x) => (Array.isArray(x?.tasks) ? x.tasks.map((t) => t?.by) : []))].filter((d) => typeof d === 'string');
/**
 * 넘김 요약 답. 꼴만 확인하고 받은 값은 바꾸지 않는다(Workspace가 brief_ko의 해시를 증표와 대 본다).
 * @returns { brief, ticket, at } | { notice } | { urgent: true }(서버가 급함 고정 문안을 냈다 — 위험해요 카드를 연다)
 */
export function briefOutcome(reply, failed, now = Date.now()) {
  if (failed) return { notice: failed.code === 'AUTH_REQUIRED' ? 'signin' : failed.code === 'NETWORK' || /^INVALID_/.test(failed.code || '') ? 'lost' : 'failed' };
  if (!plain(reply) || typeof reply.status !== 'string') return { notice: 'lost' };
  if (reply.status === 'urgent') return { urgent: true };
  if (reply.status !== 'done') return { notice: ['blocked', 'refused', 'limit', 'paused', 'busy', 'unavailable', 'done_before'].includes(reply.status) ? reply.status : 'lost' };
  const b = reply.brief;
  try {
    if (!plain(b) || !HANDOFF_KINDS.includes(b.kind) || !(b.deadline === null || typeof b.deadline === 'string')) throw new Error('brief');
    // 날짜는 요약 안의 날짜를 그대로 허용해 꼴만 본다(날짜 검사는 서버가 한다).
    checkBriefOutput({ kind: b.kind, student: b.student, ko: b.ko }, { allowedDates: briefDates(b), index: { has: () => true } });
    const t = checkTicket(reply.ticket, Number.isInteger(reply.ticket?.exp) ? reply.ticket.exp - 1 : 0); // 시각은 이 기기 시계 대신 받은 때로 잰다
    if (t.kind !== b.kind) throw new Error('kind');
  } catch { return { notice: 'lost' }; }
  return { brief: b, ticket: reply.ticket, at: now };
}
/** 요약을 받은 지 BRIEF_FRESH_MS가 지났으면 증표가 곧 만료된다. 다시 받아야 한다. */
export const briefExpired = (got, now = Date.now()) => !got || !Number.isFinite(got.at) || now - got.at >= BRIEF_FRESH_MS || now < got.at;

/** 학생이 고칠 수 있는 판(학생 말 판에서 시작). 빼면 removed, 더한 줄은 index null. */
export function briefDraft(student) {
  return {
    situation: { text: student.situation, removed: false },
    wants: { text: student.wants, removed: false },
    open: student.open.map((text, index) => ({ index, text, removed: false })),
    task: student.tasks.map((t, index) => ({ index, text: t.do, removed: false }))
  };
}
/** 학생이 고친 줄 목록. kind · deadline · ai_done은 판에 없으므로 고칠 수 없다. 뺀 줄은 text ''. */
export function briefEdits(student, draft) {
  const out = [];
  const line = (v) => maskAsk(cleanText(v));
  for (const f of ['situation', 'wants']) {
    const d = draft[f], before = student[f];
    const text = d.removed ? '' : line(d.text);
    if (text !== line(before)) out.push({ field: f, index: null, text });
  }
  for (const [f, list, orig] of [['open', draft.open, student.open], ['task', draft.task, student.tasks.map((t) => t.do)]]) {
    for (const d of list) {
      const text = line(d.text);
      if (d.index === null) { if (!d.removed && text) out.push({ field: f, index: null, text }); continue; }
      if (d.removed || !text) out.push({ field: f, index: d.index, text: '' });
      else if (text !== line(orig[d.index])) out.push({ field: f, index: d.index, text });
    }
  }
  return out;
}
/** 고친 줄이 정한 꼴 안에 드는가: 줄 수와 줄 길이. 넘으면 열쇠를 낸다. */
export function editsProblem(edits) {
  if (edits.length > MAX_EDITS) return 'tooMany';
  if (edits.some((e) => chars(e.text) > MAX_BRIEF_LINE)) return 'tooLong';
  return null;
}
/** brief_edit 요청 몸. 한국어로 옮길 줄(빈 줄 · 뺀 줄 제외)만 싣는다. 꼴은 validateBriefEditRequest가 본다. */
export function briefEditBody({ requestId, lang, edits }) {
  const body = validateBriefEditRequest({ request_id: requestId, lang, age: 'adult', consent: ASK_CONSENT_VERSION,
    edits: edits.filter((e) => e.text).map(({ field, index, text }) => ({ field, index, text })) });
  return { action: 'brief_edit', request_id: body.request_id, lang: body.lang, age: body.age, consent: body.consent, edits: body.edits.map(({ field, index, text }) => ({ field, index, text })) };
}
/**
 * 고친 줄에 한국어를 붙인다. 학생 말이 한국어면 부르지 않고 그 글을 쓴다. 뺀 줄의 한국어는 null.
 * reply가 보낸 줄과 칸 · 번호 · 글이 같지 않으면 오류를 던진다.
 */
export function editsWithKo(edits, lang, reply = null) {
  // 고친 줄에 위험 낱말이 있어 서버가 급함 고정 문안을 내면 부르는 쪽이 위험해요 카드를 연다.
  if (reply?.status === 'urgent') throw Object.assign(new Error('BRIEF_URGENT'), { code: 'BRIEF_URGENT' });
  const asked = edits.filter((e) => e.text);
  let ko = asked.map((e) => e.text);
  if (lang !== 'ko' && asked.length) {
    const got = reply?.status === 'done' && Array.isArray(reply.edits) ? reply.edits : null;
    if (!got || got.length !== asked.length || got.some((g, i) => g?.field !== asked[i].field || g?.index !== asked[i].index || g?.text !== asked[i].text || typeof g?.text_ko !== 'string' || !cleanText(g.text_ko)))
      throw Object.assign(new Error('BRIEF_EDIT_REPLY'), { code: 'BRIEF_EDIT_REPLY' });
    ko = got.map((g) => maskAsk(cleanText(g.text_ko)));
  }
  let i = 0;
  return checkEdits(edits.map((e) => ({ field: e.field, index: e.index, text: e.text, text_ko: e.text ? ko[i++] : null })));
}

/* ── Workspace로 보내는 건 ── 셋 모두 validateCaseRequest를 거친 몸을 그대로 보낸다. */
/** 함께 보낼 전체 대화(학생이 켠 경우만): { role, text }만. 길면 앞에서 줄인다. */
export function caseConversation(entries) {
  let out = entries.map((e) => ({ role: e.role, text: e.role === 'student' ? e.text : e.turn.text })).filter((t) => chars(t.text) <= MAX_ANSWER_CHARS).slice(-BRIEF_TURNS * 2);
  while (out.length && out.reduce((n, t) => n + chars(t.text), 0) > MAX_BRIEF_CHARS) out = out.slice(1);
  return out;
}
export function handoffCase({ requestId, lang, got, edits, note = '', conversation = null, profile = null, program = null }) {
  const n = maskedQuestion(note);
  const body = { mode: 'handoff', request_id: requestId, lang, consent: CASE_CONSENT_VERSION, ticket: got.ticket, brief_ko: got.brief.ko, brief_student: got.brief.student,
    deadline: got.brief.deadline, edits, note: n ? n.slice(0, MAX_NOTE_CHARS) : null,
    ...(conversation && conversation.length ? { conversation } : {}), ...(profile ? { profile } : {}), ...(program ? { program } : {}) };
  // 검사만 하고 보내는 것은 받은 값 그대로다. 만료는 briefExpired(받은 때)로 따로 보고, 여기서는 꼴만 본다(이 기기 시계가 틀려도 막히지 않게).
  validateCaseRequest(body, Number.isInteger(got.ticket?.exp) ? got.ticket.exp - 1 : Date.now());
  return body;
}
export function urgentCase({ requestId, lang, age, guardian = false, last = null }) {
  const l = last ? maskedQuestion(last).slice(0, MAX_NOTE_CHARS) : null;
  const body = { mode: 'urgent', request_id: requestId, lang, consent: CASE_CONSENT_VERSION, age, guardian: guardian === true, last: l || null };
  validateCaseRequest(body);
  return body;
}
export function teenCase({ requestId, lang, kind, note }) {
  const body = { mode: 'teen', request_id: requestId, lang, consent: CASE_CONSENT_VERSION, age: 'teen', guardian: true, kind, note: maskedQuestion(note).slice(0, MAX_NOTE_CHARS) };
  validateCaseRequest(body);
  return body;
}
export const teenReady = (t) => !!t && TEEN_KINDS.includes(t.kind) && t.guardian === true && t.agree === true && maskedQuestion(t.note).length > 0 && t.phase !== 'sending';

/** 학생이 「내 상담」에 더하는 글. */
export function caseMessage({ requestId, text }) {
  const t = maskedQuestion(text);
  if (!t || chars(t) > MAX_NOTE_CHARS) throw Object.assign(new Error('CASE_BAD_MESSAGE'), { code: 'CASE_BAD_MESSAGE' });
  return { request_id: requestId, text: t };
}

/**
 * Workspace의 GET /api/path-student/cases 답을 화면 꼴로. 모르는 칸은 버리고, 꼴이 틀린 건은 뺀다.
 * 건: { id, kind, status, created_at, wants, messages: [{ id, from: 'student'|'staff', text, at }], unread, delete_at, delete_soon }
 */
export function readCases(data) {
  if (!plain(data) || !Array.isArray(data.cases)) throw Object.assign(new Error('CASES_BAD_REPLY'), { code: 'CASES_BAD_REPLY' });
  const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);
  return data.cases.slice(0, 20).flatMap((c) => {
    if (!plain(c) || typeof c.id !== 'string' || !UUID_RE.test(c.id) || !CASE_STATUSES.includes(c.status) || !['urgent', ...HANDOFF_KINDS].includes(c.kind)) return [];
    const messages = (Array.isArray(c.messages) ? c.messages : []).slice(-100).flatMap((m) => (plain(m) && ['student', 'staff'].includes(m.from) && str(m.text, 4000)
      ? [{ id: str(m.id, 80), from: m.from, text: m.text, at: str(m.at, 40) }] : []));
    return [{ id: c.id.toLowerCase(), kind: c.kind, status: c.status, created_at: str(c.created_at, 40), wants: str(c.wants, 600), messages, unread: Number.isInteger(c.unread) && c.unread > 0 ? c.unread : 0,
      delete_at: str(c.delete_at, 40), delete_soon: c.delete_soon === true }];
  });
}
export const openCases = (cases) => (cases || []).filter((c) => c.status !== 'closed');

/* ── 근거의 화면 자리 ── ask-sources.mjs의 screen 꼴을 앱 동작으로 푼다. 모르는 꼴은 null. */
export function screenTarget(screen) {
  if (typeof screen !== 'string') return null;
  const parts = screen.split('/');
  if (parts.length > 2) return null;
  const [page, id = null] = parts;
  if (id !== null && !ID_RE.test(id)) return null;
  if ((page === 'univDetail' || page === 'post') && id) return { page, id };
  if (page === 'path') return { page, id };
  if ((page === 'profile' || page === 'help') && id === null) return { page, id: null };
  return null;
}

/** 답의 갈래가 사람 연결을 여는가. */
export const opensHandoff = (kind) => HANDOFF_KINDS.includes(kind);
export { ANSWER_TYPES, HANDOFF_KINDS, TEEN_KINDS, MAX_QUESTION_CHARS, MAX_NOTE_CHARS, MAX_BRIEF_LINE, MAX_EDITS, BRIEF_TURNS };
