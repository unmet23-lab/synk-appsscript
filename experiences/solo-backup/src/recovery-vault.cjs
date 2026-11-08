'use strict';
const crypto = require('node:crypto');
const b2 = require('./b2.cjs');
const { parseKit } = require('./engine.cjs');
const { validSub } = require('./recovery-auth.cjs');
const { request, requestJson, failure } = require('./recovery-http.cjs');
const MARKER = 'workbackup-recovery-v1';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const FILE = /^[A-Za-z0-9_-]{1,200}$/;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const equalKeys = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join(',') === keys.sort().join(',');
function parseEnvelope(bytes, subject) {
  try {
    if (Buffer.byteLength(bytes) > 65536) throw failure('INVALID');
    const e = JSON.parse(bytes.toString());
    if (!equalKeys(e, ['format', 'version', 'generationId', 'generation', 'createdAt', 'subject', 'kit', 'readKey', 'bucketId', 'resticVersion']) || e.format !== MARKER || e.version !== 1 || !UUID.test(e.generationId) || !Number.isSafeInteger(e.generation) || e.generation < 1 || !Number.isFinite(Date.parse(e.createdAt)) || new Date(e.createdAt).toISOString() !== e.createdAt || !validSub(e.subject) || e.subject !== subject || e.resticVersion !== '0.19.1' || !/^[a-f0-9]{8,64}$/.test(e.bucketId)) throw failure('INVALID');
    if (!equalKeys(e.kit, ['format', 'version', 'type', 'provider', 'repository', 'repositoryId', 'vaultId', 'password']) || !equalKeys(e.kit.provider, ['type', 'endpoint', 'bucket', 'prefix']) || !equalKeys(e.readKey, ['keyId', 'applicationKey'])) throw failure('INVALID');
    e.kit = parseKit(JSON.stringify(e.kit));
    if (e.kit.type !== 'b2') throw failure('INVALID');
    e.readKey = b2.credentials(e.readKey);
    return e;
  } catch { throw failure('INVALID'); }
}
async function validateReadKey(provider, key, json = requestJson) {
  const c = b2.credentials(key);
  const data = await json('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', { headers: { authorization: `Basic ${Buffer.from(`${c.keyId}:${c.applicationKey}`).toString('base64')}` } });
  const storage = data?.apiInfo?.storageApi, a = storage?.allowed;
  // B2 console's Read Only preset includes read-only bucket metadata and
  // shareFiles (delegated download authorization), but no write/delete/admin.
  const allowed = new Set(['listBuckets', 'readBuckets', 'readBucketEncryption', 'readBucketNotifications', 'readBucketLogging', 'readBucketReplications', 'readBucketLifecycleRules', 'readBucketRetentions', 'readFileRetentions', 'readFileLegalHolds', 'listFiles', 'readFiles', 'shareFiles']);
  if (!a || !Array.isArray(a.buckets) || a.buckets.length !== 1 || a.buckets[0].name !== provider.bucket || !/^[a-f0-9]{8,64}$/.test(a.buckets[0].id) || !Array.isArray(a.capabilities) || !['listFiles', 'readFiles'].every(x => a.capabilities.includes(x)) || a.capabilities.some(x => !allowed.has(x)) || (a.namePrefix !== null && a.namePrefix !== '' && a.namePrefix !== provider.prefix + '/') || data.applicationKeyExpirationTimestamp !== null || b2.endpoint(storage.s3ApiUrl) !== provider.endpoint) throw new Error('만료가 없는 버킷 전용 읽기 키가 필요합니다. 쓰기·삭제 권한이 있는 키는 복구 정보에 넣지 않습니다.');
  return { bucketId: a.buckets[0].id };
}
class DriveVault {
  constructor(auth, transport = request) { this.auth = auth; this.transport = transport; }
  async call(route, options = {}) {
    const access = await this.auth.access();
    return this.transport(`https://www.googleapis.com/${route}`, { ...options, headers: { ...options.headers, authorization: `Bearer ${access}` } });
  }
  async json(route, options) { const r = await this.call(route, options); try { return JSON.parse(r.bytes.toString()); } catch { throw failure('INVALID'); } }
  async list(subject) {
    if (!validSub(subject)) throw failure('INVALID');
    const found = []; let pageToken;
    for (let page = 0; page < 10; page++) {
      const q = `trashed = false and appProperties has { key='app' and value='${MARKER}' } and appProperties has { key='owner' and value='${sha(subject)}' }`;
      const params = new URLSearchParams({ spaces: 'appDataFolder', q, pageSize: '100', fields: 'nextPageToken,files(id,name,size,sha256Checksum,appProperties,trashed)', ...(pageToken ? { pageToken } : {}) });
      const r = await this.json(`drive/v3/files?${params}`, { limit: 262144 });
      if (!Array.isArray(r.files) || r.files.length > 100) throw failure('INVALID');
      for (const file of r.files) {
        const p = file.appProperties;
        if (!FILE.test(file.id) || !p || p.app !== MARKER || p.owner !== sha(subject) || !UUID.test(p.generationId) || !['pending', 'committed'].includes(p.status) || !/^[a-f0-9]{64}$/.test(p.digest) || file.trashed || !Number.isSafeInteger(Number(file.size)) || Number(file.size) <= 0 || Number(file.size) > 65536) throw failure('INVALID');
        if (found.some(f => f.id === file.id)) throw failure('INVALID');
        found.push(file);
      }
      if (!r.nextPageToken) return found;
      if (typeof r.nextPageToken !== 'string' || r.nextPageToken.length > 4096 || r.nextPageToken === pageToken) throw failure('INVALID');
      pageToken = r.nextPageToken;
    }
    throw new Error('복구 정보가 너무 많아 전체 목록을 확인하지 못했습니다.');
  }
  async read(file, subject) {
    if (!FILE.test(file?.id)) throw failure('INVALID');
    const r = await this.call(`drive/v3/files/${file.id}?alt=media`);
    if (r.bytes.length !== Number(file.size) || sha(r.bytes) !== file.appProperties.digest || (file.sha256Checksum && sha(r.bytes) !== file.sha256Checksum)) throw failure('INVALID');
    const e = parseEnvelope(r.bytes, subject);
    if (e.generationId !== file.appProperties.generationId) throw failure('INVALID');
    return e;
  }
  async publish(envelope) {
    const bytes = Buffer.from(JSON.stringify(envelope)); parseEnvelope(bytes, envelope.subject);
    const digest = sha(bytes), files = await this.list(envelope.subject);
    const existing = files.filter(f => f.appProperties.generationId === envelope.generationId);
    if (existing.length > 1) throw failure('INVALID');
    let file = existing[0];
    if (!file) {
      const boundary = `workbackup_${crypto.randomBytes(24).toString('hex')}`;
      const metadata = { name: `WorkBackup-${envelope.generationId}.json`, mimeType: 'application/json', parents: ['appDataFolder'], appProperties: { app: MARKER, owner: sha(envelope.subject), generationId: envelope.generationId, digest, status: 'pending' } };
      const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      file = await this.json('upload/drive/v3/files?uploadType=multipart&fields=id,name,size,sha256Checksum,appProperties', { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body });
    }
    if (file.appProperties?.digest !== digest) throw failure('INVALID');
    const readback = await this.read(file, envelope.subject);
    if (sha(JSON.stringify(readback)) !== digest) throw failure('INVALID');
    if (file.appProperties.status !== 'committed') {
      const result = await this.json(`drive/v3/files/${file.id}?fields=id,appProperties`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appProperties: { status: 'committed' } }) });
      if (result.id !== file.id || result.appProperties?.status !== 'committed' || result.appProperties.digest !== digest) throw failure('INVALID');
    }
    return { fileId: file.id, generationId: envelope.generationId, digest, verifiedAt: new Date().toISOString(), repositoryId: envelope.kit.repositoryId };
  }
}
module.exports = { DriveVault, parseEnvelope, validateReadKey, MARKER, sha };
