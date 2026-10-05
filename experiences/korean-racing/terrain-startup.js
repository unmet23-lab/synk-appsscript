// Start during asset I/O. Always settle failures here, even if the scene/font
// setup has not reached its await yet. The caller keeps the synchronous fallback.
export function startTerrainBuild({createWorker = () => new Worker(new URL('./terrain-worker.js', import.meta.url), {type: 'module'}), timeoutMs = 15000} = {}) {
  let worker, timer, settled = false, finish;
  const result = new Promise(resolve => {
    finish = value => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (worker) {
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        worker.terminate();
      }
      resolve(value);
    };
    try {
      worker = createWorker();
      worker.onmessage = ({data}) => finish(data?.ok === true && data.terrain
        ? {ok: true, terrain: data.terrain, computeMs: data.computeMs}
        : {ok: false, reason: 'worker-result'});
      worker.onerror = event => {event.preventDefault?.(); finish({ok: false, reason: 'worker-error'});};
      worker.onmessageerror = () => finish({ok: false, reason: 'worker-message'});
      timer = setTimeout(() => finish({ok: false, reason: 'worker-timeout'}), timeoutMs);
      worker.postMessage({type: 'build'});
    } catch {finish({ok: false, reason: 'worker-unavailable'});}
  });
  return {result, cancel: () => finish({ok: false, reason: 'cancelled'})};
}
