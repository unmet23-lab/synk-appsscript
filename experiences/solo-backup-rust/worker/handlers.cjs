'use strict';
// Handler bodies carried from the reviewed 0.5.0 Electron controller. Only the
// native adapter and awaited startup setter differ; the backup engine is shared.
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const engineRoot = process.env.SWB_ENGINE_ROOT || path.resolve(__dirname, '../engine');
const { Profiles, appFolders } = require(path.join(engineRoot, 'src/profiles.cjs'));
const { parseKit } = require(path.join(engineRoot, 'src/engine.cjs'));
const { RecoveryService } = require(path.join(engineRoot, 'src/recovery-service.cjs'));
const { clientConfig } = require(path.join(engineRoot, 'src/recovery-auth.cjs'));
const { protection } = require(path.join(engineRoot, 'src/protection.cjs'));
const fileSelection = require(path.join(engineRoot, 'src/restore-select.cjs'));
const { RecommendedBackup } = require(path.join(engineRoot, 'src/recommended.cjs'));
const { Account, APP_VERSION } = require(path.join(engineRoot, 'src/account.cjs'));
const { MoveService } = require(path.join(engineRoot, 'src/move-service.cjs'));
const contract = require('../contract/methods.json');

// 「새 PC로 옮겨 오기」의 입력 (4.6): what each folder's place may be, as the screen sends it.
const moveRefused = () => Object.assign(new Error('옮겨 올 내용을 확인하지 못했습니다.'), { code: 'BAD_INPUT' });
const MODES = ['original', 'newFolder', 'oneDriveGaps', 'skip'];
function moveChoices(v) {
  if (v.choices === undefined) return {};
  if (!v.choices || typeof v.choices !== 'object' || Array.isArray(v.choices) || Object.keys(v.choices).length > 30) throw moveRefused();
  return Object.fromEntries(Object.entries(v.choices).map(([folder, c]) => {
    if (folder.length > 1024 || !c || typeof c !== 'object' || !MODES.includes(c.mode) || (c.sameDrive !== undefined && typeof c.sameDrive !== 'boolean')) throw moveRefused();
    return [folder, { mode: c.mode, ...(c.sameDrive ? { sameDrive: true } : {}) }];
  }));
}
// 「옛 PC 백업에서 꺼내기」 (검토 M2): a PC that already writes takes old files out only into new folders — never into the
// places it backs up — whatever the screen chose, for every folder of the old backup (a folder left out stays left out).
function writerChoices(choices) {
  const kept = Object.fromEntries(Object.entries(choices).map(([folder, c]) => [folder, c.mode === 'skip' ? c : { mode: 'newFolder' }]));
  return new Proxy(kept, { get: (t, k) => (typeof k === 'string' && /^[A-Za-z]:[\\/]/.test(k) ? (Object.hasOwn(t, k) ? t[k] : { mode: 'newFolder' }) : t[k]) });
}
async function createApplication({ host, root, workRoot = null, resticPath, clientPath, publish, testMode = false }) {
  let closing = false, dialogBusy = false, launchAtLogin = false;
  const window = null, handlers = new Map();
  const secretStore = {
    encrypt: async value => Buffer.from(await host('secret.encrypt', [value]), 'base64'),
    decrypt: async bytes => host('secret.decrypt', [bytes.toString('base64')])
  };
  // Every version's own folders stay off-limits even when this run has a root of its own (test mode — 카본 끝판 B1).
  const profiles = new Profiles({root, workRoot, resticPath, secretStore, protectedPaths: appFolders(root)}); await profiles.open();
  let client = null;
  if (clientPath) client = clientConfig(JSON.parse(await fs.readFile(clientPath, 'utf8')));
  const shell = {
    openExternal: url => host('openExternal', [url]),
    openPath: async target => {
      const completed = Object.values(profiles.engines).flatMap(e => [e.config?.lastRestore?.path, e.config?.lastSelectedRestore?.path]);
      if (!completed.includes(target)) throw new Error('완료된 복구 폴더가 없습니다.');
      await require(path.join(engineRoot, 'src/paths.cjs')).directory(target);
      await host('openPath', [target]); return '';
    }
  };
  const dialog = {
    showOpenDialog: (_window, options) => host('dialog.open', [options]),
    showSaveDialog: (_window, options) => host('dialog.save', [options]),
    showMessageBox: (_window, options) => host('dialog.message', [options])
  };
  const googleOnly = url => { const u = new URL(url); if (u.origin !== 'https://accounts.google.com' || u.pathname !== '/o/oauth2/v2/auth') throw new Error('허용되지 않은 로그인 주소입니다.'); return shell.openExternal(url); };
  const recovery = new RecoveryService({root, secretStore, engine: profiles.engines.b2, client, openExternal: googleOnly});
  await recovery.open();
  // 「Google로 시작」 · 「보호 시작」 (STAGE1_DESIGN.md 2.1 · 4.5): the provisioning server, envelope v3, the cloud profile.
  const account = new Account({root, secretStore, client, openExternal: googleOnly, engine: profiles.engines.b2, appVersion: APP_VERSION});
  await account.open();
  // 「새 PC로 옮겨 오기」 (STAGE1_DESIGN.md 4.6 · 4.6b) on the cloud profile's repository: the Rust host gives files.* ·
  // folders.* · reinstall.*, the account's device pins the old device's backup while it is copied (move/pin).
  // 화면 세션 E19: 「프로그램과 설정」 reads the repository only when no kit is kept on this PC (a move from before it was
  // kept), and then as any read does: not while an engine job runs, under the engine lock.
  const move = new MoveService({ engine: profiles.engines.b2, host, stateDir: root, localDir: workRoot || root,
    server: { pinMove: id => account.provision.pinMove(id), unpinMove: () => account.provision.unpinMove() },
    repo: async fn => {
      if (jobsRunning()) throw Object.assign(new Error('진행 중인 작업이 끝난 뒤 다시 눌러 주세요.'), { code: 'JOB_BUSY' });
      if (!(await engineLock())) throw Object.assign(new Error('예약 백업이 도는 중입니다. 끝나면 다시 눌러 주세요.'), { code: 'RUN_ACTIVE' });
      try { return await fn(); } finally { engineUnlock(); }
    } });
  // The reinstall runs beside the window's other work: it never reads the repository, so it holds no engine job and a
  // scheduled backup is not kept waiting for it (up to hours).
  let reinstallJob = null;
  let moveProgress = null;
  launchAtLogin = await host('startup.read', []);
  const recommended = new RecommendedBackup({root:path.join(root,'recommended'),workRoot:workRoot?path.join(workRoot,'recommended'):null,resticPath,secretStore,
    plannerPath:path.join(path.dirname(resticPath),'WorkBackupPlanner.exe'),inventoryPath:path.join(path.dirname(resticPath),'WorkBackupInventory.exe'),
    protectedPaths:[root,...(workRoot?[workRoot]:[]),...appFolders(root),...Object.values(profiles.engines).flatMap(e=>e.config&&!e.isCloud()?[e.config.repository]:[])],
    registerStartup:()=>setStartup(true),cloudContext:()=>{
      const source=profiles.engines.b2,account=recovery.getState();
      return {ready:source.config?.mode==='backup'&&!source.config.readOnly&&!!source.cloudCredentials&&account.connected&&account.readKeyReady,
        connection:source.config?.provider?{...source.config.provider,credentials:source.cloudCredentials}:null,
        syncFor:engine=>recovery.operation(async()=>{
          const service=new RecoveryService({root:path.join(root,'recommended'),secretStore,engine,auth:recovery.auth,vault:recovery.vault});
          await service.open();try{await service.save({...service.record,subject:recovery.auth.tokens.sub,readKey:recovery.record.readKey});await service.sync();}finally{await service.stop();}
        })};
    }});
  await recommended.open();recommended.onChange=()=>push();
  function state() {
    const value = {...profiles.getState(), version:'0.7.0', recovery:recovery.getState(), account:account.state(), device:account.deviceName, launchAtLogin,recommended:recommended.state(),
      move:{ reinstall: reinstallJob ? { ...reinstallJob } : null, progress: moveProgress && cloud().job?.kind === 'move' ? { bytes: moveProgress.bytes, total: moveProgress.total, folder: moveProgress.folder, bytesPerSecond: moveProgress.bytesPerSecond } : null }};
    withRun(value);
    return {...value, protection:protection(value,{startupRegistered:launchAtLogin})};
  }
  function push() { publish(state()); }
  // A scheduled run's progress (progress.json, read by the host) shows as that profile's
  // job — 「예약 백업 · 단계 N%」 — while this window runs nothing there itself.
  let runProgress = null;
  function withRun(value) {
    const runs = runProgress?.profiles; if (!runs) return;
    for (const [name, job] of Object.entries(runs)) {
      if (!job || !value.profiles?.[name] || value.profiles[name].job) continue;
      const shown = { kind: job.kind || 'backup', stage: `예약 백업 · ${job.stage || '진행 중'}`, percent: job.percent ?? null, scheduled: true };
      value.profiles[name] = { ...value.profiles[name], job: shown };
      if (name === value.profile && !value.job) value.job = shown;
    }
  }
  // The engine lock (STAGE1_DESIGN.md 4.1): a scheduled run holds it for a whole run; this
  // window takes it only while one of its operations runs, reads the settings again first,
  // and lets it go when its last job ends. The window no longer schedules backups itself.
  // Lock and unlock reach the host in the order they were asked (host calls otherwise run on
  // separate threads), and a request counts as a user before its answer arrives, so a job
  // ending meanwhile cannot let the lock go under it (review GA1).
  let lockUsers = 0, lockChain = Promise.resolve();
  const jobsRunning = () => Object.values(profiles.engines).some(e => e.job);
  function lockCall(method) { const call = lockChain.then(() => host(method, [])); lockChain = call.catch(() => {}); return call; }
  // Settings reloads run one after another (reviews D2 · D3): an operation waits for a reload
  // already under way and then reads again, instead of acting on a half-opened engine.
  let reloadChain = Promise.resolve();
  function reloadSettings() { const run = reloadChain.then(() => profiles.reload()); reloadChain = run.catch(() => {}); return run; }
  async function engineLock() {
    lockUsers++;
    if ((await lockCall('engine.lock').catch(() => false)) !== true) { engineUnlock(); return false; }
    try { await reloadSettings(); } catch (e) { engineUnlock(); throw e; }
    return true;
  }
  function engineUnlock() { lockUsers = Math.max(0, lockUsers - 1); maybeUnlock(); }
  function maybeUnlock() { if (lockUsers === 0 && !jobsRunning()) void lockCall('engine.unlock').catch(() => {}); }
  for (const engine of Object.values(profiles.engines)) engine.on('idle', maybeUnlock);
  async function setStartup(enabled) { launchAtLogin = await host('startup.set', [enabled]); return launchAtLogin; }
  function launchJob(engine, action) {
    if (closing || engine.stopping || engine.job) throw new Error('진행 중인 작업이 끝난 뒤 다시 눌러 주세요.');
    void action().catch(() => push()); return state();
  }
  // `codes`: the error's code (and the details some carry, such as the device list of LIMIT_DEVICES) reach the screen.
  const CODE = /^[A-Z][A-Z_]{1,31}$/;
  // `job`: the handler works beside an engine job (화면 세션 E19 — 「프로그램과 설정」 while the first backup runs).
  function handle(name, action, {read=false,switching=false,safeErrors=false,codes=false,job=false,lock=!read&&!switching}={}) {
    handlers.set(name, async (...args) => {
      if (!read && (closing || dialogBusy || recovery.busy)) return {ok:false,error:'진행 중인 작업이 끝난 뒤 다시 눌러 주세요.'};
      // The slot is taken before the first wait, so a second click cannot slip in while the
      // first one waits for the engine lock (review D1).
      let claimed = false, held = false;
      if (!read) { dialogBusy = true; claimed = true; }
      try {
        if (lock) {
          try { held = await engineLock(); } catch (e) { return {ok:false,error:profiles.current.clean(e.message)}; }
          if (!held) return {ok:false,error:'예약 백업이 도는 중입니다. 끝나면 다시 눌러 주세요.',code:'RUN_ACTIVE'};
        }
        const context = {engine:profiles.current, selection:profiles.selection};
        if (!read && !switching && !job && context.engine.job) return {ok:false,error:'진행 중인 작업이 끝난 뒤 다시 눌러 주세요.'};
        if ((context.engine.config?.readOnly || context.engine.config?.mode === 'restore') && !contract[name].allowedReadOnly) return {ok:false,error:'복구 전용 연결입니다.',code:'READ_ONLY'};
        try { profiles.boundaries(); const result=await action(context,...args); push(); return {ok:true,value:result}; }
        catch(e) { if(safeErrors) {const clean=fileSelection.safeError(e);return {ok:false,error:clean.message,code:clean.code};}return {ok:false,error:context.engine.clean(e.message),...(e.code==='RUN_ACTIVE'||(codes&&CODE.test(e.code||''))?{code:e.code}:{}),...(codes&&e.details?{details:e.details}:{})}; }
      } finally { if (claimed) dialogBusy=false; if (held) engineUnlock(); }
    });
  }
  async function folder(title,multi=false) {
    const result=await dialog.showOpenDialog(null,{title,properties:['openDirectory','createDirectory',...(multi?['multiSelections']:[])]});
    return result.canceled?null:result.filePaths;
  }
    handle('getState', () => state(), { read: true });
    handle('previewRecommended',()=>{void recommended.discover().catch(()=>push());return state();},{switching:true});
    handle('backupRecommended',()=>{void recommended.backup().catch(()=>push());return state();},{switching:true});
    handle('startRecommended',async(_context,input)=>{
      if(recommended.busy)throw Error('추천 자료 작업이 끝난 뒤 다시 눌러 주세요.');
      let parent,keyFile;
      if(input?.destination==='local'&&!recommended.engine?.config){
        const picked=await folder('추천 백업을 보관할 별도 드라이브');if(!picked)return state();parent=picked[0];profiles.assertOutput(parent);
      }
      if(input?.destination==='local'&&!recommended.engine?.hasRecovery()){
        const picked=await dialog.showSaveDialog(null,{title:'추천 백업 복구 키 보관',defaultPath:'추천업무백업-복구키.json',filters:[{name:'복구 키',extensions:['json']}],properties:['showOverwriteConfirmation']});if(picked.canceled)return state();keyFile=picked.filePath;profiles.assertOutput(path.dirname(keyFile));
      }
      void recommended.start(input,{parent,keyFile}).catch(()=>push());return state();
    },{switching:true});
    handle('restoreRecommended',async()=>{
      if(recommended.busy)throw Error('추천 자료 작업이 끝난 뒤 다시 눌러 주세요.');
      const answer=await dialog.showMessageBox(null,{type:'question',message:'추천 백업 전체를 새 폴더에 복구할까요?',detail:'저장된 모든 자료를 내려받아 확인합니다. 원본은 유지하며 저장 용량·다운로드 사용량이 필요합니다. 같은 PC에서의 파일 복구이며 새 Windows에서 프로그램 실행까지 확인하지는 않습니다.',buttons:['취소','전체 복구 확인'],defaultId:0,cancelId:0});if(answer.response!==1)return state();
      const picked=await folder('복구한 추천 자료를 담을 별도 드라이브');if(!picked)return state();profiles.assertOutput(picked[0]);void recommended.restore(picked[0]).catch(()=>push());return state();
    },{switching:true});
    handle('selectProfile', (_context, name) => { profiles.select(name); return state(); }, { switching: true });
    // A restore-only connection to the account's backup chooses the folders it backs up once it takes the seat (화면
    // 세션 부탁 12): the dialog first, then the engine lock for the settings it writes.
    handle('chooseSources', async ({ engine, selection }) => {
      if (engine.isCloud() && engine.config?.mode === 'restore') {
        const picked = await folder('이 PC에서 백업할 작업 폴더 선택', true);
        // 화면 세션 E14: the dialog closed without a folder is not 「the same folders again」.
        if (!picked) throw Object.assign(new Error('폴더를 고르지 않았습니다.'), { code: 'CANCELED' });
        {
          if (!await engineLock()) throw Object.assign(new Error('예약 백업이 도는 중입니다. 끝나면 다시 눌러 주세요.'), { code: 'RUN_ACTIVE' });
          try { await profiles.engines.b2.chooseNextSources(picked); } finally { engineUnlock(); }
        }
        return [...(profiles.engines.b2.config?.nextSources || [])];
      }
      if (engine.config?.repositoryId || (engine.isCloud() && engine.config)) throw new Error('설정한 작업 폴더는 이 시험판에서 변경할 수 없습니다.'); const picked = await folder('백업할 작업 폴더 선택', true); if (picked) { await engine.resetUnfinishedSetup(); selection.sources = picked; } return [...selection.sources];
    }, { lock: false, codes: true });
    // Folders after setup (STAGE1_DESIGN.md 4.2 「폴더 더하기 · 빼기」): the dialog first, and only then the engine lock
    // for the change — a scheduled run is not held up while a dialog is open. Taking one out says its backups go in 30 days.
    async function changeSources(next) {
      if (!await engineLock()) throw Object.assign(new Error('예약 백업이 도는 중입니다. 끝나면 다시 눌러 주세요.'), { code: 'RUN_ACTIVE' });
      try { const engine = profiles.current; await engine.changeSources(next(engine.config?.sources || [])); }
      finally { engineUnlock(); }
    }
    const backupReady = engine => { if (engine.config?.mode !== 'backup' || engine.config.readOnly || !engine.config.repositoryId) throw new Error('백업을 설정한 뒤 폴더를 바꿀 수 있습니다.'); };
    handle('addSources', async ({ engine }) => {
      backupReady(engine);
      const picked = await folder('백업에 더할 작업 폴더 선택', true); if (!picked) return state();
      await changeSources(sources => [...sources, ...picked]); return state();
    }, { lock: false });
    handle('removeSource', async ({ engine }, folderPath) => {
      backupReady(engine);
      if (typeof folderPath !== 'string' || !engine.config.sources.includes(folderPath)) throw new Error('뺄 폴더를 목록에서 골라 주세요.');
      if (engine.config.sources.length < 2) throw Object.assign(new Error('백업할 폴더를 하나 이상 남겨 주세요.'), { code: 'LAST_FOLDER' });
      const answer = await dialog.showMessageBox(null, { type: 'question', message: '이 폴더를 백업에서 뺄까요?', detail: `${folderPath}\n\n이 폴더의 백업은 30일 뒤 지워집니다. 그때까지는 되살릴 수 있습니다. 폴더 안의 파일은 그대로 둡니다.`, buttons: ['취소', '빼기'], defaultId: 0, cancelId: 0 });
      if (answer.response !== 1) return state();
      await changeSources(sources => sources.filter(s => s !== folderPath)); return state();
    }, { lock: false, codes: true });
    handle('chooseTarget', async ({ engine, selection }) => { if (engine.isCloud() || engine.config?.repositoryId) throw new Error('설정한 저장소는 이 시험판에서 변경할 수 없습니다.'); const picked = await folder('백업을 보관할 폴더 선택'); if (picked) { profiles.assertLocalTarget(picked[0]); await engine.resetUnfinishedSetup(); selection.target = picked[0]; } return selection.target; }, { lock: false });
    handle('reuseLocalSources', ({ engine, selection }) => { if (!engine.isCloud() || engine.config) throw new Error('새 클라우드 연결에서만 폴더를 가져올 수 있습니다.'); selection.sources = [...(profiles.engines.local.config?.sources || [])]; return state(); }, { lock: false });
    handle('setup', async ({ engine, selection }) => { profiles.assertLocalTarget(selection.target); await engine.setup({ sources: selection.sources, parent: selection.target }); return state(); });
    handle('setupCloud', async ({ engine, selection }, input) => { if (!input || typeof input !== 'object') throw new Error('B2 연결 정보를 입력해 주세요.'); const { endpoint, bucket, keyId, applicationKey } = input; await engine.setupCloud({ sources: selection.sources, endpoint, bucket, credentials: { keyId, applicationKey } }); if (recovery.getState().connected && recovery.getState().readKeyReady) await recovery.sync().catch(() => {}); return state(); });
    handle('connectRecovery', async () => { await recovery.connect(); return state(); });
    handle('disconnectRecovery', async () => { await recovery.disconnect(); profiles.engines.b2.discardCatalog(); return state(); });
    handle('syncRecovery', async () => { await recovery.sync(); return state(); });
    handle('findRecoveryBackups', async () => { await recovery.discover(); return state(); });
    handle('importAccountRecovery', async (_context, id) => { if (typeof id !== 'string') throw new Error('복구할 백업을 선택해 주세요.'); await recovery.import(id); profiles.select('b2'); return state(); });
    handle('updateCloudCredentials', async ({ engine }, credentials) => { await engine.updateCloudCredentials(credentials); return state(); });
    handle('saveRecoveryKit', async ({ engine }) => {
      const result = await dialog.showSaveDialog(window, { title: '복구 키를 별도 장소에 저장', defaultPath: '업무백업-복구키.json', filters: [{ name: '복구 키', extensions: ['json'] }], properties: ['createDirectory', 'showOverwriteConfirmation'] });
      if (result.canceled) throw new Error('복구 키 저장을 취소했습니다. 저장 후 백업을 시작할 수 있습니다.');
      profiles.assertOutput(path.dirname(result.filePath));
      await engine.saveRecoveryKit(result.filePath); return state();
    });
    handle('startAutomatic', async ({ engine }) => { await engine.setAutomatic(true); profiles.tick(); return state(); });
    handle('setAutomatic', async ({ engine }, enabled) => { await engine.setAutomatic(enabled); if (enabled) profiles.tick(); return state(); });
    handle('backupNow', ({ engine }) => launchJob(engine, () => engine.backupNow()));
    handle('protectNow', ({ engine }) => { engine.assertBackupReady(); return launchJob(engine, () => engine.protectNow({ registerStartup: async () => setStartup(true) })); });
    handle('pauseAutomatic', async ({ engine }, minutes) => { await engine.pauseAutomatic(minutes); return state(); });
    handle('resumeAutomatic', async ({ engine }) => { await engine.resumeAutomatic(); profiles.tick(); return state(); });
    handle('probeRestore', ({ engine }) => { engine.assertBackupReady(); return launchJob(engine, () => engine.probeRestore()); });
    handle('checkRepository', async ({ engine }) => { if (engine.isCloud()) { const answer = await dialog.showMessageBox(window, { type: 'question', message: '클라우드에서 백업 전체를 내려받아 점검합니다.', detail: '오래 걸리고 회선을 많이 씁니다.', buttons: ['취소', '전체 점검'], defaultId: 0, cancelId: 0 }); if (answer.response !== 1) throw new Error('전체 점검을 취소했습니다.'); } return launchJob(engine, () => engine.checkRepository()); });
    // Where restored files go (화면 세션 부탁 2): `{ place: 'default' }` is 「다운로드 › 되살린 파일 (<날짜>)」 without a
    // dialog, anything else asks for a folder as before. A place that overlaps the backed-up folders is OUTPUT_UNSAFE.
    async function restorePlace(input, title) {
      if (input?.place !== undefined && !['default', 'pick'].includes(input.place)) throw Object.assign(new Error('되살릴 자리를 확인하지 못했습니다.'), { code: 'BAD_INPUT' });
      if (input?.place === 'default') {
        const known = await host('folders.downloads', []).catch(() => null);
        return { parent: typeof known === 'string' && path.isAbsolute(known) ? known : path.join(os.homedir(), 'Downloads'), named: true };
      }
      const picked = await folder(title);
      return picked ? { parent: picked[0], named: false } : null;
    }
    handle('restoreLatest', async ({ engine }, input) => {
      if (engine.config?.health?.status === 'attention') {
        const answer = await dialog.showMessageBox(window, { type: 'warning', message: '백업 점검을 아직 마치지 못했습니다.', detail: '복구를 시도하고 파일 내용을 검증합니다. 일부 파일은 복구되지 않을 수 있습니다.', buttons: ['취소', '복구 시도'], defaultId: 0, cancelId: 0 });
        if (answer.response !== 1) throw new Error('복구를 취소했습니다.');
      }
      const place = await restorePlace(input, '복구한 파일을 담을 별도 폴더 선택'); if (!place) throw new Error('복구를 취소했습니다.');
      profiles.assertOutput(place.parent);
      return launchJob(engine, () => engine.restoreLatest(place));
    }, { codes: true });
    function catalogInput({ engine }, input, keys, required = keys) {
      fileSelection.request(input, keys, required);
      if (!['local', 'b2'].includes(input.profile) || input.profile !== profiles.profile || engine !== profiles.engines[input.profile]) throw fileSelection.issue('CATALOG_EXPIRED');
      return input;
    }
    // 「옛 PC 백업에서 꺼내기」 (4.6): `from` an old device of this repository, `folder` · `sub` a part of its backup
    // (화면 세션 E26). The engine checks them; the files still go to a new folder only.
    handle('openFileCatalog', async (context, input) => {
      catalogInput(context, input, ['profile', 'from', 'folder', 'sub'], ['profile']);
      return context.engine.openFileCatalog({ from: input.from, folder: input.folder, sub: input.sub });
    }, { safeErrors: true });
    handle('browseBackupFolder', async (context, input) => {
      catalogInput(context, input, ['profile', 'from', 'folder', 'sub'], ['profile', 'folder']);
      return context.engine.browseBackupFolder({ from: input.from, folder: input.folder, sub: input.sub });
    }, { safeErrors: true });
    handle('queryFileCatalog', (context, input) => {
      catalogInput(context, input, ['profile', 'token', 'query', 'offset']); return context.engine.queryFileCatalog(input);
    }, { read: true, safeErrors: true });
    handle('setFileSelection', (context, input) => {
      catalogInput(context, input, ['profile', 'token', 'revision', 'action', 'ids', 'query'], ['profile', 'token', 'revision', 'action']);
      if (dialogBusy || closing || recovery?.busy) throw fileSelection.issue('JOB_BUSY');
      return context.engine.setFileSelection(input);
    }, { read: true, safeErrors: true });
    handle('closeFileCatalog', (context, input) => {
      catalogInput(context, input, ['profile', 'token']);
      if (dialogBusy || closing) throw fileSelection.issue('JOB_BUSY');
      return context.engine.closeFileCatalog(input);
    }, { read: true, safeErrors: true });
    handle('restoreSelected', async (context, input) => {
      const keys = ['profile', 'token', 'revision', 'place'], required = ['profile', 'token', 'revision'];
      catalogInput(context, input, keys, required);
      if (input.place !== undefined && !['default', 'pick'].includes(input.place)) throw fileSelection.issue('INVALID_REQUEST');
      context.engine.prepareSelectedRestore(input);
      const place = await restorePlace(input, '선택한 파일을 복구할 별도 폴더 선택');
      if (!place) return { profile: input.profile, token: input.token, canceled: true };
      catalogInput(context, input, keys, required);
      try { profiles.assertOutput(place.parent); } catch { throw fileSelection.issue('OUTPUT_UNSAFE'); }
      context.engine.prepareSelectedRestore(input);
      const started = launchJob(context.engine, () => context.engine.restoreSelected({ token: input.token, revision: input.revision, ...place }));
      return { profile: input.profile, token: input.token, started: true, state: started };
    }, { safeErrors: true });
    // 화면 세션 요청 16: 「그만두기」 on a running restore. It works beside the job, so it takes no slot or lock.
    handle('cancelRestore', ({ engine }) => engine.cancelRestore(), { read: true });
    handle('openSelectedRestoreFolder', async (context, input) => {
      catalogInput(context, input, ['profile']);
      const target = context.engine.config?.lastSelectedRestore?.path;
      if (!target) throw fileSelection.issue('INVALID_REQUEST');
      try { await require(path.join(engineRoot, 'src/paths.cjs')).directory(target); } catch { throw fileSelection.issue('OUTPUT_UNSAFE'); }
      if (await shell.openPath(target)) throw fileSelection.issue('OPERATION_FAILED');
      return { profile: input.profile, opened: true };
    }, { safeErrors: true });
    async function readKit() {
      const picked = await dialog.showOpenDialog(window, { title: '복구 키 파일 선택', properties: ['openFile'], filters: [{ name: '복구 키', extensions: ['json'] }] });
      if (picked.canceled) throw new Error('연결을 취소했습니다.');
      const stat = await fs.stat(picked.filePaths[0]); if (stat.size > 65536) throw new Error('복구 키 파일이 너무 큽니다.');
      return fs.readFile(picked.filePaths[0], 'utf8');
    }
    handle('importRecoveryKit', async ({ engine }, credentials) => {
      const text = await readKit();
      if (parseKit(text).type !== engine.providerType) throw new Error('복구 키와 맞는 로컬·클라우드 탭을 선택해 주세요.');
      const repo = engine.isCloud() ? null : await folder('백업 폴더 고르기(이름이 work-backup-으로 시작합니다)'); if (!engine.isCloud() && !repo) throw new Error('연결을 취소했습니다.');
      if (repo) profiles.assertLocalTarget(repo[0]);
      await engine.importRecoveryKit({ text, repository: repo?.[0], credentials }); return state();
    });
    handle('recoverCredential', async ({ engine }, credentials) => { await engine.recoverCredential(await readKit(), credentials); return state(); });
    handle('setLaunchAtLogin', async (_context, enabled) => {
      await setStartup(enabled);
      return state();
    }, { lock: false });
    // The account's requests. Each answers with the window's state unless it has a value of its own.
    const cloud = () => profiles.engines.b2;
    const objectInput = input => input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const sourcesOf = input => Array.isArray(input.sources) ? input.sources : cloud().config?.mode === 'restore' && cloud().config.nextSources?.length ? [...cloud().config.nextSources] : [...profiles.selections.b2.sources];
    function protect() { const engine = cloud(); return launchJob(engine, () => engine.protectNow({ registerStartup: async () => setStartup(true) })); }
    handle('signInGoogle', async (_context, input) => { await account.signIn({ hint: objectInput(input).hint }); return state(); }, { lock: false, codes: true });
    // 「보호 시작」: the repository and the envelope here, then the schedule and the first backup as a job.
    handle('startProtection', async (_context, input) => {
      const v = objectInput(input); profiles.select('b2');
      await account.startProtection({ sources: sourcesOf(v), googleStepDone: v.googleStepDone === true }); return protect();
    }, { codes: true });
    handle('continueBackup', async (_context, input) => { const v = objectInput(input); profiles.select('b2'); await account.continueBackup({ sources: sourcesOf(v), googleStepDone: v.googleStepDone === true }); return protect(); }, { codes: true });
    // Folders chosen before the backup was opened go into its settings too, so they outlast the window (화면 세션 부탁 12).
    handle('openAccountBackup', async () => {
      profiles.select('b2'); await account.openBackup();
      const picked = [...profiles.selections.b2.sources];
      if (picked.length) { try { await cloud().chooseNextSources(picked); } catch { /* the screen chooses them again */ } }
      return state();
    }, { codes: true });
    handle('devicesList', () => account.devices(), { lock: false, codes: true });
    handle('takeWriteSeat', async (_context, input) => { const v = objectInput(input); const r = await account.takeWriteSeat({ sources: sourcesOf(v) }); return { previous: r.previous, state: state() }; }, { codes: true });
    handle('revokeDevice', (_context, deviceId) => account.revokeDevice(deviceId), { lock: false, codes: true });
    handle('reportLost', (_context, deviceId) => account.reportLost(deviceId), { lock: false, codes: true });
    handle('rotateReadKey', async (_context, input) => { await account.rotateReadKey({ googleStepDone: objectInput(input).googleStepDone === true }); return state(); }, { codes: true });
    handle('restorePlan', (_context, at) => account.restorePlan(at), { lock: false, codes: true });
    handle('restoreRun', async (_context, at) => { const r = await account.restoreRun(at); return { jobId: r.jobId, ...(r.left ? { left: r.left } : {}), state: state() }; }, { codes: true });
    handle('restoreJob', (_context, jobId) => account.restoreJob(jobId), { lock: false, codes: true });
    handle('restoreChoose', async (_context, jobId, choice) => { await account.restoreChoose(jobId, choice); return state(); }, { codes: true });
    // The screen told how the restore ended (account.restoreEnded): it is not told again.
    handle('restoreSeen', async (_context, jobId) => { await account.restoreSeen(jobId); return state(); }, { lock: false, codes: true });
    // 「그만두기」 while a Google sign-in waits in the browser (화면 세션 부탁 13): the waiting request ends as CANCELED.
    // It reads nothing and takes no slot, so it reaches the worker while that request holds the window.
    handle('cancelGoogle', () => { account.cancelSignIn(); recovery.auth?.cancel?.(); return null; }, { read: true });
    // 「Google 기기 관리 열기」 · 「연결된 앱 열기」 (화면 세션 부탁): the screen names the page, the account code gives its address.
    handle('openGoogleAccount', async (_context, kind) => { await shell.openExternal(account.googlePage(kind)); return null; }, { read: true, codes: true });
    // 「새 PC로 옮겨 오기」 (4.6 · 4.6b). Each answers with what its screen shows (공유 노트 「옮겨오기_화면자료」).
    // The old device must be one the repository has backups of (move.devices), not any name the screen sends.
    async function moveFrom(v) {
      if (typeof v.from !== 'string' || !(await move.devices()).some(d => d.from === v.from)) throw Object.assign(new Error('옮겨 올 PC를 다시 골라 주세요.'), { code: 'BAD_INPUT' });
      return v.from;
    }
    handle('moveDevices', () => move.devices(), { codes: true });
    // The places a move uses: on a PC that already writes, new folders only — the preview shows what the move does
    // (GPT workbackup-movewire GA1).
    const placesOf = v => (cloud().config?.mode === 'backup' ? writerChoices(moveChoices(v)) : moveChoices(v));
    // One old device at a time: a reinstall for one and a move of another would write each other's state (GPT GA2).
    const reinstalling = () => Object.assign(new Error('프로그램을 까는 중입니다. 끝난 뒤 다시 눌러 주세요.'), { code: 'JOB_BUSY' });
    handle('movePreview', async (_context, input) => { const v = objectInput(input); const from = await moveFrom(v); return move.preview({ from, choices: placesOf(v) }); }, { codes: true });
    handle('moveStart', async (_context, input) => {
      const v = objectInput(input), engine = cloud();
      if (reinstallJob?.running) throw reinstalling();
      const from = await moveFrom(v), choices = placesOf(v);
      // Again after the wait: this request holds the window's slot (dialogBusy), so none should have started meanwhile.
      if (reinstallJob?.running) throw reinstalling();
      moveProgress = null;
      return launchJob(engine, () => engine.operation('move', () => move.start({ from, choices, onProgress: p => { trackMove(p); engine.stage('옮겨 오는 중', Number.isFinite(p.percent) ? p.percent : null); } })));
    }, { codes: true });
    // 화면 세션 E6: only a place the last move's result names opens (its side folder, a new folder, a root).
    handle('moveOpen', async (_context, input) => {
      const v = objectInput(input);
      if (typeof v.path !== 'string' || v.path.length > 1024) throw moveRefused();
      const target = (await move.places()).find(p => p.toLowerCase() === v.path.toLowerCase());
      if (!target) throw Object.assign(new Error('옮겨 온 결과에 없는 자리입니다.'), { code: 'BAD_INPUT' });
      try { await require(path.join(engineRoot, 'src/paths.cjs')).directory(target); }
      catch { throw Object.assign(new Error('그 폴더가 지금 없습니다.'), { code: 'MOVE_GONE' }); }
      await host('openPath', [target]); return null;
    }, { read: true, codes: true });
    // 화면 세션 E10: a restore-only connection keeps the folders it will back up once it takes the seat, by path — the
    // places the last move put files (not 「따로 둔 것」) or folders already kept; no dialog.
    handle('setNextSources', async (_context, input) => {
      const v = objectInput(input);
      if (!Array.isArray(v.sources) || !v.sources.length || v.sources.length > 30 || v.sources.some(p => typeof p !== 'string' || p.length > 1024)) throw moveRefused();
      const allowed = [...await move.places({ keep: true }), ...(profiles.engines.b2.config?.nextSources || [])];
      const picked = v.sources.map(p => allowed.find(a => a.toLowerCase() === p.toLowerCase()));
      if (picked.some(p => !p)) throw Object.assign(new Error('옮겨 온 자리나 이미 고른 폴더만 적을 수 있습니다.'), { code: 'BAD_INPUT' });
      await profiles.engines.b2.chooseNextSources([...new Set(picked)]);
      return [...(profiles.engines.b2.config?.nextSources || [])];
    }, { codes: true });
    handle('moveResult', () => move.result(), { read: true });
    // 화면 세션 E7: the move's bytes, total and folder as they come, and a speed over at least five seconds (no time is
    // guessed here: the screen says what it can from these).
    function trackMove(p) {
      const now = Date.now(), prev = moveProgress;
      let rate = prev?.bytesPerSecond ?? null, mark = prev?.mark || { t: now, bytes: p.bytes || 0 };
      if (now - mark.t >= 5000) { const r = Math.max(0, ((p.bytes || 0) - mark.bytes) / ((now - mark.t) / 1000)); rate = rate == null ? r : rate * 0.6 + r * 0.4; mark = { t: now, bytes: p.bytes || 0 }; }
      moveProgress = { bytes: Number.isSafeInteger(p.bytes) ? p.bytes : null, total: Number.isSafeInteger(p.total) ? p.total : null, folder: typeof p.folder === 'string' ? p.folder : null,
        bytesPerSecond: rate == null ? null : Math.round(rate), mark };
    }
    // A move stopped part-way is told by its state (화면 세션 E1); `running`: one runs in this window now.
    handle('moveState', async () => ({ ...await move.status(), running: cloud().job?.kind === 'move' }), { read: true });
    // 화면 세션 E19: 「프로그램과 설정」 works beside an engine job (the first backup after the handover): none of it holds
    // the repository — the kit is kept on this PC (MoveService.kitContext).
    handle('moveReinstallList', () => move.reinstallList(), { lock: false, job: true, codes: true });
    handle('moveReinstall', (_context, input) => {
      const v = objectInput(input);
      if (!Array.isArray(v.ids) || !v.ids.length || v.ids.length > 200 || v.ids.some(id => typeof id !== 'string' || id.length > 128)) throw moveRefused();
      if (reinstallJob?.running) throw reinstalling();
      if (cloud().job?.kind === 'move') throw Object.assign(new Error('옮겨 오는 중입니다. 끝난 뒤 다시 눌러 주세요.'), { code: 'JOB_BUSY' });
      reinstallJob = { running: true, stage: 'start', at: new Date().toISOString(), results: null, error: null, current: null, left: null, approval: false };
      // 화면 세션 E18: the program being installed, how many are left, and whether the person has yet to say yes.
      void move.reinstall({ ids: v.ids, onProgress: p => { reinstallJob = { ...reinstallJob, stage: p.stage === 'elevated' ? 'elevated' : 'user', current: typeof p.current === 'string' ? p.current : null,
        left: Number.isSafeInteger(p.left) ? p.left : null, approval: p.approval === true }; push(); } })
        .then(results => { reinstallJob = { ...reinstallJob, running: false, stage: 'done', results }; })
        .catch(e => { reinstallJob = { ...reinstallJob, running: false, stage: 'failed', error: CODE.test(e.code || '') ? e.code : 'REINSTALL_FAILED' }; })
        .finally(() => push());
      return state();
    }, { lock: false, job: true, codes: true });
    handle('moveRestoreSettings', () => {
      // Not while a move places files or programs are installed: the settings go where those land.
      if (cloud().job?.kind === 'move') throw Object.assign(new Error('옮겨 오는 중입니다. 끝난 뒤 다시 눌러 주세요.'), { code: 'JOB_BUSY' });
      if (reinstallJob?.running) throw reinstalling();
      return move.restoreSettings();
    }, { lock: false, job: true, codes: true });
    handle('moveChecklist', () => move.checklist(), { lock: false, job: true, codes: true });
    handle('moveCheck', (_context, input) => { const v = objectInput(input); if (typeof v.id !== 'string' || v.id.length > 128 || typeof v.done !== 'boolean') throw moveRefused(); return move.check({ id: v.id, done: v.done }); }, { lock: false, job: true, codes: true });
    // 화면 세션 E16: a table program's official or license page. The screen names the program and the page; the address
    // comes from the table this app carries, and the host opens only an address that table holds.
    handle('moveOpenProgramPage', async (_context, input) => {
      const v = objectInput(input);
      const program = require(path.join(engineRoot, 'src/move-apps.cjs')).TABLE.programs.find(p => p.id === v.id);
      const url = program && (v.kind === 'site' || v.kind === 'license') ? program[v.kind] : null;
      if (typeof url !== 'string' || !url.startsWith('https://')) throw moveRefused();
      await shell.openExternal(url); return null;
    }, { read: true, codes: true });
    handle('moveRelease', async () => { await move.release(); return state(); }, { lock: false, codes: true });
    handle('openRestoreFolder', async ({ engine }) => { const target = engine.config?.lastRestore?.path; if (!target) throw new Error('완료된 복구 폴더가 없습니다.'); const error = await shell.openPath(target); if (error) throw new Error(error); return null; }, { lock: false });

  profiles.on('state',push); recovery.on('state',push);
  // No backup timer here any more: Windows Task Scheduler starts the runs (STAGE1_DESIGN.md
  // 4.1 · 4.2). The account-recovery check runs only while this window holds the engine
  // lock, so it never writes settings under a scheduled run (review N5).
  clearInterval(recovery.timer);
  async function recoveryTick() {
    if (closing || recovery.busy) return;
    let held = false;
    try { held = await engineLock(); if (held) await recovery.tick(); } catch { /* next minute */ } finally { if (held) engineUnlock(); }
  }
  // The account's look each hour while this window is open, and the envelope read back once a day (4.5). It writes the
  // engine's settings (moved, pins), so it runs under the engine lock like the recovery check.
  let accountAt = 0, recheckAt = 0;
  async function accountTick() {
    // Each minute while a restore holds this PC, so the hold goes soon after the restore ends.
    if (closing || dialogBusy || Date.now() - accountAt < (account.holding() ? 60000 : 3600000)) return;
    let held = false;
    try {
      held = await engineLock(); if (!held) return;
      accountAt = Date.now();
      const recheck = Date.now() - recheckAt >= 86400000;
      await account.refresh({ recheck });
      if (recheck) recheckAt = Date.now();
    } catch { /* the next hour */ } finally { if (held) engineUnlock(); push(); }
  }
  async function refreshRun() {
    if (closing) return;
    const next = await host('run.progress', []).catch(() => null);
    if (JSON.stringify(next ?? null) === JSON.stringify(runProgress)) return;
    const ended = !!runProgress && !next;
    runProgress = next ?? null;
    // A run that just ended wrote new settings; read them (writes are atomic, no lock needed).
    if (ended && lockUsers === 0 && !jobsRunning()) await reloadSettings().catch(() => {});
    push();
  }
  const timers = [setInterval(() => void recoveryTick(), 60000), setInterval(() => void refreshRun(), 5000), setInterval(() => void accountTick(), 60000)];
  for (const t of timers) t.unref?.();
  void recoveryTick(); void refreshRun(); void accountTick();
  let startupRefresh = null;
  return {
    state,
    async call(name,args) {
      if (!Object.hasOwn(contract,name) || !handlers.has(name)) throw new Error('INVALID_METHOD');
      if(name==='getState') {
        startupRefresh ||= host('startup.read',[]).then(value=>{launchAtLogin=value===true;return true;},()=>false).finally(()=>{startupRefresh=null;});
        if (!await startupRefresh) return {ok:false,error:'앱 내부 연결에 문제가 생겼습니다. 앱을 다시 실행해 주세요.',code:'STARTUP_READ_FAILED'};
      }
      return handlers.get(name)(...args);
    },
    async stop() { if(closing)return;closing=true;for(const t of timers)clearInterval(t);await recommended.stop();await Promise.all([recovery.stop(),profiles.stop()]);await lockCall('engine.unlock').catch(()=>{}); },
    active:()=>profiles.active()||!!recommended.engine?.config?.automatic||recommended.busy, busy:()=>profiles.busy()||recommended.busy
  };
}
module.exports={createApplication,moveInput:{moveChoices,writerChoices}};
