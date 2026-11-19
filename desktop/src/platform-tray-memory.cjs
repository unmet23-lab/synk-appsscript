'use strict';

const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const IDLE_MS = 30_000;
const DONE = 0;
const MORE = 1;
const SKIPPED = 2;

function loadNative() {
  const file = path.join(__dirname, 'native', 'tray-memory-win-x64.node');
  const expected = fs.readFileSync(path.join(__dirname, 'native', 'tray-memory-win-x64.sha256'), 'utf8').trim();
  if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== expected) {
    throw Error('Invalid tray memory module');
  }
  const native = require(file);
  if (typeof native !== 'function') throw Error('Unavailable tray memory module');
  return native;
}

function createTrayMemoryReclaimer({getWindows, getMetrics, busy, reportError, load = loadNative, timers = globalThis}) {
  let pending = null;
  let native;

  function cancel() {
    if (!pending) return;
    const {window, timer, immediate, prepared, contents} = pending;
    pending = null;
    timers.clearTimeout(timer);
    if (immediate) timers.clearImmediate(immediate);
    window.removeListener('show', cancel);
    window.removeListener('closed', cancel);
    for (const event of ['did-start-loading', 'devtools-opened', 'media-started-playing']) contents.removeListener(event, cancel);
    if (prepared) {
      try { native('cancel'); } catch { reportError('TRAY_MEMORY_NATIVE_FAILED'); }
    }
  }

  function eligible(window) {
    if (busy() || window.isDestroyed() || window.isVisible() || window.webContents.isLoading()) return false;
    return getWindows().every(other => {
      if (other.isDestroyed()) return true;
      const contents = other.webContents;
      return !other.isVisible() && !contents.isDestroyed() && !contents.isCurrentlyAudible()
        && !contents.isBeingCaptured() && !contents.isDevToolsOpened();
    });
  }

  function schedule(window) {
    cancel();
    const contents = window.webContents;
    const job = {window, contents, timer: null, immediate: null, prepared: false};
    pending = job;
    window.once('show', cancel);
    window.once('closed', cancel);
    for (const event of ['did-start-loading', 'devtools-opened', 'media-started-playing']) contents.once(event, cancel);
    job.timer = timers.setTimeout(() => {
      if (pending !== job) return;
      try {
        if (!eligible(window)) { cancel(); return; }
        const processes = getMetrics();
        if (!processes.length || processes.length > 256) { cancel(); reportError('TRAY_MEMORY_PROCESS_LIST'); return; }
        const identities = processes.map(({pid, creationTime}) => {
          if (!Number.isSafeInteger(pid) || pid < 1 || !Number.isFinite(creationTime) || creationTime <= 0) {
            throw Error('Invalid Platform process identity');
          }
          return pid + ':' + Math.trunc(creationTime);
        });
        native ??= load();
        // Preparation pins only validated process handles. Each subsequent event-loop
        // turn can trim one process, after rechecking the current activity and windows.
        advance(native(identities.join(',')));
      } catch {
        cancel();
        reportError('TRAY_MEMORY_NATIVE_FAILED');
      }
    }, IDLE_MS);
    job.timer.unref?.();

    function advance(status) {
      if (status !== MORE) {
        job.prepared = false;
        cancel();
        if (status !== DONE && status !== SKIPPED) reportError('TRAY_MEMORY_NATIVE_FAILED');
        return;
      }
      job.prepared = true;
      // An otherwise idle tray must still finish this batch. A reveal or quit
      // cancels the referenced continuation before another process is trimmed.
      job.immediate = timers.setImmediate(() => {
        if (pending !== job) return;
        try {
          if (!eligible(window)) { cancel(); return; }
          advance(native('next'));
        } catch {
          cancel();
          reportError('TRAY_MEMORY_NATIVE_FAILED');
        }
      });
    }
  }

  return {schedule, cancel};
}

module.exports = {createTrayMemoryReclaimer};
