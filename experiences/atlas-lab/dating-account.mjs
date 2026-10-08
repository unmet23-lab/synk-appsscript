import { readConfig, beginOAuth, consumeCallback, tokenRequest } from '../synk-account/src/core.mjs';

// SYNK public PKCE, with a separate transaction/session namespace for this product.
// Domain data never enters browser credential storage.
export function createDatingAccount({ fetcher = globalThis.fetch, storage = globalThis.sessionStorage,
  location = globalThis.location, replaceURL = url => history.replaceState(null, '', url), onChange = () => {} } = {}) {
  const key = 'synk.oauth.session.dating';
  const pending = { getItem: name => storage.getItem(`dating.${name}`), setItem: (name, value) => storage.setItem(`dating.${name}`, value), removeItem: name => storage.removeItem(`dating.${name}`) };
  let config, session = null, demoToken = null, epoch = 0, refreshing = null, disposed = false;
  let state = { configured: false, signedIn: false, mode: 'unavailable', message: '연결 상태를 확인하고 있어요.' };
  const messages = { 'revision-conflict': '다른 화면에서 바뀐 기록이 있어요. 최신 기록을 불러온 뒤 다시 확인해 주세요.', 'pair-revision-conflict': '상대가 약속을 바꿨어요. 새로고침한 뒤 다시 확인해 주세요.',
    'introduction-required': '먼저 새 소개 요청을 보내고 서로 소개를 수락해 주세요.', 'introduction-unavailable': '지금은 새 소개 요청을 보낼 수 없어요. 초대함에서 현재 상태를 확인해 주세요.',
    'introduction-cooldown': '아직 새 소개 요청을 보낼 때가 아니에요. 초대함에서 다시 확인해 주세요.', 'introduction-revision-conflict': '소개 요청 상태가 바뀌었어요. 새로고침한 뒤 확인해 주세요.',
    'introduction-response-unavailable': '이 소개 요청에는 더 이상 응답할 수 없어요. 최신 상태를 확인해 주세요.', 'introduction-reopen-unavailable': '소개 요청 받기 상태가 이미 바뀌었어요. 최신 상태를 확인해 주세요.',
    'reopen-required': '직접 요청 받기를 다시 연 뒤 새 소개부터 확인해 주세요.', 'partner-unavailable': '지금은 이 상대에게 새 만남을 제안할 수 없어요.',
    'preview-stale': '미리보기의 기준이나 후보 정보가 바뀌었어요. 최신 상태에서 다시 비교해 주세요.', 'preference-storage-consent-required': '내 설정에서 개인 답변 저장 범위를 먼저 확인해 주세요.',
    'criterion-review-unavailable': '당시 기준이나 회고가 바뀌어 이 제안을 적용할 수 없어요. 내 기준에서 현재 답을 확인해 주세요.',
    'restoration-unavailable': '원래 수정이나 후속 응답이 달라져 되돌릴 수 없어요. 나중에 고친 답은 그대로 유지했어요.',
    'allowance-review-unavailable': '당시 허용 조건이나 공개된 비교 정보가 바뀌어 이 회고를 적용할 수 없어요. 최신 추천을 다시 확인해 주세요. 원래 기준은 그대로예요.',
    'own-completion-required': '본인이 만남을 마쳤다고 확인한 약속에만 경험을 남길 수 있어요.',
    'alignment-stale': '공개한 답이나 소개·만남 상태가 바뀌었어요. 새로고침한 뒤 첫 만남의 방식을 다시 확인해 주세요.',
    'alignment-revision-conflict': '상대가 조율 답을 바꿨어요. 새로고침한 뒤 현재 답을 확인해 주세요.',
    'pair-closed': '이 연결은 종료됐어요. 이전 약속은 다시 수락할 수 없어요.', 'connection-unavailable': '지금은 이 계정과 연결할 수 없어요. 공개와 초대 설정을 확인해 주세요.',
    'discovery-unavailable': '추천 저장 동의와 쉬기 상태를 확인해 주세요.', 'account-deleted': '소개팅 기록이 삭제된 계정이에요.', 'account-suspended': '현재 이용 상태를 확인해 주세요.', 'account-unavailable': '계정의 현재 이용 상태를 확인한 뒤 다시 연결해 주세요.',
    'account-busy': '접속이 잠시 몰리고 있어요. 잠시 뒤 다시 시도해 주세요.',
    'service-restarting': '서비스 연결을 잠시 준비하고 있어요. 잠시 뒤 다시 시도해 주세요.',
    'storage-unavailable': '지금 기록을 저장하거나 확인하기 어려워요. 잠시 뒤 다시 확인해 주세요.',
    'demo-session-expired': '가상 체험의 연결이 끝났어요. 가상 체험으로 다시 시작해 주세요.', 'invalid-action': '입력한 값이나 지금 가능한 동작을 다시 확인해 주세요.' };
  const emit = patch => { state = { ...state, ...patch }; onChange({ ...state }); };
  const guard = current => { if (disposed || epoch !== current) throw new Error('계정 연결이 바뀌었어요. 다시 불러와 주세요.'); };
  const binding = () => [config.supabaseUrl, config.accountApiUrl, config.clients.platform.clientId, config.clients.platform.redirectUri].join('|');
  const persist = () => storage.setItem(key, JSON.stringify({ binding: binding(), session }));
  async function renew() {
    if (refreshing) return refreshing;
    const current = epoch;
    refreshing = (async () => {
      if (!session?.refresh_token) throw new Error('SYNK ID로 다시 로그인해 주세요.');
      const next = await tokenRequest(config, { grant_type: 'refresh_token', client_id: config.clients.platform.clientId, refresh_token: session.refresh_token }, async (...args) => {
        const response = await fetcher(...args); guard(current);
        let error; if (!response.ok && [400,401].includes(response.status)) { try { error = await response.clone().json(); } catch {} }
        if (response.status === 401 || response.status === 400 && ['invalid_grant','invalid_token'].includes(error?.error || error?.code)) {
          guard(current); session = null; storage.removeItem(key); epoch++; emit({ signedIn: false });
          throw Object.assign(new Error('로그인 연결이 만료됐어요. SYNK ID로 다시 로그인해 주세요.'), { status: 401, code: 'AUTH_REQUIRED' });
        }
        return response;
      });
      guard(current); session = { ...next, refresh_token: next.refresh_token || session.refresh_token }; persist();
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function start() {
    const current = ++epoch;
    const response = await fetcher('/api/atlas-dating/config', { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
    const result = await response.json(); guard(current);
    if (!response.ok || result.ok !== true) throw new Error('계정 연결 설정을 읽지 못했어요.');
    config = readConfig(result.accountConfig || { version: 1 }, location.href);
    const configured = config.configured && !!config.clients.platform.clientId && !!config.clients.platform.redirectUri;
    emit({ configured, mode: result.mode || 'unavailable', labAvailable: result.labAvailable === true, demoEnabled: result.demoEnabled === true, demoRoles: Array.isArray(result.demoRoles) ? result.demoRoles.map(role => ({ ...role })) : undefined, message: configured ? 'SYNK ID로 기록을 이어갈 수 있어요.' : '계정 연결 전이에요. 가상 체험으로 기능을 살펴볼 수 있어요.' });
    if (!configured) return { ...state };
    const callback = new URL(config.clients.platform.redirectUri), here = new URL(location.href);
    if (callback.origin !== here.origin || callback.pathname !== here.pathname || callback.search) throw new Error('이 소개팅 화면에 등록된 로그인 도착 주소가 필요해요.');
    if (here.searchParams.has('code') || here.searchParams.has('error')) {
      let fields;
      try { fields = consumeCallback({ config, product: 'platform', storage: pending, url: here.href }); }
      finally { for (const name of ['code', 'state', 'error', 'error_description']) here.searchParams.delete(name); replaceURL(here.href); }
      const tokens = await tokenRequest(config, fields, fetcher); guard(current); session = tokens; persist();
    } else {
      try { const saved = JSON.parse(storage.getItem(key) || 'null'); session = saved?.binding === binding() ? saved.session : null; }
      catch { session = null; }
      if (!session) storage.removeItem(key);
    }
    emit({ signedIn: !!session?.access_token }); return { ...state };
  }
  async function signIn() { const current = epoch; const url = await beginOAuth({ config, product: 'platform', storage: pending }); guard(current); location.assign(url); }
  async function request(path, body, { demo = false } = {}) {
    const current = epoch;
    if (!demo && session && session.expires_at <= Date.now() + 30000) await renew();
    guard(current);
    if (!demo && !session?.access_token) throw new Error('SYNK ID로 먼저 로그인해 주세요.');
    const payload = body === undefined ? undefined : JSON.stringify(body), mutation = path === '/action' && body !== undefined;
    let response, text, result;
    const uncertain = error => { guard(current); if (mutation && !(response?.status >= 400 && response?.status < 500)) error.outcomeUnknown = true; return error; };
    try {
      response = await fetcher(`/api/atlas-dating${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
        headers: { ...(!demo ? { Authorization: `Bearer ${session.access_token}` } : demoToken ? { Authorization: `Bearer ${demoToken}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: payload }) });
      guard(current);
      // HTTP authentication rejection is definitive even if its body is lost.
      if (response.status === 401 && !demo) { session = null; storage.removeItem(key); epoch++; emit({ signedIn: false }); throw Object.assign(new Error('SYNK ID로 다시 로그인해 주세요.'), { status: 401, code: 'AUTH_REQUIRED' }); }
      text = await response.text(); guard(current);
      if (text.length > 1048576) throw new Error('응답이 너무 커서 불러오지 못했어요.');
      result = JSON.parse(text);
      if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.ok !== 'boolean') throw new Error('저장 응답을 확인하지 못했어요.');
      if (mutation && response.ok && result.ok !== true) throw new Error('변경의 저장 결과를 확인하지 못했어요.');
      if (mutation && response.ok && result.ok && (!result.view || typeof result.view !== 'object' || !Number.isSafeInteger(result.view.revision)
        || !Number.isSafeInteger(result.appliedRevision) || result.appliedRevision < 0 || result.view.revision < result.appliedRevision
        || !result.result || typeof result.result !== 'object' || Array.isArray(result.result))) throw new Error('변경의 저장 결과를 확인하지 못했어요.');
    } catch (error) {
      if (error.status === 401 && epoch !== current) throw error;
      const failure = uncertain(error instanceof Error ? error : new Error('저장 응답을 확인하지 못했어요.'));
      if (response?.status >= 400 && response?.status < 500) { failure.status = response.status; failure.code ||= 'request-rejected'; }
      throw failure;
    }
    if (!response.ok || result.ok !== true) {
      const failure = Object.assign(new Error(messages[result.error?.code] || (mutation ? '변경을 저장하지 못했어요. 다시 불러와 주세요.' : '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')), { code: result.error?.code, status: response.status });
      // Only the host's explicit pre-mutation restart rejection proves a 5xx
      // action was not applied. Other 5xx or unreadable bodies stay uncertain.
      const restartRejected = response.status === 503 && result.ok === false && result.error?.code === 'service-restarting';
      if (response.status >= 500 && !restartRejected) throw uncertain(failure);
      throw failure;
    }
    return result;
  }
  async function signOut() {
    const old = session; ++epoch; session = null; storage.removeItem(key); emit({ signedIn: false });
    if (!old?.access_token) return;
    try {
      const response = await fetcher(new URL('/auth/v1/logout?scope=local', config.supabaseUrl), { method: 'POST', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(12000), headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${old.access_token}` } });
      if (!response.ok) throw new Error();
    } catch { emit({ message: '이 화면에서 로그아웃했어요. 서버의 로그인 종료는 다시 확인해 주세요.' }); }
  }
  async function demo(role) { ++epoch; demoToken = null; const result = await request('/demo/session', { role }, { demo: true }); demoToken = result.token; return result; }
  const checkpointBinding = ({ demo = false } = {}) => demo
    ? ['v1', 'demo', new URL(location.href).origin, new URL(location.href).pathname].join('|')
    : config?.configured ? ['v1', 'account', binding()].join('|') : null;
  return { start, signIn, signOut, demo, request, checkpointBinding, snapshot: () => ({ ...state }), dispose() { disposed = true; epoch++; session = null; demoToken = null; } };
}
