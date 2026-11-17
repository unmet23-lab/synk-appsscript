// Timed work of the api service. A one-minute tick: heartbeat, expiry of keys
// nobody acknowledged (two-step issue), deletion of retired keys, mail outbox.
// Once a day (first tick after 03:00 KST): per-customer usage and change
// detection, the key and bucket reconcile, unconfirmed read keys, the outside
// audit's freshness, three-day silence mail, pruning, a database copy. Every step
// catches its own failure so one bad customer or one worker outage does not stop
// the rest, and key changes go through the api's per-customer line (BUSY = later).
import fs from 'node:fs';
import path from 'node:path';
import { dayOf, ACK_MS } from './store.mjs';
import { judge } from './detect.mjs';
import { reconcile } from './reconcile.mjs';
import { LIMITS } from './server.mjs';

const DAY = 86400000, HOUR = 3600000, KST = 9 * HOUR;
const GROWTH_ALERT = 200 * 1024 ** 3;
// The daily database copies are kept 30 days: a record the server drops (after 90 days, or on a deletion
// request) leaves the copies within 30 days (synk.im 처리방침 「SYNK 업무 백업」, privacy-map.json).
const BACKUP_KEEP_DAYS = 30;

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
          if (!live.length && !acked) { store.setDevice(device.id, { state: 'abandoned', role: 'read' }); api.settleNow?.(device.customer_id); }
        }
      }));
    }
    for (const row of store.retiredKeys()) await step('retire', () => api.serial(row.customer_id, () => api.dropKey(row, 'superseded')));
  }

  // The window is (since, to]. It starts where the last finished judgment ended
  // (`detect_cursor`), never before the last restore (`detect_since`), at most the restore
  // window back; it ends five minutes before this scan began (`to`: what happens while the
  // listings run, and a little clock difference with B2, belong to the next window). The
  // cursor moves to `to` only when the judgment finished; a judgment waiting for measurements
  // keeps it, and after seven days of waiting it is made with none (a stolen key used while
  // the PC stays off). Fable 5.2 설계 관문 둘(11-16).
  async function scanCustomer(c, t) {
    const customer = store.customerById(c.id); // the daily pass read its row hours ago
    if (!customer || customer.state !== 'active') return;
    const prev = store.lastUsage(customer.id);
    const baseline = customer.detect_since || 0;
    const cursor = Number.isSafeInteger(customer.detect_cursor) ? customer.detect_cursor : null;
    // Events have no window (each is judged once, `seen`). Measurements are those received
    // since the window began.
    const to = t - 5 * 60000;
    const since = Math.min(to, Math.max(cursor === null ? t - 2 * DAY : cursor, Math.min(baseline, t), t - LIMITS.maxRestoreAgeMs));
    const summary = await files('prefix.scan', { prefix: customer.prefix, since, to, from: baseline }, { timeout: 1800000 });
    // A restore chosen while the worker scanned: this judgment was of the old baseline.
    if ((store.customerById(customer.id)?.detect_since || 0) !== baseline) { log({ task: 'scan', code: 'BASELINE_MOVED' }); return; }
    let reported = store.reportedSince(customer.id, since, to);
    if (reported === null && cursor !== null && cursor < t - 7 * DAY) reported = { runs: 0, pruned: 0, massConfirmed: false };
    // The snapshots counted at the last scan stand for 「there were some」 only when that scan came
    // after the last restore: a restore to a time with none is not 「모두 사라짐」 (카본 끝판2 C2).
    const previousSnapshots = prev && prev.scanned_at > baseline ? prev.visible_snapshots : null;
    const verdict = judge(summary, { baseline, reported, previousSnapshots, seen: (id) => store.seen(customer.id, id), now: t });
    const finished = !verdict.deferred.length;
    // A hide surge mails once per window (while the cursor stays, the same window is judged
    // again each day); a content change once per its first new event.
    const windowKey = cursor ?? since;
    const mailKey = (a) => (a.reason === 'content' ? `content:${verdict.fresh[0]?.fileId}` : `${windowKey}:${a.reason}`);
    store.tx(() => {
      store.putUsage(customer.id, dayOf(t), summary.usage, { alerts: verdict.alerts, deferred: verdict.deferred, events: summary.eventCount ?? summary.events.length, window: summary.window });
      for (const e of verdict.fresh) store.markSeen(customer.id, e.fileId, e.kind, e.at);
      for (const [id, kind, at] of summary.between || []) store.markSeen(customer.id, id, kind, at);
      for (const a of verdict.alerts) {
        const row = store.addAlert({ customerId: customer.id, kind: 'repo-changed', audience: 'customer', detail: { daysLeft: a.daysLeft, reason: a.reason } });
        if (row) {
          mailer?.toCustomer(customer, 'repo-changed', { daysLeft: a.daysLeft }, mailKey(a));
          mailer?.toOperator('repo-changed', { customerId: customer.id, detail: a }, `${customer.id}:${mailKey(a)}`);
        }
      }
      if (finished) store.setCustomer(customer.id, { detect_cursor: to });
      else if (cursor === null) store.setCustomer(customer.id, { detect_cursor: since });
    });
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

  // The daily key and bucket comparison (Fable 5.2 설계 관문, 11-16). It does not change the
  // table from one listing: keys a listing caught mid-issue or mid-delete would be wrongly
  // marked. Its only repair is deleting again keys whose row was deleted before the listing
  // began (ids are never reused; a name without an id is a key whose B2 answer came after its
  // row was given up). 'creating' rows are the minute tick's (expiry). A live row the listing
  // did not show is checked again inside its customer's line with a fresh listing — no issue
  // or delete of that customer runs there — and only then marked missing, so the customer
  // gets a new key where one is needed (needsReadKey).
  async function reconcileKeys(t) {
    const listedFrom = now();
    const [{ keys: list }, bucket] = await Promise.all([keys('keys.list'), keys('bucket.settings')]);
    const table = store.allLiveKeys().map((r) => ({ ...r, prefix: store.customerById(r.customer_id)?.prefix }));
    const gone = store.all("select key_id, name from keys where state = 'deleted' and deleted_at < ?", listedFrom);
    const settling = store.all("select key_id, name from keys where state = 'deleted' and deleted_at >= ?", listedFrom);
    const result = reconcile({ keys: list, bucket, bucketId: cfg.bucketId, protectedKeyIds: cfg.protectedKeyIds, table,
      settlingKeyIds: settling.filter((r) => r.key_id).map((r) => r.key_id), settlingNames: settling.map((r) => r.name),
      deletedKeyIds: gone.filter((r) => r.key_id).map((r) => r.key_id), deletedNames: gone.filter((r) => !r.key_id).map((r) => r.name) });
    for (const keyId of result.undeleted) await step('undeleted', () => keys('keys.delete', { keyId }));
    for (const name of result.undeletedNames) await step('undeleted', () => keys('keys.deleteByName', { name }));
    const byCustomer = new Map();
    for (const name of result.suspects) { const r = store.key(name); if (r && r.created_at < listedFrom - ACK_MS) byCustomer.set(r.customer_id, [...(byCustomer.get(r.customer_id) || []), name]); }
    let missing = 0; const unchecked = [];
    for (const [customerId, names] of byCustomer) {
      const looked = await step('missing', () => api.serial(customerId, async () => {
        const { keys: again } = await keys('keys.list');
        for (const name of names) {
          const r = store.key(name);
          if (!r || !['active', 'acked'].includes(r.state) || r.created_at >= now() - ACK_MS || again.some((k) => k.keyId === r.key_id)) continue;
          store.keyDeleted(name, 'missing'); missing++;
        }
        return true;
      }));
      if (!looked) unchecked.push(customerId);
    }
    // A key that seemed missing but could not be looked at again (the line busy, the listing
    // failed) is a problem too: the operator hears of it instead of a pass (카본 r7 B4).
    const problems = [...result.problems, ...(missing ? [{ kind: 'missing-key', count: missing }] : []),
      ...(unchecked.length ? [{ kind: 'missing-unchecked', customers: unchecked.length }] : [])];
    if (problems.length) operator('reconcile', problems, dayOf(t));
    return { ...result, ok: problems.length === 0, problems };
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
      if (!customer || customer.state !== 'active') continue;
      // One notice per silence: the mail already queued for it means it was told (the mailer's
      // queue answers its key either way, and the alert would come back every day — 카본 끝판2 C4).
      const unique = `${d.id}:${d.last_seen_at}`;
      if (store.all('select 1 from outbox where key = ?', `wb:silent:${customer.id}:${unique}`).length) continue;
      const key = mailer?.toCustomer(customer, 'silent', { name: d.name, lastSeen: d.last_seen_at }, unique);
      if (key) store.addAlert({ customerId: customer.id, kind: 'silent', audience: 'customer', detail: { deviceId: d.id } });
    }
  }

  // A daily task that fails is an operator alert (once a day per task), not only a log line.
  const task = async (name, fn) => {
    try { return await fn(); }
    catch (e) { if (e?.code === 'BUSY') return null; log({ task: name, code: e?.code || e?.name || 'Error' }); operator(name, { code: e?.code || e?.name || 'Error' }, `${name}:${dayOf(t0)}`); return null; }
  };
  // Only this service's own day copies are removed; any other file in the folder is left alone.
  function pruneBackups(t) {
    const cut = dayOf(t - BACKUP_KEEP_DAYS * DAY);
    for (const name of fs.readdirSync(cfg.backupDir)) {
      const m = /^workbackup-(\d{4}-\d{2}-\d{2})\.sqlite$/.exec(name);
      if (m && m[1] < cut) fs.rmSync(path.join(cfg.backupDir, name), { force: true });
    }
  }

  let t0 = 0;
  async function daily(t) {
    t0 = t;
    for (const c of store.all("select * from customers where state = 'active'")) await task('scan', () => scanCustomer(c, t));
    await task('reconcile', () => reconcileKeys(t));
    await task('unconfirmed', () => unconfirmed(t));
    await task('audit', () => auditFresh(t));
    await task('silence', () => silence(t));
    await task('prune', () => { store.pruneTelemetry(); store.pruneNonces(); });
    if (cfg.backupDir) {
      await task('backup', () => store.backupTo(path.join(cfg.backupDir, `workbackup-${dayOf(t)}.sqlite`)));
      await task('backup-prune', () => pruneBackups(t));
    }
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
      // A finished restore nobody can choose for any more is kept, within a minute, whichever
      // path forgot to check (Fable 5.2 설계 관문 셋째 3). The first tick runs at start.
      for (const customerId of store.waitingRestores()) await step('settle', () => api.settleRestore?.(customerId));
      preparing(t);
      const kst = new Date(t + KST), day = kst.toISOString().slice(0, 10);
      const done = store.get("select v from meta where k = 'daily'")?.v;
      if (!dailyRun && kst.getUTCHours() >= cfg.dailyHourKst && done !== day) {
        // Recorded when the pass ends, so a stop half-way runs it again that day.
        started = dailyRun = daily(t).then(() => { store.run("insert into meta(k, v) values ('daily', ?) on conflict(k) do update set v = excluded.v", day); }).finally(() => { dailyRun = null; });
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
    // A database error in a tick (SQLITE_BUSY while admin.mjs writes, say) is logged; it must
    // not end the api process as an unhandled rejection (카본 r6 B5).
    start() {
      const safe = (task, fn) => { try { Promise.resolve(fn()).catch((e) => log({ task, code: e?.code || e?.name || 'Error' })); } catch (e) { log({ task, code: e?.code || e?.name || 'Error' }); } };
      safe('resume', resume); timer = setInterval(() => safe('tick', tick), 60000); timer.unref?.(); safe('tick', tick);
    },
    stop() { clearInterval(timer); },
  };
}
