// SQLite store of the provisioning server (STAGE1_DESIGN.md 5.3 and 「개통 서버 구현 설계」).
// One file on the api service's own volume. It never holds a B2 application key
// secret, a Google token or a device token — only the SHA-256 of device tokens.
// It does hold customer mail addresses, so its dumps are operator-only material.
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const NONCE_MS = 10 * 60000;
export const ACK_MS = 10 * 60000;
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function randomId(length) {
  let out = '';
  while (out.length < length) for (const b of crypto.randomBytes(length * 2)) { if (b < 252 && out.length < length) out += ALPHA[b % 36]; }
  return out;
}
export const tokenHash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
export const normEmail = (email) => String(email || '').trim().toLowerCase();
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

const SCHEMA = `
create table if not exists meta(k text primary key, v text not null);
create table if not exists customers(
  id text primary key, sub text not null unique, email text not null unique, prefix text not null unique,
  state text not null default 'active', created_at integer not null,
  lost_at integer, google_step integer not null default 0, read_key text, detect_since integer, move_pin text,
  detect_cursor integer);
create table if not exists invites(email text primary key, added_at integer not null, used_at integer, customer_id text);
create table if not exists nonces(value text primary key, purpose text not null, created_at integer not null, used_at integer);
create table if not exists devices(
  id text primary key, customer_id text not null references customers(id), name text not null,
  role text not null check (role in ('write','read')),
  state text not null check (state in ('active','moved','revoked','lost','abandoned')),
  created_at integer not null, last_seen_at integer, token_hash text not null unique, app_version text, moved_to text, install_id text, first_seen_at integer);
create unique index if not exists one_writer on devices(customer_id) where role = 'write' and state = 'active';
create table if not exists keys(
  name text primary key, key_id text unique, kind text not null check (kind in ('write','read')),
  customer_id text not null, device_id text, purpose text not null default 'provision',
  state text not null check (state in ('creating','pending','acked','active','retired','deleting','deleted')),
  created_at integer not null, acked_at integer, deleted_at integer, reason text, capabilities text);
create index if not exists keys_customer on keys(customer_id, state);
create table if not exists key_requests(id integer primary key, customer_id text not null, kind text not null, at integer not null);
create table if not exists runs(id integer primary key, device_id text not null, customer_id text not null, received_at integer not null, started_at integer not null, trigger text not null, data text not null, unique (device_id, started_at, trigger));
create index if not exists runs_device on runs(device_id, received_at);
create table if not exists notifications(id integer primary key, device_id text not null, received_at integer not null, kind text not null, shown_at integer, clicked_at integer);
create table if not exists installs(id integer primary key, device_id text not null, received_at integer not null, step text not null, duration_ms integer, ok integer);
create table if not exists device_env(device_id text primary key, received_at integer not null, app_version text, windows text, standby text);
create table if not exists usage_daily(
  customer_id text not null, day text not null, visible_bytes integer not null, visible_count integer not null,
  hidden_bytes integer not null, hidden_count integer not null, visible_snapshots integer not null default 0, detect text, scanned_at integer not null,
  primary key (customer_id, day));
create table if not exists detect_seen(customer_id text not null, file_id text not null, kind text not null, at integer not null, primary key (customer_id, file_id));
create table if not exists restore_jobs(
  id text primary key, customer_id text not null, device_id text not null, at integer not null,
  state text not null check (state in ('preparing','running','done','failed','continued','undone')),
  created_at integer not null, started_at integer, pre_at integer, rounds integer, finished_at integer, undo_of text,
  counts text, journal text, error text, choice_at integer);
create table if not exists alerts(
  id integer primary key, customer_id text, kind text not null, audience text not null check (audience in ('customer','operator')),
  day text not null, created_at integer not null, detail text, mail_key text, unique (customer_id, kind, audience, day));
create table if not exists outbox(
  key text primary key, to_addr text not null, subject text not null, body text not null, created_at integer not null,
  state text not null check (state in ('held','pending','sent','failed','unknown')), attempts integer not null default 0, last_at integer);
create table if not exists heartbeat(id integer primary key check (id = 1), last_at integer not null, gap_start integer, gap_end integer);
create table if not exists help(id text primary key, device_id text not null, created_at integer not null, text text not null, bundle text not null);
-- The per-customer line across processes: the api and an operator command (admin.mjs,
-- a separate process in the same container) take the same lease.
create table if not exists locks(customer_id text primary key, holder text not null, until integer not null);
`;

export class Store {
  constructor(file, { now = () => Date.now() } = {}) {
    this.db = new DatabaseSync(file);
    this.now = now;
    this.db.exec('pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000;');
    this.db.exec(SCHEMA);
    this.migrate();
    this.q = new Map();
  }
  // A database made by an earlier version of this file: add the later columns and widen
  // the restore states, in one transaction, before anything reads them.
  migrate() {
    const cols = (t) => this.db.prepare(`pragma table_info(${t})`).all().map((c) => c.name);
    this.db.exec('begin immediate');
    try {
      if (!cols('customers').includes('move_pin')) this.db.exec('alter table customers add column move_pin text');
      if (!cols('devices').includes('install_id')) this.db.exec('alter table devices add column install_id text');
      // Devices from before this column did speak (or are treated so): only a new device whose
      // sign-up answer never arrived stays without it.
      if (!cols('devices').includes('first_seen_at')) this.db.exec('alter table devices add column first_seen_at integer; update devices set first_seen_at = coalesce(last_seen_at, created_at)');
      if (!cols('customers').includes('detect_cursor')) this.db.exec('alter table customers add column detect_cursor integer');
      const sql = this.db.prepare("select sql from sqlite_master where type = 'table' and name = 'restore_jobs'").get()?.sql || '';
      if (!sql.includes("'preparing'")) {
        this.db.exec(`alter table restore_jobs rename to restore_jobs_old;
${SCHEMA.match(/create table if not exists restore_jobs\([^;]*\);/)[0]}
insert into restore_jobs select * from restore_jobs_old;
drop table restore_jobs_old;`);
      }
      this.db.exec('commit');
    } catch (e) { try { this.db.exec('rollback'); } catch {} throw e; }
  }
  close() { this.db.close(); }
  p(sql) { let s = this.q.get(sql); if (!s) { s = this.db.prepare(sql); this.q.set(sql, s); } return s; }
  get(sql, ...a) { return this.p(sql).get(...a); }
  all(sql, ...a) { return this.p(sql).all(...a); }
  run(sql, ...a) { return this.p(sql).run(...a); }
  // A lease, not a lock that outlives a crash: an expired holder loses it.
  takeLock(customerId, holder, ttlMs) {
    const t = this.now();
    return this.run('insert into locks(customer_id, holder, until) values (?, ?, ?) on conflict(customer_id) do update set holder = excluded.holder, until = excluded.until where locks.until < ?',
      customerId, holder, t + ttlMs, t).changes === 1;
  }
  releaseLock(customerId, holder) { this.run('delete from locks where customer_id = ? and holder = ?', customerId, holder); }
  tx(fn) {
    this.db.exec('begin immediate');
    try { const r = fn(); this.db.exec('commit'); return r; }
    catch (e) { try { this.db.exec('rollback'); } catch {} throw e; }
  }

  // ── invites
  addInvite(email) {
    const e = normEmail(email);
    if (e.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('BAD_EMAIL');
    this.run('insert into invites(email, added_at) values (?, ?) on conflict(email) do nothing', e, this.now());
    return e;
  }
  removeInvite(email) { return this.run('delete from invites where email = ? and used_at is null', normEmail(email)).changes > 0; }
  listInvites() { return this.all('select email, added_at, used_at from invites order by added_at'); }

  // ── nonces: single use, purpose-bound, ten minutes.
  createNonce(purpose) {
    const value = crypto.randomBytes(32).toString('base64url');
    this.run('insert into nonces(value, purpose, created_at) values (?, ?, ?)', value, purpose, this.now());
    return { nonce: value, expiresAt: this.now() + NONCE_MS };
  }
  consumeNonce(value, purpose) {
    if (typeof value !== 'string' || value.length > 128) return false;
    return this.run('update nonces set used_at = ? where value = ? and purpose = ? and used_at is null and created_at > ?',
      this.now(), value, purpose, this.now() - NONCE_MS).changes === 1;
  }
  pruneNonces() { return this.run('delete from nonces where created_at < ?', this.now() - 86400000).changes; }

  // ── customers
  customerBySub(sub) { return this.get('select * from customers where sub = ?', sub); }
  customerById(id) { return this.get('select * from customers where id = ?', id); }
  customerByEmail(email) { return this.get('select * from customers where email = ?', normEmail(email)); }
  // First sign-in of an invited address binds the Google subject for good.
  createCustomer({ sub, email }) {
    const e = normEmail(email);
    const invite = this.get('select * from invites where email = ?', e);
    if (!invite || invite.used_at) throw Object.assign(new Error('NOT_INVITED'), { code: 'NOT_INVITED' });
    const id = randomId(16);
    this.run('insert into customers(id, sub, email, prefix, created_at) values (?, ?, ?, ?, ?)', id, sub, e, `c/${id}/`, this.now());
    this.run('update invites set used_at = ?, customer_id = ? where email = ?', this.now(), id, e);
    return this.customerById(id);
  }
  setCustomer(id, fields) { this.update('customers', 'id', id, fields); }

  // ── devices
  createDevice({ customerId, name, role, appVersion, installId = null }) {
    const id = randomId(12), token = 'wbd_' + crypto.randomBytes(32).toString('base64url');
    this.run('insert into devices(id, customer_id, name, role, state, created_at, last_seen_at, token_hash, app_version, install_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, customerId, name, role, 'active', this.now(), this.now(), tokenHash(token), appVersion || null, installId);
    return { device: this.device(id), token };
  }
  // A device that never acknowledged any key it was given.
  deviceNeverAcked(id) { return !this.get('select 1 from keys where device_id = ? and acked_at is not null', id); }
  device(id) { return this.get('select * from devices where id = ?', id); }
  deviceByToken(token) {
    if (typeof token !== 'string' || !/^wbd_[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return this.get('select * from devices where token_hash = ?', tokenHash(token)) || null;
  }
  devicesOf(customerId) { return this.all('select * from devices where customer_id = ? order by created_at', customerId); }
  writerOf(customerId) { return this.get("select * from devices where customer_id = ? and role = 'write' and state = 'active'", customerId) || null; }
  activeDeviceCount(customerId) { return this.get("select count(*) n from devices where customer_id = ? and state = 'active'", customerId).n; }
  setDevice(id, fields) { this.update('devices', 'id', id, fields); }
  touchDevice(id) { const t = this.now(); this.run('update devices set last_seen_at = ?, first_seen_at = coalesce(first_seen_at, ?) where id = ?', t, t, id); }
  // The customers with a finished restore waiting for its choice (the minute tick settles them).
  waitingRestores() { return this.all("select distinct customer_id from restore_jobs where state = 'done'").map((r) => r.customer_id); }

  // ── keys. A row is written before B2 is asked, so a key made by B2 whose answer
  // was lost still has a row ('creating') that the daily reconcile can match by name.
  keyIntent({ kind, customerId, deviceId, purpose = 'provision' }) {
    const name = `${kind === 'write' ? 'wbw' : 'wbr'}-${randomId(20)}`;
    this.run('insert into keys(name, kind, customer_id, device_id, purpose, state, created_at) values (?, ?, ?, ?, ?, ?, ?)', name, kind, customerId, deviceId || null, purpose, 'creating', this.now());
    return name;
  }
  keyCreated(name, { keyId, capabilities }) {
    // created_at becomes the moment B2 answered: the ack window starts there, and the daily
    // reconcile counts a key as missing only if it existed before the listing began.
    // 0 when the row is no longer 'creating' (given up meanwhile): the caller deletes the key.
    return this.run("update keys set key_id = ?, capabilities = ?, state = 'pending', created_at = ? where name = ? and state = 'creating'", keyId, JSON.stringify(capabilities || []), this.now(), name).changes;
  }
  key(name) { return this.get('select * from keys where name = ?', name); }
  keyById(keyId) { return this.get('select * from keys where key_id = ?', keyId); }
  liveKeys(customerId, kind) {
    return this.all("select * from keys where customer_id = ? and kind = ? and state != 'deleted' order by created_at", customerId, kind);
  }
  // The daily cap counts key-making requests, not keys (design 「여러 걸음 요청과 하루 상한」).
  // An incident response (the first key request after a loss) is recorded as 'incident' and
  // is not counted in the day's cap.
  keyRequestsSince(customerId, since) { return this.get("select count(*) n from key_requests where customer_id = ? and at > ? and kind != 'incident'", customerId, since).n; }
  incidentSince(customerId, since) { return !!this.get("select 1 from key_requests where customer_id = ? and kind = 'incident' and at >= ?", customerId, since); }
  restoresSince(customerId, since) { return this.get("select count(*) n from restore_jobs where customer_id = ? and undo_of is null and created_at > ? and (state != 'failed' or started_at is not null)", customerId, since).n; }
  addKeyRequest(customerId, kind) { this.run('insert into key_requests(customer_id, kind, at) values (?, ?, ?)', customerId, kind, this.now()); }
  keyDeleting(name) { this.run("update keys set state = 'deleting' where name = ? and state != 'deleted'", name); }
  keyDeleted(name, reason) { this.run("update keys set state = 'deleted', deleted_at = ?, reason = ? where name = ?", this.now(), reason, name); }
  setKeyState(name, state) { this.run('update keys set state = ? where name = ?', state, name); }
  // Repeating an acknowledgement whose answer was lost is still true for the same device.
  ackKey(deviceId, keyId) {
    if (this.run("update keys set state = case when kind = 'write' then 'active' else 'acked' end, acked_at = ? where key_id = ? and device_id = ? and state = 'pending'",
      this.now(), keyId, deviceId).changes === 1) return true;
    return !!this.get("select 1 from keys where key_id = ? and device_id = ? and acked_at is not null and state in ('acked','active')", keyId, deviceId);
  }
  // Unacknowledged keys older than the ack window, and intents whose B2 answer never came.
  overdueKeys() { return this.all("select * from keys where ((state = 'pending' or state = 'creating') and created_at < ?) or state = 'deleting'", this.now() - ACK_MS); }
  allLiveKeys() { return this.all("select * from keys where state != 'deleted'"); }
  retiredKeys() { return this.all("select * from keys where state = 'retired'"); }

  // ── telemetry
  // The same (device, start, trigger) is kept once, so a resent batch is not counted twice.
  addRun(deviceId, customerId, run) { return this.run('insert or ignore into runs(device_id, customer_id, received_at, started_at, trigger, data) values (?, ?, ?, ?, ?, ?)', deviceId, customerId, this.now(), run.startedAt, run.trigger || 'unknown', JSON.stringify(run)).changes; }
  addNotification(deviceId, n) { this.run('insert into notifications(device_id, received_at, kind, shown_at, clicked_at) values (?, ?, ?, ?, ?)', deviceId, this.now(), n.kind, n.shownAt ?? null, n.clickedAt ?? null); }
  addInstall(deviceId, i) { this.run('insert into installs(device_id, received_at, step, duration_ms, ok) values (?, ?, ?, ?, ?)', deviceId, this.now(), i.step, i.durationMs ?? null, i.ok ? 1 : 0); }
  setEnv(deviceId, env) {
    this.run('insert into device_env(device_id, received_at, app_version, windows, standby) values (?, ?, ?, ?, ?) on conflict(device_id) do update set received_at = excluded.received_at, app_version = excluded.app_version, windows = excluded.windows, standby = excluded.standby',
      deviceId, this.now(), env.appVersion ?? null, env.windows ?? null, env.standby ?? null);
  }
  // What the customer's devices reported for a window: null when no run record arrived at all.
  // By the time the server received it (a run's record comes after its prune; a run of hours
  // is covered and a device cannot move it — Fable 5.2 설계 관문 둘째).
  // `to`: the window's end, so a record received after it explains the next window's hides,
  // not this one's (GPT r7 GB2).
  reportedSince(customerId, since, to = Number.MAX_SAFE_INTEGER) {
    const rows = this.all('select data from runs where customer_id = ? and received_at > ? and received_at <= ?', customerId, since, to);
    if (!rows.length) return null;
    let pruned = 0, massConfirmed = false;
    for (const r of rows) { try { const d = JSON.parse(r.data); pruned += Number(d.prunedSnapshots) || 0; massConfirmed ||= d.massChangeConfirmed === true; } catch {} }
    return { runs: rows.length, pruned, massConfirmed };
  }
  pruneTelemetry() {
    const cut = this.now() - 90 * 86400000;
    return ['runs', 'notifications', 'installs'].reduce((n, t) => n + this.run(`delete from ${t} where received_at < ?`, cut).changes, 0);
  }

  // ── usage and detection
  putUsage(customerId, day, u, detect) {
    this.run(`insert into usage_daily(customer_id, day, visible_bytes, visible_count, hidden_bytes, hidden_count, visible_snapshots, detect, scanned_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(customer_id, day) do update set visible_bytes = excluded.visible_bytes, visible_count = excluded.visible_count, hidden_bytes = excluded.hidden_bytes, hidden_count = excluded.hidden_count, visible_snapshots = excluded.visible_snapshots, detect = excluded.detect, scanned_at = excluded.scanned_at`,
      customerId, day, u.visibleBytes, u.visibleCount, u.hiddenBytes, u.hiddenCount, u.visibleSnapshots || 0, detect ? JSON.stringify(detect) : null, this.now());
  }
  lastUsage(customerId) { return this.get('select * from usage_daily where customer_id = ? order by day desc limit 1', customerId) || null; }
  usageBefore(customerId, day) { return this.get('select * from usage_daily where customer_id = ? and day < ? order by day desc limit 1', customerId, day) || null; }
  seen(customerId, fileId) { return !!this.get('select 1 from detect_seen where customer_id = ? and file_id = ?', customerId, fileId); }
  markSeen(customerId, fileId, kind, at) { this.run('insert or ignore into detect_seen(customer_id, file_id, kind, at) values (?, ?, ?, ?)', customerId, fileId, kind, at); }

  // ── restore jobs
  // A restore starts 'preparing' (write keys being replaced) and becomes 'running' only
  // once every old write key is gone; a restart resumes the replacement first.
  createJob({ customerId, deviceId, at, undoOf = null, state = 'running' }) {
    const id = randomId(16);
    this.run('insert into restore_jobs(id, customer_id, device_id, at, state, created_at, undo_of) values (?, ?, ?, ?, ?, ?, ?)', id, customerId, deviceId, at, state, this.now(), undoOf);
    return this.job(id);
  }
  job(id) { return this.get('select * from restore_jobs where id = ?', id) || null; }
  runningJob(customerId) { return this.get("select * from restore_jobs where customer_id = ? and state in ('preparing','running')", customerId) || null; }
  // Started, or finished and waiting for the customer's choice: no other restore meanwhile.
  // Only the latest job can be open — an older 'done' one behind a later restore is history.
  openJob(customerId) { const j = this.lastJob(customerId); return j && ['preparing', 'running', 'done'].includes(j.state) ? j : null; }
  // A key whose B2 answer never reached us (key_id null) was never handed to anyone: deleting it
  // starts no wait.
  lastWriteKeyDeleted(customerId) { return this.get("select max(deleted_at) t from keys where customer_id = ? and kind = 'write' and deleted_at is not null and key_id is not null", customerId)?.t || 0; }
  // A failed undo is not the latest job: the restore it tried to undo waits for its choice again.
  lastJob(customerId) { return this.get("select * from restore_jobs where customer_id = ? and not (undo_of is not null and state = 'failed') order by created_at desc, rowid desc limit 1", customerId) || null; }
  jobsToResume() { return this.all("select * from restore_jobs where state in ('preparing','running')"); }
  setJob(id, fields) { this.update('restore_jobs', 'id', id, fields); }
  journalOf(customerId) {
    const copies = new Set(), hides = new Set();
    for (const j of this.all('select journal from restore_jobs where customer_id = ? and journal is not null', customerId)) {
      try { for (const e of JSON.parse(j.journal)) { if (e.type === 'copy' && e.newFileId) copies.add(e.newFileId); if (e.type === 'hide' && e.hideMarkerId) hides.add(e.hideMarkerId); } } catch {}
    }
    return { copies: [...copies], hides: [...hides] };
  }

  // ── alerts and mail outbox
  addAlert({ customerId = null, kind, audience, detail = null }) {
    const r = this.run('insert or ignore into alerts(customer_id, kind, audience, day, created_at, detail) values (?, ?, ?, ?, ?, ?)',
      customerId, kind, audience, dayOf(this.now()), this.now(), detail ? JSON.stringify(detail) : null);
    return r.changes === 1 ? this.get('select * from alerts where id = ?', Number(r.lastInsertRowid)) : null;
  }
  alertsFor(customerId, since) { return this.all("select * from alerts where customer_id = ? and audience = 'customer' and created_at > ? order by created_at", customerId, since); }
  setAlertMail(id, key) { this.run('update alerts set mail_key = ? where id = ?', key, id); }
  queueMail({ key, to, subject, body, held }) {
    this.run('insert or ignore into outbox(key, to_addr, subject, body, created_at, state) values (?, ?, ?, ?, ?, ?)', key, to, subject, body, this.now(), held ? 'held' : 'pending');
  }
  pendingMail(limit = 5) { return this.all("select * from outbox where state = 'pending' order by created_at limit ?", limit); }
  setMail(key, fields) { this.update('outbox', 'key', key, fields); }

  // ── heartbeat: the longest recent stop decides whether a three-day mail is fair.
  beat() {
    const t = this.now(), row = this.get('select * from heartbeat where id = 1');
    if (!row) return this.run('insert into heartbeat(id, last_at) values (1, ?)', t);
    if (t - row.last_at > 10 * 60000) {
      // A short stop does not replace a longer one still inside the three-day window (카본 r6 C8).
      const keep = row.gap_end && row.gap_end > t - 3 * 86400000 && row.gap_end - row.gap_start > t - row.last_at;
      return keep ? this.run('update heartbeat set last_at = ? where id = 1', t) : this.run('update heartbeat set last_at = ?, gap_start = ?, gap_end = ? where id = 1', t, row.last_at, t);
    }
    this.run('update heartbeat set last_at = ? where id = 1', t);
  }
  lastGap() { const r = this.get('select gap_start, gap_end from heartbeat where id = 1'); return r?.gap_end ? { start: r.gap_start, end: r.gap_end } : null; }

  addHelp(deviceId, text, bundle) {
    const id = randomId(12);
    this.run('insert into help(id, device_id, created_at, text, bundle) values (?, ?, ?, ?, ?)', id, deviceId, this.now(), text, JSON.stringify(bundle));
    return id;
  }

  backupTo(file) { this.db.exec(`vacuum into '${String(file).replace(/'/g, "''")}'`); }

  update(table, keyCol, keyVal, fields) {
    const cols = Object.keys(fields);
    if (!cols.length) return;
    for (const c of cols) if (!/^[a-z_]+$/.test(c)) throw new Error('BAD_COLUMN');
    this.run(`update ${table} set ${cols.map((c) => `${c} = ?`).join(', ')} where ${keyCol} = ?`, ...cols.map((c) => fields[c] ?? null), keyVal);
  }
}
