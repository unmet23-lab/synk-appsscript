'use strict';
const https = require('node:https');
const HOSTS = new Set(['accounts.google.com', 'oauth2.googleapis.com', 'openidconnect.googleapis.com', 'www.googleapis.com', 'api.backblazeb2.com']);
// The provisioning server (STAGE1_DESIGN.md 「개통 서버 구현 설계」). Fixed here, never configurable.
const SERVER_HOST = 'workspace.synk.im';
class RecoveryError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function failure(code = 'NETWORK') {
  const messages = {
    NETWORK: '복구 정보 서버에 연결하지 못했습니다. 인터넷 연결 후 다시 시도합니다.',
    REAUTH: 'Google에 다시 로그인해 주세요. 이전 복구 정보는 그대로 보관됩니다.',
    DENIED: '복구 정보 접근 권한을 확인해 주세요.', QUOTA: 'Google 저장 공간이나 사용 한도를 확인해 주세요.',
    INVALID: '복구 정보 검증에 실패했습니다. 이전 복구 정보는 유지됩니다.',
    ACCOUNT: '처음 복구 정보를 보관한 Google 계정으로 로그인해 주세요.',
    BUSY: '복구 정보 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.'
  };
  return new RecoveryError(code, messages[code] || messages.INVALID);
}
// No redirects, ambient proxies, response text in errors, or configurable hosts.
function request(url, { method = 'GET', headers = {}, body, limit = 65536, timeoutMs = 25000 } = {}) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.port || u.username || u.password || !HOSTS.has(u.hostname)) return Promise.reject(failure('INVALID'));
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, value) => { if (finished) return; finished = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const req = https.request(u, { method, headers, timeout: timeoutMs }, res => {
      const chunks = []; let length = 0;
      if (Number(res.headers['content-length'] || 0) > limit) { res.destroy(); req.destroy(); return finish(failure('INVALID')); }
      res.on('data', chunk => { length += chunk.length; if (length > limit) { res.destroy(); req.destroy(); finish(failure('INVALID')); } else chunks.push(chunk); });
      res.on('error', () => finish(failure()));
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let data; try { data = JSON.parse(bytes); } catch {}
          return finish(failure(data?.error === 'invalid_grant' || res.statusCode === 401 ? 'REAUTH' : data?.error?.errors?.some(x => x.reason === 'storageQuotaExceeded') ? 'QUOTA' : res.statusCode === 429 || res.statusCode >= 500 ? 'NETWORK' : 'DENIED'));
        }
        finish(null, { bytes, headers: res.headers });
      });
    });
    const timer = setTimeout(() => { finish(failure()); req.destroy(); }, timeoutMs);
    req.on('timeout', () => { finish(failure()); req.destroy(); });
    req.on('error', () => finish(failure()));
    req.end(body);
  });
}
// The provisioning server answers JSON with its own code on every status (NOT_INVITED,
// BUSY, …). Same rules as request(): https only, fixed host and path, no redirects, no
// ambient proxy, bounded size, no response text in errors. Returns { status, data }.
function serverCall(url, { method = 'GET', body, token = null, limit = 262144, timeoutMs = 30000 } = {}) {
  let u;
  try { u = new URL(url); } catch { return Promise.reject(failure('INVALID')); }
  if (u.protocol !== 'https:' || u.port || u.username || u.password || u.hostname !== SERVER_HOST || !u.pathname.startsWith('/backup-api/v1/')) return Promise.reject(failure('INVALID'));
  if (token !== null && (typeof token !== 'string' || !/^wbd_[A-Za-z0-9_-]{43}$/.test(token))) return Promise.reject(failure('INVALID'));
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const headers = { accept: 'application/json', ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, value) => { if (finished) return; finished = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const req = https.request(u, { method, headers, timeout: timeoutMs, agent: false }, res => {
      const chunks = []; let length = 0;
      if (Number(res.headers['content-length'] || 0) > limit) { res.destroy(); req.destroy(); return finish(failure('INVALID')); }
      res.on('data', chunk => { length += chunk.length; if (length > limit) { res.destroy(); req.destroy(); finish(failure('INVALID')); } else chunks.push(chunk); });
      res.on('error', () => finish(failure()));
      res.on('end', () => {
        if (res.statusCode >= 300 && res.statusCode < 400) return finish(failure('INVALID'));
        let data = null; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
        if (!data || typeof data !== 'object') return finish(res.statusCode >= 500 ? failure('NETWORK') : failure('INVALID'));
        finish(null, { status: res.statusCode, data });
      });
    });
    const timer = setTimeout(() => { finish(failure()); req.destroy(); }, timeoutMs);
    req.on('timeout', () => { finish(failure()); req.destroy(); });
    req.on('error', () => finish(failure()));
    req.end(payload || undefined);
  });
}
async function requestJson(url, options) {
  const result = await request(url, options);
  try { return JSON.parse(result.bytes.toString('utf8')); } catch { throw failure('INVALID'); }
}
module.exports = { request, requestJson, serverCall, RecoveryError, failure, SERVER_HOST };
