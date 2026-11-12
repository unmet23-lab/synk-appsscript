'use strict';
const MINUTE = 60000;
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const iso = value => time(value) ? new Date(time(value)).toISOString() : null;

// New optional v0.4 fields don't change the repository/credential schema and
// aren't trusted as executable instructions. Opening never writes settings.
function normalizeProtection(c) {
  for (const key of ['pausedUntil', 'lastAttemptAt']) c[key] = iso(c[key]);
  if (!c.lastProbe || !['passed', 'failed', 'incomplete', 'skipped'].includes(c.lastProbe.result) || !iso(c.lastProbe.at)) c.lastProbe = null;
  else c.lastProbe = { result: c.lastProbe.result, at: iso(c.lastProbe.at), snapshotId: /^[a-f0-9]{64}$/.test(c.lastProbe.snapshotId) ? c.lastProbe.snapshotId : null,
    files: c.lastProbe.result === 'passed' ? 1 : 0, bytes: Number.isSafeInteger(c.lastProbe.bytes) && c.lastProbe.bytes >= 0 && c.lastProbe.bytes <= 8 * 1024 * 1024 ? c.lastProbe.bytes : 0,
    reason: typeof c.lastProbe.reason === 'string' ? c.lastProbe.reason.slice(0, 100) : '', detail: typeof c.lastProbe.detail === 'string' ? c.lastProbe.detail.slice(0, 1500) : null };
  if (!c.probeHold || !iso(c.probeHold.since)) c.probeHold = null;
  else c.probeHold = { since: iso(c.probeHold.since), snapshotId: /^[a-f0-9]{64}$/.test(c.probeHold.snapshotId) ? c.probeHold.snapshotId : null, cause: 'size-mismatch' };
  c.startupWarning = typeof c.startupWarning === 'string' ? c.startupWarning.slice(0, 1500) : null;
  if (!c.protectRun || !['startup', 'enable', 'backup', 'done', 'failed'].includes(c.protectRun.phase) || !iso(c.protectRun.startedAt)) c.protectRun = null;
  else c.protectRun = { phase: c.protectRun.phase, startedAt: iso(c.protectRun.startedAt), finishedAt: iso(c.protectRun.finishedAt) };
}
function schedule(c, intervalMs, now, inMemoryAttempt = 0) {
  const attempt = Math.max(time(c?.lastAttemptAt), inMemoryAttempt);
  const clockHold = attempt > now + 5 * MINUTE;
  const pausedUntil = time(c?.pausedUntil);
  const paused = pausedUntil > now;
  const eligible = !!c?.repositoryId && c.mode === 'backup' && !c.readOnly && !!c.automatic;
  const last = attempt || time(c?.lastBackup?.at);
  const dueAt = Math.max(last ? last + intervalMs : now, pausedUntil, time(c?.retryAfter));
  return { paused, clockHold, dueAt, nextBackupAt: eligible && !clockHold ? new Date(Math.max(now, dueAt)).toISOString() : null };
}
function protection(s, { now = Date.now(), startupRegistered = false } = {}) {
  const probeCurrent = !!s.lastProbe && s.lastProbe.result === 'passed' && s.lastProbe.snapshotId === s.lastBackup?.id;
  const interrupted = !!s.protectRun && !['done', 'failed'].includes(s.protectRun.phase) && !s.job;
  const result = (level, reason, nextAction) => ({ level, reason, nextAction, nextBackupAt: s.nextBackupAt || null, probeCurrent, interrupted });
  if (s.job) return result('running', 'job', 'none');
  if (s.credentialRequired) return result('attention', 'credential', 'credentials');
  if (!s.configured) return result('setup', 'setup', 'setup');
  if (s.mode === 'restore' || s.readOnly) return result('restoreOnly', 'restoreOnly', 'restore');
  if (!s.recoverySaved) return result('attention', 'recovery', 'recovery');
  if (s.clockHold || time(s.lastBackup?.at) > now + 5 * MINUTE) return result('attention', 'clock', 'backup');
  if (s.probeHold) return result('attention', 'probe', 'probe');
  if (s.health?.status === 'attention') return result('attention', 'health', 'check');
  if (s.lastError || interrupted) return result('attention', 'error', 'protect');
  if (time(s.pausedUntil) > now) return result('paused', 'paused', 'resume');
  if (!s.automatic) return result('off', 'off', 'protect');
  if (!time(s.lastBackup?.at)) return result('attention', 'empty', 'protect');
  if (now - time(s.lastBackup.at) > (2 * s.intervalMinutes + 15) * MINUTE) return result('attention', 'overdue', 'protect');
  if (!startupRegistered) return result('partial', 'startup', 'protect');
  return result('active', 'active', 'backup');
}
module.exports = { time, normalizeProtection, schedule, protection };
