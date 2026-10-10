export const PRODUCTS = Object.freeze({ platform: 'SYNK 플랫폼', world: 'SYNK WORLD' });
export const isLoopback = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
export function publicUrl(value, { relative = false, base } = {}) {
  const url = relative ? new URL(value, base) : new URL(value);
  if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)
    || url.protocol === 'http:' && !isLoopback(url.hostname)) throw new Error('HTTPS 또는 로컬 개발 주소만 사용할 수 있어요.');
  return url;
}
export function readConfig(value, base) {
  const allowed = ['version', 'supabaseUrl', 'supabasePublishableKey', 'accountApiUrl', 'portalUrl', 'learningUrl', 'clients', 'authorizationClients'];
  if (!value || value.version !== 1 || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('공개 설정 파일의 형식을 확인해 주세요.');
  const key = value.supabasePublishableKey || '';
  if (typeof key !== 'string' || key.startsWith('sb_secret_')) throw new Error('서버 비밀 키를 브라우저 설정에 넣을 수 없어요.');
  if (key.split('.').length === 3) {
    try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') throw new Error('role'); }
    catch { throw new Error('브라우저에는 공개 publishable 또는 anon 키만 사용할 수 있어요.'); }
  }
  const config = { ...value, clients: {}, configured: !!value.supabaseUrl && !!key && !!value.portalUrl };
  for (const field of ['supabaseUrl', 'accountApiUrl', 'portalUrl']) if (value[field]) publicUrl(value[field]);
  for (const product of Object.keys(PRODUCTS)) {
    const client = value.clients?.[product] || {};
    if (Object.keys(client).some(key => !['clientId', 'redirectUri'].includes(key))) throw new Error('공개 OAuth 클라이언트에는 비밀 키를 넣지 않아요.');
    if (client.redirectUri && publicUrl(client.redirectUri).hash) throw new Error('로그인 도착 주소에는 fragment를 넣지 않아요.');
    config.clients[product] = { clientId: client.clientId || '', redirectUri: client.redirectUri || '' };
  }
  config.authorizationClients = (value.authorizationClients || []).map(client => {
    if (!PRODUCTS[client.product] || typeof client.clientId !== 'string' || !Array.isArray(client.redirectUris)
      || Object.keys(client).some(key => !['product', 'clientId', 'redirectUris'].includes(key))) throw new Error('제품별 로그인 도착 주소 설정을 확인해 주세요.');
    for (const value of client.redirectUris) { const url = new URL(value);if (url.protocol !== 'synktalk:') publicUrl(value);if (url.username || url.password) throw new Error('도착 주소에는 사용자 정보를 넣지 않아요.'); }
    return { ...client };
  });
  config.accountApiUrl ||= config.supabaseUrl;
  config.learningUrl = publicUrl(value.learningUrl || '../learning-hub/', { relative: true, base }).href;
  return config;
}
export const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function createPKCE(cryptoAPI = globalThis.crypto) {
  const verifier = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const state = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return { verifier, state, challenge };
}
export async function beginOAuth({ config, product, storage, now = Date.now(), cryptoAPI }) {
  const client = config.clients[product];
  if (!config.configured || !client?.clientId || !client.redirectUri) throw new Error('이 제품의 SSO 연결 설정이 아직 준비되지 않았어요.');
  const pkce = await createPKCE(cryptoAPI), transaction = { ...pkce, product, clientId: client.clientId, redirectUri: client.redirectUri, createdAt: now };
  storage.setItem(`synk.oauth.pending.${product}`, JSON.stringify(transaction));
  const url = new URL('/auth/v1/oauth/authorize', config.supabaseUrl);
  url.search = new URLSearchParams({ response_type: 'code', client_id: client.clientId, redirect_uri: client.redirectUri,
    state: pkce.state, code_challenge: pkce.challenge, code_challenge_method: 'S256', scope: 'openid email profile' });
  return url.href;
}
export function consumeCallback({ config, product, url, storage, now = Date.now() }) {
  const params = new URL(url).searchParams, key = `synk.oauth.pending.${product}`, raw = storage.getItem(key);
  if (!raw) throw new Error('이 브라우저에서 시작한 로그인 요청이 아니에요. 다시 시작해 주세요.');
  const pending = JSON.parse(raw), client = config.clients[product];
  if (!pending || pending.product !== product || pending.clientId !== client?.clientId || pending.redirectUri !== client?.redirectUri
    || params.get('state') !== pending.state || now - pending.createdAt > 600000 || now < pending.createdAt) throw new Error('로그인 요청이 만료되었거나 상태가 달라졌어요. 다시 시작해 주세요.');
  const actual = new URL(url), expected = new URL(client.redirectUri);
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname
    || ![...expected.searchParams].every(([key, value]) => actual.searchParams.get(key) === value)) throw new Error('등록한 로그인 도착 주소와 달라요.');
  storage.removeItem(key);
  if (params.has('error')) throw new Error(params.get('error') === 'access_denied' ? '제품 연결을 취소했어요.' : '로그인을 마치지 못했어요. 다시 시작해 주세요.');
  const code = params.get('code');if (!code) throw new Error('로그인 코드가 없어요.');
  return { grant_type: 'authorization_code', client_id: client.clientId, redirect_uri: client.redirectUri, code, code_verifier: pending.verifier };
}
export async function tokenRequest(config, fields, fetcher = fetch) {
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12000);
  try {
    const response = await fetcher(new URL('/auth/v1/oauth/token', config.supabaseUrl), { method: 'POST', signal: abort.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields), credentials: 'omit', cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || typeof data.access_token !== 'string') throw new Error('로그인 연결을 마치지 못했어요. 다시 시작해 주세요.');
    return { access_token: data.access_token, refresh_token: data.refresh_token || null, expires_at: Date.now() + Number(data.expires_in || 3600) * 1000 };
  } finally { clearTimeout(timer); }
}
export function trustedConsentRedirect(value, config) {
  const target = new URL(value);
  if (target.username || target.password || target.hash) throw new Error('등록한 SYNK 제품의 도착 주소를 확인하지 못했어요.');
  const redirects = [...Object.values(config.clients).filter(c => c.clientId).map(c => c.redirectUri), ...config.authorizationClients.filter(c => c.clientId).flatMap(c => c.redirectUris)];
  const match = redirects.some(uri => {
    if (!uri) return false;
    const allowed = new URL(uri);
    if (target.protocol !== allowed.protocol || target.hostname !== allowed.hostname || target.port !== allowed.port) return false;
    return target.origin === allowed.origin && target.pathname === allowed.pathname
      && [...allowed.searchParams].every(([key, val]) => target.searchParams.get(key) === val);
  });
  if (!match) throw new Error('등록한 SYNK 제품의 도착 주소를 확인하지 못했어요.');
  return target.href;
}
export function authorizationProduct(clientId, config) {
  return Object.entries(config.clients).find(([, client]) => client.clientId && client.clientId === clientId)?.[0]
    || config.authorizationClients.find(client => client.clientId && client.clientId === clientId)?.product || null;
}
export function scopedStorage(storage, accountKey, revision, guard) {
  const prefix = `synk.account.${accountKey}.r${revision}.`;
  return Object.freeze(Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(method => [method, (key, ...args) => { guard();return storage[method](prefix + key, ...args); }])));
}
