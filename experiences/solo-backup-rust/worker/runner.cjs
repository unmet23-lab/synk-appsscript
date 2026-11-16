'use strict';
// Scheduled-run mode of the worker (STAGE1_DESIGN.md 4.2). The Rust run executable
// (WorkBackupRun.exe) starts the worker with SWB_MODE=run: only the profile engines
// are opened — no timers, no dialogs, no Google recovery service, no recommended
// backup — and a single `$run` frame does one run and returns its result.
// Every app method stays unavailable in this mode (dispatcher.cjs).
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const engineRoot = process.env.SWB_ENGINE_ROOT || path.resolve(__dirname, '../engine');
const { Profiles, appFolders } = require(path.join(engineRoot, 'src/profiles.cjs'));
const { ProvisionClient } = require(path.join(engineRoot, 'src/provision-client.cjs'));
const { applyStatus, telemetryRun, APP_VERSION } = require(path.join(engineRoot, 'src/account.cjs'));

const SKIP = new Set(['battery', 'saver', 'metered']);
const TRIGGERS = new Set(['hourly', 'logon', 'wake', 'unlock', 'manual', 'test']);

// The provisioning server's measurement queue (서버API.md 「측정 받는 꼴」): runs not sent yet, 7 days and 200 at most.
const QUEUE = 'telemetry-queue.json', WEEK = 7 * 86400000, QUEUE_MAX = 200, SERVER_MS = 20000;
const bounded = (promise, ms) => Promise.race([promise, new Promise((_, no) => { const t = setTimeout(() => no(Object.assign(new Error('TIMEOUT'), { code: 'NETWORK' })), ms); t.unref?.(); })]);

// `server` and `restic`: a test's stand-ins for the provisioning client (null: none) and the restic runs.
async function createRunner({ host, root, workRoot = null, resticPath, publish = () => {}, server: given, restic = null, serverMs = SERVER_MS }) {
  const secretStore = {
    encrypt: async value => Buffer.from(await host('secret.encrypt', [value]), 'base64'),
    decrypt: async bytes => host('secret.decrypt', [bytes.toString('base64')])
  };
  const profiles = new Profiles({ root, workRoot, resticPath, secretStore, protectedPaths: appFolders(root), ...(restic ? { runner: restic } : {}) });
  await profiles.open();
  // progress.json for the window: job kind, stage and percent per profile — no
  // paths or settings leave the worker in run mode.
  const progress = () => ({ profiles: Object.fromEntries(Object.entries(profiles.engines).map(([name, e]) =>
    [name, e.job ? { kind: e.job.kind, stage: e.job.stage, percent: e.job.percent } : null])) });
  profiles.on('state', () => publish(progress()));
  // This PC's device of the account, when it was provisioned (device.bin). No Google sign-in is made in a run: the
  // device token reads the status and sends the measurements (4.5 「토큰마다 할 수 있는 일」).
  async function connect() {
    if (given !== undefined) return given;
    const dir = path.join(root, 'device');
    try { await fs.access(path.join(dir, 'device.bin')); } catch { return null; }
    try { const p = new ProvisionClient({ dir, secretStore, auth: null }); await p.open(); return p.state().connected ? p : null; } catch { return null; }
  }
  const ownCloud = server => { const c = profiles.engines.b2?.config; return !!server && !!c?.repositoryId && c.host === server.state().deviceId; };
  let server = null, measured = null;
  async function report() {
    // Runs queued by earlier runs go too, when this one has none of its own.
    if (!ownCloud(server)) return;
    const item = measured && telemetryRun({ ...measured, maxRssKb: process.resourceUsage().maxRSS, cpuMs: Math.round((process.cpuUsage(measured.cpu).user + process.cpuUsage(measured.cpu).system) / 1000) });
    measured = null;
    const file = path.join(root, QUEUE), now = Date.now();
    let runs = [];
    try { const v = JSON.parse(await fs.readFile(file, 'utf8')); if (Array.isArray(v?.runs)) runs = v.runs; } catch { /* none yet */ }
    runs = [...runs, ...(item ? [item] : [])].filter(r => r && Number.isSafeInteger(r.startedAt) && now - r.startedAt < WEEK).slice(-QUEUE_MAX);
    const keep = async list => { const tmp = `${file}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify({ runs: list })); await fs.rename(tmp, file); };
    if (!runs.length) return fs.rm(file, { force: true }).catch(() => {});
    await keep(runs).catch(() => {});
    // The same run sent again is counted once by the server, so a lost answer only costs a resend.
    try { await bounded(server.telemetry({ env: { appVersion: APP_VERSION, ...(process.platform === 'win32' ? { windows: os.release() } : {}), standby: 'unknown' }, runs }), serverMs); await fs.rm(file, { force: true }); }
    catch { /* kept for the next run */ }
  }
  let running = false, closing = false, stopped = null;
  return {
    async runOnce(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('RUN_INPUT');
      const trigger = TRIGGERS.has(input.trigger) ? input.trigger : null;
      if (!trigger) throw Error('RUN_TRIGGER');
      const skipCloud = input.skipCloud == null ? null : SKIP.has(input.skipCloud) ? input.skipCloud : null;
      if (input.skipCloud != null && !skipCloud) throw Error('RUN_SKIP');
      if (running || closing) throw Error('RUN_BUSY');
      running = true;
      try {
        const startedAt = Date.now(), cpu = process.cpuUsage();
        // The server status first (4.5): a seat that moved, a restore running or waiting, an account over its limit,
        // the snapshot a reading PC copies. Offline or slow, the run goes on with what it last knew.
        server = await connect();
        // Only an answer that came in time is applied: a late one must not change the settings under the run (GPT
        // workbackup-runstatus GA2).
        if (server && trigger !== 'test') {
          let status = null;
          try { status = await bounded(server.status(), serverMs); } catch { /* last known state */ }
          if (status) await applyStatus(profiles.engines.b2, status, server.state().deviceId).catch(() => {});
        }
        // A run started by the person ("지금 백업") is the only forced one; the
        // scheduler never forces.
        const results = await profiles.runOnce({ skipCloud, force: trigger === 'manual' });
        if (ownCloud(server) && results.b2) measured = { trigger, startedAt, result: results.b2, skipCloud, cpu, fill: null };
        // When each profile last backed up — a partial snapshot counts — as a time only: the run executable judges
        // 「사흘 넘게」 from it (2.2).
        for (const [name, engine] of Object.entries(profiles.engines)) {
          const at = Math.max(Date.parse(engine.config?.lastBackup?.at) || 0, Date.parse(engine.config?.lastPartial?.at) || 0);
          if (results[name] && at > 0) results[name].lastBackupMs = at;
          if (results[name] && engine.config?.automatic) results[name].automatic = true;
        }
        // maxRSS is this worker's peak working set in KB (the T7 measure, 4.3).
        return { trigger, skipCloud, profiles: results, worker: { maxRssKb: process.resourceUsage().maxRSS } };
      } finally { running = false; }
    },
    // The fill after a partial run (4.2 「도우미」): the run executable passes the links the helper made to each drive's
    // shadow copy — none when it could not — and each profile whose newest partial snapshot is due fills from them.
    // A profile not due is left out; one whose fill fails says so without a message (paths stay in the worker).
    async fillOnce(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.links)) throw Error('FILL_INPUT');
      if (running || closing) throw Error('RUN_BUSY');
      running = true;
      try {
        const results = {};
        for (const [name, engine] of Object.entries(profiles.engines)) {
          if (!engine.fillDue()) continue;
          try { results[name] = await engine.fillNow({ links: input.links }); }
          catch (e) { results[name] = { outcome: 'failed', reason: e.message === 'FILL_INPUT' ? 'input' : 'fill' }; }
        }
        if (measured && results.b2) measured.fill = results.b2;
        return { profiles: results };
      } finally { running = false; }
    },
    // Every caller waits for the same stop, so a second $shutdown cannot exit before the first has saved (review E1).
    // The run's measurement is queued, and the queue sent, before the worker ends (4.9 · 5.5).
    stop() { if (!stopped) { closing = true; stopped = profiles.stop().then(() => report().catch(() => {})); } return stopped; }
  };
}
module.exports = { createRunner };
