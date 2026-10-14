import { socialConversion } from '../../social-conversion.mjs';
const KEY = 'synk.social.signup.v1', MAX_AGE = 30 * 86400000;
const no = () => ({ ok: false, reason: 'no-new-registration' });
export function createSignupConversion({ conversion = socialConversion, storage, cryptoAPI = globalThis.crypto, now = () => Date.now() } = {}) {
  try { storage ??= globalThis.sessionStorage; } catch {}
  let pending = null, running = false, remembering = Promise.resolve();
  function read() { try { const value = pending || JSON.parse(storage?.getItem(KEY) || 'null');return value?.until > now() && /^[a-f0-9]{64}$/.test(value.ownerHash || '') ? value : null; } catch { return null; } }
  function clear() { pending = null;try { storage?.removeItem(KEY); } catch {} }
  async function ownerHash(id, salt) { return [...new Uint8Array(await cryptoAPI.subtle.digest('SHA-256', new TextEncoder().encode(salt + '\n' + id)))].map(n => n.toString(16).padStart(2, '0')).join(''); }
  function rememberEmail(result, startedAt) { remembering = rememberEmailResult(result, startedAt);return remembering; }
  async function rememberEmailResult(result, startedAt) {
    try {
      const user = result?.data?.user, created = Date.parse(user?.created_at || ''), clickId = conversion.attribution();
      // Providers return empty identities for an already registered address. A mail request alone is never a conversion.
      if (!clickId || result.error || typeof user?.id !== 'string' || !user.identities?.some(i => i.provider === 'email')
        || !Number.isFinite(created) || created < startedAt - 5000 || created > now() + 5000) return no();
      const eventId = cryptoAPI.randomUUID();
      pending = { eventId, clickId, ownerHash: await ownerHash(user.id, eventId), createdAt: user.created_at, until: now() + MAX_AGE };
      try { storage?.setItem(KEY, JSON.stringify(pending)); } catch {}
      return { ok: true, pending: true };
    } catch { return no(); }
  }
  async function verifiedPending(user) {
    try {
      await remembering;
      const value = read();
      if (!value || !user?.email_confirmed_at || !Number.isFinite(Date.parse(user.email_confirmed_at)) || user.is_anonymous === true
        || user.created_at !== value.createdAt || !user.identities?.some(i => i.provider === 'email')
        || await ownerHash(user.id, value.eventId) !== value.ownerHash || conversion.attribution() !== value.clickId) return null;
      return value;
    } catch { return null; }
  }
  async function confirmedHeaders(user) {
    const value=await verifiedPending(user);
    return value?{'x-synk-social-click':value.clickId,'x-synk-social-event':value.eventId}:{};
  }
  async function confirmedUser(user) {
    if (running) return no();running = true;
    try {
      const value=await verifiedPending(user);if(!value)return no();
      const result = await conversion.record('signup', { eventId: value.eventId, clickId: value.clickId });
      if (result?.ok || result?.reason === 'no-attribution') clear();return result;
    } catch { return no(); } finally { running = false; }
  }
  async function googleCompleted(result) {
    try {
      if (result?.ok !== true || result.account?.status !== 'active' || result.registration?.version !== 'google-registration-1') return no();
      return await conversion.record('signup', { eventId: cryptoAPI.randomUUID() });
    } catch { return no(); }
  }
  function registrationHeaders() { try { const clickId=conversion.attribution();return clickId?{'x-synk-social-click':clickId,'x-synk-social-event':cryptoAPI.randomUUID()}:{}; } catch { return {}; } }
  return Object.freeze({ rememberEmail, confirmedHeaders, confirmedUser, googleCompleted, registrationHeaders });
}
