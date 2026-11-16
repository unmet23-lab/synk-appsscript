// M10 finer (STAGE1_DESIGN.md 4.5 「먼저 잴 것(M10)」): the 11-17 trial showed that an upload address taken before a
// key was deleted still took uploads 1 minute after the deletion and no longer at 10 minutes, while hiding,
// downloading and a new sign-in failed by 10 seconds. This measures where between 1 and 10 minutes uploads stop.
//
// Uses the server's key-work key ('custServerKeys', made by b2-server-setup.mjs) on the customer account:
//  1. makes a test key bound to the customer bucket and a fresh prefix `m10/<random>/` (one-hour lifetime),
//     takes an upload address with it, uploads once, and deletes the key;
//  2. uploads through the same address at 90 s … 9 min after the deletion (stops after two refusals in a row);
//  3. cleans up: a 15-minute delete key bound to the same prefix removes every version under it, then is deleted.
//     Whether the key-work key may make a key with deleteFiles (which it does not hold itself) is printed too.
// With --s3 it measures the S3 API instead (what the app's restic uses): a PUT and a GET with the deleted key's own
// credentials at 5 s … 90 s after the deletion.
// Prints statuses only — no key, bucket name or account number. Usage: node tools/b2-m10-fine.mjs [--s3]
import crypto from 'node:crypto';
import { authorize } from '../b2-native.mjs';
import { s3Request } from '../s3-lite.mjs';
import * as secrets from './secret-store.mjs';

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const say = (step, value) => console.log(JSON.stringify({ step, ...value }));
const bucket = secrets.get('custBucket');
const ks = await authorize(secrets.get('custServerKeys'));
if (ks.accountId !== bucket.accountId) throw new Error('ACCOUNT_MISMATCH');
const prefix = 'm10/' + crypto.randomBytes(4).toString('hex') + '/';
const made = [];
const s3Mode = process.argv.includes('--s3');

async function makeKey(keyName, capabilities, validDurationInSeconds) {
  const r = await ks.createKey({ keyName, capabilities, bucketIds: [bucket.bucketId], namePrefix: prefix, validDurationInSeconds });
  made.push(r.applicationKeyId);
  return { keyId: r.applicationKeyId, applicationKey: r.applicationKey };
}

let cleanupOk = false;
try {
  const a = await makeKey('wb-m10-fine-a', ['listBuckets', 'listFiles', 'readFiles', 'writeFiles'], 3600);
  if (s3Mode) {
    const s3 = (method, tag, body) => s3Request({ endpoint: `https://s3.${bucket.region}.backblazeb2.com`, region: bucket.region, keyId: a.keyId, secret: a.applicationKey, method, bucket: bucket.bucketName, key: prefix + tag, body });
    let before = 0;
    for (let i = 0; i < 6 && before !== 200; i++) { if (i) await sleep(5000); before = (await s3('PUT', 'before', 'm10 before')).status; }
    await ks.deleteKey(a.keyId);
    const tDel = Date.now();
    const after = [];
    let refusedInRow = 0;
    for (const s of [5, 10, 15, 20, 30, 45, 60, 90]) {
      while (Date.now() < tDel + s * 1000) await sleep(250);
      const put = (await s3('PUT', 'after-' + s, 'm10 ' + s)).status, get = (await s3('GET', 'before')).status;
      after.push({ afterS: s, put, get, atMs: Date.now() - tDel });
      refusedInRow = put === 200 || get === 200 ? 0 : refusedInRow + 1;
      if (refusedInRow >= 3) break;
    }
    say('m10-s3', { putBefore: before, after });
    throw Object.assign(new Error('S3_DONE'), { s3Done: true });
  }
  const w = await authorize(a);
  const up = await w.call('b2_get_upload_url', { bucketId: bucket.bucketId });
  const upload = async (tag) => {
    const name = prefix + tag, body = Buffer.from('m10 ' + tag);
    const r = await fetch(up.uploadUrl, { method: 'POST', headers: { authorization: up.authorizationToken, 'x-bz-file-name': name.split('/').map(encodeURIComponent).join('/'), 'content-type': 'text/plain', 'x-bz-content-sha1': crypto.createHash('sha1').update(body).digest('hex') }, body });
    return r.status;
  };
  const before = await upload('before');
  await ks.deleteKey(a.keyId);
  const tDel = Date.now();
  const after = [];
  let refusedInRow = 0;
  for (const s of [90, 120, 150, 180, 240, 300, 360, 420, 480, 540]) {
    while (Date.now() < tDel + s * 1000) await sleep(1000);
    const status = await upload('after-' + s);
    after.push({ afterS: s, upload: status, atMs: Date.now() - tDel });
    refusedInRow = status === 200 ? 0 : refusedInRow + 1;
    if (refusedInRow >= 2) break;
  }
  say('m10-fine', { uploadBefore: before, after });
} catch (e) {
  if (!e.s3Done) throw e;
} finally {
  const result = { deleteKeyMade: false, files: 0 };
  try {
    const d = await makeKey('wb-m10-fine-clean', ['listBuckets', 'listFiles', 'deleteFiles'], 900);
    result.deleteKeyMade = true;
    let s = null;
    for (let i = 0; i < 6 && !s; i++) { try { s = await authorize(d); } catch (e) { if (i === 5) throw e; await sleep(5000); } }
    for (let round = 0; round < 3; round++) {
      const list = await s.listFileVersions({ bucketId: bucket.bucketId, prefix });
      if (!list.length) break;
      for (const v of list) { if (!v.fileName.startsWith(prefix)) throw new Error('CLEANUP_OUTSIDE_PREFIX'); await s.deleteFileVersion({ fileName: v.fileName, fileId: v.fileId }); result.files++; }
    }
    result.prefixEmpty = (await s.listFileVersions({ bucketId: bucket.bucketId, prefix })).length === 0;
  } catch (e) {
    result.cleanupError = String(e.code || e.status || e.message).slice(0, 80);
    // fallback: hide what is left with the file-work key; the bucket's lifecycle rule removes hidden versions
    try {
      const f = await authorize(secrets.get('custServerFiles'));
      const names = new Set((await f.listFileVersions({ bucketId: bucket.bucketId, prefix })).filter((v) => v.action === 'upload').map((v) => v.fileName));
      for (const n of names) { if (!n.startsWith(prefix)) throw new Error('CLEANUP_OUTSIDE_PREFIX'); await f.hideFile({ bucketId: bucket.bucketId, fileName: n }); }
      result.hiddenInstead = names.size;
    } catch (e2) { result.hideError = String(e2.code || e2.status || e2.message).slice(0, 80); }
  }
  for (const id of made) { try { await ks.deleteKey(id); } catch { /* the first key is already gone */ } }
  result.keysLeft = (await ks.listKeys()).filter((k) => made.includes(k.applicationKeyId)).length;
  cleanupOk = result.prefixEmpty === true && result.keysLeft === 0;
  say('cleanup', result);
}
if (!cleanupOk) process.exitCode = 1;
