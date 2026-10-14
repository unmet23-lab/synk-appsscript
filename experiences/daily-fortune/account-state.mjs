import { validateDateKey, seoulDateKey, WESTERN_ZODIAC } from './core.mjs';

// 계정 저장 형식 v2. v1 문서는 그대로 읽고(읽을 때 v2로 올림) 새로 만드는 문서는 언제나 v2다.
// v2에서 바뀐 점: 기록마다 verdict(맞았는지 표시), 최상위 people(가족·친구 최대 12명).
// 운영 서버 검증기(SYNK-talk lib/fortune-rules.js)는 이 규칙을 손으로 옮긴 사본이다. 규칙을 바꾸면 그쪽도 함께 바꾼다.
export const STATE_VERSION = 2;
export const MAX_ENTRIES = 90;
export const MAX_PEOPLE = 12;
export const MAX_STATE_BYTES = 60 * 1024;
export const VERDICTS = Object.freeze(['hit', 'meh', 'miss']);
export const VERDICT_LABELS = Object.freeze({ hit: '맞았어요', meh: '글쎄요', miss: '아니었어요' });
export const RELATIONS = Object.freeze(['family', 'friend', 'partner', 'work', 'other']);
export const RELATION_LABELS = Object.freeze({ family: '가족', friend: '친구', partner: '연인·배우자', work: '동료', other: '그 밖' });

export const emptyState = () => ({ version: 2, profile: null, preferences: { mode: 'western', signId: null }, entries: [], people: [] });
const modes = new Set(['western', 'korean']);
const signs = new Set(WESTERN_ZODIAC.map(item => item.id));
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const V1_ENTRY_KEYS = ['id', 'mode', 'date', 'signId', 'birth', 'title', 'action', 'note', 'completed', 'createdAt', 'updatedAt'];
const V2_ENTRY_KEYS = ['id', 'mode', 'date', 'signId', 'birth', 'title', 'action', 'note', 'completed', 'verdict', 'createdAt', 'updatedAt'];
const PERSON_KEYS = ['id', 'name', 'relation', 'birthDate', 'birthTime'];
const plain = (value, max) => typeof value === 'string' && [...value].length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const personName = value => typeof value === 'string' && value === value.trim() && [...value].length >= 1 && [...value].length <= 20 && !/[\u0000-\u001f\u007f]/u.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const fail = () => { throw new Error('저장할 운세 정보의 형식을 확인해 주세요.'); };
const full = () => { throw new Error('보관함 용량이 가득 찼어요. 내보낸 뒤 오래된 기록을 정리해 주세요.'); };
export function birthProfile(birthDate, birthTime = null, today = seoulDateKey()) {
  validateDateKey(birthDate);
  if (birthDate < '1900-01-01' || birthDate > today || birthDate > '2100-12-31') fail();
  if (birthTime !== null && (typeof birthTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(birthTime))) fail();
  return { birthDate, birthTime, calendar: 'solar', timeZone: 'Asia/Seoul' };
}
function profile(value, today) {
  if (value === null) return null;
  if (!exact(value, ['birthDate', 'birthTime', 'calendar', 'timeZone']) || value.calendar !== 'solar' || value.timeZone !== 'Asia/Seoul') fail();
  return birthProfile(value.birthDate, value.birthTime, today);
}
function readEntry(entry, version, ids, today) {
  if (!exact(entry, version === 1 ? V1_ENTRY_KEYS : V2_ENTRY_KEYS)) fail();
  if (typeof entry.id !== 'string' || !UUID.test(entry.id) || ids.has(entry.id.toLowerCase())) fail();
  ids.add(entry.id.toLowerCase());validateDateKey(entry.date);
  if (entry.date < '1900-01-01' || entry.date > '2100-12-31') fail();
  if (!modes.has(entry.mode) || !plain(entry.title, 160) || !plain(entry.action, 400) || !plain(entry.note, 1000) || typeof entry.completed !== 'boolean') fail();
  const verdict = version === 1 ? null : entry.verdict;
  if (verdict !== null && !VERDICTS.includes(verdict)) fail();
  for (const key of ['createdAt', 'updatedAt']) if (typeof entry[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry[key]) || !Number.isFinite(Date.parse(entry[key])) || new Date(entry[key]).toISOString() !== entry[key]) fail();
  if (entry.updatedAt < entry.createdAt) fail();
  const birth = profile(entry.birth, today);
  if (entry.mode === 'western' ? !signs.has(entry.signId) || birth !== null : entry.signId !== null || birth === null || birth.birthDate > entry.date) fail();
  return { id: entry.id, mode: entry.mode, date: entry.date, signId: entry.signId, birth, title: entry.title, action: entry.action,
    note: entry.note, completed: entry.completed, verdict, createdAt: entry.createdAt, updatedAt: entry.updatedAt };
}
function readPerson(value, ids, today) {
  if (!exact(value, PERSON_KEYS)) fail();
  if (typeof value.id !== 'string' || !UUID.test(value.id) || ids.has(value.id.toLowerCase())) fail();
  ids.add(value.id.toLowerCase());
  if (!personName(value.name) || !RELATIONS.includes(value.relation) || value.birthTime !== null && typeof value.birthTime !== 'string') fail();
  const birth = birthProfile(value.birthDate, value.birthTime, today);
  return { id: value.id, name: value.name, relation: value.relation, birthDate: birth.birthDate, birthTime: birth.birthTime };
}
export function validateState(value, today = seoulDateKey()) {
  const version = value && typeof value === 'object' ? value.version : undefined;
  if (version === 1 ? !exact(value, ['version', 'profile', 'preferences', 'entries'])
    : version === 2 ? !exact(value, ['version', 'profile', 'preferences', 'entries', 'people']) : true) fail();
  if (!Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES) fail();
  if (version === 2 && (!Array.isArray(value.people) || value.people.length > MAX_PEOPLE)) fail();
  if (!exact(value.preferences, ['mode', 'signId']) || !modes.has(value.preferences.mode) || value.preferences.signId !== null && !signs.has(value.preferences.signId)) fail();
  const entryIds = new Set(), personIds = new Set();
  const entries = value.entries.map(entry => readEntry(entry, version, entryIds, today));
  const people = version === 2 ? value.people.map(person => readPerson(person, personIds, today)) : [];
  const result = { version: 2, profile: profile(value.profile, today), preferences: { mode: value.preferences.mode, signId: value.preferences.signId }, entries, people };
  // 용량은 들어온 문서의 판으로 잰다. 한도 가까운 v1 문서도 읽을 수 있게 하고, v2로 다시 저장할 때 v2 기준을 적용한다.
  const measured = version === 1
    ? { version: 1, profile: result.profile, preferences: result.preferences, entries: entries.map(({ verdict, ...entry }) => entry) }
    : result;
  if (bytes(measured) > MAX_STATE_BYTES) full();
  return result;
}
export function readingKey(result) {
  return result.mode === 'korean' ? `korean:${result.date}:${result.birthDate}:${result.birthTime ?? '?'}` : `western:${result.date}:${result.signId}`;
}
export function entryKey(entry) {
  return entry.mode === 'korean' ? `korean:${entry.date}:${entry.birth.birthDate}:${entry.birth.birthTime ?? '?'}` : `western:${entry.date}:${entry.signId}`;
}
export function recentReflections(state, today = seoulDateKey()) {
  validateDateKey(today);
  // Entries belong to their reading date, not the later time they were saved or
  // edited. Date-key arithmetic must also stay independent of the host timezone.
  const entries = validateState(state, today).entries;
  const midnight = Date.parse(`${today}T00:00:00Z`);
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(midnight - offset * 86_400_000).toISOString().slice(0, 10);
    return { date, entries: entries.filter(entry => entry.date === date && (entry.completed || entry.note.trim()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)) };
  });
  return { startDate: days[6].date, endDate: today, days };
}
/**
 * 결과를 보관함에 저장한다. 같은 읽을거리(readingKey)를 다시 저장하면 ID·생성 시각·verdict를 지킨다.
 * result는 기존 결과(title·action) 또는 오늘 카드(headline·do) 모두 받는다. verdict를 넘기면 그 값으로 바꾼다.
 */
export function saveReading(state, result, { note = '', completed = false, verdict, now = new Date().toISOString(), id = crypto.randomUUID() } = {}) {
  const base = validateState(state);
  const key = readingKey(result), previous = base.entries.find(item => entryKey(item) === key);
  if (!previous && base.entries.length >= MAX_ENTRIES) throw new Error('보관함에는 90개까지 담을 수 있어요. 내보낸 뒤 오래된 기록을 정리해 주세요.');
  const entry = { id: previous?.id || id, mode: result.mode, date: result.date, signId: result.mode === 'western' ? result.signId : null,
    birth: result.mode === 'korean' ? birthProfile(result.birthDate, result.birthTime) : null,
    title: result.title ?? result.headline, action: result.action ?? result.do, note, completed,
    verdict: verdict === undefined ? previous?.verdict ?? null : verdict,
    createdAt: previous?.createdAt || now, updatedAt: now };
  return validateState({ ...base, entries: [entry, ...base.entries.filter(item => item.id !== entry.id)] });
}
/** 기록에 「맞았어요/글쎄요/아니었어요」를 표시한다. null이면 표시를 지운다. 기록의 자리는 그대로 둔다. */
export function setVerdict(state, entryId, verdict, { now = new Date().toISOString() } = {}) {
  if (verdict !== null && !VERDICTS.includes(verdict)) throw new TypeError('맞았어요·글쎄요·아니었어요 중에서 골라 주세요.');
  const base = validateState(state);
  const target = typeof entryId === 'string' ? entryId.toLowerCase() : '';
  const index = base.entries.findIndex(item => item.id.toLowerCase() === target);
  if (index < 0) throw new Error('표시할 기록을 찾지 못했어요.');
  const current = base.entries[index];
  const updatedAt = now > current.updatedAt ? now : current.updatedAt;
  return validateState({ ...base, entries: base.entries.map((item, at) => at === index ? { ...item, verdict, updatedAt } : item) });
}
/**
 * 가족·친구 한 사람을 추가하거나(id 없음) 고친다(id 있음). 이름은 앞뒤 빈칸을 지우고 1~20자, 시간 모름은 null.
 */
export function savePerson(state, person, { id = crypto.randomUUID(), today = seoulDateKey() } = {}) {
  if (!person || typeof person !== 'object' || Array.isArray(person)) throw new TypeError('저장할 사람 정보를 확인해 주세요.');
  const base = validateState(state, today);
  const name = typeof person.name === 'string' ? person.name.trim() : person.name;
  if (!personName(name)) throw new TypeError('이름은 1~20자로 적어 주세요.');
  if (!RELATIONS.includes(person.relation)) throw new TypeError('관계를 골라 주세요.');
  const birthTime = person.birthTime === undefined || person.birthTime === '' ? null : person.birthTime;
  birthProfile(person.birthDate, birthTime, today);
  let previous = null;
  if (person.id !== undefined && person.id !== null) {
    previous = base.people.find(item => typeof person.id === 'string' && item.id.toLowerCase() === person.id.toLowerCase());
    if (!previous) throw new Error('고칠 사람을 찾지 못했어요.');
  } else if (base.people.length >= MAX_PEOPLE) throw new Error('사람은 12명까지 저장할 수 있어요. 한 명을 지운 뒤 다시 저장해 주세요.');
  const next = { id: previous?.id || id, name, relation: person.relation, birthDate: person.birthDate, birthTime };
  const people = previous ? base.people.map(item => item.id === previous.id ? next : item) : [...base.people, next];
  return validateState({ ...base, people }, today);
}
/** 사람 한 명을 지운다. 없는 ID면 그대로 돌려준다. */
export function removePerson(state, personId, { today = seoulDateKey() } = {}) {
  const base = validateState(state, today);
  const target = typeof personId === 'string' ? personId.toLowerCase() : '';
  return validateState({ ...base, people: base.people.filter(item => item.id.toLowerCase() !== target) }, today);
}
