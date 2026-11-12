'use strict';
const { app, BrowserWindow, ipcMain, dialog, safeStorage, Tray, Menu, nativeImage, shell, powerMonitor } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Profiles } = require('./profiles.cjs');
const { parseKit } = require('./engine.cjs');
const { RecoveryService } = require('./recovery-service.cjs');
const { clientConfig } = require('./recovery-auth.cjs');
const { protection } = require('./protection.cjs');
const { startupControl } = require('./startup.cjs');
const fileSelection = require('./restore-select.cjs');

const testMode = process.argv.includes('--test-mode');
const testState = testMode && process.env.SOLO_BACKUP_TEST_STATE;
if (testState) app.setPath('userData', path.resolve(testState));
else app.setPath('userData', path.join(app.getPath('appData'), 'SoloWorkBackup'));
app.setName('업무 백업');
if (process.platform === 'win32') app.setAppUserModelId('SoloWorkBackup');
const page = path.join(__dirname, '..', 'ui', 'index.html');
const pageUrl = pathToFileURL(page).href;
let window, tray, profiles, recovery, quitting = false, closing = false, dialogBusy = false;

const { startupRegistered, setStartup } = startupControl(app, { testMode });
function state() {
  const value = { ...profiles.getState(), recovery: recovery?.getState(), launchAtLogin: startupRegistered() };
  return { ...value, protection: protection(value, { startupRegistered: value.launchAtLogin }) };
}
function push() { if (window && !window.isDestroyed()) window.webContents.send('backup:state', state()); }
function show() { if (window?.isMinimized()) window.restore(); window?.show(); window?.focus(); }
async function shutdown() { if (closing) return; closing = true; await Promise.all([recovery?.stop(), profiles?.stop()]); quitting = true; app.quit(); }
function launchJob(engine, action) {
  // An automatic job may have started while the native picker was open.
  // Reject through IPC before detaching so that this request's failure is shown.
  if (closing || engine.stopping || engine.job) throw new Error('진행 중인 작업이 끝난 뒤 다시 눌러 주세요.');
  // The engine owns its job lock and persists/emits failures. Release the IPC
  // gate once it has started so another profile remains usable during long I/O.
  void action().catch(() => push());
  return state();
}
function trusted(event) { return event.sender === window?.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === pageUrl; }
function handle(name, action, { read = false, switching = false, safeErrors = false } = {}) {
  ipcMain.handle(`backup:${name}`, async (event, ...args) => {
    if (!trusted(event)) return { ok: false, error: '이 화면에서는 실행할 수 없습니다.' };
    if (!read && (closing || dialogBusy || recovery?.busy || (!switching && profiles.current.job))) return { ok: false, error: '진행 중인 작업이 끝난 뒤 다시 눌러 주세요.' };
    const context = { engine: profiles.current, selection: profiles.selection };
    try { if (!read) dialogBusy = true; profiles.boundaries(); const result = await action(context, ...args); push(); return { ok: true, value: result }; }
    catch (e) { if (safeErrors) { const clean = fileSelection.safeError(e); return { ok: false, error: clean.message, code: clean.code }; } return { ok: false, error: context.engine.clean(e.message) }; }
    finally { if (!read) dialogBusy = false; }
  });
}
async function folder(title, multi = false) {
  const result = await dialog.showOpenDialog(window, { title, properties: ['openDirectory', 'createDirectory', ...(multi ? ['multiSelections'] : [])] });
  return result.canceled ? null : result.filePaths;
}
function createWindow() {
  window = new BrowserWindow({ width: 1080, height: 820, minWidth: 760, minHeight: 640, show: false, backgroundColor: '#f7f8f4', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false, offscreen: testMode, backgroundThrottling: !testMode } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', e => e.preventDefault());
  window.webContents.on('did-start-navigation', (_event, _url, _inPlace, mainFrame) => { if (mainFrame) for (const engine of Object.values(profiles.engines)) engine.discardCatalog(); });
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(pathToFileURL(path.join(__dirname, '..', 'ui')).href + '/') }));
  window.on('close', e => { if (!quitting && profiles.active()) { e.preventDefault(); window.hide(); } });
  window.once('ready-to-show', () => { if (!testMode && !(process.argv.includes('--background') && profiles.active())) window.show(); });
  void window.loadFile(page);
}
function createTray() {
  // Small original monochrome tray mark, kept inline as a local resource.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#126e60"/><path d="M9 16l5 5 10-11" fill="none" stroke="white" stroke-width="4"/></svg>';
  let icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  if (icon.isEmpty()) icon = nativeImage.createFromPath(path.join(__dirname, '..', 'ui', 'tray.png'));
  tray = new Tray(icon); tray.setToolTip('업무 백업 · 시험판');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: '업무 백업 열기', click: show }, { type: 'separator' }, { label: '앱 종료 (자동 백업 중지)', click: async () => {
    if (profiles.busy()) { const reply = await dialog.showMessageBox(window, { type: 'question', message: '백업이 진행 중입니다. 종료할까요?', detail: '새 작업은 시작하지 않고, 지금 진행 중인 작업이 안전하게 끝나면 앱이 종료됩니다. 데이터가 많으면 오래 걸릴 수 있습니다. 원본 파일은 삭제되지 않습니다.', buttons: ['계속 진행', '작업 완료 후 종료'], defaultId: 0, cancelId: 0 }); if (reply.response !== 1) return; }
    await shutdown();
  } }]));
  tray.on('double-click', show);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', show);
  app.whenReady().then(async () => {
    if (process.platform !== 'win32') throw new Error('이 시험판은 Windows용입니다.');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 암호 보관함을 사용할 수 없습니다.');
    profiles = new Profiles({ root: app.getPath('userData'), resticPath: app.isPackaged ? path.join(process.resourcesPath, 'restic.exe') : process.env.SOLO_BACKUP_RESTIC || path.join(__dirname, '..', 'bin', 'restic.exe'),
      secretStore: { encrypt: value => safeStorage.encryptString(value), decrypt: bytes => safeStorage.decryptString(bytes) } });
    await profiles.open();
    let client = null;
    try { const configPath = app.isPackaged ? path.join(process.resourcesPath, 'recovery-client.json') : process.env.SOLO_BACKUP_GOOGLE_CLIENT; if (configPath) client = clientConfig(JSON.parse(await fs.readFile(configPath, 'utf8'))); }
    catch { /* Backup and manual recovery stay available without build config. */ }
    recovery = new RecoveryService({ root: app.getPath('userData'), secretStore: { encrypt: value => safeStorage.encryptString(value), decrypt: bytes => safeStorage.decryptString(bytes) }, engine: profiles.engines.b2, client,
      openExternal: url => { const u = new URL(url); if (u.origin !== 'https://accounts.google.com' || u.pathname !== '/o/oauth2/v2/auth') throw new Error('허용되지 않은 로그인 주소입니다.'); return shell.openExternal(url); } });
    await recovery.open(); recovery.on('state', push);
    profiles.on('state', push);
    handle('getState', () => state(), { read: true });
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
      try { await require('./paths.cjs').directory(target); } catch { throw fileSelection.issue('OUTPUT_UNSAFE'); }
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
      setStartup(enabled);
      return state();
    });
    handle('openRestoreFolder', async ({ engine }) => { const target = engine.config?.lastRestore?.path; if (!target) throw new Error('완료된 복구 폴더가 없습니다.'); const error = await shell.openPath(target); if (error) throw new Error(error); return null; });
    createWindow(); createTray(); profiles.start(); void recovery.tick();
    powerMonitor.on('resume', () => profiles.tick());
  }).catch(e => { if (testMode) console.error(e.message); else dialog.showErrorBox('업무 백업을 시작하지 못했습니다', e.message); app.exit(1); });
  app.on('before-quit', event => { if (!quitting) { event.preventDefault(); void shutdown(); } });
  app.on('window-all-closed', () => { if (!profiles?.active()) app.quit(); });
}
