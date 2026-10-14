import { LIBRARY_ITEMS, libraryItemRoute } from './library.mjs';
import { publicBenefitEntry, localBenefitPreview } from './member-benefits.mjs';
import { platformPublicEntry } from './platform-entry.mjs';
import { messengerDestination, PATH_INTERVIEW_URL } from './applications.mjs';

const pages = new Set(['home', 'benefits', 'discover', 'library', 'updates', 'downloads', 'settings', 'help', 'app']);
export function platformRoute(hash = '') {
  const [path, search = ''] = hash.replace(/^#/, '').split('?');
  const [page = 'home', id] = path.split('/');
  const actual = pages.has(page) ? page : 'home';
  return { page: actual, id, query: ['discover', 'library'].includes(actual) ? new URLSearchParams(search).get('q')?.trim().slice(0, 120) || '' : '' };
}

export function searchRoute(page, query) {
  const term = String(query).trim().slice(0, 120);
  return `#${page === 'library' ? 'library' : 'discover'}${term ? `?${new URLSearchParams({ q: term })}` : ''}`;
}

// Resolve from the current catalog and installation state, never a saved URL.
// The library stores selections, not application progress or authorization.
export function shortcutDestination(id, { base, clients = [], learningUrl, messengerUrl, preferredMode } = {}) {
  if(id==='path')return {kind:'web',href:PATH_INTERVIEW_URL,label:'실사 면접실 열기 ↗'};
  if(id==='teacher'){
    const destination=messengerDestination(messengerUrl,base);
    if(!destination)return null;
    const url=new URL(destination);url.search='';url.searchParams.set('tab','teaching');url.hash='';
    return {kind:'web',href:url.href,label:'워크스페이스 · 내 수업 열기 ↗'};
  }
  const item = LIBRARY_ITEMS.find(value => value.id === id);
  if (!item) return null;
  const client = item.kind === 'app' && clients.some(value => value.id === id && value.canLaunch);
  const publicEntry = item.kind === 'benefit' ? publicBenefitEntry(id) : null;
  const preview = item.kind === 'benefit' && !publicEntry ? localBenefitPreview(id, base) : null;
  const web = item.kind === 'benefit' ? publicEntry || preview : id === 'world' ? platformPublicEntry('world') : messengerUrl;
  if (client && (preferredMode !== 'web' || !web)) return { kind: 'client', label: '앱 열기 ↗' };
  if (web) return { kind: 'web', href: web, label: preview ? '개발 미리보기 ↗' : id === 'world' ? '웹 WORLD 열기 ↗' : '웹에서 열기 ↗' };
  return { kind: 'detail', href: libraryItemRoute(id), label: '이용 방법 보기 →' };
}
