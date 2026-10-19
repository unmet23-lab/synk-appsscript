import { createECDH, createHash, createPrivateKey, randomUUID, sign } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

const TTL_MS = 60 * 60 * 1000;
const TOPIC = 'synk-company-notifications';
const fail = (status, message) => Object.assign(new Error(message), { status });
const sha256 = value => createHash('sha256').update(value).digest('hex');
const iso = value => new Date(value).toISOString();
const check = (value, status, message) => { if (!value) throw fail(status, message); };

export function generateVapidKeys() {
  const ec = createECDH('prime256v1'); ec.generateKeys();
  // OpenSSL may omit leading zero octets from the scalar; VAPID/JWK require 32.
  const scalar = ec.getPrivateKey(), privateKey = Buffer.alloc(32);
  scalar.copy(privateKey, privateKey.length - scalar.length);
  return { publicKey: ec.getPublicKey().toString('base64url'), privateKey: privateKey.toString('base64url') };
}

function vapidKey(publicKey, privateKey, subject) {
  check(typeof publicKey === 'string' && /^[A-Za-z0-9_-]{87}$/.test(publicKey) && typeof privateKey === 'string' && /^[A-Za-z0-9_-]{43}$/.test(privateKey), 503, '기기 알림 서버 설정을 확인해 주세요.');
  let contact, ec, point;
  try {
    contact = new URL(subject);
    ec = createECDH('prime256v1'); ec.setPrivateKey(Buffer.from(privateKey, 'base64url')); point = ec.getPublicKey();
  } catch { throw fail(503, '기기 알림 서버 설정을 확인해 주세요.'); }
  check((contact.protocol === 'mailto:' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.pathname) || contact.protocol === 'https:' && contact.hostname.includes('.') && !contact.username && !contact.password) && point.toString('base64url') === publicKey, 503, '기기 알림 서버 설정을 확인해 주세요.');
  return createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url'), d: privateKey } });
}

// RFC 8292 authentication only. Empty push bodies need no RFC 8291 encryption.
export function createVapidAuthorization({ endpoint, publicKey, privateKey, subject, now = new Date().toISOString() }) {
  const key = vapidKey(publicKey, privateKey, subject);
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.parse(now) / 1000) + 12 * 60 * 60, sub: subject })).toString('base64url');
  const unsigned = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `vapid t=${unsigned}.${signature}, k=${publicKey}`;
}

export function validatePushEndpoint(value) {
  check(typeof value === 'string' && value.length <= 4096 && !/[\s\x00-\x1f\\]/.test(value), 400, '이 브라우저의 알림 주소를 확인해 주세요.');
  let url; try { url = new URL(value); } catch { throw fail(400, '이 브라우저의 알림 주소를 확인해 주세요.'); }
  const host = url.hostname;
  // Chromium's kPushMessagingStagingGcmEndpoint uses this exact host and path.
  // Keep compatibility scoped to the capability route, not arbitrary Google URLs.
  const chromiumStaging = host === 'jmt17.google.com' && /^\/fcm\/send\/[^/]+$/.test(url.pathname);
  const trusted = chromiumStaging || ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com'].includes(host) || /^(?:[a-z0-9-]+\.)+push\.apple\.com$/.test(host) || /^(?:[a-z0-9-]+\.)+notify\.windows\.com$/.test(host);
  check(url.protocol === 'https:' && !url.username && !url.password && !url.hash && (!url.port || url.port === '443') && trusted && url.pathname !== '/', 400, '지원하는 브라우저의 알림 주소만 등록할 수 있습니다.');
  // The capability URL is opaque: preserve its original path and query bytes.
  return url.href;
}

export function isPublicPushAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 88 && c === 99) || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
  }
  if (isIP(address) !== 6) return false;
  const first = parseInt(address.split(':')[0], 16);
  // Global unicast only; reject transition/documentation prefixes too.
  return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && !/^2001:(?:0*:|0*db8:)/i.test(address);
}

/** No redirects, proxy environment, request body, cookies, or source text. */
export function createPayloadlessPushSender({ lookup = dnsLookup, request = httpsRequest } = {}) {
  return async ({ endpoint, publicKey, privateKey, subject, ttl, now, signal, authorize = () => true }) => {
    const url = new URL(validatePushEndpoint(endpoint));
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000);
    const bounded = promise => new Promise((resolve, reject) => {
      const abort = () => reject(Object.assign(new Error('기기 알림 연결을 중지했습니다.'), { code: 'PUSH_ABORTED' }));
      if (deadline.aborted) { abort(); return; }
      deadline.addEventListener('abort', abort, { once: true });
      Promise.resolve(promise).then(resolve, reject).finally(() => deadline.removeEventListener('abort', abort));
    });
    let addresses;
    try { addresses = await bounded(lookup(url.hostname, { all: true, verbatim: true })); }
    catch { throw Object.assign(new Error('기기 알림 네트워크 연결을 확인해 주세요.'), { code: 'PUSH_NETWORK' }); }
    check(addresses.length && addresses.every(item => isPublicPushAddress(item.address)), 400, '기기 알림 서버 주소를 확인해 주세요.');
    check(await bounded(authorize()), 401, '기기 알림을 받을 권한이 변경됐습니다.');
    if (deadline.aborted) throw Object.assign(new Error('기기 알림 전송을 중지했습니다.'), { code: 'PUSH_ABORTED' });
    const authorization = createVapidAuthorization({ endpoint: url.href, publicKey, privateKey, subject, now });
    return new Promise((resolve, reject) => {
      const req = request(url, {
        method: 'POST', agent: false, signal: deadline,
        headers: { Authorization: authorization, TTL: String(ttl), Urgency: 'normal', Topic: TOPIC, 'Content-Length': '0' },
        // Pin the checked results to this connection to prevent DNS rebinding.
        lookup(_host, options, callback) { if (options?.all) callback(null, addresses); else callback(null, addresses[0].address, addresses[0].family); },
      }, res => {
        const result = { statusCode: res.statusCode, retryAfter: res.headers['retry-after'] || null };
        res.destroy(); resolve(result);
      });
      req.on('error', () => reject(Object.assign(new Error('기기 알림 전송을 완료하지 못했습니다.'), { code: signal?.aborted ? 'PUSH_ABORTED' : 'PUSH_NETWORK' })));
      req.end();
    });
  };
}

/** Company SQLite stores opaque source IDs, never notification/message bodies. */
export function createWebPushService({ db, enabled = false, publicKey = null, privateKey = null, subject = null, now = () => new Date().toISOString(), notificationsForUser, currentSession, send = createPayloadlessPushSender() }) {
  check(typeof enabled === 'boolean' && typeof currentSession === 'function' && typeof notificationsForUser === 'function', 500, '기기 알림 연결 설정을 확인해 주세요.');
  let configured = false;
  if (enabled && publicKey && privateKey && subject) { vapidKey(publicKey, privateKey, subject); configured = true; }
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_push_subscriptions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_hash TEXT NOT NULL,endpoint_hash TEXT NOT NULL UNIQUE,endpoint TEXT,label TEXT NOT NULL,created_at TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),public_key TEXT NOT NULL,last_accepted_at TEXT);
    CREATE INDEX IF NOT EXISTS web_push_user ON web_push_subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS web_push_queue (subscription_id TEXT NOT NULL REFERENCES web_push_subscriptions(id) ON DELETE CASCADE,notification_id TEXT NOT NULL,source_created_at TEXT NOT NULL,expires_at TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('baseline','pending','sending','accepted','skipped','failed')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT NOT NULL,lease_until TEXT,last_status INTEGER,PRIMARY KEY(subscription_id,notification_id));
    CREATE INDEX IF NOT EXISTS web_push_due ON web_push_queue(state,next_attempt_at);
  `);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = action => { db.exec('BEGIN IMMEDIATE'); try { const value = action(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const controllers = new Map();
  let stopped = false, running = null;
  const unavailable = () => Object.assign(fail(503, '기기 알림의 로그인 상태를 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'), { code: 'PUSH_IDENTITY_UNAVAILABLE' });
  const live = async (userId, sessionHash) => {
    if (stopped) return null;
    try { const value = await currentSession(userId, sessionHash); return stopped ? null : value === true || value === false ? value : null; }
    catch { return null; }
  };
  const requireLive = async (userId, sessionHash) => {
    const active = await live(userId, sessionHash);
    if (active === null || stopped) throw unavailable();
    check(active, 401, '로그인 상태를 다시 확인해 주세요.');
  };
  const sourceList = async userId => {
    const rows = await notificationsForUser(userId);
    check(Array.isArray(rows), 500, '기기 알림 원본 연결을 확인해 주세요.');
    return rows.filter(row => row && typeof row.id === 'string' && row.id.length <= 1000 && Number.isFinite(Date.parse(row.createdAt)));
  };
  const sourceExpiry = source => Math.min(Date.parse(source.createdAt) + TTL_MS,
    typeof source.expiresAt === 'string' && Number.isFinite(Date.parse(source.expiresAt)) ? Date.parse(source.expiresAt) : Infinity);
  const usable = row => configured && row?.enabled === 1 && row.public_key === publicKey && !!row.endpoint;
  const metadata = (row, sessionHash, active) => ({ id: row.id, label: row.label, endpointHash: row.endpoint_hash, createdAt: row.created_at, lastAcceptedAt: row.last_accepted_at || null, enabled: usable(row) && active, currentSession: row.session_hash === sessionHash });
  function disable(id) {
    if (stopped) return;
    controllers.get(id)?.abort();
    transaction(() => {
      run('UPDATE web_push_subscriptions SET enabled=0,endpoint=NULL WHERE id=?', id);
      run("UPDATE web_push_queue SET state='skipped',lease_until=NULL WHERE subscription_id=? AND state IN ('pending','sending')", id);
    });
  }
  async function state(userId, sessionHash) {
    if (stopped) throw unavailable();
    const subscriptions = [];
    for (const row of all('SELECT * FROM web_push_subscriptions WHERE user_id=? ORDER BY created_at,id', userId)) {
      const active = await live(row.user_id, row.session_hash);
      if (active === null || stopped) throw unavailable();
      subscriptions.push(metadata(row, sessionHash, active));
    }
    return { configured, publicKey: configured ? publicKey : null, subscriptions, defaultEnabled: false };
  }
  async function register(userId, sessionHash, input) {
    check(configured && !stopped, 503, '기기 알림 서버가 아직 준비되지 않았습니다.');
    check(typeof userId === 'string' && userId && typeof sessionHash === 'string' && sessionHash, 401, '로그인 상태를 다시 확인해 주세요.');
    await requireLive(userId, sessionHash);
    check(input && typeof input === 'object' && !Array.isArray(input) && input.subscription && typeof input.subscription === 'object', 400, '브라우저의 알림 연결을 확인해 주세요.');
    const endpoint = validatePushEndpoint(input.subscription.endpoint), endpointHash = sha256(endpoint);
    const label = input.label === undefined ? '이 기기' : input.label;
    check(typeof label === 'string' && label.trim().length >= 1 && label.length <= 80 && !/[\x00-\x1f]/.test(label), 400, '기기 이름은 1~80자로 입력해 주세요.');
    const sources = await sourceList(userId);
    await requireLive(userId, sessionHash);
    if (stopped) throw unavailable();
    const at = now();
    const row = transaction(() => {
      const existing = one('SELECT * FROM web_push_subscriptions WHERE endpoint_hash=?', endpointHash);
      if (existing && existing.user_id === userId && existing.session_hash === sessionHash && usable(existing)) {
        run('UPDATE web_push_subscriptions SET label=? WHERE id=?', label.trim(), existing.id);
        return { ...existing, label: label.trim() };
      }
      check(one('SELECT count(*) AS count FROM web_push_subscriptions WHERE user_id=? AND enabled=1 AND endpoint_hash<>?', userId, endpointHash).count < 10, 409, '알림을 받을 기기는 최대 10개까지 등록할 수 있습니다.');
      if (existing) { controllers.get(existing.id)?.abort(); run('DELETE FROM web_push_queue WHERE subscription_id=?', existing.id); run('DELETE FROM web_push_subscriptions WHERE id=?', existing.id); }
      const id = randomUUID();
      run('INSERT INTO web_push_subscriptions(id,user_id,session_hash,endpoint_hash,endpoint,label,created_at,enabled,public_key) VALUES(?,?,?,?,?,?,?,1,?)', id, userId, sessionHash, endpointHash, endpoint, label.trim(), at, publicKey);
      // Exact IDs also exclude old unread rows with the same millisecond as opt-in.
      for (const source of sources) run("INSERT OR IGNORE INTO web_push_queue(subscription_id,notification_id,source_created_at,expires_at,state,next_attempt_at) VALUES(?,?,?,?,'baseline',?)", id, source.id, source.createdAt, iso(Date.parse(at) + TTL_MS), at);
      return one('SELECT * FROM web_push_subscriptions WHERE id=?', id);
    });
    return { subscription: metadata(row, sessionHash, true) };
  }
  async function remove(userId, id) {
    check(one('SELECT 1 FROM web_push_subscriptions WHERE user_id=? AND id=?', userId, id), 404, '기기 알림을 찾을 수 없습니다.');
    controllers.get(id)?.abort();
    transaction(() => { run('DELETE FROM web_push_queue WHERE subscription_id=?', id); run('DELETE FROM web_push_subscriptions WHERE user_id=? AND id=?', userId, id); });
    return { ok: true };
  }
  async function revokeSession(sessionHash) {
    for (const row of all('SELECT id FROM web_push_subscriptions WHERE session_hash=?', sessionHash)) disable(row.id);
  }
  function pendingSources(subscription, sources, at) {
    const visible = new Map(sources.filter(row => !row.readAt && row.unread !== false).map(row => [row.id, row]));
    transaction(() => {
      run("UPDATE web_push_queue SET state='pending',lease_until=NULL WHERE subscription_id=? AND state='sending' AND lease_until<=?", subscription.id, at);
      for (const source of visible.values()) {
        if (Date.parse(source.createdAt) < Date.parse(subscription.created_at) || Date.parse(source.createdAt) > Date.parse(at) || sourceExpiry(source) <= Date.parse(at)) continue;
        run("INSERT OR IGNORE INTO web_push_queue(subscription_id,notification_id,source_created_at,expires_at,state,next_attempt_at) VALUES(?,?,?,?,'pending',?)", subscription.id, source.id, source.createdAt, iso(sourceExpiry(source)), at);
      }
      for (const row of all("SELECT * FROM web_push_queue WHERE subscription_id=? AND state IN ('pending','sending')", subscription.id)) {
        if (!visible.has(row.notification_id) || row.expires_at <= at) run("UPDATE web_push_queue SET state='skipped',lease_until=NULL WHERE subscription_id=? AND notification_id=?", subscription.id, row.notification_id);
      }
    });
    return all("SELECT * FROM web_push_queue WHERE subscription_id=? AND state='pending' AND next_attempt_at<=? AND expires_at>? ORDER BY source_created_at,notification_id LIMIT 100", subscription.id, at, at);
  }
  async function deliver(subscription) {
    if (!usable(subscription) || stopped) return;
    const initialSession = await live(subscription.user_id, subscription.session_hash);
    if (initialSession !== true || stopped) { if (initialSession === false) disable(subscription.id); return; }
    let sources;
    try { sources = await sourceList(subscription.user_id); } catch { return; }
    if (stopped) return;
    const at = now(), rows = pendingSources(subscription, sources, at);
    if (!rows.length || stopped) return;
    // Repeat both identity and original source checks after asynchronous work.
    const checkedSession = await live(subscription.user_id, subscription.session_hash);
    if (checkedSession !== true || stopped) { if (checkedSession === false) disable(subscription.id); return; }
    try { sources = await sourceList(subscription.user_id); } catch { return; }
    if (stopped) return;
    const visible = new Set(sources.filter(row => !row.readAt && row.unread !== false).map(row => row.id));
    const current = one('SELECT * FROM web_push_subscriptions WHERE id=?', subscription.id);
    if (!usable(current) || current.session_hash !== subscription.session_hash || stopped) return;
    const selected = rows.filter(row => visible.has(row.notification_id) && row.expires_at > now());
    if (!selected.length) return;
    const lease = iso(Date.parse(now()) + 30000);
    const claimed = transaction(() => selected.filter(row => run("UPDATE web_push_queue SET state='sending',lease_until=?,attempts=attempts+1 WHERE subscription_id=? AND notification_id=? AND state='pending'", lease, subscription.id, row.notification_id).changes));
    if (!claimed.length) return;
    const controller = new AbortController(); controllers.set(subscription.id, controller);
    let response;
    try {
      const ttl = Math.max(1, Math.floor((Math.min(...claimed.map(row => Date.parse(row.expires_at))) - Date.parse(now())) / 1000));
      response = await send({ endpoint: current.endpoint, publicKey, privateKey, subject, ttl, now: now(), signal: controller.signal, authorize: async () => {
        if (stopped || controller.signal.aborted) throw unavailable();
        const active = await live(subscription.user_id, subscription.session_hash);
        if (active === null || stopped || controller.signal.aborted) throw unavailable();
        if (active === false) { disable(subscription.id); return false; }
        const fresh = await sourceList(subscription.user_id);
        if (stopped || controller.signal.aborted) throw unavailable();
        const liveRow = one('SELECT * FROM web_push_subscriptions WHERE id=?', subscription.id);
        const ids = new Set(fresh.filter(row => !row.readAt && row.unread !== false).map(row => row.id));
        return usable(liveRow) && liveRow.session_hash === subscription.session_hash && claimed.some(row => ids.has(row.notification_id) && row.expires_at > now());
      } });
    } catch (error) { response = { statusCode: Number.isInteger(error?.status) ? error.status : 0, identityUnavailable: error?.code === 'PUSH_IDENTITY_UNAVAILABLE' }; }
    finally { if (controllers.get(subscription.id) === controller) controllers.delete(subscription.id); }
    if (stopped || controller.signal.aborted) return;
    const code = Number(response?.statusCode || 0), completedAt = now();
    if ([404, 410].includes(code)) { disable(subscription.id); return; }
    const accepted = code >= 200 && code < 300;
    const transient = !code || code === 408 || code === 429 || code >= 500;
    transaction(() => {
      for (const row of claimed) {
        // No provider request was authorized. Preserve its retry budget and
        // original TTL while waiting for the existing identity to recover.
        if (response.identityUnavailable) {
          const next = iso(Math.min(Date.parse(row.expires_at), Date.parse(completedAt) + 15000));
          run("UPDATE web_push_queue SET state=?,lease_until=NULL,last_status=503,attempts=?,next_attempt_at=? WHERE subscription_id=? AND notification_id=? AND state='sending' AND lease_until=?", row.expires_at > completedAt ? 'pending' : 'skipped', row.attempts, next, subscription.id, row.notification_id, lease);
          continue;
        }
        const attempts = row.attempts + 1;
        const retry = transient && attempts < 6 && row.expires_at > completedAt;
        let delay = Math.min(15 * 60000, 15000 * 2 ** (attempts - 1));
        const after = response?.retryAfter;
        if (typeof after === 'string' && /^\d+$/.test(after)) delay = Math.max(delay, Number(after) * 1000);
        else if (typeof after === 'string' && Number.isFinite(Date.parse(after))) delay = Math.max(delay, Date.parse(after) - Date.parse(completedAt));
        const next = iso(Math.min(Date.parse(row.expires_at), Date.parse(completedAt) + delay));
        run('UPDATE web_push_queue SET state=?,lease_until=NULL,last_status=?,next_attempt_at=? WHERE subscription_id=? AND notification_id=? AND state=\'sending\' AND lease_until=?', accepted ? 'accepted' : retry ? 'pending' : 'failed', code, next, subscription.id, row.notification_id, lease);
      }
      if (accepted) run('UPDATE web_push_subscriptions SET last_accepted_at=? WHERE id=? AND enabled=1', completedAt, subscription.id);
    });
  }
  async function drain() {
    if (!configured || stopped) return;
    for (const subscription of all('SELECT * FROM web_push_subscriptions WHERE enabled=1 ORDER BY created_at,id')) {
      if (stopped) break;
      await deliver(subscription);
    }
    if (stopped) return;
    // Old entries cannot be rediscovered: every discovery is bounded by TTL.
    const cutoff = iso(Date.parse(now()) - 30 * 24 * TTL_MS);
    run("DELETE FROM web_push_queue WHERE expires_at<? AND state IN ('baseline','accepted','skipped','failed')", cutoff);
  }
  function tick() {
    if (running) return running;
    running = drain().finally(() => { running = null; });
    return running;
  }
  async function stop() { stopped = true; for (const controller of controllers.values()) controller.abort(); await running; }
  return { state, register, remove, revokeSession, tick, stop };
}
