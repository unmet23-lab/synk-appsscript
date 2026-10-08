// Reuse the central account API's verified identity and revocation checks.
// No JWT decoding, password database, token persistence or separate identity issuer.
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
export function createDatingAccountVerifier({ accountApiUrl, supabasePublishableKey, fetchImpl = globalThis.fetch } = {}) {
  if (!accountApiUrl || !supabasePublishableKey) return null;
  const base = new URL(accountApiUrl);
  if (base.username || base.password || base.search || base.hash || base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) throw new TypeError('Use the existing HTTPS SYNK account API.');
  const endpoint = new URL(`${base.href.replace(/\/$/, '')}/functions/v1/synk-account`);
  return async token => {
    let response, result;
    try {
      response = await fetchImpl(endpoint, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(8000), cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, apikey: supabasePublishableKey, 'X-SYNK-Product': 'platform', 'X-SYNK-Contract': '1', 'X-SYNK-App-Version': '0.2.0' } });
      result = await response.json();
    } catch { fail(503, 'account-auth-unavailable'); }
    if (!response.ok || result?.ok !== true) fail(response.status === 401 || response.status === 403 ? 401 : 503, 'account-auth-required');
    if (result.account?.status !== 'active' || !/^[A-Za-z0-9_.:@-]{1,160}$/.test(result.account?.synk_user_id || '')) fail(403, 'account-unavailable');
    return { accountId: result.account.synk_user_id };
  };
}
