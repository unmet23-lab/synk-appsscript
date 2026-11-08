'use strict';
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { BackupEngine } = require('./engine.cjs');
const { overlap } = require('./paths.cjs');
class Profiles extends EventEmitter {
  constructor({ root, ...options }) {
    super(); this.root = path.resolve(root); this.profile = 'local'; this.closing = false;
    this.engines = {
      local: new BackupEngine({ ...options, stateDir: path.join(this.root, 'vault'), providerType: 'local', intervalMs: 900000 }),
      b2: new BackupEngine({ ...options, stateDir: path.join(this.root, 'cloud-vault'), providerType: 'b2', intervalMs: 3600000 })
    };
    this.selections = { local: { sources: [], target: null }, b2: { sources: [], target: null } };
    for (const engine of Object.values(this.engines)) engine.on('state', () => { this.boundaries(); this.emit('state', this.getState()); });
    this.boundaries();
  }
  get current() { return this.engines[this.profile]; }
  get selection() { return this.selections[this.profile]; }
  boundaries() {
    this.engines.local.forbiddenPaths = [this.root];
    this.engines.b2.forbiddenPaths = [this.root, ...(this.engines.local.config ? [this.engines.local.config.repository] : [])];
  }
  async open() {
    for (const [name, engine] of Object.entries(this.engines)) {
      try { await engine.open(); } catch (e) { if (e.code !== 'RECOVERY_REQUIRED') throw e; }
      if (engine.config && !engine.config.repositoryId) this.selections[name] = { sources: [...engine.config.sources], target: name === 'local' ? path.dirname(engine.config.repository) : null };
    }
    if (!this.engines.local.config?.repositoryId && this.engines.b2.config?.repositoryId) this.profile = 'b2';
    this.boundaries();
  }
  select(profile) {
    if (!['local', 'b2'].includes(profile)) throw new Error('백업 종류를 확인해 주세요.');
    this.profile = profile; this.emit('state', this.getState()); return this.getState();
  }
  getState() {
    const profiles = {};
    for (const [name, e] of Object.entries(this.engines)) {
      const s = e.getState(); profiles[name] = { configured: s.configured, automatic: s.automatic, lastBackup: s.lastBackup, lastError: s.lastError, credentialRequired: s.credentialRequired, job: s.job, pausedUntil: s.pausedUntil, nextBackupAt: s.nextBackupAt, clockHold: s.clockHold, lastProbe: s.lastProbe };
    }
    return { ...this.current.getState(), profile: this.profile, selection: { sources: [...this.selection.sources], target: this.selection.target }, profiles };
  }
  assertOutput(parent) {
    const protectedPaths = [this.root];
    for (const e of Object.values(this.engines)) if (e.config) protectedPaths.push(...e.config.sources, ...(e.isCloud() ? [] : [e.config.repository]));
    if (protectedPaths.some(p => overlap(parent, p))) throw new Error('모든 작업 폴더·백업 저장소·앱 설정과 분리된 위치를 선택해 주세요.');
  }
  assertLocalTarget(parent) {
    if (this.engines.b2.config?.sources.some(p => overlap(parent, p))) throw new Error('클라우드 백업 대상 폴더 안에 로컬 저장소를 만들 수 없습니다.');
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
  async stop() { this.closing = true; clearInterval(this.timer); await Promise.all(Object.values(this.engines).map(e => e.stop())); }
  active() { return Object.values(this.engines).some(e => e.config?.automatic || e.job); }
  busy() { return Object.values(this.engines).some(e => e.job); }
}
module.exports = { Profiles };
