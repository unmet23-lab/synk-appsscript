'use strict';
const {createHash, randomBytes} = require('node:crypto');
const {jwtVerify, createLocalJWKSet} = require('./vendor/chatgpt-jose.cjs');

const ISSUER = 'https://auth.openai.com';
const invalid = () => { throw new Error('IDENTITY_INVALID'); };
const networkError = () => Object.assign(new Error('NETWORK'), {code:'OPENAI_NETWORK'});
const random = () => randomBytes(32).toString('base64url');
function registrationOf(input) {
  if (!input || input.issuer !== ISSUER || input.tokenEndpointAuthMethod !== 'none' ||
      Object.keys(input).some(key => !['issuer', 'clientId', 'redirectUri', 'tokenEndpointAuthMethod'].includes(key)) ||
      typeof input.clientId !== 'string' || !/^oaiapp_[A-Za-z0-9_-]{1,150}$/.test(input.clientId)) return null;
  let callback;
  try { callback = new URL(input.redirectUri); } catch { return null; }
  if (callback.href !== input.redirectUri || callback.protocol !== 'http:' || callback.hostname !== '127.0.0.1' ||
      Number(callback.port) < 1024 || callback.pathname !== '/solio/openai/callback' ||
      callback.username || callback.password || callback.hash || callback.search) return null;
  return Object.freeze({clientId: input.clientId, callback});
}
function endpoint(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.origin !== ISSUER || u.username || u.password || u.search || u.hash) invalid();
  return u.href;
}
async function json(fetcher, url, signal, options = {}) {
  let response;
  try {
    response = await fetcher(url, {...options, signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      redirect: 'error', credentials: 'omit', cache: 'no-store'});
  } catch { throw networkError(); }
  if (response.status === 429 || response.status >= 500) throw networkError();
  if (!response.ok || !response.body) invalid();
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read().catch(() => { throw networkError(); });
      if (done) break;
      size += value.byteLength;
      if (size > 131072) { await reader.cancel(); invalid(); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function discover(fetcher, signal) {
  const data = await json(fetcher, ISSUER + '/.well-known/openid-configuration', signal);
  if (data.issuer !== ISSUER || !data.id_token_signing_alg_values_supported?.includes('RS256') ||
      !data.token_endpoint_auth_methods_supported?.includes('none') ||
      (data.code_challenge_methods_supported && !data.code_challenge_methods_supported.includes('S256'))) invalid();
  return {authorization: endpoint(data.authorization_endpoint), token: endpoint(data.token_endpoint), jwks: endpoint(data.jwks_uri)};
}
function transaction() { return {state: random(), nonce: random(), verifier: random()}; }
function authorize(reg, endpoints, tx) {
  const url = new URL(endpoints.authorization);
  url.search = new URLSearchParams({client_id: reg.clientId, redirect_uri: reg.callback.href,
    response_type: 'code', scope: 'openid', state: tx.state, nonce: tx.nonce,
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(tx.verifier).digest('base64url')}).toString();
  return url.href;
}
async function identify({reg, endpoints, tx, code, fetcher, signal, now}) {
  const body = new URLSearchParams({grant_type: 'authorization_code', client_id: reg.clientId,
    code, redirect_uri: reg.callback.href, code_verifier: tx.verifier});
  const response = await json(fetcher, endpoints.token, signal, {method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'}, body});
  const jwt = response.id_token;
  if (typeof jwt !== 'string' || jwt.length > 32768) invalid();
  // A public identity-only registration may return just an ID token.
  const options = {algorithms: ['RS256'], issuer: ISSUER, audience: reg.clientId, maxTokenAge: '10m',
    requiredClaims: ['iss','aud','iat','exp','sub','nonce'], clockTolerance: 60};
  async function verify() {
    const keys = await json(fetcher, endpoints.jwks, signal);
    if (!Array.isArray(keys.keys) || keys.keys.length > 64) invalid();
    return jwtVerify(jwt, createLocalJWKSet(keys), {...options, currentDate:new Date(now())});
  }
  let verified;
  try { verified = await verify(); } catch (error) {
    if (error.code !== 'ERR_JWKS_NO_MATCHING_KEY') throw error;
    verified = await verify();
  }
  const {payload, protectedHeader} = verified;
  if (typeof protectedHeader.kid !== 'string' || !protectedHeader.kid ||
      typeof payload.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(payload.sub) ||
      payload.nonce !== tx.nonce || payload.exp <= payload.iat || payload.exp <= Math.floor(now()/1000) - 5 ||
      (Array.isArray(payload.aud) && (payload.aud.length !== 1 || payload.aud[0] !== reg.clientId)) ||
      (payload.azp !== undefined && payload.azp !== reg.clientId)) invalid();
  return payload.sub;
}
module.exports = {ISSUER, registrationOf, discover, transaction, authorize, identify};

