// 「이 시각으로 되돌리기」 — return a customer's prefix to its state at time T
// using only B2 file versions (STAGE1_DESIGN.md 4.4). The PC key cannot delete;
// hides and overwrites leave older versions in place for the bucket's 30-day
// lifecycle window, and this plan brings the state at T back.
//
// For each file name under the prefix:
//   visible at T, now hidden by hide markers only  -> delete those hide markers (data untouched)
//   visible at T, overwritten (or overwritten+hidden) -> copy the T version on top (server-side copy)
//   not visible at T, visible now                    -> hide (reversible; lifecycle deletes after 30 days)
//   otherwise                                         -> unchanged
// Unfinished large files ('start') and 'folder' entries are ignored.

const DAY = 86400000;
export const MAX_AGE_MS = 30 * DAY;

// restic layout order: restore data before the files that reference it, and
// hide new snapshots before the data they reference.
const RESTORE_ORDER = ['data/', 'index/', 'keys/', 'config', 'snapshots/', 'locks/'];
const HIDE_ORDER = ['snapshots/', 'locks/', 'index/', 'data/', 'keys/', 'config'];
function rank(order, rel) { const i = order.findIndex(p => p.endsWith('/') ? rel.startsWith(p) : rel === p); return i < 0 ? order.length : i; }

export function planRestore(versions, { at, now = Date.now(), prefix, maxAgeMs = MAX_AGE_MS }) {
  if (!Number.isSafeInteger(at) || at <= 0) throw new Error('RESTORE_TIME_INVALID');
  if (at > now) throw new Error('RESTORE_TIME_FUTURE');
  if (now - at > maxAgeMs) throw new Error('RESTORE_TIME_TOO_OLD');
  if (typeof prefix !== 'string' || !prefix.endsWith('/') || prefix.length < 2) throw new Error('RESTORE_PREFIX_INVALID');
  const byName = new Map();
  versions.forEach((v, index) => {
    if (v.action !== 'upload' && v.action !== 'hide') return;
    if (typeof v.fileName !== 'string' || !v.fileName.startsWith(prefix)) throw new Error('RESTORE_OUTSIDE_PREFIX');
    if (!Number.isSafeInteger(v.uploadTimestamp)) throw new Error('RESTORE_VERSION_INVALID');
    (byName.get(v.fileName) || byName.set(v.fileName, []).get(v.fileName)).push({ ...v, index });
  });
  const items = []; const counts = { unhide: 0, copy: 0, hide: 0, unchanged: 0 }; let bytes = 0;
  for (const [fileName, list] of byName) {
    // B2 lists one name newest first; ascending time, ties keep B2's order reversed.
    list.sort((a, b) => a.uploadTimestamp - b.uploadTimestamp || b.index - a.index);
    const atOrBefore = list.filter(v => v.uploadTimestamp <= at);
    const stateAt = atOrBefore.at(-1) || null;
    const atUpload = stateAt?.action === 'upload' ? stateAt : null;
    const current = list.at(-1);
    const currentUpload = current.action === 'upload' ? current : null;
    const rel = fileName.slice(prefix.length);
    if (atUpload) {
      if (currentUpload && currentUpload.fileId === atUpload.fileId) { counts.unchanged++; continue; }
      const after = list.filter(v => v.uploadTimestamp > at);
      if (after.length && after.every(v => v.action === 'hide')) {
        items.push({ type: 'unhide', fileName, rel, deleteFileIds: after.map(v => v.fileId), bytes: atUpload.contentLength || 0 });
        counts.unhide++;
      } else {
        items.push({ type: 'copy', fileName, rel, sourceFileId: atUpload.fileId, bytes: atUpload.contentLength || 0 });
        counts.copy++; bytes += atUpload.contentLength || 0;
      }
    } else if (currentUpload) {
      items.push({ type: 'hide', fileName, rel, bytes: currentUpload.contentLength || 0 }); counts.hide++;
    } else counts.unchanged++;
  }
  items.sort((a, b) => {
    const ta = a.type === 'hide' ? 1 : 0, tb = b.type === 'hide' ? 1 : 0;
    if (ta !== tb) return ta - tb;
    const order = ta ? HIDE_ORDER : RESTORE_ORDER;
    return rank(order, a.rel) - rank(order, b.rel) || a.fileName.localeCompare(b.fileName);
  });
  return { at, prefix, counts, copyBytes: bytes, items };
}

// Applies a plan with a B2Session that holds listFiles/readFiles/writeFiles/deleteFiles
// on the bucket. Returns a journal of what was done so the run can be reviewed or undone.
export async function applyPlan(session, { bucketId, plan, onStep = () => {} }) {
  const journal = [];
  for (const item of plan.items) {
    if (!item.fileName.startsWith(plan.prefix)) throw new Error('RESTORE_OUTSIDE_PREFIX');
    if (item.type === 'unhide') {
      for (const fileId of item.deleteFileIds) await session.deleteFileVersion({ fileName: item.fileName, fileId });
      journal.push({ type: 'unhide', fileName: item.fileName, deletedHideMarkers: item.deleteFileIds });
    } else if (item.type === 'copy') {
      const r = await session.copyFile({ sourceFileId: item.sourceFileId, fileName: item.fileName });
      journal.push({ type: 'copy', fileName: item.fileName, sourceFileId: item.sourceFileId, newFileId: r.fileId });
    } else if (item.type === 'hide') {
      const r = await session.hideFile({ bucketId, fileName: item.fileName });
      journal.push({ type: 'hide', fileName: item.fileName, hideMarkerId: r.fileId });
    }
    onStep(journal.length, plan.items.length);
  }
  return journal;
}
