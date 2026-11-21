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
  c.massHold = massHoldOf(c.massHold);
  c.leftOutNames = leftOutOf(c.leftOutNames);
  c.leftOutHeld = leftOutHeldOf(c.leftOutHeld);
  delete c.leftOutAll;
  // 「확인을 마침」: each folder covered between two backup times (engine massCheck); `path` null for every folder. `reach`:
  // for a folder counted more than one way, the backup each way compared it with — past `to` and within any of them it
  // is counted, out of the share.
  const ranges = (Array.isArray(c.massCheck?.folders) ? c.massCheck.folders : []).filter(r => (r?.path === null || (typeof r?.path === 'string' && r.path.length >= 1 && r.path.length <= 1024)) && iso(r?.from) && iso(r?.to)).slice(-100);
  c.massCheck = ranges.length ? { folders: ranges.map(r => ({ path: r.path, from: iso(r.from), to: iso(r.to), ...(times(r.reach) ? { reach: times(r.reach) } : {}) })) } : null;
  c.startupWarning = typeof c.startupWarning === 'string' ? c.startupWarning.slice(0, 1500) : null;
  if (!c.protectRun || !['startup', 'enable', 'backup', 'done', 'failed'].includes(c.protectRun.phase) || !iso(c.protectRun.startedAt)) c.protectRun = null;
  else c.protectRun = { phase: c.protectRun.phase, startedAt: iso(c.protectRun.startedAt), finishedAt: iso(c.protectRun.finishedAt) };
}
// A folder's `reach`: its earliest and its latest time — every range in it holds the backup kept, so together they are
// one (r14 GA2); none when it has none.
function times(v) { const t = (Array.isArray(v) ? v.map(iso).filter(Boolean) : []).sort(); return t.length ? [...new Set([t[0], t.at(-1)])] : null; }
// 대량 삭제 · 변경 멈춤 (4.4): a hold as the engine wrote it, or none. Without the backup it keeps it is no hold.
function massHoldOf(h) {
  const ID = /^[a-f0-9]{64}$/, n = v => Number.isSafeInteger(v) && v >= 0 ? v : null, text = v => typeof v === 'string' && v.length >= 1 && v.length <= 1024 ? v : null;
  if (!h || typeof h !== 'object' || !ID.test(h.beforeId) || !ID.test(h.afterId) || !iso(h.since) || !iso(h.at) || !iso(h.beforeAt)) return null;
  return { since: iso(h.since), at: iso(h.at), kind: ['removed', 'changed', 'bytes'].includes(h.kind) ? h.kind : 'removed', path: text(h.path),
    removed: n(h.removed) ?? 0, changed: n(h.changed) ?? 0, removedBytes: n(h.removedBytes) ?? 0, left: n(h.left), totalNow: n(h.totalNow), bytesNow: n(h.bytesNow), before: n(h.before),
    beforeId: h.beforeId, beforeAt: iso(h.beforeAt), afterId: h.afterId,
    folders: (Array.isArray(h.folders) ? h.folders : []).filter(f => text(f?.path)).slice(0, 30).map(f => ({ path: f.path, removed: n(f.removed) ?? 0, changed: n(f.changed) ?? 0 })),
    // A backup compared whole (its folders not told apart) names no folder: `folder` null (r2 GA4).
    list: (Array.isArray(h.list) ? h.list : []).filter(i => (i?.folder === null || text(i?.folder)) && text(i?.name) && ['removed', 'changed'].includes(i.kind)).slice(0, 500).map(i => ({ folder: i.folder, name: i.name, kind: i.kind })),
    // Each folder compared, with the time of the backup it was compared with: what 「확인을 마침」 covers (`reach`: as far
    // as some way of a folder counted more than one way saw it).
    compared: (Array.isArray(h.compared) ? h.compared : []).filter(x => (x?.path === null || text(x?.path)) && iso(x?.at)).slice(0, 30).map(x => ({ path: x.path, at: iso(x.at), ...(times(x.reach) ? { reach: times(x.reach) } : {}) })) };
}
// 이 백업에 담지 못하는 이름 (4.2): the names a backup could not hold for ending in a dot or a space, as the engine wrote
// them, or none. `count` is a lower bound when `cut`; `checked` false while the last walk of the folders did not finish —
// then none found is told too.
function leftOutOf(o) {
  if (!o || typeof o !== 'object' || !iso(o.at) || !Number.isSafeInteger(o.count) || o.count < (o.checked === false ? 0 : 1)) return null;
  const names = []; let chars = 0;
  for (const p of Array.isArray(o.names) ? o.names : []) {
    if (typeof p !== 'string' || p.length < 1 || p.length > 32767) continue;
    if (names.length >= 1000 || chars + p.length > 32768) break;
    names.push(p); chars += p.length;
  }
  return { at: iso(o.at), count: Math.max(o.count, names.length), names, cut: o.cut === true, ...(o.checked === false ? { checked: false } : {}) };
}
// Where each of those names is held, apart from the settings (left-out-names.json in the state folder): which file
// (`id`), how many it stands for — those it could not name too — and whether more were found (`cut`). Not in the
// window's state.
function leftOutHeldOf(o) {
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !o.id || o.id.length > 64 || !Number.isSafeInteger(o.count) || o.count < 0 || o.count > 2 ** 31) return null;
  return { id: o.id, seq: Number.isSafeInteger(o.seq) && o.seq >= 0 ? o.seq : 0, count: o.count, dropped: Number.isSafeInteger(o.dropped) && o.dropped >= 0 && o.dropped <= o.count ? o.dropped : 0, cut: o.cut === true };
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
  if (s.massHold) return result('attention', 'mass', 'mass');
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
