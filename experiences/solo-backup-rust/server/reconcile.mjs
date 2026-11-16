// The daily comparison of B2 keys and bucket settings with what should exist
// (STAGE1_DESIGN.md 4.5 「매일 대조」). The same function runs inside the server
// (with the keys table) and outside it (server/audit.mjs from a GitHub Actions
// schedule with the read-only audit key, no table), so a taken-over server cannot
// also silence the outside check. Results carry kinds and counts only — no key
// id or bucket name — because the outside run prints to a public log.
import { WRITE_CAPS, READ_CAPS, NAME } from './keys-worker.mjs';
import { PREFIX } from './config.mjs';

export const EXPECTED_RULES = [{ fileNamePrefix: '', daysFromHidingToDeleting: 30, daysFromUploadingToHiding: null, daysFromStartingToCancelingUnfinishedLargeFiles: 1 }];
const norm = (rules) => JSON.stringify((rules || []).map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v != null).sort())).sort());
// A write key (wbw-) may hold the write set; a read key (wbr-) only the read set.
const capsOf = { w: new Set(WRITE_CAPS), r: new Set(READ_CAPS) };

// keys: [{keyId, keyName, capabilities, bucketIds, namePrefix, expirationTimestamp}]
// table (server only): rows of the keys table that are not 'deleted'; deletedKeyIds and
// deletedNames: rows deleted before the listing began (with an id, and without one).
// It never changes the table: `undeleted` · `undeletedNames` are keys to delete again,
// `suspects` are live rows the listing did not show (the caller checks them again).
export function reconcile({ keys, bucket, bucketId, protectedKeyIds = [], table = null, deletedKeyIds = [], deletedNames = [] }) {
  const problems = new Map();
  const add = (kind, n = 1) => problems.set(kind, (problems.get(kind) || 0) + n);
  const undeleted = [], undeletedNames = [];
  const goneNames = new Set(deletedNames);
  const guard = new Set(protectedKeyIds);
  const byId = table ? new Map(table.filter((r) => r.key_id).map((r) => [r.key_id, r])) : null;
  const creating = table ? new Set(table.filter((r) => r.state === 'creating').map((r) => r.name)) : null;
  const deleted = new Set(deletedKeyIds);
  const perPrefix = new Map();
  for (const k of keys) {
    if (guard.has(k.keyId)) continue;
    const named = NAME.test(k.keyName || '');
    if (!named) { add('unknown-key'); continue; }
    // One writer and 「확정 하나 + 미확정 하나」 read keys per customer, seen without the table.
    const c = perPrefix.get(k.namePrefix) || { w: 0, r: 0 };
    c[k.keyName[2]]++; perPrefix.set(k.namePrefix, c);
    if (!PREFIX.test(k.namePrefix || '')) add('no-prefix');
    if (!Array.isArray(k.bucketIds) || k.bucketIds.length !== 1 || k.bucketIds[0] !== bucketId) add('wrong-bucket');
    if (!(k.capabilities || []).every((c) => capsOf[k.keyName[2]].has(c))) add('too-wide');
    if (k.expirationTimestamp) add('expiring');
    if (table) {
      const row = byId.get(k.keyId);
      if (deleted.has(k.keyId)) { add('not-deleted'); undeleted.push(k.keyId); }
      else if (!row) {
        // A key whose B2 answer has not been written yet: the expiry deletes it after ten minutes.
        if (creating.has(k.keyName)) continue;
        if (goneNames.has(k.keyName)) { add('not-deleted'); undeletedNames.push(k.keyName); }
        else add('not-in-table');
      }
      else if (row.prefix && row.prefix !== k.namePrefix) add('prefix-mismatch');
    }
  }
  for (const c of perPrefix.values()) if (c.w > 1 || c.r > 2) add('too-many-keys');
  const present = new Set(keys.map((k) => k.keyId));
  const suspects = table ? table.filter((r) => r.key_id && ['active', 'acked'].includes(r.state) && !present.has(r.key_id)).map((r) => r.name) : [];
  if (!bucket || bucket.found === false) add('bucket-missing');
  else {
    if (bucket.bucketCount !== 1) add('bucket-count');
    if (bucket.bucketType !== 'allPrivate') add('bucket-not-private');
    if (bucket.encryption !== 'SSE-B2') add('encryption');
    if (norm(bucket.lifecycleRules) !== norm(EXPECTED_RULES)) add('lifecycle');
    if (bucket.replication !== 0) add('replication');
  }
  return { ok: problems.size === 0, problems: [...problems].map(([kind, count]) => ({ kind, count })), undeleted, undeletedNames, suspects, keyCount: keys.length };
}
