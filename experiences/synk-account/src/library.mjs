import { APPLICATIONS } from './applications.mjs';
export const LIBRARY_KEY = 'synk.platform.device-library.v1';
const ids = new Set(APPLICATIONS.map(app => app.id));
const unique = list => [...new Set(Array.isArray(list) ? list.filter(id => ids.has(id)) : [])];
export function normalizeLibrary(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  return { version: 1, saved: unique(raw.saved), favorites: unique(raw.favorites).filter(id => unique(raw.saved).includes(id)),
    recent: Array.isArray(raw.recent) ? raw.recent.filter(item => item && ids.has(item.id) && Number.isFinite(item.at) && item.at > 0 && ['web', 'client'].includes(item.mode)).sort((a,b) => b.at-a.at).filter((item,index,list) => list.findIndex(other => other.id === item.id) === index).slice(0, 2).map(({ id, at, mode }) => ({ id, at, mode })) : [],
    rememberRecent: raw.rememberRecent !== false, compact: raw.compact === true,
    collections: { learn: unique(raw.collections?.learn), work: unique(raw.collections?.work) } };
}
export function updateLibrary(state, action, now = Date.now()) {
  const next = normalizeLibrary(state), id = action.id;
  if (['save', 'favorite', 'launch', 'collection'].includes(action.type) && !ids.has(id)) throw new Error('등록되지 않은 앱이에요.');
  if (action.type === 'save') {
    if (next.saved.includes(id)) { next.saved = next.saved.filter(v => v !== id);next.favorites = next.favorites.filter(v => v !== id);for (const key of ['learn','work']) next.collections[key] = next.collections[key].filter(v => v !== id); }
    else next.saved.push(id);
  } else if (action.type === 'favorite') {
    if (!next.saved.includes(id)) next.saved.push(id);
    next.favorites = next.favorites.includes(id) ? next.favorites.filter(v => v !== id) : [...next.favorites, id];
  } else if (action.type === 'launch') {
    if (!['web','client'].includes(action.mode)) throw new Error('실행 경로를 확인해 주세요.');
    if (next.rememberRecent) next.recent = [{ id, at: now, mode: action.mode }, ...next.recent.filter(item => item.id !== id)].slice(0,2);
  } else if (action.type === 'collection') {
    if (!['learn','work'].includes(action.collection)) throw new Error('컬렉션을 확인해 주세요.');
    if (!next.saved.includes(id)) next.saved.push(id);
    const list = next.collections[action.collection];next.collections[action.collection] = list.includes(id) ? list.filter(v => v !== id) : [...list, id];
  } else if (action.type === 'remember') { next.rememberRecent = !!action.value;if (!next.rememberRecent) next.recent = []; }
  else if (action.type === 'compact') next.compact = !!action.value;
  else if (action.type === 'clear-recent') next.recent = [];
  else if (action.type === 'reset') return normalizeLibrary();
  return normalizeLibrary(next);
}
export function createLibrary(storage) {
  let state;try { state = normalizeLibrary(JSON.parse(storage.getItem(LIBRARY_KEY) || '{}')); } catch { state = normalizeLibrary(); }
  return { read: () => structuredClone(state), reload() { try { state = normalizeLibrary(JSON.parse(storage.getItem(LIBRARY_KEY) || '{}')); } catch {} },
    dispatch(action) { const next = updateLibrary(state, action);storage.setItem(LIBRARY_KEY, JSON.stringify(next));state = next;return this.read(); } };
}
export function filterApplications({ query = '', category = 'all', collection = 'all', library, onlySaved = false, sort = 'default' } = {}) {
  const needle = query.trim().toLocaleLowerCase('ko');
  const filtered = APPLICATIONS.filter(app => (!onlySaved || library.saved.includes(app.id)) && (category === 'all' || app.category === category)
    && (collection === 'all' || (collection === 'favorites' ? library.favorites : library.collections[collection] || []).includes(app.id))
    && (!needle || [app.name, app.subtitle, ...app.tags, ...(app.keywords || [])].join(' ').toLocaleLowerCase('ko').includes(needle)));
  if (sort === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name, 'ko'));
  if (sort === 'recent') filtered.sort((a,b) => (library.recent.find(v => v.id === b.id)?.at || 0) - (library.recent.find(v => v.id === a.id)?.at || 0));
  return filtered;
}
