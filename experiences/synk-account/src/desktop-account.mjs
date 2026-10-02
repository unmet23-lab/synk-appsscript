// Renderer adapter. Credentials remain inside the desktop main process.
export function createDesktopAccountClient({ bridge, product, guard }) {
  if (!['platform', 'world'].includes(product) || typeof guard !== 'function' || typeof bridge?.accountRequest !== 'function') throw new TypeError('Trusted desktop account bridge required');
  async function request(operation, params = {}, signal) {
    guard();
    if (signal?.aborted) throw Object.assign(new Error('요청을 취소했어요.'), { code: 'ABORTED' });
    const result = await bridge.accountRequest(operation, params);
    guard();
    if (signal?.aborted) throw Object.assign(new Error('요청을 취소했어요.'), { code: 'ABORTED' });
    if (result?.ok !== true) throw Object.assign(new Error(result?.error?.message || '계정 연결을 확인하지 못했어요.'), {
      code: result?.error?.code || 'ACCOUNT_UNAVAILABLE', retryable: result?.error?.retryable === true,
      status: result?.error?.status, revision: result?.revision,
    });
    return result;
  }
  return Object.freeze({
    configured: true, product,
    load: () => request('load'), release: () => request('release'),
    setLearning: (enabled, expected_revision) => request('setLearning', { enabled, expected_revision }),
    updateProfile: (profile, expected_profile_revision) => request('updateProfile', { profile, expected_profile_revision }),
    revokeSession: session_id => request('revokeSession', { session_id }),
    revokeAll: () => request('revokeAll'), requestDeletion: request_id => request('requestDeletion', { request_id }),
    exportPage: ({ after = 0, until } = {}) => request('exportPage', { after, ...(until == null ? {} : { until }) }),
    learning: Object.freeze({
      get: ({ after, revision, signal }) => request('learningGet', { after, revision }, signal),
      post: ({ revision, events, signal }) => request('learningPost', { revision, events }, signal),
    }),
  });
}

export function authMessage(state) {
  if (!state?.configured) return '이 앱의 SYNK ID 연결 설정을 준비하고 있어요. 기본 학습은 계속 이용할 수 있어요.';
  if (state.error?.message) return state.error.message;
  return ({
    restoring: '저장된 로그인을 안전하게 확인하고 있어요.',
    'signing-in': '브라우저에서 SYNK ID 로그인을 마치면 이 앱으로 연결돼요.',
    'signed-in': 'SYNK ID로 연결했어요. 이 앱의 계정 정보를 확인하고 있어요.',
    'signed-out': 'SYNK ID로 로그인하면 모바일과 PC에서 같은 계정으로 이어갈 수 있어요.',
    error: '로그인을 확인하지 못했어요. 다시 시도해 주세요.',
  })[state.status] || '계정 연결 상태를 확인하고 있어요.';
}
