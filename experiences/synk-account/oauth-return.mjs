const RESPONSE_KEYS = new Set(['state', 'code', 'error', 'error_description']);
const MAX_LENGTH = { state: 512, code: 4096, error: 256, error_description: 2048 };

/** Server-only navigation exception. The browser still verifies its pending state and PKCE. */
export function isOAuthReturnNavigation(req, url, config, clientKey) {
  if (req?.method !== 'GET' || req.headers?.['sec-fetch-mode'] !== 'navigate'
    || req.headers?.['sec-fetch-dest'] !== 'document') return false;
  if (typeof req.url !== 'string' || req.url.length > 8192 || req.url.split('?')[0] !== '/') return false;
  const client = config?.clients?.[clientKey];
  if (!config?.supabaseUrl || !config.supabasePublishableKey || !config.portalUrl
    || typeof client?.clientId !== 'string' || !client.clientId || !client.redirectUri) return false;
  try {
    const actual = new URL(url), expected = new URL(client.redirectUri);
    if (expected.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(expected.hostname)
      || expected.pathname !== '/' || expected.search || expected.hash || expected.username || expected.password
      || actual.origin !== expected.origin || actual.pathname !== expected.pathname
      || actual.hash || actual.username || actual.password
      || new URL(req.url, actual.origin).href !== actual.href) return false;
    if (req.headers.origin && req.headers.origin !== actual.origin) return false;
    const params = actual.searchParams;
    for (const [key, value] of params) {
      if (!RESPONSE_KEYS.has(key) || params.getAll(key).length !== 1 || !value.trim()
        || value.length > MAX_LENGTH[key] || /[\u0000-\u001f\u007f]/.test(value)) return false;
    }
    return params.has('state') && params.has('code') !== params.has('error')
      && (!params.has('error_description') || params.has('error'));
  } catch { return false; }
}
