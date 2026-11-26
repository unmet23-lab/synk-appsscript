'use strict';
// The worker waits for an open (openExternal · openPath) longer than the windowless host waits for SYNK 솔리오's answer to
// its `ask` (SOLIO_ONE_CLIENT.md 2.6), so the worker always gets the host's own yes or OPEN_FAILED — a Google sign-in
// whose browser opened after the worker had given up would otherwise be dropped (GPT workbackup-solio-one-be-20261127 C4).
// The worker's real `host()` runs here with its own source, its timers caught, so the time limit it actually sets is what
// is checked, not a copy of the rule (-r2 GA6). Nothing is started: stdin, stdout and the timers are stand-ins.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const DISPATCHER = path.join(__dirname, '..', 'worker', 'dispatcher.cjs');

/* The dispatcher's own code with stand-ins: its `host` function and the frames it sent and the timers it set */
function dispatcher() {
  const sent = [], timers = [];
  const quiet = { on() { return this; }, pause() {}, write(text) { sent.push(JSON.parse(text)); return true; }, end() {} };
  const fakeProcess = { stdin: quiet, stdout: quiet, on() {}, env: {}, exit() {} };
  const setTimer = (fn, ms) => { timers.push(ms); return { ms, unref() {} }; };
  const run = new Function('require', 'process', 'setTimeout', 'clearTimeout', 'Buffer', `${fs.readFileSync(DISPATCHER, 'utf8')}\nreturn { host };`);
  const { host } = run(createRequire(DISPATCHER), fakeProcess, setTimer, () => {}, Buffer);
  return { host, sent, timers };
}

test('an open waits in the worker longer than the host waits for its ask; every other host call keeps its time limit', () => {
  const ask = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'host.rs'), 'utf8').match(/pub const ASK_WAIT: Duration = Duration::from_secs\((\d+)\);/);
  assert.ok(ask, 'host.rs ASK_WAIT');
  const askMs = Number(ask[1]) * 1000;
  const { host, sent, timers } = dispatcher();
  const methods = ['openExternal', 'openPath', 'dialog.pickFolder', 'secret.encrypt', 'files.place', 'folders.watch', 'reinstall.run', 'engine.lock'];
  for (const method of methods) void host(method, []).catch(() => {});
  assert.deepEqual(sent.map((frame) => frame.method), methods, 'each call went to the host as a frame');
  // A dialog waits without a limit: no timer.
  const limits = Object.fromEntries(methods.filter((m) => m !== 'dialog.pickFolder').map((m, i) => [m, timers[i]]));
  assert.equal(timers.length, methods.length - 1);
  for (const method of ['openExternal', 'openPath']) assert.ok(limits[method] > askMs, `${method}: ${limits[method]} ms > ask ${askMs} ms`);
  // The margin covers a line out and its answer back after the host's own limit.
  assert.ok(limits.openExternal - askMs >= 5000);
  assert.deepEqual([limits['secret.encrypt'], limits['files.place'], limits['folders.watch'], limits['reinstall.run'], limits['engine.lock']], [30000, 1800000, 60000, 10800000, 10000]);
});
