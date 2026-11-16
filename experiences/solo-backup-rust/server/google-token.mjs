// Google ID token check for the provisioning server (STAGE1_DESIGN.md 「개통 서버 구현 설계」).
// RS256 only, Google's own JWKS, no third-party library. The caller supplies the
// accepted audiences (our desktop client id, later the lost-report web client) and
// checks the nonce against its own table — this module only returns the claims.
// A token issued more than maxAgeMs ago is refused: every server action that
// needs a Google proof needs a sign-in that just happened.
import crypto from 'node:crypto';

export const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const B64URL = /^[A-Za-z0-9_-]+$/;
const SUB = /^[A-Za-z0-9_-]{1,255}$/;

export class TokenError extends Error {
  constructor(reason) { super('TOKEN'); this.name = 'TokenError'; this.code = 'TOKEN'; this.reason = reason; }
}

function part(text, what) {
  if (typeof text !== 'string' || !text || !B64URL.test(text)) throw new TokenError(what);
  return Buffer.from(text, 'base64url');
}
function json(text, what) {
  try { const v = JSON.parse(part(text, what).toString('utf8')); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch {}
  throw new TokenError(what);
}
function maxAge(header) {
  const m = /(?:^|,)\s*max-age=(\d+)/i.exec(header || '');
  const s = m ? Number(m[1]) : 3600;
  return Math.min(Math.max(s, 300), 86400) * 1000;
}

export function createVerifier({ audiences, fetchImpl = fetch, now = () => Date.now(), jwksUrl = JWKS_URL, maxAgeMs = 600000, skewMs = 60000, timeoutMs = 10000 } = {}) {
  const accepted = new Set((audiences || []).filter((a) => typeof a === 'string' && a));
  if (!accepted.size) throw new Error('GOOGLE_AUDIENCE_MISSING');
  let keys = new Map(), expires = 0, loading = null, lastForced = 0;

  async function fetchKeys() {
    const res = await fetchImpl(jwksUrl, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new TokenError('jwks-status');
    const text = await res.text();
    if (text.length > 65536) throw new TokenError('jwks-size');
    let body; try { body = JSON.parse(text); } catch { throw new TokenError('jwks-json'); }
    const next = new Map();
    for (const jwk of Array.isArray(body?.keys) ? body.keys : []) {
      if (jwk?.kty !== 'RSA' || typeof jwk.kid !== 'string' || (jwk.alg && jwk.alg !== 'RS256') || (jwk.use && jwk.use !== 'sig')) continue;
      try { next.set(jwk.kid, crypto.createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' })); } catch {}
    }
    if (!next.size) throw new TokenError('jwks-empty');
    keys = next; expires = now() + maxAge(res.headers.get('cache-control'));
  }
  async function load(force) {
    if (!force && keys.size && now() < expires) return;
    // A token naming an unknown kid may force one refresh a minute (Google rotates keys).
    if (force && keys.size && now() - lastForced < 60000) return;
    if (force) lastForced = now();
    loading ||= fetchKeys().finally(() => { loading = null; });
    await loading;
  }

  return async function verify(token) {
    if (typeof token !== 'string' || token.length > 8192) throw new TokenError('format');
    const parts = token.split('.');
    if (parts.length !== 3) throw new TokenError('format');
    const header = json(parts[0], 'header');
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || (header.typ && header.typ !== 'JWT') || header.crit) throw new TokenError('alg');
    const claims = json(parts[1], 'payload'), signature = part(parts[2], 'signature');
    await load(false);
    if (!keys.has(header.kid)) await load(true);
    const key = keys.get(header.kid);
    if (!key) throw new TokenError('kid');
    if (!crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, signature)) throw new TokenError('signature');
    const t = now();
    if (!ISSUERS.has(claims.iss)) throw new TokenError('iss');
    if (typeof claims.aud !== 'string' || !accepted.has(claims.aud)) throw new TokenError('aud');
    if (claims.azp !== undefined && claims.azp !== claims.aud) throw new TokenError('azp');
    if (!Number.isFinite(claims.exp) || claims.exp * 1000 < t - skewMs) throw new TokenError('expired');
    if (!Number.isFinite(claims.iat) || claims.iat * 1000 > t + skewMs) throw new TokenError('iat');
    if (t - claims.iat * 1000 > maxAgeMs) throw new TokenError('stale');
    if (!SUB.test(claims.sub || '')) throw new TokenError('sub');
    if (claims.email_verified !== true || typeof claims.email !== 'string' || claims.email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(claims.email)) throw new TokenError('email');
    if (typeof claims.nonce !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(claims.nonce)) throw new TokenError('nonce');
    return { sub: claims.sub, email: claims.email.toLowerCase(), nonce: claims.nonce, aud: claims.aud, iat: claims.iat };
  };
}
