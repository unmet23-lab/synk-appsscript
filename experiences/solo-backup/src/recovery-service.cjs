'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { atomic } = require('./paths.cjs');
const { GoogleAuth } = require('./recovery-auth.cjs');
const { DriveVault, validateReadKey, parseEnvelope, MARKER, sha } = require('./recovery-vault.cjs');
const { failure, RecoveryError } = require('./recovery-http.cjs');
class RecoveryService extends EventEmitter {
  constructor({ root, secretStore, engine, client, openExternal, auth, vault, validateKey = validateReadKey }) {
    super(); this.dir = path.join(root, 'account-recovery'); this.secretStore = secretStore; this.engine = engine;
    this.auth = auth || new GoogleAuth({ dir: this.dir, secretStore, client, openExternal });
    this.vault = vault || new DriveVault(this.auth); this.validateKey = validateKey;
    this.record = {}; this.busy = false; this.error = null; this.candidates = []; this.nextAttempt = 0; this.failures = 0; this.stopping = false;
  }
  async open() {
    await this.auth.open();
    try { this.record = JSON.parse(await this.secretStore.decrypt(await fs.readFile(path.join(this.dir, 'recovery.bin')))); }
    catch (e) { if (e.code !== 'ENOENT') { this.blocked = true; this.error = '이 PC의 복구 정보 보관함을 열지 못했습니다. 기존 외부 사본은 유지됩니다.'; } }
    this.timer = setInterval(() => { void this.tick(); }, 60000); this.timer.unref?.();
  }
  async save(next) { await atomic(path.join(this.dir, 'recovery.bin'), await this.secretStore.encrypt(JSON.stringify(next))); this.record = next; }
  getState() {
    const auth = this.auth.getState(), verified = this.record.verified;
    const forCurrent = !!verified && !!this.engine.config?.repositoryId && verified.repositoryId === this.engine.config.repositoryId;
    return { ...auth, busy: this.busy, readKeyReady: !!this.record.readKey, status: this.blocked ? 'attention' : this.busy ? 'working' : this.error || this.record.invalidProof ? 'attention' : forCurrent ? 'verified' : this.record.pending ? 'pending' : 'notSaved', verifiedAt: forCurrent ? verified.verifiedAt : null, error: this.error, canImport: !this.engine.config, candidates: this.candidates.map(c => ({ id: c.file.id, createdAt: c.createdAt, bucket: c.bucket, repositoryLabel: c.repositoryLabel })) };
  }
  emitState() { this.emit('state', this.getState()); }
  async operation(fn) {
    if (this.busy || this.stopping) throw failure('BUSY');
    if (this.blocked) throw failure('INVALID');
    this.busy = true; this.error = null; this.emitState();
    try { const result = await fn(); this.failures = 0; this.nextAttempt = Date.now() + 86400000; return result; }
    catch (e) { const safe = e instanceof RecoveryError ? e : failure('INVALID'); this.error = safe.message; this.failures++; this.nextAttempt = Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(this.failures, 6)) + Math.random() * 30000; throw safe; }
    finally { this.busy = false; this.emitState(); this.emit('idle'); }
  }
  async connect() {
    // Do not discard a corrupt binding and silently upload to another account.
    // Only empty fresh-PC profiles may quarantine it and discover remote data.
    if (this.blocked && !this.engine.config) {
      await fs.rename(path.join(this.dir, 'recovery.bin'), path.join(this.dir, `recovery-damaged-${crypto.randomUUID()}.bin`));
      this.record = {}; this.blocked = false;
    }
    return this.operation(async () => {
      const bound = this.record.pending || this.record.verified;
      await this.auth.connect(bound ? this.record.subject : undefined);
      if (bound && this.record.subject && this.record.subject !== this.auth.tokens.sub) throw failure('ACCOUNT');
      await this.save({ ...this.record, subject: this.auth.tokens.sub });
      if (this.engine.config?.repositoryId && this.engine.secret && this.engine.config.mode === 'backup' && this.record.readKey) await this.syncInner();
      return this.getState();
    });
  }
  async disconnect() { return this.operation(async () => { await this.auth.disconnect(); this.candidates = []; return this.getState(); }); }
  // Operator provisioning only, never IPC. No RW key in the recovery envelope.
  async prepareReadKey(credentials) {
    return this.operation(async () => {
      if (!this.engine.config?.repositoryId || this.engine.job) throw failure('BUSY');
      const proof = await this.validateKey(this.engine.config.provider, credentials);
      await this.engine.operation('recovery-key', () => this.engine.validateReadCredential(credentials));
      if (this.auth.getState().connected) await this.syncInner({ credentials, ...proof });
      else await this.save({ ...this.record, readKey: { credentials, ...proof } });
      return this.getState();
    });
  }
  async sync() { return this.operation(() => this.syncInner()); }
  async syncInner(replacement, alreadyLocked = false) {
    if (!this.auth.getState().connected) throw failure('REAUTH');
    const subject = this.auth.tokens.sub;
    if (this.record.subject && this.record.subject !== subject) throw failure('ACCOUNT');
    const engine = this.engine, candidate = replacement || this.record.pendingKey || this.record.readKey;
    if (!candidate) throw new Error('복구 전용 연결 키가 준비되지 않았습니다.');
    const perform = async () => {
      const kit = engine.recoveryKit();
      const { bucketId } = await this.validateKey(kit.provider, candidate.credentials);
      if (bucketId !== candidate.bucketId) throw failure('INVALID');
      await engine.validateReadCredential(candidate.credentials);
      let pending = this.record.pending;
      if (pending) {
        pending = parseEnvelope(Buffer.from(JSON.stringify(pending)), subject);
        if (pending.kit.repositoryId !== kit.repositoryId || pending.kit.password !== kit.password || pending.readKey.keyId !== candidate.credentials.keyId || pending.readKey.applicationKey !== candidate.credentials.applicationKey) pending = null;
      }
      if (!pending) {
        pending = { format: MARKER, version: 1, generationId: crypto.randomUUID(), generation: Math.max(this.record.generation || 0, this.record.pending?.generation || 0) + 1, createdAt: new Date().toISOString(), subject, kit, readKey: candidate.credentials, bucketId, resticVersion: '0.19.1' };
        await this.save({ ...this.record, subject, pending, pendingKey: candidate });
      }
      const verified = await this.vault.publish(pending);
      await this.save({ ...this.record, subject, verified, invalidProof: false, generation: pending.generation, pending: null, pendingKey: null, readKey: candidate });
      engine.config.remoteRecovery = { ...verified, ownerHash: sha(subject) }; await engine.save();
      return this.getState();
    };
    return alreadyLocked ? perform() : engine.operation('recovery', perform);
  }
  async discover() {
    return this.operation(async () => {
      if (!this.auth.getState().connected) throw failure('REAUTH');
      const sub = this.auth.tokens.sub;
      if (this.record.subject && sub !== this.record.subject) throw failure('ACCOUNT');
      const files = await this.vault.list(sub), candidates = [];
      for (const file of files.filter(f => f.appProperties.status === 'committed')) {
        const e = await this.vault.read(file, sub);
        candidates.push({ file, createdAt: e.createdAt, bucket: e.kit.provider.bucket, repositoryLabel: e.kit.repositoryId.slice(0, 8) });
      }
      this.candidates = candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.file.id.localeCompare(a.file.id));
      return this.getState();
    });
  }
  async import(id) {
    return this.operation(async () => {
      if (this.engine.config) throw failure('INVALID');
      const file = this.candidates.find(c => c.file.id === id)?.file;
      if (!file || !this.auth.getState().connected) throw failure('INVALID');
      const e = await this.vault.read(file, this.auth.tokens.sub);
      const proof = await this.validateKey(e.kit.provider, e.readKey);
      if (proof.bucketId !== e.bucketId) throw failure('INVALID');
      await this.engine.importRecoveryKit({ text: JSON.stringify(e.kit), credentials: e.readKey, readOnly: true });
      await this.save({ ...this.record, subject: e.subject, readKey: { credentials: e.readKey, bucketId: e.bucketId }, generation: e.generation, verified: { fileId: file.id, repositoryId: e.kit.repositoryId, generationId: e.generationId, verifiedAt: new Date().toISOString(), digest: file.appProperties.digest } });
      return this.getState();
    });
  }
  async tick() {
    if (this.busy || this.blocked || this.stopping || this.engine.job || Date.now() < this.nextAttempt || !this.auth.getState().connected || !this.engine.config?.repositoryId || this.engine.config.mode !== 'backup' || (!this.record.readKey && !this.record.pendingKey)) return;
    // Re-read the current committed envelope daily; unchanged keys do not create
    // extra generations. Missing records are recreated without deleting anything.
    if (!this.record.pending && !this.record.invalidProof && this.record.verified?.repositoryId === this.engine.config.repositoryId) {
      try {
        await this.operation(() => this.engine.operation('recovery', async () => {
          const files = await this.vault.list(this.auth.tokens.sub), current = files.find(f => f.id === this.record.verified.fileId && f.appProperties.status === 'committed');
          if (!current) { await this.invalidateProof(); return this.syncInner(undefined, true); }
          let e;
          try {
            e = await this.vault.read(current, this.auth.tokens.sub);
            if (e.kit.repositoryId !== this.engine.config.repositoryId || e.kit.password !== this.engine.secret || e.readKey.keyId !== this.record.readKey.credentials.keyId) throw failure('INVALID');
            await this.validateKey(e.kit.provider, e.readKey);
          } catch (error) { if (error.code !== 'NETWORK') await this.invalidateProof(); throw error; }
          const verified = { ...this.record.verified, verifiedAt: new Date().toISOString() }; await this.save({ ...this.record, verified });
          this.engine.config.remoteRecovery = { ...verified, ownerHash: sha(e.subject) }; await this.engine.save();
        }));
      } catch { /* Safe error state; bounded retry. No remote removal. */ }
    } else { try { await this.sync(); } catch {} }
  }
  async invalidateProof() { await this.save({ ...this.record, invalidProof: true }); delete this.engine.config.remoteRecovery; await this.engine.save(); }
  async stop() { this.stopping = true; clearInterval(this.timer); this.auth.cancel?.(); if (this.busy) await new Promise(resolve => this.once('idle', resolve)); }
}
module.exports = { RecoveryService };
