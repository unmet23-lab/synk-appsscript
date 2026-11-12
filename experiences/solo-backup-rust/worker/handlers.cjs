'use strict';
// Handler bodies carried from the reviewed 0.5.0 Electron controller. Only the
// native adapter and awaited startup setter differ; the backup engine is shared.
const fs = require('node:fs/promises'), path = require('node:path');
const engineRoot = process.env.SWB_ENGINE_ROOT || path.resolve(__dirname, '../engine');
const { Profiles } = require(path.join(engineRoot, 'src/profiles.cjs'));
const { parseKit } = require(path.join(engineRoot, 'src/engine.cjs'));
const { RecoveryService } = require(path.join(engineRoot, 'src/recovery-service.cjs'));
const { clientConfig } = require(path.join(engineRoot, 'src/recovery-auth.cjs'));
const { protection } = require(path.join(engineRoot, 'src/protection.cjs'));
const fileSelection = require(path.join(engineRoot, 'src/restore-select.cjs'));
const { RecommendedBackup } = require(path.join(engineRoot, 'src/recommended.cjs'));
const contract = require('../contract/methods.json');

async function createApplication({ host, root, resticPath, clientPath, publish, testMode = false }) {
  let closing = false, dialogBusy = false, launchAtLogin = false;
  const window = null, handlers = new Map();
  const secretStore = {
    encrypt: async value => Buffer.from(await host('secret.encrypt', [value]), 'base64'),
    decrypt: async bytes => host('secret.decrypt', [bytes.toString('base64')])
  };
  const profiles = new Profiles({root, resticPath, secretStore}); await profiles.open();
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
  const recovery = new RecoveryService({root, secretStore, engine: profiles.engines.b2, client,
    openExternal: url => { const u = new URL(url); if (u.origin !== 'https://accounts.google.com' || u.pathname !== '/o/oauth2/v2/auth') throw new Error('허용되지 않은 로그인 주소입니다.'); return shell.openExternal(url); }});
  await recovery.open();
  launchAtLogin = await host('startup.read', []);
  const recommended = new RecommendedBackup({root:path.join(root,'recommended'),resticPath,secretStore,
    plannerPath:path.join(path.dirname(resticPath),'WorkBackupPlanner.exe'),inventoryPath:path.join(path.dirname(resticPath),'WorkBackupInventory.exe'),
    protectedPaths:[root,...['SoloWorkBackup','SoloWorkBackupRustBeta'].map(n=>path.join(process.env.APPDATA||path.dirname(root),n)),...Object.values(profiles.engines).flatMap(e=>e.config&&!e.isCloud()?[e.config.repository]:[])],
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
    const value = {...profiles.getState(), version:'0.6.1-rust-beta.1', recovery:recovery.getState(), launchAtLogin,recommended:recommended.state()};
    return {...value, protection:protection(value,{startupRegistered:launchAtLogin})};
  }
  function push() { publish(state()); }
  async function setStartup(enabled) { launchAtLogin = await host('startup.set', [enabled]); return launchAtLogin; }
  function launchJob(engine, action) {
    if (closing || engine.stopping || engine.job) throw new Error('진행 중인 작업이 끝난 뒤 다시 눌러 주세요.');
    void action().catch(() => push()); return state();
  }
  function handle(name, action, {read=false,switching=false,safeErrors=false}={}) {
    handlers.set(name, async (...args) => {
      const context = {engine:profiles.current, selection:profiles.selection};
      if (!read && (closing || dialogBusy || recovery.busy || (!switching && context.engine.job))) return {ok:false,error:'진행 중인 작업이 끝난 뒤 다시 눌러 주세요.'};
      if ((context.engine.config?.readOnly || context.engine.config?.mode === 'restore') && !contract[name].allowedReadOnly) return {ok:false,error:'복구 전용 연결입니다.',code:'READ_ONLY'};
      try { if (!read) dialogBusy=true; profiles.boundaries(); const result=await action(context,...args); push(); return {ok:true,value:result}; }
      catch(e) { if(safeErrors) {const clean=fileSelection.safeError(e);return {ok:false,error:clean.message,code:clean.code};}return {ok:false,error:context.engine.clean(e.message)}; }
      finally {if(!read)dialogBusy=false;}
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
    handle('chooseSources', async ({ engine, selection }) => { if (engine.config?.repositoryId || (engine.isCloud() && engine.config)) throw new Error('설정한 작업 폴더는 이 시험판에서 변경할 수 없습니다.'); const picked = await folder('백업할 작업 폴더 선택', true); if (picked) { await engine.resetUnfinishedSetup(); selection.sources = picked; } return [...selection.sources]; });
    handle('chooseTarget', async ({ engine, selection }) => { if (engine.isCloud() || engine.config?.repositoryId) throw new Error('설정한 저장소는 이 시험판에서 변경할 수 없습니다.'); const picked = await folder('백업을 보관할 폴더 선택'); if (picked) { profiles.assertLocalTarget(picked[0]); await engine.resetUnfinishedSetup(); selection.target = picked[0]; } return selection.target; });
    handle('reuseLocalSources', ({ engine, selection }) => { if (!engine.isCloud() || engine.config) throw new Error('새 클라우드 연결에서만 폴더를 가져올 수 있습니다.'); selection.sources = [...(profiles.engines.local.config?.sources || [])]; return state(); });
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
    handle('startAutomatic', async ({ engine }) => { await engine.setAutomatic(true); setImmediate(() => profiles.tick()); return state(); });
    handle('setAutomatic', async ({ engine }, enabled) => { await engine.setAutomatic(enabled); if (enabled) setImmediate(() => profiles.tick()); return state(); });
    handle('backupNow', ({ engine }) => launchJob(engine, () => engine.backupNow()));
    handle('protectNow', ({ engine }) => { engine.assertBackupReady(); return launchJob(engine, () => engine.protectNow({ registerStartup: async () => setStartup(true) })); });
    handle('pauseAutomatic', async ({ engine }, minutes) => { await engine.pauseAutomatic(minutes); return state(); });
    handle('resumeAutomatic', async ({ engine }) => { await engine.resumeAutomatic(); setImmediate(() => profiles.tick()); return state(); });
    handle('probeRestore', ({ engine }) => { engine.assertBackupReady(); return launchJob(engine, () => engine.probeRestore()); });
    handle('checkRepository', async ({ engine }) => { if (engine.isCloud()) { const answer = await dialog.showMessageBox(window, { type: 'question', message: '클라우드의 전체 데이터를 내려받아 점검합니다.', detail: 'B2 다운로드 사용량이 늘어나며 무료 한도를 넘으면 요금이 발생할 수 있습니다.', buttons: ['취소', '전체 점검'], defaultId: 0, cancelId: 0 }); if (answer.response !== 1) throw new Error('전체 점검을 취소했습니다.'); } return launchJob(engine, () => engine.checkRepository()); });
    handle('restoreLatest', async ({ engine }) => {
      if (engine.config?.health?.status === 'attention') {
        const answer = await dialog.showMessageBox(window, { type: 'warning', message: '저장소 점검이 완료되지 않았습니다.', detail: '복구를 시도하고 파일 내용을 검증합니다. 일부 파일은 복구되지 않을 수 있습니다.', buttons: ['취소', '복구 시도'], defaultId: 0, cancelId: 0 });
        if (answer.response !== 1) throw new Error('복구를 취소했습니다.');
      }
      const picked = await folder('복구한 파일을 담을 별도 폴더 선택'); if (!picked) throw new Error('복구를 취소했습니다.');
      profiles.assertOutput(picked[0]);
      return launchJob(engine, () => engine.restoreLatest({ parent: picked[0] }));
    });
    function catalogInput({ engine }, input, keys, required = keys) {
      fileSelection.request(input, keys, required);
      if (!['local', 'b2'].includes(input.profile) || input.profile !== profiles.profile || engine !== profiles.engines[input.profile]) throw fileSelection.issue('CATALOG_EXPIRED');
      return input;
    }
    handle('openFileCatalog', async (context, input) => {
      catalogInput(context, input, ['profile']); return context.engine.openFileCatalog();
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
      catalogInput(context, input, ['profile', 'token', 'revision']);
      context.engine.prepareSelectedRestore(input);
      const picked = await folder('선택한 파일을 복구할 별도 폴더 선택');
      if (!picked) return { profile: input.profile, token: input.token, canceled: true };
      catalogInput(context, input, ['profile', 'token', 'revision']);
      try { profiles.assertOutput(picked[0]); } catch { throw fileSelection.issue('OUTPUT_UNSAFE'); }
      context.engine.prepareSelectedRestore(input);
      const started = launchJob(context.engine, () => context.engine.restoreSelected({ token: input.token, revision: input.revision, parent: picked[0] }));
      return { profile: input.profile, token: input.token, started: true, state: started };
    }, { safeErrors: true });
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
      const repo = engine.isCloud() ? null : await folder('work-backup-으로 시작하는 실제 백업 저장소 선택'); if (!engine.isCloud() && !repo) throw new Error('연결을 취소했습니다.');
      if (repo) profiles.assertLocalTarget(repo[0]);
      await engine.importRecoveryKit({ text, repository: repo?.[0], credentials }); return state();
    });
    handle('recoverCredential', async ({ engine }, credentials) => { await engine.recoverCredential(await readKit(), credentials); return state(); });
    handle('setLaunchAtLogin', async (_context, enabled) => {
      await setStartup(enabled);
      return state();
    });
    handle('openRestoreFolder', async ({ engine }) => { const target = engine.config?.lastRestore?.path; if (!target) throw new Error('완료된 복구 폴더가 없습니다.'); const error = await shell.openPath(target); if (error) throw new Error(error); return null; });

  profiles.on('state',push); recovery.on('state',push);
  profiles.start(); void recovery.tick();
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
    async stop() { if(closing)return;closing=true;await recommended.stop();await Promise.all([recovery.stop(),profiles.stop()]); },
    active:()=>profiles.active()||!!recommended.engine?.config?.automatic||recommended.busy, busy:()=>profiles.busy()||recommended.busy
  };
}
module.exports={createApplication};
