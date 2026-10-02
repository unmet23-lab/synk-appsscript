#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const { Worker, validateConfig, validateSession, seal, safeCode } = require('./worker');

const HELP = `SYNK classroom media (Node 22+)
  node tools/classroom-media/cli.js verify CONFIG
  node tools/classroom-media/cli.js prepare CONFIG SESSION
  node tools/classroom-media/cli.js arm CONFIG SESSION
  node tools/classroom-media/cli.js seal CONFIG SESSION RECORDING [--fallback]
  node tools/classroom-media/cli.js once CONFIG
  node tools/classroom-media/cli.js status CONFIG
  node tools/classroom-media/cli.js watch CONFIG
  node tools/classroom-media/cli.js recover CONFIG SESSION VIDEO_ID
  node tools/classroom-media/cli.js retry-create CONFIG SESSION --confirmed-no-video

CONFIG and SESSION are JSON paths. Keep runtime directories outside Git.
verify is read-only on YouTube; prepare/once/watch/recover can publish class videos.
prepare arms the OBS completion script after verifying the broadcast.
arm is for recording-only sessions. OBS consumes this arm once per recording.
With config.rooms, set session.roomId; each room uses one stable OBS active file.
seal is only for an already CLOSED recording. Never call it on a growing file.
retry-create requires an operator to check YouTube Studio for a missing/duplicate video.
`;

async function main(argv) {
  const [command, configPath, sessionPath, fourth, fifth] = argv;
  if (!command || ['help', '--help', '-h'].includes(command)) { process.stdout.write(HELP); return; }
  const config = validateConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
  const worker = new Worker(config);
  const session = () => validateSession(JSON.parse(fs.readFileSync(sessionPath, 'utf8')), config);
  let result;
  switch (command) {
    case 'verify': result = await worker.verify(); break;
    case 'prepare': result = await worker.prepare(session(), { arm: true }); break;
    case 'arm': result = await worker.arm(session()); break;
    case 'seal': result = { manifest: await seal(config, session(), fourth, { fallback: fifth === '--fallback' }) }; break;
    case 'once': result = await worker.once(); break;
    case 'status': result = worker.jobs().map(job => ({ sessionKey: job.sessionKey, classId: job.classId, roomId: job.roomId || null, source: job.source, videoId: job.videoId, status: job.status, backupOnly: job.backupOnly || false, uploadedBytes: job.uploadedBytes || 0, lastError: job.lastError || null, syncedAt: job.syncedAt || null })); break;
    case 'recover': result = await worker.recover(session(), fourth); break;
    case 'retry-create': result = await worker.retryCreate(session(), fourth === '--confirmed-no-video'); break;
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
  if (result?.failures?.length) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { process.stderr.write(`${safeCode(error)}\n`); process.exitCode = 1; });
module.exports = { main };
