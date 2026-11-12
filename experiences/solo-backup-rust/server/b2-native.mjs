// Minimal Backblaze B2 native API (v4) client for the provisioning server and
// operator tools. Secrets never appear in errors or logs: an error carries only
// the HTTP status, B2's error code and B2's message.
// Docs: https://www.backblaze.com/apidocs (b2_authorize_account, b2_create_key v4).

const API = 'https://api.backblazeb2.com/b2api/v4';
const KEY_NAME = /^[A-Za-z0-9-]{1,100}$/;

export class B2Error extends Error {
  constructor(status, code, message) {
    super(`B2 ${status} ${code}${message ? `: ${String(message).slice(0, 300)}` : ''}`);
    this.name = 'B2Error'; this.status = status; this.code = code;
  }
}

async function readJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { code: 'non_json', message: text.slice(0, 200) }; }
}

// B2 closes idle keep-alive sockets and asks clients to retry 408/429/5xx
// (B2 integration checklist). Every call we make is safe to repeat: a repeated
// hide/copy adds one more version, a repeated version delete fails harmlessly.
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);
export async function withRetry(fn, { attempts = 4, baseMs = 1000, sleep = (ms) => new Promise((ok) => setTimeout(ok, ms)) } = {}) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      const transient = e instanceof B2Error ? RETRY_STATUS.has(e.status) : (e?.name === 'TypeError' || e?.name === 'AbortError' || e?.name === 'TimeoutError');
      if (!transient || i >= attempts) throw e;
      await sleep(baseMs * 2 ** (i - 1));
    }
  }
}

export async function authorize({ keyId, applicationKey }, { fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  if (typeof keyId !== 'string' || typeof applicationKey !== 'string' || !keyId || !applicationKey) throw new B2Error(0, 'bad_input', 'keyId and applicationKey are required');
  const { res, body } = await withRetry(async () => {
    const res = await fetchImpl(`${API}/b2_authorize_account`, {
      headers: { authorization: 'Basic ' + Buffer.from(`${keyId}:${applicationKey}`).toString('base64') },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await readJson(res);
    if (!res.ok) throw new B2Error(res.status, body.code || 'unknown', body.message);
    return { res, body };
  });
  const s = body.apiInfo?.storageApi;
  if (!s?.apiUrl || !body.authorizationToken) throw new B2Error(res.status, 'bad_response', 'storageApi missing');
  return new B2Session({ accountId: body.accountId, token: body.authorizationToken, apiUrl: s.apiUrl, downloadUrl: s.downloadUrl,
    s3ApiUrl: s.s3ApiUrl, allowed: s.allowed || {}, fetchImpl, timeoutMs });
}

export class B2Session {
  constructor({ accountId, token, apiUrl, downloadUrl, s3ApiUrl, allowed, fetchImpl, timeoutMs }) {
    Object.defineProperty(this, 'token', { value: token, enumerable: false });
    Object.assign(this, { accountId, apiUrl, downloadUrl, s3ApiUrl, allowed, fetchImpl, timeoutMs });
  }
  async call(name, body) {
    return withRetry(async () => {
      const res = await this.fetchImpl(`${this.apiUrl}/b2api/v4/${name}`, {
        method: 'POST', headers: { authorization: this.token, 'content-type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const json = await readJson(res);
      if (!res.ok) throw new B2Error(res.status, json.code || 'unknown', json.message);
      return json;
    });
  }
  get capabilities() { return [...(this.allowed.capabilities || [])]; }
  get region() { return /^https:\/\/s3\.([a-z]+-[a-z]+-\d{3})\.backblazeb2\.com$/.exec(this.s3ApiUrl || '')?.[1] || null; }

  listBuckets({ bucketName } = {}) { return this.call('b2_list_buckets', { accountId: this.accountId, ...(bucketName ? { bucketName } : {}) }); }
  createBucket({ bucketName, lifecycleRules }) {
    return this.call('b2_create_bucket', { accountId: this.accountId, bucketName, bucketType: 'allPrivate',
      defaultServerSideEncryption: { mode: 'SSE-B2', algorithm: 'AES256' }, lifecycleRules });
  }
  createKey({ keyName, capabilities, bucketIds, namePrefix, validDurationInSeconds }) {
    if (!KEY_NAME.test(keyName || '')) throw new B2Error(0, 'bad_input', 'keyName: letters, digits and - only');
    if (!Array.isArray(capabilities) || !capabilities.length) throw new B2Error(0, 'bad_input', 'capabilities required');
    return this.call('b2_create_key', { accountId: this.accountId, keyName, capabilities,
      ...(bucketIds?.length ? { bucketIds } : {}), ...(namePrefix ? { namePrefix } : {}),
      ...(validDurationInSeconds ? { validDurationInSeconds } : {}) });
  }
  deleteKey(applicationKeyId) { return this.call('b2_delete_key', { applicationKeyId }); }
  async listKeys() {
    const keys = []; let start = null;
    do {
      const r = await this.call('b2_list_keys', { accountId: this.accountId, maxKeyCount: 1000, ...(start ? { startApplicationKeyId: start } : {}) });
      keys.push(...(r.keys || [])); start = r.nextApplicationKeyId || null;
    } while (start);
    return keys;
  }
  // Every version under a prefix, in B2 order (name ascending, newest first per name).
  async listFileVersions({ bucketId, prefix }) {
    const files = []; let startFileName = null, startFileId = null;
    do {
      const r = await this.call('b2_list_file_versions', { bucketId, prefix, maxFileCount: 1000,
        ...(startFileName ? { startFileName, startFileId } : {}) });
      files.push(...(r.files || [])); startFileName = r.nextFileName || null; startFileId = r.nextFileId || null;
    } while (startFileName);
    return files;
  }
  hideFile({ bucketId, fileName }) { return this.call('b2_hide_file', { bucketId, fileName }); }
  deleteFileVersion({ fileName, fileId }) { return this.call('b2_delete_file_version', { fileName, fileId }); }
  copyFile({ sourceFileId, fileName }) { return this.call('b2_copy_file', { sourceFileId, fileName, metadataDirective: 'COPY' }); }
}
