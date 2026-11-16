// The api service of the provisioning server (STAGE1_DESIGN.md 4.5 and 「개통 서버 구현 설계」).
// It holds no B2 key. Keys are made and deleted by the keys worker, file listings
// and restores are done by the files worker; both are reached through signed rpc.
// Requests that make, delete or move keys run one at a time per customer (BUSY
// otherwise). Every answer carries Cache-Control: no-store because some carry key
// secrets. Logs carry route, status and error code only — never a body or token.
import http from 'node:http';
import crypto from 'node:crypto';
import { ACK_MS } from './store.mjs';
import { cleanBatch, cleanBundle } from './telemetry.mjs';
import { suggest } from './detect.mjs';
import { RpcError } from './rpc.mjs';

export const LIMITS = { writers: 1, readers: 2, keyRequestsPerDay: 5, quotaBytes: 100 * 1024 ** 3, overFactor: 1.5, maxRestoreAgeMs: 29 * 86400000, plansPerDay: 20 };
const DAY = 86400000;
// The per-customer lease outlives any one key-changing request (a few worker calls).
const LOCK_MS = 10 * 60000;
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}(?:-[a-z0-9.]{1,20})?$/;
const ID16 = /^[a-z0-9]{16}$/, ID12 = /^[a-z0-9]{12}$/;
const MOVE_PIN_MS = 7 * DAY;
const SNAPSHOT_ID = /^[0-9a-f]{64}$/;
const INSTALL_ID = /^[A-Za-z0-9_-]{22}$/;
// Nonce purposes are the request names, so a sign-in for one action cannot be spent on another.
export const PURPOSES = ['provision', 'take-write-seat', 'revoke', 'lost', 'read-key-rotate', 'restore-run', 'restore-undo'];

export class ApiError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra; }
}
const fail = (status, code, extra) => { throw new ApiError(status, code, extra); };

// Sliding-window counters in memory (a restart forgets them; the per-customer key
// cap lives in SQLite and the workers keep their own caps on disk).
export function rateLimiter(now = () => Date.now()) {
  const hits = new Map();
  return {
    take(key, max, windowMs) {
      const t = now(), list = (hits.get(key) || []).filter((x) => t - x < windowMs);
      if (list.length >= max) { hits.set(key, list); return false; }
      list.push(t); hits.set(key, list);
      if (hits.size > 50000) for (const [k, v] of hits) if (!v.length || t - v.at(-1) > DAY) hits.delete(k);
      return true;
    },
  };
}

const deviceName = (v) => {
  if (typeof v !== 'string') fail(400, 'BAD_INPUT');
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 64);
  if (!s) fail(400, 'BAD_INPUT');
  return s;
};
const deviceView = (d, me) => ({ id: d.id, name: d.name, role: d.role, state: d.state, createdAt: d.created_at, lastSeenAt: d.last_seen_at, current: d.id === me });

export function createApi({ store, verifyGoogle, keys, files, mailer, config, now = () => Date.now(), log = () => {}, sleep = (ms) => new Promise((ok) => setTimeout(ok, ms)) }) {
  const limiter = rateLimiter(now);
  const cfg = { minAppVersion: '0.7.0', trustedProxies: [], restoreGraceMs: 60000, ...config };
  if (!cfg.endpoint || !cfg.bucket) throw new Error('CONFIG_MISSING:repository');
  const repository = (customer) => ({ endpoint: cfg.endpoint, bucket: cfg.bucket, prefix: `${customer.prefix}r` });
  const running = new Map();
  const locks = new Set();
  const plans = new Map();

  // One key-changing request per customer at a time — in this process (the Set) and
  // across processes (a lease row in the database, which admin.mjs also takes).
  async function serial(customerId, fn) {
    if (locks.has(customerId)) fail(409, 'BUSY');
    locks.add(customerId);
    const holder = crypto.randomBytes(12).toString('base64url');
    try {
      if (!store.takeLock(customerId, holder, LOCK_MS)) fail(409, 'BUSY');
      try { return await fn(); } finally { store.releaseLock(customerId, holder); }
    } finally { locks.delete(customerId); }
  }
  // Inside the line: the device and customer as they are now, not as they were before a
  // slow sign-in check — another request may have cut or moved the device meanwhile.
  function current(device, states) {
    const d = store.device(device.id);
    if (!d || !states.includes(d.state)) fail(403, 'DEVICE_STATE', { state: d?.state || 'gone' });
    const c = store.customerById(d.customer_id);
    if (!c || c.state !== 'active') fail(403, 'DEVICE_STATE', { state: 'customer' });
    return { device: d, customer: c };
  }

  // ── proofs
  function bearer(req, states) {
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    const device = m ? store.deviceByToken(m[1]) : null;
    if (!device) fail(401, 'DEVICE');
    if (!states.includes(device.state)) fail(403, 'DEVICE_STATE', { state: device.state });
    const customer = store.customerById(device.customer_id);
    if (!customer || customer.state !== 'active') fail(403, 'DEVICE_STATE', { state: 'customer' });
    store.touchDevice(device.id);
    return { device, customer };
  }
  const hasBearer = (req) => /^Bearer \S+$/.test(req.headers.authorization || '');
  async function google(body, purpose) {
    const g = body?.google;
    if (!g || typeof g.idToken !== 'string' || typeof g.nonce !== 'string') fail(400, 'BAD_INPUT');
    let claims;
    try { claims = await verifyGoogle(g.idToken); } catch { fail(401, 'TOKEN'); }
    // Claimed in one statement after the signature check, before anything else happens.
    if (claims.nonce !== g.nonce || !store.consumeNonce(g.nonce, purpose)) fail(401, 'NONCE');
    return claims;
  }
  async function freshFor(customer, body, purpose) {
    const claims = await google(body, purpose);
    if (claims.sub !== customer.sub) fail(403, 'SUB_MISMATCH');
    return claims;
  }

  // ── keys
  async function makeKey(kind, customer, deviceId, purpose) {
    const name = store.keyIntent({ kind, customerId: customer.id, deviceId, purpose });
    let made;
    try { made = await keys('keys.create', { kind, prefix: customer.prefix, name }); }
    catch (e) {
      log({ task: 'keys.create', code: e.code });
      // The intent row stays 'creating' and is swept (by name) if B2 did make it.
      throw new ApiError(e.code === 'LIMIT_WORKER_DAY' ? 429 : 503, e.code === 'LIMIT_WORKER_DAY' ? 'LIMIT_KEYS_DAY' : 'SERVER');
    }
    store.keyCreated(name, made);
    return { name, keyId: made.keyId, applicationKey: made.applicationKey };
  }
  async function dropKey(row, reason) {
    store.keyDeleting(row.name);
    if (row.key_id) await keys('keys.delete', { keyId: row.key_id });
    else await keys('keys.deleteByName', { name: row.name });
    store.keyDeleted(row.name, reason);
  }
  async function dropAll(rows, reason) {
    try { for (const r of rows) await dropKey(r, reason); }
    catch (e) { log({ task: 'keys.delete', code: e.code }); fail(503, 'SERVER'); }
  }
  const keyOut = (k) => ({ keyId: k.keyId, applicationKey: k.applicationKey });
  // The daily cap counts requests that make keys; incident responses are not counted.
  function checkBudget(customer) {
    if (store.keyRequestsSince(customer.id, now() - DAY) >= LIMITS.keyRequestsPerDay) fail(429, 'LIMIT_KEYS_DAY');
  }
  const readKeys = (customer) => store.liveKeys(customer.id, 'read');
  function readKeyState(customer) {
    const live = readKeys(customer);
    if (live.some((k) => k.state === 'active')) return live.some((k) => k.state === 'pending' || k.state === 'acked') ? 'unconfirmed' : 'ready';
    return live.some((k) => k.state === 'pending' || k.state === 'acked') ? 'unconfirmed' : 'missing';
  }
  // 「확정 하나 + 미확정 하나」: a new read key retires the earlier unconfirmed ones.
  function retireUnconfirmed(customer) {
    for (const k of readKeys(customer)) if (['creating', 'pending', 'acked'].includes(k.state)) store.setKeyState(k.name, 'retired');
  }
  function needsReadKey(customer) {
    const live = readKeys(customer);
    if (live.some((k) => k.state === 'active')) return false;
    return !live.some((k) => (k.state === 'pending' || k.state === 'acked') && k.created_at > now() - ACK_MS);
  }
  function notifyCustomer(customer, kind, detail, unique) {
    store.addAlert({ customerId: customer.id, kind, audience: 'customer', detail });
    mailer?.toCustomer(customer, kind, detail, unique);
  }
  // 옮겨 오기(4.6): the snapshot a reading PC is copying, kept by the writer's prune.
  // Ignored after MOVE_PIN_MS or once the pinning device is no longer an active reader.
  function movePin(customer) {
    let pin; try { pin = JSON.parse(customer.move_pin || 'null'); } catch { return null; }
    if (!pin || !(pin.since > now() - MOVE_PIN_MS)) return null;
    const by = store.device(pin.by);
    if (!by || by.customer_id !== customer.id || by.state !== 'active' || by.role !== 'read') return null;
    return { by: { id: by.id, name: by.name }, snapshotId: pin.snapshotId, since: pin.since, until: pin.since + MOVE_PIN_MS };
  }
  // A restore that is preparing, running, or finished and waiting for its choice.
  function restoreBusy(customer) { if (store.openJob(customer.id)) fail(409, 'BUSY'); }
  // Old write keys first; if deleting fails nothing moves. Then the seat, then the
  // new key — a stop after any step is continued by calling the same request again.
  async function moveSeat(customer, device, reason, { keep = () => false } = {}) {
    const before = store.writerOf(customer.id);
    const old = store.liveKeys(customer.id, 'write').filter((k) => !keep(k));
    await dropAll(old, reason);
    store.tx(() => {
      if (before && before.id !== device.id) store.setDevice(before.id, { role: 'read', state: 'moved', moved_to: device.id });
      store.setDevice(device.id, { role: 'write', state: 'active', moved_to: null });
      // The move this pin served is over once the seat moves.
      store.setCustomer(customer.id, { move_pin: null });
    });
    return { previous: before && before.id !== device.id ? before : null, dropped: old.length };
  }
  // A just-deleted B2 key still works for a few seconds (11-13): a new write key is used
  // only after that, so two PCs never write at once. The app waits until usableAt. The
  // moment comes from the keys table, so a retry after a stop still waits.
  const usableAt = (customer) => Math.max(now(), store.lastWriteKeyDeleted(customer.id) + cfg.restoreGraceMs);
  const waitOf = (customer) => { const at = usableAt(customer); return { usableAt: at, waitMs: at - now() }; };

  // ── restore jobs (run in the background; resumable because the tool re-plans)
  // A job left 'preparing' by a restart: every write key except the ones this restore
  // made for its requester goes before the restore runs (with the grace wait).
  async function finishPreparing(job) {
    await serial(job.customer_id, async () => {
      const fresh = store.job(job.id);
      if (!fresh || fresh.state !== 'preparing') return;
      const customer = store.customerById(job.customer_id);
      const requester = store.device(job.device_id);
      // The requester was cut (lost, revoked, moved) while the job waited: no seat for it —
      // the old write keys still go, and the restore does not run.
      if (!requester || requester.state !== 'active') {
        await dropAll(store.liveKeys(customer.id, 'write'), 'restore');
        store.setJob(job.id, { state: 'failed', finished_at: now(), error: 'DEVICE' });
        return;
      }
      await moveSeat(customer, requester, 'restore', { keep: (k) => k.device_id === job.device_id && k.purpose === 'restore' && k.created_at >= job.created_at });
      store.setJob(job.id, { state: 'running' });
    });
    const after = store.job(job.id);
    return after.state === 'running' ? runJob(after) : null;
  }
  async function runJob(job, { resume = false } = {}) {
    if (job.state === 'preparing') return null;
    if (running.has(job.id)) return running.get(job.id);
    const p = (async () => {
      const customer = store.customerById(job.customer_id);
      try {
        // A just-deleted B2 key still works for a few seconds (11-13): wait before planning.
        if (!resume && !job.undo_of && cfg.restoreGraceMs) await sleep(cfg.restoreGraceMs);
        if (!job.started_at) store.setJob(job.id, { started_at: now() });
        const r = await files('restore.apply', { prefix: customer.prefix, at: job.at, resume }, { timeout: 3600000 });
        const prior = (() => { try { return JSON.parse(store.job(job.id).journal || '[]'); } catch { return []; } })();
        const fresh = store.job(job.id);
        store.setJob(job.id, { state: job.undo_of ? 'continued' : 'done', finished_at: now(), pre_at: fresh.pre_at ?? r.preAt, rounds: r.rounds,
          counts: JSON.stringify({ ...r.counts, remaining: r.remaining }), journal: JSON.stringify([...prior, ...r.journal]) });
        if (job.undo_of) store.setCustomer(customer.id, { detect_since: now() });
        else notifyCustomer(customer, 'restore-done', { at: now(), to: job.at, jobId: job.id }, job.id);
      } catch (e) {
        store.setJob(job.id, { state: 'failed', finished_at: now(), error: String(e.code || 'FAILED').slice(0, 40) });
        mailer?.toOperator('job-failed', { customerId: customer.id, jobId: job.id, code: e.code || 'FAILED' }, job.id);
        log({ task: 'restore', code: e.code || 'FAILED' });
      } finally { running.delete(job.id); }
    })();
    running.set(job.id, p);
    return p;
  }

  // ── routes. The proof and device-state columns of the design's table are the
  // `bearer(req, states)` and `google/freshFor(…, purpose)` calls at the top of each.
  const routes = {
    'POST /v1/nonce': async (req, body) => {
      if (!limiter.take(`nonce:${req.ip}`, 30, 600000)) fail(429, 'RATE');
      if (!PURPOSES.includes(body?.purpose)) fail(400, 'BAD_INPUT');
      return store.createNonce(body.purpose);
    },

    'POST /v1/provision': async (req, body) => {
      if (!limiter.take(`provision:${req.ip}`, 10, 3600000)) fail(429, 'RATE');
      const name = deviceName(body?.device?.name);
      const appVersion = body?.device?.appVersion;
      if (appVersion !== undefined && !VERSION.test(appVersion)) fail(400, 'BAD_INPUT');
      const installId = body?.device?.installId;
      if (installId !== undefined && !INSTALL_ID.test(installId)) fail(400, 'BAD_INPUT');
      const claims = await google(body, 'provision');
      let customer = store.customerBySub(claims.sub);
      if (!customer) {
        if (store.customerByEmail(claims.email)) fail(403, 'SUB_MISMATCH');
        try { customer = store.tx(() => store.createCustomer(claims)); }
        catch (e) {
          if (e.code === 'NOT_INVITED') fail(403, 'NOT_INVITED');
          if (/UNIQUE/.test(e.message || '')) fail(409, 'BUSY');
          throw e;
        }
      }
      if (customer.state !== 'active') fail(403, 'DEVICE_STATE', { state: 'customer' });
      return serial(customer.id, async () => {
        restoreBusy(customer);
        customer = store.customerById(customer.id);
        // The same PC signing up again after a lost answer (Fable 설계 관문 A): its earlier
        // device never acknowledged a key, so it is dropped with its keys and frees the seat.
        if (installId) {
          for (const ghost of store.devicesOf(customer.id).filter((d) => d.state === 'active' && d.install_id === installId && store.deviceNeverAcked(d.id))) {
            await dropAll([...store.liveKeys(customer.id, 'write'), ...readKeys(customer)].filter((k) => k.device_id === ghost.id), 'replaced');
            store.setDevice(ghost.id, { state: 'abandoned', role: 'read' });
          }
        }
        const active = store.devicesOf(customer.id).filter((d) => d.state === 'active');
        const writer = store.writerOf(customer.id);
        const role = writer ? 'read' : 'write';
        if (active.length >= LIMITS.writers + LIMITS.readers || (role === 'read' && active.filter((d) => d.role === 'read').length >= LIMITS.readers)) {
          fail(409, 'LIMIT_DEVICES', { devices: store.devicesOf(customer.id).filter((d) => d.state !== 'abandoned').map((d) => deviceView(d, null)) });
        }
        const giveRead = needsReadKey(customer);
        const makes = role === 'write' || giveRead;
        // After a loss the first read key is an incident response, not counted.
        if (makes && !(customer.google_step && giveRead && role === 'read')) checkBudget(customer);
        const { device, token } = store.createDevice({ customerId: customer.id, name, role, appVersion, installId: installId || null });
        const out = { customer: { id: customer.id, repository: repository(customer) }, device: { id: device.id, token, role }, keys: {}, ackBy: now() + ACK_MS,
          writer: writer ? { id: writer.id, name: writer.name } : null, lost: customer.google_step ? { googleStepRequired: true } : null };
        try {
          if (role === 'write') out.keys.write = keyOut(await makeKey('write', customer, device.id, 'provision'));
          if (giveRead) { retireUnconfirmed(customer); out.keys.read = keyOut(await makeKey('read', customer, device.id, 'provision')); }
        } catch (e) {
          for (const k of [...store.liveKeys(customer.id, 'write'), ...readKeys(customer)].filter((k) => k.device_id === device.id && k.state !== 'retired')) { try { await dropKey(k, 'provision-failed'); } catch {} }
          store.setDevice(device.id, { state: 'abandoned', role: 'read' });
          throw e;
        }
        if (makes) store.addKeyRequest(customer.id, 'provision');
        Object.assign(out, waitOf(customer));
        if (store.devicesOf(customer.id).length > 1) notifyCustomer(customer, 'new-device', { at: now(), name: device.name, deviceId: device.id }, device.id);
        return out;
      });
    },

    'POST /v1/keys/ack': async (req, body) => {
      const { device, customer } = bearer(req, ['active']);
      if (!Array.isArray(body?.keyIds)) fail(400, 'BAD_INPUT');
      const ids = body.keyIds.filter((x) => typeof x === 'string').slice(0, 4);
      return serial(customer.id, async () => { current(device, ['active']); return { acked: ids.filter((id) => store.ackKey(device.id, id)) }; });
    },

    'GET /v1/status': async (req) => {
      const { device, customer } = bearer(req, ['active', 'moved']);
      const writer = store.writerOf(customer.id);
      const usage = store.lastUsage(customer.id);
      const job = store.lastJob(customer.id);
      const restore = job && ['preparing', 'running', 'done'].includes(job.state) ? { jobId: job.id, state: job.state, awaitingChoice: job.state === 'done', at: job.at, byThisDevice: job.device_id === device.id } : null;
      const moved = device.state === 'moved' ? store.device(device.moved_to) : null;
      return {
        customer: { id: customer.id, overQuota: !!usage && usage.visible_bytes > LIMITS.quotaBytes * LIMITS.overFactor, usage: usage ? { day: usage.day, visibleBytes: usage.visible_bytes, hiddenBytes: usage.hidden_bytes } : null },
        device: { id: device.id, role: device.role, state: device.state, movedTo: moved ? { id: moved.id, name: moved.name } : null },
        writer: writer ? { id: writer.id, name: writer.name } : null,
        alerts: store.alertsFor(customer.id, now() - 7 * DAY).map((a) => ({ id: a.id, kind: a.kind, at: a.created_at, detail: a.detail ? JSON.parse(a.detail) : null })),
        restore, lost: customer.google_step ? { googleStepRequired: true } : null, readKey: readKeyState(customer), minAppVersion: cfg.minAppVersion,
        move: (() => { const pin = movePin(customer); return pin ? { ...pin, byThisDevice: pin.by.id === device.id } : null; })(),
      };
    },

    // 옮겨 오기(4.6 · 옮겨 오기 검토 M8): the new (reading) PC names the snapshot it copies;
    // the writing PC reads it from status and keeps that snapshot out of its prune.
    // One pin per customer; pinning again replaces it. Device token only — a pin can only
    // make the writer keep one more snapshot for at most MOVE_PIN_MS.
    'POST /v1/move/pin': async (req, body) => {
      const { device, customer } = bearer(req, ['active']);
      if (typeof body?.snapshotId !== 'string' || !SNAPSHOT_ID.test(body.snapshotId)) fail(400, 'BAD_INPUT');
      if (device.role !== 'read') fail(409, 'DEVICE_STATE', { state: 'writer' });
      return serial(customer.id, async () => {
        const fresh = current(device, ['active']).device;
        if (fresh.role !== 'read') fail(409, 'DEVICE_STATE', { state: 'writer' });
        store.setCustomer(customer.id, { move_pin: JSON.stringify({ by: device.id, snapshotId: body.snapshotId, since: now() }) });
        return { move: movePin(store.customerById(customer.id)) };
      });
    },
    'POST /v1/move/unpin': async (req) => {
      const { device, customer } = bearer(req, ['active', 'moved']);
      return serial(customer.id, async () => {
        const pin = movePin(store.customerById(customer.id));
        const mine = !!pin && pin.by.id === device.id;
        if (mine) store.setCustomer(customer.id, { move_pin: null });
        return { unpinned: mine };
      });
    },

    'GET /v1/devices': async (req) => {
      const { device, customer } = bearer(req, ['active']);
      return { devices: store.devicesOf(customer.id).filter((d) => d.state !== 'abandoned').map((d) => deviceView(d, device.id)) };
    },

    // Also 「쓰기 출입증 다시 받기」 when this device already holds the seat.
    'POST /v1/devices/take-write-seat': async (req, body) => {
      const first = bearer(req, ['active', 'moved']);
      await freshFor(first.customer, body, 'take-write-seat');
      return serial(first.customer.id, async () => {
        const { device, customer } = current(first.device, ['active', 'moved']);
        restoreBusy(customer);
        checkBudget(customer);
        const { previous } = await moveSeat(customer, device, 'seat-moved');
        const k = await makeKey('write', customer, device.id, 'seat');
        store.addKeyRequest(customer.id, 'seat');
        if (previous) notifyCustomer(customer, 'seat-moved', { at: now(), name: device.name, deviceId: device.id, fromId: previous.id }, `${device.id}:${now()}`);
        return { keys: { write: keyOut(k) }, ackBy: now() + ACK_MS, ...waitOf(customer), previous: previous ? { id: previous.id, name: previous.name } : null };
      });
    },

    // Device + sign-in, or sign-in alone for a device that is not the writer (a dead PC
    // filling the device limit — the new PC has no token yet).
    'POST /v1/devices/revoke': async (req, body) => {
      let customer, requester = null;
      if (hasBearer(req)) { ({ customer, device: requester } = bearer(req, ['active'])); await freshFor(customer, body, 'revoke'); }
      else { const claims = await google(body, 'revoke'); customer = store.customerBySub(claims.sub) || fail(404, 'NOT_FOUND'); }
      const target = typeof body?.deviceId === 'string' && ID12.test(body.deviceId) ? store.device(body.deviceId) : null;
      if (!target || target.customer_id !== customer.id) fail(404, 'NOT_FOUND');
      if (!hasBearer(req) && target.role === 'write' && target.state === 'active') fail(403, 'DEVICE_STATE', { state: 'writer' });
      return serial(customer.id, async () => {
        if (requester) current(requester, ['active']);
        const tgt = store.device(target.id);
        if (!hasBearer(req) && tgt.role === 'write' && tgt.state === 'active') fail(403, 'DEVICE_STATE', { state: 'writer' });
        await dropAll(store.liveKeys(customer.id, 'write').filter((k) => k.device_id === target.id), 'revoked');
        if (tgt.state !== 'lost') store.setDevice(target.id, { state: 'revoked', role: 'read' });
        // A read-only PC still holds the envelope's read key and password.
        return { ok: true, suggestReadKeyRotation: tgt.state !== 'abandoned' };
      });
    },

    'POST /v1/lost': async (req, body) => {
      const claims = await google(body, 'lost');
      const customer = store.customerBySub(claims.sub);
      if (!customer) fail(404, 'NOT_FOUND');
      const target = typeof body?.deviceId === 'string' && ID12.test(body.deviceId) ? store.device(body.deviceId) : null;
      if (!target || target.customer_id !== customer.id) fail(404, 'NOT_FOUND');
      return serial(customer.id, async () => {
        await dropAll([...store.liveKeys(customer.id, 'write').filter((k) => k.device_id === target.id), ...readKeys(customer)], 'lost');
        store.tx(() => {
          store.setDevice(target.id, { state: 'lost', role: 'read' });
          store.setCustomer(customer.id, { read_key: null, lost_at: now(), google_step: 1 });
        });
        notifyCustomer(customer, 'lost-reported', { at: now(), name: target.name, deviceId: target.id }, target.id);
        return { next: 'read-key-rotate', googleRemovalUrl: 'https://myaccount.google.com/connections' };
      });
    },

    'POST /v1/read-key/rotate': async (req, body) => {
      const first = bearer(req, ['active']);
      await freshFor(first.customer, body, 'read-key-rotate');
      return serial(first.customer.id, async () => {
        const { device, customer } = current(first.device, ['active']);
        restoreBusy(customer);
        const incident = !!customer.google_step && !readKeys(customer).some((k) => k.state === 'active');
        if (!incident) checkBudget(customer);
        retireUnconfirmed(customer);
        const k = await makeKey('read', customer, device.id, 'rotate');
        if (!incident) store.addKeyRequest(customer.id, 'rotate');
        return { keys: { read: keyOut(k) }, ackBy: now() + ACK_MS, googleStepRequired: !!customer.google_step };
      });
    },

    // The app has published the new envelope and read it back: this key becomes the
    // customer read key, the earlier confirmed one is retired (jobs delete it).
    'POST /v1/read-key/confirm': async (req, body) => {
      const { device, customer } = bearer(req, ['active']);
      const row = typeof body?.keyId === 'string' ? store.keyById(body.keyId) : null;
      if (!row || row.kind !== 'read' || row.customer_id !== customer.id || row.device_id !== device.id || !['acked', 'active'].includes(row.state)) fail(404, 'NOT_FOUND');
      return serial(customer.id, async () => {
        current(device, ['active']);
        const fresh = store.key(row.name);
        if (!fresh || !['acked', 'active'].includes(fresh.state)) fail(404, 'NOT_FOUND');
        store.tx(() => {
          for (const other of readKeys(customer)) if (other.name !== row.name && other.state === 'active') store.setKeyState(other.name, 'retired');
          store.setKeyState(row.name, 'active');
          store.setCustomer(customer.id, { read_key: row.name, google_step: 0 });
        });
        return { ok: true };
      });
    },

    'POST /v1/restore/plan': async (req, body) => {
      const { customer } = bearer(req, ['active']);
      const t = now(), oldestAt = t - LIMITS.maxRestoreAgeMs;
      const at = body?.at;
      if (at !== undefined && at !== null && (!Number.isSafeInteger(at) || at < oldestAt || at > t)) fail(400, 'TOO_OLD');
      // The listing is cached five minutes per customer and planned at most 20 times a day:
      // the customer account's free tier caps list calls for every customer together.
      let cached = plans.get(customer.id);
      if (!cached || t - cached.at > 300000) {
        if (!limiter.take(`plan:${customer.id}`, LIMITS.plansPerDay, DAY)) fail(429, 'RATE');
        const summary = await files('prefix.scan', { prefix: customer.prefix, since: t - DAY }, { timeout: 600000 });
        cached = { at: t, suggestions: suggest(summary, { baseline: customer.detect_since || 0, now: t }), plans: new Map() };
        plans.set(customer.id, cached);
      }
      const pick = at ?? cached.suggestions[0]?.at ?? null;
      let plan = null;
      if (pick !== null) {
        plan = cached.plans.get(pick);
        if (!plan) {
          if (!limiter.take(`plan:${customer.id}`, LIMITS.plansPerDay, DAY)) fail(429, 'RATE');
          plan = await files('restore.plan', { prefix: customer.prefix, at: pick }, { timeout: 600000 }); cached.plans.set(pick, plan);
        }
      }
      return { suggestions: cached.suggestions, plan, oldestAt };
    },

    // 2.5: every write key is replaced (only the requester gets a new one, and the
    // requester takes the seat), a new read key starts while the old one stays until
    // the new envelope is confirmed, then the tool runs in the background.
    'POST /v1/restore/run': async (req, body) => {
      let { device, customer } = bearer(req, ['active']);
      await freshFor(customer, body, 'restore-run');
      const t = now(), at = body?.at;
      if (!Number.isSafeInteger(at) || at > t) fail(400, 'BAD_INPUT');
      if (t - at > LIMITS.maxRestoreAgeMs) fail(400, 'TOO_OLD');
      return serial(customer.id, async () => {
        ({ device } = current(device, ['active']));
        restoreBusy(customer);
        const job = store.createJob({ customerId: customer.id, deviceId: device.id, at, state: 'preparing' });
        notifyCustomer(customer, 'restore-requested', { at: t, to: at, deviceId: device.id, jobId: job.id }, job.id);
        let write, read;
        try {
          await moveSeat(customer, device, 'restore');
          write = await makeKey('write', customer, device.id, 'restore');
          retireUnconfirmed(customer);
          read = await makeKey('read', customer, device.id, 'restore');
        } catch (e) { store.setJob(job.id, { state: 'failed', finished_at: now(), error: String(e.code || 'KEYS') }); throw e; }
        // Every old write key is gone: only now may the restore run (or resume after a restart).
        store.setJob(job.id, { state: 'running' });
        void runJob(store.job(job.id));
        plans.delete(customer.id);
        return { jobId: job.id, keys: { write: keyOut(write), read: keyOut(read) }, ackBy: now() + ACK_MS, ...waitOf(customer) };
      });
    },

    'GET /v1/restore/job': async (req, _body, url) => {
      const { customer } = bearer(req, ['active', 'moved']);
      const id = url.searchParams.get('id');
      const job = id && ID16.test(id) ? store.job(id) : null;
      if (!job || job.customer_id !== customer.id) fail(404, 'NOT_FOUND');
      return { id: job.id, state: job.state, at: job.at, startedAt: job.started_at, preAt: job.pre_at, finishedAt: job.finished_at, counts: job.counts ? JSON.parse(job.counts) : null, error: job.error, awaitingChoice: job.state === 'done', undoOf: job.undo_of };
    },

    'POST /v1/restore/choose': async (req, body) => {
      const { device, customer } = bearer(req, ['active']);
      const job = typeof body?.jobId === 'string' && ID16.test(body.jobId) ? store.job(body.jobId) : null;
      if (!job || job.customer_id !== customer.id || job.state !== 'done') fail(404, 'NOT_FOUND');
      if (job.device_id !== device.id) fail(403, 'DEVICE_STATE', { state: 'not-requester' });
      // Only the latest restore, still waiting for its choice, as it is now.
      const latest = () => { current(device, ['active']); const open = store.openJob(customer.id); if (!open || open.id !== job.id || open.state !== 'done') fail(404, 'NOT_FOUND'); };
      if (body.choice === 'continue') {
        return serial(customer.id, async () => {
          latest();
          store.tx(() => { store.setJob(job.id, { state: 'continued', choice_at: now() }); store.setCustomer(customer.id, { detect_since: now() }); });
          return { state: 'continued' };
        });
      }
      if (body.choice !== 'undo') fail(400, 'BAD_INPUT');
      await freshFor(customer, body, 'restore-undo');
      const back = job.pre_at ?? (job.started_at ? job.started_at - 1 : null);
      if (!back || now() - back > LIMITS.maxRestoreAgeMs) fail(400, 'TOO_OLD');
      return serial(customer.id, async () => {
        latest();
        const undo = store.tx(() => {
          store.setJob(job.id, { state: 'undone', choice_at: now() });
          return store.createJob({ customerId: customer.id, deviceId: device.id, at: back, undoOf: job.id });
        });
        void runJob(undo);
        plans.delete(customer.id);
        return { state: 'undone', jobId: undo.id };
      });
    },

    'POST /v1/telemetry': async (req, body) => {
      const { device, customer } = bearer(req, ['active']);
      if (!limiter.take(`telemetry:${device.id}`, 120, 3600000)) fail(429, 'RATE');
      const batch = cleanBatch(body, { now: now() });
      let runs = 0;
      store.tx(() => {
        if (Object.keys(batch.env).length) store.setEnv(device.id, batch.env);
        for (const r of batch.runs) runs += store.addRun(device.id, customer.id, r);
        for (const n of batch.notifications) store.addNotification(device.id, n);
        for (const i of batch.installs) store.addInstall(device.id, i);
      });
      return { accepted: { runs: batch.runs.length, notifications: batch.notifications.length, installs: batch.installs.length }, stored: { runs }, dropped: batch.dropped };
    },

    'POST /v1/help': async (req, body) => {
      const { device, customer } = bearer(req, ['active', 'moved']);
      if (!limiter.take(`help:${device.id}`, 5, DAY)) fail(429, 'RATE');
      const text = typeof body?.text === 'string' ? body.text.slice(0, 2000) : fail(400, 'BAD_INPUT');
      const bundle = cleanBundle(body?.bundle, { now: now() });
      const ticket = store.addHelp(device.id, text, bundle);
      mailer?.toOperator('help', { customerId: customer.id, deviceId: device.id, ticket, text }, ticket);
      return { ticket };
    },
  };

  async function handle(req, res) {
    const started = now();
    const send = (status, value) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(JSON.stringify(value));
    };
    let route = '?';
    try {
      const remote = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      req.ip = cfg.trustedProxies.includes(remote) && forwarded ? forwarded : remote;
      const url = new URL(req.url, 'http://local');
      const pathName = url.pathname.replace(/^\/backup-api(?=\/)/, '');
      route = `${req.method} ${pathName}`;
      if (route === 'GET /v1/health') return send(200, { ok: true });
      const fn = Object.hasOwn(routes, route) ? routes[route] : null;
      if (!fn) fail(404, 'NOT_FOUND');
      if (!limiter.take(`ip:${req.ip}`, 600, 3600000)) fail(429, 'RATE');
      let body = null;
      if (req.method === 'POST') {
        const max = pathName === '/v1/telemetry' ? 1 << 20 : 65536;
        const text = await new Promise((ok, bad) => {
          const chunks = []; let size = 0;
          req.on('data', (c) => { size += c.length; if (size > max) { bad(new ApiError(413, 'BAD_INPUT')); req.destroy(); } else chunks.push(c); });
          req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
          req.on('error', () => bad(new ApiError(400, 'BAD_INPUT')));
        });
        if (!/^application\/json/.test(req.headers['content-type'] || '')) fail(415, 'BAD_INPUT');
        try { body = text ? JSON.parse(text) : {}; } catch { fail(400, 'BAD_INPUT'); }
      }
      const result = await fn(req, body, url);
      send(200, { ok: true, ...result });
      log({ route, status: 200, ms: now() - started });
    } catch (e) {
      const known = e instanceof ApiError;
      const status = known ? e.status : e instanceof RpcError ? 503 : 500;
      const code = known ? e.code : 'SERVER';
      send(status, { ok: false, code, ...(known && e.extra ? e.extra : {}) });
      log({ route, status, code, ...(known ? {} : { error: e?.name || 'Error' }) });
    }
  }

  return { handle, runJob, finishPreparing, routes, makeKey, dropKey, serial, repository, server: () => http.createServer((req, res) => { void handle(req, res); }) };
}
