// Navigation waits for all page assets and leaves the caller's cleanup reserve intact.
export function navigationBefore(deadline) {
  return {waitUntil: 'load', timeout: Math.max(1, Math.floor(deadline - performance.now()))};
}

export async function openOwnedEdge(chromium, t, deadline) {
  const remaining = () => Math.max(1, Math.floor(deadline - performance.now()));
  t.signal.throwIfAborted();
  const server = await chromium.launchServer({channel: 'msedge', headless: true, timeout: Math.min(30_000, remaining())});
  let closing;
  function close() {
    t.signal.removeEventListener('abort', onAbort);
    return closing ??= closeOwnedEdge(server, {
      signal: t.signal, graceMs: Math.max(0, Math.min(5000, deadline - performance.now())), diagnostic: message => t.diagnostic(message),
    });
  }
  function onAbort() { void close().catch(() => {}); }
  t.signal.addEventListener('abort', onAbort, {once: true});
  try {
    t.signal.throwIfAborted();
    const browser = await chromium.connect(server.wsEndpoint(), {timeout: Math.min(30_000, remaining())});
    t.signal.throwIfAborted();
    return {browser, close};
  } catch (error) {
    await close();
    throw error;
  }
}

export async function stopTutorFixture(server, edge) {
  const stopped = new Promise(resolve => server.close(resolve));
  server.closeAllConnections();
  try {
    await edge?.close();
  } finally {
    const error = await stopped;
    if (error) throw error;
  }
}

// Node gives an after hook its own deadline and waits for it before announcing the test result.
export function afterTutorCleanup(t, stop, report, timeout = 150_000) {
  t.after(async hook => {
    const start = performance.now();
    let cleanupError;
    try { await stop(); } catch (error) { cleanupError = error; }
    const elapsed = performance.now() - start;
    if (hook.signal.aborted) cleanupError ??= hook.signal.reason;
    if (elapsed > timeout) cleanupError ??= Error('Owned tutor fixture cleanup exceeded its deadline');
    report(Math.round(elapsed), cleanupError ?? (t.signal.aborted ? t.signal.reason : null));
    if (cleanupError) throw cleanupError;
  }, {timeout});
}

// The BrowserServer owns this test's Edge process tree and temporary profile.
export async function closeOwnedEdge(server, {signal, graceMs = 10_000, diagnostic}) {
  if (!server) return;
  if (signal.aborted || graceMs <= 0) {
    await server.kill();
    return;
  }
  let timer, onAbort;
  const interrupted = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('Graceful Edge close timed out')), graceMs);
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, {once: true});
  });
  try {
    await Promise.race([server.close(), interrupted]);
  } catch (error) {
    diagnostic(`Closing this test's Edge with its child processes: ${error.message}`);
    await server.kill();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

