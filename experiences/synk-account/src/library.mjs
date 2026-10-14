import { APPLICATIONS } from './applications.mjs';
import { MEMBER_BENEFITS } from '../../../desktop/renderer/benefits.mjs';
export const LIBRARY_KEY = 'synk.platform.device-library.v1';
// Device shortcuts only: including a benefit here never grants installation or account access.
export const LIBRARY_ITEMS = Object.freeze([
  ...APPLICATIONS.map(app => Object.freeze({ ...app, kind: 'app' })),
  ...MEMBER_BENEFITS.map(item => Object.freeze({ ...item, kind: 'benefit', category: 'life',
    subtitle: item.kicker, image: `member/${item.asset}`, tags: ['회원 혜택', '일상'], keywords: [item.headline, item.description] })),
]);
const ids = new Set(LIBRARY_ITEMS.map(app => app.id));
export function libraryItemRoute(id) {
  const item = LIBRARY_ITEMS.find(value => value.id === id);
  return item ? `#${item.kind === 'benefit' ? 'benefits' : 'app'}/${item.id}` : '#discover';
}
const unique = list => [...new Set(Array.isArray(list) ? list.filter(id => ids.has(id)) : [])];
export function normalizeLibrary(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  return { version: 1, saved: unique(raw.saved), favorites: unique(raw.favorites).filter(id => unique(raw.saved).includes(id)),
    recent: Array.isArray(raw.recent) ? raw.recent.filter(item => item && ids.has(item.id) && Number.isFinite(item.at) && item.at > 0 && ['web', 'client'].includes(item.mode)).sort((a,b) => b.at-a.at).filter((item,index,list) => list.findIndex(other => other.id === item.id) === index).slice(0, ids.size).map(({ id, at, mode }) => ({ id, at, mode })) : [],
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
    if (next.rememberRecent) next.recent = [{ id, at: now, mode: action.mode }, ...next.recent.filter(item => item.id !== id)].slice(0, ids.size);
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
  const readStored = () => {
    // A denied read must stop a later write, rather than treating the existing
    // device shortcuts as empty. Keep malformed legacy JSON normalization.
    const raw = storage.getItem(LIBRARY_KEY);
    try { return normalizeLibrary(JSON.parse(raw || '{}')); } catch { return normalizeLibrary(); }
  };
  let state;try { state = readStored(); } catch { state = normalizeLibrary(); }
  return { read: () => structuredClone(state), reload() { try { state = readStored(); } catch {} },
    dispatch(action) {
      // Another tab may have saved before this tab receives its storage event.
      // Apply only this action to that latest state, including disabled recents.
      state = readStored();const next = updateLibrary(state, action);
      storage.setItem(LIBRARY_KEY, JSON.stringify(next));state = next;return this.read();
    } };
}
export function filterApplications({ query = '', category = 'all', collection = 'all', library, onlySaved = false, sort = 'default' } = {}) {
  const needle = query.trim().toLocaleLowerCase('ko');
  const filtered = (onlySaved ? LIBRARY_ITEMS : APPLICATIONS).filter(app => (!onlySaved || library.saved.includes(app.id)) && (category === 'all' || app.category === category)
    && (collection === 'all' || (collection === 'favorites' ? library.favorites : library.collections[collection] || []).includes(app.id))
    && (!needle || [app.name, app.subtitle, ...app.tags, ...(app.keywords || [])].join(' ').toLocaleLowerCase('ko').includes(needle)));
  if (sort === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name, 'ko'));
  if (sort === 'recent') filtered.sort((a,b) => (library.recent.find(v => v.id === b.id)?.at || 0) - (library.recent.find(v => v.id === a.id)?.at || 0));
  return filtered;
}
