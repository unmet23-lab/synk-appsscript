'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { BackupEngine } = require('./engine.cjs');
const { overlap, directory, spellings } = require('./paths.cjs');

// Every version's own folders on this PC: 0.5.0 and the 0.6.1 trial (0.7.0 never reads or writes them) and
// the installed 0.7.0's state and cache. A worker with a root of its own (test mode) must not reach them
// either — as a source, a target or a restore (카본 끝판 B1).
function appFolders(root, env = process.env) {
  const roaming = env.APPDATA || path.dirname(path.resolve(root));
  return [...['SoloWorkBackup', 'SoloWorkBackupRustBeta', 'SynkWorkBackup'].map(name => path.join(roaming, name)),
    ...(env.LOCALAPPDATA ? [path.join(env.LOCALAPPDATA, 'SynkWorkBackup')] : [])];
}

class Profiles extends EventEmitter {
  constructor({ root, workRoot = null, protectedPaths = [], ...options }) {
    super(); this.root = path.resolve(root); this.profile = 'local'; this.closing = false;
    // restic's cache and temporary files per profile, outside the roaming state when the host gives a local root.
    this.workRoot = workRoot ? path.resolve(workRoot) : null;
    // Folders besides its own that no profile may back up or put anything in (appFolders).
    this.protectedPaths = protectedPaths.map(p => path.resolve(p));
    const work = (name) => this.workRoot ? path.join(this.workRoot, name) : null;
    this.engines = {
      local: new BackupEngine({ ...options, stateDir: path.join(this.root, 'vault'), workDir: work('vault'), providerType: 'local', intervalMs: 900000 }),
      b2: new BackupEngine({ ...options, stateDir: path.join(this.root, 'cloud-vault'), workDir: work('cloud-vault'), providerType: 'b2', intervalMs: 3600000 })
    };
    this.selections = { local: { sources: [], target: null }, b2: { sources: [], target: null } };
    for (const engine of Object.values(this.engines)) engine.on('state', () => { this.boundaries(); this.emit('state', this.getState()); });
    this.boundaries();
  }
  get current() { return this.engines[this.profile]; }
  get selection() { return this.selections[this.profile]; }
  boundaries() {
    const own = [this.root, ...(this.workRoot ? [this.workRoot] : []), ...this.protectedPaths];
    this.engines.local.forbiddenPaths = own;
    this.engines.b2.forbiddenPaths = [...own, ...(this.engines.local.config ? [this.engines.local.config.repository] : [])];
  }
  async open() {
    // The real folders, as the engines keep theirs: a root given by an 8.3 short name (a TEMP on some PCs and
    // runners) is spelled out, so a place picked by its long name is still seen inside it (카본 끝판 A2).
    await fs.promises.mkdir(this.root, { recursive: true }); this.root = await directory(this.root);
    if (this.workRoot) { await fs.promises.mkdir(this.workRoot, { recursive: true }); this.workRoot = await directory(this.workRoot); }
    this.protectedPaths = await spellings(this.protectedPaths);
    for (const [name, engine] of Object.entries(this.engines)) {
      try { await engine.open(); } catch (e) { if (e.code !== 'RECOVERY_REQUIRED') throw e; }
      if (engine.config && !engine.config.repositoryId) this.selections[name] = { sources: [...engine.config.sources], target: name === 'local' ? path.dirname(engine.config.repository) : null };
    }
    if (!this.engines.local.config?.repositoryId && this.engines.b2.config?.repositoryId) this.profile = 'b2';
    this.boundaries();
  }
  select(profile) {
    if (!['local', 'b2'].includes(profile)) throw new Error('백업 종류를 확인해 주세요.');
    if (this.profile !== profile) for (const engine of Object.values(this.engines)) engine.discardCatalog();
    this.profile = profile; this.emit('state', this.getState()); return this.getState();
  }
  getState() {
    const profiles = {};
    for (const [name, e] of Object.entries(this.engines)) {
      const s = e.getState(); profiles[name] = { configured: s.configured, mode: s.mode, readOnly: s.readOnly, automatic: s.automatic, lastBackup: s.lastBackup, lastError: s.lastError, credentialRequired: s.credentialRequired, job: s.job, pausedUntil: s.pausedUntil, nextBackupAt: s.nextBackupAt, clockHold: s.clockHold, lastProbe: s.lastProbe, lastSelectedRestore: s.lastSelectedRestore, lastSelectedRestoreError: s.lastSelectedRestoreError };
    }
    return { ...this.current.getState(), profile: this.profile, selection: { sources: [...this.selection.sources], target: this.selection.target }, profiles };
  }
  assertOutput(parent) {
    const protectedPaths = [this.root, ...(this.workRoot ? [this.workRoot] : []), ...this.protectedPaths];
    for (const e of Object.values(this.engines)) {
      protectedPaths.push(...e.own());
      if (e.config) protectedPaths.push(...e.config.sources, ...(e.isCloud() ? [] : [e.config.repository]));
    }
    // As written and as the folder really is (an 8.3 short name and the like spelled out — 카본 끝판 A2).
    const spellings = [parent];
    try { spellings.push(fs.realpathSync.native(parent)); } catch { /* not there (yet): as written */ }
    if (spellings.some(s => protectedPaths.some(p => overlap(s, p)))) throw new Error('모든 작업 폴더·백업 저장소·앱 설정과 분리된 위치를 선택해 주세요.');
  }
  assertLocalTarget(parent) {
    if (this.engines.b2.config?.sources.some(p => overlap(parent, p))) throw new Error('클라우드 백업 대상 폴더 안에 로컬 저장소를 만들 수 없습니다.');
  }
  // Settings a scheduled run wrote since this window last looked (STAGE1_DESIGN.md 4.1).
  async reload() {
    let changed = false;
    for (const engine of Object.values(this.engines)) changed = (await engine.reload()) || changed;
    if (changed) { this.boundaries(); this.emit('state', this.getState()); }
    return changed;
  }
  tick() {
    if (this.closing) return;
    this.boundaries();
    // Independent repositories/caches: a slow cloud job must not starve local
    // backups. Each engine itself serializes its own jobs and retention.
    for (const engine of Object.values(this.engines)) void engine.tick();
    this.emit('state', this.getState());
  }
  start() { this.timer = setInterval(() => this.tick(), 30000); this.timer.unref?.(); this.tick(); }
  // One scheduled run over both profiles, one after the other (no timers).
  async runOnce(options = {}) {
    this.boundaries();
    const results = {};
    for (const [name, engine] of Object.entries(this.engines)) results[name] = await engine.runOnce(options);
    return results;
  }
  async stop() { this.closing = true; clearInterval(this.timer); await Promise.all(Object.values(this.engines).map(e => e.stop())); }
  active() { return Object.values(this.engines).some(e => e.config?.automatic || e.job); }
  busy() { return Object.values(this.engines).some(e => e.job); }
}
module.exports = { Profiles, appFolders };
