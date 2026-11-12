// Stage-1 test bucket setup in the operator's existing B2 account
// (STAGE1_DESIGN.md 4.4 · 11; approved 2026-11-12 「승인, B2 시험 진행」).
// Reads a temporary key-management key from the local DPAPI store ('admin'),
// creates one private SSE-B2 bucket with lifecycle rules and six restricted keys,
// and stores everything DPAPI-protected. Idempotent: existing entries are kept.
// Prints no secrets and no bucket name.
import crypto from 'node:crypto';
import { authorize } from '../b2-native.mjs';
import * as store from './secret-store.mjs';

const admin = await authorize(store.get('admin'));
for (const need of ['writeKeys', 'listKeys', 'deleteKeys', 'writeBuckets', 'listBuckets']) {
  if (!admin.capabilities.includes(need)) throw new Error('ADMIN_KEY_MISSING_' + need);
}

let bucket;
if (store.has('bucket')) bucket = store.get('bucket');
else {
  const bucketName = 'synk-wb-s1-' + crypto.randomBytes(5).toString('hex');
  const rules = [
    { fileNamePrefix: 't/', daysFromHidingToDeleting: 30, daysFromUploadingToHiding: null },
    { fileNamePrefix: 'ci/', daysFromHidingToDeleting: 1, daysFromUploadingToHiding: 7 },
  ];
  let r;
  try { r = await admin.createBucket({ bucketName, lifecycleRules: rules.map((x) => ({ ...x, daysFromStartingToCancelingUnfinishedLargeFiles: 1 })) }); }
  catch (e) { if (e.status !== 400) throw e; console.log('lifecycle without large-file cancel:', e.code); r = await admin.createBucket({ bucketName, lifecycleRules: rules }); }
  bucket = { bucketId: r.bucketId, bucketName: r.bucketName, s3ApiUrl: admin.s3ApiUrl, region: admin.region,
    lifecycleRules: r.lifecycleRules, encryption: r.defaultServerSideEncryption?.value?.mode || null };
  store.put('bucket', bucket);
}

const WRITE = ['listBuckets', 'listFiles', 'readFiles', 'writeFiles'];
const READ = ['listBuckets', 'listFiles', 'readFiles'];
const specs = {
  keyA: { keyName: 'wb-s1-m-write', capabilities: WRITE, namePrefix: 't/' },                 // device-like, no delete
  keyB: { keyName: 'wb-s1-m-write-nolist', capabilities: ['listFiles', 'readFiles', 'writeFiles'], namePrefix: 't/' },
  keyR: { keyName: 'wb-s1-m-read', capabilities: READ, namePrefix: 't/' },                   // customer read key
  keyS: { keyName: 'wb-s1-m-server', capabilities: [...WRITE, 'deleteFiles'] },              // restore tool / inspection
  keyCW: { keyName: 'wb-s1-ci-write', capabilities: WRITE, namePrefix: 'ci/' },
  keyCR: { keyName: 'wb-s1-ci-read', capabilities: READ, namePrefix: 'ci/' },
};
const made = [];
for (const [name, spec] of Object.entries(specs)) {
  if (store.has(name)) { made.push({ name, kept: true }); continue; }
  const k = await admin.createKey({ keyName: spec.keyName, capabilities: spec.capabilities, bucketIds: [bucket.bucketId], namePrefix: spec.namePrefix });
  store.put(name, { keyId: k.applicationKeyId, applicationKey: k.applicationKey, capabilities: k.capabilities, namePrefix: k.namePrefix || null, keyName: k.keyName });
  made.push({ name, capabilities: k.capabilities, namePrefix: k.namePrefix || null, buckets: (k.bucketIds || []).length });
}
if (!store.has('ciSeed')) store.put('ciSeed', crypto.randomBytes(32).toString('base64url'));
console.log(JSON.stringify({ region: bucket.region, encryption: bucket.encryption, lifecycleRules: bucket.lifecycleRules, keys: made }, null, 1));
