// Search stays in the viewer: account text is never encoded into a shared URL.
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
const platformNames = {
  youtube: '유튜브', instagram: '인스타 인스타그램', facebook: '페북 페이스북',
  tiktok: '틱톡', threads: '스레드', pinterest: '핀터레스트', behance: '비핸스',
  'naver clip': '네이버 클립', 'naver blog': '네이버 블로그', linkedin: '링크드인',
  telegram: '텔레그램', x: '트위터', douyin: '더우인 도우인',
  rednote: '샤오훙수', xiaohongshu: '샤오훙수', rutube: '루튜브', vk: '브이케이'
};
export const channelSearchFields = ['id', 'business', 'contentTrack', 'brand', 'country', 'platform', 'handle', 'channelScope', 'loginAlias', 'loginMethod', 'loginBrowser', 'loginStatusLabel', 'profileStatus', 'publishStatus', 'nextAction'];
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
// 11-13: 주 사업(business)과 콘텐츠 트랙(brand · contentTrack)은 다른 축이다. 거르기는 business만 본다.
export const businessIds = ['LAB', 'SHIFT', 'PULSE', 'PATH', 'SYNK'];
// 운영 상태 세 칸(브라우저 로그인 · 게시 · 수집 API)을 글로. 칸이 없으면 「기록 미확인」 — 실패로 단정하지 않는다.
const when = value => {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return '';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(time));
};
// 서버 수집 토큰(collection-policy.mjs · account-catalog.mjs) → 한국어. 모르는 토큰은 영어 대신 「수집 상태 미확인」.
export const collectionNames = {success:'오늘 수집 완료',partial:'오늘 일부만 수집',collecting:'수집 중',scheduled:'수집 시각 전',overdue:'이번 수집 전','retry-scheduled':'다시 시도 예정',paused:'자동 수집 꺼짐',failed:'수집 실패','needs-reconnect':'다시 연결해야 함','needs-connection':'연결해야 함',unsupported:'자동 수집 안 됨',archived:'보관됨','not-managed':'운영 대상 아님','not-registered':'수집 채널 미등록',unknown:'수집 상태 미확인',historical:'예전 기록만 있음'};
export const collectionMethods = {'official-api':'공식 API','creator-export-or-manual':'관리자 통계 · 직접 기록',server:'작업실 서버 수집','public-api':'공개 API','vk-api':'VK API','public-page':'공개 화면 읽기','screen-only':'화면으로만 확인'};
// 자료는 만든 때 기준이다. 볼 때(now) 다음 예약 시각이 지났으면 「게시 확인 필요」를 붙이고 기준 시각을 밝힌다(게시로 추정하지 않음).
export function operationLabels(row, now = Date.now()) {
  const op = row?.operations;
  if (!op) return { login: '기록 미확인', publication: '기록 미확인', collection: '기록 미확인' };
  const L = op.login, P = op.publication, C = op.collection;
  // 날짜만 확인한 로그인 기록(observedDateOnly)은 시각 없이 날짜만 — observedAt ISO 앞 10자.
  const dateOnly = value => { const m = String(value || '').slice(0, 10).match(/^\d{4}-(\d{2})-(\d{2})$/); return m ? `${Number(m[1])}. ${Number(m[2])}.` : ''; };
  const loginAt = L?.observedDateOnly === true ? dateOnly(L.observedAt) : when(L?.observedAt);
  const login = !L?.state ? '기록 미확인'
    : L.state === 'verified' ? ['확인됨', loginAt, L.scope].filter(Boolean).join(' · ')
    : L.state === 'login-required' ? ['로그인 필요', L.scope, loginAt ? `${loginAt} 확인` : ''].filter(Boolean).join(' · ')
    : L.state === 'historical' ? ['예전 기록만 있음', loginAt, '다시 확인 전'].filter(Boolean).join(' · ')
    : '기록 미확인';
  const parts = !P ? [] : [
    P.publishedCount ? `${P.omittedPublishedCount ? '최근 근거 게시' : '게시'} ${P.publishedCount}건${P.lastPublishedAt ? `(마지막 ${when(P.lastPublishedAt)})` : ''}${P.omittedPublishedCount ? ` · 그 전 게시 ${P.omittedPublishedCount}건은 따로(이 수에 안 넣음)` : ''}` : '',
    P.scheduledCount ? `예약 ${P.scheduledCount}건${P.nextScheduledAt ? `(다음 ${when(P.nextScheduledAt)})` : ''}` : '',
    P.pendingConfirmationCount ? `게시 확인 대기 ${P.pendingConfirmationCount}건` : ''
  ].filter(Boolean);
  const lapsed = Date.parse(P?.nextScheduledAt || '') <= now;
  const publication = !P ? '기록 미확인' : parts.length ? parts.join(' · ') + (lapsed ? ' · 그 예약 시각이 지나 게시 확인 필요' : '') + (P.checkedAt ? ` · ${when(P.checkedAt)} 기준` : '') + (P.basis ? ` — ${P.basis}` : '')
    : P.checkedAt && P.publishedCount === 0 && P.scheduledCount === 0 ? `작업실 게시 · 예약 없음 · ${when(P.checkedAt)} 확인` : '기록 미확인';
  const collection = !C?.state ? '기록 미확인' : [collectionNames[C.state] || '수집 상태 미확인', collectionMethods[C.method], C.checkedAt ? `마지막 수집 ${when(C.checkedAt)}` : ''].filter(Boolean).join(' · ');
  return { login, publication, collection };
}
