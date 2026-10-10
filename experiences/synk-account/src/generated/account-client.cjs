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
};
function createAccountClient({ url, anonKey, product, appVersion = '0.2.0', getAccessToken, refresh, guard,
  fetch: fetcher = globalThis.fetch, timeoutMs = 12000 }) {
  if (!['world', 'platform'].includes(product) || typeof guard !== 'function' || typeof getAccessToken !== 'function') throw new TypeError('An authenticated product host is required');
  const configured = !!url && !!anonKey;
  async function request(path, body, { signal } = {}) {
    guard();
    if (!configured) throw fault('CONFIG', '계정 연결 설정이 아직 준비되지 않았어요.');
    const send = async token => {
      guard();
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
      const code = data?.error?.code || (response.status === 401 ? 'AUTH_REQUIRED' : 'ACCOUNT_UNAVAILABLE');
      throw fault(code,
        messages[code] || (data?.error?.message !== code && data?.error?.message) || '계정 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.',
        response.status === 429 || response.status >= 500,
        { status: response.status, revision: data?.revision });
    }
    return data;
  }
  const action = (action, values = {}) => request('synk-account', { action, ...values });
  return Object.freeze({
    configured, product,
    load: () => request('synk-account'),
    release: () => request(`release-policy?app_version=${encodeURIComponent(appVersion)}`),
    setLearning: (enabled, expected_revision) => action('learning-consent', { enabled, expected_revision }),
    updateProfile: (profile, expected_profile_revision) => action('profile-update', { profile, expected_profile_revision }),
    revokeSession: session_id => action('revoke-session', { session_id }),
    revokeAll: () => action('revoke-all-sessions'),
    requestDeletion: request_id => action('delete-request', { request_id }),
    exportPage: ({ after = 0, until } = {}) => request(`synk-account?view=export&after=${encodeURIComponent(after)}${until == null ? '' : `&until=${encodeURIComponent(until)}`}`),
    learning: Object.freeze({
      get: ({ after, revision, signal }) => request(`synk-learning?after=${encodeURIComponent(after)}&revision=${encodeURIComponent(revision)}`, undefined, { signal }),
      post: ({ revision, events, signal }) => request('synk-learning', { revision, events }, { signal }),
    }),
  });
}
module.exports = { createAccountClient };
