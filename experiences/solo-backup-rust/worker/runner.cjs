'use strict';
// Scheduled-run mode of the worker (STAGE1_DESIGN.md 4.2). The Rust run executable
// (WorkBackupRun.exe) starts the worker with SWB_MODE=run: only the profile engines
// are opened — no timers, no dialogs, no Google recovery service, no recommended
// backup — and a single `$run` frame does one run and returns its result.
// Every app method stays unavailable in this mode (dispatcher.cjs).
const path = require('node:path');
const engineRoot = process.env.SWB_ENGINE_ROOT || path.resolve(__dirname, '../engine');
const { Profiles } = require(path.join(engineRoot, 'src/profiles.cjs'));

const SKIP = new Set(['battery', 'saver', 'metered']);
const TRIGGERS = new Set(['hourly', 'logon', 'wake', 'unlock', 'manual', 'test']);

async function createRunner({ host, root, workRoot = null, resticPath, publish = () => {} }) {
  const secretStore = {
    encrypt: async value => Buffer.from(await host('secret.encrypt', [value]), 'base64'),
    decrypt: async bytes => host('secret.decrypt', [bytes.toString('base64')])
  };
  const profiles = new Profiles({ root, workRoot, resticPath, secretStore });
  await profiles.open();
  // progress.json for the window: job kind, stage and percent per profile — no
  // paths or settings leave the worker in run mode.
  const progress = () => ({ profiles: Object.fromEntries(Object.entries(profiles.engines).map(([name, e]) =>
    [name, e.job ? { kind: e.job.kind, stage: e.job.stage, percent: e.job.percent } : null])) });
  profiles.on('state', () => publish(progress()));
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
        // A run started by the person ("지금 백업") is the only forced one; the
        // scheduler never forces.
        const results = await profiles.runOnce({ skipCloud, force: trigger === 'manual' });
        // maxRSS is this worker's peak working set in KB (the T7 measure, 4.3).
        return { trigger, skipCloud, profiles: results, worker: { maxRssKb: process.resourceUsage().maxRSS } };
      } finally { running = false; }
    },
    // Every caller waits for the same stop, so a second $shutdown cannot exit before the first has saved (review E1).
    stop() { if (!stopped) { closing = true; stopped = profiles.stop(); } return stopped; }
  };
}
module.exports = { createRunner };
