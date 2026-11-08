'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { StringDecoder } = require('node:string_decoder');
const { ProcessOutput } = require('./process-output.cjs');
const { extractVerified, readManifest } = require('./restore-tar.cjs');
const { directory, overlap, atomic, validateSources } = require('./paths.cjs');
const b2 = require('./b2.cjs');

const APP = 'solo-work-backup-v1';
const VERIFIED = 'complete-structure-checked';
const DAY = 86400000;
const RESTIC_SHA256 = 'b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830';
const isId = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const json = s => JSON.parse(s.replace(/^\uFEFF/, ''));
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
  constructor({ stateDir, resticPath, secretStore, runner = null, now = () => Date.now(), intervalMs = 900000, providerType = 'local', forbiddenPaths = [], probe = b2.probeBucket }) {
    super();
    this.stateDir = path.resolve(stateDir); this.resticPath = resticPath; this.secretStore = secretStore;
    this.runner = runner; this.now = now; this.intervalMs = intervalMs;
    this.providerType = providerType; this.cloudCredentials = null; this.connection = null; this.transientSecrets = []; this.probe = probe; this.forbiddenPaths = forbiddenPaths;
    this.config = null; this.secret = null; this.job = null; this.child = null; this.stopping = false; this.lastAttempt = 0;
  }
  async open() {
    await fs.mkdir(this.stateDir, { recursive: true });
    this.stateDir = await directory(this.stateDir);
    await fs.mkdir(path.join(this.stateDir, 'cache'), { recursive: true });
    await fs.mkdir(path.join(this.stateDir, 'temp'), { recursive: true });
    if (!this.runner) {
      const hash = crypto.createHash('sha256').update(await fs.readFile(this.resticPath)).digest('hex');
      if (hash !== RESTIC_SHA256) throw new Error('백업 엔진 파일 검증에 실패했습니다. 배포본을 다시 받아 주세요.');
    }
    try { this.config = json(await fs.readFile(path.join(this.stateDir, 'settings.json'), 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('설정 파일이 손상되었습니다. 복구 키로 별도 PC에서 복구할 수 있습니다.'); }
    if (this.config) {
      const c = this.config;
      if (c.schema !== 1 || !['backup', 'restore'].includes(c.mode) || !/^[a-f0-9-]{36}$/.test(c.vaultId) || !Array.isArray(c.sources) || (c.repositoryId !== null && !isId(c.repositoryId))) throw new Error('설정 형식이 올바르지 않습니다.');
      if ((c.provider?.type || 'local') !== this.providerType) throw new Error('백업 프로필과 저장소 종류가 다릅니다.');
      if (this.isCloud()) {
        c.provider = b2.provider(c.provider, c.vaultId);
        if (c.repository !== b2.repository(c.provider, c.vaultId)) throw new Error('클라우드 저장소 경로가 일치하지 않습니다.');
      } else if (!path.isAbsolute(c.repository)) throw new Error('백업 폴더 경로가 올바르지 않습니다.');
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
    return this.getState();
  }
  getState() {
    const c = this.config;
    return { version: '0.2.0', configured: !!c?.repositoryId, mode: c?.mode || 'backup', sources: c?.sources || [], repository: c?.repository || null,
      providerType: this.providerType, provider: c?.provider || null, initializing: !!c && !c.repositoryId,
      cloudConnection: this.isCloud() && c && !c.repositoryId && this.cloudCredentials ? { endpoint: c.provider.endpoint, bucket: c.provider.bucket } : !c && this.connection ? { endpoint: this.connection.endpoint, bucket: this.connection.bucket } : null,
      credentialRequired: !!c && !this.secret, intervalMinutes: this.intervalMs / 60000, fullCheckDays: this.isCloud() ? 30 : 1, retryAfter: c?.retryAfter || null,
      recoverySaved: c?.recoverySaved || false, automatic: c?.automatic || false, lastBackup: c?.lastBackup || null,
      lastRestore: c?.lastRestore || null, health: c?.health || null, lastError: c?.lastError || null,
      warning: c?.warning || null, job: this.job ? { ...this.job } : null };
  }
  isCloud() { return this.providerType === 'b2'; }
  forbidden() { return [this.stateDir, ...this.forbiddenPaths, ...(!this.isCloud() && this.config ? [this.config.repository] : [])]; }
  async storeCredential(password, credentials = this.cloudCredentials) {
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
  async save() { await atomic(path.join(this.stateDir, 'settings.json'), JSON.stringify(this.config, null, 2)); this.emitState(); }
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
    this.job = { kind, stage: '준비 중', percent: null }; this.emitState();
    try {
      const value = await fn();
      if (this.config) { this.config.lastError = null; await this.save(); }
      return value;
    } catch (e) {
      if (this.config) { this.config.lastError = this.clean(e.message); await this.save().catch(() => {}); }
      const error = new Error(this.clean(e.message)); error.exitCode = e.exitCode; throw error;
    } finally { this.transientSecrets = []; this.job = null; this.emitState(); this.emit('idle'); }
  }
  clean(message) { return b2.redact(message, [this.secret, this.cloudCredentials?.keyId, this.cloudCredentials?.applicationKey, this.connection?.credentials.keyId, this.connection?.credentials.applicationKey, ...this.transientSecrets]); }
  async run(args, { repository = this.config.repository, password = this.secret, provider = this.config?.provider, credentials = this.cloudCredentials, timeoutMs = DAY, consumeStdout = null } = {}) {
    if (this.stopping && !this.job) throw new Error('앱을 종료하고 있습니다. 이전 정상 백업은 유지됩니다.');
    const { env, args: providerArgs } = b2.childOptions(provider, credentials, this.stateDir, process.env, password);
    if (this.runner) return this.runner(args, { repository, password, engine: this, consumeStdout, provider, credentials, env, providerArgs });
    return new Promise((resolve, reject) => {
      const child = spawn(this.resticPath, ['--repo', repository, ...providerArgs, '--retry-lock', '10s', ...args], { env, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      this.child = child;
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
      child.stderr.on('data', b => { errors = (errors + errorDecoder.write(b)).slice(-12000); });
      child.once('error', e => { consumerError ||= e; child.stdout.destroy(e); });
      child.once('close', async (code, signal) => {
        clearTimeout(timer); clearTimeout(forceStop); this.child = null;
        if (code !== 0 || signal) child.stdout.destroy(new Error('백업 엔진의 출력이 중단되었습니다.'));
        await consumed;
        const output = capture.end(); errors += errorDecoder.end();
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
      if ([this.stateDir, ...this.forbiddenPaths].some(p => overlap(real, p))) throw new Error('백업 경로와 앱 보관 경로가 겹칩니다.');
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
        if ([this.stateDir, ...this.forbiddenPaths].some(p => overlap(target, p))) throw new Error('앱 설정과 분리된 백업 폴더를 선택해 주세요.');
        const checked = await validateSources(sources, [target, this.stateDir, ...this.forbiddenPaths]);
        const vaultId = crypto.randomUUID();
        const repository = path.join(target, `work-backup-${vaultId}`);
        this.secret = crypto.randomBytes(32).toString('base64url');
        await atomic(path.join(this.stateDir, 'credential.bin'), await this.secretStore.encrypt(this.secret));
        this.config = { schema: 1, mode: 'backup', vaultId, repository, repositoryId: null, sources: checked, automatic: false, recoverySaved: false, lastBackup: null, health: null, lastError: null, warning: null };
        await this.save(); // Persist credentials and initialization journal before creating the encrypted repository.
      }
      await validateSources(this.config.sources, [path.dirname(this.config.repository), this.stateDir, ...this.forbiddenPaths]);
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
  async importRecoveryKit({ text, repository, credentials }) {
    return this.operation('import', async () => {
      if (this.config) throw new Error('기존 설정을 덮어쓸 수 없습니다.');
      const kit = parseKit(text);
      this.transientSecrets = [kit.password, credentials?.keyId, credentials?.applicationKey];
      if (kit.type !== this.providerType) throw new Error('복구 키와 맞는 로컬·클라우드 탭을 선택해 주세요.');
      const target = this.isCloud() ? kit.repository : await directory(repository);
      if (!this.isCloud() && [this.stateDir, ...this.forbiddenPaths].some(p => overlap(target, p))) throw new Error('앱 폴더와 분리된 백업 저장소를 선택해 주세요.');
      const options = { repository: target, password: kit.password, provider: kit.provider, credentials: this.isCloud() ? b2.credentials(credentials) : null, timeoutMs: 60000 };
      const info = json(await this.run(['cat', 'config'], options));
      if (info.id !== kit.repositoryId) throw new Error('복구 키에 기록된 저장소와 선택한 저장소가 다릅니다.');
      // Do not persist a new identity until a usable app snapshot has been found.
      const list = json(await this.run(['snapshots', '--json', '--tag', `${APP},vault:${kit.vaultId},${VERIFIED}`], options));
      if (!Array.isArray(list)) throw new Error('백업 목록을 읽지 못했습니다.');
      const latest = list.filter(s => isId(s.id) && s.tags?.includes(VERIFIED) && s.tags.includes(APP) && s.tags.includes(`vault:${kit.vaultId}`)).sort((a,b) => Date.parse(b.time) - Date.parse(a.time))[0];
      if (!latest) throw new Error('완료된 백업이 없습니다. 원래 PC에서 백업을 완료해 주세요.');
      await this.storeCredential(kit.password, credentials);
      this.secret = kit.password; this.cloudCredentials = this.isCloud() ? b2.credentials(credentials) : null;
      this.config = { schema: 1, mode: 'restore', ...(this.isCloud() ? { provider: kit.provider } : {}), vaultId: kit.vaultId, repository: target, repositoryId: info.id, sources: [], automatic: false, recoverySaved: true, lastBackup: { id: latest.id, at: latest.time, files: latest.summary?.total_files_processed || 0, bytes: latest.summary?.total_bytes_processed || 0 }, health: null, warning: '복구 전용 연결입니다. 이 저장소의 백업을 지우거나 자동 백업하지 않습니다.' };
      await this.save(); return this.getState();
    });
  }
  async setAutomatic(enabled) {
    if (this.job) throw new Error('진행 중인 작업이 끝난 뒤 변경해 주세요.');
    if (typeof enabled !== 'boolean' || this.config?.mode !== 'backup' || !this.config.repositoryId) throw new Error('자동 백업을 설정할 수 없습니다.');
    if (enabled && !this.config.recoverySaved) throw new Error('복구 키를 먼저 저장해 주세요.');
    this.config.automatic = enabled; await this.save(); return this.getState();
  }
  async backupNow() {
    return this.operation('backup', async () => {
      if (this.config?.mode !== 'backup' || !this.config.recoverySaved) throw new Error('복구 키를 먼저 저장한 뒤 백업을 시작해 주세요.');
      this.lastAttempt = this.now();
      await this.identity();
      await validateSources(this.config.sources, this.forbidden());
      const runTag = `run:${crypto.randomUUID()}`;
      this.stage('작업 파일 백업 중');
      await this.run(['backup', '--json', '--host', this.config.vaultId, '--tag', `${APP},vault:${this.config.vaultId},${runTag},pending`, '--', ...this.config.sources]);
      const pending = await this.snapshots([runTag, 'pending']);
      if (pending.length !== 1) throw new Error('새 백업을 정확하게 확인하지 못했습니다. 이전 정상 백업은 유지됩니다.');
      this.stage('저장 구조 확인 중');
      try { await this.run(['check'], { timeoutMs: 1800000 }); }
      catch (e) { this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: '저장소 점검이 끝나지 않았습니다. 기존 백업의 현재 무결성도 보장하지 않습니다.' }; throw e; }
      this.stage('백업 완료 기록 중');
      await this.run(['tag', '--add', VERIFIED, '--remove', 'pending', pending[0].id]);
      const promoted = await this.snapshots([runTag, VERIFIED]);
      if (promoted.length !== 1) throw new Error('백업 완료 기록을 확인하지 못했습니다.');
      const s = promoted[0];
      this.config.lastBackup = { id: s.id, at: s.time, files: s.summary?.total_files_processed || 0, bytes: s.summary?.total_bytes_processed || 0 };
      this.config.warning = null; await this.save();
      if (!this.config.health || this.config.health.status !== 'ok' || this.now() - Date.parse(this.config.health.checkedAt) >= (this.isCloud() ? 30 : 1) * DAY) {
        try { await this.fullCheck(); }
        catch { this.config.warning = '백업은 저장했지만 전체 데이터 점검을 완료하지 못했습니다. 백업 위치와 연결을 확인한 뒤 다시 점검해 주세요.'; }
      }
      if (this.config.health?.status === 'ok') {
        try { await this.retain(); } catch (e) { this.config.warning = `백업은 저장했습니다. 오래된 백업 정리는 보류합니다: ${this.clean(e.message)}`; }
      }
      await this.save(); return this.getState();
    });
  }
  async fullCheck() {
    this.stage('전체 데이터 점검 중 — 큰 백업은 오래 걸릴 수 있습니다');
    try {
      await this.run(['check', '--read-data']);
      this.config.health = { status: 'ok', checkedAt: new Date(this.now()).toISOString(), snapshotId: this.config.lastBackup?.id || null, detail: '이 시각에 저장소의 전체 데이터를 읽어 점검했습니다. 그 뒤에 추가한 백업은 구조 점검 결과를 따릅니다.' };
    } catch (e) {
      this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: this.clean(e.message) };
      throw e;
    } finally { await this.save(); }
  }
  async checkRepository() { return this.operation('check', async () => { await this.identity(); await this.fullCheck(); return this.getState(); }); }
  async retain() {
    if (this.config.mode !== 'backup' || this.config.health?.status !== 'ok') throw new Error('이 저장소는 정리할 수 없습니다.');
    await this.identity();
    let now = this.now();
    if (this.isCloud()) {
      const probe = await this.probe(this.config.provider, this.cloudCredentials, { now }); now = probe.serverTime;
      const age = now - Date.parse(this.config.health.checkedAt);
      if (!Number.isFinite(age) || age < -300000 || age > 30 * DAY) throw new Error('최근 전체 점검과 서버 시간을 확인한 뒤 정리합니다.');
    }
    const all = await this.snapshots(); // Tag edits change IDs, so enumerate immediately before exact-ID deletion.
    const verified = all.filter(s => s.tags.includes(VERIFIED));
    const latest = verified[0];
    if (!latest || latest.id !== this.config.lastBackup?.id) throw new Error('가장 최근 백업 번호가 바뀌었습니다.');
    const ids = all.filter(s => s.id !== latest.id && s.hostname === this.config.vaultId && now - Date.parse(s.time) > DAY).map(s => s.id);
    if (!ids.length) return;
    this.stage('24시간이 지난 이전 백업 정리 중');
    for (let i = 0; i < ids.length; i += 100) await this.run(['forget', ...ids.slice(i, i + 100)]);
    await this.run(['prune', ...(this.isCloud() ? ['--max-repack-size', '0'] : [])]);
  }
  async restoreLatest({ parent }) {
    return this.operation('restore', async () => {
      await this.identity();
      const base = await directory(parent);
      if ([...this.forbidden(), ...this.config.sources].some(p => overlap(base, p))) throw new Error('작업 폴더·백업 저장소와 분리된 복구 폴더를 선택해 주세요.');
      const latest = (await this.snapshots([VERIFIED]))[0];
      if (!latest) throw new Error('완료된 백업이 없습니다.');
      if (!Array.isArray(latest.paths) || !latest.paths.length || latest.paths.length > 30 || latest.paths.some(p => typeof p !== 'string' || !/^[A-Za-z]:[\\/]/.test(p) || p.split(/[\\/]/).some(part => part === '..' || part === '.'))) throw new Error('복구할 작업 폴더 목록을 확인하지 못했습니다.');
      let target;
      try {
        this.stage('복구할 파일 목록 확인 중');
        const plans = [];
        for (const [index, original] of latest.paths.entries()) {
          const subtree = '/' + original.replace(/^([A-Za-z]):/, '$1').replaceAll('\\', '/').replace(/\/+$/, '');
          const selector = `${latest.id}:${subtree}`;
          let manifest;
          // A subtree selector resolves only directories. File sources fail here,
          // before a destination is created. List every node, including hardlinks.
          await this.run(['ls', '--json', '--recursive', selector], { consumeStdout: async stream => { manifest = await readManifest(stream, base); } });
          const name = `${String(index + 1).padStart(2, '0')}-${path.win32.basename(original).replace(/[<>:"/\\|?*]/g, '_') || '드라이브'}`;
          plans.push({ original, selector, name, manifest });
        }
        const space = await fs.statfs(base, { bigint: true });
        const required = plans.reduce((sum, p) => sum + [...p.manifest.nodes.values()].reduce((n, entry) => n + (entry.type === 'dir' ? space.bsize : ((BigInt(entry.size) + space.bsize - 1n) / space.bsize) * space.bsize), 0n), 16n * 1024n * 1024n);
        if (required > space.bavail * space.bsize) throw new Error('복구할 파일을 저장할 여유 공간이 부족합니다. 다른 드라이브를 선택해 주세요.');
        target = path.join(base, `복구-${new Date(this.now()).toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`);
        await fs.mkdir(target); // Exclusive new empty directory; never restore into original paths.
        this.stage('파일 복구 및 내용 검증 중');
        // Export authenticated contents rather than original SID/DACL metadata. Each
        // selected subtree is extracted into fresh files and verified after writing.
        const mapping = [];
        for (const { original, selector, name, manifest } of plans) {
          const destination = path.join(target, name); await fs.mkdir(destination);
          await this.run(['dump', selector, '/', '--archive', 'tar'], { consumeStdout: stream => extractVerified(stream, destination, manifest) });
          mapping.push({ original, restoredFolder: name });
        }
        await fs.writeFile(path.join(target, '복구경로.json'), JSON.stringify(mapping, null, 2), { flag: 'wx' });
      }
      catch (e) {
        this.config.health = { status: 'attention', checkedAt: new Date(this.now()).toISOString(), detail: '복구 또는 검증이 끝나지 않았습니다. 전체 점검 전에는 이전 백업을 정리하지 않습니다.' };
        await this.save();
        throw new Error(`${e.message}\n${target ? `완료되지 않은 복구 폴더: ${target}` : '복구 파일을 만들기 전에 중단했습니다.'}`);
      }
      this.config.lastRestore = { path: target, at: new Date(this.now()).toISOString() }; await this.save();
      return this.getState();
    });
  }
  async tick() {
    if (this.stopping || this.job || !this.secret || !this.config?.automatic || this.config.mode !== 'backup' || Date.parse(this.config.retryAfter || '') > this.now()) return;
    const last = Math.max(this.lastAttempt, Date.parse(this.config.lastBackup?.at || '') || 0);
    if (this.now() - last < this.intervalMs) return;
    try { await this.backupNow(); } catch { /* Error is persisted and surfaced in state; retry on the next interval. */ }
  }
  startScheduler(pollMs = 30000) { this.stopScheduler(); this.timer = setInterval(() => { void this.tick(); }, pollMs); this.timer.unref?.(); }
  stopScheduler() { clearInterval(this.timer); }
  stop() {
    this.stopping = true; this.stopScheduler();
    // Windows termination is forcible and can strand repository locks. Let the
    // active operation finish; operation() prevents accepting another job.
    return this.job ? new Promise(resolve => this.once('idle', resolve)) : Promise.resolve();
  }
}
module.exports = { BackupEngine, APP, VERIFIED, DAY, RESTIC_SHA256, parseKit };
