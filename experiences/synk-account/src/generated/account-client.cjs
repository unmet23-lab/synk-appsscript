'use strict';
// Framework-neutral client: both SYNK products use this contract. No token storage here.
function fault(code, message, retryable = false, extra = {}) {
  return Object.assign(new Error(message), { code, retryable, ...extra });
}
const messages = {
  FEATURE_DISABLED: '기록 연결은 아직 준비 중이에요. 기본 연습은 계속 이용할 수 있어요.',
  REVISION_CONFLICT: '다른 기기에서 연결 설정이 바뀌었어요. 계정을 다시 확인해 주세요.',
  PROFILE_CONFLICT: '다른 기기에서 프로필이 바뀌었어요. 다시 확인해 주세요.',
  LEARNING_DISABLED: '학습 기록 연결이 꺼져 있어요. 내 SYNK 계정에서 확인해 주세요.',
  HISTORY_CAPACITY: '기록 보관 한도에 도달했어요. 기존 기록은 보존되어 있으니 고객 지원에 문의해 주세요.',
  SESSION_REVOKED: '기기 연결이 해제됐어요. 다시 로그인해 주세요.',
  AUTH_REQUIRED: '다시 로그인해 주세요.', AUTH_SESSION_MISSING: '로그인 정보를 새로 확인해야 해요. 다시 로그인해 주세요.',
  EVENT_CONFLICT: '학습 기록을 대조하지 못했어요. 기존 기록은 보존하고 연결을 중단했어요.',
  INVALID_REASONS: '배우는 이유는 1~3개까지 고를 수 있어요. 다시 골라 주세요.',
  INVALID_EVALUATION: '답을 저장하지 못했어요. 보기에서 다시 골라 주세요.',
  EVALUATION_NOT_ASKED: '학원에 소속된 계정에는 이 질문을 하지 않아요.',
  ACCOUNT_UNAVAILABLE: '계정 삭제를 요청한 상태라 저장할 수 없어요. 요청을 취소하면 다시 쓸 수 있어요.',
  REQUEST_NOT_FOUND: '취소할 삭제 요청을 찾지 못했어요. 계정을 다시 확인해 주세요.',
  DELETION_NOT_CANCELLABLE: '삭제를 이미 처리하고 있어서 취소할 수 없어요. hello@synk.im으로 문의해 주세요.',
  MY_INFO_UNAVAILABLE: '내 정보는 아직 준비 중이에요. 연습은 그대로 이용할 수 있어요.',
  MEMORY_UNAVAILABLE: '고른 설정을 계정에 저장하는 기능은 아직 준비 중이에요. 이 기기에는 그대로 남아요.',
  MEMORY_CAPACITY: '계정에 저장할 수 있는 맞춤 기록이 가득 찼어요. 이 기기에는 그대로 남아요.',
  INVALID_MEMORY: '맞춤 기록을 계정에 저장하지 못했어요. 이 기기에는 그대로 남아요.',
  SUMMARY_UNAVAILABLE: '아틀라스 요약은 아직 준비 중이에요.',
};
function createAccountClient({ url, anonKey, product, appVersion = '0.2.0', getAccessToken, refresh, guard,
  fetch: fetcher = globalThis.fetch, timeoutMs = 12000 }) {
  if (!['world', 'platform'].includes(product) || typeof guard !== 'function' || typeof getAccessToken !== 'function') throw new TypeError('An authenticated product host is required');
  const configured = !!url && !!anonKey;
  async function request(path, body, { signal } = {}) {
    const checkCancelled = () => { if (signal?.aborted) throw fault('NETWORK', '요청을 중단했어요.', true); };
    guard();
    checkCancelled();
    if (!configured) throw fault('CONFIG', '계정 연결 설정이 아직 준비되지 않았어요.');
    const send = async token => {
      guard();
      checkCancelled();
      if (!token) throw fault('AUTH_REQUIRED', '다시 로그인해 주세요.');
      const abort = new AbortController();
      const cancel = () => abort.abort();
      if (signal?.aborted) cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(cancel, timeoutMs);
      try {
        const response = await fetcher(`${url.replace(/\/$/, '')}/functions/v1/${path}`, {
          method: body === undefined ? 'GET' : 'POST', signal: abort.signal,
          headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'X-SYNK-Product': product, 'X-SYNK-Contract': '1', 'X-SYNK-App-Version': appVersion,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        // The timeout also bounds response body consumption.
        const data = await response.json().catch(() => null);
        guard();
        checkCancelled();
        if (abort.signal.aborted) throw fault('NETWORK', '연결을 확인하지 못했어요. 다시 시도해 주세요.', true);
        return { response, data };
      } catch (error) {
        guard();
        if (error.code) throw error;
        throw fault('NETWORK', '연결을 확인하지 못했어요. 기록은 이 기기에 남겨 두고 다시 시도해요.', true);
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
    };
    const token = getAccessToken();
    let result = await send(token);
    if (result.response.status === 401 && typeof refresh === 'function') {
      const renewed = await refresh(token); guard();
      if (renewed) result = await send(renewed);
    }
    const { response, data } = result;
    if (!response.ok || data?.ok !== true) {
      const code = data?.error?.code || (response.status === 401 ? 'AUTH_REQUIRED' : response.status === 429 || response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'ACCOUNT_UNAVAILABLE');
      throw fault(code,
        messages[code] || (data?.error?.message !== code && data?.error?.message) || '계정 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        response.status === 429 || response.status >= 500,
        { status: response.status, revision: data?.revision });
    }
    return data;
  }
  const action = (action, values = {}, options) => request('synk-account', { action, ...values }, options);
  const play = async body => {
    if (product !== 'world') throw fault('PRODUCT_FORBIDDEN', 'WORLD 계정으로 게임 기록을 연결해 주세요.');
    const data = await request('synk-play', body);
    if (data.scope !== 'synk-play' || typeof data.accountId !== 'string' || !data.accountId || !Number.isSafeInteger(data.revision) || data.revision < 0
      || !data.state || typeof data.state !== 'object' || !data.state.wallet || typeof data.state.wallet !== 'object' || !data.state.records || typeof data.state.records !== 'object' || typeof data.state.imported !== 'boolean') throw fault('INVALID_RESPONSE', '게임 계정 기록을 확인하지 못했어요. 다시 연결해 주세요.');
    // The account host validates the owner and product schema. Expose only the
    // fixed response contract, never server-added credentials or transport data.
    return { ok: true, scope: data.scope, accountId: data.accountId, revision: data.revision, state: data.state,
      ...(Object.hasOwn(data, 'result') ? { result: data.result } : {}), ...(data.duplicate === true ? { duplicate: true } : {}) };
  };
  return Object.freeze({
    configured, product,
    play: Object.freeze({ load: () => play(), mutate: body => {
      if (!body || typeof body !== 'object' || Array.isArray(body)) return Promise.reject(fault('INVALID_REQUEST', '게임 저장 요청을 확인해 주세요.'));
      return play(body);
    } }),
    load: () => request('synk-account'),
    wardrobeLoad: () => request('synk-wardrobe'),
    wardrobeSave: values => request('synk-wardrobe', { action: 'save', ...values }),
    platformLoad: () => request('synk-personal?resource=platform-library'),
    platformSave: ({state,expected_revision}) => request('synk-personal', {resource:'platform-library',action:'save',state,expected_revision}),
    platformDelete: ({expected_revision}) => request('synk-personal', {resource:'platform-library',action:'delete',expected_revision}),
    insightLoad: () => request('synk-personal?resource=member-insight'),
    insightSave: ({state,expected_revision}) => request('synk-personal', {resource:'member-insight',action:'save',state,expected_revision}),
    insightDelete: ({expected_revision}) => request('synk-personal', {resource:'member-insight',action:'delete',expected_revision}),
    understandingLoad: () => request('synk-personal?resource=member-understanding'),
    understandingSave: ({state,expected_revision}) => request('synk-personal', {resource:'member-understanding',action:'save',state,expected_revision}),
    understandingDelete: ({expected_revision,document_version}) => request('synk-personal', {resource:'member-understanding',action:'delete',expected_revision,...(document_version!==undefined?{document_version}:{})}),
    release: () => request(`release-policy?app_version=${encodeURIComponent(appVersion)}`),
    setLearning: (enabled, expected_revision) => action('learning-consent', { enabled, expected_revision }),
    updateProfile: (profile, expected_profile_revision) => action('profile-update', { profile, expected_profile_revision }),
    revokeSession: (session_id, options) => action('revoke-session', { session_id }, options),
    revokeAll: () => action('revoke-all-sessions'),
    requestDeletion: request_id => action('delete-request', { request_id }),
    // 7일 취소 유예 동안(요청이 아직 처리 전일 때) 같은 요청 번호로 취소한다.
    cancelDeletion: request_id => action('delete-cancel', { request_id }),
    // 「나 > 내 정보」 — 배우는 이유(덧붙이기)와 평가 전용 선택 응답(맞춤의 입력이 아니다).
    saveReasons: (reasons, other = null) => action('learn-reasons', { reasons, other }),
    skipReasons: () => action('learn-reasons-skip'),
    answerEvaluation: ({ age_band, gender, consent_version }) => action('evaluation-answer', { age_band, gender, consent_version }),
    skipEvaluation: () => action('evaluation-skip'),
    deleteEvaluation: () => action('evaluation-delete'),
    exportPage: ({ after = 0, until } = {}) => request(`synk-account?view=export&after=${encodeURIComponent(after)}${until == null ? '' : `&until=${encodeURIComponent(until)}`}`),
    // Core's summary of this account for any SYNK product: chosen settings, declared reasons and
    // the stored practice (only while learning storage is on). Never evaluation answers.
    atlasSummary: options => request('synk-account?view=atlas', undefined, options),
    exportAiPage: ({ after = 0, until } = {}) => request(`synk-account?view=ai-export&after=${encodeURIComponent(after)}${until == null ? '' : `&until=${encodeURIComponent(until)}`}`),
    learning: Object.freeze({
      get: ({ after, revision, signal }) => request(`synk-learning?after=${encodeURIComponent(after)}&revision=${encodeURIComponent(revision)}`, undefined, { signal }),
      post: ({ revision, events, signal }) => request('synk-learning', { revision, events }, { signal }),
    }),
    // Core memory (lib/atlas/memory-sync.js): chosen presentation, content memories, declined offers.
    memory: Object.freeze({
      get: ({ revision, signal }) => request(`synk-learning?view=memory&revision=${encodeURIComponent(revision)}`, undefined, { signal }),
      post: ({ revision, entries, signal }) => request('synk-learning', { revision, memory: entries }, { signal }),
    }),
  });
}
module.exports = { createAccountClient };
