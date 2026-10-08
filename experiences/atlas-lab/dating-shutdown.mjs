// Stop accepting product work before closing the listener. Existing responses
// get a bounded grace period; interrupted writes use the existing receipt flow.
export function createDatingShutdown({ graceMs = 10000 } = {}) {
  if (!Number.isSafeInteger(graceMs) || graceMs < 1 || graceMs > 30000) throw new TypeError('A bounded dating shutdown grace period is required.');
  let server, draining = false, completion;
  return Object.freeze({
    attach(value) {
      if (server || !value || typeof value.close !== 'function' || typeof value.closeAllConnections !== 'function')
        throw new TypeError('Attach one dating HTTP server.');
      server = value;
    },
    allowRequest(_req, res) {
      if (!draining) return true;
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Retry-After': '1', Connection: 'close' });
      res.end(JSON.stringify({ ok: false, error: { code: 'service-restarting' } }));
      return false;
    },
    stop() {
      if (completion) return completion;
      if (!server) throw new TypeError('Attach the dating HTTP server before stopping.');
      draining = true;
      completion = new Promise((resolve, reject) => {
        let forced = false;
        const timer = setTimeout(() => { forced = true; server.closeAllConnections(); }, graceMs);
        // close() prevents new connections first. Force-closing before close()
        // would leave a race in which the listener accepts another connection.
        server.close(error => {
          clearTimeout(timer);
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
          else resolve(Object.freeze({ stopped: true, forced }));
        });
      });
      return completion;
    }
  });
}

// Install only in the CLI; imported test/product hosts do not own process signals.
// Windows console Ctrl+C/Break are supported, whereas Windows process.kill is
// unconditional termination and cannot promise a grace period.
export function installDatingShutdownSignals(server, { target = process, finish = code => process.exit(code) } = {}) {
  if (typeof server?.shutdownDating !== 'function' || typeof target?.on !== 'function' || typeof target?.off !== 'function'
    || typeof finish !== 'function') throw new TypeError('A dating shutdown controller and signal target are required.');
  const signals = ['SIGINT', 'SIGTERM', 'SIGBREAK'];
  let pending = false;
  const dispose = () => { for (const signal of signals) target.off(signal, handle); };
  const handle = () => {
    if (pending) return;
    pending = true;
    Promise.resolve().then(() => server.shutdownDating()).then(result => {
      dispose(); finish(result.forced ? 1 : 0);
    }, () => { dispose(); finish(1); });
  };
  for (const signal of signals) target.on(signal, handle);
  server.once('close', dispose);
  return dispose;
}
