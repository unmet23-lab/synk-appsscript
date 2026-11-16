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

// The window is (since, to]: hides and snapshots made are counted only inside it (to: the
// moment the daily scan began, so what happens while the listing runs belongs to the next
// window — Fable 5.2 설계 관문 둘째, 11-16). usage is as listed.
// `hourlyFrom`: the baseline — the hours for 「이 시각으로 되돌리기」 candidates count only the hides
// after it, so a burst before the last restore suggests nothing (GPT r9 GA1 · 카본 r9 A1).
export function summarize(versions, { customerPrefix, repoPrefix = customerPrefix + 'r/', since, to = null, now = Date.now(), journal = { hides: [] }, hourlyFrom = 0 }) {
  const end = to ?? now;
  const ourHides = new Set(journal.hides || []);
  const ourCopies = new Set(journal.copies || []);
  const byName = new Map(), order = new Map();
  versions.forEach((v, i) => order.set(v, i));
  for (const v of versions) {
    if (v.action !== 'upload' && v.action !== 'hide') continue;
    if (typeof v.fileName !== 'string' || !v.fileName.startsWith(customerPrefix)) throw new Error('DETECT_OUTSIDE_PREFIX');
    if (!Number.isSafeInteger(v.uploadTimestamp)) throw new Error('DETECT_VERSION_INVALID');
    (byName.get(v.fileName) || byName.set(v.fileName, []).get(v.fileName)).push(v);
  }
  // Oldest first. B2 lists a name's versions newest first, so two in the same millisecond
  // (an upload and its hide) are put back in time order by their place in the listing.
  for (const list of byName.values()) list.sort((a, b) => a.uploadTimestamp - b.uploadTimestamp || order.get(b) - order.get(a));
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
  // snapshotsAtStart · snapshotUploads: visible snapshots where the window starts and those
  // made in it — what there was to prune when no earlier daily count exists.
  const window = { from: since, to: end, snapshotHides: 0, dataHiddenBytes: 0, snapshotsAtStart: 0, snapshotUploads: 0 };
  for (const [name, list] of byName) {
    const last = list.at(-1), rel = relOf(name);
    for (const v of list) {
      if (v.action !== 'upload') continue;
      if (v === last) { usage.visibleBytes += v.contentLength || 0; usage.visibleCount++; if (rel?.startsWith('snapshots/')) usage.visibleSnapshots++; }
      else { usage.hiddenBytes += v.contentLength || 0; usage.hiddenCount++; }
    }
    if (rel?.startsWith('snapshots/')) {
      const before = list.filter((v) => v.uploadTimestamp <= since).at(-1);
      if (before?.action === 'upload') window.snapshotsAtStart++;
      window.snapshotUploads += list.filter((v) => v.action === 'upload' && v.uploadTimestamp > since && v.uploadTimestamp <= end).length;
    }
    if (rel === null || rel.startsWith('locks/')) continue;
    const kind = rel === 'config' ? 'config' : rel.startsWith('keys/') ? 'keys' : 'overwrite';
    let uploads = 0, previous = null, previousSha;
    for (const v of list) {
      if (v.action === 'upload') {
        const s = sha1Of(v);
        // Content that differs from the version just before it (A → B → A → B is three
        // changes, not one), except a copy our own restore made; a version without a
        // usable SHA-1 counts as different. restic never rewrites a name with new bytes.
        if (uploads > 0 && !ourCopies.has(v.fileId) && (s === null || s !== previousSha)) events.push({ kind, fileId: v.fileId, rel, at: v.uploadTimestamp });
        previousSha = s;
        // A key file first uploaded more than a day after the repository's first key: our app never adds keys.
        if (uploads === 0 && kind === 'keys' && firstKeyAt !== null && v.uploadTimestamp > firstKeyAt + DAY) events.push({ kind, fileId: v.fileId, rel, at: v.uploadTimestamp });
        uploads++; previous = v;
        continue;
      }
      // After a hide the name starts over: the same bytes uploaded again (a key or a file put
      // back by a PC not yet cleaned, after a restore hid it) is a change (카본 끝판 B1).
      if (ourHides.has(v.fileId)) { previous = null; previousSha = undefined; continue; }
      if (kind === 'config' || kind === 'keys') events.push({ kind, fileId: v.fileId, rel, at: v.uploadTimestamp });
      if (v.uploadTimestamp > now - WINDOW_DAYS * DAY && v.uploadTimestamp > hourlyFrom) {
        const h = Math.floor(v.uploadTimestamp / HOUR) * HOUR;
        const slot = hourly.get(h) || { start: h, count: 0, first: v.uploadTimestamp };
        slot.count++; slot.first = Math.min(slot.first, v.uploadTimestamp); hourly.set(h, slot);
      }
      if (v.uploadTimestamp > since && v.uploadTimestamp <= end) {
        if (rel.startsWith('snapshots/')) window.snapshotHides++;
        if (rel.startsWith('data/') && previous) window.dataHiddenBytes += previous.contentLength || 0;
      }
      // A second hide marker hides nothing more.
      previous = null; previousSha = undefined;
    }
  }
  events.sort((a, b) => a.at - b.at || a.fileId.localeCompare(b.fileId));
  return { usage, events, window, hourly: [...hourly.values()].sort((a, b) => a.start - b.start), firstKeyAt };
}

// baseline: the customer's last finished restore (events at or before it are history).
// reported: null when no run record arrived for the window, else { pruned, massConfirmed }.
// previousSnapshots: visible snapshots at the previous daily scan (null on the first).
// What the devices may say they pruned is capped by what there was to prune: the listing's
// own count of snapshots where the window starts plus those made in it (Fable 5.2 설계 관문
// 둘째: a stored count drifts from the window). previousSnapshots is only for 「모두 사라짐」.
export function judge(summary, { baseline = 0, reported = null, previousSnapshots = null, seen = () => false, now = Date.now() }) {
  const live = summary.events.filter((e) => e.at > baseline);
  const fresh = live.filter((e) => !seen(e.fileId) && now - e.at < WINDOW_DAYS * DAY);
  const alerts = [];
  const daysLeft = (at) => Math.max(0, WINDOW_DAYS - Math.floor((now - at) / DAY));
  if (fresh.length) {
    const kinds = {}; for (const e of fresh) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    alerts.push({ kind: 'repo-changed', reason: 'content', kinds, daysLeft: daysLeft(fresh[0].at) });
  }
  const w = summary.window, from = Math.max(w.from, baseline);
  const deferred = [];
  // No earlier daily count (the first scan): the listing's own count where the window starts,
  // so a forged prune count cannot cover snapshots hidden before the first scan (GPT r6 GB3).
  const listed = Number.isSafeInteger(w.snapshotsAtStart) ? w.snapshotsAtStart : null;
  if (previousSnapshots === null) previousSnapshots = listed;
  const capSnapshots = listed ?? previousSnapshots;
  // What the devices could have pruned: the snapshots there when the window began and the
  // ones made in it (hourly snapshots are made and pruned inside one window — 카본 r6 B1).
  // A forged count cannot cover hide markers beyond that (a name hidden again and again).
  const prunable = capSnapshots === null ? null : capSnapshots + (w.snapshotUploads || 0);
  // Independent of measurements: every visible snapshot is gone. The engine's retention
  // always keeps the newest one, so zero is never normal — while a halving is (a PC off
  // over a weekend prunes a day of hourly snapshots on its first run back).
  // A first window counts too: snapshots made in it after the last restore, all hidden by its
  // end, with none there when it began (카본 r8a B1).
  const vanished = summary.usage.visibleSnapshots === 0 && ((previousSnapshots !== null && previousSnapshots >= 1) || (w.from >= baseline && (w.snapshotUploads || 0) >= 1));
  // Measured: more snapshot hides than the devices said they made. A device token can
  // send any number, so the accepted count is capped by what was there to prune.
  let surge = false;
  if (w.from >= baseline) {
    if (reported === null) { if (w.snapshotHides > 5) deferred.push('no-telemetry'); }
    else {
      const cap = prunable === null ? reported.pruned : Math.min(reported.pruned, Math.max(0, prunable - 1));
      surge = w.snapshotHides > cap + 5;
    }
  }
  // A large data hide does not wait for measurements (unlike a snapshot one): with none it is
  // not confirmed. It is the backstop when measurements can be forged or never come, and half
  // the data hidden is worth a mail even if the device's word is only late (설계 관문 둘; 카본
  // 끝판2 C1 was weighed against this and not taken).
  const dataSurge = w.from >= baseline && !(reported?.massConfirmed) && w.dataHiddenBytes >= GIB && w.dataHiddenBytes > 0.5 * (summary.usage.visibleBytes + w.dataHiddenBytes);
  if (vanished || surge || dataSurge) alerts.push({ kind: 'repo-changed', reason: 'hide-surge', vanished, snapshotHides: w.snapshotHides, reportedPruned: reported?.pruned ?? null, dataHiddenBytes: w.dataHiddenBytes, daysLeft: daysLeft(from) });
  return { alerts, fresh, deferred };
}

// Default 「이 시각으로 되돌리기」 candidates: the earliest incident after the baseline first.
export function suggest(summary, { baseline = 0, now = Date.now() } = {}) {
  const oldest = Math.max(now - WINDOW_DAYS * DAY, baseline);
  const out = [];
  // Strictly between the baseline and the first change after it, as for bursts (카본 끝판 B2).
  const recent = summary.events.filter((e) => e.at > oldest + 1);
  if (recent.length) out.push({ at: Math.max(recent[0].at - 1000, oldest + 1), reason: recent[0].kind === 'overwrite' ? 'before-overwrite' : 'before-settings-change' });
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
    // Only the first hour of a run — of a run after the baseline: an hour whose hides began
    // before it does not hold back the next one (카본 r8a B3).
    // A candidate lies strictly between the baseline and the hour's first hide: a second before
    // it, or just after the baseline when the hides began within a second of it. An hour that
    // could give none does not hold back the next one (카본 r10a A1).
    const can = (x) => x && x.count >= threshold && x.first > oldest + 1;
    const prev = byStart.get(h.start - HOUR);
    if (!can(h) || can(prev)) continue;
    bursts.push({ at: Math.max(h.first - 1000, oldest + 1), reason: 'before-mass-hide' });
  }
  out.push(...bursts);
  const seenAt = new Set();
  return out.filter((c) => c.at > oldest && c.at < now && !seenAt.has(c.at) && seenAt.add(c.at)).sort((a, b) => a.at - b.at);
}
