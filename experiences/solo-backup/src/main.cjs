'use strict';
const { app, BrowserWindow, ipcMain, dialog, safeStorage, Tray, Menu, nativeImage, shell, powerMonitor } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BackupEngine } = require('./engine.cjs');

const testMode = process.argv.includes('--test-mode');
const testState = testMode && process.env.SOLO_BACKUP_TEST_STATE;
if (testState) app.setPath('userData', path.resolve(testState));
else app.setPath('userData', path.join(app.getPath('appData'), 'SoloWorkBackup'));
app.setName('업무 백업');
const page = path.join(__dirname, '..', 'ui', 'index.html');
const pageUrl = pathToFileURL(page).href;
let window, tray, engine, quitting = false, closing = false, dialogBusy = false;
let selection = { sources: [], target: null };

function state() {
  return { ...engine.getState(), selection: { sources: [...selection.sources], target: selection.target }, launchAtLogin: testMode ? false : app.getLoginItemSettings({ path: process.execPath, args: ['--background'] }).openAtLogin };
}
function push() { if (window && !window.isDestroyed()) window.webContents.send('backup:state', state()); }
function show() { if (window?.isMinimized()) window.restore(); window?.show(); window?.focus(); }
async function shutdown() { if (closing) return; closing = true; await engine?.stop(); quitting = true; app.quit(); }
function trusted(event) { return event.sender === window?.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === pageUrl; }
function handle(name, action, { read = false } = {}) {
  ipcMain.handle(`backup:${name}`, async (event, ...args) => {
    if (!trusted(event)) return { ok: false, error: '이 화면에서는 실행할 수 없습니다.' };
    if (!read && (dialogBusy || engine.job)) return { ok: false, error: '진행 중인 작업이 끝난 뒤 다시 눌러 주세요.' };
    try { if (!read) dialogBusy = true; const result = await action(...args); push(); return { ok: true, value: result }; }
    catch (e) { return { ok: false, error: engine.clean(e.message) }; }
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
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(pathToFileURL(path.join(__dirname, '..', 'ui')).href + '/') }));
  window.on('close', e => { if (!quitting && (engine.getState().automatic || engine.job)) { e.preventDefault(); window.hide(); } });
  window.once('ready-to-show', () => { if (!testMode && !(process.argv.includes('--background') && engine.getState().automatic)) window.show(); });
  void window.loadFile(page);
}
function createTray() {
  // Small original monochrome tray mark, kept inline as a local resource.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#126e60"/><path d="M9 16l5 5 10-11" fill="none" stroke="white" stroke-width="4"/></svg>';
  let icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  if (icon.isEmpty()) icon = nativeImage.createFromPath(path.join(__dirname, '..', 'ui', 'tray.png'));
  tray = new Tray(icon); tray.setToolTip('업무 백업 · 시험판');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: '업무 백업 열기', click: show }, { type: 'separator' }, { label: '앱 종료 (자동 백업 중지)', click: async () => {
    if (engine.job) { const reply = await dialog.showMessageBox(window, { type: 'question', message: '백업이 진행 중입니다. 종료할까요?', detail: '새 작업은 시작하지 않고, 지금 진행 중인 작업이 안전하게 끝나면 앱이 종료됩니다. 데이터가 많으면 오래 걸릴 수 있습니다. 원본 파일은 삭제되지 않습니다.', buttons: ['계속 진행', '작업 완료 후 종료'], defaultId: 0, cancelId: 0 }); if (reply.response !== 1) return; }
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
    engine = new BackupEngine({ stateDir: path.join(app.getPath('userData'), 'vault'), resticPath: app.isPackaged ? path.join(process.resourcesPath, 'restic.exe') : process.env.SOLO_BACKUP_RESTIC || path.join(__dirname, '..', 'bin', 'restic.exe'),
      secretStore: { encrypt: value => safeStorage.encryptString(value), decrypt: bytes => safeStorage.decryptString(bytes) } });
    try { await engine.open(); }
    catch (e) {
      if (e.code !== 'RECOVERY_REQUIRED' || testMode) throw e;
      const answer = await dialog.showMessageBox({ type: 'warning', message: e.message, detail: '기존 백업과 설정을 지우지 않고 Windows 암호 보관함만 다시 연결합니다.', buttons: ['복구 키 선택', '종료'], defaultId: 0, cancelId: 1 });
      if (answer.response !== 0) { app.exit(0); return; }
      const picked = await dialog.showOpenDialog({ title: '저장한 복구 키 파일 선택', properties: ['openFile'], filters: [{ name: '복구 키', extensions: ['json'] }] });
      if (picked.canceled) { app.exit(0); return; }
      if ((await fs.stat(picked.filePaths[0])).size > 65536) throw new Error('복구 키 파일이 너무 큽니다.');
      await engine.recoverCredential(await fs.readFile(picked.filePaths[0], 'utf8'));
    }
    if (engine.config && !engine.config.repositoryId) selection = { sources: engine.config.sources, target: path.dirname(engine.config.repository) };
    engine.on('state', push);
    handle('getState', () => state(), { read: true });
    handle('chooseSources', async () => { if (engine.config?.repositoryId) throw new Error('설정한 작업 폴더는 이 시험판에서 변경할 수 없습니다.'); const picked = await folder('백업할 작업 폴더 선택', true); if (picked) { await engine.resetUnfinishedSetup(); selection.sources = picked; } return [...selection.sources]; });
    handle('chooseTarget', async () => { if (engine.config?.repositoryId) throw new Error('설정한 저장소는 이 시험판에서 변경할 수 없습니다.'); const picked = await folder('백업을 보관할 폴더 선택'); if (picked) { await engine.resetUnfinishedSetup(); selection.target = picked[0]; } return selection.target; });
    handle('setup', async () => { await engine.setup({ sources: selection.sources, parent: selection.target }); return state(); });
    handle('saveRecoveryKit', async () => {
      const result = await dialog.showSaveDialog(window, { title: '복구 키를 별도 장소에 저장', defaultPath: '업무백업-복구키.json', filters: [{ name: '복구 키', extensions: ['json'] }], properties: ['createDirectory', 'showOverwriteConfirmation'] });
      if (result.canceled) throw new Error('복구 키 저장을 취소했습니다. 저장 후 백업을 시작할 수 있습니다.');
      await engine.saveRecoveryKit(result.filePath); return state();
    });
    handle('startAutomatic', async () => { await engine.setAutomatic(true); setImmediate(() => { void engine.tick(); }); return state(); });
    handle('setAutomatic', async enabled => { await engine.setAutomatic(enabled); if (enabled) setImmediate(() => { void engine.tick(); }); return state(); });
    handle('backupNow', async () => { await engine.backupNow(); return state(); });
    handle('checkRepository', async () => { await engine.checkRepository(); return state(); });
    handle('restoreLatest', async () => {
      if (engine.config?.health?.status === 'attention') {
        const answer = await dialog.showMessageBox(window, { type: 'warning', message: '저장소 점검이 완료되지 않았습니다.', detail: '복구를 시도하고 파일 내용을 검증합니다. 일부 파일은 복구되지 않을 수 있습니다.', buttons: ['취소', '복구 시도'], defaultId: 0, cancelId: 0 });
        if (answer.response !== 1) throw new Error('복구를 취소했습니다.');
      }
      const picked = await folder('복구한 파일을 담을 별도 폴더 선택'); if (!picked) throw new Error('복구를 취소했습니다.');
      await engine.restoreLatest({ parent: picked[0] }); return state();
    });
    handle('importRecoveryKit', async () => {
      const picked = await dialog.showOpenDialog(window, { title: '복구 키 파일 선택', properties: ['openFile'], filters: [{ name: '복구 키', extensions: ['json'] }] });
      if (picked.canceled) throw new Error('연결을 취소했습니다.');
      const stat = await fs.stat(picked.filePaths[0]); if (stat.size > 65536) throw new Error('복구 키 파일이 너무 큽니다.');
      const text = await fs.readFile(picked.filePaths[0], 'utf8');
      const repo = await folder('work-backup-으로 시작하는 실제 백업 저장소 선택'); if (!repo) throw new Error('연결을 취소했습니다.');
      await engine.importRecoveryKit({ text, repository: repo[0] }); return state();
    });
    handle('setLaunchAtLogin', async enabled => {
      if (typeof enabled !== 'boolean') throw new Error('시작 설정을 확인해 주세요.');
      if (testMode || !app.isPackaged) throw new Error('시험 실행에서는 Windows 시작 등록을 변경하지 않습니다.');
      app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: ['--background'], name: 'SoloWorkBackup' });
      if (app.getLoginItemSettings({ path: process.execPath, args: ['--background'] }).openAtLogin !== enabled) throw new Error('Windows 시작 등록을 확인하지 못했습니다.');
      return state();
    });
    handle('openRestoreFolder', async () => { const target = engine.config?.lastRestore?.path; if (!target) throw new Error('완료된 복구 폴더가 없습니다.'); const error = await shell.openPath(target); if (error) throw new Error(error); return null; });
    createWindow(); createTray(); engine.startScheduler();
    powerMonitor.on('resume', () => { void engine.tick(); });
    void engine.tick();
  }).catch(e => { if (testMode) console.error(e.message); else dialog.showErrorBox('업무 백업을 시작하지 못했습니다', e.message); app.exit(1); });
  app.on('before-quit', event => { if (!quitting) { event.preventDefault(); void shutdown(); } });
  app.on('window-all-closed', () => { if (!engine?.getState().automatic && !engine?.job) app.quit(); });
}
