'use strict';
// 「Google로 시작」 · 「보호 시작」 and the account's other requests (STAGE1_DESIGN.md 2.1 · 4.5 · 4.6): the window's
// side of the provisioning server (provision-client.cjs), the account envelope v3 (recovery-service.cjs) and the cloud
// engine, in the order 4.5 asks — provision → repository → envelope published and read back → read key confirmed.
// The schedule and the first backup are the window's (protectNow). Nothing here hands a key, a token or the
// repository password to the screen: state() says only what the screen needs.
//
// What the screen must still see after the window is closed and opened again (Fable 개통 잇기 검토 지적 4 · 7 · 9)
// lives in `account-v3/view.json`, next to the Google sign-in: the server's last word on the Google step after a loss,
// on the read key and on a restore, the step a restore left, and the keys this PC must ask for again. None of it is a
// secret; the server stays the authority, and the window's next look writes it again.
const os = require('node:os');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const b2 = require('./b2.cjs');
const { atomic } = require('./paths.cjs');
const { GoogleAuth } = require('./recovery-auth.cjs');
const { ProvisionClient } = require('./provision-client.cjs');
const { EnvelopeV3 } = require('./recovery-service.cjs');

// This app's version as the provisioning server and its measurements see it.
const APP_VERSION = '0.7.0';
const DEVICE = /^[a-z0-9]{12}$/;
const JOB = /^[A-Za-z0-9_-]{1,64}$/;
const CODE = /^[A-Z][A-Z_]{1,31}$/;
const NEEDS = ['write-key', 'read-key', 'restore'];
const READ_KEY = ['ready', 'unconfirmed', 'missing'];
const RESTORE_STATES = ['preparing', 'running', 'done', 'continued', 'undone', 'failed'];
const MESSAGES = {
  NO_GOOGLE: '이 판에서는 Google로 시작할 수 없습니다.',
  NOT_SIGNED_IN: 'Google로 먼저 시작해 주세요.',
  NOT_WRITER: '이 계정의 백업은 다른 PC가 하고 있습니다.',
  OTHER_BACKUP: '이 PC에는 다른 백업이 연결되어 있습니다.',
  WRITE_KEY: '이 PC가 백업할 준비가 끝나지 않았습니다. 다시 시도해 주세요.',
  GOOGLE_STEP: 'Google 계정에서 잃어버린 기기의 접근을 먼저 지워 주세요.',
  ENVELOPE: '계정에 복구 정보를 남기지 못했습니다. 다시 시도해 주세요.',
  NO_ENVELOPE: '이 계정의 복구 정보를 찾지 못했습니다.',
  READ_KEY: '이 계정의 백업을 읽을 권한을 새로 받아야 합니다.',
  CANCELED: 'Google 로그인을 그만두었습니다.',
  BAD_INPUT: '요청을 확인하지 못했습니다.',
};
const failure = (code) => Object.assign(new Error(MESSAGES[code]), { code });
// A server answer that says no job started: the hold written before it can go. A Google sign-in that did not finish
// (REAUTH, CANCELED) comes before the request is sent.
const DEFINITE = new Set(['NOT_INVITED', 'SUB_MISMATCH', 'NONCE', 'TOKEN', 'DEVICE', 'DEVICE_STATE', 'RATE', 'BUSY', 'TOO_OLD', 'BAD_INPUT', 'NOT_FOUND', 'ACCOUNT', 'DENIED', 'CANCELED', 'REAUTH']);
// The repository place as the envelope holds it (exactly these three, 「봉투 v3의 꼴」).
const place = (provider) => ({ endpoint: provider.endpoint, bucket: provider.bucket, prefix: provider.prefix });
// A device list as the screen gets it: the server's fields that name and date a device, nothing else.
const text = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
const ms = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const listed = (devices) => (Array.isArray(devices) ? devices.slice(0, 50) : []).filter((d) => d && DEVICE.test(d.id || '')).map((d) => ({
  id: d.id, name: text(d.name, 64) || '', role: d.role === 'write' ? 'write' : 'read', state: text(d.state, 16), createdAt: ms(d.createdAt), lastSeenAt: ms(d.lastSeenAt), current: d.current === true }));
// A restore as the screen gets it, from the server status (`restore`) or a job (`restore/job`).
const restoreView = (r) => (r && typeof r === 'object' && JOB.test(r.jobId || r.id || '') ? {
  jobId: r.jobId || r.id, state: RESTORE_STATES.includes(r.state) ? r.state : null, awaitingChoice: r.awaitingChoice === true,
  at: ms(r.at), byThisDevice: typeof r.byThisDevice === 'boolean' ? r.byThisDevice : null,
  error: typeof r.error === 'string' && /^[A-Z][A-Z_]{1,39}$/.test(r.error) ? r.error : null, undo: r.undo === true || JOB.test(r.undoOf || '') } : null);
// A received read key the account lost is named by a fingerprint of its id only (the view holds no key).
const mark = (k) => (k?.keyId ? crypto.createHash('sha256').update(`solo-work-backup-dead-read-key\0${k.keyId}`).digest('hex').slice(0, 32) : null);
const writerOf = (w) => (w && typeof w === 'object' && typeof w.name === 'string' ? { id: DEVICE.test(w.id || '') ? w.id : null, name: w.name.slice(0, 64) } : null);
// The kept view, read back as untrusted input (a damaged file is the same as none).
function cleanInfo(v) {
  const o = v && typeof v === 'object' ? v : {};
  return { googleStepRequired: o.googleStepRequired === true, writer: writerOf(o.writer), readKey: READ_KEY.includes(o.readKey) ? o.readKey : null,
    restore: restoreView(o.restore), left: typeof o.left === 'string' && CODE.test(o.left) ? o.left : null,
    needs: Array.isArray(o.needs) ? NEEDS.filter((x) => x !== 'restore' && o.needs.includes(x)) : [], readKeyHeld: false,
    deadReadKey: typeof o.deadReadKey === 'string' && /^[a-f0-9]{32}$/.test(o.deadReadKey) ? o.deadReadKey : null };
}

// The server status (GET status) as the writer's engine needs it (4.5 「회차 실행기」 · 4.6 N2), for the run and the
// window alike: a seat that moved makes this PC rest and say so; a restore running or waiting for the choice, or an
// account over its limit, holds this run (accountHold — not written down); the snapshot a reading PC copies is pinned
// in the cleanup. Only this device's backup of the customer repository is touched.
// The sticky hold of a restore this PC asked for (`serverRestore`) follows the server too (Fable 지적 4 · 5): the job
// the status shows for this device is adopted (an answer that was lost, an undo), and a hold whose job is no longer
// open goes — the restore was continued, undone or failed. Whoever writes these settings holds the engine lock (the
// run, the window), so no restore request of this PC is on its way while this runs. A status without the `restore`
// field says nothing about it. The answer says what happened to the hold, for the window.
async function applyStatus(engine, status, deviceId) {
  const c = engine.config;
  if (!status || typeof status !== 'object' || !c?.repositoryId || c.mode !== 'backup' || !b2.customerRepository(c.provider?.prefix) || c.host !== deviceId) return false;
  const d = status.device || {};
  if (d.state === 'moved') await engine.markMoved({ device: text(d.movedTo?.name, 64) || '', at: new Date().toISOString() });
  else if (d.state === 'active' && c.movedTo) await engine.clearMoved();
  const r = status.restore;
  engine.accountHold = r && (['preparing', 'running'].includes(r.state) || r.awaitingChoice === true) ? 'restore' : status.customer?.overQuota === true ? 'over-quota' : null;
  const followed = {};
  const hold = c.serverRestore;
  if (hold && Object.prototype.hasOwnProperty.call(status, 'restore')) {
    const open = r && typeof r === 'object' && ['preparing', 'running', 'done'].includes(r.state) && JOB.test(r.jobId || '') ? r : null;
    if (open && open.jobId === hold.jobId) { /* still this one */ }
    else if (open && open.byThisDevice === true) {
      await engine.holdForServerRestore({ jobId: open.jobId, undo: !!hold.jobId });
      Object.assign(followed, { adopted: open.jobId, hadJob: !!hold.jobId });
    } else { await engine.releaseServerRestore(); followed.released = hold.jobId || null; }
  }
  const m = status.move;
  const until = m && (Number.isSafeInteger(m.until) ? m.until : Date.parse(m.until));
  await engine.setMovePin(m && m.byThisDevice !== true && /^[a-f0-9]{64}$/.test(m.snapshotId || '') && Number.isFinite(until) ? { snapshotId: m.snapshotId, until: new Date(until).toISOString() } : null);
  return followed;
}
// One run as the server's measurement intake takes it (서버API.md 「측정 받는 꼴」): fixed words and whole numbers
// only. A test run is not sent. `result` is the cloud profile's run result, `fill` its fill (if one was asked).
const PAUSES = { battery: 'battery', saver: 'saver', metered: 'metered' };
function telemetryRun({ trigger, startedAt, result, fill = null, skipCloud = null, maxRssKb = null, cpuMs = null }) {
  if (!['hourly', 'logon', 'wake', 'unlock', 'manual'].includes(trigger) || !result || !Number.isSafeInteger(startedAt)) return null;
  const n = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : undefined);
  const outcome = result.outcome === 'skipped' && result.reason === 'paused' ? 'paused' : result.outcome;
  if (!['complete', 'partial', 'skipped', 'failed', 'busy', 'not-due', 'paused'].includes(outcome)) return null;
  const pause = PAUSES[skipCloud] || (result.reason === 'clock' ? 'clock' : result.reason === 'paused' ? 'user' : 'none');
  const item = { trigger, startedAt, result: outcome, pause, durationMs: n(result.durationMs), exitCode: Number.isSafeInteger(result.exitCode) && result.exitCode >= -1 && result.exitCode <= 255 ? result.exitCode : undefined,
    unreadable: n(result.unreadable), peakMemory: n(Number.isSafeInteger(maxRssKb) ? maxRssKb * 1024 : null), cpuMs: n(cpuMs),
    resticStartMs: Number.isSafeInteger(result.resticStartedAt) && result.resticStartedAt >= startedAt ? result.resticStartedAt - startedAt : undefined };
  const files = { new: n(result.filesNew), changed: n(result.filesChanged), unmodified: n(result.filesUnmodified) };
  if (Object.values(files).every((v) => v !== undefined)) item.files = files;
  if (n(result.dataAdded) !== undefined && n(result.bytes) !== undefined) item.bytes = { added: result.dataAdded, processed: result.bytes };
  if (result.fill) item.fill = { tried: !!fill, result: !fill ? 'none' : fill.outcome === 'fill' ? 'done' : fill.outcome === 'skipped' ? 'skipped' : 'failed' };
  for (const k of Object.keys(item)) if (item[k] === undefined) delete item[k];
  return item;
}

class Account {
  /** `engine` is the cloud profile's BackupEngine. `make` replaces the three parts in tests. */
  constructor({ root, secretStore, client = null, openExternal, engine, deviceName = os.hostname(), appVersion, make = {} }) {
    this.engine = engine; this.appVersion = appVersion;
    this.deviceName = String(deviceName || 'PC').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 64) || 'PC';
    this.auth = make.auth ? make.auth() : client ? new GoogleAuth({ dir: path.join(root, 'account-v3'), secretStore, client, openExternal }) : null;
    this.provision = make.provision ? make.provision(this.auth) : new ProvisionClient({ dir: path.join(root, 'device'), secretStore, auth: this.auth });
    this.envelope = make.envelope ? make.envelope(this.auth) : new EnvelopeV3({ root, secretStore, auth: this.auth });
    this.viewFile = path.join(root, 'account-v3', 'view.json');
    this.info = cleanInfo(null);
    this.damaged = [];
    this.cancelled = false;
  }
  // A damaged device or envelope file does not stop the window: the screen offers 「Google로 시작」 again.
  async open() {
    for (const [name, part] of [['google', this.auth], ['device', this.provision], ['envelope', this.envelope]]) {
      if (!part) continue;
      try { await part.open(); } catch { this.damaged.push(name); }
    }
    try { this.info = cleanInfo(JSON.parse(await fs.readFile(this.viewFile, 'utf8'))); } catch { /* none yet, or damaged: the next look writes it */ }
    if (this.provision.state().connected) await this.note();
    return this.state();
  }
  // The kept view (best effort: the server and device.bin stay the authority).
  async keep() {
    const { readKeyHeld, ...kept } = this.info;
    try { await fs.mkdir(path.dirname(this.viewFile), { recursive: true }); await atomic(this.viewFile, JSON.stringify(kept)); } catch { /* the next change writes it */ }
  }
  // Whether this PC holds a received read key the envelope does not carry yet (device.bin), then keep the view.
  async note() {
    try { this.info.readKeyHeld = !!(await this.fresh()); } catch { /* as it was */ }
    await this.keep();
  }
  // The read key this PC received and has not put in an envelope yet — unless the account lost it since (GPT
  // workbackup-ui2 GA1): a loss report removes every read key of the account on the server, and the one kept here
  // stays in device.bin. A dead one is never published, opened with or used again instead of asking for a new one.
  async fresh() { const k = await this.provision.pendingReadKey(); return k && mark(k) === this.info.deadReadKey ? null : k; }
  async lostKey() { let k = null; try { k = await this.provision.pendingReadKey(); } catch { /* none known */ } if (k) this.info.deadReadKey = mark(k); }
  // The server's word on a loss and on the read key. A loss newly heard of, or no live read key at all, means the
  // read key kept here is gone. A key received after the loss came with its Google step already known, so it stays.
  async heard(s) {
    if (!s || typeof s !== 'object') return;
    const lost = s.lost?.googleStepRequired === true;
    if ((lost && !this.info.googleStepRequired) || s.readKey === 'missing') await this.lostKey();
    this.info.googleStepRequired = lost;
    this.info.readKey = READ_KEY.includes(s.readKey) ? s.readKey : null;
  }
  // A restore holds this PC (the window looks each minute then, 4.5).
  holding() { return !!this.engine.config?.serverRestore || this.engine.accountHold === 'restore'; }
  state() {
    const g = this.auth?.getState() || { available: false, connected: false, email: null };
    const p = this.provision.state(), e = this.envelope.getState();
    const hold = this.engine.config?.serverRestore || null;
    // `needs`: what this PC must ask the server again — 'write-key' (takeWriteSeat), 'read-key' (rotateReadKey),
    // 'restore' (a restore request whose answer was lost and whose job the window has not found yet).
    const needs = [...new Set([...(Array.isArray(p.needs) ? p.needs : []).filter((x) => NEEDS.includes(x) && (x !== 'restore' || (hold && !hold.jobId))), ...this.info.needs])];
    // `restore`: the restore that holds this PC or that the server last reported. A job the hold names but the window
    // has not read yet shows its number only.
    const held = !!hold || this.engine.accountHold === 'restore';
    const v = this.info.restore && (!hold?.jobId || this.info.restore.jobId === hold.jobId) ? this.info.restore : null;
    const restore = held || v ? { hold: held, jobId: hold?.jobId || v?.jobId || null, state: v?.state || null, awaitingChoice: !!v?.awaitingChoice, at: v?.at ?? null,
      byThisDevice: v ? v.byThisDevice : hold ? true : null, error: v?.error || null, undo: !!hold?.undo || !!v?.undo } : null;
    return { available: !!this.auth, signedIn: !!g.connected, email: g.email || null, connected: p.connected, role: p.role, deviceId: p.deviceId,
      device: this.deviceName, writer: this.info.writer?.name || null, googleStepRequired: this.info.googleStepRequired || p.googleStepRequired === true, needs,
      readKey: this.info.readKey, readKeyPending: this.info.readKeyHeld, left: this.info.left, restore,
      envelope: e.verified ? { verifiedAt: e.verified.verifiedAt } : null, envelopeInvalid: !!e.invalid, damaged: [...this.damaged] };
  }
  need({ device = true } = {}) {
    if (!this.auth) throw failure('NO_GOOGLE');
    const p = this.provision.state();
    if (device && !p.connected) throw failure('NOT_SIGNED_IN');
    return p;
  }
  // A request that asks for a Google sign-in. 「그만두기」 (cancelSignIn) ends the browser wait; the request then ends
  // as CANCELED (Fable 지적 10). The window runs one such request at a time.
  async google(fn) {
    this.cancelled = false;
    try { return await fn(); } catch (e) { if (this.cancelled && e.code === 'REAUTH') throw failure('CANCELED'); throw e; } finally { this.cancelled = false; }
  }
  cancelSignIn() { this.cancelled = true; this.auth?.cancel?.(); }

  // 「Google로 시작」: this PC becomes a device of the account. A device already made here is kept (one per Windows
  // profile); `hint` is the Google address Solio knows, only to pre-select the account.
  // A sign-up stopped after the device was stored is finished without a new sign-in (provision() does that).
  async signIn({ hint } = {}) {
    this.need({ device: false });
    if (hint !== undefined && (typeof hint !== 'string' || hint.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(hint))) throw failure('BAD_INPUT');
    let r;
    try { r = await this.google(() => this.provision.provision({ name: this.deviceName, appVersion: this.appVersion, ...(hint ? { hint } : {}) })); }
    catch (e) {
      if (e.code === 'ALREADY') return this.state();
      // The account is full: the screen shows its devices so a dead one can be cut off first.
      if (e.code === 'LIMIT_DEVICES') e.details = { devices: listed(e.extra?.devices) };
      throw e;
    }
    Object.assign(this.info, { googleStepRequired: !!r.googleStepRequired, writer: writerOf(r.writer), needs: [], left: null });
    await this.note();
    return this.state();
  }

  // 「보호 시작」 up to the first backup: the repository (made here, never over an existing one — REPO_EXISTS), then
  // the envelope. Called again after a failure it goes on from where it stopped.
  async startProtection({ sources, googleStepDone = false } = {}) {
    const p = this.need();
    if (p.role !== 'write') throw failure('NOT_WRITER');
    const e = this.engine;
    if (!e.config?.repositoryId) {
      const credentials = await this.provision.writeCredentials();
      if (!credentials) throw failure('WRITE_KEY');
      await e.setupCloud({ sources, repository: p.repository, credentials, host: p.deviceId });
    } else this.ours();
    await this.publishEnvelope({ googleStepDone });
    return this.state();
  }
  // The account already has a backup (REPO_EXISTS — the same PC reinstalled, or the old writer was cut off): open it
  // from the envelope and go on backing it up from here as this device (2.3 「되살리지 않고 이어서 백업」).
  async continueBackup({ sources, googleStepDone = false } = {}) {
    const p = this.need();
    if (p.role !== 'write') throw failure('NOT_WRITER');
    const e = this.engine;
    const fromEnvelope = !e.config || e.config.mode === 'restore';
    if (!e.config) await this.openBackup();
    if (e.config.mode === 'restore') {
      const credentials = await this.provision.writeCredentials();
      if (!credentials) throw failure('WRITE_KEY');
      await e.becomeWriter({ sources: Array.isArray(sources) && sources.length ? sources : e.config.nextSources || [], credentials, host: p.deviceId });
    } else this.ours();
    // The envelope this backup was opened from is its recovery; a read key still to confirm gets a new one.
    // The Google step after a loss holds here too (GPT workbackup-account GA2): the person says it is done.
    // A backup made here whose envelope never went up has no recovery to mark: it needs a read key first.
    if (await this.fresh()) await this.publishEnvelope({ googleStepDone });
    else if (!e.hasRecovery()) {
      if (!fromEnvelope) throw failure(this.info.deadReadKey ? 'READ_KEY' : 'ENVELOPE');
      await e.markEnvelope({ verifiedAt: new Date().toISOString() });
    }
    await this.note();
    return this.state();
  }
  // A PC that does not write (role read) opens the account's backup restore-only, for 옮겨 오기 (4.6). After a loss
  // report the read key in the envelope is gone: a new one this PC received since opens it (Fable 지적 6), and
  // without one the screen first asks for it (READ_KEY → rotateReadKey).
  async openBackup() {
    const p = this.need();
    if (this.engine.config) throw failure('OTHER_BACKUP');
    const v = await this.envelopeOf(p);
    let fresh = await this.fresh();
    if (!fresh) {
      // The server's word, not this window's memory: after a loss report the envelope's key is gone until a new envelope
      // is confirmed, and the Google step stays until then.
      let s = null;
      try { s = await this.provision.status(); } catch { /* the last word kept */ }
      await this.heard(s);
      if (this.info.readKey === 'missing' || (s ? s.lost?.googleStepRequired === true : false)) { await this.keep(); throw failure('READ_KEY'); }
      fresh = await this.fresh();
    }
    await this.engine.importRepository({ repository: v.repository, repositoryId: v.repositoryId, password: v.password, credentials: fresh || v.readKey });
    await this.note();
    return this.state();
  }
  // The account's envelope for the customer this device belongs to.
  async envelopeOf(p) {
    const found = (await this.envelope.discover()).find((x) => x.customer === p.customerId);
    if (!found) throw failure('NO_ENVELOPE');
    const v = await this.envelope.read(found.fileId);
    if (v.repository.prefix !== p.repository.prefix || v.repository.bucket !== p.repository.bucket) throw failure('NO_ENVELOPE');
    return v;
  }
  ours() {
    const c = this.engine.config, p = this.provision.state();
    if (c.host !== p.deviceId || c.provider?.prefix !== p.repository?.prefix) throw failure('OTHER_BACKUP');
  }
  // The read key this device received goes into a new envelope, which is read back, and only then is the key
  // confirmed to the server (it retires the old one after that). 2.4 (5)(나): after a loss report the customer
  // first removes the lost device's Google access — that screen cannot be skipped, whatever this window remembers:
  // without the person's word the server is asked first (Fable 지적 7).
  // A PC with no backup set up (a new PC after a loss) writes the envelope from the one it replaces.
  async publishEnvelope({ googleStepDone }) {
    const e = this.engine, p = this.provision.state();
    let readKey = await this.fresh();
    if (!readKey) { if (!e.config?.repositoryId || !e.hasRecovery()) throw failure(this.info.deadReadKey ? 'READ_KEY' : 'ENVELOPE'); return; }
    if (googleStepDone !== true) {
      if (this.info.googleStepRequired || p.googleStepRequired === true) throw failure('GOOGLE_STEP');
      await this.heard(await this.provision.status());
      await this.keep();
      if (this.info.googleStepRequired) throw failure('GOOGLE_STEP');
      // A loss the server reports with the key already gone: this key must not go into an envelope.
      readKey = await this.fresh();
      if (!readKey) throw failure('READ_KEY');
    }
    let target;
    if (e.config?.repositoryId) {
      if (e.config.provider?.prefix !== p.repository?.prefix || !e.secret) throw failure('OTHER_BACKUP');
      target = { repository: place(e.config.provider), repositoryId: e.config.repositoryId, password: e.secret };
    } else {
      const v = await this.envelopeOf(p);
      target = { repository: v.repository, repositoryId: v.repositoryId, password: v.password };
    }
    const published = await this.envelope.publish({ ...target, readKey });
    if (!published.verified?.verifiedAt) throw failure('ENVELOPE');
    if (e.config?.repositoryId) {
      await e.markEnvelope({ verifiedAt: published.verified.verifiedAt });
      // A restore-only connection reads with the customer read key itself: it moves to the new key before the server
      // may retire the old one (GPT workbackup-account GA3). A writer reads and writes with its own write key.
      if (e.config.mode === 'restore') await e.updateCloudCredentials(readKey);
    }
    await this.provision.confirmReadKey(readKey.keyId);
    Object.assign(this.info, { googleStepRequired: false, left: null, readKey: 'ready', readKeyHeld: false, deadReadKey: null, needs: this.info.needs.filter((x) => x !== 'read-key') });
    await this.keep();
  }
  // The keys a restore (or a rotation) brought: the engine writes with the new write key and the new read key goes
  // into the envelope. A step that could not be done is named (`left`, kept) and done again by the window's next look
  // or by rotateReadKey, which reuses the received read key.
  async finishKeys() {
    const e = this.engine;
    try {
      const credentials = await this.provision.writeCredentials();
      if (credentials && e.config?.mode === 'backup' && e.cloudCredentials?.keyId !== credentials.keyId) await e.updateCloudCredentials(credentials);
      await this.publishEnvelope({ googleStepDone: false });
      this.info.left = null;
    } catch (error) { this.info.left = CODE.test(error.code || '') ? error.code : 'ENVELOPE'; }
    await this.note();
    return this.info.left;
  }

  async devices() {
    this.need();
    return listed((await this.provision.devices()).devices);
  }
  // 옮겨 오기 끝 「옛 PC 연결 끊기 — 예」, a moved PC's 「이 PC로 다시 백업」, or a writer's 「쓰기 출입증 다시 받기」.
  // A reading PC's folders are checked before the old PC loses its seat (Fable 지적 1): the ones given, or the ones
  // chosen and kept in its settings (`nextSources`).
  async takeWriteSeat({ sources } = {}) {
    this.need();
    const e = this.engine;
    const reader = e.config?.mode === 'restore' && b2.customerRepository(e.config.provider?.prefix);
    const chosen = reader ? await e.checkSources(Array.isArray(sources) && sources.length ? sources : e.config.nextSources || []) : null;
    const r = await this.google(() => this.provision.takeWriteSeat());
    const credentials = await this.provision.writeCredentials(), p = this.provision.state();
    if (!credentials) throw failure('WRITE_KEY');
    if (reader) await e.becomeWriter({ sources: chosen, credentials, host: p.deviceId });
    else if (e.config?.repositoryId) { this.ours(); await e.updateCloudCredentials(credentials); await e.clearMoved(); }
    this.info.needs = this.info.needs.filter((x) => x !== 'write-key');
    await this.note();
    return { previous: typeof r.previous?.name === 'string' ? r.previous.name.slice(0, 64) : null, ...this.state() };
  }
  async revokeDevice(deviceId) {
    this.need({ device: false });
    if (!DEVICE.test(deviceId || '')) throw failure('BAD_INPUT');
    const r = await this.google(() => this.provision.revoke(deviceId));
    return { suggestReadKeyRotation: !!r.suggestReadKeyRotation };
  }
  async reportLost(deviceId) {
    this.need({ device: false });
    if (!DEVICE.test(deviceId || '')) throw failure('BAD_INPUT');
    const r = await this.google(() => this.provision.lost(deviceId));
    // Every read key of the account is gone with the report (server 「POST lost」), the one kept here too: this PC asks
    // for a new one (GPT workbackup-ui2 GA1).
    await this.lostKey();
    Object.assign(this.info, { googleStepRequired: true, readKey: 'missing' });
    await this.note();
    const url = typeof r.googleRemovalUrl === 'string' && /^https:\/\/myaccount\.google\.com\//.test(r.googleRemovalUrl) ? r.googleRemovalUrl : null;
    return { next: r.next === 'read-key-rotate' ? 'read-key-rotate' : null, googleRemovalUrl: url };
  }
  // A read key already received and not confirmed is used again rather than asking for another. A PC with no backup
  // set up writes the new envelope from the old one (Fable 지적 6), so it can open the backup with it afterwards.
  async rotateReadKey({ googleStepDone = false } = {}) {
    this.need();
    if (!await this.fresh()) {
      const r = await this.google(() => this.provision.rotateReadKey());
      if (r.googleStepRequired) this.info.googleStepRequired = true;
      await this.note();
    }
    await this.publishEnvelope({ googleStepDone });
    return this.state();
  }

  // 되돌리기(4.5 restore/*). The hold is written before the request and keeps the job's number once it has one; it goes
  // when the restore is no longer open (the choice, an undo that ended, a failure — applyStatus) and at once when the
  // server refused the request, which started nothing.
  async restorePlan(at) { this.need(); if (at !== undefined && !Number.isSafeInteger(at)) throw failure('BAD_INPUT'); return this.provision.restorePlan(at); }
  async restoreRun(at) {
    this.need();
    if (!Number.isSafeInteger(at)) throw failure('BAD_INPUT');
    const e = this.engine;
    if (!e.config?.repositoryId) throw failure('NOT_SIGNED_IN');
    this.ours();
    // A hold already here belongs to a restore asked before (its answer lost, or awaiting the choice): a refusal of this
    // new request says nothing about that one, so only a hold this request wrote goes (GPT workbackup-account GA1).
    const earlier = !!e.config.serverRestore;
    if (!earlier) await e.holdForServerRestore();
    let r;
    try { r = await this.google(() => this.provision.restoreRun(at)); }
    catch (error) { if (!earlier && DEFINITE.has(error.code)) await e.releaseServerRestore(); throw error; }
    await e.holdForServerRestore({ jobId: r.jobId });
    this.info.restore = { jobId: r.jobId, state: 'running', awaitingChoice: false, at, byThisDevice: true, error: null, undo: false };
    // The server gave new keys with the job. The job has started either way, so its number always comes back; a step
    // that could not be done here is named (`left`).
    const left = await this.finishKeys();
    return left ? { jobId: r.jobId, left } : { jobId: r.jobId };
  }
  // The window's look at the account (when it opens, each hour while it is open, each minute while a restore holds
  // it): the server status goes to the engine as in a run, the Google step after a loss and the read key come back
  // from the server, a restore's keys left undone are finished, and a read key the server still counts as unconfirmed
  // is published and confirmed when this PC holds it. Once a day the envelope is read back (4.5 「봉투 매일 재확인」);
  // one that is gone or different is marked for 「다시 로그인」 (envelopeInvalid).
  async refresh({ recheck = false } = {}) {
    const p = this.provision.state();
    if (!this.auth || !p.connected) return this.state();
    const status = await this.provision.status();
    const e = this.engine;
    const followed = await applyStatus(e, status, p.deviceId);
    await this.heard(status);
    if (status.writer && typeof status.writer === 'object') this.info.writer = writerOf(status.writer);
    // The restore as the server tells it. A hold that went is read once more for how its job ended; a failure stays
    // to be read until another restore (the screen offers 「다시 되돌리기」, INTERRUPTED included).
    let view = Object.prototype.hasOwnProperty.call(status, 'restore') ? restoreView(status.restore) : this.info.restore;
    if (followed?.released) { try { const end = restoreView(await this.provision.restoreJob(followed.released)); if (end?.state === 'failed') view = end; } catch { /* the job is not read again */ } }
    if (!view && this.info.restore?.state === 'failed') view = this.info.restore;
    this.info.restore = view;
    // A restore whose answer was lost: its keys never reached this PC (the server replaced the write keys).
    if (followed?.adopted && !followed.hadJob && p.jobId !== followed.adopted) this.info.needs = [...new Set([...this.info.needs, 'write-key', 'read-key'])];
    if (e.config?.repositoryId && b2.customerRepository(e.config.provider?.prefix) && this.auth.getState().connected) {
      const keys = (followed?.adopted && p.jobId === followed.adopted) || this.info.left || (status.readKey === 'unconfirmed' && await this.fresh());
      if (keys && !this.info.googleStepRequired) await this.finishKeys();
      else if (recheck && this.envelope.getState().verified) {
        const checked = await this.envelope.recheck({ repositoryId: e.config.repositoryId, password: e.secret });
        if (checked.verified?.verifiedAt) await e.markEnvelope({ verifiedAt: checked.verified.verifiedAt });
      }
    }
    await this.note();
    return this.state();
  }
  // The screen's look at a job while it runs; the state shows it too (the hold itself goes with the window's look).
  async restoreJob(jobId) {
    this.need();
    if (typeof jobId !== 'string' || !JOB.test(jobId)) throw failure('BAD_INPUT');
    const r = await this.provision.restoreJob(jobId);
    const hold = this.engine.config?.serverRestore;
    if (hold?.jobId === jobId || this.info.restore?.jobId === jobId) {
      const v = restoreView({ ...r, jobId });
      if (v) { this.info.restore = { ...v, byThisDevice: this.info.restore?.jobId === jobId ? this.info.restore.byThisDevice : true }; await this.keep(); }
    }
    return r;
  }
  // 「계속」 ends the restore. 「되돌리기 취소」 starts a new job on the server that puts back what the restore hid: until
  // it ends nothing is written here either, and its number is the hold's and the state's (Fable 지적 5).
  async restoreChoose(jobId, choice) {
    this.need();
    if (typeof jobId !== 'string' || !JOB.test(jobId) || !['continue', 'undo'].includes(choice)) throw failure('BAD_INPUT');
    const r = await this.google(() => this.provision.restoreChoose(jobId, choice));
    const e = this.engine;
    const next = choice === 'undo' && JOB.test(r?.jobId || '') ? r.jobId : null;
    if (next && e.config?.repositoryId && e.config.mode === 'backup') {
      await e.holdForServerRestore({ jobId: next, undo: true });
      this.info.restore = { jobId: next, state: 'running', awaitingChoice: false, at: null, byThisDevice: true, error: null, undo: true };
    } else {
      await e.releaseServerRestore();
      // The choice ends the wait the last status reported; the next look reads the server again.
      if (e.accountHold === 'restore') e.accountHold = null;
      this.info.restore = next ? { jobId: next, state: 'running', awaitingChoice: false, at: null, byThisDevice: true, error: null, undo: true } : null;
    }
    await this.keep();
    return next ? { ok: true, jobId: next } : { ok: !!r.ok };
  }
}
module.exports = { Account, MESSAGES, applyStatus, telemetryRun, APP_VERSION };
