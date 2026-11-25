// PATH 「서류 점검」의 자료와 꼴. 순수 자료와 함수만 둔다:
// 브라우저(앱)와 서버 번들(SYNK-talk synk-path)이 같은 바이트로 점검 항목 · 요청 몸 · 모델 출력 · 답을 쓴다.
// 조건은 요강(docs-data.mjs)에서만 온다. AI는 붙여 넣은 글에서 「그 칸이 몇 째 줄에 있는지」만 답한다.
// 맞다 · 틀리다, 점수, 통과를 만들지 않는다. 학생 서류의 글은 어디에도 저장하지 않는다.
import { MAX_LINES, checkLines, TRANSLATE_AGES, TRANSLATE_LANGS } from './translate-shape.mjs';

export const DOC_CHECK_PROMPT_VERSION = 'path-doc-check-v1';
/** 동의 문장의 판. 화면의 점검 동의 문장을 바꾸면 올린다. */
export const DOC_CHECK_CONSENT_VERSION = 1;
export const DOC_CHECK_STATUSES = Object.freeze(['done', 'refused', 'limit', 'busy', 'unavailable', 'done_before']);
/** 한 칸에 보일 줄은 다섯까지다(성적표는 한 학년의 과목이 여러 줄이라 앞의 다섯 줄이면 찾은 것으로 본다). */
export const MAX_FOUND_LINES = 5;

const L = (ko, en) => Object.freeze({ ko, en });
const item = (key, ask, label) => Object.freeze({ key, ask, label });
// ask는 모델에게 주는 영어 설명, label은 화면 글이다.
const TITLE_GRAD = item('title', 'the line that names this document as a graduation certificate, or as an expected-graduation (enrollment/completion) certificate', L('졸업(예정)증명서라는 제목', 'The title of the graduation or expected-graduation certificate'));
const DONE = item('done', 'every line that says the person graduated, completed the program, or is expected to graduate, including the year or date', L('졸업했거나 졸업할 예정이라는 말과 그 날짜', 'The statement and date of graduation or expected graduation'));
const SCHOOL = item('school', 'every line that names the school the person attended', L('다닌 학교의 이름', 'The name of the school'));
const ISSUER = item('issuer', 'every line that names the issuing authority, the issue date, a signature or seal, or a certificate or registration number of the document itself', L('발급한 곳, 발급한 날, 증서 번호', 'The issuer, issue date or certificate number'));
const TITLE_TR = item('title', 'the line that names this document as a transcript, grade sheet or academic record', L('성적증명서라는 제목', 'The title of the transcript'));
const grade = (n) => item(`g${n}`, `lines that give marks or grades for school year ${n} (Mongolian: "${n} дугаар анги", "${n}-р анги", or a table column for year ${n})`, L(`${n}학년 성적`, `Grade ${n} results`));
const MARKS = item('marks', 'lines that give subject names together with marks or grades', L('과목과 성적이 적힌 줄', 'Lines with subjects and marks'));

const GRAD = Object.freeze([TITLE_GRAD, DONE, SCHOOL, ISSUER]);
const TRANSCRIPT_HS = Object.freeze([TITLE_TR, grade(10), grade(11), grade(12), SCHOOL, ISSUER]);
const TRANSCRIPT_LAST = Object.freeze([TITLE_TR, MARKS, SCHOOL, ISSUER]);
/** AI가 글에서 칸을 찾는 서류. 대학에 내는 졸업 · 성적증명서뿐이다(비자 서류는 열지 않는다). */
export const DOC_CHECKS = Object.freeze({
  'jbnu-ug-grad': GRAD, 'jbnu-ug-transcript': TRANSCRIPT_HS,
  'jbnu-lang-grad': GRAD, 'jbnu-lang-transcript': TRANSCRIPT_LAST,
  'wku-ug-grad': GRAD, 'wku-ug-transcript': TRANSCRIPT_HS,
  'wku-lang-grad': GRAD, 'wku-lang-transcript': TRANSCRIPT_LAST,
  'jj-ug-grad': GRAD, 'jj-ug-transcript': TRANSCRIPT_HS
});
export const docCheckItems = (docId) => (Object.hasOwn(DOC_CHECKS, docId) ? DOC_CHECKS[docId] : null);
export const docCheckKind = (docId) => (docId.endsWith('-transcript') ? 'transcript' : 'grad');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fault = (code) => Object.assign(new Error(code), { code });
const plain = (v) => { if (v === null || typeof v !== 'object' || Array.isArray(v)) return false; const p = Object.getPrototypeOf(v); return p === null || Object.getPrototypeOf(p) === null; };
const exactKeys = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));

/** 요강 글을 점검 줄로. 문장마다 한 줄이고 글자는 바꾸지 않는다. */
export function sentences(text) {
  return String(text ?? '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}
/** 학생이 직접 확인할 줄: 그 서류의 날짜 조건 · 메모, 그 묶음의 규칙. 두 가지로 읽히는 곳(unclear)은 넣지 않는다. */
export function selfChecks(doc, rules, pick) {
  const own = [doc.when, doc.note].filter(Boolean).flatMap((t) => sentences(pick(t)));
  return { own, rules: (rules || []).flatMap((t) => sentences(pick(t))) };
}

/* ── 요청 몸 ── 앱은 보내기 전에, 서버는 받은 뒤에 같은 함수로 본다. 답이 줄 번호뿐이라 글의 언어는 가리지 않는다. */
export function validateDocCheckRequest(body) {
  const bad = () => { throw fault('INVALID_DOC_CHECK_REQUEST'); };
  if (!exactKeys(body, ['action', 'request_id', 'doc', 'lines', 'consent']) || body.action !== 'doc_check') bad();
  if (typeof body.request_id !== 'string' || !UUID_RE.test(body.request_id)) bad();
  if (typeof body.doc !== 'string' || !docCheckItems(body.doc)) bad();
  const c = body.consent;
  if (!exactKeys(c, ['v', 'age', 'guardian', 'lang']) || c.v !== DOC_CHECK_CONSENT_VERSION || !TRANSLATE_AGES.includes(c.age)
    || c.guardian !== (c.age === 'teen') || !TRANSLATE_LANGS.includes(c.lang)) bad();
  checkLines(body.lines, bad);
  return { action: 'doc_check', request_id: body.request_id.toLowerCase(), doc: body.doc, lines: [...body.lines], consent: { v: c.v, age: c.age, guardian: c.guardian, lang: c.lang } };
}

/* ── 모델 출력 ── 항목의 차례와 키가 같고, 줄 번호가 글 안에 있어야 한다. 어긋나면 null. */
function foundLines(list, count) {
  if (!Array.isArray(list) || list.length > MAX_LINES) return null;
  const seen = new Set();
  for (const n of list) { if (!Number.isInteger(n) || n < 0 || n >= count) return null; seen.add(n); }
  return [...seen].sort((a, b) => a - b).slice(0, MAX_FOUND_LINES);
}
export function checkDocCheckOutput(out, docId, count) {
  const items = docCheckItems(docId);
  if (!items || !exactKeys(out, ['items']) || !Array.isArray(out.items) || out.items.length !== items.length) return null;
  const found = [];
  for (const [i, entry] of out.items.entries()) {
    if (!exactKeys(entry, ['key', 'lines']) || entry.key !== items[i].key) return null;
    const lines = foundLines(entry.lines, count);
    if (!lines) return null;
    found.push({ key: entry.key, lines });
  }
  return found;
}

/* ── 답 ── 앱이 받은 뒤에 본다. status가 done이 아니면 items는 빈 배열이다. */
export function validateDocCheckReply(data, docId, count) {
  const bad = () => { throw fault('INVALID_DOC_CHECK_REPLY'); };
  if (!plain(data) || data.ok !== true || data.scope !== 'synk-path' || data.action !== 'doc_check' || typeof data.prompt !== 'string' || !DOC_CHECK_STATUSES.includes(data.status)
    || !(data.remaining === null || (Number.isSafeInteger(data.remaining) && data.remaining >= 0)) || !Array.isArray(data.items)) bad();
  if (data.status !== 'done') { if (data.items.length) bad(); return { status: data.status, remaining: data.remaining, prompt: data.prompt, items: [] }; }
  const items = checkDocCheckOutput({ items: data.items }, docId, count);
  if (!items) bad();
  return { status: 'done', remaining: data.remaining, prompt: data.prompt, items };
}

/** 화면에 보일 칸. 찾은 줄은 학생이 붙여 넣은 원문 그대로다(가린 번호를 되돌린 줄). */
export function docCheckRows(docId, found, shownLines) {
  return docCheckItems(docId).map((it, i) => ({ key: it.key, label: it.label, lines: (found?.[i]?.lines || []).map((n) => shownLines[n]).filter((t) => typeof t === 'string') }));
}
