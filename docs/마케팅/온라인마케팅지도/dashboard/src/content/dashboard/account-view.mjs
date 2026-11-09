// Search stays in the viewer: account text is never encoded into a shared URL.
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
const platformNames = {
  youtube: '유튜브', instagram: '인스타 인스타그램', facebook: '페북 페이스북',
  tiktok: '틱톡', threads: '스레드', pinterest: '핀터레스트', behance: '비핸스',
  'naver clip': '네이버 클립', 'naver blog': '네이버 블로그', linkedin: '링크드인',
  telegram: '텔레그램', x: '트위터', douyin: '더우인 도우인',
  rednote: '샤오훙수', xiaohongshu: '샤오훙수', rutube: '루튜브', vk: '브이케이'
};
export const channelSearchFields = ['id', 'brand', 'country', 'platform', 'handle', 'channelScope', 'loginAlias', 'loginMethod', 'loginBrowser', 'loginStatusLabel', 'profileStatus', 'publishStatus', 'nextAction'];
export const identitySearchFields = ['id', 'label', 'loginType', 'currentUse', 'assignment', 'nextAction'];
export function createSearchIndex(rows, fields) {
  return new Map(rows.map(row => [row.id, normalize([
    ...fields.map(field => row[field]), platformNames[normalize(row.platform)] || ''
  ].join(' '))]));
}
export function searchRows(rows, index, search) {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  if (!terms.length) return rows;
  return rows.filter(row => terms.every(term => (index.get(row.id) || '').includes(term)));
}
export function visibleChannel(rows, selectedId) {
  return rows.find(row => row.id === selectedId) || (rows.length === 1 ? rows[0] : null);
}
export const loginStates = [
  { id: 'confirmed', label: '경로 확인' },
  { id: 'switch-only', label: '전환만 확인' },
  { id: 'partial', label: '정보 보완 필요' },
  { id: 'missing', label: '로그인 ID 미확인' }
];
export function managedChannels(rows) {
  return rows.filter(row => ['operating', 'operating-contact', 'confirmed-expansion'].includes(row.accountStatus));
}
export function loginSummary(rows) {
  const active = managedChannels(rows);
  return loginStates.map(state => ({ ...state, value: active.filter(row => row.loginMappingStatus === state.id).length }));
}
// Explicit navigation resets the destination cuts, so a previous country or platform cannot hide the requested brand.
export function brandChannelView(brand) {
  return { filters: { brand, channelCountry: 'all', channelScope: 'all', platform: 'all', loginState: 'all' }, focus: {} };
}
