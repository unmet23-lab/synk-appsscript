// Signed requests between the api service and its two workers (keys, files).
// Each worker has its own HMAC key; a request carries a timestamp (±60 s) and a
// random id that the worker accepts once. Only error codes cross back — never a
// B2 message that might echo a name or a secret.
import crypto from 'node:crypto';
import http from 'node:http';

const SKEW_MS = 60000;
const MAX_BODY = 1 << 20;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const sign = (secret, ts, id, method, body) => crypto.createHmac('sha256', secret).update(`wb-rpc/v1\n${ts}\n${id}\n${method}\n${sha(body)}`).digest('base64url');

export class RpcError extends Error {
  constructor(code, status = 500) { super(code); this.name = 'RpcError'; this.code = code; this.status = status; }
}

function httpFetch(url, { body, headers, timeout }) {
  return new Promise((ok, no) => {
    const u = new URL(url);
    if (u.protocol !== 'http:') { no(new Error('RPC_URL')); return; }
    const req = http.request(u, { method: 'POST', agent: false, headers: { ...headers, 'content-length': Buffer.byteLength(body) } });
    const timer = setTimeout(() => req.destroy(new Error('TIMEOUT')), timeout);
    req.on('response', (res) => {
      const chunks = []; let size = 0;
      res.on('data', (c) => { size += c.length; if (size > 64 * 1024 * 1024) req.destroy(new Error('TOO_BIG')); else chunks.push(c); });
      res.on('end', () => { clearTimeout(timer); const text = Buffer.concat(chunks).toString('utf8'); ok({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => JSON.parse(text) }); });
      res.on('error', (e) => { clearTimeout(timer); no(e); });
    });
    req.on('error', (e) => { clearTimeout(timer); no(e); });
    req.end(body);
  });
}

export function rpcClient({ url, secret, fetchImpl = null, timeoutMs = 30000, now = () => Date.now() }) {
  if (!url || !secret || secret.length < 32) throw new Error('RPC_CONFIG');
  return async function call(method, params = {}, { timeout = timeoutMs } = {}) {
    const body = JSON.stringify({ method, params });
    const ts = String(now()), id = crypto.randomBytes(16).toString('base64url');
    let res;
    try {
      const headers = { 'content-type': 'application/json', 'x-wb-ts': ts, 'x-wb-id': id, 'x-wb-sig': sign(secret, ts, id, method, body) };
      res = fetchImpl ? await fetchImpl(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeout), body, headers }) : await httpFetch(url, { body, headers, timeout });
    } catch { throw new RpcError('WORKER_UNREACHABLE', 503); }
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok || !data?.ok) throw new RpcError(typeof data?.code === 'string' ? data.code.slice(0, 40) : 'WORKER_FAILED', res.status === 429 ? 429 : 503);
    return data.result;
  };
}

// handlers: { 'name.verb': async (params) => result }. Thrown errors with a
// string `code` pass that code; everything else becomes WORKER_FAILED.
export function rpcServer({ secret, handlers, now = () => Date.now(), log = () => {} }) {
  if (!secret || secret.length < 32) throw new Error('RPC_CONFIG');
  const seen = new Map();
  const remember = (id, t) => { seen.set(id, t); if (seen.size > 5000) for (const [k, v] of seen) if (t - v > 2 * SKEW_MS) seen.delete(k); };
  return http.createServer((req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
    if (req.method !== 'POST' || req.url !== '/rpc') return reply(404, { ok: false, code: 'NOT_FOUND' });
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) req.destroy(); else chunks.push(c); });
    req.on('end', async () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const ts = String(req.headers['x-wb-ts'] || ''), id = String(req.headers['x-wb-id'] || ''), sig = String(req.headers['x-wb-sig'] || '');
      let msg; try { msg = JSON.parse(body); } catch { return reply(400, { ok: false, code: 'BAD_INPUT' }); }
      const t = now();
      if (!/^\d{10,16}$/.test(ts) || Math.abs(t - Number(ts)) > SKEW_MS || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) return reply(401, { ok: false, code: 'RPC_AUTH' });
      const want = Buffer.from(sign(secret, ts, id, String(msg?.method), body)), got = Buffer.from(sig);
      if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return reply(401, { ok: false, code: 'RPC_AUTH' });
      if (seen.has(id)) return reply(401, { ok: false, code: 'RPC_REPLAY' });
      remember(id, t);
      const fn = Object.hasOwn(handlers, msg.method) ? handlers[msg.method] : null;
      if (!fn) return reply(404, { ok: false, code: 'NO_METHOD' });
      try { reply(200, { ok: true, result: await fn(msg.params || {}) }); }
      catch (e) {
        const code = typeof e?.code === 'string' && /^[A-Z_]{2,40}$/.test(e.code) ? e.code : 'WORKER_FAILED';
        log({ method: msg.method, code, status: e?.status ?? null });
        reply(code === 'LIMIT_WORKER_DAY' ? 429 : 500, { ok: false, code });
      }
    });
  });
}
