'use strict';
// The app's side of the provisioning server (STAGE1_DESIGN.md 4.5 「개통 서버 구현 설계」,
// API table). The server address is fixed in this file — it ships under Program Files,
// which a standard user cannot change — and is never read from a user-writable file
// (4.5 「서버 주소는 실행 파일에 박는다」). Only tests pass another `base`.
// The device token and the device write key are kept DPAPI-protected through the
// host (`secretStore` = secret.encrypt / secret.decrypt), never in plain files.
// Every request that makes or moves keys acknowledges the keys it received right
// after storing them; a key the server did not count as acknowledged is reported
// as KEY_GONE so the caller asks again (the server deletes unacknowledged keys).
const fs = require('node:fs/promises');
const path = require('node:path');
const { atomic } = require('./paths.cjs');
const { serverCall } = require('./recovery-http.cjs');
const b2 = require('./b2.cjs');

const SERVER = 'https://workspace.synk.im/backup-api/v1/';
const REPO = /^c\/[a-z0-9]{16}\/r$/;
const ID12 = /^[a-z0-9]{12}$/, ID16 = /^[a-z0-9]{16}$/;
const MESSAGES = {
  NOT_INVITED: '시범에 초대된 Google 계정으로 로그인해 주세요.',
  SUB_MISMATCH: '처음 연결한 Google 계정으로 로그인해 주세요.',
  LIMIT_DEVICES: '이 계정에 연결된 기기가 너무 많습니다. 쓰지 않는 기기를 먼저 끊어 주세요.',
  LIMIT_KEYS_DAY: '오늘은 더 연결할 수 없습니다. 내일 다시 시도해 주세요.',
  RATE: '요청이 너무 잦습니다. 잠시 뒤 다시 시도해 주세요.',
  BUSY: '이 계정의 다른 작업이 진행 중입니다. 잠시 뒤 다시 시도해 주세요.',
  DEVICE_STATE: '이 PC는 더 이상 이 계정에 연결되어 있지 않습니다.',
  KEY_GONE: '연결이 끝까지 되지 않았습니다. 다시 시도해 주세요.',
  TOO_OLD: '그 시각으로는 되돌릴 수 없습니다(29일까지).',
  NETWORK: '백업 서버에 연결하지 못했습니다. 인터넷 연결 후 다시 시도합니다.',
};
class ServerError extends Error {
  constructor(code, extra = {}) { super(MESSAGES[code] || '백업 서버 요청이 실패했습니다. 잠시 뒤 다시 시도해 주세요.'); this.code = code; this.extra = extra; }
}
const credentials = (k) => b2.credentials(k);
const fileOf = (dir, name) => path.join(dir, name);

class ProvisionClient {
  constructor({ dir, secretStore, auth, call = serverCall, base = SERVER }) {
    this.dir = dir; this.secretStore = secretStore; this.auth = auth; this.call = call; this.base = base;
    this.device = null; this.busy = null;
  }
  async open() {
    await fs.mkdir(this.dir, { recursive: true });
    this.device = await this.load('device.bin', (v) => {
      if (!ID16.test(v.customerId) || !ID12.test(v.deviceId) || !/^wbd_[A-Za-z0-9_-]{43}$/.test(v.token) || !['write', 'read'].includes(v.role) || !REPO.test(v.repository?.prefix || '') || typeof v.sub !== 'string') throw new Error('DEVICE_FILE');
      return v;
    });
    return this.state();
  }
  async load(name, check) {
    try { return check(JSON.parse(await this.secretStore.decrypt(await fs.readFile(fileOf(this.dir, name))))); }
    catch (e) { if (e.code === 'ENOENT') return null; throw new ServerError('DEVICE_FILE'); }
  }
  async save(name, value) { await atomic(fileOf(this.dir, name), await this.secretStore.encrypt(JSON.stringify(value))); }
  state() { return { connected: !!this.device, role: this.device?.role || null, deviceId: this.device?.deviceId || null, customerId: this.device?.customerId || null, repository: this.device?.repository || null }; }

  async request(method, route, body, { device = true } = {}) {
    if (device && !this.device) throw new ServerError('DEVICE_STATE');
    const r = await this.call(this.base + route, { method, body, token: device ? this.device.token : null });
    if (!r.data?.ok) throw new ServerError(typeof r.data?.code === 'string' ? r.data.code : r.status >= 500 ? 'SERVER' : 'NETWORK', r.data || {});
    return r.data;
  }
  // A Google sign-in bound to a server nonce for exactly this request.
  async proof(purpose, { hint } = {}) {
    const { nonce } = await this.request('POST', 'nonce', { purpose }, { device: false });
    const signed = await this.auth.signIn({ nonce, expectedSub: this.device?.sub, ...(hint ? { hint } : {}) });
    return { google: { idToken: signed.idToken, nonce }, sub: signed.sub };
  }
  async ack(keys) {
    const ids = Object.values(keys || {}).map((k) => k.keyId);
    if (!ids.length) return;
    const { acked } = await this.request('POST', 'keys/ack', { keyIds: ids });
    if (ids.some((id) => !acked.includes(id))) throw new ServerError('KEY_GONE');
  }
  async saveWriteKey(key) { await this.save('write-key.bin', { ...credentials(key), customerId: this.device.customerId, deviceId: this.device.deviceId }); }
  // Credentials for the engine's restic runs on this device (writer only).
  async writeCredentials() {
    const v = await this.load('write-key.bin', (x) => { if (x.deviceId !== this.device?.deviceId) throw new Error('WRITE_KEY_FILE'); return x; });
    return v ? credentials(v) : null;
  }

  // `hint`: the Google address Solio knows, only to pre-select the account (4.13 「로그인」).
  async provision({ name, appVersion, hint }) {
    // One device per PC profile; a reinstall that lost its token makes a new device.
    if (this.device) throw new ServerError('ALREADY');
    const { google, sub } = await this.proof('provision', { hint });
    const r = await this.request('POST', 'provision', { google, device: { name, appVersion } }, { device: false });
    if (!REPO.test(r.customer?.repository?.prefix || '')) throw new ServerError('SERVER');
    // The device token is stored first: without it the keys below cannot be acknowledged.
    this.device = { customerId: r.customer.id, deviceId: r.device.id, token: r.device.token, role: r.device.role, repository: { endpoint: b2.endpoint(r.customer.repository.endpoint), bucket: r.customer.repository.bucket, prefix: r.customer.repository.prefix }, sub };
    await this.save('device.bin', this.device);
    if (r.keys.write) await this.saveWriteKey(r.keys.write);
    await this.ack(r.keys);
    return { ...this.state(), readKey: r.keys.read ? credentials(r.keys.read) : null, writer: r.writer, googleStepRequired: !!r.lost?.googleStepRequired };
  }
  async takeWriteSeat() {
    const { google } = await this.proof('take-write-seat');
    const r = await this.request('POST', 'devices/take-write-seat', { google });
    await this.saveWriteKey(r.keys.write);
    this.device = { ...this.device, role: 'write' }; await this.save('device.bin', this.device);
    await this.ack(r.keys);
    return { previous: r.previous };
  }
  status() { return this.request('GET', 'status'); }
  devices() { return this.request('GET', 'devices'); }
  async revoke(deviceId) { const { google } = await this.proof('revoke'); return this.request('POST', 'devices/revoke', { google, deviceId }); }
  // From this device's app, for another (lost) device of the same account.
  async lost(deviceId) { const { google } = await this.proof('lost'); return this.request('POST', 'lost', { google, deviceId }, { device: false }); }
  async rotateReadKey() {
    const { google } = await this.proof('read-key-rotate');
    const r = await this.request('POST', 'read-key/rotate', { google });
    await this.ack(r.keys);
    return { readKey: credentials(r.keys.read), googleStepRequired: !!r.googleStepRequired };
  }
  confirmReadKey(keyId) { return this.request('POST', 'read-key/confirm', { keyId }); }
  restorePlan(at) { return this.request('POST', 'restore/plan', at === undefined ? {} : { at }); }
  async restoreRun(at) {
    const { google } = await this.proof('restore-run');
    const r = await this.request('POST', 'restore/run', { google, at });
    await this.saveWriteKey(r.keys.write);
    this.device = { ...this.device, role: 'write' }; await this.save('device.bin', this.device);
    await this.ack(r.keys);
    return { jobId: r.jobId, readKey: credentials(r.keys.read) };
  }
  restoreJob(jobId) { return this.request('GET', `restore/job?id=${encodeURIComponent(jobId)}`); }
  async restoreChoose(jobId, choice) {
    const body = { jobId, choice };
    if (choice === 'undo') body.google = (await this.proof('restore-undo')).google;
    return this.request('POST', 'restore/choose', body);
  }
  // 옮겨 오기(4.6): this reading PC asks the writer to keep the snapshot it copies (7 days at most).
  pinMove(snapshotId) { return this.request('POST', 'move/pin', { snapshotId }); }
  unpinMove() { return this.request('POST', 'move/unpin', {}); }
  telemetry(batch) { return this.request('POST', 'telemetry', batch); }
  help(text, bundle) { return this.request('POST', 'help', { text, bundle }); }
  // This PC stops being a device of the account (uninstall, account switch). Server-side
  // revoke is a separate signed-in request; this only forgets the local secrets.
  async forget() { await fs.rm(fileOf(this.dir, 'write-key.bin'), { force: true }); await fs.rm(fileOf(this.dir, 'device.bin'), { force: true }); this.device = null; }
}
module.exports = { ProvisionClient, ServerError, SERVER };
