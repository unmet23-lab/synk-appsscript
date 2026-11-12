'use strict';
const https = require('node:https');
const HOSTS = new Set(['accounts.google.com', 'oauth2.googleapis.com', 'openidconnect.googleapis.com', 'www.googleapis.com', 'api.backblazeb2.com']);
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
async function requestJson(url, options) {
  const result = await request(url, options);
  try { return JSON.parse(result.bytes.toString('utf8')); } catch { throw failure('INVALID'); }
}
module.exports = { request, requestJson, RecoveryError, failure };
