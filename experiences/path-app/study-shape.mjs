// PATH 「내 조건」의 꼴과 계정의 유학 준비 문서(path-study) 검사기. 순수 자료만 둔다:
// 과정 자료(study-data.mjs)를 끌지 않아 브라우저(탭 저장 · 앱)와 서버 번들(SYNK-talk synk-path)이 같은 바이트를 쓴다.

export const MAX_TOPIK = 6;
export const EDUCATION_IDS = Object.freeze(['graduated', 'expected', 'none']);
export const MAX_FUNDS_WON = 200000000;
export const MAX_COMPARE = 3;
export const MAX_DATES = 30;
export const MAX_CHANNELS_OFF = 10;
export const MAX_DOCS = 60;
export const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const DATE_ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export const STUDY_SCHEMA = 'synk.path-study';
export const STUDY_DOCUMENT_VERSION = 1;
export const STUDY_RESOURCE = 'path-study';
/** 동의 문장의 판. 화면의 동의 문장을 바꾸면 올리고, 앱은 낮은 판으로 동의한 사람에게 다시 묻는다. */
export const CONSENT_VERSION = 1;
/** 서버가 받는 가장 낮은 동의 판. 판을 올려 옛 동의를 더 받지 않을 때 함께 올린다(서버를 먼저 올린다). */
export const MIN_CONSENT_VERSION = 1;
export const CONSENT_LANGS = Object.freeze(['ko', 'en', 'mn']);
export const MAX_STUDY_DOCUMENT_BYTES = 64 * 1024;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => isObj(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
export const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
export const isStamp = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v));
const fail = (code = 'INVALID_PATH_STUDY') => { throw Object.assign(new TypeError(code), { code }); };
const PROFILE_KEYS = ['topik', 'gradePct', 'fundsWon', 'education', 'compare', 'dates', 'channelsOff', 'target', 'docs'];

/** 같은 값이 없고 한도 안이며 모두 맞는 목록인지. */
const uniqueBy = (list, max, valid, key = (x) => x) => Array.isArray(list) && list.length <= max && list.every(valid) && new Set(list.map(key)).size === list.length;

/** 동의 전 계정의 빈 상태(동기화 엔진의 emptyState). 앱만 쓴다: 서버는 동의 없는 저장을 받지 않는다. */
export function emptyStudyDocument() {
  return { schema: STUDY_SCHEMA, version: STUDY_DOCUMENT_VERSION, consent: null,
    profile: { topik: null, gradePct: null, fundsWon: null, education: null, compare: [], dates: [], channelsOff: [], target: null, docs: [] } };
}

/**
 * 계정의 유학 준비 문서를 검사하고 정한 키 순서로 새로 지어 돌려준다(저장소가 jsonb라 키 순서가 바뀌고,
 * 응답 유실 재확인과 앱의 비교가 문자열로 견준다). 고쳐 읽지 않는다: 하나라도 틀리면 던진다.
 */
export function validateStudyDocument(raw, { allowEmpty = false } = {}) {
  let bytes;
  try { bytes = new TextEncoder().encode(JSON.stringify(raw)).byteLength; } catch { fail(); }
  if (bytes > MAX_STUDY_DOCUMENT_BYTES) fail('PATH_STUDY_TOO_LARGE');
  if (!exact(raw, ['schema', 'version', 'consent', 'profile']) || raw.schema !== STUDY_SCHEMA || raw.version !== STUDY_DOCUMENT_VERSION) fail();
  const c = raw.consent, p = raw.profile;
  if (c === null) {
    // 빈 상태는 앱의 동기화 엔진에서만: 동의가 없으면 profile도 비어 있어야 한다.
    if (!allowEmpty || JSON.stringify(p) !== JSON.stringify(emptyStudyDocument().profile)) fail();
    return emptyStudyDocument();
  }
  // 18세 미만이면 보호자 확인이 있어야 한다. 18세 이상이면 보호자 칸은 false다.
  if (!exact(c, ['v', 'at', 'minor', 'guardian', 'lang']) || !intIn(c.v, MIN_CONSENT_VERSION, CONSENT_VERSION) || !isStamp(c.at)
    || typeof c.minor !== 'boolean' || c.guardian !== c.minor || !CONSENT_LANGS.includes(c.lang)) fail();
  if (!exact(p, PROFILE_KEYS)) fail();
  const nullOr = (v, ok) => v === null || ok(v);
  if (!nullOr(p.topik, (v) => intIn(v, 0, MAX_TOPIK)) || !nullOr(p.gradePct, (v) => intIn(v, 0, 100))
    || !nullOr(p.fundsWon, (v) => intIn(v, 0, MAX_FUNDS_WON)) || !nullOr(p.education, (v) => EDUCATION_IDS.includes(v))
    || !nullOr(p.target, (v) => typeof v === 'string' && ID_RE.test(v))) fail();
  const isId = (v) => typeof v === 'string' && ID_RE.test(v);
  if (!uniqueBy(p.compare, MAX_COMPARE, isId) || !uniqueBy(p.channelsOff, MAX_CHANNELS_OFF, isId)) fail();
  const okDate = (d) => exact(d, ['id', 'start', 'end']) && typeof d.id === 'string' && DATE_ID_RE.test(d.id) && isDay(d.start) && isDay(d.end) && d.end >= d.start;
  if (!uniqueBy(p.dates, MAX_DATES, okDate, (d) => d.id)) fail();
  const okDoc = (d) => exact(d, ['id', 'doneAt']) && isId(d.id) && isStamp(d.doneAt);
  if (!uniqueBy(p.docs, MAX_DOCS, okDoc, (d) => d.id)) fail();
  return {
    schema: STUDY_SCHEMA, version: STUDY_DOCUMENT_VERSION,
    consent: { v: c.v, at: c.at, minor: c.minor, guardian: c.guardian, lang: c.lang },
    profile: {
      topik: p.topik, gradePct: p.gradePct, fundsWon: p.fundsWon, education: p.education,
      compare: [...p.compare],
      dates: p.dates.map((d) => ({ id: d.id, start: d.start, end: d.end })),
      channelsOff: [...p.channelsOff],
      target: p.target,
      docs: p.docs.map((d) => ({ id: d.id, doneAt: d.doneAt }))
    }
  };
}

/** 탭 저장의 조건(normalizeProfile을 거친 값)과 동의로 문서를 짓는다. 틀리면 던진다. */
export function createStudyDocument(profile, consent) {
  const p = isObj(profile) ? profile : {};
  return validateStudyDocument({
    schema: STUDY_SCHEMA, version: STUDY_DOCUMENT_VERSION,
    consent: { v: consent?.v, at: consent?.at, minor: consent?.minor, guardian: consent?.guardian, lang: consent?.lang },
    profile: Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k]]))
  });
}
