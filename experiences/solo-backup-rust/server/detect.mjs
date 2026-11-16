// Daily look at one customer's B2 file versions (STAGE1_DESIGN.md 4.4 「저장소가 바뀌었는지
// 서버가 매일 본다」 and 「개통 서버 구현 설계」 탐지 규칙). Pure functions: the files worker
// lists the versions and calls summarize(); the api adds the devices' own run
// records and the customer's baseline and calls judge() and suggest(). Nothing
// here needs the repository password or downloads a file.
//
// The rules describe things that happened, each with its time, and judge() only
// counts those after the customer's baseline (the last finished restore). So the
// versions an old incident leaves behind for 30 days do not fire again, and the
// restore tool's copies (which keep the earlier SHA-1) never look like overwrites.
//
// restic names every file except `config` by the SHA-256 of its content and never
// uploads one name twice with different content, so two upload versions of one
// name with different SHA-1 mean an overwrite.

export const DAY = 86400000;
export const HOUR = 3600000;
export const WINDOW_DAYS = 29;
const GIB = 1024 ** 3;

const sha1Of = (v) => (typeof v.contentSha1 === 'string' && /^[0-9a-f]{40}$/.test(v.contentSha1) ? v.contentSha1 : null);

export function summarize(versions, { customerPrefix, repoPrefix = customerPrefix + 'r/', since, now = Date.now(), journal = { hides: [] } }) {
  const ourHides = new Set(journal.hides || []);
  const byName = new Map();
  for (const v of versions) {
    if (v.action !== 'upload' && v.action !== 'hide') continue;
    if (typeof v.fileName !== 'string' || !v.fileName.startsWith(customerPrefix)) throw new Error('DETECT_OUTSIDE_PREFIX');
    if (!Number.isSafeInteger(v.uploadTimestamp)) throw new Error('DETECT_VERSION_INVALID');
    (byName.get(v.fileName) || byName.set(v.fileName, []).get(v.fileName)).push(v);
  }
  for (const list of byName.values()) list.sort((a, b) => a.uploadTimestamp - b.uploadTimestamp);
  const relOf = (name) => (name.startsWith(repoPrefix) ? name.slice(repoPrefix.length) : null);
  let firstKeyAt = null;
  for (const [name, list] of byName) {
    if (!relOf(name)?.startsWith('keys/')) continue;
    const up = list.find((v) => v.action === 'upload');
    if (up && (firstKeyAt === null || up.uploadTimestamp < firstKeyAt)) firstKeyAt = up.uploadTimestamp;
  }
  const usage = { visibleBytes: 0, visibleCount: 0, hiddenBytes: 0, hiddenCount: 0, visibleSnapshots: 0 };
  const events = [];
  const hourly = new Map();
  const window = { from: since, to: now, snapshotHides: 0, dataHiddenBytes: 0 };
  for (const [name, list] of byName) {
    const last = list.at(-1), rel = relOf(name);
    for (const v of list) {
      if (v.action !== 'upload') continue;
      if (v === last) { usage.visibleBytes += v.contentLength || 0; usage.visibleCount++; if (rel?.startsWith('snapshots/')) usage.visibleSnapshots++; }
      else { usage.hiddenBytes += v.contentLength || 0; usage.hiddenCount++; }
    }
    if (rel === null || rel.startsWith('locks/')) continue;
    const kind = rel === 'config' ? 'config' : rel.startsWith('keys/') ? 'keys' : 'overwrite';
    const shas = new Set();
    let uploads = 0, previous = null;
    for (const v of list) {
      if (v.action === 'upload') {
        const s = sha1Of(v);
        // A second content for one name; a version without a usable SHA-1 counts as different.
        if (uploads > 0 && (s === null || !shas.has(s))) events.push({ kind, fileId: v.fileId, rel, at: v.uploadTimestamp });
        if (s) shas.add(s);
        // A key file first uploaded more than a day after the repository's first key: our app never adds keys.
        if (uploads === 0 && kind === 'keys' && firstKeyAt !== null && v.uploadTimestamp > firstKeyAt + DAY) events.push({ kind, fileId: v.fileId, rel, at: v.uploadTimestamp });
        uploads++; previous = v;
        continue;
      }
      if (ourHides.has(v.fileId)) continue;
      if (kind === 'config' || kind === 'keys') events.push({ kind, fileId: v.fileId, rel, at: v.uploadTimestamp });
      if (v.uploadTimestamp > now - WINDOW_DAYS * DAY) {
        const h = Math.floor(v.uploadTimestamp / HOUR) * HOUR;
        const slot = hourly.get(h) || { start: h, count: 0, first: v.uploadTimestamp };
        slot.count++; slot.first = Math.min(slot.first, v.uploadTimestamp); hourly.set(h, slot);
      }
      if (v.uploadTimestamp > since && v.uploadTimestamp <= now) {
        if (rel.startsWith('snapshots/')) window.snapshotHides++;
        if (rel.startsWith('data/') && previous) window.dataHiddenBytes += previous.contentLength || 0;
      }
    }
  }
  events.sort((a, b) => a.at - b.at || a.fileId.localeCompare(b.fileId));
  return { usage, events, window, hourly: [...hourly.values()].sort((a, b) => a.start - b.start), firstKeyAt };
}

// baseline: the customer's last finished restore (events at or before it are history).
// reported: null when no run record arrived for the window, else { pruned, massConfirmed }.
// previousSnapshots: visible snapshots at the previous daily scan (null on the first).
export function judge(summary, { baseline = 0, reported = null, previousSnapshots = null, seen = () => false, now = Date.now() }) {
  const live = summary.events.filter((e) => e.at > baseline);
  const fresh = live.filter((e) => !seen(e.fileId));
  const alerts = [];
  const daysLeft = (at) => Math.max(0, WINDOW_DAYS - Math.floor((now - at) / DAY));
  if (fresh.length) {
    const kinds = {}; for (const e of fresh) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    alerts.push({ kind: 'repo-changed', reason: 'content', kinds, daysLeft: daysLeft(live[0].at) });
  }
  const w = summary.window, from = Math.max(w.from, baseline);
  const deferred = [];
  // Independent of measurements: every visible snapshot is gone. The engine's retention
  // always keeps the newest one, so zero is never normal — while a halving is (a PC off
  // over a weekend prunes a day of hourly snapshots on its first run back).
  const vanished = previousSnapshots !== null && previousSnapshots >= 1 && summary.usage.visibleSnapshots === 0;
  // Measured: more snapshot hides than the devices said they made. A device token can
  // send any number, so the accepted count is capped by what was there to prune.
  let surge = false;
  if (w.from >= baseline) {
    if (reported === null) { if (w.snapshotHides > 5) deferred.push('no-telemetry'); }
    else {
      const cap = previousSnapshots === null ? reported.pruned : Math.min(reported.pruned, Math.max(0, previousSnapshots - 1));
      surge = w.snapshotHides > cap + 5;
    }
  }
  const dataSurge = w.from >= baseline && !(reported?.massConfirmed) && w.dataHiddenBytes >= GIB && w.dataHiddenBytes > 0.5 * (summary.usage.visibleBytes + w.dataHiddenBytes);
  if (vanished || surge || dataSurge) alerts.push({ kind: 'repo-changed', reason: 'hide-surge', vanished, snapshotHides: w.snapshotHides, reportedPruned: reported?.pruned ?? null, dataHiddenBytes: w.dataHiddenBytes, daysLeft: daysLeft(from) });
  return { alerts, fresh, deferred };
}

// Default 「이 시각으로 되돌리기」 candidates: the earliest incident after the baseline first.
export function suggest(summary, { baseline = 0, now = Date.now() } = {}) {
  const oldest = Math.max(now - WINDOW_DAYS * DAY, baseline);
  const out = [];
  const recent = summary.events.filter((e) => e.at > oldest);
  if (recent.length) out.push({ at: recent[0].at - 1000, reason: recent[0].kind === 'overwrite' ? 'before-overwrite' : 'before-settings-change' });
  const hours = summary.hourly.filter((h) => h.start >= oldest - HOUR);
  const total = Math.max(1, Math.round((now - (now - WINDOW_DAYS * DAY)) / HOUR));
  const counts = hours.map((h) => h.count).sort((a, b) => a - b);
  // Median over every hour of the window: hours without hides count as zero.
  const zeros = total - counts.length, mid = Math.floor(total / 2);
  const median = mid < zeros ? 0 : counts[mid - zeros] ?? 0;
  const threshold = Math.max(20, 5 * median);
  const byStart = new Map(hours.map((h) => [h.start, h]));
  const bursts = [];
  for (const h of hours) {
    if (h.count < threshold || byStart.get(h.start - HOUR)?.count >= threshold) continue; // only the first hour of a run
    bursts.push({ at: h.first - 1000, reason: 'before-mass-hide' });
  }
  out.push(...bursts);
  const seenAt = new Set();
  return out.filter((c) => c.at > oldest && c.at < now && !seenAt.has(c.at) && seenAt.add(c.at)).sort((a, b) => a.at - b.at);
}
