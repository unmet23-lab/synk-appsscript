// Bound central identity verification independently of client connection lifetime.
// An abandoned verifier still owns its slot until its actual promise settles.
const fault = (status, code) => Object.assign(new Error(code), { status, code });
const busy = () => fault(429, 'account-busy');
const cancelled = () => fault(499, 'request-cancelled');

export function createDatingAdmission(options = {}) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
    || Object.keys(options).some(key => !['maxActive', 'maxQueued', 'waitMs'].includes(key)))
    throw new TypeError('Explicit bounded account admission settings are required.');
  const { maxActive = 8, maxQueued = 16, waitMs = 1000 } = options;
  if (!Number.isSafeInteger(maxActive) || maxActive < 1 || maxActive > 64
    || !Number.isSafeInteger(maxQueued) || maxQueued < 0 || maxQueued > 256
    || !Number.isSafeInteger(waitMs) || waitMs < 1 || waitMs > 5000)
    throw new TypeError('Account admission limits must be bounded integers.');
  const queue = []; let active = 0, closed = false;
  function remove(job) {
    clearTimeout(job.timer); job.signal?.removeEventListener('abort', job.abort);
    const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1);
  }
  function start(job) {
    remove(job);
    if (job.deadline !== null && performance.now() >= job.deadline) { job.reject(busy()); return; }
    active++;
    Promise.resolve().then(() => {
      if (closed) throw fault(503, 'service-closed');
      if (job.signal?.aborted) throw cancelled();
      return job.operation();
    }).then(value => finish(job, { value }), error => finish(job, { error }));
  }
  function finish(job, result) {
    active--;
    while (!closed && active < maxActive && queue.length) start(queue[0]);
    if (job.signal?.aborted) job.reject(cancelled());
    else if (Object.hasOwn(result, 'error')) job.reject(result.error);
    else job.resolve(result.value);
  }
  return Object.freeze({
    run(operation, { signal } = {}) {
      if (typeof operation !== 'function') return Promise.reject(new TypeError('An account verification operation is required.'));
      if (closed) return Promise.reject(fault(503, 'service-closed'));
      if (signal?.aborted) return Promise.reject(cancelled());
      if (active >= maxActive && queue.length >= maxQueued) return Promise.reject(busy());
      return new Promise((resolve, reject) => {
        const job = { operation, signal, resolve, reject, timer: null, abort: null, deadline: null };
        job.abort = () => { remove(job); reject(cancelled()); };
        if (active < maxActive) start(job);
        else {
          job.deadline = performance.now() + waitMs;
          queue.push(job);
          job.timer = setTimeout(() => { remove(job); reject(busy()); }, waitMs);
          signal?.addEventListener('abort', job.abort, { once: true });
        }
      });
    },
    close() {
      closed = true;
      for (const job of [...queue]) { remove(job); job.reject(fault(503, 'service-closed')); }
    },
  });
}
