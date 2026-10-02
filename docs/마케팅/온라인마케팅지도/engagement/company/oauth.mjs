// Official protocols: Google identity/protocols/oauth2/web-server;
// TikTok docs/en/login-kit-web and docs/en/oauth-user-access-token-management;
// Meta instagram-platform/reference/{access_token,refresh_access_token} and
// facebook-login/guides/access-tokens/get-long-lived. No credentials are logged.
const GRAPH_VERSION = 'v26.0';
const DAY = 86_400_000;
const DEFINITIONS = Object.freeze({
  youtube: {
    name: 'YouTube', requiresHttps: false, refreshMode: 'refresh-token',
    scopes: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'],
  },
  instagram: {
    name: 'Instagram', requiresHttps: true, refreshMode: 'long-lived-token',
    scopes: ['instagram_business_basic', 'instagram_business_manage_insights'],
  },
  facebook: {
    name: 'Facebook', requiresHttps: false, refreshMode: 'reconnect',
    scopes: ['pages_show_list', 'pages_read_engagement', 'read_insights'],
  },
  tiktok: {
    name: 'TikTok', requiresHttps: true, refreshMode: 'refresh-token',
    scopes: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'],
  },
});

export class OAuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    this.status = status;
  }
}

function definition(platform) {
  const result = Object.hasOwn(DEFINITIONS, platform) ? DEFINITIONS[platform] : null;
  if (!result) throw new OAuthError('unsupported_provider', '이 플랫폼의 계정 연결은 아직 지원하지 않습니다.');
  return result;
}

function configFrom(settings, platform) {
  if (settings instanceof Map) return settings.get(`provider:${platform}`) || settings.get(platform) || {};
  return settings?.[`provider:${platform}`] || settings?.[platform] || settings?.providers?.[platform] || {};
}

// Safe for a browser response: deliberately excludes all configuration values.
export function providers(settings = {}) {
  return Object.entries(DEFINITIONS).map(([id, value]) => {
    const config = configFrom(settings, id);
    return {
      id, platform: id, name: value.name, label: value.name,
      configured: Boolean(config.clientId && config.clientSecret),
      requiresHttps: value.requiresHttps, refreshMode: value.refreshMode,
      scopes: [...value.scopes],
    };
  });
}

function required(value, code, message) {
  if (typeof value !== 'string' || !value.trim()) throw new OAuthError(code, message);
  return value.trim();
}

function version(value = GRAPH_VERSION) {
  if (!/^v\d{1,3}\.\d{1,2}$/.test(value)) throw new OAuthError('invalid_api_version', 'Meta API 버전 설정을 확인해 주세요.');
  return value;
}

function checkedRedirect(platform, value) {
  let url;
  try { url = new URL(value); } catch { throw new OAuthError('invalid_redirect', '계정 연결 주소 설정을 확인해 주세요.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && !definition(platform).requiresHttps))) {
    throw new OAuthError('https_required', '이 계정 연결에는 등록된 HTTPS 회사 주소가 필요합니다.');
  }
  return url.href;
}

export function createAuthorization(platform, { clientId, redirectUri, state, challenge, apiVersion } = {}) {
  const provider = definition(platform);
  required(clientId, 'provider_not_configured', '관리자가 먼저 플랫폼 앱 연결을 설정해야 합니다.');
  required(state, 'invalid_state', '계정 연결 요청을 다시 시작해 주세요.');
  if (state.length < 16) throw new OAuthError('invalid_state', '계정 연결 요청을 다시 시작해 주세요.');
  const redirect = checkedRedirect(platform, redirectUri);
  let endpoint;
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, state, response_type: 'code' });
  if (platform === 'youtube') {
    endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    params.set('scope', provider.scopes.join(' '));
    params.set('access_type', 'offline');
    params.set('prompt', 'consent select_account');
    params.set('include_granted_scopes', 'true');
  } else if (platform === 'instagram') {
    endpoint = 'https://www.instagram.com/oauth/authorize';
    params.set('scope', provider.scopes.join(','));
    params.set('enable_fb_login', '0');
    params.set('force_authentication', '1');
  } else if (platform === 'facebook') {
    endpoint = `https://www.facebook.com/${version(apiVersion)}/dialog/oauth`;
    params.set('scope', provider.scopes.join(','));
    params.set('auth_type', 'rerequest');
  } else {
    endpoint = 'https://www.tiktok.com/v2/auth/authorize/';
    params.delete('client_id');
    params.set('client_key', clientId);
    params.set('scope', provider.scopes.join(','));
  }
  // TikTok Web uses the confidential-client flow by default. PKCE is passed
  // only when the caller explicitly starts a mobile/desktop-compatible flow.
  if (challenge && ['youtube', 'tiktok'].includes(platform)) {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) throw new OAuthError('invalid_pkce', '계정 연결 요청을 다시 시작해 주세요.');
    params.set('code_challenge', challenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${endpoint}?${params}`;
}

async function requestToken(platform, endpoint, values, { fetchImpl = fetch, method = 'POST', multipart = false, timeoutMs = 15_000 } = {}) {
  definition(platform);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    const url = new URL(endpoint);
    const headers = { Accept: 'application/json', 'Cache-Control': 'no-store' };
    let body;
    if (method === 'GET') {
      for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    } else if (multipart) {
      body = new FormData();
      for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null) body.append(key, String(value));
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined && value !== null));
    }
    // Refuse redirects so a token/secret cannot leave the hardcoded provider.
    response = await fetchImpl(url.href, { method, headers, body, redirect: 'error', signal: controller.signal });
    // Classify temporary HTTP failures before reading the body. Provider outages
    // often return HTML; parsing them must not turn an outage into expired auth.
    if (response.status === 429) {
      throw Object.assign(new OAuthError('rate_limited', '플랫폼 인증 서버의 요청 한도에 도달했습니다. 예약된 재시도를 기다려 주세요.', 429), { retryable: true });
    }
    if (response.status >= 500 && response.status <= 599) {
      throw Object.assign(new OAuthError('oauth_unavailable', '플랫폼 인증 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도합니다.', response.status), { retryable: true });
    }
    const payload = await response.json();
    const data = Array.isArray(payload?.data) ? payload.data[0] : payload;
    const providerError = payload?.error ?? data?.error;
    const providerCode = typeof providerError === 'string' ? providerError.toLowerCase() : typeof providerError?.code === 'string' ? providerError.code.toLowerCase() : '';
    if (['temporarily_unavailable', 'server_error'].includes(providerCode)) {
      throw Object.assign(new OAuthError('oauth_unavailable', '플랫폼 인증 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도합니다.', 503), { retryable: true });
    }
    if (['rate_limited', 'rate_limit_exceeded', 'too_many_requests'].includes(providerCode)) {
      throw Object.assign(new OAuthError('rate_limited', '플랫폼 인증 서버의 요청 한도에 도달했습니다. 예약된 재시도를 기다려 주세요.', 429), { retryable: true });
    }
    if (!response.ok || payload?.error || !data || typeof data.access_token !== 'string' || !data.access_token) {
      throw new OAuthError('token_exchange_failed', `${DEFINITIONS[platform].name} 연결을 완료하지 못했습니다. 앱 권한과 연결 설정을 확인한 뒤 다시 연결해 주세요.`, 502);
    }
    return data;
  } catch (error) {
    if (error instanceof OAuthError) throw error;
    // Never propagate fetch URLs, provider messages, response bodies or causes.
    if (controller.signal.aborted) throw Object.assign(new OAuthError('oauth_timeout', '플랫폼 응답 시간이 초과됐습니다. 잠시 후 다시 연결해 주세요.', 504),{retryable:true});
    throw Object.assign(new OAuthError('oauth_unavailable', '플랫폼 인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 502),{retryable:true});
  } finally {
    clearTimeout(timer);
  }
}

function expiry(seconds, now) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0 && value < 10 * 366 * 86400 ? new Date(now + value * 1000).toISOString() : null;
}

function grantedScope(data, previous = '') {
  if (typeof data.scope === 'string') return data.scope;
  if (Array.isArray(data.permissions) && data.permissions.every(item => typeof item === 'string')) return data.permissions.join(',');
  return previous;
}

function credentials(platform, data, previous = {}, extra = {}) {
  const now = Date.now();
  const rawAccountId = data.open_id || data.user_id;
  const accountId = typeof rawAccountId === 'string' || (typeof rawAccountId === 'number' && Number.isSafeInteger(rawAccountId)) ? String(rawAccountId) : null;
  return {
    ...previous, ...extra,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || previous.refreshToken || null,
    expiresAt: expiry(data.expires_in ?? data.expires, now),
    refreshExpiresAt: expiry(data.refresh_expires_in, now) || previous.refreshExpiresAt || null,
    issuedAt: new Date(now).toISOString(),
    scope: grantedScope(data, previous.scope || ''),
    tokenType: data.token_type || 'Bearer',
    ...(accountId ? { accountId } : {}),
  };
}

export async function exchangeCode(platform, { clientId, clientSecret, redirectUri, code, verifier, apiVersion } = {}, { fetchImpl = fetch } = {}) {
  definition(platform);
  required(clientId, 'provider_not_configured', '플랫폼 앱 연결 설정이 필요합니다.');
  required(clientSecret, 'provider_not_configured', '플랫폼 앱 연결 설정이 필요합니다.');
  required(code, 'missing_code', '플랫폼의 연결 승인이 필요합니다.');
  const redirect = checkedRedirect(platform, redirectUri);
  const base = { client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, code, grant_type: 'authorization_code' };
  if (platform === 'youtube') {
    const data = await requestToken(platform, 'https://oauth2.googleapis.com/token', { ...base, ...(verifier ? { code_verifier: verifier } : {}) }, { fetchImpl });
    return credentials(platform, data, {}, { authType: 'google-oauth', authorized: true });
  }
  if (platform === 'tiktok') {
    const { client_id, ...values } = base;
    const data = await requestToken(platform, 'https://open.tiktokapis.com/v2/oauth/token/', { ...values, client_key: client_id, ...(verifier ? { code_verifier: verifier } : {}) }, { fetchImpl });
    return credentials(platform, data, {}, { authType: 'tiktok-login', authorized: true });
  }
  if (platform === 'instagram') {
    const short = await requestToken(platform, 'https://api.instagram.com/oauth/access_token', base, { fetchImpl, multipart: true });
    const long = await requestToken(platform, 'https://graph.instagram.com/access_token', { grant_type: 'ig_exchange_token', client_secret: clientSecret, access_token: short.access_token }, { fetchImpl, method: 'GET' });
    return credentials(platform, { ...short, ...long }, {}, { authType: 'instagram-login', graphHost: 'graph.instagram.com', apiVersion: version(apiVersion), authorized: true, longLived: true });
  }
  const endpoint = `https://graph.facebook.com/${version(apiVersion)}/oauth/access_token`;
  const { grant_type, ...fbValues } = base;
  const short = await requestToken(platform, endpoint, fbValues, { fetchImpl, method: 'GET' });
  const long = await requestToken(platform, endpoint, { client_id: clientId, client_secret: clientSecret, grant_type: 'fb_exchange_token', fb_exchange_token: short.access_token }, { fetchImpl, method: 'GET' });
  // This is a User token. Bind /me/accounts to the requested Page before use.
  return credentials(platform, { ...short, ...long }, {}, { authType: 'facebook-user', graphHost: 'graph.facebook.com', apiVersion: version(apiVersion), authorized: true, longLived: true });
}

export async function refreshCredentials(platform, current, clientConfig = {}, { fetchImpl = fetch } = {}) {
  definition(platform);
  required(current?.accessToken, 'connection_required', '이 페이지의 계정을 먼저 연결해 주세요.');
  const now = Date.now();
  const expiration = Date.parse(current.expiresAt || '');
  const refreshWindow = platform === 'instagram' ? 7 * DAY : 5 * 60_000;
  if (!clientConfig.force && Number.isFinite(expiration) && expiration > now + refreshWindow) return { ...current };
  if (platform === 'facebook') {
    if (Number.isFinite(expiration) && expiration <= now) throw new OAuthError('reconnect_required', 'Facebook 연결이 만료됐습니다. 다시 연결해 주세요.', 401);
    // Facebook has no refresh-token grant. A Page token may have no expiry.
    return { ...current };
  }
  if (platform === 'instagram') {
    if (Number.isFinite(expiration) && expiration <= now) throw new OAuthError('reconnect_required', 'Instagram 연결이 만료됐습니다. 다시 연결해 주세요.', 401);
    const issued = Date.parse(current.issuedAt || '');
    if (Number.isFinite(issued) && now - issued < DAY) return { ...current };
    const data = await requestToken(platform, 'https://graph.instagram.com/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: current.accessToken }, { fetchImpl, method: 'GET' });
    return credentials(platform, data, current);
  }
  required(current.refreshToken, 'reconnect_required', '자동 갱신 권한이 없습니다. 계정을 다시 연결해 주세요.');
  const refreshExpiration = Date.parse(current.refreshExpiresAt || '');
  if (Number.isFinite(refreshExpiration) && refreshExpiration <= now) throw new OAuthError('reconnect_required', '계정 연결이 만료됐습니다. 다시 연결해 주세요.', 401);
  const { clientId, clientSecret } = clientConfig;
  required(clientId, 'provider_not_configured', '플랫폼 앱 연결 설정이 필요합니다.');
  required(clientSecret, 'provider_not_configured', '플랫폼 앱 연결 설정이 필요합니다.');
  const values = { client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: current.refreshToken };
  const endpoint = platform === 'youtube' ? 'https://oauth2.googleapis.com/token' : 'https://open.tiktokapis.com/v2/oauth/token/';
  values[platform === 'youtube' ? 'client_id' : 'client_key'] = clientId;
  const data = await requestToken(platform, endpoint, values, { fetchImpl });
  return credentials(platform, data, current);
}
