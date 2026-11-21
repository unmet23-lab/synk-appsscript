// PATH 「내 조건」. 계정 문서와 섞지 않는다: 이 탭(sessionStorage)에만 두고 서버로 보내지 않는다.
import { MAX_TOPIK } from './study-data.mjs';

export const STUDY_KEY = 'synk-path-study-v1';
export const STUDY_VERSION = 1;
export const EDUCATION_IDS = Object.freeze(['graduated', 'expected', 'none']);
export const MAX_FUNDS_WON = 200000000;
export const MAX_COMPARE = 3;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
// 조건의 주인: 'guest' 또는 계정 ID. 공용 기기에서 앞 사람의 성적과 돈이 다음 사람에게 보이지 않게 한다.
export const GUEST_OWNER = 'guest';
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/;
const ownerOf = (v) => (typeof v === 'string' && OWNER_RE.test(v) ? v : null);

export function createProfile() {
  return { v: STUDY_VERSION, topik: null, gradePct: null, fundsWon: null, education: null, compare: [] };
}

/** 저장값을 고쳐 쓴다. 틀린 칸은 비우고, 꼴이 아예 다르면 빈 조건을 낸다. 던지지 않는다. */
export function normalizeProfile(raw) {
  const out = createProfile();
  if (!isObj(raw) || raw.v !== STUDY_VERSION) return out;
  if (intIn(raw.topik, 0, MAX_TOPIK)) out.topik = raw.topik;
  if (intIn(raw.gradePct, 0, 100)) out.gradePct = raw.gradePct;
  if (intIn(raw.fundsWon, 0, MAX_FUNDS_WON)) out.fundsWon = raw.fundsWon;
  if (EDUCATION_IDS.includes(raw.education)) out.education = raw.education;
  if (Array.isArray(raw.compare)) for (const id of raw.compare) {
    if (typeof id === 'string' && ID_RE.test(id) && !out.compare.includes(id) && out.compare.length < MAX_COMPARE) out.compare.push(id);
  }
  return out;
}

/** 한 칸을 바꾼 새 조건을 낸다. null은 「안 넣음」이다. 범위 밖이면 던진다. */
export function setField(profile, key, value) {
  const p = normalizeProfile(profile);
  if (key === 'topik') { if (!(value === null || intIn(value, 0, MAX_TOPIK))) throw new RangeError('topik'); p.topik = value; }
  else if (key === 'gradePct') { if (!(value === null || intIn(value, 0, 100))) throw new RangeError('gradePct'); p.gradePct = value; }
  else if (key === 'fundsWon') { if (!(value === null || intIn(value, 0, MAX_FUNDS_WON))) throw new RangeError('fundsWon'); p.fundsWon = value; }
  else if (key === 'education') { if (!(value === null || EDUCATION_IDS.includes(value))) throw new RangeError('education'); p.education = value; }
  else throw new RangeError('field');
  return p;
}

/** 비교에 담거나 뺀다. 셋을 넘겨 담으려 하면 그대로 돌려준다. */
export function toggleCompare(profile, id, knownIds) {
  const p = normalizeProfile(profile);
  if (typeof id !== 'string' || !ID_RE.test(id) || (knownIds && !knownIds.includes(id))) return p;
  const i = p.compare.indexOf(id);
  if (i >= 0) p.compare.splice(i, 1);
  else if (p.compare.length < MAX_COMPARE) p.compare.push(id);
  return p;
}

export function isEmptyProfile(profile) {
  const p = normalizeProfile(profile);
  return p.topik === null && p.gradePct === null && p.fundsWon === null && p.education === null;
}

/** 숫자 칸의 글을 정수로 읽는다. 빈 글은 null, 숫자가 아니거나 범위 밖이면 undefined(바꾸지 않는다). */
export function parseWhole(text, min, max) {
  const s = String(text ?? '').replace(/[\s,]/g, '');
  if (s === '') return null;
  if (!/^\d{1,12}$/.test(s)) return undefined;
  const n = Number(s);
  return n >= min && n <= max ? n : undefined;
}

/**
 * 저장소 한 겹. 저장이 막히면 메모리로만 기억하고 persisted()가 false가 된다
 * (성공한 것처럼 보이지 않게 화면이 이 값을 읽어 알린다).
 */
export function createProfileStore(storage) {
  let profile = createProfile(), persisted = true, owner = GUEST_OWNER;
  try {
    const raw = storage.getItem(STUDY_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      profile = normalizeProfile(saved);
      // 주인 표시가 깨졌으면 누구 것인지 알 수 없으니 버린다.
      const o = saved && typeof saved === 'object' ? ownerOf(saved.owner) : null;
      if (o) owner = o; else profile = createProfile();
    }
  } catch { persisted = false; }
  const hasData = () => !isEmptyProfile(profile) || profile.compare.length > 0;
  const write = () => {
    try {
      const raw = JSON.stringify({ ...profile, owner });
      storage.setItem(STUDY_KEY, raw);
      persisted = storage.getItem(STUDY_KEY) === raw;
    } catch { persisted = false; }
    return persisted;
  };
  return {
    get: () => normalizeProfile(profile),
    persisted: () => persisted,
    owner: () => owner,
    set(next) { profile = normalizeProfile(next); write(); return profile; },
    /** 주인을 바꾼다(손님이 넣은 조건을 로그인한 계정이 이어받을 때). 넣은 것이 없으면 저장소를 건드리지 않는다. */
    setOwner(next) { const o = ownerOf(next); if (!o || o === owner) return; owner = o; if (hasData()) write(); },
    clear() {
      profile = createProfile(); owner = GUEST_OWNER;
      try { storage.removeItem(STUDY_KEY); persisted = storage.getItem(STUDY_KEY) === null; } catch { persisted = false; }
      return persisted;
    }
  };
}
