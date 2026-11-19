'use strict';

const {execFileSync} = require('node:child_process');
const path = require('node:path');

const helper = path.join(__dirname, 'native', 'tray-memory-win-x64.exe');
const IDLE_MS = 30_000;
const HELPER_TIMEOUT_MS = 500;

function createTrayMemoryReclaimer({getWindows, getMetrics, busy, reportError, run = execFileSync, timers = globalThis}) {
  let pending = null;

  function cancel() {
    if (!pending) return;
    const {window, timer, contents} = pending;
    pending = null;
    timers.clearTimeout(timer);
    window.removeListener('show', cancel);
    window.removeListener('closed', cancel);
    for (const event of ['did-start-loading', 'devtools-opened', 'media-started-playing']) contents.removeListener(event, cancel);
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
    const job = {window, contents, timer: null};
    pending = job;
    window.once('show', cancel);
    window.once('closed', cancel);
    for (const event of ['did-start-loading', 'devtools-opened', 'media-started-playing']) contents.once(event, cancel);
    job.timer = timers.setTimeout(() => {
      if (pending !== job) return;
      cancel();
      try {
        if (!eligible(window)) return;
        const processes = getMetrics();
        if (!processes.length || processes.length > 256) { reportError('TRAY_MEMORY_PROCESS_LIST'); return; }
        const identities = processes.map(({pid, creationTime}) => {
          if (!Number.isSafeInteger(pid) || pid < 1 || !Number.isFinite(creationTime) || creationTime <= 0) {
            throw Error('Invalid Platform process identity');
          }
          return pid + ':' + Math.trunc(creationTime);
        });
        // Finish this bounded OS operation before the main loop can begin a reveal, update or quit.
        // The renderer stays untouched. The helper verifies current HWNDs, images, parents and birth times.
        run(helper, identities, {windowsHide: true, timeout: HELPER_TIMEOUT_MS, stdio: 'ignore'});
      } catch (error) {
        if (error.status === 2) return; // An actual window is visible or the desktop changed.
        reportError(error.code === 'ETIMEDOUT' ? 'TRAY_MEMORY_HELPER_TIMEOUT' : 'TRAY_MEMORY_HELPER_FAILED');
      }
    }, IDLE_MS);
    job.timer.unref?.();
  }

  return {schedule, cancel};
}

module.exports = {createTrayMemoryReclaimer};
