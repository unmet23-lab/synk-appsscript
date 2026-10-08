// A server-injected assertion contract only. No age calculation, identity
// documents, remote provider, access token or client assertion is accepted here.
import { createDatingAdmission } from './dating-admission.mjs';
const keys = ['version', 'subjectId', 'issuer', 'status', 'sequence', 'issuedAt', 'validUntil'];
const statuses = ['verified', 'pending', 'revoked', 'unverified'];
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_.:@-]{1,160}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function readDatingAdultClaim(value, { subjectId, issuer, at } = {}) {
  if (!plain(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))
    || value.version !== 1 || !identifier(subjectId) || value.subjectId !== subjectId || !identifier(issuer) || value.issuer !== issuer
    || !statuses.includes(value.status) || !Number.isSafeInteger(value.sequence) || value.sequence < 1
    || !iso(value.issuedAt) || !iso(at) || Date.parse(value.issuedAt) > Date.parse(at)
    || (value.status === 'verified' ? !iso(value.validUntil) || Date.parse(value.validUntil) <= Date.parse(value.issuedAt) : value.validUntil !== null))
    throw new TypeError('Invalid server adult assertion.');
  return Object.freeze(Object.fromEntries(keys.map(key => [key, value[key]])));
}
export function datingAdultStatus(claim, at) {
  if (!claim) return 'unavailable';
  return claim.status === 'verified' && Date.parse(claim.validUntil) <= Date.parse(at) ? 'expired' : claim.status;
}
export function createDatingAdultVerifier({ required, issuer, verify, timeoutMs = 2000, admission } = {}) {
  if (required !== true || !identifier(issuer) || typeof verify !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8000)
    throw new TypeError('Explicit required adult verification and a server verifier are required.');
  if (admission !== undefined && !plain(admission)) throw new TypeError('Explicit bounded adult admission settings are required.');
  const settings = { maxActive: 8, maxQueued: 16, waitMs: 500, ...admission };
  const limiter = createDatingAdmission(settings), pending = new Map(); let closed = false;
  const fault = (status, code) => Object.assign(new Error(code), { status, code });
  const unavailable = () => ({ claim: null, unavailable: true });
  function notify(job, outcome) {
    for (const caller of [...job.callers]) {
      if (outcome.error) caller.finish(outcome.error);
      else if (outcome.unavailable) caller.finish(null, unavailable());
      else {
        // Validate separately for every caller; no result survives a completed
        // operation, and a different observation time always starts a new check.
        try { caller.finish(null, { claim: readDatingAdultClaim(outcome.value, { subjectId: job.subjectId, issuer, at: caller.at }), unavailable: false }); }
        catch { caller.finish(null, unavailable()); }
      }
    }
  }
  function stop(job, state, outcome) {
    clearTimeout(job.timer); job.state = state; job.controller.abort(); notify(job, outcome);
  }
  function createJob(subjectId, at, key) {
    const job = { subjectId, at, key, state: 'queued', controller: new AbortController(), callers: new Set(), timer: null, deadline: null };
    pending.set(key, job);
    // The limiter owns the real verifier promise, never the timeout race. A
    // verifier which ignores cancellation continues occupying its original slot.
    limiter.run(async () => {
      job.state = 'running'; job.deadline = performance.now() + timeoutMs;
      job.timer = setTimeout(() => stop(job, 'timed-out', { unavailable: true }), timeoutMs);
      try { return { value: await verify({ subjectId, at, signal: job.controller.signal }) }; }
      catch { return { unavailable: true }; }
    }, { signal: job.controller.signal }).then(outcome => finishJob(job, outcome), error => finishJob(job, { error }));
    return job;
  }
  function finishJob(job, outcome) {
    clearTimeout(job.timer); pending.delete(job.key);
    if (job.state === 'running' && performance.now() >= job.deadline) {
      job.controller.abort(); outcome = { unavailable: true };
    }
    if (!['timed-out', 'abandoned', 'closed'].includes(job.state)) notify(job, outcome);
    job.state = 'settled';
  }
  return Object.freeze({ issuer, maxActive: settings.maxActive ?? 8,
    check(subjectId, at, { signal } = {}) {
      if (closed) return Promise.reject(fault(503, 'service-closed'));
      if (signal?.aborted) return Promise.reject(fault(499, 'request-cancelled'));
      if (!identifier(subjectId) || !iso(at)) return Promise.resolve(unavailable());
      // A newer request must not reuse an assertion collected for an earlier
      // observation time: revocation may have happened between the two times.
      const key = `${subjectId}\u0000${at}`, job = pending.get(key) || createJob(subjectId, at, key);
      if (job.state === 'timed-out') return Promise.resolve(unavailable());
      if (job.state === 'abandoned' || job.callers.size >= 64) return Promise.reject(fault(429, 'account-busy'));
      return new Promise((resolve, reject) => {
        const caller = { at, finish(error, value) {
          if (!job.callers.delete(caller)) return;
          signal?.removeEventListener('abort', cancel); error ? reject(error) : resolve(value);
        } };
        const cancel = () => {
          caller.finish(fault(499, 'request-cancelled'));
          if (!job.callers.size) stop(job, 'abandoned', { error: fault(499, 'request-cancelled') });
        };
        job.callers.add(caller); signal?.addEventListener('abort', cancel, { once: true });
      });
    },
    close() {
      if (closed) return; closed = true; limiter.close();
      for (const job of pending.values()) stop(job, 'closed', { error: fault(503, 'service-closed') });
    }
  });
}
export function datingAdultProjection({ required = false, state, checkedAt, at, localActive = true } = {}) {
  if (!required) return { required: false, status: 'not-connected', validUntil: null, checkedAt: null, resumeRequired: false, canResume: false };
  const status = state?.status === 'unavailable' ? 'unavailable' : datingAdultStatus(state?.claim, at);
  return { required: true, status, validUntil: state?.claim?.validUntil || null, checkedAt: checkedAt || state?.checkedAt || null,
    resumeRequired: state?.resumeRequired === true, canResume: localActive && status === 'verified' && state?.resumeRequired === true };
}
