// PATH 「서류 번역 초안」의 꼴. 순수 자료와 함수만 둔다:
// 브라우저(앱)와 서버 번들(SYNK-talk synk-path)이 같은 바이트로 요청 몸 · 모델 출력 · 답을 검사한다.
// 학생 서류의 글은 어디에도 저장하지 않는다. 이 파일은 글을 받아 검사하고 가리고 견주기만 한다.

/** 번역 초안을 만들 수 있는 서류 종류(첫 판은 졸업 · 성적증명서만). docs-data.mjs의 서류 줄이 `translate`로 가리킨다. */
export const TRANSLATE_KINDS = Object.freeze(['grad', 'transcript']);
export const TRANSLATE_PROMPT_VERSION = 'path-translate-v1';
/** 동의 문장의 판. 화면의 번역 동의 문장을 바꾸면 올린다. 서버는 이 판만 받는다. */
export const TRANSLATE_CONSENT_VERSION = 1;
export const TRANSLATE_LANGS = Object.freeze(['ko', 'en', 'mn']);
/** 나이: adult 만 18세 이상, teen 만 14~17세(보호자 확인을 더 받는다). 만 14세 미만은 앱이 보내지 않는다. */
export const TRANSLATE_AGES = Object.freeze(['adult', 'teen']);
export const MAX_LINES = 80;
export const MAX_LINE_CHARS = 300;
export const MAX_TOTAL_CHARS = 4000;
export const MIN_TOTAL_CHARS = 20;
export const MIN_CYRILLIC_SHARE = 0.4;
export const MAX_OUT_CHARS = 1200;
/** 번역 모델이 줄에 다는 표시. name은 판정과 상관없이 「여권 영문 철자로 맞추세요」를 늘 붙인다. */
export const FLAGS = Object.freeze(['name', 'school', 'grade', 'term', 'none']);
export const VERDICTS = Object.freeze(['same', 'differs', 'unsure']);
export const REASONS = Object.freeze(['meaning', 'missing', 'added', 'term', 'none']);
export const STATUSES = Object.freeze(['done', 'refused', 'limit', 'busy', 'unavailable', 'done_before']);
export const MAX_REQUEST_BYTES = 64 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fault = (code) => Object.assign(new Error(code), { code });
// 평범한 객체(JSON에서 온 것). 다른 실행 영역(iframe · vm)에서 만든 객체도 받도록 원형의 원형이 null인지로 본다.
const plain = (v) => { if (v === null || typeof v !== 'object' || Array.isArray(v)) return false; const p = Object.getPrototypeOf(v); return p === null || Object.getPrototypeOf(p) === null; };
const exactKeys = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const chars = (s) => [...s].length;
// 줄에 남기지 않는 글자: 제어 문자, 폭 없는 글자, 양방향 덮어쓰기. 화면에 안 보이는 글자로 지시를 숨기지 못하게 한다.
const HIDDEN_SRC = '[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF]';
const hasHidden = (s) => new RegExp(HIDDEN_SRC).test(s);

/* ── 등록번호 가리기 ──
 * 몽골 주민등록번호(регистрийн дугаар): 글자 두 자 + 숫자 여덟 자. 키릴 대소문자와 Ө · Ү · Ё, 글자 인식이 내는 모양이 같은 라틴 글자,
 * 글자와 숫자 사이의 빈칸 · 줄표를 받는다. 앞뒤가 다른 글자나 숫자에 붙어 있으면 번호로 보지 않는다.
 * 자리표는 언어에 매이지 않는 번호 토큰(⟦R1⟧ …)이다. ⟦R0⟧은 서버가 찾은 번호(되돌릴 값이 없다). */
const RD_LETTER = '[А-ЯЁӨҮа-яёөүABCEHKMOPTXYaceopxy]';
const RD_SRC = `(?<![\\p{L}\\p{N}⟦])(${RD_LETTER}{2})[\\s-]?(\\d{8})(?![\\p{N}⟧])`;
const rdRe = () => new RegExp(RD_SRC, 'gu');
const TOKEN_RE = () => /⟦R(\d{1,3})⟧/g;
export const token = (n) => `⟦R${n}⟧`;
export const SERVER_TOKEN = token(0);
// 모양이 같은 라틴 글자를 키릴로 바꿔 같은 번호를 하나로 센다(Y는 Ү와 У 둘 다일 수 있어 У로 둔다).
const LATIN_TO_CYR = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' };
const canonRd = (letters, digits) => [...letters.toUpperCase()].map((c) => LATIN_TO_CYR[c] || c).join('') + digits;

/** 보내기 전에 등록번호를 ⟦R1⟧, ⟦R2⟧ … 로 바꾼다. 같은 번호는 같은 토큰이다. slots[n-1]이 원문에 적힌 그대로의 값이다. */
export function maskLines(lines) {
  const keys = [], slots = [];
  const masked = lines.map((line) => line.replace(rdRe(), (whole, letters, digits) => {
    const key = canonRd(letters, digits);
    let n = keys.indexOf(key) + 1;
    if (!n) { keys.push(key); slots.push(whole); n = keys.length; }
    return token(n);
  }));
  return { lines: masked, slots };
}
/** 서버의 다시 가리기: 앱이 놓친 번호를 ⟦R0⟧로 바꾼다. */
export const serverMask = (lines) => lines.map((line) => line.replace(rdRe(), SERVER_TOKEN));
/** 줄 안의 토큰 모음(정렬). 모델 출력의 줄과 원문 줄을 견준다. */
export const tokensOf = (text) => [...String(text ?? '').matchAll(TOKEN_RE())].map((m) => m[0]).sort();
export const sameTokens = (a, b) => { const x = tokensOf(a), y = tokensOf(b); return x.length === y.length && x.every((t, i) => t === y[i]); };
/** 토큰을 원래 값으로 되돌린다. ⟦R0⟧과 모르는 번호는 hidden(화면 언어의 「가린 번호」)으로 둔다. */
export function restoreTokens(text, slots, hidden) {
  return String(text ?? '').replace(TOKEN_RE(), (whole, n) => {
    const i = Number(n) - 1;
    return i >= 0 && i < slots.length ? slots[i] : hidden;
  });
}

/* ── 숫자 대조 ── 원문의 몽골어 서수 · 로마 숫자를 숫자로 바꾼 뒤, 두 줄의 숫자 모음이 같은지 본다(차례 · 앞의 0은 보지 않는다). */
const MN_ORDINALS = [
  ['арван нэгдүгээр', 11], ['арван хоёрдугаар', 12], ['нэгдүгээр', 1], ['хоёрдугаар', 2], ['гуравдугаар', 3], ['дөрөвдүгээр', 4],
  ['тавдугаар', 5], ['зургадугаар', 6], ['долдугаар', 7], ['наймдугаар', 8], ['есдүгээр', 9], ['аравдугаар', 10]
];
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
function numberize(text) {
  let s = String(text ?? '').replace(TOKEN_RE(), ' ').toLowerCase();
  for (const [word, n] of MN_ORDINALS) s = s.split(word).join(` ${n} `);
  return s.replace(/(?<![\p{L}\p{N}])(XII|XI|IX|X|VIII|VII|VI|IV|V|III|II|I)(?![\p{L}\p{N}])/giu, (m) => ` ${ROMAN[m.toUpperCase()]} `);
}
export function digitSet(text) {
  return new Set((numberize(text).match(/\d+/g) || []).map((d) => d.replace(/^0+(?=\d)/, '')));
}
export function sameNumbers(source, draft) {
  const a = digitSet(source), b = digitSet(draft);
  return a.size === b.size && [...a].every((v) => b.has(v));
}

/** 역번역 전에 초안에서 괄호 속 키릴 원문(이름 원문 같은)을 뺀다 — 제미나이가 베껴 이름이 「같음」으로 보이지 않게. */
export const stripOriginals = (text) => String(text ?? '').replace(/\s*[(（][^()（）]*\p{Script=Cyrillic}[^()（）]*[)）]/gu, '').trim();

/* ── 붙여 넣기 ── */
/** 붙여 넣은 글을 줄 배열로. 빈 줄은 뺀다. 한도를 넘거나 몽골어가 아니면 { error }(던지지 않는다 — 화면이 안내한다). */
export function splitPasted(text) {
  const raw = String(text ?? '').normalize('NFC').replace(/\r\n?/g, '\n');
  const lines = raw.split('\n').map((l) => l.replace(new RegExp(HIDDEN_SRC, 'g'), '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!lines.length) return { error: 'empty', lines: [] };
  if (lines.length > MAX_LINES) return { error: 'lines', lines };
  if (lines.some((l) => chars(l) > MAX_LINE_CHARS)) return { error: 'line', lines };
  const total = lines.reduce((n, l) => n + chars(l), 0);
  if (total > MAX_TOTAL_CHARS) return { error: 'total', lines };
  if (total < MIN_TOTAL_CHARS) return { error: 'short', lines };
  if (!mongolianEnough(lines)) return { error: 'language', lines };
  return { error: null, lines };
}
/** 글자(토큰 밖) 가운데 키릴의 몫이 40% 이상인가. 번역 창구를 일반 모델 창구로 쓰는 것을 줄인다. */
export function mongolianEnough(lines) {
  const text = lines.join(' ').replace(TOKEN_RE(), ' ');
  const letters = text.match(/\p{L}/gu) || [];
  const cyr = text.match(/\p{Script=Cyrillic}/gu) || [];
  return letters.length > 0 && cyr.length / letters.length >= MIN_CYRILLIC_SHARE;
}

/* ── 요청 몸 ── 앱은 보내기 전에, 서버는 받은 뒤에 같은 함수로 본다. 정한 꼴과 다르면 code를 단 오류를 던진다. */
function checkLines(lines, bad) {
  if (!Array.isArray(lines) || !lines.length || lines.length > MAX_LINES) bad();
  let total = 0;
  for (const line of lines) {
    if (typeof line !== 'string' || !line || line !== line.trim() || line !== line.normalize('NFC') || /\s{2,}|\n/.test(line) || hasHidden(line)) bad();
    const n = chars(line);
    if (n > MAX_LINE_CHARS) bad();
    total += n;
  }
  if (total > MAX_TOTAL_CHARS || total < MIN_TOTAL_CHARS) bad();
}
export function validateTranslateRequest(body) {
  const bad = () => { throw fault('INVALID_TRANSLATE_REQUEST'); };
  const check = plain(body) && body.action === 'check';
  if (!exactKeys(body, check ? ['action', 'request_id', 'kind', 'lines', 'drafts', 'consent'] : ['action', 'request_id', 'kind', 'lines', 'consent'])) bad();
  if (!['translate', 'check'].includes(body.action)) bad();
  if (typeof body.request_id !== 'string' || !UUID_RE.test(body.request_id)) bad();
  if (!TRANSLATE_KINDS.includes(body.kind)) bad();
  const c = body.consent;
  if (!exactKeys(c, ['v', 'age', 'guardian', 'lang']) || c.v !== TRANSLATE_CONSENT_VERSION || !TRANSLATE_AGES.includes(c.age)
    || c.guardian !== (c.age === 'teen') || !TRANSLATE_LANGS.includes(c.lang)) bad();
  checkLines(body.lines, bad);
  if (!mongolianEnough(body.lines)) throw fault('NOT_MONGOLIAN');
  if (check) {
    if (!Array.isArray(body.drafts) || body.drafts.length !== body.lines.length) bad();
    for (const d of body.drafts) if (typeof d !== 'string' || !d.trim() || chars(d) > MAX_OUT_CHARS || hasHidden(d) || /\n/.test(d)) bad();
  }
  return { action: body.action, request_id: body.request_id.toLowerCase(), kind: body.kind, lines: [...body.lines],
    ...(check ? { drafts: [...body.drafts] } : {}), consent: { v: c.v, age: c.age, guardian: c.guardian, lang: c.lang } };
}

/* ── 모델 출력 ── 서버가 모델의 구조화 출력을 검사한다. 어긋나면 null(고쳐 부르지 않고 실패로 닫는다). */
// 길이 상한: 몽골어 → 한국어는 원문의 4배(최소 40자), 한국어 → 몽골어 역번역은 초안의 8배(최소 80자. 한글 한 자가 키릴 몇 자로 늘어난다).
const outLimit = (source) => Math.min(MAX_OUT_CHARS, Math.max(40, chars(source) * 4));
const backLimit = (draft) => Math.min(MAX_OUT_CHARS, Math.max(80, chars(draft) * 8));
function sameIndexes(list, n) { return Array.isArray(list) && list.length === n && list.every((l, i) => plain(l) && l.i === i); }
export function checkTranslationOutput(out, sources) {
  if (!plain(out) || !sameIndexes(out.lines, sources.length)) return null;
  const lines = [];
  for (const [i, l] of out.lines.entries()) {
    if (!exactKeys(l, ['i', 'ko', 'flag']) || typeof l.ko !== 'string' || !l.ko.trim() || chars(l.ko) > outLimit(sources[i]) || /\n/.test(l.ko) || hasHidden(l.ko) || !FLAGS.includes(l.flag)) return null;
    lines.push({ i, ko: l.ko.trim(), flag: l.flag });
  }
  return lines;
}
export function checkBackOutput(out, drafts) {
  if (!plain(out) || !sameIndexes(out.lines, drafts.length)) return null;
  const lines = [];
  for (const [i, l] of out.lines.entries()) {
    if (!exactKeys(l, ['i', 'mn']) || typeof l.mn !== 'string' || !l.mn.trim() || chars(l.mn) > backLimit(drafts[i]) || /\n/.test(l.mn) || hasHidden(l.mn)) return null;
    lines.push({ i, mn: l.mn.trim() });
  }
  return lines;
}
export function checkCompareOutput(out, n) {
  if (!plain(out) || !sameIndexes(out.lines, n)) return null;
  const lines = [];
  for (const [i, l] of out.lines.entries()) {
    if (!exactKeys(l, ['i', 'verdict', 'reason']) || !VERDICTS.includes(l.verdict) || !REASONS.includes(l.reason)) return null;
    lines.push({ i, verdict: l.verdict, reason: l.verdict === 'same' ? 'none' : l.reason });
  }
  return lines;
}

/* ── 답 ── 앱이 받은 뒤에 본다. status가 done이 아니면 lines는 빈 배열이다. */
function replyHead(data, action, bad) {
  if (!plain(data) || data.ok !== true || data.scope !== 'synk-path' || data.action !== action || typeof data.prompt !== 'string' || !STATUSES.includes(data.status)
    || !(data.remaining === null || (Number.isSafeInteger(data.remaining) && data.remaining >= 0)) || !Array.isArray(data.lines)) bad();
  if (data.status !== 'done' && data.lines.length) bad();
}
export function validateTranslateReply(data, count) {
  const bad = () => { throw fault('INVALID_TRANSLATE_REPLY'); };
  replyHead(data, 'translate', bad);
  if (data.status === 'done' && data.lines.length !== count) bad();
  const lines = data.lines.map((l, i) => {
    if (!exactKeys(l, ['i', 'ko', 'flag']) || l.i !== i || typeof l.ko !== 'string' || !l.ko || chars(l.ko) > MAX_OUT_CHARS || !FLAGS.includes(l.flag)) bad();
    return { i, ko: l.ko, flag: l.flag };
  });
  return { status: data.status, remaining: data.remaining, prompt: data.prompt, lines };
}
export function validateCheckReply(data, count) {
  const bad = () => { throw fault('INVALID_TRANSLATE_REPLY'); };
  replyHead(data, 'check', bad);
  if (data.status === 'done' && (data.lines.length !== count || typeof data.compared !== 'boolean')) bad();
  const compared = data.status === 'done' && data.compared === true;
  const lines = data.lines.map((l, i) => {
    if (!exactKeys(l, ['i', 'back', 'verdict', 'reason']) || l.i !== i || typeof l.back !== 'string' || !l.back || chars(l.back) > MAX_OUT_CHARS
      || !VERDICTS.includes(l.verdict) || !REASONS.includes(l.reason)) bad();
    // 대조를 못 한 답의 줄 판정(unsure)은 화면에 걸린 줄로 세지 않는다.
    return { i, back: l.back, verdict: compared ? l.verdict : 'same', reason: compared ? l.reason : 'none' };
  });
  return { status: data.status, remaining: data.remaining, prompt: data.prompt, compared, lines };
}

/**
 * 화면에 보일 줄. source는 보낸(가린) 원문 줄, drafts는 번역 답의 줄, checks는 대조 답의 줄(없으면 null), slots는 maskLines의 값.
 * 까닭: numbers(숫자가 다름) · id(등록번호 토큰이 어긋나 되돌리지 않음) · name · term(번역 모델 표시) · differs · unsure(대조).
 */
export function draftRows(source, drafts, checks, slots, hidden) {
  return drafts.map((d, i) => {
    const idOk = sameTokens(source[i], d.ko);
    const reasons = [];
    if (!idOk) reasons.push('id');
    if (!sameNumbers(source[i], d.ko)) reasons.push('numbers');
    if (d.flag === 'name') reasons.push('name');
    else if (d.flag !== 'none') reasons.push('term');
    const c = checks ? checks[i] : null;
    if (c && c.verdict !== 'same') reasons.push(c.verdict);
    return {
      i, source: restoreTokens(source[i], slots, hidden),
      ko: idOk ? restoreTokens(d.ko, slots, hidden) : restoreTokens(d.ko, [], hidden),
      back: c ? restoreTokens(c.back, slots, hidden) : null,
      flag: d.flag, verdict: c ? c.verdict : null, reason: c ? c.reason : null, reasons
    };
  });
}
