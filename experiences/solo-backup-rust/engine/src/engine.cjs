'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { StringDecoder } = require('node:string_decoder');
const { ProcessOutput } = require('./process-output.cjs');
const { extractVerified, readManifest, entryPath } = require('./restore-tar.cjs');
const { directory, overlap, atomic, validateSources } = require('./paths.cjs');
const b2 = require('./b2.cjs');
const { normalizeProtection, schedule, time } = require('./protection.cjs');
const { selectSample, consumeSample, issue: probeIssue } = require('./probe.cjs');
const selection = require('./restore-select.cjs');

const APP = 'solo-work-backup-v1';
const VERIFIED = 'complete-structure-checked';
const DAY = 86400000;
/** Folder paths compare as Windows does, without regard to case. */
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase();
const holds = (snapshot, folder) => Array.isArray(snapshot?.paths) && snapshot.paths.some(p => same(p, folder));
/** Each backed-up folder once, in the order first met. */
const foldersOf = snapshots => snapshots.flatMap(s => Array.isArray(s.paths) ? s.paths : []).filter((p, i, all) => typeof p === 'string' && all.findIndex(q => same(q, p)) === i);
const missingWarning = missing => missing.length ? `백업할 폴더 ${missing.length}개를 찾을 수 없어 그 폴더를 빼고 백업했습니다. 외장 드라이브라면 다시 연결해 주세요. 그 폴더가 든 이전 백업은 지우지 않습니다.` : null;
/** A partial snapshot's list snapshots: the meta ones with its run tag. */
const listsIn = (all, s) => { const run = s.tags.find(t => t.startsWith('run:')); return run ? all.filter(x => x.tags.includes(run) && x.tags.includes('meta')) : []; };
/** Where `item` (a path restic reported) is inside `folder`, with forward slashes; null when it is not inside. */
const inside = (folder, item) => {
  const base = folder.replace(/[\\/]+$/, '');
  if (typeof item !== 'string' || item.length <= base.length + 1 || item.slice(0, base.length).toLowerCase() !== base.toLowerCase() || !/[\\/]/.test(item[base.length])) return null;
  return item.slice(base.length + 1).replace(/[\\/]+/g, '/').replace(/\/$/, '') || null;
};
/** A partial snapshot's list as stored (workbackup-unreadable.json), or an error. */
function checkList(list) {
  if (list?.v !== 1 || !Array.isArray(list.unreadable) || list.unreadable.some(p => typeof p !== 'string') || typeof list.cut !== 'boolean') throw new Error('읽지 못한 파일 목록의 형식을 확인하지 못했습니다.');
  return list;
}
/** `rel` (inside a folder, forward slashes) is one of `blind` (lower-cased) or under one of them. */
const covered = (blind, rel) => { const parts = rel.toLowerCase().split('/'); for (let i = 1; i <= parts.length; i++) if (blind.has(parts.slice(0, i).join('/'))) return true; return false; };
/** Something under `rel` is in `blind`. */
const unreadUnder = (blind, rel) => { const k = rel.toLowerCase() + '/'; for (const b of blind) if (b.startsWith(k)) return true; return false; };
/** A snapshot whose folder list a restore can follow: 1 to 30 plain Windows folders. */
const sanePaths = s => Array.isArray(s.paths) && s.paths.length && s.paths.length <= 30 && !s.paths.some(p => typeof p !== 'string' || !/^[A-Za-z]:[\\/]/.test(p) || p.split(/[\\/]/).some(part => part === '..' || part === '.'));
/** 「지금 상태」 (4.2): the backup each folder is restored from — the newest complete one that holds it, or a newer
 *  partial one whose list is whole and does not say the folder itself could not be read; a folder no complete one
 *  holds comes from the newest partial one that does. The same per-folder choice retain() keeps (GPT GA1, 끝판 카본
 *  nowstate A2 · A3). `complete` and `listed` newest first; `listOf(s)` reads a partial one's list. */
async function restoreBases(latest, complete, listed, listOf) {
  const sets = [];
  for (const folder of foldersOf([latest, ...complete, ...listed])) {
    const c = complete.find(s => holds(s, folder)), p = listed.find(s => holds(s, folder));
    let snapshot = c, cut = false;
    if (p && (!c || Date.parse(p.time) > Date.parse(c.time))) {
      const list = await listOf(p), unknown = list.cut || list.unreadable.some(item => same(item, folder));
      if (!c) { snapshot = p; cut = unknown; } else if (!unknown) snapshot = p;
    }
    sets.push({ snapshot, original: folder, cut });
  }
  return sets;
}
/** 「지금 상태」 (4.2): of the paths a backup could not read (`wanted`, inside its folder; `manifest` is what it holds),
 *  what comes from the earlier backups `seen` (newest first: { selector, at, cut, blind, had | load() } — `blind` what
 *  that one could not read itself; a listing is read only when needed). File by file, the first earlier backup that
 *  has the file gives it; the first that could read where it would be and does not have it shows it was gone by then,
 *  so no older copy comes back — nor an older folder of that name (끝판 카본 A4). A folder it could not read is
 *  gathered the same way, file by file (GPT GA2), from the earlier ones down to the first that read all of it (끝판 A1).
 *  A path under one that is a file is left out — the folder became a file (끝판 A4). A path no backup has is in `notFound`. */
async function gatherEarlier(wanted, manifest, seen) {
  const extra = [], notFound = [], folders = [], taken = new Set();
  const had = async e => (e.had ??= await e.load());
  const could = (e, rel) => !e.cut && !covered(e.blind, rel);
  const first = async rel => {
    for (const e of seen) {
      const node = (await had(e)).nodes.get(rel.toLowerCase());
      if (node) return { e, node };
      if (could(e, rel)) return null;
    }
    return null;
  };
  const take = async rel => {
    const k = rel.toLowerCase(), got = await first(rel);
    if (got?.node.type !== 'file') return false;
    if (!taken.has(k) && !manifest.nodes.has(k)) { taken.add(k); extra.push({ selector: got.e.selector, name: got.node.name, size: got.node.size, backupAt: got.e.at }); }
    return true;
  };
  for (const rel of wanted) {
    const k = rel.toLowerCase();
    if (manifest.nodes.get(k)?.type === 'file') continue;
    const kind = (await first(rel))?.node.type;
    if (kind === 'dir') {
      folders.push(rel);
      const files = new Set();
      for (const e of seen) {
        for (const n of (await had(e)).nodes.values()) if (n.type === 'file' && n.name.toLowerCase().startsWith(k + '/')) files.add(n.name);
        if (could(e, rel) && !unreadUnder(e.blind, rel)) break;
      }
      for (const file of files) await take(file);
    } else if (!kind || !(await take(rel))) notFound.push(rel);
  }
  const fileNames = new Set([...manifest.nodes.values()].filter(n => n.type === 'file').map(n => n.name.toLowerCase()).concat(extra.map(e => e.name.toLowerCase())));
  const under = name => { const parts = name.toLowerCase().split('/'); for (let i = 1; i < parts.length; i++) if (fileNames.has(parts.slice(0, i).join('/'))) return true; return false; };
  return { extra: extra.filter(e => !under(e.name)), notFound, folders };
}
/** The run record's count of folders not found, when there were any. */
const gone = n => n > 0 ? { missing: n } : {};
/** How long a folder taken out of the backup keeps its backups (4.2 「폴더 더하기 · 빼기」). */
const REMOVED_KEEP = 30 * DAY;
/** A taken-out folder's entry in the settings: its path, when it was taken out, and — once a cleanup has seen it —
 *  that cleanup's time (`since`), from which the 30 days count. */
const removedEntry = r => typeof r?.path === 'string' && Number.isFinite(Date.parse(r.at)) && (r.since === undefined || Number.isFinite(Date.parse(r.since)));
/** Unreadable items kept for a partial snapshot's list; past this the list says it is cut short. */
const UNREADABLE_MAX = 200000;
/** restic's JSON error lines, however they are split into chunks: each `item` goes to onItem. A line past
 *  4 MB is not held — onItem(null) says an item may be lost, so the list is marked cut (GPT GA4). */
function errorItems(onItem) {
  let rest = '';
  const lines = text => {
    const all = (rest + text).split('\n'); rest = all.pop();
    if (rest.length > 4194304) { rest = ''; onItem(null); }
    for (const line of all) { let m = null; try { m = JSON.parse(line); } catch { } if (m?.message_type === 'error' && typeof m.item === 'string' && m.item) onItem(m.item); }
  };
  return { push: lines, end: () => lines('\n') };
}
// Exit 11 (another process holds the repository lock) is shown as this notice, not as an error;
// the next operation that succeeds clears it (review B2).
const BUSY_WARNING = '다른 작업이 백업 저장소를 쓰는 중이라 이번 작업은 하지 못했습니다. 잠시 뒤 다시 해 주세요. 자동 백업은 다음 회차에 다시 합니다.';
const RESTIC_SHA256 = 'b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830';
const isId = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const json = s => JSON.parse(s.replace(/^\uFEFF/, ''));
// Stream the pinned restic (31 MB) instead of reading it whole, and verify a
// given file once per process (keyed by path, size and mtime so a swapped file
// is checked again). Every engine (local · cloud · recommended) used to read the
// whole binary into memory on open — the T7 preliminary saw the worker peak at
// 134 MB largely from that (STAGE1_DESIGN.md 4.3).
const verifiedBinaries = new Map();
async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(file, 'r');
  try { const buffer = Buffer.allocUnsafe(1 << 20); for (;;) { const { bytesRead } = await handle.read(buffer, 0, buffer.length, null); if (!bytesRead) break; hash.update(buffer.subarray(0, bytesRead)); } }
  finally { await handle.close(); }
  return hash.digest('hex');
}
async function verifyRestic(file) {
  const stat = await fs.stat(file); const key = `${path.resolve(file)}|${stat.size}|${stat.mtimeMs}`;
  if (verifiedBinaries.get(key) === true) return;
  if (await sha256File(file) !== RESTIC_SHA256) throw new Error('백업 엔진 파일 검증에 실패했습니다. 배포본을 다시 받아 주세요.');
  verifiedBinaries.set(key, true);
}
function parseKit(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 65536) throw new Error('복구 키 파일을 읽을 수 없습니다.');
  const kit = json(text);
  if (kit.format !== APP || !isId(kit.repositoryId) || !/^[a-f0-9-]{36}$/.test(kit.vaultId) || !/^[A-Za-z0-9_-]{43}$/.test(kit.password) || !((kit.version === 1 && kit.type === 'local') || (kit.version === 2 && kit.type === 'b2'))) throw new Error('이 앱에서 만든 복구 키 파일이 아닙니다.');
  if (kit.type === 'b2') {
    kit.provider = b2.provider(kit.provider, kit.vaultId);
    if (kit.repository !== b2.repository(kit.provider, kit.vaultId)) throw new Error('클라우드 복구 키의 저장소 경로가 일치하지 않습니다.');
  }
  return kit;
}
class BackupEngine extends EventEmitter {
  constructor({ stateDir, workDir = null, resticPath, secretStore, runner = null, now = () => Date.now(), intervalMs = 900000, providerType = 'local', forbiddenPaths = [], probe = b2.probeBucket }) {
    super();
    this.stateDir = path.resolve(stateDir); this.resticPath = resticPath; this.secretStore = secretStore;
    // restic's cache and temporary files: a separate local folder when the host gives one
    // (%LOCALAPPDATA%\SynkWorkBackup — STAGE1_DESIGN.md 5.1), else inside the state folder.
    this.workDir = workDir ? path.resolve(workDir) : null;
    this.runner = runner; this.now = now; this.intervalMs = intervalMs;
    this.providerType = providerType; this.cloudCredentials = null; this.connection = null; this.transientSecrets = []; this.probe = probe; this.forbiddenPaths = forbiddenPaths;
    this.config = null; this.secret = null; this.job = null; this.child = null; this.stopping = false; this.lastAttempt = 0;
    this.fileCatalog = null;
  }
  async open() {
    await fs.mkdir(this.stateDir, { recursive: true });
    this.stateDir = await directory(this.stateDir);
    if (this.workDir) { await fs.mkdir(this.workDir, { recursive: true }); this.workDir = await directory(this.workDir); }
    else this.workDir = this.stateDir;
    await fs.mkdir(path.join(this.workDir, 'cache'), { recursive: true });
    await fs.mkdir(path.join(this.workDir, 'temp'), { recursive: true });
    if (!this.runner) await verifyRestic(this.resticPath);
    // The stamp is taken before reading: a run that writes in between leaves a newer file
    // than the stamp, so the next reload reads it (review GA2). It is recorded before the
    // credential is opened, so a window waiting for a recovery key does not reopen forever (GA3).
    const stamp = await this.settingsKeyNow();
    try { this.config = json(await fs.readFile(path.join(this.stateDir, 'settings.json'), 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('설정 파일이 손상되었습니다. 복구 키로 별도 PC에서 복구할 수 있습니다.'); }
    if (this.config) {
      const c = this.config;
      if (c.schema !== 1 || !['backup', 'restore'].includes(c.mode) || !/^[a-f0-9-]{36}$/.test(c.vaultId) || !Array.isArray(c.sources) || (c.repositoryId !== null && !isId(c.repositoryId))
        || (c.removedSources != null && !(Array.isArray(c.removedSources) && c.removedSources.every(removedEntry)))) throw new Error('설정 형식이 올바르지 않습니다.');
      normalizeProtection(c);
      if ((c.provider?.type || 'local') !== this.providerType) throw new Error('백업 프로필과 저장소 종류가 다릅니다.');
      if (this.isCloud()) {
        c.provider = b2.provider(c.provider, c.vaultId);
        if (c.repository !== b2.repository(c.provider, c.vaultId)) throw new Error('클라우드 저장소 경로가 일치하지 않습니다.');
      } else if (!path.isAbsolute(c.repository)) throw new Error('백업 폴더 경로가 올바르지 않습니다.');
      this.settingsKey = stamp;
      try {
        const value = await this.secretStore.decrypt(await fs.readFile(path.join(this.stateDir, 'credential.bin')));
        if (this.isCloud()) { const envelope = json(value); if (envelope.version !== 2) throw new Error('invalid credential'); this.secret = envelope.password; this.cloudCredentials = b2.credentials(envelope); }
        else this.secret = value;
        if (!/^[A-Za-z0-9_-]{43}$/.test(this.secret)) throw new Error('invalid credential');
      } catch {
        this.secret = null; this.cloudCredentials = null;
        const e = new Error('Windows 암호 보관함을 열지 못했습니다. 저장해 둔 복구 키 파일로 다시 연결해 주세요.'); e.code = 'RECOVERY_REQUIRED'; throw e;
      }
    }
    if (this.isCloud() && !this.config) {
      try {
        const value = json(await this.secretStore.decrypt(await fs.readFile(path.join(this.stateDir, 'connection.bin'))));
        const p = b2.provider({ ...value, prefix: 'work-backup/00000000-0000-4000-8000-000000000000' }, '00000000-0000-4000-8000-000000000000');
        this.connection = { endpoint: p.endpoint, bucket: p.bucket, credentials: b2.credentials(value) };
      } catch { /* Optional preset can be replaced by manually entered credentials. */ }
    }
    this.settingsKey = stamp;
    return this.getState();
  }
  // Whoever takes the engine lock reads the settings again: a scheduled run may have
  // written them meanwhile (STAGE1_DESIGN.md 4.1). Skipped while a job runs, and when the
  // file is the one this engine last read or wrote. A missing credential is not an error
  // here — the window then offers recovery, as when it opened (review GA3).
  async reload() {
    if (this.job || this.stopping) return false;
    const key = await this.settingsKeyNow();
    if (key === null || key === this.settingsKey) return false;
    try { await this.open(); } catch (e) { if (e.code !== 'RECOVERY_REQUIRED') throw e; }
    return true;
  }
  async settingsKeyNow() {
    try { const s = await fs.stat(path.join(this.stateDir, 'settings.json')); return `${s.size}:${s.mtimeMs}`; } catch { return null; }
  }
  async settingsStamp() { this.settingsKey = await this.settingsKeyNow(); }
  getState() {
    const c = this.config;
    const timing = schedule(c, this.intervalMs, this.now(), this.lastAttempt);
    return { version: require('../package.json').version, configured: !!c?.repositoryId, mode: c?.mode || 'backup', sources: c?.sources || [], repository: c?.repository || null,
      providerType: this.providerType, provider: c?.provider || null, initializing: !!c && !c.repositoryId,
      cloudConnection: this.isCloud() && c && !c.repositoryId && this.cloudCredentials ? { endpoint: c.provider.endpoint, bucket: c.provider.bucket } : !c && this.connection ? { endpoint: this.connection.endpoint, bucket: this.connection.bucket } : null,
      credentialRequired: !!c && !this.secret, intervalMinutes: this.intervalMs / 60000, fullCheckDays: this.isCloud() ? 30 : 1, retryAfter: c?.retryAfter || null,
      recoverySaved: this.hasRecovery(), manualRecoverySaved: c?.recoverySaved || false, readOnly: !!c?.readOnly, automatic: c?.automatic || false, lastBackup: c?.lastBackup || null, lastPartial: c?.lastPartial || null, missingSources: c?.missingSources || [],
      removedSources: (c?.removedSources || []).map(r => ({ path: r.path, at: r.at, until: new Date(Date.parse(r.since ?? r.at) + REMOVED_KEEP).toISOString() })),
      lastRestore: c?.lastRestore || null, health: c?.health || null, lastError: c?.lastError || null,
      lastSelectedRestore: c?.lastSelectedRestore || null, lastSelectedRestoreError: c?.lastSelectedRestoreError || null,
      pausedUntil: c?.pausedUntil || null, lastAttemptAt: c?.lastAttemptAt || null, nextBackupAt: timing.nextBackupAt, clockHold: timing.clockHold,
      lastProbe: c?.lastProbe || null, probeHold: c?.probeHold || null, protectRun: c?.protectRun || null, startupWarning: c?.startupWarning || null,
      warning: c?.warning || null, job: this.job ? { ...this.job } : null };
  }
  isCloud() { return this.providerType === 'b2'; }
  hasRecovery() { return !!(this.config?.recoverySaved || (this.config?.remoteRecovery?.repositoryId === this.config?.repositoryId && this.config?.remoteRecovery?.verifiedAt)); }
  recoveryKit() {
    if (!this.isCloud() || !this.config?.repositoryId || !this.secret) throw new Error('클라우드 백업을 연결한 뒤 복구 정보를 보관해 주세요.');
    return { format: APP, version: 2, type: 'b2', provider: this.config.provider, repository: this.config.repository, repositoryId: this.config.repositoryId, vaultId: this.config.vaultId, password: this.secret };
  }
  async validateReadCredential(credentials) {
    const options = { credentials, readOnly: true, timeoutMs: 60000 };
    const info = json(await this.run(['cat', 'config'], options));
    if (info.id !== this.config.repositoryId) throw new Error('복구 전용 키와 저장소가 다릅니다.');
    await this.run(['snapshots', '--json'], options);
  }
  // The app's own folders for this engine: the state, and the work folder when it is a separate one
  // (review GA2 — no source, target or restore may land in either).
  own() { return this.workDir && this.workDir !== this.stateDir ? [this.stateDir, this.workDir] : [this.stateDir]; }
  forbidden() { return [...this.own(), ...this.forbiddenPaths, ...(!this.isCloud() && this.config ? [this.config.repository] : [])]; }
  async storeCredential(password, credentials = this.cloudCredentials) {
    this.discardCatalog();
    const value = this.isCloud() ? JSON.stringify({ version: 2, password, ...b2.credentials(credentials) }) : password;
    await atomic(path.join(this.stateDir, 'credential.bin'), await this.secretStore.encrypt(value));
  }
  // Operator provisioning entry point; never exposed over renderer IPC. No
  // sources, repository or automatic backup are created by preparing a key.
  async prepareCloudConnection({ endpoint, bucket, credentials }) {
    if (!this.isCloud() || this.config || this.job) throw new Error('빈 클라우드 프로필에서만 연결을 준비할 수 있습니다.');
    const vault = '00000000-0000-4000-8000-000000000000';
    const p = b2.provider({ endpoint, bucket, prefix: `work-backup/${vault}` }, vault);
    const key = b2.credentials(credentials);
    await this.probe(p, key, { now: this.now() });
    await atomic(path.join(this.stateDir, 'connection.bin'), await this.secretStore.encrypt(JSON.stringify({ endpoint: p.endpoint, bucket: p.bucket, ...key })));
    this.connection = { endpoint: p.endpoint, bucket: p.bucket, credentials: key };
    return this.getState();
  }
  emitState() { this.emit('state', this.getState()); }
  stage(stage, percent = null) { if (this.job) { this.job.stage = stage; this.job.percent = percent; this.emitState(); } }
  async save() { await atomic(path.join(this.stateDir, 'settings.json'), JSON.stringify(this.config, null, 2)); await this.settingsStamp(); this.emitState(); }
  async recoverCredential(text, credentials = this.cloudCredentials) {
    const kit = parseKit(text);
    if (!this.config?.repositoryId || kit.repositoryId !== this.config.repositoryId || kit.vaultId !== this.config.vaultId) throw new Error('현재 설정에 맞는 복구 키가 아닙니다.');
    if (kit.type !== this.providerType || (this.isCloud() && kit.repository !== this.config.repository)) throw new Error('다른 종류의 백업 복구 키입니다.');
    if (!this.isCloud()) await directory(this.config.repository);
    this.transientSecrets = [kit.password, credentials?.keyId, credentials?.applicationKey];
    try {
    const info = json(await this.run(['cat', 'config'], { password: kit.password, credentials, timeoutMs: 60000 }));
    if (info.id !== kit.repositoryId) throw new Error('저장소가 바뀌었습니다. 원래 드라이브를 연결해 주세요.');
    await this.storeCredential(kit.password, credentials);
    this.secret = kit.password; this.cloudCredentials = this.isCloud() ? b2.credentials(credentials) : null;
    } catch (e) { throw new Error(this.clean(e.message)); }
    finally { this.transientSecrets = []; }
  }
  async resetUnfinishedSetup() {
    if (!this.config) return;
    if (this.job || this.config.repositoryId) throw new Error('완료된 저장소 설정은 덮어쓸 수 없습니다.');
    const stem = path.join(this.stateDir, `unfinished-${this.config.vaultId}-${crypto.randomUUID()}`);
    await fs.copyFile(path.join(this.stateDir, 'credential.bin'), `${stem}.bin`, require('node:fs').constants.COPYFILE_EXCL);
    await atomic(`${stem}.json`, JSON.stringify(this.config));
    await atomic(path.join(this.stateDir, 'settings.json'), 'null');
    this.config = null; this.secret = null; this.cloudCredentials = null; this.emitState();
  }
  async operation(kind, fn) {
    if (this.job || this.stopping) throw new Error('진행 중인 작업이 끝난 뒤 다시 눌러 주세요.');
    if (this.config && !['protect', 'probe'].includes(kind)) this.config.protectRun = null;
    this.job = { kind, stage: '준비 중', percent: null }; this.emitState();
    try {
      const value = await fn();
      if (this.config) { if (kind !== 'probe') this.config.lastError = null; if (this.config.warning === BUSY_WARNING) this.config.warning = null; await this.save(); }
      return value;
    } catch (e) {
      // Exit 11 is another process holding the repository lock — "busy, try the
      // next run", not an error (STAGE1_DESIGN.md 4.2 · review F2). The window still
      // says why nothing happened: a person-started job returns at once (review GA2).
      if (this.config && e.exitCode === 11) { if (this.config.mode === 'backup' && !this.config.readOnly) { this.config.warning = BUSY_WARNING; await this.save().catch(() => {}); } }
      else if (this.config) { this.config.lastError = this.clean(e.message); await this.save().catch(() => {}); }
      const error = new Error(this.clean(e.message)); error.exitCode = e.exitCode; throw error;
    } finally { this.transientSecrets = []; this.job = null; this.emitState(); this.emit('idle'); }
  }
  clean(message) { return b2.redact(message, [this.secret, this.cloudCredentials?.keyId, this.cloudCredentials?.applicationKey, this.connection?.credentials.keyId, this.connection?.credentials.applicationKey, ...this.transientSecrets]); }
  async run(args, { repository = this.config.repository, password = this.secret, provider = this.config?.provider, credentials = this.cloudCredentials, timeoutMs = DAY, consumeStdout = null, readOnly = !!this.config?.readOnly, onErrorItem = null, stdinText = null } = {}) {
    if (this.stopping && !this.job) throw new Error('앱을 종료하고 있습니다. 이전 정상 백업은 유지됩니다.');
    const { env, args: providerArgs } = b2.childOptions(provider, credentials, this.workDir || this.stateDir, process.env, password);
    if (readOnly) {
      const permitted = ['snapshots', 'ls', 'dump'].includes(args[0]) || (args[0] === 'cat' && ['config', 'lock'].includes(args[1])) || (args[0] === 'list' && args[1] === 'locks');
      if (!permitted) throw new Error('복구 전용 연결에서는 백업·전체 점검·삭제를 실행할 수 없습니다.');
      providerArgs.push('--no-lock');
    }
    if (this.resticStartedAt === null) this.resticStartedAt = Date.now();
    if (this.runner) return this.runner(args, { repository, password, engine: this, consumeStdout, provider, credentials, env, providerArgs, onErrorItem, stdinText });
    return new Promise((resolve, reject) => {
      const child = spawn(this.resticPath, ['--repo', repository, ...providerArgs, '--retry-lock', '10s', ...args], { env, windowsHide: true, shell: false, stdio: [stdinText === null ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
      this.child = child;
      if (stdinText !== null) { child.stdin.on('error', () => {}); child.stdin.end(stdinText); }
      let errors = '', timedOut = false, overflow = false, lastProgress = 0, consumerError = null, forceStop;
      const capture = new ProcessOutput({ structured: ['cat', 'snapshots', 'stats'].includes(args[0]), overflow: () => { overflow = true; child.kill(); }, progress: percent => { if (Date.now() - lastProgress >= 1000 || percent === 100) { lastProgress = Date.now(); this.stage(this.job?.stage, percent); } } });
      const errorDecoder = new StringDecoder('utf8');
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
      // Binary dump output never enters the text capture or renderer. A consumer
      // failure is handled immediately, then both stream and child must settle.
      const consumed = consumeStdout ? Promise.resolve().then(() => consumeStdout(child.stdout)).catch(e => {
        consumerError = e; child.stdout.destroy();
        // Closing the pipe lets restic report the write error and remove its own
        // lock. Windows kill is forcible; use it only if normal exit stalls.
        if (child.exitCode === null && child.signalCode === null) forceStop = setTimeout(() => child.kill(), 5000);
      }) : Promise.resolve();
      if (!consumeStdout) child.stdout.on('data', b => capture.accept(b));
      child.stdout.on('error', () => {});
      // Every unreadable item from restic's JSON error lines, however many — the tail kept below is only for the message.
      const items = onErrorItem ? errorItems(onErrorItem) : null;
      child.stderr.on('data', b => { const text = errorDecoder.write(b); items?.push(text); errors = (errors + text).slice(-12000); });
      child.once('error', e => { consumerError ||= e; child.stdout.destroy(e); });
      child.once('close', async (code, signal) => {
        clearTimeout(timer); clearTimeout(forceStop); this.child = null;
        if (code !== 0 || signal) child.stdout.destroy(new Error('백업 엔진의 출력이 중단되었습니다.'));
        await consumed;
        const output = capture.end(); const tail = errorDecoder.end(); items?.push(tail); items?.end(); errors += tail;
        if (consumerError) return reject(consumerError);
        if (timedOut || overflow || signal) return reject(new Error(timedOut ? '작업 시간이 길어 중단되었습니다. 다음 실행 때 다시 시도합니다.' : '작업이 중단되었습니다. 이전 정상 백업은 유지됩니다.'));
        if (code !== 0) {
          const explanation = code === 3 ? '일부 파일을 읽지 못했습니다. 파일을 사용하는 프로그램을 닫고 다시 백업해 주세요. 이전 정상 백업은 유지됩니다.' : code === 11 ? '다른 백업 작업이 저장소를 사용하고 있습니다. 잠시 후 다시 시도해 주세요.' : code === 12 ? '복구 키가 이 백업 저장소와 맞지 않습니다.' : '백업 저장소에 접근하지 못했거나 점검 중 오류가 발생했습니다.';
          const details = errors || output.slice(-1800);
          if (this.isCloud() && /(?:transaction|storage|download)_cap_exceeded|cap[_ ]exceeded/i.test(details) && this.config) this.config.retryAfter = new Date(Math.floor(this.now() / DAY) * DAY + DAY).toISOString();
          const error = new Error(this.clean(`${explanation}\n${details}`)); error.exitCode = code; return reject(error);
        }
        resolve(output);
      });
    });
  }
  async identity() {
    if (!this.config?.repositoryId) throw new Error('백업 준비를 먼저 완료해 주세요.');
    if (!this.secret) throw new Error('복구 키와 연결 키로 Windows 암호 보관함을 다시 연결해 주세요.');
    if (this.isCloud()) {
      if (this.config.repository !== b2.repository(this.config.provider, this.config.vaultId)) throw new Error('클라우드 저장소 경로가 바뀌었습니다.');
    } else {
      const real = await directory(this.config.repository);
      if ([...this.own(), ...this.forbiddenPaths].some(p => overlap(real, p))) throw new Error('백업 경로와 앱 보관 경로가 겹칩니다.');
    }
    const info = json(await this.run(['cat', 'config'], { timeoutMs: 60000 }));
    if (info.id !== this.config.repositoryId) throw new Error('다른 저장소가 연결되어 있습니다. 원래 백업 드라이브를 연결해 주세요.');
    return info;
  }
  async snapshots(tags = []) {
    const list = json(await this.run(['snapshots', '--json', '--tag', [APP, `vault:${this.config.vaultId}`, ...tags].join(',')], { timeoutMs: 60000 }));
    if (!Array.isArray(list) || list.some(s => !isId(s.id) || !Number.isFinite(Date.parse(s.time)))) throw new Error('백업 목록의 형식을 확인하지 못했습니다.');
    return list.filter(s => s.tags?.includes(APP) && s.tags.includes(`vault:${this.config.vaultId}`) && tags.every(t => s.tags.includes(t))).sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || b.id.localeCompare(a.id));
  }
  async setup({ sources, parent }) {
    return this.operation('setup', async () => {
      if (this.isCloud()) throw new Error('클라우드 연결 화면에서 준비해 주세요.');
      if (this.config?.repositoryId) throw new Error('이 앱에는 이미 백업 저장소가 연결되어 있습니다.');
      if (!this.config) {
        const target = await directory(parent);
        if ([...this.own(), ...this.forbiddenPaths].some(p => overlap(target, p))) throw new Error('앱 설정과 분리된 백업 폴더를 선택해 주세요.');
        const checked = await validateSources(sources, [target, ...this.own(), ...this.forbiddenPaths]);
        const vaultId = crypto.randomUUID();
        const repository = path.join(target, `work-backup-${vaultId}`);
        this.secret = crypto.randomBytes(32).toString('base64url');
        await atomic(path.join(this.stateDir, 'credential.bin'), await this.secretStore.encrypt(this.secret));
        this.config = { schema: 1, mode: 'backup', vaultId, repository, repositoryId: null, sources: checked, automatic: false, recoverySaved: false, lastBackup: null, health: null, lastError: null, warning: null };
        await this.save(); // Persist credentials and initialization journal before creating the encrypted repository.
      }
      await validateSources(this.config.sources, [path.dirname(this.config.repository), ...this.own(), ...this.forbiddenPaths]);
      await fs.mkdir(this.config.repository, { recursive: true });
      await directory(this.config.repository);
      this.stage('암호화 저장소 준비 중');
      try { await fs.access(path.join(this.config.repository, 'config')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; await this.run(['init'], { timeoutMs: 120000 }); }
      const info = json(await this.run(['cat', 'config']));
      if (!isId(info.id)) throw new Error('저장소 번호를 확인하지 못했습니다.');
      this.config.repositoryId = info.id;
      await this.save();
      return this.getState();
    });
  }
  async setupCloud({ sources, endpoint, bucket, credentials }) {
    return this.operation('setup', async () => {
      this.transientSecrets = [credentials?.keyId, credentials?.applicationKey];
      if (!this.isCloud()) throw new Error('클라우드 프로필에서 연결해 주세요.');
      if (this.config?.repositoryId) throw new Error('이 프로필에는 이미 저장소가 연결되어 있습니다.');
      const saved = this.config && this.cloudCredentials ? { ...this.config.provider, credentials: this.cloudCredentials } : this.connection;
      const canReuse = !credentials?.keyId && !credentials?.applicationKey && saved && b2.endpoint(endpoint) === saved.endpoint && bucket === saved.bucket;
      const next = b2.credentials(canReuse ? saved.credentials : credentials);
      if (!this.config) {
        const checked = await validateSources(sources, this.forbidden());
        const vaultId = crypto.randomUUID();
        const provider = b2.provider({ endpoint, bucket, prefix: `work-backup/${vaultId}` }, vaultId);
        await this.probe(provider, next, { now: this.now() });
        const password = crypto.randomBytes(32).toString('base64url');
        await this.storeCredential(password, next);
        this.secret = password; this.cloudCredentials = next;
        this.config = { schema: 1, mode: 'backup', provider, vaultId, repository: b2.repository(provider, vaultId), repositoryId: null, sources: checked, automatic: false, recoverySaved: false, lastBackup: null, health: null, lastError: null, warning: null };
        await this.save();
      } else {
        if (!this.secret) throw new Error('초기화 암호를 열지 못했습니다. 원래 Windows 계정으로 다시 실행해 주세요.');
        if (b2.endpoint(endpoint) !== this.config.provider.endpoint || bucket !== this.config.provider.bucket) throw new Error('이전 초기화의 버킷·Endpoint로 다시 시도해 주세요.');
        await this.probe(this.config.provider, next, { now: this.now() });
      }
      await validateSources(this.config.sources, this.forbidden());
      this.stage('B2 암호화 저장소 연결 중');
      let info;
      try { info = json(await this.run(['cat', 'config'], { credentials: next, timeoutMs: 60000 })); }
      catch (e) {
        if (e.exitCode !== 10) throw e; // Never turn denied/offline/wrong password into init.
        await this.run(['init'], { credentials: next, timeoutMs: 120000 });
        info = json(await this.run(['cat', 'config'], { credentials: next, timeoutMs: 60000 }));
      }
      if (!isId(info.id)) throw new Error('B2 저장소 번호를 확인하지 못했습니다.');
      await this.storeCredential(this.secret, next); this.cloudCredentials = next;
      this.config.repositoryId = info.id; this.config.retryAfter = null;
      await this.save(); return this.getState();
    });
  }
  async updateCloudCredentials(credentials) {
    return this.operation('credentials', async () => {
      this.transientSecrets = [credentials?.keyId, credentials?.applicationKey];
      if (!this.isCloud() || !this.config?.repositoryId || !this.secret) throw new Error('복구 키로 연결을 복구한 뒤 다시 시도해 주세요.');
      const next = b2.credentials(credentials);
      await this.probe(this.config.provider, next, { now: this.now() });
      const info = json(await this.run(['cat', 'config'], { credentials: next, timeoutMs: 60000 }));
      if (info.id !== this.config.repositoryId) throw new Error('다른 저장소의 키입니다.');
      await this.storeCredential(this.secret, next); this.cloudCredentials = next;
      this.config.retryAfter = null; await this.save(); return this.getState();
    });
  }
  async saveRecoveryKit(file) {
    return this.operation('key', async () => {
      await this.identity();
      const parent = await directory(path.dirname(file));
      const forbidden = [...this.forbidden(), ...this.config.sources, ...(!this.isCloud() ? [path.dirname(this.config.repository)] : [])];
      if (forbidden.some(p => overlap(parent, p))) throw new Error('복구 키는 작업 폴더·백업 폴더·앱 폴더와 분리된 곳에 저장해 주세요.');
      const target = path.join(parent, path.basename(file));
      const text = JSON.stringify({ format: APP, version: this.isCloud() ? 2 : 1, type: this.providerType, ...(this.isCloud() ? { provider: this.config.provider } : {}), repository: this.config.repository, repositoryId: this.config.repositoryId, vaultId: this.config.vaultId, password: this.secret, note: this.isCloud() ? '복구에는 이 파일과 해당 B2 버킷의 연결 키가 필요합니다. 서로 별도로 보관하세요. B2 키는 이 파일에 포함하지 않습니다.' : '이 파일로 백업을 열 수 있습니다. 노트북 및 백업 드라이브와 별도로 보관하세요.' }, null, 2);
      let handle;
      try { handle = await fs.open(target, 'wx', 0o600); }
      catch (e) { if (e.code === 'EEXIST') throw new Error('이미 같은 이름의 복구 키 파일이 있습니다. 다른 이름으로 저장해 주세요.'); throw e; }
      try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
      if (await fs.readFile(target, 'utf8') !== text) throw new Error('복구 키 파일을 다시 읽어 확인하지 못했습니다.');
      this.config.recoverySaved = true; await this.save();
      return this.getState();
    });
  }
  async importRecoveryKit({ text, repository, credentials, readOnly = false }) {
    return this.operation('import', async () => {
      if (this.config) throw new Error('기존 설정을 덮어쓸 수 없습니다.');
      const kit = parseKit(text);
      this.transientSecrets = [kit.password, credentials?.keyId, credentials?.applicationKey];
      if (kit.type !== this.providerType) throw new Error('복구 키와 맞는 로컬·클라우드 탭을 선택해 주세요.');
      const target = this.isCloud() ? kit.repository : await directory(repository);
      if (!this.isCloud() && [...this.own(), ...this.forbiddenPaths].some(p => overlap(target, p))) throw new Error('앱 폴더와 분리된 백업 저장소를 선택해 주세요.');
      if (readOnly && !this.isCloud()) throw new Error('읽기 전용 연결은 클라우드에서 지원합니다.');
      const options = { repository: target, password: kit.password, provider: kit.provider, credentials: this.isCloud() ? b2.credentials(credentials) : null, timeoutMs: 60000, readOnly };
      const info = json(await this.run(['cat', 'config'], options));
      if (info.id !== kit.repositoryId) throw new Error('복구 키에 기록된 저장소와 선택한 저장소가 다릅니다.');
      // Do not persist a new identity until a usable app snapshot has been found.
      const list = json(await this.run(['snapshots', '--json', '--tag', `${APP},vault:${kit.vaultId},${VERIFIED}`], options));
      if (!Array.isArray(list)) throw new Error('백업 목록을 읽지 못했습니다.');
      const latest = list.filter(s => isId(s.id) && s.tags?.includes(VERIFIED) && s.tags.includes(APP) && s.tags.includes(`vault:${kit.vaultId}`)).sort((a,b) => Date.parse(b.time) - Date.parse(a.time))[0];
      if (!latest) throw new Error('완료된 백업이 없습니다. 원래 PC에서 백업을 완료해 주세요.');
      await this.storeCredential(kit.password, credentials);
      this.secret = kit.password; this.cloudCredentials = this.isCloud() ? b2.credentials(credentials) : null;
      this.config = { schema: 1, mode: 'restore', readOnly, ...(this.isCloud() ? { provider: kit.provider } : {}), vaultId: kit.vaultId, repository: target, repositoryId: info.id, sources: [], automatic: false, recoverySaved: true, lastBackup: { id: latest.id, at: latest.time, files: latest.summary?.total_files_processed || 0, bytes: latest.summary?.total_bytes_processed || 0 }, health: null, warning: '복구 전용 연결입니다. 이 저장소의 백업을 지우거나 자동 백업하지 않습니다.' };
      await this.save(); return this.getState();
    });
  }
  async setAutomatic(enabled) {
    if (this.job) throw new Error('진행 중인 작업이 끝난 뒤 변경해 주세요.');
    if (typeof enabled !== 'boolean' || this.config?.mode !== 'backup' || !this.config.repositoryId) throw new Error('자동 백업을 설정할 수 없습니다.');
    if (enabled && !this.hasRecovery()) throw new Error('복구 키를 먼저 저장해 주세요.');
    this.config.automatic = enabled;
    if (!enabled) this.config.pausedUntil = null;
    await this.save(); return this.getState();
  }
  assertBackupReady() {
    if (this.config?.mode !== 'backup' || this.config.readOnly || !this.config.repositoryId) throw new Error('백업용 연결을 먼저 준비해 주세요. 복구 전용 연결에서는 실행할 수 없습니다.');
    if (!this.secret) throw new Error('저장된 인증 정보를 다시 연결해 주세요.');
    if (!this.hasRecovery()) throw new Error('복구 키를 먼저 저장한 뒤 백업을 시작해 주세요.');
  }
  async pauseAutomatic(minutes) {
    if (this.job || this.stopping) throw new Error('진행 중인 작업이 끝난 뒤 변경해 주세요.');
    this.assertBackupReady();
    if (![60, 240, 720].includes(minutes) || !this.config.automatic) throw new Error('자동 백업을 켠 뒤 1시간·4시간·12시간 중에서 선택해 주세요.');
    this.config.pausedUntil = new Date(this.now() + minutes * 60000).toISOString();
    await this.save(); return this.getState();
  }
  async resumeAutomatic() {
    if (this.job || this.stopping) throw new Error('진행 중인 작업이 끝난 뒤 변경해 주세요.');
    this.assertBackupReady();
    if (!this.config.automatic) throw new Error('보호 시작으로 자동 백업을 먼저 켜 주세요.');
    this.config.pausedUntil = null; await this.save(); return this.getState();
  }
  /** The folders, changed after setup (4.2 「폴더 더하기 · 빼기」). A folder added is checked as at setup; a folder taken
   *  out is kept in `removedSources`, and its backups stay 30 days (retain) and come back with a whole restore until
   *  then. Taken out and added again, it is a chosen folder as before. At least one folder stays. */
  async changeSources(sources) {
    return this.operation('sources', async () => {
      if (this.config?.mode !== 'backup' || this.config.readOnly || !this.config.repositoryId) throw new Error('백업을 설정한 뒤 폴더를 바꿀 수 있습니다.');
      if (!Array.isArray(sources) || sources.some(s => typeof s !== 'string')) throw new Error('백업할 폴더를 확인해 주세요.');
      const old = this.config.sources;
      const kept = old.filter(o => sources.some(s => same(s, o)));
      const asked = sources.filter((s, i) => !old.some(o => same(o, s)) && sources.findIndex(t => same(t, s)) === i);
      const added = [];
      if (asked.length) {
        for (const real of await validateSources(asked, [...this.forbidden(), ...(!this.isCloud() ? [path.dirname(this.config.repository)] : [])])) {
          if ([...kept, ...added].some(k => same(k, real))) continue; // the same folder by another spelling
          if ([...kept, ...added].some(k => overlap(k, real))) throw new Error('서로 포함되는 작업 폴더는 하나만 선택해 주세요.');
          added.push(real);
        }
      }
      const next = [...kept, ...added];
      if (!next.length) throw new Error('백업할 폴더를 하나 이상 남겨 주세요.');
      if (next.length > 30) throw new Error('백업할 폴더를 1~30개 선택해 주세요.');
      const removed = old.filter(o => !next.some(s => same(s, o)));
      if (!added.length && !removed.length) return this.getState();
      const at = new Date(this.now()).toISOString();
      const out = [...(this.config.removedSources || []).filter(r => ![...next, ...removed].some(p => same(p, r.path))), ...removed.map(p => ({ path: p, at }))];
      // A folder taken out is no longer one that is missing: the notice of it goes with it.
      const before = missingWarning(this.config.missingSources || []);
      const missing = (this.config.missingSources || []).filter(m => next.some(s => same(s, m)));
      if (before && typeof this.config.warning === 'string' && this.config.warning.includes(before)) this.config.warning = this.config.warning.replace(before, missingWarning(missing) || '').trim() || null;
      this.config.missingSources = missing.length ? missing : null;
      this.config.sources = next; this.config.removedSources = out.length ? out : null;
      await this.save(); return this.getState();
    });
  }
  async protectNow({ registerStartup } = {}) {
    this.assertBackupReady();
    return this.operation('protect', async () => {
      this.stage('보호 시작 전 연결과 작업 폴더 확인 중');
      await this.identity();
      await validateSources(this.config.sources, this.forbidden());
      this.config.protectRun = { phase: 'startup', startedAt: new Date(this.now()).toISOString() };
      await this.save();
      try {
        this.stage('Windows 자동 실행 확인 중');
        try {
          if (typeof registerStartup !== 'function' || await registerStartup() !== true) throw new Error('Windows 시작 등록을 확인하지 못했습니다.');
          this.config.startupWarning = null;
        } catch (e) { this.config.startupWarning = this.clean(e.message); }
        this.config.protectRun.phase = 'enable';
        this.config.automatic = true; this.config.pausedUntil = null; await this.save();
        this.config.protectRun.phase = 'backup'; await this.save();
        await this.backupBody();
        this.config.protectRun.phase = 'done'; this.config.protectRun.finishedAt = new Date(this.now()).toISOString();
        await this.save(); return this.getState();
      } catch (e) {
        this.config.protectRun.phase = 'failed'; this.config.protectRun.finishedAt = new Date(this.now()).toISOString();
        await this.save().catch(() => {}); throw e;
      }
    });
  }
  async backupNow() {
    return this.operation('backup', () => this.backupBody());
  }
  async backupBody() {
      this.assertBackupReady();
      this.lastAttempt = this.now();
      this.config.lastAttemptAt = new Date(this.lastAttempt).toISOString(); await this.save();
      await this.identity();
      const { present, missing } = await this.sourcesNow();
      const runTag = `run:${crypto.randomUUID()}`;
      this.stage('작업 파일 백업 중');
      // OneDrive online-only files would be downloaded by reading them; OneDrive keeps them (4.2 step 7, review GA1).
      // Exit 3 (some files could not be read) still saves the snapshot. With the list U of what was not read, it is kept
      // as a partial one (4.2 「완료본 · 부분 판 · 채움 판」); without a list it stays pending and goes as before.
      const unreadable = []; let partial = false, cut = false;
      try {
        await this.run(['backup', '--json', ...(process.platform === 'win32' ? ['--exclude-cloud-files'] : []), '--host', this.config.vaultId, '--tag', `${APP},vault:${this.config.vaultId},${runTag},pending`, '--', ...present],
          { onErrorItem: item => { if (item !== null && unreadable.length < UNREADABLE_MAX) unreadable.push(item); else cut = true; } });
      } catch (e) {
        if (e.exitCode !== 3 || !unreadable.length) throw e;
        partial = true;
      }
      const pending = await this.snapshots([runTag, 'pending']);
      if (pending.length !== 1) throw new Error('새 백업을 정확하게 확인하지 못했습니다. 이전 정상 백업은 유지됩니다.');
      if (partial) {
        // The list goes in first, as this run's meta snapshot; only then is the snapshot marked partial — so a partial
        // snapshot always has its list, and one left without (a run that died in between) stays pending (4.2 「순서」).
        this.stage('읽지 못한 파일 목록 저장 중');
        await this.run(['backup', '--stdin', '--stdin-filename', 'workbackup-unreadable.json', '--host', this.config.vaultId, '--tag', `${APP},vault:${this.config.vaultId},${runTag},meta`],
          { stdinText: JSON.stringify({ v: 1, unreadable, cut }) });
        const metas = await this.snapshots([runTag, 'meta']);
        if (metas.length !== 1) throw new Error('읽지 못한 파일 목록을 확인하지 못했습니다. 이전 정상 백업은 유지됩니다.');
        await this.keepList(metas[0].id, { v: 1, unreadable, cut });
      }
      this.stage('저장 구조 확인 중');
      try { await this.run(['check'], { timeoutMs: 1800000 }); }
      catch (e) { if (e.exitCode !== 11) this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: '저장소 점검이 끝나지 않았습니다. 기존 백업의 현재 무결성도 보장하지 않습니다.' }; throw e; }
      if (partial) {
        // A partial snapshot does not take the complete one's place: the last complete backup stays what a restore uses.
        // With none yet, what it could not read is in no backup at all, so it is the best there is and takes that place
        // until a complete one comes (4.2 「한 번도 읽힌 적 없는 파일」; 끝판 카본 A1 · A2 — else nothing to restore,
        // 「첫 백업이 끝났습니다」 with nothing to restore, and no 「사흘 넘게」).
        const first = !this.config.lastBackup;
        this.stage('부분 백업 기록 중');
        await this.run(['tag', '--add', 'partial', ...(first ? ['--add', VERIFIED] : []), '--remove', 'pending', pending[0].id]);
        const marked = await this.snapshots([runTag, 'partial']);
        if (marked.length !== 1) throw new Error('부분 백업 기록을 확인하지 못했습니다.');
        const s = marked[0];
        this.config.lastPartial = { id: s.id, at: s.time, unreadable: unreadable.length, cut, files: s.summary?.total_files_processed || 0, bytes: s.summary?.total_bytes_processed || 0 };
        if (first) {
          if (!s.tags.includes(VERIFIED)) throw new Error('부분 백업 기록을 확인하지 못했습니다.');
          this.config.lastBackup = { id: s.id, at: s.time, files: this.config.lastPartial.files, bytes: this.config.lastPartial.bytes };
        }
        this.lastSummary = s.summary || null; this.lastRun = 'partial';
        // No promise that an earlier backup holds them: a file made since the last complete one is in none (GPT GA2).
        this.config.warning = [`다른 프로그램이 쓰는 중인 파일 ${unreadable.length}${cut ? '개 이상을' : '개를'} 이번 백업에 담지 못했습니다. 그 프로그램을 닫으면 다음 백업에 담깁니다.`, missingWarning(missing)].filter(Boolean).join(' ');
        await this.save();
      } else {
        this.stage('백업 완료 기록 중');
        await this.run(['tag', '--add', VERIFIED, '--remove', 'pending', pending[0].id]);
        const promoted = await this.snapshots([runTag, VERIFIED]);
        if (promoted.length !== 1) throw new Error('백업 완료 기록을 확인하지 못했습니다.');
        const s = promoted[0];
        this.config.lastBackup = { id: s.id, at: s.time, files: s.summary?.total_files_processed || 0, bytes: s.summary?.total_bytes_processed || 0 };
        this.config.lastPartial = null;
        this.lastSummary = s.summary || null; this.lastRun = 'complete';
        this.config.warning = missingWarning(missing); await this.save();
      }
      let busy = false;
      if (!this.config.health || this.config.health.status !== 'ok' || this.now() - Date.parse(this.config.health.checkedAt) >= (this.isCloud() ? 30 : 1) * DAY) {
        try { await this.fullCheck(); }
        catch (e) { busy = e.exitCode === 11; this.config.warning = busy ? '백업은 저장했고, 다른 작업이 백업 저장소를 쓰는 중이라 전체 데이터 점검은 다음 회차로 미뤘습니다.' : '백업은 저장했지만 전체 데이터 점검을 완료하지 못했습니다. 백업 위치와 연결을 확인한 뒤 다시 점검해 주세요.'; }
      }
      // Still locked by another process: the sample restore and the cleanup wait for the next run (review B3).
      if (!busy) {
        const probeInterval = this.config.lastProbe?.reason === 'limit' ? 30 * DAY : 7 * DAY;
        if (!this.config.lastProbe || this.now() - time(this.config.lastProbe.at) >= probeInterval) await this.probeBody();
        if (this.config.health?.status === 'ok' && !this.config.probeHold) {
          try { await this.retain(); } catch (e) { this.config.warning = `백업은 저장했습니다. 오래된 백업 정리는 보류합니다: ${this.clean(e.message)}`; }
        }
      }
      await this.save(); return this.getState();
  }
  /** The chosen folders that are there now. One that is gone — an unplugged drive, a folder moved or deleted — is
   *  left out of this backup, and the backups that hold it are kept (retain) and restored (restoreLatest); with
   *  none there the run fails as before (4.2 「사라진 원본 폴더」). Only "not there" counts: a folder that is there
   *  but cannot be read, or is no longer a plain folder, still stops the run. */
  async sourcesNow() {
    const present = [], missing = [];
    for (const source of this.config.sources) {
      try { await fs.lstat(source); present.push(source); }
      catch (e) { if (e.code !== 'ENOENT') throw e; missing.push(source); }
    }
    this.lastMissing = missing.length;
    this.config.missingSources = missing.length ? missing : null;
    if (!present.length) throw new Error('백업할 폴더를 모두 찾을 수 없습니다. 외장 드라이브라면 다시 연결해 주세요. 그 폴더가 든 이전 백업은 지우지 않습니다.');
    await validateSources(present, this.forbidden());
    return { present, missing };
  }
  /** What a partial snapshot could not read: its list snapshot read whole (a plain dump keeps only the tail). */
  async unreadableList(meta) {
    const decoder = new StringDecoder('utf8'); let text = '';
    await this.run(['dump', meta.id, '/workbackup-unreadable.json'], { timeoutMs: 600000, consumeStdout: async input => {
      for await (const chunk of input) { text += decoder.write(chunk); if (text.length > 64 * 1024 * 1024) throw new Error('읽지 못한 파일 목록이 너무 큽니다.'); }
      text += decoder.end();
    } });
    return checkList(json(text));
  }
  /** A list snapshot's content, kept in the state folder by its id once read (it never changes): retain() reads the
   *  lists of every partial snapshot it walks each run, and reading them from the repository each hour is slow. */
  async cachedList(meta) {
    this.listCache ||= new Map();
    if (this.listCache.has(meta.id)) return this.listCache.get(meta.id);
    const file = path.join(this.stateDir, 'lists', `${meta.id}.json`);
    let list = null;
    try { list = checkList(JSON.parse(await fs.readFile(file, 'utf8'))); } catch { list = null; }
    if (!list) { list = await this.unreadableList(meta); await this.keepList(meta.id, list); }
    this.listCache.set(meta.id, list); return list;
  }
  async keepList(id, list) {
    if (!isId(id)) return;
    try { await fs.mkdir(path.join(this.stateDir, 'lists'), { recursive: true }); await atomic(path.join(this.stateDir, 'lists', `${id}.json`), JSON.stringify(list)); } catch { /* only a cache */ }
  }
  async fullCheck() {
    this.stage('전체 데이터 점검 중 — 큰 백업은 오래 걸릴 수 있습니다');
    try {
      await this.run(['check', '--read-data']);
      this.config.health = { status: 'ok', checkedAt: new Date(this.now()).toISOString(), snapshotId: this.config.lastBackup?.id || null, detail: '이 시각에 저장소의 전체 데이터를 읽어 점검했습니다. 그 뒤에 추가한 백업은 구조 점검 결과를 따릅니다.' };
    } catch (e) {
      // Busy (exit 11) proves nothing about the data: keep the last health, retry next run (review GA3).
      if (e.exitCode !== 11) this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: this.clean(e.message) };
      throw e;
    } finally { await this.save(); }
  }
  async checkRepository() { return this.operation('check', async () => { await this.identity(); await this.fullCheck(); this.config.probeHold = null; await this.save(); return this.getState(); }); }
  async probeRestore() {
    this.assertBackupReady();
    return this.operation('probe', async () => { await this.identity(); await this.probeBody(); return this.getState(); });
  }
  async probeBody() {
    this.assertBackupReady();
    let snapshotId = null;
    const result = (value) => ({ at: new Date(this.now()).toISOString(), snapshotId, files: 0, bytes: 0, ...value });
    try {
      this.stage('작은 파일 복구 확인용 목록 읽는 중');
      const snapshots = await this.snapshots([VERIFIED]);
      // A failed sample is deterministic for this immutable snapshot. Recheck
      // that same sample; a different healthy file cannot clear its hold.
      const held = this.config.probeHold;
      const latest = held ? snapshots.find(s => s.id === held.snapshotId) : snapshots[0];
      if (!latest) this.config.lastProbe = result({ result: 'skipped', reason: 'no-snapshot' });
      else {
        snapshotId = latest.id;
        let sample;
        await this.run(['ls', '--json', '--recursive', snapshotId], { timeoutMs: 120000, consumeStdout: async input => { sample = await selectSample(input, snapshotId); } });
        if (!sample) this.config.lastProbe = result({ result: 'skipped', reason: 'no-small-file' });
        else {
          this.stage('작은 파일 1개 내려받아 해독 확인 중');
          let observed;
          await this.run(['dump', snapshotId, sample.path], { timeoutMs: 120000, consumeStdout: async input => { observed = await consumeSample(input, sample.size); } });
          if (!observed || observed.bytes !== sample.size) throw probeIssue('PROBE_SIZE', '표본 파일 내용의 크기가 백업 목록과 일치하지 않습니다.');
          this.config.lastProbe = result({ result: 'passed', reason: 'sample-decrypted', files: 1, bytes: observed.bytes });
          this.config.probeHold = null;
        }
      }
    } catch (e) {
      const mismatch = e.code === 'PROBE_SIZE';
      this.config.lastProbe = result({ result: mismatch ? 'failed' : e.code === 'PROBE_LIMIT' ? 'skipped' : 'incomplete', reason: mismatch ? 'size-mismatch' : e.code === 'PROBE_LIMIT' ? 'limit' : 'unconfirmed', detail: this.clean(e.message).slice(0, 1500) });
      if (mismatch) this.config.probeHold = { since: new Date(this.now()).toISOString(), snapshotId, cause: 'size-mismatch' };
      // Transport/engine errors don't prove corruption and don't trigger a new
      // automatic full download. Incomplete/skipped also cannot clear a hold.
    }
    await this.save(); return this.config.lastProbe;
  }
  async retain() {
    if (this.config.mode !== 'backup' || this.config.health?.status !== 'ok' || this.config.probeHold) throw new Error('이 저장소는 정리할 수 없습니다.');
    await this.identity();
    let now = this.now();
    if (this.isCloud()) {
      const probe = await this.probe(this.config.provider, this.cloudCredentials, { now }); now = probe.serverTime;
      const age = now - Date.parse(this.config.health.checkedAt);
      if (!Number.isFinite(age) || age < -300000 || age > 30 * DAY) throw new Error('최근 전체 점검과 서버 시간을 확인한 뒤 정리합니다.');
    }
    const all = await this.snapshots(); // Tag edits change IDs, so enumerate immediately before exact-ID deletion.
    // A recommended-backup snapshot is not this one's to keep or forget, as restoreLatest does not mix it in (끝판 카본 A2).
    const mine = s => s.hostname === this.config.vaultId && !s.tags.includes('recommended-verified-v1');
    const verified = all.filter(s => s.tags.includes(VERIFIED) && !s.tags.includes('recommended-verified-v1'));
    const latest = verified[0];
    if (!latest || latest.id !== this.config.lastBackup?.id) throw new Error('가장 최근 백업 번호가 바뀌었습니다.');
    // Kept: the latest complete snapshot, and — when newer — the newest partial one with its list (meta, same run tag),
    // so the files read since are not lost while one stays locked (4.2). Older partial and list snapshots go after 24 h.
    const keep = new Set([latest.id]);
    // A partial snapshot without exactly one list is never counted, so it cannot push out a good one (GPT GA1).
    const listsOf = s => listsIn(all, s);
    const own = all.filter(mine);
    const listed = s => s.tags.includes('partial') && listsOf(s).length === 1;
    const hold = s => { keep.add(s.id); if (s.tags.includes('partial')) for (const list of listsOf(s)) keep.add(list.id); };
    hold(latest);
    // While the complete place is itself a partial snapshot (no backup has read everything yet), the listed partial
    // snapshots before it stay too: a file only they hold — one the later ones could not read — is in no other. This
    // is the vault whose first backups were partial under the previous version (GPT workbackup-missing GA1); a
    // backup that reads everything ends it, and then what is in none of its files is gone from the source.
    if (latest.tags.includes('partial')) for (const s of own) if (listed(s) && Date.parse(s.time) < Date.parse(latest.time)) hold(s);
    const partial = own.find(listed);
    if (partial && Date.parse(partial.time) > Date.parse(latest.time)) hold(partial);
    // A folder taken out keeps its backups 30 days (4.2 「폴더 더하기 · 빼기」), counted from the first cleanup that saw it
    // out, by this clock — the server's for a cloud vault — so a PC clock set wrong when it was taken out cannot end
    // them early. Then it leaves the list, and its backups go like any other.
    const removed = (this.config.removedSources || []).filter(r => { r.since ??= new Date(now).toISOString(); return !(now - Date.parse(r.since) >= REMOVED_KEEP); });
    this.config.removedSources = removed.length ? removed : null;
    const chosen = folder => this.config.sources.some(s => same(s, folder)) || removed.some(r => same(r.path, folder));
    // A chosen folder the latest complete snapshot lacks (it could not be found) — or one taken out not 30 days ago —
    // keeps, the same way, the newest complete snapshot that has it and — when newer — the newest partial one: an
    // unplugged drive's only backup stays (4.2).
    for (const folder of foldersOf(own.filter(s => s.tags.includes(VERIFIED) || listed(s)))) {
      if (holds(latest, folder) || !chosen(folder)) continue;
      const complete = own.find(s => s.tags.includes(VERIFIED) && holds(s, folder)), newer = own.find(s => listed(s) && holds(s, folder));
      if (complete) hold(complete);
      if (newer && (!complete || Date.parse(newer.time) > Date.parse(complete.time))) hold(newer);
      // No backup has read all of it yet: while its complete place is a partial snapshot, the partial ones before that
      // place stay too, as for the whole vault above (끝판 카본 missing A1). With no complete one at all, its first
      // partial one takes that place and only the newest stays besides — not every one, hour after hour (nowstate A1).
      if (!complete) { const first = own.filter(s => listed(s) && holds(s, folder)).at(-1); if (first) hold(first); }
      else if (complete.tags.includes('partial')) for (const s of own) if (listed(s) && holds(s, folder) && Date.parse(s.time) < Date.parse(complete.time)) hold(s);
    }
    // Each path a kept partial snapshot could not read keeps the newest older backup that could read it — the one a
    // 「지금 상태」 restore takes it from (4.2 정리 규칙 「U 파일마다 그 파일이 든 가장 새 판」; GPT nowstate-c GA1: a file only
    // a middle partial one read). One that could not read it holds none of it and is passed; one whose list is unknown
    // may hold it and is kept on the way; a folder with something under it unread goes on to older ones. A file no
    // backup ever read keeps nothing, so one always locked does not keep every hour's snapshot.
    const listOf = s => (s.tags.includes('partial') && listsOf(s).length === 1 ? this.cachedList(listsOf(s)[0]) : null);
    for (const base of own.filter(s => keep.has(s.id) && listed(s))) {
      const list = await listOf(base);
      for (const folder of base.paths || []) {
        let left = [...new Set(list.unreadable.map(item => inside(folder, item)).filter(Boolean).map(rel => rel.toLowerCase()))];
        for (const s of own) {
          if (!left.length) break;
          if (s.id === base.id || Date.parse(s.time) >= Date.parse(base.time) || !holds(s, folder) || !(s.tags.includes(VERIFIED) || s.tags.includes('partial'))) continue;
          const known = await listOf(s), partial = s.tags.includes('partial');
          const unknown = partial && (!known || known.cut || known.unreadable.some(item => same(item, folder)));
          const blind = new Set((known?.unreadable || []).map(item => inside(folder, item)).filter(Boolean).map(rel => rel.toLowerCase()));
          left = left.filter(rel => {
            if (unknown) { hold(s); return true; }
            if (covered(blind, rel)) return true;
            hold(s); return unreadUnder(blind, rel);
          });
        }
      }
    }
    const ids = all.filter(s => !keep.has(s.id) && mine(s) && now - Date.parse(s.time) > DAY).map(s => s.id);
    if (!ids.length) return;
    this.stage('24시간이 지난 이전 백업 정리 중');
    for (let i = 0; i < ids.length; i += 100) await this.run(['forget', ...ids.slice(i, i + 100)]);
    const gone = new Set(ids);
    for (const id of gone) { this.listCache?.delete(id); await fs.rm(path.join(this.stateDir, 'lists', `${id}.json`), { force: true }).catch(() => {}); }
    await this.run(['prune', ...(this.isCloud() ? ['--max-repack-size', '0'] : [])]);
  }
  async restoreLatest({ parent }) {
    return this.operation('restore', async () => {
      await this.identity();
      if (this.config.readOnly) {
        const ids = (await this.run(['list', 'locks'], { timeoutMs: 60000 })).trim().split(/\s+/).filter(Boolean);
        if (ids.length > 100 || ids.some(id => !isId(id))) throw new Error('저장소 작업 상태를 확인하지 못했습니다.');
        for (const id of ids) {
          const lock = json(await this.run(['cat', 'lock', id], { timeoutMs: 60000 }));
          if (typeof lock.exclusive !== 'boolean' || lock.exclusive) throw new Error('다른 PC에서 백업 정리가 진행 중입니다. 작업이 끝난 뒤 복구해 주세요.');
        }
      }
      const base = await directory(parent);
      if ([...this.forbidden(), ...this.config.sources].some(p => overlap(base, p))) throw new Error('작업 폴더·백업 저장소와 분리된 복구 폴더를 선택해 주세요.');
      const latest = (await this.snapshots([VERIFIED]))[0];
      if (!latest) throw new Error('완료된 백업이 없습니다.');
      if (latest.tags?.includes('recommended-verified-v1')) {
        await require('./recommended.cjs').restoreWhole(this, base, latest);
        return this.getState();
      }
      if (!sanePaths(latest)) throw new Error('복구할 작업 폴더 목록을 확인하지 못했습니다.');
      let target, fromEarlier = 0, inNone = 0;
      try {
        this.stage('복구할 파일 목록 확인 중');
        // 「지금 상태」 (4.2): each folder from its own newest backup (restoreBases — a missing folder from the backups
        // retain() keeps for it, a newer partial one's content over the complete one's), and what that one could not
        // read from the earlier ones (gatherEarlier). 복구경로.json says from when.
        const all = (await this.snapshots()).filter(s => s.hostname === this.config.vaultId && !s.tags.includes('recommended-verified-v1'));
        const listed = all.filter(s => s.tags.includes('partial') && listsIn(all, s).length === 1 && sanePaths(s));
        const complete = all.filter(s => s.tags.includes(VERIFIED) && sanePaths(s));
        const listOf = s => this.cachedList(listsIn(all, s)[0]);
        const sets = await restoreBases(latest, complete, listed, listOf);
        if (!sets.length || sets.length > 30) throw new Error('복구할 작업 폴더 목록을 확인하지 못했습니다.');
        for (const set of sets) {
          if (set.snapshot.tags.includes('partial')) {
            // A list that is not exactly one says nothing of what it could not read (끝판 A5).
            if (listsIn(all, set.snapshot).length !== 1) set.cut = true;
            else { const list = await listOf(set.snapshot); set.cut ||= list.cut; set.wanted = [...new Set(list.unreadable.map(item => inside(set.original, item)).filter(Boolean))]; }
          }
          set.earlier = all.filter(s => s.id !== set.snapshot.id && Date.parse(s.time) < Date.parse(set.snapshot.time) && (complete.includes(s) || listed.includes(s)) && holds(s, set.original));
        }
        const plans = [];
        for (const [index, { snapshot, original, wanted = [], earlier = [], cut = false }] of sets.entries()) {
          const subtree = '/' + original.replace(/^([A-Za-z]):/, '$1').replaceAll('\\', '/').replace(/\/+$/, '');
          const selector = `${snapshot.id}:${subtree}`;
          let manifest;
          // A subtree selector resolves only directories. File sources fail here,
          // before a destination is created. List every node, including hardlinks.
          await this.run(['ls', '--json', '--recursive', selector], { consumeStdout: async stream => { manifest = await readManifest(stream, base); } });
          const name = `${String(index + 1).padStart(2, '0')}-${path.win32.basename(original).replace(/[<>:"/\\|?*]/g, '_') || '드라이브'}`;
          // What it could not read: from the earlier backups that hold this folder, each listed only when needed.
          const seen = earlier.map(s => {
            const e = { selector: `${s.id}:${subtree}`, at: s.time, cut: false, blind: new Set() };
            e.load = async () => {
              let had;
              await this.run(['ls', '--json', '--recursive', e.selector], { consumeStdout: async stream => { had = await readManifest(stream, base); } });
              if (s.tags.includes('partial')) {
                if (listsIn(all, s).length !== 1) e.cut = true;
                else {
                  const list = await listOf(s);
                  e.cut = list.cut || list.unreadable.some(item => same(item, original));
                  e.blind = new Set(list.unreadable.map(item => inside(original, item)).filter(Boolean).map(rel => rel.toLowerCase()));
                }
              }
              return had;
            };
            return e;
          });
          const { extra, notFound, folders } = await gatherEarlier(wanted, manifest, seen);
          plans.push({ original, selector, name, manifest, backupAt: snapshot.time, extra, notFound, folders, cut });
        }
        const space = await fs.statfs(base, { bigint: true });
        const required = plans.reduce((sum, p) => sum + [...p.manifest.nodes.values(), ...p.extra].reduce((n, entry) => n + (entry.type === 'dir' ? space.bsize : ((BigInt(entry.size) + space.bsize - 1n) / space.bsize) * space.bsize), 0n), 16n * 1024n * 1024n);
        if (required > space.bavail * space.bsize) throw new Error('복구할 파일을 저장할 여유 공간이 부족합니다. 다른 드라이브를 선택해 주세요.');
        target = path.join(base, `복구-${new Date(this.now()).toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`);
        await fs.mkdir(target); // Exclusive new empty directory; never restore into original paths.
        this.stage('파일 복구 및 내용 검증 중');
        // Export authenticated contents rather than original SID/DACL metadata. Each
        // selected subtree is extracted into fresh files and verified after writing.
        const mapping = [];
        for (const { original, selector, name, manifest, backupAt, extra, notFound, folders, cut } of plans) {
          const destination = path.join(target, name); await fs.mkdir(destination);
          await this.run(['dump', selector, '/', '--archive', 'tar'], { consumeStdout: stream => extractVerified(stream, destination, manifest) });
          if (extra.length) this.stage('읽지 못했던 파일을 이전 백업에서 가져오는 중');
          for (const file of extra) {
            const into = entryPath(destination, file.name);
            await fs.mkdir(path.dirname(into), { recursive: true });
            let written;
            await this.run(['dump', file.selector, '/' + file.name], { consumeStdout: async input => { written = await selection.writeFileStream(input, into, file.size, destination); } });
            if (!written || written.bytes !== file.size) throw new Error('이전 백업에서 가져온 파일의 크기가 기록과 다릅니다.');
          }
          fromEarlier += extra.length; inNone += notFound.length;
          // A folder taken out of the backup comes back too while its backups stay (4.2 「폴더 더하기 · 빼기」) — said here.
          const removedAt = (this.config.removedSources || []).find(r => same(r.path, original))?.at;
          mapping.push({ original, restoredFolder: name, backupAt, ...(removedAt ? { removedAt } : {}),
            ...(extra.length ? { fromEarlier: extra.map(f => ({ path: f.name, backupAt: f.backupAt })) } : {}),
            ...(folders.length ? { foldersFromEarlier: folders } : {}), ...(notFound.length ? { inNoBackup: notFound } : {}), ...(cut ? { listCut: true } : {}) });
        }
        await fs.writeFile(path.join(target, '복구경로.json'), JSON.stringify(mapping, null, 2), { flag: 'wx' });
      }
      catch (e) {
        this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: '복구 또는 검증이 끝나지 않았습니다. 전체 점검 전에는 이전 백업을 정리하지 않습니다.' };
        await this.save();
        throw new Error(`${e.message}\n${target ? `완료되지 않은 복구 폴더: ${target}` : '복구 파일을 만들기 전에 중단했습니다.'}`);
      }
      this.config.lastRestore = { path: target, at: new Date(this.now()).toISOString(), fromEarlier, inNone }; await this.save();
      return this.getState();
    });
  }
  discardCatalog() { clearTimeout(this.catalogTimer); this.fileCatalog = null; }
  assertCatalogReady() {
    if (!this.config?.repositoryId) throw selection.issue('NOT_CONFIGURED');
    if (!this.secret) throw selection.issue('CREDENTIAL_REQUIRED');
    if (this.stopping) throw selection.issue('JOB_BUSY');
  }
  catalogFor(token) {
    this.assertCatalogReady();
    if (!this.fileCatalog) throw selection.issue('CATALOG_EXPIRED');
    try { this.fileCatalog.assert(token, this.config, this.now()); }
    catch (e) { this.discardCatalog(); throw e; }
    return this.fileCatalog;
  }
  async hold(kind, fn) {
    // The new read/selected-restore flow must never clear a backup's error or
    // interrupted protection journal. operation() remains unchanged for it.
    if (this.job || this.stopping) throw selection.issue('JOB_BUSY');
    this.job = { kind, stage: '파일 목록 확인 중', percent: null }; this.emitState();
    try { return await fn(); }
    finally { this.transientSecrets = []; this.job = null; this.emitState(); this.emit('idle'); }
  }
  async assertNoRemoteMaintenance() {
    if (!this.config.readOnly) return;
    const ids = (await this.run(['list', 'locks'], { timeoutMs: 60000 })).trim().split(/\s+/).filter(Boolean);
    if (ids.length > 100 || ids.some(id => !isId(id))) throw selection.issue('OPERATION_FAILED');
    for (const id of ids) {
      const lock = json(await this.run(['cat', 'lock', id], { timeoutMs: 60000 }));
      if (typeof lock.exclusive !== 'boolean' || lock.exclusive) throw selection.issue('REMOTE_MAINTENANCE');
    }
  }
  async readFileManifest(plan, snapshotId, meter) {
    let manifest;
    await this.run(['ls', '--json', '--recursive', plan.selector], { timeoutMs: 300000, consumeStdout: async input => {
      manifest = await selection.parseCatalog(input, { root: path.resolve(this.stateDir, 'catalog-root'), snapshotId, budget: meter });
    } });
    if (!manifest) throw selection.issue('OPERATION_FAILED');
    return manifest;
  }
  async openFileCatalog() {
    this.assertCatalogReady();
    return this.hold('browse', async () => {
      this.discardCatalog();
      try {
        await this.assertNoRemoteMaintenance(); await this.identity();
        const snapshot = (await this.snapshots([VERIFIED]))[0];
        if (!snapshot) throw selection.issue('NO_SNAPSHOT');
        const plans = selection.sourcePlans(snapshot), manifests = [], meter = selection.budget();
        for (const plan of plans) manifests.push(await this.readFileManifest(plan, snapshot.id, meter));
        this.fileCatalog = new selection.FileCatalog({ snapshot, plans, manifests, repositoryId: this.config.repositoryId, vaultId: this.config.vaultId, profile: this.providerType, now: this.now() });
        this.catalogTimer = setTimeout(() => this.discardCatalog(), selection.LIMITS.ttl); this.catalogTimer.unref?.();
        return this.fileCatalog.meta();
      } catch (e) { throw selection.safeError(e); }
    });
  }
  queryFileCatalog({ token, query, offset }) { return this.catalogFor(token).query(query, offset); }
  setFileSelection(input) {
    if (this.job?.kind === 'restore-selected') throw selection.issue('JOB_BUSY');
    return this.catalogFor(input.token).select(input);
  }
  closeFileCatalog({ token }) {
    if (this.job?.kind === 'restore-selected') throw selection.issue('JOB_BUSY');
    this.catalogFor(token); this.discardCatalog(); return { profile: this.providerType, token, closed: true };
  }
  prepareSelectedRestore({ token, revision }) {
    if (this.job || this.stopping) throw selection.issue('JOB_BUSY');
    return this.catalogFor(token).capture(revision);
  }
  restoreSelected({ token, revision, parent }) {
    // Synchronous preflight runs again after main's native destination picker.
    // Once captured, profile switches/TTL/credential invalidation cannot change
    // the selected paths or silently replace the pinned immutable snapshot.
    const capture = this.prepareSelectedRestore({ token, revision });
    return this.hold('restore-selected', async () => {
      let target, marker; const previous = this.config.lastSelectedRestore;
      try {
        this.config.lastSelectedRestoreError = null; await this.save();
        let base;
        try { base = await directory(parent); }
        catch { throw selection.issue('OUTPUT_UNSAFE'); }
        if ([...this.forbidden(), ...this.config.sources, ...capture.plans.map(p => p.original)].some(p => overlap(base, p))) throw selection.issue('OUTPUT_UNSAFE');
        if (this.config.repositoryId !== capture.repositoryId || this.config.vaultId !== capture.vaultId) throw selection.issue('REPOSITORY_CHANGED');
        await this.assertNoRemoteMaintenance(); await this.identity();
        const snapshot = (await this.snapshots([VERIFIED])).find(s => s.id === capture.snapshotId);
        if (!snapshot) throw selection.issue('SNAPSHOT_GONE');
        const plans = selection.sourcePlans(snapshot);
        if (JSON.stringify(plans) !== JSON.stringify(capture.plans)) throw selection.issue('INTEGRITY_FAILED');
        const meter = selection.budget();
        for (const index of new Set(capture.files.map(f => f.sourceIndex))) {
          const manifest = await this.readFileManifest(plans[index], snapshot.id, meter);
          for (const file of capture.files.filter(f => f.sourceIndex === index)) {
            const fresh = manifest.nodes.get(file.path.toLowerCase());
            if (!fresh || fresh.type !== 'file' || fresh.path !== file.path || fresh.size !== file.size || fresh.mtime !== file.mtime) throw selection.issue('INTEGRITY_FAILED');
          }
        }
        await selection.spaceRequired(base, capture.files, plans);
        await directory(base);
        target = path.join(base, `선택복구-${new Date(this.now()).toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(6).toString('hex')}`);
        await fs.mkdir(target);
        marker = path.join(target, '_복구중_미완료.txt');
        await fs.writeFile(marker, '복구가 완료되지 않았습니다. 이 폴더를 완료된 복구본으로 사용하지 마세요.\n', { flag: 'wx' });
        let count = 0, bytes = 0;
        for (const file of capture.files) {
          this.stage(`선택한 파일 복구 및 확인 중 (${count}/${capture.files.length})`, Math.floor(count / capture.files.length * 100));
          const destination = require('./restore-tar.cjs').entryPath(target, `${plans[file.sourceIndex].label}/${file.path}`);
          await directory(target); await fs.mkdir(path.dirname(destination), { recursive: true }); await directory(path.dirname(destination));
          let written;
          await this.run(['dump', plans[file.sourceIndex].selector, '/' + file.path], { timeoutMs: 6 * 3600000, consumeStdout: async input => {
            written = await selection.writeFileStream(input, destination, file.size, target);
          } });
          if (!written || written.bytes !== file.size) throw selection.issue('INTEGRITY_FAILED');
          if (file.mtime) await fs.utimes(destination, new Date(file.mtime), new Date(file.mtime));
          count++; bytes += written.bytes;
        }
        const mapping = capture.files.map(f => ({ source: plans[f.sourceIndex].label, path: f.path, bytes: f.size }));
        await fs.writeFile(path.join(target, '복구경로.json'), JSON.stringify({ snapshotAt: snapshot.time, files: mapping }, null, 2), { flag: 'wx' });
        await fs.unlink(marker);
        this.config.lastSelectedRestore = { path: target, at: new Date(this.now()).toISOString(), files: count, bytes };
        // Persist before emitting success. If finalization fails, restore the old
        // result and recreate the incomplete marker below.
        await atomic(path.join(this.stateDir, 'settings.json'), JSON.stringify(this.config, null, 2));
        this.stage(`선택한 파일 ${count}개 복구 확인 완료`, 100);
        return this.getState();
      } catch (e) {
        const error = selection.safeError(e, 'RESTORE_INCOMPLETE');
        this.config.lastSelectedRestore = previous;
        if (marker) await fs.writeFile(marker, '복구가 완료되지 않았습니다. 이전 완료 결과는 유지됩니다.\n', { flag: 'wx' }).catch(() => {});
        this.config.lastSelectedRestoreError = { code: error.code, message: error.message, at: new Date(this.now()).toISOString(), ...(target ? { path: target } : {}) };
        if (error.code === 'INTEGRITY_FAILED') this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: error.message };
        await this.save().catch(() => {}); throw error;
      }
    });
  }
  async tick() {
    if (this.stopping || this.job || !this.secret || !this.config?.automatic || this.config.mode !== 'backup' || this.config.readOnly) return;
    const timing = schedule(this.config, this.intervalMs, this.now(), this.lastAttempt);
    if (timing.clockHold || timing.paused || timing.dueAt > this.now()) return;
    // No await before backupNow obtains the operation lock: simultaneous resume
    // and timer events can never start a second backup.
    if (this.config.pausedUntil) this.config.pausedUntil = null;
    try { await this.backupNow(); } catch { /* Error is persisted and surfaced in state; retry on the next interval. */ }
  }
  // A run killed mid-backup (power, logoff, time limit) leaves a restic lock that
  // makes check · forget fail with exit 11 until removed; restic and 0.5.0 never
  // removed it. `unlock` without --remove-all removes only stale locks, and with a
  // key that has no deleteFiles it hides them (B2 measurement M3b, STAGE1_DESIGN.md 4.2).
  async unlockStale() {
    if (!this.config?.repositoryId || !this.secret || this.config.readOnly || this.config.mode !== 'backup') return { ran: false };
    try { await this.run(['unlock'], { timeoutMs: 120000 }); return { ran: true, ok: true }; }
    catch (e) { return { ran: true, ok: false, exitCode: e.exitCode ?? null }; }
  }
  // One scheduled run. From stage 1 the Windows Task Scheduler is the only
  // scheduler (hourly · logon · wake · unlock); this decides whether this run
  // backs up and reports what happened for the run log. `dueMs` is 55 minutes so
  // an hourly trigger that fires a little early still runs.
  async runOnce({ skipCloud = null, force = false, dueMs = 55 * 60000 } = {}) {
    const c = this.config;
    if (!c?.repositoryId) return { outcome: 'skipped', reason: 'not-configured' };
    if (c.mode !== 'backup' || c.readOnly) return { outcome: 'skipped', reason: 'read-only' };
    if (!this.secret) return { outcome: 'skipped', reason: 'credential' };
    if (!c.automatic && !force) return { outcome: 'skipped', reason: 'off' };
    if (this.job || this.stopping) return { outcome: 'busy', reason: 'job' };
    if (skipCloud && this.isCloud() && !force) return { outcome: 'skipped', reason: String(skipCloud).slice(0, 40) };
    if (!force) {
      const timing = schedule(c, Math.min(this.intervalMs, dueMs), this.now(), this.lastAttempt);
      if (timing.clockHold) return { outcome: 'skipped', reason: 'clock' };
      if (timing.paused) return { outcome: 'skipped', reason: 'paused' };
      if (timing.dueAt > this.now()) return { outcome: 'not-due', nextAt: new Date(timing.dueAt).toISOString() };
      // An expired pause is cleared as tick() does; a person-started run leaves a pause alone (review B1).
      if (c.pausedUntil) c.pausedUntil = null;
    }
    this.resticStartedAt = null; this.lastSummary = null;
    const unlock = await this.unlockStale();
    const before = c.lastBackup?.id || null, started = this.now();
    try {
      this.lastRun = null; this.lastMissing = 0;
      await this.backupNow();
      const s = this.config.lastBackup, sum = this.lastSummary || {}, num = v => Number.isFinite(v) ? v : null;
      if (this.lastRun === 'partial') {
        const p = this.config.lastPartial;
        return { outcome: 'partial', unreadable: p?.unreadable ?? null, ...gone(this.lastMissing), unlock, durationMs: this.now() - started, newSnapshot: true, files: p?.files ?? null, bytes: p?.bytes ?? null,
          filesNew: num(sum.files_new), filesChanged: num(sum.files_changed), filesUnmodified: num(sum.files_unmodified), dataAdded: num(sum.data_added), resticStartedAt: this.resticStartedAt };
      }
      return { outcome: 'complete', ...gone(this.lastMissing), unlock, durationMs: this.now() - started, newSnapshot: !!s?.id && s.id !== before, files: s?.files ?? null, bytes: s?.bytes ?? null,
        filesNew: num(sum.files_new), filesChanged: num(sum.files_changed), filesUnmodified: num(sum.files_unmodified), dataAdded: num(sum.data_added), resticStartedAt: this.resticStartedAt };
    } catch (e) {
      const exitCode = e.exitCode ?? null;
      return { outcome: exitCode === 11 ? 'busy' : exitCode === 3 ? 'partial' : 'failed', exitCode, ...gone(this.lastMissing), unlock, durationMs: this.now() - started, resticStartedAt: this.resticStartedAt };
    }
  }
  startScheduler(pollMs = 30000) { this.stopScheduler(); this.timer = setInterval(() => { void this.tick(); }, pollMs); this.timer.unref?.(); }
  stopScheduler() { clearInterval(this.timer); }
  stop() {
    this.discardCatalog();
    this.stopping = true; this.stopScheduler();
    // Windows termination is forcible and can strand repository locks. Let the
    // active operation finish; operation() prevents accepting another job.
    return this.job ? new Promise(resolve => this.once('idle', resolve)) : Promise.resolve();
  }
}
module.exports = { BackupEngine, APP, VERIFIED, DAY, RESTIC_SHA256, parseKit, errorItems, gatherEarlier, restoreBases };
