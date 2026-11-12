// 「이 시각으로 되돌리기」 — return a customer's prefix to its state at time T
// using only B2 file versions (STAGE1_DESIGN.md 4.4). The PC key cannot delete;
// hides and overwrites leave older versions in place for the bucket's 30-day
// lifecycle window, and this plan brings the state at T back.
//
// Always copy (design review Q5): the tool never deletes a file version.
//   visible at T, now hidden or replaced -> server-side copy of the T version on top
//   not visible at T, visible now        -> hide (reversible; lifecycle deletes after 30 days)
//   otherwise                            -> unchanged
// Hide markers stay, so "when was it hidden" survives for a second restore, and
// undoing a restore is the same tool with T = the moment before it ran.
// restic lock files (locks/), unfinished large files ('start') and 'folder'
// entries are ignored.

const DAY = 86400000;
// The lifecycle runs once a day, so a version hidden 30 days ago may already be
// gone; offer at most 29 days.
export const MAX_AGE_MS = 29 * DAY;

// restic layout order: add data before the files that reference it, and hide
// new snapshots before the data they reference. A run stopped half-way always
// leaves more visible than needed, so restic can still open the repository.
const RESTORE_ORDER = ['data/', 'index/', 'snapshots/', 'keys/', 'config'];
const HIDE_ORDER = ['snapshots/', 'index/', 'data/', 'keys/', 'config'];
function rank(order, rel) { const i = order.findIndex((p) => p.endsWith('/') ? rel.startsWith(p) : rel === p); return i < 0 ? order.length : i; }
// restic names every file except `config` by the SHA-256 of its content, and a
// B2 server-side copy keeps the SHA-1. Same name + same SHA-1 + same length is
// the same file (an earlier restore's copy); a different SHA-1 is an overwrite.
export function sameContent(a, b) {
  if (!a || !b) return false;
  if (a.fileId === b.fileId) return true;
  return typeof a.contentSha1 === 'string' && a.contentSha1.length === 40 && a.contentSha1 === b.contentSha1 && a.contentLength === b.contentLength;
}

export function planRestore(versions, { at, now = Date.now(), prefix, maxAgeMs = MAX_AGE_MS }) {
  if (!Number.isSafeInteger(at) || at <= 0) throw new Error('RESTORE_TIME_INVALID');
  if (at > now) throw new Error('RESTORE_TIME_FUTURE');
  if (now - at > maxAgeMs) throw new Error('RESTORE_TIME_TOO_OLD');
  if (typeof prefix !== 'string' || !prefix.endsWith('/') || prefix.length < 2) throw new Error('RESTORE_PREFIX_INVALID');
  const byName = new Map();
  versions.forEach((v, index) => {
    if (v.action !== 'upload' && v.action !== 'hide') return;
    if (typeof v.fileName !== 'string' || !v.fileName.startsWith(prefix)) throw new Error('RESTORE_OUTSIDE_PREFIX');
    if (v.fileName.slice(prefix.length).startsWith('locks/')) return;
    if (!Number.isSafeInteger(v.uploadTimestamp)) throw new Error('RESTORE_VERSION_INVALID');
    (byName.get(v.fileName) || byName.set(v.fileName, []).get(v.fileName)).push({ ...v, index });
  });
  const items = []; const counts = { copy: 0, hide: 0, unchanged: 0 }; let copyBytes = 0;
  for (const [fileName, list] of byName) {
    // B2 lists one name newest first; ascending time, ties keep B2's order reversed.
    list.sort((a, b) => a.uploadTimestamp - b.uploadTimestamp || b.index - a.index);
    const stateAt = list.filter((v) => v.uploadTimestamp <= at).at(-1) || null;
    const atUpload = stateAt?.action === 'upload' ? stateAt : null;
    const current = list.at(-1);
    const currentUpload = current.action === 'upload' ? current : null;
    const rel = fileName.slice(prefix.length);
    if (atUpload) {
      if (sameContent(currentUpload, atUpload)) { counts.unchanged++; continue; }
      items.push({ type: 'copy', fileName, rel, sourceFileId: atUpload.fileId, sourceUploadedAt: atUpload.uploadTimestamp, bytes: atUpload.contentLength || 0 });
      counts.copy++; copyBytes += atUpload.contentLength || 0;
    } else if (currentUpload) {
      items.push({ type: 'hide', fileName, rel, currentFileId: currentUpload.fileId, bytes: currentUpload.contentLength || 0 }); counts.hide++;
    } else counts.unchanged++;
  }
  items.sort((a, b) => {
    const ta = a.type === 'hide' ? 1 : 0, tb = b.type === 'hide' ? 1 : 0;
    if (ta !== tb) return ta - tb;
    const order = ta ? HIDE_ORDER : RESTORE_ORDER;
    return rank(order, a.rel) - rank(order, b.rel) || a.fileName.localeCompare(b.fileName);
  });
  return { at, prefix, counts, copyBytes, items };
}

// Applies a plan with a B2Session holding listFiles/readFiles/writeFiles on the
// bucket (no deleteFiles needed). Before acting it re-reads the listing and
// re-plans, so a change between preview and run cannot be overwritten blindly.
// Re-running after a stop continues: done items no longer appear in a fresh plan.
export async function applyPlan(session, { bucketId, plan, freshVersions, now = Date.now(), onStep = () => {} }) {
  const fresh = freshVersions ? planRestore(freshVersions, { at: plan.at, now, prefix: plan.prefix }) : plan;
  const journal = [];
  for (const item of fresh.items) {
    if (!item.fileName.startsWith(fresh.prefix)) throw new Error('RESTORE_OUTSIDE_PREFIX');
    if (item.type === 'copy') {
      const r = await session.copyFile({ sourceFileId: item.sourceFileId, fileName: item.fileName });
      journal.push({ type: 'copy', fileName: item.fileName, sourceFileId: item.sourceFileId, newFileId: r.fileId });
    } else if (item.type === 'hide') {
      const r = await session.hideFile({ bucketId, fileName: item.fileName });
      journal.push({ type: 'hide', fileName: item.fileName, hiddenFileId: item.currentFileId, hideMarkerId: r.fileId });
    }
    onStep(journal.length, fresh.items.length);
  }
  return { plan: fresh, journal };
}
