'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const overlay = $('#overlay');
const METRICS = [
  ['views', '조회수', 'play'], ['likes', '좋아요', 'heart'], ['followers', '팔로워·구독자', 'users'],
  ['shares', '공유', 'share'], ['comments', '댓글', 'chat'], ['saves', '저장', 'bookmark'], ['reach', '도달', 'eye']
];
const PLATFORMS = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  link: '<path d="m10 13 4-4m-5 7-2 2a4.24 4.24 0 0 1-6-6l4-4a4.24 4.24 0 0 1 6 0m2 0 2-2a4.24 4.24 0 0 1 6 6l-4 4a4.24 4.24 0 0 1-6 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  settings: '<path d="m10 3-.5 2-2 .8L5.7 5 3 9l1.7 1.3v3.4L3 15l2.7 4 1.8-.8 2 .8.5 2h4l.5-2 2-.8 1.8.8 2.7-4-1.7-1.3v-3.4L21 9l-2.7-4-1.8.8-2-.8-.5-2Z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', refresh: '<path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 19.6 9M4.4 15a8 8 0 0 0 13.5 2.9"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="m9 6 9 6-9 6Z"/><rect x="2" y="3" width="20" height="18" rx="5"/>', heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z"/>',
  bookmark: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>', eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M3 3v18h18M6 15l5-5 4 3 6-8"/>', lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>', globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 16H3V3h13v2"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>', inbox: '<path d="m3 3-2 12v6h22v-6L21 3ZM1 15h6l2 3h6l2-3h6"/>'
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validNumber = value => typeof value === 'number' && Number.isFinite(value);
const numberFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const number = value => validNumber(value) ? numberFormatter.format(value) : '—';
const deltaText = value => validNumber(value) ? (value > 0 ? '+' : '') + number(value) : '—';
const deltaClass = value => !validNumber(value) ? 'none' : value > 0 ? 'positive' : value < 0 ? 'negative' : '';
const delta = (value, suffix = '') => `<span class="delta ${deltaClass(value)}">${deltaText(value)}${suffix}</span>`;
const platformKey = value => String(value || '').toLowerCase();
const platformLabel = value => PLATFORMS[platformKey(value)] || ({threads:'Threads',x:'X',linkedin:'LinkedIn',douyin:'Douyin',vk:'VK',xiaohongshu:'Xiaohongshu'})[platformKey(value)] || value || '채널';
const platformMark = value => { const key = platformKey(value); return `<span class="platform-mark ${escape(key)}" aria-label="${escape(platformLabel(value))}">${({ youtube: 'YT', instagram: 'IG', facebook: 'f', tiktok: 'Tk' })[key] || 'SNS'}</span>`; };
const todayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const dateToday = () => todayFormatter.format(new Date());
const shiftDate = (date, offset) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const formatDate = date => date ? date.slice(5).replace('-', '.') : '—';
const time = value => { if (!value) return '수집 전'; const d = new Date(value); return Number.isFinite(d.getTime()) ? timeFormatter.format(d) : '—'; };
const safeUrl = value => { try { const u = new URL(value, location.origin); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
const state = { workspaceSidebarOpen:false, workspaceSidebarView:'', user: null, csrf: '', data: null, report: null, tab: 'home', marketingView: 'summary', channelStatus: 'all', scope: 'mine', teamId: '', collectionFilter: 'attention', analysisView: 'daily', range: 'week', start: shiftDate(dateToday(), -6), end: dateToday(), ownerId: '', platform: '', channel: '', channelSearch: '', channelPlatform: '', metric: 'views', chartMode: 'change', error: '', loading: false, authMode: 'login', authToken: '', reportRequest: 0, modalRequest: 0, returnFocus: null, initialized: false };
let toastTimer, pollTimer, hypePollTimer, collectionPollPending=false;
Object.assign(state, {historyRange:'all',historyGroup:'day',historyStart:'',historyEnd:'',historyDate:'',hype:null,hypeScope:'',hypeError:'',hypeRequest:0});
const isAdmin = () => state.user?.role === 'admin';
const canManageTeam = () => ['admin', 'manager'].includes(state.user?.role);
const isViewer = () => state.user?.role === 'viewer';
const roleLabel = role => ({admin:'관리자',manager:'팀장',member:'실무자',viewer:'조회 전용'})[role] || '팀원';
const canEditChannel = channel => !isViewer() && (channel?.canEdit ?? (isAdmin() || channel?.owners?.some(row => row.id === state.user?.id)));
const canConnectChannel = channel => !isViewer() && (channel?.canConnect ?? canEditChannel(channel));
const canManageChannelOwners = channel => !isViewer() && (channel?.canManageOwners ?? isAdmin());
const autoSupported = platform => Object.hasOwn(PLATFORMS, platformKey(platform));
const channelName = channel => channel?.displayName || channel?.handle || channel?.canonicalUrl || '이름 없는 채널';
const busyRuns = () => (state.data?.runs || []).some(run => ['running', 'queued'].includes(run.status));
let renderedTab = '';
const searchIcon = () => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';

async function api(path, body, method = body === undefined ? 'GET' : 'POST', {signal} = {}) {
  signal?.throwIfAborted();
  // Cancelling one read never cancels a shared native session recovery.
  const wait=async pending=>{
    if(!signal)return pending;
    let onAbort;
    try{signal.throwIfAborted();return await Promise.race([pending,new Promise((_,reject)=>{onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true});})]);}
    finally{if(onAbort)signal.removeEventListener('abort',onAbort);}
  };
  const authStamp=companyAuthSnapshot();
  if(authStamp.userId&&typeof ensureNativeSynkCompanySession==='function'){
    const recovery=ensureNativeSynkCompanySession();if(recovery?.then)await wait(recovery);
    if(!companyAuthCurrent(authStamp))throw companyAuthChanged();
  }
  signal?.throwIfAborted();
  path = demoApiUrl(path,method);
  const response = await fetch(path, { method, ...(signal?{signal}:{}), credentials: 'same-origin', headers: { ...(isDemoMode() && !['/api/me','/api/login','/api/logout','/api/launch'].includes(path.split('?')[0]) ? {'X-Synk-Demo':'1'} : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && state.csrf ? { 'X-CSRF-Token': state.csrf } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const content = await wait(response.json().catch(() => ({})));
  signal?.throwIfAborted();
  if(!companyAuthCurrent(authStamp))throw companyAuthChanged();
  if (!response.ok) {
    const err = new Error(content.error || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    err.status = response.status;
    if (response.status === 401 && state.user) clearCompanySessionView();
    throw err;
  }
  return content;
}
// Track every identity assignment, including expiry messages from the messenger module.
// A logout followed by the same account still starts a distinct session generation.
let companyAuthGeneration=0;
for(const key of ['user','csrf']){
  let value=state[key];
  Object.defineProperty(state,key,{enumerable:true,configurable:false,get:()=>value,set(next){
    if(key==='user'?(value?.id||null)!==(next?.id||null):value!==next){companyAuthGeneration++;if(typeof clientDeskReset==='function')clientDeskReset();}
    value=next;
    globalThis.SynkDeviceNotifications?.syncIdentity({userId:state.user?.id||null,csrf:state.csrf||'',generation:companyAuthGeneration});
  }});
}
const companyAuthSnapshot=()=>({generation:companyAuthGeneration,userId:state.user?.id||null});
const companyAuthCurrent=stamp=>stamp.generation===companyAuthGeneration&&stamp.userId===(state.user?.id||null);
const companyAuthChanged=()=>Object.assign(new Error('로그인 상태가 바뀌어 이전 요청을 적용하지 않았어요.'),{code:'SESSION_CHANGED'});
function clearCompanySessionView(){
  state.hypeRequest++;state.hype=null;
  if(typeof resetContentWorkspace==='function')resetContentWorkspace();
  if(typeof resetStudioWorkspace==='function')resetStudioWorkspace();
  state.user=null;state.csrf='';state.data=null;state.report=null;closeModal();renderAuth();
}

function notify(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 5000); }
function query(overrides = {}) { const detailed = state.tab === 'analysis'; const values = { start: state.start, end: state.end, scope: state.scope, teamId: state.teamId, ...(detailed ? { ownerId: state.ownerId, platform: state.platform, channel: state.channel } : {}), ...overrides }; return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null)).toString(); }
function scopedChannels() { if (state.scope === 'team' && !state.teamId) return []; return (state.data?.channels || []).filter(row => (!state.teamId || row.teamId === state.teamId) && (state.scope !== 'mine' || row.owners?.some(owner => owner.id === state.user?.id))); }
function scopeLabel() { if (state.scope === 'mine') return '내 담당'; if (state.scope === 'team' || state.teamId) return (state.data?.teams || []).find(team => team.id === state.teamId)?.name || '팀 미배정'; return isAdmin() ? '회사 전체' : '열람 가능한 전체'; }
function reportTabs() { return ['analysis','history'].includes(state.tab) || (state.tab === 'overview' && state.marketingView !== 'channels'); }

function empty(title, text, action = '', compact = false, glyph = 'chart') { return `<div class="empty ${compact ? 'compact' : ''}"><span class="empty-icon">${icon(glyph)}</span><h3>${title}</h3><p>${text}</p>${action}</div>`; }
function button(text, action, glyph = '', classes = '', attrs = '') { return `<button class="btn ${classes}" type="button" data-action="${action}" ${attrs}>${glyph ? icon(glyph) : ''}${text}</button>`; }
function statusBadge(status, connected = false) {
  const statuses = { success: ['수집 완료', 'good'], collected: ['수집 완료', 'good'], ready: ['수집 가능', 'good'], collecting: ['수집 중', 'running'], 'not-connected': ['계정 연결 필요', 'warn'], interrupted: ['다시 수집 필요', 'error'], running: ['수집 중', 'running'], queued: ['수집 대기', 'running'], error: ['확인 필요', 'error'], failed: ['확인 필요', 'error'], partial: ['일부 수집', 'warn'], needs_connection: ['계정 연결 필요', 'warn'], 'needs-connection': ['계정 연결 필요', 'warn'], archived: ['관리 중지', ''], skipped: ['수집 건너뜀', ''], pending: ['첫 수집 대기', ''] };
  const [label, className] = statuses[status] || (connected ? ['첫 수집 대기', ''] : ['연결 필요', 'warn']);
  return `<span class="status-badge ${className}"><i class="dot"></i>${label}</span>`;
}
function metricCell(metric, mode = 'period') { return `<span class="num">${number(metric?.latest)}</span><span class="subnum">${delta(metric?.[mode]?.delta)}${validNumber(metric?.[mode]?.rate) ? ` <span class="muted">(${deltaText(metric[mode].rate)}%)</span>` : ''}</span>`; }
function metricCoverage(metric) { return `${number(metric?.latestCount ?? 0)} / ${number(metric?.eligible ?? 0)}개 대상 기록`; }
function providerFor(platform) { return (state.data?.oauthProviders || []).find(item => platformKey(item.id) === platformKey(platform)); }
function capabilityFor(platform) { return (state.data?.capabilities || []).find(item => platformKey(item.id) === platformKey(platform)); }
function requirementText(value) { return Array.isArray(value) ? value : value ? [value] : []; }

async function initialize() {
  try {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const requestedView=new URLSearchParams(location.search).get('tab')||params.get('view');
    if(isDemoMode()&&['messenger','home','workroom','handbook','teaching'].includes(requestedView)){location.replace(requestedView==='teaching'?demoTeachingUrl():requestedView==='home'?demoHomeUrl():requestedView==='workroom'?demoWorkroomUrl():requestedView==='handbook'?demoHandbookUrl():demoMessengerUrl());return;}
    selectWorkspaceView(requestedView,new URLSearchParams(location.search).get('section')||params.get('section')||'',new URLSearchParams(location.search).get('teamId')||params.get('teamId')||undefined,new URLSearchParams(location.search).get('draftId')||params.get('draftId')||undefined);
    const launch = params.get('launch');
    if (launch) { history.replaceState(null, '', location.pathname + location.search); await api('/api/launch', { token: launch }); }
    // A teacher-only account can enter its classroom without company membership.
    if(state.tab==='teaching'&&!isDemoMode()){
      let me=await api('/api/me');
      // Native teacher entry must not expose an old company's cookie identity.
      const native=window.synkDesktop?.teacher?await window.synkDesktop.authStatus():null;
      const companyAllowed=!native||native.signedIn&&native.account?.synk_user_id===me.synkUserId;
      if(native&&companyAllowed&&me.user){const checked=await prepareNativeSynkCompanyEntry();if(checked===false){renderTeachingOnly();return;}me=checked?.me||me;assertSynkPlatformIdentity(me,checked);}
      state.csrf=companyAllowed?me.csrfToken||'':'';state.user=companyAllowed?me.user:null;state.synkUserId=companyAllowed?me.synkUserId||null:null;state.platformUrl=me.platformUrl||null;
      if(!state.user){renderTeachingOnly();state.initialized=true;return;}
      await loadState();state.initialized=true;startPolling();return;
    }
    const synkEntry=!isDemoMode()&&typeof prepareSynkCompanyEntry==='function'?await prepareSynkCompanyEntry():true;
    if(synkEntry===false)return;
    const me = synkEntry?.me||await api('/api/me');
    if(!isDemoMode()&&typeof assertSynkPlatformIdentity==='function')assertSynkPlatformIdentity(me,synkEntry);
    state.csrf = me.csrfToken || '';
    state.user = me.user;
    state.synkUserId = me.synkUserId || null;
    state.platformUrl = me.platformUrl || null;
    if (params.get('invite')) { state.authMode = 'join'; state.authToken = params.get('invite'); history.replaceState(null, '', location.pathname + location.search); }
    else if (me.needsSetup || params.get('setup')) { state.authMode = 'setup'; state.authToken = params.get('setup') || ''; if (params.get('setup')) history.replaceState(null, '', location.pathname + location.search); }
    if (!state.user || state.authMode === 'join') { renderAuth(); return; }
    await loadState();
    if(reportTabs())await loadReport();
    if(state.tab==='content')await loadContentWorkspace();
    state.initialized = true;
    startPolling();
    const status = new URLSearchParams(location.search);
    if (status.get('connected')) { notify('계정 연결과 첫 수집을 확인했어요. 채널별 수집 결과를 살펴보세요.'); state.tab = 'channels'; render(); }
    if (status.get('connectionError')) { notify(status.get('connectionError')); state.tab = 'channels'; render(); }
    if (status.has('connected') || status.has('connectionError')) { const resultUrl=new URL(location.href);resultUrl.searchParams.delete('connected');resultUrl.searchParams.delete('connectionError');history.replaceState(null,'',resultUrl.pathname+resultUrl.search+resultUrl.hash); }
  } catch (err) { if(err.code==='SESSION_CHANGED')return; app.innerHTML = `<main class="initial-loading" id="main"><img class="brand-logo" src="/wordmark.svg" alt="싱ㅋ"><div class="empty"><h3>성장 현황에 연결하지 못했어요</h3><p>${escape(err.message)}</p>${button('다시 연결', 'reload', 'refresh', 'primary')}</div></main>`;if(typeof renderSynkPlatformEntryRecovery==='function')renderSynkPlatformEntryRecovery(err); }
}
async function loadState() {
  const authStamp=companyAuthSnapshot();if(!authStamp.userId)throw companyAuthChanged();
  const data=await api('/api/state');if(!companyAuthCurrent(authStamp))throw companyAuthChanged();
  if(!isDemoMode()&&data.user?.id!==authStamp.userId){clearCompanySessionView();throw companyAuthChanged();}
  state.data=data;state.user=data.user||state.user;initializeDemoRange(data);resetTeamOverview();if(typeof resetTeamTrends==='function')resetTeamTrends();normalizeMarketingScope();render();return data;
}
async function loadReport() {
  if (state.tab === 'overview' && state.scope === 'team' && state.marketingView !== 'channels' && typeof loadTeamTrends === 'function') { state.error='';state.loading=false;await loadTeamTrends();return; }
  // The simple home always describes today. Historical periods belong to analysis.
  if (state.tab === 'overview' && state.marketingView !== 'channels') { state.end = reportToday(); state.start = shiftDate(state.end,-((new Date(state.end+'T00:00:00Z').getUTCDay()+6)%7)); state.range = 'custom'; }
  const requestId = ++state.reportRequest; state.loading = true; state.error = ''; render();
  if (state.tab === 'analysis') void loadTeamOverview();
  if (state.tab === 'overview' && state.homeExtrasOpen && !isDemoMode()) void loadHype();
  try { const report = await api(`/api/analytics?${query({growth:state.tab==='overview'?'1':null,history:state.tab==='history'?'1':null,...(state.tab==='history'?{start:reportToday(),end:reportToday(),...(typeof historyRequestDates==='function'?historyRequestDates(reportToday()):{historyStart:state.historyStart||null,historyEnd:state.historyEnd||null})}:{})})}`); if (requestId !== state.reportRequest) return; state.report = report; }
  catch (err) { if (requestId !== state.reportRequest) return; state.error = err.message; }
  finally { if (requestId === state.reportRequest) { state.loading = false; render(); } }
}
function startPolling() {
  if(!isDemoMode())startWorkspaceSummary();
  if(isDemoMode())return;
  clearInterval(pollTimer); clearInterval(hypePollTimer);
  pollTimer = setInterval(() => { void pollCollectionState(); }, 7000);
  hypePollTimer = setInterval(() => { if (state.user && !document.hidden && !overlay.children.length && state.tab === 'overview' && state.homeExtrasOpen && !$('#hype-spotlight')?.contains(document.activeElement)) void loadHype(); }, 60000);
}
async function pollCollectionState(){
  if(collectionPollPending||!state.user||document.hidden||overlay.children.length||!busyRuns())return;
  collectionPollPending=true;
  try{await loadState();if(reportTabs())await loadReport();}
  catch{ /* A visible manual refresh remains available. */ }
  finally{collectionPollPending=false;}
}
const hypeScopeKey = () => `${state.user?.id || ''}:${state.scope}:${state.teamId}`;
async function loadHype() {
  const request = ++state.hypeRequest, scope = hypeScopeKey();
  if (state.hypeScope !== scope) { state.hype = null; state.hypeError = ''; }
  state.hypeScope = scope;
  try {
    const feed = await api('/api/hype?' + new URLSearchParams({scope:state.scope,teamId:state.teamId}));
    if (request !== state.hypeRequest || scope !== hypeScopeKey() || !state.user) return;
    state.hype = feed; state.hypeError = '';
  } catch (error) { if (request !== state.hypeRequest || scope !== hypeScopeKey()) return; state.hype = null; state.hypeError = error.message; }
  const current = $('#hype-spotlight');
  if (current && state.user) {
    const focused = current.contains(document.activeElement) ? document.activeElement : null;
    const action = focused?.dataset.action, id = focused?.dataset.id;
    current.outerHTML = hypeSection();
    if (action) $(`#hype-spotlight [data-action="${CSS.escape(action)}"]${id ? `[data-id="${CSS.escape(id)}"]` : ''}`)?.focus({preventScroll:true});
  }
}

function renderAuth() {
  if(typeof resetTeachingWorkspace==='function')resetTeachingWorkspace();
  if(typeof resetNativeSynkCompanyView==='function')resetNativeSynkCompanyView();
  if(typeof wpSyncIdentity==='function')wpSyncIdentity();
  if(typeof resetMarinHome==='function')resetMarinHome();
  if(typeof hideChartLeaders==='function')hideChartLeaders(true);
  state.workspaceSidebarOpen=false;state.workspaceSidebarView='';
  resetWorkspaceModule();
  const join = state.authMode === 'join', setup = state.authMode === 'setup';
  const title = setup ? '우리 회사 공간 만들기' : join ? '팀에 합류하기' : '다시 만나 반가워요';
  const description = setup ? '처음 한 번, 회사 이름과 관리자 계정을 등록해 주세요.' : join ? '초대받은 이름과 로그인할 비밀번호를 정해 주세요.' : '회사 계정으로 대화, 마케팅, 제작 업무를 함께 이어가세요.';
  app.innerHTML = `<main class="auth-layout" id="main"><header class="auth-bar"><img class="brand-logo" src="/wordmark.svg" alt="싱ㅋ"><span class="auth-edition">WORKSPACE</span></header><section class="auth-intro" aria-labelledby="auth-poster-title"><div class="auth-poster"><div class="auth-poster-top"><span class="auth-poster-scope">SYNK · 팀</span><span class="auth-poster-stage">팀원 전용</span></div><div class="auth-poster-media" aria-hidden="true"><img src="/messenger/assets/signal-laptop.webp" alt="" width="640" height="640" decoding="async"></div><div class="auth-poster-text"><div class="eyebrow">WORK · TEACH · CREATE</div><h1 id="auth-poster-title"><span class="auth-poster-name">SYNK Workspace</span><span class="auth-poster-word">워크<br>스페이스</span></h1><p class="lead">우리 팀의 일, 한곳에서 이어져요.</p></div><span class="auth-poster-caption" aria-hidden="true">SYNK WORKSPACE · 싱크 워크스페이스</span></div><dl class="auth-readouts"><div><dt>MESSENGER</dt><dd>대화와 파일을 한곳에</dd></div><div><dt>MARKETING</dt><dd>채널 변화와 성과</dd></div><div><dt>STUDIO</dt><dd>기획과 좋은 예시</dd></div></dl></section><section class="auth-form-side"><div class="auth-form-card"><div class="eyebrow">${setup ? 'GET STARTED' : join ? 'YOU ARE INVITED' : 'WELCOME BACK'}</div><h2>${title}</h2><p class="auth-description">${description}</p><form class="form-stack" id="auth-form" data-form="auth"><div class="form-error" role="alert"></div>${setup ? '<label class="field">회사 이름<input name="companyName" required maxlength="100" value="SYNK" autocomplete="organization"></label>' : ''}${setup || join ? '<label class="field">내 이름<input name="name" required maxlength="80" autocomplete="name" placeholder="이름을 입력해 주세요"></label>' : ''}${!join ? `<label class="field">${setup?'이메일':'이메일 또는 기존 메신저 아이디'}<input name="email" type="${setup?'email':'text'}" required autocomplete="username" placeholder="${setup?'name@company.com':'이메일 또는 기존 아이디'}" maxlength="254"></label>` : ''}<label class="field">비밀번호<input name="password" type="password" required ${setup || join ? 'minlength="12" maxlength="256" autocomplete="new-password" placeholder="12자 이상으로 입력해 주세요"' : 'autocomplete="current-password" placeholder="비밀번호를 입력해 주세요"'}></label>${setup && !state.authToken ? '<label class="field">관리자 시작 코드<input name="setupToken" required autocomplete="off" placeholder="회사 프로그램의 시작 코드를 입력해 주세요"><small>처음 실행한 컴퓨터의 관리자 시작 화면에서 확인할 수 있어요.</small></label>' : ''}<button class="btn primary auth-submit" type="submit">${setup ? '회사 공간 만들기' : join ? '초대 수락하고 시작하기' : '로그인'}${icon('arrow')}</button></form><div class="auth-form-footer">${join ? '초대 링크는 한 번만 사용할 수 있어요.<br><button type="button" class="text-button" data-action="auth-login">이미 계정이 있다면 로그인</button>' : setup ? '관리자만 크루를 초대하고 전체 현황을 관리할 수 있어요.' : '계정이 없다면 회사 관리자에게 초대를 요청해 주세요.'}</div></div></section></main>`;
  if(!setup&&!join&&typeof installSynkLogin==='function')void installSynkLogin();
}
function shell(content) {
  if(typeof teachingPrepareRender==='function')teachingPrepareRender();
  const practiceEdit=typeof wpCaptureEdit==='function'?wpCaptureEdit():null;
  if(practiceEdit?.composing){syncWorkspaceLocation();return;}
  if(state.tab==='home'&&typeof marinHomeShell==='function'){
    if(typeof hideChartLeaders==='function')hideChartLeaders();
    const input=document.getElementById('marin-input'),editing=input&&document.activeElement===input,selection=editing?[input.selectionStart,input.selectionEnd,input.selectionDirection]:null,logTop=document.getElementById('marin-conversation')?.scrollTop;
    if(editing&&marinHome.composing){syncWorkspaceLocation();mountWorkspaceModule();return;}
    app.innerHTML=marinHomeShell(content);renderedTab='home';state.workspaceSidebarOpen=false;syncWorkspaceSidebar();syncWorkspaceLocation();mountWorkspaceModule();syncMarinHome();
    if(typeof ensureTeachingWorkspace==='function')ensureTeachingWorkspace();
    if(logTop!=null){const log=document.getElementById('marin-conversation');if(log)log.scrollTop=logTop;}
    if(editing){const restored=document.getElementById('marin-input');restored?.focus({preventScroll:true});restored?.setSelectionRange(...selection);}
    return;
  }
  if(typeof hideChartLeaders==='function')hideChartLeaders();
  const openDetails=[...(app.querySelectorAll?.('details[id][open]')||[])].map(element=>element.id);
  const focused=app.contains(document.activeElement)?document.activeElement:null;
  const focusSelector=focused?['data-action','data-tab','data-mode','data-view','data-metric','data-filter','data-date','data-scope','data-range','data-chart','data-id','data-channel-search','data-channel-platform','data-scope-team','data-comparison-filter','data-demo-persona','data-history-action','data-history-field','data-history-value','data-history-date','data-team-trend-action','data-team-trend-value','data-team-trend-team','data-team-trend-compare','data-team-trend-date'].filter(key=>focused.hasAttribute(key)).map(key=>`[${key}="${CSS.escape(focused.getAttribute(key))}"]`).join(''):'';
  const tabs=workspacePrimaryTabs,utilityTabs=workspaceUtilityTabs();
  const primaryView=workspacePrimaryView(),active=[...tabs,...utilityTabs].find(row=>row[0]===primaryView),data=state.data||{},attention=(data.collection?.needsConnection||0)+(data.collection?.needsReconnect||0)+(data.collection?.failed||0);
  const entering=renderedTab!==state.tab;renderedTab=state.tab;
  if(state.workspaceSidebarView&&state.workspaceSidebarView!==primaryView&&['marketing','messenger'].includes(primaryView))state.workspaceSidebarOpen=false;state.workspaceSidebarView=primaryView;
  app.innerHTML=workspaceAppShell(content,{entering,title:active?.[1]});
  syncWorkspaceSidebar();
  if(typeof wpRestoreEdit==='function')wpRestoreEdit(practiceEdit);
  if(focusSelector){const target=app.querySelector(focusSelector);if(target&&!target.closest('[inert],[hidden]'))target.focus({preventScroll:true});else if(target)document.getElementById('workspace-sidebar-toggle')?.focus({preventScroll:true});}
  for(const id of openDetails){const element=document.getElementById(id);if(element?.tagName==='DETAILS')element.open=true;}
  syncWorkspaceLocation();
  mountWorkspaceModule();
  if(typeof ensureTeachingWorkspace==='function')ensureTeachingWorkspace();
  if(state.tab==='workroom'&&typeof ensureWorkroom==='function')ensureWorkroom();
  if(state.tab==='handbook'&&typeof ensureCompanyGuide==='function')ensureCompanyGuide();
}
function render() { if(typeof clientSearchSyncIdentity==='function')clientSearchSyncIdentity(); if(typeof wpSyncIdentity==='function')wpSyncIdentity(); if(typeof wrSuspendDaily==='function'&&(!state.user||state.tab!=='workroom'))wrSuspendDaily(); if (!state.user) { if(state.tab==='teaching'&&!isDemoMode()&&typeof renderTeachingOnly==='function')renderTeachingOnly();else renderAuth();return; } if (!state.data) return; if(isDemoMode() && (!['overview','analysis','history'].includes(state.tab)||state.marketingView==='channels'))selectWorkspaceView('all'); if(['channels','collection','studio'].includes(state.tab))selectWorkspaceView(state.tab); if ((!isAdmin() && state.tab === 'settings') || (!canManageTeam() && state.tab === 'members')) state.tab = 'overview'; if(isMarketingWorkspace())state.lastMarketingTab=state.tab; shell(({ teaching:typeof teachingWorkspacePage==='function'?teachingWorkspacePage:()=>'',home: typeof marinHomePage==='function'?marinHomePage:()=>'<section class="empty"><h1>홈을 준비하고 있어요</h1><p>잠시 뒤 다시 불러와 주세요.</p></section>', workroom: marinWorkroomPage, handbook: companyGuidePage, overview: marketingPage, analysis: analysisPage, history: historyPage, members: membersPage, settings: settingsPage, messenger: messengerWorkspacePage, content: contentPage })[state.tab]()); }
function pageHeading(kicker,title,description,actions='') { const names={'EXPLORE YOUR GROWTH':'성과 분석','CHANNEL LIBRARY':'채널','PEOPLE & TEAMS':'팀·크루','COLLECTION CENTER':'수집 센터'};return `<header class="page-heading"><div><h1>${names[kicker]||title}</h1><p>${description}</p></div>${actions?`<div class="heading-actions">${actions}</div>`:''}</header>`; }
function marketingScopeDescription() {
  return state.scope === 'mine' ? '내가 담당하는 채널의 성과와 다음 할 일을 확인하세요.' : state.scope === 'team' ? '팀별 성과를 한눈에 비교하고, 선택한 팀의 흐름을 살펴보세요.' : isAdmin() ? '회사 전체 채널의 성과와 운영 상태를 한눈에 확인하세요.' : '내 권한으로 열람할 수 있는 모든 채널을 모아 봅니다.';
}
function marketingReportSwitch(){return `<div class="marketing-report-switch" role="group" aria-label="현황 보기 방식">${[['overview','이번 주 비교'],['history','전체 추이'],['analysis','상세 분석']].map(([id,label])=>`<button type="button" data-action="report-view" data-view="${id}" class="${state.tab===id?'active':''}" aria-pressed="${state.tab===id}">${label}</button>`).join('')}</div>`;}
function marketingReportHeading(actions = '') {
  return `<header class="page-heading marketing-scope-heading"><div><h1>${marketingScopeTitle()}</h1><p>${marketingScopeDescription()}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</header>${marketingReportSwitch()}`;
}
function marketingScopeEmpty() {
  const noTeam = state.scope === 'team' && !state.teamId;
  const title = noTeam ? '팀을 등록하면 팀별 현황이 보여요' : state.scope === 'mine' ? '내 담당 채널이 아직 없어요' : state.scope === 'team' ? '이 팀의 채널을 연결해 주세요' : '등록된 채널이 아직 없어요';
  const description = noTeam ? (isAdmin() ? '팀을 만들고 크루와 담당 채널을 배정해 주세요. 팀별 성과 비교와 상세 분석을 함께 볼 수 있습니다.' : '팀 배정과 열람 권한을 관리자에게 확인해 주세요.') : state.scope === 'mine' ? '담당 채널을 배정받거나 새 채널을 등록하면 내 성과를 따로 볼 수 있어요.' : '채널을 등록하고 계정을 연결하면 실제 성과가 표시됩니다.';
  const actions = noTeam ? (isAdmin()?button('팀·크루 관리','tab','users','primary','data-tab="members"'):'') : !isViewer()?button('채널·수집으로 이동','tab','link','primary','data-tab="channels"'):'';
  return `<section class="marketing-scope-empty">${empty(title,description,actions,false,noTeam?'users':'link')}</section>`;
}
function contextBar({ period = true } = {}) {
  const teams = (state.data.teams || []).filter(team => team.active !== false && (isAdmin() || team.id === state.user.teamId)), mode = marketingScope();
  const scopeButtons = !period ? `<div class="segmented scope-segment" aria-label="채널 관리 범위">${[['all','전체 채널'],['mine','내 담당'],['team','팀별']].map(([id,label])=>`<button class="${mode===id?'active':''}" data-action="scope" data-scope="${id}" aria-pressed="${mode===id}">${label}</button>`).join('')}</div>` : '';
  return `<section class="context-panel marketing-context-bar" aria-label="집계 범위와 기간"><div class="context-scope">${scopeButtons}${mode==='team' ? `<select class="filter-select scope-team" aria-label="집계할 팀" data-scope-team ${!teams.length?'disabled':''}>${teams.length?teams.map(team=>`<option value="${escape(team.id)}" ${team.id===state.teamId?'selected':''}>${escape(team.name)}</option>`).join(''):'<option value="">팀 미배정</option>'}</select>` : ''}${period?`<span class="scope-summary">관리 중 <b>${scopedChannels().filter(row=>row.active!==false).length}</b>개 채널</span>`:''}</div>${period ? `<div class="context-period"><div class="segmented" aria-label="집계 기간">${[['week','최근 7일'],['month','월별'],['quarter','분기별'],['custom','직접 선택']].map(([key,label]) => `<button type="button" class="${state.range === key ? 'active' : ''}" data-action="range" data-range="${key}">${label}</button>`).join('')}</div><div class="date-control"><button class="icon-button" data-action="move-range" data-direction="-1" aria-label="이전 기간">${icon('left')}</button><input type="date" aria-label="집계 시작일" value="${state.start}" data-date="start" max="${state.end}"><span>—</span><input type="date" aria-label="집계 종료일" value="${state.end}" data-date="end" min="${state.start}" max="${reportToday()}"><button class="icon-button" data-action="move-range" data-direction="1" aria-label="다음 기간" ${state.end >= reportToday() ? 'disabled' : ''}>${icon('right')}</button></div></div>` : ''}</section>`;
}

function marketingPage(){return state.marketingView==='channels'?channelsPage():overviewPage();}
function overviewPage() {
  const report=state.report,channels=scopedChannels(),mode=marketingScope();
  if(mode==='team'&&typeof teamTrendsSection==='function')return `<header class="growth-home-heading"><div><h1>팀 현황</h1><p>내 팀과 다른 팀의 반응이 어떻게 달라지는지 살펴보세요.</p></div></header>${marketingReportSwitch()}${teamTrendsSection()}`;
  const teams=(state.data.teams||[]).filter(team=>team.active!==false&&(isAdmin()||team.id===state.user.teamId));
  const heading=`<header class="growth-home-heading"><div><h1>${marketingScopeTitle()}</h1><p>${mode==='mine'?'지난주의 나와, 이번 주의 나.':mode==='team'?'지난주와 비교하는 우리 팀의 성장.':'지난주와 비교하는 우리 전체의 성장.'}</p></div><div class="growth-home-tools">${mode==='team'?`<select class="filter-select" aria-label="집계할 팀" data-scope-team ${!teams.length?'disabled':''}>${teams.length?teams.map(team=>`<option value="${escape(team.id)}" ${team.id===state.teamId?'selected':''}>${escape(team.name)}</option>`).join(''):'<option value="">팀 미배정</option>'}</select>`:''}</div></header>${marketingReportSwitch()}`;
  if(!channels.length)return heading+marketingScopeEmpty();
  return `${heading}${growthHomeSection(report)}<details class="growth-home-extras" id="growth-home-extras" ${state.homeExtrasOpen?'open':''}><summary>콘텐츠와 운영 현황</summary>${topContentSection(report)}${isDemoMode()?demoDataSummary():healthPanel()+hypeSection()}</details>`;
}
function hypeSection() {
  const feed = state.hypeScope === hypeScopeKey() ? state.hype : null, collection = feed?.collection || {}, items = feed?.items || [];
  const error = state.hypeScope === hypeScopeKey() && state.hypeError;
  const connected = collection.connectedChannels || 0;
  const status = error ? '확인 필요' : !feed ? '불러오는 중' : !connected ? '연결 대기' : collection.enabled === false ? '자동 점검 꺼짐' : collection.collectingChannels ? '게시물 확인 중' : '30분마다 점검';
  const emptyTitle = error ? '하이라이트를 불러오지 못했어요' : !feed ? '우리 팀의 새로운 반응을 확인하고 있어요' : !connected ? '다음 주인공은 우리 팀에 있어요' : !feed.observedPostCount ? '첫 반응을 기다리는 중이에요' : '차곡차곡, 다음 하이라이트를 기다려요';
  const emptyText = error ? escape(error) : !feed ? '연결된 채널에서 확인한 기록을 모으고 있습니다.' : !connected ? '계정을 연결하면 최근 7일 게시물 중 눈에 띄는 반응을 이곳에 소개해 드려요.' : !feed.observedPostCount ? '최근 게시물의 수치가 수집되면 확인된 성과부터 소개해 드릴게요.' : '최근 확인한 게시물 중 선정 기준을 충족한 콘텐츠가 아직 없어요. 새 반응이 쌓이면 다시 살펴볼게요.';
  return `<section class="hype-section" id="hype-spotlight" aria-labelledby="hype-heading"><div class="hype-heading"><div><div class="eyebrow">TEAM SPOTLIGHT</div><h2 id="hype-heading">지금, 우리 팀에 반응이 오고 있어요<span aria-hidden="true">↗</span></h2><p>${escape(scopeLabel())} · 최근 7일 게시물 · 위 집계 기간과 별도로 최신 반응을 봐요</p></div><div class="hype-controls"><span class="hype-status ${connected && collection.enabled !== false ? 'is-on' : ''}"><i></i>${status}</span>${button('선정 기준','hype-rules','info','small quiet')}</div></div>${items.length ? `<div class="hype-grid" data-count="${items.length}">${items.map((item,index)=>hypeCard(item,index)).join('')}</div>` : `<div class="hype-empty"><span class="hype-empty-symbol" aria-hidden="true">✦</span><div><h3>${emptyTitle}</h3><p>${emptyText}</p></div>${button(error?'다시 확인':'표현 미리보기',error?'hype-refresh':'hype-preview',error?'refresh':'play','small')}</div>`}<div class="hype-footer"><span>${feed ? `연결 ${connected}/${collection.activeChannels || 0}개 · 최근 관측 ${number(feed.observedPostCount || 0)}개 게시물` : '연결된 채널의 실제 수치로 선정합니다.'}${collection.partialChannels ? ` · 일부 확인 ${collection.partialChannels}개` : ''}${collection.backoffChannels ? ` · 연결·재시도 확인 ${collection.backoffChannels}개` : ''}</span><span>${collection.nextCheckAt ? `다음 수집 예정 ${time(collection.nextCheckAt)}` : collection.lastCheckedAt ? `마지막 수집 ${time(collection.lastCheckedAt)}` : '첫 수집 이후 시작'}${button('새로고침','hype-refresh','refresh','small quiet')}</span></div></section>`;
}
function hypeCard(item,index=0) {
  const acceleration = item.kind === 'acceleration';
  return `<article class="hype-card ${index===0?'hype-lead':''}"><div class="hype-card-top"><span class="hype-tag">${icon(acceleration?'chart':'bookmark')}${acceleration?'반응 가속':'눈에 띄는 기록'}</span>${platformMark(item.platform)}</div><h3>${escape(item.title)}</h3><p class="hype-post-title">${escape(item.postTitle)}</p><div class="hype-stat"><strong>${acceleration && validNumber(item.ratio)?number(Math.floor(item.ratio*10)/10)+'×':number(item.value)}</strong><span>${acceleration?'기존 관측 대비 증가 속도':escape(item.metricLabel)+' 누적'+(item.evidence?.lagged?' · 지연 반영':'')}</span></div><p class="hype-summary">${escape(item.summary)}</p><div class="hype-card-bottom"><span>${escape(item.channelName)}<small>${time(item.evidence?.currentAt)} 확인</small></span>${button('왜 주목했나요?','hype-evidence','arrow','small',`data-id="${escape(item.id)}"`)}</div></article>`;
}
function hypeRules() {
  modal('어떤 콘텐츠를 소개하나요?', '최근 기록을 근거로, 반가운 성과를 발견해요.', `<div class="hype-rules"><div><b>01</b><section><h3>최근 7일 게시물부터</h3><p>연결된 계정을 30분 간격으로 확인합니다. 최근 90분 안에 실제로 수집한 게시물만 후보로 살펴봅니다.</p></section></div><div><b>02</b><section><h3>반응이 빨라졌다면, 이유까지</h3><p>15~90분 간격의 관측을 30분당 증가량으로 맞춥니다. 같은 채널의 이전 관측 구간이 3개 이상 있고, 중앙값 대비 1.5배 이상일 때 소개합니다. 실제 구간 증가량과 30분 환산 증가량 모두 조회수 50회·좋아요 5개·댓글·공유·저장 2개 이상의 기준을 넘어야 합니다. 게시 후 경과 시간·광고 여부까지 맞춘 비교는 아닙니다.</p></section></div><div><b>03</b><section><h3>처음 모은 기록도 정직하게</h3><p>비교 기록이 부족해도 눈에 띄는 누적 성과는 소개할 수 있어요. 이때는 ‘방금 돌파’, ‘평소보다 빠름’처럼 확인하지 못한 표현을 쓰지 않습니다.</p></section></div><div><b>04</b><section><h3>팀의 좋은 소식을 골고루</h3><p>채널과 담당자가 다양하게 보이도록 최대 3개를 선정합니다. 이름은 등록된 관리 담당자 기준이며, 게시물 작성자를 뜻하지 않습니다. 실제 수치가 바뀌기 전에는 같은 관측 결과를 유지합니다.</p></section></div></div><p class="table-foot">서버가 켜져 있고 계정 연결이 유효해야 수집됩니다. 플랫폼 요청 제한·오류 또는 조회 상한에 도달하면 수집이 늦어지거나 일부 게시물이 제외될 수 있습니다. 하이라이트는 이 프로그램 안에 표시됩니다.</p>`);
}
function hypeEvidence(id) {
  const item = state.hype?.items?.find(row=>row.id===id); if (!item) return;
  const e=item.evidence||{}, acceleration=item.kind==='acceleration';
  modal('이 콘텐츠를 주목한 이유', item.channelName, `<div class="hype-detail"><span class="hype-tag">${acceleration?'반응 가속':'확인된 누적 성과'}</span><h3>${escape(item.postTitle)}</h3><p>${escape(item.summary)}</p><dl><div><dt>확인한 지표</dt><dd>${escape(item.metricLabel)}</dd></div><div><dt>최신 누적</dt><dd>${number(item.value)}</dd></div>${validNumber(item.delta)?`<div><dt>관측 구간 증가</dt><dd>${deltaText(item.delta)} · ${number(e.intervalMinutes)}분 동안</dd></div>`:''}${acceleration?`<div><dt>30분당 증가량</dt><dd>${number(item.normalizedDelta)}</dd></div><div><dt>같은 채널 이전 구간</dt><dd>${number(e.baselineCount)}개 · 중앙값 ${number(e.baselineMedian)}/30분</dd></div>`:''}<div><dt>관측 시각</dt><dd>${e.previousAt?`${time(e.previousAt)} → `:''}${time(e.currentAt)}</dd></div><div><dt>담당</dt><dd>${escape(item.owners?.map(owner=>owner.name).join(', ')||'담당 확인 필요')}</dd></div><div><dt>수치 출처</dt><dd>${escape(platformLabel(item.platform))} 공식 API</dd></div></dl><p class="table-foot">${escape(e.comparisonLabel||'확인한 누적 수치를 소개합니다.')} · 추후 수치 정정에 따라 결과가 바뀔 수 있어요.</p><a class="btn primary" href="${escape(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">게시물 보러 가기${icon('external')}</a></div>`,false,true);
}
function hypePreview() {
  modal('하이라이트는 이렇게 보여요', '표현 예시 · 아래 이름, 콘텐츠와 수치는 실제 회사 실적이 아닙니다.', `<div class="hype-preview"><span class="hype-example-label">예시 · 실제 성과 아님</span><div class="hype-preview-card"><span class="hype-tag">↗ 반응 가속</span><h3>유호님 담당 콘텐츠,<br>지금 관심이 붙고 있어요.</h3><p>사진 한 장으로 광고 세 컷 만들기</p><strong>2.4×</strong><span>같은 채널의 이전 관측 대비 조회 증가 속도</span><p class="hype-preview-proof">최근 30분 조회수 +1,200<br>이전 6개 관측 구간 중앙값 +500/30분</p></div><p class="table-foot">실제 화면에는 해당 게시물과 수집 시각, 선정 근거를 함께 표시합니다. 계정을 연결하기 전에는 예시가 회사 성과에 포함되지 않습니다.</p></div>`);
}
function metricSparkline(daily,key){
  const rows=daily.slice(-21),values=rows.map(row=>row.metrics?.[key]?.total),known=values.filter(validNumber);
  if(known.length<2)return '<div class="metric-sparkline sparkline-empty" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>';
  const min=Math.min(...known),range=Math.max(1,Math.max(...known)-min),x=i=>i/Math.max(1,rows.length-1)*140,y=v=>27-(v-min)/range*22;
  let d='',previous=false;values.forEach((v,i)=>{if(!validNumber(v)){previous=false;return;}d+=`${previous?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;previous=true;});
  return `<svg class="metric-sparkline" viewBox="0 0 140 32" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}
function platformOverview(report){
  const channels=scopedChannels(),keys=[...new Set(channels.map(c=>c.platform))];
  const sum=values=>{const known=values.filter(validNumber);return known.length?known.reduce((a,b)=>a+b,0):null;};
  return `<section class="platform-overview"><div class="section-head"><div><h2>플랫폼별 성과</h2></div><span class="quiet-label">조회수 / 기간 증감</span></div>${keys.length?keys.map(key=>{const ids=new Set(channels.filter(c=>c.platform===key).map(c=>c.id)),groups=(report?.groups||[]).filter(g=>ids.has(g.id)),latest=sum(groups.map(g=>g.metrics?.views?.latest)),change=sum(groups.map(g=>g.metrics?.views?.period?.delta));return `<button class="platform-row" data-action="platform-focus" data-platform="${escape(key)}"><span class="platform-identity">${platformMark(key)}<span><strong>${escape(platformLabel(key))}</strong><small>${ids.size}개 채널</small></span></span><meter class="platform-meter" min="0" max="${Math.max(1,channels.length)}" value="${ids.size}" aria-label="등록 채널 ${ids.size}개"></meter><span class="platform-values"><strong>${number(latest)}</strong>${delta(change)}</span>${icon('right')}</button>`;}).join(''):empty('아직 등록된 채널이 없어요','채널 주소를 등록하면 플랫폼별로 모아 볼 수 있습니다.','',true,'link')}</section>`;
}
function healthItems() { const ids = new Set(scopedChannels().map(row => row.id)); const items = state.data.collection?.items; if (items) return items.filter(row => ids.has(row.channelId)); return scopedChannels().map(channel => ({channelId:channel.id,status:channel.connected ? channel.status : 'needs-connection',label:!channel.connected ? '계정 연결 필요' : channel.status === 'success' ? '수집 완료' : '첫 수집 대기',reason:channel.lastError || '',action:channel.connected ? 'collect' : 'connect',lastCollectedAt:channel.lastCollectedAt})); }
function healthPanel() {
  const channels=scopedChannels().filter(c=>c.active!==false),connected=channels.filter(c=>c.connected).length,missing=channels.length-connected,items=healthItems().filter(item=>/error|failed|reconnect|expired/.test(item.status));
  return `<section class="home-panel health-panel"><div class="section-head"><h2>운영 현황</h2></div><div class="health-main"><span>연결된 채널</span><strong>${connected}<small> / ${channels.length}</small></strong><progress value="${connected}" max="${Math.max(1,channels.length)}" aria-label="연결된 채널 비율"></progress></div><dl class="health-rows"><div><dt>계정 연결 필요</dt><dd>${missing}</dd></div><div><dt>확인할 수집 오류</dt><dd>${items.length}</dd></div></dl><div class="health-tip">${icon('info')}<p>${connected?'30분마다 최근 게시물의 반응을 확인합니다.':'채널을 연결하면 실제 성과와 하이라이트가 채워집니다.'}</p></div></section>`;
}
function dateTodayFrom(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date) : ''; }
function todayActions() {
  const items = healthItems().filter(item => (item.action && !['none','wait'].includes(item.action)) || item.status === 'partial').slice(0,3), setup = (state.data.oauthProviders || []).filter(row => !row.configured && !row.publicApiConfigured).length;
  return `<section class="home-panel action-panel"><div class="section-head"><div><div class="eyebrow">NEXT TO DO</div><h2>오늘 확인할 일</h2></div><span class="quiet-label">${isViewer() ? '담당자에게 확인해 주세요' : '지금 필요한 일부터'}</span></div><div class="today-action-list">${isAdmin() && setup ? `<button class="today-action" data-action="tab" data-tab="settings"><span class="action-symbol">${icon('settings')}</span><span class="action-copy"><strong>플랫폼 연결 준비 ${setup}개</strong><span>크루가 로그인으로 채널을 연결할 수 있도록</span></span>${icon('right')}</button>` : ''}${items.map(item => { const channel = state.data.channels.find(row => row.id === item.channelId); return `<button class="today-action" data-action="${isViewer() ? 'channel-history' : item.action === 'connect' && canConnectChannel(channel) ? 'connect' : 'collection-focus'}" data-id="${escape(item.channelId)}"><span class="action-symbol ${item.action === 'connect' ? 'blue' : ''}">${icon(item.action === 'connect' ? 'link' : 'refresh')}</span><span class="action-copy"><strong>${escape(item.label || '수집 확인')}</strong><span>${escape(channelName(channel))}</span></span>${icon('right')}</button>`; }).join('')}${!items.length && !(isAdmin() && setup) ? `<div class="all-clear">${icon('check')}<strong>지금 처리할 항목이 없어요.</strong><span>새로운 확인 사항이 생기면 여기에 모아드려요.</span></div>` : ''}</div></section>`;
}
function topContentSection(report) {
  const posts = (report?.byPost || []).filter(post => validNumber(post.metrics?.views?.period?.delta)).sort((a,b) => b.metrics.views.period.delta-a.metrics.views.period.delta).slice(0,3);
  return `<section class="section top-content"><div class="section-head"><div><h2>주목할 콘텐츠</h2><p>비교 가능한 콘텐츠의 조회수 증가 순서입니다.</p></div>${button('콘텐츠 더 보기','analysis-content','arrow','small quiet')}</div>${posts.length ? `<div class="content-grid">${posts.map((post,index) => contentCard(post,index)).join('')}</div>` : `<div class="content-empty"><span class="empty-icon">${icon('play')}</span><div><h3>다음 성장을 보여줄 콘텐츠를 기다리고 있어요</h3><p>실제 콘텐츠 수집과 비교 기록이 쌓이면, 어떤 게시물이 성장에 기여했는지 이곳에서 확인할 수 있어요.</p></div></div>`}</section>`;
}
function contentCard(post,index = 0) { const channel = state.data.channels.find(row => row.id === post.channelId); return `<button type="button" class="content-card" data-action="post-detail" data-id="${escape(post.id)}"><div class="content-preview">${post.thumbnailUrl ? `<img src="${escape(safeUrl(post.thumbnailUrl))}" loading="lazy" alt="">` : `<span class="content-placeholder">${icon('play')}</span>`}<span class="content-rank">${String(index+1).padStart(2,'0')}</span>${platformMark(channel?.platform)}</div><div class="content-card-body"><span class="content-channel">${escape(channelName(channel))}</span><h3>${escape(post.title || '제목 없는 콘텐츠')}</h3><div class="content-stats"><div><span>조회수 증가</span><strong class="delta ${deltaClass(post.metrics?.views?.period?.delta)}">${deltaText(post.metrics?.views?.period?.delta)}</strong></div><span class="content-date">${escape(post.publishedDate || '')}</span></div></div></button>`; }
function historyPage() {
  const teams=(state.data.teams||[]).filter(team=>team.active!==false&&(isAdmin()||team.id===state.user?.teamId));
  const teamControl=marketingScope()==='team'?`<select class="filter-select" aria-label="집계할 팀" data-scope-team ${!teams.length?'disabled':''}>${teams.length?teams.map(team=>`<option value="${escape(team.id)}" ${team.id===state.teamId?'selected':''}>${escape(team.name)}</option>`).join(''):'<option value="">팀 미배정</option>'}</select>`:'';
  return marketingReportHeading(teamControl)+growthHistoryPage(state.report);
}
function loadHistoryReport(){return loadReport();}
function analysisPage() { const report = state.report, heading = `${marketingReportHeading(`<a class="btn" href="${escape(demoApiUrl('/api/export.csv?'+query()))}" download>${icon('download')}CSV 저장</a>`)}${contextBar()}`; if(!scopedChannels().length)return heading+marketingScopeEmpty(); return `${heading}${filters()}${comparisonChartsSection(report)}${chartSection(report)}${periodComparisonCharts(report)}<details class="report-data-details"><summary>기간별 상세 수치 보기</summary>${periodSection(report)}</details><div class="analysis-tabs segmented" aria-label="상세 분석 종류">${[['daily','일별 기록'],['content','콘텐츠'],['channels','채널별'],...(canManageTeam() && state.scope !== 'mine' ? [['members','담당자별']] : [])].map(([id,label]) => `<button data-action="analysis-view" data-view="${id}" class="${state.analysisView === id ? 'active' : ''}">${label}</button>`).join('')}</div>${state.analysisView === 'daily' ? dailySection(report) : state.analysisView === 'channels' ? groupsSection(report) : state.analysisView === 'members' ? memberGroupsSection(report) : allContentSection(report)}`; }
function allContentSection(report) { const posts = [...(report?.byPost || [])].sort((a,b) => (b.metrics?.views?.period?.delta ?? -Infinity)-(a.metrics?.views?.period?.delta ?? -Infinity)); return `<section class="section"><div class="section-head"><div><h2>콘텐츠별 성과</h2><p>최근 기록과 선택 기간 증가량을 함께 확인하세요.</p></div><span class="quiet-label">${posts.length}개 콘텐츠</span></div>${posts.length ? `<div class="content-grid">${posts.map(contentCard).join('')}</div>` : empty('아직 확인한 콘텐츠가 없어요','채널을 연결하고 첫 수집을 마치면 실제 게시물이 표시됩니다.','','', 'play')}</section>`; }

function readinessNote() {
  const providers = state.data.oauthProviders || [], ready = providers.filter(row => row.configured || row.publicApiConfigured).length;
  if (!state.data.deployment?.localOnly && ready >= 4) return '';
  return `<div class="workspace-status">${icon('info')}<div>${state.data.deployment?.localOnly ? '<strong>현재 이 컴퓨터에서 실행 중</strong><span>크루들이 각자 접속하려면 회사 서버 연결이 필요해요.</span>' : ''}${ready < 4 ? `<span>플랫폼 연결 준비 ${ready}/4 · ${isAdmin() ? '수집 설정에서 관리자 연결을 준비해 주세요.' : '관리자가 플랫폼 연결을 준비 중이에요.'}</span>` : ''}</div>${isAdmin() && ready < 4 ? button('설정 보기', 'tab', '', 'small quiet', 'data-tab="settings"') : ''}</div>`;
}
function filters() { return `<div class="analysis-filters"><span class="context-label">상세 조건</span>${canManageTeam() && state.scope !== 'mine' ? `<select aria-label="담당자 선택" class="filter-select" data-filter="ownerId"><option value="">모든 담당자</option>${(state.data.members || []).filter(row => row.active !== false && (!state.teamId || row.teamId === state.teamId)).map(row => `<option value="${escape(row.id)}" ${state.ownerId === row.id ? 'selected' : ''}>${escape(row.name)}</option>`).join('')}</select>` : ''}<select aria-label="플랫폼 선택" class="filter-select" data-filter="platform"><option value="">모든 플랫폼</option>${[...new Set([...Object.keys(PLATFORMS),...scopedChannels().map(c=>platformKey(c.platform))])].map(key => [key,platformLabel(key)]).map(([key,label]) => `<option value="${key}" ${state.platform === key ? 'selected' : ''}>${label}</option>`).join('')}</select><select aria-label="채널 선택" class="filter-select" data-filter="channel"><option value="">모든 채널</option>${scopedChannels().filter(row => (!state.platform || platformKey(row.platform) === state.platform) && (!state.ownerId || row.owners?.some(owner => owner.id === state.ownerId))).map(row => `<option value="${escape(row.id)}" ${state.channel === row.id ? 'selected' : ''}>${escape(channelName(row))}</option>`).join('')}</select><span class="filter-note">이 화면의 모든 분석에 같은 조건을 적용해요.</span></div>`; }

function chartSection(report) {
  const metric = report?.metrics?.[state.metric];
  const label = METRICS.find(row => row[0] === state.metric)?.[1];
  const value = state.chartMode === 'change' ? metric?.period?.delta : metric?.latest;
  return `<section class="chart-section" aria-label="일별 성장 추이"><div class="chart-header"><div><h2>성장 추이</h2><p>${state.chartMode === 'change' ? '전일과 당일 모두 기록한 대상의 실제 변화' : '해당 날짜에 수집한 콘텐츠 누적 수치의 합계'}</p></div><div class="chart-controls"><span class="chart-metric-label">${escape(label)}</span><div class="segmented"><button class="${state.chartMode === 'change' ? 'active' : ''}" data-action="chart-mode" data-mode="change">하루 증감</button><button class="${state.chartMode === 'total' ? 'active' : ''}" data-action="chart-mode" data-mode="total">누적 수치</button></div></div></div><div class="chart-total ${state.chartMode === 'change' ? `delta ${deltaClass(value)}` : ''}">${state.chartMode === 'change' ? deltaText(value) : number(value)}</div><div class="chart-summary">${state.chartMode === 'change' ? `선택 기간 ${label} 증감 · 비교 가능 ${number(metric?.period?.count ?? 0)} / ${number(metric?.period?.eligible ?? 0)}개 대상` : `선택 종료일까지 최근 ${label} 합계 · ${metric ? metricCoverage(metric) : '기록 없음'}`}</div><div class="chart-area">${chartSvg(report?.daily || [], label)}</div><div class="chart-legend"><span><i class="legend-marker"></i>${label}</span><span>날짜별 확인값을 사용하며, 기록이 없는 날짜는 이어 그리지 않아요.</span></div></section>`;
}
function chartSvg(daily, label) {
  const values = daily.map(row => state.chartMode === 'change' ? row.metrics?.[state.metric]?.change?.delta : row.metrics?.[state.metric]?.total);
  const known = values.filter(validNumber);
  if (!known.length) return `<div class="chart-empty"><span class="empty-icon">${icon('chart')}</span><h3>${state.chartMode === 'change' ? '변화를 비교할 기록이 아직 없어요' : '선택 기간에 수집된 기록이 없어요'}</h3><p>${state.chartMode === 'change' ? '첫 수집으로 기준을 만들고, 다음 날의 수집부터 하루 증가량을 확인할 수 있어요.' : '채널 연결 후 수집을 시작하면 실제 수치로 그래프가 채워져요.'}</p></div>`;
  const width = 900, height = 270, pad = { left: 48, right: 20, top: 48, bottom: 35 }, min = Math.min(0, ...known), max = Math.max(1, ...known), extent = max - min;
  const x = i => pad.left + i / Math.max(1, values.length - 1) * (width - pad.left - pad.right);
  const y = value => height - pad.bottom - ((value - min) / extent) * (height - pad.top - pad.bottom);
  const grid = [0, .5, 1].map(ratio => { const value = min + ratio * extent; return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(value)}" y2="${y(value)}" stroke="#edf0f5"/><text x="${pad.left - 10}" y="${y(value) + 4}" text-anchor="end" fill="#8a94a5" font-size="10">${escape(compactNumber(value))}</text>`; }).join('');
  const segments = []; let current = [];
  values.forEach((value, i) => { if (validNumber(value)) current.push([x(i), y(value)]); else if (current.length) { segments.push(current); current = []; } }); if (current.length) segments.push(current);
  const paths = segments.map(points => {const line=points.map(([px,py],i)=>`${i?'L':'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');return `<path d="${line} L${points.at(-1)[0].toFixed(1)},${y(0).toFixed(1)} L${points[0][0].toFixed(1)},${y(0).toFixed(1)} Z" fill="url(#growth-fill)"/><path class="chart-line" d="${line}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;}).join('');
  const step = Math.max(1, Math.ceil(daily.length / 7));
  const labels = daily.map((row, i) => (i % step === 0 || i === daily.length - 1) ? `<text x="${x(i)}" y="${height - 8}" fill="#8993a4" font-size="10" text-anchor="middle">${formatDate(row.date)}</text>` : '').join('');
  const first=values.findIndex(validNumber);
  const dots = daily.map((row,i)=>{if(!validNumber(values[i]))return '';const tx=Math.max(pad.left,Math.min(width-188,x(i)-75)),ty=Math.max(2,y(values[i])-48);return `<g class="chart-point" role="button" tabindex="${i===first?'0':'-1'}" data-chart-point data-action="day" data-date="${row.date}" aria-label="${row.date} ${escape(label)} ${number(values[i])}, 상위 콘텐츠 및 상세 보기"><line class="chart-crosshair" x1="${x(i)}" x2="${x(i)}" y1="${pad.top}" y2="${height-pad.bottom}"/><circle class="chart-hit" cx="${x(i)}" cy="${y(values[i])}" r="12" fill="transparent"/><circle class="chart-dot" cx="${x(i)}" cy="${y(values[i])}" r="${daily.length>50?2:3.5}" fill="#fff" stroke="currentColor" stroke-width="2"/><g class="chart-callout" aria-hidden="true" pointer-events="none"><rect x="${tx}" y="${ty}" width="166" height="35" rx="7"/><text x="${tx+11}" y="${ty+22}">${formatDate(row.date)} · ${number(values[i])}</text></g></g>`;}).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="${escape(label)} ${state.chartMode==='change'?'하루 증감':'당일 누적 수치'} 그래프. 가리키거나 방향키로 날짜를 선택하면 상위 콘텐츠가 표시됩니다. Enter로 상세를 엽니다."><defs><linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".13"/><stop offset="100%" stop-color="currentColor" stop-opacity=".01"/></linearGradient></defs>${grid}${paths}${dots}${labels}</svg>`;
}
function compactNumber(value) { const abs = Math.abs(value); return abs >= 1e8 ? `${(value / 1e8).toFixed(1).replace('.0', '')}억` : abs >= 1e4 ? `${(value / 1e4).toFixed(1).replace('.0', '')}만` : number(Math.round(value)); }
function commandModal(){
  if(typeof clientSearchOpen==='function'){clientSearchOpen();return;}
  modal('빠른 검색','채널이나 메뉴 이름으로 바로 이동하세요.',`<label class="command-input">${searchIcon()}<input type="search" data-command-search aria-label="채널 또는 메뉴 검색" placeholder="채널, 담당자, 메뉴 검색" autocomplete="off"></label><div class="command-results" aria-live="polite"></div><div class="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> 이동 <kbd>Enter</kbd> 선택</span><span><kbd>Esc</kbd> 닫기</span></div>`);
  renderCommandResults('');
}
function renderCommandResults(value){
  const q=value.trim().toLocaleLowerCase(),menus=[...workspacePrimaryTabs,...workspaceMarketingTabs.map(([id,label,glyph])=>[id,`마케팅 · ${label}`,glyph]),...workspaceUtilityTabs()].filter(([,label])=>!q||label.includes(q));
  const channels=(state.data?.channels||[]).filter(c=>!q||channelSearchText(c).includes(q)).slice(0,8);
  $('.command-results',overlay).innerHTML=`${menus.length?'<div class="command-label">메뉴</div>':''}${menus.map(([id,label,glyph])=>`<button class="command-item" data-action="command-tab" data-tab="${id}">${icon(glyph)}<span>${label}</span>${icon('right')}</button>`).join('')}${channels.length?'<div class="command-label">채널</div>':''}${channels.map(c=>`<button class="command-item" data-action="command-channel" data-id="${escape(c.id)}">${platformMark(c.platform)}<span><strong>${escape(channelName(c))}</strong><small>${escape((c.owners||[]).map(u=>u.name).join(', '))} · ${escape(c.teamName||'팀 미배정')}</small></span>${icon('right')}</button>`).join('')}${!menus.length&&!channels.length?'<p class="command-empty">검색 결과가 없습니다. 다른 이름으로 찾아보세요.</p>':''}`;
}
document.addEventListener('input',event=>{if(event.target.matches('[data-command-search]'))renderCommandResults(event.target.value);});
document.addEventListener('keydown',event=>{
  if(state.user&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!overlay.children.length)commandModal();return;}
  const search=$('[data-command-search]',overlay);
  if(search&&['ArrowDown','ArrowUp','Enter'].includes(event.key)){
    const buttons=[...overlay.querySelectorAll('.command-item')],index=buttons.indexOf(document.activeElement);if(!buttons.length)return;
    if(event.key==='Enter'&&document.activeElement===search){event.preventDefault();buttons[0].click();}
    else if(event.key!=='Enter'){event.preventDefault();buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}
  }
  const point=event.target.closest?.('[data-chart-point]');
  if(point&&['Enter',' ','ArrowLeft','ArrowRight'].includes(event.key)){
    event.preventDefault();if(event.key==='Enter'||event.key===' '){point.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
    const points=[...point.closest('svg').querySelectorAll('[data-chart-point]')],next=points[(points.indexOf(point)+(event.key==='ArrowRight'?1:-1)+points.length)%points.length];point.setAttribute('tabindex','-1');next.setAttribute('tabindex','0');next.focus();
  }
});
function dailySection(report) {
  const days = report?.daily || [];
  return `<section class="section"><div class="section-head"><div><h2>일별 기록</h2><p>날짜를 누르면 그날의 콘텐츠별 수치와 증가량이 열려요.</p></div></div><div class="table-wrap desktop-only"><table class="data-table"><thead><tr><th>날짜</th>${METRICS.map(([, label]) => `<th>${label}<br><span class="legend-muted">당일 누적 / 전일 대비</span></th>`).join('')}<th>신규 콘텐츠</th></tr></thead><tbody>${days.length ? [...days].reverse().map(row => `<tr><td><button class="text-button row-date" data-action="day" data-date="${row.date}">${formatDate(row.date)} <span class="muted tiny">${new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(row.date + 'T00:00:00Z'))}</span>${icon('right')}</button></td>${METRICS.map(([key]) => `<td><span class="num">${number(row.metrics?.[key]?.total)}</span><span class="subnum">${delta(row.metrics?.[key]?.change?.delta)}</span></td>`).join('')}<td>${number(row.newPosts)}</td></tr>`).join('') : '<tr><td colspan="9" class="muted table-empty-cell">선택 기간을 불러오고 있어요.</td></tr>'}</tbody></table></div><div class="daily-card-list">${[...days].reverse().map(row => `<button class="daily-card" data-action="day" data-date="${row.date}"><span class="daily-card-head"><strong>${formatDate(row.date)} <small>${new Intl.DateTimeFormat('ko-KR',{weekday:'short',timeZone:'UTC'}).format(new Date(row.date+'T00:00:00Z'))}</small></strong><span>신규 ${number(row.newPosts)}개 ${icon('right')}</span></span><span class="daily-card-metrics">${['views','likes','followers'].map(key => `<span><small>${METRICS.find(row=>row[0]===key)[1]}</small><strong>${number(row.metrics?.[key]?.total)}</strong>${delta(row.metrics?.[key]?.change?.delta)}</span>`).join('')}</span></button>`).join('')}</div><p class="table-foot">조회수는 확인한 콘텐츠의 합계입니다. 채널 전체 조회수와 다를 수 있고, 도달은 콘텐츠 간 중복을 제거한 인원수가 아니에요. —는 미확인 또는 비교 불가입니다. 하루 증감은 두 날짜에 모두 기록된 같은 대상의 차이이며, 새 콘텐츠는 게시 전 0을 기준으로 계산해요.</p></section>`;
}
function groupsSection(report) {
  const groups = report?.groups || [];
  if (!groups.length) return '';
  return `<section class="section"><div class="section-head"><div><h2>채널별 기여도</h2><p>선택 종료일까지 최근 기록 합계 · 아래 작은 숫자는 선택 기간 증감</p></div><span class="subtle">${groups.length}개 채널</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>채널</th><th>콘텐츠</th>${METRICS.map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${groups.map(group => { const channel = state.data.channels.find(row => row.id === group.id); return `<tr><td><button class="text-button row-label" data-action="channel-detail" data-id="${escape(group.id)}">${escape(channel ? channelName(channel) : group.label)}</button><div class="tiny muted">${escape(channel ? platformLabel(channel.platform) : '')}</div></td><td>${number(group.postCount)}</td>${METRICS.map(([key]) => `<td>${metricCell(group.metrics?.[key])}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></section>`;
}
function memberGroupsSection(report) {
  if (!canManageTeam() || !(report?.memberGroups || []).length) return '';
  return `<section class="section"><div class="section-head"><div><h2>담당자별 성장</h2><p>수집 당시 담당자 기준 · 이관 경계를 넘는 증감은 비교하지 않아요.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>담당자</th><th>채널</th>${METRICS.slice(0, 4).map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${report.memberGroups.map(member => `<tr><td><button class="text-button" data-action="member-filter" data-id="${escape(member.id)}">${escape(member.name)}</button></td><td>${number(member.channelCount)}</td>${METRICS.slice(0, 4).map(([key]) => `<td>${metricCell(member.metrics?.[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="table-foot">${escape(report.memberGroupsBasis || '수집 당시 담당 기록을 사용합니다. 담당자 귀속이 확인되지 않은 과거 기록은 크루별 집계에서 제외하고, 공동 담당 채널은 회사 전체에서 한 번만 셉니다.')}</p></section>`;
}
function periodSection(report) {
  if (!report) return '';
  const comparable = report.metrics?.views?.period;
  return `<section class="section"><div class="section-head"><div><h2>기간별 증감</h2><p>${escape(state.start.replaceAll('-', '.'))} — ${escape(state.end.replaceAll('-', '.'))} · 같은 대상의 기준일과 종료일 기록을 비교해요.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>지표</th><th>최근 기록 합계</th><th>선택 기간 증감</th><th>증감률</th><th>직전 같은 일수 기간 증감</th><th>직전 기간 증감률</th><th>비교 가능 / 전체 대상</th></tr></thead><tbody>${METRICS.map(([key, label]) => { const metric = report.metrics?.[key]; return `<tr><td>${label}</td><td class="num">${number(metric?.latest)}</td><td class="num">${delta(metric?.period?.delta)}</td><td>${validNumber(metric?.period?.rate) ? delta(metric.period.rate, '%') : '—'}</td><td>${delta(metric?.previousPeriod?.delta)}</td><td>${validNumber(metric?.previousPeriod?.rate) ? delta(metric.previousPeriod.rate, '%') : '—'}</td><td>${number(metric?.period?.count ?? 0)} / ${number(metric?.period?.eligible ?? 0)}</td></tr>`; }).join('')}</tbody></table></div><p class="table-foot">선택 기간 기준일 ${escape(comparable?.baseDate || '—')} · 직전 기간은 선택 기간과 같은 일수입니다. 두 기간의 비교 대상 수가 다를 수 있어요. 기준 수치가 0이거나 기록이 없으면 증감률은 —로 표시해요.</p></section>`;
}
function passwordPanel() {
  return `<section class="settings-panel section"><h2>내 로그인 비밀번호</h2><p>바탕화면 바로가기로 처음 시작했다면 비밀번호를 등록해 주세요. 이메일과 비밀번호로도 로그인할 수 있습니다.</p><form class="form-stack" data-form="password"><div class="form-error" role="alert"></div><div class="field-row"><label class="field">현재 비밀번호<input name="oldPassword" type="password" autocomplete="current-password" placeholder="처음 설정할 때는 비워 두세요"></label><label class="field">새 비밀번호<input name="password" type="password" required minlength="12" maxlength="256" autocomplete="new-password" placeholder="12자 이상으로 입력해 주세요"></label><label class="field">새 비밀번호 확인<input name="confirmPassword" type="password" required minlength="12" maxlength="256" autocomplete="new-password" placeholder="한 번 더 입력해 주세요"></label></div><div><button type="submit" class="btn primary">비밀번호 저장</button></div></form></section>`;
}
function recentRuns(limit = 10) {
  const runs = (state.data.runs || []).slice(0, limit);
  if (!runs.length) return '';
  return `<section class="section"><div class="section-head"><div><h2>최근 수집 내역</h2><p>수집이 완료되었는지, 어떤 채널을 확인해야 하는지 알 수 있어요.</p></div>${state.tab==='settings'?button('새로고침', 'refresh', 'refresh', 'small'):''}</div><div class="run-list">${runs.map(run => `<div class="run">${statusBadge(run.status)}<div class="run-body"><div class="run-title">${escape(run.channelName || channelName(state.data.channels.find(row => row.id === run.channelId)))}</div><div class="run-message">${escape(run.message || (run.status === 'running' ? '채널에서 최신 기록을 가져오고 있어요.' : '수집 결과를 확인했어요.'))}</div><div class="run-time">${time(run.startedAt)}${run.finishedAt ? ` → ${time(run.finishedAt)}` : ''}</div></div></div>`).join('')}</div></section>`;
}
function channelsPage() {
  const channels=scopedChannels(),active=channels.filter(row=>row.active!==false),issues=active.filter(channelNeedsAttention).length;
  const actions=!isViewer()?button('전체 수집','collect-all','refresh','',busyRuns()?'disabled':'')+button('채널 등록','add-channel','plus','primary'):'';
  return `${pageHeading('','채널·수집 관리','계정 연결, 담당자, 수집 상태를 한곳에서 관리하세요.',actions)}${contextBar({period:false})}<div class="channel-management-summary"><div><span>관리 중</span><strong>${active.length}</strong></div><div><span>연결 완료</span><strong>${active.filter(row=>row.connected).length}</strong></div><div class="${issues?'needs-attention':''}"><span>확인 필요</span><strong>${issues}</strong></div><button type="button" class="text-button" data-action="refresh">${icon('refresh')}새로고침</button></div><div class="channel-status-filters" aria-label="채널 상태">${[['all','전체'],['attention','확인 필요'],['connected','연결 완료'],['archived','보관']].map(([id,label])=>`<button type="button" data-action="channel-status" data-filter="${id}" aria-pressed="${state.channelStatus===id}" class="${state.channelStatus===id?'active':''}">${label}</button>`).join('')}</div>${channels.length?`${channelToolbar(channels)}<div class="channel-list">${channels.map(channelCard).join('')}</div><div id="channel-search-empty" ${channels.some(channelVisible)?'hidden':''}>${empty('조건에 맞는 채널이 없어요','다른 상태를 선택하거나 검색어를 바꿔 보세요.','',true,'link')}</div>`:empty('우리 팀의 첫 채널을 등록해 볼까요?','채널을 등록하면 연결과 수집 상태를 함께 확인할 수 있어요.','',false,'link')}<details class="collection-history"><summary>최근 수집 기록</summary>${recentRuns(12)}</details>`;
}
function channelNeedsAttention(channel){
  if(channel.active===false)return false;
  const health=healthItems().find(row=>row.channelId===channel.id);
  return health?health.action==='connect'||/error|failed|partial|expired|reconnect/.test(health.status):autoSupported(channel.platform)&&!channel.connected;
}
function channelCollectionNote(channel){
  const item=healthItems().find(row=>row.channelId===channel.id);
  if(!item||(!item.nextRetryAt&&!/partial/.test(item.status)))return '';
  return `<div class="channel-collection-note"><span>${escape(item.reason||item.label||'수집 결과 대기')}</span>${item.nextRetryAt?`<small>다음 재시도 ${time(item.nextRetryAt)}</small>`:''}</div>`;
}
function channelCard(channel) {
  const inactive = channel.active === false, supported = autoSupported(channel.platform);
  return `<article class="channel-card ${inactive ? 'inactive' : ''}" data-channel-card="${escape(channel.id)}" ${channelVisible(channel) ? '' : 'hidden'}><div class="channel-card-top">${platformMark(channel.platform)}<div class="channel-title-block"><span class="channel-platform">${escape(platformLabel(channel.platform))}</span><h3 class="channel-title">${escape(channelName(channel))}</h3></div>${supported ? statusBadge(inactive ? 'archived' : channel.status,channel.connected) : '<span class="status-badge">기존 기록 보관</span>'}</div><a class="channel-url" href="${escape(safeUrl(channel.canonicalUrl))}" target="_blank" rel="noopener noreferrer">${escape(channel.handle || channel.canonicalUrl)} ${icon('external')}</a><div class="channel-ownership"><span class="owner-avatar">${escape(channel.owners?.[0]?.name?.slice(0,1) || '?')}</span><div><strong>${escape((channel.owners || []).map(row => row.name).join(', ') || '담당자 미지정')}</strong><span>${escape(channel.teamName || (state.data.teams || []).find(team => team.id === channel.teamId)?.name || '팀 미배정')}</span></div></div>${channel.pendingHandoff ? '<div class="handoff-banner">'+icon('users')+'<span><strong>담당자 이관 확인 중</strong>새 담당자가 계정을 연결하면 이관이 완료돼요.</span></div>' : ''}${channel.lastError ? `<div class="channel-error">${escape(channel.lastError)}</div>` : ''}${channel.warnings?.length ? `<div class="channel-warning">${channel.warnings.map(escape).join('<br>')}</div>` : ''}${channelCollectionNote(channel)}<div class="channel-last">${icon('clock')}마지막 수집 ${time(channel.lastCollectedAt)}</div><div class="channel-bottom">${canConnectChannel(channel) ? button(!supported ? '지원 안내' : channel.connected ? '연결 관리' : '계정 연결','connect','link','small',`data-id="${escape(channel.id)}"`) : ''}${!inactive && supported && canEditChannel(channel) ? button('수집','collect','refresh','small',`data-id="${escape(channel.id)}" ${['running','queued','collecting'].includes(channel.status) ? 'disabled' : ''}`) : ''}${canManageChannelOwners(channel) ? button('담당자·이관','owners','users','small quiet',`data-id="${escape(channel.id)}"`) : ''}${button('이력','channel-history','','small quiet',`data-id="${escape(channel.id)}"`)}${canEditChannel(channel) ? button('관리','channel-settings','settings','small quiet',`data-id="${escape(channel.id)}"`) : ''}</div></article>`;
}

function channelSearchText(channel) { return [channelName(channel), channel.canonicalUrl, ...(channel.owners || []).map(row => row.name)].join(' ').toLocaleLowerCase(); }
function channelVisible(channel) { return scopedChannels().some(row => row.id === channel.id) && (state.channelStatus==='all'||(state.channelStatus==='attention'&&channelNeedsAttention(channel))||(state.channelStatus==='connected'&&channel.active!==false&&channel.connected)||(state.channelStatus==='archived'&&channel.active===false)) && (!state.channelPlatform || platformKey(channel.platform) === state.channelPlatform) && channelSearchText(channel).includes(state.channelSearch.trim().toLocaleLowerCase()); }
function channelToolbar(channels) { return `<div class="channel-toolbar"><label class="search-field">${icon('link')}<input type="search" aria-label="채널과 담당자 검색" data-channel-search value="${escape(state.channelSearch)}" placeholder="채널 이름, 주소, 담당자로 찾기"></label><select class="filter-select" aria-label="등록 채널 플랫폼" data-channel-platform><option value="">모든 플랫폼</option>${[...new Set(channels.map(row => platformKey(row.platform)))].map(key => `<option value="${escape(key)}" ${state.channelPlatform === key ? 'selected' : ''}>${escape(platformLabel(key))}</option>`).join('')}</select><span class="tiny muted" id="channel-visible-count">${channels.filter(channelVisible).length}개 채널</span></div>`; }
function filterChannelCards() { let count = 0; document.querySelectorAll('[data-channel-card]').forEach(card => { const channel = state.data.channels.find(row => row.id === card.dataset.channelCard); const visible = channel && channelVisible(channel); card.hidden = !visible; if (visible) count++; }); const label = $('#channel-visible-count'); if (label) label.textContent = `${count}개 채널`; const empty = $('#channel-search-empty'); if (empty) empty.hidden = count > 0; }
function membersPage() {
  const members = state.data.members || [], teams = state.data.teams || [];
  return `${pageHeading('PEOPLE & TEAMS',isAdmin() ? '팀이 같은 방향을 볼 수 있도록.' : '우리 팀의 담당 현황','팀과 역할을 정하고, 담당 채널을 명확하게 연결하세요.',isAdmin() ? `${button('새 팀','team-edit','plus')}${button('크루 초대','invite','users','primary')}` : '')}${state.data.deployment?.localOnly ? '<div class="note-box mb-24">' + icon('globe') + '<div><strong>현재 이 컴퓨터에서 운영 중입니다.</strong> 크루가 자기 컴퓨터로 접속하려면 회사 공용 서버와 주소를 먼저 연결해야 해요.</div></div>' : ''}<div class="section-head"><div><h2>팀</h2><p>조직을 먼저 정리하면 팀별 성과와 수집 상태를 함께 볼 수 있어요.</p></div><span class="quiet-label">${teams.length}개 팀</span></div>${teams.length ? `<div class="team-grid">${teams.map(team => `<article class="team-card ${team.active === false ? 'inactive' : ''}"><div class="team-card-head"><span class="team-symbol">${icon('users')}</span>${team.active === false ? '<span class="status-badge">운영 중지</span>' : '<span class="status-badge good">운영 중</span>'}</div><h3>${escape(team.name)}</h3><div class="team-card-stats"><span>팀원 <strong>${number(team.memberCount ?? members.filter(row => row.teamId === team.id).length)}</strong></span><span>채널 <strong>${number(team.channelCount ?? state.data.channels.filter(row => row.teamId === team.id).length)}</strong></span></div><div class="team-card-actions">${button('팀 현황','team-scope','arrow','small quiet',`data-id="${escape(team.id)}"`)}${isAdmin() ? button('편집','team-edit','','small',`data-id="${escape(team.id)}"`) : ''}</div></article>`).join('')}</div>` : empty('첫 팀을 만들어 주세요','예를 들어 콘텐츠팀, 해외운영팀처럼 실제 업무를 나누는 기준으로 시작할 수 있어요.','',true,'users')}<section class="section"><div class="section-head"><div><h2>크루와 역할</h2><p>관리자 · 팀장 · 실무자 · 조회 전용 권한을 구분합니다.</p></div><span class="quiet-label">${members.length}명</span></div><div class="people-list">${members.map(member => { const team = teams.find(row => row.id === member.teamId), count = state.data.channels.filter(row => row.owners?.some(owner => owner.id === member.id) && row.active !== false).length; return `<article class="person-row"><span class="avatar">${escape(member.name?.slice(0,1) || '?')}</span><div class="person-identity"><strong>${escape(member.name)}${member.id === state.user.id ? ' <span class="self-label">나</span>' : ''}</strong><span>${escape(member.email)}</span></div><div class="person-team"><span>${escape(team?.name || '팀 미배정')}</span><strong>${roleLabel(member.role)}</strong></div><div class="person-channels"><strong>${count}</strong><span>담당 채널</span></div><span class="status-badge ${member.active !== false ? 'good' : ''}">${member.active !== false ? '이용 중' : '이용 중지'}</span><div class="person-actions">${isAdmin() && member.id===state.user.id?button('내 팀 설정','member-assignment','','small',`data-id="${escape(member.id)}"`):''}${isAdmin() && member.id !== state.user.id && member.role !== 'admin' ? `${button('팀·역할','member-assignment','','small',`data-id="${escape(member.id)}"`)}${member.role !== 'admin' ? button(member.active !== false ? '중지' : '재개','member-status','','small quiet',`data-id="${escape(member.id)}"`) : ''}` : ''}</div></article>`; }).join('')}</div></section><div class="note-box section">${icon('info')}<div>팀장은 소속 팀, 실무자는 배정된 채널을 관리합니다. 조회 전용 크루는 허용된 범위의 성과만 볼 수 있어요. 채널 담당자 변경은 채널의 <strong>담당자·이관</strong>에서 진행하세요.</div></div>`;
}
function settingsPage() {
  const schedule = state.data.schedule || {};
  return `<header class="page-heading"><div><h1>설정</h1><p>한 번 연결하고, 정해진 시간에 팀 전체의 데이터를 수집하세요.</p></div></header><div class="settings-grid"><section class="settings-panel"><h2>회사와 수집 시간</h2><p>프로그램이 실행 중일 때 한국 시간 기준으로 수집합니다.</p><form class="form-stack" data-form="settings"><div class="form-error" role="alert"></div><label class="field">회사 이름<input name="companyName" value="${escape(state.data.companyName || 'SYNK')}" required maxlength="100"></label><label class="check-row"><input type="checkbox" name="enabled" ${schedule.enabled ? 'checked' : ''}><span>일별 집계와 30분 하이라이트 자동 수집</span></label><label class="field">일별 전체 수집 시간<select name="hourKst">${Array.from({ length: 24 }, (_, i) => `<option value="${i}" ${Number(schedule.hourKst ?? 9) === i ? 'selected' : ''}>${String(i).padStart(2, '0')}:00 · 한국 시간</option>`).join('')}</select><small>최근 7일 게시물은 별도로 30분마다 확인합니다. 컴퓨터나 서버가 꺼져 있으면 수집은 실행되지 않아요.</small></label><div><button type="submit" class="btn primary">설정 저장</button></div></form></section><section class="settings-panel"><h2>기존 SYNK 기록 가져오기</h2><p>기존 개인용 SNS 성장 현황에 등록된 채널과 수동 기록을 이 회사 공간으로 가져옵니다.</p><div class="note-box">${icon('inbox')}<div>이미 가져온 항목은 중복으로 만들지 않아요. 가져온 채널의 담당자는 관리자이며, 담당 채널에서 다시 배정할 수 있어요.</div></div><div class="mt-23">${button('기존 채널과 기록 가져오기', 'import-legacy', 'download', '', state.data.legacyImportAvailable === false ? 'disabled' : '')}</div>${state.data.legacyImportAvailable === false ? '<p class="tiny muted mt-12">현재 가져올 기존 기록이 없어요.</p>' : ''}</section></div>${passwordPanel()}<section class="section"><div class="section-head"><div><h2>플랫폼 연결 준비</h2><p>관리자가 한 번 준비하면 크루는 각 채널의 ‘계정 연결’로 자신의 계정에 로그인할 수 있어요.</p></div></div><div class="capability-grid">${(state.data.capabilities || []).filter(row => autoSupported(row.id)).map(capabilityCard).join('')}</div></section>${recentRuns()}`;
}
function capabilityCard(capability) {
  const provider = providerFor(capability.id), requirements = requirementText(provider?.requirements || capability.requirements);
  const metricNames = Array.isArray(capability.metrics) ? capability.metrics.map(item => typeof item === 'string' ? METRICS.find(row => row[0] === item)?.[1] || item : item.label || item.key).join(' · ') : '';
  return `<article class="capability"><div class="capability-title">${platformMark(capability.id)}<span>${escape(capability.label || platformLabel(capability.id))}</span><span class="status-badge push-right ${provider?.configured ? 'good' : 'warn'}">${provider?.configured ? '앱 연결 준비됨' : '관리자 설정 필요'}</span></div><ul>${requirements.map(item => `<li>${escape(item)}</li>`).join('')}</ul>${metricNames ? `<div class="metrics-label">제공 범위 · ${escape(metricNames)}<br>계정 유형·권한·콘텐츠에 따라 일부 지표가 없을 수 있어요.</div>` : ''}<div class="link-row mt-16">${button('연결 설정', 'provider', 'settings', 'small', `data-platform="${escape(capability.id)}"`)}${capability.docsUrl ? `<a href="${escape(safeUrl(capability.docsUrl))}" target="_blank" rel="noopener noreferrer" class="tiny">공식 연결 안내 ↗</a>` : ''}</div></article>`;
}

function modal(title, subtitle, body, wide = false, drawer = false) {
  if(typeof hideChartLeaders==='function')hideChartLeaders();
  state.modalRequest++;
  state.returnFocus = document.activeElement;
  overlay.innerHTML = `<div class="modal-backdrop ${drawer ? 'drawer-backdrop' : ''}"><section class="modal ${wide ? 'wide' : ''} ${drawer ? 'drawer' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button type="button" class="modal-close" data-action="close-modal" aria-label="닫기">${icon('close')}</button></header><div class="modal-body">${body}</div></section></div>`;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => (overlay.querySelector('input:not([type="hidden"]),textarea,select') || overlay.querySelector('button'))?.focus());
}
function closeModal() { if(typeof clientSearchCancel==='function')clientSearchCancel();state.modalRequest++; overlay.innerHTML = ''; document.body.classList.remove('modal-open'); state.returnFocus?.focus?.(); state.returnFocus = null; }
function addChannelModal() { modal('담당 채널 등록', '페이지 주소를 한 줄에 하나씩 붙여넣어 주세요.', `<form class="form-stack" data-form="add-channels"><div class="form-error" role="alert"></div><label class="field">채널 주소<textarea name="urls" required placeholder="https://www.youtube.com/@우리채널\nhttps://www.instagram.com/우리계정/\nhttps://www.facebook.com/우리페이지\nhttps://www.tiktok.com/@우리계정"></textarea><small>여러 주소를 한 번에 등록할 수 있어요. 이미 등록된 주소는 중복으로 만들지 않습니다.</small></label>${isAdmin() ? `<label class="field">담당자<select name="ownerId">${(state.data.members || []).filter(row => row.active !== false && row.role !== 'viewer').map(row => `<option value="${escape(row.id)}" ${row.id === state.user.id ? 'selected' : ''}>${escape(row.name)}</option>`).join('')}</select></label>` : ''}<div class="note-box">${icon('info')}<div>주소를 등록한 뒤 해당 채널의 <strong>계정 연결</strong>을 진행해 주세요. 첫 수집이 완료되면 실제 콘텐츠와 수치를 볼 수 있어요.</div></div><div class="modal-actions">${button('취소', 'close-modal')}<button type="submit" class="btn primary">채널 등록${icon('plus')}</button></div></form>`); }
async function dayModal(date) {
  modal(`${escape(date.replaceAll('-', '.'))}의 성장 기록`, '이날의 기록과 콘텐츠별 전일 대비 증감을 확인하세요.', '<div class="loading-panel"><span class="loading-line"></span></div>', true, true);
  const request = ++state.modalRequest;
  try {
    const report = await api(`/api/day?${query({ date, start: undefined, end: undefined })}`);
    if (request !== state.modalRequest) return;
    const day = report.daily?.find(row => row.date === date), metrics = report.metrics || day?.metrics || {};
    const posts = report.byPost || [];
    $('.modal-body', overlay).innerHTML = `<div class="day-metrics">${METRICS.map(([key, label]) => { const metric = metrics[key]; return `<div class="day-metric"><div class="label">${label}</div><div class="number">${number(metric?.total)}</div><div>${delta(metric?.day?.delta ?? metric?.change?.delta)} <span class="tiny muted">전일 대비</span></div><div class="tiny muted mt-5">당일 기록 ${number(metric?.count ?? 0)} / ${number(metric?.eligible ?? 0)}</div></div>`; }).join('')}</div><div class="section-head"><div><h3>콘텐츠별 상세</h3><p>큰 숫자는 당일 누적값, 아래 숫자는 전일 대비 증감이에요.</p></div><span class="subtle">${posts.length}개 콘텐츠</span></div>${posts.length ? `<div class="table-wrap desktop-only"><table class="data-table"><thead><tr><th>콘텐츠</th>${METRICS.filter(row => row[0] !== 'followers').map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${[...posts].sort((a, b) => (b.metrics?.views?.day?.delta ?? -Infinity) - (a.metrics?.views?.day?.delta ?? -Infinity)).map(post => `<tr><td class="post-cell"><a class="post-title" href="${escape(safeUrl(post.url))}" target="_blank" rel="noopener noreferrer">${escape(post.title || '제목 없는 콘텐츠')} ↗</a><div class="post-meta">${escape(channelName(state.data.channels.find(row => row.id === post.channelId)))} · ${escape(post.publishedDate || '')}${post.publishedDate === date ? ' <span class="status-badge good">신규</span>' : ''}</div></td>${METRICS.filter(row => row[0] !== 'followers').map(([key]) => `<td><span class="num">${number(post.metrics?.[key]?.total)}</span><span class="subnum">${delta(post.metrics?.[key]?.day?.delta)}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="day-post-list mobile-only">${posts.map(post => `<article class="day-post-card"><a class="post-title" href="${escape(safeUrl(post.url))}" target="_blank" rel="noopener noreferrer">${escape(post.title || '제목 없는 콘텐츠')} ↗</a><p class="post-meta">${escape(channelName(state.data.channels.find(row=>row.id===post.channelId)))} · ${escape(post.publishedDate || '')}</p><div class="day-post-metrics">${METRICS.filter(row=>row[0]!=='followers').map(([key,label])=>`<div><span>${label}</span><strong>${number(post.metrics?.[key]?.total)}</strong>${delta(post.metrics?.[key]?.day?.delta)}</div>`).join('')}</div></article>`).join('')}</div>` : empty('이 날짜까지 확인한 콘텐츠가 없어요', '채널에서 콘텐츠를 수집하면 이곳에 실제 게시물이 표시됩니다.', '', true, 'inbox')}<p class="table-foot">팔로워·구독자는 채널 지표라 콘텐츠별로 나누지 않아요. 미제공·미수집 수치는 0으로 바꾸지 않습니다. 수집 전 과거의 일별 성과는 추정해서 채우지 않아요.</p>`;
  } catch (err) { if (request === state.modalRequest) $('.modal-body', overlay).innerHTML = `<div class="form-error">${escape(err.message)}</div>`; }
}
function connectModal(id) {
  const channel = state.data.channels.find(row => row.id === id); if (!channel) return;
  if (!autoSupported(channel.platform)) { modal(`${escape(platformLabel(channel.platform))} 수집 안내`, escape(channelName(channel)), '<div class="note-box">' + icon('info') + '<div>이 플랫폼의 기존 채널 주소와 기록을 보관하고 있어요. 현재 자동 수집은 YouTube·Instagram·Facebook·TikTok부터 지원합니다. 이 채널의 기존 수집 기록은 전체 현황에서 볼 수 있습니다.</div></div>'); return; }
  const provider = providerFor(channel.platform), capability = capabilityFor(channel.platform);
  const requirements = requirementText(capability?.requirements);
  const key = platformKey(channel.platform);
  const manualFields = key === 'youtube' ? '<label class="field">YouTube Data API 키<input name="apiKey" type="password" autocomplete="off" required placeholder="API 키 입력"></label>' : `<label class="field">액세스 토큰<input name="accessToken" type="password" autocomplete="off" required placeholder="권한이 승인된 토큰 입력"></label>${['instagram', 'facebook'].includes(key) ? `<label class="field">${key === 'instagram' ? 'Instagram 비즈니스 계정 ID' : 'Facebook 페이지 ID'}<input name="accountId" required autocomplete="off"></label><label class="field">API 버전<input name="apiVersion" placeholder="관리 중인 앱의 API 버전" autocomplete="off"></label>` : ''}`;
  modal(`${escape(platformLabel(channel.platform))} 계정 연결`, escape(channelName(channel)), `<div class="connection-status">${statusBadge(channel.status, channel.connected)} <span class="tiny muted">${channel.connected ? '연결 정보 등록됨 · 수집 결과를 확인해 주세요' : '아직 연결 정보가 없어요'}</span></div><div class="connection-help">${requirements.length ? `<ul>${requirements.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : '<p>해당 페이지를 관리하는 계정으로 로그인하고 수치 조회 권한을 허용해 주세요.</p>'}${capability?.docsUrl ? `<a href="${escape(safeUrl(capability.docsUrl))}" target="_blank" rel="noopener noreferrer">공식 연결 안내 확인 ↗</a>` : ''}</div>${provider?.configured ? `<a class="btn primary" href="/api/oauth/${encodeURIComponent(key)}/start?channelId=${encodeURIComponent(id)}">${icon('link')}${escape(platformLabel(channel.platform))}에서 ${channel.connected ? '다시 연결' : '계정 연결'}</a><p class="tiny muted mt-13">플랫폼 로그인 화면에서 담당 계정과 페이지를 확인해 주세요.</p>` : `<div class="note-box">${icon('info')}<div><strong>관리자의 첫 연결 준비가 필요해요.</strong><br>${isAdmin() ? '수집 설정에서 플랫폼 앱을 등록하면 팀원이 자신의 계정으로 연결할 수 있어요.' : '회사 관리자에게 이 플랫폼의 연결 설정을 요청해 주세요. 준비가 끝나면 이 버튼으로 직접 로그인할 수 있어요.'}</div></div>${isAdmin() ? `<div class="mt-15">${button('플랫폼 연결 설정', 'provider', 'settings', '', `data-platform="${escape(key)}"`)}</div>` : ''}`}${channel.connected && canEditChannel(channel) ? `<div class="mt-20">${button('계정 연결 해제', 'disconnect', '', 'small danger', `data-id="${escape(id)}"`)}</div>` : ''}${isAdmin() ? `<details class="advanced"><summary>관리자용 직접 연결</summary><p class="tiny muted mt-10">이미 발급받은 연결 정보가 있을 때만 사용해 주세요. 저장된 비밀값은 다시 표시하지 않습니다.</p><form class="form-stack" data-form="connection" data-id="${escape(id)}"><div class="form-error" role="alert"></div>${manualFields}<button type="submit" class="btn">연결 정보 저장</button></form></details>` : ''}`);
}
function providerModal(platform) {
  const key = platformKey(platform), provider = providerFor(key), capability = capabilityFor(key);
  modal(`${escape(platformLabel(platform))} 연결 설정`, '관리자가 한 번 등록하면 팀원이 계정 연결을 사용할 수 있어요.', `<form class="form-stack" data-form="provider" data-platform="${escape(key)}"><div class="form-error" role="alert"></div><div class="note-box">${icon('info')}<div>플랫폼의 개발자 앱에서 수치 조회 권한을 승인받고 아래 정보를 등록해 주세요. <strong>앱 정보 저장만으로 실제 계정 연결이나 권한 승인이 완료되는 것은 아니에요.</strong></div></div>${provider?.redirectUri ? `<label class="field">플랫폼 앱에 등록할 리디렉션 주소<div class="link-row"><input readonly value="${escape(provider.redirectUri)}" aria-label="리디렉션 주소"><button type="button" class="btn small" data-action="copy" data-value="${escape(provider.redirectUri)}">${icon('copy')}복사</button></div><small>플랫폼 앱의 OAuth 리디렉션 주소에 그대로 등록해 주세요.</small></label>` : ''}<label class="field">${key === 'tiktok' ? 'Client key' : 'Client ID / 앱 ID'}<input name="clientId" autocomplete="off" placeholder="${provider?.configured ? '변경할 때만 입력' : '플랫폼 개발자 앱의 ID'}"></label><label class="field">Client secret / 앱 시크릿<input name="clientSecret" type="password" autocomplete="new-password" placeholder="${provider?.configured ? '변경할 때만 입력' : '플랫폼 개발자 앱의 시크릿'}"><small>저장된 시크릿은 화면에 다시 표시하지 않아요.</small></label>${key === 'youtube' ? '<label class="field">YouTube 공개 데이터 API 키 <span class="muted tiny">선택</span><input name="apiKey" type="password" autocomplete="off" placeholder="공개 데이터 수집에 사용할 API 키"><small>API 키를 등록하면 연결한 채널의 공개 수치를 수집할 수 있어요.</small></label>' : ''}${capability?.docsUrl ? `<a class="tiny" href="${escape(safeUrl(capability.docsUrl))}" target="_blank" rel="noopener noreferrer">${escape(platformLabel(platform))} 공식 연결 문서 ↗</a>` : ''}<div class="modal-actions">${button('취소', 'close-modal')}<button type="submit" class="btn primary">연결 설정 저장</button></div></form>`);
}
function teamOptions(selected = '', allowEmpty = true) { return `${allowEmpty ? '<option value="">팀 미배정</option>' : ''}${(state.data.teams || []).filter(team => team.active !== false || team.id === selected).map(team => `<option value="${escape(team.id)}" ${team.id === selected ? 'selected' : ''}>${escape(team.name)}</option>`).join('')}`; }
function roleOptions(selected = 'member', admin = false) { return [...(admin ? ['admin'] : []),'manager','member','viewer'].map(role => `<option value="${role}" ${selected === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join(''); }
function ownersModal(id) {
  const channel = state.data.channels.find(row => row.id === id); if (!channel || !canManageChannelOwners(channel)) return;
  modal('담당자와 팀 이관',escape(channelName(channel)),`<form class="form-stack" data-form="owners" data-id="${escape(id)}"><div class="form-error" role="alert"></div>${channel.pendingHandoff ? '<div class="note-box">'+icon('clock')+'<div><strong>이관이 진행 중입니다.</strong>새 담당자가 계정 연결을 마치면 완료됩니다. 다른 이관을 시작하려면 이력에서 진행 중인 요청을 취소해 주세요.</div></div>' : ''}${isAdmin() ? `<label class="field">소속 팀<select name="teamId">${teamOptions(channel.teamId)}</select></label>` : ''}<div class="owner-options">${(state.data.members || []).filter(row => row.active !== false && row.role !== 'viewer').map(member => `<label class="check-row"><input type="checkbox" name="userIds" value="${escape(member.id)}" ${channel.owners?.some(owner => owner.id === member.id) ? 'checked' : ''}><span>${escape(member.name)} <small>${roleLabel(member.role)}</small><br><small>${escape(member.email)}</small></span></label>`).join('')}</div><label class="field">변경 사유<input name="reason" maxlength="300" placeholder="예: 해외 운영팀으로 담당 업무 이관"></label><div class="note-box">${icon('info')}<div>계정을 연결한 기존 담당자를 제외하면 <strong>새 담당자의 계정 연결이 완료될 때까지 현재 담당을 유지</strong>합니다. 이전 기록은 당시 담당자에게 남고 이관 시점에서 비교 기준을 새로 만듭니다.</div></div><div class="modal-actions">${button('이관 이력','channel-history','','',`data-id="${escape(id)}"`)}<button class="btn primary" type="submit" ${channel.pendingHandoff ? 'disabled' : ''}>담당자 저장</button></div></form>`);
}
function inviteModal() { modal('같이 성장할 크루를 초대하세요.','팀과 역할을 정한 뒤 초대 링크를 전달해 주세요.',`<form class="form-stack" data-form="invite"><div class="form-error" role="alert"></div><label class="field">이름<input name="name" required maxlength="80" autocomplete="off" placeholder="이름을 입력해 주세요"></label><label class="field">로그인 이메일<input name="email" type="email" required maxlength="254" autocomplete="off" placeholder="name@company.com"></label><div class="field-row"><label class="field">소속 팀<select name="teamId">${teamOptions()}</select></label><label class="field">역할<select name="role">${roleOptions()}</select></label></div><p class="notice">팀장은 소속 팀을 관리합니다. 조회 전용은 허용된 팀의 성과만 볼 수 있어요. 초대 메일은 자동 발송하지 않으며, 만들어진 링크를 직접 전달해 주세요.</p><div class="modal-actions">${button('취소','close-modal')}<button type="submit" class="btn primary">초대 링크 만들기${icon('arrow')}</button></div></form>`); }
function teamModal(id) { const team = (state.data.teams || []).find(row => row.id === id); modal(team ? '팀 정보 편집' : '새 팀 만들기','실제 업무를 함께하는 팀을 기준으로 정리하세요.',`<form class="form-stack" data-form="team" data-id="${escape(id || '')}"><div class="form-error" role="alert"></div><label class="field">팀 이름<input name="name" value="${escape(team?.name || '')}" required maxlength="80" placeholder="예: 콘텐츠팀"></label>${team ? `<label class="check-row"><input type="checkbox" name="active" ${team.active !== false ? 'checked' : ''}><span>팀 운영 중</span></label><p class="notice">팀 운영을 중지해도 기존 팀과 담당 기록은 남습니다. 소속 크루와 채널이 있다면 먼저 다른 팀으로 정리해 주세요.</p>` : ''}<div class="modal-actions">${button('취소','close-modal')}<button class="btn primary" type="submit">${team ? '변경 저장' : '팀 만들기'}</button></div></form>`); }
function assignmentModal(id) {
  const member=(state.data.members||[]).find(row=>row.id===id),own=member?.id===state.user.id;
  if(!member||!isAdmin()||(member.role==='admin'&&!own))return;
  modal(own?'내 소속 팀':'크루의 팀과 역할',escape(member.name),`<form class="form-stack" data-form="assignment" data-id="${escape(id)}"><div class="form-error" role="alert"></div><label class="field">소속 팀<select name="teamId">${teamOptions(member.teamId)}</select></label>${own?'<p class="muted">소속 팀을 선택하면 팀 대화방에 참여할 수 있어요. 관리자 역할은 유지됩니다.</p>':`<label class="field">역할<select name="role">${roleOptions(member.role)}</select></label><div class="note-box">${icon('lock')}<div>팀장은 소속 팀, 실무자는 담당 채널을 관리합니다. 역할을 바꾸면 접근할 수 있는 범위가 달라져요.</div></div>`}<div class="modal-actions">${button('취소','close-modal')}<button class="btn primary" type="submit">${own?'소속 팀 저장':'팀·역할 저장'}</button></div></form>`);
}
function channelSettingsModal(id) { const channel=state.data.channels.find(row=>row.id===id);if(!channel)return;modal('채널 관리',escape(channelName(channel)),`<form class="form-stack" data-form="channel-details" data-id="${escape(id)}"><div class="form-error" role="alert"></div><label class="field">화면에 표시할 이름<input name="displayName" required maxlength="150" value="${escape(channel.displayName)}"></label><div class="field-row"><label class="field">브랜드<input name="brand" maxlength="80" value="${escape(channel.brand || '')}" placeholder="예: LAB"></label><label class="field">국가<input name="country" maxlength="80" value="${escape(channel.country || '')}" placeholder="예: 몽골"></label></div><label class="field">콘텐츠 언어<input name="language" maxlength="80" value="${escape(channel.language || '')}" placeholder="예: 몽골어"></label><div class="modal-actions">${button(channel.active===false?'관리 재개':'관리 중지','archive','','quiet',`data-id="${escape(id)}"`)}<button type="submit" class="btn primary">정보 저장</button></div></form>`); }
function postDrawer(id) {
  const post = (state.report?.byPost || []).find(row => row.id === id); if(!post)return; const channel=state.data.channels.find(row=>row.id===post.channelId);
  modal('콘텐츠 성과',`${escape(channelName(channel))} · ${escape(post.publishedDate || '')}`,`<div class="post-drawer-hero">${post.thumbnailUrl ? `<img src="${escape(safeUrl(post.thumbnailUrl))}" alt="">` : `<span class="content-placeholder">${icon('play')}</span>`}</div><h2 class="post-drawer-title">${escape(post.title || '제목 없는 콘텐츠')}</h2><a class="btn small" href="${escape(safeUrl(post.url))}" target="_blank" rel="noopener noreferrer">원본 콘텐츠 보기 ${icon('external')}</a><div class="drawer-period"><strong>${state.start.replaceAll('-','.')} — ${state.end.replaceAll('-','.')}</strong><span>선택 기간 · ${escape(scopeLabel())}</span></div><div class="post-metric-grid">${METRICS.filter(row=>row[0]!=='followers').map(([key,label])=>{const metric=post.metrics?.[key];return `<article><span>${label}</span><strong>${number(metric?.latest)}</strong><div>${delta(metric?.period?.delta)} <span>기간 증감</span></div><small>전일 대비 ${deltaText(metric?.day?.delta)}</small></article>`;}).join('')}</div><div class="note-box section">${icon('info')}<div>플랫폼이 제공하지 않거나 수집하지 못한 값은 —로 표시합니다. 게시일이 오래된 콘텐츠의 첫 관측값을 오늘의 증가로 계산하지 않아요.</div></div>`,false,true);
}

function confirmModal(title, explanation, action, id = '') { modal(title, '', `<p class="notice">${explanation}</p><div class="form-error" role="alert"></div><div class="modal-actions">${button('취소', 'close-modal')}${button('확인', action, '', 'primary', `data-id="${escape(id)}"`)}</div>`); }

document.addEventListener('toggle', event => {
  const target=event.target;
  if(target.id!=='growth-home-extras'||!target.isConnected||state.tab!=='overview')return;
  const opened=target.open&&!state.homeExtrasOpen;state.homeExtrasOpen=target.open;
  if(opened&&!isDemoMode())void loadHype();
},true);
document.addEventListener('click', async event => {
  if (event.target.classList.contains('modal-backdrop')) { closeModal(); return; }
  const target = event.target.closest('[data-action]'); if (!target || target.disabled) return;
  const action = target.dataset.action, id = target.dataset.id;
  try {
    if(target.closest('#workspace-sidebar')&&workspaceSidebarBlocksContent())setWorkspaceSidebar(false);
    if(action==='workspace-sidebar-toggle'){setWorkspaceSidebar(!workspaceSidebarExpanded());return;}
    if(action==='workspace-sidebar-close'){setWorkspaceSidebar(false);return;}
    if (action === 'share-workspace') { shareWorkspaceView(); return; }
    if (action === 'messenger-retry') { retryWorkspaceModule(); return; }
    if (action === 'command') { commandModal(); return; }
    if (action === 'growth-metric') { if(METRICS.some(([key])=>key===target.dataset.metric))state.metric=target.dataset.metric; render(); return; }
    if (action === 'metric-focus') { state.ownerId = ''; state.platform = ''; state.channel = ''; state.metric = target.dataset.metric; state.tab = 'analysis'; state.report = null; await loadReport(); window.scrollTo(0,0); return; }
    if (action === 'platform-focus') { state.platform = target.dataset.platform; state.channel = ''; state.ownerId = ''; state.tab = 'analysis'; state.report = null; await loadReport(); window.scrollTo(0,0); return; }
    if(action==='report-view'){selectWorkspaceView(target.dataset.view);state.report=null;await loadReport();window.scrollTo(0,0);return;}
    if(action==='marketing-section'){selectWorkspaceView(target.dataset.tab);state.error='';state.report=null;render();if(reportTabs())await loadReport();if(state.tab==='content')await loadContentWorkspace();window.scrollTo(0,0);return;}
    if(action==='channel-status'){state.channelStatus=target.dataset.filter;render();return;}
    if(action==='workspace-manage'){modal('워크스페이스 관리','',`<div class="workspace-management-links">${workspaceUtilityTabs().map(([id,label,glyph])=>button(label,'command-tab',glyph,'',`data-tab="${id}"`)).join('')}</div>`);return;}
    if (action === 'command-tab') { closeModal(); selectWorkspaceView(target.dataset.tab); state.report = null; render(); if(reportTabs())await loadReport(); if(state.tab==='content')await loadContentWorkspace(); window.scrollTo(0,0); return; }
    if (action === 'command-channel') { closeModal(); state.scope = 'all'; state.teamId = ''; state.channelSearch = ''; state.channelPlatform = ''; state.tab = 'channels'; render(); await historyDrawer(id); return; }
    if (action === 'reload') { location.reload(); return; }
    if (action === 'auth-login') { state.authMode = 'login'; state.authToken = ''; renderAuth(); return; }
    if (action === 'scope') {
      state.scope=['mine','team'].includes(target.dataset.scope)?target.dataset.scope:'all';
      if(state.scope!=='team')state.teamId='';
      normalizeMarketingScope();state.ownerId='';state.channel='';state.platform='';state.report=null;render();if(reportTabs())await loadReport();return;
    }
    if (action === 'comparison-more') { state.comparisonExpanded = !state.comparisonExpanded; render(); return; }
    if (action === 'team-overview-retry') { await loadTeamOverview(true); return; }
    if (action === 'team-overview-select') { selectWorkspaceView('team','',id); await loadReport(); if(state.tab !== 'overview' || state.scope !== 'team' || state.teamId !== id) return; const detail = document.querySelector('.growth-summary, .marketing-scope-empty'); detail?.setAttribute('tabindex','-1'); detail?.focus({preventScroll:true}); detail?.scrollIntoView({behavior:'instant',block:'start'}); return; }
    if (action === 'team-scope') { selectWorkspaceView('team','',id);state.report=null;await loadReport();return; }
    if (action === 'analysis-view') { state.analysisView = target.dataset.view; render(); return; }
    if (action === 'analysis-content') { state.tab = 'analysis'; state.analysisView = 'content'; await loadReport(); return; }
    if (action === 'post-detail') { postDrawer(id); return; }
    if (action === 'hype-rules') { hypeRules(); return; }
    if (action === 'hype-preview') { hypePreview(); return; }
    if (action === 'hype-evidence') { hypeEvidence(id); return; }
    if (action === 'hype-refresh') { target.disabled = true; await loadHype(); return; }
    if (action === 'collection-filter') { state.collectionFilter = target.dataset.filter; render(); return; }
    if (action === 'collection-focus') { selectWorkspaceView('channels'); state.channelStatus='all'; state.channelSearch=''; state.channelPlatform=''; render(); document.querySelector(`[data-channel-card="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
    if (action === 'channel-history') { await historyDrawer(id); return; }
    if (action === 'channel-settings') { channelSettingsModal(id); return; }
    if (action === 'team-edit') { if (isAdmin()) teamModal(id); return; }
    if (action === 'member-assignment') { if (isAdmin()) assignmentModal(id); return; }
    if (action === 'cancel-handoff') { confirmModal('진행 중인 이관을 취소할까요?','현재 담당자와 연결 정보를 유지하고 새 담당자로의 이관 요청을 취소합니다.','cancel-handoff-confirm',id); return; }
    if (action === 'cancel-handoff-confirm') { target.disabled = true; await api(`/api/channels/${encodeURIComponent(id)}/handoff/cancel`,{}); closeModal(); await loadState(); notify('이관 요청을 취소했어요.'); return; }
    if (action === 'tab') { if(target.tagName==='A'&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey))return; event.preventDefault(); selectWorkspaceView(target.dataset.tab); state.error = ''; state.report = null; render(); if (reportTabs()) await loadReport(); if(state.tab==='content')await loadContentWorkspace(); window.scrollTo(0,0); return; }
    if (action === 'close-modal') { closeModal(); return; }
    if (action === 'logout') { const stamp=companyAuthSnapshot();await globalThis.SynkDeviceNotifications?.beforeLogout().catch(()=>{});if(!companyAuthCurrent(stamp))return;const logoutResult=await logoutSynkCompany(); if(!logoutResult.done)return; const teachingWarning=typeof logoutTeachingForCompany==='function'?await logoutTeachingForCompany():'';if(!companyAuthCurrent(stamp))return; clearInterval(pollTimer); clearInterval(hypePollTimer); state.hypeRequest++; state.hype = null; if(typeof resetContentWorkspace==='function')resetContentWorkspace(); if(typeof resetStudioWorkspace==='function')resetStudioWorkspace(); state.user = null; state.csrf = ''; state.data = null; state.report = null; state.authMode = 'login'; state.tab='home'; closeModal(); renderAuth(); if(logoutResult.warning||teachingWarning)notify([logoutResult.warning,teachingWarning].filter(Boolean).join(' ')); return; }
    if (action === 'refresh') { target.disabled = true; await loadState(); if (reportTabs()) await loadReport(); if(state.tab==='content')await loadContentWorkspace(); notify('최신 상태로 불러왔어요.'); return; }
    if (action === 'add-channel') { addChannelModal(); return; }
    if (action === 'day') { await dayModal(target.dataset.date); return; }
    if (action === 'chart-mode') { state.chartMode = target.dataset.mode; render(); return; }
    if (action === 'range') { state.range = target.dataset.range; if (state.range === 'custom') { render(); $('[data-date="start"]')?.focus(); return; } setRange(state.range); await loadReport(); return; }
    if (action === 'move-range') { moveRange(Number(target.dataset.direction)); await loadReport(); return; }
    if (action === 'channel-detail') { state.channel = id; state.tab = 'analysis'; await loadReport(); document.querySelector('.analysis-filters')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (action === 'member-filter') { state.tab = 'analysis'; state.ownerId = id; state.channel = ''; await loadReport(); document.querySelector('.analysis-filters')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (action === 'connect') { connectModal(id); return; }
    if (action === 'disconnect') { confirmModal('이 계정의 연결을 해제할까요?', '연결 정보와 이 계정에서 API로 수집한 콘텐츠·성장 기록이 삭제됩니다. 직접 입력하거나 기존 기록장에서 가져온 수동 기록은 보존됩니다. 다시 연결한 뒤부터 새 기록을 수집할 수 있어요.', 'disconnect-confirm', id); return; }
    if (action === 'disconnect-confirm') { target.disabled = true; await api(`/api/channels/${encodeURIComponent(id)}/disconnect`, {}); closeModal(); await loadState(); await loadReport(); notify('계정 연결을 해제하고 API 수집 기록을 삭제했어요.'); return; }
    if (action === 'provider') { if (isAdmin()) providerModal(target.dataset.platform); return; }
    if (action === 'owners') { ownersModal(id); return; }
    if (action === 'invite') { inviteModal(); return; }
    if (action === 'collect' || action === 'collect-all') { target.disabled = true; const collection = await api(action === 'collect' ? `/api/channels/${encodeURIComponent(id)}/collect` : '/api/collect', action === 'collect-all' ? {scope:state.scope,teamId:state.teamId} : {}); await loadState(); if (action === 'collect-all' && !(collection.runs || []).length) { notify('수집할 수 있는 연결된 채널이 없어요. 먼저 계정 연결을 확인해 주세요.'); return; } notify('수집을 시작했어요. 완료되면 기록에 반영됩니다.'); setTimeout(async () => { try { await loadState(); if (reportTabs()) await loadReport(); } catch {} }, 1800); startPolling(); return; }
    if (action === 'copy') { try { await navigator.clipboard.writeText(target.dataset.value); notify('복사했어요.'); } catch { const field = target.closest('.link-row')?.querySelector('input'); field?.select(); notify('주소를 선택했어요. 복사해서 전달해 주세요.'); } return; }
    if (action === 'archive') { const row = state.data.channels.find(row => row.id === id); confirmModal(row.active === false ? '채널 관리를 다시 시작할까요?' : '이 채널의 관리를 중지할까요?', '기존에 수집한 콘텐츠와 성장 기록은 보존됩니다. 관리 중지 중에는 자동 수집하지 않아요.', 'archive-confirm', id); return; }
    if (action === 'archive-confirm') { target.disabled = true; const row = state.data.channels.find(row => row.id === id); await api(`/api/channels/${encodeURIComponent(id)}/archive`, { active: row.active === false }); closeModal(); await loadState(); notify('채널 관리 상태를 변경했어요.'); return; }
    if (action === 'member-status') { const row = state.data.members.find(row => row.id === id); confirmModal(row.active === false ? '팀원의 이용을 재개할까요?' : '팀원의 이용을 중지할까요?', `${escape(row.name)} 님의 ${row.active === false ? '로그인을 다시 허용합니다.' : '로그인이 중지되며 이 크루가 연결한 계정의 연결 정보와 API 수집 기록이 삭제됩니다. 수동 기록은 보존됩니다.'}`, 'member-status-confirm', id); return; }
    if (action === 'member-status-confirm') { target.disabled = true; const row = state.data.members.find(row => row.id === id); await api(`/api/members/${encodeURIComponent(id)}/status`, { active: row.active === false }); closeModal(); await loadState(); notify('팀원 이용 상태를 변경했어요.'); return; }
    if (action === 'import-legacy') { confirmModal('기존 SYNK 기록을 가져올까요?', '기존 성장 현황의 채널과 수동 기록을 회사 공간으로 가져옵니다. 이미 있는 항목은 중복으로 만들지 않고 원본도 보존합니다.', 'import-legacy-confirm'); return; }
    if (action === 'import-legacy-confirm') { target.disabled = true; const imported = await api('/api/import-legacy', {}); closeModal(); await loadState(); await loadReport(); notify(`새 채널 ${imported.added ?? 0}개를 가져왔어요.${imported.skipped?.length ? ` 지원하지 않는 주소 ${imported.skipped.length}개는 기존 기록장에 남겨뒀어요.` : ' 담당자를 배정해 주세요.'}`); return; }
  } catch (err) { if(err.code==='SESSION_CHANGED')return; target.disabled = false; const box = overlay.querySelector('.form-error'); if (box) box.textContent = err.message; else notify(err.message); }
});
document.addEventListener('change', async event => {
  const target = event.target;
  if (target.hasAttribute('data-comparison-filter')) { const field=target.dataset.comparisonFilter; if(field==='metric' && METRICS.some(([id])=>id===target.value))state.metric=target.value; if(field==='group')state.comparisonGroup=target.value; if(field==='mode' && ['latest','period'].includes(target.value))state.comparisonMode=target.value; state.comparisonExpanded=false; render(); return; }
  if (target.hasAttribute('data-scope-team')) { resetGrowthHistoryRange(); state.teamId = target.value; state.scope = 'team'; state.ownerId = ''; state.channel = ''; state.platform = ''; state.report = null; normalizeMarketingScope(); if (reportTabs()) await loadReport(); else render(); return; }
  if (target.hasAttribute('data-channel-platform')) { state.channelPlatform = target.value; filterChannelCards(); return; }
  if (target.dataset.filter) { state[target.dataset.filter] = target.value; if (target.dataset.filter !== 'channel') state.channel = ''; await loadReport(); }
  else if (target.dataset.chart === 'metric') { state.metric = target.value; render(); }
  else if (target.dataset.date) {
    const previous = state[target.dataset.date]; state[target.dataset.date] = target.value;
    if (!target.value || state.start > state.end || state.end > reportToday() || (Date.parse(state.end) - Date.parse(state.start)) / 86400000 > 365) { state[target.dataset.date] = previous; render(); notify('오늘까지 최대 366일의 올바른 기간을 선택해 주세요.'); return; }
    state.range = 'custom'; await loadReport();
  }
});
document.addEventListener('input', event => { if (event.target.hasAttribute('data-channel-search')) { state.channelSearch = event.target.value; filterChannelCards(); } });
document.addEventListener('submit', async event => {
  const form = event.target.closest('form[data-form]'); if (!form) return;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]'), error = form.querySelector('.form-error'), values = Object.fromEntries(new FormData(form));
  if (submit) submit.disabled = true; if (error) error.textContent = '';
  try {
    switch (form.dataset.form) {
      case 'team': { await api(form.dataset.id ? `/api/teams/${encodeURIComponent(form.dataset.id)}` : '/api/teams', {name:values.name,...(form.dataset.id ? {active:values.active==='on'} : {})}); closeModal(); await loadState(); notify('팀 정보를 저장했어요.'); break; }
      case 'assignment': { if (values.role === 'manager' && !values.teamId) throw new Error('팀장은 소속 팀을 선택해 주세요.'); const ownTeam = form.dataset.id === state.user.id && state.user.role === 'admin'; await api(`/api/members/${encodeURIComponent(form.dataset.id)}/assignment`,{teamId:values.teamId || null,role:values.role}); closeModal(); await loadState(); notify(ownTeam ? '내 소속 팀을 저장했어요.' : '크루의 팀과 역할을 저장했어요.'); break; }
      case 'channel-details': { await api(`/api/channels/${encodeURIComponent(form.dataset.id)}/details`,values); closeModal(); await loadState(); notify('채널 정보를 저장했어요.'); break; }
      case 'auth': {
        if(!isDemoMode()&&typeof assertSynkCompanyPasswordAllowed==='function')assertSynkCompanyPasswordAllowed();
        const endpoint = state.authMode === 'join' ? '/api/join' : state.authMode === 'setup' ? '/api/setup' : '/api/login';
        if (state.authMode === 'join') values.token = state.authToken;
        if (state.authMode === 'setup') values.setupToken = state.authToken || values.setupToken;
        await api(endpoint, values); state.authMode = 'login'; state.authToken = '';
        const synkEntry=!isDemoMode()&&typeof prepareSynkCompanyEntry==='function'?await prepareSynkCompanyEntry():true;if(synkEntry===false)break;
        const me = synkEntry?.me||await api('/api/me');if(!isDemoMode()&&typeof assertSynkPlatformIdentity==='function')assertSynkPlatformIdentity(me,synkEntry);state.platformUrl = me.platformUrl || null; state.user = me.user; state.csrf = me.csrfToken || ''; await loadState(); if(reportTabs())await loadReport(); if(state.tab==='content')await loadContentWorkspace(); startPolling(); break;
      }
      case 'add-channels': {
        const urls = values.urls.split(/\r?\n/).map(url => url.trim()).filter(Boolean), results = { added: [], existing: [], errors: [] };
        for (let index = 0; index < urls.length; index += 100) { const result = await api('/api/channels', { urls: urls.slice(index, index + 100).join('\n'), ...(values.ownerId ? { ownerId: values.ownerId } : {}) }); for (const key of Object.keys(results)) results[key].push(...(result[key] || [])); }
        await loadState();
        $('.modal-body', overlay).innerHTML = `<div class="form-success">새 채널 ${results.added.length}개 등록 · 이미 등록됨 ${results.existing.length}개${results.errors.length ? ` · 확인 필요 ${results.errors.length}개` : ''}</div>${results.errors.length ? `<div class="batch-result"><div class="batch-summary">등록하지 못한 주소</div>${results.errors.map(row => `<div class="batch-entry"><div class="url">${escape(row.url)}</div><div>${escape(row.error)}</div></div>`).join('')}</div>` : ''}<p class="notice mt-20">담당 채널에서 계정을 연결하면 실제 수집을 시작할 수 있어요.</p><div class="modal-actions">${button('담당 채널 보기', 'registration-done', 'arrow', 'primary')}</div>`;
        $('.modal-body [data-action="registration-done"]', overlay).onclick = () => { closeModal(); state.tab = 'channels'; render(); }; break;
      }
      case 'connection': { await api(`/api/channels/${encodeURIComponent(form.dataset.id)}/connection`, Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))); closeModal(); await loadState(); notify('연결 정보를 저장했어요. 지금 수집을 눌러 실제 연결을 확인해 주세요.'); break; }
      case 'provider': { await api('/api/settings/provider', { platform: form.dataset.platform, ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '')) }); closeModal(); await loadState(); notify('플랫폼 연결 설정을 저장했어요. 채널에서 계정 연결을 진행해 주세요.'); break; }
      case 'owners': { const result = await api(`/api/channels/${encodeURIComponent(form.dataset.id)}/owners`, { userIds: new FormData(form).getAll('userIds'),reason:values.reason || '담당자 변경',...(isAdmin() ? {teamId:values.teamId || null} : {}) }); closeModal(); await loadState(); notify(result.requiresReconnect ? '이관을 요청했어요. 새 담당자의 계정 연결이 완료될 때까지 현재 담당을 유지합니다.' : '담당자를 저장하고 이력에 기록했어요.'); break; }
      case 'invite': {
        if (values.role === 'manager' && !values.teamId) throw new Error('팀장으로 초대하려면 소속 팀을 선택해 주세요.');
        values.teamId = values.teamId || null;
        const result = await api('/api/members/invite', values); await loadState();
        $('.modal-body', overlay).innerHTML = `<div class="invite-result"><div class="form-success">${escape(values.name)} 님의 초대 링크를 만들었어요.</div><p class="notice">아래 링크를 팀원에게 직접 전달해 주세요. 링크에서 이름과 비밀번호를 설정하면 로그인할 수 있어요.</p>${state.data.deployment?.localOnly ? '<div class="note-box">현재 주소는 이 컴퓨터에서만 열립니다. 크루의 컴퓨터에서 사용하려면 회사 서버 연결이 필요해요.</div>' : ''}<div class="link-row"><input readonly aria-label="팀원 초대 링크" value="${escape(result.inviteUrl)}">${button('복사', 'copy', 'copy', '', `data-value="${escape(result.inviteUrl)}"`)}</div><p class="tiny muted">초대 링크를 가진 사람이 계정을 만들 수 있으니 해당 팀원에게만 전달해 주세요.</p></div>`; break;
      }
      case 'password': { if (values.password !== values.confirmPassword) throw new Error('새 비밀번호가 서로 일치하지 않아요.'); await api('/api/account/password', { oldPassword: values.oldPassword, password: values.password }); const me = await api('/api/me'); state.csrf = me.csrfToken || ''; state.user = me.user; form.reset(); notify('로그인 비밀번호를 저장했어요.'); break; }
      case 'settings': { await api('/api/settings', { companyName: values.companyName, hourKst: Number(values.hourKst), enabled: values.enabled === 'on' }); await loadState(); notify('회사와 수집 시간 설정을 저장했어요.'); break; }
    }
  } catch (err) { if(err.code==='SESSION_CHANGED')return; if (error?.isConnected) error.textContent = err.message; else notify(err.message); }
  finally { if (submit?.isConnected) submit.disabled = false; }
});
document.addEventListener('keydown', event => {
  if (!overlay.children.length) return;
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key === 'Tab') { const focusable = [...overlay.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea,select,summary')].filter(node => node.getClientRects().length); if (!focusable.length) return; const first = focusable[0], last = focusable.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
});
function setRange(range) { const today = reportToday(); state.end = today; if (range === 'week') state.start = shiftDate(today, -6); if (range === 'month') state.start = today.slice(0, 7) + '-01'; if (range === 'quarter') state.start = today.slice(0, 4) + '-' + String(Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0') + '-01'; }
function moveRange(direction) {
  if (state.range === 'month' || state.range === 'quarter') {
    const step = state.range === 'month' ? 1 : 3, first = new Date(state.start + 'T00:00:00Z'); first.setUTCMonth(first.getUTCMonth() + step * direction, 1);
    const last = new Date(first); last.setUTCMonth(last.getUTCMonth() + step, 0);
    if (first.toISOString().slice(0, 10) > reportToday()) return;
    state.start = first.toISOString().slice(0, 10); state.end = last.toISOString().slice(0, 10) > reportToday() ? reportToday() : last.toISOString().slice(0, 10);
  } else { const length = Math.round((Date.parse(state.end) - Date.parse(state.start)) / 86400000) + 1; let start = shiftDate(state.start, length * direction), end = shiftDate(state.end, length * direction); if (end > reportToday()) { end = reportToday(); start = shiftDate(end, -(length - 1)); } state.start = start; state.end = end; }
}
window.synkDesktop?.onOpenView?.(view=>{if(view!=='teaching')return;selectWorkspaceView('teaching');closeModal();render();const url=new URL(location.href);url.searchParams.set('tab','teaching');history.replaceState(null,'',url.pathname+url.search+url.hash);});
initialize();
