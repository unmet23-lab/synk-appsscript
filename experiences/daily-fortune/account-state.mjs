import { validateDateKey, seoulDateKey, WESTERN_ZODIAC } from './core.mjs';

export const emptyState = () => ({ version: 1, profile: null, preferences: { mode: 'western', signId: null }, entries: [] });
const modes = new Set(['western', 'korean']);
const signs = new Set(WESTERN_ZODIAC.map(item => item.id));
const plain = (value, max) => typeof value === 'string' && [...value].length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const fail = () => { throw new Error('저장할 운세 정보의 형식을 확인해 주세요.'); };
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
export function validateState(value, today = seoulDateKey()) {
  if (!exact(value, ['version', 'profile', 'preferences', 'entries']) || value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 90) fail();
  if (!exact(value.preferences, ['mode', 'signId']) || !modes.has(value.preferences.mode) || value.preferences.signId !== null && !signs.has(value.preferences.signId)) fail();
  const ids = new Set();
  const entries = value.entries.map(entry => {
    if (!exact(entry, ['id', 'mode', 'date', 'signId', 'birth', 'title', 'action', 'note', 'completed', 'createdAt', 'updatedAt'])) fail();
    if (typeof entry.id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(entry.id) || ids.has(entry.id.toLowerCase())) fail();
    ids.add(entry.id.toLowerCase());validateDateKey(entry.date);
    if (entry.date < '1900-01-01' || entry.date > '2100-12-31') fail();
    if (!modes.has(entry.mode) || !plain(entry.title, 160) || !plain(entry.action, 400) || !plain(entry.note, 1000) || typeof entry.completed !== 'boolean') fail();
    for (const key of ['createdAt', 'updatedAt']) if (typeof entry[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry[key]) || !Number.isFinite(Date.parse(entry[key])) || new Date(entry[key]).toISOString() !== entry[key]) fail();
    if (entry.updatedAt < entry.createdAt) fail();
    const birth = profile(entry.birth, today);
    if (entry.mode === 'western' ? !signs.has(entry.signId) || birth !== null : entry.signId !== null || birth === null || birth.birthDate > entry.date) fail();
    return { ...entry, birth };
  });
  const result = { version: 1, profile: profile(value.profile, today), preferences: { ...value.preferences }, entries };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 60 * 1024) throw new Error('보관함 용량이 가득 찼어요. 내보낸 뒤 오래된 기록을 정리해 주세요.');
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
export function saveReading(state, result, { note = '', completed = false, now = new Date().toISOString(), id = crypto.randomUUID() } = {}) {
  const key = readingKey(result), previous = state.entries.find(item => entryKey(item) === key);
  if (!previous && state.entries.length >= 90) throw new Error('보관함에는 90개까지 담을 수 있어요. 내보낸 뒤 오래된 기록을 정리해 주세요.');
  const entry = { id: previous?.id || id, mode: result.mode, date: result.date, signId: result.mode === 'western' ? result.signId : null,
    birth: result.mode === 'korean' ? birthProfile(result.birthDate, result.birthTime) : null,
    title: result.title, action: result.action, note, completed, createdAt: previous?.createdAt || now, updatedAt: now };
  return validateState({ ...state, entries: [entry, ...state.entries.filter(item => item.id !== entry.id)] });
}
