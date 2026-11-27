// PATH 「물어보기」(AI 상담)와 「사람 연결」의 꼴. 순수 자료와 함수만 둔다:
// 브라우저(앱) · SYNK-talk synk-path 번들(ask · handoff_brief) · Workspace 회사 서버(PATH 상담함)가 같은 바이트로 요청 몸 · 모델 출력 · 넘김 건을 검사한다.
// 설계: docs/디자인/PATH_유학앱_20261120/AI상담_설계.md. 서명과 해시는 부르는 쪽이 한다(여기에는 정해진 문자열 꼴만 둔다).
import { serverMask, SERVER_TOKEN, digitSet } from './translate-shape.mjs';
import { ID_RE, MAX_TOPIK, MAX_FUNDS_WON, EDUCATION_IDS, isDay } from './study-shape.mjs';

export const ASK_PROMPT_VERSION = 'path-ask-v1';
/** 물어보기 동의 문장의 판. 화면 문장을 바꾸면 올린다. 서버는 이 판만 받는다. */
export const ASK_CONSENT_VERSION = 1;
/** 사람 연결(Workspace로 보내기) 동의 문장의 판. */
export const CASE_CONSENT_VERSION = 1;
export const ASK_LANGS = Object.freeze(['ko', 'mn', 'en']);
/** 답 갈래. 근거는 fact(찾음)와 app_help에만 요구한다. */
export const ANSWER_TYPES = Object.freeze(['fact', 'clarify', 'refer', 'app_help', 'safety']);
/** 사람이 들어오는 갈래. none은 사람 없음. */
export const KINDS = Object.freeze(['none', 'urgent', 'act', 'synk', 'stuck']);
/** 넘김 요약을 거쳐 증표로 들어오는 갈래. urgent는 고정 꼴로 바로 간다. */
export const HANDOFF_KINDS = Object.freeze(['act', 'synk', 'stuck']);
export const CASE_KINDS = Object.freeze(['urgent', 'act', 'synk', 'stuck']);
/** 14~17세가 직접 고르는 짧은 연결 양식의 갈래. */
export const TEEN_KINDS = Object.freeze(['act', 'synk']);
// paused: 전체 하루 몫이나 하루 사용량 상한에 닿아 오늘은 모두에게 쉰다(다음 UTC 자정에 다시 연다). unavailable은 스위치 · 키가 없을 때다.
export const ASK_STATUSES = Object.freeze(['done', 'blocked', 'refused', 'limit', 'paused', 'busy', 'unavailable', 'urgent', 'done_before']);

export const MAX_QUESTION_CHARS = 1000;
export const HISTORY_TURNS = 8;
export const MAX_HISTORY_CHARS = 6000;
export const BRIEF_TURNS = 40;
export const MAX_BRIEF_CHARS = 20000;
export const MAX_ANSWER_CHARS = 1500;
export const MAX_CITES = 8;
export const MAX_REQUEST_BYTES = 96 * 1024;
export const MAX_NOTE_CHARS = 1000;
export const MAX_BRIEF_LINE = 300;
export const MAX_TASKS = 8;
export const MAX_EDITS = 10;
/** 서버가 붙이는 AI 답 서명과 연결 증표의 꼴 이름. 판이 바뀌면 옛 서명은 받지 않는다. */
export const ANSWER_SIG_PREFIX = 'path-ask-answer.v2';
export const TICKET_PREFIX = 'path-case-ticket.v1';
export const TICKET_TTL_MS = 10 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIG_RE = /^[A-Za-z0-9_-]{43}$/; // HMAC-SHA256 base64url(패딩 없음)
const HEX64_RE = /^[0-9a-f]{64}$/;

const fault = (code) => Object.assign(new Error(code), { code });
const plain = (v) => { if (v === null || typeof v !== 'object' || Array.isArray(v)) return false; const p = Object.getPrototypeOf(v); return p === null || Object.getPrototypeOf(p) === null; };
const exactKeys = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const someKeys = (v, required, optional = []) => plain(v) && required.every((k) => Object.hasOwn(v, k)) && Object.keys(v).every((k) => required.includes(k) || optional.includes(k));
const chars = (s) => [...s].length;
const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
// 남기지 않는 글자: 제어 문자(줄바꿈 제외), 폭 없는 글자, 양방향 덮어쓰기.
const HIDDEN_RE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;

/** 글을 다듬는다: NFC, 숨은 글자 지우기, 줄바꿈은 세 줄까지 연달아, 앞뒤 빈칸 지우기. */
export function cleanText(text) {
  // 줄마다 앞뒤 빈칸을 먼저 지우고 빈 줄을 줄인다(두 번 다듬어도 같은 글이 되게).
  return String(text ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(HIDDEN_RE, '').replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
const goodText = (v, max, min = 1) => typeof v === 'string' && v === cleanText(v) && chars(v) >= min && chars(v) <= max;

/* ── 번호 가리기 ── 앱이 보내기 전에, SYNK-talk과 Workspace가 받은 뒤에 같은 함수로 가린다. 되돌릴 값은 두지 않는다(⟦R0⟧).
 * 몽골 주민등록번호(글자 둘 + 숫자 여덟)는 번역 초안의 검사를 그대로 쓴다.
 * 여권번호: 영문 한두 자 + 숫자 일곱 · 여덟 자(몽골 · 한국 여권, 소문자로 써도), 한국 차세대 여권(영문 + 숫자 셋 + 영문 + 숫자 넷, 예 M123A4567). 앞뒤가 글자나 숫자에 붙어 있으면 보지 않는다.
 * 한국 주민 · 외국인등록번호: 숫자 여섯 + (줄표) + 1~8로 시작하는 숫자 일곱. */
const PASSPORT_RE = /(?<![\p{L}\p{N}⟦])(?:[A-Z]{1,2}[\s-]?\d{7,8}|[A-Z]\d{3}[A-Z]\d{4})(?![\p{N}⟧])/giu;
const KR_ID_RE = /(?<![\p{N}⟦])\d{6}\s?[-–]?\s?[1-8]\d{6}(?![\p{N}⟧])/gu;
export function maskAsk(text) {
  return serverMask([String(text ?? '')])[0].replace(KR_ID_RE, SERVER_TOKEN).replace(PASSPORT_RE, SERVER_TOKEN);
}
export const MASK_TOKEN = SERVER_TOKEN;
/** 가린 뒤에도 번호 꼴이 남았는지(서버가 받은 글의 재확인). */
export const hasIdNumber = (text) => maskAsk(text) !== String(text ?? '');

/* ── 위험 낱말 ── 모델이 실패 · 거절 · 한도일 때 고정 카드를 띄울지 고르는 마지막 안전망이다. 판정의 주 경로는 모델이다.
 * 넓게 잡는 쪽으로 둔다(놓치는 것보다 카드가 한 번 더 뜨는 편이 낫다). 라틴 글자로 쓴 몽골어도 본다. */
const DANGER = [
  // 한국어
  '죽고 싶', '죽고싶', '자살', '자해', '목숨', '때려', '때리', '때렸', '때린', '얻어맞', '두들겨 맞', '맞아서 병원', '맞아서 다쳤', '맞고 있', '한테 맞았', '에게 맞았', '한테 맞고', '에게 맞고', '한테 맞아서', '에게 맞아서', '한테 맞을', '에게 맞을', '폭행', '폭력', '성폭', '성추행', '강간', '협박', '감금', '납치', '갇혀', '위협', '돈을 뜯', '돈 뜯', '사기를 당', '사기 당', '살려줘', '살려 줘', '살려주세요', '살려 주세요', '위험해', '죽인다', '죽이겠', '죽일 거',
  // 영어
  'kill myself', 'suicide', 'suicidal', 'self-harm', 'self harm', 'hurt myself', 'end my life', 'want to die', 'wanna die', 'don\'t want to live', 'hit me', 'hits me', 'beat me', 'beats me', 'kill me', 'hurt me', 'abuse', 'assault', 'threaten', 'kidnap', 'locked me in', 'beaten', 'scammed', 'in danger',
  // 몽골어(키릴)
  'амиа хорло', 'амиа егүүт', 'үхмээр', 'өөрийгөө гэмтээ', 'зодсон', 'зодуул', 'зодож', 'зодлоо', 'зодно', 'намайг ална', 'ална гэсэн', 'алчихна', 'алах гэж', 'хүчир', 'бэлгийн дарамт', 'айлга', 'заналх', 'хулгайлсан', 'луйвар', 'аюулд', 'аврагтун',
  // 몽골어(라틴 글자)
  'amia horl', 'amiaa horl', 'uhmeer', 'ukhmeer', 'zodson', 'zoduul', 'huchir', 'khuchir', 'luivar', 'ayuuld'
];
// 라틴 글자 낱말 가운데 다른 낱말 속에 들어가기 쉬운 것(grape의 rape)은 낱말 경계로 본다.
const DANGER_WORDS = /\b(?:rape|raped|raping)\b/i;
// 돈 · 요금을 「맞았다」는 영어 관용 표현만 좁게 뺀다: hit me with (a|an|the)? ($50)? (late|big|huge|surprise)? fee/bill/charge/fine. 물건(belt 따위)은 빼지 않는다.
const SAFE_EN = /\bhits?\s+me\s+with\s+(?:a\s+|an\s+|the\s+)?(?:[$€₩]?\d[\d,.]*\s+)?(?:(?:late|big|huge|surprise|extra)\s+)?(?:fee|bill|charge|fine)s?\b/gi;
export function looksUrgent(text) {
  const s = String(text ?? '').toLowerCase().normalize('NFC').replace(SAFE_EN, ' ');
  return DANGER.some((w) => s.includes(w)) || DANGER_WORDS.test(s);
}

/* ── 숫자 대조 ── 답 속 숫자가 근거(인용 항목의 글) · 질문 · 학생 조건에 있는지 본다. 0과 1은 보지 않는다(「한 번」 · 「1년」 따위).
 * 천 단위 쉼표를 지우고, 만 · 억 · сая(백만) · мянга(천) · million · thousand를 곱해 같은 금액을 같은 숫자로 센다. */
const UNIT = [['억', 1e8], ['만', 1e4], ['сая', 1e6], ['мянга', 1e3], ['million', 1e6], ['thousand', 1e3]];
function expandUnits(text) {
  let s = String(text ?? '').replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  // 한국어 금액을 한 수로 읽는다: 「1억 2000만」, 「82만 500원」(뒤 단위를 따로 세면 「82만 원」이 근거에 있는 것처럼 보인다).
  s = s.replace(/(?<![\d.])(\d+(?:\.\d+)?)\s*억\s*(\d+)\s*만(?:\s*(\d{1,4})(?=\s*원))?/g, (m, a, b, c) => ` ${Math.round(Number(a) * 1e8) + Number(b) * 1e4 + (c ? Number(c) : 0)} `);
  s = s.replace(/(?<![\d.])(\d+)\s*만\s*(\d{1,4})(?=\s*원)/g, (m, a, b) => ` ${Number(a) * 1e4 + Number(b)} `);
  for (const [word, mult] of UNIT) {
    s = s.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${word}`, 'giu'), (m, n) => ` ${Math.round(Number(n) * mult)} `);
  }
  return s;
}
export function numbersIn(text) { return digitSet(expandUnits(text)); }
/** 답에만 있는 숫자들(0 · 1 제외). 비어 있어야 통과다. */
export function strayNumbers(answer, allowedTexts) {
  const allowed = new Set();
  for (const t of allowedTexts) for (const n of numbersIn(t)) allowed.add(n);
  return [...numbersIn(answer)].filter((n) => n !== '0' && n !== '1' && !allowed.has(n));
}

/* ── 학생 조건의 사본 ── 학생이 「내 조건도 함께 보내기」를 켰을 때만 간다. study-shape의 칸 범위를 쓰되 고른 칸만 있어도 받는다. */
export const PROFILE_FIELDS = Object.freeze(['topik', 'gradePct', 'fundsWon', 'education', 'target', 'docs']);
export function checkProfile(p) {
  if (p === null) return null;
  if (!someKeys(p, [], PROFILE_FIELDS) || !Object.keys(p).length) throw fault('ASK_BAD_PROFILE');
  const ok = (k, f) => !Object.hasOwn(p, k) || p[k] === null || f(p[k]);
  if (!ok('topik', (v) => intIn(v, 0, MAX_TOPIK)) || !ok('gradePct', (v) => intIn(v, 0, 100)) || !ok('fundsWon', (v) => intIn(v, 0, MAX_FUNDS_WON))
    || !ok('education', (v) => EDUCATION_IDS.includes(v)) || !ok('target', (v) => typeof v === 'string' && ID_RE.test(v))
    || !ok('docs', (v) => Array.isArray(v) && v.length <= 60 && new Set(v).size === v.length && v.every((d) => typeof d === 'string' && ID_RE.test(d)))) throw fault('ASK_BAD_PROFILE');
  const out = {};
  for (const k of PROFILE_FIELDS) if (Object.hasOwn(p, k)) out[k] = k === 'docs' && Array.isArray(p[k]) ? [...p[k]] : p[k];
  return out;
}
/** 숫자 대조에 쓰는 조건의 글(학생이 스스로 말한 숫자는 답이 되풀이해도 된다). */
export const profileText = (p) => (p ? [p.topik, p.gradePct, p.fundsWon].filter((v) => Number.isInteger(v)).join(' ') : '');

/* ── 대화 기록 ── 학생 차례는 가린 글, AI 차례는 서버가 서명한 답이다. 서명 확인은 서버가 한다(비밀 열쇠). */
function checkTurn(t) {
  if (!someKeys(t, ['role', 'text'], ['sig', 'at', 'type', 'found', 'ask_where', 'rechecking', 'kind'])) throw fault('ASK_BAD_HISTORY');
  if (t.role === 'student') {
    if (Object.keys(t).length !== 2 || !goodText(t.text, MAX_QUESTION_CHARS)) throw fault('ASK_BAD_HISTORY');
    return { role: 'student', text: t.text };
  }
  if (t.role !== 'ai' || !goodText(t.text, MAX_ANSWER_CHARS) || typeof t.sig !== 'string' || !SIG_RE.test(t.sig) || !intIn(t.at, 0, 8.64e15)
    || !ANSWER_TYPES.includes(t.type) || typeof t.found !== 'boolean' || !(t.ask_where === null || (typeof t.ask_where === 'string' && t.ask_where.length <= 120))
    || typeof t.rechecking !== 'boolean' || !KINDS.includes(t.kind)) throw fault('ASK_BAD_HISTORY');
  return { role: 'ai', text: t.text, sig: t.sig, at: t.at, type: t.type, found: t.found, ask_where: t.ask_where, rechecking: t.rechecking, kind: t.kind };
}
function checkHistory(history, maxTurns, maxChars) {
  if (!Array.isArray(history) || history.length > maxTurns * 2) throw fault('ASK_BAD_HISTORY');
  const out = history.map(checkTurn);
  if (out.reduce((n, t) => n + chars(t.text), 0) > maxChars) throw fault('ASK_BAD_HISTORY');
  return out;
}
/** AI 답 서명에 넣는 정해진 문자열. 서버는 HMAC-SHA256(열쇠, 이 문자열)을 base64url로 붙인다. */
export function answerSigPayload(sub, t) {
  return [ANSWER_SIG_PREFIX, sub, String(t.at), t.type, t.found ? '1' : '0', t.ask_where ?? '', t.rechecking ? '1' : '0', t.kind, t.text].join('\u001F');
}
/** 서명이 맞는 AI 차례 가운데 「사실을 찾지 못했고 물을 곳도 없는」 답의 수(stuck 셈). 서명이 틀린 AI 차례는 부르는 쪽이 먼저 버린다. */
export const unknownCount = (history) => history.filter((t) => t.role === 'ai' && t.type === 'fact' && !t.found && t.ask_where === null && !t.rechecking).length;

/* ── 물어보기 요청 ── 앱은 보내기 전에, 서버는 받은 뒤에 같은 함수로 본다. 정한 꼴과 다르면 code를 단 오류를 던진다. */
export function validateAskRequest(body) {
  if (!someKeys(body, ['request_id', 'lang', 'age', 'consent', 'question', 'history'], ['profile', 'topic'])) throw fault('ASK_BAD_REQUEST');
  if (typeof body.request_id !== 'string' || !UUID_RE.test(body.request_id)) throw fault('ASK_BAD_REQUEST');
  if (!ASK_LANGS.includes(body.lang)) throw fault('ASK_BAD_LANG');
  if (body.age !== 'adult') throw fault('ASK_AGE'); // 첫 판은 만 18세 이상만 AI와 대화한다(결정 11-27)
  if (body.consent !== ASK_CONSENT_VERSION) throw fault('ASK_CONSENT');
  if (!goodText(body.question, MAX_QUESTION_CHARS)) throw fault('ASK_BAD_QUESTION');
  if (hasIdNumber(body.question)) throw fault('ASK_UNMASKED');
  const history = checkHistory(body.history, HISTORY_TURNS, MAX_HISTORY_CHARS);
  if (history.some((t) => t.role === 'student' && hasIdNumber(t.text))) throw fault('ASK_UNMASKED');
  const topic = body.topic ?? null;
  if (!(topic === null || (typeof topic === 'string' && ID_RE.test(topic)))) throw fault('ASK_BAD_REQUEST');
  return { request_id: body.request_id.toLowerCase(), lang: body.lang, age: 'adult', consent: body.consent, question: body.question, history,
    profile: checkProfile(body.profile ?? null), topic };
}

/* ── 모델 출력(만들기) ── JSON 스키마로 묶지만 서버가 다시 본다. */
export const ASK_OUTPUT_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['type', 'answer', 'cites', 'found', 'ask_where', 'rechecking', 'kind', 'kind_reason'],
  properties: {
    type: { type: 'string', enum: [...ANSWER_TYPES] }, answer: { type: 'string' }, cites: { type: 'array', items: { type: 'string' } },
    found: { type: 'boolean' }, ask_where: { type: ['string', 'null'] }, rechecking: { type: 'boolean' },
    kind: { type: 'string', enum: [...KINDS] }, kind_reason: { type: 'string' }
  }
});
export function checkAskOutput(out) {
  if (!exactKeys(out, ASK_OUTPUT_SCHEMA.required) || !ANSWER_TYPES.includes(out.type) || !KINDS.includes(out.kind)
    || typeof out.answer !== 'string' || !Array.isArray(out.cites) || out.cites.length > MAX_CITES * 2 || !out.cites.every((c) => typeof c === 'string' && c.length <= 120)
    || typeof out.found !== 'boolean' || !(out.ask_where === null || (typeof out.ask_where === 'string' && out.ask_where.length <= 120))
    || typeof out.rechecking !== 'boolean' || typeof out.kind_reason !== 'string') throw fault('ASK_BAD_OUTPUT');
  const answer = cleanText(out.answer);
  if (!answer || chars(answer) > MAX_ANSWER_CHARS) throw fault('ASK_BAD_OUTPUT');
  return { type: out.type, answer, cites: [...new Set(out.cites)], found: out.found, ask_where: out.ask_where, rechecking: out.rechecking,
    kind: out.kind, kind_reason: cleanText(out.kind_reason).slice(0, 200) };
}

/**
 * 서버 검사: 모델이 낸 답을 근거 묶음 · 대화 · 질문에 대 보고 내보낼 꼴로 정한다.
 * @param out checkAskOutput을 거친 값
 * @param ctx { index: Map(id → 근거 항목), history: 서명이 확인된 대화, question, profile }
 * @returns { blocked: null | 이유, answer: { type, text, cites, found, ask_where, rechecking, kind } }
 * 급함(safety · urgent)은 막지 않고 부르는 쪽이 고정 문안으로 바꾼다.
 */
export function settleAnswer(out, { index, history, question, profile = null }) {
  const said = [question, profileText(profile), ...history.map((t) => t.text)];
  let { type, kind } = out;
  if (type === 'safety' || kind === 'urgent') { type = 'safety'; kind = 'urgent'; }
  // 숫자 대조는 자르기 전의 모든 알려진 근거로 한다(서류 목록 답은 근거를 열 개 넘게 단다). 학생에게 보이는 근거만 여덟 개로 자른다.
  const allKnown = out.cites.filter((id) => index.has(id));
  const known = allKnown.slice(0, MAX_CITES);
  let askWhere = out.ask_where !== null && index.has(out.ask_where) && index.get(out.ask_where).ask ? out.ask_where : null;
  const result = (blocked) => ({ blocked, answer: { type, text: out.answer, cites: known, found: out.found, ask_where: askWhere, rechecking: out.rechecking, kind } });
  if (type === 'safety') return result(null);
  if (hasIdNumber(out.answer)) return result('id_number');
  if (type === 'fact' && out.found && !known.length) return result('no_source');
  if (type === 'refer' && !askWhere) return result('bad_refer');
  if (type === 'app_help' && !known.some((id) => index.get(id).kind === 'help')) return result('no_help');
  // 답 속 숫자는 단 근거(못 찾은 답이 단 근거도) · 물을 곳 · 질문 · 조건 · 대화 어딘가에 있어야 한다. 근거 없는 되묻기는 질문 · 조건 · 대화만 본다.
  const texts = [...allKnown, ...(askWhere ? [askWhere] : [])].flatMap((id) => {
    const it = index.get(id);
    return [...(it.lines?.ko || []), ...(it.lines?.en || []), ...(it.dates || []).map((d) => d.date), it.ask?.ko || '', it.ask?.en || ''];
  });
  if (strayNumbers(out.answer, [...texts, ...said]).length) return result('stray_number');
  // stuck: 사실을 찾지 못했고 물을 곳도 없는 답이 이 대화에서 두 번째일 때만 연다. 「다시 확인 중」은 세지 않는다.
  const thisUnknown = type === 'fact' && !out.found && askWhere === null && !out.rechecking;
  if (kind === 'stuck' && !(thisUnknown && unknownCount(history) >= 1)) kind = 'none';
  return result(null);
}

/* ── 검사 부르기(둘째 부르기) ── 답과 인용 원문을 함께 보이고 내도 되는지 묻는다. */
export const VET_REASONS = Object.freeze(['none', 'unsupported', 'promise', 'legal', 'probing', 'other_person', 'invented', 'not_human_task', 'form', 'other']);
export const VET_SCHEMA = Object.freeze({ type: 'object', additionalProperties: false, required: ['allowed', 'reason'],
  properties: { allowed: { type: 'boolean' }, reason: { type: 'string', enum: [...VET_REASONS] } } });
export function checkVetOutput(out) {
  if (!exactKeys(out, ['allowed', 'reason']) || typeof out.allowed !== 'boolean' || !VET_REASONS.includes(out.reason)) throw fault('ASK_BAD_VET');
  // 허락했어도 막는 이유를 함께 냈으면 막는다. 막았는데 이유가 none이면 other로 센다.
  const allowed = out.allowed && out.reason === 'none';
  return { allowed, reason: allowed ? 'none' : (out.reason === 'none' ? 'other' : out.reason) };
}

/* ── 물어보기 답(서버 → 앱) ── */
export function validateAskReply(data) {
  if (!plain(data) || !ASK_STATUSES.includes(data.status)) throw fault('ASK_BAD_REPLY');
  if (data.status === 'done' || data.status === 'urgent') {
    const t = checkTurn(data.turn);
    if (t.role !== 'ai') throw fault('ASK_BAD_REPLY');
    if (data.status === 'urgent' && (t.type !== 'safety' || t.kind !== 'urgent')) throw fault('ASK_BAD_REPLY');
    if (data.status === 'done' && (!Array.isArray(data.cites) || data.cites.length > MAX_CITES || data.kind !== t.kind)) throw fault('ASK_BAD_REPLY');
  }
  // limit의 reopens_at은 원장의 하루가 바뀌는 때(다음 UTC 자정)의 밀리초 숫자다.
  if ((data.status === 'limit' || data.status === 'paused') && !intIn(data.reopens_at, 0, 8.64e15)) throw fault('ASK_BAD_REPLY');
  return data;
}

/* ── 넘김 요약(handoff_brief) ── */
const BRIEF_BODY_KEYS = ['situation', 'wants', 'ai_done', 'open', 'tasks'];
export const BRIEF_OUTPUT_SCHEMA = Object.freeze((() => {
  const line = { type: 'string' };
  const body = { type: 'object', additionalProperties: false, required: BRIEF_BODY_KEYS, properties: {
    situation: line, wants: line,
    ai_done: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'cites'], properties: { text: line, cites: { type: 'array', items: line } } } },
    open: { type: 'array', items: line },
    tasks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['do', 'why', 'by'], properties: { do: line, why: line, by: { type: ['string', 'null'] } } } }
  } };
  return { type: 'object', additionalProperties: false, required: ['kind', 'student', 'ko'], properties: { kind: { type: 'string', enum: [...HANDOFF_KINDS] }, student: body, ko: body } };
})());

function checkBriefBody(b, { okDate, index }) {
  if (!exactKeys(b, BRIEF_BODY_KEYS)) throw fault('BRIEF_BAD_OUTPUT');
  const line = (v, max = MAX_BRIEF_LINE) => { const s = cleanText(v); if (typeof v !== 'string' || !s || chars(s) > max) throw fault('BRIEF_BAD_OUTPUT'); return maskAsk(s); };
  if (!Array.isArray(b.ai_done) || b.ai_done.length > 8 || !Array.isArray(b.open) || b.open.length > 8 || !Array.isArray(b.tasks) || !b.tasks.length || b.tasks.length > MAX_TASKS) throw fault('BRIEF_BAD_OUTPUT');
  return {
    situation: line(b.situation, 600), wants: line(b.wants),
    ai_done: b.ai_done.map((d) => { if (!exactKeys(d, ['text', 'cites']) || !Array.isArray(d.cites)) throw fault('BRIEF_BAD_OUTPUT'); return { text: line(d.text), cites: d.cites.filter((c) => typeof c === 'string' && index.has(c)).slice(0, MAX_CITES) }; }),
    open: b.open.map((o) => line(o)),
    tasks: b.tasks.map((t) => {
      if (!exactKeys(t, ['do', 'why', 'by'])) throw fault('BRIEF_BAD_OUTPUT');
      const why = cleanText(t.why);
      if (!why) throw fault('BRIEF_NO_WHY'); // 사람이 해야 하는 까닭이 없는 할 일은 받지 않는다
      return { do: line(t.do, 200), why: line(t.why, 200), by: typeof t.by === 'string' && okDate(t.by) ? t.by : null };
    })
  };
}
/**
 * 넘김 요약 모델 출력을 검사한다. 날짜는 고른 과정의 근거 묶음 날짜(오늘 이후)만 받고, 아니면 null로 바꾼다.
 * @param ctx { allowedDates: ['YYYY-MM-DD'…], index: Map }
 */
export function checkBriefOutput(out, ctx) {
  if (!exactKeys(out, ['kind', 'student', 'ko']) || !HANDOFF_KINDS.includes(out.kind)) throw fault('BRIEF_BAD_OUTPUT');
  const inner = { okDate: (d) => ctx.allowedDates.includes(d), index: ctx.index };
  const student = checkBriefBody(out.student, inner), ko = checkBriefBody(out.ko, inner);
  if (student.tasks.length !== ko.tasks.length) throw fault('BRIEF_BAD_OUTPUT');
  // 두 벌의 날짜는 같아야 한다. 다르면 둘 다 null.
  ko.tasks.forEach((t, i) => { if (t.by !== student.tasks[i].by) { t.by = null; student.tasks[i].by = null; } });
  const deadline = [...ctx.allowedDates].sort()[0] ?? null;
  return { kind: out.kind, student, ko, deadline };
}
/** 넘김 요약 요청(앱 → SYNK-talk). 서명된 대화 전체와 갈래를 보낸다. */
export function validateBriefRequest(body) {
  if (!someKeys(body, ['request_id', 'lang', 'age', 'consent', 'kind', 'history'], ['profile', 'topic'])) throw fault('BRIEF_BAD_REQUEST');
  if (typeof body.request_id !== 'string' || !UUID_RE.test(body.request_id) || !ASK_LANGS.includes(body.lang) || body.age !== 'adult'
    || body.consent !== ASK_CONSENT_VERSION || !HANDOFF_KINDS.includes(body.kind)) throw fault('BRIEF_BAD_REQUEST');
  const history = checkHistory(body.history, BRIEF_TURNS, MAX_BRIEF_CHARS);
  // 물어보기와 같이 학생 글에 가리지 않은 번호가 있으면 받지 않는다(앱은 보내기 전에 가린다).
  if (history.some((t) => t.role === 'student' && hasIdNumber(t.text))) throw fault('BRIEF_BAD_REQUEST');
  // 넘김은 AI가 그 갈래로 사람 연결을 권한 답이 있을 때만 받는다. 서명 확인(서버)과 함께 쓴다.
  if (!history.some((t) => t.role === 'ai' && t.kind === body.kind)) throw fault('BRIEF_NOT_OFFERED');
  const topic = body.topic ?? null;
  if (!(topic === null || (typeof topic === 'string' && ID_RE.test(topic)))) throw fault('BRIEF_BAD_REQUEST');
  return { request_id: body.request_id.toLowerCase(), lang: body.lang, age: 'adult', consent: body.consent, kind: body.kind, history, profile: checkProfile(body.profile ?? null), topic };
}

/** 학생이 고친 줄. kind · deadline · ai_done은 고치지 못한다. index가 null이면 새 줄이다. */
export const EDIT_FIELDS = Object.freeze(['situation', 'wants', 'open', 'task']);
export function checkEdits(edits) {
  if (!Array.isArray(edits) || edits.length > MAX_EDITS) throw fault('CASE_BAD_EDITS');
  return edits.map((e) => {
    if (!exactKeys(e, ['field', 'index', 'text', 'text_ko']) || !EDIT_FIELDS.includes(e.field)
      || !(e.index === null || intIn(e.index, 0, MAX_TASKS)) || ((e.field === 'situation' || e.field === 'wants') && e.index !== null)
      || !goodText(e.text, MAX_BRIEF_LINE, 0) || !(e.text_ko === null || goodText(e.text_ko, MAX_BRIEF_LINE * 2, 0))) throw fault('CASE_BAD_EDITS');
    return { field: e.field, index: e.index, text: maskAsk(e.text), text_ko: e.text_ko === null ? null : maskAsk(e.text_ko) };
  });
}

/* ── 고친 줄 옮기기(brief_edit) ── 학생이 고친 넘김 요약 줄을 한국어로 옮긴다. 넘김 요약 몫으로 센다. */
export function validateBriefEditRequest(body) {
  if (!exactKeys(body, ['request_id', 'lang', 'age', 'consent', 'edits']) || typeof body.request_id !== 'string' || !UUID_RE.test(body.request_id)
    || !ASK_LANGS.includes(body.lang) || body.age !== 'adult' || body.consent !== ASK_CONSENT_VERSION || !Array.isArray(body.edits)) throw fault('BRIEF_BAD_REQUEST');
  if (!body.edits.every((e) => exactKeys(e, ['field', 'index', 'text']))) throw fault('BRIEF_BAD_REQUEST');
  const edits = checkEdits(body.edits.map((e) => ({ ...e, text_ko: null })));
  if (!edits.length || edits.some((e) => !e.text)) throw fault('BRIEF_BAD_REQUEST');
  return { request_id: body.request_id.toLowerCase(), lang: body.lang, age: 'adult', consent: body.consent, edits };
}
export const BRIEF_EDIT_SCHEMA = Object.freeze({ type: 'object', additionalProperties: false, required: ['texts'],
  properties: { texts: { type: 'array', items: { type: 'string' } } } });
/* 날짜 읽기: 달 · 날(MM-DD) 목록. 숫자 집합만 보면 3월 7일과 7월 3일이 같아 보인다. 해는 남은 숫자로 맞댄다.
 * 어느 해가 어느 날짜에 붙는지(두 날짜의 해 바꿈)는 이 검사가 보지 않고 모델 검사(SYNK-talk VET_EDIT)가 본다 — 「여기서 2000 원」 같은 금액을 해로 잘못 읽지 않게.
 * 2027-03-07 · 2027.3.7, 3월 7일, 3-р сарын 7 · 3 сарын 7, March 7 · 7 March. */
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad2 = (n) => String(n).padStart(2, '0');
export function datesIn(text) { return dateParts(text).dates; }
/** 달 · 날을 글 순서 목록으로 읽고, 읽은 달 · 날 숫자를 지운 글을 함께 돌려준다(해는 남긴다). */
function dateParts(text) {
  let s = String(text ?? '');
  const found = [];
  const add = (at, m, d) => { m = Number(m); d = Number(d); if (m >= 1 && m <= 12 && d >= 1 && d <= 31) { found.push({ at, v: `${pad2(m)}-${pad2(d)}` }); return true; } return false; };
  const take = (re, pick) => { s = s.replace(re, (...g) => { const at = g.at(-2); return add(at, ...pick(g)) ? ' '.repeat(g[0].length) : g[0]; }); };
  const mon = MONTHS_EN.join('|'), monIdx = (w) => MONTHS_EN.indexOf(String(w).toLowerCase()) + 1;
  take(/(?<=\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/g, (g) => [g[1], g[2]]);
  take(/(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, (g) => [g[1], g[2]]);
  take(/(?<!\d)(\d{1,2})(?:\s*-?\s*р)?\s*сарын\s*(\d{1,2})(?!\d)/giu, (g) => [g[1], g[2]]);
  // 영어 날짜 뒤의 「, 2027」은 해로 떼어 따로 둔다(뒤의 「,500」과 한 수로 읽지 않게). 해는 남은 숫자로 맞댄다.
  s = s.replace(new RegExp(`\\b(${mon})(\\s+\\d{1,2}(?:st|nd|rd|th)?),\\s*((?:19|20)\\d{2})(?=[,\\s]|\\.(?!\\d)|$)`, 'gi'), (all, m, d, y) => `${m}${d} ${y} `);
  s = s.replace(new RegExp(`(?<!\\d)(\\d{1,2}(?:st|nd|rd|th)?\\s+${'(?:' + mon + ')'}),?\\s+((?:19|20)\\d{2})(?=[,\\s]|\\.(?!\\d)|$)`, 'gi'), (all, dm, y) => `${dm} ${y} `);
  take(new RegExp(`\\b(${mon})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)`, 'gi'), (g) => [monIdx(g[1]), g[2]]);
  take(new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s+(${mon})\\b`, 'gi'), (g) => [monIdx(g[2]), g[1]]);
  return { dates: found.sort((p, q) => p.at - q.at).map((x) => x.v), rest: s };
}
/** 옮긴 줄: 줄 수가 같고, 숫자가 원문과 같아야 한다(바뀌면 거절). 양쪽에서 날짜를 읽을 수 있으면 달 · 날 목록이 같고 해는 남은 숫자로 맞댄다(두 날짜의 해 바꿈은 모델 검사가 본다). */
export function checkBriefEditOutput(out, edits) {
  if (!exactKeys(out, ['texts']) || !Array.isArray(out.texts) || out.texts.length !== edits.length) throw fault('BRIEF_BAD_OUTPUT');
  return edits.map((e, i) => {
    const ko = typeof out.texts[i] === 'string' ? cleanText(out.texts[i]) : '';
    if (!ko || chars(ko) > MAX_BRIEF_LINE * 2) throw fault('BRIEF_BAD_OUTPUT');
    // 양쪽에서 날짜를 읽었으면 달 · 날 목록이 그대로 같아야 하고(빠짐 · 더함 · 달 · 날 바뀜 거절), 해를 포함한 남은 숫자를 맞댄다.
    // 한쪽만 날짜를 읽었으면(꼴이 달라) 날짜를 빼지 않고 숫자 전체를 맞댄다. 걸리면 학생에게 다시 쓰게 한다(지나치게 막는 쪽).
    const pa = dateParts(e.text), pb = dateParts(ko), both = pa.dates.length > 0 && pb.dates.length > 0;
    if (both && [...pa.dates].sort().join(',') !== [...pb.dates].sort().join(',')) throw fault('BRIEF_NUMBERS_CHANGED');
    const a = [...numbersIn(both ? pa.rest : e.text)].sort().join(','), b = [...numbersIn(both ? pb.rest : ko)].sort().join(',');
    if (a !== b) throw fault('BRIEF_NUMBERS_CHANGED');
    return { ...e, text_ko: maskAsk(ko) };
  });
}

/* ── 연결 증표 ── handoff_brief가 내고 Workspace가 한 번만 받는다. 서명은 HMAC-SHA256(전용 열쇠, ticketPayload)을 base64url로. */
export function ticketPayload(t) { return [TICKET_PREFIX, t.sub, t.kind, String(t.exp), t.nonce, t.brief_hash].join('\u001F'); }
export function checkTicket(t, now = Date.now()) {
  if (!exactKeys(t, ['sub', 'kind', 'exp', 'nonce', 'brief_hash', 'sig']) || typeof t.sub !== 'string' || !UUID_RE.test(t.sub) || !HANDOFF_KINDS.includes(t.kind)
    || !intIn(t.exp, 0, 8.64e15) || typeof t.nonce !== 'string' || !UUID_RE.test(t.nonce) || typeof t.brief_hash !== 'string' || !HEX64_RE.test(t.brief_hash)
    || typeof t.sig !== 'string' || !SIG_RE.test(t.sig)) throw fault('CASE_BAD_TICKET');
  if (t.exp < now || t.exp > now + TICKET_TTL_MS + 60000) throw fault('CASE_TICKET_EXPIRED');
  return { sub: t.sub.toLowerCase(), kind: t.kind, exp: t.exp, nonce: t.nonce.toLowerCase(), brief_hash: t.brief_hash, sig: t.sig };
}
/** 증표의 brief_hash를 셈할 정해진 문자열(키 차례가 고정된 JSON). 해시는 부르는 쪽이 sha256 hex로. */
/** 증표가 묶는 글: 한국어 판과 서버가 정한 기한(학생이 고칠 수 없는 값). */
export function briefHashInput(ko, deadline = null) {
  const b = ko;
  return JSON.stringify([b.situation, b.wants, b.ai_done.map((d) => [d.text, d.cites]), b.open, b.tasks.map((t) => [t.do, t.why, t.by]), deadline ?? null]);
}

/* ── Workspace에 건 만들기(앱 → Workspace) ── 셋 가운데 하나다: 증표가 있는 넘김, 급함 고정 꼴, 14~17세 짧은 양식. */
const checkConversation = (c) => {
  if (!Array.isArray(c) || c.length > BRIEF_TURNS * 2) throw fault('CASE_BAD_REQUEST');
  const out = c.map((t) => { if (!exactKeys(t, ['role', 'text']) || !['student', 'ai'].includes(t.role) || !goodText(t.text, MAX_ANSWER_CHARS)) throw fault('CASE_BAD_REQUEST'); return { role: t.role, text: maskAsk(t.text) }; });
  if (out.reduce((n, t) => n + chars(t.text), 0) > MAX_BRIEF_CHARS) throw fault('CASE_BAD_REQUEST');
  return out;
};
export function validateCaseRequest(body, now = Date.now()) {
  if (!plain(body) || typeof body.request_id !== 'string' || !UUID_RE.test(body.request_id) || !ASK_LANGS.includes(body.lang) || body.consent !== CASE_CONSENT_VERSION) throw fault('CASE_BAD_REQUEST');
  const base = { request_id: body.request_id.toLowerCase(), lang: body.lang, consent: body.consent };
  if (body.mode === 'urgent') {
    // 14~17세는 보호자 확인이 있어야 받는다(guardian: true). 18세 이상은 false.
    if (!exactKeys(body, ['mode', 'request_id', 'lang', 'consent', 'age', 'guardian', 'last'])) throw fault('CASE_BAD_REQUEST');
    if (!['adult', 'teen'].includes(body.age) || typeof body.guardian !== 'boolean' || (body.age === 'teen' && body.guardian !== true)
      || !(body.last === null || goodText(body.last, MAX_NOTE_CHARS))) throw fault('CASE_BAD_REQUEST');
    return { ...base, mode: 'urgent', kind: 'urgent', age: body.age, guardian: body.guardian, last: body.last === null ? null : maskAsk(body.last) };
  }
  if (body.mode === 'teen') {
    if (!exactKeys(body, ['mode', 'request_id', 'lang', 'consent', 'age', 'guardian', 'kind', 'note'])) throw fault('CASE_BAD_REQUEST');
    if (body.age !== 'teen' || body.guardian !== true || !TEEN_KINDS.includes(body.kind) || !goodText(body.note, MAX_NOTE_CHARS)) throw fault('CASE_BAD_REQUEST');
    return { ...base, mode: 'teen', kind: body.kind, age: 'teen', guardian: true, note: maskAsk(body.note) };
  }
  if (body.mode !== 'handoff' || !someKeys(body, ['mode', 'request_id', 'lang', 'consent', 'ticket', 'brief_ko', 'brief_student', 'deadline', 'edits', 'note'], ['conversation', 'profile', 'program'])) throw fault('CASE_BAD_REQUEST');
  const ticket = checkTicket(body.ticket, now);
  // 넘김 요약 두 벌은 모델 출력과 같은 꼴이다. 다시 다듬어도 바뀌지 않게 날짜는 꼴만 본다. 서버(Workspace)는 brief_ko의 해시가 증표와 같은지 따로 본다.
  const ctx = { okDate: isDay, index: { has: () => true } };
  const brief_ko = checkBriefBody(body.brief_ko, ctx), brief_student = checkBriefBody(body.brief_student, ctx);
  if (!(body.deadline === null || isDay(body.deadline))) throw fault('CASE_BAD_REQUEST');
  if (!(body.note === null || goodText(body.note, MAX_NOTE_CHARS))) throw fault('CASE_BAD_REQUEST');
  const program = body.program ?? null;
  if (!(program === null || (typeof program === 'string' && ID_RE.test(program)))) throw fault('CASE_BAD_REQUEST');
  return { ...base, mode: 'handoff', kind: ticket.kind, ticket, brief_ko, brief_student, deadline: body.deadline, edits: checkEdits(body.edits),
    note: body.note === null ? null : maskAsk(body.note), conversation: body.conversation === undefined ? null : checkConversation(body.conversation),
    profile: checkProfile(body.profile ?? null), program };
}
