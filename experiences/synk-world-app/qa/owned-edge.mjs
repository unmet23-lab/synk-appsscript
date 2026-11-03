// Navigation waits for all page assets and leaves the caller's cleanup reserve intact.
export function navigationBefore(deadline) {
  return {waitUntil: 'load', timeout: Math.max(1, Math.floor(deadline - performance.now()))};
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

