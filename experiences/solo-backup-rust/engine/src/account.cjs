'use strict';
// 「Google로 시작」 · 「보호 시작」 and the account's other requests (STAGE1_DESIGN.md 2.1 · 4.5 · 4.6): the window's
// side of the provisioning server (provision-client.cjs), the account envelope v3 (recovery-service.cjs) and the cloud
// engine, in the order 4.5 asks — provision → repository → envelope published and read back → read key confirmed.
// The schedule and the first backup are the window's (protectNow). Nothing here hands a key, a token or the
// repository password to the screen: state() says only what the screen needs.
const os = require('node:os');
const path = require('node:path');
const b2 = require('./b2.cjs');
const { GoogleAuth } = require('./recovery-auth.cjs');
const { ProvisionClient } = require('./provision-client.cjs');
const { EnvelopeV3 } = require('./recovery-service.cjs');

// This app's version as the provisioning server and its measurements see it.
const APP_VERSION = '0.7.0';
const DEVICE = /^[a-z0-9]{12}$/;
const NEEDS = ['write-key', 'read-key', 'restore'];
const MESSAGES = {
  NO_GOOGLE: '이 판에서는 Google로 시작할 수 없습니다.',
  NOT_SIGNED_IN: 'Google로 먼저 시작해 주세요.',
  NOT_WRITER: '이 계정의 백업은 다른 PC가 하고 있습니다.',
  OTHER_BACKUP: '이 PC에는 다른 백업이 연결되어 있습니다.',
  WRITE_KEY: '이 PC가 백업할 준비가 끝나지 않았습니다. 다시 시도해 주세요.',
  GOOGLE_STEP: 'Google 계정에서 잃어버린 기기의 접근을 먼저 지워 주세요.',
  ENVELOPE: '계정에 복구 정보를 남기지 못했습니다. 다시 시도해 주세요.',
  NO_ENVELOPE: '이 계정의 복구 정보를 찾지 못했습니다.',
  BAD_INPUT: '요청을 확인하지 못했습니다.',
};
const failure = (code) => Object.assign(new Error(MESSAGES[code]), { code });
// A server answer that says no job started: the hold written before it can go.
const DEFINITE = new Set(['NOT_INVITED', 'SUB_MISMATCH', 'NONCE', 'TOKEN', 'DEVICE', 'DEVICE_STATE', 'RATE', 'BUSY', 'TOO_OLD', 'BAD_INPUT', 'NOT_FOUND', 'ACCOUNT', 'DENIED', 'CANCELED']);
// The repository place as the envelope holds it (exactly these three, 「봉투 v3의 꼴」).
const place = (provider) => ({ endpoint: provider.endpoint, bucket: provider.bucket, prefix: provider.prefix });
// A device list as the screen gets it: the server's fields that name and date a device, nothing else.
const text = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
const ms = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const listed = (devices) => (Array.isArray(devices) ? devices.slice(0, 50) : []).filter((d) => d && DEVICE.test(d.id || '')).map((d) => ({
  id: d.id, name: text(d.name, 64) || '', role: d.role === 'write' ? 'write' : 'read', state: text(d.state, 16), createdAt: ms(d.createdAt), lastSeenAt: ms(d.lastSeenAt), current: d.current === true }));

// The server status (GET status) as the writer's engine needs it (4.5 「회차 실행기」 · 4.6 N2), for the run and the
// window alike: a seat that moved makes this PC rest and say so; a restore running or waiting for the choice, or an
// account over its limit, holds this run (accountHold — not written down); the snapshot a reading PC copies is pinned
// in the cleanup. Only this device's backup of the customer repository is touched.
async function applyStatus(engine, status, deviceId) {
  const c = engine.config;
  if (!status || typeof status !== 'object' || !c?.repositoryId || c.mode !== 'backup' || !b2.customerRepository(c.provider?.prefix) || c.host !== deviceId) return false;
  const d = status.device || {};
  if (d.state === 'moved') await engine.markMoved({ device: text(d.movedTo?.name, 64) || '', at: new Date().toISOString() });
  else if (d.state === 'active' && c.movedTo) await engine.clearMoved();
  const r = status.restore;
  engine.accountHold = r && (['preparing', 'running'].includes(r.state) || r.awaitingChoice === true) ? 'restore' : status.customer?.overQuota === true ? 'over-quota' : null;
  const m = status.move;
  const until = m && (Number.isSafeInteger(m.until) ? m.until : Date.parse(m.until));
  await engine.setMovePin(m && m.byThisDevice !== true && /^[a-f0-9]{64}$/.test(m.snapshotId || '') && Number.isFinite(until) ? { snapshotId: m.snapshotId, until: new Date(until).toISOString() } : null);
  return true;
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
    this.info = { googleStepRequired: false, writer: null };
    this.damaged = [];
  }
  // A damaged device or envelope file does not stop the window: the screen offers 「Google로 시작」 again.
  async open() {
    for (const [name, part] of [['google', this.auth], ['device', this.provision], ['envelope', this.envelope]]) {
      if (!part) continue;
      try { await part.open(); } catch { this.damaged.push(name); }
    }
    return this.state();
  }
  state() {
    const g = this.auth?.getState() || { available: false, connected: false, email: null };
    const p = this.provision.state(), e = this.envelope.getState();
    const writer = typeof this.info.writer?.name === 'string' ? this.info.writer.name.slice(0, 64) : null;
    // `needs`: what this PC must ask the server again — 'write-key' (takeWriteSeat), 'read-key' (rotateReadKey),
    // 'restore' (a restore request whose answer was lost; the screen reads the server status).
    const needs = (Array.isArray(p.needs) ? p.needs : []).filter((x) => NEEDS.includes(x));
    return { available: !!this.auth, signedIn: !!g.connected, email: g.email || null, connected: p.connected, role: p.role, deviceId: p.deviceId,
      device: this.deviceName, writer, googleStepRequired: this.info.googleStepRequired, needs,
      envelope: e.verified ? { verifiedAt: e.verified.verifiedAt } : null, envelopeInvalid: !!e.invalid, damaged: [...this.damaged] };
  }
  need({ device = true } = {}) {
    if (!this.auth) throw failure('NO_GOOGLE');
    const p = this.provision.state();
    if (device && !p.connected) throw failure('NOT_SIGNED_IN');
    return p;
  }

  // 「Google로 시작」: this PC becomes a device of the account. A device already made here is kept (one per Windows
  // profile); `hint` is the Google address Solio knows, only to pre-select the account.
  // A sign-up stopped after the device was stored is finished without a new sign-in (provision() does that).
  async signIn({ hint } = {}) {
    this.need({ device: false });
    if (hint !== undefined && (typeof hint !== 'string' || hint.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(hint))) throw failure('BAD_INPUT');
    let r;
    try { r = await this.provision.provision({ name: this.deviceName, appVersion: this.appVersion, ...(hint ? { hint } : {}) }); }
    catch (e) {
      if (e.code === 'ALREADY') return this.state();
      // The account is full: the screen shows its devices so a dead one can be cut off first.
      if (e.code === 'LIMIT_DEVICES') e.details = { devices: listed(e.extra?.devices) };
      throw e;
    }
    this.info = { googleStepRequired: !!r.googleStepRequired, writer: r.writer && typeof r.writer === 'object' ? r.writer : null };
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
    if (!e.config) await this.openBackup();
    if (e.config.mode === 'restore') {
      const credentials = await this.provision.writeCredentials();
      if (!credentials) throw failure('WRITE_KEY');
      await e.becomeWriter({ sources, credentials, host: p.deviceId });
    } else this.ours();
    // The envelope this backup was opened from is its recovery; a read key still to confirm gets a new one.
    // The Google step after a loss holds here too (GPT workbackup-account GA2): the person says it is done.
    if (await this.provision.pendingReadKey()) await this.publishEnvelope({ googleStepDone });
    else if (!e.hasRecovery()) await e.markEnvelope({ verifiedAt: new Date().toISOString() });
    return this.state();
  }
  // A PC that does not write (role read) opens the account's backup restore-only, for 옮겨 오기 (4.6).
  async openBackup() {
    const p = this.need();
    if (this.engine.config) throw failure('OTHER_BACKUP');
    const found = (await this.envelope.discover()).find((x) => x.customer === p.customerId);
    if (!found) throw failure('NO_ENVELOPE');
    const v = await this.envelope.read(found.fileId);
    if (v.repository.prefix !== p.repository.prefix || v.repository.bucket !== p.repository.bucket) throw failure('NO_ENVELOPE');
    await this.engine.importRepository({ repository: v.repository, repositoryId: v.repositoryId, password: v.password, credentials: v.readKey });
    return this.state();
  }
  ours() {
    const c = this.engine.config, p = this.provision.state();
    if (c.host !== p.deviceId || c.provider?.prefix !== p.repository?.prefix) throw failure('OTHER_BACKUP');
  }
  // The read key this device received goes into a new envelope, which is read back, and only then is the key
  // confirmed to the server (it retires the old one after that). 2.4 (5)(나): after a loss report the customer
  // first removes the lost device's Google access — that screen cannot be skipped.
  async publishEnvelope({ googleStepDone }) {
    const e = this.engine;
    const readKey = await this.provision.pendingReadKey();
    if (!readKey) { if (!e.hasRecovery()) throw failure('ENVELOPE'); return; }
    if (this.info.googleStepRequired && googleStepDone !== true) throw failure('GOOGLE_STEP');
    const published = await this.envelope.publish({ repository: place(e.config.provider), repositoryId: e.config.repositoryId, password: e.secret, readKey });
    if (!published.verified?.verifiedAt) throw failure('ENVELOPE');
    await e.markEnvelope({ verifiedAt: published.verified.verifiedAt });
    // A restore-only connection reads with the customer read key itself: it moves to the new key before the server may
    // retire the old one (GPT workbackup-account GA3). A writer reads and writes with its own write key.
    if (e.config.mode === 'restore') await e.updateCloudCredentials(readKey);
    await this.provision.confirmReadKey(readKey.keyId);
    this.info.googleStepRequired = false;
  }

  async devices() {
    this.need();
    return listed((await this.provision.devices()).devices);
  }
  // 옮겨 오기 끝 「옛 PC 연결 끊기 — 예」, a moved PC's 「이 PC로 다시 백업」, or a writer's 「쓰기 출입증 다시 받기」.
  async takeWriteSeat({ sources } = {}) {
    this.need();
    const r = await this.provision.takeWriteSeat();
    const credentials = await this.provision.writeCredentials(), p = this.provision.state(), e = this.engine;
    if (!credentials) throw failure('WRITE_KEY');
    if (e.config?.mode === 'restore' && b2.customerRepository(e.config.provider?.prefix)) await e.becomeWriter({ sources, credentials, host: p.deviceId });
    else if (e.config?.repositoryId) { this.ours(); await e.updateCloudCredentials(credentials); await e.clearMoved(); }
    return { previous: typeof r.previous?.name === 'string' ? r.previous.name.slice(0, 64) : null, ...this.state() };
  }
  async revokeDevice(deviceId) {
    this.need({ device: false });
    if (!DEVICE.test(deviceId || '')) throw failure('BAD_INPUT');
    const r = await this.provision.revoke(deviceId);
    return { suggestReadKeyRotation: !!r.suggestReadKeyRotation };
  }
  async reportLost(deviceId) {
    this.need({ device: false });
    if (!DEVICE.test(deviceId || '')) throw failure('BAD_INPUT');
    const r = await this.provision.lost(deviceId);
    this.info.googleStepRequired = true;
    const url = typeof r.googleRemovalUrl === 'string' && /^https:\/\/myaccount\.google\.com\//.test(r.googleRemovalUrl) ? r.googleRemovalUrl : null;
    return { next: r.next === 'read-key-rotate' ? 'read-key-rotate' : null, googleRemovalUrl: url };
  }
  // A read key already received and not confirmed is used again rather than asking for another.
  async rotateReadKey({ googleStepDone = false } = {}) {
    this.need();
    if (!await this.provision.pendingReadKey()) {
      const r = await this.provision.rotateReadKey();
      if (r.googleStepRequired) this.info.googleStepRequired = true;
    }
    await this.publishEnvelope({ googleStepDone });
    return this.state();
  }

  // 되돌리기(4.5 restore/*). The hold is written before the request and cleared once the customer chose; a request
  // the server answered with a refusal started nothing, so its hold goes at once.
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
    try { r = await this.provision.restoreRun(at); }
    catch (error) { if (!earlier && DEFINITE.has(error.code)) await e.releaseServerRestore(); throw error; }
    // The server gave new keys with the job: the engine writes with the new one, and the new read key goes into the
    // envelope (the old one is gone). The job has started either way, so its number always comes back; a step that
    // could not be done here is named (`left`) and done again by rotateReadKey (it reuses the received key).
    try {
      const credentials = await this.provision.writeCredentials();
      if (credentials) await e.updateCloudCredentials(credentials);
      await this.publishEnvelope({ googleStepDone: false });
    } catch (error) { return { jobId: r.jobId, left: /^[A-Z][A-Z_]{1,31}$/.test(error.code || '') ? error.code : 'ENVELOPE' }; }
    return { jobId: r.jobId };
  }
  // The window's look at the account (each hour while it is open, and when it opens): the server status goes to the
  // engine as in a run, the Google step after a loss comes back from the server, and a read key the server still
  // counts as unconfirmed is published and confirmed when this PC holds it. Once a day the envelope is read back
  // (4.5 「봉투 매일 재확인」); one that is gone or different is marked for 「다시 로그인」 (envelopeInvalid).
  async refresh({ recheck = false } = {}) {
    const p = this.provision.state();
    if (!this.auth || !p.connected) return this.state();
    const status = await this.provision.status();
    await applyStatus(this.engine, status, p.deviceId);
    if (status.lost?.googleStepRequired === true) this.info.googleStepRequired = true;
    if (status.writer && typeof status.writer === 'object') this.info.writer = status.writer;
    const e = this.engine;
    if (e.config?.repositoryId && b2.customerRepository(e.config.provider?.prefix) && this.auth.getState().connected) {
      if (status.readKey === 'unconfirmed' && await this.provision.pendingReadKey() && !this.info.googleStepRequired) await this.publishEnvelope({ googleStepDone: false });
      else if (recheck && this.envelope.getState().verified) {
        const checked = await this.envelope.recheck({ repositoryId: e.config.repositoryId, password: e.secret });
        if (checked.verified?.verifiedAt) await e.markEnvelope({ verifiedAt: checked.verified.verifiedAt });
      }
    }
    return this.state();
  }
  async restoreJob(jobId) { this.need(); if (typeof jobId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(jobId)) throw failure('BAD_INPUT'); return this.provision.restoreJob(jobId); }
  async restoreChoose(jobId, choice) {
    this.need();
    if (typeof jobId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(jobId) || !['continue', 'undo'].includes(choice)) throw failure('BAD_INPUT');
    const r = await this.provision.restoreChoose(jobId, choice);
    await this.engine.releaseServerRestore();
    // The choice ends the wait the last status reported; the next look reads the server again.
    if (this.engine.accountHold === 'restore') this.engine.accountHold = null;
    return { ok: !!r.ok };
  }
}
module.exports = { Account, MESSAGES, applyStatus, telemetryRun, APP_VERSION };
