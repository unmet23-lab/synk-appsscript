'use strict';
// The app's side of the provisioning server (STAGE1_DESIGN.md 4.5 「개통 서버 구현 설계」,
// API table). The server address is fixed in this file — it ships under Program Files,
// which a standard user cannot change — and is never read from a user-writable file
// (4.5 「서버 주소는 실행 파일에 박는다」). Only tests pass another `base`.
//
// Everything this PC holds for the account is ONE file, `device.bin`, DPAPI-protected
// through the host (`secretStore` = secret.encrypt / secret.decrypt) and always written
// whole with atomic() (4.5 「GPT 2차 검수 반영」, Fable 설계 관문 11-16):
//   { v: 2, customerId, deviceId, token, role, repository, sub, writer, googleStepRequired,
//     sameInstall: [deviceId…]      — this PC's earlier devices the server knows (newest first),
//     signup,                       — a sign-up whose result was not handed back yet
//     inflight: null | { op, at },  — a key request sent, its answer not stored yet
//     write: null | { keyId, applicationKey, acked, waitMs, waited },
//     read:  null | { keyId, applicationKey, acked, confirmed },
//     jobId, needs: [] }            — what this PC must ask again ('write-key', 'read-key', 'restore')
// Keys arrive, are stored unacknowledged in one write, and settle() acknowledges them; a
// stop anywhere leaves either no file, or a file whose keys settle() finishes. settle()
// runs first in every call. A key the server no longer takes is dropped and named in
// `needs`; a device the server dropped (unknown, abandoned, revoked, lost) is forgotten
// here (DEVICE_GONE) and a sign-up starts over. `install.bin` keeps one random install id
// across sign-ups so the server can drop this PC's own unfinished earlier device.
// A write key that replaced another waits `waitMs` (the server's figure) before it is used:
// a just-deleted B2 key works a few seconds more (11-13). The wait is timed on a monotonic
// clock from when the key arrived, so setting this PC's clock does not shorten it; after a
// restart nothing tells how long has passed, so a key not yet marked `waited` waits it all
// again (GPT 끝판 GA3).
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { atomic } = require('./paths.cjs');
const { serverCall } = require('./recovery-http.cjs');
const b2 = require('./b2.cjs');

const SERVER = 'https://workspace.synk.im/backup-api/v1/';
// The longest a new write key waits for the old one to stop working (the server asks 60 s).
const MAX_WAIT_MS = 120000;
const GRACE_MS = 60000; // a file from before `waitMs` was kept: wait the server's grace once
const REPO = /^c\/[a-z0-9]{16}\/r$/;
const ID12 = /^[a-z0-9]{12}$/, ID16 = /^[a-z0-9]{16}$/;
const INSTALL = /^[A-Za-z0-9_-]{22}$/;
const GONE_STATES = new Set(['abandoned', 'revoked', 'lost', 'customer', 'gone']);
const MESSAGES = {
  NOT_INVITED: '시범에 초대된 Google 계정으로 로그인해 주세요.',
  SUB_MISMATCH: '처음 연결한 Google 계정으로 로그인해 주세요.',
  LIMIT_DEVICES: '이 계정에 연결된 기기가 너무 많습니다. 쓰지 않는 기기를 먼저 끊어 주세요.',
  LIMIT_KEYS_DAY: '오늘은 더 연결할 수 없습니다. 내일 다시 시도해 주세요.',
  RATE: '요청이 너무 잦습니다. 잠시 뒤 다시 시도해 주세요.',
  BUSY: '이 계정의 다른 작업이 진행 중입니다. 잠시 뒤 다시 시도해 주세요.',
  DEVICE_STATE: '이 PC는 더 이상 이 계정에 연결되어 있지 않습니다.',
  DEVICE_GONE: '이 PC의 연결이 끝났습니다. 처음부터 다시 연결해 주세요.',
  KEY_GONE: '연결이 끝까지 되지 않았습니다. 다시 시도해 주세요.',
  TOO_OLD: '그 시각으로는 되돌릴 수 없습니다(29일까지).',
  NETWORK: '백업 서버에 연결하지 못했습니다. 인터넷 연결 후 다시 시도합니다.',
};
class ServerError extends Error {
  constructor(code, extra = {}) { super(MESSAGES[code] || '백업 서버 요청이 실패했습니다. 잠시 뒤 다시 시도해 주세요.'); this.code = code; this.extra = extra; }
}
const credentials = (k) => b2.credentials(k);
const keyOf = (k, extra) => ({ ...credentials(k), acked: false, ...extra });
// What a lost answer of each request leaves this PC to ask again.
const LOST = { 'take-write-seat': 'write-key', 'read-key-rotate': 'read-key', 'restore-run': 'restore' };

class ProvisionClient {
  constructor({ dir, secretStore, auth, call = serverCall, base = SERVER, now = () => Date.now(), mono = () => performance.now(), sleep = (ms) => new Promise((ok) => setTimeout(ok, ms)) }) {
    this.dir = dir; this.secretStore = secretStore; this.auth = auth; this.call = call; this.base = base; this.now = now; this.mono = mono; this.sleep = sleep;
    this.device = null; this.installId = null; this.busy = Promise.resolve();
    this.deadlines = new Map(); // write key id → monotonic time it may be used
  }
  file(name) { return path.join(this.dir, name); }
  async read(name) {
    try { return JSON.parse(await this.secretStore.decrypt(await fs.readFile(this.file(name)))); }
    catch (e) { if (e.code === 'ENOENT') return null; throw new ServerError('DEVICE_FILE'); }
  }
  async write(name, value) { await atomic(this.file(name), await this.secretStore.encrypt(JSON.stringify(value))); }
  // One change of device.bin at a time; this.device changes only after the file did.
  lock(fn) { const run = this.busy.then(fn, fn); this.busy = run.catch(() => {}); return run; }
  async update(change) {
    if (!this.device) throw new ServerError('DEVICE_STATE');
    const next = { ...this.device, ...change }; await this.write('device.bin', next); this.device = next; this.arm(); return next;
  }
  // A call that needs this device: inside the line, after settle().
  withDevice(fn) { return this.lock(async () => { if (!this.device) throw new ServerError('DEVICE_STATE'); await this.settle(); return fn(); }); }
  needs(add = [], remove = []) { const s = new Set(this.device?.needs || []); for (const x of add) s.add(x); for (const x of remove) s.delete(x); return [...s]; }

  async open() {
    await fs.mkdir(this.dir, { recursive: true });
    // An atomic() stopped half-way leaves its temporary file.
    for (const f of await fs.readdir(this.dir)) if (/^(device|install)\.bin\..+\.tmp$/.test(f)) await fs.rm(this.file(f), { force: true });
    const install = await this.read('install.bin');
    this.installId = INSTALL.test(install?.installId || '') ? install.installId : null;
    if (!this.installId) { this.installId = crypto.randomBytes(16).toString('base64url'); await this.write('install.bin', { installId: this.installId }); }
    const v = await this.read('device.bin');
    if (v && (!ID16.test(v.customerId) || !ID12.test(v.deviceId) || !/^wbd_[A-Za-z0-9_-]{43}$/.test(v.token) || !['write', 'read'].includes(v.role) || !REPO.test(v.repository?.prefix || '') || typeof v.sub !== 'string')) throw new ServerError('DEVICE_FILE');
    this.device = v;
    if (v && v.v !== 2) await this.importOld();
    // A request whose answer never got stored: this PC asks again for what it was getting.
    if (this.device?.inflight) await this.update({ inflight: null, needs: this.needs([LOST[this.device.inflight.op]].filter(Boolean)) });
    // Offline or refused now: the keys stay stored and the next call settles them.
    try { await this.lock(() => this.settle()); } catch (e) { if (!(e instanceof ServerError)) throw e; }
    return this.state();
  }
  // The 11-16 first version kept the keys in write-key.bin and read-key.bin. That version
  // could stop between storing a new key and acknowledging it, so every imported key is
  // acknowledged again (the server takes a repeat); its wait carries over. An unfinished
  // sign-up of it whose keys are not all there cannot be finished: it starts over.
  async importOld() {
    const w = await this.read('write-key.bin'), r = await this.read('read-key.bin');
    const mine = (x) => !!x && x.deviceId === this.device.deviceId;
    const unfinished = this.device.done === false, exp = this.device.expect;
    if (unfinished && (!exp || (exp.write && !mine(w)) || (exp.read && !mine(r)))) { await this.drop(); return; }
    await this.update({ v: 2, signup: unfinished, inflight: null, needs: [], jobId: null,
      // Its `usableAt` is a wall-clock time: the whole grace is waited once instead.
      write: mine(w) ? { ...credentials(w), acked: false, waitMs: Number.isSafeInteger(w.usableAt) && w.usableAt > 0 ? GRACE_MS : 0, waited: false } : null,
      read: mine(r) ? { ...credentials(r), acked: false, confirmed: false } : null });
    for (const f of ['write-key.bin', 'read-key.bin']) await fs.rm(this.file(f), { force: true });
  }
  state() {
    const d = this.device;
    return { connected: !!d, role: d?.role || null, deviceId: d?.deviceId || null, customerId: d?.customerId || null, repository: d?.repository || null, needs: d?.needs || [], jobId: d?.jobId || null,
      // As of the sign-up and this PC's own requests; status() has the account's live view.
      writer: d?.writer || null, googleStepRequired: !!d?.googleStepRequired, sameInstall: d?.sameInstall || [],
      // A customer read key this PC holds that the envelope does not carry yet (pendingReadKey()).
      readKeyPending: !!(d?.read?.acked && !d.read.confirmed) };
  }

  // Device requests run inside the line (withDevice, lock), so a refusal can change this.device.
  async request(method, route, body, { device = true } = {}) {
    if (device && !this.device) throw new ServerError('DEVICE_STATE');
    let r;
    // Offline, a time-out, a redirect, a cut or foreign answer: the server may or may not have acted.
    try { r = await this.call(this.base + route, { method, body, token: device ? this.device.token : null }); }
    catch (e) { throw new ServerError('NETWORK', { cause: typeof e?.code === 'string' ? e.code : null }); }
    if (!r.data?.ok) {
      const err = new ServerError(typeof r.data?.code === 'string' ? r.data.code : r.status >= 500 ? 'SERVER' : 'NETWORK', r.data || {});
      if (device) await this.gone(err);
      throw err;
    }
    return r.data;
  }
  // The server refused this device's token. Unknown, abandoned, revoked, lost: forget it here
  // (DEVICE_GONE). Moved: it reads only now — its write key and any unacknowledged key go.
  async gone(e) {
    if (e.code === 'DEVICE' || (e.code === 'DEVICE_STATE' && GONE_STATES.has(e.extra?.state))) { await this.drop(); throw new ServerError('DEVICE_GONE'); }
    // The server retired its unconfirmed read keys and a moved device cannot confirm one; what
    // it was to ask again (a seat, a key, a restore) was for the role it no longer has.
    if (e.code === 'DEVICE_STATE' && e.extra?.state === 'moved' && this.device) await this.update({ role: 'read', write: null, read: this.device.read?.confirmed ? this.device.read : null, needs: [], writer: null });
  }
  // Acknowledge every stored key the server has not counted yet; a key it no longer takes
  // is dropped and named in `needs`. Runs first in every call (inside the lock).
  async settle() {
    if (!this.device) return;
    const open = ['write', 'read'].filter((k) => this.device[k] && !this.device[k].acked);
    if (!open.length) return;
    let acked;
    try { ({ acked } = await this.request('POST', 'keys/ack', { keyIds: open.map((k) => this.device[k].keyId) })); }
    // A moved device cannot acknowledge; request() already cleared what it cannot use.
    catch (e) { if (e.code === 'DEVICE_STATE' && e.extra?.state === 'moved') return; throw e; }
    const change = {}, lost = [];
    for (const k of open) {
      if (acked.includes(this.device[k].keyId)) change[k] = { ...this.device[k], acked: true };
      else { change[k] = null; lost.push(k === 'write' ? 'write-key' : 'read-key'); }
    }
    await this.update({ ...change, needs: this.needs(lost) });
  }
  ready() { return this.lock(() => this.settle()); }
  // Stops a Google sign-in that waits for the browser (the request it was for fails with REAUTH).
  cancelSignIn() { this.auth?.cancel?.(); }
  call_(method, route, body) { return this.withDevice(() => this.request(method, route, body)); }
  // A Google sign-in bound to a server nonce for exactly this request.
  async proof(purpose, { hint } = {}) {
    const { nonce } = await this.request('POST', 'nonce', { purpose }, { device: false });
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(nonce)) throw new ServerError('SERVER');
    const signed = await this.auth.signIn({ nonce, expectedSub: this.device?.sub, ...(hint ? { hint } : {}) });
    return { google: { idToken: signed.idToken, nonce }, sub: signed.sub };
  }
  waitMsOf(r) { return Math.max(0, Math.min(Number.isSafeInteger(r.waitMs) ? r.waitMs : 0, MAX_WAIT_MS)); }
  // The monotonic wait of this device's write key starts when it is stored (or, after a
  // restart, when it is first seen again).
  arm() {
    const w = this.device?.write;
    if (w && !this.deadlines.has(w.keyId)) this.deadlines.set(w.keyId, this.mono() + this.waitOf(w));
  }
  waitOf(w) { return w.waited ? 0 : Number.isSafeInteger(w.waitMs) ? w.waitMs : w.waitUntil > 0 ? GRACE_MS : 0; }
  waitLeft(w) {
    if (!this.waitOf(w)) return 0;
    if (!this.deadlines.has(w.keyId)) this.deadlines.set(w.keyId, this.mono() + this.waitOf(w));
    return Math.min(this.deadlines.get(w.keyId) - this.mono(), MAX_WAIT_MS);
  }
  // A key request: `inflight` is stored before it is sent and cleared in the same write that
  // stores its answer, so a stop in between is known on the next open.
  async keyRequest(op, route, body, store) {
    await this.update({ inflight: { op, at: this.now() } });
    let r;
    try { r = await this.request('POST', route, body); }
    catch (e) {
      if (!this.device) throw e; // forgotten (DEVICE_GONE)
      // No answer, or not one from our server: it may or may not have happened — ask again later.
      if (e.code === 'NETWORK' || e.code === 'SERVER') await this.update({ inflight: null, needs: this.needs([LOST[op]]) });
      // A refusal: nothing changed there.
      else await this.update({ inflight: null });
      throw e;
    }
    await this.update({ inflight: null, ...store(r) });
    await this.settle();
    return r;
  }

  // Credentials for the engine's restic runs on this device (writer only, acknowledged
  // keys only). A key that replaced another waits here until it may be used.
  async writeCredentials() {
    for (let tries = 0; tries < 3; tries++) {
      const w = await this.ready().then(() => (this.device?.role === 'write' && this.device.write?.acked ? this.device.write : null));
      if (!w) return null;
      const left = this.waitLeft(w);
      if (left <= 0) return credentials(w);
      await this.sleep(left);
      // The wait happened outside the line: hand it out only if it is still the current key,
      // and remember that it waited (a restart then does not wait again).
      const done = await this.lock(async () => {
        const cur = this.device?.role === 'write' && this.device.write?.acked && this.device.write.keyId === w.keyId ? this.device.write : null;
        if (!cur || this.waitLeft(cur) > 0) return null;
        if (this.waitOf(cur)) await this.update({ write: { ...cur, waited: true } });
        return credentials(this.device.write);
      });
      if (done) return done;
    }
    return null;
  }
  // The customer read key this device received, acknowledged and not confirmed yet (the
  // envelope still has to be published with it), or null.
  pendingReadKey() { return this.ready().then(() => { const r = this.device?.read; return r && r.acked && !r.confirmed ? credentials(r) : null; }); }
  signupResult() { return { ...this.state(), readKey: this.device.read?.acked && !this.device.read.confirmed ? credentials(this.device.read) : null }; }

  // `hint`: the Google address Solio knows, only to pre-select the account (4.13 「로그인」).
  provision({ name, appVersion, hint }) {
    return this.lock(async () => {
      if (this.device) { try { await this.settle(); } catch (e) { if (e.code !== 'DEVICE_GONE') throw e; } }
      if (this.device) {
        // One device per PC profile; a sign-up whose result was not handed back finishes here.
        if (!this.device.signup) throw new ServerError('ALREADY');
        await this.update({ signup: false });
        return this.signupResult();
      }
      const { google, sub } = await this.proof('provision', { hint });
      const r = await this.request('POST', 'provision', { google, device: { name, appVersion, installId: this.installId } }, { device: false });
      if (!REPO.test(r.customer?.repository?.prefix || '') || !ID16.test(r.customer?.id || '') || !ID12.test(r.device?.id || '')) throw new ServerError('SERVER');
      // Device, token and every key in one write — nothing can be stored half.
      const next = { v: 2, customerId: r.customer.id, deviceId: r.device.id, token: r.device.token, role: r.device.role, name: String(name || ''),
        repository: { endpoint: b2.endpoint(r.customer.repository.endpoint), bucket: r.customer.repository.bucket, prefix: r.customer.repository.prefix }, sub,
        writer: r.writer && ID12.test(r.writer.id || '') ? { id: r.writer.id, name: String(r.writer.name || '') } : null, googleStepRequired: !!r.lost?.googleStepRequired,
        sameInstall: Array.isArray(r.sameInstall) ? r.sameInstall.map((x) => x?.id).filter((id) => ID12.test(id || '')).slice(0, 5) : [],
        signup: true, inflight: null, needs: [], jobId: null,
        write: r.keys.write ? keyOf(r.keys.write, { waitMs: this.waitMsOf(r), waited: false }) : null,
        read: r.keys.read ? keyOf(r.keys.read, { confirmed: false }) : null };
      await this.write('device.bin', next); this.device = next; this.arm();
      await this.settle();
      await this.update({ signup: false });
      return this.signupResult();
    });
  }
  takeWriteSeat() {
    return this.withDevice(async () => {
      const { google } = await this.proof('take-write-seat');
      const r = await this.keyRequest('take-write-seat', 'devices/take-write-seat', { google }, (a) => ({ role: 'write', writer: this.self(), write: keyOf(a.keys.write, { waitMs: this.waitMsOf(a), waited: false }), needs: this.needs([], ['write-key']) }));
      if (!this.device.write?.acked) throw new ServerError('KEY_GONE');
      return { previous: r.previous };
    });
  }
  self() { return { id: this.device.deviceId, name: this.device.name || null }; }
  status() { return this.call_('GET', 'status'); }
  devices() { return this.call_('GET', 'devices'); }
  // With a device, as that device. Without one (a new PC refused with LIMIT_DEVICES, whose
  // answer lists the devices), with the Google sign-in only — that cannot cut the active writer.
  revoke(deviceId) {
    return this.lock(async () => {
      if (this.device) await this.settle();
      const signInOnly = async () => { const { google } = await this.proof('revoke'); return this.request('POST', 'devices/revoke', { google, deviceId }, { device: false }); };
      let r;
      if (!this.device) r = await signInOnly();
      else {
        try { const { google } = await this.proof('revoke'); r = await this.request('POST', 'devices/revoke', { google, deviceId }); }
        catch (e) { if (e.code === 'DEVICE_STATE' && e.extra?.state === 'moved') r = await signInOnly(); else throw e; }
      }
      if (this.device?.deviceId === deviceId) await this.drop();
      return r;
    });
  }
  // From this device's app, for another (lost) device of the same account. The server
  // deletes every read key of the account, this device's unconfirmed one too (A4).
  lost(deviceId) {
    return this.lock(async () => {
      const { google } = await this.proof('lost');
      const other = async () => { if (this.device && this.device.deviceId !== deviceId) await this.update({ read: null, googleStepRequired: true, needs: this.needs(['read-key']) }); };
      let r;
      try { r = await this.request('POST', 'lost', { google, deviceId }, { device: false }); }
      catch (e) { if (e.code === 'NETWORK' || e.code === 'SERVER') await other(); throw e; }
      if (this.device?.deviceId === deviceId) await this.drop(); else await other();
      return r;
    });
  }
  rotateReadKey() {
    return this.withDevice(async () => {
      const { google } = await this.proof('read-key-rotate');
      const r = await this.keyRequest('read-key-rotate', 'read-key/rotate', { google }, (a) => ({ read: keyOf(a.keys.read, { confirmed: false }), googleStepRequired: !!a.googleStepRequired, needs: this.needs([], ['read-key']) }));
      if (!this.device.read?.acked) throw new ServerError('KEY_GONE');
      return { readKey: credentials(this.device.read), googleStepRequired: !!r.googleStepRequired };
    });
  }
  confirmReadKey(keyId) {
    return this.withDevice(async () => {
      const r = await this.request('POST', 'read-key/confirm', { keyId });
      // The server closes the Google step with the confirmation.
      if (this.device.read?.keyId === keyId) await this.update({ read: { ...this.device.read, confirmed: true }, googleStepRequired: false });
      return r;
    });
  }
  restorePlan(at) { return this.call_('POST', 'restore/plan', at === undefined ? {} : { at }); }
  restoreRun(at) {
    return this.withDevice(async () => {
      const { google } = await this.proof('restore-run');
      const r = await this.keyRequest('restore-run', 'restore/run', { google, at }, (a) => ({ role: 'write', writer: this.self(), jobId: a.jobId, needs: this.needs([], ['restore', 'write-key', 'read-key']),
        write: keyOf(a.keys.write, { waitMs: this.waitMsOf(a), waited: false }), read: keyOf(a.keys.read, { confirmed: false }) }));
      if (!this.device.write?.acked || !this.device.read?.acked) throw new ServerError('KEY_GONE');
      return { jobId: r.jobId, readKey: credentials(this.device.read) };
    });
  }
  restoreJob(jobId) { return this.call_('GET', `restore/job?id=${encodeURIComponent(jobId)}`); }
  restoreChoose(jobId, choice) {
    return this.withDevice(async () => {
      const body = { jobId, choice };
      if (choice === 'undo') body.google = (await this.proof('restore-undo')).google;
      return this.request('POST', 'restore/choose', body);
    });
  }
  // 옮겨 오기(4.6): this reading PC asks the writer to keep the snapshot it copies (7 days at most).
  pinMove(snapshotId) { return this.call_('POST', 'move/pin', { snapshotId }); }
  unpinMove() { return this.call_('POST', 'move/unpin', {}); }
  telemetry(batch) { return this.call_('POST', 'telemetry', batch); }
  help(text, bundle) { return this.call_('POST', 'help', { text, bundle }); }
  async drop() { for (const f of ['device.bin', 'write-key.bin', 'read-key.bin']) await fs.rm(this.file(f), { force: true }); this.device = null; }
  // This PC stops being a device of the account (uninstall, account switch). Server-side
  // revoke is a separate signed-in request; this only forgets the local secrets. The
  // install id stays, so a later sign-up of this PC can replace an unfinished one.
  forget() { return this.lock(() => this.drop()); }
}
module.exports = { ProvisionClient, ServerError, SERVER };
