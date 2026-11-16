// Timed work of the api service. A one-minute tick: heartbeat, expiry of keys
// nobody acknowledged (two-step issue), deletion of retired keys, mail outbox.
// Once a day (first tick after 03:00 KST): per-customer usage and change
// detection, the key and bucket reconcile, unconfirmed read keys, the outside
// audit's freshness, three-day silence mail, pruning, a database copy. Every step
// catches its own failure so one bad customer or one worker outage does not stop
// the rest, and key changes go through the api's per-customer line (BUSY = later).
import path from 'node:path';
import { dayOf } from './store.mjs';
import { judge } from './detect.mjs';
import { reconcile } from './reconcile.mjs';
import { LIMITS } from './server.mjs';

const DAY = 86400000, HOUR = 3600000, KST = 9 * HOUR;
const GROWTH_ALERT = 200 * 1024 ** 3;

export function createJobs({ store, api, keys, files, mailer, config = {}, now = () => Date.now(), log = () => {}, fetchImpl = fetch }) {
  const cfg = { protectedKeyIds: [], backupDir: null, dailyHourKst: 3, auditRunsUrl: null, ...config };
  const step = async (task, fn) => { try { return await fn(); } catch (e) { if (e?.code !== 'BUSY') log({ task, code: e?.code || e?.name || 'Error' }); return null; } };
  const operator = (kind, detail, unique) => { store.addAlert({ kind, audience: 'operator', detail }); mailer?.toOperator(kind === 'reconcile' ? 'reconcile' : 'worker-failed', kind === 'reconcile' ? { problems: detail } : { task: kind, code: JSON.stringify(detail).slice(0, 200) }, unique); };

  async function expireKeys() {
    for (const row of store.overdueKeys()) {
      await step('expire', () => api.serial(row.customer_id, async () => {
        const fresh = store.key(row.name);
        if (!fresh || !['pending', 'creating', 'deleting'].includes(fresh.state)) return;
        await api.dropKey(fresh, fresh.state === 'deleting' ? 'retry' : 'not-acknowledged');
        const device = fresh.device_id ? store.device(fresh.device_id) : null;
        // Only a sign-up whose own keys all went unacknowledged is abandoned — not a reading
        // device whose later write key (seat move) expired.
        if (device && device.state === 'active' && fresh.purpose === 'provision') {
          const live = [...store.liveKeys(device.customer_id, 'write'), ...store.liveKeys(device.customer_id, 'read')].filter((k) => k.device_id === device.id);
          const acked = store.get('select count(*) n from keys where device_id = ? and acked_at is not null', device.id).n;
          if (!live.length && !acked && now() - device.created_at < HOUR) store.setDevice(device.id, { state: 'abandoned', role: 'read' });
        }
      }));
    }
    for (const row of store.retiredKeys()) await step('retire', () => api.serial(row.customer_id, () => api.dropKey(row, 'superseded')));
  }

  async function scanCustomer(customer, t) {
    const prev = store.lastUsage(customer.id);
    const since = prev ? Math.max(prev.scanned_at - HOUR, t - 2 * DAY) : t - 2 * DAY;
    const summary = await files('prefix.scan', { prefix: customer.prefix, since }, { timeout: 1800000 });
    const verdict = judge(summary, { baseline: customer.detect_since || 0, reported: store.reportedSince(customer.id, since), previousSnapshots: prev ? prev.visible_snapshots : null, seen: (id) => store.seen(customer.id, id), now: t });
    store.putUsage(customer.id, dayOf(t), summary.usage, { alerts: verdict.alerts, deferred: verdict.deferred, events: summary.eventCount ?? summary.events.length, window: summary.window });
    for (const e of verdict.fresh) store.markSeen(customer.id, e.fileId, e.kind, e.at);
    for (const a of verdict.alerts) {
      const row = store.addAlert({ customerId: customer.id, kind: 'repo-changed', audience: 'customer', detail: { daysLeft: a.daysLeft, reason: a.reason } });
      if (row) {
        mailer?.toCustomer(customer, 'repo-changed', { daysLeft: a.daysLeft }, `${dayOf(t)}:${a.reason}`);
        mailer?.toOperator('repo-changed', { customerId: customer.id, detail: a }, `${customer.id}:${dayOf(t)}:${a.reason}`);
      }
    }
    // No run record arrived for the window: the measured rule waits (up to the app's 7-day queue); operator only.
    if (verdict.deferred.includes('no-telemetry') && store.writerOf(customer.id)) store.addAlert({ customerId: customer.id, kind: 'no-telemetry', audience: 'operator' });
    const over = LIMITS.quotaBytes * LIMITS.overFactor;
    if (summary.usage.visibleBytes > over && (!prev || prev.visible_bytes <= over)) {
      store.addAlert({ customerId: customer.id, kind: 'over-quota', audience: 'customer' });
      mailer?.toCustomer(customer, 'over-quota', {}, dayOf(t));
    }
    const before = store.usageBefore(customer.id, dayOf(t));
    const grew = before ? summary.usage.visibleBytes + summary.usage.hiddenBytes - before.visible_bytes - before.hidden_bytes : 0;
    if (grew > GROWTH_ALERT) mailer?.toOperator('growth', { customerId: customer.id, grewBytes: grew }, `${customer.id}:${dayOf(t)}`);
  }

  async function reconcileKeys(t) {
    const listedFrom = now();
    const [{ keys: list }, bucket] = await Promise.all([keys('keys.list'), keys('bucket.settings')]);
    const table = store.allLiveKeys().map((r) => ({ ...r, prefix: store.customerById(r.customer_id)?.prefix }));
    const deletedKeyIds = store.all("select key_id from keys where state = 'deleted' and key_id is not null").map((r) => r.key_id);
    const result = reconcile({ keys: list, bucket, bucketId: cfg.bucketId, protectedKeyIds: cfg.protectedKeyIds, table, deletedKeyIds });
    for (const name of result.orphanNames) await step('orphan', async () => { await keys('keys.deleteByName', { name }); store.keyDeleted(name, 'orphan'); });
    for (const keyId of result.undeleted) await step('undeleted', () => keys('keys.delete', { keyId }));
    // A key made while the listing ran is not in it and is not missing.
    for (const row of store.all("select * from keys where state in ('active','acked') and key_id is not null and created_at < ?", listedFrom)) {
      if (!list.some((k) => k.keyId === row.key_id)) store.keyDeleted(row.name, 'missing');
    }
    if (!result.ok) operator('reconcile', result.problems, dayOf(t));
    return result;
  }

  // An unconfirmed read key older than a week: the new envelope never made it.
  function unconfirmed(t) {
    for (const r of store.all("select * from keys where kind = 'read' and state = 'acked' and acked_at < ?", t - 7 * DAY)) {
      store.addAlert({ customerId: r.customer_id, kind: 'read-key-unconfirmed', audience: 'operator' });
    }
  }

  // The outside audit must have succeeded in the last 36 hours (GitHub public API). A
  // run counts only when its audit job ran and succeeded — a run whose job was skipped
  // (the repository variable turned off) is not an audit.
  async function auditFresh(t) {
    if (!cfg.auditRunsUrl) return;
    const get = async (url) => { const res = await fetchImpl(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'synk-workbackup' }, signal: AbortSignal.timeout(20000) }); return res.ok ? res.json() : null; };
    const runs = ((await get(cfg.auditRunsUrl))?.workflow_runs || []).filter((r) => r.conclusion === 'success').slice(0, 3);
    let last = null;
    for (const r of runs) {
      if (typeof r.jobs_url !== 'string' || !r.jobs_url.startsWith('https://api.github.com/')) continue;
      const jobs = (await get(r.jobs_url))?.jobs || [];
      if (jobs.some((j) => j.name === 'audit' && j.conclusion === 'success')) { last = r; break; }
    }
    if (!last || t - Date.parse(last.updated_at) > 36 * HOUR) operator('audit-stale', { lastSuccess: last ? last.updated_at : null }, dayOf(t));
  }

  // 「사흘 넘게 소식이 없음」 — only for the writing device, never for a moved one, and
  // not while the server is down now or stopped in the last two hours.
  function silence(t) {
    const gap = store.lastGap();
    if (gap && gap.end > t - 2 * HOUR) return;
    for (const d of store.all("select * from devices where state = 'active' and role = 'write' and last_seen_at < ?", t - 3 * DAY)) {
      const customer = store.customerById(d.customer_id);
      if (!customer) continue;
      const key = mailer?.toCustomer(customer, 'silent', { name: d.name, lastSeen: d.last_seen_at }, `${d.id}:${d.last_seen_at}`);
      if (key) store.addAlert({ customerId: customer.id, kind: 'silent', audience: 'customer', detail: { deviceId: d.id } });
    }
  }

  async function daily(t) {
    for (const c of store.all("select * from customers where state = 'active'")) await step('scan', () => scanCustomer(c, t));
    await step('reconcile', () => reconcileKeys(t));
    await step('unconfirmed', () => unconfirmed(t));
    await step('audit', () => auditFresh(t));
    await step('silence', () => silence(t));
    await step('prune', () => { store.pruneTelemetry(); store.pruneNonces(); });
    if (cfg.backupDir) await step('backup', () => store.backupTo(path.join(cfg.backupDir, `workbackup-${dayOf(t)}.sqlite`)));
  }

  // A restore left 'preparing' (the worker was down at start, or a stop mid-request):
  // finish replacing its write keys, then it runs. A request still inside the line
  // answers BUSY and is left alone.
  const preparing = (t) => { for (const job of store.all("select * from restore_jobs where state = 'preparing' and created_at < ?", t - 2 * 60000)) void step('restore-prepare', () => api.finishPreparing(job)); };

  let ticking = false, dailyRun = null;
  // The one-minute work (heartbeat, key expiry within the ten-minute ack window, mail)
  // never waits for the daily pass, which can take long with many customers.
  async function tick() {
    if (ticking) return null;
    ticking = true;
    let started = null;
    try {
      const t = now();
      store.beat();
      await step('expire', expireKeys);
      await step('mail', () => mailer?.flush());
      preparing(t);
      const kst = new Date(t + KST), day = kst.toISOString().slice(0, 10);
      const done = store.get("select v from meta where k = 'daily'")?.v;
      if (!dailyRun && kst.getUTCHours() >= cfg.dailyHourKst && done !== day) {
        store.run("insert into meta(k, v) values ('daily', ?) on conflict(k) do update set v = excluded.v", day);
        started = dailyRun = daily(t).finally(() => { dailyRun = null; });
      }
      // Only the call that started the daily pass waits for it (tests and the first start).
      return started;
    } finally { ticking = false; }
  }

  async function resume() {
    for (const job of store.jobsToResume()) {
      if (job.state === 'preparing') void step('restore-prepare', () => api.finishPreparing(job));
      else void api.runJob(job, { resume: !!job.started_at });
    }
  }

  let timer = null;
  return {
    tick, daily, scanCustomer, reconcileKeys, silence, expireKeys, unconfirmed, auditFresh, resume,
    start() { void resume(); timer = setInterval(() => void tick(), 60000); timer.unref?.(); void tick(); },
    stop() { clearInterval(timer); },
  };
}
