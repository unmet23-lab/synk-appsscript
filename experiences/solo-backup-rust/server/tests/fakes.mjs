// Test doubles for the provisioning server: an in-memory B2 account (keys, one
// bucket, file versions) with the B2Session methods the workers call, and a fake
// Google issuer (RSA key, JWKS, signed ID tokens).
import crypto from 'node:crypto';

export class FakeB2 {
  constructor({ bucketId = 'b0b0b0b0b0b0b0b0b0b0b0b0', clock }) {
    this.bucketId = bucketId; this.clock = clock;
    this.keys = new Map(); this.versions = []; this.n = 0; this.calls = [];
    // The approved rules written out here, not taken from EXPECTED_RULES (GPT r6 GD1).
    this.bucket = { bucketId, bucketType: 'allPrivate', lifecycleRules: [{ fileNamePrefix: '', daysFromHidingToDeleting: 30, daysFromUploadingToHiding: null, daysFromStartingToCancelingUnfinishedLargeFiles: 1 }],
      defaultServerSideEncryption: { isClientAuthorizedToRead: true, value: { mode: 'SSE-B2', algorithm: 'AES256' } },
      replicationConfiguration: { isClientAuthorizedToRead: true, value: { asReplicationSource: null, asReplicationDestination: null } } };
    this.extraBuckets = [];
  }
  id(p) { return `${p}${(++this.n).toString(16).padStart(8, '0')}${crypto.randomBytes(6).toString('hex')}`; }
  addKey({ keyName, capabilities, bucketIds = null, namePrefix = null }) {
    const k = { applicationKeyId: this.id('005'), applicationKey: 'K' + crypto.randomBytes(15).toString('base64url'), keyName, capabilities, bucketIds, namePrefix, expirationTimestamp: null };
    this.keys.set(k.applicationKeyId, k);
    return k;
  }
  async createKey(args) { this.calls.push(['createKey', args.keyName]); if (this.failCreate) throw Object.assign(new Error('boom'), { status: 503 }); return { ...this.addKey(args) }; }
  async deleteKey(id) { this.calls.push(['deleteKey', id]); if (this.failDelete) throw Object.assign(new Error('boom'), { status: 503 }); this.keys.delete(id); return {}; }
  async listKeys() { return [...this.keys.values()].map(({ applicationKey, ...k }) => ({ ...k })); }
  async listBuckets() { return { buckets: [this.bucket, ...this.extraBuckets] }; }
  upload(fileName, content, at = this.clock.t) {
    const buf = Buffer.from(content);
    const v = { fileName, fileId: this.id('4_z'), action: 'upload', uploadTimestamp: at, contentSha1: crypto.createHash('sha1').update(buf).digest('hex'), contentLength: buf.length };
    this.versions.push(v); return v;
  }
  hide(fileName, at = this.clock.t) { const v = { fileName, fileId: this.id('4_h'), action: 'hide', uploadTimestamp: at, contentSha1: 'none', contentLength: 0 }; this.versions.push(v); return v; }
  async listFileVersions({ prefix }) {
    return this.versions.filter((v) => v.fileName.startsWith(prefix))
      .map((v, i) => ({ ...v, i })).sort((a, b) => a.fileName.localeCompare(b.fileName) || b.uploadTimestamp - a.uploadTimestamp || b.i - a.i).map(({ i, ...v }) => v);
  }
  async hideFile({ fileName }) { this.calls.push(['hideFile', fileName]); return { ...this.hide(fileName) }; }
  async copyFile({ sourceFileId, fileName }) {
    this.calls.push(['copyFile', fileName]);
    const src = this.versions.find((v) => v.fileId === sourceFileId);
    if (!src || src.action !== 'upload') throw Object.assign(new Error('not found'), { status: 404 });
    const v = { ...src, fileName, fileId: this.id('4_c'), uploadTimestamp: this.clock.t };
    this.versions.push(v); return { ...v };
  }
}
export const sessionOf = (b2) => async (fn) => fn(b2);

export function fakeGoogle({ clock, aud = '123-abc.apps.googleusercontent.com' }) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'kid-' + crypto.randomBytes(4).toString('hex');
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  let fetched = 0;
  const fetchImpl = async () => { fetched++; return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { 'cache-control': 'public, max-age=20000' } }); };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  function token(claims = {}, { key = privateKey, header = {} } = {}) {
    const t = Math.floor(clock.t / 1000);
    const body = { iss: 'https://accounts.google.com', aud, azp: aud, sub: '1000001', email: 'pilot@example.com', email_verified: true, iat: t, exp: t + 3600, ...claims };
    const h = b64({ alg: 'RS256', kid, typ: 'JWT', ...header }), p = b64(body);
    const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url');
    return `${h}.${p}.${sig}`;
  }
  return { aud, token, fetchImpl, get fetched() { return fetched; }, privateKey };
}

export const clockAt = (t = Date.UTC(2026, 10, 16, 3, 0, 0)) => ({ t, now() { return this.t; }, advance(ms) { this.t += ms; } });
