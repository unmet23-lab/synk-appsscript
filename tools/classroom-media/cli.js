#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const { Worker, validateConfig, validateSession, seal, safeCode } = require('./worker');
const { checkLocal } = require('./preflight');
const { preflightText, statusText, errorGuidance } = require('./operator-guide');

const HELP = `SYNK classroom media (Node 22+)
  node tools/classroom-media/cli.js check CONFIG [--human]
  node tools/classroom-media/cli.js verify CONFIG
  node tools/classroom-media/cli.js prepare CONFIG SESSION
  node tools/classroom-media/cli.js arm CONFIG SESSION
  node tools/classroom-media/cli.js seal CONFIG SESSION RECORDING [--fallback]
  node tools/classroom-media/cli.js replace-replay CONFIG SESSION RECORDING --confirmed-complete
  node tools/classroom-media/cli.js once CONFIG
  node tools/classroom-media/cli.js status CONFIG [--human]
  node tools/classroom-media/cli.js watch CONFIG
  node tools/classroom-media/cli.js recover CONFIG SESSION VIDEO_ID
  node tools/classroom-media/cli.js retry-create CONFIG SESSION --confirmed-no-video
  node tools/classroom-media/cli.js retry-sync CONFIG SESSION --confirmed-resolved

CONFIG and SESSION are JSON paths. Keep runtime directories outside Git.
check is local/read-only; a pass still requires the listed manual media checks.
--human on check/status prints Korean guidance; default JSON output is unchanged.
verify is read-only on YouTube; prepare/once/watch/recover can publish class videos.
prepare arms the OBS completion script after verifying the broadcast.
arm is for recording-only sessions. OBS consumes this arm once per recording.
With config.rooms, set session.roomId; each room uses one stable OBS active file.
seal is only for an already CLOSED recording. Never call it on a growing file.
replace-replay queues a confirmed full recording for an ended live lesson.
retry-create requires an operator to check YouTube Studio for a missing/duplicate video.
retry-sync resumes a paused job only after resolving its server conflict; run once/watch next.
`;

async function main(argv) {
  const human = argv.includes('--human');
  const [command, configPath, sessionPath, fourth, fifth] = argv.filter(value => value !== '--human');
  if (!command || ['help', '--help', '-h'].includes(command)) { process.stdout.write(HELP); return; }
  if (human && !['check', 'status'].includes(command)) throw new Error('HUMAN_OUTPUT_REQUIRES_CHECK_OR_STATUS');
  const config = validateConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
  // Run before constructing Worker: check must not even create runtime folders.
  if (['check', 'prepare', 'arm'].includes(command)) {
    const preflight = checkLocal(config);
    if (command === 'check' || !preflight.ok) {
      process.stdout.write(`${human ? preflightText(preflight) : JSON.stringify(preflight, null, 2)}\n`);
      if (!preflight.ok) process.exitCode = 1;
      return;
    }
  }
  const worker = new Worker(config);
  if (command === 'status' && human) { process.stdout.write(`${statusText(worker.jobs())}\n`); return; }
  const session = () => validateSession(JSON.parse(fs.readFileSync(sessionPath, 'utf8')), config);
  let result;
  switch (command) {
    case 'verify': result = await worker.verify(); break;
    case 'prepare': result = await worker.prepare(session(), { arm: true }); break;
    case 'arm': result = await worker.arm(session()); break;
    case 'seal': result = { manifest: await seal(config, session(), fourth, { fallback: fifth === '--fallback' }) }; break;
    case 'replace-replay': result = await worker.replaceReplay(session(), fourth, { confirmedComplete: fifth === '--confirmed-complete' }); break;
    case 'once': result = await worker.once(); break;
    case 'status': result = worker.jobs().map(job => ({ sessionKey: job.sessionKey, classId: job.classId, roomId: job.roomId || null, source: job.source, videoId: job.videoId, status: job.status, syncPaused: job.syncPaused || null, backupOnly: job.backupOnly || false, uploadedBytes: job.uploadedBytes || 0, lastError: job.lastError || null, playbackBlocked: job.playbackBlocked || false, blockSyncError: job.blockSyncError || null, streamHealth: job.streamHealth || null, attempts: job.attempts || 0, nextAttemptAt: job.nextAttemptAt ? new Date(job.nextAttemptAt).toISOString() : null, replaceReplay: job.replaceReplay || false, syncedAt: job.syncedAt || null })); break;
    case 'recover': result = await worker.recover(session(), fourth); break;
    case 'retry-create': result = await worker.retryCreate(session(), fourth === '--confirmed-no-video'); break;
    case 'retry-sync': result = await worker.retrySync(session(), fourth === '--confirmed-resolved'); break;
    case 'watch': {
      const controller = new AbortController();
      process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort());
      while (!controller.signal.aborted) {
        let waitMs = worker.pollInterval();
        try { process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...await worker.once() })}\n`); }
        catch (error) { process.stderr.write(`${JSON.stringify({ at: new Date().toISOString(), error: safeCode(error) })}\n`); }
        try { waitMs = worker.nextDelay(); } catch {}
        try { await delay(waitMs, undefined, { signal: controller.signal }); } catch { break; }
      }
      return;
    }
    default: throw new Error('UNKNOWN_COMMAND');
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result?.failures?.length || result?.paused?.length) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  const code = safeCode(error);
  process.stderr.write(`${code}\n${process.argv.includes('--human') ? errorGuidance(code) + '\n' : ''}`);
  process.exitCode = 1;
});
module.exports = { main };
