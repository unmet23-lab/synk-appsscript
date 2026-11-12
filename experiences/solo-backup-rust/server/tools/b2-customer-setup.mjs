// Customer B2 account setup (STAGE1_DESIGN.md 4.4 · 11 「2주차」). The account is the
// separate customer account the owner signed up for on 2026-11-12 (the operator account
// keeps 0.5.0 and the stage-1 test bucket). Reads a temporary key-management key
// ('custAdmin', captured DPAPI-protected from the console, 1-hour lifetime), refuses to
// run against the operator account or a non-empty account, creates the customer bucket
// (private, SSE-B2, one lifecycle rule for the whole bucket: delete 30 days after hiding,
// cancel unfinished large files after 1 day) and the outside audit key (listKeys and
// bucket settings, read only), checks both, then deletes the temporary key.
// Idempotent; prints no secret and no bucket name. Key-making and file-work keys for
// the provisioning server are made in week 3, when that server exists.
import crypto from 'node:crypto';
import { authorize } from '../b2-native.mjs';
import * as store from './secret-store.mjs';

const RULES = [{ fileNamePrefix: '', daysFromHidingToDeleting: 30, daysFromUploadingToHiding: null, daysFromStartingToCancelingUnfinishedLargeFiles: 1 }];
const AUDIT = ['listKeys', 'listBuckets', 'readBuckets', 'readBucketEncryption', 'readBucketRetentions', 'readBucketReplications'];
const AUDIT_MIN = ['listKeys', 'listBuckets', 'readBuckets'];
// Rules compared without key order or empty fields.
const norm = (rules) => JSON.stringify((rules || []).map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v != null).sort())));

const temp = store.get('custAdmin');
const admin = await authorize(temp);
for (const need of ['writeKeys', 'listKeys', 'deleteKeys', 'writeBuckets', 'listBuckets']) {
  if (!admin.capabilities.includes(need)) throw new Error('ADMIN_KEY_MISSING_' + need);
}
// Never the operator account (it holds 0.5.0 and the test bucket).
if (store.has('keyR')) {
  const operator = await authorize(store.get('keyR'));
  if (operator.accountId === admin.accountId) throw new Error('OPERATOR_ACCOUNT');
}
let bucket = store.has('custBucket') ? store.get('custBucket') : null;
// A rerun continues only in the same account (review GA1, 11-12).
for (const name of ['custBucket', 'custAudit']) {
  if (store.has(name) && store.get(name).accountId !== admin.accountId) throw new Error('ACCOUNT_MISMATCH_' + name);
}
const existing = (await admin.listBuckets()).buckets || [];
if (existing.some((b) => !bucket || b.bucketId !== bucket.bucketId)) throw new Error('ACCOUNT_NOT_EMPTY');

if (!bucket) {
  const r = await admin.createBucket({ bucketName: 'synk-wb-cust-' + crypto.randomBytes(5).toString('hex'), lifecycleRules: RULES });
  bucket = { accountId: admin.accountId, bucketId: r.bucketId, bucketName: r.bucketName, s3ApiUrl: admin.s3ApiUrl, region: admin.region,
    lifecycleRules: r.lifecycleRules, encryption: r.defaultServerSideEncryption?.value?.mode || null };
  store.put('custBucket', bucket);
}

let auditCaps = null;
if (!store.has('custAudit')) {
  let k;
  try { k = await admin.createKey({ keyName: 'wb-cust-audit', capabilities: AUDIT }); }
  catch (e) { if (e.status !== 400) throw e; k = await admin.createKey({ keyName: 'wb-cust-audit', capabilities: AUDIT_MIN }); }
  store.put('custAudit', { accountId: admin.accountId, keyId: k.applicationKeyId, applicationKey: k.applicationKey, capabilities: k.capabilities, keyName: k.keyName });
  auditCaps = k.capabilities;
}

// The audit key sees exactly one bucket with exactly the one rule, and the key list.
const audit = await authorize(store.get('custAudit'));
const seen = (await audit.listBuckets()).buckets || [];
const mine = seen.find((b) => b.bucketId === bucket.bucketId);
const keys = await audit.listKeys();
const check = {
  region: bucket.region, encryption: mine?.defaultServerSideEncryption?.value?.mode || bucket.encryption,
  buckets: seen.length, bucketType: mine?.bucketType || null, lifecycleRules: mine?.lifecycleRules || null,
  oneRuleExactly: norm(mine?.lifecycleRules) === norm(RULES),
  auditCapabilities: auditCaps || audit.capabilities, keysListed: keys.length,
};

// Stop before deleting the temporary key unless the result is exactly what 4.4 asks for
// (review GA2): the key then stays usable for a fix until it expires within the hour.
const READ_ONLY = new Set([...AUDIT]);
const problems = [
  audit.accountId !== admin.accountId && 'audit-account',
  check.buckets !== 1 && 'bucket-count',
  check.bucketType !== 'allPrivate' && 'not-private',
  check.encryption !== 'SSE-B2' && 'encryption',
  !check.oneRuleExactly && 'lifecycle',
  !AUDIT_MIN.every((c) => check.auditCapabilities.includes(c)) && 'audit-missing',
  check.auditCapabilities.some((c) => !READ_ONLY.has(c)) && 'audit-not-read-only',
].filter(Boolean);
if (problems.length) { console.log(JSON.stringify({ ...check, problems }, null, 1)); throw new Error('SETUP_CHECK_FAILED:' + problems.join(',')); }

// The temporary key goes last; afterwards it must no longer authorize. Right after b2_delete_key the
// authorization service can still accept the key for a few seconds (11-13: accepted once, refused with
// 401 on the next look), so look again for up to a minute; any answer other than 401 stops here.
await admin.deleteKey(temp.keyId);
let tempGone = false;
for (let i = 0; i < 12 && !tempGone; i++) {
  if (i) await new Promise((r) => setTimeout(r, 5000));
  try { await authorize(temp); } catch (e) { if (e.status !== 401) throw e; tempGone = true; }
}
console.log(JSON.stringify({ ...check, tempKeyDeleted: tempGone }, null, 1));
// A management key that still works is a failed setup (review B6): stop loudly and keep the store entry for a retry.
if (!tempGone) throw new Error('TEMP_KEY_STILL_VALID');
store.remove('custAdmin');
