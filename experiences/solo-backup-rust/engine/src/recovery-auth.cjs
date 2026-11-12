'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { atomic } = require('./paths.cjs');
const { request, requestJson, failure } = require('./recovery-http.cjs');
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN = 'https://oauth2.googleapis.com/token';
const INFO = 'https://openidconnect.googleapis.com/v1/userinfo';
const random = () => crypto.randomBytes(32).toString('base64url');
const validSub = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(s);
function clientConfig(value) {
  const c = value?.installed || value;
  if (!c || typeof c.client_id !== 'string' || !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(c.client_id) || typeof c.client_secret !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(c.client_secret) || typeof c.project_id !== 'string' || !/^[a-z][a-z0-9-]{4,62}$/.test(c.project_id)) throw failure('INVALID');
  return { client_id: c.client_id, client_secret: c.client_secret, project_id: c.project_id };
}
async function verifier({ loadDiscovery = requestJson, loadKeys = request } = {}) {
  const jose = await import('jose');
  const discovery = await loadDiscovery('https://accounts.google.com/.well-known/openid-configuration');
  if (discovery.jwks_uri !== 'https://www.googleapis.com/oauth2/v3/certs') throw failure('INVALID');
  const keys = jose.createRemoteJWKSet(new URL(discovery.jwks_uri), { timeoutDuration: 25000, cooldownDuration: 30000, cacheMaxAge: 3600000,
    [jose.customFetch]: async (url, options) => { const r = await loadKeys(String(url), { method: options?.method || 'GET', limit: 131072 }); return new Response(r.bytes, { status: 200, headers: r.headers }); } });
  return async (token, clientId, { nonce, sub } = {}) => {
    try {
      const { payload } = await jose.jwtVerify(token, keys, { algorithms: ['RS256'], issuer: ['accounts.google.com', 'https://accounts.google.com'], audience: clientId, clockTolerance: 60, requiredClaims: ['sub', 'iat', 'exp', 'aud', 'iss'] });
      if (!validSub(payload.sub) || payload.aud !== clientId || (payload.azp && payload.azp !== clientId) || (nonce && payload.nonce !== nonce) || (sub && payload.sub !== sub) || payload.email_verified !== true || typeof payload.email !== 'string' || payload.email.length > 320) throw failure('INVALID');
      return { sub: payload.sub, email: payload.email };
    } catch { throw failure('INVALID'); }
  };
}
// Single-use loopback authorization. Invalid traffic never consumes the state.
async function authorize(client, openExternal, { timeoutMs = 300000, signal } = {}) {
  const state = random(), nonce = random(), codeVerifier = random();
  let settled = false, timer, resolveCode, rejectCode;
  const codeResult = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  // Avoid unhandled rejection if the browser opener is still pending at timeout.
  void codeResult.catch(() => {});
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    let u; try { u = new URL(req.url, redirect); } catch { res.writeHead(400).end(); return; }
    if (settled || req.method !== 'GET' || req.socket.remoteAddress !== '127.0.0.1' || req.headers.host !== new URL(redirect).host || u.origin !== new URL(redirect).origin || u.pathname !== '/callback' || u.searchParams.getAll('state').length !== 1 || u.searchParams.get('state') !== state) { res.writeHead(400).end(); return; }
    settled = true; clearTimeout(timer); server.close();
    if (u.searchParams.has('error') || u.searchParams.getAll('code').length !== 1 || !u.searchParams.get('code') || u.searchParams.get('code').length > 4096) { res.writeHead(400).end('Authorization was not completed. Return to WorkBackup.'); rejectCode(failure('DENIED')); return; }
    res.end('Authorization received. Return to WorkBackup.'); resolveCode(u.searchParams.get('code'));
  });
  let redirect;
  await new Promise((resolve, reject) => { server.once('error', () => reject(failure())); server.listen(0, '127.0.0.1', resolve); });
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxConnections = 8;
  redirect = `http://127.0.0.1:${server.address().port}/callback`;
  timer = setTimeout(() => { settled = true; server.close(); server.closeAllConnections(); rejectCode(failure('REAUTH')); }, timeoutMs);
  const cancel = () => { settled = true; server.close(); server.closeAllConnections(); rejectCode(failure('REAUTH')); };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code', scope: `openid email ${SCOPE}`, access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'false', state, nonce, code_challenge: crypto.createHash('sha256').update(codeVerifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
  try { await openExternal(url.href); const code = await codeResult; return { code, nonce, codeVerifier, redirect }; }
  finally { settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); server.close(); server.closeAllConnections(); }
}
class GoogleAuth {
  constructor({ dir, secretStore, client, openExternal, json = requestJson, verify = null, authorizeFlow = authorize }) {
    this.dir = dir; this.secretStore = secretStore; this.client = client ? clientConfig(client) : null; this.openExternal = openExternal;
    this.json = json; this.verify = verify; this.authorizeFlow = authorizeFlow; this.tokens = null; this.refreshing = null;
  }
  async open() {
    await fs.mkdir(this.dir, { recursive: true });
    try {
      const v = JSON.parse(await this.secretStore.decrypt(await fs.readFile(path.join(this.dir, 'google.bin'))));
      if (!this.client || v.clientId !== this.client.client_id || !validSub(v.sub) || typeof v.email !== 'string' || typeof v.refresh !== 'string' || !v.refresh || v.refresh.length > 8192) throw failure('REAUTH');
      this.tokens = v;
    } catch (e) { if (e.code !== 'ENOENT') this.needsLogin = true; }
  }
  async persist(v) { await atomic(path.join(this.dir, 'google.bin'), await this.secretStore.encrypt(JSON.stringify(v))); this.tokens = v; this.needsLogin = false; }
  getState() { return { available: !!this.client, connected: !!this.tokens && !this.needsLogin, email: this.tokens?.email || null, needsLogin: !!this.needsLogin }; }
  async check(token, options) { this.verify ||= await verifier(); return this.verify(token, this.client.client_id, options); }
  async exchange(values) { return this.json(TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...values, client_id: this.client.client_id, client_secret: this.client.client_secret }).toString() }); }
  validateTokens(v) { if (v.token_type !== 'Bearer' || typeof v.access_token !== 'string' || !v.access_token || v.access_token.length > 8192 || !Number.isFinite(v.expires_in) || v.expires_in <= 0 || v.expires_in > 86400 || (v.scope && !v.scope.split(' ').includes(SCOPE))) throw failure('DENIED'); }
  async connect(expectedSub) {
    if (!this.client) throw failure('INVALID');
    this.controller = new AbortController();
    let flow;
    try { flow = await this.authorizeFlow(this.client, this.openExternal, { signal: this.controller.signal }); }
    finally { this.controller = null; }
    const v = await this.exchange({ code: flow.code, code_verifier: flow.codeVerifier, redirect_uri: flow.redirect, grant_type: 'authorization_code' });
    this.validateTokens(v);
    const user = await this.check(v.id_token, { nonce: flow.nonce });
    if (expectedSub && user.sub !== expectedSub) throw failure('ACCOUNT');
    if (typeof v.refresh_token !== 'string' || !v.refresh_token || v.refresh_token.length > 8192) throw failure('REAUTH');
    await this.persist({ clientId: this.client.client_id, ...user, access: v.access_token, refresh: v.refresh_token, expires: Date.now() + v.expires_in * 1000 });
    return this.getState();
  }
  async access() {
    if (!this.tokens || this.needsLogin) throw failure('REAUTH');
    if (this.tokens.access && this.tokens.expires > Date.now() + 120000) return this.tokens.access;
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        const old = this.tokens, v = await this.exchange({ refresh_token: old.refresh, grant_type: 'refresh_token' }); this.validateTokens(v);
        let user;
        if (v.id_token) user = await this.check(v.id_token, { sub: old.sub });
        else { user = await this.json(INFO, { headers: { authorization: `Bearer ${v.access_token}` } }); if (user.sub !== old.sub || user.email_verified !== true || typeof user.email !== 'string' || user.email.length > 320) throw failure('ACCOUNT'); }
        if (this.tokens !== old) throw failure('ACCOUNT');
        await this.persist({ ...old, email: user.email, access: v.access_token, refresh: v.refresh_token || old.refresh, expires: Date.now() + v.expires_in * 1000 });
        return this.tokens.access;
      } catch (e) { if (['REAUTH', 'ACCOUNT', 'INVALID', 'DENIED'].includes(e.code)) this.needsLogin = true; throw e; }
      finally { this.refreshing = null; }
    })();
    return this.refreshing;
  }
  async disconnect() { await fs.rm(path.join(this.dir, 'google.bin'), { force: true }); this.tokens = null; this.needsLogin = false; }
  cancel() { this.controller?.abort(); }
}
module.exports = { GoogleAuth, clientConfig, authorize, verifier, validSub, SCOPE };
