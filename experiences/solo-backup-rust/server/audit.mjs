// Outside audit (STAGE1_DESIGN.md 4.5 「매일 대조」 서버 밖): run by the GitHub Actions
// schedule workbackup-audit.yml with the read-only audit key of the customer
// account (listKeys and bucket settings only). It shares the judgement with the
// server (reconcile.mjs) but not the server's database or keys, so a taken-over
// server cannot hide a strange key from it. The log is public: it prints counts
// and problem kinds only. A problem fails the run, and GitHub mails the owner.
import { authorize } from './b2-native.mjs';
import { reconcile } from './reconcile.mjs';

const env = process.env;
const missing = ['WB_AUDIT_KEY_ID', 'WB_AUDIT_APP_KEY', 'WB_AUDIT_BUCKET_ID'].filter((k) => !env[k]);
if (missing.length) {
  console.log(JSON.stringify({ ok: true, skipped: 'audit secrets not set yet', missing: missing.length }));
  process.exit(0);
}
try {
  const s = await authorize({ keyId: env.WB_AUDIT_KEY_ID, applicationKey: env.WB_AUDIT_APP_KEY });
  const keys = (await s.listKeys()).map((k) => ({ keyId: k.applicationKeyId, keyName: k.keyName, capabilities: k.capabilities || [], bucketIds: k.bucketIds || (k.bucketId ? [k.bucketId] : []), namePrefix: k.namePrefix ?? null, expirationTimestamp: k.expirationTimestamp ?? null }));
  const buckets = (await s.listBuckets()).buckets || [];
  const b = buckets.find((x) => x.bucketId === env.WB_AUDIT_BUCKET_ID);
  const repl = b?.replicationConfiguration;
  const bucket = b ? {
    found: true, bucketCount: buckets.length, bucketType: b.bucketType, lifecycleRules: b.lifecycleRules || [],
    encryption: b.defaultServerSideEncryption?.isClientAuthorizedToRead === false ? 'unreadable' : b.defaultServerSideEncryption?.value?.mode || 'none',
    replication: repl?.isClientAuthorizedToRead === false ? 'unreadable' : (repl?.value?.asReplicationSource?.replicationRules?.length || 0) + (repl?.value?.asReplicationDestination ? 1 : 0),
  } : { found: false, bucketCount: buckets.length };
  const protectedKeyIds = [env.WB_AUDIT_KEY_ID, ...(env.WB_AUDIT_KNOWN_KEYS || '').split(',').map((x) => x.trim()).filter(Boolean)];
  const result = reconcile({ keys, bucket, bucketId: env.WB_AUDIT_BUCKET_ID, protectedKeyIds });
  // The known server keys must still exist and must be the only wide keys.
  const knownMissing = protectedKeyIds.filter((id) => !keys.some((k) => k.keyId === id)).length;
  if (knownMissing) result.problems.push({ kind: 'known-key-missing', count: knownMissing });
  console.log(JSON.stringify({ ok: result.problems.length === 0, keys: result.keyCount, problems: result.problems }));
  process.exit(result.problems.length ? 1 : 0);
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e?.status ? `B2 ${e.status}` : 'audit failed' }));
  process.exit(1);
}
